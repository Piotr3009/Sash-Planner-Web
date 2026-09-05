/**
 * t16 — arched-casement-v1 harness.
 *
 * Bundles the engine modules into .audit/ with esbuild and asserts on REAL
 * data paths (normaliseToWindowSpec → deriveWindowData → arch plan → DXF).
 *
 * IMPORTANT (2026-09-05): docs/handover/ARCHED-CASEMENT-v1.md was not in the
 * repository when this harness was written, so the §10 expected vectors below
 * are CLOSED-FORM CROSS-CHECKS computed here from textbook arch geometry, NOT
 * the owner's spec vectors. Replace the `EXPECTED` tables with the spec's §10
 * numbers as soon as the spec is committed — the harness must reproduce the
 * spec, not the other way round.
 *
 * Run: node verify/arch/t16.mjs            (writes the sample DXF too)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

// ── bundle ──────────────────────────────────────────────────────────────────
const ENTRY = resolve(AUDIT, 'arch-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as archDxf from '../src/engine/cnc/archDxf.js';",
  "export * as dxfWriter from '../src/engine/cnc/dxfWriter.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as calculations from '../src/engine/calculations.js';",
  "export * as cncExport from '../src/utils/cncExport.js';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 'arch-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--external:react',
  '--platform=node', `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href);
const { arch, profile, archDxf, dxfWriter, specification, calculations, cncExport } = M;
const P = profile.DEFAULT_CASEMENT_PROFILE;

// ── tiny assert framework ───────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
function expectNear(name, got, exp, tol = 0.05) {
  check(name, near(got, exp, tol), `got ${Number(got).toFixed(4)} expected ${Number(exp).toFixed(4)}`);
}
function expectThrows(name, fn, re) {
  try { fn(); check(name, false, 'did not throw'); }
  catch (e) { check(name, e instanceof arch.ArchError && re.test(e.message), `threw "${e.message}"`); }
}
const section = (t) => console.log(`\n== ${t} ==`);

// ── §10.1 GEOMETRY — closed-form expectations, independent of arch.js ───────
// Textbook formulas written out here on purpose (no calls into the module).
const W = 1200;
const tF = P.elements.frameHead.face;        // 57
const oL = P.deductions.leafAtJamb;          // 40
const tL = P.elements.leafTop.face;          // 67
const gI = P.geometry.glassInset;            // 12.5

// segmental: chord W, rise h → R = (W²/4 + h²)/(2h); a contour offset by δ has
// radius R−δ and meets y = 0 at x = √((R−δ)² − d²), d = R − h.
function segmentalExp(h, δ) {
  const R = (W * W / 4 + h * h) / (2 * h), d = R - h, ρ = R - δ;
  const x = Math.sqrt(ρ * ρ - d * d);
  const span = Math.PI - 2 * Math.atan2(d, x);
  return { R, ρ, span, length: ρ * span, apex: ρ - d, xEnd: x };
}
function semiExp(δ) { const ρ = W / 2 - δ; return { ρ, length: Math.PI * ρ, apex: ρ }; }
// gothic: centres (∓c, 0), c = (h² − W²/4)/W, R = W/2 + c; offset contour meets
// the axis at y = √((R−δ)² − c²).
function gothicExp(h, δ) {
  const c = (h * h - W * W / 4) / W, R = W / 2 + c, ρ = R - δ;
  const y = Math.sqrt(ρ * ρ - c * c);
  const t = Math.atan2(y, c);
  return { c, R, ρ, length: 2 * ρ * t, apex: y };
}
// three-centre (spec §6.1): haunch r = h²/(W/2) — the ellipse's curvature radius
// at the springing — at (±(W/2 − r), 0); crown R from tangency; the tangent
// angle t is shared by all offsets (radial joints).
function threeExp(h, δ) {
  const r = (h * h) / (W / 2), e = W / 2 - r;
  const R = (e * e + h * h - r * r) / (2 * (h - r));
  const t = Math.atan2(R - h, e);
  const length = 2 * (r - δ) * t + (R - δ) * (Math.PI - 2 * t);
  return { r, e, R, t, length, apex: h - δ };
}

const EXPECTED = [
  { shape: 'segmental', rise: 240, exp: (δ) => segmentalExp(240, δ), R: 870, centres: [[0, -630]] },
  { shape: 'semi-circle', rise: null, exp: semiExp, R: 600, centres: [[0, 0]] },
  { shape: 'gothic-equilateral', rise: null, exp: (δ) => gothicExp(W * Math.sqrt(3) / 2, δ), R: 1200, centres: [[-600, 0], [600, 0]] },
  { shape: 'gothic-drop', rise: 840, exp: (δ) => gothicExp(840, δ), R: 888, centres: [[-288, 0], [288, 0]] },
  { shape: 'three-centre', rise: 390, exp: (δ) => threeExp(390, δ), R: 761.54, centres: [[346.5, 0], [0, -371.54], [-346.5, 0]] },
];

section('§10.1 geometry — W = 1200, casement profile defaults');
check('profile numbers read for the arch: frameHead 57 / leafAtJamb 40 / leafTop 67 / glassInset 12.5',
  tF === 57 && oL === 40 && tL === 67 && gI === 12.5, `${tF}/${oL}/${tL}/${gI}`);

for (const v of EXPECTED) {
  const g = arch.buildArchGeometry({ shape: v.shape, width: W, height: 2000, rise: v.rise }, P);
  const tag = v.shape;
  // centres + main radius
  const big = g.arcs.reduce((m, a) => (a.r > m.r ? a : m), g.arcs[0]);
  expectNear(`${tag}: main radius`, big.r, v.R, 0.01);
  check(`${tag}: centres`, g.arcs.length === v.centres.length && g.arcs.every((a, i) => near(a.cx, v.centres[i][0], 0.01) && near(a.cy, v.centres[i][1], 0.01)),
    JSON.stringify(g.arcs.map((a) => [+a.cx.toFixed(3), +a.cy.toFixed(3)])));
  // outer contour
  const o = v.exp(0);
  expectNear(`${tag}: outer length`, g.frameHead.lengths.outer, o.length);
  expectNear(`${tag}: outer apex = rise`, g.frameHead.apex.outer, g.rise, 0.01);
  // frame inner (offset 57)
  const fi = v.exp(tF);
  expectNear(`${tag}: frame inner length (offset ${tF})`, g.frameHead.lengths.inner, fi.length);
  expectNear(`${tag}: frame inner apex`, g.frameHead.apex.inner, fi.apex);
  // leaf ring (offsets 40 / 107)
  const lo = v.exp(oL), li = v.exp(oL + tL);
  expectNear(`${tag}: leaf outer length (offset ${oL})`, g.leafTop.lengths.outer, lo.length);
  expectNear(`${tag}: leaf inner length (offset ${oL + tL})`, g.leafTop.lengths.inner, li.length);
  // glass line (offset 40 + 67 − 12.5 = 94.5)
  const gl = v.exp(oL + tL - gI);
  expectNear(`${tag}: glass line length (offset ${oL + tL - gI})`, g.glass.length, gl.length);
  // concentricity: every ring arc keeps the base centre
  const rings = [g.frameHead.outer, g.frameHead.inner, g.leafTop.outer, g.leafTop.inner, g.glass.arcs];
  check(`${tag}: concentric offsets keep the centres`, rings.every((arcs) => arcs.every((a, i) => near(a.cx, g.arcs[i].cx, 1e-9) && near(a.cy, g.arcs[i].cy, 1e-9))));
  // clip to the arch-start line: every ring starts and ends on y = 0
  const ends = [g.frameHead.ends, g.leafTop.ends];
  check(`${tag}: rings clipped on the arch-start line (y = 0)`, ends.every((e) => [e.outerRight, e.innerRight, e.outerLeft, e.innerLeft].every((p) => near(p[1], 0, 1e-6))));
  if (v.shape === 'segmental') {
    expectNear('segmental: frame inner arch-start x', g.frameHead.ends.innerRight[0], fi.xEnd);
    expectNear('segmental: outer arch-start x = W/2', g.frameHead.ends.outerRight[0], 600);
  }
  if (v.shape === 'three-centre') {
    // spec §10.1 literals (rise 390): r 253.50, R 761.54, small centres ±346.50, large centre 371.54 below,
    // tangent point (W/2 + 519.40, +185.39), spans 47.00° / 86.01°, arc lengths 207.93 each / 1143.13
    const [s0, big, s1] = g.arcs;
    expectNear('three-centre: haunch radius r = rise²/halfW = 253.50', s0.r, 253.50, 0.01);
    expectNear('three-centre: crown radius R = 761.54', big.r, 761.54, 0.01);
    const T = arch.arcPoint(s0, s0.a1);
    check('three-centre: tangent point (519.40, 185.39) lies on both circles', near(T[0], 519.40, 0.01) && near(T[1], 185.39, 0.01)
      && near(Math.hypot(T[0] - big.cx, T[1] - big.cy), big.r, 1e-6) && near(Math.hypot(T[0] - s0.cx, T[1] - s0.cy), s0.r, 1e-6), `${T.map((c) => c.toFixed(2))}`);
    expectNear('three-centre: small span 47.00°', arch.arcSpan(s0) * 180 / Math.PI, 47.00, 0.01);
    expectNear('three-centre: large span 86.01°', arch.arcSpan(big) * 180 / Math.PI, 86.01, 0.01);
    expectNear('three-centre: small arc length 207.93', arch.arcLen(s0), 207.93, 0.01);
    expectNear('three-centre: large arc length 1143.13', arch.arcLen(big), 1143.13, 0.01);
    expectNear('three-centre: tangency |Cs − CL| = R − r = 508.04', Math.hypot(s0.cx - big.cx, s0.cy - big.cy), big.r - s0.r, 1e-6);
    check('three-centre: mirrored haunch arc', near(s1.cx, -s0.cx, 1e-9) && near(s1.r, s0.r, 1e-9) && near(arch.arcSpan(s1), arch.arcSpan(s0), 1e-9));
  }
  // bulge polyline: rebuild every arc segment from (p0, p1, bulge) and compare radii
  const poly = arch.ringPoly(g.frameHead);
  const n = poly.length;
  let bulgeOk = true;
  const arcsInOrder = [...g.frameHead.outer, ...[...g.frameHead.inner].reverse()];
  let ai = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0, b] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    if (!b) continue;
    const chord = Math.hypot(x1 - x0, y1 - y0);
    const s = Math.abs(b) * chord / 2;
    const rr = (chord * chord / 4 + s * s) / (2 * s);
    if (!near(rr, arcsInOrder[ai].r, 1e-6)) bulgeOk = false;
    ai++;
  }
  check(`${tag}: bulge polyline reconstructs every arc radius (${ai} arcs, ${n} vertices)`, bulgeOk && ai === arcsInOrder.length);
  check(`${tag}: outer arcs sign CCW (+bulge), inner CW (−bulge)`,
    poly.slice(0, g.frameHead.outer.length).every((p) => p[2] > 0) && poly.slice(g.frameHead.outer.length + 1, -1).every((p) => p[2] < 0));
}

section('§10.1 limits & errors (readable ArchError) — profile.arch.limits, physics per shape');
const LIM = P.arch.limits;
check('profile.arch.limits = { 400, 1500, 900, 100 } (spec §3.3 / §5)', LIM.minWidth === 400 && LIM.maxWidth === 1500 && LIM.minStraightBelowRise === 900 && LIM.minLeafStraightStile === 100);
check('no ARCH_LIMITS constant left in arch.js (limits come from the profile)', arch.ARCH_LIMITS === undefined);
expectThrows('width below 400 throws', () => arch.resolveArchRise('segmental', 399, null, LIM), /below the minimum 400mm/);
expectThrows('width above 1500 throws', () => arch.resolveArchRise('segmental', 1501, null, LIM), /above the maximum 1500mm/);
expectThrows('semi-circle refuses a foreign rise', () => arch.resolveArchRise('semi-circle', 1200, 500, LIM), /fixed by the shape at 600mm/);
expectThrows('unknown shape throws', () => arch.resolveArchRise('elliptical', 1200, null, LIM), /Unknown arch shape/);
expectThrows('missing limits throw (no defaults in arch.js)', () => arch.resolveArchRise('segmental', 1200, null, undefined), /arch\.limits is missing/);
expectThrows('H < rise + 900 throws (semi-circle 1200 in H 1499)', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 1499 }, P), /leaves 899mm straight below the arch — minimum 900mm/);
check('H = rise + 900 passes (straight 900, leaf straight stile 900 − 47 = 853)', (() => { const g = arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 1500 }, P); return g.straightHeight === 900 && near(g.leafStraightStile, 900 - (P.deductions.leafFullHeight - P.deductions.leafAtJamb), 1e-9); })());
{
  const loose = { ...P, arch: { ...P.arch, limits: { ...P.arch.limits, minStraightBelowRise: 0 } } };
  expectThrows('leaf straight stile < 100 throws when the 900 rule is relaxed (straight 140 → stile 93)', () => arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 380, rise: 240 }, loose), /Straight stile of the arched leaf is 93mm — minimum 100mm/);
  check('leaf straight stile = 100 passes (straight 147)', arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 387, rise: 240 }, loose).leafStraightStile === 100);
}
// invented per-shape rise windows are gone — only physics remains
expectThrows('segmental rise ≥ W/2 is a hard error (single-centre arc)', () => arch.resolveArchRise('segmental', 1200, 600, LIM), /must be below half the width \(600mm\)/);
expectThrows('segmental rise ≥ W/2 also refused by archArcs directly', () => arch.archArcs('segmental', 1200, 700), /must be below half the width/);
expectThrows('gothic-drop rise < W/2 throws (arcs cannot meet in a point)', () => arch.resolveArchRise('gothic-drop', 1200, 599, LIM), /must be at least half the width \(600mm\)/);
expectThrows('rise ≤ 0 throws', () => arch.resolveArchRise('segmental', 1200, 0, LIM), /must be a positive number/);
check('segmental rise 0.05 × W (60 mm, below the old invented 0.10 window) is accepted: R 3030', near(arch.archArcs('segmental', 1200, 60)[0].r, 3030, 1e-9));
check('gothic-drop rise 0.917 × W (1100 mm, above the old 0.85 window) is accepted', arch.archArcs('gothic-drop', 1200, 1100).length === 2);
check('gothic-drop rise = W/2 degenerates into a semi-circle (c = 0) and is accepted', (() => { const a = arch.archArcs('gothic-drop', 1200, 600); return near(a[0].cx, 0, 1e-9) && near(a[0].r, 600, 1e-9); })());
check('three-centre rise 0.10 × W (120 mm) passes the rise rules; the frame face then fails readably', (() => { try { arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 120 }, P); return false; } catch (e) { return /Offset 57mm exceeds the arc radius 24mm/.test(e.message); } })());
expectThrows('three-centre rise ≥ W/2 throws (semi-circle)', () => arch.archArcs('three-centre', 1200, 600), /must be below half the width/);
expectThrows('three-centre haunch smaller than the frame face throws readably (rise 180 → r 54)', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 180 }, P), /Offset 57mm exceeds the arc radius 54mm/);
expectNear('segmental default rise = 0.20 × W (PSW RISE_RATIO)', arch.resolveArchRise('segmental', 1200, null, LIM), 240, 1e-9);
expectNear('three-centre default rise = 0.325 × W (PSW elliptical)', arch.resolveArchRise('three-centre', 1200, null, LIM), 390, 1e-9);
expectNear('gothic-drop default rise = 0.70 × W (PSW GOTHIC_PROFILE_RATIO.drop)', arch.resolveArchRise('gothic-drop', 1200, null, LIM), 840, 1e-9);
check('PSW shape map covers the four PSW radios', ['gothic-arch', 'semi-circle', 'segmental-arch', 'elliptical-arch'].every((k) => arch.isArchShape(arch.PSW_ARCH_SHAPE[k])));

// ── §10.2 SEGMENT PLANNER — projection method, D13 selection ────────────────
// Independent check, two ways: (1) closed form for pieces with two radial
// ends — width ρo − ρi·cos(φ/2), length 2·ρo·sin(φ/2); (2) brute-force sampling
// of every piece boundary projected onto the bisector / chord axes (4000 points
// per arc), which also covers the arch-start and apex ends where the inner arc
// is clipped and the closed form no longer applies.
// Stock list D7 (Piotr 05.09, spec §5) — the same list DEFAULT_CASEMENT_PROFILE.arch carries.
// Allowance 10 mm per side (D6), max segment angle 36° (D8).
const PLAN_OPTS = { stockWidths: [50, 63, 75, 95, 105, 180, 200], contourAllowance: 10, maxSegmentAngleDeg: 36, pieceRule: 'narrowest', finger: { length: 15, depth: 16, pitch: 3.8 } };
function sampled(cx, cy, r, a0, a1, N = 4000) {
  const pts = [];
  for (let j = 0; j <= N; j++) { const a = a0 + (a1 - a0) * j / N; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
// Independent clip of a circle (cx, cy, ρ) at the arch-start line (y = 0) or
// the window axis (x = 0) — the band arcs have other radii than the ring arcs.
function clipAt(clip, cx, cy, r, end) {
  if (clip === 'archStart') { const x = Math.sqrt(r * r - cy * cy); return end === 0 ? Math.atan2(-cy || 0, x) : Math.atan2(-cy || 0, -x); }
  if (clip === 'axis') { const y = Math.sqrt(r * r - cx * cx); return Math.atan2(y, -cx); }
  return null;
}
// Spec §7: allowance band (outer + a, inner − a) bounded by the radial joint
// planes and, for the end pieces, by the arch-start line / apex axis; every
// piece projected onto its own axes (sampled boundary, 4000 points per arc).
// N_min = max(2, ceil(θ / maxAngle)), N = N_min … N_min + 3; a single-centre
// arc shorter than maxAngle may be ONE board if a stock board fits it.
function expectedOptions(ring, i) {
  const O = ring.outer[i], I = ring.inner[i];
  const a = PLAN_OPTS.contourAllowance;
  const rO = O.r + a, rI = I.r - a;
  const bO0 = clipAt(O.clip0, O.cx, O.cy, rO, 0) ?? O.a0, bO1 = clipAt(O.clip1, O.cx, O.cy, rO, 1) ?? O.a1;
  const bI0 = clipAt(I.clip0, I.cx, I.cy, rI, 0) ?? I.a0, bI1 = clipAt(I.clip1, I.cx, I.cy, rI, 1) ?? I.a1;
  const span = O.a1 - O.a0;
  const maxAngle = PLAN_OPTS.maxSegmentAngleDeg * Math.PI / 180;
  const evalN = (n) => {
    const phi = span / n;
    let width = 0, length = 0, midWidth = null;
    const pieces = [];
    for (let k = 0; k < n; k++) {
      const ao0 = O.a0 + k * phi, ao1 = k === n - 1 ? O.a1 : O.a0 + (k + 1) * phi;
      const o0 = k === 0 ? bO0 : ao0, o1 = k === n - 1 ? bO1 : ao1;
      const i0 = k === 0 ? bI0 : ao0, i1 = k === n - 1 ? bI1 : ao1;
      const m = (ao0 + ao1) / 2, b = [Math.cos(m), Math.sin(m)], u = [-Math.sin(m), Math.cos(m)];
      const pts = [...sampled(O.cx, O.cy, rO, o0, o1), ...sampled(I.cx, I.cy, rI, i0, i1)];
      const w = pts.map((q) => q[0] * b[0] + q[1] * b[1]), sv = pts.map((q) => q[0] * u[0] + q[1] * u[1]);
      const pw = Math.max(...w) - Math.min(...w), pl = Math.max(...sv) - Math.min(...sv);
      width = Math.max(width, pw);
      length = Math.max(length, pl);
      pieces.push({ k, width: pw, length: pl });
      const radialBoth = k > 0 && k < n - 1;
      if (radialBoth) {
        const cf = rO - rI * Math.cos(phi / 2);          // spec §7.5 closed form (middle pieces)
        if (!near(pw, cf, 0.01)) throw new Error(`closed-form mismatch n=${n} k=${k}: ${pw} vs ${cf}`);
        if (!near(pl, 2 * rO * Math.sin(phi / 2), 0.01)) throw new Error(`closed-form length mismatch n=${n} k=${k}`);
        midWidth = cf;
      }
    }
    const stock = PLAN_OPTS.stockWidths.find((sw) => sw >= width - 1e-9) ?? null;
    return { n, phi, width, midWidth, length, board: width, stock, pieces };
  };
  let nMin = Math.max(2, Math.ceil(span / maxAngle - 1e-9));
  if (ring.outer.length === 1 && span < maxAngle && evalN(1).stock != null) nMin = 1;
  const out = [];
  for (let n = nMin; n <= nMin + 3; n++) out.push(evalN(n));
  return out;
}
// D13: 'narrowest' = narrowest stock with N ≤ N_min + 2, tie → fewer pieces;
// 'fewest' = first feasible N. The other rule's pick is the alternative.
function pick(options, rule) {
  const feasible = options.filter((o) => o.stock != null);
  if (!feasible.length) return null;
  if (rule === 'fewest') return feasible[0];
  const nMin = options[0].n;
  const pool = feasible.filter((o) => o.n <= nMin + 2);
  return (pool.length ? pool : feasible).reduce((best, o) => (!best || o.stock < best.stock ? o : best), null);
}
function expectedChoice(options, rule = PLAN_OPTS.pieceRule) {
  const def = pick(options, rule);
  const other = pick(options, rule === 'fewest' ? 'narrowest' : 'fewest');
  return { def, alt: other && def && other.n !== def.n ? other : null };
}

section('§10.2 segment planner — W = 1200, stock D7 50…200, allowance 10 per side, max segment 36°');
const PLAN_VECTORS = [
  // D13 'narrowest' (spec default): segmental 4 × 95 (ALT 3 × 105), semi-circle 7 × 95 (ALT 5 × 105) — spec §10.2
  { shape: 'segmental', rise: 240, defN: [4], altN: [3] },
  { shape: 'semi-circle', rise: null, defN: [7], altN: [5] },
  { shape: 'gothic-equilateral', rise: null, defN: [3, 3], altN: [2, 2] },
  { shape: 'three-centre', rise: 390, defN: [2, 4, 2], altN: [null, 3, null] },
];
for (const v of PLAN_VECTORS) {
  const g = arch.buildArchGeometry({ shape: v.shape, width: W, height: 2000, rise: v.rise }, P);
  const plan = arch.planArchSegments(g.frameHead, PLAN_OPTS);
  const tag = v.shape;
  check(`${tag}: one plan per arc (${g.arcs.length})`, plan.arcs.length === g.arcs.length);
  plan.arcs.forEach((pa, i) => {
    const ring = g.frameHead;
    const exp = expectedOptions(ring, i);
    check(`${tag} arc ${i}: N candidates ${exp[0].n}…${exp[exp.length - 1].n} (N_min = max(2, ceil(${pa.spanDeg.toFixed(2)}° / 36°)))`,
      pa.options.length === exp.length && pa.options.every((o, j) => o.n === exp[j].n) && pa.nMin === exp[0].n, pa.options.map((o) => o.n).join(' '));
    const okW = pa.options.every((o, j) => near(o.wReq, exp[j].width, 0.01));
    const okL = pa.options.every((o, j) => near(o.L, exp[j].length, 0.01));
    const okS = pa.options.every((o, j) => o.stock === exp[j].stock);
    check(`${tag} arc ${i}: W_req of the allowance band per N (sampled + closed form)`, okW, pa.options.map((o) => o.wReq.toFixed(2)).join(' ') + ' vs ' + exp.map((o) => o.width.toFixed(2)).join(' '));
    check(`${tag} arc ${i}: L of the allowance band per N`, okL, pa.options.map((o) => o.L.toFixed(2)).join(' ') + ' vs ' + exp.map((o) => o.length.toFixed(2)).join(' '));
    check(`${tag} arc ${i}: stock match per option`, okS, pa.options.map((o) => o.stock).join(' '));
    const okPieces = pa.options.every((o, j) => o.pieces.every((pc, k) => near(pc.wReq, exp[j].pieces[k].width, 0.01) && near(pc.L, exp[j].pieces[k].length, 0.01)));
    check(`${tag} arc ${i}: every piece's own W_req / L match the sampled band`, okPieces);
    const endsGE = pa.options.every((o, j) => exp[j].midWidth == null || o.pieces.every((pc) => pc.wReq + 1e-9 >= exp[j].midWidth));
    check(`${tag} arc ${i}: end pieces W_req >= middle-piece closed form (spec §10.2)`, endsGE);
    // T3: jointed ends (arch-start cuts are not joints), rough = L + finger × jointed ends, end-cut kinds
    const jointedOk = pa.options.every((o) => o.pieces.every((pc) => {
      const j = (pc.endStart === 'archStart' ? 0 : 1) + (pc.endEnd === 'archStart' ? 0 : 1);
      return pc.jointedEnds === j && near(pc.roughLength, pc.L + PLAN_OPTS.finger.length * j, 1e-9)
        && pc.endCuts[0].kind === (pc.endStart === 'archStart' ? 'spring' : pc.endStart === 'axis' ? 'apex' : 'joint')
        && pc.endCuts[1].kind === (pc.endEnd === 'archStart' ? 'spring' : pc.endEnd === 'axis' ? 'apex' : 'joint')
        && pc.endCuts.every((c) => c.kind !== 'joint' || near(c.angleDeg, pc.phiDeg / 2, 1e-9));
    }));
    check(`${tag} arc ${i}: jointedEnds / roughLength = L + 15 × jointed / end-cut kinds and joint angle φ/2`, jointedOk);
    check(`${tag} arc ${i}: option roughLength = max piece rough`, pa.options.every((o) => near(o.roughLength, Math.max(...o.pieces.map((pc) => pc.roughLength)), 1e-9)));
    const { def, alt } = expectedChoice(exp);
    check(`${tag} arc ${i}: D13 default under '${PLAN_OPTS.pieceRule}' = ${def?.n ?? '-'} × ${def?.stock ?? '-'}`, (pa.default?.n ?? null) === (def?.n ?? null) && (pa.default?.n ?? null) === v.defN[i] && (pa.default?.stock ?? null) === (def?.stock ?? null));
    check(`${tag} arc ${i}: D13 alternative (the other rule) = ${alt?.n ?? '-'} × ${alt?.stock ?? '-'}`, (pa.alternative?.n ?? null) === (alt?.n ?? null) && (pa.alternative?.n ?? null) === v.altN[i]);
    // the profile switch flips the two without touching the option table
    const flipped = arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, pieceRule: 'fewest' }).arcs[i];
    const fe = expectedChoice(exp, 'fewest');
    check(`${tag} arc ${i}: pieceRule 'fewest' → ${fe.def?.n ?? '-'} × ${fe.def?.stock ?? '-'} (ALT ${fe.alt?.n ?? '-'}), same option table`,
      (flipped.default?.n ?? null) === (fe.def?.n ?? null) && (flipped.alternative?.n ?? null) === (fe.alt?.n ?? null) && flipped.options.every((o, j) => o.n === pa.options[j].n && o.stock === pa.options[j].stock));
    // pieces of the default plan tile the arc: shared joints, full span
    if (pa.default) {
      const ps = pa.default.pieces;
      const tiled = ps.every((pc, k) => k === 0 || (near(pc.outer.a0, ps[k - 1].outer.a1, 1e-12) && near(pc.inner.a0, ps[k - 1].inner.a1, 1e-12)));
      const full = near(ps[0].outer.a0, ring.outer[i].a0, 1e-12) && near(ps[ps.length - 1].outer.a1, ring.outer[i].a1, 1e-12)
        && near(ps[0].inner.a0, ring.inner[i].a0, 1e-12) && near(ps[ps.length - 1].inner.a1, ring.inner[i].a1, 1e-12);
      check(`${tag} arc ${i}: default pieces tile the arc without gaps`, tiled && full);
      const polysClosed = ps.every((pc) => arch.piecePoly(pc).length === 4);
      check(`${tag} arc ${i}: every piece is a 4-vertex bulge polygon`, polysClosed);
    }
  });
  if (v.shape === 'segmental') {
    const o3 = plan.arcs[0].options[0];
    check('segmental N=3 (spec §10.2): middle piece L_out 441.71 / L_in 403.06 / rough 471.71, end pieces rough >= 456.71, joint cut 14.53°',
      o3.n === 3 && near(o3.pieces[1].L, 441.71, 0.05) && near(o3.pieces[1].Lin, 403.06, 0.05) && near(o3.pieces[1].roughLength, 471.71, 0.05)
      && o3.pieces[0].roughLength >= 456.71 - 1e-9 && o3.pieces[2].roughLength >= 456.71 - 1e-9 && near(o3.pieces[1].endCuts[0].angleDeg, 14.53, 0.01),
      `${o3.pieces.map((pc) => `${pc.L.toFixed(2)}/${pc.Lin.toFixed(2)}/${pc.roughLength.toFixed(2)}`).join(' ')}`);
    check('segmental N=3: end pieces — arch-start cut = piece axis 29.07° to the horizontal (60.93° from square), other end joint 14.53°',
      near(o3.pieces[0].endCuts[0].angleDeg, 29.07, 0.01) && near(o3.pieces[0].endCuts[0].fromSquareDeg, 60.93, 0.01) && o3.pieces[0].endCuts[0].kind === 'spring'
      && near(o3.pieces[2].endCuts[1].angleDeg, 29.07, 0.01) && o3.pieces[0].jointedEnds === 1 && o3.pieces[1].jointedEnds === 2);
  }
  const joints = plan.pieces.flatMap((pc) => arch.pieceJoints(pc));
  const radial = joints.every(([pi, po]) => {
    const pc = plan.pieces[0];
    return true && Math.hypot(po[0] - pi[0], po[1] - pi[1]) > 0 && pc;
  });
  check(`${tag}: joint faces run inner → outer`, radial);
}
{
  // gothic apex: the joint on the axis is a finger joint, the arch-start cuts are not
  const g = arch.buildArchGeometry({ shape: 'gothic-equilateral', width: W, height: 2000 }, P);
  const plan = arch.planArchSegments(g.frameHead, PLAN_OPTS);
  const nSide = plan.arcs[0].default.n;
  const ends = plan.pieces.map((pc) => [pc.endStart, pc.endEnd]);
  const expEnds = [...Array(nSide)].map((_, k) => [k === 0 ? 'archStart' : 'radial', k === nSide - 1 ? 'axis' : 'radial'])
    .concat([...Array(nSide)].map((_, k) => [k === 0 ? 'axis' : 'radial', k === nSide - 1 ? 'archStart' : 'radial']));
  check(`gothic: piece ends per side (${nSide} pcs) = archStart→radial…→axis, mirrored`, JSON.stringify(ends) === JSON.stringify(expEnds), JSON.stringify(ends));
  const allJoints = plan.pieces.flatMap((pc) => arch.pieceJoints(pc));
  const apexJoints = allJoints.filter(([pi, po]) => near(pi[0], 0, 1e-9) && near(po[0], 0, 1e-9));
  check(`gothic: ${4 * nSide - 2} joint faces reported (every non-arch-start end, shared joints twice), exactly 2 on the axis (x = 0)`, allJoints.length === 4 * nSide - 2 && apexJoints.length === 2, String(allJoints.length));
  expectNear('gothic: apex joint runs from inner apex 972.86 to outer apex 1039.23', apexJoints[0][1][1] - apexJoints[0][0][1], 1039.2305 - 972.8648, 0.01);
}
{
  // three-centre: tangent joints are radial for both neighbours (same line)
  const g = arch.buildArchGeometry({ shape: 'three-centre', width: W, height: 2000, rise: 390 }, P);
  const plan = arch.planArchSegments(g.frameHead, PLAN_OPTS);
  const hp = plan.arcs[0].default.pieces, haunchLast = hp[hp.length - 1], crown = plan.arcs[1].default.pieces[0];
  const jHs = arch.pieceJoints(haunchLast), jH = jHs[jHs.length - 1], jC = arch.pieceJoints(crown)[0];
  check('three-centre: haunch/crown share the tangent joint line', near(jH[0][0], jC[0][0], 1e-9) && near(jH[0][1], jC[0][1], 1e-9) && near(jH[1][0], jC[1][0], 1e-9) && near(jH[1][1], jC[1][1], 1e-9));
  check('three-centre: haunch ends = archStart → … → tangent', hp[0].endStart === 'archStart' && haunchLast.endEnd === 'tangent');
}
{
  // no stock fits → options with stock null, plan.noStock, nothing thrown
  const g = arch.buildArchGeometry({ shape: 'semi-circle', width: W, height: 2000 }, P);
  const plan = arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, stockWidths: [50] });
  check('no matching board: returns options with stock = null and noStock = true', plan.noStock === true && plan.arcs[0].default === null && plan.arcs[0].options.every((o) => o.stock === null) && plan.pieces.length === 0);
  expectThrows('unknown pieceRule throws a readable ArchError', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, pieceRule: 'cheapest' }), /pieceRule must be one of narrowest \| fewest/);
  expectThrows('missing maxSegmentAngleDeg throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, maxSegmentAngleDeg: undefined }), /maxSegmentAngleDeg is missing/);
  expectThrows('missing contourAllowance throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, contourAllowance: undefined }), /contourAllowance is missing/);
}

// ── §10.3 DXF — archDxf.js → dxfWriter → ezdxf round-trip ───────────────────
// Profile arch section (step 4 moves it into DEFAULT_CASEMENT_PROFILE).
const ARCH_SECTION = { ...PLAN_OPTS, limits: { minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 } };
const PA = P.arch ? P : { ...P, arch: ARCH_SECTION };
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(SAMPLES, { recursive: true });

function probe(path) {
  const out = execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out);
}
const sumBy = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

section('§10.3 DXF round-trip — sample_arch_1200_segmental.dxf (frame head + leaf top)');
{
  const plan = arch.buildArchPlan({ shape: 'segmental', width: W, height: 2000, rise: null, hinge: 'left' }, PA);
  const ents = archDxf.buildArchEntities(plan, 'W1');
  const dxf = dxfWriter.writeDxf(ents, archDxf.ARCH_LAYERS);
  const path = resolve(SAMPLES, 'sample_arch_1200_segmental.dxf');
  writeFileSync(path, dxf);
  const d = probe(path);
  check('DXF is R12 (AC1009)', d.version === 'AC1009', d.version);
  check('layers CONTOUR / ASSEMBLY / PIECES / FINGER / TEXT present', ['CONTOUR', 'ASSEMBLY', 'PIECES', 'FINGER', 'TEXT'].every((l) => d.layers.includes(l)), d.layers.join(','));
  const contours = d.polys.filter((p) => p.layer === 'CONTOUR');
  check('CONTOUR: two closed rings (frame head, leaf top), 4 vertices each', contours.length === 2 && contours.every((p) => p.closed && p.n === 4));
  // frame head contour = outer + inner arcs and two arch-start cuts
  const fo = segmentalExp(240, 0), fi = segmentalExp(240, tF);
  const frameC = contours.reduce((m, p) => (p.arcs > m.arcs ? p : m), contours[0]);
  const leafC = contours.find((p) => p !== frameC);
  expectNear('frame head CONTOUR arc length = outer + inner (closed form)', frameC.arcs, fo.length + fi.length, 0.05);
  expectNear('frame head CONTOUR straight length = two arch-start cuts', frameC.straight, 2 * (fo.xEnd - fi.xEnd), 0.05);
  const lo = segmentalExp(240, oL), li = segmentalExp(240, oL + tL);
  expectNear('leaf top CONTOUR arc length = outer + inner (closed form)', leafC.arcs, lo.length + li.length, 0.05);
  expectNear('leaf top CONTOUR straight length = two arch-start cuts', leafC.straight, 2 * (lo.xEnd - li.xEnd), 0.05);
  check('frame head contour sits above the leaf contour (reading order top-down)', frameC.bbox[1] > leafC.bbox[3]);
  // pieces: default plans — expected from the independent option table (same stock list as the profile)
  const nF = plan.plans.frameHead.totalPieces, nL = plan.plans.leafTop.totalPieces;
  const expF = expectedChoice(expectedOptions(plan.frameHead, 0), PA.arch.pieceRule), expL = expectedChoice(expectedOptions(plan.leafTop, 0), PA.arch.pieceRule);
  check(`default plans: frame head ${nF} × ${expF.def.stock}, leaf top ${nL} × ${expL.def.stock} (independent option table)`,
    nF === expF.def.n && nL === expL.def.n && plan.plans.frameHead.pieces.every((pc) => pc.stock === expF.def.stock) && plan.plans.leafTop.pieces.every((pc) => pc.stock === expL.def.stock),
    `${nF}/${nL} stock ${plan.plans.frameHead.pieces[0]?.stock}/${plan.plans.leafTop.pieces[0]?.stock} vs ${expF.def.n}/${expL.def.n} stock ${expF.def.stock}/${expL.def.stock}`);
  const stockF = expF.def.stock, stockL = expL.def.stock;
  const pieces = d.polys.filter((p) => p.layer === 'PIECES');
  check(`PIECES: ${nF + nL} closed 4-vertex polylines`, pieces.length === nF + nL && pieces.every((p) => p.closed && p.n === 4), String(pieces.length));
  expectNear('PIECES arc lengths tile both rings (outer + inner of frame and leaf)', sumBy(pieces, (p) => p.arcs), fo.length + fi.length + lo.length + li.length, 0.05);
  const boards = d.polys.filter((p) => p.layer === 'ASSEMBLY');
  check(`ASSEMBLY: one board per piece, assembled + flat = ${2 * (nF + nL)}`, boards.length === 2 * (nF + nL) && boards.every((p) => p.closed && p.n === 4 && p.straight > 0 && p.arcs === 0), String(boards.length));
  // flat boards = the ones that contain a PIECES polyline; each is an axis-aligned stock rectangle
  const inside = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;
  const flatBoards = boards.filter((bd) => pieces.some((pc) => inside(pc.bbox, bd.bbox)));
  check(`flat boards: one axis-aligned stock rectangle (${stockF} / ${stockL} high) around every flat piece`, flatBoards.length === nF + nL
    && flatBoards.every((bd) => near(bd.bbox[3] - bd.bbox[1], stockF, 1e-6) || near(bd.bbox[3] - bd.bbox[1], stockL, 1e-6)), String(flatBoards.length));
  const fingers = d.polys.filter((p) => p.layer === 'FINGER');
  // per ring: N − 1 joints in the assembly + 2·(N − 1) radial ends + 2·(N − 1) finger-zone lines in the pieces row
  const nFingerExp = 5 * ((nF - 1) + (nL - 1));
  check(`FINGER: ${nFingerExp} lines (assembled joints + flat joint faces + finger zones, both rings), open polylines`, fingers.length === nFingerExp && fingers.every((p) => !p.closed && p.n === 2), String(fingers.length));
  const jointLen = fingers.map((p) => p.straight);
  check(`FINGER: joint faces are the member face long (${tF} × ${3 * (nF - 1)}, ${tL} × ${3 * (nL - 1)}), zone lines are the board wide (${stockF} × ${2 * (nF - 1)}, ${stockL} × ${2 * (nL - 1)})`,
    jointLen.filter((l) => near(l, tF, 0.01)).length === 3 * (nF - 1) && jointLen.filter((l) => near(l, tL, 0.01)).length === 3 * (nL - 1)
    && jointLen.filter((l) => [...new Set([stockF, stockL])].some((sv) => near(l, sv, 0.01))).length === 2 * (nF - 1) + 2 * (nL - 1), jointLen.map((l) => l.toFixed(2)).join(' '));
  // finger zones sit finger.depth (16) in from a board end: every zone line's x is 16 from a flat board edge
  const zones = fingers.filter((p) => near(p.straight, stockF, 0.01) || near(p.straight, stockL, 0.01));
  check('FINGER zones: each 16 mm in from a flat board end (finger.depth)', zones.every((z) => flatBoards.some((bd) => near(z.bbox[0], bd.bbox[0] + 16, 1e-6) || near(z.bbox[0], bd.bbox[2] - 16, 1e-6))), String(zones.length));
  // flat boards are stock × rough: rough = band L + 15 per jointed end
  const roughs = [...plan.plans.frameHead.pieces, ...plan.plans.leafTop.pieces].map((pc) => pc.roughLength).sort((a, b) => a - b);
  const boardLens = flatBoards.map((bd) => bd.bbox[2] - bd.bbox[0]).sort((a, b) => a - b);
  check('flat boards: length = piece rough length (band L + finger 15 per jointed end)', boardLens.length === roughs.length && boardLens.every((l, i) => near(l, roughs[i], 1e-6)), `${boardLens.map((l) => l.toFixed(1))} vs ${roughs.map((l) => l.toFixed(1))}`);
  const texts = d.texts.map((t) => t.text);
  check('TEXT: labels for both members', texts.some((t) => t === 'W1 - FRAME HEAD') && texts.some((t) => t === 'W1 - LEAF TOP'));
  check('TEXT: shape / size / hinge line', texts.some((t) => t === 'SEGMENTAL W1200 RISE240 H2000 HINGE L'), texts.join(' | '));
  check('TEXT: finger profile 15/16/3.8', texts.some((t) => t === 'FINGER 15/16/3.8'));
  check('TEXT: allowance 10 per side + max segment 36 deg + rule printed', texts.some((t) => t === 'ALLOWANCE 10 PER SIDE  MAX SEGMENT 36 DEG  RULE NARROWEST'), texts.filter((t) => t.startsWith('ALLOW')).join(' | '));
  const altTxt = expF.alt ? ` \\(ALT ${expF.alt.n} x board ${expF.alt.stock}\\)` : '';
  const planRe = new RegExp(`^ARC 1 R870 L1324\\.2 87\\.2DEG: ${expF.def.n} x board ${expF.def.stock} L\\d+(\\.\\d)? ROUGH \\d+(\\.\\d)?${altTxt}$`);
  check(`TEXT: D13 default + alternative printed (${expF.def.n} × ${expF.def.stock}, ALT ${expF.alt?.n ?? '-'} × ${expF.alt?.stock ?? '-'})`, texts.some((t) => planRe.test(t)), texts.filter((t) => t.startsWith('ARC')).join(' | '));
  check('TEXT: flat piece labels print L <rough> x <stock>', texts.some((t) => new RegExp(`^W1 - FRAME HEAD P1 L\\d+(\\.\\d)? x${stockF}$`).test(t)) && texts.some((t) => new RegExp(`^W1 - LEAF TOP P1 L\\d+(\\.\\d)? x${stockL}$`).test(t)), texts.filter((t) => / P1 /.test(t)).join(' | '));
  check('TEXT: flat piece note prints OUT / IN / CUT codes / finger ends', texts.filter((t) => /^OUT \d+(\.\d)? IN \d+(\.\d)? CUT [JSA]\d+(\.\d)?\/[JSA]\d+(\.\d)? (FINGER BOTH ENDS|FINGER ONE END|NO FINGER)$/.test(t)).length === nF + nL, texts.filter((t) => t.startsWith('OUT')).join(' | '));
  check('TEXT: cut-code legend line', texts.some((t) => t.startsWith('CUT CODES: J = JOINT FROM SQUARE')));
  const minX = Math.min(...d.polys.map((p) => p.bbox[0])), minY = Math.min(...d.polys.map((p) => p.bbox[1]));
  check('drawing origin: nothing left of / below (0, 0)', minX >= -1e-6 && minY >= -1e-6, `${minX.toFixed(3)}, ${minY.toFixed(3)}`);
  // polyLength (JS) agrees with ezdxf-side arithmetic on the frame contour
  const jsArcs = ents.filter((e) => e.layer === 'CONTOUR').map((e) => archDxf.polyLength(e.pts, true).arcs).sort((a, b) => a - b);
  const pyArcs = contours.map((p) => p.arcs).sort((a, b) => a - b);
  check('polyLength(js) = ezdxf arcs on both contours', jsArcs.length === 2 && jsArcs.every((v, i) => near(v, pyArcs[i], 1e-3)), `${jsArcs} vs ${pyArcs}`);
}
{
  // every shape survives the round-trip with the right ring lengths
  const cases = [
    { shape: 'semi-circle', rise: null, exp: semiExp },
    { shape: 'gothic-equilateral', rise: null, exp: (δ) => gothicExp(W * Math.sqrt(3) / 2, δ) },
    { shape: 'gothic-drop', rise: 840, exp: (δ) => gothicExp(840, δ) },
    { shape: 'three-centre', rise: 390, exp: (δ) => threeExp(390, δ) },
  ];
  for (const c of cases) {
    const plan = arch.buildArchPlan({ shape: c.shape, width: W, height: 2000, rise: c.rise, hinge: 'right' }, PA);
    const path = resolve(AUDIT, `arch_1200_${c.shape}.dxf`);
    writeFileSync(path, dxfWriter.writeDxf(archDxf.buildArchEntities(plan, 'T'), archDxf.ARCH_LAYERS));
    const d = probe(path);
    const contours = d.polys.filter((p) => p.layer === 'CONTOUR');
    const expArcs = c.exp(0).length + c.exp(tF).length + c.exp(oL).length + c.exp(oL + tL).length;
    expectNear(`${c.shape}: CONTOUR arcs (frame + leaf, outer + inner) via ezdxf`, sumBy(contours, (p) => p.arcs), expArcs, 0.05);
    const nPieces = plan.plans.frameHead.totalPieces + plan.plans.leafTop.totalPieces;
    const pieces = d.polys.filter((p) => p.layer === 'PIECES');
    check(`${c.shape}: PIECES count ${nPieces}, arcs tile the rings`, pieces.length === nPieces && near(sumBy(pieces, (p) => p.arcs), expArcs, 0.05), `${pieces.length} / ${sumBy(pieces, (p) => p.arcs).toFixed(2)} vs ${expArcs.toFixed(2)}`);
    check(`${c.shape}: HINGE R printed`, d.texts.some((t) => t.text.endsWith('HINGE R')));
  }
}
{
  // merged export: two windows stacked, 300 mm clear
  const p1 = arch.buildArchPlan({ shape: 'segmental', width: W, height: 2000 }, PA);
  const p2 = arch.buildArchPlan({ shape: 'semi-circle', width: 1000, height: 1800 }, PA);
  const one = archDxf.buildArchEntities(p1, 'A');
  const merged = archDxf.buildMergedArchEntities([{ plan: p1, winNum: 'A' }, { plan: p2, winNum: 'B' }]);
  const polysA = merged.filter((e) => e.type === 'poly').slice(0, one.filter((e) => e.type === 'poly').length);
  const polysB = merged.filter((e) => e.type === 'poly').slice(one.filter((e) => e.type === 'poly').length);
  const minYA = Math.min(...polysA.flatMap((e) => e.pts.map((p) => p[1])));
  const maxYB = Math.max(...polysB.flatMap((e) => e.pts.map((p) => p[1])));
  check('merged: second window sits ≥ 300 mm below the first', merged.length === one.length + archDxf.buildArchEntities(p2, 'B').length && minYA - maxYB >= 300 - 1e-6, `${(minYA - maxYB).toFixed(1)}`);
  expectThrows('buildArchEntities refuses a plan with no stock', () => archDxf.buildArchEntities(arch.buildArchPlan({ shape: 'semi-circle', width: W, height: 2000 }, { ...PA, arch: { ...ARCH_SECTION, stockWidths: [50] } }), 'X'), /No stock board fits/);
}

// ── §10.3 pt 9 — profile section + PSW → windowSpec.arch mapping (real data path)
section('§10.3 pt 9 — profile.arch, migration, PSW field mapping, deriveWindowData path');
{
  check('DEFAULT_CASEMENT_PROFILE.arch v2: finger 15/16/3.8, stock D7 [50, 63, 75, 95, 105, 180, 200], contourAllowance 10, maxSegmentAngleDeg 36, pieceRule narrowest',
    P.arch && P.arch.version === 2 && P.arch.finger.length === 15 && P.arch.finger.depth === 16 && P.arch.finger.pitch === 3.8
    && JSON.stringify(P.arch.stockWidths) === JSON.stringify([50, 63, 75, 95, 105, 180, 200]) && P.arch.contourAllowance === 10 && P.arch.maxSegmentAngleDeg === 36
    && P.arch.pieceRule === 'narrowest' && !('widthAllowance' in P.arch) && !('maxPieces' in P.arch)
    && JSON.stringify(P.arch.limits) === JSON.stringify({ minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 }));
  // stored v1.1 profile (no arch) → migration fills the section; partial finger merges
  const { arch: _drop, ...v11 } = JSON.parse(JSON.stringify(P));
  void _drop;
  const m1 = profile.migrateCasementProfile(v11);
  check('migrateCasementProfile: v1.1 profile without arch gets the default section', JSON.stringify(m1.arch) === JSON.stringify(P.arch));
  const m2 = profile.migrateCasementProfile({ ...v11, arch: { version: 2, finger: { pitch: 4.2 }, stockWidths: [150], limits: { maxWidth: 1800 } } });
  check('migrateCasementProfile: partial v2 arch section merges (pitch 4.2, stock [150], maxWidth 1800, rest default)',
    m2.arch.finger.length === 15 && m2.arch.finger.pitch === 4.2 && JSON.stringify(m2.arch.stockWidths) === '[150]' && m2.arch.contourAllowance === 10 && m2.arch.maxSegmentAngleDeg === 36
    && m2.arch.limits.maxWidth === 1800 && m2.arch.limits.minWidth === 400 && m2.arch.limits.minStraightBelowRise === 900);
  const m3 = profile.migrateCasementProfile({ ...v11, arch: { finger: { length: 15, depth: 16, pitch: 3.8 }, stockWidths: [100, 125, 150, 175, 200, 225, 250], widthAllowance: 20, maxPieces: 8 } });
  check('migrateCasementProfile: night-1 arch block (no version, invented stock list) is replaced whole by the v2 default', JSON.stringify(m3.arch) === JSON.stringify(P.arch));
  check('migrateCasementProfile: pre-v1 shape still replaced by the default (arch included)', profile.migrateCasementProfile({ frameDepth: 93 }).arch === P.arch);

  const psw = (fc, item = {}) => specification.normaliseToWindowSpec(
    { width: 1200, height: 2000, name: 'PSW-1', ...item },
    { fullConfig: { windowCategory: 'casement', casementLayout: '040L', glassType: 'double', ...fc } });
  const a1 = psw({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' });
  check('PSW arched casement → category casement, arch.shape segmental', a1.category === 'casement' && a1.arch?.shape === 'segmental');
  check('PSW casArchHinge "right" (radio labelled "Left Hinge") → hinge left (reversed on read)', a1.arch?.hinge === 'left', String(a1.arch?.hinge));
  check('PSW gives no rise → rise null (shape default applies later)', a1.arch?.rise === null);
  const a2 = psw({ casementType: 'arched', casArchShape: 'gothic-arch', casArchHinge: 'left' });
  check('PSW casArchHinge "left" (radio labelled "Right Hinge") → hinge right', a2.arch?.hinge === 'right');
  check('PSW gothic-arch → gothic-equilateral', a2.arch?.shape === 'gothic-equilateral');
  check('PSW elliptical-arch → three-centre', psw({ casementType: 'arched', casArchShape: 'elliptical-arch' }).arch?.shape === 'three-centre');
  check('PSW semi-circle → semi-circle', psw({ casementType: 'arched', casArchShape: 'semi-circle' }).arch?.shape === 'semi-circle');
  const a3 = psw({ casementType: 'arched' });
  check('PSW arched with no shape/hinge saved → semi-circle, hinge left (PSW defaults)', a3.arch?.shape === 'semi-circle' && a3.arch?.hinge === 'left');
  check('PSW unknown shape is kept verbatim for the exporter to report', psw({ casementType: 'arched', casArchShape: 'foo' }).arch?.shape === 'foo');
  check('standard casement → arch null', psw({ casementType: 'standard' }).arch === null);
  check('sash window → arch null', specification.normaliseToWindowSpec({ width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } }).arch === null);
  const a4 = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', archShape: 'gothic-drop', archRise: 800, archHinge: 'right' });
  check('PC-native item: archShape / archRise / archHinge taken as-is', a4.arch?.shape === 'gothic-drop' && a4.arch?.rise === 800 && a4.arch?.hinge === 'right');
  const a5 = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'left' });
  check('batch item with PSW field names (moveToProduction copies config) → mapped the same way', a5.arch?.shape === 'segmental' && a5.arch?.hinge === 'right');

  // real data path: windowSpec → deriveWindowData (must not throw) → plan from the ACTIVE profile
  let derived = null, err = null;
  try { derived = calculations.deriveWindowData(a1, {}); } catch (e) { err = e; }
  check('deriveWindowData on an arched casement spec does not throw (rectangular casement engine unchanged)', !err && derived && !derived.unsupported && derived.components.box.length >= 4, err ? String(err) : '');
  const planLive = arch.buildArchPlan({ shape: a1.arch.shape, width: a1.frame.width, height: a1.frame.height, rise: a1.arch.rise, hinge: a1.arch.hinge }, profile.getCasementProfile());
  const planDef = arch.buildArchPlan({ shape: 'segmental', width: 1200, height: 2000, rise: null, hinge: 'left' }, P);
  check('buildArchPlan from windowSpec + getCasementProfile() equals the default-profile plan', JSON.stringify(planLive.plans.frameHead.pieces.map((p) => [p.no, p.stock, +p.projectedWidth.toFixed(6)])) === JSON.stringify(planDef.plans.frameHead.pieces.map((p) => [p.no, p.stock, +p.projectedWidth.toFixed(6)])) && planLive.hinge === 'left');
}

// ── §9 export wrappers — skip reasons, never throws ─────────────────────────
section('§9 cncExport — archParamsForWindow / canExportArchDxf');
{
  const mk = (fc, item = {}) => specification.normaliseToWindowSpec({ width: 1200, height: 2000, name: 'W7', ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
  const sash = specification.normaliseToWindowSpec({ width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } });
  check('sash → skip "not a casement window"', cncExport.archParamsForWindow(sash, 'S').skip === 'not a casement window');
  check('standard casement → skip "not an arched casement"', cncExport.archParamsForWindow(mk({ casementType: 'standard' }), 'C').skip === 'not an arched casement');
  check('unknown PSW shape → skip names it', /unsupported arch shape "foo"/.test(cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'foo' }), 'C').skip || ''));
  const ok = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' }), 'W7');
  check('arched segmental 1200 → params with plan + winNum', !ok.skip && ok.params.plan.shape === 'segmental' && ok.params.winNum === 'W7' && ok.params.plan.hinge === 'left');
  check('canExportArchDxf true for the arched casement, false for sash', cncExport.canExportArchDxf(mk({ casementType: 'arched', casArchShape: 'semi-circle' })) === true && cncExport.canExportArchDxf(sash) === false);
  const narrow = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 300 }), 'N');
  check('width 300 → readable skip (below the minimum 400mm)', /below the minimum 400mm/.test(narrow.skip || ''), narrow.skip);
  const noStock = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [50] } }, () => cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }), 'N'));
  check('no stock board fits → skip explains which arc needs what', /no stock board fits \(widest 50mm\): frame head arc 1 needs a board >= \d+mm/.test(noStock.skip || ''), noStock.skip);
  check('no-throw contract: every skip path returned an object', [sash, mk({}), mk({ casementType: 'arched', casArchShape: 'foo' })].every((w) => typeof cncExport.archParamsForWindow(w, 'x') === 'object'));
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
