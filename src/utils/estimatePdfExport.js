// estimatePdfExport.js — generates the customer-facing estimate PDF.
//
// Native jsPDF (the rest of PC builds PDFs this way; no html2canvas).
// Branding comes from Company settings (logo) + Estimate PDF settings
// (accent colour, payment terms, T&C). Each window gets a 2D technical
// elevation drawing (via the same canvas-renderer the production PDFs use),
// a spec table and a price. 3D screenshots are a later step (3c).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTechnicalElevation } from '../engine/canvas-renderer.js';
import { normaliseToWindowSpec } from '../engine/specification.js';

const A4 = { w: 210, h: 297 };
const MARGIN = 15;

// hex → [r,g,b]
function hexToRgb(hex) {
  const h = (hex || '#0A1628').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Render a window's 2D technical elevation to a PNG data URL (offscreen canvas).
function renderDrawingToDataURL(windowSpec, settings) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 900;
  canvas.style.width = '1200px'; canvas.style.height = '900px';
  canvas.style.position = 'fixed'; canvas.style.left = '-99999px'; canvas.style.top = '0';
  document.body.appendChild(canvas);
  try {
    drawTechnicalElevation(canvas, windowSpec, settings);
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(canvas);
  }
}

const money = (sym, n) => `${sym}${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * exportEstimatePdf(estimate, opts)
 *   estimate  — the estimate object (with items[], totals)
 *   opts.company    — settings.company (logo, companyName, address, currency, vat…)
 *   opts.pdfSettings — { accent_color, terms_text, payment_terms } | null
 *   opts.settings    — engine constants (for the drawing); {} is fine
 *   opts.clientName  — resolved client name | null
 */
export function exportEstimatePdf(estimate, opts = {}) {
  const company = opts.company || {};
  const pdf = opts.pdfSettings || {};
  const settings = opts.settings || {};
  const clientName = opts.clientName || '';

  const accent = hexToRgb(pdf.accent_color || '#0A1628');
  const sym = ({ GBP: '£', EUR: '€', USD: '$' })[company.currency] || '£';
  const items = estimate.items || [];

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ─── COVER ───
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, A4.w, 70, 'F');
  if (company.logo) {
    try { doc.addImage(company.logo, 'PNG', MARGIN, 16, 40, 0); } catch { /* ignore bad logo */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
  doc.text('Quotation', A4.w - MARGIN, 30, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text(estimate.estimate_number || 'DRAFT', A4.w - MARGIN, 40, { align: 'right' });

  doc.setTextColor(30, 30, 30);
  let y = 86;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(company.companyName || 'Company name', MARGIN, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  y += 5;
  [company.companyAddress, company.companyPhone, company.companyEmail, company.vat ? `VAT ${company.vat}` : '']
    .filter(Boolean).forEach((line) => { doc.text(String(line), MARGIN, y); y += 4.5; });

  const created = estimate.created_at ? new Date(estimate.created_at) : new Date();
  const valid = new Date(created); valid.setDate(valid.getDate() + 30);
  const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setTextColor(30, 30, 30);
  autoTable(doc, {
    startY: 86,
    margin: { left: A4.w - MARGIN - 80, right: MARGIN },
    tableWidth: 80,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1 },
    body: [
      ['Prepared for', clientName || '—'],
      ['Date', fmtDate(created)],
      ['Valid until', fmtDate(valid)],
    ],
    columnStyles: { 0: { textColor: [120, 120, 120] }, 1: { fontStyle: 'bold', halign: 'right' } },
  });

  y = Math.max(y, doc.lastAutoTable.finalY) + 8;

  // ─── PER WINDOW ───
  items.forEach((it, idx) => {
    const c = it.config || {};
    // Page break if not enough room for a window block (~110mm)
    if (y > A4.h - 110) { doc.addPage(); y = MARGIN; }

    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(MARGIN, y, A4.w - 2 * MARGIN, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`${idx + 1}.  ${it.windowName || 'Window'}`, MARGIN + 3, y + 5.5);
    doc.text(money(sym, it.price?.totalPrice), A4.w - MARGIN - 3, y + 5.5, { align: 'right' });
    y += 12;

    const drawingTop = y;
    // 2D drawing (left)
    try {
      const windowSpec = normaliseToWindowSpec({
        ...c, width: c.extWidth, height: c.extHeight, name: it.windowName, id: it.id, quantity: 1,
      });
      const dataUrl = renderDrawingToDataURL(windowSpec, settings);
      doc.addImage(dataUrl, 'PNG', MARGIN, y, 85, 64);
    } catch (e) {
      doc.setTextColor(150, 150, 150); doc.setFontSize(8);
      doc.text('(drawing unavailable)', MARGIN, y + 30);
    }

    // Spec table (right)
    const isBespoke = !!c.ironmongeryBespoke;
    const colourTxt = c.colourMode === 'dual' ? 'Dual (ext/int)' : 'Single';
    const specRows = [
      ['Size (frame)', `${c.extWidth} × ${c.extHeight} mm`],
      ['Type', `${c.sashType || 'double'} · ${c.headType || 'flat'} head`],
      ['Bars', `${c.upperBars || 'none'}${c.sameBars ? '' : ` / ${c.lowerBars || 'none'}`}`],
      ['Glass', `${c.glassType || 'double'} · ${c.glassFinish || 'clear'}`],
      ['Colour', colourTxt],
      ['Opening', c.openingType || 'both'],
      ['Ironmongery', isBespoke ? 'Bespoke (priced separately)' : (c.ironmongery || 'brass')],
      ['PAS24', c.pas24 ? 'Yes' : 'No'],
    ];
    autoTable(doc, {
      startY: drawingTop,
      margin: { left: MARGIN + 92, right: MARGIN },
      tableWidth: A4.w - 2 * MARGIN - 92,
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      headStyles: { fillColor: accent, fontSize: 8.5 },
      head: [['Specification', '']],
      body: specRows,
      columnStyles: { 0: { textColor: [110, 110, 110], cellWidth: 32 }, 1: { fontStyle: 'bold' } },
    });

    y = Math.max(drawingTop + 64, doc.lastAutoTable.finalY) + 8;
  });

  // ─── SUMMARY ───
  if (y > A4.h - 80) { doc.addPage(); y = MARGIN; }
  const summaryBody = items.map((it, i) => [
    `${i + 1}. ${it.windowName || 'Window'}`,
    money(sym, it.price?.totalPrice),
  ]);
  const t = estimate.totals || {};
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    head: [['Summary', '']],
    headStyles: { fillColor: accent, textColor: [255, 255, 255], halign: 'left' },
    body: summaryBody,
    columnStyles: { 1: { halign: 'right' } },
    foot: [
      ['Subtotal (ex VAT)', money(sym, t.ex_vat)],
      ['VAT', money(sym, t.vat)],
      ['Total (inc VAT)', money(sym, t.inc_vat)],
    ],
    footStyles: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: [20, 20, 20], halign: 'right' },
  });
  y = doc.lastAutoTable.finalY + 6;

  // Bespoke note if any window uses bespoke ironmongery
  if (items.some((it) => it.config?.ironmongeryBespoke)) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(150, 90, 0);
    doc.text('* Includes bespoke ironmongery — priced separately, not included in the totals above.', MARGIN, y);
    y += 7;
  }

  // ─── PAYMENT + TERMS ───
  const addBlock = (title, text) => {
    if (!text) return;
    if (y > A4.h - 40) { doc.addPage(); y = MARGIN; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
    doc.text(title, MARGIN, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(text, A4.w - 2 * MARGIN);
    lines.forEach((ln) => {
      if (y > A4.h - 15) { doc.addPage(); y = MARGIN; }
      doc.text(ln, MARGIN, y); y += 4.2;
    });
    y += 4;
  };
  addBlock('Payment terms', pdf.payment_terms);
  addBlock('Terms & conditions', pdf.terms_text);

  // ─── FOOTERS ───
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
    doc.text(`${company.companyName || ''}`.trim(), MARGIN, A4.h - 8);
    doc.text(`Page ${i} of ${pages}`, A4.w / 2, A4.h - 8, { align: 'center' });
    doc.text(estimate.estimate_number || '', A4.w - MARGIN, A4.h - 8, { align: 'right' });
  }

  const safeNum = (estimate.estimate_number || 'estimate').replace(/[^\w-]/g, '_');
  doc.save(`${safeNum}.pdf`);
}
