/**
 * GlassDrawing2D.jsx
 *
 * Single sealed glass unit — one per sash (upper or lower).
 * Spacer bars equally spaced (math). Chain dimensioning like SashDetail2D.
 * Shows 11mm edge seal + spacer bars + full dimension chains.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, WEIGHTS, STROKES, VIEWBOX_REF,
  DimH, DimV, DimChainH, DimChainV, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };
const MARGIN = 60;
const DIM_OFF = 35;
const SPACER_BAR = 18;
const REBATE = 12.5;
const EDGE_SEAL = 11;

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function GlassDrawing2D({ windowSpec, derived, type = 'upper' }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const isUpper = type === 'upper';
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    const glassW = sashW - 114 + 2 * REBATE;
    const glassH = isUpper
      ? topH - 100 + 2 * REBATE
      : botH - 133 + 2 * REBATE;

    // Bar counts
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vCount = 0, hCount = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vCount = cols - 1;
      hCount = isUpper ? Math.floor(rows / 2) : Math.ceil(rows / 2);
    }

    // Spacer bars — equal spacing within glass
    const bars = computeBarPositions({
      glassX: 0, glassY: 0, glassW, glassH,
      vCount, hCount, barW: SPACER_BAR,
    });

    // Chain cuts — horizontal: [0, edgeSeal, bar1.left, bar1.right, ..., glassW-edgeSeal, glassW]
    const hChainCuts = [0, EDGE_SEAL];
    bars.vBars.forEach(b => { hChainCuts.push(b.left); hChainCuts.push(b.right); });
    hChainCuts.push(glassW - EDGE_SEAL, glassW);

    // Chain cuts — vertical
    const vChainCuts = [0, EDGE_SEAL];
    bars.hBars.forEach(b => { vChainCuts.push(b.top); vChainCuts.push(b.bot); });
    vChainCuts.push(glassH - EDGE_SEAL, glassH);

    // Cross-check
    let crossCheckOk = true;
    const errors = [];
    const sumW = bars.paneW * (vCount + 1) + vCount * SPACER_BAR;
    const sumH = bars.paneH * (hCount + 1) + hCount * SPACER_BAR;
    if (Math.abs(sumW - glassW) > 0.1) { crossCheckOk = false; errors.push(`W: ${sumW.toFixed(1)}≠${glassW.toFixed(1)}`); }
    if (Math.abs(sumH - glassH) > 0.1) { crossCheckOk = false; errors.push(`H: ${sumH.toFixed(1)}≠${glassH.toFixed(1)}`); }

    const glassType = windowSpec?.glass?.type || windowSpec?.glazing?.type || 'double';
    const glassFinish = windowSpec?.glass?.finish || windowSpec?.glazing?.finish || 'clear';
    const spacerColour = windowSpec?.glazing?.spacerColour || 'black';

    return { glassW, glassH, vBars: bars.vBars, hBars: bars.hBars, vCount, hCount,
      hChainCuts, vChainCuts, crossCheckOk, errors, glassType, glassFinish, spacerColour, isUpper };
  }, [windowSpec, derived, type]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const ox = MARGIN + DIM_OFF;
  const oy = MARGIN;
  const TITLE_SPACE = 50;
  const totalW = d.glassW + MARGIN * 2 + DIM_OFF * 2;
  const totalH = d.glassH + MARGIN * 2 + DIM_OFF * 2 + TITLE_SPACE;
  const ts = totalW / VIEWBOX_REF;

  return (
    <div className="w-full" style={{ maxHeight: '65vh', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* Glass unit */}
        <rect x={ox} y={oy} width={d.glassW} height={d.glassH}
          fill={STROKE.glass} fillOpacity={0.1} stroke={STROKE.glass} strokeWidth={STROKES.glass} {...NS} />

        {/* 11mm edge seal */}
        <rect x={ox + EDGE_SEAL} y={oy + EDGE_SEAL}
          width={d.glassW - 2 * EDGE_SEAL} height={d.glassH - 2 * EDGE_SEAL}
          fill="none" stroke={STROKE.glass} strokeWidth={0.5} {...NS} />

        {/* Vertical spacer bars */}
        {d.vBars.map((bar, i) => (
          <rect key={`v${i}`} x={ox + bar.left} y={oy} width={SPACER_BAR} height={d.glassH}
            fill={COLORS.bar} fillOpacity={0.3} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Horizontal spacer bars */}
        {d.hBars.map((bar, i) => (
          <rect key={`h${i}`} x={ox} y={oy + bar.top} width={d.glassW} height={SPACER_BAR}
            fill={COLORS.bar} fillOpacity={0.3} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* ── CHAIN DIMENSIONS ── */}

        {/* Top chain: 11 | seg | 18 | seg | 18 | seg | 11 */}
        <DimChainH y={oy - 24 * ts} extFrom={oy - 4 * ts}
          cuts={d.hChainCuts.map(cx => ox + cx)}
          vbw={totalW} minSegment={SPACER_BAR * 1.5} fmt={fmt} />

        {/* Left chain: 11 | seg | 18 | seg | 18 | seg | 11 */}
        <DimChainV x={ox - 24 * ts} extFrom={ox - 4 * ts}
          cuts={d.vChainCuts.map(cy => oy + cy)}
          vbw={totalW} minSegment={SPACER_BAR * 1.5} fmt={fmt} />

        {/* Overall glass — bottom */}
        <DimH y={oy + d.glassH + DIM_OFF} x1={ox} x2={ox + d.glassW}
          extFrom={oy + d.glassH} label={`${Math.round(d.glassW)} mm`} vbw={totalW} />

        {/* Overall glass — right */}
        <DimV x={ox + d.glassW + DIM_OFF} y1={oy} y2={oy + d.glassH}
          extFrom={ox + d.glassW} label={`${Math.round(d.glassH)} mm`} vbw={totalW} />

        {/* Title */}
        <text x={totalW / 2} y={totalH - 30 * ts}
          fill={COLORS.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          {d.isUpper ? 'UPPER' : 'LOWER'} GLASS
        </text>

        {/* Spec */}
        <text x={totalW / 2} y={totalH - 12 * ts}
          fill={STROKE.glass} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.glassType} / {d.glassFinish} · spacer: {d.spacerColour}
        </text>

        {/* Alarm */}
        {!d.crossCheckOk && (
          <text x={totalW / 2} y={oy - DIM_OFF - 15}
            fill="#EF4444" fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family}
            textAnchor="middle" fontWeight="600">
            ⚠ {d.errors.join(' · ')}
          </text>
        )}
      </svg>
    </div>
  );
}