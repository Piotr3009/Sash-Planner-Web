/**
 * rect_sash_baseline — re-baselines verify/arch/fixtures/rect-sash-base.json
 * (derived / cut list / glass rows / pre-cut of the six rectangular sash
 * fixtures, consumed by t21 §6) from the LIVE src tree. The inputs are kept.
 *
 * 02.10.2026 (Piotr): every sealed unit is 1mm smaller all round —
 * CONSTANTS.GLASS_REBATE 12.5 → 11.5 — and the sash glass m² counts the unit
 * instead of the clear light, so the engine snapshot is replaced by design.
 * Before writing, every value that differs between the stored fixture and the
 * live derivation is printed (path: old → new) so the change can be read line
 * by line; anything beyond glass sizes / m² would show up here.
 *
 * Run: node verify/arch/rect_sash_baseline.mjs [--dry]   (--dry: print, don't write)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, bundleTree } from './lib/sheets.mjs';

const dry = process.argv.includes('--dry');
const M = await bundleTree(resolve(ROOT, 'src'), 'sash-baseline-live');
const file = resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-base.json');
const FX = JSON.parse(readFileSync(file, 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

function diff(a, b, path, out) {
  const objA = a && typeof a === 'object', objB = b && typeof b === 'object';
  if (objA !== objB || typeof a !== typeof b) { out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); return; }
  if (objA) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out); }
  else if (a !== b) out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}

console.log(`sash CONSTANTS.GLASS_REBATE = ${M.calculations.CONSTANTS.GLASS_REBATE}`);
let total = 0;
for (const [name, c] of Object.entries(FX)) {
  const spec = M.specification.normaliseToWindowSpec({ id: 'fx_' + name, name, width: c.input.width, height: c.input.height }, { fullConfig: c.input.fc });
  const derived = M.calculations.deriveWindowData(spec, {});
  const next = {
    input: c.input,
    derived,
    cut: M.lists.buildCutListForWindow(derived, spec),
    glass: M.lists.buildGlassListForWindow(derived, spec),
    precut: M.lists.buildPrecutForWindow(derived, spec, {}),
  };
  const out = [];
  diff({ derived: c.derived, cut: c.cut, glass: c.glass, precut: c.precut }, { derived: next.derived, cut: next.cut, glass: next.glass, precut: next.precut }, '', out);
  total += out.length;
  console.log(`\n${name} (${c.input.width} × ${c.input.height}): ${out.length} value(s) differ`);
  out.forEach((l) => console.log('  ' + l));
  FX[name] = next;
}
if (dry) { console.log(`\n--dry: ${total} differences, nothing written`); process.exit(0); }
writeFileSync(file, JSON.stringify(FX));
console.log(`\nwrote ${file} from the live tree at ${commit.slice(0, 7)} (${total} values changed)`);
