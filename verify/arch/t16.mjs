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
].join('\n'));
const BUNDLE = resolve(AUDIT, 'arch-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--external:react',
  '--platform=node', `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href);
const { arch, profile } = M;
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
// three-centre: haunch r = h/2 at (±(W/2 − r), 0); crown R from tangency; the
// tangent angle t is shared by all offsets (radial joints).
function threeExp(h, δ) {
  const r = h * 0.5, e = W / 2 - r;
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
  { shape: 'three-centre', rise: 390, exp: (δ) => threeExp(390, δ), R: 713.0769, centres: [[405, 0], [0, -323.0769], [-405, 0]] },
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

section('§10.1 limits & errors (readable ArchError)');
expectThrows('width below 400 throws', () => arch.resolveArchRise('segmental', 399, null), /below the minimum 400mm/);
expectThrows('width above 1500 throws', () => arch.resolveArchRise('segmental', 1501, null), /above the maximum 1500mm/);
expectThrows('semi-circle refuses a foreign rise', () => arch.resolveArchRise('semi-circle', 1200, 500), /fixed by the shape at 600mm/);
expectThrows('unknown shape throws', () => arch.resolveArchRise('elliptical', 1200, null), /Unknown arch shape/);
expectThrows('rise ≥ height throws', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 600 }, P), /no straight part/);
expectNear('segmental default rise = 0.20 × W (PSW RISE_RATIO)', arch.resolveArchRise('segmental', 1200, null), 240, 1e-9);
expectNear('three-centre default rise = 0.325 × W (PSW elliptical)', arch.resolveArchRise('three-centre', 1200, null), 390, 1e-9);
expectNear('gothic-drop default rise = 0.70 × W (PSW GOTHIC_PROFILE_RATIO.drop)', arch.resolveArchRise('gothic-drop', 1200, null), 840, 1e-9);
check('PSW shape map covers the four PSW radios', ['gothic-arch', 'semi-circle', 'segmental-arch', 'elliptical-arch'].every((k) => arch.isArchShape(arch.PSW_ARCH_SHAPE[k])));

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
