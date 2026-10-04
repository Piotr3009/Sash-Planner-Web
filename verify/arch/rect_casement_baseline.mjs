/**
 * rect_casement_baseline — re-baselines verify/arch/fixtures/rect-casement-
 * base.json (derived / cut list / glass rows of the four rectangular casement
 * fixtures, consumed by t18 §3 and t20) from the LIVE src tree.
 *
 * ARCHED-WINDOWS-v4 Block F (frame face 57 → 68) changes every rectangular
 * casement by design, so the origin/main snapshot is replaced. The inputs are
 * kept; for every fixture the old and new leaf sizes are printed next to the
 * profile formula (leafW = W − 2·leafAtJamb, leafH = H − leafFullHeight) so
 * BUILD-LOG can quote them.
 *
 * 02.10.2026 (glass 1mm smaller all round, glassInset 12.5 → 11.5): re-run for
 * the glass numbers. The bar-grid keys added on 21.09 (leaves[i].bars,
 * customGlassUnits[i].bars, glass row barAxes) are stripped before writing,
 * exactly as t18 §3 / t20 strip them from the live derived — the fixture keeps
 * its pre-21.09 shape and those keys stay guarded by t33_bar_grid.mjs. The old
 * and new glass unit sizes are printed per fixture.
 *
 * 04.10.2026 (espag lock ladder = the BJ Waller card: 350–490 … 1260–1520,
 * ids c_lock_350 … c_lock_1260): re-run for the lock slot ids in
 * derived.casement.hardware. The old and new lock picks are printed per
 * fixture; nothing else may move (verify/parity/t35_locks.mjs asserts the
 * picks themselves).
 *
 * Run: node verify/arch/rect_casement_baseline.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, bundleTree, deriveItem } from './lib/sheets.mjs';

const M = await bundleTree(resolve(ROOT, 'src'), 'baseline-live');
const P = M.profile.DEFAULT_CASEMENT_PROFILE;
const file = resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-base.json');
const FX = JSON.parse(readFileSync(file, 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
console.log(`profile: frameHead ${P.elements.frameHead.face}, land ${P.geometry.land}, leafAtJamb ${P.deductions.leafAtJamb}, leafFullHeight ${P.deductions.leafFullHeight}, fanFromAxis ${P.deductions.fanFromAxis}`);
for (const [name, c] of Object.entries(FX)) {
  const { spec, derived } = deriveItem(M, { id: 'fx_' + name, width: c.input.width, height: c.input.height, name }, { windowCategory: 'casement', ...c.input.fc });
  const cut = M.lists.buildCutListForWindow(derived, spec);
  const glass = M.lists.buildGlassListForWindow(derived, spec);
  const oldLeaf = c.derived.casement?.leaves?.[0] || c.derived.casement?.leafSizes?.[0] || null;
  const newLeaf = derived.casement?.leaves?.[0] || derived.casement?.leafSizes?.[0] || null;
  const W = c.input.width, H = c.input.height;
  const fW = W - 2 * P.deductions.leafAtJamb, fH = H - P.deductions.leafFullHeight;
  console.log(`${name} ${c.input.fc.casementLayout} ${W} × ${H}: leaf old ${JSON.stringify(oldLeaf)} → new ${JSON.stringify(newLeaf)}; single-leaf formula ${W} − 2·${P.deductions.leafAtJamb} = ${fW}, ${H} − ${P.deductions.leafFullHeight} = ${fH}`);
  const oldUnits = (c.derived.customGlassUnits || []).map((u) => `${u.width}×${u.height}`).join(', ');
  const newUnits = (derived.customGlassUnits || []).map((u) => `${u.width}×${u.height}`).join(', ');
  console.log(`   glass units old ${oldUnits} → new ${newUnits} (glassInset ${P.geometry.glassInset})`);
  const locks = (d) => (d.casement?.hardware?.lockPicks || []).map((k) => (k ? `${k.slotId}${k.handing ? ' ' + k.handing : ' top'} @${k.dim}${k.overLimit ? ' !' : ''}` : 'fixed')).join(', ');
  console.log(`   locks old ${locks(c.derived)} → new ${locks(derived)}`);
  const stripped = JSON.parse(JSON.stringify(derived));
  (stripped.casement?.leaves || []).forEach((l) => { delete l.bars; });
  (stripped.customGlassUnits || []).forEach((u) => { delete u.bars; });
  const glassRows = glass.map((r) => { const o = { ...r }; delete o.barAxes; return o; });
  FX[name] = { input: c.input, derived: stripped, cut, glass: glassRows };
}
writeFileSync(file, JSON.stringify(FX));
console.log(`wrote ${file} from the live tree at ${commit.slice(0, 7)}`);
