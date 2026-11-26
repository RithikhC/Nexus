// Validates a built .docx without needing Word: word count, page estimate,
// stray markup, and whether every reference is cited in the body.
//   OUT=_new.docx node check.js
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Arial advance widths (units per 1000 em), enough of the set to wrap accurately.
const W = {};
{
  const put = (chars, w) => { for (const c of chars) W[c] = w; };
  put(' ', 278); put('!', 278); put('"', 355); put('#', 556); put('$', 556);
  put('%', 889); put('&', 667); put("'", 191); put('(', 333); put(')', 333);
  put('*', 389); put('+', 584); put(',', 278); put('-', 333); put('.', 278);
  put('/', 278); put('0123456789', 556); put(':', 278); put(';', 278);
  put('<', 584); put('=', 584); put('>', 584); put('?', 556); put('@', 1015);
  put('A', 667); put('B', 667); put('C', 722); put('D', 722); put('E', 667);
  put('F', 611); put('G', 778); put('H', 722); put('I', 278); put('J', 500);
  put('K', 667); put('L', 556); put('M', 833); put('N', 722); put('O', 778);
  put('P', 667); put('Q', 778); put('R', 722); put('S', 667); put('T', 611);
  put('U', 722); put('V', 667); put('W', 944); put('X', 667); put('Y', 667);
  put('Z', 611); put('[', 278); put('\\', 278); put(']', 278); put('^', 469);
  put('_', 556); put('`', 333); put('a', 556); put('b', 556); put('c', 500);
  put('d', 556); put('e', 556); put('f', 278); put('g', 556); put('h', 556);
  put('i', 222); put('j', 222); put('k', 500); put('l', 222); put('m', 833);
  put('n', 556); put('o', 556); put('p', 556); put('q', 556); put('r', 333);
  put('s', 500); put('t', 278); put('u', 556); put('v', 500); put('w', 722);
  put('x', 500); put('y', 500); put('z', 500); put('{', 334); put('|', 260);
  put('}', 334); put('~', 584);
  put('–', 556); put('—', 1000);          // en dash, em dash
  put('‘’', 191); put('“”', 333); // curly quotes
  put('×', 584); put('°', 400); put(' ', 278);
}

const PT = 9.5;            // body font size
const COL_PT = 243;        // usable column width, points (IEEE two-column)
const LINES_PER_COL = 54;  // body lines that fit in one column
const COLS_PER_PAGE = 2;

const textWidth = (s, pt) => {
  let u = 0;
  for (const ch of s) u += W[ch] != null ? W[ch] : 556;
  return (u / 1000) * pt;
};

function wrapLines(s, pt, colPt) {
  const words = s.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let lines = 1;
  let cur = 0;
  const space = textWidth(' ', pt);
  for (const w of words) {
    const ww = textWidth(w, pt);
    if (cur === 0) { cur = ww; continue; }
    if (cur + space + ww <= colPt) cur += space + ww;
    else { lines++; cur = ww; }
  }
  return lines;
}

(async () => {
  const file = path.join(__dirname, process.env.OUT || 'Intelligent-EV-Charging-Management.docx');
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const xml = await zip.file('word/document.xml').async('string');

  const paras = xml.split(/<w:p[ >]/).slice(1).map((chunk) =>
    [...chunk.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join('')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );

  const body = paras.join('\n');
  const words = body.split(/\s+/).filter(Boolean).length;

  let lines = 0;
  for (const p of paras) {
    if (!p.trim()) { lines += 1; continue; }
    lines += wrapLines(p, PT, COL_PT) + 0.35; // paragraph spacing
  }
  const drawings = (xml.match(/<w:drawing>/g) || []).length;
  const tableRows = (xml.match(/<w:tr[ >]/g) || []).length;
  lines += drawings * 15;   // figure block incl. caption
  lines += tableRows * 1.1;

  const pages = lines / (LINES_PER_COL * COLS_PER_PAGE);

  const stray = [...body.matchAll(/<\/?(em|i|b|strong|static|dynamic)>/g)].map((m) => m[0]);

  // Reference coverage: every [n] in the list must be cited before the list starts.
  const listStart = body.search(/^\[1\]\s/m);
  const bodyOnly = listStart > 0 ? body.slice(0, listStart) : body;
  const refNums = [...body.matchAll(/^\[(\d+)\]\s/gm)].map((m) => Number(m[1]));
  const citedInBody = new Set();
  for (const m of bodyOnly.matchAll(/\[(\d+)\]/g)) citedInBody.add(Number(m[1]));
  for (const m of bodyOnly.matchAll(/\[(\d+)\]\s*[-–]\s*\[(\d+)\]/g)) {
    for (let i = Number(m[1]); i <= Number(m[2]); i++) citedInBody.add(i);
  }
  const uncited = refNums.filter((n) => !citedInBody.has(n));

  console.log(`words: ${words} | est. pages: ${pages.toFixed(1)} | figures: ${drawings} | table rows: ${tableRows}`);
  console.log(`stray markup: ${stray.length ? stray.join(', ') : 'none'}`);
  console.log(`refs: ${refNums.length} | uncited: ${uncited.length ? uncited.join(', ') : 'none'}`);
})();
