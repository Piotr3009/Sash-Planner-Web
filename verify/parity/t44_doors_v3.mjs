/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t44: doors v3 (owner box, Piotr 09.10.2026): the casement rules inside the door
 * frame. The 3.10 reference table of the tura brief is typed here as LITERALS and
 * checked against the live engine to 0.01, then the thresholds, the threshold seal,
 * the vents, the handing strings, the schema 2 to 3 migration, the casement / sash
 * controls against the start of this tura, the Assign Materials rows and their
 * counterpart defaults, and the door BOM part quantities of the reference set.
 *
 *   single 900 x 2100 (any threshold, any direction): leaf 798 x 1998, glass 633 x 1747
 *   half-glazed: mid rail axis 999, glass 633 x 881, panel 644 x 806 (daylight 610 x 772 + 2 x 17)
 *   french 1600 x 2100: 2 x 755 x 1998, glass 584 x 1747 (half 749, lip 6, meeting 100)
 *   french 2400 x 2400, side panels 400 + 400, opening fan T 450:
 *     door leaves 2 x 789 x 1882 (zone 1600 between the mullion axes, half (1600 - 34) / 2 = 783)
 *     glass 618 x 1631; side lights 332 x 1882, glass 227 x 1661
 *     fan leaves 1566 x 385 over the door, 332 x 385 over each side (casement rule glass)
 *     fixed fan: the same sizes, no hardware, glass W - 105, H - 108
 *     mullions 2400 - 77 = 2323; transom segments 332 + 8.5, 1566 + 8.5, 332 + 8.5; band 442 / 21
 *
 *   1  profile schema 3 and the 3.10 table
 *   2  thresholds and the threshold seal
 *   3  trickle vents by room type
 *   4  handing strings
 *   5  migration schema 2 -> 3 (defaults move, hand edits stay), batch snapshot
 *   6  controls: casement and sash equal to the start of this tura
 *   7  Assign Materials rows and the counterpart defaults
 *   8  door BOM part quantities of the reference set
 *   9  the shared casement rules and the visible openings
 *  10  guards: a door frame that leaves no leaf or light raises DoorGeometryError (the
 *      per-window error of the pages), at least 3 hinges a leaf (box 12), one batch
 *      type mapping ('door' reads as 'doors', box 15)
 *
 * Run: node verify/parity/t44_doors_v3.mjs [start]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

// The start of the doors v3 tura (main with PR #14 and the brief).
const startHash = process.argv[2] || '150500eee17c7376278545ccad6e6c8ec64fd94d';
function treeOf(hash) {
  const tag = `t44-start-${hash.slice(0, 12)}`;
  const tree = resolve(AUDIT, `${tag}-tree`);
  rmSync(tree, { recursive: true, force: true });
  mkdirSync(tree, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${hash} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });
  return { tag, tree };
}
const startTree = treeOf(startHash);

function bundle(srcRoot, name) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    ...['specification', 'calculations', 'lists', 'bom', 'profile', 'partSymbols', 'partColours', 'partRegistry', 'doorHardware'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    `export * as store from '${rel('stores/materialAssignmentStore.js')}';`,
    ...(srcRoot === resolve(ROOT, 'src') ? [`export * as boundary from '${rel('utils/windowBoundary.js')}';`, `export { batchTypeKey, batchDefaultsFor } from '${rel('stores/projectStore.js')}';`] : []),
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist|Calc failed/i.test(String(a[0]))) return; warn(...a); };

const LIVE = await bundle(resolve(ROOT, 'src'), 't44-live');
const START = await bundle(resolve(startTree.tree, 'src'), startTree.tag);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.01) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const sizeIs = (o, w, h) => !!o && near(o.w ?? o.width, w) && near(o.h ?? o.height, h);

const { specification, calculations, lists, bom, profile, store } = LIVE;
const DP = profile.DEFAULT_DOOR_PROFILE;
const mk = (M, w, h, fc, extra = {}) => {
  const spec = M.specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: w, height: h, ...extra }, { fullConfig: fc });
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const door = (w, h, fc = {}) => mk(LIVE, w, h, { windowCategory: 'door', doorType: 'single-external', ...fc });
const french = (w, h, fc = {}) => door(w, h, { doorType: 'french', ...fc });
const recs = (d, name) => [...(d.components.box || []), ...(d.components.sash || []), ...(d.components.beading || [])].filter((r) => r.elementName === name);
const pq = (x) => bom.buildWindowPartQtys(x.derived, x.spec, {});
const BIG = { sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'opening', transomHeight: 450 };

// ═════════════════════════════════════════════════════════════════════════════
section('1 - profile schema 3 and the 3.10 table');
{
  const d = DP.deductions, g = DP.geometry, L = DP.lengths;
  ok(DP.schema === 3, `schema ${DP.schema}`);
  ok(d.leafAtFloor === 51 && d.fanFromAxis === 65 && d.leafBelowAxis === 17 && d.leafAtJamb === 51 && d.leafAtMullionAxis === 17,
    'deductions: leafAtFloor 51, fanFromAxis 65, leafBelowAxis 17, leafAtJamb 51, leafAtMullionAxis 17');
  ok(g.transomLandAbove === 8 && g.transomLandBelow === 13 && g.gapFanTransom === 6 && g.gapBelowTransom === 4 && g.mullionLand === 26,
    'geometry: transom land 8 above / 13 below, gaps 6 / 4, mullion land 26');
  ok(L.transomSeat === 8.5 && L.mullion === 77 && !('transomDeduct' in L), 'lengths: transomSeat 8.5, mullion 77 (transomDeduct retired)');
  ok(DP.panel.inset === 17 && DP.panel.edge.tongue === 24 && DP.panel.edge.slope === 40 && DP.panel.edge.flat === 15, 'panel: inset 17, edge 24 / 40 / 15');
  ok(JSON.stringify(DP.sidePanel) === JSON.stringify({ stile: 64, top: 64, bottom: 180, depth: 57 }) && JSON.stringify(DP.fixedFan) === JSON.stringify({ stile: 64, top: 64, bottom: 67 }),
    'sidePanel {64, 64, 180, 57}, fixedFan {64, 64, 67}');
  ok(d.leafFullHeight === 102 && d.leafNoThreshold === 102 && DP.couplingPost.width === 136, 'kept for stored copies, not read: leafFullHeight / leafNoThreshold 102, couplingPost 136');

  // 3.10, row by row, to 0.01
  const S = door(900, 2100);
  ok(sizeIs(S.derived.door.leaves[0], 798, 1998) && sizeIs(S.derived.customGlassUnits[0], 633, 1747), 'single 900 x 2100 timber cill outward: leaf 798 x 1998, glass 633 x 1747');
  const A = door(900, 2100, { thresholdType: 'aluminium' });
  ok(sizeIs(A.derived.door.leaves[0], 798, 1998) && sizeIs(A.derived.customGlassUnits[0], 633, 1747), 'single aluminium threshold: 798 x 1998, glass 633 x 1747');
  const I = door(900, 2100, { doorOpenDirection: 'inward' });
  ok(sizeIs(I.derived.door.leaves[0], 798, 1998) && sizeIs(I.derived.customGlassUnits[0], 633, 1747) && recs(I.derived, 'D-FRAME CILL (INWARD)')[0]?.section === '40x93',
    'single inward: 798 x 1998, glass 633 x 1747, timber inward cill 40');
  const H = door(900, 2100, { doorStyle: 'half-glazed' });
  const pn = H.derived.door.panels[0];
  ok(sizeIs(H.derived.door.leaves[0], 798, 1998) && sizeIs(H.derived.customGlassUnits[0], 633, 881) && near(H.derived.door.zones.midRailAxis, 999)
    && sizeIs(pn, 644, 806) && sizeIs(pn.daylight, 610, 772) && near(pn.w - pn.daylight.w, 34) && near(pn.h - pn.daylight.h, 34),
    'half-glazed: mid rail axis 999, glass 633 x 881, panel 644 x 806 = daylight 610 x 772 + 2 x 17');
  const F = french(1600, 2100);
  ok(F.derived.door.leaves.every((l) => sizeIs(l, 755, 1998)) && F.derived.customGlassUnits.every((u) => sizeIs(u, 584, 1747)) && F.derived.door.half === 749 && F.derived.door.lip === 6 && F.derived.door.members.meeting === 100,
    'french 1600 x 2100: 2 x 755 x 1998, glass 584 x 1747, half 749, lip 6, meeting stile 100');
  const B = french(2400, 2400, BIG);
  const bd = B.derived.door;
  ok(bd.leaves.length === 2 && bd.leaves.every((l) => sizeIs(l, 789, 1882)) && bd.leaves.every((l) => sizeIs(l.glass, 618, 1631)) && near(bd.half, 783) && near(bd.zones.doorW, 1600),
    'french 2400 x 2400, sides 400 + 400, T 450: door leaves 2 x 789 x 1882, glass 618 x 1631, zone 1600, half 783');
  ok(bd.sidePanels.length === 2 && bd.sidePanels.every((p) => sizeIs(p, 332, 1882) && sizeIs(p.glass, 227, 1661) && p.fixed === true),
    'the same: side panel lights 332 x 1882 (400 - 51 - 17; H - T - 17 - 51), glass 227 x 1661');
  const fd = Object.fromEntries(bd.fanLeaves.map((f) => [`${f.over}${f.side ? '-' + f.side : ''}`, f]));
  const cg = profile.casementGlassDeductions(profile.DEFAULT_CASEMENT_PROFILE);
  ok(bd.fanLeaves.length === 3 && sizeIs(fd.door, 1566, 385) && sizeIs(fd['panel-left'], 332, 385) && sizeIs(fd['panel-right'], 332, 385) && bd.fanLeaves.every((f) => f.fixed === false && f.hinge === 'top'),
    'the same: opening fan leaves 1566 x 385 over the door, 332 x 385 over each side');
  ok(bd.fanLeaves.every((f) => near(f.glass.w, f.w - cg.width) && near(f.glass.h, f.h - cg.height)) && sizeIs(fd.door.glass, 1461, 277),
    'the same: fan glass by the casement rule (W - 105, H - 108): 1461 x 277 over the door');
  ok(bd.mullions.length === 2 && bd.mullions.every((m) => near(m.length, 2323)) && near(bd.mullions[0].axisX, 400) && near(bd.mullions[1].axisX, 2000)
    && recs(B.derived, 'D-MULLION').length === 2 && recs(B.derived, 'D-MULLION').every((r) => r.section === '68x93' && near(r.length, 2323)),
    'the same: mullions at 400 and 2000, L = 2400 - 77 = 2323 (68x93)');
  const seg = bd.transom.segments.map((s) => s.length);
  ok(JSON.stringify(seg) === JSON.stringify([340.5, 1574.5, 340.5]) && recs(B.derived, 'D-TRANSOM').map((r) => r.length).join(',') === '340.5,1574.5,340.5'
    && near(bd.transom.band.y, 442) && near(bd.transom.band.h, 21) && near(bd.transom.axisT, 450),
    'the same: transom segments 340.5 / 1574.5 / 340.5 (field leaf W + 8.5), band y 442 h 21 (axis 450 - 8, + 13)');
  const BF = french(2400, 2400, { ...BIG, transomType: 'fixed' });
  const ff = BF.derived.door.fanLeaves;
  ok(ff.length === 3 && ff.every((f) => f.fixed === true && f.hinge === 'fixed' && f.members.stile === 64 && f.members.bottom === 67) && ff.every((f, i) => sizeIs(f, bd.fanLeaves[i].w, bd.fanLeaves[i].h))
    && ff.every((f) => near(f.glass.w, f.w - 105) && near(f.glass.h, f.h - 108)) && !BF.derived.door.hardware.fan,
    'the same with a fixed fan: the same three sizes, 64 / 64 / 67 non-opening leaves, glass W - 105 x H - 108, no hardware');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - thresholds and the threshold seal');
{
  for (const dir of ['outward', 'inward']) {
    for (const thr of ['standard', 'aluminium', 'low-profile']) {
      const x = door(900, 2100, { thresholdType: thr, doorOpenDirection: dir });
      const dr = x.derived.door, ti = dr.thresholdInfo;
      const timber = dir === 'inward' || thr === 'standard';
      ok(dr.leafH === 1998 && near(dr.leaves[0].y, 51) && near(dr.leaves[0].y + dr.leaves[0].h, 2100 - 51),
        `${dir} ${thr}: leaf H 1998, the leaf bottom 51 above the floor`);
      ok(ti.type === thr && ti.effectiveType === (dir === 'inward' ? 'standard' : thr) && ti.timberCill === timber && dr.hasTimberCill === timber && ti.ignored === (dir === 'inward' && thr !== 'standard'),
        `${dir} ${thr}: effective ${ti.effectiveType}, timber cill ${timber}${ti.ignored ? ', the stored value ignored' : ''}`);
      const q = pq(x);
      const sealM = q.d_threshold_seal?.qty;
      const product = Object.keys(q).filter((k) => /^d_threshold_(alu|low)_/.test(k));
      ok(timber ? (!sealM && !product.length) : (near(sealM, 0.81) && q.d_threshold_seal.unit === 'm' && product.length === 1 && q[product[0]].qty === 1),
        `${dir} ${thr}: ${timber ? 'no threshold product, no seal' : `threshold ${product[0]} 1 pc + seal ${sealM} m (900 - 2 x 47 = 806 mm)`}`);
      const hw = lists.buildHardwareList(x.spec, x.derived);
      ok(hw.filter((l) => l.item === 'Threshold seal').length === (timber ? 0 : 1), `${dir} ${thr}: the threshold seal line on the hardware list ${timber ? 'absent' : 'once'}`);
      ok(timber ? !!recs(x.derived, dir === 'inward' ? 'D-FRAME CILL (INWARD)' : 'D-FRAME CILL').length : !recs(x.derived, 'D-FRAME CILL').length,
        `${dir} ${thr}: ${timber ? 'the timber cill on the cut list' : 'no timber cill'}`);
    }
  }
  const ia = door(900, 2100, { thresholdType: 'aluminium', doorOpenDirection: 'inward' });
  ok(ia.derived.door.thresholdInfo.note === 'inward door: timber threshold', 'inward + aluminium: the note "inward door: timber threshold"');
  const fa = french(1600, 2100, { thresholdType: 'low-profile' });
  ok(near(pq(fa).d_threshold_seal?.qty, 1.51) && pq(fa).d_threshold_low_double?.qty === 1, 'french low-profile: the double threshold + seal 1.51 m (1600 - 2 x 47 = 1506)');
  const ba = french(2400, 2400, { ...BIG, thresholdType: 'aluminium' });
  ok(near(ba.derived.door.thresholdInfo.openingWidth, 1574) && near(pq(ba).d_threshold_seal?.qty, 1.57) && ba.derived.door.mullions.every((m) => near(m.length, 2400 - (77 - 41)) && m.timberCill === false),
    'side panels + aluminium: the seal spans the door opening between the mullion lands (2000 - 13 - 413 = 1574 mm), the mullions run to the floor (2400 - 36 = 2364)');
  ok(ba.derived.door.sidePanels.every((p) => sizeIs(p, 332, 1882)), 'side panels never take a threshold: their lights keep the floor rule');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - trickle vents by room type');
{
  const cases = [['habitable', true, 2], ['habitable', false, 1], ['kitchen', true, 2], ['kitchen', false, 1], ['bathroom', true, 1], ['other', true, 0]];
  const IRN = [{ id: 'irn-vent', name: 'Trickle vent 400', unit: 'pcs', cost_per_unit: 5 }];
  for (const [room, sole, n] of cases) {
    const x = door(900, 2100, { ventRoomType: room, ventSoleWindow: sole });
    const hw = lists.buildHardwareList(x.spec, x.derived);
    const vent = hw.find((l) => l.item === 'Trickle vents');
    ok(n ? vent?.quantity === n && !vent.enginePart : !vent, `${room}${sole ? '' : ' (not the only window)'}: ${n} vents on the hardware list (the window rule, lists.buildVentGrilles = ${lists.buildVentGrilles(x.spec)})`);
    const spec = { ...x.spec, hardware: { ...x.spec.hardware, slots: { ...(x.spec.hardware?.slots || {}), trickleVents: 'irn-vent' } } };
    const lines = bom.buildWindowMaterialLines({ derived: x.derived, windowSpec: spec, batch: null },
      { assignments: {}, assignmentsData: { schema: 2, base: {}, overrides: {} }, materials: [], ALL_PARTS: store.ALL_PARTS, ironmongeryItems: IRN, settings: {} });
    const bl = lines.find((l) => l.key === 'irn:irn-vent');
    ok(n ? bl?.qty === n : !bl, `${room}${sole ? '' : ' (not the only window)'}: the BOM buys ${n} of the trickleVents slot product`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - handing strings');
{
  const H = (fc) => door(900 + (fc.doorType === 'french' ? 700 : 0), 2100, fc).derived.door;
  const cases = [
    [{}, 'Hinge left · opens outward', 'RH'],
    [{ doorHinge: 'right' }, 'Hinge right · opens outward', 'LH'],
    [{ doorOpenDirection: 'inward' }, 'Hinge left · opens inward', 'LH'],
    [{ doorHinge: 'right', doorOpenDirection: 'inward' }, 'Hinge right · opens inward', 'RH'],
    [{ doorType: 'french', lockType: 'double' }, 'Hinge left · opens outward', 'RH'],
    [{ doorType: 'french', lockType: 'single', doorHinge: 'right' }, 'Hinge right · opens outward', 'LH'],
  ];
  for (const [fc, label, kit] of cases) {
    const dr = H(fc);
    const all = JSON.stringify(dr.hardware.detail);
    ok(dr.hardware.handing === label && dr.handing.label === label && dr.handing.hinge === (fc.doorHinge || 'left') && dr.handing.opens === (fc.doorOpenDirection || 'outward') && dr.hardware.kitHanding === kit,
      `${JSON.stringify(fc)}: printed "${label}", internal kit handing ${kit}`);
    ok(all.includes(label) && !/clockwise|\bLH\b|\bRH\b/.test(all), `${JSON.stringify(fc)}: the detail and variant print the label, no Winkhaus words`);
  }
  ok(LIVE.doorHardware.HANDING_WORDS === undefined && typeof LIVE.doorHardware.doorHanding === 'function' && LIVE.doorHardware.doorHandingLabel('left', false) === 'Hinge left · opens outward',
    'HANDING_WORDS removed, doorHanding kept internal, doorHandingLabel prints the PSW wording');
  const hints = JSON.stringify(LIVE.doorHardware.DOOR_HARDWARE_PARTS);
  ok(!/clockwise/.test(hints), 'the Assign Materials hints no longer print the Winkhaus words');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - migration schema 2 -> 3, batch snapshot');
{
  const mig = profile.migrateDoorProfile;
  const s2 = clone(START.profile.DEFAULT_DOOR_PROFILE);
  ok(s2.schema === 2 && s2.deductions.leafFullHeight === 98 && s2.deductions.leafNoThreshold === 57 && s2.sidePanel.member === 57, 'START tree: the schema-2 default (98 / 57, side member 57)');
  const m = mig(s2);
  ok(m.schema === 3 && m.deductions.leafFullHeight === 102 && m.deductions.leafNoThreshold === 102, 'schema-2 defaults move: leafFullHeight 98 -> 102, leafNoThreshold 57 -> 102');
  const READ = ['frameDepth', 'leafDepth', 'leafDepthTriple', 'elements', 'cillInward', 'frenchLip', 'fixedFan', 'panel', 'geometry', 'hinges', 'hardware'];
  ok(READ.every((k) => JSON.stringify(m[k]) === JSON.stringify(DP[k])), 'a migrated schema-2 default equals the schema-3 default on every block the engine reads', READ.filter((k) => JSON.stringify(m[k]) !== JSON.stringify(DP[k])).join(', '));
  ok(['stile', 'top', 'bottom', 'depth'].every((k) => m.sidePanel[k] === DP.sidePanel[k]) && m.sidePanel.member === 57
    && Object.keys(DP.deductions).every((k) => m.deductions[k] === DP.deductions[k]) && m.deductions.fanAtHead === 51
    && Object.keys(DP.lengths).every((k) => m.lengths[k] === DP.lengths[k]) && m.lengths.transomDeduct === 136,
    'the new keys take the defaults; the keys no longer read (member, fanAtHead / fanAtRail, transomDeduct) stay as stored');
  const hand = clone(s2); hand.deductions.leafFullHeight = 100; hand.elements.leafStile.face = 96; hand.panel.coreThickness = 12; hand.sidePanel.member = 60;
  const mh = mig(hand);
  ok(mh.deductions.leafFullHeight === 100 && mh.elements.leafStile.face === 96 && mh.panel.coreThickness === 12 && mh.panel.inset === 17 && mh.deductions.leafNoThreshold === 102,
    'hand edits stay (leafFullHeight 100, stile 96, core 12), untouched old defaults still move, new keys fill');
  ok(mh.sidePanel.member === 60 && mh.sidePanel.stile === 64 && mh.sidePanel.bottom === 180, 'a hand-edited side member stays stored but the light takes 64 / 64 / 180 (BLOCKERS 31)');
  ok(JSON.stringify(mig(m)) === JSON.stringify(m), 'migration is idempotent');
  // a batch frozen on schema 2 (_profileSnapshot.door) derives with the v3 rules
  const inside = profile.withProfiles(null, null, s2, () => door(900, 2100).derived.door.leafH);
  ok(inside === 1998, `withProfiles with a schema-2 snapshot: leaf H ${inside} (the snapshot migrates when read)`);
  const snapE = clone(s2); snapE.deductions.leafAtJamb = 55;
  ok(profile.withProfiles(null, null, snapE, () => door(900, 2100).derived.door.leafW) === 900 - 110, 'a snapshot edit (leafAtJamb 55) still applies: leaf W 790');
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - controls: casement and sash equal to the start of this tura');
{
  const LT = await import(pathToFileURL(resolve(ROOT, 'src/engine/casementLayouts.js')).href);
  const CTL = [];
  for (const c of Object.keys(LT.LAYOUT_DEFAULTS)) {
    const { w, h } = LT.LAYOUT_DEFAULTS[c];
    CTL.push([`casement ${c} ${w} x ${h}`, w, h, { windowCategory: 'casement', casementLayout: c, casementHBars: 1, casementVBars: 1, casementFanVBars: 1 }]);
  }
  CTL.push(['casement fixed 800 x 900', 800, 900, { windowCategory: 'casement', casementKind: 'fixed' }]);
  CTL.push(['casement 040D triple glass', 1200, 1200, { windowCategory: 'casement', casementLayout: '040D' }, { glassType: 'triple' }]);
  CTL.push(['casement 052L 1234.5 x 1677', 1234.5, 1677, { windowCategory: 'casement', casementLayout: '052L' }]);
  for (const [w, h] of [[1000, 1400], [900, 1800]]) for (const bars of ['none', '2x2', '6x6']) CTL.push([`sash ${w} x ${h} ${bars}`, w, h, { windowCategory: 'sash' }, { upperBars: bars, lowerBars: bars }]);
  CTL.push(['sash cottage 1000 x 1400', 1000, 1400, { windowCategory: 'sash' }, { sashProportion: 'cottage-40-60' }]);
  let same = 0;
  const diffs = [];
  // the same tura's sash items (box items 16 / 17): every windowSpec carries grid.upper / grid.lower, a sash
  // derive carries derived.bars, no derive carries glazingItems; with the same pattern on both sashes these
  // only reorganise data (t45 checks them); everything else byte for byte
  const specOf = (sp) => { const c = clone(sp); if (c.sash?.grid) { delete c.sash.grid.upper; delete c.sash.grid.lower; } return c; };
  const derOf = (d) => { const c = { ...d }; delete c.bars; delete c.glazingItems; return c; };
  for (const [name, w, h, fc, extra] of CTL) {
    const a = mk(LIVE, w, h, fc, extra), b = mk(START, w, h, fc, extra);
    a.spec = specOf(a.spec); a.derived = derOf(a.derived); b.derived = derOf(b.derived);
    const A = JSON.stringify([a.spec, a.derived, lists.buildCutListForWindow(a.derived, a.spec), lists.buildGlassListForWindow(a.derived, a.spec), lists.buildPrecutForWindow(a.derived, a.spec, {}, null), lists.buildHardwareList(a.spec, a.derived), bom.buildWindowPartQtys(a.derived, a.spec, {})]);
    const Bs = JSON.stringify([b.spec, b.derived, START.lists.buildCutListForWindow(b.derived, b.spec), START.lists.buildGlassListForWindow(b.derived, b.spec), START.lists.buildPrecutForWindow(b.derived, b.spec, {}, null), START.lists.buildHardwareList(b.spec, b.derived), START.bom.buildWindowPartQtys(b.derived, b.spec, {})]);
    if (A === Bs) same += 1; else diffs.push(name);
  }
  ok(same === CTL.length, `${same} / ${CTL.length} casement and sash windows: windowSpec, derived, cut list, glass list, pre-cut, hardware list and BOM part quantities byte-identical to the start`, diffs.join(', '));
  ok(JSON.stringify(profile.DEFAULT_CASEMENT_PROFILE) === JSON.stringify(START.profile.DEFAULT_CASEMENT_PROFILE) && JSON.stringify(profile.DEFAULT_SASH_PROFILE) === JSON.stringify(START.profile.DEFAULT_SASH_PROFILE),
    'casement and sash default profiles equal to the start');
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - Assign Materials rows and the counterpart defaults');
{
  const ids = store.DOOR_ALL_PARTS.map((p) => p.id);
  const startIds = START.store.DOOR_ALL_PARTS.map((p) => p.id);
  ok(JSON.stringify(ids.slice(0, startIds.length)) === JSON.stringify(startIds), `the ${startIds.length} door rows of the start keep their order; the v3 rows follow (index-based sets keep their rows)`);
  ok(JSON.stringify(ids.slice(startIds.length)) === JSON.stringify(['d_threshold_seal', 'd_mullion', 'd_fan_fixed_stile', 'd_fan_fixed_top_rail', 'd_fan_fixed_bottom_rail']), `v3 rows: ${ids.slice(startIds.length).join(', ')}`);
  const all = store.ALL_PARTS.map((p) => p.id);
  ok(JSON.stringify(all.slice(0, START.store.ALL_PARTS.length)) === JSON.stringify(START.store.ALL_PARTS.map((p) => p.id)), 'ALL_PARTS: every earlier row at its index');
  const byId = Object.fromEntries(store.ALL_PARTS.map((p) => [p.id, p]));
  ok(byId.d_threshold_seal.unit === 'm' && byId.d_threshold_seal.defaultCategory === 'thresholds' && !LIVE.doorHardware.DOOR_PART_SLOT.d_threshold_seal,
    'threshold seal: metres, opens on the thresholds tab, no per-window slot (the window threshold product never replaces it)');
  const FROM = LIVE.partRegistry.PART_DEFAULT_FROM;
  const sorted = (o) => JSON.stringify(Object.entries(o).sort());
  ok(sorted(FROM) === sorted(Object.fromEntries(store.DOOR_ALL_PARTS.filter((p) => p.defaultFrom).map((p) => [p.id, p.defaultFrom])))
    && Object.values(FROM).every((id) => byId[id]),
    `the store rows' defaultFrom agree with partRegistry.PART_DEFAULT_FROM (${Object.keys(FROM).length} rows), every counterpart exists`);
  ok(FROM.d_mullion === 'c_mullion' && FROM.d_side_stile === 'c_sash_stile' && FROM.d_side_top_rail === 'c_sash_top_rail' && FROM.d_side_bottom_rail === 'd_leaf_bottom_rail'
    && FROM.d_fan_fixed_stile === 'c_sash_stile' && FROM.d_fan_fixed_top_rail === 'c_sash_top_rail' && FROM.d_fan_fixed_bottom_rail === 'c_sash_bottom_rail',
    'counterparts: mullion -> casement mullion; side stile / top -> casement leaf; side bottom -> door bottom rail; fixed fan -> casement leaf rows');
  // resolution: own assignment wins, else the counterpart's
  const materials = [{ id: 'oak', name: 'Oak 68 x 93', size: '68 x 93mm' }, { id: 'ash', name: 'Ash 64 x 57', size: '64 x 57mm' }, { id: 'tk', name: 'Teak 70 x 95', size: '70 x 95mm' }];
  const data = { schema: 2, base: { c_mullion: { material_id: 'oak', yield: 1 }, c_sash_stile: { material_id: 'ash', yield: 1.1 } }, overrides: {} };
  const flat = LIVE.partRegistry.expandAssignments(data);
  ok(bom.effectiveAssignment('d_mullion', 'standard', data, flat)?.material_id === 'oak' && bom.effectiveAssignment('d_mullion', 'standard', data, flat).inheritedFrom === 'c_mullion',
    'unassigned d_mullion resolves to the casement mullion material');
  ok(bom.effectiveAssignment('d_side_stile', 'standard', data, flat)?.material_id === 'ash' && bom.effectiveAssignment('d_side_stile', 'standard', data, flat).yield === 1.1, 'unassigned side stile: the casement leaf stile material (with its yield)');
  const own = { schema: 2, base: { ...data.base, d_mullion: { material_id: 'tk', yield: 1 } }, overrides: {} };
  ok(bom.effectiveAssignment('d_mullion', 'standard', own, LIVE.partRegistry.expandAssignments(own))?.material_id === 'tk', 'an own assignment wins over the counterpart');
  ok(bom.effectiveAssignment('d_side_top_rail', 'standard', data, flat) == null && bom.effectiveAssignment('c_mullion', 'standard', { schema: 2, base: {}, overrides: {} }, {}) == null,
    'no counterpart material: still unassigned; rows without a counterpart unchanged');
  const B = french(2400, 2400, { ...BIG, transomType: 'fixed' });
  const resolveRaw = bom.makeRawResolver({ assignments: flat, assignmentsData: data, materials, frameType: 'standard' });
  const pre = lists.buildPrecutForWindow(B.derived, B.spec, {}, resolveRaw);
  const grp = (raw) => pre.sashEngineering.find((g) => g.section === raw)?.items.map((i) => i.elementName) || [];
  ok(grp('68x93').filter((n) => n === 'D-MULLION').length === 2 && grp('64x57').includes('D-SIDE STILE') && grp('64x57').includes('D-FIX FAN STILE (L)'),
    'pre-cut: the mullions on the casement mullion material (68x93), side stiles and fixed fan stiles on the casement leaf material (64x57): merged by material');
  const lines = bom.buildWindowMaterialLines({ derived: B.derived, windowSpec: B.spec, batch: null }, { assignments: flat, assignmentsData: data, materials, ALL_PARTS: store.ALL_PARTS, ironmongeryItems: [], settings: {} });
  ok(lines.some((l) => l.key === 'mat:oak' && l.part?.id === 'd_mullion') && lines.some((l) => l.key === 'mat:ash' && l.part?.id === 'd_side_stile'), 'BOM lines: d_mullion on Oak, d_side_stile on Ash (counterpart materials)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - door BOM part quantities of the reference set');
{
  // Read once from the live engine and checked by hand (pre-cut allowance 10 on every timber
  // piece; frame members 68x93; seals 1.10 x the leaf perimeters; glass m2 rounded to 0.01):
  //  french 2400 x 2400, sides 400 + 400, opening fan T 450, timber cill:
  //   d_frame_head 2410 (2400 + 10), d_frame_jamb 2 x 2410 = 4820, d_frame_cill 2410,
  //   d_mullion 2 x (2323 + 10) = 4666, d_transom_rail (341 + 10) x 2 + (1575 + 10) = 2287
  //   (pre-cut lengths round to the mm: 340.5 -> 341, 1574.5 -> 1575),
  //   d_leaf_stile = d_leaf_meeting_stile = 2 x (1882 + 10) = 3784, d_leaf_top_rail =
  //   d_leaf_bottom_rail = 2 x (789 + 10) = 1598, d_side_stile 4 x (1882 + 10) = 7568,
  //   d_side_top_rail = d_side_bottom_rail = 2 x (332 + 10) = 684, fan leaves on the casement
  //   rows: c_sash_stile 6 x (385 + 10) = 2370, c_sash_top_rail = c_sash_bottom_rail =
  //   (1566 + 10) + 2 x (332 + 10) = 2260; glass 2 x 618 x 1631 + 2 x 227 x 1661 + 1461 x 277
  //   + 2 x 227 x 277 = 3.30 m2; hinges 2 x 3 = 6; one handle (lockType single): kit 1,
  //   bolts 2, cylinder 1, handle 1; no threshold product (timber cill).
  const B = french(2400, 2400, BIG);
  const q = pq(B);
  const mm = (k) => q[k]?.mm, qty = (k) => q[k]?.qty;
  ok(mm('d_frame_head') === 2410 && mm('d_frame_jamb') === 4820 && mm('d_frame_cill') === 2410 && mm('d_mullion') === 4666 && mm('d_transom_rail') === 2287,
    `frame: head 2410, jambs 4820, cill 2410, mullions 4666, transom 2287 (${mm('d_frame_head')} / ${mm('d_frame_jamb')} / ${mm('d_frame_cill')} / ${mm('d_mullion')} / ${mm('d_transom_rail')})`);
  ok(mm('d_leaf_stile') === 3784 && mm('d_leaf_meeting_stile') === 3784 && mm('d_leaf_top_rail') === 1598 && mm('d_leaf_bottom_rail') === 1598,
    'door leaves: stiles 3784, meeting stiles 3784, top / bottom rails 1598');
  ok(mm('d_side_stile') === 7568 && mm('d_side_top_rail') === 684 && mm('d_side_bottom_rail') === 684, 'side lights: stiles 7568, top / bottom rails 684');
  ok(mm('c_sash_stile') === 2370 && mm('c_sash_top_rail') === 2260 && mm('c_sash_bottom_rail') === 2260 && !q.d_fan_fixed_stile, 'opening fans on the casement leaf rows: stiles 2370, rails 2260; no fixed fan rows');
  ok(near(qty('d_glass_double_6_12_6'), 3.3) && qty('d_hinges') === 6 && qty('d_lock_single_kit') === 1 && qty('d_bolts') === 2 && qty('d_cylinder') === 1 && qty('d_handle_set') === 1
    && !Object.keys(q).some((k) => /^d_threshold/.test(k)) && !q.d_coupling_post,
    `glass ${qty('d_glass_double_6_12_6')} m2, hinges 6, kit 1, bolts 2, cylinder 1, handle 1, no threshold product, nothing on the coupling post`);
  //  the same with a fixed fan and an aluminium threshold: the fan members move to the fixed fan
  //  rows (stiles 6 x 395 = 2370, top 2260, bottom 2260), no casement fan rows, no fan hinge or
  //  lock, mullions to the floor 2 x (2364 + 10) = 4748, no cill, threshold alu double 1 + seal 1.57 m.
  const BF = french(2400, 2400, { ...BIG, transomType: 'fixed', thresholdType: 'aluminium' });
  const qf = pq(BF);
  ok(qf.d_fan_fixed_stile?.mm === 2370 && qf.d_fan_fixed_top_rail?.mm === 2260 && qf.d_fan_fixed_bottom_rail?.mm === 2260 && !qf.c_sash_stile && !Object.keys(qf).some((k) => /^c_(hinge|lock|top_hung)/.test(k)),
    'fixed fan: d_fan_fixed_* 2370 / 2260 / 2260, no casement fan timber, no fan hinge or lock rows');
  ok(qf.d_mullion?.mm === 4748 && !qf.d_frame_cill && qf.d_threshold_alu_double?.qty === 1 && near(qf.d_threshold_seal?.qty, 1.57), 'aluminium: mullions 4748 to the floor, no cill, the double threshold + seal 1.57 m');
  //  single 900 x 2100 half-glazed: panel 644 x 806 = 0.5191 m2: Tricoya 2 x 0.5191 = 1.0382, core 0.5191
  const H = door(900, 2100, { doorStyle: 'half-glazed' });
  ok(near(pq(H).d_panel_tricoya_18?.qty, 1.0382, 1e-6) && near(pq(H).d_panel_mdf_core?.qty, 0.5191, 1e-6), 'half-glazed panel boards at the outer size: Tricoya 1.0382 m2, core 0.5191 m2');
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - the shared casement rules and the visible openings');
{
  const src = readFileSync(resolve(ROOT, 'src/engine/calculations.js'), 'utf8');
  const doorSrc = src.slice(src.indexOf('function deriveDoorWindow('), src.indexOf('export function deriveWindowData('));
  const casSrc = src.slice(src.indexOf('function deriveCasementWindow('), src.indexOf('function deriveDoorWindow('));
  const helpers = ['leafWidthInField', 'leafHeightInTier', 'leafOrigin', 'fieldLandX', 'mullionLength', 'fullMullionRun', 'transomRun'];
  ok(helpers.every((h) => doorSrc.includes(`${h}(`)) && ['leafWidthInField', 'leafHeightInTier', 'leafOrigin', 'fieldLandX', 'mullionLength', 'fullMullionRun', 'transomSegmentLength', 'transomRun'].every((h) => casSrc.includes(`${h}(`)),
    'both engines call the casementRules helpers');
  // (leafFullHeight / lowerFromAxis appear as the NAMES the casement helper reads, composed from
  // the door numbers; the door profile values themselves are never read)
  ok(!/(ded|deductions)\.(leafFullHeight|leafNoThreshold|fanAtHead|fanAtRail)|couplingPost|transomDeduct|sidePanel\??\.member|spP\.member/.test(doorSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')),
    'the door engine reads none of the retired keys (deductions.leafFullHeight / leafNoThreshold / fanAtHead / fanAtRail, couplingPost, transomDeduct, sidePanel.member)');
  const R = LIVE.calculations;
  void R;
  // the helpers by hand
  const CR = await import(pathToFileURL(resolve(ROOT, 'src/engine/casementRules.js')).href);
  const ded = { leafAtJamb: 51, leafAtMullionAxis: 17, leafFullHeight: 102, fanFromAxis: 65, lowerFromAxis: 68 };
  ok(CR.leafWidthInField(1600, false, false, ded) === 1566 && CR.leafWidthInField(900, true, true, ded) === 798 && CR.leafWidthInField(400, true, false, ded) === 332,
    'leafWidthInField: 1600 between axes 1566, 900 jamb to jamb 798, 400 jamb to axis 332');
  ok(CR.leafHeightInTier({ topIsHead: true, bottomIsCill: true }, 2100, ded).leafH === 1998 && CR.leafHeightInTier({ topIsHead: true, bottomIsCill: false, bottomAxisT: 450 }, 2400, ded).leafH === 385
    && CR.leafHeightInTier({ topIsHead: false, bottomIsCill: true, topAxisT: 450 }, 2400, ded).leafH === 1882, 'leafHeightInTier with the door numbers: 1998, fan 385, lower 1882');
  ok(CR.mullionLength(2400, { mullion: 77 }, { cillVisible: 41 }) === 2323 && CR.mullionLength(2400, { mullion: 77 }, { cillVisible: 41 }, false) === 2364, 'mullionLength: 2323 with a timber cill, 2364 to the floor');
  // the openings and the lands tile the frame (2400 x 2400 case): fan / lower widths and the bands
  const B = french(2400, 2400, BIG);
  const o = B.derived.door.zones.openings;
  const fan = o.filter((x) => x.kind === 'fan'), low = o.filter((x) => x.kind !== 'fan');
  ok(o.length === 6 && fan.every((x) => near(x.y, 47) && near(x.y + x.h, 442)) && low.every((x) => near(x.y, 463) && near(x.y + x.h, 2400 - 41)),
    'openings: fans 47 to 442 (head land, transom land 8 above the axis), lower 463 (13 below) to the cill top 2359');
  ok(near(fan[0].x, 47) && near(fan[0].x + fan[0].w, 387) && near(fan[1].x, 413) && near(fan[1].x + fan[1].w, 1987) && near(fan[2].x, 2013) && near(fan[2].x + fan[2].w, 2353),
    'openings: the jamb lands 47 and the mullion lands 13 either side of each axis (387 / 413, 1987 / 2013)');
  const I = french(1600, 2100, { doorOpenDirection: 'inward' });
  const io = I.derived.door.zones.openings[0];
  ok(near(io.x, 68) && near(io.y, 68) && near(io.w, 1600 - 136) && near(io.y + io.h, 2100 - 35), 'inward door: the outside sees the full frame faces (68) and the inward cill outside face (35)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - guards: no leaf, hinges, batch type');
{
  const errOf = (fn) => { try { fn(); return null; } catch (e) { return e; } };
  // W x H is the overall frame (box 6): a PSW-era item (W = the door alone, sides outside) leaves no door
  const e1 = errOf(() => mk(LIVE, 900, 2100, { windowCategory: 'door', doorType: 'single-external', sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500 }, { name: 'D9' }));
  ok(e1 instanceof calculations.DoorGeometryError && /Door "D9": the door field -100 mm \(frame 900 less side panels 500 \+ 500\)/.test(e1.message),
    `900 single with side panels 500 + 500: DoorGeometryError "${e1?.message}"`);
  const e2 = errOf(() => mk(LIVE, 1600, 2100, { windowCategory: 'door', doorType: 'french', sidePanels: 'right', sideRightWidth: 150 }, { name: 'D8' }));
  ok(e2 instanceof calculations.DoorGeometryError && /the right side panel zone 150 mm leaves no side light/.test(e2.message), `a 150 side zone: "${e2?.message}"`);
  const e3 = errOf(() => mk(LIVE, 900, 2100, { windowCategory: 'door', doorType: 'single-external', transomType: 'fixed', transomHeight: 2100 }, { name: 'D7' }));
  ok(e3 instanceof calculations.DoorGeometryError, `a transom axis at the floor: DoorGeometryError (${e3?.message})`);
  ok(!errOf(() => french(2400, 2400, BIG)) && !errOf(() => door(1000, 2100, { sidePanels: 'right', sideRightWidth: 450 })), 'the 3.10 doors derive without the error');
  const B = LIVE.boundary;
  const row = B.deriveWindowBounded({ id: 'd', name: 'D9', width: 900, height: 2100, windowCategory: 'door', doorType: 'single-external', sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500 }, (ws) => calculations.deriveWindowData(ws, {}));
  ok(row.error?.name === 'DoorGeometryError' && row.error.known === true && row.derived === null, 'the pages\' boundary catches it as a known window data error (shown on that window, left out of the pack)');
  // hinges: at least 3 a leaf whatever the profile says (owner box 12)
  const H = LIVE.doorHardware;
  ok(H.DOOR_MIN_HINGES === 3 && H.doorHingeCount(1998, { perLeaf: 2, perLeafTall: 4, tallAbove: 2100 }) === 3 && H.doorHingeCount(2200, { perLeaf: 3, perLeafTall: 1, tallAbove: 2100 }) === 3
    && H.doorHingeCount(1998, DP.hinges) === 3 && H.doorHingeCount(2146, DP.hinges) === 4 && H.doorHingeCount(1998, { perLeaf: 5 }) === 5,
    'doorHingeCount: perLeaf 2 or perLeafTall 1 still buys 3; the defaults 3 / 4; 5 stays 5');
  const snap = { ...DP, hinges: { ...DP.hinges, perLeaf: 2 } };
  const nh = profile.withProfiles(null, null, snap, () => door(900, 2100).derived.door.leaves[0].hinges.length);
  ok(nh === 3, `a door profile with perLeaf 2 draws and buys ${nh} hinges a leaf`);
  // batch type: one mapping (box 15)
  ok(LIVE.batchTypeKey('door') === 'doors' && LIVE.batchTypeKey('doors') === 'doors' && LIVE.batchTypeKey(undefined) === 'sash' && LIVE.batchTypeKey('casement') === 'casement'
    && JSON.stringify(LIVE.batchDefaultsFor('door')) === JSON.stringify(LIVE.batchDefaultsFor('doors')), "batchTypeKey: 'door' and 'doors' read as 'doors'; batchDefaultsFor('door') = the doors defaults");
  const dash = readFileSync(resolve(ROOT, 'src/pages/DashboardPage.jsx'), 'utf8');
  ok(!/batch\??\.type \|\| 'sash'/.test(dash) && (dash.match(/batchTypeKey\(/g) || []).length >= 8, 'the dashboard reads every batch type through batchTypeKey (filter, colours, labels, pack chips)');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
