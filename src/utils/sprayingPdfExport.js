/**
 * sprayingPdfExport.js
 *
 * Professional A4-landscape PDF for the spraying schedule.
 * Styled to match the glass order export: double page border + navy header box.
 *
 * Part A — Elements (box + sashes) grouped by colour, sorted by element.
 * Part B — Beadings (painted first) grouped by interior colour, as lm + pcs.
 *
 * Colour sections are rendered as full-width band rows filled with the actual colour.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── COLOURS (RGB 0-255) ───
const C = {
  black:  [26, 26, 26],
  dark:   [60, 60, 60],
  gray:   [136, 136, 136],
  grayL:  [180, 180, 180],
  grayXL: [220, 220, 220],
  navy:   [26, 58, 92],
  navyMid:[42, 74, 110],
  rowBg:  [248, 248, 246],
  white:  [255, 255, 255],
};

const PG = { w: 297, h: 210, bx: 8, by: 8 };
const HEADER_H = 22;

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return [200, 200, 200];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function textOn(rgb) {
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return lum > 150 ? C.black : C.white;
}

function drawLogoBox(doc, x, y, w, h) {
  doc.setDrawColor(150, 175, 200);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.rect(x, y, w, h);
  doc.setLineDashPattern([], 0);
}

// ─── PAGE BORDER + HEADER (redrawn on every page via didDrawPage) ───
function drawFrame(doc, info) {
  // double border
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.5);
  doc.rect(PG.bx, PG.by, PG.w - 2 * PG.bx, PG.h - 2 * PG.by);
  doc.setLineWidth(0.08);
  doc.rect(PG.bx + 0.7, PG.by + 0.7, PG.w - 2 * PG.bx - 1.4, PG.h - 2 * PG.by - 1.4);

  const x = PG.bx + 0.7, y = PG.by + 0.7;
  const w = PG.w - 2 * PG.bx - 1.4;

  // navy header box
  doc.setFillColor(...C.navy);
  doc.rect(x, y, w, HEADER_H, 'F');

  // left: logo placeholder (auto-filled from company settings) + company name
  const lw = 40, lh = 14, lx = x + 4, ly = y + (HEADER_H - lh) / 2;
  if (info.logo) {
    try {
      const fmt = /jpe?g/i.test(info.logo.slice(0, 30)) ? 'JPEG' : 'PNG';
      doc.addImage(info.logo, fmt, lx, ly, lw, lh, undefined, 'FAST');
    } catch (e) {
      drawLogoBox(doc, lx, ly, lw, lh);
    }
  } else {
    drawLogoBox(doc, lx, ly, lw, lh);
  }
  const tX = lx + lw + 5;
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(info.companyName || 'COMPANY', tX, y + 8.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(190, 210, 228);
  doc.text('SPRAYING SCHEDULE', tX, y + 14.5);

  // divider
  const colX = x + w - 110;
  doc.setDrawColor(...C.navyMid); doc.setLineWidth(0.2);
  doc.line(colX, y + 2, colX, y + HEADER_H - 2);

  // right: label/value fields (two columns)
  const fields = [
    ['Pack',     info.title || '—'],
    ['Projects', (info.projects || []).join(' · ') || '—'],
    ['Date',     info.date || '—'],
    ['Deadline', info.deadline || '—'],
    ['Colours',  (info.colours || []).join(' · ') || '—'],
  ];
  const fx = colX + 4;
  let fy = y + 5.5;
  fields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5);
    doc.setTextColor(150, 175, 200);
    doc.text(label.toUpperCase(), fx, fy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    doc.text(String(value).substring(0, 70), fx + 18, fy);
    fy += 3.6;
  });
}

const CONTENT_TOP = PG.by + 0.7 + HEADER_H + 5;
const CONTENT_BOTTOM = PG.h - PG.by - 5;

export function exportSprayingPDF(info) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const usableW = PG.w - 2 * PG.bx - 1.4 - 4;

  const baseTableOpts = {
    theme: 'grid',
    margin: { top: CONTENT_TOP, left: PG.bx + 2.7, right: PG.bx + 2.7, bottom: PG.by + 5 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, lineColor: C.grayXL, lineWidth: 0.1, textColor: C.black },
    headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 6.5, halign: 'left' },
    alternateRowStyles: { fillColor: C.rowBg },
    didDrawPage: () => drawFrame(doc, info),
  };

  // ── PART A — Elements ──
  const bodyA = [];
  bodyA.push([{ content: 'PART A — ELEMENTS', colSpan: 6, styles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'left' } }]);
  (info.sections || []).forEach((sec) => {
    const rgb = hexToRgb(sec.hex);
    bodyA.push([{ content: sec.name, colSpan: 6, styles: { fillColor: rgb, textColor: textOn(rgb), fontStyle: 'bold', fontSize: 8, halign: 'left' } }]);
    sec.rows.forEach((r) => bodyA.push([r.projectNum || '—', r.window, r.element, r.colour, r.size, r.additional || '']));
  });

  autoTable(doc, {
    ...baseTableOpts,
    startY: CONTENT_TOP,
    head: [['Project №', 'Window', 'Element', 'Colour', 'Size (mm)', 'Additional info']],
    body: bodyA,
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 36 },
      2: { cellWidth: 28 },
      3: { cellWidth: 52 },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: usableW - 168 },
    },
  });

  // ── PART B — Beadings ──
  let startB = (doc.lastAutoTable?.finalY || CONTENT_TOP) + 10;
  if (startB > CONTENT_BOTTOM - 30) { doc.addPage(); drawFrame(doc, info); startB = CONTENT_TOP; }

  const bodyB = [];
  bodyB.push([{ content: 'PART B — BEADINGS (painted first)', colSpan: 3, styles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'left' } }]);
  (info.beadGroups || []).forEach((g) => {
    const rgb = hexToRgb(g.hex);
    bodyB.push([{ content: g.name, colSpan: 3, styles: { fillColor: rgb, textColor: textOn(rgb), fontStyle: 'bold', fontSize: 8, halign: 'left' } }]);
    g.rows.forEach((r) => bodyB.push([r.label, r.lm.toFixed(2), r.pcs.toFixed(1)]));
  });

  autoTable(doc, {
    ...baseTableOpts,
    startY: startB,
    head: [['Beading type', 'Linear m', 'Bars (pcs)']],
    body: bodyB,
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 40, halign: 'right' },
    },
  });

  // page numbers
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.setTextColor(...C.gray);
    doc.text(`Page ${p} / ${total}`, PG.w - PG.bx - 4, PG.h - PG.by - 1.5, { align: 'right' });
  }

  const fname = `Spraying_${(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  doc.save(fname);
}
