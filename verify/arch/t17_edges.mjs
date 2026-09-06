/**
 * t17 — arched-casement-v1 edge-case harness (Stage 2b of the 06.09 audit).
 *
 * Everything t16 proves on the spec's W = 1200 vectors is exercised here at
 * the limits: W 400 / 1500 for every shape, rises just inside / outside every
 * rule, the height rules, no fitting board, the widest board, the exporter's
 * skip messages on the real windowSpec path. Every failure must be a readable
 * ArchError — never a NaN, never a silent rectangle.
 *
 * Findings this file documents (BLOCKERS.md §8, updated for v2):
 *   F1 (v1) the deepest ring (leaf inner = leafAtJamb + leafTop.face — 107 on
 *       the 57 frame, 118 since v4 Block F: 51 + 67) plus the contour allowance
 *       (10) had to sit above the arch-start line, so a three-centre haunch
 *       radius ≤ 117 mm was impossible.
 *   F2 (v2, P3) the haunch radius never drops below profile arch.minHaunchRadius
 *       (150), so F1 cannot bind any more — instead a Round arch needs a rise
 *       ABOVE 150 (rise = haunch radius leaves no crown arc). At W 400 the PSW
 *       defaults (segmental-arch 80, elliptical-arch 130) are REJECTED with a
 *       readable message; the Auto ratio 0.325 × W clears 150 only from W 462.
 *       'segmental' itself is gone (P2): PSW segmental-arch → three-centre 0.20 W.
 *
 * Run: node verify/arch/t17_edges.mjs   (bundles the same modules as t16)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { independentPlan } from './lib/indPlanner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
const ENTRY = resolve(AUDIT, 'arch-edges-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as archDxf from '../src/engine/cnc/archDxf.js';",
  "export * as dxfWriter from '../src/engine/cnc/dxfWriter.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as cncExport from '../src/utils/cncExport.js';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 'arch-edges-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--external:react',
  '--platform=node', `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const { arch, profile, archDxf, dxfWriter, specification, cncExport } = await import(pathToFileURL(BUNDLE).href);
const P = profile.DEFAULT_CASEMENT_PROFILE;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
function expectThrows(name, fn, re) {
  try { fn(); check(name, false, 'did not throw'); }
  catch (e) { check(name, e instanceof arch.ArchError && re.test(e.message), `threw "${e.message}"`); }
}
const section = (t) => console.log(`\n== ${t} ==`);
const SHAPES = ['semi-circle', 'gothic-equilateral', 'gothic-drop', 'three-centre'];
const deepest = P.deductions.leafAtJamb + P.elements.leafTop.face;     // 51 + 67 = 118 (v4 Block F; was 40 + 67 = 107)
const tF = P.elements.frameHead.face, tL = P.elements.leafTop.face, A = P.arch.contourAllowance;   // 68 / 67 / 10
const cillSide = P.deductions.leafFullHeight - P.deductions.leafAtJamb;   // 98 − 51 = 47 (unchanged by Block F)
const finite = (v) => Number.isFinite(v);
function planSane(plan) {
  const rings = [plan.frameHead, plan.leafTop];
  const arcsOk = rings.every((r) => [...r.outer, ...r.inner].every((a) => finite(a.r) && a.r > 0 && finite(a.a0) && finite(a.a1) && a.a1 > a.a0));
  // v4: N starts at 1 and there is no grain run-out angle — every piece must pass the two hard limits instead
  const piecesOk = [plan.plans.frameHead, plan.plans.leafTop].every((pl) => pl.pieces.length >= 1 && pl.pieces.every((pc) =>
    finite(pc.wReq) && pc.wReq > 0 && finite(pc.L) && pc.L > 0 && finite(pc.roughLength) && pc.roughLength >= pc.L - 1e-9 && pc.stock >= pc.wReq - 1e-9
    && pc.roughLength >= P.cnc.minClampLength - 1e-9 && pc.shorterEdge >= P.arch.minPieceLength - 1e-9));
  return arcsOk && piecesOk && !plan.noStock;
}
const IND = { stock: P.arch.stockWidths, allowance: P.arch.contourAllowance, finger: P.arch.finger.length, minClamp: P.cnc.minClampLength, minPiece: P.arch.minPieceLength, threshold: P.arch.wasteThreshold };
const indPlan = (ring) => independentPlan(ring, IND);
/** engine plan of a ring equals the independent planner (groups, default n / stock, or both blocked) */
function planMatches(pl, ring) {
  const ind = indPlan(ring);
  return pl.arcs.length === ind.length && pl.arcs.every((gp, i) => (gp.default?.n ?? null) === (ind[i].def?.n ?? null) && (gp.default?.stock ?? null) === (ind[i].def?.stock ?? null) && gp.reason === ind[i].reason);
}

// ═══════════════════════════════════════════════════════════════════════════
section('W 400 / W 1500 — every shape at the PSW default rise, H = rise + 900 + margin');
// v4: a W 400 arch cannot make a 450 mm piece (semi-circle outer length 628, gothic side 419) — the planner reports
// it (below minimum length), the geometry still builds; W 1500 plans on every shape.
const EDGE_EXPECT = {
  400: {
    'semi-circle': { blocked: true },
    'gothic-equilateral': { blocked: true },
    'gothic-drop': { blocked: true },
    'three-centre': /rise 130mm must exceed the haunch radius 150mm/,   // F2: 0.325 × 400 = 130 ≤ minHaunchRadius
  },
  1500: { 'semi-circle': null, 'gothic-equilateral': null, 'gothic-drop': null, 'three-centre': null },
};
for (const Wd of [400, 1500]) {
  for (const s of SHAPES) {
    const exp = EDGE_EXPECT[Wd][s];
    const rise = arch.ARCH_RISE_RATIO[s] * Wd;
    const H = Math.ceil(rise + P.arch.limits.minStraightBelowRise + 100);
    if (exp instanceof RegExp) {
      expectThrows(`W ${Wd} ${s} (default rise ${rise.toFixed(1)}): rejected readably (F2)`, () => arch.buildArchPlan({ shape: s, width: Wd, height: H, rise: null, hinge: 'left' }, P), exp);
      continue;
    }
    let plan = null, err = null;
    try { plan = arch.buildArchPlan({ shape: s, width: Wd, height: H, rise: null, hinge: 'left' }, P); } catch (e) { err = e; }
    if (exp?.blocked) {
      check(`W ${Wd} ${s} (rise ${rise.toFixed(1)}): geometry builds, the plan is BLOCKED by the 450 / 400 limits (reason below minimum length, never split finer) — engine = independent`,
        !err && plan && plan.noStock && [plan.plans.frameHead, plan.plans.leafTop].some((pl) => pl.noStockReason === 'below minimum length') && planMatches(plan.plans.frameHead, plan.frameHead) && planMatches(plan.plans.leafTop, plan.leafTop),
        err ? err.message : (plan?.plans.frameHead.reasons || []).join(' | '));
      continue;
    }
    check(`W ${Wd} ${s} (rise ${rise.toFixed(1)}): plan builds, every piece passes 450 / 400, boards fit, no NaN, engine = independent planner`, !err && plan && planSane(plan) && planMatches(plan.plans.frameHead, plan.frameHead) && planMatches(plan.plans.leafTop, plan.leafTop), err ? err.message : '');
    if (!plan || plan.noStock) continue;
    // DXF for the edge window goes through the writer and back through ezdxf
    const path = resolve(AUDIT, `edge_${Wd}_${s}.dxf`);
    writeFileSync(path, dxfWriter.writeDxf(archDxf.buildArchEntities(plan, `E${Wd}`), archDxf.ARCH_LAYERS));
    const probe = JSON.parse(execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' }));
    const contours = probe.polys.filter((p) => p.layer === 'CONTOUR');
    const chainLen = plan.frameHead.lengths.outer + plan.frameHead.lengths.inner + plan.leafTop.lengths.outer + plan.leafTop.lengths.inner;
    check(`W ${Wd} ${s}: DXF round-trip, CONTOUR arcs = chain lengths within 0.01`, contours.length === 2 && near(contours.reduce((a, p) => a + p.arcs, 0), chainLen, 0.01));
    const summary = [plan.plans.frameHead, plan.plans.leafTop].map((pl) => pl.arcs.map((a) => `${a.default.n}×${a.default.stock}`).join('+')).join(' | ');
    console.log(`        ${s} W ${Wd}: head | leaf = ${summary}, max rough ${Math.max(...plan.plans.frameHead.pieces.map((pc) => pc.roughLength)).toFixed(0)}`);
  }
}
// F2 boundary (v2 P3): the haunch radius is at least 150, so the rise must exceed 150 — nothing else binds
// the one literal check: the profile IS the v4 Block F spec (leafAtJamb 51 + leafTop.face 67 = 118, minHaunchRadius 150 → 32 to spare)
check(`deepest ring offset read from the profile = ${deepest} (leafAtJamb ${P.deductions.leafAtJamb} + leafTop.face ${tL}) — below minHaunchRadius ${P.arch.minHaunchRadius} by ${P.arch.minHaunchRadius - deepest} (57 frame: 107, by 43)`, deepest === 51 + 67 && P.arch.minHaunchRadius === 150 && P.arch.minHaunchRadius - deepest === 32);
expectThrows('three-centre rise 150 at W 1200 → equals the haunch minimum, no crown arc — readable', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2500, rise: 150 }, P), /rise 150mm must exceed the haunch radius 150mm/);
check('three-centre rise 151 at W 1200 builds (r 150, crown R 101400.5, haunch spans 89.7°); its plan = the independent planner (planned or blocked alike)', (() => {
  const g = arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2500, rise: 151 }, P);
  const pl = arch.buildArchPlan({ shape: 'three-centre', width: 1200, height: 2500, rise: 151, hinge: 'left' }, P);
  return near(g.arcs[0].r, 150, 1e-9) && near(g.arcs[1].r, 101400.5, 0.01) && planMatches(pl.plans.frameHead, pl.frameHead) && planMatches(pl.plans.leafTop, pl.leafTop) && (pl.noStock || planSane(pl));
})());
check('W 400 three-centre with rise 160 builds (r clamps to 150, crown R 280) — v1 gave r 128; v4: its plan is blocked (W 400 cannot make a 450 piece), engine = independent', (() => { try { const pl = arch.buildArchPlan({ shape: 'three-centre', width: 400, height: 1100, rise: 160, hinge: 'left' }, P); return pl.noStock && planMatches(pl.plans.frameHead, pl.frameHead) && near(pl.arcs[0].r, 150, 1e-9) && near(pl.arcs[1].r, 280, 1e-9); } catch (e) { console.log('        ' + e.message); return false; } })());
expectThrows('W 400 three-centre with rise 150 rejected (rise = haunch minimum)', () => arch.buildArchGeometry({ shape: 'three-centre', width: 400, height: 1100, rise: 150 }, P), /rise 150mm must exceed the haunch radius 150mm/);
expectThrows('W 400 three-centre with rise 146 rejected the same way (no F1 face error any more)', () => arch.buildArchGeometry({ shape: 'three-centre', width: 400, height: 1100, rise: 146 }, P), /rise 146mm must exceed the haunch radius 150mm/);
check('W 400 three-centre rise 199 (just below W/2): r 198, crown R 200.5, builds', (() => { const g = arch.buildArchGeometry({ shape: 'three-centre', width: 400, height: 1100, rise: 199 }, P); return near(g.arcs[0].r, 198.005, 0.001) && near(g.arcs[1].r, 200.5, 0.01); })());
check('minHaunchRadius is live: profile 120 → W 400 three-centre rise 130 builds with r 120', (() => { const g = arch.buildArchGeometry({ shape: 'three-centre', width: 400, height: 1100, rise: 130 }, { ...P, arch: { ...P.arch, minHaunchRadius: 120 } }); return near(g.arcs[0].r, 120, 1e-9); })());

// ═══════════════════════════════════════════════════════════════════════════
section('width limits — just inside / just outside, and the profile limits are the source');
check('W 400 semi-circle passes the width rule', arch.resolveArchRise('semi-circle', 400, null, P.arch.limits) === 200);
check('W 1500 semi-circle passes the width rule', arch.resolveArchRise('semi-circle', 1500, null, P.arch.limits) === 750);
expectThrows('W 399.9 rejected', () => arch.resolveArchRise('semi-circle', 399.9, null, P.arch.limits), /below the minimum 400mm/);
expectThrows('W 1500.1 rejected', () => arch.resolveArchRise('semi-circle', 1500.1, null, P.arch.limits), /above the maximum 1500mm/);
expectThrows('W NaN rejected', () => arch.resolveArchRise('semi-circle', 'abc', null, P.arch.limits), /below the minimum 400mm/);
expectThrows('W 0 rejected', () => arch.resolveArchRise('semi-circle', 0, null, P.arch.limits), /below the minimum 400mm/);
{
  const wide = { ...P, arch: { ...P.arch, limits: { ...P.arch.limits, maxWidth: 1800 } } };
  check('profile limits are live: maxWidth 1800 admits W 1700', planSane(arch.buildArchPlan({ shape: 'semi-circle', width: 1700, height: 2000, hinge: 'left' }, wide)));
}

// ═══════════════════════════════════════════════════════════════════════════
section('rise limits — physics per shape, just inside / just outside (W 1200)');
check('three-centre rise 599.9 (< W/2) builds — haunch r 599.8, crown just above (rule C)', (() => { const a = arch.archArcs('three-centre', 1200, 599.9, { minHaunchRadius: 150 }); return a.length === 3 && near(a[0].r, 599.8, 0.01) && a[1].r > a[0].r; })());
expectThrows('three-centre rise 900 rejected', () => arch.resolveArchRise('three-centre', 1200, 900, P.arch.limits), /must be below half the width/);
check('resolveRoundShape W 1200: rise 600 → semi-circle, 599.4 → three-centre', arch.resolveRoundShape(1200, 600) === 'semi-circle' && arch.resolveRoundShape(1200, 599.4) === 'three-centre');
expectThrows('resolveRoundShape W 1200 rise 601 → use Gothic', () => arch.resolveRoundShape(1200, 601), /use Gothic/);
check('gothic-drop rise 600 (= W/2, c = 0) builds', arch.archArcs('gothic-drop', 1200, 600).length === 2);
expectThrows('gothic-drop rise 599.9 rejected', () => arch.archArcs('gothic-drop', 1200, 599.9), /must be at least half the width/);
check('gothic-drop rise 1500 (1.25 × W) builds — no upper physics limit, only H ≥ rise + 900', arch.archArcs('gothic-drop', 1200, 1500)[0].r > 0);
expectThrows('gothic-drop rise 1500 in H 2399 rejected by the height rule', () => arch.buildArchGeometry({ shape: 'gothic-drop', width: 1200, height: 2399, rise: 1500 }, P), /leaves 899mm straight below the arch/);
check('three-centre rise 599 (< W/2) builds', arch.archArcs('three-centre', 1200, 599).length === 3);
expectThrows('three-centre rise 600 rejected', () => arch.archArcs('three-centre', 1200, 600), /must be below half the width/);
expectThrows('semi-circle rise 599 rejected (fixed shape)', () => arch.resolveArchRise('semi-circle', 1200, 599, P.arch.limits), /fixed by the shape at 600mm/);
check('semi-circle rise 600.4 accepted as the fixed 600 (±0.5 tolerance)', arch.resolveArchRise('semi-circle', 1200, 600.4, P.arch.limits) === 600);
expectThrows('gothic-equilateral rise 1000 rejected (fixed shape 1039.2)', () => arch.resolveArchRise('gothic-equilateral', 1200, 1000, P.arch.limits), /fixed by the shape at 1039.2mm/);
expectThrows('negative rise rejected', () => arch.resolveArchRise('three-centre', 1200, -5, P.arch.limits), /must be a positive number/);
expectThrows('rise "abc" rejected', () => arch.resolveArchRise('three-centre', 1200, 'abc', P.arch.limits), /must be a positive number/);
check('rise "" → default (390 = 0.325 × W)', arch.resolveArchRise('three-centre', 1200, '', P.arch.limits) === 390);
check('rise "300" (string) → 300', arch.resolveArchRise('three-centre', 1200, '300', P.arch.limits) === 300);

// ═══════════════════════════════════════════════════════════════════════════
section('height rules — H ≥ rise + 900 and the leaf straight stile');
expectThrows('H = rise + 899 rejected', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 1139, rise: 240 }, P), /leaves 899mm straight below the arch — minimum 900mm/);
check(`H = rise + 900 builds (straight 900, stile ${900 - cillSide} = 900 − (leafFullHeight − leafAtJamb) ${cillSide})`, (() => { const g = arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 1140, rise: 240 }, P); return g.straightHeight === 900 && g.leafStraightStile === 900 - cillSide; })());
expectThrows('H below the rise rejected with the same rule (negative straight part)', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 500 }, P), /leaves -100mm straight below the arch/);
check('no height → no height rule (pure geometry callers)', arch.buildArchGeometry({ shape: 'semi-circle', width: 1200 }, P).straightHeight === null);
expectThrows('missing arch.limits in the profile → readable', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 2000 }, { ...P, arch: { ...P.arch, limits: undefined } }), /arch\.limits is missing/);
expectThrows('missing arch block in the profile → readable (buildArchPlan)', () => arch.buildArchPlan({ shape: 'semi-circle', width: 1200, height: 2000 }, { ...P, arch: undefined }), /has no "arch" section/);

// ═══════════════════════════════════════════════════════════════════════════
section('no fitting board — planner never throws, exporter explains');
{
  const g = arch.buildArchGeometry({ shape: 'semi-circle', width: 1500, height: 2400 }, P);
  const narrow = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: [50, 63, 75] }, P.cnc);
  check(`semi-circle 1500 with boards ≤ 75: a ${tF} face + 2 × ${A} allowance (${tF + 2 * A}) never fits — noStock "no stock board fits", no pieces, no throw`, narrow.noStock && narrow.noStockReason === 'no stock board fits' && narrow.arcs[0].default === null && narrow.arcs[0].options.every((o) => o.stock === null) && narrow.pieces.length === 0);
  const at95 = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: [50, 63, 75, 95] }, P.cnc);
  const i95 = independentPlan(g.frameHead, { ...IND, stock: [50, 63, 75, 95] });
  check(`semi-circle 1500 with boards ≤ 95: a 95 board fits at ${i95[0].blocked?.n} pieces but they fall below 450 / 400 → noStock "below minimum length" (v4: the limits, not the board, block it)`, at95.noStock && at95.noStockReason === 'below minimum length' && at95.arcs[0].blocked?.n === i95[0].blocked?.n && at95.arcs[0].blocked.stock === 95);
  const empty = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: [] }, P.cnc);
  check('empty stock list → noStock, no throw', empty.noStock && empty.pieces.length === 0);
  const junk = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: ['x', -5, 0, 200] }, P.cnc);
  check('junk stock entries ignored, 200 still picked (3 pieces × 200, no narrower alternative)', !junk.noStock && junk.arcs[0].default.stock === 200 && junk.arcs[0].default.n === 3 && junk.arcs[0].alternative === null);
  expectThrows('buildArchEntities on a no-stock plan → readable', () => archDxf.buildArchEntities(arch.buildArchPlan({ shape: 'semi-circle', width: 1500, height: 2400 }, { ...P, arch: { ...P.arch, stockWidths: [50] } }), 'X'), /No stock board fits/);
  // exporter path on real windowSpec data
  const spec = specification.normaliseToWindowSpec({ width: 1500, height: 2400, name: 'Edge' }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', casementType: 'arched', casArchShape: 'semi-circle' } });
  const r = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [50, 63, 75] } }, () => cncExport.archParamsForWindow(spec, 'Edge'));
  check('archParamsForWindow: no-stock skip names both members, the needed width and the widest board (v4 wording)', /^no valid blank plan \(no stock board fits\): frame head chain: no stock board fits \(needs \d+\+ for \d+ pieces, widest 75\); leaf top chain: no stock board fits \(needs \d+\+ for \d+ pieces, widest 75\)$/.test(r.skip || ''), r.skip);
  const r95 = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [63, 75, 95] } }, () => cncExport.archParamsForWindow(spec, 'Edge'));
  check('archParamsForWindow: a blocked plan skips with "below minimum length" and the failing piece named', /^no valid blank plan \(below minimum length\): frame head chain: \d+ pieces fit a 95 board but fall below the minimum length \(piece \d+ of \d+: (overall|shorter edge) [\d.]+ < \d+/.test(r95.skip || ''), r95.skip);
  const wideStock = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [300] } }, () => cncExport.archParamsForWindow(spec, 'Edge'));
  const i300 = independentPlan(g.frameHead, { ...IND, stock: [300] })[0];
  check(`only a 300 mm board: the head is ${i300.def?.n === 2 ? 'TWO' : i300.def?.n} pieces on 300 (independent W_req ${i300.fewest?.wReq.toFixed(1)}; 57 frame: 277 — v4: the board cap is the widest list entry, N starts at 1)`, i300.def?.n === 2 && !wideStock.skip && wideStock.params.plan.plans.frameHead.pieces.length === i300.def.n && wideStock.params.plan.plans.frameHead.pieces.every((pc) => pc.stock === 300) && near(wideStock.params.plan.plans.frameHead.arcs[0].fewest.wReq, i300.fewest.wReq, 0.5), wideStock.skip);
}

// ═══════════════════════════════════════════════════════════════════════════
section('exporter skip messages on the windowSpec path (W 400 / 1500, bad heights, F1)');
{
  const mk = (fc, item) => specification.normaliseToWindowSpec({ name: 'E', ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
  const r1 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch' }, { width: 400, height: 1200 }), 'E');
  check('W 400 PSW segmental-arch → three-centre rise 80 (F2) → skip "rise 80mm must exceed the haunch radius 150mm"', /rise 80mm must exceed the haunch radius 150mm/.test(r1.skip || ''), r1.skip);
  const r2 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'elliptical-arch' }, { width: 400, height: 1200 }), 'E');
  check('W 400 elliptical → three-centre rise 130 (F2) → skip "rise 130mm must exceed the haunch radius 150mm"', /rise 130mm must exceed the haunch radius 150mm/.test(r2.skip || ''), r2.skip);
  const r2b = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'elliptical-arch' }, { width: 470, height: 1200 }), 'E');
  // the verdict follows the independent planner on the 68-frame rings: the head plans, the leaf top (one whole chain on
  // one board) is blocked by the 450 clamp limit — W 470 rise 152.75: leaf ring 99 / 32 haunches, one 388-long piece on 120
  // (57 frame: 410 long on 150); the exporter names the leaf chain only, the number ±0.5 of the independent one
  const g470 = arch.buildArchGeometry({ shape: 'three-centre', width: 470, height: 1200, rise: 0.325 * 470 }, P);
  const i470h = indPlan(g470.frameHead)[0], i470l = indPlan(g470.leafTop)[0];
  const b470 = i470l.blocked;
  const n470 = Number((r2b.skip || '').match(/overall ([\d.]+) < 450/)?.[1]);
  check(`W 470 elliptical → rise 152.75 > 150 → the geometry clears the haunch minimum (Auto from W 462); v4: the head plans (${i470h.def?.n} × ${i470h.def?.stock}), the plan is blocked by the 450 clamp limit (leaf top ONE piece ${b470 ? b470.pieces[0].overall.toFixed(1) : '?'} long on a ${b470?.stock} board — independent; 57 frame: 410 on 150) — skipped readably, not F2`,
    !!g470 && !!i470h.def && !i470l.def && i470l.reason === 'below minimum length' && b470?.n === 1
    && new RegExp(`^no valid blank plan \\(below minimum length\\): leaf top chain: 1 piece fit a ${b470?.stock} board but fall below the minimum length \\(piece 1 of 1: overall [\\d.]+ < 450`).test(r2b.skip || '') && near(n470, b470?.pieces[0].overall, 0.5), r2b.skip);
  const r3 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2400 }), 'E');
  const i3 = r3.params ? indPlan(r3.params.plan.frameHead) : null;
  check(`W 1500 gothic H 2400 (rise 1299 + 900 = 2199) → exports, ${i3 ? i3.map((x) => x.def.n).join(' + ') : '?'} pieces per side (independent planner)`, !r3.skip && i3.length === 2 && r3.params.plan.plans.frameHead.totalPieces === i3[0].def.n + i3[1].def.n && planMatches(r3.params.plan.plans.frameHead, r3.params.plan.frameHead), r3.skip);
  const r4 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2100 }), 'E');
  check('W 1500 gothic H 2100 → skip by the 900 rule (801 straight)', /leaves 801mm straight below the arch — minimum 900mm/.test(r4.skip || ''), r4.skip);
  const r5 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 1501, height: 2500 }), 'E');
  check('W 1501 → skip "above the maximum 1500mm"', /above the maximum 1500mm/.test(r5.skip || ''), r5.skip);
  expectThrows('custom rise 700 (archStart 1800) on a Round 1200 → normaliseToWindowSpec throws "use Gothic" (rule P2, never a silent shape)', () => mk({ casementType: 'arched', casArchShape: 'segmental-arch', archStart: 1800 }, { width: 1200, height: 2500 }), /rise 700mm is above half the width \(600mm\): use Gothic/);
  const r7a = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archStart: 2383 }, { width: 1200, height: 2500 }), 'E');
  check('custom rise 117 (start 2383) → skip "rise 117mm must exceed the haunch radius 150mm" (F2 replaces F1)', /rise 117mm must exceed the haunch radius 150mm/.test(r7a.skip || ''), r7a.skip);
  const r7 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archStart: 2349 }, { width: 1200, height: 2500 }), 'E');
  const g7 = arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2500, rise: 151 }, P);
  const i7 = indPlan(g7.frameHead), i7l = indPlan(g7.leafTop);
  check(`custom rise 151 (start 2349): ONE chain per ring (haunch 89.7° + crown 0.5° + haunch in compound pieces) — head ${i7[0].def ? `${i7[0].def.n} × ${i7[0].def.stock}` : 'blocked'}, leaf ${i7l[0].def ? `${i7l[0].def.n} × ${i7l[0].def.stock}` : 'blocked'} (independent); exporter agrees`,
    (i7[0].def && i7l[0].def) ? (!r7.skip && r7.params.plan.plans.frameHead.arcs.length === 1 && planMatches(r7.params.plan.plans.frameHead, r7.params.plan.frameHead) && planMatches(r7.params.plan.plans.leafTop, r7.params.plan.leafTop)) : /below minimum length/.test(r7.skip || ''),
    r7.skip || JSON.stringify(r7.params?.plan.plans.frameHead.arcs.map((a) => [a.kind, a.default?.n, a.default?.stock])));
  const r8 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch' }, { width: 1200, height: 'x' }), 'E');
  check('non-numeric height → readable skip (NaN straight part fails the 900 rule)', /straight below the arch/.test(r8.skip || ''), r8.skip);
}

// ═══════════════════════════════════════════════════════════════════════════
section('merged export with mixed edge windows — good ones exported, bad ones listed');
{
  let clicks = 0, lastBlob = null;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ set href(v) {}, set download(v) {}, click() { clicks++; }, remove() {} }) };
  const oc = URL.createObjectURL, orv = URL.revokeObjectURL;
  URL.createObjectURL = (b) => { lastBlob = b; return 'blob:x'; };
  URL.revokeObjectURL = () => {};
  const mk = (fc, item) => specification.normaliseToWindowSpec({ name: 'E', ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
  const windows = [
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 400, height: 1200 }), name: 'W400 semi' },
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'segmental-arch' }, { width: 400, height: 1200 }), name: 'W400 seg (F2)' },
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2400 }), name: 'W1500 gothic' },
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 1501, height: 2500 }), name: 'W1501' },
  ];
  const r = cncExport.exportArchDxfMerged(windows, 'Edges');
  check('merged: 1 exported (W1500 gothic), 3 skipped with their reasons — W400 semi by the v4 length limits, W400 seg by F2, W1501 by the width', r.ok && r.exported === 1 && r.skipped.length === 3
    && r.skipped.some((s) => s.name === 'W400 semi' && /no valid blank plan \(below minimum length\)/.test(s.reason)) && r.skipped.some((s) => /must exceed the haunch radius/.test(s.reason)) && r.skipped.some((s) => /above the maximum/.test(s.reason)), JSON.stringify(r));
  const text = await lastBlob.text();
  const path = resolve(AUDIT, 'edges_merged.dxf');
  writeFileSync(path, text);
  const probe = JSON.parse(execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' }));
  check('merged edge DXF: 2 CONTOUR rings (head + leaf of the gothic), its label, no W400 label', probe.polys.filter((p) => p.layer === 'CONTOUR').length === 2 && probe.texts.some((t) => t.text === 'W1500 gothic - FRAME HEAD') && !probe.texts.some((t) => t.text === 'W400 semi - FRAME HEAD'));
  URL.createObjectURL = oc; URL.revokeObjectURL = orv; delete globalThis.document;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
