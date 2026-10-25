/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t50: meeting room partition walls v1 (Piotr 25.10.2026), the 'partition' category.
 * The reference bay is the Windmill Street bay 2525 x 2165, layout SDS, door 800,
 * 3 lights, panel 790 (the engine's own defaults); every number below is typed
 * as a literal and checked against the live engine.
 *   1  the profile: DEFAULT_PARTITION_PROFILE keys, migratePartitionProfile, the
 *      store (setPartitionPath, string leaves, an unknown root, the reset), the
 *      engine sync, withProfiles with a 4th argument (and the old 4-argument form);
 *   2  the spec: category, the partition block, frame depth 54, glazing 28 and
 *      6/16/6, the layout normalisation; no partition key on other categories;
 *   3  the bay geometry: fields, posts (roles, blanks, lips), the section rule,
 *      the top rail pockets, the screen (zone, lights, bars, mid rail, panel,
 *      bottom rail, unit), the post pockets, the door (leaf, daylight, lights,
 *      rails, panel, unit, hinges, latch, lock edge, stop, faces);
 *   4  the dowel joints: 54 dowels in 18 joints, the triangle, the rebated
 *      post, the narrow mid rail row, the wide door rail row;
 *   5  the records: every W- cut list record, the glass units, the panels, the
 *      weights, the consumables;
 *   6  the lists: cut list material, the grouped symbols, the pre-cut groups,
 *      the glass rows with applied bars, the hardware lines;
 *   7  pricing and config: windowSpecToConfig, calculatePrice placeholder 0;
 *   8  variants: SS, D, panelHeight 0, hinge right, swing in; the geometry
 *      errors (a 1200 SDS wall, 20 lights) with their details;
 *   9  controls: a casement, a sash and a door derive with no partition key;
 *  10  the sheets: the plan keys, every sheet rendered (no NaN / undefined /
 *      long dash, no text collisions; the dimension rule on the elevation, the
 *      leaf and the glass drawings; the member sheets are folded CNC sheets
 *      with a chain under every row and the Sections sheet a set of detail
 *      windows, so they are checked for their captions instead; the members
 *      also for the large dims over the first row), the
 *      elevation, the leaf, the post sheets, the glass drawings; the variants'
 *      full plans.
 *
 * Run: node verify/parity/t50_partition.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkDimRule } from '../arch/lib/dimRule.mjs';
import { collisionFailures, describeFailures } from '../arch/lib/textCollision.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const SECTION_SHEET = resolve(ROOT, 'src/components/drawings/PartitionSection2D.jsx');
const hasSectionSheet = existsSync(SECTION_SHEET);

const build = (name, lines) => {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  writeFileSync(entry, lines.join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return pathToFileURL(out).href;
};
// PartitionSheet.jsx imports the Sections sheet; while that file is not written
// the harness bundles the leaf and member sheets alone and maps them itself.
const url = build('t50-live', [
  ...['specification', 'calculations', 'profile', 'lists', 'pricing', 'partition'].map((m) => `export * as ${m} from '${resolve(ROOT, `src/engine/${m}.js`)}';`),
  `export * as cfg from '${resolve(ROOT, 'src/utils/windowSpecToConfig.js')}';`,
  `export * from '${resolve(ROOT, 'src/stores/windowProfileStore.js')}';`,
  `export * as pdu from '${resolve(ROOT, 'src/components/drawings/partitionDrawUtils.js')}';`,
  `export { default as Elevation } from '${resolve(ROOT, 'src/components/drawings/PartitionElevation2D.jsx')}';`,
  `export { default as Leaf } from '${resolve(ROOT, 'src/components/drawings/PartitionLeaf2D.jsx')}';`,
  `export { default as Member } from '${resolve(ROOT, 'src/components/drawings/PartitionMember2D.jsx')}';`,
  `export { default as Glass } from '${resolve(ROOT, 'src/components/drawings/DoorGlassDrawing2D.jsx')}';`,
  ...(hasSectionSheet ? [`export { default as PartitionSheet } from '${resolve(ROOT, 'src/components/drawings/PartitionSheet.jsx')}';`] : []),
]);
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist|Calc failed/i.test(String(a[0]))) return; warn(...a); };
const M = await import(`${url}?t=${Date.now()}`);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.01) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const J = (o) => JSON.stringify(o);
const holesNear = (holes, want, tol = 0.1) => Array.isArray(holes) && holes.length === want.length
  && holes.every((h, i) => near(h.across, want[i][0], tol) && near(h.depth, want[i][1], tol));

const { specification, calculations, profile, lists, pricing, cfg, pdu } = M;
const PP = profile.DEFAULT_PARTITION_PROFILE;
const mk = (w, h, fc = {}, name = 'X') => {
  const spec = specification.normaliseToWindowSpec({ id: 'w1', name, width: w, height: h }, { fullConfig: { windowCategory: 'partition', ...fc } });
  return { spec, derived: calculations.deriveWindowData(spec, {}) };
};
const BAY_FC = { partitionLayout: 'SDS', partitionDoorWidth: 800, partitionLights: 3, partitionPanelHeight: 790 };
const bay = () => mk(2525, 2165, BAY_FC, 'Bay 1');
const recs = (d) => [...(d.components.box || []), ...(d.components.sash || [])];
const rec = (d, name, noteStart) => recs(d).filter((r) => r.elementName === name && (!noteStart || String(r.notes || '').startsWith(noteStart)));
const recIs = (r, section, length, qty, code) => !!r && r.section === section && near(r.length, length) && r.quantity === qty && r.code === code;
const joint = (pw, element, where) => (pw.joints || []).find((j) => j.element === element && (!where || j.where === where));

// ═════════════════════════════════════════════════════════════════════════════
section('1 - the partition profile, its migration, the store and withProfiles');
{
  ok(PP.depth === 54 && PP.elements.post.face === 50 && PP.glazing.rebateDepth === 18 && PP.glazing.glassIn === 13.5 && PP.door.leafDepth === 54 && PP.hinges.length === 102 && PP.hardware.handleHeight === 1000,
    'DEFAULT_PARTITION_PROFILE: depth 54, post 50, rebate 18, glassIn 13.5, leafDepth 54, hinge 102, handle 1000');
  ok(J(PP.joints.dowel) === J({ dia: 8, length: 40, perJoint: 3 }) && PP.defaults.lights === 3 && PP.defaults.panelHeight === 790 && PP.defaults.doorWidth === 800 && PP.defaults.layout === 'SDS',
    'joints.dowel { 8, 40, 3 }; defaults lights 3, panelHeight 790, doorWidth 800, layout SDS (the Windmill Street bay)');
  ok(PP.elements.bead.thickness === 12 && PP.elements.bar.thickness === 8 && PP.glazing.dummySpacer === 22 && PP.panel.thickness === 30 && PP.door.stopWidth === 17 && PP.door.lipFront === 20 && PP.door.headStop === 'planted' && PP.hinges.knuckle === 14,
    'the assumption keys (BLOCKERS 34.x): bead 12, bar 8, dummy spacer 22, panel 30, stop 17, lip 20, planted head stop, knuckle 14');
  const mig = profile.migratePartitionProfile({ schema: 1, depth: 60 });
  const sansDepth = (p) => { const c = clone(p); delete c.depth; return c; };
  ok(mig && mig.depth === 60 && J(sansDepth(mig)) === J(sansDepth(PP)), 'migratePartitionProfile({ schema 1, depth 60 }): depth 60 kept, every other block from the default');
  ok(profile.migratePartitionProfile(null) === null, 'migratePartitionProfile(null) is null');
  // the store: the generic setter, the engine sync, a string leaf, an unknown root, the reset (t49 section 5 pattern)
  const S = M.useWindowProfileStore;
  S.getState().resetPartitionToDefaults?.();
  S.getState().setPartitionPath(['elements', 'post', 'face'], 60);
  ok(S.getState().partition.elements.post.face === 60 && profile.getPartitionProfile().elements.post.face === 60, "setPartitionPath(['elements', 'post', 'face'], 60): the store and the active engine profile read 60");
  S.getState().setPartitionPath(['defaults', 'layout'], 'SS');
  S.getState().setPartitionPath(['nonsense', 'x'], 1);
  S.getState().setPartitionPath(['elements', 'post', 'nope'], 5);
  S.getState().setPartitionPath(['elements', 'post', 'face'], 'abc');
  const st = S.getState().partition;
  ok(st.defaults.layout === 'SS' && !('nonsense' in st) && !('nope' in st.elements.post) && st.elements.post.face === 60,
    "a string leaf (defaults.layout 'SS') is written; an unknown root, an unknown leaf and a non-number are refused");
  S.getState().resetPartitionToDefaults();
  ok(S.getState().partition.elements.post.face === 50 && profile.getPartitionProfile().elements.post.face === 50 && S.getState().partition.defaults.layout === 'SDS', 'resetPartitionToDefaults: post 50 and layout SDS again, in the store and the engine');
  // withProfiles: the 4th argument is the partition profile; the older 4-argument form (fn in 4th place) still works
  const inside = profile.withProfiles(null, null, null, { ...PP, depth: 60 }, () => bay().derived.partition.depth);
  ok(inside === 60 && bay().derived.partition.depth === 54, `withProfiles(sash, casement, door, partition, fn): depth ${inside} inside, 54 after`);
  ok(profile.withProfiles(null, null, null, () => bay().derived.partition.depth) === 54 && profile.withProfiles(null, null, () => bay().derived.partition.depth) === 54,
    'withProfiles(sash, casement, door, fn) and (sash, casement, fn) still take the callback in that place');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - the spec: the partition block, frame depth, glazing; the layout normalisation');
const B = bay();
{
  const s = B.spec;
  ok(s.category === 'partition' && J(s.partition) === J({ layout: 'SDS', doorWidth: 800, lights: 3, panelHeight: 790, hingeSide: 'left', swing: 'out' }),
    `spec.category partition, spec.partition ${J(s.partition)}`);
  ok(s.frame.depth === 54 && s.glazing.thickness === 28 && s.glazing.makeup === '6/16/6', `frame depth ${s.frame.depth}, glazing thickness ${s.glazing.thickness}, makeup ${s.glazing.makeup}`);
  const s2 = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 2525, height: 2165 }, { fullConfig: { windowCategory: 'partition', partitionLayout: 'sds x' } });
  ok(s2.partition.layout === 'SDS' && s2.partition.doorWidth === 800 && s2.partition.lights === 3 && s2.partition.panelHeight === 790, "layout 'sds x' normalises to SDS; the other fields take the profile defaults");
  const cas = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 1200, height: 1200 }, { fullConfig: { windowCategory: 'casement' } });
  const sash = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 900, height: 1500 }, { fullConfig: {} });
  const door = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 900, height: 2100 }, { fullConfig: { windowCategory: 'door', doorType: 'single-external' } });
  ok(!('partition' in cas) && !('partition' in sash) && !('partition' in door) && cas.category === 'casement' && sash.category === 'sash' && door.category === 'door',
    'a casement, a sash and a door spec carry NO partition key (t41 section 17 compares the keys)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - the bay 2525 x 2165 SDS: fields, posts, section, top rail, screen, door');
const pw = B.derived.partition;
{
  ok(B.derived.category === 'partition' && pw && pw.layout === 'SDS' && pw.totalWidth === 2525 && pw.totalHeight === 2165, 'derived.category partition, layout SDS, 2525 x 2165');
  ok(J(pw.fields.map((f) => [f.kind, f.x, f.w])) === J([['S', 70, 742.5], ['D', 862.5, 800], ['S', 1712.5, 742.5]]),
    `fields S 70 / 742.5, D 862.5 / 800, S 1712.5 / 742.5 (2525 - 2 x 20 - 4 x 50 - 800 = 1485 / 2): ${J(pw.fields.map((f) => [f.kind, f.x, f.w]))}`);
  ok(J(pw.posts.map((p) => p.x)) === J([20, 812.5, 1662.5, 2455]) && J(pw.posts.map((p) => p.role)) === J(['end', 'hinge', 'lock', 'end']),
    `posts x ${J(pw.posts.map((p) => p.x))}, roles ${J(pw.posts.map((p) => p.role))}`);
  ok(J(pw.posts.map((p) => p.blank)) === J([50, 50, 67, 50]) && pw.posts[2].lips.left === true && !pw.posts[2].lips.right && pw.posts.every((p, i) => i === 2 || (!p.lips.left && !p.lips.right)),
    'blanks 50 / 50 / 67 / 50: the lock post P3 carries the 17 stop lip on its left (the door side)');
  ok(pw.depth === 54 && pw.boardWidth === 74, `depth ${pw.depth}, boardWidth ${pw.boardWidth} (54 + 2 x 10)`);
  const S = pw.section;
  ok(S.upstand === 12 && S.zoneDepth === 30 && S.bead.w === 18 && S.bead.t === 12 && S.rebate === 18 && S.glassIn === 13.5 && S.play === 4.5 && S.pocketDepth === 42 && S.spacer === 12 && S.dummySpacer === 22,
    'section: upstand 12 / zone 30 / bead 18 x 12, rebate 18, glassIn 13.5, play 4.5, pocket 42, spacer 12, dummy spacer 22');
  const tr = pw.topRail;
  ok(tr.x === 20 && tr.y === 20 && tr.w === 2485 && tr.h === 50 && J(tr.pockets.map((k) => [k.from, k.to, k.w, k.d])) === J([[32, 810.5, 18, 42], [1674.5, 2453, 18, 42]]),
    `top rail 20 / 20, 2485 x 50, stopped pockets ${J(tr.pockets.map((k) => [k.from, k.to]))} (18 past each screen)`);
  const sc = pw.screens[0];
  ok(pw.screens.length === 2 && J(sc.zone) === J({ x: 70, y: 70, w: 742.5, h: 1205 }), `screen S1 zone ${J(sc.zone)}`);
  ok(J(sc.lights.map((l) => [l.y, l.h])) === J([[70, 387], [479, 387], [888, 387]]) && J(sc.bars.map((b) => [b.y, b.h])) === J([[457, 22], [866, 22]]),
    'S1 lights y 70 / 479 / 888 each 387 ((1205 - 2 x 22) / 3), bars y 457 and 866 h 22');
  ok(J(sc.midRail) === J({ x: 70, y: 1275, w: 742.5, h: 50 }) && J(sc.bottomRail) === J({ x: 70, y: 2115, w: 742.5, h: 50 }), 'S1 mid rail y 1275 h 50, bottom rail y 2115 h 50');
  ok(sc.panel.y === 1325 && sc.panel.h === 790 && J(sc.panel.size) === J({ w: 769.5, h: 817, t: 30}), `S1 panel y 1325 h 790, size ${J(sc.panel.size)} (daylight + 27, 30 thick)`);
  ok(sc.unit.w === 769.5 && sc.unit.h === 1232 && sc.unit.bars.h === 2 && sc.unit.bars.v === 0 && J(sc.unit.bars.y) === J([411.5, 820.5]),
    `S1 unit 769.5 x 1232 (742.5 + 27, 1205 + 27), bars 2H at ${J(sc.unit.bars.y)} from the unit top`);
  ok(J(pw.posts[0].pockets) === J([{ side: 'right', kind: 'glass', from: 0, to: 1223, w: 18, d: 42 }, { side: 'right', kind: 'panel', from: 1237, to: 2063, w: 18, d: 42 }]),
    `P1 pockets (right side, from the post top): glass 0 to 1223, panel 1237 to 2063: ${J(pw.posts[0].pockets.map((k) => [k.kind, k.from, k.to]))}`);
  // the door
  const d = pw.doors[0];
  ok(pw.doors.length === 1 && J(d.leaf) === J({ x: 865.5, y: 73, w: 794, h: 2087, depth: 54 }), `leaf ${J(d.leaf)} (800 - 2 x 3 wide, 2095 - 3 - 5 high)`);
  ok(J(d.daylight) === J({ x: 985.5, y: 173, w: 554, h: 1102 }), `daylight ${J(d.daylight)} (794 - 2 x 120, 1250 - 100 - 48)`);
  ok(J(d.lights.map((l) => l.h)) === J([284, 387, 387]) && J(d.bars.map((b) => b.y)) === J([457, 866]), `door lights 284 / 387 / 387 top to bottom on the screen bar lines ${J(d.bars.map((b) => b.y))}`);
  ok(d.midRail.y === 1275 && d.midRail.h === 50 && d.bottomRail.y === 1980 && d.bottomRail.h === 180 && d.topRail.h === 100, 'door mid rail y 1275 h 50 (the screen line), bottom rail y 1980 h 180, top rail 100');
  ok(d.panel.h === 655 && J(d.panel.size) === J({ w: 581, h: 682, t: 30 }) && d.unit.w === 581 && d.unit.h === 1129 && J(d.unit.bars.y) === J([308.5, 717.5]),
    `door panel h 655 size ${J(d.panel.size)}; unit 581 x 1129 bars at ${J(d.unit.bars.y)}`);
  const h = d.hinges;
  ok(h.count === 3 && J(h.positions) === J([200, 943.5, 1937]) && J(h.fromFloor) === J([1892, 1148.5, 155]) && h.length === 102 && h.flap === 31 && h.knuckle === 14 && h.post === 1,
    `hinges 3 at ${J(h.positions)} from the leaf top (${J(h.fromFloor)} from the floor), 102 long, flap 31, knuckle 14, on post P2`);
  const l = d.latch;
  ok(l.fromLeafTop === 1092 && l.fromFloor === 1000 && l.backset === 57 && l.caseLength === 76 && l.axisFromFront === 37 && l.spindleFromEdge === 74 && l.post === 2,
    'latch 1092 from the leaf top (1000 from the floor), backset 57, case 76, axis 37 from the front (20 + 34 / 2), spindle 74 from the lip edge (57 + 17), keep on post P3');
  ok(d.lockEdge.lip === 20 && J(d.lockEdge.rebate) === J({ w: 17, d: 34 }) && J(d.stop) === J({ w: 17, d: 31, face: 'room', post: 2, head: { w: 17, d: 31, length: 800 } }),
    'lock edge lip 20 with a 17 x 34 rebate; the stop 17 x 31 on the room face of P3, the head stop 17 x 31 x 800 planted');
  ok(d.hingeSide === 'left' && d.swing === 'out' && d.swingFace === 'front' && d.stopFace === 'room', 'left hand, opens out: the swing face is the front (corridor), the stop face the room');
  ok(d.headEdge && d.headEdge.rebate.w === 17 && d.headEdge.rebate.d === 34, 'the leaf head carries the same 17 x 34 rebate (planted head stop)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - the dowel joints');
{
  ok(J(pw.dowels) === J({ count: 54, dia: 8, length: 40, perJoint: 3 }) && pw.joints.length === 18, `dowels ${J(pw.dowels)}, ${pw.joints.length} joints (4 posts + 2 x 2 x 2 screen rails + 2 x 3 door rails)`);
  const p1 = joint(pw, 'W-POST 1', 'top end');
  ok(p1 && J(p1.body) === J([0, 32]) && holesNear(p1.holes, [[10, 20], [22, 33], [10, 46]]) && p1.into === 'W-TOP RAIL',
    `P1 top end into the top rail: body [0, 32], the triangle ${J(p1?.holes)}`);
  const p2 = joint(pw, 'W-POST 2', 'top end');
  ok(p2 && J(p2.body) === J([18, 50]) && holesNear(p2.holes, [[28, 20], [40, 33], [28, 46]]), `P2 (hinge post, rebated on the left): body [18, 50], holes across 28 / 40 / 28: ${J(p2?.holes)}`);
  const mr = joint(pw, 'W-MID RAIL S1', 'left end');
  ok(mr && J(mr.body) === J([18, 32]) && holesNear(mr.holes, [[25, 18], [25, 33], [25, 48]]), `mid rail S1 (both edges rebated, body 14): a vertical row at across 25, depths 18 / 33 / 48: ${J(mr?.holes)}`);
  const dtr = joint(pw, 'W-DOOR TOP RAIL D1', 'hinge end');
  ok(dtr && J(dtr.body) === J([0, 82]) && holesNear(dtr.holes, [[15, 33], [41, 33], [67, 33]]) && dtr.into === 'W-DOOR STILE (HINGE)',
    `door top rail (body 82): a row of three at depth 33, across 15 / 41 / 67 (15 in from the body edges): ${J(dtr?.holes)}`);
  const dbr = joint(pw, 'W-DOOR BOTTOM RAIL D1', 'lock end');
  ok(dbr && J(dbr.body) === J([18, 180]) && holesNear(dbr.holes, [[33, 33], [99, 33], [165, 33]]) && dbr.into === 'W-DOOR STILE (LOCK)',
    `door bottom rail (body 162 above the panel rebate): a row at depth 33, across 33 / 99 / 165: ${J(dbr?.holes)}`);
  ok(pw.joints.every((j) => j.holes.length === 3 && j.dia === 8 && j.length === 40 && j.holes.every((h) => h.depth >= 12 + 4 + 2 && h.depth <= 54 - 4 - 2)),
    'every joint: three dia 8 x 40 dowels, every hole clear of the 12 front upstand and the room face');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - the records: cut list, glass units, panels, weights, consumables');
{
  const D = B.derived;
  const box = D.components.box, sash = D.components.sash;
  ok(recIs(rec(D, 'W-HEAD BOARD')[0], '20x74', 2525, 1, 'W-HB') && recIs(rec(D, 'W-END BOARD')[0], '20x74', 2145, 2, 'W-EB'), 'W-HEAD BOARD 20x74 x 2525 (1), W-END BOARD 20x74 x 2145 (2)');
  ok(recIs(rec(D, 'W-TOP RAIL')[0], '50x54', 2485, 1, 'W-TR') && recIs(rec(D, 'W-POST')[0], '50x54', 2095, 3, 'W-P') && recIs(rec(D, 'W-POST (LOCK)')[0], '67x54', 2095, 1, 'W-PL'),
    'W-TOP RAIL 50x54 x 2485, W-POST 50x54 x 2095 (3), W-POST (LOCK) 67x54 x 2095 (1)');
  const mrs = rec(D, 'W-MID RAIL'), brs = rec(D, 'W-BOTTOM RAIL');
  ok(mrs.length === 2 && mrs.every((r) => recIs(r, '50x54', 742.5, 1, 'W-MR')) && mrs[0].notes.startsWith('S1') && mrs[1].notes.startsWith('S2')
    && brs.length === 2 && brs.every((r) => recIs(r, '50x54', 742.5, 1, 'W-BR')), 'W-MID RAIL and W-BOTTOM RAIL 50x54 x 742.5, one record per screen (S1, S2)');
  ok(recIs(rec(D, 'W-BAR')[0], '22x8', 742.5, 8, 'W-GB'), 'W-BAR 22x8 x 742.5 qty 8 (2 bars x 2 faces x 2 screens)');
  const beads = rec(D, 'W-BEAD');
  const beadLens = beads.map((r) => `${r.length}x${r.quantity}`).sort().join(',');
  ok(beads.length === 8 && beads.every((r) => r.section === '18x12' && r.code === 'W-BD') && beadLens === ['1241x2', '1241x2', '778.5x2', '778.5x2', '778.5x2', '778.5x2', '826x2', '826x2'].sort().join(','),
    `W-BEAD 18x12: 778.5 x 2 per opening, 1241 (glass) and 826 (panel) verticals, mitred: ${beadLens}`);
  ok(recIs(rec(D, 'W-DOOR HEAD STOP')[0], '17x31', 800, 1, 'W-HS'), 'W-DOOR HEAD STOP 17x31 x 800');
  ok(recIs(rec(D, 'W-DOOR STILE (HINGE)')[0], '120x54', 2087, 1, 'W-DS/H') && recIs(rec(D, 'W-DOOR STILE (LOCK)')[0], '120x54', 2087, 1, 'W-DS/L'), 'W-DOOR STILE (HINGE) and (LOCK) 120x54 x 2087');
  ok(recIs(rec(D, 'W-DOOR TOP RAIL')[0], '100x54', 554, 1, 'W-DTR') && recIs(rec(D, 'W-DOOR BOTTOM RAIL')[0], '180x54', 554, 1, 'W-DBR') && recIs(rec(D, 'W-DOOR MID RAIL')[0], '50x54', 554, 1, 'W-DMR'),
    'W-DOOR TOP RAIL 100x54, BOTTOM RAIL 180x54, MID RAIL 50x54, all x 554');
  ok(recIs(rec(D, 'W-DOOR BAR')[0], '22x8', 554, 4, 'W-DGB'), 'W-DOOR BAR 22x8 x 554 qty 4');
  const dbeads = rec(D, 'W-DOOR BEAD');
  const dLens = dbeads.map((r) => `${r.length}x${r.quantity}`).sort().join(',');
  ok(dbeads.length === 4 && dbeads.every((r) => r.section === '18x12' && r.code === 'W-DBD') && dLens === ['590x2', '590x2', '1138x2', '691x2'].sort().join(','), `W-DOOR BEAD 18x12 590 / 1138 / 691: ${dLens}`);
  ok([...box, ...sash].every((r) => typeof r.code === 'string' && r.code.startsWith('W-') && r.elementName.startsWith('W-')) && box.length === 19 && sash.length === 10,
    `every record carries a W- code and a W- name (${box.length} box + ${sash.length} sash records)`);
  const u = D.customGlassUnits;
  ok(u.length === 3 && u[0].width === 769.5 && u[0].height === 1232 && u[0].role === 'screen' && u[0].location === 'screen S1' && u[1].location === 'screen S2' && u[1].width === 769.5
    && u[2].width === 581 && u[2].height === 1129 && u[2].role === 'door' && /safety glass/.test(u[2].note),
    'customGlassUnits: 769.5 x 1232 (screen S1, S2) and 581 x 1129 (door, flagged safety glass)');
  ok(D.panels.length === 3 && D.panels.filter((p) => p.w === 769.5 && p.h === 817 && p.t === 30).length === 2 && D.panels.some((p) => p.w === 581 && p.h === 682 && p.t === 30),
    'panels: two 769.5 x 817 x 30 and one 581 x 682 x 30');
  const w = D.weights;
  ok(w.leaves.length === 1 && w.leaves[0].weightKg > 45 && w.leaves[0].weightKg < 65 && w.total > 0 && w.timber > 0 && w.glass > 0 && w.panel > 0,
    `leaf weight ${w.leaves[0]?.weightKg} kg (45 to 65, the 120 kg hinge well inside), total ${w.total}`);
  ok(D.consumables.dowels.count === 54 && D.consumables.hinges.count === 3 && D.consumables.latches.count === 1 && near(D.consumables.glass.sqm, 2.55),
    `consumables: 54 dowels, 3 hinges, 1 latch, glass ${D.consumables.glass.sqm} m2`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - the lists: cut list, grouped symbols, pre-cut, glass rows, hardware');
{
  const cut = lists.buildCutListForWindow(B.derived, B.spec);
  ok(cut.length === 29 && cut.every((r) => r.material === 'Oak (solid)'), `cut list: ${cut.length} rows, every material 'Oak (solid)'`);
  const groups = lists.buildGroupedCutList(cut.map((r) => ({ ...r, windowName: 'Bay 1' })));
  const want = ['HB', 'EB', 'TR', 'P', 'PL', 'MR', 'BR', 'HS', 'DS-H', 'DS-L', 'DTR', 'DMR', 'DBR', 'GB', 'DGB', 'BD', 'DBD'];
  ok(J(groups.map((g) => g.symbol)) === J(want) && groups.every((g) => g.element && g.element.startsWith('W-')), `grouped cut list symbols ${groups.map((g) => g.symbol).join(' ')} (no ? group)`);
  ok(groups.find((g) => g.symbol === 'MR').rows.every((r) => /^S[12]/.test(r.notes)), 'the W- groups keep their notes (S1 / S2 on the mid rails)');
  const pc = lists.buildPrecutForWindow(B.derived, B.spec, {}, null);
  const g50 = pc.sashEngineering.find((g) => g.section === '50x54'), g120 = pc.sashEngineering.find((g) => g.section === '120x54');
  ok(g50 && g50.items.length === 7 && g120 && g120.items.length === 2 && pc.boxSapele.length === 0,
    `pre-cut by section: 50x54 ${g50?.items.length} items (top rail, 3 posts, 2 mid, 2 bottom rails and the door mid rail merge into 7 records), 120x54 ${g120?.items.length}; boxSapele empty`);
  ok(g50.items.every((it) => it.length === it.finishedLength + 10), 'pre-cut: every 50x54 piece 10 over its finished length (the default allowance)');
  const gl = lists.buildGlassListForWindow(B.derived, B.spec);
  ok(gl.length === 3 && gl.every((r) => r.makeup === '6/16/6' && r.bars === '2H × 0V applied' && r.barsH === 2),
    `glass rows: ${gl.length}, makeup 6/16/6, bars '2H × 0V applied'`);
  ok(J(gl[0].barAxes.y) === J([411.5, 820.5]) && J(gl[2].barAxes.y) === J([308.5, 717.5]) && gl[0].width === 769.5 && gl[0].height === 1232 && gl[2].width === 581 && gl[2].height === 1129,
    'glass rows carry barAxes.y (411.5 / 820.5 on the screens, 308.5 / 717.5 on the door) and the unit sizes');
  const hw = lists.buildHardwareList(B.spec, B.derived);
  const line = (item) => hw.find((x) => x.item === item);
  ok(line('Door hinge')?.quantity === 3 && line('Tubular latch')?.quantity === 1 && line('Lever handle set')?.quantity === 1 && line('Dowels')?.quantity === 54,
    `hardware: Door hinge 3, Tubular latch 1, Lever handle set 1, Dowels 54 (${hw.map((x) => `${x.item} ${x.quantity}`).join(', ')})`);
  ok(/Enduro/.test(line('Door hinge')?.detail || '') && /76 case, 57 backset/.test(line('Tubular latch')?.detail || '') && /1000 from the floor/.test(line('Lever handle set')?.detail || '') && /8 x 40/.test(line('Dowels')?.detail || ''),
    'the hardware details name the Enduro hinge, the 76 / 57 latch, the 1000 handle height and the 8 x 40 dowel');
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - pricing and the flat config');
{
  const c = cfg.windowSpecToConfig(B.spec);
  ok(c.windowCategory === 'partition' && c.partitionLayout === 'SDS' && c.partitionDoorWidth === 800 && c.partitionLights === 3 && c.partitionPanelHeight === 790 && c.width === 2525 && c.height === 2165,
    `windowSpecToConfig: windowCategory partition, layout SDS, door 800, lights 3, panel 790, ${c.width} x ${c.height}`);
  const p = pricing.calculatePrice(c);
  ok(p.breakdown.windowType === 'partition' && p.unitPrice === 0 && p.totalPrice === 0 && p.breakdown.doors === 1, `calculatePrice: windowType partition, unitPrice ${p.unitPrice} (placeholder rates), doors ${p.breakdown.doors}`);
  ok(pricing.DEFAULT_PRICING.partition && pricing.DEFAULT_PRICING.partition.basePerSqm === 0 && pricing.DEFAULT_PRICING.partition.doorLeafPrice === 0, 'DEFAULT_PRICING.partition { basePerSqm 0, doorLeafPrice 0 }');
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - variants and the geometry errors');
const SS = mk(2000, 2165, { partitionLayout: 'SS' }, 'SS');
const DD = mk(900, 2165, { partitionLayout: 'D' }, 'D');
const P0 = mk(2525, 2165, { ...BAY_FC, partitionPanelHeight: 0 }, 'P0');
{
  const s = SS.derived.partition;
  ok(s.doors.length === 0 && s.screens.length === 2 && s.posts.length === 3 && s.posts[1].role === 'mullion' && s.posts[1].rebated.left && s.posts[1].rebated.right,
    "SS 2000 x 2165: no door, 2 screens, 3 posts, the middle post a 'mullion' rebated both sides");
  const mj = joint(s, 'W-POST 2', 'top end');
  ok(mj && J(mj.body) === J([18, 32]) && holesNear(mj.holes, [[25, 18], [25, 33], [25, 48]]), `SS: the mullion top joint is the narrow row at across 25: ${J(mj?.holes)}`);
  ok(s.screens.every((sc) => sc.w === (2000 - 40 - 150) / 2) && s.dowels.count === 3 * (3 + 4 + 4), `SS: screens ${s.screens[0].w} wide, ${s.dowels.count} dowels`);
  const d = DD.derived.partition;
  ok(d.doors.length === 1 && d.screens.length === 0 && d.posts.length === 2 && d.doors[0].w === 760 && d.doors[0].leaf.w === 754,
    `D 900 x 2165: door only, opening ${d.doors[0].w} (900 - 40 - 100), leaf ${d.doors[0].leaf.w}, 2 posts, 0 screens`);
  ok(d.doors[0].bars.length === 2 && d.doors[0].lights.length === 3 && near(Math.max(...d.doors[0].lights.map((l) => l.h)) - Math.min(...d.doors[0].lights.map((l) => l.h)), 0, 0.2),
    `D: the door bars split its own zone into 3 equal lights ${J(d.doors[0].lights.map((l) => l.h))}`);
  ok(J(d.posts.map((p) => p.role)) === J(['hinge', 'lock']) && d.posts[1].lips.left && !rec(DD.derived, 'W-BAR').length && rec(DD.derived, 'W-DOOR BAR')[0]?.quantity === 4,
    'D: posts hinge / lock, the lock lip on P2; no screen bars, 4 door bars');
  const z = P0.derived.partition;
  ok(z.screens[0].midRail === null && z.screens[0].panel === null && z.posts[0].pockets.length === 1 && z.posts[0].pockets[0].to === 2063 && z.topRail.pockets.length === 2,
    'panelHeight 0: no mid rail or panel, one glass pocket per post down to the bottom rail (to 2063)');
  ok(z.doors[0].midRail === null && z.doors[0].panel === null && z.doors[0].zone.h === 1807 && z.doors[0].bottomRail.y === 1980 && !rec(P0.derived, 'W-MID RAIL').length && !rec(P0.derived, 'W-DOOR MID RAIL').length,
    'panelHeight 0: the door glazed to its bottom rail (zone 1807), no mid rail records');
  ok(z.screens[0].lights.length === 3 && z.screens[0].lights.every((l) => near(l.h, (2045 - 44) / 3, 0.1)) && z.dowels.count === 3 * (4 + 4 + 4), `panelHeight 0: lights ${z.screens[0].lights[0].h} high, ${z.dowels.count} dowels`);
  const HR = mk(2525, 2165, { ...BAY_FC, partitionHingeSide: 'right' });
  const hr = HR.derived.partition;
  ok(hr.doors[0].hinges.post === 2 && hr.doors[0].latch.post === 1 && hr.posts[1].lips.right === true && !hr.posts[2].lips.left && hr.posts[1].role === 'lock' && hr.posts[2].role === 'hinge',
    "hingeSide 'right': hinge post P3, lock post P2 with lips.right");
  const SI = mk(2525, 2165, { ...BAY_FC, partitionSwing: 'in' });
  const si = SI.derived.partition.doors[0];
  ok(si.swing === 'in' && si.stopFace === 'front' && si.swingFace === 'room' && si.hinges.face === 'room' && si.lockEdge.lipFace === 'room',
    "swing 'in': the stop on the front face, the knuckles and the lip on the room face");
  const thrown = (w, fc) => { try { mk(w, 2165, fc); return null; } catch (e) { return e; } };
  const e1 = thrown(1200, { partitionLayout: 'SDS' });
  ok(e1 && e1.name === 'PartitionGeometryError' && e1.details && e1.details.W === 1200 && /too narrow/.test(e1.message), `a 1200 wide SDS wall throws PartitionGeometryError with details: ${e1?.message}`);
  const e2 = thrown(2525, { ...BAY_FC, partitionLights: 20 });
  ok(e2 && e2.name === 'PartitionGeometryError' && e2.details && e2.details.lights === 20 && e2.details.zoneH === 1205, `20 lights on the bay throws with details { zoneH, lights }: ${e2?.message}`);
  ok(M.partition.PartitionGeometryError && e1 instanceof M.partition.PartitionGeometryError, 'the error class is exported from engine/partition.js');
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - controls: a casement, a sash and a door derive with no partition key');
{
  const ctl = (w, h, fc) => { const spec = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: w, height: h }, { fullConfig: fc }); return { spec, derived: calculations.deriveWindowData(spec, {}) }; };
  const cas = ctl(1200, 1200, { windowCategory: 'casement' });
  const sash = ctl(900, 1500, {});
  const door = ctl(900, 2100, { windowCategory: 'door', doorType: 'single-external' });
  ok(cas.derived.category === 'casement' && !('partition' in cas.derived) && !('partition' in cas.spec), 'casement 1200 x 1200: category casement, no partition key in the spec or in derived');
  ok(sash.derived.category === 'sash' && !('partition' in sash.derived) && !('partition' in sash.spec), 'sash 900 x 1500: category sash, no partition key');
  ok(door.derived.category === 'door' && !('partition' in door.derived) && !('partition' in door.spec) && door.derived.door.leaves.length === 1, 'door 900 x 2100: category door, one leaf, no partition key');
  ok(lists.buildHardwareList(cas.spec, cas.derived).every((x) => x.item !== 'Dowels') && lists.buildHardwareList(door.spec, door.derived).every((x) => x.item !== 'Dowels'), 'no Dowels line on a casement or a door hardware list');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - the sheets: plan, elevation, leaf, posts, members, glass; the variants');
{
  const render = (C, props) => renderToStaticMarkup(createElement(C, props));
  const LOCAL = { leaf: M.Leaf, member: M.Member };
  const Sheet = M.PartitionSheet || (({ sheet, ...rest }) => { const C = LOCAL[sheet?.sheet]; return C ? createElement(C, { ...rest, ...(sheet.props || {}) }) : null; });
  if (!hasSectionSheet) console.log('SKIP  wallsection: PartitionSection2D.jsx not written yet, the leaf and member sheets rendered without PartitionSheet.jsx');
  const sheetsOf = (spec, derived) => {
    const plan = pdu.partitionSheetPlan(derived);
    const sheets = { elevation: render(M.Elevation, { windowSpec: spec, derived, projectNumber: 'P-1' }) };
    const kinds = { elevation: 'elevation' };
    const skipped = [];
    for (const p of plan) {
      if (p.sheet === 'section' && !hasSectionSheet) { skipped.push(p.key); continue; }
      sheets[p.key] = render(Sheet, { sheet: p, windowSpec: spec, derived, projectNumber: 'P-1' });
      kinds[p.key] = p.sheet;
    }
    const groups = pdu.groupPartitionGlass(derived);
    groups.forEach((g, i) => { sheets[`glass${i}`] = render(M.Glass, { windowSpec: spec, derived, group: g }); kinds[`glass${i}`] = 'glass'; });
    return { plan, sheets, groups, skipped, kinds };
  };
  // Every sheet: no text collisions, no NaN / undefined / long dash. The dimension rule
  // (width on top, heights right, chains bottom / left) holds on the elevation, the leaf,
  // the Sections sheet and the glass drawings; the MEMBER sheets are folded CNC sheets
  // with a dimension chain under every row, so the rule's "no horizontal dims in the top
  // half" clause cannot hold for them by design: they are checked for their orientation
  // texts (ROOM / FRONT face, the end captions) and the large dims over the first row.
  const checkAll = (name, { sheets, skipped, kinds }) => {
    const col = collisionFailures(sheets);
    ok(col.length === 0, `${name}: no overlapping texts on the ${Object.keys(sheets).length} sheets`, describeFailures(col));
    const bad = Object.entries(sheets).filter(([, m]) => !/^<svg|<svg/.test(m) || /NaN|undefined|[\u2013\u2014]/.test(m)).map(([k]) => k);
    ok(bad.length === 0, `${name}: every sheet renders as svg with no NaN / undefined / long dash`, bad.join(', '));
    // the dimension rule (width on top, heights right, chains bottom / left) governs
    // the elevation, the leaf and the glass drawings; the member sheets (a chain
    // under every folded row) and the Sections sheet (detail windows with their
    // own chains under the plan) are multi-detail sheets outside it
    const ruled = Object.entries(sheets).filter(([k]) => kinds[k] !== 'member' && kinds[k] !== 'section');
    const dimBad = ruled.map(([k, m]) => [k, checkDimRule(m)]).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.why}`);
    ok(dimBad.length === 0, `${name}: the elevation, leaf and glass sheets keep the dimension rule (${ruled.map(([k]) => k).join(', ')})`, dimBad.join(' | '));
    const secs = Object.entries(sheets).filter(([k]) => kinds[k] === 'section');
    const secBad = secs.filter(([, m]) => !/PLAN 1:1/.test(m) || !/SCREEN: HEAD|DOOR: HEAD/.test(m)).map(([k]) => k);
    ok(secBad.length === 0, `${name}: the Sections sheet prints the plan caption and a head detail (screen or door)`, secBad.join(', '));
    const members = Object.entries(sheets).filter(([k]) => kinds[k] === 'member');
    const faceBad = members.filter(([, m]) => !/ROOM face|FRONT face/.test(m)).map(([k]) => k);
    ok(faceBad.length === 0, `${name}: every member sheet names its shown face (ROOM face / FRONT face)`, faceBad.join(', '));
    // posts and stiles: TOP end; the top rail and screen rails: LEFT end; the door rails name their ends HINGE / LOCK end (left) / (right)
    const endBad = members.filter(([k, m]) => !(/wallpost|wallstiles/.test(k) ? /TOP end/.test(m) : /LEFT end|end \(left\)/.test(m))).map(([k]) => k);
    ok(endBad.length === 0, `${name}: every member sheet prints its end captions (TOP end on posts and stiles, LEFT end or HINGE / LOCK end (left) on rails)`, endBad.join(', '));
    const bigBad = members.filter(([, m]) => { const r = checkDimRule(m); return !(r.widthY > 0) || !(r.heightX > 0) || !/face \d/.test(m); }).map(([k]) => k);
    ok(bigBad.length === 0, `${name}: every member sheet carries a large upright length dim over the first row and a large rotated 'face N' dim at its right`, bigBad.join(', '));
    if (skipped.length) ok(false, `${name}: wallsection sheet missing (PartitionSection2D.jsx not written yet)`);
    else ok(/<svg/.test(sheets.wallsection || '') && !/Not drawn yet/.test(sheets.wallsection || ''), `${name}: the Sections sheet is an svg drawing`);
  };
  // the bay
  const R0 = sheetsOf(B.spec, B.derived);
  ok(J(R0.plan.map((p) => p.key)) === J(['wallleaf-1', 'wallpost-1-4', 'wallpost-2', 'wallpost-3', 'walltoprail', 'wallrails', 'wallstiles-1', 'walldoorrails-1', 'wallsection']),
    `bay sheet plan: ${R0.plan.map((p) => p.key).join(', ')}`);
  ok(J(R0.plan.map((p) => p.label)) === J(['Door Leaf', 'End Posts P1, P4', 'Hinge Post P2', 'Lock Post P3', 'Top Rail', 'Screen Rails', 'Door Stiles', 'Door Rails', 'Sections']),
    `bay sheet labels: ${R0.plan.map((p) => p.label).join(' | ')}`);
  const pg = pdu.postGroups(pw);
  ok(pg.length === 3 && J(pg[0].posts) === J([0]) && J(pg[0].mirrored) === J([3]) && pg[0].key === '1-4' && pg[1].key === '2' && pg[2].key === '3', 'postGroups: P1 and P4 share one sheet as mirror images, P2 and P3 their own');
  checkAll('bay', R0);
  const sh = R0.sheets;
  ok(['2525', '2165', '742.5', 'handle 1000', 'Layout SDS'].every((t) => sh.elevation.includes(t)), "the elevation prints 2525, 2165, 742.5, 'handle 1000' and the layout");
  ok(['794', '2087', '554', '200', '943.5', '1937', 'Unit 581 x 1129', 'PANEL 581 × 682'].every((t) => sh['wallleaf-1'].includes(t)), 'the leaf sheet prints 794 x 2087, the daylight 554, the hinges 200 / 943.5 / 1937, the unit 581 x 1129 and the panel 581 × 682');
  // the end views list every hole as "n: across / depth" and the table row as "(across, depth)" pairs
  const holeTexts = (m, holes) => holes.every(([a, d], i) => m.includes(`${i + 1}: ${a} / ${d}`)) && m.includes(holes.map(([a, d]) => `(${a}, ${d})`).join(' '));
  ok(sh['wallpost-1-4'].includes('P1') && sh['wallpost-1-4'].includes('P4') && /mirror image/.test(sh['wallpost-1-4']) && holeTexts(sh['wallpost-1-4'], [[10, 20], [22, 33], [10, 46]]),
    'the end post sheet prints P1 and P4 (mirror) and the three dowel coordinates 10 / 20, 22 / 33, 10 / 46');
  ok(holeTexts(sh['wallpost-2'], [[28, 20], [40, 33], [28, 46]]) && sh['wallpost-2'].includes('hinge 1 recess 102 x 31 x 3') && sh['wallpost-2'].includes('hinge 3 recess 102 x 31 x 3'),
    'the hinge post sheet prints the rebated joint holes 28 / 40 / 28 and the three hinge recesses');
  ok(/stop lip 17 x 31 from solid/.test(sh['wallpost-3']) && /keep plate 57 x 25 x 2/.test(sh['wallpost-3']) && sh['wallpost-3'].includes('67x54') && /latch bolt pocket 16 x 16, 15 deep/.test(sh['wallpost-3']),
    'the lock post sheet prints the stop lip from solid, the keep plate, the keep bolt pocket and the 67x54 blank');
  ok(/glass pocket S1 778.5 x 18/.test(sh.walltoprail) && /glass pocket S2 778.5 x 18/.test(sh.walltoprail) && /head stop D1 planted 17 x 31 x 800/.test(sh.walltoprail) && /post P1: 3 dowel holes dia 8 x 20 in the underside, \(10, 20\) \(22, 33\) \(10, 46\)/.test(sh.walltoprail),
    'the top rail sheet prints both stopped pockets 778.5 x 18, the planted head stop and the post dowel holes in the underside');
  ok(holeTexts(sh.wallrails, [[25, 18], [25, 33], [25, 48]]) && holeTexts(sh.wallrails, [[28, 20], [40, 33], [28, 46]]) && /through rebate 18 x 42 on the bottom edge \(panel\)/.test(sh.wallrails),
    'the screen rails sheet prints the narrow mid rail row 25 / 18 / 33 / 48, the bottom rail triangle and the through rebates');
  ok(/lock edge rebate 17 x 34/.test(sh['wallstiles-1']) && /74 from the lock edge/.test(sh['wallstiles-1']) && /hinge 3 recess 102 x 31 x 3/.test(sh['wallstiles-1']) && /\(15, 33\) \(41, 33\)/.test(sh['wallstiles-1']) && /\(1227, 18\)/.test(sh['wallstiles-1']),
    'the door stiles sheet prints the lock edge rebate, the spindle 74 from the lock edge, the hinge recesses and the rail dowel holes in the glass edge');
  ok(holeTexts(sh['walldoorrails-1'], [[15, 33], [41, 33], [67, 33]]) && holeTexts(sh['walldoorrails-1'], [[33, 33], [99, 33], [165, 33]]) && /head rebate 17 x 34/.test(sh['walldoorrails-1']) && sh['walldoorrails-1'].includes('180x54'),
    'the door rails sheet prints the wide row joints (15 / 41 / 67 and 33 / 99 / 165), the head rebate and the 180x54 bottom rail');
  ok(R0.groups.length === 2 && R0.groups[0].w === 769.5 && R0.groups[0].h === 1232 && R0.groups[0].panes.length === 2 && R0.groups[1].w === 581 && R0.groups[1].h === 1129,
    'groupPartitionGlass: 769.5 x 1232 (2 panes) and 581 x 1129');
  ok(sh.glass0.includes('769.5 × 1232') && sh.glass1.includes('581 × 1129'), 'the glass drawings print 769.5 × 1232 and 581 × 1129');
  // the variants through the same checks
  const RS = sheetsOf(SS.spec, SS.derived);
  ok(J(RS.plan.map((p) => p.key)) === J(['wallpost-1-3', 'wallpost-2', 'walltoprail', 'wallrails', 'wallsection']), `SS sheet plan: ${RS.plan.map((p) => p.key).join(', ')} (no leaf, no stiles)`);
  checkAll('SS 2000 x 2165', RS);
  const RD = sheetsOf(DD.spec, DD.derived);
  ok(J(RD.plan.map((p) => p.key)) === J(['wallleaf-1', 'wallpost-1', 'wallpost-2', 'walltoprail', 'wallstiles-1', 'walldoorrails-1', 'wallsection']), `D sheet plan: ${RD.plan.map((p) => p.key).join(', ')} (no screen rails)`);
  checkAll('D 900 x 2165', RD);
  const RP = sheetsOf(P0.spec, P0.derived);
  ok(J(RP.plan.map((p) => p.key)) === J(R0.plan.map((p) => p.key)), 'panelHeight 0: the same sheet plan as the bay');
  checkAll('panelHeight 0', RP);
  ok(!/PANEL/.test(RP.sheets.elevation) && /PANEL/.test(sh.elevation), 'the elevation draws the PANEL label only with a panel');
}

console.log(`\nt50: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
