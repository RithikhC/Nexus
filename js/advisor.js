/* The advisory layer: AI proposes, a human operator decides.
 *
 * This sits ABOVE the protection loop in js/sim.js and runs on a completely
 * different timescale. The protection loop acts every minute and never waits
 * for anyone — a transformer cannot be left overloaded while an operator is
 * away from the desk. This layer never touches a charger directly. It watches
 * what happened across whole evenings, and when a pattern emerges it puts
 * ranked options in front of a human, with its reasoning and a projection it
 * can later be judged against. Nothing it proposes takes effect until someone
 * presses Approve.
 *
 * It is deliberately a transparent recommender rather than a black box: every
 * number on screen is traceable to a recorded observation, which is what a
 * network operator needs in order to sign off a decision about an asset.
 * It learns in one specific, checkable way — it compares each projection with
 * what actually happened and corrects its future projections by the error.
 */
window.Advisor = (function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const pct = (x) => Math.round(x * 100);
  const clampNum = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

  let CFG = null, LIMIT = 0, RATING = 0;

  const A = {
    history: [],        // one record per completed evening
    decisions: [],      // what the operator approved or rejected, and the outcome
    pending: null,      // options currently awaiting a decision
    policy: null,       // what the protection loop is currently told to hold
    calib: { n: 0, sum: 0 },   // projection error, used to correct later projections
  };

  /* ---------------------------------------------------------- the policy */
  function defaultPolicy() {
    return {
      cap: CFG.safeLimit,   // fraction of nameplate the controller holds to
      enrolled: 0.7,        // share of chargers signed up to be controlled
      assetAction: null,    // inspection / reinforcement logged against the unit
    };
  }

  /* --------------------------------------------------------- the factors */
  /* Everything the advisor reasons from, derived only from recorded evenings. */
  function factors() {
    const h = A.history;
    const seen = h.length;
    const breached = h.filter((e) => e.overMin > 0).length;
    const worst = seen ? Math.max(...h.map((e) => e.peakPct)) : 0;
    const lastOver = seen ? h[seen - 1].overMin : 0;
    const unready = seen ? h[seen - 1].total - h[seen - 1].ready : 0;

    // is it getting worse? compare the latest evening with the one before
    let trend = 'flat';
    if (seen >= 2) {
      const d = h[seen - 1].peakPct - h[seen - 2].peakPct;
      trend = d > 2 ? 'rising' : d < -2 ? 'falling' : 'flat';
    }
    return { seen, breached, worst, lastOver, unready, trend, last: h[seen - 1] || null };
  }

  /* Confidence is the one thing that should grow with evidence and shrink when
     the advisor has been wrong before. Stated, not hidden. */
  function confidence() {
    const f = factors();
    const fromEvidence = Math.min(0.55 + 0.12 * f.seen, 0.9);
    const err = A.calib.n ? Math.abs(ratio() - 1) : 0;
    return Math.max(0.35, fromEvidence - err);
  }

  /* What the advisor has learned about its own projections.
     ratio = actual peak / projected peak, averaged over past calls.
       ratio > 1  the advisor was optimistic: the real peak came in higher than
                  it said, so it should claim LESS improvement next time.
       ratio < 1  it was pessimistic, and can claim more.
     Projections are expressed as a gain subtracted from the observed peak, so
     the gain is scaled by 1/ratio to move in the right direction. */
  function ratio() {
    return A.calib.n ? A.calib.sum / A.calib.n : 1;
  }
  function gainScale() {
    const r = ratio();
    return clampNum(1 / (r || 1), 0.5, 2);
  }

  /* --------------------------------------------------------- the options */
  function buildOptions() {
    const f = factors();
    if (!f.last) return null;
    const e = f.last;

    // only raise something when there is something to raise
    if (e.overMin === 0 && e.peakPct < 96) return null;

    const g = gainScale();
    const overshoot = Math.max(0, e.peakKW - LIMIT);
    const opts = [];

    /* 1. Enrol the chargers that are not under control. The cheapest real fix
          when the breach is being driven by load the controller cannot touch. */
    const freeCars = e.totalCars - e.managedCars;
    if (freeCars > 0 && e.unmanagedAtPeak > 0.5) {
      // if the uncontrolled draw at the peak exceeds the overshoot, the
      // controller could have absorbed all of it; otherwise it absorbs that much
      // Enrolment does not remove this demand, it makes it schedulable. What
      // changes is that the cap becomes enforceable rather than aspirational,
      // so the honest projection is the cap itself — the outcome will usually
      // land under it, and the decision log will show by how much.
      const projKW = RATING * A.policy.cap;
      opts.push({
        id: 'enrol',
        gain: e.unmanagedAtPeak,
        title: `Enrol the ${freeCars} charge point${freeCars > 1 ? 's' : ''} not yet under control`,
        why: `${freeCars} of ${e.totalCars} cars charged outside the scheme, drawing `
             + `${e.unmanagedAtPeak.toFixed(1)} kW at the worst moment. The controller cannot hold a limit it `
             + `is not allowed to act on.`,
        projKW,
        projLabel: `at or under the ${pct(A.policy.cap)}% cap — guaranteed, not estimated`,
        cost: 'No capital cost. Needs customer consent, so days not minutes.',
        risk: 'Customers may decline; enrolment is voluntary.',
      });
    }

    /* 2. Hold a tighter cap tonight. Costs nothing and works immediately, but
          buys margin by making some cars finish later. */
    if (A.policy.cap > 0.88) {
      const newCap = 0.90;
      // a tighter cap can only pull back the part of the load the controller
      // actually commands; the uncontrolled draw is untouched by it
      const reachable = Math.max(0, e.peakKW - (RATING * newCap + e.unmanagedAtPeak));
      const projKW = e.peakKW - reachable * g;
      opts.push({
        id: 'cap90',
        title: `Hold the managed cap at ${pct(newCap)}% of nameplate through the evening`,
        why: `Worst load seen was ${e.peakPct}% of the safe limit. A tighter cap buys margin now, while a `
             + `longer-term fix is arranged.`,
        projKW,
        projLabel: `peak ${Math.round((projKW / LIMIT) * 100)}% of the safe limit`,
        cost: 'Free, immediate and reversible.',
        risk: 'Some cars finish later; a few may not reach their target by morning.',
      });
    }

    /* Say so when an option cannot achieve much, and why. An option that looks
       reasonable but is blocked by something else is the most useful thing the
       advisor can point out, provided it says it plainly. */
    for (const o of opts) {
      if (o.projKW === null) continue;
      if (o.gain === undefined) o.gain = Math.max(0, e.peakKW - o.projKW);
      if (o.gain < RATING * 0.015 && freeCars > 0 && o.id !== 'enrol') {
        o.why += ` Note: limited effect while ${freeCars} charge point${freeCars > 1 ? 's' : ''} ` +
                 `remain outside the scheme — their uncontrolled draw alone was ` +
                 `${e.unmanagedAtPeak.toFixed(1)} kW, which no cap can reach.`;
        o.weak = true;
      }
    }
    // rank by how much each is actually projected to achieve
    opts.sort((a, b) => (b.gain || 0) - (a.gain || 0));

    /* 3. The real fix, and honest about not helping tonight. */
    if (!A.policy.assetAction) {
      opts.push({
        id: 'asset',
        gain: 0,
        title: 'Log the unit for thermal inspection and a reinforcement study',
        why: (f.breached
                ? `${f.breached} of ${f.seen} run${f.seen > 1 ? 's' : ''} went over the limit. `
                : `Nothing has tripped yet, but the worst load was ${f.worst}% of the limit. `) +
             `Sustained loading consumes insulation life whether or not anything trips, and that loss is `
             + `invisible from the load trace.`,
        projKW: null,
        projLabel: 'no effect tonight',
        cost: 'Capital expenditure, and weeks of lead time.',
        risk: 'Does nothing for the current evening; the other options still apply meanwhile.',
      });
    }

    return opts.length ? opts : null;
  }

  /* ------------------------------------------------------- apply/dismiss */
  /* The operator picks ONE course of action. This mirrors how restoration
     functions are already commissioned in utility ADMS platforms: the system
     recommends, the operator chooses, and only then does anything happen. */
  function apply(id) {
    const opt = (A.pending || []).find((o) => o.id === id);
    if (!opt) return;
    if (id === 'enrol') A.policy.enrolled = 1;
    if (id === 'cap90') A.policy.cap = 0.90;
    if (id === 'asset') A.policy.assetAction = 'inspection and reinforcement study logged';
    // the options the operator passed over are recorded too: a decision is also
    // a record of what was not done, and why it was available
    for (const title of A.declined || []) {
      A.decisions.push({ n: A.history.length, at: A.history.length, title, verdict: 'declined' });
    }
    A.declined = [];
    for (const o of A.pending) {
      if (o.id === id) continue;
      A.decisions.push({ n: A.history.length, at: A.history.length, title: o.title, verdict: 'not-taken' });
    }
    A.decisions.push({
      n: A.history.length, at: A.history.length, title: opt.title,
      verdict: 'applied', projKW: opt.projKW, projLabel: opt.projLabel, actualKW: null,
    });
    A.pending = null;
    render();
  }

  /* Declining the leading option does not end the conversation: the next best
     is promoted and put forward instead, which is how GE Vernova's D400-DA
     behaves in Operator Assisted Mode. */
  function decline(id) {
    if (!A.pending) return;
    const opt = A.pending.find((o) => o.id === id);
    if (!opt) return;
    A.declined = (A.declined || []).concat(opt.title);
    A.pending = A.pending.filter((o) => o.id !== id);
    if (!A.pending.length) {
      for (const title of A.declined) {
        A.decisions.push({ n: A.history.length, at: A.history.length, title, verdict: 'declined' });
      }
      A.declined = [];
      A.pending = null;
    }
    render();
  }

  /* --------------------------------------------------------- the record */
  function recordEvening(rec) {
    A.history.push(rec);

    // score any projection that was approved before this evening, and learn
    for (const d of A.decisions) {
      if (d.verdict === 'applied' && d.actualKW === null && d.projKW && d.at < A.history.length) {
        d.actualKW = rec.peakKW;
        A.calib.n += 1;
        A.calib.sum += rec.peakKW / d.projKW;   // >1 means we were optimistic
      }
    }
    A.pending = buildOptions();
    render();
  }

  /* ------------------------------------------------------------ the view */
  function render() {
    const f = factors();
    const host = el('advisor');
    if (!host) return;

    el('advState').textContent = A.pending
      ? 'awaiting your decision'
      : f.seen === 0 ? 'watching' : 'no action needed';
    el('advState').className = 'state' + (A.pending ? ' warn' : f.seen ? ' ok' : '');

    // the options, or why there are none
    const box = el('advOpts');
    if (!A.pending) {
      box.innerHTML = f.seen
        ? `<p class="advnone">Nothing to escalate. The protection loop held the limit on its own.</p>`
        : `<p class="advnone">Run an evening. The advisor needs something to look at before it
             can recommend anything.</p>`;
    } else {
      const c = Math.round(confidence() * 100);
      const k = gainScale();
      box.innerHTML =
        `<div class="advhead"><b>${A.pending.length}</b> course${A.pending.length > 1 ? 's' : ''} of action, ranked.
           Confidence <b>${c}%</b> from ${f.seen} evening${f.seen > 1 ? 's' : ''} of data${
             A.calib.n ? `, projections corrected by ×${k.toFixed(2)} from ${A.calib.n} past call${A.calib.n > 1 ? 's' : ''}` : ''
           }. <b>Choose one.</b> Decline the leading option and the next is put forward instead.</div>` +
        A.pending.map((o, i) => `
          <div class="advopt${i === 0 ? ' lead' : ''}">
            <div class="rank">${i + 1}</div>
            <div class="body">
              <b>${o.title}${i === 0 ? ' <span class="rec">recommended</span>' : ''}</b>
              <p class="why">${o.why}</p>
              <div class="meta">
                <span class="proj${o.weak ? ' weak' : ''}">Projected: ${o.projLabel}</span>
                <span>${o.cost}</span>
                <span class="risk">${o.risk}</span>
              </div>
              <div class="acts">
                <button class="ok" data-apply="${o.id}">Apply this one</button>
                <button class="no" data-decline="${o.id}">Decline</button>
              </div>
            </div>
          </div>`).join('');
    }

    // the decision log, including how the projections actually turned out
    const log = el('advLog');
    if (!A.decisions.length) { log.innerHTML = ''; log.hidden = true; return; }
    log.hidden = false;
    log.innerHTML = '<h3>Decision log</h3>' + A.decisions.map((d) => {
      let outcome = '';
      if (d.verdict === 'applied' && d.projKW) {
        const pp = Math.round((d.projKW / LIMIT) * 100);
        if (d.actualKW === null) {
          outcome = ` <i>projected ${pp}%, awaiting the next evening</i>`;
        } else {
          const ap = Math.round((d.actualKW / LIMIT) * 100);
          const verdict = ap < pp - 1 ? 'better than projected' : ap > pp + 1 ? 'worse than projected' : 'as projected';
          outcome = ` <i>projected ${pp}%, actual ${ap}% — ${verdict}</i>`;
        }
      }
      return `<div class="dl ${d.verdict}">
        <span class="v">${d.verdict.replace('-', ' ')}</span>
        <span>after evening ${d.n} — ${d.title}${outcome}</span>
      </div>`;
    }).join('');
  }

  /* -------------------------------------------------------------- wiring */
  function init(cfg, limit) {
    CFG = cfg; LIMIT = limit; RATING = cfg.txRating;
    A.policy = defaultPolicy();
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-apply]');
      const r = ev.target.closest('[data-decline]');
      if (a) apply(a.dataset.apply);
      if (r) decline(r.dataset.decline);
    });
    render();
  }

  return {
    init,
    recordEvening,
    policy: () => A.policy,
    reset() { A.history = []; A.decisions = []; A.pending = null; A.declined = []; A.policy = defaultPolicy(); A.calib = { n: 0, sum: 0 }; render(); },
    render,
  };
})();
