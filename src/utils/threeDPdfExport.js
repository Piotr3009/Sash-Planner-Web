/**
 * threeDPdfExport.js
 *
 * 3D Views PDF — styled to match the pre-cut list (shared pdfReport helper):
 * white header box, black border, print-friendly. Lays captured 3D thumbnails
 * in a grid, with a caption (No. / project / name / dimensions) under each.
 *
 * Images come from Window3DCaptureRig (fixed straight-front exterior PNGs).
 */
import { jsPDF } from 'jspdf';
import {
  getReportPage, REPORT_HEADER_H,
  drawReportBorder, drawReportHeader, drawReportFooter,
  stampReportPages,
} from './pdfReport.js';

// info: {
//   title, projects:[..], date, deadline, rev,
//   companyName, companyAddress, logo,
//   items: [{ image(dataURL|null), no, projectNum, name, dims }]
// }
export function exportThreeDPDF(info) {
  const PG = getReportPage('a4');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const headerInfo = {
    companyName: info.companyName || 'COMPANY NAME',
    subtitle: '3D VIEWS',
    companyAddress: info.companyAddress || '',
    logo: info.logo || '',
    mid: {
      topLabel: 'Pack', topValue: info.title || '',
      botLabel: 'Projects', botValue: (info.projects || []).join(', '),
    },
    c2: {
      topLabel: 'Date', topValue: info.date || '',
      botLabel: 'Deadline', botValue: info.deadline || '',
    },
    c3: { topLabel: 'Rev', topValue: info.rev || 'A' },
  };

  const drawChrome = () => {
    drawReportBorder(doc, PG);
    drawReportHeader(doc, PG, headerInfo);
    drawReportFooter(doc, PG, headerInfo);
  };

  drawChrome();

  const items = (info.items || []);

  // Grid layout
  const COLS = 3;
  const gap = 6;
  const capH = 11;
  const x0 = PG.bx + 4;
  const top = PG.by + REPORT_HEADER_H + 8;
  const bottom = PG.h - PG.by - 12;
  const contentW = PG.w - 2 * PG.bx - 8;
  const cellW = (contentW - gap * (COLS - 1)) / COLS;
  const imgSize = Math.min(cellW, 64);
  const cellH = imgSize + capH + gap;

  let col = 0;
  let y = top;

  items.forEach((it, i) => {
    // page break at the start of a row
    if (col === 0 && i > 0 && y + cellH > bottom) {
      doc.addPage();
      drawChrome();
      y = top;
    }

    const cx = x0 + col * (cellW + gap);
    const imgX = cx + (cellW - imgSize) / 2;

    // image cell border
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(imgX, y, imgSize, imgSize);

    if (it.image) {
      try {
        doc.addImage(it.image, 'PNG', imgX, y, imgSize, imgSize, undefined, 'FAST');
      } catch (e) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
        doc.text('image error', imgX + imgSize / 2, y + imgSize / 2, { align: 'center' });
      }
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
      doc.text('no image', imgX + imgSize / 2, y + imgSize / 2, { align: 'center' });
    }

    // caption
    const capY = y + imgSize + 4.5;
    const nameLine = `${it.no}. ${it.projectNum ? `${it.projectNum} · ` : ''}${it.name || ''}`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
    doc.text(String(nameLine).substring(0, 42), cx, capY);
    if (it.dims) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(136, 136, 136);
      doc.text(String(it.dims), cx, capY + 4.5);
    }

    col += 1;
    if (col >= COLS) { col = 0; y += cellH; }
  });

  stampReportPages(doc, PG);
  const fname = `3D-Views_${String(info.title || 'pack').replace(/[^\w-]+/g, '_')}.pdf`;
  doc.save(fname);
}
