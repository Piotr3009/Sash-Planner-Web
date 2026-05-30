/**
 * bomPdfExport.js
 *
 * Bill of Materials PDF (Production Pack) — pre-cut styling (shared pdfReport helper):
 * white header box, black border, light table. Flat purchase list merged across the
 * pack's windows. Same source as the BOM tab (mergeWindowMaterials).
 *
 * Columns: No. | Material | Item № | Qty | Unit £ | Est. £   + Est. total line.
 */
import { jsPDF } from 'jspdf';
import {
  getReportPage, REPORT_HEADER_H,
  drawReportBorder, drawReportHeader, drawReportFooter,
  stampReportPages, drawReportTable, newReportPage,
} from './pdfReport.js';

// info: {
//   title, projects:[..], date, deadline, companyName, companyAddress, logo,
//   rows: [{ name, itemNumber, qty, unitCost, estCost, ironmongery, assigned }],
//   total
// }
export function exportBomPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const tableWidth = PG.w - 2 * PG.bx - 6;

  const hdr = {
    companyName: info.companyName || 'COMPANY NAME',
    subtitle: 'BILL OF MATERIALS',
    companyAddress: info.companyAddress || '',
    logo: info.logo || '',
    mid: { topLabel: 'Pack', topValue: info.title || '—', botLabel: 'Projects', botValue: (info.projects || []).join(' · ') || '—' },
    c2:  { topLabel: 'Date', topValue: info.date || '—', botLabel: 'Items', botValue: String(info.rows?.length ?? 0) },
    c3:  { topLabel: 'Rev', topValue: 'A' },
  };

  drawReportBorder(doc, PG);
  drawReportHeader(doc, PG, hdr);
  drawReportFooter(doc, PG, hdr);

  const columns = [
    { label: 'No.',      dx: 0,   auto: true, mono: true },
    { label: 'Material', dx: 10 },
    { label: 'Item №',   dx: 150, mono: true },
    { label: 'Qty',      dx: 198, align: 'right', mono: true },
    { label: 'Unit £',   dx: 233, align: 'right', mono: true },
    { label: 'Est. £',   dx: 273, align: 'right', mono: true, bold: true },
  ];

  const rows = (info.rows || []).map((r) => ({
    cells: [
      `${r.name}${r.ironmongery ? ' (irn)' : ''}${r.assigned === false ? ' — unassigned' : ''}`,
      r.itemNumber || '—',
      r.qty,
      r.unitCost,
      r.estCost,
    ],
  }));

  let y = drawReportTable(doc, PG, {
    info: hdr, startY: PG.by + REPORT_HEADER_H + 8,
    title: 'MATERIALS', columns, rows, tableWidth,
  });

  // Est. total line (own page if it would overflow)
  const x = PG.bx + 3;
  const bottom = PG.h - PG.by - 12;
  if (y + 8 > bottom) { newReportPage(doc, PG, hdr); y = PG.by + REPORT_HEADER_H + 12; }
  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
  doc.line(x, y - 1, x + tableWidth, y - 1);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
  doc.text('EST. TOTAL', x + columns[1].dx, y + 5);
  doc.setFont('courier', 'bold');
  doc.text(String(info.total || '—'), x + columns[5].dx, y + 5, { align: 'right' });

  stampReportPages(doc, PG);
  doc.save(`BOM_${String(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
