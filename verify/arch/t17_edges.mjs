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
 *   F1 (v1) the deepest ring (leaf inner = leafAtJamb + leafTop.face = 107) plus
 *       the contour allowance (10) had to sit above the arch-start line, so a
 *       three-centre haunch radius ≤ 117 mm was impossible.
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
const deepest = P.deductions.leafAtJamb + P.elements.leafTop.face;     // 107
const finite = (v) => Number.isFinite(v);
function planSane(plan) {
  const rings = [plan.frameHead, plan.leafTop];
  const arcsOk = rings.every((r) => [...r.outer, ...r.inner].every((a) => finite(a.r) && a.r > 0 && finite(a.a0) && finite(a.a1) && a.a1 > a.a0));
  const piecesOk = [plan.plans.frameHead, plan.plans.leafTop].every((pl) => pl.pieces.length >= 2 && pl.pieces.every((pc) =>
    finite(pc.wReq) && pc.wReq > 0 && finite(pc.L) && pc.L > 0 && finite(pc.roughLength) && pc.roughLength >= pc.L && pc.stock >= pc.wReq - 1e-9
    && pc.phiDeg <= P.arch.maxSegmentAngleDeg + 1e-9));
  return arcsOk && piecesOk && !plan.noStock;
}

// ═══════════════════════════════════════════════════════════════════════════
section('W 400 / W 1500 — every shape at the PSW default rise, H = rise + 900 + margin');
const EDGE_EXPECT = {
  400: {
    'semi-circle': null,
    'gothic-equilateral': null,
    'gothic-drop': null,
    'three-centre': /rise 130mm must exceed the haunch radius 150mm/,   // F2: 0.325 × 400 = 130 ≤ minHaunchRadius
  },
  1500: { 'semi-circle': null, 'gothic-equilateral': null, 'gothic-drop': null, 'three-centre': null },
};
for (const Wd of [400, 1500]) {
  for (const s of SHAPES) {
    const exp = EDGE_EXPECT[Wd][s];
    const rise = arch.ARCH_RISE_RATIO[s] * Wd;
    const H = Math.ceil(rise + P.arch.limits.minStraightBelowRise + 100);
    if (exp) {
      expectThrows(`W ${Wd} ${s} (default rise ${rise.toFixed(1)}): rejected readably (F2)`, () => arch.buildArchPlan({ shape: s, width: Wd, height: H, rise: null, hinge: 'left' }, P), exp);
      continue;
    }
    let plan = null, err = null;
    try { plan = arch.buildArchPlan({ shape: s, width: Wd, height: H, rise: null, hinge: 'left' }, P); } catch (e) { err = e; }
    check(`W ${Wd} ${s} (rise ${rise.toFixed(1)}): plan builds, every arc ≥ 2 pieces ≤ 36°, boards fit, no NaN`, !err && plan && planSane(plan), err ? err.message : '');
    if (!plan) continue;
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
check(`deepest ring offset read from the profile = ${deepest} (leafAtJamb + leafTop.face) — below minHaunchRadius 150 by ${P.arch.minHaunchRadius - deepest}`, deepest === 107 && P.arch.minHaunchRadius - deepest === 43);
expectThrows('three-centre rise 150 at W 1200 → equals the haunch minimum, no crown arc — readable', () => arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2500, rise: 150 }, P), /rise 150mm must exceed the haunch radius 150mm/);
check('three-centre rise 151 at W 1200 builds (r 150, crown R 101400.5, haunch spans 89.7°) and plans', (() => {
  const g = arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 2500, rise: 151 }, P);
  return near(g.arcs[0].r, 150, 1e-9) && near(g.arcs[1].r, 101400.5, 0.01) && planSane(arch.buildArchPlan({ shape: 'three-centre', width: 1200, height: 2500, rise: 151, hinge: 'left' }, P));
})());
check('W 400 three-centre with rise 160 builds (r clamps to 150, crown R 280) — v1 gave r 128', (() => { try { const pl = arch.buildArchPlan({ shape: 'three-centre', width: 400, height: 1100, rise: 160, hinge: 'left' }, P); return planSane(pl) && near(pl.arcs[0].r, 150, 1e-9) && near(pl.arcs[1].r, 280, 1e-9); } catch (e) { console.log('        ' + e.message); return false; } })());
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
check('H = rise + 900 builds (straight 900, stile 853)', (() => { const g = arch.buildArchGeometry({ shape: 'three-centre', width: 1200, height: 1140, rise: 240 }, P); return g.straightHeight === 900 && g.leafStraightStile === 853; })());
expectThrows('H below the rise rejected with the same rule (negative straight part)', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 500 }, P), /leaves -100mm straight below the arch/);
check('no height → no height rule (pure geometry callers)', arch.buildArchGeometry({ shape: 'semi-circle', width: 1200 }, P).straightHeight === null);
expectThrows('missing arch.limits in the profile → readable', () => arch.buildArchGeometry({ shape: 'semi-circle', width: 1200, height: 2000 }, { ...P, arch: { ...P.arch, limits: undefined } }), /arch\.limits is missing/);
expectThrows('missing arch block in the profile → readable (buildArchPlan)', () => arch.buildArchPlan({ shape: 'semi-circle', width: 1200, height: 2000 }, { ...P, arch: undefined }), /has no "arch" section/);

// ═══════════════════════════════════════════════════════════════════════════
section('no fitting board — planner never throws, exporter explains');
{
  const g = arch.buildArchGeometry({ shape: 'semi-circle', width: 1500, height: 2400 }, P);
  const narrow = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: [50, 63, 75] });
  check('semi-circle 1500 with boards ≤ 75: every candidate infeasible, noStock, no pieces, no throw', narrow.noStock && narrow.arcs[0].default === null && narrow.arcs[0].options.every((o) => o.stock === null) && narrow.pieces.length === 0);
  const okAt95 = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: [50, 63, 75, 95] });
  check('semi-circle 1500 with boards ≤ 95: N 7 fits (W_req 94.1), N 5–6 do not', okAt95.arcs[0].default?.n === 7 && okAt95.arcs[0].options.slice(0, 2).every((o) => o.stock === null));
  const empty = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: [] });
  check('empty stock list → noStock, no throw', empty.noStock && empty.pieces.length === 0);
  const junk = arch.planArchSegments(g.frameHead, { ...P.arch, stockWidths: ['x', -5, 0, 200] });
  check('junk stock entries ignored, 200 still picked', !junk.noStock && junk.arcs[0].default.stock === 200);
  expectThrows('buildArchEntities on a no-stock plan → readable', () => archDxf.buildArchEntities(arch.buildArchPlan({ shape: 'semi-circle', width: 1500, height: 2400 }, { ...P, arch: { ...P.arch, stockWidths: [50] } }), 'X'), /No stock board fits/);
  // exporter path on real windowSpec data
  const spec = specification.normaliseToWindowSpec({ width: 1500, height: 2400, name: 'Edge' }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', casementType: 'arched', casArchShape: 'semi-circle' } });
  const r = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [50, 63, 75] } }, () => cncExport.archParamsForWindow(spec, 'Edge'));
  check('archParamsForWindow: no-stock skip names both members and the widest board', /no stock board fits \(widest 75mm\): frame head arc 1 needs a board >= \d+mm; leaf top arc 1 needs a board >= \d+mm/.test(r.skip || ''), r.skip);
  const wideStock = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [300] } }, () => cncExport.archParamsForWindow(spec, 'Edge'));
  check('only a 300 mm board: every piece on 300 (N_min still 5 — the angle rule, not the board, sets N)', !wideStock.skip && wideStock.params.plan.plans.frameHead.pieces.length === 5 && wideStock.params.plan.plans.frameHead.pieces.every((pc) => pc.stock === 300));
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
  check('W 470 elliptical → rise 152.75 > 150 → exports (Auto clears the haunch minimum from W 462)', !r2b.skip, r2b.skip);
  const r3 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2400 }), 'E');
  check('W 1500 gothic H 2400 (rise 1299 + 900 = 2199) → exports, 4 + 4 pieces', !r3.skip && r3.params.plan.plans.frameHead.totalPieces === 8, r3.skip);
  const r4 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2100 }), 'E');
  check('W 1500 gothic H 2100 → skip by the 900 rule (801 straight)', /leaves 801mm straight below the arch — minimum 900mm/.test(r4.skip || ''), r4.skip);
  const r5 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 1501, height: 2500 }), 'E');
  check('W 1501 → skip "above the maximum 1500mm"', /above the maximum 1500mm/.test(r5.skip || ''), r5.skip);
  expectThrows('custom rise 700 (archStart 1800) on a Round 1200 → normaliseToWindowSpec throws "use Gothic" (rule P2, never a silent shape)', () => mk({ casementType: 'arched', casArchShape: 'segmental-arch', archStart: 1800 }, { width: 1200, height: 2500 }), /rise 700mm is above half the width \(600mm\): use Gothic/);
  const r7a = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archStart: 2383 }, { width: 1200, height: 2500 }), 'E');
  check('custom rise 117 (start 2383) → skip "rise 117mm must exceed the haunch radius 150mm" (F2 replaces F1)', /rise 117mm must exceed the haunch radius 150mm/.test(r7a.skip || ''), r7a.skip);
  const r7 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archStart: 2349 }, { width: 1200, height: 2500 }), 'E');
  check('custom rise 151 (start 2349) → exports; haunch 89.7° → 3 pieces each side, crown 0.5° → 2 (angle rule), all on 95', !r7.skip && r7.params.plan.plans.frameHead.arcs[0].nMin === 3 && r7.params.plan.plans.frameHead.arcs[1].nMin === 2 && r7.params.plan.plans.frameHead.totalPieces === 8 && r7.params.plan.plans.frameHead.pieces.every((pc) => pc.stock === 95), r7.skip || JSON.stringify(r7.params?.plan.plans.frameHead.arcs.map((a) => [a.nMin, a.default?.n, a.default?.stock])));
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
  check('merged: 2 exported (W400 semi, W1500 gothic), 2 skipped with their reasons', r.ok && r.exported === 2 && r.skipped.length === 2 && r.skipped.every((s) => /must exceed the haunch radius|above the maximum/.test(s.reason)), JSON.stringify(r));
  const text = await lastBlob.text();
  const path = resolve(AUDIT, 'edges_merged.dxf');
  writeFileSync(path, text);
  const probe = JSON.parse(execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' }));
  check('merged edge DXF: 4 CONTOUR rings, both labels', probe.polys.filter((p) => p.layer === 'CONTOUR').length === 4 && probe.texts.some((t) => t.text === 'W400 semi - FRAME HEAD') && probe.texts.some((t) => t.text === 'W1500 gothic - FRAME HEAD'));
  URL.createObjectURL = oc; URL.revokeObjectURL = orv; delete globalThis.document;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
