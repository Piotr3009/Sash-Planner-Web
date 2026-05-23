/**
 * FrontElevation2D.jsx
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, WEIGHTS, STROKES, VIEWBOX_REF, DimH, DimV, TitleBlock, DIM_OFFSET, DIM_GAP, MARGIN, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };

export default function FrontElevation2D({ windowSpec, derived }) {
  const drawing = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const frameDepth = windowSpec.frame.depth || 164;
    const jw = CONSTANTS.JAMBS_WIDTH;
    const hw = CONSTANTS.HEAD_WIDTH;
    const sw = CONSTANTS.SILL_WIDTH;
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;
    const stile = CONSTANTS.STILE_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const barW = CONSTANTS.GLAZING_BAR_WIDTH;
    const hasHorns = windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;
    const sashX = (fw - sashW) / 2;
    const sashY = hw;
    const meetY = sashY + topH;
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const uGlassX = sashX + stile;
    const uGlassY = sashY + topRail;
    const uGlassW = sashW - 2 * stile;
    const uGlassH = topH - topRail - meetRail / 2;
    const lGlassX = sashX + stile;
    const lGlassY = meetY + meetRail / 2;
    const lGlassW = sashW - 2 * stile;
    const lGlassH = botH - botRail - meetRail / 2;
    let vBars = 0, hBarsUpper = 0, hBarsLower = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vBars = cols - 1;
      hBarsUpper = Math.floor(rows / 2);
      hBarsLower = Math.ceil(rows / 2);
    }
    const upperBars = computeBarPositions({ glassX: uGlassX, glassY: uGlassY, glassW: uGlassW, glassH: uGlassH, vCount: vBars, hCount: hBarsUpper, barW });
    const lowerBars = computeBarPositions({ glassX: lGlassX, glassY: lGlassY, glassW: lGlassW, glassH: lGlassH, vCount: vBars, hCount: hBarsLower, barW });
    return { fw, fh, jw, hw, sw, sashW, topH, botH, stile, topRail, botRail, meetRail, barW, hasHorns, hornExt, sashX, sashY, meetY, gridMode, vBars, hBarsUpper, hBarsLower, uGlassX, uGlassY, uGlassW, uGlassH, lGlassX, lGlassY, lGlassW, lGlassH, frameDepth, upperBars, lowerBars };
  }, [windowSpec, derived]);

  if (!drawing) return <div className="text-ink-400 text-sm p-8 text-center">No window data for drawing.</div>;

  const d = drawing;
  const totalW = d.fw + MARGIN * 2 + DIM_OFFSET * 3;
  const totalH = d.fh + MARGIN * 2 + DIM_OFFSET * 3;

  return (
    <div className="w-full" style={{ maxHeight: '70vh', overflow: 'auto' }}>
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${totalW} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ background: COLORS.bg }}
      >
        {/* Frame */}
        <rect x={0} y={0} width={d.fw} height={d.fh}
          fill="none" stroke={STROKE.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={0} y={0} width={d.fw} height={d.hw}
          fill={STROKE.frame} fillOpacity={0.08} stroke={STROKE.frame} strokeWidth={STROKES.frameLight} {...NS} />
        <rect x={0} y={d.fh - d.sw} width={d.fw} height={d.sw}
          fill={STROKE.frame} fillOpacity={0.08} stroke={STROKE.frame} strokeWidth={STROKES.frameLight} {...NS} />
        <rect x={0} y={0} width={d.jw} height={d.fh}
          fill={STROKE.frame} fillOpacity={0.05} stroke={STROKE.frame} strokeWidth={STROKES.frameLight} {...NS} />
        <rect x={d.fw - d.jw} y={0} width={d.jw} height={d.fh}
          fill={STROKE.frame} fillOpacity={0.05} stroke={STROKE.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* Upper sash */}
        <rect x={d.sashX} y={d.sashY} width={d.sashW} height={d.topH}
          fill="none" stroke={STROKE.sash} strokeWidth={STROKES.sash} {...NS} />
        <rect x={d.sashX} y={d.sashY} width={d.stile} height={d.topH}
          fill={STROKE.sash} fillOpacity={0.06} stroke={STROKE.sash} strokeWidth={STROKES.sashLight} {...NS} />
        <rect x={d.sashX + d.sashW - d.stile} y={d.sashY} width={d.stile} height={d.topH}
          fill={STROKE.sash} fillOpacity={0.06} stroke={STROKE.sash} strokeWidth={STROKES.sashLight} {...NS} />
        <rect x={d.sashX} y={d.sashY} width={d.sashW} height={d.topRail}
          fill={STROKE.sash} fillOpacity={0.06} stroke={STROKE.sash} strokeWidth={STROKES.sashLight} {...NS} />

        {/* Meeting rail */}
        <rect x={d.sashX} y={d.meetY - d.meetRail / 2} width={d.sashW} height={d.meetRail}
          fill={STROKE.sash} fillOpacity={0.1} stroke={STROKE.sash} strokeWidth={STROKES.meeting} {...NS} />

        {/* Lower sash */}
        <rect x={d.sashX} y={d.meetY} width={d.sashW} height={d.botH}
          fill="none" stroke={STROKE.sash} strokeWidth={STROKES.sash} {...NS} />
        <rect x={d.sashX} y={d.meetY} width={d.stile} height={d.botH}
          fill={STROKE.sash} fillOpacity={0.06} stroke={STROKE.sash} strokeWidth={STROKES.sashLight} {...NS} />
        <rect x={d.sashX + d.sashW - d.stile} y={d.meetY} width={d.stile} height={d.botH}
          fill={STROKE.sash} fillOpacity={0.06} stroke={STROKE.sash} strokeWidth={STROKES.sashLight} {...NS} />
        <rect x={d.sashX} y={d.meetY + d.botH - d.botRail} width={d.sashW} height={d.botRail}
          fill={STROKE.sash} fillOpacity={0.06} stroke={STROKE.sash} strokeWidth={STROKES.sashLight} {...NS} />

        {/* Glass */}
        <rect x={d.uGlassX} y={d.uGlassY} width={d.uGlassW} height={d.uGlassH}
          fill={STROKE.glass} fillOpacity={STROKE.glassOpacity} stroke="none" />
        <rect x={d.lGlassX} y={d.lGlassY} width={d.lGlassW} height={d.lGlassH}
          fill={STROKE.glass} fillOpacity={STROKE.glassOpacity} stroke="none" />

        {/* Bars upper */}
        {d.upperBars.vBars.map((bar, i) => (
          <rect key={`uv${i}`} x={bar.left} y={d.uGlassY} width={d.barW} height={d.uGlassH}
            fill={STROKE.sash} fillOpacity={0.15} stroke={STROKE.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {d.upperBars.hBars.map((bar, i) => (
          <rect key={`uh${i}`} x={d.uGlassX} y={bar.top} width={d.uGlassW} height={d.barW}
            fill={STROKE.sash} fillOpacity={0.15} stroke={STROKE.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Bars lower */}
        {d.lowerBars.vBars.map((bar, i) => (
          <rect key={`lv${i}`} x={bar.left} y={d.lGlassY} width={d.barW} height={d.lGlassH}
            fill={STROKE.sash} fillOpacity={0.15} stroke={STROKE.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {d.lowerBars.hBars.map((bar, i) => (
          <rect key={`lh${i}`} x={d.lGlassX} y={bar.top} width={d.lGlassW} height={d.barW}
            fill={STROKE.sash} fillOpacity={0.15} stroke={STROKE.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Horns */}
        {d.hasHorns && <>
          <line x1={d.sashX + 2} y1={d.meetY} x2={d.sashX + 2} y2={d.meetY + d.hornExt}
            stroke={STROKE.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" />
          <line x1={d.sashX + d.sashW - 2} y1={d.meetY} x2={d.sashX + d.sashW - 2} y2={d.meetY + d.hornExt}
            stroke={STROKE.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" />
          <line x1={d.sashX + 2} y1={d.meetY} x2={d.sashX + 2} y2={d.meetY - d.hornExt}
            stroke={STROKE.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" />
          <line x1={d.sashX + d.sashW - 2} y1={d.meetY} x2={d.sashX + d.sashW - 2} y2={d.meetY - d.hornExt}
            stroke={STROKE.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" />
        </>}

        {/* Dimensions */}
        <DimH y={d.fh + DIM_OFFSET} x1={0} x2={d.fw} extFrom={d.fh} label={`${d.fw} mm`} vbw={totalW} />
        <DimV x={d.fw + DIM_OFFSET} y1={0} y2={d.fh} extFrom={d.fw} label={`${d.fh} mm`} vbw={totalW} />
        <DimH y={-DIM_OFFSET} x1={d.sashX} x2={d.sashX + d.sashW} extFrom={0} label={`Sash: ${d.sashW} mm`} vbw={totalW} />
        <DimV x={-DIM_OFFSET} y1={d.sashY} y2={d.meetY} extFrom={0} label={`${d.topH}`} vbw={totalW} />
        <DimV x={-DIM_OFFSET} y1={d.meetY} y2={d.sashY + d.topH + d.botH} extFrom={0} label={`${d.botH}`} vbw={totalW} />
        <DimH y={d.fh + DIM_OFFSET + DIM_GAP} x1={0} x2={d.jw} extFrom={d.fh} label={`${d.jw}`} small vbw={totalW} />
        <DimH y={d.fh + DIM_OFFSET + DIM_GAP} x1={d.sashX} x2={d.sashX + d.stile} extFrom={d.fh} label={`${d.stile}`} small vbw={totalW} />
        <DimV x={d.fw + DIM_OFFSET + DIM_GAP} y1={0} y2={d.hw} extFrom={d.fw} label={`${d.hw}`} small vbw={totalW} />
        <DimV x={d.fw + DIM_OFFSET + DIM_GAP} y1={d.fh - d.sw} y2={d.fh} extFrom={d.fw} label={`${d.sw}`} small vbw={totalW} />

        {/* Inline text */}
        <text x={d.fw + DIM_OFFSET + DIM_GAP + 15} y={d.meetY + 4}
          fill={STROKE.dimText} fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family} fillOpacity={0.6}>
          MR {d.meetRail}
        </text>
        <text x={d.fw / 2} y={-DIM_OFFSET - DIM_GAP + 5}
          fill={STROKE.dimText} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.5}>
          Frame depth: {d.frameDepth}mm
        </text>
        {d.hasHorns && (
          <text x={d.sashX - 10} y={d.meetY + d.hornExt + 15}
            fill={STROKE.horn} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT.family}
            textAnchor="end" fillOpacity={0.8}>
            Horn {d.hornExt}mm
          </text>
        )}
        <text x={d.fw / 2} y={d.fh + DIM_OFFSET * 2 + DIM_GAP + 10}
          fill={STROKE.dimText} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          FRONT ELEVATION — {d.fw} × {d.fh} mm
        </text>
      </svg>
    </div>
  );
}
