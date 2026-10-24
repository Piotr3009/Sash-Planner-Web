/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t49: the french meeting joint and the lock machining (Piotr 24.10.2026).
 *   1  the door profile: meeting { gap 4, lipActive 37, lipPassive 14.5, sealGroove 3 },
 *      hardware.spindleFromLeafBottom 1050 and the machining keys; a stored schema-3
 *      copy without them migrates to the defaults;
 *   2  frenchMeetingGeometry on the 57 leaf: rebate 16 = lap 12 + gap 4, cuts 20 / 42.5,
 *      5.5 seal space; the lips and rebate faces per role, outward and inward (mirror);
 *   3  the engine: the french 1600 x 2100 leaves carry leaf.meeting and leaf.machining,
 *      the spindle 1050 above the leaf bottom (handleY) on every door, the ThunderBolt
 *      pockets from the Winkhaus data sheet (positions from the spindle and from the
 *      leaf bottom), the three keeps on the passive shoulder, the FGTE master and slave
 *      routing with two handles, the jamb keeps of a single door;
 *   4  the owner switches: auxHousing off drops the 4th pocket, keeps 'full length'
 *      adds the keep rail recess, a copy without spindleFromLeafBottom reads the old
 *      handleHeight above the floor, a lip pair taller than the leaf is flagged;
 *   5  the store: setDoorPath writes meeting.* and the boolean hardware.auxHousing;
 *   6  the sheets: the plan detail draws the rebate 16 x 20 / 16 x 42.5 with the 4 gap,
 *      the Lock Machining sheet is in the door sheet plan and lists every pocket.
 *
 * Run: node verify/parity/t49_door_meeting_machining.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

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
const url = build('t49-live', [
  ...['specification', 'calculations', 'profile', 'doorLockMachining'].map((m) => `export * as ${m} from '${resolve(ROOT, `src/engine/${m}.js`)}';`),
  `export * from '${resolve(ROOT, 'src/stores/windowProfileStore.js')}';`,
  `export { default as DoorSheet } from '${resolve(ROOT, 'src/components/drawings/DoorSheet.jsx')}';`,
  `export * as ddu from '${resolve(ROOT, 'src/components/drawings/doorDrawUtils.js')}';`,
  `export * as parts from '${resolve(ROOT, 'src/components/drawings/doorSheetParts.jsx')}';`,
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

const { specification, calculations, profile, doorLockMachining: DLM } = M;
const DP = profile.DEFAULT_DOOR_PROFILE;
const mk = (w, h, fc) => {
  const spec = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: w, height: h }, { fullConfig: { windowCategory: 'door', doorType: 'single-external', ...fc } });
  return { spec, derived: calculations.deriveWindowData(spec, {}) };
};
const french = (fc = {}) => mk(1600, 2100, { doorType: 'french', ...fc });
const byRole = (d, role) => d.door.leaves.find((l) => l.role === role);
const pocket = (m, key) => (m.pockets || []).find((p) => p.key === key);

// ═════════════════════════════════════════════════════════════════════════════
section('1 - the profile: meeting block, spindle datum, machining keys, migration');
{
  ok(JSON.stringify(DP.meeting) === JSON.stringify({ gap: 4, lipActive: 37, lipPassive: 14.5, sealGroove: 3 }), 'DEFAULT_DOOR_PROFILE.meeting = { gap 4, lipActive 37, lipPassive 14.5, sealGroove 3 }');
  const H = DP.hardware;
  ok(H.spindleFromLeafBottom === 1050 && H.lockEdgeMargin === 12 && H.faceplateWidth === 21 && H.faceplateRecessMaster === 3 && H.faceplateRecessSlave === 5
    && H.rodChannelWidth === 12.2 && H.rodChannelDepthMaster === 12 && H.rodChannelDepthSlave === 15 && H.auxHousing === false && H.handleHeight === 1000,
    'hardware: spindleFromLeafBottom 1050, lockEdgeMargin 12, faceplateWidth 21, recess 3 / 5, rod channel 12.2 x 12 / 15, auxHousing off (the DXF lock has three housings); handleHeight 1000 kept');
  ok(H.fgteCentreLine === 22 && near(H.lockEdgeMargin + H.faceplateWidth / 2, 22.5), 'the lock axis 12 + 21 / 2 = 22.5 sits in the FGTE 22 mm centre line variant (fgteCentreLine 22)');
  // a schema-3 copy saved before 24.10: no meeting block, no machining keys
  const old = clone(DP);
  delete old.meeting;
  for (const k of ['spindleFromLeafBottom', 'lockEdgeMargin', 'faceplateWidth', 'faceplateRecessMaster', 'faceplateRecessSlave', 'rodChannelWidth', 'rodChannelDepthMaster', 'rodChannelDepthSlave', 'auxHousing']) delete old.hardware[k];
  old.hardware.handleHeight = 1020;
  const mig = profile.migrateDoorProfile(old);
  ok(JSON.stringify(mig.meeting) === JSON.stringify(DP.meeting) && mig.hardware.spindleFromLeafBottom === 1050 && mig.hardware.auxHousing === false && mig.hardware.handleHeight === 1020,
    'migrateDoorProfile: a copy without the 24.10 keys takes the defaults, its own handleHeight stays');
  const edited = clone(DP);
  edited.meeting.gap = 3;
  edited.hardware.spindleFromLeafBottom = 1040;
  const mig2 = profile.migrateDoorProfile(edited);
  ok(mig2.meeting.gap === 3 && mig2.meeting.lipActive === 37 && mig2.hardware.spindleFromLeafBottom === 1040, 'migrateDoorProfile: hand-edited gap 3 and spindle 1040 are kept');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - frenchMeetingGeometry and leafMeeting');
{
  const G = DLM.frenchMeetingGeometry({ leafDepth: 57, lip: 6, clearance: 0, meeting: DP.meeting, inward: false });
  ok(G.overlap === 12 && G.gap === 4 && G.rebateWidth === 16 && G.lipActive === 37 && G.lipPassive === 14.5 && G.cutActive === 20 && G.cutPassive === 42.5 && G.sealSpace === 5.5 && G.sealGroove === 3 && G.lapFace === 'exterior' && G.valid,
    `outward 57: rebate ${G.rebateWidth} = lap ${G.overlap} + gap ${G.gap}; cuts ${G.cutActive} / ${G.cutPassive}; seal space ${G.sealSpace}`);
  const A = DLM.leafMeeting('active', G), P = DLM.leafMeeting('passive', G);
  ok(A.lipFace === 'exterior' && A.lip === 37 && A.rebate.width === 16 && A.rebate.depth === 20 && A.rebate.fromFace === 'interior' && A.splitZ === 37 && A.sealGroove === null,
    'outward active: lip 37 on the exterior, rebate 16 x 20 cut from the interior face, split plane 37 from the exterior');
  ok(P.lipFace === 'interior' && P.lip === 14.5 && P.rebate.width === 16 && P.rebate.depth === 42.5 && P.rebate.fromFace === 'exterior' && P.splitZ === 42.5 && P.sealGroove?.width === 3,
    'outward passive: lip 14.5 on the interior, rebate 16 x 42.5 cut from the exterior face, split 42.5, seal groove 3 in its shoulder');
  const Gi = DLM.frenchMeetingGeometry({ leafDepth: 57, lip: 6, clearance: 0, meeting: DP.meeting, inward: true });
  const Ai = DLM.leafMeeting('active', Gi), Pi = DLM.leafMeeting('passive', Gi);
  ok(Gi.lapFace === 'interior' && Ai.lipFace === 'interior' && Ai.rebate.fromFace === 'exterior' && Ai.rebate.depth === 20 && Ai.splitZ === 20
    && Pi.lipFace === 'exterior' && Pi.rebate.fromFace === 'interior' && Pi.rebate.depth === 42.5 && Pi.splitZ === 14.5,
    'inward: the mirror (active lip 37 inside, cut 20 from the exterior, split 20; passive lip 14.5 outside, split 14.5)');
  const G61 = DLM.frenchMeetingGeometry({ leafDepth: 61, lip: 6, clearance: 0, meeting: DP.meeting, inward: false });
  ok(G61.cutActive === 24 && G61.cutPassive === 46.5 && G61.sealSpace === 9.5 && G61.valid, 'triple leaf 61: the lips stay 37 / 14.5, the cuts grow to 24 / 46.5, seal space 9.5');
  const Gc = DLM.frenchMeetingGeometry({ leafDepth: 57, lip: 6, clearance: 4, meeting: DP.meeting, inward: false });
  ok(Gc.overlap === 8 && Gc.rebateWidth === 12, 'frenchClearance 4 narrows the lap to 8 and the rebate to 12 (the gap stays 4)');
  const bad = DLM.frenchMeetingGeometry({ leafDepth: 44, lip: 6, clearance: 0, meeting: DP.meeting, inward: false });
  ok(bad.valid === false && bad.sealSpace < 0, 'a 44 leaf with lips 37 + 14.5 is flagged invalid (negative seal space)');
  ok(DLM.pocketDepth('D+21', 45) === 66 && DLM.pocketDepth(47, 55) === 47 && DLM.pocketDepth('D+23', 55) === 78, "pocketDepth: 'D+21' with backset 45 = 66, a number stays, 'D+23' with 55 = 78");
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - the engine: french 1600 x 2100 outward, one handle (ThunderBolt + keeps)');
{
  const F = french();
  const dr = F.derived.door;
  const act = byRole(F.derived, 'active'), pas = byRole(F.derived, 'passive');
  ok(dr.meeting && dr.meeting.rebateWidth === 16 && dr.meeting.gap === 4 && dr.spindleFromLeafBottom === 1050, 'derived.door.meeting (rebate 16, gap 4) and spindleFromLeafBottom 1050');
  ok(dr.leaves.every((l) => near(l.y + l.h - l.handleY, 1050) && near(dr.totalHeight - l.handleY, 1101)), 'handleY: the spindle 1050 above the leaf bottom = 1101 above the floor (leaf bottom 51 up)');
  ok(act.meeting?.lip === 37 && act.meeting.rebate.depth === 20 && pas.meeting?.lip === 14.5 && pas.meeting.rebate.depth === 42.5, 'leaves carry leaf.meeting: active lip 37 / cut 20, passive lip 14.5 / cut 42.5');
  const ma = act.machining, mp = pas.machining;
  ok(ma.kind === 'thunderbolt' && ma.edge === 'active lip' && ma.faceWidth === 37 && ma.datum.axisFromFace === 22.5 && ma.datum.axisFace === 'exterior' && ma.datum.backset === 45
    && ma.datum.spindleFromBottom === 1050 && ma.datum.spindleFromTop === 948 && ma.fits.plateToStep === 4,
    'active: ThunderBolt on the 37 lip edge, axis 22.5 from the exterior lip face, 4 left between the plate and the step');
  const fp = ma.faceplate;
  ok(fp.from === -906 && fp.to === 864 && fp.fromBottom === 144 && fp.toBottom === 1914 && fp.width === 21 && fp.depth === 3 && fp.cropBottom === 0 && fp.cropTop === 0,
    'faceplate recess 21 x 3 from -906 to +864 (144 to 1914 on the leaf), no cropping on 1998');
  // the DXF lock (T-FGAO2070): three housings; the deadbolt pockets 140 long centred on the housings
  // (89..182 and 1579..1672 from the bottom end), the main pocket the data sheet's 770.5..1000.5
  const want = { 'bolt-bottom': [-840.5, -700.5, 18, 47], main: [-135.5, 94.5, 18, 66], 'bolt-top': [649.5, 789.5, 18, 47] };
  ok(ma.pockets.length === 3 && !pocket(ma, 'aux') && Object.entries(want).every(([k, [a, b, w, d]]) => { const p = pocket(ma, k); return p && near(p.from, a) && near(p.to, b) && p.width === w && near(p.depth, d) && near(p.fromBottom, 1050 + a) && near(p.toBottom, 1050 + b); }),
    'the three ThunderBolt pockets: -840.5..-700.5 d47 (209.5..349.5 on the leaf), -135.5..+94.5 D+21, +649.5..+789.5 d47; no aux pocket by default');
  ok(ma.rodChannel && ma.rodChannel.width === 12.2 && ma.rodChannel.depth === 8, 'the ThunderBolt rail channel 12.2 x 8 under the plate recess (DXF: rail 2.2, clips to 7.7)');
  ok(ma.holes.length === 2 && ma.holes[0].at === 0 && ma.holes[0].atBottom === 1050 && ma.holes[1].at === -92 && ma.holes[1].atBottom === 958 && ma.holes.every((h) => h.x === 45),
    'spindle at 0 (1050) and the PZ cylinder 92 below (958), both at the backset 45');
  ok(JSON.stringify(ma.bolts.map((b) => b.at)) === JSON.stringify([-753.5, 736.5]), 'deadbolt axes -753.5 / +736.5 (the DXF double bolts 152.5 and 1642.5 from the bottom end)');
  ok(mp.kind === 'keeps' && mp.edge === 'passive shoulder' && mp.faceWidth === 42.5 && mp.datum.axisFromFace === 22.5 && mp.fits.plateToStep === 9.5 && mp.pockets.length === 0,
    'passive: the keeps on the 42.5 shoulder, same axis 22.5, 9.5 between the plate and the lip');
  const k = mp.keeps;
  ok(k.length === 3 && k[0].code === 'F2402' && k[1].code === 'F24-912W' && k[2].code === 'F2402' && k[0].centre === -753.5 && k[1].centre === 0 && k[2].centre === 736.5,
    'three keeps: F2402 at -753.5, F24-912W centre, F2402 at +736.5 (on the deadbolt axes)');
  ok(near(k[1].plate.from, -126.5) && near(k[1].plate.to, 108.5) && k[1].plate.width === 24 && k[1].plate.depth === 2.5 && near(k[1].pocket.from, -106.5) && near(k[1].pocket.to, 75.5) && k[1].pocket.width === 18 && k[1].pocket.depth === 25,
    'centre keep: plate 24 x 235 x 2.5 (-126.5..+108.5), pocket 18 x 182 x 25 (-106.5..+75.5)');
  ok(near(k[0].plate.from, -841.5) && near(k[0].plate.to, -665.5) && near(k[0].pocket.from, -813.5) && near(k[0].pocket.to, -693.5) && near(k[0].plate.fromBottom, 208.5) && near(k[2].plate.toBottom, 1874.5),
    'single keeps: plate 176 / pocket 120 centred on the bolts, both on the 1998 leaf (208.5 to 1874.5)');
  ok(mp.faceplate && mp.faceplate.width === 24 && mp.faceplate.depth === 2.5 && mp.notes.some((t) => /keep rail/.test(t)), "hardware.keeps 'full length': the 24 x 2.5 keep rail recess with the three pockets, flagged as an assumption");
  ok(F.derived.door.jambMachining === null, 'a french door has no jamb keeps');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3b - two handles (FGTE master + slave), inward, and the single door');
{
  const F = french({ lockType: 'double', doorOpenDirection: 'inward' });
  const act = byRole(F.derived, 'active'), pas = byRole(F.derived, 'passive');
  const ma = act.machining, mp = pas.machining;
  ok(ma.kind === 'fgte-master' && mp.kind === 'fgte-slave' && ma.datum.axisFace === 'interior' && mp.datum.axisFace === 'interior' && act.meeting.lipFace === 'interior',
    'inward two handles: FGTE master on the active lip (now inside), slave on the passive shoulder, the axis from the interior lip face');
  ok(ma.faceplate.fullLength && ma.faceplate.fromBottom === 0 && ma.faceplate.toBottom === 1998 && ma.faceplate.depth === 3 && ma.rodChannel.width === 12.2 && ma.rodChannel.depth === 12,
    'master: faceplate recess 21 x 3 full height, rod channel 12.2 x 12');
  ok(mp.faceplate.depth === 5 && mp.rodChannel.depth === 15, 'slave: recess 5 deep, rod channel 15 deep');
  const wm = { 'hook-lower': [-835, -705, 17, 48], main: [-130, 70, 17, 68], 'hook-upper': [508, 638, 17, 48] };
  ok(Object.entries(wm).every(([k, [a, b, w, d]]) => { const p = pocket(ma, k); return p && p.from === a && p.to === b && p.width === w && p.depth === d; }),
    'master pockets (Winkhaus rebated master routing, 58 slab): hooks 130 long 48 deep at -835 / +508, main 200 long D+23 = 68 deep from -130');
  const ws = { 'shootbolt-lower': [-795, -730, 25], main: [-130, 70, 71], gear: [340, 430, 15], 'shootbolt-upper': [548, 613, 25] };
  ok(Object.entries(ws).every(([k, [a, b, d]]) => { const p = pocket(mp, k); return p && p.from === a && p.to === b && p.width === 17 && p.depth === d; }),
    'slave pockets (rebated slave routing): shootbolt housings 65 x 25 at -795 / +548, main 200 x 71 (D+26), gear 90 x 15 at +340');
  ok(mp.endPlates.length === 2 && mp.endPlates[0].fromBottom === 0 && mp.endPlates[0].toBottom === 65 && mp.endPlates[1].toBottom === 1998 && mp.endPlates.every((e) => e.depth === 3 && e.width === 20.5),
    'slave end plates 20.5 x 65 x 3 at both leaf ends');
  ok(mp.datum.backset === 45 && ma.datum.backset === 45, 'both backsets 45 (hardware.backset / fgteSlaveBackset)');
  // a single door 900 x 2100: the lock centred on the 57 leaf, the keeps in the jamb
  const S = mk(900, 2100, { doorHinge: 'left' });
  const l = S.derived.door.leaves[0];
  ok(l.machining.kind === 'thunderbolt' && l.machining.edge === 'lock stile' && l.machining.faceWidth === 57 && l.machining.datum.axisFromFace === 28.5 && l.machining.datum.edgeMargin === 18 && l.machining.fits.plateToStep === null,
    'single door: the ThunderBolt centred on the 57 lock stile (axis 28.5, margin 18), no meeting step');
  ok(near(l.y + l.h - l.handleY, 1050) && l.meeting === null, 'single door: spindle 1050 above the leaf bottom, no meeting stile');
  // doorHinge 'left' = hinges on the left seen from INSIDE = the right jamb in the exterior view (leaf.hinge 'right'),
  // so the keeps go into the LEFT jamb of the exterior view
  const J = S.derived.door.jambMachining;
  ok(J && l.hinge === 'right' && J.side === 'left' && J.edge === 'jamb rebate wall' && J.keeps.length === 3 && J.keeps[1].code === 'F24-912W' && J.keeps[1].centreBottom === 1050,
    'single door hinge left (from inside): the three keeps in the lock side jamb (left in the exterior view), the centre keep on the spindle height');
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - owner switches through the door profile');
{
  const withProfile = (edit, fn) => {
    const p = clone(DP);
    edit(p);
    profile.setActiveDoorProfile(p);
    try { return fn(); } finally { profile.setActiveDoorProfile(null); }
  };
  const withAux = withProfile((p) => { p.hardware.auxHousing = true; }, () => french());
  const ma = byRole(withAux.derived, 'active').machining;
  const aux = pocket(ma, 'aux');
  ok(ma.pockets.length === 4 && aux && near(aux.from, 256.7) && near(aux.to, 366.7) && near(aux.depth, 66) && !ma.notes.some((t) => /auxiliary housing/.test(t)),
    'auxHousing on (the data sheet variant): the 4th pocket +256.7..+366.7 D+21 joins');
  ok(byRole(french().derived, 'active').machining.notes.some((t) => /auxiliary housing/.test(t)), 'auxHousing off (default): the note says the aux pocket is not machined');
  const indiv = withProfile((p) => { p.hardware.keeps = 'individual'; }, () => french());
  const mp = byRole(indiv.derived, 'passive').machining;
  ok(mp.faceplate === null && mp.keeps.length === 3 && !mp.notes.some((t) => /keep rail/.test(t)), "keeps 'individual': no rail recess, the three keeps alone");
  const legacy = withProfile((p) => { delete p.hardware.spindleFromLeafBottom; p.hardware.handleHeight = 1000; }, () => {
    // migrateDoorProfile restores the default on hydrate; the engine's own fallback is exercised with the key unset
    const raw = clone(DP); delete raw.hardware.spindleFromLeafBottom; raw.hardware.handleHeight = 1000;
    profile.setActiveDoorProfile(raw);
    return french();
  });
  ok(legacy.derived.door.leaves.every((l) => near(l.y + l.h - l.handleY, 1050)), 'a hydrated copy without the key still gets the default 1050 (migrateDoorProfile fills it)');
  const zero = withProfile((p) => { p.hardware.spindleFromLeafBottom = 0; p.hardware.handleHeight = 1000; }, () => french());
  ok(zero.derived.door.leaves.every((l) => near(zero.derived.door.totalHeight - l.handleY, 1000)) && zero.derived.door.spindleFromLeafBottom === null,
    'spindleFromLeafBottom 0 (switched off): the old rule, handleHeight 1000 above the floor');
  const gap3 = withProfile((p) => { p.meeting.gap = 3; p.meeting.lipActive = 38; p.meeting.lipPassive = 15; }, () => french());
  const G = gap3.derived.door.meeting;
  ok(G.rebateWidth === 15 && G.cutActive === 19 && G.cutPassive === 42 && G.sealSpace === 4, 'the Winkhaus 1:1 variant (gap 3, lips 38 / 15): rebate 15, cuts 19 / 42, seal space 4');
  const b55 = withProfile((p) => { p.hardware.backset = 55; }, () => french());
  ok(pocket(byRole(b55.derived, 'active').machining, 'main').depth === 76 && byRole(b55.derived, 'active').machining.datum.backset === 55, 'backset 55: the main pocket D+21 = 76 deep');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - the store: setDoorPath writes the meeting block and the boolean aux switch');
{
  const S = M.useWindowProfileStore;
  S.getState().resetDoorToDefaults?.();
  S.getState().setDoorPath(['meeting', 'gap'], '3');
  S.getState().setDoorPath(['meeting', 'lipActive'], 38);
  S.getState().setDoorPath(['hardware', 'auxHousing'], false);
  S.getState().setDoorPath(['hardware', 'spindleFromLeafBottom'], '1040');
  const d = S.getState().door;
  ok(d.meeting.gap === 3 && d.meeting.lipActive === 38 && d.hardware.auxHousing === false && d.hardware.spindleFromLeafBottom === 1040,
    'meeting.gap 3, meeting.lipActive 38, hardware.auxHousing false, spindleFromLeafBottom 1040 written');
  S.getState().setDoorPath(['hardware', 'auxHousing'], 'yes');
  S.getState().setDoorPath(['meeting', 'nope'], 5);
  S.getState().setDoorPath(['meeting', 'gap'], 'abc');
  const d2 = S.getState().door;
  ok(d2.hardware.auxHousing === true && !('nope' in d2.meeting) && d2.meeting.gap === 3, "'yes' turns the aux back on; an unknown key or a non-number is refused");
  S.getState().resetDoorToDefaults?.();
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - the sheets: the plan detail rebate and the Lock Machining sheet');
{
  const F = french();
  const plan = M.parts.doorPlan(F.spec, F.derived);
  const act = plan.leaves.find((l) => l.leaf.role === 'active'), pas = plan.leaves.find((l) => l.leaf.role === 'passive');
  const meetPts = (l) => l.stiles[l.leaf.meetingSide === 'L' ? 0 : 1];
  const xs = (pts) => pts.map((p) => p[0]), zs = (pts) => pts.map((p) => p[1]);
  const ap = meetPts(act), pp = meetPts(pas);
  // the active stile polygon reaches the lip edge on the exterior (z 0..37) and stands 16 back on the interior side
  const aLipEdge = act.leaf.meetingSide === 'L' ? Math.min(...xs(ap)) : Math.max(...xs(ap));
  const aShoulder = act.leaf.meetingSide === 'L' ? Math.min(...xs(ap).filter((x) => x !== aLipEdge)) : Math.max(...xs(ap).filter((x) => x !== aLipEdge));
  const pLipEdge = pas.leaf.meetingSide === 'L' ? Math.min(...xs(pp)) : Math.max(...xs(pp));
  const pShoulder = pas.leaf.meetingSide === 'L' ? Math.min(...xs(pp).filter((x) => x !== pLipEdge)) : Math.max(...xs(pp).filter((x) => x !== pLipEdge));
  ok(near(Math.abs(aLipEdge - aShoulder), 16) && near(Math.abs(pLipEdge - pShoulder), 16) && near(Math.abs(aLipEdge - pShoulder), 4) && near(Math.abs(pLipEdge - aShoulder), 4),
    'doorPlan: both meeting stiles notched 16 (lap 12 + gap 4), 4 between a lip edge and the other shoulder');
  ok(zs(ap).includes(37) && zs(pp).includes(42.5), 'doorPlan: the active notch 20 deep from the interior (step at z 37 from the exterior), the passive 42.5 deep from the exterior (step at z 42.5)');
  ok(plan.meeting.geo?.rebateWidth === 16 && plan.meeting.strip[1] - plan.meeting.strip[0] === 12, 'the plan carries the joint numbers; the overlap strip stays 12');
  const sheetPlan = M.ddu.doorSheetPlan(F.derived);
  ok(sheetPlan.map((s) => s.key).join(',') === 'doorframe,doorleaf,doormachining,doorsection', `door sheet plan: ${sheetPlan.map((s) => s.key).join(', ')}`);
  const svg = renderToStaticMarkup(createElement(M.DoorSheet, { sheet: sheetPlan[2], windowSpec: F.spec, derived: F.derived, projectNumber: 'P-1' }));
  ok(/^<div/.test(svg) && /<svg/.test(svg) && !/NaN|undefined|[\u2013\u2014]/.test(svg), 'the Lock Machining sheet renders (no NaN / undefined / long dash)');
  ok(['bolt-bottom 209.5 to 349.5', 'main 914.5 to 1144.5', 'bolt-top 1699.5 to 1839.5', 'F24-912W at 1050', 'F2402 at 296.5', 'F2402 at 1786.5', 'spindle 1050 above the leaf bottom', '-135.5 to 94.5']
    .every((t) => svg.includes(t)), 'the sheet labels every pocket and keep from the leaf bottom and the table from the spindle');
  ok(svg.includes('37 face') && svg.includes('42.5 face') && svg.includes('rebate 16 wide (lap 12 + gap 4)'), 'the bands name the 37 lip and the 42.5 shoulder, the notes the rebate 16 = 12 + 4');
  const section = renderToStaticMarkup(createElement(M.DoorSheet, { sheet: sheetPlan[3], windowSpec: F.spec, derived: F.derived, projectNumber: 'P-1' }));
  ok(section.includes('rebate 16 = lap 12 + gap 4') && section.includes('lip 37') && section.includes('lip 14.5'), 'the plan section labels the rebate and dimensions both lips');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
