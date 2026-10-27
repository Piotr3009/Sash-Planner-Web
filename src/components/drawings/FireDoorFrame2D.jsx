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
 * rebate section (the finished 50 x depth with the 15 x 47 notch) is drawn
 * enlarged beside the head, then the op table and the notes.
 * Member coordinates as fireDoor.js: x along the length from the top long
 * point (the left long point of the head), y across the thickness from the
 * wall face, z along the depth from the outside face. A multi-detail sheet:
 * the chains sit under their members. Every number comes from
 * derived.firedoor; the literals here are drawing sizes in text units.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { num, fireDoorFrameMembers, opTableRows, hingeWord, swingWord, pullFaceNote, ratingWord, wrapLines } from './fireDoorDrawUtils.js';
import { OpTable, opTableMetrics } from './FireDoorLeaf2D.jsx';

const C = { band: 'rgba(148,163,184,0.05)', cheek: 'rgba(14,165,233,0.07)', recess: 'rgba(14,165,233,0.14)', pocket: 'rgba(239,68,68,0.10)', cut: 'rgba(239,68,68,0.10)' };
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
    `Lock jamb: keep plate ${fmt(keep.plate?.millLength)} x ${fmt(keep.plate?.millWidth)} x ${fmt(keep.plate?.depth)} (full radius ends) centred ${fmt(keep.centreFromFoot)} above the foot (${fmt(keep.centreFromTop)} from the top long point) on the cheek, centred on the leaf thickness; bolt pocket ${fmt(keep.pocket?.length)} x ${fmt(keep.pocket?.width)} x ${fmt(keep.pocket?.depth)} centred on the plate`,
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
                  return <rect key={k} x={X(num(op.x, 0))} y={b.stripTop + num(op.z, 0)} width={num(op.length, 0)} height={num(op.width, 0)} fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />;
                }
                return null;
              })}
              {m.role === 'jambHinge' && (hg.positions || []).map((p, k) => (
                <Label key={`hl${k}`} x={X(num(p.jambTop, 0) + hingeLen / 2)} y={b.labelsY} text={`H${k + 1} ${fmt(p.jambTop)}`} vbw={svgW} />
              ))}
              {m.role === 'jambLock' && plate && (
                <Label x={X(num(plate.x, 0) + num(plate.length, 0) / 2)} y={b.labelsY} text={`KEEP ${fmt(keep.centreFromFoot)} from the foot`} vbw={svgW} />
              )}
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

        <OpTable left={tableLeft} top={tableTop} rows={tableRows} ts={ts} />
        <SheetTitle x={svgW / 2} y={titleY} title={`Frame Machining${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={`${ratingWord(fd)} · ${fmt(fr.overall?.width)} × ${fmt(fr.overall?.height)} · ${fmt(thk)} × ${fmt(D)} · ${hingeWord(fd)} · ${swingWord(fd)}`} notes={notes} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
