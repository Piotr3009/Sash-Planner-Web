/**
 * GlassDrawing2D.jsx
 *
 * Single glass pane drawing — one per sash (upper or lower).
 * Shows ONLY glass + spacer bars + dimensions. No wood, no frame, no sash.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, WEIGHTS, STROKES, VIEWBOX_REF, DimH, DimV, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };
const MARGIN = 60;
const DIM_OFF = 35;

export default function GlassDrawing2D({ windowSpec, derived, type = 'upper' }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const isUpper = type === 'upper';
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;
    const barW = CONSTANTS.GLAZING_BAR_WIDTH;

    const glassW = sashW - CONSTANTS.GLASS_WIDTH_DEDUCTION;
    const glassH = isUpper
      ? topH - CONSTANTS.GLASS_HEIGHT_DEDUCTION
      : botH - CONSTANTS.GLASS_HEIGHT_DEDUCTION;

    // Bar counts
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vBars = 0, hBars = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vBars = cols - 1;
      hBars = isUpper ? Math.floor(rows / 2) : Math.ceil(rows / 2);
    }

    const { vBars: vBarPos, hBars: hBarPos, paneW, paneH } = computeBarPositions({
      glassX: 0, glassY: 0, glassW, glassH,
      vCount: vBars, hCount: hBars, barW,
    });

    const paneCols = vBars + 1;
    const paneRows = hBars + 1;

    const glassType = windowSpec?.glass?.type || windowSpec?.glazing?.type || 'double';
    const glassFinish = windowSpec?.glass?.finish || windowSpec?.glazing?.finish || 'clear';
    const spacer = windowSpec?.glazing?.spacerColour || 'black';

    return { glassW, glassH, barW, vBarPos, hBarPos, paneW: Math.round(paneW), paneH: Math.round(paneH),
      paneCols, paneRows, glassType, glassFinish, spacer, gridMode, isUpper };
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

        {/* Glass area */}
        <rect x={ox} y={oy} width={d.glassW} height={d.glassH}
          fill={STROKE.glass} fillOpacity={0.15} stroke={STROKE.glass} strokeWidth={STROKES.glass} {...NS} />

        {/* Vertical bars */}
        {d.vBarPos.map((bar, i) => (
          <rect key={`v${i}`} x={ox + bar.left} y={oy} width={d.barW} height={d.glassH}
            fill={COLORS.bar} fillOpacity={0.25} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Horizontal bars */}
        {d.hBarPos.map((bar, i) => (
          <rect key={`h${i}`} x={ox} y={oy + bar.top} width={d.glassW} height={d.barW}
            fill={COLORS.bar} fillOpacity={0.25} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Pane label in centre */}
        <text x={ox + d.glassW / 2} y={oy + d.glassH / 2 + 5}
          fill={STROKE.glass} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.paneCols}×{d.paneRows} · {d.paneW}×{d.paneH}mm
        </text>

        {/* Dimensions — width bottom */}
        <DimH y={oy + d.glassH + DIM_OFF} x1={ox} x2={ox + d.glassW}
          extFrom={oy + d.glassH} label={`${Math.round(d.glassW)} mm`} vbw={totalW} />

        {/* Dimensions — height right */}
        <DimV x={ox + d.glassW + DIM_OFF} y1={oy} y2={oy + d.glassH}
          extFrom={ox + d.glassW} label={`${Math.round(d.glassH)} mm`} vbw={totalW} />

        {/* Pane width — top (if bars exist) */}
        {d.vBarPos.length > 0 && (
          <DimH y={oy - DIM_OFF} x1={ox} x2={ox + d.paneW}
            extFrom={oy} label={`${d.paneW}`} small vbw={totalW} />
        )}

        {/* Pane height — left (if bars exist) */}
        {d.hBarPos.length > 0 && (
          <DimV x={ox - DIM_OFF} y1={oy} y2={oy + d.paneH}
            extFrom={ox} label={`${d.paneH}`} small vbw={totalW} />
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
          {d.glassType} / {d.glassFinish} · spacer: {d.spacer}
        </text>
      </svg>
    </div>
  );
}