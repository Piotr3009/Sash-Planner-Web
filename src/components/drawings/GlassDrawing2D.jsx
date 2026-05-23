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
  DimH, DimV, DimChainH, DimChainV, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };
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
    const glassH = isUpper ? topH - 100 + 2 * REBATE : botH - 133 + 2 * REBATE;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vCount = 0, hCount = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vCount = cols - 1;
      hCount = isUpper ? Math.floor(rows / 2) : Math.ceil(rows / 2);
    }

    const bars = computeBarPositions({
      glassX: 0, glassY: 0, glassW, glassH,
      vCount, hCount, barW: SPACER_BAR,
    });

    // Chain cuts — 11 | seg | 18 | seg | 18 | seg | 11
    const hCuts = [0, EDGE_SEAL];
    bars.vBars.forEach(b => { hCuts.push(b.left); hCuts.push(b.right); });
    hCuts.push(glassW - EDGE_SEAL, glassW);

    const vCuts = [0, EDGE_SEAL];
    bars.hBars.forEach(b => { vCuts.push(b.top); vCuts.push(b.bot); });
    vCuts.push(glassH - EDGE_SEAL, glassH);

    // Cross-check
    let checkOk = true;
    const errs = [];
    const sw = bars.paneW * (vCount + 1) + vCount * SPACER_BAR;
    const sh = bars.paneH * (hCount + 1) + hCount * SPACER_BAR;
    if (Math.abs(sw - glassW) > 0.1) { checkOk = false; errs.push(`W:${sw.toFixed(1)}≠${glassW.toFixed(1)}`); }
    if (Math.abs(sh - glassH) > 0.1) { checkOk = false; errs.push(`H:${sh.toFixed(1)}≠${glassH.toFixed(1)}`); }

    const glassType = windowSpec?.glass?.type || windowSpec?.glazing?.type || 'double';
    const glassFinish = windowSpec?.glass?.finish || windowSpec?.glazing?.finish || 'clear';
    const spacerColour = windowSpec?.glazing?.spacerColour || 'black';

    return { glassW, glassH, vBars: bars.vBars, hBars: bars.hBars,
      vCount, hCount, hCuts, vCuts, checkOk, errs,
      glassType, glassFinish, spacerColour, isUpper };
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

        {/* Glass unit — outer edge */}
        <rect x={ox} y={oy} width={d.glassW} height={d.glassH}
          fill={COLORS.glass} fillOpacity={0.08}
          stroke={COLORS.glass} strokeWidth={STROKES.outer} {...NS} />

        {/* Edge seal 11mm */}
        <rect x={ox + EDGE_SEAL} y={oy + EDGE_SEAL}
          width={d.glassW - 2 * EDGE_SEAL} height={d.glassH - 2 * EDGE_SEAL}
          fill="none" stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.6} />

        {/* Vertical spacer bars */}
        {d.vBars.map((bar, i) => (
          <g key={`v${i}`}>
            <rect x={ox + bar.left} y={oy} width={SPACER_BAR} height={d.glassH}
              fill={COLORS.bar} fillOpacity={0.2} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            <line x1={ox + bar.cx} y1={oy} x2={ox + bar.cx} y2={oy + d.glassH}
              stroke={COLORS.bar} strokeWidth={0.3} {...NS} strokeOpacity={0.4} />
          </g>
        ))}

        {/* Horizontal spacer bars */}
        {d.hBars.map((bar, i) => (
          <g key={`h${i}`}>
            <rect x={ox} y={oy + bar.top} width={d.glassW} height={SPACER_BAR}
              fill={COLORS.bar} fillOpacity={0.2} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            <line x1={ox} y1={oy + bar.cy} x2={ox + d.glassW} y2={oy + bar.cy}
              stroke={COLORS.bar} strokeWidth={0.3} {...NS} strokeOpacity={0.4} />
          </g>
        ))}

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
        <text x={totalW / 2} y={totalH - 18 * ts}
          fill={COLORS.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          {d.isUpper ? 'UPPER' : 'LOWER'} GLASS
        </text>
        <text x={totalW / 2} y={totalH - 4 * ts}
          fill={STROKE.glass} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.glassType} / {d.glassFinish} · spacer: {d.spacerColour}
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