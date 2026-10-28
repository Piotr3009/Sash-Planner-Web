/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t52: fire doors v1 (Piotr 27.10.2026) and v1.1 (the same evening: the
 * structural opening as the input, no swing, one 15 x 4 strip, closer kinds,
 * corner dowels, the middle hinge 200 above the centre), the pages a user
 * clicks, driven in a real browser the way t39 drives the casement leaf cards.
 * Three parts, one Chromium, each part its own esbuild iife bundle of the live
 * page with the stores (the Supabase client reads an empty import.meta.env, so
 * nothing touches the network):
 *   A  Window Settings · Fire Doors: the sample door readout (902 x 2083, the
 *      opening 912 x 2088, the hinges 150 / 769 / 1738 and 188 / 807 / 1776, the
 *      middle hinge rule, the keep 990, the intumescent 1 x 15 x 4 all around
 *      4.906 m, the dowels, the closer, the rebate 15 x 47, the members), the
 *      FD60 (two strips) / non-fire sample chips, the hinges card (a typed top
 *      offset 145 moves the sample to 145 / 769 / 1738), the leaf width list
 *      (sorted, unique, junk dropped), the defaults card (rating, fire, the
 *      closer and VP selects, a custom VP number), the bSuite card (STOP rows,
 *      the leaf path with quotes stripped, add / fill / remove target, a macro
 *      default), the head joint select, the reset;
 *   B  the configurator on a fire door batch: the proposed name FDR-01, the Fire
 *      Door section (no Dimensions / Ventilation / Horns, no swing chips, the
 *      intumescent read only, the three closer chips), the live box and the
 *      summary numbers, the slots, fire OFF renaming to DR-01 (a typed name kept),
 *      a free opening 889 (leaf 803, no clamp), the 1012 (leaf 926) chip, an
 *      opening 286 disabling Save with the geometry message on the leaf 200, the
 *      leaf override (838 wins on its axis, "derive from the opening" clears it),
 *      the closer / lock / VP controls, the save (the stored firedoor* keys with
 *      the opening, no swing / intu style, width = the frame overall), the second
 *      door FDR-02 prefilled from the first, DR-01, edit mode never renames;
 *   C  the project page (the Fire doors batch, the card 902 x 2083 and its
 *      subtitle, Add Batch, Project Materials), the batch defaults page (the fire
 *      door slots, no sash rows), Material Assignments · Fire doors (live, the
 *      four sections and their rows), the dashboard (the type key, the new pack
 *      select).
 * v1.2 (owner 28.10.2026): A also drives the Vision panel card (the types table:
 * a typed width moves the sample; the position default; the Master_Door styles
 * collapsed), the Glass card (the three glasses, the default by rating), the
 * strip colours (add / rename / recolour / remove, the default colour) and the
 * Closer symbols card; B drives the vision panel editor (the seven type chips
 * with their icons, Round with a typed diameter 300 placed 100 from the lock
 * edge and its centre above the leaf bottom, the preview drawing one circle,
 * Double side by side), the three glass chips (the FD60 default FD insulated,
 * Frosted picked), the strip colour Black, the saved firedoorVp / firedoorGlass
 * / firedoorIntuColour, the prefill and edit mode, and a v1.1 door (a
 * Master_Door style only) read into the type model and saved untouched; C
 * counts the three glass rows (22 rows in all).
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
  ok(/Hinges \(leaf top\)\s*150 \/ 769 \/ 1738/.test(t), 'sample: hinges 150 / 769 / 1738 from the leaf top (v1.1: the middle one 200 above the centre)', t);
  ok(/Hinges \(jamb top\)\s*188 \/ 807 \/ 1776/.test(t), 'sample: jamb hinges 188 / 807 / 1776', t);
  ok(/Structural opening\s*912 × 2088/.test(t) && /Middle hinge\s*centre 200 above the leaf centre/.test(t) && /Corner dowels\s*3 × 8 × 40 per corner/.test(t) && /Closer\s*Surface closer/.test(t),
    'sample v1.1: structural opening 912 × 2088, middle hinge centre 200 above the leaf centre, corner dowels 3 × 8 × 40, closer Surface closer', t);
  ok(/Keep centre\s*990 above the jamb foot/.test(t), 'sample: keep centre 990 above the jamb foot', t);
  ok(/Intumescent\s*1 x 15 x 4 all around · 4\.906 m/.test(t), 'sample: intumescent 1 x 15 x 4 all around · 4.906 m', t);
  ok(/Rebate\s*15 × 47 · faces 35 \/ 50/.test(t), 'sample: rebate 15 × 47, faces 35 / 50', t);
  ok(/FD-HEAD\s*902 long point · 63x105 · mitre top · mitre bottom/.test(t), 'sample: FD-HEAD 902 long point, 63x105, mitred both ends', t);
  ok(/FD-JAMB-H\s*2083 long point · 63x105 · mitre top(?! · mitre bottom)/.test(t), 'sample: FD-JAMB-H 2083 long point, mitre top only', t);
  // the sample chips: FD60 (leaf 54, rebate depth 57), non-fire (no intumescent, HINGE 0, LOCK 1)
  await page.locator('button', { hasText: /^FD60$/ }).first().click();
  t = await sampleText();
  ok(/Leaf\s*826 × 2040 × 54/.test(t) && /Rebate\s*15 × 57/.test(t) && /Intumescent\s*2 x 15 x 4 all around · 9\.812 m/.test(t), 'sample FD60: leaf 54, rebate depth 57, two strips 9.812 m', t);
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
  ok(/Hinges \(leaf top\)\s*145 \/ 769 \/ 1738/.test(t), 'the sample follows: hinges 145 / 769 / 1738 (the middle one stays 200 above the centre)', t);

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
  // the defaults selects (v1.1: closerFire, closerNonFire, then the VP style) and a custom VP number
  await defCard.locator('select').nth(0).selectOption('builtin'); await page.waitForTimeout(50);
  await defCard.locator('select').nth(2).selectOption('1'); await page.waitForTimeout(50);
  const vpIn = defCard.locator('div', { hasText: /^Length$/ }).locator('..').locator('input[type="number"]').first();
  await vpIn.fill('650'); await vpIn.blur(); await page.waitForTimeout(80);
  const df = await page.evaluate(() => { const d = window.__store.getState().firedoor.defaults; return { vp: d.vpStyle, closerFire: d.closerFire, intu: d.intuStyle, swing: d.swing, len: d.vpCustom.length }; });
  ok(df.vp === 1 && df.closerFire === 'builtin' && df.intu === undefined && df.swing === undefined && df.len === 650, `defaults: vpStyle ${df.vp}, closerFire ${df.closerFire}, no intuStyle / swing keys, vpCustom.length ${df.len} (numbers)`);
  // the frame card: the head joint select holds mitre only
  const frameCard = page.locator('div.card').filter({ hasText: /^Frame/ }).first();
  const joints = await frameCard.locator('select option').allTextContents();
  ok(joints.length === 1 && /mitre/.test(joints[0]), `the head joint select offers mitre only (${joints.join(' | ')})`);

  // ── v1.2: the Vision panel card (the types table, the position default, the Master_Door styles collapsed) ──
  const v12 = () => page.evaluate(() => {
    const f = window.__store.getState().firedoor;
    return {
      types: f.vp.types.map((x) => ({ id: x.id, label: x.label, shape: x.shape, width: x.width })), pos: f.vp.position,
      glass: f.vp.glass, colours: f.intumescent.colours, intuDefault: f.defaults.intuColour, closer: f.closer,
    };
  });
  const vpCard = page.locator('[data-fd-vp-card]');
  const sampleVp = async () => (await page.locator('[data-fd-sample-vp]').innerText()).replace(/\s+/g, ' ');
  ok((await page.locator('[data-fd-vp-card]').count()) === 1 && (await page.locator('[data-fd-glass-card]').count()) === 1 && (await page.locator('[data-fd-closer-card]').count()) === 1 && (await page.locator('[data-fd-intu-colours]').count()) === 1,
    'v1.2 cards: Vision panel, Glass, Closer symbols and the strip colours render');
  const typeRows = await vpCard.locator('[data-fd-vp-type-row]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-fd-vp-type-row')));
  ok(J(typeRows) === J(['none', 'standard', 'square', 'narrow', 'round', 'diamond', 'double']), `the types table rows: ${typeRows.join(', ')}`);
  ok(await page.locator('[data-fd-vp-styles]').evaluate((d) => d.open === false) && /Master_Door styles \(export only\)/.test(await page.locator('[data-fd-vp-styles] summary').innerText()), 'the Master_Door styles table sits collapsed under "Master_Door styles (export only)"');
  let svp = await sampleVp();
  ok(/^sample Standard \(rectangle\): 450 x 700 · centred, top 150 below the leaf top · 1 pane\(s\)/.test(svp) && /Vision panel\s*Standard \(rectangle\): 450 x 700/.test(await sampleText()), `the sample door carries the Standard type: "${svp}"`);
  await vpCard.locator('button[title="Unlock to edit"]').click();
  const stdWidth = vpCard.locator('[data-fd-vp-type-row="standard"] [data-fd-vp-type-field="width"]');
  ok(await stdWidth.inputValue() === '450', `the Standard row width shows ${await stdWidth.inputValue()}`);
  await stdWidth.fill('500'); await stdWidth.blur(); await page.waitForTimeout(80);
  let x12 = await v12();
  svp = await sampleVp();
  ok(x12.types[1].width === 500 && /^sample Standard \(rectangle\): 500 x 700/.test(svp) && /Vision panel\s*Standard \(rectangle\): 500 x 700/.test(await sampleText()), `a typed type width 500 moves the sample: store ${x12.types[1].width}, "${svp}"`);
  const roundLabel = vpCard.locator('[data-fd-vp-type-row="round"] [data-fd-vp-type-field="label"]');
  await roundLabel.fill('Porthole'); await roundLabel.blur(); await page.waitForTimeout(80);
  await vpCard.locator('[data-fd-vp-type-row="square"] [data-fd-vp-type-field="shape"]').selectOption('diamond'); await page.waitForTimeout(80);
  x12 = await v12();
  ok(x12.types[4].label === 'Porthole' && x12.types[2].shape === 'diamond' && (await vpCard.locator('[data-fd-vp-type-row="square"]').innerText()).includes('= width'), `a type label "${x12.types[4].label}" and shape "${x12.types[2].shape}" are string leaves (the diamond row shows "= width" for the height)`);
  await vpCard.locator('[data-fd-vp-position="across"]').selectOption('lock'); await page.waitForTimeout(50);
  const acrossOff = vpCard.locator('div', { hasText: /^From the lock edge$/ }).locator('..').locator('input[type="number"]').first();
  await acrossOff.fill('120'); await acrossOff.blur(); await page.waitForTimeout(80);
  x12 = await v12();
  svp = await sampleVp();
  ok(x12.pos.across === 'lock' && x12.pos.acrossOffset === 120 && /120 from the lock edge, top 150 below the leaf top/.test(svp), `the position default: across "${x12.pos.across}" ${x12.pos.acrossOffset}, the sample "${svp}"`);
  await page.locator('[data-fd-sample-vp-type]').selectOption('round'); await page.waitForTimeout(80);
  svp = await sampleVp();
  ok(/^sample Porthole: dia 300/.test(svp) && /VP_STYLE 0/.test(svp), `the sample type select: "${svp}"`);
  // the Glass card: the three glasses, a thickness, the default by rating
  const glassCard = page.locator('[data-fd-glass-card]');
  const glassRows = await glassCard.locator('[data-fd-glass-row]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-fd-glass-row')));
  ok(J(glassRows) === J(['fd30', 'insulated', 'frosted']) && /fd_glass_fire/.test(await glassCard.innerText()) && /fd_glass_frosted/.test(await glassCard.innerText()), `the Glass card lists ${glassRows.join(', ')} with their Assign Materials rows`);
  await glassCard.locator('button[title="Unlock to edit"]').click();
  await glassCard.locator('[data-fd-glass-default="FD30"]').selectOption('frosted'); await page.waitForTimeout(50);
  const insThick = glassCard.locator('[data-fd-glass-row="insulated"] [data-fd-glass-field="thickness"]');
  await insThick.fill('8'); await insThick.blur(); await page.waitForTimeout(80);
  x12 = await v12();
  const glassLine = (await page.locator('[data-fd-sample-glass]').innerText()).replace(/\s+/g, ' ');
  ok(x12.glass.defaultByRating.FD30 === 'frosted' && x12.glass.defaultByRating.FD60 === 'insulated' && x12.glass.types[1].thickness === 8 && /sample glass Frosted 6 mm/.test(glassLine) && /Glass\s*Frosted 6 mm/.test(await sampleText()),
    `the Glass card: FD30 default "${x12.glass.defaultByRating.FD30}" (a string leaf), the insulated thickness ${x12.glass.types[1].thickness}, the sample "${glassLine}"`);
  // the strip colours: add, rename, recolour, remove; the default colour
  const intuCard = page.locator('div.card').filter({ hasText: /^Intumescent/ }).first();
  await intuCard.locator('button[title="Unlock to edit"]').click();
  ok((await intuCard.locator('[data-fd-intu-colour-row]').count()) === 5 && (await intuCard.locator('button', { hasText: /^remove$/ }).count()) === 0, 'the strip colours: the five standard colours, none removable');
  await intuCard.locator('[data-fd-intu-colour-add]').click(); await page.waitForTimeout(80);
  x12 = await v12();
  const added = x12.colours[5];
  ok(x12.colours.length === 6 && added && /^colour-/.test(added.id) && added.label === 'Colour 6' && added.hex === '#cccccc', `+ add colour: ${x12.colours.length} colours, the new one ${J(added)}`);
  const addedRow = intuCard.locator(`[data-fd-intu-colour-row="${added.id}"]`);
  await addedRow.locator('[data-fd-intu-colour-field="label"]').fill('Red'); await addedRow.locator('[data-fd-intu-colour-field="label"]').blur(); await page.waitForTimeout(50);
  await addedRow.locator('[data-fd-intu-colour-field="hex"]').fill('#aa2211'); await page.waitForTimeout(80);
  await intuCard.locator('[data-fd-intu-colour-row="grey"] [data-fd-intu-colour-field="label"]').fill('Silver grey'); await intuCard.locator('[data-fd-intu-colour-row="grey"] [data-fd-intu-colour-field="label"]').blur(); await page.waitForTimeout(50);
  x12 = await v12();
  ok(x12.colours[5].label === 'Red' && x12.colours[5].hex === '#aa2211' && x12.colours[3].label === 'Silver grey', `the colours renamed / recoloured: ${x12.colours[5].label} ${x12.colours[5].hex}, ${x12.colours[3].label}`);
  await intuCard.locator('[data-fd-intu-colour-default]').selectOption('black'); await page.waitForTimeout(80);
  x12 = await v12();
  ok(x12.intuDefault === 'black' && /Intumescent\s*1 x 15 x 4 all around · 4\.906 m · Black/.test(await sampleText()), `the default colour "${x12.intuDefault}" reaches the sample`);
  await addedRow.locator('button', { hasText: /^remove$/ }).click(); await page.waitForTimeout(80);
  x12 = await v12();
  ok(x12.colours.length === 5 && !x12.colours.some((c) => c.id === added.id), `remove: ${x12.colours.length} colours`);
  // the Closer symbols card: drawing symbols only; the surface face and a size; the built in sample
  const closerCard = page.locator('[data-fd-closer-card]');
  ok(/drawing symbols only, no machining/.test(await closerCard.innerText()), 'the Closer symbols card says "drawing symbols only, no machining"');
  await closerCard.locator('button[title="Unlock to edit"]').click();
  await closerCard.locator('button', { hasText: /^Push side$/ }).click(); await page.waitForTimeout(50);
  const bodyLen = closerCard.locator('div', { hasText: /^Body length$/ }).first().locator('..').locator('input[type="number"]').first();
  await bodyLen.fill('300'); await bodyLen.blur(); await page.waitForTimeout(80);
  // the defaults card above made the fire door closer Built in: the sample chip shows the surface symbol
  await closerCard.locator('[data-fd-sample-closer="surface"]').click(); await page.waitForTimeout(80);
  x12 = await v12();
  let closerLine = (await page.locator('[data-fd-sample-closer-line]').innerText()).replace(/\s+/g, ' ');
  ok(x12.closer.surface.face === 'push' && x12.closer.surface.bodyLength === 300 && /Surface closer on the push face · body 300 × 55 × 45, 60 from the hinge edge, 15 below the leaf top/.test(closerLine), `the surface closer: face ${x12.closer.surface.face}, body ${x12.closer.surface.bodyLength}, "${closerLine}"`);
  await closerCard.locator('[data-fd-sample-closer="builtin"]').click(); await page.waitForTimeout(80);
  closerLine = (await page.locator('[data-fd-sample-closer-line]').innerText()).replace(/\s+/g, ' ');
  ok(/Built in closer · body 300 × 26 × 40 deep, 80 from the hinge edge · track 420 × 20 × 30/.test(closerLine), `the sample built in closer: "${closerLine}"`);
  await closerCard.locator('[data-fd-sample-closer="default"]').click(); await page.waitForTimeout(50);

  // the reset
  await page.locator('button', { hasText: 'Reset fire doors to defaults' }).first().click();
  await page.waitForTimeout(80);
  s = await st();
  ok(s.top === 150 && s.rating === 'FD30' && s.stop === true && s.fire === true && J(s.widths) === '[626,686,726,762,826,838,926,1056]' && s.active === defaultTarget, `reset: top ${s.top}, rating ${s.rating}, stop ${s.stop}, fire ${s.fire}, the width list and the target back`);
  x12 = await v12();
  ok(x12.types[1].width === 450 && x12.types[4].label === 'Round (porthole)' && x12.pos.across === 'centre' && x12.glass.defaultByRating.FD30 === 'fd30' && x12.colours.length === 5 && x12.intuDefault === 'white' && x12.closer.surface.face === 'pull',
    'reset v1.2: the types, the position, the glass default, the colours and the closer symbols back');
  t = await sampleText();
  ok(/Hinges \(leaf top\)\s*150 \/ 769 \/ 1738/.test(t), 'the sample is back to 150 / 769 / 1738');
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
    b?.windows?.[0] && React.createElement(Link, { to: '/projects/' + projectId + '/batches/' + b.id + '/configurator?edit=' + b.windows[0].id, 'data-link': 'edit' }, 'EDIT FIRST'),
    b?.windows?.length > 1 && React.createElement(Link, { to: '/projects/' + projectId + '/batches/' + b.id + '/configurator?edit=' + b.windows[b.windows.length - 1].id, 'data-link': 'edit-last' }, 'EDIT LAST'));
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
  // v1.1: the fire door number inputs in order: opening width, opening height, leaf override width, leaf override height, frame depth
  const openingWidthInput = () => fdSec().locator('input[type="number"]').nth(0);
  const leafWidthInput = () => fdSec().locator('input[type="number"]').nth(2);

  ok(await nameInput().inputValue() === 'FDR-01', `a new door proposes the name "${await nameInput().inputValue()}"`);
  let lp = await leftPanel();
  ok(/Fire Door/.test(lp) && !/Dimensions \(Frame\)/.test(lp) && !/Ventilation/.test(lp) && !/Horns & Security/.test(lp), 'the form: a Fire Door section, no Dimensions / Ventilation / Horns sections');
  let lb = await liveBox();
  ok(/^Opening 912 x 2088 · frame overall 902 x 2083 · leaf 826 x 2040 · rebate 15 x 47 · members 50 x 100 finished, 63 x 105 raw · hinges 150 \/ 769 \/ 1738 from the leaf top/.test(lb), `the live box (v1.1: the opening first, the leaf, the hinges): "${lb}"`);
  let rp = await rightPanel();
  ok(/Frame\s*902 × 2083/.test(rp) && /Depth\s*100mm/.test(rp), 'the summary: frame overall 902 × 2083, depth 100', rp);
  ok(/Hinges \(leaf top\)\s*150 \/ 769 \/ 1738/.test(rp) && /Hinges \(jamb top\)\s*188 \/ 807 \/ 1776/.test(rp) && /Middle hinge\s*centre 200 above the leaf centre/.test(rp), 'the summary: hinges 150 / 769 / 1738 and 188 / 807 / 1776, the middle hinge rule', rp);
  ok(/Keep centre\s*990 from the jamb foot/.test(rp) && /Intumescent\s*1 x 15 x 4 all around · 4\.906 m/.test(rp) && /Corner dowels\s*3 × 8 × 40 per corner/.test(rp), 'the summary: keep 990, intumescent 1 x 15 x 4 all around 4.906 m, corner dowels', rp);
  ok(/Hand\s*Hinge left(?! · opens)/.test(rp) && !/opens (in|out)/.test(rp) && /Rating\s*FD30/.test(rp) && /Leaf\s*826 × 2040 × 44/.test(rp) && /Structural opening\s*912 × 2088/.test(rp) && /Closer\s*Surface closer/.test(rp), 'the summary: Hinge left (no swing), FD30, leaf 826 × 2040 × 44, structural opening 912 × 2088, closer Surface closer', rp);
  ok(await openingWidthInput().inputValue() === '912' && await leafWidthInput().inputValue() === '' && await leafWidthInput().getAttribute('placeholder') === '826', `the form: opening width ${await openingWidthInput().inputValue()}, the leaf override empty with the derived 826 as placeholder`);
  ok(!/opens in/.test(lp) && !/opens out/.test(lp) && !/INTU_STYLE/.test(lp) && /Intumescent 1 x 15 x 4 all around/.test(lp) && (await fdSec().locator('button', { hasText: /^Surface closer$/ }).count()) === 1 && (await fdSec().locator('button', { hasText: /^Built in closer$/ }).count()) === 1, 'the form: no swing chips, no intumescent select (a read only line), the three closer chips');
  ok(!/Ventilation/.test(rp) && !/PAS24/.test(rp), 'the summary: no Ventilation, no PAS24');
  ok(/Fire Door Locks/.test(lp) && /Keeps/.test(lp) && /Door Closers/.test(lp) && /Door Hinges/.test(lp) && !/Trickle Vents/.test(lp), 'the slots: Fire Door Locks, Keeps, Door Closers, Door Hinges, no Trickle Vents');

  // fire OFF: the name prefix, the rating and the intumescent hidden, the closer follows
  await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'DR-01', `fire OFF renames the unsaved door to "${await nameInput().inputValue()}"`);
  lp = await leftPanel(); rp = await rightPanel();
  ok(!/Rating/.test(lp) && /Intumescent none \(non-fire\)/.test(lp) && /follows fire: None/.test(lp), 'fire OFF: the rating hidden, the intumescent line reads none (non-fire), the closer follows fire (None)');
  ok(/Rating\s*Non-fire/.test(rp) && /Closer\s*None/.test(rp) && /Intumescent\s*none \(non-fire\)/.test(rp), 'the summary fire OFF: Non-fire, closer None, intumescent none (non-fire)', rp);
  await fdSec().locator('button', { hasText: /^Fire door$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'FDR-01', `fire ON again: "${await nameInput().inputValue()}"`);
  await nameInput().fill('MYDOOR'); await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'MYDOOR', `a typed name survives the fire toggle: "${await nameInput().inputValue()}"`);
  await nameInput().fill(''); await fdSec().locator('button', { hasText: /^Fire door$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'FDR-01', `an emptied field takes the proposal again: "${await nameInput().inputValue()}"`);

  // a free opening, the opening chips, a bad opening (fails on the leaf), the leaf override
  await openingWidthInput().fill('889'); await page.waitForTimeout(100);
  lb = await liveBox();
  ok(/frame overall 879 x 2083/.test(lb) && /Leaf\s*803 × 2040/.test(await rightPanel()), `a free opening 889 derives without clamp: leaf 803, ${lb.split(' · ').slice(0, 2).join(' · ')}`);
  await fdSec().locator('button', { hasText: /^1012 \(leaf 926\)$/ }).click(); await page.waitForTimeout(100);
  ok(/frame overall 1002 x 2083/.test(await liveBox()) && await openingWidthInput().inputValue() === '1012', 'the 1012 (leaf 926) chip inserts the opening: overall 1002 x 2083');
  await openingWidthInput().fill('286'); await page.waitForTimeout(100);
  ok(await saveBtn().isDisabled(), 'an opening 286 (leaf 200): Save disabled');
  const err = (await page.locator('[data-firedoor-error]').innerText()).trim();
  ok(/^Geometry: .*leaf width 200.*outside 300 to 1500/.test(err), `an opening 286: the summary shows "${err}"`);
  await openingWidthInput().fill('912'); await page.waitForTimeout(100);
  ok(!(await saveBtn().isDisabled()) && (await page.locator('[data-firedoor-error]').count()) === 0, 'the opening 912 again: Save enabled, the error gone');
  await leafWidthInput().fill('838'); await page.waitForTimeout(100);
  rp = await rightPanel();
  ok(/frame overall 914 x 2083/.test(await liveBox()) && /Structural opening\s*924 × 2088 \(one axis from the leaf\)/.test(rp), 'a typed leaf 838 overrides the opening on its axis: frame 914, the opening reported 924 (one axis from the leaf)', rp);
  await fdSec().locator('button', { hasText: /^derive from the opening$/ }).click(); await page.waitForTimeout(100);
  ok(/frame overall 902 x 2083/.test(await liveBox()) && await leafWidthInput().inputValue() === '', 'derive from the opening: the override cleared, frame 902 again');
  await leafWidthInput().fill('826'); await page.waitForTimeout(100);
  // the closer picked by hand, a euro lock, a vision panel type (v1.2: the type chips replace the VP_STYLE select)
  await fdSec().locator('button', { hasText: /^None$/ }).first().click(); await page.waitForTimeout(50);   // the closer chips None / Surface closer / Built in closer
  await fdSec().locator('button', { hasText: /^Sashlock euro$/ }).click(); await page.waitForTimeout(50);
  const vpChip = (id) => fdSec().locator(`[data-firedoor-vp-type="${id}"]`);
  const vpField = (k) => fdSec().locator(`[data-firedoor-vp-field="${k}"]`);
  const isOn = async (loc) => /border-accent-500/.test((await loc.getAttribute('class')) || '');
  const chipLabels = await fdSec().locator('[data-firedoor-vp-type]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-firedoor-vp-type')}:${e.innerText.trim()}:${e.querySelectorAll('svg').length}`));
  ok(J(chipLabels) === J(['none:None:1', 'standard:Standard (rectangle):1', 'square:Square:1', 'narrow:Narrow slot:1', 'round:Round (porthole):1', 'diamond:Diamond:1', 'double:Double (2 panes):1']), `v1.2: seven vision panel type chips with plain names and an icon each (${chipLabels.join(' | ')})`);
  ok(await isOn(vpChip('none')) && (await vpField('width').count()) === 0 && (await fdSec().locator('select').count()) === 0 && !/VP_STYLE/.test(await leftPanel()), 'a new door: the None chip on, no size fields, the old VP_STYLE select and its Custom block gone');
  await vpChip('square').click(); await page.waitForTimeout(100);
  rp = await rightPanel();
  ok(/Closer\s*None/.test(rp) && /Lock\s*Sashlock euro · spindle 1000 up/.test(rp) && /Vision panel\s*Square: 450 x 450/.test(rp) && /centred, top 150 below the leaf top/.test(rp), 'closer None, Sashlock euro · spindle 1000 up, VP Square: 450 x 450 centred, top 150 below the leaf top in the summary', rp);
  ok((await vpField('width').inputValue()) === '450' && (await vpField('height').inputValue()) === '450' && (await fdSec().locator('[data-firedoor-vp-preview] rect[data-vp-pane]').count()) === 1, 'Square: the width and height fields 450, one pane in the preview');
  // Double: two panes, the arrangement chips and the gap; side by side
  await vpChip('double').click(); await page.waitForTimeout(100);
  ok(/Vision panel\s*Double \(2 panes\): 2 x 150 x 800, one above another, gap 100/.test(await rightPanel()) && await isOn(fdSec().locator('[data-firedoor-vp-count="2"]')) && (await vpField('gap').inputValue()) === '100' && (await fdSec().locator('[data-firedoor-vp-preview] rect[data-vp-pane]').count()) === 2,
    'Double: 2 x 150 x 800 one above another, gap 100, the panes chip 2, two panes in the preview', await rightPanel());
  await fdSec().locator('[data-firedoor-vp-arrange="side"]').click(); await page.waitForTimeout(100);
  ok(/Double \(2 panes\): 2 x 150 x 800, side by side, gap 100/.test(await rightPanel()), 'Double side by side');
  // Round: the diameter field (no height), a typed diameter, 100 from the lock edge, the centre above the leaf bottom
  await vpChip('round').click(); await page.waitForTimeout(100);
  lp = await leftPanel();
  ok(await isOn(vpChip('round')) && (await vpField('height').count()) === 0 && /Diameter \(mm\)/.test(lp) && await isOn(fdSec().locator('[data-firedoor-vp-count="1"]')) && (await fdSec().locator('[data-firedoor-vp-arrange]').count()) === 0,
    'Round: a Diameter field and no height, one pane, no arrangement chips (the chip keeps the position, sets the preset)');
  await vpField('width').fill('320'); await page.waitForTimeout(100);
  ok(/Vision panel\s*Round \(porthole\): dia 320/.test(await rightPanel()), 'a typed diameter 320 reaches the summary');
  await vpField('width').fill('300'); await page.waitForTimeout(100);
  await fdSec().locator('[data-firedoor-vp-across="lock"]').click(); await page.waitForTimeout(100);
  const lockLabel = (await fdSec().locator('[data-firedoor-vp-across-label]').innerText()).trim();
  const keptAcross = await vpField('acrossOffset').inputValue();
  ok(lockLabel === 'From the lock edge (mm)' && keptAcross === '263' && /263 from the lock edge/.test(await rightPanel()), `From lock edge: the field reads "${lockLabel}" and keeps the panel where it was (${keptAcross} = (826 - 300) / 2)`);
  await vpField('acrossOffset').fill('100'); await page.waitForTimeout(100);
  await fdSec().locator('[data-firedoor-vp-down="centre"]').click(); await page.waitForTimeout(100);
  ok((await fdSec().locator('[data-firedoor-vp-down-label]').innerText()).trim() === 'Centre above the leaf bottom (mm)' && (await vpField('downOffset').inputValue()) === '1740', `Centre above the leaf bottom: the field keeps the panel (${await vpField('downOffset').inputValue()} = 2040 - 150 - 150)`);
  await vpField('downOffset').fill('1400'); await page.waitForTimeout(100);
  rp = await rightPanel();
  const preview = fdSec().locator('[data-firedoor-vp-preview]');
  ok((await preview.locator('circle[data-vp-pane="round"]').count()) === 1 && (await preview.locator('[data-vp-pane]').count()) === 1 && (await preview.getAttribute('height')) === '120' && (await preview.locator('[data-vp-hinge-edge="left"]').count()) === 1, 'the preview draws one circle (and nothing else as a pane), 120 px high, the hinge edge on the left');
  const circle = await preview.locator('circle[data-vp-pane="round"]').evaluate((c) => ({ cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')), r: Number(c.getAttribute('r')) }));
  ok(circle.r === 150 && circle.cx === 826 - 100 - 150 && circle.cy === 2040 - 1400, `the preview circle sits where the engine placed it: centre ${circle.cx} from the hinge edge, ${circle.cy} from the top, radius ${circle.r}`);
  ok(/Vision panel\s*Round \(porthole\): dia 300/.test(rp) && /100 from the lock edge, centre 1400 above the leaf bottom/.test(rp), 'the summary: Round (porthole): dia 300, "100 from the lock edge, centre 1400 above the leaf bottom"', rp);
  ok(/Round \(porthole\): dia 300/.test(await fdSec().locator('[data-firedoor-vp-label]').innerText()) && /100 from the lock edge/.test(await fdSec().locator('[data-firedoor-vp-position-label]').innerText()), 'the preview text: the label and the position from the engine');
  // the glass: three chips only (no spec / coating / spacer on a fire door), the default by rating, Frosted
  const glassSec = page.locator('div.px-4.py-3').filter({ hasText: /^GLASS/i }).first();
  const glassChips = await glassSec.locator('[data-firedoor-glass]').evaluateAll((els) => els.map((e) => e.innerText.trim()));
  let gs = (await glassSec.innerText()).replace(/\s+/g, ' ');
  ok(J(glassChips) === J(['FD30 standard', 'FD insulated', 'Frosted']) && (await glassSec.locator('button').count()) === 3 && !/Coating|Spacer|Spec\b|Finish/.test(gs) && /\(default for FD30\)/.test(gs) && await isOn(glassSec.locator('[data-firedoor-glass="fd30"]')),
    `the Glass section: only ${glassChips.join(' / ')}, FD30 standard on as the FD30 default`, gs);
  await fdSec().locator('button', { hasText: /^FD60$/ }).click(); await page.waitForTimeout(100);
  gs = (await glassSec.innerText()).replace(/\s+/g, ' ');
  ok(await isOn(glassSec.locator('[data-firedoor-glass="insulated"]')) && /\(default for FD60\)/.test(gs) && /Glass\s*FD insulated · 6 mm/.test(await rightPanel()), 'FD60: FD insulated by default', gs);
  await fdSec().locator('button', { hasText: /^FD30$/ }).click(); await page.waitForTimeout(100);
  await glassSec.locator('[data-firedoor-glass="frosted"]').click(); await page.waitForTimeout(100);
  gs = (await glassSec.innerText()).replace(/\s+/g, ' ');
  ok(await isOn(glassSec.locator('[data-firedoor-glass="frosted"]')) && !/default for/.test(gs) && /Glass\s*Frosted · 6 mm/.test(await rightPanel()) && (await glassSec.locator('[data-firedoor-glass-reset]').count()) === 1, 'Frosted picked: on, the summary Glass Frosted · 6 mm, a "by rating" reset offered');
  // the strip colour: five chips with swatches, White by default, Black picked
  const colourChips = await fdSec().locator('[data-firedoor-intu-colour]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-firedoor-intu-colour')}:${e.innerText.trim()}:${e.querySelector('span span') ? 1 : 0}`));
  ok(J(colourChips) === J(['white:White:1', 'black:Black:1', 'brown:Brown:1', 'grey:Grey:1', 'magnolia:Magnolia:1']) && await isOn(fdSec().locator('[data-firedoor-intu-colour="white"]')) && /\(default: White\)/.test(await leftPanel()), `the strip colour chips with swatches: ${colourChips.join(' | ')}, White by default`);
  await fdSec().locator('[data-firedoor-intu-colour="black"]').click(); await page.waitForTimeout(100);
  ok(/Intumescent\s*1 x 15 x 4 all around · 4\.906 m · Black/.test(await rightPanel()) && await isOn(fdSec().locator('[data-firedoor-intu-colour="black"]')), 'Black picked: the summary Intumescent 1 x 15 x 4 all around · 4.906 m · Black');

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
  const KEYS = ['firedoorFire', 'firedoorRating', 'firedoorOpeningWidth', 'firedoorOpeningHeight', 'firedoorLeafWidth', 'firedoorLeafHeight', 'firedoorHingeSide', 'firedoorFrameDepth', 'firedoorLockType', 'firedoorCloser', 'firedoorVpStyle', 'firedoorVpCustom', 'firedoorLeadEdge', 'firedoorVp', 'firedoorGlass', 'firedoorIntuColour'];
  const missing = KEYS.filter((k) => saved[k] === undefined);
  ok(missing.length === 0, 'the saved window carries every contract key at top level (v1.2: firedoorVp, firedoorGlass, firedoorIntuColour)', `missing: ${missing.join(',')}`);
  // v1.2: the legacy VP_STYLE key stays as the form held it (the profile default 0); the panel is the firedoorVp block
  ok(saved.firedoorFire === true && saved.firedoorRating === 'FD30' && saved.firedoorOpeningWidth === 912 && saved.firedoorOpeningHeight === 2088 && saved.firedoorLeafWidth === 826 && saved.firedoorLeafHeight === 0 && saved.firedoorHingeSide === 'left' && saved.firedoorFrameDepth === 100 && saved.firedoorLockType === 'euro' && saved.firedoorCloser === 'none' && saved.firedoorVpStyle === 0 && saved.firedoorLeadEdge === true && saved.firedoorSwing === undefined && saved.firedoorIntuStyle === undefined,
    `the saved values: ${KEYS.map((k) => `${k}=${J(saved[k])}`).join(' ')} (no swing, no intu style; the leaf height override empty)`);
  const svp = saved.firedoorVp || {};
  ok(svp.type === 'round' && svp.shape === 'round' && svp.width === 300 && svp.count === 1 && svp.across === 'lock' && svp.acrossOffset === 100 && svp.down === 'centre' && svp.downOffset === 1400 && Object.keys(svp).length === 11,
    `the saved firedoorVp: ${J(saved.firedoorVp)} (the whole block, eleven keys)`);
  ok(saved.firedoorGlass === 'frosted' && saved.firedoorIntuColour === 'black', `the saved firedoorGlass "${saved.firedoorGlass}", firedoorIntuColour "${saved.firedoorIntuColour}"`);
  ok(saved.ventRoomType === 'other' && saved.pas24 === false && saved.childRestrictor === false, `vent ${saved.ventRoomType}, pas24 ${saved.pas24}, restrictor ${saved.childRestrictor} (the sash fields neutral)`);

  // a second new door: copied from the last, the next free number
  await page.locator('[data-link="new"]').click();
  await page.waitForSelector('text=Add Window'); await page.waitForTimeout(200);
  ok(await nameInput().inputValue() === 'FDR-02', `the second door proposes "${await nameInput().inputValue()}"`);
  rp = await rightPanel();
  ok(/Lock\s*Sashlock euro/.test(rp) && /Vision panel\s*Round \(porthole\): dia 300/.test(rp) && /100 from the lock edge, centre 1400 above the leaf bottom/.test(rp) && /Glass\s*Frosted · 6 mm/.test(rp) && /· Black/.test(rp) && /Closer\s*None/.test(rp) && await openingWidthInput().inputValue() === '912' && await leafWidthInput().inputValue() === '826',
    'the second door is prefilled from the first (euro, VP Round 100 from the lock edge, Frosted, Black, closer None, opening 912, leaf override 826)', rp);
  await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'DR-01', `the second door fire OFF: "${await nameInput().inputValue()}"`);
  ok((await fdSec().locator('[data-firedoor-intu-colour]').count()) === 0 && (await page.locator('[data-firedoor-glass]').count()) === 3, 'fire OFF: no strip colour chips (no intumescent), the three glass chips stay');
  await saveBtn().click();
  await page.waitForSelector('[data-stub="project"]');
  const second = await page.evaluate(() => { const p = window.__project.getState().projects.find((x) => x.id === window.__ids.projectId); const w = p.batches[0].windows[1]; return { name: w.name, fire: w.firedoorFire, intu: w.firedoorIntuStyle, closer: w.firedoorCloser, opening: w.firedoorOpeningWidth, vp: w.firedoorVp, glass: w.firedoorGlass }; });
  ok(second.name === 'DR-01' && second.fire === false && second.intu === undefined && second.closer === 'none' && second.opening === 912, `the second saved: ${second.name}, fire ${second.fire}, no INTU_STYLE key, closer ${second.closer}, opening ${second.opening}`);
  ok(second.vp?.type === 'round' && second.vp?.acrossOffset === 100 && second.glass === 'frosted', `the second saved keeps the copied panel ${second.vp?.type} ${second.vp?.acrossOffset} from the lock edge and the glass ${second.glass}`);

  // edit mode: the saved name never changes on the fire toggle; the update keeps the keys
  await page.locator('[data-link="edit"]').click();
  await page.waitForSelector('text=Edit FDR-01'); await page.waitForTimeout(200);
  ok(await nameInput().inputValue() === 'FDR-01', `edit mode name: "${await nameInput().inputValue()}"`);
  ok(await leafWidthInput().inputValue() === '826' && /Lock\s*Sashlock euro/.test(await rightPanel()), 'edit mode prefilled from the saved firedoor* keys');
  ok(await isOn(vpChip('round')) && await vpField('width').inputValue() === '300' && await vpField('acrossOffset').inputValue() === '100' && await vpField('downOffset').inputValue() === '1400' && await isOn(fdSec().locator('[data-firedoor-vp-across="lock"]')) && await isOn(fdSec().locator('[data-firedoor-vp-down="centre"]')) && await isOn(page.locator('[data-firedoor-glass="frosted"]')) && await isOn(fdSec().locator('[data-firedoor-intu-colour="black"]')),
    'edit mode: the vision panel (Round 300, lock edge 100, centre 1400), the glass Frosted and the colour Black loaded back from the saved keys');
  await fdSec().locator('button', { hasText: /^Non-fire$/ }).click(); await page.waitForTimeout(100);
  ok(await nameInput().inputValue() === 'FDR-01', `edit mode: fire OFF does not rename ("${await nameInput().inputValue()}")`);
  await leafWidthInput().fill('838'); await page.waitForTimeout(100);
  await saveBtn().click();
  await page.waitForSelector('[data-stub="project"]');
  const edited = await page.evaluate(() => { const p = window.__project.getState().projects.find((x) => x.id === window.__ids.projectId); const w = p.batches[0].windows[0]; return { name: w.name, fire: w.firedoorFire, width: w.width, leaf: w.firedoorLeafWidth, opening: w.firedoorOpeningWidth, lock: w.firedoorLockType, vp: w.firedoorVp, glass: w.firedoorGlass, colour: w.firedoorIntuColour }; });
  ok(edited.name === 'FDR-01' && edited.fire === false && edited.leaf === 838 && edited.width === 914 && edited.opening === 912 && edited.lock === 'euro', `edited: ${edited.name}, fire ${edited.fire}, leaf ${edited.leaf} (override), width ${edited.width} (838 + 76), opening ${edited.opening} kept, lock ${edited.lock}`);
  ok(edited.vp?.type === 'round' && edited.vp?.acrossOffset === 100 && edited.vp?.downOffset === 1400 && edited.glass === 'frosted' && edited.colour === 'black', `the update keeps the panel, the glass and the colour: ${J(edited.vp)} ${edited.glass} ${edited.colour}`);

  // a v1.1 door (a Master_Door style only, no firedoorVp): read into the type model, saved untouched
  await page.evaluate(() => {
    const { projectId, batchId } = window.__ids;
    window.__project.getState().addWindowToBatch(projectId, batchId, {
      windowName: 'FDR-07', windowCategory: 'firedoor', extWidth: 902, extHeight: 2083, inputWidth: 902, inputHeight: 2083,
      firedoorFire: true, firedoorRating: 'FD30', firedoorOpeningWidth: 912, firedoorOpeningHeight: 2088, firedoorLeafWidth: 0, firedoorLeafHeight: 0, firedoorHingeSide: 'left',
      firedoorFrameDepth: 100, firedoorLockType: 'latch', firedoorCloser: 'surface', firedoorVpStyle: 1,
      firedoorVpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 }, firedoorLeadEdge: true,
      ventRoomType: 'other', pas24: false, childRestrictor: false, glassType: 'double', glassSpec: 'toughened', woodColor: '#F6F6F6',
    });
  });
  await page.locator('[data-link="edit-last"]').click();
  await page.waitForSelector('text=Edit FDR-07'); await page.waitForTimeout(200);
  rp = await rightPanel();
  ok(await isOn(vpChip('square')) && await vpField('width').inputValue() === '450' && /Vision panel\s*Square: 450 x 450/.test(rp) && /centred, top 150 below the leaf top/.test(rp) && /Read from the saved Master_Door style 1/.test(await leftPanel()) && /Glass\s*FD30 standard · 6 mm/.test(rp) && /· White/.test(rp),
    'a v1.1 door (style 1): the Square chip on, 450, centred 150 below the top, the "Read from the saved Master_Door style 1" note, FD30 standard and White by default', rp);
  await saveBtn().click();
  await page.waitForSelector('[data-stub="project"]');
  const legacy = await page.evaluate(() => { const p = window.__project.getState().projects.find((x) => x.id === window.__ids.projectId); const w = p.batches[0].windows[p.batches[0].windows.length - 1]; return { name: w.name, style: w.firedoorVpStyle, vp: w.firedoorVp, glass: w.firedoorGlass, colour: w.firedoorIntuColour }; });
  ok(legacy.name === 'FDR-07' && legacy.style === 1 && legacy.vp === null && legacy.glass === null && legacy.colour === null, `the untouched v1.1 door saves as it was: style ${legacy.style}, firedoorVp ${J(legacy.vp)}, glass ${J(legacy.glass)}, colour ${J(legacy.colour)}`);
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
  firedoorFire: true, firedoorRating: 'FD30', firedoorOpeningWidth: 912, firedoorOpeningHeight: 2088, firedoorLeafWidth: 0, firedoorLeafHeight: 0, firedoorHingeSide: 'right',
  firedoorFrameDepth: 100, firedoorLockType: 'latch', firedoorCloser: 'surface', firedoorVpStyle: 0,
  firedoorVpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 }, firedoorLeadEdge: true,
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
  ok(/Rating: FD30/.test(t) && /Lock: latch/.test(t) && /Closer: surface closer/.test(t) && !/Horns:/.test(t) && !/PAS24:/.test(t), 'project page: the batch strip prints Rating FD30, Lock latch, Closer surface closer and no Horns / PAS24 row', t.slice(0, 700));
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
  ok(/Blanks and frame timber/.test(t) && /Ironmongery/.test(t) && /Intumescent, beads and dowels/.test(t) && /Vision panel glass/.test(t), 'materials page: the four grouped sections (v1.1: Intumescent, beads and dowels)');
  const counts = [...t.matchAll(/(\d+)\/(\d+) assigned/g)].map((m) => Number(m[2]));
  // v1.2: the glass section holds the three glasses (FD30 standard, FD insulated, Frosted; the v1 toughened row gone): 22 rows in all
  ok(counts.length === 4 && counts.reduce((a, b) => a + b, 0) === 22 && counts.every((n) => n > 0) && counts[3] === 3, `materials page: the section row counts ${counts.join(' / ')} (22 rows in all, 3 glasses)`);
  ok(/FD30 standard \(the default on FD30 and non-fire\), FD insulated \(the default on FD60\) or Frosted/.test(t) && !/toughened on a non-fire door/.test(t), 'materials page: the glass section subtitle names the three glasses');
  ok(/Door blank FD30/i.test(t) && /Frame timber/i.test(t) && /Fire Door Hinge/i.test(t), 'materials page: the blanks, the frame timber and the hinge rows open by default', t.slice(0, 800));
  await page.locator('button', { hasText: /Intumescent, beads and dowels/ }).click(); await page.waitForTimeout(80);
  t = await body();
  ok(/Intumescent/i.test(t) && /Glazing/i.test(t) && /Frame Dowels/i.test(t) && !/10 x 4/.test(t) && !/20 x 4/.test(t), 'materials page: the intumescent, glazing bead and frame dowel rows open on click; no 10 / 20 strip rows', t.slice(0, 1200));
  await page.locator('button', { hasText: /Vision panel glass/ }).click(); await page.waitForTimeout(80);
  t = await body();
  ok(/Glass FD30 standard/.test(t) && /Glass FD insulated/.test(t) && /Glass Frosted/.test(t) && !/Toughened Glass/.test(t), 'materials page: the glass rows Glass FD30 standard, Glass FD insulated, Glass Frosted (no toughened row)');

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
