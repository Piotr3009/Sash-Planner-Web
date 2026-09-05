/**
 * psw-casement-layouts.mjs — READ-ONLY parity report PSW ↔ PC (Stage 2c of
 * the 06.09 audit).
 *
 * Compares the casement layout definitions and the arched-casement constants
 * that must stay identical between Prime-Sash-Windows (customer configurator)
 * and Production Core, and writes docs/handover/PSW-PARITY-REPORT.md.
 *
 * PSW side (parsed from the source text, never executed as a page):
 *   js/casement-controller.js   LAYOUT_DEFAULTS, CASEMENT_LAYOUTS_VERSION,
 *                               FANLIGHT_LAYOUTS, FAN2_LAYOUTS, TRIPLE_LAYOUTS,
 *                               casArchShape / casArchHinge defaults
 *   js/casement-type-modal.js   HIDDEN_DUPLICATES, DISPLAY_NAMES
 *   js/estimate-renderer.js     static casementLayoutDef(...) — the method body
 *                               is self-contained (no window / this), so it is
 *                               evaluated with new Function and driven with the
 *                               same inputs as the PC port
 *   js/price-calculator.js      window.ArchedSash: RISE_RATIO, GOTHIC_PROFILE_RATIO,
 *                               MIN_WIDTH, MAX_WIDTH, MIN_STRAIGHT, MIN_UPPER_STILE
 *   online-estimate.html        cas-arch-shape radio values, cas-arch-opening
 *                               ids vs values (the reversed hinge)
 * PC side: src/engine/casementLayouts.js, arch.js, profile.js, specification.js
 * bundled with esbuild into .audit/.
 *
 * Usage:  node verify/parity/psw-casement-layouts.mjs [path-to-psw-clone]
 *         (default: ../psw next to the repo, or $PSW_DIR)
 * Exit code 1 only on a HARD difference (codes, panel order, geometry, hinge
 * mapping, version). Documented intentional differences are listed, not fatal.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
const PSW = resolve(process.argv[2] || process.env.PSW_DIR || resolve(ROOT, '..', 'psw'));
const REPORT = resolve(ROOT, 'docs', 'handover', 'PSW-PARITY-REPORT.md');

if (!existsSync(resolve(PSW, 'js', 'casement-controller.js'))) {
  console.error(`PSW clone not found at ${PSW} — clone it read-only first:\n  git -c http.proxyAuthMethod=basic clone --depth 1 https://github.com/Piotr3009/Prime-Sash-Windows.git psw`);
  process.exit(2);
}
const pswRev = (() => { try { return execFileSync('git', ['log', '-1', '--format=%h %ci'], { cwd: PSW, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
const pcRev = execFileSync('git', ['log', '-1', '--format=%h %ci'], { cwd: ROOT, encoding: 'utf8' }).trim();

// ── PC bundle ───────────────────────────────────────────────────────────────
const ENTRY = resolve(AUDIT, 'parity-entry.mjs');
writeFileSync(ENTRY, [
  "export * as layouts from '../src/engine/casementLayouts.js';",
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as specification from '../src/engine/specification.js';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 'parity-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--external:react', '--platform=node', `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const { layouts: PC, arch, profile, specification } = await import(pathToFileURL(BUNDLE).href);
const P = profile.DEFAULT_CASEMENT_PROFILE;

// ── PSW text extraction helpers ─────────────────────────────────────────────
const read = (rel) => readFileSync(resolve(PSW, rel), 'utf8');
function extractObjectLiteral(src, anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor not found: ${anchor}`);
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error(`unbalanced braces after ${anchor}`);
}
const evalLiteral = (txt) => new Function(`return (${txt});`)();
function extractArray(src, anchor) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`anchor not found: ${anchor}`);
  const start = src.indexOf('[', i), end = src.indexOf(']', start);
  return evalLiteral(src.slice(start, end + 1));
}
function extractNumber(src, name) {
  const m = src.match(new RegExp(`var\\s+${name}\\s*=\\s*([0-9.]+)`));
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
}
function extractMethod(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error(`method not found: ${header}`);
  const paren = src.indexOf('(', i);
  let depth = 0, argsEnd = -1;
  for (let j = paren; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')') { depth--; if (depth === 0) { argsEnd = j; break; } } }
  const args = src.slice(paren + 1, argsEnd);
  const bodyStart = src.indexOf('{', argsEnd);
  depth = 0;
  for (let j = bodyStart; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return { args, body: src.slice(bodyStart + 1, j), text: src.slice(i, j + 1) }; }
  }
  throw new Error('unbalanced method body');
}

// ── PSW values ──────────────────────────────────────────────────────────────
const ctrl = read('js/casement-controller.js');
const modal = read('js/casement-type-modal.js');
const renderer = read('js/estimate-renderer.js');
const calc = read('js/price-calculator.js');
const html = read('online-estimate.html');

const psw = {
  LAYOUT_DEFAULTS: evalLiteral(extractObjectLiteral(ctrl, 'const LAYOUT_DEFAULTS =')),
  VERSION: Number((ctrl.match(/window\.CASEMENT_LAYOUTS_VERSION\s*=\s*(\d+)/) || [])[1]),
  FANLIGHT_LAYOUTS: extractArray(ctrl, 'const FANLIGHT_LAYOUTS ='),
  FAN2_LAYOUTS: extractArray(ctrl, 'const FAN2_LAYOUTS ='),
  TRIPLE_LAYOUTS: extractArray(ctrl, 'const TRIPLE_LAYOUTS ='),
  HIDDEN_DUPLICATES: evalLiteral(extractObjectLiteral(modal, 'var HIDDEN_DUPLICATES =')),
  DISPLAY_NAMES: evalLiteral(extractObjectLiteral(modal, 'var DISPLAY_NAMES =')),
  RISE_RATIO: evalLiteral(extractObjectLiteral(calc, 'var RISE_RATIO =')),
  GOTHIC_PROFILE_RATIO: evalLiteral(extractObjectLiteral(calc, 'var GOTHIC_PROFILE_RATIO =')),
  MIN_WIDTH: extractNumber(calc, 'MIN_WIDTH'),
  MAX_WIDTH: extractNumber(calc, 'MAX_WIDTH'),
  MIN_STRAIGHT: extractNumber(calc, 'MIN_STRAIGHT'),
  MIN_UPPER_STILE: extractNumber(calc, 'MIN_UPPER_STILE'),
  archShapeDefault: (ctrl.match(/casArchShape:\s*isArched \? \(checked\('cas-arch-shape'\) \|\| '([^']+)'\)/) || [])[1],
  archHingeDefault: (ctrl.match(/casArchHinge:\s*isArched \? \(checked\('cas-arch-opening'\) \|\| '([^']+)'\)/) || [])[1],
  shapeRadios: [...html.matchAll(/name="cas-arch-shape"\s+value="([^"]+)"/g)].map((m) => m[1]),
  hingeRadios: [...html.matchAll(/id="(cas-arch-open-[a-z]+)"\s+name="cas-arch-opening"\s+value="([^"]+)"/g)].map((m) => ({ id: m[1], value: m[2] })),
};
const method = extractMethod(renderer, 'static casementLayoutDef(');
const leaks = (method.text.match(/\b(window|document|this|EstimateRenderer)\b/g) || []);
const pswLayoutDef = new Function(method.args, method.body);

// ── comparison ──────────────────────────────────────────────────────────────
const rows = [];       // { area, item, status: 'PASS' | 'DIFF' | 'HARD', pc, psw, note }
const hard = [];
function row(area, item, ok, pc, pswV, note = '', level = 'HARD') {
  const status = ok ? 'PASS' : level;
  rows.push({ area, item, status, pc, psw: pswV, note });
  if (!ok && level === 'HARD') hard.push(`${area}: ${item}`);
  console.log(`  ${status.padEnd(4)}  ${area} — ${item}${ok ? '' : `  (PC ${pc} | PSW ${pswV})`}`);
}
const J = (v) => JSON.stringify(v);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

console.log(`PSW ${pswRev}\nPC  ${pcRev}\n`);
row('version', 'CASEMENT_LAYOUTS_VERSION', PC.CASEMENT_LAYOUTS_VERSION === psw.VERSION, PC.CASEMENT_LAYOUTS_VERSION, psw.VERSION);

// layout codes + defaults
const pcCodes = Object.keys(PC.LAYOUT_DEFAULTS), pswCodes = Object.keys(psw.LAYOUT_DEFAULTS);
row('layouts', 'same set of layout codes', sameSet(pcCodes, pswCodes), J(pcCodes.filter((c) => !pswCodes.includes(c))), J(pswCodes.filter((c) => !pcCodes.includes(c))), 'codes missing on the other side');
row('layouts', 'default w × h per code', pcCodes.every((c) => psw.LAYOUT_DEFAULTS[c] && psw.LAYOUT_DEFAULTS[c].w === PC.LAYOUT_DEFAULTS[c].w && psw.LAYOUT_DEFAULTS[c].h === PC.LAYOUT_DEFAULTS[c].h),
  J(pcCodes.filter((c) => !psw.LAYOUT_DEFAULTS[c] || psw.LAYOUT_DEFAULTS[c].w !== PC.LAYOUT_DEFAULTS[c].w || psw.LAYOUT_DEFAULTS[c].h !== PC.LAYOUT_DEFAULTS[c].h)), '-');
row('layouts', 'iteration order of LAYOUT_DEFAULTS (Object.keys — picker order)', J(pcCodes) === J(pswCodes), J(pcCodes.slice(-4)), J(pswCodes.slice(-4)), 'source text differs (PC lists 140R before 142/144, PSW after) but integer-like keys are hoisted by JS, so the iteration order is identical', 'DIFF');
row('layouts', 'FANLIGHT_LAYOUTS', J(PC.FANLIGHT_LAYOUTS) === J(psw.FANLIGHT_LAYOUTS), J(PC.FANLIGHT_LAYOUTS), J(psw.FANLIGHT_LAYOUTS));
row('layouts', 'FAN2_LAYOUTS', J(PC.FAN2_LAYOUTS) === J(psw.FAN2_LAYOUTS), J(PC.FAN2_LAYOUTS), J(psw.FAN2_LAYOUTS));
row('layouts', 'TRIPLE_LAYOUTS', J(PC.TRIPLE_LAYOUTS) === J(psw.TRIPLE_LAYOUTS), J(PC.TRIPLE_LAYOUTS), J(psw.TRIPLE_LAYOUTS));
{
  const pcH = Object.keys(PC.HIDDEN_DUPLICATES), pswH = Object.keys(psw.HIDDEN_DUPLICATES);
  const extra = pcH.filter((c) => !pswH.includes(c)), missing = pswH.filter((c) => !pcH.includes(c));
  row('picker', 'HIDDEN_DUPLICATES (PSW set ⊆ PC set)', missing.length === 0, J(pcH), J(pswH), missing.length ? 'PSW hides codes PC shows' : '');
  row('picker', 'HIDDEN_DUPLICATES extra on PC', extra.length === 0, J(extra), '-', extra.length ? `PC additionally hides ${J(extra)} — documented in casementLayouts.js as an alias of 040L (same panel + default hinge); engine-side the code stays valid` : '', 'DIFF');
  row('picker', 'DISPLAY_NAMES', J(PC.DISPLAY_NAMES) === J(psw.DISPLAY_NAMES), J(Object.keys(PC.DISPLAY_NAMES).length), J(Object.keys(psw.DISPLAY_NAMES).length));
}

// geometry: every code × a grid of inputs, panels in ORDER with x/y/w/h/hinge, mullions, transoms
row('geometry', 'PSW casementLayoutDef body is self-contained (no window / document / this / EstimateRenderer)', leaks.length === 0, '-', J(leaks));
const GEO = PC.CASEMENT_GEO_DEFAULTS;
const cases = [];
for (const code of pcCodes) {
  const d = PC.LAYOUT_DEFAULTS[code];
  for (const [w, h] of [[d.w, d.h], [1000, 1500], [2400, 2400], [400, 1000]]) {
    for (const FR of [0.3, 0.45]) for (const FR2 of [0.3, 0.2]) for (const mid of [0, 300]) cases.push({ code, w, h, FR, FR2, mid });
  }
}
let geomFail = [];
const round = (v) => Math.round(v * 1e6) / 1e6;
const normDef = (def) => JSON.stringify({
  panels: (def.panels || []).map((p) => [round(p.x), round(p.y), round(p.w), round(p.h), p.hinge]),
  mullions: (def.mullions || []).map(round),
  transoms: (def.transoms || []).map(round),
});
for (const c of cases) {
  const { innerW, innerH } = PC.casementInnerDims(c.w, c.h, GEO);
  let a, b;
  try { a = normDef(PC.casementLayoutDef(c.code, innerW, innerH, c.h, c.FR, c.FR2, c.mid, GEO)); } catch (e) { a = `PC threw ${e.message}`; }
  try { b = normDef(pswLayoutDef(c.code, innerW, innerH, c.h, c.FR, c.FR2, c.mid)); } catch (e) { b = `PSW threw ${e.message}`; }
  if (a !== b) geomFail.push({ ...c, pc: a, psw: b });
}
row('geometry', `casementLayoutDef identical for ${cases.length} cases (${pcCodes.length} codes × 4 sizes × FR × FR2 × middle section): panel ORDER, x/y/w/h, hinge, mullions, transoms`, geomFail.length === 0, J(geomFail.slice(0, 2)), '-', geomFail.length ? `${geomFail.length} differing cases` : '');
row('geometry', 'PC geometry constants = PSW hardcodes (FRAME_FACE 57 / BOTTOM_FACE 68 / MULLION_W 68)', GEO.frameFace === 57 && GEO.bottomFace === 68 && GEO.mullionW === 68 && /const FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68;/.test(method.body), J(GEO), 'FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68');
{
  const casPanelCount = {};
  for (const code of pcCodes) casPanelCount[code] = PC.casementLayoutDef(code, 1000, 1000, 1125, 0.3, 0.3, 0, GEO).panels.length;
  row('geometry', 'panel count per code (casementHinges index range)', true, J(casPanelCount), '=', 'informational', 'DIFF');
}

// arched casement constants
const shapeMap = arch.PSW_ARCH_SHAPE;
row('arch', 'PSW cas-arch-shape radio values = PC PSW_ARCH_SHAPE keys', sameSet(psw.shapeRadios, Object.keys(shapeMap)), J(Object.keys(shapeMap)), J(psw.shapeRadios));
row('arch', 'RISE_RATIO per PSW shape = PC ARCH_RISE_RATIO via the shape map', Object.keys(psw.RISE_RATIO).every((k) => Math.abs(psw.RISE_RATIO[k] - arch.ARCH_RISE_RATIO[shapeMap[k]]) < 1e-12),
  J(Object.fromEntries(Object.keys(psw.RISE_RATIO).map((k) => [k, arch.ARCH_RISE_RATIO[shapeMap[k]]]))), J(psw.RISE_RATIO));
row('arch', 'GOTHIC_PROFILE_RATIO', Object.keys(psw.GOTHIC_PROFILE_RATIO).every((k) => Math.abs(psw.GOTHIC_PROFILE_RATIO[k] - arch.GOTHIC_PROFILE_RATIO[k]) < 1e-12) && sameSet(Object.keys(psw.GOTHIC_PROFILE_RATIO), Object.keys(arch.GOTHIC_PROFILE_RATIO)),
  J(arch.GOTHIC_PROFILE_RATIO), J(psw.GOTHIC_PROFILE_RATIO));
row('arch', 'MIN_WIDTH / MAX_WIDTH = profile.arch.limits', P.arch.limits.minWidth === psw.MIN_WIDTH && P.arch.limits.maxWidth === psw.MAX_WIDTH, J([P.arch.limits.minWidth, P.arch.limits.maxWidth]), J([psw.MIN_WIDTH, psw.MAX_WIDTH]));
row('arch', 'MIN_STRAIGHT (H ≥ rise + 900) = profile.arch.limits.minStraightBelowRise', P.arch.limits.minStraightBelowRise === psw.MIN_STRAIGHT, P.arch.limits.minStraightBelowRise, psw.MIN_STRAIGHT);
row('arch', 'MIN_UPPER_STILE (sash) = profile.arch.limits.minLeafStraightStile (casement adoption, spec §3.3)', P.arch.limits.minLeafStraightStile === psw.MIN_UPPER_STILE, P.arch.limits.minLeafStraightStile, psw.MIN_UPPER_STILE, 'PSW measures the upper-sash stile (H/2 − rise); PC measures the casement leaf stile (H − rise − 47) — same number, different member', 'DIFF');
row('arch', 'PSW defaults when the radios were never touched: shape / hinge value', psw.archShapeDefault === 'semi-circle' && psw.archHingeDefault === 'right', 'semi-circle / right', `${psw.archShapeDefault} / ${psw.archHingeDefault}`);
{
  const leftId = psw.hingeRadios.find((r) => r.id === 'cas-arch-open-left'), rightId = psw.hingeRadios.find((r) => r.id === 'cas-arch-open-right');
  row('arch', 'online-estimate.html: id cas-arch-open-left carries value "right" (and vice versa) — the reversed hinge', leftId?.value === 'right' && rightId?.value === 'left', 'left→right, right→left', J(psw.hingeRadios));
  const mk = (v) => specification.normaliseToWindowSpec({ width: 1200, height: 2000 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', casementType: 'arched', casArchShape: 'semi-circle', casArchHinge: v } });
  row('arch', 'PC inverts on read: value "right" (label Left Hinge) → hinge left; "left" → right; missing → left', mk('right').arch.hinge === 'left' && mk('left').arch.hinge === 'right' && mk(undefined).arch.hinge === 'left', 'left / right / left', `${mk('right').arch.hinge} / ${mk('left').arch.hinge} / ${mk(undefined).arch.hinge}`);
  const s = specification.normaliseToWindowSpec({ width: 1200, height: 2000 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', casementType: 'arched' } });
  row('arch', 'PC default shape when PSW stored none = PSW default (semi-circle)', s.arch.shape === 'semi-circle', s.arch.shape, psw.archShapeDefault);
}
{
  // rise per shape at W 1200 — PSW rounds to whole mm (riseFor), PC keeps the exact ratio × W
  const W = 1200;
  const diffs = Object.keys(psw.RISE_RATIO).map((k) => {
    const pswRise = Math.round(psw.RISE_RATIO[k] * W);
    const pcRise = arch.resolveArchRise(shapeMap[k], W, null, P.arch.limits);
    return { psw: k, pswRise, pcRise: Math.round(pcRise * 100) / 100, sameMm: Math.abs(pswRise - pcRise) < 0.5 };
  });
  row('arch', 'rise at W 1200 per shape (PSW rounds to 1 mm, PC exact)', diffs.every((d) => d.sameMm), J(diffs.map((d) => d.pcRise)), J(diffs.map((d) => d.pswRise)), 'gothic: PSW 1039 vs PC 1039.23 — sub-mm, PSW display rounding', 'DIFF');
}

// ── report ──────────────────────────────────────────────────────────────────
const passN = rows.filter((r) => r.status === 'PASS').length, diffN = rows.filter((r) => r.status === 'DIFF').length, hardN = rows.filter((r) => r.status === 'HARD').length;
const esc = (v) => String(v).replace(/\|/g, '\\|');
const md = [
  '# PSW ↔ PC parity report — casement layouts and arched casement constants',
  '',
  `Generated by \`node verify/parity/psw-casement-layouts.mjs\` (read-only; PSW is parsed, never edited).`,
  '',
  `| | revision |`,
  `|---|---|`,
  `| PSW (\`Prime-Sash-Windows\`) | ${pswRev} |`,
  `| PC (\`Sash-Planner-Web\`) | ${pcRev} |`,
  '',
  `**Result: ${passN} PASS · ${diffN} documented differences · ${hardN} HARD differences.** ` +
  (hardN ? 'HARD differences break the import/export contract and must be fixed in the same session on both sides.' : 'No hard difference: layout codes, panel order, geometry, hinge mapping and arch constants are in step.'),
  '',
  '## What is compared',
  '',
  '- `CASEMENT_LAYOUTS_VERSION`, layout codes, default sizes, fanlight / fan2 / triple lists (`js/casement-controller.js` ↔ `casementLayouts.js`).',
  '- Picker metadata: hidden duplicates, display names (`js/casement-type-modal.js`).',
  '- `casementLayoutDef` geometry: the PSW static method is extracted from `js/estimate-renderer.js` and executed next to the PC port for every code at four sizes × two fanlight ratios × two fan2 ratios × two middle sections; panels are compared IN ORDER with x, y, w, h, hinge, plus mullions and transoms (1e-6 mm).',
  '- Arched casement: shape radio values ↔ `PSW_ARCH_SHAPE`, `RISE_RATIO`, `GOTHIC_PROFILE_RATIO`, width / straight / stile limits ↔ `profile.arch.limits`, the reversed hinge radio (`online-estimate.html`) ↔ the inversion in `specification.js`, PSW defaults when the radios were never touched.',
  '',
  '## Rows',
  '',
  '| status | area | item | PC | PSW | note |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.status} | ${r.area} | ${esc(r.item)} | ${esc(r.pc)} | ${esc(r.psw)} | ${esc(r.note)} |`),
  '',
  '## Reading the DIFF rows',
  '',
  '- **Order of `LAYOUT_DEFAULTS`**: the source text differs (PC writes `140L, 140R, 142, 144`, PSW `140L, 142, 144, 140R`), but JavaScript hoists integer-like keys (`120`, `130`…`144`) ahead of the rest, so `Object.keys` — and therefore the picker order — is identical on both sides (row above is PASS). `casementHinges` indexes panels inside a definition, never the code table.',
  '- **`HIDDEN_DUPLICATES` extra `010` on PC**: PC hides the `010` card as an alias of `040L` (same panel, same default hinge); the code stays valid engine-side for PSW imports.',
  '- **`MIN_UPPER_STILE`**: PSW applies 100 mm to the arched upper SASH stile (`H/2 − rise`); PC adopts the number for the casement LEAF stile (`H − rise − 47`) per spec §3.3 — a decision, not a drift.',
  '- **Rise rounding**: PSW `riseFor` rounds to whole mm for display; PC keeps the exact ratio × W (gothic 1039.23 vs 1039).',
  '',
  '## Not compared (out of scope of this report)',
  '',
  '- Pricing tables, bar patterns (`PATTERNS_FOR_SHAPE`, premiums), the 3D components, the ellipse drawn as Bézier in PSW SVG (spec §3 says: do not port).',
  '- Sash / fix-frame arch fields (`archShape`, `fixArchRise`, …) — not in PC yet (spec §12 P6).',
  '',
].join('\n');
mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, md);
console.log(`\n${passN} PASS, ${diffN} DIFF (documented), ${hardN} HARD → ${REPORT}`);
if (hardN) { console.log('HARD: ' + hard.join(' | ')); process.exit(1); }
