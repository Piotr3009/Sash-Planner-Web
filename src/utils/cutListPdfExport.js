/**
 * cutListPdfExport.js
 *
 * Cut list PDF — same pre-cut styling (shared pdfReport helper).
 * One section per element (symbol + element + section + material), then its cut pieces.
 */
import { jsPDF } from 'jspdf';
import {
  getReportPage, REPORT_HEADER_H,
  drawReportBorder, drawReportHeader, drawReportFooter,
  stampReportPages, drawReportTable,
} from './pdfReport.js';

export function exportCutListPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const tableWidth = PG.w - 2 * PG.bx - 6;
  const isPP = !!info.isPPMode;

  const hdr = {
    companyName: info.companyName || 'COMPANY NAME',
    subtitle: 'CUT LIST — PRODUCTION',
    companyAddress: info.companyAddress || '',
    logo: info.logo || '',
    mid: { topLabel: 'Pack', topValue: info.title || '—', botLabel: 'Projects', botValue: (info.projects || []).join(' · ') || '—' },
    c2:  { topLabel: 'Date', topValue: info.date || '—', botLabel: 'Pieces', botValue: String(info.totalPieces ?? '—') },
    c3:  { topLabel: 'Rev', topValue: 'A' },
  };

  drawReportBorder(doc, PG);
  drawReportHeader(doc, PG, hdr);
  drawReportFooter(doc, PG, hdr);

  const columns = isPP
    ? [
        { label: 'No.', dx: 0, auto: true, mono: true },
        { label: 'Project №', dx: 12, mono: true },
        { label: 'Window', dx: 40 },
        { label: 'Length (mm)', dx: 130, align: 'right', mono: true },
        { label: 'Qty', dx: 160, align: 'right', mono: true },
      ]
    : [
        { label: 'No.', dx: 0, auto: true, mono: true },
        { label: 'Window', dx: 12 },
        { label: 'Length (mm)', dx: 110, align: 'right', mono: true },
        { label: 'Qty', dx: 145, align: 'right', mono: true },
      ];

  const rows = [];
  (info.groups || []).forEach((g) => {
    const parts = [g.symbol, g.element];
    if (g.mirror) parts.push('⟷');
    if (g.section) parts.push(`· ${g.section}`);
    if (g.material) parts.push(`· ${g.material}`);
    rows.push({ section: { label: parts.filter(Boolean).join('  ') } });
    g.rows.forEach((r) => {
      rows.push({ cells: isPP
        ? [r.projectNum || '—', r.window || '—', r.length, r.qty]
        : [r.window || '—', r.length, r.qty] });
    });
  });

  drawReportTable(doc, PG, {
    info: hdr, startY: PG.by + REPORT_HEADER_H + 8,
    columns, rows, tableWidth,
  });

  stampReportPages(doc, PG);
  doc.save(`CutList_${(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
