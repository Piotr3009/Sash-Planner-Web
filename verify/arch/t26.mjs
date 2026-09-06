/**
 * t26 — ARCHED-WINDOWS-v4 Stage 2 harness: Block B, the glazier PDF layout.
 *
 * Renders the glass PDF through the real node path (jsPDF) for the three v3
 * samples — semi-circle hub-spoke (1000 × 1500, start 1000), three-centre with
 * 1H 2V bars (1000 × 1500, start 1300), gothic intersecting (1000 × 1800) — and
 * asserts the v4 layout by intercepting jsPDF's `text` / `lines` calls
 * (page, position, size, alignment) instead of parsing the PDF stream:
 *   - page count = 1 (schedule) + drawing pages + bars pages;
 *   - drawing cells: the outline fills the cell, only bar IDS on the drawing,
 *     title + spec lines UNDER the outline, the bar chain at the BOTTOM, the
 *     overall width at the TOP, no text bbox overlapping the outline bbox;
 *   - bars pages at the end: every bar id and every row of every unit, one
 *     thumbnail per block, blocks never broken across pages;
 *   - rectangular-only exports byte-identical to the previous commit
 *     (git archive of 402c58a bundled the same way, CreationDate masked);
 *   - A3 / A4 by the `format` option (MediaBox), the pack passes its setting.
 * Writes docs/handover/samples/sample_glass_order_arched.pdf (+ _a3).
 * Run: node verify/arch/t26.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { jsPDF } from 'jspdf';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(AUDIT, { recursive: true });
mkdirSync(SAMPLES, { recursive: true });
const PREV = '402c58a';   // Stage 1 commit — the glass PDF before Block B

function bundle(srcRoot, tag) {
  const entry = resolve(AUDIT, `${tag}-entry.mjs`);
  const rel = (p) => './' + resolve(srcRoot, p).slice(AUDIT.length + 1).replace(/\\/g, '/');
  const relPath = (p) => (resolve(srcRoot, p).startsWith(AUDIT) ? rel(p) : resolve(srcRoot, p));
  writeFileSync(entry, [
    `export * as arch from '${relPath('engine/arch.js')}';`,
    `export * as profile from '${relPath('engine/profile.js')}';`,
    `export * as specification from '${relPath('engine/specification.js')}';`,
    `export * as calculations from '${relPath('engine/calculations.js')}';`,
    `export * as glassBars from '${relPath('engine/glassBars.js')}';`,
    `export * as glassPdf from '${relPath('utils/glassPdfExport.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${tag}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--jsx=automatic', '--external:react', '--external:react/jsx-runtime', '--external:jspdf', `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const M = await bundle(resolve(ROOT, 'src'), 't26');
// previous tree for the byte-identity check
const prevTree = resolve(AUDIT, `tree-${PREV}`);
if (existsSync(prevTree)) rmSync(prevTree, { recursive: true, force: true });
mkdirSync(prevTree, { recursive: true });
execFileSync('bash', ['-lc', `git archive ${PREV} src | tar -x -C "${prevTree}"`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const OLD = await bundle(resolve(prevTree, 'src'), 't26-prev');
const { specification, calculations, glassBars, glassPdf } = M;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');

// ── jsPDF call capture (text / lines): jsPDF installs `text` / `lines` on every instance in its constructor,
// so the harness hooks the 'initialized' plugin event (the same module instance the bundles use — jspdf is external)
// and wraps the instance methods; nothing in the PDF stream is parsed for the layout checks.
const REC = { texts: [], paths: [], on: false };
jsPDF.API.events.push(['initialized', function () {
  const self = this;
  const oText = self.text, oLines = self.lines;
  self.text = function (text, x, y, opts) {
    if (REC.on) {
      const page = self.internal.getCurrentPageInfo().pageNumber;
      const str = Array.isArray(text) ? text.join('\n') : String(text);
      REC.texts.push({ page, text: str, x, y, size: self.internal.getFontSize(), w: self.getTextWidth(str), align: opts?.align || 'left', angle: opts?.angle || 0 });
    }
    return oText.call(self, text, x, y, opts);
  };
  self.lines = function (lines, x, y, scale, style, closed) {
    if (REC.on) {
      const page = self.internal.getCurrentPageInfo().pageNumber;
      let cx = x, cy = y, minX = x, minY = y, maxX = x, maxY = y;
      const see = (px, py) => { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); };
      for (const v of lines) {
        if (v.length === 2) { cx += v[0]; cy += v[1]; see(cx, cy); }
        else { see(cx + v[0], cy + v[1]); see(cx + v[2], cy + v[3]); cx += v[4]; cy += v[5]; see(cx, cy); }
      }
      // `line()` calls lines() with a single 2-vector and no style → not a path of ours
      if (lines.length > 1) REC.paths.push({ page, style, closed: !!closed, bbox: [minX, minY, maxX, maxY] });
    }
    return oLines.call(self, lines, x, y, scale, style, closed);
  };
}]);
const PT = 0.3528;   // pt → mm
function textBox(t) {
  const h = t.size * PT;
  if (t.angle === 90) {
    const y0 = t.align === 'center' ? t.y - t.w / 2 : t.align === 'right' ? t.y : t.y - t.w;
    return [t.x - h, y0, t.x, y0 + t.w];
  }
  const x0 = t.align === 'center' ? t.x - t.w / 2 : t.align === 'right' ? t.x - t.w : t.x;
  return [x0, t.y - h, x0 + t.w, t.y];
}
const overlap = (a, b, tol = 0.2) => a[0] < b[2] - tol && a[2] > b[0] + tol && a[1] < b[3] - tol && a[3] > b[1] + tol;
const isId = (s) => /^[VHSRKT]\d+$/.test(s);
const pageCount = (bytes) => (Buffer.from(bytes).toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;

function render(mod, windowsData, extra = {}) {
  REC.texts = []; REC.paths = []; REC.on = true;
  const buf = mod.glassPdf.exportGlassPDF({ batch: { label: 'Batch T26' }, windowsData, projects: [{ number: 'P-26', name: 'T26' }], companySettings: { companyName: 'HARNESS' }, returnDoc: true, ...extra });
  REC.on = false;
  return { bytes: Buffer.from(buf), texts: REC.texts, paths: REC.paths };
}
const pcItem = (id, width, height, fields) => specification.normaliseToWindowSpec({ id, name: id, width, height, windowCategory: 'casement', casementType: 'arched', ...fields });
const cas = (id, width, height, fc = {}) => specification.normaliseToWindowSpec({ id, name: id, width, height }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
const wd = (specs) => specs.map((ws) => ({ win: { name: ws.name, _projectNumber: 'P-26' }, windowSpec: ws, derived: calculations.deriveWindowData(ws, {}) }));

// ═══════════════════════════════════════════════════════════════════════════
section('1 — the three v3 samples: pages, drawing cells (ids only, text under / around the outline), bars page');
const SAMPLE_SPECS = [
  pcItem('SEMI-HUB', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' }),
  pcItem('TC-BARS', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 }),
  pcItem('GOTHIC-X', 1000, 1800, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting' }),
];
const W3 = wd(SAMPLE_SPECS);
const R = render(M, W3);
writeFileSync(resolve(SAMPLES, 'sample_glass_order_arched.pdf'), R.bytes);
const units = W3.map((w, i) => ({ name: w.win.name, shape: w.derived.customGlassUnits[0].shape, rows: glassBars.barEndRows(w.derived.arch.bars, w.derived.arch.glassOutline), index: i + 1 }));
const drawPages = Math.ceil(W3.length / 4);
check(`page count = 1 schedule + ${drawPages} drawing page + 1 bars page (three blocks: ${units.map((u) => u.rows.length).join(' + ')} rows fit one page)`, pageCount(R.bytes) === 1 + drawPages + 1, String(pageCount(R.bytes)));
const drawPageNos = [...Array(drawPages)].map((_, i) => 2 + i);
const barsPageNo = 2 + drawPages;
const onDraw = R.texts.filter((t) => drawPageNos.includes(t.page));
const outlines = R.paths.filter((p) => drawPageNos.includes(p.page) && p.style === 'FD' && p.closed);
check('drawing page: one filled outline per shaped unit (3), no per-cell bar table (no "s from apex" header, no row text)', outlines.length === 3 && !onDraw.some((t) => /from apex|^ID$|^L$|angle \/ R/.test(t.text)));
for (const u of units) {
  const ids = u.rows.map((r) => r.id);
  // the k-th filled outline on the drawing pages belongs to the k-th unit (cells are laid out in schedule order);
  // ids repeat between units (V1 …), so each unit's id texts are the ones inside its own outline bbox
  const ol = outlines[u.index - 1];
  const inOl = (t) => ol && t.x >= ol.bbox[0] - 2 && t.x <= ol.bbox[2] + 2 && t.y >= ol.bbox[1] - 2 && t.y <= ol.bbox[3] + 2;
  const idTexts = onDraw.filter((t) => ids.includes(t.text) && inOl(t));
  check(`${u.name}: every bar id (${ids.length}) is drawn inside its outline on the drawing page — ids only, no numbers beside the bars`, !!ol && ids.every((id) => idTexts.some((t) => t.text === id)) && !onDraw.some((t) => new RegExp(`^${ids[0]} (x|y|R) `).test(t.text)), ol ? `${idTexts.length} ids in ${JSON.stringify(ol.bbox.map((v) => +v.toFixed(1)))}` : 'no outline');
  const title = onDraw.find((t) => t.text.startsWith(`${u.index} · ${u.name} — `));
  check(`${u.name}: title line present on the drawing page`, !!title, onDraw.filter((t) => t.text.startsWith(`${u.index} ·`)).map((t) => t.text).join(' | '));
  if (!ol || !title) continue;
  const [x0, y0, x1, y1] = ol.bbox;
  check(`${u.name}: title + spec lines sit UNDER the outline (baseline below the outline's bottom + chain)`, title.y > y1 + 4 && onDraw.filter((t) => t.text.startsWith('double') || t.text.includes('spacer:')).some((t) => t.y > title.y - 0.1));
  const widthTxt = onDraw.find((t) => t.text === `${u.shape.outline.width % 1 ? u.shape.outline.width.toFixed(1) : u.shape.outline.width} mm` && t.align === 'center' && t.angle === 0 && Math.abs(t.x - (x0 + x1) / 2) < 1);
  check(`${u.name}: overall width "${u.shape.outline.width} mm" centred ABOVE the outline (top)`, !!widthTxt && widthTxt.y < y0);
  // bottom chain: the vertical-bar x spacing numbers sit below the outline bottom
  const xs = [...new Set(u.shape.bars.filter((b) => b.kind === 'straight' && Math.abs(b.to[0] - b.from[0]) < 1e-6).map((b) => Math.round(b.from[0] * 10) / 10))].sort((a, b) => a - b);
  const cuts = [0, ...xs.filter((v) => v > 0 && v < u.shape.outline.width), u.shape.outline.width];
  const segs = cuts.slice(1).map((c, i) => c - cuts[i]);
  const chainTexts = segs.map((sg) => onDraw.find((t) => t.align === 'center' && t.angle === 0 && t.y > y1 && t.y < title.y && Math.abs(Number(t.text) - sg) < 0.06 && t.x > x0 - 1 && t.x < x1 + 1));
  check(`${u.name}: bar-spacing chain (${segs.map((v) => v.toFixed(1)).join(' / ')}) printed BELOW the outline, above the title`, chainTexts.every(Boolean), chainTexts.map((t) => t?.text).join(' '));
  const nonId = onDraw.filter((t) => !isId(t.text) && t.page === ol.page);
  const clashes = nonId.filter((t) => overlap(textBox(t), ol.bbox));
  check(`${u.name}: no text bbox (dimensions, title, spec) overlaps the outline bbox`, clashes.length === 0, clashes.map((t) => `${t.text}@${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(' | '));
}
// bars page
const onBars = R.texts.filter((t) => t.page === barsPageNo);
check('bars page: heading + one block per shaped unit with bars (title with index · name, bar count)', onBars.some((t) => t.text.startsWith('GLAZING BARS')) && units.every((u) => onBars.some((t) => t.text.startsWith(`${u.index} · ${u.name} — `) && t.text.endsWith(`${u.rows.length} bars`))));
for (const u of units) {
  const ids = u.rows.map((r) => r.id);
  check(`${u.name}: every id and every "s from apex / position", L, angle / R cell on the bars page`, ids.every((id) => onBars.some((t) => t.text === id)) && u.rows.every((r) => onBars.some((t) => t.text === String(r.cells.s)) && onBars.some((t) => t.text === String(r.cells.L)) && onBars.some((t) => t.text === String(r.cells.angle))));
}
const thumbs = R.paths.filter((p) => p.page === barsPageNo);
check('bars page: one window thumbnail per block — a stroked frame contour + the filled unit (3 S + 3 FD paths), thumbnails ≤ 35 mm high', thumbs.filter((p) => p.style === 'S').length === 3 && thumbs.filter((p) => p.style === 'FD').length === 3 && thumbs.filter((p) => p.style === 'S').every((p) => p.bbox[3] - p.bbox[1] <= 36.5)   /* the captured bbox includes Bézier control points (≤ 1.5 mm overshoot on the crown) */, JSON.stringify(thumbs.map((p) => [p.style, p.closed, p.bbox.map((v) => +v.toFixed(1))])));
check('hub-spoke rows: R1 "R 121.7" and spokes "212.3 from apex R" on the bars page, not on the drawing page', onBars.some((t) => t.text === 'R 121.7') && onBars.some((t) => t.text === '212.3 from apex R') && !onDraw.some((t) => /from apex/.test(t.text)));
check('schedule (page 1) unchanged: Shape column, rect / arched labels, bar counts', R.texts.some((t) => t.page === 1 && t.text === 'Shape') && R.texts.some((t) => t.page === 1 && /^arched · R /.test(t.text)));

// ═══════════════════════════════════════════════════════════════════════════
section('2 — pagination: blocks stack and never break inside a table; a page holds whole blocks only');
{
  const many = wd([...Array(9)].map((_, i) => pcItem(`HUB${i + 1}`, 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' })));
  const Rm = render(M, many);
  const dp = Math.ceil(9 / 4);
  const total = pageCount(Rm.bytes);
  const barsPages = total - 1 - dp;
  check(`9 hub-spoke units (7 rows each): ${dp} drawing pages + ${barsPages} bars pages (blocks of 7 rows, 3–4 per A4 page)`, barsPages >= 2 && barsPages <= 4, String(total));
  const blocksPerPage = {};
  for (let i = 1; i <= 9; i++) {
    const title = Rm.texts.find((t) => t.page > 1 + dp && t.text.startsWith(`${i} · HUB${i} — `));
    const rowsPages = new Set(Rm.texts.filter((t) => t.page > 1 + dp && t.text === 'R 121.7').map((t) => t.page));
    if (title) blocksPerPage[title.page] = (blocksPerPage[title.page] || 0) + 1;
    void rowsPages;
  }
  const ok = Object.values(blocksPerPage).reduce((a, b) => a + b, 0) === 9;
  check('every block has its title on exactly one bars page; per page the block count fits the content height', ok && Object.values(blocksPerPage).every((n) => n >= 1 && n <= 4), JSON.stringify(blocksPerPage));
  // a block's ids all on the block's page (never split)
  const split = [...Array(9)].some((_, i) => {
    const title = Rm.texts.find((t) => t.page > 1 + dp && t.text.startsWith(`${i + 1} · HUB${i + 1} — `));
    if (!title) return true;
    const after = Rm.texts.filter((t) => t.page === title.page && t.y > title.y && t.y < title.y + 40);
    return !['R1', 'K1', 'S1', 'V1', 'V2'].every((id) => after.some((t) => t.text === id));
  });
  check('a block\'s rows follow its title on the same page (no table broken across pages)', !split);
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — rectangular-only exports byte-identical to the previous commit; mixed exports keep the schedule');
{
  const rects = wd([cas('R1', 900, 1200), cas('R2', 1200, 1200, { casementLayout: '120', casementHBars: 1, casementVBars: 2 }),
    specification.normaliseToWindowSpec({ id: 'S1', name: 'S1', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } })]);
  // jsPDF's trailer /ID is a hash of the creation timestamp — masked with the date; everything else must match
  const mask = (b) => Buffer.from(b).toString('latin1').replace(/\/CreationDate \([^)]*\)/g, '/CreationDate (X)').replace(/\/ID \[ <[0-9A-F]+> <[0-9A-F]+> \]/g, '/ID [X]');
  const a = render(M, rects), b = render(OLD, rects);
  check(`rectangular-only (2 casements + 1 sash → ${pageCount(a.bytes)} pages): NEW output byte-identical to ${PREV} (CreationDate + its /ID hash masked)`, mask(a.bytes) === mask(b.bytes) && pageCount(a.bytes) === pageCount(b.bytes), `${a.bytes.length} vs ${b.bytes.length} bytes`);
  const mixed = render(M, [...rects, ...W3]);
  check('mixed export: schedule page + drawing pages + bars page; rectangular cells keep their header bar (title at the cell top)', pageCount(mixed.bytes) === 1 + Math.ceil(6 / 4) + 1 && mixed.texts.some((t) => t.page === 2 && /^1 · R1 — .* GLASS$/.test(t.text) && t.y < 40));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — A3 / A4 follow the export setting');
{
  const a4 = render(M, W3.slice(0, 1));
  const a3 = render(M, W3.slice(0, 1), { format: 'a3' });
  const box = (b) => (Buffer.from(b).toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/) || []).slice(1).map(Number);
  check('default → A4 landscape (MediaBox 841.89 × 595.28 pt); format a3 → A3 landscape (1190.55 × 841.89 pt)', near(box(a4.bytes)[0], 841.89, 0.1) && near(box(a4.bytes)[1], 595.28, 0.1) && near(box(a3.bytes)[0], 1190.55, 0.1) && near(box(a3.bytes)[1], 841.89, 0.1), `${box(a4.bytes)} / ${box(a3.bytes)}`);
  writeFileSync(resolve(SAMPLES, 'sample_glass_order_arched_a3.pdf'), render(M, W3, { format: 'a3' }).bytes);
  const a3big = render(M, W3, { format: 'a3' });
  const ol4 = R.paths.filter((p) => p.page === 2 && p.style === 'FD'), ol3 = a3big.paths.filter((p) => p.page === 2 && p.style === 'FD');
  check('A3 cells scale the drawing up (outline height larger than on A4)', ol3.length === 3 && ol3.every((p, i) => p.bbox[3] - p.bbox[1] > (ol4[i].bbox[3] - ol4[i].bbox[1]) * 1.2));
  check('unknown format falls back to A4', near(box(render(M, W3.slice(0, 1), { format: 'letter' }).bytes)[0], 841.89, 0.1));
  const pp = src('pages/ProductionPackPage.jsx');
  check('ProductionPackPage: the Glass tab receives exportFormat and passes it to exportGlassPDF', pp.includes('<GlassTab merged={merged} windowsData={windowsData} isPPMode={isPPMode} batch={batch} pp={pp} registerExport={registerExport} exportFormat={exportFormat} />') && pp.includes('format: exportFormat,   // v4 Block B'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
