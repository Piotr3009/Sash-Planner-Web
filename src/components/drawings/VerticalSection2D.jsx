/**
 * VerticalSection2D.jsx
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, STROKES, VIEWBOX_REF, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN, tfs } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };

const PROFILE = {
  headDepth: 141, sillDepth: 127, sashDepth: 57, meetRailDepth: 43,
  botRailDepth: 90, glassDepth: 24, gap: 8,
};

export default function VerticalSection2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const depth = windowSpec.frame.depth || 164;
    const hw = CONSTANTS.HEAD_WIDTH;
    const sw = CONSTANTS.SILL_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;
    const blocks = [];
    let y = 0;
    blocks.push({ y, h: hw, w: depth, label: 'HEAD', fill: 0.15 });
    y += hw + PROFILE.gap;
    blocks.push({ y, h: topRail, w: PROFILE.sashDepth, label: 'TOP RAIL', fill: 0.1 });
    y += topRail;
    const upperGlassH = topH - topRail - meetRail;
    blocks.push({ y, h: upperGlassH, w: PROFILE.glassDepth, label: 'UPPER GLASS', isGlass: true });
    y += upperGlassH;
    blocks.push({ y, h: meetRail, w: PROFILE.sashDepth, label: 'MEETING RAIL', fill: 0.12 });
    y += meetRail + PROFILE.gap;
    const lowerGlassH = botH - botRail - meetRail;
    blocks.push({ y, h: lowerGlassH, w: PROFILE.glassDepth, label: 'LOWER GLASS', isGlass: true });
    y += lowerGlassH;
    blocks.push({ y, h: botRail, w: PROFILE.botRailDepth, label: 'BOTTOM RAIL', fill: 0.1 });
    y += botRail + PROFILE.gap;
    blocks.push({ y, h: sw, w: depth, label: 'SILL', fill: 0.15 });
    y += sw;
    return { fw, fh, depth, blocks, totalStackH: y, topH, botH };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const drawW = d.depth + 60;
  const totalW = drawW + MARGIN * 2 + DIM_OFFSET * 3;
  const totalH = d.totalStackH + MARGIN * 2 + DIM_OFFSET * 3;

  return (
    <div className="w-full" style={{ maxHeight: '70vh', overflow: 'auto' }}>
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${totalW} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ background: COLORS.bg }}
      >
        <line x1={d.depth / 2} y1={-20} x2={d.depth / 2} y2={d.totalStackH + 20}
          stroke={STROKE.dim} strokeWidth={STROKES.center} {...NS} strokeDasharray="8,4" strokeOpacity={0.3} />

        {d.blocks.map((b, i) => (
          <g key={i}>
            {b.isGlass ? (
              <rect x={(d.depth - b.w) / 2} y={b.y} width={b.w} height={b.h}
                fill={STROKE.glass} fillOpacity={0.15} stroke={STROKE.glass} strokeWidth={STROKES.glassLight} {...NS} strokeOpacity={0.4} />
            ) : (
              <rect x={(d.depth - b.w) / 2} y={b.y} width={b.w} height={b.h}
                fill={STROKE.sectionFill} fillOpacity={b.fill || 0.1} stroke={STROKE.frame} strokeWidth={STROKES.section} {...NS} />
            )}
            <text x={d.depth + 15} y={b.y + b.h / 2 + 4}
              fill={b.isGlass ? STROKE.glass : STROKE.label}
              fontSize={tfs(SIZES.notch, totalW)} fontFamily={FONT.family} fillOpacity={0.7}>
              {b.label}
            </text>
            {b.h > 30 && (
              <DimV x={d.depth + 80} y1={b.y} y2={b.y + b.h} extFrom={d.depth} label={`${Math.round(b.h)}`} small vbw={totalW} />
            )}
          </g>
        ))}

        <DimV x={-DIM_OFFSET} y1={0} y2={d.totalStackH} extFrom={0} label={`≈ ${d.totalStackH} mm`} vbw={totalW} />
        <DimH y={d.totalStackH + DIM_OFFSET} x1={0} x2={d.depth} extFrom={d.totalStackH} label={`Depth: ${d.depth} mm`} vbw={totalW} />
        <TitleBlock x={d.depth / 2} y={d.totalStackH + DIM_OFFSET * 2 + 20}
          title="VERTICAL SECTION"
          subtitle={`Frame ${d.fw}×${d.fh}mm · Top sash ${d.topH}mm · Bottom sash ${d.botH}mm`} vbw={totalW} />
      </svg>
    </div>
  );
}
