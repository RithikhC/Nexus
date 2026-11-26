/* node figures.js — conceptual figures for the paper.
 *
 * These are schematics of the mechanism and the proposed architecture, not
 * results: the paper makes its case from published sources and from the
 * regulatory framework, and the interactive model lives in the repository.
 *
 * Needs: npm i sharp
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, 'figs');
fs.mkdirSync(OUT, { recursive: true });

const FONT = 'font-family="Times New Roman, Times, serif"';
const INK = '#000', MUTED = '#4a4a4a', GRID = '#d0d0d0';
const RED = '#b01a12', GREEN = '#1b7a4b', BLUE = '#2e6ea6', AMBER = '#b8860b', GREY = '#7f8c99';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function png(name, svg, inchesWide) {
  const f = path.join(OUT, name);
  await sharp(Buffer.from(svg)).resize({ width: Math.round(inchesWide * 300) }).png().toFile(f);
  const m = await sharp(f).metadata();
  console.log(`  ${name}  ${m.width}x${m.height}`);
}

/* ------------- Fig 1: why the evening is the problem (schematic) ------- */
function mechanism() {
  const w = 1500, h = 620;
  const m = { l: 120, r: 40, t: 96, b: 90 };
  const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const TOP = 1.55;                              // the axis reaches 1.55x the limit so the overload fits
  const X = (u) => m.l + u * pw;                 // u in 0..1 across the evening/night
  const Y = (v) => m.t + (1 - v / TOP) * ph;     // v as a multiple of the safe limit

  // a typical residential evening: rises to a peak around early evening, falls overnight
  const houseAt = (u) => 0.30 + 0.32 * Math.exp(-Math.pow((u - 0.17) / 0.17, 2));
  // charging switched on as people arrive, then held until batteries fill
  const carAt = (u) => (u < 0.05 ? 0 : 0.78 * Math.exp(-Math.pow((u - 0.20) / 0.20, 2)));

  const pts = (f) => {
    let d = '';
    for (let i = 0; i <= 200; i++) { const u = i / 200; d += (i ? 'L' : 'M') + X(u).toFixed(1) + ' ' + Y(f(u)).toFixed(1); }
    return d;
  };
  const both = (u) => houseAt(u) + carAt(u);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${FONT}><rect width="${w}" height="${h}" fill="#fff"/>`;
  s += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${INK}" stroke-width="2"/>`;
  s += `<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${Y(0)}" stroke="${INK}" stroke-width="2"/>`;

  // the transformer's safe limit
  s += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(1)}" y2="${Y(1)}" stroke="${RED}" stroke-width="3.6" stroke-dasharray="16 9"/>`;
  s += `<text x="${w - m.r - 8}" y="${Y(1) - 14}" font-size="26" font-weight="bold" fill="${RED}" text-anchor="end">transformer’s safe limit</text>`;

  s += `<path d="${pts(both)} L${X(1)} ${Y(0)} L${X(0)} ${Y(0)} Z" fill="${RED}" opacity="0.10"/>`;
  s += `<path d="${pts(houseAt)}" fill="none" stroke="${GREY}" stroke-width="4" stroke-dasharray="13 8"/>`;
  s += `<path d="${pts(both)}" fill="none" stroke="${RED}" stroke-width="5"/>`;

  // the overload window
  const over = [];
  for (let i = 0; i <= 200; i++) { const u = i / 200; if (both(u) > 1) over.push(u); }
  if (over.length) {
    s += `<rect x="${X(over[0])}" y="${m.t}" width="${X(over[over.length - 1]) - X(over[0])}" height="${ph}" fill="${RED}" opacity="0.07"/>`;
    s += `<text x="${X((over[0] + over[over.length - 1]) / 2)}" y="${m.t - 16}" font-size="25" font-weight="bold" fill="${RED}" text-anchor="middle">hours spent over the limit</text>`;
  }

  s += `<text x="${X(0.02)}" y="${Y(0) + 38}" font-size="25" fill="${INK}">people arrive home</text>`;
  s += `<text x="${X(0.97)}" y="${Y(0) + 38}" font-size="25" fill="${INK}" text-anchor="end">they leave again</text>`;
  s += `<text x="${m.l + pw / 2}" y="${h - 18}" font-size="27" fill="${INK}" text-anchor="middle">evening → overnight → morning</text>`;
  s += `<text transform="translate(38 ${m.t + ph / 2}) rotate(-90)" font-size="27" fill="${INK}" text-anchor="middle">load on the street’s transformer</text>`;

  // legend
  s += `<line x1="${m.l}" x2="${m.l + 38}" y1="34" y2="34" stroke="${GREY}" stroke-width="4" stroke-dasharray="13 8"/>`;
  s += `<text x="${m.l + 48}" y="43" font-size="26" fill="${INK}">homes only</text>`;
  s += `<line x1="${m.l + 300}" x2="${m.l + 338}" y1="34" y2="34" stroke="${RED}" stroke-width="5"/>`;
  s += `<text x="${m.l + 348}" y="43" font-size="26" fill="${INK}">homes and cars charging together</text>`;

  return s + '</svg>';
}

/* ------------- Fig 2: static vs dynamic connection limit --------------- */
function framework() {
  const w = 1480, h = 560;
  let b = '';
  const txt = (x, y, t, o = {}) =>
    (b += `<text x="${x}" y="${y}" font-size="${o.size || 26}" font-weight="${o.weight || 400}" fill="${o.fill || INK}" text-anchor="${o.anchor || 'start'}">${esc(t)}</text>`);
  const panel = (x, title, sub) => {
    b += `<rect x="${x}" y="70" width="640" height="430" rx="12" fill="#fafafa" stroke="#bbb" stroke-width="2.5"/>`;
    txt(x + 320, 46, title, { size: 30, weight: 700, anchor: 'middle' });
    txt(x + 320, 532, sub, { size: 23, fill: MUTED, anchor: 'middle' });
  };
  const y = 120;

  panel(20, 'Today: a static limit', 'decided once, against a worst case that rarely occurs');
  b += `<rect x="60" y="${y}" width="560" height="150" rx="8" fill="#eef1f4" stroke="#9aa5b0" stroke-width="2"/>`;
  txt(340, y + 52, 'Could the network supply every', { size: 26, anchor: 'middle' });
  txt(340, y + 86, 'charger at full power at once?', { size: 26, anchor: 'middle' });
  txt(340, y + 126, 'assessed before connection, then fixed', { size: 22, fill: MUTED, anchor: 'middle' });
  b += `<path d="M200 ${y + 160} V ${y + 198}" stroke="${INK}" stroke-width="3.5" marker-end="url(#a)"/>`;
  b += `<path d="M480 ${y + 160} V ${y + 198}" stroke="${INK}" stroke-width="3.5" marker-end="url(#a)"/>`;
  b += `<rect x="70" y="${y + 200}" width="260" height="112" rx="8" fill="#e9f4ee" stroke="${GREEN}" stroke-width="2.5"/>`;
  txt(200, y + 246, 'Yes — approved', { size: 25, weight: 700, anchor: 'middle' });
  txt(200, y + 282, 'spare capacity unused', { size: 22, fill: MUTED, anchor: 'middle' });
  b += `<rect x="350" y="${y + 200}" width="260" height="112" rx="8" fill="#fbeceb" stroke="${RED}" stroke-width="2.5"/>`;
  txt(480, y + 246, 'No — refused', { size: 25, weight: 700, anchor: 'middle' });
  txt(480, y + 282, 'reinforce, or wait', { size: 22, fill: MUTED, anchor: 'middle' });

  panel(820, 'Proposed: a dynamic limit', 'measured continuously, so real spare capacity is used');
  b += `<rect x="860" y="${y}" width="560" height="150" rx="8" fill="#eef4fa" stroke="${BLUE}" stroke-width="2"/>`;
  txt(1140, y + 52, 'How much headroom is free', { size: 26, anchor: 'middle' });
  txt(1140, y + 86, 'at this moment?', { size: 26, anchor: 'middle' });
  txt(1140, y + 126, 'measured at the transformer', { size: 22, fill: MUTED, anchor: 'middle' });
  b += `<path d="M1140 ${y + 160} V ${y + 198}" stroke="${INK}" stroke-width="3.5" marker-end="url(#a)"/>`;
  b += `<rect x="900" y="${y + 200}" width="480" height="112" rx="8" fill="#e9f4ee" stroke="${GREEN}" stroke-width="2.5"/>`;
  txt(1140, y + 246, 'Connect, and manage', { size: 25, weight: 700, anchor: 'middle' });
  txt(1140, y + 282, 'chargers share what is free, most urgent first', { size: 22, fill: MUTED, anchor: 'middle' });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${FONT}>
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>
<rect width="${w}" height="${h}" fill="#fff"/>${b}</svg>`;
}

/* ------------- Fig 3: the controller ----------------------------------- */
function architecture() {
  const w = 1500, h = 700;
  let b = '';
  const txt = (x, y, t, o = {}) =>
    (b += `<text x="${x}" y="${y}" font-size="${o.size || 25}" font-weight="${o.weight || 400}" fill="${o.fill || INK}" text-anchor="${o.anchor || 'middle'}">${esc(t)}</text>`);
  const box = (x, y, bw, bh, fill, stroke, title, subs) => {
    b += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
    const top = y + bh / 2 - (subs.length * 29) / 2 + 9;
    txt(x + bw / 2, top, title, { size: 27, weight: 700 });
    subs.forEach((l, i) => txt(x + bw / 2, top + 29 * (i + 1), l, { size: 23, fill: MUTED }));
  };
  const arr = (d, col) => (b += `<path d="${d}" fill="none" stroke="${col || INK}" stroke-width="3.6" marker-end="url(#a)"/>`);

  box(40, 300, 290, 120, '#eef1f4', '#8f9aa5', 'Transformer', ['measured loading,', 'once a minute']);
  arr('M330 360 H 392');
  box(400, 285, 300, 150, '#eef4fa', BLUE, 'Available headroom', ['safe limit minus', 'everything else drawing', 'plus solar and storage']);
  arr('M700 360 H 762');
  box(770, 285, 300, 150, '#fdf5e6', AMBER, 'Priority queue', ['vehicles ranked by', 'how little slack they', 'have before departure']);
  arr('M1070 360 H 1132');
  box(1140, 300, 320, 120, '#e9f4ee', GREEN, 'Charge points', ['current limit set on', 'the IEC 61851 pilot']);

  // solar input
  box(400, 70, 300, 120, '#fffaf0', AMBER, '☀ Solar canopy', ['PV with battery,', 'charged by day']);
  arr('M550 190 V 278', AMBER);

  // driver inputs
  box(770, 70, 300, 120, '#f7f7f7', '#9a9a9a', 'Each vehicle', ['charge level, energy', 'needed, departure time']);
  arr('M920 190 V 278');

  // feedback
  b += `<path d="M1300 420 V 540 H 185 V 426" fill="none" stroke="${INK}" stroke-width="3.2" stroke-dasharray="11 7" marker-end="url(#a)"/>`;
  txt(742, 572, 'the change in load is measured, and the loop repeats', { size: 24, fill: MUTED });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${FONT}>
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>
<rect width="${w}" height="${h}" fill="#fff"/>${b}</svg>`;
}

(async () => {
  console.log('figures:');
  await png('fig1-mechanism.png', mechanism(), 6.8);
  await png('fig2-framework.png', framework(), 6.8);
  await png('fig3-architecture.png', architecture(), 6.8);
})();
