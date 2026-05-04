/**
 * canvas-renderer.js — 2D technical elevation drawing on Canvas.
 *
 * Adapted from Windows-App-electron-/js/renderer.js, refactored to:
 *   - target a passed-in canvas element instead of a global one
 *   - stop relying on a global `redraw-request` event / panzoom singleton
 *   - work purely off windowSpec + settings (no global state.js)
 *
 * Style: black-on-white CAD look with red dimension lines (matches the
 * original technical-drawing aesthetic).
 */

import { CONSTANTS, deriveWindowData } from './calculations.js';

const STYLES = {
  background: '#ffffff',
  frameFill: '#f1f5f9',
  frameStroke: '#0f172a',
  sashFill: '#ffffff',
  sashStroke: '#334155',
  glassFill: 'rgba(224, 242, 254, 0.3)',
  dimensionColor: '#dc2626',
  dimensionText: '#dc2626',
  barStroke: '#0f172a'
};

function clearCanvas(ctx, w, h) {
  ctx.fillStyle = STYLES.background;
  ctx.fillRect(0, 0, w, h);
}

function drawRect(ctx, x, y, w, h, fill, stroke) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }
}

function drawDimensionLine(ctx, x1, y1, x2, y2, text, offset = 40) {
  ctx.save();
  ctx.strokeStyle = STYLES.dimensionColor;
  ctx.fillStyle = STYLES.dimensionColor;
  ctx.lineWidth = 1;
  ctx.font = '600 12px Inter, sans-serif';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  let udx = -dy / len;
  let udy = dx / len;
  if (Math.abs(dx) < 0.001 && offset > 0) {
    udx = -1;
    udy = 0;
  }

  const ox = udx * offset;
  const oy = udy * offset;

  const p1x = x1 + ox;
  const p1y = y1 + oy;
  const p2x = x2 + ox;
  const p2y = y2 + oy;

  // Witness lines (extension lines from the part to the dim line)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(p1x + udx * 5, p1y + udy * 5);
  ctx.moveTo(x2, y2);
  ctx.lineTo(p2x + udx * 5, p2y + udy * 5);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
  ctx.stroke();

  // Main dimension line
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.strokeStyle = STYLES.dimensionColor;
  ctx.stroke();

  // Architectural tick marks (45° crosses)
  const tickSize = 4;
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.moveTo(p1x - tickSize, p1y - tickSize);
  ctx.lineTo(p1x + tickSize, p1y + tickSize);
  ctx.moveTo(p2x - tickSize, p2y - tickSize);
  ctx.lineTo(p2x + tickSize, p2y + tickSize);
  ctx.stroke();

  // Text background + label
  const midX = (p1x + p2x) / 2;
  const midY = (p1y + p2y) / 2;
  ctx.fillStyle = STYLES.background;
  const textW = ctx.measureText(text).width + 8;
  ctx.fillRect(midX - textW / 2, midY - 8, textW, 16);
  ctx.fillStyle = STYLES.dimensionText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, midX, midY);
  ctx.restore();
}

export function drawTechnicalElevation(canvas, windowSpec, settings = {}) {
  if (!canvas || !windowSpec || !windowSpec.frame) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  clearCanvas(ctx, rect.width, rect.height);

  const frameWidth = Number(windowSpec.frame.width);
  const frameHeight = Number(windowSpec.frame.height);
  if (!frameWidth || !frameHeight) return;

  let derived;
  try {
    derived = deriveWindowData(windowSpec, settings);
  } catch (e) {
    console.error('Calculation failed in canvas renderer:', e);
    return;
  }

  // Fit-to-canvas scale, single zoom level (no pan/zoom for now — renderer
  // is meant to drop into a static drawing tab; user can re-render on resize)
  const margin = 90;
  const maxDim = Math.max(frameWidth, frameHeight);
  const fitScale = Math.min((rect.width - margin * 2) / maxDim, (rect.height - margin * 2) / maxDim);
  const finalScale = fitScale > 0 ? fitScale : 0.1;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const startX = centerX - (frameWidth * finalScale) / 2;
  const startY = centerY - (frameHeight * finalScale) / 2;

  const C = CONSTANTS;
  const fw = frameWidth * finalScale;
  const fh = frameHeight * finalScale;

  // 1. Frame outline
  drawRect(ctx, startX, startY, fw, fh, STYLES.frameFill, STYLES.frameStroke);

  const JAMB_W = C.JAMBS_WIDTH * finalScale;
  const HEAD_W = C.HEAD_WIDTH * finalScale;
  const SILL_W = C.SILL_WIDTH * finalScale;

  const innerX = startX + JAMB_W;
  const innerY = startY + HEAD_W;
  const innerW = fw - 2 * JAMB_W;
  const innerH = fh - HEAD_W - SILL_W;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(innerX, innerY, innerW, innerH);
  ctx.strokeStyle = STYLES.frameStroke;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(innerX, innerY, innerW, innerH);

  // 2. Sashes (top and bottom — heights from derived data)
  const sashW = derived.sashWidth * finalScale;
  const topSashH = (derived.topSashHeight || derived.sashHeight / 2) * finalScale;
  const botSashH = (derived.bottomSashHeight || derived.sashHeight / 2) * finalScale;
  const sashX = startX + (fw - sashW) / 2;
  const topSashY = startY + HEAD_W + 3 * finalScale;
  const botSashY = startY + fh - SILL_W - 3 * finalScale - botSashH;

  drawRect(ctx, sashX, topSashY, sashW, topSashH, STYLES.sashFill, STYLES.sashStroke);
  drawRect(ctx, sashX, botSashY, sashW, botSashH, STYLES.sashFill, STYLES.sashStroke);

  // 3. Bars + glass
  const STILE_W = C.STILE_WIDTH * finalScale;
  const TOP_RAIL_H = C.TOP_RAIL_WIDTH * finalScale;
  const BOT_RAIL_H = C.BOTTOM_RAIL_WIDTH * finalScale;
  const MEET_RAIL_H = C.MEETING_RAIL_WIDTH * finalScale;
  const BAR_W = C.GLAZING_BAR_WIDTH * finalScale;

  const glassX = sashX + STILE_W;
  const glassW = sashW - 2 * STILE_W;
  const glassTopY = topSashY + TOP_RAIL_H;
  const glassTopH = topSashH - TOP_RAIL_H - MEET_RAIL_H;
  const glassBotY = botSashY + MEET_RAIL_H;
  const glassBotH = botSashH - MEET_RAIL_H - BOT_RAIL_H;

  ctx.fillStyle = STYLES.glassFill;
  if (glassTopH > 0) ctx.fillRect(glassX, glassTopY, glassW, glassTopH);
  if (glassBotH > 0) ctx.fillRect(glassX, glassBotY, glassW, glassBotH);

  const bars =
    windowSpec.sash?.grid?.mode === 'custom' && windowSpec.sash?.grid?.customBars
      ? windowSpec.sash.grid.customBars
      : derived.barPositions;

  ctx.fillStyle = STYLES.barStroke;
  ctx.strokeStyle = STYLES.barStroke;
  ctx.lineWidth = 1;

  const drawBars = (baseY, glassH) => {
    if (glassH <= 0) return;
    if (bars?.vertical) {
      bars.vertical.forEach((pos) => {
        const bx = glassX + pos * finalScale - BAR_W / 2;
        ctx.fillRect(bx, baseY, BAR_W, glassH);
        ctx.strokeRect(bx, baseY, BAR_W, glassH);
      });
    }
    if (bars?.horizontal) {
      bars.horizontal.forEach((pos) => {
        const by = baseY + pos * finalScale - BAR_W / 2;
        if (pos * finalScale < glassH) {
          ctx.fillRect(glassX, by, glassW, BAR_W);
          ctx.strokeRect(glassX, by, glassW, BAR_W);
        }
      });
    }
  };
  drawBars(glassTopY, glassTopH);
  drawBars(glassBotY, glassBotH);

  // 4. Horns (decorative extensions on stiles, when enabled)
  if (windowSpec.sash?.horns) {
    const hornExt = (windowSpec.sash?.hornExtension || 70) * finalScale;
    const hornY = topSashY + topSashH;
    drawRect(ctx, sashX, hornY, STILE_W, hornExt, STYLES.sashFill, STYLES.sashStroke);
    drawRect(ctx, sashX + sashW - STILE_W, hornY, STILE_W, hornExt, STYLES.sashFill, STYLES.sashStroke);
  }

  // 5. Dimensions (overall width on top, overall height on left,
  // sash heights inset on the right, glass widths under the frame)
  drawDimensionLine(ctx, startX, startY, startX + fw, startY, `${Math.round(frameWidth)} mm`, 35);
  drawDimensionLine(ctx, startX, startY, startX, startY + fh, `${Math.round(frameHeight)} mm`, 35);
  drawDimensionLine(
    ctx,
    startX + fw,
    topSashY,
    startX + fw,
    topSashY + topSashH,
    `${Math.round(derived.topSashHeight)} mm`,
    -25
  );
  drawDimensionLine(
    ctx,
    startX + fw,
    botSashY,
    startX + fw,
    botSashY + botSashH,
    `${Math.round(derived.bottomSashHeight)} mm`,
    -25
  );
  drawDimensionLine(ctx, sashX, startY + fh, sashX + sashW, startY + fh, `Sash ${Math.round(derived.sashWidth)} mm`, -30);
}

export const TECHNICAL_STYLES = STYLES;
