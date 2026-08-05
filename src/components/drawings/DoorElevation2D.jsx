/**
 * DoorElevation2D.jsx
 *
 * Exterior view of a door — always drawn from OUTSIDE (Piotr 05.08), same
 * system as CasementElevation2D: mm coordinates, dark theme, non-scaling
 * strokes, Dim helpers from drawingUtils. Geometry from derived.door (engine
 * single source) + the door profile.
 *
 * Layer stack the workshop needs to see (Piotr 05.08):
 *   outward-opening   frame 36 · gap 4 · leaf member 94        (bottom gap 6)
 *   inward-opening    frame 57, overlapping the leaf by 17     (17 + 4 + 36)
 * Glass sizes are deliberately NOT dimensioned here — the glass schedule owns
 * them. Handle sits 1000mm off the floor, constant, matching DoorPanel.jsx:929.
 */
import { useMemo } from 'react';
import { getDoorProfile } from '../../engine/profile.js';
import { computeBarPositions, DimH, DimV, DimChainH, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;
const HANDLE_FLOOR_MM = 1000;   // constant, matches the 3D door panel
const HINGE_LENGTH = 100;       // drawn hinge blade length

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

/** 3 hinges, 4 above 2100mm leaf height (Piotr 05.08 — threshold lowered from 2400). */
function hingePositions(leafY, leafH) {
  const n = leafH > 2100 ? 4 : 3;
  const top = leafY + 200;
  const bottom = leafY + leafH - 250;
  if (n === 3) return [top, (top + bottom) / 2, bottom];
  const step = (bottom - top) / 3;
  return [top, top + step, top + 2 * step, bottom];
}

export default function DoorElevation2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const dr = derived?.door;
    if (!windowSpec || !dr) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;

    const p = getDoorProfile();
    const g = p.geometry;
    const els = p.elements;
    const d = windowSpec.door || {};
    const sp = d.sidePanels || {};

    const inward = !!dr.inward;
    const stile = els.leafStile.face;
    const topRail = els.leafTop.face;
    const bottomRail = els.leafBottom.face;

    // Visible frame band: outward shows the land (36); inward shows the full
    // 57 face because the frame laps over the leaf by 17.
    const frameVisible = inward ? els.frameHead.face : g.land;
    const overlap = inward ? els.frameHead.face - g.land - g.gap : 0;

    // Side panels sit inside the same frame, divided by mullions.
    const mode = sp.mode || 'none';
    const leftW = (mode === 'left' || mode === 'both') ? (Number(sp.leftWidth) || 0) : 0;
    const rightW = (mode === 'right' || mode === 'both') ? (Number(sp.rightWidth) || 0) : 0;
    const mullion = els.mullion.face;

    // Door opening starts after the left panel (+ its mullion) if present.
    const doorX = g.land + g.gap + (leftW ? leftW + mullion : 0);
    const doorRight = fw - g.land - g.gap - (rightW ? rightW + mullion : 0);
    const leafW = Math.max(0, doorRight - doorX);
    const leafY = g.land + g.gap;
    const leafH = dr.leafH;

    const glassX = doorX + stile;
    const glassY = leafY + topRail;
    const glassW = Math.max(0, leafW - 2 * stile);
    const glassH = Math.max(0, leafH - topRail - bottomRail);

    const bars = d.bars || {};
    const barPos = computeBarPositions({
      glassX, glassY, glassW, glassH,
      vCount: Number(bars.v) || 0, hCount: Number(bars.h) || 0, barW: BAR_WIDTH,
    });

    // Style split: three-quarter / half-glazed put a mid rail across the leaf.
    const style = d.style || 'full-glass';
    const midFace = els.leafMid.face;
    let midRailY = null;
    if (style === 'three-quarter') midRailY = leafY + leafH * 0.75 - midFace / 2;
    if (style === 'half-glazed') midRailY = leafY + leafH * 0.5 - midFace / 2;

    return {
      fw, fh, g, els, inward, frameVisible, overlap,
      stile, topRail, bottomRail, midFace, midRailY, style,
      doorX, leafW, leafY, leafH,
      glassX, glassY, glassW, glassH, barPos,
      leftW, rightW, mullion, mode,
      hinge: d.hingeSide || 'left',
      hasTimberCill: !!dr.hasTimberCill,
      threshold: dr.threshold || 'standard',
      cillWider: !!windowSpec.cill?.wider,
      cillExt: Number(windowSpec.cill?.extension) || 0,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, g } = geom;

  // Doors are tall and narrow — allow more side room than the casement sheet so
  // the layer chain and hardware notes have somewhere to live (Piotr 05.08).
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 75 * layoutSc;
  const M = 85 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalH = M + fh + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const bottomLand = geom.hasTimberCill ? g.cillVisible : 0;
  const openRect = {
    x: X(g.land), y: Y(g.land),
    w: fw - 2 * g.land, h: fh - g.land - bottomLand,
  };

  const hinges = hingePositions(geom.leafY, geom.leafH);
  const handleY = geom.leafY + geom.leafH - HANDLE_FLOOR_MM;
  const handleX = geom.hinge === 'left'
    ? geom.doorX + geom.leafW - geom.stile / 2
    : geom.doorX + geom.stile / 2;
  const hingeX = geom.hinge === 'left'
    ? geom.doorX + geom.stile / 2
    : geom.doorX + geom.leafW - geom.stile / 2;

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const swingLabel = `${geom.inward ? 'inward' : 'outward'} · hinge ${geom.hinge}`;
  const thresholdLabel = geom.hasTimberCill
    ? (geom.inward ? 'inward cill 40→35' : 'timber cill')
    : `${geom.threshold} threshold — no timber cill`;
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `Door ${windowSpec.door?.type || 'single-external'} · ${fw} × ${fh} mm · ${swingLabel} · ${thresholdLabel} · exterior view`;

  const SidePanel = ({ x, w }) => (
    <g>
      <rect x={X(x)} y={Y(geom.leafY)} width={w} height={geom.leafH}
        fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
      <rect x={X(x + geom.stile)} y={Y(geom.leafY + geom.topRail)}
        width={Math.max(0, w - 2 * geom.stile)}
        height={Math.max(0, geom.leafH - geom.topRail - geom.bottomRail)}
        fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
        stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
    </g>
  );

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="max-h-[72vh] w-auto max-w-full" style={{ background: COLORS.bg }}>

        {/* ── FRAME band ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(fh)} H ${X(0)} Z
              M ${openRect.x} ${openRect.y} H ${openRect.x + openRect.w}
              V ${openRect.y + openRect.h} H ${openRect.x} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={fh}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={openRect.x} y={openRect.y} width={openRect.w} height={openRect.h}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* Inward-opening: the frame laps OVER the leaf — show the lap edge. */}
        {geom.inward && geom.overlap > 0 && (
          <rect x={X(g.land)} y={Y(g.land)}
            width={fw - 2 * g.land} height={fh - g.land - bottomLand}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
            strokeDasharray={`${sw(5)},${sw(3)}`} />
        )}

        {/* ── CILL — only when a timber cill exists ── */}
        {geom.hasTimberCill && (
          <line x1={X(0)} y1={Y(fh - g.cillVisible)} x2={X(fw)} y2={Y(fh - g.cillVisible)}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        )}

        {/* ── SIDE PANELS + their mullions ── */}
        {geom.leftW > 0 && <>
          <SidePanel x={g.land + g.gap} w={geom.leftW} />
          <rect x={X(g.land + g.gap + geom.leftW)} y={Y(g.land)}
            width={geom.mullion} height={fh - g.land - bottomLand}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
        </>}
        {geom.rightW > 0 && <>
          <rect x={X(fw - g.land - g.gap - geom.rightW - geom.mullion)} y={Y(g.land)}
            width={geom.mullion} height={fh - g.land - bottomLand}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
          <SidePanel x={fw - g.land - g.gap - geom.rightW} w={geom.rightW} />
        </>}

        {/* ── LEAF ── */}
        <rect x={X(geom.doorX)} y={Y(geom.leafY)} width={geom.leafW} height={geom.leafH}
          fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
        {/* 180mm bottom rail — the member that defines a door */}
        <rect x={X(geom.doorX)} y={Y(geom.leafY + geom.leafH - geom.bottomRail)}
          width={geom.leafW} height={geom.bottomRail}
          fill={COLORS.frameFill} stroke={COLORS.sash}
          strokeWidth={STROKES.frameLight} {...NS} />
        {/* Style split: mid rail for three-quarter / half-glazed */}
        {geom.midRailY != null && (
          <rect x={X(geom.doorX)} y={Y(geom.midRailY)}
            width={geom.leafW} height={geom.midFace}
            fill={COLORS.frameFill} stroke={COLORS.sash}
            strokeWidth={STROKES.frameLight} {...NS} />
        )}

        {/* ── GLASS + bars (no glass dimensions — the schedule owns them) ── */}
        <rect x={X(geom.glassX)} y={Y(geom.glassY)} width={geom.glassW}
          height={geom.midRailY != null ? geom.midRailY - geom.glassY : geom.glassH}
          fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {geom.barPos.vBars.map((vb, k) => (
          <rect key={`vb-${k}`} x={X(vb.left)} y={Y(geom.glassY)}
            width={BAR_WIDTH}
            height={geom.midRailY != null ? geom.midRailY - geom.glassY : geom.glassH}
            fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {geom.midRailY == null && geom.barPos.hBars.map((hb, k) => (
          <rect key={`hb-${k}`} x={X(geom.glassX)} y={Y(hb.top)}
            width={geom.glassW} height={BAR_WIDTH}
            fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* ── OPENING SYMBOL — apex on the hinge side ── */}
        {geom.hinge === 'left' ? (
          <path d={`M ${X(geom.doorX + geom.leafW)} ${Y(geom.leafY)}
                    L ${X(geom.doorX)} ${Y(geom.leafY + geom.leafH / 2)}
                    L ${X(geom.doorX + geom.leafW)} ${Y(geom.leafY + geom.leafH)}`}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
            strokeDasharray={`${sw(6)},${sw(4)}`} />
        ) : (
          <path d={`M ${X(geom.doorX)} ${Y(geom.leafY)}
                    L ${X(geom.doorX + geom.leafW)} ${Y(geom.leafY + geom.leafH / 2)}
                    L ${X(geom.doorX)} ${Y(geom.leafY + geom.leafH)}`}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
            strokeDasharray={`${sw(6)},${sw(4)}`} />
        )}

        {/* ── HINGES ── */}
        {hinges.map((hy, i) => (
          <rect key={`hg-${i}`} x={X(hingeX - geom.stile / 2)} y={Y(hy)}
            width={geom.stile} height={HINGE_LENGTH}
            fill={COLORS.frameFill} stroke={COLORS.sillDetail}
            strokeWidth={STROKES.sash} {...NS} />
        ))}
        <DimV x={ox - DM * 0.35} y1={Y(geom.leafY)} y2={Y(hinges[0])}
          extFrom={X(0)} label={`H1 ${fmt(hinges[0] - geom.leafY)}`} small vbw={totalW} />

        {/* ── HANDLE — 1000mm off the floor, constant ── */}
        <circle cx={X(handleX)} cy={Y(handleY)} r={geom.stile * 0.3}
          fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        <DimV x={ox + fw + DM * 0.35} y1={Y(handleY)} y2={Y(fh)}
          extFrom={X(fw)} label={`handle ${HANDLE_FLOOR_MM}`} small vbw={totalW} />

        {/* ── LAYER CHAIN across the leaf: frame · gap · member ── */}
        <DimChainH y={oy - DM * 0.4}
          cuts={geom.inward
            ? [X(0), X(g.land), X(geom.doorX), X(geom.doorX + geom.stile)]
            : [X(0), X(g.land), X(geom.doorX), X(geom.doorX + geom.stile)]}
          extFrom={Y(0)} vbw={totalW} fmt={fmt} />
        <Label x={X(g.land / 2)} y={oy - DM * 0.62}
          text={geom.inward ? `frame ${geom.els.frameHead.face} (lap ${geom.overlap})` : `frame ${g.land}`}
          vbw={totalW} />

        {/* ── BOTTOM GAP + bottom rail ── */}
        <DimV x={ox + fw + DM * 0.7}
          y1={Y(geom.leafY + geom.leafH)} y2={Y(fh - bottomLand)}
          extFrom={X(fw)} label={`gap ${fmt(fh - bottomLand - geom.leafY - geom.leafH)}`}
          small vbw={totalW} />
        <DimV x={ox + fw + DM * 0.35}
          y1={Y(geom.leafY + geom.leafH - geom.bottomRail)} y2={Y(geom.leafY + geom.leafH)}
          extFrom={X(geom.doorX + geom.leafW)} label={fmt(geom.bottomRail)} small vbw={totalW} />

        {/* ── OVERALL DIMS ── */}
        <DimH y={oy + fh + DM * 0.8} x1={X(0)} x2={X(fw)} extFrom={Y(fh)}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 1.1} y1={Y(0)} y2={Y(fh)} extFrom={X(fw)}
          label={fmt(fh)} vbw={totalW} />

        <TitleBlock x={totalW / 2} y={oy + fh + DM + TITLE_AREA * 0.5}
          title={titleText} subtitle={subtitleText} vbw={totalW} />
      </svg>
    </div>
  );
}
