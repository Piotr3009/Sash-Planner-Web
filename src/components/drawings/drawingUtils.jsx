/**
 * drawingUtils.jsx
 *
 * Shared SVG drawing constants and dimension-line helper components.
 * Used by all 2D technical drawing components.
 */

// Drawing style constants (CAD-like on dark background)
export const STROKE = {
  frame: '#94A3B8',
  sash: '#CBD5E1',
  bar: '#94A3B8',
  glass: '#0EA5E9',
  glassOpacity: 0.12,
  dim: '#00B4A0',
  dimText: '#E2E8F0',
  horn: '#F59E0B',
  section: '#7C8FA6',
  sectionFill: '#94A3B8',
  label: '#94A3B8',
};

export const FONT = {
  size: 14,
  family: 'DM Sans, system-ui, sans-serif',
};

export const DIM_OFFSET = 40;
export const DIM_GAP = 35;
export const MARGIN = 80;

// ─── Horizontal dimension line ───
export function DimH({ y, x1, x2, label, small }) {
  const mid = (x1 + x2) / 2;
  const fs = small ? FONT.size * 0.7 : FONT.size * 0.85;
  const tick = small ? 4 : 6;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={STROKE.dim} strokeWidth={0.5} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke={STROKE.dim} strokeWidth={0.5} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke={STROKE.dim} strokeWidth={0.5} />
      <text x={mid} y={y - 6} fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
        textAnchor="middle" fontWeight="500">{label}</text>
    </g>
  );
}

// ─── Vertical dimension line ───
export function DimV({ x, y1, y2, label, small }) {
  const mid = (y1 + y2) / 2;
  const fs = small ? FONT.size * 0.7 : FONT.size * 0.85;
  const tick = small ? 4 : 6;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={STROKE.dim} strokeWidth={0.5} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={STROKE.dim} strokeWidth={0.5} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke={STROKE.dim} strokeWidth={0.5} />
      <text x={x + 8} y={mid + 4} fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
        fontWeight="500" transform={`rotate(-90, ${x + 8}, ${mid + 4})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

// ─── Title block ───
export function TitleBlock({ x, y, title, subtitle }) {
  return (
    <g>
      <text x={x} y={y} fill={STROKE.dimText} fontSize={FONT.size * 1.1}
        fontFamily={FONT.family} textAnchor="middle" fontWeight="600">
        {title}
      </text>
      {subtitle && (
        <text x={x} y={y + 18} fill={STROKE.label} fontSize={FONT.size * 0.75}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.6}>
          {subtitle}
        </text>
      )}
    </g>
  );
}

// ─── Label helper ───
export function Label({ x, y, text, anchor = 'middle', opacity = 0.6 }) {
  return (
    <text x={x} y={y} fill={STROKE.label} fontSize={FONT.size * 0.7}
      fontFamily={FONT.family} textAnchor={anchor} fillOpacity={opacity}>
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
