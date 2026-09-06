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
  // v2: the §10.2 "HEAD / LEAF segmental 1200" vectors are superseded (P2) —
  // the same window is a three-centre rise 240 under P3; its per-arc plan is
  // asserted against the independent option table below (PLAN_VECTORS) and
  // these literals computed 06.09 from that rule:
  headThreeCentre240: {
    haunch: { thetaDeg: 67.38, nMin: 2, options: [{ N: 2, wReq: 80.56, stock: 95 }, { N: 3, wReq: 78.59, stock: 95 }], d13: { n: 2, stock: 95 }, runnerUp: null },
    crown: { thetaDeg: 45.24, nMin: 2, options: [{ N: 2, wReq: 101.33, stock: 105 }, { N: 3, wReq: 87.83, stock: 95 }, { N: 4, wReq: 83.10, stock: 95 }], d13: { n: 3, stock: 95 }, runnerUp: { n: 2, stock: 105 } },
  },
  leafThreeCentre240: {
    haunch: { thetaDeg: 67.38, nMin: 2, options: [{ N: 2, wReq: 88.42, stock: 95 }], d13: { n: 2, stock: 95 }, runnerUp: null },
    crown: { thetaDeg: 45.24, nMin: 2, options: [{ N: 2, wReq: 110.36, stock: 180 }, { N: 3, wReq: 97.40, stock: 105 }, { N: 4, wReq: 92.85, stock: 95 }], d13: { n: 4, stock: 95 }, runnerUp: { n: 2, stock: 180 } },
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
  const gS = GEOM['three-centre-240'], gC = GEOM['semi-circle'];
  assertSpecPlan('HEAD semi-circle 1200', arch.planArchSegments(gC.frameHead, P.arch).arcs[0], SPEC_PLANS.headSemi);
  // three-centre 240 (the former segmental window under P3): per-arc literals
  const arcPlan = (label, planArc, S) => {
    expectNear(`${label}: θ ${S.thetaDeg}°`, planArc.spanDeg, S.thetaDeg, 0.01);
    check(`${label}: N_min ${S.nMin}`, planArc.nMin === S.nMin, String(planArc.nMin));
    for (const so of S.options) {
      const o = planArc.options.find((x) => x.n === so.N);
      check(`${label} N=${so.N}: W_req ${so.wReq} (±0.05), stock ${so.stock}`, !!o && near(o.wReq, so.wReq, 0.05) && o.stock === so.stock, o ? `${o.wReq.toFixed(2)} → ${o.stock}` : 'missing');
    }
    check(`${label}: D13 default ${S.d13.n} × ${S.d13.stock}, runner-up ${S.runnerUp ? `${S.runnerUp.n} × ${S.runnerUp.stock}` : 'none'}`,
      planArc.default?.n === S.d13.n && planArc.default?.stock === S.d13.stock && (planArc.alternative?.n ?? null) === (S.runnerUp?.n ?? null) && (planArc.alternative?.stock ?? null) === (S.runnerUp?.stock ?? null),
      `${planArc.default?.n} × ${planArc.default?.stock}, alt ${planArc.alternative?.n} × ${planArc.alternative?.stock}`);
  };
  const ph = arch.planArchSegments(gS.frameHead, P.arch), pl = arch.planArchSegments(gS.leafTop, P.arch);
  arcPlan('HEAD three-centre 240 haunch', ph.arcs[0], SPEC_PLANS.headThreeCentre240.haunch);
  arcPlan('HEAD three-centre 240 crown', ph.arcs[1], SPEC_PLANS.headThreeCentre240.crown);
  arcPlan('LEAF three-centre 240 haunch', pl.arcs[0], SPEC_PLANS.leafThreeCentre240.haunch);
  arcPlan('LEAF three-centre 240 crown', pl.arcs[1], SPEC_PLANS.leafThreeCentre240.crown);
  check('three-centre 240: both haunch arcs plan identically (mirror)', JSON.stringify(ph.arcs[0].options.map((o) => [o.n, +o.wReq.toFixed(6), o.stock])) === JSON.stringify(ph.arcs[2].options.map((o) => [o.n, +o.wReq.toFixed(6), o.stock])));
  check('three-centre 240: head 2 + 3 + 2 = 7 pieces, leaf 2 + 4 + 2 = 8 — never a single solid board', ph.totalPieces === 7 && pl.totalPieces === 8);
}

section('§10.3 pt 6 — planner vs independent option table, every shape, both D13 rules');
const PLAN_VECTORS = [
  { key: 'three-centre-240', shape: 'three-centre', defN: [2, 3, 2], altN: [null, 2, null] },
  { shape: 'semi-circle', defN: [7], altN: [5] },
  { shape: 'gothic-equilateral', defN: [3, 3], altN: [2, 2] },
  { shape: 'gothic-drop', defN: [3, 3], altN: [2, 2] },
  { shape: 'three-centre', defN: [2, 4, 2], altN: [null, 3, null] },
];
const PLANS = {};
for (const v of PLAN_VECTORS) {
  const tag = v.key || v.shape;
  const g = GEOM[tag];
  const plan = arch.planArchSegments(g.frameHead, PLAN_OPTS);
  PLANS[tag] = plan;
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
  // v2: the "one board for a single-centre arc below 36°" rule (spec §7.2) has
  // no product left to apply to — the only single-arc shape is the 180°
  // semi-circle (rule C). The planner branch stays; the semi-circle proves it idle.
  check('semi-circle (the only single-arc shape): N_min stays 5, the one-board branch never fires', PLANS['semi-circle'].arcs[0].nMin === 5);
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
  check('layers CONTOUR / ASSEMBLY / PIECES / FINGER / TEXT present', ['CONTOUR', 'ASSEMBLY', 'PIECES', 'FINGER', 'TEXT'].every((l) => d.layers.includes(l)), d.layers.join(','));
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
  // plans in the sample = D13 (narrowest) per arc: head 2 + 3 + 2 × 95 (crown ALT 2 × 105); leaf 2 + 4 + 2 × 95 (crown ALT 2 × 180)
  const nF = plan.plans.frameHead.totalPieces, nL = plan.plans.leafTop.totalPieces;
  const expFa = plan.frameHead.outer.map((_, i) => expectedChoice(expectedOptions(plan.frameHead, i), PA.arch.pieceRule));
  const expLa = plan.leafTop.outer.map((_, i) => expectedChoice(expectedOptions(plan.leafTop, i), PA.arch.pieceRule));
  const expF = expFa[0], expL = expLa[0];
  const sumN = (arr) => arr.reduce((a, e) => a + e.def.n, 0);
  const stocksOk = (pl, exp) => pl.arcs.every((a, i) => a.default.pieces.every(() => a.default.stock === exp[i].def.stock));
  check(`sample plans: frame head ${nF} pieces (${expFa.map((e) => e.def.n).join(' + ')}), leaf top ${nL} (${expLa.map((e) => e.def.n).join(' + ')}) — independent option table per arc`,
    nF === sumN(expFa) && nL === sumN(expLa) && stocksOk(plan.plans.frameHead, expFa) && stocksOk(plan.plans.leafTop, expLa),
    `${nF}/${nL} vs ${sumN(expFa)}/${sumN(expLa)}`);
  check('sample plans (P3 three-centre 240): head 2 + 3 + 2 × 95 (crown runner-up 2 × 105), leaf 2 + 4 + 2 × 95 — never a single solid board',
    nF === 7 && nL === 8 && expFa.every((e) => e.def.stock === 95) && expFa[1].alt?.n === 2 && expFa[1].alt?.stock === 105 && expLa.every((e) => e.def.stock === 95));
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
  check('TEXT: shape / size / hinge line', texts.some((t) => t === 'THREE-CENTRE W1200 RISE240 H2000 HINGE L'), texts.join(' | '));
  check('TEXT: finger profile 15/16/3.8', texts.some((t) => t === 'FINGER 15/16/3.8'));
  check('TEXT: allowance 10 per side + max segment 36 deg + rule printed', texts.some((t) => t === 'ALLOWANCE 10 PER SIDE  MAX SEGMENT 36 DEG  RULE NARROWEST'), texts.filter((t) => t.startsWith('ALLOW')).join(' | '));
  const altTxt = (e) => (e.alt ? ` \\(ALT ${e.alt.n} x board ${e.alt.stock}\\)` : '');
  const planRe = new RegExp(`^ARC 1 R150 L176\\.4 67\\.4DEG: ${expF.def.n} x board ${expF.def.stock} L\\d+(\\.\\d)? ROUGH \\d+(\\.\\d)?${altTxt(expF)}$`);
  check(`TEXT: haunch ARC 1 line (${expF.def.n} × ${expF.def.stock}, no ALT)`, texts.some((t) => planRe.test(t)), texts.filter((t) => t.startsWith('ARC 1')).join(' | '));
  const crownRe = new RegExp(`^ARC 2 R1320 L1042\\.2 45\\.2DEG: ${expFa[1].def.n} x board ${expFa[1].def.stock} L\\d+(\\.\\d)? ROUGH \\d+(\\.\\d)?${altTxt(expFa[1])}$`);
  check(`TEXT: crown ARC 2 line with the D13 runner-up (${expFa[1].def.n} × ${expFa[1].def.stock}, ALT ${expFa[1].alt?.n ?? '-'} × ${expFa[1].alt?.stock ?? '-'})`, texts.some((t) => crownRe.test(t)), texts.filter((t) => t.startsWith('ARC 2')).join(' | '));
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
  check('DEFAULT_CASEMENT_PROFILE.arch v3: finger 15/16/3.8, stock D7 [50, 63, 75, 95, 105, 180, 200], contourAllowance 10, maxSegmentAngleDeg 36, pieceRule narrowest, limits, minHaunchRadius 150, patterns',
    P.arch && P.arch.version === 3 && P.arch.minHaunchRadius === 150 && JSON.stringify(P.arch.patterns.hubRingRatios) === '[0.3,0.6,0.8]' && P.arch.patterns.intersecting.pitch === 450
    && P.arch.finger.length === 15 && P.arch.finger.depth === 16 && P.arch.finger.pitch === 3.8
    && JSON.stringify(P.arch.stockWidths) === JSON.stringify([50, 63, 75, 95, 105, 180, 200]) && P.arch.contourAllowance === 10 && P.arch.maxSegmentAngleDeg === 36
    && P.arch.pieceRule === 'narrowest' && !('widthAllowance' in P.arch) && !('maxPieces' in P.arch)
    && JSON.stringify(P.arch.limits) === JSON.stringify({ minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 }));
  const { arch: _drop, ...v11 } = JSON.parse(JSON.stringify(P));
  void _drop;
  const m1 = profile.migrateCasementProfile(v11);
  check('migrateCasementProfile: v1.1 profile without arch gets the default section', JSON.stringify(m1.arch) === JSON.stringify(P.arch));
  const m2 = profile.migrateCasementProfile({ ...v11, arch: { version: 3, finger: { pitch: 4.2 }, stockWidths: [150], limits: { maxWidth: 1800 }, patterns: { intersecting: { pitch: 500 } } } });
  check('migrateCasementProfile: partial v3 arch section merges (pitch 4.2, stock [150], maxWidth 1800, tracery pitch 500, rest default)',
    m2.arch.finger.length === 15 && m2.arch.finger.pitch === 4.2 && JSON.stringify(m2.arch.stockWidths) === '[150]' && m2.arch.contourAllowance === 10 && m2.arch.maxSegmentAngleDeg === 36
    && m2.arch.limits.maxWidth === 1800 && m2.arch.limits.minWidth === 400 && m2.arch.limits.minStraightBelowRise === 900 && m2.arch.minHaunchRadius === 150
    && m2.arch.patterns.intersecting.pitch === 500 && m2.arch.patterns.intersecting.minMullions === 2 && JSON.stringify(m2.arch.patterns.hubRingRatios) === '[0.3,0.6,0.8]');
  const m2v2 = profile.migrateCasementProfile({ ...v11, arch: { version: 2, finger: { length: 15, depth: 16, pitch: 3.8 }, stockWidths: [50, 63, 75, 95, 105, 180, 200], contourAllowance: 10, maxSegmentAngleDeg: 36, pieceRule: 'fewest', limits: P.arch.limits } });
  check('migrateCasementProfile: a stored v2 block (no minHaunchRadius) is replaced whole by the v3 default', JSON.stringify(m2v2.arch) === JSON.stringify(P.arch));
  const m3 = profile.migrateCasementProfile({ ...v11, arch: { finger: { length: 15, depth: 16, pitch: 3.8 }, stockWidths: [100, 125, 150, 175, 200, 225, 250], widthAllowance: 20, maxPieces: 8 } });
  check('migrateCasementProfile: night-1 arch block (no version, invented stock list) is replaced whole by the v2 default', JSON.stringify(m3.arch) === JSON.stringify(P.arch));
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
