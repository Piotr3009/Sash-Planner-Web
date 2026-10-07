/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t38: casement leaf 64 and transom seat 8.5 (Piotr 06.10.2026).
 *
 *   A. The four casement leaf members are 64 wide (were 67); the glass
 *      deduction follows the face: 2 x (64 - 11.5) = 105 (was 111).
 *   B. The transom seat is 8.5 (was 8): C-TRANSOM = field leaf W + 8.5.
 *
 * Bundles the LIVE src and a reference tree at the commit this branch starts
 * from (default 5459f5b3a73d8c428ef3e0ea548bd98f700ae7d2, `main` on 06.10.2026,
 * needs the git history) and derives the Stage 0 reference set from both:
 * casement 040L 1000 x 1200 (plain and with 2V / 1H bars), 021 1000 x 1200,
 * 120 / 052L / 021 / 023 / 142 / 031 at 1800 x 1500, the arched V1 (three-centre
 * 1000 x 1500, start 1300, the t18 vector), the 800 circle with a sunburst
 * (t23 / t28), and the two controls: a sash (standard, 2x2 bars) and a door.
 *
 *   1  leaf outer sizes equal the reference
 *   2  every leaf member section 64x57 (ref 67x57); member lengths equal the
 *      reference, except the two curved members whose length IS the ring
 *      centre line (recomputed by hand)
 *   3  glass units = reference + 6 in width and in height
 *   4  every transom = reference + 0.5 (cut list record and transomRuns);
 *      906.5 / 1706.5 / 840.5, Pre-Cut 927
 *   5  frame head, cill, jambs, mullions identical; a partial mullion keeps
 *      its length (partialMullionSeat stays 8)
 *   6  literal numbers for 040L 1000 x 1200 and 120 1800 x 1500, by hand
 *   7  arched leaf: top rail ring 64 wide, glass line 52.5 inside the leaf edge
 *   8  sash and door: derived deep-equal to the reference
 *   9  migration of stored profiles (leafSchema 2, lengthSchema 2)
 *  10  drawings: the four casement sheets and Window Settings print the glass
 *      of the glass schedule and the stile 64; again with a hand-edited face 70
 *  11  raw stock: an assigned leaf material stays the Pre-Cut section; without
 *      one the fallback is the reference's
 *  12  nothing else moved: the live tree with the OLD numbers pinned (67 / 8)
 *      derives and draws byte for byte what the reference does
 *  13  one source for the glass deduction; the stored value kept in step
 *  14  the half millimetre through the consumers of the transom length
 *
 * Run: node verify/parity/t38_leaf_64_seat_85.mjs [git-ref]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const ref = process.argv[2] || '5459f5b3a73d8c428ef3e0ea548bd98f700ae7d2';
const tag = `t38-ref-${ref.slice(0, 12).replace(/[^\w.-]+/g, '_')}`;
const tree = resolve(AUDIT, `${tag}-tree`);
rmSync(tree, { recursive: true, force: true });
mkdirSync(tree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${ref} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });

// The engine, the four casement sheets, the unused production elevation, the
// Window Settings page and the two stores, in ONE bundle per tree. The stores
// import the Supabase client, which reads import.meta.env: defined empty, so
// the client is "not configured" and nothing touches the network (as t37).
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
    `export * as profileStore from '${rel('stores/windowProfileStore.js')}';`,
    `export * as materials from '${rel('stores/materialAssignmentStore.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:react-router-dom',
    '--external:jspdf', '--external:three', `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
// zustand persist has no localStorage under node: it warns on every write; silence that one line
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist/i.test(String(a[0]))) return; warn(...a); };

const LIVE = await bundle(resolve(ROOT, 'src'), 't38-live');
const REF = await bundle(resolve(tree, 'src'), tag);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const R1 = (v) => Math.round(v * 10) / 10;

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
const SASH = { id: 'sash', item: { id: 's', name: 'S', width: 1000, height: 1500 }, fc: { windowCategory: 'sash', frameType: 'standard', upperBars: '2x2', lowerBars: '2x2', horns: 'none' } };
const DOOR = { id: 'door', item: { id: 'd', name: 'D', width: 1000, height: 2100 }, fc: { windowCategory: 'door', doorType: 'single-external' } };

const derive = (M, w) => {
  const spec = w.raw ? M.specification.normaliseToWindowSpec(w.raw) : M.specification.normaliseToWindowSpec(w.item, { fullConfig: w.fc });
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const recs = (d, re) => (d.components?.sash || []).filter((r) => re.test(r.elementName));
const LEAF_RE = /^C-(STILE|TOP RAIL|BOTTOM RAIL|ARCH TOP RAIL|LEAF RING)/;
const CURVED_RE = /^C-(ARCH TOP RAIL|LEAF RING)$/;

const L = {}, F = {};
for (const w of [...SET, SASH, DOOR]) { L[w.id] = derive(LIVE, w); F[w.id] = derive(REF, w); }

// ═════════════════════════════════════════════════════════════════════════════
section('0 - profile numbers');
{
  const P = LIVE.profile.DEFAULT_CASEMENT_PROFILE, Q = REF.profile.DEFAULT_CASEMENT_PROFILE;
  ok(['leafStile', 'leafTop', 'leafBottom'].every((k) => P.elements[k].face === 64 && Q.elements[k].face === 67), 'default leaf faces 64 / 64 / 64 (reference 67 / 67 / 67)');
  ok(P.deductions.glass === 105 && Q.deductions.glass === 111, `deductions.glass 105 = 2 x (64 - 11.5) (reference 111 = 2 x (67 - 11.5))`);
  ok(P.lengths.transomSeat === 8.5 && Q.lengths.transomSeat === 8, 'lengths.transomSeat 8.5 (reference 8)');
  ok(P.lengths.partialMullionSeat === 8 && Q.lengths.partialMullionSeat === 8, 'lengths.partialMullionSeat stays 8 (provisional, its own decision)');
  ok(P.leafSchema === 2 && P.lengthSchema === 2 && Q.leafSchema === undefined && Q.lengthSchema === undefined, 'new schema counters leafSchema 2 / lengthSchema 2 (absent on the reference)');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const strip = (p) => { const c = clone(p); delete c.leafSchema; delete c.lengthSchema; ['leafStile', 'leafTop', 'leafBottom'].forEach((k) => delete c.elements[k]); delete c.deductions.glass; delete c.lengths.transomSeat; return c; };
  ok(same(strip(P), strip(Q)), 'every other key of the casement profile is unchanged (frame 68 x 93, leaf depth 57, deductions.leaf*, every other length)');
  ok(same(LIVE.profile.DEFAULT_DOOR_PROFILE, REF.profile.DEFAULT_DOOR_PROFILE) && same(LIVE.profile.DEFAULT_SASH_PROFILE, REF.profile.DEFAULT_SASH_PROFILE), 'door and sash default profiles unchanged');
}

// ═════════════════════════════════════════════════════════════════════════════
section('1 - leaf outer sizes equal the reference');
for (const w of SET) {
  const a = L[w.id].derived.casement.leaves, b = F[w.id].derived.casement.leaves;
  ok(a.length === b.length && a.every((x, i) => x.leafW === b[i].leafW && x.leafH === b[i].leafH),
    `${w.id}: ${a.map((x) => `${x.leafW} x ${x.leafH}`).join(', ')}`, JSON.stringify(b));
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - leaf member sections 64x57, lengths unchanged (curved members: ring centre line)');
// The ring centre line sits face / 2 inside the leaf outer contour: 64 instead of
// 67 moves it out by 1.5, so a curved member grows by 1.5 x (its sweep angle).
// V1 (three-centre, start 1300): leaf outer radii 99 / 1349 / 99 (frame 150 / 1400 /
// 150 minus leafAtJamb 51), haunch 73.74 deg, crown 32.52 deg (t18 vector): centre
// radii 67 / 1317 / 67 -> 2 x 67 x 1.28700 + 1317 x 0.56758 = 919.97 -> 920.0
// (reference 65.5 / 1315.5 / 65.5 -> 915.3). Circle 800: leaf outer r 349 ->
// centre r 317 -> 2 x pi x 317 = 1991.77 -> 1991.8 (reference 315.5 -> 1982.3).
const HAND_CURVED = { 'arched-V1': 920.0, 'circle-800': 1991.8 };
for (const w of SET) {
  const a = recs(L[w.id].derived, LEAF_RE), b = recs(F[w.id].derived, LEAF_RE);
  ok(a.length === b.length && a.length > 0 && a.every((r) => r.section === '64x57') && b.every((r) => r.section === '67x57'),
    `${w.id}: ${a.length} leaf members, section 64x57 (reference 67x57)`, [...new Set(a.map((r) => r.section))].join());
  const straight = a.filter((r) => !CURVED_RE.test(r.elementName));
  ok(straight.every((r, i) => r.length === b.filter((x) => !CURVED_RE.test(x.elementName))[i].length && r.elementName === b.filter((x) => !CURVED_RE.test(x.elementName))[i].elementName),
    `${w.id}: straight member lengths equal the reference (${straight.map((r) => r.length).join(' ')})`);
  const curved = a.filter((r) => CURVED_RE.test(r.elementName));
  if (curved.length) {
    const c0 = b.find((r) => CURVED_RE.test(r.elementName));
    ok(curved.length === 1 && near(curved[0].length, HAND_CURVED[w.id], 1e-9),
      `${w.id}: ${curved[0].elementName} ${curved[0].length} = ring centre line by hand ${HAND_CURVED[w.id]} (reference ${c0.length})`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - glass units = reference + 6 in width and in height');
for (const w of SET) {
  const a = L[w.id].derived.customGlassUnits, b = F[w.id].derived.customGlassUnits;
  ok(a.length === b.length && a.length > 0 && a.every((u, i) => near(u.width, b[i].width + 6) && near(u.height, b[i].height + 6)),
    `${w.id}: ${a.map((u, i) => `${u.width} x ${u.height} (ref ${b[i].width} x ${b[i].height})`).join(', ')}`);
  const ga = LIVE.lists.buildGlassListForWindow(L[w.id].derived, L[w.id].spec), gb = REF.lists.buildGlassListForWindow(F[w.id].derived, F[w.id].spec);
  ok(ga.length === gb.length && ga.every((r, i) => near(r.width, gb[i].width + 6) && near(r.height, gb[i].height + 6) && r.qty === gb[i].qty),
    `${w.id}: glass schedule rows + 6 each way (${ga.map((r) => `${r.width} x ${r.height}`).join(', ')})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - every transom = reference + 0.5');
for (const w of SET) {
  const a = recs(L[w.id].derived, /^C-TRANSOM$/), b = recs(F[w.id].derived, /^C-TRANSOM$/);
  const ra = L[w.id].derived.casement.transomRuns, rb = F[w.id].derived.casement.transomRuns;
  if (!b.length) { ok(!a.length && !ra.length, `${w.id}: no transom (none in the reference)`); continue; }
  ok(a.length === b.length && a.every((r, i) => near(r.length, b[i].length + 0.5)),
    `${w.id}: C-TRANSOM ${a.map((r) => r.length).join(', ')} = ref ${b.map((r) => r.length).join(', ')} + 0.5`);
  ok(ra.length === rb.length && ra.every((r, i) => near(r.length, rb[i].length + 0.5) && r.code === rb[i].code && r.axisT === rb[i].axisT && r.x1 === rb[i].x1 && r.x2 === rb[i].x2),
    `${w.id}: transomRuns ${ra.map((r) => r.length).join(', ')} = ref + 0.5, axis and land band unchanged`);
}
{
  const t = (id) => recs(L[id].derived, /^C-TRANSOM$/).map((r) => r.length);
  ok(JSON.stringify(t('021-1000x1200')) === '[906.5]', '021 1000 x 1200: C-TRANSOM 906.5 = leaf 898 + 8.5', JSON.stringify(t('021-1000x1200')));
  ok(JSON.stringify(t('021-1800x1500')) === '[1706.5]', '021 1800 x 1500: C-TRANSOM 1706.5 = leaf 1698 + 8.5', JSON.stringify(t('021-1800x1500')));
  ok(JSON.stringify(t('052L-1800x1500')) === '[840.5]', '052L 1800 x 1500: C-TRANSOM 840.5 = leaf 832 + 8.5', JSON.stringify(t('052L-1800x1500')));
  const pc = LIVE.lists.buildPrecutForWindow(L['021-1000x1200'].derived, L['021-1000x1200'].spec, {}, undefined);
  const tr = pc.sashEngineering.flatMap((g) => g.items).filter((it) => it.elementName === 'C-TRANSOM');
  ok(tr.length === 1 && tr[0].length === 927, `021 1000 x 1200: Pre-Cut transom 927 = round(906.5 + 20) (reference 926)`, JSON.stringify(tr));
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - frame head, cill, jambs and mullions identical to the reference');
for (const w of SET) {
  const a = L[w.id].derived, b = F[w.id].derived;
  const box = (d) => JSON.stringify(d.components.box.map((r) => [r.elementName, r.section, r.length, r.quantity, r.notes]));
  ok(box(a) === box(b), `${w.id}: frame members (${a.components.box.map((r) => `${r.code} ${r.length}`).join(', ')})`);
  const mul = (d) => JSON.stringify([recs(d, /^C-MULLION$/).map((r) => [r.section, r.length, r.notes]), d.casement.mullionRuns]);
  ok(mul(a) === mul(b), `${w.id}: mullions and mullion runs (${recs(a, /^C-MULLION$/).map((r) => r.length).join(', ') || 'none'})`);
}
{
  const pm = recs(L['031-1800x1500'].derived, /^C-MULLION$/);
  ok(pm.length === 1 && /partial/.test(pm[0].notes) && pm[0].length === 454.2,
    '031 1800 x 1500: partial mullion 454.2 = tier leaf H 446.2 + partialMullionSeat 8 (unchanged; not the transom seat)', JSON.stringify(pm));
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - literal numbers by hand');
// 040L 1000 x 1200 (frame 68, leafAtJamb 51, leafFullHeight 98, face 64, glassInset 11.5):
//   leaf      1000 - 2 x 51 = 898  x  1200 - 98 = 1102
//   glass     898 - 105 = 793  x  1102 - 105 = 997       (105 = 2 x (64 - 11.5))
//   daylight  898 - 2 x 64 = 770  x  1102 - 2 x 64 = 974
//   beading   round(2 x (793 + 997) x 1.15) = round(4117.0) = 4117
//   leaf kg   kgPerM(64, 57) = 64 x 57 x 610 / 1e6 = 2.22528 kg/m x (2 x 1102 + 2 x 898) / 1000
//             = 8.90112; glass 0.793 x 0.997 x 21 = 16.60304; (8.90112 + 16.60304) x 1.05 = 26.779 -> 26.8
//   window    timber 4.4 m x 3.85764 (68 x 93) + 8.90112 = 25.87474 -> 25.9; glass 16.6;
//             total (25.87474 + 16.60304) x 1.05 = 44.6017 -> 44.6; glass m2 0.790621 -> 0.79
//   bead tape one side (2 x (793 + 997)) / 1000 = 3.58 m
// 120 1800 x 1500 (two leaves at a mullion, axis 900; leafAtMullionAxis 17):
//   leaf      900 - 51 - 17 = 832  x  1500 - 98 = 1402   (both leaves)
//   glass     832 - 105 = 727  x  1402 - 105 = 1297
//   daylight  832 - 128 = 704  x  1402 - 128 = 1274
//   beading   round(2 panes x 2 x (727 + 1297) x 1.15) = round(9310.4) = 9310
//   leaf kg   2.22528 x (2 x 1402 + 2 x 832) / 1000 = 9.94255; glass 0.727 x 1.297 x 21 = 19.80130;
//             (9.94255 + 19.80130) x 1.05 = 31.2310 -> 31.2 each; glass m2 2 x 0.942919 = 1.885838 -> 1.89
{
  const d = L['040L-1000x1200'].derived, c = d.casement;
  ok(c.leaves[0].leafW === 898 && c.leaves[0].leafH === 1102, '040L: leaf 898 x 1102');
  ok(d.customGlassUnits[0].width === 793 && d.customGlassUnits[0].height === 997, `040L: glass unit 793 x 997`, JSON.stringify(d.customGlassUnits[0]));
  // the daylight is printed by the leaf sheet (its dimension chain), so the check reads the rendered sheet
  const leafSheetTexts = (id) => {
    const { spec, derived } = L[id];
    const svg = renderToStaticMarkup(React.createElement(LIVE.LeafDetail, { windowSpec: spec, derived, group: LIVE.cdu.groupCasementLeaves(derived)[0], projectNumber: 'P-1' }));
    return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  };
  const t040 = leafSheetTexts('040L-1000x1200');
  ok(t040.includes('770') && t040.includes('974') && !t040.includes('764') && !t040.includes('968'), '040L: daylight 770 x 974 printed on the leaf sheet (reference 764 x 968)', JSON.stringify(t040.slice(0, 8)));
  ok(d.components.beading.length === 1 && d.components.beading[0].length === 4117, `040L: glazing beading 4117`, JSON.stringify(d.components.beading));
  ok(c.leafWeights[0].weightKg === 26.8, `040L: leaf weight 26.8 kg (reference ${F['040L-1000x1200'].derived.casement.leafWeights[0].weightKg})`, JSON.stringify(c.leafWeights));
  ok(d.weights.timber === 25.9 && d.weights.glass === 16.6 && d.weights.total === 44.6, `040L: weights 25.9 / 16.6 / 44.6`, JSON.stringify(d.weights));
  ok(d.consumables.glass.sqm === 0.79 && d.consumables.beadTapeSide.meters === 3.58, `040L: glass 0.79 m2, bead tape 3.58 m`, JSON.stringify(d.consumables));
  const e = L['120-1800x1500'].derived, ec = e.casement;
  ok(ec.leaves.every((l) => l.leafW === 832 && l.leafH === 1402), '120: leaves 832 x 1402');
  ok(e.customGlassUnits.every((u) => u.width === 727 && u.height === 1297), '120: glass units 727 x 1297', JSON.stringify(e.customGlassUnits.map((u) => [u.width, u.height])));
  const t120 = leafSheetTexts('120-1800x1500');
  ok(t120.includes('704') && t120.includes('1274') && !t120.includes('698') && !t120.includes('1268'), '120: daylight 704 x 1274 printed on the leaf sheet (reference 698 x 1268)', JSON.stringify(t120.slice(0, 8)));
  ok(e.components.beading[0].length === 9310, `120: glazing beading 9310`, JSON.stringify(e.components.beading));
  ok(ec.leafWeights.every((x) => x.weightKg === 31.2), `120: leaf weights 31.2 / 31.2 kg`, JSON.stringify(ec.leafWeights));
  ok(e.consumables.glass.sqm === 1.89, `120: glass 1.89 m2`, String(e.consumables.glass.sqm));
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - arched leaf: ring 64 wide, glass line 52.5 inside the leaf edge');
for (const id of ['arched-V1', 'circle-800']) {
  const A = L[id].derived.arch, B = F[id].derived.arch;
  const lt = A.geometry.leafTop;
  ok(lt.outer.length === lt.inner.length && lt.outer.every((a, k) => near(a.r - lt.inner[k].r, 64)),
    `${id}: leaf top ring outer - inner radius = 64 on every arc (${lt.outer.map((a, k) => `${R1(a.r)} - ${R1(lt.inner[k].r)}`).join(', ')}; reference ${B.geometry.leafTop.inner.map((a) => R1(a.r)).join(' / ')} inner)`);
  ok(lt.outer.every((a, k) => near(a.r, B.geometry.leafTop.outer[k].r)), `${id}: leaf outer contour unchanged`);
  const gr = A.glassOutline.radii;
  ok(gr.length > 0 && gr.every((r, k) => near(r, lt.outer[k].r - 52.5, 0.051)),
    `${id}: glass radii ${gr.join(' / ')} = leaf outer - 52.5 (64 - 11.5)`);
  ok(near(A.glassOutline.origin.x, 51 + 52.5, 0.051), `${id}: glass origin x ${A.glassOutline.origin.x} = leafAtJamb 51 + 52.5 (reference ${B.glassOutline.origin.x})`);
}
ok(near(L['arched-V1'].derived.arch.glassOutline.origin.y, 47 + 52.5, 0.051), `arched-V1: glass bottom edge ${L['arched-V1'].derived.arch.glassOutline.origin.y} = cill side 47 + 52.5 (reference 102.5)`);

// ═════════════════════════════════════════════════════════════════════════════
section('8 - sash and door: nothing moves');
for (const id of ['sash', 'door']) {
  ok(JSON.stringify(L[id].derived) === JSON.stringify(F[id].derived), `${id}: derived deep-equal to the reference`);
  const ca = LIVE.lists.buildCutListForWindow(L[id].derived, L[id].spec), cb = REF.lists.buildCutListForWindow(F[id].derived, F[id].spec);
  ok(JSON.stringify(ca) === JSON.stringify(cb), `${id}: cut list equal`);
  const ga = LIVE.lists.buildGlassListForWindow(L[id].derived, L[id].spec), gb = REF.lists.buildGlassListForWindow(F[id].derived, F[id].spec);
  ok(JSON.stringify(ga) === JSON.stringify(gb), `${id}: glass schedule equal (${ga.map((r) => `${r.width} x ${r.height}`).join(', ')})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - migration of stored profiles');
{
  const mig = LIVE.profile.migrateCasementProfile;
  const faces = (p) => ['leafStile', 'leafTop', 'leafBottom'].map((k) => p.elements[k].face).join(' / ');
  const stored = clone(REF.profile.DEFAULT_CASEMENT_PROFILE);   // what every workshop saved before today: 67 / 111 / 8, no leafSchema / lengthSchema
  const m1 = mig(stored);
  ok(faces(m1) === '64 / 64 / 64' && m1.deductions.glass === 105 && m1.lengths.transomSeat === 8.5 && m1.leafSchema === 2 && m1.lengthSchema === 2,
    `stored 67 / 67 / 67, glass 111, seat 8 -> ${faces(m1)}, ${m1.deductions.glass}, ${m1.lengths.transomSeat} (schemas ${m1.leafSchema} / ${m1.lengthSchema})`);
  const s70 = clone(stored); ['leafStile', 'leafTop', 'leafBottom'].forEach((k) => { s70.elements[k].face = 70; });
  const m2 = mig(s70);
  ok(faces(m2) === '70 / 70 / 70' && m2.deductions.glass === 117, `hand-edited face 70 stays 70, its glass deduction ${m2.deductions.glass} = 2 x (70 - 11.5) = 117`);
  const s9 = clone(stored); s9.lengths.transomSeat = 9;
  const m3 = mig(s9);
  ok(m3.lengths.transomSeat === 9 && faces(m3) === '64 / 64 / 64', `hand-edited seat 9 stays 9 (the faces still move)`);
  const cur = clone(stored); cur.leafSchema = 2; cur.lengthSchema = 2;
  const m4 = mig(cur);
  ok(faces(m4) === '67 / 67 / 67' && m4.deductions.glass === 111 && m4.lengths.transomSeat === 8, `a copy already on leafSchema 2 / lengthSchema 2 is left alone (67 / 111 / 8 stay)`);
  const mixed = clone(stored); mixed.elements.leafBottom.face = 72;
  const m5 = mig(mixed);
  ok(faces(m5) === '64 / 64 / 72' && m5.deductions.glass === 105, `per face: an edited bottom rail 72 stays, the two faces on 67 move (glass from the stile: 105)`);
  // glass schema 1 (02.10.2026 history): inset 12.5, glass 109, edge cover 11, leaf 67, no schema counters at all
  const old = clone(stored); delete old.glassSchema; old.geometry.glassInset = 12.5; old.deductions.glass = 109;
  Object.keys(old.glass.edgeCover).forEach((k) => { old.glass.edgeCover[k] = 11; });
  const m6 = mig(old);
  ok(m6.geometry.glassInset === 11.5 && faces(m6) === '64 / 64 / 64' && m6.deductions.glass === 105 && Object.values(m6.glass.edgeCover).every((v) => v === 10) && m6.glassSchema === 2,
    `glass schema 1 copy (12.5 / 109 / 11 / 67) -> inset ${m6.geometry.glassInset}, leaf ${faces(m6)}, glass ${m6.deductions.glass}, edge cover ${[...new Set(Object.values(m6.glass.edgeCover))]}`);
  ok(JSON.stringify(mig(m1)) === JSON.stringify(m1) && JSON.stringify(mig(m6)) === JSON.stringify(m6), 'migration is idempotent (a migrated copy migrates to itself)');
  const D = LIVE.profile.DEFAULT_CASEMENT_PROFILE;
  ok(JSON.stringify(mig(clone(D))) === JSON.stringify(D), 'the live default migrates to itself');
  // the frame schema 1 copy still moves its frame keys exactly as before (v4 Block F history)
  const f1 = clone(stored); delete f1.frameSchema; f1.elements.frameHead.face = 57; f1.elements.frameJamb.face = 57; f1.geometry.land = 36;
  const mf = mig(f1);
  ok(mf.elements.frameHead.face === 68 && mf.elements.frameJamb.face === 68 && mf.geometry.land === 47 && faces(mf) === '64 / 64 / 64', 'frame schema 1 copy: frame keys move as before, leaf moves too');
  // the engine reads the migrated copy: a stored 67 / 111 / 8 profile derives today's numbers
  LIVE.profile.setActiveCasementProfile(stored);
  const dm = derive(LIVE, SET[2]).derived;
  LIVE.profile.setActiveCasementProfile(null);
  ok(JSON.stringify(dm) === JSON.stringify(L['021-1000x1200'].derived), 'a stored 67 / 111 / 8 profile, set active, derives exactly what the new default derives (021 1000 x 1200)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - drawings print the glass of the glass schedule and the stile 64');
const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const GLASS_RE = /glass (\d+(?:\.\d)?) × (\d+(?:\.\d)?) · 24mm/;
function sheetsOf(M, spec, derived) {
  return {
    elevation: render(M.Elevation, { windowSpec: spec, derived, projectNumber: 'P-1' }),
    casDrawing: render(M.CasDrawing, { windowSpec: spec, derived, batch: null }),
    leaf: M.cdu.groupCasementLeaves(derived).map((group) => ({ group, svg: render(M.LeafDetail, { windowSpec: spec, derived, group, projectNumber: 'P-1' }) })),
    glass: M.cdu.groupCasementGlass(derived, spec).map((group) => ({ group, svg: render(M.GlassDrawing, { windowSpec: spec, derived, group }) })),
  };
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
  const m = html.match(/glass = leaf − <span[^>]*>([\d.]+)<\/span><span[^>]*> = 2 × \(([\d.]+) − ([\d.]+)\) · sample <\/span><span[^>]*>([\d.]+) × ([\d.]+)<\/span>/);
  return m ? { ded: Number(m[1]), face: Number(m[2]), inset: Number(m[3]), w: Number(m[4]), h: Number(m[5]) } : null;
};
// Every sheet of a window against the glass schedule (lists.buildGlassListForWindow = the glazier's rows)
function checkSheets(M, label, w, face) {
  const { spec, derived } = derive(M, w);
  const rows = M.lists.buildGlassListForWindow(derived, spec);
  const sch = rows.map((r) => `${r.width} x ${r.height}`);
  const S = sheetsOf(M, spec, derived);
  // leaf sheet: subtitle glass = the schedule row of that leaf; the stile dimension printed = face
  S.leaf.forEach(({ group, svg }) => {
    const m = texts(svg).join('\n').match(GLASS_RE);
    const u = derived.customGlassUnits[group.rep];
    ok(m && Number(m[1]) === u.width && Number(m[2]) === u.height && sch.includes(`${m[1]} x ${m[2]}`),
      `${label} leaf sheet ${group.key}: prints glass ${m ? `${m[1]} x ${m[2]}` : '?'}, schedule ${sch.join(', ')}`);
    const t = texts(svg);
    ok(t.filter((x) => x === String(face)).length >= 2 && !t.includes(String(face === 64 ? 67 : 64)), `${label} leaf sheet ${group.key}: stile dimension ${face} printed (x${t.filter((x) => x === String(face)).length})`);
  });
  // glass sheet: "W × H mm" = schedule
  S.glass.forEach(({ group, svg }) => {
    const m = texts(svg).join('\n').match(/(\d+(?:\.\d)?) × (\d+(?:\.\d)?) mm/);
    ok(m && sch.includes(`${m[1]} x ${m[2]}`), `${label} glass sheet ${group.key}: prints ${m ? `${m[1]} x ${m[2]}` : '?'} mm, in the schedule`);
  });
  // production elevation (CasementDrawing2D): every "glass W × H" callout is a schedule row; the stile label = face
  const cd = texts(S.casDrawing);
  const calls = cd.map((x) => x.match(GLASS_RE)).filter(Boolean);
  ok(calls.length > 0 && calls.every((m) => sch.includes(`${m[1]} x ${m[2]}`)), `${label} CasementDrawing2D: glass callouts ${calls.map((m) => `${m[1]} x ${m[2]}`).join(', ')} in the schedule`);
  ok(cd.includes(String(face)), `${label} CasementDrawing2D: stile ${face} printed in the chain`);
  // front elevation prints no glass size and no stile: it DRAWS the daylight. A rectangular leaf's
  // daylight rect = leaf - 2 x face, and daylight + 2 x glassInset (11.5) = the scheduled unit.
  if (!derived.arch) {
    derived.casement.leaves.forEach((l, i) => {
      const dw = R1(l.leafW - 2 * face), dh = R1(l.leafH - 2 * face);
      const u = derived.customGlassUnits[i];
      ok(S.elevation.includes(`width="${dw}" height="${dh}"`) && near(dw + 2 * 11.5, u.width) && near(dh + 2 * 11.5, u.height),
        `${label} front elevation P${i + 1}: daylight ${dw} x ${dh} drawn (leaf - 2 x ${face}); + 2 x 11.5 = unit ${u.width} x ${u.height}`);
    });
  } else {
    const inner = derived.arch.geometry.leafTop.inner.map((a) => R1(a.r));
    ok(inner.every((r) => S.elevation.includes(`A ${r} ${r}`) || S.elevation.includes(`A${r} ${r}`)), `${label} front elevation: daylight arcs drawn at the leaf inner radii ${inner.join(' / ')} (outer - ${face})`);
  }
  return { derived, rows };
}
for (const [id, label] of [['040L-1000x1200', '040L'], ['arched-V1', 'arched V1']]) checkSheets(LIVE, label, SET.find((w) => w.id === id), 64);
{
  // A unit that is NOT a whole number (052L 1800 x 1500: 727 x 341.2 fan, 727 x 819.8): the glass sheet and the
  // production elevation print the schedule exactly; the leaf sheet prints every size on its 0.5 grid (as it
  // prints the 446.2 leaf "446"), so its subtitle shows the schedule unit rounded to 0.5 (BLOCKERS 27.7 d).
  const { spec, derived } = L['052L-1800x1500'];
  const sch = LIVE.lists.buildGlassListForWindow(derived, spec).map((r) => `${r.width} x ${r.height}`);
  const half = (v) => { const r = Math.round(v * 2) / 2; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  LIVE.cdu.groupCasementLeaves(derived).forEach((group) => {
    const u = derived.customGlassUnits[group.rep];
    const m = texts(render(LIVE.LeafDetail, { windowSpec: spec, derived, group, projectNumber: 'P-1' })).join('\n').match(GLASS_RE);
    ok(m && m[1] === half(u.width) && m[2] === half(u.height), `052L leaf sheet ${group.key}: glass ${m?.[1]} x ${m?.[2]} = the schedule unit ${u.width} x ${u.height} on the sheet's 0.5 grid`);
  });
  LIVE.cdu.groupCasementGlass(derived, spec).forEach((group) => {
    const m = texts(render(LIVE.GlassDrawing, { windowSpec: spec, derived, group })).join('\n').match(/(\d+(?:\.\d)?) × (\d+(?:\.\d)?) mm/);
    ok(m && sch.includes(`${m[1]} x ${m[2]}`), `052L glass sheet ${group.key}: prints ${m?.[1]} x ${m?.[2]} mm, exactly the schedule`);
  });
  const calls = texts(render(LIVE.CasDrawing, { windowSpec: spec, derived, batch: null })).map((x) => x.match(GLASS_RE)).filter(Boolean);
  ok(calls.length === 3 && calls.every((m) => sch.includes(`${m[1]} x ${m[2]}`)), `052L CasementDrawing2D: glass callouts ${calls.map((m) => `${m[1]} x ${m[2]}`).join(', ')}, exactly the schedule`);
}
{
  const html = renderSettings(LIVE);
  const g = settingsGlass(html);
  const { derived, spec } = derive(LIVE, cas('sample', 1000, 1500, { casementLayout: '040L' }));
  const row = LIVE.lists.buildGlassListForWindow(derived, spec)[0];
  ok(g && g.ded === 105 && g.face === 64 && g.w === row.width && g.h === row.height,
    `Window Settings: glass = leaf - ${g?.ded} = 2 x (${g?.face} - ${g?.inset}), sample ${g?.w} x ${g?.h} = schedule of a 040L 1000 x 1500 (${row.width} x ${row.height})`);
  const seat = html.match(/L = field leaf W \+<\/span><span[^>]*><input[^>]*value="([^"]*)"/);
  ok(seat && seat[1] === '8.5', `Window Settings: the Transom card shows ${seat?.[1]} (lenKey transomSeat)`);
}
// hand-edited face 70 through the UI path (the store setter): every number agrees
{
  const st = LIVE.profileStore.useWindowProfileStore;
  st.getState().setCasementLeafFace(70);
  const p = st.getState().casement;
  ok(p.elements.leafStile.face === 70 && p.elements.leafTop.face === 70 && p.elements.leafBottom.face === 70 && p.deductions.glass === 117,
    `face 70 typed in Window Settings: stored faces 70 / 70 / 70, stored deductions.glass ${p.deductions.glass} (kept in step: 2 x (70 - 11.5) = 117)`);
  const a = checkSheets(LIVE, 'face 70 040L', SET[0], 70);
  ok(a.rows[0].width === 898 - 117 && a.rows[0].height === 1102 - 117, `face 70 040L: schedule ${a.rows[0].width} x ${a.rows[0].height} = 898 - 117 x 1102 - 117`);
  checkSheets(LIVE, 'face 70 arched V1', SET.find((w) => w.id === 'arched-V1'), 70);
  const g = settingsGlass(renderSettings(LIVE));
  const { derived, spec } = derive(LIVE, cas('sample', 1000, 1500, { casementLayout: '040L' }));
  const row = LIVE.lists.buildGlassListForWindow(derived, spec)[0];
  ok(g && g.ded === 117 && g.w === row.width && g.h === row.height, `face 70: Window Settings glass = leaf - ${g?.ded}, sample ${g?.w} x ${g?.h} = schedule ${row.width} x ${row.height}`);
  st.getState().setCasementGeometry('glassInset', 12);
  ok(st.getState().casement.deductions.glass === 116, `glassInset 12 typed: stored deductions.glass ${st.getState().casement.deductions.glass} = 2 x (70 - 12)`);
  st.getState().resetToDefaults();
  ok(st.getState().casement.deductions.glass === 105 && st.getState().casement.elements.leafStile.face === 64, 'reset to defaults: 64 / 105');
  // the reference tree had the stale reader: the same edit there leaves the leaf sheet on 111
  const rs = REF.profileStore.useWindowProfileStore;
  rs.getState().setCasementLeafFace(70);
  const { spec: s0, derived: d0 } = derive(REF, SET[0]);
  const sub = texts(render(REF.LeafDetail, { windowSpec: s0, derived: d0, group: REF.cdu.groupCasementLeaves(d0)[0], projectNumber: 'P-1' })).join('\n').match(GLASS_RE);
  const rrow = REF.lists.buildGlassListForWindow(d0, s0)[0];
  ok(sub && `${sub[1]} x ${sub[2]}` !== `${rrow.width} x ${rrow.height}`,
    `sensitivity: on the reference tree the same face 70 left the leaf sheet at ${sub?.[1]} x ${sub?.[2]} against the schedule ${rrow.width} x ${rrow.height} (the stale deductions.glass this tura removes)`);
  rs.getState().resetToDefaults();
}

// ═════════════════════════════════════════════════════════════════════════════
section('11 - raw stock of the leaf');
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
  for (const w of SET.filter((x) => !x.raw)) {
    for (const [name, asg, data] of [['flat', flat, null], ['schema 2', null, schema2]]) {
      const a = leafRaw(LIVE, w, LIVE.bom.makeRawResolver({ assignments: asg, assignmentsData: data, materials: mats }));
      const b = leafRaw(REF, w, REF.bom.makeRawResolver({ assignments: asg, assignmentsData: data, materials: mats }));
      ok(a.length > 0 && a.every((x) => x.split(':')[1] === '63x75') && b.every((x) => x.split(':')[1] === '63x75') && a.length === b.length,
        `${w.id} (${name} assignment): every leaf Pre-Cut item on the assigned 63x75, before and after (${a.length} items, finished ${[...new Set(a.map((x) => x.split(':')[2]))]})`);
    }
    const a = leafRaw(LIVE, w, undefined).map((x) => x.split(':')[1]), b = leafRaw(REF, w, undefined).map((x) => x.split(':')[1]);
    ok(JSON.stringify(a) === JSON.stringify(b), `${w.id} (no assignment): fallback raw ${[...new Set(a)]} = reference ${[...new Set(b)]}`);
  }
  // Triple glazing (leaf depth 61): no sash face is 61, so without an assignment the Pre-Cut raw
  // section IS the finished one, which moves with the face (67x61 -> 64x61). The rule did not change.
  const tri = cas('040L-1000x1200-triple', 1000, 1200, { casementLayout: '040L', glassType: 'triple' });
  {
    const a = leafRaw(LIVE, tri, undefined), b = leafRaw(REF, tri, undefined);
    ok(a.length === 4 && a.every((x) => x.split(':')[1] === '64x61' && x.split(':')[2] === '64x61') && b.every((x) => x.split(':')[1] === '67x61' && x.split(':')[2] === '67x61'),
      `triple 040L (no assignment): fallback raw = the finished section, ${[...new Set(b.map((x) => x.split(':')[1]))]} -> ${[...new Set(a.map((x) => x.split(':')[1]))]} (Pre-Cut group key moves; reported)`);
    const aa = leafRaw(LIVE, tri, LIVE.bom.makeRawResolver({ assignments: flat, assignmentsData: null, materials: mats }));
    const bb = leafRaw(REF, tri, REF.bom.makeRawResolver({ assignments: flat, assignmentsData: null, materials: mats }));
    ok(aa.every((x) => x.split(':')[1] === '63x75') && bb.every((x) => x.split(':')[1] === '63x75'), 'triple 040L (assigned): the assigned 63x75, before and after');
  }
  const slots = Object.fromEntries((LIVE.materials.ALL_PARTS || []).filter((p) => /^c_sash_/.test(p.id)).map((p) => [p.id, p.section]));
  const rslots = Object.fromEntries((REF.materials.ALL_PARTS || []).filter((p) => /^c_sash_/.test(p.id)).map((p) => [p.id, p.section]));
  ok(['c_sash_stile', 'c_sash_top_rail', 'c_sash_bottom_rail'].every((k) => slots[k] === '64×57' && rslots[k] === '67×57'),
    `Assign Materials: the three leaf slots read 64×57 (reference 67×57), same ids`, JSON.stringify(slots));
  const strip = (arr) => JSON.stringify((arr || []).map((p) => (/^c_sash_(stile|top_rail|bottom_rail)$/.test(p.id) ? { ...p, section: '' } : p)));
  ok(strip(LIVE.materials.ALL_PARTS) === strip(REF.materials.ALL_PARTS), 'Assign Materials: every other part and field unchanged');
}

// ═════════════════════════════════════════════════════════════════════════════
section('12 - nothing else moved: the live tree with the old numbers pinned');
{
  // The live code with a profile that holds the OLD numbers (67 / 111 / seat 8, already on the
  // new schemas so the migration leaves it alone) must derive and draw what the reference does,
  // byte for byte. Proves the one-source refactor (Stage 2) changed no output by itself.
  const old = clone(LIVE.profile.DEFAULT_CASEMENT_PROFILE);
  ['leafStile', 'leafTop', 'leafBottom'].forEach((k) => { old.elements[k].face = 67; });
  old.deductions.glass = 111; old.lengths.transomSeat = 8;
  LIVE.profile.setActiveCasementProfile(old);
  for (const w of SET) {
    const a = derive(LIVE, w), b = F[w.id];
    ok(JSON.stringify(a.derived) === JSON.stringify(b.derived), `${w.id}: derived byte-identical to the reference`);
    const sa = sheetsOf(LIVE, a.spec, a.derived), sb = sheetsOf(REF, b.spec, b.derived);
    ok(JSON.stringify(sa) === JSON.stringify(sb), `${w.id}: elevation, production elevation, ${sa.leaf.length} leaf and ${sa.glass.length} glass sheets byte-identical`);
  }
  LIVE.profile.setActiveCasementProfile(null);
}

// ═════════════════════════════════════════════════════════════════════════════
section('13 - one source for the glass deduction');
{
  const P = LIVE.profile;
  const D = P.DEFAULT_CASEMENT_PROFILE;
  ok(typeof P.casementGlassDeduction === 'function' && P.casementGlassDeduction(D) === 105 && P.casementGlassDeduction() === 105, 'profile.casementGlassDeduction(default) = 105');
  const x = clone(D); x.elements.leafStile.face = 70; x.deductions.glass = 1;
  ok(P.casementGlassDeduction(x) === 117, 'derived from the face, never the stored value, while glassInset is a number (stored 1 ignored -> 117)');
  const y = clone(D); delete y.geometry.glassInset; y.deductions.glass = 109;
  ok(P.casementGlassDeduction(y) === 109, 'falls back to deductions.glass only when glassInset is missing');
  const z = clone(D); z.geometry.glassInset = 11.55;
  ok(P.casementGlassDeduction(z) === 104.9, 'rounded to 0.1 like the engine: 2 x (64 - 11.55) = 104.9');
  // structure: the readers named in the brief call the helper; nobody else reads deductions.glass
  const src = (f) => readFileSync(resolve(ROOT, 'src', f), 'utf8');
  for (const f of ['engine/calculations.js', 'components/drawings/CasementDrawing2D.jsx', 'components/drawings/CasementLeafDetail2D.jsx', 'components/drawings/CasementGlassDrawing2D.jsx', 'pages/WindowSettingsPage.jsx']) {
    const s = src(f);
    ok(/casementGlassDeduction/.test(s) && !/deductions\.glass|ded\.glass/.test(s), `${f}: uses casementGlassDeduction, no deductions.glass / ded.glass read`);
  }
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
      `${w.id}: BOM c_transom ${pq.c_transom.mm} mm (reference ${pqr.c_transom.mm}) = the Pre-Cut pieces; purchase list ${LIVE.bom.formatQty(pq.c_transom.mm / 1000, 'm')}`);
  }
  // the frame sheet is the drawing that prints the transom length (0.5 grid)
  const { spec, derived } = L['021-1000x1200'];
  const frame = texts(render(LIVE.FrameDetail, { windowSpec: spec, derived, projectNumber: 'P-1' }));
  ok(frame.some((t) => t === 'C-T 906.5'), `frame sheet prints "C-T 906.5"`, frame.filter((t) => /C-T/.test(t)).join(' | '));
  const cd = texts(render(LIVE.CasDrawing, { windowSpec: spec, derived, batch: null }));
  ok(cd.some((t) => /^C-T · 906\.5 · /.test(t)), `production elevation (CasementDrawing2D) prints "C-T · 906.5"`, cd.filter((t) => /C-T/.test(t)).join(' | '));
  // bSuite (src/utils/bsuiteExport.js is read only for this tura): the transom row carries 906.5
  const { rows } = LIVE.bsuite.buildBsuiteFrameRows(spec, derived, 'W1');
  const tRow = rows.find((r) => /^TRANSOM/.test(r.element || ''));
  ok(tRow && tRow.vars.LPX === 906.5 && /run 906\.5$/.test(tRow.note || ''), `bSuite transom row: LPX ${tRow?.vars?.LPX}, note "${(tRow?.note || '').replace(/^.*(run [\d.]+)$/, '$1')}" (no long float)`, JSON.stringify(tRow).slice(0, 300));
}

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
