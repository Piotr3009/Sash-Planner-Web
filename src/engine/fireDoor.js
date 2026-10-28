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
 *               (v1.2) closer.symbol = the drawing symbol of the kind (the
 *               surface body, arm and shoe; the built in body and head track).
 *   vision      (v1.2) a TYPE (None / Standard / Square / Narrow slot / Round /
 *   panel       Diamond / Double) filling a shape (rect / round / diamond), the
 *               pane size, a count arranged one above another or side by side
 *               with a gap, and a POSITION: across centred (+ shift towards the
 *               lock edge) or a distance from the hinge / lock edge; down the
 *               top edge from the leaf top, the centre or the bottom edge above
 *               the leaf bottom. A v1 / v1.1 record (a Master_Door style id) is
 *               read into the same model. Glass: FD30 standard / FD insulated /
 *               Frosted only (vp.glass). VP_STYLE still goes out when the panel
 *               matches a Master_Door style; VP_SHAPE / VP_N / VP_W / VP_H /
 *               VP_GAP / VP_ARR / VP_X / VP_Y / VP_R carry any panel.
 *   strips      (v1.2) intumescent.colour from intumescent.colours.
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
 *   through, x y = the pane's bounding box corner; v1.2 `shape` rect (radius
 *   vp.cornerRadius) / round (radius = half the diameter) / diamond (rotated
 *   true, angle 45, the bounding box)), intuGroove per strip per edge (top, hingeEdge,
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
 *   CENTRE on the mitre face: on a 45 mitre the point at y = thickness / 2 lies
 *   thickness / 2 along the member from the long point, so x = 25 (top / left
 *   end) or length - 25 (the head's right end), y = thickness / 2, z along the
 *   depth; length = width = the dowel diameter, depth = half the dowel length,
 *   angle 45 = the bore axis is square to the mitre face.
 */
import { getFireDoorProfile, kgPerM } from './profile.js';
import { round, createComponentRecord } from './records.js';
import { buildCircleGlassOutline, circleArcs, glassOutlinePoly } from './arch.js';

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
 * v1 / v1.1 placement, kept as it was (not called since v1.2: a legacy style
 * is read into the v1.2 model by fireDoorVpFromLegacy and placed by
 * placeVisionPanelV12). The vision panel panes of a style on a leaf W x H (the ZAŁOŻENIE placement of
 * the brief, 3.7: the macro placement is not decoded, the export sends the
 * style id). Returns { style, label, panes, warnings }. A pane: { i, w, h, x
 * (leaf top to the pane top), y (hinge edge to the pane left), rotated, angle,
 * box: { w, h } (the bounding box; = w x h unless the diamond) }.
 */
// eslint-disable-next-line no-unused-vars
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

const VP_SHAPES = ['none', 'rect', 'round', 'diamond'];
const VP_ACROSS = ['centre', 'hinge', 'lock'];
const VP_DOWN = ['top', 'centre', 'bottom'];
const VP_ARRANGE = ['stack', 'side'];
const finiteOr = (v, def) => { if (v === undefined || v === null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };

/**
 * A v1 / v1.1 vision panel (a Master_Door style id and the custom block) read
 * into the v1.2 model: the style's pane size, count and gap, centred, the top
 * at topRail. Style 2 (two different panes) reads as two of its first pane.
 */
export function fireDoorVpFromLegacy(V, styleId, custom) {
  const id = Math.max(0, Math.round(Number(styleId) || 0));
  const pos = { across: 'centre', acrossOffset: 0, down: 'top', downOffset: Number(V.topRail) || 0 };
  const none = { type: 'none', shape: 'none', width: 0, height: 0, count: 0, arrange: 'stack', gap: 0, ...pos, source: 'legacy', legacyStyle: id, legacyNote: '' };
  if (!id) return none;
  const st = (Array.isArray(V.styles) ? V.styles : []).find((x) => Number(x.id) === id);
  if (!st || st.arrange === 'none') return { ...none, legacyNote: `unknown Master_Door style ${id}` };
  const typeFor = (w, h, n) => (n === 2 ? 'double' : (w === h ? 'square' : (w <= 200 ? 'narrow' : 'standard')));
  if (st.arrange === 'custom') {
    const c = custom || {};
    const len = Number(c.length) || 0, wid = Number(c.width) || 0, n = Math.max(0, Math.round(Number(c.count) || 0));
    const horizontal = Number(c.pos) === 90;
    const w = horizontal ? len : wid, h = horizontal ? wid : len;
    return { ...none, type: typeFor(w, h, n), shape: n && w && h ? 'rect' : 'none', width: w, height: h, count: n, gap: Number(c.rail) || 0 };
  }
  if (st.arrange === 'diamond') return { ...none, type: 'diamond', shape: 'diamond', width: Number(st.w), height: Number(st.w), count: 1 };
  if (st.arrange === 'stack') {
    const first = Array.isArray(st.panes) && st.panes.length ? st.panes[0] : { w: st.w, h: st.h };
    const n = Math.max(1, Math.round(Number(st.count) || 1));
    const differ = Array.isArray(st.panes) && st.panes.some((q) => Number(q.w) !== Number(first.w) || Number(q.h) !== Number(first.h));
    // a style of different panes (style 2) keeps its own sizes, top to bottom
    return {
      ...none, type: typeFor(Number(first.w), Number(first.h), n), shape: 'rect', width: Number(first.w), height: Number(first.h), count: n,
      gap: Number(V[st.gap] ?? V.stackGap) || 0,
      ...(differ ? { paneSizes: st.panes.map((q) => ({ w: Number(q.w), h: Number(q.h) })), count: st.panes.length } : {}),
    };
  }
  return { ...none, type: typeFor(Number(st.w), Number(st.h), 1), shape: 'rect', width: Number(st.w), height: Number(st.h), count: 1 };
}

/**
 * The v1.2 vision panel input of a door: the stored block (spec.vp) over its
 * type's preset and the profile's position default; without a stored block
 * the legacy style is read (fireDoorVpFromLegacy). Round and diamond take the
 * width as the diameter / side. Never throws.
 */
export function fireDoorVpInput(V, raw, legacyStyle, legacyCustom) {
  if (!raw || typeof raw !== 'object') return fireDoorVpFromLegacy(V, legacyStyle, legacyCustom);
  const types = Array.isArray(V.types) ? V.types : [];
  const preset = types.find((t) => t.id === raw.type) || null;
  const type = preset ? preset.id : (raw.type ? 'custom' : 'none');
  const shape = VP_SHAPES.includes(raw.shape) ? raw.shape : (preset ? preset.shape : 'none');
  const P0 = V.position || {};
  const width = Math.max(0, finiteOr(raw.width, finiteOr(preset?.width, 0)));
  const height = shape === 'round' || shape === 'diamond' ? width : Math.max(0, finiteOr(raw.height, finiteOr(preset?.height, 0)));
  const count = shape === 'none' ? 0 : Math.max(1, Math.min(10, Math.round(finiteOr(raw.count, finiteOr(preset?.count, 1)))));
  // a legacy style of two different panes (style 2) keeps its sizes through an
  // edit of the position; a size, count or shape edit makes the panes equal
  const sizes = Array.isArray(raw.paneSizes) ? raw.paneSizes.map((q) => ({ w: Number(q?.w), h: Number(q?.h) })).filter((q) => q.w > 0 && q.h > 0) : [];
  const keepSizes = shape === 'rect' && sizes.length === count && sizes.length > 1 && sizes[0].w === width && sizes[0].h === height;
  const arrangeIn = VP_ARRANGE.includes(raw.arrange) ? raw.arrange : (VP_ARRANGE.includes(preset?.arrange) ? preset.arrange : 'stack');
  return {
    type, shape, width, height, count,
    ...(keepSizes ? { paneSizes: sizes } : {}),
    // one pane has no arrangement (side by side of one = the same pane)
    arrange: count > 1 ? arrangeIn : 'stack',
    gap: Math.max(0, finiteOr(raw.gap, finiteOr(preset?.gap, 0))),
    across: VP_ACROSS.includes(raw.across) ? raw.across : (VP_ACROSS.includes(P0.across) ? P0.across : 'centre'),
    acrossOffset: finiteOr(raw.acrossOffset, finiteOr(P0.acrossOffset, 0)),
    down: VP_DOWN.includes(raw.down) ? raw.down : (VP_DOWN.includes(P0.down) ? P0.down : 'top'),
    downOffset: finiteOr(raw.downOffset, finiteOr(P0.downOffset, Number(V.topRail) || 0)),
    source: 'v12', legacyStyle: null, legacyNote: '',
  };
}

/** The vision panel in words: { label, sizeLabel, positionLabel }. */
export function fireDoorVpWords(V, vin) {
  if (!vin || vin.shape === 'none' || !vin.count) return { label: 'None', sizeLabel: '', positionLabel: '' };
  const t = (Array.isArray(V.types) ? V.types : []).find((x) => x.id === vin.type);
  const typeLabel = t ? t.label : 'Custom';
  const one = vin.shape === 'round' ? `dia ${R(vin.width)}` : vin.shape === 'diamond' ? `${R(vin.width)} x ${R(vin.width)} turned 45` : `${R(vin.width)} x ${R(vin.height)}`;
  const arr = `${vin.arrange === 'side' ? 'side by side' : 'one above another'}, gap ${R(vin.gap)}`;
  const sizeLabel = Array.isArray(vin.paneSizes) && vin.paneSizes.length > 1
    ? `${vin.paneSizes.map((q) => `${R(q.w)} x ${R(q.h)}`).join(' + ')}, ${arr}`
    : (vin.count > 1 ? `${vin.count} x ${one}, ${arr}` : one);
  const off = R(vin.acrossOffset);
  const across = vin.across === 'hinge' ? `${off} from the hinge edge` : vin.across === 'lock' ? `${off} from the lock edge`
    : (off ? `centred, shifted ${Math.abs(off)} towards the ${off > 0 ? 'lock' : 'hinge'} edge` : 'centred');
  const dOff = R(vin.downOffset);
  const down = vin.down === 'centre' ? `centre ${dOff} above the leaf bottom` : vin.down === 'bottom' ? `bottom ${dOff} above the leaf bottom` : `top ${dOff} below the leaf top`;
  return { label: `${typeLabel}: ${sizeLabel}`, sizeLabel, positionLabel: `${across}, ${down}` };
}

/**
 * The panes of a v1.2 vision panel on a leaf W x H in the leaf board system
 * (x from the leaf top, y from the hinge edge). A pane: { i, w, h, x, y,
 * shape, rotated, angle, radius, box: { w, h } } with x y = the bounding box
 * corner. group = the bounding box of all panes with its four edge distances.
 * Warnings (never a failure): a panel past the leaf, less than minEdge of
 * timber, a panel running into the lock (the forend / case zone).
 */
function placeVisionPanelV12(V, vin, W, H, lockZone) {
  const warnings = [];
  if (!vin || vin.shape === 'none' || !vin.count || !(vin.width > 0) || !(vin.height > 0)) return { panes: [], group: null, warnings };
  const s = vin.shape;
  const n = vin.count, gap = vin.gap, side = vin.arrange === 'side';
  // one size for every pane, or the legacy style's own sizes (paneSizes)
  const sizes = Array.isArray(vin.paneSizes) && vin.paneSizes.length ? vin.paneSizes : Array.from({ length: n }, () => ({ w: vin.width, h: vin.height }));
  const boxOf = (q) => (s === 'diamond' ? { w: R(q.w * Math.SQRT2), h: R(q.w * Math.SQRT2) } : { w: q.w, h: q.h });
  const boxes = sizes.map(boxOf);
  const gw = side ? boxes.reduce((a, b) => a + b.w, 0) + (boxes.length - 1) * gap : Math.max(...boxes.map((b) => b.w));
  const gh = side ? Math.max(...boxes.map((b) => b.h)) : boxes.reduce((a, b) => a + b.h, 0) + (boxes.length - 1) * gap;
  const y0 = vin.across === 'hinge' ? vin.acrossOffset : vin.across === 'lock' ? W - vin.acrossOffset - gw : (W - gw) / 2 + vin.acrossOffset;
  const x0 = vin.down === 'centre' ? H - vin.downOffset - gh / 2 : vin.down === 'bottom' ? H - vin.downOffset - gh : vin.downOffset;
  let run = 0;
  const panes = sizes.map((q, i) => {
    const box = boxes[i];
    // stacked panes centred on the group's width, side by side on its height
    const x = side ? x0 + (gh - box.h) / 2 : x0 + run;
    const y = side ? y0 + run : y0 + (gw - box.w) / 2;
    run += (side ? box.w : box.h) + gap;
    // round: half the diameter; rect and diamond: the cutter corner radius (a milled cut-out has no sharp inside corner)
    const radius = s === 'round' ? q.w / 2 : (Number(V.cornerRadius) || 0);
    // a legacy stack the v1 placement turned keeps its v1 flags (rotated, angle 90)
    const turned = !!vin.turned && s === 'rect';
    return { i: i + 1, w: q.w, h: s === 'round' || s === 'diamond' ? q.w : q.h, x: R(x), y: R(y), shape: s, rotated: s === 'diamond' || turned, angle: s === 'diamond' ? 45 : (turned ? 90 : 0), radius: R(radius), box };
  });
  const group = {
    x: R(x0), y: R(y0), w: R(gw), h: R(gh),
    fromTop: R(x0), fromBottom: R(H - x0 - gh), fromHingeEdge: R(y0), fromLockEdge: R(W - y0 - gw),
    centreFromBottom: R(H - x0 - gh / 2), centreFromHingeEdge: R(y0 + gw / 2),
  };
  const minEdge = Number(V.minEdge) || 0;
  const edges = [['top', group.fromTop], ['bottom', group.fromBottom], ['hinge edge', group.fromHingeEdge], ['lock edge', group.fromLockEdge]];
  edges.forEach(([what, d]) => {
    if (d < 0) warnings.push(`vision panel: it runs ${R(-d)} past the leaf ${what}`);
    else if (d < minEdge) warnings.push(`vision panel: only ${d} of timber at the ${what} (minimum ${minEdge}, Window Settings)`);
  });
  if (lockZone && x0 < lockZone.x1 && x0 + gh > lockZone.x0 && y0 + gw > lockZone.y0 && y0 < lockZone.y1) {
    warnings.push(`vision panel: it runs into the lock (the case and forend zone ${R(lockZone.x0)} to ${R(lockZone.x1)} from the leaf top, ${R(W - lockZone.y0)} in from the lock edge)`);
  }
  return { panes, group, warnings };
}

/**
 * The Master_Door VP_STYLE of a v1.2 panel: the id of the style it matches
 * exactly (shape, count, pane size, gap, centred, the top at topRail), 14
 * (custom) for another rectangle, 0 for none / round / an unmatched diamond.
 * note = why the old macro cannot cut it as placed (the new macro reads VP_*).
 */
function masterDoorVpStyle(V, vin) {
  // a v1 / v1.1 record keeps the style id it was saved with (the macro places it as before)
  if (vin && vin.source === 'legacy') return { id: Number(vin.legacyStyle) || 0, note: '' };
  if (!vin || vin.shape === 'none' || !vin.count) return { id: 0, note: '' };
  const centredTop = vin.across === 'centre' && Number(vin.acrossOffset) === 0 && vin.down === 'top' && Number(vin.downOffset) === Number(V.topRail);
  if (centredTop && vin.arrange === 'stack') {
    for (const st of (Array.isArray(V.styles) ? V.styles : [])) {
      if (st.arrange === 'single' && vin.shape === 'rect' && vin.count === 1 && Number(st.w) === vin.width && Number(st.h) === vin.height) return { id: Number(st.id), note: '' };
      if (st.arrange === 'diamond' && vin.shape === 'diamond' && vin.count === 1 && Number(st.w) === vin.width) return { id: Number(st.id), note: '' };
      if (st.arrange === 'stack' && vin.shape === 'rect' && Number(st.count) === vin.count && Number(V[st.gap] ?? V.stackGap) === vin.gap) {
        const panes = Array.isArray(st.panes) && st.panes.length ? st.panes : Array.from({ length: Number(st.count) }, () => ({ w: st.w, h: st.h }));
        const mine = Array.isArray(vin.paneSizes) && vin.paneSizes.length ? vin.paneSizes : panes.map(() => ({ w: vin.width, h: vin.height }));
        if (panes.length === mine.length && panes.every((q, k) => Number(q.w) === mine[k].w && Number(q.h) === mine[k].h)) return { id: Number(st.id), note: '' };
      }
    }
  }
  if (vin.shape === 'round') return { id: 0, note: 'a round panel: the old Master_Door macro has no round style (VP_STYLE 0); the new macro reads VP_SHAPE 2' };
  if (vin.shape === 'diamond') return { id: 0, note: 'this diamond is not the Master_Door 350 diamond (VP_STYLE 0); the new macro reads VP_SHAPE 3' };
  const placedAsMacro = centredTop && vin.arrange === 'stack';
  return { id: 14, note: placedAsMacro ? '' : 'the old Master_Door custom style places the panes centred, one above another, from D_TOP_RAIL: this position needs the new macro (VP_X / VP_Y / VP_ARR)' };
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
  // v1.2: the vision panel model (a stored vp block, else the legacy style read into it)
  let vpIn = fireDoorVpInput(V, spec.vp, vpStyle, vpCustom);
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
  // the door's warnings (never a failure): a typed opening overridden by a typed leaf on the same axis
  const warnings = [];
  const axisWarn = (what, ax, openingIn) => {
    const typed = Number(openingIn) || 0;
    if (ax.source === 'leaf' && typed > 0 && Math.abs(typed - ax.opening) > 0.05) {
      warnings.push(`${what}: the typed leaf ${ax.leaf} needs an opening ${ax.opening}; the typed opening ${typed} is ignored on this axis`);
    }
  };
  axisWarn('width', axW, spec.openingWidth);
  axisWarn('height', axH, spec.openingHeight);
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
  const step = (lastTop - topOffset) / (hCount - 1);   // the equal spacing (the old macro rule): the rule for count != 3, informational otherwise
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
    // the rule's numbers travel with the positions so a sheet can print the rule it was cut by (step = the old equal spacing, informational)
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
    plate: { length: Number(KP.length), width: Number(KP.width), millLength: keepMillLength, millWidth: keepMillWidth, depth: Number(KP.plateDepth), radius: R(keepMillWidth / 2) },
    pocket: { length: Number(KP.pocket.length), width: Number(KP.pocket.width), depth: Number(KP.pocket.depth) },
    centreFromFoot: keepCentreFromFoot, centreFromTop: R(jambLength - keepCentreFromFoot),
  };

  // ── the vision panel (v1.2: type, size, count, position; glass of three) ──
  const lockZone = {
    x0: Math.min(lock.forend.centreFromTop - millLength / 2, lock.case.topFromTop), x1: Math.max(lock.forend.centreFromTop + millLength / 2, lock.case.topFromTop + lock.case.pocketHeight),
    y0: W - Math.max(Number(lock.case.pocketDepth) || 0, backset), y1: W,
  };
  // a legacy stack that does not fit the leaf height turns its panes when the
  // turned stack fits (the v1 placement of the Master_Door styles, e.g. style 8
  // 5No 200 x 500 on a 2040 leaf lies 500 x 200)
  if (vpIn.source === 'legacy' && vpIn.shape === 'rect' && vpIn.count > 0) {
    const sizes = Array.isArray(vpIn.paneSizes) && vpIn.paneSizes.length ? vpIn.paneSizes : Array.from({ length: vpIn.count }, () => ({ w: vpIn.width, h: vpIn.height }));
    const stackH = (list) => list.reduce((a, q) => a + q.h, 0) + vpIn.gap * (list.length - 1);
    const turned = sizes.map((q) => ({ w: q.h, h: q.w }));
    const sideMargin = Number(V.sideMargin) || 0;
    if (vpIn.downOffset + stackH(sizes) > H && vpIn.downOffset + stackH(turned) <= H && Math.max(...turned.map((q) => q.w)) <= W - 2 * sideMargin) {
      vpIn = { ...vpIn, width: vpIn.height, height: vpIn.width, ...(vpIn.paneSizes ? { paneSizes: turned } : {}), turned: true };
    }
  }
  const vpPlaced = placeVisionPanelV12(V, vpIn, W, H, lockZone);
  const vpWords = fireDoorVpWords(V, vpIn);
  const vpMacro = masterDoorVpStyle(V, vpIn);
  // a round pane: the circle area and circumference; a diamond: its own square
  const paneArea = (p) => (p.shape === 'round' ? Math.PI * (p.w / 2) ** 2 : p.w * p.h) / 1e6;
  const panePerimM = (p) => (p.shape === 'round' ? Math.PI * p.w : 2 * (p.w + p.h)) / 1000;
  const glassSqm = vpPlaced.panes.reduce((a, p) => a + paneArea(p), 0);
  const beadM = vpPlaced.panes.reduce((a, p) => a + panePerimM(p), 0) * (Number(V.beadFaces) || 0);
  const glazingIntuM = fire ? vpPlaced.panes.reduce((a, p) => a + panePerimM(p), 0) : 0;
  const GL = V.glass || {};
  const glassTypes = Array.isArray(GL.types) && GL.types.length ? GL.types : [{ id: 'fd30', label: 'FD30 standard', thickness: V.glassThickness, slot: 'fd_glass_fire' }];
  const glassDefault = GL.defaultByRating?.[fire ? rating : 'none'];
  // no glass picked on the door: a v1 / v1.1 door saved with the glazing finish
  // Frosted (the generic finish chips of v1.1) reads as the Frosted glass
  const legacyFrosted = !spec.glass && windowSpec?.glazing?.finish === 'frosted' && glassTypes.some((t) => t.id === 'frosted');
  const glassPick = glassTypes.find((t) => t.id === spec.glass) || (legacyFrosted ? glassTypes.find((t) => t.id === 'frosted') : null) || glassTypes.find((t) => t.id === glassDefault) || glassTypes[0];
  const glassWarnings = [];
  if (spec.glass && !glassTypes.some((t) => t.id === spec.glass)) glassWarnings.push(`glass: '${spec.glass}' is not one of ${glassTypes.map((t) => t.label).join(' / ')}; ${glassPick.label} used`);
  if (fire && rating === 'FD60' && glassPick.id === 'fd30') glassWarnings.push(`glass: ${glassPick.label} on an FD60 door (the FD60 default is ${(glassTypes.find((t) => t.id === GL.defaultByRating?.FD60) || {}).label || 'FD insulated'})`);
  const glass = { type: glassPick.id, label: glassPick.label, thickness: Number(glassPick.thickness) || Number(V.glassThickness) || 6, slot: glassPick.slot || 'fd_glass_fire' };
  const glassThickness = glass.thickness;
  const vpWarnings = [...vpPlaced.warnings, ...(vpIn.legacyNote ? [`vision panel: ${vpIn.legacyNote}`] : []), ...(vpMacro.note && vpPlaced.panes.length ? [`vision panel: ${vpMacro.note}`] : []), ...(vpPlaced.panes.length ? glassWarnings : [])];
  const vp = {
    // style = the Master_Door VP_STYLE this panel goes out as (v1 field name kept)
    style: vpMacro.id, macroStyle: vpMacro.id, macroNote: vpPlaced.panes.length ? vpMacro.note : '',
    type: vpIn.type, shape: vpIn.shape, width: vpIn.width, height: vpIn.height, count: vpPlaced.panes.length ? vpIn.count : 0,
    arrange: vpIn.arrange, gap: vpIn.gap,
    position: { across: vpIn.across, acrossOffset: vpIn.acrossOffset, down: vpIn.down, downOffset: vpIn.downOffset },
    group: vpPlaced.group,
    label: vpWords.label, sizeLabel: vpWords.sizeLabel, positionLabel: vpWords.positionLabel,
    source: vpIn.source, legacyStyle: vpIn.legacyStyle,
    panes: vpPlaced.panes,
    glass,
    glassSqm: Math.round(glassSqm * 1000) / 1000, beadM: Math.round(beadM * 1000) / 1000, intuM: Math.round(glazingIntuM * 1000) / 1000,
    glassThickness, warnings: vpWarnings,
  };
  vpWarnings.forEach((w) => warnings.push(w));

  // ── the intumescent strips (v1.1: one size, 15 x 4 all around; FD30 one strip, FD60 two; none on a DR door) ──
  const intuStrips = fire ? Math.max(0, Math.round(Number(IN.stripsByRating?.[rating] ?? 1))) : 0;
  const intuStyle = intuStrips ? Number(IN.macroStyleByStrips?.[intuStrips] ?? IN.macroStyleByStrips?.[1] ?? 1) : 0;
  // v1.2: the strip colour (intumescent.colours; the door's pick, else defaults.intuColour, else the first)
  const intuColours = Array.isArray(IN.colours) && IN.colours.length ? IN.colours : [{ id: 'white', label: 'White', hex: '#f1f1ec' }];
  const intuColourPick = intuColours.find((c) => c.id === spec.intuColour) || intuColours.find((c) => c.id === D.intuColour) || intuColours[0];
  const intumescent = intuStrips ? {
    strips: intuStrips, width: Number(IN.width), thickness: Number(IN.thickness),
    groove: { width: Number(IN.grooveWidth), depth: Number(IN.grooveDepth) },
    label: `${intuStrips} x ${Number(IN.width)} x ${Number(IN.thickness)} all around`,
    macroStyle: intuStyle,
    metres: Math.round(intuStrips * (2 * H + W)) / 1000,
    colour: { id: intuColourPick.id, label: intuColourPick.label, hex: intuColourPick.hex || '#f1f1ec' },
    // the strip centres across the leaf thickness (z from the pull face), the 3D and the DXF draw them here
    centresZ: (intuStrips >= 2 ? [T / 2 - (Number(IN.twoStripOffset) || 0), T / 2 + (Number(IN.twoStripOffset) || 0)] : [T / 2]).map(R),
  } : null;

  // ── the closer (v1.1: a kind; the built in closer has no machining until the owner's component files arrive) ──
  // v1.2: the drawing symbol of the kind, in the leaf board system (x from the
  // leaf top, negative = above it on the frame head; y from the hinge edge)
  const CS = P.closer || {};
  const closerSymbol = (() => {
    if (closerKind === 'surface') {
      const c = CS.surface || {};
      const n = (k) => Number(c[k]) || 0;
      const spindle = { x: R(n('belowLeafTop') + n('bodyHeight') / 2), y: R(n('fromHingeEdge') + n('bodyHeight') / 2) };
      const shoeX = R(-(gapHead + faceOut / 2));
      const rise = spindle.x - shoeX;
      const run = n('armLength') > rise ? Math.sqrt(n('armLength') ** 2 - rise ** 2) : 0;
      return {
        kind: 'surface', face: c.face === 'push' ? 'push' : 'pull',
        body: { x: n('belowLeafTop'), y: n('fromHingeEdge'), length: n('bodyLength'), height: n('bodyHeight'), depth: n('bodyDepth') },
        arm: { from: spindle, to: { x: shoeX, y: R(spindle.y + run) }, length: n('armLength'), width: n('armWidth') },
        shoe: { x: shoeX, y: R(spindle.y + run), length: n('shoeLength'), height: n('shoeHeight') },
      };
    }
    if (closerKind === 'builtin') {
      const c = CS.builtin || {};
      const n = (k) => Number(c[k]) || 0;
      return {
        kind: 'builtin',
        body: { x: 0, y: n('fromHingeEdge'), length: n('bodyLength'), width: n('bodyWidth'), depth: n('bodyDepth'), z: R(T / 2 - n('bodyWidth') / 2) },
        track: { y: n('fromHingeEdge'), length: n('trackLength'), width: n('trackWidth'), depth: n('trackDepth') },
      };
    }
    return null;
  })();
  const closer = closerKind === 'none' ? null : { type: closerKind, label: CLOSER_LABELS[closerKind], machined: false, symbol: closerSymbol };
  const closerFlag = closerKind === 'builtin' ? 2 : closerKind === 'surface' ? 1 : 0;

  // ── the corner dowels (v1.1): perJoint dowels per mitred corner, square to the mitre face ──
  const DW = F.dowels || {};
  const dowelDia = Number(DW.dia) || 0, dowelLen = Number(DW.length) || 0, dowelPerJoint = dowelDia > 0 ? Math.max(0, Math.round(Number(DW.perJoint) || 0)) : 0;
  const dowelMargin = Number(DW.margin) || 0;
  // positions along the frame depth (z, from the outside face), equal spacing between the margins
  const dowelZ = dowelPerJoint ? Array.from({ length: dowelPerJoint }, (_, k) => R(dowelPerJoint === 1 ? depth / 2 : dowelMargin + k * ((depth - 2 * dowelMargin) / (dowelPerJoint - 1)))) : [];
  const dowelJoints = 2;   // head to hinge jamb, head to lock jamb
  // crowded dowels on a shallow frame: the bores need a wall between them
  const dowelPitch = dowelZ.length > 1 ? R(dowelZ[1] - dowelZ[0]) : null;
  if (dowelPitch !== null && dowelPitch < dowelDia + 4) warnings.push(`frame dowels: ${dowelPerJoint} bores of ${dowelDia} are only ${dowelPitch} apart on a ${depth} deep frame (margin ${dowelMargin}); fewer dowels or a smaller margin in Window Settings`);
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
  vp.panes.forEach((p) => leafOps.push(op('vpCutout', 'pull', p.x, p.y, 0, p.box.h, p.box.w, T, p.radius, {
    shape: p.shape, rotated: p.rotated, angle: p.angle, pane: p.i,
    note: p.shape === 'round' ? `vision panel ${p.i} round dia ${p.w}` : p.shape === 'diamond' ? `vision panel ${p.i} diamond ${p.w} x ${p.w} turned 45` : `vision panel ${p.i} ${p.w} x ${p.h}`,
  })));
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
    // the corner dowels: one bore per dowel on each mitred end, on face `mitre`;
    // x y z = the bore CENTRE: on the 45 mitre the centre of the thickness sits
    // yCentre along the member from the long point (x = 25 at the top / left end,
    // length - 25 at the head's right end), y = the thickness centre, z along the
    // depth; bored square to the mitre face (angle 45 to the member axis),
    // dowelLen / 2 deep so the dowel sits half in each piece
    if (dowels.count) {
      const ends = [];
      if (m.mitreTop) ends.push({ x: dowels.yCentre, label: m.role === 'head' ? 'left end' : 'top end' });
      if (m.mitreBottom) ends.push({ x: m.length - dowels.yCentre, label: 'right end' });
      ends.forEach((e) => dowelZ.forEach((z, k) => ops.push(op('dowelBore', 'mitre', e.x, dowels.yCentre, z, dowels.dia, dowels.dia, dowels.boreDepth, dowels.dia / 2, { angle: 45, dowel: k + 1, note: `dowel ${dowels.dia} x ${dowels.length}, ${e.label}, bore square to the mitre, x y z = centre (${dowels.yCentre} along the member from the long point)` }))));
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
    // C_VP_* (Master_Door custom style 14): a v1 / v1.1 record writes its stored custom block as
    // before; a v1.2 panel its pane size, count and gap (0 without a panel)
    ...(vpIn.source === 'legacy'
      ? { C_VP_L: Number(vpCustom.length) || 0, C_VP_W: Number(vpCustom.width) || 0, C_VP_NUM: Math.round(Number(vpCustom.count) || 0), C_VP_RAIL: Number(vpCustom.rail) || 0, C_VP_POS: Number(vpCustom.pos) === 90 ? 90 : 0 }
      : { C_VP_L: vp.count ? vp.height : 0, C_VP_W: vp.count ? vp.width : 0, C_VP_NUM: vp.count, C_VP_RAIL: vp.count > 1 ? vp.gap : 0, C_VP_POS: 0 }),
    D_TOP_RAIL: Number(V.topRail), D_MID_RAIL: Number(V.midRail), D_SIDE_MARGIN: Number(V.sideMargin),
    // v1.2, the new macro: any panel. VP_SHAPE 0 none / 1 rect / 2 round / 3 diamond; VP_W x VP_H one
    // pane (round: the diameter); VP_ARR 0 one above another / 1 side by side; VP_X the group top from
    // the leaf top, VP_Y its edge from the hinge edge (the leaf board's x and y); VP_R the corner radius
    VP_SHAPE: vp.count ? ({ rect: 1, round: 2, diamond: 3 }[vp.shape] || 0) : 0, VP_N: vp.count,
    VP_W: vp.count ? vp.width : 0, VP_H: vp.count ? vp.height : 0, VP_GAP: vp.count > 1 ? vp.gap : 0, VP_ARR: vp.arrange === 'side' ? 1 : 0,
    VP_X: vp.group ? vp.group.x : 0, VP_Y: vp.group ? vp.group.y : 0, VP_R: vp.panes.length ? vp.panes[0].radius : 0,
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
  // a round pane also carries the circle glass outline of the arched / circle
  // windows (kind 'circle', poly, outline), so the glass DXF and the glass
  // schedule PDF send the glazier a circle, not its bounding square
  const roundGlassShape = (d) => {
    const outline = buildCircleGlassOutline(circleArcs(d / 2));
    return { kind: 'circle', archShape: 'circle', outline, poly: glassOutlinePoly(outline), springing: R(outline.springing), apex: R(outline.apex), rise: R(outline.rise), radii: outline.radii.map(R), area: outline.area, perimeter: outline.perimeter, bars: [], pattern: 'none', barCounts: { h: 0, v: 0 } };
  };
  const customGlassUnits = vp.panes.map((p) => ({
    width: p.w, height: p.h, qty: 1, role: 'vp', location: `vision panel ${p.i}`, fire,
    shape: p.shape, glassType: glass.type, glassLabel: glass.label, slot: glass.slot,
    ...(p.shape === 'round' ? { glassShape: roundGlassShape(p.w) } : {}),
    note: `${glass.label} ${glassThickness} · ${p.shape === 'round' ? `round dia ${p.w}` : p.shape === 'diamond' ? `diamond ${p.w} x ${p.w}` : `${p.w} x ${p.h}`}`,
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
        vp: vpIn, glass: glass.type, intuColour: intumescent ? intumescent.colour.id : (spec.intuColour || D.intuColour || null),
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
      warnings,
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
      glass: { type: glass.type, label: glass.label, slot: glass.slot, thickness: glassThickness, sqm: Math.round(glassSqm * 100) / 100 },
      hinges: { count: hCount, product: hinges.product },
      lock: { type: lockType },
      keep: 1,
      closer: closer ? { type: closerKind, count: 1 } : null,
      dowels: dowels.count ? { count: dowels.count, dia: dowels.dia, length: dowels.length } : null,
      intumescent: intumescent ? { metres: intumescent.metres, width: intumescent.width, thickness: intumescent.thickness, strips: intumescent.strips, colour: intumescent.colour.label } : null,
      glazingBeads: { metres: vp.beadM },
      glazingIntumescent: { metres: vp.intuM },
    },
    frame: { width: overallW, height: overallH },
    config: { key: 'firedoor', rows: 1, cols: 1 },
    barPositions: { vertical: [], horizontal: [] },
  };
}
