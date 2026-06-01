/**
 * cutListPdfExport.js
 *
 * Standalone cut-list PDF renderer (own renderer, not the shared pdfReport helper).
 * Compact header (glass-style), clean table, NO material column.
 * Section headers: colour chip + symbol + element + "- section".
 * Supports A3 / A4 landscape. On A3 everything is scaled up (larger print)
 * by factor S = A3/A4 long edge = 420/297 ≈ 1.414.
 */
import { jsPDF } from 'jspdf';

// ─── Colours (shared palette with glass renderer) ───
const C = {
  black:  [26, 26, 26],
  dark:   [60, 60, 60],
  gray:   [138, 138, 138],
  grayL:  [180, 180, 180],
  grayXL: [220, 220, 220],
  rowBg:  [247, 247, 245],
  cardHead:[238, 238, 235],
  cardBorder:[154, 154, 150],
  accentBlue:[58, 110, 165],
  accentGray:[150, 150, 146],
  pillBlue:[220, 232, 244],
  pillBlueT:[44, 93, 143],
  pillGray:[228, 228, 226],
  pillGrayT:[90, 90, 90],
};

const dc = (d, c) => d.setDrawColor(...c);
const fc = (d, c) => d.setFillColor(...c);
const tc = (d, c) => d.setTextColor(...c);

function getDims(format) {
  return format === 'a3'
    ? { w: 420, h: 297, bx: 10, by: 10, S: 420 / 297 }
    : { w: 297, h: 210, bx: 8,  by: 8,  S: 1 };
}

// Sanitise text for the built-in helvetica font (no Unicode glyphs).
function safe(str) {
  return String(str ?? '')
    .replace(/[·•]/g, '-')   // middle dot / bullet -> hyphen
    .replace(/[×✕✖]/g, 'x')  // multiplication sign -> x
    .replace(/[⟷↔⇄]/g, 'L/R')// stray mirror arrows
    .replace(/№/g, 'No');
}

function drawHeader(doc, PG, info) {
  const { bx, by, w: PW, S } = PG;
  const x = bx + 0.7, y = by + 0.7;
  const w = PW - 2 * bx - 1.4;
  const h = 26 * S;

  // Outer box + bottom separator
  dc(doc, C.black); doc.setLineWidth(0.4);
  doc.rect(x, y, w, h);

  // Vertical dividers
  const col1 = 78 * S, col2 = w - 86 * S, col3 = w - 42 * S;
  dc(doc, C.grayXL); doc.setLineWidth(0.15);
  doc.line(x + col1, y, x + col1, y + h);
  doc.line(x + col2, y, x + col2, y + h);
  doc.line(x + col3, y, x + col3, y + h);
  doc.line(x + col2, y + h / 2, x + w, y + h / 2);
  doc.line(x + col3, y + h / 2, x + w, y + h / 2);

  // Company + logo
  let cx = x + 3 * S;
  if (info.logo) {
    const lw = 26 * S, lh = 13 * S, ly = y + (h - lh) / 2;
    try {
      const f = /jpe?g/i.test(info.logo.slice(0, 30)) ? 'JPEG' : 'PNG';
      doc.addImage(info.logo, f, cx, ly, lw, lh, undefined, 'FAST');
    } catch (e) { /* skip broken logo */ }
    cx += lw + 4 * S;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15 * S); tc(doc, C.black);
  doc.text(safe(info.companyName || 'COMPANY NAME'), cx, y + 10 * S);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7 * S); tc(doc, C.gray);
  doc.text('CUT LIST - PRODUCTION', cx, y + 16 * S);

  // Info boxes
  const label = (t, lx, ly) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(6 * S); tc(doc, C.gray); doc.text(safe(t), lx, ly); };
  const value = (t, lx, ly) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(9 * S); tc(doc, C.black); doc.text(safe(t).substring(0, 40), lx, ly); };

  label('PACK', x + col1 + 3 * S, y + 7 * S);
  value(info.title || '-', x + col1 + 3 * S, y + 13 * S);
  label('PROJECTS', x + col1 + 3 * S, y + h / 2 + 6 * S);
  value((info.projects || []).join(' - ') || '-', x + col1 + 3 * S, y + h / 2 + 12 * S);

  label('DATE', x + col2 + 3 * S, y + 7 * S);
  value(info.date || '-', x + col2 + 3 * S, y + 13 * S);
  label('PIECES', x + col2 + 3 * S, y + h / 2 + 6 * S);
  value(String(info.totalPieces ?? '-'), x + col2 + 3 * S, y + h / 2 + 12 * S);

  label('REV', x + col3 + 3 * S, y + 7 * S);
  value('A', x + col3 + 3 * S, y + 13 * S);
  label('PAGE', x + col3 + 3 * S, y + h / 2 + 6 * S);
  // page value stamped later

  return y + h;
}

function drawFooter(doc, PG, info) {
  const { bx, by, w: PW, h: PH, S } = PG;
  const y = PH - by - 3 * S;
  dc(doc, C.grayXL); doc.setLineWidth(0.15);
  doc.line(bx + 0.7, y - 1, PW - bx - 0.7, y - 1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5 * S); tc(doc, C.grayL);
  doc.text(safe([info.companyName, info.companyAddress].filter(Boolean).join(' - ')), bx + 3 * S, y + 2 * S);
}

export function exportCutListPDF(info) {
  const format = info.format === 'a4' ? 'a4' : (info.format === 'a3' ? 'a3' : 'a4');
  const PG = getDims(format);
  PG.tableW = PG.w - 2 * PG.bx - 6 * PG.S;
  const S = PG.S;
  const isPP = !!info.isPPMode;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format });

  const cols = isPP
    ? [
        { label: 'No.', dx: 0, mono: true },
        { label: 'Project', dx: 14 },
        { label: 'Window', dx: 42 },
        { label: 'Length (mm)', dx: 150, align: 'right', mono: true },
        { label: 'Qty', dx: 180, align: 'right', mono: true },
      ]
    : [
        { label: 'No.', dx: 0, mono: true },
        { label: 'Window', dx: 14 },
        { label: 'Length (mm)', dx: 130, align: 'right', mono: true },
        { label: 'Qty', dx: 165, align: 'right', mono: true },
      ];

  const x = PG.bx + 3 * S;
  const cardW = PG.tableW;
  const headBandH = 13 * S;   // card title band
  const colHeadH = 6 * S;     // column header row
  const rowH = 6.5 * S;       // data row
  const cardGap = 4 * S;      // gap between cards
  const topStart = PG.by + 0.7 + 26 * S + 7 * S;
  const bottom = PG.h - PG.by - 10 * S;

  drawHeader(doc, PG, info);
  drawFooter(doc, PG, info);
  let y = topStart;
  let lineNo = 0;

  const newPage = () => {
    doc.addPage();
    drawHeader(doc, PG, info);
    drawFooter(doc, PG, info);
    y = topStart;
  };

  // Draw the column-header row inside a card; returns new y.
  const drawCardCols = (cy) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5 * S); tc(doc, C.gray);
    cols.forEach((c) => doc.text(c.label, x + 8 * S + c.dx * S, cy, c.align === 'right' ? { align: 'right' } : undefined));
    return cy + colHeadH;
  };

  (info.groups || []).forEach((g) => {
    const dataRows = g.rows || [];
    const cardH = headBandH + colHeadH + dataRows.length * rowH + 3 * S;

    // Keep the card header with at least one row on the same page.
    const minNeeded = headBandH + colHeadH + rowH + 3 * S;
    if (y + minNeeded > bottom) newPage();

    const cardTop = y;
    let cy = y + headBandH - 4 * S; // baseline for title text

    // ── Title band ──
    const accentW = 5 * S; // left colour accent stripe width
    fc(doc, C.cardHead); doc.rect(x, cardTop, cardW, headBandH, 'F');
    // symbol pill
    const sym = safe(g.symbol || '');
    doc.setFont('courier', 'bold'); doc.setFontSize(8 * S);
    const pillTextW = doc.getTextWidth(sym);
    const pillPad = 2.4 * S;
    const pillW = pillTextW + pillPad * 2;
    const pillH = 8 * S;
    const pillX = x + accentW + 3 * S;
    const pillY = cardTop + (headBandH - pillH) / 2;
    const pillFill = g.mirror ? C.pillBlue : C.pillGray;
    const pillText = g.mirror ? C.pillBlueT : C.pillGrayT;
    fc(doc, pillFill);
    if (doc.roundedRect) doc.roundedRect(pillX, pillY, pillW, pillH, 1.2 * S, 1.2 * S, 'F');
    else doc.rect(pillX, pillY, pillW, pillH, 'F');
    tc(doc, pillText);
    doc.text(sym, pillX + pillPad, pillY + pillH - 2.4 * S);
    // element name + section
    let tx = pillX + pillW + 3 * S;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9 * S); tc(doc, C.black);
    doc.text(safe(g.element || ''), tx, cy);
    if (g.section) {
      const ew = doc.getTextWidth(safe(g.element || ''));
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8 * S); tc(doc, C.gray);
      doc.text(safe(`- ${g.section}`), tx + ew + 3 * S, cy);
    }

    y = cardTop + headBandH;
    // ── Column headers ──
    y = drawCardCols(y + 4.5 * S);

    // ── Data rows ──
    let zebra = 0;
    dataRows.forEach((r) => {
      if (y + rowH > bottom) {
        // Continue this card on a new page with a small repeated header.
        doc.setDrawColor(...C.cardBorder); doc.setLineWidth(0.4);
        if (doc.roundedRect) doc.roundedRect(x, cardTop, cardW, y - cardTop - rowH + 3 * S, 1.5 * S, 1.5 * S, 'S');
        newPage();
        // re-draw a compact continuation band
        fc(doc, C.cardHead); doc.rect(x, y, cardW, headBandH, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8 * S); tc(doc, C.gray);
        doc.text(safe(`${g.symbol}  ${g.element} (cont.)`), x + 4 * S, y + headBandH - 4.5 * S);
        y += headBandH;
        y = drawCardCols(y + 4.5 * S);
        zebra = 0;
      }
      if (zebra % 2 === 1) { fc(doc, C.rowBg); doc.rect(x + 6 * S, y - 4 * S, cardW - 6.5 * S, rowH, 'F'); }
      lineNo += 1;
      const cells = isPP
        ? [lineNo, r.projectNum || '-', r.window || '-', r.length, r.qty]
        : [lineNo, r.window || '-', r.length, r.qty];
      cols.forEach((c, ci) => {
        doc.setFont(c.mono ? 'courier' : 'helvetica', 'normal');
        doc.setFontSize(8 * S);
        tc(doc, C.dark);
        doc.text(safe(String(cells[ci] ?? '')), x + 8 * S + c.dx * S, y, c.align === 'right' ? { align: 'right' } : undefined);
      });
      y += rowH; zebra++;
    });

    // ── Card border around the whole card ──
    y += 3 * S;
    // ── Left colour accent stripe (full card height) ──
    const cardFullH = y - cardTop;
    const accent = g.mirror ? C.accentBlue : C.accentGray;
    fc(doc, accent);
    doc.rect(x, cardTop, 5 * S, cardFullH, 'F');
    // ── Card border around the whole card ──
    doc.setDrawColor(...C.cardBorder); doc.setLineWidth(0.6);
    if (doc.roundedRect) doc.roundedRect(x, cardTop, cardW, cardFullH, 1.5 * S, 1.5 * S, 'S');
    else doc.rect(x, cardTop, cardW, cardFullH, 'S');

    y += cardGap;
  });

  // Stamp page numbers (header Page box + footer right)
  const total = doc.internal.getNumberOfPages();
  const hx = PG.bx + 0.7;
  const hw = PG.w - 2 * PG.bx - 1.4;
  const col3 = hw - 42 * S;
  const hh = 26 * S;
  const fy = PG.h - PG.by - 3 * S;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9 * S); tc(doc, C.black);
    doc.text(`${p} / ${total}`, hx + col3 + 3 * S, PG.by + 0.7 + hh / 2 + 12 * S);
    doc.setFont('courier', 'normal'); doc.setFontSize(7 * S); tc(doc, C.gray);
    doc.text(`${p} / ${total}`, PG.w - PG.bx - 3 * S, fy + 2 * S, { align: 'right' });
  }

  doc.save(`CutList_${(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
