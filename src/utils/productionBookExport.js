/**
 * productionBookExport.js
 *
 * Production Pack Book — combines individual section PDFs into ONE A3 book
 * for archiving. Each section generator is called with returnDoc:true so it
 * returns its PDF as bytes instead of saving; pdf-lib then:
 *   1. builds a title page,
 *   2. normalises every section page onto an A3 landscape page (centred/scaled),
 *   3. concatenates them in fixed order,
 *   4. stamps continuous page numbers across the whole book.
 *
 * Etap 1 sections: Overview, Glass, Cut List, Spraying, BOM (no prices).
 * (Pre-Cut + drawings + 3D are added in a later step.)
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// A3 landscape in PDF points (1mm = 2.83465pt). 420 x 297 mm.
const A3 = { w: 420 * 2.83465, h: 297 * 2.83465 };

/**
 * Normalise one source PDF (arraybuffer) onto A3 landscape pages in `out`.
 * Each source page is scaled to fit A3 (preserving aspect) and centred.
 */
async function appendNormalised(out, srcBytes) {
  if (!srcBytes) return;
  const src = await PDFDocument.load(srcBytes);
  const pageCount = src.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const embedded = await out.embedPdf(srcBytes, [i]);
    const ep = embedded[0];
    const page = out.addPage([A3.w, A3.h]);
    // Scale to fit A3 with a small margin, preserve aspect ratio.
    const margin = 8 * 2.83465;
    const availW = A3.w - margin * 2;
    const availH = A3.h - margin * 2;
    const scale = Math.min(availW / ep.width, availH / ep.height, 1.6);
    const w = ep.width * scale;
    const h = ep.height * scale;
    const x = (A3.w - w) / 2;
    const y = (A3.h - h) / 2;
    page.drawPage(ep, { x, y, width: w, height: h });
  }
}

function drawTitlePage(out, font, fontBold, info, sectionList) {
  const page = out.addPage([A3.w, A3.h]);
  const mm = (v) => v * 2.83465;
  const cx = A3.w / 2;

  // Outer frame
  page.drawRectangle({
    x: mm(12), y: mm(12), width: A3.w - mm(24), height: A3.h - mm(24),
    borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 1.2,
  });

  // Company name
  page.drawText(info.companyName || 'COMPANY NAME', {
    x: mm(24), y: A3.h - mm(40), size: 28, font: fontBold, color: rgb(0.1, 0.1, 0.1),
  });

  // Big title
  page.drawText('PRODUCTION PACK', {
    x: mm(24), y: A3.h - mm(70), size: 40, font: fontBold, color: rgb(0.1, 0.1, 0.1),
  });

  // Pack / project / date / rev block
  const line = (label, value, y) => {
    page.drawText(label, { x: mm(24), y, size: 11, font, color: rgb(0.55, 0.55, 0.55) });
    page.drawText(String(value || '-'), { x: mm(70), y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  };
  let ly = A3.h - mm(100);
  line('PACK', info.title, ly); ly -= mm(12);
  line('PROJECTS', (info.projects || []).join(', '), ly); ly -= mm(12);
  line('DATE', info.date, ly); ly -= mm(12);
  line('REV', info.rev || 'A', ly);

  // Table of contents
  let ty = A3.h - mm(160);
  page.drawText('CONTENTS', { x: mm(24), y: ty, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  ty -= mm(12);
  sectionList.forEach((name, i) => {
    page.drawText(`${i + 1}.  ${name}`, { x: mm(28), y: ty, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    ty -= mm(9);
  });

  // Footer
  page.drawText(info.companyName || '', {
    x: mm(24), y: mm(18), size: 8, font, color: rgb(0.6, 0.6, 0.6),
  });
}

function stampPageNumbers(out, font) {
  const pages = out.getPages();
  const total = pages.length;
  pages.forEach((page, idx) => {
    // Skip the title page (idx 0) for "Page x / y" if desired; keep continuous here.
    const label = `${idx + 1} / ${total}`;
    page.drawText(label, {
      x: A3.w - 70, y: 20, size: 9, font, color: rgb(0.35, 0.35, 0.35),
    });
  });
}

/**
 * Build the production book.
 * @param {object} opts
 *   info: { companyName, companyAddress, logo, title, projects[], date, rev }
 *   sections: ordered array of { name, bytes }  (bytes = arraybuffer or null)
 */
export async function buildProductionBook({ info, sections }) {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  const present = sections.filter((s) => s && s.bytes);
  drawTitlePage(out, font, fontBold, info, present.map((s) => s.name));

  for (const s of present) {
    await appendNormalised(out, s.bytes);
  }

  stampPageNumbers(out, font);

  const bytes = await out.save();
  // Trigger download in the browser.
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ProductionPack_${String(info.title || 'pack').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
