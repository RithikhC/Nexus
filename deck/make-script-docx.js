/* Turns SCRIPT.md into a Word document you can hold while rehearsing.
 *   node make-script-docx.js
 * Parses the markdown rather than duplicating it, so the two cannot drift.
 */
const fs = require('fs');
const path = require('path');
const D = require(path.join(__dirname, '..', 'paper', 'node_modules', 'docx'));
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, TabStopType, convertInchesToTwip,
} = D;

const SANS = 'Calibri';
const INK = '1A2430';
const MUTED = '55657A';
const ACCENT = '14708F';
const TERRA = 'C2561E';
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

/* ------------------------------------------------- inline markdown */
function runs(text, base = {}) {
  const out = [];
  // **bold** first, then *italic*, so the two do not collide
  for (const chunk of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!chunk) continue;
    if (chunk.startsWith('**')) {
      out.push(new TextRun({ ...base, text: chunk.slice(2, -2), bold: true }));
    } else {
      for (const bit of chunk.split(/(\*[^*]+\*)/g)) {
        if (!bit) continue;
        if (bit.startsWith('*') && bit.endsWith('*')) {
          out.push(new TextRun({ ...base, text: bit.slice(1, -1), italics: true, color: MUTED }));
        } else {
          out.push(new TextRun({ ...base, text: bit }));
        }
      }
    }
  }
  return out.length ? out : [new TextRun({ ...base, text: '' })];
}

const spoken = (text) => new Paragraph({
  children: runs(text, { font: SANS, size: 25, color: INK }),
  spacing: { after: 140, line: 330 },
  indent: { left: convertInchesToTwip(0.28) },
});

const note = (text) => new Paragraph({
  children: runs(text, { font: SANS, size: 20, color: MUTED, italics: true }),
  spacing: { after: 120, line: 260 },
  indent: { left: convertInchesToTwip(0.28) },
});

/* ------------------------------------------------------- the parse */
const md = fs.readFileSync(path.join(__dirname, 'SCRIPT.md'), 'utf8').split('\n');
const body = [];
let i = 0;
let inQA = false;

while (i < md.length) {
  const line = md[i];

  if (line.startsWith('# ')) {
    const t = line.slice(2);
    inQA = /Defending/i.test(t);
    body.push(new Paragraph({
      children: [new TextRun({ text: t, font: SANS, size: 36, bold: true, color: INK })],
      spacing: { before: inQA ? 420 : 0, after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9D3DE', space: 8 } },
    }));
    i++; continue;
  }

  if (line.startsWith('## ')) {
    // "Slide 3 · Title — **Speaker 1** · 50 s"
    const raw = line.slice(3);
    const m = raw.match(/^(.*?)\s+—\s+\*\*(.+?)\*\*\s+·\s+(.+)$/);
    const left = m ? m[1] : raw;
    const who = m ? `${m[2]}  ·  ${m[3]}` : '';
    body.push(new Paragraph({
      children: [
        new TextRun({ text: left, font: SANS, size: 26, bold: true, color: INK }),
        ...(who ? [
          new TextRun({ text: '\t', font: SANS, size: 22 }),
          new TextRun({ text: who, font: SANS, size: 21, bold: true, color: TERRA }),
        ] : []),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: convertInchesToTwip(6.9) }],
      spacing: { before: 300, after: 120 },
      keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4EC', space: 6 } },
    }));
    i++; continue;
  }

  if (line.startsWith('|')) {                      // the split table
    const rows = [];
    while (i < md.length && md[i].startsWith('|')) {
      const cells = md[i].split('|').slice(1, -1).map((c) => c.trim());
      if (!/^-+$/.test(cells[0].replace(/[-: ]/g, '') || '-') || !cells[0].match(/^[-: ]*$/)) rows.push(cells);
      i++;
    }
    const head = rows.shift();
    const widths = [1700, 1900, 5600];
    const cell = (txt, bold, w) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      margins: { top: 90, bottom: 90, left: 130, right: 130 },
      shading: bold ? { type: ShadingType.CLEAR, fill: 'EEF3F7' } : undefined,
      children: [new Paragraph({
        children: runs(txt, { font: SANS, size: 20, bold, color: bold ? INK : MUTED }),
        spacing: { after: 0, line: 250 },
      })],
    });
    body.push(new Table({
      columnWidths: widths,
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      rows: [
        new TableRow({ children: head.map((h, k) => cell(h, true, widths[k])), tableHeader: true }),
        ...rows.map((r) => new TableRow({ children: r.map((c, k) => cell(c, false, widths[k])) })),
      ],
    }));
    body.push(new Paragraph({ text: '', spacing: { after: 160 } }));
    continue;
  }

  if (line.startsWith('> ')) {                     // spoken, possibly multi-line
    const buf = [];
    while (i < md.length && md[i].startsWith('>')) {
      const t = md[i].replace(/^>\s?/, '');
      if (t.trim() === '') { if (buf.length) { body.push(spoken(buf.join(' '))); buf.length = 0; } }
      else buf.push(t);
      i++;
    }
    if (buf.length) body.push(spoken(buf.join(' ')));
    continue;
  }

  if (line.startsWith('**') && inQA) {             // a Q&A question
    body.push(new Paragraph({
      children: runs(line, { font: SANS, size: 23, color: ACCENT }),
      spacing: { before: 220, after: 90 },
      keepNext: true,
    }));
    i++; continue;
  }

  if (line.trim() === '---' || line.trim() === '') { i++; continue; }

  body.push(note(line));                           // stage directions and asides
  i++;
}

const doc = new Document({
  creator: 'NEXUS 3.0',
  title: 'NEXUS 3.0 — presentation script',
  styles: {
    default: {
      document: { run: { font: SANS, size: 22, color: INK }, paragraph: { spacing: { line: 280 } } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },     // US Letter
        margin: { top: 1000, right: 1100, bottom: 1000, left: 1100 },
      },
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, process.env.OUT || 'NEXUS-3.0-script.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote ' + out + '  (' + Math.round(buf.length / 1024) + ' KB)');
});
