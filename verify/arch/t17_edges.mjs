/**
 * t17 — arched-casement-v1 edge-case harness (Stage 2b of the 06.09 audit).
 *
 * Everything t16 proves on the spec's W = 1200 vectors is exercised here at
 * the limits: W 400 / 1500 for every shape, rises just inside / outside every
 * rule, the height rules, no fitting board, the widest board, the exporter's
 * skip messages on the real windowSpec path. Every failure must be a readable
 * ArchError — never a NaN, never a silent rectangle.
 *
 * Findings this file documents (BLOCKERS.md §8):
 *   F1  the deepest ring (leaf inner = leafAtJamb + leafTop.face = 107) plus
 *       the contour allowance (10) must sit above the arch-start line, so a
 *       segmental rise ≤ 117 mm and a three-centre haunch radius ≤ 117 mm are
 *       impossible whatever the width (geometry alone allows > 107, the
 *       planner's allowance band needs > 117). At W 400 the PSW default rises
 *       (segmental 80, three-centre 130 → r 84.5) are therefore REJECTED with
 *       a readable message; segmental needs ≥ 0.30 × W there, three-centre
 *       rise > sqrt(117 × 200) = 153.
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
const SHAPES = ['segmental', 'semi-circle', 'gothic-equilateral', 'gothic-drop', 'three-centre'];
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
    'segmental': /does not reach the arch-start line/,          // F1: rise 80 < 107
    'semi-circle': null,
    'gothic-equilateral': null,
    'gothic-drop': null,
    'three-centre': /Offset 107mm exceeds the arc radius 84.5mm/, // F1: r = 130²/200 = 84.5
  },
  1500: { 'segmental': null, 'semi-circle': null, 'gothic-equilateral': null, 'gothic-drop': null, 'three-centre': null },
};
for (const Wd of [400, 1500]) {
  for (const s of SHAPES) {
    const exp = EDGE_EXPECT[Wd][s];
    const rise = arch.ARCH_RISE_RATIO[s] * Wd;
    const H = Math.ceil(rise + P.arch.limits.minStraightBelowRise + 100);
    if (exp) {
      expectThrows(`W ${Wd} ${s} (default rise ${rise.toFixed(1)}): rejected readably (F1)`, () => arch.buildArchPlan({ shape: s, width: Wd, height: H, rise: null, hinge: 'left' }, P), exp);
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
// F1 boundary: the smallest segmental rise that holds the leaf ring is just above 107
expectThrows('segmental rise 107 at W 1200 → leaf inner contour does not reach the arch-start line', () => arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 2500, rise: 107 }, P), /does not reach the arch-start line/);
check('segmental rise 108 at W 1200 builds (R 1720.7)', near(arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 2500, rise: 108 }, P).arcs[0].r, 1720.7, 0.1));
check(`deepest ring offset read from the profile = ${deepest} (leafAtJamb + leafTop.face)`, deepest === 107);
check('W 400 segmental with rise 120 (0.30 × W) builds', (() => { try { return planSane(arch.buildArchPlan({ shape: 'segmental', width: 400, height: 1100, rise: 120, hinge: 'left' }, P)); } catch { return false; } })());
check('W 400 three-centre with rise 160 (r 128 > 117) builds', (() => { try { return planSane(arch.buildArchPlan({ shape: 'three-centre', width: 400, height: 1100, rise: 160, hinge: 'left' }, P)); } catch (e) { console.log('        ' + e.message); return false; } })());
check('W 400 three-centre with rise 150 (r 112.5): geometry builds (> 107) …', arch.buildArchGeometry({ shape: 'three-centre', width: 400, height: 1100, rise: 150 }, P).arcs.length === 3);
expectThrows('… but the leaf allowance band does not (112.5 − 107 − 10 < 0) — readable, names the ring', () => arch.buildArchPlan({ shape: 'three-centre', width: 400, height: 1100, rise: 150, hinge: 'left' }, P), /LEAF TOP allowance band \(10mm per side\): Offset 10mm exceeds the arc radius 5.5mm/);
expectThrows('W 400 three-centre with rise 146 (r 106.6 < 107) rejected by the geometry', () => arch.buildArchGeometry({ shape: 'three-centre', width: 400, height: 1100, rise: 146 }, P), /Offset 107mm exceeds the arc radius 106.6mm/);

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
check('segmental rise 599.9 (< W/2) builds', near(arch.archArcs('segmental', 1200, 599.9)[0].r, 600, 0.1));
expectThrows('segmental rise 600 (= W/2) rejected', () => arch.archArcs('segmental', 1200, 600), /must be below half the width/);
expectThrows('segmental rise 900 rejected', () => arch.resolveArchRise('segmental', 1200, 900, P.arch.limits), /must be below half the width/);
check('gothic-drop rise 600 (= W/2, c = 0) builds', arch.archArcs('gothic-drop', 1200, 600).length === 2);
expectThrows('gothic-drop rise 599.9 rejected', () => arch.archArcs('gothic-drop', 1200, 599.9), /must be at least half the width/);
check('gothic-drop rise 1500 (1.25 × W) builds — no upper physics limit, only H ≥ rise + 900', arch.archArcs('gothic-drop', 1200, 1500)[0].r > 0);
expectThrows('gothic-drop rise 1500 in H 2399 rejected by the height rule', () => arch.buildArchGeometry({ shape: 'gothic-drop', width: 1200, height: 2399, rise: 1500 }, P), /leaves 899mm straight below the arch/);
check('three-centre rise 599 (< W/2) builds', arch.archArcs('three-centre', 1200, 599).length === 3);
expectThrows('three-centre rise 600 rejected', () => arch.archArcs('three-centre', 1200, 600), /must be below half the width/);
expectThrows('semi-circle rise 599 rejected (fixed shape)', () => arch.resolveArchRise('semi-circle', 1200, 599, P.arch.limits), /fixed by the shape at 600mm/);
check('semi-circle rise 600.4 accepted as the fixed 600 (±0.5 tolerance)', arch.resolveArchRise('semi-circle', 1200, 600.4, P.arch.limits) === 600);
expectThrows('gothic-equilateral rise 1000 rejected (fixed shape 1039.2)', () => arch.resolveArchRise('gothic-equilateral', 1200, 1000, P.arch.limits), /fixed by the shape at 1039.2mm/);
expectThrows('negative rise rejected', () => arch.resolveArchRise('segmental', 1200, -5, P.arch.limits), /must be a positive number/);
expectThrows('rise "abc" rejected', () => arch.resolveArchRise('segmental', 1200, 'abc', P.arch.limits), /must be a positive number/);
check('rise "" → default (240)', arch.resolveArchRise('segmental', 1200, '', P.arch.limits) === 240);
check('rise "300" (string) → 300', arch.resolveArchRise('segmental', 1200, '300', P.arch.limits) === 300);

// ═══════════════════════════════════════════════════════════════════════════
section('height rules — H ≥ rise + 900 and the leaf straight stile');
expectThrows('H = rise + 899 rejected', () => arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 1139, rise: 240 }, P), /leaves 899mm straight below the arch — minimum 900mm/);
check('H = rise + 900 builds (straight 900, stile 853)', (() => { const g = arch.buildArchGeometry({ shape: 'segmental', width: 1200, height: 1140, rise: 240 }, P); return g.straightHeight === 900 && g.leafStraightStile === 853; })());
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
  check('W 400 segmental (F1) → skip "does not reach the arch-start line"', /does not reach the arch-start line/.test(r1.skip || ''), r1.skip);
  const r2 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'elliptical-arch' }, { width: 400, height: 1200 }), 'E');
  check('W 400 elliptical → three-centre r 84.5 (F1) → skip "Offset 107mm exceeds the arc radius 84.5mm"', /Offset 107mm exceeds the arc radius 84.5mm/.test(r2.skip || ''), r2.skip);
  const r3 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2400 }), 'E');
  check('W 1500 gothic H 2400 (rise 1299 + 900 = 2199) → exports, 4 + 4 pieces', !r3.skip && r3.params.plan.plans.frameHead.totalPieces === 8, r3.skip);
  const r4 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2100 }), 'E');
  check('W 1500 gothic H 2100 → skip by the 900 rule (801 straight)', /leaves 801mm straight below the arch — minimum 900mm/.test(r4.skip || ''), r4.skip);
  const r5 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 1501, height: 2500 }), 'E');
  check('W 1501 → skip "above the maximum 1500mm"', /above the maximum 1500mm/.test(r5.skip || ''), r5.skip);
  const r6 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archRise: 700 }, { width: 1200, height: 2500 }), 'E');
  check('custom rise 700 on a segmental 1200 → skip "must be below half the width"', /must be below half the width \(600mm\)/.test(r6.skip || ''), r6.skip);
  const r7a = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archRise: 117 }, { width: 1200, height: 2500 }), 'E');
  check('custom rise 117 (= ring depth 107 + allowance 10) → skip names the LEAF TOP band (F1)', /LEAF TOP allowance band \(10mm per side\): Contour of radius \d+(\.\d)?mm does not reach the arch-start line/.test(r7a.skip || ''), r7a.skip);
  const r7 = cncExport.archParamsForWindow(mk({ casementType: 'arched', casArchShape: 'segmental-arch', archRise: 118 }, { width: 1200, height: 2500 }), 'E');
  check('custom rise 118 (just above 117) → exports; θ 44.5° → N_min 2, narrowest rule picks 3 × 95 (N 2 needs 180)', !r7.skip && r7.params.plan.plans.frameHead.arcs[0].nMin === 2 && r7.params.plan.plans.frameHead.totalPieces === 3 && r7.params.plan.plans.frameHead.pieces[0].stock === 95 && r7.params.plan.plans.frameHead.arcs[0].spanDeg < 45, r7.skip);
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
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'segmental-arch' }, { width: 400, height: 1200 }), name: 'W400 seg (F1)' },
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'gothic-arch' }, { width: 1500, height: 2400 }), name: 'W1500 gothic' },
    { windowSpec: mk({ casementType: 'arched', casArchShape: 'semi-circle' }, { width: 1501, height: 2500 }), name: 'W1501' },
  ];
  const r = cncExport.exportArchDxfMerged(windows, 'Edges');
  check('merged: 2 exported (W400 semi, W1500 gothic), 2 skipped with their reasons', r.ok && r.exported === 2 && r.skipped.length === 2 && r.skipped.every((s) => /does not reach|above the maximum/.test(s.reason)), JSON.stringify(r));
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
