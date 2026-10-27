/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorLockMachining2D.jsx (Piotr 24.10.2026, redrawn the same evening)
 *
 * The LOCK MACHINING sheets of a door, one sheet per machined edge (the sheet
 * plan passes `band`):
 *   single door   1 the lock stile edge (ThunderBolt), 2 the lock side jamb
 *                 rebate wall (the three keeps);
 *   french door   1 the ACTIVE meeting stile lip edge (ThunderBolt or FGTE
 *                 master), 2 the PASSIVE meeting stile shoulder (the three
 *                 ThunderBolt keeps, or the FGTE slave strip).
 * Each sheet: the edge laid down at true scale (the leaf bottom on the LEFT,
 * the spindle axis the datum) with the plate drawn from the Winkhaus product
 * drawing (engine/hardware/winkhausOutlines.js: the ThunderBolt faceplate with
 * its radius ends, bolt and latch openings and screw holes; the FGTE slave
 * strip with its keeps; the keeps of the BJ Waller data sheets in
 * engine/hardware/winkhausKeeps.js), the pockets hatched over it, the housings
 * and the bores dashed (hidden), then the DETAILS: every machined zone
 * enlarged at one scale (3:1 down to 1.5:1, whatever the sheet width allows)
 * in a lettered window, the positions from the leaf bottom under it, and the
 * table of every cut from the leaf bottom AND from the spindle (the macro
 * datum).
 *
 * Every number comes from derived.door (deriveDoorWindow: leaves[i].machining,
 * jambMachining, meeting, spindleFromLeafBottom), built by
 * engine/doorLockMachining.js; nothing is computed here beyond sheet layout.
 */
import { useMemo } from 'react';
import { DimH, DimV, TitleBlock, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, num, fmtGlass, safely, NoSheet, roleName, handingText } from './doorSheetParts.jsx';
import { THUNDERBOLT_PLATE, FGTE_SLAVE_STRIP } from '../../engine/hardware/winkhausOutlines.js';
import { keepFace } from '../../engine/hardware/winkhausKeeps.js';

// machining numbers print to 0.1 mm (12.2, 1144.5): the macro reads them as they are
const fmt = fmtGlass;

const ROW = 50;              // table row pitch
const CHAR = 0.55;           // the collision rule's character width (x font size)
const SCALES = [3, 2.5, 2, 1.5, 1];
const MAX_ROWS = 2;          // detail windows wrap onto a second row before the scale drops
const CLUSTER_GAP = 110;     // features closer than this share a detail window (mm)
const WIN_MARGIN = 12;       // a detail window reaches this far past its features (mm)

const C = {
  fill: 'rgba(148,163,184,0.05)',
  recess: 'rgba(148,163,184,0.14)',
  plate: 'rgba(148,163,184,0.42)',
  pocket: 'rgba(14,165,233,0.22)',
  keep: 'rgba(234,179,8,0.30)',
  endPlate: 'rgba(148,163,184,0.24)',
};

const OUTLINES = { thunderbolt: THUNDERBOLT_PLATE, 'fgte-slave': FGTE_SLAVE_STRIP };

/** The machined edges of the door in sheet order: the active (or single) leaf, then the passive leaf or the jamb. */
export function machiningBands(dr) {
  if (!dr) return [];
  const leaves = [...(dr.leaves || [])].filter((l) => l.machining);
  const order = { single: 0, active: 0, passive: 1 };
  leaves.sort((a, b) => (order[a.role] ?? 2) - (order[b.role] ?? 2));
  const bands = leaves.map((l) => ({
    key: l.role, m: l.machining, leafH: l.h,
    caption: `${l.role === 'single' ? 'LEAF' : `${roleName(l.role).toUpperCase()} LEAF`}: ${l.machining.edge}`,
  }));
  if (dr.jambMachining) {
    bands.push({ key: 'jamb', m: dr.jambMachining, leafH: leaves[0]?.h ?? dr.leafH, caption: `JAMB ${dr.jambMachining.side === 'left' ? 'L' : 'R'}: ${dr.jambMachining.edge}` });
  }
  return bands;
}

/** The table rows of one edge: [item, from bottom, to, length, width, depth, from spindle]. */
function rowsOf(m) {
  const rows = [];
  const span = (a, b) => `${fmt(a)} to ${fmt(b)}`;
  if (m.faceplate) {
    const f = m.faceplate;
    rows.push([`faceplate recess${f.fullLength ? ' (full height)' : ''}`, fmt(f.fromBottom), fmt(f.toBottom), fmt(f.toBottom - f.fromBottom), fmt(f.width), fmt(f.depth), span(f.from, f.to)]);
  }
  if (m.plate && !m.plate.schematic) {
    const p = m.plate;
    rows.push([`plate ${fmt(p.length)} x ${fmt(p.width)} (drawn)`, fmt(p.fromBottom), fmt(p.toBottom), fmt(p.length), fmt(p.width), '', span(p.from, p.to)]);
  }
  if (m.rodChannel) rows.push([`rod channel (${m.rodChannel.over || 'full height'})`, '', '', '', fmt(m.rodChannel.width), fmt(m.rodChannel.depth), '']);
  (m.pockets || []).forEach((p) => rows.push([`pocket ${p.key}${p.optional ? ' (optional)' : ''}`, fmt(p.fromBottom), fmt(p.toBottom), fmt(p.length), fmt(p.width), fmt(p.depth), span(p.from, p.to)]));
  (m.holes || []).forEach((h) => rows.push([`${h.key} bore, backset ${fmt(h.x)}`, fmt(h.atBottom), '', '', '', '', fmt(h.at)]));
  (m.keeps || []).forEach((k) => {
    rows.push([`${k.code} plate`, fmt(k.plate.fromBottom), fmt(k.plate.toBottom), fmt(k.plate.toBottom - k.plate.fromBottom), fmt(k.plate.width), fmt(k.plate.depth), span(k.plate.from, k.plate.to)]);
    rows.push([`${k.code} pocket`, fmt(k.pocket.fromBottom), fmt(k.pocket.toBottom), fmt(k.pocket.toBottom - k.pocket.fromBottom), fmt(k.pocket.width), fmt(k.pocket.depth), span(k.pocket.from, k.pocket.to)]);
  });
  (m.endPlates || []).forEach((e) => rows.push([`end plate ${e.key}`, fmt(e.fromBottom), fmt(e.toBottom), fmt(e.toBottom - e.fromBottom), fmt(e.width), fmt(e.depth), span(e.from, e.to)]));
  return rows;
}

/**
 * The features of one edge along the leaf (mm from the leaf bottom), each
 * with the label the detail window prints: pockets and keeps as spans, the
 * bores and the plate ends as points.
 */
function featuresOf(m, H) {
  const F = [];
  (m.pockets || []).forEach((p) => F.push({ kind: 'span', name: p.key, x0: p.fromBottom, x1: p.toBottom, label: `${p.key} ${fmt(p.fromBottom)} to ${fmt(p.toBottom)}` }));
  (m.keeps || []).forEach((k) => {
    F.push({ kind: 'point', name: k.code, x0: k.centreBottom, x1: k.centreBottom, label: `${k.code} at ${fmt(k.centreBottom)}`, reach: [k.plate.fromBottom, k.plate.toBottom] });
    F.push({ kind: 'span', name: k.code, x0: k.pocket.fromBottom, x1: k.pocket.toBottom, label: `pocket ${fmt(k.pocket.fromBottom)} to ${fmt(k.pocket.toBottom)}`, quiet: true });
  });
  (m.endPlates || []).forEach((e) => F.push({ kind: 'span', name: e.key, x0: e.fromBottom, x1: e.toBottom, label: `end plate ${fmt(e.fromBottom)} to ${fmt(e.toBottom)}` }));
  (m.holes || []).forEach((h) => F.push({ kind: 'point', name: h.key, x0: h.atBottom, x1: h.atBottom, label: `${h.key} ${fmt(h.atBottom)}`, quiet: true }));
  if (m.plate && !m.plate.schematic) {
    if (m.plate.fromBottom > 0) F.push({ kind: 'point', name: 'plate end', x0: m.plate.fromBottom, x1: m.plate.fromBottom, label: `plate end ${fmt(m.plate.fromBottom)}`, quiet: true });
    if (m.plate.toBottom < H) F.push({ kind: 'point', name: 'plate end', x0: m.plate.toBottom, x1: m.plate.toBottom, label: `plate end ${fmt(m.plate.toBottom)}`, quiet: true });
  }
  return F.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
}

/** Group the features into detail windows: a gap over CLUSTER_GAP starts a new window. */
function clusterFeatures(F, H) {
  const clusters = [];
  for (const f of F) {
    const lo = f.reach ? Math.min(f.x0, f.reach[0]) : f.x0;
    const hi = f.reach ? Math.max(f.x1, f.reach[1]) : f.x1;
    const last = clusters[clusters.length - 1];
    if (last && lo - last.hi < CLUSTER_GAP) {
      last.hi = Math.max(last.hi, hi);
      last.lo = Math.min(last.lo, lo);
      last.items.push(f);
    } else {
      clusters.push({ lo, hi, items: [f] });
    }
  }
  return clusters.map((c, i) => {
    const names = [...new Set(c.items.filter((f) => !f.quiet).map((f) => f.name))].slice(0, 3);
    return {
      letter: String.fromCharCode(65 + i),
      name: names.join(', ') || c.items[0].name,
      x0: Math.max(-10, c.lo - WIN_MARGIN),
      x1: Math.min(H + 10, c.hi + WIN_MARGIN),
      items: c.items,
    };
  });
}

/**
 * Lay the labels of one detail window in rows under it so that no two
 * overlap (the collision rule: font size x 0.55 x characters, 8 units apart):
 * each label wants to sit centred on its feature, moves sideways inside the
 * window when a neighbour is there, and drops a row when the row is full.
 */
function packLabels(items, left, right, fs) {
  const rows = [];
  const out = [];
  const gap = 8;
  for (const it of items) {
    const w = it.label.length * CHAR * fs;
    // a label wider than the window sits centred on it
    const want = w >= right - left ? (left + right) / 2 : Math.min(Math.max(it.cx, left + w / 2), right - w / 2);
    let placed = null;
    for (let r = 0; r < 6 && !placed; r += 1) {
      const row = rows[r] || (rows[r] = []);
      const free = (cx) => row.every((o) => cx + w / 2 + gap <= o.cx - o.w / 2 || cx - w / 2 - gap >= o.cx + o.w / 2);
      if (free(want)) placed = { r, cx: want };
      else {
        // slide right of the rightmost blocker, then left of the leftmost one
        const rightOf = Math.max(...row.map((o) => o.cx + o.w / 2)) + gap + w / 2;
        const leftOf = Math.min(...row.map((o) => o.cx - o.w / 2)) - gap - w / 2;
        if (rightOf + w / 2 <= right && free(rightOf)) placed = { r, cx: rightOf };
        else if (leftOf - w / 2 >= left && free(leftOf)) placed = { r, cx: leftOf };
      }
    }
    if (!placed) placed = { r: rows.length, cx: want };
    (rows[placed.r] || (rows[placed.r] = [])).push({ cx: placed.cx, w });
    out.push({ ...it, row: placed.r, cx: placed.cx, w });
  }
  return { labels: out, rowCount: rows.length };
}

const roundRect = (x0, y0, x1, y1, r) => {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (rr <= 0) return `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}V${y1.toFixed(1)}H${x0.toFixed(1)}Z`;
  const f = (v) => v.toFixed(1);
  return `M${f(x0 + rr)} ${f(y0)}H${f(x1 - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x1)} ${f(y0 + rr)}V${f(y1 - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x1 - rr)} ${f(y1)}H${f(x0 + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x0)} ${f(y1 - rr)}V${f(y0 + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x0 + rr)} ${f(y0)}Z`;
};

const isClosed = (pl) => pl.length > 2 && pl[0][0] === pl[pl.length - 1][0] && pl[0][1] === pl[pl.length - 1][1];

export default function DoorLockMachining2D({ windowSpec, derived, projectNumber, windowTag, band }) {
  const geom = useMemo(() => safely(() => {
    const dr = derived?.door;
    const bands = machiningBands(dr);
    if (!bands.length) return null;
    const idx = Math.max(0, bands.findIndex((b) => b.key === band));
    return { dr, bands, b: bands[idx], index: idx };
  }), [derived, band]);
  if (!geom) return <NoSheet text="No lock machining for this door." />;
  const { dr, bands, b, index } = geom;
  const m = b.m;
  const H = num(b.leafH, 0);

  const ML = 120, MR = 220, MT = 170;
  const svgW = ML + H + MR;
  const ts = svgW / VIEWBOX_REF;
  const codeFs = SIZES.code * ts;
  const labelFs = SIZES.label * ts;
  const X = (x) => ML + x;                                   // the overview: mm from the leaf bottom
  const spindle = num(dr.spindleFromLeafBottom);
  const faceW = num(m.faceWidth, 0) > 0 ? m.faceWidth : num(dr.leafDepth, 57);
  const axis = num(m.datum?.axisFromFace, faceW / 2);
  const cutter = num(m.cutter, 12);
  const outline = m.plate ? OUTLINES[m.plate.outline] : null;

  // ── the detail windows: the clusters of features, all at ONE scale, in at
  // most two rows across the sheet; a window is at least as wide as its widest
  // label (its span grows to fill it), so the labels under it stay inside it
  const features = featuresOf(m, H);
  const clusters = clusterFeatures(features, H);
  const pad = 5 * ts;
  const winGap = 16 * ts;
  const rowLeft = 12 * ts, rowRight = svgW - 44 * ts;          // room for the face width dim right of the row
  const availW = rowRight - rowLeft;
  const labelW = (f) => f.label.length * CHAR * codeFs;
  const widthAt = (c, S) => Math.max((c.x1 - c.x0) * S + 2 * pad, Math.max(...c.items.map(labelW)) + 10 * ts);
  const packRows = (S) => {
    const rows = [[]];
    let used = 0;
    for (const c of clusters) {
      const w = widthAt(c, S);
      const row = rows[rows.length - 1];
      if (row.length && used + winGap + w > availW) { rows.push([c]); used = w; } else { row.push(c); used += (row.length > 1 ? winGap : 0) + w; }
    }
    return rows;
  };
  // one row at 2:1 or better; otherwise the windows wrap onto a second row at the best scale that fits
  const S1 = SCALES.find((s) => packRows(s).length <= 1) ?? 1;
  const S = S1 >= 2 ? S1 : (SCALES.find((s) => packRows(s).length <= MAX_ROWS) ?? 1);
  const rows = packRows(S);

  // ── vertical layout
  const ovTop = MT + 175;                                    // two caption rows above the overview
  const ovH = faceW;                                         // true scale across
  const rowY = (top, r) => top - 10 * ts - r * 1.5 * codeFs;
  const spindleLabelY = ovTop + ovH + 20 * ts;
  const labelPitch = 1.5 * codeFs;
  const detH = faceW * S + 2 * pad;
  // the window title: the letter, the zone name (as many names as fit the window) and the scale
  const titleOf = (v) => {
    const room = Math.floor((v.w - 2 * ts - 1.6 * labelFs - 8 * ts) / (CHAR * codeFs)) - `  ${S}:1`.length;
    const names = v.name.split(', ');
    let name = names[0];
    for (let k = 1; k < names.length; k += 1) {
      if (`${name}, ${names[k]}`.length > room) break;
      name = `${name}, ${names[k]}`;
    }
    if (name.length > room && room > 3) name = name.slice(0, room);
    return `${name}  ${S}:1`;
  };
  // every row: its title baseline, the windows (centred in the row), the labels packed under them
  const views = [];
  let cursorY = spindleLabelY + 32 * ts;
  rows.forEach((row, r) => {
    const widths = row.map((c) => widthAt(c, S));
    const rowW = widths.reduce((a, w) => a + w, 0) + (row.length - 1) * winGap;
    let left = rowLeft + Math.max(0, (availW - rowW) / 2);
    const titleY = cursorY, top = cursorY + 8 * ts;
    const rowViews = row.map((c, i) => {
      const w = widths[i];
      const grow = Math.max(0, w - ((c.x1 - c.x0) * S + 2 * pad)) / S;   // mm added to the span to fill the window
      let x0 = c.x0 - grow / 2, x1 = c.x1 + grow / 2;
      if (x0 < -10) { x1 = Math.min(H + 10, x1 - 10 - x0); x0 = -10; }
      if (x1 > H + 10) { x0 = Math.max(-10, x0 - (x1 - H - 10)); x1 = H + 10; }
      const v = { ...c, x0, x1, S, left, top, pad, w, h: detH, titleY, row: r };
      left += w + winGap;
      return v;
    });
    const labelRow0 = top + detH + 1.6 * codeFs;
    let rowCount = 1;
    rowViews.forEach((v) => {
      const dx = (x) => v.left + v.pad + (x - v.x0) * v.S;
      const items = v.items.map((f) => ({ ...f, cx: dx((f.x0 + f.x1) / 2), lx: dx(f.x0), rx: dx(f.x1) }));
      v.packed = packLabels(items, v.left, v.left + v.w, codeFs);
      v.labelRow0 = labelRow0;
      rowCount = Math.max(rowCount, v.packed.rowCount);
    });
    views.push(...rowViews);
    cursorY = labelRow0 + rowCount * labelPitch + 26 * ts;
  });
  // the face width dim stands right of the widest row (right of the sheet's centre)
  const dimView = views.reduce((best, v) => (!best || v.left + v.w > best.left + best.w ? v : best), null);

  // ── the table under the details
  const colW = CHAR * codeFs;
  const COLS = [0, 33, 41, 49, 57, 64, 71].map((c) => c * colW);
  const HEAD = ['item', 'from', 'to', 'length', 'width', 'depth', 'from spindle'];
  const tableTop = cursorY;                                            // the header baseline
  const tableRows = rowsOf(m);
  const rowBase = tableTop + 10 * ts;                                 // the rows start under the header rule
  const tableH = 10 * ts + (tableRows.length + 1) * ROW;
  const titleY = tableTop + tableH + 14 * ts;

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const titleText = `Lock Machining ${index + 1}/${bands.length}${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `${dr.isFrench ? 'French door' : 'Single door'} · ${handingText(dr)} · ${m.edge}`;
  const meeting = dr.meeting;
  const d0 = m.datum || {};
  // the notes stand in two columns under the title: each line at most NOTE_CHARS
  // characters of the code text, so a column stays inside its half of the sheet
  const NOTE_CHARS = Math.floor((svgW / 2 - ML - 16 * ts) / (CHAR * codeFs));
  const wrap = (t, max = NOTE_CHARS) => {
    const words = String(t).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const faceText = m.edge === 'lock stile'
    ? `face ${fmt(faceW)} wide, the exterior face at the top; lock axis ${fmt(d0.axisFromFace)} from it (centred)`
    : m.edge === 'jamb rebate wall'
      ? `rebate wall drawn ${fmt(faceW)} wide (the leaf depth), the exterior at the top; keeps on the lock axis ${fmt(d0.axisFromFace)}`
      : `face ${fmt(faceW)} wide, the ${d0.axisFace || 'exterior'} face at the top; lock axis ${fmt(d0.axisFromFace)} from it`;
  const axisNote = m.edge === 'lock stile'
    ? `Lock axis ${fmt(d0.axisFromFace)} from the leaf face (centred); backset ${fmt(d0.backset)}; cylinder 92 below the spindle`
    : m.edge === 'jamb rebate wall'
      ? `Keeps centred on the leaf's lock axis ${fmt(d0.axisFromFace)} from the exterior face, on the deadbolt axes and the spindle`
      : `Lock axis ${fmt(d0.axisFromFace)} from the ${d0.axisFace} lip face (margin ${fmt(d0.edgeMargin)} + plate ${fmt(d0.plateWidth)} / 2)${m.fits?.plateToStep != null ? `, ${fmt(m.fits.plateToStep)} between the plate and the step` : ''}; backset ${fmt(d0.backset)}; cylinder 92 below`;
  const plateSource = m.plate?.schematic
    ? 'the plate schematic (see below)'
    : m.plate
      ? `the plate from the Winkhaus product drawing (DXF 24.10.2026): ${outline?.name || m.plate.outline}`
      : 'the keeps from the BJ Waller data sheets (F2402, F24-912W): plate, pocket, bolt windows, screws';
  const notes = [
    ...(meeting && num(meeting.gap, 0) > 0 && m.edge !== 'lock stile' ? [
      `Meeting rebate ${fmt(meeting.rebateWidth)} = lap ${fmt(meeting.overlap)} + gap ${fmt(meeting.gap)}, full height; lips ${fmt(meeting.lipActive)} / ${fmt(meeting.lipPassive)} (the Sections sheet)`,
    ] : []),
    axisNote,
    `Overview 1:1, details ${views.map((v) => v.letter).join(', ')} at ${S}:1 (one scale along and across); pockets hatched, cutter ${fmt(cutter)}; housings and bores dashed (hidden); ${plateSource}`,
    ...(m.notes || []),
  ].filter(Boolean).map((t) => wrap(t));
  // whole paragraphs go to the left column until it holds half the lines
  const noteLines = notes.reduce((a, p) => a + p.length, 0);
  const noteCols = [[], []];
  notes.forEach((p) => { noteCols[noteCols[0].length && noteCols[0].length + p.length > Math.ceil(noteLines / 2) ? 1 : 0].push(...p); });
  const noteX = [ML, svgW / 2 + 8 * ts];
  const svgH = titleY + (44 + 18 * Math.max(noteCols[0].length, noteCols[1].length)) * ts;

  const idBase = String(windowSpec?.id || windowSpec?.name || 'door').replace(/[^a-zA-Z0-9]/g, '_') + `-${b.key}`;
  const hatchId = `hatch-${idBase}`;
  const dash = (a, c) => `${a * ts},${c * ts}`;

  /**
   * One view of the edge: the overview (S 1) or a detail window. Everything is
   * clipped to the material (the leaf between its ends, the face across).
   */
  const renderView = (v, clipId) => {
    const dx = (x) => v.left + v.pad + (x - v.x0) * v.S;
    const dy = (f) => v.top + v.pad + f * v.S;
    const s = (mm) => mm * v.S;
    const lo = Math.max(v.x0, 0), hi = Math.min(v.x1, H);
    const yAxis = dy(axis);
    const el = [];
    // anything that ends before the view or starts after it is left out (the detail windows clip anyway)
    const inView = (a, b) => b >= v.x0 - 1 && a <= v.x1 + 1;
    // the face
    el.push(<rect key="face" x={dx(lo)} y={dy(0)} width={Math.max(0, dx(hi) - dx(lo))} height={s(faceW)} fill={C.fill} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />);
    // the faceplate recess (or the keep rail recess)
    if (m.faceplate) {
      const f = m.faceplate;
      el.push(<rect key="recess" x={dx(f.fromBottom)} y={dy(axis - f.width / 2)} width={s(f.toBottom - f.fromBottom)} height={s(f.width)} fill={C.recess} stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} />);
    }
    (m.endPlates || []).filter((e) => inView(e.fromBottom, e.toBottom)).forEach((e) => el.push(
      <rect key={e.key} x={dx(e.fromBottom)} y={dy(axis - e.width / 2)} width={s(e.toBottom - e.fromBottom)} height={s(e.width)} fill={C.endPlate} stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} />,
    ));
    // the rod channel under the plate: hidden lines
    if (m.rodChannel && m.faceplate) {
      const f = m.faceplate, hw = m.rodChannel.width / 2;
      [-hw, hw].forEach((o, i) => el.push(
        <line key={`rod${i}`} x1={dx(f.fromBottom)} y1={dy(axis + o)} x2={dx(f.toBottom)} y2={dy(axis + o)} stroke={COLORS.meeting} strokeWidth={STROKES.sashLight} strokeDasharray={dash(3, 3)} {...NS} />,
      ));
    }
    // the pockets, hatched, the cutter radius in the corners
    (m.pockets || []).filter((p) => inView(p.fromBottom, p.toBottom)).forEach((p) => el.push(
      <path key={p.key} d={roundRect(dx(p.fromBottom), dy(axis - p.width / 2), dx(p.toBottom), dy(axis + p.width / 2), s(Math.min(cutter / 2, p.width / 2)))}
        fill={`url(#${hatchId})`} stroke={p.optional ? COLORS.sillDetail : COLORS.sash} strokeWidth={STROKES.sash} strokeDasharray={p.optional ? dash(6, 4) : undefined} {...NS} />,
    ));
    // the keeps: pocket (hatched slot), plate with its bolt windows cut out, screws
    (m.keeps || []).filter((k) => inView(k.plate.fromBottom, k.plate.toBottom)).forEach((k) => {
      const face = keepFace(k.code);
      const ref = k.centreBottom;
      const pw = k.pocket.width, plw = k.plate.width;
      el.push(<path key={`${k.key}-pk`} d={roundRect(dx(k.pocket.fromBottom), dy(axis - pw / 2), dx(k.pocket.toBottom), dy(axis + pw / 2), s(num(k.pocket.endRadius, 6)))}
        fill={`url(#${hatchId})`} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />);
      const yTop = axis - plw / 2;
      const plateD = roundRect(dx(k.plate.fromBottom), dy(yTop), dx(k.plate.toBottom), dy(yTop + plw), s(num(k.plate.endRadius, 12)));
      if (!face) {
        el.push(<path key={`${k.key}-pl`} d={plateD} fill={C.keep} stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} />);
        return;
      }
      const winD = face.windows.map((w) => roundRect(dx(ref + w.x0), dy(yTop + w.y0), dx(ref + w.x1), dy(yTop + w.y1), s(w.corner))).join('');
      el.push(<path key={`${k.key}-pl`} d={plateD + winD} fillRule="evenodd" fill={C.keep} stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} />);
      face.screws.forEach(([sx, sy], i) => el.push(
        <g key={`${k.key}-s${i}`}>
          <circle cx={dx(ref + sx)} cy={dy(yTop + sy)} r={s(face.screw.countersink)} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sashLight} {...NS} />
          <circle cx={dx(ref + sx)} cy={dy(yTop + sy)} r={s(face.screw.hole)} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} />
        </g>,
      ));
      face.adjusters.forEach(([ax, ay], i) => el.push(
        <circle key={`${k.key}-a${i}`} cx={dx(ref + ax)} cy={dy(yTop + ay)} r={s(face.adjuster.radius)} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} />,
      ));
    });
    // the plate: the Winkhaus outline at its place, or the schematic master plate
    if (m.plate && outline) {
      const pb = m.plate.fromBottom;                         // the plate's bottom end on the leaf
      const yTop = axis - outline.width / 2;
      const tx = (x) => dx(pb + x), ty = (y) => dy(yTop + y);
      const shown = outline.polys.filter((pl) => inView(pb + Math.min(...pl.map((p) => p[0])), pb + Math.max(...pl.map((p) => p[0]))));
      const closed = shown.filter(isClosed);
      const open = shown.filter((pl) => !isClosed(pl));
      const toD = (pl) => pl.map((p, i) => `${i ? 'L' : 'M'}${tx(p[0]).toFixed(1)} ${ty(p[1]).toFixed(1)}`).join('');
      if (closed.length) el.push(<path key="plate-loops" d={closed.map(toD).join('')} fillRule="evenodd" fill={C.plate} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />);
      if (open.length) el.push(<path key="plate-lines" d={open.map(toD).join('')} fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} />);
      outline.circles.filter(([cx, , r]) => inView(pb + cx - r, pb + cx + r)).forEach(([cx, cy, r], i) => el.push(
        <circle key={`pc${i}`} cx={tx(cx)} cy={ty(cy)} r={s(r)} fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} />,
      ));
      // the housings behind the plate (hidden)
      (outline.housings || []).filter((hs) => inView(pb + hs.x0, pb + hs.x1)).forEach((hs) => el.push(
        <rect key={hs.key} x={tx(hs.x0)} y={dy(axis - hs.thickness / 2)} width={s(hs.x1 - hs.x0)} height={s(hs.thickness)} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.sash} strokeDasharray={dash(5, 3)} {...NS} />,
      ));
    } else if (m.plate?.schematic) {
      const p = m.plate;
      const yTop = axis - p.width / 2;
      const hooks = (m.pockets || []).filter((pk) => /hook/.test(pk.key)).map((pk) => (pk.fromBottom + pk.toBottom) / 2);
      const wins = [
        ...hooks.map((hx) => roundRect(dx(hx - 26), dy(axis - 4.5), dx(hx + 26), dy(axis + 4.5), s(1))),
        ...(spindle != null ? [
          roundRect(dx(spindle + 25.5 - 15.2), dy(axis - 5.2), dx(spindle + 25.5 + 15.2), dy(axis + 5.2), s(1)),
          roundRect(dx(spindle - 70 - 15.2), dy(axis - 3.2), dx(spindle - 70 + 15.2), dy(axis + 3.2), s(1)),
        ] : []),
      ].join('');
      el.push(<path key="plate-schematic" d={roundRect(dx(p.fromBottom), dy(yTop), dx(p.toBottom), dy(yTop + p.width), 0) + wins} fillRule="evenodd" fill={C.plate} stroke={COLORS.sash} strokeWidth={STROKES.sash} strokeDasharray={dash(8, 4)} {...NS} />);
    }
    // the bores through the leaf at the backset (hidden): the 8 follower square, the PZ cylinder
    (m.holes || []).filter((h) => inView(h.atBottom - 30, h.atBottom + 30)).forEach((h) => {
      const cx = dx(h.atBottom);
      if (h.key === 'spindle') {
        el.push(<rect key={h.key} x={cx - s(4)} y={yAxis - s(4)} width={s(8)} height={s(8)} fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} strokeDasharray={dash(4, 3)} {...NS} />);
      } else {
        const r = 8.5, slot = 5, down = 33 - r;
        const f = (q) => q.toFixed(1);
        const d = `M${f(cx)} ${f(yAxis - s(r))}A${f(s(r))} ${f(s(r))} 0 0 1 ${f(cx)} ${f(yAxis + s(r))}A${f(s(r))} ${f(s(r))} 0 0 1 ${f(cx)} ${f(yAxis - s(r))}Z`
          + `M${f(cx)} ${f(yAxis - s(slot))}H${f(cx - s(down))}V${f(yAxis + s(slot))}H${f(cx)}`;
        el.push(<path key={h.key} d={d} fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} strokeDasharray={dash(4, 3)} {...NS} />);
      }
    });
    // the leaf ends
    if (v.x0 <= 0) el.push(<line key="end0" x1={dx(0)} y1={dy(0) - 3 * ts} x2={dx(0)} y2={dy(faceW) + 3 * ts} stroke={COLORS.sash} strokeWidth={STROKES.frame} {...NS} />);
    if (v.x1 >= H) el.push(<line key="endH" x1={dx(H)} y1={dy(0) - 3 * ts} x2={dx(H)} y2={dy(faceW) + 3 * ts} stroke={COLORS.sash} strokeWidth={STROKES.frame} {...NS} />);
    // the spindle datum through the view
    if (spindle != null && spindle >= v.x0 && spindle <= v.x1) {
      el.push(<line key="datum" x1={dx(spindle)} y1={dy(0) - 6 * ts} x2={dx(spindle)} y2={dy(faceW) + 6 * ts} stroke={COLORS.meeting} strokeWidth={STROKES.center} strokeDasharray={dash(8, 3) + ',' + dash(2, 3)} {...NS} />);
    }
    return (
      <g clipPath={`url(#${clipId})`}>
        {el}
      </g>
    );
  };

  const overview = { x0: -10, x1: H + 10, S: 1, left: X(-10), top: ovTop, pad: 0 };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        <defs>
          <pattern id={hatchId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8 * ts} height={8 * ts} fill={C.pocket} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.glass} strokeWidth={1.2 * ts} />
          </pattern>
          <clipPath id={`clip-${idBase}-ov`}>
            <rect x={X(-10)} y={ovTop - 10 * ts} width={H + 20} height={ovH + 20 * ts} />
          </clipPath>
          {views.map((v) => (
            <clipPath key={v.letter} id={`clip-${idBase}-${v.letter}`}>
              <rect x={v.left} y={v.top} width={v.w} height={v.h} />
            </clipPath>
          ))}
        </defs>
        {/* the leaf height along the overview (the overall width of this sheet, at the top) */}
        <DimH y={MT - 80} x1={X(0)} x2={X(H)} extFrom={ovTop} label={fmt(H)} vbw={svgW} />
        {/* captions above the overview: the edge and its kit, then the face */}
        <text x={X(0) + 6 * ts} y={rowY(ovTop, 2)} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{`${b.caption} · ${m.kit}`}</text>
        <text x={X(0) + 6 * ts} y={rowY(ovTop, 1)} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{faceText}</text>
        {/* the overview at true scale */}
        {renderView(overview, `clip-${idBase}-ov`)}
        {/* the detail callouts on the overview */}
        {views.map((v) => (
          <g key={`co-${v.letter}`}>
            <rect x={X(Math.max(v.x0, -10))} y={ovTop - 4 * ts} width={Math.min(v.x1, H + 10) - Math.max(v.x0, -10)} height={ovH + 8 * ts} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sash} strokeDasharray={dash(4, 3)} {...NS} />
            <text x={X((Math.max(v.x0, 0) + Math.min(v.x1, H)) / 2)} y={ovTop - 8 * ts} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.title}>{v.letter}</text>
          </g>
        ))}
        {spindle != null && (
          <text x={X(spindle)} y={spindleLabelY} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{`spindle ${fmt(spindle)} above the leaf bottom`}</text>
        )}
        {/* the details */}
        {views.map((v) => {
          const dx = (x) => v.left + v.pad + (x - v.x0) * v.S;
          return (
            <g key={`win-${v.letter}`}>
              <text x={v.left + 2 * ts} y={v.titleY} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.title}>{v.letter}</text>
              <text x={v.left + 2 * ts + 1.6 * labelFs} y={v.titleY} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{titleOf(v)}</text>
              {renderView(v, `clip-${idBase}-${v.letter}`)}
              <rect x={v.left} y={v.top} width={v.w} height={v.h} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
              {v.packed.labels.map((l, k) => {
                const y = v.labelRow0 + l.row * labelPitch;
                const lineTop = y - 0.95 * codeFs;
                return (
                  <g key={`lb${k}`}>
                    {l.kind === 'span'
                      ? (
                        <g>
                          <line x1={Math.max(v.left, l.lx)} y1={lineTop} x2={Math.min(v.left + v.w, l.rx)} y2={lineTop} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />
                          <line x1={Math.max(v.left, l.lx)} y1={lineTop - 3 * ts} x2={Math.max(v.left, l.lx)} y2={lineTop} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />
                          <line x1={Math.min(v.left + v.w, l.rx)} y1={lineTop - 3 * ts} x2={Math.min(v.left + v.w, l.rx)} y2={lineTop} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />
                        </g>
                      )
                      : <line x1={dx(l.x0)} y1={v.top + v.h} x2={l.cx} y2={lineTop} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />}
                    <text x={l.cx} y={y} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{l.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* the face width across a detail, rotated, right of the widest row */}
        {dimView && (
          <DimV x={dimView.left + dimView.w + 20 * ts} y1={dimView.top + dimView.pad} y2={dimView.top + dimView.pad + faceW * S} extFrom={dimView.left + dimView.w} label={`${fmt(faceW)} face`} vbw={svgW} />
        )}
        {/* the table */}
        <g>
          {HEAD.map((h, c) => (
            <text key={`h${c}`} x={ML + COLS[c]} y={tableTop} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{h}</text>
          ))}
          <line x1={ML} y1={tableTop + 5 * ts} x2={ML + COLS[6] + 14 * colW} y2={tableTop + 5 * ts} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />
          {tableRows.map((r, k) => {
            const y = rowBase + (k + 1) * ROW;
            return r.map((cell, c) => (cell ? (
              <text key={`r${k}c${c}`} x={ML + COLS[c]} y={y} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{cell}</text>
            ) : null));
          })}
        </g>
        <TitleBlock x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={svgW} />
        {noteCols.map((col, c) => col.map((t, i) => (
          <text key={`n${c}-${i}`} x={noteX[c]} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{t}</text>
        )))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
