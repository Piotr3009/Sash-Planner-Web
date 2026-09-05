/**
 * arch.js — arched casement head: geometry, glazing bars + segment planner
 * (arched-casement-v1 geometry core, v2 shape model).
 *
 * One arched member (frame head, leaf top rail) is a RING between two
 * concentric contours, clipped at the ARCH-START line — the horizontal line
 * where the straight jambs / stiles begin. Every contour shares the arch's
 * centres; an offset only shrinks the radii (concentric rule), so the frame
 * head, the leaf top rail and the glass line always nest.
 *
 * Coordinates: mm, y up, x = 0 on the window axis, y = 0 on the arch-start
 * line. Outer arcs run COUNTER-CLOCKWISE from the right arch-start point over
 * the apex to the left arch-start point (angles increase along the contour).
 *
 * RULE C (v2 P1): every arch starts VERTICAL at the jambs, so a horizontal cut
 * on the arch-start line is exactly the member face wide. Shapes:
 *   semi-circle         1 centre on the line, R = W/2 — rise = W/2 exactly
 *   three-centre        2 haunch centres on the line + 1 crown centre below it;
 *                       haunch r = max(rise²/halfW, profile arch.minHaunchRadius),
 *                       crown radius from tangency — rise below W/2
 *   gothic-equilateral  2 centres at the opposite arch-start points, R = W
 *   gothic-drop         2 centres inside the span, rise ≥ W/2 (free)
 * A "Round" arch (the configurator's word) resolves to semi-circle or
 * three-centre from its rise (resolveRoundShape); above half the width only
 * a gothic exists. The v1 'segmental' (single centre below the line — it did
 * not start vertical) is gone; PSW 'segmental-arch' and v1-era saved windows
 * migrate to a three-centre with rise 0.20 × W (P10).
 *
 * Workshop numbers (member faces, leaf inset, glass inset, haunch minimum,
 * finger joint, board stock, bar pattern ratios) come from the casement
 * profile — none are hard-coded here. Shape defaults quoted from PSW:
 * js/price-calculator.js (window.ArchedSash, RISE_RATIO / GOTHIC_PROFILE_RATIO /
 * MIN_WIDTH / MAX_WIDTH / PATTERNS_FOR_SHAPE).
 */

const TAU = Math.PI * 2;

export class ArchError extends Error {
  constructor(message) { super(message); this.name = 'ArchError'; }
}

export const ARCH_SHAPES = Object.freeze([
  'semi-circle', 'three-centre', 'gothic-equilateral', 'gothic-drop',
]);

export const ARCH_SHAPE_LABELS = Object.freeze({
  'semi-circle': 'Semi-circle',
  'three-centre': 'Three-centre',
  'gothic-equilateral': 'Gothic equilateral',
  'gothic-drop': 'Gothic drop',
});

// The configurator offers two families: Round (semi-circle | three-centre,
// resolved from the rise) and Gothic (equilateral | drop | shallow profile).
export const ROUND_SHAPES = Object.freeze(['semi-circle', 'three-centre']);
export const GOTHIC_SHAPES = Object.freeze(['gothic-equilateral', 'gothic-drop']);
export const isRoundShape = (shape) => ROUND_SHAPES.includes(shape);
export const isGothicShape = (shape) => GOTHIC_SHAPES.includes(shape);

// v1-era PC shapes that no longer exist → their v2 replacement (P10). A saved
// window carrying one of these migrates on load with `riseSource: 'ratio'`.
export const LEGACY_ARCH_SHAPES = Object.freeze({
  'segmental': { shape: 'three-centre', riseRatio: 0.20 },
});

// PSW casArchShape → PC shape (P10). PSW "elliptical" is drawn as an ellipse
// in the 3D preview; a workshop cannot rout an ellipse from concentric arcs,
// so it is built as the classic three-centre approximation. PSW "segmental"
// is a single-centre arc that does not start vertical (rule C) — it becomes
// a three-centre with the PSW segmental rise.
export const PSW_ARCH_SHAPE = Object.freeze({
  'gothic-arch': 'gothic-equilateral',
  'semi-circle': 'semi-circle',
  'segmental-arch': 'three-centre',
  'elliptical-arch': 'three-centre',
});

// PSW js/price-calculator.js RISE_RATIO — rise as a fraction of the external
// frame width, keyed by the PSW shape (the source the ratio belongs to).
export const PSW_ARCH_RISE_RATIO = Object.freeze({
  'segmental-arch': 0.20,
  'elliptical-arch': 0.325,
  'semi-circle': 0.5,
  'gothic-arch': Math.sqrt(3) / 2,
});

// Configurator "Auto" for a Round arch: the PSW elliptical default (P4).
export const ROUND_AUTO_RATIO = 0.325;

// Default rise per PC shape (fraction of the external width): PSW RISE_RATIO
// (elliptical 0.325, semi-circle 0.50, gothic √3/2) and GOTHIC_PROFILE_RATIO.drop.
export const ARCH_RISE_RATIO = Object.freeze({
  'semi-circle': 0.5,
  'three-centre': ROUND_AUTO_RATIO,
  'gothic-equilateral': Math.sqrt(3) / 2,
  'gothic-drop': 0.70,
});

// Gothic profile presets (PSW GOTHIC_PROFILE_RATIO, spec §3.2 / §5): rise as a
// fraction of the external width. 'equilateral' is its own PC shape (fixed
// rise); 'drop' and 'shallow' are the free-rise 'gothic-drop' shape with a
// different default rise.
export const GOTHIC_PROFILE_RATIO = Object.freeze({
  equilateral: Math.sqrt(3) / 2,
  drop: 0.70,
  shallow: 0.60,
});
export const GOTHIC_PROFILES = Object.freeze(['equilateral', 'drop', 'shallow']);

// Shapes whose rise is fixed by the geometry (no free rise).
export const ARCH_FIXED_RISE = Object.freeze(['semi-circle', 'gothic-equilateral']);

export function isArchShape(shape) { return ARCH_SHAPES.includes(shape); }

// ── Glazing bar patterns in the arch (P5) — vocabulary and availability per
// shape, one copy in PC (PSW keeps two: price-calculator.js PATTERNS_FOR_SHAPE
// lines 990–995 and the 3D). Geometry: buildArchBars below.
export const ARCH_BAR_PATTERNS = Object.freeze([
  'none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'intersecting',
]);
export const ARCH_BAR_PATTERN_LABELS = Object.freeze({
  'none': 'None',
  'half-hub': 'Half hub',
  'hub-spoke': 'Hub & spoke',
  'double-hub-spoke': 'Double hub & spoke',
  'triple-hub-spoke': 'Triple hub & spoke',
  'intersecting': 'Intersecting',
});
export const HUB_PATTERNS = Object.freeze(['half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke']);
export const isHubPattern = (pattern) => HUB_PATTERNS.includes(pattern);
export const PATTERNS_FOR_SHAPE = Object.freeze({
  'semi-circle': ['none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'intersecting'],
  'gothic-equilateral': ['none', 'intersecting'],
  'gothic-drop': ['none', 'intersecting'],
  'three-centre': ['none'],
});
export function patternsForShape(shape) { return PATTERNS_FOR_SHAPE[shape] || ['none']; }

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Limits live in the casement profile (profile.arch.limits, spec §5): width
 * 400–1500 (PSW MIN_WIDTH / MAX_WIDTH), straight part below the arch ≥ 900,
 * straight stile of the arched leaf ≥ 100 (PSW sash rules adopted for the
 * casement, spec §3.3). Nothing is defaulted here.
 */
export function readArchLimits(limits) {
  const L = {
    minWidth: Number(limits?.minWidth),
    maxWidth: Number(limits?.maxWidth),
    minStraightBelowRise: Number(limits?.minStraightBelowRise),
    minLeafStraightStile: Number(limits?.minLeafStraightStile),
  };
  if (!(L.minWidth > 0 && L.maxWidth >= L.minWidth && L.minStraightBelowRise >= 0 && L.minLeafStraightStile >= 0)) {
    throw new ArchError('Casement profile arch.limits is missing (minWidth / maxWidth / minStraightBelowRise / minLeafStraightStile)');
  }
  return L;
}

/** profile.arch.minHaunchRadius (P3) — the smallest haunch radius of a three-centre arch. */
export function readMinHaunchRadius(archProfile) {
  const v = Number(archProfile?.minHaunchRadius);
  if (!(v > 0)) throw new ArchError('Casement profile arch.minHaunchRadius is missing (mm, > 0)');
  return v;
}

/**
 * Round arch → PC shape from the rise (v2 §2.2). Exactly half the width
 * (±tol) is a semi-circle; below it a three-centre; above it only a gothic
 * can rise that far.
 */
export function resolveRoundShape(width, rise, tol = 0.5) {
  const W = Number(width), h = Number(rise), hw = W / 2;
  if (!(W > 0)) throw new ArchError(`Round arch width must be a positive number of mm, got "${width}"`);
  if (!(h > 0)) throw new ArchError(`Round arch rise must be a positive number of mm, got "${rise}"`);
  if (Math.abs(h - hw) <= tol) return 'semi-circle';
  if (h > hw) throw new ArchError(`Round arch rise ${r1(h)}mm is above half the width (${r1(hw)}mm): use Gothic`);
  return 'three-centre';
}

/**
 * Physical validity of a rise for a shape — these are geometry, not workshop
 * choices, so they are not profile settings:
 *   gothic-drop   rise ≥ W/2  (below that the two arcs cannot meet in a point)
 *   three-centre  rise < W/2  (at W/2 the haunch radius reaches the rise and
 *                 there is no crown circle — the shape is a semi-circle)
 */
export function assertRisePhysics(shape, width, rise) {
  const W = Number(width), h = Number(rise), hw = W / 2;
  const label = ARCH_SHAPE_LABELS[shape];
  if (!(h > 0)) throw new ArchError(`${label} rise must be a positive number of mm, got "${rise}"`);
  if (shape === 'gothic-drop' && !(h >= hw)) throw new ArchError(`${label} rise ${r1(h)}mm must be at least half the width (${r1(hw)}mm) — below that the two arcs cannot meet in a point`);
  if (shape === 'three-centre' && !(h < hw)) throw new ArchError(`${label} rise ${r1(h)}mm must be below half the width (${r1(hw)}mm) — at W/2 the shape is a semi-circle`);
}

/**
 * Resolve the arch rise (mm). Explicit rise wins where the shape allows it;
 * shapes with a fixed rise (semi-circle, gothic equilateral) reject any other
 * value instead of silently overriding it. `limits` = profile.arch.limits.
 */
export function resolveArchRise(shape, width, rise, limits) {
  if (!isArchShape(shape)) throw new ArchError(`Unknown arch shape "${shape}"`);
  const L = readArchLimits(limits);
  const W = Number(width);
  if (!(W >= L.minWidth)) throw new ArchError(`Arch width ${W}mm is below the minimum ${L.minWidth}mm`);
  if (!(W <= L.maxWidth)) throw new ArchError(`Arch width ${W}mm is above the maximum ${L.maxWidth}mm`);
  const label = ARCH_SHAPE_LABELS[shape];
  const def = ARCH_RISE_RATIO[shape] * W;
  if (rise == null || rise === '') return def;
  const h = Number(rise);
  if (!(h > 0)) throw new ArchError(`Arch rise must be a positive number of mm, got "${rise}"`);
  if (ARCH_FIXED_RISE.includes(shape)) {
    if (Math.abs(h - def) > 0.5) throw new ArchError(`${label} rise is fixed by the shape at ${r1(def)}mm (got ${h}mm)`);
    return def;
  }
  assertRisePhysics(shape, W, h);
  return h;
}

/**
 * Outer contour arcs for a shape. Each arc: { cx, cy, r, a0, a1, clip0, clip1 }
 * with a0 < a1 (counter-clockwise). clip0/clip1 say how that end of the arc is
 * bounded, which is what an offset has to recompute:
 *   'archStart' — the arc ends on the arch-start line (y = 0)
 *   'axis'      — the arc ends on the window axis (x = 0): pointed apex
 *   null        — tangent joint with the neighbouring arc (stays radial)
 * opts.minHaunchRadius (three-centre, P3): haunch r = max(rise²/halfW, this);
 * pure-geometry callers may omit it (0 = the v1 ellipse-curvature rule alone).
 */
export function archArcs(shape, width, rise, opts = {}) {
  const W = Number(width), h = Number(rise), hw = W / 2;
  if (!isArchShape(shape)) throw new ArchError(`Unknown arch shape "${shape}"`);
  assertRisePhysics(shape, W, h);
  switch (shape) {
    case 'semi-circle':
      return [{ cx: 0, cy: 0, r: hw, a0: 0, a1: Math.PI, clip0: 'archStart', clip1: 'archStart' }];
    case 'gothic-equilateral':
    case 'gothic-drop': {
      // Centres at (∓c, 0): c = 0 is a semi-circle, c = W/2 the equilateral arch.
      const c = (h * h - hw * hw) / W;
      const R = hw + c;
      const t = Math.atan2(h, c);              // apex seen from the right arc's centre (−c, 0)
      return [
        { cx: -c, cy: 0, r: R, a0: 0, a1: t, clip0: 'archStart', clip1: 'axis' },
        { cx: c, cy: 0, r: R, a0: Math.PI - t, a1: Math.PI, clip0: 'axis', clip1: 'archStart' },
      ];
    }
    case 'three-centre': {
      // Basket-handle approximation of the half-ellipse (a = W/2, b = rise):
      // haunch radius = the ellipse's radius of curvature at the springing,
      // r = b²/a (spec §6.1), never below the profile minimum (v2 P3 — the
      // leaf-top inner ring must keep a positive radius); the crown radius
      // follows from tangency. The haunch arcs start vertical at the jambs
      // (centres ON the arch-start line) — rule C.
      const rMin = Number(opts?.minHaunchRadius) || 0;
      const r = Math.max((h * h) / hw, rMin);
      if (!(h > r)) throw new ArchError(`Round arch rise ${r1(h)}mm must exceed the haunch radius ${r1(r)}mm (profile arch.minHaunchRadius ${r1(rMin)}) — below that there is no crown arc`);
      if (!(r <= hw)) throw new ArchError(`Haunch radius ${r1(r)}mm exceeds half the width (${r1(hw)}mm)`);
      const e = hw - r;                        // haunch centre x
      const R = (e * e + h * h - r * r) / (2 * (h - r));   // crown radius from tangency
      const t = Math.atan2(R - h, e);          // tangent point seen from the crown centre
      return [
        { cx: e, cy: 0, r, a0: 0, a1: t, clip0: 'archStart', clip1: null },
        { cx: 0, cy: h - R, r: R, a0: t, a1: Math.PI - t, clip0: null, clip1: null },
        { cx: -e, cy: 0, r, a0: Math.PI - t, a1: Math.PI, clip0: null, clip1: 'archStart' },
      ];
    }
    default:
      throw new ArchError(`Unknown arch shape "${shape}"`);
  }
}

function clipAngle(arc, clip, end) {
  const { cx, cy, r } = arc;
  if (clip === 'archStart') {
    const dx2 = r * r - cy * cy;               // circle ∩ { y = 0 }
    if (!(dx2 > 0)) throw new ArchError(`Contour of radius ${r1(r)}mm does not reach the arch-start line — rise too small for the member face`);
    const dx = Math.sqrt(dx2);
    const up = -cy || 0;                       // −0 would make atan2 return −π on the left end
    return end === 'start' ? Math.atan2(up, dx) : Math.atan2(up, -dx);
  }
  const dy2 = r * r - cx * cx;                 // 'axis': circle ∩ { x = 0 }, upper crossing
  if (!(dy2 > 0)) throw new ArchError(`Contour of radius ${r1(r)}mm does not reach the window axis`);
  return Math.atan2(Math.sqrt(dy2), -cx);
}

/** Concentric offset (inward by delta mm): same centres, smaller radii, clipped ends recomputed. */
export function offsetArcs(arcs, delta) {
  return arcs.map((a) => {
    const r = a.r - delta;
    if (!(r > 0)) throw new ArchError(`Offset ${delta}mm exceeds the arc radius ${r1(a.r)}mm`);
    const o = { ...a, r };
    if (a.clip0) o.a0 = clipAngle(o, a.clip0, 'start');
    if (a.clip1) o.a1 = clipAngle(o, a.clip1, 'end');
    if (!(o.a1 > o.a0)) throw new ArchError(`Offset ${delta}mm collapses an arc of radius ${r1(a.r)}mm`);
    return o;
  });
}

export const arcSpan = (a) => a.a1 - a.a0;
export const arcLen = (a) => a.r * arcSpan(a);
export const arcsLength = (arcs) => arcs.reduce((s, a) => s + arcLen(a), 0);
export const arcPoint = (a, ang) => [a.cx + a.r * Math.cos(ang), a.cy + a.r * Math.sin(ang)];
/** DXF bulge for the whole arc traversed counter-clockwise (tan of a quarter of the span). */
export const arcBulge = (a) => Math.tan(arcSpan(a) / 4);

/** Exact { min, max } of (point · dir) over an arc — endpoints plus interior extrema. */
export function arcExtent(a, dir) {
  const psi = Math.atan2(dir[1], dir[0]);
  const c0 = a.cx * dir[0] + a.cy * dir[1];
  const vals = [c0 + a.r * Math.cos(a.a0 - psi), c0 + a.r * Math.cos(a.a1 - psi)];
  for (let k = -2; k <= 2; k++) {
    const amax = psi + k * TAU;
    if (amax > a.a0 && amax < a.a1) vals.push(c0 + a.r);
    const amin = psi + Math.PI + k * TAU;
    if (amin > a.a0 && amin < a.a1) vals.push(c0 - a.r);
  }
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

export function arcsExtent(arcs, dir) {
  let min = Infinity, max = -Infinity;
  for (const a of arcs) {
    const e = arcExtent(a, dir);
    if (e.min < min) min = e.min;
    if (e.max > max) max = e.max;
  }
  return { min, max };
}

/**
 * A ring = member cross-section in the elevation plane, between two offsets
 * of the base (outer window) contour, clipped at the arch-start line.
 */
export function buildRing(baseArcs, outerOffset, innerOffset, label = '') {
  const outer = offsetArcs(baseArcs, outerOffset);
  const inner = offsetArcs(baseArcs, innerOffset);
  const centre = offsetArcs(baseArcs, (outerOffset + innerOffset) / 2);
  const last = outer.length - 1;
  return {
    label,
    outer,
    inner,
    centre,
    thickness: innerOffset - outerOffset,
    offsets: { outer: outerOffset, inner: innerOffset },
    lengths: {
      outer: arcsLength(outer),
      inner: arcsLength(inner),
      centre: arcsLength(centre),
    },
    apex: { outer: arcsExtent(outer, [0, 1]).max, inner: arcsExtent(inner, [0, 1]).max },
    ends: {
      outerRight: arcPoint(outer[0], outer[0].a0),
      innerRight: arcPoint(inner[0], inner[0].a0),
      outerLeft: arcPoint(outer[last], outer[last].a1),
      innerLeft: arcPoint(inner[last], inner[last].a1),
    },
  };
}

/**
 * Closed contour of a ring as a bulge polyline [[x, y, bulge], ...]:
 * outer arcs counter-clockwise (right → apex → left), straight cut along the
 * arch-start line, inner arcs clockwise back, straight cut to the start.
 */
export function ringPoly(ring) {
  const pts = [];
  for (const a of ring.outer) pts.push([...arcPoint(a, a.a0), arcBulge(a)]);
  const lo = ring.outer[ring.outer.length - 1];
  pts.push([...arcPoint(lo, lo.a1), 0]);
  for (let i = ring.inner.length - 1; i >= 0; i--) {
    const a = ring.inner[i];
    pts.push([...arcPoint(a, a.a1), -arcBulge(a)]);
  }
  const fi = ring.inner[0];
  pts.push([...arcPoint(fi, fi.a0), 0]);
  return pts;
}

/** Axis-aligned bounding box of a ring (outer contour + arch-start line). */
export function ringBBox(ring) {
  const x = arcsExtent(ring.outer, [1, 0]);
  const y = arcsExtent(ring.outer, [0, 1]);
  return { minX: x.min, maxX: x.max, minY: Math.min(0, y.min), maxY: y.max };
}

/**
 * Full arch geometry for one window: outer arcs, frame-head ring, leaf-top
 * ring and glass line — every offset read from the casement profile.
 *   frame head : outer 0            → inner frameHead.face
 *   leaf top   : outer leafAtJamb   → inner leafAtJamb + leafTop.face
 *   glass line : leafAtJamb + leafTop.face − glassInset
 * Three-centre haunch minimum: profile.arch.minHaunchRadius (P3).
 */
export function buildArchGeometry({ shape, width, height, rise }, profile) {
  if (!profile?.elements?.frameHead || !profile?.elements?.leafTop || !profile?.deductions || !profile?.geometry) {
    throw new ArchError('Casement profile is missing the frameHead / leafTop / deductions / geometry sections');
  }
  const L = readArchLimits(profile.arch?.limits);
  const minHaunchRadius = readMinHaunchRadius(profile.arch);
  const W = Number(width);
  const h = resolveArchRise(shape, W, rise, L);
  let straightHeight = null, leafStraightStile = null;
  if (height != null && height !== '') {
    const H = Number(height);
    straightHeight = H - h;
    if (!(straightHeight >= L.minStraightBelowRise)) {
      throw new ArchError(`Arch rise ${r1(h)}mm in a ${r1(H)}mm high window leaves ${r1(straightHeight)}mm straight below the arch — minimum ${L.minStraightBelowRise}mm (height >= rise + ${L.minStraightBelowRise})`);
    }
    // straight stile of the arched leaf = straight part minus the cill-side
    // leaf deduction (leafFullHeight − leafAtJamb: gap + cill land)
    const cillSide = Number(profile.deductions.leafFullHeight) - Number(profile.deductions.leafAtJamb);
    if (!Number.isFinite(cillSide)) throw new ArchError('Casement profile deductions.leafFullHeight / leafAtJamb are missing');
    leafStraightStile = straightHeight - cillSide;
    if (!(leafStraightStile >= L.minLeafStraightStile)) {
      throw new ArchError(`Straight stile of the arched leaf is ${r1(leafStraightStile)}mm — minimum ${L.minLeafStraightStile}mm`);
    }
  }
  const base = archArcs(shape, W, h, { minHaunchRadius });
  const tFrame = Number(profile.elements.frameHead.face);
  const leafInset = Number(profile.deductions.leafAtJamb);
  const tLeaf = Number(profile.elements.leafTop.face);
  const glassInset = Number(profile.geometry.glassInset);
  const frameHead = buildRing(base, 0, tFrame, 'FRAME HEAD');
  const leafTop = buildRing(base, leafInset, leafInset + tLeaf, 'LEAF TOP');
  const glassOffset = leafInset + tLeaf - glassInset;
  const glassArcs = offsetArcs(base, glassOffset);
  // Rebate wall (v3 0.1 FIT view): the frame land ends here; the leaf outer
  // contour sits `geometry.gap` inside it and laps the frame timber by
  // frameHead.face − leafAtJamb (57 − 40 = 17 on the default profile).
  const land = Number(profile.geometry.land);
  const gap = Number(profile.geometry.gap);
  if (!(land > 0 && gap >= 0)) throw new ArchError('Casement profile geometry.land / geometry.gap are missing');
  const rebateWall = offsetArcs(base, land);
  return {
    shape,
    label: ARCH_SHAPE_LABELS[shape],
    width: W,
    rise: h,
    start: straightHeight,                      // arch-start line from the cill (= straight height)
    straightHeight,
    leafStraightStile,
    limits: L,
    minHaunchRadius,
    radii: base.map((a) => a.r),                // outer radius per arc (1 / 2 / 3 values)
    arcs: base,
    offsets: { frameInner: tFrame, leafOuter: leafInset, leafInner: leafInset + tLeaf, glass: glassOffset, land },
    frameHead,
    leafTop,
    rebateWall,                                 // arcs at R − land (the leaf outer sits gap mm inside it)
    fit: { gap, lap: tFrame - leafInset, land },
    glass: { arcs: glassArcs, length: arcsLength(glassArcs), apex: arcsExtent(glassArcs, [0, 1]).max, halfWidth: W / 2 - glassOffset },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEGMENT PLANNER — a curved member is glued up from N straight boards
// (finger-jointed on radial faces) and the ring contour is routed afterwards.
//
// Spec §7 (ARCHED-CASEMENT-v1.md):
//  1. every arc of the ring is planned on its own — a joint is mandatory at
//     every tangent point / apex;
//  2. N_min = max(2, ceil(θ / maxSegmentAngle)) per arc (grain run-out); a
//     single-centre arc shorter than maxSegmentAngle may be ONE board when a
//     stock board fits it;
//  3. candidates N = N_min … N_min + 3, equal angles φ = θ / N on the outer
//     contour; piece axis = tangent at the mid-angle, normal = radial there;
//  4. the ALLOWANCE BAND — outer contour + contourAllowance, inner contour −
//     contourAllowance — bounded by the radial joint planes, and by the
//     arch-start line / apex axis for the end pieces (that is the haunch);
//  5. the band is projected onto the piece axes exactly (arc end points +
//     interior extrema): W_req = extent on the normal, L = extent on the axis.
//     For a middle piece this equals the closed form
//     W_req = (Ro + a) − (Ri − a)·cos(φ/2),  L = 2·(Ro + a)·sin(φ/2);
//  6. stock = narrowest stock width ≥ W_req, none → that N is infeasible;
//  7. D13 — which feasible N is the DEFAULT is a profile switch (`pieceRule`,
//     BLOCKERS: Piotr has not decided):
//       'narrowest' (spec default) — narrowest stock with N ≤ N_min + 2,
//                                    tie → fewer pieces;
//       'fewest'                  — fewest pieces that fit a stock board.
//     The plan the OTHER rule would pick is returned as `alternative` and
//     printed on the sheet as ALT.
//
// Every number (allowance, max angle, stock list, selection rule) comes from
// profile.arch — nothing is defaulted here.
// ═══════════════════════════════════════════════════════════════════════════

const pieceEndType = (clip) => (clip === 'archStart' ? 'archStart' : clip === 'axis' ? 'axis' : 'tangent');

/**
 * Allowance band of a ring (spec §7.4): outer contour grown by `a`, inner
 * contour shrunk by `a`, clipped ends recomputed on the band radii.
 */
export function allowanceBand(ring, a) {
  const d = Number(a);
  if (!(d >= 0)) throw new ArchError(`Contour allowance must be a number of mm >= 0, got "${a}"`);
  return { outer: offsetArcs(ring.outer, -d), inner: offsetArcs(ring.inner, d) };
}

/**
 * Split arc i of a ring into n equal (by outer angle) pieces.
 * `band` (allowanceBand of the same ring) drives the board projection; the
 * finished piece arcs (outer / inner) are kept for the drawing.
 */
export function partitionArc(ring, arcIndex, n, band = null) {
  const outer = ring.outer[arcIndex];
  const inner = ring.inner[arcIndex];
  const bO = band ? band.outer[arcIndex] : outer;
  const bI = band ? band.inner[arcIndex] : inner;
  const phi = arcSpan(outer) / n;
  const pieces = [];
  for (let k = 0; k < n; k++) {
    const first = k === 0, last = k === n - 1;
    const ao0 = outer.a0 + k * phi;
    const ao1 = last ? outer.a1 : outer.a0 + (k + 1) * phi;
    const oArc = { ...outer, a0: ao0, a1: ao1 };
    const iArc = { ...inner, a0: first ? inner.a0 : ao0, a1: last ? inner.a1 : ao1 };
    // allowance band of this piece: joint planes are radial (same angles);
    // the arch-start / apex ends use the band's own clipped angles
    const bandOuter = { ...bO, a0: first ? bO.a0 : ao0, a1: last ? bO.a1 : ao1 };
    const bandInner = { ...bI, a0: first ? bI.a0 : ao0, a1: last ? bI.a1 : ao1 };
    // Board axes: bisector b (width direction, pointing to the apex side) and
    // the chord direction u (length direction, counter-clockwise tangent).
    const m = (ao0 + ao1) / 2;
    const b = [Math.cos(m), Math.sin(m)];
    const u = [-Math.sin(m), Math.cos(m)];
    const sO = arcExtent(bandOuter, u), sI = arcExtent(bandInner, u);
    const wO = arcExtent(bandOuter, b), wI = arcExtent(bandInner, b);
    const sMin = Math.min(sO.min, sI.min), sMax = Math.max(sO.max, sI.max);
    const wMin = Math.min(wO.min, wI.min), wMax = Math.max(wO.max, wI.max);
    // acute angle between the piece axis and the horizontal (the arch-start
    // line) — the end cut the CNC needs for an arch-start end
    const axisAngle = Math.abs(Math.atan2(u[1], u[0]));
    const axisAngleDeg = (axisAngle > Math.PI / 2 ? Math.PI - axisAngle : axisAngle) * 180 / Math.PI;
    const endStart = first ? pieceEndType(outer.clip0) : 'radial';
    const endEnd = last ? pieceEndType(outer.clip1) : 'radial';
    // band inner chord = L_in (spec: 2·(Ri − a)·sin(φ/2) for a middle piece)
    const pi0 = arcPoint(bandInner, bandInner.a0), pi1 = arcPoint(bandInner, bandInner.a1);
    const Lin = Math.hypot(pi1[0] - pi0[0], pi1[1] - pi0[1]);
    const endCuts = [endCut(endStart, phi, axisAngleDeg), endCut(endEnd, phi, axisAngleDeg)];
    const jointedEnds = endCuts.filter((c) => c.jointed).length;
    pieces.push({
      arc: arcIndex,
      k,
      n,
      phi,
      phiDeg: phi * 180 / Math.PI,
      axisAngleDeg,
      outer: oArc,
      inner: iArc,
      band: { outer: bandOuter, inner: bandInner },
      endStart,
      endEnd,
      endCuts,                       // [start end, end end] — see endCut()
      jointedEnds,                   // 0, 1 or 2 finger-jointed ends (arch-start cuts are not joints)
      axes: { bisector: m, b, u },
      extents: { s: [sMin, sMax], w: [wMin, wMax] },
      wReq: wMax - wMin,
      projectedWidth: wMax - wMin,   // alias kept for the drawing (= W_req, band included)
      L: sMax - sMin,
      chordLength: sMax - sMin,      // alias kept for the drawing (= L_out of the band)
      Lin,
    });
  }
  return pieces;
}

/**
 * End cut of a piece (spec §7.8). `angleDeg` follows the spec's convention per
 * kind, `fromSquareDeg` is always the mitre from a square cut:
 *   joint  (radial / tangent plane) — φ/2 from square (= angleDeg)
 *   spring (arch-start line)        — angleDeg = piece axis to the horizontal,
 *                                     from square = 90° − that
 *   apex   (gothic axis, vertical)  — angleDeg = piece axis to the vertical,
 *                                     from square = axis to the horizontal
 */
export function endCut(endType, phi, axisAngleDeg) {
  if (endType === 'archStart') return { kind: 'spring', jointed: false, angleDeg: axisAngleDeg, fromSquareDeg: 90 - axisAngleDeg };
  if (endType === 'axis') return { kind: 'apex', jointed: true, angleDeg: 90 - axisAngleDeg, fromSquareDeg: axisAngleDeg };
  const half = phi / 2 * 180 / Math.PI;
  return { kind: 'joint', jointed: true, angleDeg: half, fromSquareDeg: half };
}

/** Closed bulge polyline of one piece: outer arc CCW, radial/clipped end, inner arc CW, other end. */
export function piecePoly(piece) {
  const { outer, inner } = piece;
  return [
    [...arcPoint(outer, outer.a0), arcBulge(outer)],
    [...arcPoint(outer, outer.a1), 0],
    [...arcPoint(inner, inner.a1), -arcBulge(inner)],
    [...arcPoint(inner, inner.a0), 0],
  ];
}

/** Same polygon for the piece's allowance band (what the stock board must contain). */
export function pieceBandPoly(piece) {
  const { outer, inner } = piece.band;
  return [
    [...arcPoint(outer, outer.a0), arcBulge(outer)],
    [...arcPoint(outer, outer.a1), 0],
    [...arcPoint(inner, inner.a1), -arcBulge(inner)],
    [...arcPoint(inner, inner.a0), 0],
  ];
}

/** Joint faces of a piece (inner → outer point) — every end except the arch-start cut. */
export function pieceJoints(piece) {
  const { outer, inner } = piece;
  const out = [];
  if (piece.endStart !== 'archStart') out.push([arcPoint(inner, inner.a0), arcPoint(outer, outer.a0)]);
  if (piece.endEnd !== 'archStart') out.push([arcPoint(inner, inner.a1), arcPoint(outer, outer.a1)]);
  return out;
}

function stockFor(boardWidth, stockWidths) {
  const sorted = [...stockWidths].map(Number).filter((w) => w > 0).sort((a, b) => a - b);
  for (const w of sorted) if (w + 1e-9 >= boardWidth) return w;
  return null;
}

export const PIECE_RULES = Object.freeze(['narrowest', 'fewest']);

function readPlannerSettings(opts) {
  const stockWidths = Array.isArray(opts?.stockWidths) ? opts.stockWidths.map(Number).filter((w) => w > 0) : [];
  const allowance = Number(opts?.contourAllowance);
  if (!(allowance >= 0)) throw new ArchError('Casement profile arch.contourAllowance is missing (mm per side)');
  const maxDeg = Number(opts?.maxSegmentAngleDeg);
  if (!(maxDeg > 0 && maxDeg <= 180)) throw new ArchError('Casement profile arch.maxSegmentAngleDeg is missing (degrees, 0 < angle <= 180)');
  const pieceRule = opts?.pieceRule;
  if (!PIECE_RULES.includes(pieceRule)) throw new ArchError(`Casement profile arch.pieceRule must be one of ${PIECE_RULES.join(' | ')}, got "${pieceRule}"`);
  const fingerLength = Number(opts?.finger?.length);
  if (!(fingerLength >= 0)) throw new ArchError('Casement profile arch.finger.length is missing (mm per jointed end)');
  return { stockWidths, allowance, maxDeg, maxAngle: maxDeg * Math.PI / 180, pieceRule, fingerLength };
}

/** D13 selection among the feasible options of one arc (see banner, rule 7). */
export function pickOption(options, nMin, rule) {
  const feasible = options.filter((o) => o.stock != null);
  if (!feasible.length) return null;
  if (rule === 'fewest') return feasible[0];
  const window = feasible.filter((o) => o.n <= nMin + 2);
  const pool = window.length ? window : feasible;
  let best = null;
  for (const o of pool) if (!best || o.stock < best.stock) best = o;   // options are in ascending N → tie keeps fewer
  return best;
}

/**
 * Plan every arc of a ring.
 * opts = profile.arch: { stockWidths, contourAllowance, maxSegmentAngleDeg }
 * Returns { arcs: [{ index, radiusOuter, radiusInner, span, spanDeg, nMin, nMax,
 *                    options, default, alternative }],
 *           pieces (default plan, numbered 1..N across arcs), totalPieces, noStock }.
 * Never throws for "no board fits": the options simply carry stock = null.
 */
export function planArchSegments(ring, opts) {
  const S = readPlannerSettings(opts);
  let band;
  try { band = allowanceBand(ring, S.allowance); }
  catch (e) {
    if (!(e instanceof ArchError)) throw e;
    throw new ArchError(`${ring.label || 'Ring'} allowance band (${S.allowance}mm per side): ${e.message} — rise too small for the member face plus allowance`);
  }
  const evaluate = (i, n) => {
    // rough length = band length + finger length per jointed end (spec §7.7,
    // conservative: the whole finger is added at every joint — Piotr may lower it)
    const pieces = partitionArc(ring, i, n, band).map((p) => ({ ...p, roughLength: p.L + S.fingerLength * p.jointedEnds }));
    const wReq = Math.max(...pieces.map((p) => p.wReq));
    const L = Math.max(...pieces.map((p) => p.L));
    const roughLength = Math.max(...pieces.map((p) => p.roughLength));
    return {
      n, pieces,
      wReq,
      projectedWidth: wReq,     // alias (drawing)
      boardWidth: wReq,         // alias (export messages)
      L,
      chordLength: L,           // alias (drawing)
      roughLength,
      stock: stockFor(wReq, S.stockWidths),
    };
  };
  const arcs = ring.outer.map((outer, i) => {
    const theta = arcSpan(outer);
    let nMin = Math.max(2, Math.ceil(theta / S.maxAngle - 1e-9));
    // one short single-centre arc (segmental) may be a single board — only
    // when a stock board actually fits it (spec §7.2)
    if (ring.outer.length === 1 && theta < S.maxAngle && evaluate(i, 1).stock != null) nMin = 1;
    const nMax = nMin + 3;
    const options = [];
    for (let n = nMin; n <= nMax; n++) options.push(evaluate(i, n));
    const def = pickOption(options, nMin, S.pieceRule);
    const other = pickOption(options, nMin, S.pieceRule === 'fewest' ? 'narrowest' : 'fewest');
    const alt = other && def && other.n !== def.n ? other : null;
    return {
      index: i,
      radiusOuter: outer.r,
      radiusInner: ring.inner[i].r,
      span: theta,
      spanDeg: theta * 180 / Math.PI,
      nMin,
      nMax,
      options,
      default: def,
      alternative: alt,
    };
  });
  const pieces = [];
  for (const a of arcs) {
    if (!a.default) continue;
    for (const p of a.default.pieces) pieces.push({ ...p, no: pieces.length + 1, stock: a.default.stock });
  }
  return {
    arcs,
    pieces,
    totalPieces: pieces.length,
    noStock: arcs.some((a) => !a.default),
    stockWidths: [...S.stockWidths],
    contourAllowance: S.allowance,
    maxSegmentAngleDeg: S.maxDeg,
    pieceRule: S.pieceRule,
    fingerLength: S.fingerLength,
  };
}

/**
 * Whole-window plan: geometry + segment plans for the frame head and the
 * leaf top rail, finger-joint profile — everything the DXF builder needs.
 * Reads profile.arch: { finger, stockWidths, contourAllowance, maxSegmentAngleDeg, pieceRule }.
 */
export function buildArchPlan(input, profile) {
  if (!profile?.arch) throw new ArchError('Casement profile has no "arch" section (stock widths / finger joint)');
  const geometry = buildArchGeometry(input, profile);
  const frameHead = planArchSegments(geometry.frameHead, profile.arch);
  const leafTop = planArchSegments(geometry.leafTop, profile.arch);
  return {
    ...geometry,
    hinge: input.hinge === 'right' ? 'right' : 'left',
    finger: { ...profile.arch.finger },
    blank: { contourAllowance: frameHead.contourAllowance, maxSegmentAngleDeg: frameHead.maxSegmentAngleDeg, pieceRule: frameHead.pieceRule },
    plans: { frameHead, leafTop },
    noStock: frameHead.noStock || leafTop.noStock,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GLASS OUTLINE + GLAZING BARS (arched-casement-v2 §2.3)
//
// The glazier's reference frame is the GLASS UNIT: origin at the unit's
// bottom-left corner, y up. Clear width Wg = 2·xg, straight sides up to the
// springing line y_s, then the glass arc chain (the leaf-top ring inner edge
// offset by leafTop.face − glassInset, i.e. the geometry's `glass.arcs`).
// Rule C guarantees the chain starts at x = ±xg, so the sides meet the arcs
// vertically and the unit's bounding box is Wg × apex.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upper y of an arc chain at x. The chains here are single-valued in x above
 * the line they start on (every arc lies in the upper half of its circle), so
 * the first arc whose angular range contains the crossing wins. null outside.
 */
export function chainYAtX(arcs, x) {
  let best = null;
  for (const a of arcs) {
    const dx = x - a.cx;
    const d2 = a.r * a.r - dx * dx;
    if (d2 < 0) continue;
    const dy = Math.sqrt(d2);
    const ang = Math.atan2(dy, dx);
    if (ang < a.a0 - 1e-9 || ang > a.a1 + 1e-9) continue;
    const y = a.cy + dy;
    if (best == null || y > best) best = y;
  }
  return best;
}

/**
 * Area between an arc chain (counter-clockwise, right end → left end) and the
 * line y = const through its two ends — Green's theorem on the closed loop
 * chain + chord; the chord contributes nothing when the ends share their y,
 * which every clipped chain here does. Exact, no sampling.
 */
export function chainAreaAboveLine(arcs) {
  if (!arcs.length) return 0;
  const y0 = arcPoint(arcs[0], arcs[0].a0)[1];
  let s = 0;
  for (const a of arcs) {
    const d = a.a1 - a.a0;
    // ∫ (x dy − y dx) over the arc, with y measured from the chord line
    s += a.r * a.r * d + a.cx * a.r * (Math.sin(a.a1) - Math.sin(a.a0)) - (a.cy - y0) * a.r * (Math.cos(a.a1) - Math.cos(a.a0));
  }
  return s / 2;
}

/**
 * Glass outline of the arched leaf in the glass frame.
 * @param glassArcs   geometry.glass.arcs (arch frame: axis x = 0, springing y = 0)
 * @param halfWidth   xg = clear half width (geometry.glass.halfWidth)
 * @param straightBelow  y_s = glass bottom edge → springing line (mm)
 */
export function buildGlassOutline(glassArcs, halfWidth, straightBelow) {
  const xg = Number(halfWidth), ys = Number(straightBelow);
  if (!(xg > 0)) throw new ArchError(`Glass clear half width must be positive, got ${halfWidth}`);
  if (!(ys >= 0)) throw new ArchError(`Glass straight height below the springing must be >= 0, got ${straightBelow}`);
  const start = arcPoint(glassArcs[0], glassArcs[0].a0);
  if (!(Math.abs(start[0] - xg) < 1e-6 && Math.abs(start[1]) < 1e-6)) {
    throw new ArchError(`Glass arc chain must start vertical at the jamb (rule C): starts at (${r1(start[0])}, ${r1(start[1])}), expected (${r1(xg)}, 0)`);
  }
  const arcs = glassArcs.map((a) => ({ ...a, cx: a.cx + xg, cy: a.cy + ys }));
  const apex = arcsExtent(arcs, [0, 1]).max;
  const archLength = arcsLength(glassArcs);
  const archArea = chainAreaAboveLine(glassArcs);
  return {
    width: 2 * xg,
    height: apex,
    springing: ys,
    apex,
    rise: apex - ys,
    arcs,
    radii: glassArcs.map((a) => a.r),
    archLength,
    archArea,
    area: 2 * xg * ys + archArea,
    perimeter: 2 * xg + 2 * ys + archLength,
  };
}

/**
 * Closed bulge polyline of a glass outline (glass frame): bottom-left →
 * bottom-right → right springing → arcs counter-clockwise → left springing →
 * close. One vertex per arc end point, exact arcs.
 */
export function glassOutlinePoly(outline) {
  const { width: Wg, arcs } = outline;
  const pts = [[0, 0, 0], [Wg, 0, 0]];
  for (const a of arcs) pts.push([...arcPoint(a, a.a0), arcBulge(a)]);
  const last = arcs[arcs.length - 1];
  pts.push([...arcPoint(last, last.a1), 0]);
  return pts;
}

const BAR_ID_PREFIX = Object.freeze({ v: 'V', h: 'H', springing: 'S', ring: 'R', spoke: 'K', tracery: 'T' });

function readPatternSettings(opts) {
  const ratios = Array.isArray(opts?.hubRingRatios) ? opts.hubRingRatios.map(Number) : [];
  if (ratios.length < 3 || !ratios.every((k) => k > 0 && k < 1)) throw new ArchError('Casement profile arch.patterns.hubRingRatios is missing (three fractions of the clear half width)');
  const I = opts?.intersecting || {};
  const pitch = Number(I.pitch), minM = Number(I.minMullions), maxM = Number(I.maxMullions), minR = Number(I.minRadius);
  if (!(pitch > 0 && minM >= 1 && maxM >= minM && minR >= 0)) throw new ArchError('Casement profile arch.patterns.intersecting is missing (pitch / minMullions / maxMullions / minRadius)');
  return { ratios, pitch, minM, maxM, minR };
}

/** Intersection points of two circles (none, one or two). */
function circleCircle(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-9) || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const px = c1[0] + a * dx / d, py = c1[1] + a * dy / d;
  const ox = -dy / d * h, oy = dx / d * h;
  return h > 0 ? [[px + ox, py + oy], [px - ox, py - oy]] : [[px, py]];
}

/**
 * Where a tracery circle (centre c, radius r, starting on the springing line)
 * first meets the outline chain when travelling upward from its start —
 * `side` −1: start at angle 0 (centre left of the mullion), angle increases;
 * `side` +1: start at angle π, angle decreases. Returns the angle on the
 * tracery circle, or null (PSW: at most a quarter turn).
 */
function traceryHit(arcs, c, r, side) {
  let best = null;
  for (const a of arcs) {
    for (const p of circleCircle(c, r, [a.cx, a.cy], a.r)) {
      if (p[1] < c[1] - 1e-9) continue;                              // below the springing
      const onArc = Math.atan2(p[1] - a.cy, p[0] - a.cx);
      if (onArc < a.a0 - 1e-6 || onArc > a.a1 + 1e-6) continue;      // outside the outline arc's range
      const phi = Math.atan2(p[1] - c[1], p[0] - c[0]);
      const travel = side < 0 ? phi : Math.PI - phi;
      if (travel < 1e-9 || travel > Math.PI / 2 + 1e-9) continue;
      if (best == null || travel < best.travel) best = { travel, phi };
    }
  }
  return best ? best.phi : null;
}

/**
 * Glazing bars in the arched leaf (v2 §2.3), on the glass outline, glass frame.
 * Straight bars: v — equal divisions of the clear width, bottom edge up to the
 * outline; h — equal divisions of the straight height below the springing,
 * full clear width (never across the arc).
 * Patterns — PSW 3d-src FixFrameWindow.jsx `semiBarPattern` (lines 847–1030)
 * and `intersectingData` (667–830) ported on the glass outline:
 *   half-hub           springing bar + ring 1, nothing else
 *   hub-spoke          ring 1 (0.3·xg), 4 spokes at i/3·π from the ring to the
 *                      outline — the two end spokes lie ON the springing line and
 *                      are the springing bar; ring-end verticals below the line;
 *   double / triple    rings 0.3 / 0.6 (/ 0.8), 6 / 8 spokes segmented ring → ring
 *                      → outline, one vertical per ring end below the line;
 *                      the user's v count is ignored for every hub (PSW rule);
 *   intersecting       n = clamp(round(Wg / pitch), min, max) mullions up to the
 *                      springing; from each mullion top two tracery arcs centred on
 *                      the OUTER frame corners (±W/2 on the springing line, as PSW),
 *                      each stopped at the outline (quarter turn at most).
 * Spoke insets (BAR_W·0.6 / 0.4) and the v-bar top clearance in PSW are 3D
 * cosmetics — the axes here meet the rings and the outline exactly.
 * Output: [{ id, kind: 'straight'|'arc', role, from, to, arc?, length }], lengths
 * rounded to 0.5 mm; roles v | h | springing | ring | spoke | tracery.
 */
export function buildArchBars({ outline, shape, pattern = 'none', h = 0, v = 0, frameHalfWidth }, patternOpts) {
  const pat = pattern || 'none';
  if (!ARCH_BAR_PATTERNS.includes(pat)) throw new ArchError(`Unknown arch bar pattern "${pattern}"`);
  const allowed = patternsForShape(shape);
  if (!allowed.includes(pat)) throw new ArchError(`Bar pattern "${pat}" is not available on a ${ARCH_SHAPE_LABELS[shape] || shape} arch (allowed: ${allowed.join(', ')})`);
  const { width: Wg, springing: ys, arcs } = outline;
  const xg = Wg / 2;
  const nH = Math.max(0, Math.floor(Number(h) || 0));
  const nV = Math.max(0, Math.floor(Number(v) || 0));
  const bars = [];
  const r05 = (val) => Math.round(val * 2) / 2;
  const straight = (role, x0, y0, x1, y1) => bars.push({ kind: 'straight', role, from: [x0, y0], to: [x1, y1], length: r05(Math.hypot(x1 - x0, y1 - y0)) });
  const arcBar = (role, a) => bars.push({ kind: 'arc', role, arc: { cx: a.cx, cy: a.cy, r: a.r, a0: a.a0, a1: a.a1 }, from: arcPoint(a, a.a0), to: arcPoint(a, a.a1), length: r05(arcLen(a)) });
  const hub = isHubPattern(pat);

  for (let j = 1; j <= nH; j++) {
    const y = ys * j / (nH + 1);
    if (!(y > 0)) continue;
    straight('h', 0, y, Wg, y);
  }
  if (!hub) {
    for (let i = 1; i <= nV; i++) {
      const x = Wg * i / (nV + 1);
      const top = chainYAtX(arcs, x);
      if (top == null) throw new ArchError(`Vertical bar at x = ${r1(x)} does not meet the glass outline`);
      straight('v', x, 0, x, top);
    }
  }

  if (hub) {
    const S = readPatternSettings(patternOpts);
    if (arcs.length !== 1) throw new ArchError(`Hub patterns need a semi-circle outline (one arc), got ${arcs.length} arcs`);
    const nRings = pat === 'triple-hub-spoke' ? 3 : pat === 'double-hub-spoke' ? 2 : 1;
    const rings = S.ratios.slice(0, nRings).map((k) => k * xg);
    const c = [xg, ys];
    if (pat === 'half-hub') {
      straight('springing', 0, ys, Wg, ys);
      arcBar('ring', { cx: c[0], cy: c[1], r: rings[0], a0: 0, a1: Math.PI });
    } else {
      for (const rk of rings) arcBar('ring', { cx: c[0], cy: c[1], r: rk, a0: 0, a1: Math.PI });
      const spokeCount = nRings === 3 ? 8 : nRings === 2 ? 6 : 4;
      const bounds = [...rings, arcs[0].r];                          // ring → ring → outline (semi-circle radius = xg)
      for (let i = 0; i < spokeCount; i++) {
        const ang = (i / (spokeCount - 1)) * Math.PI;
        const onLine = i === 0 || i === spokeCount - 1;             // the end spokes lie on the springing line
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let k = 0; k < bounds.length - 1; k++) {
          const r0 = bounds[k], r1s = bounds[k + 1];
          straight(onLine ? 'springing' : 'spoke', c[0] + r0 * ca, c[1] + r0 * sa, c[0] + r1s * ca, c[1] + r1s * sa);
        }
      }
      // PSW 875–886: every ring end continues straight down to the glass bottom
      for (const rk of rings) {
        straight('v', xg - rk, 0, xg - rk, ys);
        straight('v', xg + rk, 0, xg + rk, ys);
      }
    }
  }

  if (pat === 'intersecting') {
    const S = readPatternSettings(patternOpts);
    const hw = Number(frameHalfWidth);
    if (!(hw > xg)) throw new ArchError(`Intersecting pattern needs the frame half width (> ${r1(xg)}), got ${frameHalfWidth}`);
    const n = Math.max(S.minM, Math.min(S.maxM, Math.round(Wg / S.pitch)));
    for (let i = 1; i <= n; i++) {
      const x = Wg * i / (n + 1);
      straight('v', x, 0, x, ys);                                    // mullion up to the springing
      for (const side of [-1, 1]) {
        const cx = xg + side * hw;                                   // outer frame corner on the springing line
        const rM = Math.abs(x - cx);
        if (rM < S.minR) continue;
        const phi = traceryHit(arcs, [cx, ys], rM, side);
        if (phi == null) continue;
        arcBar('tracery', side < 0 ? { cx, cy: ys, r: rM, a0: 0, a1: phi } : { cx, cy: ys, r: rM, a0: phi, a1: Math.PI });
      }
    }
  }

  const counters = {};
  for (const b of bars) {
    const pfx = BAR_ID_PREFIX[b.role] || 'B';
    counters[pfx] = (counters[pfx] || 0) + 1;
    b.id = `${pfx}${counters[pfx]}`;
  }
  return {
    pattern: pat,
    counts: { h: nH, v: hub ? 0 : nV },
    bars,
    totalLength: bars.reduce((s, b) => s + b.length, 0),
    byRole: bars.reduce((m, b) => { m[b.role] = (m[b.role] || 0) + 1; return m; }, {}),
  };
}
