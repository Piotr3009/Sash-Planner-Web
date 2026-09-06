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
 * Spec errata E1 / E2 (BLOCKERS.md §6.2 / §6.3) concerned the v1 segmental
 * vectors only — moot since v2 removed the shape (history kept there).
 *
 * arched-casement-v2 (06.09, night 3): the v1 'segmental' shape is gone (P1 rule
 * C — every arch starts vertical at the jambs; P2). Its §10.1 / §10.2 vectors
 * are superseded by a THREE-CENTRE with the same rise 240 under P3
 * (haunch r = max(rise²/halfW, minHaunchRadius 150) → r 150, crown R 1320;
 * numbers computed 06.09 from the P3 rule and cross-checked by the independent
 * closed form + option table below). The 390 vector is unchanged (r 253.5 > 150).
 * lists.js / calculations.js are IN SCOPE for v2 (cut list, glass shape), so
 * §10.3 item 10 now freezes casementLayouts.js and jambDxf.js only.
 *
 * ARCHED-WINDOWS-v4 Block C (night 6): the segment planner is the whole-chain
 * planner v2 (pieces across arc boundaries, gothic split at the apex, two hard
 * limits 450 / 400, stock 63…200, fewest + economy). §10.3 pt 6 / pt 7 and the
 * plan-dependent DXF checks assert against verify/arch/lib/indPlanner.mjs — an
 * independent sampler-based implementation of spec C.1–C.4; the v1 §10.2 option
 * table (36° rule, D13 narrowest / fewest) is superseded.
 *
 * Run: node verify/arch/t16.mjs            (writes the sample DXF too)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { independentPlan } from './lib/indPlanner.mjs';

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
check('v2: ARCH_SHAPES = semi-circle | three-centre | gothic-equilateral | gothic-drop — no segmental (P2)',
  JSON.stringify(arch.ARCH_SHAPES) === JSON.stringify(['semi-circle', 'three-centre', 'gothic-equilateral', 'gothic-drop']) && !arch.isArchShape('segmental'));
expectThrows('v2: resolveArchRise("segmental") is an unknown shape', () => arch.resolveArchRise('segmental', W, null, LIM), /Unknown arch shape "segmental"/);
check('v2: LEGACY_ARCH_SHAPES.segmental → three-centre with the PSW segmental ratio 0.20 (P10)', arch.LEGACY_ARCH_SHAPES.segmental?.shape === 'three-centre' && arch.LEGACY_ARCH_SHAPES.segmental?.riseRatio === 0.20);
check('v2: PSW_ARCH_RISE_RATIO = segmental-arch 0.20 / elliptical-arch 0.325 / semi-circle 0.5 / gothic-arch √3/2',
  arch.PSW_ARCH_RISE_RATIO['segmental-arch'] === 0.20 && arch.PSW_ARCH_RISE_RATIO['elliptical-arch'] === 0.325 && arch.PSW_ARCH_RISE_RATIO['semi-circle'] === 0.5 && near(arch.PSW_ARCH_RISE_RATIO['gothic-arch'], Math.sqrt(3) / 2, 1e-12));
check('v2: ROUND_AUTO_RATIO 0.325 (configurator Auto = PSW elliptical default, P4)', arch.ROUND_AUTO_RATIO === 0.325 && arch.ARCH_RISE_RATIO['three-centre'] === 0.325);
check('v2: resolveRoundShape — W 1000: rise 500 → semi-circle, 499.6 → semi-circle (±0.5), 499.4 → three-centre',
  arch.resolveRoundShape(1000, 500) === 'semi-circle' && arch.resolveRoundShape(1000, 499.6) === 'semi-circle' && arch.resolveRoundShape(1000, 499.4) === 'three-centre');
expectThrows('v2: resolveRoundShape rise 520 > W/2 → "use Gothic"', () => arch.resolveRoundShape(1000, 520), /above half the width \(500mm\): use Gothic/);
expectNear('three-centre default rise = 0.325 × W (PSW elliptical)', arch.resolveArchRise('three-centre', W, null, LIM), 390, 1e-9);
expectNear('semi-circle default rise = 0.50 × W', arch.resolveArchRise('semi-circle', W, null, LIM), 600, 1e-9);
expectNear('gothic equilateral default rise = √3/2 × W = 1039.23', arch.resolveArchRise('gothic-equilateral', W, null, LIM), 1039.23, 0.01);
expectNear('gothic-drop default rise = 0.70 × W (PSW GOTHIC_PROFILE_RATIO.drop)', arch.resolveArchRise('gothic-drop', W, null, LIM), 840, 1e-9);
check('GOTHIC_PROFILE_RATIO = { equilateral √3/2, drop 0.70, shallow 0.60 } (spec §3.2 / §5)',
  near(arch.GOTHIC_PROFILE_RATIO.equilateral, Math.sqrt(3) / 2, 1e-12) && arch.GOTHIC_PROFILE_RATIO.drop === 0.70 && arch.GOTHIC_PROFILE_RATIO.shallow === 0.60);
check('ARCH_RISE_RATIO covers the four PC shapes with the PSW ratios',
  arch.ARCH_RISE_RATIO.segmental === undefined && arch.ARCH_RISE_RATIO['semi-circle'] === 0.5 && arch.ARCH_RISE_RATIO['three-centre'] === 0.325
  && near(arch.ARCH_RISE_RATIO['gothic-equilateral'], Math.sqrt(3) / 2, 1e-12) && arch.ARCH_RISE_RATIO['gothic-drop'] === 0.70);
check('PSW shape map covers the four PSW radios; segmental-arch → three-centre (P10)', ['gothic-arch', 'semi-circle', 'segmental-arch', 'elliptical-arch'].every((k) => arch.isArchShape(arch.PSW_ARCH_SHAPE[k])) && arch.PSW_ARCH_SHAPE['segmental-arch'] === 'three-centre');

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 2 — every chain in §10.1 within 0.01 mm / 0.01°
// §10.3 item 3 — offsets keep centres, reduce r by the face; clipped ends on y = 0
// §10.3 item 4 — three-centre tangency
// ═══════════════════════════════════════════════════════════════════════════
// Independent closed forms (used where the spec lists no number, e.g. offsets).
function semiExp(δ) { const ρ = W / 2 - δ; return { ρ, length: Math.PI * ρ, apex: ρ }; }
function gothicExp(h, δ) {
  const c = (h * h - W * W / 4) / W, R = W / 2 + c, ρ = R - δ;
  const y = Math.sqrt(ρ * ρ - c * c);
  const t = Math.atan2(y, c);
  return { c, R, ρ, length: 2 * ρ * t, apex: y };
}
// rMin = profile arch.minHaunchRadius (v2 P3): r = max(h²/a, rMin)
function threeExp(h, δ, rMin = 0) {
  const r = Math.max((h * h) / (W / 2), rMin), e = W / 2 - r;
  const R = (e * e + h * h - r * r) / (2 * (h - r));
  const t = Math.atan2(R - h, e);
  const length = 2 * (r - δ) * t + (R - δ) * (Math.PI - 2 * t);
  return { r, e, R, t, length, apex: h - δ, xEnd: W / 2 - δ };   // rule C: every offset ends on the line at x = W/2 − δ
}
const R_MIN = P.arch.minHaunchRadius;
check('profile arch.minHaunchRadius = 150 (v2 P3)', R_MIN === 150);

// Spec §10.1 vectors, verbatim.
const SPEC_GEOMETRY = [
  // v2: the former "segmental 240" window is a three-centre with rise 240 — haunch r clamps to 150 (P3), crown R 1320
  { key: 'three-centre-240', shape: 'three-centre', rise: 240, exp: (δ) => threeExp(240, δ, R_MIN), R: 1320, centres: [[450, 0], [0, -1080], [-450, 0]],
    spec: { r: 150.00, R: 1320.00, smallCx: 450.00, largeBelow: 1080.00, tangent: [507.69, 138.46], smallSpan: 67.38, largeSpan: 45.24, lenSmall: 176.40, lenLarge: 1042.25, total: 1395.05, csCl: 1170.00,
      rings: { headInner: [93, 1263, 93], leafOuter: [110, 1280, 110], leafInner: [43, 1213, 43], glass: [55.5, 1225.5, 55.5] } } },
  { shape: 'semi-circle', rise: null, exp: semiExp, R: 600, centres: [[0, 0]],
    spec: { Rout: 600.00, Rin: 543.00, thetaDeg: 180, lenOut: 1884.96, lenIn: 1705.88 } },
  { shape: 'gothic-equilateral', rise: null, exp: (δ) => gothicExp(W * Math.sqrt(3) / 2, δ), R: 1200, centres: [[-600, 0], [600, 0]],
    spec: { rise: 1039.23, c: 600.00, Rout: 1200.00, Rin: 1143.00, spanDeg: 60, lenOutEach: 1256.64 } },
  { shape: 'gothic-drop', rise: 840, exp: (δ) => gothicExp(840, δ), R: 888, centres: [[-288, 0], [288, 0]],
    spec: { rise: 840.00, c: 288.00, Rout: 888.00, Rin: 831.00, spanDeg: 71.08, lenOutEach: 1101.56 } },
  { shape: 'three-centre', rise: 390, exp: (δ) => threeExp(390, δ, R_MIN), R: 761.54, centres: [[346.5, 0], [0, -371.54], [-346.5, 0]],
    spec: { r: 253.50, R: 761.54, smallCx: 346.50, largeBelow: 371.54, tangent: [519.40, 185.39], smallSpan: 47.00, largeSpan: 86.01, lenSmall: 207.93, lenLarge: 1143.13, total: 1559.00, csCl: 508.04 } },
];

section('§10.3 pt 2–4 — geometry, W = 1200, casement profile defaults (spec §10.1 vectors)');
const GEOM = {};
for (const v of SPEC_GEOMETRY) {
  const g = arch.buildArchGeometry({ shape: v.shape, width: W, height: 2000, rise: v.rise }, P);
  const tag = v.key || v.shape, S = v.spec;
  GEOM[tag] = g;
  const big = g.arcs.reduce((m, a) => (a.r > m.r ? a : m), g.arcs[0]);
  expectNear(`${tag}: main radius ${v.R}`, big.r, v.R, 0.01);
  check(`${tag}: centres ${JSON.stringify(v.centres)}`, g.arcs.length === v.centres.length && g.arcs.every((a, i) => near(a.cx, v.centres[i][0], 0.01) && near(a.cy, v.centres[i][1], 0.01)),
    JSON.stringify(g.arcs.map((a) => [+a.cx.toFixed(3), +a.cy.toFixed(3)])));
  // ── spec literals per shape ──
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
  if (v.shape === 'three-centre') {
    const [s0, big3, s1] = g.arcs;
    const rRule = Math.max(v.rise * v.rise / (W / 2), R_MIN);
    expectNear(`${tag}: haunch radius r = max(rise²/halfW, ${R_MIN}) = ${S.r} (P3)`, s0.r, S.r, 0.01);
    check(`${tag}: r equals the P3 rule exactly (${rRule.toFixed(2)}${rRule === R_MIN ? ' — clamped by minHaunchRadius' : ' — ellipse curvature'})`, near(s0.r, rRule, 1e-9));
    expectNear(`${tag}: crown radius R = ${S.R}`, big3.r, S.R, 0.01);
    expectNear(`${tag}: small centres x = W/2 ± ${S.smallCx}`, s0.cx, S.smallCx, 0.01);
    check(`${tag}: haunch centres ON the arch-start line (rule C — the arch starts vertical at the jamb)`, near(s0.cy, 0, 1e-12) && near(s1.cy, 0, 1e-12));
    expectNear(`${tag}: large centre ${S.largeBelow} below the arch-start line`, -big3.cy, S.largeBelow, 0.01);
    const T = arch.arcPoint(s0, s0.a1);
    check(`${tag}: tangent point (W/2 + ${S.tangent[0]}, arch-start + ${S.tangent[1]}) lies on both circles`, near(T[0], S.tangent[0], 0.01) && near(T[1], S.tangent[1], 0.01)
      && near(Math.hypot(T[0] - big3.cx, T[1] - big3.cy), big3.r, 1e-6) && near(Math.hypot(T[0] - s0.cx, T[1] - s0.cy), s0.r, 1e-6), `${T.map((c) => c.toFixed(2))}`);
    expectNear(`${tag}: small span ${S.smallSpan}°`, arch.arcSpan(s0) * DEG, S.smallSpan, 0.01);
    expectNear(`${tag}: large span ${S.largeSpan}°`, arch.arcSpan(big3) * DEG, S.largeSpan, 0.01);
    expectNear(`${tag}: arcLen small ${S.lenSmall} each`, arch.arcLen(s0), S.lenSmall, 0.01);
    expectNear(`${tag}: arcLen large ${S.lenLarge}`, arch.arcLen(big3), S.lenLarge, 0.01);
    expectNear(`${tag}: total outer length ${S.total}`, arch.arcsLength(g.arcs), S.total, 0.01);
    expectNear(`${tag}: tangency |Cs − CL| = R − r = ${S.csCl}`, Math.hypot(s0.cx - big3.cx, s0.cy - big3.cy), S.csCl, 0.01);
    check(`${tag}: |Cs − CL| equals R − r exactly`, near(Math.hypot(s0.cx - big3.cx, s0.cy - big3.cy), big3.r - s0.r, 1e-6));
    check(`${tag}: mirrored haunch arc`, near(s1.cx, -s0.cx, 1e-9) && near(s1.r, s0.r, 1e-9) && near(arch.arcSpan(s1), arch.arcSpan(s0), 1e-9));
    check(`${tag}: chain is tangent-continuous (shared end points at both tangent points)`, (() => {
      const a = arch.arcPoint(s0, s0.a1), b = arch.arcPoint(big3, big3.a0), c = arch.arcPoint(big3, big3.a1), d = arch.arcPoint(s1, s1.a0);
      return near(a[0], b[0], 1e-6) && near(a[1], b[1], 1e-6) && near(c[0], d[0], 1e-6) && near(c[1], d[1], 1e-6);
    })());
    check(`${tag}: geometry reports radii [${g.radii.map((r) => +r.toFixed(2))}], start = 2000 − rise, minHaunchRadius ${R_MIN}`, g.radii.length === 3 && near(g.radii[1], S.R, 0.01) && g.start === 2000 - v.rise && g.minHaunchRadius === R_MIN);
    if (S.rings) {
      const same = (arcs, exp) => arcs.length === exp.length && arcs.every((a, i) => near(a.r, exp[i], 1e-9));
      check(`${tag}: rings — head inner ${S.rings.headInner} · leaf outer ${S.rings.leafOuter} · leaf inner ${S.rings.leafInner} · glass ${S.rings.glass}`,
        same(g.frameHead.inner, S.rings.headInner) && same(g.leafTop.outer, S.rings.leafOuter) && same(g.leafTop.inner, S.rings.leafInner) && same(g.glass.arcs, S.rings.glass));
    }
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
expectThrows('width below 400 throws', () => arch.resolveArchRise('three-centre', 399, null, LIM), /below the minimum 400mm/);
expectThrows('width above 1500 throws', () => arch.resolveArchRise('three-centre', 1501, null, LIM), /above the maximum 1500mm/);
expectThrows('semi-circle refuses a foreign rise', () => arch.resolveArchRise('semi-circle', 1200, 500, LIM), /fixed by the shape at 600mm/);
expectThrows('unknown shape throws', () => arch.resolveArchRise('elliptical', 1200, null, LIM), /Unknown arch shape/);
expectThrows('missing limits throw (no defaults in arch.js)', () => arch.resolveArchRise('three-centre', 1200, null, undefined), /arch\.limits is missing/);
expectThrows('missing arch.minHaunchRadius throws (no defaults in arch.js, v2 P3)', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 2000 }, { ...P, arch: { ...P.arch, minHaunchRadius: undefined } }), /arch\.minHaunchRadius is missing/);
expectThrows('H < rise + 900 throws (semi-circle 1200 in H 1499)', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 1499 }, P), /leaves 899mm straight below the arch — minimum 900mm/);
check('H = rise + 900 passes (straight 900, leaf straight stile 900 − 47 = 853)', (() => { const g = arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 1500 }, P); return g.straightHeight === 900 && near(g.leafStraightStile, 900 - (P.deductions.leafFullHeight - P.deductions.leafAtJamb), 1e-9); })());
{
  const loose = { ...P, arch: { ...P.arch, limits: { ...P.arch.limits, minStraightBelowRise: 0 } } };
  expectThrows('leaf straight stile < 100 throws when the 900 rule is relaxed (straight 140 → stile 93)', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 380, rise: 240 }, loose), /Straight stile of the arched leaf is 93mm — minimum 100mm/);
  check('leaf straight stile = 100 passes (straight 147)', arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 387, rise: 240 }, loose).leafStraightStile === 100);
}
expectThrows('three-centre rise ≥ W/2 is a hard error (resolveArchRise)', () => arch.resolveArchRise('three-centre', 1200, 600, LIM), /must be below half the width \(600mm\)/);
expectThrows('gothic-drop rise < W/2 throws (arcs cannot meet in a point)', () => arch.resolveArchRise('gothic-drop', 1200, 599, LIM), /must be at least half the width \(600mm\)/);
expectThrows('three-centre rise ≥ W/2 throws (semi-circle)', () => arch.archArcs('three-centre', 1200, 600), /must be below half the width/);
check('P3: rise 180 at W 1200 → haunch r clamps to 150 (v1 rule gave 54 < the frame face), crown R 3540 — builds', (() => {
  const g = arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 180 }, P);
  return near(g.arcs[0].r, 150, 1e-9) && near(g.arcs[1].r, 3540, 1e-6) && near(g.frameHead.inner[0].r, 93, 1e-9);
})());
expectThrows('P3: rise 150 = minHaunchRadius → no crown arc, readable', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 150 }, P), /rise 150mm must exceed the haunch radius 150mm \(profile arch\.minHaunchRadius 150\)/);
expectThrows('P3: rise 120 < minHaunchRadius → readable', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 120 }, P), /rise 120mm must exceed the haunch radius 150mm/);
check('archArcs three-centre: opts.minHaunchRadius 150 clamps r (rise 240 → 150); without it the v1 rule r = b²/a = 96 stands (pure-geometry callers)',
  near(arch.archArcs('three-centre', 1200, 240, { minHaunchRadius: 150 })[0].r, 150, 1e-9) && near(arch.archArcs('three-centre', 1200, 240)[0].r, 96, 1e-9));
expectThrows('rise ≤ 0 throws', () => arch.resolveArchRise('three-centre', 1200, 0, LIM), /must be a positive number/);
check('gothic-drop rise 0.917 × W (1100 mm, above the old 0.85 window) is accepted', arch.archArcs('gothic-drop', 1200, 1100).length === 2);
check('gothic-drop rise = W/2 degenerates into a semi-circle (c = 0) and is accepted', (() => { const a = arch.archArcs('gothic-drop', 1200, 600); return near(a[0].cx, 0, 1e-9) && near(a[0].r, 600, 1e-9); })());
check('three-centre rise 0.10 × W (120 mm): archArcs without the P3 minimum keeps r 24 (v1); buildArchGeometry applies the profile minimum and refuses it', (() => {
  const raw = arch.archArcs('three-centre', 1200, 120);
  try { arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2000, rise: 120 }, P); return false; } catch (e) { return near(raw[0].r, 24, 1e-9) && /must exceed the haunch radius 150mm/.test(e.message); }
})());

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 6 — segment plans reproduce §10.2
// ═══════════════════════════════════════════════════════════════════════════
// Independent option table: allowance band (outer + a, inner − a) bounded by
// the radial joint planes and, for the end pieces, by the arch-start line /
// apex axis; every piece projected onto its own axes (sampled boundary, 4000
// points per arc). N_min = max(2, ceil(θ / maxAngle)), N = N_min … N_min + 3;
// a single-centre arc shorter than maxAngle may be ONE board if a stock board
// fits it. Closed forms (spec §7.5) cross-checked on the middle pieces.
// ── planner v2 (ARCHED-WINDOWS-v4 Block C) ───────────────────────────────────
// The independent implementation lives in lib/indPlanner.mjs: whole-chain
// partition by outer arc length, 800-point band sampling projected on the
// piece chord, raw trapezoid edges (square springing end, radial joints, apex
// axis), the two hard limits, fewest + economy. PLAN_OPTS mirrors the profile
// blocks and is asserted against them — nothing here is read from arch.js.
const PLAN_OPTS = { stockWidths: [63, 75, 95, 105, 120, 150, 180, 200], contourAllowance: 10, finger: { length: 15, depth: 16, pitch: 3.8 }, minPieceLength: 400, wasteThreshold: 0.45 };
const CNC_OPTS = { minClampLength: 450 };
check('PLAN_OPTS equals the profile arch / cnc blocks (v4: stock 63…200, allowance 10, finger 15/16/3.8, minPieceLength 400, threshold 0.45, minClampLength 450)',
  JSON.stringify(PLAN_OPTS.stockWidths) === JSON.stringify(P.arch.stockWidths) && PLAN_OPTS.contourAllowance === P.arch.contourAllowance && PLAN_OPTS.minPieceLength === P.arch.minPieceLength
  && PLAN_OPTS.wasteThreshold === P.arch.wasteThreshold && JSON.stringify(PLAN_OPTS.finger) === JSON.stringify(P.arch.finger) && CNC_OPTS.minClampLength === P.cnc.minClampLength);
const IND = { stock: PLAN_OPTS.stockWidths, allowance: PLAN_OPTS.contourAllowance, finger: PLAN_OPTS.finger.length, minClamp: CNC_OPTS.minClampLength, minPiece: PLAN_OPTS.minPieceLength, threshold: PLAN_OPTS.wasteThreshold };
const indPlan = (ring, extra = {}) => independentPlan(ring, { ...IND, ...extra });
function sampled(cx, cy, r, a0, a1, N = 4000) {
  const pts = [];
  for (let j = 0; j <= N; j++) { const a = a0 + (a1 - a0) * j / N; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

section('§10.3 pt 6 — segment plans v2 (v4 Block C): engine vs the independent planner, every shape, W = 1200');
const PLAN_VECTORS = [
  { key: 'three-centre-240', shape: 'three-centre' },
  { shape: 'semi-circle' },
  { shape: 'gothic-equilateral' },
  { shape: 'gothic-drop' },
  { shape: 'three-centre' },
];
const PLANS = {};
for (const v of PLAN_VECTORS) {
  const tag = v.key || v.shape;
  const g = GEOM[tag];
  const ring = g.frameHead;
  const plan = arch.planArchSegments(ring, PLAN_OPTS, CNC_OPTS);
  PLANS[tag] = plan;
  const ind = indPlan(ring);
  check(`${tag}: ${ind.length} planning group(s) (${ind.map((x) => x.kind).join(' + ')}) — a gothic is split at the apex, everything else is one chain`,
    plan.arcs.length === ind.length && plan.arcs.every((gp, i) => gp.kind === ind[i].kind) && plan.arcs.length === (g.arcs.length === 2 ? 2 : 1));
  plan.arcs.forEach((gp, i) => {
    const I = ind[i];
    const label = `${tag}${ind.length > 1 ? ' side ' + (i + 1) : ''}`;
    check(`${label}: option table N = 1 … ${I.options[I.options.length - 1].n}: W_req (±0.05 vs the sampler), stock, feasibility`,
      gp.options.length === I.options.length && gp.options.every((o, j) => o.n === I.options[j].n && near(o.wReq, I.options[j].wReq, 0.05) && o.stock === I.options[j].stock && o.feasible === I.options[j].feasible),
      gp.options.map((o) => `${o.n}:${o.wReq.toFixed(1)}→${o.stock}${o.feasible ? '✓' : '✗'}`).join(' '));
    check(`${label}: every piece of every option — W_req / L / raw edges / shorter / overall match the independent sampler (±0.05)`,
      gp.options.every((o, j) => o.pieces.every((pc, k) => {
        const ip = I.options[j].pieces[k];
        return near(pc.wReq, ip.wReq, 0.05) && near(pc.L, ip.L, 0.05) && (o.stock == null || (near(pc.outerEdge, ip.outer, 0.05) && near(pc.innerEdge, ip.inner, 0.05) && near(pc.roughLength, ip.overall, 0.05) && near(pc.shorterEdge, ip.shorter, 0.05)));
      })));
    check(`${label}: FEWEST ${I.fewest?.n ?? '-'} × ${I.fewest?.stock ?? '-'}, ALT ${I.alt ? `${I.alt.n} × ${I.alt.stock}` : 'none'}, DEFAULT ${I.def?.n ?? '-'} × ${I.def?.stock ?? '-'} (${I.rule})`,
      (gp.fewest?.n ?? null) === (I.fewest?.n ?? null) && (gp.fewest?.stock ?? null) === (I.fewest?.stock ?? null) && (gp.alternative?.n ?? null) === (I.alt?.n ?? null)
      && (gp.default?.n ?? null) === (I.def?.n ?? null) && (gp.default?.stock ?? null) === (I.def?.stock ?? null) && gp.rule === I.rule,
      `${gp.fewest?.n} × ${gp.fewest?.stock}, alt ${gp.alternative?.n}, default ${gp.default?.n} × ${gp.default?.stock} (${gp.rule})`);
    check(`${label}: waste of the fewest / alternative plans = (rough × stock − band area) / (rough × stock), independent ±0.005`,
      near(gp.fewest.waste, I.fewest.waste, 0.005) && (!gp.alternative || near(gp.alternative.waste, I.alt.waste, 0.005)), `${gp.fewest.waste?.toFixed(3)} vs ${I.fewest.waste.toFixed(3)}`);
    check(`${label}: every default piece passes both limits (overall ≥ 450, shorter edge ≥ 400); every N below the fewest fails`,
      gp.default.pieces.every((pc) => pc.limitsOk && pc.roughLength >= 450 - 1e-9 && pc.shorterEdge >= 400 - 1e-9) && gp.options.filter((o) => o.n < gp.fewest.n).every((o) => !o.feasible));
    // closed forms for a single-arc piece with radial joints at both ends (spec §7.5 — still exact in v4)
    const mids = gp.default.pieces.filter((pc) => !pc.compound && pc.endStart === 'radial' && pc.endEnd === 'radial');
    if (mids.length) {
      const okMid = mids.every((pc) => {
        const O = ring.outer[pc.arc], In = ring.inner[pc.arc], a = PLAN_OPTS.contourAllowance;
        const phi = pc.span;
        const wReq = (O.r + a) - (In.r - a) * Math.cos(phi / 2);
        const wHi = (In.r - a) * Math.cos(phi / 2) + (pc.stock + wReq) / 2;      // board centred on the band
        const wLo = wHi - pc.stock;
        return near(pc.wReq, wReq, 0.01) && near(pc.L, 2 * (O.r + a) * Math.sin(phi / 2), 0.01) && near(pc.outerEdge, 2 * wHi * Math.tan(phi / 2), 0.05) && near(pc.innerEdge, 2 * wLo * Math.tan(phi / 2), 0.05)
          && pc.endCuts.every((c) => c.kind === 'joint' && near(c.fromSquareDeg, phi / 2 * DEG, 1e-6)) && near(pc.roughLength, 2 * wHi * Math.tan(phi / 2) + 2 * PLAN_OPTS.finger.length, 0.05);
      });
      check(`${label}: ${mids.length} middle piece(s) — closed forms W_req = (Ro + a) − (Ri − a)·cos(φ/2), L = 2·(Ro + a)·sin(φ/2), edges 2·w·tan(φ/2), joints φ/2 from square, rough = outer edge + 2 × 15`, okMid);
    }
    const ps = gp.default.pieces;
    const tiled = ps.every((pc, k) => k === 0 || (near(pc.s[0], ps[k - 1].s[1], 1e-9) && near(pc.outer[0].a0, ps[k - 1].outer[ps[k - 1].outer.length - 1].a1, 1e-9)));
    const first = ps[0].outer[0], last = ps[ps.length - 1].outer[ps[ps.length - 1].outer.length - 1];
    const full = near(first.a0, ring.outer[gp.arcIndices[0]].a0, 1e-12) && near(last.a1, ring.outer[gp.arcIndices[gp.arcIndices.length - 1]].a1, 1e-12);
    check(`${label}: default pieces tile the group by arc length without gaps; polygons close (2 × arcs + 2 vertices)`, tiled && full && ps.every((pc) => arch.piecePoly(pc).length === 2 * pc.outer.length + 2 && arch.pieceBandPoly(pc).length === 2 * pc.outer.length + 2));
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
  check(`gothic: ${4 * nSide - 2} joint faces reported (every non-springing end, shared joints twice), exactly 2 on the axis (x = 0)`, allJoints.length === 4 * nSide - 2 && apexJoints.length === 2, String(allJoints.length));
  expectNear('gothic: apex joint runs from inner apex 972.86 to outer apex 1039.23', apexJoints[0][1][1] - apexJoints[0][0][1], 1039.2305 - 972.8648, 0.01);
  const apexCut = plan.pieces[nSide - 1].endCuts[1];
  check('gothic: apex end cut kind "apex", from-square = angle between the vertical plane and the board normal', apexCut.kind === 'apex' && near(apexCut.fromSquareDeg, Math.acos(Math.abs(plan.pieces[nSide - 1].axes.b[1])) * DEG, 1e-9));
  const sq = plan.pieces[0].endCuts[0];
  check('gothic: springing end cut kind "square" (Q), not jointed, contour wedge = piece axis to the horizontal', sq.kind === 'square' && !sq.jointed && sq.fromSquareDeg === 0 && near(sq.contourDeg, 180 - Math.atan2(plan.pieces[0].axes.u[1], plan.pieces[0].axes.u[0]) * DEG, 1e-9));
}
{
  const plan = PLANS['three-centre'];
  const ps = plan.pieces;
  check('three-centre (390): ONE chain, a piece may span the haunch / crown tangent (a compound piece exists), every joint radial to the local arc at the cut point', plan.arcs.length === 1 && plan.arcs[0].kind === 'chain' && ps.some((pc) => pc.compound) && ps.every((pc, k) => k === 0 || near(pc.planes.start.angle, ps[k - 1].planes.end.angle, 1e-12)));
  check('three-centre: neighbours share their joint plane — the start edge of piece k lies on the line of the end edge of piece k − 1 (±0.01; boards are centred on their own bands, so the vertices differ)', ps.every((pc, k) => {
    if (k === 0) return true;
    const a = arch.pieceStockTrapezoid(ps[k - 1], ps[k - 1].stock), b = arch.pieceStockTrapezoid(pc, pc.stock);
    const line = (q, p1, p2) => Math.abs((p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0])) / Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    return line(b[0], a[1], a[2]) < 0.01 && line(b[3], a[1], a[2]) < 0.01;
  }));
  check('three-centre: every band arc keeps its centre and radius ± allowance (concentric band)', ps.every((pc) => pc.band.outer.every((a, i) => near(a.r, pc.outer[i].r + PLAN_OPTS.contourAllowance, 1e-9) && a.cx === pc.outer[i].cx) && pc.band.inner.every((a, i) => near(a.r, pc.inner[i].r - PLAN_OPTS.contourAllowance, 1e-9))));
}
{
  const g = GEOM['semi-circle'];
  const plan = arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, stockWidths: [50] }, CNC_OPTS);
  check('no matching board: returns options with stock = null and noStock = true (reason "no stock board fits")', plan.noStock === true && plan.noStockReason === 'no stock board fits' && plan.arcs[0].default === null && plan.arcs[0].options.every((o) => o.stock === null) && plan.pieces.length === 0);
  const blocked = arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, stockWidths: [95] }, CNC_OPTS);
  const ib = indPlan(g.frameHead, { stock: [95] });
  check(`only a 95 board: a board fits at ${ib[0].blocked?.n} pieces but the limits fail → noStock, reason "below minimum length", never split finer`, blocked.noStock && blocked.noStockReason === 'below minimum length' && blocked.arcs[0].blocked?.n === ib[0].blocked?.n && blocked.pieces.length === 0 && blocked.reasons.length === 1);
  expectThrows('missing contourAllowance throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, contourAllowance: undefined }, CNC_OPTS), /contourAllowance is missing/);
  expectThrows('missing finger length throws (no defaults in the planner)', () => arch.planArchSegments(g.frameHead, { ...PLAN_OPTS, finger: {} }, CNC_OPTS), /finger\.length is missing/);
  expectThrows('missing cnc block throws (v4: cnc.minClampLength)', () => arch.planArchSegments(g.frameHead, PLAN_OPTS, undefined), /cnc\.minClampLength is missing/);
  check('v4: N starts at 1 — the shallow 1000 × rise 200 leaf top rail is ONE 180 board, no joint', arch.buildArchPlan({ shape: 'three-centre', width: 1000, height: 1500, rise: 200 }, P).plans.leafTop.pieces.length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 7 — every raw board contains its piece's allowance band (plan data)
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 7 — stock boards contain the allowance band (point-in-trapezoid on sampled band points)');
function bandContained(pc, stock) {
  const T = arch.pieceStockTrapezoid(pc, stock);
  const inside = (q) => { let sgn = 0; for (let i = 0; i < 4; i++) { const a = T[i], b = T[(i + 1) % 4]; const cr = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); if (Math.abs(cr) < 1e-6) continue; if (!sgn) sgn = Math.sign(cr); else if (Math.sign(cr) !== sgn) return false; } return true; };
  const pts = [...pc.band.outer.flatMap((a) => sampled(a.cx, a.cy, a.r, a.a0, a.a1, 400)), ...pc.band.inner.flatMap((a) => sampled(a.cx, a.cy, a.r, a.a0, a.a1, 400))];
  return pts.every(inside);
}
for (const shape of Object.keys(PLANS)) {
  const plan = PLANS[shape];
  check(`${shape}: every default piece's band (outer + 10 / inner − 10) fits inside its raw trapezoid`, plan.pieces.every((pc) => bandContained(pc, pc.stock)));
  check(`${shape}: the finished piece contour lies inside the band (r_out < band r_out, r_in > band r_in, angles within)`, plan.pieces.every((pc) =>
    pc.outer.every((a, i) => a.r < pc.band.outer[i].r && a.a0 >= pc.band.outer[i].a0 - 1e-9 && a.a1 <= pc.band.outer[i].a1 + 1e-9) && pc.inner.every((a, i) => a.r > pc.band.inner[i].r)));
  // every feasible option (not only the default) — the DXF prints the alternative as ALT
  check(`${shape}: bands fit their boards for every option with a board`, plan.arcs.every((a) => a.options.every((o) => o.stock == null || o.pieces.every((pc) => bandContained(pc, o.stock)))));
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 5 — bulge polylines through dxfWriter → ezdxf; DXF structure
// ═══════════════════════════════════════════════════════════════════════════
const ARCH_SECTION = { ...PLAN_OPTS, minHaunchRadius: P.arch.minHaunchRadius, limits: { minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 } };
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

section('§10.3 pt 5 — DXF round-trip via ezdxf — sample_arch_1200_three-centre-rise240.dxf (frame head + leaf top)');
{
  const plan = arch.buildArchPlan({ shape: 'three-centre', width: W, height: 2000, rise: 240, hinge: 'left' }, PA);
  const ents = archDxf.buildArchEntities(plan, 'W1');
  const dxf = dxfWriter.writeDxf(ents, archDxf.ARCH_LAYERS);
  const path = resolve(SAMPLES, 'sample_arch_1200_three-centre-rise240.dxf');
  writeFileSync(path, dxf);
  const d = probe(path);
  check('DXF is R12 (AC1009)', d.version === 'AC1009', d.version);
  check('layers CONTOUR / ASSEMBLY / PIECES / FINGER / CLAMPS / TEXT present', ['CONTOUR', 'ASSEMBLY', 'PIECES', 'FINGER', 'CLAMPS', 'TEXT'].every((l) => d.layers.includes(l)), d.layers.join(','));
  const contours = d.polys.filter((p) => p.layer === 'CONTOUR');
  check('CONTOUR: two closed rings (frame head, leaf top), exactly one vertex per arc end point (8 each — 3 arcs out, 2 cuts, 3 arcs back)', contours.length === 2 && contours.every((p) => p.closed && p.n === 8));
  const frameC = contours.reduce((m, p) => (p.arcs > m.arcs ? p : m), contours[0]);
  const leafC = contours.find((p) => p !== frameC);
  // item 5 proper: arc length recomputed from vertices + bulges = arcLength(chain) within 0.01
  expectNear('frame head CONTOUR: ezdxf arc length (vertices + bulges) = arcLength(outer) + arcLength(inner) within 0.01', frameC.arcs, plan.frameHead.lengths.outer + plan.frameHead.lengths.inner, 0.01);
  expectNear('leaf top CONTOUR: ezdxf arc length = arcLength(outer) + arcLength(inner) within 0.01', leafC.arcs, plan.leafTop.lengths.outer + plan.leafTop.lengths.inner, 0.01);
  const fo = threeExp(240, 0, R_MIN), fi = threeExp(240, tF, R_MIN), lo = threeExp(240, oL, R_MIN), li = threeExp(240, oL + tL, R_MIN);
  expectNear('frame head CONTOUR arc length = closed form (1395.05 + 1215.98)', frameC.arcs, fo.length + fi.length, 0.01);
  expectNear('frame head CONTOUR straight length = two arch-start cuts, each exactly the face (rule C: 2 × 57)', frameC.straight, 2 * tF, 0.01);
  expectNear('leaf top CONTOUR arc length = closed form', leafC.arcs, lo.length + li.length, 0.01);
  expectNear('leaf top CONTOUR straight length = two arch-start cuts = 2 × leafTop.face (rule C)', leafC.straight, 2 * tL, 0.01);
  check('CONTOUR bulges: |bulge| = tan(Δ/4) of the six arcs in the frame ring, 0 on the two cuts', (() => {
    const exp = [...plan.frameHead.outer.map((a) => Math.tan(arch.arcSpan(a) / 4)), 0, ...[...plan.frameHead.inner].reverse().map((a) => Math.tan(arch.arcSpan(a) / 4)), 0];
    return frameC.bulges.length === 8 && frameC.bulges.every((b, i) => near(Math.abs(b), exp[i], 1e-5));   // dxfWriter writes 6 decimals
  })(), frameC.bulges.map((b) => b.toFixed(4)).join(' '));
  check('frame head contour sits above the leaf contour (reading order top-down)', frameC.bbox[1] > leafC.bbox[3]);
  // plans in the sample (v4): one chain per ring — head FEWEST 2 × 180 (waste 61 %) → ECONOMY 3 × 150; leaf 2 × 180 (no alternative passes)
  const nF = plan.plans.frameHead.totalPieces, nL = plan.plans.leafTop.totalPieces;
  const iF = indPlan(plan.frameHead), iL = indPlan(plan.leafTop);
  const sumN = (arr) => arr.reduce((a, e) => a + e.def.n, 0);
  const stocksOk = (pl, exp) => pl.arcs.every((a, i) => a.default.stock === exp[i].def.stock && a.rule === exp[i].rule);
  check(`sample plans: frame head ${nF} pieces (${iF.map((e) => `${e.def.n} × ${e.def.stock} ${e.rule}`).join(' + ')}), leaf top ${nL} (${iL.map((e) => `${e.def.n} × ${e.def.stock} ${e.rule}`).join(' + ')}) — independent planner per group`,
    nF === sumN(iF) && nL === sumN(iL) && stocksOk(plan.plans.frameHead, iF) && stocksOk(plan.plans.leafTop, iL), `${nF}/${nL} vs ${sumN(iF)}/${sumN(iL)}`);
  check('sample plans (three-centre 240, v4): head fewest 2 × 180 → economy 3 × 150 (waste above 45 %), leaf 2 × 180 fewest — every piece a compound haunch + crown board, no 100 mm haunch triangles',
    iF[0].fewest.n === 2 && iF[0].fewest.stock === 180 && iF[0].def.n === 3 && iF[0].def.stock === 150 && iF[0].rule === 'economy' && iL[0].def.n === 2 && iL[0].def.stock === 180 && iL[0].rule === 'fewest'
    && plan.plans.frameHead.pieces.every((pc) => pc.roughLength >= 450 && pc.shorterEdge >= 400) && plan.plans.leafTop.pieces.every((pc) => pc.compound));
  const stockF = iF[0].def.stock, stockL = iL[0].def.stock;
  const pieces = d.polys.filter((p) => p.layer === 'PIECES');
  // Piotr 06.09: PIECES = the RAW timber pieces after their angled end cuts — straight trapezoids
  // (no arcs), stock wide, rough length long (band L + finger 15 per jointed end). Fingers are a note.
  check(`PIECES: ${nF + nL} closed 4-vertex straight trapezoids (raw pieces, angled ends, no arcs)`,
    pieces.length === nF + nL && pieces.every((p) => p.closed && p.n === 4 && p.arcs === 0), String(pieces.length));
  const allPieces = [...plan.plans.frameHead.pieces, ...plan.plans.leafTop.pieces];
  const roughs = allPieces.map((pc) => pc.roughLength).sort((a, b) => a - b);
  const pieceLens = pieces.map((p) => p.bbox[2] - p.bbox[0]).sort((a, b) => a - b);
  check('PIECES: bbox length = piece rough length (band L + finger per jointed end) ±0.5',
    pieceLens.length === roughs.length && pieceLens.every((l, i) => near(l, roughs[i], 0.5)), `${pieceLens.map((l) => l.toFixed(1))} vs ${roughs.map((l) => l.toFixed(1))}`);
  check(`PIECES: every piece is exactly its stock board wide (${stockF} / ${stockL}) across the chord`,
    pieces.every((p) => near(p.bbox[3] - p.bbox[1], stockF, 0.5) || near(p.bbox[3] - p.bbox[1], stockL, 0.5) || (p.bbox[3] - p.bbox[1]) > Math.min(stockF, stockL)),
    pieces.map((p) => (p.bbox[3] - p.bbox[1]).toFixed(1)).join(' '));
  const boards = d.polys.filter((p) => p.layer === 'ASSEMBLY');
  // ASSEMBLY = the glued blank: one straight trapezoid per piece in world position, neighbours share
  // their joint edge exactly (no overlap), the finished CONTOUR arcs inside for reference.
  check(`ASSEMBLY: one straight trapezoid per piece (${nF + nL}), no arcs`, boards.length === nF + nL && boards.every((p) => p.closed && p.n === 4 && p.arcs === 0), String(boards.length));
  {
    // ASSEMBLY polys = pieceStockTrapezoid(piece, stock) shifted by the row offset (the CONTOUR outer arc
    // starts at (W/2, 0) in arch coords), and every interior joint is one shared plane (±0.01) — the
    // glued blank has no overlap (Piotr 06.09). Different stock widths meet on the same plane with
    // different edge lengths, so the test is "on the same line", not "same vertices".
    // each ring has its own CONTOUR row: offset = DXF outer-arc start − arch-space outer-arc start
    const rowOffset = (contourPoly, ring) => { const p0 = arch.arcPoint(ring.outer[0], ring.outer[0].a0); return [contourPoly.pts[0][0] - p0[0], contourPoly.pts[0][1] - p0[1]]; };
    const rings = [[plan.plans.frameHead, rowOffset(frameC, plan.frameHead)], [plan.plans.leafTop, rowOffset(leafC, plan.leafTop)]];
    const samePts = (a, b) => a.length === b.length && a.every((q, k) => near(q[0], b[k][0], 0.01) && near(q[1], b[k][1], 0.01));
    let matched = 0, joints = 0, planes = 0;
    for (const [pl, [dx, dy]] of rings) {
      for (const pc of pl.pieces) {
        const t = arch.pieceStockTrapezoid(pc, pc.stock).map((q) => [q[0] + dx, q[1] + dy]);
        if (boards.some((bd) => samePts(bd.pts, t))) matched++;
      }
      for (let i = 0; i + 1 < pl.pieces.length; i++) {
        const a = pl.pieces[i], b = pl.pieces[i + 1];
        if (a.endEnd === 'archStart' || b.endStart === 'archStart') continue;
        joints++;
        const ta = arch.pieceStockTrapezoid(a, a.stock), tb = arch.pieceStockTrapezoid(b, b.stock);
        const line = (q, p1, p2) => Math.abs((p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0])) / Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        if (line(tb[0], ta[1], ta[2]) < 0.01 && line(tb[3], ta[1], ta[2]) < 0.01) planes++;
      }
    }
    check(`ASSEMBLY: every trapezoid in the DXF = pieceStockTrapezoid(piece, stock) in world position (${nF + nL})`, matched === nF + nL, `${matched}/${nF + nL}`);
    check(`ASSEMBLY: neighbouring pieces meet on one joint plane, no overlap (${joints} interior joints)`, joints > 0 && planes === joints, `${planes}/${joints}`);
  }
  const fingers = d.polys.filter((p) => p.layer === 'FINGER');
  const nJoints = (nF - 1) + (nL - 1);
  check(`FINGER: only the ${nJoints} joint planes of the assembled blanks (fingers are a note, not drawn)`, fingers.length === nJoints && fingers.every((p) => !p.closed && p.n === 2), String(fingers.length));
  check(`FINGER: joint planes are the member face long (${tF} × ${nF - 1}, ${tL} × ${nL - 1})`,
    fingers.filter((p) => near(p.straight, tF, 0.01)).length === nF - 1 && fingers.filter((p) => near(p.straight, tL, 0.01)).length === nL - 1, fingers.map((p) => p.straight.toFixed(2)).join(' '));
  const texts = d.texts.map((t) => t.text);
  check('TEXT: labels for both members', texts.some((t) => t === 'W1 - FRAME HEAD') && texts.some((t) => t === 'W1 - LEAF TOP'));
  check('TEXT: shape / size / hinge line', texts.some((t) => t === 'THREE-CENTRE W1200 RISE240 H2000 HINGE L'), texts.join(' | '));
  check('TEXT: finger profile 15/16/3.8', texts.some((t) => t === 'FINGER 15/16/3.8'));
  check('TEXT: allowance 10 per side + both hard limits + the board cap printed', texts.some((t) => t === 'ALLOWANCE 10 PER SIDE  LIMITS: OVERALL >= 450 (CLAMP)  SHORTER EDGE >= 400  STOCK MAX 200'), texts.filter((t) => t.startsWith('ALLOW')).join(' | '));
  const chainRe = new RegExp(`^CHAIN R150/1320/150 L1395(\\.\\d)? 180DEG: FEWEST ${iF[0].fewest.n} x board ${iF[0].fewest.stock} L\\d+(\\.\\d)? ROUGH \\d+(\\.\\d)? WASTE ${Math.round(iF[0].fewest.waste * 100)}%$`);
  check(`TEXT: head CHAIN line (radii 150/1320/150, 180°, FEWEST ${iF[0].fewest.n} × ${iF[0].fewest.stock}, waste ${Math.round(iF[0].fewest.waste * 100)} %)`, texts.some((t) => chainRe.test(t)), texts.filter((t) => t.startsWith('CHAIN')).join(' | '));
  const altRe = new RegExp(`^  ECONOMY ALT ${iF[0].alt.n} x board ${iF[0].alt.stock} L\\d+(\\.\\d)? ROUGH \\d+(\\.\\d)? WASTE ${Math.round(iF[0].alt.waste * 100)}% -> DEFAULT ECONOMY \\(THRESHOLD 45%\\)$`);
  check(`TEXT: head ECONOMY ALT line (${iF[0].alt.n} × ${iF[0].alt.stock} → DEFAULT ECONOMY, threshold 45 %)`, texts.some((t) => altRe.test(t)), texts.filter((t) => t.startsWith('  ECONOMY')).join(' | '));
  check('TEXT: leaf line — NO ECONOMY ALT WITHIN 5 PIECES -> DEFAULT FEWEST', texts.some((t) => t === '  NO ECONOMY ALT WITHIN 5 PIECES -> DEFAULT FEWEST'), texts.filter((t) => t.startsWith('  NO')).join(' | '));
  check('TEXT: CLAMPS (SUGGESTION) line per ring with the piece thickness 93 / 57', texts.some((t) => t === 'CLAMPS (SUGGESTION): UNICLAMP 130 x 130, CLEARANCE 20 FROM THE END CUTS, JAWS 40-98, PIECE THICKNESS 93') && texts.some((t) => t.endsWith('PIECE THICKNESS 57')));
  check('TEXT: flat piece labels print L <rough> x <stock>', texts.some((t) => new RegExp(`^W1 - FRAME HEAD P1 L\\d+(\\.\\d)? x${stockF}$`).test(t)) && texts.some((t) => new RegExp(`^W1 - LEAF TOP P1 L\\d+(\\.\\d)? x${stockL}$`).test(t)), texts.filter((t) => / P1 /.test(t)).join(' | '));
  check('TEXT: flat piece note prints OUT / IN / CUT codes (J<deg> joint, Q square springing end, A<deg> apex) / finger ends', texts.filter((t) => /^OUT \d+(\.\d)? IN \d+(\.\d)? CUT (Q|[JA]\d+(\.\d)?)\/(Q|[JA]\d+(\.\d)?) (FINGER BOTH ENDS|FINGER ONE END|NO FINGER)$/.test(t)).length === nF + nL, texts.filter((t) => t.startsWith('OUT')).join(' | '));
  check('TEXT: cut-code legend line (v4: Q = square)', texts.some((t) => t === 'CUT CODES: J = JOINT FROM SQUARE  Q = SQUARE (SPRINGING FACE ROUTED WITH THE CONTOUR)  A = APEX FROM SQUARE'));
  const clampPolys = d.polys.filter((p) => p.layer === 'CLAMPS');
  check(`CLAMPS: two 130 × 130 closed squares per piece (${2 * (nF + nL)})`, clampPolys.length === 2 * (nF + nL) && clampPolys.every((p) => p.closed && p.n === 4 && near(p.bbox[2] - p.bbox[0], 130, 1e-3) && near(p.bbox[3] - p.bbox[1], 130, 1e-3)), String(clampPolys.length));
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
    { shape: 'three-centre', rise: 390, exp: (δ) => threeExp(390, δ, R_MIN) },
  ];
  // Stage 2a: one sample per shape next to the three-centre-240 one (docs/handover/samples), ezdxf-checked below
  for (const c of cases) {
    const plan = arch.buildArchPlan({ shape: c.shape, width: W, height: 2000, rise: c.rise, hinge: 'right' }, PA);
    const path = resolve(SAMPLES, `sample_arch_1200_${c.shape}.dxf`);
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
    // Piotr 06.09: PIECES are the raw trapezoids (straight, stock wide, rough long); ASSEMBLY the glued blank
    check(`${c.shape}: PIECES count ${nPieces}, straight trapezoids (no arcs)`, pieces.length === nPieces && pieces.every((p) => p.n === 4 && p.arcs === 0), `${pieces.length}`);
    const allPc = [...plan.plans.frameHead.pieces, ...plan.plans.leafTop.pieces];
    const roughs = allPc.map((pc) => pc.roughLength).sort((a, b) => a - b);
    const lens = pieces.map((p) => p.bbox[2] - p.bbox[0]).sort((a, b) => a - b);
    check(`${c.shape}: PIECES lengths = rough lengths (outer stock edge + fingers) ±0.5`, lens.every((l, i) => near(l, roughs[i], 0.5)), `${lens.map((l) => l.toFixed(1))} vs ${roughs.map((l) => l.toFixed(1))}`);
    const boards = d.polys.filter((p) => p.layer === 'ASSEMBLY');
    check(`${c.shape}: ASSEMBLY = one straight trapezoid per piece (${nPieces})`, boards.length === nPieces && boards.every((p) => p.n === 4 && p.arcs === 0), `${boards.length}`);
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
  check('rectangular sash → skip "not an arched sash"; door → skip "not a casement or sash window" (v3: the arched sash exports too)', cncExport.archParamsForWindow(sash, 'S').skip === 'not an arched sash' && cncExport.archParamsForWindow(door, 'D').skip === 'not a casement or sash window');
  check('standard casement → skip "not an arched casement"', cncExport.archParamsForWindow(mk({ casementType: 'standard' }), 'C').skip === 'not an arched casement');
  const ok = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' }), 'W7');
  check('PSW segmental-arch 1200 → params with a three-centre rise 240 plan (P10) + winNum', !ok.skip && ok.params.plan.shape === 'three-centre' && ok.params.plan.rise === 240 && ok.params.winNum === 'W7' && ok.params.plan.hinge === 'right', ok.skip);   // v3 0.4b: hinge value 1:1
  check('canExportArchDxf: true for the arched casement, false for a rectangular casement, sash and door',
    cncExport.canExportArchDxf(mk({ casementType: 'arched', casArchShape: 'semi-circle' })) === true && cncExport.canExportArchDxf(mk({ casementType: 'standard' })) === false
    && cncExport.canExportArchDxf(sash) === false && cncExport.canExportArchDxf(door) === false);
  const narrow = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 300 }), 'N');
  check('width 300 → readable skip (below the minimum 400mm)', /below the minimum 400mm/.test(narrow.skip || ''), narrow.skip);
  const low = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { height: 1400 }), 'L');
  check('H 1400 with rise 600 → readable skip (800 straight < 900)', /leaves 800mm straight below the arch — minimum 900mm/.test(low.skip || ''), low.skip);
  const noStock = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [50] } }, () => cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }), 'N'));
  check('no stock board fits → skip explains which member / group needs what (v4 wording)', /^no valid blank plan \(no stock board fits\): frame head chain: no stock board fits \(needs \d+\+ for \d+ pieces, widest 50\); leaf top chain: no stock board fits/.test(noStock.skip || ''), noStock.skip);
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
    && r.skipped.some((s) => s.name === 'S' && s.reason === 'not an arched sash') && r.skipped.some((s) => s.name === 'C' && s.reason === 'not an arched casement'), JSON.stringify(r));
  check('exportArchDxfMerged: one download named Pack_1_arch.dxf', clicks === 1 && lastName === 'Pack_1_arch.dxf', String(lastName));
  const mergedText = await lastBlob.text();
  const mergedPath = resolve(AUDIT, 'merged_pack.dxf');
  writeFileSync(mergedPath, mergedText);
  const dm = probe(mergedPath);
  const contoursA = dm.polys.filter((p) => p.layer === 'CONTOUR');
  check('merged DXF: 4 CONTOUR rings (2 windows × head + leaf), labels A and B', contoursA.length === 4 && dm.texts.some((t) => t.text === 'A - FRAME HEAD') && dm.texts.some((t) => t.text === 'B - FRAME HEAD'));
  {
    const p1 = arch.buildArchPlan({ shape: 'three-centre', width: W, height: 2000, rise: 240 }, PA);
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
  check('exportArchDxfMerged with no arched window → error + skipped, no download', none.error === 'No arched casements or sashes in this pack' && none.skipped.length === 1 && clicks === 1);
  const single = cncExport.exportArchDxfForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }), 'Win 3');
  check('exportArchDxfForWindow: download named Win_3_arch.dxf', single.ok === true && lastName === 'Win_3_arch.dxf' && clicks === 2);
  check('exportArchDxfForWindow on a rectangular sash → error, no download', cncExport.exportArchDxfForWindow(sash, 'S').error === 'not an arched sash' && clicks === 2);
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
  check('spec vector: casementType arched + casArchShape elliptical-arch + cas-arch-opening right → shape three-centre, hinge right (v3 0.4b identity), rise 390, riseSource ratio',
    s9.category === 'casement' && s9.arch?.shape === 'three-centre' && s9.arch?.hinge === 'right' && near(s9.arch?.rise, 390, 1e-9) && s9.arch?.riseSource === 'ratio' && s9.arch?.profile === null, JSON.stringify(s9.arch));
  expectThrows('unknown PSW shape throws (never a silent rectangle)', () => psw({ casementType: 'arched', casArchShape: 'foo' }), /Unknown PSW arch shape "foo" on window "PSW-1"/);
  expectThrows('unknown PC-native shape throws', () => specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', archShape: 'oval' }), /Unknown arch shape "oval"/);
  const a1 = psw({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' });
  check('PSW segmental-arch → three-centre (P10), rise 240 (PSW segmental ratio 0.20), start 1760, riseSource ratio, bars none 0/0',
    a1.category === 'casement' && a1.arch?.shape === 'three-centre' && near(a1.arch?.rise, 240, 1e-9) && a1.arch?.start === 1760 && a1.arch?.riseSource === 'ratio'
    && a1.arch?.bars?.pattern === 'none' && a1.arch?.bars?.h === 0 && a1.arch?.bars?.v === 0, JSON.stringify(a1.arch));
  check('PSW casArchHinge "right" → hinge right (v3 0.4b: the value is the contract, identity mapping)', a1.arch?.hinge === 'right', String(a1.arch?.hinge));
  const a2 = psw({ casementType: 'arched', casArchShape: 'gothic-arch', casArchHinge: 'left' });
  check('PSW casArchHinge "left" → hinge left (v3 0.4b identity)', a2.arch?.hinge === 'left');
  check('PSW gothic-arch → gothic-equilateral, profile equilateral, rise 1039.23', a2.arch?.shape === 'gothic-equilateral' && a2.arch?.profile === 'equilateral' && near(a2.arch?.rise, 1039.23, 0.01));
  const a2d = psw({ casementType: 'arched', casArchShape: 'gothic-arch', archProfile: 'drop' });
  check('PSW gothic-arch + archProfile drop → gothic-drop, rise 0.70 × W = 840', a2d.arch?.shape === 'gothic-drop' && a2d.arch?.profile === 'drop' && near(a2d.arch?.rise, 840, 1e-9));
  const a2s = psw({ casementType: 'arched', casArchShape: 'gothic-arch', archProfile: 'shallow' });
  check('PSW gothic-arch + archProfile shallow → gothic-drop, rise 0.60 × W = 720', a2s.arch?.shape === 'gothic-drop' && a2s.arch?.profile === 'shallow' && near(a2s.arch?.rise, 720, 1e-9));
  check('PSW semi-circle → semi-circle, rise 600', (() => { const s = psw({ casementType: 'arched', casArchShape: 'semi-circle' }); return s.arch?.shape === 'semi-circle' && near(s.arch?.rise, 600, 1e-9); })());
  const a3 = psw({ casementType: 'arched' });
  check('PSW arched with no shape/hinge saved → semi-circle, hinge right (PSW default value "right", v3 0.4b identity)', a3.arch?.shape === 'semi-circle' && a3.arch?.hinge === 'right');
  check('standard casement → arch null', psw({ casementType: 'standard' }).arch === null);
  check('sash window → arch null', specification.normaliseToWindowSpec({ width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } }).arch === null);
  const a4 = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', archShape: 'gothic-drop', archRise: 800, archHinge: 'right' });
  check('PC-native item: archShape / archRise / archHinge taken as-is, riseSource custom', a4.arch?.shape === 'gothic-drop' && a4.arch?.rise === 800 && a4.arch?.riseSource === 'custom' && a4.arch?.hinge === 'right');
  const a5 = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'left' });
  check('batch item with PSW field names (moveToProduction copies config) → mapped the same way', a5.arch?.shape === 'three-centre' && a5.arch?.hinge === 'left');
  check('rise follows the width: W 1000 PSW segmental-arch → 200', near(psw({ casementType: 'arched', casArchShape: 'segmental-arch' }, { width: 1000 }).arch?.rise, 200, 1e-9));
  // v2: PC-native start / legacy shape / round resolution / bars
  const v2a = specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'three-centre', archStart: 1300, archRiseSource: 'custom', archHinge: 'left' });
  check('PC item with archStart 1300 (H 1500) → rise 200, start 1300, three-centre, riseSource custom', v2a.arch?.shape === 'three-centre' && v2a.arch?.rise === 200 && v2a.arch?.start === 1300 && v2a.arch?.riseSource === 'custom', JSON.stringify(v2a.arch));
  const v2b = specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'three-centre', archStart: 1000, archRiseSource: 'custom' });
  check('PC item with archStart = H − W/2 → resolves to semi-circle (Half), rise 500', v2b.arch?.shape === 'semi-circle' && v2b.arch?.rise === 500, JSON.stringify(v2b.arch));
  expectThrows('PC item with archStart giving rise 520 > W/2 throws "use Gothic" (never a silent shape)', () => specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'three-centre', archStart: 980 }), /above half the width \(500mm\): use Gothic/);
  const v2c = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', casementType: 'arched', archShape: 'segmental', archRise: 300, archRiseSource: 'custom' });
  check('v1-era PC "segmental" (even with a custom rise) migrates to three-centre, rise 0.20 × W = 240, riseSource ratio (P10 / spec A)', v2c.arch?.shape === 'three-centre' && v2c.arch?.rise === 240 && v2c.arch?.riseSource === 'ratio' && v2c.arch?.start === 1760, JSON.stringify(v2c.arch));
  const v2d = specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle', archStart: 1000, archBarPattern: 'hub-spoke', casementHBars: 1, casementVBars: 2 });
  check('bars: archBarPattern hub-spoke + casementHBars 1 / casementVBars 2 → arch.bars { hub-spoke, 1, 2 }', v2d.arch?.bars?.pattern === 'hub-spoke' && v2d.arch?.bars?.h === 1 && v2d.arch?.bars?.v === 2, JSON.stringify(v2d.arch?.bars));
  expectThrows('unknown bar pattern throws', () => specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle', archBarPattern: 'star' }), /Unknown arch bar pattern "star"/);
  check('PSW elliptical-arch W 1000 → three-centre rise 325 (0.325), start = H − 325', (() => { const s = psw({ casementType: 'arched', casArchShape: 'elliptical-arch' }, { width: 1000, height: 1500 }); return s.arch?.shape === 'three-centre' && near(s.arch?.rise, 325, 1e-9) && s.arch?.start === 1175; })());
  // real data path: windowSpec → deriveWindowData (must not throw) → plan from the ACTIVE profile
  let derived = null, err = null;
  try { derived = calculations.deriveWindowData(a1, {}); } catch (e) { err = e; }
  check('deriveWindowData on an arched casement spec does not throw (rectangular casement engine unchanged)', !err && derived && !derived.unsupported && derived.components.box.length >= 4, err ? String(err) : '');
  const planLive = arch.buildArchPlan({ shape: a1.arch.shape, width: a1.frame.width, height: a1.frame.height, rise: a1.arch.rise, hinge: a1.arch.hinge }, profile.getCasementProfile());
  const planDef = arch.buildArchPlan({ shape: 'three-centre', width: 1200, height: 2000, rise: 240, hinge: 'right' }, P);
  check('buildArchPlan from windowSpec + getCasementProfile() equals the default-profile plan', JSON.stringify(planLive.plans.frameHead.pieces.map((p) => [p.no, p.stock, +p.wReq.toFixed(6)])) === JSON.stringify(planDef.plans.frameHead.pieces.map((p) => [p.no, p.stock, +p.wReq.toFixed(6)])) && planLive.hinge === 'right');

  // profile block + migration
  check('DEFAULT_CASEMENT_PROFILE.arch v4: finger 15/16/3.8, stock [63, 75, 95, 105, 120, 150, 180, 200], contourAllowance 10, minPieceLength 400, wasteThreshold 0.45, limits, minHaunchRadius 150, patterns; no maxSegmentAngleDeg / pieceRule; cnc block',
    P.arch && P.arch.version === 4 && P.arch.minHaunchRadius === 150 && JSON.stringify(P.arch.patterns.hubRingRatios) === '[0.3,0.6,0.8]' && P.arch.patterns.intersecting.pitch === 450
    && P.arch.finger.length === 15 && P.arch.finger.depth === 16 && P.arch.finger.pitch === 3.8
    && JSON.stringify(P.arch.stockWidths) === JSON.stringify([63, 75, 95, 105, 120, 150, 180, 200]) && P.arch.contourAllowance === 10 && P.arch.minPieceLength === 400 && P.arch.wasteThreshold === 0.45
    && !('maxSegmentAngleDeg' in P.arch) && !('pieceRule' in P.arch) && !('widthAllowance' in P.arch) && !('maxPieces' in P.arch)
    && JSON.stringify(P.arch.limits) === JSON.stringify({ minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 })
    && P.cnc.minClampLength === 450 && P.cnc.clamp.base === 130 && P.cnc.clampClearance === 20);
  const { arch: _drop, cnc: _dropC, ...v11 } = JSON.parse(JSON.stringify(P));
  void _drop; void _dropC;
  const m1 = profile.migrateCasementProfile(v11);
  check('migrateCasementProfile: v1.1 profile without arch / cnc gets both default sections', JSON.stringify(m1.arch) === JSON.stringify(P.arch) && JSON.stringify(m1.cnc) === JSON.stringify(P.cnc));
  const m2 = profile.migrateCasementProfile({ ...v11, arch: { version: 4, finger: { pitch: 4.2 }, stockWidths: [150], limits: { maxWidth: 1800 }, patterns: { intersecting: { pitch: 500 } } }, cnc: { clamp: { base: 140 } } });
  check('migrateCasementProfile: partial v4 arch / cnc sections merge (pitch 4.2, stock [150], maxWidth 1800, tracery pitch 500, clamp base 140, rest default)',
    m2.arch.finger.length === 15 && m2.arch.finger.pitch === 4.2 && JSON.stringify(m2.arch.stockWidths) === '[150]' && m2.arch.contourAllowance === 10 && m2.arch.minPieceLength === 400 && m2.arch.wasteThreshold === 0.45
    && m2.arch.limits.maxWidth === 1800 && m2.arch.limits.minWidth === 400 && m2.arch.limits.minStraightBelowRise === 900 && m2.arch.minHaunchRadius === 150
    && m2.arch.patterns.intersecting.pitch === 500 && m2.arch.patterns.intersecting.minMullions === 2 && JSON.stringify(m2.arch.patterns.hubRingRatios) === '[0.3,0.6,0.8]'
    && m2.cnc.clamp.base === 140 && m2.cnc.clamp.minThickness === 40 && m2.cnc.minClampLength === 450 && m2.cnc.clampClearance === 20);
  const m2v3 = profile.migrateCasementProfile({ ...v11, arch: { version: 3, finger: { length: 15, depth: 16, pitch: 3.8 }, stockWidths: [50, 63, 75, 95, 105, 180, 200], contourAllowance: 10, maxSegmentAngleDeg: 36, pieceRule: 'narrowest', minPieceLength: 150, minHaunchRadius: 150, limits: P.arch.limits, patterns: P.arch.patterns } });
  check('migrateCasementProfile: a stored v3 block (36° rule, pieceRule, 150 warn) is replaced whole by the v4 default', JSON.stringify(m2v3.arch) === JSON.stringify(P.arch));
  const m3 = profile.migrateCasementProfile({ ...v11, arch: { finger: { length: 15, depth: 16, pitch: 3.8 }, stockWidths: [100, 125, 150, 175, 200, 225, 250], widthAllowance: 20, maxPieces: 8 } });
  check('migrateCasementProfile: night-1 arch block (no version, invented stock list) is replaced whole by the default', JSON.stringify(m3.arch) === JSON.stringify(P.arch));
  check('migrateCasementProfile: pre-v1 shape still replaced by the default (arch included)', profile.migrateCasementProfile({ frameDepth: 93 }).arch === P.arch);
}

// ═══════════════════════════════════════════════════════════════════════════
// §10.3 item 10 — frozen files untouched (git diff against the merge base with main)
// ═══════════════════════════════════════════════════════════════════════════
section('§10.3 pt 10 — casementLayouts.js / jambDxf.js unchanged (git diff vs merge-base with main); v2 opens lists.js + calculations.js');
{
  const FROZEN = ['src/engine/casementLayouts.js', 'src/engine/cnc/jambDxf.js'];
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
