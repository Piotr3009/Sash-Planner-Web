/**
 * GlassDrawing2D.jsx
 *
 * Visual representation of glass panes within the sash window.
 * Shows pane positions, dimensions, and glazing spec labels.
 * Used in both per-window Glass tab and batch Production Pack.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, FONT, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN, computeBarPositions } from './drawingUtils.jsx';

export default function GlassDrawing2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;
    const stile = CONSTANTS.STILE_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const barW = CONSTANTS.GLAZING_BAR_WIDTH;
    const jw = CONSTANTS.JAMBS_WIDTH;
    const hw = CONSTANTS.HEAD_WIDTH;
    const sw = CONSTANTS.SILL_WIDTH;

    const sashX = (fw - sashW) / 2;
    const sashY = hw;
    const meetY = sashY + topH;

    // Glass zones
    const uGlassX = sashX + stile;
    const uGlassY = sashY + topRail;
    const uGlassW = sashW - 2 * stile;
    const uGlassH = topH - topRail - meetRail / 2;

    const lGlassX = sashX + stile;
    const lGlassY = meetY + meetRail / 2;
    const lGlassW = sashW - 2 * stile;
    const lGlassH = botH - botRail - meetRail / 2;

    // Bars
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vBars = 0, hBarsUpper = 0, hBarsLower = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vBars = cols - 1;
      hBarsUpper = Math.floor(rows / 2);
      hBarsLower = Math.ceil(rows / 2);
    }

    // Compute individual pane sizes
    const uPaneCols = vBars + 1;
    const uPaneRows = hBarsUpper + 1;
    const uPaneW = Math.round((uGlassW - vBars * barW) / uPaneCols);
    const uPaneH = Math.round((uGlassH - hBarsUpper * barW) / uPaneRows);

    const lPaneCols = vBars + 1;
    const lPaneRows = hBarsLower + 1;
    const lPaneW = Math.round((lGlassW - vBars * barW) / lPaneCols);
    const lPaneH = Math.round((lGlassH - hBarsLower * barW) / lPaneRows);

    // Compute equal-pane bar positions (drawing aligned with paneW/paneH above)
    const upperBars = computeBarPositions({
      glassX: uGlassX, glassY: uGlassY, glassW: uGlassW, glassH: uGlassH,
      vCount: vBars, hCount: hBarsUpper, barW,
    });
    const lowerBars = computeBarPositions({
      glassX: lGlassX, glassY: lGlassY, glassW: lGlassW, glassH: lGlassH,
      vCount: vBars, hCount: hBarsLower, barW,
    });

    // Glazing spec
    const glassType = windowSpec.glazing?.type || 'double';
    const glassSpec = windowSpec.glazing?.spec || 'standard';
    const spacer = windowSpec.glazing?.spacerColour || 'black';
    const finish = windowSpec.glazing?.finish || 'clear';

    return {
      fw, fh, sashW, sashX, sashY, meetY, stile, topRail, botRail, meetRail, jw, hw, sw, barW,
      uGlassX, uGlassY, uGlassW, uGlassH, lGlassX, lGlassY, lGlassW, lGlassH,
      vBars, hBarsUpper, hBarsLower,
      uPaneW, uPaneH, uPaneCols, uPaneRows,
      lPaneW, lPaneH, lPaneCols, lPaneRows,
      upperBars, lowerBars,
      glassType, glassSpec, spacer, finish,
    };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const totalW = d.fw + MARGIN * 2 + DIM_OFFSET * 3;
  const totalH = d.fh + MARGIN * 2 + DIM_OFFSET * 4;
  const sc = Math.max(d.fw, d.fh) / 500;

  return (
    <div className="w-full">
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${totalW} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ maxHeight: '70vh' }}
      >
        {/* Faint frame outline */}
        <rect x={0} y={0} width={d.fw} height={d.fh}
          fill="none" stroke={STROKE.frame} strokeWidth={0.5} strokeOpacity={0.3} />

        {/* Sash outlines (faint) */}
        <rect x={d.sashX} y={d.sashY} width={d.sashW} height={d.fh - d.hw - d.sw}
          fill="none" stroke={STROKE.sash} strokeWidth={0.3} strokeOpacity={0.3} />

        {/* ── UPPER GLASS ZONE ── */}
        <rect x={d.uGlassX} y={d.uGlassY} width={d.uGlassW} height={d.uGlassH}
          fill={STROKE.glass} fillOpacity={0.2} stroke={STROKE.glass} strokeWidth={1} />

        {/* Upper bars — equal-pane positions */}
        {d.upperBars.vBars.map((bar, i) => (
          <rect key={`uv${i}`} x={bar.left} y={d.uGlassY} width={d.barW} height={d.uGlassH}
            fill={STROKE.frame} fillOpacity={0.2} stroke={STROKE.bar} strokeWidth={0.5} />
        ))}
        {d.upperBars.hBars.map((bar, i) => (
          <rect key={`uh${i}`} x={d.uGlassX} y={bar.top} width={d.uGlassW} height={d.barW}
            fill={STROKE.frame} fillOpacity={0.2} stroke={STROKE.bar} strokeWidth={0.5} />
        ))}

        {/* ── LOWER GLASS ZONE ── */}
        <rect x={d.lGlassX} y={d.lGlassY} width={d.lGlassW} height={d.lGlassH}
          fill={STROKE.glass} fillOpacity={0.2} stroke={STROKE.glass} strokeWidth={1} />

        {/* Lower bars — equal-pane positions */}
        {d.lowerBars.vBars.map((bar, i) => (
          <rect key={`lv${i}`} x={bar.left} y={d.lGlassY} width={d.barW} height={d.lGlassH}
            fill={STROKE.frame} fillOpacity={0.2} stroke={STROKE.bar} strokeWidth={0.5} />
        ))}
        {d.lowerBars.hBars.map((bar, i) => (
          <rect key={`lh${i}`} x={d.lGlassX} y={bar.top} width={d.lGlassW} height={d.barW}
            fill={STROKE.frame} fillOpacity={0.2} stroke={STROKE.bar} strokeWidth={0.5} />
        ))}

        {/* ── Pane labels (centre of each pane) ── */}
        <PaneLabel x={d.uGlassX + d.uGlassW / 2} y={d.uGlassY + d.uGlassH / 2}
          w={d.uPaneW} h={d.uPaneH} cols={d.uPaneCols} rows={d.uPaneRows} prefix="UP" />
        <PaneLabel x={d.lGlassX + d.lGlassW / 2} y={d.lGlassY + d.lGlassH / 2}
          w={d.lPaneW} h={d.lPaneH} cols={d.lPaneCols} rows={d.lPaneRows} prefix="LP" />

        {/* ── Dimensions ── */}
        {/* Upper glass zone */}
        <DimH y={d.uGlassY - 15} x1={d.uGlassX} x2={d.uGlassX + d.uGlassW} label={`${Math.round(d.uGlassW)} mm`} small sc={sc} />
        <DimV x={d.fw + DIM_OFFSET} y1={d.uGlassY} y2={d.uGlassY + d.uGlassH} label={`${Math.round(d.uGlassH)}`} small sc={sc} />

        {/* Lower glass zone */}
        <DimV x={d.fw + DIM_OFFSET} y1={d.lGlassY} y2={d.lGlassY + d.lGlassH} label={`${Math.round(d.lGlassH)}`} small sc={sc} />

        {/* Individual pane size */}
        <DimH y={d.fh + DIM_OFFSET} x1={d.uGlassX} x2={d.uGlassX + d.uPaneW}
          label={`Pane: ${d.uPaneW}mm`} small />

        {/* Spec label */}
        <text x={d.fw / 2} y={d.fh + DIM_OFFSET + 35}
          fill={STROKE.glass} fontSize={FONT.size * 0.8} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.glassType} · {d.glassSpec} · Spacer: {d.spacer} · Finish: {d.finish}
        </text>

        {/* Pane count */}
        <text x={d.fw / 2} y={d.fh + DIM_OFFSET + 52}
          fill={STROKE.dimText} fontSize={FONT.size * 0.7} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.5}>
          Upper: {d.uPaneCols}×{d.uPaneRows} ({d.uPaneCols * d.uPaneRows} panes) · Lower: {d.lPaneCols}×{d.lPaneRows} ({d.lPaneCols * d.lPaneRows} panes)
        </text>

        {/* Title */}
        <TitleBlock x={d.fw / 2} y={d.fh + DIM_OFFSET * 2 + 55}
          title={`GLASS DRAWING — ${d.fw} × ${d.fh} mm`} />
      </svg>
    </div>
  );
}

// ─── Pane centre label ───
function PaneLabel({ x, y, w, h, cols, rows, prefix }) {
  return (
    <text x={x} y={y + 5}
      fill={STROKE.glass} fontSize={FONT.size * 0.7} fontFamily={FONT.family}
      textAnchor="middle" fillOpacity={0.6}>
      {cols}×{rows} · {w}×{h}mm
    </text>
  );
}
