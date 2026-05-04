/**
 * dxfExport.js — minimal client-side DXF generator for window outline.
 *
 * Mirrors the structure of the Electron app's DXF generator (frame outline +
 * sash outline on separate layers). Coordinates are in millimetres so the
 * file imports cleanly into AutoCAD / SolidWorks / similar.
 */

import { CONSTANTS } from '../engine/calculations.js';

function lwpolyline(points, layer) {
  // 4 vertices for a closed rectangle, polyline flag 1 = closed
  let s = `0\nLWPOLYLINE\n8\n${layer}\n90\n${points.length}\n70\n1\n`;
  points.forEach(([x, y]) => {
    s += `10\n${x}\n20\n${y}\n`;
  });
  s += `0\nSEQEND\n`;
  return s;
}

function rectPoints(x, y, w, h) {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ];
}

export async function exportWindowToDXF({ item, windowSpec }) {
  const w = Number(windowSpec.frame.width);
  const h = Number(windowSpec.frame.height);

  let dxf = '0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';

  // Outer frame outline
  dxf += lwpolyline(rectPoints(0, 0, w, h), 'FRAME');

  // Inner sash opening
  const jambW = CONSTANTS.JAMBS_WIDTH;
  const headW = CONSTANTS.HEAD_WIDTH;
  const sillW = CONSTANTS.SILL_WIDTH;
  dxf += lwpolyline(rectPoints(jambW, sillW, w - 2 * jambW, h - headW - sillW), 'OPENING');

  // Sash outlines (top + bottom)
  const sashW = w - CONSTANTS.SASH_WIDTH_DEDUCTION;
  const totalSashH = h - CONSTANTS.SASH_HEIGHT_DEDUCTION;
  const topSashH = Math.floor((totalSashH - CONSTANTS.SASH_HEIGHT_DIFFERENCE) / 2);
  const botSashH = topSashH + CONSTANTS.SASH_HEIGHT_DIFFERENCE;
  const sashX = (w - sashW) / 2;
  const innerY = sillW;
  dxf += lwpolyline(rectPoints(sashX, innerY, sashW, botSashH), 'SASH-BOTTOM');
  dxf += lwpolyline(rectPoints(sashX, innerY + botSashH, sashW, topSashH), 'SASH-TOP');

  dxf += '0\nENDSEC\n0\nEOF\n';

  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${item.window_number || 'window'}-${item.id.slice(0, 6)}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
