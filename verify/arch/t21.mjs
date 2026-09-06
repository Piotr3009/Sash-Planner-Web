/**
 * t21 — ARCHED-WINDOWS-v3 Block 1 A–E harness: the arched SASH, engine side.
 *
 * Real data path: PSW `arched-group` item / PC `frameShape 'arched'` item →
 * normaliseToWindowSpec → deriveWindowData → lists. Reference numbers: closed
 * forms on the profile (head 80, sashWidth 178 → inset 89, topRail 57, rebate
 * 12.5, meeting rail 43) and PSW price-calculator.js (RISE_RATIO, MIN_STRAIGHT
 * 900, MIN_UPPER_STILE 100, minHeightFor).
 *
 * Sections: 1 geometry vectors W 1000 / 1200 / 1500 × (semi-circle, three-centre
 * start, gothic) · 2 PSW parity (rise ratio, minimum height) · 3 import mapping
 * · 4 cut list / BOM · 5 weights vs area formula · 6 rectangular sash
 * JSON-identical (fixture) · 7 structural evidence.
 *
 * Run: node verify/arch/t21.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const ENTRY = resolve(AUDIT, 't21-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as calculations from '../src/engine/calculations.js';",
  "export * as lists from '../src/engine/lists.js';",
  "export * as bom from '../src/engine/bom.js';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 't21-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf',
  `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href);
const { arch, profile, specification, calculations, lists, bom } = M;
const SP = profile.DEFAULT_SASH_PROFILE;
const CP = profile.DEFAULT_CASEMENT_PROFILE;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n== ${t} ==`);
const psw = (id, width, height, fc) => specification.normaliseToWindowSpec({ id, name: id, width, height }, { fullConfig: { windowCategory: 'sash', sashType: 'arched-group', ...fc } });
const pc = (id, width, height, fields) => specification.normaliseToWindowSpec({ id, name: id, width, height, windowCategory: 'sash', frameShape: 'arched', ...fields });
const derive = (spec) => calculations.deriveWindowData(spec, {});

// profile numbers behind the vectors
const HEAD = SP.sashArch.headFace, INSET = SP.deductions.sashWidth / 2, TOP = SP.elements.topRail.face, MEET = SP.elements.meetingRail.face, REB = calculations.CONSTANTS.GLASS_REBATE;
check('profile: sashArch head 80, limits 400 / 1500 / 900 / 100, minHaunchRadius 150; inset 89 = sashWidth 178 / 2; topRail 57; meeting rail 43; rebate 12.5',
  HEAD === 80 && SP.sashArch.limits.minWidth === 400 && SP.sashArch.limits.maxWidth === 1500 && SP.sashArch.limits.minStraightBelowRise === 900 && SP.sashArch.limits.minUpperStile === 100 && SP.sashArch.minHaunchRadius === 150 && INSET === 89 && TOP === 57 && MEET === 43 && REB === 12.5);
check('normalizeSashProfile fills sashArch for a stored profile without it', profile.normalizeSashProfile({ deductions: { sashHeight: 135 }, dedSchema: 2, elements: {} }).sashArch.headFace === 80);

// ═══════════════════════════════════════════════════════════════════════════
section('1 — geometry vectors: W 1000 / 1200 / 1500 × semi-circle / three-centre (start) / gothic');
const V = [];
for (const W of [1000, 1200, 1500]) {
  V.push({ id: `S${W}`, W, H: 2200, f: { archShape: 'semi-circle' }, shape: 'semi-circle', rise: W / 2 });
  V.push({ id: `T${W}`, W, H: 2200, f: { archShape: 'three-centre', archStart: 2200 - Math.round(0.3 * W) }, shape: 'three-centre', rise: Math.round(0.3 * W) });
  V.push({ id: `G${W}`, W, H: 3200, f: { archShape: 'gothic-equilateral' }, shape: 'gothic-equilateral', rise: Math.sqrt(3) / 2 * W });
}
const D = {};
for (const v of V) {
  const spec = pc(v.id, v.W, v.H, v.f);
  let d = null, err = null;
  try { d = derive(spec); } catch (e) { err = e; }
  D[v.id] = { spec, d };
  const tag = `${v.id} ${v.shape} W${v.W} H${v.H}`;
  check(`${tag}: derives (${err ? err.message : 'ok'})`, !!d && !err);
  if (!d) continue;
  const G = d.arch.geometry;
  check(`${tag}: shape, rise ${v.rise.toFixed(1)}, start ${(v.H - v.rise).toFixed(1)}`, G.shape === v.shape && near(G.rise, v.rise, 0.01) && near(G.start, v.H - v.rise, 0.01), `${G.shape} ${G.rise} ${G.start}`);
  check(`${tag}: rings — head 0 → 80, top rail 89 → 146, glass 133.5 (concentric, from the profile)`, G.offsets.headInner === HEAD && G.offsets.sashOuter === INSET && G.offsets.sashInner === INSET + TOP && near(G.offsets.glass, INSET + TOP - REB, 1e-9)
    && G.head.outer.every((a, i) => near(a.r - G.head.inner[i].r, HEAD, 1e-9)) && G.topRail.outer.every((a, i) => near(G.arcs[i].r - a.r, INSET, 1e-9)) && G.glass.arcs.every((a, i) => near(G.arcs[i].r - a.r, INSET + TOP - REB, 1e-9)));
  check(`${tag}: rule C — every chain starts vertical at the stile line (x = ±(W/2 − offset), y = 0)`, [G.head.inner, G.topRail.outer, G.topRail.inner, G.glass.arcs].every((chain) => { const s = arch.arcPoint(chain[0], chain[0].a0), e = arch.arcPoint(chain[chain.length - 1], chain[chain.length - 1].a1); return near(s[1], 0, 1e-9) && near(e[1], 0, 1e-9) && near(s[0], -e[0], 1e-9); }));
  if (v.shape === 'semi-circle') {
    const R = v.W / 2;
    check(`${tag}: closed forms — S-AH centre π·(R − 40) = ${(Math.PI * (R - 40)).toFixed(1)}, S-ATR centre π·(R − 89 − 28.5) = ${(Math.PI * (R - INSET - TOP / 2)).toFixed(1)}, glass R ${R - 133.5}`, near(G.head.lengths.centre, Math.PI * (R - HEAD / 2), 0.01) && near(G.topRail.lengths.centre, Math.PI * (R - INSET - TOP / 2), 0.01) && near(G.glass.arcs[0].r, R - (INSET + TOP - REB), 1e-9));
  }
  check(`${tag}: upper stile — clear H/2 − rise = ${(v.H / 2 - v.rise).toFixed(1)} ≥ 100, piece + MR/2 = ${(v.H / 2 - v.rise + MEET / 2).toFixed(1)}`, near(G.upperStileClear, v.H / 2 - v.rise, 0.01) && G.upperStileClear >= 100 && near(G.upperStraightStile, v.H / 2 - v.rise + MEET / 2, 0.01));
  const O = d.arch.glassOutline;
  check(`${tag}: upper glass unit: width W − 267 = ${v.W - 267}, springing = stile clear − 21.5 + 12.5, apex = springing + glass rise`, near(O.width, v.W - 2 * (INSET + TOP - REB), 1e-9) && near(O.springing, G.upperStileClear - MEET / 2 + REB, 1e-9) && near(O.apex, O.springing + G.glass.apex, 1e-9));
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — PSW parity: rise ratios, minimum height (price-calculator.js riseFor / minHeightFor)');
{
  const RISE_RATIO = { 'segmental-arch': 0.20, 'elliptical-arch': 0.325, 'semi-circle': 0.5, 'gothic-arch': Math.sqrt(3) / 2 };
  const GOTHIC = { equilateral: Math.sqrt(3) / 2, drop: 0.70, shallow: 0.60 };
  const riseFor = (shape, W, prof) => Math.round((shape === 'gothic-arch' ? (GOTHIC[prof || 'equilateral']) : RISE_RATIO[shape]) * W);
  const minHeightFor = (shape, W, prof) => { const rise = riseFor(shape, W, prof); return Math.ceil(Math.max(rise + 900, 2 * (rise + 100)) / 10) * 10; };
  for (const [shape, prof] of [['semi-circle', null], ['elliptical-arch', null], ['segmental-arch', null], ['gothic-arch', 'equilateral'], ['gothic-arch', 'drop'], ['gothic-arch', 'shallow']]) {
    for (const W of [1000, 1500]) {
      const spec = psw(`P-${shape}-${prof}-${W}`, W, 3000, { archShape: shape, archProfile: prof });
      check(`PSW ${shape}${prof ? ' / ' + prof : ''} W${W}: rise = ratio × W = ${riseFor(shape, W, prof)} (PSW rounds, PC exact ±0.5)`, near(spec.arch.rise, riseFor(shape, W, prof), 0.5) && spec.arch.riseSource === 'ratio');
      const Hmin = minHeightFor(shape, W, prof);
      let okAt = null, errAt = null, errBelow = null;
      try { derive(psw('m1', W, Hmin, { archShape: shape, archProfile: prof })); okAt = true; } catch (e) { okAt = false; errAt = e; }
      try { derive(psw('m2', W, Hmin - 10, { archShape: shape, archProfile: prof })); } catch (e) { errBelow = e; }
      if (shape === 'segmental-arch') {
        // PSW's segmental default (rise 0.20 W) is NOT buildable as a rule-C sash: the top rail ring sits 146 in and
        // the haunch radius is floored at 150 → the inner ring (r 4) cannot carry the 10 mm allowance band.
        // Readable ArchError, logged in BLOCKERS (sash F2) — the PSW minimum height is moot for that shape.
        check(`  … PSW segmental rise ${riseFor(shape, W, prof)} on a sash → readable ArchError (top rail ring too small for the haunch, sash F2)`, !okAt && errAt instanceof arch.ArchError && /allowance band/.test(errAt.message), errAt ? errAt.message : 'derived');
        continue;
      }
      check(`  … minimum height ${Hmin} derives, ${Hmin - 10} throws a readable ArchError (900 straight / 100 stile)`, okAt && errBelow instanceof arch.ArchError && /(minimum 900|minimum 100)/.test(errBelow.message), errBelow ? errBelow.message : (errAt ? errAt.message : 'no throw'));
    }
  }
  // widths outside PSW MIN / MAX
  let e1 = null, e2 = null;
  try { derive(psw('w1', 390, 2000, { archShape: 'semi-circle' })); } catch (e) { e1 = e; }
  try { derive(psw('w2', 1510, 2400, { archShape: 'semi-circle' })); } catch (e) { e2 = e; }
  check('W 390 → the sash engine\'s own 400 limit (readable Error); W 1510 → ArchError above the maximum 1500 (sash profile, PSW MAX_WIDTH)', e1 && /between 400 and 4000/.test(e1.message) && e2 instanceof arch.ArchError && /above the maximum 1500/.test(e2.message), `${e1?.message} | ${e2?.message}`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — import mapping: PSW sash names (radio + ids), archRise, bars, PC-native');
{
  const a = psw('I1', 1000, 2000, { archShape: 'semicircular' });
  check('radio "semicircular" → semi-circle, rise 500', a.arch.shape === 'semi-circle' && near(a.arch.rise, 500, 1e-9));
  const b = psw('I2', 1000, 2000, { archShape: 'elliptical' });
  check('radio "elliptical" → three-centre, rise 325 (P10)', b.arch.shape === 'three-centre' && near(b.arch.rise, 325, 1e-9));
  const c = psw('I3', 1000, 2000, { archShape: 'segmental' });
  check('radio "segmental" → three-centre, rise 200 (P10)', c.arch.shape === 'three-centre' && near(c.arch.rise, 200, 1e-9));
  const g = psw('I4', 1000, 2200, { archShape: 'gothic', archProfile: 'drop' });
  check('radio "gothic" + profile drop → gothic-drop, rise 700', g.arch.shape === 'gothic-drop' && g.arch.profile === 'drop' && near(g.arch.rise, 700, 1e-9));
  const e = psw('I5', 1000, 2000, { archShape: 'semi-circle', archRise: 500, archBarPattern: 'double-hub-spoke', archHBars: 2, archVBars: 1, lowerHBars: 3, lowerVBars: 2 });
  check('ids + explicit archRise + bars: pattern double-hub-spoke, upper 2H / 1V, lower 3H (lowerVBars ignored), no hinge', e.arch.shape === 'semi-circle' && e.arch.riseSource === 'custom' && e.arch.bars.pattern === 'double-hub-spoke' && e.arch.bars.h === 2 && e.arch.bars.v === 1 && e.arch.lowerHBars === 3 && e.arch.hinge === null && !('lowerVBars' in e.arch));
  const n = pc('I6', 1200, 2400, { archShape: 'three-centre', archStart: 2000, archHBars: 1, lowerHBars: 2 });
  check('PC-native: frameShape arched + archShape three-centre + archStart 2000 → rise 400, custom, lower 2H', n.arch.shape === 'three-centre' && n.arch.rise === 400 && n.arch.riseSource === 'custom' && n.arch.lowerHBars === 2);
  const plain = specification.normaliseToWindowSpec({ id: 'I7', name: 'I7', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash', sashType: 'double', upperBars: '2x2' } });
  check('a plain double-hung sash: arch null', plain.arch === null);
  let bad = null; try { psw('I8', 1000, 2000, { archShape: 'oval' }); } catch (x) { bad = x; }
  check('unknown sash arch shape throws (never a silent rectangle)', bad instanceof arch.ArchError);
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — cut list / BOM: S-AH, S-ATR, stiles + jambs to the springing, head liners gone');
{
  const { d, spec } = D.S1000;
  const G = d.arch.geometry;
  const box = d.components.box, sash = d.components.sash;
  const by = (arr, n) => arr.find((c) => c.elementName === n);
  check('S-ARCH HEAD replaces HEAD: section 80x164 (headFace × box depth), length = head ring centre line', !!by(box, 'S-ARCH HEAD') && !by(box, 'HEAD') && by(box, 'S-ARCH HEAD').section === `${HEAD}x${SP.variants.standard.boxDepth}` && near(by(box, 'S-ARCH HEAD').length, G.head.lengths.centre, 0.05));
  check('jambs = start − (jambHeight 108 − head 80) = start − 28, both sides', near(by(box, 'JAMB LEFT').length, G.start - (SP.deductions.jambHeight - HEAD), 0.05) && near(by(box, 'JAMB RIGHT').length, G.start - (SP.deductions.jambHeight - HEAD), 0.05));
  check('head liners not generated on an arched head (DEFAULT open); jamb liners to the springing; cill unchanged', !by(box, 'INTERNAL HEAD LINER') && !by(box, 'EXTERNAL HEAD LINER') && near(by(box, 'INTERNAL JAMB LINER (L)').length, G.start, 0.05) && by(box, 'CILL').length === 1000);
  check('S-ARCH TOP RAIL replaces TOP RAIL: section 57x57, length = top rail ring centre line, planner notes', !!by(sash, 'S-ARCH TOP RAIL') && !by(sash, 'TOP RAIL') && by(sash, 'S-ARCH TOP RAIL').section === '57x57' && near(by(sash, 'S-ARCH TOP RAIL').length, G.topRail.lengths.centre, 0.05) && /pieces · stock/.test(by(sash, 'S-ARCH TOP RAIL').notes));
  check('STILES TOP (L/R) = upper straight stile (H/2 − rise + 21.5), meeting rails / lower sash unchanged', near(by(sash, 'STILES TOP (L)').length, G.upperStraightStile, 0.05) && near(by(sash, 'STILES TOP (R)').length, G.upperStraightStile, 0.05) && by(sash, 'TOP MEET RAIL').length === d.sashWidth && by(sash, 'STILES BOTTOM SASH (L)').length === Math.round(d.bottomSashHeight * 100) / 100 && by(sash, 'BOTTOM RAIL').length === d.sashWidth);
  const cut = lists.buildCutListForWindow(d, spec).map((r) => ({ ...r, windowName: 'S1000' }));
  const groups = lists.buildGroupedCutList(cut);
  check('grouped cut list: S-AH after the HEAD slot, S-ATR after TR, no "?" group', groups.map((x) => x.symbol).join(' ').startsWith('S-AH JB-L/R IL-L/R EL-L/R SILL CNOS ST-L/R SBS-L/R S-ATR TMR BMR BR') && !groups.some((x) => x.symbol === '?'), groups.map((x) => x.symbol).join(' '));
  check('BOM slots: S-ARCH HEAD → head, S-ARCH TOP RAIL → top_rail', bom.ELEMENT_TO_PART_ID['S-ARCH HEAD'] === 'head' && bom.ELEMENT_TO_PART_ID['S-ARCH TOP RAIL'] === 'top_rail');
  // v4 Block C: the 1000 semi-circle box head (80 face) is BLOCKED by the 400 shorter-edge limit (3 × 180 → 395.5 — BLOCKERS); the top rail plans; the 1200 head plans
  check('plans (v4): S1000 box head blocked honestly (below minimum length, shorter edge 395.5 < 400), S1000 top rail 2 × 180, S1200 head + top rail planned with the casement arch / cnc blocks', d.arch.plans.head.noStock && d.arch.plans.head.noStockReason === 'below minimum length' && /shorter edge 395(\.\d)? < 400/.test(d.arch.plans.head.reasons[0]) && d.arch.plans.topRail.totalPieces === 2 && !d.arch.plans.topRail.noStock
    && D.S1200.d.arch.plans.head.totalPieces > 0 && !D.S1200.d.arch.plans.head.noStock && !D.S1200.d.arch.plans.topRail.noStock && d.arch.plans.head.contourAllowance === CP.arch.contourAllowance && d.arch.plans.head.minClampLength === CP.cnc.minClampLength, d.arch.plans.head.reasons.join(' | '));
  // horns: added to the upper stile as before
  const h = derive(psw('H1', 1000, 2200, { archShape: 'semi-circle', horns: 'traditional', hornType: 'traditional' }));
  check('horns: STILES TOP = straight stile + hornExtension 70', near(h.components.sash.find((c) => c.elementName === 'STILES TOP (L)').length, h.arch.geometry.upperStraightStile + 70, 0.05));
  // glass rows: upper arched + lower rectangular
  const rows = lists.buildGlassListForWindow(d, spec);
  check('glass rows: upper (shape arched, W − 267 wide) + lower (rect: sash − 89 × lower − 108)', rows.length === 2 && rows[0].location === 'upper' && rows[0].shape?.kind === 'arched' && near(rows[0].width, 1000 - 267, 0.05) && rows[1].location === 'lower' && !rows[1].shape && near(rows[1].width, d.sashWidth - 89, 0.05) && near(rows[1].height, d.bottomSashHeight - 108, 0.05), JSON.stringify(rows.map((r) => [r.location, r.width, r.height])));
  // bars: upper straight + pattern on the upper outline, lower h only
  const b = derive(psw('B1', 1000, 2200, { archShape: 'semi-circle', archBarPattern: 'hub-spoke', archHBars: 1, lowerHBars: 2 }));
  check('bars: hub-spoke on the upper unit (7) + 1 h below the springing; lower 2 h positions = thirds of the lower daylight', b.arch.bars.length === 8 && b.arch.bars.filter((x) => x.role === 'h').length === 1 && b.arch.lowerBars.h === 2 && b.arch.lowerBars.positions.length === 2 && near(b.arch.lowerBars.positions[0] * 3, b.arch.lowerBars.glassH, 0.2));
  // beading: frozen module — the rectangular records stay (gap logged)
  check('beading records: the rectangular set (frozen module, no bars → 5 records), unchanged names — curved beads NOT generated (BLOCKERS)', d.components.beading.length === 5 && d.components.beading.some((r) => r.elementName === 'PARTING BEADING') && d.components.beading.some((r) => r.elementName === 'STAFF BEADING'));
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — weights from the true outline (balance / cord), paint from the true frame area');
{
  const { d } = D.S1000;
  const G = d.arch.geometry, O = d.arch.glassOutline;
  const sd = SP.variants.standard.sashDepth;
  const kg = (face) => profile.kgPerM(face, sd);
  const upperTimber = 2 * G.upperStraightStile / 1000 * kg(SP.elements.stiles.face) + G.topRail.lengths.centre / 1000 * kg(TOP) + d.sashWidth / 1000 * kg(MEET);
  const R = O.arcs[0].r;
  const areaClosed = O.width * O.springing + Math.PI * R * R / 2;
  check(`upper glass area = Wg × springing + π R² / 2 = ${(areaClosed / 1e6).toFixed(4)} m² (closed form, semi-circle)`, near(O.area, areaClosed, 0.01) && near(d.weights.upperGlassArea, Math.round(areaClosed / 1e6 * 100) / 100, 1e-9));
  check('upperKg = (stiles + arched top rail + meeting rail + glass area × 21) × 1.05', near(d.weights.upperKg, Math.round((upperTimber + areaClosed / 1e6 * 21) * 1.05 * 100) / 100, 0.011), `${d.weights.upperKg}`);
  const lowerTimber = 2 * d.bottomSashHeight / 1000 * kg(SP.elements.stiles.face) + d.sashWidth / 1000 * kg(SP.elements.bottomRail.face) + d.sashWidth / 1000 * kg(MEET);
  const lowerGlass = (d.sashWidth - 2 * 57) * (d.bottomSashHeight - MEET - 90) / 1e6 * 21;
  check('lowerKg = the rectangular lower sash (stiles + bottom rail + meeting rail + daylight glass) × 1.05', near(d.weights.lowerKg, Math.round((lowerTimber + lowerGlass) * 1.05 * 100) / 100, 0.011));
  check('total = (timber + glass) × 1.05; not the bounding box: upper glass < Wg × apex', near(d.weights.total, Math.round((upperTimber + lowerTimber + areaClosed / 1e6 * 21 + lowerGlass) * 1.05 * 100) / 100, 0.02) && O.area < O.width * O.height);
  check('paint area = (W × start + arch area) / 1e6', near(d.paint.areaSqm, Math.round((1000 * G.start + arch.chainAreaAboveLine(G.arcs)) / 1e6 * 100) / 100, 1e-9));
  check('seal 6070 from the upper sash true perimeter (equivalent height), cord 3 × H unchanged', d.consumables.seal6070.meters > 0 && near(d.consumables.cord.meters, 3 * 2200 / 1000, 1e-9));
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — rectangular sash: derived / cut / glass / precut JSON-identical to the HEAD fixture');
{
  const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-base.json'), 'utf8'));
  for (const [name, c] of Object.entries(FX)) {
    const spec = specification.normaliseToWindowSpec({ id: 'fx_' + name, name, width: c.input.width, height: c.input.height }, { fullConfig: c.input.fc });
    const d = derive(spec);
    check(`rectangular ${name}: identical, no arch key`, JSON.stringify(d) === JSON.stringify(c.derived) && JSON.stringify(lists.buildCutListForWindow(d, spec)) === JSON.stringify(c.cut) && JSON.stringify(lists.buildGlassListForWindow(d, spec)) === JSON.stringify(c.glass) && JSON.stringify(lists.buildPrecutForWindow(d, spec, {})) === JSON.stringify(c.precut) && !('arch' in d));
  }
  // triple sash ignores the arched flag (not in scope): derived identical to a plain triple
  const t1 = specification.normaliseToWindowSpec({ id: 't', name: 't', width: 1800, height: 2000 }, { fullConfig: { windowCategory: 'sash', sashType: 'triple', upperBars: '2x2', lowerBars: '2x2' } });
  const t2 = specification.normaliseToWindowSpec({ id: 't', name: 't', width: 1800, height: 2000, frameShape: 'arched', archShape: 'semi-circle' }, { fullConfig: { windowCategory: 'sash', sashType: 'triple', upperBars: '2x2', lowerBars: '2x2' } });
  check('triple sash with an arched flag: engine output identical to the plain triple (arch not applied to triples)', JSON.stringify(derive(t1)) === JSON.stringify(derive(t2)));
}

// ═══════════════════════════════════════════════════════════════════════════
section('7 — structural evidence (grep): store whitelist, configurator, cut list order');
{
  const store = readFileSync(resolve(ROOT, 'src', 'stores', 'projectStore.js'), 'utf8');
  const conf = readFileSync(resolve(ROOT, 'src', 'pages', 'ConfiguratorPage.jsx'), 'utf8');
  check('projectStore whitelist: frameShape, archHBars, archVBars, lowerHBars (create + update)', ['frameShape: windowConfig.frameShape', 'archHBars: windowConfig.archHBars', 'archVBars: windowConfig.archVBars', 'lowerHBars: windowConfig.lowerHBars'].every((k) => (store.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 2));
  check('ConfiguratorPage: sash Frame shape Standard | Arched, shared arch controls, upper h/v + lower h counts, pattern chips, save fields', conf.includes('SASH_FRAME_SHAPES') && conf.includes('const archControls') && conf.includes('Upper sash — horizontal') && conf.includes('Lower sash — horizontal') && conf.includes("frameShape: isArchedSash ? 'arched' : 'standard'") && conf.includes('buildSashArchGeometry'));
  check('CUT_LIST_ORDER: S-ARCH HEAD right after HEAD, S-ARCH TOP RAIL after TOP RAIL', (() => { const m = lists.CUT_LIST_ORDER.map((x) => x.match); return m.indexOf('S-ARCH HEAD') === m.indexOf('HEAD') + 1 && m.indexOf('S-ARCH TOP RAIL') === m.indexOf('TOP RAIL') + 1; })());
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
