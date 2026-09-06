/**
 * arch.js — arched casement head: geometry, glazing bars + segment planner
 * (arched-casement-v1 geometry core, v2 shape model, v4 whole-chain planner).
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

// PSW sash form radio values (online-estimate.html 453–465: arch-style) → PSW shape ids
// (price-calculator.js SHAPE_FROM_RADIO); the saved config carries the id, older rows the radio.
export const PSW_SASH_RADIO_SHAPE = Object.freeze({
  semicircular: 'semi-circle',
  gothic: 'gothic-arch',
  elliptical: 'elliptical-arch',
  segmental: 'segmental-arch',
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
// v3 0.4: the PSW patterns plus the workshop preset `quad-hub-spoke` (from
// arka_CNC-piotr.dxf: 5 spokes = 45°, rings 1/3 · 2/3, the vertical spoke
// runs through the hub) and `custom` (spoke count 3–9, ring list) — every hub
// pattern is one generic hubSpoke({ spokes, rings, hubVertical }).
export const ARCH_BAR_PATTERNS = Object.freeze([
  'none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'quad-hub-spoke', 'custom', 'intersecting',
  'sunburst',   // v3 Block 3: circle only (buildCircleBars)
]);
export const ARCH_BAR_PATTERN_LABELS = Object.freeze({
  'none': 'None',
  'half-hub': 'Half hub',
  'hub-spoke': 'Hub & spoke',
  'double-hub-spoke': 'Double hub & spoke',
  'triple-hub-spoke': 'Triple hub & spoke',
  'quad-hub-spoke': 'Quad hub & spoke (workshop)',
  'custom': 'Custom hub',
  'intersecting': 'Intersecting',
  'sunburst': 'Sunburst',
});
export const HUB_PATTERNS = Object.freeze(['half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'quad-hub-spoke', 'custom']);
export const isHubPattern = (pattern) => HUB_PATTERNS.includes(pattern);
// PSW price-calculator.js PATTERNS_FOR_SHAPE (990–995) — the customer-facing set, 1:1
export const PSW_PATTERNS_FOR_SHAPE = Object.freeze({
  'semi-circle': ['none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'intersecting'],
  'gothic-equilateral': ['none', 'intersecting'],
  'gothic-drop': ['none', 'intersecting'],
  'three-centre': ['none'],
});
// PC adds the workshop preset and the custom hub on the semi-circle only (hubs need one centre)
export const PC_EXTRA_PATTERNS = Object.freeze({ 'semi-circle': ['quad-hub-spoke', 'custom'] });
export const PATTERNS_FOR_SHAPE = Object.freeze({
  'semi-circle': [...PSW_PATTERNS_FOR_SHAPE['semi-circle'], ...PC_EXTRA_PATTERNS['semi-circle']],
  'gothic-equilateral': PSW_PATTERNS_FOR_SHAPE['gothic-equilateral'],
  'gothic-drop': PSW_PATTERNS_FOR_SHAPE['gothic-drop'],
  'three-centre': PSW_PATTERNS_FOR_SHAPE['three-centre'],
  // v3 Block 3: the circle fixed window (PSW fix-circle-bars: none | sunburst)
  'circle': ['none', 'sunburst'],
});
export function patternsForShape(shape) { return PATTERNS_FOR_SHAPE[shape] || ['none']; }
// ── Circle (v3 Block 3): a FIXED window whose frame and leaf are full rings ──
export const CIRCLE_SHAPE = 'circle';
export const isCircleShape = (shape) => shape === CIRCLE_SHAPE;
/** True for every shape the arch module builds (arches + the circle). */
export const isShapedShape = (shape) => isArchShape(shape) || isCircleShape(shape);
// Hub presets: spokes evenly from 0 to π (the two end spokes ARE the springing
// bar), rings as fractions of the clear half width (PSW presets read the
// profile hubRingRatios; the workshop preset carries the DWG's thirds),
// hubVertical = the 90° spoke continues through the hub to the springing line.
export const HUB_PRESETS = Object.freeze({
  'half-hub': { spokes: 0, rings: 1, hubVertical: false },
  'hub-spoke': { spokes: 4, rings: 1, hubVertical: false },
  'double-hub-spoke': { spokes: 6, rings: 2, hubVertical: false },
  'triple-hub-spoke': { spokes: 8, rings: 3, hubVertical: false },
  'quad-hub-spoke': { spokes: 5, ringRatios: [1 / 3, 2 / 3], hubVertical: true },
});
export const CUSTOM_HUB_LIMITS = Object.freeze({ minSpokes: 3, maxSpokes: 9, maxRings: 4 });

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

/**
 * Arched SASH geometry (ARCHED-WINDOWS-v3 Block 1 C, rule C — DEFAULT (open)):
 * the box head is a ring 0 → sashArch.headFace (80) on the frame contour; the
 * upper sash's arched top rail is a ring sashInset → sashInset + topRail.face,
 * sashInset = deductions.sashWidth / 2 (89: the ring meets the stile line —
 * concentric, rule C); the glass line = sashInset + topRail.face − glassRebate.
 * Vertical layout (PSW price-calculator.js metricsFor, adopted): the arch
 * starts at H − rise from the cill, the meeting line sits at H / 2, so the
 * upper sash's straight stile above the meeting line = H/2 − rise (≥
 * limits.minUpperStile); the STILES TOP piece runs to the meeting rail bottom:
 * H/2 − rise + meetingRail / 2.
 * Every number is read from the sash profile (sashArch, deductions.sashWidth,
 * elements.topRail / meetingRail); `glassRebate` = the rebate depth per side.
 */
export function buildSashArchGeometry({ shape, width, height, rise }, sashProfile, glassRebate) {
  const SA = sashProfile?.sashArch;
  if (!SA?.limits || !(Number(SA.headFace) > 0)) throw new ArchError('Sash profile sashArch (headFace / limits) is missing');
  const L = readArchLimits({ ...SA.limits, minLeafStraightStile: SA.limits.minUpperStile });
  const minHaunchRadius = readMinHaunchRadius(SA);
  const W = Number(width), H = Number(height);
  const h = resolveArchRise(shape, W, rise, L);
  const straightHeight = H - h;
  if (!(straightHeight >= L.minStraightBelowRise)) {
    throw new ArchError(`Arch rise ${r1(h)}mm in a ${r1(H)}mm high window leaves ${r1(straightHeight)}mm straight below the arch — minimum ${L.minStraightBelowRise}mm (height >= rise + ${L.minStraightBelowRise})`);
  }
  const meet = Number(sashProfile.elements?.meetingRail?.face);
  const topFace = Number(sashProfile.elements?.topRail?.face);
  const sashInset = Number(sashProfile.deductions?.sashWidth) / 2;
  const rebate = Number(glassRebate);
  if (!(meet > 0 && topFace > 0 && sashInset > 0 && rebate >= 0)) throw new ArchError('Sash profile elements.meetingRail / topRail, deductions.sashWidth or the glass rebate are missing');
  const upperStileClear = H / 2 - h;                       // springing → meeting line (PSW rule)
  if (!(upperStileClear >= L.minLeafStraightStile)) {
    throw new ArchError(`Straight stile of the arched upper sash is ${r1(upperStileClear)}mm (H/2 − rise) — minimum ${L.minLeafStraightStile}mm`);
  }
  const base = archArcs(shape, W, h, { minHaunchRadius });
  const head = buildRing(base, 0, Number(SA.headFace), 'S-ARCH HEAD');
  const topRail = buildRing(base, sashInset, sashInset + topFace, 'S-ARCH TOP RAIL');
  const glassOffset = sashInset + topFace - rebate;
  const glassArcs = offsetArcs(base, glassOffset);
  return {
    shape,
    label: ARCH_SHAPE_LABELS[shape],
    width: W,
    height: H,
    rise: h,
    start: straightHeight,
    straightHeight,
    limits: L,
    minHaunchRadius,
    radii: base.map((a) => a.r),
    arcs: base,
    offsets: { headInner: Number(SA.headFace), sashOuter: sashInset, sashInner: sashInset + topFace, glass: glassOffset },
    head,
    topRail,
    glass: { arcs: glassArcs, length: arcsLength(glassArcs), apex: arcsExtent(glassArcs, [0, 1]).max, halfWidth: W / 2 - glassOffset },
    upperStileClear,
    upperStraightStile: upperStileClear + meet / 2,       // STILES TOP piece: springing → meeting rail bottom
    meetingLine: H / 2,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEGMENT PLANNER v2 (ARCHED-WINDOWS-v4 Block C) — a curved member is glued
// up from N straight boards (finger-jointed on radial faces) and the ring
// contour is routed afterwards.
//
//  1. The WHOLE chain (springing → springing) is partitioned by OUTER arc
//     length into N equal pieces; a piece may contain a tangent point (haunch
//     + part of the crown — the CNC cuts the compound curve from one straight
//     board). A gothic is split at the apex first (the apex is always a joint),
//     then each side is partitioned. A circle ring is one closed chain with no
//     springing: N equal pieces on radial joints.
//  2. End planes: radial to the local arc at a cut point (a joint); the
//     vertical axis at a gothic apex (a joint); the springing end of the RAW
//     piece is cut SQUARE to the piece axis at the band extent — the CNC routs
//     the horizontal springing face with the contour (v4 decision, BLOCKERS:
//     the v1 horizontal raw cut adds up to 200 mm of board on a tilted
//     compound piece and fails the length limits the spec declares valid).
//  3. Board size per piece = the ALLOWANCE BAND (outer contour + a, inner
//     contour − a, bounded by the end planes) projected on the piece axes:
//     u = the chord from the piece's start to its end point on the outer
//     contour, b = its outward normal. W_req = extent on b, L = extent on u.
//     For a single-arc piece with radial joints this is the v1 closed form
//     W_req = (Ro + a) − (Ri − a)·cos(φ/2), L = 2·(Ro + a)·sin(φ/2).
//  4. Stock = the narrowest arch.stockWidths entry ≥ W_req; the widest entry
//     is the board cap (no separate maximum).
//  5. Two HARD limits (v4 C.1): the piece's overall length — the longer stock
//     edge with the finger extension — ≥ cnc.minClampLength (Rover A 1532: two
//     Uniclamps + end cuts); the SHORTER stock edge ≥ arch.minPieceLength
//     (joinery). A plan that cannot satisfy both is reported (`noStock`,
//     reason 'below minimum length'), never split finer.
//  6. Search (v4 C.3 / C.4): N from 1 (per side) upwards; the first N whose
//     pieces ALL pass is the FEWEST plan; N + 1 … N + 3 are searched for the
//     ECONOMY alternative — the first that passes on a narrower board. The
//     default is the fewest plan unless its waste (Σ board area − Σ band
//     area) / Σ board area exceeds arch.wasteThreshold AND the alternative
//     exists — then the alternative wins. Both are printed on the sheet.
//
// Every number (allowance, stock list, finger, both limits, threshold) comes
// from the profile (arch + cnc blocks) — nothing is defaulted here.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Allowance band of a ring (spec §7.4): outer contour grown by `a`, inner
 * contour shrunk by `a`, clipped ends recomputed on the band radii.
 */
export function allowanceBand(ring, a) {
  const d = Number(a);
  if (!(d >= 0)) throw new ArchError(`Contour allowance must be a number of mm >= 0, got "${a}"`);
  return { outer: offsetArcs(ring.outer, -d), inner: offsetArcs(ring.inner, d) };
}

/** Signed area of a closed bulge polyline (shoelace + circular segments); positive counter-clockwise. */
export function bulgePolyArea(pts) {
  let s = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0, b] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    s += x0 * y1 - x1 * y0;
    if (b) {
      const chord = Math.hypot(x1 - x0, y1 - y0);
      const theta = 4 * Math.atan(Math.abs(b));
      const r = chord / (2 * Math.sin(theta / 2));
      s += Math.sign(b) * r * r * (theta - Math.sin(theta));   // 2 × segment area
    }
  }
  return s / 2;
}

const isClosedRing = (ring) => !ring.outer[0].clip0 && !ring.outer[ring.outer.length - 1].clip1;

/**
 * Planning groups of a ring: one chain for a semi-circle / three-centre, two
 * sides for a gothic (split at the apex — clip 'axis'), one closed ring for
 * a circle. Each group: { arcIndices, startType, endType } with the end plane
 * kinds 'archStart' (square raw end) | 'axis' (apex joint) | 'radial' (joint).
 */
export function ringGroups(ring) {
  const outer = ring.outer;
  if (isClosedRing(ring)) return [{ kind: 'ring', arcIndices: outer.map((_, i) => i), startType: 'radial', endType: 'radial' }];
  const groups = [];
  let start = 0;
  for (let i = 0; i < outer.length; i++) {
    if (outer[i].clip1 === 'axis' || i === outer.length - 1) {
      const idx = [];
      for (let j = start; j <= i; j++) idx.push(j);
      groups.push({ arcIndices: idx, startType: outer[start].clip0 === 'axis' ? 'axis' : 'archStart', endType: outer[i].clip1 === 'axis' ? 'axis' : 'archStart' });
      start = i + 1;
    }
  }
  groups.forEach((g) => { g.kind = groups.length > 1 ? 'side' : 'chain'; });
  return groups;
}

// end cut of a raw piece: 'square' (springing, not a joint), 'joint' (radial plane), 'apex' (vertical axis)
function makeEndCut(endType, u, b, planeDir) {
  if (endType === 'archStart') {
    // the springing face is horizontal: the wedge the CNC routs off the square end
    const contourDeg = Math.abs(Math.atan2(u[1], u[0])) * 180 / Math.PI;
    return { kind: 'square', jointed: false, angleDeg: 0, fromSquareDeg: 0, contourDeg: contourDeg > 90 ? 180 - contourDeg : contourDeg };
  }
  const dot = Math.abs(planeDir[0] * b[0] + planeDir[1] * b[1]);
  const deg = Math.acos(Math.min(1, dot)) * 180 / Math.PI;
  return { kind: endType === 'axis' ? 'apex' : 'joint', jointed: true, angleDeg: deg, fromSquareDeg: deg };
}

/**
 * Partition one planning group of a ring into n equal pieces by outer arc
 * length. Every piece carries its finished arcs (outer / inner), its band
 * arcs, its end planes, the board axes and the band projection.
 */
export function partitionGroup(ring, band, group, n) {
  const outer = ring.outer, inner = ring.inner;
  const idx = group.arcIndices;
  const lens = idx.map((i) => arcLen(outer[i]));
  const total = lens.reduce((s, x) => s + x, 0);
  const pieces = [];
  const eps = 1e-9;
  for (let k = 0; k < n; k++) {
    const s0 = total * k / n, s1 = k === n - 1 ? total : total * (k + 1) / n;
    const first = k === 0, last = k === n - 1;
    const oArcs = [], iArcs = [], bO = [], bI = [], arcIdx = [];
    let acc = 0;
    let startPlane = null, endPlane = null;
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j];
      const L = lens[j];
      const lo = Math.max(s0, acc), hi = Math.min(s1, acc + L);
      if (hi > lo + eps) {
        const O = outer[i], I = inner[i], BO = band.outer[i], BI = band.inner[i];
        const atStart = first && j === 0 && lo <= acc + eps;
        const atEnd = last && j === idx.length - 1 && hi >= acc + L - eps;
        const t0 = O.a0 + (lo - acc) / O.r, t1 = O.a0 + (hi - acc) / O.r;
        // group ends keep every contour's own clipped angle (springing / apex);
        // interior cuts are radial planes — the same angle on every concentric contour
        oArcs.push({ ...O, a0: atStart ? O.a0 : t0, a1: atEnd ? O.a1 : t1 });
        iArcs.push({ ...I, a0: atStart ? I.a0 : t0, a1: atEnd ? I.a1 : t1 });
        bO.push({ ...BO, a0: atStart ? BO.a0 : t0, a1: atEnd ? BO.a1 : t1 });
        bI.push({ ...BI, a0: atStart ? BI.a0 : t0, a1: atEnd ? BI.a1 : t1 });
        arcIdx.push(i);
        if (!startPlane) startPlane = { arc: i, angle: atStart ? O.a0 : t0, centre: [O.cx, O.cy] };
        endPlane = { arc: i, angle: atEnd ? O.a1 : t1, centre: [O.cx, O.cy] };
      }
      acc += L;
    }
    const endStart = first ? group.startType : 'radial';
    const endEnd = last ? group.endType : 'radial';
    // board axes: u = the chord from the piece's start to its end on the outer contour, b = outward normal
    const pS = arcPoint(oArcs[0], oArcs[0].a0), pE = arcPoint(oArcs[oArcs.length - 1], oArcs[oArcs.length - 1].a1);
    let u = [pE[0] - pS[0], pE[1] - pS[1]];
    const chord = Math.hypot(u[0], u[1]);
    if (chord < 1e-9) {                                          // closed single piece: bisector of the angular range
      const m = (oArcs[0].a0 + oArcs[oArcs.length - 1].a1) / 2;
      u = [-Math.sin(m), Math.cos(m)];
    } else u = [u[0] / chord, u[1] / chord];
    const b = [u[1], -u[0]];
    const bisector = Math.atan2(b[1], b[0]);
    const sO = arcsExtent(bO, u), sI = arcsExtent(bI, u);
    const wO = arcsExtent(bO, b), wI = arcsExtent(bI, b);
    const sMin = Math.min(sO.min, sI.min), sMax = Math.max(sO.max, sI.max);
    const wMin = Math.min(wO.min, wI.min), wMax = Math.max(wO.max, wI.max);
    const planeDir = (pl) => [Math.cos(pl.angle), Math.sin(pl.angle)];
    // the apex joint is the VERTICAL axis (x = 0), not the radial at the apex; the springing end is square
    const endCuts = [makeEndCut(endStart, u, b, endStart === 'axis' ? [0, 1] : planeDir(startPlane)), makeEndCut(endEnd, u, b, endEnd === 'axis' ? [0, 1] : planeDir(endPlane))];
    const jointedEnds = endCuts.filter((c) => c.jointed).length;
    const pi0 = arcPoint(bI[0], bI[0].a0), pi1 = arcPoint(bI[bI.length - 1], bI[bI.length - 1].a1);
    const span = oArcs.reduce((s, a) => s + arcSpan(a), 0);
    pieces.push({
      k, n,
      arc: startPlane.arc,             // first arc of the piece (compat)
      arcs: arcIdx,
      compound: oArcs.length > 1,
      s: [s0, s1],
      arcLength: s1 - s0,
      span,
      spanDeg: span * 180 / Math.PI,
      phi: span,                       // compat: angular span of the piece
      phiDeg: span * 180 / Math.PI,
      outer: oArcs,
      inner: iArcs,
      band: { outer: bO, inner: bI },
      endStart,
      endEnd,
      planes: { start: startPlane, end: endPlane },
      endCuts,
      jointedEnds,
      axes: { bisector, b, u },
      axisAngleDeg: endCuts[0].contourDeg ?? endCuts[1].contourDeg ?? 0,
      extents: { s: [sMin, sMax], w: [wMin, wMax] },
      wReq: wMax - wMin,
      projectedWidth: wMax - wMin,     // alias kept for the drawing (= W_req, band included)
      L: sMax - sMin,
      chordLength: sMax - sMin,        // alias (band extent along the axis)
      Lin: Math.hypot(pi1[0] - pi0[0], pi1[1] - pi0[1]),
    });
  }
  return pieces;
}

/** Closed bulge polyline of one piece: outer arcs CCW, end cut, inner arcs CW, start cut. */
export function piecePoly(piece) {
  const pts = [];
  for (const a of piece.outer) pts.push([...arcPoint(a, a.a0), arcBulge(a)]);
  const lo = piece.outer[piece.outer.length - 1];
  pts.push([...arcPoint(lo, lo.a1), 0]);
  for (let i = piece.inner.length - 1; i >= 0; i--) pts.push([...arcPoint(piece.inner[i], piece.inner[i].a1), -arcBulge(piece.inner[i])]);
  pts.push([...arcPoint(piece.inner[0], piece.inner[0].a0), 0]);
  return pts;
}

/** Same polygon for the piece's allowance band (what the stock board must contain). */
export function pieceBandPoly(piece) {
  return piecePoly({ outer: piece.band.outer, inner: piece.band.inner });
}

/** Joint faces of a piece (inner → outer point) — every end except the square springing cut. */
export function pieceJoints(piece) {
  const out = [];
  if (piece.endStart !== 'archStart') out.push([arcPoint(piece.inner[0], piece.inner[0].a0), arcPoint(piece.outer[0], piece.outer[0].a0)]);
  const lo = piece.outer[piece.outer.length - 1], li = piece.inner[piece.inner.length - 1];
  if (piece.endEnd !== 'archStart') out.push([arcPoint(li, li.a1), arcPoint(lo, lo.a1)]);
  return out;
}

/**
 * One end edge of a piece's STOCK board in world coordinates: the two points
 * where the end cut meets the board's long edges (w = wLo and w = wHi in the
 * piece axes). Joints are cut on the radial plane through the local arc
 * centre, a gothic apex on the vertical axis, the springing end SQUARE to
 * the piece axis at the band extent (the CNC routs the springing face).
 */
export function pieceEndEdge(piece, which, wLo, wHi) {
  const { b, u } = piece.axes;
  const type = which === 'start' ? piece.endStart : piece.endEnd;
  const plane = which === 'start' ? piece.planes.start : piece.planes.end;
  const P = (sv, w) => [sv * u[0] + w * b[0], sv * u[1] + w * b[1]];
  const square = (w) => P(which === 'start' ? piece.extents.s[0] : piece.extents.s[1], w);
  if (type === 'archStart') return [square(wLo), square(wHi)];
  if (type === 'axis') {
    if (Math.abs(u[0]) < 1e-9) return [square(wLo), square(wHi)];          // axis parallel to the cut: square end
    const at = (w) => P(-(w * b[0]) / u[0], w);                            // x = 0
    return [at(wLo), at(wHi)];
  }
  // radial plane: c + λ·d = s·u + w·b  →  s·u − λ·d = c − w·b
  const d = [Math.cos(plane.angle), Math.sin(plane.angle)];
  const det = -u[0] * d[1] + d[0] * u[1];
  if (Math.abs(det) < 1e-9) return [square(wLo), square(wHi)];
  const at = (w) => {
    const rx = plane.centre[0] - w * b[0], ry = plane.centre[1] - w * b[1];
    const sv = (-rx * d[1] + d[0] * ry) / det;
    return P(sv, w);
  };
  return [at(wLo), at(wHi)];
}

/**
 * The raw stock piece after its end cuts, in world (assembled) coordinates:
 * a straight trapezoid `stock` wide (centred on the piece band), ends on the
 * joint planes / square at the springing. Neighbours share their joint edge
 * exactly, so the assembled set is the glued blank before machining.
 * `fingerExt` extends every jointed end along the piece axis (rough length).
 * Vertex order: [start-inner, end-inner, end-outer, start-outer]; the START
 * end (arc a0) sits at −u, the END end (a1) at +u.
 */
export function pieceStockTrapezoid(piece, stock, fingerExt = 0) {
  const { u } = piece.axes;
  const wLo = piece.extents.w[0] - (stock - piece.projectedWidth) / 2;
  const wHi = wLo + stock;
  const [s0, s1] = pieceEndEdge(piece, 'start', wLo, wHi);
  const [e0, e1] = pieceEndEdge(piece, 'end', wLo, wHi);
  const [cutStart, cutEnd] = piece.endCuts;
  const ext = (p, sign) => [p[0] + sign * fingerExt * u[0], p[1] + sign * fingerExt * u[1]];
  const S0 = cutStart.jointed ? ext(s0, -1) : s0, S1 = cutStart.jointed ? ext(s1, -1) : s1;
  const E0 = cutEnd.jointed ? ext(e0, +1) : e0, E1 = cutEnd.jointed ? ext(e1, +1) : e1;
  return [[...S0, 0], [...E0, 0], [...E1, 0], [...S1, 0]];
}

/**
 * Edge lengths of the raw piece on a stock board: inner / outer straight
 * edges (no finger), the shorter / longer of the two, and the overall length
 * = the board's extent along the piece axis with the finger extension (what
 * is cut from the stock and clamped).
 */
export function pieceStockEdges(piece, stock, fingerExt = 0) {
  const t = pieceStockTrapezoid(piece, stock, 0);
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const inner = len(t[0], t[1]), outer = len(t[3], t[2]);
  const te = pieceStockTrapezoid(piece, stock, fingerExt);
  const { u } = piece.axes;
  const sv = te.map((q) => q[0] * u[0] + q[1] * u[1]);
  const overall = Math.max(...sv) - Math.min(...sv);
  return { inner, outer, shorter: Math.min(inner, outer), longer: Math.max(inner, outer), overall };
}

function stockFor(boardWidth, stockWidths) {
  for (const w of stockWidths) if (w + 1e-9 >= boardWidth) return w;
  return null;
}

function readPlannerSettings(opts, cnc) {
  const stockWidths = (Array.isArray(opts?.stockWidths) ? opts.stockWidths : []).map(Number).filter((w) => w > 0).sort((a, b) => a - b);
  const allowance = Number(opts?.contourAllowance);
  if (!(allowance >= 0)) throw new ArchError('Casement profile arch.contourAllowance is missing (mm per side)');
  const fingerLength = Number(opts?.finger?.length);
  if (!(fingerLength >= 0)) throw new ArchError('Casement profile arch.finger.length is missing (mm per jointed end)');
  const minPieceLength = Number(opts?.minPieceLength);
  if (!(minPieceLength >= 0)) throw new ArchError('Casement profile arch.minPieceLength is missing (mm, shorter stock edge)');
  const wasteThreshold = Number(opts?.wasteThreshold);
  if (!(wasteThreshold >= 0 && wasteThreshold <= 1)) throw new ArchError('Casement profile arch.wasteThreshold is missing (0–1)');
  const minClampLength = Number(cnc?.minClampLength);
  if (!(minClampLength >= 0)) throw new ArchError('Casement profile cnc.minClampLength is missing (mm, overall piece length)');
  return { stockWidths, allowance, fingerLength, minPieceLength, wasteThreshold, minClampLength, maxStock: stockWidths.length ? stockWidths[stockWidths.length - 1] : 0 };
}

const PLANNER_MAX_N = 40;

/**
 * Plan every group of a ring (see banner).
 * @param ring    buildRing output
 * @param opts    profile.arch  { stockWidths, contourAllowance, finger, minPieceLength, wasteThreshold }
 * @param cnc     profile.cnc   { minClampLength }
 * Returns { arcs: [group plans], pieces (default plan, numbered 1..N across
 * groups), totalPieces, noStock, noStockReason, reasons, ... settings }.
 * Group plan: { index, kind, arcIndices, radii, radiusOuter, radiusInner,
 * span, spanDeg, length, nMin, nMax, options, fewest, alternative, default,
 * rule, reason }. Never throws for "no valid plan": default = null.
 */
export function planArchSegments(ring, opts, cnc) {
  const S = readPlannerSettings(opts, cnc);
  let band;
  try { band = allowanceBand(ring, S.allowance); }
  catch (e) {
    if (!(e instanceof ArchError)) throw e;
    throw new ArchError(`${ring.label || 'Ring'} allowance band (${S.allowance}mm per side): ${e.message} — rise too small for the member face plus allowance`);
  }
  const groups = ringGroups(ring);
  const evaluate = (group, n) => {
    const raw = partitionGroup(ring, band, group, n);
    const wReq = Math.max(...raw.map((p) => p.wReq));
    const stock = stockFor(wReq, S.stockWidths);
    const pieces = raw.map((p) => {
      const edges = stock != null ? pieceStockEdges(p, stock, S.fingerLength) : null;
      const outerEdge = edges ? edges.outer : p.L, innerEdge = edges ? edges.inner : p.Lin;
      const shorterEdge = edges ? edges.shorter : Math.min(p.L, p.Lin);
      const roughLength = edges ? edges.overall : p.L + S.fingerLength * p.jointedEnds;
      const bandArea = Math.abs(bulgePolyArea(pieceBandPoly(p)));
      const boardArea = stock != null ? roughLength * stock : null;
      const failures = [];
      if (stock != null) {
        if (roughLength + 1e-9 < S.minClampLength) failures.push(`overall ${r1(roughLength)} < ${S.minClampLength} (cnc.minClampLength)`);
        if (shorterEdge + 1e-9 < S.minPieceLength) failures.push(`shorter edge ${r1(shorterEdge)} < ${S.minPieceLength} (arch.minPieceLength)`);
      }
      return { ...p, stock, outerEdge, innerEdge, shorterEdge, longerEdge: Math.max(outerEdge, innerEdge), roughLength, overallLength: roughLength, bandArea, boardArea, waste: boardArea ? (boardArea - bandArea) / boardArea : null, limitFailures: failures, limitsOk: failures.length === 0 };
    });
    const boardArea = stock != null ? pieces.reduce((s, p) => s + p.boardArea, 0) : null;
    const bandArea = pieces.reduce((s, p) => s + p.bandArea, 0);
    const feasible = stock != null && pieces.every((p) => p.limitsOk);
    const L = Math.max(...pieces.map((p) => p.outerEdge));
    return {
      n, pieces, wReq, stock,
      projectedWidth: wReq, boardWidth: wReq,   // aliases (drawing / export messages)
      L, chordLength: L,                        // outer stock edge of the longest piece
      roughLength: Math.max(...pieces.map((p) => p.roughLength)),
      shorterEdge: Math.min(...pieces.map((p) => p.shorterEdge)),
      boardArea, bandArea,
      waste: boardArea ? (boardArea - bandArea) / boardArea : null,
      feasible,
      failures: pieces.flatMap((p) => p.limitFailures.map((f) => `piece ${p.k + 1} of ${n}: ${f}`)),
    };
  };
  const plans = groups.map((group, gi) => {
    const options = [];
    let fewest = null, alternative = null, blocked = null;
    for (let n = 1; n <= PLANNER_MAX_N; n++) {
      const o = evaluate(group, n);
      options.push(o);
      if (fewest) {
        if (o.feasible && o.stock < fewest.stock && !alternative) alternative = o;
        if (n >= fewest.n + 3) break;
        continue;
      }
      if (o.feasible) { fewest = o; continue; }
      // a board fits but the pieces are below a limit: more pieces are only shorter — stop here
      if (o.stock != null) { blocked = o; break; }
    }
    let def = fewest, rule = 'fewest';
    if (fewest && alternative && fewest.waste > S.wasteThreshold) { def = alternative; rule = 'economy'; }
    let reason = null;
    if (!fewest) {
      reason = blocked ? 'below minimum length' : 'no stock board fits';
    }
    const outerArcs = group.arcIndices.map((i) => ring.outer[i]);
    const span = outerArcs.reduce((s, a) => s + arcSpan(a), 0);
    return {
      index: gi,
      kind: group.kind,
      arcIndices: [...group.arcIndices],
      radii: outerArcs.map((a) => a.r),
      radiusOuter: Math.max(...outerArcs.map((a) => a.r)),
      radiusInner: Math.min(...group.arcIndices.map((i) => ring.inner[i].r)),
      span,
      spanDeg: span * 180 / Math.PI,
      length: outerArcs.reduce((s, a) => s + arcLen(a), 0),
      nMin: 1,
      nMax: options[options.length - 1].n,
      options,
      fewest,
      alternative,
      default: def,
      rule,
      reason,
      blocked,
    };
  });
  const pieces = [];
  for (const g of plans) {
    if (!g.default) continue;
    for (const p of g.default.pieces) pieces.push({ ...p, no: pieces.length + 1, group: g.index });
  }
  const noStock = plans.some((g) => !g.default);
  const reasons = plans.filter((g) => !g.default).map((g) => {
    const label = groups.length > 1 ? `side ${g.index + 1}` : 'chain';
    if (g.reason === 'below minimum length') {
      const b = g.blocked;
      return `${label}: ${b.n} piece${b.n > 1 ? 's' : ''} fit a ${b.stock} board but fall below the minimum length (${b.failures[0]})`;
    }
    const last = g.options[g.options.length - 1];
    return `${label}: no stock board fits (needs ${Math.ceil(last.wReq)}+ for ${last.n} pieces, widest ${S.maxStock})`;
  });
  return {
    arcs: plans,
    groups: plans,
    pieces,
    totalPieces: pieces.length,
    noStock,
    noStockReason: noStock ? (plans.some((g) => g.reason === 'below minimum length') ? 'below minimum length' : 'no stock board fits') : null,
    reasons,
    shortPieces: reasons,                       // compat: the PP column lists the limit failures of a blocked plan
    rule: plans.some((g) => g.rule === 'economy') ? 'economy' : 'fewest',
    stockWidths: [...S.stockWidths],
    contourAllowance: S.allowance,
    fingerLength: S.fingerLength,
    minPieceLength: S.minPieceLength,
    minClampLength: S.minClampLength,
    wasteThreshold: S.wasteThreshold,
  };
}

/**
 * Whole-window plan: geometry + segment plans for the frame head and the
 * leaf top rail, finger-joint profile, clamp numbers, member depths —
 * everything the DXF builder needs. Reads profile.arch + profile.cnc.
 */
export function buildArchPlan(input, profile) {
  if (!profile?.arch) throw new ArchError('Casement profile has no "arch" section (stock widths / finger joint)');
  if (!profile?.cnc) throw new ArchError('Casement profile has no "cnc" section (clamp length / Uniclamp)');
  const geometry = buildArchGeometry(input, profile);
  const frameHead = planArchSegments(geometry.frameHead, profile.arch, profile.cnc);
  const leafTop = planArchSegments(geometry.leafTop, profile.arch, profile.cnc);
  return {
    ...geometry,
    hinge: input.hinge === 'right' ? 'right' : 'left',
    finger: { ...profile.arch.finger },
    blank: planBlankInfo(frameHead),
    cnc: planCncInfo(profile.cnc),
    depths: { frameHead: Number(profile.frameDepth) || null, leafTop: Number(profile.leafDepth) || null },
    plans: { frameHead, leafTop },
    noStock: frameHead.noStock || leafTop.noStock,
  };
}

/** The planner settings a plan was built with (printed on the sheet). */
export function planBlankInfo(plan) {
  return { contourAllowance: plan.contourAllowance, minPieceLength: plan.minPieceLength, minClampLength: plan.minClampLength, wasteThreshold: plan.wasteThreshold };
}

/** The clamp numbers a plan was built with (CLAMPS layer). */
export function planCncInfo(cnc) {
  return { clamp: { ...(cnc?.clamp || {}) }, clampClearance: Number(cnc?.clampClearance) };
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
  // circle (v3 Block 3): two vertices on the horizontal diameter, bulge 1 = half circles
  if (outline.kind === CIRCLE_SHAPE) return [[Wg, outline.centre[1], 1], [0, outline.centre[1], 1]];
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
 *   quad-hub-spoke     workshop preset (arka_CNC-piotr.dxf): rings 1/3 · 2/3 of xg,
 *                      5 spokes (45°), the vertical spoke runs through the hub
 *   custom             { spokes 3–9, rings [fractions] } from the window spec
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
export function buildArchBars({ outline, shape, pattern = 'none', h = 0, v = 0, frameHalfWidth, spokes, rings }, patternOpts) {
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
    // generic hubSpoke({ spokes, rings, hubVertical }) — presets or the user's custom numbers
    let def;
    if (pat === 'custom') {
      const n = Math.floor(Number(spokes));
      const rr = Array.isArray(rings) ? rings.map(Number) : [];
      if (!(n >= CUSTOM_HUB_LIMITS.minSpokes && n <= CUSTOM_HUB_LIMITS.maxSpokes)) throw new ArchError(`Custom hub: spoke count must be ${CUSTOM_HUB_LIMITS.minSpokes}–${CUSTOM_HUB_LIMITS.maxSpokes}, got "${spokes}"`);
      if (!rr.length || rr.length > CUSTOM_HUB_LIMITS.maxRings || !rr.every((k) => k > 0 && k < 1)) throw new ArchError(`Custom hub: rings must be 1–${CUSTOM_HUB_LIMITS.maxRings} fractions of the half width (0 < k < 1), got "${rings}"`);
      def = { spokes: n, ringRatios: [...rr].sort((a, b) => a - b), hubVertical: false };
    } else {
      const P = HUB_PRESETS[pat];
      def = { spokes: P.spokes, ringRatios: P.ringRatios || S.ratios.slice(0, P.rings), hubVertical: P.hubVertical };
    }
    const ringR = def.ringRatios.map((k) => k * xg);
    const c = [xg, ys];
    if (def.spokes === 0) {
      straight('springing', 0, ys, Wg, ys);                            // half-hub: the springing bar + ring 1
      arcBar('ring', { cx: c[0], cy: c[1], r: ringR[0], a0: 0, a1: Math.PI });
    } else {
      for (const rk of ringR) arcBar('ring', { cx: c[0], cy: c[1], r: rk, a0: 0, a1: Math.PI });
      const bounds = [...ringR, arcs[0].r];                           // ring → ring → outline (semi-circle radius = xg)
      for (let i = 0; i < def.spokes; i++) {
        const ang = (i / (def.spokes - 1)) * Math.PI;
        const onLine = i === 0 || i === def.spokes - 1;               // the end spokes lie on the springing line
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let k = 0; k < bounds.length - 1; k++) {
          const r0 = bounds[k], r1s = bounds[k + 1];
          straight(onLine ? 'springing' : 'spoke', c[0] + r0 * ca, c[1] + r0 * sa, c[0] + r1s * ca, c[1] + r1s * sa);
        }
        // workshop preset: the vertical spoke continues through the hub to the springing line (DWG)
        if (def.hubVertical && Math.abs(ang - Math.PI / 2) < 1e-9) straight('spoke', c[0], c[1], c[0], c[1] + ringR[0]);
      }
      // PSW 875–886: every ring end continues straight down to the glass bottom
      for (const rk of ringR) {
        if (!(ys > 0)) break;
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

// ═══════════════════════════════════════════════════════════════════════════
// CIRCLE — fixed window (ARCHED-WINDOWS-v3 Block 3, Piotr 07.09)
//
// The frame and the leaf are full rings, no springing, no straight member:
// the "arch frame" here has its origin at the CIRCLE CENTRE (the chains of
// an arch start on the springing line; a circle's two half-arcs start on the
// horizontal diameter at (R, 0) and run counter-clockwise — upper half 0 → π,
// lower half π → 2π — so every chain helper (offsetArcs, buildRing, ringPoly,
// planArchSegments, chainPoly) works unchanged). Radii per the casement
// profile faces exactly like the arch: frame ring 0 → frameHead.face, leaf
// ring leafAtJamb → leafAtJamb + leafTop.face, glass at leafInner − glassInset
// (800 circle: 400 / 343, 360 / 293, glass 305.5).
// ═══════════════════════════════════════════════════════════════════════════

/** Two half-arcs of a full circle, radius r, centre (0, 0): upper 0 → π, lower π → 2π. */
export function circleArcs(r) {
  const R = Number(r);
  if (!(R > 0)) throw new ArchError(`Circle radius must be positive, got ${r}`);
  return [{ cx: 0, cy: 0, r: R, a0: 0, a1: Math.PI }, { cx: 0, cy: 0, r: R, a0: Math.PI, a1: 2 * Math.PI }];
}

/**
 * Circle geometry from the casement profile — the same fields as
 * buildArchGeometry so the CNC drawing, the FIT row and the sheets read one
 * object. `height` must equal `width` (the configurator locks it); `rise`
 * and `start` are the radius (the horizontal diameter sits at H / 2).
 */
export function buildCircleGeometry({ width, height }, profile) {
  if (!profile?.elements?.frameHead || !profile?.elements?.leafTop || !profile?.deductions || !profile?.geometry) {
    throw new ArchError('Casement profile is missing the frameHead / leafTop / deductions / geometry sections');
  }
  const L = readArchLimits(profile.arch?.limits);
  const W = Number(width);
  if (!(W >= L.minWidth && W <= L.maxWidth)) throw new ArchError(`Circle diameter ${r1(W)}mm is outside ${L.minWidth}–${L.maxWidth}mm`);
  if (height != null && height !== '' && Math.abs(Number(height) - W) > 0.5) {
    throw new ArchError(`A circle window is ${r1(W)} wide but ${r1(Number(height))} high — the height must equal the diameter`);
  }
  const R = W / 2;
  const base = circleArcs(R);
  const tFrame = Number(profile.elements.frameHead.face);
  const leafInset = Number(profile.deductions.leafAtJamb);
  const tLeaf = Number(profile.elements.leafTop.face);
  const glassInset = Number(profile.geometry.glassInset);
  const land = Number(profile.geometry.land);
  const gap = Number(profile.geometry.gap);
  if (!(land > 0 && gap >= 0)) throw new ArchError('Casement profile geometry.land / geometry.gap are missing');
  const glassOffset = leafInset + tLeaf - glassInset;
  if (!(R - glassOffset > 0)) throw new ArchError(`Circle diameter ${r1(W)}mm leaves no glass (offset ${r1(glassOffset)} per side)`);
  const frameHead = buildRing(base, 0, tFrame, 'FRAME RING');
  const leafTop = buildRing(base, leafInset, leafInset + tLeaf, 'LEAF RING');
  const glassArcs = offsetArcs(base, glassOffset);
  return {
    shape: CIRCLE_SHAPE,
    label: 'Circle',
    width: W,
    rise: R,
    start: R,                                   // the horizontal diameter from the cill line
    straightHeight: R,
    leafStraightStile: 0,
    limits: L,
    minHaunchRadius: null,
    radii: [R],
    arcs: base,
    offsets: { frameInner: tFrame, leafOuter: leafInset, leafInner: leafInset + tLeaf, glass: glassOffset, land },
    frameHead,
    leafTop,
    rebateWall: offsetArcs(base, land),
    fit: { gap, lap: tFrame - leafInset, land },
    glass: { arcs: glassArcs, length: arcsLength(glassArcs), apex: R - glassOffset, halfWidth: R - glassOffset, radius: R - glassOffset },
  };
}

/**
 * Glass outline of a circle unit in the GLASS frame (unit bottom-left, y up):
 * the two half-arcs centred at (rg, rg). `springing` = rg (the horizontal
 * diameter) so the shared helpers that move the outline back to the arch
 * frame (glassEdgeArcs) land on the circle centre; `kind: 'circle'` tells
 * the contour helpers there is no straight edge.
 */
export function buildCircleGlassOutline(glassArcs) {
  const rg = glassArcs[0].r;
  const arcs = glassArcs.map((a) => ({ ...a, cx: a.cx + rg, cy: a.cy + rg }));
  return {
    kind: CIRCLE_SHAPE,
    width: 2 * rg,
    height: 2 * rg,
    springing: rg,
    apex: 2 * rg,
    rise: rg,
    radius: rg,
    centre: [rg, rg],
    arcs,
    radii: [rg],
    archLength: 2 * Math.PI * rg,
    archArea: Math.PI * rg * rg,
    area: Math.PI * rg * rg,
    perimeter: 2 * Math.PI * rg,
  };
}

/**
 * Glazing bars in a circle unit (v3 Block 3), glass frame — PSW 3d-src
 * FixFrameWindow.jsx CircleFrame ported on the exact circle:
 *   h / v      chords at equal divisions of the diameter (PSW: −rInner + D·i/(n+1))
 *   sunburst   one ring at rg − offset (profile arch.patterns.sunburst.offset,
 *              or the window's circleOffset), `spokes` spokes from the ring
 *              to the glass edge at i·360°/spokes from the right (PSW: angle
 *              i/6·2π); the user's h / v are drawn as chords across the ring
 *              (PSW draws them too)
 */
export function buildCircleBars({ outline, pattern = 'none', h = 0, v = 0, circleOffset }, patternOpts) {
  const pat = pattern || 'none';
  if (!patternsForShape(CIRCLE_SHAPE).includes(pat)) throw new ArchError(`Bar pattern "${pat}" is not available on a circle (allowed: ${patternsForShape(CIRCLE_SHAPE).join(', ')})`);
  const rg = outline.radius, [cx, cy] = outline.centre;
  const nH = Math.max(0, Math.floor(Number(h) || 0));
  const nV = Math.max(0, Math.floor(Number(v) || 0));
  const bars = [];
  const r05 = (val) => Math.round(val * 2) / 2;
  const straight = (role, x0, y0, x1, y1) => bars.push({ kind: 'straight', role, from: [x0, y0], to: [x1, y1], length: r05(Math.hypot(x1 - x0, y1 - y0)) });
  const chord = (d) => Math.sqrt(Math.max(0, rg * rg - d * d));          // half chord at distance d from the centre
  for (let j = 1; j <= nH; j++) {
    const y = -rg + (2 * rg * j) / (nH + 1);
    const hc = chord(y);
    if (hc > 1e-6) straight('h', cx - hc, cy + y, cx + hc, cy + y);
  }
  for (let i = 1; i <= nV; i++) {
    const x = -rg + (2 * rg * i) / (nV + 1);
    const hc = chord(x);
    if (hc > 1e-6) straight('v', cx + x, cy - hc, cx + x, cy + hc);
  }
  if (pat === 'sunburst') {
    const S = patternOpts?.sunburst || {};
    const offset = Number(circleOffset ?? S.offset);
    const n = Math.floor(Number(S.spokes));
    if (!(offset > 0)) throw new ArchError('Casement profile arch.patterns.sunburst.offset is missing (ring inset from the glass edge, mm)');
    if (!(n >= 3)) throw new ArchError('Casement profile arch.patterns.sunburst.spokes is missing (>= 3)');
    const rr = rg - offset;
    if (!(rr > 30)) throw new ArchError(`Sunburst ring radius ${r1(rr)}mm is too small (glass R ${r1(rg)} − offset ${r1(offset)}; PSW hides it below 30)`);
    bars.push({ kind: 'arc', role: 'ring', arc: { cx, cy, r: rr, a0: 0, a1: Math.PI }, from: [cx + rr, cy], to: [cx - rr, cy], length: r05(Math.PI * rr) });
    bars.push({ kind: 'arc', role: 'ring', arc: { cx, cy, r: rr, a0: Math.PI, a1: 2 * Math.PI }, from: [cx - rr, cy], to: [cx + rr, cy], length: r05(Math.PI * rr) });
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 2 * Math.PI;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      straight('spoke', cx + rr * ca, cy + rr * sa, cx + rg * ca, cy + rg * sa);
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
    counts: { h: nH, v: nV },
    bars,
    totalLength: bars.reduce((s, b) => s + b.length, 0),
    byRole: bars.reduce((m, b) => { m[b.role] = (m[b.role] || 0) + 1; return m; }, {}),
  };
}

/** Circle plan for the CNC drawing (same shape as buildArchPlan; kind 'circle', no hinge). */
export function buildCirclePlan(input, profile) {
  if (!profile?.arch) throw new ArchError('Casement profile has no "arch" section (stock widths / finger joint)');
  if (!profile?.cnc) throw new ArchError('Casement profile has no "cnc" section (clamp length / Uniclamp)');
  const geometry = buildCircleGeometry(input, profile);
  const frameHead = planArchSegments(geometry.frameHead, profile.arch, profile.cnc);
  const leafTop = planArchSegments(geometry.leafTop, profile.arch, profile.cnc);
  return {
    ...geometry,
    kind: 'circle',
    hinge: null,
    finger: { ...profile.arch.finger },
    blank: planBlankInfo(frameHead),
    cnc: planCncInfo(profile.cnc),
    depths: { frameHead: Number(profile.frameDepth) || null, leafTop: Number(profile.leafDepth) || null },
    plans: { frameHead, leafTop },
    noStock: frameHead.noStock || leafTop.noStock,
  };
}
