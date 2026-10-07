/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t40: the casement leaf bottom rail 67 in the 3D (Piotr 07.10.2026), measured on the
 * components that reach the screen, not on a helper below them (the t30 rule).
 *
 * Every component is mounted with @react-three/fiber's own reconciler under node
 * (createRoot with a stub renderer: the scene graph is built, nothing is drawn), for
 * the live src and for the start commit of this tura (default bdd2092, `git archive`).
 * The meshes are read back with their world bounding boxes (mm):
 *
 *   1  CasementPanel 898 x 1102 (fixed, side hung, top hung) with bottomRail 67: bottom
 *      rail 67, top rail and stiles 64, glass 770 x 971 centred 1.5 above the leaf centre,
 *      the top-hung handle 1.5 higher (centred on the 67 rail); the default panel (no
 *      bottomRail) is byte-identical to the start commit
 *   2  CasementWindow 040L 1000 x 1200 (2V / 1H bars) and 021 1000 x 1200: every leaf has a
 *      67 bottom rail and a 64 top rail, its glass is leaf H - 64 - 67, the horizontal bar
 *      sits in the middle of the NEW daylight; every mesh that is not a bottom rail, not in
 *      the glazing and not a top-hung handle is byte-identical to the start commit
 *   3  ArchedCasementWindow (three-centre 1000 x 1500, rise 200): the leaf's bottom member is
 *      67, the glass starts 67 above the leaf bottom, the leaf outline is unchanged
 *   4  nothing else in the 3D moved: FixFrameWindow (rectangle and circle), DoorWindow,
 *      ParametricSashWindow are byte-identical to the start commit
 *   5  the constants: SASH_RAIL stays 64 (exported), SASH_BOTTOM_RAIL 67 (exported)
 *
 * Run: node verify/parity/t40_bottom_rail_3d.mjs [git-ref]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const ref = process.argv[2] || 'bdd20928102e812ff25e6824720d0c82e03ce5f0';
const tag = `t40-ref-${ref.slice(0, 12).replace(/[^\w.-]+/g, '_')}`;
const tree = resolve(AUDIT, `${tag}-tree`);
rmSync(tree, { recursive: true, force: true });
mkdirSync(tree, { recursive: true });
execFileSync('sh', ['-c', `git archive ${ref} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });

// One bundle per tree: R3F, three and the 3D components, all bundled together so the
// reconciler and the THREE namespace are one copy.
function bundle(srcRoot, name) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    "export { createRoot, extend } from '@react-three/fiber';",
    "export * as THREE from 'three';",
    "export { createElement } from 'react';",
    `export * as Panel from '${rel('3d/components/casement/CasementPanel.jsx')}';`,
    `export { default as CasementWindow } from '${rel('3d/components/casement/CasementWindow.jsx')}';`,
    `export { default as ArchedCasementWindow } from '${rel('3d/components/casement/ArchedCasementWindow.jsx')}';`,
    `export { default as FixFrameWindow } from '${rel('3d/components/fix-frame/FixFrameWindow.jsx')}';`,
    `export { default as DoorWindow } from '${rel('3d/components/door/DoorWindow.jsx')}';`,
    `export { default as ParametricSashWindow } from '${rel('3d/components/ParametricSashWindow.jsx')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const LIVE = await bundle(resolve(ROOT, 'src'), 't40-live');
const REF = await bundle(resolve(tree, 'src'), tag);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.01) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

// ── mount a component, read back every mesh: [kind, minX, minY, minZ, maxX, maxY, maxZ] in mm ──
const newCanvas = () => ({ width: 800, height: 600, style: {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; }, clientWidth: 800, clientHeight: 600, parentElement: null });
const gl = (canvas) => ({ render() {}, setPixelRatio() {}, getPixelRatio: () => 1, setSize() {}, setAnimationLoop() {}, dispose() {},
  xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} },
  shadowMap: { enabled: false }, domElement: canvas, info: { render: {} }, outputColorSpace: '', toneMapping: 0 });
async function meshes(M, Comp, props) {
  M.extend(M.THREE);
  const canvas = newCanvas();   // one canvas per root (R3F keeps one root per canvas)
  const root = M.createRoot(canvas);
  await root.configure({ gl: () => gl(canvas), frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 }, events: undefined });
  const store = root.render(M.createElement(Comp, props));
  await new Promise((r) => setTimeout(r, 300));
  const scene = store.getState().scene;
  scene.updateMatrixWorld(true);
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const b = new M.THREE.Box3().setFromObject(o);
    const mmr = (v) => Math.round(v * 1e5) / 100;   // m -> mm, 0.01 mm
    out.push({ kind: o.geometry.type, min: [mmr(b.min.x), mmr(b.min.y), mmr(b.min.z)], max: [mmr(b.max.x), mmr(b.max.y), mmr(b.max.z)] });
  });
  root.unmount();
  return out;
}
const key = (m) => `${m.kind}|${m.min.join(',')}|${m.max.join(',')}`;
const w = (m) => Math.round((m.max[0] - m.min[0]) * 100) / 100;
const h = (m) => Math.round((m.max[1] - m.min[1]) * 100) / 100;
const R2 = (v) => Math.round(v * 100) / 100;


// classify a CasementPanel's meshes in its own frame (leaf centred on the origin, y up, mm)
function panelParts(ms, W, H) {
  const tol = 0.02;
  const full = (m) => near(m.min[0], -W / 2, tol) && near(m.max[0], W / 2, tol);
  return {
    bottomRail: ms.filter((m) => m.kind === 'ExtrudeGeometry' && full(m) && near(m.min[1], -H / 2, tol) && m.max[1] < 0),
    topRail: ms.filter((m) => m.kind === 'ExtrudeGeometry' && full(m) && near(m.max[1], H / 2, tol) && m.min[1] > 0),
    stiles: ms.filter((m) => m.kind === 'ExtrudeGeometry' && near(h(m), H, tol)),
    glass: ms.filter((m) => m.kind === 'BoxGeometry').sort((a, b) => w(b) * h(b) - w(a) * h(a))[0],
  };
}
const P = { width: 898, height: 1102 };
// CasementPanel takes its materials from the window component (a THREE material of that bundle)
const mat = (M) => { const m = new M.THREE.MeshStandardMaterial(); return { material: m, materialInt: m }; };
const midY = (m) => Math.round(((m.min[1] + m.max[1]) / 2) * 100) / 100;

// ═════════════════════════════════════════════════════════════════════════════
section('1 - CasementPanel 898 x 1102: bottom rail 67, top rail and stiles 64, glass between them');
for (const hinge of ['fixed', 'left', 'top']) {
  const a = await meshes(LIVE, LIVE.Panel.default, { ...P, ...mat(LIVE), hingeType: hinge, opening: 0, bottomRail: LIVE.Panel.SASH_BOTTOM_RAIL });
  const b = await meshes(REF, REF.Panel.default, { ...P, ...mat(REF), hingeType: hinge, opening: 0 });
  const pa = panelParts(a, P.width, P.height), pb = panelParts(b, P.width, P.height);
  ok(pa.bottomRail.length === 2 && pa.bottomRail.every((m) => near(h(m), 67, 0.02)) && pb.bottomRail.length === 2 && pb.bottomRail.every((m) => near(h(m), 64, 0.02)),
    `${hinge}: bottom rail EXT + INT ${pa.bottomRail.map(h).join(' / ')} high (START ${pb.bottomRail.map(h).join(' / ')}), full leaf width ${w(pa.bottomRail[0])}`);
  ok(pa.topRail.length === 2 && pa.topRail.every((m) => near(h(m), 64, 0.02)) && pa.stiles.length === 4 && pa.stiles.every((m) => near(w(m), 64, 0.02)),
    `${hinge}: top rail ${pa.topRail.map(h).join(' / ')}, stiles ${pa.stiles.map(w).join(' / ')} wide, full height (unchanged)`);
  ok(JSON.stringify(pa.topRail.map(key)) === JSON.stringify(pb.topRail.map(key)) && JSON.stringify(pa.stiles.map(key)) === JSON.stringify(pb.stiles.map(key)),
    `${hinge}: top rail and stile meshes byte-identical to START`);
  // glass: 770 x (1102 - 64 - 67) = 971, from the bottom rail's glazing edge (-551 + 67 = -484) to the top rail's (551 - 64 = 487)
  ok(near(w(pa.glass), 770, 0.02) && near(h(pa.glass), 971, 0.02) && near(pa.glass.min[1], -484, 0.02) && near(pa.glass.max[1], 487, 0.02) && near(midY(pa.glass), midY(pb.glass) + 1.5, 0.02),
    `${hinge}: glass ${w(pa.glass)} x ${h(pa.glass)} from y ${pa.glass.min[1]} to ${pa.glass.max[1]}, centre ${midY(pa.glass)} = START ${midY(pb.glass)} + 1.5 (START ${w(pb.glass)} x ${h(pb.glass)})`);
  // everything that is not a member: the glazing group (glass, spacers) moves up 1.5 and the glass loses 3;
  // the top-hung handle sits on the bottom rail's visible centre: 21 + (67 - 21) / 2 = 44 (START 42.5) -> 1.5 up
  const rest = (arr, parts) => arr.filter((m) => !parts.bottomRail.includes(m) && !parts.topRail.includes(m) && !parts.stiles.includes(m));
  const ra = rest(a, pa), rb = rest(b, pb);
  const glazing = (m) => m.kind === 'BoxGeometry';
  const handleA = ra.filter((m) => !glazing(m)), handleB = rb.filter((m) => !glazing(m));
  const shifted = (x, y, dy) => near(x.min[0], y.min[0], 0.02) && near(x.max[0], y.max[0], 0.02) && near(x.min[2], y.min[2], 0.02) && near(x.max[2], y.max[2], 0.02) && near(x.min[1], y.min[1] + dy, 0.02) && near(x.max[1], y.max[1] + dy, 0.02);
  if (hinge === 'fixed') ok(handleA.length === 0 && handleB.length === 0, 'fixed: no handle');
  else if (hinge === 'left') ok(handleA.length > 0 && handleA.length === handleB.length && handleA.every((m, i) => key(m) === key(handleB[i])), `left: the handle on the stile (${handleA.length} meshes) is byte-identical to START`);
  else ok(handleA.length > 0 && handleA.length === handleB.length && handleA.every((m, i) => shifted(m, handleB[i], 1.5)), `top: the handle on the bottom rail (${handleA.length} meshes) moved up exactly 1.5 (rail centre 44, START 42.5)`);
}
{
  // the default (no bottomRail): one face all round, byte-identical to START (FixFrameWindow draws this)
  const a = await meshes(LIVE, LIVE.Panel.default, { ...P, ...mat(LIVE), hingeType: 'fixed', opening: 0 });
  const b = await meshes(REF, REF.Panel.default, { ...P, ...mat(REF), hingeType: 'fixed', opening: 0 });
  ok(a.length === b.length && a.every((m, i) => key(m) === key(b[i])), `CasementPanel without bottomRail: ${a.length} meshes byte-identical to START (the fixed-frame rectangle keeps its 64 all round)`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - CasementWindow 040L (2V / 1H) and 021 at 1000 x 1200: what moved, and only that');
for (const [name, props] of [['040L 1000 x 1200 2V / 1H', { width: 1000, height: 1200, layout: '040L', hBars: 1, vBars: 2 }], ['021 1000 x 1200', { width: 1000, height: 1200, layout: '021' }]]) {
  const common = { opening: 0, showGuides: false };
  const a = await meshes(LIVE, LIVE.CasementWindow, { ...props, ...common });
  const b = await meshes(REF, REF.CasementWindow, { ...props, ...common });
  ok(a.length === b.length && a.length > 0, `${name}: ${a.length} meshes (START ${b.length})`);
  // the bottom rails: the meshes whose START twin is 64 high and now 67, same bottom edge
  const isRail = (x, y) => x.kind === 'ExtrudeGeometry' && near(h(y), 64, 0.02) && near(h(x), 67, 0.02) && near(x.min[1], y.min[1], 0.02) && near(w(x), w(y), 0.02) && w(x) > 300;
  // the glazing (glass, its spacers, the bars): x and z unchanged, and in y one of three moves only:
  // spans the glass height (the glass, the side spacers, the v bars): bottom up 3, top unchanged;
  // centred on the glass (the h bars): up 1.5; at the glass bottom edge (the bottom spacer): up 3
  const sameXZ = (x, y) => near(x.min[0], y.min[0], 0.02) && near(x.max[0], y.max[0], 0.02) && near(x.min[2], y.min[2], 0.02) && near(x.max[2], y.max[2], 0.02);
  const dy = (x, y, lo, hi) => near(x.min[1], y.min[1] + lo, 0.02) && near(x.max[1], y.max[1] + hi, 0.02);
  const isGlazing = (x, y) => x.kind === y.kind && sameXZ(x, y) && (dy(x, y, 3, 0) || dy(x, y, 1.5, 1.5) || dy(x, y, 3, 3));
  const isHandle = (x, y) => x.kind === y.kind && sameXZ(x, y) && dy(x, y, 1.5, 1.5);
  let same = 0, rails = 0, boxes = 0, up15 = 0, spans = 0, other = [];
  a.forEach((m, i) => {
    const o = b[i];
    if (key(m) === key(o)) same += 1;
    else if (isRail(m, o)) rails += 1;
    else if (m.kind === 'BoxGeometry' && isGlazing(m, o)) boxes += 1;          // the glass and its spacers
    else if (m.kind !== 'BoxGeometry' && isHandle(m, o)) up15 += 1;            // h bar profiles, the top-hung handle
    else if (m.kind !== 'BoxGeometry' && isGlazing(m, o)) spans += 1;          // v bar profiles (span the glass height)
    else other.push(`${key(o)} -> ${key(m)}`);
  });
  const leaves = props.layout === '021' ? 2 : 1;
  ok(rails === 2 * leaves, `${name}: ${rails} bottom rail meshes 64 -> 67 high (EXT + INT per leaf, ${leaves} leaves)`);
  ok(other.length === 0, `${name}: nothing else moved: ${same} meshes identical (frame, cill, stiles, top rails, gaskets); moved only: ${boxes} glass / spacer boxes (3 mm shorter or up 1.5 / 3), ${up15} meshes up 1.5 (h bar profiles${props.layout === '021' ? ', the fan\'s top-hung handle' : ''}), ${spans} v bar profiles (3 mm shorter)`, other.slice(0, 4).join(' | '));
}
{
  // the 040L glass and its one horizontal bar: the glass 3 mm shorter, centred 1.5 higher; the bar in the
  // middle of the NEW glass (equal panes: one line at the glass centre)
  const a = await meshes(LIVE, LIVE.CasementWindow, { width: 1000, height: 1200, layout: '040L', hBars: 1, vBars: 0, opening: 0, showGuides: false });
  const b = await meshes(REF, REF.CasementWindow, { width: 1000, height: 1200, layout: '040L', hBars: 1, vBars: 0, opening: 0, showGuides: false });
  const glassOf = (ms) => ms.filter((m) => m.kind === 'BoxGeometry').sort((x, y) => w(y) * h(y) - w(x) * h(x))[0];
  const ga = glassOf(a), gb = glassOf(b);
  const barOf = (ms, g) => ms.filter((m) => m.kind !== 'BoxGeometry' && near(w(m), w(g), 40) && h(m) < 40 && m.min[1] > g.min[1] && m.max[1] < g.max[1]);
  const ba = barOf(a, ga), bb = barOf(b, gb);
  const leafH = h(gb) + 128;   // START: glass = leaf - 2 x 64
  ok(near(h(ga), h(gb) - 3, 0.02) && near(midY(ga), midY(gb) + 1.5, 0.02) && near(h(ga), leafH - 131, 0.02),
    `040L glass ${w(ga)} x ${h(ga)} = leaf ${leafH} - 64 - 67 (START ${w(gb)} x ${h(gb)}), centre ${midY(ga)} = START ${midY(gb)} + 1.5`);
  ok(ba.length > 0 && ba.every((m) => near(midY(m), midY(ga), 0.05)) && bb.every((m) => near(midY(m), midY(gb), 0.05)),
    `040L one horizontal bar at the glass centre: y ${[...new Set(ba.map(midY))].join(', ')} (START ${[...new Set(bb.map(midY))].join(', ')})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - ArchedCasementWindow three-centre 1000 x 1500, rise 200: the bottom member 67, the outline unchanged');
{
  const props = { width: 1000, height: 1500, archShape: 'three-centre', archRise: 200, hingeDirection: 'left', opening: 0, showGuides: false };
  const a = await meshes(LIVE, LIVE.ArchedCasementWindow, props);
  const b = await meshes(REF, REF.ArchedCasementWindow, props);
  ok(a.length === b.length && a.length > 0, `arched: ${a.length} meshes (START ${b.length})`);
  const glassOf = (ms) => ms.filter((m) => m.kind === 'ShapeGeometry').sort((x, y) => w(y) * h(y) - w(x) * h(x))[0];
  const ga = glassOf(a), gb = glassOf(b);
  // the leaf ring: the widest extruded mesh that is not the frame, with the glass inside it
  const ringOf = (ms, g) => ms.filter((m) => m.kind === 'ExtrudeGeometry' && m.min[0] < g.min[0] && m.max[0] > g.max[0] && m.min[1] < g.min[1] && m.max[1] > g.max[1])
    .sort((x, y) => w(x) * h(x) - w(y) * h(y))[0];
  const ra = ringOf(a, ga), rb = ringOf(b, gb);
  ok(ra && rb && key(ra) === key(rb), `arched: the leaf outline (ring bbox ${ra ? `${w(ra)} x ${h(ra)}` : '?'}) unchanged against START`);
  ok(ra && near(ga.min[1] - ra.min[1], 67, 0.05) && near(gb.min[1] - rb.min[1], 64, 0.05) && near(ga.max[1], gb.max[1], 0.05) && near(w(ga), w(gb), 0.05),
    `arched: the glass starts ${R2(ga.min[1] - ra.min[1])} above the leaf bottom (START ${R2(gb.min[1] - rb.min[1])}), top and width unchanged (${w(ga)} wide, apex ${ga.max[1]})`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - nothing else in the 3D moved: fixed frame, door, sash');
for (const [name, comp, props] of [
  ['FixFrameWindow rectangle 1000 x 1500', 'FixFrameWindow', { width: 1000, height: 1500, fixShape: 'rectangle', showGuides: false }],
  ['FixFrameWindow circle 800', 'FixFrameWindow', { width: 800, height: 800, fixShape: 'circle', showGuides: false }],
  ['DoorWindow 040L 1000 x 2100', 'DoorWindow', { width: 1000, height: 2100, layout: '040L', opening: 0, showGuides: false }],
  ['ParametricSashWindow 1200 x 1800', 'ParametricSashWindow', { width: 1200, height: 1800, opening: 0, upperOpening: 0, showGuides: false }],
]) {
  let a = null, b = null, err = '';
  try { a = await meshes(LIVE, LIVE[comp], props); b = await meshes(REF, REF[comp], props); } catch (e) { err = String(e?.message || e); }
  ok(a && b && a.length > 0 && a.length === b.length && a.every((m, i) => key(m) === key(b[i])), `${name}: ${a?.length ?? '?'} meshes byte-identical to START`, err);
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - the constants');
ok(LIVE.Panel.SASH_RAIL === 64 && LIVE.Panel.SASH_BOTTOM_RAIL === 67 && REF.Panel.SASH_RAIL === 64 && REF.Panel.SASH_BOTTOM_RAIL === undefined,
  `CasementPanel exports SASH_RAIL ${LIVE.Panel.SASH_RAIL} (kept) and SASH_BOTTOM_RAIL ${LIVE.Panel.SASH_BOTTOM_RAIL} (new; START had none)`);


console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
