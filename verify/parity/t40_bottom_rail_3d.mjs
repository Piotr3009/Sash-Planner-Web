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
 *   6  doors to production (Piotr 08.10.2026, LIVE only; doors v3 09.10.2026): DoorWindow
 *      with the engine geometry (doorGeo, the group centred on the frame): single 900 x
 *      2100 leaf 798 x 1998 (H - 51 - 51), stiles 94, top 94, bottom 180, glass daylight
 *      610 x 1724, 3 hinges (4 on a 2146 leaf), timber cill 41 / 68 with a 10 gap under
 *      the leaf, aluminium / low-profile 1998 on the product strip; mid rail 94 and the
 *      panel at its outer size (daylight + 2 x 17) with the 24 / 15 / 40 edge for
 *      half-glazed / three-quarter; french 1600 leaves 755, hinge stiles 94, meeting
 *      stiles 100 lapping 12 at the centre, handles per lockType at the profile backset
 *      from the lock edge; the active leaf checked against deriveWindowData for both
 *      hinge sides; inward: the same leaf height on the interior face, the 40 / 35 cill,
 *      a stored aluminium ignored; the frame land the exact complement of the engine
 *      openings; casement mullions (land 26) through the transom band 21 cut in the
 *      engine segments; side lights 64 / 64 / 180; the opening fanlight a 64 / 64 / 67
 *      casement leaf, the fixed one a non-opening 64 / 64 / 67 leaf (no handle, no
 *      swing); the page derived (batch profile snapshot) reaches the meshes; triple
 *      unit 28 in a 61 leaf
 *
 * Run: node verify/parity/t40_bottom_rail_3d.mjs [git-ref]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// ═════════════════════════════════════════════════════════════════════════════
// 6 - doors to production (brief 5.1, Piotr 08.10.2026; doors v3, Piotr 09.10.2026):
// DoorWindow with the engine geometry (doorGeo from utils/windowSpecToConfig.js
// doorGeometryFromSpec), LIVE tree only. The door is built the way the preview builds
// it (normaliseToWindowSpec -> windowSpecToConfig -> DoorWindow) and measured on the
// meshes; the no-props DoorWindow stays byte-identical to START (section 4).
// Doors v3: W x H is the OVERALL frame (side panels behind casement mullions, the
// fanlight above a casement transom inside it), every leaf bottom stands 51 above the
// floor line, the 3D group is centred on the frame (doorGeo.origin = W / 2, H / 2).
// Every expected number below is worked out by hand from the owner box rules first,
// then checked against the engine (deriveWindowData) and then against the meshes.
section('6 - DoorWindow with doorGeo: the owner box numbers in the door 3D (LIVE)');
{
  const entry = resolve(AUDIT, 't40-live-door-entry.mjs');
  const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    "export { createRoot, extend } from '@react-three/fiber';",
    "export * as THREE from 'three';",
    "export { createElement } from 'react';",
    `export { default as DoorWindow } from '${rel('3d/components/door/DoorWindow.jsx')}';`,
    `export * as wsc from '${rel('utils/windowSpecToConfig.js')}';`,
    `export * as specification from '${rel('engine/specification.js')}';`,
    `export * as calculations from '${rel('engine/calculations.js')}';`,
    // doors v3: the batch profile snapshot path (withProfiles) for the derived pass-through check
    `export * as profile from '${rel('engine/profile.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, 't40-live-door-bundle.mjs');
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const DM = await import(pathToFileURL(out).href + `?t=${Date.now()}`);

  // the meshes with the names of their ancestors (the door assembly names its groups)
  async function namedMeshes(props) {
    DM.extend(DM.THREE);
    const canvas = newCanvas();
    const root = DM.createRoot(canvas);
    await root.configure({ gl: () => gl(canvas), frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 }, events: undefined });
    const store = root.render(DM.createElement(DM.DoorWindow, props));
    await new Promise((r) => setTimeout(r, 300));
    const scene = store.getState().scene;
    scene.updateMatrixWorld(true);
    const res = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const b = new DM.THREE.Box3().setFromObject(o);
      const mmr = (v) => Math.round(v * 1e5) / 100;
      const names = [];
      for (let p = o; p; p = p.parent) if (p.name) names.push(p.name);
      res.push({ kind: o.geometry.type, names, min: [mmr(b.min.x), mmr(b.min.y), mmr(b.min.z)], max: [mmr(b.max.x), mmr(b.max.y), mmr(b.max.z)] });
    });
    root.unmount();
    return res;
  }
  // doors v3: `derived` (optional) is handed to windowSpecToConfig the way the pages do
  // (WindowPreview3D / Window3DCaptureRig), `opening` moves the leaves
  const door = async (width, height, fc, { derived = null, opening = 0 } = {}) => {
    const spec = DM.specification.normaliseToWindowSpec({ id: 'D', name: 'D', width, height }, { fullConfig: { windowCategory: 'door', ...fc } });
    const cfg = DM.wsc.windowSpecToConfig(spec, derived);
    const ms = await namedMeshes({ width: cfg.width, height: cfg.height, frameDims: cfg.frameDims, opening, showGuides: false, doorGeo: cfg.doorGeo, ironmongery: cfg.ironmongery, glassFinish: 'clear' });
    const geo = cfg.doorGeo;
    // frame mm (y down, top-left origin) -> the DoorWindow group (doors v3: centred on
    // doorGeo.origin, the frame centre W / 2, H / 2; was the door zone centre)
    const cx = geo.origin.x, cy = geo.origin.y;
    return { spec, cfg, geo, ms, X: (x) => R2(x - cx), Y: (y) => R2(cy - y) };
  };
  const has = (m, n) => m.names.some((x) => x === n || x.startsWith(n));
  const inLeaf = (ms, role) => ms.filter((m) => has(m, `door-leaf-${role}`) && !has(m, 'door-handle'));
  const members = (ms) => ms.filter((m) => m.kind === 'ExtrudeGeometry');
  const glassOf = (ms) => ms.filter((m) => m.kind === 'BoxGeometry' && !has(m, 'door-panel')).sort((a, b) => w(b) * h(b) - w(a) * h(a))[0];
  const d = (m) => R2(m.max[2] - m.min[2]);
  const bbox = (ms) => ({ min: [0, 1, 2].map((k) => Math.min(...ms.map((m) => m.min[k]))), max: [0, 1, 2].map((k) => Math.max(...ms.map((m) => m.max[k]))) });
  const noNaN = (ms) => ms.length > 0 && ms.every((m) => [...m.min, ...m.max].every(Number.isFinite));
  const midX = (m) => R2((m.min[0] + m.max[0]) / 2), midYm = (m) => R2((m.min[1] + m.max[1]) / 2);
  // doors v3: the frame land is the complement of the engine's visible openings. The EXT
  // land meshes and zones.openings tile the frame W x H exactly (no overlap, no gap):
  // the land is built from the derived openings, not from the leaves grown by the gap
  // (that made the transom band 23 instead of the casement 21). Outward doors only (an
  // inward door field is drawn at the full member faces, its rebate faces the room).
  const tiling = (D) => {
    const land = D.ms.filter((m) => has(m, 'frame-land-ext')).map((m) => ({ x0: m.min[0], x1: m.max[0], y0: m.min[1], y1: m.max[1] }));
    const ops = D.geo.openings.map((o) => ({ x0: D.X(o.x), x1: D.X(o.x + o.w), y0: D.Y(o.y + o.h), y1: D.Y(o.y) }));
    const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
    const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const all = [...land, ...ops];
    let overlap = 0;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) overlap += inter(all[i], all[j]);
    return { land: land.length, overlap: R2(overlap), total: R2(all.reduce((s, r) => s + area(r), 0)), frame: D.geo.totalWidth * D.geo.totalHeight };
  };
  const tiles = (D, name) => {
    const t = tiling(D);
    ok(t.land > 0 && t.overlap === 0 && near(t.total, t.frame, 1),
      `${name}: the frame land (${t.land} EXT meshes) + the engine openings (${D.geo.openings.length}) tile the frame ${D.geo.totalWidth} x ${D.geo.totalHeight} exactly (overlap ${t.overlap}, area ${t.total} = ${t.frame})`);
  };

  // ── single 900 x 2100, outward, timber cill: leaf 798 x 1998, stiles 94, top 94, bottom 180, glass 610 x 1724 ──
  {
    const D = await door(900, 2100, { doorType: 'single-external' });
    const L = D.geo.leaves[0];
    // doors v3: leaf H = H - 51 - 51 = 1998, was H - 98 = 2002; the group origin is the frame centre (450, 1050)
    ok(D.geo && L.w === 798 && L.h === 1998 && D.geo.leafDepth === 57 && D.geo.glassThickness === 24 && noNaN(D.ms)
        && D.geo.origin.x === 450 && D.geo.origin.y === 1050,
      `single 900 x 2100: windowSpecToConfig carries doorGeo (leaf ${L.w} x ${L.h}, depth ${D.geo.leafDepth}, unit ${D.geo.glassThickness}, origin ${D.geo.origin.x} / ${D.geo.origin.y}); ${D.ms.length} meshes, no NaN`);
    const lm = inLeaf(D.ms, 'single');
    const bb = bbox(members(lm));
    // doors v3: H - 102 (51 at the head, 51 above the floor), was H - 98
    ok(near(bb.max[0] - bb.min[0], 798, 0.02) && near(bb.max[1] - bb.min[1], 1998, 0.02) && near(bb.min[1], D.Y(L.y + L.h), 0.02) && near(bb.max[1], D.Y(L.y), 0.02) && near(bb.min[0], D.X(L.x), 0.02)
        && near(bb.min[1], D.Y(2100 - 51), 0.02),
      `single: the leaf in the 3D is ${R2(bb.max[0] - bb.min[0])} x ${R2(bb.max[1] - bb.min[1])} from y ${bb.min[1]} to ${bb.max[1]} (engine: x ${D.X(L.x)}, y ${D.Y(L.y + L.h)} to ${D.Y(L.y)}; W - 102, H - 102, the bottom 51 above the floor)`);
    // doors v3: the stiles run the leaf height 1998, was 2002
    const stiles = members(lm).filter((m) => near(h(m), 1998, 0.02));
    const rails = members(lm).filter((m) => near(w(m), 798, 0.02) && h(m) < 400);
    ok(stiles.length === 4 && stiles.every((m) => near(w(m), 94, 0.02)),
      `single: stiles EXT + INT x 2 = ${stiles.length} meshes, ${[...new Set(stiles.map(w))].join(' / ')} wide x 1998 high`);
    const top = rails.filter((m) => near(m.max[1], bb.max[1], 0.02)), bottom = rails.filter((m) => near(m.min[1], bb.min[1], 0.02));
    ok(top.length === 2 && top.every((m) => near(h(m), 94, 0.02)) && bottom.length === 2 && bottom.every((m) => near(h(m), 180, 0.02)) && rails.length === 4,
      `single: top rail ${top.map(h).join(' / ')} and bottom rail ${bottom.map(h).join(' / ')} high, 798 wide (EXT + INT), no mid rail on full glass`);
    const g = glassOf(lm);
    // doors v3: daylight 1998 - 94 - 180 = 1724, was 1728; the unit 633 x 1747 (was 1751)
    ok(g && near(w(g), 610, 0.02) && near(h(g), 1724, 0.02) && near(d(g), 24, 0.02) && near(w(g), L.daylight.w, 0.02) && near(h(g), L.daylight.h, 0.02)
        && L.glass.w === 633 && L.glass.h === 1747,
      `single: glass at the daylight ${w(g)} x ${h(g)} (engine ${L.daylight.w} x ${L.daylight.h}; unit ${L.glass.w} x ${L.glass.h} less 2 x 11.5), unit ${d(g)} thick`);
    const hinges = D.ms.filter((m) => has(m, 'door-hinge'));
    // doors v3: the leaf 1998 is not above 2100: 3 hinges, 200 / 899 / 1848 below the leaf top
    ok(hinges.length === 3 && hinges.every((m) => m.kind === 'CylinderGeometry' && near(h(m), D.geo.hingeBarrel, 0.02)) && L.hinges.every((hy) => hinges.some((m) => near((m.min[1] + m.max[1]) / 2, D.Y(hy), 0.02)))
        && JSON.stringify(L.hinges) === JSON.stringify([51 + 200, 51 + 899, 51 + 1848]),
      `single: ${hinges.length} hinges (leaf 1998 is not above 2100) at the engine centres ${L.hinges.map(D.Y).join(', ')}, on the hinge edge x ${D.X(L.hingeEdgeX)}`);
    const levers = D.ms.filter((m) => m.kind === 'TubeGeometry');
    ok(levers.length === 2 && levers.every((m) => near((m.min[1] + m.max[1]) / 2, D.Y(L.handleY), 1.0)),
      `single: one handle set (EXT + INT levers ${levers.length}) at the engine handle height y ${D.Y(L.handleY)} (1000 above the floor)`);
    // the backplate is centred on the spindle: the spindle sits the profile backset in from the lock edge
    const plates = D.ms.filter((m) => has(m, 'door-handle') && m.kind === 'ExtrudeGeometry');
    const lockX = D.X(L.hinge === 'left' ? L.x + L.w : L.x);
    const spindleIn = plates.map((m) => R2(Math.abs((m.min[0] + m.max[0]) / 2 - lockX)));
    ok(D.geo.handle.backset === 45 && plates.length === 2 && spindleIn.every((v) => near(v, D.geo.handle.backset, 0.02)),
      `single: the handle spindle ${spindleIn.join(' / ')} in from the lock edge (profile backset ${D.geo.handle.backset}, where the sheets draw it)`);
    const landExt = D.ms.filter((m) => has(m, 'frame-land-ext'));
    const headLand = landExt.filter((m) => near(m.max[1], D.Y(0), 0.02) && near(w(m), 900, 0.02) && near(h(m), 47, 0.02));
    const jambLand = landExt.filter((m) => near(w(m), 47, 0.02) && h(m) > 1900);
    const jambStops = D.ms.filter((m) => has(m, 'frame-stop-left') || has(m, 'frame-stop-right'));
    ok(headLand.length === 1 && jambLand.length === 2 && jambStops.length === 2 && jambStops.every((m) => near(w(m), 21, 0.02)) && D.geo.members.land === 47 && D.geo.members.rebate === 21,
      `single: the frame shows the land 47 at the head and both jambs, with a 21 rebate stop inside (face 68)`);
    const cillLand = D.ms.filter((m) => has(m, 'frame-land') && near(m.min[1], D.Y(D.geo.totalHeight), 0.02) && near(w(m), 900, 0.02));
    const cillStop = D.ms.filter((m) => has(m, 'frame-stop-bottom'));
    // doors v3: the leaf bottom stands 51 above the floor, the cill shows 41: the leaf clears the cill land by 51 - 41 = 10 (was 6)
    ok(cillLand.length === 2 && cillLand.every((m) => near(h(m), 41, 0.02)) && cillStop.length === 1 && near(h(cillStop[0]), 68 - 41, 0.02) && near(bb.min[1] - cillLand[0].max[1], 10, 0.02)
        && D.geo.cill.visible === 41,
      `single: timber cill: ${cillLand.length} land meshes ${h(cillLand[0])} high (41 visible), stop to the cill face 68 (${h(cillStop[0])}), ${R2(bb.min[1] - cillLand[0].max[1])} gap under the leaf (51 - 41)`);
    tiles(D, 'single');
  }

  // ── a leaf above 2100 (frame 2248: leaf 2146) carries 4 hinges ──
  {
    const D = await door(900, 2248, { doorType: 'single-external' });
    const hinges = D.ms.filter((m) => has(m, 'door-hinge'));
    // doors v3: leaf 2248 - 102 = 2146 (was 2150), still above 2100: 4 hinges
    ok(D.geo.leaves[0].h === 2146 && hinges.length === 4 && D.geo.leaves[0].hinges.every((hy) => hinges.some((m) => near((m.min[1] + m.max[1]) / 2, D.Y(hy), 0.02))),
      `single 900 x 2248: leaf ${D.geo.leaves[0].h}, ${hinges.length} hinges at the engine centres`);
  }

  // ── no timber cill (aluminium threshold): the leaf is 1998 as on the timber cill ──
  {
    const D = await door(900, 2100, { doorType: 'single-external', thresholdType: 'aluminium' });
    const bb = bbox(members(inLeaf(D.ms, 'single')));
    const thr = D.ms.filter((m) => has(m, 'threshold-aluminium'));
    // doors v3: every leaf stands 51 above the floor whatever the threshold: 1998 (was 2043 = H - 57); the
    // aluminium strip fills that 51 zone under the leaf (its top is the leaf bottom), the door opening wide
    // (thresholdInfo.openingWidth 806 = 900 - 2 x 47, the threshold seal length), full frame depth
    ok(near(bb.max[1] - bb.min[1], 1998, 0.02) && thr.length === 1 && near(bb.min[1], thr[0].max[1], 0.02) && !D.ms.some((m) => has(m, 'frame-stop-bottom'))
        && near(h(thr[0]), 51, 0.02) && near(w(thr[0]), D.geo.thresholdInfo.openingWidth, 0.02) && D.geo.thresholdInfo.openingWidth === 806 && near(d(thr[0]), 93, 0.02)
        && D.geo.thresholdInfo.effectiveType === 'aluminium' && D.geo.thresholdInfo.seal?.length === 806,
      `aluminium threshold: leaf ${R2(bb.max[1] - bb.min[1])} high (2100 - 102, as on a timber cill), no timber cill, the threshold strip under the leaf (${w(thr[0])} x ${h(thr[0])} x ${d(thr[0])}: the door opening, the 51 zone, the frame depth)`);
    // the jamb stops stand on the threshold, they do not run through it
    const jambStops = D.ms.filter((m) => has(m, 'frame-stop-left') || has(m, 'frame-stop-right'));
    ok(jambStops.length === 2 && jambStops.every((m) => near(m.min[1], thr[0].max[1], 0.02)),
      `aluminium threshold: the jamb rebate stops end on the threshold (y ${jambStops.map((m) => m.min[1]).join(' / ')})`);
    tiles(D, 'aluminium threshold');
  }
  {
    // doors v3 (new): low-profile: the product strip is half the 51 zone and only the leaf deep
    const D = await door(900, 2100, { doorType: 'single-external', thresholdType: 'low-profile' });
    const thr = D.ms.filter((m) => has(m, 'threshold-low-profile'));
    const bb = bbox(members(inLeaf(D.ms, 'single')));
    ok(thr.length === 1 && near(h(thr[0]), 25.5, 0.02) && near(d(thr[0]), D.geo.leafDepth, 0.02) && near(bb.max[1] - bb.min[1], 1998, 0.02) && !D.ms.some((m) => has(m, 'threshold-aluminium')),
      `low-profile threshold: leaf ${R2(bb.max[1] - bb.min[1])}, the strip ${w(thr[0])} x ${h(thr[0])} x ${d(thr[0])} (half the 51 zone, the leaf depth)`);
  }

  // ── inward: the same leaf height (H - 102 in both directions), the leaf flush with the
  //    INTERIOR face, the unrebated 40 -> 35 cill (no rebate stop on it), the hinges on the interior ──
  {
    const D = await door(900, 2100, { doorType: 'single-external', doorOpenDirection: 'inward' });
    const L = D.geo.leaves[0];
    const fd = D.geo.frameDepth;
    const bb = bbox(members(inLeaf(D.ms, 'single')));
    // doors v3: 1998 (was 2002 = H - 98)
    ok(D.geo.inward && L.h === 1998 && near(bb.max[1] - bb.min[1], 1998, 0.02) && near(bb.min[1], D.Y(L.y + L.h), 0.02) && near(bb.min[2], -fd / 2, 0.02) && near(bb.max[2] - bb.min[2], D.geo.leafDepth, 0.02),
      `inward: leaf ${R2(bb.max[1] - bb.min[1])} high (H - 102, as outward), flush with the interior face (z ${bb.min[2]} to ${bb.max[2]}, frame ${-fd / 2} to ${fd / 2})`);
    const cill = D.ms.filter((m) => has(m, 'cill-inward'));
    const cb = cill.length ? bbox(cill) : null;
    const hinges = D.ms.filter((m) => has(m, 'door-hinge'));
    ok(D.geo.cill.inwardInternal === 40 && D.geo.cill.inwardExternal === 35 && cill.length === 2 && near(cb.max[1] - cb.min[1], 40, 0.02) && near(cb.min[1], D.Y(D.geo.totalHeight), 0.02)
        && !D.ms.some((m) => has(m, 'frame-stop-bottom')) && hinges.length === 3 && hinges.every((m) => near((m.min[2] + m.max[2]) / 2, -fd / 2, 0.02)),
      `inward: the unrebated cill ${D.geo.cill.inwardInternal} -> ${D.geo.cill.inwardExternal} (${cb ? R2(cb.max[1] - cb.min[1]) : '?'} high, no rebate stop), ${hinges.length} hinges on the interior face`);
    // doors v3 (new): the engine draws the inward door field at the full member faces (68); the 3D land is
    // still 47 (the full-depth part) with the 21 stop on the EXTERIOR, so from outside 47 + 21 = 68 shows
    const jambLand = D.ms.filter((m) => has(m, 'frame-land-ext-jamb'));
    const jambStops = D.ms.filter((m) => has(m, 'frame-stop-left') || has(m, 'frame-stop-right'));
    const o = D.geo.openings.find((x) => x.kind === 'door');
    ok(o.x === 68 && o.w === 900 - 2 * 68 && jambLand.length === 2 && jambLand.every((m) => near(w(m), 47, 0.02)) && jambStops.length === 2 && jambStops.every((m) => near(w(m), 21, 0.02) && near(m.max[2], fd / 2, 0.02)),
      `inward: the engine opening at the member faces (x ${o.x}, ${o.w} wide); the 3D land 47 and a 21 stop on the exterior face (47 + 21 = 68)`);
  }
  {
    // doors v3 (new, owner box item 9): an inward door is ALWAYS on its timber inward cill; a stored
    // aluminium threshold is ignored (thresholdInfo.ignored), no aluminium strip is drawn
    const D = await door(900, 2100, { doorType: 'single-external', doorOpenDirection: 'inward', thresholdType: 'aluminium' });
    const bb = bbox(members(inLeaf(D.ms, 'single')));
    ok(D.geo.threshold === 'aluminium' && D.geo.thresholdInfo.effectiveType === 'standard' && D.geo.thresholdInfo.ignored && D.geo.hasTimberCill
        && D.ms.filter((m) => has(m, 'cill-inward')).length === 2 && !D.ms.some((m) => has(m, 'threshold-aluminium') || has(m, 'threshold-low-profile')) && near(bb.max[1] - bb.min[1], 1998, 0.02),
      `inward + stored aluminium: the timber inward cill (effectiveType ${D.geo.thresholdInfo.effectiveType}, ignored ${D.geo.thresholdInfo.ignored}), no aluminium strip, leaf ${R2(bb.max[1] - bb.min[1])}`);
  }

  // ── half-glazed and three-quarter: the mid rail 94 at the engine axis, glass above, the panel below ──
  //    doors v3: axis = 0.5 / 0.75 x 1998 = 999 / 1498.5 (was 1001 / 1501.5); glass daylight 999 - 47 - 94 = 858
  //    and 1498.5 - 47 - 94 = 1357.5 (was 860 / 1360.5); panel daylight 1998 - 180 - axis - 47 = 772 / 272.5;
  //    the panel is drawn at its OUTER size, daylight + 2 x 17 = 644 x 806 / 644 x 306.5 (was the daylight)
  for (const [style, glassH, panelDayH, axis] of [['half-glazed', 858, 772, 999], ['three-quarter', 1357.5, 272.5, 1498.5]]) {
    const D = await door(900, 2100, { doorType: 'single-external', doorStyle: style });
    const L = D.geo.leaves[0];
    const lm = inLeaf(D.ms, 'single');
    const mid = members(lm).filter((m) => near(w(m), 798, 0.02) && near(h(m), 94, 0.02) && near((m.min[1] + m.max[1]) / 2, D.Y(L.y + axis), 0.02));
    const g = glassOf(lm.filter((m) => near(d(m), 24, 0.02)));
    const pm = lm.filter((m) => has(m, 'door-panel'));
    const pb = pm.length ? bbox(pm) : null;
    const panelT = pb ? R2(pb.max[2] - pb.min[2]) : null;
    const outerW = 610 + 2 * 17, outerH = panelDayH + 2 * 17;
    ok(L.midRail?.axis === axis && mid.length === 2,
      `${style}: D-MID RAIL 94 x 798 (EXT + INT ${mid.length}) centred on the engine axis ${axis} below the leaf top`);
    ok(g && near(w(g), 610, 0.02) && near(h(g), glassH, 0.02) && near(g.max[1], D.Y(L.y) - 94, 0.02),
      `${style}: glass daylight ${g ? `${w(g)} x ${h(g)}` : '?'} (engine ${L.daylight.w} x ${L.daylight.h}) from the top rail down to the mid rail`);
    ok(pb && L.panel.daylight.w === 610 && L.panel.daylight.h === panelDayH && L.panel.w === outerW && L.panel.h === outerH && L.panel.inset === 17
        && near(pb.max[0] - pb.min[0], outerW, 0.02) && near(pb.max[1] - pb.min[1], outerH, 0.02) && near(panelT, D.geo.panels[0].thickness, 0.02) && D.geo.panels[0].thickness === 54
        && near(pb.min[1], D.Y(L.y + L.h) + 180 - 17, 0.02),
      `${style}: the panel ${pb ? `${R2(pb.max[0] - pb.min[0])} x ${R2(pb.max[1] - pb.min[1])}` : '?'} = daylight ${L.panel.daylight.w} x ${L.panel.daylight.h} + 2 x 17, ${panelT} thick (2 x 18 Tricoya + 18 core), its edge 17 into the 180 bottom rail`);
    // doors v3 (new): the edge profile (profile panel.edge): the tongue slab 24 across the outer size, the
    // field at the full 54 from inset 17 + flat 15 + slope 40 = 72 in from the outer edge
    const e = L.panel.edge;
    const slab = pm.filter((m) => m.kind === 'BoxGeometry' && near(w(m), outerW, 0.02) && near(h(m), outerH, 0.02));
    const fieldW = outerW - 2 * (17 + e.flat + e.slope), fieldH = outerH - 2 * (17 + e.flat + e.slope);
    const field = pm.filter((m) => m.kind === 'BoxGeometry' && near(w(m), fieldW, 0.02) && near(h(m), fieldH, 0.02));
    const slopes = pm.filter((m) => m.kind === 'BufferGeometry');
    ok(e.tongue === 24 && e.flat === 15 && e.slope === 40 && slab.length === 2 && near(bbox(slab).max[2] - bbox(slab).min[2], 24, 0.02)
        && field.length === 2 && near(bbox(field).max[2] - bbox(field).min[2], 54, 0.02)
        && slopes.length === 2 && slopes.every((m) => near(w(m), outerW - 2 * (17 + e.flat), 0.02)),
      `${style}: the panel edge: a tongue slab ${outerW} x ${outerH} x 24, a ${e.flat} flat and a ${e.slope} slope to the field ${fieldW} x ${fieldH} at the full 54`);
  }

  // ── french 1600 x 2100: leaves 755, hinge stiles 94, meeting stiles 100 with the 6 lip, overlap 12 ──
  for (const lockType of ['single', 'double']) {
    const D = await door(1600, 2100, { doorType: 'french', lockType });
    const [A, B] = D.geo.leaves;
    const act = D.geo.leaves.find((l) => l.role === 'active'), pas = D.geo.leaves.find((l) => l.role === 'passive');
    const am = members(inLeaf(D.ms, 'active')), pm = members(inLeaf(D.ms, 'passive'));
    const ab = bbox(am), pb = bbox(pm);
    const mx = D.X(D.geo.meetingX);
    if (lockType === 'single') {
      ok(A.w === 755 && B.w === 755 && near(ab.max[0] - ab.min[0], 755, 0.02) && near(pb.max[0] - pb.min[0], 755, 0.02),
        `french: two leaves ${R2(pb.max[0] - pb.min[0])} / ${R2(ab.max[0] - ab.min[0])} wide ((1600 - 102) / 2 + 6)`);
      const pLeft = pb.max[0] <= ab.max[0];       // the passive leaf is the left one when the active one is hinged right
      ok(near(pLeft ? pb.max[0] - ab.min[0] : ab.max[0] - pb.min[0], 12, 0.02) && near(pLeft ? pb.max[0] : ab.max[0], mx + 6, 0.02) && near(pLeft ? ab.min[0] : pb.min[0], mx - 6, 0.02),
        `french: the leaves overlap ${R2(pLeft ? pb.max[0] - ab.min[0] : ab.max[0] - pb.min[0])} at the centre line (each runs the 6 lip past x ${mx})`);
      // doors v3: the stiles run the leaf height 1998, was 2002
      const stiles = (ms) => ms.filter((m) => near(h(m), 1998, 0.02));
      const hingeSt = (ms, l) => stiles(ms).filter((m) => near(l.hinge === 'left' ? m.min[0] : m.max[0], D.X(l.hingeEdgeX), 0.02));
      const meetSt = (ms, l) => stiles(ms).filter((m) => !hingeSt(ms, l).includes(m));
      ok([[am, act], [pm, pas]].every(([ms, l]) => hingeSt(ms, l).length === 2 && hingeSt(ms, l).every((m) => near(w(m), 94, 0.02))),
        'french: the hinge stiles are 94 (EXT + INT on each leaf)');
      // the EXT half of a member is the one nearer the exterior (+z)
      const halves = (ms, l) => { const s = meetSt(ms, l).sort((a, b) => b.max[2] - a.max[2]); return { ext: s[0], int: s[1] }; };
      const ah = halves(am, act), ph = halves(pm, pas);
      const aExt = w(ah.ext), aInt = w(ah.int), pExt = w(ph.ext), pInt = w(ph.int);
      const lapsExt = D.geo.meetingLap?.face === 'exterior';
      ok(D.geo.members.meeting === 100 && D.geo.lip === 6 && lapsExt && near(aExt, 100, 0.02) && near(aInt, 88, 0.02) && near(pExt, 88, 0.02) && near(pInt, 100, 0.02),
        `french: meeting stiles 100 (94 + lip 6): the active leaf laps on the ${D.geo.meetingLap?.face} (EXT ${aExt} / INT ${aInt}), the passive leaf is rebated (EXT ${pExt} / INT ${pInt})`);
      const zone = (ms) => ms.filter((m) => m.min[0] < mx + 6 - 0.01 && m.max[0] > mx - 6 + 0.01);
      const clash = zone(am).some((a) => zone(pm).some((p) => a.min[2] < p.max[2] - 0.01 && p.min[2] < a.max[2] - 0.01));
      ok(!clash && zone(am).length > 0 && zone(pm).length > 0, 'french: in the 12 overlap the two leaves never occupy the same depth (rebated meeting stiles, no clash)');
      const ga = glassOf(inLeaf(D.ms, 'active')), gp = glassOf(inLeaf(D.ms, 'passive'));
      // doors v3: daylight 755 - 94 - 100 = 561 x (1998 - 94 - 180 = 1724), was 561 x 1728; unit 584 x 1747
      ok([ga, gp].every((g) => near(w(g), 561, 0.02) && near(h(g), 1724, 0.02)) && act.glass.w === 584 && act.glass.h === 1747,
        `french: glass daylight ${w(ga)} x ${h(ga)} per leaf (755 - 94 - 100; unit ${act.glass.w} x ${act.glass.h})`);
      const hingeX = D.ms.filter((m) => has(m, 'door-hinge')).map((m) => R2((m.min[0] + m.max[0]) / 2));
      ok(hingeX.length === 6 && [act, pas].every((l) => hingeX.filter((x) => near(x, D.X(l.hingeEdgeX), 0.02)).length === 3),
        `french: 3 hinges on each leaf's hinge edge (x ${D.X(pas.hingeEdgeX)} / ${D.X(act.hingeEdgeX)})`);
    }
    const leversA = D.ms.filter((m) => m.kind === 'TubeGeometry' && has(m, 'door-leaf-active'));
    const leversP = D.ms.filter((m) => m.kind === 'TubeGeometry' && has(m, 'door-leaf-passive'));
    ok(lockType === 'double' ? (leversA.length === 2 && leversP.length === 2) : (leversA.length === 2 && leversP.length === 0),
      `french lockType ${lockType}: handles on ${lockType === 'double' ? 'both leaves' : 'the active leaf only (passive: bolts)'} (active ${leversA.length / 2}, passive ${leversP.length / 2} sets); the active leaf is the engine's (hinge ${act.hinge})`);
    // the spindles: the master the backset in from the active leaf's meeting edge, the slave (FGTE pair) the slave backset
    const lockEdgeX = (l) => D.X(l.hinge === 'left' ? l.x + l.w : l.x);
    const plateIn = (l) => D.ms.filter((m) => has(m, `door-leaf-${l.role}`) && has(m, 'door-handle') && m.kind === 'ExtrudeGeometry').map((m) => R2(Math.abs((m.min[0] + m.max[0]) / 2 - lockEdgeX(l))));
    const aIn = plateIn(act), pIn = plateIn(pas);
    ok(aIn.length === 2 && aIn.every((v) => near(v, D.geo.handle.backset, 0.02)) && (lockType === 'double' ? pIn.length === 2 && pIn.every((v) => near(v, D.geo.handle.slaveBackset, 0.02)) : pIn.length === 0),
      `french lockType ${lockType}: spindle ${aIn.join(' / ')} in from the active meeting edge (backset ${D.geo.handle.backset})${lockType === 'double' ? `, ${pIn.join(' / ')} on the passive leaf (slave backset ${D.geo.handle.slaveBackset})` : ''}`);
  }

  // ── the active leaf is the ENGINE's, checked against deriveWindowData itself (not the doorGeo copy):
  //    doorGeo carries the engine leaves unchanged, and for either hinge side (stated from INSIDE) the
  //    3D active leaf (the one with the handle on a one-handle french door) is the engine's active leaf ──
  for (const doorHinge of ['left', 'right']) {
    const D = await door(1600, 2100, { doorType: 'french', lockType: 'single', doorHinge });
    const eng = DM.calculations.deriveWindowData(D.spec, {}).door;
    const keys = ['x', 'y', 'w', 'h', 'role', 'hinge', 'meetingSide', 'stileL', 'stileR', 'hingeEdgeX', 'handleY'];
    // doors v3: doorGeo.members deep-copies the side panel / fixed fan member objects (same values)
    const same = eng.leaves.length === D.geo.leaves.length
      && eng.leaves.every((l, i) => keys.every((k) => l[k] === D.geo.leaves[i][k]) && JSON.stringify(l.hinges) === JSON.stringify(D.geo.leaves[i].hinges))
      && JSON.stringify(eng.members) === JSON.stringify(D.geo.members) && eng.zones.meetingX === D.geo.meetingX;
    const ea = eng.leaves.find((l) => l.role === 'active');
    const ab = bbox(members(inLeaf(D.ms, 'active')));
    const levers = D.ms.filter((m) => m.kind === 'TubeGeometry');
    const lb = levers.length ? bbox(levers) : null;
    const rightSeenOutside = ea.x + ea.w / 2 > eng.zones.meetingX;   // open side 'left' (from inside) = the active leaf on the right seen from outside
    ok(same && rightSeenOutside === (doorHinge === 'left') && near(ab.min[0], D.X(ea.x), 0.02) && near(ab.max[0], D.X(ea.x + ea.w), 0.02)
        && levers.length === 2 && lb.min[0] >= D.X(ea.x) - 0.01 && lb.max[0] <= D.X(ea.x + ea.w) + 0.01,
      `french hinge side ${doorHinge}: doorGeo = the engine leaves; the 3D active leaf is the engine's (x ${D.X(ea.x)} to ${D.X(ea.x + ea.w)}, ${rightSeenOutside ? 'right' : 'left'} seen from outside) and carries the one handle set`);
  }

  // ── fixed fanlight, T 450 (the transom AXIS 450 below the frame top): doors v3 (owner box items 2, 7):
  //    a non-opening casement leaf (fixedFan 64 / 64 / 67), the size the opening fan leaf would be:
  //    W 1600 - 2 x 51 = 1498, H 450 - 65 = 385 (was a unit glazed into the frame, 1487 x 337); glass
  //    by the casement rule 1498 - 105 = 1393 by 385 - 108 = 277, daylight 1370 x 254; no hardware ──
  {
    const D = await door(1600, 2100, { doorType: 'french', transomType: 'fixed', transomHeight: 450 });
    const F = D.geo.fanLeaves[0];
    const fm = D.ms.filter((m) => has(m, 'fixed-fan-leaf-door') && m.kind === 'ExtrudeGeometry');
    const fb = fm.length ? bbox(fm) : null;
    const fanSt = fm.filter((m) => near(h(m), 385, 0.02)), fanTop = fm.filter((m) => near(w(m), 1498, 0.02) && fb && near(m.max[1], fb.max[1], 0.02)), fanBot = fm.filter((m) => near(w(m), 1498, 0.02) && fb && near(m.min[1], fb.min[1], 0.02));
    ok(D.geo.fanLeaves.length === 1 && F.fixed && F.hinge === 'fixed' && F.w === 1498 && F.h === 385 && F.x === 51 && F.y === 51
        && F.members.stile === 64 && F.members.top === 64 && F.members.bottom === 67
        && fanSt.length === 4 && fanSt.every((m) => near(w(m), 64, 0.02)) && fanTop.length === 2 && fanTop.every((m) => near(h(m), 64, 0.02)) && fanBot.length === 2 && fanBot.every((m) => near(h(m), 67, 0.02))
        && near(fb.max[0] - fb.min[0], 1498, 0.02) && near(fb.max[1] - fb.min[1], 385, 0.02) && near(fb.max[1], D.Y(51), 0.02),
      `fixed fanlight: a non-opening leaf ${F.w} x ${F.h} (1600 - 102, 450 - 65) at (${F.x}, ${F.y}): stiles 64, top rail 64, bottom rail 67 in the 3D`);
    const gf = glassOf(D.ms.filter((m) => has(m, 'fixed-fan-leaf-door')));
    ok(F.glass.w === 1393 && F.glass.h === 277 && gf && near(w(gf), 1370, 0.02) && near(h(gf), 254, 0.02),
      `fixed fanlight: glass unit ${F.glass.w} x ${F.glass.h} (W - 105, H - 108), drawn at the daylight ${gf ? `${w(gf)} x ${h(gf)}` : '?'}`);
    // no hardware: no fan handle; no swing: the fixed leaf does not move with the opening slider
    const D1 = await door(1600, 2100, { doorType: 'french', transomType: 'fixed', transomHeight: 450 }, { opening: 1 });
    const keyOf = (ms) => ms.filter((m) => has(m, 'fixed-fan-leaf')).map(key).join(';');
    ok(!D.ms.some((m) => has(m, 'fan-handle')) && !D.ms.some((m) => m.names.some((n) => n.startsWith('fan-leaf'))) && keyOf(D.ms).length > 0 && keyOf(D.ms) === keyOf(D1.ms)
        && D.geo.leaves.every((l) => l.h === 1582 && l.y === 467),
      'fixed fanlight: no handle, no swing (its meshes are the same at opening 1); the door leaves under it 2100 - 450 - 17 - 51 = 1582 high from y 467');
    // doors v3: the transom is the casement transom: the visible band 8 above + 13 below the axis = 21 (was the
    // engine band 94 / 115), cut between the jambs (one segment, the jambs run through)
    const band = D.geo.transom.band;
    const seg = D.geo.transom.segments[0];
    const bandLand = D.ms.filter((m) => has(m, 'frame-land-ext-transom'));
    ok(D.geo.transom.axisT === 450 && band.y === 442 && band.h === 21 && D.geo.transom.segments.length === 1 && seg.x1 === 47 && seg.x2 === 1553
        && bandLand.length === 1 && near(bandLand[0].max[1], D.Y(442), 0.02) && near(bandLand[0].min[1], D.Y(463), 0.02) && near(bandLand[0].min[0], D.X(47), 0.02) && near(w(bandLand[0]), 1506, 0.02),
      `fixed fanlight: the transom band ${band.h} high (y ${band.y} to ${band.y + band.h}, axis 450) between the jambs (x ${seg.x1} to ${seg.x2})`);
    tiles(D, 'fixed fanlight');
  }

  // ── side panels and an opening fanlight: the 3.10 reference french 2400 x 2400, side panels 400 + 400,
  //    opening fan T 450 (doors v3: W x H is the overall frame, side panels inside it behind casement
  //    mullions; replaces the french 1600 + 500 + 500 assembly with its ONE coupling post 136) ──
  {
    const D = await door(2400, 2400, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'opening', transomHeight: 450 });
    // by hand: door field 400..2000 = 1600 between the mullion axes: half (1600 - 2 x 17) / 2 = 783, leaf 789;
    // leaf H 2400 - 450 - 17 - 51 = 1882; side light 400 - 51 - 17 = 332 x 1882; fan 1600 - 34 = 1566 / 400 - 68 = 332 by 450 - 65 = 385
    const [A, B] = D.geo.leaves;
    ok(A.w === 789 && B.w === 789 && A.h === 1882 && B.h === 1882 && D.geo.panelLeaves.every((pl) => pl.w === 332 && pl.h === 1882)
        && D.geo.fanLeaves.map((f) => `${f.w}x${f.h}`).join(',') === '332x385,1566x385,332x385',
      `side panels: door leaves 2 x ${A.w} x ${A.h}, side lights ${D.geo.panelLeaves.map((pl) => `${pl.w} x ${pl.h}`).join(' / ')}, fan leaves ${D.geo.fanLeaves.map((f) => `${f.w} x ${f.h}`).join(' / ')} (3.10)`);
    // the mullions: casement 68 x 93, the land 26 seen outside (axis +- 13), full height from the head land to
    // the cill top THROUGH the transom (one land mesh per half), a 21 stop each side: 21 + 26 + 21 = 68
    const mus = D.geo.mullions;
    const landM = D.ms.filter((m) => has(m, 'frame-land-ext-mullion'));
    const muOk = mus.length === 2 && mus.every((mu) => {
      const lm = landM.filter((m) => near(midX(m), D.X(mu.axisX), 0.02));
      const st = D.ms.filter((m) => (has(m, 'frame-stop-left') || has(m, 'frame-stop-right')) && m.min[0] >= D.X(mu.axisX - 34) - 0.01 && m.max[0] <= D.X(mu.axisX + 34) + 0.01);
      const lo = Math.min(...st.map((m) => m.min[0]), ...lm.map((m) => m.min[0])), hi = Math.max(...st.map((m) => m.max[0]), ...lm.map((m) => m.max[0]));
      return lm.length === 1 && near(w(lm[0]), 26, 0.02) && near(lm[0].max[1], D.Y(47), 0.02) && near(lm[0].min[1], D.Y(2400 - 41), 0.02)
        && st.length > 0 && st.every((m) => near(w(m), 21, 0.02)) && near(hi - lo, 68, 0.02);
    });
    ok(muOk && mus.map((mu) => mu.axisX).join(',') === '400,2000' && mus.every((mu) => mu.x2 - mu.x1 === 26 && mu.yTop === 47 && mu.yBottom === 2359) && !D.ms.some((m) => has(m, 'frame-land-ext-post')),
      `side panels: two casement mullions (axes ${mus.map((mu) => mu.axisX).join(' / ')}): the land 26 seen outside, one mesh from the head land to the cill top through the transom, a 21 stop each side (26 + 2 x 21 = 68), no coupling post`);
    // the side light: a casement fixed light 64 / 64 / 180 x 57, no hinge, no handle
    const P = D.geo.panelLeaves.find((x) => x.side === 'left');
    const pl = D.ms.filter((m) => has(m, 'side-panel-leaf-left') && m.kind === 'ExtrudeGeometry');
    const pbb = bbox(pl);
    const plSt = pl.filter((m) => near(h(m), 1882, 0.02)), plTop = pl.filter((m) => near(w(m), 332, 0.02) && near(m.max[1], pbb.max[1], 0.02)), plBot = pl.filter((m) => near(w(m), 332, 0.02) && near(m.min[1], pbb.min[1], 0.02));
    ok(P.members.stile === 64 && P.members.top === 64 && P.members.bottom === 180 && P.members.depth === 57 && pl.length === 8
        && plSt.length === 4 && plSt.every((m) => near(w(m), 64, 0.02)) && plTop.length === 2 && plTop.every((m) => near(h(m), 64, 0.02)) && plBot.length === 2 && plBot.every((m) => near(h(m), 180, 0.02))
        && near(pbb.max[0] - pbb.min[0], 332, 0.02) && near(pbb.max[2] - pbb.min[2], 57, 0.02) && near(pbb.min[1], D.Y(2400 - 51), 0.02)
        && !D.ms.some((m) => has(m, 'side-panel-leaf') && (has(m, 'door-handle') || m.kind === 'TubeGeometry')),
      `side light: a fixed leaf ${P.w} x ${P.h}: stiles 64, top rail 64, bottom rail 180 (the door's, its line meets the door bottom rail), 57 deep, standing 51 above the floor; no hardware`);
    ok(D.geo.leaves.every((l) => near(bbox(members(inLeaf(D.ms, l.role))).min[1], plBot[0].min[1], 0.02) && near(bbox(members(inLeaf(D.ms, l.role))).min[1] + 180, plBot[0].max[1], 0.02)),
      'side light: its bottom rail lines up with the door bottom rails (same bottom, same 180)');
    // the opening fan leaves: casement top hung leaves with a handle, 64 / 64 / 67
    const F = D.geo.fanLeaves.find((x) => x.over === 'door');
    const fm = D.ms.filter((m) => has(m, 'fan-leaf-door') && m.kind === 'ExtrudeGeometry' && !has(m, 'fan-handle') && (near(h(m), F.h, 0.02) || near(w(m), F.w, 0.02)));
    const fb = bbox(fm);
    const fanSt = fm.filter((m) => near(h(m), F.h, 0.02)), fanTop = fm.filter((m) => near(w(m), F.w, 0.02) && near(m.max[1], fb.max[1], 0.02)), fanBot = fm.filter((m) => near(w(m), F.w, 0.02) && near(m.min[1], fb.min[1], 0.02));
    const fanHandles = new Set(D.ms.filter((m) => has(m, 'fan-handle')).map((m) => m.names.find((n) => n.startsWith('fan-leaf'))));
    ok(!F.fixed && F.hinge === 'top' && fanSt.length === 4 && fanSt.every((m) => near(w(m), 64, 0.02)) && fanTop.length === 2 && fanTop.every((m) => near(h(m), 64, 0.02)) && fanBot.length === 2 && fanBot.every((m) => near(h(m), 67, 0.02)) && near(fb.max[0] - fb.min[0], F.w, 0.02) && near(fb.max[1] - fb.min[1], F.h, 0.02)
        && fanHandles.size === 3,
      `opening fanlight: a casement top hung leaf ${F.w} x ${F.h}, stiles 64, top rail 64, bottom rail 67; a handle on each of the ${fanHandles.size} fan leaves`);
    // doors v3: the transom band 21 (8 above + 13 below the axis 450), cut in the engine's three segments
    // between the jambs and the mullions (the mullions run through it)
    const segs = D.geo.transom.segments;
    const bandLand = D.ms.filter((m) => has(m, 'frame-land-ext-transom')).sort((a, b) => a.min[0] - b.min[0]);
    ok(D.geo.transom.band.h === 21 && segs.map((s) => `${s.x1}-${s.x2}`).join(',') === '47-387,413-1987,2013-2353' && bandLand.length === 3
        && bandLand.every((m, i) => near(m.min[0], D.X(segs[i].x1), 0.02) && near(m.max[0], D.X(segs[i].x2), 0.02) && near(m.max[1], D.Y(442), 0.02) && near(h(m), 21, 0.02)),
      `fanlight: the transom band 21 split by the mullions into the engine segments (${segs.map((s) => `${s.x1} to ${s.x2}`).join(', ')}), y 442 to 463`);
    // the fan's rebate stop over the transom: 34 - 8 = 26; under it (the lower openings) 34 - 13 = 21
    const fanStops = D.ms.filter((m) => has(m, 'stops-fan') && has(m, 'frame-stop-bottom'));
    const lowStops = D.ms.filter((m) => (has(m, 'stops-door') || has(m, 'stops-panel')) && has(m, 'frame-stop-top'));
    ok(fanStops.length === 3 && fanStops.every((m) => near(h(m), 26, 0.02) && near(m.min[1], D.Y(442), 0.02)) && lowStops.length === 3 && lowStops.every((m) => near(h(m), 21, 0.02) && near(m.max[1], D.Y(463), 0.02)),
      'fanlight: the rebate stop over the transom 26 (34 - 8) under each fan, 21 (34 - 13) over each lower opening');
    // the opening slider moves the opening fans (top hung) and leaves the side lights where they are
    const D1 = await door(2400, 2400, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'opening', transomHeight: 450 }, { opening: 1 });
    const keyOf = (ms, n) => ms.filter((m) => has(m, n)).map(key).join(';');
    ok(keyOf(D.ms, 'fan-leaf-door') !== keyOf(D1.ms, 'fan-leaf-door') && keyOf(D.ms, 'side-panel-leaf') === keyOf(D1.ms, 'side-panel-leaf'),
      'opening 1: the opening fan leaves swing, the side lights stay fixed');
    tiles(D, 'side panels + fanlight');
  }

  // ── a single 1000 x 2100 with one side panel 450 on the right, on an aluminium threshold (6 of CLAUDE.md):
  //    by hand: the door field 0..550, leaf 550 - 51 - 17 = 482 x 1998; the side light 450 - 51 - 17 = 382 x 1998;
  //    no timber cill: the mullion runs to the floor line (length 2100 - (77 - 41) = 2064) ──
  {
    const D = await door(1000, 2100, { doorType: 'single-external', sidePanels: 'right', sideRightWidth: 450, thresholdType: 'aluminium' });
    const L = D.geo.leaves[0], P = D.geo.panelLeaves[0], mu = D.geo.mullions[0];
    const landM = D.ms.filter((m) => has(m, 'frame-land-ext-mullion'));
    const thr = D.ms.filter((m) => has(m, 'threshold-aluminium'));
    ok(L.w === 482 && L.h === 1998 && P.w === 382 && P.h === 1998 && mu.axisX === 550 && mu.yBottom === 2100 && mu.length === 2064 && !mu.timberCill
        && landM.length === 1 && near(landM[0].min[1], D.Y(2100), 0.02) && near(w(landM[0]), 26, 0.02),
      `single + side panel 450 right, aluminium: leaf ${L.w} x ${L.h}, side light ${P.w} x ${P.h}, the mullion (axis ${mu.axisX}, ${mu.length} long) runs to the floor line`);
    ok(thr.length === 1 && near(thr[0].min[0], D.X(47), 0.02) && near(thr[0].max[0], D.X(537), 0.02) && D.geo.thresholdInfo.openingWidth === 490
        && !D.ms.some((m) => has(m, 'frame-stop-bottom')),
      `single + side panel: the threshold strip only under the door (x 47 to 537, ${D.geo.thresholdInfo.openingWidth} = the threshold seal), nothing bought under the side light`);
    tiles(D, 'single + side panel');
  }

  // ── doors v3: the page's derived reaches the meshes. A door derived under a modified door profile
  //    (the batch snapshot path: withProfiles) and handed to windowSpecToConfig is drawn from THAT
  //    derived: leafAtFloor 61 and a stile 100 give a leaf 2100 - 51 - 61 = 1988 with 100 stiles;
  //    without the derived the live profile draws 1998 / 94 ──
  {
    const prof = DM.profile;
    const base = prof.getDoorProfile();
    const mod = { ...base, elements: { ...base.elements, leafStile: { face: 100 } }, deductions: { ...base.deductions, leafAtFloor: 61 } };
    const spec = DM.specification.normaliseToWindowSpec({ id: 'D', name: 'D', width: 900, height: 2100 }, { fullConfig: { windowCategory: 'door', doorType: 'single-external' } });
    const derived = prof.withProfiles(null, null, mod, () => DM.calculations.deriveWindowData(spec, {}));
    const D = await door(900, 2100, { doorType: 'single-external' }, { derived });
    const Dlive = await door(900, 2100, { doorType: 'single-external' });
    const bb = bbox(members(inLeaf(D.ms, 'single')));
    const stiles = members(inLeaf(D.ms, 'single')).filter((m) => near(h(m), 1988, 0.02));
    const bbL = bbox(members(inLeaf(Dlive.ms, 'single')));
    ok(derived.door.leaves[0].h === 1988 && D.geo.leaves[0].h === 1988 && near(bb.max[1] - bb.min[1], 1988, 0.02) && near(bb.min[1], D.Y(2100 - 61), 0.02)
        && stiles.length === 4 && stiles.every((m) => near(w(m), 100, 0.02))
        && Dlive.geo.leaves[0].h === 1998 && near(bbL.max[1] - bbL.min[1], 1998, 0.02) && prof.getDoorProfile().deductions.leafAtFloor === 51,
      `derived pass-through: the snapshot door (leafAtFloor 61, stile 100) is drawn ${R2(bb.max[1] - bb.min[1])} high with ${stiles.length} stile meshes ${[...new Set(stiles.map(w))].join(' / ')} wide; without the derived the live profile draws ${R2(bbL.max[1] - bbL.min[1])}`);
    // the two page components hand their derived to windowSpecToConfig (the preview and the pack capture rig)
    const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');
    ok(/windowSpecToConfig\(windowSpec, derived\)/.test(src('components/viewer/WindowPreview3D.jsx')) && /windowSpecToConfig\(list\[idx\]\.windowSpec, list\[idx\]\.derived \|\| null\)/.test(src('components/viewer/Window3DCaptureRig.jsx'))
        && /doorGeometryFromSpec\(windowSpec, derived\)/.test(src('utils/windowSpecToConfig.js')),
      'derived pass-through: WindowPreview3D and Window3DCaptureRig hand the page derived to windowSpecToConfig, which hands it to doorGeometryFromSpec');
  }

  // ── doors v3: ONE origin. DoorAssembly, the guides (DoorGeoGuides), the capture rig framing and this
  //    harness all centre on doorGeo.origin; none reads the old door-zone origin (doorH / transomH) ──
  {
    const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');
    const asm = src('3d/components/door/DoorAssembly.jsx'), win = src('3d/components/door/DoorWindow.jsx'), rig = src('components/viewer/Window3DCaptureRig.jsx');
    const guides = win.slice(win.indexOf('function DoorGeoGuides'), win.indexOf('function DimensionGuide'));
    const rigFraming = rig.slice(rig.indexOf('function doorFraming'), rig.indexOf('function CaptureScene'));
    const geoW = src('utils/windowSpecToConfig.js');
    const fromSpec = geoW.slice(geoW.indexOf('export function doorGeometryFromSpec'), geoW.indexOf('// ─── Casement: windowSpec'));
    ok(/g\.origin/.test(asm) && /geo\.origin/.test(guides) && /g\.origin/.test(rigFraming) && /origin: \{ x: d\.totalWidth \/ 2, y: d\.totalHeight \/ 2 \}/.test(fromSpec)
        && ![asm, guides, rigFraming, fromSpec].some((s) => /\b(doorH|transomH)\b/.test(s)),
      'one origin: doorGeo.origin (W / 2, H / 2) is read by DoorAssembly, DoorGeoGuides and the capture rig framing; nothing reads doorH / transomH');
  }

  // ── triple glazing: the unit 28 thick and the leaf 61 deep ──
  {
    const D = await door(900, 2100, { doorType: 'single-external', glassType: 'triple' });
    const lm = inLeaf(D.ms, 'single');
    const g = glassOf(lm);
    const bb = bbox(members(lm));
    ok(D.geo.glassThickness === 28 && near(d(g), 28, 0.02) && near(bb.max[2] - bb.min[2], 61, 0.02) && D.geo.leafDepth === 61,
      `triple: glass unit ${d(g)} thick (glazing ${D.geo.glassThickness}), leaf ${R2(bb.max[2] - bb.min[2])} deep (leafDepthTriple ${D.geo.leafDepth})`);
  }

  // ── a sash and a casement never get a door geometry ──
  {
    const sash = DM.specification.normaliseToWindowSpec({ id: 'S', name: 'S', width: 1000, height: 1600 }, { fullConfig: {} });
    const cas = DM.specification.normaliseToWindowSpec({ id: 'C', name: 'C', width: 1000, height: 1200 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L' } });
    ok(DM.wsc.doorGeometryFromSpec(sash) === null && DM.wsc.doorGeometryFromSpec(cas) === null && DM.wsc.windowSpecToConfig(sash).doorGeo === undefined && DM.wsc.windowSpecToConfig(cas).doorGeo === undefined,
      'doorGeometryFromSpec is null for a sash and a casement; their configs carry no doorGeo');
  }
}


console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
