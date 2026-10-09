/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t43_sash_proportions: cottage sash proportions (Piotr 09.10.2026), measured on the
 * derived data and on the components that reach the screen, against the start of
 * this tura (default 719bfba, `git archive`; pass another ref as the first argument).
 *
 *   1  the owner box table (CLAUDE.md 3.3): every row of a double 1000 wide, total /
 *      top / bottom to 0.001, the upper and lower glass units to 0.01, the stiles and
 *      the meeting line fraction from the one helper
 *   2  triple 1800 x 1400 cottage-40-60: the centre and both FIX lights 523.2 / 784.8,
 *      their glass rows 446.2 / 674.8
 *   3  import rules: the PSW field (item and fullConfig), missing / null / empty =
 *      standard, glazing arch derives, arched + cottage and an unknown value raise the
 *      explicit SashProportionError, a casement ignores the field, below 900 still
 *      derives, the configurator rule (effectiveSashProportion)
 *   4  weights and consumables: the cottage top sash lighter, the bottom one heavier;
 *      the window totals (kg, glass m2, beading, bead tape, silicone) equal standard;
 *      the glazing summary has one row per sash for cottage
 *   5  pricing: factor 1.05; glazing arch + non-white single colour 1.10 x 1.05 x 1.05;
 *      the breakdown cottageSurcharge; standard prices equal START
 *   6  3D: ParametricSashWindow mounted the t40 way from windowSpecToConfig (the
 *      preview path): the meeting rail at 0.5130 / 0.6034 / 0.6723 of the opening
 *      (0.5 mm); standard against START moves only in y; no fraction = START byte for
 *      byte; triple on one line; the two opening limits
 *   7  controls: standard windows derived byte-identical to START but for the two new
 *      keys, lists and BOM equal; casement, fixed, circle and doors deep-equal
 *   8  sheets and exports: cottage sheets print the derived numbers, standard sheets
 *      and the DXF equal START, the overview PDF prints the label for cottage only
 *   9  pages in a browser (Playwright, like t39): the configurator control, its 3D
 *      payload and save / edit, an unknown stored value; the estimate configurator
 *      price; the window detail page row and warning; the pack overview type cell;
 *      the estimate PDF type row
 * Bars: the engine reads upperBars / lowerBars from the window record (item), not
 * from fullConfig, so every barred case here puts them on the item.
 *
 * Run: node verify/parity/t43_sash_proportions.mjs [git-ref]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const startHash = process.argv[2] || '719bfba55eda65ab2787cac35256c750d0e47af5';
const startTag = `t43-start-${startHash.slice(0, 12).replace(/[^\w.-]+/g, '_')}`;
const startTree = resolve(AUDIT, `${startTag}-tree`);
rmSync(startTree, { recursive: true, force: true });
mkdirSync(startTree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${startHash} src | tar -x -C "${startTree}"`], { cwd: ROOT, stdio: 'inherit' });

const ESBUILD = ['-y', 'esbuild@0.25.0'];
// Engine, lists, BOM, pricing, sheets and exports of one tree (react / jspdf / three external).
function bundleEngine(srcRoot, name) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    ...['specification', 'calculations', 'lists', 'bom', 'profile', 'pricing'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    `export * as store from '${rel('stores/materialAssignmentStore.js')}';`,
    `export * as wsc from '${rel('utils/windowSpecToConfig.js')}';`,
    `export * as dxf from '${rel('utils/dxfExport.js')}';`,
    `export * as overview from '${rel('utils/overviewPdfExport.js')}';`,
    `export * as canvas from '${rel('engine/canvas-renderer.js')}';`,
    `export { default as FrontElevation } from '${rel('components/drawings/FrontElevation2D.jsx')}';`,
    `export { default as BoxDetail } from '${rel('components/drawings/BoxDetail2D.jsx')}';`,
    `export { default as SashDetail } from '${rel('components/drawings/SashDetail2D.jsx')}';`,
    `export { default as GlassDrawing } from '${rel('components/drawings/GlassDrawing2D.jsx')}';`,
    `export { default as VerticalSection } from '${rel('components/drawings/VerticalSection2D.jsx')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:jspdf-autotable', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
// The 3D of one tree: R3F, three, react and the sash component in ONE bundle (as t40).
function bundle3D(srcRoot, name, stubDrei = false) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const stub = resolve(AUDIT, 't43-drei-stub.mjs');
  writeFileSync(stub, 'export const Line = () => null;\nexport const Text = () => null;\n');
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
    ...(stubDrei ? [`--alias:@react-three/drei=${stub}`] : []),
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist/i.test(String(a[0]))) return; warn(...a); };

const LIVE = await bundleEngine(resolve(ROOT, 'src'), 't43-live');
const START = await bundleEngine(resolve(startTree, 'src'), startTag);
const L3 = await bundle3D(resolve(ROOT, 'src'), 't43-live-3d');
const S3 = await bundle3D(resolve(startTree, 'src'), `${startTag}-3d`);
// the triple branch always draws an axes gizmo with drei <Text> (a browser font): that bundle swaps drei
// for a stub (Line / Text render nothing), which leaves every member, glass and rail mesh as it is
const L3T = await bundle3D(resolve(ROOT, 'src'), 't43-live-3d-triple', true);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 1e-6) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const PROPS = ['standard', 'cottage-40-60', 'cottage-1-3'];
const mk = (M, w, h, fc = {}, extra = {}) => {
  const spec = M.specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: w, height: h, ...extra }, { fullConfig: fc });
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const recs = (d, name) => (d.components.sash || []).filter((r) => r.elementName === name);
const withoutNewKeys = (d) => { const c = { ...d }; delete c.sashProportion; delete c.meetingFraction; return c; };
const throwsName = (fn) => { try { fn(); return null; } catch (e) { return e; } };
const { specification: SP, calculations: CA, lists: LI } = LIVE;

// ═════════════════════════════════════════════════════════════════════════════
section('1 - the owner box table (CLAUDE.md 3.3), double 1000 wide');
// [frame H, proportion, total, top, bottom, upper unit H, lower unit H]: the binding numbers
const TABLE = [
  [900, 'standard', 808, 387.5, 420.5, 310.5, 310.5],
  [900, 'cottage-40-60', 808, 323.2, 484.8, 246.2, 374.8],
  [900, 'cottage-1-3', 808, 269.333, 538.667, 192.33, 428.67],
  [1400, 'standard', 1308, 637.5, 670.5, 560.5, 560.5],
  [1400, 'cottage-40-60', 1308, 523.2, 784.8, 446.2, 674.8],
  [1400, 'cottage-1-3', 1308, 436, 872, 359, 762],
  [1800, 'standard', 1708, 837.5, 870.5, 760.5, 760.5],
  [1800, 'cottage-40-60', 1708, 683.2, 1024.8, 606.2, 914.8],
  [1800, 'cottage-1-3', 1708, 569.333, 1138.667, 492.33, 1028.67],
  [2000, 'standard', 1908, 937.5, 970.5, 860.5, 860.5],
  [2000, 'cottage-40-60', 1908, 763.2, 1144.8, 686.2, 1034.8],
  [2000, 'cottage-1-3', 1908, 636, 1272, 559, 1162],
];
for (const [H, p, total, top, bottom, gu, gl] of TABLE) {
  const { spec, derived: d } = mk(LIVE, 1000, H, {}, { sashProportion: p });
  const g = LI.buildGlassListForWindow(d, spec);
  const helper = CA.sashHeightsFor(H, p);
  ok(spec.sash.proportion === p && d.sashProportion === p && near(d.sashHeight, total, 1e-3) && near(d.topSashHeight, top, 1e-3) && near(d.bottomSashHeight, bottom, 1e-3)
    && helper.total === d.sashHeight && helper.top === d.topSashHeight && helper.bottom === d.bottomSashHeight,
    `${H} ${p}: total ${d.sashHeight}, top ${+d.topSashHeight.toFixed(3)}, bottom ${+d.bottomSashHeight.toFixed(3)} (box ${total} / ${top} / ${bottom}); derived = sashHeightsFor`);
  const up = g.find((r) => r.sash === 'upper'), lo = g.find((r) => r.sash === 'lower');
  ok(g.length === 2 && near(up.height, gu, 0.01) && near(lo.height, gl, 0.01) && near(up.width, 731, 0.01) && near(lo.width, 731, 0.01),
    `${H} ${p}: glass units 731 x ${up?.height} (upper) and 731 x ${lo?.height} (lower), box ${gu} / ${gl}`);
  const st = recs(d, 'STILES TOP (L)')[0], sb = recs(d, 'STILES BOTTOM SASH (L)')[0];
  ok(st && sb && near(st.length, Math.round(top * 100) / 100, 1e-9) && near(sb.length, Math.round(bottom * 100) / 100, 1e-9),
    `${H} ${p}: cut list stiles top ${st?.length} / bottom ${sb?.length} (the derived heights, 0.01 rounding of the record)`);
  // meeting line fraction by hand: (bottom - meet / 2) / (total - meet)
  ok(near(d.meetingFraction, (bottom - 21.5) / (total - 43), 1e-5) && d.meetingFraction === CA.meetingFractionFor(H, p),
    `${H} ${p}: meetingFraction ${d.meetingFraction.toFixed(4)} = (bottom - 21.5) / (total - 43), from meetingFractionFor`);
}
{
  const f = PROPS.map((p) => mk(LIVE, 1000, 1400, {}, { sashProportion: p }).derived.meetingFraction);
  ok(near(f[0], 0.5130, 5e-5) && near(f[1], 0.6034, 5e-5) && near(f[2], 0.6723, 5e-5), `1400: meetingFraction ${f.map((x) => x.toFixed(4)).join(' / ')} (box 0.5130 / 0.6034 / 0.6723)`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - triple 1800 x 1400 cottage-40-60: one meeting rail line');
{
  const { spec, derived: d } = mk(LIVE, 1800, 1400, { sashType: 'triple' }, { sashProportion: 'cottage-40-60' });
  for (const sfx of ['(FIX L)', '(C)', '(FIX R)']) {
    const t = [...recs(d, `STILES TOP (L) ${sfx}`), ...recs(d, `STILES TOP (R) ${sfx}`)], b = [...recs(d, `STILES BOTTOM SASH (L) ${sfx}`), ...recs(d, `STILES BOTTOM SASH (R) ${sfx}`)];
    ok(t.length === 2 && b.length === 2 && t.every((r) => near(r.length, 523.2, 1e-9)) && b.every((r) => near(r.length, 784.8, 1e-9)),
      `triple ${sfx}: top sash stiles ${t.map((r) => r.length).join(' / ')}, bottom sash stiles ${b.map((r) => r.length).join(' / ')} (523.2 / 784.8)`);
  }
  const g = LI.buildGlassListForWindow(d, spec);
  const byLoc = Object.fromEntries(g.map((r) => [r.location || r.label, r]));
  ok(g.length === 6 && ['fix L', 'centre', 'fix R'].every((s) => near(byLoc[`${s} upper`]?.height, 446.2, 0.01) && near(byLoc[`${s} lower`]?.height, 674.8, 0.01)),
    `triple glass rows: ${g.map((r) => `${r.location || r.label} ${r.width} x ${r.height}`).join(', ')}`);
  ok(d.tripleSections && d.topSashHeight === 523.2 && near(d.bottomSashHeight, 784.8, 1e-9) && near(d.meetingFraction, (784.8 - 21.5) / (1308 - 43), 1e-12),
    `triple derived: top ${d.topSashHeight}, bottom ${d.bottomSashHeight}, meetingFraction ${d.meetingFraction.toFixed(4)} (one line for the centre and the FIX lights)`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - import rules (the PSW contract) and the explicit error');
{
  const a = mk(LIVE, 1000, 1400, {}, { sashProportion: 'cottage-40-60' });
  const b = mk(LIVE, 1000, 1400, { sashProportion: 'cottage-40-60' });   // PSW: in the estimate fullConfig
  ok(b.spec.sash.proportion === 'cottage-40-60' && JSON.stringify(a.derived) === JSON.stringify(b.derived), 'fullConfig.sashProportion is read like splitRatio (item first, then fullConfig)');
  const c = mk(LIVE, 1000, 1400, { sashProportion: 'cottage-1-3' }, { sashProportion: 'cottage-40-60' });
  ok(c.spec.sash.proportion === 'cottage-40-60', 'the item value wins over fullConfig (item?.sashProportion || fc.sashProportion)');
  const std = mk(LIVE, 1000, 1400, {}, { sashProportion: 'standard' });
  for (const [label, extra] of [['missing', {}], ['null', { sashProportion: null }], ['empty', { sashProportion: '' }]]) {
    const x = mk(LIVE, 1000, 1400, {}, extra);
    ok(x.spec.sash.proportion === 'standard' && JSON.stringify(x.derived) === JSON.stringify(std.derived), `${label} field derives as standard`);
  }
  const ga = mk(LIVE, 1000, 1400, { headType: 'arch' }, { sashProportion: 'cottage-40-60' });
  ok(JSON.stringify(ga.derived) === JSON.stringify(a.derived) && ga.derived.topSashHeight === 523.2, 'glazing arch (headType arch) + cottage-40-60 derives (523.2 / 784.8; the engine draws the head flat, as today)');
  const unknown = throwsName(() => mk(LIVE, 1000, 1400, {}, { sashProportion: 'cottage-30-70', name: 'W7' }));
  ok(unknown && unknown.name === 'SashProportionError' && /cottage-30-70/.test(unknown.message) && /"X"|W7/.test(unknown.message), `unknown value: ${unknown?.name}: ${unknown?.message}`);
  const arched = [
    ['PSW arched-group', { sashType: 'arched-group', archShape: 'semi-circle' }],
    ['PC frameShape arched', { frameShape: 'arched', archShape: 'semi-circle' }],
  ];
  for (const [label, fc] of arched) {
    const e = throwsName(() => mk(LIVE, 1000, 1600, fc, { sashProportion: 'cottage-40-60' }));
    ok(e && e.name === 'SashProportionError' && /arched/.test(e.message), `${label} + cottage-40-60: ${e?.name}: ${e?.message}`);
    const s = mk(LIVE, 1000, 1600, fc, { sashProportion: 'standard' });
    ok(s.spec.arch?.shape && s.derived.arch && s.derived.sashProportion === 'standard', `${label} + standard still derives (arch ${s.spec.arch?.shape})`);
  }
  const helperErr = throwsName(() => CA.sashHeightsFor(1400, 'bogus'));
  ok(helperErr?.name === 'SashProportionError', 'sashHeightsFor raises the same error for an unknown value (no silent standard)');
  const cas = mk(LIVE, 1000, 1200, { windowCategory: 'casement', casementLayout: '040L', sashProportion: 'bogus' });
  ok(!('proportion' in cas.spec.sash) && !('sashProportion' in cas.derived), 'a casement ignores the field (no error, no key)');
  const low = mk(LIVE, 1000, 800, {}, { sashProportion: 'cottage-40-60' });
  ok(near(low.derived.topSashHeight, 708 * 0.4, 1e-9) && near(low.derived.bottomSashHeight, 708 * 0.6, 1e-9), `a stored cottage window below 900 still derives (800: ${low.derived.topSashHeight} / ${low.derived.bottomSashHeight})`);
  const eff = SP.effectiveSashProportion;
  ok(eff('cottage-40-60', { frameHeight: 899 }) === 'standard' && eff('cottage-40-60', { frameHeight: 900 }) === 'cottage-40-60' && eff('cottage-1-3', { frameHeight: 1400, arched: true }) === 'standard'
    && eff('standard', { frameHeight: 1400 }) === 'standard' && eff('', { frameHeight: 1400 }) === 'standard' && eff('cottage-30-70', { frameHeight: 1400 }) === 'cottage-30-70' && SP.COTTAGE_MIN_FRAME_HEIGHT === 900,
    'configurator rule: cottage from 900, standard on an arched sash, an unknown value passes through to the engine error');
  ok(JSON.stringify(SP.SASH_PROPORTION_OPTIONS) === JSON.stringify([{ value: 'standard', label: 'Standard' }, { value: 'cottage-40-60', label: 'Cottage 40/60' }, { value: 'cottage-1-3', label: 'Cottage 1/3-2/3' }]),
    'the three choices and their labels: Standard, Cottage 40/60, Cottage 1/3-2/3');
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - weights, consumables, beading, glazing summary');
const SUMMARY = [];
for (const H of [900, 1400, 1800, 2000]) {
  const by = Object.fromEntries(PROPS.map((p) => [p, mk(LIVE, 1000, H, {}, { sashProportion: p })]));
  const w = Object.fromEntries(PROPS.map((p) => [p, CA.sashWeightsFor(by[p].spec, by[p].derived)]));
  for (const p of PROPS.slice(1)) {
    ok(w[p].upperKg < w.standard.upperKg && w[p].lowerKg > w.standard.lowerKg,
      `${H} ${p}: top sash ${w[p].upperKg} kg < standard ${w.standard.upperKg}; bottom sash ${w[p].lowerKg} kg > standard ${w.standard.lowerKg}`);
    const d = by[p].derived, s = by.standard.derived;
    const bead = (x, n) => x.components.beading.find((r) => r.elementName === n)?.length;
    ok(d.weights.total === s.weights.total && d.weights.glass === s.weights.glass && d.consumables.glass.sqm === s.consumables.glass.sqm
      && bead(d, 'GLAZING BEADING') === bead(s, 'GLAZING BEADING') && d.consumables.beadTape.meters === s.consumables.beadTape.meters && d.consumables.silicone.tubes === s.consumables.silicone.tubes
      && d.consumables.seal6070.meters === s.consumables.seal6070.meters,
      `${H} ${p}: window totals equal standard (weight ${d.weights.total} kg, glass ${d.weights.glass} kg, ${d.consumables.glass.sqm} m2, glazing bead ${bead(d, 'GLAZING BEADING')}, tape ${d.consumables.beadTape.meters} m, silicone ${d.consumables.silicone.tubes})`);
    // each sash its own glass, by hand from the derived heights (glass W 708, unit = light + 23, double 21 kg/m2);
    // the old shortcut (upper pane x 2) would give the smaller numbers in brackets
    const gu = d.topSashHeight - 100, gl = d.bottomSashHeight - 133;
    const r2 = (v) => Math.round(v * 100) / 100;
    const kgHand = r2(708 * (gu + gl) / 1e6 * 21), sqmHand = r2((731 * (gu + 23) + 731 * (gl + 23)) / 1e6);
    ok(d.weights.glass === kgHand && d.consumables.glass.sqm === sqmHand && kgHand > r2(708 * gu * 2 / 1e6 * 21),
      `${H} ${p}: glass ${d.weights.glass} kg and ${d.consumables.glass.sqm} m2 from both panes (${gu.toFixed(2)} + ${gl.toFixed(2)}; upper x 2 would be ${r2(708 * gu * 2 / 1e6 * 21)} kg)`);
  }
  ok(near(w.standard.upperKg + w.standard.lowerKg, by.standard.derived.weights.total, 0.02), `${H} standard: top ${w.standard.upperKg} + bottom ${w.standard.lowerKg} = window ${by.standard.derived.weights.total} kg (0.02 rounding)`);
  SUMMARY.push([H, w]);
}
{
  const settings = { glazingAllowanceWidth: 0, glazingAllowanceHeight: 0 };
  const s = CA.deriveWindowData(SP.normaliseToWindowSpec({ id: 'g', name: 'G', width: 1000, height: 1400, sashProportion: 'standard', upperBars: '4x4', lowerBars: '4x4' }, { fullConfig: {} }), settings);
  const c = CA.deriveWindowData(SP.normaliseToWindowSpec({ id: 'g', name: 'G', width: 1000, height: 1400, sashProportion: 'cottage-40-60', upperBars: '4x4', lowerBars: '4x4' }, { fullConfig: {} }), settings);
  ok(s.config.rows === 2 && c.config.rows === 2, 'the 4x4 bars reach the engine (item level): 2 rows per sash');
  // the summary reads windowSpec.sash.grid (a '4x4' mode is 4 rows x 4 columns there, the legacy convention)
  const g = SP.normaliseToWindowSpec({ id: 'g', name: 'G', width: 1000, height: 1400, upperBars: '4x4', lowerBars: '4x4' }, { fullConfig: {} }).sash.grid;
  ok(s.glazingItems.length === 1 && !('sash' in s.glazingItems[0]) && s.glazingItems[0].panes === g.rows * g.cols * 2, `standard glazing summary: one legacy row (${s.glazingItems[0].width} x ${s.glazingItems[0].height}, ${s.glazingItems[0].panes} panes)`);
  const [u, l] = c.glazingItems;
  ok(c.glazingItems.length === 2 && u.sash === 'upper' && l.sash === 'lower' && near(u.height, (523.2 - 100) / g.rows, 0.01) && near(l.height, (784.8 - 133) / g.rows, 0.01)
    && u.panes === g.rows * g.cols && l.panes === g.rows * g.cols && u.width === s.glazingItems[0].width,
    `cottage glazing summary: upper ${u?.width} x ${u?.height}, lower ${l?.width} x ${l?.height} (each sash's daylight / ${g.rows} rows), ${u?.panes} + ${l?.panes} panes`);
  const bd = c.components.beading.find((r) => r.elementName === 'GLAZING BEADING');
  const perimU = 2 * (708 + (523.2 - 100)), perimL = 2 * (708 + (784.8 - 133));
  const barU = (523.2 - 100) + 708, barL = (784.8 - 133) + 708;   // 4x4: one vertical over the light, one horizontal across
  const tri = c.components.beading.find((r) => r.elementName === 'TRIANGLE BEADING (EXT)');
  ok(tri && tri.notes === `Bars ${Math.round(barU * 100) / 100} + ${Math.round(barL * 100) / 100} + 15%` && near(tri.length, Math.round((barU + barL) * 1.15 * 100) / 100, 1e-9),
    `cottage 4x4 bar beading: "${tri?.notes}" = ${tri?.length}`);
  ok(bd.notes === `Perim ${Math.round(perimU * 100) / 100} + ${Math.round(perimL * 100) / 100} + 15%` && near(bd.length, Math.round((perimU + perimL) * 1.15 * 100) / 100, 1e-9)
    && /× 2/.test(s.components.beading.find((r) => r.elementName === 'GLAZING BEADING').notes),
    `beading notes: cottage "${bd.notes}", standard keeps "× 2"`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - pricing');
{
  const P = LIVE.pricing, PS = START.pricing;
  const base = { windowType: 'sash', sashType: 'double', width: 1000, height: 1400, actualFrameWidth: 1000, actualFrameHeight: 1400, upperBars: 'none', lowerBars: 'none',
    glassType: 'double', glassSpec: 'toughened', glassFinish: 'clear', colorType: 'single', colorSingle: 'white', openingType: 'both', headType: 'flat', frameType: 'standard', sillExtension: 'none', pas24: 'no' };
  ok(P.DEFAULT_PRICING.cottageSash === 0.05 && P.resolvePricing({ basePricePerSqm: 900 }).cottageSash === 0.05, 'DEFAULT_PRICING.cottageSash 0.05; a tenant price list without it falls back to 0.05');
  const std = P.calculatePrice({ ...base });
  for (const p of ['cottage-40-60', 'cottage-1-3']) {
    const c = P.calculatePrice({ ...base, sashProportion: p });
    ok(near(Number(c.breakdown.subtotal), Number(std.breakdown.subtotal) * 1.05, 0.01) && near(c.unitPrice, std.unitPrice * 1.05, 0.01) && near(Number(c.breakdown.cottageSurcharge), Number(std.breakdown.subtotal) * 0.05, 0.01),
      `${p}: ${c.unitPrice} = ${std.unitPrice} x 1.05, cottageSurcharge ${c.breakdown.cottageSurcharge}`);
  }
  const full = { ...base, headType: 'arch', colorSingle: 'custom' };
  const c3 = P.calculatePrice({ ...full, sashProportion: 'cottage-40-60' });
  ok(near(c3.unitPrice, std.unitPrice * 1.10 * 1.05 * 1.05, 0.01), `glazing arch + non-white single colour + cottage: ${c3.unitPrice} = ${std.unitPrice} x 1.10 x 1.05 x 1.05`);
  const archOnly = P.calculatePrice({ ...base, headType: 'arch' });
  ok(near(Number(c3.breakdown.cottageSurcharge), Number(archOnly.breakdown.subtotal) * 0.05, 0.01), `the cottage factor sits after the arched head and before the colour: surcharge ${c3.breakdown.cottageSurcharge} = 5% of the arched subtotal ${archOnly.breakdown.subtotal}`);
  const tri = { ...base, sashType: 'triple', width: 1800, actualFrameWidth: 1800 };
  ok(near(P.calculatePrice({ ...tri, sashProportion: 'cottage-1-3' }).unitPrice, P.calculatePrice(tri).unitPrice * 1.05, 0.01), 'triple: factor 1.05 too');
  for (const cfg of [base, full, tri, { ...base, colorType: 'dual' }, { ...base, upperBars: '6x6', lowerBars: '6x6', quantity: 3 }]) {
    const a = P.calculatePrice({ ...cfg }), b = PS.calculatePrice({ ...cfg });
    const ab = { ...a.breakdown }; const okKey = ab.cottageSurcharge === '0.00'; delete ab.cottageSurcharge;
    ok(okKey && a.unitPrice === b.unitPrice && a.totalPrice === b.totalPrice && JSON.stringify(ab) === JSON.stringify(b.breakdown),
      `standard ${cfg.sashType} ${cfg.headType} ${cfg.colorType}/${cfg.colorSingle}${cfg.upperBars !== 'none' ? ` ${cfg.upperBars} x${cfg.quantity}` : ''}: price ${a.unitPrice} equal to START, breakdown equal but for cottageSurcharge 0.00`);
  }
  for (const cfg of [{ windowType: 'casement', casementLayout: '040L', width: 1000, height: 1200 }, { productType: 'door', doorType: 'single-external', width: 900, height: 2100, sameColor: true }]) {
    ok(JSON.stringify(P.calculatePrice({ ...cfg, sashProportion: 'cottage-40-60' })) === JSON.stringify(PS.calculatePrice(cfg)), `${cfg.windowType || cfg.productType}: price equal to START, the field ignored`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - 3D: ParametricSashWindow from the preview config (windowSpecToConfig)');
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
const key = (m) => `${m.kind}|${m.min.join(',')}|${m.max.join(',')}`;
const mw = (m) => Math.round((m.max[0] - m.min[0]) * 100) / 100;
const mh = (m) => Math.round((m.max[1] - m.min[1]) * 100) / 100;
const midY = (m) => (m.min[1] + m.max[1]) / 2;
// the meeting rails: full sash-width members 43 high; the opening: the sash stiles (57 wide)
function meetingOf(ms, sashW) {
  const rails = ms.filter((m) => m.kind === 'ExtrudeGeometry' && near(mh(m), 43, 0.05) && (sashW == null || near(mw(m), sashW, 0.05)));
  const stiles = ms.filter((m) => m.kind === 'ExtrudeGeometry' && near(mw(m), 57, 0.05) && mh(m) > 150);
  return { rails, mids: [...new Set(rails.map((m) => midY(m).toFixed(2)))], top: Math.max(...stiles.map((m) => m.max[1])), bottom: Math.min(...stiles.map((m) => m.min[1])), stiles };
}
const cfgFor = (H, p, W = 1000) => LIVE.wsc.windowSpecToConfig(SP.normaliseToWindowSpec({ id: 'v', name: 'V', width: W, height: H, sashProportion: p }, { fullConfig: {} }));
const BOX_F = { standard: 0.5130, 'cottage-40-60': 0.6034, 'cottage-1-3': 0.6723 };
const opening3D = {};
for (const p of PROPS) {
  const cfg = cfgFor(1400, p);
  const derived = mk(LIVE, 1000, 1400, {}, { sashProportion: p }).derived;
  ok(cfg.sashProportion === p && cfg.meetingFraction === derived.meetingFraction, `${p}: the 3D config carries the engine value (meetingFraction ${cfg.meetingFraction})`);
  const ms = await meshes(L3, cfg);
  const m = meetingOf(ms, 938);
  const A = m.top - m.bottom;
  const meetY = Number(m.mids[0]);
  const frac = (meetY - m.bottom) / A;
  opening3D[p] = { ms, m, A, meetY };
  ok(m.rails.length === 4 && m.mids.length === 1 && near(A, 1343, 0.05) && Math.abs(meetY - (m.bottom + A * BOX_F[p])) <= 0.5,
    `${p}: meeting rail at ${frac.toFixed(4)} of the opening (rail centre ${meetY} mm, opening ${m.bottom}..${m.top}); box ${BOX_F[p]}, within ${Math.abs(meetY - (m.bottom + A * BOX_F[p])).toFixed(2)} mm`);
}
{
  const live = opening3D.standard.ms;
  const start = await meshes(S3, cfgFor(1400, 'standard'));   // START has no meetingFraction: the line at half
  const sm = meetingOf(start, 938);
  const moved = live.filter((m, i) => key(m) !== key(start[i]));
  // nothing moves in z; nothing moves in x but the glass reflection planes (rotated, so their x extent
  // follows the pane height they are sized to)
  const xzSame = live.length === start.length && live.every((m, i) => m.kind === start[i].kind && near(m.min[2], start[i].min[2], 0.011) && near(m.max[2], start[i].max[2], 0.011)
    && (m.kind === 'PlaneGeometry' || (near(m.min[0], start[i].min[0], 0.011) && near(m.max[0], start[i].max[0], 0.011))));
  const frameSame = live.filter((m) => mh(m) >= 1300).every((m) => start.some((s) => key(s) === key(m)));
  const rise = opening3D.standard.meetY - Number(sm.mids[0]);
  ok(xzSame && frameSame && moved.length > 0 && near(rise, 1343 * (BOX_F.standard - 0.5), 0.6),
    `standard 1400 against START: ${live.length} meshes, ${moved.length} moved and only in y (sashes, glass, ironmongery, cords, weights); frame members identical; the line rose ${rise.toFixed(2)} mm (about 17)`);
  const noF = { ...cfgFor(1400, 'standard') }; delete noF.meetingFraction;
  const a = await meshes(L3, noF), b = await meshes(S3, noF);
  ok(a.length === b.length && a.every((m, i) => key(m) === key(b[i])), `without a meetingFraction prop (PSW, the welcome page): ${a.length} meshes byte-identical to START`);
}
{
  // triple (the configurator path sends sashType / splitRatio): centre and both FIX lights on one line
  const cfg = { ...cfgFor(1400, 'cottage-40-60', 1800), sashType: 'triple', splitRatio: '1/4-1/2-1/4' };
  const ms = await meshes(L3T, cfg);
  const rails = ms.filter((m) => m.kind === 'ExtrudeGeometry' && near(mh(m), 43, 0.05) && mw(m) > 150);
  const m = meetingOf(ms, null);
  const mids = [...new Set(rails.map((r) => midY(r).toFixed(2)))];
  const widths = [...new Set(rails.map((r) => mw(r)))].sort((x, y) => x - y);
  ok(rails.length === 12 && widths.length === 2 && mids.length === 1 && Math.abs(Number(mids[0]) - (m.bottom + (m.top - m.bottom) * BOX_F['cottage-40-60'])) <= 0.5,
    `triple cottage-40-60: ${rails.length} meeting rail members (sections ${widths.join(' / ')} wide), one line at ${mids[0]} mm = ${((Number(mids[0]) - m.bottom) / (m.top - m.bottom)).toFixed(4)} of the opening`);
}
{
  // the two opening limits: lower sash rises by (upper part - 120), upper sash drops by (lower part - 120)
  for (const p of ['standard', 'cottage-1-3']) {
    const cfg = cfgFor(1400, p);
    const lim = L3.PSW.sashOpeningLimits(cfg.height, cfg.meetingFraction);
    const closed = opening3D[p].m;
    const upperSign = Math.sign(closed.stiles.find((s) => near(s.max[1], closed.top, 0.02)).min[2] + 1e-9);
    const open = meetingOf(await meshes(L3, { ...cfg, opening: 5000, upperOpening: 5000 }), 938);
    const sideOf = (s) => Math.sign(s.min[2] + 1e-9);
    const lowerBottom = Math.min(...open.stiles.filter((s) => sideOf(s) !== upperSign).map((s) => s.min[1]));
    const upperTop = Math.max(...open.stiles.filter((s) => sideOf(s) === upperSign).map((s) => s.max[1]));
    const lift = lowerBottom - closed.bottom, drop = closed.top - upperTop;
    const meet = opening3D[p].meetY;
    ok(near(lift, lim.lowerLift, 0.05) && near(drop, lim.upperDrop, 0.05) && near(lim.lowerLift, closed.top - meet - 120, 0.05) && near(lim.upperDrop, meet - closed.bottom - 120, 0.05),
      `${p}: lower sash rises ${lift.toFixed(2)} (upper part - 120 = ${lim.lowerLift.toFixed(2)}), upper sash drops ${drop.toFixed(2)} (lower part - 120 = ${lim.upperDrop.toFixed(2)})`);
  }
}

{
  // a fraction the component cannot draw (a configurator sends one per keystroke: at H 135, the default
  // sash deduction, the engine fraction divides by zero) draws at half instead of breaking the model
  ok(!Number.isFinite(CA.meetingFractionFor(135, 'standard')), `meetingFractionFor(135) is ${CA.meetingFractionFor(135, 'standard')} (H = the sash deduction)`);
  const cfg = cfgFor(1400, 'standard');
  const half = meetingOf(await meshes(L3, { ...cfg, meetingFraction: 0.5 }), 938);
  for (const bad of [Infinity, -Infinity, NaN]) {
    let err = '';
    let m = null;
    try { m = meetingOf(await meshes(L3, { ...cfg, meetingFraction: bad }), 938); } catch (e) { err = String(e?.message || e); }
    ok(m && m.mids.length === 1 && m.mids[0] === half.mids[0], `meetingFraction ${bad}: the model renders, the line at half (${m?.mids[0]})`, err);
  }
  const lim = L3.PSW.sashOpeningLimits(1313, Infinity);
  ok(Number.isFinite(lim.lowerLift) && near(lim.lowerLift, L3.PSW.sashOpeningLimits(1313, 0.5).lowerLift, 1e-9), 'sashOpeningLimits with a non-finite fraction: the limits of the half line (the sliders never get NaN)');
}
{
  // the upper weights: they hang from the meeting line and rise as the upper sash drops; at a cottage
  // drop they stop with their top at the jamb top, a standard window never reaches it
  const weightsOf = (ms) => ms.filter((m) => m.kind === 'BoxGeometry' && near(mw(m), 45, 0.05) && near(mh(m), 180, 0.05));
  const jambTop = 58.414 - 23 + 1400 / 2;
  for (const p of ['standard', 'cottage-40-60', 'cottage-1-3']) {
    const cfg = cfgFor(1400, p);
    const lim = L3.PSW.sashOpeningLimits(cfg.height, cfg.meetingFraction);
    const meet = opening3D[p].meetY;
    const ws = weightsOf(await meshes(L3, { ...cfg, upperOpening: 5000 })).sort((a, b) => b.max[1] - a.max[1]);
    const upperTop = ws[0]?.max[1], lowerTop = ws[ws.length - 1]?.max[1];
    const free = meet + lim.upperDrop + 90;   // where an uncapped weight's top would be
    const expectTop = Math.min(free, jambTop);
    ok(ws.length === 4 && near(ws[0].max[1], ws[1].max[1], 0.01) && near(upperTop, expectTop, 0.05) && near(lowerTop, meet + 90, 0.05) && (p === 'standard' ? free < jambTop : free > jambTop),
      `${p} 1400, upper sash fully down (${lim.upperDrop.toFixed(1)}): upper weights' top ${upperTop} (${p === 'standard' ? 'free, below' : 'stopped at'} the jamb top ${jambTop.toFixed(2)}; free would be ${free.toFixed(2)}), lower weights at rest ${lowerTop}`);
  }
  // the cap never binds on a standard window, any height, both 3D paths (preview: h = H; configurator: h = H - 87)
  let worst = Infinity;
  for (let H = 600; H <= 3000; H += 25) for (const h of [H, H - 87]) {
    const f = CA.meetingFractionFor(H, 'standard');
    const lim = L3.PSW.sashOpeningLimits(h, f);
    const meeting = -h / 2 + 61.414 + (h - 57) * f;
    worst = Math.min(worst, (58.414 - 23 + h / 2 - 90 - meeting) - lim.upperDrop);
  }
  ok(worst > 0, `standard frames 600 to 3000, both paths: the upper weight cap stays ${worst.toFixed(1)} mm or more above the full drop (never binds)`);
}
{
  // a batch profile snapshot (meeting rail 53, bottom rail 120): the 3D takes the derived fraction
  const P = LIVE.profile;
  const snap = clone(P.DEFAULT_SASH_PROFILE);
  snap.elements.meetingRail.face = 53; snap.elements.bottomRail.face = 120;
  const { spec, d } = P.withProfiles(snap, null, null, () => { const sp = SP.normaliseToWindowSpec({ id: 's', name: 'S', width: 1000, height: 1400 }, { fullConfig: {} }); return { spec: sp, d: CA.deriveWindowData(sp, {}) }; });
  const withDerived = LIVE.wsc.windowSpecToConfig(spec, d), without = LIVE.wsc.windowSpecToConfig(spec);
  ok(withDerived.meetingFraction === d.meetingFraction && near(d.meetingFraction, ((1308 + 10 - 63) / 2 + 63 - 26.5) / (1318 - 53), 1e-12) && without.meetingFraction !== d.meetingFraction,
    `snapshot meeting rail 53 / bottom rail 120: the preview config takes derived ${d.meetingFraction.toFixed(4)} (the active profile would give ${without.meetingFraction.toFixed(4)})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - controls: standard and the other products equal START');
const STD_REF = [
  ['double 900', 1000, 900, {}], ['double 1400', 1000, 1400, {}], ['double 1800', 1000, 1800, {}], ['double 2000', 1000, 2000, {}],
  ['triple 1800 x 1400', 1800, 1400, { sashType: 'triple' }], ['glazing arch 1400', 1000, 1400, { headType: 'arch' }],
  ['double 1400 4x4 horns', 1000, 1400, { horns: 'A' }, { upperBars: '4x4', lowerBars: '4x4' }], ['slim 900 x 1400', 900, 1400, { frameType: 'slim' }],
  ['heritage 1200 x 1700 9x9', 1200, 1700, { frameType: 'heritage' }, { upperBars: '9x9', lowerBars: '9x9' }], ['triple glass 1000 x 1500', 1000, 1500, { glassType: 'triple' }],
  ['triple 1800 x 2000 6x6', 1800, 2000, { sashType: 'triple' }, { upperBars: '6x6', lowerBars: '6x6' }],
];
for (const [name, w, h, fc, extra = {}] of STD_REF) {
  const a = mk(LIVE, w, h, fc, extra), b = mk(START, w, h, fc, extra);
  ok(JSON.stringify(withoutNewKeys(a.derived)) === JSON.stringify(b.derived) && a.derived.sashProportion === 'standard' && !('sashProportion' in b.derived),
    `${name}: derived JSON byte-identical to START but for the two new keys`);
  const L = LIVE.lists, S = START.lists;
  ok(JSON.stringify(L.buildCutListForWindow(a.derived, a.spec)) === JSON.stringify(S.buildCutListForWindow(b.derived, b.spec))
    && JSON.stringify(L.buildGlassListForWindow(a.derived, a.spec)) === JSON.stringify(S.buildGlassListForWindow(b.derived, b.spec))
    && JSON.stringify(L.buildPrecutForWindow(a.derived, a.spec, {}, null)) === JSON.stringify(S.buildPrecutForWindow(b.derived, b.spec, {}, null))
    && JSON.stringify(L.buildHardwareList(a.spec, a.derived)) === JSON.stringify(S.buildHardwareList(b.spec, b.derived))
    && JSON.stringify(LIVE.bom.buildWindowPartQtys(a.derived, a.spec, {})) === JSON.stringify(START.bom.buildWindowPartQtys(b.derived, b.spec, {})),
    `${name}: cut list, glass list, pre-cut, hardware and BOM part quantities equal to START`);
  const sa = clone(a.spec), sb = clone(b.spec); delete sa.sash.proportion;
  ok(JSON.stringify(sa) === JSON.stringify(sb) && a.spec.sash.proportion === 'standard', `${name}: windowSpec equal to START but for sash.proportion 'standard'${extra.upperBars ? ` (grid ${a.spec.sash.grid.mode})` : ''}`);
}
{
  // standard under profiles with decimal rail faces (a batch snapshot can carry any): still byte-identical
  const profiles = [[57.3, 43.6, 90.7, 57.2, 135.4], [58.8, 47.6, 93.1, 56.9, 136.4], [56.1, 41.3, 88.9, 57.7, 133.7], [60, 53, 120, 57, 141]];
  let n = 0, bad = [];
  for (const [top, meet, bottom, stile, ded] of profiles) {
    const mkP = (M) => { const p = clone(M.profile.DEFAULT_SASH_PROFILE); p.elements.topRail.face = top; p.elements.meetingRail.face = meet; p.elements.bottomRail.face = bottom; p.elements.stiles.face = stile; p.deductions.sashHeight = ded; return p; };
    for (const H of [900, 1137, 1400, 1777, 2150]) for (const [fc, extra] of [[{}, {}], [{}, { upperBars: '4x4', lowerBars: '4x4' }], [{ sashType: 'triple' }, { upperBars: '6x6', lowerBars: '6x6' }]]) {
      const w = fc.sashType === 'triple' ? 1800 : 1000;
      const a = LIVE.profile.withProfiles(mkP(LIVE), null, null, () => mk(LIVE, w, H, fc, extra));
      const b = START.profile.withProfiles(mkP(START), null, null, () => mk(START, w, H, fc, extra));
      n += 1;
      if (JSON.stringify(withoutNewKeys(a.derived)) !== JSON.stringify(b.derived)) bad.push(`${top}/${meet}/${bottom} H${H} ${fc.sashType || 'double'} ${extra.upperBars || 'none'}`);
    }
  }
  ok(bad.length === 0, `standard under ${profiles.length} profiles with decimal faces: ${n} windows byte-identical to START but for the two keys`, bad.slice(0, 5).join(' | '));
}
const OTHERS = [
  ['casement 040L 1000 x 1200', 1000, 1200, { windowCategory: 'casement', casementLayout: '040L' }],
  ['casement 022 1200 x 1500 bars', 1200, 1500, { windowCategory: 'casement', casementLayout: '022', casementHBars: 1, casementVBars: 1 }],
  ['fixed casement 800 x 1200', 800, 1200, { windowCategory: 'casement', casementKind: 'fixed' }],
  ['circle 800', 800, 800, { windowCategory: 'casement', casementKind: 'fixed', archShape: 'circle' }],
  ['arched casement 1000 x 1500', 1000, 1500, { windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle', archRise: 200 }],
];
for (const [name, w, h, fc] of OTHERS) {
  const a = mk(LIVE, w, h, fc), b = mk(START, w, h, fc);
  ok(JSON.stringify(a.derived) === JSON.stringify(b.derived) && JSON.stringify(a.spec) === JSON.stringify(b.spec), `${name}: derived and windowSpec deep-equal to START`);
}
// doors v3 (09.10.2026) moved the door derive on purpose (every leaf 51 above the floor: H - 102,
// was H - 98; the v3 rules are checked in t44_doors_v3). Here the door windowSpec stays equal to
// START (the sash proportion field never reaches a door) and the derive differs only by the 4 mm
// of leaf height: widths, glass widths and roles equal, heights 4 less.
for (const [name, w, h, fc] of [
  ['door single 900 x 2100', 900, 2100, { windowCategory: 'door', doorType: 'single-external' }],
  ['door french 1600 x 2100', 1600, 2100, { windowCategory: 'door', doorType: 'french' }],
]) {
  const a = mk(LIVE, w, h, fc), b = mk(START, w, h, fc);
  const la = a.derived.door.leaves, lb = b.derived.door.leaves, ga = a.derived.customGlassUnits, gb = b.derived.customGlassUnits;
  ok(JSON.stringify(a.spec) === JSON.stringify(b.spec) && la.length === lb.length && la.every((l, i) => l.w === lb[i].w && l.h === lb[i].h - 4 && l.x === lb[i].x)
    && ga.length === gb.length && ga.every((g, i) => g.width === gb[i].width && g.height === gb[i].height - 4 && g.role === gb[i].role),
    `${name}: windowSpec deep-equal to START; derived = START with the leaf and glass 4 lower (doors v3: ${lb[0].h} -> ${la[0].h})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - sheets and exports');
const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));
const sheetsOf = (M, spec, derived) => ({
  elevation: render(M.FrontElevation, { windowSpec: spec, derived }), box: render(M.BoxDetail, { windowSpec: spec, derived }),
  upper: render(M.SashDetail, { windowSpec: spec, derived, type: 'upper' }), lower: render(M.SashDetail, { windowSpec: spec, derived, type: 'lower' }),
  glassUpper: render(M.GlassDrawing, { windowSpec: spec, derived, type: 'upper' }), glassLower: render(M.GlassDrawing, { windowSpec: spec, derived, type: 'lower' }),
  vsection: render(M.VerticalSection, { windowSpec: spec, derived }),
});
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
for (const H of [900, 1400, 1800, 2000]) {
  const a = mk(LIVE, 1000, H), b = mk(START, 1000, H);
  const A = sheetsOf(LIVE, a.spec, a.derived), B = sheetsOf(START, b.spec, b.derived);
  ok(Object.keys(A).every((k) => A[k] === B[k]), `standard ${H}: the seven sash sheets byte-identical to START`);
}
for (const [label, w, h, fc] of [['gothic arched 700 x 1800', 700, 1800, { sashType: 'arched-group', archShape: 'gothic-arch' }], ['semi-circle arched 1000 x 2100', 1000, 2100, { sashType: 'arched-group', archShape: 'semi-circle' }]]) {
  const a = mk(LIVE, w, h, fc), b = mk(START, w, h, fc);
  const A = sheetsOf(LIVE, a.spec, a.derived), B = sheetsOf(START, b.spec, b.derived);
  ok(Object.keys(A).every((k) => A[k] === B[k]), `standard ${label}: the seven sash sheets byte-identical to START (the vertical section label too)`);
}
{
  const fmt05 = (n) => { const r = Math.round(n * 2) / 2; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  for (const [H, p] of [[1400, 'cottage-40-60'], [900, 'cottage-1-3'], [2000, 'cottage-40-60']]) {
    const { spec, derived: d } = mk(LIVE, 1000, H, {}, { sashProportion: p });
    const S = sheetsOf(LIVE, spec, d);
    const tU = texts(S.upper), tL = texts(S.lower), gU = texts(S.glassUpper), gL = texts(S.glassLower), vs = texts(S.vsection).join(' ');
    const g = LI.buildGlassListForWindow(d, spec);
    ok(tU.includes(fmt05(d.topSashHeight)) && tL.includes(fmt05(d.bottomSashHeight)) && tU.includes(fmt05(d.topSashHeight - 100)) && tL.includes(fmt05(d.bottomSashHeight - 133)),
      `${H} ${p}: the sash sheets print the derived heights (US ${fmt05(d.topSashHeight)}, light ${fmt05(d.topSashHeight - 100)}; LS ${fmt05(d.bottomSashHeight)}, light ${fmt05(d.bottomSashHeight - 133)}; 0.5 display rounding)`);
    const r1 = (v) => Math.round(v * 10) / 10;   // the glass sheet's own 0.1 display rounding
    ok(gU.includes(`${r1(g[0].height)} mm`) && gL.includes(`${r1(g[1].height)} mm`), `${H} ${p}: the glass sheets print the units ${r1(g[0].height)} / ${r1(g[1].height)} (rows ${g[0].height} / ${g[1].height})`);
    ok(vs.includes(`Top sash ${Math.round(d.topSashHeight * 10) / 10}mm · Bottom sash ${Math.round(d.bottomSashHeight * 10) / 10}mm`), `${H} ${p}: the vertical section prints ${Math.round(d.topSashHeight * 10) / 10} / ${Math.round(d.bottomSashHeight * 10) / 10}`);
    // the elevation's meeting rail line: the sash stack is centred on the frame, the line sits topSash - meet / 2 below its top
    const sc = Math.max(1000, H) / 500, oy = 60 * sc;
    const expectY = oy + (H - (d.topSashHeight + d.bottomSashHeight - 43)) / 2 + d.topSashHeight - 21.5;
    const lines = [...S.elevation.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    ok(lines.some(([x1, y1, x2, y2]) => near(y1, expectY, 0.01) && near(y2, expectY, 0.01) && x2 - x1 > 700), `${H} ${p}: the elevation draws the meeting rail line at the derived split (${expectY.toFixed(2)})`);
  }
}
{
  // DXF (ExportControls passes derived): standard equal to START, cottage outlines from derived
  let captured = null;
  globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return 'blob:x'; };
  URL.revokeObjectURL = () => {};
  const dxfOf = async (M, H, p) => {
    const item = { id: 'abcdefgh', name: 'W', window_number: 'W', width: 1000, height: H, ...(p ? { sashProportion: p } : {}) };
    const spec = M.specification.normaliseToWindowSpec(item, { fullConfig: {} });
    await M.dxf.exportWindowToDXF({ item, windowSpec: spec, derived: M.calculations.deriveWindowData(spec, {}) });
    return captured.text();
  };
  for (const H of [900, 1400, 1401, 2000]) ok((await dxfOf(LIVE, H)) === (await dxfOf(START, H)), `DXF standard ${H}: byte-identical to START`);
  const c = await dxfOf(LIVE, 1400, 'cottage-40-60');
  const poly = (layer) => { const m = c.match(new RegExp(`${layer}\\n90\\n4\\n70\\n1\\n10\\n([\\d.]+)\\n20\\n([\\d.]+)\\n10\\n[\\d.]+\\n20\\n[\\d.]+\\n10\\n[\\d.]+\\n20\\n([\\d.]+)`)); return m ? m.slice(1).map(Number) : null; };
  const lo = poly('SASH-BOTTOM'), up = poly('SASH-TOP');
  ok(lo && up && lo[2] - lo[1] === 784 && up[2] - up[1] === 523 && up[1] === lo[2], `DXF cottage-40-60 1400: bottom sash ${lo && lo[2] - lo[1]}, top sash ${up && up[2] - up[1]} (derived 784.8 / 523.2, whole mm), stacked`);
  URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; delete globalThis.document;
}
{
  // the canvas elevation (window PDF, estimate PDF): every call on a recording canvas
  const drawCalls = (M, item) => {
    const calls = [];
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : (...args) => { calls.push([k, ...args.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))]); })), set: (t, k, v) => { calls.push(['set', k, v]); return true; } });
    globalThis.window = { devicePixelRatio: 1 };
    const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: 800, height: 900 }) };
    M.canvas.drawTechnicalElevation(canvas, M.specification.normaliseToWindowSpec(item, { fullConfig: {} }), {});
    delete globalThis.window;
    return calls;
  };
  for (const extra of [{}, { upperBars: '4x4', lowerBars: '4x4' }, { upperBars: '9x9', lowerBars: '9x9' }]) {
    const item = { id: 'c', name: 'C', width: 1000, height: 1400, ...extra };
    ok(JSON.stringify(drawCalls(LIVE, item)) === JSON.stringify(drawCalls(START, item)), `canvas elevation, standard 1400 ${extra.upperBars || 'no bars'}: every draw call equal to START`);
  }
  for (const [p, bars, n] of [['cottage-40-60', '4x4', 1], ['cottage-1-3', '9x9', 2]]) {
    const item = { id: 'c', name: 'C', width: 1000, height: 1400, sashProportion: p, upperBars: bars, lowerBars: bars };
    const calls = drawCalls(LIVE, item);
    const d = mk(LIVE, 1000, 1400, {}, item).derived;
    // the glass fills of the two panes, then the horizontal bars (full glass width, 18 high in px)
    const fills = calls.filter((c) => c[0] === 'fillRect');
    const sc = fills[1][3] / 1000;   // the frame outline: 1000 wide
    const glassW = 708 * sc;         // sash 822 - 2 stiles of 57
    const panes = fills.filter((c) => near(c[3], glassW, 0.01) && c[4] > 50).slice(0, 2);
    const hb = fills.filter((c) => near(c[3], glassW, 0.01) && near(c[4], 18 * sc, 0.01));
    const inPane = (pane) => hb.filter((b) => b[2] > pane[2] && b[2] < pane[2] + pane[4]).map((b) => (b[2] + b[4] / 2 - pane[2]) / sc);
    const want = (gh) => Array.from({ length: n }, (_, j) => ((gh - n * 18) / (n + 1)) * (j + 1) + j * 18 + 9);
    const up = inPane(panes[0]), lo = inPane(panes[1]);
    const wu = want(d.topSashHeight - 100), wl = want(d.bottomSashHeight - 133);
    ok(panes.length === 2 && up.length === n && lo.length === n && up.every((y, j) => near(y, wu[j], 0.05)) && lo.every((y, j) => near(y, wl[j], 0.05)),
      `canvas elevation ${p} ${bars}: horizontal bars spaced in each pane (upper ${up.map((y) => y.toFixed(1)).join(', ')} / lower ${lo.map((y) => y.toFixed(1)).join(', ')} mm from the pane top)`);
  }
}
{
  // overview PDF: the cottage label under the type, nothing for standard (dates and ids masked)
  const info = (windows) => ({ companyName: 'CO', companyAddress: '', title: 'Pack', projects: ['P1'], date: '09/10/2026', isPPMode: true, windows, returnDoc: true });
  const row = (name, type, extra = {}) => ({ projectNum: 'P1', name, type, width: 1000, height: 1400, bars: 'none', head: 'flat', glass: 'clear', opening: 'both', ...extra });
  const pdfText = (buf) => Buffer.from(buf).toString('latin1').replace(/\/CreationDate \([^)]*\)|\/ModDate \([^)]*\)|\/ID \[[^\]]*\]/g, '');
  const std = [row('W1', 'double'), row('W2', 'triple')];
  ok(pdfText(LIVE.overview.exportOverviewPDF(info(std))) === pdfText(START.overview.exportOverviewPDF(info(std))), 'overview PDF of standard windows byte-identical to START (dates masked)');
  const withProportion = [row('W1', 'double', { proportion: '' }), row('W2', 'double', { proportion: 'Cottage 40/60' })];
  const t = pdfText(LIVE.overview.exportOverviewPDF(info(withProportion)));
  ok((t.match(/Cottage 40\/60/g) || []).length === 1 && pdfText(LIVE.overview.exportOverviewPDF(info([row('W1', 'double', { proportion: '' })]))) === pdfText(START.overview.exportOverviewPDF(info([row('W1', 'double')]))),
    'overview PDF: "Cottage 40/60" printed once (under the Type of the cottage row); a standard row with an empty proportion prints as START');
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - pages in a browser: configurator, window detail, pack overview, estimate PDF');
let chromium = null;
try {
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  const entry = resolve(globalRoot, 'playwright', 'index.mjs');
  if (existsSync(entry)) ({ chromium } = await import(pathToFileURL(entry).href));
} catch { chromium = null; }
if (!chromium) {
  ok(false, 'playwright (global node install) and its Chromium are needed for the page checks (as t39)');
} else {
  // The three pages and the estimate PDF in one browser bundle (react, router, stores included).
  // import.meta.env is defined empty, so the Supabase client is "not configured" (as t37 / t39).
  // window.update3D is a property whose getter records every configurator payload before
  // handing it to the real 3D (when the lazy 3D app has set one).
  const entry = resolve(AUDIT, 't43-pages-entry.jsx');
  writeFileSync(entry, [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { MemoryRouter, Routes, Route } from 'react-router-dom';",
    "import ConfiguratorPage from '../src/pages/ConfiguratorPage.jsx';",
    "import WindowDetailPage from '../src/pages/WindowDetailPage.jsx';",
    "import ProductionPackPage from '../src/pages/ProductionPackPage.jsx';",
    "import EstimateConfiguratorPage from '../src/pages/EstimateConfiguratorPage.jsx';",
    "import { useEstimateStore } from '../src/stores/estimateStore.js';",
    'window.__est = useEstimateStore;',
    "import { useProjectStore } from '../src/stores/projectStore.js';",
    "import { exportEstimatePdf } from '../src/utils/estimatePdfExport.js';",
    'window.__store = useProjectStore;',
    'window.__exportEstimatePdf = exportEstimatePdf;',
    'window.__payloads = [];',
    'let real3D = null;',
    "Object.defineProperty(window, 'update3D', { configurable: true, get() { return (cfg) => { window.__payloads.push(cfg); if (real3D) real3D(cfg); }; }, set(fn) { real3D = fn; } });",
    'window.confirm = () => true; window.alert = () => {};',
    "const root = createRoot(document.getElementById('root'));",
    'const E = React.createElement;',
    'window.__mount = (path) => root.render(E(MemoryRouter, { key: path + Math.random(), initialEntries: [path] }, E(Routes, null,',
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/configurator', element: E(ConfiguratorPage) }),",
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/windows/:windowId', element: E(WindowDetailPage) }),",
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/production-pack', element: E(ProductionPackPage) }),",
    "  E(Route, { path: '/estimates/:estimateId/configure', element: E(EstimateConfiguratorPage) }),",
    "  E(Route, { path: '*', element: E('div', { id: 'elsewhere' }, 'elsewhere') }))));",
  ].join('\n'));
  const bundleOut = resolve(AUDIT, 't43-pages-bundle.js');
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=iife', '--platform=browser',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--define:process.env.NODE_ENV="production"', '--log-level=error',
    // the ES build of jspdf-autotable (its CommonJS main has no default export for an iife bundle; Vite interops it)
    '--alias:jspdf-autotable=jspdf-autotable/es', `--outfile=${bundleOut}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const html = resolve(AUDIT, 't43-pages.html');
  writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="t43-pages-bundle.js"></script></body></html>');

  const browserApp = await chromium.launch();
  const page = await browserApp.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
  // No network in the harness: the 3D tab's environment map (an .hdr from a CDN) gets a valid
  // 1 x 1 Radiance file (without it drei throws and the page unmounts); everything else is refused.
  const hdr = Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n', 'latin1'), Buffer.from([128, 128, 128, 128])]);
  await page.route(/^https?:/, (r) => (r.request().url().endsWith('.hdr') ? r.fulfill({ status: 200, contentType: 'application/octet-stream', body: hdr }) : r.abort()));
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => !!window.__store);
  const ids = await page.evaluate(() => {
    const st = window.__store.getState();
    const p = st.createProject('Cottage', '', 'P-43');
    const b = window.__store.getState().createBatch(p.id, 'sash');
    return { p: p.id, b: b.id };
  });
  const cfgUrl = `/projects/${ids.p}/batches/${ids.b}/configurator`;
  const mount = async (path) => { await page.evaluate((x) => window.__mount(x), path); await page.waitForTimeout(400); };
  const waitText = async (t) => { try { await page.waitForSelector(`text=${t}`, { timeout: 15000 }); return true; } catch { console.log(`  (waiting for "${t}": page errors ${JSON.stringify(pageErrors.slice(-3))}; body ${JSON.stringify((await page.locator('body').innerText()).slice(0, 300))})`); return false; } };
  const chip = (label) => page.locator('button', { hasText: new RegExp(`^${label.replace(/[/]/g, '\\/')}$`) });
  // the proportion chips: the HChips row right after the "Sash proportions" label (the frame shape row also has a Standard)
  const pchip = (label) => page.locator('div:text-is("Sash proportions") + div button', { hasText: new RegExp(`^${label.replace(/[/]/g, '\\/')}$`) });
  const lastPayload = () => page.evaluate(() => { const s = window.__payloads.filter((x) => x.windowCategory === 'sash' || x.sashType); return s[s.length - 1] || null; });
  const specRow = (label) => page.locator('div.flex.justify-between', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).first();
  const heightInput = () => page.locator('input[type=number]').nth(1);

  // ── configurator: the control, the 900 rule, the 3D payload ──
  await mount(cfgUrl);
  await waitText('Sash proportions');
  const labels = await Promise.all(['Standard', 'Cottage 40/60', 'Cottage 1/3-2/3'].map((l) => pchip(l).count()));
  ok(labels.every((n) => n === 1), `configurator: a "Sash proportions" row with Standard / Cottage 40/60 / Cottage 1/3-2/3 (${labels.join(' / ')})`);
  await heightInput().fill('1400'); await heightInput().blur(); await page.waitForTimeout(200);
  await pchip('Cottage 40/60').click(); await page.waitForTimeout(300);
  let pl = await lastPayload();
  const f4060 = LIVE.calculations.meetingFractionFor(1400, 'cottage-40-60');
  ok(pl && pl.sashProportion === 'cottage-40-60' && pl.meetingFraction === f4060 && pl.extHeight === 1400,
    `1400 + Cottage 40/60: the 3D gets sashProportion ${pl?.sashProportion}, meetingFraction ${pl?.meetingFraction} (engine ${f4060})`);
  ok((await specRow('Proportions').innerText()).includes('Cottage 40/60'), 'the spec panel shows "Proportions Cottage 40/60"');
  await heightInput().fill('800'); await heightInput().blur(); await page.waitForTimeout(300);
  pl = await lastPayload();
  const disabled = await Promise.all(['Cottage 40/60', 'Cottage 1/3-2/3', 'Standard'].map((l) => pchip(l).isDisabled()));
  ok(disabled[0] && disabled[1] && !disabled[2] && (await page.locator('text=Cottage needs a frame height of 900 mm or more.').count()) === 1,
    'frame 800: the cottage chips are disabled with the note "Cottage needs a frame height of 900 mm or more."');
  ok(pl && pl.sashProportion === 'standard' && pl.meetingFraction === LIVE.calculations.meetingFractionFor(800, 'standard') && (await specRow('Proportions').innerText()).includes('Standard'),
    `a committed height below 900 sets the value back to standard (3D ${pl?.sashProportion}, ${pl?.meetingFraction})`);
  await heightInput().fill('1400'); await heightInput().blur(); await page.waitForTimeout(200);
  pl = await lastPayload();
  ok(pl && pl.sashProportion === 'standard' && pl.meetingFraction === LIVE.calculations.meetingFractionFor(1400, 'standard'),
    `back at 1400 it stays standard; the standard 3D line comes from the engine too (${pl?.meetingFraction})`);
  await pchip('Cottage 1/3-2/3').click(); await page.waitForTimeout(200);
  await chip('Triple Sash').click(); await page.waitForTimeout(400);
  pl = await lastPayload();
  ok(pl && pl.sashType === 'triple' && pl.sashProportion === 'cottage-1-3' && (await page.locator('text=Sash proportions').count()) === 1,
    `triple: the control stays, the 3D gets triple + cottage-1-3 (${pl?.sashType}, ${pl?.sashProportion})`);
  await chip('Double Hung').click(); await page.waitForTimeout(300);
  await chip('Arched').click(); await page.waitForTimeout(400);
  pl = await lastPayload();
  ok((await page.locator('text=Sash proportions').count()) === 0, 'arched frame shape: the control is hidden');
  await page.locator('div:text-is("Frame shape") + div button', { hasText: /^Standard$/ }).click();   // back to a rectangle
  await page.waitForTimeout(300);
  ok((await page.locator('text=Sash proportions').count()) === 1 && (await specRow('Proportions').innerText()).includes('Standard'),
    'back to a rectangular frame: the control returns and reads Standard (switching to arched set it back)');

  // save, then edit: the value travels like splitRatio
  await pchip('Cottage 40/60').click(); await page.waitForTimeout(200);
  await page.locator('input[placeholder="Window name (max 7)"]').fill('C1');
  await page.locator('button', { hasText: 'Save to Batch' }).click(); await page.waitForTimeout(300);
  const saved = await page.evaluate((x) => window.__store.getState().projects.find((p) => p.id === x.p).batches.find((b) => b.id === x.b).windows.find((w) => w.name === 'C1'), ids);
  ok(saved && saved.sashProportion === 'cottage-40-60' && saved.height === 1400 && JSON.parse(saved.specification || '{}')?.fullConfig?.sashProportion === 'cottage-40-60',
    `saved window C1: sashProportion ${saved?.sashProportion} on the record and in specification.fullConfig`);
  await mount(`${cfgUrl}?edit=${saved?.id}`);
  await waitText('Sash proportions');
  ok((await specRow('Proportions').innerText()).includes('Cottage 40/60') && (await pchip('Cottage 40/60').getAttribute('class')).includes('accent'), 'edit C1: the configurator reloads Cottage 40/60');
  await pchip('Cottage 1/3-2/3').click(); await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Update Window' }).click(); await page.waitForTimeout(300);
  const updated = await page.evaluate((x) => window.__store.getState().projects.find((p) => p.id === x.p).batches.find((b) => b.id === x.b).windows.find((w) => w.name === 'C1'), ids);
  ok(updated?.sashProportion === 'cottage-1-3', `update C1: sashProportion ${updated?.sashProportion}`);

  // ── window detail page: the row and the below-900 warning ──
  const addWin = (cfg) => page.evaluate(([x, c]) => window.__store.getState().addWindowToBatch(x.p, x.b, c), [ids, cfg]);
  const lowId = await addWin({ windowName: 'LOW', extWidth: 1000, extHeight: 800, sashProportion: 'cottage-40-60' });
  const stdId = await addWin({ windowName: 'STD', extWidth: 1000, extHeight: 1400 });
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${lowId}`);
  await waitText('Sashes & Bars');
  const warnLow = await page.locator('p.text-amber-400').allInnerTexts();
  ok((await specRow('Proportions').innerText()).includes('Cottage 40/60') && warnLow.some((t) => /Cottage 40\/60 on a 800 mm frame: below the 900 mm minimum/.test(t)),
    `window detail LOW (800, cottage 40/60): Proportions Cottage 40/60 and the warning "${warnLow[0] || '-'}"`);
  ok((await specRow('Top H').innerText()).includes('283.2 mm') && (await specRow('Bot H').innerText()).includes('424.8 mm'), 'window detail LOW: Top H 283.2 / Bot H 424.8 (708 x 0.4 / 0.6)');
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${stdId}`);
  await waitText('Sashes & Bars');
  ok((await specRow('Proportions').innerText()).includes('Standard') && (await page.locator('p.text-amber-400').count()) === 0 && (await specRow('Top H').innerText()).includes('637.5 mm'),
    'window detail STD (1400): Proportions Standard, no warning, Top H 637.5');

  // ── production pack overview: the type cell ──
  await mount(`/projects/${ids.p}/batches/${ids.b}/production-pack`);
  await page.waitForTimeout(800);
  const typeOf = async (name) => {
    const row = page.locator('tr', { has: page.locator('td', { hasText: new RegExp(`^${name}$`) }) }).first();
    return (await row.count()) ? (await row.locator('td').nth(1).innerText()).trim() : null;
  };
  const tC1 = await typeOf('C1'), tStd = await typeOf('STD'), tLow = await typeOf('LOW');
  ok(tC1 === 'double · Cottage 1/3-2/3' && tLow === 'double · Cottage 40/60' && tStd === 'double', `pack overview type: C1 "${tC1}", LOW "${tLow}", STD "${tStd}"`);

  // ── estimate PDF: the Type row ──
  const pdfTexts = [];
  for (const [label, extra] of [['cottage', { sashProportion: 'cottage-40-60' }], ['standard', {}]]) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.evaluate((x) => window.__exportEstimatePdf({ estimate_number: 'E-43', items: [{ id: 'i1', windowName: 'W1', quantity: 1, config: { extWidth: 1000, extHeight: 1400, sashType: 'double', headType: 'flat', ...x }, price: { unitPrice: 100, totalPrice: 100 } }] }, {}), extra),
    ]);
    const path = resolve(AUDIT, `t43-estimate-${label}.pdf`);
    await download.saveAs(path);
    pdfTexts.push(readFileSync(path).toString('latin1'));
  }
  ok(/double \W+ Cottage 40\/60 \W+ flat head/.test(pdfTexts[0]) && !/Cottage/.test(pdfTexts[1]) && /double \W+ flat head/.test(pdfTexts[1]),
    'estimate PDF Type row: "double · Cottage 40/60 · flat head" for cottage, "double · flat head" for standard');
  // ── estimate configurator: where the price reaches the screen ──
  const estId = await page.evaluate(() => window.__est.getState().addEstimate({ title: 'T43' }).id);
  await mount(`/estimates/${estId}/configure`);
  await waitText('Sash proportions');
  const unitPrice = async () => Number((await page.locator('span:text-is("This window (ex VAT)") + span').innerText()).replace(/[£,]/g, ''));
  const cottageRow = () => page.locator('div.flex.justify-between', { has: page.locator('span:text-is("Cottage proportions")') });
  await heightInput().fill('1400'); await heightInput().blur(); await page.waitForTimeout(200);
  const pStd = await unitPrice();
  await pchip('Cottage 40/60').click(); await page.waitForTimeout(300);
  const pCot = await unitPrice();
  const surcharge = (await cottageRow().count()) ? Number((await cottageRow().locator('span').nth(1).innerText()).replace(/[£,]/g, '')) : null;
  pl = await lastPayload();
  ok(pStd > 0 && near(pCot, pStd * 1.05, 0.011) && near(surcharge, pStd * 0.05, 0.011) && pl?.sashProportion === 'cottage-40-60' && pl?.meetingFraction === f4060,
    `estimate configurator 1400: £${pStd} -> Cottage 40/60 £${pCot} (x 1.05), a "Cottage proportions" line £${surcharge}, the 3D line ${pl?.meetingFraction}`);
  await heightInput().fill('850'); await heightInput().blur(); await page.waitForTimeout(300);
  ok((await pchip('Cottage 40/60').isDisabled()) && (await cottageRow().count()) === 0 && (await specRow('Proportions').innerText()).includes('Standard'),
    'estimate configurator 850: cottage disabled, back to standard, no cottage line in the price');
  await heightInput().fill('1400'); await heightInput().blur(); await page.waitForTimeout(200);
  await pchip('Cottage 1/3-2/3').click(); await page.waitForTimeout(200);
  await page.locator('input[placeholder="Window name (max 7)"]').fill('E1');
  await page.locator('button', { hasText: 'Add to estimate' }).click(); await page.waitForTimeout(300);
  const estItem = await page.evaluate((id) => window.__est.getState().estimates.find((e) => e.id === id)?.items?.[0], estId);
  ok(estItem?.config?.sashProportion === 'cottage-1-3' && estItem?.pricing?.sashProportion === 'cottage-1-3' && Number(estItem?.price?.breakdown?.cottageSurcharge) > 0,
    `estimate item E1: config and pricing carry cottage-1-3, the stored price has cottageSurcharge ${estItem?.price?.breakdown?.cottageSurcharge}`);

  // ── an unknown stored value (say a newer PSW one) in the configurator: said, not saved, the page lives ──
  const oddId = await addWin({ windowName: 'ODD', extWidth: 1000, extHeight: 1400, sashProportion: 'cottage-30-70' });
  const errsBefore = pageErrors.length;
  await mount(`${cfgUrl}?edit=${oddId}`);
  await waitText('Sash proportions');
  const updateBtn = page.locator('button', { hasText: 'Update Window' });
  const oddRecord = () => page.evaluate(([x, w]) => window.__store.getState().projects.find((p) => p.id === x.p).batches.find((b) => b.id === x.b).windows.find((y) => y.id === w), [ids, oddId]);
  const before = JSON.stringify(await oddRecord());
  const looksOff = async () => /cursor-not-allowed/.test(await updateBtn.getAttribute('class'));
  ok((await page.locator('text=Unknown sash proportion "cottage-30-70": choose one of the three.').count()) === 1 && (await looksOff()) && pageErrors.length === errsBefore,
    'edit ODD (cottage-30-70): the configurator says "Unknown sash proportion ...", Update shows as blocked, no page error');
  await updateBtn.click(); await page.waitForTimeout(300);
  ok(JSON.stringify(await oddRecord()) === before && (await page.locator('text=Sash proportions').count()) === 1, 'clicking Update saves nothing and stays on the configurator');
  await pchip('Standard').click(); await page.waitForTimeout(200);
  ok(!(await looksOff()) && (await page.locator('text=Unknown sash proportion').count()) === 0, 'choosing Standard clears the error and allows the update');
  await updateBtn.click(); await page.waitForTimeout(300);
  ok((await oddRecord())?.sashProportion === 'standard', 'update ODD: sashProportion standard');

  // the 3D canvas (no GPU) and the refused network (fonts, maps) may complain; nothing else may
  const relevant = pageErrors.filter((e) => !/WebGL|context|three|Canvas|GL_|Failed to fetch|net::/i.test(e));
  ok(relevant.length === 0, `no page errors outside the 3D canvas and the refused network (${pageErrors.length} in all)`, relevant.join(' | '));
  await browserApp.close();
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
