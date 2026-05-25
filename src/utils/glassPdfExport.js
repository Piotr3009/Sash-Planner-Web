/**
 * glassPdfExport.js
 *
 * Professional A4-landscape PDF for glass factory orders.
 * Navy (#1a3a5c) glass lines, teal (#00897B) dimensions.
 *
 * Page 1: compact header + full summary table
 * Page 2+: compact header + 6 CAD drawings per page (3×2)
 */
import { jsPDF } from 'jspdf';
import { CONSTANTS } from '../engine/calculations.js';
import { computeGlassBarPositions } from '../components/drawings/drawingUtils.jsx';

// ─── COLORS (RGB 0-255) ───
const C = {
  black:    [26, 26, 26],
  dark:     [60, 60, 60],
  gray:     [136, 136, 136],
  grayL:    [180, 180, 180],
  grayXL:   [220, 220, 220],
  rowBg:    [248, 248, 246],
  glass:    [26, 58, 92],
  glassFill:[240, 243, 247],
  dim:      [0, 121, 107],
  link:     [0, 85, 170],
};

// ─── LINE WIDTHS (mm) — CAD standard ───
const LW = {
  border:   0.5,
  borderIn: 0.08,
  outline:  0.25,     // glass outer edge
  seal:     0.13,     // edge seal, spacer bars
  cross:    0.1,      // bar intersection crosses
  dimLine:  0.18,     // chain dimension lines
  dimOver:  0.22,     // overall dimension lines
  tick:     0.18,     // tick marks
  ext:      0.06,     // extension lines (dashed)
  cell:     0.2,      // drawing cell border
  cellIn:   0.06,     // inner cell border
  sep:      0.3,      // section separators
  tableLine:0.15,
};

// ─── PAGE ───
const PG = { w: 297, h: 210, bx: 8, by: 8 };
const HEADER_H = 20;
const FOOTER_H = 8;
const TABLE_ROW_H = 6;

// ─── GLASS CONSTANTS ───
const BAR_PATTERNS = {
  'none': { h: 0, v: 0 }, '2x2': { h: 0, v: 1 }, '3x3': { h: 0, v: 2 },
  '4x4': { h: 1, v: 1 }, '6x6': { h: 1, v: 2 }, '9x9': { h: 2, v: 2 },
};
const SPACER_BAR = 18;
const EDGE_SEAL = 11;

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function segsBetween(from, to, cutPairs) {
  if (!cutPairs.length) return [{ a: from, b: to }];
  const sorted = [...cutPairs].sort((a, b) => a[0] - b[0]);
  const segs = [];
  let pos = from;
  for (const [s, e] of sorted) {
    if (s > pos) segs.push({ a: pos, b: s });
    pos = Math.max(pos, e);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

// ─── DRAWING PRIMITIVES ───

const dc = (d, c) => d.setDrawColor(...c);
const fc = (d, c) => d.setFillColor(...c);
const tc = (d, c) => d.setTextColor(...c);

// ─── PAGE BORDER ───

function drawPageBorder(doc) {
  dc(doc, C.black);
  doc.setLineWidth(LW.border);
  doc.rect(PG.bx, PG.by, PG.w - 2 * PG.bx, PG.h - 2 * PG.by);
  doc.setLineWidth(LW.borderIn);
  doc.rect(PG.bx + 0.7, PG.by + 0.7, PG.w - 2 * PG.bx - 1.4, PG.h - 2 * PG.by - 1.4);
}

// ─── HEADER (compact ~20mm) ───

function drawHeader(doc, info, pageNum, totalPages) {
  const x = PG.bx + 0.7, y = PG.by + 0.7;
  const w = PG.w - 2 * PG.bx - 1.4;
  const h = HEADER_H;

  // Separators
  dc(doc, C.black);
  doc.setLineWidth(LW.sep);
  doc.line(x, y + h, x + w, y + h);

  // Vertical dividers
  const col1 = 55, col2 = w - 50, col3 = w - 25;
  doc.setLineWidth(LW.borderIn);
  doc.line(x + col1, y, x + col1, y + h);
  doc.line(x + col2, y, x + col2, y + h);
  doc.line(x + col3, y, x + col3, y + h);
  // Horizontal halves in right boxes
  doc.line(x + col2, y + h / 2, x + w, y + h / 2);

  // Company
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  tc(doc, C.black);
  doc.text(info.companyName || 'COMPANY', x + 2, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  tc(doc, C.gray);
  doc.text('GLASS ORDER — SEALED UNITS', x + 2, y + 13);

  // Batch + Projects
  doc.setFontSize(4.5);
  tc(doc, C.grayL);
  doc.text('Batch:', x + col1 + 3, y + 7);
  doc.text('Projects:', x + col1 + 3, y + h / 2 + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  tc(doc, C.black);
  doc.text(String(info.batchName || '—'), x + col1 + 18, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  tc(doc, C.black);
  const projStr = (info.projects || []).join(' · ');
  doc.text(projStr.substring(0, 90), x + col1 + 22, y + h / 2 + 7);

  // Date / Units
  doc.setFontSize(4.5);
  tc(doc, C.grayL);
  doc.text('Date:', x + col2 + 3, y + 7);
  doc.text('Units:', x + col2 + 3, y + h / 2 + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  tc(doc, C.black);
  doc.text(info.date, x + col2 + 14, y + 7);
  doc.text(String(info.totalUnits), x + col2 + 15, y + h / 2 + 7);

  // Rev / Page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  tc(doc, C.grayL);
  doc.text('Rev:', x + col3 + 3, y + 7);
  doc.text('Page:', x + col3 + 3, y + h / 2 + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  tc(doc, C.black);
  doc.text(info.revision || 'A', x + col3 + 12, y + 7);
  doc.text(`${pageNum} / ${totalPages}`, x + col3 + 14, y + h / 2 + 7);
}

// ─── SUMMARY TABLE ───

function drawTable(doc, items, startY) {
  const x = PG.bx + 3;
  let y = startY + 5;

  // Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  tc(doc, C.grayL);
  doc.text('GLASS SCHEDULE', x, y);
  y += 5;

  // Columns
  const cols = [
    { l: '#',         dx: 0 },
    { l: 'Window',    dx: 10 },
    { l: 'Sash',      dx: 35 },
    { l: 'Width (mm)',dx: 58 },
    { l: 'Height (mm)',dx: 88 },
    { l: 'Type',      dx: 120 },
    { l: 'Makeup',    dx: 148 },
    { l: 'Spec',      dx: 178 },
    { l: 'Finish',    dx: 210 },
    { l: 'Spacer',    dx: 238 },
    { l: 'Bars',      dx: 262 },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  tc(doc, C.dark);
  cols.forEach(c => doc.text(c.l, x + c.dx, y));

  dc(doc, C.grayXL);
  doc.setLineWidth(LW.tableLine);
  doc.line(x, y + 1.5, x + 270, y + 1.5);
  y += TABLE_ROW_H;

  // Rows
  items.forEach((g, i) => {
    if (i % 2 === 0) {
      fc(doc, C.rowBg);
      doc.rect(x - 1, y - 3.5, 272, TABLE_ROW_H, 'F');
    }

    const clr = i % 2 === 0 ? C.black : C.dark;
    tc(doc, clr);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6);
    doc.text(String(i + 1), x + 0, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(g.windowName || '', x + 10, y);
    doc.text(g.sash || '', x + 35, y);

    doc.setFont('courier', 'normal');
    doc.text(fmt(g.glassW), x + 58, y);
    doc.text(fmt(g.glassH), x + 88, y);

    doc.setFont('helvetica', 'normal');
    doc.text(g.type || '', x + 120, y);
    doc.text(g.makeup || '', x + 148, y);
    doc.text(g.spec || '', x + 178, y);
    doc.text(g.finish || '', x + 210, y);
    doc.text(g.spacer || '', x + 238, y);
    doc.text(g.bars || '', x + 262, y);

    y += TABLE_ROW_H;
  });

  return y;
}

// ─── SINGLE GLASS DRAWING ───

function drawGlass(doc, cx, cy, cw, ch, g) {
  // Cell double border
  dc(doc, C.black);
  doc.setLineWidth(LW.cell);
  doc.rect(cx, cy, cw, ch);
  doc.setLineWidth(LW.cellIn);
  doc.rect(cx + 0.3, cy + 0.3, cw - 0.6, ch - 0.6);

  // Title bar — left: name, right: spec (same size)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  tc(doc, C.black);
  doc.text(`${g.index} · ${g.windowName} — ${g.sash.toUpperCase()} GLASS`, cx + 2, cy + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  tc(doc, C.glass);
  doc.text(`${g.type} / ${g.finish} · spacer: ${g.spacer}`, cx + cw - 2, cy + 4, { align: 'right' });
  dc(doc, C.black);
  doc.setLineWidth(LW.cellIn);
  doc.line(cx + 0.3, cy + 6, cx + cw - 0.3, cy + 6);

  // Drawing area — no bottom text, maximized
  const dMargin = { l: 10, t: 8, r: 10, b: 8 };
  const areaX = cx + 2;
  const areaY = cy + 8;
  const areaW = cw - 4;
  const areaH = ch - 12;

  const availW = areaW - dMargin.l - dMargin.r;
  const availH = areaH - dMargin.t - dMargin.b;
  const sc = Math.min(availW / g.glassW, availH / g.glassH);

  const gw = g.glassW * sc;
  const gh = g.glassH * sc;
  const gx = areaX + dMargin.l + (availW - gw) / 2;
  const gy = areaY + dMargin.t + (availH - gh) / 2;

  // Glass fill + outline
  fc(doc, C.glassFill);
  dc(doc, C.glass);
  doc.setLineWidth(LW.outline);
  doc.rect(gx, gy, gw, gh, 'FD');

  // Edge seal
  const es = EDGE_SEAL * sc;
  doc.setLineWidth(LW.seal);
  doc.rect(gx + es, gy + es, gw - 2 * es, gh - 2 * es);

  // Bars
  const pat = BAR_PATTERNS[g.bars] || BAR_PATTERNS['none'];
  const bars = computeGlassBarPositions({
    sashW: g.sashW, sashH: g.sashH, isUpper: g.sash === 'Upper',
    vCount: pat.v, hCount: pat.h,
  });

  doc.setLineWidth(LW.seal);

  // Vertical bars
  bars.vBars.forEach(vb => {
    const hPairs = bars.hBars.map(hb => [hb.top * sc, hb.bot * sc]);
    segsBetween(0, gh, hPairs).forEach(s => {
      doc.line(gx + vb.left * sc, gy + s.a, gx + vb.left * sc, gy + s.b);
      doc.line(gx + vb.right * sc, gy + s.a, gx + vb.right * sc, gy + s.b);
    });
  });

  // Horizontal bars
  bars.hBars.forEach(hb => {
    const vPairs = bars.vBars.map(vb => [vb.left * sc, vb.right * sc]);
    segsBetween(0, gw, vPairs).forEach(s => {
      doc.line(gx + s.a, gy + hb.top * sc, gx + s.b, gy + hb.top * sc);
      doc.line(gx + s.a, gy + hb.bot * sc, gx + s.b, gy + hb.bot * sc);
    });
  });

  // Crosses
  doc.setLineWidth(LW.cross);
  bars.vBars.forEach(vb => {
    bars.hBars.forEach(hb => {
      doc.line(gx + vb.left * sc, gy + hb.top * sc, gx + vb.right * sc, gy + hb.bot * sc);
      doc.line(gx + vb.right * sc, gy + hb.top * sc, gx + vb.left * sc, gy + hb.bot * sc);
    });
  });

  // ── CHAIN H (top) ──
  const hCuts = [0, EDGE_SEAL];
  bars.vBars.forEach(b => { hCuts.push(b.left); hCuts.push(b.right); });
  hCuts.push(g.glassW - EDGE_SEAL, g.glassW);

  const chainY = gy - 4;
  dc(doc, C.dim);
  doc.setLineWidth(LW.dimLine);
  doc.line(gx, chainY, gx + gw, chainY);

  hCuts.forEach(cut => {
    const px = gx + cut * sc;
    doc.setLineWidth(LW.tick);
    doc.line(px, chainY - 1.2, px, chainY + 1.2);
    doc.setLineWidth(LW.ext);
    doc.setLineDashPattern([0.5, 0.4], 0);
    doc.line(px, chainY + 1.2, px, gy);
    doc.setLineDashPattern([], 0);
  });

  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  tc(doc, C.dim);
  for (let i = 0; i < hCuts.length - 1; i++) {
    const segW = hCuts[i + 1] - hCuts[i];
    const midX = gx + (hCuts[i] + hCuts[i + 1]) / 2 * sc;
    doc.text(fmt(segW), midX, chainY - 1.8, { align: 'center' });
  }

  // ── CHAIN V (left) ──
  const vCuts = [0, EDGE_SEAL];
  bars.hBars.forEach(b => { vCuts.push(b.top); vCuts.push(b.bot); });
  vCuts.push(g.glassH - EDGE_SEAL, g.glassH);

  const chainX = gx - 4;
  dc(doc, C.dim);
  doc.setLineWidth(LW.dimLine);
  doc.line(chainX, gy, chainX, gy + gh);

  vCuts.forEach(cut => {
    const py = gy + cut * sc;
    doc.setLineWidth(LW.tick);
    doc.line(chainX - 1.2, py, chainX + 1.2, py);
    doc.setLineWidth(LW.ext);
    doc.setLineDashPattern([0.5, 0.4], 0);
    doc.line(chainX + 1.2, py, gx, py);
    doc.setLineDashPattern([], 0);
  });

  for (let i = 0; i < vCuts.length - 1; i++) {
    const segH = vCuts[i + 1] - vCuts[i];
    const midY = gy + (vCuts[i] + vCuts[i + 1]) / 2 * sc;
    doc.text(fmt(segH), chainX - 1.8, midY, { angle: 90, align: 'center' });
  }

  // ── OVERALL WIDTH (bottom) ──
  const owY = gy + gh + 4;
  dc(doc, C.dim);
  doc.setLineWidth(LW.dimOver);
  doc.line(gx, owY, gx + gw, owY);
  doc.line(gx, owY - 1.2, gx, owY + 1.2);
  doc.line(gx + gw, owY - 1.2, gx + gw, owY + 1.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  tc(doc, C.dim);
  doc.text(`${fmt(g.glassW)} mm`, gx + gw / 2, owY + 3.5, { align: 'center' });

  // ── OVERALL HEIGHT (right) ──
  const ohX = gx + gw + 4;
  doc.setLineWidth(LW.dimOver);
  doc.line(ohX, gy, ohX, gy + gh);
  doc.line(ohX - 1.2, gy, ohX + 1.2, gy);
  doc.line(ohX - 1.2, gy + gh, ohX + 1.2, gy + gh);
  doc.text(`${fmt(g.glassH)} mm`, ohX + 3.5, gy + gh / 2, { angle: 90, align: 'center' });

}

// ─── FOOTER ───

function drawFooter(doc, info, pageNum, totalPages) {
  const y = PG.h - PG.by - 3;
  dc(doc, C.black);
  doc.setLineWidth(LW.borderIn);
  doc.line(PG.bx + 0.7, y - 1, PG.w - PG.bx - 0.7, y - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4);
  tc(doc, C.grayL);
  const foot = [info.companyName, info.companyAddress, info.companyEmail].filter(Boolean).join(' · ');
  doc.text(foot, PG.bx + 4, y + 1.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(5);
  tc(doc, C.black);
  doc.text(`${pageNum} / ${totalPages}`, PG.w - PG.bx - 4, y + 1.5, { align: 'right' });
}

// ─── MAIN EXPORT ───

export function exportGlassPDF({ batch, windowsData, projects = [], companySettings = {} }) {
  const glassItems = [];
  let idx = 1;

  windowsData.forEach(({ win, windowSpec, derived }) => {
    if (!derived || !windowSpec) return;
    const sw = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;
    if (!sw || !topH || !botH) return;

    const glassW = sw - CONSTANTS.GLASS_WIDTH_DEDUCTION;
    const lowerDed = CONSTANTS.MEETING_RAIL_WIDTH + CONSTANTS.BOTTOM_RAIL_WIDTH - 25;
    const glassHupper = topH - CONSTANTS.GLASS_HEIGHT_DEDUCTION;
    const glassHlower = botH - lowerDed;

    const type = windowSpec?.glazing?.type || 'double';
    const spec = windowSpec?.glazing?.spec || 'toughened';
    const spacer = windowSpec?.glazing?.spacerColour || 'silver';
    const makeup = windowSpec?.glazing?.makeup || '4x16x4';
    const isFrosted = windowSpec?.glazing?.finish === 'frosted';
    const fLoc = windowSpec?.glazing?.frostedLocation || 'bottom';
    const grid = windowSpec?.sash?.grid?.mode || 'none';

    const base = { windowName: win.name, projectNumber: win._projectNumber || '', type, spec, spacer, makeup, bars: grid, sashW: sw };

    glassItems.push({ ...base, index: idx++, sash: 'Upper', sashH: topH, glassW, glassH: glassHupper, finish: isFrosted && fLoc === 'both' ? 'frosted' : 'clear' });
    glassItems.push({ ...base, index: idx++, sash: 'Lower', sashH: botH, glassW, glassH: glassHlower, finish: isFrosted ? 'frosted' : 'clear' });
  });

  if (!glassItems.length) return null;

  // Pagination: page 1 = table, page 2+ = 6 drawings each
  const drawPages = Math.ceil(glassItems.length / 4);
  const totalPages = 1 + drawPages;

  const info = {
    companyName: companySettings.companyName || 'COMPANY NAME',
    companyAddress: companySettings.companyAddress || '',
    companyEmail: companySettings.companyEmail || '',
    batchName: batch?.name || batch?.id || 'Batch',
    projects: projects.map(p => `${p.number || p.id}${p.name ? ' (' + p.name + ')' : ''}`),
    date: new Date().toLocaleDateString('en-GB'),
    totalUnits: glassItems.length,
    revision: 'A',
  };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ─ PAGE 1: TABLE ─
  drawPageBorder(doc);
  drawHeader(doc, info, 1, totalPages);
  drawTable(doc, glassItems, PG.by + HEADER_H + 1);
  drawFooter(doc, info, 1, totalPages);

  // ─ PAGE 2+: DRAWINGS ─
  const contentTop = PG.by + HEADER_H + 2;
  const contentBot = PG.h - PG.by - FOOTER_H;
  const drawAreaH = contentBot - contentTop;
  const drawAreaW = PG.w - 2 * PG.bx - 4;

  const gap = 3;
  const cellW = (drawAreaW - gap) / 2;
  const cellH = (drawAreaH - gap) / 2;

  let di = 0;
  for (let pg = 0; pg < drawPages; pg++) {
    doc.addPage();
    drawPageBorder(doc);
    drawHeader(doc, info, pg + 2, totalPages);

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        if (di >= glassItems.length) break;
        const cellX = PG.bx + 2 + col * (cellW + gap);
        const cellY = contentTop + row * (cellH + gap);
        drawGlass(doc, cellX, cellY, cellW, cellH, glassItems[di]);
        di++;
      }
    }

    drawFooter(doc, info, pg + 2, totalPages);
  }

  const filename = `Glass_Order_${(info.batchName || 'batch').replace(/[^a-zA-Z0-9-]/g, '_')}_${info.date.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
  return filename;
}
