/**
 * drawingUtils.jsx
 *
 * Shared dimension-line components for all 2D drawings.
 * All text/stroke sizes come from drawingTheme.js.
 * Text and strokes are FIXED screen size (don't scale with viewBox).
 *
 * How it works:
 *  - Strokes use vectorEffect="non-scaling-stroke" → screen px always.
 *  - Text fontSize is multiplied by ts = vbw / VIEWBOX_REF internally,
 *    which exactly cancels the viewBox scaling → same screen px always.
 *  - Drawing files just pass vbw={totalW}. No sc anywhere.
 */
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, DIMS, VIEWBOX_REF } from './drawingTheme.js';

// ─── Legacy color aliases (used by FrontElevation, Glass, Sections) ───
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

export const FONT = { size: 14, family: FONT_FAMILY };

// Re-exports
export { SIZES, COLORS, WEIGHTS, STROKES, DIMS, VIEWBOX_REF } from './drawingTheme.js';

export const DIM_OFFSET = 40;
export const DIM_GAP = 35;
export const MARGIN = 80;

// ─── Helper: compute font size for a given vbw ───
// Use in drawing files for inline <text>:  fontSize={tfs(SIZES.annotation, totalW)}
export function tfs(size, vbw) {
  return size * vbw / VIEWBOX_REF;
}

// Non-scaling stroke props (reusable)
const NS = { vectorEffect: 'non-scaling-stroke' };

// ─── Horizontal dimension line ───
export function DimH({ y, x1, x2, label, small, vbw, extFrom }) {
  const ts = vbw / VIEWBOX_REF;
  const mid = (x1 + x2) / 2;
  const fs = (small ? SIZES.dimSmall : SIZES.dimLarge) * ts;
  const tick = DIMS.tickHalf * ts;
  const gap = DIMS.textGap * ts;
  const overshoot = DIMS.extOvershoot * ts;
  return (
    <g>
      {extFrom !== undefined && (
        <>
          <line x1={x1} y1={extFrom} x2={x1} y2={y + (y > extFrom ? overshoot : -overshoot)}
            stroke={STROKE.dim} strokeWidth={STROKES.ext} {...NS}
            strokeDasharray={DIMS.dashPattern} />
          <line x1={x2} y1={extFrom} x2={x2} y2={y + (y > extFrom ? overshoot : -overshoot)}
            stroke={STROKE.dim} strokeWidth={STROKES.ext} {...NS}
            strokeDasharray={DIMS.dashPattern} />
        </>
      )}
      <line x1={x1} y1={y} x2={x2} y2={y}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      <text x={mid} y={y - gap} fill={STROKE.dim} fontSize={fs}
        fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.dim}>
        {label}
      </text>
    </g>
  );
}

// ─── Vertical dimension line ───
export function DimV({ x, y1, y2, label, small, vbw, extFrom }) {
  const ts = vbw / VIEWBOX_REF;
  const mid = (y1 + y2) / 2;
  const fs = (small ? SIZES.dimSmall : SIZES.dimLarge) * ts;
  const tick = DIMS.tickHalf * ts;
  const offset = 14 * ts;
  const overshoot = DIMS.extOvershoot * ts;
  return (
    <g>
      {extFrom !== undefined && (
        <>
          <line x1={extFrom} y1={y1} x2={x + (x > extFrom ? overshoot : -overshoot)} y2={y1}
            stroke={STROKE.dim} strokeWidth={STROKES.ext} {...NS}
            strokeDasharray={DIMS.dashPattern} />
          <line x1={extFrom} y1={y2} x2={x + (x > extFrom ? overshoot : -overshoot)} y2={y2}
            stroke={STROKE.dim} strokeWidth={STROKES.ext} {...NS}
            strokeDasharray={DIMS.dashPattern} />
        </>
      )}
      <line x1={x} y1={y1} x2={x} y2={y2}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      <text x={x + offset} y={mid + 6 * ts} fill={STROKE.dim} fontSize={fs}
        fontFamily={FONT.family} fontWeight={WEIGHTS.dim}
        transform={`rotate(-90, ${x + offset}, ${mid + 6 * ts})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

// ─── Horizontal dimension CHAIN ───
export function DimChainH({ y, cuts, extFrom, vbw, minSegment = 40, fmt }) {
  if (!cuts || cuts.length < 2) return null;
  const ts = vbw / VIEWBOX_REF;
  const tick = DIMS.tickHalf * ts;
  const gap = DIMS.textGap * ts;
  const overshoot = DIMS.extOvershoot * ts;
  const leaderV = DIMS.leaderV * ts;
  const leaderHOff = DIMS.leaderHOff * ts;
  const fs = SIZES.dimSmall * ts;
  const format = fmt || ((n) => Math.round(n).toString());
  const x0 = cuts[0];
  const xN = cuts[cuts.length - 1];
  const extDir = extFrom !== undefined && y > extFrom ? 1 : -1;

  return (
    <g>
      {extFrom !== undefined && cuts.map((cx, i) => (
        <line key={`ext-${i}`}
          x1={cx} y1={extFrom} x2={cx} y2={y + extDir * overshoot}
          stroke={STROKE.dim} strokeWidth={STROKES.ext} {...NS}
          strokeDasharray={DIMS.dashPattern} />
      ))}
      <line x1={x0} y1={y} x2={xN} y2={y}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      {cuts.map((cx, i) => (
        <line key={`tk-${i}`}
          x1={cx} y1={y - tick} x2={cx} y2={y + tick}
          stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      ))}
      {cuts.slice(0, -1).map((cx, i) => {
        const nx = cuts[i + 1];
        const width = nx - cx;
        const mid = (cx + nx) / 2;
        const lbl = format(width);
        if (width < minSegment) {
          return (
            <g key={`lbl-${i}`}>
              <line x1={mid} y1={y} x2={mid} y2={y - leaderV}
                stroke={STROKE.dim} strokeWidth={STROKES.leader} {...NS} />
              <line x1={mid} y1={y - leaderV} x2={mid + leaderHOff} y2={y - leaderV}
                stroke={STROKE.dim} strokeWidth={STROKES.leader} {...NS} />
              <text x={mid + leaderHOff + 2 * ts} y={y - leaderV + 3 * ts}
                fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
                fontWeight={WEIGHTS.dim}>{lbl}</text>
            </g>
          );
        }
        return (
          <text key={`lbl-${i}`} x={mid} y={y - gap}
            fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
            textAnchor="middle" fontWeight={WEIGHTS.dim}>{lbl}</text>
        );
      })}
    </g>
  );
}

// ─── Vertical dimension CHAIN ───
export function DimChainV({ x, cuts, extFrom, vbw, minSegment = 40, fmt }) {
  if (!cuts || cuts.length < 2) return null;
  const ts = vbw / VIEWBOX_REF;
  const tick = DIMS.tickHalf * ts;
  const overshoot = DIMS.extOvershoot * ts;
  const leaderV = DIMS.leaderV * ts;
  const leaderHOff = DIMS.leaderHOff * ts;
  const offset = 14 * ts;
  const fs = SIZES.dimSmall * ts;
  const format = fmt || ((n) => Math.round(Math.abs(n)).toString());
  const y0 = cuts[0];
  const yN = cuts[cuts.length - 1];
  const extDir = extFrom !== undefined && x > extFrom ? 1 : -1;

  return (
    <g>
      {extFrom !== undefined && cuts.map((cy, i) => (
        <line key={`ext-${i}`}
          x1={extFrom} y1={cy} x2={x + extDir * overshoot} y2={cy}
          stroke={STROKE.dim} strokeWidth={STROKES.ext} {...NS}
          strokeDasharray={DIMS.dashPattern} />
      ))}
      <line x1={x} y1={y0} x2={x} y2={yN}
        stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      {cuts.map((cy, i) => (
        <line key={`tk-${i}`}
          x1={x - tick} y1={cy} x2={x + tick} y2={cy}
          stroke={STROKE.dim} strokeWidth={STROKES.dim} {...NS} />
      ))}
      {cuts.slice(0, -1).map((cy, i) => {
        const ny = cuts[i + 1];
        const height = Math.abs(ny - cy);
        const mid = (cy + ny) / 2;
        const lbl = format(height);
        if (height < minSegment) {
          return (
            <g key={`lbl-${i}`}>
              <line x1={x} y1={mid} x2={x - leaderV} y2={mid}
                stroke={STROKE.dim} strokeWidth={STROKES.leader} {...NS} />
              <line x1={x - leaderV} y1={mid} x2={x - leaderV} y2={mid - leaderHOff}
                stroke={STROKE.dim} strokeWidth={STROKES.leader} {...NS} />
              <text x={x - leaderV} y={mid - leaderHOff - 2 * ts}
                fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
                textAnchor="middle" fontWeight={WEIGHTS.dim}>{lbl}</text>
            </g>
          );
        }
        return (
          <text key={`lbl-${i}`} x={x + offset} y={mid + 6 * ts}
            fill={STROKE.dim} fontSize={fs} fontFamily={FONT.family}
            fontWeight={WEIGHTS.dim}
            transform={`rotate(-90, ${x + offset}, ${mid + 6 * ts})`}
            textAnchor="middle">{lbl}</text>
        );
      })}
    </g>
  );
}

// ─── Title block ───
export function TitleBlock({ x, y, title, subtitle, vbw }) {
  const ts = vbw / VIEWBOX_REF;
  const titleFs = SIZES.title * ts;
  const subFs = SIZES.subtitle * ts;
  const subGap = 20 * ts;
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
export function Label({ x, y, text, anchor = 'middle', opacity = 0.8, vbw }) {
  const ts = vbw / VIEWBOX_REF;
  const fs = SIZES.label * ts;
  return (
    <text x={x} y={y} fill={COLORS.label} fontSize={fs}
      fontFamily={FONT.family} textAnchor={anchor} fillOpacity={opacity}
      fontWeight={WEIGHTS.label}>
      {text}
    </text>
  );
}

// ─── Bar positioning helper (for SASH — wood bars, equal spacing within opening) ───
export function computeBarPositions({ glassX, glassY, glassW, glassH, vCount, hCount, barW }) {
  const paneW = vCount > 0 ? Math.max((glassW - vCount * barW) / (vCount + 1), 0) : glassW;
  const paneH = hCount > 0 ? Math.max((glassH - hCount * barW) / (hCount + 1), 0) : glassH;
  const vBars = [];
  for (let i = 0; i < vCount; i++) {
    const left = glassX + (i + 1) * paneW + i * barW;
    vBars.push({ cx: left + barW / 2, left, right: left + barW });
  }
  const hBars = [];
  for (let j = 0; j < hCount; j++) {
    const top = glassY + (j + 1) * paneH + j * barW;
    hBars.push({ cy: top + barW / 2, top, bot: top + barW });
  }
  return { vBars, hBars, paneW, paneH };
}

// ─── Glass spacer bar positions (derived from WOOD bar centers) ───
// Spacer bars share the same center line as wood bars but are 18mm wide (not 22mm).
// Positions returned in GLASS coordinate system (origin = glass top-left corner).
export function computeGlassBarPositions({ sashW, sashH, isUpper, vCount, hCount }) {
  const STILE = 57, TOP_RAIL = 57, MEET_RAIL = 43, BOT_RAIL = 90;
  const REBATE = 12.5, WOOD_BAR = 22, SPACER = 18;

  const topEdge = isUpper ? TOP_RAIL : MEET_RAIL;
  const botEdge = isUpper ? MEET_RAIL : BOT_RAIL;

  // Glass unit origin in sash coords
  const glassOriginX = STILE - REBATE;
  const glassOriginY = topEdge - REBATE;

  // Wood opening dimensions
  const woodW = sashW - 2 * STILE;
  const woodH = sashH - topEdge - botEdge;

  // Glass unit dimensions
  const glassW = woodW + 2 * REBATE;
  const glassH = woodH + 2 * REBATE;

  // Compute wood bar centers in sash coords, convert to glass coords
  const vBars = [];
  if (vCount > 0) {
    const woodPaneW = (woodW - vCount * WOOD_BAR) / (vCount + 1);
    for (let i = 0; i < vCount; i++) {
      const woodCenter = STILE + (i + 1) * woodPaneW + i * WOOD_BAR + WOOD_BAR / 2;
      const cx = woodCenter - glassOriginX;
      const left = cx - SPACER / 2;
      vBars.push({ cx, left, right: left + SPACER });
    }
  }

  const hBars = [];
  if (hCount > 0) {
    const woodPaneH = (woodH - hCount * WOOD_BAR) / (hCount + 1);
    for (let j = 0; j < hCount; j++) {
      const woodCenter = topEdge + (j + 1) * woodPaneH + j * WOOD_BAR + WOOD_BAR / 2;
      const cy = woodCenter - glassOriginY;
      const top = cy - SPACER / 2;
      hBars.push({ cy, top, bot: top + SPACER });
    }
  }

  return { vBars, hBars, glassW, glassH };
}
