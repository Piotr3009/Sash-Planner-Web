/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * render_door_samples: the door 3D sample renders (docs/handover/samples/doors/*.png).
 *
 * Every render is the component that reaches the screen: the door is built the way the
 * preview builds it (normaliseToWindowSpec -> windowSpecToConfig -> DoorWindow with its
 * doorGeo, drawn by DoorAssembly from the engine), mounted in a real WebGL canvas in
 * Chromium (the global playwright install, as t39 / t43; SwiftShader WebGL), lit with
 * the pack capture rig's plain lights (no HDR, deterministic) and saved as a 900 x 900
 * PNG. Views: front (straight on, exterior), angle (exterior, three quarter), interior-
 * angle (the group turned round, as the capture rig does for the interior), open (the
 * angle view with the leaves part open).
 *
 * Not a test: it writes pictures for the owner and the handover. Read the PNGs after a
 * run. Run: node verify/parity/render_door_samples.mjs [outDir]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
const OUT = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'docs', 'handover', 'samples', 'doors');
mkdirSync(AUDIT, { recursive: true });
mkdirSync(OUT, { recursive: true });

// [file name prefix, W, H, the configurator fields (fullConfig), views]
const CASES = [
  ['01-single-900x2100-outward', 900, 2100, { doorType: 'single-external' }, ['angle', 'front']],
  ['02-single-900x2100-inward', 900, 2100, { doorType: 'single-external', doorOpenDirection: 'inward' }, ['angle', 'front', 'interior-angle']],
  ['03-single-900x2100-aluminium-threshold', 900, 2100, { doorType: 'single-external', thresholdType: 'aluminium' }, ['angle', 'front']],
  ['04-single-900x2100-half-glazed', 900, 2100, { doorType: 'single-external', doorStyle: 'half-glazed' }, ['angle', 'front']],
  ['05-single-900x2100-three-quarter-panel', 900, 2100, { doorType: 'single-external', doorStyle: 'three-quarter', doorPaneling: 'panel' }, ['angle', 'front']],
  ['06-french-1600x2100-lock-single', 1600, 2100, { doorType: 'french', lockType: 'single' }, ['angle', 'front']],
  ['07-french-1600x2100-lock-double', 1600, 2100, { doorType: 'french', lockType: 'double' }, ['angle', 'front', 'open']],
  // the same inputs as before doors v3: W 1600 is now the OVERALL frame, so the french door
  // gets the 600 between the two mullion axes
  ['08-french-1600x2100-side-panels-500-500', 1600, 2100, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500 }, ['angle', 'front']],
  ['09-french-1600x2100-fanlight-450-fixed', 1600, 2100, { doorType: 'french', transomType: 'fixed', transomHeight: 450 }, ['angle', 'front']],
  ['10-french-1600x2100-fanlight-450-opening', 1600, 2100, { doorType: 'french', transomType: 'opening', transomHeight: 450 }, ['angle', 'front']],
  ['11-single-900x2100-bars-h2-v1', 900, 2100, { doorType: 'single-external', doorHBars: 2, doorVBars: 1 }, ['angle', 'front']],
  // doors v3 reference cases (CLAUDE.md 3.10 and 6)
  ['12-french-2400x2400-side-panels-400-400-fan-450-opening', 2400, 2400, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'opening', transomHeight: 450 }, ['angle', 'front', 'open']],
  ['13-french-2400x2400-side-panels-400-400-fan-450-fixed', 2400, 2400, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'fixed', transomHeight: 450 }, ['angle', 'front']],
  ['14-single-1000x2100-side-panel-right-450', 1000, 2100, { doorType: 'single-external', sidePanels: 'right', sideRightWidth: 450 }, ['angle', 'front']],
];
const SIZE = 900;

// ── the browser bundle: React, R3F, three and the door 3D, one copy each ──
const entry = resolve(AUDIT, 'render-doors-entry.jsx');
writeFileSync(entry, [
  "import React, { useLayoutEffect } from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { Canvas, useThree } from '@react-three/fiber';",
  "import DoorWindow from '../src/3d/components/door/DoorWindow.jsx';",
  "import { windowSpecToConfig } from '../src/utils/windowSpecToConfig.js';",
  "import { normaliseToWindowSpec } from '../src/engine/specification.js';",
  'const E = React.createElement;',
  "const root = createRoot(document.getElementById('root'));",
  // the camera: straight on, or three quarter from the right and a little above, at a
  // distance that fits the whole frame (doorGeo totals) in the square view
  'function Camera({ view, w, h }) {',
  '  const { camera } = useThree();',
  '  useLayoutEffect(() => {',
  '    const fov = 30; const half = (Math.max(w, h) * 1.16) / 2;',
  '    const dist = half / Math.tan((fov / 2) * Math.PI / 180);',
  "    const dir = view === 'front' ? [0, 0, 1] : [0.55, 0.16, 1];",
  '    const n = Math.hypot(...dir); const k = view === \'front\' ? 1 : 1.04;',
  '    camera.fov = fov; camera.near = 0.01; camera.far = dist * 6;',
  '    camera.position.set(dir[0] / n * dist * k, dir[1] / n * dist * k, dir[2] / n * dist * k);',
  '    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();',
  '  }, [camera, view, w, h]);',
  '  return null;',
  '}',
  'window.__render = (c) => new Promise((done) => {',
  "  const spec = normaliseToWindowSpec({ id: 'D', name: 'D', width: c.W, height: c.H }, { fullConfig: { windowCategory: 'door', ...c.fc } });",
  '  const cfg = windowSpecToConfig(spec);',
  '  const g = cfg.doorGeo;',
  "  const interior = c.view === 'interior-angle';",
  "  const opening = c.view === 'open' ? 0.55 : 0;",
  '  root.render(E(Canvas, { key: c.key, dpr: 1, frameloop: \'always\', gl: { antialias: true, alpha: true, preserveDrawingBuffer: true }, style: { width: c.size + \'px\', height: c.size + \'px\' } },',
  '    E(Camera, { view: c.view, w: g.totalWidth / 1000, h: g.totalHeight / 1000 }),',
  '    E(\'ambientLight\', { intensity: 0.65 }),',
  '    E(\'directionalLight\', { position: [3, 4, 6], intensity: 1.1 }),',
  '    E(\'directionalLight\', { position: [-3, 2, 4], intensity: 0.45 }),',
  '    E(\'directionalLight\', { position: [0, -3, 4], intensity: 0.25 }),',
  '    E(\'directionalLight\', { position: [-2, 3, -5], intensity: 0.5 }),',
  '    E(\'group\', { rotation: interior ? [0, Math.PI, 0] : [0, 0, 0] },',
  '      E(DoorWindow, {',
  '        width: cfg.width, height: cfg.height, frameDims: cfg.frameDims || null,',
  "        layout: cfg.doorType === 'french' ? '040F' : (cfg.doorHinge === 'right' ? '040R' : '040L'),",
  "        opening, primaryLeaf: cfg.doorHinge || 'left', openDirection: cfg.doorOpenDirection || 'outward',",
  '        doorStyle: cfg.doorStyle, paneling: cfg.paneling, sidePanels: cfg.sidePanels,',
  '        woodColor: cfg.woodColor, woodColorExt: cfg.woodColorExt, woodColorInt: cfg.woodColorInt, sameColor: cfg.sameColor,',
  "        glassType: cfg.glassType, spacerColor: cfg.spacerColor, glassFinish: cfg.glassFinish, sealColour: cfg.sealColour || 'black',",
  "        ironmongery: cfg.ironmongery || 'brass', doorGeo: g, showGuides: false,",
  '      }))));',
  '  setTimeout(() => done({ leaves: g.leaves.map((l) => `${l.w} x ${l.h}`), total: `${g.totalWidth} x ${g.totalHeight}` }), 900);',
  '});',
  'window.__ready = true;',
].join('\n'));
const bundleOut = resolve(AUDIT, 'render-doors-bundle.js');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=iife', '--platform=browser',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
  '--define:process.env.NODE_ENV="production"', '--log-level=error', `--outfile=${bundleOut}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const html = resolve(AUDIT, 'render-doors.html');
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#eef0f2}#root{width:${SIZE}px;height:${SIZE}px;background:#eef0f2}</style></head><body><div id="root"></div><script src="render-doors-bundle.js"></script></body></html>`);

// ── Chromium (the global playwright install) ──
let chromium = null;
try {
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  const pw = resolve(globalRoot, 'playwright', 'index.mjs');
  if (existsSync(pw)) ({ chromium } = await import(pathToFileURL(pw).href));
} catch { chromium = null; }
if (!chromium) {
  console.log('playwright (global node install) and its Chromium are needed to render');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e)));
await page.route(/^https?:/, (r) => r.abort());
await page.goto(pathToFileURL(html).href);
await page.waitForFunction(() => !!window.__ready);
const written = [];
let n = 0;
for (const [name, W, H, fc, views] of CASES) {
  for (const view of views) {
    n += 1;
    const info = await page.evaluate((c) => window.__render(c), { key: `${name}-${view}-${n}`, W, H, fc, view, size: SIZE });
    const file = resolve(OUT, `${name}-${view}.png`);
    await page.locator('#root canvas').screenshot({ path: file });
    written.push(file);
    console.log(`${name}-${view}.png  frame ${info.total}, leaves ${info.leaves.join(' / ')}`);
  }
}
await browser.close();
if (errors.length) {
  console.log(`page errors: ${errors.slice(0, 5).join(' | ')}`);
  process.exit(1);
}
console.log(`\n${written.length} renders written to ${OUT}`);
