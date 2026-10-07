/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t39: the three casement leaf cards of Window Settings, driven in a real browser
 * (Piotr 07.10.2026: stiles 64, top rail 64, bottom rail 67).
 *
 * The page is the component the user clicks, so this harness mounts it, clicks the
 * cards and types into the Face input, then reads the store the setters wrote:
 *
 *   1  every leaf card shows its own section: Stiles 64 x 57, Top rail 64 x 57,
 *      Bottom rail 67 x 57
 *   2  the glass readout shows both deductions and the sample unit:
 *      glass W = leaf - 105 . glass H = leaf - 108 . sample 793 x 1294 (1000 x 1500)
 *   3  Stiles / Top rail selected: the Face input shows leafStile.face, the hint says
 *      the two share one width; Bottom rail selected: it shows leafBottom.face
 *   4  typing on Bottom rail writes leafBottom only; typing on Stiles or Top rail
 *      writes leafStile and leafTop together, never leafBottom; the stored
 *      deductions.glass stays the WIDTH deduction; the readout follows
 *   5  Reset to defaults brings 64 / 64 / 67 back
 *
 * Needs the Chromium that Playwright finds (PLAYWRIGHT_BROWSERS_PATH) and the
 * playwright package of the global node install; it never downloads a browser.
 * Without them it exits 2 (not a failure, like psw-casement-layouts).
 *
 * Run: node verify/parity/t39_settings_leaf_cards.mjs
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
  console.log('playwright not found in the global node install: this harness needs it (and its Chromium) to drive the page.');
  process.exit(2);
}

// The Window Settings page in a browser bundle (react, router and the stores included).
// The stores import the Supabase client, which reads import.meta.env: defined empty, so the
// client is "not configured" and nothing touches the network (as t37 / t38).
const entry = resolve(AUDIT, 't39-settings-entry.jsx');
writeFileSync(entry, [
  "import React from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { MemoryRouter, Routes, Route } from 'react-router-dom';",
  "import SettingsPage from '../src/pages/WindowSettingsPage.jsx';",
  "import { useWindowProfileStore } from '../src/stores/windowProfileStore.js';",
  'window.__store = useWindowProfileStore;',
  "window.confirm = () => true;",
  "createRoot(document.getElementById('root')).render(",
  "  React.createElement(MemoryRouter, { initialEntries: ['/window-settings/casement'] },",
  "    React.createElement(Routes, null, React.createElement(Route, { path: '/window-settings/:typeId', element: React.createElement(SettingsPage) }))));",
].join('\n'));
const bundleOut = resolve(AUDIT, 't39-settings-bundle.js');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=iife', '--platform=browser',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
  '--define:process.env.NODE_ENV="production"', '--log-level=error', `--outfile=${bundleOut}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const html = resolve(AUDIT, 't39-settings.html');
writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="t39-settings-bundle.js"></script></body></html>');

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(html).href);
await page.waitForSelector('text=Window Settings');

const faces = () => page.evaluate(() => {
  const c = window.__store.getState().casement;
  return { stile: c.elements.leafStile.face, top: c.elements.leafTop.face, bottom: c.elements.leafBottom.face, glass: c.deductions.glass };
});
// a leaf card: the clickable box whose first line starts with the card name
const card = (name) => page.locator('div.cursor-pointer').filter({ has: page.locator('span', { hasText: new RegExp(`^${name}( ×2)?\\s*$`) }) }).first();
const cardSection = async (name) => (await card(name).locator('span.text-ink-400').first().innerText()).trim();
const readout = async () => {
  const l = page.locator('div', { hasText: /^glass W = leaf/ });
  return (await l.count()) ? (await l.last().innerText()).replace(/\s+/g, ' ').trim() : '(no "glass W = leaf" readout)';
};
// the "Selected:" card under the leaf cards: its one Face input, its hint, the selected name
const elementCard = () => page.locator('div.card').filter({ hasText: /^Selected:/ }).first();
const faceInput = () => elementCard().locator('input[type="number"]').first();
const hint = async () => (await elementCard().locator('div.pb-2').first().innerText()).trim();
const selected = async () => (await elementCard().locator('span.font-semibold').first().innerText()).trim();
const typeFace = async (v) => { const i = faceInput(); await i.fill(String(v)); await i.blur(); await page.waitForTimeout(50); };

// ═════════════════════════════════════════════════════════════════════════════
section('1 - each leaf card shows its own section');
{
  ok(await cardSection('Stiles') === '64 × 57', `Stiles card: ${await cardSection('Stiles')}`);
  ok(await cardSection('Top rail') === '64 × 57', `Top rail card: ${await cardSection('Top rail')}`);
  ok(await cardSection('Bottom rail') === '67 × 57', `Bottom rail card: ${await cardSection('Bottom rail')}`);
  const f = await faces();
  ok(f.stile === 64 && f.top === 64 && f.bottom === 67 && f.glass === 105, `store: faces ${f.stile} / ${f.top} / ${f.bottom}, deductions.glass ${f.glass} (the WIDTH deduction)`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - the glass readout: both deductions and the sample');
{
  const r = await readout();
  // sample window 1000 x 1500: leaf 898 x 1402 -> glass 898 - 105 = 793 x 1402 - 108 = 1294
  ok(/glass W = leaf − 105 · glass H = leaf − 108 · sample 793 × 1294\b/.test(r), `readout: "${r.split(' · triple')[0]}"`, r);
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - which face each card shows, and its hint');
const HINT_ST = 'Stiles and top rail share one width. The bottom rail has its own card.';
const HINT_BR = 'Bottom rail width. Stiles and top rail are edited on their own cards.';
for (const [name, face, h] of [['Stiles', 64, HINT_ST], ['Top rail', 64, HINT_ST], ['Bottom rail', 67, HINT_BR]]) {
  await card(name).click();
  const sel = await selected();
  const v = await faceInput().inputValue();
  ok(sel.startsWith(name) && v === String(face), `${name} selected: Face input shows ${v}`);
  const ht = await hint();
  ok(ht === h, `${name} selected: hint "${ht}"`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - which faces each card writes');
{
  // the element card is locked by default: unlock it (the user does the same)
  await elementCard().locator('button[title="Unlock to edit"]').click();
  await card('Bottom rail').click();
  await typeFace(70);
  let f = await faces();
  ok(f.bottom === 70 && f.stile === 64 && f.top === 64 && f.glass === 105, `Bottom rail 70 typed: faces ${f.stile} / ${f.top} / ${f.bottom}, deductions.glass ${f.glass} (width unchanged)`);
  ok(await cardSection('Bottom rail') === '70 × 57' && await cardSection('Stiles') === '64 × 57' && await cardSection('Top rail') === '64 × 57', 'cards: Stiles 64, Top rail 64, Bottom rail 70');
  let r = await readout();
  // height deduction (64 - 11.5) + (70 - 11.5) = 52.5 + 58.5 = 111; sample 1402 - 111 = 1291
  ok(/glass W = leaf − 105 · glass H = leaf − 111 · sample 793 × 1291\b/.test(r), `readout after the bottom rail 70: "${r.split(' · triple')[0]}"`, r);

  await card('Stiles').click();
  ok(await faceInput().inputValue() === '64', 'Stiles selected again: Face input shows the stile 64, not the bottom rail 70');
  await typeFace(66);
  f = await faces();
  ok(f.stile === 66 && f.top === 66 && f.bottom === 70 && f.glass === 109, `Stiles 66 typed: faces ${f.stile} / ${f.top} / ${f.bottom} (bottom rail kept), deductions.glass ${f.glass} = 2 x (66 - 11.5)`);
  r = await readout();
  // width 2 x (66 - 11.5) = 109, height (66 - 11.5) + (70 - 11.5) = 54.5 + 58.5 = 113; 898 - 109 = 789, 1402 - 113 = 1289
  ok(/glass W = leaf − 109 · glass H = leaf − 113 · sample 789 × 1289\b/.test(r), `readout after the stiles 66: "${r.split(' · triple')[0]}"`, r);

  await card('Top rail').click();
  ok(await faceInput().inputValue() === '66', 'Top rail selected: Face input shows the shared stile / top rail 66');
  await typeFace(65);
  f = await faces();
  ok(f.stile === 65 && f.top === 65 && f.bottom === 70, `Top rail 65 typed: faces ${f.stile} / ${f.top} / ${f.bottom} (written together, bottom rail kept)`);

  await card('Bottom rail').click();
  ok(await faceInput().inputValue() === '70', 'Bottom rail selected again: Face input shows 70');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - reset to defaults');
{
  await page.locator('button', { hasText: 'Reset to defaults' }).first().click();
  await page.waitForTimeout(50);
  const f = await faces();
  ok(f.stile === 64 && f.top === 64 && f.bottom === 67 && f.glass === 105, `reset: faces ${f.stile} / ${f.top} / ${f.bottom}, deductions.glass ${f.glass}`);
  ok(await cardSection('Bottom rail') === '67 × 57', 'reset: Bottom rail card back to 67 × 57');
}

ok(errors.length === 0, 'no page errors', errors.join(' | '));
await browser.close();

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
