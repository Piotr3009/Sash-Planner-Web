/**
 * DoorElevation2D.jsx
 *
 * Exterior view of a door assembly — always drawn from OUTSIDE (Piotr 05.08),
 * same system as CasementElevation2D: mm coordinates, dark theme, non-scaling
 * strokes, Dim helpers from drawingUtils. ALL geometry comes from
 * derived.door.zones (engine single source) — this sheet computes no widths
 * itself, so it can never disagree with the cut list or the Leaf sheet.
 *
 * ASSEMBLY (v3, Piotr 09.08): side panels are coupled OUTSIDE the door frame,
 * each with its own width, so the drawing spans leftPanel + door + rightPanel.
 * Head and cill are single pieces across the whole assembly; between a panel
 * and the door stand two 57 jambs back to back (joint line drawn).
 *
 * Leaf members ARE drawn, hairline-light (Piotr 09.08 — reverses the earlier
 * "never draw members" rule: "narysuj, ale mega delikatnie"). Glass sizes are
 * deliberately NOT dimensioned here — the glass schedule owns them. Handle
 * sits 1000mm off the floor, constant, matching DoorPanel.jsx:929.
 *
 * FRENCH: two leaves, NO centre mullion ever — the meeting stiles are rebated
 * 6mm with a 3mm clearance (94 + 94 − 6 = 182 meeting band). The passive leaf
 * carries bolts top + bottom.
 */
import { useMemo } from 'react';
import { getDoorProfile } from '../../engine/profile.js';
import { computeBarPositions, DimH, DimV, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;
const HANDLE_FLOOR_MM = 1000;   // constant, matches the 3D door panel
// Hinge barrel as modelled in 3D (DoorWindow.jsx) — 10mm wide, 102mm tall.
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
 * (Piotr 05.08 + 09.08 — "3 do 2100, 4 powyżej").
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
    const doorW = Number(windowSpec.frame?.width ?? 0);
    const doorH = Number(windowSpec.frame?.height ?? 0);
    if (!doorW || !doorH) return null;

    const p = getDoorProfile();
    const g = p.geometry;
    const els = p.elements;
    const d = windowSpec.door || {};
    const z = dr.zones;

    const totalW = Number(z.totalWidth) || doorW;
    const totalH = Number(z.totalHeight) || doorH;
    const dy = totalH - doorH;              // transom zone above the door zone
    const inward = !!dr.inward;

    const stile = els.leafStile.face;
    const topRail = els.leafTop.face;
    const bottomRail = els.leafBottom.face;
    const midFace = els.leafMid.face;
    const style = d.style || 'full-glass';
    const spMember = dr.sidePanelMember || 57;
    const inset = g.glassInset;
    const leafY = dy + g.land + g.gap;

    const bars = d.bars || {};
    const mkLeaf = (leaf, member, vCount, hCount) => {
      const glassX = leaf.x + member;
      const glassY = leafY + (member === stile ? topRail : member);
      const glassW = Math.max(0, leaf.w - 2 * member);
      const glassH = Math.max(0, leaf.h - (member === stile ? topRail + bottomRail : 2 * member));
      let midRailY = null;
      if (member === stile && style === 'three-quarter') midRailY = leafY + leaf.h * 0.75 - midFace / 2;
      if (member === stile && style === 'half-glazed') midRailY = leafY + leaf.h * 0.5 - midFace / 2;
      return {
        ...leaf, y: leafY, member, glassX, glassY, glassW, glassH, midRailY,
        barPos: computeBarPositions({
          glassX, glassY, glassW, glassH,
          vCount: Number(vCount) || 0, hCount: Number(hCount) || 0, barW: BAR_WIDTH,
        }),
      };
    };

    return {
      doorW, doorH, totalW, totalH, dy, g, els, inward,
      stile, topRail, bottomRail, midFace, style, spMember, inset, leafY,
      zones: z,
      leaves: (dr.leaves || []).map((l) => mkLeaf(l, stile, bars.v, bars.h)),
      panelLeaves: (dr.panelLeaves || []).map((l) => mkLeaf(l, spMember, d.sideBars?.v, d.sideBars?.h)),
      isFrench: (dr.type || '') === 'french',
      frenchOverlap: Number(dr.overlap) || 0,
      hinge: d.hingeSide || 'left',
      hasTimberCill: !!dr.hasTimberCill,
      threshold: dr.threshold || 'standard',
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { doorW, doorH, totalW, totalH, dy, g, zones } = geom;

  const layoutSc = Math.max(totalW, totalH) / 500;
  const DM = 75 * layoutSc;
  const M = 85 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const svgW = M + totalW + DM * 2 + M;
  const svgH = M + totalH + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const bottomLand = geom.hasTimberCill ? g.cillVisible : 0;
  const tz = zones.transom;
  // Rail bottom edge flush with the door opening top (3D convention).
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
  const panelNote = geom.panelLeaves.length
    ? ` + ${geom.panelLeaves.map((pn) => `${pn.side} panel`).join(' + ')}`
    : '';
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `Door ${windowSpec.door?.type || 'single-external'} · door frame ${doorW} × ${doorH}${panelNote} · assembly ${totalW} × ${totalH} mm · ${swingLabel} · ${thresholdLabel} · exterior view`;

  const renderLeaf = (leaf, i, passive, showFurniture) => {
    const hinges = showFurniture ? hingePositions(leaf.y, leaf.h) : [];
    const hingeEdgeX = leaf.hinge === 'right' ? leaf.x + leaf.w : leaf.x;
    const closeEdgeX = leaf.hinge === 'right' ? leaf.x : leaf.x + leaf.w;
    const furnX = leaf.hinge === 'right'
      ? leaf.x + geom.stile / 2
      : leaf.x + leaf.w - geom.stile / 2;
    const handleY = leaf.y + leaf.h - HANDLE_FLOOR_MM;
    return (
      <g key={i}>
        <rect x={X(leaf.x)} y={Y(leaf.y)} width={leaf.w} height={leaf.h}
          fill="none" stroke={COLORS.sash}
          strokeWidth={passive || !showFurniture ? STROKES.sashLight : STROKES.sash} {...NS} />
        {/* Members hairline (Piotr 09.08 — "mega delikatnie") */}
        <line x1={X(leaf.x + leaf.member)} y1={Y(leaf.y)}
          x2={X(leaf.x + leaf.member)} y2={Y(leaf.y + leaf.h)}
          stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
        <line x1={X(leaf.x + leaf.w - leaf.member)} y1={Y(leaf.y)}
          x2={X(leaf.x + leaf.w - leaf.member)} y2={Y(leaf.y + leaf.h)}
          stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
        <rect x={X(leaf.glassX)} y={Y(leaf.glassY)} width={leaf.glassW} height={leaf.glassH}
          fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {leaf.midRailY != null && (
          <rect x={X(leaf.x + leaf.member)} y={Y(leaf.midRailY)}
            width={leaf.w - 2 * leaf.member} height={geom.midFace}
            fill={COLORS.bg} stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
        )}
        {leaf.barPos.vBars.map((vb, k) => (
          <rect key={`vb${k}`} x={X(vb.left)} y={Y(leaf.glassY)} width={BAR_WIDTH}
            height={leaf.midRailY != null ? leaf.midRailY - leaf.glassY : leaf.glassH}
            fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {leaf.midRailY == null && leaf.barPos.hBars.map((hb, k) => (
          <rect key={`hb${k}`} x={X(leaf.glassX)} y={Y(hb.top)}
            width={leaf.glassW} height={BAR_WIDTH}
            fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {showFurniture && <>
          <path d={`M ${X(closeEdgeX)} ${Y(leaf.y + leaf.h / 2)}
                    L ${X(hingeEdgeX)} ${Y(leaf.y)}
                    M ${X(closeEdgeX)} ${Y(leaf.y + leaf.h / 2)}
                    L ${X(hingeEdgeX)} ${Y(leaf.y + leaf.h)}`}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
            strokeDasharray={`${sw(6)},${sw(4)}`} />
          {hinges.map((hy, k) => (
            <rect key={`hg${k}`} x={X(hingeEdgeX - HINGE_W / 2)} y={Y(hy - HINGE_H / 2)}
              width={HINGE_W} height={HINGE_H} rx={HINGE_W / 2}
              fill={COLORS.label} stroke={COLORS.label}
              strokeWidth={STROKES.sashLight} {...NS} />
          ))}
          {passive ? (
            <>
              <rect x={X(furnX - 8)} y={Y(leaf.y + 40)} width={16} height={90}
                fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sashLight} {...NS} />
              <rect x={X(furnX - 8)} y={Y(leaf.y + leaf.h - 130)} width={16} height={90}
                fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sashLight} {...NS} />
              <Label x={X(furnX)} y={Y(leaf.y + 170)} text="BOLTS" vbw={svgW} />
            </>
          ) : (
            <>
              <circle cx={X(furnX)} cy={Y(handleY)} r={geom.stile * 0.3}
                fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              <DimV x={ox + totalW + DM * 0.35} y1={Y(handleY)} y2={Y(totalH)}
                extFrom={X(totalW)} label={`handle ${HANDLE_FLOOR_MM}`} small vbw={svgW} />
            </>
          )}
        </>}
      </g>
    );
  };

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="max-h-[72vh] w-auto max-w-full" style={{ background: COLORS.bg }}>

        {/* ── FRAME body: outer band of the whole assembly ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(totalW)} V ${Y(totalH)} H ${X(0)} Z
              M ${X(g.land)} ${Y(g.land)} H ${X(totalW - g.land)}
              V ${Y(totalH - bottomLand)} H ${X(g.land)} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={totalW} height={totalH}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={X(g.land)} y={Y(g.land)} width={totalW - 2 * g.land}
          height={totalH - g.land - bottomLand}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* ── COUPLING: two 57 jambs back to back, joint line on the boundary ── */}
        {(zones.joints || []).map((jx, i) => (
          <g key={`j${i}`}>
            <rect x={X(jx - geom.els.frameHead.face)} y={Y(g.land)}
              width={geom.els.frameHead.face * 2} height={totalH - g.land - bottomLand}
              fill={COLORS.frameFill} stroke={COLORS.frame}
              strokeWidth={STROKES.frameLight} {...NS} />
            <line x1={X(jx)} y1={Y(g.land)} x2={X(jx)} y2={Y(totalH - bottomLand)}
              stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
          </g>
        ))}

        {/* ── TRANSOM: one rail across the assembly, one fan pane per frame ── */}
        {tz && <>
          {(tz.fanPanes || []).map((fp, i) => (
            <rect key={`fp${i}`} x={X(fp.x)} y={Y(geom.els.frameHead.face - geom.inset)}
              width={fp.w} height={fp.h}
              fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
              stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
          ))}
          <rect x={X(g.land)} y={Y(railTopY)}
            width={totalW - 2 * g.land} height={railBottomY - railTopY}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
          <Label x={X(totalW / 2)} y={Y((railTopY + railBottomY) / 2) + sw(3)}
            text={`TRANSOM ${tz.railH}${tz.type === 'opening' ? ' · opening fan' : ''}`} vbw={svgW} />
        </>}

        {/* Inward-opening: the frame laps OVER the leaf — show the lap edge. */}
        {geom.inward && (
          <rect x={X(g.land)} y={Y(dy + g.land)}
            width={totalW - 2 * g.land} height={doorH - g.land - bottomLand}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
            strokeDasharray={`${sw(5)},${sw(3)}`} />
        )}

        {/* ── CILL — one piece across the assembly ── */}
        {geom.hasTimberCill && (
          <line x1={X(0)} y1={Y(totalH - g.cillVisible)} x2={X(totalW)} y2={Y(totalH - g.cillVisible)}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        )}

        {/* ── LEAVES: fixed panels first, then the door ── */}
        {geom.panelLeaves.map((pn, i) => renderLeaf(pn, `p${i}`, false, false))}
        {geom.leaves.map((leaf, i) => renderLeaf(leaf, i, leaf.role === 'passive', true))}

        {/* French meeting note — sizing truth in one line */}
        {geom.isFrench && geom.leaves.length === 2 && (
          <Label x={X(geom.leaves[0].x + geom.leaves[0].w)} y={Y(dy + g.land) - sw(8)}
            text={`meeting ${geom.stile}+${geom.stile}−${geom.frenchOverlap}=${2 * geom.stile - geom.frenchOverlap} · rebated ${geom.frenchOverlap} · 3 clearance`}
            vbw={svgW} />
        )}

        {/* ── DIMENSIONS ── */}
        {geom.panelLeaves.map((pn, i) => (
          <DimH key={`pd${i}`} y={oy + totalH + DM * 0.3} x1={X(pn.x)} x2={X(pn.x + pn.w)}
            extFrom={Y(totalH)} label={`panel leaf ${fmt(pn.w)}`} small vbw={svgW} />
        ))}
        {geom.leaves.map((leaf, i) => (
          <DimH key={`ld${i}`} y={oy + totalH + DM * 0.3} x1={X(leaf.x)} x2={X(leaf.x + leaf.w)}
            extFrom={Y(totalH)} label={`leaf ${fmt(leaf.w)}`} small vbw={svgW} />
        ))}
        {(zones.frames || []).length > 1 && (zones.frames || []).map((f, i) => (
          <DimH key={`fd${i}`} y={oy + totalH + DM * 0.65} x1={X(f.x)} x2={X(f.x + f.w)}
            extFrom={Y(totalH)} label={`${f.kind === 'door' ? 'door' : `${f.side} panel`} ${fmt(f.w)}`}
            small vbw={svgW} />
        ))}
        <DimH y={oy + totalH + DM} x1={X(0)} x2={X(totalW)} extFrom={Y(totalH)}
          label={fmt(totalW)} vbw={svgW} />
        {tz && (
          <DimV x={ox + totalW + DM * 0.8} y1={Y(0)} y2={Y(dy)} extFrom={X(totalW)}
            label={`fan ${fmt(tz.h)}`} small vbw={svgW} />
        )}
        <DimV x={ox + totalW + DM * 0.8} y1={Y(dy)} y2={Y(totalH)} extFrom={X(totalW)}
          label={fmt(doorH)} small={!!tz} vbw={svgW} />
        {tz && (
          <DimV x={ox + totalW + DM * 1.15} y1={Y(0)} y2={Y(totalH)} extFrom={X(totalW)}
            label={fmt(totalH)} vbw={svgW} />
        )}

        <TitleBlock x={svgW / 2} y={oy + totalH + DM + TITLE_AREA * 0.5}
          title={titleText} subtitle={subtitleText} vbw={svgW} />
      </svg>
    </div>
  );
}
