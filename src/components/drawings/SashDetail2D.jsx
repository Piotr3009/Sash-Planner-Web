/**
 * SashDetail2D.jsx
 */
import { useMemo, useState } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { computeBarPositions, DimChainH, DimChainV, DimH, DimV, tfs, HORN_DEF, buildHornPath } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };

const BAR_PATTERNS = {
  'none': { h: 0, v: 0 }, '2x2': { h: 0, v: 1 }, '3x3': { h: 0, v: 2 },
  '4x4': { h: 1, v: 1 }, '6x6': { h: 1, v: 2 }, '9x9': { h: 2, v: 2 },
};
const BAR_WIDTH = 22;

const C = {
  outer: COLORS.sash, rebate: COLORS.glass, glassFill: COLORS.glass,
  meeting: COLORS.meeting, label: COLORS.label, dim: COLORS.dim,
  notch: COLORS.notch, title: COLORS.title, subtitle: COLORS.subtitle,
  bgFill: 'rgba(148,163,184,0.03)',
};

function fmt(n) {
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

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
    const glassX = stile, glassY = topEdge;
    const glassW = sashW - 2 * stile;
    const glassH = sashH - topEdge - botEdge;
    const REBATE_OFFSET = 9;
    const rebateX = REBATE_OFFSET, rebateY = REBATE_OFFSET;
    const rebateW = sashW - 2 * REBATE_OFFSET;
    const rebateH = sashH - 2 * REBATE_OFFSET;
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BAR_PATTERNS[gridMode] || BAR_PATTERNS['none'];
    const v = pattern.v, h = pattern.h;
    const { vBars, hBars, paneW, paneH } = computeBarPositions({
      glassX, glassY, glassW, glassH, vCount: v, hCount: h, barW: BAR_WIDTH,
    });
    const hasHorns = !!windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;
    return { sashW, sashH, stile, topEdge, botEdge, glassX, glassY, glassW, glassH,
      rebateX, rebateY, rebateW, rebateH, vBars, hBars, v, h, paneW, paneH,
      isUpper, hasHorns, hornExt, gridMode };
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
  const ts = totalW / VIEWBOX_REF;

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

  // Top dim chain
  const topCuts = [0, geom.stile];
  geom.vBars.forEach(vb => { topCuts.push(vb.left); topCuts.push(vb.right); });
  topCuts.push(geom.sashW - geom.stile);
  topCuts.push(geom.sashW);
  const topDimY = oy - 24 * ts;
  const topExtLineEnd = oy - 4 * ts;

  // Left dim chain
  const leftCuts = [0, geom.topEdge];
  geom.hBars.forEach(hb => { leftCuts.push(hb.top); leftCuts.push(hb.bot); });
  leftCuts.push(geom.sashH - geom.botEdge);
  leftCuts.push(geom.sashH);
  const leftDimX = ox - 24 * ts;
  const leftExtLineEnd = ox - 4 * ts;

  return (
    <div className="w-full relative">
      <div className="absolute top-2 right-2 z-10 text-[10px] text-ink-400 bg-surface-700/80 px-2 py-1 rounded cursor-pointer hover:text-accent-400"
        onClick={handleExpand}>
        {isExternalExpand ? '⊕ Expand' : (expanded ? '⊖ Collapse' : '⊕ Expand')}
      </div>

      <div onClick={isExternalExpand ? handleExpand : () => setExpanded(!expanded)} className="cursor-pointer"
        style={{ maxHeight: (expanded && !isExternalExpand) ? 'none' : '65vh', overflow: 'auto' }}>
        <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto" style={{ background: COLORS.bg }}>

          {/* Outer sash */}
          <rect x={X(0)} y={Y(0)} width={geom.sashW} height={geom.sashH}
            fill={C.bgFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />

          {/* Outer rebate */}
          <rect x={X(geom.rebateX)} y={Y(geom.rebateY)} width={geom.rebateW} height={geom.rebateH}
            fill="none" stroke={C.rebate} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.5}
            strokeDasharray={`${sw(4)},${sw(3)}`} />

          {/* Glass rebate */}
          <rect x={X(geom.glassX)} y={Y(geom.glassY)} width={geom.glassW} height={geom.glassH}
            fill={C.glassFill} fillOpacity={0.06}
            stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />

          {/* Horns — real profile from 3D HornMesh (upper sash only; none → nothing) */}
          {geom.isUpper && geom.hasHorns && HORN_DEF[windowSpec.sash?.hornType] && (
            <g>
              <path d={buildHornPath(windowSpec.sash.hornType, X(0), geom.sashW, Y(geom.sashH), 'L')}
                fill={C.bgFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
              <path d={buildHornPath(windowSpec.sash.hornType, X(0), geom.sashW, Y(geom.sashH), 'R')}
                fill={C.bgFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
            </g>
          )}

          {/* Vertical bars */}
          {geom.vBars.map((vb, i) => (
            <g key={`vb-${i}`}>
              {verticalEdgeSegments.map((seg, j) => (
                <g key={`vb-${i}-s-${j}`}>
                  <line x1={X(vb.left)} y1={Y(seg.a)} x2={X(vb.left)} y2={Y(seg.b)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                  <line x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                </g>
              ))}
            </g>
          ))}

          {/* Horizontal bars */}
          {geom.hBars.map((hb, j) => (
            <g key={`hb-${j}`}>
              {horizontalEdgeSegments.map((seg, i) => (
                <g key={`hb-${j}-s-${i}`}>
                  <line x1={X(seg.a)} y1={Y(hb.top)} x2={X(seg.b)} y2={Y(hb.top)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                  <line x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                </g>
              ))}
            </g>
          ))}

          {/* Crosses at bar intersections */}
          {geom.vBars.flatMap((vb, vi) =>
            geom.hBars.map((hb, hi) => (
              <g key={`cross-${vi}-${hi}`}>
                <line x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
                  stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                <line x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                  stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
              </g>
            ))
          )}

          {/* V-notches — vertical bars */}
          {geom.vBars.map((vb, i) => (
            <g key={`vn-${i}`}>
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.left)} y2={Y(geom.glassY)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.right)} y2={Y(geom.glassY)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <circle cx={X(vb.cx)} cy={Y(geom.glassY - 2)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={STROKES.notchCircle} {...NS} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.left)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.right)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <circle cx={X(vb.cx)} cy={Y(geom.glassY + geom.glassH + 2)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={STROKES.notchCircle} {...NS} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
            </g>
          ))}

          {/* V-notches — horizontal bars */}
          {geom.hBars.map((hb, j) => (
            <g key={`hn-${j}`}>
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.top)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.bot)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <circle cx={X(geom.glassX - 2)} cy={Y(hb.cy)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={STROKES.notchCircle} {...NS} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.top)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.bot)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <circle cx={X(geom.glassX + geom.glassW + 2)} cy={Y(hb.cy)} r={sw(12)}
                fill="none" stroke={C.notch} strokeWidth={STROKES.notchCircle} {...NS} strokeOpacity={0.4}
                strokeDasharray={`${sw(3)},${sw(2)}`} />
            </g>
          ))}

          {/* Labels */}
          <text x={X(geom.sashW / 2)} y={Y(geom.sashH - geom.botEdge / 2)}
            fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle">
            {geom.isUpper ? 'MEETING RAIL' : 'BOTTOM RAIL'}
          </text>
          <text x={X(geom.sashW / 2)} y={Y(geom.topEdge / 2 + 3)}
            fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle">
            {geom.isUpper ? 'TOP RAIL' : 'MEETING RAIL'}
          </text>
          <text x={X(geom.stile / 2)} y={Y(geom.sashH / 2)}
            fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle"
            transform={`rotate(-90, ${X(geom.stile / 2)}, ${Y(geom.sashH / 2)})`}>
            LEFT STILE
          </text>
          <text x={X(geom.sashW - geom.stile / 2)} y={Y(geom.sashH / 2)}
            fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label} textAnchor="middle"
            transform={`rotate(90, ${X(geom.sashW - geom.stile / 2)}, ${Y(geom.sashH / 2)})`}>
            RIGHT STILE
          </text>

          {/* Dimension chains */}
          <DimChainH y={topDimY} extFrom={topExtLineEnd}
            cuts={topCuts.map(cx => X(cx))}
            vbw={totalW} minSegment={BAR_WIDTH * 2} fmt={fmt} />
          <DimChainV x={leftDimX} extFrom={leftExtLineEnd}
            cuts={leftCuts.map(cy => Y(cy))}
            vbw={totalW} minSegment={BAR_WIDTH * 2} fmt={fmt} />

          {/* Overall dims */}
          <DimH y={Y(geom.sashH) + 24 * ts}
            x1={X(0)} x2={X(geom.sashW)}
            extFrom={Y(geom.sashH) + 12 * ts}
            label={fmt(geom.sashW)} vbw={totalW} />
          <DimV x={X(geom.sashW) + 24 * ts}
            y1={Y(0)} y2={Y(geom.sashH)}
            extFrom={X(geom.sashW) + 12 * ts}
            label={fmt(geom.sashH)} vbw={totalW} />

          {/* Title */}
          <text x={totalW / 2} y={totalH - 16 * ts}
            fill={C.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT_FAMILY}
            textAnchor="middle" fontWeight={WEIGHTS.title}>
            {titleText}
          </text>
          <text x={totalW / 2} y={totalH - 4 * ts}
            fill={C.subtitle} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT_FAMILY}
            textAnchor="middle" fillOpacity={0.6}>
            {subtitleText}
          </text>
        </svg>
      </div>
    </div>
  );
}
