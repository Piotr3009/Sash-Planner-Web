/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t47_triple_sash: the triple sash on the window page, the pack and the PDFs (Piotr
 * 13.10.2026: "triple window does not work at all, no drawings, no 3D, although the
 * configurator shows it"). The engine derived a triple all along (three sashes FIX L /
 * C / FIX R, two mullions); windowSpecToConfig hard-coded sashType 'double' for the 3D
 * and the sash sheets drew one sash of the full sash width. Measured on the derived
 * data, on the components that reach the screen and on the pages in a browser, against
 * the commit before the change (default 94ba0a6, `git archive`; pass another ref as the
 * first argument).
 *
 *   1  the engine: the double-hung rule on every sash (Piotr 13.10.2026): the clear width
 *      between the internal jamb liners (2000 - 172 = 1828) less two mullions of 50 splits
 *      into the section openings 432 / 864 / 432 (left / right to 0.5 mm, the centre takes
 *      the rest), every sash is its opening less the double-hung gap 6 (178 - 172): sashes
 *      426 / 858 / 426; the cut list rows "(FIX L)" / "(C)" / "(FIX R)" and MULLION (L) / (R)
 *      50x141 of the jamb length, six glass rows 335 / 767 / 335 x 610.5; 1/3-1/3-1/3 gives
 *      570 x 3; START split the double SASH width (one gap for the window): 431 / 861 / 430;
 *      the heights, the box and the mullion rows equal START
 *   2  tripleDrawUtils: the one layout law every sheet and panel reads (x offsets, the
 *      mullion x, keys and labels; null for a double-hung, a casement, a door)
 *   3  3D: the window page config carries sashType 'triple' and the stored split (START
 *      sent 'double'); the ParametricSashWindow meshes of the page config equal the
 *      configurator's (the same props) and differ from the double of START's config
 *   4  sheets: the elevation draws the three sections at the engine x with the two
 *      mullion posts and the 432 / 50 / 864 / 50 / 432 opening chain, bars on the centre sash
 *      only; the box sheet draws the posts with the cut list length; one sash sheet and
 *      one glass sheet per section with that section's engine numbers (no bar alarm)
 *   5  the Elements plan: box + six sash sheets, the keys the Drawings panel rig and the
 *      pack mount; the pages in a browser (Playwright, as t45): the window detail page
 *      (Upper / Lower tabs with three sheets each, six glass drawings, the elevation
 *      chain) and the production pack (seven Elements cards, six glass cards)
 *   6  controls: a double-hung window (none / 2x2 / 6 over 1 / horns / cottage) renders
 *      every sash sheet byte-identical to START, the same plan and the same 3D config
 *
 * Run: node verify/parity/t47_triple_sash.mjs [git-ref]
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

const startHash = process.argv[2] || '94ba0a6';
const startTag = `t47-start-${startHash.slice(0, 12).replace(/[^\w.-]+/g, '_')}`;
const startTree = resolve(AUDIT, `${startTag}-tree`);
rmSync(startTree, { recursive: true, force: true });
mkdirSync(startTree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${startHash} src | tar -x -C "${startTree}"`], { cwd: ROOT, stdio: 'inherit' });

const ESBUILD = ['-y', 'esbuild@0.25.0'];
function bundleTree(srcRoot, name, live) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    ...['specification', 'calculations', 'lists'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    `export * as wsc from '${rel('utils/windowSpecToConfig.js')}';`,
    `export * as elementsPayload from '${rel('utils/elementsPayload.js')}';`,
    ...(live ? [`export * as tdu from '${rel('components/drawings/tripleDrawUtils.js')}';`] : []),
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
// The sash 3D of the live tree: R3F, three, react and the component in ONE bundle (as t40 / t45).
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

const LIVE = await bundleTree(resolve(ROOT, 'src'), 't47-live', true);
const START = await bundleTree(resolve(startTree, 'src'), startTag, false);
const L3 = await bundle3D(resolve(ROOT, 'src'), 't47-live-3d');

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 1e-6) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));
const mk = (M, extra = {}, fc = {}) => {
  const item = { id: 'x', name: 'X', width: 2000, height: 1500, windowCategory: 'sash', ...extra };
  const spec = M.specification.normaliseToWindowSpec(item, { fullConfig: fc });
  return { item, spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const TRIPLE = { sashType: 'triple', splitRatio: '1/4-1/2-1/4' };
const T1 = mk(LIVE, TRIPLE);
const T1S = mk(START, TRIPLE);
// every <rect> of an SVG: { x, y, w, h }
const rectsOf = (svg) => [...svg.matchAll(/<rect ([^>]*)>/g)].map((m) => {
  const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((k) => [k[1], k[2]]));
  return { x: Number(a.x), y: Number(a.y), w: Number(a.width), h: Number(a.height), fill: a.fill || '', stroke: a.stroke || '' };
});
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const textsOf = (svg) => texts(svg).join(' | ');

// ═════════════════════════════════════════════════════════════════════════════
section('1 - the engine (unchanged): sections, cut list rows, glass rows');
{
  const d = T1.derived;
  const ts = d.tripleSections;
  ok(ts && ts.left === 426 && ts.center === 858 && ts.right === 426 && ts.mullionFace === 50 && ts.gap === 6 && ts.clear === 1828
    && ts.openings.left === 432 && ts.openings.center === 864 && ts.openings.right === 432,
    `2000 x 1500 at 1/4-1/2-1/4: ${JSON.stringify(ts)} (clear 1828 less two mullions 50 = 1728, openings by the ratio, every sash less the gap 6)`);
  ok(ts.openings.left + ts.openings.center + ts.openings.right + 2 * ts.mullionFace === ts.clear && ts.left + ts.center + ts.right + 3 * ts.gap + 2 * ts.mullionFace === ts.clear,
    'the openings and the posts add up to the clear width; the sashes, three gaps and the posts too');
  const tS = T1S.derived.tripleSections;
  ok(tS.left === 431 && tS.center === 861 && tS.right === 430, `START split the double sash width 1822 - 100: ${tS.left} / ${tS.center} / ${tS.right} (one gap for the whole window, the bug Piotr caught)`);
  ok(d.sashWidth === 1822 && near(d.topSashHeight, 687.5) && near(d.bottomSashHeight, 720.5), `sash width ${d.sashWidth}, upper ${d.topSashHeight}, lower ${d.bottomSashHeight}`);
  const rows = d.components.sash;
  const named = (sfx) => rows.filter((c) => c.elementName.endsWith(sfx));
  ok(named('(FIX L)').length === 8 && named('(C)').length === 8 && named('(FIX R)').length === 8, `cut list: 8 rows per sash (FIX L ${named('(FIX L)').length}, C ${named('(C)').length}, FIX R ${named('(FIX R)').length})`);
  const topRail = (sfx) => rows.find((c) => c.elementName === `TOP RAIL ${sfx}`)?.length;
  ok(topRail('(FIX L)') === 426 && topRail('(C)') === 858 && topRail('(FIX R)') === 426, `top rails ${topRail('(FIX L)')} / ${topRail('(C)')} / ${topRail('(FIX R)')} = the sash widths`);
  const mL = rows.find((c) => c.elementName === 'MULLION (L)'), mR = rows.find((c) => c.elementName === 'MULLION (R)');
  ok(mL && mR && mL.section === '50x141' && mL.length === 1392 && mR.length === 1392, `MULLION (L) / (R): ${mL?.section} x ${mL?.length} (frame 1500 less the jamb deduction 108)`);
  const glass = LIVE.lists.buildGlassListForWindow(d, T1.spec);
  ok(glass.length === 6 && glass.map((g) => g.location).join(',') === 'fix L upper,fix L lower,centre upper,centre lower,fix R upper,fix R lower',
    `six glass rows: ${glass.map((g) => `${g.location} ${g.width}x${g.height}`).join(', ')}`);
  ok(glass[0].width === 335 && glass[2].width === 767 && glass[4].width === 335 && glass.every((g) => near(g.height, 610.5)), 'glass widths 335 / 767 / 335 (sash less 91), heights 610.5');
  const d3 = mk(LIVE, { sashType: 'triple', splitRatio: '1/3-1/3-1/3' }).derived;
  ok(d3.tripleSections.left === 570 && d3.tripleSections.center === 570 && d3.tripleSections.right === 570 && d3.tripleSections.openings.left === 576, `1/3-1/3-1/3: ${JSON.stringify(d3.tripleSections)}`);
  const d5 = mk(LIVE, { sashType: 'triple', splitRatio: '1/5-3/5-1/5' }).derived.tripleSections;
  ok(d5.openings.left === 345.5 && d5.openings.right === 345.5 && d5.openings.center === 1037 && d5.left === 339.5 && d5.center === 1031, `1/5-3/5-1/5: openings ${d5.openings.left} / ${d5.openings.center} / ${d5.openings.right} (0.5 mm), sashes ${d5.left} / ${d5.center} / ${d5.right}`);
  const dS = T1S.derived;
  ok(near(d.topSashHeight, dS.topSashHeight) && near(d.bottomSashHeight, dS.bottomSashHeight) && d.sashWidth === dS.sashWidth
    && JSON.stringify(d.components.box) === JSON.stringify(dS.components.box) && JSON.stringify(rows.filter((c) => /MULLION/.test(c.elementName))) === JSON.stringify(dS.components.sash.filter((c) => /MULLION/.test(c.elementName))),
    'the heights, the sash width, the box rows and the mullion rows equal START (the height rules are the double-hung rules, unchanged)');
  const stileRows = rows.filter((c) => /^STILES/.test(c.elementName)).map((c) => c.length), stileRowsS = dS.components.sash.filter((c) => /^STILES/.test(c.elementName)).map((c) => c.length);
  ok(JSON.stringify(stileRows) === JSON.stringify(stileRowsS) && stileRows.length === 12, 'the twelve stile lengths equal START (only the rail lengths changed)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - tripleDrawUtils: one layout law');
{
  const U = LIVE.tdu;
  const T = U.tripleSections(T1.derived);
  ok(T && T.sections.map((s) => `${s.key}:${s.label}:${s.width}/${s.opening}@${s.x}${s.fixed ? ':fixed' : ''}`).join(' ') === 'L:FIX L:426/432@3:fixed C:C:858/864@485 R:FIX R:426/432@1399:fixed',
    `sections ${T.sections.map((s) => `${s.label} ${s.width} in the opening ${s.opening} at x ${s.x}`).join(', ')} (x from the clear opening edge, gap / 2 in)`);
  ok(T.mullions.map((m) => `${m.label}@${m.x}+${m.width}`).join(' ') === 'MULLION (L)@432+50 MULLION (R)@1346+50' && T.totalWidth === 1828 && T.clear === 1828 && T.gap === 6,
    `mullions at ${T.mullions.map((m) => m.x).join(' and ')}, total ${T.totalWidth} = the clear width, gap ${T.gap}`);
  ok(T.sections.map((s) => s.listLocation).join(',') === 'fix L,centre,fix R', 'the glass-list locations of the sections');
  ok(U.tripleSheetKey('upper', T.sections[0]) === 'upperL' && U.tripleSheetLabel('lower', T.sections[2]) === 'Lower Sash FIX R', 'sheet keys and labels');
  ok(U.tripleMullionRecord(T1.derived, 'R')?.length === 1392 && U.tripleMullionRecord(T1.derived, 'L')?.section === '50x141', 'the mullion record from the cut list');
  const dbl = mk(LIVE, {});
  const cas = mk(LIVE, { windowCategory: 'casement', casementLayout: '040L' });
  ok(U.tripleSections(dbl.derived) === null && U.tripleSections(cas.derived) === null && U.tripleSections(null) === null, 'null for a double-hung, a casement, no data');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - 3D: the window page config and the meshes');
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
const keysOf = (list) => list.map(mkey).sort().join('\n');
{
  const cfg = LIVE.wsc.windowSpecToConfig(T1.spec, T1.derived);
  const cfgS = START.wsc.windowSpecToConfig(T1S.spec, T1S.derived);
  ok(cfg.sashType === 'triple' && cfg.splitRatio === '1/4-1/2-1/4', `window page config: sashType ${cfg.sashType}, splitRatio ${cfg.splitRatio}`);
  ok(cfgS.sashType === 'double', `START sent the 3D sashType '${cfgS.sashType}' for the same triple (the bug)`);
  const t3 = mk(LIVE, { sashType: 'triple', splitRatio: '1/3-1/3-1/3' });
  ok(LIVE.wsc.windowSpecToConfig(t3.spec, t3.derived).splitRatio === '1/3-1/3-1/3', 'the stored split 1/3-1/3-1/3 reaches the 3D');
  const dbl = mk(LIVE, {});
  ok(LIVE.wsc.windowSpecToConfig(dbl.spec, dbl.derived).sashType === 'double', 'a double-hung window still sends sashType double');
  const psw = mk(LIVE, {}, { sashType: 'triple', splitRatio: '1/5-3/5-1/5' });
  ok(psw.spec.sash.type === 'triple' && LIVE.wsc.windowSpecToConfig(psw.spec, psw.derived).sashType === 'triple' && LIVE.wsc.windowSpecToConfig(psw.spec, psw.derived).splitRatio === '1/5-3/5-1/5',
    'a PSW-style item with the type only in fullConfig: the spec and the 3D config read triple 1/5-3/5-1/5');
  // the meshes: the page config renders what the configurator renders (the same component, the same props)
  const pageMeshes = await meshes(L3, cfg);
  const configuratorMeshes = await meshes(L3, { ...cfg, sashType: 'triple', splitRatio: '1/4-1/2-1/4' });
  const doubleMeshes = await meshes(L3, cfgS);
  ok(pageMeshes.length > 0 && keysOf(pageMeshes) === keysOf(configuratorMeshes), `the page config renders the configurator's meshes (${pageMeshes.length})`);
  ok(keysOf(pageMeshes) !== keysOf(doubleMeshes) && pageMeshes.length > doubleMeshes.length, `the triple scene differs from the double START drew (${pageMeshes.length} vs ${doubleMeshes.length} meshes)`);
  // three sash columns: the glass meshes (the thinnest boxes in z) sit in three x bands
  const w = cfg.width / 1000;
  const bands = [...new Set(pageMeshes.filter((m) => m.max[1] - m.min[1] > 300 && m.max[0] - m.min[0] > 200).map((m) => Math.round((m.min[0] + m.max[0]) / 2 / 50) * 50))].sort((a, b) => a - b);
  ok(bands.length >= 3 && bands[0] < -w * 100 && bands[bands.length - 1] > w * 100, `tall meshes in ${bands.length} x bands (${bands.join(', ')} mm): left, centre, right sections`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - sheets: elevation, box, sash and glass per section');
{
  const T = LIVE.tdu.tripleSections(T1.derived);
  const bars = mk(LIVE, { ...TRIPLE, upperBars: '2x2', lowerBars: '2x2', hornType: 'A' });
  const el = render(LIVE.FrontElevation, { windowSpec: bars.spec, derived: bars.derived });
  const R = rectsOf(el);
  const fw = 2000, layoutSc = fw / 500, M = 60 * layoutSc;
  const clearX = M + (fw - 1828) / 2;
  const posts = R.filter((r) => r.w === 50 && r.h > 1000);
  ok(posts.length === 2 && near(posts[0].x, clearX + 432) && near(posts[1].x, clearX + 1346), `elevation: two mullion posts 50 wide at x ${posts.map((r) => r.x - clearX).join(' and ')} from the clear opening edge (engine 432 and 1346)`);
  const glass = R.filter((r) => r.h > 400 && r.w > 200 && r.fill !== 'none');
  const glassW = glass.map((r) => r.w).sort((a, b) => a - b);
  ok(glass.length === 6 && glassW.join(',') === '312,312,312,312,744,744', `elevation: six glass panes ${glassW.join(', ')} wide (426 - 114, 858 - 114)`);
  const paneX = glass.map((r) => r.x - clearX).sort((a, b) => a - b);
  ok(near(paneX[0], 3 + 57) && near(paneX[2], 485 + 57) && near(paneX[4], 1399 + 57), `elevation: the panes start at ${[paneX[0], paneX[2], paneX[4]].join(' / ')} from the clear edge (gap 3 + stile 57 into each opening)`);
  const barRects = R.filter((r) => r.w === 22 && r.fill === 'none');
  const centreX = [clearX + 485, clearX + 485 + 858];
  ok(barRects.length === 2 && barRects.every((r) => r.x > centreX[0] && r.x < centreX[1]), `elevation 2x2: ${barRects.length} bar rects, all inside the centre section (the 3D rule: no bars on the fixed sashes)`);
  const tx = texts(el);
  ok(['432', '50', '864'].every((s) => tx.includes(s)) && tx.filter((s) => s === '50').length === 2 && tx.filter((s) => s === '432').length === 2, `elevation chain labels (the openings and the posts): ${tx.join(' ')}`);
  ok(/sashes 426 \/ 858 \/ 426 \(gap 6\)/.test(textsOf(el)), 'elevation subtitle: the sash widths and the gap');
  ok(/triple sash 1\/4-1\/2-1\/4/.test(textsOf(el)), 'elevation subtitle names the triple and its split');
  const noHorns = mk(LIVE, { ...TRIPLE, upperBars: '2x2', lowerBars: '2x2', hornType: 'none' });
  const paths = (svg) => (svg.match(/<path /g) || []).length;
  const horns = paths(el) - paths(render(LIVE.FrontElevation, { windowSpec: noHorns.spec, derived: noHorns.derived }));
  ok(horns === 6, `elevation horns: ${horns} horn paths against the same window without horns (two per upper sash, three sashes, as the cut list and the 3D)`);

  const box = render(LIVE.BoxDetail, { windowSpec: T1.spec, derived: T1.derived });
  const RB = rectsOf(box);
  const DMb = 60 * layoutSc, Mb = 80 * layoutSc, oxb = Mb + DMb * 2;
  const bposts = RB.filter((r) => r.w === 50 && r.h > 1000);
  ok(bposts.length === 2 && near(bposts[0].x, oxb + 86 + 432) && near(bposts[1].x, oxb + 86 + 1346), `box sheet: two posts at frame x ${bposts.map((r) => r.x - oxb).join(' and ')} (liner 86 + 432, 86 + 1346)`);
  ok(texts(box).includes('MULLION (L) 50 x 1392') && texts(box).includes('MULLION (R) 50 x 1392'), 'box sheet labels: MULLION (L) 50 x 1392, MULLION (R) 50 x 1392 (the cut list record)');
  ok(['432', '864'].every((s) => texts(box).includes(s)) && /openings 432 \/ 864 \/ 432, sashes 426 \/ 858 \/ 426 \(gap 6\)/.test(textsOf(box)), 'box sheet chain 432 / 50 / 864 / 50 / 432 and the subtitle with the openings, the sashes and the gap');

  for (const s of T.sections) {
    for (const type of ['upper', 'lower']) {
      const svg = render(LIVE.SashDetail, { windowSpec: bars.spec, derived: bars.derived, type, section: s });
      const t = texts(svg);
      const title = `${type === 'upper' ? 'US' : 'LS'} (${s.label}) — Front — X`;
      const nBars = (svg.match(/stroke-width="[^"]*"/g) || []).length; // presence only; the bar count below
      const vbars = rectsOf(svg).length; // the sash sheet draws bars as lines; count the notch circles instead
      const notches = (svg.match(/<circle /g) || []).length;
      const glassLabel = s.fixed ? String(s.width - 114) : String((s.width - 114 - 22) / 2);   // the centre carries one vertical bar: two panes
      ok(t.includes(title) && t.includes(String(s.width)) && t.includes(glassLabel), `${title}: width ${s.width}, ${s.fixed ? 'glass' : 'pane'} ${glassLabel} (texts ${t.filter((x) => /^\d/.test(x)).join(' ')})`);
      ok(s.fixed ? notches === 0 : notches === 2, `${title}: ${notches} bar notch circles (${s.fixed ? 'fixed: none' : 'centre: one vertical bar'})`);
      void nBars; void vbars;
      const g = render(LIVE.GlassDrawing, { windowSpec: bars.spec, derived: bars.derived, type, section: s });
      const gt = texts(g);
      const gw = s.width - 91;
      ok(gt.includes(`${s.label} ${type.toUpperCase()} GLASS`) && gt.includes(`${gw} mm`) && gt.includes('610.5 mm') && !/⚠/.test(g),
        `${s.label} ${type} glass: ${gw} x 610.5 mm from the glass row, no bar alarm`);
      const spacer = (g.match(/stroke-width="0.5"/g) || []).length;
      ok(s.fixed ? spacer === 2 : spacer === 4, `${s.label} ${type} glass: ${spacer} half-width strokes (the frost pattern line, the edge seal${s.fixed ? '' : ', the two lines of one vertical spacer bar'})`);
    }
  }
  const vs = render(LIVE.VerticalSection, { windowSpec: T1.spec, derived: T1.derived });
  ok(vs === render(START.VerticalSection, { windowSpec: T1S.spec, derived: T1S.derived }), 'the vertical section sheet is unchanged (a section through the centre sash)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - the Elements plan and the pages in a browser');
{
  const plan = LIVE.elementsPayload.elementsPlan(T1.spec, T1.derived);
  ok(plan.rig.join(',') === 'box,upperL,upperC,upperR,lowerL,lowerC,lowerR', `plan rig: ${plan.rig.join(', ')}`);
  ok(plan.drawings.map((d) => d.label).join(' | ') === 'Box Detail | Upper Sash FIX L | Upper Sash C | Upper Sash FIX R | Lower Sash FIX L | Lower Sash C | Lower Sash FIX R', 'plan labels');
  ok(plan.drawings.slice(1).every((d) => d.section && d.type) && plan.sashSections.length === 3, 'every sash drawing carries its section and type');
}
let chromium = null;
try {
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  const entry = resolve(globalRoot, 'playwright', 'index.mjs');
  if (existsSync(entry)) ({ chromium } = await import(pathToFileURL(entry).href));
} catch { chromium = null; }
if (!chromium) {
  ok(false, 'playwright (global node install) and its Chromium are needed for the page checks (as t45)');
} else {
  const entry = resolve(AUDIT, 't47-pages-entry.jsx');
  writeFileSync(entry, [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { MemoryRouter, Routes, Route } from 'react-router-dom';",
    "import WindowDetailPage from '../src/pages/WindowDetailPage.jsx';",
    "import ProductionPackPage from '../src/pages/ProductionPackPage.jsx';",
    "import { useProjectStore } from '../src/stores/projectStore.js';",
    'window.__store = useProjectStore;',
    'window.confirm = () => true; window.alert = () => {};',
    "const root = createRoot(document.getElementById('root'));",
    'const E = React.createElement;',
    'window.__mount = (path) => root.render(E(MemoryRouter, { key: path + Math.random(), initialEntries: [path] }, E(Routes, null,',
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/windows/:windowId', element: E(WindowDetailPage) }),",
    "  E(Route, { path: '/projects/:projectId/batches/:batchId/production-pack', element: E(ProductionPackPage) }),",
    "  E(Route, { path: '*', element: E('div', { id: 'elsewhere' }, 'elsewhere') }))));",
  ].join('\n'));
  const bundleOut = resolve(AUDIT, 't47-pages-bundle.js');
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=iife', '--platform=browser',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--define:process.env.NODE_ENV="production"', '--log-level=error',
    '--alias:jspdf-autotable=jspdf-autotable/es', `--outfile=${bundleOut}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const html = resolve(AUDIT, 't47-pages.html');
  writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="t47-pages-bundle.js"></script></body></html>');

  const browserApp = await chromium.launch();
  const page = await browserApp.newPage({ viewport: { width: 1600, height: 1100 } });
  const pageErrors = [];
  // every network request is refused here (no Supabase): a refused store fetch is not a page bug
  page.on('pageerror', (e) => { const m = String(e?.message || e); if (!/Failed to fetch/.test(m)) pageErrors.push(m); });
  const hdr = Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n', 'latin1'), Buffer.from([128, 128, 128, 128])]);
  await page.route(/^https?:/, (r) => (r.request().url().endsWith('.hdr') ? r.fulfill({ status: 200, contentType: 'application/octet-stream', body: hdr }) : r.abort()));
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => !!window.__store);
  const ids = await page.evaluate(() => {
    const st = window.__store.getState();
    const p = st.createProject('Triple', '', 'P-47');
    const b = window.__store.getState().createBatch(p.id, 'sash');
    const add = (cfg) => window.__store.getState().addWindowToBatch(p.id, b.id, cfg);
    const triple = add({ windowName: 'TRI', extWidth: 2000, extHeight: 1500, sashType: 'triple', splitRatio: '1/4-1/2-1/4', upperBars: '2x2', lowerBars: '2x2', hornType: 'A' });
    const dbl = add({ windowName: 'DBL', extWidth: 1000, extHeight: 1400 });
    window.__store.getState().setCurrentProject(window.__store.getState().projects.find((pp) => pp.id === p.id));
    return { p: p.id, b: b.id, triple, dbl };
  });
  const mount = async (path) => { await page.evaluate((x) => window.__mount(x), path); await page.waitForTimeout(600); };
  const body = async () => page.locator('body').innerText();
  const waitText = async (t) => { try { await page.waitForSelector(`text=${t}`, { timeout: 15000 }); return true; } catch { console.log(`  (waiting for "${t}": page errors ${JSON.stringify(pageErrors.slice(-3))}; body ${JSON.stringify((await body()).slice(0, 300))})`); return false; } };
  const svgTexts = async () => page.evaluate(() => [...document.querySelectorAll('svg text')].map((t) => t.textContent));

  // ── window detail: the drawings tab (Upper / Lower: three sheets each), the glass tab (six drawings) ──
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${ids.triple}`);
  await waitText('Sashes & Bars');
  ok(pageErrors.length === 0 && /2000×1500/.test(await body()), `window detail TRI renders (page errors ${JSON.stringify(pageErrors)})`);
  await page.locator('button', { hasText: /2D Drawings/ }).first().click();
  await waitText('Front Elevation');
  let st = await svgTexts();
  ok(st.some((t) => /Front Elevation/.test(t)) && ['432', '864'].every((s) => st.includes(s)), `drawings tab, elevation: the chain ${['432', '50', '864'].map((s) => `${s}:${st.filter((t) => t === s).length}`).join(' ')}`);
  await page.locator('button', { hasText: /^Upper Sash$/ }).first().click();
  await page.waitForTimeout(300);
  st = await svgTexts();
  const usTitles = st.filter((t) => /^US \((FIX L|C|FIX R)\) — Front/.test(t));
  ok(usTitles.length === 6 && ['US (FIX L)', 'US (C)', 'US (FIX R)'].every((x) => usTitles.filter((t) => t.startsWith(x)).length === 2),
    `Upper Sash tab: three sheets on the tab and three in the hidden PDF rig (${usTitles.join(' | ')})`);
  await page.locator('button', { hasText: /^Lower Sash$/ }).first().click();
  await page.waitForTimeout(300);
  st = await svgTexts();
  const lsTitles = st.filter((t) => /^LS \((FIX L|C|FIX R)\) — Front/.test(t));
  ok(lsTitles.length === 6 && ['LS (FIX L)', 'LS (C)', 'LS (FIX R)'].every((x) => lsTitles.filter((t) => t.startsWith(x)).length === 2),
    `Lower Sash tab: three sheets on the tab and three in the hidden PDF rig (${lsTitles.join(' | ')})`);
  await page.locator('button', { hasText: /^Box Detail$/ }).first().click();
  await page.waitForTimeout(300);
  st = await svgTexts();
  ok(st.filter((t) => /^MULLION \((L|R)\) 50 x 1392$/.test(t)).length === 4, 'Box Detail tab: the two mullion posts labelled (on the tab and in the hidden rig)');
  await page.locator('button', { hasText: /Glass/ }).first().click();
  await waitText('FIX L Upper Glass');
  const b2 = await body();
  ok(['FIX L Upper Glass', 'C Upper Glass', 'FIX R Upper Glass', 'FIX L Lower Glass', 'C Lower Glass', 'FIX R Lower Glass'].every((s) => b2.includes(s)) && pageErrors.length === 0,
    'Glass tab: six glass drawings, one per section and sash');
  st = await svgTexts();
  ok(st.includes('767 mm') && st.filter((t) => t === '335 mm').length === 4, `Glass tab drawings: 767 / 335 / 335 mm (${st.filter((t) => / mm$/.test(t)).join(', ')})`);
  ok((b2.match(/fix L upper|centre upper|fix R upper|fix L lower|centre lower|fix R lower/g) || []).length >= 6, 'Glass tab table: the six engine rows');

  // the double-hung window on the same page: two sheets, two glass drawings, as before
  await mount(`/projects/${ids.p}/batches/${ids.b}/windows/${ids.dbl}`);
  await waitText('Sashes & Bars');
  await page.locator('button', { hasText: /2D Drawings/ }).first().click();
  await waitText('Front Elevation');
  await page.locator('button', { hasText: /^Upper Sash$/ }).first().click();
  await page.waitForTimeout(300);
  st = await svgTexts();
  ok(st.filter((t) => /^US — Front/.test(t)).length === 2 && st.filter((t) => /^US \(/.test(t)).length === 0, 'double-hung DBL: one Upper Sash sheet (plus the rig copy), no section label');
  await page.locator('button', { hasText: /Glass/ }).first().click();
  await waitText('Upper Glass');
  const b3 = await body();
  ok(b3.includes('Upper Glass') && b3.includes('Lower Glass') && !b3.includes('FIX L') && pageErrors.length === 0, 'double-hung DBL: Upper Glass and Lower Glass only');

  // ── production pack: seven Elements cards, six glass cards for the triple ──
  await mount(`/projects/${ids.p}/batches/${ids.b}/production-pack`);
  await waitText('TRI');
  await page.locator('button', { hasText: /2D Elements/ }).first().click();
  await waitText('Upper Sash FIX L');
  const b4 = await body();
  ok(['Box Detail', 'Upper Sash FIX L', 'Upper Sash C', 'Upper Sash FIX R', 'Lower Sash FIX L', 'Lower Sash C', 'Lower Sash FIX R'].every((s) => b4.includes(s)) && pageErrors.length === 0,
    `pack Elements: the seven cards of TRI (page errors ${JSON.stringify(pageErrors.slice(-2))})`);
  ok((b4.match(/Upper Sash\b/g) || []).length >= 4 && (b4.match(/\bUpper Sash$/m) || []).length >= 1, 'pack Elements: DBL keeps its Upper Sash / Lower Sash cards');
  st = await svgTexts();
  ok(st.filter((t) => /^US \((FIX L|C|FIX R)\) — Front/.test(t)).length === 3 && st.filter((t) => /^LS \((FIX L|C|FIX R)\) — Front/.test(t)).length === 3, 'pack Elements: the six section sheets mounted');
  await page.locator('button', { hasText: /Glass Schedule/ }).first().click();
  await waitText('FIX L Upper Glass');
  const b5 = await body();
  ok(['TRI — FIX L Upper Glass', 'TRI — C Upper Glass', 'TRI — FIX R Upper Glass', 'TRI — FIX L Lower Glass', 'TRI — C Lower Glass', 'TRI — FIX R Lower Glass', 'DBL — Upper Glass', 'DBL — Lower Glass'].every((s) => b5.includes(s)) && pageErrors.length === 0,
    'pack Glass: six cards for TRI, two for DBL');
  await browserApp.close();
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - controls: double-hung windows equal START');
{
  const CASES = [
    ['none', {}], ['2x2', { upperBars: '2x2', lowerBars: '2x2' }], ['6 over 1', { upperBars: '6x6', lowerBars: 'none' }],
    ['horns A', { hornType: 'A' }], ['cottage-40-60', { sashProportion: 'cottage-40-60' }],
  ];
  const sheets = (M, x) => ['upper', 'lower'].flatMap((t) => [render(M.SashDetail, { windowSpec: x.spec, derived: x.derived, type: t }), render(M.GlassDrawing, { windowSpec: x.spec, derived: x.derived, type: t })])
    .concat(render(M.FrontElevation, { windowSpec: x.spec, derived: x.derived }), render(M.BoxDetail, { windowSpec: x.spec, derived: x.derived }), render(M.VerticalSection, { windowSpec: x.spec, derived: x.derived }));
  for (const [label, extra] of CASES) {
    const a = mk(LIVE, { width: 1000, height: 1400, ...extra }), b = mk(START, { width: 1000, height: 1400, ...extra });
    ok(JSON.stringify(a.derived) === JSON.stringify(b.derived), `${label}: derived equal START`);
    ok(JSON.stringify(sheets(LIVE, a)) === JSON.stringify(sheets(START, b)), `${label}: the two sash sheets, two glass sheets, elevation, box and section byte-identical to START`);
    ok(JSON.stringify(LIVE.elementsPayload.elementsPlan(a.spec, a.derived)) === JSON.stringify(START.elementsPayload.elementsPlan(b.spec, b.derived)), `${label}: the Elements plan equal START`);
    ok(JSON.stringify(LIVE.wsc.windowSpecToConfig(a.spec, a.derived)) === JSON.stringify(START.wsc.windowSpecToConfig(b.spec, b.derived)), `${label}: the 3D config equal START`);
  }
  // an arched sash keeps its arched config (sashType 'arched' from the arch spread)
  const arch = mk(LIVE, { width: 1000, height: 2100 }, { sashType: 'arched-group', archShape: 'semi-circle' });
  const archS = mk(START, { width: 1000, height: 2100 }, { sashType: 'arched-group', archShape: 'semi-circle' });
  ok(LIVE.wsc.windowSpecToConfig(arch.spec, arch.derived).sashType === 'arched' && JSON.stringify(LIVE.wsc.windowSpecToConfig(arch.spec, arch.derived)) === JSON.stringify(START.wsc.windowSpecToConfig(archS.spec, archS.derived)),
    'arched sash: the 3D config (sashType arched) equal START');
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? 'FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
