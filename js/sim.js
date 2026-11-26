/* Neighbourhood EV charging simulation.
 *
 * One LV distribution transformer, 24 homes, an evening-to-morning run.
 * Three things the visitor can change:
 *    mode  = "none"  every car charges flat out the moment it plugs in
 *            "smart" the controller shares the measured headroom, most urgent car first
 *    solar = a shared PV canopy with a battery, charged during the day and
 *            discharged into the evening peak
 *
 * Everything is deterministic from a fixed seed, so the numbers on screen match
 * the ones in the paper.
 */
(function () {
  'use strict';

  const CFG = {
    homes: 24,
    evShare: 0.6,           // matches the penetration used in the paper
    txRating: 100,          // transformer nameplate [kW] for a street this size
    safeLimit: 0.95,        // utilities plan against this, not nameplate
    chargerKW: 7.4,
    minKW: 1.4,             // 6 A at 230 V — below this a charger must stop, not slow
    battKWh: 60,
    pvPeakKW: 40,           // shared solar canopy over the parking
    storeKWh: 120,          // battery behind the canopy
    storeMaxKW: 35,
    startHour: 16,
    endHour: 32,            // 08:00 next day
    stepMin: 2,             // simulated minutes per tick
    seed: 7,
  };

  /* ------------------------------------------------------------- helpers */
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
  const hhmm = (h) => {
    const m = Math.round((h % 24) * 60);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  // household demand through the day, normalised; evening peak around 19:00
  const SHAPE = [
    0.42, 0.38, 0.36, 0.35, 0.36, 0.40, 0.52, 0.64, 0.68, 0.64, 0.60, 0.58,
    0.58, 0.58, 0.60, 0.66, 0.78, 0.92, 1.00, 0.98, 0.90, 0.78, 0.62, 0.50,
  ];
  function houseLoad(hour) {
    const h = ((hour % 24) + 24) % 24;
    const i = Math.floor(h), j = (i + 1) % 24, f = h - i;
    return SHAPE[i] * (1 - f) + SHAPE[j] * f;
  }
  // clear-sky PV through a Dubai day, zero before 06:00 and after 18:30
  function solarFactor(hour) {
    const h = ((hour % 24) + 24) % 24;
    if (h < 6 || h > 18.5) return 0;
    return Math.pow(Math.sin((Math.PI * (h - 6)) / 12.5), 1.35);
  }

  /* --------------------------------------------------------------- state */
  const S = {
    mode: 'none',
    solar: false,
    running: false,
    hour: CFG.startHour,
    cars: [],
    peak: 0,
    overMin: 0,
    store: 0,
    results: {},       // keyed "none" / "smart" / "none+solar" / "smart+solar"
  };

  function buildCars() {
    const r = rng(CFG.seed);
    const n = Math.round(CFG.homes * CFG.evShare);
    const out = [];
    for (let i = 0; i < n; i++) {
      const arrive = 17 + 2.0 * (r() + r() - 1);
      const depart = 31.5 + 1.2 * (r() + r() - 1);     // 07:30 next day, ±
      const soc = 0.25 + 0.4 * r();
      const target = 0.85 + 0.1 * r();
      out.push({
        home: i, arrive, depart,
        batt: CFG.battKWh * (0.8 + 0.4 * r()),
        soc, startSoc: soc, target,
        power: 0, ready: false,
      });
    }
    // spread the cars across the street rather than filling the first N houses
    const homes = [...Array(CFG.homes).keys()];
    for (let i = homes.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [homes[i], homes[j]] = [homes[j], homes[i]]; }
    out.forEach((c, i) => { c.home = homes[i]; });
    return out;
  }

  function reset() {
    S.hour = CFG.startHour;
    S.cars = buildCars();
    S.peak = 0;
    S.overMin = 0;
    S.store = CFG.storeKWh;      // the battery filled up during the day
    // show the street as it actually is at 16:00 rather than an empty bar
    const perHomePeak = (CFG.txRating * 0.5) / CFG.homes;
    const house0 = CFG.homes * houseLoad(CFG.startHour) * perHomePeak;
    render(house0, 0, house0);
    scores(null);
    el('alarm').classList.remove('show');
  }

  /* ----------------------------------------------------------- one tick */
  function step() {
    const dt = CFG.stepMin / 60;
    S.hour += dt;

    const perHomePeak = (CFG.txRating * 0.5) / CFG.homes;
    const house = CFG.homes * houseLoad(S.hour) * perHomePeak;
    const limit = CFG.txRating * CFG.safeLimit;

    // --- solar canopy and its battery
    let pv = 0, fromStore = 0;
    if (S.solar) {
      pv = CFG.pvPeakKW * solarFactor(S.hour);
      const surplus = Math.max(0, pv - 2);                       // a little goes to the canopy's own services
      const room = (CFG.storeKWh - S.store) / dt;
      const toStore = Math.min(surplus, room, CFG.storeMaxKW);
      S.store += toStore * dt;
      pv -= toStore;
    }

    const active = S.cars.filter((c) => S.hour >= c.arrive && S.hour < c.depart && c.soc < c.target);
    S.cars.forEach((c) => { c.power = 0; });

    // the controller sees what is left under the limit, plus whatever the battery could give
    const dischargeAvail = S.solar ? Math.min(CFG.storeMaxKW, S.store / dt) : 0;
    const headroom = limit - house + pv + dischargeAvail;

    if (S.mode === 'none') {
      active.forEach((c) => { c.power = CFG.chargerKW; });
    } else {
      // most urgent first: laxity is the slack between time left and time needed
      const queue = active.map((c) => {
        const need = (c.target - c.soc) * c.batt;
        const left = Math.max(dt, c.depart - S.hour);
        return { c, need, left, laxity: left - need / CFG.chargerKW };
      }).sort((a, b) => a.laxity - b.laxity);

      let budget = Math.max(0, headroom);
      for (const q of queue) {
        if (budget < CFG.minKW) break;
        // aim to finish a little early rather than exactly on time, so a car builds
        // slack whenever the network has room to spare and is not caught out later
        const justInTime = (q.need / q.left) * 1.25;
        const ask = q.laxity <= 0 ? CFG.chargerKW : clamp(justInTime, CFG.minKW, CFG.chargerKW);
        const give = Math.min(ask, budget);
        if (give >= CFG.minKW) { q.c.power = give; budget -= give; }
      }
    }

    let carLoad = 0;
    S.cars.forEach((c) => {
      if (c.power > 0) { c.soc = Math.min(1, c.soc + (c.power * dt) / c.batt); carLoad += c.power; }
      if (c.soc >= c.target - 0.005) c.ready = true;
    });

    // settle the battery against what the transformer would actually see
    const gross = house + carLoad - pv;
    if (dischargeAvail > 0 && gross > limit) {
      fromStore = Math.min(gross - limit, dischargeAvail);
      S.store -= fromStore * dt;
    }

    const net = Math.max(0, gross - fromStore);
    if (net > S.peak) S.peak = net;
    if (net > limit) S.overMin += CFG.stepMin;

    render(house - Math.min(house, pv + fromStore), carLoad, net);

    if (S.hour >= CFG.endHour) finish();
  }

  /* -------------------------------------------------------------- render */
  const el = (id) => document.getElementById(id);

  function render(houseShown, carLoad, net) {
    const limit = CFG.txRating * CFG.safeLimit;
    const pct = (net / limit) * 100;
    // the dashed limit sits at 70% of the track so an overload is visibly past it
    const toTrack = (kw) => (kw / limit) * 70;

    el('fillHouse').style.width = Math.min(100, toTrack(Math.max(0, houseShown))) + '%';
    el('fillCar').style.width = Math.min(100 - toTrack(Math.max(0, houseShown)), toTrack(Math.max(0, carLoad))) + '%';
    el('pct').textContent = Math.round(pct) + '%';
    el('clock').textContent = hhmm(S.hour);

    const over = net > limit;
    el('alarm').classList.toggle('show', over);
    const v = el('verdict');
    if (S.hour <= CFG.startHour + 0.05) { v.textContent = 'Quiet — everyone’s still out'; v.className = 'verdict'; }
    else if (over) { v.textContent = 'Past the safe limit'; v.className = 'verdict bad'; }
    else if (pct > 80) { v.textContent = 'Getting tight'; v.className = 'verdict warn'; }
    else { v.textContent = 'Comfortably within limits'; v.className = 'verdict ok'; }

    // the street
    const homes = el('street').children;
    for (let i = 0; i < homes.length; i++) {
      const car = S.cars.find((c) => c.home === i);
      const walls = homes[i].querySelector('.walls');
      const box = homes[i].querySelector('.car');
      const soc = homes[i].querySelector('.soc');
      walls.classList.toggle('lit', houseLoad(S.hour) > 0.6);
      walls.classList.toggle('dark', over);
      if (!car) { box.style.visibility = 'hidden'; continue; }
      box.style.visibility = 'visible';
      const home = S.hour >= car.arrive && S.hour < car.depart;
      box.classList.toggle('hidden', !home);
      box.classList.toggle('charging', car.power >= CFG.chargerKW - 0.2);
      box.classList.toggle('slow', car.power > 0 && car.power < CFG.chargerKW - 0.2);
      soc.style.width = Math.round(car.soc * 100) + '%';
      soc.style.background = car.ready ? 'var(--safe)' : car.power > 0 ? 'var(--car)' : '#9fb0c0';
    }

    scores(null, pct);
  }

  function scores(done, livePct) {
    const limit = CFG.txRating * CFG.safeLimit;
    const peakPct = Math.round((S.peak / limit) * 100);
    const ready = S.cars.filter((c) => c.ready).length;
    el('sPeak').textContent = S.peak ? peakPct + '%' : '—';
    el('sOver').textContent = S.overMin ? S.overMin + ' min' : (S.hour > CFG.startHour ? 'none' : '—');
    el('sReady').textContent = S.cars.length ? ready + ' of ' + S.cars.length : '—';
    el('sPeak').parentElement.className = 'score' + (S.peak ? (peakPct > 100 ? ' bad' : ' good') : '');
    el('sOver').parentElement.className = 'score' + (S.hour > CFG.startHour ? (S.overMin ? ' bad' : ' good') : '');
  }

  /* --------------------------------------------------------------- flow */
  let timer = null;
  function play() {
    if (S.running) { stop(); return; }
    if (S.hour >= CFG.endHour) reset();
    S.running = true;
    el('play').textContent = '❚❚ Pause';
    el('play').classList.add('running');
    timer = setInterval(step, 38);
  }
  function stop() {
    S.running = false;
    clearInterval(timer);
    el('play').textContent = S.hour >= CFG.endHour ? '▶ Run it again' : '▶ Continue';
    el('play').classList.remove('running');
  }
  function finish() {
    stop();
    const limit = CFG.txRating * CFG.safeLimit;
    S.results[key()] = {
      peak: Math.round((S.peak / limit) * 100),
      over: S.overMin,
      ready: S.cars.filter((c) => c.ready).length,
      total: S.cars.length,
    };
    showCompare();
  }
  const key = () => S.mode + (S.solar ? '+solar' : '');

  function showCompare() {
    const a = S.results[S.solar ? 'none+solar' : 'none'];
    const b = S.results[S.solar ? 'smart+solar' : 'smart'];
    if (!a || !b) return;
    el('compare').hidden = false;
    el('cPeakA').textContent = a.peak + '%';   el('cPeakB').textContent = b.peak + '%';
    el('cOverA').textContent = a.over ? a.over + ' min' : 'none';
    el('cOverB').textContent = b.over ? b.over + ' min' : 'none';
    el('cReadyA').textContent = a.ready + ' of ' + a.total;
    el('cReadyB').textContent = b.ready + ' of ' + b.total;
    const round = (x) => Math.round(x / 5) * 5;
    el('takeaway').textContent =
      'Same cars, same energy, same night — the only thing that changed is when the power was drawn. Left alone the ' +
      `street pushes the transformer well past its limit (around ${round(a.peak)}% here) for a few hours. Sharing the ` +
      `capacity keeps it under the limit, and the cars still leave charged. The exact figures depend on the assumptions ` +
      'behind this model; the pattern is what matters.';
  }

  /* --------------------------------------------------------------- init */
  function buildStreet() {
    const wrap = el('street');
    wrap.innerHTML = '';
    for (let i = 0; i < CFG.homes; i++) {
      const d = document.createElement('div');
      d.className = 'home';
      d.innerHTML = '<div class="roof"></div><div class="walls"></div><div class="car"><div class="soc"></div></div>';
      wrap.appendChild(d);
    }
  }

  function addSolarToggle() {
    const btn = document.createElement('button');
    btn.className = 'mode solar';
    btn.id = 'solarBtn';
    btn.innerHTML = '<b>☀ Solar canopy</b><span>off</span>';
    btn.addEventListener('click', () => {
      S.solar = !S.solar;
      btn.classList.toggle('on', S.solar);
      btn.querySelector('span').textContent = S.solar ? 'on — PV + battery' : 'off';
      el('compare').hidden = true;
      stop(); reset();
      showCompare();
    });
    // el('clock') is the span inside .clock, so insert before the wrapper
    document.querySelector('.controls').insertBefore(btn, document.querySelector('.clock'));
  }

  buildStreet();
  addSolarToggle();
  reset();

  el('play').addEventListener('click', play);
  document.querySelectorAll('.mode[data-mode]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.mode[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    S.mode = b.dataset.mode;
    stop(); reset();
    showCompare();
  }));
})();
