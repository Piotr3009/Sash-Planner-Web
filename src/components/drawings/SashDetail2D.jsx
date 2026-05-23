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
import { computeBarPositions } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS } from './drawingTheme.js';

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

// Base stroke widths (multiplied by sc factor)
const SW_OUTER = 1;
const SW_REBATE = 0.8;
const SW_BAR = 1;
const SW_NOTCH = 1.2;
const SW_NOTCH_CIRCLE = 0.5;
const SW_DIM = 0.7;
const SW_EXT = 0.3;
const SW_LEADER = 0.3;

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

  const sc = Math.max(geom.sashW, geom.sashH) / 500;
  const fs = (n) => n * sc;
  const sw = (n) => n * sc;

  const MGN_TOP_DIM = 80 * sc;
  const MGN_LEFT_DIM = 80 * sc;
  const MGN_RIGHT_DIM = 60 * sc;
  const MGN_BOT_DIM = 60 * sc;
  const MGN_TITLE = 40 * sc;
  const MGN_HORN = geom.isUpper && geom.hornExt > 0 ? geom.hornExt + 20 * sc : 0;

  const ox = MGN_LEFT_DIM;
  const oy = MGN_TOP_DIM;
  const totalW = ox + geom.sashW + MGN_RIGHT_DIM;
  const totalH = oy + geom.sashH + MGN_HORN + MGN_BOT_DIM + MGN_TITLE;

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
            fill={C.bgFill} stroke={C.outer} strokeWidth={sw(SW_OUTER)}
          />

          {/* OUTER REBATE — blue dashed */}
          <rect
            x={X(geom.rebateX)} y={Y(geom.rebateY)} width={geom.rebateW} height={geom.rebateH}
            fill="none" stroke={C.rebate} strokeWidth={sw(SW_REBATE)} strokeOpacity={0.5}
            strokeDasharray={`${sw(4)},${sw(3)}`}
          />

          {/* GLASS REBATE — white solid */}
          <rect
            x={X(geom.glassX)} y={Y(geom.glassY)} width={geom.glassW} height={geom.glassH}
            fill={C.glassFill} fillOpacity={0.06}
            stroke={C.outer} strokeWidth={sw(SW_OUTER)}
          />

          {/* HORNS (upper sash only, dashed projection) */}
          {geom.isUpper && geom.hasHorns && (
            <g>
              <line
                x1={X(2)} y1={Y(geom.sashH)}
                x2={X(2)} y2={Y(geom.sashH + geom.hornExt)}
                stroke={C.notch} strokeWidth={sw(1)} strokeDasharray={`${sw(4)},${sw(3)}`} strokeOpacity={0.7}
              />
              <line
                x1={X(geom.sashW - 2)} y1={Y(geom.sashH)}
                x2={X(geom.sashW - 2)} y2={Y(geom.sashH + geom.hornExt)}
                stroke={C.notch} strokeWidth={sw(1)} strokeDasharray={`${sw(4)},${sw(3)}`} strokeOpacity={0.7}
              />
              <text
                x={X(geom.sashW + 5 * sc)} y={Y(geom.sashH + geom.hornExt / 2)}
                fill={C.notch} fontSize={fs(FS_NOTCH_NOTE)} fontFamily={FONT_FAMILY} fillOpacity={0.7}
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
                    stroke={C.outer} strokeWidth={sw(SW_BAR)}
                  />
                  <line
                    x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                    stroke={C.outer} strokeWidth={sw(SW_BAR)}
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
                    stroke={C.outer} strokeWidth={sw(SW_BAR)}
                  />
                  <line
                    x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                    stroke={C.outer} strokeWidth={sw(SW_BAR)}
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
                  stroke={C.outer} strokeWidth={sw(SW_BAR)}
                />
                <line
                  x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                  stroke={C.outer} strokeWidth={sw(SW_BAR)}
                />
              </g>
            ))
          )}

          {/* V-NOTCHES — vertical bar ends meet top/bottom rails */}
          {geom.vBars.map((vb, i) => (
            <g key={`vn-${i}`}>
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.left)} y2={Y(geom.glassY)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.right)} y2={Y(geom.glassY)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <circle cx={X(vb.cx)} cy={Y(geom.glassY - 2)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={sw(SW_NOTCH_CIRCLE)} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />

              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.left)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.right)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <circle cx={X(vb.cx)} cy={Y(geom.glassY + geom.glassH + 2)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={sw(SW_NOTCH_CIRCLE)} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
            </g>
          ))}

          {/* V-NOTCHES — horizontal bar ends meet left/right stiles */}
          {geom.hBars.map((hb, j) => (
            <g key={`hn-${j}`}>
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.top)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.bot)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <circle cx={X(geom.glassX - 2)} cy={Y(hb.cy)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={sw(SW_NOTCH_CIRCLE)} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />

              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.top)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.bot)}
                stroke={C.notch} strokeWidth={sw(SW_NOTCH)} strokeOpacity={0.8} />
              <circle cx={X(geom.glassX + geom.glassW + 2)} cy={Y(hb.cy)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={sw(SW_NOTCH_CIRCLE)} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
            </g>
          ))}

          {/* LABELS — green, sentence case */}
          <text x={X(geom.sashW / 2)} y={Y(geom.sashH - geom.botEdge / 2)}
            fill={C.label} fontSize={fs(FS_LABEL)} fontFamily={FONT_FAMILY} textAnchor="middle">
            {geom.isUpper ? 'MEETING RAIL' : 'BOTTOM RAIL'}
          </text>
          <text x={X(geom.sashW / 2)} y={Y(geom.topEdge / 2 + 3)}
            fill={C.label} fontSize={fs(FS_LABEL)} fontFamily={FONT_FAMILY} textAnchor="middle">
            {geom.isUpper ? 'TOP RAIL' : 'MEETING RAIL'}
          </text>
          <text x={X(geom.stile / 2)} y={Y(geom.sashH / 2)}
            fill={C.label} fontSize={fs(FS_LABEL)} fontFamily={FONT_FAMILY} textAnchor="middle"
            transform={`rotate(-90, ${X(geom.stile / 2)}, ${Y(geom.sashH / 2)})`}>
            LEFT STILE
          </text>
          <text x={X(geom.sashW - geom.stile / 2)} y={Y(geom.sashH / 2)}
            fill={C.label} fontSize={fs(FS_LABEL)} fontFamily={FONT_FAMILY} textAnchor="middle"
            transform={`rotate(90, ${X(geom.sashW - geom.stile / 2)}, ${Y(geom.sashH / 2)})`}>
            RIGHT STILE
          </text>

          {/* TOP DIMENSION CHAIN */}
          {topCuts.map((cx, i) => (
            <line key={`tdc-ext-${i}`}
              x1={X(cx)} y1={topExtLineEnd} x2={X(cx)} y2={topDimY - 10 * sc}
              stroke={C.dim} strokeWidth={sw(SW_EXT)} strokeDasharray={`${sw(3)},${sw(2)}`} />
          ))}
          <line x1={X(topCuts[0])} y1={topDimY} x2={X(topCuts[topCuts.length - 1])} y2={topDimY}
            stroke={C.dim} strokeWidth={sw(SW_DIM)} />
          {topCuts.map((cx, i) => (
            <line key={`tdc-tk-${i}`}
              x1={X(cx)} y1={topDimY - 5 * sc} x2={X(cx)} y2={topDimY + 5 * sc}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
          ))}
          {topCuts.slice(0, -1).map((cx, i) => {
            const nx = topCuts[i + 1];
            const width = nx - cx;
            const mid = (cx + nx) / 2;
            if (width < BAR_WIDTH * 2) {
              return (
                <g key={`tdc-lbl-${i}`}>
                  <line x1={X(mid)} y1={topDimY} x2={X(mid)} y2={topDimY - 18 * sc}
                    stroke={C.dim} strokeWidth={sw(SW_LEADER)} />
                  <line x1={X(mid)} y1={topDimY - 18 * sc} x2={X(mid + 15 * sc)} y2={topDimY - 18 * sc}
                    stroke={C.dim} strokeWidth={sw(SW_LEADER)} />
                  <text x={X(mid + 17 * sc)} y={topDimY - 15 * sc}
                    fill={C.dim} fontSize={fs(FS_DIM_SMALL)} fontFamily={FONT_FAMILY}
                    fontWeight="400">{fmt(width)}</text>
                </g>
              );
            }
            return (
              <text key={`tdc-lbl-${i}`} x={X(mid)} y={topDimY - 8 * sc}
                fill={C.dim} fontSize={fs(FS_DIM_SMALL)} fontFamily={FONT_FAMILY}
                textAnchor="middle" fontWeight="400">{fmt(width)}</text>
            );
          })}

          {/* LEFT DIMENSION CHAIN */}
          {leftCuts.map((cy, i) => (
            <line key={`ldc-ext-${i}`}
              x1={leftExtLineEnd} y1={Y(cy)} x2={leftDimX - 10 * sc} y2={Y(cy)}
              stroke={C.dim} strokeWidth={sw(SW_EXT)} strokeDasharray={`${sw(3)},${sw(2)}`} />
          ))}
          <line x1={leftDimX} y1={Y(leftCuts[0])} x2={leftDimX} y2={Y(leftCuts[leftCuts.length - 1])}
            stroke={C.dim} strokeWidth={sw(SW_DIM)} />
          {leftCuts.map((cy, i) => (
            <line key={`ldc-tk-${i}`}
              x1={leftDimX - 5 * sc} y1={Y(cy)} x2={leftDimX + 5 * sc} y2={Y(cy)}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
          ))}
          {leftCuts.slice(0, -1).map((cy, i) => {
            const ny = leftCuts[i + 1];
            const height = ny - cy;
            const mid = (cy + ny) / 2;
            if (height < BAR_WIDTH * 2) {
              return (
                <g key={`ldc-lbl-${i}`}>
                  <line x1={leftDimX} y1={Y(mid)} x2={leftDimX - 18 * sc} y2={Y(mid)}
                    stroke={C.dim} strokeWidth={sw(SW_LEADER)} />
                  <line x1={leftDimX - 18 * sc} y1={Y(mid)} x2={leftDimX - 18 * sc} y2={Y(mid) - 15 * sc}
                    stroke={C.dim} strokeWidth={sw(SW_LEADER)} />
                  <text x={leftDimX - 18 * sc} y={Y(mid) - 18 * sc}
                    fill={C.dim} fontSize={fs(FS_DIM_SMALL)} fontFamily={FONT_FAMILY}
                    textAnchor="middle" fontWeight="400">{fmt(height)}</text>
                </g>
              );
            }
            return (
              <text key={`ldc-lbl-${i}`} x={leftDimX - 8 * sc} y={Y(mid)}
                fill={C.dim} fontSize={fs(FS_DIM_SMALL)} fontFamily={FONT_FAMILY}
                textAnchor="middle" fontWeight="400"
                transform={`rotate(-90, ${leftDimX - 8 * sc}, ${Y(mid)})`}>{fmt(height)}</text>
            );
          })}

          {/* OVERALL WIDTH (bottom) */}
          <g>
            <line x1={X(0)} y1={Y(geom.sashH) + 15 * sc} x2={X(0)} y2={Y(geom.sashH) + 35 * sc}
              stroke={C.dim} strokeWidth={sw(SW_EXT)} strokeDasharray={`${sw(3)},${sw(2)}`} />
            <line x1={X(geom.sashW)} y1={Y(geom.sashH) + 15 * sc} x2={X(geom.sashW)} y2={Y(geom.sashH) + 35 * sc}
              stroke={C.dim} strokeWidth={sw(SW_EXT)} strokeDasharray={`${sw(3)},${sw(2)}`} />
            <line x1={X(0)} y1={Y(geom.sashH) + 30 * sc} x2={X(geom.sashW)} y2={Y(geom.sashH) + 30 * sc}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
            <line x1={X(0)} y1={Y(geom.sashH) + 25 * sc} x2={X(0)} y2={Y(geom.sashH) + 35 * sc}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
            <line x1={X(geom.sashW)} y1={Y(geom.sashH) + 25 * sc} x2={X(geom.sashW)} y2={Y(geom.sashH) + 35 * sc}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
            <text x={X(geom.sashW / 2)} y={Y(geom.sashH) + 26 * sc}
              fill={C.dim} fontSize={fs(FS_DIM_LARGE)} fontFamily={FONT_FAMILY}
              textAnchor="middle" fontWeight="400">{fmt(geom.sashW)}</text>
          </g>

          {/* OVERALL HEIGHT (right) */}
          <g>
            <line x1={X(geom.sashW) + 15 * sc} y1={Y(0)} x2={X(geom.sashW) + 35 * sc} y2={Y(0)}
              stroke={C.dim} strokeWidth={sw(SW_EXT)} strokeDasharray={`${sw(3)},${sw(2)}`} />
            <line x1={X(geom.sashW) + 15 * sc} y1={Y(geom.sashH)} x2={X(geom.sashW) + 35 * sc} y2={Y(geom.sashH)}
              stroke={C.dim} strokeWidth={sw(SW_EXT)} strokeDasharray={`${sw(3)},${sw(2)}`} />
            <line x1={X(geom.sashW) + 30 * sc} y1={Y(0)} x2={X(geom.sashW) + 30 * sc} y2={Y(geom.sashH)}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
            <line x1={X(geom.sashW) + 25 * sc} y1={Y(0)} x2={X(geom.sashW) + 35 * sc} y2={Y(0)}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
            <line x1={X(geom.sashW) + 25 * sc} y1={Y(geom.sashH)} x2={X(geom.sashW) + 35 * sc} y2={Y(geom.sashH)}
              stroke={C.dim} strokeWidth={sw(SW_DIM)} />
            <text x={X(geom.sashW) + 26 * sc} y={Y(geom.sashH / 2)}
              fill={C.dim} fontSize={fs(FS_DIM_LARGE)} fontFamily={FONT_FAMILY}
              textAnchor="middle" fontWeight="400"
              transform={`rotate(-90, ${X(geom.sashW) + 26 * sc}, ${Y(geom.sashH / 2)})`}>{fmt(geom.sashH)}</text>
          </g>

          {/* TITLE / SUBTITLE */}
          <text x={totalW / 2} y={totalH - 20 * sc}
            fill={C.title} fontSize={fs(FS_TITLE)} fontFamily={FONT_FAMILY}
            textAnchor="middle" fontWeight="600">
            {titleText}
          </text>
          <text x={totalW / 2} y={totalH - 6 * sc}
            fill={C.subtitle} fontSize={fs(FS_SUBTITLE)} fontFamily={FONT_FAMILY}
            textAnchor="middle" fillOpacity={0.6}>
            {subtitleText}
          </text>
        </svg>
      </div>
    </div>
  );
}
