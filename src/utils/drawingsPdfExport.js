/**
 * drawingsPdfExport.js
 *
 * PDF exports for the 2D drawing tabs — pre-cut styling (shared pdfReport helper):
 *   - exportElevationsPDF : one elevation per window, 3 per row.
 *   - exportElementsPDF   : grouped per window (header + Box / Upper / Lower row).
 *   - exportSectionsPDF   : uploaded section images, 2 per row.
 *
 * Images arrive as PNG/JPEG data URLs (elevations/elements rasterized from SVG by
 * the caller via svgRaster; sections are already base64 uploads). Each carries
 * natural { w, h } for aspect-fit.
 */
import { jsPDF } from 'jspdf';
import {
  getReportPage, REPORT_HEADER_H,
  drawReportBorder, drawReportHeader, drawReportFooter,
  stampReportPages,
} from './pdfReport.js';

function mkHeader(info, subtitle) {
  return {
    companyName: info.companyName || 'COMPANY NAME',
    subtitle,
    companyAddress: info.companyAddress || '',
    logo: info.logo || '',
    mid: { topLabel: 'Pack', topValue: info.title || '—', botLabel: 'Projects', botValue: (info.projects || []).join(' · ') || '—' },
    c2:  { topLabel: 'Date', topValue: info.date || '—', botLabel: 'Deadline', botValue: info.deadline || '' },
    c3:  { topLabel: 'Rev', topValue: 'A' },
  };
}

function chrome(doc, PG, hdr) {
  drawReportBorder(doc, PG);
  drawReportHeader(doc, PG, hdr);
  drawReportFooter(doc, PG, hdr);
}

// Aspect-fit an image inside box (bx,by,bw,bh), centered. Draws a light border.
function placeImg(doc, item, bx, by, bw, bh) {
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2);
  doc.rect(bx, by, bw, bh);
  if (!item || !item.image) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text('no image', bx + bw / 2, by + bh / 2, { align: 'center' });
    return;
  }
  const ar = (item.w && item.h) ? item.w / item.h : 1;
  let dw = bw, dh = bw / ar;
  if (dh > bh) { dh = bh; dw = bh * ar; }
  const dx = bx + (bw - dw) / 2;
  const dy = by + (bh - dh) / 2;
  const fmt = /^data:image\/jpe?g/i.test(item.image) ? 'JPEG' : 'PNG';
  try { doc.addImage(item.image, fmt, dx, dy, dw, dh, undefined, 'FAST'); } catch (e) { /* skip */ }
}

function caption(doc, text, x, y, max) {
  if (!text) return;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
  doc.text(String(text).substring(0, max || 46), x, y);
}

// ─── ELEVATIONS: 3 per row, large (1 row per page) ───
export function exportElevationsPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const hdr = mkHeader(info, '2D ELEVATIONS');
  chrome(doc, PG, hdr);

  const items = info.items || [];
  const COLS = 3, gap = 6, capH = 9;
  const x0 = PG.bx + 4;
  const top = PG.by + REPORT_HEADER_H + 8;
  const bottom = PG.h - PG.by - 12;
  const contentW = PG.w - 2 * PG.bx - 8;
  const cellW = (contentW - gap * (COLS - 1)) / COLS;
  const imgH = bottom - top - capH - 2;

  items.forEach((it, i) => {
    const col = i % COLS;
    if (col === 0 && i > 0) { doc.addPage(); chrome(doc, PG, hdr); }
    const cx = x0 + col * (cellW + gap);
    placeImg(doc, it, cx, top, cellW, imgH);
    const nameLine = `${it.no}. ${it.projectNum ? `${it.projectNum} · ` : ''}${it.name || ''}`;
    caption(doc, nameLine, cx, top + imgH + 5, 40);
    if (it.dims) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(136, 136, 136);
      doc.text(String(it.dims), cx, top + imgH + 9);
    }
  });

  stampReportPages(doc, PG);
  doc.save(`Elevations_${String(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}

// Compact header strip (~15mm) for one-window-per-page Elements sheets.
function compactHeader(doc, PG, hdr, caption, pageNum, total) {
  const x = PG.bx + 0.7, y = PG.by + 0.7, w = PG.w - 2 * PG.bx - 1.4, h = 15;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(x, y + h, x + w, y + h);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 26, 26);
  doc.text(hdr.companyName || 'COMPANY NAME', x + 2, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text('2D ELEMENTS', x + 2, y + 12);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 26);
  doc.text(String(caption || '').substring(0, 70), x + 70, y + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text(`${hdr.mid?.botValue ? `Projects ${hdr.mid.botValue}   ` : ''}${hdr.c2?.topValue || ''}`, x + w - 70, y + 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
  doc.text(`${pageNum} / ${total}`, x + w - 2, y + 12, { align: 'right' });
  return h;
}

// ─── ELEMENTS: ONE window per page — Box / Upper / Lower large, in a row ───
export function exportElementsPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const hdr = mkHeader(info, '2D ELEMENTS');

  const windows = info.windows || [];
  const total = Math.max(1, windows.length);
  const COLS = 3, gap = 6, labelH = 6;
  const HDR_H = 15;
  const x0 = PG.bx + 4;
  const contentW = PG.w - 2 * PG.bx - 8;
  const cellW = (contentW - gap * (COLS - 1)) / COLS;
  const top = PG.by + 0.7 + HDR_H + 5;
  const bottom = PG.h - PG.by - 10;       // above footer
  const imgH = bottom - top - labelH;

  windows.forEach((win, wi) => {
    if (wi > 0) doc.addPage();
    drawReportBorder(doc, PG);
    compactHeader(doc, PG, hdr, `${win.no}. ${win.caption || ''}`, wi + 1, total);
    drawReportFooter(doc, PG, hdr);

    (win.drawings || []).slice(0, COLS).forEach((d, di) => {
      const cx = x0 + di * (cellW + gap);
      placeImg(doc, d, cx, top, cellW, imgH);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
      doc.text(String(d.label || ''), cx + cellW / 2, top + imgH + 4.5, { align: 'center' });
    });
  });

  doc.save(`Elements_${String(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}

// ─── SECTIONS: uploaded images, 2 per row (2×2 per page) ───
export function exportSectionsPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const hdr = mkHeader(info, '2D SECTIONS');
  chrome(doc, PG, hdr);

  const items = info.items || [];
  const COLS = 2, ROWS = 2, gap = 8, capH = 7;
  const x0 = PG.bx + 4;
  const top = PG.by + REPORT_HEADER_H + 8;
  const bottom = PG.h - PG.by - 12;
  const contentW = PG.w - 2 * PG.bx - 8;
  const cellW = (contentW - gap * (COLS - 1)) / COLS;
  const rowH = (bottom - top - gap * (ROWS - 1)) / ROWS;
  const imgH = rowH - capH;
  const perPage = COLS * ROWS;

  items.forEach((it, i) => {
    const pos = i % perPage;
    if (pos === 0 && i > 0) { doc.addPage(); chrome(doc, PG, hdr); }
    const col = pos % COLS;
    const row = Math.floor(pos / COLS);
    const cx = x0 + col * (cellW + gap);
    const cy = top + row * (rowH + gap);
    placeImg(doc, it, cx, cy, cellW, imgH);
    caption(doc, `${it.no}. ${it.label || 'Section'}`, cx, cy + imgH + 4.5, 60);
  });

  stampReportPages(doc, PG);
  doc.save(`Sections_${String(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
