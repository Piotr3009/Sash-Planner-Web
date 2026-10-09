/**
 * DoorElevation2D.jsx
 *
 * Exterior view of a door assembly, always drawn from OUTSIDE (Piotr 05.08),
 * in the casement drawing system: mm coordinates, dark theme, non-scaling
 * strokes, the Dim helpers of drawingUtils, the overall width at the TOP and
 * the heights on the RIGHT (Piotr 06.09). Every position comes from
 * derived.door (deriveDoorWindow, doors to production 08.10.2026): the leaves
 * with their daylights, mid rails, panels, bars, hinges and handle height, the
 * fixed side panel leaves, the opening fan leaves or the fixed fan panes, the
 * coupling posts and the transom band. The sheet computes no widths itself,
 * so it cannot disagree with the cut list, the leaf sheet or the 3D.
 *
 * ASSEMBLY (v4, Piotr 09.08): side panels are coupled OUTSIDE the door frame,
 * each with its own width; head and cill run across the whole assembly; ONE
 * coupling post (2 x the jamb face) stands between a panel and the door. From
 * outside only the band the leaves leave free is seen: the land on each side,
 * the full jamb face on the door side of an inward door (its rebate is on the
 * interior). The fanlight sits above the door zone; the band between the fan
 * and the door leaves is drawn as zones.transom.band.
 *
 * FRENCH: two leaves, no centre mullion; each leaf runs the lip past the
 * centre line on its meeting stile, so the leaves overlap by twice the lip.
 * The leaf lapping on the exterior (zones.meetingLap) is drawn in front and
 * the hidden meeting edge of the other one dashed. With one handle (lockType
 * single) the passive leaf carries bolts top and bottom; with two handles the
 * FGTE kit carries the shootbolts (a note).
 *
 * Members are read from the gap between the leaf outline and the glass, the
 * sash and casement way; glass sizes live on the leaf and glass sheets.
 */
import { useMemo } from 'react';
import { DimH, DimV, TitleBlock, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import {
  NS, num, fmt, safely, NoSheet, doorProfileParts, thresholdText,
  OpeningSymbol, BarBands, HingeBarrels, HandleSymbol,
} from './doorSheetParts.jsx';

const STYLE_NAMES = { 'half-glazed': 'Half glazed', 'three-quarter': 'Three quarter' };

function buildElevation(windowSpec, derived) {
  const dr = derived?.door;
  const z = dr?.zones;
  const m = dr?.members;
  if (!windowSpec || !dr || !z || !m) return null;
  const W = num(z.totalWidth);
  const H = num(z.totalHeight);
  if (!(W > 0 && H > 0)) return null;
  const pp = doorProfileParts();
  const inward = !!dr.inward;
  const tz = z.transom && num(z.transom.h, 0) > 0 ? z.transom : null;
  const zoneTop = tz ? num(tz.h, 0) : 0;
  const bottomVis = dr.hasTimberCill ? (inward ? pp.cillInward.faceExternal : pp.cillVisible) : 0;
  const frames = (z.frames || []).length ? z.frames : [{ x: 0, w: W, kind: 'door' }];

  // Openings of the frame as seen from outside, per frame (a coupling post
  // shows the land, or the jamb face on the door side of an inward door).
  const visOf = (f) => (f.kind === 'door' && inward ? m.frameJamb : m.land);
  const openings = [];
  frames.forEach((f) => {
    const v = visOf(f);
    if (tz) {
      openings.push({ x: f.x + m.land, y: m.land, w: f.w - 2 * m.land, h: tz.band.y - m.land, fan: true });
      const top = tz.band.y + tz.band.h + (v - m.land);
      openings.push({ x: f.x + v, y: top, w: f.w - 2 * v, h: H - bottomVis - top });
    } else {
      openings.push({ x: f.x + v, y: v, w: f.w - 2 * v, h: H - bottomVis - v });
    }
  });

  const leaves = dr.leaves || [];
  const french = !!dr.isFrench && leaves.length === 2;
  // The door frame opening across (what an inward door's jamb faces leave seen)
  const doorFrame = frames.find((f) => f.kind === 'door') || null;
  const doorVis = doorFrame ? visOf(doorFrame) : 0;
  const doorOpen = doorFrame
    ? { x0: doorFrame.x + doorVis, x1: doorFrame.x + doorFrame.w - doorVis }
    : { x0: 0, x1: W };
  const lap = z.meetingLap || null;
  const otherRole = (r) => (r === 'active' ? 'passive' : 'active');
  const frontRole = french && lap ? (lap.face === 'exterior' ? lap.leaf : otherRole(lap.leaf)) : null;
  const kit = dr.hardware?.kit || (french && dr.lockType === 'double' ? 'fgte' : 'thunderbolt');
  const hasHandle = (l) => l.role === 'single' || l.role === 'active' || (french && kit === 'fgte');
  const hasBolts = (l) => french && kit !== 'fgte' && l.role === 'passive';
  const handleLeaf = leaves.find(hasHandle) || null;

  return {
    dr, z, m, pp, W, H, inward, tz, zoneTop, bottomVis, frames, openings,
    leaves, french, frontRole, kit, hasHandle, hasBolts, handleLeaf, doorOpen,
    fanLeaves: dr.fanLeaves || [],
    fanPanes: tz?.fanPanes || [],
    panelLeaves: dr.panelLeaves || [],
  };
}

export default function DoorElevation2D({ windowSpec, derived, projectNumber , windowTag }) {
  const geom = useMemo(() => safely(() => buildElevation(windowSpec, derived)), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const { dr, z, m, pp, W, H, inward, tz, zoneTop, bottomVis, openings, leaves, french, frontRole } = geom;

  // ── Layout (mm = SVG units, the casement elevation convention) ──
  const layoutSc = Math.max(W, H) / 500;
  const ML = 60 * layoutSc;
  const MR = 120 * layoutSc;
  const MT = 70 * layoutSc;
  const svgW = ML + W + MR;
  const ts = svgW / VIEWBOX_REF;
  const ox = ML, oy = MT;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const dash = `${6 * ts},${4 * ts}`;
  const axisDash = `${8 * ts},${3 * ts},${2 * ts},${3 * ts}`;

  // ── Notes under the title: the threshold, the style, the meeting, the hardware ──
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const hingeSide = windowSpec?.door?.hingeSide || 'left';
  const hingeCount = (leaves[0]?.hinges || []).length;
  const handleY = num(geom.handleLeaf?.handleY);
  const hw = dr.hardware || {};
  const lockText = !french
    ? 'Lock: multipoint lock, ThunderBolt single door kit'
    : geom.kit === 'fgte'
      ? 'Lock: FGTE double door kit, a handle on each leaf, passive leaf shootbolts in the kit'
      : 'Lock: ThunderBolt kit on the active leaf, bolts top and bottom on the passive leaf';
  const notes = [
    `Threshold: ${thresholdText(dr, pp)}`,
    STYLE_NAMES[dr.style]
      ? `${STYLE_NAMES[dr.style]}: mid rail ${fmt(m.mid)}, axis ${fmt(z.midRailAxis)} below the leaf top, ${dr.paneling || 'flat'} panel below`
      : '',
    french
      ? `Meeting stile ${fmt(m.meeting)} on each leaf, lip ${fmt(dr.lip)} past the centre line, active leaf laps on the ${z.meetingLap?.face || 'exterior'}`
      : '',
    [
      hingeCount ? `${hingeCount} hinges per leaf` : '',
      handleY != null ? `handle ${fmt(H - handleY)} above the floor` : '',
      hw.handing || '',
    ].filter(Boolean).join(' · '),
    lockText,
  ].filter(Boolean);

  const bottomAnn = (geom.frames.length > 1 ? 76 : 50) * ts;
  const TITLE = (44 + 18 * notes.length) * ts;
  const svgH = MT + H + bottomAnn + TITLE;
  const titleY = oy + H + bottomAnn + 16 * ts;
  const noteFs = SIZES.code * ts;

  const titleText = `Front Elevation${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `${french ? 'French door' : 'Single door'} · ${fmt(W)} × ${fmt(H)} mm · ${inward ? 'inward' : 'outward'} · open ${hingeSide} · exterior view`;

  // ── One door leaf: outline (hidden edges dashed), glass, mid rail gap, panel, bars, symbol, furniture ──
  const renderDoorLeaf = (leaf, i) => {
    const back = french && frontRole && leaf.role !== frontRole;
    const meetEdgeX = leaf.meetingSide === 'L' ? leaf.x : leaf.meetingSide === 'R' ? leaf.x + leaf.w : null;
    // The bottom edge is never lapped (the cill or the threshold lies below
    // it), so it is seen in both directions, except where an inward door's
    // jamb faces cover its ends (the door frame opening, as drawn above).
    const bY = leaf.y + leaf.h;
    const bX0 = Math.max(leaf.x, geom.doorOpen.x0);
    const bX1 = Math.min(leaf.x + leaf.w, geom.doorOpen.x1);
    const edges = [
      { k: 't', x1: leaf.x, y1: leaf.y, x2: leaf.x + leaf.w, y2: leaf.y },
      { k: 'b', x1: bX0, y1: bY, x2: bX1, y2: bY, seen: true },
      bX0 > leaf.x ? { k: 'bl', x1: leaf.x, y1: bY, x2: bX0, y2: bY, lapped: true } : null,
      bX1 < leaf.x + leaf.w ? { k: 'br', x1: bX1, y1: bY, x2: leaf.x + leaf.w, y2: bY, lapped: true } : null,
      { k: 'l', x1: leaf.x, y1: leaf.y, x2: leaf.x, y2: leaf.y + leaf.h, meeting: leaf.meetingSide === 'L' },
      { k: 'r', x1: leaf.x + leaf.w, y1: leaf.y, x2: leaf.x + leaf.w, y2: leaf.y + leaf.h, meeting: leaf.meetingSide === 'R' },
    ].filter(Boolean);
    // Outward: only the meeting edge of the leaf behind is hidden. Inward:
    // the frame face laps over the head and jamb edges; a meeting edge is
    // seen unless it belongs to the leaf behind.
    const hidden = (e) => (e.seen ? false : e.lapped ? true : inward ? (!e.meeting || back) : (e.meeting && back));
    const lockEdgeX = leaf.hinge === 'left' ? leaf.x + leaf.w : leaf.x;
    const inDir = leaf.hinge === 'left' ? -1 : 1;
    const backset = leaf.role === 'passive' && geom.kit === 'fgte'
      ? num(dr.hardware?.fgte?.slaveBackset, pp.backset) : pp.backset;
    const day = leaf.daylight;
    const pd = leaf.panel?.daylight || null;
    const boltW = 3 * ts, boltL = 28 * ts;
    const meetFace = leaf.meetingSide === 'R' ? leaf.stileR : leaf.stileL;
    const boltX = meetEdgeX != null ? meetEdgeX + (leaf.meetingSide === 'R' ? -1 : 1) * meetFace / 2 : null;
    return (
      <g key={`lf${i}`}>
        {edges.map((e) => (
          <line key={e.k} x1={X(e.x1)} y1={Y(e.y1)} x2={X(e.x2)} y2={Y(e.y2)} stroke={COLORS.sash}
            strokeWidth={hidden(e) ? STROKES.sashLight : STROKES.sash} {...NS}
            strokeDasharray={hidden(e) ? dash : undefined} />
        ))}
        {day && day.w > 0 && day.h > 0 && (
          <rect x={X(day.x)} y={Y(day.y)} width={day.w} height={day.h}
            fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
            stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
        )}
        <BarBands day={day} bars={leaf.bars} X={X} Y={Y} />
        {pd && pd.w > 0 && pd.h > 0 && (
          <>
            <rect x={X(pd.x)} y={Y(pd.y)} width={pd.w} height={pd.h}
              fill={COLORS.frameFill} stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
            <Label x={X(pd.x + pd.w / 2)} y={Y(pd.y + pd.h / 2) + 5 * ts} text="PANEL" vbw={svgW} />
          </>
        )}
        <OpeningSymbol r={leaf} hinge={leaf.hinge} X={X} Y={Y} dash={dash} />
        <HingeBarrels edgeX={leaf.hingeEdgeX} ys={leaf.hinges} barrel={pp.barrel} w={2.4 * ts} X={X} Y={Y} />
        {geom.hasHandle(leaf) && num(leaf.handleY) != null && (
          <HandleSymbol cx={X(lockEdgeX + inDir * backset)} cy={Y(leaf.handleY)} r={5 * ts} lever={16 * ts}
            towards={leaf.hinge === 'left' ? 'left' : 'right'} />
        )}
        {geom.hasBolts(leaf) && boltX != null && (
          <g>
            <rect x={X(boltX) - boltW / 2} y={Y(leaf.y)} width={boltW} height={boltL}
              fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
            <rect x={X(boltX) - boltW / 2} y={Y(leaf.y + leaf.h) - boltL} width={boltW} height={boltL}
              fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
          </g>
        )}
      </g>
    );
  };

  const doorOrder = french && frontRole
    ? [...leaves.filter((l) => l.role !== frontRole), ...leaves.filter((l) => l.role === frontRole)]
    : leaves;
  const rightX = (k) => ox + W + (22 + 26 * k) * ts;
  const showHandleDim = handleY != null && handleY > 0 && handleY < H;
  const rightSlots = (showHandleDim ? 1 : 0) + (tz ? 1 : 0);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── FRAME: the whole assembly less its openings (as seen from outside) ── */}
        <path
          d={[`M ${X(0)} ${Y(0)} H ${X(W)} V ${Y(H)} H ${X(0)} Z`,
            ...openings.filter((o) => o.w > 0 && o.h > 0).map((o) => `M ${X(o.x)} ${Y(o.y)} H ${X(o.x + o.w)} V ${Y(o.y + o.h)} H ${X(o.x)} Z`)].join(' ')}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={W} height={H}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        {openings.filter((o) => o.w > 0 && o.h > 0).map((o, i) => (
          <rect key={`op${i}`} x={X(o.x)} y={Y(o.y)} width={o.w} height={o.h}
            fill={o.fan && geom.fanPanes.length ? COLORS.frameFill : 'none'}
            stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
        ))}

        {/* ── CILL (timber, one piece across the assembly) or the threshold product under the door ── */}
        {dr.hasTimberCill ? (
          <line x1={X(0)} y1={Y(H - bottomVis)} x2={X(W)} y2={Y(H - bottomVis)}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        ) : (
          <rect x={X(z.doorX)} y={Y(H - pp.gapCill)} width={z.doorW} height={pp.gapCill}
            fill={COLORS.frameFill} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        )}

        {/* ── FANLIGHT: fixed panes glazed into the frame, or opening top hung leaves ── */}
        {geom.fanPanes.map((fp, i) => {
          const day = { x: fp.x + m.inset, y: fp.y + m.inset, w: fp.w - 2 * m.inset, h: fp.h - 2 * m.inset };
          return (
            <g key={`fp${i}`}>
              <rect x={X(day.x)} y={Y(day.y)} width={day.w} height={day.h}
                fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
                stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
              <BarBands day={day} bars={fp.bars} X={X} Y={Y} />
            </g>
          );
        })}
        {geom.fanLeaves.map((fl, i) => (
          <g key={`fl${i}`}>
            <rect x={X(fl.x)} y={Y(fl.y)} width={fl.w} height={fl.h}
              fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            {fl.daylight && (
              <rect x={X(fl.daylight.x)} y={Y(fl.daylight.y)} width={fl.daylight.w} height={fl.daylight.h}
                fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
                stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
            )}
            <BarBands day={fl.daylight} bars={fl.bars} X={X} Y={Y} />
            <OpeningSymbol r={fl} hinge="top" X={X} Y={Y} dash={dash} />
          </g>
        ))}

        {/* ── FIXED SIDE PANEL LEAVES (bars from the side panel spec) ── */}
        {geom.panelLeaves.map((pn, i) => (
          <g key={`pn${i}`}>
            <rect x={X(pn.x)} y={Y(pn.y)} width={pn.w} height={pn.h}
              fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            {pn.daylight && (
              <rect x={X(pn.daylight.x)} y={Y(pn.daylight.y)} width={pn.daylight.w} height={pn.daylight.h}
                fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
                stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
            )}
            <BarBands day={pn.daylight} bars={pn.bars} X={X} Y={Y} />
          </g>
        ))}

        {/* ── DOOR LEAVES: the leaf behind first, the lapping leaf in front ── */}
        {doorOrder.map((leaf, i) => renderDoorLeaf(leaf, i))}

        {/* French centre line */}
        {french && num(z.meetingX) != null && (
          <line x1={X(z.meetingX)} y1={Y(leaves[0].y) - 10 * ts} x2={X(z.meetingX)} y2={Y(leaves[0].y + leaves[0].h) + 10 * ts}
            stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={axisDash} />
        )}

        {/* ── DIMENSIONS: width at the top, heights on the right, widths along the bottom ── */}
        <DimH y={oy - 30 * ts} x1={X(0)} x2={X(W)} extFrom={Y(0)} label={fmt(W)} vbw={svgW} />
        {leaves[0] && (
          <DimV x={ox - 24 * ts} y1={Y(leaves[0].y)} y2={Y(leaves[0].y + leaves[0].h)} extFrom={X(0)}
            label={`leaf ${fmt(leaves[0].h)}`} small vbw={svgW} />
        )}
        {showHandleDim && (
          <DimV x={rightX(0)} y1={Y(handleY)} y2={Y(H)} extFrom={X(W)}
            label={`handle ${fmt(H - handleY)}`} small vbw={svgW} />
        )}
        {tz && (
          <>
            <DimV x={rightX(showHandleDim ? 1 : 0)} y1={Y(0)} y2={Y(zoneTop)} extFrom={X(W)}
              label={`fan ${fmt(zoneTop)}`} small vbw={svgW} />
            <DimV x={rightX(showHandleDim ? 1 : 0)} y1={Y(zoneTop)} y2={Y(H)} extFrom={X(W)}
              label={fmt(H - zoneTop)} small vbw={svgW} />
          </>
        )}
        <DimV x={rightX(rightSlots)} y1={Y(0)} y2={Y(H)} extFrom={X(W)} label={fmt(H)} vbw={svgW} />

        {[...geom.panelLeaves, ...leaves].map((lf, i) => (
          <DimH key={`lw${i}`} y={oy + H + 24 * ts} x1={X(lf.x)} x2={X(lf.x + lf.w)} extFrom={Y(H)}
            label={fmt(lf.w)} small vbw={svgW} />
        ))}
        {geom.frames.length > 1 && geom.frames.map((f, i) => (
          <DimH key={`fw${i}`} y={oy + H + 50 * ts} x1={X(f.x)} x2={X(f.x + f.w)} extFrom={Y(H)}
            label={`${f.kind === 'door' ? 'door' : `${f.side} panel`} ${fmt(f.w)}`} small vbw={svgW} />
        ))}

        {/* ── TITLE + notes ── */}
        <TitleBlock x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={noteFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
