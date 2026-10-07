/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t38: casement leaf members and transom seat (Piotr 06.10.2026, corrected 07.10.2026).
 *
 *   A. Stiles and top rail 64 wide, the BOTTOM RAIL 67 (07.10.2026; 06.10.2026 had all
 *      four at 64, before that all four were 67). Glass width deduction
 *      2 x (64 - 11.5) = 105, glass height deduction (64 - 11.5) + (67 - 11.5) = 108.
 *   B. The transom seat is 8.5 (was 8): C-TRANSOM = field leaf W + 8.5.
 *
 * Bundles the LIVE src and TWO reference trees (git archive, needs the history):
 *   REF   5459f5b3a73d8c428ef3e0ea548bd98f700ae7d2  `main` on 06.10.2026: 67 all round, seat 8
 *   START bdd20928102e812ff25e6824720d0c82e03ce5f0  `main` on 07.10.2026 (95a83e9 + the brief),
 *                                                     the start of the bottom rail 67 tura: 64 all round, seat 8.5
 * and derives the Stage 0 reference set from all three: casement 040L 1000 x 1200 (plain
 * and with 2V / 1H bars), 021 1000 x 1200, 120 / 052L / 021 / 023 / 142 / 031 at
 * 1800 x 1500, the arched V1 (three-centre 1000 x 1500, start 1300, the t18 vector), the
 * 800 circle with a sunburst (t23 / t28), and the two controls: a sash (standard, 2x2
 * bars) and a door.
 *
 * The rule, against the two trees (section 4 of the brief):
 *
 *   compared with   glass W   glass H    stiles, top rail   bottom rail
 *   START           equal     minus 3    equal (64)         64 -> 67
 *   REF             plus 6    plus 3     67 -> 64           equal (67)
 *
 *   0  profile numbers; every other key unchanged against both trees
 *   1  leaf outer sizes equal both trees
 *   2  member sections (64x57 / 64x57 / 67x57) against both trees; member lengths
 *      equal (the curved members: START exactly, REF by hand)
 *   3  glass units and glass schedule rows: the rule table above; the circle (no bottom
 *      rail) equal to START
 *   4  every transom = START, = REF + 0.5
 *   5  frame head, cill, jambs, mullions identical to both trees
 *   6  literal numbers by hand: 040L and 021 at 1000 x 1200, 120 at 1800 x 1500
 *   7  arched leaf: ring 64, glass 52.5 inside the leaf at the top and the sides and 55.5
 *      above the leaf bottom: the bottom rail counted once
 *   8  sash and door: derived deep-equal to both trees
 *   9  migration of stored profiles (leafSchema 1 / 2 / 3, lengthSchema 2)
 *  10  drawings: the four casement sheets, the glass PDF and Window Settings print the
 *      bottom rail 67, the stiles and top rail 64 and the glass of the glass schedule;
 *      again with a hand-edited bottom rail 70 and with stiles / top rail 70
 *  11  raw stock and Pre-Cut groups, hinge picks
 *  12  nothing else moved: the live tree with START's numbers pinned draws and derives
 *      byte for byte what START does; with REF's numbers, what REF does
 *  13  one source for the glass deductions; no reader applies one number both ways
 *  14  the half millimetre through the consumers of the transom length
 *
 * Run: node verify/parity/t38_leaf_64_seat_85.mjs [ref] [start]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { jsPDF } from 'jspdf';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const refHash = process.argv[2] || '5459f5b3a73d8c428ef3e0ea548bd98f700ae7d2';
const startHash = process.argv[3] || 'bdd20928102e812ff25e6824720d0c82e03ce5f0';
function treeOf(hash) {
  const tag = `t38-ref-${hash.slice(0, 12).replace(/[^\w.-]+/g, '_')}`;
  const tree = resolve(AUDIT, `${tag}-tree`);
  rmSync(tree, { recursive: true, force: true });
  mkdirSync(tree, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${hash} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });
  return { tag, tree };
}
const refTree = treeOf(refHash);
const startTree = treeOf(startHash);

// The engine, the four casement sheets, the unused production elevation, the glass PDF,
// the Window Settings page and the two stores, in ONE bundle per tree. The stores import
// the Supabase client, which reads import.meta.env: defined empty, so the client is "not
// configured" and nothing touches the network (as t37).
function bundle(srcRoot, name) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    `export { default as Elevation } from '${rel('components/drawings/CasementElevation2D.jsx')}';`,
    `export { default as LeafDetail } from '${rel('components/drawings/CasementLeafDetail2D.jsx')}';`,
    `export { default as GlassDrawing } from '${rel('components/drawings/CasementGlassDrawing2D.jsx')}';`,
    `export { default as CasDrawing } from '${rel('components/drawings/CasementDrawing2D.jsx')}';`,
    `export { default as FrameDetail } from '${rel('components/drawings/CasementFrameDetail2D.jsx')}';`,
    `export { default as SettingsPage } from '${rel('pages/WindowSettingsPage.jsx')}';`,
    `export * as cdu from '${rel('components/drawings/casementDrawUtils.js')}';`,
    ...['specification', 'calculations', 'lists', 'arch', 'profile', 'bom', 'optimizer'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    `export * as bsuite from '${rel('utils/bsuiteExport.js')}';`,
    `export * as glassPdf from '${rel('utils/glassPdfExport.js')}';`,
    `export * as profileStore from '${rel('stores/windowProfileStore.js')}';`,
    `export * as materials from '${rel('stores/materialAssignmentStore.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:react-router-dom',
    '--external:jspdf', '--external:jspdf-autotable', '--external:three', `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
// zustand persist has no localStorage under node: it warns on every write; silence that one line
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist/i.test(String(a[0]))) return; warn(...a); };

const LIVE = await bundle(resolve(ROOT, 'src'), 't38-live');
const REF = await bundle(resolve(refTree.tree, 'src'), refTree.tag);
const START = await bundle(resolve(startTree.tree, 'src'), startTree.tag);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const R1 = (v) => Math.round(v * 10) / 10;
const faces = (p) => ['leafStile', 'leafTop', 'leafBottom'].map((k) => p.elements[k].face).join(' / ');

// ── the Stage 0 reference set ────────────────────────────────────────────────
const cas = (id, w, h, fc = {}) => ({ id, item: { id, name: id, width: w, height: h }, fc: { windowCategory: 'casement', ...fc } });
const arched = (id, w, h, fields) => ({ id, raw: { id, name: id, width: w, height: h, windowCategory: 'casement', casementType: 'arched', ...fields } });
const SET = [
  cas('040L-1000x1200', 1000, 1200, { casementLayout: '040L' }),
  cas('040L-1000x1200-bars', 1000, 1200, { casementLayout: '040L', casementVBars: 2, casementHBars: 1 }),
  cas('021-1000x1200', 1000, 1200, { casementLayout: '021' }),
  cas('120-1800x1500', 1800, 1500, { casementLayout: '120' }),
  cas('052L-1800x1500', 1800, 1500, { casementLayout: '052L' }),
  cas('021-1800x1500', 1800, 1500, { casementLayout: '021' }),
  cas('023-1800x1500', 1800, 1500, { casementLayout: '023' }),
  cas('142-1800x1500', 1800, 1500, { casementLayout: '142' }),
  cas('031-1800x1500', 1800, 1500, { casementLayout: '031' }),
  arched('arched-V1', 1000, 1500, { archShape: 'three-centre', archStart: 1300, archRiseSource: 'custom', archHinge: 'left' }),
  arched('circle-800', 800, 800, { archShape: 'circle', archBarPattern: 'sunburst', casementKind: 'fixed' }),
];
const byId = (id) => SET.find((w) => w.id === id);
const SASH = { id: 'sash', item: { id: 's', name: 'S', width: 1000, height: 1500 }, fc: { windowCategory: 'sash', frameType: 'standard', upperBars: '2x2', lowerBars: '2x2', horns: 'none' } };
const DOOR = { id: 'door', item: { id: 'd', name: 'D', width: 1000, height: 2100 }, fc: { windowCategory: 'door', doorType: 'single-external' } };

const derive = (M, w) => {
  const spec = w.raw ? M.specification.normaliseToWindowSpec(w.raw) : M.specification.normaliseToWindowSpec(w.item, { fullConfig: w.fc });
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const recs = (d, re) => (d.components?.sash || []).filter((r) => re.test(r.elementName));
const LEAF_RE = /^C-(STILE|TOP RAIL|BOTTOM RAIL|ARCH TOP RAIL|LEAF RING)/;
const CURVED_RE = /^C-(ARCH TOP RAIL|LEAF RING)$/;
const BOTTOM_RE = /^C-BOTTOM RAIL$/;

const L = {}, F = {}, S = {};
for (const w of [...SET, SASH, DOOR]) { L[w.id] = derive(LIVE, w); F[w.id] = derive(REF, w); S[w.id] = derive(START, w); }

// ═════════════════════════════════════════════════════════════════════════════
section('0 - profile numbers');
{
  const P = LIVE.profile.DEFAULT_CASEMENT_PROFILE, Q = REF.profile.DEFAULT_CASEMENT_PROFILE, T = START.profile.DEFAULT_CASEMENT_PROFILE;
  ok(faces(P) === '64 / 64 / 67' && faces(Q) === '67 / 67 / 67' && faces(T) === '64 / 64 / 64', `default leaf faces ${faces(P)} (REF ${faces(Q)}, START ${faces(T)})`);
  ok(P.deductions.glass === 105 && T.deductions.glass === 105 && Q.deductions.glass === 111, 'deductions.glass keeps the WIDTH deduction 105 = 2 x (64 - 11.5) (START 105, REF 111)');
  const d = LIVE.profile.casementGlassDeductions(P);
  ok(d.width === 105 && d.height === 108, `casementGlassDeductions(default): width ${d.width} = 2 x (64 - 11.5), height ${d.height} = (64 - 11.5) + (67 - 11.5)`);
  ok(P.lengths.transomSeat === 8.5 && T.lengths.transomSeat === 8.5 && Q.lengths.transomSeat === 8, 'lengths.transomSeat 8.5 (START 8.5, REF 8)');
  ok([P, Q, T].every((x) => x.lengths.partialMullionSeat === 8), 'lengths.partialMullionSeat stays 8 (provisional, its own decision)');
  ok(P.leafSchema === 3 && T.leafSchema === 2 && Q.leafSchema === undefined && P.lengthSchema === 2 && T.lengthSchema === 2 && Q.lengthSchema === undefined,
    `schema counters: leafSchema ${P.leafSchema} (START ${T.leafSchema}, REF none), lengthSchema ${P.lengthSchema}`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stripRef = (p) => { const c = clone(p); delete c.leafSchema; delete c.lengthSchema; ['leafStile', 'leafTop', 'leafBottom'].forEach((k) => delete c.elements[k]); delete c.deductions.glass; delete c.lengths.transomSeat; return c; };
  ok(same(stripRef(P), stripRef(Q)), 'against REF every other key of the casement profile is unchanged (frame 68 x 93, leaf depth 57, deductions.leaf*, every other length)');
  const stripStart = (p) => { const c = clone(p); delete c.leafSchema; delete c.elements.leafBottom; return c; };
  ok(same(stripStart(P), stripStart(T)), 'against START only leafBottom.face and leafSchema moved (stiles, top rail, glass 105, seat 8.5, frame, every deduction and length equal)');
  ok([REF, START].every((M) => same(LIVE.profile.DEFAULT_DOOR_PROFILE, M.profile.DEFAULT_DOOR_PROFILE) && same(LIVE.profile.DEFAULT_SASH_PROFILE, M.profile.DEFAULT_SASH_PROFILE)), 'door and sash default profiles unchanged against both trees');
}

// ═════════════════════════════════════════════════════════════════════════════
section('1 - leaf outer sizes equal both trees');
for (const w of SET) {
  const a = L[w.id].derived.casement.leaves;
  const eq = (b) => a.length === b.length && a.every((x, i) => x.leafW === b[i].leafW && x.leafH === b[i].leafH);
  ok(eq(F[w.id].derived.casement.leaves) && eq(S[w.id].derived.casement.leaves), `${w.id}: ${a.map((x) => `${x.leafW} x ${x.leafH}`).join(', ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - member sections 64x57 / 64x57 / 67x57; member lengths unchanged');
// The ring centre line sits face / 2 inside the leaf outer contour: the top ring is 64 in START
// and live, 67 in REF, so a curved member equals START and is REF + 1.5 x (its sweep angle).
// V1 (three-centre, start 1300): leaf outer radii 99 / 1349 / 99 (frame 150 / 1400 / 150 minus
// leafAtJamb 51), haunch 73.74 deg, crown 32.52 deg (t18 vector): centre radii 67 / 1317 / 67 ->
// 2 x 67 x 1.28700 + 1317 x 0.56758 = 919.97 -> 920.0 (REF 65.5 / 1315.5 / 65.5 -> 915.3).
// Circle 800: leaf outer r 349 -> centre r 317 -> 2 x pi x 317 = 1991.77 -> 1991.8 (REF 315.5 -> 1982.3).
const HAND_CURVED = { 'arched-V1': 920.0, 'circle-800': 1991.8 };
for (const w of SET) {
  const a = recs(L[w.id].derived, LEAF_RE), b = recs(F[w.id].derived, LEAF_RE), c = recs(S[w.id].derived, LEAF_RE);
  const want = (r) => (BOTTOM_RE.test(r.elementName) ? '67x57' : '64x57');
  ok(a.length > 0 && a.length === b.length && a.length === c.length && a.every((r) => r.section === want(r)),
    `${w.id}: ${a.length} leaf members, ${[...new Set(a.map((r) => `${r.elementName.replace(/ \(.\)$/, '')} ${r.section}`))].join(', ')}`);
  ok(b.every((r) => r.section === '67x57') && c.every((r) => r.section === '64x57'), `${w.id}: REF all 67x57, START all 64x57`);
  const bot = a.filter((r) => BOTTOM_RE.test(r.elementName));
  if (w.id !== 'circle-800') ok(bot.length > 0 && bot.every((r) => r.section === '67x57') && bot.length === b.filter((x) => BOTTOM_RE.test(x.elementName)).length,
    `${w.id}: every C-BOTTOM RAIL 67x57 = REF, START 64x57 (${bot.length})`);
  else ok(bot.length === 0, 'circle-800: no bottom rail (one ring), nothing to move');
  const straight = (arr) => arr.filter((r) => !CURVED_RE.test(r.elementName));
  ok([b, c].every((x) => JSON.stringify(straight(a).map((r) => [r.elementName, r.length])) === JSON.stringify(straight(x).map((r) => [r.elementName, r.length]))),
    `${w.id}: straight member lengths equal both trees (${straight(a).map((r) => r.length).join(' ')})`);
  const curved = a.filter((r) => CURVED_RE.test(r.elementName));
  if (curved.length) {
    const c0 = b.find((r) => CURVED_RE.test(r.elementName)), s0 = c.find((r) => CURVED_RE.test(r.elementName));
    ok(curved.length === 1 && curved[0].length === s0.length && near(curved[0].length, HAND_CURVED[w.id], 1e-9),
      `${w.id}: ${curved[0].elementName} ${curved[0].length} = START ${s0.length} = ring centre line by hand ${HAND_CURVED[w.id]} (REF ${c0.length})`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - glass units: START (W equal, H - 3), REF (W + 6, H + 3); the circle has no bottom rail');
for (const w of SET) {
  const a = L[w.id].derived.customGlassUnits, b = F[w.id].derived.customGlassUnits, c = S[w.id].derived.customGlassUnits;
  const dH = w.id === 'circle-800' ? 0 : -3;   // vs START
  const dHr = w.id === 'circle-800' ? 6 : 3;   // vs REF
  ok(a.length > 0 && a.length === c.length && a.every((u, i) => near(u.width, c[i].width) && near(u.height, c[i].height + dH)),
    `${w.id} vs START: ${a.map((u, i) => `${u.width} x ${u.height} (START ${c[i].width} x ${c[i].height})`).join(', ')}`);
  ok(a.length === b.length && a.every((u, i) => near(u.width, b[i].width + 6) && near(u.height, b[i].height + dHr)),
    `${w.id} vs REF: width + 6, height + ${dHr} (REF ${b.map((u) => `${u.width} x ${u.height}`).join(', ')})`);
  const ga = LIVE.lists.buildGlassListForWindow(L[w.id].derived, L[w.id].spec);
  const gb = REF.lists.buildGlassListForWindow(F[w.id].derived, F[w.id].spec);
  const gc = START.lists.buildGlassListForWindow(S[w.id].derived, S[w.id].spec);
  ok(ga.length === gc.length && ga.length === gb.length && ga.every((r, i) => near(r.width, gc[i].width) && near(r.height, gc[i].height + dH) && near(r.width, gb[i].width + 6) && near(r.height, gb[i].height + dHr) && r.qty === gc[i].qty),
    `${w.id}: glass schedule rows follow the same rule (${ga.map((r) => `${r.width} x ${r.height}`).join(', ')})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - every transom = START, = REF + 0.5');
for (const w of SET) {
  const a = recs(L[w.id].derived, /^C-TRANSOM$/), b = recs(F[w.id].derived, /^C-TRANSOM$/), c = recs(S[w.id].derived, /^C-TRANSOM$/);
  const ra = L[w.id].derived.casement.transomRuns, rb = F[w.id].derived.casement.transomRuns, rc = S[w.id].derived.casement.transomRuns;
  if (!b.length) { ok(!a.length && !ra.length && !c.length, `${w.id}: no transom (none in either tree)`); continue; }
  ok(a.length === b.length && a.every((r, i) => near(r.length, b[i].length + 0.5) && r.length === c[i].length),
    `${w.id}: C-TRANSOM ${a.map((r) => r.length).join(', ')} = START = REF ${b.map((r) => r.length).join(', ')} + 0.5`);
  ok(ra.length === rb.length && JSON.stringify(ra) === JSON.stringify(rc) && ra.every((r, i) => near(r.length, rb[i].length + 0.5) && r.code === rb[i].code && r.axisT === rb[i].axisT && r.x1 === rb[i].x1 && r.x2 === rb[i].x2),
    `${w.id}: transomRuns equal START, REF + 0.5, axis and land band unchanged`);
}
{
  const t = (id) => recs(L[id].derived, /^C-TRANSOM$/).map((r) => r.length);
  ok(JSON.stringify(t('021-1000x1200')) === '[906.5]', '021 1000 x 1200: C-TRANSOM 906.5 = leaf 898 + 8.5', JSON.stringify(t('021-1000x1200')));
  ok(JSON.stringify(t('021-1800x1500')) === '[1706.5]', '021 1800 x 1500: C-TRANSOM 1706.5 = leaf 1698 + 8.5', JSON.stringify(t('021-1800x1500')));
  ok(JSON.stringify(t('052L-1800x1500')) === '[840.5]', '052L 1800 x 1500: C-TRANSOM 840.5 = leaf 832 + 8.5', JSON.stringify(t('052L-1800x1500')));
  const pc = LIVE.lists.buildPrecutForWindow(L['021-1000x1200'].derived, L['021-1000x1200'].spec, {}, undefined);
  const tr = pc.sashEngineering.flatMap((g) => g.items).filter((it) => it.elementName === 'C-TRANSOM');
  ok(tr.length === 1 && tr[0].length === 927, '021 1000 x 1200: Pre-Cut transom 927 = round(906.5 + 20) (REF 926)', JSON.stringify(tr));
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - frame head, cill, jambs and mullions identical to both trees');
for (const w of SET) {
  const box = (d) => JSON.stringify(d.components.box.map((r) => [r.elementName, r.section, r.length, r.quantity, r.notes]));
  const mul = (d) => JSON.stringify([recs(d, /^C-MULLION$/).map((r) => [r.section, r.length, r.notes]), d.casement.mullionRuns]);
  const a = L[w.id].derived;
  ok(box(a) === box(F[w.id].derived) && box(a) === box(S[w.id].derived), `${w.id}: frame members (${a.components.box.map((r) => `${r.code} ${r.length}`).join(', ')})`);
  ok(mul(a) === mul(F[w.id].derived) && mul(a) === mul(S[w.id].derived), `${w.id}: mullions and mullion runs (${recs(a, /^C-MULLION$/).map((r) => r.length).join(', ') || 'none'})`);
}
{
  const pm = recs(L['031-1800x1500'].derived, /^C-MULLION$/);
  ok(pm.length === 1 && /partial/.test(pm[0].notes) && pm[0].length === 454.2,
    '031 1800 x 1500: partial mullion 454.2 = tier leaf H 446.2 + partialMullionSeat 8 (unchanged; not the transom seat)', JSON.stringify(pm));
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - literal numbers by hand');
// the daylight is printed by the leaf sheet (its dimension chain), so the check reads the rendered sheet
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));
const leafSheetTexts = (M, spec, derived, k = 0) => texts(render(M.LeafDetail, { windowSpec: spec, derived, group: M.cdu.groupCasementLeaves(derived)[k], projectNumber: 'P-1' }));
// 040L 1000 x 1200 (frame 68, leafAtJamb 51, leafFullHeight 98, stiles / top rail 64, bottom rail 67, glassInset 11.5):
//   leaf      1000 - 2 x 51 = 898  x  1200 - 98 = 1102
//   glass     898 - 105 = 793  x  1102 - 108 = 994      (105 = 2 x (64 - 11.5); 108 = (64 - 11.5) + (67 - 11.5) = 52.5 + 55.5)
//   daylight  898 - 2 x 64 = 770  x  1102 - 64 - 67 = 971
//   beading   round(2 x (793 + 994) x 1.15) = round(4110.1) = 4110
//   leaf kg   stiles kgPerM(64, 57) = 64 x 57 x 610 / 1e6 = 2.22528 kg/m x 2 x 1.102 = 4.90452
//             top rail 2.22528 x 0.898 = 1.99830; bottom rail kgPerM(67, 57) = 2.32959 x 0.898 = 2.09197
//             timber 8.99479; glass 0.793 x 0.994 x 21 = 16.55308; (8.99479 + 16.55308) x 1.05 = 26.825 -> 26.8
//   window    timber 4.4 m x 3.85764 (68 x 93) + 8.99479 = 25.96841 -> 26.0; glass 16.6;
//             total (25.96841 + 16.55308) x 1.05 = 44.6476 -> 44.6; glass m2 0.788242 -> 0.79
//   bead tape one side (2 x (793 + 994)) / 1000 = 3.574 -> 3.57
// 021 1000 x 1200 (fan over the leaf; fan leaf 356.2, lower leaf 714.8, as START):
//   fan glass   898 - 105 = 793  x  356.2 - 108 = 248.2
//   lower glass 898 - 105 = 793  x  714.8 - 108 = 606.8
// 120 1800 x 1500 (two leaves at a mullion, axis 900; leafAtMullionAxis 17), the second window by hand:
//   leaf      900 - 51 - 17 = 832  x  1500 - 98 = 1402   (both leaves)
//   glass     832 - 105 = 727  x  1402 - 108 = 1294
//   daylight  832 - 128 = 704  x  1402 - 131 = 1271
//   beading   round(2 panes x 2 x (727 + 1294) x 1.15) = round(9296.6) = 9297
//   leaf kg   2.22528 x 2.804 + 2.22528 x 0.832 + 2.32959 x 0.832 = 6.23969 + 1.85143 + 1.93822 = 10.02934;
//             glass 0.727 x 1.294 x 21 = 19.75550; (10.02934 + 19.75550) x 1.05 = 31.274 -> 31.3 each;
//             glass m2 2 x 0.940738 = 1.881476 -> 1.88
{
  const d = L['040L-1000x1200'].derived, c = d.casement, spec = L['040L-1000x1200'].spec;
  ok(c.leaves[0].leafW === 898 && c.leaves[0].leafH === 1102, '040L: leaf 898 x 1102');
  ok(d.customGlassUnits[0].width === 793 && d.customGlassUnits[0].height === 994, '040L: glass unit 793 x 994', JSON.stringify(d.customGlassUnits[0]));
  const sec = (re) => [...new Set(recs(d, re).map((r) => r.section))].join();
  ok(sec(/^C-STILE/) === '64x57' && sec(/^C-TOP RAIL$/) === '64x57' && sec(BOTTOM_RE) === '67x57', `040L: stiles ${sec(/^C-STILE/)}, top rail ${sec(/^C-TOP RAIL$/)}, bottom rail ${sec(BOTTOM_RE)}`);
  const t040 = leafSheetTexts(LIVE, spec, d);
  ok(t040.includes('770') && t040.includes('971') && !t040.includes('974') && !t040.includes('968'), '040L: daylight 770 x 971 printed on the leaf sheet (START 770 x 974, REF 764 x 968)', JSON.stringify(t040.slice(0, 10)));
  ok(d.components.beading.length === 1 && d.components.beading[0].length === 4110, '040L: glazing beading 4110 (START 4117)', JSON.stringify(d.components.beading));
  ok(c.leafWeights[0].weightKg === 26.8, `040L: leaf weight 26.8 kg (START ${S['040L-1000x1200'].derived.casement.leafWeights[0].weightKg})`, JSON.stringify(c.leafWeights));
  ok(d.weights.timber === 26 && d.weights.glass === 16.6 && d.weights.total === 44.6, '040L: weights 26.0 / 16.6 / 44.6 (START 25.9 / 16.6 / 44.6)', JSON.stringify(d.weights));
  ok(d.consumables.glass.sqm === 0.79 && d.consumables.beadTapeSide.meters === 3.57, '040L: glass 0.79 m2, bead tape 3.57 m (START 3.58)', JSON.stringify(d.consumables));
  const g = L['021-1000x1200'].derived;
  ok(g.casement.leaves.map((l) => `${l.leafW} x ${l.leafH}`).join(', ') === '898 x 356.2, 898 x 714.8', '021 1000 x 1200: leaves 898 x 356.2 (fan) and 898 x 714.8');
  ok(JSON.stringify(g.customGlassUnits.map((u) => [u.width, u.height])) === '[[793,248.2],[793,606.8]]', '021 1000 x 1200: glass 793 x 248.2 and 793 x 606.8 (START 251.2 / 609.8)', JSON.stringify(g.customGlassUnits.map((u) => [u.width, u.height])));
  ok(recs(g, BOTTOM_RE).length === 2 && recs(g, BOTTOM_RE).every((r) => r.section === '67x57'), '021 1000 x 1200: both bottom rails (fan and leaf) 67x57');
  const e = L['120-1800x1500'].derived, ec = e.casement;
  ok(ec.leaves.every((l) => l.leafW === 832 && l.leafH === 1402), '120: leaves 832 x 1402');
  ok(e.customGlassUnits.every((u) => u.width === 727 && u.height === 1294), '120: glass units 727 x 1294', JSON.stringify(e.customGlassUnits.map((u) => [u.width, u.height])));
  const t120 = leafSheetTexts(LIVE, L['120-1800x1500'].spec, e);
  ok(t120.includes('704') && t120.includes('1271') && !t120.includes('1274') && !t120.includes('1268'), '120: daylight 704 x 1271 printed on the leaf sheet (START 704 x 1274)', JSON.stringify(t120.slice(0, 10)));
  ok(e.components.beading[0].length === 9297, '120: glazing beading 9297 (START 9310)', JSON.stringify(e.components.beading));
  ok(ec.leafWeights.every((x) => x.weightKg === 31.3), '120: leaf weights 31.3 / 31.3 kg (START 31.2)', JSON.stringify(ec.leafWeights));
  ok(e.consumables.glass.sqm === 1.88, '120: glass 1.88 m2 (START 1.89)', String(e.consumables.glass.sqm));
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - arched leaf: ring 64, glass 52.5 in at the top and sides, 55.5 above the leaf bottom');
for (const id of ['arched-V1', 'circle-800']) {
  const A = L[id].derived.arch, B = F[id].derived.arch, C = S[id].derived.arch;
  const lt = A.geometry.leafTop;
  ok(lt.outer.length === lt.inner.length && lt.outer.every((a, k) => near(a.r - lt.inner[k].r, 64)),
    `${id}: leaf top ring outer - inner radius = 64 on every arc (${lt.outer.map((a, k) => `${R1(a.r)} - ${R1(lt.inner[k].r)}`).join(', ')})`);
  ok(lt.outer.every((a, k) => near(a.r, B.geometry.leafTop.outer[k].r) && near(a.r, C.geometry.leafTop.outer[k].r)), `${id}: leaf outer contour unchanged against both trees`);
  const gr = A.glassOutline.radii;
  ok(gr.length > 0 && gr.every((r, k) => near(r, lt.outer[k].r - 52.5, 0.051)) && JSON.stringify(gr) === JSON.stringify(C.glassOutline.radii),
    `${id}: glass radii ${gr.join(' / ')} = leaf outer - 52.5 (64 - 11.5) = START`);
  ok(near(A.glassOutline.origin.x, 51 + 52.5, 0.051) && A.glassOutline.origin.x === C.glassOutline.origin.x, `${id}: glass origin x ${A.glassOutline.origin.x} = leafAtJamb 51 + 52.5 = START (REF ${B.glassOutline.origin.x})`);
}
{
  const A = L['arched-V1'].derived, C = S['arched-V1'].derived, B = F['arched-V1'].derived;
  ok(near(A.arch.glassOutline.origin.y, 47 + 55.5, 0.051), `arched-V1: glass bottom edge ${A.arch.glassOutline.origin.y} = cill side 47 + 55.5 (67 - 11.5) (START ${C.arch.glassOutline.origin.y}, REF ${B.arch.glassOutline.origin.y})`);
  // the bottom rail counted ONCE: the arched unit is the outline (no height deduction on top of it)
  const u = A.customGlassUnits[0], uc = C.customGlassUnits[0];
  ok(near(u.height, uc.height - 3, 0.051) && near(u.width, uc.width, 1e-9) && near(A.arch.glassOutline.springing, C.arch.glassOutline.springing - 3, 1e-6),
    `arched-V1: unit ${u.width} x ${u.height} = START ${uc.width} x ${uc.height} minus 3 in height only (springing ${R1(A.arch.glassOutline.springing)}, START ${R1(C.arch.glassOutline.springing)})`);
  ok(near(u.height, A.casement.leaves[0].leafH - 52.5 - 55.5, 0.051), `arched-V1: unit height ${u.height} = leaf H ${A.casement.leaves[0].leafH} - 52.5 - 55.5 = leaf H - 108`);
  ok(recs(A, BOTTOM_RE).length === 1 && recs(A, BOTTOM_RE)[0].section === '67x57' && recs(A, /^C-ARCH TOP RAIL$/)[0].section === '64x57', 'arched-V1: C-BOTTOM RAIL 67x57, C-ARCH TOP RAIL 64x57');
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - sash and door: nothing moves');
for (const id of ['sash', 'door']) {
  for (const [M, X, name] of [[REF, F, 'REF'], [START, S, 'START']]) {
    ok(JSON.stringify(L[id].derived) === JSON.stringify(X[id].derived), `${id}: derived deep-equal to ${name}`);
    const ca = LIVE.lists.buildCutListForWindow(L[id].derived, L[id].spec), cb = M.lists.buildCutListForWindow(X[id].derived, X[id].spec);
    const ga = LIVE.lists.buildGlassListForWindow(L[id].derived, L[id].spec), gb = M.lists.buildGlassListForWindow(X[id].derived, X[id].spec);
    ok(JSON.stringify(ca) === JSON.stringify(cb) && JSON.stringify(ga) === JSON.stringify(gb), `${id}: cut list and glass schedule equal to ${name} (${ga.map((r) => `${r.width} x ${r.height}`).join(', ')})`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - migration of stored profiles');
{
  const mig = LIVE.profile.migrateCasementProfile;
  const ded = LIVE.profile.casementGlassDeductions;
  const piotr = clone(START.profile.DEFAULT_CASEMENT_PROFILE);   // Piotr's stored copy today: leafSchema 2, 64 / 64 / 64, glass 105, seat 8.5
  const m0 = mig(piotr);
  ok(faces(m0) === '64 / 64 / 67' && m0.deductions.glass === 105 && ded(m0).height === 108 && m0.lengths.transomSeat === 8.5 && m0.leafSchema === 3 && m0.lengthSchema === 2,
    `Piotr's stored copy (schema 2, 64 / 64 / 64, glass 105, seat 8.5) -> ${faces(m0)}, glass W ${ded(m0).width} / H ${ded(m0).height}, seat ${m0.lengths.transomSeat}, leafSchema ${m0.leafSchema}`);
  const old = clone(REF.profile.DEFAULT_CASEMENT_PROFILE);      // what every workshop saved before 06.10.2026: 67 / 111 / 8, no counters
  const m1 = mig(old);
  ok(faces(m1) === '64 / 64 / 67' && m1.deductions.glass === 105 && ded(m1).height === 108 && m1.lengths.transomSeat === 8.5 && m1.leafSchema === 3 && m1.lengthSchema === 2,
    `schema 1 copy 67 / 67 / 67, glass 111, seat 8 -> ${faces(m1)}, glass W ${ded(m1).width} / H ${ded(m1).height}, seat ${m1.lengths.transomSeat}`);
  const b70 = clone(piotr); b70.elements.leafBottom.face = 70;
  const m2 = mig(b70);
  ok(faces(m2) === '64 / 64 / 70' && ded(m2).width === 105 && ded(m2).height === 111 && m2.deductions.glass === 105,
    `schema 2 copy with a hand-edited bottom rail 70 keeps it: ${faces(m2)}, glass H deduction ${ded(m2).height} = (64 - 11.5) + (70 - 11.5)`);
  const s3 = clone(piotr); s3.leafSchema = 3;
  const m3 = mig(s3);
  ok(faces(m3) === '64 / 64 / 64' && ded(m3).height === 105, `a copy on schema 3 is left alone (64 / 64 / 64 stays, glass H ${ded(m3).height})`);
  const s2e = clone(old); s2e.leafSchema = 2; s2e.lengthSchema = 2;
  const m4 = mig(s2e);
  ok(faces(m4) === '67 / 67 / 67' && m4.deductions.glass === 111 && m4.lengths.transomSeat === 8, 'a schema 2 copy holding 67 / 67 / 67 (hand edits) is left alone: 67 is not the schema 2 bottom rail 64');
  const s70 = clone(old); ['leafStile', 'leafTop', 'leafBottom'].forEach((k) => { s70.elements[k].face = 70; });
  const m5 = mig(s70);
  ok(faces(m5) === '70 / 70 / 70' && ded(m5).width === 117 && ded(m5).height === 117, `schema 1 copy hand-edited 70 / 70 / 70 stays, glass W ${ded(m5).width} / H ${ded(m5).height}`);
  const s72 = clone(old); s72.elements.leafBottom.face = 72;
  const m6 = mig(s72);
  ok(faces(m6) === '64 / 64 / 72' && ded(m6).width === 105 && ded(m6).height === 113, `schema 1 copy, bottom rail edited to 72: ${faces(m6)}, glass W ${ded(m6).width} / H ${ded(m6).height} = 52.5 + 60.5`);
  const s9 = clone(old); s9.lengths.transomSeat = 9;
  ok(mig(s9).lengths.transomSeat === 9 && faces(mig(s9)) === '64 / 64 / 67', 'hand-edited seat 9 stays 9 (the faces still move)');
  // glass schema 1 (02.10.2026 history): inset 12.5, glass 109, edge cover 11, leaf 67, no schema counters at all
  const g1 = clone(old); delete g1.glassSchema; g1.geometry.glassInset = 12.5; g1.deductions.glass = 109;
  Object.keys(g1.glass.edgeCover).forEach((k) => { g1.glass.edgeCover[k] = 11; });
  const m7 = mig(g1);
  ok(m7.geometry.glassInset === 11.5 && faces(m7) === '64 / 64 / 67' && m7.deductions.glass === 105 && ded(m7).height === 108 && Object.values(m7.glass.edgeCover).every((v) => v === 10) && m7.glassSchema === 2,
    `glass schema 1 copy (12.5 / 109 / 11 / 67) -> inset ${m7.geometry.glassInset}, leaf ${faces(m7)}, glass W ${ded(m7).width} / H ${ded(m7).height}, edge cover 10`);
  ok([m0, m1, m2, m7].every((m) => JSON.stringify(mig(m)) === JSON.stringify(m)), 'migration is idempotent (a migrated copy migrates to itself)');
  const D = LIVE.profile.DEFAULT_CASEMENT_PROFILE;
  ok(JSON.stringify(mig(clone(D))) === JSON.stringify(D) && JSON.stringify(m0) === JSON.stringify(D) && JSON.stringify(m1) === JSON.stringify(D), "the live default migrates to itself; Piotr's copy and the schema 1 copy migrate to exactly the default");
  const f1 = clone(old); delete f1.frameSchema; f1.elements.frameHead.face = 57; f1.elements.frameJamb.face = 57; f1.geometry.land = 36;
  const mf = mig(f1);
  ok(mf.elements.frameHead.face === 68 && mf.elements.frameJamb.face === 68 && mf.geometry.land === 47 && faces(mf) === '64 / 64 / 67', 'frame schema 1 copy: frame keys move as before, leaf goes to 64 / 64 / 67');
  // the engine reads the migrated copy: both stored profiles derive today's numbers
  for (const [p, name] of [[piotr, "Piotr's schema 2 copy"], [old, 'the schema 1 copy']]) {
    LIVE.profile.setActiveCasementProfile(p);
    const dm = derive(LIVE, byId('021-1000x1200')).derived;
    LIVE.profile.setActiveCasementProfile(null);
    ok(JSON.stringify(dm) === JSON.stringify(L['021-1000x1200'].derived), `${name}, set active, derives exactly what the new default derives (021 1000 x 1200: 793 x 248.2 / 606.8)`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - drawings print the bottom rail 67, the stiles and top rail 64, the glass of the schedule');
const GLASS_RE = /glass (\d+(?:\.\d)?) × (\d+(?:\.\d)?) · 24mm/;
const half = (v) => { const r = Math.round(v * 2) / 2; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
function sheetsOf(M, spec, derived) {
  return {
    elevation: render(M.Elevation, { windowSpec: spec, derived, projectNumber: 'P-1' }),
    casDrawing: render(M.CasDrawing, { windowSpec: spec, derived, batch: null }),
    leaf: M.cdu.groupCasementLeaves(derived).map((group) => ({ group, svg: render(M.LeafDetail, { windowSpec: spec, derived, group, projectNumber: 'P-1' }) })),
    glass: M.cdu.groupCasementGlass(derived, spec).map((group) => ({ group, svg: render(M.GlassDrawing, { windowSpec: spec, derived, group }) })),
  };
}
const rects = (svg) => [...svg.matchAll(/<rect ([^>]*)\/?>/g)].map((m) => {
  const a = (k) => { const x = m[1].match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`)); return x ? Number(x[1]) : NaN; };
  return { x: a('x'), y: a('y'), w: a('width'), h: a('height') };
});
// the daylight rect drawn inside a leaf rect: its left, top, right and bottom margins = the members drawn
function memberMargins(svg, leafW, leafH, dayW, dayH) {
  const rs = rects(svg);
  const leaf = rs.find((r) => near(r.w, leafW, 1e-6) && near(r.h, leafH, 1e-6));
  const day = leaf && rs.find((r) => near(r.w, dayW, 1e-6) && near(r.h, dayH, 1e-6) && r.x > leaf.x && r.y > leaf.y && r.x + r.w < leaf.x + leaf.w && r.y + r.h < leaf.y + leaf.h);
  if (!leaf || !day) return null;
  return { left: R1(day.x - leaf.x), top: R1(day.y - leaf.y), right: R1(leaf.x + leaf.w - day.x - day.w), bottom: R1(leaf.y + leaf.h - day.y - day.h) };
}
// arched sheets: an outline path starts at its bottom edge (archDrawUtils.archedOutlineD: "M x yBottom H ...")
const yStart = (d) => Number((d.match(/^M (-?[\d.]+) (-?[\d.]+)/) || [])[2]);
// glass PDF (src/utils/glassPdfExport.js): the jsPDF text calls, captured through the 'initialized'
// plugin event (jspdf is external, so every bundle uses this instance; as t26)
const PDF = { texts: [], on: false };
jsPDF.API.events.push(['initialized', function () {
  const self = this, oText = self.text;
  self.text = function (text, x, y, opts) { if (PDF.on) PDF.texts.push(Array.isArray(text) ? text.join('\n') : String(text)); return oText.call(self, text, x, y, opts); };
}]);
function glassPdfTexts(M, spec, derived) {
  PDF.texts = []; PDF.on = true;
  M.glassPdf.exportGlassPDF({ batch: { label: 'T38' }, windowsData: [{ win: { name: spec.name, _projectNumber: 'P-1' }, windowSpec: spec, derived }], projects: [{ number: 'P-1', name: 'T38' }], companySettings: { companyName: 'HARNESS' }, returnDoc: true });
  PDF.on = false;
  return PDF.texts;
}
const fmt1 = (v) => (Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : v.toFixed(1));
// Every sheet of a window against the glass schedule and the member faces { stile, top, bottom }
function checkSheets(M, label, w, f) {
  const { spec, derived } = derive(M, w);
  const rows = M.lists.buildGlassListForWindow(derived, spec);
  const sch = rows.map((r) => `${r.width} x ${r.height}`);
  const S2 = sheetsOf(M, spec, derived);
  const rect = !derived.arch;
  // leaf sheet: subtitle glass = the schedule unit of that leaf (on the sheet's 0.5 grid); the drawn daylight
  // sits stile / top rail / bottom rail inside the leaf; the vertical chain prints both rails
  S2.leaf.forEach(({ group, svg }) => {
    const u = derived.customGlassUnits[group.rep], lf = derived.casement.leaves[group.rep];
    const m = texts(svg).join('\n').match(GLASS_RE);
    ok(m && m[1] === half(u.width) && m[2] === half(u.height) && sch.includes(`${u.width} x ${u.height}`),
      `${label} leaf sheet ${group.key}: prints glass ${m ? `${m[1]} x ${m[2]}` : '?'} = schedule ${u.width} x ${u.height}`);
    if (rect) {
      const mg = memberMargins(svg, lf.leafW, lf.leafH, lf.leafW - 2 * f.stile, lf.leafH - f.top - f.bottom);
      ok(mg && mg.left === f.stile && mg.right === f.stile && mg.top === f.top && mg.bottom === f.bottom,
        `${label} leaf sheet ${group.key}: daylight drawn ${R1(lf.leafW - 2 * f.stile)} x ${R1(lf.leafH - f.top - f.bottom)}; stiles ${mg?.left} / ${mg?.right}, top rail ${mg?.top}, bottom rail ${mg?.bottom}`, JSON.stringify(mg));
      const t = texts(svg);
      const nb = lf.bars?.counts?.h || 0;
      const day = half(lf.leafH - f.top - f.bottom);
      ok(t.includes(String(f.top)) && t.includes(String(f.bottom)) && (nb > 0 || t.includes(day)),
        `${label} leaf sheet ${group.key}: chain prints the top rail ${f.top}, the bottom rail ${f.bottom}${nb ? '' : `, the daylight ${day}`}`, JSON.stringify(t.slice(0, 12)));
    } else {
      // arched: the outer leaf path and the daylight path; the daylight closes f.bottom above the leaf bottom
      const paths = [...svg.matchAll(/<path d="([^"]*)"([^>]*)>/g)];
      const outer = paths.find((p) => /fill="rgba\(148,163,184,0.03\)"/.test(p[2]));
      const dayl = paths.find((p) => /fill-opacity="0.06"/.test(p[2]));
      const gap = outer && dayl ? R1(yStart(outer[1]) - yStart(dayl[1])) : null;
      ok(gap === f.bottom, `${label} leaf sheet (arched): the daylight closes ${gap} above the leaf bottom = the bottom rail ${f.bottom}`);
    }
  });
  // glass sheet: "W × H mm" = schedule
  S2.glass.forEach(({ group, svg }) => {
    const m = texts(svg).join('\n').match(/(\d+(?:\.\d)?) × (\d+(?:\.\d)?) mm/);
    ok(m && sch.includes(`${m[1]} x ${m[2]}`), `${label} glass sheet ${group.key}: prints ${m ? `${m[1]} x ${m[2]}` : '?'} mm, in the schedule`);
  });
  if (rect) {
    // production elevation (CasementDrawing2D): every glass callout is a schedule row; the vertical chain prints
    // top rail / daylight / bottom rail for every leaf of the left column
    const cd = texts(S2.casDrawing);
    const calls = cd.map((x) => x.match(GLASS_RE)).filter(Boolean);
    ok(calls.length > 0 && calls.every((m) => sch.includes(`${m[1]} x ${m[2]}`)), `${label} CasementDrawing2D: glass callouts ${calls.map((m) => `${m[1]} x ${m[2]}`).join(', ')} in the schedule`);
    const leftCol = derived.casement.leaves.filter((l, i) => derived.casement.paneBounds[i].leftIsJamb);
    ok(leftCol.every((l) => cd.includes(fmt1(l.leafH - f.top - f.bottom))) && cd.includes(String(f.top)) && cd.includes(String(f.bottom)),
      `${label} CasementDrawing2D: vertical chain top rail ${f.top} / daylight ${leftCol.map((l) => fmt1(l.leafH - f.top - f.bottom)).join(', ')} / bottom rail ${f.bottom}`, JSON.stringify(cd.slice(0, 30)));
    // front elevation prints no glass size and no member: it DRAWS the daylight inside each leaf rect
    derived.casement.leaves.forEach((l, i) => {
      const r = derived.casement.leafRects[i];
      const mg = memberMargins(S2.elevation, r.w, r.h, r.w - 2 * f.stile, r.h - f.top - f.bottom);
      const u = derived.customGlassUnits[i];
      ok(mg && mg.top === f.top && mg.bottom === f.bottom && mg.left === f.stile && near(r.w - 2 * f.stile + 2 * 11.5, u.width) && near(r.h - f.top - f.bottom + 2 * 11.5, u.height),
        `${label} front elevation P${i + 1}: daylight ${R1(r.w - 2 * f.stile)} x ${R1(r.h - f.top - f.bottom)} drawn ${mg?.top} below the leaf top, ${mg?.bottom} above its bottom; + 2 x 11.5 = unit ${u.width} x ${u.height}`, JSON.stringify(mg));
    });
  } else {
    // arched front elevation: the leaf outline path, then the daylight path (glass fill); the daylight's bottom
    // edge sits f.bottom above the leaf's
    const paths = [...S2.elevation.matchAll(/<path d="([^"]*)"([^>]*)>/g)];
    const k = paths.findIndex((p) => /fill-opacity=/.test(p[2]));
    const gap = k > 0 ? R1(yStart(paths[k - 1][1]) - yStart(paths[k][1])) : null;
    ok(gap === f.bottom, `${label} front elevation (arched): the daylight closes ${gap} above the leaf bottom = the bottom rail ${f.bottom}`);
  }
  // the glass PDF table prints every schedule row (the glazier's order)
  // and never the one-number height (leaf H - the width deduction), the value a single deduction would give
  const pt = glassPdfTexts(M, spec, derived);
  const stale = rect ? derived.casement.leaves.map((l) => fmt1(l.leafH - 2 * (f.stile - 11.5))).filter((v) => !rows.some((r) => fmt1(r.height) === v)) : [];
  ok(rows.every((r) => pt.includes(fmt1(r.width)) && pt.includes(fmt1(r.height))) && stale.every((v) => !pt.includes(v)),
    `${label} glass PDF: the table prints ${sch.join(', ')}${stale.length ? ` (never ${stale.join(', ')})` : ''}`, JSON.stringify(pt.slice(0, 40)));
  return { derived, rows };
}
const F64 = { stile: 64, top: 64, bottom: 67 };
for (const [id, label] of [['040L-1000x1200', '040L'], ['021-1000x1200', '021'], ['040L-1000x1200-bars', '040L bars'], ['arched-V1', 'arched V1']]) checkSheets(LIVE, label, byId(id), F64);
{
  // A unit that is NOT a whole number (052L 1800 x 1500: 727 x 338.2 fan, 727 x 816.8): the glass sheet and the
  // production elevation print the schedule exactly; the leaf sheet prints every size on its 0.5 grid (BLOCKERS 27.7 d)
  const r = checkSheets(LIVE, '052L', byId('052L-1800x1500'), F64);
  ok(JSON.stringify(r.rows.map((x) => [x.width, x.height])) === '[[727,338.2],[727,816.8],[727,1294]]', `052L: schedule ${r.rows.map((x) => `${x.width} x ${x.height}`).join(', ')}`);
}
// react-dom/server renders a zustand hook from getServerSnapshot = the store's INITIAL state; the page
// must show the state the setters left, so the initial state object is brought up to date first.
function renderSettings(M) {
  const st = M.profileStore.useWindowProfileStore;
  Object.assign(st.getInitialState(), st.getState());
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/window-settings/casement'] },
    React.createElement(Routes, null, React.createElement(Route, { path: '/window-settings/:typeId', element: React.createElement(M.SettingsPage) }))));
}
const settingsGlass = (html) => {
  const m = html.match(/glass W = leaf − <span[^>]*>([\d.]+)<\/span><span[^>]*> · <\/span>glass H = leaf − <span[^>]*>([\d.]+)<\/span><span[^>]*> · sample <\/span><span[^>]*>([\d.]+) × ([\d.]+)<\/span>/);
  return m ? { w: Number(m[1]), h: Number(m[2]), sw: Number(m[3]), sh: Number(m[4]) } : null;
};
const settingsCards = (html) => Object.fromEntries(['Stiles', 'Top rail', 'Bottom rail'].map((n) => {
  const m = html.match(new RegExp(`>${n} (?:×2)?</span><span[^>]*>(\\d+(?:\\.\\d)?) × (\\d+)</span>`));
  return [n, m ? `${m[1]} × ${m[2]}` : null];
}));
const sample = () => { const { derived, spec } = derive(LIVE, cas('sample', 1000, 1500, { casementLayout: '040L' })); return LIVE.lists.buildGlassListForWindow(derived, spec)[0]; };
{
  const html = renderSettings(LIVE);
  const g = settingsGlass(html), row = sample();
  ok(g && g.w === 105 && g.h === 108 && g.sw === row.width && g.sh === row.height,
    `Window Settings: glass W = leaf - ${g?.w}, glass H = leaf - ${g?.h}, sample ${g?.sw} x ${g?.sh} = schedule of a 040L 1000 x 1500 (${row.width} x ${row.height})`);
  const cards = settingsCards(html);
  ok(cards.Stiles === '64 × 57' && cards['Top rail'] === '64 × 57' && cards['Bottom rail'] === '67 × 57', `Window Settings: leaf cards ${JSON.stringify(cards)}`);
  const seat = html.match(/L = field leaf W \+<\/span><span[^>]*><input[^>]*value="([^"]*)"/);
  ok(seat && seat[1] === '8.5', `Window Settings: the Transom card shows ${seat?.[1]} (lenKey transomSeat)`);
}
// a hand-edited bottom rail 70 through the UI path (the Bottom rail card writes setCasementElementField('leafBottom');
// t39 drives the cards themselves in a browser)
{
  const st = LIVE.profileStore.useWindowProfileStore;
  st.getState().setCasementElementField('leafBottom', 'face', 70);
  let p = st.getState().casement;
  ok(faces(p) === '64 / 64 / 70' && p.deductions.glass === 105, `bottom rail 70 typed: stored faces ${faces(p)}, deductions.glass ${p.deductions.glass} (the width, unchanged)`);
  const F70 = { stile: 64, top: 64, bottom: 70 };
  const a = checkSheets(LIVE, 'bottom rail 70 040L', byId('040L-1000x1200'), F70);
  ok(a.rows[0].width === 793 && a.rows[0].height === 991, `bottom rail 70 040L: schedule ${a.rows[0].width} x ${a.rows[0].height} = 898 - 105 x 1102 - 111 (52.5 + 58.5)`);
  const b = checkSheets(LIVE, 'bottom rail 70 021', byId('021-1000x1200'), F70);
  ok(JSON.stringify(b.rows.map((x) => [x.width, x.height])) === '[[793,245.2],[793,603.8]]', `bottom rail 70 021: schedule ${b.rows.map((x) => `${x.width} x ${x.height}`).join(', ')}`);
  checkSheets(LIVE, 'bottom rail 70 arched V1', byId('arched-V1'), F70);
  let g = settingsGlass(renderSettings(LIVE)), row = sample();
  ok(g && g.w === 105 && g.h === 111 && g.sw === row.width && g.sh === row.height && g.sh === 1291, `bottom rail 70: Window Settings glass W = leaf - ${g?.w}, H = leaf - ${g?.h}, sample ${g?.sw} x ${g?.sh} = schedule`);
  // the Stiles / Top rail card writes the stiles and the top rail together, never the bottom rail
  st.getState().setCasementLeafFace(70);
  p = st.getState().casement;
  ok(faces(p) === '70 / 70 / 70' && p.deductions.glass === 117, `stiles / top rail 70 typed after it: stored faces ${faces(p)} (the bottom rail keeps its own 70), deductions.glass ${p.deductions.glass} = 2 x (70 - 11.5)`);
  st.getState().setCasementElementField('leafBottom', 'face', 67);
  p = st.getState().casement;
  const c = checkSheets(LIVE, 'stiles 70 040L', byId('040L-1000x1200'), { stile: 70, top: 70, bottom: 67 });
  ok(faces(p) === '70 / 70 / 67' && c.rows[0].width === 781 && c.rows[0].height === 988, `stiles / top rail 70, bottom rail 67: schedule ${c.rows[0].width} x ${c.rows[0].height} = 898 - 117 x 1102 - 114 (58.5 + 55.5)`);
  g = settingsGlass(renderSettings(LIVE)); row = sample();
  ok(g && g.w === 117 && g.h === 114 && g.sw === row.width && g.sh === row.height, `stiles 70: Window Settings glass W = leaf - ${g?.w}, H = leaf - ${g?.h}, sample ${g?.sw} x ${g?.sh} = schedule`);
  st.getState().resetToDefaults();
  ok(faces(st.getState().casement) === '64 / 64 / 67' && st.getState().casement.deductions.glass === 105, 'reset to defaults: 64 / 64 / 67, glass 105');
  // sensitivity: on the START tree the same bottom-rail edit changes nothing (one deduction both ways, the sheet draws 64)
  const ss = START.profileStore.useWindowProfileStore;
  ss.getState().setCasementElementField('leafBottom', 'face', 70);
  const { spec: s0, derived: d0 } = derive(START, byId('040L-1000x1200'));
  const srow = START.lists.buildGlassListForWindow(d0, s0)[0];
  const lsv = render(START.LeafDetail, { windowSpec: s0, derived: d0, group: START.cdu.groupCasementLeaves(d0)[0], projectNumber: 'P-1' });
  const smg = memberMargins(lsv, 898, 1102, 770, 974);
  ok(srow.height === 997 && smg && smg.bottom === 64,
    `sensitivity: on START a bottom rail of 70 left the schedule at ${srow.width} x ${srow.height} and the leaf sheet drew a ${smg?.bottom} bottom rail (what this tura fixes)`);
  ss.getState().resetToDefaults();
}

// ═════════════════════════════════════════════════════════════════════════════
section('11 - raw stock, Pre-Cut groups, hinge picks');
{
  const LEAF_ITEM = /^C-(STILE|TOP RAIL|BOTTOM RAIL)/;
  const mats = [{ id: 'eng-63x75', name: 'Engineered timber 63 x 75', size: '63 x 75mm' }];
  const flat = { c_sash_stile: { material_id: 'eng-63x75' }, c_sash_top_rail: { material_id: 'eng-63x75' }, c_sash_bottom_rail: { material_id: 'eng-63x75' } };
  const schema2 = { schema: 2, base: { c_sash_stile: { material_id: 'eng-63x75', yield: 1 }, c_sash_top_rail: { material_id: 'eng-63x75', yield: 1 }, c_sash_bottom_rail: { material_id: 'eng-63x75', yield: 1 } }, overrides: {} };
  const leafRaw = (M, w, rr) => {
    const { spec, derived } = derive(M, w);
    const pc = M.lists.buildPrecutForWindow(derived, spec, {}, rr);
    return pc.sashEngineering.flatMap((g) => g.items.filter((it) => LEAF_ITEM.test(it.elementName)).map((it) => `${it.elementName}:${g.section}:${it.finishedSection}`));
  };
  const group = (arr, re) => [...new Set(arr.filter((x) => re.test(x)).map((x) => x.split(':')[1]))].join();
  for (const w of SET.filter((x) => !x.raw)) {
    for (const [name, asg, data] of [['flat', flat, null], ['schema 2', null, schema2]]) {
      const a = leafRaw(LIVE, w, LIVE.bom.makeRawResolver({ assignments: asg, assignmentsData: data, materials: mats }));
      const c = leafRaw(START, w, START.bom.makeRawResolver({ assignments: asg, assignmentsData: data, materials: mats }));
      ok(a.length > 0 && a.length === c.length && a.every((x) => x.split(':')[1] === '63x75'),
        `${w.id} (${name} assignment): every leaf Pre-Cut item on the assigned 63x75, the bottom rail in the same group (${a.length} items, finished ${[...new Set(a.map((x) => x.split(':')[2]))]})`);
    }
    const a = leafRaw(LIVE, w, undefined), c = leafRaw(START, w, undefined);
    ok(JSON.stringify(a.map((x) => x.split(':')[1])) === JSON.stringify(c.map((x) => x.split(':')[1])) && group(a, /BOTTOM/) === group(a, /STILE/),
      `${w.id} (no assignment): fallback raw ${[...new Set(a.map((x) => x.split(':')[1]))]} = START; the bottom rail in the stiles' group (the fallback reads the depth 57)`);
  }
  // Triple glazing (leaf depth 61): no sash face is 61, so without an assignment the Pre-Cut raw section IS the
  // finished one: the bottom rail 67x61 becomes its OWN group next to the stiles' and top rail's 64x61 (BLOCKERS 28.2).
  const tri = cas('040L-1000x1200-triple', 1000, 1200, { casementLayout: '040L', glassType: 'triple' });
  {
    const a = leafRaw(LIVE, tri, undefined), c = leafRaw(START, tri, undefined), b = leafRaw(REF, tri, undefined);
    ok(a.length === 4 && group(a, /STILE|TOP/) === '64x61' && group(a, /BOTTOM/) === '67x61' && group(c, /./) === '64x61' && group(b, /./) === '67x61',
      `triple 040L (no assignment): stiles and top rail ${group(a, /STILE|TOP/)}, bottom rail ${group(a, /BOTTOM/)} (its own Pre-Cut group; START all ${group(c, /./)}, REF all ${group(b, /./)})`);
    const aa = leafRaw(LIVE, tri, LIVE.bom.makeRawResolver({ assignments: flat, assignmentsData: null, materials: mats }));
    ok(aa.length === 4 && aa.every((x) => x.split(':')[1] === '63x75'), 'triple 040L (assigned): one group, the assigned 63x75');
  }
  const slots = (M) => Object.fromEntries((M.materials.ALL_PARTS || []).filter((p) => /^c_sash_/.test(p.id)).map((p) => [p.id, p.section]));
  const sl = slots(LIVE), sst = slots(START), sr = slots(REF);
  ok(sl.c_sash_stile === '64×57' && sl.c_sash_top_rail === '64×57' && sl.c_sash_bottom_rail === '67×57' && sst.c_sash_bottom_rail === '64×57' && sr.c_sash_bottom_rail === '67×57',
    `Assign Materials: Leaf Stiles ${sl.c_sash_stile}, Top Rail ${sl.c_sash_top_rail}, Bottom Rail ${sl.c_sash_bottom_rail} (START 64×57, REF 67×57), same ids`, JSON.stringify(sl));
  const strip = (arr) => JSON.stringify((arr || []).map((p) => (p.id === 'c_sash_bottom_rail' ? { ...p, section: '' } : p)));
  ok(strip(LIVE.materials.ALL_PARTS) === strip(START.materials.ALL_PARTS), 'Assign Materials: every other part and field unchanged against START');
  // hinges: the leaf weight moves (bottom rail + 0.104 kg/m, glass - 3 mm), no window of the set changes slot
  for (const w of SET) {
    const a = L[w.id].derived.casement.hardware.hingePicks, c = S[w.id].derived.casement.hardware.hingePicks;
    ok(JSON.stringify(a.map((h) => h?.slotId || null)) === JSON.stringify(c.map((h) => h?.slotId || null)) && JSON.stringify(L[w.id].derived.casement.hardware.lockPicks) === JSON.stringify(S[w.id].derived.casement.hardware.lockPicks),
      `${w.id}: hinge slots ${a.map((h) => (h ? h.slotId.replace(/^c_hinge_/, '') : '-')).join(', ')} = START, locks equal (leaf kg ${L[w.id].derived.casement.leafWeights.map((x) => (x ? x.weightKg : 'fix')).join(', ')}; START ${S[w.id].derived.casement.leafWeights.map((x) => (x ? x.weightKg : 'fix')).join(', ')})`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('12 - nothing else moved: the live tree with the old numbers pinned');
{
  // The live code with a profile that holds START's numbers (64 / 64 / 64, already on leaf schema 3 so the
  // migration leaves it alone) must derive and draw what START does, byte for byte; with REF's numbers
  // (67 / 67 / 67, 111, seat 8) what REF does. Proves the two-deduction refactor changed no output by itself.
  for (const [M, X, name, face, glass, seat] of [[START, S, 'START', 64, 105, 8.5], [REF, F, 'REF', 67, 111, 8]]) {
    const pin = clone(LIVE.profile.DEFAULT_CASEMENT_PROFILE);
    ['leafStile', 'leafTop', 'leafBottom'].forEach((k) => { pin.elements[k].face = face; });
    pin.deductions.glass = glass; pin.lengths.transomSeat = seat;
    LIVE.profile.setActiveCasementProfile(pin);
    for (const w of SET) {
      const a = derive(LIVE, w), b = X[w.id];
      ok(JSON.stringify(a.derived) === JSON.stringify(b.derived), `${name} pinned, ${w.id}: derived byte-identical to ${name}`);
      const sa = sheetsOf(LIVE, a.spec, a.derived), sb = sheetsOf(M, b.spec, b.derived);
      ok(JSON.stringify(sa) === JSON.stringify(sb), `${name} pinned, ${w.id}: elevation, production elevation, ${sa.leaf.length} leaf and ${sa.glass.length} glass sheets byte-identical`);
    }
    LIVE.profile.setActiveCasementProfile(null);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('13 - one source for the glass deductions; no reader applies one number both ways');
{
  const P = LIVE.profile;
  const D = P.DEFAULT_CASEMENT_PROFILE;
  const dd = (p) => P.casementGlassDeductions(p);
  ok(typeof P.casementGlassDeductions === 'function' && dd(D).width === 105 && dd(D).height === 108 && dd().width === 105 && dd().height === 108 && P.casementGlassDeduction(D) === 105,
    'profile.casementGlassDeductions(default) = width 105, height 108; casementGlassDeduction (the stored width) = 105');
  const x = clone(D); x.elements.leafStile.face = 70; x.elements.leafBottom.face = 72; x.deductions.glass = 1;
  ok(dd(x).width === 117 && dd(x).height === 113, 'derived from the faces, never the stored value, while glassInset is a number (stored 1 ignored -> W 117, H 52.5 + 60.5 = 113)');
  const y = clone(D); delete y.geometry.glassInset; y.deductions.glass = 109;
  ok(dd(y).width === 109 && dd(y).height === 109, 'without glassInset both directions fall back to deductions.glass (109 / 109), as before');
  const z = clone(D); z.geometry.glassInset = 11.55;
  ok(dd(z).width === 104.9 && dd(z).height === 107.9, 'rounded to 0.1 like the engine: W 2 x (64 - 11.55) = 104.9, H 52.45 + 55.45 = 107.9');
  // structure: the readers named in the brief take the pair; nobody sizes a glass with the width-only helper
  // or reads the stored deductions.glass; the glass PDF prints the schedule rows
  const src = (f) => readFileSync(resolve(ROOT, 'src', f), 'utf8');
  for (const f of ['engine/calculations.js', 'components/drawings/CasementDrawing2D.jsx', 'components/drawings/CasementLeafDetail2D.jsx', 'components/drawings/CasementGlassDrawing2D.jsx', 'pages/WindowSettingsPage.jsx', 'utils/glassPdfExport.js']) {
    const s = src(f);
    const pdf = f === 'utils/glassPdfExport.js';
    ok((pdf ? /buildGlassListForWindow/.test(s) : /casementGlassDeductions\(/.test(s)) && !/casementGlassDeduction\(/.test(s) && !/deductions\.glass|ded\.glass/.test(s),
      `${f}: ${pdf ? 'prints the glass schedule rows (buildGlassListForWindow), no formula of its own' : 'uses casementGlassDeductions (width AND height)'}, no width-only helper, no deductions.glass read`);
  }
  // behaviour: the fallback path of every sheet (no engine unit) with a bottom rail of 70 prints leaf W - 105 x leaf H - 111
  const st = LIVE.profileStore.useWindowProfileStore;
  st.getState().setCasementElementField('leafBottom', 'face', 70);
  const { spec, derived } = derive(LIVE, byId('040L-1000x1200'));
  const bare = clone(derived); delete bare.customGlassUnits;
  const leafSub = texts(render(LIVE.LeafDetail, { windowSpec: spec, derived: bare, group: LIVE.cdu.groupCasementLeaves(derived)[0], projectNumber: 'P-1' })).join('\n').match(GLASS_RE);
  const glassSub = texts(render(LIVE.GlassDrawing, { windowSpec: spec, derived: bare, group: LIVE.cdu.groupCasementGlass(derived, spec)[0] })).join('\n').match(/(\d+(?:\.\d)?) × (\d+(?:\.\d)?) mm/);
  const casSub = texts(render(LIVE.CasDrawing, { windowSpec: spec, derived: bare, batch: null })).map((t) => t.match(GLASS_RE)).filter(Boolean)[0];
  ok([leafSub, glassSub, casSub].every((m) => m && m[1] === '793' && m[2] === '991'),
    `without the engine unit, bottom rail 70: leaf sheet ${leafSub?.[1]} x ${leafSub?.[2]}, glass sheet ${glassSub?.[1]} x ${glassSub?.[2]}, production elevation ${casSub?.[1]} x ${casSub?.[2]} = 898 - 105 x 1102 - 111`);
  ok(derived.customGlassUnits[0].width === 793 && derived.customGlassUnits[0].height === 991, `engine with bottom rail 70: unit ${derived.customGlassUnits[0].width} x ${derived.customGlassUnits[0].height}`);
  st.getState().resetToDefaults();
}

// ═════════════════════════════════════════════════════════════════════════════
section('14 - the half millimetre through the consumers');
{
  // No consumer may truncate, crash or print a long float. The engine record and the
  // drawing run carry one decimal (R); the cut list and the Pre-Cut round every member to
  // whole mm by their existing rule (lists.js, Math.round: a 446.2 leaf already prints 446),
  // so 906.5 prints 907 there and 906.5 + 20 = 926.5 -> 927 on the Pre-Cut.
  const oneDecimal = (v) => Number.isFinite(v) && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
  for (const w of SET) {
    const { spec, derived } = L[w.id];
    const recsAll = [...derived.components.box, ...derived.components.sash];
    ok(recsAll.every((r) => oneDecimal(r.length)) && derived.casement.transomRuns.every((t) => oneDecimal(t.length)),
      `${w.id}: every casement record and transom run has at most one decimal`);
    const cut = LIVE.lists.buildCutListForWindow(derived, spec);
    const ref = REF.lists.buildCutListForWindow(F[w.id].derived, F[w.id].spec);
    ok(cut.every((r) => Number.isInteger(r.length)) && cut.length === ref.length, `${w.id}: cut list ${cut.length} rows, whole mm (existing rule)`);
    const tl = cut.filter((r) => r.element === 'C-TRANSOM'), tr = recs(derived, /^C-TRANSOM$/);
    ok(tl.length === tr.length && tl.every((r, i) => r.length === Math.round(tr[i].length)), `${w.id}: cut list C-TRANSOM ${tl.map((r) => r.length).join(', ') || 'none'} = round(${tr.map((r) => r.length).join(', ') || '-'})`);
    const pc = LIVE.lists.buildPrecutForWindow(derived, spec, {}, undefined);
    const items = pc.sashEngineering.flatMap((g) => g.items);
    const pt = items.filter((it) => it.elementName === 'C-TRANSOM');
    ok(items.every((it) => Number.isInteger(it.length) && Number.isInteger(it.finishedLength)) && pt.every((it, i) => it.length === Math.round(tr[i].length + 20) && it.finishedLength === Math.round(tr[i].length)),
      `${w.id}: Pre-Cut whole mm, transom ${pt.map((it) => `${it.length} (finished ${it.finishedLength})`).join(', ') || 'none'}`);
    const opt = LIVE.optimizer.optimisePrecut(pc, { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 2500 });
    const cuts = opt.sashEngineering.flatMap((g) => g.bars.flatMap((b) => b.cuts));
    ok(cuts.length === items.reduce((a, it) => a + (it.quantity || 1), 0) && cuts.every((c) => Number.isFinite(c) && Number.isInteger(c)),
      `${w.id}: optimiser places all ${cuts.length} Pre-Cut pieces, whole mm, no NaN`);
    const pq = LIVE.bom.buildWindowPartQtys(derived, spec, {}, undefined);
    const pqr = REF.bom.buildWindowPartQtys(F[w.id].derived, F[w.id].spec, {}, undefined);
    if (pt.length) ok(pq.c_transom.mm === pt.reduce((a, it) => a + it.length * (it.quantity || 1), 0) && pq.c_transom.mm - pqr.c_transom.mm === pt.length * (pt[0].length - Math.round(F[w.id].derived.casement.transomRuns[0].length + 20)),
      `${w.id}: BOM c_transom ${pq.c_transom.mm} mm (REF ${pqr.c_transom.mm}) = the Pre-Cut pieces; purchase list ${LIVE.bom.formatQty(pq.c_transom.mm / 1000, 'm')}`);
  }
  // the frame sheet is the drawing that prints the transom length (0.5 grid)
  const { spec, derived } = L['021-1000x1200'];
  const frame = texts(render(LIVE.FrameDetail, { windowSpec: spec, derived, projectNumber: 'P-1' }));
  ok(frame.some((t) => t === 'C-T 906.5'), 'frame sheet prints "C-T 906.5"', frame.filter((t) => /C-T/.test(t)).join(' | '));
  const cd = texts(render(LIVE.CasDrawing, { windowSpec: spec, derived, batch: null }));
  ok(cd.some((t) => /^C-T · 906\.5 · /.test(t)), 'production elevation (CasementDrawing2D) prints "C-T · 906.5"', cd.filter((t) => /C-T/.test(t)).join(' | '));
  // bSuite (src/utils/bsuiteExport.js is read only for this tura): the transom row carries 906.5
  const { rows } = LIVE.bsuite.buildBsuiteFrameRows(spec, derived, 'W1');
  const tRow = rows.find((r) => /^TRANSOM/.test(r.element || ''));
  ok(tRow && tRow.vars.LPX === 906.5 && /run 906\.5$/.test(tRow.note || ''), `bSuite transom row: LPX ${tRow?.vars?.LPX}, note "${(tRow?.note || '').replace(/^.*(run [\d.]+)$/, '$1')}" (no long float)`, JSON.stringify(tRow).slice(0, 300));
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
