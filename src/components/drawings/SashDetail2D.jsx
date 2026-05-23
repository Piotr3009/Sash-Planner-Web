/**
 * SashDetail2D.jsx
 *
 * 2D detail view of a single sash (upper or lower).
 * Style matches approved bottom_sash_4x4_dims.svg reference.
 *
 * Conventions:
 *  - BAR_PATTERNS per-sash (matches 3D ParametricSashWindow.jsx, not legacy CONFIGURATIONS)
 *  - Bar width 22mm (matches 3D)
 *  - Dimension chains on top + left, overall dims bottom + right
 *  - V-notches at every bar–rail/stile junction, cross at every bar intersection
 *  - Click to expand
 *
 * Props:
 *  - windowSpec: full window specification
 *  - derived: result from calculateWindow() — uses sashWidth, topSashHeight, bottomSashHeight
 *  - type: 'upper' | 'lower'
 */
import { useMemo, useState } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { computeBarPositions, DimChainH, DimChainV, DimH, DimV } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, SC_DIVISOR } from './drawingTheme.js';

// BAR_PATTERNS (per-sash, matches 3D ParametricSashWindow.jsx)
// 4x4 = 1+1 bar = 4 panes per sash, NOT 16 panes
const BAR_PATTERNS = {
  'none': { h: 0, v: 0 },
  '2x2':  { h: 0, v: 1 },
  '3x3':  { h: 0, v: 2 },
  '4x4':  { h: 1, v: 1 },
  '6x6':  { h: 1, v: 2 },
  '9x9':  { h: 2, v: 2 },
};

// Constants matching approved reference SVG
const BAR_WIDTH = 22; // mm — matches 3D (hardcoded; will sync with calculations.js in Stage 3)

// Alias — wired to theme
const C = {
  outer:     COLORS.sash,
  rebate:    COLORS.glass,
  glassFill: COLORS.glass,
  meeting:   COLORS.meeting,
  label:     COLORS.label,
  dim:       COLORS.dim,
  notch:     COLORS.notch,
  title:     COLORS.title,
  subtitle:  COLORS.subtitle,
  bgFill:    'rgba(148,163,184,0.03)',
};

// Font sizes from theme
const FS_DIM_LARGE = SIZES.dimLarge;
const FS_DIM_SMALL = SIZES.dimSmall;
const FS_LABEL = SIZES.label;
const FS_TITLE = SIZES.title;
const FS_SUBTITLE = SIZES.subtitle;
const FS_NOTCH_NOTE = SIZES.notch;

// Stroke widths — now sourced from theme (px values, single source of truth)
const SW_OUTER = STROKES.outer;
const SW_REBATE = STROKES.rebate;
const SW_BAR = STROKES.bar;
const SW_NOTCH = STROKES.notch;
const SW_NOTCH_CIRCLE = STROKES.notchCircle;
const SW_DIM = STROKES.dim;
const SW_EXT = STROKES.ext;
const SW_LEADER = STROKES.leader;

// Helper: format dimension to 0.5mm precision (keeps half-mm values like 437.5)
// Math.round(437.5) = 438 (loses info); fmt(437.5) = "437.5"
function fmt(n) {
  const rounded = Math.round(n * 2) / 2; // round to nearest 0.5
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

// Helper: compute segments of a line (used for breaking bars at crossings)
function computeSegments(from, to, cutPairs) {
  if (cutPairs.length === 0) return [{ a: from, b: to }];
  const sortedCuts = [...cutPairs].sort((p, q) => p[0] - q[0]);
  const segs = [];
  let pos = from;
  for (const [cStart, cEnd] of sortedCuts) {
    if (cStart > pos) segs.push({ a: pos, b: cStart });
    pos = Math.max(pos, cEnd);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

export default function SashDetail2D({ windowSpec, derived, type = 'upper', onExpand, projectNumber }) {
  const [expanded, setExpanded] = useState(false);
  const isExternalExpand = !!onExpand;
  const handleExpand = (e) => {
    e.stopPropagation();
    if (isExternalExpand) { onExpand(); } else { setExpanded(!expanded); }
  };

  const geom = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const isUpper = type === 'upper';
    const sashW = derived.sashWidth;
    const sashH = isUpper ? derived.topSashHeight : derived.bottomSashHeight;
    if (!sashW || !sashH) return null;

    const stile = CONSTANTS.STILE_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;

    const topEdge = isUpper ? topRail : meetRail;
    const botEdge = isUpper ? meetRail : botRail;

    const glassX = stile;
    const glassY = topEdge;
    const glassW = sashW - 2 * stile;
    const glassH = sashH - topEdge - botEdge;

    const REBATE_OFFSET = 9;
    const rebateX = REBATE_OFFSET;
    const rebateY = REBATE_OFFSET;
    const rebateW = sashW - 2 * REBATE_OFFSET;
    const rebateH = sashH - 2 * REBATE_OFFSET;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BAR_PATTERNS[gridMode] || BAR_PATTERNS['none'];
    const v = pattern.v;
    const h = pattern.h;

    const { vBars, hBars, paneW, paneH } = computeBarPositions({
      glassX, glassY, glassW, glassH,
      vCount: v, hCount: h, barW: BAR_WIDTH,
    });

    const hasHorns = !!windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;

    return {
      sashW, sashH, stile, topEdge, botEdge,
      glassX, glassY, glassW, glassH,
      rebateX, rebateY, rebateW, rebateH,
      vBars, hBars, v, h,
      paneW, paneH,
      isUpper, hasHorns, hornExt,
      gridMode,
    };
  }, [windowSpec, derived, type]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const layoutSc = Math.max(geom.sashW, geom.sashH) / 500;
  const sw = (n) => n * layoutSc;

  const MGN_TOP_DIM = 80 * layoutSc;
  const MGN_LEFT_DIM = 80 * layoutSc;
  const MGN_RIGHT_DIM = 60 * layoutSc;
  const MGN_BOT_DIM = 60 * layoutSc;
  const MGN_TITLE = 40 * layoutSc;
  const MGN_HORN = geom.isUpper && geom.hornExt > 0 ? geom.hornExt + 20 * layoutSc : 0;

  const ox = MGN_LEFT_DIM;
  const oy = MGN_TOP_DIM;
  const totalW = ox + geom.sashW + MGN_RIGHT_DIM;
  const totalH = oy + geom.sashH + MGN_HORN + MGN_BOT_DIM + MGN_TITLE;
  const sc = totalW / SC_DIVISOR;
  const fs = (n) => `${n}px`;

  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  const hCuts = geom.hBars.map(hb => [hb.top, hb.bot]);
  const verticalEdgeSegments = computeSegments(geom.glassY, geom.glassY + geom.glassH, hCuts);

  const vCuts = geom.vBars.map(vb => [vb.left, vb.right]);
  const horizontalEdgeSegments = computeSegments(geom.glassX, geom.glassX + geom.glassW, vCuts);

  const label = geom.isUpper ? 'US' : 'LS';
  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `${label} — Front${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const glassType = windowSpec?.glass?.type || 'double';
  const glassFinish = windowSpec?.glass?.finish || 'clear';
  const subtitleText = `${geom.gridMode} · ${glassType} / ${glassFinish}`;

  // Top dim chain cut points
  const topCuts = [0, geom.stile];
  geom.vBars.forEach(vb => { topCuts.push(vb.left); topCuts.push(vb.right); });
  topCuts.push(geom.sashW - geom.stile);
  topCuts.push(geom.sashW);
  const topDimY = oy - 30 * sc;
  const topExtLineEnd = oy - 5 * sc;

  // Left dim chain cut points
  const leftCuts = [0, geom.topEdge];
  geom.hBars.forEach(hb => { leftCuts.push(hb.top); leftCuts.push(hb.bot); });
  leftCuts.push(geom.sashH - geom.botEdge);
  leftCuts.push(geom.sashH);
  const leftDimX = ox - 30 * sc;
  const leftExtLineEnd = ox - 5 * sc;

  return (
    <div className="w-full relative">
      <div
        className="absolute top-2 right-2 z-10 text-[10px] text-ink-400 bg-surface-700/80 px-2 py-1 rounded cursor-pointer hover:text-accent-400"
        onClick={handleExpand}
      >
        {isExternalExpand ? '⊕ Expand' : (expanded ? '⊖ Collapse' : '⊕ Expand')}
      </div>

      <div onClick={isExternalExpand ? handleExpand : () => setExpanded(!expanded)} className="cursor-pointer">
        <svg
          viewBox={`0 0 ${totalW} ${totalH}`}
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
          style={{ maxHeight: (expanded && !isExternalExpand) ? 'none' : '65vh', background: COLORS.bg }}
        >
          {/* OUTER SASH */}
          <rect
            x={X(0)} y={Y(0)} width={geom.sashW} height={geom.sashH}
            fill={C.bgFill} stroke={C.outer} style={{strokeWidth: `${SW_OUTER}px`}}
          />

          {/* OUTER REBATE — blue dashed */}
          <rect
            x={X(geom.rebateX)} y={Y(geom.rebateY)} width={geom.rebateW} height={geom.rebateH}
            fill="none" stroke={C.rebate} style={{strokeWidth: `${SW_REBATE}px`}} strokeOpacity={0.5}
            strokeDasharray={`${sw(4)},${sw(3)}`}
          />

          {/* GLASS REBATE — white solid */}
          <rect
            x={X(geom.glassX)} y={Y(geom.glassY)} width={geom.glassW} height={geom.glassH}
            fill={C.glassFill} fillOpacity={0.06}
            stroke={C.outer} style={{strokeWidth: `${SW_OUTER}px`}}
          />

          {/* HORNS (upper sash only, dashed projection) */}
          {geom.isUpper && geom.hasHorns && (
            <g>
              <line
                x1={X(2)} y1={Y(geom.sashH)}
                x2={X(2)} y2={Y(geom.sashH + geom.hornExt)}
                stroke={C.notch} style={{strokeWidth: `${STROKES.notch}px`}} strokeDasharray={`${sw(4)},${sw(3)}`} strokeOpacity={0.7}
              />
              <line
                x1={X(geom.sashW - 2)} y1={Y(geom.sashH)}
                x2={X(geom.sashW - 2)} y2={Y(geom.sashH + geom.hornExt)}
                stroke={C.notch} style={{strokeWidth: `${STROKES.notch}px`}} strokeDasharray={`${sw(4)},${sw(3)}`} strokeOpacity={0.7}
              />
              <text
                x={X(geom.sashW + 5 * sc)} y={Y(geom.sashH + geom.hornExt / 2)}
                fill={C.notch} style={{fontSize: fs(FS_NOTCH_NOTE)}} fontFamily={FONT_FAMILY} fillOpacity={0.7}
              >
                Horn {geom.hornExt}mm
              </text>
            </g>
          )}

          {/* VERTICAL BAR EDGES (broken at horizontal bar crossings) */}
          {geom.vBars.map((vb, i) => (
            <g key={`vb-${i}`}>
              {verticalEdgeSegments.map((seg, j) => (
                <g key={`vb-${i}-s-${j}`}>
                  <line
                    x1={X(vb.left)} y1={Y(seg.a)} x2={X(vb.left)} y2={Y(seg.b)}
                    stroke={C.outer} style={{strokeWidth: `${SW_BAR}px`}}
                  />
                  <line
                    x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                    stroke={C.outer} style={{strokeWidth: `${SW_BAR}px`}}
                  />
                </g>
              ))}
            </g>
          ))}

          {/* HORIZONTAL BAR EDGES (broken at vertical bar crossings) */}
          {geom.hBars.map((hb, j) => (
            <g key={`hb-${j}`}>
              {horizontalEdgeSegments.map((seg, i) => (
                <g key={`hb-${j}-s-${i}`}>
                  <line
                    x1={X(seg.a)} y1={Y(hb.top)} x2={X(seg.b)} y2={Y(hb.top)}
                    stroke={C.outer} style={{strokeWidth: `${SW_BAR}px`}}
                  />
                  <line
                    x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                    stroke={C.outer} style={{strokeWidth: `${SW_BAR}px`}}
                  />
                </g>
              ))}
            </g>
          ))}

          {/* CROSSES at bar intersections */}
          {geom.vBars.flatMap((vb, vi) =>
            geom.hBars.map((hb, hi) => (
              <g key={`cross-${vi}-${hi}`}>
                <line
                  x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
                  stroke={C.outer} style={{strokeWidth: `${SW_BAR}px`}}
                />
                <line
                  x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                  stroke={C.outer} style={{strokeWidth: `${SW_BAR}px`}}
                />
              </g>
            ))
          )}

          {/* V-NOTCHES — vertical bar ends meet top/bottom rails */}
          {geom.vBars.map((vb, i) => (
            <g key={`vn-${i}`}>
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.left)} y2={Y(geom.glassY)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.right)} y2={Y(geom.glassY)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <circle cx={X(vb.cx)} cy={Y(geom.glassY - 2)} r={sw(12)}
                fill="none" stroke={C.notch} style={{strokeWidth: `${SW_NOTCH_CIRCLE}px`}} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />

              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.left)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.right)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <circle cx={X(vb.cx)} cy={Y(geom.glassY + geom.glassH + 2)} r={sw(12)}
                fill="none" stroke={C.notch} style={{strokeWidth: `${SW_NOTCH_CIRCLE}px`}} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
            </g>
          ))}

          {/* V-NOTCHES — horizontal bar ends meet left/right stiles */}
          {geom.hBars.map((hb, j) => (
            <g key={`hn-${j}`}>
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.top)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.bot)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <circle cx={X(geom.glassX - 2)} cy={Y(hb.cy)} r={sw(12)}
                fill="none" stroke={C.notch} style={{strokeWidth: `${SW_NOTCH_CIRCLE}px`}} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />

              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.top)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.bot)}
                stroke={C.notch} style={{strokeWidth: `${SW_NOTCH}px`}} strokeOpacity={0.8} />
              <circle cx={X(geom.glassX + geom.glassW + 2)} cy={Y(hb.cy)} r={sw(12)}
                fill="none" stroke={C.notch} style={{strokeWidth: `${SW_NOTCH_CIRCLE}px`}} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
            </g>
          ))}

          {/* LABELS — green, sentence case */}
          <text x={X(geom.sashW / 2)} y={Y(geom.sashH - geom.botEdge / 2)}
            fill={C.label} style={{fontSize: fs(FS_LABEL)}} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle">
            {geom.isUpper ? 'MEETING RAIL' : 'BOTTOM RAIL'}
          </text>
          <text x={X(geom.sashW / 2)} y={Y(geom.topEdge / 2 + 3)}
            fill={C.label} style={{fontSize: fs(FS_LABEL)}} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle">
            {geom.isUpper ? 'TOP RAIL' : 'MEETING RAIL'}
          </text>
          <text x={X(geom.stile / 2)} y={Y(geom.sashH / 2)}
            fill={C.label} style={{fontSize: fs(FS_LABEL)}} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle"
            transform={`rotate(-90, ${X(geom.stile / 2)}, ${Y(geom.sashH / 2)})`}>
            LEFT STILE
          </text>
          <text x={X(geom.sashW - geom.stile / 2)} y={Y(geom.sashH / 2)}
            fill={C.label} style={{fontSize: fs(FS_LABEL)}} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle"
            transform={`rotate(90, ${X(geom.sashW - geom.stile / 2)}, ${Y(geom.sashH / 2)})`}>
            RIGHT STILE
          </text>

          {/* TOP DIMENSION CHAIN */}
          <DimChainH y={topDimY} extFrom={topExtLineEnd}
            cuts={topCuts.map(cx => X(cx))}
            sc={sc} minSegment={BAR_WIDTH * 2} fmt={fmt} />

          {/* LEFT DIMENSION CHAIN */}
          <DimChainV x={leftDimX} extFrom={leftExtLineEnd}
            cuts={leftCuts.map(cy => Y(cy))}
            sc={sc} minSegment={BAR_WIDTH * 2} fmt={fmt} />

          {/* OVERALL WIDTH (bottom) */}
          <DimH y={Y(geom.sashH) + 30 * sc}
            x1={X(0)} x2={X(geom.sashW)}
            extFrom={Y(geom.sashH) + 15 * sc}
            label={fmt(geom.sashW)} sc={sc} />

          {/* OVERALL HEIGHT (right) */}
          <DimV x={X(geom.sashW) + 30 * sc}
            y1={Y(0)} y2={Y(geom.sashH)}
            extFrom={X(geom.sashW) + 15 * sc}
            label={fmt(geom.sashH)} sc={sc} />

          {/* TITLE / SUBTITLE */}
          <text x={totalW / 2} y={totalH - 20 * sc}
            fill={C.title} style={{fontSize: fs(FS_TITLE)}} fontFamily={FONT_FAMILY}
            textAnchor="middle" fontWeight={WEIGHTS.title}>
            {titleText}
          </text>
          <text x={totalW / 2} y={totalH - 6 * sc}
            fill={C.subtitle} style={{fontSize: fs(FS_SUBTITLE)}} fontFamily={FONT_FAMILY}
            textAnchor="middle" fillOpacity={0.6}>
            {subtitleText}
          </text>
        </svg>
      </div>
    </div>
  );
}
