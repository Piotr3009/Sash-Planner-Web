/**
 * t19_baseline — writes verify/arch/fixtures/rect-casement-sheets.json: the
 * four casement sheets rendered for the rectangular fixtures (rect-casement-
 * base.json) from a git tree, BEFORE the arched-casement-v2 night-4 sheet
 * work. t19 re-renders the same windows from the live src and requires the
 * SVG strings to be byte-identical (spec v2 §4 D "snapshot test").
 *
 * Run: node verify/arch/t19_baseline.mjs [git-ref]   (default: HEAD)
 * The tree is taken with `git archive <ref> src` into .audit/<ref>-tree/.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, AUDIT, bundleTree, renderSheets, deriveItem } from './lib/sheets.mjs';

const ref = process.argv[2] || 'HEAD';
const tag = `baseline-${ref.replace(/[^\w.-]+/g, '_')}`;
const tree = resolve(AUDIT, `${tag}-tree`);
rmSync(tree, { recursive: true, force: true });
mkdirSync(tree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${ref} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });
const commit = execFileSync('git', ['rev-parse', ref], { cwd: ROOT, encoding: 'utf8' }).trim();

const M = await bundleTree(resolve(tree, 'src'), tag);
const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-base.json'), 'utf8'));
const out = { commit, ref, generated: new Date().toISOString().slice(0, 10), sheets: {} };
for (const [name, c] of Object.entries(FX)) {
  const { spec, derived } = deriveItem(M, { id: 'fx_' + name, width: c.input.width, height: c.input.height, name }, { windowCategory: 'casement', ...c.input.fc });
  out.sheets[name] = renderSheets(M, spec, derived);
  const n = 2 + out.sheets[name].leaf.length + out.sheets[name].glass.length;
  console.log(`${name} ${c.input.fc.casementLayout}: ${n} sheets, ${JSON.stringify(out.sheets[name]).length} bytes`);
}
const file = resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-sheets.json');
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`wrote ${file} from ${ref} (${commit.slice(0, 7)})`);
