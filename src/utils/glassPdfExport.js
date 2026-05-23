/**
 * glassPdfExport.js
 *
 * Generates professional A4-landscape PDF for glass factory orders.
 * Matches GlassDrawing2D component style but on white background.
 *
 * Layout per page:
 *   - Title block (header) with batch/project/date info
 *   - Summary table (page 1 only)
 *   - 6 glass drawings per page (3 cols × 2 rows)
 *   - Footer with company info + page number
 */
import { jsPDF } from 'jspdf';
import { CONSTANTS } from '../engine/calculations.js';

// ─── COLORS (RGB 0-255) ───
const C = {
  black:    [26, 26, 26],
  gray:     [136, 136, 136],
  grayL:    [180, 180, 180],
  grayXL:   [220, 220, 220],
  glass:    [0, 119, 187],
  glassFill:[232, 244, 252],
  dim:      [0, 137, 123],
  link:     [0, 85, 170],
  white:    [255, 255, 255],
};

// ─── PAGE DIMENSIONS (mm) ───
const PG = {
  w: 297, h: 210,
  mx: 10, my: 10,           // outer margins
  bx: 8, by: 8,             // border offset
  headerH: 40,
  footerH: 10,
  tableRowH: 4.5,
  cellW: 89,                // drawing cell width (3 per row with gaps)
  cellH: 80,                // drawing cell height (2 per column with gaps)
  cellGapX: 3,
  cellGapY: 3,
};

// ─── BAR PATTERNS (same as GlassDrawing2D) ───
const BAR_PATTERNS = {
  'none': { h: 0, v: 0 }, '2x2': { h: 0, v: 1 }, '3x3': { h: 0, v: 2 },
  '4x4': { h: 1, v: 1 }, '6x6': { h: 1, v: 2 }, '9x9': { h: 2, v: 2 },
};

const SPACER_BAR = 18;
const EDGE_SEAL = 11;

// ─── HELPERS ───

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function computeBarPositions(glassW, glassH, vCount, hCount) {
  const barW = SPACER_BAR;
  const paneW = vCount > 0 ? Math.max((glassW - vCount * barW) / (vCount + 1), 0) : glassW;
  const paneH = hCount > 0 ? Math.max((glassH - hCount * barW) / (hCount + 1), 0) : glassH;
  const vBars = [];
  for (let i = 0; i < vCount; i++) {
    const left = (i + 1) * paneW + i * barW;
    vBars.push({ left, right: left + barW, cx: left + barW / 2 });
  }
  const hBars = [];
  for (let j = 0; j < hCount; j++) {
    const top = (j + 1) * paneH + j * barW;
    hBars.push({ top, bot: top + barW, cy: top + barW / 2 });
  }
  return { vBars, hBars, paneW, paneH };
}

function segmentsBetween(from, to, cutPairs) {
  if (!cutPairs.length) return [{ a: from, b: to }];
  const sorted = [...cutPairs].sort((p, q) => p[0] - q[0]);
  const segs = [];
  let pos = from;
  for (const [cStart, cEnd] of sorted) {
    if (cStart > pos) segs.push({ a: pos, b: cStart });
    pos = Math.max(pos, cEnd);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

// ─── jsPDF DRAWING PRIMITIVES ───

function setColor(doc, rgb) {
  doc.setDrawColor(...rgb);
}
function setFill(doc, rgb) {
  doc.setFillColor(...rgb);
}
function setText(doc, rgb) {
  doc.setTextColor(...rgb);
}

function line(doc, x1, y1, x2, y2, w = 0.3) {
  doc.setLineWidth(w);
  doc.line(x1, y1, x2, y2);
}

function rect(doc, x, y, w, h, lw = 0.3) {
  doc.setLineWidth(lw);
  doc.rect(x, y, w, h);
}

function rectFill(doc, x, y, w, h) {
  doc.rect(x, y, w, h, 'F');
}

function text(doc, str, x, y, opts = {}) {
  doc.text(str, x, y, opts);
}

// ─── HEADER ───

function drawHeader(doc, info, pageNum, totalPages) {
  const { bx, by, w, headerH } = PG;
  const iw = w - 2 * bx;
  const ix = bx;
  const iy = by;

  // Outer border
  setColor(doc, C.black);
  rect(doc, bx, by, iw, headerH, 0.6);
  rect(doc, bx + 0.5, by + 0.5, iw - 1, headerH - 1, 0.1);

  // Company box
  line(doc, ix + 60, iy, ix + 60, iy + headerH, 0.2);
  line(doc, ix, iy + headerH / 2, ix + 60, iy + headerH / 2, 0.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, C.black);
  text(doc, info.companyName || 'COMPANY NAME', ix + 3, iy + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  setText(doc, C.gray);
  text(doc, 'GLASS ORDER — SEALED UNITS', ix + 3, iy + 14);

  // Batch / Projects box
  const batchX = ix + 60;
  const batchW = iw - 60 - 65;
  line(doc, batchX + batchW, iy, batchX + batchW, iy + headerH, 0.2);
  line(doc, batchX, iy + headerH / 2, batchX + batchW, iy + headerH / 2, 0.2);

  doc.setFontSize(5.5);
  setText(doc, C.gray);
  text(doc, 'Batch:', batchX + 3, iy + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, C.black);
  text(doc, info.batchName || '—', batchX + 18, iy + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  setText(doc, C.gray);
  text(doc, 'Projects:', batchX + 3, iy + headerH / 2 + 8);
  doc.setFontSize(6);
  setText(doc, C.black);
  const projText = (info.projects || []).join(' · ');
  text(doc, projText.substring(0, 80), batchX + 22, iy + headerH / 2 + 8);

  // Right info boxes
  const riX = batchX + batchW;
  const riW = 65;
  line(doc, riX, iy + headerH / 2, riX + riW, iy + headerH / 2, 0.2);
  line(doc, riX + riW / 2, iy, riX + riW / 2, iy + headerH, 0.2);

  doc.setFontSize(5);
  setText(doc, C.gray);
  text(doc, 'Date:', riX + 3, iy + 8);
  text(doc, 'Units:', riX + 3, iy + headerH / 2 + 8);
  text(doc, 'Rev:', riX + riW / 2 + 3, iy + 8);
  text(doc, 'Page:', riX + riW / 2 + 3, iy + headerH / 2 + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setText(doc, C.black);
  text(doc, info.date || new Date().toLocaleDateString('en-GB'), riX + 14, iy + 8);
  text(doc, String(info.totalUnits || 0), riX + 16, iy + headerH / 2 + 8);
  text(doc, info.revision || 'A', riX + riW / 2 + 12, iy + 8);
  text(doc, `${pageNum} / ${totalPages}`, riX + riW / 2 + 14, iy + headerH / 2 + 8);
}

// ─── SUMMARY TABLE ───

function drawSummaryTable(doc, glassItems, startY) {
  const x = PG.bx + 2;
  let y = startY;
  const rh = PG.tableRowH;

  // Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  setText(doc, C.gray);
  text(doc, 'SCHEDULE', x, y + 4);
  y += 7;

  // Column headers
  const cols = [
    { label: '#', x: 0, w: 6 },
    { label: 'Window', x: 8, w: 18 },
    { label: 'Sash', x: 28, w: 14 },
    { label: 'Width', x: 44, w: 18 },
    { label: 'Height', x: 64, w: 18 },
    { label: 'Type', x: 84, w: 16 },
    { label: 'Makeup', x: 102, w: 18 },
    { label: 'Spec', x: 122, w: 22 },
    { label: 'Finish', x: 146, w: 16 },
    { label: 'Spacer', x: 164, w: 14 },
    { label: 'Bars', x: 180, w: 14 },
    { label: 'Project', x: 196, w: 24 },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  setText(doc, C.grayL);
  cols.forEach(c => text(doc, c.label, x + c.x, y));

  // Header line
  setColor(doc, C.grayL);
  line(doc, x, y + 1, x + 220, y + 1, 0.2);
  y += rh;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);

  glassItems.forEach((g, i) => {
    const isEven = i % 2 === 0;
    if (isEven) {
      setFill(doc, [247, 247, 245]);
      rectFill(doc, x - 1, y - 3, 222, rh);
    }

    const color = i % 2 === 0 ? C.black : [85, 85, 85];
    setText(doc, color);
    text(doc, String(i + 1), x + 0, y);
    text(doc, g.windowName || '', x + 8, y);
    text(doc, g.sash || '', x + 28, y);

    doc.setFont('courier', 'normal');
    doc.setFontSize(4.5);
    text(doc, fmt(g.width), x + 44, y);
    text(doc, fmt(g.height), x + 64, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);

    text(doc, g.type || '', x + 84, y);
    text(doc, g.makeup || '', x + 102, y);
    text(doc, g.spec || '', x + 122, y);
    text(doc, g.finish || '', x + 146, y);
    text(doc, g.spacer || '', x + 164, y);
    text(doc, g.bars || '', x + 180, y);

    setText(doc, C.link);
    text(doc, g.projectNumber || '', x + 196, y);
    setText(doc, color);

    y += rh;
  });

  // Bottom line
  setColor(doc, C.grayL);
  line(doc, x, y - 2, x + 220, y - 2, 0.15);

  return y + 2;
}

// ─── SINGLE GLASS DRAWING ───

function drawGlassUnit(doc, cx, cy, cellW, cellH, g) {
  // Cell border (double line)
  setColor(doc, C.black);
  rect(doc, cx, cy, cellW, cellH, 0.35);
  rect(doc, cx + 0.3, cy + 0.3, cellW - 0.6, cellH - 0.6, 0.08);

  // Title bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  setText(doc, C.black);
  text(doc, `${g.index} · ${g.windowName} — ${g.sash.toUpperCase()} GLASS`, cx + 2, cy + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4);
  setText(doc, C.grayL);
  text(doc, g.projectNumber || '', cx + cellW - 2, cy + 4.5, { align: 'right' });

  setColor(doc, C.black);
  line(doc, cx + 0.3, cy + 6, cx + cellW - 0.3, cy + 6, 0.12);

  // Available drawing area
  const drawX = cx + 2;
  const drawY = cy + 8;
  const drawW = cellW - 4;
  const drawH = cellH - 18; // leave room for title (6) + spec text (8) + margins

  // Scale glass to fit
  const dimMarginL = 8;  // left for chain V
  const dimMarginT = 6;  // top for chain H
  const dimMarginR = 8;  // right for overall V
  const dimMarginB = 6;  // bottom for overall H

  const availW = drawW - dimMarginL - dimMarginR;
  const availH = drawH - dimMarginT - dimMarginB;

  const sc = Math.min(availW / g.glassW, availH / g.glassH);

  const gw = g.glassW * sc;
  const gh = g.glassH * sc;

  // Center the glass in available area
  const gx = drawX + dimMarginL + (availW - gw) / 2;
  const gy = drawY + dimMarginT + (availH - gh) / 2;

  // Glass fill
  setFill(doc, C.glassFill);
  setColor(doc, C.glass);
  doc.setLineWidth(0.5);
  doc.rect(gx, gy, gw, gh, 'FD');

  // Edge seal 11mm
  const es = EDGE_SEAL * sc;
  setColor(doc, C.glass);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([0.6, 0.4], 0);
  doc.rect(gx + es, gy + es, gw - 2 * es, gh - 2 * es);
  doc.setLineDashPattern([], 0);

  // Bar positions
  const pattern = BAR_PATTERNS[g.bars] || BAR_PATTERNS['none'];
  const bars = computeBarPositions(g.glassW, g.glassH, pattern.v, pattern.h);

  // Draw spacer bars — parallel lines with segment breaks
  setColor(doc, C.glass);
  doc.setLineWidth(0.2);

  // Vertical bars
  bars.vBars.forEach(vb => {
    const hCutPairs = bars.hBars.map(hb => [hb.top * sc, hb.bot * sc]);
    const segs = segmentsBetween(0, gh, hCutPairs);
    segs.forEach(seg => {
      line(doc, gx + vb.left * sc, gy + seg.a, gx + vb.left * sc, gy + seg.b, 0.2);
      line(doc, gx + vb.right * sc, gy + seg.a, gx + vb.right * sc, gy + seg.b, 0.2);
    });
  });

  // Horizontal bars
  bars.hBars.forEach(hb => {
    const vCutPairs = bars.vBars.map(vb => [vb.left * sc, vb.right * sc]);
    const segs = segmentsBetween(0, gw, vCutPairs);
    segs.forEach(seg => {
      line(doc, gx + seg.a, gy + hb.top * sc, gx + seg.b, gy + hb.top * sc, 0.2);
      line(doc, gx + seg.a, gy + hb.bot * sc, gx + seg.b, gy + hb.bot * sc, 0.2);
    });
  });

  // Crosses at intersections
  bars.vBars.forEach(vb => {
    bars.hBars.forEach(hb => {
      line(doc, gx + vb.left * sc, gy + hb.top * sc, gx + vb.right * sc, gy + hb.bot * sc, 0.15);
      line(doc, gx + vb.right * sc, gy + hb.top * sc, gx + vb.left * sc, gy + hb.bot * sc, 0.15);
    });
  });

  // ── CHAIN DIMENSIONS (top) ──
  const chainY = gy - 3;
  const hCuts = [0, EDGE_SEAL];
  bars.vBars.forEach(b => { hCuts.push(b.left); hCuts.push(b.right); });
  hCuts.push(g.glassW - EDGE_SEAL, g.glassW);

  setColor(doc, C.dim);
  doc.setLineWidth(0.15);

  // Chain line
  line(doc, gx, chainY, gx + gw, chainY, 0.18);

  // Ticks + labels
  hCuts.forEach(cut => {
    const px = gx + cut * sc;
    line(doc, px, chainY - 1, px, chainY + 1, 0.18);
    // Extension line to glass
    doc.setLineDashPattern([0.5, 0.5], 0);
    line(doc, px, chainY + 1, px, gy, 0.08);
    doc.setLineDashPattern([], 0);
  });

  doc.setFont('courier', 'normal');
  doc.setFontSize(3.2);
  setText(doc, C.dim);
  for (let i = 0; i < hCuts.length - 1; i++) {
    const segW = hCuts[i + 1] - hCuts[i];
    const midX = gx + (hCuts[i] + hCuts[i + 1]) / 2 * sc;
    text(doc, fmt(segW), midX, chainY - 1.5, { align: 'center' });
  }

  // ── CHAIN DIMENSIONS (left) ──
  const chainX = gx - 3;
  const vCuts = [0, EDGE_SEAL];
  bars.hBars.forEach(b => { vCuts.push(b.top); vCuts.push(b.bot); });
  vCuts.push(g.glassH - EDGE_SEAL, g.glassH);

  // Chain line
  line(doc, chainX, gy, chainX, gy + gh, 0.18);

  // Ticks + labels
  vCuts.forEach(cut => {
    const py = gy + cut * sc;
    line(doc, chainX - 1, py, chainX + 1, py, 0.18);
    doc.setLineDashPattern([0.5, 0.5], 0);
    line(doc, chainX + 1, py, gx, py, 0.08);
    doc.setLineDashPattern([], 0);
  });

  for (let i = 0; i < vCuts.length - 1; i++) {
    const segH = vCuts[i + 1] - vCuts[i];
    const midY = gy + (vCuts[i] + vCuts[i + 1]) / 2 * sc;
    // Rotated text for vertical chain
    doc.saveGraphicsState();
    text(doc, fmt(segH), chainX - 1.5, midY, { angle: 90, align: 'center' });
    doc.restoreGraphicsState();
  }

  // ── OVERALL WIDTH (bottom) ──
  const owY = gy + gh + 3;
  line(doc, gx, owY, gx + gw, owY, 0.25);
  line(doc, gx, owY - 1, gx, owY + 1, 0.25);
  line(doc, gx + gw, owY - 1, gx + gw, owY + 1, 0.25);
  doc.setFont('courier', 'bold');
  doc.setFontSize(4);
  text(doc, `${fmt(g.glassW)} mm`, gx + gw / 2, owY + 3.5, { align: 'center' });

  // ── OVERALL HEIGHT (right) ──
  const ohX = gx + gw + 3;
  line(doc, ohX, gy, ohX, gy + gh, 0.25);
  line(doc, ohX - 1, gy, ohX + 1, gy, 0.25);
  line(doc, ohX - 1, gy + gh, ohX + 1, gy + gh, 0.25);
  doc.saveGraphicsState();
  text(doc, `${fmt(g.glassH)} mm`, ohX + 3.5, gy + gh / 2, { angle: 90, align: 'center' });
  doc.restoreGraphicsState();

  // ── TITLE + SPEC (bottom of cell) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  setText(doc, C.black);
  text(doc, `${g.sash.toUpperCase()} GLASS`, cx + cellW / 2, cy + cellH - 6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  setText(doc, C.glass);
  const specLine = `${g.type} / ${g.finish} · spacer: ${g.spacer}`;
  text(doc, specLine, cx + cellW / 2, cy + cellH - 2.5, { align: 'center' });
}

// ─── FOOTER ───

function drawFooter(doc, info, pageNum, totalPages) {
  const y = PG.h - PG.by - 2;

  setColor(doc, C.black);
  line(doc, PG.bx, y - 3, PG.w - PG.bx, y - 3, 0.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  setText(doc, C.grayL);
  const footerText = [info.companyName, info.companyAddress, info.companyPhone, info.companyEmail]
    .filter(Boolean).join(' · ');
  text(doc, footerText, PG.bx + 4, y);

  doc.setFont('courier', 'bold');
  doc.setFontSize(5);
  setText(doc, C.black);
  text(doc, `${pageNum} / ${totalPages}`, PG.w - PG.bx - 4, y, { align: 'right' });
}

// ─── OUTER BORDER (per page) ───

function drawPageBorder(doc) {
  setColor(doc, C.black);
  rect(doc, PG.bx, PG.by, PG.w - 2 * PG.bx, PG.h - 2 * PG.by, 0.6);
  rect(doc, PG.bx + 0.5, PG.by + 0.5, PG.w - 2 * PG.bx - 1, PG.h - 2 * PG.by - 1, 0.1);
}

// ─── MAIN EXPORT FUNCTION ───

export function exportGlassPDF({ batch, windowsData, projects = [], companySettings = {} }) {
  // Build glass items list (same logic as buildGlassListForWindow but with extra info)
  const glassItems = [];
  let idx = 1;

  windowsData.forEach(({ win, windowSpec, derived }) => {
    if (!derived || !windowSpec) return;
    const sw = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;
    if (!sw || !topH || !botH) return;

    const glassW = sw - CONSTANTS.GLASS_WIDTH_DEDUCTION;
    const glassHupper = topH - CONSTANTS.GLASS_HEIGHT_DEDUCTION;
    const lowerDed = CONSTANTS.MEETING_RAIL_WIDTH + CONSTANTS.BOTTOM_RAIL_WIDTH - 2 * 12.5;
    const glassHlower = botH - lowerDed;

    const glassType = windowSpec?.glazing?.type || 'double';
    const glassSpec = windowSpec?.glazing?.spec || 'toughened';
    const spacer = windowSpec?.glazing?.spacerColour || 'silver';
    const makeup = windowSpec?.glazing?.makeup || '4x16x4';
    const isFrosted = windowSpec?.glazing?.finish === 'frosted';
    const frostedLoc = windowSpec?.glazing?.frostedLocation || 'bottom';
    const gridMode = windowSpec?.sash?.grid?.mode || 'none';

    const upperFinish = isFrosted && frostedLoc === 'both' ? 'frosted' : 'clear';
    const lowerFinish = isFrosted ? 'frosted' : 'clear';

    const base = {
      windowName: win.name,
      projectNumber: win._projectNumber || '',
      type: glassType, spec: glassSpec, spacer, makeup, bars: gridMode,
    };

    glassItems.push({
      ...base, index: idx++, sash: 'Upper', glassW, glassH: glassHupper, finish: upperFinish,
    });
    glassItems.push({
      ...base, index: idx++, sash: 'Lower', glassW, glassH: glassHlower, finish: lowerFinish,
    });
  });

  if (!glassItems.length) return null;

  // Calculate pages
  const DRAWINGS_PER_PAGE = 6;
  const tableRows = glassItems.length;
  const drawingPages = Math.ceil(glassItems.length / DRAWINGS_PER_PAGE);
  const totalPages = 1 + drawingPages; // page 1 = table, rest = drawings
  // Actually, if few items, table + drawings fit on page 1
  // Simplified: page 1 = header + table + first 6 drawings (if table is short)
  // For now: page 1 = table only if >12 items, otherwise table + drawings page 1

  const tableOnlyPage = tableRows > 18; // if more than 18 rows, dedicate page 1 to table
  const totalPgs = tableOnlyPage
    ? 1 + Math.ceil(glassItems.length / DRAWINGS_PER_PAGE)
    : Math.ceil(glassItems.length / DRAWINGS_PER_PAGE) || 1;

  // Info object
  const info = {
    companyName: companySettings.companyName || 'COMPANY NAME',
    companyAddress: companySettings.companyAddress || '',
    companyPhone: companySettings.companyPhone || '',
    companyEmail: companySettings.companyEmail || '',
    batchName: batch?.name || batch?.id || 'Batch',
    projects: projects.map(p => `${p.number || p.id} (${p.name || ''})`).filter(Boolean),
    date: new Date().toLocaleDateString('en-GB'),
    totalUnits: glassItems.length,
    revision: 'A',
  };

  // Create PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let pageNum = 1;
  let drawingIdx = 0;

  if (tableOnlyPage) {
    // Page 1: header + full table
    drawPageBorder(doc);
    drawHeader(doc, info, pageNum, totalPgs);
    const separatorY = PG.by + PG.headerH;
    setColor(doc, C.black);
    line(doc, PG.bx, separatorY, PG.w - PG.bx, separatorY, 0.3);
    drawSummaryTable(doc, glassItems, separatorY + 1);
    drawFooter(doc, info, pageNum, totalPgs);
    pageNum++;
  }

  // Drawing pages
  while (drawingIdx < glassItems.length) {
    if (pageNum > 1 || tableOnlyPage) doc.addPage();

    drawPageBorder(doc);
    drawHeader(doc, info, pageNum, totalPgs);

    let contentY = PG.by + PG.headerH;
    setColor(doc, C.black);
    line(doc, PG.bx, contentY, PG.w - PG.bx, contentY, 0.3);

    // If first page and not table-only, draw compact table
    if (pageNum === 1 && !tableOnlyPage) {
      contentY = drawSummaryTable(doc, glassItems, contentY + 1);
      setColor(doc, C.black);
      line(doc, PG.bx, contentY, PG.w - PG.bx, contentY, 0.2);
      contentY += 1;
    } else {
      contentY += 2;
    }

    // Calculate drawing grid for this page
    const remainingH = PG.h - PG.by - PG.footerH - contentY - 4;
    const cellH = (remainingH - PG.cellGapY) / 2;
    const cellW = (PG.w - 2 * PG.bx - 4 - 2 * PG.cellGapX) / 3;

    for (let row = 0; row < 2 && drawingIdx < glassItems.length; row++) {
      for (let col = 0; col < 3 && drawingIdx < glassItems.length; col++) {
        const cellX = PG.bx + 2 + col * (cellW + PG.cellGapX);
        const cellY = contentY + row * (cellH + PG.cellGapY);

        drawGlassUnit(doc, cellX, cellY, cellW, cellH, glassItems[drawingIdx]);
        drawingIdx++;
      }
    }

    drawFooter(doc, info, pageNum, totalPgs);
    pageNum++;
  }

  // Save
  const filename = `Glass_Order_${info.batchName.replace(/[^a-zA-Z0-9-]/g, '_')}_${info.date.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
  return filename;
}
