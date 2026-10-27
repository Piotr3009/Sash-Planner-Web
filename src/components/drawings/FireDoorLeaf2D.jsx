/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * FireDoorLeaf2D.jsx (27.10.2026, fire doors v1): the leaf machining sheet.
 * The leaf is laid down 1:1 seen from the PULL face (the hinge edge on the
 * side the engine's handing puts it) with its three machined EDGES unfolded
 * beside it (the hinge edge, the lock edge and the top edge, each a band one
 * leaf thickness wide, its pull face side next to the face). Every op of
 * derived.firedoor.machining.leaf is drawn where the engine puts it: the hinge
 * recesses on the hinge edge band (and their depth as a notch on the face),
 * the forend recess and the case pocket on the lock edge band (the pocket's
 * reach as a hidden rectangle on the face), the spindle and cylinder bores on
 * the face, the vision panel cut-outs (the diamond rotated), the intumescent
 * grooves along the edge bands and the leading edge on the lock edge.
 * Dimensions: the leaf width at the top, the height on the right, the hinge
 * chain (the v1.1 rule: top offset, hinge, gap, hinge, gap, hinge, bottom
 * offset, the middle hinge centred above the leaf centre by the engine's
 * midAboveCentre) beside the hinge edge, the vision panel chain on the left, the
 * spindle and cylinder heights from the leaf bottom on the right, the chain
 * of the panes, the spindle (its backset) along the bottom. The op table
 * (kind, face, x, y, z, length, width, depth, radius) follows, then the notes.
 * Board coordinates as the bSolid master and fireDoor.js: x down the height
 * from the leaf top, y across the width from the hinge edge, z through the
 * thickness from the pull face. Every number comes from derived.firedoor; the
 * literals here are drawing sizes in text units.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { num, leafOpsByKind, opTableRows, fireDoorRecord, diamondPoints, paneBox, isDiamond, hingeWord, closerWord, hingeRuleWord, pullFaceNote, ratingWord, wrapLines } from './fireDoorDrawUtils.js';

const CHAR = 0.55;
const C = { band: 'rgba(148,163,184,0.05)', recess: 'rgba(14,165,233,0.12)', pocket: 'rgba(239,68,68,0.10)', hole: '#F59E0B' };
const HEAD = ['no', 'operation', 'face', 'x', 'y', 'z', 'length', 'width', 'depth', 'radius', 'note'];
const COL_CHARS = [0, 4, 26, 40, 48, 56, 64, 72, 80, 88, 96];

/** The metrics of an op table at text scale ts: its font, columns, row pitch, height and width (sheet units). */
export function opTableMetrics(rows, ts) {
  const fs = SIZES.code * ts * 0.8;      // 112 characters of columns fit the 700 text units of a sheet
  const colW = CHAR * fs;
  const ROW = 1.35 * fs;
  const height = (rows || []).reduce((h, r) => h + (r.header ? ROW * 1.4 : ROW), 0) + 2.2 * ROW;
  return { fs, colW, cols: COL_CHARS.map((c) => c * colW), ROW, height, width: 114 * colW };
}

/**
 * The op table of a machining sheet: a header line, then per element a red
 * header row and one row per op (opTableRows of fireDoorDrawUtils). The note
 * column is cut to `noteChars`.
 */
export function OpTable({ left, top, rows, ts, noteChars = 16 }) {
  const M = opTableMetrics(rows, ts);
  // the sheet line of every row (`ry`, never the op's own y coordinate)
  let ry = top + M.ROW;
  const laid = (rows || []).map((r) => { ry += r.header ? M.ROW * 1.4 : M.ROW; return { row: r, ry }; });
  const cell = (v) => (v == null ? '' : fmt(v));
  const cut = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}.` : t);
  return (
    <g>
      {HEAD.map((h, i) => (
        <text key={h} x={left + M.cols[i]} y={top + M.ROW} fill={COLORS.subtitle} fontSize={M.fs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{h}</text>
      ))}
      <line x1={left} y1={top + M.ROW + 5 * ts} x2={left + M.width} y2={top + M.ROW + 5 * ts} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} />
      {laid.map(({ row: r, ry: y }, i) => (r.header ? (
        <text key={i} x={left} y={y} fill={COLORS.label} fontSize={M.fs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{r.header}</text>
      ) : (
        <g key={i}>
          {[String(r.no), r.kind, r.face, cell(r.x), cell(r.y), cell(r.z), cell(r.length), cell(r.width), cell(r.depth), cell(r.radius), cut(String(r.note || ''), noteChars)].map((c, j) => (
            <text key={j} x={left + M.cols[j]} y={y} fill={COLORS.title} fontSize={M.fs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{c}</text>
          ))}
        </g>
      )))}
    </g>
  );
}

function build(derived) {
  const fd = derived?.firedoor;
  if (!fd) return null;
  const W = num(fd.leaf?.width), H = num(fd.leaf?.height), T = num(fd.leaf?.thickness);
  if (!(W > 0 && H > 0 && T > 0)) return null;
  const hingesLeft = fd.handing?.hingeSide !== 'right';
  const ops = fd.machining?.leaf || [];
  const byKind = leafOpsByKind(derived);
  const panes = (fd.vp?.panes || []).map((p, k) => ({ i: num(p.i, k), ...paneBox(p) }));
  return { fd, W, H, T, hingesLeft, ops, byKind, panes, rec: fireDoorRecord(derived, 'FD-LEAF') };
}

export default function FireDoorLeaf2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => build(derived)), [derived]);
  if (!geom) return <NoSheet text="No fire door data." />;
  const { fd, W, H, T, hingesLeft, ops, byKind, panes, rec } = geom;
  const lock = fd.lock || {};
  const hg = fd.hinges || {};
  const spindleC = lock.spindle ? { x: H - num(lock.spindle.fromBottom, 0), y: W - num(lock.spindle.fromLockEdge, num(lock.backset, 0)), bore: num(lock.spindle.bore, 0) } : null;
  const cylC = lock.cylinder ? { kind: lock.cylinder.kind, x: H - num(lock.cylinder.fromBottom, 0), y: W - num(lock.cylinder.fromLockEdge, num(lock.backset, 0)), bore: num(lock.cylinder.bore, 0) } : null;

  // the dimension columns: the hinge chain beside the hinge edge, the pane chain on the left,
  // the spindle / cylinder heights and the overall height on the right
  const leftCols = [...(hingesLeft ? ['hinge'] : []), ...(panes.length ? ['vp'] : [])];
  const rightCols = [...(spindleC ? ['spindle'] : []), ...(cylC ? ['cyl'] : []), ...(!hingesLeft ? ['hinge'] : []), 'height'];
  const mL = leftCols.length ? 62 + 32 * (leftCols.length - 1) : 24;
  const mR = 58 + 32 * (rightCols.length - 1);
  const mT = 66;
  const GAP = 6;                                       // band gap, text units
  const svgW = (W + 2 * T) / (1 - (mL + mR + 2 * GAP) / VIEWBOX_REF);
  const ts = svgW / VIEWBOX_REF;
  const gapB = GAP * ts;
  const ox = mL * ts, oy = mT * ts;
  const faceL = ox + T + gapB, faceR = faceL + W, faceT = oy + T + gapB, faceB = faceT + H;
  const bandRight = faceR + gapB + T;
  const bandL = (z) => ox + T - z;                     // the left band: z = 0 next to the face
  const bandR = (z) => faceR + gapB + z;
  const bandT = (z) => oy + T - z;
  const hingeSide = hingesLeft ? 'left' : 'right';
  const bandX = (side, z0, z1) => (side === 'left' ? { x: bandL(z1), w: z1 - z0 } : { x: bandR(z0), w: z1 - z0 });
  const SX = (y) => (hingesLeft ? faceL + y : faceR - y);
  const rectX = (y0, y1) => (hingesLeft ? faceL + y0 : faceR - y1);
  const SY = (x) => faceT + x;
  const codeFs = SIZES.code * ts;
  const dash = (a, b) => `${a * ts},${b * ts}`;
  const idBase = String(windowSpec?.id || windowSpec?.name || 'fd').replace(/[^a-zA-Z0-9]/g, '_');
  const hatchId = `fdhatch-${idBase}`;
  const leftX = (k) => ox - (26 + 32 * k) * ts;
  const rightX = (k) => bandRight + (30 + 32 * k) * ts;

  // ── the ops ──
  const hingeOps = byKind.hingeRecess || [];
  const edgeBand = (face) => (face === 'hingeEdge' ? hingeSide : face === 'lockEdge' ? (hingesLeft ? 'right' : 'left') : null);
  const lockSide = hingesLeft ? 'right' : 'left';
  const forend = (byKind.forendRecess || [])[0] || null;
  const casePocket = (byKind.casePocket || [])[0] || null;
  const grooves = byKind.intuGroove || [];
  const lead = (byKind.leadEdge || [])[0] || null;
  const vpOps = byKind.vpCutout || [];
  const holes = [...(byKind.spindleHole || []), ...(byKind.cylinderHole || [])];

  // ── the chains ──
  const uniq = (vals) => [...new Set(vals.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  const hingeCuts = uniq([0, H, ...(hg.positions || []).flatMap((p) => [num(p.top, 0), num(p.top, 0) + num(hg.length, 0)])]);
  const vpCuts = uniq([0, H, ...panes.flatMap((p) => [p.x, p.x + p.h])]);
  const bottomCuts = uniq([faceL, faceR, ...(spindleC ? [SX(spindleC.y)] : []), ...panes.flatMap((p) => [rectX(p.y, p.y + p.w), rectX(p.y, p.y + p.w) + p.w])]);

  // ── the table, the notes, the sheet height ──
  const tableRows = [{ header: `${rec?.code || rec?.elementName || 'FD-LEAF'} · ${rec?.section || `${fmt(T)}x${fmt(W)}`} x ${fmt(rec?.length ?? H)} · ${rec?.quantity ?? 1} off` }, ...opTableRows(ops, 'FD-LEAF')];
  const tableTop = faceB + 64 * ts;
  const tableLeft = Math.min(ox, 16 * ts);
  const tableH = opTableMetrics(tableRows, ts).height;
  const titleY = tableTop + tableH + 30 * ts;
  const winName = windowSpec?.name || fd.name || 'Fire door';
  const projNum = projectNumber || '';
  const intu = fd.intumescent;
  const notes = wrapLines([
    `${pullFaceNote(fd)}. Leaf ${fmt(W)} x ${fmt(H)} x ${fmt(T)} (${ratingWord(fd)} blank), seen from the PULL face with the hinge edge on the ${hingeSide}; the hinge, lock and top edges unfolded beside the face, the pull face side of each edge next to it. Board coordinates as the bSolid master: x down from the leaf top, y from the hinge edge, z from the pull face`,
    `Hinges: ${fmt(hg.count)} x ${fmt(hg.length)} ${hg.product || ''} at ${(hg.positions || []).map((p) => fmt(p.top)).join(' / ')} from the top (HINGE_1..${fmt(hg.count)}; the rule: ${hingeRuleWord(fd)}); recess ${fmt(hg.recess?.length)} x ${fmt(hg.recess?.width)} x ${fmt(hg.recess?.depth)} R${fmt(hg.recess?.radius)} on the hinge edge, from the pull face`,
    `Lock ${lock.type || ''}: forend ${fmt(lock.forend?.millLength)} x ${fmt(lock.forend?.millWidth)} x ${fmt(lock.forend?.depth)} (full radius ends) and case pocket ${fmt(lock.case?.pocketWidth)} x ${fmt(lock.case?.pocketHeight)} x ${fmt(lock.case?.pocketDepth)} on the lock edge centred on the thickness, forend centre ${fmt(lock.forend?.centreFromBottom)} above the bottom; spindle ${fmt(lock.spindle?.fromBottom)} above the bottom, ${fmt(lock.backset)} from the lock edge, bore ${fmt(lock.spindle?.bore)} through; ${cylC ? `${cylC.kind} bore ${fmt(cylC.bore)} at ${fmt(lock.cylinder.fromBottom)}` : 'no cylinder hole'}${lead ? '; leading edge bevel on the lock edge (LEAD_EDGE)' : ''}`,
    panes.length
      ? `Vision panel ${fd.vp?.label || fd.vp?.style}: ${panes.map((p) => `${fmt(p.paneW)} x ${fmt(p.paneH)}${p.diamond ? ' diamond' : ''}`).join(', ')} cut through, layout per bSolid macro (drawn centred, the first pane ${fmt(panes[0].x)} from the top)${(fd.vp?.warnings || []).length ? `; ${fd.vp.warnings.join('; ')}` : ''}`
      : 'No vision panel',
    intu
      ? `Intumescent ${intu.label || ''}: ${fmt(intu.strips)} groove${intu.strips === 1 ? '' : 's'} ${fmt(intu.groove?.width)} x ${fmt(intu.groove?.depth)} per edge for the ${fmt(intu.width)} x ${fmt(intu.thickness)} strip on the top, hinge and lock edges (${fmt(intu.metres)} m)`
      : 'No intumescent strip (non-fire door): the edges are not grooved',
    closerWord(fd),
  ], svgW - 2 * 30 * ts, codeFs);
  const svgH = titleY + (44 + 18 * notes.length) * ts;
  const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        <defs>
          <pattern id={hatchId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8 * ts} height={8 * ts} fill={C.pocket} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.label} strokeWidth={1 * ts} strokeOpacity={0.6} />
          </pattern>
        </defs>

        {/* ── the edge bands and the face ── */}
        {[['left', bandL(T), oy + T + gapB, T, H], ['right', bandR(0), oy + T + gapB, T, H]].map(([k, x, y, w, h]) => (
          <rect key={k} x={x} y={y} width={w} height={h} fill={C.band} stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(3, 3)} />
        ))}
        <rect x={faceL} y={bandT(T)} width={W} height={T} fill={C.band} stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(3, 3)} />
        <rect x={faceL} y={faceT} width={W} height={H} fill="rgba(148,163,184,0.03)" stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        <text x={bandL(T / 2)} y={faceT + H / 2} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${bandL(T / 2)}, ${faceT + H / 2})`}>{hingesLeft ? 'HINGE EDGE' : 'LOCK EDGE'}</text>
        <text x={bandR(T / 2)} y={faceT + H / 2} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${bandR(T / 2)}, ${faceT + H / 2})`}>{hingesLeft ? 'LOCK EDGE' : 'HINGE EDGE'}</text>
        <text x={faceL + W / 2} y={bandT(T / 2) + codeFs * 0.35} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>TOP EDGE</text>
        <text x={faceL + W / 2} y={faceB - 10 * ts} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>PULL FACE</text>

        {/* ── intumescent grooves along the edge bands ── */}
        {grooves.map((op, k) => {
          if (op.face === 'top') {
            const y0 = num(op.y, 0), len = num(op.length, W);
            return <rect key={`g${k}`} x={rectX(y0, y0 + len)} y={bandT(num(op.z, 0) + num(op.width, 0))} width={len} height={num(op.width, 0)} fill={C.recess} stroke={COLORS.glass} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(4, 3)} />;
          }
          const side = edgeBand(op.face);
          if (!side) return null;
          const b = bandX(side, num(op.z, 0), num(op.z, 0) + num(op.width, 0));
          return <rect key={`g${k}`} x={b.x} y={SY(num(op.x, 0))} width={b.w} height={num(op.length, H)} fill={C.recess} stroke={COLORS.glass} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(4, 3)} />;
        })}

        {/* ── hinge recesses: on the hinge edge band, their depth as a notch on the face ── */}
        {hingeOps.map((op, k) => {
          const b = bandX(hingeSide, num(op.z, 0), num(op.z, 0) + num(op.width, 0));
          return (
            <g key={`h${k}`}>
              <rect x={b.x} y={SY(num(op.x, 0))} width={b.w} height={num(op.length, 0)} rx={num(op.radius, 0)} fill={C.recess} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
              <rect x={rectX(0, num(op.depth, 0))} y={SY(num(op.x, 0))} width={num(op.depth, 0)} height={num(op.length, 0)} fill={COLORS.label} fillOpacity={0.35} stroke={COLORS.label} strokeWidth={STROKES.sashLight} {...NS} />
            </g>
          );
        })}
        {(hg.positions || []).map((p, k) => (
          <Label key={`hl${k}`} x={hingesLeft ? faceL + 14 * ts : faceR - 14 * ts} y={SY(num(p.top, 0) + num(hg.length, 0) / 2) + 5 * ts}
            text={`H${k + 1} ${fmt(p.top)}`} anchor={hingesLeft ? 'start' : 'end'} vbw={svgW} />
        ))}

        {/* ── the lock: forend and case pocket on the lock edge band, the pocket's reach hidden on the face ── */}
        {forend && (() => { const b = bandX(lockSide, num(forend.z, 0), num(forend.z, 0) + num(forend.width, 0)); return (
          <rect x={b.x} y={SY(num(forend.x, 0))} width={b.w} height={num(forend.length, 0)} rx={num(forend.radius, 0)} fill={C.recess} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
        ); })()}
        {casePocket && (() => { const b = bandX(lockSide, num(casePocket.z, 0), num(casePocket.z, 0) + num(casePocket.width, 0)); return (
          <g>
            <rect x={b.x} y={SY(num(casePocket.x, 0))} width={b.w} height={num(casePocket.length, 0)} fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            <rect x={rectX(W - num(casePocket.depth, 0), W)} y={SY(num(casePocket.x, 0))} width={num(casePocket.depth, 0)} height={num(casePocket.length, 0)} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(6, 4)} />
          </g>
        ); })()}
        {forend && (
          <>
            <Label x={hingesLeft ? faceR - 14 * ts : faceL + 14 * ts} y={SY(num(forend.x, 0)) - 8 * ts} text={`FOREND ${fmt(forend.length)} × ${fmt(forend.width)}`} anchor={hingesLeft ? 'end' : 'start'} vbw={svgW} />
            {casePocket && <Label x={hingesLeft ? faceR - 14 * ts : faceL + 14 * ts} y={SY(num(forend.x, 0)) + num(forend.length, 0) + 18 * ts} text={`CASE ${fmt(casePocket.width)} × ${fmt(casePocket.length)} × ${fmt(casePocket.depth)}`} anchor={hingesLeft ? 'end' : 'start'} vbw={svgW} />}
          </>
        )}
        {lead && (
          <line x1={hingesLeft ? faceR : faceL} y1={SY(num(lead.x, 0))} x2={hingesLeft ? faceR : faceL} y2={SY(num(lead.x, 0) + num(lead.length, H))} stroke={COLORS.notch} strokeWidth={STROKES.notch} {...NS} strokeDasharray={dash(10, 5)} />
        )}

        {/* ── the bores on the face (the engine's x / y are the hole CENTRE, radius = bore / 2) ── */}
        {holes.map((op, k) => (
          <circle key={`b${k}`} cx={SX(num(op.y, 0))} cy={SY(num(op.x, 0))} r={num(op.radius, num(op.width, 0) / 2)}
            fill={C.hole} fillOpacity={0.5} stroke={C.hole} strokeWidth={STROKES.sash} {...NS} />
        ))}

        {/* ── the vision panel cut-outs (the op's x / y is its bounding box corner, length along the height, width across) ── */}
        {(vpOps.length ? vpOps.map((op) => ({ x: num(op.x, 0), y: num(op.y, 0), w: num(op.width, 0), h: num(op.length, 0), diamond: isDiamond(op), r: num(op.radius, 0) })) : panes).map((p, k) => {
          const r = { x: rectX(p.y, p.y + p.w), y: SY(p.x), w: p.w, h: p.h };
          return p.diamond
            ? <polygon key={`v${k}`} points={pts(diamondPoints(r))} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity} stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />
            : <rect key={`v${k}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={p.r || 0} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity} stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />;
        })}
        {panes.map((p, k) => (
          <Label key={`vl${k}`} x={rectX(p.y, p.y + p.w) + p.w / 2} y={SY(p.x) + p.h / 2 + 5 * ts} text={`VP ${fmt(p.paneW)} × ${fmt(p.paneH)}`} vbw={svgW} />
        ))}

        {/* ── dimensions ── */}
        <DimH y={oy - 30 * ts} x1={faceL} x2={faceR} extFrom={faceT} label={fmt(W)} vbw={svgW} />
        <DimChainH y={faceB + 26 * ts} cuts={bottomCuts} extFrom={faceB + 4 * ts} vbw={svgW} fmt={fmt} />
        {leftCols.map((c, k) => (c === 'hinge'
          ? <DimChainV key={c} x={leftX(k)} cuts={hingeCuts.map(SY)} extFrom={ox - 4 * ts} vbw={svgW} fmt={fmt} />
          : <DimChainV key={c} x={leftX(k)} cuts={vpCuts.map(SY)} extFrom={ox - 4 * ts} vbw={svgW} fmt={fmt} />))}
        {rightCols.map((c, k) => {
          if (c === 'hinge') return <DimChainV key={c} x={rightX(k)} cuts={hingeCuts.map(SY)} extFrom={bandRight + 4 * ts} vbw={svgW} fmt={fmt} />;
          if (c === 'spindle') return <DimV key={c} x={rightX(k)} y1={SY(spindleC.x)} y2={faceB} extFrom={faceR} label={`spindle ${fmt(lock.spindle.fromBottom)}`} small vbw={svgW} />;
          if (c === 'cyl') return <DimV key={c} x={rightX(k)} y1={SY(cylC.x)} y2={faceB} extFrom={faceR} label={`${cylC.kind} ${fmt(lock.cylinder.fromBottom)}`} small vbw={svgW} />;
          return <DimV key={c} x={rightX(k)} y1={faceT} y2={faceB} extFrom={bandRight} label={fmt(H)} vbw={svgW} />;
        })}

        <OpTable left={tableLeft} top={tableTop} rows={tableRows} ts={ts} />
        <SheetTitle x={svgW / 2} y={titleY} title={`Leaf Machining${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={`${fmt(T)} × ${fmt(W)} × ${fmt(H)} · ${ratingWord(fd)} · ${hingeWord(fd)} · ${ops.length} operations`} notes={notes} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
