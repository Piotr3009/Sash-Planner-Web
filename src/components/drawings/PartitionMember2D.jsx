/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * PartitionMember2D.jsx (25.10.2026): the CNC sheet of one or more partition
 * members (partitionDrawUtils.memberSheetItems). Each member is laid down 1:1
 * and FOLDED into rows of about ROW_MM so the 50 face stays legible beside the
 * text: every row shows a segment of the member (its range printed at the
 * left) with the face strip (the ROOM face of a post or stile, the front of a
 * rail) and the two long EDGES unfolded above and below it (the front face of
 * the member at the outer side of each band). On them: the stopped pockets
 * (hatched), the through rebates (banded), the stop lip and the lock edge
 * rebate (the cut-away hatched red in the edge band), the hinge recesses, the
 * latch forend and bore, the keep plate and bolt pocket, the dowel holes of
 * the members that meet this one. The END faces follow, enlarged, with their
 * dowel holes, then the operation table (every feature numbered: from / to /
 * length / width / depth / where, the detail on a second line) and the notes.
 * Every number comes from derived.partition; the literals here are drawing
 * sizes in sheet units.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { memberSheetItems, wrapNotes } from './partitionDrawUtils.js';

const CHAR = 0.55;
const ROW_MM = 900;            // a member longer than this folds into rows of equal length
const END_SCALE = 3;
const C = { pocket: 'rgba(14,165,233,0.10)', rebate: 'rgba(14,165,233,0.06)', edge: 'rgba(148,163,184,0.05)', cut: 'rgba(239,68,68,0.10)', hole: '#F59E0B' };

/** Callout numbers along a row, pushed right so they never overlap. */
function placeCallouts(items, minGap) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let last = -Infinity;
  return sorted.map((it) => {
    const x = Math.max(it.x, last + minGap);
    last = x;
    return { ...it, cx: x };
  });
}

const R1 = (v) => Math.round(v * 10) / 10;

export default function PartitionMember2D({ windowSpec, derived, projectNumber, windowTag, member, group, door }) {
  const sheet = useMemo(() => safely(() => memberSheetItems(derived, { member, group, door })), [derived, member, group, door]);
  if (!sheet || !sheet.items.length) return <NoSheet text="No member data." />;
  const items = sheet.items;
  const S = derived.partition.section;
  const maxLen = Math.max(...items.map((it) => it.length));
  const nRows = Math.max(1, Math.ceil(maxLen / ROW_MM));
  const segLen = maxLen / nRows;
  const depth = Math.max(...items.map((it) => it.depth));

  const ML = 175, MR = 110, MT = 90;
  const svgW = ML + segLen + MR;
  const ts = svgW / VIEWBOX_REF;
  const codeFs = SIZES.code * ts;
  const smallFs = codeFs * 0.85;
  const labelFs = SIZES.label * ts;
  const dash = (a, b) => `${a * ts},${b * ts}`;
  const idBase = String(windowSpec?.id || windowSpec?.name || 'wall').replace(/[^a-zA-Z0-9]/g, '_') + `-${member}-${group || ''}-${door || ''}`;
  const hatchId = `hatch-${idBase}`;
  const cutId = `cut-${idBase}`;

  // ── build the feature list and the rows of every item ──
  const blocks = [];
  const tableRows = [];
  let cursor = MT;
  let featureNo = 0;
  items.forEach((it) => {
    const L = it.length, F = it.face, D = it.depth;
    const feats = [];
    const add = (kind, x0, x1, w, d, label, where, draw) => {
      featureNo += 1;
      const f = { no: featureNo, kind, from: x0, to: x1, length: x1 != null && x0 != null ? R1(x1 - x0) : null, width: w, depth: d, label, where, ...draw };
      feats.push(f);
      return f;
    };
    const pocketDepth = S.pocketDepth;
    (it.pockets || []).forEach((p) => add('stopped pocket', p.x0, p.x1, R1(p.y1 - p.y0), p.depth, p.label, 'face (room)', { draw: 'pocket', y0: p.y0, y1: p.y1 }));
    (it.rebates || []).forEach((r) => add('through rebate', 0, L, R1(r.y1 - r.y0), pocketDepth, r.label, 'edge', { draw: 'rebate', y0: r.y0, y1: r.y1 }));
    (it.lips || []).forEach((l) => add('stop lip from solid', 0, L, R1(l.y1 - l.y0), R1(D - l.d), l.label, 'edge', { draw: 'lip', y0: l.y0, y1: l.y1, d: l.d }));
    if (it.hiddenStep) add('lock edge rebate', 0, L, it.hiddenStep.w, it.hiddenStep.d, it.hiddenStep.label, 'lock edge', { draw: 'step', ...it.hiddenStep });
    if (it.headRebate) add('head rebate', 0, L, R1(it.headRebate.y1 - it.headRebate.y0), it.headRebate.d, it.headRebate.label, 'top edge', { draw: 'headReb', ...it.headRebate });
    (it.edgeOps || []).forEach((e) => add(e.dowels ? 'dowel holes' : 'edge recess', e.x0, e.x1, e.w, e.d, e.label, e.edge === 'top' ? it.edgeTop : it.edgeBottom, { draw: e.dowels ? 'dowels' : 'recess', ...e }));
    (it.railHoles || []).forEach((e) => add('dowel holes', e.x0, e.x1, e.dia, e.len / 2, e.label, e.edge === 'top' ? it.edgeTop : it.edgeBottom, { draw: 'railHoles', ...e }));
    (it.headStops || []).forEach((h) => add('planted stop', h.x0, h.x1, h.w, h.d, h.label, 'underside', { draw: 'headStop', ...h }));
    (it.bores || []).forEach((b) => add('bore', R1(b.x - b.r), R1(b.x + b.r), b.r * 2, null, b.label, 'face, through', { draw: 'bore', ...b }));
    const ends = ['left', 'right'].map((side) => {
      const e = it.ends?.[side];
      if (!e) return null;
      const holes = e.holes.map((h) => `(${fmt(h.across)}, ${fmt(h.depth)})`).join(' ');
      const f = add('end dowels', side === 'left' ? 0 : L, side === 'left' ? 0 : L, e.dia, e.len / 2,
        `${e.holes.length} holes dia ${e.dia} x ${e.len / 2} into ${e.into} (across from the top edge of the drawing, depth from the front): ${holes}`,
        side === 'left' ? it.endLeft : it.endRight, { draw: 'end' });
      return { side, ...e, no: f.no };
    });
    // the rows of this item
    const rows = [];
    const n = Math.max(1, Math.ceil(L / segLen - 1e-9));
    for (let r = 0; r < n; r += 1) {
      const x0 = r * segLen, x1 = Math.min(L, (r + 1) * segLen);
      const capY = cursor + codeFs + (r === 0 ? 30 * ts : 0);     // the first row leaves room for the length dim above it
      const topBandY = capY + 2.4 * codeFs;                        // the callout line sits between the caption and the band
      const faceY = topBandY + D;
      const botBandY = faceY + F;
      const dimY = botBandY + D + 38 * ts;      // the chain (its leader labels stay clear of the band markers); the end captions one line under it
      const inRow = (a, b) => b >= x0 - 0.01 && a <= x1 + 0.01;
      // a full-length feature (a lip, a through rebate, an edge rebate) is called out once, at the start of the first row
      const fullLength = (f) => f.from <= 0.01 && f.to >= L - 0.01;
      const callouts = feats.filter((f) => f.draw !== 'end' && f.from != null && inRow(f.from, f.to) && (!fullLength(f) || r === 0))
        .map((f) => ({ no: f.no, x: fullLength(f) ? x0 : Math.min(Math.max((f.from + f.to) / 2, x0), x1) }));
      rows.push({ r, x0, x1, capY, topBandY, faceY, botBandY, dimY, callouts: placeCallouts(callouts, 1.4 * codeFs) });
      cursor = dimY + 1.2 * codeFs + 22 * ts;
    }
    // the end views under the rows, side by side; a wide member (the door rails) gets a smaller end scale so both fit
    const endTop = cursor + 6 * ts;
    const nEnds = ends.filter(Boolean).length;
    const endScale = nEnds ? Math.max(1.2, Math.min(END_SCALE, (svgW - ML - MR - (nEnds - 1) * 60 * ts) / (nEnds * F))) : END_SCALE;
    const endBlockH = nEnds ? 18 * ts + D * endScale + 10 * ts + 3 * 1.3 * smallFs + 10 * ts : 0;
    blocks.push({ it, feats, rows, ends, endTop, endScale });
    cursor = endTop + endBlockH + 16 * ts;
    tableRows.push({ header: `${it.name} · ${it.section} x ${fmt(L)}${it.qty ? ` · ${it.qty} off` : ''}` }, ...feats);
  });

  // ── the table (two lines per row: the numbers, then the detail) ──
  const colW = CHAR * codeFs;
  const COLS = [0, 3, 22, 30, 38, 46, 52, 58].map((c) => c * colW);
  const HEAD = ['no', 'operation', 'from', 'to', 'length', 'width', 'depth', 'where'];
  const ROW = 1.35 * codeFs;
  const tableTop = cursor + 10 * ts;
  const detailChars = Math.floor((svgW - MR - (ML + COLS[1])) / (CHAR * smallFs));
  const detailLines = (t) => {
    const words = String(t || '').split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > detailChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    if (lines.length > 2) { lines.length = 2; lines[1] = `${lines[1].slice(0, Math.max(0, detailChars - 1))}…`; }
    return lines;
  };
  const rowH = (r) => (r.header ? ROW * 1.3 : ROW * (1.2 + 0.95 * detailLines(r.label).length));
  let ty = tableTop + 10 * ts;
  const laid = tableRows.map((r) => { const y = ty + ROW; ty += rowH(r); return { ...r, y }; });
  const titleY = ty + 24 * ts;
  const cut = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const whereChars = Math.max(8, Math.floor((svgW - MR - (ML + COLS[7])) / (CHAR * codeFs)));
  const noteLines = wrapNotes(sheet.notes, svgW - 2 * 30 * ts, codeFs);
  const svgH = titleY + (54 + 18 * noteLines.length) * ts;
  const winName = windowSpec?.name || 'Partition';
  const projNum = projectNumber || '';
  const small = (x, y, text, anchor = 'start', fill = COLORS.subtitle) => (
    <text x={x} y={y} fill={fill} fontSize={smallFs} fontFamily={FONT_FAMILY} textAnchor={anchor} fontWeight={WEIGHTS.subtitle} fillOpacity={0.85}>{text}</text>
  );

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        <defs>
          <pattern id={hatchId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8 * ts} height={8 * ts} fill={C.pocket} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.glass} strokeWidth={1.2 * ts} />
          </pattern>
          <pattern id={cutId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width={8 * ts} height={8 * ts} fill={C.cut} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.label} strokeWidth={1 * ts} strokeOpacity={0.6} />
          </pattern>
        </defs>

        {blocks.map((b, bi) => {
          const it = b.it;
          const L = it.length, F = it.face, D = it.depth;
          const faceName = it.visibleFace === 'room' ? 'ROOM face' : 'FRONT face';
          return (
            <g key={`b${bi}`}>
              {b.rows.map((row) => {
                const X = (x) => ML + (x - row.x0);
                const zTop = (z) => row.topBandY + z;                 // the top band: the front at its top
                const zBot = (z) => row.botBandY + (D - z);           // the bottom band: the front at its bottom
                const bandFor = (edge) => (edge === 'top' ? zTop : zBot);
                const yFace = (y) => row.faceY + y;
                const clipX = (a, c) => [Math.max(a, row.x0), Math.min(c, row.x1)];
                const w = row.x1 - row.x0;
                const first = row.r === 0, last = row.x1 >= L - 0.01;
                const drawFeat = (f, k) => {
                  if (f.draw === 'end') return null;
                  if (f.from != null && (f.to < row.x0 - 0.01 || f.from > row.x1 + 0.01)) return null;
                  const [a, c] = f.from != null ? clipX(f.from, f.to) : [row.x0, row.x1];
                  if (f.draw === 'pocket') return <rect key={k} x={X(a)} y={yFace(f.y0)} width={c - a} height={f.y1 - f.y0} fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />;
                  if (f.draw === 'rebate') return <rect key={k} x={X(a)} y={yFace(f.y0)} width={c - a} height={f.y1 - f.y0} fill={C.rebate} stroke={COLORS.glass} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(4, 3)} />;
                  if (f.draw === 'lip') {
                    const edge = f.y0 === 0 ? 'top' : 'bottom';
                    const z = bandFor(edge);
                    const za = z(0), zb = z(D - f.d);
                    return (
                      <g key={k}>
                        <line x1={X(a)} y1={yFace(f.y0 === 0 ? f.y1 : f.y0)} x2={X(c)} y2={yFace(f.y0 === 0 ? f.y1 : f.y0)} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(8, 3)} />
                        <rect x={X(a)} y={Math.min(za, zb)} width={c - a} height={Math.abs(zb - za)} fill={`url(#${cutId})`} stroke="none" />
                      </g>
                    );
                  }
                  if (f.draw === 'step' || f.draw === 'headReb') {
                    const edge = f.draw === 'headReb' ? 'top' : (f.y < F / 2 ? 'top' : 'bottom');
                    const z = bandFor(edge);
                    const onRoom = f.draw === 'headReb' ? true : f.onRoom;
                    const za = z(onRoom ? f.lip : 0), zb = z(onRoom ? D : D - f.lip);
                    const yl = f.draw === 'headReb' ? f.y1 : f.y;
                    return (
                      <g key={k}>
                        <line x1={X(a)} y1={yFace(yl)} x2={X(c)} y2={yFace(yl)} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(8, 3)} />
                        <rect x={X(a)} y={Math.min(za, zb)} width={c - a} height={Math.abs(zb - za)} fill={`url(#${cutId})`} stroke="none" />
                      </g>
                    );
                  }
                  if (f.draw === 'dowels' || f.draw === 'railHoles') {
                    const z = bandFor(f.edge);
                    return (
                      <g key={k}>
                        {f.draw === 'railHoles' && <rect x={X(a)} y={Math.min(z(0), z(D))} width={c - a} height={D} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(4, 3)} />}
                        {(f.dowels || []).filter((h) => h.x >= row.x0 && h.x <= row.x1).map((h, j) => (
                          <circle key={j} cx={X(h.x)} cy={z(h.depth)} r={(f.dia || derived.partition.dowels.dia) / 2} fill={C.hole} fillOpacity={0.5} stroke={C.hole} strokeWidth={STROKES.sash} {...NS} />
                        ))}
                      </g>
                    );
                  }
                  if (f.draw === 'recess') {
                    const z = bandFor(f.edge);
                    // the descriptor says where the recess starts across the depth (from the front face)
                    const z0 = Number.isFinite(Number(f.z0)) ? Number(f.z0) : 0;
                    const z1 = z0 + f.w;
                    const ya = z(z0), yb = z(z1);
                    return <rect key={k} x={X(a)} y={Math.min(ya, yb)} width={c - a} height={Math.abs(yb - ya)} fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />;
                  }
                  if (f.draw === 'headStop') {
                    const z = zBot;
                    const za = f.face === 'room' ? z(D - f.d) : z(0), zb = f.face === 'room' ? z(D) : z(f.d);
                    return <rect key={k} x={X(a)} y={Math.min(za, zb)} width={c - a} height={Math.abs(zb - za)} fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} strokeDasharray={dash(6, 4)} />;
                  }
                  if (f.draw === 'bore') return <circle key={k} cx={X(f.x)} cy={yFace(f.y)} r={f.r} fill={C.hole} fillOpacity={0.5} stroke={C.hole} strokeWidth={STROKES.sash} {...NS} />;
                  return null;
                };
                // the dim chain of this row: the row ends and every feature edge, centre or bore in the row
                const cuts = [row.x0, row.x1];
                b.feats.forEach((f) => {
                  if (f.draw === 'end' || f.from == null) return;
                  if (f.draw === 'pocket' || f.draw === 'headStop') { cuts.push(f.from, f.to); }
                  else if (f.draw === 'recess' || f.draw === 'bore') cuts.push((f.from + f.to) / 2);
                  // the dowel holes (end and edge) stay out of the chain: the table and the end views carry them
                });
                const uniq = [...new Set(cuts.filter((v) => v >= row.x0 - 0.01 && v <= row.x1 + 0.01).map((v) => R1(v)))].sort((p, q) => p - q);
                return (
                  <g key={`r${row.r}`}>
                    <text x={ML} y={row.capY} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>
                      {first ? `${it.name} · ${it.section} x ${fmt(L)}${it.qty ? ` · ${it.qty} off` : ''}` : `${it.code.replace('W-', '')} · continued`}
                    </text>
                    {!last && small(ML + w, row.dimY + 1.2 * codeFs, `${fmt(row.x0)} to ${fmt(row.x1)} of ${fmt(L)}`, 'end')}
                    {/* the edge bands */}
                    {['top', 'bottom'].map((edge) => {
                      const y0 = edge === 'top' ? row.topBandY : row.botBandY;
                      return (
                        <g key={edge}>
                          <rect x={ML} y={y0} width={w} height={D} fill={C.edge} stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} strokeDasharray={dash(3, 3)} />
                          {small(ML - 8 * ts, y0 + D / 2 + smallFs * 0.35, edge === 'top' ? it.edgeTop : it.edgeBottom, 'end')}
                          {first && small(ML + w + 8 * ts, (edge === 'top' ? zTop(0) : zBot(0)) + smallFs * 0.35, 'front')}
                          {first && small(ML + w + 8 * ts, (edge === 'top' ? zTop(D) : zBot(D)) + smallFs * 0.35, 'room')}
                        </g>
                      );
                    })}
                    {/* the face strip */}
                    <rect x={ML} y={row.faceY} width={w} height={F} fill="rgba(148,163,184,0.04)" stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
                    {small(ML - 8 * ts, row.faceY + F / 2 + smallFs * 0.35, faceName, 'end')}
                    {first && small(ML, row.dimY + 1.2 * codeFs, it.endLeft, 'start')}
                    {last && small(ML + w, row.dimY + 1.2 * codeFs, `${it.endRight}${b.rows.length > 1 ? ` · ${fmt(row.x0)} to ${fmt(L)}` : ''}`, 'end')}
                    {/* the first row: the length over it (the segment of a folded member) and the face width at its right */}
                    {first && <DimH y={row.capY - 1.6 * codeFs} x1={ML} x2={ML + w} extFrom={row.topBandY} label={b.rows.length > 1 ? `${fmt(w)} of ${fmt(L)}` : fmt(L)} vbw={svgW} />}
                    {first && <DimV x={ML + w + 56 * ts} y1={row.faceY} y2={row.faceY + F} extFrom={ML + w + 40 * ts} label={`face ${fmt(F)}`} vbw={svgW} />}
                    {/* the break marks at a folded end */}
                    {!first && <line x1={ML} y1={row.topBandY - 4 * ts} x2={ML} y2={row.botBandY + D + 4 * ts} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(3, 3)} />}
                    {!last && <line x1={ML + w} y1={row.topBandY - 4 * ts} x2={ML + w} y2={row.botBandY + D + 4 * ts} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash(3, 3)} />}
                    {b.feats.map((f, k) => drawFeat(f, k))}
                    {/* callouts above the top band */}
                    {row.callouts.map((c, k) => (
                      <text key={`c${k}`} x={X(c.x) + (c.cx - c.x)} y={row.topBandY - 3 * ts} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{c.no}</text>
                    ))}
                    {uniq.length >= 2 && (
                      <DimChainH y={row.dimY} cuts={uniq.map(X)} extFrom={row.botBandY + D + 2 * ts} vbw={svgW} fmt={fmt} />
                    )}
                  </g>
                );
              })}
              {/* the end faces */}
              {b.ends.filter(Boolean).map((e, k, all) => {
                const s = b.endScale;
                // the end views sit side by side; the pitch leaves room for the wider of the view and its title
                const titleOf = (x) => `${x.no}: ${x.side === 'left' ? it.endLeft : it.endRight} · ${s === Math.round(s) ? s : s.toFixed(1)}:1`;
                const pitch = Math.max(F * s + 60 * ts, ...all.map((x) => titleOf(x).length * CHAR * codeFs + 24 * ts));
                const left = ML + k * pitch;
                const top = b.endTop + 18 * ts;
                const ex = (a) => left + a * s;
                const ez = (z) => top + z * s;
                const up = S.upstand;
                const cutouts = [];
                b.feats.filter((f) => f.draw === 'pocket' && (e.side === 'left' ? f.from <= 0.01 : f.to >= L - 0.01)).forEach((f) => cutouts.push([f.y0, f.y1]));
                b.feats.filter((f) => f.draw === 'rebate').forEach((f) => cutouts.push([f.y0, f.y1]));
                return (
                  <g key={`end${k}`}>
                    <text x={left} y={b.endTop + codeFs * 0.2} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>
                      {titleOf(e)}
                    </text>
                    <rect x={ex(0)} y={ez(0)} width={F * s} height={D * s} fill="rgba(148,163,184,0.04)" stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
                    {cutouts.map(([a0, a1], j) => (
                      <rect key={j} x={ex(a0)} y={ez(up)} width={(a1 - a0) * s} height={(D - up) * s} fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} />
                    ))}
                    {(it.lips || []).map((l, j) => (
                      <rect key={`l${j}`} x={ex(l.y0)} y={ez(0)} width={(l.y1 - l.y0) * s} height={(D - l.d) * s} fill={`url(#${cutId})`} stroke="none" />
                    ))}
                    {e.holes.map((h, j) => (
                      <g key={j}>
                        <circle cx={ex(h.across)} cy={ez(h.depth)} r={(e.dia / 2) * s} fill={C.hole} fillOpacity={0.5} stroke={C.hole} strokeWidth={STROKES.sash} {...NS} />
                        <text x={ex(h.across)} y={ez(h.depth) + smallFs * 0.35} fill={COLORS.title} fontSize={smallFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{j + 1}</text>
                      </g>
                    ))}
                    {small(ex(F) + 6 * ts, ez(0) + smallFs * 0.35, 'front')}
                    {small(ex(F) + 6 * ts, ez(D) + smallFs * 0.35, 'room')}
                    {e.holes.map((h, j) => (
                      <text key={`ht${j}`} x={ex(0)} y={ez(D) + 10 * ts + 1.3 * smallFs * (j + 1)} fill={COLORS.subtitle} fontSize={smallFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle} fillOpacity={0.85}>
                        {`${j + 1}: ${fmt(h.across)} / ${fmt(h.depth)}`}
                      </text>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── the operation table ── */}
        <g>
          {HEAD.map((h, i) => (
            <text key={h} x={ML + COLS[i]} y={tableTop} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{h}</text>
          ))}
          <line x1={ML} y1={tableTop + 6 * ts} x2={svgW - MR} y2={tableTop + 6 * ts} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} />
          {laid.map((r, i) => {
            if (r.header) {
              return <text key={i} x={ML} y={r.y} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{r.header}</text>;
            }
            const cells = [String(r.no), r.kind, r.from != null ? fmt(r.from) : '', r.to != null ? fmt(r.to) : '', r.length != null ? fmt(r.length) : '',
              r.width != null ? fmt(r.width) : '', r.depth != null ? (typeof r.depth === 'number' ? fmt(r.depth) : r.depth) : '', cut(String(r.where || ''), whereChars)];
            return (
              <g key={i}>
                {cells.map((c, j) => (
                  <text key={j} x={ML + COLS[j]} y={r.y} fill={COLORS.title} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{c}</text>
                ))}
                {detailLines(r.label).map((ln, j) => (
                  <text key={`d${j}`} x={ML + COLS[1]} y={r.y + (1.15 + 0.95 * j) * codeFs} fill={COLORS.subtitle} fontSize={smallFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle} fillOpacity={0.85}>{ln}</text>
                ))}
              </g>
            );
          })}
        </g>

        <SheetTitle x={svgW / 2} y={titleY} title={`${sheet.title}${projNum ? ` · ${projNum}` : ''} · ${winName}`} subtitle={sheet.subtitle} notes={noteLines} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
