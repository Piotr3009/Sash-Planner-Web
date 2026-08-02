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

// Aspect-fit an image inside box (bx,by,bw,bh), centered. The border hugs the
// drawing itself, not the cell (Piotr 02.08): a portrait drawing in a wide cell
// used to sit inside a frame full of blank paper, which exaggerated the empty
// margins visually. Empty cells still get a full-cell frame as a placeholder.
function placeImg(doc, item, bx, by, bw, bh) {
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2);
  if (!item || !item.image) {
    doc.rect(bx, by, bw, bh);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text('no image', bx + bw / 2, by + bh / 2, { align: 'center' });
    return;
  }
  const ar = (item.w && item.h) ? item.w / item.h : 1;
  let dw = bw, dh = bw / ar;
  if (dh > bh) { dh = bh; dw = bh * ar; }
  const dx = bx + (bw - dw) / 2;
  const dy = by + (bh - dh) / 2;
  doc.rect(dx, dy, dw, dh);
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
    // Optional small inset (casement cill section) — sash sheets carry the
    // cill on the elevation, casement now matches (Piotr 02.08, audit 5).
    if (it.inset?.image) {
      const insW = cellW * 0.34;
      const insH = imgH * 0.30;
      const ix = cx + cellW - insW;
      const iy = top + imgH - insH;
      doc.setFillColor(255, 255, 255);
      doc.rect(ix - 1, iy - 1, insW + 1, insH + 1, 'F');
      doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2);
      doc.rect(ix - 1, iy - 1, insW + 1, insH + 1);
      placeImg(doc, it.inset, ix, iy, insW, insH - 3);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(26, 26, 26);
      doc.text('CILL SECTION', ix + insW / 2, iy + insH - 3.2, { align: 'center' });
    }
    const nameLine = `${it.no}. ${it.projectNum ? `${it.projectNum} · ` : ''}${it.name || ''}`;
    caption(doc, nameLine, cx, top + imgH + 5, 40);
    if (it.dims) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
      doc.text(String(it.dims), cx, top + imgH + 9);
    }
  });

  stampReportPages(doc, PG);
  if (info.returnDoc) return doc.output('arraybuffer');
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
  doc.text(hdr.subtitle || '2D ELEMENTS', x + 2, y + 12);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 26);
  doc.text(String(caption || '').substring(0, 70), x + 70, y + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text(`${hdr.mid?.botValue ? `Projects ${hdr.mid.botValue}   ` : ''}${hdr.c2?.topValue || ''}`, x + w - 70, y + 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
  doc.text(`${pageNum} / ${total}`, x + w - 2, y + 12, { align: 'right' });
  return h;
}

// ─── ELEMENTS: per-window pages — drawings in a cols×rows grid; windows with
// more drawings than one page holds continue on "(cont.)" pages (Piotr 02.08:
// a 7-leaf casement must stay readable, never squeezed onto one sheet). ───
export function exportElementsPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const hdr = mkHeader(info, info.subtitle || '2D ELEMENTS');

  const windows = info.windows || [];
  const COLS = Math.max(1, Math.min(3, Number(info.cols) || 3));
  const ROWS = COLS >= 3 ? 1 : 2;         // sash keeps 3-in-a-row; 2-col mode stacks 2 rows
  const perPage = COLS * ROWS;
  // Margins pared to the minimum so drawings get every millimetre (Piotr 02.08).
  // BOT_PAD keeps the caption clear of the footer rule (measured: 5mm left only
  // 0.5mm of clearance). Width, not height, drives portrait drawings here, so
  // the extra 3mm costs nothing in drawing size.
  const gap = 3, labelH = 6, PAD = 2, BOT_PAD = 8;
  const HDR_H = 15;
  const x0 = PG.bx + PAD;
  const contentW = PG.w - 2 * PG.bx - 2 * PAD;
  const cellW = (contentW - gap * (COLS - 1)) / COLS;
  const top = PG.by + 0.7 + HDR_H + 5;
  const bottom = PG.h - PG.by - BOT_PAD;  // above footer
  const rowH = (bottom - top - gap * (ROWS - 1)) / ROWS;
  const imgH = rowH - labelH;

  // ── Cill sections are pulled OUT of the per-window grid (Piotr 02.08).
  // The section depends only on the extension projection, never on window size,
  // so N windows produced N identical drawings. They are de-duplicated by ext
  // and printed once, on a closing page — which also matches the workshop order
  // (the extension board is fitted last). No cills → no page at all.
  const cillGroups = [];
  windows.forEach((win) => {
    const c = win.cill;
    if (!c || !c.image) return;
    const ext = Number(c.ext) || 0;
    const tag = String(win.tag || win.no || '').trim();
    const found = cillGroups.find((g) => g.ext === ext);
    if (found) { if (tag) found.tags.push(tag); }
    else cillGroups.push({ ext, image: c.image, w: c.w, h: c.h, tags: tag ? [tag] : [] });
  });
  cillGroups.sort((a, b) => a.ext - b.ext);
  const CILL_COLS = 3;
  const cillCellW = (contentW - gap * (CILL_COLS - 1)) / CILL_COLS;
  const cillLabelH = 12;                  // two lines: variant + window list
  const cillPages = [];
  for (let i = 0; i < cillGroups.length; i += CILL_COLS) {
    cillPages.push({ groups: cillGroups.slice(i, i + CILL_COLS), cont: i > 0 });
  }

  // Pre-split into pages so the header can show a true page total.
  const pages = [];
  windows.forEach((win) => {
    const ds = win.drawings || [];
    for (let i = 0; i < Math.max(1, ds.length); i += perPage) {
      pages.push({ win, drawings: ds.slice(i, i + perPage), cont: i > 0 });
    }
  });
  const total = Math.max(1, pages.length + cillPages.length);

  pages.forEach((pg, pi) => {
    if (pi > 0) doc.addPage();
    drawReportBorder(doc, PG);
    compactHeader(doc, PG, hdr,
      `${pg.win.no}. ${pg.win.caption || ''}${pg.cont ? ' (cont.)' : ''}`, pi + 1, total);
    drawReportFooter(doc, PG, hdr);

    pg.drawings.forEach((d, di) => {
      const col = di % COLS;
      const row = Math.floor(di / COLS);
      const cx = x0 + col * (cellW + gap);
      const cy = top + row * (rowH + gap);
      placeImg(doc, d, cx, cy, cellW, imgH);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
      doc.text(String(d.label || ''), cx + cellW / 2, cy + imgH + 4.5, { align: 'center' });
    });
  });

  // Height fitted to the drawing itself, not to the page: a cill section is
  // ~3:1, so a full-height cell left the caption stranded 64mm below its own
  // drawing (measured on sample, Piotr 02.08). Capped by available space.
  const cillAvailH = bottom - top - cillLabelH;
  const cillNatH = cillGroups.reduce((mx, g) => {
    const ar = (g.w && g.h) ? g.w / g.h : 3;
    return Math.max(mx, cillCellW / ar);
  }, 0);
  const cillImgH = Math.min(cillAvailH, cillNatH || cillAvailH);
  cillPages.forEach((pg, pi) => {
    doc.addPage();
    drawReportBorder(doc, PG);
    compactHeader(doc, PG, hdr,
      `CILL SECTIONS${pg.cont ? ' (cont.)' : ''}`, pages.length + pi + 1, total);
    drawReportFooter(doc, PG, hdr);

    pg.groups.forEach((g, di) => {
      const cx = x0 + di * (cillCellW + gap);
      placeImg(doc, g, cx, top, cillCellW, cillImgH);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
      doc.text(g.ext > 0 ? `Cill ext ${g.ext} mm` : 'Cill — no extension',
        cx + cillCellW / 2, top + cillImgH + 4.5, { align: 'center' });
      if (g.tags.length) {
        // Wrap instead of truncating — a silently cut list ("W1 … W20") is worse
        // than none, because the joiner cannot tell that anything is missing.
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
        const lines = doc.splitTextToSize(g.tags.join(', '), cillCellW - 4);
        lines.forEach((ln, li) => {
          doc.text(ln, cx + cillCellW / 2, top + cillImgH + 9 + li * 3.6, { align: 'center' });
        });
      }
    });
  });

  if (info.returnDoc) return doc.output('arraybuffer');
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
