/* Builds the NEXUS 3.0 presentation.
 *   node build.js
 * Eight minutes, ten slides. Structured: one theme, five layouts, sections.
 */
const path = require('path');
const pptxgen = require('pptxgenjs');
const { applyTheme } = require(path.join(
  'C:/Users/Rajesh/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/local-agent-mode-sessions/skills-plugin',
  '3817d13e-523f-4956-91c6-644df67e4eed/93f51678-0fe8-453c-a805-a3a07e7aa74a/skills/pptx/scripts/apply_theme.js'
));

/* Heat and grid: deep slate carries the deck, terracotta is the sharp accent
   (the climate argument), teal supports and matches the figures. */
const THEME = {
  name: 'Nexus EV',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '1A2430',  // slate, body text
    lt1: 'FFFFFF',
    dk2: '55657A',  // muted text
    lt2: 'F2F5F8',  // card fill
    accent1: 'C2561E',  // terracotta
    accent2: '14708F',  // teal
    accent3: 'D9A441',  // amber
    accent4: '2E7D52',  // green
    accent5: '8C3B2E',
    accent6: '3E5266',
    hlink: '14708F',
    folHlink: '55657A',
  },
};

const FIGS = path.join(__dirname, '..', 'paper', 'figs');
const ASSETS = path.join(__dirname, 'assets');

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';          // 10" x 5.625"
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.author = 'Rithikh Chandran; Chrislyn Ann Ginu; Gollapalli Darshitha';
pres.title = 'Intelligent EV Charging Management to Prevent Power Overloads';

const C = pres.SchemeColor;
const W = 10, H = 5.625, M = 0.55;

/* ------------------------------------------------------------- layouts */
pres.defineSlideMaster({
  title: 'DARK',
  background: { color: THEME.colors.dk1 },
  objects: [
    { placeholder: { text: '', options: { name: 'title', type: 'title', x: M, y: 1.45, w: W - 2 * M, h: 1.45,
      fontSize: 38, bold: true, color: 'FFFFFF', align: 'left', valign: 'bottom' } } },
    { placeholder: { text: '', options: { name: 'body', type: 'body', x: M, y: 3.05, w: W - 2 * M, h: 1.8,
      fontSize: 15, color: 'C9D3DE', valign: 'top' } } },
  ],
});

pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.background1 },
  objects: [
    { placeholder: { text: '', options: { name: 'title', type: 'title', x: M, y: 0.34, w: W - 2 * M, h: 0.7,
      fontSize: 28, bold: true, color: C.text1, align: 'left', valign: 'middle' } } },
    { placeholder: { text: '', options: { name: 'body', type: 'body', x: M, y: 1.18, w: 4.25, h: 3.3,
      fontSize: 14, color: C.text2, valign: 'top' } } },
    { text: { text: 'NEXUS 3.0  ·  Amity University Dubai × IEEE', options: {
      x: M, y: H - 0.42, w: 5.5, h: 0.26, fontSize: 9, color: 'A7B2BF', isTextBox: true } } },
  ],
  slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.26, fontSize: 9, color: 'A7B2BF', align: 'right' },
});

pres.defineSlideMaster({
  title: 'WIDE',
  background: { color: C.background1 },
  objects: [
    { placeholder: { text: '', options: { name: 'title', type: 'title', x: M, y: 0.34, w: W - 2 * M, h: 0.7,
      fontSize: 28, bold: true, color: C.text1, align: 'left', valign: 'middle' } } },
    { text: { text: 'NEXUS 3.0  ·  Amity University Dubai × IEEE', options: {
      x: M, y: H - 0.42, w: 5.5, h: 0.26, fontSize: 9, color: 'A7B2BF', isTextBox: true } } },
  ],
  slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.26, fontSize: 9, color: 'A7B2BF', align: 'right' },
});

/* ------------------------------------------------------------ helpers */
// a numbered disc — the deck's one repeated motif
function disc(s, n, x, y, d = 0.38, fill = THEME.colors.accent2) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, objectName: `disc-${n}` });
  s.addText(String(n), { x, y, w: d, h: d, fontSize: 13, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}

function card(s, o) {
  s.addShape(pres.ShapeType.roundRect, {
    x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.06,
    fill: { color: o.fill || THEME.colors.lt2 },
    line: { color: o.line || 'E2E8EE', width: 1 },
    objectName: o.name,
  });
}

function stat(s, o) {
  card(s, { x: o.x, y: o.y, w: o.w, h: o.h, name: o.name });
  s.addText(o.big, { x: o.x + 0.18, y: o.y + 0.16, w: o.w - 0.36, h: 0.78,
    fontSize: o.bigSize || 40, bold: true, color: o.color || THEME.colors.accent1,
    align: 'left', valign: 'middle', margin: 0, isTextBox: true });
  s.addText(o.label, { x: o.x + 0.18, y: o.y + 0.95, w: o.w - 0.36, h: o.h - 1.08,
    fontSize: 12, color: C.text2, align: 'left', valign: 'top', margin: 0, isTextBox: true });
}

/* ================================================================ 1 */
pres.addSection({ title: 'Opening' });
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Opening' });
  s.addText('Intelligent EV Charging\nManagement', { placeholder: 'title' });
  s.addText([
    { text: 'Preventing distribution transformer overload without replacing the transformer',
      options: { fontSize: 16, color: 'E6ECF2', breakLine: true } },
    { text: ' ', options: { fontSize: 10, breakLine: true } },
    { text: 'Rithikh Chandran  ·  Chrislyn Ann Ginu  ·  Gollapalli Darshitha',
      options: { fontSize: 13, color: '9FB0C0', breakLine: true } },
    { text: 'NEXUS 3.0  ·  Amity University Dubai × IEEE Student Branch  ·  Track 01, SDG 9',
      options: { fontSize: 12, color: '7D8EA0' } },
  ], { placeholder: 'body' });
  s.addNotes('Eight minutes. The claim: the grid can host far more EV charging than it is credited with, '
    + 'if charging is coordinated. Nothing here needs a new standard or new hardware.');
}

/* ================================================================ 2 */
pres.addSection({ title: 'The problem' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'The problem' });
  s.addText('The grid is built on everyone being different', { placeholder: 'title' });
  s.addText([
    { text: 'A transformer is never sized to supply every home at once. It is sized on ',
      options: { fontSize: 14, breakLine: false } },
    { text: 'diversity', options: { fontSize: 14, bold: true, color: THEME.colors.accent2, breakLine: false } },
    { text: ' — households peak at different moments.', options: { fontSize: 14, breakLine: true } },
    { text: ' ', options: { fontSize: 9, breakLine: true } },
    { text: 'A home charger draws about as much as the rest of the house combined, and everyone plugs in '
          + 'when they get home.', options: { fontSize: 14, breakLine: true } },
    { text: ' ', options: { fontSize: 9, breakLine: true } },
    { text: 'Suddenly every home is doing the same thing at the same time.',
      options: { fontSize: 14, bold: true, color: C.text1 } },
  ], { placeholder: 'body' });
  s.addImage({ path: path.join(FIGS, 'fig1-mechanism.png'), x: 4.95, y: 1.6, w: 4.6, h: 1.90 });
  s.addText('The evening peak, with charging on top of it', {
    x: 4.95, y: 3.58, w: 4.6, h: 0.26, fontSize: 10, italic: true, color: 'A7B2BF', isTextBox: true });
  s.addNotes('The whole network is sized around the assumption that we do not all do the same thing at once. '
    + 'Charging breaks that assumption twice over: by size, and by correlation.');
}

/* ================================================================ 3 */
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'The problem' });
  s.addText('It breaks sooner than people expect', { placeholder: 'title' });
  s.addText('Published thresholds, from measured and modelled studies — not from our simulation.', {
    x: M, y: 1.08, w: W - 2 * M, h: 0.3, fontSize: 13, color: C.text2, isTextBox: true });

  stat(s, { x: M, y: 1.55, w: 2.9, h: 2.45, name: 'stat-pnnl',
    big: '0.75', label: 'vehicles per home is enough to exceed distribution transformer limits at 6.6 kW '
      + 'charging — fewer than one car per household  (PNNL, US Dept. of Energy)' });
  stat(s, { x: M + 3.05, y: 1.55, w: 2.9, h: 2.45, name: 'stat-mea', color: THEME.colors.accent2,
    big: '32%', label: 'of Britain\u2019s low-voltage feeders — some 312,000 circuits — need intervention '
      + 'at 40–70% EV uptake  (My Electric Avenue, Ofgem)' });
  stat(s, { x: M + 6.10, y: 1.55, w: 2.9, h: 2.45, name: 'stat-cost', color: THEME.colors.accent6,
    big: '£2.2bn', bigSize: 34, label: 'of reinforcement cost to 2050 on that same projection — the price of '
      + 'solving this by digging up roads' });

  s.addText('At 19.2 kW charging the first figure falls to 0.25 vehicles per home. Faster chargers do not '
    + 'defer the problem — they multiply it.', {
    x: M, y: 4.2, w: W - 2 * M, h: 0.5, fontSize: 14, italic: true, color: THEME.colors.accent1, isTextBox: true });
  s.addNotes('These are other people\u2019s published numbers, not ours. The point is that the threshold is '
    + 'below one car per household — this is not a 2040s problem.');
}

/* ================================================================ 4 */
pres.addSection({ title: 'The gap' });
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'The gap' });
  s.addText('What Dubai regulates today', { placeholder: 'title' });

  const items = [
    ['Approval', 'Public charging stations need DEWA approval before they are installed or operated, under the '
      + 'EV Charging Technical Regulations.'],
    ['Public tariff', 'Cabinet Decision No. 81 of 2024 sets AED 0.70 per kWh for AC and AED 1.20 for DC, '
      + 'plus VAT.'],
    ['Home charging', 'Sits behind the customer\u2019s meter on the ordinary slab tariff — banded by monthly '
      + 'volume, not by time of day.'],
  ];
  items.forEach(([head, body], i) => {
    const y = 1.25 + i * 1.18;
    card(s, { x: M, y, w: W - 2 * M, h: 1.0, name: `reg-${i}` });
    disc(s, i + 1, M + 0.22, y + 0.3);
    s.addText(head, { x: M + 0.78, y: y + 0.13, w: 2.0, h: 0.32, fontSize: 15, bold: true,
      color: C.text1, valign: 'top', margin: 0, isTextBox: true });
    s.addText(body, { x: M + 0.78, y: y + 0.46, w: W - 2 * M - 1.1, h: 0.46, fontSize: 12.5,
      color: C.text2, valign: 'top', margin: 0, isTextBox: true });
  });
  s.addNotes('The framework is comprehensive on equipment, approval and the price of public charging. '
    + 'Note the third one: no time-of-day signal on domestic charging at all.');
}

/* ================================================================ 5 */
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'The gap' });
  s.addText('But nothing governs the one thing that matters', { placeholder: 'title' });

  const rows = [
    ['The standards govern', 'what may be installed', THEME.colors.dk2],
    ['The load assessment governs', 'what may be connected', THEME.colors.dk2],
    ['Nothing governs', 'what is drawn at seven in the evening', THEME.colors.accent1],
  ];
  rows.forEach(([lead, tail, col], i) => {
    const y = 1.35 + i * 0.82;
    s.addText(lead, { x: M, y, w: 3.5, h: 0.5, fontSize: 17, color: C.text2,
      align: 'right', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(tail, { x: M + 3.7, y, w: 5.2, h: 0.5, fontSize: i === 2 ? 22 : 19,
      bold: i === 2, color: col, valign: 'middle', margin: 0, isTextBox: true });
  });

  card(s, { x: M, y: 3.95, w: W - 2 * M, h: 0.85, name: 'gapnote', fill: '2A3644', line: '2A3644' });
  s.addText('A compliant 7.4 kW charger is entitled to its full 7.4 kW at the worst possible moment — and '
    + 'the capacity check that approved it was made once, years ago, against a worst case that almost never happens.', {
    x: M + 0.25, y: 4.05, w: W - 2 * M - 0.5, h: 0.65, fontSize: 13, color: 'E6ECF2',
    valign: 'middle', margin: 0, isTextBox: true });
  s.addNotes('This is the gap the project fills. Capacity is protected by a single static assessment, '
    + 'and nothing responds once the street is running.');
}

/* ================================================================ 6 */
pres.addSection({ title: 'The approach' });

/* ================================================================ 7 */
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'The approach' });
  s.addText('How the controller works', { placeholder: 'title' });

  const steps = [
    ['Measure', 'Loading read at the transformer, every minute. Measured, not forecast — so it cannot be wrong about it.'],
    ['Subtract', 'Take the households off the safe limit. What is left is the headroom to share.'],
    ['Rank', 'Order cars by least slack: time until departure minus time needed at full power.'],
    ['Enforce', 'Set each charger a current limit on the IEC 61851 control pilot — 6 A to 80 A, the range the standard can express.'],
  ];
  steps.forEach(([head, body], i) => {
    const x = M + i * 2.31;
    card(s, { x, y: 1.3, w: 2.1, h: 2.5, name: `step-${i}` });
    disc(s, i + 1, x + 0.22, 1.52);
    s.addText(head, { x: x + 0.22, y: 2.0, w: 1.7, h: 0.3, fontSize: 15, bold: true,
      color: C.text1, margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.22, y: 2.34, w: 1.7, h: 1.3, fontSize: 11.5, color: C.text2,
      valign: 'top', margin: 0, isTextBox: true });
  });
  s.addText('Below 6 A the pilot cannot express a limit at all — so a session is paused rather than throttled '
    + 'further. For networked points the same instruction travels as an OCPP charging profile.', {
    x: M, y: 4.0, w: W - 2 * M, h: 0.5, fontSize: 12.5, color: C.text2, isTextBox: true });
  s.addNotes('The enforcement mechanism already exists in every compliant charge point. '
    + 'And it degrades safely: lose the controller and the charger reverts to its default limit.');
}

/* ================================================================ 8 */
pres.addSection({ title: 'The AI layer' });
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'The AI layer' });
  s.addText('The AI advisor: it recommends, a human decides', { placeholder: 'title' });
  s.addText([
    { text: 'Two loops, two clocks.', options: { fontSize: 14, bold: true, color: C.text1, breakLine: true } },
    { text: ' ', options: { fontSize: 9, breakLine: true } },
    { text: 'Protection runs every minute and never waits for anyone — a transformer cannot be left overloaded '
          + 'while an operator is away from the desk.', options: { fontSize: 14, breakLine: true } },
    { text: ' ', options: { fontSize: 9, breakLine: true } },
    { text: 'Above it, the advisor reads whole evenings and proposes ranked options: enrol more chargers, '
          + 'tighten the cap, or schedule reinforcement. ', options: { fontSize: 14, breakLine: false } },
    { text: 'Nothing applies until a person chooses one.',
      options: { fontSize: 14, bold: true, color: THEME.colors.accent1 } },
  ], { placeholder: 'body' });
  s.addImage({ path: path.join(FIGS, 'fig3-architecture.png'), x: 5.05, y: 1.3, w: 4.4, h: 2.58 });
  s.addText('This is how utility ADMS restoration already runs — GE Vernova\u2019s Operator Assisted Mode asks the '
    + 'operator first, and proposes the next-best option if they decline. It also matches the UAE AI Charter\u2019s '
    + 'human-oversight priority.', {
    x: M, y: 4.35, w: W - 2 * M, h: 0.55, fontSize: 11.5, italic: true, color: C.text2, isTextBox: true });
  s.addNotes('This is the part judges should remember. The AI does the analysis and states its confidence and '
    + 'its projection; the human makes the call, and the projection is scored against what actually happened.');
}

/* ================================================================ 9 */
pres.addSection({ title: 'What is new' });
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'What is new' });
  s.addText('What is actually new here', { placeholder: 'title' });

  card(s, { x: M, y: 1.18, w: W - 2 * M, h: 0.92, name: 'notnew', fill: 'F4F1F9', line: 'DDD6EF' });
  s.addText('Not new, and we say so', { x: M + 0.25, y: 1.3, w: 3.2, h: 0.26, fontSize: 13, bold: true,
    color: '6B4FA8', valign: 'top', margin: 0, isTextBox: true });
  s.addText('Least-laxity-first scheduling is textbook, and controlling charging against a low-voltage feeder '
    + 'limit was trialled by My Electric Avenue\u2019s Esprit system in 2013\u201315. The control idea is not our '
    + 'contribution. It worked, and it never became standard practice.', {
    x: M + 0.25, y: 1.58, w: W - 2 * M - 0.5, h: 0.46, fontSize: 11.5, color: C.text2, valign: 'top',
    margin: 0, isTextBox: true });

  const items = [
    ['The boundary', 'Dynamic load management caps a site against its own main fuse. Nobody manages the '
      + 'shared transformer across independent customers — and that is where the limit actually binds.'],
    ['The decision', 'No load-management product escalates "this asset is deteriorating, here are three '
      + 'options" to a named operator, with a projection that is scored afterwards against what happened.'],
    ['The regulatory vehicle', 'Dubai has no managed-connection class, so a charge point that can prove it '
      + 'stays within an enforced envelope is still assessed on its nameplate rating. We propose that class.'],
  ];
  items.forEach(([head, body], i) => {
    const x = M + i * 3.08;
    card(s, { x, y: 2.26, w: 2.85, h: 2.2, name: `new-${i}` });
    disc(s, i + 1, x + 0.22, 2.46, 0.34, THEME.colors.accent1);
    s.addText(head, { x: x + 0.22, y: 2.9, w: 2.45, h: 0.28, fontSize: 14, bold: true, color: C.text1,
      valign: 'top', margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.22, y: 3.2, w: 2.45, h: 1.12, fontSize: 11, color: C.text2,
      valign: 'top', margin: 0, isTextBox: true });
  });
  s.addNotes('Say the first box out loud. Owning the prior art is what makes the other three credible, and it '
    + 'pre-empts the obvious question before a judge gets to ask it.');
}

pres.addSection({ title: 'Demonstration' });
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'Demonstration' });
  s.addText('One street, one evening', { placeholder: 'title' });
  s.addImage({ path: path.join(ASSETS, 'demo.png'), x: M, y: 1.25, w: 5.85, h: 2.46 });
  s.addText('A moment from the uncontrolled run — 20:32, already over the limit', {
    x: M, y: 3.78, w: 5.85, h: 0.26, fontSize: 10, italic: true, color: 'A7B2BF', isTextBox: true });

  const nums = [
    ['153%', 'worst of the evening, uncontrolled', THEME.colors.accent1],
    ['87%', 'worst with the controller, never over', THEME.colors.accent4],
    ['14 / 14', 'cars still full by morning', THEME.colors.accent2],
  ];
  nums.forEach(([big, label, col], i) => {
    const y = 1.25 + i * 0.92;
    s.addText(big, { x: 6.65, y, w: 2.85, h: 0.44, fontSize: 28, bold: true, color: col,
      valign: 'top', margin: 0, isTextBox: true });
    s.addText(label, { x: 6.65, y: y + 0.44, w: 2.85, h: 0.44, fontSize: 11.5, color: C.text2,
      valign: 'top', margin: 0, isTextBox: true });
  });
  s.addText('Same cars, same energy, same night — only the timing changes.   rithikhc.github.io/Nexus', {
    x: M, y: 4.45, w: W - 2 * M, h: 0.4, fontSize: 12, color: C.text2, isTextBox: true });
  s.addNotes('A teaching model of one street on a Dubai summer evening, not a validated network study. '
    + 'Live at the link — press play and it runs the evening in twenty seconds.');
}

/* =============================================================== 10 */
/* =============================================================== 11 */
pres.addSection({ title: 'Deployment' });
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'Deployment' });
  s.addText('Getting it into a real network', { placeholder: 'title' });
  s.addText('Phased the way utilities actually adopt control: observe, pilot, then widen the mandate.', {
    x: M, y: 1.06, w: W - 2 * M, h: 0.3, fontSize: 13, color: C.text2, isTextBox: true });

  const phases = [
    ['Instrument', '0–6 months', 'Meter a sample of distribution transformers in a high-EV district. No control at all — '
      + 'just establish how often the limit is approached, and how much of it is charging.'],
    ['Pilot', '6–18 months', 'One or two feeders, opt-in customers. The controller enforces; the advisor runs in '
      + 'advisory-only mode while the operator builds trust in it.'],
    ['Regulate', '18–36 months', 'Work with DEWA to define a managed-connection class, assessed against an enforced '
      + 'envelope rather than a nameplate rating. This is the unlock.'],
    ['Scale', '36 months +', 'District by district. The advisory layer moves from advisory to standard operating '
      + 'procedure — the same path FLISR took.'],
  ];
  phases.forEach(([head, when, body], i) => {
    const x = M + i * 2.31;
    card(s, { x, y: 1.45, w: 2.1, h: 2.75, name: `phase-${i}` });
    disc(s, i + 1, x + 0.22, 1.65, 0.38, i === 2 ? THEME.colors.accent1 : THEME.colors.accent2);
    s.addText(head, { x: x + 0.22, y: 2.12, w: 1.7, h: 0.28, fontSize: 15, bold: true,
      color: C.text1, valign: 'top', margin: 0, isTextBox: true });
    s.addText(when, { x: x + 0.22, y: 2.4, w: 1.7, h: 0.24, fontSize: 10.5, bold: true,
      color: THEME.colors.accent1, valign: 'top', margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.22, y: 2.68, w: 1.7, h: 1.42, fontSize: 11, color: C.text2,
      valign: 'top', margin: 0, isTextBox: true });
  });
  s.addText('Nothing in phases 1 and 2 needs a regulatory change — they can start on the existing framework.', {
    x: M, y: 4.38, w: W - 2 * M, h: 0.3, fontSize: 12.5, italic: true, color: THEME.colors.accent1, isTextBox: true });
  s.addNotes('The order matters. We do not ask anyone to trust an algorithm on day one: phase 1 is measurement only, '
    + 'and phase 2 runs advisory while the operator watches. The regulatory step comes once there is evidence.');
}

/* =============================================================== 12 */
pres.addSection({ title: 'Business model' });
{
  const s = pres.addSlide({ masterName: 'WIDE', sectionTitle: 'Business model' });
  s.addText('The business case, plainly', { placeholder: 'title' });

  /* Only AED figures we can actually source. A British reinforcement cost
     converted into dirhams would look precise and mean nothing. */
  card(s, { x: M, y: 1.2, w: 4.35, h: 1.72, name: 'bm-anchor', fill: '2A3644', line: '2A3644' });
  s.addText('Charging in Dubai is already paid for', { x: M + 0.22, y: 1.32, w: 3.95, h: 0.26,
    fontSize: 13, bold: true, color: 'FFFFFF', valign: 'top', margin: 0, isTextBox: true });
  const tariffs = [['AED 0.70', 'per kWh, AC public charging'], ['AED 1.20', 'per kWh, DC public charging']];
  tariffs.forEach(([amt, what], i) => {
    const y = 1.66 + i * 0.36;
    s.addText(amt, { x: M + 0.22, y, w: 1.1, h: 0.28, fontSize: 15, bold: true, color: 'F0A868',
      valign: 'top', margin: 0, isTextBox: true });
    s.addText(what, { x: M + 1.38, y: y + 0.03, w: 2.8, h: 0.26, fontSize: 11.5, color: 'C9D3DE',
      valign: 'top', margin: 0, isTextBox: true });
  });
  s.addText('Cabinet Decision No. 81 of 2024. Home charging bills on the residential slab tariff. '
    + 'We add nothing to the driver’s bill.', {
    x: M + 0.22, y: 2.42, w: 3.95, h: 0.42, fontSize: 10.5, color: 'A9B6C4', valign: 'top',
    margin: 0, isTextBox: true });

  const left = [
    ['The utility pays', 'The saving is theirs: a transformer not replaced this year, and sight of a load class '
      + 'that is invisible today. Sold per managed charge point.'],
    ['What we cannot tell you', 'We have no verified figure for what a transformer replacement costs DEWA, so we '
      + 'do not quote one. That number belongs in the pilot, not in this slide.'],
  ];
  left.forEach(([head, body], i) => {
    const y = 3.06 + i * 0.88;
    s.addText(head, { x: M, y, w: 4.35, h: 0.26, fontSize: 14, bold: true,
      color: i === 1 ? THEME.colors.accent1 : C.text1, valign: 'top', margin: 0, isTextBox: true });
    s.addText(body, { x: M, y: y + 0.26, w: 4.35, h: 0.6, fontSize: 11.5, color: C.text2,
      valign: 'top', margin: 0, isTextBox: true });
  });

  card(s, { x: 5.2, y: 1.2, w: 4.25, h: 3.35, name: 'bm-right' });
  s.addText('Why it should be cheap to run', {
    x: 5.42, y: 1.38, w: 3.8, h: 0.28, fontSize: 13, bold: true, color: C.text1, valign: 'top',
    margin: 0, isTextBox: true });
  const right = [
    'No new hardware at the charge point. Enforcement rides on IEC 61851 and OCPP, which every compliant '
      + 'point already implements.',
    'One meter per transformer, not one per home — the cost scales with assets, not customers.',
    'It sits inside the ADMS the utility already runs, beside FLISR, over protocols already deployed.',
    'A single vertically-integrated utility means one customer and one decision — then the same case '
      + 'across the GCC, where the climate argument holds.',
  ];
  right.forEach((t, i) => {
    const y = 1.8 + i * 0.72;
    disc(s, i + 1, 5.42, y, 0.26, THEME.colors.accent2);
    s.addText(t, { x: 5.8, y: y - 0.04, w: 3.42, h: 0.62, fontSize: 11, color: C.text2,
      valign: 'top', margin: 0, isTextBox: true });
  });
  s.addNotes('Keep this modest. The only AED figures here are DEWA’s published tariffs. We are not selling hardware, '
    + 'and we are not pretending to know what a transformer costs them - that is what the pilot is for.');
}

/* =============================================================== 13 */
pres.addSection({ title: 'Close' });
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Close' });
  s.addText('The capacity is already in the ground', { x: M, y: 0.5, w: W - 2 * M, h: 0.8,
    fontSize: 34, bold: true, color: 'FFFFFF', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('What is missing is the coordination to use it — and nothing here needs a new standard, a new '
    + 'interface, or a replaced transformer.', {
    x: M, y: 1.34, w: W - 2 * M, h: 0.46, fontSize: 14.5, color: 'E6ECF2', valign: 'top',
    margin: 0, isTextBox: true });

  const sdgs = [
    ['SDG 9', 'Industry, innovation and infrastructure', 'Retrofitting existing infrastructure for greater '
      + 'resource-use efficiency — the target this project sits squarely on.', true],
    ['SDG 7', 'Affordable and clean energy', 'More charging served per asset, without the cost and carbon of '
      + 'replacing it.', false],
    ['SDG 11', 'Sustainable cities', 'Removes a constraint that would otherwise slow electrification in the '
      + 'densest areas first.', false],
  ];
  sdgs.forEach(([tag, name, body, lead], i) => {
    const x = M + i * 3.08;
    card(s, { x, y: 2.0, w: 2.85, h: 1.9, name: `sdg-${i}`,
      fill: lead ? '2F4A3C' : '2A3644', line: lead ? '3E6450' : '2A3644' });
    s.addText(tag, { x: x + 0.22, y: 2.14, w: 2.4, h: 0.3, fontSize: 17, bold: true,
      color: lead ? '8FD0A8' : 'F0A868', valign: 'top', margin: 0, isTextBox: true });
    s.addText(name, { x: x + 0.22, y: 2.46, w: 2.4, h: 0.44, fontSize: 11.5, bold: true, color: 'FFFFFF',
      valign: 'top', margin: 0, isTextBox: true });
    s.addText(body, { x: x + 0.22, y: 2.92, w: 2.4, h: 0.86, fontSize: 10.5, color: 'A9B6C4',
      valign: 'top', margin: 0, isTextBox: true });
  });

  s.addText('Honestly: this argues from published sources and the regulatory framework. It is not a validated '
    + 'network study, and the advisor is a transparent recommender rather than a trained model.', {
    x: M, y: 4.08, w: W - 2 * M, h: 0.5, fontSize: 11.5, italic: true, color: '8C9BAB', valign: 'top',
    margin: 0, isTextBox: true });
  s.addNotes('Close on the contribution, the SDG fit, and the honest limit — in that order. Then take questions.');
}

pres.addSection({ title: 'Thank you' });
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Thank you' });
  s.addText('Thank you', { x: M, y: 0.42, w: 5, h: 0.75, fontSize: 36, bold: true,
    color: 'FFFFFF', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('Questions welcome  ·  demo and paper at  rithikhc.github.io/Nexus', {
    x: M, y: 1.12, w: 6.5, h: 0.3, fontSize: 13, color: '9FB0C0', valign: 'top',
    margin: 0, isTextBox: true });

  card(s, { x: M, y: 1.62, w: W - 2 * M, h: 3.4, name: 'refcard', fill: 'FFFFFF', line: 'FFFFFF' });
  s.addText('Sources for every figure in this deck', {
    x: M + 0.25, y: 1.78, w: 8, h: 0.26, fontSize: 12, bold: true, color: THEME.colors.dk1,
    valign: 'top', margin: 0, isTextBox: true });

  const colA = [
    ['0.75 and 0.25 vehicles per home', 'R. M. Pratt and L. E. Bernal, “Distribution System V1G PEV Charging '
      + 'Impacts Report,” Pacific Northwest National Laboratory, Rep. PNNL-27206, Jan. 2018.'],
    ['32%, 312,000 circuits, £2.2bn', 'EA Technology, “My Electric Avenue,” Project Summary Report, Ofgem Low '
      + 'Carbon Networks Fund, 2015.'],
    ['AED 0.70 / 1.20 per kWh, slab tariff', 'DEWA, EV charging tariffs implementing Cabinet Decision No. 81 of '
      + '2024; DEWA residential slab tariff.'],
  ];
  const colB = [
    ['DEWA approval, installation rules', 'DEWA, EV Charging Technical Regulations; DEWA, Regulations for '
      + 'Electrical Installations, 2017.'],
    ['6 A to 80 A control pilot, OCPP', 'IEC 61851-1:2017; IEC 62196; Open Charge Alliance, OCPP 1.6J and 2.0.1 '
      + 'Smart Charging.'],
    ['Operator-assisted mode, human oversight', 'GE Vernova D400-DA product documentation; Oracle Utilities NMS; '
      + 'UAE Charter for the Development and Use of Artificial Intelligence.'],
  ];
  const putRefs = (list, x) => list.forEach(([label, src], i) => {
    const y = 2.14 + i * 0.92;
    s.addText(label, { x, y, w: 4.2, h: 0.24, fontSize: 10.5, bold: true, color: THEME.colors.accent2,
      valign: 'top', margin: 0, isTextBox: true });
    s.addText(src, { x, y: y + 0.22, w: 4.2, h: 0.66, fontSize: 10, color: '4A5A6B',
      valign: 'top', margin: 0, isTextBox: true });
  });
  putRefs(colA, M + 0.25);
  putRefs(colB, M + 4.72);

  s.addText('The 153% and 87% on the demonstration slide are from our own teaching model of one street, '
    + 'not a measurement and not from any source above.', {
    x: M + 0.25, y: 4.68, w: 8.9, h: 0.26, fontSize: 10, italic: true, color: '7A8794',
    valign: 'top', margin: 0, isTextBox: true });
  s.addNotes('Leave this up during questions. Everything quantitative in the talk is sourced here, and the one '
    + 'thing that is ours is labelled as ours.');
}

(async () => {
  const out = path.join(__dirname, process.env.OUT || 'NEXUS-3.0-presentation.pptx');
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('wrote ' + out);
})();
