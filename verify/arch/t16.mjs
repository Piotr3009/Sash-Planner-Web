/**
 * t16 — arched-casement-v1 harness (spec docs/handover/ARCHED-CASEMENT-v1.md §10).
 *
 * Bundles the engine modules into .audit/ with esbuild and asserts on REAL
 * data paths (normaliseToWindowSpec → deriveWindowData → arch plan → DXF →
 * ezdxf round-trip). The EXPECTED values are the spec's §10.1 / §10.2 vectors
 * (pre-computed by Piotr's session, W = 1200, faces 57 / 67, leafAtJamb 40,
 * allowance 10, finger 15, max segment 36°, stock D7); independent closed
 * forms and brute-force sampling written here cross-check the module where
 * the spec lists no number. Sections follow spec §10.3 items 1–10.
 *
 * Spec errata handled explicitly (BLOCKERS.md §6, both flagged for Piotr):
 *   E1  §10.1 segmental "arcLen_in 1237.41" = R_in × θ_out (unclipped arc);
 *       §6.2 clips every chain at the arch-start line ⇒ 1112.66. Both asserted.
 *   E2  §10.2 "LEAF segmental (R 830/763, θ 87.21°)" reuses the HEAD angle; the
 *       leaf ring's own clipped span is 81.24° ⇒ W_req 107.93 / 98.80 / 94.56,
 *       D13 default 5 × 95 (ALT 3 × 180). The spec's 111.1 / 100.6 and its
 *       "4 × 105" are reproduced from the head angle to prove the reading.
 *
 * Run: node verify/arch/t16.mjs            (writes the sample DXF too)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const DEG = 180 / Math.PI;

// ── constants shared by every section ───────────────────────────────────────
const W = 1200;
const tF = P.elements.frameHead.face;        // 57
const oL = P.deductions.leafAtJamb;          // 40
const tL = P.elements.leafTop.face;          // 67
const gI = P.geometry.glassInset;            // 12.5
const LIM = P.arch.limits;
check('profile numbers read for the arch: frameHead 57 / leafAtJamb 40 / leafTop 67 / glassInset 12.5',
  tF === 57 && oL === 40 && tL === 67 && gI === 12.5, `${tF}/${oL}/${tL}/${gI}`);

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 1 — rise defaults reproduce §3.2 for every shape / gothic profile
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 1 — rise = ratio × external width (spec §3.2)');
expectNear('segmental default rise = 0.20 × W (PSW RISE_RATIO)', arch.resolveArchRise('segmental', W, null, LIM), 240, 1e-9);
expectNear('three-centre default rise = 0.325 × W (PSW elliptical)', arch.resolveArchRise('three-centre', W, null, LIM), 390, 1e-9);
expectNear('semi-circle default rise = 0.50 × W', arch.resolveArchRise('semi-circle', W, null, LIM), 600, 1e-9);
expectNear('gothic equilateral default rise = √3/2 × W = 1039.23', arch.resolveArchRise('gothic-equilateral', W, null, LIM), 1039.23, 0.01);
expectNear('gothic-drop default rise = 0.70 × W (PSW GOTHIC_PROFILE_RATIO.drop)', arch.resolveArchRise('gothic-drop', W, null, LIM), 840, 1e-9);
check('GOTHIC_PROFILE_RATIO = { equilateral √3/2, drop 0.70, shallow 0.60 } (spec §3.2 / §5)',
  near(arch.GOTHIC_PROFILE_RATIO.equilateral, Math.sqrt(3) / 2, 1e-12) && arch.GOTHIC_PROFILE_RATIO.drop === 0.70 && arch.GOTHIC_PROFILE_RATIO.shallow === 0.60);
check('ARCH_RISE_RATIO covers the five PC shapes with the PSW ratios',
  arch.ARCH_RISE_RATIO.segmental === 0.20 && arch.ARCH_RISE_RATIO['semi-circle'] === 0.5 && arch.ARCH_RISE_RATIO['three-centre'] === 0.325
  && near(arch.ARCH_RISE_RATIO['gothic-equilateral'], Math.sqrt(3) / 2, 1e-12) && arch.ARCH_RISE_RATIO['gothic-drop'] === 0.70);
check('PSW shape map covers the four PSW radios', ['gothic-arch', 'semi-circle', 'segmental-arch', 'elliptical-arch'].every((k) => arch.isArchShape(arch.PSW_ARCH_SHAPE[k])));

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 2 — every chain in §10.1 within 0.01 mm / 0.01°
// §10.3 item 3 — offsets keep centres, reduce r by the face; clipped ends on y = 0
// §10.3 item 4 — three-centre tangency
// ═══════════════════════════════════════════════════════════════════════════
// Independent closed forms (used where the spec lists no number, e.g. offsets).
function segmentalExp(h, δ) {
  const R = (W * W / 4 + h * h) / (2 * h), d = R - h, ρ = R - δ;
  const x = Math.sqrt(ρ * ρ - d * d);
  const span = Math.PI - 2 * Math.atan2(d, x);
  return { R, ρ, span, length: ρ * span, apex: ρ - d, xEnd: x };
}
function semiExp(δ) { const ρ = W / 2 - δ; return { ρ, length: Math.PI * ρ, apex: ρ }; }
function gothicExp(h, δ) {
  const c = (h * h - W * W / 4) / W, R = W / 2 + c, ρ = R - δ;
  const y = Math.sqrt(ρ * ρ - c * c);
  const t = Math.atan2(y, c);
  return { c, R, ρ, length: 2 * ρ * t, apex: y };
}
function threeExp(h, δ) {
  const r = (h * h) / (W / 2), e = W / 2 - r;
  const R = (e * e + h * h - r * r) / (2 * (h - r));
  const t = Math.atan2(R - h, e);
  const length = 2 * (r - δ) * t + (R - δ) * (Math.PI - 2 * t);
  return { r, e, R, t, length, apex: h - δ };
}

// Spec §10.1 vectors, verbatim.
const SPEC_GEOMETRY = [
  { shape: 'segmental', rise: 240, exp: (δ) => segmentalExp(240, δ), R: 870, centres: [[0, -630]],
    spec: { Rout: 870.00, Rin: 813.00, thetaDeg: 87.21, lenOut: 1324.16, lenInUnclipped: 1237.41, centreBelow: 630.00, innerX: 513.88, leafRout: 830.00, leafRin: 763.00 } },
  { shape: 'semi-circle', rise: null, exp: semiExp, R: 600, centres: [[0, 0]],
    spec: { Rout: 600.00, Rin: 543.00, thetaDeg: 180, lenOut: 1884.96, lenIn: 1705.88 } },
  { shape: 'gothic-equilateral', rise: null, exp: (δ) => gothicExp(W * Math.sqrt(3) / 2, δ), R: 1200, centres: [[-600, 0], [600, 0]],
    spec: { rise: 1039.23, c: 600.00, Rout: 1200.00, Rin: 1143.00, spanDeg: 60, lenOutEach: 1256.64 } },
  { shape: 'gothic-drop', rise: 840, exp: (δ) => gothicExp(840, δ), R: 888, centres: [[-288, 0], [288, 0]],
    spec: { rise: 840.00, c: 288.00, Rout: 888.00, Rin: 831.00, spanDeg: 71.08, lenOutEach: 1101.56 } },
  { shape: 'three-centre', rise: 390, exp: (δ) => threeExp(390, δ), R: 761.54, centres: [[346.5, 0], [0, -371.54], [-346.5, 0]],
    spec: { r: 253.50, R: 761.54, smallCx: 346.50, largeBelow: 371.54, tangent: [519.40, 185.39], smallSpan: 47.00, largeSpan: 86.01, lenSmall: 207.93, lenLarge: 1143.13, csCl: 508.04 } },
];

section('§10.3 pt 2–4 — geometry, W = 1200, casement profile defaults (spec §10.1 vectors)');
const GEOM = {};
for (const v of SPEC_GEOMETRY) {
  const g = arch.buildArchGeometry({ shape: v.shape, width: W, height: 2000, rise: v.rise }, P);
  GEOM[v.shape] = g;
  const tag = v.shape, S = v.spec;
  const big = g.arcs.reduce((m, a) => (a.r > m.r ? a : m), g.arcs[0]);
  expectNear(`${tag}: main radius ${v.R}`, big.r, v.R, 0.01);
  check(`${tag}: centres ${JSON.stringify(v.centres)}`, g.arcs.length === v.centres.length && g.arcs.every((a, i) => near(a.cx, v.centres[i][0], 0.01) && near(a.cy, v.centres[i][1], 0.01)),
    JSON.stringify(g.arcs.map((a) => [+a.cx.toFixed(3), +a.cy.toFixed(3)])));
  // ── spec literals per shape ──
  if (tag === 'segmental') {
    const o = g.frameHead.outer[0], i = g.frameHead.inner[0];
    expectNear('segmental: R_out 870.00', o.r, S.Rout, 0.01);
    expectNear('segmental: R_in 813.00 (= R_out − frameHead.face)', i.r, S.Rin, 0.01);
    expectNear('segmental: theta 87.21°', arch.arcSpan(o) * DEG, S.thetaDeg, 0.01);
    expectNear('segmental: arcLen_out 1324.16', arch.arcLen(o), S.lenOut, 0.01);
    expectNear('segmental: centre 630.00 below the arch-start line', -o.cy, S.centreBelow, 0.01);
    expectNear('segmental: inner arc meets the arch-start line at x = W/2 ± 513.88', g.frameHead.ends.innerRight[0], S.innerX, 0.01);
    // E1: the spec's arcLen_in is R_in × θ_out (the unclipped concentric arc); §6.2 clips it at y = 0
    expectNear('segmental: spec "arcLen_in 1237.41" = R_in × θ_out, the UNCLIPPED inner arc (erratum E1)', i.r * arch.arcSpan(o), S.lenInUnclipped, 0.01);
    expectNear('segmental: arcLen_in of the inner arc CLIPPED at the arch-start line (spec §6.2) = 1112.55', arch.arcLen(i), 1112.55, 0.01);
    expectNear('segmental: clipped arcLen_in = closed form R_in × (π − 2·atan2(630, 513.88))', arch.arcLen(i), segmentalExp(240, tF).length, 1e-6);
    expectNear('segmental: leaf R_out 830.00 (= R_out − leafAtJamb)', g.leafTop.outer[0].r, S.leafRout, 0.01);
    expectNear('segmental: leaf R_in 763.00 (= leaf R_out − leafTop.face)', g.leafTop.inner[0].r, S.leafRin, 0.01);
    expectNear('segmental: leaf ring own clipped span 81.24° (E2 — the spec reuses the head 87.21° for the leaf)', arch.arcSpan(g.leafTop.outer[0]) * DEG, 81.24, 0.01);
  }
  if (tag === 'semi-circle') {
    const o = g.frameHead.outer[0], i = g.frameHead.inner[0];
    expectNear('semi-circle: R_out 600.00', o.r, S.Rout, 0.01);
    expectNear('semi-circle: R_in 543.00', i.r, S.Rin, 0.01);
    expectNear('semi-circle: theta 180°', arch.arcSpan(o) * DEG, S.thetaDeg, 0.01);
    expectNear('semi-circle: arcLen_out 1884.96', arch.arcLen(o), S.lenOut, 0.01);
    expectNear('semi-circle: arcLen_in 1705.88', arch.arcLen(i), S.lenIn, 0.01);
  }
  if (tag === 'gothic-equilateral' || tag === 'gothic-drop') {
    expectNear(`${tag}: rise ${S.rise}`, g.rise, S.rise, 0.01);
    expectNear(`${tag}: c ${S.c} (centres at ∓c)`, g.arcs[1].cx, S.c, 0.01);
    expectNear(`${tag}: R_out ${S.Rout}`, g.frameHead.outer[0].r, S.Rout, 0.01);
    expectNear(`${tag}: R_in ${S.Rin}`, g.frameHead.inner[0].r, S.Rin, 0.01);
    expectNear(`${tag}: span ${S.spanDeg}° each`, arch.arcSpan(g.frameHead.outer[0]) * DEG, S.spanDeg, 0.01);
    check(`${tag}: both arcs span the same angle`, near(arch.arcSpan(g.frameHead.outer[0]), arch.arcSpan(g.frameHead.outer[1]), 1e-9));
    expectNear(`${tag}: arcLen_out ${S.lenOutEach} each`, arch.arcLen(g.frameHead.outer[0]), S.lenOutEach, 0.01);
    expectNear(`${tag}: arcLen_out ${S.lenOutEach} (second arc)`, arch.arcLen(g.frameHead.outer[1]), S.lenOutEach, 0.01);
  }
  if (tag === 'three-centre') {
    const [s0, big3, s1] = g.arcs;
    expectNear('three-centre: haunch radius r = rise²/halfW = 253.50', s0.r, S.r, 0.01);
    expectNear('three-centre: crown radius R = 761.54', big3.r, S.R, 0.01);
    expectNear('three-centre: small centres x = W/2 ± 346.50', s0.cx, S.smallCx, 0.01);
    expectNear('three-centre: large centre 371.54 below the arch-start line', -big3.cy, S.largeBelow, 0.01);
    const T = arch.arcPoint(s0, s0.a1);
    check('three-centre: tangent point (W/2 + 519.40, arch-start + 185.39) lies on both circles', near(T[0], S.tangent[0], 0.01) && near(T[1], S.tangent[1], 0.01)
      && near(Math.hypot(T[0] - big3.cx, T[1] - big3.cy), big3.r, 1e-6) && near(Math.hypot(T[0] - s0.cx, T[1] - s0.cy), s0.r, 1e-6), `${T.map((c) => c.toFixed(2))}`);
    expectNear('three-centre: small span 47.00°', arch.arcSpan(s0) * DEG, S.smallSpan, 0.01);
    expectNear('three-centre: large span 86.01°', arch.arcSpan(big3) * DEG, S.largeSpan, 0.01);
    expectNear('three-centre: arcLen small 207.93 each', arch.arcLen(s0), S.lenSmall, 0.01);
    expectNear('three-centre: arcLen large 1143.13', arch.arcLen(big3), S.lenLarge, 0.01);
    expectNear('three-centre: tangency |Cs − CL| = R − r = 508.04', Math.hypot(s0.cx - big3.cx, s0.cy - big3.cy), S.csCl, 0.01);
    check('three-centre: |Cs − CL| equals R − r exactly', near(Math.hypot(s0.cx - big3.cx, s0.cy - big3.cy), big3.r - s0.r, 1e-6));
    check('three-centre: mirrored haunch arc', near(s1.cx, -s0.cx, 1e-9) && near(s1.r, s0.r, 1e-9) && near(arch.arcSpan(s1), arch.arcSpan(s0), 1e-9));
    check('three-centre: chain is tangent-continuous (shared end points at both tangent points)', (() => {
      const a = arch.arcPoint(s0, s0.a1), b = arch.arcPoint(big3, big3.a0), c = arch.arcPoint(big3, big3.a1), d = arch.arcPoint(s1, s1.a0);
      return near(a[0], b[0], 1e-6) && near(a[1], b[1], 1e-6) && near(c[0], d[0], 1e-6) && near(c[1], d[1], 1e-6);
    })());
  }
  // ── closed-form cross-checks for the rings the spec does not list ──
  const o = v.exp(0);
  expectNear(`${tag}: outer length (closed form)`, g.frameHead.lengths.outer, o.length);
  expectNear(`${tag}: outer apex = rise`, g.frameHead.apex.outer, g.rise, 0.01);
  const fi = v.exp(tF);
  expectNear(`${tag}: frame inner length (offset ${tF}, clipped)`, g.frameHead.lengths.inner, fi.length);
  expectNear(`${tag}: frame inner apex`, g.frameHead.apex.inner, fi.apex);
  const lo = v.exp(oL), li = v.exp(oL + tL);
  expectNear(`${tag}: leaf outer length (offset ${oL})`, g.leafTop.lengths.outer, lo.length);
  expectNear(`${tag}: leaf inner length (offset ${oL + tL})`, g.leafTop.lengths.inner, li.length);
  const gl = v.exp(oL + tL - gI);
  expectNear(`${tag}: glass line length (offset ${oL + tL - gI})`, g.glass.length, gl.length);
  // item 3: offsets keep the centres and reduce r by exactly the offset
  const rings = [[g.frameHead.outer, 0], [g.frameHead.inner, tF], [g.leafTop.outer, oL], [g.leafTop.inner, oL + tL], [g.glass.arcs, oL + tL - gI]];
  check(`${tag}: offsetChain keeps every centre`, rings.every(([arcs]) => arcs.every((a, i) => near(a.cx, g.arcs[i].cx, 1e-9) && near(a.cy, g.arcs[i].cy, 1e-9))));
  check(`${tag}: offsetChain reduces r by exactly the offset (0 / 57 / 40 / 107 / 94.5)`, rings.every(([arcs, d]) => arcs.every((a, i) => near(a.r, g.arcs[i].r - d, 1e-9))));
  const ends = [g.frameHead.ends, g.leafTop.ends];
  check(`${tag}: clipChainAtY — ring end points on y = 0 (|Δy| < 1e-6)`, ends.every((e) => [e.outerRight, e.innerRight, e.outerLeft, e.innerLeft].every((p) => near(p[1], 0, 1e-6))));
  check(`${tag}: clipped end x = ±sqrt(r² − cy²) (analytic, spec §6.2)`, [g.frameHead.outer, g.frameHead.inner, g.leafTop.outer, g.leafTop.inner].every((arcs) => {
    const a0 = arcs[0], a1 = arcs[arcs.length - 1];
    return near(arch.arcPoint(a0, a0.a0)[0], a0.cx + Math.sqrt(a0.r * a0.r - a0.cy * a0.cy), 1e-6) && near(arch.arcPoint(a1, a1.a1)[0], a1.cx - Math.sqrt(a1.r * a1.r - a1.cy * a1.cy), 1e-6);
  }));
  // bulge polyline rebuilds every arc radius (module-side; ezdxf round-trip in item 5)
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
    if (!near(Math.abs(b), Math.tan(arch.arcSpan(arcsInOrder[ai]) / 4), 1e-9)) bulgeOk = false;   // bulge = tan(Δ/4)
    ai++;
  }
  check(`${tag}: bulge polyline — one vertex per arc end, bulge = tan(Δ/4), radii rebuilt (${ai} arcs, ${n} vertices)`, bulgeOk && ai === arcsInOrder.length && n === 2 * g.arcs.length + 2);
  check(`${tag}: outer arcs sign CCW (+bulge), inner CW (−bulge)`,
    poly.slice(0, g.frameHead.outer.length).every((p) => p[2] > 0) && poly.slice(g.frameHead.outer.length + 1, -1).every((p) => p[2] < 0));
}

// ═══════════════════════════════════════════════════════════════════════════
// limits & errors (readable ArchError) — profile.arch.limits, physics per shape
// ═══════════════════════════════════════════════════════════════════════════
section('limits & errors (readable ArchError) — profile.arch.limits, physics per shape');
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
expectThrows('segmental rise ≥ W/2 is a hard error (single-centre arc)', () => arch.resolveArchRise('segmental', 1200, 600, LIM), /must be below half the width \(600mm\)/);
expectThrows('segmental rise ≥ W/2 also refused by archArcs directly', () => arch.archArcs('segmental', 1200, 700), /must be below half the width/);
expectThrows('gothic-drop rise < W/2 throws (arcs cannot meet in a point)', () => arch.resolveArchRise('gothic-drop', 1200, 599, LIM), /must be at least half the width \(600mm\)/);
expectThrows('three-centre rise ≥ W/2 throws (semi-circle)', () => arch.archArcs('three-centre', 1200, 600), /must be below half the width/);
expectThrows('three-centre haunch smaller than the frame face throws readably (rise 180 → r 54)', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 180 }, P), /Offset 57mm exceeds the arc radius 54mm/);
expectThrows('rise ≤ 0 throws', () => arch.resolveArchRise('segmental', 1200, 0, LIM), /must be a positive number/);
check('segmental rise 0.05 × W (60 mm, below the old invented 0.10 window) is accepted: R 3030', near(arch.archArcs('segmental', 1200, 60)[0].r, 3030, 1e-9));
check('gothic-drop rise 0.917 × W (1100 mm, above the old 0.85 window) is accepted', arch.archArcs('gothic-drop', 1200, 1100).length === 2);
check('gothic-drop rise = W/2 degenerates into a semi-circle (c = 0) and is accepted', (() => { const a = arch.archArcs('gothic-drop', 1200, 600); return near(a[0].cx, 0, 1e-9) && near(a[0].r, 600, 1e-9); })());
check('three-centre rise 0.10 × W (120 mm) passes the rise rules; the frame face then fails readably', (() => { try { arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 120 }, P); return false; } catch (e) { return /Offset 57mm exceeds the arc radius 24mm/.test(e.message); } })());

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 6 — segment plans reproduce §10.2
// ═══════════════════════════════════════════════════════════════════════════
// Independent option table: allowance band (outer + a, inner − a) bounded by
// the radial joint planes and, for the end pieces, by the arch-start line /
// apex axis; every piece projected onto its own axes (sampled boundary, 4000
// points per arc). N_min = max(2, ceil(θ / maxAngle)), N = N_min … N_min + 3;
// a single-centre arc shorter than maxAngle may be ONE board if a stock board
// fits it. Closed forms (spec §7.5) cross-checked on the middle pieces.
const PLAN_OPTS = { stockWidths: [50, 63, 75, 95, 105, 180, 200], contourAllowance: 10, maxSegmentAngleDeg: 36, pieceRule: 'narrowest', finger: { length: 15, depth: 16, pitch: 3.8 } };
check('PLAN_OPTS equals the profile arch block (stock D7, allowance 10, max 36°, narrowest, finger 15/16/3.8)',
  JSON.stringify(PLAN_OPTS.stockWidths) === JSON.stringify(P.arch.stockWidths) && PLAN_OPTS.contourAllowance === P.arch.contourAllowance
  && PLAN_OPTS.maxSegmentAngleDeg === P.arch.maxSegmentAngleDeg && PLAN_OPTS.pieceRule === P.arch.pieceRule && JSON.stringify(PLAN_OPTS.finger) === JSON.stringify(P.arch.finger));
function sampled(cx, cy, r, a0, a1, N = 4000) {
  const pts = [];
  for (let j = 0; j <= N; j++) { const a = a0 + (a1 - a0) * j / N; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function clipAt(clip, cx, cy, r, end) {
  if (clip === 'archStart') { const x = Math.sqrt(r * r - cy * cy); return end === 0 ? Math.atan2(-cy || 0, x) : Math.atan2(-cy || 0, -x); }
  if (clip === 'axis') { const y = Math.sqrt(r * r - cx * cx); return Math.atan2(y, -cx); }
  return null;
}
function expectedOptions(ring, i) {
  const O = ring.outer[i], I = ring.inner[i];
  const a = PLAN_OPTS.contourAllowance;
  const rO = O.r + a, rI = I.r - a;
  const bO0 = clipAt(O.clip0, O.cx, O.cy, rO, 0) ?? O.a0, bO1 = clipAt(O.clip1, O.cx, O.cy, rO, 1) ?? O.a1;
  const bI0 = clipAt(I.clip0, I.cx, I.cy, rI, 0) ?? I.a0, bI1 = clipAt(I.clip1, I.cx, I.cy, rI, 1) ?? I.a1;
  const span = O.a1 - O.a0;
  const maxAngle = PLAN_OPTS.maxSegmentAngleDeg / DEG;
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

// Spec §10.2 vectors, verbatim (allowance 10, finger 15, max segment 36°, stock D7).
const SPEC_PLANS = {
  headSegmental: {
    thetaDeg: 87.21,
    options: [
      { N: 3, phiDeg: 29.07, wReq: 102.70, Lout: 441.71, Lin: 403.06, cutDeg: 14.53, stock: 105, roughMid: 471.71, roughEnd: 456.71 },
      { N: 4, phiDeg: 21.80, wReq: 91.49, Lout: 332.85, Lin: 303.72, cutDeg: 10.90, stock: 95 },
      { N: 5, phiDeg: 17.44, wReq: 86.28, Lout: 266.86, stock: 95 },
    ],
    d13: { n: 4, stock: 95 }, runnerUp: { n: 3, stock: 105 },
  },
  leafSegmental: {
    // E2: the spec computed these with the HEAD angle 87.21°; the leaf ring's own clipped span is 81.24°
    specHeadAngle: { thetaDeg: 87.21, wReq3: 111.1, wReq4: 100.6, d13: { n: 4, stock: 105 }, runnerUp: { n: 3, stock: 180 } },
    ownAngle: { thetaDeg: 81.24, options: [{ N: 3, stock: 180 }, { N: 4, stock: 105 }, { N: 5, stock: 95 }], d13: { n: 5, stock: 95 }, runnerUp: { n: 3, stock: 180 } },
  },
  headSemi: {
    thetaDeg: 180,
    options: [
      { N: 5, phiDeg: 36, wReq: 103.09, Lout: 377.00, Lin: 329.41, cutDeg: 18, stock: 105, roughMid: 407.00, roughEnd: 392.00 },
      { N: 6, phiDeg: 30, wReq: 95.16, stock: 105 },
      { N: 7, phiDeg: 25.71, wReq: 90.36, stock: 95 },
    ],
    d13: { n: 7, stock: 95 }, runnerUp: { n: 5, stock: 105 },
  },
};

section('§10.3 pt 6 — segment plans, spec §10.2 vectors (== ±0.05 middle pieces, >= end pieces)');
function assertSpecPlan(label, planArc, S) {
  expectNear(`${label}: θ ${S.thetaDeg}°`, planArc.spanDeg, S.thetaDeg, 0.01);
  check(`${label}: N candidates start at ${S.options[0].N} (N_min = max(2, ceil(θ / 36°)))`, planArc.nMin === S.options[0].N && planArc.options[0].n === S.options[0].N, `nMin ${planArc.nMin}`);
  for (const so of S.options) {
    const o = planArc.options.find((x) => x.n === so.N);
    check(`${label} N=${so.N}: candidate present`, !!o);
    if (!o) continue;
    const mids = o.pieces.filter((pc) => pc.endStart === 'radial' && pc.endEnd === 'radial');
    const endsP = o.pieces.filter((pc) => pc.endStart !== 'radial' || pc.endEnd !== 'radial');
    expectNear(`${label} N=${so.N}: φ ${so.phiDeg}°`, o.pieces[0].phiDeg, so.phiDeg, 0.01);
    check(`${label} N=${so.N}: middle-piece W_req == ${so.wReq} (±0.05)`, mids.length > 0 && mids.every((pc) => near(pc.wReq, so.wReq, 0.05)), mids.map((pc) => pc.wReq.toFixed(3)).join(' '));
    const midActual = mids.length ? Math.max(...mids.map((pc) => pc.wReq)) : 0;
    check(`${label} N=${so.N}: end-piece W_req >= middle piece (exact) and >= ${so.wReq} − 0.05`, endsP.length === 2 && endsP.every((pc) => pc.wReq + 1e-9 >= midActual && pc.wReq + 0.05 >= so.wReq), endsP.map((pc) => pc.wReq.toFixed(3)).join(' '));
    check(`${label} N=${so.N}: option W_req = max over pieces, stock ${so.stock}`, near(o.wReq, Math.max(...o.pieces.map((pc) => pc.wReq)), 1e-9) && o.stock === so.stock, `wReq ${o.wReq.toFixed(3)} stock ${o.stock}`);
    if (so.Lout != null) check(`${label} N=${so.N}: middle-piece L_out ${so.Lout} (±0.05)`, mids.every((pc) => near(pc.L, so.Lout, 0.05)), mids.map((pc) => pc.L.toFixed(3)).join(' '));
    if (so.Lin != null) check(`${label} N=${so.N}: middle-piece L_in ${so.Lin} (±0.05)`, mids.every((pc) => near(pc.Lin, so.Lin, 0.05)), mids.map((pc) => pc.Lin.toFixed(3)).join(' '));
    if (so.cutDeg != null) check(`${label} N=${so.N}: joint end cut ${so.cutDeg}° (= φ/2)`, o.pieces.every((pc) => pc.endCuts.every((c) => c.kind !== 'joint' || near(c.angleDeg, so.cutDeg, 0.01))));
    if (so.roughMid != null) check(`${label} N=${so.N}: rough middle ${so.roughMid} (L_out + 2 × 15)`, mids.every((pc) => pc.jointedEnds === 2 && near(pc.roughLength, so.roughMid, 0.05)), mids.map((pc) => pc.roughLength.toFixed(3)).join(' '));
    if (so.roughEnd != null) check(`${label} N=${so.N}: rough end >= ${so.roughEnd} (L_out + 1 × 15; the band corner on the arch-start line may add length)`, endsP.every((pc) => pc.jointedEnds === 1 && pc.roughLength + 1e-9 >= so.roughEnd), endsP.map((pc) => pc.roughLength.toFixed(3)).join(' '));
  }
  check(`${label}: D13 default → ${S.d13.n} × ${S.d13.stock}`, planArc.default?.n === S.d13.n && planArc.default?.stock === S.d13.stock, `${planArc.default?.n} × ${planArc.default?.stock}`);
  check(`${label}: runner-up printed → ${S.runnerUp.n} × ${S.runnerUp.stock}`, planArc.alternative?.n === S.runnerUp.n && planArc.alternative?.stock === S.runnerUp.stock, `${planArc.alternative?.n} × ${planArc.alternative?.stock}`);
}
{
  const gS = GEOM.segmental, gC = GEOM['semi-circle'];
  assertSpecPlan('HEAD segmental 1200', arch.planArchSegments(gS.frameHead, P.arch).arcs[0], SPEC_PLANS.headSegmental);
  assertSpecPlan('HEAD semi-circle 1200', arch.planArchSegments(gC.frameHead, P.arch).arcs[0], SPEC_PLANS.headSemi);
  // LEAF segmental — erratum E2
  const L = SPEC_PLANS.leafSegmental;
  const leafArc = arch.planArchSegments(gS.leafTop, P.arch).arcs[0];
  const Ro = gS.leafTop.outer[0].r, Ri = gS.leafTop.inner[0].r, a = P.arch.contourAllowance;
  const wAt = (thetaDeg, n) => (Ro + a) - (Ri - a) * Math.cos((thetaDeg / DEG) / n / 2);
  expectNear('LEAF segmental (E2): spec W_req 111.1 for N=3 is the closed form with the HEAD angle 87.21°', wAt(L.specHeadAngle.thetaDeg, 3), L.specHeadAngle.wReq3, 0.05);
  expectNear('LEAF segmental (E2): spec W_req 100.6 for N=4 is the closed form with the HEAD angle 87.21°', wAt(L.specHeadAngle.thetaDeg, 4), L.specHeadAngle.wReq4, 0.05);
  expectNear('LEAF segmental: ring own clipped span 81.24° (spec §6.2)', leafArc.spanDeg, L.ownAngle.thetaDeg, 0.01);
  for (const so of L.ownAngle.options) {
    const o = leafArc.options.find((x) => x.n === so.N);
    const mids = o.pieces.filter((pc) => pc.endStart === 'radial' && pc.endEnd === 'radial');
    check(`LEAF segmental N=${so.N}: middle W_req == closed form at the own span (${wAt(L.ownAngle.thetaDeg, so.N).toFixed(2)}), stock ${so.stock}`,
      mids.every((pc) => near(pc.wReq, wAt(leafArc.spanDeg, so.N), 0.05)) && o.stock === so.stock, `${o.wReq.toFixed(2)} → ${o.stock}`);
  }
  check('LEAF segmental: N=3 → 180 (wasteful) and N=4 → 105 hold under both readings', leafArc.options.find((x) => x.n === 3).stock === 180 && leafArc.options.find((x) => x.n === 4).stock === 105);
  check(`LEAF segmental: D13 default at the own span → ${L.ownAngle.d13.n} × ${L.ownAngle.d13.stock} (spec says 4 × 105 from the head angle — E2), runner-up ${L.ownAngle.runnerUp.n} × ${L.ownAngle.runnerUp.stock}`,
    leafArc.default?.n === L.ownAngle.d13.n && leafArc.default?.stock === L.ownAngle.d13.stock && leafArc.alternative?.n === L.ownAngle.runnerUp.n && leafArc.alternative?.stock === L.ownAngle.runnerUp.stock,
    `${leafArc.default?.n} × ${leafArc.default?.stock}, alt ${leafArc.alternative?.n} × ${leafArc.alternative?.stock}`);
}

section('§10.3 pt 6 — planner vs independent option table, every shape, both D13 rules');
const PLAN_VECTORS = [
  { shape: 'segmental', defN: [4], altN: [3] },
  { shape: 'semi-circle', defN: [7], altN: [5] },
  { shape: 'gothic-equilateral', defN: [3, 3], altN: [2, 2] },
  { shape: 'gothic-drop', defN: [3, 3], altN: [2, 2] },
  { shape: 'three-centre', defN: [2, 4, 2], altN: [null, 3, null] },
];
const PLANS = {};
for (const v of PLAN_VECTORS) {
  const g = GEOM[v.shape];
  const plan = arch.planArchSegments(g.frameHead, PLAN_OPTS);
  PLANS[v.shape] = plan;
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
    const flipped = arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, pieceRule: 'fewest' }).arcs[i];
    const fe = expectedChoice(exp, 'fewest');
    check(`${tag} arc ${i}: pieceRule 'fewest' → ${fe.def?.n ?? '-'} × ${fe.def?.stock ?? '-'} (ALT ${fe.alt?.n ?? '-'}), same option table`,
      (flipped.default?.n ?? null) === (fe.def?.n ?? null) && (flipped.alternative?.n ?? null) === (fe.alt?.n ?? null) && flipped.options.every((o, j) => o.n === pa.options[j].n && o.stock === pa.options[j].stock));
    if (pa.default) {
      const ps = pa.default.pieces;
      const tiled = ps.every((pc, k) => k === 0 || (near(pc.outer.a0, ps[k - 1].outer.a1, 1e-12) && near(pc.inner.a0, ps[k - 1].inner.a1, 1e-12)));
      const full = near(ps[0].outer.a0, ring.outer[i].a0, 1e-12) && near(ps[ps.length - 1].outer.a1, ring.outer[i].a1, 1e-12)
        && near(ps[0].inner.a0, ring.inner[i].a0, 1e-12) && near(ps[ps.length - 1].inner.a1, ring.inner[i].a1, 1e-12);
      check(`${tag} arc ${i}: default pieces tile the arc without gaps`, tiled && full);
      check(`${tag} arc ${i}: every piece is a 4-vertex bulge polygon (finished + band)`, ps.every((pc) => arch.piecePoly(pc).length === 4 && arch.pieceBandPoly(pc).length === 4));
    }
  });
  const joints = plan.pieces.flatMap((pc) => arch.pieceJoints(pc));
  check(`${tag}: joint faces run inner → outer (non-zero, ${joints.length} faces)`, joints.length > 0 && joints.every(([pi, po]) => Math.hypot(po[0] - pi[0], po[1] - pi[1]) > 0));
}
{
  const plan = PLANS['gothic-equilateral'];
  const nSide = plan.arcs[0].default.n;
  const ends = plan.pieces.map((pc) => [pc.endStart, pc.endEnd]);
  const expEnds = [...Array(nSide)].map((_, k) => [k === 0 ? 'archStart' : 'radial', k === nSide - 1 ? 'axis' : 'radial'])
    .concat([...Array(nSide)].map((_, k) => [k === 0 ? 'axis' : 'radial', k === nSide - 1 ? 'archStart' : 'radial']));
  check(`gothic: piece ends per side (${nSide} pcs) = archStart→radial…→axis, mirrored`, JSON.stringify(ends) === JSON.stringify(expEnds), JSON.stringify(ends));
  const allJoints = plan.pieces.flatMap((pc) => arch.pieceJoints(pc));
  const apexJoints = allJoints.filter(([pi, po]) => near(pi[0], 0, 1e-9) && near(po[0], 0, 1e-9));
  check(`gothic: ${4 * nSide - 2} joint faces reported (every non-arch-start end, shared joints twice), exactly 2 on the axis (x = 0)`, allJoints.length === 4 * nSide - 2 && apexJoints.length === 2, String(allJoints.length));
  expectNear('gothic: apex joint runs from inner apex 972.86 to outer apex 1039.23', apexJoints[0][1][1] - apexJoints[0][0][1], 1039.2305 - 972.8648, 0.01);
  const apexCut = plan.pieces[nSide - 1].endCuts[1];
  check('gothic: apex end cut kind "apex", from-square = piece axis to the horizontal', apexCut.kind === 'apex' && near(apexCut.fromSquareDeg, plan.pieces[nSide - 1].axisAngleDeg, 1e-9));
}
{
  const plan = PLANS['three-centre'];
  const hp = plan.arcs[0].default.pieces, haunchLast = hp[hp.length - 1], crown = plan.arcs[1].default.pieces[0];
  const jHs = arch.pieceJoints(haunchLast), jH = jHs[jHs.length - 1], jC = arch.pieceJoints(crown)[0];
  check('three-centre: haunch/crown share the tangent joint line', near(jH[0][0], jC[0][0], 1e-9) && near(jH[0][1], jC[0][1], 1e-9) && near(jH[1][0], jC[1][0], 1e-9) && near(jH[1][1], jC[1][1], 1e-9));
  check('three-centre: haunch ends = archStart → … → tangent', hp[0].endStart === 'archStart' && haunchLast.endEnd === 'tangent');
}
{
  const g = GEOM['semi-circle'];
  const plan = arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, stockWidths: [50] });
  check('no matching board: returns options with stock = null and noStock = true', plan.noStock === true && plan.arcs[0].default === null && plan.arcs[0].options.every((o) => o.stock === null) && plan.pieces.length === 0);
  expectThrows('unknown pieceRule throws a readable ArchError', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, pieceRule: 'cheapest' }), /pieceRule must be one of narrowest \| fewest/);
  expectThrows('missing maxSegmentAngleDeg throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, maxSegmentAngleDeg: undefined }), /maxSegmentAngleDeg is missing/);
  expectThrows('missing contourAllowance throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, contourAllowance: undefined }), /contourAllowance is missing/);
  expectThrows('missing finger length throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, finger: {} }), /finger\.length is missing/);
  // a short single-centre arc: one board allowed only when a stock board fits it.
  // The rise must still exceed the deepest ring offset (leaf inner 107), so a
  // span below 36° only exists on wide, very flat arches: W 1500, rise 110 → R 2611.8, θ 33.4°
  expectThrows('segmental rise 60 < leaf ring depth 107 → readable error (contour does not reach the arch-start line)', () => arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 2000, rise: 60 }, P), /does not reach the arch-start line/);
  const shallow = arch.buildArchGeometry({ shape: 'segmental', width: 1500, height: 2000, rise: 110 }, P);
  const p1 = arch.planArchSegments(shallow.frameHead, PLAN_OPTS);
  check(`shallow segmental (θ ${p1.arcs[0].spanDeg.toFixed(1)}° < 36°): N_min 1 when a board fits (W_req ${p1.arcs[0].options[0].wReq.toFixed(1)} → ${p1.arcs[0].options[0].stock})`, p1.arcs[0].nMin === 1 && p1.arcs[0].options[0].stock != null);
  const p2 = arch.planArchSegments(shallow.frameHead, { ...PLAN_OPTS, stockWidths: [95] });
  check('shallow segmental with only 95 mm stock: N=1 does not fit → N_min 2', p2.arcs[0].nMin === 2 && p2.arcs[0].options[0].n === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 7 — every board contains its piece's allowance band (plan data)
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 7 — stock boards contain the allowance band (point-in-rectangle on sampled band points)');
function bandContained(pc, stock) {
  const { b, u } = pc.axes;
  const [sMin, sMax] = pc.extents.s;
  const wLo = pc.extents.w[0] - (stock - pc.wReq) / 2, wHi = wLo + stock;
  const pts = [...sampled(pc.band.outer.cx, pc.band.outer.cy, pc.band.outer.r, pc.band.outer.a0, pc.band.outer.a1, 400),
    ...sampled(pc.band.inner.cx, pc.band.inner.cy, pc.band.inner.r, pc.band.inner.a0, pc.band.inner.a1, 400)];
  return pts.every((q) => { const s = q[0] * u[0] + q[1] * u[1], w = q[0] * b[0] + q[1] * b[1]; return s >= sMin - 1e-6 && s <= sMax + 1e-6 && w >= wLo - 1e-6 && w <= wHi + 1e-6; });
}
for (const shape of Object.keys(PLANS)) {
  const plan = PLANS[shape];
  check(`${shape}: every default piece's band (outer + 10 / inner − 10) fits inside its stock × L board`, plan.pieces.every((pc) => bandContained(pc, pc.stock)));
  check(`${shape}: the finished piece contour lies inside the band (r_out < band r_out, r_in > band r_in, angles within)`, plan.pieces.every((pc) =>
    pc.outer.r < pc.band.outer.r && pc.inner.r > pc.band.inner.r && pc.outer.a0 >= pc.band.outer.a0 - 1e-9 && pc.outer.a1 <= pc.band.outer.a1 + 1e-9));
  // every option (not only the default) — the DXF may print any of them as ALT
  check(`${shape}: bands fit their boards for every feasible option`, plan.arcs.every((a) => a.options.every((o) => o.stock == null || o.pieces.every((pc) => bandContained(pc, o.stock)))));
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 5 — bulge polylines through dxfWriter → ezdxf; DXF structure
// ═══════════════════════════════════════════════════════════════════════════
const ARCH_SECTION = { ...PLAN_OPTS, limits: { minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 } };
const PA = P.arch ? P : { ...P, arch: ARCH_SECTION };
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(SAMPLES, { recursive: true });

function probe(path) {
  const out = execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out);
}
const sumBy = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
// point in a convex polygon (CCW or CW), tolerance in mm
function inPoly(q, pts, tol = 1e-6) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const cr = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const d = cr / len;
    if (Math.abs(d) <= tol) continue;
    if (sign === 0) sign = Math.sign(d);
    else if (Math.sign(d) !== sign) return false;
  }
  return true;
}

section('§10.3 pt 5 — DXF round-trip via ezdxf — sample_arch_1200_segmental.dxf (frame head + leaf top)');
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
  check('CONTOUR: two closed rings (frame head, leaf top), exactly one vertex per arc end point (4 each)', contours.length === 2 && contours.every((p) => p.closed && p.n === 4));
  const frameC = contours.reduce((m, p) => (p.arcs > m.arcs ? p : m), contours[0]);
  const leafC = contours.find((p) => p !== frameC);
  // item 5 proper: arc length recomputed from vertices + bulges = arcLength(chain) within 0.01
  expectNear('frame head CONTOUR: ezdxf arc length (vertices + bulges) = arcLength(outer) + arcLength(inner) within 0.01', frameC.arcs, plan.frameHead.lengths.outer + plan.frameHead.lengths.inner, 0.01);
  expectNear('leaf top CONTOUR: ezdxf arc length = arcLength(outer) + arcLength(inner) within 0.01', leafC.arcs, plan.leafTop.lengths.outer + plan.leafTop.lengths.inner, 0.01);
  const fo = segmentalExp(240, 0), fi = segmentalExp(240, tF), lo = segmentalExp(240, oL), li = segmentalExp(240, oL + tL);
  expectNear('frame head CONTOUR arc length = closed form (1324.16 + 1112.66)', frameC.arcs, fo.length + fi.length, 0.01);
  expectNear('frame head CONTOUR straight length = two arch-start cuts (2 × (600 − 513.88))', frameC.straight, 2 * (fo.xEnd - fi.xEnd), 0.01);
  expectNear('leaf top CONTOUR arc length = closed form', leafC.arcs, lo.length + li.length, 0.01);
  expectNear('leaf top CONTOUR straight length = two arch-start cuts', leafC.straight, 2 * (lo.xEnd - li.xEnd), 0.01);
  check('CONTOUR bulges: |bulge| = tan(Δ/4) of the arcs (two arcs in the frame ring, 0 on the cuts)', (() => {
    const exp = [Math.tan(arch.arcSpan(plan.frameHead.outer[0]) / 4), 0, Math.tan(arch.arcSpan(plan.frameHead.inner[0]) / 4), 0];
    return frameC.bulges.length === 4 && frameC.bulges.every((b, i) => near(Math.abs(b), exp[i], 1e-5));   // dxfWriter writes 6 decimals
  })(), frameC.bulges.map((b) => b.toFixed(4)).join(' '));
  check('frame head contour sits above the leaf contour (reading order top-down)', frameC.bbox[1] > leafC.bbox[3]);
  // plans in the sample = spec D13 (narrowest): head 4 × 95 (ALT 3 × 105); leaf at its own span 5 × 95 (ALT 3 × 180)
  const nF = plan.plans.frameHead.totalPieces, nL = plan.plans.leafTop.totalPieces;
  const expF = expectedChoice(expectedOptions(plan.frameHead, 0), PA.arch.pieceRule), expL = expectedChoice(expectedOptions(plan.leafTop, 0), PA.arch.pieceRule);
  check(`sample plans: frame head ${nF} × ${expF.def.stock}, leaf top ${nL} × ${expL.def.stock} (independent option table)`,
    nF === expF.def.n && nL === expL.def.n && plan.plans.frameHead.pieces.every((pc) => pc.stock === expF.def.stock) && plan.plans.leafTop.pieces.every((pc) => pc.stock === expL.def.stock),
    `${nF}/${nL} stock ${plan.plans.frameHead.pieces[0]?.stock}/${plan.plans.leafTop.pieces[0]?.stock} vs ${expF.def.n}/${expL.def.n} stock ${expF.def.stock}/${expL.def.stock}`);
  check('sample plans = spec §10.2 D13: head 4 × 95 (runner-up 3 × 105) — never a single solid board', nF === 4 && expF.def.stock === 95 && expF.alt.n === 3 && expF.alt.stock === 105 && nL >= 2);
  const stockF = expF.def.stock, stockL = expL.def.stock;
  const pieces = d.polys.filter((p) => p.layer === 'PIECES');
  check(`PIECES: ${nF + nL} closed 4-vertex polylines`, pieces.length === nF + nL && pieces.every((p) => p.closed && p.n === 4), String(pieces.length));
  expectNear('PIECES arc lengths tile both rings (outer + inner of frame and leaf)', sumBy(pieces, (p) => p.arcs), fo.length + fi.length + lo.length + li.length, 0.05);
  const boards = d.polys.filter((p) => p.layer === 'ASSEMBLY');
  check(`ASSEMBLY: one board per piece, assembled + flat = ${2 * (nF + nL)}`, boards.length === 2 * (nF + nL) && boards.every((p) => p.closed && p.n === 4 && p.straight > 0 && p.arcs === 0), String(boards.length));
  const inside = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;
  const flatBoards = boards.filter((bd) => pieces.some((pc) => inside(pc.bbox, bd.bbox)));
  const assembled = boards.filter((bd) => !flatBoards.includes(bd));
  check(`flat boards: one axis-aligned stock rectangle (${stockF} / ${stockL} high) around every flat piece (item 7: flatOutline inside stock × rough)`, flatBoards.length === nF + nL
    && flatBoards.every((bd) => near(bd.bbox[3] - bd.bbox[1], stockF, 1e-6) || near(bd.bbox[3] - bd.bbox[1], stockL, 1e-6)), String(flatBoards.length));
  const roughs = [...plan.plans.frameHead.pieces, ...plan.plans.leafTop.pieces].map((pc) => pc.roughLength).sort((a, b) => a - b);
  const boardLens = flatBoards.map((bd) => bd.bbox[2] - bd.bbox[0]).sort((a, b) => a - b);
  check('flat boards: length = piece rough length (band L + finger 15 per jointed end)', boardLens.length === roughs.length && boardLens.every((l, i) => near(l, roughs[i], 1e-6)), `${boardLens.map((l) => l.toFixed(1))} vs ${roughs.map((l) => l.toFixed(1))}`);
  // item 7 on the DXF: assembled boards (world coords) contain the sampled band of their ring
  {
    const v0 = frameC.pts[0];                       // outer arc start = (W/2, 0) in arch coords
    const dx = v0[0] - W / 2, dy = v0[1];
    const bandPts = plan.plans.frameHead.pieces.flatMap((pc) => [
      ...sampled(pc.band.outer.cx, pc.band.outer.cy, pc.band.outer.r, pc.band.outer.a0, pc.band.outer.a1, 200),
      ...sampled(pc.band.inner.cx, pc.band.inner.cy, pc.band.inner.r, pc.band.inner.a0, pc.band.inner.a1, 200)]).map((q) => [q[0] + dx, q[1] + dy]);
    check('assembled boards (ASSEMBLY, world coords) contain every sampled point of the frame head allowance band (item 7: placedOutline ⊇ band)',
      bandPts.every((q) => assembled.some((bd) => inPoly(q, bd.pts, 1e-6))), `${bandPts.filter((q) => !assembled.some((bd) => inPoly(q, bd.pts, 1e-6))).length} points outside`);
  }
  const fingers = d.polys.filter((p) => p.layer === 'FINGER');
  const nFingerExp = 5 * ((nF - 1) + (nL - 1));
  check(`FINGER: ${nFingerExp} lines (assembled joints + flat joint faces + finger zones, both rings), open polylines`, fingers.length === nFingerExp && fingers.every((p) => !p.closed && p.n === 2), String(fingers.length));
  const jointLen = fingers.map((p) => p.straight);
  check(`FINGER: joint faces are the member face long (${tF} × ${3 * (nF - 1)}, ${tL} × ${3 * (nL - 1)}), zone lines are the board wide (${stockF} × ${2 * (nF - 1)}, ${stockL} × ${2 * (nL - 1)})`,
    jointLen.filter((l) => near(l, tF, 0.01)).length === 3 * (nF - 1) && jointLen.filter((l) => near(l, tL, 0.01)).length === 3 * (nL - 1)
    && jointLen.filter((l) => [...new Set([stockF, stockL])].some((sv) => near(l, sv, 0.01))).length === 2 * (nF - 1) + 2 * (nL - 1), jointLen.map((l) => l.toFixed(2)).join(' '));
  const zones = fingers.filter((p) => near(p.straight, stockF, 0.01) || near(p.straight, stockL, 0.01));
  check('FINGER zones: each 16 mm in from a flat board end (finger.depth)', zones.every((z) => flatBoards.some((bd) => near(z.bbox[0], bd.bbox[0] + 16, 1e-6) || near(z.bbox[0], bd.bbox[2] - 16, 1e-6))), String(zones.length));
  const texts = d.texts.map((t) => t.text);
  check('TEXT: labels for both members', texts.some((t) => t === 'W1 - FRAME HEAD') && texts.some((t) => t === 'W1 - LEAF TOP'));
  check('TEXT: shape / size / hinge line', texts.some((t) => t === 'SEGMENTAL W1200 RISE240 H2000 HINGE L'), texts.join(' | '));
  check('TEXT: finger profile 15/16/3.8', texts.some((t) => t === 'FINGER 15/16/3.8'));
  check('TEXT: allowance 10 per side + max segment 36 deg + rule printed', texts.some((t) => t === 'ALLOWANCE 10 PER SIDE  MAX SEGMENT 36 DEG  RULE NARROWEST'), texts.filter((t) => t.startsWith('ALLOW')).join(' | '));
  const altTxt = expF.alt ? ` \\(ALT ${expF.alt.n} x board ${expF.alt.stock}\\)` : '';
  const planRe = new RegExp(`^ARC 1 R870 L1324\\.2 87\\.2DEG: ${expF.def.n} x board ${expF.def.stock} L\\d+(\\.\\d)? ROUGH \\d+(\\.\\d)?${altTxt}$`);
  check(`TEXT: D13 default + runner-up printed (${expF.def.n} × ${expF.def.stock}, ALT ${expF.alt?.n ?? '-'} × ${expF.alt?.stock ?? '-'})`, texts.some((t) => planRe.test(t)), texts.filter((t) => t.startsWith('ARC')).join(' | '));
  check('TEXT: flat piece labels print L <rough> x <stock>', texts.some((t) => new RegExp(`^W1 - FRAME HEAD P1 L\\d+(\\.\\d)? x${stockF}$`).test(t)) && texts.some((t) => new RegExp(`^W1 - LEAF TOP P1 L\\d+(\\.\\d)? x${stockL}$`).test(t)), texts.filter((t) => / P1 /.test(t)).join(' | '));
  check('TEXT: flat piece note prints OUT / IN / CUT codes / finger ends', texts.filter((t) => /^OUT \d+(\.\d)? IN \d+(\.\d)? CUT [JSA]\d+(\.\d)?\/[JSA]\d+(\.\d)? (FINGER BOTH ENDS|FINGER ONE END|NO FINGER)$/.test(t)).length === nF + nL, texts.filter((t) => t.startsWith('OUT')).join(' | '));
  check('TEXT: cut-code legend line', texts.some((t) => t.startsWith('CUT CODES: J = JOINT FROM SQUARE')));
  const minX = Math.min(...d.polys.map((p) => p.bbox[0])), minY = Math.min(...d.polys.map((p) => p.bbox[1]));
  check('drawing origin: nothing left of / below (0, 0)', minX >= -1e-6 && minY >= -1e-6, `${minX.toFixed(3)}, ${minY.toFixed(3)}`);
  const jsArcs = ents.filter((e) => e.layer === 'CONTOUR').map((e) => archDxf.polyLength(e.pts, true).arcs).sort((a, b) => a - b);
  const pyArcs = contours.map((p) => p.arcs).sort((a, b) => a - b);
  check('polyLength(js) = ezdxf arcs on both contours', jsArcs.length === 2 && jsArcs.every((v, i) => near(v, pyArcs[i], 1e-3)), `${jsArcs} vs ${pyArcs}`);
}
{
  // every shape survives the round-trip: CONTOUR arc lengths (ezdxf) = arcLength(chains) within 0.01, pieces tile the rings
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
    const chainLen = plan.frameHead.lengths.outer + plan.frameHead.lengths.inner + plan.leafTop.lengths.outer + plan.leafTop.lengths.inner;
    expectNear(`${c.shape}: CONTOUR arcs via ezdxf = arcLength(chains) within 0.01`, sumBy(contours, (p) => p.arcs), chainLen, 0.01);
    const expArcs = c.exp(0).length + c.exp(tF).length + c.exp(oL).length + c.exp(oL + tL).length;
    expectNear(`${c.shape}: CONTOUR arcs = closed form`, sumBy(contours, (p) => p.arcs), expArcs, 0.05);
    check(`${c.shape}: CONTOUR vertices = one per arc end point (${2 * plan.arcs.length + 2} per ring), closed`, contours.length === 2 && contours.every((p) => p.closed && p.n === 2 * plan.arcs.length + 2));
    const nPieces = plan.plans.frameHead.totalPieces + plan.plans.leafTop.totalPieces;
    const pieces = d.polys.filter((p) => p.layer === 'PIECES');
    check(`${c.shape}: PIECES count ${nPieces}, arcs tile the rings`, pieces.length === nPieces && near(sumBy(pieces, (p) => p.arcs), expArcs, 0.05), `${pieces.length} / ${sumBy(pieces, (p) => p.arcs).toFixed(2)} vs ${expArcs.toFixed(2)}`);
    const boards = d.polys.filter((p) => p.layer === 'ASSEMBLY');
    const inside = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;
    check(`${c.shape}: every flat piece sits inside an axis-aligned stock × rough board (item 7)`, pieces.every((pc) => boards.some((bd) => inside(pc.bbox, bd.bbox))));
    check(`${c.shape}: HINGE R printed`, d.texts.some((t) => t.text.endsWith('HINGE R')));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 8 — export functions (real cncExport path, browser download stubbed)
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 8 — cncExport: canExportArchDxf, archParamsForWindow, merged export');
{
  const mk = (fc, item = {}) => specification.normaliseToWindowSpec({ width: 1200, height: 2000, name: 'W7', ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
  const sash = specification.normaliseToWindowSpec({ width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } });
  const door = specification.normaliseToWindowSpec({ width: 1000, height: 2100 }, { fullConfig: { windowCategory: 'door' } });
  check('sash → skip "not a casement window"', cncExport.archParamsForWindow(sash, 'S').skip === 'not a casement window');
  check('standard casement → skip "not an arched casement"', cncExport.archParamsForWindow(mk({ casementType: 'standard' }), 'C').skip === 'not an arched casement');
  const ok = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' }), 'W7');
  check('arched segmental 1200 → params with plan + winNum', !ok.skip && ok.params.plan.shape === 'segmental' && ok.params.winNum === 'W7' && ok.params.plan.hinge === 'left');
  check('canExportArchDxf: true for the arched casement, false for a rectangular casement, sash and door',
    cncExport.canExportArchDxf(mk({ casementType: 'arched', casArchShape: 'semi-circle' })) === true && cncExport.canExportArchDxf(mk({ casementType: 'standard' })) === false
    && cncExport.canExportArchDxf(sash) === false && cncExport.canExportArchDxf(door) === false);
  const narrow = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 300 }), 'N');
  check('width 300 → readable skip (below the minimum 400mm)', /below the minimum 400mm/.test(narrow.skip || ''), narrow.skip);
  const low = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { height: 1400 }), 'L');
  check('H 1400 with rise 600 → readable skip (800 straight < 900)', /leaves 800mm straight below the arch — minimum 900mm/.test(low.skip || ''), low.skip);
  const noStock = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [50] } }, () => cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }), 'N'));
  check('no stock board fits → skip explains which arc needs what', /no stock board fits \(widest 50mm\): frame head arc 1 needs a board >= \d+mm/.test(noStock.skip || ''), noStock.skip);
  check('no-throw contract: every skip path returned an object', [sash, door, mk({})].every((w) => typeof cncExport.archParamsForWindow(w, 'x') === 'object'));
  // merged export end-to-end: stub the browser download, read the Blob back, probe with ezdxf
  let lastBlob = null, lastName = null, clicks = 0;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ set href(v) {}, set download(v) { lastName = v; }, click() { clicks++; }, remove() {} }) };
  const origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (b) => { lastBlob = b; return 'blob:harness'; };
  URL.revokeObjectURL = () => {};
  const windows = [
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' }), name: 'A' },
    { windowSpec: sash, name: 'S' },
    { windowSpec: mk({ casementType: 'standard' }), name: 'C' },
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 1000, height: 1800 }), name: 'B' },
  ];
  const r = cncExport.exportArchDxfMerged(windows, 'Pack 1');
  check('exportArchDxfMerged: exports the 2 arched windows, skips sash + rectangular casement with reasons', r.ok === true && r.exported === 2 && r.skipped.length === 2
    && r.skipped.some((s) => s.name === 'S' && s.reason === 'not a casement window') && r.skipped.some((s) => s.name === 'C' && s.reason === 'not an arched casement'), JSON.stringify(r));
  check('exportArchDxfMerged: one download named Pack_1_arch.dxf', clicks === 1 && lastName === 'Pack_1_arch.dxf', String(lastName));
  const mergedText = await lastBlob.text();
  const mergedPath = resolve(AUDIT, 'merged_pack.dxf');
  writeFileSync(mergedPath, mergedText);
  const dm = probe(mergedPath);
  const contoursA = dm.polys.filter((p) => p.layer === 'CONTOUR');
  check('merged DXF: 4 CONTOUR rings (2 windows × head + leaf), labels A and B', contoursA.length === 4 && dm.texts.some((t) => t.text === 'A - FRAME HEAD') && dm.texts.some((t) => t.text === 'B - FRAME HEAD'));
  {
    const p1 = arch.buildArchPlan({ shape: 'segmental', width: W, height: 2000 }, PA);
    const p2 = arch.buildArchPlan({ shape: 'semi-circle', width: 1000, height: 1800 }, PA);
    const one = archDxf.buildArchEntities(p1, 'A');
    const merged = archDxf.buildMergedArchEntities([{ plan: p1, winNum: 'A' }, { plan: p2, winNum: 'B' }]);
    const nA = one.filter((e) => e.type === 'poly').length;
    const polysA = merged.filter((e) => e.type === 'poly').slice(0, nA);
    const polysB = merged.filter((e) => e.type === 'poly').slice(nA);
    const minYA = Math.min(...polysA.flatMap((e) => e.pts.map((p) => p[1])));
    const maxYB = Math.max(...polysB.flatMap((e) => e.pts.map((p) => p[1])));
    check('merged: second window stacked exactly 300 mm below the first (MERGE_GAP)', merged.length === one.length + archDxf.buildArchEntities(p2, 'B').length && near(minYA - maxYB, 300, 1e-6), `${(minYA - maxYB).toFixed(1)}`);
  }
  const none = cncExport.exportArchDxfMerged([{ windowSpec: sash, name: 'S' }], 'Pack 2');
  check('exportArchDxfMerged with no arched window → error + skipped, no download', none.error === 'No arched casements in this pack' && none.skipped.length === 1 && clicks === 1);
  const single = cncExport.exportArchDxfForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }), 'Win 3');
  check('exportArchDxfForWindow: download named Win_3_arch.dxf', single.ok === true && lastName === 'Win_3_arch.dxf' && clicks === 2);
  check('exportArchDxfForWindow on a sash → error, no download', cncExport.exportArchDxfForWindow(sash, 'S').error === 'not a casement window' && clicks === 2);
  expectThrows('buildArchEntities refuses a plan with no stock', () => archDxf.buildArchEntities(arch.buildArchPlan({ shape: 'semi-circle', width: W, height: 2000 }, { ...PA, arch: { ...ARCH_SECTION, stockWidths: [50] } }), 'X'), /No stock board fits/);
  URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke; delete globalThis.document;
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 9 — normaliseToWindowSpec: PSW fullConfig → windowSpec.arch
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 9 — normaliseToWindowSpec PSW mapping, riseSource, unknown shape throws; profile + migration');
{
  const psw = (fc, item = {}) => specification.normaliseToWindowSpec(
    { width: 1200, height: 2000, name: 'PSW-1', ...item },
    { fullConfig: { windowCategory: 'casement', casementLayout: '040L', glassType: 'double', ...fc } });
  // the spec vector, verbatim
  const s9 = psw({ casementType: 'arched', casArchShape: 'elliptical-arch', 'cas-arch-opening': 'right' });
  check('spec vector: casementType arched + casArchShape elliptical-arch + cas-arch-opening right → shape three-centre, hinge left, rise 390, riseSource ratio',
    s9.category === 'casement' && s9.arch?.shape === 'three-centre' && s9.arch?.hinge === 'left' && near(s9.arch?.rise, 390, 1e-9) && s9.arch?.riseSource === 'ratio' && s9.arch?.profile === null, JSON.stringify(s9.arch));
  expectThrows('unknown PSW shape throws (never a silent rectangle)', () => psw({ casementType: 'arched', casArchShape: 'foo' }), /Unknown PSW arch shape "foo" on window "PSW-1"/);
  expectThrows('unknown PC-native shape throws', () => specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', archShape: 'oval' }), /Unknown arch shape "oval"/);
  const a1 = psw({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' });
  check('PSW arched casement → category casement, arch.shape segmental, rise 240 (ratio 0.20)', a1.category === 'casement' && a1.arch?.shape === 'segmental' && near(a1.arch?.rise, 240, 1e-9) && a1.arch?.riseSource === 'ratio');
  check('PSW casArchHinge "right" (radio labelled "Left Hinge") → hinge left (reversed on read)', a1.arch?.hinge === 'left', String(a1.arch?.hinge));
  const a2 = psw({ casementType: 'arched', casArchShape: 'gothic-arch', casArchHinge: 'left' });
  check('PSW casArchHinge "left" (radio labelled "Right Hinge") → hinge right', a2.arch?.hinge === 'right');
  check('PSW gothic-arch → gothic-equilateral, profile equilateral, rise 1039.23', a2.arch?.shape === 'gothic-equilateral' && a2.arch?.profile === 'equilateral' && near(a2.arch?.rise, 1039.23, 0.01));
  const a2d = psw({ casementType: 'arched', casArchShape: 'gothic-arch', archProfile: 'drop' });
  check('PSW gothic-arch + archProfile drop → gothic-drop, rise 0.70 × W = 840', a2d.arch?.shape === 'gothic-drop' && a2d.arch?.profile === 'drop' && near(a2d.arch?.rise, 840, 1e-9));
  const a2s = psw({ casementType: 'arched', casArchShape: 'gothic-arch', archProfile: 'shallow' });
  check('PSW gothic-arch + archProfile shallow → gothic-drop, rise 0.60 × W = 720', a2s.arch?.shape === 'gothic-drop' && a2s.arch?.profile === 'shallow' && near(a2s.arch?.rise, 720, 1e-9));
  check('PSW semi-circle → semi-circle, rise 600', (() => { const s = psw({ casementType: 'arched', casArchShape: 'semi-circle' }); return s.arch?.shape === 'semi-circle' && near(s.arch?.rise, 600, 1e-9); })());
  const a3 = psw({ casementType: 'arched' });
  check('PSW arched with no shape/hinge saved → semi-circle, hinge left (PSW defaults)', a3.arch?.shape === 'semi-circle' && a3.arch?.hinge === 'left');
  check('standard casement → arch null', psw({ casementType: 'standard' }).arch === null);
  check('sash window → arch null', specification.normaliseToWindowSpec({ width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } }).arch === null);
  const a4 = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', archShape: 'gothic-drop', archRise: 800, archHinge: 'right' });
  check('PC-native item: archShape / archRise / archHinge taken as-is, riseSource custom', a4.arch?.shape === 'gothic-drop' && a4.arch?.rise === 800 && a4.arch?.riseSource === 'custom' && a4.arch?.hinge === 'right');
  const a5 = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'left' });
  check('batch item with PSW field names (moveToProduction copies config) → mapped the same way', a5.arch?.shape === 'segmental' && a5.arch?.hinge === 'right');
  check('rise follows the width: W 1000 segmental → 200', near(psw({ casementType: 'arched', casArchShape: 'segmental-arch' }, { width: 1000 }).arch?.rise, 200, 1e-9));
  // real data path: windowSpec → deriveWindowData (must not throw) → plan from the ACTIVE profile
  let derived = null, err = null;
  try { derived = calculations.deriveWindowData(a1, {}); } catch (e) { err = e; }
  check('deriveWindowData on an arched casement spec does not throw (rectangular casement engine unchanged)', !err && derived && !derived.unsupported && derived.components.box.length >= 4, err ? String(err) : '');
  const planLive = arch.buildArchPlan({ shape: a1.arch.shape, width: a1.frame.width, height: a1.frame.height, rise: a1.arch.rise, hinge: a1.arch.hinge }, profile.getCasementProfile());
  const planDef = arch.buildArchPlan({ shape: 'segmental', width: 1200, height: 2000, rise: null, hinge: 'left' }, P);
  check('buildArchPlan from windowSpec + getCasementProfile() equals the default-profile plan', JSON.stringify(planLive.plans.frameHead.pieces.map((p) => [p.no, p.stock, +p.wReq.toFixed(6)])) === JSON.stringify(planDef.plans.frameHead.pieces.map((p) => [p.no, p.stock, +p.wReq.toFixed(6)])) && planLive.hinge === 'left');

  // profile block + migration
  check('DEFAULT_CASEMENT_PROFILE.arch v2: finger 15/16/3.8, stock D7 [50, 63, 75, 95, 105, 180, 200], contourAllowance 10, maxSegmentAngleDeg 36, pieceRule narrowest, limits',
    P.arch && P.arch.version === 2 && P.arch.finger.length === 15 && P.arch.finger.depth === 16 && P.arch.finger.pitch === 3.8
    && JSON.stringify(P.arch.stockWidths) === JSON.stringify([50, 63, 75, 95, 105, 180, 200]) && P.arch.contourAllowance === 10 && P.arch.maxSegmentAngleDeg === 36
    && P.arch.pieceRule === 'narrowest' && !('widthAllowance' in P.arch) && !('maxPieces' in P.arch)
    && JSON.stringify(P.arch.limits) === JSON.stringify({ minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 }));
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
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 10 — frozen files untouched (git diff against the merge base with main)
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 10 — casementLayouts.js / lists.js / calculations.js unchanged (git diff vs merge-base with main)');
{
  const FROZEN = ['src/engine/casementLayouts.js', 'src/engine/lists.js', 'src/engine/calculations.js', 'src/engine/cnc/jambDxf.js'];
  let base = null;
  for (const ref of ['origin/main', 'main']) {
    try { base = execFileSync('git', ['merge-base', 'HEAD', ref], { cwd: ROOT, encoding: 'utf8' }).trim(); break; } catch { /* try the next ref */ }
  }
  if (!base) check('git merge-base with main available', false, 'neither origin/main nor main resolves');
  else {
    const diff = execFileSync('git', ['diff', '--stat', base, '--', ...FROZEN], { cwd: ROOT, encoding: 'utf8' }).trim();
    check(`frozen files unchanged since merge-base ${base.slice(0, 7)}: ${FROZEN.map((f) => f.split('/').pop()).join(', ')}`, diff === '', diff);
    const wt = execFileSync('git', ['status', '--porcelain', '--', ...FROZEN], { cwd: ROOT, encoding: 'utf8' }).trim();
    check('frozen files clean in the working tree', wt === '', wt);
  }
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
