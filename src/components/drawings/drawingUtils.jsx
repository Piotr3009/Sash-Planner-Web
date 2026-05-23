/**
 * drawingUtils.jsx
 *
 * Shared SVG drawing constants and dimension-line helper components.
 * Used by all 2D technical drawing components.
 * All colors/fonts sourced from drawingTheme.js.
 */
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, DIMS } from './drawingTheme.js';

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
export { SIZES, COLORS, WEIGHTS, STROKES, DIMS, SC_DIVISOR } from './drawingTheme.js';

export const DIM_OFFSET = 40;
export const DIM_GAP = 35;
export const MARGIN = 80;

// ─── Horizontal dimension line (CAD-style — extension lines + thin line + ticks) ───
// Optional: pass `extFrom` (y-coordinate of object edge) to draw extension lines
// from object to dim line. If omitted, only the dim line + ticks are drawn.
export function DimH({ y, x1, x2, label, small, sc, extFrom }) {
  const mid = (x1 + x2) / 2;
  const fs = `${small ? SIZES.dimSmall : SIZES.dimLarge}px`;
  const tick = sc * DIMS.tickHalf;
  const gap = sc * DIMS.textGap;
  const overshoot = sc * DIMS.extOvershoot;
  const dash = `${sc * 3},${sc * 2}`;
  return (
    <g>
      {/* Extension lines (dashed) — drawn from object edge to past dim line */}
      {extFrom !== undefined && (
        <>
          <line x1={x1} y1={extFrom} x2={x1} y2={y + (y > extFrom ? overshoot : -overshoot)}
            stroke={STROKE.dim} strokeWidth={`${STROKES.ext}px`} strokeDasharray={dash} />
          <line x1={x2} y1={extFrom} x2={x2} y2={y + (y > extFrom ? overshoot : -overshoot)}
            stroke={STROKE.dim} strokeWidth={`${STROKES.ext}px`} strokeDasharray={dash} />
        </>
      )}
      {/* Main dimension line */}
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      {/* Ticks at endpoints */}
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      {/* Label */}
      <text x={mid} y={y - gap} fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
        textAnchor="middle" fontWeight={WEIGHTS.dim}>{label}</text>
    </g>
  );
}

// ─── Vertical dimension line (CAD-style — extension lines + thin line + ticks) ───
// Optional: pass `extFrom` (x-coordinate of object edge) to draw extension lines.
export function DimV({ x, y1, y2, label, small, sc, extFrom }) {
  const mid = (y1 + y2) / 2;
  const fs = `${small ? SIZES.dimSmall : SIZES.dimLarge}px`;
  const tick = sc * DIMS.tickHalf;
  const offset = sc * 18;
  const overshoot = sc * DIMS.extOvershoot;
  const dash = `${sc * 3},${sc * 2}`;
  return (
    <g>
      {/* Extension lines (dashed) */}
      {extFrom !== undefined && (
        <>
          <line x1={extFrom} y1={y1} x2={x + (x > extFrom ? overshoot : -overshoot)} y2={y1}
            stroke={STROKE.dim} strokeWidth={`${STROKES.ext}px`} strokeDasharray={dash} />
          <line x1={extFrom} y1={y2} x2={x + (x > extFrom ? overshoot : -overshoot)} y2={y2}
            stroke={STROKE.dim} strokeWidth={`${STROKES.ext}px`} strokeDasharray={dash} />
        </>
      )}
      {/* Main dimension line */}
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      {/* Ticks */}
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      {/* Label (rotated -90°) */}
      <text x={x + offset} y={mid + sc * 8} fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
        fontWeight={WEIGHTS.dim} transform={`rotate(-90, ${x + offset}, ${mid + sc * 8})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

// ─── Horizontal dimension CHAIN ───
// Renders one dim line with multiple cuts (e.g., [0, 86, 914, 1000] → segments 86|828|86).
// Each cut gets an extension line (from extFrom y-coord) + tick.
// Each segment gets a label (centered if wide enough, else with leader).
// `cuts`: ascending x-coords of break points (must have >= 2)
// `extFrom`: y-coord where extension lines start (object edge); omit to skip ext lines
// `minSegment`: segments narrower than this use a leader-out label (default 40 SVG units)
export function DimChainH({ y, cuts, extFrom, sc, minSegment = 40, fmt }) {
  if (!cuts || cuts.length < 2) return null;
  const tick = sc * DIMS.tickHalf;
  const gap = sc * DIMS.textGap;
  const overshoot = sc * DIMS.extOvershoot;
  const dash = `${sc * 3},${sc * 2}`;
  const leaderV = sc * DIMS.leaderV;
  const leaderHOff = sc * DIMS.leaderHOff;
  const fs = `${SIZES.dimSmall}px`;
  const format = fmt || ((n) => Math.round(n).toString());
  const x0 = cuts[0];
  const xN = cuts[cuts.length - 1];
  const extDir = extFrom !== undefined && y > extFrom ? 1 : -1;

  return (
    <g>
      {/* Extension lines per cut */}
      {extFrom !== undefined && cuts.map((cx, i) => (
        <line key={`ext-${i}`}
          x1={cx} y1={extFrom} x2={cx} y2={y + extDir * overshoot}
          stroke={STROKE.dim} strokeWidth={`${STROKES.ext}px`} strokeDasharray={dash} />
      ))}
      {/* Main dimension line (full chain length) */}
      <line x1={x0} y1={y} x2={xN} y2={y} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      {/* Tick at each cut */}
      {cuts.map((cx, i) => (
        <line key={`tk-${i}`}
          x1={cx} y1={y - tick} x2={cx} y2={y + tick}
          stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      ))}
      {/* Segment labels */}
      {cuts.slice(0, -1).map((cx, i) => {
        const nx = cuts[i + 1];
        const width = nx - cx;
        const mid = (cx + nx) / 2;
        const label = format(width);
        if (width < minSegment) {
          // Use leader for narrow segment
          return (
            <g key={`lbl-${i}`}>
              <line x1={mid} y1={y} x2={mid} y2={y - leaderV}
                stroke={STROKE.dim} strokeWidth={`${STROKES.leader}px`} />
              <line x1={mid} y1={y - leaderV} x2={mid + leaderHOff} y2={y - leaderV}
                stroke={STROKE.dim} strokeWidth={`${STROKES.leader}px`} />
              <text x={mid + leaderHOff + sc * 2} y={y - leaderV + sc * 3}
                fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
                fontWeight={WEIGHTS.dim}>{label}</text>
            </g>
          );
        }
        return (
          <text key={`lbl-${i}`} x={mid} y={y - gap}
            fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
            textAnchor="middle" fontWeight={WEIGHTS.dim}>{label}</text>
        );
      })}
    </g>
  );
}

// ─── Vertical dimension CHAIN ───
export function DimChainV({ x, cuts, extFrom, sc, minSegment = 40, fmt }) {
  if (!cuts || cuts.length < 2) return null;
  const tick = sc * DIMS.tickHalf;
  const overshoot = sc * DIMS.extOvershoot;
  const dash = `${sc * 3},${sc * 2}`;
  const leaderV = sc * DIMS.leaderV;
  const leaderHOff = sc * DIMS.leaderHOff;
  const offset = sc * 18;
  const fs = `${SIZES.dimSmall}px`;
  const format = fmt || ((n) => Math.round(Math.abs(n)).toString());
  const y0 = cuts[0];
  const yN = cuts[cuts.length - 1];
  const extDir = extFrom !== undefined && x > extFrom ? 1 : -1;

  return (
    <g>
      {/* Extension lines per cut */}
      {extFrom !== undefined && cuts.map((cy, i) => (
        <line key={`ext-${i}`}
          x1={extFrom} y1={cy} x2={x + extDir * overshoot} y2={cy}
          stroke={STROKE.dim} strokeWidth={`${STROKES.ext}px`} strokeDasharray={dash} />
      ))}
      {/* Main dimension line */}
      <line x1={x} y1={y0} x2={x} y2={yN} stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      {/* Tick at each cut */}
      {cuts.map((cy, i) => (
        <line key={`tk-${i}`}
          x1={x - tick} y1={cy} x2={x + tick} y2={cy}
          stroke={STROKE.dim} strokeWidth={`${STROKES.dim}px`} />
      ))}
      {/* Segment labels (rotated -90°) */}
      {cuts.slice(0, -1).map((cy, i) => {
        const ny = cuts[i + 1];
        const height = Math.abs(ny - cy);
        const mid = (cy + ny) / 2;
        const label = format(height);
        if (height < minSegment) {
          return (
            <g key={`lbl-${i}`}>
              <line x1={x} y1={mid} x2={x - leaderV} y2={mid}
                stroke={STROKE.dim} strokeWidth={`${STROKES.leader}px`} />
              <line x1={x - leaderV} y1={mid} x2={x - leaderV} y2={mid - leaderHOff}
                stroke={STROKE.dim} strokeWidth={`${STROKES.leader}px`} />
              <text x={x - leaderV} y={mid - leaderHOff - sc * 2}
                fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
                textAnchor="middle" fontWeight={WEIGHTS.dim}>{label}</text>
            </g>
          );
        }
        return (
          <text key={`lbl-${i}`} x={x + offset} y={mid + sc * 8}
            fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
            fontWeight={WEIGHTS.dim} transform={`rotate(-90, ${x + offset}, ${mid + sc * 8})`}
            textAnchor="middle">{label}</text>
        );
      })}
    </g>
  );
}

// ─── Title block ───
export function TitleBlock({ x, y, title, subtitle, sc }) {
  const titleFs = `${SIZES.title}px`;
  const subFs = `${SIZES.subtitle}px`;
  const subGap = sc * 25;
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
  const fs = `${SIZES.label}px`;
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
