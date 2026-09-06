/**
 * t22_baseline — render the SASH sheets (elevation, box, upper / lower sash, upper / lower glass, vertical
 * section) of the rectangular sash fixture windows from a given source tree and write the SVG strings to
 * verify/arch/fixtures/rect-sash-sheets.json. Run BEFORE the sheets are touched (Block 1 H), then t22 §1
 * asserts byte identity. Usage: node verify/arch/t22_baseline.mjs [srcRoot]
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bundleSashTree, renderSashSheets, ROOT } from './lib/sashSheets.mjs';

const srcRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'src');
const M = await bundleSashTree(srcRoot, 't22-baseline');
const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-base.json'), 'utf8'));
const out = {};
for (const [name, c] of Object.entries(FX)) {
  const spec = M.specification.normaliseToWindowSpec({ id: 'fx_' + name, name, width: c.input.width, height: c.input.height }, { fullConfig: c.input.fc });
  const derived = M.calculations.deriveWindowData(spec, {});
  out[name] = renderSashSheets(M, spec, derived);
}
const path = resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-sheets.json');
writeFileSync(path, JSON.stringify(out));
console.log(`wrote ${path}: ${Object.keys(out).length} windows, ${Object.values(out).reduce((n, s) => n + Object.keys(s).length, 0)} sheets`);
