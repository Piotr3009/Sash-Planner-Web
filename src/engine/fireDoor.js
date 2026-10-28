/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * fireDoor.js (27.10.2026): the internal door set engine, the 'firedoor'
 * category (FDR-nn fire doors FD30 / FD60 and DR-nn non-fire doors). One
 * record = one leaf (a bought blank machined by the owner's bSolid master
 * FD_LEAF_MASTER_PIOTR, macro Master_Door_PIOTR) in a three-member frame
 * (FD-HEAD, FD-JAMB-H hinge jamb, FD-JAMB-L lock jamb) rebated from solid.
 * deriveWindowData dispatches here on category 'firedoor'; this module is the
 * only place the fire door profile (profile.js DEFAULT_FIREDOOR_PROFILE) turns
 * into sizes, positions, records, machining ops and the bSuite variable table.
 * It never imports calculations.js (calculations imports this module).
 *
 * THE MODEL (CLAUDE.md section 3, the owner box, plus the v1.1 changes of 27.10.2026 evening)
 *   opening     the structural opening W x H is the input (v1.1): frame
 *               overall = opening - 2 x wallGapSide / - wallGapHead (the foot
 *               stands on the floor), leaf = overall - 76 / - 43. A typed leaf
 *               overrides the derived one and the opening is reported from it.
 *   leaf        W x H x T (T 44 for FD30 and non-fire, 54 for FD60), LPX = H,
 *               LPY = W, LPZ = T in the bSolid master.
 *   rebate      width = overlap + gapSide (15, across the 50 thickness), depth =
 *               T + rebateClearance (47 / 57, along the frame depth); the frame
 *               shows thickness - rebateW (35) outside and 50 inside.
 *   frame       overall W = leaf + 2 x (gapSide + thickness - rebateW) (+ 76),
 *               overall H = floorGap + leaf + gapHead + (thickness - rebateW) (+ 43);
 *               head = overall W long point, both ends mitred 45; jambs =
 *               overall H long point, top mitred, bottom square on the floor;
 *               each mitred corner dowelled (frame.dowels: 8 x 40, 3 per corner,
 *               bored square to the mitre face, half the length into each piece).
 *   hinges      (v1.1) the top hinge's top edge topOffset below the leaf top,
 *               the bottom hinge's bottom edge bottomOffset above the leaf
 *               bottom, the middle hinge's CENTRE midAboveCentre above the
 *               leaf centre (2040: tops 150 / 769 / 1738); on the hinge jamb
 *               the same heights shifted by (thickness - rebateW) + gapHead.
 *   handing     hinge left / right only (v1.1): no swing on an internal door.
 *   intumescent (v1.1) one strip size 15 x 4 all around, groove 15.5 x 4;
 *               FD30 one strip, FD60 two, a non-fire door none.
 *   closer      (v1.1) none / surface / built in; a row in the order and the
 *               CLOSER flag (0 / 1 / 2); the built in closer is not machined.
 *   lock        DIN lock: spindle spindleHeight above the leaf bottom, backset
 *               from the lock edge; forend centre forendCentreBelowSpindle under
 *               the spindle, case top caseTopAboveSpindle over it; euro / bathroom
 *               cylinder euroCentres / bathroomCentres under the spindle.
 *   keep        on the lock jamb, centred floorGap + spindleHeight -
 *               forendCentreBelowSpindle above the jamb foot.
 *
 * COORDINATE SYSTEMS OF THE MACHINING OPS (derived.firedoor.machining)
 * Every op: { id, kind, face, x, y, z, length, width, depth, radius, note? },
 * mm, rounded to 0.1. x, y, z = the op's reference corner (the minimum x, y, z
 * of its bounding box) in the board's own system, EXCEPT the holes
 * (spindleHole, cylinderHole), whose x, y are the hole CENTRE and whose length
 * and width are the bore (the contract's reading). `depth` goes into the face.
 *
 * LEAF board (bSolid LPX x LPY x LPZ):
 *   x along the HEIGHT from the leaf TOP (0 = top, LPX = bottom);
 *   y across the WIDTH from the HINGE edge (0 = hinge edge, LPY = lock edge);
 *   z through the THICKNESS from the PULL face (0 = pull face, the face the
 *     hinge knuckles show on; LPZ = push face).
 *   Faces: pull, push, hingeEdge, lockEdge, top, bottom. `length` runs along x
 *   and `width` along the other in-face axis (y on pull / push, z on the two
 *   edges); on top / bottom (where x is not in the face) `length` runs along y
 *   (the full width) and `width` along z. Handing never moves a leaf op: y is
 *   counted from whichever edge carries the hinges and z from the pull face.
 *   Kinds: hingeRecess (hingeEdge, x = top_i - (recessLength - length) / 2,
 *   z = 0), forendRecess and casePocket (lockEdge, centred on LPZ / 2),
 *   spindleHole and cylinderHole (pull, through), vpCutout per pane (pull,
 *   through, radius vp.cornerRadius; the diamond carries rotated true, angle
 *   45 and its bounding box), intuGroove per strip per edge (top, hingeEdge,
 *   lockEdge; fire only; groove 15.5 x 4), leadEdge (lockEdge, depth 0, value =
 *   the macro value).
 *
 * FRAME members (FD-HEAD, FD-JAMB-H, FD-JAMB-L):
 *   x along the LENGTH from the TOP long point (jambs) or the LEFT long point
 *     (head), 0 .. length;
 *   y across the 50 THICKNESS from the WALL face (0 = wall side, 50 = opening);
 *   z along the FRAME DEPTH from the OUTSIDE face (0 = the face that shows 35,
 *     the pull / stop side; depth = the inside face that shows 50).
 *   The rebate occupies y in [thickness - rebateW, thickness] and z in
 *   [0, rebateD] along the full length: op `rebate` on face `opening`. The
 *   hinge recesses (FD-JAMB-H) and the keep plate / pocket (FD-JAMB-L) sit on
 *   face `rebateCheek`, the face at y = thickness - rebateW that meets the leaf
 *   edge, x from the top long point, z from the outside face. Mitres: op
 *   `mitre` on face `end`, x = 0 (top / left) or x = length (the head's right
 *   end), angle 45, width = thickness, depth = frame depth. Dowels (v1.1): op
 *   `dowelBore` on face `mitre` per dowel per mitred end, x y z = the bore
 *   CENTRE on the mitre face (x = the end's long point, y = thickness / 2, z
 *   along the depth), length = width = the dowel diameter, depth = half the
 *   dowel length, angle 45 = the bore axis is square to the mitre face.
 */
import { getFireDoorProfile, kgPerM } from './profile.js';
import { round, createComponentRecord } from './records.js';

export class FireDoorGeometryError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'FireDoorGeometryError';
    this.details = details || {};
  }
}

const R = (v) => Math.round(v * 10) / 10;
// mirrors calculations.CONSTANTS.WEIGHT_MARGIN_PCT (not imported: calculations imports this module)
const DEFAULT_WEIGHT_MARGIN_PCT = 5;
// glass weight: 2.5 kg per m2 per mm of glass (the door unit rate of calculations.js)
const GLASS_KG_PER_SQM_PER_MM = 2.5;
// mirrors calculations.js paintFromAreaSqm (not importable: cycle): per 1.5 m2 2 L primer + 1 L topcoat
const PAINT_SQM_PER_LOT = 1.5;
const PAINT_PRIMER_L_PER_LOT = 2;
const PAINT_TOPCOAT_L_PER_LOT = 1;
function paintFromAreaSqm(areaSqm) {
  return {
    areaSqm,
    primer: round((areaSqm / PAINT_SQM_PER_LOT) * PAINT_PRIMER_L_PER_LOT),
    topcoat: round((areaSqm / PAINT_SQM_PER_LOT) * PAINT_TOPCOAT_L_PER_LOT),
  };
}

const LOCK_TYPES = ['latch', 'euro', 'bathroom'];
const RATINGS = ['FD30', 'FD60'];
const NAME_RE = /^(FDR|DR)-(\d+)$/i;
const CLOSER_KINDS = ['none', 'surface', 'builtin'];
const CLOSER_LABELS = { none: 'None', surface: 'Surface closer', builtin: 'Built in closer' };

/** The closer kind of a value: 'none' | 'surface' | 'builtin'; a v1 boolean true = 'builtin', false = 'none'; else the default. */
function closerKindOf(v, def) {
  if (v === true || v === 'true' || v === 'yes' || v === 1 || v === '1') return 'builtin';
  if (v === false || v === 'false' || v === 'no' || v === 0 || v === '0') return 'none';
  return CLOSER_KINDS.includes(v) ? v : (CLOSER_KINDS.includes(def) ? def : 'none');
}

/**
 * The frame's two additions over the leaf and the wall gaps, from the profile:
 * overall W = leaf + addWidth (76), overall H = leaf + addHeight (43); the
 * opening = overall + 2 x wallGapSide / + wallGapHead. The form uses these to
 * show the opening of a leaf chip and the leaf a typed opening gives, with the
 * same arithmetic as the engine.
 */
export function fireDoorSizeRule(profile) {
  const P = profile || getFireDoorProfile();
  const F = P.frame;
  const faceOut = Number(F.thickness) - (Number(F.overlap) + Number(F.gapSide));
  return {
    addWidth: R(2 * (Number(F.gapSide) + faceOut)),
    addHeight: R(Number(F.floorGap) + Number(F.gapHead) + faceOut),
    wallGapSide: Number(F.wallGapSide) || 0,
    wallGapHead: Number(F.wallGapHead) || 0,
  };
}
/** The structural opening a leaf W x H needs: { width, height }. */
export function fireDoorOpeningForLeaf(profile, leafW, leafH) {
  const r = fireDoorSizeRule(profile);
  return { width: R(Number(leafW) + r.addWidth + 2 * r.wallGapSide), height: R(Number(leafH) + r.addHeight + r.wallGapHead) };
}
/** The leaf a structural opening W x H gives: { width, height }. */
export function fireDoorLeafForOpening(profile, openingW, openingH) {
  const r = fireDoorSizeRule(profile);
  return { width: R(Number(openingW) - 2 * r.wallGapSide - r.addWidth), height: R(Number(openingH) - r.wallGapHead - r.addHeight) };
}

/**
 * The next free door name of a project: 'FDR-nn' (fire) or 'DR-nn' (non-fire),
 * two digits, the lowest number not taken by that prefix in existingNames
 * (every window of every batch of the project; other names are ignored).
 */
export function nextFireDoorName(existingNames, fire) {
  const prefix = fire === false ? 'DR' : 'FDR';
  const taken = new Set();
  for (const n of existingNames || []) {
    const m = NAME_RE.exec(String(n ?? '').trim());
    if (m && m[1].toUpperCase() === prefix) taken.add(Number(m[2]));
  }
  let i = 1;
  while (taken.has(i)) i += 1;
  return `${prefix}-${String(i).padStart(2, '0')}`;
}

/** The leaf thickness of a rating: profile.leaf.thicknessByRating (FD30 / FD60 when fire, 'none' otherwise). */
export function fireDoorLeafThickness(profile, fire, rating) {
  const P = profile || getFireDoorProfile();
  const T = P.leaf.thicknessByRating;
  const key = fire === false ? 'none' : (RATINGS.includes(rating) ? rating : 'FD30');
  return Number(T[key] ?? T.FD30 ?? 44);
}

const boolOf = (v, def) => {
  if (v === undefined || v === null || v === '') return def;
  if (v === 'false' || v === '0' || v === 0) return false;
  return !!v;
};

/**
 * The vision panel panes of a style on a leaf W x H (the ZAŁOŻENIE placement of
 * the brief, 3.7: the macro placement is not decoded, the export sends the
 * style id). Returns { style, label, panes, warnings }. A pane: { i, w, h, x
 * (leaf top to the pane top), y (hinge edge to the pane left), rotated, angle,
 * box: { w, h } (the bounding box; = w x h unless the diamond) }.
 */
function placeVisionPanel(V, styleId, custom, W, H) {
  const warnings = [];
  const id = Number(styleId) || 0;
  const table = Array.isArray(V.styles) ? V.styles : [];
  const none = { style: 0, label: 'None', panes: [], warnings };
  if (!id) return none;
  const style = table.find((s) => Number(s.id) === id);
  if (!style || style.arrange === 'none') {
    warnings.push(`unknown vision panel style ${id}: no panes placed`);
    return { ...none, style: id, label: `Style ${id}` };
  }
  const topRail = Number(V.topRail) || 0;
  const sideMargin = Number(V.sideMargin) || 0;
  let list = [];   // native pane sizes, top to bottom
  let gap = 0;
  let diamond = false;
  if (style.arrange === 'custom') {
    const c = custom || {};
    const len = Number(c.length) || 0, wid = Number(c.width) || 0;
    const count = Math.max(0, Math.round(Number(c.count) || 0));
    const horizontal = Number(c.pos) === 90;
    for (let i = 0; i < count; i += 1) list.push(horizontal ? { w: len, h: wid } : { w: wid, h: len });
    gap = Number(c.rail) || 0;
  } else if (style.arrange === 'stack') {
    const count = Math.max(1, Math.round(Number(style.count) || 1));
    list = Array.isArray(style.panes) && style.panes.length
      ? style.panes.map((p) => ({ w: Number(p.w), h: Number(p.h) }))
      : Array.from({ length: count }, () => ({ w: Number(style.w), h: Number(style.h) }));
    gap = Number(V[style.gap] ?? V.stackGap) || 0;
  } else {
    list = [{ w: Number(style.w), h: Number(style.h) }];
    diamond = style.arrange === 'diamond';
  }
  list = list.filter((p) => p.w > 0 && p.h > 0);
  if (!list.length) {
    warnings.push(`vision panel style ${id} (${style.label}) has no pane sizes`);
    return { ...none, style: id, label: style.label };
  }
  const boxOf = (p) => (diamond ? { w: R(Math.max(p.w, p.h) * Math.SQRT2), h: R(Math.max(p.w, p.h) * Math.SQRT2) } : { w: p.w, h: p.h });
  const stackH = (panes) => panes.reduce((a, p) => a + boxOf(p).h, 0) + gap * (panes.length - 1);
  const fitsH = (panes) => topRail + stackH(panes) <= H;
  const fitsW = (panes) => Math.max(...panes.map((p) => boxOf(p).w)) <= W - 2 * sideMargin;
  let panes = list, rotated = false;
  if (!diamond && !fitsH(list)) {
    const turned = list.map((p) => ({ w: p.h, h: p.w }));
    if (fitsH(turned) && fitsW(turned)) { panes = turned; rotated = true; }
  }
  if (!fitsH(panes)) warnings.push(`vision panel style ${id} (${style.label}): the stack ${R(topRail + stackH(panes))} high does not fit the leaf height ${H}`);
  if (!fitsW(panes)) warnings.push(`vision panel style ${id} (${style.label}): a pane ${Math.max(...panes.map((p) => boxOf(p).w))} wide leaves less than ${sideMargin} each side on the leaf width ${W}`);
  let x = topRail;
  const placed = panes.map((p, i) => {
    const box = boxOf(p);
    const pane = {
      i: i + 1, w: p.w, h: p.h,
      x: R(x), y: R((W - box.w) / 2),
      rotated: diamond || rotated, angle: diamond ? 45 : (rotated ? 90 : 0),
      box,
    };
    x += box.h + gap;
    return pane;
  });
  return { style: id, label: style.label, panes: placed, warnings };
}

export function deriveFireDoorWindow(windowSpec, frameWidth, frameHeight, settings) {
  void frameWidth; void frameHeight;   // the stored overall is informational: the frame is recomputed from the leaf
  const P = getFireDoorProfile();
  const spec = windowSpec?.firedoor || {};
  const name = windowSpec?.name || '?';
  const L = P.leaf, F = P.frame, HG = P.hinges, LK = P.lock, KP = P.keep, V = P.vp, IN = P.intumescent, BS = P.bsuite;
  const D = P.defaults;

  // ── the inputs ──
  const fire = boolOf(spec.fire, D.fire);
  const storedRating = RATINGS.includes(spec.rating) ? spec.rating : (RATINGS.includes(D.rating) ? D.rating : 'FD30');
  const rating = fire ? storedRating : 'none';
  const depth = Number(spec.frameDepth ?? F.defaultDepth);
  const hingeSide = (spec.hingeSide ?? D.hingeSide) === 'right' ? 'right' : 'left';
  const lockType = LOCK_TYPES.includes(spec.lockType) ? spec.lockType : (LOCK_TYPES.includes(D.lockType) ? D.lockType : 'latch');
  const closerKind = closerKindOf(spec.closer, fire ? D.closerFire : D.closerNonFire);
  const vpStyle = Math.max(0, Math.round(Number(spec.vpStyle ?? D.vpStyle) || 0));
  const vpCustom = { ...D.vpCustom, ...(spec.vpCustom || {}) };
  const leadEdge = boolOf(spec.leadEdge, D.leadEdge);

  // ── the frame section (the fixed numbers the sizes are made of) ──
  const thickness = Number(F.thickness), rawThickness = Number(F.rawThickness);
  const rebateW = R(Number(F.overlap) + Number(F.gapSide));
  const faceOut = R(thickness - rebateW), faceIn = thickness;
  const gapSide = Number(F.gapSide), gapHead = Number(F.gapHead), floorGap = Number(F.floorGap);
  const wallGapSide = Number(F.wallGapSide) || 0, wallGapHead = Number(F.wallGapHead) || 0;
  const frameAddW = 2 * (gapSide + faceOut);          // overall W = leaf + 76
  const frameAddH = floorGap + gapHead + faceOut;     // overall H = leaf + 43

  // ── the sizes (v1.1): the structural opening is the input, the leaf an optional override ──
  // leaf typed: the leaf wins and the opening is reported from it; opening
  // typed: frame = opening - 2 x wallGapSide / - wallGapHead, leaf = frame - 76 /
  // - 43; neither: the profile's default leaf. Each axis is decided on its own.
  const sizeAxis = (leafIn, openingIn, defLeaf, addFrame, wallGap) => {
    const leafV = Number(leafIn) || 0, openV = Number(openingIn) || 0;
    if (leafV > 0) return { leaf: R(leafV), opening: R(leafV + addFrame + wallGap), source: 'leaf' };
    if (openV > 0) return { leaf: R(openV - wallGap - addFrame), opening: R(openV), source: 'opening' };
    return { leaf: R(Number(defLeaf)), opening: R(Number(defLeaf) + addFrame + wallGap), source: 'default' };
  };
  const axW = sizeAxis(spec.leafWidth, spec.openingWidth, L.defaultWidth, frameAddW, 2 * wallGapSide);
  const axH = sizeAxis(spec.leafHeight, spec.openingHeight, L.defaultHeight, frameAddH, wallGapHead);
  const W = axW.leaf, H = axH.leaf;
  const opening = {
    width: axW.opening, height: axH.opening,
    wallGapSide, wallGapHead,
    source: axW.source === axH.source ? axW.source : 'mixed',
    sourceWidth: axW.source, sourceHeight: axH.source,
  };

  // ── the hard sanity limits (the only errors of this engine; never a clamp) ──
  const lim = L.limits || {};
  const bad = (what, value, min, max) => new FireDoorGeometryError(`${name}: ${what} ${value} is outside ${min} to ${max}`, { door: name, what, value, min, max });
  if (!(W >= Number(lim.minWidth) && W <= Number(lim.maxWidth))) throw bad('leaf width', W, lim.minWidth, lim.maxWidth);
  if (!(H >= Number(lim.minHeight) && H <= Number(lim.maxHeight))) throw bad('leaf height', H, lim.minHeight, lim.maxHeight);
  if (!(depth >= Number(lim.minDepth) && depth <= Number(lim.maxDepth))) throw bad('frame depth', depth, lim.minDepth, lim.maxDepth);
  if (F.headJoint !== 'mitre') throw new FireDoorGeometryError(`${name}: frame head joint '${F.headJoint}' is not implemented (only 'mitre')`, { door: name, headJoint: F.headJoint });

  // ── the leaf ──
  const T = fireDoorLeafThickness(P, fire, rating);
  const blankAllowance = Number(L.blankAllowance) || 0;
  const leaf = {
    width: W, height: H, thickness: T,
    blank: { width: R(W + blankAllowance), height: R(H + blankAllowance), thickness: T, allowance: blankAllowance },
  };

  const rebateD = R(T + Number(F.rebateClearance));
  const overallW = R(W + frameAddW);
  const overallH = R(H + frameAddH);
  const rawWidth = R(depth + Number(F.rawWidthAllowance));
  const section = `${thickness}x${depth}`;
  const rawSection = `${rawThickness}x${rawWidth}`;
  const member = (id, role, length, mitreTop, mitreBottom) => ({
    id, role, length: R(length), mitreTop, mitreBottom,
    finished: { w: thickness, d: depth }, raw: { w: rawThickness, d: rawWidth },
    section, rawSection, quantity: 1,
  });
  const members = [
    member('FD-HEAD', 'head', overallW, true, true),
    member('FD-JAMB-H', 'jambHinge', overallH, true, false),
    member('FD-JAMB-L', 'jambLock', overallH, true, false),
  ];
  const jambLength = overallH;

  // ── the hinges (v1.1, the owner's rule of 27.10.2026) ──
  // top hinge: its top edge topOffset below the leaf top; bottom hinge: its
  // bottom edge bottomOffset above the leaf bottom; with three hinges the
  // middle one has its CENTRE midAboveCentre above the leaf centre (2040:
  // 150 / 769 / 1738); with more than three the inner ones spread equally.
  const hCount = Math.max(2, Math.round(Number(HG.count) || 3));
  const hLen = Number(HG.length);
  const topOffset = Number(HG.topOffset), bottomOffset = Number(HG.bottomOffset);
  const midAboveCentre = Number(HG.midAboveCentre) || 0;
  const lastTop = H - bottomOffset - hLen;
  const step = (lastTop - topOffset) / (hCount - 1);   // the equal spacing (the old macro rule), kept for the sheets and count != 3
  const hingeTops = Array.from({ length: hCount }, (_, i) => {
    if (i === 0) return topOffset;
    if (i === hCount - 1) return lastTop;
    if (hCount === 3) return H / 2 - midAboveCentre - hLen / 2;
    return topOffset + i * step;
  });
  const hingeJambShift = faceOut + gapHead;
  const hingePositions = hingeTops.map((t, i) => {
    const top = R(t);
    return { i, top, bottom: R(top + hLen), centre: R(top + hLen / 2), jambTop: R(hingeJambShift + top) };
  });
  const recess = { length: Number(HG.recessLength), width: Number(HG.recessWidth), depth: Number(HG.recessDepth), radius: Number(HG.cornerRadius) };
  const hinges = {
    count: hCount, length: hLen, step: R(step), macroHinge: fire ? 1 : 0, product: fire ? 'fire' : 'standard',
    // the rule's numbers travel with the positions so a sheet can print the rule it was cut by
    topOffset, bottomOffset, midAboveCentre,
    midCentreAboveLeafCentre: hCount === 3 ? R(H / 2 - hingePositions[1].centre) : null,
    recess, positions: hingePositions,
  };

  // ── the lock (3.6) ──
  const spindleHeight = Number(LK.spindleHeight), backset = Number(LK.backset);
  const fo = LK.forend, ca = LK.case;
  const forendCentreFromBottom = R(spindleHeight - Number(LK.forendCentreBelowSpindle));
  const caseTopFromBottom = R(spindleHeight + Number(LK.caseTopAboveSpindle));
  const millLength = R(Number(fo.length) + Number(fo.millOversize)), millWidth = R(Number(fo.width) + Number(fo.millOversize));
  const macroLock = !fire ? 1 : (rating === 'FD60' ? 3 : 2);
  const cylinderOffset = lockType === 'euro' ? Number(LK.euroCentres) : lockType === 'bathroom' ? Number(LK.bathroomCentres) : null;
  const cylinderBore = lockType === 'euro' ? Number(LK.euroBore) : Number(LK.bathroomBore);
  const lock = {
    type: lockType, macroLock, euro: lockType === 'euro', spindleHeight, backset,
    forend: {
      length: Number(fo.length), width: Number(fo.width), millLength, millWidth, depth: Number(fo.depth),
      centreFromBottom: forendCentreFromBottom, centreFromTop: R(H - forendCentreFromBottom), radius: R(millWidth / 2),
    },
    case: {
      depth: Number(ca.depth), height: Number(ca.height), pocketWidth: Number(ca.pocketWidth), pocketDepth: Number(ca.pocketDepth), pocketHeight: Number(ca.pocketHeight),
      topFromBottom: caseTopFromBottom, topFromTop: R(H - caseTopFromBottom),
    },
    spindle: { fromBottom: spindleHeight, fromTop: R(H - spindleHeight), fromLockEdge: backset, bore: Number(LK.spindleBore) },
    cylinder: cylinderOffset === null ? null : {
      kind: lockType, fromBottom: R(spindleHeight - cylinderOffset), fromTop: R(H - (spindleHeight - cylinderOffset)), fromLockEdge: backset, bore: cylinderBore,
    },
  };

  // ── the keep on the lock jamb ──
  const keepCentreFromFoot = R(floorGap + spindleHeight - Number(LK.forendCentreBelowSpindle));
  const keepMillLength = R(Number(KP.length) + Number(KP.millOversize)), keepMillWidth = R(Number(KP.width) + Number(KP.millOversize));
  const keep = {
    macroKeep: macroLock, keepStyle: 1,
    plate: { length: Number(KP.length), width: Number(KP.width), millLength: keepMillLength, millWidth: keepMillWidth, depth: Number(KP.plateDepth) },
    pocket: { length: Number(KP.pocket.length), width: Number(KP.pocket.width), depth: Number(KP.pocket.depth) },
    centreFromFoot: keepCentreFromFoot, centreFromTop: R(jambLength - keepCentreFromFoot),
  };

  // ── the vision panel ──
  const vpPlaced = placeVisionPanel(V, vpStyle, vpCustom, W, H);
  const paneArea = (p) => (p.w * p.h) / 1e6;
  const panePerimM = (p) => (2 * (p.w + p.h)) / 1000;
  const glassSqm = vpPlaced.panes.reduce((a, p) => a + paneArea(p), 0);
  const beadM = vpPlaced.panes.reduce((a, p) => a + panePerimM(p), 0) * (Number(V.beadFaces) || 0);
  const glazingIntuM = fire ? vpPlaced.panes.reduce((a, p) => a + panePerimM(p), 0) : 0;
  const glassThickness = Number(V.glassThickness) || 6;
  const vp = {
    style: vpPlaced.style, label: vpPlaced.label, panes: vpPlaced.panes,
    glassSqm: Math.round(glassSqm * 1000) / 1000, beadM: Math.round(beadM * 1000) / 1000, intuM: Math.round(glazingIntuM * 1000) / 1000,
    glassThickness, warnings: vpPlaced.warnings,
  };

  // ── the intumescent strips (v1.1: one size, 15 x 4 all around; FD30 one strip, FD60 two; none on a DR door) ──
  const intuStrips = fire ? Math.max(0, Math.round(Number(IN.stripsByRating?.[rating] ?? 1))) : 0;
  const intuStyle = intuStrips ? Number(IN.macroStyleByStrips?.[intuStrips] ?? IN.macroStyleByStrips?.[1] ?? 1) : 0;
  const intumescent = intuStrips ? {
    strips: intuStrips, width: Number(IN.width), thickness: Number(IN.thickness),
    groove: { width: Number(IN.grooveWidth), depth: Number(IN.grooveDepth) },
    label: `${intuStrips} x ${Number(IN.width)} x ${Number(IN.thickness)} all around`,
    macroStyle: intuStyle,
    metres: Math.round(intuStrips * (2 * H + W)) / 1000,
  } : null;

  // ── the closer (v1.1: a kind; the built in closer has no machining until the owner's component files arrive) ──
  const closer = closerKind === 'none' ? null : { type: closerKind, label: CLOSER_LABELS[closerKind], machined: false };
  const closerFlag = closerKind === 'builtin' ? 2 : closerKind === 'surface' ? 1 : 0;

  // ── the corner dowels (v1.1): perJoint dowels per mitred corner, square to the mitre face ──
  const DW = F.dowels || {};
  const dowelDia = Number(DW.dia) || 0, dowelLen = Number(DW.length) || 0, dowelPerJoint = dowelDia > 0 ? Math.max(0, Math.round(Number(DW.perJoint) || 0)) : 0;
  const dowelMargin = Number(DW.margin) || 0;
  // positions along the frame depth (z, from the outside face), equal spacing between the margins
  const dowelZ = dowelPerJoint ? Array.from({ length: dowelPerJoint }, (_, k) => R(dowelPerJoint === 1 ? depth / 2 : dowelMargin + k * ((depth - 2 * dowelMargin) / (dowelPerJoint - 1)))) : [];
  const dowelJoints = 2;   // head to hinge jamb, head to lock jamb
  const dowels = {
    dia: dowelDia, length: dowelLen, perJoint: dowelPerJoint, margin: dowelMargin, joints: dowelJoints,
    count: dowelPerJoint * dowelJoints,
    angle: 45, boreDepth: R(dowelLen / 2), yCentre: R(thickness / 2), positionsAlongDepth: dowelZ,
  };

  // ── the machining ops ──
  let opN = 0;
  const op = (kind, face, x, y, z, length, width, depthMm, radius, extra = {}) => ({
    id: `${kind}-${(opN += 1)}`, kind, face, x: R(x), y: R(y), z: R(z), length: R(length), width: R(width), depth: R(depthMm), radius: R(radius), ...extra,
  });
  const leafOps = [];
  hingePositions.forEach((h) => leafOps.push(op('hingeRecess', 'hingeEdge', h.top - (recess.length - hLen) / 2, 0, 0, recess.length, recess.width, recess.depth, recess.radius, { note: `hinge ${h.i + 1}` })));
  leafOps.push(op('forendRecess', 'lockEdge', lock.forend.centreFromTop - millLength / 2, W, T / 2 - millWidth / 2, millLength, millWidth, lock.forend.depth, lock.forend.radius, { note: 'lock forend, full radius ends' }));
  leafOps.push(op('casePocket', 'lockEdge', lock.case.topFromTop - (lock.case.pocketHeight - lock.case.height) / 2, W, T / 2 - lock.case.pocketWidth / 2, lock.case.pocketHeight, lock.case.pocketWidth, lock.case.pocketDepth, lock.case.pocketWidth / 2, { note: 'lock case pocket' }));
  leafOps.push(op('spindleHole', 'pull', H - spindleHeight, W - backset, 0, lock.spindle.bore, lock.spindle.bore, T, lock.spindle.bore / 2, { note: 'spindle, through, x y = centre' }));
  if (lock.cylinder) leafOps.push(op('cylinderHole', 'pull', H - lock.cylinder.fromBottom, W - backset, 0, lock.cylinder.bore, lock.cylinder.bore, T, lock.cylinder.bore / 2, { note: `${lockType} cylinder, through, x y = centre` }));
  vp.panes.forEach((p) => leafOps.push(op('vpCutout', 'pull', p.x, p.y, 0, p.box.h, p.box.w, T, Number(V.cornerRadius) || 0, { rotated: p.rotated, angle: p.angle, pane: p.i, note: `vision panel ${p.i} ${p.w} x ${p.h}, layout per bSolid macro` })));
  if (intumescent) {
    const gw = intumescent.groove.width, gd = intumescent.groove.depth;
    const off = Number(IN.twoStripOffset) || 0;
    const centres = intumescent.strips >= 2 ? [T / 2 - off, T / 2 + off] : [T / 2];
    centres.forEach((cz, k) => {
      const z0 = cz - gw / 2;
      const note = `intumescent ${intumescent.width} x ${intumescent.thickness}, groove ${gw} x ${gd}`;
      leafOps.push(op('intuGroove', 'top', 0, 0, z0, W, gw, gd, 0, { strip: k + 1, note }));
      leafOps.push(op('intuGroove', 'hingeEdge', 0, 0, z0, H, gw, gd, 0, { strip: k + 1, note }));
      leafOps.push(op('intuGroove', 'lockEdge', 0, W, z0, H, gw, gd, 0, { strip: k + 1, note }));
    });
  }
  if (leadEdge) leafOps.push(op('leadEdge', 'lockEdge', 0, W, 0, H, T, 0, 0, { value: Number(L.leadEdgeMacroValue), note: 'leading edge bevel, macro LEAD_EDGE' }));

  const memberOps = (m) => {
    const ops = [];
    ops.push(op('rebate', 'opening', 0, faceOut, 0, m.length, rebateW, rebateD, 0, { note: `rebate ${rebateW} x ${rebateD} from solid, full length` }));
    if (m.role === 'jambHinge') {
      hingePositions.forEach((h) => ops.push(op('hingeRecess', 'rebateCheek', h.jambTop - (recess.length - hLen) / 2, faceOut, 0, recess.length, recess.width, recess.depth, recess.radius, { note: `hinge ${h.i + 1}` })));
    }
    if (m.role === 'jambLock') {
      ops.push(op('keepPlate', 'rebateCheek', keep.centreFromTop - keepMillLength / 2, faceOut, T / 2 - keepMillWidth / 2, keepMillLength, keepMillWidth, keep.plate.depth, keepMillWidth / 2, { note: 'keep plate, full radius ends' }));
      ops.push(op('keepPocket', 'rebateCheek', keep.centreFromTop - keep.pocket.length / 2, faceOut, T / 2 - keep.pocket.width / 2, keep.pocket.length, keep.pocket.width, keep.pocket.depth, keep.pocket.width / 2, { note: 'latch and bolt pocket behind the keep' }));
    }
    if (m.mitreTop) ops.push(op('mitre', 'end', 0, 0, 0, 0, thickness, depth, 0, { angle: 45, note: m.role === 'head' ? 'left end' : 'top end' }));
    if (m.mitreBottom) ops.push(op('mitre', 'end', m.length, 0, 0, 0, thickness, depth, 0, { angle: 45, note: 'right end' }));
    // the corner dowels: one bore per dowel on each mitred end, on face `mitre`,
    // x = the end's long point (0 or length), y = the thickness centre, z along
    // the depth; bored square to the mitre face (angle 45 to the member axis),
    // dowelLen / 2 deep so the dowel sits half in each piece; x y = the bore centre
    if (dowels.count) {
      const ends = [];
      if (m.mitreTop) ends.push({ x: 0, label: m.role === 'head' ? 'left end' : 'top end' });
      if (m.mitreBottom) ends.push({ x: m.length, label: 'right end' });
      ends.forEach((e) => dowelZ.forEach((z, k) => ops.push(op('dowelBore', 'mitre', e.x, dowels.yCentre, z, dowels.dia, dowels.dia, dowels.boreDepth, dowels.dia / 2, { angle: 45, dowel: k + 1, note: `dowel ${dowels.dia} x ${dowels.length}, ${e.label}, bore square to the mitre, x y z = centre` }))));
    }
    return ops;
  };
  const machining = {
    leaf: leafOps,
    head: memberOps(members[0]),
    jambHinge: memberOps(members[1]),
    jambLock: memberOps(members[2]),
  };

  // ── the bSuite document variables (table 4.7 of the brief, names 1:1, key order = write order) ──
  const hand = Number(BS.hand?.[hingeSide] ?? (hingeSide === 'right' ? 1 : 0));
  const MD = BS.macroDefaults || {};
  const hingeVars = Object.fromEntries(hingePositions.map((h) => [`HINGE_${h.i + 1}`, h.top]));
  const jambHingeVars = Object.fromEntries(hingePositions.map((h) => [`HINGE_${h.i + 1}`, h.jambTop]));
  const leafVars = {
    LPX: H, LPY: W, LPZ: T,
    HAND: hand, LH: hingeSide === 'left' ? 1 : 0, RH: hingeSide === 'right' ? 1 : 0,
    HINGE: hinges.macroHinge, LOCK: macroLock, LOCK_H: spindleHeight, SPINDLE: Number(MD.SPINDLE ?? 1), EURO: lock.euro ? 1 : 0,
    KEEP: Number(MD.KEEP_LEAF ?? 0), KEEP_STYLE: Number(MD.KEEP_STYLE_LEAF ?? 0),
    // INTU = the strip count (0 / 1 / 2, v1.1); INTU_STYLE = the Master_Door style the count maps to
    INTU: intuStrips, INTU_W: intumescent ? intumescent.width : 0, INTU_T: intumescent ? intumescent.thickness : 0, INTU_STYLE: intuStyle,
    VP_STYLE: vp.style,
    C_VP_L: Number(vpCustom.length) || 0, C_VP_W: Number(vpCustom.width) || 0, C_VP_NUM: Math.round(Number(vpCustom.count) || 0), C_VP_RAIL: Number(vpCustom.rail) || 0, C_VP_POS: Number(vpCustom.pos) === 90 ? 90 : 0,
    D_TOP_RAIL: Number(V.topRail), D_MID_RAIL: Number(V.midRail), D_SIDE_MARGIN: Number(V.sideMargin),
    LEAD_EDGE: leadEdge ? 1 : 0,
    REBATE: Number(MD.REBATE ?? 0), REBATE_STYLE: Number(MD.REBATE_STYLE ?? 1),
    SPY_ON: Number(MD.SPY_ON ?? 0), SPY_H: Number(MD.SPY_H ?? 1450), LBOX: Number(MD.LBOX ?? 0), L_BOX_H: Number(MD.L_BOX_H ?? 1000),
    DROP_CILL: Number(MD.DROP_CILL ?? 0), PREM_DOOR: Number(MD.PREM_DOOR ?? 0),
    // CLOSER (v1.1): 0 none, 1 surface, 2 built in
    ...hingeVars, HINGE_D: recess.depth, CLOSER: closerFlag,
  };
  const frameBase = (m) => ({ LPX: m.length, LPY: depth, LPZ: thickness, REB_W: rebateW, REB_D: rebateD, HAND: hand, HINGE: hinges.macroHinge });
  // the corner dowels (v1.1): count per mitred end, size, bore depth and the positions along the depth
  const dowelVars = (m) => ({ DOWEL_N: dowels.perJoint, DOWEL_D: dowels.dia, DOWEL_L: dowels.length, DOWEL_DEPTH: dowels.boreDepth, ...Object.fromEntries(dowelZ.map((z, k) => [`DOWEL_${k + 1}`, z])) });
  const bsuiteVars = {
    leaf: leafVars,
    head: { ...frameBase(members[0]), HINGE_D: recess.depth, MITRE_TOP: 1, MITRE_BOTTOM: 1, ...dowelVars(members[0]) },
    jambHinge: { ...frameBase(members[1]), ...jambHingeVars, HINGE_D: recess.depth, MITRE_TOP: 1, MITRE_BOTTOM: 0, ...dowelVars(members[1]) },
    jambLock: { ...frameBase(members[2]), HINGE_D: recess.depth, KEEP: keep.macroKeep, KEEP_STYLE: keep.keepStyle, KEEP_Y: keep.centreFromFoot, MITRE_TOP: 1, MITRE_BOTTOM: 0, ...dowelVars(members[2]) },
  };

  // ── the cut list records ──
  const blankNote = fire ? `door blank ${rating}` : 'door blank non-fire';
  const dowelNote = dowels.count ? `, ${dowels.perJoint} dowels ${dowels.dia} x ${dowels.length} per corner` : '';
  const box = members.map((m) => {
    const rec = createComponentRecord(windowSpec, 'box', m.id, section, m.length, 1, `${m.role === 'head' ? 'head, both ends mitred 45' : m.role === 'jambHinge' ? `hinge jamb, top mitred 45, ${hCount} hinge recesses` : 'lock jamb, top mitred 45, keep'}${dowelNote} · rebate ${rebateW} x ${rebateD} from solid`);
    rec.rawSection = rawSection;
    rec.mitreTop = m.mitreTop;
    rec.mitreBottom = m.mitreBottom;
    rec.role = m.role;
    return rec;
  });
  const leafRec = createComponentRecord(windowSpec, 'sash', 'FD-LEAF', `${T}x${W}`, H, 1, blankNote);
  leafRec.role = 'leaf';
  const sash = [leafRec];

  // ── glass units (one per pane) ──
  const customGlassUnits = vp.panes.map((p) => ({
    width: p.w, height: p.h, qty: 1, role: 'vp', location: `vision panel ${p.i}`, fire,
    note: `${fire ? 'fire glass' : 'toughened'} ${glassThickness} · ${vp.label}, layout per bSolid macro`,
  }));

  // ── weights ──
  const marginPct = Number.isFinite(Number(settings?.weightMarginPct)) ? Number(settings.weightMarginPct) : DEFAULT_WEIGHT_MARGIN_PCT;
  const wMargin = 1 + (marginPct || 0) / 100;
  const timberKg = members.reduce((a, m) => a + kgPerM(thickness, depth) * (m.length / 1000), 0);
  const leafTimberKg = kgPerM(T, W) * (H / 1000);
  const glassKg = glassSqm * GLASS_KG_PER_SQM_PER_MM * glassThickness;
  const leafKg = round((leafTimberKg + glassKg) * wMargin);

  // ── paint: the leaf both faces + the frame visible faces (35 outside + 50 inside per member) ──
  const paintAreaSqm = round((2 * W * H + (faceOut + faceIn) * members.reduce((a, m) => a + m.length, 0)) / 1_000_000);
  const paint = paintFromAreaSqm(paintAreaSqm);

  return {
    category: 'firedoor',
    firedoor: {
      name, fire, rating,
      inputs: {
        openingWidth: opening.width, openingHeight: opening.height,
        leafWidth: W, leafHeight: H, leafOverride: { width: axW.source === 'leaf', height: axH.source === 'leaf' },
        frameDepth: depth, hingeSide, lockType, closer: closerKind, vpStyle, vpCustom, leadEdge,
      },
      opening,
      handing: { hingeSide, label: `Hinge ${hingeSide}` },
      leaf,
      frame: {
        overall: { width: overallW, height: overallH },
        depth, thickness, rawThickness, rawWidth,
        rebate: { width: rebateW, depth: rebateD }, faces: { outside: faceOut, inside: faceIn },
        gaps: { side: gapSide, head: gapHead, floor: floorGap, wallSide: wallGapSide, wallHead: wallGapHead }, headJoint: F.headJoint,
        dowels,
        members,
      },
      hinges, lock, keep, vp, intumescent, closer,
      machining, bsuiteVars,
      paintAreaSqm,
    },
    components: { box, sash, beading: [] },
    customGlassUnits,
    panels: [],
    weights: {
      timber: round(timberKg + leafTimberKg), glass: round(glassKg),
      total: round((timberKg + leafTimberKg + glassKg) * wMargin),
      leaves: [{ role: 'leaf', weightKg: leafKg }],
    },
    paint,
    consumables: {
      glass: { type: fire ? 'fire' : 'toughened', sqm: Math.round(glassSqm * 100) / 100 },
      hinges: { count: hCount, product: hinges.product },
      lock: { type: lockType },
      keep: 1,
      closer: closer ? { type: closerKind, count: 1 } : null,
      dowels: dowels.count ? { count: dowels.count, dia: dowels.dia, length: dowels.length } : null,
      intumescent: intumescent ? { metres: intumescent.metres, width: intumescent.width, thickness: intumescent.thickness, strips: intumescent.strips } : null,
      glazingBeads: { metres: vp.beadM },
      glazingIntumescent: { metres: vp.intuM },
    },
    frame: { width: overallW, height: overallH },
    config: { key: 'firedoor', rows: 1, cols: 1 },
    barPositions: { vertical: [], horizontal: [] },
  };
}
