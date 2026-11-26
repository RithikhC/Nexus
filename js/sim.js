/* One street, one transformer, one evening.
 *
 * Two modes:
 *   none  — every car draws its full rated power the moment it plugs in
 *   smart — the controller measures the spare capacity under the transformer's
 *           safe limit and shares it out, most urgent car first
 *
 * The controller panel shows its own working: the limit it is holding, the spare
 * capacity it measured, and the ranked queue it allocated from.
 *
 * Deterministic from a fixed seed. paper/model.js is the Node twin of this file
 * and draws its random values in the same order.
 */
(function () {
  'use strict';

  const CFG = {
    homes: 24,
    evShare: 0.6,          // the share of homes with a car, as used in the paper
    txRating: 100,         // transformer nameplate [kW]
    safeLimit: 0.95,       // utilities plan against this rather than nameplate
    chargerKW: 7.4,        // a common single-phase home charger
    minKW: 1.4,            // 6 A at 230 V: below this a session must pause, not slow
    battKWh: 60,
    startHour: 16,
    endHour: 32,           // 08:00 the next morning
    stepMin: 2,
    seed: 7,
  };
  const LIMIT = CFG.txRating * CFG.safeLimit;

  /* A Gulf summer residential day, hour by hour, as a fraction of the evening
   * peak. The shape matters more than the numbers. Two features are specific
   * to this climate and both work against us:
   *   - the floor is high. Air conditioning does not stop overnight when the
   *     minimum is around 31 degrees, so the quiet hours smart charging relies
   *     on are much shallower here than in the temperate studies.
   *   - it is flatter and more correlated. Cooling is driven by one variable
   *     every household shares, the outdoor temperature, so homes peak together
   *     before a single car is plugged in.
   */
  const SHAPE = [
    0.62, 0.58, 0.56, 0.55, 0.55, 0.57, 0.60, 0.63, 0.64, 0.66, 0.70, 0.74,
    0.78, 0.81, 0.83, 0.84, 0.84, 0.86, 0.90, 0.96, 1.00, 0.98, 0.88, 0.72,
  ];

  /* ------------------------------------------------------------ helpers */
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
  const el = (id) => document.getElementById(id);
  const hhmm = (h) => {
    const m = Math.round((((h % 24) + 24) % 24) * 60);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  function houseLoad(hour) {
    const h = ((hour % 24) + 24) % 24;
    const i = Math.floor(h), j = (i + 1) % 24, f = h - i;
    return SHAPE[i] * (1 - f) + SHAPE[j] * f;
  }

  /* -------------------------------------------------------------- state */
  const S = { mode: 'none', running: false, hour: CFG.startHour, cars: [], peak: 0, overMin: 0, results: {} };

  function buildCars() {
    const r = rng(CFG.seed);
    const n = Math.round(CFG.homes * CFG.evShare);
    const out = [];
    for (let i = 0; i < n; i++) {
      const arrive = 17 + 2.0 * (r() + r() - 1);
      const depart = 31.5 + 1.2 * (r() + r() - 1);
      const soc = 0.25 + 0.4 * r();
      const target = 0.85 + 0.1 * r();
      out.push({
        id: i + 1, home: i, arrive, depart, soc, target,
        batt: CFG.battKWh * (0.8 + 0.4 * r()),
        power: 0, ready: false,
      });
    }
    // scatter the cars across the street instead of filling the first N homes
    const homes = [...Array(CFG.homes).keys()];
    for (let i = homes.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [homes[i], homes[j]] = [homes[j], homes[i]]; }
    out.forEach((c, i) => { c.home = homes[i]; });
    return out;
  }

  /* ------------------------------------------------------------ one tick */
  function step() {
    const dt = CFG.stepMin / 60;
    S.hour += dt;

    const perHomePeak = (CFG.txRating * 0.5) / CFG.homes;
    const house = CFG.homes * houseLoad(S.hour) * perHomePeak;
    // The controller holds to whatever cap the operator has approved, which may
    // be tighter than the safe limit. The safe limit itself never moves.
    const capKW = CFG.txRating * (window.Advisor ? Advisor.policy().cap : CFG.safeLimit);
    const headroom = capKW - house;

    const active = S.cars.filter((c) => S.hour >= c.arrive && S.hour < c.depart && c.soc < c.target);
    S.cars.forEach((c) => { c.power = 0; });

    let queue = [];
    if (S.mode === 'none') {
      active.forEach((c) => { c.power = CFG.chargerKW; });
      queue = active.map((c) => ({ c, need: (c.target - c.soc) * c.batt, left: Math.max(dt, c.depart - S.hour), laxity: 99 }));
    } else {
      // Only enrolled chargers can be told anything. The rest draw what they
      // like, and the controller has to work around them — which is exactly
      // the situation the advisory layer exists to notice.
      const free = active.filter((c) => !c.enrolled);
      free.forEach((c) => { c.power = CFG.chargerKW; });
      S.freeKW = free.length * CFG.chargerKW;

      // laxity: hours of slack between the time left and the time needed at full power
      queue = active.filter((c) => c.enrolled).map((c) => {
        const need = (c.target - c.soc) * c.batt;
        const left = Math.max(dt, c.depart - S.hour);
        return { c, need, left, laxity: left - need / CFG.chargerKW };
      }).sort((a, b) => a.laxity - b.laxity);

      let budget = Math.max(0, headroom - S.freeKW);
      for (const q of queue) {
        if (budget < CFG.minKW) break;
        // finish a little early rather than exactly on time, so a car builds slack
        // whenever the network has room to spare
        const justInTime = (q.need / q.left) * 1.25;
        const ask = q.laxity <= 0 ? CFG.chargerKW : clamp(justInTime, CFG.minKW, CFG.chargerKW);
        const give = Math.min(ask, budget);
        if (give >= CFG.minKW) { q.c.power = give; budget -= give; }
      }
      // the free-riders still belong in the queue view, marked as uncontrolled
      queue = queue.concat(free.map((c) => ({
        c, need: (c.target - c.soc) * c.batt,
        left: Math.max(dt, c.depart - S.hour), laxity: 99, free: true,
      })));
    }

    let carLoad = 0;
    S.cars.forEach((c) => {
      if (c.power > 0) { c.soc = Math.min(1, c.soc + (c.power * dt) / c.batt); carLoad += c.power; }
      if (c.soc >= c.target - 0.005) c.ready = true;
    });

    const net = house + carLoad;
    if (net > S.peak) {
      S.peak = net;
      // remember the make-up of the worst moment: the advisor reasons from it
      S.peakFree = S.cars.reduce((s, c) => s + (c.power > 0 && !c.enrolled ? c.power : 0), 0);
      S.peakHouse = house;
    }
    if (net > LIMIT) S.overMin += CFG.stepMin;

    draw(house, carLoad, net, queue);
    if (S.hour >= CFG.endHour) finish();
  }

  /* --------------------------------------------------------------- draw */
  function draw(house, carLoad, net, queue) {
    const pct = (net / LIMIT) * 100;
    const toTrack = (kw) => (kw / LIMIT) * 68;   // the limit mark sits at 68% of the track

    const hw = Math.max(0, Math.min(100, toTrack(house)));
    el('segHomes').style.width = hw + '%';
    el('segCars').style.width = Math.max(0, Math.min(100 - hw, toTrack(carLoad))) + '%';

    el('nowKW').textContent = Math.round(net);
    el('clock').textContent = hhmm(S.hour);
    el('fHomes').textContent = Math.round(house) + ' kW';
    el('fCars').textContent = Math.round(carLoad) + ' kW';
    el('fHead').textContent = Math.round(LIMIT - net) + ' kW';
    el('fPct').textContent = Math.round(pct) + '%';

    const over = net > LIMIT;
    document.querySelector('.track').classList.toggle('over', over);
    el('alarm').classList.toggle('show', over);
    el('nowKW').style.color = over ? 'var(--bad)' : pct > 85 ? 'var(--warn)' : 'var(--ink)';

    const st = el('state');
    if (S.hour <= CFG.startHour + 0.05) { st.textContent = 'waiting'; st.className = 'state'; }
    else if (over) { st.textContent = 'over the limit'; st.className = 'state bad'; }
    else if (pct > 85) { st.textContent = 'getting tight'; st.className = 'state warn'; }
    else { st.textContent = 'within limits'; st.className = 'state ok'; }

    // charge points
    const tiles = el('points').children;
    for (let i = 0; i < tiles.length; i++) {
      const car = S.cars.find((c) => c.home === i);
      const tile = tiles[i];
      const kw = tile.querySelector('.kw'), lvl = tile.querySelector('.lvl i');
      if (!car) { tile.className = 'pt off'; kw.textContent = '—'; lvl.style.width = '0%'; continue; }
      const home = S.hour >= car.arrive && S.hour < car.depart;
      let cls = 'pt';
      if (!home) cls += ' off';
      else if (car.power >= CFG.chargerKW - 0.15) cls += ' fast';
      else if (car.power > 0) cls += ' held';
      else if (car.ready) cls += ' full';
      else cls += ' off';
      tile.className = cls;
      kw.textContent = !home ? '—' : car.power > 0 ? car.power.toFixed(1) : car.ready ? 'full' : '0.0';
      lvl.style.width = Math.round(car.soc * 100) + '%';
    }

    drawController(house, net, queue);
    drawChain(house, net, queue);
    score();
  }

  /* The chain makes the link explicit: the controller measures at the
     transformer but acts at the charge points, one current limit each. */
  function drawChain(house, net, queue) {
    const smart = S.mode === 'smart';
    const amps = (kw) => Math.round((kw * 1000) / 230);   // 230 V single phase
    const started = S.hour > CFG.startHour + 0.05;

    el('chain').classList.toggle('live', smart && started);

    el('n1').textContent = started
      ? `${Math.round(net)} kW of ${CFG.txRating} kW`
      : `${CFG.txRating} kW transformer`;

    const free = Math.max(0, LIMIT - house);
    el('n2').textContent = !started ? 'idle'
      : smart ? `${Math.round(free)} kW to give out`
      : 'not in the loop';

    const live = queue.filter((q) => q.c.power > 0).map((q) => q.c.power);
    if (!started || !queue.length) el('n3').textContent = 'nothing plugged in';
    else if (!smart) el('n3').textContent = `${queue.length} points, all at ${amps(CFG.chargerKW)} A`;
    else if (!live.length) el('n3').textContent = `${queue.length} points held at 0 A`;
    else {
      const lo = amps(Math.min(...live));
      const hi = amps(Math.max(...live));
      el('n3').textContent = lo === hi
        ? `${queue.length} points set to ${hi} A`
        : `${queue.length} points set, ${lo}–${hi} A`;
    }

    const paused = queue.length - live.length;
    el('n4').textContent = !started ? 'cars arrive from 16:00'
      : !queue.length ? 'none charging'
      : paused > 0 ? `${live.length} drawing, ${paused} waiting`
      : `${live.length} drawing their limit`;
  }

  function drawController(house, net, queue) {
    const smart = S.mode === 'smart';
    el('ctl').classList.toggle('idle', !smart);
    el('ctlHint').innerHTML = smart ? 'live, every minute' : 'switch to <b>Our controller</b>';

    el('s1').textContent = `reading ${Math.round(net)} kW on a ${CFG.txRating} kW transformer`;
    el('s2').textContent = smart
      ? `${Math.round(LIMIT)} kW limit − ${Math.round(house)} kW homes = ${Math.round(Math.max(0, LIMIT - house))} kW to share`
      : `${Math.round(LIMIT)} kW limit, not being enforced`;
    el('s3').textContent = queue.length ? `${queue.length} cars plugged in and still charging` : 'no cars charging yet';
    // the pilot can only express 6 A to 80 A, so a car that cannot be given 6 A is paused
    const held = queue.filter((q) => q.c.power > 0 && q.c.power < CFG.chargerKW - 0.15).length;
    const paused = queue.filter((q) => q.c.power === 0).length;
    el('s4').textContent = smart
      ? `${held} eased back, ${paused} paused — the pilot can only ask for 6 A to 32 A, never less`
      : 'every charger free to take the full 32 A (7.4 kW)';

    const body = el('queue');
    if (!smart || !queue.length) {
      body.innerHTML = `<tr class="empty"><td colspan="6">${smart ? 'no cars charging' : 'not managing — every car takes what it wants'}</td></tr>`;
      return;
    }
    body.innerHTML = queue.slice(0, 8).map((q) => {
      if (q.free) {
        return `<tr class="freerow">
          <td>#${q.c.id}</td>
          <td>${Math.round(q.c.soc * 100)}%</td>
          <td>${hhmm(q.c.depart)}</td>
          <td>${Math.round(q.need)} kWh</td>
          <td><span class="nocontrol">not enrolled</span></td>
          <td>${q.c.power.toFixed(1)} kW</td>
        </tr>`;
      }
      // four pips, filled as slack runs out
      const pips = q.laxity > 6 ? 1 : q.laxity > 3 ? 2 : q.laxity > 1 ? 3 : 4;
      const hot = pips === 4 ? ' hot' : '';
      const bars = [0, 1, 2, 3].map((i) => `<i class="${i < pips ? 'on' : ''}"></i>`).join('');
      return `<tr>
        <td>#${q.c.id}</td>
        <td>${Math.round(q.c.soc * 100)}%</td>
        <td>${hhmm(q.c.depart)}</td>
        <td>${Math.round(q.need)} kWh</td>
        <td><span class="urg${hot}">${bars}</span></td>
        <td>${q.c.power > 0 ? q.c.power.toFixed(1) + ' kW' : 'waiting'}</td>
      </tr>`;
    }).join('');
  }

  function score() {
    const peakPct = Math.round((S.peak / LIMIT) * 100);
    const ready = S.cars.filter((c) => c.ready).length;
    el('sPeak').textContent = S.peak ? peakPct + '%' : '—';
    el('sOver').textContent = S.hour > CFG.startHour ? (S.overMin ? S.overMin + ' min' : 'none') : '—';
    el('sReady').textContent = S.cars.length ? ready + ' of ' + S.cars.length : '—';
    el('sPeak').parentElement.className = 'score' + (S.peak ? (peakPct > 100 ? ' bad' : ' good') : '');
    el('sOver').parentElement.className = 'score' + (S.hour > CFG.startHour ? (S.overMin ? ' bad' : ' good') : '');
  }

  /* --------------------------------------------------------------- flow */
  let timer = null;
  function reset() {
    S.hour = CFG.startHour; S.cars = buildCars(); S.peak = 0; S.overMin = 0;
    S.peakFree = 0; S.peakHouse = 0; S.freeKW = 0;
    // Enrolment is assigned deterministically by position, not drawn from the
    // RNG, so the random sequence stays identical to paper/model.js.
    const share = window.Advisor ? Advisor.policy().enrolled : 1;
    const nEnrol = Math.round(S.cars.length * share);
    S.cars.forEach((c, i) => { c.enrolled = i < nEnrol; });
    const perHomePeak = (CFG.txRating * 0.5) / CFG.homes;
    const h0 = CFG.homes * houseLoad(CFG.startHour) * perHomePeak;
    draw(h0, 0, h0, []);
    el('alarm').classList.remove('show');
  }
  function play() {
    if (S.running) return stop();
    if (S.hour >= CFG.endHour) reset();
    S.running = true;
    el('play').textContent = '❚❚ Pause';
    el('play').classList.add('running');
    timer = setInterval(step, 38);
  }
  function stop() {
    S.running = false; clearInterval(timer);
    el('play').textContent = S.hour >= CFG.endHour ? '▶ Run it again' : '▶ Continue';
    el('play').classList.remove('running');
  }
  function finish() {
    stop();
    S.results[S.mode] = {
      peak: Math.round((S.peak / LIMIT) * 100),
      over: S.overMin,
      ready: S.cars.filter((c) => c.ready).length,
      total: S.cars.length,
    };
    // Hand the evening to the advisory layer. It only ever sees finished
    // evenings — it is not in the control path.
    if (window.Advisor && S.mode === 'smart') {
      Advisor.recordEvening({
        mode: S.mode,
        peakKW: S.peak,
        peakPct: Math.round((S.peak / LIMIT) * 100),
        overMin: S.overMin,
        ready: S.cars.filter((c) => c.ready).length,
        total: S.cars.length,
        totalCars: S.cars.length,
        managedCars: S.cars.filter((c) => c.enrolled).length,
        unmanagedAtPeak: S.peakFree,
        houseAtPeak: S.peakHouse,
      });
    }
    showCompare();
  }
  function showCompare() {
    const a = S.results.none, b = S.results.smart;
    if (!a || !b) return;
    el('compare').hidden = false;
    el('cPeakA').textContent = a.peak + '%'; el('cPeakB').textContent = b.peak + '%';
    el('cOverA').textContent = a.over ? a.over + ' min' : 'none';
    el('cOverB').textContent = b.over ? b.over + ' min' : 'none';
    el('cReadyA').textContent = a.ready + ' of ' + a.total;
    el('cReadyB').textContent = b.ready + ' of ' + b.total;
    const round = (x) => Math.round(x / 5) * 5;
    el('takeaway').textContent =
      'Same cars, same energy, same night — the only thing that changed is when the power was drawn. Left alone the ' +
      `street pushes the transformer well past its limit (around ${round(a.peak)}% here) for a few hours. Sharing the ` +
      'capacity keeps it under the limit, and the cars still leave charged. The exact figures follow from this ' +
      'model’s assumptions; the pattern is the point.';
  }

  /* --------------------------------------------------------------- init */
  (function build() {
    el('limitKW').textContent = Math.round(LIMIT) + ' kW';
    const wrap = el('points');
    wrap.innerHTML = '';
    for (let i = 0; i < CFG.homes; i++) {
      const d = document.createElement('div');
      d.className = 'pt off';
      d.innerHTML = `<div class="id">No. ${i + 1}</div><div class="kw">—</div><div class="lvl"><i></i></div>`;
      wrap.appendChild(d);
    }
  })();
  if (window.Advisor) Advisor.init(CFG, LIMIT);
  reset();

  el('play').addEventListener('click', play);
  document.querySelectorAll('.mode[data-mode]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.mode[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    S.mode = b.dataset.mode;
    stop(); reset(); showCompare();
  }));
})();
