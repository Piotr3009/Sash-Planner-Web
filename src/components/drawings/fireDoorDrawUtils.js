/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * fireDoorDrawUtils.js (27.10.2026, fire doors v1): the shared data of the
 * fire door sheets. ONE plan of the sheets for the Drawings tabs, the PDF rig,
 * the Elements PDF and the production pack; the ELEVATION geometry (the LSP
 * kit's outside and inside views, KIT_DOOR_SINGLE.lsp B and C); the PLAN
 * geometry (the LSP's D: closed and open 30); the member descriptors of the
 * frame machining sheet and the op table rows of the machining sheets. Every
 * number comes from derived.firedoor (engine/fireDoor.js); nothing is computed
 * here but the drawing geometry of those numbers. The only literals are the
 * ironmongery SYMBOL sizes of the LSP (IRON below): they are drawn, never
 * printed as a number.
 *
 * Handing on the sheets. The engine's hingeSide is seen from the PULL side,
 * the side the hinge knuckles show (the brief, 3.1). The leaf sits in the
 * rebate against the stop (the 50 face), so it can only swing out of the
 * rebate towards the 35 face: the 35 face view is the pull side and shows the
 * hinges, exactly the LSP's "Outside" view (frame face 35, hinges drawn), and
 * the 50 face view is the push side, the LSP's "Inside" view (no hinges). So:
 *   hingeSide 'left'  = hinges on the LEFT of the OUTSIDE view (and on the
 *                       right of the inside view);
 *   hingeSide 'right' = hinges on the RIGHT of the outside view.
 * The LSP's own "openWay L" drew the hinges on the RIGHT of its outside view
 * (it hands the door from the push side, as the UK trade does), so the LSP's
 * "LH" is the engine's 'right'. The sheets print the engine's wording
 * ("Hinge left / Hinge right", the PSW rule) and never the LSP's LH / RH, so
 * the owner cannot read one convention as the other. The swing ('in' into the
 * room, 'out' into the corridor) only says which side of the wall the pull
 * face is on: the subtitles print it, the geometry is the same.
 *
 * Elevation coordinates (mm): x from the frame's LEFT outer edge as seen in
 * that view, y DOWN from the frame top (the head's top edge); the frame foot
 * is at y = overall height (the jambs stand floorGap below the leaf).
 * Plan coordinates (mm): x as the OUTSIDE view (the pull side viewer's left
 * is the page's left), z through the frame depth from the pull face (0, the
 * 35 face) to the push face (depth, the 50 face). The sheets put the pull
 * face at the BOTTOM of the page, so the open leaf swings down the page.
 */

const R1 = (v) => Math.round(v * 10) / 10;

/** A finite number or the fallback. */
export function num(v, fallback = null) {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : fallback;
}

/**
 * The LSP kit's ironmongery SYMBOL sizes (mm, drawn 1:1 like the LSP draws
 * them; none of them is a dimension of the door and none is printed).
 *   hinge     the elevation hinge rectangle: 10 wide, 3.5 onto the leaf, with
 *             three bearing lines dividing its (engine) length into 4
 *   rose      the handle rose circle R27.5 (dia 55) on the spindle
 *   lever     the lever trapezoid from the rose: 120 long, 5 half high at the
 *             rose, 7 at the tip, towards the hinge side
 *   euro      the euro cylinder: the rose circle, an inner circle R7.5 raised
 *             5, a 10 x 20 slot down from it with R5 bottom corners
 *   bathroom  the bathroom turn: the rose circle, an inner circle R10 and a
 *             15 long horizontal line
 *   plan      the plan symbols: the knuckle circle R5, the handle rose 55 x 4,
 *             neck 10 x 25, lever 110 x 10
 *   openAngle the LSP's open view angle (the "Open 30" label)
 */
export const IRON = Object.freeze({
  hinge: { w: 10, inset: 3.5 },
  rose: { r: 27.5 },
  lever: { len: 120, hub: 5, tip: 7 },
  euro: { innerR: 7.5, up: 5, slotW: 10, slotH: 20, fillet: 5 },
  bathroom: { innerR: 10, line: 15 },
  plan: { knuckleR: 5, rose: { w: 55, d: 4 }, neck: { w: 10, h: 25 }, lever: { len: 110, d: 10 } },
  openAngle: 30,
});

/**
 * Where the OUTSIDE elevation puts its height dimensions: 'left' is the LSP
 * placement (the frame height on the far left, the leaf height nearer, as the
 * brief's Stage 5 asks); 'right' would follow the house dimension rule of the
 * other sheets (heights on the right). One constant so the choice is a line.
 */
export const OUTSIDE_HEIGHT_DIMS_SIDE = 'left';

/** The sheets of one fire door, in tab and PDF order. */
export function fireDoorSheetPlan(derived) {
  const fd = derived?.firedoor;
  if (!fd || derived?.category !== 'firedoor') return [];
  return [
    { key: 'fdoutside', label: 'Outside Elevation', sheet: 'outside', props: { view: 'outside' } },
    { key: 'fdinside', label: 'Inside Elevation', sheet: 'inside', props: { view: 'inside' } },
    { key: 'fdplan', label: 'Plan', sheet: 'plan', props: {} },
    { key: 'fdleaf', label: 'Leaf Machining', sheet: 'leaf', props: {} },
    { key: 'fdframe', label: 'Frame Machining', sheet: 'frame', props: {} },
  ];
}

/** The hero sheet descriptor of the pack and the Elements PDF (the outside elevation). */
export function fireDoorHeroSheet(plan) {
  const hero = (plan || []).find((p) => p.sheet === 'outside') || (plan || [])[0] || null;
  return hero ? { key: hero.key, label: hero.label } : null;
}

/** 'Hinge left' / 'Hinge right' (the PSW wording rule), from the engine's handing. */
export function hingeWord(fd) {
  return fd?.handing?.hingeSide === 'right' ? 'Hinge right' : 'Hinge left';
}

/** The swing in words for a subtitle: 'opens in' / 'opens out'. */
export function swingWord(fd) {
  return `opens ${fd?.handing?.swing === 'out' ? 'out' : 'in'}`;
}

/** The swing explained for the notes: which side of the wall the pull face (the 35 frame face, the hinge knuckles) is on. */
export function pullFaceNote(fd) {
  const s = fd?.handing?.swing === 'out' ? 'out' : 'in';
  return `Opens ${s}: the pull face (the ${s === 'in' ? 'room' : 'corridor'} side) shows the 35 frame face and the hinge knuckles, the push face (the ${s === 'in' ? 'corridor' : 'room'} side) the 50 face with the stop`;
}

/** The rating word of a door: FD30 / FD60 / non-fire. */
export function ratingWord(fd) {
  if (!fd?.fire) return 'non-fire';
  return String(fd.rating || 'FD30');
}

/** The cut list record of an element by its code (FD-HEAD, FD-JAMB-H, FD-JAMB-L, FD-LEAF). */
export function fireDoorRecord(derived, code) {
  const recs = [...(derived?.components?.box || []), ...(derived?.components?.sash || [])];
  return recs.find((r) => (r.code || r.elementName) === code) || null;
}

/**
 * The elevation geometry of one view ('outside' = the pull side, the 35
 * frame face and the hinges; 'inside' = the push side, the 50 face, the leaf
 * dashed behind the frame lip). Returns null without the engine data.
 *   frame    { w, h, face }: the overall frame and the visible face of this view
 *   leaf     { x, y, w, h } in the view's coordinates
 *   hinges   [{ i, top, bottom, x0, x1 }] the LSP hinge rectangles (outside view only)
 *   spindle  { x, y } the handle rose centre; cylinder { kind, x, y } or null
 *   panes    [{ i, x, y, w, h, rotated }] the vision panel panes
 *   label    'Hinge left - Outside' as the LSP prints under the door
 */
export function fireDoorElevationGeometry(derived, view = 'outside') {
  const fd = derived?.firedoor;
  if (!fd) return null;
  const fr = fd.frame || {}, lf = fd.leaf || {};
  const FW = num(fr.overall?.width), FH = num(fr.overall?.height);
  const faceOut = num(fr.faces?.outside), faceIn = num(fr.faces?.inside);
  const gapSide = num(fr.gaps?.side), gapHead = num(fr.gaps?.head), floorGap = num(fr.gaps?.floor);
  const W = num(lf.width), H = num(lf.height), T = num(lf.thickness);
  if ([FW, FH, faceOut, faceIn, gapSide, gapHead, floorGap, W, H].some((v) => v == null) || !(FW > 0 && FH > 0 && W > 0 && H > 0)) return null;
  const inside = view === 'inside';
  const face = inside ? faceIn : faceOut;
  const leaf = { x: faceOut + gapSide, y: faceOut + gapHead, w: W, h: H, t: T };
  const hingeLeftPull = fd.handing?.hingeSide !== 'right';
  const hingesOnLeft = inside ? !hingeLeftPull : hingeLeftPull;
  const hingeEdgeX = hingesOnLeft ? leaf.x : leaf.x + W;
  const lockEdgeX = hingesOnLeft ? leaf.x + W : leaf.x;
  const dirToHinge = hingesOnLeft ? -1 : 1;
  const hingeLen = num(fd.hinges?.length, 0);
  const hinges = (fd.hinges?.positions || []).map((p, k) => {
    const top = leaf.y + num(p.top, 0);
    const x0 = hingesOnLeft ? hingeEdgeX + IRON.hinge.inset - IRON.hinge.w : hingeEdgeX - IRON.hinge.inset;
    return { i: num(p.i, k), top, bottom: top + hingeLen, x0, x1: x0 + IRON.hinge.w, fromTop: num(p.top, 0) };
  });
  const lock = fd.lock || {};
  const backset = num(lock.backset, 0);
  const spindle = lock.spindle
    ? { x: lockEdgeX + dirToHinge * num(lock.spindle.fromLockEdge, backset), y: leaf.y + H - num(lock.spindle.fromBottom, 0), fromBottom: num(lock.spindle.fromBottom, 0) }
    : null;
  const cylinder = lock.cylinder
    ? { kind: lock.cylinder.kind, x: lockEdgeX + dirToHinge * num(lock.cylinder.fromLockEdge, backset), y: leaf.y + H - num(lock.cylinder.fromBottom, 0), fromBottom: num(lock.cylinder.fromBottom, 0) }
    : null;
  const panes = (fd.vp?.panes || []).map((p, k) => {
    const b = paneBox(p);
    const px = hingesOnLeft ? leaf.x + b.y : leaf.x + W - b.y - b.w;
    return { i: num(p.i, k), x: px, y: leaf.y + b.x, w: b.w, h: b.h, paneW: b.paneW, paneH: b.paneH, diamond: b.diamond };
  });
  const viewWord = inside ? 'Inside' : 'Outside';
  return {
    fd, frame: { w: FW, h: FH, face }, faceOut, faceIn, floorGap, gapSide, gapHead, leaf, inside, view: inside ? 'inside' : 'outside',
    hingesOnLeft, hingeEdgeX, lockEdgeX, dirToHinge, hinges, hingeLen, spindle, cylinder, panes,
    label: `${hingeWord(fd)} - ${viewWord}`, viewWord,
  };
}

/**
 * A pane (or a vpCutout op) turned by an angle that is not a multiple of 90
 * is drawn as a diamond: the engine marks the 45 diamond AND a 90 turn as
 * `rotated`, the angle tells them apart.
 */
export function isDiamond(p) {
  return !!p?.rotated && Math.abs(num(p.angle, 0)) % 90 !== 0;
}

/**
 * The drawn box of a pane of derived.firedoor.vp.panes in BOARD coordinates:
 * x from the leaf top, y from the hinge edge (the engine's x / y are the
 * bounding box corner), w / h the bounding box (`box`, the pane itself for an
 * unturned pane), paneW / paneH the glass size, diamond for the 45 turn.
 */
export function paneBox(p) {
  const box = p?.box || p?.bbox || { w: p?.w, h: p?.h };
  const w = num(box.w, num(p?.w, 0)), h = num(box.h, num(p?.h, 0));
  return { x: num(p?.x, 0), y: num(p?.y, 0), w, h, paneW: num(p?.w, w), paneH: num(p?.h, h), diamond: isDiamond(p) };
}

/** The diamond of a turned pane: the four edge midpoints of its bounding box. */
export function diamondPoints(r) {
  return [[r.x + r.w / 2, r.y], [r.x + r.w, r.y + r.h / 2], [r.x + r.w / 2, r.y + r.h], [r.x, r.y + r.h / 2]];
}

/** The LSP lever trapezoid from the rose centre towards the hinge side (polygon points, mm). */
export function leverPoints(cx, cy, dir) {
  const L = IRON.lever;
  return [[cx, cy - L.hub], [cx + dir * L.len, cy - L.tip], [cx + dir * L.len, cy + L.tip], [cx, cy + L.hub]];
}

const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

/** Rotate a point about (cx, cz) by `deg` degrees in the (x, z) plane. */
function rot(pt, cx, cz, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const dx = pt[0] - cx, dz = pt[1] - cz;
  return [R1(cx + dx * c - dz * s), R1(cz + dx * s + dz * c)];
}

/**
 * The LSP handle in plan on one face of the leaf, as one closed outline: the
 * rose (55 x 4) on the face, the neck (10 x 25) and the lever (110 x 10)
 * towards the hinge side. `out` = +1 for the pull face (the symbol grows to
 * z < 0), -1 for the push face (to z > T); faceZ the face plane.
 */
function handlePlanPoints(hX, faceZ, out, dir) {
  const P = IRON.plan;
  const rW = P.rose.w / 2, rD = P.rose.d, sW = P.neck.w / 2, sH = P.neck.h, lL = P.lever.len, lD = P.lever.d;
  const z = (d) => faceZ - out * d;
  return [
    [hX - rW, z(0)], [hX + rW, z(0)],
    [hX + dir * rW, z(rD)], [hX + dir * sW, z(rD)], [hX + dir * sW, z(rD + sH)],
    [hX + dir * (sW + lL), z(rD + sH)], [hX + dir * (sW + lL), z(rD + sH + lD)],
    [hX + dir * sW, z(rD + sH + lD)], [hX - dir * sW, z(rD + sH + lD)],
    [hX - dir * sW, z(rD)], [hX - dir * rW, z(rD)],
  ];
}

/**
 * The PLAN geometry (the LSP's drawDoorPlan): the two L shaped jambs with the
 * rebate notch (rebate width across the thickness, rebate depth along the
 * frame depth) on the opening side, the leaf closed in the rebate flush with
 * the pull face, the hinge symbol (knuckle in the gap in front of the pull
 * face, the fixed flap let into the rebate cheek, the moving flap into the
 * leaf edge, both the engine's recess depth thick and recess width long), the
 * handle on both faces, and the same leaf swung open by IRON.openAngle about
 * the knuckle with the opening arc. Points are [x, z] in mm.
 */
export function fireDoorPlanGeometry(derived) {
  const fd = derived?.firedoor;
  if (!fd) return null;
  const fr = fd.frame || {}, lf = fd.leaf || {};
  const FW = num(fr.overall?.width), depth = num(fr.depth), thk = num(fr.thickness), faceOut = num(fr.faces?.outside);
  const rebW = num(fr.rebate?.width), rebD = num(fr.rebate?.depth), gap = num(fr.gaps?.side);
  const W = num(lf.width), T = num(lf.thickness);
  if (!(FW > 0 && depth > 0 && thk > 0 && W > 0 && T > 0) || [faceOut, rebW, rebD, gap].some((v) => v == null)) return null;
  const hingeLeft = fd.handing?.hingeSide !== 'right';
  const dir = hingeLeft ? -1 : 1;                       // towards the hinge side along x
  const leafX0 = faceOut + gap, leafX1 = leafX0 + W;
  const jambL = [[0, 0], [faceOut, 0], [faceOut, rebD], [thk, rebD], [thk, depth], [0, depth]];
  const jambR = jambL.map(([x, z]) => [R1(FW - x), z]);
  const rec = fd.hinges?.recess || {};
  const flapT = num(rec.depth, 0), flapL = num(rec.width, 0);
  const hingeEdge = hingeLeft ? leafX0 : leafX1;
  const cheek = hingeLeft ? faceOut : FW - faceOut;    // the rebate cheek the leaf edge meets
  const lockEdge = hingeLeft ? leafX1 : leafX0;
  const kr = IRON.plan.knuckleR;
  const knuckle = { x: R1((hingeEdge + cheek) / 2), z: -kr, r: kr };
  const fixedFlap = hingeLeft ? rect(cheek - flapT, cheek, 0, flapL) : rect(cheek, cheek + flapT, 0, flapL);
  const movingFlap = hingeLeft ? rect(hingeEdge, hingeEdge + flapT, 0, flapL) : rect(hingeEdge - flapT, hingeEdge, 0, flapL);
  const backset = num(fd.lock?.spindle?.fromLockEdge, num(fd.lock?.backset, 0));
  const hX = lockEdge + dir * backset;
  const leaf = rect(leafX0, leafX1, 0, T);
  const handlePull = handlePlanPoints(hX, 0, 1, dir);
  const handlePush = handlePlanPoints(hX, T, -1, dir);
  // the open view: the lock end swings out of the rebate towards z < 0 (down the page)
  const ang = hingeLeft ? -IRON.openAngle : IRON.openAngle;
  const R = (pts) => pts.map((p) => rot(p, knuckle.x, knuckle.z, ang));
  const closedCorner = [lockEdge, 0];
  const openCorner = rot(closedCorner, knuckle.x, knuckle.z, ang);
  const arcR = R1(Math.hypot(closedCorner[0] - knuckle.x, closedCorner[1] - knuckle.z));
  const open = { leaf: R(leaf), handlePull: R(handlePull), handlePush: R(handlePush), movingFlap: R(movingFlap), arc: { cx: knuckle.x, cz: knuckle.z, r: arcR, from: closedCorner, to: openCorner, clockwise: hingeLeft } };
  const all = [...jambL, ...jambR, ...leaf, ...handlePull, ...handlePush, ...open.leaf, ...open.handlePull, ...open.handlePush, [knuckle.x, knuckle.z - kr]];
  const zMin = Math.min(...all.map((p) => p[1]));
  const zMax = Math.max(...all.map((p) => p[1]));
  const closedAll = [...jambL, ...jambR, ...leaf, ...handlePull, ...handlePush, [knuckle.x, knuckle.z - kr]];
  return {
    fd, FW, depth, thk, faceOut, rebW, rebD, gap, W, T, hingeLeft, dir, leafX0, leafX1, hingeEdge, cheek, lockEdge, hX, backset,
    jambs: [jambL, jambR], leaf, knuckle, fixedFlap, movingFlap, handlePull, handlePush, open,
    zMin, zMax, closedZMin: Math.min(...closedAll.map((p) => p[1])), openAngle: IRON.openAngle,
  };
}

/** The face word of a machining op as the sheets print it. */
export function faceWord(face) {
  const words = {
    pull: 'pull face', push: 'push face', hingeEdge: 'hinge edge', lockEdge: 'lock edge', top: 'top edge', bottom: 'bottom edge',
    opening: 'opening face', rebateCheek: 'rebate cheek', end: 'end', wall: 'wall face', outside: 'outside face', inside: 'inside face',
  };
  return words[face] || String(face || '');
}

/** The op kind in words. */
export function kindWord(kind) {
  const words = {
    hingeRecess: 'hinge recess', forendRecess: 'forend recess', casePocket: 'case pocket', spindleHole: 'spindle hole', cylinderHole: 'cylinder hole',
    vpCutout: 'vision panel cut-out', intuGroove: 'intumescent groove', leadEdge: 'leading edge', rebate: 'rebate', keepPlate: 'keep plate',
    keepPocket: 'keep pocket', mitre: 'mitre',
  };
  return words[kind] || String(kind || '');
}

/**
 * The op table rows of one element: { no, element, kind, face, x, y, z, length,
 * width, depth, radius, note } with the numbers as the engine gives them
 * (null where an op has none, e.g. a mitre's radius).
 */
export function opTableRows(ops, element, startNo = 1) {
  return (ops || []).map((op, k) => ({
    no: startNo + k,
    element,
    id: op.id || '',
    kind: kindWord(op.kind),
    face: faceWord(op.face),
    x: num(op.x), y: num(op.y), z: num(op.z),
    length: num(op.length), width: num(op.width), depth: num(op.depth), radius: num(op.radius),
    note: [op.angle != null ? `${op.angle} deg` : '', op.value != null ? `value ${op.value}` : '', op.rotated ? 'rotated 45' : '', op.note || ''].filter(Boolean).join(', '),
  }));
}

/**
 * The frame members of the machining sheet, in the engine's order (head,
 * hinge jamb, lock jamb): the member of derived.firedoor.frame.members with
 * its ops of derived.firedoor.machining and its cut list record.
 */
export function fireDoorFrameMembers(derived) {
  const fd = derived?.firedoor;
  if (!fd) return [];
  const mach = fd.machining || {};
  const titles = { head: 'HEAD', jambHinge: 'HINGE JAMB', jambLock: 'LOCK JAMB' };
  return (fd.frame?.members || []).map((m) => ({
    ...m,
    title: titles[m.role] || String(m.role || m.id || '').toUpperCase(),
    ops: mach[m.role] || [],
    record: fireDoorRecord(derived, m.id),
  }));
}

/** The leaf ops grouped by kind: { hingeRecess: [], forendRecess: [], ... } (every kind present). */
export function leafOpsByKind(derived) {
  const ops = derived?.firedoor?.machining?.leaf || [];
  const out = {};
  ops.forEach((op) => { (out[op.kind] = out[op.kind] || []).push(op); });
  return out;
}

/** Whole paragraphs wrapped to a sheet width: `chars` characters per line at 0.55 x font size per character. */
export function wrapLines(notes, width, fontSize) {
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
