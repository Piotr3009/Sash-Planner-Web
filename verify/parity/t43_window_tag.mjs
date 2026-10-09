/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t43 — window colour tag on the sheets (Piotr 08.10.2026).
 *
 * In the Pre-Cut "Per window" colour mode every sheet of a window in the
 * Production Pack (elevation, elements, glass) carries a small tag in the
 * window's colour with its number. Checks:
 *   1  every sheet component renders the tag when `windowTag` is passed, and
 *      the tag carries the number, the colour and the "window N" caption
 *   2  no sheet renders a tag without the prop (dashboard, previews, fixtures)
 *   3  the tag is a rectangle in the top right corner of the sheet, inside it
 *   4  windowTagsOf rule: per window mode only, number = position in the pack
 *
 * Run: node verify/parity/t43_window_tag.mjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const entry = resolve(AUDIT, 't43-entry.mjs');
const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
writeFileSync(entry, [
  `export { default as DoorSheet } from '${rel('components/drawings/DoorSheet.jsx')}';`,
  `export { default as DoorElevation } from '${rel('components/drawings/DoorElevation2D.jsx')}';`,
  `export { default as DoorGlass } from '${rel('components/drawings/DoorGlassDrawing2D.jsx')}';`,
  `export { default as CasElevation } from '${rel('components/drawings/CasementElevation2D.jsx')}';`,
  `export { default as CasFrame } from '${rel('components/drawings/CasementFrameDetail2D.jsx')}';`,
  `export { default as CasLeaf } from '${rel('components/drawings/CasementLeafDetail2D.jsx')}';`,
  `export { default as CasSection } from '${rel('components/drawings/CasementSection2D.jsx')}';`,
  `export { default as CasGlass } from '${rel('components/drawings/CasementGlassDrawing2D.jsx')}';`,
  `export { default as Front } from '${rel('components/drawings/FrontElevation2D.jsx')}';`,
  `export { default as Box } from '${rel('components/drawings/BoxDetail2D.jsx')}';`,
  `export { default as Sash } from '${rel('components/drawings/SashDetail2D.jsx')}';`,
  `export { default as Glass } from '${rel('components/drawings/GlassDrawing2D.jsx')}';`,
  `export * as ddu from '${rel('components/drawings/doorDrawUtils.js')}';`,
  `export * as cdu from '${rel('components/drawings/casementDrawUtils.js')}';`,
  `export * as specification from '${rel('engine/specification.js')}';`,
  `export * as calculations from '${rel('engine/calculations.js')}';`,
  `export * as partColours from '${rel('engine/partColours.js')}';`,
].join('\n'));
const out = resolve(AUDIT, 't43-bundle.mjs');
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

const cas = mk({ id: 'c2', name: 'C2', width: 1200, height: 1500 }, { windowCategory: 'casement', casementLayout: '022', casementHBars: 1, casementVBars: 1 });
const arc = mk({ id: 'c3', name: 'C3', width: 1000, height: 1500 }, { windowCategory: 'casement', casementLayout: '040L', archShape: 'three-centre', archStart: 1300 });
const door = mk({ id: 'd', name: 'D1', width: 2400, height: 2400 }, { windowCategory: 'door', doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'opening', transomHeight: 450, doorStyle: 'half-glazed' });
const sash = mk({ id: 's', name: 'S1', width: 1000, height: 1600 }, { windowCategory: 'sash', frameType: 'standard' });

// every sheet component the pack mounts: [name, component, props]
const SHEETS = [
  ['casement elevation', M.CasElevation, { windowSpec: cas.spec, derived: cas.derived, projectNumber: 'P-1' }],
  ['casement frame', M.CasFrame, { windowSpec: cas.spec, derived: cas.derived, projectNumber: 'P-1' }],
  ['casement leaf', M.CasLeaf, { windowSpec: cas.spec, derived: cas.derived, projectNumber: 'P-1', group: M.cdu.groupCasementLeaves(cas.derived)[0] }],
  ['casement section', M.CasSection, { windowSpec: cas.spec, derived: cas.derived, projectNumber: 'P-1' }],
  ['casement glass', M.CasGlass, { windowSpec: cas.spec, derived: cas.derived, group: M.cdu.groupCasementGlass(cas.derived, cas.spec)[0] }],
  ['arched casement frame', M.CasFrame, { windowSpec: arc.spec, derived: arc.derived, projectNumber: 'P-1' }],
  ['door elevation', M.DoorElevation, { windowSpec: door.spec, derived: door.derived, projectNumber: 'P-1' }],
  ...M.ddu.doorSheetPlan(door.derived).map((p) => [`door ${p.key}`, M.DoorSheet, { sheet: p, windowSpec: door.spec, derived: door.derived, projectNumber: 'P-1' }]),
  ['door glass', M.DoorGlass, { windowSpec: door.spec, derived: door.derived, group: M.ddu.groupDoorGlass(door.derived, door.spec)[0] }],
  ['sash front', M.Front, { windowSpec: sash.spec, derived: sash.derived, projectNumber: 'P-1' }],
  ['sash box', M.Box, { windowSpec: sash.spec, derived: sash.derived, projectNumber: 'P-1' }],
  ['sash upper', M.Sash, { windowSpec: sash.spec, derived: sash.derived, projectNumber: 'P-1', type: 'upper' }],
  ['sash lower', M.Sash, { windowSpec: sash.spec, derived: sash.derived, projectNumber: 'P-1', type: 'lower' }],
  ['sash glass', M.Glass, { windowSpec: sash.spec, derived: sash.derived, type: 'upper' }],
];
const TAG = { number: 3, hex: '#E04A2A' };
const tagRe = /<g data-window-tag="3"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="#E04A2A"/;

console.log('== 1 + 2 + 3: every sheet, with and without the tag ==');
for (const [name, C, props] of SHEETS) {
  const withTag = svgOnly(render(C, { ...props, windowTag: TAG }));
  const without = svgOnly(render(C, props));
  const m = withTag.match(tagRe);
  const vb = withTag.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const W = vb ? Number(vb[1]) : NaN;
  const [x, y, w, h] = m ? m.slice(1, 5).map(Number) : [];
  const inside = m && vb && x > W * 0.8 && x + w < W && y >= 0 && y < W * 0.05 && w > 0 && h > 0 && w < W * 0.1;
  ok(!!m && withTag.includes('>3</text>') && withTag.includes('>window 3</text>'), `${name}: tag with number 3, colour and caption`, withTag.slice(0, 120));
  ok(inside, `${name}: tag is a rectangle in the top right corner (x ${x} of ${W})`, JSON.stringify({ x, y, w, h, W }));
  ok(!/data-window-tag/.test(without) && !without.includes('window 3'), `${name}: no tag without the prop`);
  // the tag is the only difference (the sheet itself does not move)
  const stripped = withTag.replace(/<g data-window-tag="3">[\s\S]*?<\/g>/, '');
  ok(stripped === without, `${name}: with the tag removed the sheet equals the untagged one byte for byte`);
}

console.log('== 4: the pack rule (windowTagsOf) ==');
{
  // the page helper is private to ProductionPackPage; its rule is the one tested here
  const windowTagsOf = (windowsData, precutSettings) => {
    if (M.partColours.normaliseColourMode(precutSettings) !== 'window') return () => null;
    const tags = new Map(windowsData.map(({ win }, i) => [String(win?.id), { number: i + 1, hex: M.partColours.windowColourForIndex(i)?.hex || null }]));
    return (win) => tags.get(String(win?.id)) || null;
  };
  const wd = Array.from({ length: 12 }, (_, i) => ({ win: { id: `w${i + 1}` } }));
  const on = windowTagsOf(wd, { colourMode: 'window' });
  ok(on(wd[0].win).number === 1 && on(wd[0].win).hex === M.partColours.WINDOW_COLOURS[0] && on(wd[2].win).hex === '#E04A2A' && on(wd[9].win).hex === '#A06A2C',
    'per window: window 1 = colour 1, window 3 red, window 10 brown');
  ok(on(wd[10].win).number === 11 && on(wd[10].win).hex === M.partColours.WINDOW_COLOURS[0], 'window 11 keeps its number and repeats colour 1');
  ok(on({ id: 'zz' }) === null, 'a window outside the pack has no tag');
  ok(windowTagsOf(wd, { colourMode: 'part' })(wd[0].win) === null && windowTagsOf(wd, { colourMode: 'off' })(wd[0].win) === null && windowTagsOf(wd, undefined)(wd[0].win) === null && windowTagsOf(wd, { colourByPart: false })(wd[0].win) === null,
    'per part, off, a pack never saved and the legacy colourByPart false: no tags');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
