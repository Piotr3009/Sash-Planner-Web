/**
 * t18 — arched-casement-v2 night-3 harness (spec docs/handover/ARCHED-CASEMENT-v2.md §3).
 *
 * Bundles the engine + export modules into .audit/ with esbuild and asserts on
 * the REAL data path: normaliseToWindowSpec (PC item with archStart / PSW
 * fullConfig) → deriveWindowData → lists → glazier DXF → ezdxf → glass PDF.
 * The EXPECTED numbers are the spec §3 vectors (profile faces 57 / 67,
 * leafAtJamb 40, glassInset 12.5, minHaunchRadius 150) — reproduced here, not
 * derived from the code; closed forms and numeric integrals cross-check what
 * the spec does not list (areas, bar tops, tracery ends).
 *
 * Sections: 1 geometry vectors · 2 bars · 3 cut list + engine (fixture) ·
 * 4 glazier DXF (samples) · 5 PSW import + migration · 6 glass PDF ·
 * 7 profile / vocabulary · 8 structural evidence (store whitelist, configurator).
 *
 * Run: node verify/arch/t18.mjs   (writes docs/handover/samples/sample_glass_*.dxf)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(SAMPLES, { recursive: true });

// ── bundle ──────────────────────────────────────────────────────────────────
const ENTRY = resolve(AUDIT, 't18-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as calculations from '../src/engine/calculations.js';",
  "export * as lists from '../src/engine/lists.js';",
  "export * as bom from '../src/engine/bom.js';",
  "export * as dxfWriter from '../src/engine/cnc/dxfWriter.js';",
  "export * as glassDxf from '../src/utils/glassDxfExport.js';",
  "export * as glassPdf from '../src/utils/glassPdfExport.js';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 't18-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--jsx=automatic', '--external:react', '--external:react/jsx-runtime', '--external:jspdf',
  `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href);
const { arch, profile, specification, calculations, lists, bom, dxfWriter, glassDxf, glassPdf } = M;
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
function probe(path) {
  const out = execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out);
}

// profile numbers the vectors assume
const tF = P.elements.frameHead.face, oL = P.deductions.leafAtJamb, tL = P.elements.leafTop.face, gI = P.geometry.glassInset;
const cillSide = P.deductions.leafFullHeight - P.deductions.leafAtJamb;          // 47
const glassBottom = cillSide + (P.elements.leafBottom.face - gI);                // 101.5
const glassOff = oL + tL - gI;                                                   // 94.5
check('profile numbers behind the §3 vectors: faces 57 / 67, leafAtJamb 40, glassInset 12.5, minHaunchRadius 150',
  tF === 57 && tL === 67 && oL === 40 && gI === 12.5 && P.arch.minHaunchRadius === 150);
check('derived constants: glass bottom edge 101.5 from the frame bottom, glass offset 94.5 from the frame outer', glassBottom === 101.5 && glassOff === 94.5);

// PC item → windowSpec → derived, the way the app does it (window saved by the configurator)
const pcItem = (id, width, height, fields) => specification.normaliseToWindowSpec(
  { id, name: id, width, height, windowCategory: 'casement', casementType: 'arched', ...fields });
const derive = (spec) => calculations.deriveWindowData(spec, {});

// ═══════════════════════════════════════════════════════════════════════════
section('1 — geometry vectors (spec v2 §3), real path: archStart → rise → shape → derived.arch.geometry');
const V = [
  { id: 'V1', W: 1000, H: 1500, start: 1300, exp: { shape: 'three-centre', rise: 200, r: 150, R: 1400.00, csX: 350, clY: -1200, T: [392.00, 144.00], haunchDeg: 73.74, crownDeg: 32.52, lens: [193.05, 794.62, 193.05], total: 1180.72,
    rings: { headInner: [93, 1343, 93], leafOuter: [110, 1360, 110], leafInner: [43, 1293, 43], glass: [55.5, 1305.5, 55.5] } } },
  { id: 'V2', W: 1000, H: 1500, start: 1175, exp: { shape: 'three-centre', rise: 325, r: 211.25, R: 634.62, T: [432.83, 154.49], haunchDeg: 47.00, crownDeg: 86.01, total: 1299.17 } },
  { id: 'V3', W: 1500, H: 2000, start: 1700, exp: { shape: 'three-centre', rise: 300, r: 150, R: 1425.00, haunchDeg: 61.93, crownDeg: 56.14, total: 1720.63 } },
  { id: 'V4', W: 1000, H: 1500, start: 1100, exp: { shape: 'three-centre', rise: 400, r: 320, R: 562.50, haunchDeg: 42.08, crownDeg: 95.85, total: 1410.99 } },
  { id: 'V5', W: 1000, H: 1500, start: 1000, exp: { shape: 'semi-circle', rise: 500, R: 500, arcs: 1, total: 1570.80 } },
];
const D = {};
for (const v of V) {
  const spec = pcItem(v.id, v.W, v.H, { archShape: 'three-centre', archStart: v.start, archRiseSource: 'custom', archHinge: 'left' });
  const d = derive(spec);
  D[v.id] = { spec, d };
  const g = d.arch?.geometry;
  const E = v.exp;
  const tag = `${v.id} Round W${v.W} H${v.H} start ${v.start}`;
  check(`${tag}: windowSpec.arch → shape ${E.shape}, rise ${E.rise}, start ${v.start}`, spec.arch.shape === E.shape && near(spec.arch.rise, E.rise, 1e-9) && spec.arch.start === v.start, JSON.stringify(spec.arch));
  check(`${tag}: derived.arch present, geometry shape ${E.shape}`, !!g && g.shape === E.shape);
  if (!g) continue;
  if (E.shape === 'three-centre') {
    const [s0, big, s1] = g.arcs;
    expectNear(`${tag}: haunch r ${E.r}`, s0.r, E.r, 0.01);
    expectNear(`${tag}: crown R ${E.R}`, big.r, E.R, 0.01);
    if (E.csX != null) check(`${tag}: haunch centres x ±${E.csX} on the arch-start line`, near(s0.cx, E.csX, 0.01) && near(s1.cx, -E.csX, 0.01) && near(s0.cy, 0, 1e-12) && near(s1.cy, 0, 1e-12));
    if (E.clY != null) expectNear(`${tag}: crown centre y ${E.clY}`, big.cy, E.clY, 0.01);
    if (E.T) { const T = arch.arcPoint(s0, s0.a1); check(`${tag}: tangent point T (${E.T[0]}, ${E.T[1]})`, near(T[0], E.T[0], 0.01) && near(T[1], E.T[1], 0.01), `${T.map((c) => c.toFixed(2))}`); }
    expectNear(`${tag}: haunch span ${E.haunchDeg}°`, arch.arcSpan(s0) * DEG, E.haunchDeg, 0.01);
    expectNear(`${tag}: crown span ${E.crownDeg}°`, arch.arcSpan(big) * DEG, E.crownDeg, 0.01);
    if (E.lens) check(`${tag}: arc lengths ${E.lens.join(' + ')}`, g.arcs.every((a, i) => near(arch.arcLen(a), E.lens[i], 0.01)), g.arcs.map((a) => arch.arcLen(a).toFixed(2)).join(' + '));
    expectNear(`${tag}: total outer length ${E.total}`, arch.arcsLength(g.arcs), E.total, 0.01);
    check(`${tag}: rule C — the outer chain starts and ends vertical at the jambs (angles 0 / π, centres on the line)`, near(s0.a0, 0, 1e-12) && near(s1.a1, Math.PI, 1e-12));
    if (E.rings) {
      const same = (arcs, exp) => arcs.length === exp.length && arcs.every((a, i) => near(a.r, exp[i], 1e-9));
      check(`${tag}: rings head inner ${E.rings.headInner} · leaf outer ${E.rings.leafOuter} · leaf inner ${E.rings.leafInner} · glass ${E.rings.glass}`,
        same(g.frameHead.inner, E.rings.headInner) && same(g.leafTop.outer, E.rings.leafOuter) && same(g.leafTop.inner, E.rings.leafInner) && same(g.glass.arcs, E.rings.glass));
    }
  } else {
    check(`${tag}: one arc, R ${E.R}`, g.arcs.length === 1 && near(g.arcs[0].r, E.R, 1e-9));
    expectNear(`${tag}: length ${E.total}`, arch.arcsLength(g.arcs), E.total, 0.01);
  }
  check(`${tag}: geometry.start = ${v.start}, straightHeight = start`, g.start === v.start && g.straightHeight === v.start);
}
expectThrows('Round W1000 start = H − 520 (rise 520 > W/2) → ArchError "use Gothic" from normaliseToWindowSpec', () => pcItem('V6', 1000, 1500, { archShape: 'three-centre', archStart: 980 }), /rise 520mm is above half the width \(500mm\): use Gothic/);
expectThrows('resolveRoundShape(1000, 520) → the same message', () => arch.resolveRoundShape(1000, 520), /use Gothic/);
check('Half (start = H − W/2 exactly) resolves to a semi-circle; 0.4 mm off still does (±0.5); 0.6 mm off is a three-centre',
  arch.resolveRoundShape(1000, 500) === 'semi-circle' && arch.resolveRoundShape(1000, 500.4) === 'semi-circle' && arch.resolveRoundShape(1000, 499.4) === 'three-centre');
expectThrows('Round W1000 start 1360 (rise 140 ≤ minHaunchRadius 150) → readable (F2)', () => derive(pcItem('V7', 1000, 1500, { archShape: 'three-centre', archStart: 1360 })), /rise 140mm must exceed the haunch radius 150mm/);
expectThrows('Round W1000 start 850 with H 1500 (rise 650 > 500) → use Gothic', () => pcItem('V8', 1000, 1500, { archShape: 'three-centre', archStart: 850 }), /use Gothic/);
{
  const gothic = derive(pcItem('G1', 1000, 1800, { archShape: 'gothic-equilateral' }));
  check('Gothic equilateral W1000: start derived = H − 0.866 W = 933.97, R 1000 both arcs, apex at 866.03 above the start', near(gothic.arch.geometry.start, 1800 - 1000 * Math.sqrt(3) / 2, 1e-6) && gothic.arch.geometry.radii.every((r) => near(r, 1000, 1e-9)) && near(gothic.arch.geometry.frameHead.apex.outer, 866.0254, 1e-3));
  const drop = derive(pcItem('G2', 1000, 1800, { archShape: 'gothic-drop', archProfile: 'shallow' }));
  check('Gothic shallow W1000: rise 0.60 W = 600, start 1200', near(drop.arch.geometry.rise, 600, 1e-9) && drop.arch.geometry.start === 1200);
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — bars on the glass outline (spec §2.3 / §3 vectors), glass frame = unit bottom-left, y up');
{
  const spec = pcItem('B1', 1000, 1500, { archShape: 'three-centre', archStart: 1000, casementHBars: 1, casementVBars: 2 });
  const d = derive(spec);
  const u = d.customGlassUnits[0];
  const o = d.arch.glassOutline;
  check('semi-circle W1000: glass clear width Wg = 811 (glass half 405.5), unit 811 × 1304, springing 898.5 = start − 101.5', u.width === 811 && near(u.height, 1304, 1e-6) && near(o.springing, 898.5, 1e-9) && near(o.width, 811, 1e-9));
  check('semi-circle W1000: glass outline apex = springing + 405.5, rise 405.5, one arc R 405.5 centred (405.5, 898.5)', near(o.apex, 1304, 1e-9) && near(o.rise, 405.5, 1e-9) && o.arcs.length === 1 && near(o.arcs[0].r, 405.5, 1e-9) && near(o.arcs[0].cx, 405.5, 1e-9) && near(o.arcs[0].cy, 898.5, 1e-9));
  expectNear('semi-circle W1000: glass area = 811 × 898.5 + π·405.5²/2 (exact, Green)', o.area, 811 * 898.5 + Math.PI * 405.5 * 405.5 / 2, 1e-6);
  expectNear('semi-circle W1000: glass perimeter = 811 + 2·898.5 + π·405.5', o.perimeter, 811 + 2 * 898.5 + Math.PI * 405.5, 1e-6);
  check('glass-frame origin in frame coordinates = (94.5, 101.5)', o.origin.x === 94.5 && o.origin.y === 101.5, JSON.stringify(o.origin));
  const vb = d.arch.bars.filter((b) => b.role === 'v');
  check('2 vertical bars at thirds of Wg: x = 405.5 ± 135.17 (270.33 / 540.67 in the glass frame), from the bottom edge', vb.length === 2 && near(vb[0].from[0], 405.5 - 135.1667, 0.01) && near(vb[1].from[0], 405.5 + 135.1667, 0.01) && vb.every((b) => b.from[1] === 0), vb.map((b) => b.from[0].toFixed(2)).join(' '));
  check('vertical bar top = 382.31 above the springing (= sqrt(405.5² − 135.17²)), length 1280.8 → 1281 (0.5 mm)', vb.every((b) => near(b.to[1] - o.springing, 382.31, 0.01) && b.length === 1281), vb.map((b) => (b.to[1] - o.springing).toFixed(2) + '/' + b.length).join(' '));
  const hb = d.arch.bars.filter((b) => b.role === 'h');
  check('1 horizontal bar at half the straight height (449.25), full clear width 811 — never across the arc', hb.length === 1 && near(hb[0].from[1], 449.25, 1e-9) && hb[0].from[0] === 0 && near(hb[0].to[0], 811, 1e-9) && hb[0].length === 811);
  check('bar ids V1 / V2 / H1, kinds straight, counts { h 1, v 2 }', d.arch.bars.map((b) => b.id).sort().join(',') === 'H1,V1,V2' && d.arch.bars.every((b) => b.kind === 'straight') && d.arch.barCounts.h === 1 && d.arch.barCounts.v === 2);
  expectNear('astragal bar run = Σ bar lengths (811 + 2 × 1281 = 3373) feeds the beading records', d.arch.barTotalLength, 3373, 1e-9);
  check('beading: C-TRIANGLE / C-GEORGIAN MIDDLE = round(3373 × 1.15) = 3879', d.components.beading.filter((b) => /TRIANGLE|GEORGIAN/.test(b.elementName)).every((b) => b.length === Math.round(3373 * 1.15)), d.components.beading.map((b) => b.length).join(' '));

  // hub-spoke (PSW semiBarPattern) on the same unit
  const hub = derive(pcItem('B2', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke', casementHBars: 0, casementVBars: 2 })).arch;
  const ring = hub.bars.filter((b) => b.role === 'ring');
  check('hub-spoke: ring r = 0.3 × 405.5 = 121.65, half ring (0..π) centred on the springing midpoint', ring.length === 1 && near(ring[0].arc.r, 121.65, 1e-9) && near(ring[0].arc.cx, 405.5, 1e-9) && near(ring[0].arc.cy, 898.5, 1e-9) && near(ring[0].arc.a0, 0, 1e-12) && near(ring[0].arc.a1, Math.PI, 1e-12) && ring[0].length === 382);
  const spokes = hub.bars.filter((b) => b.role === 'spoke' || b.role === 'springing');
  const angles = spokes.map((b) => Math.round(Math.atan2(b.to[1] - 898.5, b.to[0] - 405.5) * DEG)).sort((a, b) => a - b);
  check('hub-spoke: 4 spokes at 0 / 60 / 120 / 180° — the two end spokes ARE the springing bar (role springing), from the ring to the outline', spokes.length === 4 && angles.join(',') === '0,60,120,180' && spokes.filter((b) => b.role === 'springing').length === 2, angles.join(','));
  check('hub-spoke: spokes run ring (121.65) → outline (405.5): length 283.85 → 284', spokes.every((b) => b.length === 284 && near(Math.hypot(b.from[0] - 405.5, b.from[1] - 898.5), 121.65, 1e-6) && near(Math.hypot(b.to[0] - 405.5, b.to[1] - 898.5), 405.5, 1e-6)));
  const rv = hub.bars.filter((b) => b.role === 'v');
  check('hub-spoke: ring ends continue as verticals at x = 405.5 ± 121.65 down to the glass bottom; the user\'s v = 2 is ignored (PSW rule) — counts.v = 0', rv.length === 2 && near(rv[0].from[0], 405.5 - 121.65, 1e-9) && near(rv[1].from[0], 405.5 + 121.65, 1e-9) && rv.every((b) => b.from[1] === 0 && near(b.to[1], 898.5, 1e-9)) && hub.barCounts.v === 0);
  check('hub-spoke: 7 bars total, ids R1 S1 K1 K2 S2 V1 V2', hub.bars.length === 7 && hub.bars.map((b) => b.id).join(' ') === 'R1 S1 K1 K2 S2 V1 V2', hub.bars.map((b) => b.id).join(' '));
  const half = derive(pcItem('B3', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'half-hub' })).arch;
  check('half-hub: full-width springing bar + ring 1 only (no spokes, no verticals)', half.bars.length === 2 && half.bars[0].role === 'springing' && half.bars[0].length === 811 && half.bars[1].role === 'ring');
  const dbl = derive(pcItem('B4', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'double-hub-spoke' })).arch;
  const dblRoles = dbl.bars.reduce((m, b) => { m[b.role] = (m[b.role] || 0) + 1; return m; }, {});
  check('double-hub-spoke roles: ring 2, springing 4, spoke 8, v 4 (18 bars)', dblRoles.ring === 2 && dblRoles.springing === 4 && dblRoles.spoke === 8 && dblRoles.v === 4 && dbl.bars.length === 18, JSON.stringify(dblRoles));
  const tpl = derive(pcItem('B5', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'triple-hub-spoke', casementHBars: 1 })).arch;
  const tplRoles = tpl.bars.reduce((m, b) => { m[b.role] = (m[b.role] || 0) + 1; return m; }, {});
  check('triple-hub-spoke + 1 h bar: ring 3 (0.3 / 0.6 / 0.8), springing 6, spoke 18, v 6, h 1 (34 bars)', tplRoles.ring === 3 && tplRoles.springing === 6 && tplRoles.spoke === 18 && tplRoles.v === 6 && tplRoles.h === 1 && tpl.bars.length === 34, JSON.stringify(tplRoles));
  check('triple-hub-spoke rings r = 121.65 / 243.3 / 324.4', tpl.bars.filter((b) => b.role === 'ring').map((b) => +b.arc.r.toFixed(2)).join(',') === '121.65,243.3,324.4');
  // intersecting (PSW intersectingData) on a gothic and on a semi-circle
  const gi = derive(pcItem('B6', 1000, 1800, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting' })).arch;
  const trac = gi.bars.filter((b) => b.role === 'tracery');
  const mull = gi.bars.filter((b) => b.role === 'v');
  check('intersecting gothic W1000: 2 mullions (round(811 / 450) = 2) at thirds of Wg, from the bottom to the springing only', mull.length === 2 && near(mull[0].from[0], 811 / 3, 1e-6) && mull.every((b) => near(b.to[1], gi.glassOutline.springing, 1e-9)));
  check('intersecting gothic: 4 tracery arcs, centres on the outer frame corners (x = −94.5 / 905.5 in the glass frame, y = springing), radius = |mullion − corner|',
    trac.length === 4 && trac.every((b) => (near(b.arc.cx, -94.5, 1e-9) || near(b.arc.cx, 905.5, 1e-9)) && near(b.arc.cy, gi.glassOutline.springing, 1e-9)) && trac.some((b) => near(b.arc.r, 811 / 3 + 94.5, 1e-6)), trac.map((b) => `${b.arc.cx.toFixed(1)}/${b.arc.r.toFixed(1)}`).join(' '));
  const onOutline = (pt, o2) => near(pt[1], arch.chainYAtX(o2.arcs, pt[0]), 1e-6);
  check('intersecting gothic: every tracery arc starts on a mullion top (springing) and ends ON the glass outline (circle–circle intersection)', trac.every((b) => {
    const start = b.arc.cx < 0 ? b.from : b.to, end = b.arc.cx < 0 ? b.to : b.from;
    return near(start[1], gi.glassOutline.springing, 1e-6) && onOutline(end, gi.glassOutline);
  }));
  const si = derive(pcItem('B7', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'intersecting' })).arch;
  check('intersecting on a semi-circle: same construction, 2 mullions + 4 tracery arcs, ends on the outline', si.bars.filter((b) => b.role === 'tracery').length === 4 && si.bars.filter((b) => b.role === 'tracery').every((b) => onOutline(b.arc.cx < 0 ? b.to : b.from, si.glassOutline)));
  expectThrows('hub-spoke on a three-centre → readable (PATTERNS_FOR_SHAPE: three-centre takes none)', () => derive(pcItem('B8', 1000, 1500, { archShape: 'three-centre', archStart: 1300, archBarPattern: 'hub-spoke' })), /Bar pattern "hub-spoke" is not available on a Three-centre arch \(allowed: none\)/);
  expectThrows('intersecting on a three-centre → readable', () => derive(pcItem('B9', 1000, 1500, { archShape: 'three-centre', archStart: 1300, archBarPattern: 'intersecting' })), /not available on a Three-centre arch/);
  check('PSW_PATTERNS_FOR_SHAPE = PSW price-calculator.js 990–995 (semi-circle six, gothic none | intersecting, three-centre none); PC adds quad-hub-spoke + custom on the semi-circle only (v3 0.4)',
    JSON.stringify(arch.PSW_PATTERNS_FOR_SHAPE['semi-circle']) === JSON.stringify(['none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'intersecting'])
    && JSON.stringify(arch.PSW_PATTERNS_FOR_SHAPE['gothic-equilateral']) === '["none","intersecting"]' && JSON.stringify(arch.PSW_PATTERNS_FOR_SHAPE['gothic-drop']) === '["none","intersecting"]' && JSON.stringify(arch.PSW_PATTERNS_FOR_SHAPE['three-centre']) === '["none"]'
    && JSON.stringify(arch.PATTERNS_FOR_SHAPE['semi-circle']) === JSON.stringify([...arch.PSW_PATTERNS_FOR_SHAPE['semi-circle'], 'quad-hub-spoke', 'custom'])
    && JSON.stringify(arch.PATTERNS_FOR_SHAPE['gothic-equilateral']) === '["none","intersecting"]' && JSON.stringify(arch.PATTERNS_FOR_SHAPE['three-centre']) === '["none"]');
  // three-centre straight bars: the v-bar top follows the arc chain (haunch / crown)
  const tc = D.V1.d.arch;
  const tv = tc.bars;
  check('V1 (three-centre 1000/1500 start 1300) with no bars → empty list, pattern none', tv.length === 0 && tc.pattern === 'none');
  const tc2 = derive(pcItem('B10', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementVBars: 3 })).arch;
  check('three-centre with 3 v bars: tops on the chain (chainYAtX), the middle one at the apex 1304, outer ones lower', tc2.bars.length === 3 && near(tc2.bars[1].to[1], 1304, 1e-9) && tc2.bars[0].to[1] < 1304 && tc2.bars.every((b) => near(b.to[1], arch.chainYAtX(tc2.glassOutline.arcs, b.from[0]), 1e-9)), tc2.bars.map((b) => b.to[1].toFixed(1)).join(' '));
  // exact area vs numeric integration on the gothic glass chain
  const gg = gi.glassOutline;
  let num = 0; const N = 100000;
  for (let i = 0; i < N; i++) { const x = gg.width * (i + 0.5) / N; num += (arch.chainYAtX(gg.arcs, x) - gg.springing) * gg.width / N; }
  expectNear('chainAreaAboveLine (Green) = numeric integral on the gothic glass chain', gg.archArea, num, 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — cut list, glass unit, paint / seals / weights; rectangular casements byte-identical');
{
  const { d, spec } = D.V1;
  const g = d.arch.geometry;
  const byName = (arr, n) => arr.find((c) => c.elementName === n);
  const head = byName(d.components.box, 'C-ARCH HEAD');
  check('C-ARCH HEAD replaces C-FRAME HEAD: code C-AH, section 57x93', !!head && !byName(d.components.box, 'C-FRAME HEAD') && head.code === 'C-AH' && head.section === '57x93');
  expectNear('C-ARCH HEAD length = centre-line arc length of the head ring (1091.19)', head.length, g.frameHead.lengths.centre, 0.05);
  expectNear('  … = 1091.19 (mean of outer 1180.72 and inner 1001.65 for rule-C shapes)', head.length, (g.frameHead.lengths.outer + g.frameHead.lengths.inner) / 2, 0.05);
  check('C-ARCH HEAD notes: R 150/1400/150 · 8 pieces · stock 95/95/95', head.notes === 'R 150/1400/150 · 8 pieces · stock 95/95/95', head.notes);
  const jamb = byName(d.components.box, 'C-FRAME JAMB (L)');
  check('jambs = start (1300) − jambDeduct, both sides', jamb.length === 1300 && byName(d.components.box, 'C-FRAME JAMB (R)').length === 1300);
  check('cill unchanged (1000)', byName(d.components.box, 'C-FRAME CILL').length === 1000);
  const atr = byName(d.components.sash, 'C-ARCH TOP RAIL');
  check('C-ARCH TOP RAIL replaces C-TOP RAIL: code C-ATR-P1, section 67x57', !!atr && !byName(d.components.sash, 'C-TOP RAIL') && atr.code === 'C-ATR-P1' && atr.section === '67x57');
  expectNear('C-ARCH TOP RAIL length = leaf ring centre line (949.82)', atr.length, g.leafTop.lengths.centre, 0.05);
  check('stiles = leaf straight stile = start − 47 = 1253', byName(d.components.sash, 'C-STILE (L)').length === 1253 && byName(d.components.sash, 'C-STILE (R)').length === 1253);
  check('bottom rail = leaf width 920 (unchanged rule)', byName(d.components.sash, 'C-BOTTOM RAIL').length === 920);
  check('layout forced to the single leaf of the hinge side (040L, hinge left), hinges null', d.casement.layout === '040L' && d.casement.panes === 1);
  check('hinge right → 040R', derive(pcItem('C1', 1000, 1500, { archShape: 'three-centre', archStart: 1300, archHinge: 'right' })).casement.layout === '040R');
  const cut = lists.buildCutListForWindow(d, spec).map((r) => ({ ...r, windowName: 'V1' }));
  const groups = lists.buildGroupedCutList(cut);
  check('grouped cut list: C-AH right after the frame head slot, C-ATR after the leaf top rail, no "?" group', groups.map((x) => x.symbol).join(' ') === 'C-AH C-J-L/R C-CILL C-ST-L/R C-ATR C-BR' && !groups.some((x) => x.symbol === '?'), groups.map((x) => x.symbol).join(' '));
  check('C-AH group: 1091 × 1, C-ATR group: 950 × 1 (integer cut list)', groups.find((x) => x.symbol === 'C-AH').rows[0].length === 1091 && groups.find((x) => x.symbol === 'C-ATR').rows[0].length === 950);
  const u = d.customGlassUnits[0];
  check('glass unit: 811 × 1304, qty 1, role main, location "arched leaf", shape.kind arched', u.width === 811 && near(u.height, 1304, 1e-6) && u.qty === 1 && u.role === 'main' && u.location === 'arched leaf' && u.shape?.kind === 'arched');
  check('glass unit shape: springing 1198.5 (= 1300 − 101.5), apex 1304, rise 105.5, radii 55.5 / 1305.5 / 55.5, 6-vertex poly', near(u.shape.springing, 1198.5, 1e-9) && near(u.shape.apex, 1304, 1e-9) && near(u.shape.rise, 105.5, 1e-9) && JSON.stringify(u.shape.radii) === '[55.5,1305.5,55.5]' && u.shape.poly.length === 6);
  const rows = lists.buildGlassListForWindow(d, spec);
  check('glass row: 811 × 1304, carries shape, no bars label without bars', rows.length === 1 && rows[0].width === 811 && rows[0].height === 1304 && rows[0].shape?.kind === 'arched' && rows[0].bars === undefined, JSON.stringify(rows[0].bars));
  const rowsB = lists.buildGlassListForWindow(derive(pcItem('C2', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke', casementHBars: 1 })), spec);
  check('glass row bars label: "1H × 0V · hub-spoke astragal"', rowsB[0].bars === '1H × 0V · hub-spoke astragal', rowsB[0].bars);
  // true-outline consumables
  const outerArea = 1000 * 1300 + arch.chainAreaAboveLine(g.arcs);
  expectNear('paint area = W × start + area under the outer chain (m², 2 dp)', d.paint.areaSqm, Math.round(outerArea / 1e6 * 100) / 100, 1e-9);
  expectNear('seal frame = (2 × start + head outer arc + W) × 1.10', d.consumables.sealFrame.meters, Math.round((2 * 1300 + g.frameHead.lengths.outer + 1000) * 1.1 / 1000 * 100) / 100, 1e-9);
  expectNear('seal head & jambs = (2 × start + head outer arc) × 1.10', d.consumables.sealHeadJambs.meters, Math.round((2 * 1300 + g.frameHead.lengths.outer) * 1.1 / 1000 * 100) / 100, 1e-9);
  expectNear('glass m² = true outline area', d.consumables.glass.sqm, Math.round(d.arch.glassOutline.area / 1e6 * 100) / 100, 1e-9);
  const timber = [...d.components.box, ...d.components.sash].reduce((a, c) => a + (c.section.split('x').map(Number).reduce((x, y) => x * y) * 610 / 1e6) * (c.length / 1000) * c.quantity, 0);
  expectNear('timber weight = Σ section × density × length over the cut list (curved members at their arc length)', d.weights.timber, Math.round(timber * 10) / 10, 0.11);
  check('leaf weight for the hinge selector uses the true glass area and the curved top rail', d.casement.leafWeights[0].weightKg > 0 && d.casement.hardware.hingePicks.length === 1);
  // BOM part mapping for the curved members
  const qtys = bom.buildWindowPartQtys(d, spec, {}, null);
  check('BOM: C-ARCH HEAD → c_frame_head (mm = 1091 + 20 machining), C-ARCH TOP RAIL → c_sash_top_rail', qtys.c_frame_head?.mm === 1091 + 20 && qtys.c_sash_top_rail?.mm === 950 + 20, JSON.stringify([qtys.c_frame_head, qtys.c_sash_top_rail]));
  // rectangular casements: byte-identical to the origin/main fixture
  const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-base.json'), 'utf8'));
  for (const [name, c] of Object.entries(FX)) {
    const rs = specification.normaliseToWindowSpec({ id: 'fx_' + name, width: c.input.width, height: c.input.height, name }, { fullConfig: { windowCategory: 'casement', ...c.input.fc } });
    const rd = derive(rs);
    check(`rectangular ${name} (${c.input.fc.casementLayout}): derived / cut list / glass rows JSON-identical to origin/main, no arch key`,
      JSON.stringify(rd) === JSON.stringify(c.derived) && JSON.stringify(lists.buildCutListForWindow(rd, rs)) === JSON.stringify(c.cut) && JSON.stringify(lists.buildGlassListForWindow(rd, rs)) === JSON.stringify(c.glass) && !('arch' in rd));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — glazier DXF: ezdxf round-trip, samples docs/handover/samples/sample_glass_*.dxf');
{
  let lastBlob = null, lastName = null, clicks = 0;
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ set href(v) {}, set download(v) { lastName = v; }, click() { clicks++; }, remove() {} }) };
  const origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (b) => { lastBlob = b; return 'blob:harness'; };
  URL.revokeObjectURL = () => {};
  const cases = [
    { file: 'sample_glass_1000x1500_three-centre_start1300.dxf', name: 'TC1', spec: pcItem('TC1', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 }) },
    { file: 'sample_glass_1000x1500_semi-circle_hub-spoke.dxf', name: 'SC1', spec: pcItem('SC1', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' }) },
    { file: 'sample_glass_1000x1800_gothic_intersecting.dxf', name: 'GO1', spec: pcItem('GO1', 1000, 1800, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting', casementHBars: 1 }) },
  ];
  const windows = [];
  for (const c of cases) {
    const d = derive(c.spec);
    windows.push({ windowSpec: c.spec, derived: d, name: c.name });
    const r = glassDxf.exportGlassDxfForWindow(c.spec, d, c.name);
    check(`${c.name}: exportGlassDxfForWindow → ${c.name}_glass.dxf, 1 unit`, r.ok === true && r.units === 1 && lastName === `${c.name}_glass.dxf`, JSON.stringify(r));
    const text = await lastBlob.text();
    const path = resolve(SAMPLES, c.file);
    writeFileSync(path, text);
    const p = probe(path);
    const contour = p.polys.filter((x) => x.layer === 'GLASS_CONTOUR');
    const bars = p.polys.filter((x) => x.layer === 'GLASS_BAR_AXES');   // v3 0.2: axes moved, GLASS_BARS = bands
    const sh = d.customGlassUnits[0].shape;
    const nArcs = sh.outline.arcs.length;
    check(`${c.name}: R12, layers GLASS_CONTOUR / GLASS_EDGE / GLASS_BARS / GLASS_BAR_AXES / GLASS_TEXT`, p.version === 'AC1009' && ['GLASS_CONTOUR', 'GLASS_EDGE', 'GLASS_BARS', 'GLASS_BAR_AXES', 'GLASS_TEXT'].every((l) => p.layers.includes(l)));
    check(`${c.name}: contour closed, ${nArcs + 3} vertices (one per arc end + 3 corners), bulge count = number of arcs (${nArcs})`, contour.length === 1 && contour[0].closed && contour[0].n === nArcs + 3 && contour[0].bulges.filter((b) => b).length === nArcs, `${contour[0]?.n} / ${contour[0]?.bulges.filter((b) => b).length}`);
    expectNear(`${c.name}: contour arc length (ezdxf) = glass arch length`, contour[0].arcs, sh.outline.archLength, 0.01);
    expectNear(`${c.name}: contour straight length = Wg + 2 × springing`, contour[0].straight, sh.outline.width + 2 * sh.outline.springing, 0.01);
    check(`${c.name}: contour bbox starts at (0, 0) — the unit's own frame`, near(contour[0].bbox[0], 0, 1e-6) && near(contour[0].bbox[1], 0, 1e-6) && near(contour[0].bbox[2], sh.outline.width, 1e-6));
    check(`${c.name}: bar axes count = bars.length (${sh.bars.length}), open polylines`, bars.length === sh.bars.length && bars.every((b) => !b.closed && b.n === 2));
    expectNear(`${c.name}: Σ bar axis lengths (ezdxf) = Σ bar lengths (0.5 mm rounding)`, bars.reduce((a, b) => a + b.arcs + b.straight, 0), sh.bars.reduce((a, b) => a + b.length, 0), 0.5 * sh.bars.length + 0.01);
    const arcBars = bars.filter((b) => b.arcs > 0).length;
    check(`${c.name}: curved bars carry a bulge (${sh.bars.filter((b) => b.kind === 'arc').length})`, arcBars === sh.bars.filter((b) => b.kind === 'arc').length);
    const texts = p.texts.map((t) => t.text);
    check(`${c.name}: TEXT block — unit line, W × H / RISE / SPRINGING / R line, spec line, one line per bar`, texts.some((t) => t === `${c.name} - G1 GLASS ${sh.archShape.toUpperCase()}`) && texts.some((t) => t.startsWith(`W${sh.outline.width} x H`) && t.includes('RISE') && t.includes(' R ')) && texts.filter((t) => /^(V|H|S|R|K|T)\d+ /.test(t)).length === 2 * sh.bars.length, texts.slice(0, 5).join(' | '));   // v3 0.3: geometry line + bar-end row per bar
    check(`${c.name}: TEXT lines = unitTextLines (module-side)`, glassDxf.unitTextLines({ id: 'G1', row: lists.buildGlassListForWindow(d, c.spec)[0], shape: sh }, c.name).every((l) => texts.includes(l)));
  }
  const rect = specification.normaliseToWindowSpec({ id: 'R', name: 'R', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L' } });
  const rd = derive(rect);
  check('rectangular casement → skip "not an arched casement", canExportGlassDxf false', /not an arched casement/.test(glassDxf.glassDxfParamsForWindow(rect, rd, 'R').skip || '') && glassDxf.canExportGlassDxf(rect, rd) === false);
  check('rectangular sash → skip "not an arched sash"; null derived → skip "could not be calculated"', /not an arched sash/.test(glassDxf.glassDxfParamsForWindow(specification.normaliseToWindowSpec({ width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } }), {}, 'S').skip) && /could not be calculated/.test(glassDxf.glassDxfParamsForWindow(D.V1.spec, null, 'x').skip));
  windows.push({ windowSpec: rect, derived: rd, name: 'R' });
  const clicksBefore = clicks;
  const m = glassDxf.exportGlassDxfMerged(windows, 'Pack 1');
  check('merged: 3 windows / 3 units exported, rectangular window skipped with its reason, one download Pack_1_glass.dxf', m.ok && m.exported === 3 && m.units === 3 && m.skipped.length === 1 && m.skipped[0].name === 'R' && lastName === 'Pack_1_glass.dxf' && clicks === clicksBefore + 1, JSON.stringify(m));
  const mergedPath = resolve(SAMPLES, 'sample_glass_pack_merged.dxf');
  writeFileSync(mergedPath, await lastBlob.text());
  const pm = probe(mergedPath);
  const mc = pm.polys.filter((x) => x.layer === 'GLASS_CONTOUR').sort((a, b) => b.bbox[1] - a.bbox[1]);
  // true unit heights (apex, not the vertex top): TC1 1304, SC1 1304, GO1 1587.41 — stacked 300 apart from y = 0 downwards
  const hts = [1304, 1304, 1587.4111];
  const bottoms = [-hts[0], -hts[0] - 300 - hts[1], -hts[0] - 300 - hts[1] - 300 - hts[2]];
  check('merged: 3 contours stacked top-down exactly 300 mm apart on their TRUE extents (arc apex, not the springing vertices) — bottoms at −1304 / −2908 / −4795.4',
    mc.length === 3 && mc.every((c, i) => near(c.bbox[1], bottoms[i], 0.01)), mc.map((c) => c.bbox.map((v) => v.toFixed(1)).join(',')).join(' | '));
  const pb = glassDxf.polyBBox([[0, 0, 0], [811, 0, 0], [811, 898.5, 1], [0, 898.5, 0]], true);
  check('polyBBox: a semi-circle contour (bulge 1) reaches the apex 1304, not the vertex top 898.5', near(pb.maxY, 1304, 1e-6) && near(pb.minY, 0, 1e-9) && near(pb.maxX, 811, 1e-9));
  check('merged: labels TC1 / SC1 / GO1 in the TEXT layer', ['TC1', 'SC1', 'GO1'].every((n) => pm.texts.some((t) => t.text.startsWith(`${n} - G1 GLASS`))));
  const none = glassDxf.exportGlassDxfMerged([{ windowSpec: rect, derived: rd, name: 'R' }], 'Pack 2');
  check('merged with no shaped unit → error + skipped, no download', none.error === 'No shaped glass units in this pack' && none.skipped.length === 1 && clicks === clicksBefore + 1);
  URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke; delete globalThis.document;
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — PSW import (P10) and v1-era migration');
{
  const psw = (fc, item = {}) => specification.normaliseToWindowSpec({ width: 1200, height: 2000, name: 'PSW', ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
  const a = psw({ casementType: 'arched', casArchShape: 'segmental-arch', casArchHinge: 'right' });
  check('spec vector: casArchShape segmental-arch W1200 → three-centre, rise 240, start = H − 240 = 1760, riseSource ratio', a.arch.shape === 'three-centre' && near(a.arch.rise, 240, 1e-9) && a.arch.start === 1760 && a.arch.riseSource === 'ratio', JSON.stringify(a.arch));
  const ad = derive(a);
  check('… derives: r 150 (P3 clamp of 96), crown R 1320, C-AH present', near(ad.arch.geometry.arcs[0].r, 150, 1e-9) && near(ad.arch.geometry.arcs[1].r, 1320, 1e-6) && ad.components.box.some((c) => c.elementName === 'C-ARCH HEAD'));
  const e = psw({ casementType: 'arched', casArchShape: 'elliptical-arch' });
  check('elliptical-arch W1200 → three-centre rise 390 (0.325), start 1610', e.arch.shape === 'three-centre' && near(e.arch.rise, 390, 1e-9) && e.arch.start === 1610);
  const sc = psw({ casementType: 'arched', casArchShape: 'semi-circle' });
  check('semi-circle → semi-circle rise 600, start 1400', sc.arch.shape === 'semi-circle' && near(sc.arch.rise, 600, 1e-9) && sc.arch.start === 1400);
  const go = psw({ casementType: 'arched', casArchShape: 'gothic-arch', archProfile: 'drop' });
  check('gothic-arch + profile drop → gothic-drop rise 840, profile drop', go.arch.shape === 'gothic-drop' && near(go.arch.rise, 840, 1e-9) && go.arch.profile === 'drop');
  const legacy = specification.normaliseToWindowSpec({ width: 1200, height: 2000, windowCategory: 'casement', casementType: 'arched', archShape: 'segmental', archRise: 300, archRiseSource: 'custom', archHinge: 'right' });
  check('v1-era PC "segmental" (custom rise 300 saved) → three-centre, rise 0.20 W = 240, riseSource ratio, hinge kept', legacy.arch.shape === 'three-centre' && legacy.arch.rise === 240 && legacy.arch.riseSource === 'ratio' && legacy.arch.hinge === 'right');
  const v1 = specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'three-centre', archRise: 300 });
  check('v1 item with archRise only (no archStart) → rise 300 custom, start 1200', v1.arch.rise === 300 && v1.arch.riseSource === 'custom' && v1.arch.start === 1200);
  const auto = specification.normaliseToWindowSpec({ width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'three-centre', archStart: 1175, archRiseSource: 'ratio' });
  check('v2 item saved on Auto (archStart 1175, riseSource ratio) → rise 325, riseSource ratio kept', auto.arch.rise === 325 && auto.arch.riseSource === 'ratio');
  check('v3 0.4b: PSW hinge value taken 1:1 (casArchHinge right → hinge right, identity mapping)', a.arch.hinge === 'right');
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — glass PDF (jsPDF in node): Shape column, mm + % line, shaped drawing');
{
  try {
    const specs = [D.V1.spec, pcItem('P2', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' }),
      specification.normaliseToWindowSpec({ id: 'PR', name: 'PR', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', casementHBars: 1, casementVBars: 2 } })];
    const specV1b = pcItem('P1b', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 });
    const windowsData = [specV1b, ...specs].map((ws) => ({ win: { name: ws.name, _projectNumber: 'P-1' }, windowSpec: ws, derived: derive(ws) }));
    const buf = glassPdf.exportGlassPDF({ batch: { label: 'Batch T18' }, windowsData, projects: [{ number: 'P-1', name: 'T18' }], companySettings: { companyName: 'HARNESS' }, returnDoc: true });
    const bytes = Buffer.from(buf);
    writeFileSync(resolve(AUDIT, 't18_glass.pdf'), bytes);
    const txt = bytes.toString('latin1');
    check('PDF built, 2 pages (table + 4 drawings)', bytes.length > 10000 && (txt.match(/\/Type \/Page[^s]/g) || []).length === 2);
    const has = (s) => txt.includes(s);
    check('Shape column header + "rect" for the rectangular row + "arched · R 55.5/1305.5" for the three-centre unit', has('(Shape)') && has('(rect)') && has('arched · R 55.5/1305.5'));
    // v3 0.3: the header line prints the bar-end rows (x from the corner · s from apex · L) instead of x (%) / y pairs
    check('mm + % line: "springing 1198.5 \\(92%\\)" and the V1 row "V1 x 270.3 " with "from apex" and "L 1297"', has('springing 1198.5 \\(92%\\)') && has('V1 x 270.3 ') && has('from apex') && has('L 1297'));
    check('hub-spoke row (7 bars): "7 bars \u2014 see table", table rows "R1 R 121.7" and bars cell shortened to "hub ast"', has('7 bars') && has('see table') && has('R 121.7') && has('(hub ast)'));
    check('shaped drawing cell: "rise 105.5", overall "811 mm" / "1304 mm", Bézier curve operators present', has('rise 105.5') && has('811 mm') && has('1304 mm') && (txt.match(/ c\n/g) || []).length >= 6);
  } catch (e) {
    check('glass PDF section ran (jsPDF loadable in node)', false, String(e?.message || e));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('7 — profile v3 block and vocabulary');
check('profile.arch v3: minHaunchRadius 150, hubRingRatios [0.3, 0.6, 0.8], intersecting { 450, 2, 4, 30 }', P.arch.version === 3 && P.arch.minHaunchRadius === 150 && JSON.stringify(P.arch.patterns.hubRingRatios) === '[0.3,0.6,0.8]' && JSON.stringify(P.arch.patterns.intersecting) === '{"pitch":450,"minMullions":2,"maxMullions":4,"minRadius":30}');
check('ARCH_BAR_PATTERNS vocabulary (PSW six + v3 quad-hub-spoke + custom + Block 3 sunburst) and labels', JSON.stringify(arch.ARCH_BAR_PATTERNS) === '["none","half-hub","hub-spoke","double-hub-spoke","triple-hub-spoke","quad-hub-spoke","custom","intersecting","sunburst"]' && arch.ARCH_BAR_PATTERNS.every((p) => typeof arch.ARCH_BAR_PATTERN_LABELS[p] === 'string'));
expectThrows('unknown pattern in an item throws at normalisation', () => pcItem('X', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'star' }), /Unknown arch bar pattern "star"/);
check('CUT_LIST_ORDER: C-AH directly after C-FH, C-ATR directly after C-TR', (() => { const s = lists.CUT_LIST_ORDER.map((x) => x.symbol); return s[s.indexOf('C-FH') + 1] === 'C-AH' && s[s.indexOf('C-TR') + 1] === 'C-ATR'; })());
check('bom ELEMENT_TO_PART_ID maps both curved members', bom.ELEMENT_TO_PART_ID['C-ARCH HEAD'] === 'c_frame_head' && bom.ELEMENT_TO_PART_ID['C-ARCH TOP RAIL'] === 'c_sash_top_rail');

// ═══════════════════════════════════════════════════════════════════════════
section('8 — structural evidence (source text, not behaviour): store whitelist, configurator chips');
{
  const store = readFileSync(resolve(ROOT, 'src', 'stores', 'projectStore.js'), 'utf8');
  check('projectStore.js: both window builders copy archStart and archBarPattern', (store.match(/archStart: windowConfig\.archStart/g) || []).length === 2 && (store.match(/archBarPattern: windowConfig\.archBarPattern/g) || []).length === 2);
  const cfg = readFileSync(resolve(ROOT, 'src', 'pages', 'ConfiguratorPage.jsx'), 'utf8');
  check('ConfiguratorPage.jsx: chips Round | Gothic, "Arch starts at (mm from cill)", Auto and Half, pattern chips from PATTERNS_FOR_SHAPE, Save gated by archError', cfg.includes("{ value: 'round', label: 'Round' }, { value: 'gothic', label: 'Gothic' }") && cfg.includes('Arch starts at (mm from cill)') && cfg.includes('archHalfStart') && cfg.includes('archAutoStart') && cfg.includes('PATTERNS_FOR_SHAPE[pcArchShape]') && cfg.includes('disabled={shapeBlocked}') && cfg.includes('const shapeBlocked = (isArched || isCircle) && !!archError;'));
  check('ConfiguratorPage.jsx: no segmental / three-centre chips left, saves archStart + archBarPattern', !cfg.includes("value: 'segmental'") && !cfg.includes("value: 'three-centre'") && cfg.includes('archStart: isArched ? archStartNum : null') && cfg.includes('archBarPattern: isArched || isCircle ? casArchPattern : null'));
  check('samples present: five arch DXFs (no segmental) + three glass DXFs + merged', ['sample_arch_1200_semi-circle.dxf', 'sample_arch_1200_gothic-equilateral.dxf', 'sample_arch_1200_gothic-drop.dxf', 'sample_arch_1200_three-centre.dxf', 'sample_arch_1200_three-centre-rise240.dxf', 'sample_glass_1000x1500_three-centre_start1300.dxf', 'sample_glass_1000x1500_semi-circle_hub-spoke.dxf', 'sample_glass_1000x1800_gothic_intersecting.dxf', 'sample_glass_pack_merged.dxf'].every((f) => { try { readFileSync(resolve(SAMPLES, f)); return true; } catch { return false; } }));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
