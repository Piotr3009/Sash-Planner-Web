/**
 * VerticalSection2D.jsx
 *
 * Simplified vertical cross-section through the window centre.
 * Shows profile stack: head → top rail → glass → meeting rail → glass → bottom rail → sill.
 * V1 placeholder — rectangles with dimensions. Real profile shapes come later.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, FONT, SIZES, SC_DIVISOR, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN } from './drawingUtils.jsx';

// Profile depths (simplified — will be refined with real profile data)
const PROFILE = {
  headDepth: 141,       // head timber depth (28x141 section)
  sillDepth: 127,       // sill timber depth (69x127 section)
  sashDepth: 57,        // sash section depth
  meetRailDepth: 43,    // meeting rail depth
  botRailDepth: 90,     // bottom rail depth
  glassDepth: 24,       // glass unit thickness (double glazing ~24mm)
  gap: 8,               // gaps between profiles (parting bead, staff bead)
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

    // Build profile stack (y positions, each block)
    const blocks = [];
    let y = 0;

    // Head
    blocks.push({ y, h: hw, w: depth, label: 'HEAD', section: CONSTANTS.FRAME_SECTION, fill: 0.15 });
    y += hw + PROFILE.gap;

    // Top rail (upper sash)
    blocks.push({ y, h: topRail, w: PROFILE.sashDepth, label: 'TOP RAIL', section: CONSTANTS.SASH_SECTION, fill: 0.1 });
    y += topRail;

    // Upper glass zone
    const upperGlassH = topH - topRail - meetRail;
    blocks.push({ y, h: upperGlassH, w: PROFILE.glassDepth, label: 'UPPER GLASS', isGlass: true });
    y += upperGlassH;

    // Meeting rail (overlap zone)
    blocks.push({ y, h: meetRail, w: PROFILE.sashDepth, label: 'MEETING RAIL', section: CONSTANTS.MEETING_RAIL_SECTION, fill: 0.12 });
    y += meetRail + PROFILE.gap;

    // Lower glass zone
    const lowerGlassH = botH - botRail - meetRail;
    blocks.push({ y, h: lowerGlassH, w: PROFILE.glassDepth, label: 'LOWER GLASS', isGlass: true });
    y += lowerGlassH;

    // Bottom rail (lower sash)
    blocks.push({ y, h: botRail, w: PROFILE.botRailDepth, label: 'BOTTOM RAIL', section: CONSTANTS.BOTTOM_RAIL_SECTION, fill: 0.1 });
    y += botRail + PROFILE.gap;

    // Sill
    blocks.push({ y, h: sw, w: depth, label: 'SILL', section: CONSTANTS.SILL_SECTION, fill: 0.15 });
    y += sw;

    const totalStackH = y;

    return { fw, fh, depth, blocks, totalStackH, topH, botH };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  // Drawing area — profile width = max depth, height = stack
  const drawW = d.depth + 60; // extra space for labels
  const totalW = drawW + MARGIN * 2 + DIM_OFFSET * 3;
  const totalH = d.totalStackH + MARGIN * 2 + DIM_OFFSET * 3;
  const sc = totalW / SC_DIVISOR;

  return (
    <div className="w-full">
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${totalW} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ maxHeight: '70vh' }}
      >
        {/* Centre line */}
        <line x1={d.depth / 2} y1={-20} x2={d.depth / 2} y2={d.totalStackH + 20}
          stroke={STROKE.dim} strokeWidth={0.3} strokeDasharray="8,4" strokeOpacity={0.3} />

        {/* Profile blocks */}
        {d.blocks.map((b, i) => (
          <g key={i}>
            {b.isGlass ? (
              // Glass zone
              <rect x={(d.depth - b.w) / 2} y={b.y} width={b.w} height={b.h}
                fill={STROKE.glass} fillOpacity={0.15} stroke={STROKE.glass} strokeWidth={0.5} strokeOpacity={0.4} />
            ) : (
              // Timber profile
              <rect x={(d.depth - b.w) / 2} y={b.y} width={b.w} height={b.h}
                fill={STROKE.sectionFill} fillOpacity={b.fill || 0.1} stroke={STROKE.frame} strokeWidth={1} />
            )}
            {/* Label to the right */}
            <text x={d.depth + 15} y={b.y + b.h / 2 + 4}
              fill={b.isGlass ? STROKE.glass : STROKE.label}
              fontSize={`${SIZES.notch}px`} fontFamily={FONT.family}
              fillOpacity={0.7}>
              {b.label}
            </text>
            {/* Height dimension on right side */}
            {b.h > 30 && (
              <DimV x={d.depth + 80} y1={b.y} y2={b.y + b.h} label={`${Math.round(b.h)}`} small sc={sc} />
            )}
          </g>
        ))}

        {/* Overall height — left */}
        <DimV x={-DIM_OFFSET} y1={0} y2={d.totalStackH} label={`≈ ${d.totalStackH} mm`} sc={sc} />

        {/* Depth dimension — bottom */}
        <DimH y={d.totalStackH + DIM_OFFSET} x1={0} x2={d.depth} label={`Depth: ${d.depth} mm`} sc={sc} />

        {/* Title */}
        <TitleBlock x={d.depth / 2} y={d.totalStackH + DIM_OFFSET * 2 + 20}
          title="VERTICAL SECTION"
          subtitle={`Frame ${d.fw}×${d.fh}mm · Top sash ${d.topH}mm · Bottom sash ${d.botH}mm`} sc={sc} />
      </svg>
    </div>
  );
}
