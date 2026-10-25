/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * PartitionSection2D.jsx (25.10.2026): the Sections sheet of a partition wall.
 *
 * Top: the PLAN of the wall at 1:1 (a horizontal section through the glazed
 * zone, the FRONT / corridor face at the bottom of the page, the room above):
 * the end boards, the posts with their stopped pockets and the lock post's
 * stop lip, the units (panes, spacer edges, the cavity open), the beads, the
 * door leaf closed in its opening (hinge stile, lock stile core and lip), the
 * hinge knuckle and a dashed swing arc clipped to a band under the plan. The
 * overall width at the top, the depth and the board width on the right, the
 * field chain along the bottom.
 * Then PLAN DETAIL windows (end post, hinge post + leaf, lock post + stop, a
 * post between two screens) and VERTICAL SECTION detail windows (screen head,
 * bar, mid rail, floor; door head, floor), all clipped re-renders of the
 * geometry of partitionDrawUtils at ONE scale S from [3, 2.5, 2, 1.5], the
 * horizontal dimensions in rows under each window and the depth / height
 * dimensions in columns beside it (every row and column packed so that no two
 * labels meet). Vertical windows: y down the page, the front at the LEFT.
 * Below: the title block with the section, door, bar and board rules.
 *
 * Every number comes from derived.partition (through partitionPlanGeometry and
 * partitionVerticalSection); the only literals are drawing sizes in sheet
 * units (margins, paddings, row pitches). The plan keeps the dimension rule of
 * the main view (the width at the top, the depths on the right, the field
 * chain along its bottom); the detail windows carry their own chains under
 * them wherever they fall, so the "chains in the lower half" clause of the
 * elevation harness does not apply to this multi-detail sheet (no top pad).
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, SheetTitle, idOf } from './doorSheetParts.jsx';
import { partitionPlanGeometry, partitionVerticalSection } from './partitionDrawUtils.js';

const CHAR = 0.55;                      // the collision rule's character width (x font size)
const SCALES = [3, 2.5, 2, 1.5];        // detail scales, the largest that fits wins
const MAX_ROWS = 2;                     // plan detail windows wrap onto a second row before the scale drops
const ML_T = 46, MR_T = 80;             // sheet margins in text units (ts): room for the board dim at the left, two DimV at the right

const STYLE = {
  member: { fo: 0.16, stroke: COLORS.frame, sw: STROKES.section },
  board: { fo: 0.10, stroke: COLORS.frame, sw: STROKES.section },
  leaf: { fo: 0.08, stroke: COLORS.sash, sw: STROKES.sash },
  stop: { fo: 0.24, stroke: COLORS.frame, sw: STROKES.section },
  bar: { fo: 0.16, stroke: COLORS.sash, sw: STROKES.sash },
  panel: { fo: 0.12, stroke: COLORS.frame, sw: STROKES.section },
  bead: { fo: 0.05, stroke: COLORS.sash, sw: STROKES.sash },
};

const fin = (v) => Number.isFinite(Number(v));
const span = (a, b, label) => ({ a: Math.min(a, b), b: Math.max(a, b), label: String(label) });

/** The drawable parts of the plan: solids by kind, the glazing parts, the knuckles. */
function sceneOfPlan(plan) {
  const solids = [], glazings = [], knuckles = [];
  plan.members.forEach((m) => solids.push({ kind: m.kind === 'board' ? 'board' : 'member', pts: m.pts }));
  plan.glazing.forEach((g) => glazings.push(g));
  plan.leaves.forEach((l) => {
    solids.push({ kind: 'leaf', pts: l.hingeStile }, { kind: 'leaf', pts: l.lockStile.core }, { kind: 'leaf', pts: l.lockStile.lip });
    glazings.push(l.glazing);
    knuckles.push(l.knuckle);
  });
  return { solids, glazings, knuckles, dummies: [] };
}

/** The drawable parts of a vertical section (points are [y, z]). */
function sceneOfVertical(v) {
  const solids = [], glazings = [], dummies = [];
  const kindOf = (k) => (k === 'head' ? 'board' : k === 'headStop' ? 'stop' : k.startsWith('leaf') ? 'leaf' : 'member');
  v.members.forEach((m) => {
    solids.push({ kind: kindOf(m.kind), pts: m.pts });
    if (m.lip) solids.push({ kind: 'leaf', pts: m.lip });
  });
  v.glazing.forEach((g) => glazings.push(g));
  v.bars.forEach((br) => { solids.push({ kind: 'bar', pts: br.front }, { kind: 'bar', pts: br.room }); dummies.push(br.dummy); });
  v.panels.forEach((pn) => {
    solids.push({ kind: 'panel', pts: pn.pts });
    pn.beads.forEach((bd) => solids.push({ kind: 'bead', pts: bd }));
  });
  return { solids, glazings, knuckles: [], dummies };
}

/**
 * Pack dimension spans (mm along one axis, with their label text) into rows so
 * that in one row no two spans overlap and no two label boxes meet (a label box
 * is chars x CHAR x fs wide, centred on its span at scale S). Touching spans in
 * a row read as a chain.
 */
function packSpans(spans, S, fs, clear) {
  const items = (spans || []).filter((s) => fin(s.a) && fin(s.b) && s.b - s.a > 0.01 && s.label !== '')
    .sort((p, q) => p.a - q.a || p.b - q.b);
  const rows = [];
  items.forEach((it) => {
    const mid = ((it.a + it.b) / 2) * S;
    const half = (it.label.length * CHAR * fs) / 2 + clear;
    const box = [mid - half, mid + half];
    let row = rows.find((r) => r.every((o) => (o.b <= it.a + 0.01 || o.a >= it.b - 0.01) && (o.box[1] <= box[0] || o.box[0] >= box[1])));
    if (!row) { row = []; rows.push(row); }
    row.push({ ...it, box });
  });
  return rows.map((r) => r.sort((p, q) => p.a - q.a));
}

/** Touching spans of a packed row grouped into chains: [[span, span, ...], ...]. */
function chainsOf(row) {
  const out = [];
  row.forEach((s) => {
    const last = out[out.length - 1];
    if (last && Math.abs(last[last.length - 1].b - s.a) < 0.01) last.push(s); else out.push([s]);
  });
  return out;
}

/** The plan detail windows: { key, title, u0, u1, v0, v1, hS, vS } (u = wall x, v = depth z). */
function planWindows(plan) {
  const pw = plan.pw, S = pw.section, D = plan.depth, reb = S.rebate, b = pw.members.board;
  const padZ = D * 0.2, padX = D * 0.3;
  const v0 = plan.z0 - padZ, v1 = plan.z1 + padZ;
  const post = (i) => plan.members.find((m) => m.kind === 'post' && m.i === i);
  const glazingAt = (x) => plan.glazing.find((g) => Math.abs(g.a0 - x) < 0.01 || Math.abs(g.a1 - x) < 0.01);
  const wins = [];
  const p0 = post(0), pp0 = pw.posts[0];
  if (p0 && pp0) {
    const g = glazingAt(p0.x1);
    const hS = [span(0, b, fmt(b)), span(p0.x0, p0.x1, fmt(p0.x1 - p0.x0))];
    if (pp0.rebated.right) hS.push(span(p0.x1 - reb, p0.x1, fmt(reb)));
    if (g) hS.push(span(g.a0 - S.glassIn, g.a0, fmt(S.glassIn)));
    const vS = [span(0, D, fmt(D)), span(-plan.proud, D + plan.proud, fmt(pw.boardWidth)),
      span(0, S.upstand, fmt(S.upstand)), span(S.upstand, S.upstand + S.zoneDepth, fmt(S.zoneDepth)), span(D - S.bead.t, D, fmt(S.bead.t))];
    wins.push({ key: 'end', title: pp0.role === 'end' ? 'END POST P1 (left)' : 'LEFT END: BOARD + P1', u0: -padX, u1: p0.x1 + (g ? 2 * reb : padX), v0, v1, hS, vS });
  }
  pw.doors.forEach((d) => {
    const lf = plan.leaves.find((l) => l.n === d.n);
    if (!lf) return;
    const hp = post(d.hinges.post), lp = post(d.latch.post);
    const st = d.members.stile, hingeLeft = d.hingeSide === 'left';
    const dayA0 = lf.x0 + st, dayA1 = lf.x1 - st;
    if (hp) {
      const dayEdge = hingeLeft ? dayA0 : dayA1;
      const gap = hingeLeft ? lf.x0 - hp.x1 : hp.x0 - lf.x1;
      const hS = [span(hp.x0, hp.x1, fmt(hp.x1 - hp.x0)),
        hingeLeft ? span(hp.x1, lf.x0, fmt(gap)) : span(lf.x1, hp.x0, fmt(gap)),
        hingeLeft ? span(lf.x0, dayA0, fmt(st)) : span(dayA1, lf.x1, fmt(st)),
        hingeLeft ? span(dayA0 - reb, dayA0, fmt(reb)) : span(dayA1, dayA1 + reb, fmt(reb)),
        hingeLeft ? span(dayA0 - S.glassIn, dayA0, fmt(S.glassIn)) : span(dayA1, dayA1 + S.glassIn, fmt(S.glassIn))];
      const k = lf.knuckle;
      const vS = [span(k.z - k.r, k.z + k.r, fmt(d.hinges.knuckle))];
      wins.push({ key: `hinge${d.n}`, title: `HINGE POST P${hp.i + 1} + LEAF D${d.n}`,
        u0: hingeLeft ? hp.x0 - padX : dayEdge - 2 * reb, u1: hingeLeft ? dayEdge + 2 * reb : hp.x1 + padX, v0, v1, hS, vS });
    }
    if (lp) {
      const lockEdge = hingeLeft ? lf.x1 : lf.x0;
      const dayEdge = hingeLeft ? dayA1 : dayA0;
      const lipW = d.lockEdge.rebate.w;
      const coreEdge = hingeLeft ? lockEdge - lipW : lockEdge + lipW;
      const postEdge = hingeLeft ? lp.x0 : lp.x1;
      const stopInner = hingeLeft ? lp.x0 - d.stop.w : lp.x1 + d.stop.w;
      const hS = [span(lp.x0, lp.x1, fmt(lp.x1 - lp.x0)), span(coreEdge, lockEdge, fmt(lipW)), span(lockEdge, postEdge, fmt(Math.abs(postEdge - lockEdge))),
        span(stopInner, postEdge, fmt(d.stop.w)), span(coreEdge, stopInner, fmt(Math.abs(stopInner - coreEdge))),
        span(dayEdge, lockEdge, fmt(st)),
        hingeLeft ? span(dayA1, dayA1 + reb, fmt(reb)) : span(dayA0 - reb, dayA0, fmt(reb)),
        hingeLeft ? span(dayA1, dayA1 + S.glassIn, fmt(S.glassIn)) : span(dayA0 - S.glassIn, dayA0, fmt(S.glassIn))];
      const lip = d.lockEdge.lip;
      const vS = [d.swingFace === 'front' ? span(0, lip, fmt(lip)) : span(D - lip, D, fmt(lip)),
        d.swingFace === 'front' ? span(lip, D, fmt(d.lockEdge.rebate.d)) : span(0, D - lip, fmt(d.lockEdge.rebate.d)),
        d.stopFace === 'room' ? span(D - d.stop.d, D, fmt(d.stop.d)) : span(0, d.stop.d, fmt(d.stop.d))];
      wins.push({ key: `lock${d.n}`, title: `LOCK POST P${lp.i + 1} + STOP · D${d.n}`,
        u0: hingeLeft ? dayEdge - 2 * reb : lp.x0 - padX, u1: hingeLeft ? lp.x1 + padX : dayEdge + 2 * reb, v0, v1, hS, vS });
    }
  });
  pw.posts.filter((p) => p.role === 'mullion').slice(0, 1).forEach((p) => {
    const m = post(p.i);
    if (!m) return;
    const hS = [span(m.x0, m.x1, fmt(m.x1 - m.x0)), span(m.x0, m.x0 + reb, fmt(reb)), span(m.x1 - reb, m.x1, fmt(reb))];
    const vS = [span(0, D, fmt(D)), span(S.upstand, D, fmt(S.pocketDepth))];
    wins.push({ key: `mull${p.i}`, title: `POST P${p.i + 1} BETWEEN SCREENS`, u0: m.x0 - 2 * reb, u1: m.x1 + 2 * reb, v0, v1, hS, vS });
  });
  return wins;
}

/** The vertical section windows (u = depth z, v = wall y), each with its source section. */
function verticalWindows(vs, vd, pw) {
  const S = pw.section, D = pw.depth, reb = S.rebate, b = pw.members.board, up = S.upstand, bt = pw.members.barThickness;
  const proud = (pw.boardWidth - D) / 2;
  const padZ = D * 0.2, padY = D * 0.2;
  const zr = { u0: -proud - padZ, u1: D + proud + padZ };
  const depthSpans = [span(0, up, fmt(up)), span(up, up + S.zoneDepth, fmt(S.zoneDepth)), span(D - S.bead.t, D, fmt(S.bead.t))];
  const wins = [];
  const tr = pw.topRail;
  if (vs && pw.screens[0]) {
    const s = pw.screens[0], gz = vs.glazing[0]?.z;
    const zone = s.zone;
    wins.push({ key: 'sHead', title: 'SCREEN: HEAD', src: vs, ...zr, v0: -padY, v1: zone.y + 3 * reb + padY,
      vS: [span(0, b, fmt(b)), span(tr.y, tr.y + tr.h, fmt(tr.h)), span(tr.y + tr.h - reb, tr.y + tr.h, fmt(reb)), span(zone.y - S.glassIn, zone.y, fmt(S.glassIn))],
      hS: [...depthSpans] });
    const br = s.bars[0];
    if (br && gz) {
      wins.push({ key: 'sBar', title: 'SCREEN: BAR', src: vs, ...zr, v0: br.y - 2 * reb, v1: br.y + br.h + 2 * reb,
        vS: [span(br.y, br.y + br.h, fmt(br.h))],
        hS: [span(-bt, 0, fmt(bt)), span(D, D + bt, fmt(bt)), span(gz.glass0, gz.glass1, fmt(S.unit))] });
    }
    if (s.midRail && s.panel) {
      const mr = s.midRail, t = s.panel.size.t;
      wins.push({ key: 'sMid', title: 'SCREEN: MID RAIL', src: vs, ...zr, v0: mr.y - 2 * reb - padY, v1: mr.y + mr.h + 2 * reb + padY,
        vS: [span(mr.y, mr.y + mr.h, fmt(mr.h)), span(mr.y, mr.y + reb, fmt(reb)), span(mr.y + mr.h - reb, mr.y + mr.h, fmt(reb)), span(mr.y + reb, mr.y + mr.h - reb, fmt(mr.h - 2 * reb))],
        hS: [span(0, up, fmt(up)), span(up, up + t, fmt(t)), span(D - S.bead.t, D, fmt(S.bead.t))] });
    }
    const bl = s.bottomRail;
    wins.push({ key: 'sFloor', title: 'SCREEN: FLOOR', src: vs, ...zr, v0: bl.y - 2 * reb - padY, v1: vs.floorY + padY, floorY: vs.floorY,
      vS: [span(bl.y, bl.y + bl.h, fmt(bl.h)), span(bl.y, bl.y + reb, fmt(reb))],
      hS: s.panel ? [span(up, up + s.panel.size.t, fmt(s.panel.size.t)), span(D - S.bead.t, D, fmt(S.bead.t))] : (gz ? [span(gz.glass0, gz.glass1, fmt(S.unit))] : []) });
  }
  if (vd && pw.doors[0]) {
    const d = pw.doors[0], ld = d.leaf.depth, gz = vd.glazing[0]?.z;
    const hs = d.stop.head, he = d.headEdge, lip = d.lockEdge.lip;
    const dt = d.topRail;
    wins.push({ key: 'dHead', title: 'DOOR: HEAD', src: vd, ...zr, v0: -padY, v1: dt.y + dt.h + 2 * reb + padY,
      vS: [span(0, b, fmt(b)), span(tr.y, tr.y + tr.h, fmt(tr.h)), span(tr.y + tr.h, d.leaf.y, fmt(d.leaf.y - tr.y - tr.h)), span(dt.y, dt.y + dt.h, fmt(dt.h)),
        ...(hs ? [span(tr.y + tr.h, tr.y + tr.h + hs.w, fmt(hs.w))] : []),
        ...(he ? [span(dt.y, dt.y + he.rebate.w, fmt(he.rebate.w))] : []),
        span(dt.y + dt.h - reb, dt.y + dt.h, fmt(reb))],
      hS: [...(hs ? [d.stopFace === 'room' ? span(D - hs.d, D, fmt(hs.d)) : span(0, hs.d, fmt(hs.d))] : []),
        ...(he ? [d.swingFace === 'front' ? span(0, lip, fmt(lip)) : span(ld - lip, ld, fmt(lip)),
          d.swingFace === 'front' ? span(lip, ld, fmt(he.rebate.d)) : span(0, ld - lip, fmt(he.rebate.d))] : [])] });
    const bl = d.bottomRail;
    wins.push({ key: 'dFloor', title: 'DOOR: FLOOR', src: vd, ...zr, v0: bl.y - 2 * reb - padY, v1: vd.floorY + padY, floorY: vd.floorY,
      vS: [span(bl.y, bl.y + bl.h, fmt(bl.h)), span(vd.leafBottomY, vd.floorY, fmt(vd.floorY - vd.leafBottomY)), span(bl.y, bl.y + reb, fmt(reb))],
      hS: d.panel ? [span(up, up + d.panel.size.t, fmt(d.panel.size.t)), span(ld - S.bead.t, ld, fmt(S.bead.t))] : (gz ? [span(gz.glass0, gz.glass1, fmt(S.unit))] : []) });
  }
  return wins;
}

/** Draw a scene through the point mapper P ([a, z] -> [px, py]); sc = sheet units per mm. */
function drawScene(scene, P, sc, keyPrefix) {
  const poly = (pts) => `M ${pts.map((p) => P(p).map((v) => v.toFixed(2)).join(' ')).join(' L ')} Z`;
  const el = [];
  scene.solids.forEach((s, i) => {
    const st = STYLE[s.kind] || STYLE.member;
    el.push(<path key={`${keyPrefix}s${i}`} d={poly(s.pts)} fill={COLORS.sectionFill} fillOpacity={st.fo} stroke={st.stroke} strokeWidth={st.sw} {...NS} />);
  });
  scene.glazings.forEach((g, i) => {
    g.panes.forEach((pn, k) => el.push(
      <path key={`${keyPrefix}g${i}p${k}`} d={poly(pn)} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity} stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />));
    g.spacerEdges.forEach((se, k) => el.push(
      <path key={`${keyPrefix}g${i}e${k}`} d={poly(se)} fill={COLORS.bar} fillOpacity={0.35} stroke={COLORS.bar} strokeWidth={STROKES.glassLight} {...NS} />));
    g.beads.forEach((bd, k) => el.push(
      <path key={`${keyPrefix}g${i}b${k}`} d={poly(bd)} fill={COLORS.sectionFill} fillOpacity={STYLE.bead.fo} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />));
  });
  scene.dummies.forEach((dm, i) => el.push(
    <path key={`${keyPrefix}d${i}`} d={poly(dm)} fill={COLORS.bar} fillOpacity={0.2} stroke={COLORS.bar} strokeWidth={STROKES.glassLight} {...NS} strokeDasharray="3,2" />));
  scene.knuckles.forEach((k, i) => {
    const [cx, cy] = P([k.x, k.z]);
    el.push(<circle key={`${keyPrefix}k${i}`} cx={cx} cy={cy} r={k.r * sc} fill={COLORS.sectionFill} fillOpacity={0.3} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />);
  });
  return el;
}

/**
 * One detail window at (left, top), scale S: the caption, the clipped scene,
 * the horizontal dimensions in rows under it, the vertical ones in columns at
 * its right. flip = false: plan (u = a, v = z, v up the page); flip = true:
 * vertical section (u = z, v = a, v down the page).
 */
function DetailWindow({ win, scene, flip, left, top, S, ts, vbw, clipId, rows, cols }) {
  const capH = 20 * ts;
  const ox = left, oy = top + capH;
  const UX = (u) => ox + (u - win.u0) * S;
  const VY = (v) => (flip ? oy + (v - win.v0) * S : oy + (win.v1 - v) * S);
  const P = ([a, c]) => (flip ? [UX(c), VY(a)] : [UX(a), VY(c)]);
  const w = (win.u1 - win.u0) * S, h = (win.v1 - win.v0) * S;
  const winRight = ox + w, winBottom = oy + h;
  const codeFs = SIZES.code * ts;
  const dims = [];
  rows.forEach((row, k) => {
    const y = winBottom + (24 + 26 * k) * ts;
    const ext = winBottom + 4 * ts;
    chainsOf(row).forEach((ch, j) => {
      if (ch.length === 1) {
        dims.push(<DimH key={`r${k}c${j}`} y={y} x1={UX(ch[0].a)} x2={UX(ch[0].b)} extFrom={ext} label={ch[0].label} small vbw={vbw} />);
      } else {
        dims.push(<DimChainH key={`r${k}c${j}`} y={y} cuts={[ch[0].a, ...ch.map((s) => s.b)].map(UX)} extFrom={ext} vbw={vbw} minSegment={0} labels={ch.map((s) => s.label)} />);
      }
    });
  });
  cols.forEach((col, k) => {
    const x = winRight + (14 + 26 * k) * ts;
    chainsOf(col).forEach((ch, j) => {
      if (ch.length === 1) {
        dims.push(<DimV key={`v${k}c${j}`} x={x} y1={VY(ch[0].a)} y2={VY(ch[0].b)} extFrom={winRight} label={ch[0].label} small vbw={vbw} />);
      } else {
        dims.push(<DimChainV key={`v${k}c${j}`} x={x} cuts={[ch[0].a, ...ch.map((s) => s.b)].map(VY)} extFrom={winRight} vbw={vbw} minSegment={0} labels={ch.map((s) => s.label)} />);
      }
    });
  });
  const floorIn = fin(win.floorY) && win.floorY >= win.v0 && win.floorY <= win.v1;
  return (
    <g>
      <text x={ox} y={top + 14 * ts} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="start" fontWeight={WEIGHTS.label}>{win.title}</text>
      <defs>
        <clipPath id={clipId}><rect x={ox} y={oy} width={w} height={h} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {drawScene(scene, P, S, `${win.key}-`)}
        {floorIn && <line x1={ox} y1={VY(win.floorY)} x2={winRight} y2={VY(win.floorY)} stroke={COLORS.meeting} strokeWidth={STROKES.frame} {...NS} />}
      </g>
      <rect x={ox} y={oy} width={w} height={h} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={`${6 * ts},${4 * ts}`} />
      {dims}
    </g>
  );
}

export default function PartitionSection2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => {
    const plan = partitionPlanGeometry(derived);
    if (!plan) return null;
    const pw = plan.pw;
    const vs = pw.screens.length ? partitionVerticalSection(derived, 'screen') : null;
    const vd = pw.doors.length ? partitionVerticalSection(derived, 'door') : null;
    const planWins = planWindows(plan);
    const vertWins = verticalWindows(vs, vd, pw);
    const scenes = { plan: sceneOfPlan(plan), screen: vs ? sceneOfVertical(vs) : null, door: vd ? sceneOfVertical(vd) : null };
    vertWins.forEach((w) => { w.scene = w.src === vs ? scenes.screen : scenes.door; });
    const all = [plan.W, plan.depth, plan.proud, ...planWins.flatMap((w) => [w.u0, w.u1, w.v0, w.v1]), ...vertWins.flatMap((w) => [w.u0, w.u1, w.v0, w.v1])];
    if (!all.every(fin)) return null;
    return { plan, pw, vs, vd, planWins, vertWins, scenes };
  }), [derived]);
  if (!geom) return <NoSheet text="No partition data." />;
  const { plan, pw, planWins, vertWins, scenes } = geom;
  const W = plan.W, D = plan.depth, proud = plan.proud;
  const S0 = pw.section, b = pw.members.board;

  // ── sheet units: the plan at 1:1, the margins in text units ──
  const svgW = W / (1 - (ML_T + MR_T) / VIEWBOX_REF);
  const ts = svgW / VIEWBOX_REF;
  const ML = ML_T * ts;
  const codeFs = SIZES.code * ts;
  const smallFs = SIZES.dimSmall * ts;
  const PX = (x) => ML + x;

  // ── the detail windows: one scale for all, rows that fit the sheet width ──
  const avail = svgW - 2 * 12 * ts;
  const GAP = 30 * ts;
  const sizeAt = (w, S) => {
    const rows = packSpans(w.hS, S, smallFs, 2 * ts);
    const cols = packSpans(w.vS, S, smallFs, 2 * ts);
    const extra = cols.length ? (14 + 26 * (cols.length - 1) + 24) * ts : 0;
    return { rows, cols, w: (w.u1 - w.u0) * S + extra, h: 20 * ts + (w.v1 - w.v0) * S + (rows.length ? (14 + 26 * rows.length) * ts : 8 * ts) };
  };
  const packRows = (wins, S) => {
    const rows = [[]];
    let used = 0;
    wins.forEach((w) => {
      const sz = sizeAt(w, S);
      const row = rows[rows.length - 1];
      if (row.length && used + GAP + sz.w > avail) { rows.push([{ w, sz }]); used = sz.w; } else { row.push({ w, sz }); used += (row.length > 1 ? GAP : 0) + sz.w; }
    });
    return rows;
  };
  const S1 = SCALES.find((s) => packRows(planWins, s).length <= 1);
  const S = S1 != null && S1 >= 2 ? S1 : (SCALES.find((s) => packRows(planWins, s).length <= MAX_ROWS) ?? SCALES[SCALES.length - 1]);
  const planRows = packRows(planWins, S);
  const vertRows = vertWins.length ? packRows(vertWins, S) : [];

  // ── the swing: a quarter arc from the hinge axis towards the swing face, clipped to a band ──
  const leaves = plan.leaves;
  const maxLeafW = Math.max(0, ...leaves.map((l) => l.x1 - l.x0));
  const arcH = maxLeafW * 0.25;
  const arcBelow = leaves.some((l) => l.swingArc.towards === 'front');
  const arcAbove = leaves.some((l) => l.swingArc.towards === 'room');

  // ── title and notes ──
  const winName = windowSpec?.name || 'Partition';
  const projNum = projectNumber || '';
  const d0 = pw.doors[0] || null;
  const hasBars = pw.screens.some((s) => s.bars.length) || pw.doors.some((d) => d.bars.length);
  const panelT = pw.screens.find((s) => s.panel)?.panel.size.t ?? pw.doors.find((d) => d.panel)?.panel.size.t ?? null;
  const notes = [
    `Section rule: front upstand ${fmt(S0.upstand)}, glass zone ${fmt(S0.zoneDepth)} = unit ${fmt(S0.unit)} (${S0.makeup}) + 2 x ${fmt(S0.tape)} tape, bead ${fmt(S0.bead.w)} x ${fmt(S0.bead.t)} on the ${S0.beadSide} side; rebate ${fmt(S0.rebate)} into the member, the unit ${fmt(S0.glassIn)} in with ${fmt(S0.play)} play; pockets ${fmt(S0.pocketDepth)} deep from the room face`,
    `Stopped pockets in posts and stiles run ${fmt(S0.rebate)} past the opening; rails square ended with through rebates; beads mitred`,
    d0 ? `Door D${d0.n}: ${d0.hingeSide} hand, opens ${d0.swing} to the ${d0.swingFace}; gap ${fmt(d0.leaf.x - d0.x)}, floor clearance ${fmt(pw.totalHeight - d0.leaf.y - d0.leaf.h)}; stop lip ${fmt(d0.stop.w)} x ${fmt(d0.stop.d)} from solid on lock post P${d0.latch.post + 1} (${d0.stopFace} face)${d0.stop.head ? `, head stop ${fmt(d0.stop.head.w)} x ${fmt(d0.stop.head.d)} planted under the top rail` : ''}; lock edge rebate ${fmt(d0.lockEdge.rebate.w)} x ${fmt(d0.lockEdge.rebate.d)} behind the ${fmt(d0.lockEdge.lip)} lip; hinge knuckles ${fmt(d0.hinges.knuckle)} on the ${d0.swingFace} face` : '',
    hasBars ? `Applied bars ${fmt(pw.members.bar)} x ${fmt(pw.members.barThickness)} on both faces over a ${fmt(S0.dummySpacer)} dummy spacer in the cavity` : '',
    panelT != null ? `Panels ${fmt(panelT)} thick in the ${fmt(S0.rebate)} pocket, the face ${fmt(S0.upstand)} behind the front, bead ${fmt(S0.bead.t)} on the room side` : '',
    `Boards ${fmt(b)} x ${fmt(pw.boardWidth)}, ${fmt(proud)} proud each face, separate decorative elements round the wall`,
    `Plan: front (corridor) below, room above. Vertical sections: front at the left, floor down. Overview 1:1, details ${S}:1`,
  ].filter(Boolean);
  const NOTE_CHARS = Math.max(20, Math.floor((svgW - 2 * 12 * ts) / (CHAR * codeFs)));
  const wrap = (t) => {
    const words = String(t).split(' ');
    const lines = [];
    let cur = '';
    words.forEach((wd) => {
      if ((cur + ' ' + wd).trim().length > NOTE_CHARS && cur) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim();
    });
    if (cur) lines.push(cur);
    return lines;
  };
  const noteLines = notes.flatMap(wrap);
  const tail = (20 + 44 + 18 * noteLines.length) * ts;

  // ── vertical layout from `top` ──
  const layout = (top) => {
    const capY = top + 16 * ts;
    const dimHY = capY + 28 * ts;
    const bandTop = dimHY + 24 * ts + (arcAbove ? arcH : 0);
    const PZ = (z) => bandTop + (plan.z1 - z);
    const bandBottom = PZ(plan.z0);
    const labelStrip = PZ(0) + (arcBelow ? 0 : (bandBottom - PZ(0)));
    const blockBottom = arcBelow ? PZ(0) + arcH + 4 * ts : bandBottom + (d0 ? 36 : 20) * ts;
    const chainY = blockBottom + 24 * ts;
    const row2Y = chainY + 26 * ts;
    let y = row2Y + 28 * ts;
    const place = (rows) => rows.map((row) => {
      const rowW = row.reduce((a, it) => a + it.sz.w, 0) + GAP * (row.length - 1);
      let x = 12 * ts + Math.max(0, (avail - rowW) / 2);
      const items = row.map((it) => { const o = { ...it, left: x, top: y }; x += it.sz.w + GAP; return o; });
      y += Math.max(...row.map((it) => it.sz.h)) + 26 * ts;
      return items;
    });
    const placedPlan = place(planRows);
    const placedVert = place(vertRows);
    const titleY = y + 10 * ts;
    return { top, capY, dimHY, bandTop, PZ, bandBottom, labelStrip, blockBottom, chainY, row2Y, placedPlan, placedVert, titleY, svgH: titleY + tail - 20 * ts };
  };
  // no top pad: the detail chains sit under the plan wherever they fall (the
  // dimension rule of the elevations does not govern this multi-detail sheet)
  const L = layout(0);
  const { capY, dimHY, bandTop, PZ, bandBottom, chainY, row2Y, placedPlan, placedVert, titleY, svgH } = L;
  const Pplan = ([x, z]) => [PX(x), PZ(z)];

  // the field chain: posts and fields between the end boards (the boards on a row of their own)
  const xCuts = [];
  pw.posts.forEach((p, i) => { xCuts.push(p.x, p.x + p.w); if (pw.fields[i]) xCuts.push(pw.fields[i].x + pw.fields[i].w); });
  const xc = [...new Set(xCuts.map((v) => Math.round(v * 10) / 10))].sort((p, q) => p - q);

  // the plan caption: the long wording when it clears the window tag at the top right, else the short one
  const capFull = 'PLAN 1:1 · horizontal section through the glazed zone · front (corridor) below, room above';
  const capShort = 'PLAN 1:1 · front (corridor) below, room above';
  const caption = capFull.length * CHAR * codeFs <= svgW - PX(0) - 64 * ts ? capFull : capShort;
  const idBase = (tag) => idOf(windowSpec, `clip-wall-sec-${tag}`);
  const titleText = `Sections${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `Partition wall ${pw.layout} · plan 1:1, details ${S}:1`;

  // the swing arcs: start at the closed leaf, end at the open position; clipped to the band
  const arcs = leaves.map((l) => {
    const cx = PX(l.swingArc.cx), cy = PZ(l.swingArc.cz), r = l.swingArc.r;
    const dir = l.hingeSide === 'left' ? 1 : -1;
    const down = l.swingArc.towards === 'front' ? 1 : -1;
    const sx = cx + dir * r, sy = cy, ex = cx, ey = cy + down * r;
    const sweep = (dir * r) * (down * r) > 0 ? 1 : 0;
    return { l, d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 0 ${sweep} ${ex.toFixed(1)} ${ey.toFixed(1)}`, down };
  });
  const bandClipId = idBase('arc');
  const bandY0 = arcAbove ? PZ(D) - arcH : PZ(0);
  const bandY1 = arcBelow ? PZ(0) + arcH : PZ(D);
  const knuckleLabel = (l) => {
    const d = pw.doors.find((x) => x.n === l.n);
    if (!d) return null;
    const y = l.swingArc.towards === 'front' ? PZ(0) + 30 * ts : bandBottom + 30 * ts;
    const left = l.hingeSide === 'left';
    return (
      <Label key={`kl${l.n}`} x={PX(l.axisX) + (left ? 2 : -2) * ts} y={y} anchor={left ? 'start' : 'end'} vbw={svgW}
        text={`D${d.n}: hinge axis, knuckle ${fmt(d.hinges.knuckle)}, opens ${d.swing} to the ${d.swingFace}`} />
    );
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        {/* ── caption ── */}
        <text x={PX(0)} y={capY} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="start" fontWeight={WEIGHTS.label}>
          {caption}
        </text>

        {/* ── the plan at 1:1 ── */}
        <defs>
          <clipPath id={bandClipId}><rect x={PX(0) - 20 * ts} y={bandY0} width={W + 40 * ts} height={Math.max(0, bandY1 - bandY0)} /></clipPath>
        </defs>
        {drawScene(scenes.plan, Pplan, 1, 'ov-')}
        <g clipPath={`url(#${bandClipId})`}>
          {arcs.map((a) => (
            <path key={`arc${a.l.n}`} d={a.d} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS} strokeDasharray={`${6 * ts},${4 * ts}`} />
          ))}
        </g>
        <Label x={PX(0) + 2 * ts} y={bandTop - 5 * ts} text="ROOM" anchor="start" vbw={svgW} />
        <Label x={PX(0) + 2 * ts} y={(arcBelow ? PZ(0) : bandBottom) + 14 * ts} text="FRONT (corridor)" anchor="start" vbw={svgW} />
        {leaves.map(knuckleLabel)}

        {/* the overall width at the top, the depth and the board width on the right */}
        <DimH y={dimHY} x1={PX(0)} x2={PX(W)} extFrom={bandTop} label={fmt(W)} vbw={svgW} />
        <DimV x={PX(W) + 26 * ts} y1={PZ(D)} y2={PZ(0)} extFrom={PX(W)} label={fmt(D)} vbw={svgW} />
        <DimV x={PX(W) + 54 * ts} y1={PZ(D + proud)} y2={PZ(-proud)} extFrom={PX(W)} label={fmt(pw.boardWidth)} vbw={svgW} />
        {/* the field chain along the bottom */}
        <DimChainH y={chainY} cuts={xc.map(PX)} extFrom={bandBottom + 2 * ts} vbw={svgW} fmt={fmt} minSegment={0} />
        <DimH y={row2Y} x1={PX(0)} x2={PX(b)} extFrom={bandBottom + 2 * ts} label={`board ${fmt(b)}`} small vbw={svgW} />
        <DimH y={row2Y} x1={PX(W - b)} x2={PX(W)} extFrom={bandBottom + 2 * ts} label={`board ${fmt(b)}`} small vbw={svgW} />

        {/* ── plan details ── */}
        {placedPlan.flat().map((it) => (
          <DetailWindow key={it.w.key} win={it.w} scene={scenes.plan} flip={false} left={it.left} top={it.top} S={S} ts={ts} vbw={svgW}
            clipId={idBase(it.w.key)} rows={it.sz.rows} cols={it.sz.cols} />
        ))}
        {/* ── vertical sections ── */}
        {placedVert.flat().map((it) => (
          <DetailWindow key={it.w.key} win={it.w} scene={it.w.scene} flip left={it.left} top={it.top} S={S} ts={ts} vbw={svgW}
            clipId={idBase(it.w.key)} rows={it.sz.rows} cols={it.sz.cols} />
        ))}

        <SheetTitle x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} notes={noteLines} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
