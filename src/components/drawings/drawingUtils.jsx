/**
 * drawingUtils.jsx
 *
 * Shared SVG drawing constants and dimension-line helper components.
 * Used by all 2D technical drawing components.
 * All colors/fonts sourced from drawingTheme.js.
 */
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS } from './drawingTheme.js';

// Legacy exports — wired to theme (used by Glass, Sections, Elevation)
export const STROKE = {
  frame:       COLORS.frame,
  sash:        COLORS.sash,
  bar:         COLORS.bar,
  glass:       COLORS.glass,
  glassOpacity: COLORS.glassOpacity,
  dim:         COLORS.dim,
  dimText:     COLORS.title,
  horn:        COLORS.horn,
  section:     COLORS.section,
  sectionFill: COLORS.sectionFill,
  label:       COLORS.label,
};

export const FONT = {
  size: 14,
  family: FONT_FAMILY,
};

// Re-export theme values for consumers
export { SIZES, COLORS, WEIGHTS, SC_DIVISOR } from './drawingTheme.js';

export const DIM_OFFSET = 40;
export const DIM_GAP = 35;
export const MARGIN = 80;

// ─── Horizontal dimension line ───
export function DimH({ y, x1, x2, label, small, sc }) {
  const mid = (x1 + x2) / 2;
  const fs = sc
    ? sc * (small ? SIZES.dimSmall : SIZES.dimLarge)
    : (small ? FONT.size * 0.7 : FONT.size * 0.85);
  const tick = sc ? sc * (small ? 8 : 14) : (small ? 4 : 6);
  const sw = sc ? sc * 1.5 : 0.5;
  const gap = sc ? sc * 10 : 6;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={STROKE.dim} strokeWidth={sw} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke={STROKE.dim} strokeWidth={sw} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke={STROKE.dim} strokeWidth={sw} />
      <text x={mid} y={y - gap} fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
        textAnchor="middle" fontWeight={WEIGHTS.dim}>{label}</text>
    </g>
  );
}

// ─── Vertical dimension line ───
export function DimV({ x, y1, y2, label, small, sc }) {
  const mid = (y1 + y2) / 2;
  const fs = sc
    ? sc * (small ? SIZES.dimSmall : SIZES.dimLarge)
    : (small ? FONT.size * 0.7 : FONT.size * 0.85);
  const tick = sc ? sc * (small ? 8 : 14) : (small ? 4 : 6);
  const sw = sc ? sc * 1.5 : 0.5;
  const offset = sc ? sc * 18 : 8;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={STROKE.dim} strokeWidth={sw} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={STROKE.dim} strokeWidth={sw} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke={STROKE.dim} strokeWidth={sw} />
      <text x={x + offset} y={mid + (sc ? sc * 8 : 4)} fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
        fontWeight={WEIGHTS.dim} transform={`rotate(-90, ${x + offset}, ${mid + (sc ? sc * 8 : 4)})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

// ─── Title block ───
export function TitleBlock({ x, y, title, subtitle, sc }) {
  const titleFs = sc ? sc * SIZES.title : FONT.size * 1.1;
  const subFs = sc ? sc * SIZES.subtitle : FONT.size * 0.75;
  const subGap = sc ? sc * 25 : 18;
  return (
    <g>
      <text x={x} y={y} fill={COLORS.title} fontSize={titleFs}
        fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.title}>
        {title}
      </text>
      {subtitle && (
        <text x={x} y={y + subGap} fill={COLORS.subtitle} fontSize={subFs}
          fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>
          {subtitle}
        </text>
      )}
    </g>
  );
}

// ─── Label helper ───
export function Label({ x, y, text, anchor = 'middle', opacity = 0.8, sc }) {
  const fs = sc ? sc * SIZES.label : FONT.size * 0.7;
  return (
    <text x={x} y={y} fill={COLORS.label} fontSize={fs}
      fontFamily={FONT.family} textAnchor={anchor} fillOpacity={opacity} fontWeight={WEIGHTS.label}>
      {text}
    </text>
  );
}

// ─── Bar positioning helper ───
// Returns positions where ALL panes are equal width/height
// (NOT equal centre-to-centre spacing — that was the legacy bug).
//
// Math: paneW = (glassW - vCount * barW) / (vCount + 1)
//       bar[i].left = glassX + (i + 1) * paneW + i * barW
//
// For a sash with v=2 bars in a 807mm glass area, barW=22mm:
//   paneW = (807 - 44) / 3 = 254.33mm  (all 3 panes equal)
//
// Returns: { vBars: [{cx, left, right}], hBars: [{cy, top, bot}], paneW, paneH }
export function computeBarPositions({ glassX, glassY, glassW, glassH, vCount, hCount, barW }) {
  const paneW = vCount > 0 ? Math.max((glassW - vCount * barW) / (vCount + 1), 0) : glassW;
  const paneH = hCount > 0 ? Math.max((glassH - hCount * barW) / (hCount + 1), 0) : glassH;

  const vBars = [];
  for (let i = 0; i < vCount; i++) {
    const left = glassX + (i + 1) * paneW + i * barW;
    const right = left + barW;
    const cx = left + barW / 2;
    vBars.push({ cx, left, right });
  }

  const hBars = [];
  for (let j = 0; j < hCount; j++) {
    const top = glassY + (j + 1) * paneH + j * barW;
    const bot = top + barW;
    const cy = top + barW / 2;
    hBars.push({ cy, top, bot });
  }

  return { vBars, hBars, paneW, paneH };
}
