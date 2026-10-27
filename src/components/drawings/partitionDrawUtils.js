/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * partitionDrawUtils.js (25.10.2026): the shared data of the partition wall
 * sheets. ONE plan of the sheets for the Drawings tabs, the PDF rig, the
 * Elements PDF and the production pack; the glass grouping; the PLAN and
 * VERTICAL SECTION geometry (polygons in mm) the Sections sheet draws; and the
 * MEMBER descriptors of the CNC sheets (a member laid down with its pockets,
 * recesses, bores and the dowel holes of its end faces). Every number comes
 * from derived.partition (engine/partition.js); nothing is computed here but
 * the drawing geometry of those numbers.
 *
 * Member drawing coordinates (the CNC sheets): x along the member from its
 * reference END (the TOP end of a post or stile, the LEFT end of a rail as the
 * front elevation shows it), y across the face from its reference EDGE. The
 * vertical members are shown with the ROOM face up (the pockets open to the
 * room) and the top end at the left, so the edge at the top of the drawing is
 * the one facing LEFT in the front elevation; the rails are shown from the
 * front with the top edge up. Every sheet prints this in its notes.
 */

const R = (v) => Math.round(v * 10) / 10;

/**
 * Note lines wrapped to a sheet width: the code text (SIZES.code x ts) is
 * 0.55 x font size per character, so a line of `chars` characters fits
 * `width` sheet units. Whole paragraphs stay together.
 */
export function wrapNotes(notes, width, fontSize) {
  const chars = Math.max(20, Math.floor(width / (0.55 * fontSize)));
  const out = [];
  (notes || []).filter(Boolean).forEach((t) => {
    const words = String(t).split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > chars && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) out.push(cur);
  });
  return out;
}

/** The sheets of one wall, in tab and PDF order (the front elevation is its own tab). */
export function partitionSheetPlan(derived) {
  const pw = derived?.partition;
  if (!pw) return [];
  const plan = [];
  (pw.doors || []).forEach((d) => {
    plan.push({ key: `wallleaf-${d.n}`, label: (pw.doors.length > 1 ? `Door Leaf D${d.n}` : 'Door Leaf'), sheet: 'leaf', props: { door: d.n } });
  });
  postGroups(pw).forEach((g) => {
    plan.push({ key: `wallpost-${g.key}`, label: g.label, sheet: 'member', props: { member: 'post', group: g.key } });
  });
  plan.push({ key: 'walltoprail', label: 'Top Rail', sheet: 'member', props: { member: 'topRail' } });
  if ((pw.screens || []).length) plan.push({ key: 'wallrails', label: 'Screen Rails', sheet: 'member', props: { member: 'screenRails' } });
  (pw.doors || []).forEach((d) => {
    const sfx = pw.doors.length > 1 ? ` D${d.n}` : '';
    plan.push({ key: `wallstiles-${d.n}`, label: `Door Stiles${sfx}`, sheet: 'member', props: { member: 'doorStiles', door: d.n } });
    plan.push({ key: `walldoorrails-${d.n}`, label: `Door Rails${sfx}`, sheet: 'member', props: { member: 'doorRails', door: d.n } });
  });
  plan.push({ key: 'wallsection', label: 'Sections', sheet: 'section', props: {} });
  return plan;
}

/**
 * The posts grouped by their machining: the same pockets, lips and recesses
 * make one sheet; a mirror image (the end posts P1 and P4) shares the sheet
 * and is listed as mirrored. Each group: { key, label, posts: [i], mirrored: [i] }.
 */
export function postGroups(pw) {
  const sig = (p, mirror) => {
    const L = mirror ? 'right' : 'left', Rt = mirror ? 'left' : 'right';
    return [p.rebated?.[L] ? 'r' : '-', p.rebated?.[Rt] ? 'r' : '-', p.lips?.[L] ? 'l' : '-', p.lips?.[Rt] ? 'l' : '-', p.role,
      (p.pockets || []).map((k) => `${k.side === L ? 'L' : 'R'}${k.kind}${k.from}-${k.to}`).sort().join('|')].join('/');
  };
  const groups = [];
  (pw.posts || []).forEach((p) => {
    const s = sig(p, false), m = sig(p, true);
    let g = groups.find((x) => x.sig === s);
    if (g) { g.posts.push(p.i); return; }
    g = groups.find((x) => x.sig === m && x.role === p.role && (p.role === 'end' || p.role === 'mullion'));
    if (g) { g.mirrored.push(p.i); return; }
    groups.push({ sig: s, role: p.role, posts: [p.i], mirrored: [] });
  });
  const roleName = { end: 'End Post', hinge: 'Hinge Post', lock: 'Lock Post', mullion: 'Post' };
  return groups.map((g) => {
    const all = [...g.posts, ...g.mirrored];
    const name = all.length > 1 ? `${roleName[g.role] || 'Post'}s` : (roleName[g.role] || 'Post');
    return { key: all.map((i) => i + 1).join('-'), label: `${name} ${all.map((i) => `P${i + 1}`).join(', ')}`, posts: g.posts, mirrored: g.mirrored, role: g.role };
  });
}

/**
 * Unique glass units (size + bars) of the wall, one factory drawing per size:
 * { key, w, h, finish, rep, units, panes } as the door grouping.
 */
export function groupPartitionGlass(derived) {
  if (derived?.category !== 'partition') return [];
  const groups = [];
  (derived.customGlassUnits || []).forEach((u, i) => {
    const w = u?.width, h = u?.height;
    if (!w || !h) return;
    const bars = u.bars ? `${u.bars.h || 0}h${u.bars.v || 0}v${(u.bars.y || []).join(',')}` : '';
    const key = `${w}x${h}|${u.role}|${bars}`;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, w, h, finish: 'clear', rep: i, units: [], panes: [] }; groups.push(g); }
    g.units.push(i);
    g.panes.push(u.location || `unit ${i + 1}`);
  });
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS. Plan coordinates: x = wall x (the front elevation), z = depth from
// the FRONT (corridor) face (0) to the room face (depth); the end boards stand
// proud of both. Vertical section coordinates: y = wall y (from the head board
// top), z as the plan. Every polygon is a list of [a, z] points in mm.
// ─────────────────────────────────────────────────────────────────────────────

const rect = (a0, a1, z0, z1) => [[a0, z0], [a1, z0], [a1, z1], [a0, z1]];

/** '6/16/6' → { outer: 6, cavity: 16, inner: 6 } (a makeup without three numbers: equal thirds). */
export function parseMakeup(makeup, unit) {
  const n = String(makeup || '').split(/[^0-9.]+/).filter(Boolean).map(Number);
  if (n.length >= 3 && n.every(Number.isFinite)) return { outer: n[0], cavity: n[1], inner: n[2] };
  return { outer: unit / 3, cavity: unit / 3, inner: unit / 3 };
}

/**
 * A member section across its width [a0, a1] through the depth [0, depth] with
 * a glass pocket (width `reb`, from the room face down to the upstand) on the
 * low edge, the high edge or both, and an optional lip (a strip `lipW` wide
 * from z `lipZ` to the room face) past the low or high edge.
 */
function memberSection(a0, a1, depth, upstand, reb, pocketLow, pocketHigh, lip) {
  const pts = [];
  // go round clockwise from the front-low corner
  pts.push([a0, 0]);
  pts.push([a1, 0]);
  if (lip?.side === 'high') { pts.push([a1, lip.z], [a1 + lip.w, lip.z], [a1 + lip.w, depth]); } else pts.push([a1, pocketHigh ? upstand : depth]);
  if (pocketHigh && !(lip?.side === 'high')) { pts.push([a1 - reb, upstand], [a1 - reb, depth]); }
  if (pocketLow) { pts.push([a0 + reb, depth], [a0 + reb, upstand], [a0, upstand]); }
  else if (lip?.side === 'low') { pts.push([a0 - lip.w, depth], [a0 - lip.w, lip.z], [a0, lip.z]); }
  else pts.push([a0, depth]);
  return pts;
}

/** The glass unit and its beads in a pocket between a0 and a1 (the daylight edges), as drawing parts. */
function glazingParts(pw, a0, a1) {
  const S = pw.section;
  const glassIn = S.glassIn, tape = S.tape, unit = S.unit;
  const zGlass0 = S.upstand + tape, zGlass1 = zGlass0 + unit;
  const mk = parseMakeup(S.makeup, unit);
  const u0 = a0 - glassIn, u1 = a1 + glassIn;
  return {
    unit: rect(u0, u1, zGlass0, zGlass1),
    panes: [rect(u0, u1, zGlass0, zGlass0 + mk.outer), rect(u0, u1, zGlass1 - mk.inner, zGlass1)],
    spacerEdges: [rect(u0, u0 + S.spacer, zGlass0 + mk.outer, zGlass1 - mk.inner), rect(u1 - S.spacer, u1, zGlass0 + mk.outer, zGlass1 - mk.inner)],
    cavity: { z0: zGlass0 + mk.outer, z1: zGlass1 - mk.inner },
    beads: [rect(a0 - S.rebate, a0, pw.depth - S.bead.t, pw.depth), rect(a1, a1 + S.rebate, pw.depth - S.bead.t, pw.depth)],
    z: { glass0: zGlass0, glass1: zGlass1, bead0: pw.depth - S.bead.t },
  };
}

/**
 * The PLAN of the wall through the glazed zone: end boards, posts (with their
 * pockets and the lock post lip), the units and beads of the screens, the door
 * leaf closed in its opening (stiles with their pockets, the unit, the lock
 * edge rebate), the hinge knuckles and the swing.
 */
export function partitionPlanGeometry(derived) {
  const pw = derived?.partition;
  if (!pw) return null;
  const S = pw.section, D = pw.depth, up = S.upstand, reb = S.rebate;
  const b = pw.members.board, bw = pw.boardWidth, proud = (bw - D) / 2;
  const members = [];
  const glazing = [];
  const leaves = [];
  members.push({ kind: 'board', side: 'left', pts: rect(0, b, -proud, D + proud) });
  members.push({ kind: 'board', side: 'right', pts: rect(pw.totalWidth - b, pw.totalWidth, -proud, D + proud) });
  pw.posts.forEach((p) => {
    const lip = p.lips.left ? { side: 'low', w: pw.doors[0]?.stop.w || 0, z: D - (pw.doors[0]?.stop.d || 0) }
      : p.lips.right ? { side: 'high', w: pw.doors[0]?.stop.w || 0, z: D - (pw.doors[0]?.stop.d || 0) } : null;
    members.push({ kind: 'post', i: p.i, role: p.role, x0: p.x, x1: p.x + p.w, lip,
      pts: memberSection(p.x, p.x + p.w, D, up, reb, p.rebated.left, p.rebated.right, lip) });
  });
  pw.screens.forEach((s) => glazing.push({ kind: 'screen', n: s.n, a0: s.x, a1: s.x + s.w, ...glazingParts(pw, s.x, s.x + s.w) }));
  pw.doors.forEach((d) => {
    const lf = d.leaf, st = d.members.stile;
    const hingeLeft = d.hingeSide === 'left';
    const lockX0 = hingeLeft ? lf.x + lf.w - st : lf.x;
    const hingeX0 = hingeLeft ? lf.x : lf.x + lf.w - st;
    // the lock stile: the lip on the swing face keeps the full width, the rest is cut back by the rebate width
    const lipZ = d.swingFace === 'front' ? [0, d.lockEdge.lip] : [D - d.lockEdge.lip, D];
    const rebZ = d.swingFace === 'front' ? [d.lockEdge.lip, D] : [0, D - d.lockEdge.lip];
    const lockOuter = hingeLeft ? lockX0 + st : lockX0;                 // the lock edge x
    const lockCut = hingeLeft ? lockOuter - d.lockEdge.rebate.w : lockOuter + d.lockEdge.rebate.w;
    const lockStile = (() => {
      // the core (daylight side pocket) as a member section, then the lock edge stepped
      const a0 = hingeLeft ? lockX0 : lockCut, a1 = hingeLeft ? lockCut : lockX0 + st;
      const core = memberSection(a0, a1, D, up, reb, !hingeLeft, hingeLeft, null);
      const lipRect = hingeLeft ? rect(lockCut, lockOuter, lipZ[0], lipZ[1]) : rect(lockOuter, lockCut, lipZ[0], lipZ[1]);
      return { core, lip: lipRect, rebZ };
    })();
    const hingeStile = memberSection(hingeX0, hingeX0 + st, D, up, reb, !hingeLeft, hingeLeft, null);
    const dayA0 = lf.x + st, dayA1 = lf.x + lf.w - st;
    // the hinge axis: the knuckle centre in the gap between the post and the leaf, in front of the swing face
    const gap = hingeLeft ? lf.x - (d.x) : (d.x + d.w) - (lf.x + lf.w);
    const axisX = hingeLeft ? lf.x - gap / 2 : lf.x + lf.w + gap / 2;
    const axisZ = d.swingFace === 'front' ? -d.hinges.knuckle / 2 : D + d.hinges.knuckle / 2;
    leaves.push({
      n: d.n, hingeSide: d.hingeSide, swing: d.swing, swingFace: d.swingFace,
      x0: lf.x, x1: lf.x + lf.w, hingeStile, lockStile, glazing: glazingParts(pw, dayA0, dayA1),
      knuckle: { x: axisX, z: axisZ, r: d.hinges.knuckle / 2 },
      swingArc: { cx: axisX, cz: axisZ, r: lf.w, towards: d.swingFace },
      axisX,
      stop: { post: d.stop.post, w: d.stop.w, d: d.stop.d, face: d.stopFace },
    });
  });
  return { pw, W: pw.totalWidth, depth: D, proud, members, glazing, leaves, z0: -proud, z1: D + proud };
}

/**
 * The VERTICAL section through one screen (y from the head board top, z as
 * the plan): head board, top rail with its pocket, the unit with its applied
 * bars and dummy spacers, the mid rail (pockets both edges), the panel with its
 * beads, the bottom rail on the floor. Through a door: the top rail with the
 * head stop, the leaf top rail with its head rebate and glass pocket, the leaf
 * mid and bottom rails, the floor clearance.
 */
export function partitionVerticalSection(derived, which = 'screen') {
  const pw = derived?.partition;
  if (!pw) return null;
  const S = pw.section, D = pw.depth, up = S.upstand, reb = S.rebate;
  const b = pw.members.board, bw = pw.boardWidth, proud = (bw - D) / 2;
  const members = [];
  const glazing = [];
  const bars = [];
  const panels = [];
  const tr = pw.topRail;
  members.push({ kind: 'head', pts: rect(0, b, -proud, D + proud) });
  if (which === 'screen' && pw.screens[0]) {
    const s = pw.screens[0];
    // the top rail: its pocket on the underside (the high edge in y)
    members.push({ kind: 'topRail', pts: memberSection(tr.y, tr.y + tr.h, D, up, reb, false, true, null) });
    const zone = s.zone;
    glazing.push({ kind: 'glass', ...glazingParts(pw, zone.y, zone.y + zone.h) });
    const cav = glazing[0].cavity;
    s.bars.forEach((br) => {
      bars.push({ y0: br.y, y1: br.y + br.h, front: rect(br.y, br.y + br.h, -pw.members.barThickness, 0), room: rect(br.y, br.y + br.h, D, D + pw.members.barThickness),
        dummy: rect(br.y, br.y + br.h, cav.z0, cav.z1) });
    });
    if (s.midRail) {
      members.push({ kind: 'midRail', pts: memberSection(s.midRail.y, s.midRail.y + s.midRail.h, D, up, reb, true, true, null) });
    }
    if (s.panel) {
      const pn = s.panel;
      const t = pn.size.t;
      panels.push({ pts: rect(pn.y - S.glassIn, pn.y + pn.h + S.glassIn, up, up + t), beads: [rect(pn.y - reb, pn.y, D - S.bead.t, D), rect(pn.y + pn.h, pn.y + pn.h + reb, D - S.bead.t, D)] });
    }
    members.push({ kind: 'bottomRail', pts: memberSection(s.bottomRail.y, s.bottomRail.y + s.bottomRail.h, D, up, reb, true, false, null) });
    return { pw, which, H: pw.totalHeight, depth: D, proud, members, glazing, bars, panels, floorY: pw.totalHeight, z0: -proud, z1: D + proud };
  }
  const d = pw.doors[0];
  if (!d) return null;
  // the top rail over the door: plain, with the planted head stop under it on the stop face
  members.push({ kind: 'topRail', pts: rect(tr.y, tr.y + tr.h, 0, D) });
  if (d.stop.head) {
    const hs = d.stop.head;
    members.push({ kind: 'headStop', pts: d.stopFace === 'room' ? rect(tr.y + tr.h, tr.y + tr.h + hs.w, D - hs.d, D) : rect(tr.y + tr.h, tr.y + tr.h + hs.w, 0, hs.d) });
  }
  const lf = d.leaf, ld = lf.depth;
  const lipZ = d.swingFace === 'front' ? [0, d.lockEdge.lip] : [ld - d.lockEdge.lip, ld];
  // the leaf top rail: the head rebate (the lip keeps the full height on the swing face), the glass pocket on its lower edge
  const t0 = d.topRail.y, t1 = d.topRail.y + d.topRail.h;
  const topCore = memberSection(d.headEdge ? t0 + d.headEdge.rebate.w : t0, t1, ld, up, reb, false, true, null);
  members.push({ kind: 'leafTop', pts: topCore, lip: d.headEdge ? rect(t0, t0 + d.headEdge.rebate.w, lipZ[0], lipZ[1]) : null });
  glazing.push({ kind: 'glass', ...glazingParts(pw, d.zone.y, d.zone.y + d.zone.h) });
  const cav = glazing[0].cavity;
  d.bars.forEach((br) => {
    bars.push({ y0: br.y, y1: br.y + br.h, front: rect(br.y, br.y + br.h, -pw.members.barThickness, 0), room: rect(br.y, br.y + br.h, ld, ld + pw.members.barThickness),
      dummy: rect(br.y, br.y + br.h, cav.z0, cav.z1) });
  });
  if (d.midRail) members.push({ kind: 'leafMid', pts: memberSection(d.midRail.y, d.midRail.y + d.midRail.h, ld, up, reb, true, true, null) });
  if (d.panel) {
    const pn = d.panel;
    panels.push({ pts: rect(pn.y - S.glassIn, pn.y + pn.h + S.glassIn, up, up + pn.size.t), beads: [rect(pn.y - reb, pn.y, ld - S.bead.t, ld), rect(pn.y + pn.h, pn.y + pn.h + reb, ld - S.bead.t, ld)] });
  }
  members.push({ kind: 'leafBottom', pts: memberSection(d.bottomRail.y, d.bottomRail.y + d.bottomRail.h, ld, up, reb, true, false, null) });
  return { pw, which, H: pw.totalHeight, depth: D, proud, members, glazing, bars, panels, floorY: pw.totalHeight, leafBottomY: lf.y + lf.h, z0: -proud, z1: D + proud };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER descriptors for the CNC sheets.
// ─────────────────────────────────────────────────────────────────────────────

/** The cut list record of a member by its code (and an optional note prefix). */
function recordOf(derived, code, notePrefix) {
  const recs = [...(derived?.components?.box || []), ...(derived?.components?.sash || [])];
  return recs.find((r) => r.code === code && (!notePrefix || String(r.notes || '').startsWith(notePrefix))) || recs.find((r) => r.code === code) || null;
}

const jointsOf = (pw, element) => (pw.joints || []).filter((j) => j.element === element);

/**
 * One member descriptor:
 *   { name, code, length, face, depth, section, edgeTop, edgeBottom, endLeft, endRight,
 *     visibleFace: 'room' | 'front', hiddenStep: { y } | null,
 *     pockets:  [{ y0, y1, x0, x1, depth, label }]        (through the shown face, hatched)
 *     edgeOps:  [{ edge: 'top'|'bottom', x0, x1, w, d, label, hidden }]   (on an edge, drawn as a strip outside it)
 *     bores:    [{ x, y, r, label }]                       (through the face)
 *     ends:     { left: { holes: [{ across, depth }], body, shape }, right: ... }   (dowel holes in the end faces)
 *     notes: [] }
 * The face view: x along, y across (0 = edgeTop).
 */
function postDescriptor(derived, pw, i, mirrored) {
  const p = pw.posts.find((q) => q.i === i);
  if (!p) return null;
  const S = pw.section, D = pw.depth;
  const reb = S.rebate, pocketD = S.pocketDepth;
  // the face: the lip(s) widen the blank; y 0 at the edge facing LEFT in the elevation
  const lipW = pw.doors[0]?.stop.w || 0, lipD = pw.doors[0]?.stop.d || 0;
  const lipLeft = p.lips.left ? lipW : 0, lipRight = p.lips.right ? lipW : 0;
  const face = p.blank;
  const coreY0 = lipLeft, coreY1 = lipLeft + p.w;
  const pockets = p.pockets.map((k) => ({
    x0: k.from, x1: k.to, y0: k.side === 'left' ? coreY0 : coreY1 - reb, y1: k.side === 'left' ? coreY0 + reb : coreY1,
    depth: pocketD, kind: k.kind, side: k.side,
    label: `${k.kind} pocket ${R(k.to - k.from)} x ${reb}, ${pocketD} deep from the room face`,
  }));
  const edgeOps = [];
  const bores = [];
  const doorsHere = pw.doors.filter((d) => d.hinges.post === i || d.latch.post === i);
  doorsHere.forEach((d) => {
    const edge = (d.i === i) ? 'bottom' : 'top';     // the door field right of post i is field i; left of it is field i - 1
    if (d.hinges.post === i) {
      d.hinges.wallY.forEach((wy, k) => {
        const x = wy - pw.topRail.y - pw.topRail.h;   // from the post top
        edgeOps.push({ edge, x0: R(x - d.hinges.length / 2), x1: R(x + d.hinges.length / 2), w: d.hinges.flap, d: d.hinges.thickness, hidden: d.swingFace === 'front',
          z0: d.swingFace === 'front' ? 0 : R(D - d.hinges.flap),
          label: `hinge ${k + 1} recess ${d.hinges.length} x ${d.hinges.flap} x ${d.hinges.thickness}, from the ${d.swingFace} face` });
      });
    }
    if (d.latch.post === i) {
      const x = d.latch.wallY - pw.topRail.y - pw.topRail.h;
      const f = d.latch.forend;
      edgeOps.push({ edge, x0: R(x - f.length / 2), x1: R(x + f.length / 2), w: f.width, d: f.thickness, hidden: false, onLip: true, z0: R(d.latch.axisFromFront - f.width / 2),
        label: `keep plate ${f.length} x ${f.width} x ${f.thickness} on the stop lip, centred ${R(d.latch.axisFromFront)} from the front face` });
      edgeOps.push({ edge, x0: R(x - d.latch.keepBolt.width / 2), x1: R(x + d.latch.keepBolt.width / 2), w: d.latch.keepBolt.width, d: d.latch.keepBolt.depth, hidden: false, onLip: true, z0: R(d.latch.axisFromFront - d.latch.keepBolt.width / 2),
        label: `latch bolt pocket ${d.latch.keepBolt.width} x ${d.latch.keepBolt.width}, ${d.latch.keepBolt.depth} deep` });
    }
  });
  const lips = [];
  if (lipLeft) lips.push({ y0: 0, y1: lipLeft, d: lipD, label: `stop lip ${lipW} x ${lipD} from solid: the front ${R(D - lipD)} cut away over ${lipW}` });
  if (lipRight) lips.push({ y0: face - lipRight, y1: face, d: lipD, label: `stop lip ${lipW} x ${lipD} from solid: the front ${R(D - lipD)} cut away over ${lipW}` });
  const joint = jointsOf(pw, `W-POST ${i + 1}`)[0] || null;
  const rec = recordOf(derived, p.blank === p.w ? 'W-P' : 'W-PL');
  const roleName = { end: 'end post', hinge: 'hinge post', lock: 'lock post', mullion: 'post between two screens' };
  return {
    key: `P${i + 1}`, name: `P${i + 1} · ${roleName[p.role] || p.role}${mirrored ? ' (mirror image)' : ''}`, code: rec?.code || 'W-P',
    length: p.h, face, depth: D, section: `${face}x${D}`,
    edgeTop: p.left ? (p.left.kind === 'S' ? `screen S${p.left.n} side` : `door D${p.left.n} side`) : 'end board side',
    edgeBottom: p.right ? (p.right.kind === 'S' ? `screen S${p.right.n} side` : `door D${p.right.n} side`) : 'end board side',
    endLeft: 'TOP end (under the top rail)', endRight: 'FLOOR end',
    visibleFace: 'room', core: { y0: coreY0, y1: coreY1 }, lips,
    pockets, edgeOps, bores,
    ends: { left: joint ? { holes: joint.holes.map((h) => ({ across: h.across + lipLeft, depth: h.depth })), dia: joint.dia, len: joint.length, body: [joint.body[0] + lipLeft, joint.body[1] + lipLeft], into: joint.into, ref: 'from the top edge of the drawing' } : null, right: null },
    mirroredOf: mirrored,
  };
}

function railDescriptor(derived, pw, kind, n) {
  const S = pw.section, D = pw.depth, reb = S.rebate;
  const s = pw.screens.find((q) => q.n === n) || pw.screens[0];
  if (!s) return null;
  const isMid = kind === 'midRail';
  const r = isMid ? s.midRail : s.bottomRail;
  if (!r) return null;
  const code = isMid ? 'W-MR' : 'W-BR';
  const rec = recordOf(derived, code, `S${s.n}`);
  const element = `${isMid ? 'W-MID RAIL' : 'W-BOTTOM RAIL'} S${s.n}`;
  const js = jointsOf(pw, element);
  const end = (where) => { const j = js.find((x) => x.where === where); return j ? { holes: j.holes, dia: j.dia, len: j.length, body: j.body, into: j.into, ref: 'from the top edge' } : null; };
  const rebates = isMid
    ? [{ y0: 0, y1: reb, label: `through rebate ${reb} x ${S.pocketDepth} on the top edge (glass)` }, { y0: r.h - reb, y1: r.h, label: `through rebate ${reb} x ${S.pocketDepth} on the bottom edge (panel)` }]
    : [{ y0: 0, y1: reb, label: `through rebate ${reb} x ${S.pocketDepth} on the top edge (${s.panel ? 'panel' : 'glass'})` }];
  return {
    key: `${code}-S${s.n}`, name: `${isMid ? 'Mid rail' : 'Bottom rail'} · screens ${pw.screens.map((q) => `S${q.n}`).join(', ')}`, code,
    length: r.w, face: r.h, depth: D, section: `${r.h}x${D}`,
    edgeTop: isMid ? 'glass side' : (s.panel ? 'panel side' : 'glass side'), edgeBottom: isMid ? 'panel side' : 'floor',
    endLeft: `LEFT end (post P${s.i + 1})`, endRight: `RIGHT end (post P${s.i + 2})`,
    visibleFace: 'front', rebates,
    pockets: [], edgeOps: [], bores: [], lips: [],
    ends: { left: end('left end'), right: end('right end') },
    qty: pw.screens.length,
  };
}

function topRailDescriptor(derived, pw) {
  const S = pw.section, D = pw.depth, reb = S.rebate;
  const tr = pw.topRail;
  const rec = recordOf(derived, 'W-TR');
  // the pockets along the underside (y = face - reb .. face), x from the left end
  const pockets = tr.pockets.map((k) => ({ x0: k.from, x1: k.to, y0: tr.h - reb, y1: tr.h, depth: k.d, kind: 'glass', side: 'bottom',
    label: `glass pocket S${k.screen} ${R(k.to - k.from)} x ${reb}, ${k.d} deep from the room face` }));
  // the dowel holes of every post top come into the underside: an edge op on the bottom edge
  const edgeOps = pw.posts.map((p) => {
    const j = jointsOf(pw, `W-POST ${p.i + 1}`)[0];
    const x0 = p.x - tr.x;
    return { edge: 'bottom', x0: R(x0), x1: R(x0 + p.w), w: j?.dia || pw.dowels.dia, d: j ? j.length / 2 : pw.dowels.length / 2, hidden: false, dia: j?.dia, dowels: j ? j.holes.map((h) => ({ x: R(x0 + h.across), depth: h.depth })) : [],
      label: `post P${p.i + 1}: ${j ? j.holes.length : 0} dowel holes dia ${j?.dia || ''} x ${j?.length ? j.length / 2 : ''} in the underside, (${j ? j.holes.map((h) => `${R(x0 + h.across)}, ${h.depth}`).join(') (') : ''}) along, from the front` };
  });
  const headStops = pw.doors.filter((d) => d.stop.head).map((d) => ({ x0: R(d.x - tr.x), x1: R(d.x + d.w - tr.x), w: d.stop.head.w, d: d.stop.head.d, face: d.stopFace,
    label: `head stop D${d.n} planted ${d.stop.head.w} x ${d.stop.head.d} x ${R(d.w)} under the rail, ${d.stopFace} face` }));
  return {
    key: 'W-TR', name: 'Top rail · one piece between the end boards', code: 'W-TR',
    length: tr.w, face: tr.h, depth: D, section: `${tr.h}x${D}`,
    edgeTop: 'head board side', edgeBottom: 'underside',
    endLeft: 'LEFT end (left end board)', endRight: 'RIGHT end (right end board)',
    visibleFace: 'room', pockets, edgeOps, bores: [], lips: [], headStops,
    ends: { left: null, right: null },
    qty: 1,
  };
}

function stileDescriptor(derived, pw, d, which) {
  const S = pw.section, D = d.leaf.depth, reb = S.rebate;
  const st = d.members.stile;
  const isHinge = which === 'hinge';
  const hingeLeft = d.hingeSide === 'left';
  // the stile at the LEFT of the elevation has its outer edge at y 0 (edgeTop); the right one its daylight edge
  const atLeft = isHinge ? hingeLeft : !hingeLeft;
  const outerAtTop = atLeft;
  const dayY0 = outerAtTop ? st - reb : 0, dayY1 = outerAtTop ? st : reb;
  const leafTop = d.leaf.y;
  const pockets = [
    { x0: R(d.zone.y - reb - leafTop), x1: R(d.zone.y + d.zone.h + reb - leafTop), y0: dayY0, y1: dayY1, depth: S.pocketDepth, kind: 'glass', side: outerAtTop ? 'bottom' : 'top',
      label: `glass pocket ${R(d.zone.h + 2 * reb)} x ${reb}, ${S.pocketDepth} deep from the room face` },
    ...(d.panel ? [{ x0: R(d.panel.y - reb - leafTop), x1: R(d.panel.y + d.panel.h + reb - leafTop), y0: dayY0, y1: dayY1, depth: S.pocketDepth, kind: 'panel', side: outerAtTop ? 'bottom' : 'top',
      label: `panel pocket ${R(d.panel.h + 2 * reb)} x ${reb}, ${S.pocketDepth} deep from the room face` }] : []),
  ];
  const edgeOps = [];
  const bores = [];
  const outerEdge = outerAtTop ? 'top' : 'bottom';
  let hiddenStep = null;
  if (isHinge) {
    d.hinges.positions.forEach((pos, k) => {
      edgeOps.push({ edge: outerEdge, x0: R(pos - d.hinges.length / 2), x1: R(pos + d.hinges.length / 2), w: d.hinges.flap, d: d.hinges.thickness, hidden: d.swingFace === 'front',
        z0: d.swingFace === 'front' ? 0 : R(D - d.hinges.flap),
        label: `hinge ${k + 1} recess ${d.hinges.length} x ${d.hinges.flap} x ${d.hinges.thickness} on the hinge edge, from the ${d.swingFace} face` });
    });
  } else {
    const f = d.latch.forend;
    const x = d.latch.fromLeafTop;
    edgeOps.push({ edge: outerEdge, x0: R(x - f.length / 2), x1: R(x + f.length / 2), w: f.width, d: f.thickness, hidden: false, z0: R(d.latch.axisFromFront - f.width / 2),
      label: `latch forend ${f.length} x ${f.width} x ${f.thickness} on the rebated part of the lock edge, axis ${d.latch.axisFromFront} from the front face` });
    edgeOps.push({ edge: outerEdge, x0: R(x - d.latch.bore / 2), x1: R(x + d.latch.bore / 2), w: d.latch.bore, d: d.latch.caseLength, hidden: false, z0: R(d.latch.axisFromFront - d.latch.bore / 2),
      label: `latch bore dia ${d.latch.bore}, ${d.latch.caseLength} deep, on the latch axis` });
    bores.push({ x: R(x), y: outerAtTop ? d.latch.spindleFromEdge : st - d.latch.spindleFromEdge, r: d.latch.spindleBore / 2,
      label: `spindle hole dia ${d.latch.spindleBore} through the leaf, ${d.latch.spindleFromEdge} from the lock edge (backset ${d.latch.backset} + rebate ${d.lockEdge.rebate.w})` });
    // the lock edge rebate: the room face is narrower by the rebate width (swing to the front); the lip is hidden under it
    hiddenStep = { y: outerAtTop ? d.lockEdge.rebate.w : st - d.lockEdge.rebate.w, w: d.lockEdge.rebate.w, d: d.lockEdge.rebate.d, lip: d.lockEdge.lip,
      onRoom: d.swingFace === 'front',
      label: `lock edge rebate ${d.lockEdge.rebate.w} x ${d.lockEdge.rebate.d} full length behind the ${d.lockEdge.lip} lip (${d.swingFace} face)` };
  }
  const code = isHinge ? 'W-DS/H' : 'W-DS/L';
  return {
    key: `${code}-D${d.n}`, name: `${isHinge ? 'Hinge stile' : 'Lock stile'} · door D${d.n} (${d.hingeSide} hand, opens ${d.swing})`, code,
    length: d.leaf.h, face: st, depth: D, section: `${st}x${D}`,
    edgeTop: outerAtTop ? (isHinge ? 'HINGE edge' : 'LOCK edge') : 'glass edge',
    edgeBottom: outerAtTop ? 'glass edge' : (isHinge ? 'HINGE edge' : 'LOCK edge'),
    endLeft: 'TOP end', endRight: 'BOTTOM end',
    visibleFace: 'room', pockets, edgeOps, bores, lips: [], hiddenStep,
    // the rails dowel INTO the stile: their holes are marked on the daylight edge as edge ops
    railHoles: ['W-DOOR TOP RAIL', 'W-DOOR MID RAIL', 'W-DOOR BOTTOM RAIL'].flatMap((el) => {
      const j = jointsOf(pw, `${el} D${d.n}`).find((x) => x.where === (isHinge ? 'hinge end' : 'lock end'));
      if (!j) return [];
      const r = el.includes('TOP') ? d.topRail : el.includes('MID') ? d.midRail : d.bottomRail;
      if (!r) return [];
      const x0 = r.y - leafTop;
      return [{ edge: outerAtTop ? 'bottom' : 'top', x0: R(x0), x1: R(x0 + r.h), dowels: j.holes.map((h) => ({ x: R(x0 + h.across), depth: h.depth })), dia: j.dia, len: j.length,
        label: `${el.replace('W-DOOR ', '').toLowerCase()}: ${j.holes.length} dowel holes dia ${j.dia} x ${j.length / 2} in the glass edge, (${j.holes.map((h) => `${R(x0 + h.across)}, ${h.depth}`).join(') (')}) along, from the front` }];
    }),
    ends: { left: null, right: null },
  };
}

function doorRailDescriptor(derived, pw, d, which) {
  const S = pw.section, D = d.leaf.depth, reb = S.rebate;
  const r = which === 'top' ? d.topRail : which === 'mid' ? d.midRail : d.bottomRail;
  if (!r) return null;
  const el = which === 'top' ? 'W-DOOR TOP RAIL' : which === 'mid' ? 'W-DOOR MID RAIL' : 'W-DOOR BOTTOM RAIL';
  const code = which === 'top' ? 'W-DTR' : which === 'mid' ? 'W-DMR' : 'W-DBR';
  const js = jointsOf(pw, `${el} D${d.n}`);
  const hingeLeft = d.hingeSide === 'left';
  const end = (where) => { const j = js.find((x) => x.where === where); return j ? { holes: j.holes, dia: j.dia, len: j.length, body: j.body, into: j.into, ref: 'from the top edge' } : null; };
  const rebates = which === 'top'
    ? [{ y0: r.h - reb, y1: r.h, label: `through rebate ${reb} x ${S.pocketDepth} on the lower edge (glass)` }]
    : which === 'mid'
      ? [{ y0: 0, y1: reb, label: `through rebate ${reb} x ${S.pocketDepth} on the top edge (glass)` }, { y0: r.h - reb, y1: r.h, label: `through rebate ${reb} x ${S.pocketDepth} on the bottom edge (panel)` }]
      : [{ y0: 0, y1: reb, label: `through rebate ${reb} x ${S.pocketDepth} on the top edge (${d.panel ? 'panel' : 'glass'})` }];
  const headRebate = which === 'top' && d.headEdge ? { y0: 0, y1: d.headEdge.rebate.w, d: d.headEdge.rebate.d, lip: d.headEdge.lip, label: `head rebate ${d.headEdge.rebate.w} x ${d.headEdge.rebate.d} full length behind the ${d.headEdge.lip} lip (${d.swingFace} face)` } : null;
  return {
    key: `${code}-D${d.n}`, name: `${which === 'top' ? 'Top rail' : which === 'mid' ? 'Mid rail' : 'Bottom rail'} · door D${d.n}`, code,
    length: d.daylight.w, face: r.h, depth: D, section: `${r.h}x${D}`,
    edgeTop: which === 'top' ? 'leaf top' : which === 'mid' ? 'glass side' : (d.panel ? 'panel side' : 'glass side'),
    edgeBottom: which === 'bottom' ? 'leaf bottom' : which === 'mid' ? 'panel side' : 'glass side',
    endLeft: hingeLeft ? 'HINGE end (left)' : 'LOCK end (left)', endRight: hingeLeft ? 'LOCK end (right)' : 'HINGE end (right)',
    visibleFace: 'front', rebates, headRebate,
    pockets: [], edgeOps: [], bores: [], lips: [],
    ends: { left: end(hingeLeft ? 'hinge end' : 'lock end'), right: end(hingeLeft ? 'lock end' : 'hinge end') },
  };
}

/** The member descriptors of one member sheet: { title, subtitle, items, notes }. */
export function memberSheetItems(derived, props) {
  const pw = derived?.partition;
  if (!pw) return null;
  const S = pw.section;
  const baseNotes = [
    `Vertical members shown with the ROOM face up (the pockets open to the room) and the top end at the left: the edge at the top of the drawing faces LEFT in the front elevation. Rails shown from the front, top edge up.`,
    `Pockets ${S.rebate} wide, ${S.pocketDepth} deep from the room face, leaving the ${S.upstand} front upstand; a stopped pocket runs ${S.rebate} past the opening at each end so the glass pocket turns the corner. Dowels dia ${pw.dowels.dia} x ${pw.dowels.length}, ${pw.dowels.perJoint} per joint, ${pw.dowels.length / 2} deep in each part; an end view lists its holes as "across / depth": across from the top edge of the drawing, depth from the front face.`,
  ];
  if (props.member === 'post') {
    const g = postGroups(pw).find((x) => x.key === props.group) || postGroups(pw)[0];
    if (!g) return null;
    const items = [...g.posts.map((i) => postDescriptor(derived, pw, i, false)), ...g.mirrored.map((i) => postDescriptor(derived, pw, i, true))].filter(Boolean);
    return { title: g.label, subtitle: `${items[0]?.section} · ${items[0]?.length} long · ${items.length} off`, items: items.slice(0, 1).map((it) => ({ ...it, qty: items.length, others: items.slice(1).map((o) => o.key) })),
      notes: [...baseNotes, ...(g.mirrored.length ? [`${g.mirrored.map((i) => `P${i + 1}`).join(', ')}: the mirror image of this drawing (the same operations on the other edge).`] : [])] };
  }
  if (props.member === 'topRail') {
    const it = topRailDescriptor(derived, pw);
    return { title: 'Top Rail', subtitle: `${it.section} · ${it.length} long · 1 off`, items: [it], notes: baseNotes };
  }
  if (props.member === 'screenRails') {
    const items = [railDescriptor(derived, pw, 'bottomRail', 1), railDescriptor(derived, pw, 'midRail', 1)].filter(Boolean);
    return { title: 'Screen Rails', subtitle: `${items.map((it) => `${it.code.replace('W-', '')} ${it.section} x ${it.length}`).join(' · ')} · ${pw.screens.length} off each`, items, notes: baseNotes };
  }
  const d = pw.doors.find((x) => x.n === props.door) || pw.doors[0];
  if (!d) return null;
  if (props.member === 'doorStiles') {
    const items = [stileDescriptor(derived, pw, d, 'hinge'), stileDescriptor(derived, pw, d, 'lock')];
    return { title: `Door Stiles${pw.doors.length > 1 ? ` D${d.n}` : ''}`, subtitle: `${items[0].section} x ${items[0].length} · ${d.hingeSide} hand, opens ${d.swing}`, items,
      notes: [...baseNotes, `Hinges ${d.hinges.positions.map((p) => R(p)).join(' / ')} from the leaf top: ${d.hinges.name}; knuckle ${d.hinges.knuckle}, flap ${d.hinges.flap} each side, on the ${d.swingFace} face. Latch at ${d.latch.fromFloor} from the floor (${d.latch.fromLeafTop} from the leaf top), its axis ${d.latch.axisFromFront} from the front face in the rebated part of the lock edge.`] };
  }
  if (props.member === 'doorRails') {
    const items = ['top', 'mid', 'bottom'].map((w) => doorRailDescriptor(derived, pw, d, w)).filter(Boolean);
    return { title: `Door Rails${pw.doors.length > 1 ? ` D${d.n}` : ''}`, subtitle: `${items.map((it) => `${it.code.replace('W-', '')} ${it.section} x ${it.length}`).join(' · ')}`, items, notes: baseNotes };
  }
  return null;
}
