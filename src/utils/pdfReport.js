/**
 * pdfReport.js
 *
 * Shared report styling for Production Pack PDF exports.
 * Extracted from the pre-cut list look: white header box with black border,
 * light tables (very light zebra), black/grey text — print-friendly, no heavy fills.
 *
 * Used by spraying (and future tab exports) to keep every PDF visually consistent.
 */

export const RC = {
  black:    [26, 26, 26],
  dark:     [60, 60, 60],
  gray:     [136, 136, 136],
  grayL:    [180, 180, 180],
  grayXL:   [220, 220, 220],
  rowBg:    [245, 245, 243],
  sectionBg:[233, 233, 231],
  white:    [255, 255, 255],
};

const LW = { border: 0.5, borderIn: 0.08, sep: 0.3, tableLine: 0.15 };
const dc = (d, c) => d.setDrawColor(...c);
const fc = (d, c) => d.setFillColor(...c);
const tc = (d, c) => d.setTextColor(...c);

export const REPORT_HEADER_H = 40;

export function getReportPage(format) {
  return format === 'a3'
    ? { w: 420, h: 297, bx: 10, by: 10 }
    : { w: 297, h: 210, bx: 8, by: 8 };
}

export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return [200, 200, 200];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function logoFrame(doc, x, y, w, h) {
  dc(doc, RC.grayL); doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.rect(x, y, w, h);
  doc.setLineDashPattern([], 0);
}

// ─── PAGE BORDER ───
export function drawReportBorder(doc, PG) {
  dc(doc, RC.black); doc.setLineWidth(LW.border);
  doc.rect(PG.bx, PG.by, PG.w - 2 * PG.bx, PG.h - 2 * PG.by);
  doc.setLineWidth(LW.borderIn);
  doc.rect(PG.bx + 0.7, PG.by + 0.7, PG.w - 2 * PG.bx - 1.4, PG.h - 2 * PG.by - 1.4);
}

// ─── HEADER (white box, black border — pre-cut style) ───
// info: { companyName, subtitle, companyAddress, logo,
//         mid:{topLabel,topValue,botLabel,botValue},
//         c2:{topLabel,topValue,botLabel,botValue},
//         c3:{topLabel,topValue} }   — page number is stamped later
export function drawReportHeader(doc, PG, info) {
  const x = PG.bx + 0.7, y = PG.by + 0.7, w = PG.w - 2 * PG.bx - 1.4, h = REPORT_HEADER_H;
  dc(doc, RC.black); doc.setLineWidth(LW.sep);
  doc.line(x, y + h, x + w, y + h);

  const col1 = 80, col2 = w - 90, col3 = w - 45;
  doc.setLineWidth(LW.borderIn);
  doc.line(x + col1, y, x + col1, y + h);
  doc.line(x + col2, y, x + col2, y + h);
  doc.line(x + col3, y, x + col3, y + h);
  doc.line(x + col2, y + h / 2, x + w, y + h / 2);

  // Company / logo
  if (info.logo) {
    const lw = 30, lh = 15, lx = x + 3, ly = y + (h - lh) / 2;
    try {
      const fmt = /jpe?g/i.test(info.logo.slice(0, 30)) ? 'JPEG' : 'PNG';
      doc.addImage(info.logo, fmt, lx, ly, lw, lh, undefined, 'FAST');
    } catch (e) { logoFrame(doc, lx, ly, lw, lh); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); tc(doc, RC.black);
    doc.text(info.companyName || 'COMPANY NAME', lx + lw + 4, y + 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); tc(doc, RC.gray);
    doc.text(info.subtitle || '', lx + lw + 4, y + 22);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); tc(doc, RC.black);
    doc.text(info.companyName || 'COMPANY NAME', x + 3, y + 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); tc(doc, RC.gray);
    doc.text(info.subtitle || '', x + 3, y + 25);
  }

  const box = (cx, f) => {
    if (!f) return;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); tc(doc, RC.grayL);
    if (f.topLabel) doc.text(f.topLabel, cx + 3, y + 13);
    if (f.botLabel) doc.text(f.botLabel, cx + 3, y + h / 2 + 13);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); tc(doc, RC.black);
    if (f.topValue != null) doc.text(String(f.topValue).substring(0, 40), cx + 22, y + 13);
    if (f.botValue != null) doc.text(String(f.botValue).substring(0, 40), cx + 22, y + h / 2 + 13);
  };
  box(x + col1, info.mid);
  box(x + col2, info.c2);

  // c3: Rev (top) + Page label (value stamped later)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); tc(doc, RC.grayL);
  doc.text(info.c3?.topLabel || 'Rev', x + col3 + 3, y + 13);
  doc.text('Page', x + col3 + 3, y + h / 2 + 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); tc(doc, RC.black);
  doc.text(String(info.c3?.topValue || 'A'), x + col3 + 18, y + 13);
}

// ─── FOOTER ───
export function drawReportFooter(doc, PG, info) {
  const y = PG.h - PG.by - 4;
  dc(doc, RC.black); doc.setLineWidth(LW.borderIn);
  doc.line(PG.bx + 0.7, y - 1, PG.w - PG.bx - 0.7, y - 1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); tc(doc, RC.grayL);
  doc.text([info.companyName, info.companyAddress].filter(Boolean).join(' · '), PG.bx + 4, y + 2.5);
}

// ─── PAGE NUMBERS (stamped after all pages exist) ───
export function stampReportPages(doc, PG) {
  const total = doc.internal.getNumberOfPages();
  const x = PG.bx + 0.7, y = PG.by + 0.7, w = PG.w - 2 * PG.bx - 1.4, h = REPORT_HEADER_H, col3 = w - 45;
  const fy = PG.h - PG.by - 4;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); tc(doc, RC.black);
    doc.text(`${p} / ${total}`, x + col3 + 18, y + h / 2 + 13);
    doc.setFont('courier', 'bold'); doc.setFontSize(10); tc(doc, RC.black);
    doc.text(`${p} / ${total}`, PG.w - PG.bx - 4, fy + 2.5, { align: 'right' });
  }
}

// ─── NEW PAGE (border + header + footer chrome) ───
export function newReportPage(doc, PG, info) {
  doc.addPage();
  drawReportBorder(doc, PG);
  drawReportHeader(doc, PG, info);
  drawReportFooter(doc, PG, info);
}

// ─── GENERIC PAGINATED TABLE (pre-cut style) ───
// columns: [{ label, dx, align?, mono?, bold? }]
// rows:    [{ cells:[...] } | { section:{ label, hex? } }]
export function drawReportTable(doc, PG, { info, startY, title, columns, rows, tableWidth }) {
  const x = PG.bx + 3;
  const bottom = PG.h - PG.by - 12;
  const rowH = 8.5;
  let y = startY;

  const colHeader = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); tc(doc, RC.dark);
    columns.forEach((c) => doc.text(c.label, x + c.dx, y, c.align === 'right' ? { align: 'right' } : undefined));
    dc(doc, RC.grayXL); doc.setLineWidth(LW.tableLine);
    doc.line(x, y + 3, x + tableWidth, y + 3);
    y += 9;
  };

  if (title) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); tc(doc, RC.grayL);
    doc.text(title, x, y); y += 9;
  }
  colHeader();

  let zebra = 0;
  let lp = 0;
  rows.forEach((row) => {
    if (y + rowH > bottom) {
      newReportPage(doc, PG, info);
      y = PG.by + REPORT_HEADER_H + 12;
      colHeader(); zebra = 0;
    }
    if (row.section) {
      fc(doc, RC.sectionBg); doc.rect(x - 1, y - 5, tableWidth + 1, rowH, 'F');
      let tx = x + 1;
      if (row.section.hex) {
        fc(doc, hexToRgb(row.section.hex)); dc(doc, RC.grayL); doc.setLineWidth(0.2);
        doc.rect(x + 1, y - 3.7, 4.5, 4.5, 'FD');
        tx = x + 8;
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); tc(doc, RC.black);
      doc.text(row.section.label, tx, y);
      y += rowH; return;
    }
    if (zebra % 2 === 0) { fc(doc, RC.rowBg); doc.rect(x - 1, y - 5, tableWidth + 1, rowH, 'F'); }
    tc(doc, RC.black);
    lp += 1;
    let k = 0;
    columns.forEach((c) => {
      const val = c.auto ? lp : row.cells[k++];
      doc.setFont(c.mono ? 'courier' : 'helvetica', c.bold ? 'bold' : 'normal');
      doc.setFontSize(c.mono ? 10 : 9.5);
      doc.text(String(val ?? ''), x + c.dx, y, c.align === 'right' ? { align: 'right' } : undefined);
    });
    y += rowH; zebra++;
  });

  return y;
}
