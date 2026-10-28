/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * FireDoorFrame2D.jsx (27.10.2026, fire doors v1): the frame machining sheet
 * for the 5-axis programmer. The three members (head, hinge jamb, lock jamb)
 * are laid down 1:1 one above the other, each seen from the OPENING side with
 * its two long faces UNFOLDED beside it: the OUTSIDE face (the 35 face, the
 * wall edge at the top of the band) above, then the opening view (the rebate
 * cheek z 0..47 hatched, then the 50 lip to the inside face), then the INSIDE
 * face (the 50 face, the wall edge at the bottom of the band) below. The
 * mitres show as the 45 lines in both bands (the long point at the wall edge)
 * and as the stepped end of the opening view (the cheek 35 and the lip 50
 * short of the long point). On the cheek: the hinge recesses of the hinge jamb
 * (dimensioned from the jamb top long point by the macro chain) and the keep
 * plate and pocket of the lock jamb (from the top and from the foot). The
 * corner dowels (v1.1, derived.firedoor.frame.dowels and the dowelBore ops):
 * at each mitred end the perJoint dowel circles sit on the mitre line of the
 * opening view (the stepped end: the cheek and the lip short of the long
 * point) at the engine's positions along the depth, with one chain of those
 * positions from the outside face under the first mitred end of each member
 * (the head's left end, the jambs' top end). The rebate section (the finished
 * 50 x depth with the 15 x 47 notch) is drawn enlarged beside the head, then
 * the op table and the notes.
 * v1.2 (28.10.2026): the keep plate and the keep pocket drawn as slots with
 * the engine's full radius ends (op.radius), the radius in the notes; a
 * built in closer's track (derived.firedoor.closer.symbol.track, never
 * machined) dashed on the head's rebate cheek over the leaf, centred on the
 * closer body, with its caption and note.
 * Member coordinates as fireDoor.js: x along the length from the top long
 * point (the left long point of the head), y across the thickness from the
 * wall face, z along the depth from the outside face. A multi-detail sheet:
 * the chains sit under their members. Every number comes from
 * derived.firedoor; the literals here are drawing sizes in text units.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, fmtGlass, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { num, fireDoorFrameMembers, opTableRows, closerWord, hingeWord, pullFaceNote, ratingWord, wrapLines } from './fireDoorDrawUtils.js';
import { OpTable, opTableMetrics } from './FireDoorLeaf2D.jsx';

const C = { band: 'rgba(148,163,184,0.05)', cheek: 'rgba(14,165,233,0.07)', recess: 'rgba(14,165,233,0.14)', pocket: 'rgba(239,68,68,0.10)', cut: 'rgba(239,68,68,0.10)', dowel: '#F59E0B' };
const SECTION_SCALE = 4;

function build(derived) {
  const fd = derived?.firedoor;
  if (!fd) return null;
  const fr = fd.frame || {};
  const members = fireDoorFrameMembers(derived);
  const D = num(fr.depth), thk = num(fr.thickness), faceOut = num(fr.faces?.outside), rebW = num(fr.rebate?.width), rebD = num(fr.rebate?.depth);
  if (!members.length || !(D > 0 && thk > 0) || [faceOut, rebW, rebD].some((v) => v == null)) return null;
  if (!members.every((m) => num(m.length, 0) > 0)) return null;
  return { fd, fr, members, D, thk, faceOut, rebW, rebD };
}

export default function FireDoorFrame2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => build(derived)), [derived]);
  if (!geom) return <NoSheet text="No fire door data." />;
  const { fd, fr, members, D, thk, faceOut, rebW, rebD } = geom;
  const maxLen = Math.max(...members.map((m) => num(m.length, 0)));
  const hg = fd.hinges || {};
  const keep = fd.keep || {};
  // the corner dowels (v1.1): the engine's sizes and positions along the depth; none = no dowel drawing
  const dw = fr.dowels || {};
  const dowelZ = (dw.positionsAlongDepth || []).map((z) => num(z, 0));
  const hasDowels = num(dw.count, 0) > 0 && num(dw.dia, 0) > 0 && dowelZ.length > 0;
  const dowelR = hasDowels ? num(dw.dia, 0) / 2 : 0;

  const mL = 82, mR = 104, mT = 24;         // the left margin holds the band captions ('outside 35', 'opening', 'inside 50')
  const svgW = maxLen / (1 - (mL + mR) / VIEWBOX_REF);
  const ts = svgW / VIEWBOX_REF;
  const ML = mL * ts;
  const X = (x) => ML + x;
  const codeFs = SIZES.code * ts;
  const labelFs = SIZES.label * ts;
  const gapB = 4 * ts;
  const dash = (a, b) => `${a * ts},${b * ts}`;
  const idBase = String(windowSpec?.id || windowSpec?.name || 'fd').replace(/[^a-zA-Z0-9]/g, '_');
  const hatchId = `fdfhatch-${idBase}`;
  const cutId = `fdfcut-${idBase}`;
  const uniq = (vals) => [...new Set(vals.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  const hingeLen = num(hg.length, 0);

  // ── the rebate section: enlarged beside the head when the head leaves room for it, else under the members ──
  const S = SECTION_SCALE;
  const secW = thk * S, secH = D * S;
  const secCap = `SECTION ${S}:1 · ${fmt(thk)} × ${fmt(D)} · rebate ${fmt(rebW)} × ${fmt(rebD)}`;
  const secCapW = secCap.length * 0.55 * codeFs;
  const headIndex = Math.max(0, members.findIndex((m) => m.role === 'head'));
  const rightOfHead = X(num(members[headIndex].length, 0)) + 110 * ts;
  // beside the head only when the section, its right hand chain AND its caption fit before the sheet edge
  const secBeside = rightOfHead + Math.max(secW + 60 * ts, secCapW + 8 * ts) <= X(maxLen) + (mR - 4) * ts;
  const secLeft = secBeside ? rightOfHead : ML;
  let secTop = null;

  // ── the blocks ──
  let cursor = mT * ts;
  const blocks = members.map((m, k) => {
    const L = num(m.length, 0);
    const titleY = cursor + labelFs;
    const dimY = titleY + 34 * ts;
    const outTop = dimY + 12 * ts;
    const stripTop = outTop + faceOut + gapB;
    const inTop = stripTop + D + gapB;
    const inBottom = inTop + thk;
    const rowY = (r) => inBottom + (30 + 30 * r) * ts;
    const ops = m.ops || [];
    const plates = ops.filter((o) => o.kind === 'keepPlate');
    const rows = m.role === 'jambHinge' ? 1 : m.role === 'jambLock' && plates.length ? 2 : 0;
    const labelsY = stripTop + rebD + (D - rebD) / 2 + 5 * ts;   // the lip region carries the feature labels
    const endY = rows ? rowY(rows - 1) + 16 * ts : inBottom + 14 * ts;   // the end captions under the last chain row
    const caps = m.role === 'head' ? ['LEFT long point', 'RIGHT long point'] : ['TOP long point', 'FOOT (square)'];
    // a member shorter than its two end captions stacks the right caption one line lower
    const stacked = L < (caps[0].length + caps[1].length) * 0.55 * codeFs + 12 * ts;
    const endY2 = stacked ? endY + 1.25 * codeFs : endY;
    const blockBottom = endY2 + 4 * ts;
    cursor = blockBottom + 26 * ts;
    if (secBeside && k === headIndex) {
      // the section beside the head is taller than the head block: the next block starts under it
      secTop = outTop;
      cursor = Math.max(cursor, secTop + secH + 50 * ts);
    }
    return { m, k, L, titleY, dimY, outTop, stripTop, inTop, inBottom, rowY, rows, labelsY, endY, endY2, caps, ops, plates, blockBottom };
  });
  const first = blocks[0];
  if (secTop == null) {
    secTop = cursor + 20 * ts;
    cursor = secTop + secH + 50 * ts;
  }
  const secPts = [[0, 0], [faceOut, 0], [faceOut, rebD], [thk, rebD], [thk, D], [0, D]].map(([y, z]) => `${secLeft + y * S},${secTop + z * S}`).join(' ');

  // ── the mitre face detail (v1.1): the 45 end face unfolded at S:1, the wall edge at its left ──
  // The face is thk x sqrt 2 wide along the cut (faceOut x sqrt 2 over the rebated
  // depth 0..rebD) and D tall along the depth; the dowel bores sit on it at the
  // engine's yCentre across the thickness (yCentre x sqrt 2 along the cut) and at
  // positionsAlongDepth from the outside face. One detail serves every mitred
  // end (the engine bores them alike). Beside the section when the row has the
  // room past the section caption, else under it; its caption sits UNDER the
  // detail (below the across dimension) so it never meets the section caption.
  const SQ2 = Math.SQRT2;
  const mitW = thk * SQ2 * S, mitH = D * S;
  const mitCap = hasDowels ? `MITRE FACE ${S}:1 (unfolded) · dowels ${fmt(dw.dia)} × ${fmt(dw.length)}, ${fmt(dw.perJoint)} per corner, ${fmt(dw.boreDepth)} deep` : '';
  const mitCapW = mitCap.length * 0.55 * codeFs;
  const mitNote = hasDowels ? `along the cut (${fmt(dw.yCentre)} across the thickness)` : '';
  const mitNoteW = mitNote.length * 0.55 * SIZES.dimSmall * ts;
  const secCapX = Math.min(secLeft, svgW - 8 * ts - secCapW);
  const mitBesideLeft = Math.max(secLeft + secW + 80 * ts, secCapX + secCapW + 60 * ts);
  const mitBeside = hasDowels && mitBesideLeft + mitW + 64 * ts <= svgW - 8 * ts;
  const mitLeft = mitBeside ? mitBesideLeft : ML;
  let mitTop = null, mitCapY = null;
  if (hasDowels) {
    mitTop = mitBeside ? secTop : cursor + 20 * ts;
    mitCapY = mitTop + mitH + 64 * ts;
    cursor = Math.max(cursor, mitCapY + 24 * ts);
  }
  const mitPts = hasDowels
    ? [[0, 0], [faceOut * SQ2, 0], [faceOut * SQ2, rebD], [thk * SQ2, rebD], [thk * SQ2, D], [0, D]].map(([u, z]) => `${mitLeft + u * S},${mitTop + z * S}`).join(' ')
    : '';
  const mitDowelU = hasDowels ? num(dw.yCentre, thk / 2) * SQ2 : 0;
  // the one chain of the dowel positions along the depth, from the outside face (mm labels, the detail is at S:1)
  const mitCuts = hasDowels ? uniq([0, ...dowelZ, D]) : [];
  const mitLabels = mitCuts.slice(0, -1).map((z, k) => fmt(mitCuts[k + 1] - z));

  // the mitre face as the opening view sees it (foreshortened along y): x from the
  // long point to the stepped end (the cheek faceOut, the lip thk); the bore
  // centre at y = yCentre projects to x = yCentre from the long point
  const mitreFacePts = (atStart, L) => {
    const pts = [[0, 0], [faceOut, 0], [faceOut, rebD], [thk, rebD], [thk, D], [0, D]];
    return atStart ? pts : pts.map(([x, z]) => [L - x, z]);
  };

  // ── v1.2: a built in closer's track in the head soffit (never machined): along the head
  // from the outside elevation's left (the head's left long point), the leaf edge
  // faceOut + gapSide in, the track `y` from the hinge edge; across the cheek
  // (z from the outside face, where the leaf's pull face closes) centred on the
  // closer body (body.z + body.width / 2) ──
  const sym = fd.closer?.symbol;
  const track = sym?.kind === 'builtin' && sym.track ? (() => {
    const t = sym.track, bd = sym.body || {};
    const leafW = num(fd.leaf?.width, 0), leafX = faceOut + num(fr.gaps?.side, 0);
    const len = num(t.length, 0), wid = num(t.width, 0);
    const x0 = fd.handing?.hingeSide === 'right' ? leafX + leafW - num(t.y, 0) - len : leafX + num(t.y, 0);
    const zc = num(bd.z, 0) + num(bd.width, 0) / 2;
    return { x0, len, z0: zc - wid / 2, wid, depth: num(t.depth, 0) };
  })() : null;

  // the keep pocket op (its full radius ends, the engine's radius)
  const keepPocketOp = members.flatMap((m) => m.ops || []).find((o) => o.kind === 'keepPocket') || null;

  // ── the table, the notes ──
  const tableRows = [];
  let no = 1;
  members.forEach((m) => {
    tableRows.push({ header: `${m.id} · ${m.section || `${fmt(thk)}x${fmt(D)}`} x ${fmt(m.length)} · raw ${m.rawSection || ''} · ${m.quantity ?? 1} off` });
    const rows = opTableRows(m.ops, m.id, no);
    no += rows.length;
    tableRows.push(...rows);
  });
  const tableTop = cursor + 10 * ts;
  const tableLeft = Math.min(ML, 16 * ts);
  const titleY = tableTop + opTableMetrics(tableRows, ts).height + 30 * ts;
  const winName = windowSpec?.name || fd.name || 'Fire door';
  const projNum = projectNumber || '';
  const notes = wrapLines([
    pullFaceNote(fd),
    `Frame ${fmt(thk)} x ${fmt(D)} finished from ${fmt(fr.rawThickness)} x ${fmt(fr.rawWidth)} raw; rebate ${fmt(rebW)} x ${fmt(rebD)} from solid along every member on the opening side (${fmt(faceOut)} face outside, ${fmt(thk)} inside); overall ${fmt(fr.overall?.width)} x ${fmt(fr.overall?.height)} (leaf + ${fmt(fr.overall?.width - fd.leaf?.width)} / + ${fmt(fr.overall?.height - fd.leaf?.height)})`,
    `Each member seen from the opening with its outside face unfolded above and its inside face below (the wall edge at the far side of each band); x from the top long point (the left long point of the head), the head mitred 45 both ends, the jambs mitred at the top and square at the foot: the cheek ends ${fmt(faceOut)} and the lip ${fmt(thk)} short of the long point`,
    `Hinge jamb: recesses ${fmt(hg.recess?.length)} x ${fmt(hg.recess?.width)} x ${fmt(hg.recess?.depth)} R${fmt(hg.recess?.radius)} on the rebate cheek from the outside face, hinge tops at ${(hg.positions || []).map((p) => fmt(p.jambTop)).join(' / ')} from the top long point (${fmt(faceOut)} + ${fmt(fr.gaps?.head)} + the leaf positions ${(hg.positions || []).map((p) => fmt(p.top)).join(' / ')})`,
    `Lock jamb: keep plate ${fmt(keep.plate?.millLength)} x ${fmt(keep.plate?.millWidth)} x ${fmt(keep.plate?.depth)} R${fmt(keep.plate?.radius)} (full radius ends) centred ${fmt(keep.centreFromFoot)} above the foot (${fmt(keep.centreFromTop)} from the top long point) on the cheek, centred on the leaf thickness; bolt pocket ${fmt(keep.pocket?.length)} x ${fmt(keep.pocket?.width)} x ${fmt(keep.pocket?.depth)} ${keepPocketOp ? ` R${fmt(keepPocketOp.radius)}` : ''} centred on the plate`,
    track ? `Head: ${closerWord(fd)}: its track ${fmt(track.len)} x ${fmt(track.wid)} x ${fmt(track.depth)} in the soffit over the leaf, ${fmt(sym.track.y)} from the hinge edge of the leaf, centred ${fmt(track.z0 + track.wid / 2)} from the outside face; concealed, not machined yet (drawn dashed)` : '',
    hasDowels
      ? `Corner dowels ${fmt(dw.dia)} x ${fmt(dw.length)}, ${fmt(dw.perJoint)} per corner, bored square to the mitre, ${fmt(dw.boreDepth)} deep in each piece (${fmt(dw.count)} dowels per frame): on every mitred end at ${dowelZ.map(fmt).join(' / ')} along the depth from the outside face, ${fmt(dw.yCentre)} across the thickness (the mitre face detail)`
      : 'No corner dowels',
  ], svgW - 2 * 30 * ts, codeFs);
  const svgH = titleY + (44 + 18 * notes.length) * ts;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        <defs>
          <pattern id={hatchId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8 * ts} height={8 * ts} fill={C.pocket} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.label} strokeWidth={1 * ts} strokeOpacity={0.6} />
          </pattern>
          <pattern id={cutId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width={8 * ts} height={8 * ts} fill={C.cut} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.label} strokeWidth={1 * ts} strokeOpacity={0.5} />
          </pattern>
        </defs>

        {blocks.map((b) => {
          const { m, L } = b;
          const mT0 = !!m.mitreTop, mB0 = !!m.mitreBottom;
          const cheekX0 = mT0 ? faceOut : 0, cheekX1 = mB0 ? L - faceOut : L;
          const lipX0 = mT0 ? thk : 0, lipX1 = mB0 ? L - thk : L;
          const outPts = [[0, 0], [L, 0], [mB0 ? L - faceOut : L, faceOut], [mT0 ? faceOut : 0, faceOut]].map(([x, y]) => `${X(x)},${b.outTop + y}`).join(' ');
          const inPts = [[mT0 ? thk : 0, thk], [mB0 ? L - thk : L, thk], [L, 0], [0, 0]].map(([x, y]) => `${X(x)},${b.inTop + (thk - y)}`).join(' ');
          const stripPts = [[cheekX0, 0], [cheekX1, 0], [cheekX1, rebD], [lipX1, rebD], [lipX1, D], [lipX0, D], [lipX0, rebD], [cheekX0, rebD]].map(([x, z]) => `${X(x)},${b.stripTop + z}`).join(' ');
          const hingeCuts = m.role === 'jambHinge' ? uniq([0, L, ...(hg.positions || []).flatMap((p) => [num(p.jambTop, 0), num(p.jambTop, 0) + hingeLen])]) : null;
          const plate = b.plates[0] || null;
          return (
            <g key={m.id}>
              <text x={ML} y={b.titleY} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>
                {`${m.title} · ${m.id} · ${m.section || `${fmt(thk)}x${fmt(D)}`} x ${fmt(L)} · raw ${m.rawSection || ''} · ${m.quantity ?? 1} off`}
              </text>
              <DimH y={b.dimY} x1={X(0)} x2={X(L)} extFrom={b.outTop} label={fmt(L)} vbw={svgW} />
              {/* the outside face band (the wall edge at its top), the opening view, the inside face band (the wall edge at its bottom) */}
              <polygon points={outPts} fill={C.band} stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(3, 3)} />
              <polygon points={inPts} fill={C.band} stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(3, 3)} />
              <rect x={X(cheekX0)} y={b.stripTop} width={cheekX1 - cheekX0} height={rebD} fill={C.cheek} stroke="none" />
              <polygon points={stripPts} fill="rgba(148,163,184,0.04)" stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
              <line x1={X(cheekX0)} y1={b.stripTop + rebD} x2={X(cheekX1)} y2={b.stripTop + rebD} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(8, 3)} />
              {/* the mitre lines in the bands */}
              {mT0 && <line x1={X(0)} y1={b.outTop} x2={X(faceOut)} y2={b.outTop + faceOut} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />}
              {mT0 && <line x1={X(0)} y1={b.inTop + thk} x2={X(thk)} y2={b.inTop} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />}
              {mB0 && <line x1={X(L)} y1={b.outTop} x2={X(L - faceOut)} y2={b.outTop + faceOut} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />}
              {mB0 && <line x1={X(L)} y1={b.inTop + thk} x2={X(L - thk)} y2={b.inTop} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />}
              {/* the band captions at the left */}
              <text x={ML - 6 * ts} y={b.outTop + faceOut / 2 + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>{`outside ${fmt(faceOut)}`}</text>
              <text x={ML - 6 * ts} y={b.stripTop + D / 2 + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>opening</text>
              <text x={ML - 6 * ts} y={b.inTop + thk / 2 + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>{`inside ${fmt(thk)}`}</text>
              {/* the end captions under the member (under its chain rows) */}
              <text x={X(0)} y={b.endY} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{b.caps[0]}</text>
              <text x={X(L)} y={b.endY2} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>{b.caps[1]}</text>
              {/* the ops on the cheek */}
              {b.ops.map((op, k) => {
                if (op.kind === 'hingeRecess' || op.kind === 'keepPlate') {
                  return <rect key={k} x={X(num(op.x, 0))} y={b.stripTop + num(op.z, 0)} width={num(op.length, 0)} height={num(op.width, 0)} rx={num(op.radius, 0)} fill={C.recess} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />;
                }
                if (op.kind === 'keepPocket') {
                  return <rect key={k} x={X(num(op.x, 0))} y={b.stripTop + num(op.z, 0)} width={num(op.length, 0)} height={num(op.width, 0)} rx={num(op.radius, 0)} fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />;
                }
                return null;
              })}
              {m.role === 'jambHinge' && (hg.positions || []).map((p, k) => (
                <Label key={`hl${k}`} x={X(num(p.jambTop, 0) + hingeLen / 2)} y={b.labelsY} text={`H${k + 1} ${fmt(p.jambTop)}`} vbw={svgW} />
              ))}
              {m.role === 'jambLock' && plate && (
                <Label x={X(num(plate.x, 0) + num(plate.length, 0) / 2)} y={b.labelsY} text={`KEEP ${fmt(keep.centreFromFoot)} from the foot`} vbw={svgW} />
              )}
              {/* v1.2: the built in closer's track in the head soffit (never machined), dashed */}
              {m.role === 'head' && track && (
                <>
                  <rect x={X(track.x0)} y={b.stripTop + track.z0} width={track.len} height={track.wid} fill="none" stroke={COLORS.label} strokeWidth={STROKES.sash} {...NS} strokeDasharray={dash(6, 4)} />
                  <Label x={X(track.x0 + track.len / 2)} y={b.labelsY} text="CLOSER TRACK" vbw={svgW} />
                </>
              )}
              {/* the corner dowels (v1.1): at each mitred end the mitre line of the opening view carries the
                  perJoint bore circles (dia at the engine's positions along the depth); the bore centre
                  y = yCentre across the thickness projects to x = yCentre from the long point */}
              {hasDowels && (m.dowelEnds || []).map((e, ei) => {
                const xc = e.atStart ? num(dw.yCentre, thk / 2) : L - num(dw.yCentre, thk / 2);
                const mitreLine = mitreFacePts(e.atStart, L);
                return (
                  <g key={`dw${ei}`}>
                    <polygon points={mitreLine.map(([x, z]) => `${X(x)},${b.stripTop + z}`).join(' ')} fill={`url(#${cutId})`} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(4, 3)} />
                    {e.bores.map((bo, k) => (
                      <circle key={k} cx={X(xc)} cy={b.stripTop + bo.z} r={bo.dia / 2 || dowelR} fill={C.dowel} fillOpacity={0.45} stroke={C.dowel} strokeWidth={STROKES.sash} {...NS} />
                    ))}
                  </g>
                );
              })}
              {/* the chains under the member */}
              {hingeCuts && <DimChainH y={b.rowY(0)} cuts={hingeCuts.map(X)} extFrom={b.inBottom + 2 * ts} vbw={svgW} fmt={fmt} />}
              {m.role === 'jambLock' && plate && (
                <>
                  <DimChainH y={b.rowY(0)} cuts={uniq([0, num(plate.x, 0), num(plate.x, 0) + num(plate.length, 0), L]).map(X)} extFrom={b.inBottom + 2 * ts} vbw={svgW} fmt={fmt} />
                  <DimH y={b.rowY(1)} x1={X(num(plate.x, 0) + num(plate.length, 0) / 2)} x2={X(L)} extFrom={b.inBottom + 2 * ts} label={`keep centre ${fmt(keep.centreFromFoot)} to the foot`} small vbw={svgW} />
                </>
              )}
              {/* the first member: the depth and the thickness at its right */}
              {b === first && <DimV x={X(L) + 36 * ts} y1={b.stripTop} y2={b.stripTop + D} extFrom={X(L)} label={`depth ${fmt(D)}`} vbw={svgW} />}
              {b === first && <DimV x={X(L) + 68 * ts} y1={b.inTop} y2={b.inTop + thk} extFrom={X(L)} label={fmt(thk)} small vbw={svgW} />}
            </g>
          );
        })}

        {/* ── the rebate section ── */}
        <g>
          {/* the caption starts at the section and never runs past the sheet's right edge */}
          <text x={Math.min(secLeft, svgW - 8 * ts - secCapW)} y={secTop - 10 * ts} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{secCap}</text>
          <polygon points={secPts} fill={COLORS.sectionFill} fillOpacity={0.16} stroke={COLORS.frame} strokeWidth={STROKES.section} {...NS} />
          <rect x={secLeft + faceOut * S} y={secTop} width={rebW * S} height={rebD * S} fill={`url(#${cutId})`} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(4, 3)} />
          <text x={secLeft - 6 * ts} y={secTop + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>outside</text>
          <text x={secLeft - 6 * ts} y={secTop + secH + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>inside</text>
          {/* the chains carry the mm values (the section is drawn at S:1) */}
          <DimChainH y={secTop + secH + 24 * ts} cuts={[0, faceOut, thk].map((y) => secLeft + y * S)} extFrom={secTop + secH + 4 * ts} vbw={svgW} labels={[fmt(faceOut), fmt(rebW)]} />
          <DimChainV x={secLeft + secW + 26 * ts} cuts={[0, rebD, D].map((z) => secTop + z * S)} extFrom={secLeft + secW + 4 * ts} vbw={svgW} labels={[fmt(rebD), fmt(D - rebD)]} />
        </g>

        {/* ── the mitre face detail (v1.1): the dowel bores on the unfolded 45 end face, their positions along the depth ── */}
        {hasDowels && mitTop != null && (
          <g>
            <polygon points={mitPts} fill={`url(#${cutId})`} stroke={COLORS.frame} strokeWidth={STROKES.section} {...NS} />
            {dowelZ.map((z, k) => (
              <g key={k}>
                <circle cx={mitLeft + mitDowelU * S} cy={mitTop + z * S} r={dowelR * S} fill={C.dowel} fillOpacity={0.45} stroke={C.dowel} strokeWidth={STROKES.sash} {...NS} />
                <line x1={mitLeft + mitDowelU * S - dowelR * S * 1.6} y1={mitTop + z * S} x2={mitLeft + mitDowelU * S + dowelR * S * 1.6} y2={mitTop + z * S} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} />
                <line x1={mitLeft + mitDowelU * S} y1={mitTop + z * S - dowelR * S * 1.6} x2={mitLeft + mitDowelU * S} y2={mitTop + z * S + dowelR * S * 1.6} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} />
              </g>
            ))}
            {/* the face captions at the left: 'outside' at the top edge, 'inside' a line above the bottom edge so the across dimension under it stays clear */}
            <text x={mitLeft - 6 * ts} y={mitTop + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>outside</text>
            <text x={mitLeft - 6 * ts} y={mitTop + mitH - codeFs * 0.9} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.subtitle}>inside</text>
            {/* the dowel positions along the depth from the outside face (the one chain of the sheet for them) */}
            <DimChainV x={mitLeft + mitW + 26 * ts} cuts={mitCuts.map((z) => mitTop + z * S)} extFrom={mitLeft + mitW + 4 * ts} vbw={svgW} labels={mitLabels} />
            {/* the bore centre along the cut (yCentre x sqrt 2 on the unfolded face, to 0.1 like a glass size: 35.4 for 25) with its note on the line below, kept inside the sheet */}
            <DimH y={mitTop + mitH + 30 * ts} x1={mitLeft} x2={mitLeft + mitDowelU * S} extFrom={mitTop + mitH + 4 * ts} label={fmtGlass(mitDowelU)} small vbw={svgW} />
            <text x={Math.min(mitLeft, svgW - 8 * ts - mitNoteW)} y={mitTop + mitH + 46 * ts} fill={COLORS.dim} fontSize={SIZES.dimSmall * ts} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.dim}>{mitNote}</text>
            <text x={Math.min(mitLeft, svgW - 8 * ts - mitCapW)} y={mitCapY} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{mitCap}</text>
          </g>
        )}

        <OpTable left={tableLeft} top={tableTop} rows={tableRows} ts={ts} />
        <SheetTitle x={svgW / 2} y={titleY} title={`Frame Machining${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={`${ratingWord(fd)} · ${fmt(fr.overall?.width)} × ${fmt(fr.overall?.height)} · ${fmt(thk)} × ${fmt(D)} · ${hingeWord(fd)}`} notes={notes} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
