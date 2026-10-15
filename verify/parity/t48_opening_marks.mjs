/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t48 — opening marks on the elevations (Piotr 15.10.2026).
 *
 * The 2D elevations say which pane opens and which never does: a red X on a
 * pane that never opens (casement fixed light, the side lights and the fixed
 * fanlight of a door, the fixed sashes of a triple or of a "bottom only" /
 * "fixed" sash window, a circle) and a green arrow on a sliding sash (down on
 * the upper, up on the lower). Casement and door leaves keep the dashed
 * opening triangle. The 3D shows the look of the window, not information.
 * Checks:
 *   1  casement: fixed lights get the X, openers keep the triangle and get no X
 *   2  sash: both / bottom / fixed / triple give the right marks per sash
 *   3  doors: side lights and fixed fans get the X, opening fans and leaves do not
 *   4  circle elevation: one X
 *   5  no mark on any other sheet (frame, leaf, glass, box, sash detail)
 *   6  the marks are the only difference: an elevation with its marks stripped
 *      equals the one of a tree without them byte for byte (the fixtures)
 *   7  colours and sizes: red / green from the theme, the X leaves the centre clear
 *
 * Run: node verify/parity/t48_opening_marks.mjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const entry = resolve(AUDIT, 't48-entry.mjs');
const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
writeFileSync(entry, [
  `export { default as CasElevation } from '${rel('components/drawings/CasementElevation2D.jsx')}';`,
  `export { default as CasFrame } from '${rel('components/drawings/CasementFrameDetail2D.jsx')}';`,
  `export { default as CasLeaf } from '${rel('components/drawings/CasementLeafDetail2D.jsx')}';`,
  `export { default as CasGlass } from '${rel('components/drawings/CasementGlassDrawing2D.jsx')}';`,
  `export { default as Front } from '${rel('components/drawings/FrontElevation2D.jsx')}';`,
  `export { default as Box } from '${rel('components/drawings/BoxDetail2D.jsx')}';`,
  `export { default as Sash } from '${rel('components/drawings/SashDetail2D.jsx')}';`,
  `export { default as Glass } from '${rel('components/drawings/GlassDrawing2D.jsx')}';`,
  `export { default as DoorElevation } from '${rel('components/drawings/DoorElevation2D.jsx')}';`,
  `export { default as DoorSheet } from '${rel('components/drawings/DoorSheet.jsx')}';`,
  `export { default as Circle } from '${rel('components/drawings/CircleFixedDrawing2D.jsx')}';`,
  `export * as ddu from '${rel('components/drawings/doorDrawUtils.js')}';`,
  `export * as cdu from '${rel('components/drawings/casementDrawUtils.js')}';`,
  `export * as theme from '${rel('components/drawings/drawingTheme.js')}';`,
  `export * as specification from '${rel('engine/specification.js')}';`,
  `export * as calculations from '${rel('engine/calculations.js')}';`,
].join('\n'));
const out = resolve(AUDIT, 't48-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
  '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
  `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist/i.test(String(a[0]))) return; warn(...a); };
const M = await import(pathToFileURL(out).href + `?t=${Date.now()}`);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const render = (C, props) => renderToStaticMarkup(React.createElement(C, props));
const svgOnly = (s) => { const i = s.indexOf('<svg'); const j = s.lastIndexOf('</svg>'); return i < 0 ? '' : s.slice(i, j + 6); };
const mk = (item, fc) => { const spec = M.specification.normaliseToWindowSpec(item, { fullConfig: fc }); return { spec, derived: M.calculations.deriveWindowData(spec, {}) }; };
const marks = (svg) => [...svg.matchAll(/data-opening-mark="([^"]+)"/g)].map((m) => m[1]);
const count = (svg) => marks(svg).reduce((acc, m) => ({ ...acc, [m]: (acc[m] || 0) + 1 }), {});
const strip = (svg) => svg.replace(/<g data-opening-mark="[^"]*">.*?<\/g>/g, '');
const triangles = (svg) => (svg.match(/stroke-dasharray="[\d.]+,[\d.]+"/g) || []).length;

console.log('== 1 casement ==');
{
  const c021 = mk({ id: 'c1', name: 'C1', width: 1200, height: 1500 }, { windowCategory: 'casement', casementLayout: '021' });
  const e021 = svgOnly(render(M.CasElevation, { windowSpec: c021.spec, derived: c021.derived, projectNumber: 'P-1' }));
  const fixed021 = M.cdu.groupCasementLeaves(c021.derived).flatMap((g) => g.panes).filter((p) => p.hinge === 'fixed').length;
  ok(fixed021 >= 1 && count(e021).fixed === fixed021 && !marks(e021).some((m) => m.startsWith('slide')), `021: one red X per fixed light (${fixed021}), no arrows`, JSON.stringify(count(e021)));
  const c040 = mk({ id: 'c2', name: 'C2', width: 1000, height: 1200 }, { windowCategory: 'casement', casementLayout: '040L' });
  const e040 = svgOnly(render(M.CasElevation, { windowSpec: c040.spec, derived: c040.derived, projectNumber: 'P-1' }));
  ok(marks(e040).length === 0 && triangles(e040) >= 1, '040L (one opener): no X, the dashed opening triangle stays', JSON.stringify(count(e040)));
  const c022 = mk({ id: 'c3', name: 'C3', width: 1200, height: 1500 }, { windowCategory: 'casement', casementLayout: '022' });
  const e022 = svgOnly(render(M.CasElevation, { windowSpec: c022.spec, derived: c022.derived, projectNumber: 'P-1' }));
  const panes022 = M.cdu.groupCasementLeaves(c022.derived).flatMap((g) => g.panes);
  ok(count(e022).fixed === panes022.filter((p) => p.hinge === 'fixed').length && triangles(e022) >= panes022.filter((p) => p.hinge !== 'fixed').length,
    `022: X on the ${panes022.filter((p) => p.hinge === 'fixed').length} fixed lights, triangles on the ${panes022.filter((p) => p.hinge !== 'fixed').length} openers`, JSON.stringify(count(e022)));
  const cf = mk({ id: 'c4', name: 'C4', width: 900, height: 1200 }, { windowCategory: 'casement', casementKind: 'fixed' });
  const ef = svgOnly(render(M.CasElevation, { windowSpec: cf.spec, derived: cf.derived, projectNumber: 'P-1' }));
  ok(count(ef).fixed >= 1 && !marks(ef).some((m) => m.startsWith('slide')), 'a fixed casement window: X on its light', JSON.stringify(count(ef)));
}

console.log('== 2 sash ==');
{
  const S = (fc) => { const w = mk({ id: 's', name: 'S', width: 1000, height: 1600 }, { windowCategory: 'sash', frameType: 'standard', ...fc }); return svgOnly(render(M.Front, { windowSpec: w.spec, derived: w.derived, projectNumber: 'P-1' })); };
  ok(JSON.stringify(marks(S({ openingType: 'both' }))) === JSON.stringify(['slide-down', 'slide-up']), 'both: arrow down on the upper sash, arrow up on the lower', JSON.stringify(marks(S({ openingType: 'both' }))));
  ok(JSON.stringify(marks(S({ openingType: 'bottom' }))) === JSON.stringify(['fixed', 'slide-up']), 'bottom only: X on the upper, arrow up on the lower', JSON.stringify(marks(S({ openingType: 'bottom' }))));
  ok(JSON.stringify(marks(S({ openingType: 'fixed' }))) === JSON.stringify(['fixed', 'fixed']), 'fixed: X on both sashes', JSON.stringify(marks(S({ openingType: 'fixed' }))));
  ok(JSON.stringify(marks(S({}))) === JSON.stringify(['slide-down', 'slide-up']), 'no opening type stored: both (the default)');
  const t = mk({ id: 't', name: 'T', width: 2000, height: 1500 }, { windowCategory: 'sash', frameType: 'standard', sashType: 'triple', splitRatio: '1/4-1/2-1/4' });
  const et = svgOnly(render(M.Front, { windowSpec: t.spec, derived: t.derived, projectNumber: 'P-1' }));
  ok(count(et).fixed === 5 && count(et)['slide-up'] === 1 && !count(et)['slide-down'], 'triple: five X (both side sections, the middle upper), one arrow up on the middle lower sash', JSON.stringify(count(et)));
  const cot = mk({ id: 'k', name: 'K', width: 1000, height: 1400 }, { windowCategory: 'sash', frameType: 'standard', sashProportion: 'cottage-40-60' });
  const ec = svgOnly(render(M.Front, { windowSpec: cot.spec, derived: cot.derived, projectNumber: 'P-1' }));
  ok(JSON.stringify(marks(ec)) === JSON.stringify(['slide-down', 'slide-up']), 'cottage 40/60: both arrows (the marks follow the sash heights)');
}

console.log('== 3 doors ==');
{
  const D = (fc) => mk({ id: 'd', name: 'D', width: 2400, height: 2400 }, { windowCategory: 'door', doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, ...fc });
  const fixedFan = D({ transomType: 'fixed', transomHeight: 450 });
  const ef = svgOnly(render(M.DoorElevation, { windowSpec: fixedFan.spec, derived: fixedFan.derived, projectNumber: 'P-1' }));
  const nFan = fixedFan.derived.door.fanLeaves.length, nSide = fixedFan.derived.door.panelLeaves.length;
  ok(count(ef).fixed === nFan + nSide && !marks(ef).some((m) => m.startsWith('slide')), `french, side panels, fixed fan: X on the ${nSide} side lights and the ${nFan} fixed fan lights, none elsewhere`, JSON.stringify(count(ef)));
  const openFan = D({ transomType: 'opening', transomHeight: 450 });
  const eo = svgOnly(render(M.DoorElevation, { windowSpec: openFan.spec, derived: openFan.derived, projectNumber: 'P-1' }));
  ok(count(eo).fixed === nSide && triangles(eo) >= openFan.derived.door.fanLeaves.length + 2, `opening fan: X on the ${nSide} side lights only; the fan leaves and the door leaves keep their triangles`, JSON.stringify(count(eo)));
  const single = mk({ id: 'd1', name: 'D1', width: 900, height: 2100 }, { windowCategory: 'door', doorType: 'single-external' });
  const es = svgOnly(render(M.DoorElevation, { windowSpec: single.spec, derived: single.derived, projectNumber: 'P-1' }));
  ok(marks(es).length === 0 && triangles(es) >= 1, 'single door: no X, the leaf triangle stays');
  // the door sheets other than the elevation carry no mark
  const plan = M.ddu.doorSheetPlan(fixedFan.derived);
  ok(plan.every((p) => marks(svgOnly(render(M.DoorSheet, { sheet: p, windowSpec: fixedFan.spec, derived: fixedFan.derived, projectNumber: 'P-1' }))).length === 0), `no mark on the ${plan.length} door detail sheets`);
}

console.log('== 4 circle ==');
{
  const ci = mk({ id: 'ci', name: 'CI', width: 900, height: 900 }, { windowCategory: 'casement', casementKind: 'fixed', archShape: 'circle' });
  const el = svgOnly(render(M.Circle, { windowSpec: ci.spec, derived: ci.derived, projectNumber: 'P-1', view: 'elevation' }));
  const fr = svgOnly(render(M.Circle, { windowSpec: ci.spec, derived: ci.derived, projectNumber: 'P-1', view: 'frame' }));
  const lf = svgOnly(render(M.Circle, { windowSpec: ci.spec, derived: ci.derived, projectNumber: 'P-1', view: 'leaf' }));
  ok(count(el).fixed === 1 && marks(fr).length === 0 && marks(lf).length === 0, 'circle: one X on the elevation, none on the frame and leaf ring sheets', JSON.stringify([count(el), marks(fr), marks(lf)]));
}

console.log('== 5 other sheets carry no mark ==');
{
  const c = mk({ id: 'c', name: 'C', width: 1200, height: 1500 }, { windowCategory: 'casement', casementLayout: '021' });
  const s = mk({ id: 's', name: 'S', width: 1000, height: 1600 }, { windowCategory: 'sash', frameType: 'standard' });
  const sheets = {
    'casement frame': render(M.CasFrame, { windowSpec: c.spec, derived: c.derived, projectNumber: 'P-1' }),
    'casement leaf': render(M.CasLeaf, { windowSpec: c.spec, derived: c.derived, projectNumber: 'P-1', group: M.cdu.groupCasementLeaves(c.derived)[0] }),
    'casement glass': render(M.CasGlass, { windowSpec: c.spec, derived: c.derived, group: M.cdu.groupCasementGlass(c.derived, c.spec)[0] }),
    'sash box': render(M.Box, { windowSpec: s.spec, derived: s.derived, projectNumber: 'P-1' }),
    'sash upper': render(M.Sash, { windowSpec: s.spec, derived: s.derived, projectNumber: 'P-1', type: 'upper' }),
    'sash glass': render(M.Glass, { windowSpec: s.spec, derived: s.derived, type: 'upper' }),
  };
  for (const [name, html] of Object.entries(sheets)) ok(marks(svgOnly(html)).length === 0, `${name}: no mark`);
}

console.log('== 6 the marks are the only difference (fixtures) ==');
{
  const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-sheets.json'), 'utf8'));
  const FXB = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-base.json'), 'utf8'));
  let n = 0, same = 0;
  for (const [name, sheets] of Object.entries(FX)) {
    const c = FXB[name];
    const w = mk({ id: 'fx_' + name, name, width: c.input.width, height: c.input.height }, c.input.fc);
    const live = svgOnly(render(M.Front, { windowSpec: w.spec, derived: w.derived }));   // the fixture renders without a project number
    n += 1;
    if (live === svgOnly(sheets.elevation) && marks(live).length >= 2) same += 1;
  }
  ok(n === 6 && same === 6, 'the six sash fixture elevations render as stored, each with its marks (fixture re-baselined 15.10.2026, diff = the marks only)', `${same} of ${n}`);
  const base = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-sheets.json'), 'utf8'));
  const stored = Object.values(base.sheets).map((s) => svgOnly(s.elevation));
  ok(stored.reduce((acc, s) => acc + marks(s).length, 0) === 1 && stored.every((s) => !strip(s).includes('data-opening-mark')), 'the casement fixture elevations carry exactly one X (one fixed light among the four windows) and strip cleanly');
}

console.log('== 7 colours and shape ==');
{
  const s = mk({ id: 's', name: 'S', width: 1000, height: 1600 }, { windowCategory: 'sash', frameType: 'standard', openingType: 'bottom' });
  const svg = svgOnly(render(M.Front, { windowSpec: s.spec, derived: s.derived, projectNumber: 'P-1' }));
  const x = svg.match(/<g data-opening-mark="fixed">(.*?)<\/g>/)[1];
  const arrow = svg.match(/<g data-opening-mark="slide-up">(.*?)<\/g>/)[1];
  ok(M.theme.COLORS.markFixed === '#EF4444' && M.theme.COLORS.markOpen === '#22C55E', 'theme: red X, green arrow');
  ok((x.match(/<line /g) || []).length === 4 && x.split(M.theme.COLORS.markFixed).length === 5, 'the X is four red segments (a gap at the centre keeps a pane label legible)');
  ok((arrow.match(/<line /g) || []).length === 1 && (arrow.match(/<path /g) || []).length === 1 && arrow.includes(`fill="${M.theme.COLORS.markOpen}"`), 'the arrow is one green shaft and one filled green head');
  const xs = [...x.matchAll(/x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
  const cx = (xs[0][0] + xs[1][0]) / 2, gap = Math.abs(xs[0][0] - cx), reach = Math.abs(xs[0][2] - cx);
  ok(xs.length === 4 && gap > 0 && reach > gap * 2, `the X segments start ${gap.toFixed(1)} from the centre and reach ${reach.toFixed(1)}`);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
