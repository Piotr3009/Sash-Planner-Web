/**
 * t34 — glass −1 mm per side (Piotr 02.10.2026) + 24.8 mm clips.
 *
 * Bundles the LIVE src and a reference tree (default origin/main) and derives
 * the same windows from both: a sash (standard, 2x2 bars), a casement (040L,
 * 2v/1h), a fixed window and a door. Prints the sealed-unit sizes, the glass
 * m², the clips and the edge cover side by side and asserts the live tree:
 *   sash      units = ref − 2 in W and H (11.5 vs 12.5 each side); m² from
 *             the unit size (clear light + 23) × 2 sashes
 *   casement  units = ref − 2; m² = ref − (the unit area difference)
 *   fixed     same as casement
 *   door      units = ref − 2
 *   edge cover 10 (ref 11) for every glass type; tracery board outset 6.5
 *   clips: laminated / acoustic double → 24.8 (sash '24.8mm', casement
 *          'c_glass_clips_laminated'); single laminated 24; laminated triple 28
 *   migration: a stored schema-1 casement profile (12.5 / 109 / 11) comes out
 *          11.5 / 111 / 10; a hand-edited 12 stays 12; schema 2 is left alone
 *
 * Run: node verify/parity/t34_glass_minus1.mjs [git-ref]   (default origin/main)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, AUDIT, bundleTree, deriveItem } from '../arch/lib/sheets.mjs';

const ref = process.argv[2] || 'origin/main';
const tag = `t34-ref-${ref.replace(/[^\w.-]+/g, '_')}`;
const tree = resolve(AUDIT, `${tag}-tree`);
rmSync(tree, { recursive: true, force: true });
mkdirSync(tree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${ref} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });

const EXTRA = [['bom', 'engine/bom.js'], ['glassBars', 'engine/glassBars.js'], ['tracery', 'engine/cnc/traceryExport.js']];
const LIVE = await bundleTree(resolve(ROOT, 'src'), 't34-live', EXTRA);
const REF = await bundleTree(resolve(tree, 'src'), tag, EXTRA);

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails += 1; };
const near = (a, b, tol = 0.051) => Math.abs(a - b) <= tol;

const WINDOWS = {
  sash: { item: { id: 's', name: 'S', width: 1000, height: 1500 }, fc: { windowCategory: 'sash', frameType: 'standard', upperBars: '2x2', lowerBars: '2x2', horns: 'none' } },
  casement: { item: { id: 'c', name: 'C', width: 1000, height: 1500 }, fc: { windowCategory: 'casement', casementLayout: '040L', casementHBars: 1, casementVBars: 2 } },
  fixed: { item: { id: 'f', name: 'F', width: 1000, height: 1500 }, fc: { windowCategory: 'casement', casementLayout: '040L', casementKind: 'fixed' } },
  door: { item: { id: 'd', name: 'D', width: 1000, height: 2100 }, fc: { windowCategory: 'door', doorType: 'single-external' } },
};

function glassRows(M, spec, derived) {
  return (M.lists.buildGlassListForWindow(derived, spec) || []).map((r) => [Number(r.width), Number(r.height), Number(r.qty || r.quantity || 1)]);
}
function units(M, spec, derived) {
  // sash: glass schedule rows; casement / door: the engine's custom units
  if (derived.category === 'sash') return glassRows(M, spec, derived).map(([w, h]) => [w, h]);
  return (derived.customGlassUnits || []).map((u) => [Number(u.width), Number(u.height)]);
}

for (const [name, W] of Object.entries(WINDOWS)) {
  const L = deriveItem(LIVE, W.item, W.fc);
  const R = deriveItem(REF, W.item, W.fc);
  const uL = units(LIVE, L.spec, L.derived);
  const uR = units(REF, R.spec, R.derived);
  const sqL = L.derived.consumables?.glass?.sqm;
  const sqR = R.derived.consumables?.glass?.sqm;
  console.log(`\n── ${name} (${W.item.width}×${W.item.height}) ──`);
  console.log(`   units ref : ${uR.map(([w, h]) => `${w}×${h}`).join(', ')}`);
  console.log(`   units live: ${uL.map(([w, h]) => `${w}×${h}`).join(', ')}`);
  console.log(`   glass m²  : ref ${sqR} → live ${sqL}`);
  ok(uL.length === uR.length && uL.length > 0, `${name}: same number of units (${uL.length})`);
  uL.forEach(([w, h], i) => ok(near(w, uR[i][0] - 2) && near(h, uR[i][1] - 2), `${name}: unit ${i + 1} ${w}×${h} = ref ${uR[i][0]}×${uR[i][1]} − 2 each way`));
  if (name === 'sash') {
    const f = L.derived.sashDims;
    const clearW = L.derived.sashWidth - 2 * f.stile;
    const clearH = L.derived.topSashHeight - f.topRail - f.meetingRail;
    const expect = Math.round(((clearW + 23) * (clearH + 23)) / 1e6 * 2 * 100) / 100;
    ok(near(sqL, expect, 0.011), `sash: m² ${sqL} = 2 × (${clearW}+23) × (${clearH}+23) / 1e6 = ${expect} (ref ${sqR} from the clear light)`);
    ok(sqL > sqR, `sash: m² now counts the unit, not the clear light (${sqL} > ${sqR})`);
  } else {
    const areaL = uL.reduce((a, [w, h]) => a + w * h, 0) / 1e6;
    const areaR = uR.reduce((a, [w, h]) => a + w * h, 0) / 1e6;
    if (name !== 'door') ok(near(sqL - sqR, areaL - areaR, 0.02), `${name}: m² moved by the unit area (${sqR} → ${sqL})`);
    else ok(sqL < sqR, `door: m² smaller (${sqR} → ${sqL})`);
  }
}

// ── edge cover + tracery outset ──
const PL = LIVE.profile.getCasementProfile();
const PR = REF.profile.getCasementProfile();
for (const t of ['double', 'double_slim', 'triple', 'single', 'passive']) {
  ok(LIVE.glassBars.readGlassProfile(PL, t).edgeCover === 10 && REF.glassBars.readGlassProfile(PR, t).edgeCover === 11, `edge cover ${t}: live 10, ref 11`);
}
ok(PL.geometry.glassInset === 11.5 && PL.deductions.glass === 111 && PL.geometry.glazingRebate === 18, `casement profile: glassInset 11.5, deductions.glass 111, rebate 18`);
ok(LIVE.profile.getDoorProfile().geometry.glassInset === 11.5, `door profile: glassInset 11.5`);
ok(LIVE.calculations.CONSTANTS.GLASS_REBATE === 11.5, `sash CONSTANTS.GLASS_REBATE 11.5`);
ok(PL.geometry.glazingRebate - PL.geometry.glassInset === 6.5, `tracery board outset 6.5 (18 − 11.5)`);

// ── migration of a stored schema-1 profile ──
const stored = JSON.parse(JSON.stringify(PR));           // ref default = exactly what a tenant saved before today
delete stored.glassSchema;
const m1 = LIVE.profile.migrateCasementProfile(stored);
ok(m1.glassSchema === 2 && m1.geometry.glassInset === 11.5 && m1.deductions.glass === 111 && Object.values(m1.glass.edgeCover).every((v) => v === 10),
  `migration: stored 12.5 / 109 / 11 → 11.5 / 111 / 10, glassSchema 2`);
const edited = JSON.parse(JSON.stringify(stored)); edited.geometry.glassInset = 12; edited.glass.edgeCover.triple = 9;
const m2 = LIVE.profile.migrateCasementProfile(edited);
ok(m2.geometry.glassInset === 12 && m2.glass.edgeCover.triple === 9 && m2.glass.edgeCover.double === 10 && m2.deductions.glass === 111,
  `migration: hand-edited 12 / triple 9 kept, untouched keys move`);
const v2 = JSON.parse(JSON.stringify(stored)); v2.glassSchema = 2;
const m3 = LIVE.profile.migrateCasementProfile(v2);
ok(m3.geometry.glassInset === 12.5 && m3.deductions.glass === 109 && m3.glass.edgeCover.double === 11, `migration: a schema-2 copy is left alone (12.5 / 109 / 11 stay)`);

// ── clips ──
const clipsSash = (fc) => {
  const { spec, derived } = deriveItem(LIVE, { id: 's', name: 'S', width: 1000, height: 1500 }, { windowCategory: 'sash', frameType: 'standard', ...fc });
  return [derived.consumables.clips.size, LIVE.bom.CLIP_SIZE_TO_PART_ID[derived.consumables.clips.size]];
};
// casement / fixed: the BOM slot the clips land in (buildWindowPartQtys, no raw resolver needed for clips)
const clipsCas = (fc) => {
  const { spec, derived } = deriveItem(LIVE, { id: 'c', name: 'C', width: 1000, height: 1500 }, { windowCategory: 'casement', casementLayout: '040L', ...fc });
  const q = LIVE.bom.buildWindowPartQtys(derived, spec, {}, () => null);
  return ['c_glass_clips_double', 'c_glass_clips_triple', 'c_glass_clips_laminated'].filter((k) => q[k]?.qty > 0).map((k) => `${k}=${q[k].qty}`).join(',');
};
const sashCases = [
  [{ glassType: 'double', glassSpec: 'toughened' }, '24mm', 'glazing_clips_24mm'],
  [{ glassType: 'double', glassSpec: 'laminated' }, '24.8mm', 'glazing_clips_24_8mm'],
  [{ glassType: 'passive', glassSpec: 'laminated' }, '24.8mm', 'glazing_clips_24_8mm'],
  [{ glassType: 'double', glassSpec: 'acoustic' }, '24.8mm', 'glazing_clips_24_8mm'],
  [{ glassType: 'triple', glassSpec: 'laminated' }, '28mm', 'glazing_clips_28mm'],
  [{ glassType: 'single', glassSpec: 'laminated' }, '24mm', 'glazing_clips_24mm'],
  [{ glassType: 'triple', glassSpec: 'toughened' }, '28mm', 'glazing_clips_28mm'],
];
for (const [fc, size, pid] of sashCases) {
  const [s, p] = clipsSash(fc);
  ok(s === size && p === pid, `sash clips ${fc.glassType}/${fc.glassSpec}: ${s} → ${p}`);
}
ok(LIVE.bom.CLIP_SIZE_TO_PART_ID['24.8mm'] === 'glazing_clips_24_8mm', `bom: 24.8mm → glazing_clips_24_8mm`);
const casCases = [
  [{ glassType: 'double', glassSpec: 'toughened' }, 'c_glass_clips_double'],
  [{ glassType: 'double', glassSpec: 'laminated' }, 'c_glass_clips_laminated'],
  [{ glassType: 'double', glassSpec: 'acoustic' }, 'c_glass_clips_laminated'],
  [{ glassType: 'triple', glassSpec: 'laminated' }, 'c_glass_clips_triple'],
  [{ glassType: 'triple', glassSpec: 'toughened' }, 'c_glass_clips_triple'],
  [{ glassType: 'double', glassSpec: 'toughened', casementKind: 'fixed' }, 'c_glass_clips_double'],
  [{ glassType: 'double', glassSpec: 'laminated', casementKind: 'fixed' }, 'c_glass_clips_laminated'],
];
for (const [fc, pid] of casCases) {
  const got = clipsCas(fc);
  ok(got.startsWith(pid + '=') && !got.includes(','), `casement${fc.casementKind ? ' (fixed)' : ''} clips ${fc.glassType}/${fc.glassSpec}: ${got}`);
}
console.log(`\nbom exports: ${Object.keys(LIVE.bom).join(', ')}`);

console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
