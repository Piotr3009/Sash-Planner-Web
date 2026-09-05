/**
 * sheets.mjs — shared helpers for the 2D-sheet harnesses (t19).
 *
 * bundleTree(srcRoot, tag): esbuild-bundle the four casement sheets + the
 * engine of ONE source tree (the live `src/` or a `git archive` of an older
 * commit under .audit/) into .audit/<tag>-bundle.mjs and import it.
 * renderSheets(M, windowSpec, derived): react-dom/server static markup of
 * every sheet the app shows for that window (elevation, frame, one leaf sheet
 * per leaf group, one glass sheet per glass group) — the SAME components and
 * grouping helpers the DrawingsPanel / WindowDetailPage use.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

export function bundleTree(srcRoot, tag, extraExports = []) {
  const entry = resolve(AUDIT, `${tag}-entry.mjs`);
  // esbuild resolves plain relative paths only (no file:// URLs)
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    `export { default as Elevation } from '${rel('components/drawings/CasementElevation2D.jsx')}';`,
    `export { default as FrameDetail } from '${rel('components/drawings/CasementFrameDetail2D.jsx')}';`,
    `export { default as LeafDetail } from '${rel('components/drawings/CasementLeafDetail2D.jsx')}';`,
    `export { default as GlassDrawing } from '${rel('components/drawings/CasementGlassDrawing2D.jsx')}';`,
    `export * as cdu from '${rel('components/drawings/casementDrawUtils.js')}';`,
    `export * as specification from '${rel('engine/specification.js')}';`,
    `export * as calculations from '${rel('engine/calculations.js')}';`,
    `export * as lists from '${rel('engine/lists.js')}';`,
    `export * as arch from '${rel('engine/arch.js')}';`,
    `export * as profile from '${rel('engine/profile.js')}';`,
    ...extraExports.map(([name, p]) => `export * as ${name} from '${rel(p)}';`),
  ].join('\n'));
  const out = resolve(AUDIT, `${tag}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

const render = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));

/** Every sheet the app shows for one casement window: { elevation, frame, leaf: [{ key, svg }], glass: [{ key, svg }] }. */
export function renderSheets(M, windowSpec, derived, projectNumber = 'P-1') {
  const leafGroups = M.cdu.groupCasementLeaves(derived);
  const glassGroups = M.cdu.groupCasementGlass(derived, windowSpec);
  return {
    elevation: render(M.Elevation, { windowSpec, derived, projectNumber }),
    frame: render(M.FrameDetail, { windowSpec, derived, projectNumber }),
    leaf: leafGroups.map((group) => ({ key: group.key, svg: render(M.LeafDetail, { windowSpec, derived, group, projectNumber }) })),
    glass: glassGroups.map((group) => ({ key: group.key, svg: render(M.GlassDrawing, { windowSpec, derived, group }) })),
  };
}

/** PC item → windowSpec → derived on a bundle (the path the app takes). */
export function deriveItem(M, item, fullConfig = null) {
  const spec = fullConfig
    ? M.specification.normaliseToWindowSpec(item, { fullConfig })
    : M.specification.normaliseToWindowSpec(item);
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
}
