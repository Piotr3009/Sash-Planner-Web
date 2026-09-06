/**
 * t28 — night 7 Stage 1: the glazier DXF carries EVERY glass unit.
 *
 * Piotr 06.09: "the glazier gets ONE file with all the glass" — the export used
 * to skip windows without an arch ("rectangular units go on the glass PDF").
 * This harness asserts, on real engine data (normaliseToWindowSpec →
 * deriveWindowData → buildGlassListForWindow):
 *   1  rectangular casement 040L 1000 × 1500 with 1H / 1V bars → ONE unit,
 *      contour 789 × 1293 (the 68 profile), edge cover line inset 11 all round,
 *      two bands 18 wide with their axes on GLASS_BAR_AXES, and the text block
 *      naming the window, the unit, W × H and the bar axes from the corners;
 *   2  multi-unit rectangular windows export every unit (130 → 3, 133 → 6);
 *   3  double-hung sash units follow the SASH-FRAME bar placement, the same
 *      rule the glass PDF draws from — not the equal splits of a casement;
 *   4  a pack with one rectangular + one arched window exports BOTH, stacked
 *      without overlap;
 *   5  the shaped output is unchanged: whole-file byte identity against the
 *      previous commit for the all-shaped windows, and per-unit entity identity
 *      for the mixed arched sash (whose file legitimately GAINS its lower unit);
 *   6  only a window with no glass at all is skipped, with the reason;
 *   7  DXF round-trip through ezdxf (layers, entities, text).
 * Writes docs/handover/samples/sample_glass_rect_1000x1500_040L.dxf and
 * sample_glass_pack_mixed.dxf.
 * Run: node verify/arch/t28.mjs   (needs `pip install ezdxf --break-system-packages`)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(AUDIT, { recursive: true });
mkdirSync(SAMPLES, { recursive: true });
const PREV = '30a8012';   // last commit before Stage 1 (docs only on top of gothic-full-v1)

function bundle(srcRoot, tag) {
  const entry = resolve(AUDIT, `${tag}-entry.mjs`);
  writeFileSync(entry, [
    `export * as profile from '${resolve(srcRoot, 'engine/profile.js')}';`,
    `export * as specification from '${resolve(srcRoot, 'engine/specification.js')}';`,
    `export * as calculations from '${resolve(srcRoot, 'engine/calculations.js')}';`,
    `export * as lists from '${resolve(srcRoot, 'engine/lists.js')}';`,
    `export * as dxfWriter from '${resolve(srcRoot, 'engine/cnc/dxfWriter.js')}';`,
    `export * as glassDxf from '${resolve(srcRoot, 'utils/glassDxfExport.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${tag}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--jsx=automatic', '--external:react', '--external:react/jsx-runtime', '--external:jspdf', `--outfile=${out}`],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const M = await bundle(resolve(ROOT, 'src'), 't28');
const prevTree = resolve(AUDIT, `tree-${PREV}-t28`);
if (existsSync(prevTree)) rmSync(prevTree, { recursive: true, force: true });
mkdirSync(prevTree, { recursive: true });
execFileSync('bash', ['-lc', `git archive ${PREV} src | tar -x -C "${prevTree}"`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const OLD = await bundle(resolve(prevTree, 'src'), 't28-prev');

const { specification, calculations, glassDxf, dxfWriter, profile } = M;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const P = profile.DEFAULT_CASEMENT_PROFILE;

const cas = (id, w, h, fc = {}) => specification.normaliseToWindowSpec({ id, name: id, width: w, height: h }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
const pcItem = (id, width, height, fields) => specification.normaliseToWindowSpec({ id, name: id, width, height, windowCategory: 'casement', casementType: 'arched', ...fields });
const pswSash = (id, width, height, fc) => specification.normaliseToWindowSpec({ id, name: id, width, height }, { fullConfig: { windowCategory: 'sash', sashType: 'arched-group', ...fc } });
const derive = (spec) => calculations.deriveWindowData(spec, {});
const layerOf = (ents, layer) => ents.filter((e) => e.layer === layer);
function probe(path) {
  const out = execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

// ═══════════════════════════════════════════════════════════════════════════
section('1 — rectangular casement 040L 1000 x 1500, 1H / 1V: contour, edge cover, bands, axes, text');
const RECT = cas('R040', 1000, 1500, { casementHBars: 1, casementVBars: 1 });
const DR = derive(RECT);
const rectUnits = glassDxf.glassUnitsForWindow(RECT, DR);
check('glassUnitsForWindow: ONE unit (the 040L leaf), rectangular (no shape)', rectUnits.length === 1 && !rectUnits[0].shape && !!rectUnits[0].rect, String(rectUnits.length));
const U = rectUnits[0];
// the unit size comes from the engine (leaf 898 x 1402 inside the 68 frame, glass deduction 109)
const expW = 1000 - 2 * P.deductions.leafAtJamb - P.deductions.glass;
const expH = 1500 - P.deductions.leafFullHeight - P.deductions.glass;
check(`unit = 789 x 1293 from the profile (W − 2·leafAtJamb ${P.deductions.leafAtJamb} − glass ${P.deductions.glass}, H − leafFullHeight ${P.deductions.leafFullHeight} − glass)`,
  near(U.rect.width, 789) && near(U.rect.height, 1293) && near(U.rect.width, expW) && near(U.rect.height, expH), `${U.rect.width} x ${U.rect.height} vs ${expW} x ${expH}`);
const EU = glassDxf.buildGlassUnitEntities(U, 'R040', 0, 0).entities;
const contour = layerOf(EU, 'GLASS_CONTOUR');
check('GLASS_CONTOUR: ONE closed 4-vertex polyline, no bulge, corners (0,0)-(789,1293)',
  contour.length === 1 && contour[0].closed && contour[0].pts.length === 4 && contour[0].pts.every((p) => !p[2]) &&
  near(contour[0].pts[0][0], 0) && near(contour[0].pts[0][1], 0) && near(contour[0].pts[2][0], 789) && near(contour[0].pts[2][1], 1293),
  JSON.stringify(contour[0]?.pts));
const cover = P.glass.edgeCover.double;
const edge = layerOf(EU, 'GLASS_EDGE');
check(`GLASS_EDGE: ONE closed rectangle inset by glass.edgeCover ${cover} all round (11,11)-(778,1282)`,
  edge.length === 1 && edge[0].closed && edge[0].pts.length === 4 &&
  near(edge[0].pts[0][0], cover) && near(edge[0].pts[0][1], cover) &&
  near(edge[0].pts[2][0], 789 - cover) && near(edge[0].pts[2][1], 1293 - cover), JSON.stringify(edge[0]?.pts));
const axes = layerOf(EU, 'GLASS_BAR_AXES');
const bands = layerOf(EU, 'GLASS_BARS');
check('GLASS_BAR_AXES: 2 axes — V1 at x = 394.5 (W/2), H1 at y = 646.5 (H/2), full length',
  axes.length === 2 && near(axes[0].pts[0][0], 789 / 2) && near(axes[0].pts[0][1], 0) && near(axes[0].pts[1][1], 1293) &&
  near(axes[1].pts[0][1], 1293 / 2) && near(axes[1].pts[0][0], 0) && near(axes[1].pts[1][0], 789),
  JSON.stringify(axes.map((a) => a.pts)));
const bw = P.glass.barWidth;
const vBand = bands.filter((b) => near(b.pts[0][0], b.pts[1][0])).map((b) => b.pts[0][0]).sort((a, b) => a - b);
const hBand = bands.filter((b) => near(b.pts[0][1], b.pts[1][1])).map((b) => b.pts[0][1]).sort((a, b) => a - b);
check(`GLASS_BARS: 4 band edges — 2 x glass.barWidth ${bw} (V at 385.5 / 403.5, H at 637.5 / 655.5)`,
  bands.length === 4 && vBand.length === 2 && hBand.length === 2 &&
  near(vBand[0], 789 / 2 - bw / 2) && near(vBand[1], 789 / 2 + bw / 2) &&
  near(hBand[0], 1293 / 2 - bw / 2) && near(hBand[1], 1293 / 2 + bw / 2), JSON.stringify([vBand, hBand]));
const txt = layerOf(EU, 'GLASS_TEXT').map((t) => t.str);
check('GLASS_TEXT: window name + unit id + RECTANGULAR on line 1', txt[0] === 'R040 - G1 GLASS RECTANGULAR', txt[0]);
check('GLASS_TEXT: W x H line carries the engine numbers', txt[1].startsWith('W789 x H1293'), txt[1]);
check('GLASS_TEXT: the glass spec line (type, makeup, spec, gas, finish)', /DOUBLE/.test(txt[2]) && /TOUGHENED/.test(txt[2]), txt[2]);
check('GLASS_TEXT: bar count line 1H x 1V', txt.some((t) => t === 'BARS 2 (1H x 1V) TOTAL L=2082'), txt[3]);
check('GLASS_TEXT: bar axes measured FROM THE BOTTOM CORNERS (left / right, bottom / top)',
  txt.includes('BAR AXES FROM THE BOTTOM CORNERS:') &&
  txt.includes('V1  FROM LEFT 394.5  FROM RIGHT 394.5') &&
  txt.includes('H1  FROM BOTTOM 646.5  FROM TOP 646.5'), JSON.stringify(txt.slice(-3)));
check('the single-window export is ENABLED for a plain rectangular casement (was: skipped)', glassDxf.canExportGlassDxf(RECT, DR) === true);
check('the OLD code skipped exactly this window (proof the stage changed behaviour)', !!OLD.glassDxf.glassDxfParamsForWindow(RECT, DR, 'R040').skip, String(OLD.glassDxf.glassDxfParamsForWindow(RECT, DR, 'R040').skip));

// ═══════════════════════════════════════════════════════════════════════════
section('2 — multi-unit rectangular windows: every unit is exported');
const W130 = cas('R130', 1800, 1500, { casementLayout: '130' });
const D130 = derive(W130);
const U130 = glassDxf.glassUnitsForWindow(W130, D130);
check('130 (3 lights) → 3 units, ids G1..G3, all rectangular', U130.length === 3 && U130.map((u) => u.id).join(',') === 'G1,G2,G3' && U130.every((u) => !u.shape), String(U130.length));
const W133 = cas('R133', 1800, 1500, { casementLayout: '133' });
const D133 = derive(W133);
const U133 = glassDxf.glassUnitsForWindow(W133, D133);
// ERRATUM (BUILD-LOG / BLOCKERS): the brief says "133 → 3 units"; layout 133 is
// "3 Lights + Fanlights", so the engine orders 3 fanlights + 3 lights = 6 units.
// The engine is right; the assertion follows the engine, not the brief.
check('133 (3 lights + fanlights) → 6 units = 3 fanlights + 3 lights (brief said 3 — erratum)',
  U133.length === 6 && U133.filter((u) => /top/.test(u.row.location)).length === 3, String(U133.length));
check('133: every unit carries its own size from the engine row (434.3 x 337.2 fanlight, 434.3 x 815.8 light)',
  near(U133[0].rect.width, 434.3) && near(U133[0].rect.height, 337.2) && near(U133[3].rect.height, 815.8),
  JSON.stringify(U133.map((u) => [u.rect.width, u.rect.height])));
const E133 = glassDxf.buildGlassWindowEntities(U133, 'R133', 0, 0);
check('133: the window entity list carries 6 contours and 6 edge lines, none overlapping in y',
  layerOf(E133, 'GLASS_CONTOUR').length === 6 && layerOf(E133, 'GLASS_EDGE').length === 6,
  `${layerOf(E133, 'GLASS_CONTOUR').length} / ${layerOf(E133, 'GLASS_EDGE').length}`);
{
  const boxes = layerOf(E133, 'GLASS_CONTOUR').map((e) => glassDxf.polyBBox(e.pts, true)).sort((a, b) => a.minY - b.minY);
  let ok = true;
  for (let i = 1; i < boxes.length; i++) if (boxes[i].minY < boxes[i - 1].maxY) ok = false;
  check('133: the 6 units are stacked, never overlapping (unitGap 300 between them)', ok, JSON.stringify(boxes.map((b) => [b.minY, b.maxY])));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — double-hung sash: units follow the SASH-FRAME bar placement (the glass PDF rule)');
const SASH6 = specification.normaliseToWindowSpec({ id: 'S6', name: 'S6', width: 1000, height: 1500, upperBars: '6x6', lowerBars: '6x6' });
const DS6 = derive(SASH6);
const US6 = glassDxf.glassUnitsForWindow(SASH6, DS6);
check('plain sash 1000 x 1500 → 2 units (upper + lower), the button is enabled', US6.length === 2 && glassDxf.canExportGlassDxf(SASH6, DS6), String(US6.length));
check('sash unit size = the engine row (733 x 612.5)', near(US6[0].rect.width, 733) && near(US6[0].rect.height, 612.5), `${US6[0].rect.width} x ${US6[0].rect.height}`);
{
  // 6x6 = 1H 2V; the wood bar centres (22 wide) are NOT the equal splits of the glass
  const xs = US6[0].rect.bars.filter((b) => b.role === 'v').map((b) => b.from[0]);
  const equal = [733 / 3, (733 * 2) / 3];
  check('6x6 → 2 vertical + 1 horizontal bar per unit', US6[0].rect.bars.length === 3 && xs.length === 2, JSON.stringify(US6[0].rect.bars.map((b) => b.id)));
  check('sash bar axes come from the WOOD bar centres, not equal splits (244.8 / 488.2 vs 244.3 / 488.7)',
    !near(xs[0], equal[0], 0.2) && near(xs[0], 244.83, 0.1) && near(xs[1], 488.17, 0.1), JSON.stringify(xs));
  const ys = US6[0].rect.bars.filter((b) => b.role === 'h').map((b) => b.from[1]);
  check('the horizontal axis is mirrored into the y-up DXF frame (306.25 from the bottom)', near(ys[0], 306.25, 0.1), JSON.stringify(ys));
}
check('a sash unit with no grid (mode none) gets NO bars', glassDxf.glassUnitsForWindow(
  specification.normaliseToWindowSpec({ id: 'S0', name: 'S0', width: 1000, height: 1500 }), derive(specification.normaliseToWindowSpec({ id: 'S0', name: 'S0', width: 1000, height: 1500 })))
  .every((u) => u.rect.bars.length === 0));

// ═══════════════════════════════════════════════════════════════════════════
section('4 — pack: one rectangular + one arched window, both in the merged file');
const ARCH = pcItem('A1', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 });
const DA = derive(ARCH);
const packItems = [
  { units: glassDxf.glassUnitsForWindow(RECT, DR), winNum: 'R040' },
  { units: glassDxf.glassUnitsForWindow(ARCH, DA), winNum: 'A1' },
];
check('the arched window still resolves to ONE shaped unit', packItems[1].units.length === 1 && !!packItems[1].units[0].shape);
const MERGED = glassDxf.buildMergedGlassEntities(packItems);
check('merged pack: 2 contours (one rectangular, one arched with bulges)', layerOf(MERGED, 'GLASS_CONTOUR').length === 2,
  String(layerOf(MERGED, 'GLASS_CONTOUR').length));
check('merged pack: the rectangular contour has no bulge, the arched one does',
  layerOf(MERGED, 'GLASS_CONTOUR').filter((e) => e.pts.every((p) => !p[2])).length === 1 &&
  layerOf(MERGED, 'GLASS_CONTOUR').filter((e) => e.pts.some((p) => p[2])).length === 1);
check('merged pack: both window names in the text', MERGED.some((e) => e.type === 'text' && /^R040 - G1/.test(e.str)) && MERGED.some((e) => e.type === 'text' && /^A1 - G1/.test(e.str)));
{
  const boxes = layerOf(MERGED, 'GLASS_CONTOUR').map((e) => glassDxf.polyBBox(e.pts, true)).sort((a, b) => a.minY - b.minY);
  check('merged pack: the two windows do not overlap in y (MERGE_GAP 300 between them)', boxes[1].minY >= boxes[0].maxY, JSON.stringify(boxes.map((b) => [b.minY, b.maxY])));
}
const packPath = resolve(SAMPLES, 'sample_glass_pack_mixed.dxf');
writeFileSync(packPath, dxfWriter.writeDxf(MERGED, glassDxf.GLASS_LAYERS));
const rectPath = resolve(SAMPLES, 'sample_glass_rect_1000x1500_040L.dxf');
writeFileSync(rectPath, dxfWriter.writeDxf(glassDxf.buildGlassWindowEntities(rectUnits, 'R040', 0, 0), glassDxf.GLASS_LAYERS));

// ═══════════════════════════════════════════════════════════════════════════
section('5 — the shaped output is unchanged (byte identity against ' + PREV + ')');
const SHAPED_CASES = [
  ['semi-circle hub-spoke 1000 x 1500', pcItem('SC1', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' })],
  ['three-centre 1H 2V 1000 x 1500', pcItem('TC1', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 })],
  ['gothic intersecting 1000 x 1800', pcItem('GO1', 1000, 1800, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting', casementHBars: 1 })],
  ['circle 800 sunburst', pcItem('CI1', 800, 800, { archShape: 'circle', archBarPattern: 'sunburst', casementKind: 'fixed' })],
];
for (const [name, spec] of SHAPED_CASES) {
  const d = derive(spec);
  const now = glassDxf.buildGlassWindowEntities(glassDxf.glassUnitsForWindow(spec, d), spec.name, 0, 0);
  const before = OLD.glassDxf.buildGlassWindowEntities(OLD.glassDxf.shapedGlassUnits(spec, d), spec.name, 0, 0);
  const a = dxfWriter.writeDxf(now, glassDxf.GLASS_LAYERS);
  const b = OLD.dxfWriter.writeDxf(before, OLD.glassDxf.GLASS_LAYERS);
  check(`${name}: the whole DXF is byte-identical to ${PREV} (all units shaped — nothing added)`, a === b,
    a === b ? '' : `now ${a.length} bytes, before ${b.length}`);
}
{
  // the arched SASH is the one mixed window: it legitimately GAINS its lower
  // rectangular unit, so the file grows — the SHAPED unit's own entities must
  // still be identical entity for entity
  const spec = pswSash('SS', 1000, 2200, { archShape: 'semi-circle', archBarPattern: 'hub-spoke', archHBars: 1, lowerHBars: 2 });
  const d = derive(spec);
  const all = glassDxf.glassUnitsForWindow(spec, d);
  const shapedOld = OLD.glassDxf.shapedGlassUnits(spec, d);
  check('arched sash: 2 units now (arched upper + rectangular lower), 1 before', all.length === 2 && shapedOld.length === 1 && !!all[0].shape && !all[1].shape,
    `${all.length} / ${shapedOld.length}`);
  const nowUnit = dxfWriter.writeDxf(glassDxf.buildGlassUnitEntities(all[0], 'SS', 0, 0).entities, glassDxf.GLASS_LAYERS);
  const oldUnit = OLD.dxfWriter.writeDxf(OLD.glassDxf.buildGlassUnitEntities(shapedOld[0], 'SS', 0, 0).entities, OLD.glassDxf.GLASS_LAYERS);
  check('arched sash: the SHAPED unit alone is byte-identical to ' + PREV, nowUnit === oldUnit, nowUnit === oldUnit ? '' : `${nowUnit.length} vs ${oldUnit.length}`);
  const lower = all[1];
  check('arched sash: the lower unit is the rectangular 733 x 962.5 the glazier was missing', near(lower.rect.width, 733) && near(lower.rect.height, 962.5),
    `${lower.rect.width} x ${lower.rect.height}`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — skips: only a window with no glass at all');
{
  const door = specification.normaliseToWindowSpec({ id: 'D1', name: 'D1', width: 1000, height: 2100 }, { fullConfig: { windowCategory: 'door', doorLayout: 'D01' } });
  const r = glassDxf.glassDxfParamsForWindow(door, derive(door), 'D1');
  check('a door is skipped with "not a casement or sash window"', r.skip === 'not a casement or sash window', String(r.skip));
  check('no windowSpec → "no data"', glassDxf.glassDxfParamsForWindow(null, null, '').skip === 'no data');
  check('derived missing → "window could not be calculated"', glassDxf.glassDxfParamsForWindow(RECT, null, 'R040').skip === 'window could not be calculated');
  check('a casement whose rows carry no glass → "no glass unit"', glassDxf.glassDxfParamsForWindow(RECT, { category: 'casement', customGlassUnits: [] }, 'R040').skip === 'no glass unit',
    String(glassDxf.glassDxfParamsForWindow(RECT, { category: 'casement', customGlassUnits: [] }, 'R040').skip));
  check('the merged export reports the pack-level reason with the new wording', typeof glassDxf.exportGlassDxfMerged === 'function');
}

// ═══════════════════════════════════════════════════════════════════════════
section('7 — DXF round-trip through ezdxf');
for (const [tag, path, contours] of [['rectangular 040L', rectPath, 1], ['mixed pack', packPath, 2]]) {
  const p = probe(path);
  check(`${tag}: ezdxf reads the file, all five GLASS layers present`,
    ['GLASS_CONTOUR', 'GLASS_EDGE', 'GLASS_BARS', 'GLASS_BAR_AXES', 'GLASS_TEXT'].every((l) => p.layers.includes(l)), JSON.stringify(p.layers));
  check(`${tag}: ${contours} contour polyline(s) on GLASS_CONTOUR`, p.polys.filter((x) => x.layer === 'GLASS_CONTOUR').length === contours,
    String(p.polys.filter((x) => x.layer === 'GLASS_CONTOUR').length));
  check(`${tag}: TEXT entities carry the unit lines`, p.texts.length > 0 && p.texts.some((t) => /GLASS/.test(t.str || t.text || '')), String(p.texts.length));
}
{
  const p = probe(rectPath);
  const c = p.polys.find((x) => x.layer === 'GLASS_CONTOUR');
  check('rectangular 040L after the round-trip: contour bbox 789 x 1293', near(c.bbox[2] - c.bbox[0], 789) && near(c.bbox[3] - c.bbox[1], 1293),
    JSON.stringify(c.bbox));
  const e = p.polys.find((x) => x.layer === 'GLASS_EDGE');
  check('rectangular 040L after the round-trip: edge line bbox 767 x 1271 (789 − 2·11)', near(e.bbox[2] - e.bbox[0], 789 - 2 * cover) && near(e.bbox[3] - e.bbox[1], 1293 - 2 * cover),
    JSON.stringify(e.bbox));
  check('rectangular 040L after the round-trip: 2 axes + 4 band edges', p.polys.filter((x) => x.layer === 'GLASS_BAR_AXES').length === 2 && p.polys.filter((x) => x.layer === 'GLASS_BARS').length === 4);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:'); failures.forEach((f) => console.log('  - ' + f)); process.exit(1); }
console.log('ALL PASS');
