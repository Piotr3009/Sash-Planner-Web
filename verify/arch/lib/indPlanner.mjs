/**
 * indPlanner.mjs — INDEPENDENT implementation of the v4 segment planner
 * (ARCHED-WINDOWS-v4 Block C, spec C.1 – C.4) for the harnesses. It shares
 * nothing with src/engine/arch.js beyond the ring object it is handed
 * (outer / inner arcs with their clip kinds — geometry that t16 verifies on
 * its own closed forms):
 *   - groups: one chain (springing → springing), two sides for a gothic
 *     (split at the apex), one closed ring for a circle;
 *   - N equal pieces by OUTER arc length; the allowance band (outer + a,
 *     inner − a, clipped ends recomputed) is SAMPLED (800 points per arc) and
 *     projected on the piece chord (u) and its outward normal (b);
 *   - raw piece = a straight trapezoid `stock` wide centred on the band, ends
 *     on the radial joint planes / the vertical apex axis / SQUARE at the band
 *     extent on the springing; finger extension on jointed ends;
 *   - limits: overall (extent along u with fingers) ≥ minClamp, shorter edge
 *     ≥ minPiece; stock = the narrowest list entry ≥ W_req;
 *   - fewest = the first N that passes; alternative = the first of N + 1 …
 *     N + 3 that passes on a narrower board; default = alternative when the
 *     fewest plan's waste (rough × stock − band area) / (rough × stock) is
 *     above the threshold.
 */
export const DEFAULTS = Object.freeze({
  stock: [63, 75, 95, 105, 120, 150, 180, 200],
  allowance: 10,
  finger: 15,
  minClamp: 450,
  minPiece: 400,
  threshold: 0.45,
  samples: 800,
  maxN: 40,
});

const pt = (a, t) => [a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)];
export function sample(a, t0, t1, n = DEFAULTS.samples) { const o = []; for (let i = 0; i <= n; i++) o.push(pt(a, t0 + (t1 - t0) * i / n)); return o; }
/** Clipped angle of a concentric offset arc (springing line y = 0 / window axis x = 0). */
export function clipAt(clip, cx, cy, r, end) {
  if (clip === 'archStart') { const x = Math.sqrt(r * r - cy * cy); return end === 0 ? Math.atan2(-cy || 0, x) : Math.atan2(-cy || 0, -x); }
  if (clip === 'axis') { const y = Math.sqrt(r * r - cx * cx); return Math.atan2(y, -cx); }
  return null;
}
export function polyArea(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; }

/** Planning groups of a ring (same rule as the spec: apex = joint, circle = closed). */
export function groupsOf(ring) {
  const outer = ring.outer;
  const closed = !outer[0].clip0 && !outer[outer.length - 1].clip1;
  if (closed) return [{ idx: outer.map((_, i) => i), startType: 'radial', endType: 'radial', kind: 'ring' }];
  const groups = [];
  let start = 0;
  for (let i = 0; i < outer.length; i++) {
    if (outer[i].clip1 === 'axis' || i === outer.length - 1) {
      const idx = []; for (let j = start; j <= i; j++) idx.push(j);
      groups.push({ idx, startType: outer[start].clip0 === 'axis' ? 'axis' : 'archStart', endType: outer[i].clip1 === 'axis' ? 'axis' : 'archStart' });
      start = i + 1;
    }
  }
  groups.forEach((g) => { g.kind = groups.length > 1 ? 'side' : 'chain'; });
  return groups;
}

/** Evaluate N pieces of one group: pieces with W_req, edges, limits, waste. */
export function evaluateN(ring, g, n, O = {}) {
  const S = { ...DEFAULTS, ...O };
  const outer = ring.outer, inner = ring.inner;
  const lens = g.idx.map((i) => outer[i].r * (outer[i].a1 - outer[i].a0));
  const total = lens.reduce((s, x) => s + x, 0);
  const pieces = [];
  for (let k = 0; k < n; k++) {
    const s0 = total * k / n, s1 = total * (k + 1) / n;
    let acc = 0; const loopO = [], loopI = []; let startPt = null, endPt = null, startPlane = null, endPlane = null;
    let spanSum = 0; const arcs = [];
    for (let j = 0; j < g.idx.length; j++) {
      const i = g.idx[j], Oa = outer[i], Ia = inner[i], L = lens[j];
      const lo = Math.max(s0, acc), hi = Math.min(s1, acc + L);
      if (hi > lo + 1e-9) {
        const atStart = k === 0 && j === 0, atEnd = k === n - 1 && j === g.idx.length - 1;
        const t0 = Oa.a0 + (lo - acc) / Oa.r, t1 = Oa.a0 + (hi - acc) / Oa.r;
        const bO = { ...Oa, r: Oa.r + S.allowance }, bI = { ...Ia, r: Ia.r - S.allowance };
        const o0 = atStart ? (clipAt(Oa.clip0, bO.cx, bO.cy, bO.r, 0) ?? Oa.a0) : t0, o1 = atEnd ? (clipAt(Oa.clip1, bO.cx, bO.cy, bO.r, 1) ?? Oa.a1) : t1;
        const i0 = atStart ? (clipAt(Ia.clip0, bI.cx, bI.cy, bI.r, 0) ?? Ia.a0) : t0, i1 = atEnd ? (clipAt(Ia.clip1, bI.cx, bI.cy, bI.r, 1) ?? Ia.a1) : t1;
        loopO.push(...sample(bO, o0, o1, S.samples));
        loopI.unshift(...sample(bI, i1, i0, S.samples));   // inner arcs backwards → one closed loop
        if (!startPt) { startPt = pt(Oa, atStart ? Oa.a0 : t0); startPlane = { c: [Oa.cx, Oa.cy], t: atStart ? Oa.a0 : t0 }; }
        endPt = pt(Oa, atEnd ? Oa.a1 : t1); endPlane = { c: [Oa.cx, Oa.cy], t: atEnd ? Oa.a1 : t1 };
        spanSum += (atEnd ? Oa.a1 : t1) - (atStart ? Oa.a0 : t0);
        arcs.push(i);
      }
      acc += L;
    }
    // the inner loop was built per arc with unshift — rebuild in the correct order: outer forward, inner back
    const pts = [...loopO, ...loopI];
    const u0 = [endPt[0] - startPt[0], endPt[1] - startPt[1]]; const ul = Math.hypot(...u0);
    const u = ul > 1e-9 ? [u0[0] / ul, u0[1] / ul] : [-Math.sin((startPlane.t + endPlane.t) / 2), Math.cos((startPlane.t + endPlane.t) / 2)];
    const b = [u[1], -u[0]];
    const w = pts.map((q) => q[0] * b[0] + q[1] * b[1]), sv = pts.map((q) => q[0] * u[0] + q[1] * u[1]);
    const wMin = Math.min(...w), wMax = Math.max(...w), sMin = Math.min(...sv), sMax = Math.max(...sv);
    pieces.push({ k, n, arcs, span: spanSum, wReq: wMax - wMin, wMin, wMax, sMin, sMax, L: sMax - sMin, u, b, startPlane, endPlane, pts,
      startType: k === 0 ? g.startType : 'radial', endType: k === n - 1 ? g.endType : 'radial' });
  }
  const wReq = Math.max(...pieces.map((p) => p.wReq));
  const stock = [...S.stock].sort((x, y) => x - y).find((x) => x >= wReq - 1e-9) ?? null;
  if (stock == null) return { n, wReq, stock: null, feasible: false, pieces, fails: ['no stock board fits'] };
  let boardArea = 0, bandArea = 0, feasible = true;
  const fails = [];
  for (const p of pieces) {
    const wLo = p.wMin - (stock - p.wReq) / 2, wHi = wLo + stock;
    const P2 = (s, ww) => [s * p.u[0] + ww * p.b[0], s * p.u[1] + ww * p.b[1]];
    const hit = (type, plane, ww, sq) => {
      if (type === 'archStart') return P2(sq, ww);
      if (type === 'axis') return P2(-(ww * p.b[0]) / p.u[0], ww);
      const d = [Math.cos(plane.t), Math.sin(plane.t)];
      const rx = plane.c[0] - ww * p.b[0], ry = plane.c[1] - ww * p.b[1];
      const det = -p.u[0] * d[1] + d[0] * p.u[1];
      return P2((-rx * d[1] + d[0] * ry) / det, ww);
    };
    const S0 = hit(p.startType, p.startPlane, wLo, p.sMin), S1 = hit(p.startType, p.startPlane, wHi, p.sMin);
    const E0 = hit(p.endType, p.endPlane, wLo, p.sMax), E1 = hit(p.endType, p.endPlane, wHi, p.sMax);
    const len = (a, c) => Math.hypot(c[0] - a[0], c[1] - a[1]);
    const inner = len(S0, E0), outerE = len(S1, E1);
    const jS = p.startType !== 'archStart' ? 1 : 0, jE = p.endType !== 'archStart' ? 1 : 0;
    const ext = (q, sign) => [q[0] + sign * S.finger * p.u[0], q[1] + sign * S.finger * p.u[1]];
    const corners = [jS ? ext(S0, -1) : S0, jS ? ext(S1, -1) : S1, jE ? ext(E0, 1) : E0, jE ? ext(E1, 1) : E1];
    const along = corners.map((q) => q[0] * p.u[0] + q[1] * p.u[1]);
    const overall = Math.max(...along) - Math.min(...along);
    Object.assign(p, { stock, wLo, wHi, trapezoid: [S0, E0, E1, S1], inner, outer: outerE, overall, shorter: Math.min(inner, outerE), jointed: jS + jE, bandArea: polyArea(p.pts), boardArea: overall * stock });
    boardArea += p.boardArea; bandArea += p.bandArea;
    if (overall + 1e-9 < S.minClamp) { feasible = false; fails.push(`piece ${p.k + 1}: overall ${overall.toFixed(1)} < ${S.minClamp}`); }
    if (p.shorter + 1e-9 < S.minPiece) { feasible = false; fails.push(`piece ${p.k + 1}: shorter ${p.shorter.toFixed(1)} < ${S.minPiece}`); }
  }
  return { n, wReq, stock, feasible, pieces, waste: (boardArea - bandArea) / boardArea, boardArea, bandArea, fails };
}

/** Plan of every group of a ring → [{ options, fewest, alt, def, blocked, rule, reason }]. */
export function independentPlan(ring, O = {}) {
  const S = { ...DEFAULTS, ...O };
  return groupsOf(ring).map((g) => {
    const options = [];
    let fewest = null, alt = null, blocked = null;
    for (let n = 1; n <= S.maxN; n++) {
      const o = evaluateN(ring, g, n, S); options.push(o);
      if (fewest) { if (o.feasible && o.stock < fewest.stock && !alt) alt = o; if (n >= fewest.n + 3) break; continue; }
      if (o.feasible) { fewest = o; continue; }
      if (o.stock != null) { blocked = o; break; }
    }
    const economy = !!(fewest && alt && fewest.waste > S.threshold);
    return { kind: g.kind, options, fewest, alt, def: economy ? alt : fewest, blocked, rule: economy ? 'economy' : 'fewest', reason: fewest ? null : (blocked ? 'below minimum length' : 'no stock board fits') };
  });
}
