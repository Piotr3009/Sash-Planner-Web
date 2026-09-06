/**
 * traceryExport.js — timber tracery over the arched sealed unit: DXF + LSP in
 * the workshop's `arka` convention (ARCHED-WINDOWS-v3 Block 0.4).
 *
 * WHAT IT IS (Piotr 07.09): the window has ONE arched sealed unit with an
 * 18 mm spacer bar laid out in the pattern (glazier exports, unchanged). Over
 * the glass sits a timber tracery cut from ONE board on the CNC, applied on
 * ONE side; its openings are the pane daylights and the bead profile R8 runs
 * along every opening edge. It looks divided — it is not.
 *
 * REFERENCE: docs/handover/workshop/arka_CNC-piotr.dxf (one quadrant, R 600,
 * quad-hub-spoke). Wherever the analysis package (arka-lsp-package) differs
 * from the drawing the DRAWING wins — the known case is the corner guides:
 * each MITRE leg runs 15 mm along the pane's own +10 limit edge INTO the pane
 * (DWG corner (−3510.46, 1888.02) → legs to (−3499.85, 1877.41) and
 * (−3520.84, 1877.19)); the package puts them the other way round.
 *
 * GEOMETRY (all numbers from profile.tracery — nothing hard-coded here):
 *   board outline  = the leaf's glass DAYLIGHT (leaf-top ring inner edge,
 *                    stiles' inner edges, bottom rail inner edge)
 *   pane daylights = the board cut by the bar AXES (derived.arch.bars) with
 *                    the TIMBER bar width 2·(paneOffset + profileWidth) +
 *                    ridgeLand (= 22, not the 18 spacer): every pane is the
 *                    board face offset inward by barWidth/2 from every bar
 *                    axis and by edgeMargin = paneOffset + profileWidth +
 *                    edgeLand (= 18) from the board edge
 *   +2 / +10       = the pane offset outward by paneOffset / paneOffset +
 *                    profileWidth (the VCarve rail / the bead limit)
 *   corner guides  = at every real corner (tangent difference > 0.5°) of a
 *                    +10 contour: apex = the corner, two legs mitreLeg (15)
 *                    along the two edges into the pane, arcs keep their bulge
 *   section        = ONE open polyline (0,0) → arc R8 (bulge
 *                    −0.414213562373095) → (8,8) → (8,14), verbatim from the
 *                    workshop drawing (LINE 4E9 + ARC 4EA translated) — never
 *                    parametrised
 *   quadrant       = symmetric windows are drawn as the LEFT half (the
 *                    operator mirrors, as the DWG); a window where a pane
 *                    straddles the axis is drawn in full
 *
 * Offsets are exact: a straight edge shifts by d, an arc keeps its centre
 * (r ± d), corners are the intersection of the two offset edges nearest the
 * original corner. Panes are found as the faces of the planar arrangement of
 * the board curves and the bar axes (lines + circular arcs, split at their
 * intersections, dangling stubs pruned, faces walked with the interior on
 * the left).
 *
 * Coordinates: mm, y up; the engine path works in the GLASS frame (unit
 * bottom-left = 0,0 — the same frame as the glazier DXF); the harness feeds
 * the workshop drawing's own coordinates. Entities use the dxfWriter model
 * ({poly|point|text}); the LSP is generated from the SAME entity list.
 */
import { ArchError } from '../arch.js';
import { glassEdgeArcs } from '../glassBars.js';

const TAU = Math.PI * 2;
const EPS = 1e-6;
const VERTEX_TOL = 1e-4;
const TANGENT_TOL_DEG = 0.5;

export const TRACERY_LAYERS = Object.freeze([
  { name: 'ARKA_OUTLINE',          color: 7 },   // pane daylights + board outline (what touches timber)
  { name: 'ARKA_PANE',             color: 3 },   // pane +paneOffset: the VCarve moulding rail
  { name: 'ARKA_FRONT_HINGES_3MM', color: 50 },  // pane +paneOffset+profileWidth: the bead limit (legacy source name, not drilling)
  { name: 'ARKA_MITRE',            color: 1 },   // corner guides
  { name: 'ARKA_SECTION',          color: 5 },   // the bead cross-section (verbatim)
  { name: 'ARKA_PANE_ZEWN_REF',    color: 3 },   // board outline −paneOffset: reference for the outer rail
  { name: 'ARKA_CENTRE',           color: 6 },   // arc centres
  { name: 'ARKA_INFO_NO_CUT',      color: 8 },   // texts — never machined
]);

/** The bead cross-section, verbatim from the workshop drawing (never parametrised). */
export const SECTION_POLY = Object.freeze([[0, 0, -0.414213562373095], [8, 8, 0], [8, 14, 0]]);

export const TRACERY_TEXT = Object.freeze({ textH: 15, lineH: 22, gap: 100 });

// ── profile ─────────────────────────────────────────────────────────────────
export function readTraceryProfile(profile) {
  const t = profile?.tracery;
  const n = (k) => Number(t?.[k]);
  const paneOffset = n('paneOffset'), profileWidth = n('profileWidth'), ridgeLand = n('ridgeLand'), edgeLand = n('edgeLand'), mitreLeg = n('mitreLeg');
  const sides = Math.max(1, Math.round(n('sides') || 0));
  const boardThickness = n('boardThickness');
  if (!(paneOffset >= 0 && profileWidth > 0 && ridgeLand >= 0 && edgeLand >= 0 && mitreLeg > 0 && boardThickness > 0)) {
    throw new ArchError('Casement profile tracery block is missing (paneOffset / profileWidth / ridgeLand / edgeLand / mitreLeg / boardThickness)');
  }
  return {
    paneOffset, profileWidth, ridgeLand, edgeLand, mitreLeg, sides, boardThickness,
    barWidth: 2 * (paneOffset + profileWidth) + ridgeLand,      // 22 on the workshop numbers
    edgeMargin: paneOffset + profileWidth + edgeLand,          // 18
    limitOffset: paneOffset + profileWidth,                    // 10
  };
}

// ── curves ──────────────────────────────────────────────────────────────────
// line: { kind:'line', p, q, tag }        arc: { kind:'arc', c, r, a0, a1, tag } (a0 < a1, counter-clockwise)
export const lineCurve = (p, q, tag) => ({ kind: 'line', p: [p[0], p[1]], q: [q[0], q[1]], tag });
export const arcCurve = (c, r, a0, a1, tag) => ({ kind: 'arc', c: [c[0], c[1]], r, a0, a1, tag });

const norm = (a) => { let x = a % TAU; if (x < 0) x += TAU; return x; };
const angleIn = (arc, ang) => {
  // is angle `ang` inside [a0, a1] (mod 2π)?
  const span = arc.a1 - arc.a0;
  const rel = norm(ang - arc.a0);
  return rel <= span + 1e-9 || rel >= TAU - 1e-9;
};
const arcParam = (arc, ang) => { const rel = norm(ang - arc.a0); return (rel >= TAU - 1e-9 ? 0 : rel) / (arc.a1 - arc.a0); };

export function pointAt(cv, t) {
  if (cv.kind === 'line') return [cv.p[0] + (cv.q[0] - cv.p[0]) * t, cv.p[1] + (cv.q[1] - cv.p[1]) * t];
  const a = cv.a0 + (cv.a1 - cv.a0) * t;
  return [cv.c[0] + cv.r * Math.cos(a), cv.c[1] + cv.r * Math.sin(a)];
}
export const curveLength = (cv) => (cv.kind === 'line' ? Math.hypot(cv.q[0] - cv.p[0], cv.q[1] - cv.p[1]) : cv.r * (cv.a1 - cv.a0));

/** Sub-curve between parameters t0 < t1. */
function subCurve(cv, t0, t1) {
  if (cv.kind === 'line') return { ...cv, p: pointAt(cv, t0), q: pointAt(cv, t1) };
  const span = cv.a1 - cv.a0;
  return { ...cv, a0: cv.a0 + span * t0, a1: cv.a0 + span * t1 };
}

function lineLine(A, B) {
  const d1 = [A.q[0] - A.p[0], A.q[1] - A.p[1]], d2 = [B.q[0] - B.p[0], B.q[1] - B.p[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-12) return [];
  const w = [B.p[0] - A.p[0], B.p[1] - A.p[1]];
  const t1 = (w[0] * d2[1] - w[1] * d2[0]) / den;
  const t2 = (w[0] * d1[1] - w[1] * d1[0]) / den;
  return [{ t1, t2 }];
}

function lineCircle(L, c, r) {
  const d = [L.q[0] - L.p[0], L.q[1] - L.p[1]];
  const f = [L.p[0] - c[0], L.p[1] - c[1]];
  const a = d[0] * d[0] + d[1] * d[1];
  const b = 2 * (f[0] * d[0] + f[1] * d[1]);
  const cc = f[0] * f[0] + f[1] * f[1] - r * r;
  let disc = b * b - 4 * a * cc;
  if (disc < -1e-9 * Math.max(1, r * r)) return [];
  disc = Math.max(disc, 0);
  const s = Math.sqrt(disc);
  const out = [(-b - s) / (2 * a), (-b + s) / (2 * a)];
  return s < 1e-12 ? [out[0]] : out;
}

function circleCircle(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-9) || d > r1 + r2 + 1e-7 || d < Math.abs(r1 - r2) - 1e-7) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const px = c1[0] + a * dx / d, py = c1[1] + a * dy / d;
  const ox = -dy / d * h, oy = dx / d * h;
  return h > 1e-9 ? [[px + ox, py + oy], [px - ox, py - oy]] : [[px, py]];
}

/** Parameters (t on A, t on B) of every intersection of two curves, including their end points (T-junctions). */
export function intersections(A, B) {
  const out = [];
  const push = (t1, t2) => {
    if (t1 < -1e-7 || t1 > 1 + 1e-7 || t2 < -1e-7 || t2 > 1 + 1e-7) return;
    out.push({ t1: Math.min(1, Math.max(0, t1)), t2: Math.min(1, Math.max(0, t2)) });
  };
  if (A.kind === 'line' && B.kind === 'line') {
    for (const { t1, t2 } of lineLine(A, B)) push(t1, t2);
  } else if (A.kind === 'line' || B.kind === 'line') {
    const L = A.kind === 'line' ? A : B, R = A.kind === 'line' ? B : A;
    for (const tl of lineCircle(L, R.c, R.r)) {
      const p = pointAt(L, tl);
      const ang = Math.atan2(p[1] - R.c[1], p[0] - R.c[0]);
      if (!angleIn(R, ang)) continue;
      const ta = arcParam(R, ang);
      if (A.kind === 'line') push(tl, ta); else push(ta, tl);
    }
  } else {
    for (const p of circleCircle(A.c, A.r, B.c, B.r)) {
      const angA = Math.atan2(p[1] - A.c[1], p[0] - A.c[0]);
      const angB = Math.atan2(p[1] - B.c[1], p[0] - B.c[0]);
      if (!angleIn(A, angA) || !angleIn(B, angB)) continue;
      push(arcParam(A, angA), arcParam(B, angB));
    }
  }
  return out;
}

// ── arrangement ─────────────────────────────────────────────────────────────
class VertexSet {
  constructor() { this.list = []; }
  get(p) {
    for (const v of this.list) if (Math.abs(v.p[0] - p[0]) <= VERTEX_TOL && Math.abs(v.p[1] - p[1]) <= VERTEX_TOL) return v;
    const v = { id: this.list.length, p: [p[0], p[1]], out: [] };
    this.list.push(v);
    return v;
  }
}

/** Tangent direction (angle) of a curve at parameter t, travelling forward (reverse = false) or backward. */
function tangentAngle(cv, t, reverse) {
  let ang;
  if (cv.kind === 'line') ang = Math.atan2(cv.q[1] - cv.p[1], cv.q[0] - cv.p[0]);
  else ang = cv.a0 + (cv.a1 - cv.a0) * t + Math.PI / 2;
  return norm(reverse ? ang + Math.PI : ang);
}
/** Signed curvature seen from the direction of travel (left turn positive). */
const curvatureOf = (cv, reverse) => (cv.kind === 'line' ? 0 : (reverse ? -1 : 1) / cv.r);

/**
 * Faces of the arrangement of `curves`: [{ edges: [{ curve, reverse, from, to }], area }]
 * with the interior on the left (bounded faces have area > 0). Dangling
 * edges (degree-1 vertices, e.g. a bar stub outside the board) are pruned.
 */
export function arrangementFaces(curves) {
  // 1. split every curve at every intersection
  const cuts = curves.map(() => new Set([0, 1]));
  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      for (const { t1, t2 } of intersections(curves[i], curves[j])) { cuts[i].add(t1); cuts[j].add(t2); }
    }
  }
  const V = new VertexSet();
  let segs = [];
  curves.forEach((cv, i) => {
    const ts = [...cuts[i]].sort((a, b) => a - b);
    for (let k = 0; k < ts.length - 1; k++) {
      if (ts[k + 1] - ts[k] < 1e-9) continue;
      const sc = subCurve(cv, ts[k], ts[k + 1]);
      if (curveLength(sc) < 1e-6) continue;
      const a = V.get(pointAt(sc, 0)), b = V.get(pointAt(sc, 1));
      if (a === b) continue;
      segs.push({ curve: sc, a, b });
    }
  });
  // 1b. overlapping collinear / concentric pieces (a springing bar on the board's
  //     bottom edge, the quadrant axis on a vertical bar) are ONE segment; a
  //     board tag wins so the offset stays the edge margin
  const segKey = (s) => {
    const [a, b] = s.a.id < s.b.id ? [s.a, s.b] : [s.b, s.a];
    const g = s.curve.kind === 'line' ? 'l' : `a${s.curve.c[0].toFixed(4)},${s.curve.c[1].toFixed(4)},${s.curve.r.toFixed(4)}`;
    // the mid-point tells the two halves of a full circle (same ends, same circle) apart
    const m = pointAt(s.curve, 0.5);
    return `${a.id}|${b.id}|${g}|${m[0].toFixed(3)},${m[1].toFixed(3)}`;
  };
  const uniq = new Map();
  for (const s of segs) {
    const k = segKey(s);
    const prev = uniq.get(k);
    if (!prev) uniq.set(k, s);
    else if (prev.curve.tag !== 'board' && s.curve.tag === 'board') uniq.set(k, s);
  }
  segs = [...uniq.values()];
  // 2. prune dangling stubs (degree-1 vertices) until stable
  let changed = true;
  while (changed) {
    changed = false;
    const deg = new Map();
    for (const s of segs) { deg.set(s.a, (deg.get(s.a) || 0) + 1); deg.set(s.b, (deg.get(s.b) || 0) + 1); }
    const keep = segs.filter((s) => deg.get(s.a) > 1 && deg.get(s.b) > 1);
    if (keep.length !== segs.length) { segs = keep; changed = true; }
  }
  // 3. half-edges
  const H = [];
  for (const s of segs) {
    const h1 = { curve: s.curve, reverse: false, from: s.a, to: s.b, twin: null, visited: false };
    const h2 = { curve: s.curve, reverse: true, from: s.b, to: s.a, twin: h1, visited: false };
    h1.twin = h2;
    H.push(h1, h2);
  }
  for (const v of V.list) v.out = [];
  for (const h of H) {
    h.ang = tangentAngle(h.curve, h.reverse ? 1 : 0, h.reverse);
    h.kappa = curvatureOf(h.curve, h.reverse);
    h.from.out.push(h);
  }
  for (const v of V.list) v.out.sort((x, y) => (Math.abs(x.ang - y.ang) > 1e-9 ? x.ang - y.ang : x.kappa - y.kappa));
  // 4. walk faces: next = the outgoing edge immediately clockwise from the twin
  const faces = [];
  for (const h0 of H) {
    if (h0.visited) continue;
    const edges = [];
    let h = h0;
    let guard = 0;
    while (!h.visited && guard++ < 100000) {
      h.visited = true;
      edges.push(h);
      const out = h.to.out;
      const idx = out.indexOf(h.twin);
      h = out[(idx - 1 + out.length) % out.length];
    }
    faces.push({ edges: edges.map((e) => ({ curve: e.curve, reverse: e.reverse, from: e.from.p, to: e.to.p })), area: loopArea(edges.map((e) => ({ curve: e.curve, reverse: e.reverse }))) });
  }
  return faces;
}

/** Signed area of a loop of directed curves (Green's theorem, exact for arcs). */
export function loopArea(edges) {
  let s = 0;
  for (const e of edges) {
    const cv = e.curve;
    if (cv.kind === 'line') {
      const p = e.reverse ? cv.q : cv.p, q = e.reverse ? cv.p : cv.q;
      s += p[0] * q[1] - q[0] * p[1];
    } else {
      const a0 = e.reverse ? cv.a1 : cv.a0, a1 = e.reverse ? cv.a0 : cv.a1;
      const d = a1 - a0;
      // ∫ x dy − y dx over the arc = r² d + cx·r·(sin a1 − sin a0) − cy·r·(cos a1 − cos a0)
      s += cv.r * cv.r * d + cv.c[0] * cv.r * (Math.sin(a1) - Math.sin(a0)) - cv.c[1] * cv.r * (Math.cos(a1) - Math.cos(a0));
    }
  }
  return s / 2;
}

// ── offsetting a face ───────────────────────────────────────────────────────
/** Offset one directed edge to its LEFT by d (d < 0 = to the right). Returns a directed curve {kind, ...} with `reverse` folded in. */
function offsetEdge(e, d) {
  const cv = e.curve;
  if (cv.kind === 'line') {
    const p = e.reverse ? cv.q : cv.p, q = e.reverse ? cv.p : cv.q;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const nx = -(q[1] - p[1]) / len * d, ny = (q[0] - p[0]) / len * d;
    return { kind: 'line', p: [p[0] + nx, p[1] + ny], q: [q[0] + nx, q[1] + ny], dir: [(q[0] - p[0]) / len, (q[1] - p[1]) / len] };
  }
  // counter-clockwise travel: the left is towards the centre (r − d); clockwise: away (r + d)
  const r = e.reverse ? cv.r + d : cv.r - d;
  if (!(r > 1e-6)) return null;
  return { kind: 'arc', c: [cv.c[0], cv.c[1]], r, a0: cv.a0, a1: cv.a1, ccw: !e.reverse };
}

/** Intersection of two offset (infinite) curves closest to `near`. */
function cornerPoint(A, B, near) {
  let cands = [];
  if (A.kind === 'line' && B.kind === 'line') {
    for (const { t1 } of lineLine(A, B)) cands.push(pointAt(A, t1));
  } else if (A.kind === 'line' || B.kind === 'line') {
    const L = A.kind === 'line' ? A : B, R = A.kind === 'line' ? B : A;
    for (const t of lineCircle(L, R.c, R.r)) cands.push(pointAt(L, t));
  } else {
    cands = circleCircle(A.c, A.r, B.c, B.r);
  }
  if (!cands.length) return null;
  let best = null, bd = Infinity;
  for (const p of cands) { const d = Math.hypot(p[0] - near[0], p[1] - near[1]); if (d < bd) { bd = d; best = p; } }
  return best;
}

/** Bulge of a directed arc from P to Q on circle (c, r) travelling ccw / cw. */
function bulgeBetween(arc, P, Q) {
  let a0 = Math.atan2(P[1] - arc.c[1], P[0] - arc.c[0]);
  let a1 = Math.atan2(Q[1] - arc.c[1], Q[0] - arc.c[0]);
  let span = arc.ccw ? norm(a1 - a0) : norm(a0 - a1);
  if (span > TAU - 1e-9) span = 0;
  return { bulge: (arc.ccw ? 1 : -1) * Math.tan(span / 4), span };
}

/**
 * Offset a closed CCW face inward: `dOf(edge)` gives the distance per edge
 * (bar edge → barWidth/2, board edge → edgeMargin; negative values offset
 * outward). Returns { pts: [[x, y, bulge], …] closed bulge polyline,
 * edges: [{ kind, from, to, bulge, arc? }], ok, dropped } or null when the
 * face collapses. Edges that vanish (corners crossing) are dropped and the
 * corner is recomputed between their neighbours.
 */
/** Consecutive edges on the same line / circle (a ring split by a spoke that ends on it) become ONE edge — the DWG draws one arc there. */
function mergeCoCurve(edges) {
  const out = [];
  const sameCurve = (a, b) => {
    if (a.curve.kind !== b.curve.kind || a.reverse !== b.reverse || a.curve.tag !== b.curve.tag) return false;
    if (a.curve.kind === 'arc') return Math.abs(a.curve.c[0] - b.curve.c[0]) < 1e-6 && Math.abs(a.curve.c[1] - b.curve.c[1]) < 1e-6 && Math.abs(a.curve.r - b.curve.r) < 1e-6;
    const d1 = [a.to[0] - a.from[0], a.to[1] - a.from[1]], d2 = [b.to[0] - b.from[0], b.to[1] - b.from[1]];
    return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) < 1e-6 * Math.hypot(...d1) * Math.hypot(...d2) && d1[0] * d2[0] + d1[1] * d2[1] > 0;
  };
  for (const e of edges) {
    const last = out[out.length - 1];
    if (last && sameCurve(last, e) && Math.abs(last.to[0] - e.from[0]) < 1e-6 && Math.abs(last.to[1] - e.from[1]) < 1e-6) {
      if (e.curve.kind === 'line') out[out.length - 1] = { ...last, to: e.to, curve: { ...last.curve, p: last.reverse ? e.to : last.from, q: last.reverse ? last.from : e.to } };
      else out[out.length - 1] = { ...last, to: e.to, curve: { ...last.curve, a0: last.reverse ? e.curve.a0 : last.curve.a0, a1: last.reverse ? last.curve.a1 : e.curve.a1 } };
    } else out.push({ ...e });
  }
  // wrap-around: the last and the first edge
  if (out.length > 1 && sameCurve(out[out.length - 1], out[0]) && Math.abs(out[out.length - 1].to[0] - out[0].from[0]) < 1e-6 && Math.abs(out[out.length - 1].to[1] - out[0].from[1]) < 1e-6) {
    const last = out.pop(), first = out[0];
    if (first.curve.kind === 'line') out[0] = { ...first, from: last.from, curve: { ...first.curve, p: first.reverse ? first.to : last.from, q: first.reverse ? last.from : first.to } };
    else out[0] = { ...first, from: last.from, curve: { ...first.curve, a0: first.reverse ? first.curve.a0 : last.curve.a0, a1: first.reverse ? last.curve.a1 : first.curve.a1 } };
  }
  return out;
}

export function offsetFace(face, dOf) {
  let edges = mergeCoCurve(face.edges).map((e) => ({ e, off: offsetEdge(e, dOf(e)), corner: e.from }));
  if (edges.some((x) => !x.off)) return null;
  // a full circle (v3 Block 3: the circle board, a sunburst hub): one merged arc edge → two half circles
  if (edges.length === 1 && edges[0].off.kind === 'arc') {
    const off = edges[0].off, tag = edges[0].e.curve.tag;
    if (!(off.r > 1e-6)) return null;
    const P = [off.c[0] + off.r, off.c[1]], Q = [off.c[0] - off.r, off.c[1]];
    const b = off.ccw ? 1 : -1;
    const out = [
      { kind: 'arc', from: P, to: Q, bulge: b, arc: { c: off.c, r: off.r, ccw: off.ccw }, tag },
      { kind: 'arc', from: Q, to: P, bulge: b, arc: { c: off.c, r: off.r, ccw: off.ccw }, tag },
    ];
    return { edges: out, pts: out.map((d) => [d.from[0], d.from[1], d.bulge]), ok: true, dropped: 0 };
  }
  let dropped = 0;
  for (let iter = 0; iter < 50; iter++) {
    const n = edges.length;
    if (n < 2) return null;
    // corner i = between edge i−1 and edge i, near the original vertex where edge i starts
    const corners = [];
    for (let i = 0; i < n; i++) {
      const prev = edges[(i - 1 + n) % n], cur = edges[i];
      const near = cur.e.from;
      let pt = cornerPoint(prev.off, cur.off, near);
      if (!pt) {
        // tangent-continuous joint (offset curves touch): the offset of the original vertex along its normal
        pt = cur.off.kind === 'line' ? cur.off.p : pointAt({ kind: 'arc', c: cur.off.c, r: cur.off.r, a0: Math.atan2(near[1] - cur.off.c[1], near[0] - cur.off.c[0]), a1: 0 }, 0);
      }
      corners.push(pt);
    }
    // edge i runs from corner i to corner i+1 — drop edges whose direction flipped or vanished
    const bad = [];
    for (let i = 0; i < n; i++) {
      const P = corners[i], Q = corners[(i + 1) % n], off = edges[i].off;
      if (off.kind === 'line') {
        const s = (Q[0] - P[0]) * off.dir[0] + (Q[1] - P[1]) * off.dir[1];
        if (s < 1e-6) bad.push(i);
      } else {
        const { span } = bulgeBetween(off, P, Q);
        const orig = edges[i].e.curve.a1 - edges[i].e.curve.a0;
        if (span < 1e-9 || span > orig + Math.PI / 2) bad.push(i);
      }
    }
    if (!bad.length) {
      const out = edges.map((x, i) => {
        const P = corners[i], Q = corners[(i + 1) % n];
        if (x.off.kind === 'line') return { kind: 'line', from: P, to: Q, bulge: 0, tag: x.e.curve.tag };
        const { bulge } = bulgeBetween(x.off, P, Q);
        return { kind: 'arc', from: P, to: Q, bulge, arc: { c: x.off.c, r: x.off.r, ccw: x.off.ccw }, tag: x.e.curve.tag };
      });
      return { edges: out, pts: out.map((d) => [d.from[0], d.from[1], d.bulge]), ok: true, dropped };
    }
    // drop the shortest bad edge and retry
    let drop = bad[0];
    if (bad.length > 1) {
      let best = Infinity;
      for (const i of bad) { const L = curveLength(edges[i].e.curve); if (L < best) { best = L; drop = i; } }
    }
    edges = edges.filter((_, i) => i !== drop);
    dropped++;
  }
  return null;
}

/** Real corners of an offset contour: tangent difference above TANGENT_TOL_DEG. */
function contourCorners(contour) {
  const n = contour.edges.length;
  const out = [];
  const endTangent = (d) => {
    if (d.kind === 'line') return Math.atan2(d.to[1] - d.from[1], d.to[0] - d.from[0]);
    const a = Math.atan2(d.to[1] - d.arc.c[1], d.to[0] - d.arc.c[0]);
    return a + (d.arc.ccw ? 1 : -1) * Math.PI / 2;
  };
  const startTangent = (d) => {
    if (d.kind === 'line') return Math.atan2(d.to[1] - d.from[1], d.to[0] - d.from[0]);
    const a = Math.atan2(d.from[1] - d.arc.c[1], d.from[0] - d.arc.c[0]);
    return a + (d.arc.ccw ? 1 : -1) * Math.PI / 2;
  };
  for (let i = 0; i < n; i++) {
    const prev = contour.edges[(i - 1 + n) % n], cur = contour.edges[i];
    let diff = Math.abs(norm(startTangent(cur) - endTangent(prev)));
    if (diff > Math.PI) diff = TAU - diff;
    if (diff * 180 / Math.PI > TANGENT_TOL_DEG) out.push({ index: i, apex: cur.from, prev, cur, diffDeg: diff * 180 / Math.PI });
  }
  return out;
}

/** Point `dist` mm along a contour edge from its start (forward) or from its end (backward), with the sub-arc bulge. */
function alongEdge(d, dist, fromEnd) {
  if (d.kind === 'line') {
    const L = Math.hypot(d.to[0] - d.from[0], d.to[1] - d.from[1]);
    const k = Math.min(dist, L) / L;
    const p = fromEnd ? [d.to[0] + (d.from[0] - d.to[0]) * k, d.to[1] + (d.from[1] - d.to[1]) * k] : [d.from[0] + (d.to[0] - d.from[0]) * k, d.from[1] + (d.to[1] - d.from[1]) * k];
    return { p, bulge: 0 };
  }
  const total = Math.abs(4 * Math.atan(d.bulge)) * d.arc.r;
  const len = Math.min(dist, total);
  const span = len / d.arc.r;
  const base = fromEnd ? d.to : d.from;
  const a = Math.atan2(base[1] - d.arc.c[1], base[0] - d.arc.c[0]);
  const dir = (d.arc.ccw ? 1 : -1) * (fromEnd ? -1 : 1);
  const a2 = a + dir * span;
  return { p: [d.arc.c[0] + d.arc.r * Math.cos(a2), d.arc.c[1] + d.arc.r * Math.sin(a2)], bulge: Math.tan(span / 4) * (d.arc.ccw ? 1 : -1) };
}

/**
 * Corner guides of a +limit contour, the DWG way: apex = the corner, one leg
 * `leg` mm back along the incoming edge, one leg `leg` mm forward along the
 * outgoing edge — both INTO the pane, arcs keep their bulge. Open 3-vertex
 * polyline [legIn, apex, legOut].
 */
export function cornerGuides(contour, leg) {
  return contourCorners(contour).map((c) => {
    const a = alongEdge(c.prev, leg, true);    // on the incoming edge, `leg` before the apex
    const b = alongEdge(c.cur, leg, false);    // on the outgoing edge, `leg` after the apex
    // bulge of the first vertex = the sub-arc from legIn to the apex (travelling towards the apex), second = apex → legOut
    const bIn = c.prev.kind === 'arc' ? Math.tan((Math.min(leg, Math.abs(4 * Math.atan(c.prev.bulge)) * c.prev.arc.r) / c.prev.arc.r) / 4) * (c.prev.arc.ccw ? 1 : -1) : 0;
    return { apex: c.apex, pts: [[a.p[0], a.p[1], bIn], [c.apex[0], c.apex[1], b.bulge], [b.p[0], b.p[1], 0]] };
  });
}

// ── board + bars → geometry ─────────────────────────────────────────────────
/**
 * Board loop of an arched glass unit in the glass frame: the unit outline offset
 * by `inset` (positive = inwards, negative = outwards). The tracery board sits
 * the full glazing rebate in, so the engine path passes glassInset − glazingRebate
 * (= −5.5 with 12.5 / 18): the board is 5.5 larger than the sealed unit all round.
 */
export function boardFromOutline(outline, glassInset) {
  const Wg = outline.width, ys = outline.springing;
  const arcs = glassEdgeArcs(outline, glassInset);
  // circle (v3 Block 3): the board is the full daylight circle — no straight edge
  if (outline.kind === 'circle') {
    return { curves: arcs.map((a) => arcCurve([a.cx, a.cy], a.r, a.a0, a.a1, 'board')), axisX: Wg / 2, centres: arcs.map((a) => [a.cx, a.cy]), circle: true };
  }
  const curves = [
    lineCurve([glassInset, glassInset], [Wg - glassInset, glassInset], 'board'),
    lineCurve([Wg - glassInset, glassInset], [Wg - glassInset, ys], 'board'),
    ...arcs.map((a) => arcCurve([a.cx, a.cy], a.r, a.a0, a.a1, 'board')),
    lineCurve([glassInset, ys], [glassInset, glassInset], 'board'),
  ].filter((cv) => curveLength(cv) > 1e-6);
  return { curves, axisX: Wg / 2, centres: arcs.map((a) => [a.cx, a.cy]) };
}

/**
 * Bar axes (derived.arch.bars, glass frame) → curves tagged 'bar'. The engine's
 * bars end on the GLASS outline; the tracery board reaches the rebate bottom
 * (`extend` = glazingRebate − glassInset beyond the unit), so every straight
 * bar is lengthened by that amount at both ends — the timber bar runs to the
 * board edge, otherwise the panes would not be separated. Rings and other arc
 * bars end on bars, not on the edge, and are left alone.
 */
export function barCurves(bars, extend = 0) {
  return (bars || []).map((b) => {
    if (b.kind === 'arc') {
      // intersecting / tracery arcs also end on the GLASS outline: lengthen both ends by the same
      // distance (as an angle, extend / r) so they reach the board edge and split the panes;
      // rings and springing-bar ends only run into a bar band, which is harmless
      const r = b.arc.r || 1;
      const da = extend > 0 ? extend / r : 0;
      const dir = b.arc.a1 >= b.arc.a0 ? 1 : -1;
      return arcCurve([b.arc.cx, b.arc.cy], r, b.arc.a0 - dir * da, b.arc.a1 + dir * da, 'bar');
    }
    if (!(extend > 0)) return lineCurve(b.from, b.to, 'bar');
    const dx = b.to[0] - b.from[0], dy = b.to[1] - b.from[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return lineCurve([b.from[0] - ux * extend, b.from[1] - uy * extend], [b.to[0] + ux * extend, b.to[1] + uy * extend], 'bar');
  }).filter((cv) => curveLength(cv) > 1e-6);
}

const faceBounds = (face) => {
  let minX = Infinity, maxX = -Infinity, sx = 0, sy = 0, n = 0;
  for (const e of face.edges) { minX = Math.min(minX, e.from[0]); maxX = Math.max(maxX, e.from[0]); sx += e.from[0]; sy += e.from[1]; n++; }
  return { minX, maxX, cx: sx / n, cy: sy / n };
};

/**
 * Tracery geometry.
 * @param board  { curves: closed board loop (tag 'board'), axisX, centres }
 * @param bars   bar axis curves (tag 'bar')
 * @param T      readTraceryProfile(profile)
 * @param opts   { mode: 'auto' | 'full' | 'quadrant' }
 * Returns { mode, board: { pts }, boardRef: { pts }, panes: [{ daylight, rail, limit, area }],
 *           guides: [{ apex, pts }], centres, warnings, areas: { board, panes, timber } }.
 */
export function buildTraceryGeometry(board, bars, T, opts = {}) {
  const warnings = [];
  const barHalf = T.barWidth / 2;
  const dOf = (e) => (e.curve.tag === 'board' ? T.edgeMargin : barHalf);
  // faces of the full window
  const fullFaces = arrangementFaces([...board.curves, ...bars]).filter((f) => f.area > 1e-6);
  const boardFace = arrangementFaces(board.curves).find((f) => f.area > 1e-6);
  if (!boardFace) throw new ArchError('Tracery: the board outline is not a closed loop');
  const boardArea = boardFace.area;
  // panes = bounded faces that are not the board itself (a board without bars is one face = no tracery)
  const isBoard = (f) => Math.abs(f.area - boardArea) < 1e-6 * Math.max(1, boardArea);
  const fullPanes = fullFaces.filter((f) => !isBoard(f));
  let mode = opts.mode || 'auto';
  const axis = board.axisX;
  if (mode === 'auto') {
    // Piotr 06.09: always the WHOLE board. The DWG quadrant was an AutoCAD drawing habit, and
    // a centre bar on the axis made the half board come out as one pane (gothic, 1 V bar).
    // 'quadrant' stays available as an explicit option.
    mode = 'full';
  }
  let faces, boardLoop;
  if (mode === 'quadrant') {
    // cut at the axis: the axis is a bar edge for the panes (barHalf), the board cut edge
    // (edgeMargin from the pane, as in the DWG: 18 − 11 = 7 past the axis) is a board edge
    const cutX = axis + (T.edgeMargin - barHalf);
    const big = 1e6;
    const axisBar = lineCurve([axis, -big], [axis, big], 'bar');
    const cutLine = lineCurve([cutX, -big], [cutX, big], 'board');
    const bf = arrangementFaces([...board.curves, cutLine]).filter((f) => f.area > 1e-6).filter((f) => faceBounds(f).cx < cutX);
    if (bf.length !== 1) throw new ArchError('Tracery: the quadrant cut did not leave one board face');
    boardLoop = bf[0];
    const all = arrangementFaces([...board.curves, cutLine, axisBar, ...bars]).filter((f) => f.area > 1e-6);
    const halfArea = boardLoop.area;
    faces = all.filter((f) => faceBounds(f).cx < axis && Math.abs(f.area - halfArea) > 1e-6 * Math.max(1, halfArea));
  } else {
    boardLoop = boardFace;
    faces = fullPanes;
  }
  const boardOut = offsetFace(boardLoop, () => 0);
  const boardRef = offsetFace(boardLoop, () => T.paneOffset);
  const panes = [];
  let paneArea = 0;
  faces.forEach((f, i) => {
    const daylight = offsetFace(f, dOf);
    if (!daylight) { warnings.push(`pane ${i + 1} collapses under the ${T.barWidth} mm bar / ${T.edgeMargin} mm edge offsets — skipped`); return; }
    const rail = offsetFace(f, (e) => dOf(e) - T.paneOffset);
    const limit = offsetFace(f, (e) => dOf(e) - T.limitOffset);
    if (!rail || !limit) { warnings.push(`pane ${i + 1}: rail / limit offset collapses — skipped`); return; }
    if (daylight.dropped) warnings.push(`pane ${i + 1}: ${daylight.dropped} short edge(s) vanished under the offset`);
    const area = contourArea(daylight);
    paneArea += area;
    panes.push({ index: panes.length + 1, daylight, rail, limit, area, face: f });
  });
  const guides = panes.flatMap((p) => cornerGuides(p.limit, T.mitreLeg).map((g) => ({ ...g, pane: p.index })));
  const bb = boardBBox(boardOut.pts);
  return {
    mode, board: boardOut, boardRef, panes, guides, warnings,
    centres: board.centres,
    bbox: bb,
    areas: { board: boardLoop.area, panes: paneArea, timber: boardLoop.area - paneArea },
  };
}

/** Signed area of an offset contour (directed line / arc edges). */
export function contourArea(contour) {
  return loopArea(contour.edges.map((d) => (d.kind === 'line' ? { curve: { kind: 'line', p: d.from, q: d.to }, reverse: false } : arcAsEdge(d))));
}

/** Directed arc contour edge → the {curve, reverse} form loopArea understands. */
function arcAsEdge(d) {
  const a0 = Math.atan2(d.from[1] - d.arc.c[1], d.from[0] - d.arc.c[0]);
  const span = Math.abs(4 * Math.atan(d.bulge));
  if (d.arc.ccw) return { curve: { kind: 'arc', c: d.arc.c, r: d.arc.r, a0, a1: a0 + span }, reverse: false };
  return { curve: { kind: 'arc', c: d.arc.c, r: d.arc.r, a0: a0 - span, a1: a0 }, reverse: true };
}

/** Exact bounding box of a closed bulge polyline (arc extents included). */
export function boardBBox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0, b] = pts[i];
    take(x0, y0);
    if (!b) continue;
    const [x1, y1] = pts[(i + 1) % n];
    const theta = 4 * Math.atan(Math.abs(b));
    const chord = Math.hypot(x1 - x0, y1 - y0);
    if (!(chord > 0)) continue;
    const r = chord / (2 * Math.sin(theta / 2));
    const d = r * Math.cos(theta / 2) * Math.sign(b);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const nx = -(y1 - y0) / chord, ny = (x1 - x0) / chord;
    const cx = mx + nx * d, cy = my + ny * d;
    const a0 = Math.atan2(y0 - cy, x0 - cx);
    const dir = Math.sign(b);
    for (const k of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      let rel = norm((k - a0) * dir);
      if (rel > 0 && rel < theta) take(cx + r * Math.cos(k), cy + r * Math.sin(k));
    }
  }
  return { minX, minY, maxX, maxY };
}

// ── entities ────────────────────────────────────────────────────────────────
const polyE = (layer, pts, closed) => ({ type: 'poly', layer, closed, pts: pts.map(([x, y, b]) => [x, y, b || 0]) });
const noteE = (layer, x, y, h, str) => ({ type: 'text', layer, x, y, h, str, rot: 0, halign: 0, valign: 0 });

/**
 * Entity list of one tracery (dxfWriter model + {type:'point'}), at the
 * geometry's own coordinates (DXF at 0,0 — the LSP asks for the insertion point).
 * info: { winNum, pattern, spokes, rings, barWidth, edgeMargin, mode }
 */
export function buildTraceryEntities(geom, info = {}) {
  const E = [];
  E.push(polyE('ARKA_OUTLINE', geom.board.pts, true));
  E.push(polyE('ARKA_PANE_ZEWN_REF', geom.boardRef.pts, true));
  for (const p of geom.panes) {
    E.push(polyE('ARKA_OUTLINE', p.daylight.pts, true));
    E.push(polyE('ARKA_PANE', p.rail.pts, true));
    E.push(polyE('ARKA_FRONT_HINGES_3MM', p.limit.pts, true));
  }
  for (const g of geom.guides) E.push(polyE('ARKA_MITRE', g.pts, false));
  for (const c of geom.centres) E.push({ type: 'point', layer: 'ARKA_CENTRE', x: c[0], y: c[1] });
  // section outside the board (right of it, bottom-aligned), START marked at its low end
  const C = TRACERY_TEXT;
  const sx = geom.bbox.maxX + C.gap, sy = geom.bbox.minY;
  E.push(polyE('ARKA_SECTION', SECTION_POLY.map(([x, y, b]) => [x + sx, y + sy, b]), false));
  E.push(noteE('ARKA_INFO_NO_CUT', sx - 4, sy - C.textH - 4, C.textH, 'START'));
  E.push(noteE('ARKA_INFO_NO_CUT', sx + 20, sy + 4, C.textH, 'SECTION R8 + 6 (VERBATIM)'));
  const lines = [
    `${info.winNum ? info.winNum + ' - ' : ''}TRACERY ${String(info.mode || geom.mode).toUpperCase()}${geom.mode === 'quadrant' ? ' (LEFT HALF - MIRROR FOR THE RIGHT)' : ''}`,
    `PATTERN ${String(info.pattern || 'none').toUpperCase()} SPOKES ${info.spokes ?? 0} RINGS ${info.rings ?? 0} PANES ${geom.panes.length}`,
    `TIMBER BAR ${info.barWidth ?? ''} EDGE MARGIN ${info.edgeMargin ?? ''} PANE +${info.paneOffset ?? ''} LIMIT +${info.limitOffset ?? ''} MITRE LEG ${info.mitreLeg ?? ''}`,
    'ARKA_PANE = MOULDING RAIL (INNER EDGE OF THE BEAD), ARKA_FRONT_HINGES_3MM = BEAD LIMIT (NOT DRILLING)',
    'NOT A TOOLPATH',
    ...geom.warnings.map((w) => `WARNING ${w.toUpperCase()}`),
  ];
  const tx = sx, top = geom.bbox.maxY;
  lines.forEach((str, i) => E.push(noteE('ARKA_INFO_NO_CUT', tx, top - (i + 1) * C.lineH, C.textH, str)));
  return E;
}

// ── LSP writer ──────────────────────────────────────────────────────────────
const lspNum = (v) => { const s = Number(v).toFixed(6).replace(/\.?0+$/, ''); return s === '-0' ? '0' : (s.includes('.') ? s : s + '.0'); };
const lspStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * AutoLISP for the same entity list: `(defun c:ARKA ...)` — asks for the
 * insertion point (Enter = 0,0), makes the ARKA_* layers with -LAYER, then
 * entmake LWPOLYLINE (groups 90 / 70 / 10 / 42), POINT and TEXT. Plain
 * AutoLISP, no ActiveX, so it loads in any AutoCAD (Windows or Mac).
 */
export function writeTraceryLsp(entities, layers, info = {}) {
  const L = [];
  L.push(';;; ARKA tracery — generated by Production Core (ARCHED-WINDOWS-v3 Block 0.4)');
  L.push(`;;; ${info.winNum ? 'window ' + info.winNum + ' - ' : ''}pattern ${info.pattern || 'none'} - units mm - layers ARKA_*`);
  L.push(';;; The DXF of the same name carries the same entities; ARKA_INFO_NO_CUT is never machined.');
  L.push('(defun ar:layer (name col)');
  L.push('  (if (not (tblsearch "LAYER" name))');
  L.push('    (command "_.-LAYER" "_M" name "_C" (itoa col) name "")');
  L.push('    (command "_.-LAYER" "_S" name ""))');
  L.push(')');
  L.push('(defun ar:poly (layer closed verts / data v)');
  L.push('  (setq data (list (quote (0 . "LWPOLYLINE")) (quote (100 . "AcDbEntity")) (cons 8 layer)');
  L.push('                   (quote (100 . "AcDbPolyline")) (cons 90 (length verts)) (cons 70 (if closed 1 0))))');
  L.push('  (foreach v verts');
  L.push('    (setq data (append data (list (cons 10 (list (+ (car *ar-ip*) (car v)) (+ (cadr *ar-ip*) (cadr v)))) (cons 42 (caddr v))))))');
  L.push('  (entmake data)');
  L.push(')');
  L.push('(defun ar:point (layer x y)');
  L.push('  (entmake (list (quote (0 . "POINT")) (cons 8 layer) (cons 10 (list (+ (car *ar-ip*) x) (+ (cadr *ar-ip*) y) 0.0))))');
  L.push(')');
  L.push('(defun ar:text (layer x y h str)');
  L.push('  (entmake (list (quote (0 . "TEXT")) (cons 8 layer) (cons 10 (list (+ (car *ar-ip*) x) (+ (cadr *ar-ip*) y) 0.0)) (cons 40 h) (cons 1 str)))');
  L.push(')');
  L.push('(defun c:ARKA ( / ip)');
  L.push('  (setq ip (getpoint "\\nInsertion point <0,0>: "))');
  L.push('  (setq *ar-ip* (if ip (list (car ip) (cadr ip)) (list 0.0 0.0)))');
  for (const l of layers) L.push(`  (ar:layer ${lspStr(l.name)} ${l.color})`);
  for (const e of entities) {
    if (e.type === 'poly') {
      const verts = e.pts.map(([x, y, b]) => `(${lspNum(x)} ${lspNum(y)} ${lspNum(b || 0)})`).join(' ');
      L.push(`  (ar:poly ${lspStr(e.layer)} ${e.closed ? 'T' : 'nil'} (list ${verts}))`);
    } else if (e.type === 'point') {
      L.push(`  (ar:point ${lspStr(e.layer)} ${lspNum(e.x)} ${lspNum(e.y)})`);
    } else if (e.type === 'text') {
      L.push(`  (ar:text ${lspStr(e.layer)} ${lspNum(e.x)} ${lspNum(e.y)} ${lspNum(e.h)} ${lspStr(e.str)})`);
    }
  }
  L.push('  (princ "\\nARKA: tracery drawn. Layers ARKA_*; ARKA_INFO_NO_CUT is not a toolpath.")');
  L.push('  (princ)');
  L.push(')');
  L.push('(princ "\\nARKA loaded - type ARKA to draw the tracery.")');
  L.push('(princ)');
  return L.join('\r\n') + '\r\n';
}

/**
 * Parse a generated LSP back into the entity list (harness: DXF ↔ LSP parity).
 * A small tokenizer over the ar:poly / ar:point / ar:text calls — not a LISP.
 */
export function parseTraceryLsp(text) {
  const found = [];
  const numRe = '(-?\\d+(?:\\.\\d+)?)';
  const polyRe = /\(ar:poly "([^"]+)" (T|nil) \(list ((?:\([^)]*\) ?)+)\)\)/g;
  let m;
  while ((m = polyRe.exec(text))) {
    const pts = [...m[3].matchAll(/\(([^)]*)\)/g)].map((v) => v[1].trim().split(/\s+/).map(Number));
    found.push({ at: m.index, e: { type: 'poly', layer: m[1], closed: m[2] === 'T', pts: pts.map(([x, y, b]) => [x, y, b || 0]) } });
  }
  const ptRe = new RegExp(`\\(ar:point "([^"]+)" ${numRe} ${numRe}\\)`, 'g');
  while ((m = ptRe.exec(text))) found.push({ at: m.index, e: { type: 'point', layer: m[1], x: Number(m[2]), y: Number(m[3]) } });
  const txRe = new RegExp(`\\(ar:text "([^"]+)" ${numRe} ${numRe} ${numRe} "((?:[^"\\\\]|\\\\.)*)"\\)`, 'g');
  while ((m = txRe.exec(text))) found.push({ at: m.index, e: { type: 'text', layer: m[1], x: Number(m[2]), y: Number(m[3]), h: Number(m[4]), str: m[5].replace(/\\"/g, '"').replace(/\\\\/g, '\\') } });
  return found.sort((a, b) => a.at - b.at).map((f) => f.e);     // document order = the entity order
}

// ── engine path ─────────────────────────────────────────────────────────────
/**
 * Tracery of one arched casement from the engine's derived data (glass frame).
 * Returns { geom, entities, info } or throws ArchError.
 */
export function buildTraceryForDerived(derived, profile, winNum = '', opts = {}) {
  const A = derived?.arch;
  if (!A?.glassOutline || !A.bars) throw new ArchError('Tracery needs derived.arch (glass outline + bars)');
  const glassInset = Number(opts.glassInset ?? profile?.geometry?.glassInset);
  if (!(glassInset >= 0)) throw new ArchError('Casement profile geometry.glassInset is missing');
  // The board reaches the timber at the bottom of the glazing rebate (Piotr 06.09): the glass
  // unit sits glassInset (12.5) into an 18 mm rebate, the board the full rebate — so the board
  // outline is the unit outline moved OUT by (glazingRebate − glassInset) = 5.5, all round.
  const glazingRebate = Number(opts.glazingRebate ?? profile?.geometry?.glazingRebate);
  if (!(glazingRebate >= glassInset)) throw new ArchError('Casement profile geometry.glazingRebate is missing or below glassInset');
  const T = readTraceryProfile(profile);
  const outset = glazingRebate - glassInset;                              // 5.5: board beyond the unit
  const board = boardFromOutline(A.glassOutline, -outset);
  // a circle board is always cut whole (no springing line to mirror about)
  const geom = buildTraceryGeometry(board, barCurves(A.bars, outset + 1), T, board.circle ? { ...opts, mode: 'full' } : opts);
  const by = A.bars.reduce((m, b) => { m[b.role] = (m[b.role] || 0) + 1; return m; }, {});
  const info = {
    winNum, pattern: A.pattern, spokes: (by.spoke || 0) + (by.springing || 0), rings: by.ring || 0,
    barWidth: T.barWidth, edgeMargin: T.edgeMargin, paneOffset: T.paneOffset, limitOffset: T.limitOffset, mitreLeg: T.mitreLeg, mode: geom.mode,
  };
  return { geom, entities: buildTraceryEntities(geom, info), info, T };
}
