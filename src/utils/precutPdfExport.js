/**
 * precutPdfExport.js
 *
 * Professional A3/A4 landscape PDF for pre-cut production lists.
 * Page 1: header + summary table
 * Page 2+: one section per page — BLO visualization + element table
 */
import { jsPDF } from 'jspdf';
import { getPartSymbol } from '../engine/partSymbols.js';
import { PART_COLOUR_GROUPS, partColourForElement, hexToRgb, barLabelThatFits } from '../engine/partColours.js';

// ─── COLORS ───
const C = {
  black:    [26, 26, 26],
  dark:     [60, 60, 60],
  gray:     [136, 136, 136],
  grayL:    [180, 180, 180],
  grayXL:   [220, 220, 220],
  rowBg:    [245, 245, 243],
  teal:     [0, 180, 160],
  tealDark: [0, 140, 125],
  amber:    [217, 161, 53],
  dim:      [0, 121, 107],
  red:      [220, 60, 60],
};

const LW = {
  border: 0.5,
  borderIn: 0.08,
  sep: 0.3,
  tableLine: 0.15,
  barOutline: 0.3,
  barCut: 0.15,
};

const dc = (d, c) => d.setDrawColor(...c);
const fc = (d, c) => d.setFillColor(...c);
const tc = (d, c) => d.setTextColor(...c);

// ─── PAGE SETUP ───
function getPageDims(format) {
  return format === 'a3'
    ? { w: 420, h: 297, bx: 10, by: 10 }
    : { w: 297, h: 210, bx: 8, by: 8 };
}

const HEADER_H = 40;
const FOOTER_H = 10;

// ─── PAGE BORDER ───
function drawPageBorder(doc, PG) {
  dc(doc, C.black);
  doc.setLineWidth(LW.border);
  doc.rect(PG.bx, PG.by, PG.w - 2 * PG.bx, PG.h - 2 * PG.by);
  doc.setLineWidth(LW.borderIn);
  doc.rect(PG.bx + 0.7, PG.by + 0.7, PG.w - 2 * PG.bx - 1.4, PG.h - 2 * PG.by - 1.4);
}

// ─── HEADER ───
function drawHeader(doc, PG, info, pageNum, totalPages) {
  const x = PG.bx + 0.7, y = PG.by + 0.7;
  const w = PG.w - 2 * PG.bx - 1.4;

  dc(doc, C.black);
  doc.setLineWidth(LW.sep);
  doc.line(x, y + HEADER_H, x + w, y + HEADER_H);

  // The date cell (col2 → col3) is 43 mm wide: a 12 pt date is about 21 mm and
  // has to end well before the Rev cell.
  const col1 = 80, col2 = w - 78, col3 = w - 35;
  doc.setLineWidth(LW.borderIn);
  doc.line(x + col1, y, x + col1, y + HEADER_H);
  doc.line(x + col2, y, x + col2, y + HEADER_H);
  doc.line(x + col3, y, x + col3, y + HEADER_H);
  doc.line(x + col2, y + HEADER_H / 2, x + w, y + HEADER_H / 2);

  // Company
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  tc(doc, C.black);
  doc.text(info.companyName || 'COMPANY', x + 3, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  tc(doc, C.gray);
  doc.text('PRE-CUT LIST — PRODUCTION', x + 3, y + 25);
  if (info.responsible) {
    doc.setFontSize(10);
    tc(doc, C.grayL);
    doc.text(`Responsible: ${info.responsible}`, x + 3, y + 34);
  }

  // Batch info
  doc.setFontSize(10);
  tc(doc, C.grayL);
  doc.text('Batch:', x + col1 + 3, y + 14);
  doc.text('Projects:', x + col1 + 3, y + HEADER_H / 2 + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  tc(doc, C.black);
  doc.text(String(info.batchName || '—'), x + col1 + 22, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  tc(doc, C.dark);
  doc.text((info.projects || []).join(' · ').substring(0, 60), x + col1 + 30, y + HEADER_H / 2 + 14);

  // Date / Sections
  doc.setFontSize(10);
  tc(doc, C.grayL);
  doc.text('Date:', x + col2 + 3, y + 14);
  doc.text('Sections:', x + col2 + 3, y + HEADER_H / 2 + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  tc(doc, C.black);
  doc.text(info.date, x + col2 + 15, y + 14);
  doc.text(String(info.totalSections), x + col2 + 28, y + HEADER_H / 2 + 14);

  // Rev / Page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  tc(doc, C.grayL);
  doc.text('Rev:', x + col3 + 3, y + 14);
  doc.text('Page:', x + col3 + 3, y + HEADER_H / 2 + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  tc(doc, C.black);
  doc.text('A', x + col3 + 16, y + 14);
  doc.text(`${pageNum} / ${totalPages}`, x + col3 + 18, y + HEADER_H / 2 + 14);
}

// ─── FOOTER ───
function drawFooter(doc, PG, info, pageNum, totalPages) {
  const y = PG.h - PG.by - 4;
  dc(doc, C.black);
  doc.setLineWidth(LW.borderIn);
  doc.line(PG.bx + 0.7, y - 1, PG.w - PG.bx - 0.7, y - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  tc(doc, C.grayL);
  doc.text([info.companyName, info.companyAddress].filter(Boolean).join(' · '), PG.bx + 4, y + 2.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  tc(doc, C.black);
  doc.text(`${pageNum} / ${totalPages}`, PG.w - PG.bx - 4, y + 2.5, { align: 'right' });
}

// ─── SUMMARY TABLE (page 1) ───
function drawSummaryTable(doc, PG, groups, startY, beginPage) {
  const x = PG.bx + 3;

  const cols = [
    { l: '#', dx: 0 },
    { l: 'Section', dx: 12 },
    { l: 'Material', dx: 135 },
    { l: 'Stock (mm)', dx: 225 },
    { l: 'Elements', dx: 270 },
    { l: 'Pieces', dx: 310 },
    { l: 'Bars', dx: 345 },
  ];

  const drawHead = (yy, continued) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    tc(doc, C.grayL);
    doc.text(continued ? 'PRE-CUT SUMMARY (continued)' : 'PRE-CUT SUMMARY', x, yy);
    yy += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    tc(doc, C.dark);
    cols.forEach((c) => doc.text(c.l, x + c.dx, yy));
    dc(doc, C.grayXL);
    doc.setLineWidth(LW.tableLine);
    doc.line(x, yy + 3, x + 380, yy + 3);
    return yy + 11;
  };

  let y = drawHead(startY + 8, false);
  const bottom = PG.h - PG.by - FOOTER_H - 8;

  // Rows — break to a continuation page instead of drawing off the page.
  groups.forEach((g, i) => {
    if (y > bottom) {
      const ny = beginPage();
      y = drawHead(ny, true);
    }
    if (i % 2 === 0) {
      fc(doc, C.rowBg);
      doc.rect(x - 1, y - 5, 382, 10, 'F');
    }
    tc(doc, C.black);
    doc.setFont('courier', 'normal');
    doc.setFontSize(11);
    doc.text(String(i + 1), x + 0, y);
    doc.setFont('helvetica', 'bold');
    doc.text(g.label, x + 12, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text((g.materialName || 'Not assigned').substring(0, 35), x + 135, y);
    doc.setFont('courier', 'normal');
    doc.setFontSize(11);
    doc.text(String(g.stockLength), x + 225, y);
    doc.text(String(g.elementCount), x + 270, y);
    doc.text(String(g.pieceCount), x + 310, y);
    doc.text(String(g.barCount), x + 345, y);
    y += 10;
  });

  return y;
}

// ─── BLO VISUALIZATION (per section page) ───
function drawBLO(doc, PG, optGroup, stockLength, startY, endTrim, kerf, colourByPart = false) {
  const x = PG.bx + 4;
  const areaW = PG.w - 2 * PG.bx - 8;
  let y = startY;

  if (!optGroup?.bars?.length) return y;

  const maxStock = Math.max(...optGroup.bars.map((b) => b.stockLength || stockLength));
  const barH = 7;
  const barGap = 2;

  optGroup.bars.forEach((bar) => {
    const barStock = bar.stockLength || stockLength;
    const barW = (barStock / maxStock) * areaW;

    // Bar background
    fc(doc, [50, 55, 65]);
    dc(doc, C.gray);
    doc.setLineWidth(LW.barOutline);
    doc.rect(x, y, barW, barH, 'FD');

    // End trim
    fc(doc, [65, 70, 80]);
    doc.rect(x, y, (endTrim / barStock) * barW, barH, 'F');

    // Cuts
    let cursor = endTrim;
    const details = bar.cutDetails || bar.cuts.map((c) => ({ length: c, elementName: '' }));
    details.forEach((detail) => {
      const cutLen = typeof detail === 'number' ? detail : detail.length;
      const elName = typeof detail === 'number' ? '' : (detail.elementName || '');
      const winName = typeof detail === 'number' ? '' : (detail.windowName || '');
      const projNum = typeof detail === 'number' ? '' : (detail.projectNumber || '');
      const sym = elName ? getPartSymbol(elName) : null;

      const cutX = x + (cursor / barStock) * barW;
      const cutW = (cutLen / barStock) * barW;

      // Colour by part: the piece takes its compartment colour (offcut bars
      // too, they keep their "(offcut N)" note); otherwise one colour as before.
      const partColour = colourByPart ? partColourForElement(elName) : null;
      const color = partColour ? hexToRgb(partColour.hex) : (bar.isOffcut ? C.amber : C.teal);
      fc(doc, color);
      dc(doc, [30, 30, 35]);
      doc.setLineWidth(LW.barCut);
      doc.rect(cutX, y, cutW, barH, 'FD');

      // Label — BLACK text (was white)
      // Full description when it fits the piece, otherwise the dimension
      // alone. Same font size either way. A piece coloured by part carries no
      // part symbol: the colour already says what it is, so the label is
      // project number, window and dimension only.
      const plainLabel = `${projNum ? projNum + '-' : ''}${winName ? winName + '-' : ''}${sym?.symbol || ''} ${cutLen}`.trim();
      const colouredLabel = `${[projNum, winName].filter(Boolean).join('-')} ${cutLen}`.trim();
      const fullLabel = partColour ? colouredLabel : plainLabel;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      tc(doc, C.black);
      const label = barLabelThatFits(fullLabel, String(cutLen), cutW - 1.5, (t) => doc.getTextWidth(t));
      if (label) {
        doc.text(label, cutX + cutW / 2, y + barH / 2 + 1.5, { align: 'center' });
      }

      cursor += cutLen + kerf;
    });

    // Bar ID + utilization
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    tc(doc, C.gray);
    doc.text(bar.barId, x + barW + 3, y + barH / 2 + 1.5);
    doc.text(`${(bar.utilization * 100).toFixed(0)}%`, x + barW + 30, y + barH / 2 + 1.5);
    if (bar.isOffcut) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      tc(doc, C.amber);
      doc.text(`(offcut ${barStock})`, x + barW + 48, y + barH / 2 + 1.5);
    }

    y += barH + barGap;
  });

  // Stats
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  tc(doc, C.gray);
  doc.text(`Bars: ${optGroup.summary.totalBars}  ·  Waste: ${optGroup.summary.wasteTotal} mm  ·  Utilization: ${(optGroup.summary.utilAvg * 100).toFixed(1)}%`, x, y);
  // 08.10.2026: pieces longer than the stock bar (reported by optimizer.js, never dropped)
  const over = optGroup.summary.overLength || [];
  if (over.length) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    tc(doc, C.black);
    doc.text(`Longer than the stock bar (${over[0].stockLength} mm): ${over.map((o) => `${o.windowName ? `${o.windowName} ` : ''}${o.elementName} ${o.length}`).join(', ')}`.slice(0, 160), x, y);
    doc.setFont('helvetica', 'normal');
  }
  y += 8;

  return y;
}

// ─── ELEMENT TABLE (per section page) ───
function drawElementTable(doc, PG, items, startY, isPPMode, sg, beginPage) {
  const x = PG.bx + 4;

  // Header — tighter columns
  const cols = isPPMode
    ? [
        { l: 'Symbol', dx: 0 },
        { l: 'Project', dx: 28 },
        { l: 'Window', dx: 60 },
        { l: 'Element', dx: 100 },
        { l: 'Pre-Cut', dx: 175 },
        { l: 'Finished', dx: 210 },
        { l: 'Section', dx: 248 },
        { l: 'Qty', dx: 285 },
      ]
    : [
        { l: 'Symbol', dx: 0 },
        { l: 'Window', dx: 28 },
        { l: 'Element', dx: 68 },
        { l: 'Pre-Cut', dx: 160 },
        { l: 'Finished', dx: 198 },
        { l: 'Section', dx: 240 },
        { l: 'Qty', dx: 275 },
      ];

  const drawHead = (yy, continued) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    tc(doc, C.grayL);
    doc.text(continued ? 'ELEMENT LIST (continued)' : 'ELEMENT LIST', x, yy);
    yy += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    tc(doc, C.dark);
    cols.forEach((c) => doc.text(c.l, x + c.dx, yy));
    dc(doc, C.grayXL);
    doc.setLineWidth(LW.tableLine);
    doc.line(x, yy + 3, x + 310, yy + 3);
    return yy + 10;
  };

  // Continuation page for the SAME material: page chrome + title + "(continued)".
  const continuePage = () => {
    const ny = beginPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    tc(doc, C.black);
    doc.text(`${sg?.label || ''} (continued)`, x, ny);
    return drawHead(ny + 10, true);
  };

  let y = drawHead(startY + 5, false);

  // Group items by elementName + length
  const grouped = new Map();
  items.forEach((it) => {
    const key = `${it.elementName}|${it.length}|${it.windowName || ''}|${it._projectNumber || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, { ...it, totalQty: 0 });
    }
    grouped.get(key).totalQty += (it.quantity || 1);
  });

  const rows = Array.from(grouped.values()).sort((a, b) => a.elementName.localeCompare(b.elementName) || a.length - b.length);
  const bottom = PG.h - PG.by - FOOTER_H - 8;

  rows.forEach((item, i) => {
    if (y > bottom) {
      y = continuePage(); // flow onto a new page instead of dropping rows
    }

    if (i % 2 === 0) {
      fc(doc, C.rowBg);
      doc.rect(x - 1, y - 5, 312, 9, 'F');
    }

    const sym = getPartSymbol(item.elementName);

    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    tc(doc, C.tealDark);
    doc.text(sym.symbol, x + (isPPMode ? 0 : 0), y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    tc(doc, C.black);

    if (isPPMode) {
      doc.text(item._projectNumber || '—', x + 28, y);
      doc.text(item.windowName || '—', x + 60, y);
      doc.text(item.elementName, x + 100, y);
      doc.setFont('courier', 'normal');
      doc.text(String(item.length), x + 175, y);
      doc.text(String(item.finishedLength || item.length), x + 210, y);
      doc.setFont('helvetica', 'normal');
      doc.text(item.section || '—', x + 248, y);
      doc.setFont('courier', 'bold');
      doc.text(String(item.totalQty), x + 285, y);
    } else {
      doc.text(item.windowName || '—', x + 28, y);
      doc.text(item.elementName, x + 68, y);
      doc.setFont('courier', 'normal');
      doc.text(String(item.length), x + 160, y);
      doc.text(String(item.finishedLength || item.length), x + 198, y);
      doc.setFont('helvetica', 'normal');
      doc.text(item.section || '—', x + 240, y);
      doc.setFont('courier', 'bold');
      doc.text(String(item.totalQty), x + 275, y);
    }

    if (sym.mirror) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      tc(doc, [150, 100, 200]);
      doc.text('⟷', x + (isPPMode ? 300 : 290), y);
    }

    y += 9;
  });

  return y;
}

// ─── COLOUR BY PART: legend line of a section ───
function colourGroupsIn(items) {
  const ids = new Set((items || []).map((it) => partColourForElement(it.elementName)?.id).filter(Boolean));
  return PART_COLOUR_GROUPS.filter((g) => ids.has(g.id));
}

function drawColourLegend(doc, x, y, groups) {
  let cx = x;
  groups.forEach((g) => {
    fc(doc, hexToRgb(g.hex));
    dc(doc, C.black);
    doc.setLineWidth(LW.barOutline);
    doc.rect(cx, y - 3.6, 9, 4.6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    tc(doc, C.black);
    doc.text(g.name, cx + 11, y);
    cx += 11 + doc.getTextWidth(g.name) + 8;
  });
}

// ─── COLOUR BY PART: the key sheet (frame and leaf drawn apart) ───
// Rectangles are [x, y, w, h, colour group id] on a 340 x 400 (frame) and a
// 200 x 400 (leaf) grid; `u` turns a grid unit into mm for the page format.
const KEY_FRAME = [
  [38, 126, 119, 24, 'transom'], [183, 126, 119, 24, 'transom'],
  [157, 32, 26, 322, 'mullion'],
  [12, 32, 26, 322, 'frame_jambs'], [302, 32, 26, 322, 'frame_jambs'],
  [12, 6, 316, 26, 'frame_head'],
  [2, 354, 336, 32, 'frame_cill'],
];
const KEY_LEAF = [
  [40, 36, 120, 320, null],
  [10, 6, 30, 380, 'leaf_stiles'], [160, 6, 30, 380, 'leaf_stiles'],
  [40, 6, 120, 30, 'leaf_top_rail'],
  [40, 356, 120, 30, 'leaf_bottom_rail'],
];

// Door key (08.10.2026): a door frame with a side panel (coupling post) and a
// fanlight rail, and a french leaf (hinge stile, meeting stile, mid rail).
const KEY_DOOR_FRAME = [
  [126, 110, 176, 24, 'door_transom'],
  [100, 32, 26, 322, 'door_post'],
  [12, 32, 26, 322, 'door_frame_jambs'], [302, 32, 26, 322, 'door_frame_jambs'],
  [12, 6, 316, 26, 'door_frame_head'],
  [2, 354, 336, 32, 'door_frame_cill'],
];
const KEY_DOOR_LEAF = [
  [40, 36, 120, 160, null],
  [40, 220, 120, 110, null],
  [10, 6, 30, 380, 'door_leaf_stiles'], [160, 6, 30, 380, 'door_meeting_stile'],
  [40, 6, 120, 30, 'door_top_rail'],
  [40, 196, 120, 24, 'door_mid_rail'],
  [40, 330, 120, 56, 'door_bottom_rail'],
];
const KEY_SHEETS = {
  casement: { title: 'COLOUR KEY · CASEMENT', frame: KEY_FRAME, leaf: KEY_LEAF, families: ['frame', 'leaf'] },
  door: { title: 'COLOUR KEY · DOOR', frame: KEY_DOOR_FRAME, leaf: KEY_DOOR_LEAF, families: ['door_frame', 'door_leaf'] },
};

function drawColourKeyPage(doc, PG, topY, kind = 'casement') {
  const K = KEY_SHEETS[kind] || KEY_SHEETS.casement;
  const k = PG.w / 297;      // A4 landscape = 1
  const u = 0.2646 * k;      // one grid unit in mm
  const byId = Object.fromEntries(PART_COLOUR_GROUPS.map((g) => [g.id, g]));
  const x0 = PG.bx + 8 * k;
  let y = topY + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18 * k);
  tc(doc, C.black);
  doc.text(K.title, x0, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10 * k);
  tc(doc, C.dark);
  doc.text('One colour = one compartment', PG.w - PG.bx - 6, y, { align: 'right' });
  y += 10 * k;

  const drawPart = (title, rects, family, ox) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13 * k);
    tc(doc, C.black);
    doc.text(title, ox, y);
    const top = y + 4;
    dc(doc, C.black);
    doc.setLineWidth(0.3);
    let maxX = 0;
    rects.forEach(([rx, ry, rw, rh, id]) => {
      fc(doc, id ? hexToRgb(byId[id].hex) : [232, 241, 246]);
      doc.rect(ox + rx * u, top + ry * u, rw * u, rh * u, 'FD');
      maxX = Math.max(maxX, rx + rw);
    });
    // Legend of this drawing, to its right.
    const lx = ox + (maxX + 22) * u;
    let ly = top + 14 * u;
    PART_COLOUR_GROUPS.filter((g) => g.family === family).forEach((g) => {
      fc(doc, hexToRgb(g.hex));
      doc.rect(lx, ly - 5 * u, 44 * u, 24 * u, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12 * k);
      tc(doc, C.black);
      doc.text(g.name, lx + 52 * u, ly + 9 * u);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5 * k);
      tc(doc, C.dark);
      doc.text(g.note, lx + 52 * u, ly + 24 * u);
      ly += 46 * u;
    });
  };

  drawPart('FRAME', K.frame, K.families[0], x0);
  drawPart('LEAF', K.leaf, K.families[1], x0 + 610 * u);
}

// ─── MAIN EXPORT ───
export function exportPreCutPDF({
  groups,           // [{ key, label, type, items, stockLength, materialInfo }]
  optimization,     // { sashEngineering: [...], boxSapele: [...] }
  settings,
  batch,
  pp,
  projects = [],
  isPPMode = false,
  format = 'a3',    // 'a3' or 'a4'
  content = 'both', // 'both' | 'graphics' | 'list'
  companySettings = {},
  returnDoc = false,
  colourByPart = false, // colour the pieces by part + legend + key sheet
}) {
  const PG = getPageDims(format);
  const endTrim = settings?.endTrim || 10;
  const kerf = settings?.kerf || 3;

  // Build summary data
  const summaryGroups = groups.map((g) => {
    // Find matching optimization group
    let optGroup = null;
    if (g.type === 'sash' && optimization?.sashEngineering) {
      optGroup = optimization.sashEngineering.find((o) => o.section === g.section);
    } else if (g.type === 'box' && optimization?.boxSapele) {
      optGroup = optimization.boxSapele.find((o) => String(o.preCutWidth) === g.section);
    }

    return {
      label: g.label,
      materialName: g.materialInfo?.name || null,
      stockLength: g.stockLength || (g.type === 'sash' ? settings?.stockLengthSash || 5900 : settings?.stockLengthBox || 2400),
      elementCount: g.items.length,
      pieceCount: g.items.reduce((s, it) => s + (it.quantity || 1), 0),
      barCount: optGroup?.summary?.totalBars || 0,
      waste: optGroup?.summary?.wasteTotal || 0,
      utilization: optGroup?.summary?.utilAvg || 0,
      optGroup,
      items: g.items,
      section: g.section,
      type: g.type,
      materialInfo: g.materialInfo,
    };
  });

  const info = {
    companyName: companySettings.companyName || 'COMPANY NAME',
    companyAddress: companySettings.companyAddress || '',
    batchName: batch?.name || batch?.label || pp?.name || 'Batch',
    responsible: pp?.responsible || '',
    projects: projects.map((p) => p.number || p.name || p.id).filter(Boolean),
    date: new Date().toLocaleDateString('en-GB'),
    totalSections: summaryGroups.length,
  };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: format });

  // Page count is unknown up front (tables flow onto extra pages), so we stamp a
  // running page number plus a placeholder for the total and resolve it at the end.
  const NB = '{tot}';
  let pageNum = 0;
  const beginPage = () => {
    pageNum += 1;
    if (pageNum > 1) doc.addPage(); // page 1 is the initial jsPDF page
    drawPageBorder(doc, PG);
    drawHeader(doc, PG, info, pageNum, NB);
    drawFooter(doc, PG, info, pageNum, NB);
    return PG.by + HEADER_H + 6; // content top Y
  };

  // ─── PAGE 1: SUMMARY (continues onto extra pages when many materials) ───
  beginPage();
  drawSummaryTable(doc, PG, summaryGroups, PG.by + HEADER_H + 1, beginPage);

  // ─── SECTIONS: one material starts a new page; its list flows onto more pages ───
  summaryGroups.forEach((sg) => {
    let y = beginPage();

    // Section title + material info (first page of the material only)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    tc(doc, C.black);
    doc.text(sg.label, PG.bx + 4, y);

    if (sg.materialInfo) {
      const mi = sg.materialInfo;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      tc(doc, C.tealDark);
      const matLine = [mi.item_number, mi.name, mi.size ? `Size: ${mi.size}` : '', mi.thickness ? `Thickness: ${mi.thickness}` : '', mi.category, mi.subcategory].filter(Boolean).join(' · ');
      doc.text(matLine, PG.bx + 4, y + 8);
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    tc(doc, C.gray);
    doc.text(`Stock: ${sg.stockLength} mm`, PG.w - PG.bx - 4, y, { align: 'right' });

    y += sg.materialInfo ? 18 : 12;

    // Colour by part: which colour is which part in this section.
    const legendGroups = colourByPart && content !== 'list' ? colourGroupsIn(sg.items) : [];
    if (legendGroups.length) {
      drawColourLegend(doc, PG.bx + 4, y - 3, legendGroups);
      y += 6;
    }

    // BLO (skipped when exporting the list only) — first page of the material only
    if (content !== 'list') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      tc(doc, C.dark);
      doc.text('BAR LAYOUT OPTIMIZER', PG.bx + 4, y);
      y += 8;

      y = drawBLO(doc, PG, sg.optGroup, sg.stockLength, y, endTrim, kerf, colourByPart);
      y += 4;
    }

    // Element table (skipped when exporting the graphics only) — paginates internally
    if (content !== 'graphics') {
      y = drawElementTable(doc, PG, sg.items, y, isPPMode, sg, beginPage);
    }
  });

  // Colour by part: one key sheet at the end, to hang by the saw.
  // Casement and door parts each have their own key sheet (08.10.2026).
  if (colourByPart && content !== 'list') {
    const fams = new Set(summaryGroups.flatMap((sg) => colourGroupsIn(sg.items).map((g) => g.family)));
    if (fams.has('frame') || fams.has('leaf')) drawColourKeyPage(doc, PG, beginPage(), 'casement');
    if (fams.has('door_frame') || fams.has('door_leaf')) drawColourKeyPage(doc, PG, beginPage(), 'door');
  }

  // Resolve the {tot} placeholder to the real page count on every page.
  doc.putTotalPages(NB);

  const filename = `PreCut_${(info.batchName || 'batch').replace(/[^a-zA-Z0-9-]/g, '_')}_${info.date.replace(/\//g, '-')}.pdf`;
  if (returnDoc) return doc.output('arraybuffer');
  doc.save(filename);
  return filename;
}
