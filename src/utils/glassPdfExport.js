/**
 * glassPdfExport.js
 *
 * Professional A4-landscape PDF for glass factory orders.
 * Navy (#1a3a5c) glass lines, teal (#00897B) dimensions.
 *
 * Page 1: compact header + full summary table
 * Page 2+: compact header + 6 CAD drawings per page (3×2)
 *
 * Shaped units (arched casement, arched-casement-v2 C): the schedule gains a
 * Shape column (`arched · R …` with a tiny outline glyph, `rect` otherwise)
 * and, per shaped row, a second line with the bar positions in mm AND in % of
 * the clear width / height (P6); the drawing cell draws the true outline
 * (exact arcs as cubic Béziers) and the bar axes from the engine's bar list.
 * Rectangular units are unchanged.
 *
 * ARCHED-WINDOWS-v4 Block B (Piotr 06.09, SS2): the per-unit bar table next to
 * the drawing made the drawing unreadable. A shaped drawing cell now holds the
 * drawing at the largest scale the cell allows, the title + spec lines UNDER
 * it, the bar-spacing chain at the BOTTOM and the overall width at the TOP
 * (as the on-screen glass sheet); the bars carry their ids only. The numbers
 * (ID · s from apex / position · L · angle / R) move to BARS PAGES at the end
 * of the document — one block per shaped unit with bars: a thumbnail of the
 * WINDOW elevation (~35 mm), the window name + unit id, the table; blocks
 * stack, a page breaks between blocks, never inside a table. A3 / A4 follow
 * the pack's export setting (`format`).
 */
import { jsPDF } from 'jspdf';
import { buildGlassListForWindow } from '../engine/lists.js';
import { computeGlassBarPositions } from '../components/drawings/drawingUtils.jsx';
import { chainYAtX } from '../engine/arch.js';
import { getCasementProfile } from '../engine/profile.js';
import { readGlassProfile, barBandCurves, glassEdgeArcs, barEndRows, useBarTable } from '../engine/glassBars.js';

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

// ─── PAGE ─── (v4: A4 landscape by default, A3 landscape on the pack's export setting)
const PAGE_SIZES = { a4: { w: 297, h: 210 }, a3: { w: 420, h: 297 } };
const PG = { w: 297, h: 210, bx: 8, by: 8 };
function setPageFormat(format) {
  const size = PAGE_SIZES[String(format || 'a4').toLowerCase()] || PAGE_SIZES.a4;
  PG.w = size.w; PG.h = size.h;
  return PAGE_SIZES[String(format || 'a4').toLowerCase()] ? String(format).toLowerCase() : 'a4';
}
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

// ─── SUMMARY TABLE COLUMN OFFSETS (mm from table x) ───
const COL = {
  no: 0, window: 8, sash: 30, width: 54, height: 76, shape: 98, type: 124,
  makeup: 146, spec: 170, coating: 194, gas: 214, finish: 228,
  spacer: 244, bars: 266,
};
const SHAPE_ICON = { w: 6, h: 4.5 };       // outline glyph in the Shape column (mm)
const SHAPE_LINE_H = 3.2;                  // extra table line for the bar positions of a shaped unit
const PATTERN_SHORT = { 'half-hub': 'half hub', 'hub-spoke': 'hub', 'double-hub-spoke': 'dbl hub', 'triple-hub-spoke': 'tpl hub', 'intersecting': 'intersect' };

// Label helpers — mirror the on-screen Glass Schedule wording.
const coatingLabel = (c) => (c === 'soft_coat' ? 'Soft Coat' : 'Standard');
const gasLabel = (g) => (g ? String(g).charAt(0).toUpperCase() + String(g).slice(1) : '—');
const spacerTypeLabel = (t) => (t === 'alu' ? 'alu' : 'warm');
const spacerLabel = (g) => `${g.spacer || '—'} · ${spacerTypeLabel(g.spacerType)}`;

// ─── SHAPED UNITS (arched casement) ───
const pct = (v, base) => (base > 0 ? `${Math.round((v / base) * 100)}%` : '—');
const DEG = 180 / Math.PI;

/** `arched · R 55.5/1305.5/55.5` — the GLASS radii (what the glazier cuts), or `rect`. */
function shapeLabel(shape) {
  if (!shape) return 'rect';
  const radii = [...new Set((shape.radii || []).map((r) => fmt(r)))];
  return `arched · R ${radii.length ? radii.join('/') : '?'}`;
}

/**
 * Bar positions of a shaped unit in mm and in % of the clear width (x) /
 * clear height (y, unit bottom → apex) — P6, one line for the schedule.
 */
function shapeBarText(shape) {
  const H = shape.outline?.height || 0;
  const parts = [`springing ${fmt(shape.springing)} (${pct(shape.springing, H)})`];
  const bars = shape.bars || [];
  // v3 0.3: the bar-end dimensioning rows (glassBars.js) — the same numbers as
  // the sheet and the DXF; with more than 4 bars the rows go in the table
  // under the drawing and the header only counts them.
  if (useBarTable(bars)) parts.push(`${bars.length} bars — see table`);
  else for (const r of barEndRows(bars, shape.outline)) parts.push(r.label);
  return parts.join(' · ');
}
void DEG;

/** Cubic Bézier segments (≤ 90° each) of a counter-clockwise arc, unit frame (y up). */
function arcBeziers(a) {
  const span = a.a1 - a.a0;
  const n = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 2) - 1e-9));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = a.a0 + span * i / n, t1 = a.a0 + span * (i + 1) / n;
    const k = (4 / 3) * Math.tan((t1 - t0) / 4);
    const p0 = [a.cx + a.r * Math.cos(t0), a.cy + a.r * Math.sin(t0)];
    const p3 = [a.cx + a.r * Math.cos(t1), a.cy + a.r * Math.sin(t1)];
    const c1 = [p0[0] - k * a.r * Math.sin(t0), p0[1] + k * a.r * Math.cos(t0)];
    const c2 = [p3[0] + k * a.r * Math.sin(t1), p3[1] - k * a.r * Math.cos(t1)];
    out.push({ p0, c1, c2, p3 });
  }
  return out;
}

/**
 * jsPDF `lines()` path of the outline: relative vectors from the unit's
 * bottom-left corner, unit frame scaled by `sc`, PDF y down.
 */
function outlineLines(outline, sc) {
  let cur = [0, 0];
  const lines = [];
  const to = (x, y) => { const px = x * sc, py = -y * sc; lines.push([px - cur[0], py - cur[1]]); cur = [px, py]; };
  const bez = (c1, c2, p) => {
    lines.push([c1[0] * sc - cur[0], -c1[1] * sc - cur[1], c2[0] * sc - cur[0], -c2[1] * sc - cur[1], p[0] * sc - cur[0], -p[1] * sc - cur[1]]);
    cur = [p[0] * sc, -p[1] * sc];
  };
  if (outline.kind === 'circle') {
    // circle (v3 Block 3): start at the right end of the horizontal diameter, no straight edge
    to(outline.width, outline.springing);
    for (const a of outline.arcs) for (const seg of arcBeziers(a)) bez(seg.c1, seg.c2, seg.p3);
    return lines;
  }
  to(outline.width, 0);
  to(outline.width, outline.springing);
  for (const a of outline.arcs) for (const seg of arcBeziers(a)) bez(seg.c1, seg.c2, seg.p3);
  return lines;   // closed by jsPDF back to (0, 0)
}

/** Stroke one bar axis (straight or arc) inside a drawing placed with its unit origin at (ox, oyBottom). */
function drawBarAxis(doc, b, ox, oyBottom, sc) {
  if (b.kind === 'arc') {
    const segs = arcBeziers(b.arc);
    const p0 = segs[0].p0;
    let cur = [p0[0] * sc, -p0[1] * sc];
    const lines = segs.map((sg) => {
      const l = [sg.c1[0] * sc - cur[0], -sg.c1[1] * sc - cur[1], sg.c2[0] * sc - cur[0], -sg.c2[1] * sc - cur[1], sg.p3[0] * sc - cur[0], -sg.p3[1] * sc - cur[1]];
      cur = [sg.p3[0] * sc, -sg.p3[1] * sc];
      return l;
    });
    doc.lines(lines, ox + p0[0] * sc, oyBottom - p0[1] * sc, [1, 1], 'S', false);
  } else {
    doc.line(ox + b.from[0] * sc, oyBottom - b.from[1] * sc, ox + b.to[0] * sc, oyBottom - b.to[1] * sc);
  }
}

/** Tiny outline glyph for the Shape column. */
function drawShapeIcon(doc, shape, x, yTop, w, h) {
  const o = shape.outline;
  if (!o?.width || !o?.height) return;
  const sc = Math.min(w / o.width, h / o.height);
  const gw = o.width * sc, gh = o.height * sc;
  const ox = x + (w - gw) / 2, oyBottom = yTop + (h - gh) / 2 + gh;
  dc(doc, C.glass);
  fc(doc, C.glassFill);
  doc.setLineWidth(LW.seal);
  doc.lines(outlineLines(o, sc), ox, oyBottom, [1, 1], 'FD', true);
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

// ─── GLASS REFERENCE THUMBNAILS ───
// Fetch up to three tenant reference images (settings.glassReferences,
// Supabase URLs) as data URLs so they embed physically in the PDF header.
// Never throws — a failed fetch just drops that thumbnail.
export async function prepGlassRefImages(refs, max = 3) {
  const out = [];
  for (const r of (refs || []).slice(0, max)) {
    if (!r?.url) continue;
    try {
      const blob = await (await fetch(r.url)).blob();
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      const dims = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => res({ w: 1, h: 1 });
        im.src = dataUrl;
      });
      out.push({ dataUrl, ...dims });
    } catch { /* skip */ }
  }
  return out;
}

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
  const projStr = (info.projects || []).join(' · ') || '—';
  doc.text(projStr.substring(0, 90), x + col1 + 22, y + h / 2 + 7);

  // Tenant glass-reference thumbnails (settings, Supabase) — fill the empty
  // band between the Batch block and the Date/Units boxes (Piotr 02.08).
  const refs = Array.isArray(info.refImages) ? info.refImages : [];
  if (refs.length) {
    const imH = h - 4;
    let ix = x + col2 - 4;
    for (let i = Math.min(refs.length, 3) - 1; i >= 0; i--) {
      const r = refs[i];
      if (!r?.dataUrl) continue;
      const ar = r.w > 0 && r.h > 0 ? r.w / r.h : 1;
      const iw = Math.min(imH * ar, 34);
      ix -= iw + 3;
      try {
        doc.addImage(r.dataUrl, 'JPEG', ix, y + 2, iw, imH);
        doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15);
        doc.rect(ix, y + 2, iw, imH);
      } catch { /* bad image — skip, never break the export */ }
    }
  }

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
    { l: '#',          dx: COL.no },
    { l: 'Window',     dx: COL.window },
    { l: 'Sash',       dx: COL.sash },
    { l: 'Width (mm)', dx: COL.width },
    { l: 'Height (mm)',dx: COL.height },
    { l: 'Shape',      dx: COL.shape },
    { l: 'Type',       dx: COL.type },
    { l: 'Makeup',     dx: COL.makeup },
    { l: 'Spec',       dx: COL.spec },
    { l: 'Coating',    dx: COL.coating },
    { l: 'Gas',        dx: COL.gas },
    { l: 'Finish',     dx: COL.finish },
    { l: 'Spacer',     dx: COL.spacer },
    { l: 'Bars',       dx: COL.bars },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  tc(doc, C.black);
  cols.forEach(c => doc.text(c.l, x + c.dx, y));

  dc(doc, C.grayL);
  doc.setLineWidth(LW.tableLine);
  doc.line(x, y + 1.5, x + 270, y + 1.5);
  y += TABLE_ROW_H;

  // Rows — a shaped unit takes extra lines for its bar positions (mm + %)
  items.forEach((g, i) => {
    const extra = g.shape ? doc.splitTextToSize(shapeBarText(g.shape), 262) : [];
    const rowH = TABLE_ROW_H + extra.length * SHAPE_LINE_H;
    if (i % 2 === 0) {
      fc(doc, C.rowBg);
      doc.rect(x - 1, y - 3.5, 272, rowH, 'F');
    }

    // Solid black on every row (Piotr 02.08 — the alternating C.dark read
    // pale on print; zebra fill alone separates the rows).
    tc(doc, C.black);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(i + 1), x + 0, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(g.windowName || '', x + COL.window, y);
    doc.text(g.sash || '', x + COL.sash, y);

    doc.setFont('courier', 'normal');
    doc.text(fmt(g.glassW), x + COL.width, y);
    doc.text(fmt(g.glassH), x + COL.height, y);

    doc.setFont('helvetica', 'normal');
    // Shape: glyph + `arched · R …` (5.5pt to fit) or `rect`
    if (g.shape) {
      drawShapeIcon(doc, g.shape, x + COL.shape, y - 3.4, SHAPE_ICON.w, SHAPE_ICON.h);
      tc(doc, C.black);
      doc.setFontSize(5.5);
      doc.text(shapeLabel(g.shape), x + COL.shape + SHAPE_ICON.w + 1, y);
      doc.setFontSize(6.5);
    } else {
      doc.text('rect', x + COL.shape, y);
    }
    doc.text(g.type || '', x + COL.type, y);
    doc.text(g.makeup || '—', x + COL.makeup, y);
    doc.text(g.spec || '', x + COL.spec, y);
    doc.text(coatingLabel(g.coating), x + COL.coating, y);
    doc.text(gasLabel(g.gas), x + COL.gas, y);
    doc.text(g.finish || '', x + COL.finish, y);
    doc.setFontSize(5.5);
    doc.text(spacerLabel(g), x + COL.spacer, y);
    // Bars: compact form in the TABLE ("2H×1V geo") so it clears the Spacer
    // column; the full wording travels on the drawing spec line (Piotr 02.08).
    doc.setFontSize(5.5);
    let barsCell = String(g.bars || 'none')
      .replace(/\s*×\s*/g, '×')
      .replace('georgian', 'geo')
      .replace('astragal', 'ast');
    for (const [long, short] of Object.entries(PATTERN_SHORT)) barsCell = barsCell.replace(long, short);
    doc.text(barsCell, x + 269, y, { align: 'right' });
    doc.setFontSize(6.5);

    // Shaped unit: bar positions in mm and % of the clear width / height (P6)
    if (extra.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      tc(doc, C.dark);
      extra.forEach((line, k) => doc.text(line, x + COL.window, y + SHAPE_LINE_H * (k + 1)));
      doc.setFontSize(6.5);
      tc(doc, C.black);
    }

    y += rowH;
  });

  return y;
}

// ─── SINGLE GLASS DRAWING ───

const cellTitle = (g) => `${g.index} · ${g.windowName} — ${String(g.sash || '').toUpperCase()} GLASS`;
const cellSpec = (g) => [
  `${g.type}${g.makeup ? ' ' + g.makeup : ''}`,
  g.spec,
  coatingLabel(g.coating),
  gasLabel(g.gas),
  g.finish,
  `spacer: ${g.spacer} (${g.spacerType === 'alu' ? 'aluminium' : 'warm edge'})`,
  g.bars && g.bars !== 'none' ? `bars: ${g.bars}` : '',
].filter(Boolean).join(' · ');

function drawGlass(doc, cx, cy, cw, ch, g) {
  // Cell double border
  dc(doc, C.black);
  doc.setLineWidth(LW.cell);
  doc.rect(cx, cy, cw, ch);
  doc.setLineWidth(LW.cellIn);
  doc.rect(cx + 0.3, cy + 0.3, cw - 0.6, ch - 0.6);

  // Shaped unit (arched casement / sash / circle): v4 cell — drawing first, title + spec under it
  if (g.shape) { drawShapedGlass(doc, cx, cy, cw, ch, g); return; }

  // Title bar — left: name, right: spec (same size)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  tc(doc, C.black);
  doc.text(cellTitle(g), cx + 2, cy + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  tc(doc, C.glass);
  doc.text(cellSpec(g), cx + cw - 2, cy + 4, { align: 'right' });
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

  // Frosted hatch — fine 45° diagonal lines inside edge seal (subtle)
  if (g.finish === 'frosted') {
    const fx = gx + es, fy = gy + es;
    const fw = gw - 2 * es, fh = gh - 2 * es;
    const step = 4;
    dc(doc, C.glass);
    doc.setLineWidth(LW.seal * 0.6);
    const hasGS = doc.saveGraphicsState && doc.GState;
    if (hasGS) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.35 }));
    }
    // 45° lines: y = x + c. Clip each line to the [fx, fx+fw] x [fy, fy+fh] box.
    for (let c = fy - (fx + fw); c <= fy + fh - fx; c += step) {
      // line: y = (x - fx) + (fx + c)  →  points where it enters/exits the box
      let xA = fx, yA = (xA - fx) + (fx + c);
      let xB = fx + fw, yB = (xB - fx) + (fx + c);
      // clamp to vertical bounds
      if (yA < fy) { yA = fy; xA = fx + (yA - (fx + c)); }
      if (yA > fy + fh) { yA = fy + fh; xA = fx + (yA - (fx + c)); }
      if (yB < fy) { yB = fy; xB = fx + (yB - (fx + c)); }
      if (yB > fy + fh) { yB = fy + fh; xB = fx + (yB - (fx + c)); }
      if (xA >= fx && xA <= fx + fw && xB >= fx && xB <= fx + fw && xB > xA) {
        doc.line(xA, yA, xB, yB);
      }
    }
    if (hasGS) doc.restoreGraphicsState();
  }

  // Bars — two sources, one drawing path:
  //  · casement/triple rows carry engine counts (barsV/barsH) → equal splits
  //    across the GLASS with an 18mm duplex spacer at each bar centre (matches
  //    CasementGlassDrawing2D). Piotr 02.08 — the sketch used to draw plain.
  //  · double-hung rows keep the sash-frame placement (BAR_PATTERNS + faces).
  const cbV = Number(g.barsV) || 0;
  const cbH = Number(g.barsH) || 0;
  let bars;
  if (cbV > 0 || cbH > 0) {
    const BW = 18; // duplex spacer bar width (mm) — same as the factory drawing
    bars = {
      vBars: Array.from({ length: cbV }, (_, i) => {
        const c = g.glassW * (i + 1) / (cbV + 1);
        return { left: c - BW / 2, right: c + BW / 2 };
      }),
      hBars: Array.from({ length: cbH }, (_, i) => {
        const c = g.glassH * (i + 1) / (cbH + 1);
        return { top: c - BW / 2, bot: c + BW / 2 };
      }),
    };
  } else {
    const pat = BAR_PATTERNS[g.bars] || BAR_PATTERNS['none'];
    const canDrawBars = (pat.v > 0 || pat.h > 0) && g.sashW > 0 && g.sashH > 0;
    bars = canDrawBars
      ? computeGlassBarPositions({
          sashW: g.sashW, sashH: g.sashH, isUpper: !!g.isUpper,
          vCount: pat.v, hCount: pat.h, faces: g.faces,
        })
      : { vBars: [], hBars: [] };
  }

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

// ─── SHAPED GLASS DRAWING (arched casement / sash upper unit / circle) — v4 Block B ───
// The drawing fills the cell at the largest scale its dimensions allow; the
// title line and the spec line sit UNDER it; the bar-spacing chain (vertical
// bar / mullion x positions) runs along the BOTTOM edge, the overall width
// along the TOP; the left chain carries the h bars / springing / apex and the
// right edge the overall height + rise. Bars show their ids only — the
// numbers are on the bars pages. Bands (spacer width), edge line and axes as
// in v3 (the DXF geometry).
const SHAPED_CELL = {
  titleH: 3.4,        // title line band (5 pt)
  specLineH: 2.8,     // spec line pitch (4.5 pt)
  bandPad: 1.4,
  margin: { l: 9, t: 8, r: 9, b: 8 },   // room for the dimensions around the outline
};

/** Spec line of a shaped cell: the unit spec + the shape (radii, rise, springing). */
function shapedSpec(g) {
  const shape = g.shape;
  const radii = [...new Set((shape.radii || []).map((r) => fmt(r)))];
  const shapeTxt = shape.outline?.kind === 'circle'
    ? `circle · R ${radii.join('/')}`
    : `arched · R ${radii.join('/')} · rise ${fmt(shape.rise)} · springing ${fmt(shape.springing)}`;
  return `${cellSpec(g)} · ${shapeTxt}`;
}

function drawShapedGlass(doc, cx, cy, cw, ch, g) {
  const shape = g.shape;
  const o = shape.outline;
  const bars = shape.bars || [];
  const S = SHAPED_CELL;
  // ── bottom band: title + spec (wrapped to the cell width, at most 2 lines) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  const specLines = doc.splitTextToSize(shapedSpec(g), cw - 4).slice(0, 2);
  const bandH = S.bandPad + S.titleH + specLines.length * S.specLineH + S.bandPad;
  const bandTop = cy + ch - bandH;
  dc(doc, C.black);
  doc.setLineWidth(LW.cellIn);
  doc.line(cx + 0.3, bandTop, cx + cw - 0.3, bandTop);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  tc(doc, C.black);
  doc.text(cellTitle(g), cx + 2, bandTop + S.bandPad + 2.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  tc(doc, C.glass);
  specLines.forEach((l, i) => doc.text(l, cx + 2, bandTop + S.bandPad + S.titleH + 2.2 + i * S.specLineH));

  // ── drawing area: everything above the band, dimensions in the margins ──
  const areaX = cx + 2, areaY = cy + 2, areaW = cw - 4, areaH = bandTop - cy - 3;
  const availW = areaW - S.margin.l - S.margin.r;
  const availH = areaH - S.margin.t - S.margin.b;
  const sc = Math.min(availW / o.width, availH / o.height);
  const gw = o.width * sc, gh = o.height * sc;
  const gx = areaX + S.margin.l + (availW - gw) / 2;
  const gy = areaY + S.margin.t + (availH - gh) / 2;
  const oyBottom = gy + gh;

  // Outline (fill + stroke)
  fc(doc, C.glassFill);
  dc(doc, C.glass);
  doc.setLineWidth(LW.outline);
  doc.lines(outlineLines(o, sc), gx, oyBottom, [1, 1], 'FD', true);

  // v3 0.2: edge cover line (profile glass.edgeCover per glass type) + spacer bands (glass.barWidth) — the DXF geometry
  const G = readGlassProfile(getCasementProfile(), g.type || 'double');
  dc(doc, C.glass);
  doc.setLineWidth(LW.seal);
  doc.setLineDashPattern([0.8, 0.5], 0);
  const edgeArcs = glassEdgeArcs(o, G.edgeCover);
  const edgeOutline = { kind: o.kind, width: o.width - 2 * G.edgeCover, springing: o.springing - G.edgeCover, arcs: edgeArcs.map((a) => ({ ...a, cx: a.cx - G.edgeCover, cy: a.cy - G.edgeCover })) };
  doc.lines(outlineLines(edgeOutline, sc), gx + G.edgeCover * sc, oyBottom - G.edgeCover * sc, [1, 1], 'S', true);
  doc.setLineDashPattern([], 0);
  for (const b of bars) for (const c of barBandCurves(b, G.barWidth / 2)) drawBarAxis(doc, c.kind === 'arc' ? { kind: 'arc', arc: c.arc } : { kind: 'straight', from: c.from, to: c.to }, gx, oyBottom, sc);
  // Bar axes
  dc(doc, C.dim);
  doc.setLineWidth(LW.ext);
  doc.setLineDashPattern([0.5, 0.4], 0);
  for (const b of bars) drawBarAxis(doc, b, gx, oyBottom, sc);
  doc.setLineDashPattern([], 0);
  // ids only, beside the end that lies on the arch (the numbers are on the bars pages)
  doc.setFont('courier', 'bold');
  doc.setFontSize(4.5);
  tc(doc, C.dim);
  for (const b of bars) {
    const end = b.kind === 'arc' ? (b.role === 'ring' ? [b.arc.cx, b.arc.cy + b.arc.r] : [b.to, b.from].find((e) => e[1] > o.springing + 0.01) || b.to) : (b.to[1] >= b.from[1] ? b.to : b.from);
    doc.text(b.id, gx + end[0] * sc + 0.6, oyBottom - end[1] * sc + 1.6);
  }

  const isCircle = o.kind === 'circle';
  // ── CHAIN H (BOTTOM): vertical bar / mullion x positions from the bottom-left corner ──
  const xs = [...new Set(bars.filter((b) => b.kind === 'straight' && Math.abs(b.to[0] - b.from[0]) < 1e-6).map((b) => Math.round(b.from[0] * 10) / 10))].sort((a, b) => a - b);
  const hCuts = [0, ...xs.filter((v) => v > 0 && v < o.width), o.width];
  const chainY = oyBottom + 4;
  dc(doc, C.dim);
  doc.setLineWidth(LW.dimLine);
  doc.line(gx, chainY, gx + gw, chainY);
  hCuts.forEach((cut) => {
    const px = gx + cut * sc;
    doc.setLineWidth(LW.tick);
    doc.line(px, chainY - 1.2, px, chainY + 1.2);
    doc.setLineWidth(LW.ext);
    doc.setLineDashPattern([0.5, 0.4], 0);
    // extension line from the chain up to the outline's bottom edge (a circle: to the chord's lower end)
    const yBot = isCircle ? (o.centre[1] - Math.sqrt(Math.max(0, o.radius * o.radius - (cut - o.centre[0]) ** 2))) : 0;
    doc.line(px, chainY - 1.2, px, oyBottom - yBot * sc);
    doc.setLineDashPattern([], 0);
  });
  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  tc(doc, C.dim);
  for (let i = 0; i < hCuts.length - 1; i++) {
    const midX = gx + (hCuts[i] + hCuts[i + 1]) / 2 * sc;
    doc.text(fmt(hCuts[i + 1] - hCuts[i]), midX, chainY + 3.4, { align: 'center' });
  }

  // ── CHAIN V (left): horizontal bars, springing, apex ──
  const ys = [...new Set(bars.filter((b) => b.kind === 'straight' && Math.abs(b.to[1] - b.from[1]) < 1e-6).map((b) => Math.round(b.from[1] * 10) / 10))];
  const vCuts = [...new Set([0, ...ys.filter((v) => v > 0 && v < o.height), ...(isCircle ? [] : [Math.round(o.springing * 10) / 10]), o.height])].sort((a, b) => a - b);
  const chainX = gx - 4;
  dc(doc, C.dim);
  doc.setLineWidth(LW.dimLine);
  doc.line(chainX, gy, chainX, oyBottom);
  vCuts.forEach((cut) => {
    const py = oyBottom - cut * sc;
    doc.setLineWidth(LW.tick);
    doc.line(chainX - 1.2, py, chainX + 1.2, py);
    doc.setLineWidth(LW.ext);
    doc.setLineDashPattern([0.5, 0.4], 0);
    doc.line(chainX + 1.2, py, gx, py);
    doc.setLineDashPattern([], 0);
  });
  for (let i = 0; i < vCuts.length - 1; i++) {
    const midY = oyBottom - (vCuts[i] + vCuts[i + 1]) / 2 * sc;
    doc.text(fmt(vCuts[i + 1] - vCuts[i]), chainX - 1.8, midY, { angle: 90, align: 'center' });
  }

  // ── OVERALL WIDTH (TOP) / HEIGHT (right) ──
  const owY = gy - 4;
  dc(doc, C.dim);
  doc.setLineWidth(LW.dimOver);
  doc.line(gx, owY, gx + gw, owY);
  doc.line(gx, owY - 1.2, gx, owY + 1.2);
  doc.line(gx + gw, owY - 1.2, gx + gw, owY + 1.2);
  doc.setLineWidth(LW.ext);
  doc.setLineDashPattern([0.5, 0.4], 0);
  // extension lines from the outline's widest points (springing corners; a circle: the diameter ends)
  const yWide = isCircle ? o.centre[1] : o.springing;
  doc.line(gx, owY + 1.2, gx, oyBottom - yWide * sc);
  doc.line(gx + gw, owY + 1.2, gx + gw, oyBottom - yWide * sc);
  doc.setLineDashPattern([], 0);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  tc(doc, C.dim);
  doc.text(`${fmt(o.width)} mm`, gx + gw / 2, owY - 1.8, { align: 'center' });
  const ohX = gx + gw + 4;
  doc.setLineWidth(LW.dimOver);
  doc.line(ohX, gy, ohX, oyBottom);
  doc.line(ohX - 1.2, gy, ohX + 1.2, gy);
  doc.line(ohX - 1.2, oyBottom, ohX + 1.2, oyBottom);
  doc.text(`${fmt(o.height)} mm`, ohX + 3.5, gy + gh / 2, { angle: 90, align: 'center' });
  if (!isCircle) {
    // springing tick on the right (rise above it)
    const spY = oyBottom - o.springing * sc;
    doc.setLineWidth(LW.tick);
    doc.line(ohX - 1.2, spY, ohX + 1.2, spY);
    doc.setFontSize(5);
    doc.text(`rise ${fmt(shape.rise)}`, ohX + 3.5, (gy + spY) / 2, { angle: 90, align: 'center' });
  }
}

// ─── BARS PAGES (v4 Block B) ───
// One block per shaped unit with bars: the window thumbnail, the title, the
// bar-end table. Layout numbers in mm; the block height is a pure function
// of the row count so the pagination can be counted before drawing (the
// header prints "page / total").
const BARS = {
  thumbH: 35,         // window elevation thumbnail height
  thumbW: 45,         // … and its widest allowed width
  gap: 4,             // between the thumbnail and the table
  rowH: 3.2,
  titleH: 6,
  blockGap: 6,
  colW: [12, 62, 22, 30],   // ID · s from apex / position · L · angle / R
};

/** Rows of a unit's bar table — the glazier's numbers, one source (glassBars.js). */
const barsRowsOf = (g) => barEndRows(g.shape?.bars || [], g.shape.outline);

/** Height of one bars block (thumbnail vs table, whichever is taller) + the gap below it. */
function barsBlockHeight(g) {
  const rows = barsRowsOf(g).length;
  const tableH = BARS.titleH + (rows + 1) * BARS.rowH + 2;
  return Math.max(BARS.thumbH + 2, tableH) + BARS.blockGap;
}

/** Pagination of the bars blocks: pages = arrays of items; a block never breaks (it moves whole to the next page). */
function paginateBars(items, contentH) {
  const pages = [];
  let page = [], used = 0;
  for (const g of items) {
    const h = barsBlockHeight(g);
    if (page.length && used + h > contentH) { pages.push(page); page = []; used = 0; }
    page.push(g);
    used += h;
  }
  if (page.length) pages.push(page);
  return pages;
}

/**
 * Window elevation thumbnail: the frame's outer contour (straight part +
 * the arch chain, or the circle) with the shaped unit filled at its place.
 * `t` = { W, H, start, arcs (outer, arch frame), kind, origin, centreFrame }.
 */
function drawWindowThumb(doc, t, o, x, yTop, maxW, maxH) {
  if (!t || !(t.W > 0) || !(t.H > 0)) return 0;
  const sc = Math.min(maxW / t.W, maxH / t.H);
  const w = t.W * sc, h = t.H * sc;
  const ox = x, oyBottom = yTop + h;
  dc(doc, C.black);
  doc.setLineWidth(LW.seal);
  if (t.kind === 'circle') {
    doc.circle(ox + w / 2, oyBottom - h / 2, (t.W / 2) * sc, 'S');
  } else {
    // bottom-left → bottom-right → right springing → outer arcs → left springing → close (frame frame, y up)
    const arcs = (t.arcs || []).map((a) => ({ ...a, cx: a.cx + t.W / 2, cy: a.cy + t.start }));
    const frame = { width: t.W, springing: t.start, arcs };
    doc.lines(outlineLines(frame, sc), ox, oyBottom, [1, 1], 'S', true);
  }
  // the shaped unit at its origin in the frame
  if (o && t.origin) {
    fc(doc, C.glassFill);
    dc(doc, C.glass);
    doc.setLineWidth(LW.outline);
    doc.lines(outlineLines(o, sc), ox + t.origin.x * sc, oyBottom - t.origin.y * sc, [1, 1], 'FD', true);
  }
  return w;
}

/** One bars block at (x, yTop); returns the block height used. */
function drawBarsBlock(doc, g, x, yTop, w) {
  const rows = barsRowsOf(g);
  const thumbW = drawWindowThumb(doc, g.thumb, g.shape.outline, x, yTop, BARS.thumbW, BARS.thumbH);
  const tx = x + (thumbW ? thumbW + BARS.gap : 0);
  // title: unit index · window name — location · shape
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  tc(doc, C.black);
  doc.text(`${cellTitle(g)} — ${(g.thumb && g.thumb.kind === 'circle') ? 'circle' : 'arched'} · R ${[...new Set((g.shape.radii || []).map(fmt))].join('/')} · ${rows.length} bar${rows.length === 1 ? '' : 's'}`, tx, yTop + 3.2);
  // table header
  const colX = [tx, tx + BARS.colW[0], tx + BARS.colW[0] + BARS.colW[1], tx + BARS.colW[0] + BARS.colW[1] + BARS.colW[2]];
  let y = yTop + BARS.titleH;
  doc.setFont('courier', 'bold');
  doc.setFontSize(5);
  tc(doc, C.dark);
  ['ID', 's from apex / position', 'L', 'angle / R'].forEach((hd, i) => doc.text(hd, colX[i], y + 2.2));
  dc(doc, C.grayL);
  doc.setLineWidth(LW.tableLine);
  doc.line(tx, y + BARS.rowH, Math.min(tx + BARS.colW.reduce((a, b) => a + b, 0), x + w), y + BARS.rowH);
  y += BARS.rowH;
  doc.setFont('courier', 'normal');
  tc(doc, C.dim);
  rows.forEach((r) => {
    [r.id, r.cells.s, r.cells.L, r.cells.angle].forEach((v, k) => doc.text(String(v), colX[k], y + 2.2));
    y += BARS.rowH;
  });
  return barsBlockHeight(g);
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

export function exportGlassPDF({ batch, windowsData, projects = [], companySettings = {}, refImages = [], returnDoc = false, format = 'a4' }) {
  const pageFormat = setPageFormat(format);
  const glassItems = [];
  let idx = 1;

  windowsData.forEach(({ win, windowSpec, derived }) => {
    if (!derived || !windowSpec) return;

    // SINGLE SOURCE OF TRUTH: the same rows the on-screen Glass Schedule shows.
    // Every value (makeup, coating, gas, spacer, finish, bars) comes from here —
    // never re-read from windowSpec, or the PDF drifts away from the screen.
    const gRows = buildGlassListForWindow(derived, windowSpec) || [];
    if (!gRows.length) return;

    const sw = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    gRows.forEach((r) => {
      const w = Number(r.width);
      const h = Number(r.height);
      if (!(w > 0) || !(h > 0)) return;

      const qty = Math.max(1, Math.round(Number(r.quantity ?? r.qty ?? 1)));
      const sashKey = String(r.sash || '').toLowerCase();
      const isUpper = sashKey === 'upper';
      const isLower = sashKey === 'lower';
      // Double-hung rows name the sash; casement / triple rows name the location.
      const sashLabel = sashKey
        ? sashKey.charAt(0).toUpperCase() + sashKey.slice(1)
        : (r.location || r.label || '—');
      // Sash frame context exists for double-hung rows only (used to place bars).
      const sashH = isUpper ? topH : isLower ? botH : null;
      const sashW = sashH != null ? sw : null;

      // qty > 1 (casement units) must appear as separate ordered units.
      for (let n = 0; n < qty; n++) {
        glassItems.push({
          index: idx++,
          windowName: win.name,
          projectNumber: win._projectNumber || '',
          sash: sashLabel,
          isUpper,
          glassW: w,
          glassH: h,
          type: r.type,
          spec: r.spec,
          makeup: r.makeup,
          coating: r.coating,
          gas: r.gas,
          finish: r.finish,
          spacer: r.spacer,
          spacerType: r.spacerType,
          bars: r.bars || 'none',
          barsV: r.barsV,
          barsH: r.barsH,
          // shaped unit (arched casement): outline + bar list for the Shape
          // column, the mm + % line and the drawing cell
          shape: r.shape?.kind === 'arched' || r.shape?.kind === 'circle' ? r.shape : null,
          // v4 bars pages: the window elevation thumbnail — outer contour (arch chain / circle) + the unit's origin
          thumb: (r.shape?.kind === 'arched' || r.shape?.kind === 'circle') && derived.arch?.geometry ? {
            W: Number(windowSpec.frame?.width) || 0,
            H: Number(windowSpec.frame?.height) || 0,
            start: derived.arch.geometry.start,
            arcs: derived.arch.geometry.arcs,
            kind: derived.arch.geometry.shape,
            origin: derived.arch.glassOutline?.origin || null,
            centreFrame: derived.arch.glassOutline?.centreFrame || null,
          } : null,
          sashW,
          sashH,
          faces: derived?.sashDims,
        });
      }
    });
  });

  if (!glassItems.length) return null;

  // Pagination: page 1 = table, page 2+ = 4 drawings each, then the bars pages (v4) — one block per shaped unit with bars
  const drawPages = Math.ceil(glassItems.length / 4);
  const barsItems = glassItems.filter((g) => g.shape && (g.shape.bars || []).length);
  const barsContentH = PG.h - 2 * PG.by - HEADER_H - FOOTER_H - 6;
  const barsPages = paginateBars(barsItems, barsContentH);
  const totalPages = 1 + drawPages + barsPages.length;

  const info = {
    companyName: companySettings.companyName || 'COMPANY NAME',
    companyAddress: companySettings.companyAddress || '',
    companyEmail: companySettings.companyEmail || '',
    batchName: batch?.label || batch?.name || 'Batch',   // never the DB id (Piotr 02.08)
    // Never fall back to a raw record id — an order sheet must show the project
    // number the workshop and the glass supplier recognise.
    projects: projects
      .map(p => (p.number ? `${p.number}${p.name ? ' (' + p.name + ')' : ''}` : (p.name || '')))
      .filter(Boolean),
    date: new Date().toLocaleDateString('en-GB'),
    totalUnits: glassItems.length,
    refImages,
    revision: 'A',
  };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: pageFormat });

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

  // ─ BARS PAGES (v4): thumbnail + name + table per shaped unit, blocks stacked, never a break inside a table ─
  barsPages.forEach((pageItems, bi) => {
    const pageNum = 2 + drawPages + bi;
    doc.addPage();
    drawPageBorder(doc);
    drawHeader(doc, info, pageNum, totalPages);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    tc(doc, C.grayL);
    doc.text('GLAZING BARS — POSITIONS PER SHAPED UNIT (ids as on the drawings)', PG.bx + 3, contentTop + 3);
    let y = contentTop + 6;
    for (const g of pageItems) y += drawBarsBlock(doc, g, PG.bx + 3, y, drawAreaW - 2);
    drawFooter(doc, info, pageNum, totalPages);
  });

  const filename = `Glass_Order_${(info.batchName || 'batch').replace(/[^a-zA-Z0-9-]/g, '_')}_${info.date.replace(/\//g, '-')}.pdf`;
  if (returnDoc) return doc.output('arraybuffer');
  doc.save(filename);
  return filename;
}
