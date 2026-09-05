/**
 * arch.js — arched casement head: geometry + segment planner (arched-casement-v1).
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
 * Shapes (centres sit on the arch-start line unless stated):
 *   segmental           1 centre, below the line; rise < W/2
 *   semi-circle         1 centre, R = W/2, rise = W/2 (fixed by the shape)
 *   gothic-equilateral  2 centres at the opposite arch-start points, R = W
 *   gothic-drop         2 centres inside the span, W/2 < rise < W·√3/2
 *   three-centre        2 haunch centres on the line + 1 crown centre below it
 *
 * Workshop numbers (member faces, leaf inset, glass inset, finger joint,
 * board stock) come from the casement profile — none are hard-coded here.
 * Shape defaults quoted from PSW: js/price-calculator.js (window.ArchedSash,
 * RISE_RATIO / GOTHIC_PROFILE_RATIO / MIN_WIDTH / MAX_WIDTH).
 */

const TAU = Math.PI * 2;

export class ArchError extends Error {
  constructor(message) { super(message); this.name = 'ArchError'; }
}

export const ARCH_SHAPES = Object.freeze([
  'segmental', 'semi-circle', 'gothic-equilateral', 'gothic-drop', 'three-centre',
]);

export const ARCH_SHAPE_LABELS = Object.freeze({
  'segmental': 'Segmental',
  'semi-circle': 'Semi-circle',
  'gothic-equilateral': 'Gothic equilateral',
  'gothic-drop': 'Gothic drop',
  'three-centre': 'Three-centre',
});

// PSW casArchShape → PC shape. PSW "elliptical" is drawn as an ellipse in the
// 3D preview; a workshop cannot rout an ellipse from concentric arcs, so it is
// built as the classic three-centre approximation.
export const PSW_ARCH_SHAPE = Object.freeze({
  'gothic-arch': 'gothic-equilateral',
  'semi-circle': 'semi-circle',
  'segmental-arch': 'segmental',
  'elliptical-arch': 'three-centre',
});

// Default rise as a fraction of the external frame width — PSW
// js/price-calculator.js RISE_RATIO (segmental 0.20, elliptical 0.325,
// semi-circle 0.50, gothic √3/2) and GOTHIC_PROFILE_RATIO.drop (0.70).
export const ARCH_RISE_RATIO = Object.freeze({
  'segmental': 0.20,
  'semi-circle': 0.5,
  'gothic-equilateral': Math.sqrt(3) / 2,
  'gothic-drop': 0.70,
  'three-centre': 0.325,
});

// Validity limits. Width: PSW MIN_WIDTH / MAX_WIDTH (O5). Rise ratios bound
// the shapes whose rise is free: a segmental at 0.5 IS a semi-circle, a drop
// arch lives strictly between the semi-circle (0.5) and the equilateral
// (0.866), a three-centre at 0.5 degenerates into a semi-circle.
export const ARCH_LIMITS = Object.freeze({
  minWidth: 400,
  maxWidth: 1500,
  riseRatio: Object.freeze({
    'segmental': [0.10, 0.45],
    'gothic-drop': [0.55, 0.85],
    'three-centre': [0.15, 0.45],
  }),
});

// Three-centre: haunch (side) radius as a fraction of the rise. The crown
// radius follows from tangency, so this one ratio fixes the whole curve.
export const THREE_CENTRE_HAUNCH_RATIO = 0.5;

export function isArchShape(shape) { return ARCH_SHAPES.includes(shape); }

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Resolve the arch rise (mm). Explicit rise wins where the shape allows it;
 * shapes with a fixed rise (semi-circle, gothic equilateral) reject any other
 * value instead of silently overriding it.
 */
export function resolveArchRise(shape, width, rise) {
  if (!isArchShape(shape)) throw new ArchError(`Unknown arch shape "${shape}"`);
  const W = Number(width);
  if (!(W >= ARCH_LIMITS.minWidth)) throw new ArchError(`Arch width ${W}mm is below the minimum ${ARCH_LIMITS.minWidth}mm`);
  if (!(W <= ARCH_LIMITS.maxWidth)) throw new ArchError(`Arch width ${W}mm is above the maximum ${ARCH_LIMITS.maxWidth}mm`);
  const label = ARCH_SHAPE_LABELS[shape];
  const def = ARCH_RISE_RATIO[shape] * W;
  if (rise == null || rise === '') return def;
  const h = Number(rise);
  if (!(h > 0)) throw new ArchError(`Arch rise must be a positive number of mm, got "${rise}"`);
  const bounds = ARCH_LIMITS.riseRatio[shape];
  if (!bounds) {
    if (Math.abs(h - def) > 0.5) throw new ArchError(`${label} rise is fixed by the shape at ${r1(def)}mm (got ${h}mm)`);
    return def;
  }
  const [lo, hi] = bounds;
  if (h / W < lo - 1e-9) throw new ArchError(`${label} rise ${h}mm is below the minimum ${r1(lo * W)}mm (${lo} × width)`);
  if (h / W > hi + 1e-9) throw new ArchError(`${label} rise ${h}mm is above the maximum ${r1(hi * W)}mm (${hi} × width)`);
  return h;
}

/**
 * Outer contour arcs for a shape. Each arc: { cx, cy, r, a0, a1, clip0, clip1 }
 * with a0 < a1 (counter-clockwise). clip0/clip1 say how that end of the arc is
 * bounded, which is what an offset has to recompute:
 *   'archStart' — the arc ends on the arch-start line (y = 0)
 *   'axis'      — the arc ends on the window axis (x = 0): pointed apex
 *   null        — tangent joint with the neighbouring arc (stays radial)
 */
export function archArcs(shape, width, rise) {
  const W = Number(width), h = Number(rise), hw = W / 2;
  switch (shape) {
    case 'segmental': {
      const R = (hw * hw + h * h) / (2 * h);
      const d = R - h;                         // centre depth below the arch-start line
      const a = Math.atan2(d, hw);             // right arch-start point seen from the centre
      return [{ cx: 0, cy: -d, r: R, a0: a, a1: Math.PI - a, clip0: 'archStart', clip1: 'archStart' }];
    }
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
      const r = h * THREE_CENTRE_HAUNCH_RATIO;
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
 */
export function buildArchGeometry({ shape, width, height, rise }, profile) {
  if (!profile?.elements?.frameHead || !profile?.elements?.leafTop || !profile?.deductions || !profile?.geometry) {
    throw new ArchError('Casement profile is missing the frameHead / leafTop / deductions / geometry sections');
  }
  const W = Number(width);
  const h = resolveArchRise(shape, W, rise);
  if (height != null && height !== '') {
    const H = Number(height);
    if (!(H - h > 0)) throw new ArchError(`Arch rise ${r1(h)}mm leaves no straight part in a ${H}mm high window`);
  }
  const base = archArcs(shape, W, h);
  const tFrame = Number(profile.elements.frameHead.face);
  const leafInset = Number(profile.deductions.leafAtJamb);
  const tLeaf = Number(profile.elements.leafTop.face);
  const glassInset = Number(profile.geometry.glassInset);
  const frameHead = buildRing(base, 0, tFrame, 'FRAME HEAD');
  const leafTop = buildRing(base, leafInset, leafInset + tLeaf, 'LEAF TOP');
  const glassOffset = leafInset + tLeaf - glassInset;
  const glassArcs = offsetArcs(base, glassOffset);
  return {
    shape,
    label: ARCH_SHAPE_LABELS[shape],
    width: W,
    rise: h,
    straightHeight: height != null && height !== '' ? Number(height) - h : null,
    arcs: base,
    offsets: { frameInner: tFrame, leafOuter: leafInset, leafInner: leafInset + tLeaf, glass: glassOffset },
    frameHead,
    leafTop,
    glass: { arcs: glassArcs, length: arcsLength(glassArcs), apex: arcsExtent(glassArcs, [0, 1]).max },
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
  const band = allowanceBand(ring, S.allowance);
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
