/* The same street model the demo runs, in Node, so the paper's figures and the
 * live demo cannot drift apart. Parameters match js/sim.js.
 *
 * This is a teaching model of one low-voltage feeder. It is not a study of a real
 * network: see the assumptions table in the paper.
 */
const CFG = {
  homes: 24,
  evShare: 0.6,
  txRating: 100,        // kW
  safeLimit: 0.95,
  chargerKW: 7.4,
  minKW: 1.4,           // 6 A at 230 V
  battKWh: 60,
  pvPeakKW: 40,
  storeKWh: 120,
  storeMaxKW: 35,
  startHour: 16,
  endHour: 32,          // 08:00 the next morning
  stepMin: 2,
  seed: 7,
};

const SHAPE = [
  // Gulf summer residential day. Must stay identical to js/sim.js.
  0.62, 0.58, 0.56, 0.55, 0.55, 0.57, 0.60, 0.63, 0.64, 0.66, 0.70, 0.74,
  0.78, 0.81, 0.83, 0.84, 0.84, 0.86, 0.90, 0.96, 1.00, 0.98, 0.88, 0.72,
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

function houseLoad(hour) {
  const h = ((hour % 24) + 24) % 24;
  const i = Math.floor(h), j = (i + 1) % 24, f = h - i;
  return SHAPE[i] * (1 - f) + SHAPE[j] * f;
}
function solarFactor(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 6 || h > 18.5) return 0;
  return Math.pow(Math.sin((Math.PI * (h - 6)) / 12.5), 1.35);
}

function buildCars(cfg) {
  const r = rng(cfg.seed);
  const n = Math.round(cfg.homes * cfg.evShare);
  const out = [];
  // the draw order has to match js/sim.js exactly, or the two produce different
  // fleets from the same seed and the paper stops agreeing with the demo
  for (let i = 0; i < n; i++) {
    const arrive = 17 + 2.0 * (r() + r() - 1);
    const depart = 31.5 + 1.2 * (r() + r() - 1);
    const soc = 0.25 + 0.4 * r();
    const target = 0.85 + 0.1 * r();
    out.push({
      arrive, depart,
      batt: cfg.battKWh * (0.8 + 0.4 * r()),
      soc, target,
      power: 0, ready: false,
    });
  }
  out.forEach((c) => { c.need0 = (c.target - c.soc) * c.batt; });
  return out;
}

/* mode: 'none' | 'smart' ; solar: boolean */
function run(mode, solar, over) {
  const cfg = Object.assign({}, CFG, over || {});
  const cars = buildCars(cfg);
  const dt = cfg.stepMin / 60;
  const limit = cfg.txRating * cfg.safeLimit;
  const perHomePeak = (cfg.txRating * 0.5) / cfg.homes;
  let store = cfg.storeKWh, peak = 0, overMin = 0;
  const trace = { hour: [], house: [], car: [], net: [], pv: [] };

  for (let hour = cfg.startHour; hour < cfg.endHour; hour += dt) {
    const house = cfg.homes * houseLoad(hour) * perHomePeak;

    let pv = 0, fromStore = 0;
    if (solar) {
      pv = cfg.pvPeakKW * solarFactor(hour);
      const surplus = Math.max(0, pv - 2);
      const room = (cfg.storeKWh - store) / dt;
      const toStore = Math.min(surplus, room, cfg.storeMaxKW);
      store += toStore * dt;
      pv -= toStore;
    }

    const active = cars.filter((c) => hour >= c.arrive && hour < c.depart && c.soc < c.target);
    cars.forEach((c) => { c.power = 0; });

    // the battery can be drawn on this step, so it counts as headroom the controller may allocate
    const dischargeAvail = solar ? Math.min(cfg.storeMaxKW, store / dt) : 0;
    const headroom = limit - house + pv + dischargeAvail;

    if (mode === 'none') {
      active.forEach((c) => { c.power = cfg.chargerKW; });
    } else {
      const queue = active.map((c) => {
        const need = (c.target - c.soc) * c.batt;
        const left = Math.max(dt, c.depart - hour);
        return { c, need, left, laxity: left - need / cfg.chargerKW };
      }).sort((a, b) => a.laxity - b.laxity);

      let budget = Math.max(0, headroom);
      for (const q of queue) {
        if (budget < cfg.minKW) break;
        const justInTime = (q.need / q.left) * 1.25;   // finish a little early when there is room
        const ask = q.laxity <= 0 ? cfg.chargerKW : clamp(justInTime, cfg.minKW, cfg.chargerKW);
        const give = Math.min(ask, budget);
        if (give >= cfg.minKW) { q.c.power = give; budget -= give; }
      }
    }

    let carLoad = 0;
    cars.forEach((c) => {
      if (c.power > 0) { c.soc = Math.min(1, c.soc + (c.power * dt) / c.batt); carLoad += c.power; }
      if (c.soc >= c.target - 0.005) c.ready = true;
    });

    // settle the battery against what the transformer would actually see
    const gross = house + carLoad - pv;
    if (dischargeAvail > 0 && gross > limit) {
      fromStore = Math.min(gross - limit, dischargeAvail);
      store -= fromStore * dt;
    }

    const net = Math.max(0, gross - fromStore);
    if (net > peak) peak = net;
    if (net > limit) overMin += cfg.stepMin;

    trace.hour.push(hour);
    trace.house.push(house);
    trace.car.push(carLoad);
    trace.net.push(net);
    trace.pv.push(pv + fromStore);
  }

  return {
    mode, solar,
    peakPct: Math.round((peak / limit) * 100),
    overMin,
    ready: cars.filter((c) => c.ready).length,
    total: cars.length,
    energyKWh: Math.round(cars.reduce((s, c) => s + c.need0, 0)),
    trace, limit, cfg,
  };
}

module.exports = { CFG, run, houseLoad, solarFactor };

if (require.main === module) {
  console.log('street model —', CFG.homes, 'homes,', CFG.txRating, 'kW transformer, limit', CFG.safeLimit * 100 + '%');
  for (const solar of [false, true]) {
    for (const mode of ['none', 'smart']) {
      const r = run(mode, solar);
      console.log(
        (mode + (solar ? ' + solar' : '')).padEnd(16),
        ('peak ' + r.peakPct + '%').padEnd(12),
        ('over ' + r.overMin + ' min').padEnd(14),
        'ready ' + r.ready + '/' + r.total,
        '| fleet needs ' + r.energyKWh + ' kWh');
    }
  }
}
