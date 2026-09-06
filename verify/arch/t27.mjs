/**
 * t27 — ARCHED-WINDOWS-v4 Stage 4 gate (Block F: frame face 57 → 68, option B).
 *
 * Every expected number here is COMPUTED from the profile object (P) with the
 * formula written out — nothing is read back from the engine's output. The one
 * literal check is "the profile equals the spec" (68 / 47 / 21 / 51 / 98 / 65,
 * door 68 / 136 / 136). Sections:
 *   1  profile = spec F, option-B identities (land + rebate = face, …)
 *   2  casement 040L 1000 × 1500 through normaliseToWindowSpec → deriveWindowData:
 *      leaf / glass / cut list from the profile formulas; the OLD numbers
 *      (920 × 1413) reproduced through a schema-1 profile variant, then restored
 *   3  migrateCasementProfile: frameSchema 1 → 2 moves only values that still
 *      equal the old defaults; hand edits and schema-2 copies untouched
 *   4  casementLayouts: frameFace = the profile face, version 3, fan axis offset
 *   5  door 1000 × 2100 single + side panel, french 1200: faces 68, post 136,
 *      door land / leafAtJamb unchanged (40 → leaf 920)
 *   6  windowSpecToConfig: frameDims for the 3D (casement 68 / 47, door 68 / 36)
 *   7  3D frame components: resolveFrameDims defaults = the PSW constants 57 / 36
 *   8  src/engine grep gate: no bare 57 / 36 / 40 / 114 in casement / door code
 *   9  materials labels 68×93, fixtures re-baselined from the live tree
 *
 * Run: node verify/arch/t27.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, bundleTree, deriveItem } from './lib/sheets.mjs';

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const section = (t) => console.log(`\n== ${t} ==`);

const M = await bundleTree(resolve(ROOT, 'src'), 't27-live', [
  ['layouts', 'engine/casementLayouts.js'],
  ['wsc', 'utils/windowSpecToConfig.js'],
  ['casFrame', '3d/components/casement/CasementFrame.jsx'],
  ['doorFrame', '3d/components/door/DoorFrame.jsx'],
]);
const P = M.profile.DEFAULT_CASEMENT_PROFILE;
const DP = M.profile.DEFAULT_DOOR_PROFILE;
const G = P.geometry, D = P.deductions, E = P.elements;

// ═══════════════════════════════════════════════════════════════════════════
section('1 — profile = spec F (the one literal check) and the option-B identities');
check('casement: frameHead 68 / frameJamb 68 / land 47 / rebate 21 / gap 4 / leafAtJamb 51 / leafFullHeight 98 / fanFromAxis 65 / frameSchema 2',
  E.frameHead.face === 68 && E.frameJamb.face === 68 && G.land === 47 && G.rebate === 21 && G.gap === 4 && D.leafAtJamb === 51 && D.leafFullHeight === 98 && D.fanFromAxis === 65 && P.frameSchema === 2,
  JSON.stringify([E.frameHead.face, E.frameJamb.face, G.land, G.rebate, G.gap, D.leafAtJamb, D.leafFullHeight, D.fanFromAxis, P.frameSchema]));
check('casement UNCHANGED by Block F: cill 68 / mullion 68 / transom 68 / leaf members 67 / glassInset 12.5 / gapCill 6 / cillVisible 41 / lowerFromAxis 64',
  E.frameCill.face === 68 && E.mullion.face === 68 && E.transom.face === 68 && E.leafStile.face === 67 && E.leafTop.face === 67 && E.leafBottom.face === 67 && G.glassInset === 12.5 && G.gapCill === 6 && G.cillVisible === 41 && D.lowerFromAxis === 64);
check('identity: land + rebate = frame face (option B — the rebate stays, the land grows)', G.land + G.rebate === E.frameHead.face && E.frameJamb.face === E.frameHead.face);
check('identity: leafAtJamb = land + gap', D.leafAtJamb === G.land + G.gap);
check('identity: leafFullHeight = leafAtJamb + gapCill + cillVisible (top layer + cill layer)', D.leafFullHeight === D.leafAtJamb + G.gapCill + G.cillVisible);
check('identity: fanFromAxis = leafAtJamb + gapFanTransom + transomLandAbove', D.fanFromAxis === D.leafAtJamb + G.gapFanTransom + G.transomLandAbove);
check('identity: lowerFromAxis = transomLandBelow + gap + gapCill + cillVisible (untouched by the frame)', D.lowerFromAxis === G.transomLandBelow + G.gap + G.gapCill + G.cillVisible);
check('door: frameHead 68 / frameJamb 68 / couplingPost 136 / transomDeduct 136; land 36 / leafAtJamb 40 / leafFullHeight 87 unchanged (spec F: face + post only)',
  DP.elements.frameHead.face === 68 && DP.elements.frameJamb.face === 68 && DP.couplingPost.width === 136 && DP.lengths.transomDeduct === 136 && DP.geometry.land === 36 && DP.deductions.leafAtJamb === 40 && DP.deductions.leafFullHeight === 87);
check('door identities: couplingPost = 2 × jamb face, transomDeduct = 2 × jamb face', DP.couplingPost.width === 2 * DP.elements.frameJamb.face && DP.lengths.transomDeduct === 2 * DP.elements.frameJamb.face);
check('door: leafAtJamb = land + gap still holds (36 + 4 = 40) — the door land did NOT follow the face (BLOCKERS §19)', DP.deductions.leafAtJamb === DP.geometry.land + DP.geometry.gap && DP.geometry.land + DP.geometry.rebate !== DP.elements.frameHead.face);

// ═══════════════════════════════════════════════════════════════════════════
section('2 — casement 040L 1000 × 1500: leaf, glass, cut list from the profile formulas; old numbers via a schema-1 variant');
const W = 1000, H = 1500;
const tF = E.frameHead.face, oL = D.leafAtJamb, tL = E.leafTop.face, gI = G.glassInset;
const leafW = W - 2 * oL, leafH = H - D.leafFullHeight;
const glassW = leafW - 2 * (tL - gI), glassH = leafH - 2 * (tL - gI);
console.log(`  formula: leaf = (W − 2·leafAtJamb) × (H − leafFullHeight) = (${W} − 2·${oL}) × (${H} − ${D.leafFullHeight}) = ${leafW} × ${leafH}; glass = leaf − 2·(${tL} − ${gI}) = ${glassW} × ${glassH}`);
const cas1000 = (fc = {}) => deriveItem(M, { id: 'c1', width: W, height: H, name: 'C1' }, { windowCategory: 'casement', casementLayout: '040L', ...fc });
{
  const { spec, derived } = cas1000();
  const lf = derived.casement?.leaves?.[0];
  check(`040L ${W} × ${H}: leaf ${leafW} × ${leafH} (formula above)`, lf && near(lf.leafW, leafW) && near(lf.leafH, leafH), JSON.stringify(lf));
  check(`040L: sash width / height on the derived record = ${leafW} / ${leafH}`, near(derived.sashWidth, leafW) && near(derived.sashHeight, leafH), `${derived.sashWidth} / ${derived.sashHeight}`);
  const cut = M.lists.buildCutListForWindow(derived, spec);
  const row = (name) => cut.find((r) => (r.name || r.element || r.elementName) === name);
  const secFrame = `${tF}x${P.frameDepth}`;
  const head = row('C-FRAME HEAD'), jl = row('C-FRAME JAMB (L)'), jr = row('C-FRAME JAMB (R)');
  check(`cut list: C-FRAME HEAD ${W} − headDeduct ${P.lengths.headDeduct || 0} = ${W - (P.lengths.headDeduct || 0)}, section ${secFrame}`, head && near(head.length, W - (P.lengths.headDeduct || 0)) && head.section === secFrame, JSON.stringify(head));
  check(`cut list: C-FRAME JAMBS ${H} − jambDeduct ${P.lengths.jambDeduct || 0} = ${H - (P.lengths.jambDeduct || 0)}, section ${secFrame}`, jl && jr && near(jl.length, H - (P.lengths.jambDeduct || 0)) && near(jr.length, H - (P.lengths.jambDeduct || 0)) && jl.section === secFrame && jr.section === secFrame, JSON.stringify([jl, jr]));
  const stile = cut.find((r) => /^C-STILE/.test(r.name || r.element || r.elementName || ''));
  const top = cut.find((r) => /^C-TOP RAIL/.test(r.name || r.element || r.elementName || ''));
  check(`cut list: leaf stiles ${leafH}, top rail ${leafW} (vertogen: full leaf dimensions, deducts ${P.lengths.stileDeduct || 0} / ${P.lengths.topRailDeduct || 0})`,
    stile && top && near(stile.length, leafH - (P.lengths.stileDeduct || 0)) && near(top.length, leafW - (P.lengths.topRailDeduct || 0)), JSON.stringify([stile, top]));
  const glass = M.lists.buildGlassListForWindow(derived, spec);
  check(`glass list: one unit ${glassW} × ${glassH} (leaf − 2·(leafTop.face − glassInset))`, glass.length === 1 && near(glass[0].width, glassW) && near(glass[0].height, glassH), JSON.stringify(glass.map((g) => [g.width, g.height])));
  check('no bare 57 / 920 / 1413 left in the derived record JSON (the 57-face numbers are gone from a 1000 × 1500 casement)', !/\b(920|1413)\b/.test(JSON.stringify(derived)) && !/"section":"57x/.test(JSON.stringify(cut)), '');
}
{
  // the OLD frame reproduced through a schema-1 profile variant — the spec's premise numbers, stated once
  const P57 = { ...P, frameSchema: 2, elements: { ...E, frameHead: { face: 57 }, frameJamb: { face: 57 } }, geometry: { ...G, land: 36 }, deductions: { ...D, leafAtJamb: 40, leafFullHeight: 87, fanFromAxis: 54 } };
  M.profile.setActiveCasementProfile(P57);
  const { derived } = cas1000();
  const lf = derived.casement?.leaves?.[0];
  const oldW = W - 2 * P57.deductions.leafAtJamb, oldH = H - P57.deductions.leafFullHeight;
  console.log(`  old frame (face 57): leaf = (${W} − 2·40) × (${H} − 87) = ${oldW} × ${oldH}`);
  check(`schema-1 variant (face 57, leafAtJamb 40, leafFullHeight 87): leaf ${oldW} × ${oldH} — the pre-Block-F numbers`, lf && near(lf.leafW, oldW) && near(lf.leafH, oldH), JSON.stringify(lf));
  M.profile.setActiveCasementProfile(null);
  const back = cas1000().derived.casement?.leaves?.[0];
  check(`profile restored: leaf back to ${leafW} × ${leafH}`, back && near(back.leafW, leafW) && near(back.leafH, leafH), JSON.stringify(back));
  check('old → new deltas: width −22 (2 × 11), height −11 (one top layer)', oldW - leafW === 2 * (tF - 57) && oldH - leafH === tF - 57);
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — migrateCasementProfile: frameSchema 1 → 2 moves only the values that still equal the OLD defaults');
{
  const mig = M.profile.migrateCasementProfile;
  const stored = JSON.parse(JSON.stringify(P));
  delete stored.frameSchema;
  stored.elements.frameHead.face = 57; stored.elements.frameJamb.face = 57;
  stored.geometry.land = 36; stored.deductions.leafAtJamb = 40; stored.deductions.leafFullHeight = 87; stored.deductions.fanFromAxis = 54;
  const m1 = mig(stored);
  check('stored schema-1 copy with the old defaults → 68 / 68 / 47 / 51 / 98 / 65, frameSchema 2', m1.frameSchema === 2 && m1.elements.frameHead.face === 68 && m1.elements.frameJamb.face === 68 && m1.geometry.land === 47 && m1.deductions.leafAtJamb === 51 && m1.deductions.leafFullHeight === 98 && m1.deductions.fanFromAxis === 65,
    JSON.stringify([m1.frameSchema, m1.elements.frameHead.face, m1.geometry.land, m1.deductions.leafAtJamb, m1.deductions.leafFullHeight, m1.deductions.fanFromAxis]));
  check('migration keeps everything else of the stored copy (arch / cnc / tracery / glass blocks, other elements)', JSON.stringify(m1.arch) === JSON.stringify(stored.arch) && JSON.stringify(m1.cnc) === JSON.stringify(stored.cnc) && m1.elements.leafTop.face === 67 && m1.elements.frameCill.face === 68);
  const edited = JSON.parse(JSON.stringify(stored));
  edited.elements.frameJamb.face = 60; edited.deductions.leafAtJamb = 45;   // a workshop edit in the 57 era
  const m2 = mig(edited);
  check('a hand-edited value (jamb 60, leafAtJamb 45) is KEPT; the untouched head / land / heights still move', m2.elements.frameJamb.face === 60 && m2.deductions.leafAtJamb === 45 && m2.elements.frameHead.face === 68 && m2.geometry.land === 47 && m2.deductions.leafFullHeight === 98);
  const already = JSON.parse(JSON.stringify(P));
  already.elements.frameJamb.face = 57;   // schema 2 but the workshop deliberately set a 57 jamb
  const m3 = mig(already);
  check('a frameSchema-2 copy is never re-migrated (a deliberate 57 jamb stays 57)', m3.elements.frameJamb.face === 57 && m3.frameSchema === 2);
  const pre68 = JSON.parse(JSON.stringify(stored));
  pre68.elements.frameHead.face = 68; pre68.elements.frameJamb.face = 68;   // edited to 68 by hand before Block F, land still 36
  const m4 = mig(pre68);
  check('schema-1 copy already at 68 by hand: faces untouched, land 36 → 47 and the deductions move (they still equal the old defaults)', m4.elements.frameHead.face === 68 && m4.geometry.land === 47 && m4.deductions.leafAtJamb === 51);
  check('pre-v1 shape (no geometry / lengths) → the default profile whole', mig({ elements: {} }) === P && mig(null) === null);
  check('migration is idempotent: migrate(migrate(stored)) deep-equals migrate(stored)', JSON.stringify(mig(m1)) === JSON.stringify(m1));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — casementLayouts: frameFace = the profile face, version 3, fan-axis offset');
{
  const L = M.layouts;
  check(`CASEMENT_GEO_DEFAULTS.frameFace = frameHead.face (${tF}); bottomFace = cill face (${E.frameCill.face}); mullionW = mullion face (${E.mullion.face})`, L.CASEMENT_GEO_DEFAULTS.frameFace === tF && L.CASEMENT_GEO_DEFAULTS.bottomFace === E.frameCill.face && L.CASEMENT_GEO_DEFAULTS.mullionW === E.mullion.face);
  check('CASEMENT_LAYOUTS_VERSION = 3 (bumped with the face — PSW must bump to 3 in the same port)', L.CASEMENT_LAYOUTS_VERSION === 3);
  check(`FAN_AXIS_OFFSET_TOP = frameFace + 68 / 2 = ${tF + 34}; FAN_AXIS_OFFSET_BOTTOM = cill 68 + 34 = 102 (unchanged)`, L.FAN_AXIS_OFFSET_TOP === tF + 34 && L.FAN_AXIS_OFFSET_BOTTOM === E.frameCill.face + 34);
  const dims = L.casementInnerDims(W, H);
  check(`casementInnerDims(${W}, ${H}) = (${W - 2 * tF}, ${H - tF - E.frameCill.face})`, dims.innerW === W - 2 * tF && dims.innerH === H - tF - E.frameCill.face, JSON.stringify(dims));
  // engine GEO agrees with the layouts default: a 052L fan axis typed at 500 from the top lands 500 − (tF + 34) into the inner height
  const { derived } = cas1000({ casementLayout: '052L', fanlightAxis: 500 });
  const innerH = H - tF - E.frameCill.face;
  const ratio = L.fanAxisToRatio(500, innerH);
  check(`fanAxisToRatio(500, innerH ${innerH}) = (500 − ${tF + 34}) / ${innerH} = ${((500 - tF - 34) / innerH).toFixed(6)} (clamped 0.15..0.5)`, near(ratio, Math.max(0.15, Math.min(0.5, (500 - tF - 34) / innerH)), 1e-12) && !!derived.casement);
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — doors: faces 68, coupling post 136, door land / leafAtJamb unchanged');
{
  const item = { id: 'd1', width: 1000, height: 2100, name: 'D1' };
  const { spec, derived } = deriveItem(M, item, { windowCategory: 'door', doorType: 'single-external', sidePanels: 'left', sideLeftWidth: 400, thresholdType: 'standard' });
  const dL = DP.deductions, dE = DP.elements;
  const dLeafW = 1000 - 2 * dL.leafAtJamb, dLeafH = 2100 - dL.leafFullHeight;
  console.log(`  door formula: leaf = (1000 − 2·${dL.leafAtJamb}) × (2100 − ${dL.leafFullHeight}) = ${dLeafW} × ${dLeafH} (door land 36 unchanged → the leaf width did not move)`);
  const lf = derived.door?.leaves?.[0];
  check(`single door 1000 × 2100: leaf ${dLeafW} × ${dLeafH}`, lf && near(lf.w, dLeafW) && near(lf.h, dLeafH), JSON.stringify(lf));
  const cut = M.lists.buildCutListForWindow(derived, spec);
  const row = (name) => cut.find((r) => (r.name || r.element || r.elementName) === name);
  const secFrame = `${dE.frameHead.face}x${DP.frameDepth}`;
  const head = row('D-FRAME HEAD'), post = row('D-COUPLING POST'), jamb = row('D-FRAME JAMB (L)');
  check(`D-FRAME HEAD section ${secFrame}, length = 1000 + 400 side panel − headDeduct ${DP.lengths.headDeduct || 0} = ${1400 - (DP.lengths.headDeduct || 0)}`, head && head.section === secFrame && near(head.length, 1400 - (DP.lengths.headDeduct || 0)), JSON.stringify(head));
  check(`D-FRAME JAMB section ${secFrame}, length 2100 − jambDeduct = ${2100 - (DP.lengths.jambDeduct || 0)}`, jamb && jamb.section === secFrame && near(jamb.length, 2100 - (DP.lengths.jambDeduct || 0)), JSON.stringify(jamb));
  check(`D-COUPLING POST ${DP.couplingPost.width}x${DP.frameDepth} (2 × jamb face ${dE.frameJamb.face}), qty 1 (one side panel), jamb length`, post && post.section === `${2 * dE.frameJamb.face}x${DP.frameDepth}` && (post.qty ?? post.quantity) === 1 && near(post.length, 2100 - (DP.lengths.jambDeduct || 0)), JSON.stringify(post));
  const panel = derived.door?.panelLeaves?.[0];
  check(`side panel leaf = 400 − 2·${dL.leafAtJamb} = ${400 - 2 * dL.leafAtJamb} wide (same land / gap as the door)`, panel && near(panel.w, 400 - 2 * dL.leafAtJamb), JSON.stringify(panel));
  check('no 114x / 57x93 frame section in the door cut list (side-panel members 57x57 are the fixed leaf, unchanged)', !cut.some((r) => /^114x|^57x93$/.test(String(r.section))), cut.map((r) => r.section).join(' '));
  const fr = deriveItem(M, { id: 'f1', width: 1200, height: 2100, name: 'F1' }, { windowCategory: 'door', doorType: 'french' });
  const fLeaf = (1200 - 2 * dL.leafAtJamb + DP.frenchOverlap) / 2;
  check(`french 1200: each leaf = (1200 − 2·${dL.leafAtJamb} + overlap ${DP.frenchOverlap}) / 2 = ${fLeaf}`, fr.derived.door?.leaves?.length === 2 && fr.derived.door.leaves.every((l) => near(l.w, fLeaf)), JSON.stringify(fr.derived.door?.leaves));
  const frCut = M.lists.buildCutListForWindow(fr.derived, fr.spec);
  check(`french 1200: D-FRAME HEAD ${secFrame} — the 68 face on every door type`, frCut.find((r) => (r.name || r.element || r.elementName) === 'D-FRAME HEAD')?.section === secFrame);
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — windowSpecToConfig: frameDims for the 3D from the profiles');
{
  const { spec } = cas1000();
  const cfg = M.wsc.windowSpecToConfig(spec);
  check(`casement config.frameDims = { frameFace ${tF}, extFace ${G.land} } and casementProps.frameDims the same object`, cfg.frameDims?.frameFace === tF && cfg.frameDims?.extFace === G.land && cfg.casementProps?.frameDims?.frameFace === tF && cfg.casementProps?.frameDims?.extFace === G.land, JSON.stringify(cfg.frameDims));
  check('casementFrameDims() / doorFrameDims() read the live profiles', M.wsc.casementFrameDims().frameFace === tF && M.wsc.casementFrameDims().extFace === G.land && M.wsc.doorFrameDims().frameFace === DP.elements.frameHead.face && M.wsc.doorFrameDims().extFace === DP.geometry.land);
  const dspec = deriveItem(M, { id: 'd2', width: 1000, height: 2100, name: 'D2' }, { windowCategory: 'door', doorType: 'single-external' }).spec;
  const dcfg = M.wsc.windowSpecToConfig(dspec);
  check(`door config.frameDims = { frameFace ${DP.elements.frameHead.face}, extFace ${DP.geometry.land} }`, dcfg.windowCategory === 'door' && dcfg.frameDims?.frameFace === DP.elements.frameHead.face && dcfg.frameDims?.extFace === DP.geometry.land, JSON.stringify(dcfg.frameDims));
  const fan = cas1000({ casementLayout: '052L', fanlightAxis: 500 }).spec;
  const fcfg = M.wsc.windowSpecToConfig(fan);
  const innerH = H - tF - E.frameCill.face;
  check(`casementProps.fanlightRatio uses innerH from the profile face: (500 − ${tF + 34}) / ${innerH}`, near(fcfg.casementProps.fanlightRatio, Math.max(0.15, Math.min(0.5, (500 - tF - 34) / innerH)), 1e-12), String(fcfg.casementProps.fanlightRatio));
  // the arched casement config carries frameDims too (App passes it to ArchedCasementWindow)
  const arched = deriveItem(M, { id: 'a1', width: 1000, height: 1500, name: 'A1' }, { windowCategory: 'casement', casementType: 'arched', archShape: 'semi-circle', casementLayout: '040L' }).spec;
  const acfg = M.wsc.windowSpecToConfig(arched);
  check('arched casement config: casementType arched + frameDims present', acfg.casementType === 'arched' && acfg.frameDims?.frameFace === tF, JSON.stringify([acfg.casementType, acfg.frameDims]));
}

// ═══════════════════════════════════════════════════════════════════════════
section('7 — 3D frame components: the PSW constants stay the defaults, the profile wins when passed');
{
  for (const [name, F] of [['CasementFrame', M.casFrame], ['DoorFrame', M.doorFrame]]) {
    check(`${name}: FRAME_FACE 57 / EXT_FACE 36 exported unchanged (PSW copy), DEFAULT_FRAME_DIMS = { 57, 36 }`, F.FRAME_FACE === 57 && F.EXT_FACE === 36 && F.DEFAULT_FRAME_DIMS.frameFace === 57 && F.DEFAULT_FRAME_DIMS.extFace === 36);
    check(`${name}: resolveFrameDims(null / {} / junk) → 57 / 36; resolveFrameDims({ 68, 47 }) → 68 / 47; a single key falls back per key`,
      JSON.stringify(F.resolveFrameDims(null)) === '{"frameFace":57,"extFace":36}' && JSON.stringify(F.resolveFrameDims({})) === '{"frameFace":57,"extFace":36}' && JSON.stringify(F.resolveFrameDims({ frameFace: 'x', extFace: -1 })) === '{"frameFace":57,"extFace":36}'
      && JSON.stringify(F.resolveFrameDims({ frameFace: 68, extFace: 47 })) === '{"frameFace":68,"extFace":47}' && JSON.stringify(F.resolveFrameDims({ frameFace: 68 })) === '{"frameFace":68,"extFace":36}');
    check(`${name}: REBATE_STEP 21 = 57 − 36 = 68 − 47 (the rebate is the invariant of option B)`, F.REBATE_STEP === 21 && 68 - 47 === F.REBATE_STEP);
  }
  // the components read the prop, not the constant: every consumer file passes frameDims down
  const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');
  const threaded = {
    'CasementFrame.jsx': src('3d/components/casement/CasementFrame.jsx'),
    'DoorFrame.jsx': src('3d/components/door/DoorFrame.jsx'),
    'CasementWindow.jsx': src('3d/components/casement/CasementWindow.jsx'),
    'ArchedCasementWindow.jsx': src('3d/components/casement/ArchedCasementWindow.jsx'),
    'DoorWindow.jsx': src('3d/components/door/DoorWindow.jsx'),
    'DoorSidePanel.jsx': src('3d/components/door/DoorSidePanel.jsx'),
  };
  check('CasementFrame / DoorFrame: TopRail, Stile, Mullion and the frame body shadow FRAME_FACE from resolveFrameDims(frameDims)',
    ['CasementFrame.jsx', 'DoorFrame.jsx'].every((f) => (threaded[f].match(/resolveFrameDims\(frameDims\)/g) || []).length === 4 && /<TopRail [^>]*frameDims=\{frameDims\}/.test(threaded[f]) && (threaded[f].match(/<Stile [^>]*frameDims=\{frameDims\}/g) || []).length === 2 && /<Mullion [^>]*frameDims=\{frameDims\}/.test(threaded[f])));
  check('CasementWindow passes frameDims to CasementFrame and geo (frameFace) to resolveCasementLayout; ArchedCasementWindow merges it into DIMS',
    /<CasementFrame[\s\S]{0,80}frameDims=\{frameDims\}/.test(threaded['CasementWindow.jsx']) && /geo: \{ frameFace: FRAME_FACE/.test(threaded['CasementWindow.jsx']) && /\.\.\.DIMS, \.\.\.resolveFrameDims\(frameDims\)/.test(threaded['ArchedCasementWindow.jsx']));
  check('DoorWindow passes frameDims to DoorFrame and both DoorSidePanels, getLayout takes the face; DoorSidePanel passes it to its DoorFrame',
    /<DoorFrame[\s\S]{0,120}frameDims=\{frameDims\}/.test(threaded['DoorWindow.jsx']) && (threaded['DoorWindow.jsx'].match(/<DoorSidePanel[\s\S]{0,120}frameDims=\{frameDims\}/g) || []).length === 2 && /getLayout\(layout, innerW, innerH, height, fanlightRatio, \{ frameFace: FRAME_FACE \}\)/.test(threaded['DoorWindow.jsx']) && /<DoorFrame[\s\S]{0,120}frameDims=\{frameDims\}/.test(threaded['DoorSidePanel.jsx']));
  const app = src('3d/App.jsx');
  check('App.jsx: frameDims state, update3D setter, bucket capture / restore, config memo, passed to ArchedCasementWindow / CasementWindow / DoorWindow',
    /useState\(null\);\s*\/\/ v4 Block F/.test(app) && /if \(cfg\.frameDims !== undefined\) setFrameDims\(cfg\.frameDims\)/.test(app) && /if \(s\.frameDims !== undefined\) setFrameDims\(s\.frameDims\)/.test(app) && (app.match(/frameDims=\{config\.frameDims \|\| null\}/g) || []).length === 3 && (app.match(/archPatterns, frameDims, archSpokes/g) || []).length === 2);
  check('WindowPreview3D / Window3DCaptureRig pass frameDims to DoorWindow (CasementWindow gets it inside casementProps); ConfiguratorPage update3D sends it for casement and door',
    /frameDims=\{config\.frameDims \|\| null\}/.test(src('components/viewer/WindowPreview3D.jsx')) && /frameDims=\{config\.frameDims \|\| null\}/.test(src('components/viewer/Window3DCaptureRig.jsx')) && /frameDims: casementFrameDims\(\)/.test(src('pages/ConfiguratorPage.jsx')) && /frameDims: doorFrameDims\(\)/.test(src('pages/ConfiguratorPage.jsx')));
}

// ═══════════════════════════════════════════════════════════════════════════
section('8 — src/engine grep gate: no bare 57 / 36 / 40 / 114 in casement / door code (comments stripped, sash + CNC allow-list)');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, ''));
  const ALLOW = [
    [/calculations\.js$/, /SASH_DEPTH_STANDARD|STILE_WIDTH|TOP_RAIL_WIDTH|SASH_SECTION|BOTTOM_RAIL_SECTION|MEETING_RAIL_SECTION/],   // sash constants (sash unchanged)
    [/partRegistry\.js$/, /sashDepth \?\? 57|face \?\? 57/],                 // sash part sections
    [/dxfWriter\.js$/, /put\(40,/],                                          // DXF group code 40
    [/traceryExport\.js$/, /\(cons 40 h\)/],                                 // LISP group code 40
    [/arch\.js$/, /PLANNER_MAX_N = 40/],                                      // planner search cap
    [/pricing\.js$/, /beadingPanel: 40/],                                     // beading price
    [/canvas-renderer\.js$/, /offset = 40/],                                  // drawing offset
    [/specification\.js$/, /toString\(36\)/],                                 // random id base
    [/profile\.js$/, /./],                                                    // the profile IS the home of workshop numbers
  ];
  const dir = resolve(ROOT, 'src', 'engine');
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = resolve(d, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(p)) files.push(p); } };
  walk(dir);
  const hits = [];
  for (const f of files) {
    const rel = f.slice(ROOT.length + 1);
    strip(readFileSync(f, 'utf8')).forEach((line, i) => {
      if (!/\b(57|36|40|114)\b/.test(line)) return;
      if (ALLOW.some(([re, ok]) => re.test(f) && ok.test(line))) return;
      hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  check(`no unlisted bare 57 / 36 / 40 / 114 in ${files.length} engine files`, hits.length === 0, hits.join(' | '));
  const calc = strip(readFileSync(resolve(dir, 'calculations.js'), 'utf8')).join('\n');
  check('calculations.js door fallbacks read DEFAULT_DOOR_PROFILE (sidePanel.member / couplingPost.width / sidePanel.depth), no `?? 57` / `?? 114`', /DEFAULT_DOOR_PROFILE\.sidePanel\.member/.test(calc) && /DEFAULT_DOOR_PROFILE\.couplingPost\.width/.test(calc) && !/\?\? 57\b|\?\? 114\b/.test(calc));
}

// ═══════════════════════════════════════════════════════════════════════════
section('9 — materials labels, fixtures re-baselined from the live tree');
{
  const mat = readFileSync(resolve(ROOT, 'src', 'stores', 'materialAssignmentStore.js'), 'utf8');
  check("materialAssignmentStore: c_frame_head / c_frame_jamb section '68×93' with a hint naming the old 57×93 (kept for older projects)",
    /id: 'c_frame_head'[^\n]*section: '68×93'/.test(mat) && /id: 'c_frame_jamb'[^\n]*section: '68×93'/.test(mat) && (mat.match(/Was 57×93/g) || []).length === 2 && /c_frame_cill'[^\n]*section: '68×93'/.test(mat));
  const base = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-base.json'), 'utf8'));
  const r1 = base.R1?.derived?.casement?.leaves?.[0];
  check(`fixture rect-casement-base.json R1 (040L ${W} × ${H}) re-baselined: leaf ${leafW} × ${leafH} (was 920 × 1413)`, r1 && near(r1.leafW, leafW) && near(r1.leafH, leafH), JSON.stringify(r1));
  const sheets = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-sheets.json'), 'utf8'));
  check(`fixture rect-casement-sheets.json provenance: ref "live" from ${sheets.commit?.slice(0, 7)}, 4 windows`, sheets.ref === 'live' && typeof sheets.commit === 'string' && sheets.commit.length === 40 && Object.keys(sheets.sheets || {}).length === 4);
  const elev = sheets.sheets?.R1?.elevation || '';
  check(`R1 elevation sheet carries the 898 leaf (text "${leafW}") and not 920`, elev.includes(String(leafW)) && !/\b920\b/.test(elev));
  // the sash fixtures were re-baselined earlier on this branch (night-6 Stage 2 sheet layout); Block F must not
  // touch them again: clean in the working tree, and the sash profile still carries its own 57 stiles (t22 is the snapshot proof)
  const sash = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-sheets.json'), 'utf8'));
  const sashWt = execFileSync('git', ['status', '--porcelain', '--', 'verify/arch/fixtures/rect-sash-base.json', 'verify/arch/fixtures/rect-sash-sheets.json'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const SP = M.profile.DEFAULT_SASH_PROFILE;
  check('sash fixtures untouched by Block F (clean in the working tree, 6 sash windows); sash profile stiles / top rail face 57 unchanged (sash is not in Block F)', sashWt === '' && Object.keys(sash).length === 6 && SP.elements.stiles.face === 57 && SP.elements.topRail.face === 57, `${sashWt} / ${Object.keys(sash).length} / ${SP.elements.stiles.face}`);
  const port = readFileSync(resolve(ROOT, 'docs', 'handover', 'PSW-FRAME-68-PORT.md'), 'utf8');
  check('docs/handover/PSW-FRAME-68-PORT.md: estimate-renderer FRAME_FACE lines, casement-controller version 3 + innerH, 3D constants, 898 × 1402 check', /estimate-renderer\.js/.test(port) && /1503/.test(port) && /CASEMENT_LAYOUTS_VERSION = 3/.test(port) && /CasementFrame\.jsx/.test(port) && /DoorFrame\.jsx/.test(port) && /898/.test(port) && /1402/.test(port));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
