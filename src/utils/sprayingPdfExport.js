/**
 * sprayingPdfExport.js
 *
 * Spraying schedule PDF — styled to match the pre-cut list (shared pdfReport helper):
 * white header box, black border, light tables, no heavy fills (print-friendly).
 *
 * Part A — Elements (box + sashes) grouped by colour, sorted by element.
 * Part B — Beadings (painted first) grouped by interior colour, as lm + pcs.
 * Colour sections appear as light section rows with a small colour swatch.
 */
import { jsPDF } from 'jspdf';
import {
  getReportPage, REPORT_HEADER_H,
  drawReportBorder, drawReportHeader, drawReportFooter,
  stampReportPages, newReportPage, drawReportTable,
} from './pdfReport.js';

export function exportSprayingPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const tableWidth = PG.w - 2 * PG.bx - 6;

  const hdr = {
    companyName: info.companyName || 'COMPANY NAME',
    subtitle: 'SPRAYING SCHEDULE',
    companyAddress: info.companyAddress || '',
    logo: info.logo || '',
    mid: { topLabel: 'Pack', topValue: info.title || '—', botLabel: 'Projects', botValue: (info.projects || []).join(' · ') || '—' },
    c2:  { topLabel: 'Date', topValue: info.date || '—', botLabel: 'Deadline', botValue: info.deadline || '—' },
    c3:  { topLabel: 'Rev', topValue: 'A' },
  };

  drawReportBorder(doc, PG);
  drawReportHeader(doc, PG, hdr);
  drawReportFooter(doc, PG, hdr);

  // ── PART A — Elements ──
  const colsA = [
    { label: 'No.', dx: 0, auto: true, mono: true },
    { label: 'Project №', dx: 12, mono: true },
    { label: 'Window', dx: 34 },
    { label: 'Element', dx: 64 },
    { label: 'Colour', dx: 100 },
    { label: 'Size (mm)', dx: 186, align: 'right', mono: true },
    { label: 'Additional info', dx: 194 },
  ];
  const rowsA = [{ section: { label: 'PART A — ELEMENTS' } }];
  (info.sections || []).forEach((sec) => {
    rowsA.push({ section: { label: sec.name, hex: sec.hex } });
    sec.rows.forEach((r) => rowsA.push({
      cells: [r.projectNum || '—', r.window, r.element, r.colour, r.size, r.additional || ''],
    }));
  });

  let y = drawReportTable(doc, PG, {
    info: hdr, startY: PG.by + REPORT_HEADER_H + 8,
    columns: colsA, rows: rowsA, tableWidth,
  });

  // ── PART B — Beadings ──
  const colsB = [
    { label: 'No.', dx: 0, auto: true, mono: true },
    { label: 'Beading type', dx: 12 },
    { label: 'Linear m', dx: 92, align: 'right', mono: true },
    { label: 'Bars (pcs)', dx: 142, align: 'right', mono: true },
  ];
  const rowsB = [{ section: { label: 'PART B — BEADINGS (painted first)' } }];
  (info.beadGroups || []).forEach((g) => {
    rowsB.push({ section: { label: g.name, hex: g.hex } });
    g.rows.forEach((r) => rowsB.push({ cells: [r.label, r.lm.toFixed(2), r.pcs.toFixed(1)] }));
  });

  y += 10;
  if (y > PG.h - PG.by - 45) { newReportPage(doc, PG, hdr); y = PG.by + REPORT_HEADER_H + 8; }
  drawReportTable(doc, PG, { info: hdr, startY: y, columns: colsB, rows: rowsB, tableWidth });

  stampReportPages(doc, PG);

  const fname = `Spraying_${(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  if (info.returnDoc) return doc.output('arraybuffer');
  doc.save(fname);
}
