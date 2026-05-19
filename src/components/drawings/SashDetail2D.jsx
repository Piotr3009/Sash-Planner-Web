/**
 * SashDetail2D.jsx
 *
 * Simplified detail view of a single sash (upper or lower).
 * Shows stiles, rails, glazing bars, glass panes with dimensions.
 * V1 placeholder — will be refined with rebate/profile details later.
 *
 * Props:
 *   type: 'upper' | 'lower'
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, FONT, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN } from './drawingUtils.jsx';

export default function SashDetail2D({ windowSpec, derived, type = 'upper' }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const sashW = derived.sashWidth;
    const stile = CONSTANTS.STILE_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const barW = CONSTANTS.GLAZING_BAR_WIDTH;

    const isUpper = type === 'upper';
    const sashH = isUpper ? derived.topSashHeight : derived.bottomSashHeight;
    const topR = isUpper ? topRail : meetRail;
    const botR = isUpper ? meetRail : botRail;

    // Glass area
    const glassX = stile;
    const glassY = topR;
    const glassW = sashW - 2 * stile;
    const glassH = sashH - topR - botR;

    // Bars
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vBars = 0, hBars = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vBars = cols - 1;
      hBars = isUpper ? Math.floor(rows / 2) : Math.ceil(rows / 2);
    }

    // Horn
    const hasHorns = windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;

    // Section label
    const section = isUpper ? CONSTANTS.SASH_SECTION : CONSTANTS.SASH_SECTION;
    const railSection = isUpper ? CONSTANTS.SASH_SECTION : CONSTANTS.BOTTOM_RAIL_SECTION;

    return {
      sashW, sashH, stile, topR, botR, barW,
      glassX, glassY, glassW, glassH,
      vBars, hBars, hasHorns, hornExt,
      section, railSection, isUpper,
    };
  }, [windowSpec, derived, type]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const totalW = d.sashW + MARGIN * 2 + DIM_OFFSET * 3;
  const totalH = d.sashH + MARGIN * 2 + DIM_OFFSET * 3;
  const label = d.isUpper ? 'UPPER' : 'LOWER';

  return (
    <div className="w-full">
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${totalW} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ maxHeight: '65vh' }}
      >
        {/* Sash outline */}
        <rect x={0} y={0} width={d.sashW} height={d.sashH}
          fill="none" stroke={STROKE.sash} strokeWidth={1.5} />

        {/* Left stile */}
        <rect x={0} y={0} width={d.stile} height={d.sashH}
          fill={STROKE.sectionFill} fillOpacity={0.08} stroke={STROKE.sash} strokeWidth={0.5} />
        <Label x={d.stile / 2} y={d.sashH / 2} text="STILE" />

        {/* Right stile */}
        <rect x={d.sashW - d.stile} y={0} width={d.stile} height={d.sashH}
          fill={STROKE.sectionFill} fillOpacity={0.08} stroke={STROKE.sash} strokeWidth={0.5} />
        <Label x={d.sashW - d.stile / 2} y={d.sashH / 2} text="STILE" />

        {/* Top rail */}
        <rect x={0} y={0} width={d.sashW} height={d.topR}
          fill={STROKE.sectionFill} fillOpacity={0.1} stroke={STROKE.sash} strokeWidth={0.5} />
        <Label x={d.sashW / 2} y={d.topR / 2 + 4}
          text={d.isUpper ? 'TOP RAIL' : 'MEETING RAIL'} />

        {/* Bottom rail */}
        <rect x={0} y={d.sashH - d.botR} width={d.sashW} height={d.botR}
          fill={STROKE.sectionFill} fillOpacity={0.1} stroke={STROKE.sash} strokeWidth={0.5} />
        <Label x={d.sashW / 2} y={d.sashH - d.botR / 2 + 4}
          text={d.isUpper ? 'MEETING RAIL' : 'BOTTOM RAIL'} />

        {/* Glass area */}
        <rect x={d.glassX} y={d.glassY} width={d.glassW} height={d.glassH}
          fill={STROKE.glass} fillOpacity={STROKE.glassOpacity} stroke="none" />

        {/* Vertical bars */}
        {d.vBars > 0 && Array.from({ length: d.vBars }).map((_, i) => {
          const spacing = d.glassW / (d.vBars + 1);
          const bx = d.glassX + spacing * (i + 1) - d.barW / 2;
          return <rect key={`v${i}`} x={bx} y={d.glassY} width={d.barW} height={d.glassH}
            fill={STROKE.sash} fillOpacity={0.15} stroke={STROKE.bar} strokeWidth={0.5} />;
        })}

        {/* Horizontal bars */}
        {d.hBars > 0 && Array.from({ length: d.hBars }).map((_, i) => {
          const spacing = d.glassH / (d.hBars + 1);
          const by = d.glassY + spacing * (i + 1) - d.barW / 2;
          return <rect key={`h${i}`} x={d.glassX} y={by} width={d.glassW} height={d.barW}
            fill={STROKE.sash} fillOpacity={0.15} stroke={STROKE.bar} strokeWidth={0.5} />;
        })}

        {/* Horns (upper sash only — extend below) */}
        {d.isUpper && d.hasHorns && <>
          <line x1={2} y1={d.sashH} x2={2} y2={d.sashH + d.hornExt}
            stroke={STROKE.horn} strokeWidth={2} strokeDasharray="4,3" />
          <line x1={d.sashW - 2} y1={d.sashH} x2={d.sashW - 2} y2={d.sashH + d.hornExt}
            stroke={STROKE.horn} strokeWidth={2} strokeDasharray="4,3" />
          <Label x={d.sashW + 15} y={d.sashH + d.hornExt / 2 + 4} text={`Horn ${d.hornExt}mm`} anchor="start" opacity={0.8} />
        </>}

        {/* Horns (lower sash — extend above) */}
        {!d.isUpper && d.hasHorns && <>
          <line x1={2} y1={0} x2={2} y2={-d.hornExt}
            stroke={STROKE.horn} strokeWidth={2} strokeDasharray="4,3" />
          <line x1={d.sashW - 2} y1={0} x2={d.sashW - 2} y2={-d.hornExt}
            stroke={STROKE.horn} strokeWidth={2} strokeDasharray="4,3" />
          <Label x={d.sashW + 15} y={-d.hornExt / 2 + 4} text={`Horn ${d.hornExt}mm`} anchor="start" opacity={0.8} />
        </>}

        {/* ── Dimensions ── */}
        <DimH y={d.sashH + DIM_OFFSET} x1={0} x2={d.sashW} label={`${d.sashW} mm`} />
        <DimV x={d.sashW + DIM_OFFSET} y1={0} y2={d.sashH} label={`${d.sashH} mm`} />

        {/* Stile width */}
        <DimH y={-DIM_OFFSET} x1={0} x2={d.stile} label={`${d.stile}`} small />
        {/* Top rail */}
        <DimV x={-DIM_OFFSET} y1={0} y2={d.topR} label={`${d.topR}`} small />
        {/* Bottom rail */}
        <DimV x={-DIM_OFFSET} y1={d.sashH - d.botR} y2={d.sashH} label={`${d.botR}`} small />

        {/* Glass dimensions */}
        <DimH y={d.sashH + DIM_OFFSET + 30} x1={d.glassX} x2={d.glassX + d.glassW}
          label={`Glass: ${Math.round(d.glassW)} mm`} small />

        {/* Title */}
        <TitleBlock x={d.sashW / 2} y={d.sashH + DIM_OFFSET * 2 + 30}
          title={`${label} SASH DETAIL — ${d.sashW} × ${d.sashH} mm`}
          subtitle={`Stile: ${d.section} · ${d.isUpper ? 'Top' : 'Bottom'} rail: ${d.railSection}`} />
      </svg>
    </div>
  );
}
