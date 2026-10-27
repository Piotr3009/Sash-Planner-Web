/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOOR MEETING STILES AND LOCK MACHINING (Piotr 24.10.2026)
//
// The french meeting joint and the lock machining of a door leaf as the
// workshop and the bSolid macro need them: every number relative to ONE datum,
// the spindle axis (spindleFromLeafBottom above the leaf bottom), so the same
// table serves the single door (ThunderBolt), the french door with one handle
// (ThunderBolt on the active leaf, keeps on the passive leaf) and the french
// door with two handles (FGTE master and slave).
//
// Sources (the Winkhaus / BJ Waller documents of 24.10.2026):
//   STV-ThunderBolt LEVER LEVER 2070/45 (4941787), 20 mm radius faceplate 1770,
//     data sheet "Milling dimensions": G = 906 (spindle above the faceplate
//     bottom end), pockets 140 / 230 / 110 / 140 long, depths 47 and D + 21
//     (D = backset), faceplate 20 x 3, deadbolts 56.5 from each faceplate end;
//   FGTE Rebated Master Routing Detail, 45 mm backset, 58 mm slab (Winkhaus UK):
//     faceplate recess 20.5 x 3, rod channel 12.2 x 12, pockets R8.5 (17 wide)
//     130 / 200 / 130 long, depths 48 / 68 / 48, the spindle 130 from the main
//     pocket's lower end, the rebate 18 wide x 19 (lip 39), lock axis 22;
//   FGTE Rebated Slave Routing Detail, 45 mm backset, 58 mm slab: faceplate
//     recess 20.5 x 5, rod channel 12.2 x 15, pockets 65 / 200 / 90 / 65,
//     depths 25 / 71 / 15 / 25, end plate recess 3 deep at both ends, lip 15,
//     seal groove 3 at the lip (Q-lon Aquamac 124);
//   F24-912W centre keep (56): plate 24 x 235 x 2.5 from 126.5 below the
//     handle, pocket 18 x 182 x 25 from 106.5 below; F2402 single pocket keep:
//     plate 24 x 176 x 2.5, pocket 18 x 120 x 25, centred on the deadbolt.
// The leaf geometry (lips, rebate, lock axis) is the owner's 24.10 decision:
// rebate = lap 12 + gap 4 = 16 wide; active lip 37, passive lip 14.5, 5.5
// between them for the seal; lock axis 12 + 21 / 2 = 22.5 from the lip face.
//
// The PLATES the Lock Machining sheet draws come from the Winkhaus product DXF
// drawings (engine/hardware/winkhausOutlines.js, generated; the keeps from the
// BJ Waller data sheets in engine/hardware/winkhausKeeps.js). Each machining
// result names its plate (`plate`: outline, from / to the spindle and from the
// leaf bottom, crop) and its pocket cutter; the sheet places the outlines.
//
// Everything here is PURE: no profile store, no React. The engine calls it
// once per door (deriveDoorWindow) and the sheets read derived.door only.
// ─────────────────────────────────────────────────────────────────────────────

const R = (v) => Math.round(v * 10) / 10;
const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * The ThunderBolt 1770 radius faceplate kit, every length from the spindle (+ up).
 * Positions from the Winkhaus product DXF (T-FGAO2070 L29/45 92/8 D2, read
 * 24.10.2026): the faceplate 1770 x 20 x 3, the bottom end the one with the
 * cylinder below the spindle (G = 906 from it); THREE housings on the back of
 * the plate (no auxiliary housing on this lock): the deadbolt housings 93 long
 * x 44 deep at 89 to 182 and 1579 to 1672 (their double bolts 134 to 171 and
 * 1624 to 1661), the main case 178 long x 63 deep at 788 to 966 (deadbolt 821
 * to 851 above the cylinder, latch 917 to 946 above the spindle); the rail 2.2
 * under the plate with clips to 7.7. The data sheet milling page gives the
 * pocket sizes (140 and 230 long, 47 and D + 21 deep) and the main pocket's
 * place (770.5 to 1000.5 from the bottom end); the deadbolt pockets are set
 * centred on their housings (23.5 clear each end).
 */
export const THUNDERBOLT_1770 = Object.freeze({
  name: 'ThunderBolt 2070/45, radius faceplate 1770',
  faceplate: { length: 1770, below: 906, above: 864, plateWidth: 20, plateThickness: 3, endRadius: 10 },
  // pockets: from / to relative to the spindle, width across the edge, depth from the edge face
  pockets: [
    { key: 'bolt-bottom', from: -840.5, to: -700.5, width: 18, depth: 47, note: 'bottom deadbolt housing 93 x 44 (DXF 89 to 182 from the bottom end), pocket 140 centred on it' },
    { key: 'main', from: -135.5, to: 94.5, width: 18, depth: 'D+21', note: 'main case 178 x 63 (DXF 788 to 966): latch, deadbolt, gearbox; the data sheet pocket 770.5 to 1000.5' },
    { key: 'aux', from: 256.7, to: 366.7, width: 18, depth: 'D+21', optional: true, note: 'auxiliary housing of the "additional lock, prepared" variant (data sheet B-B); not on the DXF lock: hardware.auxHousing' },
    { key: 'bolt-top', from: 649.5, to: 789.5, width: 18, depth: 47, note: 'top deadbolt housing 93 x 44 (DXF 1579 to 1672), pocket 140 centred on it' },
  ],
  // the deadbolt axes (the keeps centre on them): the double bolts of the DXF, 152.5 and 1642.5 from the bottom end
  bolts: [-753.5, 736.5],
  // the rail 2.2 x 11.5 under the 3 plate and its clips to 7.7 from the plate face (DXF): a channel under the plate recess
  rodChannel: { width: 12.2, depth: 8 },
  cylinderBelow: 92,           // PZ 92: cylinder centre 92 below the spindle
  cutter: 12,
});

/** The FGTE master (active leaf) routing, Winkhaus UK detail for a 58 slab, 45 backset. */
export const FGTE_MASTER = Object.freeze({
  name: 'FGTE master (Cobra / ThunderBolt FGTE), rebated routing detail',
  faceplate: { plateWidth: 20, recessWidth: 20.5, recessDepth: 3 },
  rodChannel: { width: 12.2, depth: 12 },
  pockets: [
    { key: 'hook-lower', from: -835, to: -705, width: 17, depth: 48, note: 'lower hook housing (R8.5 slot)' },
    { key: 'main', from: -130, to: 70, width: 17, depth: 'D+23', note: 'main case: latch, deadbolt, hooks drive' },
    { key: 'hook-upper', from: 508, to: 638, width: 17, depth: 48, note: 'upper hook housing (R8.5 slot)' },
  ],
  cylinderBelow: 92,
  cutter: 17,
});

/** The FGTE slave (passive leaf) routing, Winkhaus UK detail for a 58 slab, 45 backset. */
export const FGTE_SLAVE = Object.freeze({
  name: 'FGTE slave, rebated routing detail',
  faceplate: { plateWidth: 20, recessWidth: 20.5, recessDepth: 5 },
  // the slave faceplate strip of the Winkhaus product DXF (G3 Stulpe TFTE
  // 2062-9 92 MDE, read 24.10.2026 by verify/tools/winkhaus_dxf_outlines.py):
  // 1702.7 long, its spindle 919.5 above the strip's bottom end; the strip sits
  // inside the full height recess, extension strips reach the leaf ends
  strip: { length: 1702.7, below: 919.5, above: 783.2, width: 20 },
  rodChannel: { width: 12.2, depth: 15 },
  pockets: [
    { key: 'shootbolt-lower', from: -795, to: -730, width: 17, depth: 25, note: 'lower shootbolt housing' },
    { key: 'main', from: -130, to: 70, width: 17, depth: 'D+26', note: 'slave case: the master bolts lock into its faceplate' },
    { key: 'gear', from: 340, to: 430, width: 17, depth: 15, note: 'gear housing (detail F, 15 deep)' },
    { key: 'shootbolt-upper', from: 548, to: 613, width: 17, depth: 25, note: 'upper shootbolt housing' },
  ],
  endPlate: { length: 65, width: 20.5, depth: 3, note: 'shootbolt end plate recess at both leaf ends (detail A)' },
  cylinderBelow: 92,
  cutter: 17,
});

/** The ThunderBolt keeps on the leaf or jamb the bolts shoot into (BJ Waller datasheets). */
export const KEEPS = Object.freeze({
  centre: {
    code: 'F24-912W', name: 'centre keep, radius end, 56',
    plate: { from: -126.5, to: 108.5, width: 24, depth: 2.5, endRadius: 12 },
    pocket: { from: -106.5, to: 75.5, width: 18, depth: 25, endRadius: 6 },
  },
  single: {
    code: 'F2402', name: 'adjustable single pocket keep',
    plate: { half: 88, width: 24, depth: 2.5, endRadius: 12 },
    pocket: { half: 60, width: 18, depth: 25, endRadius: 6 },
  },
  rail: { code: 'F24-908P', name: '2 piece full length adjustable keep', plateWidth: 24, plateDepth: 2.5 },
});

/**
 * The french meeting joint from the door profile (plan geometry, mm):
 *   overlap      the two lips past the centre line (2 x lip - clearance), 12
 *   gap          lip edge to the other leaf's shoulder, 4 (both pairs)
 *   rebateWidth  overlap + gap, 16: the rebate cut on EACH meeting stile
 *   lipActive    the active lip that stays, from the face the door swings to (37)
 *   lipPassive   the passive lip that stays, from the other face (14.5)
 *   cutActive    leafDepth - lipActive (20), cut from the face opposite the swing
 *   cutPassive   leafDepth - lipPassive (42.5), cut from the swing face
 *   sealSpace    leafDepth - lipActive - lipPassive (5.5) between the two lips
 *   lapFace      the face the active lip is on ('exterior' outward, 'interior' inward)
 * A lip pair that does not fit the leaf (lipActive + lipPassive > leafDepth) is
 * an owner error: the numbers are returned with `valid: false`.
 */
export function frenchMeetingGeometry({ leafDepth, lip, clearance = 0, meeting = {}, inward = false }) {
  // every workshop number comes in from the door profile (no defaults here)
  const ld = n(leafDepth, 0);
  const lipA = n(meeting.lipActive, 0);
  const lipP = n(meeting.lipPassive, 0);
  const gap = n(meeting.gap, 0);
  const overlap = R(2 * n(lip, 0) - n(clearance, 0));
  const sealSpace = R(ld - lipA - lipP);
  return {
    overlap, gap, rebateWidth: R(overlap + gap),
    lipActive: lipA, lipPassive: lipP,
    cutActive: R(ld - lipA), cutPassive: R(ld - lipP),
    sealSpace, sealGroove: n(meeting.sealGroove, 0),
    lapFace: inward ? 'interior' : 'exterior',
    valid: ld > 0 && lipA > 0 && lipP > 0 && sealSpace >= 0 && overlap > 0 && gap >= 0,
  };
}

const other = (face) => (face === 'exterior' ? 'interior' : 'exterior');

/**
 * The meeting stile of ONE leaf: which face its lip is on, how thick, and the
 * rebate the CNC cuts (width along the leaf, depth through the thickness, from
 * which face). splitZ = the lip thickness measured from the EXTERIOR face: the
 * plane that divides the lip part from the cut part (the 3D splits its member
 * halves there).
 */
export function leafMeeting(role, G) {
  if (!G || (role !== 'active' && role !== 'passive')) return null;
  const active = role === 'active';
  const lipFace = active ? G.lapFace : other(G.lapFace);
  const lip = active ? G.lipActive : G.lipPassive;
  const depth = active ? G.cutActive : G.cutPassive;
  const ld = R(lip + depth);
  return {
    role, lipFace, lip,
    rebate: { width: G.rebateWidth, depth, fromFace: other(lipFace) },
    splitZ: lipFace === 'exterior' ? lip : R(ld - lip),
    sealGroove: active ? null : { width: G.sealGroove, where: 'in the shoulder at the foot of the lip' },
  };
}

/** A pocket depth: a number, or 'D+21' with D = the backset. */
export function pocketDepth(depth, backset) {
  if (typeof depth === 'number') return depth;
  const m = /^D\s*\+\s*(\d+(\.\d+)?)$/.exec(String(depth));
  return m ? R(n(backset, 0) + Number(m[1])) : null;
}

const resolvePockets = (list, backset) => list.map((p) => ({ ...p, depth: pocketDepth(p.depth, backset), length: R(p.to - p.from) }));

/**
 * The lock machining of one door leaf, every position relative to the spindle
 * axis (+ up the leaf), with the absolute form (from the leaf bottom) beside it.
 *   kind     'thunderbolt' (single door, french active with one handle)
 *            'keeps' (french passive with one handle: the ThunderBolt keeps)
 *            'fgte-master' / 'fgte-slave' (french with two handles)
 *   edge     the edge face the faceplate sits on: 'lock stile' (a single door),
 *            'active lip' or 'passive shoulder' (a french door)
 *   plate    the plate the sheet draws: outline ('thunderbolt' | 'fgte-slave' |
 *            'fgte-master' schematic | null for the keeps), from / to the
 *            spindle and the leaf bottom, length, width, crop
 *   cutter   the pocket cutter diameter (the corner radius of the pockets)
 * opts: { leafH, role: 'single'|'active'|'passive', twoHandles, hw (profile
 *         hardware), leafDepth, meeting: leafMeeting(...) | null, backset,
 *         centred (the keeps of a single door's jamb: the lock axis centred
 *         on the leaf depth, as the single door lock is) }
 */
export function leafLockMachining({ leafH, role, twoHandles, hw = {}, leafDepth, meeting = null, backset, centred = false }) {
  const H = n(leafH, 0);
  // the datum numbers come from the door profile (hardware.*): no defaults here
  const spindle = n(hw.spindleFromLeafBottom, 0);
  const D = n(backset, n(hw.backset, 0));
  const plateW = n(hw.faceplateWidth, 0);
  const ld = n(leafDepth, 0);
  const single = role === 'single';
  const active = role === 'active';
  // the french lips measure the lock axis from the lip face (12 + 21 / 2 = 22.5,
  // the FGTE 22 mm centre line); a single door lock sits centred on the leaf
  const margin = single || centred ? R((ld - plateW) / 2) : n(hw.lockEdgeMargin, 0);
  const axisFromFace = R(margin + plateW / 2);
  const kind = single || (active && !twoHandles) ? 'thunderbolt'
    : active ? 'fgte-master'
    : twoHandles ? 'fgte-slave' : 'keeps';
  // the edge face the plate sits on and its width across the leaf
  const edge = single ? 'lock stile' : active ? 'active lip' : 'passive shoulder';
  const faceWidth = single || centred ? ld : active ? n(meeting?.lip, ld) : R(ld - n(meeting?.lip, 0));
  // the lip face the axis is measured from: the active lip face, which is the
  // face the passive shoulder shares (both leaves measure from the same face)
  const axisFace = meeting ? (active ? meeting.lipFace : other(meeting.lipFace)) : 'exterior';
  const abs = (rel) => R(spindle + rel);
  const withAbs = (p) => ({ ...p, fromBottom: abs(p.from), toBottom: abs(p.to) });
  const base = {
    kind, edge, faceWidth, leafH: H,
    datum: { spindleFromBottom: spindle, spindleFromTop: R(H - spindle), axisFromFace, axisFace, backset: D, edgeMargin: margin, plateWidth: plateW },
    fits: { plateToStep: single ? null : R(faceWidth - margin - plateW) },
    notes: [],
  };
  if (kind === 'thunderbolt') {
    const K = THUNDERBOLT_1770;
    const fp = K.faceplate;
    const from = -fp.below, to = fp.above;
    const cropBottom = Math.max(0, -(spindle + from));
    const cropTop = Math.max(0, abs(to) - H);
    const pockets = resolvePockets(K.pockets.filter((p) => !p.optional || hw.auxHousing !== false), D).map(withAbs);
    return {
      ...base, kit: K.name, cutter: K.cutter,
      faceplate: withAbs({ from, to, width: plateW, depth: n(hw.faceplateRecessMaster, fp.plateThickness), plateWidth: fp.plateWidth, cropBottom: R(cropBottom), cropTop: R(cropTop) }),
      // the plate the sheet draws (engine/hardware/winkhausOutlines.js THUNDERBOLT_PLATE), its bottom end 906 below the spindle
      plate: withAbs({ outline: 'thunderbolt', from, to, length: fp.length, width: fp.plateWidth, cropBottom: R(cropBottom), cropTop: R(cropTop) }),
      rodChannel: { width: n(hw.rodChannelWidth, K.rodChannel.width), depth: K.rodChannel.depth, over: 'the faceplate length' },
      pockets,
      holes: [
        { key: 'spindle', at: 0, atBottom: abs(0), x: D, note: 'spindle 8 mm square, at the backset from the plate face' },
        { key: 'cylinder', at: -K.cylinderBelow, atBottom: abs(-K.cylinderBelow), x: D, note: 'PZ cylinder, 92 below the spindle' },
      ],
      bolts: K.bolts.map((b) => ({ at: b, atBottom: abs(b) })),
      keeps: [],
      notes: [
        ...(cropBottom > 0 || cropTop > 0 ? [`faceplate 1770 cropped: ${R(cropBottom)} at the bottom, ${R(cropTop)} at the top (Winkhaus cutting areas)`] : []),
        ...(hw.auxHousing === false ? ['auxiliary housing pocket not machined (hardware.auxHousing off)'] : []),
      ],
    };
  }
  if (kind === 'keeps') {
    const K = THUNDERBOLT_1770;
    const full = String(hw.keeps || '').toLowerCase().includes('full');
    const S = KEEPS.single, Cn = KEEPS.centre;
    const keeps = [
      { key: 'keep-bottom', code: S.code, name: S.name,
        plate: { from: K.bolts[0] - S.plate.half, to: K.bolts[0] + S.plate.half, width: S.plate.width, depth: S.plate.depth, endRadius: S.plate.endRadius },
        pocket: { from: K.bolts[0] - S.pocket.half, to: K.bolts[0] + S.pocket.half, width: S.pocket.width, depth: S.pocket.depth, endRadius: S.pocket.endRadius },
        centre: K.bolts[0] },
      { key: 'keep-centre', code: Cn.code, name: Cn.name,
        plate: { ...Cn.plate }, pocket: { ...Cn.pocket }, centre: 0 },
      { key: 'keep-top', code: S.code, name: S.name,
        plate: { from: K.bolts[1] - S.plate.half, to: K.bolts[1] + S.plate.half, width: S.plate.width, depth: S.plate.depth, endRadius: S.plate.endRadius },
        pocket: { from: K.bolts[1] - S.pocket.half, to: K.bolts[1] + S.pocket.half, width: S.pocket.width, depth: S.pocket.depth, endRadius: S.pocket.endRadius },
        centre: K.bolts[1] },
    ].map((k) => ({ ...k, plate: withAbs(k.plate), pocket: withAbs(k.pocket), centreBottom: abs(k.centre) }));
    return {
      ...base, kit: full ? KEEPS.rail.name : 'ThunderBolt keeps: centre + top + bottom', cutter: 2 * S.pocket.endRadius,
      faceplate: full
        ? withAbs({ from: -THUNDERBOLT_1770.faceplate.below, to: THUNDERBOLT_1770.faceplate.above, width: KEEPS.rail.plateWidth, depth: KEEPS.rail.plateDepth, plateWidth: KEEPS.rail.plateWidth, cropBottom: 0, cropTop: 0 })
        : null,
      plate: null,
      rodChannel: null, pockets: [], holes: [], bolts: K.bolts.map((b) => ({ at: b, atBottom: abs(b) })),
      keeps,
      notes: [
        full ? 'keep rail F24-908P: the 24 x 2.5 recess runs the faceplate length, the three pockets as the single keeps (ASSUMPTION: no routing drawing for the rail)' : '',
        'flush bolts top and bottom: their pockets are not modelled (owner product)',
      ].filter(Boolean),
    };
  }
  const K = kind === 'fgte-master' ? FGTE_MASTER : FGTE_SLAVE;
  const slave = kind === 'fgte-slave';
  const pockets = resolvePockets(K.pockets, D).map(withAbs);
  const fp = K.faceplate;
  // the plate the sheet draws: the slave strip of the Winkhaus DXF at its place
  // (919.5 below the spindle, cropped to the leaf), the master plate schematic
  // over the full height (no Winkhaus drawing of the master faceplate yet)
  const strip = slave ? K.strip : null;
  const plate = strip
    ? withAbs({ outline: 'fgte-slave', from: -strip.below, to: strip.above, length: strip.length, width: strip.width,
      cropBottom: R(Math.max(0, strip.below - spindle)), cropTop: R(Math.max(0, abs(strip.above) - H)) })
    : withAbs({ outline: 'fgte-master', from: -spindle, to: R(H - spindle), length: H, width: fp.plateWidth, cropBottom: 0, cropTop: 0, schematic: true });
  return {
    ...base, kit: K.name, cutter: K.cutter,
    faceplate: withAbs({ from: -spindle, to: R(H - spindle), width: plateW, depth: n(slave ? hw.faceplateRecessSlave : hw.faceplateRecessMaster, fp.recessDepth), plateWidth: fp.plateWidth, cropBottom: 0, cropTop: 0, fullLength: true }),
    plate,
    rodChannel: { width: n(hw.rodChannelWidth, K.rodChannel.width), depth: n(slave ? hw.rodChannelDepthSlave : hw.rodChannelDepthMaster, K.rodChannel.depth) },
    pockets,
    holes: [
      { key: 'spindle', at: 0, atBottom: abs(0), x: D, note: 'spindle 8 mm square, at the backset from the plate face' },
      { key: 'cylinder', at: -K.cylinderBelow, atBottom: abs(-K.cylinderBelow), x: D, note: 'PZ cylinder, 92 below the spindle' },
    ],
    bolts: [],
    keeps: [],
    endPlates: slave ? [
      { key: 'end-bottom', from: -spindle, to: R(-spindle + K.endPlate.length), width: K.endPlate.width, depth: K.endPlate.depth, fromBottom: 0, toBottom: K.endPlate.length },
      { key: 'end-top', from: R(H - spindle - K.endPlate.length), to: R(H - spindle), width: K.endPlate.width, depth: K.endPlate.depth, fromBottom: R(H - K.endPlate.length), toBottom: H },
    ] : [],
    notes: [
      'faceplate recess runs the full leaf height (the FGTE strips are cropped to the leaf)',
      slave
        ? `slave strip ${R(strip.length)} long from ${plate.fromBottom} to ${plate.toBottom} (spindle ${R(strip.below)} above its bottom end); extension strips reach the leaf ends`
        : 'the master locks into the slave faceplate: no keeps; the master faceplate is drawn schematic (no Winkhaus drawing of it yet)',
      slave ? 'shootbolt end plate recess 3 deep at both leaf ends (detail A)' : '',
      'handle fixing holes per the Winkhaus face drawing (detail E), not modelled',
    ].filter(Boolean),
  };
}

/**
 * The machining of a single door's frame JAMB on the lock side: the ThunderBolt
 * keeps in the rebate wall, on the leaf's lock axis (centred on the leaf depth,
 * as the single door lock is), positions from the leaf bottom carried to the
 * frame (leafBottomY = the leaf bottom in frame coordinates, from the frame top).
 * The wall is drawn as wide as the leaf is deep (faceWidth = leafDepth).
 */
export function jambKeepMachining({ leafH, hw = {}, backset, leafDepth = 0 }) {
  const m = leafLockMachining({ leafH, role: 'passive', twoHandles: false, hw, leafDepth, meeting: null, backset, centred: true });
  return { ...m, edge: 'jamb rebate wall', faceWidth: n(leafDepth, 0) > 0 ? n(leafDepth, 0) : null, fits: { plateToStep: null } };
}
