/**
 * t29 — night 7 Stage 4: the 3D after the 68 frame.
 *
 * Piotr 06.09: "3D view jakies kwadratowe zamiast pokazywac, co naprawde sie
 * dzieje". This harness measures the 3D helpers on real configs (spec →
 * normaliseToWindowSpec → windowSpecToConfig → the geometry helper the
 * component calls) and pins every number against the PROFILE, not against the
 * code it is testing:
 *   1  windowSpecToConfig: frameDims per category, the arched dispatch keys;
 *   2  rectangular casement 040L 1000 × 1500 — the 3D leaf against the engine leaf;
 *   3  arched casement: the rings are offset by the PROFILE face / land, the
 *      outline is a real arc from arch.js (radii, apex above the springing) —
 *      never the rectangular fallback;
 *   4  Kind: Fixed keeps the arched path (a fixed arch is not a rectangle);
 *   5  circle 800 — the fix-frame path, and what it does NOT get;
 *   6  door with side panels: the coupling post is 2 × the profile jamb face.
 * Run: node verify/arch/t29.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const entry = resolve(AUDIT, 't29-entry.mjs');
writeFileSync(entry, [
  `export * as profile from '${resolve(ROOT, 'src/engine/profile.js')}';`,
  `export * as specification from '${resolve(ROOT, 'src/engine/specification.js')}';`,
  `export * as calculations from '${resolve(ROOT, 'src/engine/calculations.js')}';`,
  `export * as layouts from '${resolve(ROOT, 'src/engine/casementLayouts.js')}';`,
  `export * as wsc from '${resolve(ROOT, 'src/utils/windowSpecToConfig.js')}';`,
  `export * as geo3d from '${resolve(ROOT, 'src/3d/components/casement/archedCasementGeometry.js')}';`,
  `export * as casFrame from '${resolve(ROOT, 'src/3d/components/casement/CasementFrame.jsx')}';`,
  `export * as doorFrame from '${resolve(ROOT, 'src/3d/components/door/DoorFrame.jsx')}';`,
].join('\n'));
const out = resolve(AUDIT, 't29-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic',
  '--external:react', '--external:react-dom', '--external:react/jsx-runtime',
  '--external:three', '--external:@react-three/fiber', '--external:@react-three/drei', '--external:jspdf',
  `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
const { profile, specification, calculations, layouts, wsc, geo3d, casFrame, doorFrame } = M;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const P = profile.DEFAULT_CASEMENT_PROFILE;
const DP = profile.DEFAULT_DOOR_PROFILE;
const spec = (o, fc) => specification.normaliseToWindowSpec(o, fc ? { fullConfig: fc } : undefined);
const cfgOf = (o, fc) => wsc.windowSpecToConfig(spec(o, fc));
const topY = (pts) => Math.max(...pts.map((p) => p[1]));
const spanX = (pts) => Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));

// ═══════════════════════════════════════════════════════════════════════════
section('1 — windowSpecToConfig: frameDims and the arched dispatch keys');
{
  const face = P.elements.frameHead.face, land = P.geometry.land;
  const rect = cfgOf({ id: 'r', name: 'R', width: 1000, height: 1500 }, { windowCategory: 'casement', casementLayout: '040L' });
  check(`rectangular casement: frameDims = { frameFace ${face}, extFace ${land} } from the profile`,
    rect.frameDims?.frameFace === face && rect.frameDims?.extFace === land, JSON.stringify(rect.frameDims));
  check('rectangular casement: casementType "standard", no arch keys', rect.casementType === 'standard' && !rect.casArchShape, JSON.stringify([rect.casementType, rect.casArchShape]));
  const arch = cfgOf({ id: 'a', name: 'A', width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle' });
  check(`arched casement: casementType "arched", casArchShape "semi-circle", frameDims { ${face}, ${land} } — App.jsx routes on exactly these two keys`,
    arch.casementType === 'arched' && arch.casArchShape === 'semi-circle' && arch.frameDims?.frameFace === face && arch.frameDims?.extFace === land,
    JSON.stringify([arch.casementType, arch.casArchShape, arch.frameDims]));
  const door = cfgOf({ id: 'd', name: 'D', width: 1000, height: 2100 }, { windowCategory: 'door', doorType: 'single-external' });
  check(`door: frameDims = { frameFace ${DP.elements.frameHead.face}, extFace ${DP.geometry.land} } — option B reaches the 3D`,
    door.frameDims?.frameFace === DP.elements.frameHead.face && door.frameDims?.extFace === DP.geometry.land, JSON.stringify(door.frameDims));
  check('casementFrameDims() / doorFrameDims() read the live profiles',
    wsc.casementFrameDims().frameFace === face && wsc.casementFrameDims().extFace === land &&
    wsc.doorFrameDims().frameFace === DP.elements.frameHead.face && wsc.doorFrameDims().extFace === DP.geometry.land);
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — rectangular casement 040L 1000 × 1500: the 3D leaf against the engine leaf');
const CF = casFrame;
const FD = CF.resolveFrameDims(wsc.casementFrameDims());
const LEAF_GAP = 4;   // CasementWindow: the leaf sits in the rebate with a 4mm gap all round
{
  const s = spec({ id: 'r', name: 'R', width: 1000, height: 1500 }, { windowCategory: 'casement', casementLayout: '040L' });
  const eng = calculations.deriveWindowData(s, {}).casement.leaves[0];
  const engW = 1000 - 2 * P.deductions.leafAtJamb;              // 898
  const engH = 1500 - P.deductions.leafFullHeight;              // 1402
  check(`engine leaf = (1000 − 2·leafAtJamb ${P.deductions.leafAtJamb}) × (1500 − leafFullHeight ${P.deductions.leafFullHeight}) = ${engW} × ${engH}`,
    near(eng.leafW, engW, 0.01) && near(eng.leafH, engH, 0.01), `${eng.leafW} × ${eng.leafH}`);
  const innerW = 1000 - FD.frameFace * 2;
  const innerH = 1500 - FD.frameFace - CF.BOTTOM_FACE;
  const def = layouts.resolveCasementLayout({ code: '040L', innerW, innerH, height: 1500, geo: { frameFace: FD.frameFace, bottomFace: CF.BOTTOM_FACE, mullionW: CF.MULLION_W } });
  const p0 = def.panels[0];
  const leafW = p0.w + CF.REBATE_STEP * 2 - LEAF_GAP * 2;
  const leafH = p0.h + CF.REBATE_STEP * 2 - LEAF_GAP * 2;
  check(`3D leaf WIDTH = innerW ${innerW} + 2·REBATE_STEP ${CF.REBATE_STEP} − 2·gap ${LEAF_GAP} = ${leafW} — the engine's ${engW} (±0.5)`, near(leafW, engW), String(leafW));
  check(`the width identity holds by construction: W − 2·(face − rebate + gap) = W − 2·leafAtJamb (${FD.frameFace} − ${CF.REBATE_STEP} + ${LEAF_GAP} = ${P.deductions.leafAtJamb})`,
    FD.frameFace - CF.REBATE_STEP + LEAF_GAP === P.deductions.leafAtJamb);
  // KNOWN 4 mm: the 3D deducts a jamb-like bottom, the engine a cill (land 41 + gap 6)
  const d3Bottom = CF.BOTTOM_FACE - CF.REBATE_STEP + LEAF_GAP;                     // 51
  const engBottom = P.deductions.leafFullHeight - P.deductions.leafAtJamb;          // 47
  check(`3D leaf HEIGHT ${leafH} vs the engine's ${engH}: the 3D holds the leaf ${d3Bottom} above the frame bottom (BOTTOM_FACE ${CF.BOTTOM_FACE} − REBATE_STEP ${CF.REBATE_STEP} + gap ${LEAF_GAP}), the profile ${engBottom} (gapCill ${P.geometry.gapCill} + cillVisible ${P.geometry.cillVisible}) — a ${d3Bottom - engBottom} mm difference, PRE-EXISTING and NOT fixed tonight (BLOCKERS §24.2)`,
    d3Bottom === 51 && engBottom === 47 && near(leafH, engH - (d3Bottom - engBottom)), `${leafH} vs ${engH}`);
  check('the 3D bottom deduction does NOT come from the profile — it is the one frameDims gap left on the casement (the width does, the height does not)',
    CF.BOTTOM_FACE === 68 && !('bottomFace' in CF.DEFAULT_FRAME_DIMS) && !('leafBottom' in CF.DEFAULT_FRAME_DIMS));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — arched casement: rings offset by the PROFILE, a real arc from arch.js');
const DIMS_BASE = {
  frameFace: CF.FRAME_FACE, extFace: CF.EXT_FACE, bottomFace: CF.BOTTOM_FACE, bottomInner: CF.BOTTOM_INNER_FACE,
  leafGap: LEAF_GAP, leafFace: 57, gasketW: CF.GASKET_W, innerMargin: 10,
};
{
  const dims = { ...DIMS_BASE, ...FD };
  const g = geo3d.archedCasementGeometry({ width: 1000, height: 1500, archShape: 'semi-circle', dims });
  check('semi-circle 1000: the helper returns a geometry (no fallback)', !!g && !g.fallback, String(g?.fallback));
  check(`semi-circle 1000: radius 500 = W/2 (arch.js), rise 500`, g.radii.length === 1 && near(g.radii[0], 500, 0.01) && near(g.rise, 500, 0.01), JSON.stringify([g.radii, g.rise]));
  check(`outer contour spans the full 1000 width and its apex is ABOVE the springing — an arc, not a rectangle (${g.outer.length} points)`,
    near(spanX(g.outer), 1000, 0.01) && g.outer.length > 20 && topY(g.outer) > g.springY + 1, `${spanX(g.outer)} / ${g.outer.length} / ${topY(g.outer)} vs ${g.springY}`);
  check(`ring 1 (full frame face): apex offset from the outer apex = the PROFILE face ${FD.frameFace} (±0.5)`, near(topY(g.outer) - topY(g.inner), FD.frameFace), String(topY(g.outer) - topY(g.inner)));
  check(`ring 2 (rebated / visible land): apex offset = the PROFILE land ${FD.extFace} (±0.5)`, near(topY(g.outer) - topY(g.innerRebated), FD.extFace), String(topY(g.outer) - topY(g.innerRebated)));
  check(`semi-circle: ring SPANS at the springing = 1000 − 2·${FD.frameFace} = ${1000 - 2 * FD.frameFace} and 1000 − 2·${FD.extFace} = ${1000 - 2 * FD.extFace}`,
    near(spanX(g.inner), 1000 - 2 * FD.frameFace) && near(spanX(g.innerRebated), 1000 - 2 * FD.extFace), `${spanX(g.inner).toFixed(1)} / ${spanX(g.innerRebated).toFixed(1)}`);
  check(`arched leaf WIDTH = 1000 − 2·(land ${FD.extFace} + gap ${LEAF_GAP}) = ${1000 - 2 * (FD.extFace + LEAF_GAP)} = the engine's ${1000 - 2 * P.deductions.leafAtJamb}`,
    near(g.leaf.width, 1000 - 2 * P.deductions.leafAtJamb), String(g.leaf.width));
  // the PSW default must still give the PSW numbers — the port has not happened yet
  const gPsw = geo3d.archedCasementGeometry({ width: 1000, height: 1500, archShape: 'semi-circle', dims: DIMS_BASE });
  check(`without frameDims the helper still draws the PSW frame (face ${CF.FRAME_FACE}, land ${CF.EXT_FACE}) — the profile only wins when passed`,
    near(topY(gPsw.outer) - topY(gPsw.inner), CF.FRAME_FACE) && near(topY(gPsw.outer) - topY(gPsw.innerRebated), CF.EXT_FACE));
  for (const [tag, shape, W, H, nRadii] of [['three-centre', 'three-centre', 1000, 1500, 3], ['gothic-equilateral', 'gothic-equilateral', 1000, 1800, 2]]) {
    const gg = geo3d.archedCasementGeometry({ width: W, height: H, archShape: shape, dims });
    check(`${tag} ${W} × ${H}: ${nRadii} radii from arch.js, ${gg.outer.length} outline points, apex above the springing — not a rectangle`,
      gg.radii.length === nRadii && gg.outer.length > 20 && topY(gg.outer) > gg.springY + 1, JSON.stringify([gg.radii.length, gg.outer.length]));
    // A POINTED arch (gothic) drops its apex by MORE than the offset — the rings are
    // concentric per arc, so the invariant that holds for every shape is the span at
    // the springing line: inner span = W − 2·face, rebated span = W − 2·land.
    check(`${tag}: ring spans at the springing = W − 2·face ${W - 2 * FD.frameFace} and W − 2·land ${W - 2 * FD.extFace} (±0.5)`,
      near(spanX(gg.inner), W - 2 * FD.frameFace) && near(spanX(gg.innerRebated), W - 2 * FD.extFace),
      `${spanX(gg.inner).toFixed(1)} / ${spanX(gg.innerRebated).toFixed(1)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — Kind: Fixed keeps the arched path (a fixed arch must not become a rectangle)');
{
  const fx = cfgOf({ id: 'f', name: 'F', width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle', casementKind: 'fixed' });
  check('arched + Kind: Fixed → casementType "arched", fixedLeaf true, casArchShape kept, frameDims kept — App.jsx still routes to ArchedCasementWindow',
    fx.casementType === 'arched' && fx.fixedLeaf === true && fx.casArchShape === 'semi-circle' && fx.frameDims?.frameFace === P.elements.frameHead.face,
    JSON.stringify([fx.casementType, fx.fixedLeaf, fx.casArchShape, fx.frameDims]));
  const rf = cfgOf({ id: 'g', name: 'G', width: 1000, height: 1500, windowCategory: 'casement', casementLayout: '040L', casementKind: 'fixed' });
  check('rectangular + Kind: Fixed → casementType "standard", fixedLeaf true, frameDims kept', rf.casementType === 'standard' && rf.fixedLeaf === true && rf.frameDims?.frameFace === P.elements.frameHead.face,
    JSON.stringify([rf.casementType, rf.fixedLeaf]));
  const opening = cfgOf({ id: 'h', name: 'H', width: 1000, height: 1500, windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle' });
  check('the only difference an opening arch shows is fixedLeaf false', opening.fixedLeaf === false && opening.casementType === 'arched');
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — circle 800: the fix-frame path, and the gap it carries (BLOCKERS §24.1)');
{
  const c = cfgOf({ id: 'c', name: 'C', width: 800, height: 800, windowCategory: 'casement', casementType: 'arched', archShape: 'circle', casementKind: 'fixed' });
  check('circle → windowCategory "fix-only" with fixShape "circle" — App.jsx renders FixFrameWindow, so it is a CIRCLE, not a rectangle',
    c.windowCategory === 'fix-only' && c.fixShape === 'circle' && near(c.extWidth, 800, 0.01) && near(c.extHeight, 800, 0.01), JSON.stringify([c.windowCategory, c.fixShape, c.extWidth, c.extHeight]));
  check('circle: the sunburst pattern and the bar counts reach the viewer', c.fixCircleBarPattern === 'none' && typeof c.fixCircleBarOffset === 'number');
  // the gap: this branch never receives frameDims, and FixFrameWindow has no such prop
  check('KNOWN GAP: the circle config carries NO frameDims, so the fix-frame viewer keeps its own PSW face — the 68 profile does not reach it (BLOCKERS §24.1)',
    c.frameDims === undefined);
  const sun = cfgOf({ id: 'c2', name: 'C2', width: 800, height: 800, windowCategory: 'casement', casementType: 'arched', archShape: 'circle', casementKind: 'fixed', archBarPattern: 'sunburst' });
  check('circle + sunburst → fixCircleBarPattern "sunburst"', sun.fixCircleBarPattern === 'sunburst');
  // and if a circle were ever routed to the arched helper it would NOT draw a circle
  const g = geo3d.safeArchedCasementGeometry({ width: 800, height: 800, archShape: 'circle', dims: { ...DIMS_BASE, ...FD } });
  check('archedCasementGeometry does NOT know "circle": it resolves to a semi-circle, which is why the circle must stay on the fix-frame path',
    g && g.shape === 'semi-circle', String(g?.shape));
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — door with side panels: the coupling post is 2 × the profile jamb face');
{
  const d = cfgOf({ id: 'd', name: 'D', width: 1000, height: 2100 }, { windowCategory: 'door', doorType: 'single-external', sidePanels: 'left', sideLeftWidth: 400, thresholdType: 'standard' });
  check('door + side panel: windowCategory "door", sidePanels "left", sideLeftWidth 400', d.windowCategory === 'door' && d.sidePanels === 'left' && near(d.sideLeftWidth, 400, 0.01), JSON.stringify([d.windowCategory, d.sidePanels, d.sideLeftWidth]));
  const face = DP.elements.frameJamb.face;
  check(`the 3D builds the coupling post from TWO abutting jambs, so its width = 2 × frameDims.frameFace = ${2 * face} = the profile's couplingPost ${DP.couplingPost.width}`,
    d.frameDims?.frameFace === face && 2 * face === DP.couplingPost.width);
  check(`DoorFrame.resolveFrameDims({ ${face}, ${DP.geometry.land} }) → the profile numbers; defaults stay the PSW 57 / 36`,
    JSON.stringify(doorFrame.resolveFrameDims({ frameFace: face, extFace: DP.geometry.land })) === JSON.stringify({ frameFace: face, extFace: DP.geometry.land }) &&
    doorFrame.DEFAULT_FRAME_DIMS.frameFace === 57 && doorFrame.DEFAULT_FRAME_DIMS.extFace === 36);
  const der = calculations.deriveWindowData(spec({ id: 'd', name: 'D', width: 1000, height: 2100 }, { windowCategory: 'door', doorType: 'single-external', sidePanels: 'left', sideLeftWidth: 400, thresholdType: 'standard' }), {});
  const post = der.door.zones.posts[0];
  check(`the ENGINE post agrees with the 3D pair: width ${DP.couplingPost.width}, visible band 2 × land = ${2 * DP.geometry.land} (option B)`,
    near(post.w, DP.couplingPost.width, 0.01) && near(post.visW, 2 * DP.geometry.land, 0.01), JSON.stringify(post));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:'); failures.forEach((f) => console.log('  - ' + f)); process.exit(1); }
console.log('ALL PASS');
