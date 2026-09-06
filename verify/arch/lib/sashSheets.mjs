/**
 * sashSheets.mjs — shared helpers for the sash 2D-sheet harness (t22): bundle the sash sheets + engine of
 * ONE source tree and render every sheet the DrawingsPanel / WindowDetailPage show for a sash window.
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

export function bundleSashTree(srcRoot, tag, extraExports = []) {
  const entry = resolve(AUDIT, `${tag}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    `export { default as FrontElevation } from '${rel('components/drawings/FrontElevation2D.jsx')}';`,
    `export { default as BoxDetail } from '${rel('components/drawings/BoxDetail2D.jsx')}';`,
    `export { default as SashDetail } from '${rel('components/drawings/SashDetail2D.jsx')}';`,
    `export { default as GlassDrawing } from '${rel('components/drawings/GlassDrawing2D.jsx')}';`,
    `export { default as VerticalSection } from '${rel('components/drawings/VerticalSection2D.jsx')}';`,
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

/** Every sash sheet the app shows: { elevation, box, upper, lower, glassUpper, glassLower, vsection }. */
export function renderSashSheets(M, windowSpec, derived) {
  return {
    elevation: render(M.FrontElevation, { windowSpec, derived }),
    box: render(M.BoxDetail, { windowSpec, derived }),
    upper: render(M.SashDetail, { windowSpec, derived, type: 'upper' }),
    lower: render(M.SashDetail, { windowSpec, derived, type: 'lower' }),
    glassUpper: render(M.GlassDrawing, { windowSpec, derived, type: 'upper' }),
    glassLower: render(M.GlassDrawing, { windowSpec, derived, type: 'lower' }),
    vsection: render(M.VerticalSection, { windowSpec, derived }),
  };
}
