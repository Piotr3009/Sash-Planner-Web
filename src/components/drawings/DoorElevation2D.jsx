/**
 * DoorElevation2D.jsx
 *
 * Exterior view of a door — always drawn from OUTSIDE (Piotr 05.08), same
 * system as CasementElevation2D: mm coordinates, dark theme, non-scaling
 * strokes, Dim helpers from drawingUtils. ALL geometry comes from
 * derived.door.zones/leaves (engine single source) — this sheet computes no
 * widths itself, so it can never disagree with the cut list or the Leaf
 * sheet (the v1 side-panel bug: two sheets showed two different leaves).
 *
 * Leaf members ARE drawn, hairline-light (Piotr 09.08 — reverses the earlier
 * "never draw members" rule: "narysuj, ale mega delikatnie"). Glass sizes are
 * deliberately NOT dimensioned here — the glass schedule owns them. Handle
 * sits 1000mm off the floor, constant, matching DoorPanel.jsx:929.
 *
 * FRENCH: two leaves, NO centre mullion ever — the meeting stiles are
 * rebated 6mm with a 3mm clearance; only the 6mm overlap matters for sizing
 * (94 + 94 − 6 = 182 meeting band). Passive leaf carries bolts top + bottom.
 * TRANSOM: PSW/3D convention — the frame is TALLER by transomHeight; the 68
 * rail sits with its bottom flush with the door-opening top, fan above it.
 */
import { useMemo } from 'react';
import { getDoorProfile } from '../../engine/profile.js';
import { computeBarPositions, DimH, DimV, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;
const HANDLE_FLOOR_MM = 1000;   // constant, matches the 3D door panel
// Hinge barrel as modelled in 3D (DoorWindow.jsx) — 10mm wide, 102mm tall,
// sitting ON the leaf edge (Piotr 05.08 — drawn red).
const HINGE_H = 102;
const HINGE_W = 10;

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

/**
 * Hinge centres — identical spacing to the 3D model, y grows downwards:
 * top 200 below leaf top · middle 100 above centre · bottom 150 above leaf
 * bottom. 4th hinge between top and middle above 2100mm leaf height
 * (Piotr 05.08 + 09.08 — "masz regułę: 3 do 2100, 4 powyżej").
 */
function hingePositions(leafY, leafH) {
  const top = leafY + 200;
  const middle = leafY + leafH / 2 - 100;
  const bottom = leafY + leafH - 150;
  return leafH > 2100
    ? [top, (top + middle) / 2, middle, bottom]
    : [top, middle, bottom];
}

export default function DoorElevation2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const dr = derived?.door;
    if (!windowSpec || !dr || !dr.zones) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;

    const p = getDoorProfile();
    const g = p.geometry;
    const els = p.elements;
    const d = windowSpec.door || {};

    const totalH = Number(dr.totalHeight) || fh;
    const dy = totalH - fh;                 // transom zone above the door zone
    const inward = !!dr.inward;

    // Visible frame band: outward shows the land (36); inward shows the full
    // 57 face because the frame laps over the leaf by 17.
    const frameVisible = inward ? els.frameHead.face : g.land;
    const overlapLap = inward ? els.frameHead.face - g.land - g.gap : 0;

    const stile = els.leafStile.face;
    const topRail = els.leafTop.face;
    const bottomRail = els.leafBottom.face;
    const midFace = els.leafMid.face;
    const style = d.style || 'full-glass';
    const spMember = dr.sidePanelMember || 57;
    const inset = g.glassInset;

    const leaves = (dr.leaves || []).map((leaf) => {
      const y = dy + g.land + g.gap;
      const glassX = leaf.x + stile;
      const glassY = y + topRail;
      const glassW = Math.max(0, leaf.w - 2 * stile);
      const glassH = Math.max(0, leaf.h - topRail - bottomRail);
      let midRailY = null;
      if (style === 'three-quarter') midRailY = y + leaf.h * 0.75 - midFace / 2;
      if (style === 'half-glazed') midRailY = y + leaf.h * 0.5 - midFace / 2;
      const bars = d.bars || {};
      const barPos = computeBarPositions({
        glassX, glassY, glassW, glassH,
        vCount: Number(bars.v) || 0, hCount: Number(bars.h) || 0, barW: BAR_WIDTH,
      });
      return { ...leaf, y, glassX, glassY, glassW, glassH, midRailY, barPos };
    });

    return {
      fw, fh, totalH, dy, g, els, inward, frameVisible, overlapLap,
      stile, topRail, bottomRail, midFace, style, spMember, inset,
      leaves, zones: dr.zones,
      isFrench: (dr.type || '') === 'french',
      frenchOverlap: Number(dr.overlap) || 0,
      hinge: d.hingeSide || 'left',
      hasTimberCill: !!dr.hasTimberCill,
      threshold: dr.threshold || 'standard',
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, totalH, dy, g, zones } = geom;

  // Doors are tall and narrow — allow more side room than the casement sheet
  // so the layer chain and hardware notes have somewhere to live.
  const layoutSc = Math.max(fw, totalH) / 500;
  const DM = 75 * layoutSc;
  const M = 85 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalHsvg = M + totalH + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const bottomLand = geom.hasTimberCill ? g.cillVisible : 0;
  const openRect = {
    x: X(g.land), y: Y(g.land),
    w: fw - 2 * g.land, h: totalH - g.land - bottomLand,
  };

  const tz = zones.transom;
  // Rail bottom edge flush with the door-opening top (3D convention): the
  // rail pokes railH−frameFace above dy; the leaf laps it from below.
  const railTopY = tz ? dy - (tz.railH - geom.els.frameHead.face) : 0;
  const railBottomY = tz ? dy + g.land + g.gap : 0;

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const activeLeaf = geom.leaves.find((l) => l.role !== 'passive') || geom.leaves[0];
  const swingLabel = geom.isFrench
    ? `open ${geom.hinge} · active ${activeLeaf?.hinge === 'right' ? 'right' : 'left'} leaf (from outside)`
    : `${geom.inward ? 'inward' : 'outward'} · open ${geom.hinge} (hinges ${activeLeaf?.hinge} from outside)`;
  const thresholdLabel = geom.hasTimberCill
    ? (geom.inward ? 'inward cill 40→35' : 'timber cill')
    : `${geom.threshold} threshold — no timber cill`;
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `Door ${windowSpec.door?.type || 'single-external'} · ${fw} × ${fh}${tz ? ` + ${tz.h} fan` : ''} mm · ${swingLabel} · ${thresholdLabel} · exterior view`;

  const SidePanel = ({ x, w }) => {
    const y = dy + g.land + g.gap;
    const h = geom.leaves[0]?.h || fh - 87;
    const m = geom.spMember;
    return (
      <g>
        <rect x={X(x)} y={Y(y)} width={w} height={h}
          fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Members hairline — fixed panel, all 57 (as 3D) */}
        <line x1={X(x + m)} y1={Y(y)} x2={X(x + m)} y2={Y(y + h)}
          stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
        <line x1={X(x + w - m)} y1={Y(y)} x2={X(x + w - m)} y2={Y(y + h)}
          stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
        <rect x={X(x + m)} y={Y(y + m)}
          width={Math.max(0, w - 2 * m)} height={Math.max(0, h - 2 * m)}
          fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
      </g>
    );
  };

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${totalW} ${totalHsvg}`} xmlns="http://www.w3.org/2000/svg"
        className="max-h-[72vh] w-auto max-w-full" style={{ background: COLORS.bg }}>

        {/* ── FRAME band (full taller frame when a fan is present) ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(totalH)} H ${X(0)} Z
              M ${openRect.x} ${openRect.y} H ${openRect.x + openRect.w}
              V ${openRect.y + openRect.h} H ${openRect.x} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={totalH}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={openRect.x} y={openRect.y} width={openRect.w} height={openRect.h}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* ── TRANSOM: fan glass + internal 68 rail ── */}
        {tz && <>
          <rect x={X(geom.els.frameHead.face - geom.inset)} y={Y(geom.els.frameHead.face - geom.inset)}
            width={Math.max(0, fw - 2 * (geom.els.frameHead.face - geom.inset))}
            height={Math.max(0, tz.h - (geom.els.frameHead.face - geom.inset) - (tz.railH - geom.inset))}
            fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
            stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
          <rect x={X(g.land)} y={Y(railTopY)}
            width={fw - 2 * g.land} height={railBottomY - railTopY}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
          <Label x={X(fw / 2)} y={Y((railTopY + railBottomY) / 2) + sw(3)}
            text={`TRANSOM ${tz.railH}${tz.type === 'opening' ? ' · opening fan' : ''}`} vbw={totalW} />
        </>}

        {/* Inward-opening: the frame laps OVER the leaf — show the lap edge. */}
        {geom.inward && geom.overlapLap > 0 && (
          <rect x={X(g.land)} y={Y(dy + g.land)}
            width={fw - 2 * g.land} height={fh - g.land - bottomLand}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
            strokeDasharray={`${sw(5)},${sw(3)}`} />
        )}

        {/* ── CILL — only when a timber cill exists ── */}
        {geom.hasTimberCill && (
          <line x1={X(0)} y1={Y(totalH - g.cillVisible)} x2={X(fw)} y2={Y(totalH - g.cillVisible)}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        )}

        {/* ── SIDE PANELS + mullion bands (26 visible between leaf edges) ── */}
        {zones.leftPanel && <SidePanel x={zones.leftPanel.x} w={zones.leftPanel.w} />}
        {zones.rightPanel && <SidePanel x={zones.rightPanel.x} w={zones.rightPanel.w} />}
        {zones.mullions.map((mu, i) => (
          <rect key={i} x={X(mu.axis - mu.vis / 2)} y={Y(dy + g.land)}
            width={mu.vis} height={fh - g.land - bottomLand}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
        ))}

        {/* ── LEAVES ── */}
        {geom.leaves.map((leaf, i) => {
          const passive = leaf.role === 'passive';
          const hinges = hingePositions(leaf.y, leaf.h);
          const hingeEdgeX = leaf.hinge === 'right' ? leaf.x + leaf.w : leaf.x;
          const closeEdgeX = leaf.hinge === 'right' ? leaf.x : leaf.x + leaf.w;
          const furnX = leaf.hinge === 'right'
            ? leaf.x + geom.stile / 2
            : leaf.x + leaf.w - geom.stile / 2;
          const handleY = leaf.y + leaf.h - HANDLE_FLOOR_MM;
          return (
            <g key={i}>
              {/* Leaf edge — passive drawn lighter */}
              <rect x={X(leaf.x)} y={Y(leaf.y)} width={leaf.w} height={leaf.h}
                fill="none" stroke={COLORS.sash}
                strokeWidth={passive ? STROKES.sashLight : STROKES.sash} {...NS} />
              {/* Members hairline (Piotr 09.08 — "mega delikatnie") */}
              <line x1={X(leaf.x + geom.stile)} y1={Y(leaf.y)}
                x2={X(leaf.x + geom.stile)} y2={Y(leaf.y + leaf.h)}
                stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
              <line x1={X(leaf.x + leaf.w - geom.stile)} y1={Y(leaf.y)}
                x2={X(leaf.x + leaf.w - geom.stile)} y2={Y(leaf.y + leaf.h)}
                stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
              {/* Glass (daylight) */}
              <rect x={X(leaf.glassX)} y={Y(leaf.glassY)} width={leaf.glassW} height={leaf.glassH}
                fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
                stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
              {/* Mid rail for 3/4 and half-glazed */}
              {leaf.midRailY != null && (
                <rect x={X(leaf.x + geom.stile)} y={Y(leaf.midRailY)}
                  width={leaf.w - 2 * geom.stile} height={geom.midFace}
                  fill={COLORS.bg} stroke={COLORS.sash}
                  strokeWidth={STROKES.glassLight} {...NS} />
              )}
              {/* Bars — vBars/hBars {left/top} objects (drawingUtils), copied
                  verbatim from v1; verticals stop at the mid rail when present */}
              {leaf.barPos.vBars.map((vb, k) => (
                <rect key={`vb${k}`} x={X(vb.left)} y={Y(leaf.glassY)}
                  width={BAR_WIDTH}
                  height={leaf.midRailY != null ? leaf.midRailY - leaf.glassY : leaf.glassH}
                  fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
              ))}
              {leaf.midRailY == null && leaf.barPos.hBars.map((hb, k) => (
                <rect key={`hb${k}`} x={X(leaf.glassX)} y={Y(hb.top)}
                  width={leaf.glassW} height={BAR_WIDTH}
                  fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
              ))}
              {/* Opening symbol — apex on the closing edge */}
              <path d={`M ${X(closeEdgeX)} ${Y(leaf.y + leaf.h / 2)}
                        L ${X(hingeEdgeX)} ${Y(leaf.y)}
                        M ${X(closeEdgeX)} ${Y(leaf.y + leaf.h / 2)}
                        L ${X(hingeEdgeX)} ${Y(leaf.y + leaf.h)}`}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
                strokeDasharray={`${sw(6)},${sw(4)}`} />
              {/* Hinges — red, ON the leaf edge */}
              {hinges.map((hy, k) => (
                <rect key={`hg${k}`} x={X(hingeEdgeX - HINGE_W / 2)}
                  y={Y(hy - HINGE_H / 2)} width={HINGE_W} height={HINGE_H} rx={HINGE_W / 2}
                  fill={COLORS.label} stroke={COLORS.label}
                  strokeWidth={STROKES.sashLight} {...NS} />
              ))}
              {/* Furniture: handle on active/single, bolts on passive */}
              {passive ? (
                <>
                  <rect x={X(furnX - 8)} y={Y(leaf.y + 40)} width={16} height={90}
                    fill="none" stroke={COLORS.sillDetail}
                    strokeWidth={STROKES.sashLight} {...NS} />
                  <rect x={X(furnX - 8)} y={Y(leaf.y + leaf.h - 130)} width={16} height={90}
                    fill="none" stroke={COLORS.sillDetail}
                    strokeWidth={STROKES.sashLight} {...NS} />
                  <Label x={X(furnX)} y={Y(leaf.y + 170)} text="BOLTS" vbw={totalW} />
                </>
              ) : (
                <>
                  <circle cx={X(furnX)} cy={Y(handleY)} r={geom.stile * 0.3}
                    fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
                  <DimV x={ox + fw + DM * 0.35} y1={Y(handleY)} y2={Y(totalH)}
                    extFrom={X(fw)} label={`handle ${HANDLE_FLOOR_MM}`} small vbw={totalW} />
                </>
              )}
            </g>
          );
        })}

        {/* French meeting note — sizing truth in one line */}
        {geom.isFrench && geom.leaves.length === 2 && (
          <Label x={X(geom.leaves[0].x + geom.leaves[0].w)} y={Y(dy + g.land) - sw(8)}
            text={`meeting ${geom.stile}+${geom.stile}−${geom.frenchOverlap}=${2 * geom.stile - geom.frenchOverlap} · rebated ${geom.frenchOverlap} · 3 clearance`}
            vbw={totalW} />
        )}

        {/* ── DIMENSIONS ── */}
        {geom.isFrench && geom.leaves.length === 2 && <>
          <DimH y={oy + totalH + DM * 0.3} x1={X(geom.leaves[0].x)} x2={X(geom.leaves[0].x + geom.leaves[0].w)}
            extFrom={Y(totalH)} label={`leaf ${fmt(geom.leaves[0].w)}`} small vbw={totalW} />
          <DimH y={oy + totalH + DM * 0.3} x1={X(geom.leaves[1].x)} x2={X(geom.leaves[1].x + geom.leaves[1].w)}
            extFrom={Y(totalH)} label={`leaf ${fmt(geom.leaves[1].w)}`} small vbw={totalW} />
        </>}
        {zones.leftPanel && (
          <DimH y={oy + totalH + DM * 0.3} x1={X(zones.leftPanel.x)} x2={X(zones.leftPanel.x + zones.leftPanel.w)}
            extFrom={Y(totalH)} label={`side ${fmt(zones.leftPanel.w)}`} small vbw={totalW} />
        )}
        {zones.rightPanel && (
          <DimH y={oy + totalH + DM * 0.3} x1={X(zones.rightPanel.x)} x2={X(zones.rightPanel.x + zones.rightPanel.w)}
            extFrom={Y(totalH)} label={`side ${fmt(zones.rightPanel.w)}`} small vbw={totalW} />
        )}
        <DimH y={oy + totalH + DM * 0.7} x1={X(0)} x2={X(fw)} extFrom={Y(totalH)}
          label={fmt(fw)} vbw={totalW} />
        {tz && (
          <DimV x={ox + fw + DM * 0.35} y1={Y(0)} y2={Y(dy)} extFrom={X(fw)}
            label={`fan ${fmt(tz.h)}`} small vbw={totalW} />
        )}
        <DimV x={ox + fw + DM * 0.8} y1={Y(dy)} y2={Y(totalH)} extFrom={X(fw)}
          label={fmt(fh)} small={!!tz} vbw={totalW} />
        {tz && (
          <DimV x={ox + fw + DM * 1.15} y1={Y(0)} y2={Y(totalH)} extFrom={X(fw)}
            label={fmt(totalH)} vbw={totalW} />
        )}

        <TitleBlock x={totalW / 2} y={oy + totalH + DM + TITLE_AREA * 0.5}
          title={titleText} subtitle={subtitleText} vbw={totalW} />
      </svg>
    </div>
  );
}
