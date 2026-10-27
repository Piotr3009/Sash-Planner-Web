/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t52: fire doors v1 (Piotr 27.10.2026), the pages a user clicks, driven in a
 * real browser the way t39 drives the casement leaf cards. Three parts, one
 * Chromium, each part its own esbuild iife bundle of the live page with the
 * stores (the Supabase client reads an empty import.meta.env, so nothing
 * touches the network):
 *   A  Window Settings · Fire Doors: the sample door readout (902 x 2083, the
 *      hinges 150 / 944 / 1738 and 188 / 982 / 1776, the keep 990, the
 *      intumescent 4.906 m, the rebate 15 x 47, the members), the FD60 / non-fire
 *      sample chips, the hinges card (a typed top offset 145 moves the sample to
 *      145 / 941.5 / 1738), the leaf width list (sorted, unique, junk dropped),
 *      the defaults card (rating, fire, the selects, a custom VP number), the
 *      bSuite card (STOP rows, the leaf path with quotes stripped, add / fill /
 *      remove target, a macro default), the head joint select, the reset;
 *   B  the configurator on a fire door batch: the proposed name FDR-01, the Fire
 *      Door section (no Dimensions / Ventilation / Horns), the live box and the
 *      summary numbers, the slots, fire OFF renaming to DR-01 (a typed name kept),
 *      a free width 803 (no clamp), the 926 chip, a width 200 disabling Save with
 *      the geometry message, the closer / lock / VP controls, the save (the
 *      stored firedoor* keys, width = the frame overall), the second door FDR-02
 *      prefilled from the first, DR-01, edit mode never renames;
 *   C  the project page (the Fire doors batch, the card 902 x 2083 and its
 *      subtitle, Add Batch, Project Materials), the batch defaults page (the fire
 *      door slots, no sash rows), Material Assignments · Fire doors (live, the
 *      four sections and their rows), the dashboard (the type key, the new pack
 *      select).
 * Every number is typed as a literal and read back from the live store or the
 * rendered page.
 *
 * Needs the Chromium that Playwright finds (PLAYWRIGHT_BROWSERS_PATH) and the
 * playwright package of the global node install; it never downloads a browser.
 * Without them it exits 2 (not a failure, like t39).
 *
 * Run: node verify/parity/t52_fire_door_ui.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

// playwright from the global node install (no project dependency)
let chromium = null;
try {
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  const entry = resolve(globalRoot, 'playwright', 'index.mjs');
  if (existsSync(entry)) ({ chromium } = await import(pathToFileURL(entry).href));
} catch { chromium = null; }
if (!chromium) {
  console.log('playwright not found in the global node install: this harness needs it (and its Chromium) to drive the pages.');
  process.exit(2);
}

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const J = (o) => JSON.stringify(o);

// one browser bundle per part: the entry (jsx) in .audit, bundled iife for the browser
const bundle = (name, source) => {
  const entry = resolve(AUDIT, `${name}-entry.jsx`);
  writeFileSync(entry, source);
  const out = resolve(AUDIT, `${name}-bundle.js`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=iife', '--platform=browser',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--define:process.env.NODE_ENV="production"', '--log-level=error', `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const html = resolve(AUDIT, `${name}.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="${name}-bundle.js"></script></body></html>`);
  return pathToFileURL(html).href;
};

const browser = await chromium.launch();
const open = async (url, viewport, readySelector) => {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector(readySelector);
  await page.waitForTimeout(150);
  return { page, errors };
};

// ═════════════════════════════════════════════════════════════════════════════
section('A - Window Settings · Fire Doors');
{
  const url = bundle('t52-settings', [
    "import React from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { MemoryRouter, Routes, Route } from 'react-router-dom';",
    "import SettingsPage from '../src/pages/WindowSettingsPage.jsx';",
    "import { useWindowProfileStore } from '../src/stores/windowProfileStore.js';",
    "import { DEFAULT_FIREDOOR_PROFILE } from '../src/engine/profile.js';",
    'window.__store = useWindowProfileStore;',
    'window.__fdDefault = DEFAULT_FIREDOOR_PROFILE;',
    'window.confirm = () => true;',
    "createRoot(document.getElementById('root')).render(",
    "  React.createElement(MemoryRouter, { initialEntries: ['/window-settings/firedoor'] },",
    "    React.createElement(Routes, null, React.createElement(Route, { path: '/window-settings/:typeId', element: React.createElement(SettingsPage) }))));",
  ].join('\n'));
  const { page, errors } = await open(url, { width: 1600, height: 1400 }, 'text=Window Settings · Fire Doors');
  const sampleText = async () => (await page.locator('[data-fd-sample]').innerText()).replace(/\s+/g, ' ');
  const st = () => page.evaluate(() => {
    const f = window.__store.getState().firedoor;
    return { top: f.hinges.topOffset, widths: f.leaf.widthSuggestions, rating: f.defaults.rating, stop: f.bsuite.stopRows, fire: f.defaults.fire, joint: f.frame.headJoint, leafPath: f.bsuite.targets[0].programs.leaf.path, active: f.bsuite.activeTarget };
  });
  const defaultTarget = await page.evaluate(() => window.__fdDefault.bsuite.activeTarget);
  ok(typeof defaultTarget === 'string' && defaultTarget.length > 0 && (await st()).active === defaultTarget, `the store's fire door bsuite activeTarget is the profile default "${defaultTarget}"`);

  // the sample door readout (the brief's 3.10 numbers)
  let t = await sampleText();
  ok(/Frame overall\s*902 × 2083/.test(t), 'sample: frame overall 902 × 2083', t);
  ok(/Hinges \(leaf top\)\s*150 \/ 944 \/ 1738/.test(t), 'sample: hinges 150 / 944 / 1738 from the leaf top', t);
  ok(/Hinges \(jamb top\)\s*188 \/ 982 \/ 1776/.test(t), 'sample: jamb hinges 188 / 982 / 1776', t);
  ok(/Keep centre\s*990 above the jamb foot/.test(t), 'sample: keep centre 990 above the jamb foot', t);
  ok(/Intumescent\s*15 × 4 × 1 · 4\.906 m/.test(t), 'sample: intumescent 15 × 4 × 1 · 4.906 m', t);
  ok(/Rebate\s*15 × 47 · faces 35 \/ 50/.test(t), 'sample: rebate 15 × 47, faces 35 / 50', t);
  ok(/FD-HEAD\s*902 long point · 63x105 · mitre top · mitre bottom/.test(t), 'sample: FD-HEAD 902 long point, 63x105, mitred both ends', t);
  ok(/FD-JAMB-H\s*2083 long point · 63x105 · mitre top(?! · mitre bottom)/.test(t), 'sample: FD-JAMB-H 2083 long point, mitre top only', t);
  // the sample chips: FD60 (leaf 54, rebate depth 57), non-fire (no intumescent, HINGE 0, LOCK 1)
  await page.locator('button', { hasText: /^FD60$/ }).first().click();
  t = await sampleText();
  ok(/Leaf\s*826 × 2040 × 54/.test(t) && /Rebate\s*15 × 57/.test(t), 'sample FD60: leaf 54, rebate depth 57', t);
  await page.locator('button', { hasText: /^FD30$/ }).first().click();
  await page.locator('button', { hasText: /^Non-fire$/ }).first().click();
  t = await sampleText();
  ok(/Intumescent\s*none/.test(t) && /Hinge macro\s*HINGE 0 · standard/.test(t) && /Lock\s*latch · LOCK 1/.test(t), 'sample non-fire: no intumescent, HINGE 0 · standard, latch · LOCK 1', t);
  await page.locator('button', { hasText: /^Fire$/ }).first().click();

  // the hinges card: unlock, type Top offset 145, the store and the sample follow
  const hingesCard = page.locator('div.card').filter({ hasText: /^Hinges/ }).first();
  await hingesCard.locator('button[title="Unlock to edit"]').click();
  const topInput = hingesCard.locator('input[type="number"]').nth(2);   // count, length, topOffset
  ok(await topInput.inputValue() === '150', `hinges card: the top offset input shows ${await topInput.inputValue()}`);
  await topInput.fill('145'); await topInput.blur(); await page.waitForTimeout(80);
  let s = await st();
  ok(s.top === 145, `store hinges.topOffset ${s.top} after typing 145`);
  t = await sampleText();
  ok(/Hinges \(leaf top\)\s*145 \/ 941\.5 \/ 1738/.test(t), 'the sample follows: hinges 145 / 941.5 / 1738 (step 796.5)', t);

  // the leaf card: the width suggestions comma list
  const leafCard = page.locator('div.card').filter({ hasText: /^Leaf/ }).first();
  await leafCard.locator('button[title="Unlock to edit"]').click();
  const listInput = leafCard.locator('input[type="text"]').first();
  ok(await listInput.inputValue() === '626, 686, 726, 762, 826, 838, 926, 1056', `leaf card: the width list shows "${await listInput.inputValue()}"`);
  await listInput.fill('700, 600, junk, 700'); await listInput.blur(); await page.waitForTimeout(80);
  s = await st();
  ok(J(s.widths) === '[600,700]', `store leaf.widthSuggestions ${J(s.widths)} (sorted, unique, junk dropped)`);

  // the defaults card: the rating chip and the fire chip (string and boolean leaves)
  const defCard = page.locator('div.card').filter({ hasText: /^Defaults of a new door/ }).first();
  await defCard.locator('button[title="Unlock to edit"]').click();
  await defCard.locator('button', { hasText: /^FD60$/ }).click(); await page.waitForTimeout(50);
  s = await st();
  ok(s.rating === 'FD60', `store defaults.rating "${s.rating}" (a string leaf)`);
  await defCard.locator('button', { hasText: /^No$/ }).first().click(); await page.waitForTimeout(50);
  s = await st();
  ok(s.fire === false, `store defaults.fire ${s.fire} (a boolean leaf)`);

  // the bSuite card: STOP rows off, the leaf path edited (quotes stripped), the four program keys
  const bsCard = page.locator('div.card').filter({ hasText: /^bSuite export/ }).first();
  await bsCard.locator('button[title="Unlock to edit"]').click();
  await bsCard.locator('button', { hasText: /^No$/ }).first().click(); await page.waitForTimeout(50);
  s = await st();
  ok(s.stop === false, `store bsuite.stopRows ${s.stop}`);
  const leafPath = bsCard.locator('input.font-mono').first();
  await leafPath.fill('"D:/Biesse/FD_LEAF.bSolid"'); await leafPath.blur(); await page.waitForTimeout(80);
  s = await st();
  ok(s.leafPath === 'D:/Biesse/FD_LEAF.bSolid', `store leaf program path "${s.leafPath}" (quotes stripped)`);
  const bsText = await bsCard.innerText();
  ok(/JAMB HINGE/.test(bsText) && /JAMB LOCK/.test(bsText) && /HEAD/.test(bsText) && /LEAF/.test(bsText) && !/FD-HEAD/.test(bsText), 'the bSuite card lists the four program keys (leaf, head, jamb hinge, jamb lock)');
  // targets: add, fill from a folder (paths only), remove; a macro default
  await bsCard.locator('button', { hasText: /^\+ add$/ }).click(); await page.waitForTimeout(80);
  let tg = await page.evaluate(() => { const b = window.__store.getState().firedoor.bsuite; return { n: b.targets.length, active: b.activeTarget, names: b.targets.map((x) => x.name) }; });
  ok(tg.n === 2 && tg.active !== defaultTarget && tg.names[1] === 'Computer 2', `add target: ${tg.n} targets, the new one "${tg.names[1]}" active (${tg.active})`);
  const fill = bsCard.locator('input[placeholder="C:/Users/Xp600/Desktop/Biesse Piotr"]');
  await fill.fill('"E:\\Rover\\fire"'); await fill.press('Enter'); await page.waitForTimeout(80);
  tg = await page.evaluate(() => { const b = window.__store.getState().firedoor.bsuite; const x = b.targets.find((y) => y.id === b.activeTarget); return { leaf: x.programs.leaf.path, head: x.programs.head.path }; });
  ok(tg.leaf === 'E:/Rover/fire/FD_LEAF.bSolid' && tg.head === '', `fill from a folder: leaf "${tg.leaf}", the head path stays "${tg.head}" (no frame master yet)`);
  await bsCard.locator('button', { hasText: /^remove target$/ }).click(); await page.waitForTimeout(80);
  tg = await page.evaluate(() => { const b = window.__store.getState().firedoor.bsuite; return { n: b.targets.length, active: b.activeTarget }; });
  ok(tg.n === 1 && tg.active === defaultTarget, `remove target: ${tg.n} target, active "${tg.active}" (the default again)`);
  const spyH = bsCard.locator('div.font-mono', { hasText: /^SPY_H$/ }).locator('..').locator('input[type="number"]').first();
  await spyH.fill('1500'); await spyH.blur(); await page.waitForTimeout(80);
  const md = await page.evaluate(() => { const m = window.__store.getState().firedoor.bsuite.macroDefaults; return { spy: m.SPY_H, spindle: m.SPINDLE }; });
  ok(md.spy === 1500 && md.spindle === 1, `macroDefaults.SPY_H ${md.spy}, SPINDLE untouched ${md.spindle}`);
  // the defaults selects and a custom VP number
  await defCard.locator('select').first().selectOption('1'); await page.waitForTimeout(50);
  await defCard.locator('select').nth(1).selectOption('4'); await page.waitForTimeout(50);
  const vpIn = defCard.locator('div', { hasText: /^Length$/ }).locator('..').locator('input[type="number"]').first();
  await vpIn.fill('650'); await vpIn.blur(); await page.waitForTimeout(80);
  const df = await page.evaluate(() => { const d = window.__store.getState().firedoor.defaults; return { vp: d.vpStyle, intu: d.intuStyle, len: d.vpCustom.length }; });
  ok(df.vp === 1 && df.intu === 4 && df.len === 650, `defaults: vpStyle ${df.vp}, intuStyle ${df.intu}, vpCustom.length ${df.len} (numbers)`);
  // the frame card: the head joint select holds mitre only
  const frameCard = page.locator('div.card').filter({ hasText: /^Frame/ }).first();
  const joints = await frameCard.locator('select option').allTextContents();
  ok(joints.length === 1 && /mitre/.test(joints[0]), `the head joint select offers mitre only (${joints.join(' | ')})`);
  // the reset
  await page.locator('button', { hasText: 'Reset fire doors to defaults' }).first().click();
  await page.waitForTimeout(80);
  s = await st();
  ok(s.top === 150 && s.rating === 'FD30' && s.stop === true && s.fire === true && J(s.widths) === '[626,686,726,762,826,838,926,1056]' && s.active === defaultTarget, `reset: top ${s.top}, rating ${s.rating}, stop ${s.stop}, fire ${s.fire}, the width list and the target back`);
  t = await sampleText();
  ok(/Hinges \(leaf top\)\s*150 \/ 944 \/ 1738/.test(t), 'the sample is back to 150 / 944 / 1738');
  ok(errors.length === 0, 'settings: no page errors', errors.join(' | ').slice(0, 600));
  await page.close();
}

// ═════════════════════════════════════════════════════════════════════════════
section('B - the configurator on a fire door batch');
{
  const url = bundle('t52-configurator', `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import ConfiguratorPage from '../src/pages/ConfiguratorPage.jsx';
import { useProjectStore } from '../src/stores/projectStore.js';
import { useWindowProfileStore } from '../src/stores/windowProfileStore.js';
window.__project = useProjectStore;
window.__profile = useWindowProfileStore;
window.confirm = () => true;
const st = useProjectStore.getState();
const project = st.createProject('FD test', '', 'P-FD', null, '');
const batch = st.createBatch(project.id, 'firedoor');
window.__ids = { projectId: project.id, batchId: batch.id };
function ProjectStub() {
  const { projectId } = useParams();
  const p = useProjectStore((s) => s.projects.find((x) => x.id === projectId));
  const b = p?.batches?.[0];
  return React.createElement('div', null,
    React.createElement('div', { 'data-stub': 'project' }, 'PROJECT STUB ' + (b?.windows?.length || 0)),
    React.createElement(Link, { to: '/projects/' + projectId + '/batches/' + b.id + '/configurator', 'data-link': 'new' }, 'NEW DOOR'),
    b?.windows?.[0] && React.createElement(Link, { to: '/projects/' + projectId + '/batches/' + b.id + '/configurator?edit=' + b.windows[0].id, 'data-link': 'edit' }, 'EDIT FIRST'));
}
createRoot(document.getElementById('root')).render(
  React.createElement(MemoryRouter, { initialEntries: ['/projects/' + project.id + '/batches/' + batch.id + '/configurator'] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/projects/:projectId/batches/:batchId/configurator', element: React.createElement(ConfiguratorPage) }),
      React.createElement(Route, { path: '/projects/:projectId/batches/:batchId/windows/:windowId', element: React.createElement(ProjectStub) }),
      React.createElement(Route, { path: '/projects/:projectId', element: React.createElement(ProjectStub) }))));
`);
  const { page, errors } = await open(url, { width: 1700, height: 1400 }, 'text=Add Window');
  const nameInput = () => page.locator('input[placeholder="Window name (max 7)"]');
  const liveBox = async () => (await page.locator('[data-firedoor-live]').innerText()).replace(/\s+/g, ' ');
  const rightPanel = async () => (await page.locator('div.w-64').innerText()).replace(/\s+/g, ' ');
  const leftPanel = async () => (await page.locator('div.w-80').innerText()).replace(/\s+/g, ' ');
  const saveBtn = () => page.locator('button', { hasText: /Save to Batch|Update Window/ }).first();
  const fdSec = () => page.locator('div.px-4.py-3').filter({ hasText: /^FIRE DOOR/i }).first();
  const leafWidthInput = () => fdSec().locator('input[type="number"]').nth(0);

  ok(await nameInput().inputValue() === 'FDR-01', `a new door proposes the name "${await nameInput().inputValue()}"`);
  let lp = await leftPanel();
  ok(/Fire Door/.test(lp) && !/Dimensions \(Frame\)/.test(lp) && !/Ventilation/.test(lp) && !/Horns & Security/.test(lp), 'the form: a Fire Door section, no Dimensions / Ventilation / Horns sections');
  let lb = await liveBox();
  ok(/Frame overall 902 x 2083 · rebate 15 x 47 · members 50 x 100 finished, 63 x 105 raw/.test(lb), `the live box: "${lb}"`);
  let rp = await rightPanel();
  ok(/Frame\s*902 × 2083/.test(rp) && /Depth\s*100mm/.test(rp), 'the summary: frame overall 902 × 2083, depth 100', rp);
  ok(/Hinges \(leaf top\)\s*150 \/ 944 \/ 1738/.test(rp) && /Hinges \(jamb top\)\s*188 \/ 982 \/ 1776/.test(rp), 'the summary: hinges 150 / 944 / 1738 and 188 / 982 / 1776', rp);
  ok(/Keep centre\s*990 from the jamb foot/.test(rp) && /Intumescent\s*15 × 4 · 4\.906 m/.test(rp), 'the summary: keep 990, intumescent 4.906 m', rp);
  ok(/Hand\s*Hinge left · opens in/.test(rp) && /Rating\s*FD30/.test(rp) && /Leaf\s*826 × 2040 × 44/.test(rp), 'the summary: Hinge left · opens in, FD30, leaf 826 × 2040 × 44', rp);
  ok(!/Ventilation/.test(rp) && !/PAS24/.test(rp), 'the summary: no Ventilation, no PAS24');
  ok(/Fire Door Locks/.test(lp) && /Keeps/.test(lp) && /Door Closers/.test(lp) && /Door Hinges/.test(lp) && !/Trickle Vents/.test(lp), 'the slots: Fire Door Locks, Keeps, Door Closers, Door Hinges, no Trickle Vents');

  // fire OFF: the name prefix, the rating and the intumescent hidden, the closer follows
  await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'DR-01', `fire OFF renames the unsaved door to "${await nameInput().inputValue()}"`);
  lp = await leftPanel(); rp = await rightPanel();
  ok(!/Rating/.test(lp) && !/INTU_STYLE/.test(lp) && /follows fire: no/.test(lp), 'fire OFF: the rating and the intumescent hidden, the closer follows fire (no)');
  ok(/Rating\s*Non-fire/.test(rp) && /Closer\s*No/.test(rp) && !/Intumescent/.test(rp), 'the summary fire OFF: Non-fire, closer No, no intumescent row', rp);
  await fdSec().locator('button', { hasText: /^Fire door$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'FDR-01', `fire ON again: "${await nameInput().inputValue()}"`);
  await nameInput().fill('MYDOOR'); await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'MYDOOR', `a typed name survives the fire toggle: "${await nameInput().inputValue()}"`);
  await nameInput().fill(''); await fdSec().locator('button', { hasText: /^Fire door$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'FDR-01', `an emptied field takes the proposal again: "${await nameInput().inputValue()}"`);

  // a free width, the chips, a bad width
  await leafWidthInput().fill('803'); await page.waitForTimeout(100);
  lb = await liveBox();
  ok(/Frame overall 879 x 2083/.test(lb), `a free width 803 derives without clamp: ${lb.split(' · ')[0]}`);
  await fdSec().locator('button', { hasText: /^926$/ }).click(); await page.waitForTimeout(100);
  ok(/Frame overall 1002 x 2083/.test(await liveBox()) && await leafWidthInput().inputValue() === '926', 'the 926 chip inserts the width: overall 1002 x 2083');
  await leafWidthInput().fill('200'); await page.waitForTimeout(100);
  ok(await saveBtn().isDisabled(), 'a width 200: Save disabled');
  const err = (await page.locator('[data-firedoor-error]').innerText()).trim();
  ok(/^Geometry: .*200.*outside 300 to 1500/.test(err), `a width 200: the summary shows "${err}"`);
  await leafWidthInput().fill('826'); await page.waitForTimeout(100);
  ok(!(await saveBtn().isDisabled()) && (await page.locator('[data-firedoor-error]').count()) === 0, 'a width 826: Save enabled, the error gone');
  // the closer picked by hand, a euro lock, a VP style
  await fdSec().locator('button', { hasText: /^No$/ }).first().click(); await page.waitForTimeout(50);   // the first Yes / No pair is the closer
  await fdSec().locator('button', { hasText: /^Sashlock euro$/ }).click(); await page.waitForTimeout(50);
  await fdSec().locator('select').first().selectOption('1'); await page.waitForTimeout(100);
  rp = await rightPanel();
  ok(/Closer\s*No/.test(rp) && /Lock\s*Sashlock euro · spindle 1000 up/.test(rp) && /Vision panel\s*450mm Square/.test(rp), 'closer No, Sashlock euro · spindle 1000 up, VP 450mm Square in the summary', rp);

  // the save
  await saveBtn().click();
  await page.waitForSelector('[data-stub="project"]');
  const saved = await page.evaluate(() => {
    const { projectId } = window.__ids;
    const p = window.__project.getState().projects.find((x) => x.id === projectId);
    const w = p.batches[0].windows[0];
    const spec = JSON.parse(w.specification || '{}');
    return { ...w, specCategory: spec?.fullConfig?.windowCategory, specType: spec?.windowType, count: p.batches[0].windows.length };
  });
  ok(saved.count === 1 && saved.name === 'FDR-01', `saved: ${saved.count} window, name ${saved.name}`);
  ok(saved.width === 902 && saved.height === 2083 && saved.inputWidth === 902 && saved.inputHeight === 2083, `the saved size is the frame overall ${saved.width} x ${saved.height} (input ${saved.inputWidth} x ${saved.inputHeight})`);
  ok(saved.specCategory === 'firedoor' && saved.specType === 'firedoor', `the specification: category ${saved.specCategory}, type ${saved.specType}`);
  const KEYS = ['firedoorFire', 'firedoorRating', 'firedoorLeafWidth', 'firedoorLeafHeight', 'firedoorHingeSide', 'firedoorSwing', 'firedoorFrameDepth', 'firedoorLockType', 'firedoorCloser', 'firedoorVpStyle', 'firedoorVpCustom', 'firedoorIntuStyle', 'firedoorLeadEdge'];
  const missing = KEYS.filter((k) => saved[k] === undefined);
  ok(missing.length === 0, 'the saved window carries every contract key at top level', `missing: ${missing.join(',')}`);
  ok(saved.firedoorFire === true && saved.firedoorRating === 'FD30' && saved.firedoorLeafWidth === 826 && saved.firedoorLeafHeight === 2040 && saved.firedoorHingeSide === 'left' && saved.firedoorSwing === 'in' && saved.firedoorFrameDepth === 100 && saved.firedoorLockType === 'euro' && saved.firedoorCloser === false && saved.firedoorVpStyle === 1 && saved.firedoorIntuStyle === 1 && saved.firedoorLeadEdge === true,
    `the saved values: ${KEYS.map((k) => `${k}=${J(saved[k])}`).join(' ')}`);
  ok(saved.ventRoomType === 'other' && saved.pas24 === false && saved.childRestrictor === false, `vent ${saved.ventRoomType}, pas24 ${saved.pas24}, restrictor ${saved.childRestrictor} (the sash fields neutral)`);

  // a second new door: copied from the last, the next free number
  await page.locator('[data-link="new"]').click();
  await page.waitForSelector('text=Add Window'); await page.waitForTimeout(200);
  ok(await nameInput().inputValue() === 'FDR-02', `the second door proposes "${await nameInput().inputValue()}"`);
  rp = await rightPanel();
  ok(/Lock\s*Sashlock euro/.test(rp) && /Vision panel\s*450mm Square/.test(rp) && /Closer\s*No/.test(rp), 'the second door is prefilled from the first (euro, VP 1, closer No)', rp);
  await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'DR-01', `the second door fire OFF: "${await nameInput().inputValue()}"`);
  await saveBtn().click();
  await page.waitForSelector('[data-stub="project"]');
  const second = await page.evaluate(() => { const p = window.__project.getState().projects.find((x) => x.id === window.__ids.projectId); const w = p.batches[0].windows[1]; return { name: w.name, fire: w.firedoorFire, intu: w.firedoorIntuStyle, closer: w.firedoorCloser }; });
  ok(second.name === 'DR-01' && second.fire === false && second.intu === 0, `the second saved: ${second.name}, fire ${second.fire}, INTU_STYLE ${second.intu}, closer ${second.closer}`);

  // edit mode: the saved name never changes on the fire toggle; the update keeps the keys
  await page.locator('[data-link="edit"]').click();
  await page.waitForSelector('text=Edit FDR-01'); await page.waitForTimeout(200);
  ok(await nameInput().inputValue() === 'FDR-01', `edit mode name: "${await nameInput().inputValue()}"`);
  ok(await leafWidthInput().inputValue() === '826' && /Lock\s*Sashlock euro/.test(await rightPanel()), 'edit mode prefilled from the saved firedoor* keys');
  await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'FDR-01', `edit mode: fire OFF does not rename ("${await nameInput().inputValue()}")`);
  await leafWidthInput().fill('838'); await page.waitForTimeout(100);
  await saveBtn().click();
  await page.waitForSelector('[data-stub="project"]');
  const edited = await page.evaluate(() => { const p = window.__project.getState().projects.find((x) => x.id === window.__ids.projectId); const w = p.batches[0].windows[0]; return { name: w.name, fire: w.firedoorFire, width: w.width, leaf: w.firedoorLeafWidth, lock: w.firedoorLockType }; });
  ok(edited.name === 'FDR-01' && edited.fire === false && edited.leaf === 838 && edited.width === 914 && edited.lock === 'euro', `edited: ${edited.name}, fire ${edited.fire}, leaf ${edited.leaf}, width ${edited.width} (838 + 76), lock ${edited.lock}`);
  ok(errors.length === 0, 'configurator: no page errors', errors.join(' | ').slice(0, 600));
  await page.close();
}

// ═════════════════════════════════════════════════════════════════════════════
section('C - the project page, the batch defaults, Material Assignments, the dashboard');
{
  const url = bundle('t52-pages', `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ProjectDetailPage from '../src/pages/ProjectDetailPage.jsx';
import BatchDefaultsPage from '../src/pages/BatchDefaultsPage.jsx';
import MaterialAssignmentsPage from '../src/pages/MaterialAssignmentsPage.jsx';
import DashboardPage from '../src/pages/DashboardPage.jsx';
import { useProjectStore } from '../src/stores/projectStore.js';
window.__project = useProjectStore;
window.confirm = () => true;
const st = useProjectStore.getState();
const project = st.createProject('FD pages', '', 'P-FD2', null, '');
const batch = st.createBatch(project.id, 'firedoor');
st.addWindowToBatch(project.id, batch.id, {
  windowName: 'FDR-01', windowCategory: 'firedoor', extWidth: 902, extHeight: 2083, inputWidth: 902, inputHeight: 2083,
  firedoorFire: true, firedoorRating: 'FD30', firedoorLeafWidth: 826, firedoorLeafHeight: 2040, firedoorHingeSide: 'right', firedoorSwing: 'in',
  firedoorFrameDepth: 100, firedoorLockType: 'latch', firedoorCloser: true, firedoorVpStyle: 0,
  firedoorVpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 }, firedoorIntuStyle: 1, firedoorLeadEdge: true,
  ventRoomType: 'other', pas24: false, childRestrictor: false, glassType: 'double', glassSpec: 'toughened', woodColor: '#F6F6F6',
});
window.__ids = { projectId: project.id, batchId: batch.id };
function Nav() {
  return React.createElement('div', null,
    React.createElement(Link, { to: '/projects/' + project.id, 'data-link': 'project' }, 'PROJECT'),
    React.createElement(Link, { to: '/projects/' + project.id + '/batches/' + batch.id + '/defaults', 'data-link': 'defaults' }, 'DEFAULTS'),
    React.createElement(Link, { to: '/materials/assignments/firedoor', 'data-link': 'materials' }, 'MATERIALS'),
    React.createElement(Link, { to: '/dashboard', 'data-link': 'dashboard' }, 'DASHBOARD'));
}
createRoot(document.getElementById('root')).render(
  React.createElement(MemoryRouter, { initialEntries: ['/projects/' + project.id] },
    React.createElement(React.Fragment, null,
      React.createElement(Nav),
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/projects/:projectId', element: React.createElement(ProjectDetailPage) }),
        React.createElement(Route, { path: '/projects/:projectId/batches/:batchId/defaults', element: React.createElement(BatchDefaultsPage) }),
        React.createElement(Route, { path: '/materials/assignments/:typeId', element: React.createElement(MaterialAssignmentsPage) }),
        React.createElement(Route, { path: '/dashboard', element: React.createElement(DashboardPage) }),
        React.createElement(Route, { path: '*', element: React.createElement('div', { 'data-stub': 'other' }, 'OTHER') })))));
`);
  const { page, errors } = await open(url, { width: 1700, height: 1400 }, 'text=FD pages');
  const body = async () => (await page.locator('#root').innerText()).replace(/\s+/g, ' ');

  // the project page
  let t = await body();
  ok(/Fire doors/.test(t), 'project page: the batch type label "Fire doors"', t.slice(0, 300));
  ok(/902 × 2083 mm/.test(t), 'project page: the window card prints the frame overall 902 × 2083', t.slice(0, 400));
  ok(/FD30 · leaf 826 x 2040 · Hinge right/.test(t), 'project page: the card subtitle "FD30 · leaf 826 x 2040 · Hinge right"', t.slice(0, 500));
  ok((await page.locator('[data-window-error]').count()) === 0, 'project page: the fire door derives (no card error)');
  ok(/Rating: FD30/.test(t) && /Lock: latch/.test(t) && /Closer: yes/.test(t) && !/Horns:/.test(t) && !/PAS24:/.test(t), 'project page: the batch strip prints Rating FD30, Lock latch, Closer yes and no Horns / PAS24 row', t.slice(0, 700));
  await page.locator('button', { hasText: '+ Add Batch' }).click(); await page.waitForTimeout(50);
  ok((await page.locator('button', { hasText: /Fire doors$/ }).count()) >= 1, 'project page: Add Batch offers Fire doors');
  await page.locator('button', { hasText: /^Cancel$/ }).click();
  await page.locator('button', { hasText: 'Project Materials' }).click(); await page.waitForTimeout(100);
  t = await body();
  ok(/Door blank FD30/i.test(t) && /hinge/i.test(t) && !/No materials yet/.test(t), 'project materials: the fire door rows (the FD30 blank, the hinges) reach the purchase list', t.slice(0, 900));
  await page.locator('button', { hasText: /^Close$/ }).click();

  // the batch defaults
  await page.locator('[data-link="defaults"]').click();
  await page.waitForSelector('text=Defaults'); await page.waitForTimeout(100);
  t = await body();
  ok(/Fire Door Locks/.test(t) && /Keeps/.test(t) && /Door Closers/.test(t) && /Door Hinges/.test(t) && /Door Handles/.test(t), 'batch defaults: the fire door slots listed', t.slice(0, 600));
  ok(!/Trickle Vents/.test(t) && !/Pulleys/.test(t) && !/PAS 24/.test(t) && !/Standard \(164mm\)/.test(t), 'batch defaults: no trickle vents, no sash slots, no PAS24, no sash frame section');

  // Material Assignments · Fire doors
  await page.locator('[data-link="materials"]').click();
  await page.waitForSelector('text=Material Assignments'); await page.waitForTimeout(100);
  t = await body();
  ok(/Material Assignments . Fire doors/.test(t), 'materials page: the heading "Material Assignments ... Fire doors"', t.slice(0, 200));
  ok(!/coming soon/.test(t), 'materials page: live, not "coming soon"');
  ok(/Blanks and frame timber/.test(t) && /Ironmongery/.test(t) && /Intumescent and beads/.test(t) && /Vision panel glass/.test(t), 'materials page: the four grouped sections');
  const counts = [...t.matchAll(/(\d+)\/(\d+) assigned/g)].map((m) => Number(m[2]));
  ok(counts.length === 4 && counts.reduce((a, b) => a + b, 0) === 21 && counts.every((n) => n > 0), `materials page: the section row counts ${counts.join(' / ')} (21 rows in all)`);
  ok(/Door blank FD30/i.test(t) && /Frame timber/i.test(t) && /Fire Door Hinge/i.test(t), 'materials page: the blanks, the frame timber and the hinge rows open by default', t.slice(0, 800));
  await page.locator('button', { hasText: /Intumescent and beads/ }).click(); await page.waitForTimeout(80);
  t = await body();
  ok(/Intumescent/i.test(t) && /Glazing/i.test(t), 'materials page: the intumescent and glazing bead rows open on click', t.slice(0, 1200));

  // the dashboard: the type key and the new pack select
  await page.locator('[data-link="dashboard"]').click();
  await page.waitForSelector('text=Production planner'); await page.waitForTimeout(100);
  ok((await page.locator('button[title="Show only Fire doors production packs"]').count()) === 1, 'dashboard: the Fire doors category key');
  await page.locator('button', { hasText: '+ New production pack' }).first().click(); await page.waitForTimeout(80);
  const opts = await page.locator('select option').allTextContents();
  ok((await page.locator('select option[value="firedoor"]').count()) === 1 && opts.includes('Fire doors'), `dashboard: the new pack select offers Fire doors (${opts.join(' | ')})`);
  ok(errors.length === 0, 'pages: no page errors', errors.join(' | ').slice(0, 600));
  await page.close();
}

await browser.close();
console.log(`\nt52: ${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
