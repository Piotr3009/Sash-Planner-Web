/**
 * GlassDrawing2D.jsx
 *
 * Single sealed glass unit — one per sash (upper or lower).
 * Bar positions FROM WOOD, cross-checked by sum verification.
 * Shows 11mm edge seal border + spacer bars + dimensions.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, WEIGHTS, STROKES, VIEWBOX_REF, DimH, DimV, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };
const MARGIN = 60;
const DIM_OFF = 35;

const WOOD_BAR = 22;
const SPACER_BAR = 18;
const REBATE = 12.5;
const EDGE_SEAL = 11;   // sealed edge around glass perimeter

export default function GlassDrawing2D({ windowSpec, derived, type = 'upper' }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const isUpper = type === 'upper';
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    // Sash inner dimensions (between timber)
    const innerW = sashW - 114;
    const innerH = isUpper ? topH - 100 : botH - 133;

    // Glass = inner + rebate overlap each side
    const glassW = innerW + 2 * REBATE;
    const glassH = innerH + 2 * REBATE;

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

    // ── SOURCE: wood bar positions (drewno = truth) ──
    const woodBars = computeBarPositions({
      glassX: 0, glassY: 0, glassW: innerW, glassH: innerH,
      vCount, hCount, barW: WOOD_BAR,
    });

    // Wood bar centers → spacer centers in glass coords
    const spacerV = woodBars.vBars.map(b => {
      const center = b.cx + REBATE;
      return { center, left: center - SPACER_BAR / 2, right: center + SPACER_BAR / 2 };
    });
    const spacerH = woodBars.hBars.map(b => {
      const center = b.cy + REBATE;
      return { center, top: center - SPACER_BAR / 2, bot: center + SPACER_BAR / 2 };
    });

    // ── CROSS-CHECK: segments + spacers must sum to glassW / glassH ──
    let crossCheckOk = true;
    const errors = [];

    // Width check
    const vEdges = [0, ...spacerV.flatMap(s => [s.left, s.right]), glassW];
    let sumW = 0;
    for (let i = 0; i < vEdges.length; i += 2) {
      const seg = vEdges[i + 1] - vEdges[i];
      sumW += seg;
      if (seg < 0) { crossCheckOk = false; errors.push(`V-seg ${i / 2} < 0`); }
    }
    if (Math.abs(sumW + vCount * SPACER_BAR - glassW) > 0.1) {
      crossCheckOk = false;
      errors.push(`W sum: ${(sumW + vCount * SPACER_BAR).toFixed(1)} ≠ ${glassW}`);
    }

    // Height check
    const hEdges = [0, ...spacerH.flatMap(s => [s.top, s.bot]), glassH];
    let sumH = 0;
    for (let i = 0; i < hEdges.length; i += 2) {
      const seg = hEdges[i + 1] - hEdges[i];
      sumH += seg;
      if (seg < 0) { crossCheckOk = false; errors.push(`H-seg ${i / 2} < 0`); }
    }
    if (Math.abs(sumH + hCount * SPACER_BAR - glassH) > 0.1) {
      crossCheckOk = false;
      errors.push(`H sum: ${(sumH + hCount * SPACER_BAR).toFixed(1)} ≠ ${glassH}`);
    }

    // Segment sizes for display
    const segW = vCount > 0 ? Math.round((vEdges[1] - vEdges[0]) * 10) / 10 : null;
    const segH = hCount > 0 ? Math.round((hEdges[1] - hEdges[0]) * 10) / 10 : null;

    const glassType = windowSpec?.glass?.type || windowSpec?.glazing?.type || 'double';
    const glassFinish = windowSpec?.glass?.finish || windowSpec?.glazing?.finish || 'clear';
    const spacerColour = windowSpec?.glazing?.spacerColour || 'black';

    return { glassW, glassH, spacerV, spacerH, vCount, hCount,
      segW, segH, crossCheckOk, errors, glassType, glassFinish, spacerColour, isUpper };
  }, [windowSpec, derived, type]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const ox = MARGIN + DIM_OFF;
  const oy = MARGIN;
  const TITLE_SPACE = 50;
  const totalW = d.glassW + MARGIN * 2 + DIM_OFF * 2;
  const totalH = d.glassH + MARGIN * 2 + DIM_OFF * 2 + TITLE_SPACE;

  return (
    <div className="w-full" style={{ maxHeight: '65vh', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* Glass unit — outer */}
        <rect x={ox} y={oy} width={d.glassW} height={d.glassH}
          fill={STROKE.glass} fillOpacity={0.1} stroke={STROKE.glass} strokeWidth={STROKES.glass} {...NS} />

        {/* 11mm edge seal border */}
        <rect x={ox + EDGE_SEAL} y={oy + EDGE_SEAL}
          width={d.glassW - 2 * EDGE_SEAL} height={d.glassH - 2 * EDGE_SEAL}
          fill={STROKE.glass} fillOpacity={0.12} stroke={STROKE.glass} strokeWidth={STROKES.glassLight} {...NS}
          strokeDasharray="4,3" />

        {/* Vertical spacer bars */}
        {d.spacerV.map((bar, i) => (
          <rect key={`v${i}`} x={ox + bar.left} y={oy} width={SPACER_BAR} height={d.glassH}
            fill={COLORS.bar} fillOpacity={0.3} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Horizontal spacer bars */}
        {d.spacerH.map((bar, i) => (
          <rect key={`h${i}`} x={ox} y={oy + bar.top} width={d.glassW} height={SPACER_BAR}
            fill={COLORS.bar} fillOpacity={0.3} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Overall glass dimensions */}
        <DimH y={oy + d.glassH + DIM_OFF} x1={ox} x2={ox + d.glassW}
          extFrom={oy + d.glassH} label={`${Math.round(d.glassW)} mm`} vbw={totalW} />
        <DimV x={ox + d.glassW + DIM_OFF} y1={oy} y2={oy + d.glassH}
          extFrom={ox + d.glassW} label={`${Math.round(d.glassH)} mm`} vbw={totalW} />

        {/* Edge seal dimension — top left corner */}
        <DimH y={oy - DIM_OFF * 0.6} x1={ox} x2={ox + EDGE_SEAL}
          extFrom={oy} label={`${EDGE_SEAL}`} small vbw={totalW} />

        {/* Segment dimension — top (first segment between edge and first bar) */}
        {d.segW && (
          <DimH y={oy - DIM_OFF} x1={ox} x2={ox + d.segW}
            extFrom={oy} label={`${d.segW}`} small vbw={totalW} />
        )}

        {/* Segment dimension — left (first segment) */}
        {d.segH && (
          <DimV x={ox - DIM_OFF} y1={oy} y2={oy + d.segH}
            extFrom={ox} label={`${d.segH}`} small vbw={totalW} />
        )}

        {/* Title */}
        <text x={totalW / 2} y={totalH - 30 * totalW / VIEWBOX_REF}
          fill={COLORS.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          {d.isUpper ? 'UPPER' : 'LOWER'} GLASS
        </text>

        {/* Spec */}
        <text x={totalW / 2} y={totalH - 12 * totalW / VIEWBOX_REF}
          fill={STROKE.glass} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.glassType} / {d.glassFinish} · spacer: {d.spacerColour}
        </text>

        {/* Cross-check alarm */}
        {!d.crossCheckOk && (
          <text x={totalW / 2} y={oy - DIM_OFF - 15}
            fill="#EF4444" fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family}
            textAnchor="middle" fontWeight="600">
            ⚠ GLASS CHECK FAIL: {d.errors.join(' · ')}
          </text>
        )}
      </svg>
    </div>
  );
}