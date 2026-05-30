/**
 * overviewPdfExport.js
 *
 * Production Pack overview PDF — pack summary header + windows table.
 * Same pre-cut styling (shared pdfReport helper).
 */
import { jsPDF } from 'jspdf';
import {
  getReportPage, REPORT_HEADER_H,
  drawReportBorder, drawReportHeader, drawReportFooter,
  stampReportPages, drawReportTable,
} from './pdfReport.js';

export function exportOverviewPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const tableWidth = PG.w - 2 * PG.bx - 6;
  const isPP = !!info.isPPMode;

  const hdr = {
    companyName: info.companyName || 'COMPANY NAME',
    subtitle: isPP ? 'PRODUCTION PACK — OVERVIEW' : 'BATCH — OVERVIEW',
    companyAddress: info.companyAddress || '',
    logo: info.logo || '',
    mid: { topLabel: 'Pack', topValue: info.title || '—', botLabel: 'Projects', botValue: (info.projects || []).join(' · ') || '—' },
    c2:  { topLabel: 'Date', topValue: info.date || '—', botLabel: 'Windows', botValue: String(info.windows?.length ?? 0) },
    c3:  { topLabel: 'Rev', topValue: 'A' },
  };

  drawReportBorder(doc, PG);
  drawReportHeader(doc, PG, hdr);
  drawReportFooter(doc, PG, hdr);

  const columns = isPP
    ? [
        { label: 'No.', dx: 0, auto: true, mono: true },
        { label: 'Project №', dx: 12, mono: true },
        { label: 'Window', dx: 36 },
        { label: 'Type', dx: 78 },
        { label: 'W', dx: 118, align: 'right', mono: true },
        { label: 'H', dx: 140, align: 'right', mono: true },
        { label: 'Bars', dx: 150 },
        { label: 'Head', dx: 182 },
        { label: 'Glass', dx: 212 },
        { label: 'Opening', dx: 244 },
      ]
    : [
        { label: 'No.', dx: 0, auto: true, mono: true },
        { label: 'Window', dx: 12 },
        { label: 'Type', dx: 60 },
        { label: 'W', dx: 110, align: 'right', mono: true },
        { label: 'H', dx: 135, align: 'right', mono: true },
        { label: 'Bars', dx: 150 },
        { label: 'Head', dx: 185 },
        { label: 'Glass', dx: 215 },
        { label: 'Opening', dx: 245 },
      ];

  const rows = (info.windows || []).map((w) => ({
    cells: isPP
      ? [w.projectNum || '—', w.name, w.type, w.width, w.height, w.bars, w.head, w.glass, w.opening]
      : [w.name, w.type, w.width, w.height, w.bars, w.head, w.glass, w.opening],
  }));

  drawReportTable(doc, PG, {
    info: hdr, startY: PG.by + REPORT_HEADER_H + 8,
    title: 'WINDOWS', columns, rows, tableWidth,
  });

  stampReportPages(doc, PG);
  doc.save(`Overview_${(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
