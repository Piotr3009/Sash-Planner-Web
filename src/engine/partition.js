/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * partition.js (25.10.2026): the meeting room partition wall engine, the
 * 'partition' batch category. One straight wall per record: a head board over
 * two end boards, one top rail between the end boards, posts from the top
 * rail to the floor (no threshold), and between the posts a layout of glazed
 * SCREENS ('S') and DOORS ('D'), e.g. 'SDS' (the Windmill Street bay 2525 x
 * 2165). Solid oak, oiled, every member the same depth through the wall.
 *
 * Coordinates: x from the LEFT outer face of the left end board, y from the
 * TOP of the head board (the floor is y = H). The FRONT face is the corridor
 * side (the plan drawing's front); the beads and the door stop are on the ROOM
 * face; the door swings out to the corridor (Piotr 25.10.2026).
 *
 * Section rule (every member): a solid upstand on the front face, the glass
 * zone (unit + 2 x tape) behind it, a bead on the room face; the rebate goes
 * `rebateDepth` into the member width and the unit sits `glassIn` into it
 * (daylight 1000 = unit 1027). Rails are cut to the field width with square
 * ends and THROUGH rebates; posts and stiles carry STOPPED pockets, one per
 * opening, `rebateDepth` longer than the opening at each end so the glass
 * pocket runs round the corner; the beads mitre inside it (bead length =
 * daylight + 2 x rebate). Joints: dowels (partitionJoints.js), no screws.
 *
 * Every workshop number comes from the partition profile (profile.js
 * DEFAULT_PARTITION_PROFILE); the ASSUMPTIONs are flagged there and in
 * docs/BLOCKERS.md 34.x.
 */
import { getPartitionProfile, kgPerM } from './profile.js';
import { doorHingePositions, doorHingeCount } from './doorHardware.js';
import { round, createComponentRecord } from './records.js';
import { dowelHoles, bodyBand } from './partitionJoints.js';

export class PartitionGeometryError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'PartitionGeometryError';
    this.details = details || {};
  }
}

const R = (v) => Math.round(v * 10) / 10;
// mirrors calculations.CONSTANTS.WEIGHT_MARGIN_PCT (not imported: calculations imports this module)
const DEFAULT_WEIGHT_MARGIN_PCT = 5;
const MIN_LIGHT = 100;
const MIN_SCREEN = 200;
const MIN_UPSTAND = 8;

/** The layout string: 'S' screens and 'D' doors only, at least one field. */
export function normalisePartitionLayout(value, fallback = 'S') {
  const s = String(value ?? '').toUpperCase().replace(/[^SD]/g, '');
  return s || fallback;
}

/** The partition fields of a layout: kind and index per kind. */
export function partitionFields(layout) {
  let s = 0, d = 0;
  return layout.split('').map((kind, i) => ({ kind, i, n: kind === 'S' ? ++s : ++d }));
}

export function derivePartitionWindow(windowSpec, frameWidth, frameHeight, settings) {
  const P = getPartitionProfile();
  const W = Number(frameWidth), H = Number(frameHeight);
  if (!(W > 0) || !(H > 0)) throw new PartitionGeometryError('Partition size must be positive', { W, H });
  const spec = windowSpec?.partition || {};
  const E = P.elements, G = P.glazing, D = P.door, J = P.joints, HG = P.hinges, HW = P.hardware;
  const depth = Number(P.depth);

  // ── the configuration ──
  const layout = normalisePartitionLayout(spec.layout, P.defaults.layout);
  const fields = partitionFields(layout);
  const nScreens = fields.filter((f) => f.kind === 'S').length;
  const nDoors = fields.length - nScreens;
  const lights = Math.max(1, Math.round(Number(spec.lights ?? P.defaults.lights) || 1));
  const panelH = Math.max(0, Number(spec.panelHeight ?? P.defaults.panelHeight) || 0);
  const hingeSide = spec.hingeSide === 'right' ? 'right' : 'left';
  const swing = spec.swing === 'in' ? 'in' : 'out';
  const stopFace = swing === 'out' ? 'room' : 'front';     // the stop (and the leaf lip's opposite) face
  const swingFace = swing === 'out' ? 'front' : 'room';    // the hinge knuckles and the leaf lip

  // ── the section ──
  const board = Number(E.board.face);
  const boardWidth = depth + 2 * Number(E.board.overhang);
  const post = Number(E.post.face), topRail = Number(E.topRail.face), midRail = Number(E.midRail.face), bottomRail = Number(E.bottomRail.face);
  const barW = Number(E.bar.face), barT = Number(E.bar.thickness);
  const beadW = Number(E.bead.width), beadT = Number(E.bead.thickness);
  const reb = Number(G.rebateDepth), glassIn = Number(G.glassIn), play = R(reb - glassIn);
  const zoneDepth = Number(G.unit) + 2 * Number(G.tape);
  const upstand = R(depth - zoneDepth - beadT);
  if (upstand < MIN_UPSTAND) throw new PartitionGeometryError(`Front upstand ${upstand} too thin: depth ${depth} - glass zone ${zoneDepth} - bead ${beadT}`, { depth, zoneDepth, beadT });
  const pocketDepth = R(depth - upstand);                   // the pocket from the room face through to the upstand
  const panelT = Number(P.panel.thickness), panelIn = Number(P.panel.panelIn);

  // ── horizontal: end boards, posts, fields ──
  const inner = W - 2 * board;
  const nPosts = fields.length + 1;
  let doorW = Number(spec.doorWidth ?? P.defaults.doorWidth) || 0;
  if (!nScreens) doorW = nDoors ? (inner - nPosts * post) / nDoors : 0;
  const screenW = nScreens ? (inner - nPosts * post - nDoors * doorW) / nScreens : 0;
  if (nScreens && screenW < MIN_SCREEN) throw new PartitionGeometryError(`Screens ${R(screenW)} wide: the wall ${W} is too narrow for layout ${layout} with a ${doorW} door`, { W, layout, doorW, screenW });
  if (nDoors && doorW < MIN_SCREEN) throw new PartitionGeometryError(`Door opening ${R(doorW)} too narrow`, { doorW });
  const posts = [];
  const laidFields = [];
  let cursor = board;
  fields.forEach((f, i) => {
    posts.push({ i, x: R(cursor), w: post, left: i ? fields[i - 1] : null, right: f });
    cursor += post;
    const w = f.kind === 'S' ? screenW : doorW;
    laidFields.push({ ...f, x: R(cursor), w: R(w) });
    cursor += w;
  });
  posts.push({ i: fields.length, x: R(cursor), w: post, left: fields[fields.length - 1], right: null });

  // ── vertical: head board, top rail, the screens' rails ──
  const topRailY0 = board, topRailY1 = board + topRail;
  const postLen = H - topRailY1;                           // the posts and the door opening height
  const bottomRailY0 = H - bottomRail;
  const hasPanel = panelH > 0;
  const panelY1 = bottomRailY0, panelY0 = bottomRailY0 - panelH;
  const midRailY1 = hasPanel ? panelY0 : null, midRailY0 = hasPanel ? panelY0 - midRail : null;
  const zoneY0 = topRailY1, zoneY1 = hasPanel ? midRailY0 : bottomRailY0;
  const zoneH = zoneY1 - zoneY0;
  const lightH = (zoneH - (lights - 1) * barW) / lights;
  if (lightH < MIN_LIGHT) throw new PartitionGeometryError(`Lights ${R(lightH)} high: ${lights} lights do not fit the glazed zone ${R(zoneH)}`, { zoneH, lights });
  const screenBars = [];
  for (let i = 1; i < lights; i += 1) screenBars.push({ y: R(zoneY0 + i * lightH + (i - 1) * barW), h: barW });
  const screenLights = [];
  for (let i = 0; i < lights; i += 1) screenLights.push({ y: R(zoneY0 + i * (lightH + barW)), h: R(lightH) });
  const midRailAxis = hasPanel ? (midRailY0 + midRailY1) / 2 : null;

  // the glass unit of a daylight (glassIn into the rebate each way) and its applied bars (from the unit top)
  const unitOf = (w, h) => ({ w: R(w + 2 * glassIn), h: R(h + 2 * glassIn) });
  const unitBars = (bars, zoneTop) => ({ v: 0, h: bars.length, x: [], y: bars.map((b) => R(b.y + barW / 2 - zoneTop + glassIn)) });

  const screens = laidFields.filter((f) => f.kind === 'S').map((f) => ({
    n: f.n, i: f.i, x: f.x, w: f.w,
    zone: { x: f.x, y: zoneY0, w: f.w, h: R(zoneH) },
    lights: screenLights.map((l) => ({ x: f.x, w: f.w, ...l })),
    bars: screenBars.map((b) => ({ x: f.x, w: f.w, ...b })),
    midRail: hasPanel ? { x: f.x, y: midRailY0, w: f.w, h: midRail } : null,
    panel: hasPanel ? { x: f.x, y: panelY0, w: f.w, h: panelH, size: { w: R(f.w + 2 * panelIn), h: R(panelH + 2 * panelIn), t: panelT } } : null,
    bottomRail: { x: f.x, y: bottomRailY0, w: f.w, h: bottomRail },
    unit: { ...unitOf(f.w, zoneH), bars: unitBars(screenBars, zoneY0) },
  }));

  // ── the door(s) ──
  const gap = Number(D.gap), floorCl = Number(D.floorClearance);
  const stile = Number(E.doorStile.face), dTop = Number(E.doorTop.face), dBottom = Number(E.doorBottom.face), dMid = Number(E.doorMid.face);
  const lip = Number(D.lipFront), stopW = Number(D.stopWidth);
  const lockRebateD = R(depth - lip);                      // the leaf lock edge rebate behind the lip
  const stopD = R(depth - lip - gap);                      // the stop lip on the post, the gap short of the lip
  const flap = R((Number(HG.open) - Number(HG.knuckle)) / 2);
  const leafW = doorW - 2 * gap, leafH = postLen - gap - floorCl;
  const doors = laidFields.filter((f) => f.kind === 'D').map((f) => {
    const leafX = f.x + gap, leafY = topRailY1 + gap;
    const dayW = leafW - 2 * stile;
    if (dayW < MIN_LIGHT) throw new PartitionGeometryError(`Door daylight ${R(dayW)}: the leaf ${R(leafW)} is too narrow for two ${stile} stiles`, { leafW, stile });
    const dZoneY0 = leafY + dTop;
    const dBottomY0 = H - floorCl - dBottom;
    const doorHasPanel = hasPanel && D.glazed !== 'full';
    const dMidY0 = doorHasPanel ? R(midRailAxis - dMid / 2) : null, dMidY1 = doorHasPanel ? R(midRailAxis + dMid / 2) : null;
    const dZoneY1 = doorHasPanel ? dMidY0 : dBottomY0;
    const dZoneH = R(dZoneY1 - dZoneY0);
    if (dZoneH < MIN_LIGHT) throw new PartitionGeometryError(`Door glazed zone ${dZoneH} too low`, { dZoneH });
    // the door bars follow the screen bar lines inside the leaf zone; a door-only wall splits its own zone
    let bars = screenBars.filter((b) => b.y >= dZoneY0 && b.y + b.h <= dZoneY1).map((b) => ({ x: R(leafX + stile), w: R(dayW), y: b.y, h: barW }));
    if (!nScreens && lights > 1) {
      const lh = (dZoneH - (lights - 1) * barW) / lights;
      bars = [];
      for (let i = 1; i < lights; i += 1) bars.push({ x: R(leafX + stile), w: R(dayW), y: R(dZoneY0 + i * lh + (i - 1) * barW), h: barW });
    }
    const dLights = [];
    let y = dZoneY0;
    bars.forEach((b) => { dLights.push({ x: b.x, w: b.w, y: R(y), h: R(b.y - y) }); y = b.y + b.h; });
    dLights.push({ x: R(leafX + stile), w: R(dayW), y: R(y), h: R(dZoneY1 - y) });
    const hingePos = doorHingePositions(leafH, HG);        // hinge centres from the leaf top
    const hingePost = hingeSide === 'left' ? posts[f.i] : posts[f.i + 1];
    const lockPost = hingeSide === 'left' ? posts[f.i + 1] : posts[f.i];
    hingePost[hingeSide === 'left' ? 'hingeRight' : 'hingeLeft'] = f.n;
    lockPost[hingeSide === 'left' ? 'lockLeft' : 'lockRight'] = f.n;
    const handleY = H - Number(HW.handleHeight);
    const panelZoneH = doorHasPanel ? R(dBottomY0 - dMidY1) : 0;
    return {
      n: f.n, i: f.i, x: f.x, w: f.w, openingH: R(postLen),
      hingeSide, swing, stopFace, swingFace,
      leaf: { x: R(leafX), y: R(leafY), w: R(leafW), h: R(leafH), depth: Number(D.leafDepth) || depth },
      members: { stile, top: dTop, bottom: dBottom, mid: doorHasPanel ? dMid : 0 },
      daylight: { x: R(leafX + stile), y: R(dZoneY0), w: R(dayW), h: dZoneH },
      zone: { x: R(leafX + stile), y: R(dZoneY0), w: R(dayW), h: dZoneH },
      lights: dLights, bars,
      topRail: { x: R(leafX), y: R(leafY), w: R(leafW), h: dTop },
      midRail: doorHasPanel ? { x: R(leafX), y: dMidY0, w: R(leafW), h: dMid } : null,
      bottomRail: { x: R(leafX), y: R(dBottomY0), w: R(leafW), h: dBottom },
      panel: doorHasPanel ? { x: R(leafX + stile), y: dMidY1, w: R(dayW), h: panelZoneH, size: { w: R(dayW + 2 * panelIn), h: R(panelZoneH + 2 * panelIn), t: panelT } } : null,
      unit: { ...unitOf(dayW, dZoneH), bars: unitBars(bars, dZoneY0) },
      hinges: {
        count: doorHingeCount(leafH, HG), positions: hingePos.map(R),
        wallY: hingePos.map((p) => R(leafY + p)), fromFloor: hingePos.map((p) => R(H - leafY - p)),
        length: Number(HG.length), open: Number(HG.open), thickness: Number(HG.thickness), flap, knuckle: Number(HG.knuckle),
        radius: !!HG.radius, name: HG.name, face: swingFace, post: hingePost.i,
      },
      // the latch sits in the REBATED part of the lock edge (behind the lip):
      // its axis at the middle of that part's depth, the backset from the
      // rebated edge face, so the spindle is backset + rebate from the lip edge
      latch: {
        kind: HW.latch, fromLeafTop: R(handleY - leafY), fromFloor: Number(HW.handleHeight), wallY: R(handleY),
        backset: Number(HW.latchBackset), caseLength: Number(HW.latchCase), bore: Number(HW.latchBore),
        axisFromFront: R(lip + lockRebateD / 2), spindleFromEdge: R(Number(HW.latchBackset) + stopW),
        spindle: Number(HW.spindle), spindleBore: Number(HW.spindleBore), forend: { ...HW.forend }, keepBolt: { ...HW.keepBolt }, post: lockPost.i,
      },
      lockEdge: { lip, lipFace: swingFace, rebate: { w: stopW, d: lockRebateD } },
      headEdge: D.headStop === 'planted' ? { lip, lipFace: swingFace, rebate: { w: stopW, d: lockRebateD } } : null,
      stop: { w: stopW, d: stopD, face: stopFace, post: lockPost.i, head: D.headStop === 'planted' ? { w: stopW, d: stopD, length: R(doorW) } : null },
    };
  });

  // ── the posts: roles per side, pockets, lips ──
  const sideIsScreen = (f) => !!f && f.kind === 'S';
  posts.forEach((p) => {
    p.rebated = { left: sideIsScreen(p.left), right: sideIsScreen(p.right) };
    p.lips = { left: !!p.lockLeft, right: !!p.lockRight };
    p.blank = R(post + (p.lips.left ? stopW : 0) + (p.lips.right ? stopW : 0));
    p.role = p.lockLeft || p.lockRight ? 'lock' : (p.hingeLeft || p.hingeRight ? 'hinge' : (p.left && p.right ? 'mullion' : 'end'));
    // stopped pockets along the post, y from the post TOP end (the top rail underside)
    const pockets = [];
    ['left', 'right'].forEach((side) => {
      if (!p.rebated[side]) return;
      pockets.push({ side, kind: 'glass', from: 0, to: R(zoneY1 + reb - topRailY1), w: reb, d: pocketDepth });
      if (hasPanel) pockets.push({ side, kind: 'panel', from: R(panelY0 - reb - topRailY1), to: R(panelY1 + reb - topRailY1), w: reb, d: pocketDepth });
    });
    p.pockets = pockets;
    p.length = R(postLen);
  });
  // the top rail: stopped pockets along its underside, x from its left end (the left end board's inner face)
  const topRailPockets = screens.map((s) => ({ screen: s.n, from: R(s.x - reb - board), to: R(s.x + s.w + reb - board), w: reb, d: pocketDepth }));

  // ── the dowel joints ──
  const joints = [];
  const addJoint = (element, where, into, band, note = '') => {
    const dh = dowelHoles({ ...band, depth, upstand, J });
    joints.push({ element, where, into, ref: band.ref, holes: dh.holes, dia: dh.dia, length: dh.length, body: [band.bodyFrom, band.bodyTo], note });
    return dh.holes.length;
  };
  let dowels = 0;
  posts.forEach((p) => {
    dowels += addJoint(`W-POST ${p.i + 1}`, 'top end', 'W-TOP RAIL', { ...bodyBand(post, reb, { low: p.rebated.left, high: p.rebated.right }), ref: 'from the left edge of the 50 core' });
  });
  screens.forEach((s) => {
    const bb = { ...bodyBand(bottomRail, reb, { low: true, high: false }), ref: 'from the top edge' };
    dowels += addJoint(`W-BOTTOM RAIL S${s.n}`, 'left end', `W-POST ${s.i + 1}`, bb);
    dowels += addJoint(`W-BOTTOM RAIL S${s.n}`, 'right end', `W-POST ${s.i + 2}`, bb);
    if (hasPanel) {
      const mb = { ...bodyBand(midRail, reb, { low: true, high: true }), ref: 'from the top edge' };
      dowels += addJoint(`W-MID RAIL S${s.n}`, 'left end', `W-POST ${s.i + 1}`, mb);
      dowels += addJoint(`W-MID RAIL S${s.n}`, 'right end', `W-POST ${s.i + 2}`, mb);
    }
  });
  doors.forEach((d) => {
    const tb = { ...bodyBand(dTop, reb, { low: false, high: true }), ref: 'from the top edge' };
    const bb = { ...bodyBand(dBottom, reb, { low: !!d.panel, high: false }), ref: 'from the top edge' };
    ['hinge stile', 'lock stile'].forEach((st) => {
      dowels += addJoint(`W-DOOR TOP RAIL D${d.n}`, st === 'hinge stile' ? 'hinge end' : 'lock end', `W-DOOR STILE (${st === 'hinge stile' ? 'HINGE' : 'LOCK'})`, tb);
      dowels += addJoint(`W-DOOR BOTTOM RAIL D${d.n}`, st === 'hinge stile' ? 'hinge end' : 'lock end', `W-DOOR STILE (${st === 'hinge stile' ? 'HINGE' : 'LOCK'})`, bb);
      if (d.midRail) dowels += addJoint(`W-DOOR MID RAIL D${d.n}`, st === 'hinge stile' ? 'hinge end' : 'lock end', `W-DOOR STILE (${st === 'hinge stile' ? 'HINGE' : 'LOCK'})`, { ...bodyBand(dMid, reb, { low: true, high: true }), ref: 'from the top edge' });
    });
  });

  // ── the cut list records ──
  const mk = (group, name, section, length, qty, code, notes = '') => {
    const rec = createComponentRecord(windowSpec, group, name, section, length, qty, notes);
    rec.length = R(length);
    rec.code = code;
    return rec;
  };
  const secMember = (face) => `${face}x${depth}`;
  const secBoard = `${board}x${boardWidth}`;
  const secBar = `${barW}x${barT}`;
  const secBead = `${beadW}x${beadT}`;
  const box = [];
  box.push(mk('box', 'W-HEAD BOARD', secBoard, W, 1, 'W-HB', `${board} x ${boardWidth}, over the end boards, ${Number(E.board.overhang)} proud each face`));
  box.push(mk('box', 'W-END BOARD', secBoard, H - board, 2, 'W-EB', `${board} x ${boardWidth}, under the head board, ${Number(E.board.overhang)} proud each face`));
  box.push(mk('box', 'W-TOP RAIL', secMember(topRail), inner, 1, 'W-TR', `one piece between the end boards · ${topRailPockets.length} stopped glass pocket${topRailPockets.length === 1 ? '' : 's'} on the underside`));
  const plainPosts = posts.filter((p) => p.blank === post);
  const lipPosts = posts.filter((p) => p.blank !== post);
  if (plainPosts.length) box.push(mk('box', 'W-POST', secMember(post), postLen, plainPosts.length, 'W-P', plainPosts.map((p) => `P${p.i + 1} ${p.role}`).join(', ')));
  lipPosts.forEach((p) => box.push(mk('box', 'W-POST (LOCK)', secMember(p.blank), postLen, 1, 'W-PL', `P${p.i + 1} lock post · stop lip ${stopW} x ${stopD} from solid, ${stopFace} face`)));
  screens.forEach((s) => {
    if (s.midRail) box.push(mk('box', 'W-MID RAIL', secMember(midRail), s.w, 1, 'W-MR', `S${s.n} · through rebate both edges`));
    box.push(mk('box', 'W-BOTTOM RAIL', secMember(bottomRail), s.w, 1, 'W-BR', `S${s.n} · on the floor · through rebate on the top edge`));
  });
  const screenBarCount = screens.length * 2 * screenBars.length;
  if (screenBarCount) box.push(mk('box', 'W-BAR', secBar, screenW, screenBarCount, 'W-GB', `applied glazing bar, ${screenBars.length} per face per screen`));
  screens.forEach((s) => {
    box.push(mk('box', 'W-BEAD', secBead, s.w + 2 * reb, 2, 'W-BD', `S${s.n} glass · horizontal, mitred`));
    box.push(mk('box', 'W-BEAD', secBead, zoneH + 2 * reb, 2, 'W-BD', `S${s.n} glass · vertical, mitred`));
    if (s.panel) {
      box.push(mk('box', 'W-BEAD', secBead, s.w + 2 * reb, 2, 'W-BD', `S${s.n} panel · horizontal, mitred`));
      box.push(mk('box', 'W-BEAD', secBead, panelH + 2 * reb, 2, 'W-BD', `S${s.n} panel · vertical, mitred`));
    }
  });
  doors.forEach((d) => {
    if (d.stop.head) box.push(mk('box', 'W-DOOR HEAD STOP', `${stopW}x${stopD}`, doorW, 1, 'W-HS', `D${d.n} · planted under the top rail, ${stopFace} face`));
  });
  const sash = [];
  doors.forEach((d) => {
    const ld = d.leaf.depth;
    const sec = (face) => `${face}x${ld}`;
    sash.push(mk('sash', 'W-DOOR STILE (HINGE)', sec(stile), leafH, 1, 'W-DS/H', `D${d.n} · ${d.hinges.count} hinge recesses ${d.hinges.length} x ${flap} x ${d.hinges.thickness}, ${swingFace} face`));
    sash.push(mk('sash', 'W-DOOR STILE (LOCK)', sec(stile), leafH, 1, 'W-DS/L', `D${d.n} · lock edge rebate ${stopW} x ${lockRebateD} behind the ${lip} lip · latch at ${d.latch.fromLeafTop} from the top`));
    sash.push(mk('sash', 'W-DOOR TOP RAIL', sec(dTop), d.daylight.w, 1, 'W-DTR', `D${d.n} · through rebate on the lower edge${d.headEdge ? ` · head rebate ${stopW} x ${lockRebateD}` : ''}`));
    sash.push(mk('sash', 'W-DOOR BOTTOM RAIL', sec(dBottom), d.daylight.w, 1, 'W-DBR', `D${d.n} · ${d.panel ? 'through rebate on the top edge' : 'through rebate on the top edge (glass)'}`));
    if (d.midRail) sash.push(mk('sash', 'W-DOOR MID RAIL', sec(dMid), d.daylight.w, 1, 'W-DMR', `D${d.n} · axis ${R(midRailAxis - d.leaf.y)} from the leaf top · through rebate both edges`));
    if (d.bars.length) sash.push(mk('sash', 'W-DOOR BAR', secBar, d.daylight.w, 2 * d.bars.length, 'W-DGB', `D${d.n} · applied glazing bar, ${d.bars.length} per face`));
    sash.push(mk('sash', 'W-DOOR BEAD', secBead, d.daylight.w + 2 * reb, 2, 'W-DBD', `D${d.n} glass · horizontal, mitred`));
    sash.push(mk('sash', 'W-DOOR BEAD', secBead, d.zone.h + 2 * reb, 2, 'W-DBD', `D${d.n} glass · vertical, mitred`));
    if (d.panel) {
      sash.push(mk('sash', 'W-DOOR BEAD', secBead, d.daylight.w + 2 * reb, 2, 'W-DBD', `D${d.n} panel · horizontal, mitred`));
      sash.push(mk('sash', 'W-DOOR BEAD', secBead, d.panel.h + 2 * reb, 2, 'W-DBD', `D${d.n} panel · vertical, mitred`));
    }
  });

  // ── glass and panels ──
  const glassUnits = [];
  screens.forEach((s) => glassUnits.push({
    width: s.unit.w, height: s.unit.h, qty: 1, role: 'screen', location: `screen S${s.n}`, bars: s.unit.bars,
    note: `applied bars ${barW} both faces, dummy spacer ${Number(G.dummySpacer)}`,
  }));
  doors.forEach((d) => glassUnits.push({
    width: d.unit.w, height: d.unit.h, qty: 1, role: 'door', location: `door D${d.n} ${hingeSide}`, bars: d.unit.bars,
    note: `safety glass (AD K) · applied bars ${barW} both faces, dummy spacer ${Number(G.dummySpacer)}`,
  }));
  const panels = [];
  screens.filter((s) => s.panel).forEach((s) => panels.push({ where: `screen S${s.n}`, ...s.panel.size, area: Math.round(s.panel.size.w * s.panel.size.h / 100) / 10000, build: P.panel.build }));
  doors.filter((d) => d.panel).forEach((d) => panels.push({ where: `door D${d.n}`, ...d.panel.size, area: Math.round(d.panel.size.w * d.panel.size.h / 100) / 10000, build: P.panel.build }));

  // ── weights ──
  const marginPct = Number.isFinite(Number(settings?.weightMarginPct)) ? Number(settings.weightMarginPct) : DEFAULT_WEIGHT_MARGIN_PCT;
  const wMargin = 1 + (marginPct || 0) / 100;
  const secKg = (section) => {
    const [a, b] = String(section).split('x').map(Number);
    return kgPerM(a, b);
  };
  const timberOf = (recs) => recs.reduce((a, c) => a + secKg(c.section) * ((Number(c.length) || 0) / 1000) * (Number(c.quantity) || 1), 0);
  const glassKgPerSqm = Number(G.kgPerSqm);
  const panelKgPerSqm = (panelT / 1000) * Number(P.panel.densityKgM3);
  const timberKg = timberOf(box) + timberOf(sash);
  const glassSqm = glassUnits.reduce((s, u) => s + u.width * u.height * u.qty, 0) / 1e6;
  const glassKg = glassSqm * glassKgPerSqm;
  const panelKg = panels.reduce((a, pn) => a + pn.area * panelKgPerSqm, 0);
  const leafWeights = doors.map((d) => {
    const leafTimber = timberOf(sash.filter((r) => r.notes.startsWith(`D${d.n}`)));
    const leafGlass = (d.unit.w * d.unit.h / 1e6) * glassKgPerSqm;
    const leafPanel = d.panel ? (d.panel.size.w * d.panel.size.h / 1e6) * panelKgPerSqm : 0;
    return { role: `door D${d.n}`, weightKg: R((leafTimber + leafGlass + leafPanel) * wMargin) };
  });

  const hingeCount = doors.reduce((a, d) => a + d.hinges.count, 0);
  return {
    category: 'partition',
    partition: {
      layout, fields: laidFields, depth, boardWidth,
      section: { upstand, zoneDepth, bead: { w: beadW, t: beadT }, rebate: reb, glassIn, play, pocketDepth, beadSide: G.beadSide, unit: Number(G.unit), makeup: G.makeup, tape: Number(G.tape), spacer: Number(G.spacer), dummySpacer: Number(G.dummySpacer) },
      head: { x: 0, y: 0, w: W, h: board },
      ends: [{ x: 0, y: board, w: board, h: R(H - board) }, { x: R(W - board), y: board, w: board, h: R(H - board) }],
      topRail: { x: board, y: topRailY0, w: R(inner), h: topRail, pockets: topRailPockets },
      posts: posts.map((p) => ({
        i: p.i, x: p.x, w: p.w, y: topRailY1, h: R(postLen), role: p.role, rebated: p.rebated, lips: p.lips, blank: p.blank, pockets: p.pockets,
        // the neighbouring fields (kind 'S' | 'D', the field number per kind), null past the end boards
        left: p.left ? { kind: p.left.kind, n: p.left.n } : null, right: p.right ? { kind: p.right.kind, n: p.right.n } : null,
      })),
      screens, doors,
      members: { post, topRail, midRail: hasPanel ? midRail : 0, bottomRail, bar: barW, barThickness: barT, bead: beadW, board, boardWidth, stile, doorTop: dTop, doorBottom: dBottom, doorMid: dMid },
      lightsPerScreen: lights, lightH: R(lightH), panelHeight: panelH, midRailAxis: midRailAxis === null ? null : R(midRailAxis),
      zone: { y: zoneY0, h: R(zoneH) },
      joints, dowels: { count: dowels, dia: Number(J.dowel.dia), length: Number(J.dowel.length), perJoint: Number(J.dowel.perJoint) },
      finish: 'oiled oak',
      totalWidth: W, totalHeight: H,
    },
    components: { box, sash, beading: [] },
    customGlassUnits: glassUnits,
    panels,
    weights: {
      timber: round(timberKg), glass: round(glassKg), panel: round(panelKg),
      total: round((timberKg + glassKg + panelKg) * wMargin), leaves: leafWeights,
    },
    paint: { areaSqm: 0, primer: 0, topcoat: 0, finish: 'oil' },
    consumables: {
      glass: { type: windowSpec?.glazing?.type || 'double', sqm: Math.round(glassSqm * 100) / 100 },
      dowels: { count: dowels, size: `${Number(J.dowel.dia)} x ${Number(J.dowel.length)}` },
      hinges: { count: hingeCount, name: HG.name },
      latches: { count: doors.length, kind: HW.latch },
    },
    frame: { width: W, height: H },
    config: { key: layout, rows: 1, cols: fields.length },
    barPositions: { vertical: [], horizontal: [] },
  };
}
