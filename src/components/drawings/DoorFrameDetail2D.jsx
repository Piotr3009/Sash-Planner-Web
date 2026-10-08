/**
 * DoorFrameDetail2D.jsx
 *
 * The door FRAME as one timber assembly: head, jambs, cill or threshold, the
 * coupling posts of the side panels and the fanlight transom, because a side
 * panel sits in the SAME frame and is cut from the same stock (Piotr 05.08).
 * Exterior view, mm coordinates, the casement drawing system (overall width at
 * the TOP, heights on the RIGHT, member chains along the bottom and on the
 * left, Piotr 06.09).
 *
 * Carries what the elevation does not: member faces and sections, cut lengths
 * and the D-* codes of the cut list (derived.components.box), the layer chain
 * from the frame edge to the leaf (land, gap), the rebate, the frame depth and
 * the cill. Every number comes from derived.door (members, zones, leaves) or
 * the door profile (cill visible, inward cill faces). The land line is the
 * rebate step seen from outside; the dashed line one rebate further in is the
 * member's inner edge (68 face). On an inward door the rebate is on the
 * interior: the door frame shows its full face and the land line is dashed.
 * The coupling post is ONE member (2 x the jamb face) with two rebates. The
 * leaves are dashed ghosts so the joiner sees where they land.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, num, fmt, safely, NoSheet, doorProfileParts, doorRecords, recordText, thresholdText } from './doorSheetParts.jsx';

function buildFrame(windowSpec, derived) {
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
  const frames = (z.frames || []).length ? z.frames : [{ x: 0, w: W, kind: 'door' }];
  // the cill member face (68 outward, 40 inward) and the part of it seen from outside
  const bottomFace = dr.hasTimberCill ? num(m.frameCill, 0) : 0;
  const bottomVis = dr.hasTimberCill ? (inward ? pp.cillInward.faceExternal : pp.cillVisible) : 0;
  // The land rect (the rebate step) and the face rect (the member's inner
  // edge) of each frame opening. With a fanlight the openings split at the
  // transom band, as the elevation draws them: the fan zone is rebated on the
  // exterior in every frame (the fan leaf or pane), the door zone starts at
  // the band and an inward door shows its frame face there too (the rail laps
  // the leaf top like the head, by the jamb face less the land).
  const zone = (f, inwardDoor, yLand, yFace, landBottom, faceBottom) => ({
    f, inwardDoor,
    land: { x: f.x + m.land, y: yLand, w: f.w - 2 * m.land, h: landBottom - yLand },
    face: { x: f.x + m.frameJamb, y: yFace, w: f.w - 2 * m.frameJamb, h: faceBottom - yFace },
  });
  const rects = [];
  frames.forEach((f) => {
    const inwardDoor = inward && f.kind === 'door';
    if (tz?.band) {
      const bandBottom = tz.band.y + tz.band.h;
      rects.push(zone(f, false, m.land, m.frameHead, tz.band.y, tz.band.y));
      rects.push(zone(f, inwardDoor, bandBottom, bandBottom + (m.frameJamb - m.land), H - bottomVis, H - bottomFace));
    } else {
      rects.push(zone(f, inwardDoor, m.land, m.frameHead, H - bottomVis, H - bottomFace));
    }
  });
  const recs = doorRecords(derived);
  const by = (c) => recs.find((r) => r.code === c) || null;
  const leaves = [...(dr.leaves || [])].sort((a, b) => a.x - b.x);
  return {
    dr, z, m, pp, W, H, inward, tz, frames, rects, bottomFace, bottomVis, leaves,
    head: by('D-H'), jambL: by('D-J/L'), jambR: by('D-J/R'), cill: by('D-CILL'), post: by('D-JC'), transom: by('D-T'),
  };
}

export default function DoorFrameDetail2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => safely(() => buildFrame(windowSpec, derived)), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const { dr, z, m, pp, W, H, inward, tz, rects, bottomFace, bottomVis, leaves } = geom;

  // ── Layout ──
  const layoutSc = Math.max(W, H) / 500;
  const ML = 104 * layoutSc;
  const MR = 90 * layoutSc;
  const MT = 70 * layoutSc;
  const svgW = ML + W + MR;
  const ts = svgW / VIEWBOX_REF;
  const ox = ML, oy = MT;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const dash = `${5 * ts},${3 * ts}`;
  const ghostDash = `${8 * ts},${5 * ts}`;
  const axisDash = `${8 * ts},${3 * ts},${2 * ts},${3 * ts}`;
  const codeFs = SIZES.code * ts;

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const codes = [
    geom.head && `${geom.head.code} ${fmt(geom.head.length)}`,
    geom.jambL && `D-J ×2 ${fmt(geom.jambL.length)}`,
    geom.cill ? `${geom.cill.code} ${fmt(geom.cill.length)}` : `${dr.threshold} threshold`,
    geom.post && `${geom.post.code}${num(geom.post.quantity, 1) > 1 ? ` ×${geom.post.quantity}` : ''} ${fmt(geom.post.length)}`,
    geom.transom && `${geom.transom.code} ${fmt(geom.transom.length)}`,
  ].filter(Boolean).join(' · ');
  const notes = [
    `Section: frame ${fmt(m.frameJamb)}×${fmt(dr.frameDepth)}, land ${fmt(m.land)} + rebate ${fmt(m.rebate)}; leaf ${fmt(dr.leafDepth)} deep in the rebate, gap ${fmt(m.gap)}`,
    inward ? `Inward: rebate on the interior; from outside the frame face ${fmt(m.frameJamb)} laps ${fmt(m.frameJamb - m.land - m.gap)} over the leaf` : '',
    `Threshold: ${thresholdText(dr, pp)}`,
    tz ? `Transom rail ${fmt(tz.railH)}: band ${fmt(tz.band?.h)} seen between fanlight and door leaves (rail lap: drawing check)` : '',
  ].filter(Boolean);

  // ── Bottom annotation rows and the title ──
  const rowY = (k) => oy + H + (24 + 26 * k) * ts;
  const nRows = 2 + (geom.frames.length > 1 ? 1 : 0);
  const bottomAnn = (24 + 26 * nRows) * ts;
  const TITLE = (44 + 18 * notes.length) * ts;
  const svgH = MT + H + bottomAnn + TITLE;
  const titleY = oy + H + bottomAnn + 16 * ts;

  // Layer chain at the door: frame edge · land · gap · leaves · gap · land · frame edge
  const doorX = num(z.doorX, 0);
  const doorR = doorX + num(z.doorW, W);
  const lL = leaves[0];
  const lR = leaves[leaves.length - 1];
  // (the right gap and land share one segment so the short gap label never lands on the land label)
  const layerCuts = lL && lR
    ? [doorX, doorX + m.land, lL.x, lR.x + lR.w, doorR]
    : [doorX, doorX + m.land, doorR - m.land, doorR];
  const layerLabels = lL && lR
    ? [fmt(m.land), fmt(lL.x - doorX - m.land), `${leaves.length > 1 ? 'leaves' : 'leaf'} ${fmt(lR.x + lR.w - lL.x)}`,
      `${fmt(doorR - m.land - (lR.x + lR.w))} + ${fmt(m.land)}`]
    : undefined;
  // Member chain along the bottom: jamb face · (coupling posts) · jamb face
  const memberCuts = [0, m.frameJamb];
  (z.posts || []).forEach((p) => memberCuts.push(p.x, p.x + p.w));
  memberCuts.push(W - m.frameJamb, W);
  // Vertical member chain on the left: land · rebate · (transom band) · cill
  const vCuts = [0, m.land, m.frameHead];
  if (tz?.band) vCuts.push(tz.band.y, tz.band.y + tz.band.h);
  if (dr.hasTimberCill) {
    if (!inward && bottomFace > bottomVis) vCuts.push(H - bottomFace);
    vCuts.push(H - bottomVis);
  }
  vCuts.push(H);
  const vLabels = vCuts.slice(0, -1).map((c, i) => fmt(vCuts[i + 1] - c));

  const rightX = (k) => ox + W + (22 + 26 * k) * ts;
  const visRect = (r) => (r.inwardDoor ? r.face : r.land);
  const hidRect = (r) => (r.inwardDoor ? r.land : r.face);
  const ok = (r) => r.w > 0 && r.h > 0;
  const midDoorY = num(lL?.y, 0) + num(lL?.h, H) / 2;

  const cillLabel = dr.hasTimberCill
    ? [recordText(geom.cill), inward
      ? `${fmt(pp.cillInward.faceInternal)} → ${fmt(pp.cillInward.faceExternal)} fall, unrebated`
      : `${fmt(bottomVis)} visible`].filter(Boolean).join(' · ')
    : `${String(dr.threshold || '').toUpperCase().replace('-', ' ')} THRESHOLD · no timber member`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── FRAME body: the assembly less the openings seen from outside ── */}
        <path
          d={[`M ${X(0)} ${Y(0)} H ${X(W)} V ${Y(H)} H ${X(0)} Z`,
            ...rects.map(visRect).filter(ok).map((o) => `M ${X(o.x)} ${Y(o.y)} H ${X(o.x + o.w)} V ${Y(o.y + o.h)} H ${X(o.x)} Z`)].join(' ')}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={W} height={H}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        {rects.map((r, i) => (
          <g key={`fr${i}`}>
            {ok(visRect(r)) && (
              <rect x={X(visRect(r).x)} y={Y(visRect(r).y)} width={visRect(r).w} height={visRect(r).h}
                fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            )}
            {ok(hidRect(r)) && (
              <rect x={X(hidRect(r).x)} y={Y(hidRect(r).y)} width={hidRect(r).w} height={hidRect(r).h}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash} />
            )}
          </g>
        ))}

        {/* ── COUPLING POSTS: ONE member, two rebates; the axis ── */}
        {(z.posts || []).map((p, i) => (
          <g key={`po${i}`}>
            <line x1={X(p.axis)} y1={Y(0) - 10 * ts} x2={X(p.axis)} y2={Y(H) + 10 * ts}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={axisDash} />
            <text x={X(p.axis) + codeFs * 0.35} y={Y(midDoorY)} fill={COLORS.label} fontSize={codeFs}
              fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
              transform={`rotate(-90, ${X(p.axis) + codeFs * 0.35}, ${Y(midDoorY)})`}>
              {geom.post ? `${geom.post.code} ${fmt(geom.post.length)} · ${fmt(p.w)}×${fmt(dr.frameDepth)}` : `D-JC ${fmt(p.w)}`}
            </text>
          </g>
        ))}

        {/* ── TRANSOM: the visible band between the fanlight and the door leaves ── */}
        {tz?.band && (
          <g>
            <rect x={X(m.land)} y={Y(tz.band.y)} width={W - 2 * m.land} height={tz.band.h}
              fill={COLORS.bg} stroke="none" />
            <rect x={X(m.land)} y={Y(tz.band.y)} width={W - 2 * m.land} height={tz.band.h}
              fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            <text x={X(W / 2)} y={Y(tz.band.y + tz.band.h / 2) + codeFs * 0.35} fill={COLORS.label} fontSize={codeFs}
              fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
              {`${geom.transom ? recordText(geom.transom) : `D-T ${fmt(tz.railH)}`} · band ${fmt(tz.band.h)}`}
            </text>
          </g>
        )}

        {/* ── CILL (one piece across the assembly) or the threshold product ── */}
        {dr.hasTimberCill ? (
          <rect x={X(0)} y={Y(H - bottomVis)} width={W} height={bottomVis}
            fill={COLORS.frameFill} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        ) : (
          <line x1={X(num(z.doorX, 0))} y1={Y(H)} x2={X(num(z.doorX, 0) + num(z.doorW, W))} y2={Y(H)}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.boardIndicator} {...NS} />
        )}

        {/* ── LEAF ghosts straight from the engine: door, side panel and fan leaves, fixed fan units ── */}
        {[...leaves, ...(dr.panelLeaves || []), ...(dr.fanLeaves || []), ...(tz?.fanPanes || [])].map((lf, i) => (
          <rect key={`g${i}`} x={X(lf.x)} y={Y(lf.y)} width={lf.w} height={lf.h}
            fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={ghostDash} />
        ))}
        {lL && (
          <Label x={X((doorX + doorR) / 2)} y={Y(midDoorY)} text={leaves.length === 2 ? 'LEAVES ×2 (ref)' : 'LEAF (ref)'} vbw={svgW} />
        )}

        {/* ── MEMBER CODES on the frame: head, jambs, cill ── */}
        <text x={X(W / 2)} y={Y(m.frameHead) + codeFs * 1.2} fill={COLORS.label} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
          {geom.head ? recordText(geom.head) : `D-H ${fmt(W)}`}
        </text>
        {[[geom.jambL, m.frameJamb + codeFs * 0.9], [geom.jambR, W - m.frameJamb - codeFs * 0.4]].map(([rec, x], i) => (
          <text key={`jl${i}`} x={X(x)} y={Y(midDoorY)} fill={COLORS.label} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
            transform={`rotate(-90, ${X(x)}, ${Y(midDoorY)})`}>
            {rec ? recordText(rec) : ''}
          </text>
        ))}
        <text x={X(W / 2)} y={Y(H - Math.max(bottomFace, bottomVis)) - codeFs * 0.5} fill={COLORS.label} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
          {cillLabel}
        </text>

        {/* ── DIMENSIONS ── width at the TOP, heights on the RIGHT, chains bottom / left */}
        <DimH y={oy - 30 * ts} x1={X(0)} x2={X(W)} extFrom={Y(0)} label={fmt(W)} vbw={svgW} />
        {tz && (
          <>
            <DimV x={rightX(0)} y1={Y(0)} y2={Y(tz.h)} extFrom={X(W)} label={`fan ${fmt(tz.h)}`} small vbw={svgW} />
            <DimV x={rightX(0)} y1={Y(tz.h)} y2={Y(H)} extFrom={X(W)} label={fmt(H - tz.h)} small vbw={svgW} />
          </>
        )}
        <DimV x={rightX(tz ? 1 : 0)} y1={Y(0)} y2={Y(H)} extFrom={X(W)} label={fmt(H)} vbw={svgW} />

        <DimChainV x={ox - 24 * ts} cuts={vCuts.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} labels={vLabels} fmt={fmt} />
        <DimV x={ox - 84 * ts} y1={Y(0)} y2={Y(m.frameHead)} extFrom={ox - 4 * ts}
          label={`head ${fmt(m.frameHead)}`} small vbw={svgW} />
        {dr.hasTimberCill && bottomFace > 0 && (
          <DimV x={ox - 84 * ts} y1={Y(H - bottomFace)} y2={Y(H)} extFrom={ox - 4 * ts}
            label={`cill ${fmt(bottomFace)}`} small vbw={svgW} />
        )}

        <DimChainH y={rowY(0)} cuts={layerCuts.map(X)} extFrom={oy + H + 4 * ts} vbw={svgW} labels={layerLabels} fmt={fmt} />
        <DimChainH y={rowY(1)} cuts={memberCuts.map(X)} extFrom={oy + H + 4 * ts} vbw={svgW} fmt={fmt} />
        {geom.frames.length > 1 && geom.frames.map((f, i) => (
          <DimH key={`fw${i}`} y={rowY(2)} x1={X(f.x)} x2={X(f.x + f.w)} extFrom={Y(H)}
            label={`${f.kind === 'door' ? 'door' : `${f.side} panel`} ${fmt(f.w)}`} small vbw={svgW} />
        ))}

        {/* ── TITLE + notes ── */}
        <TitleBlock x={svgW / 2} y={titleY} title={`Frame Detail${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={codes} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
      </svg>
    </div>
  );
}
