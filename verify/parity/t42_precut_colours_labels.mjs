/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t42: Pre-Cut colours per window, labels and the 10 mm allowance (Piotr 08.10.2026).
 *
 *   1  the pre-cut allowance is a setting: default 10 (was a fixed 20), a tenant
 *      value is honoured, an invalid one falls back; every window type
 *   2  no C- / D- / S- prefix reaches a symbol or a displayed name
 *   3  window colours: ten, by pack position, repeating from the eleventh
 *   4  the colour mode saved with a pack: 'off' | 'part' | 'window', legacy colourByPart
 *   5  optimizer pieces carry windowId, finishedLength and section
 *   6  labels: one per piece in bar order, 44 per A4 sheet inside the page,
 *      PRE-CUT and CUT, the colour of the mode; the PDF builds in node
 *   7  the Cut List groups carry their engine element (colour by element, part mode only)
 *
 * Run: node verify/parity/t42_precut_colours_labels.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, n, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}${d ? `  :: ${d}` : ''}`); } };

function bundle(name) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    ...['specification', 'calculations', 'lists', 'optimizer', 'partSymbols', 'partColours'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    `export * as precutPdf from '${rel('utils/precutPdfExport.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const M = await bundle('t42');
const { specification: S, calculations: C, lists, optimizer, partSymbols, partColours, precutPdf } = M;

const mk = (over) => {
  const it = { name: 'W', width: 1000, height: 1200, windowCategory: 'casement', casementLayout: '040L', glassType: 'double', frameType: 'standard', ...over };
  const spec = S.normaliseToWindowSpec({ ...it, fullConfig: it });
  return { spec, derived: C.deriveWindowData(spec) };
};
const sash = mk({ windowCategory: 'sash', width: 900, height: 1500 });
const cas = mk({});
const door = mk({ windowCategory: 'door', width: 900, height: 2100, doorType: 'single-external' });
const items = (pc) => [...pc.sashEngineering.flatMap((g) => g.items), ...pc.boxSapele.flatMap((g) => g.items)];

console.log('== 1 allowance ==');
{
  ok(lists.precutAllowanceOf({}) === 10 && lists.precutAllowanceOf(undefined) === 10 && lists.precutAllowanceOf(null) === 10, 'default allowance 10');
  ok(lists.precutAllowanceOf({ precutAllowance: 15 }) === 15 && lists.precutAllowanceOf({ precutAllowance: 0 }) === 0 && lists.precutAllowanceOf({ precutAllowance: 'x' }) === 10 && lists.precutAllowanceOf({ precutAllowance: -3 }) === 10,
    'a tenant value is honoured (15, 0); junk and negatives fall back to 10');
  for (const [label, w] of [['sash', sash], ['casement', cas], ['door', door]]) {
    const d10 = items(lists.buildPrecutForWindow(w.derived, w.spec, {}, undefined)).filter((it) => !it.blank);
    const d15 = items(lists.buildPrecutForWindow(w.derived, w.spec, { precutAllowance: 15 }, undefined)).filter((it) => !it.blank);
    ok(d10.length > 0 && d10.every((it) => it.length === Math.round(it.finishedLength + 10) || it.length === Math.round(it.finishedLength) + 10),
      `${label}: every straight pre-cut piece = finished + 10 (${d10.length} pieces)`, JSON.stringify(d10.slice(0, 2)));
    ok(d15.every((it, i) => it.length === d10[i].length + 5), `${label}: a 15 mm setting adds 5 more to every piece`);
  }
  const jamb = items(lists.buildPrecutForWindow(cas.derived, cas.spec, {}, undefined)).find((it) => it.elementName === 'C-FRAME JAMB (L)');
  ok(jamb && jamb.length === 1210 && jamb.finishedLength === 1200, 'casement 1000 x 1200: jamb pre-cut 1210 (finished 1200)', JSON.stringify(jamb));
}

console.log('== 2 no prefix ==');
{
  const names = [...new Set([...cas.derived.components.box, ...cas.derived.components.sash, ...door.derived.components.box, ...door.derived.components.sash, ...sash.derived.components.box, ...sash.derived.components.sash].map((c) => c.elementName))];
  const syms = names.map((n) => partSymbols.getPartSymbol(n));
  ok(syms.every((s) => !/^[CDS]-/.test(s.symbol) && !/^[CDS]-/.test(s.name)), `no symbol or name of ${names.length} engine names starts with C- / D- / S-`, JSON.stringify(syms.filter((s) => /^[CDS]-/.test(s.symbol) || /^[CDS]-/.test(s.name))));
  ok(names.every((n) => !/^[CDS]-/.test(partSymbols.displayElementName(n))) && partSymbols.displayElementName('C-FRAME JAMB (L)') === 'FRAME JAMB (L)' && partSymbols.displayElementName('HEAD') === 'HEAD',
    'displayElementName strips the prefix and leaves sash names alone');
  const casSym = (n) => partSymbols.getPartSymbol(n).symbol;
  ok(['C-FRAME HEAD', 'C-FRAME JAMB (L)', 'C-FRAME JAMB (R)', 'C-FRAME CILL', 'C-MULLION', 'C-TRANSOM', 'C-STILE (L)', 'C-TOP RAIL', 'C-BOTTOM RAIL'].map(casSym).join(' ') === 'FH J-L J-R CILL M T ST-L TR BR',
    'casement symbols FH J-L J-R CILL M T ST-L TR BR (were CFRA for head, jamb and cill alike)');
  const order = [...lists.CUT_LIST_ORDER.map((d) => d.symbol), ...Object.values(lists.MIRROR_PAIRS).map((p) => p.symbol)];
  ok(order.every((s) => !/^[CDS]-/.test(s)), 'no Cut List symbol starts with C- / D- / S-', JSON.stringify(order.filter((s) => /^[CDS]-/.test(s))));
  const g = lists.buildGroupedCutList(lists.buildCutListForWindow(cas.derived, cas.spec).map((r) => ({ ...r, windowName: 'W1' })));
  ok(g.length > 0 && g.every((x) => typeof x.element === 'string' && x.element) && g.some((x) => x.element === 'C-FRAME JAMB (L)' && x.symbol === 'J-L/R'),
    'Cut List groups carry their engine element; casement jambs = J-L/R', JSON.stringify(g.map((x) => [x.symbol, x.element])));
  ok(g.every((x) => partColours.partColourForElement(x.element)), 'every casement Cut List group has a part colour by its element');
}

console.log('== 3 window colours ==');
{
  ok(partColours.WINDOW_COLOURS.length === 10 && new Set(partColours.WINDOW_COLOURS.map((h) => h.toUpperCase())).size === 10, 'ten distinct window colours');
  ok(partColours.windowColourForIndex(0).hex === partColours.WINDOW_COLOURS[0] && partColours.windowColourForIndex(10).hex === partColours.WINDOW_COLOURS[0] && partColours.windowColourForIndex(10).repeatOf === 0 && partColours.windowColourForIndex(11).repeatOf === 1 && partColours.windowColourForIndex(3).repeatOf === null,
    'window 1 = colour 1, window 11 = colour 1 again (repeatOf 0), window 12 = colour 2');
  ok(partColours.windowColourForIndex(null) === null && partColours.windowColourForIndex(-1) === null && partColours.windowColourForIndex('x') === null, 'no colour for an unknown window');
}

console.log('== 4 colour mode ==');
{
  const n = partColours.normaliseColourMode;
  ok(n(undefined) === 'part' && n({}) === 'part' && n({ colourByPart: true }) === 'part' && n({ colourByPart: false }) === 'off', 'legacy colourByPart: true / absent = part, false = off');
  ok(n({ colourMode: 'window' }) === 'window' && n({ colourMode: 'off', colourByPart: true }) === 'off' && n({ colourMode: 'nonsense' }) === 'part', 'colourMode wins when valid');
  ok(JSON.stringify(partColours.COLOUR_MODES) === '["off","part","window"]', 'three modes: off, part, window');
}

console.log('== 5 optimizer pieces ==');
{
  const pc = lists.buildPrecutForWindow(cas.derived, cas.spec, {}, undefined);
  pc.sashEngineering.forEach((g) => g.items.forEach((it) => { it.windowName = 'W1'; it._projectNumber = '115'; }));
  pc.boxSapele.forEach((g) => g.items.forEach((it) => { it.windowName = 'W1'; it._projectNumber = '115'; }));
  const opt = optimizer.optimisePrecut(pc, { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 2500 });
  const details = [...opt.sashEngineering, ...opt.boxSapele].flatMap((g) => g.bars.flatMap((b) => b.cutDetails || []));
  ok(details.length > 0 && details.every((d) => d.windowId === cas.spec.id && Number.isInteger(d.finishedLength) && d.length === d.finishedLength + 10 && typeof d.section === 'string' && d.section),
    `every bar piece carries windowId, finishedLength (= length - 10) and section (${details.length} pieces)`, JSON.stringify(details[0]));
}

console.log('== 6 labels ==');
{
  const L = precutPdf.LABEL_SHEET;
  ok(L.cols * L.rows === 44 && L.w === 48.5 && L.h === 25.4, '44 labels of 48.5 x 25.4 per A4 sheet');
  const slots = Array.from({ length: 90 }, (_, i) => precutPdf.labelSlot(i));
  ok(slots.slice(0, 44).every((s) => s.page === 0) && slots[44].page === 1 && slots[44].col === 0 && slots[44].row === 0 && slots[89].page === 2,
    'labels 1 to 44 on sheet 1, 45 starts sheet 2, 90 is on sheet 3');
  ok(slots.every((s) => s.x >= 8 && s.x + L.w <= 210 - 7.9 && s.y >= 8.8 && s.y + L.h <= 297 - 8.7), 'every label lies inside the A4 page (8 / 8.8 mm margins, no gaps)');
  // a two-window "pack": window 1 casement, window 2 the same, labels in bar order with the window colour
  const w1 = cas, w2 = mk({ width: 1200, height: 1000 });
  const pc1 = lists.buildPrecutForWindow(w1.derived, w1.spec, {}, undefined), pc2 = lists.buildPrecutForWindow(w2.derived, w2.spec, {}, undefined);
  const tag = (pc, win, i) => { [...pc.sashEngineering, ...pc.boxSapele].forEach((g) => g.items.forEach((it) => { it.windowName = win; it._projectNumber = '115'; it.windowId = `id${i}`; })); return pc; };
  tag(pc1, 'A', 1); tag(pc2, 'B', 2);
  const merged = { sashEngineering: [], boxSapele: [] };
  for (const pc of [pc1, pc2]) {
    pc.sashEngineering.forEach((g) => { const f = merged.sashEngineering.find((x) => x.section === g.section); if (f) f.items.push(...g.items); else merged.sashEngineering.push({ section: g.section, items: [...g.items] }); });
    pc.boxSapele.forEach((g) => { const f = merged.boxSapele.find((x) => x.preCutWidth === g.preCutWidth); if (f) f.items.push(...g.items); else merged.boxSapele.push({ preCutWidth: g.preCutWidth, items: [...g.items] }); });
  }
  const opt = optimizer.optimisePrecut(merged, { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 2500 });
  const groups = [
    ...merged.sashEngineering.map((g) => ({ key: `sash-${g.section}`, label: g.section, type: 'sash', section: g.section, items: g.items })),
    ...merged.boxSapele.map((g) => ({ key: `box-${g.preCutWidth}`, label: String(g.preCutWidth), type: 'box', section: String(g.preCutWidth), items: g.items })),
  ];
  const windowIndexOf = (d) => (d?.windowId === 'id1' ? 0 : d?.windowId === 'id2' ? 1 : null);
  const labels = precutPdf.buildLabelList(groups, opt, { mode: 'window', windowIndexOf });
  const pieces = [...opt.sashEngineering, ...opt.boxSapele].reduce((a, g) => a + g.bars.reduce((b, bar) => b + bar.cuts.length, 0), 0);
  ok(labels.length === pieces && labels.length > 0, `one label per bar piece (${labels.length})`);
  ok(labels.every((l) => l.precut === l.cut + 10 && l.window && l.part && !/^[CDS]-/.test(l.part) && l.section && l.barId), 'every label: PRE-CUT = CUT + 10, window, part without prefix, section, bar id', JSON.stringify(labels[0]));
  ok(labels.filter((l) => l.window === 'A').every((l) => l.colour === partColours.WINDOW_COLOURS[0]) && labels.filter((l) => l.window === 'B').every((l) => l.colour === partColours.WINDOW_COLOURS[1]),
    'per window: window A colour 1, window B colour 2');
  const byPart = precutPdf.buildLabelList(groups, opt, { mode: 'part', windowIndexOf });
  ok(byPart.every((l) => l.colour) && byPart.find((l) => l.part === 'Frame Head')?.colour === partColours.PART_COLOUR_GROUPS.find((g) => g.id === 'frame_head').hex, 'per part: the part colours');
  const off = precutPdf.buildLabelList(groups, opt, { mode: 'off', windowIndexOf });
  ok(off.every((l) => l.colour === null), 'off: no colour strip');
  const bytes = precutPdf.exportPreCutLabelsPDF({ groups, optimization: opt, settings: {}, batch: { name: 't42' }, colourMode: 'window', windowIndexOf, returnDoc: true });
  ok(bytes && bytes.byteLength > 2000 && String.fromCharCode(...new Uint8Array(bytes).slice(0, 5)) === '%PDF-', `the labels PDF builds in node (${bytes?.byteLength} bytes)`);
  writeFileSync(resolve(AUDIT, 't42_labels.pdf'), Buffer.from(bytes));
  const sheet = precutPdf.exportPreCutPDF({ groups, optimization: opt, settings: {}, batch: { name: 't42' }, projects: [], isPPMode: true, format: 'a4', content: 'both', colourMode: 'window',
    windowList: [{ index: 0, id: 'id1', name: 'A', projectNumber: '115', colour: partColours.windowColourForIndex(0) }, { index: 1, id: 'id2', name: 'B', projectNumber: '115', colour: partColours.windowColourForIndex(1) }],
    windowIndexOf, returnDoc: true });
  ok(sheet && sheet.byteLength > 2000, `the Pre-Cut PDF builds in the per window mode (${sheet?.byteLength} bytes)`);
  writeFileSync(resolve(AUDIT, 't42_precut_window.pdf'), Buffer.from(sheet));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
