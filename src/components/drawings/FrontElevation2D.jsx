/**
 * FrontElevation2D.jsx
 *
 * Composite view: Box (frame) + Upper Sash + Lower Sash
 * positioned together. Center of box Y = meeting rail line.
 * Dim lines: overall frame width & height only.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { computeBarPositions, DimH, DimV, TitleBlock, tfs, HORN_DEF, buildHornPath } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, STROKES, VIEWBOX_REF } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };

// ─── Box constants (from BoxDetail2D) ───
const BOX = {
  jambW_bottom: 86, jambW_top: 102, headH: 102,
  sillNose: 33, sillWeatherbar: 46.5, sillDrip: 58,
  sillTop: 68, sillCurveTop: 94, bulge: 0.292123,
};

// ─── Bar patterns (from SashDetail2D) ───
const BAR_PATTERNS = {
  'none': { h: 0, v: 0 }, '2x2': { h: 0, v: 1 }, '3x3': { h: 0, v: 2 },
  '4x4': { h: 1, v: 1 }, '6x6': { h: 1, v: 2 }, '9x9': { h: 2, v: 2 },
};
const BAR_WIDTH = 22;

// ─── Colors ───
const COL = {
  frame: COLORS.frame, frameFill: COLORS.frameFill, sillDetail: COLORS.sillDetail,
  sash: COLORS.sash, glass: COLORS.glass, glassOpacity: COLORS.glassOpacity,
  bar: COLORS.bar, meeting: COLORS.meeting,
  dim: COLORS.dim, title: COLORS.title,
};

// ─── Bulge arc helper (from BoxDetail2D) ───
function bulgeArc(x1, y1, x2, y2, bulge) {
  if (Math.abs(bulge) < 1e-6) return `L ${x2} ${y2}`;
  const dx = x2 - x1, dy = y2 - y1;
  const chord = Math.sqrt(dx * dx + dy * dy);
  const sagitta = Math.abs(bulge) * chord / 2;
  const r = ((chord / 2) ** 2 + sagitta ** 2) / (2 * sagitta);
  const la = Math.abs(bulge) > 1 ? 1 : 0;
  const sw = bulge > 0 ? 0 : 1;
  return `A ${r} ${r} 0 ${la} ${sw} ${x2} ${y2}`;
}

function fmt(n) {
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

export default function FrontElevation2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;

    const sashW = derived.sashWidth;
    const topSashH = derived.topSashHeight;
    const botSashH = derived.bottomSashHeight;

    const stile = CONSTANTS.STILE_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BAR_PATTERNS[gridMode] || BAR_PATTERNS['none'];

    // Upper sash glass area (local to sash origin)
    const uGlassX = stile;
    const uGlassY = topRail;
    const uGlassW = sashW - 2 * stile;
    const uGlassH = topSashH - topRail - meetRail;
    const uBars = computeBarPositions({
      glassX: uGlassX, glassY: uGlassY, glassW: uGlassW, glassH: uGlassH,
      vCount: pattern.v, hCount: pattern.h, barW: BAR_WIDTH,
    });

    // Lower sash glass area (local to sash origin)
    const lGlassX = stile;
    const lGlassY = meetRail;
    const lGlassW = sashW - 2 * stile;
    const lGlassH = botSashH - meetRail - botRail;
    const lBars = computeBarPositions({
      glassX: lGlassX, glassY: lGlassY, glassW: lGlassW, glassH: lGlassH,
      vCount: pattern.v, hCount: pattern.h, barW: BAR_WIDTH,
    });

    return {
      fw, fh, sashW, topSashH, botSashH,
      stile, topRail, meetRail, botRail,
      uGlassX, uGlassY, uGlassW, uGlassH, uBars,
      lGlassX, lGlassY, lGlassW, lGlassH, lBars,
      gridMode,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, sashW, topSashH, botSashH } = geom;

  // ─── Layout (SVG Y-down) ───
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 60 * layoutSc;
  const M = 60 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalH = M + fh + DM + TITLE_AREA;

  const ox = M;               // frame left edge in SVG
  const oy = M;               // frame top edge in SVG

  // ─── Sash positions (SVG coords) ───
  // Meeting rails overlap by meetRail (43mm). Combined visible height is
  // topSashH + botSashH - meetRail, centered at box center Y.
  const meetRail = geom.meetRail;
  const combinedH = topSashH + botSashH - meetRail;
  const sashX = ox + (fw - sashW) / 2;
  const centerY = oy + fh / 2;
  const upperSashY = centerY - combinedH / 2;
  const lowerSashY = upperSashY + topSashH - meetRail;

  // ─── Box frame paths (SVG Y-down) ───
  // Y-flip helper: real y → SVG y  (y=0 = sill bottom, y=fh = head top)
  const SY = (y) => oy + (fh - y);

  const rJamb = [
    `M ${ox + fw - BOX.jambW_bottom} ${SY(0)}`,
    `L ${ox + fw - BOX.jambW_bottom} ${SY(BOX.sillTop)}`,
    bulgeArc(ox + fw - BOX.jambW_bottom, SY(BOX.sillTop), ox + fw - BOX.jambW_top, SY(BOX.sillCurveTop), BOX.bulge),
    `L ${ox + fw - BOX.jambW_top} ${SY(fh)}`,
    `L ${ox + fw} ${SY(fh)}`,
    `L ${ox + fw} ${SY(0)}`, 'Z',
  ].join(' ');

  const lJamb = [
    `M ${ox + BOX.jambW_bottom} ${SY(0)}`,
    `L ${ox + BOX.jambW_bottom} ${SY(BOX.sillTop)}`,
    bulgeArc(ox + BOX.jambW_bottom, SY(BOX.sillTop), ox + BOX.jambW_top, SY(BOX.sillCurveTop), -BOX.bulge),
    `L ${ox + BOX.jambW_top} ${SY(fh)}`,
    `L ${ox} ${SY(fh)}`,
    `L ${ox} ${SY(0)}`, 'Z',
  ].join(' ');

  const head = [
    `M ${ox + BOX.jambW_top} ${SY(fh)}`,
    `L ${ox + fw - BOX.jambW_top} ${SY(fh)}`,
    `L ${ox + fw - BOX.jambW_top} ${SY(fh - BOX.headH)}`,
    `L ${ox + BOX.jambW_top} ${SY(fh - BOX.headH)}`, 'Z',
  ].join(' ');

  const sill = [
    `M ${ox + BOX.jambW_bottom} ${SY(0)}`,
    `L ${ox + fw - BOX.jambW_bottom} ${SY(0)}`,
    `L ${ox + fw - BOX.jambW_bottom} ${SY(BOX.sillNose)}`,
    `L ${ox + BOX.jambW_bottom} ${SY(BOX.sillNose)}`, 'Z',
  ].join(' ');

  // ─── Sash bar renderer ───
  const renderBars = (bars, sashOriginX, sashOriginY, glassX, glassY, glassW, glassH) => {
    const { vBars, hBars } = bars;
    return (
      <g>
        {vBars.map((vb, i) => (
          <rect key={`vb-${i}`}
            x={sashOriginX + vb.left} y={sashOriginY + glassY}
            width={BAR_WIDTH} height={glassH}
            fill="none" stroke={COL.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {hBars.map((hb, j) => (
          <rect key={`hb-${j}`}
            x={sashOriginX + glassX} y={sashOriginY + hb.top}
            width={glassW} height={BAR_WIDTH}
            fill="none" stroke={COL.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
      </g>
    );
  };

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `${fw} × ${fh} mm`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── BOX FRAME ── */}
        <path d={rJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />
        <path d={lJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />
        <path d={head} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />
        <path d={sill} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />

        {/* Sill detail lines — only draw where NOT behind lower sash */}
        {(() => {
          const sillLineLeft = ox + BOX.jambW_bottom;
          const sillLineRight = ox + fw - BOX.jambW_bottom;
          const sashLeft = sashX;
          const sashRight = sashX + sashW;
          // sillWeatherbar & sillDrip are below sash bottom → fully visible
          // sillTop is inside sash area → clip to segments outside sash
          return (
            <g>
              <line x1={sillLineLeft} y1={SY(BOX.sillWeatherbar)} x2={sillLineRight} y2={SY(BOX.sillWeatherbar)}
                stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              <line x1={sillLineLeft} y1={SY(BOX.sillDrip)} x2={sillLineRight} y2={SY(BOX.sillDrip)}
                stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              {/* sillTop — only the tiny segments outside sash horizontal span */}
              {sashLeft > sillLineLeft && (
                <line x1={sillLineLeft} y1={SY(BOX.sillTop)} x2={sashLeft} y2={SY(BOX.sillTop)}
                  stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              )}
              {sashRight < sillLineRight && (
                <line x1={sashRight} y1={SY(BOX.sillTop)} x2={sillLineRight} y2={SY(BOX.sillTop)}
                  stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              )}
            </g>
          );
        })()}

        {/* ── UPPER SASH (no outer rect — edges hidden behind head & jambs) ── */}
        {/* Upper glass */}
        <rect x={sashX + geom.uGlassX} y={upperSashY + geom.uGlassY}
          width={geom.uGlassW} height={geom.uGlassH}
          fill={COL.glass} fillOpacity={COL.glassOpacity}
          stroke={COL.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {/* Upper bars */}
        {renderBars(geom.uBars, sashX, upperSashY, geom.uGlassX, geom.uGlassY, geom.uGlassW, geom.uGlassH)}

        {/* ── LOWER SASH (only bottom edge visible) ── */}
        {/* Lower glass */}
        <rect x={sashX + geom.lGlassX} y={lowerSashY + geom.lGlassY}
          width={geom.lGlassW} height={geom.lGlassH}
          fill={COL.glass} fillOpacity={COL.glassOpacity}
          stroke={COL.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {/* Lower bars */}
        {renderBars(geom.lBars, sashX, lowerSashY, geom.lGlassX, geom.lGlassY, geom.lGlassW, geom.lGlassH)}
        {/* Lower sash bottom edge (visible — sits in front of sill) */}
        <line x1={sashX} y1={lowerSashY + botSashH} x2={sashX + sashW} y2={lowerSashY + botSashH}
          stroke={COL.sash} strokeWidth={STROKES.sash} {...NS} />

        {/* Meeting rail line — clipped to visible cavity between jambs */}
        <line x1={ox + BOX.jambW_top} y1={lowerSashY + meetRail / 2}
          x2={ox + fw - BOX.jambW_top} y2={lowerSashY + meetRail / 2}
          stroke={COL.meeting} strokeWidth={STROKES.meeting} {...NS} />

        {/* ── HORNS — upper-sash bottom corners, profile from 3D HornMesh ── */}
        {windowSpec?.sash?.horns && HORN_DEF[windowSpec.sash.hornType] && (() => {
          const type = windowSpec.sash.hornType;
          const hornTopY = upperSashY + topSashH;   // upper-sash bottom edge
          return (
            <g>
              <path d={buildHornPath(type, sashX, sashW, hornTopY, 'L')}
                fill={COL.frameFill} stroke={COL.sash} strokeWidth={STROKES.sash} {...NS} />
              <path d={buildHornPath(type, sashX, sashW, hornTopY, 'R')}
                fill={COL.frameFill} stroke={COL.sash} strokeWidth={STROKES.sash} {...NS} />
            </g>
          );
        })()}

        {/* ── DIM LINES — overall only ── */}
        <DimH y={oy + fh + DM * 0.8}
          x1={ox} x2={ox + fw}
          extFrom={oy + fh}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 0.8}
          y1={oy} y2={oy + fh}
          extFrom={ox + fw}
          label={fmt(fh)} vbw={totalW} />

        {/* ── TITLE ── */}
        <TitleBlock
          x={totalW / 2}
          y={oy + fh + DM + TITLE_AREA * 0.5}
          title={titleText}
          subtitle={subtitleText}
          vbw={totalW} />
      </svg>
    </div>
  );
}
