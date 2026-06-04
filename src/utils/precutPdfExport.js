/**
 * precutPdfExport.js
 *
 * Professional A3/A4 landscape PDF for pre-cut production lists.
 * Page 1: header + summary table
 * Page 2+: one section per page — BLO visualization + element table
 */
import { jsPDF } from 'jspdf';
import { getPartSymbol } from '../engine/partSymbols.js';

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

  const col1 = 80, col2 = w - 70, col3 = w - 35;
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
  doc.text(info.date, x + col2 + 20, y + 14);
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
function drawSummaryTable(doc, PG, groups, startY) {
  const x = PG.bx + 3;
  let y = startY + 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  tc(doc, C.grayL);
  doc.text('PRE-CUT SUMMARY', x, y);
  y += 10;

  // Header — spread across full width, no Waste/Util
  const cols = [
    { l: '#', dx: 0 },
    { l: 'Section', dx: 12 },
    { l: 'Material', dx: 135 },
    { l: 'Stock (mm)', dx: 225 },
    { l: 'Elements', dx: 270 },
    { l: 'Pieces', dx: 310 },
    { l: 'Bars', dx: 345 },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  tc(doc, C.dark);
  cols.forEach((c) => doc.text(c.l, x + c.dx, y));
  dc(doc, C.grayXL);
  doc.setLineWidth(LW.tableLine);
  doc.line(x, y + 3, x + 380, y + 3);
  y += 11;

  // Rows
  groups.forEach((g, i) => {
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
function drawBLO(doc, PG, optGroup, stockLength, startY, endTrim, kerf) {
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

      const color = bar.isOffcut ? C.amber : C.teal;
      fc(doc, color);
      dc(doc, [30, 30, 35]);
      doc.setLineWidth(LW.barCut);
      doc.rect(cutX, y, cutW, barH, 'FD');

      // Label — BLACK text (was white)
      const label = `${projNum ? projNum + '-' : ''}${winName ? winName + '-' : ''}${sym?.symbol || ''} ${cutLen}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      tc(doc, C.black);
      if (cutW > 20) {
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
  y += 8;

  return y;
}

// ─── ELEMENT TABLE (per section page) ───
function drawElementTable(doc, PG, items, startY, isPPMode) {
  const x = PG.bx + 4;
  let y = startY + 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  tc(doc, C.grayL);
  doc.text('ELEMENT LIST', x, y);
  y += 8;

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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  tc(doc, C.dark);
  cols.forEach((c) => doc.text(c.l, x + c.dx, y));
  dc(doc, C.grayXL);
  doc.setLineWidth(LW.tableLine);
  doc.line(x, y + 3, x + 310, y + 3);
  y += 10;

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

  rows.forEach((item, i) => {
    if (y > PG.h - PG.by - FOOTER_H - 8) return; // overflow guard

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

  const totalPages = 1 + summaryGroups.length;

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

  // ─── PAGE 1: SUMMARY ───
  drawPageBorder(doc, PG);
  drawHeader(doc, PG, info, 1, totalPages);
  drawSummaryTable(doc, PG, summaryGroups, PG.by + HEADER_H + 1);
  drawFooter(doc, PG, info, 1, totalPages);

  // ─── PAGE 2+: ONE SECTION PER PAGE ───
  summaryGroups.forEach((sg, idx) => {
    doc.addPage();
    drawPageBorder(doc, PG);
    drawHeader(doc, PG, info, idx + 2, totalPages);

    let y = PG.by + HEADER_H + 6;

    // Section title + material info
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

    // BLO (skipped when exporting the list only)
    if (content !== 'list') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      tc(doc, C.dark);
      doc.text('BAR LAYOUT OPTIMIZER', PG.bx + 4, y);
      y += 8;

      y = drawBLO(doc, PG, sg.optGroup, sg.stockLength, y, endTrim, kerf);
      y += 4;
    }

    // Element table (skipped when exporting the graphics only)
    if (content !== 'graphics') {
      y = drawElementTable(doc, PG, sg.items, y, isPPMode);
    }

    drawFooter(doc, PG, info, idx + 2, totalPages);
  });

  const filename = `PreCut_${(info.batchName || 'batch').replace(/[^a-zA-Z0-9-]/g, '_')}_${info.date.replace(/\//g, '-')}.pdf`;
  if (returnDoc) return doc.output('arraybuffer');
  doc.save(filename);
  return filename;
}
