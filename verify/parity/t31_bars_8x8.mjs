/**
 * t31 — the 8×8 sash bar pattern (Piotr 07.09: "4 panes over 4 on one sash").
 *
 * PC names a pattern by the PANES PER SASH, so 8×8 = 4 across × 2 rows = 3 vertical + 1 horizontal
 * bar. The pattern table is duplicated in ten files (engine, pricing, 3D, three 2D sheets, glass PDF
 * and DXF, two configurators); this harness is the guard that they still agree — a pattern that
 * exists in the configurator but not in, say, the DXF writer silently draws the wrong window.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { if (ok) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}${d ? `  — ${d}` : ''}`); } };

const AUDIT = resolve(ROOT, '.audit');
const bundle = (rel, out) => { execFileSync('npx', ['esbuild@0.25.0', '--bundle', resolve(ROOT, rel), '--format=esm', `--outfile=${resolve(AUDIT, out)}`], { stdio: 'pipe' }); return resolve(AUDIT, out); };
const S = await import(bundle('src/engine/specification.js', 't31_spec.mjs'));
const C = await import(bundle('src/engine/calculations.js', 't31_calc.mjs'));
const L = await import(bundle('src/engine/lists.js', 't31_lists.mjs'));

const derive = (pattern) => {
  const it = { name: 'S1', width: 1000, height: 1800, windowCategory: 'sash', sashType: 'double', upperBars: pattern, lowerBars: pattern, sameBars: true, glassType: 'double', frameType: 'standard', hornType: 'A' };
  const spec = S.normaliseToWindowSpec({ ...it, fullConfig: it });
  return { spec, derived: C.deriveWindowData(spec) };
};

console.log('== 1 — engine: 8×8 = 3 vertical + 1 horizontal bar, evenly spaced, in BOTH sashes ==');
const { spec, derived } = derive('8x8');
const v = derived.barPositions.vertical, h = derived.barPositions.horizontal;
check('3 vertical bars', v.length === 3, JSON.stringify(v));
check('1 horizontal bar per sash', h.length === 1, JSON.stringify(h));
{
  // independent expectation from the engine rule (calculateGlazingBars): the positions divide
  // availableWidth = sashWidth − 2 × stile into verticalBars + 1 equal parts. Sash 822, stile 57 →
  // 708 of bar-line width, four lights of 177. (The GLASS is wider — 733 — because it sits in the
  // rebate; the bar lines are set out on the sash face, not on the glass.)
  const daylight = derived.sashWidth - 2 * derived.sashDims.stile;
  const step = daylight / 4;
  const expected = [1, 2, 3].map((i) => i * step);
  check(`vertical bars at the quarter lines of the daylight ${Math.round(daylight)} → ${expected.map((x) => x.toFixed(1)).join(' / ')}`,
    v.length === 3 && v.every((x, i) => Math.abs(x - expected[i]) <= 0.6), v.map((x) => x.toFixed(1)).join(' / '));
  check('the four lights are equal', Math.abs((v[1] - v[0]) - (v[2] - v[1])) < 0.01 && Math.abs(v[0] - (daylight - v[2])) < 0.6);
}
{
  const rows = L.buildGlassListForWindow(derived, spec);
  const items = rows.items || rows;
  check('both sashes are listed with their own glass', Array.isArray(items) && items.length >= 2, `${Array.isArray(items) ? items.length : typeof items} rows`);
}

console.log('== 2 — 8×8 sits between 6×6 and 9×9 on every count ==');
const counts = (p) => { const d = derive(p).derived; return d.barPositions.vertical.length + d.barPositions.horizontal.length; };
check('6×6 → 3 bars, 8×8 → 4 bars, 9×9 → 4 bars', counts('6x6') === 3 && counts('8x8') === 4 && counts('9x9') === 4, `${counts('6x6')} / ${counts('8x8')} / ${counts('9x9')}`);

console.log('== 3 — every table that knows the pattern vocabulary knows 8×8 ==');
const FILES = [
  ['src/engine/calculations.js', /'8x8':\s*\{[^}]*verticalBars:\s*3[^}]*horizontalBars:\s*1/s],
  ['src/engine/calculations.js', /'8x8':\s*\{\s*v:\s*3,\s*h:\s*1\s*\}/],
  ['src/engine/pricing.js', /'8x8':\s*\d+/],
  ['src/3d/components/ParametricSashWindow.jsx', /'8x8':\s*\{\s*h:\s*1,\s*v:\s*3\s*\}/],
  ['src/components/drawings/GlassDrawing2D.jsx', /'8x8':\s*\{\s*h:\s*1,\s*v:\s*3\s*\}/],
  ['src/components/drawings/SashDetail2D.jsx', /'8x8':\s*\{\s*h:\s*1,\s*v:\s*3\s*\}/],
  ['src/components/drawings/FrontElevation2D.jsx', /'8x8':\s*\{\s*h:\s*1,\s*v:\s*3\s*\}/],
  ['src/utils/glassPdfExport.js', /'8x8':\s*\{\s*h:\s*1,\s*v:\s*3\s*\}/],
  ['src/utils/glassDxfExport.js', /'8x8':\s*\{\s*h:\s*1,\s*v:\s*3\s*\}/],
  ['src/pages/ConfiguratorPage.jsx', /value: '8x8'/],
  ['src/pages/EstimateConfiguratorPage.jsx', /value: '8x8'/],
];
for (const [f, re] of FILES) check(`${f}: 8×8 present with 3 vertical + 1 horizontal`, re.test(read(f)));

console.log('== 4 — no file still lists 9×9 without 8×8 (a missed copy of the table) ==');
{
  const walk = (d, acc = []) => { for (const f of readdirSync(resolve(ROOT, d), { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p, acc); else if (/\.(jsx?|mjs)$/.test(f.name)) acc.push(p); } return acc; };
  const missed = walk('src').filter((f) => /['"]9x9['"]/.test(read(f)) && !/['"]8x8['"]/.test(read(f)));
  check('every file that knows 9×9 also knows 8×8', missed.length === 0, missed.join(' '));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log('ALL PASS');
process.exit(fail ? 1 : 0);
