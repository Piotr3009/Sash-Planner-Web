/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t45_sash_bars_per_sash: glazing bars per sash (Piotr 09.10.2026, owner box item 16)
 * and the per-window error boundary (box item 19), measured on the derived data and on
 * the components that reach the screen, against the start of the doors v3 tura
 * (default 150500e, `git archive`; pass another ref as the first argument).
 *
 *   1  import rules: upperBars / lowerBars from the window record, the specification top
 *      level, then the estimate fullConfig, then 'none'; the legacy grid.mode; an 'N x M'
 *      the engine has no table for ('2x3') raises BarPatternError for that window
 *   2  derived.bars: the pattern, counts, pane and bar centres of EACH sash, over that
 *      sash's own pane by the sheets' rule (equal panes between 22 bars); custom lists per
 *      sash with an explicit warning for a bar outside its pane
 *   3  lists: the glass rows (bars per unit), the beading runs (triangle and Georgian per
 *      sash), bead tape and silicone
 *   4  glass DXF: the bar entities of every unit
 *   5  the canvas elevation: the bar rectangles of each pane
 *   6  sheets: SashDetail2D and GlassDrawing2D of each sash equal the START sheet of a
 *      window whose two sashes both carry THAT pattern; FrontElevation2D draws each
 *      sash's own bars
 *   7  3D: windowSpecToConfig sends each sash its own pattern; ParametricSashWindow
 *      meshes (the t40 way): changing one sash's pattern changes meshes in that sash only
 *   8  controls: a window with the same pattern on both sashes derives byte-identical to
 *      START but for the keys this tura adds (derived.bars, windowSpec grid.upper /
 *      grid.lower) and the dead glazingItems it removes; lists, sheets, DXF, canvas and
 *      the 3D config equal START
 *   9  the per-window boundary (src/utils/windowBoundary.js): an unknown proportion, an
 *      unknown bar pattern and an arch the engine refuses fail that window only
 *  10  pages in a browser (Playwright, like t39 / t43): the project page cards, the window
 *      detail page and the production pack with two windows in error and a PSW window
 *      with its bars only in fullConfig; Pricing Settings "Cottage sash surcharge"
 *      (owner box item 18) next to "Arched head", its 5 % fallback and its save
 *
 * "6 over 1" is upper '6x6' (the PSW six-pane pattern: 2 rows x 3 columns) over lower
 * 'none'. The vocabulary has no '2x3' ('2x2' and '3x3' already mean 2 and 3 panes per
 * sash, so an 'R x C' reading would contradict them): '2x3' is the explicit error of
 * section 1 (BLOCKERS section 31).
 *
 * Run: node verify/parity/t45_sash_bars_per_sash.mjs [git-ref]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const startHash = process.argv[2] || '150500eee17c7376278545ccad6e6c8ec64fd94d';
const startTag = `t45-start-${startHash.slice(0, 12).replace(/[^\w.-]+/g, '_')}`;
const startTree = resolve(AUDIT, `${startTag}-tree`);
rmSync(startTree, { recursive: true, force: true });
mkdirSync(startTree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${startHash} src | tar -x -C "${startTree}"`], { cwd: ROOT, stdio: 'inherit' });

const ESBUILD = ['-y', 'esbuild@0.25.0'];
function bundleEngine(srcRoot, name, live) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    ...['specification', 'calculations', 'lists', 'arch'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    `export * as wsc from '${rel('utils/windowSpecToConfig.js')}';`,
    `export * as glassDxf from '${rel('utils/glassDxfExport.js')}';`,
    `export * as canvas from '${rel('engine/canvas-renderer.js')}';`,
    ...(live ? [`export * as boundary from '${rel('utils/windowBoundary.js')}';`] : []),
    `export { default as FrontElevation } from '${rel('components/drawings/FrontElevation2D.jsx')}';`,
    `export { default as SashDetail } from '${rel('components/drawings/SashDetail2D.jsx')}';`,
    `export { default as GlassDrawing } from '${rel('components/drawings/GlassDrawing2D.jsx')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:jspdf-autotable', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
// The sash 3D of one tree: R3F, three, react and the component in ONE bundle (as t40 / t43).
function bundle3D(srcRoot, name) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    "export { createRoot, extend } from '@react-three/fiber';",
    "export * as THREE from 'three';",
    "export { createElement } from 'react';",
    `export * as PSW from '${rel('3d/components/ParametricSashWindow.jsx')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist|Calc failed/i.test(String(a[0]))) return; warn(...a); };

const LIVE = await bundleEngine(resolve(ROOT, 'src'), 't45-live', true);
const START = await bundleEngine(resolve(startTree, 'src'), startTag, false);
const L3 = await bundle3D(resolve(ROOT, 'src'), 't45-live-3d');

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 1e-6) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const throwsOf = (fn) => { try { fn(); return null; } catch (e) { return e; } };
const { specification: SP, calculations: CA, lists: LI } = LIVE;

// one window: item fields (bars on the record unless fc is given), fullConfig fc
const mk = (M, w, h, extra = {}, fc = {}, top = {}) => {
  const item = { id: 'x', name: 'X', width: w, height: h, ...extra };
  const spec = M.specification.normaliseToWindowSpec(item, { ...top, fullConfig: fc });
  return { item, spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const BAR_W = 22;
// the sheets' rule (drawingUtils computeBarPositions): equal panes between bars BAR_W wide
const centres = (len, n) => Array.from({ length: n }, (_, j) => Math.round((((len - n * BAR_W) / (n + 1)) * (j + 1) + j * BAR_W + BAR_W / 2) * 100) / 100);
const COUNTS = { none: { v: 0, h: 0 }, '2x2': { v: 1, h: 0 }, '3x3': { v: 2, h: 0 }, '4x4': { v: 1, h: 1 }, '6x6': { v: 2, h: 1 }, '8x8': { v: 3, h: 1 }, '9x9': { v: 2, h: 2 } };
// the two reference windows of the brief (CLAUDE.md Stage 6): 1000 x 1400
const CASES = [
  { label: '6 over 1 (upper 6x6 / lower none)', upper: '6x6', lower: 'none' },
  { label: '1 over 2x2 (upper none / lower 2x2)', upper: 'none', lower: '2x2' },
];

// ═════════════════════════════════════════════════════════════════════════════
section('1 - import rules');
{
  const at = (extra, fc = {}, top = {}) => mk(LIVE, 1000, 1400, extra, fc, top).spec.sash.grid;
  let g = at({ upperBars: '6x6', lowerBars: 'none' });
  ok(g.upper.mode === '6x6' && g.lower.mode === 'none' && g.mode === '6x6', `record upper 6x6 / lower none: grid.upper ${g.upper.mode}, grid.lower ${g.lower.mode}, legacy grid.mode ${g.mode} (the lower wins unless it has none)`);
  g = at({ upperBars: 'none', lowerBars: '2x2' });
  ok(g.upper.mode === 'none' && g.lower.mode === '2x2' && g.mode === '2x2', `record upper none / lower 2x2: ${g.upper.mode} / ${g.lower.mode}, grid.mode ${g.mode}`);
  g = at({}, { upperBars: '6x6', lowerBars: 'none' });
  ok(g.upper.mode === '6x6' && g.lower.mode === 'none', `PSW item with the bars only inside fullConfig: ${g.upper.mode} / ${g.lower.mode}`);
  const sFc = mk(START, 1000, 1400, {}, { upperBars: '6x6', lowerBars: '6x6' }).spec.sash.grid;
  ok(sFc.mode === 'none', `(START read no fullConfig bars: grid.mode ${sFc.mode}; this is the fix of box item 16)`);
  g = at({}, {}, { upperBars: '4x4', lowerBars: '4x4' });
  ok(g.upper.mode === '4x4' && g.lower.mode === '4x4', `the specification top level: ${g.upper.mode} / ${g.lower.mode}`);
  g = at({ upperBars: '2x2' }, { upperBars: '9x9', lowerBars: '3x3' });
  ok(g.upper.mode === '2x2' && g.lower.mode === '3x3', `the record wins per sash, the other sash falls back to fullConfig: ${g.upper.mode} / ${g.lower.mode}`);
  g = at({});
  ok(g.upper.mode === 'none' && g.lower.mode === 'none' && g.mode === 'none', 'nothing anywhere: none / none');
  g = at({ upperBars: 'Georgian', lowerBars: '' });
  ok(g.upper.mode === 'none' && g.lower.mode === 'none', 'a value that is no pattern (a word, empty) stays none, as before');
  g = at({ upperBars: 'CUSTOM', lowerBars: '6X6' });
  ok(g.upper.mode === 'custom' && g.lower.mode === '6x6', `case does not matter: ${g.upper.mode} / ${g.lower.mode}`);
  const e = throwsOf(() => mk(LIVE, 1000, 1400, { name: 'W7', upperBars: '2x3', lowerBars: 'none' }));
  ok(e?.name === 'BarPatternError' && e instanceof SP.BarPatternError && /Unknown bar pattern "2x3" on the upper sash of window "W7"/.test(e.message),
    `'2x3' raises BarPatternError for that window: "${e?.message}"`);
  const s = throwsOf(() => mk(START, 1000, 1400, { upperBars: '2x3' }));
  ok(s && /2x3/.test(s.message), `(START threw a plain error deep in the engine for '2x3': "${s?.message}")`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - derived.bars per sash');
for (const c of CASES) {
  const { derived: d } = mk(LIVE, 1000, 1400, { upperBars: c.upper, lowerBars: c.lower });
  const sw = d.sashWidth;
  const paneW = sw - 2 * 57;
  const paneHu = d.topSashHeight - 57 - 43;
  const paneHl = paneHu;   // a standard window: equal glass by its rule
  const want = (p, ph) => ({ pattern: p, v: COUNTS[p].v, h: COUNTS[p].h, pane: { w: paneW, h: ph }, positions: { vertical: centres(paneW, COUNTS[p].v), horizontal: centres(ph, COUNTS[p].h) }, custom: false, warnings: [] });
  ok(JSON.stringify(d.bars.upper) === JSON.stringify(want(c.upper, paneHu)) && JSON.stringify(d.bars.lower) === JSON.stringify(want(c.lower, paneHl)) && d.bars.same === false && d.bars.warnings.length === 0,
    `${c.label}: upper ${JSON.stringify(d.bars.upper.positions)} over ${paneW} x ${paneHu}, lower ${JSON.stringify(d.bars.lower.positions)}`);
}
{
  // cottage: each sash's horizontal bars over ITS pane
  const { derived: d } = mk(LIVE, 1000, 1400, { upperBars: '4x4', lowerBars: '9x9', sashProportion: 'cottage-40-60' });
  const hu = Math.round((d.topSashHeight - 100) * 100) / 100, hl = Math.round((d.bottomSashHeight - 133) * 100) / 100;
  ok(near(d.bars.upper.pane.h, hu, 0.01) && near(d.bars.lower.pane.h, hl, 0.01)
    && JSON.stringify(d.bars.upper.positions.horizontal) === JSON.stringify(centres(d.topSashHeight - 100, 1))
    && JSON.stringify(d.bars.lower.positions.horizontal) === JSON.stringify(centres(d.bottomSashHeight - 133, 2)),
    `cottage-40-60 4x4 over 9x9: upper h ${d.bars.upper.positions.horizontal} in ${hu}, lower h ${d.bars.lower.positions.horizontal} in ${hl}`);
}
{
  // custom lists per sash: each its own, checked against its own glass
  const up = [{ type: 'v', mm: 300 }, { type: 'h', mm: 200 }];
  const lo = [{ type: 'v', mm: 100 }, { type: 'v', mm: 900 }, { type: 'h', mm: 600 }];
  const { derived: d } = mk(LIVE, 1000, 1400, { upperBars: 'custom', lowerBars: 'custom', upperCustomBars: up, lowerCustomBars: lo });
  ok(d.bars.upper.custom && JSON.stringify(d.bars.upper.positions) === JSON.stringify({ vertical: [300], horizontal: [200] }) && d.bars.upper.warnings.length === 0,
    `custom upper: its own list (${JSON.stringify(d.bars.upper.positions)}), no warning`);
  ok(d.bars.lower.custom && JSON.stringify(d.bars.lower.positions) === JSON.stringify({ vertical: [100, 900], horizontal: [600] }) && d.bars.lower.warnings.length === 2
    && /vertical bar at 900 mm lies outside the lower sash glass \(708 wide\)/.test(d.bars.lower.warnings[0]) && /horizontal bar at 600 mm lies outside the lower sash glass \(537\.5 high\)/.test(d.bars.lower.warnings[1])
    && d.bars.warnings.length === 2,
    `custom lower: its own list; the two bars outside its 708 x 537.5 glass are explicit warnings, not a crash: ${JSON.stringify(d.bars.warnings)}`);
  const one = mk(LIVE, 1000, 1400, { upperBars: 'custom', lowerBars: 'custom', upperCustomBars: up }).derived;
  ok(JSON.stringify(one.bars.lower.positions) === JSON.stringify(one.bars.upper.positions), 'custom with one list (the configurator "same bars"): the lower sash takes the upper list');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - lists: glass rows, beading, consumables');
const glassRows = (o) => LI.buildGlassListForWindow(o.derived, o.spec);
const beadingRow = (o, name) => (o.derived.components.beading || []).find((r) => r.elementName === name);
for (const c of CASES) {
  const o = mk(LIVE, 1000, 1400, { upperBars: c.upper, lowerBars: c.lower });
  const g = glassRows(o);
  ok(g.length === 2 && g[0].sash === 'upper' && g[0].bars === c.upper && g[1].sash === 'lower' && g[1].bars === c.lower,
    `${c.label}: glass rows upper bars ${g[0]?.bars}, lower bars ${g[1]?.bars}`);
  const gw = 708, gh = o.derived.topSashHeight - 100;
  const barU = COUNTS[c.upper].v * gh + COUNTS[c.upper].h * gw;
  const barL = COUNTS[c.lower].v * gh + COUNTS[c.lower].h * gw;
  const tri = beadingRow(o, 'TRIANGLE BEADING (EXT)'), geo = beadingRow(o, 'GEORGIAN MIDDLE BEADING');
  const len = Math.round((barU + barL) * 1.15 * 100) / 100;
  const notes = `Bars ${Math.round(barU * 100) / 100} + ${Math.round(barL * 100) / 100} + 15%`;
  ok(tri && geo && near(tri.length, len, 0.01) && near(geo.length, len, 0.01) && tri.notes === notes && geo.notes === notes,
    `${c.label}: triangle and Georgian beading ${tri?.length} (= (${barU} + ${barL}) x 1.15), notes "${tri?.notes}"`);
  // bead tape and silicone are linear in the bar run: half way between none / none and the same pattern on both
  const both = (p) => mk(LIVE, 1000, 1400, { upperBars: p, lowerBars: p }).derived.consumables;
  const own = o.derived.consumables;
  const pat = c.upper !== 'none' ? c.upper : c.lower;
  const a = both('none'), b = both(pat);
  const mid = (k, sub) => (Number(a[k]?.[sub]) + Number(b[k]?.[sub])) / 2;
  ok(near(own.beadTape.meters, mid('beadTape', 'meters'), 0.011) && own.silicone.tubes >= a.silicone.tubes && own.silicone.tubes <= b.silicone.tubes,
    `${c.label}: bead tape ${own.beadTape.meters} m between none ${a.beadTape.meters} and ${pat} on both ${b.beadTape.meters}; silicone ${own.silicone.tubes} tubes`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - glass DXF');
const dxfBars = (M, o) => M.glassDxf.glassUnitsForWindow(o.spec, o.derived).map((u) => (u.rect?.bars || []).map((b) => `${b.id}@${b.from.map((v) => Math.round(v * 100) / 100).join(',')}`));
for (const c of CASES) {
  const o = mk(LIVE, 1000, 1400, { upperBars: c.upper, lowerBars: c.lower });
  const units = LIVE.glassDxf.glassUnitsForWindow(o.spec, o.derived);
  const nU = units[0]?.rect?.bars.length, nL = units[1]?.rect?.bars.length;
  ok(units.length === 2 && nU === COUNTS[c.upper].v + COUNTS[c.upper].h && nL === COUNTS[c.lower].v + COUNTS[c.lower].h,
    `${c.label}: the glass DXF unit bars upper ${nU}, lower ${nL}`);
  // each unit carries exactly the bars START gave a window with THAT pattern on both sashes
  const su = mk(START, 1000, 1400, { upperBars: c.upper, lowerBars: c.upper }), sl = mk(START, 1000, 1400, { upperBars: c.lower, lowerBars: c.lower });
  ok(JSON.stringify(dxfBars(LIVE, o)[0]) === JSON.stringify(dxfBars(START, su)[0]) && JSON.stringify(dxfBars(LIVE, o)[1]) === JSON.stringify(dxfBars(START, sl)[1]),
    `${c.label}: upper unit bars = START ${c.upper} window, lower unit bars = START ${c.lower} window (${JSON.stringify(dxfBars(LIVE, o))})`);
  const ents = units.map((u) => LIVE.glassDxf.buildRectUnitEntities(u, 'W').entities);
  const sEnts = [START.glassDxf.buildRectUnitEntities(START.glassDxf.glassUnitsForWindow(su.spec, su.derived)[0], 'W').entities, START.glassDxf.buildRectUnitEntities(START.glassDxf.glassUnitsForWindow(sl.spec, sl.derived)[1], 'W').entities];
  ok(JSON.stringify(ents) === JSON.stringify(sEnts), `${c.label}: the DXF entities of both units (contour, edge, bar axes and bands, text) equal those START units`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - canvas elevation');
const drawCalls = (M, item, fc = {}) => {
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : (...args) => { calls.push([k, ...args.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))]); })), set: (t, k, v) => { calls.push(['set', k, v]); return true; } });
  globalThis.window = { devicePixelRatio: 1 };
  const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: 800, height: 900 }) };
  M.canvas.drawTechnicalElevation(canvas, M.specification.normaliseToWindowSpec(item, { fullConfig: fc }), {});
  delete globalThis.window;
  return calls;
};
const canvasBars = (calls) => {
  const fills = calls.filter((c) => c[0] === 'fillRect');
  const sc = fills[1][3] / 1000;            // the frame outline: 1000 wide
  const glassW = 708 * sc;
  const panes = fills.filter((c) => near(c[3], glassW, 0.01) && c[4] > 50).slice(0, 2);
  const isBar = (c) => near(c[3], 18 * sc, 0.01) || near(c[4], 18 * sc, 0.01);
  const inPane = (p) => fills.filter((c) => isBar(c) && c[2] >= p[2] - 0.01 && c[2] + c[4] <= p[2] + p[4] + 0.01);
  return panes.map((p) => {
    const b = inPane(p);
    return { v: b.filter((c) => near(c[3], 18 * sc, 0.01)).length, h: b.filter((c) => near(c[4], 18 * sc, 0.01) && !near(c[3], 18 * sc, 0.01)).length };
  });
};
for (const c of CASES) {
  const item = { id: 'c', name: 'C', width: 1000, height: 1400, upperBars: c.upper, lowerBars: c.lower };
  const [u, l] = canvasBars(drawCalls(LIVE, item));
  ok(u && l && u.v === COUNTS[c.upper].v && u.h === COUNTS[c.upper].h && l.v === COUNTS[c.lower].v && l.h === COUNTS[c.lower].h,
    `${c.label}: canvas bars upper pane ${u?.v}V ${u?.h}H, lower pane ${l?.v}V ${l?.h}H`);
}
{
  const [u, l] = canvasBars(drawCalls(LIVE, { id: 'c', name: 'C', width: 1000, height: 1400 }, { upperBars: '6x6', lowerBars: 'none' }));
  ok(u.v === 2 && u.h === 1 && l.v === 0 && l.h === 0, `PSW item with the bars only in fullConfig: canvas upper ${u.v}V ${u.h}H, lower ${l.v}V ${l.h}H`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - sheets');
const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const rects = (svg) => (svg.match(/<rect /g) || []).length;
for (const c of CASES) {
  const o = mk(LIVE, 1000, 1400, { upperBars: c.upper, lowerBars: c.lower });
  const su = mk(START, 1000, 1400, { upperBars: c.upper, lowerBars: c.upper }), sl = mk(START, 1000, 1400, { upperBars: c.lower, lowerBars: c.lower });
  const sheet = (M, x, Comp, type) => render(M[Comp], { windowSpec: x.spec, derived: x.derived, type });
  ok(sheet(LIVE, o, 'SashDetail', 'upper') === sheet(START, su, 'SashDetail', 'upper') && sheet(LIVE, o, 'SashDetail', 'lower') === sheet(START, sl, 'SashDetail', 'lower'),
    `${c.label}: the upper sash sheet = START sheet of a ${c.upper} window, the lower = START sheet of a ${c.lower} window`);
  ok(sheet(LIVE, o, 'GlassDrawing', 'upper') === sheet(START, su, 'GlassDrawing', 'upper') && sheet(LIVE, o, 'GlassDrawing', 'lower') === sheet(START, sl, 'GlassDrawing', 'lower'),
    `${c.label}: the upper glass sheet = START ${c.upper}, the lower glass sheet = START ${c.lower}`);
  const tu = texts(sheet(LIVE, o, 'SashDetail', 'upper')).join(' | '), tl = texts(sheet(LIVE, o, 'SashDetail', 'lower')).join(' | ');
  ok(tu.includes(`${c.upper} · double`) && tl.includes(`${c.lower} · double`), `${c.label}: the sash sheets print "${c.upper} · double" and "${c.lower} · double"`);
  // the elevation: each sash's bars; the rect count moves by exactly the other sash's bars
  const el = (M, x) => render(M.FrontElevation, { windowSpec: x.spec, derived: x.derived });
  const both = (p) => el(LIVE, mk(LIVE, 1000, 1400, { upperBars: p, lowerBars: p }));
  const n = rects(el(LIVE, o));
  const nNone = rects(both('none')), nU = rects(both(c.upper)), nL = rects(both(c.lower));
  const perSash = (p) => (rects(both(p)) - nNone) / 2;
  ok(n - nNone === perSash(c.upper) + perSash(c.lower) && (nU - nNone) % 2 === 0 && (nL - nNone) % 2 === 0,
    `${c.label}: the elevation draws ${n - nNone} bar rects (upper ${perSash(c.upper)} + lower ${perSash(c.lower)}; none ${nNone}, ${c.upper} on both ${nU}, ${c.lower} on both ${nL})`);
  for (const p of [c.upper, c.lower]) ok(el(LIVE, mk(LIVE, 1000, 1400, { upperBars: p, lowerBars: p })) === el(START, mk(START, 1000, 1400, { upperBars: p, lowerBars: p })), `elevation ${p} on both sashes: byte-identical to START`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - 3D (windowSpecToConfig, ParametricSashWindow)');
const newCanvas = () => ({ width: 800, height: 600, style: {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; }, clientWidth: 800, clientHeight: 600, parentElement: null });
const gl = (canvas) => ({ render() {}, setPixelRatio() {}, getPixelRatio: () => 1, setSize() {}, setAnimationLoop() {}, dispose() {},
  xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} },
  shadowMap: { enabled: false }, domElement: canvas, info: { render: {} }, outputColorSpace: '', toneMapping: 0 });
async function meshes(M, props) {
  M.extend(M.THREE);
  const canvas = newCanvas();
  const root = M.createRoot(canvas);
  await root.configure({ gl: () => gl(canvas), frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 }, events: undefined });
  const store = root.render(M.createElement(M.PSW.default, props));
  await new Promise((r) => setTimeout(r, 300));
  const scene = store.getState().scene;
  scene.updateMatrixWorld(true);
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const b = new M.THREE.Box3().setFromObject(o);
    const mmr = (v) => Math.round(v * 1e5) / 100;
    out.push({ kind: o.geometry.type, min: [mmr(b.min.x), mmr(b.min.y), mmr(b.min.z)], max: [mmr(b.max.x), mmr(b.max.y), mmr(b.max.z)] });
  });
  root.unmount();
  return out;
}
const mkey = (m) => `${m.kind}|${m.min.join(',')}|${m.max.join(',')}`;
const cfgOf = (M, extra, fc = {}) => M.wsc.windowSpecToConfig(M.specification.normaliseToWindowSpec({ id: 'v', name: 'V', width: 1000, height: 1400, ...extra }, { fullConfig: fc }));
for (const c of CASES) {
  const cfg = cfgOf(LIVE, { upperBars: c.upper, lowerBars: c.lower });
  ok(cfg.upperBars === c.upper && cfg.lowerBars === c.lower, `${c.label}: the 3D config upperBars ${cfg.upperBars}, lowerBars ${cfg.lowerBars}`);
  const ms = await meshes(L3, cfg);
  // Change ONE sash's pattern (to the other value of this case) and diff the meshes: every mesh that
  // changes must lie in THAT sash. The lower sash at 1000 wide; the upper sash at 1300 wide, where
  // ParametricSashWindow draws two fasteners whatever the bars (below 1200 the PSW rule adds the second
  // fastener when upperBars is not none, and that rule is not a bar).
  const pat = c.upper !== 'none' ? c.upper : c.lower;
  const swap = (x) => (x === 'none' ? pat : 'none');
  const diffOf = (a, b) => { const ka = new Set(a.map(mkey)), kb = new Set(b.map(mkey)); return [...a.filter((m) => !kb.has(mkey(m))), ...b.filter((m) => !ka.has(mkey(m)))]; };
  const midY = (m) => (m.min[1] + m.max[1]) / 2;
  const meetOf = (list) => (Math.min(...list.map((m) => m.min[1])) + Math.max(...list.map((m) => m.max[1]))) / 2;
  const lowerDiff = diffOf(ms, await meshes(L3, cfgOf(LIVE, { upperBars: c.upper, lowerBars: swap(c.lower) })));
  const msW = await meshes(L3, cfgOf(LIVE, { width: 1300, upperBars: c.upper, lowerBars: c.lower }));
  const upperDiff = diffOf(msW, await meshes(L3, cfgOf(LIVE, { width: 1300, upperBars: swap(c.upper), lowerBars: c.lower })));
  const meet = meetOf(ms), meetW = meetOf(msW);
  ok(lowerDiff.length > 0 && lowerDiff.every((m) => midY(m) < meet) && upperDiff.length > 0 && upperDiff.every((m) => midY(m) > meetW),
    `${c.label}: changing the lower pattern changes ${lowerDiff.length} meshes, all in the lower sash; changing the upper pattern changes ${upperDiff.length}, all in the upper sash`);
  // and the barred sash of this case carries bar meshes, the other none: against none / none at 1300
  const none = await meshes(L3, cfgOf(LIVE, { width: 1300, upperBars: 'none', lowerBars: 'none' }));
  const extra = diffOf(msW, none);
  const barred = c.upper !== 'none' ? 'upper' : 'lower';
  ok(extra.length > 0 && (barred === 'upper' ? extra.every((m) => midY(m) > meetW) : extra.every((m) => midY(m) < meetW)),
    `${c.label}: ${extra.length} bar meshes against a window without bars, all in the ${barred} sash`);
}
{
  const cfg = cfgOf(LIVE, {}, { upperBars: '6x6', lowerBars: 'none' });
  ok(cfg.upperBars === '6x6' && cfg.lowerBars === 'none', `PSW item with the bars only in fullConfig: the 3D config ${cfg.upperBars} / ${cfg.lowerBars}`);
  const up = [{ type: 'v', mm: 300 }], lo = [{ type: 'h', mm: 200 }];
  const cc = cfgOf(LIVE, { upperBars: 'custom', lowerBars: 'custom', upperCustomBars: up, lowerCustomBars: lo });
  ok(cc.upperBars === 'custom' && cc.lowerBars === 'custom' && JSON.stringify(cc.upperCustomBars) === JSON.stringify(up) && JSON.stringify(cc.lowerCustomBars) === JSON.stringify(lo),
    `custom per sash: the 3D gets each sash its own list (${JSON.stringify(cc.upperCustomBars)} / ${JSON.stringify(cc.lowerCustomBars)})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - controls: the same pattern on both sashes equals START');
const stripLive = (d) => { const c = clone(d); delete c.bars; return c; };
const stripStart = (d) => { const c = clone(d); delete c.glazingItems; return c; };
const stripSpec = (sp) => { const c = clone(sp); if (c.sash?.grid) { delete c.sash.grid.upper; delete c.sash.grid.lower; } return c; };
const SAME = [
  ['none', {}], ['2x2', {}], ['4x4', {}], ['6x6', {}], ['9x9', {}],
  ['6x6 cottage-40-60', { sashProportion: 'cottage-40-60' }],
  ['custom', { upperCustomBars: [{ type: 'v', mm: 300 }, { type: 'h', mm: 250 }] }],
];
for (const [label, extra] of SAME) {
  const p = label.split(' ')[0];
  const item = { upperBars: p, lowerBars: p, ...extra };
  const a = mk(LIVE, 1000, 1400, item), b = mk(START, 1000, 1400, item);
  ok(JSON.stringify(stripSpec(a.spec)) === JSON.stringify(b.spec), `${label}: windowSpec equal to START but for grid.upper / grid.lower`);
  ok(JSON.stringify(stripLive(a.derived)) === JSON.stringify(stripStart(b.derived)), `${label}: derived byte-identical to START but for derived.bars (new) and glazingItems (removed)`);
  ok(JSON.stringify(LI.buildGlassListForWindow(a.derived, a.spec)) === JSON.stringify(START.lists.buildGlassListForWindow(b.derived, b.spec))
    && JSON.stringify(LI.buildCutListForWindow(a.derived, a.spec)) === JSON.stringify(START.lists.buildCutListForWindow(b.derived, b.spec)),
    `${label}: glass rows and cut list equal START`);
  const sheets = (M, x) => ['upper', 'lower'].flatMap((t) => [render(M.SashDetail, { windowSpec: x.spec, derived: x.derived, type: t }), render(M.GlassDrawing, { windowSpec: x.spec, derived: x.derived, type: t })]).concat(render(M.FrontElevation, { windowSpec: x.spec, derived: x.derived }));
  ok(JSON.stringify(sheets(LIVE, a)) === JSON.stringify(sheets(START, b)), `${label}: the two sash sheets, the two glass sheets and the elevation byte-identical to START`);
  ok(JSON.stringify(dxfBars(LIVE, a)) === JSON.stringify(dxfBars(START, b)), `${label}: glass DXF bars equal START`);
  ok(JSON.stringify(cfgOf(LIVE, item)) === JSON.stringify(cfgOf(START, item)), `${label}: the 3D config equal to START`);
}
{
  const item = { id: 'c', name: 'C', width: 1000, height: 1400 };
  ok(JSON.stringify(drawCalls(LIVE, item)) === JSON.stringify(drawCalls(START, item)), 'canvas, no bars: every draw call equal to START (a barred window draws each pane from derived.bars: t43 section 8)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - the per-window boundary (windowBoundary.js)');
{
  const B = LIVE.boundary;
  const run = (win) => B.deriveWindowBounded(win, (ws) => CA.deriveWindowData(ws, {}));
  const good = run({ id: 'g', name: 'G1', width: 1000, height: 1400, upperBars: '6x6', lowerBars: 'none' });
  const prop = run({ id: 'p', name: 'P1', width: 1000, height: 1400, sashProportion: 'golden' });
  const bars = run({ id: 'b', name: 'B1', width: 1000, height: 1400, upperBars: '2x3' });
  const archErr = throwsOf(() => mk(LIVE, 1000, 2100, {}, { sashType: 'arched-group', archShape: 'semi-circle', sashProportion: 'cottage-40-60' }));
  ok(good.error === null && good.derived?.bars?.upper?.pattern === '6x6' && good.windowSpec, 'a good window derives inside the boundary (error null)');
  ok(prop.error?.name === 'SashProportionError' && prop.error.known && /Unknown sash proportion "golden" on window "P1"/.test(prop.error.message) && prop.derived === null,
    `unknown proportion: { name ${prop.error?.name}, message "${prop.error?.message}" }`);
  ok(bars.error?.name === 'BarPatternError' && bars.error.known && /"2x3" on the upper sash of window "B1"/.test(bars.error.message) && bars.windowSpec === null,
    `unknown bar pattern: { name ${bars.error?.name} } (raised by the normaliser, so windowSpec is null)`);
  ok(archErr?.name === 'SashProportionError', `arched + cottage raises ${archErr?.name} (a known window error)`);
  ok(B.isWindowDataError(new LIVE.arch.ArchError('x')) && !B.isWindowDataError(new Error('x')) && B.windowErrorOf(new Error('boom')).known === false, 'ArchError is a window data error; a plain Error is reported but not "known"');
  const crash = B.deriveWindowBounded({ id: 'c', name: 'C1', width: 1000, height: 1400 }, () => { throw new TypeError('bug'); });
  ok(crash.error?.name === 'TypeError' && crash.error.known === false && crash.derived === null, 'any other error is still caught for that window (the pages caught every derive error before)');
  const split = B.splitBounded([good, prop, bars, crash]);
  ok(split.ok.length === 1 && split.excluded.length === 3 && split.ok[0] === good, `splitBounded: ${split.ok.length} ok, ${split.excluded.length} excluded`);
  ok(B.excludedWindowsNote(split.excluded) === '3 windows excluded from the lists and PDFs: P1, B1, C1' && B.excludedWindowsNote([prop]) === '1 window excluded from the lists and PDFs: P1' && B.excludedWindowsNote([]) === '',
    `the note: "${B.excludedWindowsNote(split.excluded)}"`);
  ok(B.sashBarsLabel(good.windowSpec) === '6x6 / none' && B.sashBarsLabel(mk(LIVE, 1000, 1400, { upperBars: '2x2', lowerBars: '2x2' }).spec) === '2x2'
    && B.sashBarsLabel(mk(LIVE, 1000, 1400, {}, { upperBars: '6x6', lowerBars: 'none' }).spec) === '6x6 / none',
    'sashBarsLabel: "6x6 / none" for 6 over 1, "2x2" when both agree, fullConfig bars included');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - pages in a browser: project, window detail, production pack');
let chromium = null;
try {
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  const entry = resolve(globalRoot, 'playwright', 'index.mjs');
  if (existsSync(entry)) ({ chromium } = await import(pathToFileURL(entry).href));
} catch { chromium = null; }
if (!chromium) {
  ok(false, 'playwright (global node install) and its Chromium are needed for the page checks (as t39 / t43)');
} else {
  const entry = resolve(AUDIT, 't45-pages-entry.jsx');
  writeFileSync(entry, [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { MemoryRouter, Routes, Route } from 'react-router-dom';",
    "import ProjectDetailPage from '../src/pages/ProjectDetailPage.jsx';",
    "import WindowDetailPage from '../src/pages/WindowDetailPage.jsx';",
    "import ProductionPackPage from '../src/pages/ProductionPackPage.jsx';",
    "import SettingsPage from '../src/pages/SettingsPage.jsx';",
    "import { useProjectStore } from '../src/stores/projectStore.js';",
    "import { useEstimateStore } from '../src/stores/estimateStore.js';",
    'window.__store = useProjectStore;',
    'window.__est = useEstimateStore;',
    'window.confirm = () => true; window.alert = () => {};',
    "const root = createRoot(document.getElementById('root'));",
    'const E = React.createElement;',
    'window.__mount = (path) => root.render(E(MemoryRouter, { key: path + Math.random(), initialEntries: [path] }, E(Routes, null,',
    "  E(Route, { path: '/projects/:projectId', element: E(ProjectDetailPage) }),",
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/windows/:windowId', element: E(WindowDetailPage) }),",
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/production-pack', element: E(ProductionPackPage) }),",
    "  E(Route, { path: '/settings', element: E(SettingsPage) }),",
    "  E(Route, { path: '*', element: E('div', { id: 'elsewhere' }, 'elsewhere') }))));",
  ].join('\n'));
  const bundleOut = resolve(AUDIT, 't45-pages-bundle.js');
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=iife', '--platform=browser',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--define:process.env.NODE_ENV="production"', '--log-level=error',
    '--alias:jspdf-autotable=jspdf-autotable/es', `--outfile=${bundleOut}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const html = resolve(AUDIT, 't45-pages.html');
  writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="t45-pages-bundle.js"></script></body></html>');

  const browserApp = await chromium.launch();
  const page = await browserApp.newPage({ viewport: { width: 1600, height: 1100 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
  // no network: the 3D tab's environment map (an .hdr from a CDN) gets a valid 1 x 1 Radiance file (as t43),
  // everything else is refused
  const hdr = Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n', 'latin1'), Buffer.from([128, 128, 128, 128])]);
  await page.route(/^https?:/, (r) => (r.request().url().endsWith('.hdr') ? r.fulfill({ status: 200, contentType: 'application/octet-stream', body: hdr }) : r.abort()));
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => !!window.__store);
  // one project, one sash batch: a 6 over 1 window, a window with an unknown proportion,
  // one with an unknown bar pattern, a PSW-style window with the bars only in fullConfig
  const ids = await page.evaluate(() => {
    const st = window.__store.getState();
    const p = st.createProject('Bars', '', 'P-45');
    const b = window.__store.getState().createBatch(p.id, 'sash');
    const add = (cfg) => window.__store.getState().addWindowToBatch(p.id, b.id, cfg);
    const good = add({ windowName: 'SIX', extWidth: 1000, extHeight: 1400, upperBars: '6x6', lowerBars: 'none', sameBars: false });
    const prop = add({ windowName: 'BADP', extWidth: 1000, extHeight: 1400 });
    const bars = add({ windowName: 'BADB', extWidth: 1000, extHeight: 1400 });
    const psw = add({ windowName: 'PSW', extWidth: 1000, extHeight: 1400 });
    // the stored values a configurator never writes (an older PSW or a hand edit): set on the record
    window.__store.setState((s) => ({
      projects: s.projects.map((pp) => (pp.id !== p.id ? pp : { ...pp, batches: pp.batches.map((bb) => (bb.id !== b.id ? bb : { ...bb, windows: bb.windows.map((w) => {
        if (w.id === prop) return { ...w, sashProportion: 'golden' };
        if (w.id === bars) return { ...w, upperBars: '2x3' };
        if (w.id === psw) return { ...w, upperBars: undefined, lowerBars: undefined, specification: JSON.stringify({ fullConfig: { upperBars: '6x6', lowerBars: 'none' } }) };
        return w;
      }) })) }),
      ),
    }));
    window.__store.getState().setCurrentProject(window.__store.getState().projects.find((pp) => pp.id === p.id));
    return { p: p.id, b: b.id, good, prop, bars, psw };
  });
  const mount = async (path) => { await page.evaluate((x) => window.__mount(x), path); await page.waitForTimeout(600); };
  const body = async () => page.locator('body').innerText();
  const waitText = async (t) => { try { await page.waitForSelector(`text=${t}`, { timeout: 15000 }); return true; } catch { console.log(`  (waiting for "${t}": page errors ${JSON.stringify(pageErrors.slice(-3))}; body ${JSON.stringify((await body()).slice(0, 300))})`); return false; } };

  // ── project page: every card renders; the two bad windows show their message ──
  await mount(`/projects/${ids.p}`);
  await waitText('BADB');
  let t = await body();
  const cardText = async (id) => { const l = page.locator(`[data-window-error="${id}"]`); return (await l.count()) ? (await l.innerText()).trim() : null; };
  ok(['SIX', 'BADP', 'BADB', 'PSW'].every((n) => t.includes(n)) && pageErrors.length === 0, `project page: the four cards render (page errors ${JSON.stringify(pageErrors)})`);
  const eP = await cardText(ids.prop), eB = await cardText(ids.bars);
  ok(/Unknown sash proportion "golden" on window "BADP"/.test(eP || '') && /Unknown bar pattern "2x3" on the upper sash of window "BADB"/.test(eB || '') && (await cardText(ids.good)) === null,
    `project page: the BADP card reads "${eP}", the BADB card "${eB}", SIX has no error line`);
  ok(t.includes('Bars: 6x6 / none'), 'project page: the 6 over 1 card reads "Bars: 6x6 / none" (and the PSW card too: its bars live in fullConfig)');
  ok((t.match(/Bars: 6x6 \/ none/g) || []).length === 2, `project page: two cards with "Bars: 6x6 / none" (${(t.match(/Bars: 6x6 \/ none/g) || []).length})`);

  // ── window detail: the bad window shows its message, the good one renders ──
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${ids.prop}`);
  await waitText('This window cannot be calculated');
  t = await body();
  ok(/Unknown sash proportion "golden" on window "BADP"/.test(t) && pageErrors.length === 0, `window detail BADP: the page renders with the message (page errors ${JSON.stringify(pageErrors.slice(-2))})`);
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${ids.bars}`);
  await waitText('This window cannot be calculated');
  t = await body();
  ok(/Unknown bar pattern "2x3" on the upper sash of window "BADB"/.test(t) && pageErrors.length === 0, 'window detail BADB: the page renders with the message');
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${ids.good}`);
  await waitText('Sashes & Bars');
  t = await body();
  ok(t.includes('Sashes & Bars') && !/Unknown/.test(t), 'window detail SIX: the spec panel renders, no error');
  const specRow = (label) => page.locator('div.flex.justify-between', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).first();
  ok((await specRow('Upper').innerText()).includes('6x6') && (await specRow('Lower').innerText()).includes('none'), 'window detail SIX: Upper 6x6, Lower none');
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${ids.psw}`);
  await waitText('Sashes & Bars');
  ok((await specRow('Upper').innerText()).includes('6x6') && (await specRow('Lower').innerText()).includes('none'), 'window detail PSW (bars only in fullConfig): Upper 6x6, Lower none');

  // ── production pack: the header count, the note, the good windows render ──
  await mount(`/projects/${ids.p}/batches/${ids.b}/production-pack`);
  await waitText('excluded from the lists');
  t = await body();
  const note = page.locator('[data-excluded-note]');
  const noteText = (await note.count()) ? await note.first().innerText() : '';
  ok(/2 windows excluded from the lists and PDFs: BADP, BADB/.test(noteText) && pageErrors.length === 0, `pack: the excluded note "${noteText.replace(/\s+/g, ' ').slice(0, 200)}" (page errors ${JSON.stringify(pageErrors.slice(-2))})`);
  ok(/Unknown sash proportion "golden"/.test(t) && /Unknown bar pattern "2x3"/.test(t), 'pack: each excluded window shows its message');
  const row = (name) => page.locator('tr', { has: page.locator('td', { hasText: new RegExp(`^${name}$`) }) });
  ok((await row('SIX').count()) === 1 && (await row('PSW').count()) === 1 && (await row('BADP').count()) === 0 && (await row('BADB').count()) === 0,
    'pack overview: SIX and PSW listed, BADP and BADB left out of the table');
  const barsCell = async (name) => ((await row(name).count()) ? (await row(name).first().locator('td').nth(5).innerText()).trim() : null);
  const bSix = await barsCell('SIX'), bPsw = await barsCell('PSW');
  ok(bSix === '6x6 / none' && bPsw === '6x6 / none', `pack overview bars: SIX "${bSix}", PSW "${bPsw}"`);

  // ── Pricing Settings: "Cottage sash surcharge" next to "Arched head" (owner box item 18) ──
  // a stored price list from before the field (no cottageSash) shows the 5 % default; a saved value is stored
  await page.evaluate(() => window.__est.setState({ pricingSettings: { archedHead: 0.2 }, pricingLoaded: true }));
  await mount('/settings');
  await page.locator('button', { hasText: /^Pricing/ }).first().click();   // the tab reads "Pricing ADMIN"
  await waitText('Cottage sash surcharge');
  // the PctF field: its label element, then the number input in the same wrapper
  const pct = (label) => page.locator(`xpath=//*[normalize-space(text())="${label}"]/parent::div//input[@type="number"]`).first();
  const labels = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0).map((e) => e.textContent.trim()).filter((t) => t === 'Arched head' || t === 'Cottage sash surcharge'));
  ok(labels.indexOf('Arched head') >= 0 && labels.indexOf('Cottage sash surcharge') === labels.indexOf('Arched head') + 1,
    `Pricing Settings: "Cottage sash surcharge" right after "Arched head" (${JSON.stringify(labels)})`);
  const v0 = await pct('Cottage sash surcharge').inputValue();
  ok(v0 === '5' && (await pct('Arched head').inputValue()) === '20', `the stored list without the field shows ${v0} % (DEFAULT_PRICING.cottageSash 0.05), its own arched head 20 %`);
  await pct('Cottage sash surcharge').fill('7');
  await page.locator('button', { hasText: /^Save pricing$/ }).first().click();
  await page.waitForTimeout(200);
  const savedP = await page.evaluate(() => window.__est.getState().pricingSettings);
  ok(Math.abs((savedP?.cottageSash ?? 0) - 0.07) < 1e-9 && Math.abs((savedP?.archedHead ?? 0) - 0.2) < 1e-9, `save: cottageSash ${savedP?.cottageSash}, archedHead ${savedP?.archedHead} (the same save path as the arched head)`);
  await browserApp.close();
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? 'FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
