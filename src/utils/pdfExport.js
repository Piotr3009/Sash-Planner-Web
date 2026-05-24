import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawTechnicalElevation } from '../engine/canvas-renderer.js';
import { buildCutListForWindow, buildPrecutForWindow, buildGlassListForWindow, buildHardwareList } from '../engine/lists.js';
import { optimisePrecut } from '../engine/optimizer.js';

function renderDrawingToDataURL(windowSpec, settings) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  // drawTechnicalElevation uses getBoundingClientRect; offscreen canvases
  // don't have one, so attach temporarily
  canvas.style.width = '1200px';
  canvas.style.height = '900px';
  canvas.style.position = 'fixed';
  canvas.style.left = '-99999px';
  canvas.style.top = '0';
  document.body.appendChild(canvas);
  try {
    drawTechnicalElevation(canvas, windowSpec, settings);
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(canvas);
  }
}

export async function exportWindowToPDF({ item, windowSpec, settings, derived }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = margin;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Production Core — ${item.window_number || 'Window'}`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${item.window_type || 'sash'} · ${item.width}×${item.height} mm · qty ${item.quantity || 1}`,
    margin,
    y
  );
  y += 4;
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 8;

  // Technical drawing image
  try {
    const dataUrl = renderDrawingToDataURL(windowSpec, settings);
    const imgWidth = 180;
    const imgHeight = 135;
    doc.addImage(dataUrl, 'PNG', margin, y, imgWidth, imgHeight);
    y += imgHeight + 6;
  } catch (e) {
    console.warn('Drawing render to PDF failed:', e);
  }

  // Cut list
  const cutList = buildCutListForWindow(derived, windowSpec);
  if (cutList.length) {
    if (y > 220) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Cut list', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Element', 'Section', 'Length (mm)', 'Qty', 'Material']],
      body: cutList.map((c) => [c.element, c.section || '', c.length, c.quantity, c.material || '']),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Precut + optimisation
  const precut = buildPrecutForWindow(derived, windowSpec, settings);
  const optim = optimisePrecut(precut, settings);
  optim.sashEngineering.forEach((g) => {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Pre-cut ${g.section} — ${g.summary.totalBars} bar(s)`, margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Bar', 'Cuts (mm)', 'Used (mm)', 'Waste (mm)', 'Util %']],
      body: g.bars.map((bar) => [
        bar.barId,
        bar.cuts.join(', '),
        Math.round(bar.used),
        Math.round(bar.waste),
        (bar.utilization * 100).toFixed(1)
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin }
    });
    y = doc.lastAutoTable.finalY + 6;
  });

  // Glass + hardware
  const glass = buildGlassListForWindow(derived, windowSpec);
  if (glass.length) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Glass', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Pane', 'W × H (mm)', 'Qty', 'Type', 'Spacer', 'Finish']],
      body: glass.map((p) => [p.label, `${p.width} × ${p.height}`, p.quantity, p.type, p.spacer, p.finish]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  const hardware = buildHardwareList(windowSpec);
  if (hardware.length) {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Hardware', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Detail', 'Qty']],
      body: hardware.map((h) => [h.item, h.detail, h.quantity]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin }
    });
  }

  doc.save(`${item.window_number || 'window'}-${item.id.slice(0, 6)}.pdf`);
}
