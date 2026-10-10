/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t46: the window profile save merges with the cloud (owner box item 20, Piotr
 * 09.10.2026) and the batch type 'door' takes the doors defaults (box item 15).
 *
 * Two TABS = two instances of windowProfileStore (the same bundle imported twice
 * under different query strings, so two module records, two zustand stores, two
 * timers) over ONE fake cloud object (setWindowProfileCloud). Until 09.10.2026 a
 * save wrote { sash, casement, door } from the tab's memory whole, so a tab loaded
 * before a change on another computer removed that change (the bSuite target lost
 * on 07.10.2026).
 *
 *   1  two tabs, different paths: tab A adds a bSuite target, tab B (loaded earlier)
 *      changes a casement face; both save; the cloud holds both changes
 *   2  the same path in both tabs: the later save wins (BLOCKERS 31)
 *   3  the dirty list: refused edits mark nothing, resets mark the kind, a load keeps
 *      unsaved paths on top, a failed save keeps the paths dirty, an edit made while
 *      a save runs stays, mergeWindowProfiles is pure
 *   4  the Settings save never writes the login-time windowProfiles / assignments
 *   5  createBatch: 'door' and 'doors' take the doors defaults (one mapping)
 *
 * Run: node verify/parity/t46_settings_save.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const storeUrl = build('t46-profile-store', [
  `export * from '${resolve(ROOT, 'src/stores/windowProfileStore.js')}';`,
  `export * as profile from '${resolve(ROOT, 'src/engine/profile.js')}';`,
  `export * as cloud from '${resolve(ROOT, 'src/services/cloudSync.js')}';`,
]);
const projectUrl = build('t46-project-store', [`export * from '${resolve(ROOT, 'src/stores/projectStore.js')}';`]);

const warn = console.warn;
console.warn = (...a) => { if (/zustand persist/i.test(String(a[0]))) return; warn(...a); };

const TAB_A = await import(`${storeUrl}?tab=A`);
const TAB_B = await import(`${storeUrl}?tab=B`);
const PROJ = await import(`${projectUrl}?t=${Date.now()}`);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── the fake cloud: one settings row, constants.windowProfiles ──
function fakeCloud(initial) {
  const row = { windowProfiles: initial ? clone(initial) : null, writes: 0, fail: false };
  return {
    row,
    adapter: {
      // a failed read throws, as cloudSync.loadWindowProfiles does (review finding, 09.10.2026)
      load: async () => { if (row.failLoad) throw new Error('read failed'); return row.windowProfiles ? clone(row.windowProfiles) : null; },
      save: async (profiles) => { if (row.fail) return false; row.windowProfiles = clone(profiles); row.writes += 1; return true; },
    },
  };
}
const A = TAB_A.useWindowProfileStore, B = TAB_B.useWindowProfileStore;
const P = TAB_A.profile;
const defaults = () => ({ sash: clone(P.DEFAULT_SASH_PROFILE), casement: clone(P.DEFAULT_CASEMENT_PROFILE), door: clone(P.DEFAULT_DOOR_PROFILE) });
const target2 = (base) => ({ ...clone(base.targets[0]), id: 'office', name: 'Office PC' });

// ═════════════════════════════════════════════════════════════════════════════
section('1 - two tabs, different paths: both changes reach the cloud');
{
  ok(A !== B && A.getState() !== B.getState(), 'two store instances (two tabs)');
  const C = fakeCloud(defaults());
  TAB_A.setWindowProfileCloud(C.adapter);
  TAB_B.setWindowProfileCloud(C.adapter);
  await B.getState().loadFromCloud();          // tab B opens first
  await A.getState().loadFromCloud();          // then tab A
  // tab A: the bSuite target the owner lost on 07.10.2026
  const bs = A.getState().casement.bsuite;
  A.getState().setCasementBsuiteTargets([...clone(bs.targets), target2(bs)], 'office');
  ok(JSON.stringify(A.getState().dirty) === JSON.stringify(['casement.bsuite']), `tab A dirty: ${JSON.stringify(A.getState().dirty)}`);
  await A.getState().saveToCloud();
  ok(C.row.windowProfiles.casement.bsuite.targets.length === 2 && C.row.windowProfiles.casement.bsuite.activeTarget === 'office' && A.getState().dirty.length === 0,
    'tab A saved: the cloud holds the second bSuite target, tab A is clean');
  // tab B, loaded BEFORE A's change, changes a casement face and saves
  ok(B.getState().casement.bsuite.targets.length === 1, 'tab B still holds its stale copy (one target)');
  B.getState().setCasementLeafFace(66);
  ok(JSON.stringify(B.getState().dirty) === JSON.stringify(['casement.elements']), `tab B dirty: ${JSON.stringify(B.getState().dirty)}`);
  await B.getState().saveToCloud();
  const cc = C.row.windowProfiles.casement;
  ok(cc.bsuite.targets.length === 2 && cc.bsuite.activeTarget === 'office' && cc.elements.leafStile.face === 66 && cc.elements.leafTop.face === 66,
    'after both saves the cloud holds BOTH changes: tab A\'s bSuite target and tab B\'s face 66 (before 09.10.2026 tab B removed the target)');
  ok(cc.deductions.glass === Math.round(2 * (66 - cc.geometry.glassInset) * 10) / 10, `the merged casement glass deduction follows the merged faces: ${cc.deductions.glass}`);
  ok(B.getState().casement.bsuite.targets.length === 2 && B.getState().casement.elements.leafStile.face === 66 && B.getState().dirty.length === 0,
    'tab B took the merged copy as its local copy (it now has the target too) and is clean');
  // tab A comes back (visibilitychange / Window Settings entry): it reloads and sees B's face
  await A.getState().loadFromCloud();
  ok(A.getState().casement.elements.leafStile.face === 66 && A.getState().casement.bsuite.targets.length === 2, 'tab A reloads: face 66 and its own target');
  ok(P.getCasementProfile() !== null, 'the engine profile is pushed on every load / save');
  ok(JSON.stringify(C.row.windowProfiles.sash) === JSON.stringify(P.normalizeSashProfile(clone(P.DEFAULT_SASH_PROFILE))) && JSON.stringify(C.row.windowProfiles.door) === JSON.stringify(P.migrateDoorProfile(P.DEFAULT_DOOR_PROFILE)),
    'the other kinds stay as the cloud held them');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - the same path in both tabs: the later save wins');
{
  const C = fakeCloud(defaults());
  TAB_A.setWindowProfileCloud(C.adapter);
  TAB_B.setWindowProfileCloud(C.adapter);
  await A.getState().loadFromCloud();
  await B.getState().loadFromCloud();
  A.getState().setDoorPath(['deductions', 'leafAtFloor'], 50);
  B.getState().setDoorPath(['deductions', 'leafAtFloor'], 49);
  await A.getState().saveToCloud();
  await B.getState().saveToCloud();
  ok(C.row.windowProfiles.door.deductions.leafAtFloor === 49, `door.deductions in both tabs: the later save (tab B, 49) wins: ${C.row.windowProfiles.door.deductions.leafAtFloor}`);
  // sub-keys of one first key collide too (the granularity is profile.firstKey)
  A.getState().setDoorPath(['deductions', 'fanFromAxis'], 66);
  B.getState().setDoorPath(['deductions', 'leafBelowAxis'], 18);
  await A.getState().saveToCloud();
  await B.getState().saveToCloud();
  const d = C.row.windowProfiles.door.deductions;
  ok(d.leafBelowAxis === 18 && d.fanFromAxis === 65, `two sub-keys of door.deductions: tab B's later save carries its whole deductions block (fanFromAxis back to 65): the granularity is profile.firstKey (BLOCKERS 31)`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - the dirty list');
{
  const C = fakeCloud(defaults());
  TAB_A.setWindowProfileCloud(C.adapter);
  await A.getState().loadFromCloud();
  A.setState({ dirty: [] });
  A.getState().setDoorPath(['nonsense', 'x'], 1);
  A.getState().setDoorPath(['geometry', 'notAKey'], 1);
  A.getState().setCasementPath(['bsuite', 'noSuchKey'], 'x');
  A.getState().setCasementGeometry('notAKey', 3);
  ok(A.getState().dirty.length === 0, 'refused edits mark nothing dirty (a stale branch is never laid over the cloud)');
  A.getState().setDoorPath(['panel', 'edge', 'slope'], A.getState().door.panel.edge.slope);
  ok(A.getState().dirty.length === 0, 'an edit to the same value marks nothing');
  A.getState().resetToDefaults();
  ok(A.getState().dirty.length === 0, 'a reset that changes nothing marks nothing');
  A.getState().setHornExtension(77);
  A.getState().setCasementPath(['cnc', 'clampClearance'], 25);
  ok(JSON.stringify(A.getState().dirty) === JSON.stringify(['sash.hornExtension', 'casement.cnc']), `paths at profile.firstKey: ${JSON.stringify(A.getState().dirty)}`);
  // another computer saves a door change; tab A loads before saving: its unsaved paths stay on top
  C.row.windowProfiles.door.panel.inset = 16;
  C.row.windowProfiles.sash.hornExtension = 70;
  await A.getState().loadFromCloud();
  ok(A.getState().door.panel.inset === 16 && A.getState().sash.hornExtension === 77 && A.getState().casement.cnc.clampClearance === 25,
    'a load takes the cloud (panel inset 16) but keeps the unsaved local paths on top (horn 77, clamp 25)');
  // a failed write keeps everything dirty
  C.row.fail = true;
  const r = await A.getState().saveToCloud();
  ok(r === null && A.getState().dirty.length === 2 && C.row.windowProfiles.sash.hornExtension === 70, 'a failed save writes nothing and keeps the paths dirty');
  C.row.fail = false;
  // a failed READ keeps everything dirty too and writes nothing (it never merges over an "empty" cloud and
  // writes every kind whole: the stale overwrite of non-dirty paths this tura removes)
  C.row.failLoad = true;
  const writes0 = C.row.writes;
  const r2 = await A.getState().saveToCloud();
  await A.getState().loadFromCloud();   // a failed load keeps the local copy and the dirty list
  ok(r2 === null && C.row.writes === writes0 && A.getState().dirty.length === 2 && A.getState().sash.hornExtension === 77 && C.row.windowProfiles.sash.hornExtension === 70,
    'a failed cloud read: the save writes nothing, the paths stay dirty, a load keeps the local copy');
  C.row.failLoad = false;
  // an edit made while the save runs stays on top and stays dirty
  const slow = { load: async () => { const v = await C.adapter.load(); A.getState().setHornExtension(80); return v; }, save: C.adapter.save };
  TAB_A.setWindowProfileCloud(slow);
  await A.getState().saveToCloud();
  TAB_A.setWindowProfileCloud(C.adapter);
  ok(C.row.windowProfiles.sash.hornExtension === 77 && A.getState().sash.hornExtension === 80 && JSON.stringify(A.getState().dirty) === JSON.stringify(['sash.hornExtension']),
    'an edit made while the save ran (horn 80) stays local and dirty; the cloud got the value the save started with (77)');
  await A.getState().saveToCloud();
  ok(C.row.windowProfiles.sash.hornExtension === 80 && A.getState().dirty.length === 0, 'the next save carries it');
  // a reset marks the whole kind
  A.getState().setDoorPath(['frenchLip'], 7);
  await A.getState().saveToCloud();
  A.getState().resetDoorToDefaults();
  ok(JSON.stringify(A.getState().dirty) === JSON.stringify(['door']), 'resetDoorToDefaults marks door whole');
  await A.getState().saveToCloud();
  ok(JSON.stringify(C.row.windowProfiles.door) === JSON.stringify(A.getState().door) && A.getState().door.frenchLip === 6, 'a reset writes the whole default door profile');
  // the pure merge
  const cloud = defaults(); cloud.casement.cnc.minClampLength = 500; delete cloud.door;
  const local = defaults(); local.casement.arch.minPieceLength = 410; local.door.frenchLip = 9;
  const before = JSON.stringify([cloud, local]);
  const m = TAB_A.mergeWindowProfiles(cloud, local, ['casement.arch']);
  ok(JSON.stringify([cloud, local]) === before, 'mergeWindowProfiles does not touch its inputs');
  ok(m.casement.arch.minPieceLength === 410 && m.casement.cnc.minClampLength === 500 && m.door.frenchLip === 9,
    'merge: dirty casement.arch from local, casement.cnc from the cloud, a kind the cloud lacks (door) taken whole from local');
  const s1 = TAB_A.mergeWindowProfiles({ sash: { ...clone(P.DEFAULT_SASH_PROFILE), dedSchema: undefined } }, defaults(), []);
  ok(s1.sash.dedSchema === 2, 'the cloud copy is migrated before the overlay (normalizeSashProfile, on a clone)');
  const src = readFileSync(resolve(ROOT, 'src/stores/windowProfileStore.js'), 'utf8');
  ok(!Object.getOwnPropertyNames(A.getState()).some((k) => Object.getOwnPropertyDescriptor(A.getState(), k)?.get) && Array.isArray(A.getState().dirty), 'no getter properties; dirty is plain data');
  ok(/typeof document !== 'undefined'/.test(src) && /visibilitychange/.test(src) && /useEffect\(\(\) => \{ loadFromCloud\(\); \}, \[loadFromCloud\]\)/.test(readFileSync(resolve(ROOT, 'src/pages/WindowSettingsPage.jsx'), 'utf8')),
    'reload on the tab coming back (visibilitychange, browser only) and on entering Window Settings');
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - the Settings save never writes the login-time profiles');
{
  const f = TAB_A.cloud.settingsConstantsForSave;
  const stale = { company: { name: 'X' }, productionDays: 5, windowProfiles: { casement: { stale: true } }, assignments: { stale: true } };
  const cur = { productionDays: 4, windowProfiles: { casement: { fresh: true } }, assignments: { fresh: true }, other: 1 };
  const out = f(stale, cur);
  ok(out.productionDays === 5 && out.windowProfiles.casement.fresh === true && out.assignments.fresh === true && !('company' in out),
    'Settings keys from this tab, windowProfiles and assignments as the cloud holds them now');
  const out2 = f(stale, {});
  ok(!('windowProfiles' in out2) && !('assignments' in out2), 'a cloud without them: the save does not create them from the stale copy');
  const cs = readFileSync(resolve(ROOT, 'src/services/cloudSync.js'), 'utf8');
  ok(/settingsConstantsForSave\(settings, data\?\.constants\)/.test(cs), 'saveSettings reads the current constants and writes through settingsConstantsForSave');
  // review finding (09.10.2026): a failed read writes nothing (the upsert replaces the whole constants column)
  const fnBody = (name) => { const i = cs.indexOf(`export async function ${name}(`); return cs.slice(i, cs.indexOf('\n}\n', i)); };
  const ss = fnBody('saveSettings'), sa = fnBody('saveAssignments'), sw = fnBody('saveWindowProfiles'), lw = fnBody('loadWindowProfiles');
  const abortsBeforeUpsert = (body, re) => { const m = re.exec(body); return !!m && m.index < body.indexOf('.upsert('); };
  ok(abortsBeforeUpsert(ss, /if \(error\) \{[^}]*return; \}/) && abortsBeforeUpsert(sa, /if \(readError\) \{[^}]*return; \}/) && abortsBeforeUpsert(sw, /if \(readError\) \{[^}]*return false; \}/),
    'saveSettings, saveAssignments and saveWindowProfiles stop before the upsert when the read of constants fails');
  ok(/if \(error\) \{[^}]*throw new Error/.test(lw), 'loadWindowProfiles throws on a failed read (null only for "no profiles yet")');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - createBatch: door and doors take the doors defaults');
{
  const st = PROJ.useProjectStore.getState();
  const p = st.createProject('Doors', '1 Door St', 'PRJ-D', null, 'Client');
  const b1 = st.createBatch(p.id, 'door');
  const b2 = st.createBatch(p.id, 'doors');
  const b3 = st.createBatch(p.id, 'sash');
  const D = PROJ.BATCH_DEFAULTS;
  ok(JSON.stringify(b1.defaults) === JSON.stringify(D.doors) && JSON.stringify(b2.defaults) === JSON.stringify(D.doors), `type 'door' (an estimate moved to production) and 'doors' (the project page): the doors defaults (${D.doors.ironmongery}, horn ${D.doors.hornType}, pas24 ${D.doors.pas24})`);
  ok(JSON.stringify(b3.defaults) === JSON.stringify(D.sash) && b1.defaults !== D.doors, 'sash keeps the sash defaults; every batch gets its own copy');
  ok(JSON.stringify(PROJ.batchDefaultsFor('door')) === JSON.stringify(D.doors) && JSON.stringify(PROJ.batchDefaultsFor('nonsense')) === JSON.stringify(D.sash), 'batchDefaultsFor: the one mapping (unknown types: sash)');
  ok(b1.type === 'door' && b2.type === 'doors', 'the stored type is kept as given (only the defaults map)');
  const page = readFileSync(resolve(ROOT, 'src/pages/BatchDefaultsPage.jsx'), 'utf8');
  const store = readFileSync(resolve(ROOT, 'src/stores/projectStore.js'), 'utf8');
  ok(/batchDefaultsFor\(batch\?\.type\)/.test(page) && /batch\.type === 'doors' \? 'door'/.test(page) && (store.match(/BATCH_DEFAULTS\[/g) || []).length === 1,
    'Batch Defaults page: the same mapping, door slots for both spellings; BATCH_DEFAULTS indexed in ONE place');
  const mtp = readFileSync(resolve(ROOT, 'src/utils/moveToProduction.js'), 'utf8');
  ok(/createBatch\(/.test(mtp) && !/BATCH_DEFAULTS/.test(mtp), 'moveToProduction builds no defaults itself (createBatch maps them)');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
