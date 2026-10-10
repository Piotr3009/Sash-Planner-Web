/**
 * DoorFrameDetail2D.jsx
 *
 * The door FRAME as one timber assembly (doors v3, Piotr 09.10.2026: the
 * casement rules inside the door frame): head, jambs, the cill or the
 * threshold, the casement MULLIONS between the door and its side panels (full
 * height, through the transom) and the casement TRANSOM of the fanlight, cut
 * in segments between the jambs and the mullions. Exterior view, mm
 * coordinates, the casement drawing system (overall width at the TOP, heights
 * on the RIGHT, member chains along the bottom and on the left, Piotr 06.09).
 *
 * Carries what the elevation does not: member faces and sections, cut lengths
 * and the D-* codes of the cut list (derived.components.box, printed without
 * the D- prefix), the layer chain from the frame edge to the leaves (land,
 * gap; at a mullion gap + land + gap), the rebate, the frame depth and the
 * cill. Every number comes from derived.door: the visible frame openings
 * (zones.openings, the casement lands: 47 at a jamb and the head, 13 each side
 * of a mullion axis, 8 above and 13 below the transom axis), the mullions
 * (axis, land band, cut length), the transom (axis T from the frame top,
 * segments with their bands and cut lengths), the leaves, the threshold
 * (thresholdInfo) and the door profile (cill visible, inward cill faces, the
 * transom seat). The dashed lines are the hidden member edges: one rebate in
 * from the land seen from outside; on an inward door field the rebate faces
 * the room, so the member face is seen and the land line is dashed. The
 * leaves are dashed ghosts so the joiner sees where they land.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, TitleBlock, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { displayCode } from '../../engine/partSymbols.js';
import { NS, num, fmt, safely, NoSheet, doorProfileParts, doorRecords, recordText, thresholdText, sectionText } from './doorSheetParts.jsx';

const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;

function buildFrame(windowSpec, derived) {
  const dr = derived?.door;
  const z = dr?.zones;
  const m = dr?.members;
  if (!windowSpec || !dr || !z || !m) return null;
  const W = num(z.totalWidth);
  const H = num(z.totalHeight);
  if (!(W > 0 && H > 0)) return null;
  if (!Array.isArray(z.openings) || !z.openings.length) return null;
  const pp = doorProfileParts();
  const inward = !!dr.inward;
  const ti = dr.thresholdInfo || null;
  const timber = ti ? !!ti.timberCill : !!dr.hasTimberCill;
  const tr = dr.transom || null;
  const T = tr ? num(tr.axisT, 0) : 0;
  const segs = tr?.segments || [];
  const mullions = dr.mullions || z.mullions || [];
  const frames = (z.frames || []).length ? z.frames : [{ x: 0, w: W, kind: 'door' }];
  // the cill member face (68 outward, 40 inward) and the part of it seen from outside
  const bottomFace = timber ? num(m.frameCill, 0) : 0;
  const bottomVis = num(z.bottomVisible, 0);
  const fM = num(m.mullion, m.frameJamb);
  const railH = num(tr?.railH, num(m.transomRail, 0));

  // Each visible opening (zones.openings) with its field and the hidden line
  // one rebate further in (outward fields: the member faces; the inward door
  // field: the land, read off the mullion bands and the transom segments).
  const fieldOf = (o) => frames.find((f) => f.kind === (o.kind === 'fan' ? o.over : o.kind) && (f.side || null) === (o.side || null)) || null;
  const mullAt = (x) => mullions.find((mu) => near(mu.axisX, x)) || null;
  const rects = z.openings.map((o) => {
    const f = fieldOf(o);
    if (!f) return { vis: o, hid: null, o };
    const lJamb = near(f.x, 0), rJamb = near(f.x + f.w, W);
    const fan = o.kind === 'fan';
    const lowerUnderTransom = !fan && T > 0;
    const inwardDoor = inward && o.kind === 'door';
    let hid;
    if (inwardDoor) {
      const seg = segs.find((sg) => sg.over === 'door') || segs[0] || null;
      const ml = mullAt(f.x), mr = mullAt(f.x + f.w);
      hid = {
        x1: lJamb ? m.land : num(ml?.x2, o.x),
        x2: rJamb ? W - m.land : num(mr?.x1, o.x + o.w),
        y1: lowerUnderTransom ? num(seg?.bandBottom, o.y) : m.land,
        y2: o.y + o.h,
      };
    } else {
      hid = {
        x1: lJamb ? m.frameJamb : f.x + fM / 2,
        x2: rJamb ? W - m.frameJamb : f.x + f.w - fM / 2,
        y1: lowerUnderTransom ? T + railH / 2 : m.frameHead,
        y2: fan ? T - railH / 2 : H - bottomFace,
      };
    }
    return { vis: o, hid: { x: hid.x1, y: hid.y1, w: hid.x2 - hid.x1, h: hid.y2 - hid.y1 }, o, f };
  });
  const recs = doorRecords(derived);
  const by = (c) => recs.find((r) => r.code === c) || null;
  const leaves = [...(dr.leaves || [])].sort((a, b) => a.x - b.x);
  return {
    dr, z, m, pp, W, H, inward, ti, timber, tr, T, segs, mullions, frames, rects, bottomFace, bottomVis, leaves,
    head: by('D-H'), jambL: by('D-J/L'), jambR: by('D-J/R'), cill: by('D-CILL'),
    mullionRec: (code) => by(code),
    doorOpening: z.openings.find((o) => o.kind === 'door') || null,
  };
}

export default function DoorFrameDetail2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => buildFrame(windowSpec, derived)), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const { dr, z, m, pp, W, H, inward, timber, tr, T, segs, mullions, rects, bottomFace, bottomVis, leaves } = geom;

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
  const mullionSec = mullions.length ? sectionText(geom.mullionRec(mullions[0].code)?.section) : '';
  // the subtitle: head, jambs, mullions (one length: a frame has one height), cill or threshold
  const mLens = [...new Set(mullions.map((mu) => fmt(mu.length)))];
  const codes = [
    geom.head && `${displayCode(geom.head.code)} ${fmt(geom.head.length)}`,
    geom.jambL && `J ×2 ${fmt(geom.jambL.length)}`,
    mullions.length ? `M${mullions.length > 1 ? ` ×${mullions.length}` : ''} ${mLens.join(' / ')}` : '',
    geom.cill ? `${displayCode(geom.cill.code)} ${fmt(geom.cill.length)}` : `${geom.ti?.effectiveType || dr.threshold} threshold`,
  ].filter(Boolean).join(' · ');
  const mullionLand = num(m.mullionLand, 0);
  const notes = [
    `Section: frame ${fmt(m.frameJamb)}×${fmt(dr.frameDepth)}, land ${fmt(m.land)} + rebate ${fmt(m.rebate)}; leaf ${fmt(dr.leafDepth)} deep in the rebate, gap ${fmt(m.gap)}`,
    mullions.length
      ? `Mullion ${mullions.map((mu) => displayCode(mu.code)).join(', ')}${mullionSec ? ` ${mullionSec}` : ''}: full height, cut ${mLens.join(' / ')}${mullions[0].timberCill === false ? ' to the floor' : ''}; land ${fmt(mullionLand / 2)} + gap ${fmt(m.gap)} to the leaf each side`
      : '',
    tr
      ? `Transom (casement): axis T ${fmt(T)} from the frame top, land ${fmt(m.transomLandAbove)} above / ${fmt(m.transomLandBelow)} below the axis`
      : '',
    tr && segs.length
      ? `Transom ${segs.length > 1 ? 'segments' : 'segment'} ${segs.map((sg) => `${displayCode(sg.code)} ${fmt(sg.length)}`).join(', ')}: field leaf width + seat ${fmt(pp.transomSeat)}`
      : '',
    inward ? `Inward: rebate on the interior; from outside the frame face ${fmt(m.frameJamb)} laps ${fmt(m.frameJamb - m.land - m.gap)} over the leaf` : '',
    `Threshold: ${thresholdText(dr, pp)}`,
  ].filter(Boolean);

  // ── Bottom annotation rows and the title ──
  //   row 0  the layer chain across the frame: jamb land · gap · leaf / light ·
  //          ... · gap + land (a french pair as one block: the leaves overlap)
  //   row 1  across each mullion: gap + mullion land + gap (one label each)
  //   row 2  the member chain: jamb face · mullion faces · jamb face
  //   row 3  the fields, to the mullion axes
  const lights = [...(dr.panelLeaves || [])].map((pn) => ({ x0: pn.x, x1: pn.x + pn.w, name: '' }));
  const lL = leaves[0];
  const lR = leaves[leaves.length - 1];
  const items = [...lights, ...(lL && lR ? [{ x0: lL.x, x1: lR.x + lR.w, name: leaves.length > 1 ? 'leaves' : 'leaf' }] : [])]
    .sort((a, b) => a.x0 - b.x0);
  const crossings = [];
  items.slice(0, -1).forEach((it, k) => {
    const nx = items[k + 1];
    const mu = mullions.find((q) => q.axisX > it.x1 && q.axisX < nx.x0) || null;
    if (mu) crossings.push({ x0: it.x1, x1: nx.x0, label: `${fmt(mu.x1 - it.x1)} + ${fmt(mu.x2 - mu.x1)} + ${fmt(nx.x0 - mu.x2)}` });
  });
  const rowCount = 2 + (crossings.length ? 1 : 0) + (geom.frames.length > 1 ? 1 : 0);
  const rowOf = { layer: 0, cross: crossings.length ? 1 : null, member: crossings.length ? 2 : 1, field: crossings.length ? 3 : 2 };
  const rowY = (k) => oy + H + (24 + 26 * k) * ts;
  const bottomAnn = (24 + 26 * rowCount) * ts;
  const TITLE = (44 + 18 * notes.length) * ts;
  const svgH = MT + H + bottomAnn + TITLE;
  const titleY = oy + H + bottomAnn + 16 * ts;
  const dimFs = SIZES.dimSmall * ts;
  const textW = (t) => String(t).length * 0.55 * dimFs;   // the width a dim label takes (the harness collision rule)
  // The layer chain runs in pieces: it breaks over each mullion (row 1 carries that span).
  const chains = [{ cuts: [0], labels: [] }];
  const cur = () => chains[chains.length - 1];
  if (items.length) {
    cur().cuts.push(m.land, items[0].x0);
    cur().labels.push(fmt(m.land), fmt(items[0].x0 - m.land));
    // the gap label is a leader text right of its segment: an item label never reaches into it
    const gapEnd = m.land + (items[0].x0 - m.land) / 2 + 15 * ts + textW(fmt(items[0].x0 - m.land));
    // and the gap + land label at the right end is centred on its segment
    const lastX1 = items[items.length - 1].x1;
    const endStart = (lastX1 + W) / 2 - textW(`${fmt(W - m.land - lastX1)} + ${fmt(m.land)}`) / 2;
    items.forEach((it, k) => {
      cur().cuts.push(it.x1);
      const w = it.x1 - it.x0, c = (it.x0 + it.x1) / 2;
      const fits = (t) => textW(t) <= w - 8 * ts && (k > 0 || c - textW(t) / 2 > gapEnd)
        && (k < items.length - 1 || c + textW(t) / 2 < endStart);
      const full = it.name ? `${it.name} ${fmt(w)}` : fmt(w);
      cur().labels.push(fits(full) ? full : (fits(fmt(w)) ? fmt(w) : ''));
      const nx = items[k + 1];
      if (!nx) return;
      if (crossings.some((cr) => near(cr.x0, it.x1))) {
        chains.push({ cuts: [nx.x0], labels: [] });
      } else {
        cur().cuts.push(nx.x0);
        cur().labels.push(fmt(nx.x0 - it.x1));
      }
    });
    // (the right gap and land share one segment so the short gap label never lands on the land label)
    cur().cuts.push(W);
    cur().labels.push(`${fmt(W - m.land - items[items.length - 1].x1)} + ${fmt(m.land)}`);
  } else {
    cur().cuts.push(m.land, W - m.land, W);
    cur().labels = undefined;
  }
  // Member chain along the bottom: jamb face · mullion faces · jamb face
  const memberCuts = [0, m.frameJamb];
  mullions.forEach((mu) => memberCuts.push(mu.axisX - num(m.mullion, m.frameJamb) / 2, mu.axisX + num(m.mullion, m.frameJamb) / 2));
  memberCuts.push(W - m.frameJamb, W);
  // Vertical member chain on the left: land · rebate · (transom land band) · cill
  const vCuts = [0, m.land, m.frameHead];
  if (tr?.band) vCuts.push(tr.band.y, tr.band.y + tr.band.h);
  if (timber) {
    if (!inward && bottomFace > bottomVis) vCuts.push(H - bottomFace);
    vCuts.push(H - bottomVis);
  }
  vCuts.push(H);
  const vLabels = vCuts.slice(0, -1).map((c, i) => fmt(vCuts[i + 1] - c));

  const rightX = (k) => ox + W + (22 + 26 * k) * ts;
  const ok = (r) => r && r.w > 0 && r.h > 0;
  const midDoorY = num(lL?.y, 0) + num(lL?.h, H) / 2;
  const doorX = num(z.doorX, 0);
  const doorR = doorX + num(z.doorW, W);
  const dOpen = geom.doorOpening;
  const thrX0 = dOpen ? dOpen.x : doorX;
  const thrX1 = dOpen ? dOpen.x + dOpen.w : doorR;

  const cillLabel = timber
    ? [recordText(geom.cill), inward
      ? `${fmt(pp.cillInward.faceInternal)} → ${fmt(pp.cillInward.faceExternal)} fall, unrebated`
      : `${fmt(bottomVis)} visible`].filter(Boolean).join(' · ')
    : `${String(geom.ti?.effectiveType || dr.threshold || '').toUpperCase().replace('-', ' ')} THRESHOLD${geom.ti?.seal ? ` + SEAL ${fmt(geom.ti.seal.length)}` : ''} · no timber member`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── FRAME body: the assembly less the openings seen from outside ── */}
        <path
          d={[`M ${X(0)} ${Y(0)} H ${X(W)} V ${Y(H)} H ${X(0)} Z`,
            ...rects.map((r) => r.vis).filter(ok).map((o) => `M ${X(o.x)} ${Y(o.y)} H ${X(o.x + o.w)} V ${Y(o.y + o.h)} H ${X(o.x)} Z`)].join(' ')}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={W} height={H}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        {rects.map((r, i) => (
          <g key={`fr${i}`}>
            {ok(r.vis) && (
              <rect x={X(r.vis.x)} y={Y(r.vis.y)} width={r.vis.w} height={r.vis.h}
                fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            )}
            {ok(r.hid) && (
              <rect x={X(r.hid.x)} y={Y(r.hid.y)} width={r.hid.w} height={r.hid.h}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash} />
            )}
          </g>
        ))}

        {/* ── MULLIONS (casement, full height through the transom): the axis and the code ── */}
        {mullions.map((mu, i) => {
          const lx = X(mu.axisX) + codeFs * 0.35;
          return (
            <g key={`mu${i}`}>
              <line x1={X(mu.axisX)} y1={Y(0) - 10 * ts} x2={X(mu.axisX)} y2={Y(H) + 10 * ts}
                stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={axisDash} />
              <text x={lx} y={Y(midDoorY)} fill={COLORS.label} fontSize={codeFs}
                fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
                transform={`rotate(-90, ${lx}, ${Y(midDoorY)})`}>
                {`${displayCode(mu.code)} ${fmt(mu.length)}${mullionSec ? ` · ${mullionSec}` : ''}`}
              </text>
            </g>
          );
        })}

        {/* ── TRANSOM (casement): the axis and one code per segment above its band ── */}
        {tr && (
          <g>
            <line x1={X(0) - 10 * ts} y1={Y(T)} x2={X(W) + 10 * ts} y2={Y(T)}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={axisDash} />
            {segs.map((sg, i) => (
              <text key={`ts${i}`} x={X((sg.x1 + sg.x2) / 2)} y={Y(sg.bandTop) - codeFs * 0.6} fill={COLORS.label} fontSize={codeFs}
                fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
                {`${displayCode(sg.code)} ${fmt(sg.length)}`}
              </text>
            ))}
          </g>
        )}

        {/* ── CILL (one piece across the assembly) or the threshold product under the door opening ── */}
        {timber ? (
          <rect x={X(0)} y={Y(H - bottomVis)} width={W} height={bottomVis}
            fill={COLORS.frameFill} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        ) : (
          <line x1={X(thrX0)} y1={Y(H)} x2={X(thrX1)} y2={Y(H)}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.boardIndicator} {...NS} />
        )}

        {/* ── LEAF ghosts straight from the engine: door leaves, side lights, fan leaves ── */}
        {[...leaves, ...(dr.panelLeaves || []), ...(dr.fanLeaves || [])].map((lf, i) => (
          <rect key={`g${i}`} x={X(lf.x)} y={Y(lf.y)} width={lf.w} height={lf.h}
            fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={ghostDash} />
        ))}
        {lL && (
          <Label x={X((doorX + doorR) / 2)} y={Y(midDoorY)} text={leaves.length === 2 ? 'LEAVES ×2 (ref)' : 'LEAF (ref)'} vbw={svgW} />
        )}

        {/* ── MEMBER CODES on the frame: head, jambs, cill ── */}
        <text x={X(W / 2)} y={Y(m.frameHead) + codeFs * 1.2} fill={COLORS.label} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
          {geom.head ? recordText(geom.head) : `H ${fmt(W)}`}
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
        {tr && (
          <>
            <DimV x={rightX(0)} y1={Y(0)} y2={Y(T)} extFrom={X(W)} label={`T ${fmt(T)}`} small vbw={svgW} />
            <DimV x={rightX(0)} y1={Y(T)} y2={Y(H)} extFrom={X(W)} label={fmt(H - T)} small vbw={svgW} />
          </>
        )}
        <DimV x={rightX(tr ? 1 : 0)} y1={Y(0)} y2={Y(H)} extFrom={X(W)} label={fmt(H)} vbw={svgW} />

        <DimChainV x={ox - 24 * ts} cuts={vCuts.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} labels={vLabels} fmt={fmt} />
        <DimV x={ox - 84 * ts} y1={Y(0)} y2={Y(m.frameHead)} extFrom={ox - 4 * ts}
          label={`head ${fmt(m.frameHead)}`} small vbw={svgW} />
        {timber && bottomFace > 0 && (
          <DimV x={ox - 84 * ts} y1={Y(H - bottomFace)} y2={Y(H)} extFrom={ox - 4 * ts}
            label={`cill ${fmt(bottomFace)}`} small vbw={svgW} />
        )}

        {chains.map((ch, i) => (
          <DimChainH key={`lc${i}`} y={rowY(rowOf.layer)} cuts={ch.cuts.map(X)} extFrom={oy + H + 4 * ts} vbw={svgW} labels={ch.labels} fmt={fmt} />
        ))}
        {crossings.map((cr, i) => (
          <DimH key={`cr${i}`} y={rowY(rowOf.cross)} x1={X(cr.x0)} x2={X(cr.x1)} extFrom={oy + H + 4 * ts}
            label={cr.label} small vbw={svgW} />
        ))}
        <DimChainH y={rowY(rowOf.member)} cuts={memberCuts.map(X)} extFrom={oy + H + 4 * ts} vbw={svgW} fmt={fmt} />
        {geom.frames.length > 1 && geom.frames.map((f, i) => (
          <DimH key={`fw${i}`} y={rowY(rowOf.field)} x1={X(f.x)} x2={X(f.x + f.w)} extFrom={Y(H)}
            label={`${f.kind === 'door' ? 'door' : `${f.side} panel`} ${fmt(f.w)}`} small vbw={svgW} />
        ))}

        {/* ── TITLE + notes ── */}
        <TitleBlock x={svgW / 2} y={titleY} title={`Frame Detail${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={codes} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
