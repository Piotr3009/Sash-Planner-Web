/**
 * GlassDrawing2D.jsx
 *
 * Production drawing of sealed glass unit for glass factory.
 * One per sash (upper/lower). Shows glass outline, 11mm edge seal,
 * spacer bars (18mm), chain dimensions, overall dimensions.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, WEIGHTS, STROKES, VIEWBOX_REF,
  DimH, DimV, DimChainH, DimChainV, tfs, computeGlassBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };
const SPACER_BAR = 18;
const REBATE = 12.5;
const EDGE_SEAL = 11;

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

/** Break a line from→to into segments, skipping each [start,end] cut pair */
function segmentsBetween(from, to, cutPairs) {
  if (cutPairs.length === 0) return [{ a: from, b: to }];
  const sorted = [...cutPairs].sort((p, q) => p[0] - q[0]);
  const segs = [];
  let pos = from;
  for (const [cStart, cEnd] of sorted) {
    if (cStart > pos) segs.push({ a: pos, b: cStart });
    pos = Math.max(pos, cEnd);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

export default function GlassDrawing2D({ windowSpec, derived, type = 'upper' }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const isUpper = type === 'upper';
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    const glassW = sashW - 114 + 2 * REBATE;
    const glassH = isUpper ? topH - 100 + 2 * REBATE : botH - 133 + 2 * REBATE;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const BAR_PATTERNS = {
      'none': { h: 0, v: 0 }, '2x2': { h: 0, v: 1 }, '3x3': { h: 0, v: 2 },
      '4x4': { h: 1, v: 1 }, '6x6': { h: 1, v: 2 }, '9x9': { h: 2, v: 2 },
    };
    const pattern = BAR_PATTERNS[gridMode] || BAR_PATTERNS['none'];
    const vCount = pattern.v;
    const hCount = pattern.h;

    const sashH = isUpper ? topH : botH;
    const bars = computeGlassBarPositions({
      sashW, sashH, isUpper, vCount, hCount,
    });

    // Chain cuts — 11 | seg | 18 | seg | 18 | seg | 11
    const hCuts = [0, EDGE_SEAL];
    bars.vBars.forEach(b => { hCuts.push(b.left); hCuts.push(b.right); });
    hCuts.push(glassW - EDGE_SEAL, glassW);

    const vCuts = [0, EDGE_SEAL];
    bars.hBars.forEach(b => { vCuts.push(b.top); vCuts.push(b.bot); });
    vCuts.push(glassH - EDGE_SEAL, glassH);

    // Cross-check: verify bar centers align with wood bar centers
    let checkOk = true;
    const errs = [];
    const STILE = 57, WOOD_BAR = 22;
    const topEdge = isUpper ? 57 : 43;
    const botEdge = isUpper ? 43 : 90;
    const woodW = sashW - 2 * STILE;
    const woodH = sashH - topEdge - botEdge;
    const glassOriginX = STILE - REBATE;
    const glassOriginY = topEdge - REBATE;

    // Check vertical bars
    if (vCount > 0) {
      const woodPaneW = (woodW - vCount * WOOD_BAR) / (vCount + 1);
      bars.vBars.forEach((vb, i) => {
        const woodCenter = STILE + (i + 1) * woodPaneW + i * WOOD_BAR + WOOD_BAR / 2;
        const glassCenter = glassOriginX + vb.cx;
        if (Math.abs(woodCenter - glassCenter) > 0.1) {
          checkOk = false;
          errs.push(`V${i + 1}:${glassCenter.toFixed(1)}≠${woodCenter.toFixed(1)}`);
        }
      });
    }
    // Check horizontal bars
    if (hCount > 0) {
      const woodPaneH = (woodH - hCount * WOOD_BAR) / (hCount + 1);
      bars.hBars.forEach((hb, j) => {
        const woodCenter = topEdge + (j + 1) * woodPaneH + j * WOOD_BAR + WOOD_BAR / 2;
        const glassCenter = glassOriginY + hb.cy;
        if (Math.abs(woodCenter - glassCenter) > 0.1) {
          checkOk = false;
          errs.push(`H${j + 1}:${glassCenter.toFixed(1)}≠${woodCenter.toFixed(1)}`);
        }
      });
    }
    // Check glass dimensions match
    if (Math.abs(bars.glassW - glassW) > 0.1) { checkOk = false; errs.push(`gW:${bars.glassW.toFixed(1)}≠${glassW.toFixed(1)}`); }
    if (Math.abs(bars.glassH - glassH) > 0.1) { checkOk = false; errs.push(`gH:${bars.glassH.toFixed(1)}≠${glassH.toFixed(1)}`); }

    const glassType = windowSpec?.glass?.type || windowSpec?.glazing?.type || 'double';
    const glassFinish = windowSpec?.glass?.finish || windowSpec?.glazing?.finish || 'clear';
    const frostedLocation = windowSpec?.glazing?.frostedLocation || windowSpec?.glass?.frostedLocation || 'bottom';
    const spacerColour = windowSpec?.glazing?.spacerColour || 'black';
    const spacerType = windowSpec?.glazing?.spacerType || 'warm';

    // Frosted applies to THIS panel when finish is frosted AND
    // (this is the lower sash, OR frosting covers both sashes).
    const isFrosted = glassFinish === 'frosted' && (!isUpper || frostedLocation === 'both');

    return { glassW, glassH, vBars: bars.vBars, hBars: bars.hBars,
      vCount, hCount, hCuts, vCuts, checkOk, errs,
      glassType, glassFinish, spacerColour, spacerType, isFrosted, isUpper };
  }, [windowSpec, derived, type]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  // Layout
  const layoutSc = Math.max(d.glassW, d.glassH) / 500;
  const M = 80 * layoutSc;
  const DM = 60 * layoutSc;
  const ox = M + DM;
  const oy = M + DM;
  const totalW = d.glassW + M * 2 + DM * 2;
  const totalH = d.glassH + M * 2 + DM * 2;
  const ts = totalW / VIEWBOX_REF;

  return (
    <div className="w-full" style={{ maxHeight: '65vh', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* Frosted hatch pattern — fine diagonal lines, subtle */}
        <defs>
          <pattern id={`frost-${d.isUpper ? 'u' : 'l'}`} width={14 * layoutSc} height={14 * layoutSc}
            patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={14 * layoutSc}
              stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.45} />
          </pattern>
        </defs>

        {/* Glass unit — outer edge */}
        <rect x={ox} y={oy} width={d.glassW} height={d.glassH}
          fill={COLORS.glass} fillOpacity={0.08}
          stroke={COLORS.glass} strokeWidth={STROKES.outer} {...NS} />

        {/* Edge seal 11mm */}
        <rect x={ox + EDGE_SEAL} y={oy + EDGE_SEAL}
          width={d.glassW - 2 * EDGE_SEAL} height={d.glassH - 2 * EDGE_SEAL}
          fill="none" stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />

        {/* Frosted hatch overlay — inside edge seal, drawn under bars */}
        {d.isFrosted && (
          <rect x={ox + EDGE_SEAL} y={oy + EDGE_SEAL}
            width={d.glassW - 2 * EDGE_SEAL} height={d.glassH - 2 * EDGE_SEAL}
            fill={`url(#frost-${d.isUpper ? 'u' : 'l'})`} stroke="none" />
        )}

        {/* Vertical spacer bars — two parallel lines, broken at h-bar intersections */}
        {d.vBars.map((bar, i) => {
          const hCutPairs = d.hBars.map(hb => [hb.top, hb.bot]);
          const segs = segmentsBetween(0, d.glassH, hCutPairs);
          return (
            <g key={`v${i}`}>
              {segs.map((seg, j) => (
                <g key={`vs-${i}-${j}`}>
                  <line x1={ox + bar.left} y1={oy + seg.a} x2={ox + bar.left} y2={oy + seg.b}
                    stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />
                  <line x1={ox + bar.right} y1={oy + seg.a} x2={ox + bar.right} y2={oy + seg.b}
                    stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />
                </g>
              ))}
            </g>
          );
        })}

        {/* Horizontal spacer bars — two parallel lines, broken at v-bar intersections */}
        {d.hBars.map((bar, i) => {
          const vCutPairs = d.vBars.map(vb => [vb.left, vb.right]);
          const segs = segmentsBetween(0, d.glassW, vCutPairs);
          return (
            <g key={`h${i}`}>
              {segs.map((seg, j) => (
                <g key={`hs-${i}-${j}`}>
                  <line x1={ox + seg.a} y1={oy + bar.top} x2={ox + seg.b} y2={oy + bar.top}
                    stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />
                  <line x1={ox + seg.a} y1={oy + bar.bot} x2={ox + seg.b} y2={oy + bar.bot}
                    stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />
                </g>
              ))}
            </g>
          );
        })}

        {/* Crosses at bar intersections */}
        {d.vBars.flatMap((vb, vi) =>
          d.hBars.map((hb, hi) => (
            <g key={`cross-${vi}-${hi}`}>
              <line x1={ox + vb.left} y1={oy + hb.top} x2={ox + vb.right} y2={oy + hb.bot}
                stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />
              <line x1={ox + vb.right} y1={oy + hb.top} x2={ox + vb.left} y2={oy + hb.bot}
                stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />
            </g>
          ))
        )}

        {/* ── DIMENSIONS ── */}

        {/* Top chain: 11 | seg | 18 | seg | 11 */}
        <DimChainH y={oy - 24 * ts} extFrom={oy - 4 * ts}
          cuts={d.hCuts.map(cx => ox + cx)}
          vbw={totalW} minSegment={SPACER_BAR * 1.5} fmt={fmt} />

        {/* Left chain: 11 | seg | 18 | seg | 11 */}
        <DimChainV x={ox - 24 * ts} extFrom={ox - 4 * ts}
          cuts={d.vCuts.map(cy => oy + cy)}
          vbw={totalW} minSegment={SPACER_BAR * 1.5} fmt={fmt} />

        {/* Overall width — bottom */}
        <DimH y={oy + d.glassH + DM * 0.8} x1={ox} x2={ox + d.glassW}
          extFrom={oy + d.glassH} label={`${fmt(d.glassW)} mm`} vbw={totalW} />

        {/* Overall height — right */}
        <DimV x={ox + d.glassW + DM * 0.8} y1={oy} y2={oy + d.glassH}
          extFrom={ox + d.glassW} label={`${fmt(d.glassH)} mm`} vbw={totalW} />

        {/* Title */}
        <text x={totalW / 2} y={totalH - 13.8 * ts}
          fill={COLORS.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          {d.isUpper ? 'UPPER' : 'LOWER'} GLASS
        </text>
        <text x={totalW / 2} y={totalH - 4 * ts}
          fill={STROKE.glass} fontSize={tfs(SIZES.subtitle * 1.25, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.glassType} / {d.glassFinish} · spacer: {d.spacerColour} ({d.spacerType === 'alu' ? 'aluminium' : 'warm edge'})
        </text>

        {/* Alarm */}
        {!d.checkOk && (
          <text x={totalW / 2} y={oy - DM * 0.6}
            fill="#EF4444" fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family}
            textAnchor="middle" fontWeight="600">
            ⚠ {d.errs.join(' · ')}
          </text>
        )}
      </svg>
    </div>
  );
}