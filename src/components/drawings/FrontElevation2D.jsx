/**
 * FrontElevation2D.jsx
 *
 * Composite view: Box (frame) + Upper Sash + Lower Sash
 * positioned together. Center of box Y = meeting rail line.
 * Dim lines: overall frame width & height only.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { computeBarPositions, DimH, DimV, TitleBlock, tfs, HORN_DEF, HORN_W, buildHornPath } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, STROKES, VIEWBOX_REF, WEIGHTS } from './drawingTheme.js';
// Arched sash (ARCHED-WINDOWS-v3 Block 1 H): every arc is the engine's ArcChain (derived.arch) serialised
// by archDrawUtils — box head ring, upper sash top rail ring, upper glass outline, bars — never re-derived here.
import { archToSheet, glassToSheet, archedOutlineD, ringBandD, barBandD, arcLabelPoint, isHaunchArc, radiiText } from './archDrawUtils.js';

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

    // arched sash: the engine's rings / outline / bars (null on every rectangular sash)
    const A = derived.arch && !derived.casement ? derived.arch : null;
    return {
      fw, fh, sashW, topSashH, botSashH,
      stile, topRail, meetRail, botRail,
      uGlassX, uGlassY, uGlassW, uGlassH, uBars,
      lGlassX, lGlassY, lGlassW, lGlassH, lBars,
      gridMode, A,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, sashW, topSashH, botSashH, A } = geom;

  // ─── Layout (SVG Y-down) ───
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 60 * layoutSc;
  const M = A ? 110 * layoutSc : 60 * layoutSc;          // arched: room for the start / rise dims on the right
  const TITLE_AREA = (A ? 75 : 50) * layoutSc;             // arched: third title line
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

  const jambTop = A ? geom.A.geometry.start : fh;                      // arched: the jambs stop at the springing
  const rJamb = [
    `M ${ox + fw - BOX.jambW_bottom} ${SY(0)}`,
    `L ${ox + fw - BOX.jambW_bottom} ${SY(BOX.sillTop)}`,
    bulgeArc(ox + fw - BOX.jambW_bottom, SY(BOX.sillTop), ox + fw - BOX.jambW_top, SY(BOX.sillCurveTop), BOX.bulge),
    `L ${ox + fw - BOX.jambW_top} ${SY(jambTop)}`,
    `L ${ox + fw} ${SY(jambTop)}`,
    `L ${ox + fw} ${SY(0)}`, 'Z',
  ].join(' ');

  const lJamb = [
    `M ${ox + BOX.jambW_bottom} ${SY(0)}`,
    `L ${ox + BOX.jambW_bottom} ${SY(BOX.sillTop)}`,
    bulgeArc(ox + BOX.jambW_bottom, SY(BOX.sillTop), ox + BOX.jambW_top, SY(BOX.sillCurveTop), -BOX.bulge),
    `L ${ox + BOX.jambW_top} ${SY(jambTop)}`,
    `L ${ox} ${SY(jambTop)}`,
    `L ${ox} ${SY(0)}`, 'Z',
  ].join(' ');

  // ── Arched sash: box head ring, jambs to the springing, upper sash outline + arched unit ──
  const AP = A ? (() => {
    const G = A.geometry, O = A.glassOutline;
    const txF = archToSheet(fw, G.rise, ox, oy);                       // arch frame → sheet (apex at oy)
    const txG = glassToSheet(ox + O.origin.x, SY(O.origin.y + O.height), O.height);
    const upperBottom = lowerSashY + meetRail;                          // upper sash bottom = lower sash top + MR overlap
    return {
      headD: ringBandD(G.head.outer, G.head.inner, txF),
      sashD: archedOutlineD(G.topRail.outer, txF, upperBottom),
      daylightD: archedOutlineD(G.topRail.inner, txF, upperBottom - meetRail),
      unitD: archedOutlineD(O.arcs, txG, SY(O.origin.y)),
      barsD: (A.bars || []).map((b) => barBandD(b, txG, BAR_WIDTH / 2)),
      lowerBars: (A.lowerBars?.positions || []).map((yFromTop) => lowerSashY + geom.lGlassY + yFromTop),
      radii: G.arcs.map((a) => ({ r: a.r, at: arcLabelPoint(a, txF, isHaunchArc(a) ? 14 * layoutSc : 14 * layoutSc) })),
      springY: SY(G.start),
      G, O,
    };
  })() : null;
  const head = A ? AP.headD : [
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
  const subtitleText = A ? `${fw} × ${fh} mm · arched sash` : `${fw} × ${fh} mm`;
  const archLine = A ? `${A.geometry.label} · start ${fmt(A.geometry.start)} · rise ${fmt(A.geometry.rise)} · ${radiiText(A.geometry.arcs)} · head ${fmt(A.geometry.head.thickness)}` : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}
        data-arch-origin={AP ? `${ox},${oy}` : undefined}>

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
        {AP ? (
          <g>
            {/* arched upper sash: outline (top rail ring outer + stiles), daylight, the unit and its bars */}
            <path d={AP.sashD} fill="none" stroke={COL.sash} strokeWidth={STROKES.sash} {...NS} />
            <path d={AP.unitD} fill={COL.glass} fillOpacity={COL.glassOpacity} stroke={COL.glass} strokeWidth={STROKES.glassLight} {...NS} />
            <path d={AP.daylightD} fill="none" stroke={COL.sash} strokeWidth={STROKES.glassLight} {...NS} strokeOpacity={0.6} />
            {AP.barsD.map((d, k) => <path key={`uab-${k}`} d={d} fill="none" stroke={COL.bar} strokeWidth={STROKES.bar} {...NS} />)}
          </g>
        ) : (<>
        {/* Upper glass */}
        <rect x={sashX + geom.uGlassX} y={upperSashY + geom.uGlassY}
          width={geom.uGlassW} height={geom.uGlassH}
          fill={COL.glass} fillOpacity={COL.glassOpacity}
          stroke={COL.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {/* Upper bars */}
        {renderBars(geom.uBars, sashX, upperSashY, geom.uGlassX, geom.uGlassY, geom.uGlassW, geom.uGlassH)}
        </>)}

        {/* ── LOWER SASH (only bottom edge visible) ── */}
        {/* Lower glass */}
        <rect x={sashX + geom.lGlassX} y={lowerSashY + geom.lGlassY}
          width={geom.lGlassW} height={geom.lGlassH}
          fill={COL.glass} fillOpacity={COL.glassOpacity}
          stroke={COL.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {/* Lower bars */}
        {renderBars(geom.lBars, sashX, lowerSashY, geom.lGlassX, geom.lGlassY, geom.lGlassW, geom.lGlassH)}
        {/* arched sash: lower straight h bars (engine positions) */}
        {AP && AP.lowerBars.map((y, k) => (
          <rect key={`lhb-${k}`} x={sashX + geom.lGlassX} y={y - BAR_WIDTH / 2} width={geom.lGlassW} height={BAR_WIDTH}
            fill="none" stroke={COL.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
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
          const inset = (geom.stile - HORN_W) / 2;  // centre horn on the stile (elevation only)
          return (
            <g>
              <path d={buildHornPath(type, sashX, sashW, hornTopY, 'L', inset)}
                fill={COL.frameFill} stroke={COL.meeting} strokeWidth={STROKES.sash} {...NS} />
              <path d={buildHornPath(type, sashX, sashW, hornTopY, 'R', inset)}
                fill={COL.frameFill} stroke={COL.meeting} strokeWidth={STROKES.sash} {...NS} />
            </g>
          );
        })()}

        {/* ── ARCHED SASH: springing line, start / rise dims, radii ── */}
        {AP && (
          <g>
            <line x1={ox - DM * 0.2} y1={AP.springY} x2={ox + fw + DM * 0.2} y2={AP.springY}
              stroke={COL.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={`${8 * layoutSc},${3 * layoutSc},${2 * layoutSc},${3 * layoutSc}`} />
            <DimV x={ox + fw + DM * 0.8} y1={AP.springY} y2={SY(0)} extFrom={ox + fw} label={`start ${fmt(AP.G.start)}`} small vbw={totalW} />
            <DimV x={ox + fw + DM * 0.8} y1={oy} y2={AP.springY} extFrom={ox + fw} label={`rise ${fmt(AP.G.rise)}`} small vbw={totalW} />
            {AP.radii.map((rl, k) => (
              <text key={`r-${k}`} x={rl.at[0]} y={rl.at[1]} fill={COL.dim} fontSize={tfs(SIZES.dimSmall, totalW)}
                fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.dim}>{`R ${fmt(rl.r)}`}</text>
            ))}
          </g>
        )}

        {/* ── DIM LINES — overall only: width at the TOP, height on the RIGHT
             outside the arch start / rise dims that now sit there ── */}
        <DimH y={oy - DM * 0.5}
          x1={ox} x2={ox + fw}
          extFrom={oy}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * (A ? 1.6 : 0.8)}
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
        {A && (
          <text x={totalW / 2} y={oy + fh + DM + TITLE_AREA * 0.5 + 40 * (totalW / VIEWBOX_REF)} fill={COLORS.subtitle} fontSize={SIZES.subtitle * (totalW / VIEWBOX_REF)}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{archLine}</text>
        )}
      </svg>
    </div>
  );
}
