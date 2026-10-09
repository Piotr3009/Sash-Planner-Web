/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t41: doors to production, single and french (owner box, Piotr 08.10.2026).
 *
 * The box numbers are typed here as LITERALS and checked against the live engine,
 * the BOM, the pre-cut and cut list, and against the formulas of the door profile:
 *
 *   single 900 x 2100: leaf 798 x 2002, stiles 94x57 L2002, top 94x57 L798, bottom
 *     180x57 L798, glass 633 x 1751, makeup 6x12x6, thickness 24; no timber cill: 2043
 *   french 1600 x 2100: half 749, leaf 755 x 2002, meeting stile 100x57, hinge stile
 *     94x57, glass 584 x 1751 = the 749 leaf with two 94 stiles
 *   half-glazed: glass 633 x 883, panel 633 x 797, D-MID RAIL 94x57 L798
 *   three-quarter: glass 633 x 1383.5, panel 633 x 296.5
 *   hardware per 3.5, FGTE band 1965-2161 for leaf 2002, thresholds, fanlight
 *
 * Doors v3 (Piotr 09.10.2026, CLAUDE.md doors v3 tura): every leaf stands 51 above the
 * floor, so leaf H = H - 102 = 1998 at 2100 (whatever the threshold), glass 633 x 1747,
 * french 584 x 1747, half-glazed 633 x 881 with a panel 644 x 806 (daylight + 2 x 17);
 * casement mullions and transom inside the frame. Each changed assertion carries its
 * reason; section 18 adds the 3.10 cases, the leaf heights 1900 to 2400 with 3 and 4
 * hinges and the text collision check of 3.15.
 *
 * Bundles the LIVE src and the START tree (git archive 410cb5d, the start of this
 * tura, needs the history) for the controls: a casement and a sash derive, list and
 * count exactly as they did.
 *
 *   1  profile: the box numbers, the identities, "as casement"
 *   2  single door (outward, inward, aluminium, low-profile)
 *   3  french door (half + lip, meeting stile 100, the 749 identity)
 *   4  styles: mid rail, glass and panel (half-glazed, three-quarter)
 *   5  hardware: counts, hinges 3 / 4, handing, FGTE band, thresholds, detail lines
 *   6  BOM part quantities: every D- part maps, glass rows, casement rows, paint
 *   7  pre-cut: one assigned material = one group; unassigned by the section map, else the finished section
 *   8  cut list: door groups, notes kept when rows merge
 *   9  fanlight: opening = casement leaf + casement picks; fixed as before
 *  10  side panels and bars (door, side panel, transom 'match')
 *  11  weights, seals, beading, consumables by hand
 *  12  threshold extension (cill length, sill extension board)
 *  13  migration of a stored door profile; withProfiles with the door snapshot
 *  14  the profile store (door key, setter, engine push)
 *  15  Assign Materials rows (ids, order, no duplicates, no em dash)
 *  16  the window's door slot product, optimiser over-length guard
 *  17  controls: casement and sash equal to START
 *  18  door sheets (SSR of the components the screen and the PDFs mount): the door
 *      sheet plan, no NaN / undefined / long dash, the schedule glass, meeting stile 100,
 *      the frame chain 47 / 4, the plan section, the glass drawings, the dimension rule
 *
 * Doors v3 (owner box 09.10.2026, CLAUDE.md of the v3 tura): the door frame follows
 * the casement rules and every leaf stands 51 above the floor. Every assertion the
 * v3 rules moved says so next to it ("doors v3: ..."), with the new number by hand:
 *   leaf H = H - 51 - 51 for every threshold and direction (2100 -> 1998, glass 1747)
 *   half-glazed axis 999, glass 881, panel 644 x 806 (daylight 610 x 772 + 2 x 17)
 *   W x H = the overall frame (side panels and fanlight inside it), mullion 68
 *   between door and side panel, transom segments, fan T - 65, fixed fan = leaf
 *   handing printed as the configurator states it; vents on doors; threshold seal
 * The v3 reference set itself is verify/parity/t44_doors_v3.mjs.
 *
 * Run: node verify/parity/t41_doors_production.mjs [start]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkDimRule } from '../arch/lib/dimRule.mjs';
import { collisionFailures, describeFailures } from '../arch/lib/textCollision.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const startHash = process.argv[2] || '410cb5dd3728de9c59d98f89b7bd6d9bc331bf59';
function treeOf(hash) {
  const tag = `t41-start-${hash.slice(0, 12)}`;
  const tree = resolve(AUDIT, `${tag}-tree`);
  rmSync(tree, { recursive: true, force: true });
  mkdirSync(tree, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${hash} src | tar -x -C "${tree}"`], { cwd: ROOT, stdio: 'inherit' });
  return { tag, tree };
}
const startTree = treeOf(startHash);

function bundle(srcRoot, name, withDoorHw = true) {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  const rel = (p) => './' + relative(AUDIT, resolve(srcRoot, p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    ...['specification', 'calculations', 'lists', 'bom', 'profile', 'optimizer', 'partSymbols', 'partColours', 'partRegistry'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
    ...(withDoorHw ? [`export * as doorHw from '${rel('engine/doorHardware.js')}';`, `export * as profileStore from '${rel('stores/windowProfileStore.js')}';`] : []),
    `export * as store from '${rel('stores/materialAssignmentStore.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist/i.test(String(a[0]))) return; warn(...a); };

const LIVE = await bundle(resolve(ROOT, 'src'), 't41-live');
const START = await bundle(resolve(startTree.tree, 'src'), startTree.tag, false);

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 1e-6) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const R1 = (v) => Math.round(v * 10) / 10;

const { specification, calculations, lists, bom, profile, store } = LIVE;
const DP = profile.DEFAULT_DOOR_PROFILE;
const CP = profile.DEFAULT_CASEMENT_PROFILE;
const mk = (M, w, h, fc) => {
  const spec = M.specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: w, height: h }, { fullConfig: fc });
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const door = (w, h, fc = {}) => mk(LIVE, w, h, { windowCategory: 'door', doorType: 'single-external', ...fc });
const french = (w, h, fc = {}) => mk(LIVE, w, h, { windowCategory: 'door', doorType: 'french', ...fc });
const recs = (d, name) => [...(d.components.box || []), ...(d.components.sash || []), ...(d.components.beading || [])].filter((r) => r.elementName === name);
const rec = (d, name) => recs(d, name)[0];
const pq = (x) => bom.buildWindowPartQtys(x.derived, x.spec, {});

// ═════════════════════════════════════════════════════════════════════════════
section('1 - profile: the box numbers, the identities, as casement');
{
  const g = DP.geometry, d = DP.deductions, e = DP.elements;
  ok(DP.schema === 3, `schema ${DP.schema} (doors v3: 2 -> 3)`);
  ok(DP.frameDepth === 93 && e.frameHead.face === 68 && e.frameJamb.face === 68 && e.frameCill.face === 68 && e.transomRail.face === 68,
    'frame: depth 93, head / jamb / cill / transom rail face 68 (box item 1)');
  ok(g.land === 47 && g.rebate === 21 && g.gap === 4 && g.gapCill === 6 && g.cillVisible === 41 && g.glassInset === 11.5 && g.glazingRebate === 18,
    'geometry: land 47, rebate 21, gap 4, gapCill 6, cillVisible 41, glassInset 11.5, glazingRebate 18');
  // doors v3: the leaf bottom stands leafAtFloor 51 above the floor whatever the threshold;
  // leafFullHeight / leafNoThreshold are kept (not read) at the derived 51 + 51 = 102.
  ok(d.leafAtJamb === 51 && d.leafAtFloor === 51 && d.leafFullHeight === 102 && d.leafNoThreshold === 102, 'deductions: leafAtJamb 51, leafAtFloor 51; leafFullHeight / leafNoThreshold stored at 102 (doors v3, not read)');
  ok(DP.leafDepth === 57 && DP.leafDepthTriple === 61, 'leaf depth 57, 61 with a triple unit (box item 4)');
  ok(e.leafStile.face === 94 && e.leafTop.face === 94 && e.leafBottom.face === 180 && e.leafMid.face === 94 && e.leafMeeting.face === 100,
    'leaf faces: stile 94, top 94, bottom 180, mid 94, meeting 100 (box item 4)');
  ok(DP.frenchLip === 6 && DP.frenchClearance === undefined, 'frenchLip 6; no centre clearance set (owner: later)');
  ok(DP.cillInward.faceInternal === 40 && DP.cillInward.faceExternal === 35, 'inward cill 40 -> 35 (box item 2)');
  // doors v3: the coupling post stays in the profile for stored copies only (a mullion stands
  // there now); the side panel is a casement fixed light 64 / 64 / 180 x 57 (was 57 all round);
  // the fan is T - 65 from the transom axis (was 51 at the head and 51 at the rail).
  ok(DP.couplingPost.width === 136 && DP.sidePanel.stile === 64 && DP.sidePanel.top === 64 && DP.sidePanel.bottom === 180 && DP.sidePanel.depth === 57 && !('member' in DP.sidePanel),
    'coupling post 136 kept (not read); side panel light 64 / 64 / 180 x 57 (doors v3)');
  ok(d.fanFromAxis === 65 && d.leafBelowAxis === 17 && !('fanAtHead' in d) && !('fanAtRail' in d), 'fanlight: fan H = T - 65, the leaf below the transom 17 from the axis (doors v3)');
  ok(DP.hinges.perLeaf === 3 && DP.hinges.perLeafTall === 4 && DP.hinges.tallAbove === 2100, 'hinges 3 per leaf, 4 above 2100 (box item 12)');
  ok(DP.panel.boardThickness === 18 && DP.panel.boards === 2 && DP.panel.coreThickness === 18, 'panel 2 x 18 Tricoya + 18 core (box item 10)');
  const h = DP.hardware;
  ok(h.doorThickness === 56 && h.backset === 45 && h.faceplate === 'radius' && h.keeps === 'full length' && h.fgteShootbolts === 'slave' && h.fgteSlaveBackset === 45 && h.fgteCentreLine === 22 && h.cillKeep === 'yes',
    'hardware defaults: thickness 56, backset 45, radius, full length keeps, FGTE slave, slave backset 45, centre line 22, cill keep yes');
  ok(d.leafAtJamb === g.land + g.gap, 'identity: leafAtJamb = land + gap');
  // doors v3: the leaf height no longer depends on the cill (leafAtFloor), so the two stored
  // values are the derived leafAtJamb + leafAtFloor; the casement compositions hold instead.
  ok(d.leafFullHeight === d.leafAtJamb + d.leafAtFloor && d.leafNoThreshold === d.leafAtJamb + d.leafAtFloor, 'identity: leafFullHeight = leafNoThreshold = leafAtJamb + leafAtFloor = 51 + 51 (doors v3)');
  ok(d.fanFromAxis === g.land + g.gap + g.gapFanTransom + g.transomLandAbove && d.leafBelowAxis === g.transomLandBelow + g.gapBelowTransom && d.leafAtMullionAxis === g.mullionLand / 2 + g.gap,
    'identity: fanFromAxis = 47 + 4 + 6 + 8, leafBelowAxis = 13 + 4, leafAtMullionAxis = 26 / 2 + 4 (doors v3)');
  ok(g.land + g.rebate === e.frameJamb.face, 'identity: land + rebate = frame face');
  ok(e.leafMeeting.face === e.leafStile.face + DP.frenchLip, 'identity: meeting stile = stile + lip');
  const cg = CP.geometry, ce = CP.elements;
  // doors v3: leafFullHeight left the list (door 102, casement 98: the door leaf stands on the
  // floor rule); the mullion, transom lands, gaps, fan rule and the two lengths joined it.
  ok(g.land === cg.land && g.rebate === cg.rebate && g.gap === cg.gap && g.gapCill === cg.gapCill && g.cillVisible === cg.cillVisible && g.glassInset === cg.glassInset && g.glazingRebate === cg.glazingRebate
    && g.mullionLand === cg.mullionLand && g.transomLandAbove === cg.transomLandAbove && g.transomLandBelow === cg.transomLandBelow && g.gapFanTransom === cg.gapFanTransom && g.gapBelowTransom === cg.gapBelowTransom
    && d.leafAtJamb === CP.deductions.leafAtJamb && d.leafAtMullionAxis === CP.deductions.leafAtMullionAxis && d.fanFromAxis === CP.deductions.fanFromAxis && DP.leafDepth === CP.leafDepth && DP.leafDepthTriple === CP.leafDepthTriple
    && DP.frameDepth === CP.frameDepth && e.frameHead.face === ce.frameHead.face && e.frameJamb.face === ce.frameJamb.face && e.frameCill.face === ce.frameCill.face && e.mullion.face === ce.mullion.face
    && DP.lengths.mullion === CP.lengths.mullion && DP.lengths.transomSeat === CP.lengths.transomSeat,
    'as casement: land, rebate, gap, gapCill, cillVisible, glassInset, glazingRebate, the mullion and transom lands and gaps, leafAtJamb, leafAtMullionAxis, fanFromAxis, leaf depths, frame depth and faces, mullion 77, seat 8.5');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - single door 900 x 2100');
const S = door(900, 2100);
{
  const dr = S.derived.door, lf = dr.leaves[0];
  // doors v3: leaf H = H - 51 - 51 (was H - 98)
  ok(lf.w === 798 && lf.h === 1998 && dr.leafW === 798 && dr.leafH === 1998, `leaf ${lf.w} x ${lf.h} = (900 - 2 x 51) x (2100 - 51 - 51) = 798 x 1998 (doors v3)`);
  const sl = rec(S.derived, 'D-STILE (L)'), sr = rec(S.derived, 'D-STILE (R)'), tr = rec(S.derived, 'D-TOP RAIL'), br = rec(S.derived, 'D-BOTTOM RAIL');
  ok(sl?.section === '94x57' && sl.length === 1998 && sr?.section === '94x57' && sr.length === 1998, 'stiles 94x57 L1998 (both; doors v3, was 2002)');
  ok(tr?.section === '94x57' && tr.length === 798, 'top rail 94x57 L798');
  ok(br?.section === '180x57' && br.length === 798, 'bottom rail 180x57 L798');
  ok(!rec(S.derived, 'D-MEETING STILE') && !rec(S.derived, 'D-MID RAIL'), 'single full glass: no meeting stile, no mid rail');
  const u = S.derived.customGlassUnits;
  ok(u.length === 1 && u[0].width === 633 && u[0].height === 1747, `glass ${u[0]?.width} x ${u[0]?.height} = (798 - 2 x 82.5) x (1998 - 82.5 - 168.5) = 633 x 1747 (doors v3, was 1751)`);
  ok(S.spec.glazing.makeup === '6x12x6' && S.spec.glazing.thickness === 24, `makeup ${S.spec.glazing.makeup}, thickness ${S.spec.glazing.thickness}`);
  const gl = lists.buildGlassListForWindow(S.derived, S.spec);
  ok(gl.length === 1 && gl[0].width === 633 && gl[0].height === 1747 && gl[0].makeup === '6x12x6', 'glass schedule row 633 x 1747, 6x12x6 (doors v3)');
  ok(S.spec.frame.depth === 93, `frame depth ${S.spec.frame.depth} (the door profile, never the sash box)`);
  const sp164 = specification.normaliseToWindowSpec({ id: 'y', name: 'Y', width: 900, height: 2100, frameDepth: 164 }, { fullConfig: { windowCategory: 'door' } });
  ok(sp164.frame.depth === 93, 'a door saved with the sash box depth 164 still reads 93');
  ok(rec(S.derived, 'D-FRAME HEAD')?.section === '68x93' && rec(S.derived, 'D-FRAME JAMB (L)')?.length === 2100 && rec(S.derived, 'D-FRAME CILL')?.section === '68x93',
    'frame head 68x93 L900, jambs L2100, cill 68x93 (outward, the casement cill)');
  const inw = door(900, 2100, { doorOpenDirection: 'inward' });
  ok(inw.derived.door.leaves[0].w === 798 && inw.derived.door.leaves[0].h === 1998, 'inward: the same leaf 798 x 1998 (doors v3: H - 102 in both directions)');
  const ic = rec(inw.derived, 'D-FRAME CILL (INWARD)');
  ok(ic?.section === '40x93' && !rec(inw.derived, 'D-FRAME CILL'), 'inward cill: its own element, 40x93 (unrebated, 40 -> 35)');
  for (const thr of ['aluminium', 'low-profile']) {
    const x = door(900, 2100, { thresholdType: thr });
    // doors v3: the leaf stands 51 above the floor on every threshold (was H - 57 = 2043 here)
    ok(x.derived.door.leaves[0].h === 1998 && !recs(x.derived, 'D-FRAME CILL').length && !recs(x.derived, 'D-FRAME CILL (INWARD)').length,
      `${thr} threshold: no timber cill, leaf H 2100 - 102 = ${x.derived.door.leaves[0].h} (doors v3)`);
    ok(x.derived.customGlassUnits[0].height === 1747, `${thr}: glass H 1998 - 251 = ${x.derived.customGlassUnits[0].height} (doors v3)`);
  }
  // doors v3 (owner box item 9): an inward door always takes the timber inward cill
  const ia = door(900, 2100, { doorOpenDirection: 'inward', thresholdType: 'aluminium' });
  ok(rec(ia.derived, 'D-FRAME CILL (INWARD)')?.section === '40x93' && ia.derived.door.hasTimberCill && ia.derived.door.thresholdInfo.ignored && ia.derived.door.thresholdInfo.effectiveType === 'standard'
    && ia.derived.door.thresholdInfo.note === 'inward door: timber threshold' && ia.derived.door.leaves[0].h === 1998,
    'inward + a stored aluminium value: the timber inward cill, the value ignored with the note (doors v3)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - french door 1600 x 2100');
const F = french(1600, 2100);
{
  const dr = F.derived.door;
  ok(dr.half === 749 && dr.leafW === 755 && dr.leafH === 1998, `half ${dr.half} = (1600 - 102) / 2, leaf ${dr.leafW} x ${dr.leafH} = half + 6 (doors v3: H 1998)`);
  ok(dr.leaves.length === 2 && dr.leaves.every((l) => l.w === 755 && l.h === 1998), 'two leaves 755 x 1998 (doors v3)');
  ok(dr.leaves[0].x === 51 && dr.leaves[1].x === 1600 - 51 - 755, `leaves at x 51 and ${1600 - 51 - 755}: each 6 past the centre line ${dr.zones.meetingX}`);
  ok(dr.zones.meetingX === 800 && dr.leaves[0].x + 755 - 800 === 6 && 800 - dr.leaves[1].x === 6, 'meetingX 800, lip 6 each side');
  const ms = recs(F.derived, 'D-MEETING STILE');
  ok(ms.length === 2 && ms.every((r) => r.section === '100x57' && r.length === 1998 && r.code === 'D-MS'), 'meeting stile 100x57 L1998, one per leaf, code D-MS (doors v3)');
  const hs = [...recs(F.derived, 'D-STILE (L)'), ...recs(F.derived, 'D-STILE (R)')];
  ok(hs.length === 2 && hs.every((r) => r.section === '94x57' && /^hinge/.test(r.notes)), 'one hinge stile 94x57 per leaf, noted hinge');
  ok(recs(F.derived, 'D-TOP RAIL').every((r) => r.length === 755) && recs(F.derived, 'D-BOTTOM RAIL').every((r) => r.length === 755 && r.section === '180x57'), 'rails the full leaf width 755');
  const u = F.derived.customGlassUnits;
  ok(u.length === 2 && u.every((g) => g.width === 584 && g.height === 1747), `glass ${u.map((g) => `${g.width} x ${g.height}`).join(', ')} = 755 - 82.5 - 88.5 (doors v3: H 1747)`);
  ok(749 - 2 * (94 - 11.5) === 584, 'identity: the glass equals the 749 leaf with two 94 stiles (749 - 165 = 584), so the lip adds no glass');
  const roles = dr.leaves.map((l) => l.role).join(' / ');
  ok(roles === 'passive / active', `open left (default): the right leaf (hinged right from outside) is active: ${roles}`);
  const fr = french(1600, 2100, { doorHinge: 'right' });
  ok(fr.derived.door.leaves.map((l) => l.role).join(' / ') === 'active / passive', 'open right: the left leaf is active');
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - styles: mid rail, glass and panel');
{
  const H = door(900, 2100, { doorStyle: 'half-glazed' });
  const l = H.derived.door.leaves[0];
  ok(l.midRail?.axis === 999, `half-glazed: mid rail axis ${l.midRail?.axis} = leaf H / 2 = 1998 / 2 (doors v3)`);
  const mr = rec(H.derived, 'D-MID RAIL');
  ok(mr?.section === '94x57' && mr.length === 798 && mr.code === 'D-MR', 'D-MID RAIL 94x57 L798, code D-MR');
  const u = H.derived.customGlassUnits;
  ok(u.length === 1 && u[0].width === 633 && u[0].height === 881, `glass ${u[0].width} x ${u[0].height} = (999 - 47) - 94 + 23 = 881 (doors v3)`);
  const pn = H.derived.door.panels;
  // doors v3: the panel edge sits 17 in the 18 glazing rebate: panel = daylight + 2 x 17 (was the glass unit size)
  ok(pn.length === 1 && pn[0].w === 644 && pn[0].h === 806 && pn[0].daylight.w === 610 && pn[0].daylight.h === 772,
    `panel ${pn[0]?.w} x ${pn[0]?.h} = daylight (798 - 188) x ((1998 - 180) - (999 + 47)) = 610 x 772, + 2 x 17 (doors v3)`);
  ok(!u.some((g) => g.height === 806), 'the panel is not a glass unit');
  ok(near(H.derived.consumables.glass.sqm, Math.round(633 * 881 / 1e6 * 100) / 100), `glass m2 ${H.derived.consumables.glass.sqm} = the glass only`);
  const T = door(900, 2100, { doorStyle: 'three-quarter' });
  const tu = T.derived.customGlassUnits[0], tp = T.derived.door.panels[0];
  ok(T.derived.door.leaves[0].midRail.axis === 1498.5, 'three-quarter: axis 0.75 x 1998 = 1498.5 from the top (doors v3)');
  ok(tu.width === 633 && tu.height === 1380.5, `three-quarter glass ${tu.width} x ${tu.height} = (1498.5 - 47) - 94 + 23 (doors v3)`);
  ok(tp.w === 644 && tp.h === 306.5, `three-quarter panel ${tp.w} x ${tp.h} = daylight 610 x 272.5 + 2 x 17 (doors v3)`);
  const q = pq(H);
  // doors v3: both boards and the core at the panel OUTER size; the engine rounds each panel's
  // area to 0.0001 m2 before the board count multiplies it (633 x 797 happened to round alike)
  const area = Math.round(644 * 806 / 1e6 * 10000) / 10000;
  ok(near(q.d_panel_tricoya_18?.qty, Math.round(2 * area * 10000) / 10000) && near(q.d_panel_mdf_core?.qty, Math.round(area * 10000) / 10000),
    `panel boards: Tricoya ${q.d_panel_tricoya_18?.qty} m2 = 2 x ${R1(area * 1000) / 1000}, core ${q.d_panel_mdf_core?.qty} m2 = 1 x`);
  ok(pn[0].thickness === 54 && pn[0].inset === 17 && pn[0].edge.tongue === 24 && pn[0].edge.slope === 40 && pn[0].edge.flat === 15,
    'panel build 18 + 18 + 18 = 54, edge 17 in the rebate, tongue 24 / slope 40 / flat 15 (doors v3)');
  const FH = french(1600, 2100, { doorStyle: 'half-glazed' });
  ok(recs(FH.derived, 'D-MID RAIL').length === 2 && FH.derived.door.panels.length === 2 && FH.derived.customGlassUnits.every((g) => g.width === 584 && g.height === 881),
    'french half-glazed: two mid rails, two panels, glass 584 x 881 (doors v3)');
  ok(!rec(S.derived, 'D-MID RAIL') && !S.derived.door.panels.length, 'full glass: no mid rail, no panel');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - hardware: counts, hinges, handing, FGTE band, thresholds');
{
  const sum = (x) => x.derived.door.hardware.summary;
  const eq = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  ok(eq(sum(S), { d_hinges: 3, d_lock_single_kit: 1, d_cylinder: 1, d_handle_set: 1 }), `single: ${JSON.stringify(sum(S))}`);
  const f1 = french(1600, 2100, { lockType: 'single' });
  ok(eq(sum(f1), { d_hinges: 6, d_lock_single_kit: 1, d_bolts: 2, d_cylinder: 1, d_handle_set: 1 }), `french one handle: ${JSON.stringify(sum(f1))}`);
  const f2 = french(1600, 2100, { lockType: 'double' });
  ok(eq(sum(f2), { d_hinges: 6, d_lock_double_kit: 1, d_cylinder: 2, d_handle_set: 2 }), `french two handles: ${JSON.stringify(sum(f2))}`);
  // doors v3: frame H = leaf H + 102 (was + 98)
  const tall = door(900, 2150 + 102);
  ok(tall.derived.door.leafH === 2150 && sum(tall).d_hinges === 4, `leaf 2150: ${sum(tall).d_hinges} hinges`);
  const edge = door(900, 2100 + 102);
  ok(edge.derived.door.leafH === 2100 && sum(edge).d_hinges === 3, 'leaf exactly 2100: 3 hinges (4 only when taller)');
  ok(sum(french(1600, 2150 + 102)).d_hinges === 8, 'french with leaves of 2150: 8 hinges');
  ok(JSON.stringify(S.derived.door.leaves[0].hinges.map((y) => R1(y - S.derived.door.leaves[0].y))) === JSON.stringify([200, 899, 1848]),
    'hinge centres from the leaf top: 200, 1998 / 2 - 100 = 899, 1998 - 150 = 1848 (doors v3)');
  ok(tall.derived.door.leaves[0].hinges.length === 4, '4 hinge positions on the tall leaf');
  const fg = f2.derived.door.hardware.fgte;
  ok(fg?.family === 'slave' && fg.band?.lo === 1965 && fg.band?.hi === 2161, `FGTE band for leaf 1998: ${fg?.band?.lo}-${fg?.band?.hi} (slave shootbolts only, default; doors v3 leaf 1998, same band)`);
  ok(LIVE.doorHw.fgteBand(2002, 'both') === null && LIVE.doorHw.fgteBand(2150, 'both')?.lo === 2108, 'master and slave family: no band for 2002, 2108-2161 for 2150');
  ok(LIVE.doorHw.fgteBand(1818, 'slave')?.lo === 1818 && LIVE.doorHw.fgteBand(3061, 'slave')?.hi === 3061 && LIVE.doorHw.fgteBand(3062, 'slave') === null, 'band edges inclusive, beyond 3061 none');
  const det = (x, item) => x.derived.door.hardware.detail.find((l) => l.item === item);
  ok(/keyed alike/.test(det(f2, 'Door cylinder')?.detail || ''), 'FGTE pair: cylinders keyed alike');
  ok(/1965-2161/.test(det(f2, 'Multipoint lock, double door kit')?.detail || '') && /slave backset 45/.test(det(f2, 'Multipoint lock, double door kit').detail) && /centre line 22/.test(det(f2, 'Multipoint lock, double door kit').detail) && /cill option yes/.test(det(f2, 'Multipoint lock, double door kit').detail),
    'FGTE detail: band, slave backset, centre line, cill keep');
  const tb = det(S, 'Multipoint lock, single door kit')?.detail || '';
  // doors v3 (owner box item 11): the handing is printed as the configurator states it (PSW
  // convention, seen from inside) + the direction; the Winkhaus LH / RH and clockwise words are
  // gone from every printout. The kit handing stays internal (kitHanding), unchanged.
  ok(/^Hinge left · opens outward · /.test(tb) && /door thickness 56/.test(tb) && /backset 45/.test(tb) && /faceplate radius/.test(tb) && /keeps full length/.test(tb),
    `ThunderBolt detail: ${tb}`);
  ok(S.derived.door.hardware.handing === 'Hinge left · opens outward' && S.derived.door.hardware.kitHanding === 'RH', 'outward, open left: printed "Hinge left · opens outward"; internal kit handing RH (hinges right from outside)');
  const hr = door(900, 2100, { doorHinge: 'right' }).derived.door.hardware, hi = door(900, 2100, { doorOpenDirection: 'inward' }).derived.door.hardware;
  ok(hr.handing === 'Hinge right · opens outward' && hr.kitHanding === 'LH', 'outward, open right: "Hinge right · opens outward", kit LH');
  ok(hi.handing === 'Hinge left · opens inward' && hi.kitHanding === 'LH', 'inward, open left: "Hinge left · opens inward", kit LH');
  ok(LIVE.doorHw.HANDING_WORDS === undefined && ![S, f1, f2].some((x) => /clockwise|\bLH\b|\bRH\b/.test(JSON.stringify(x.derived.door.hardware.detail))),
    'no Winkhaus words left: HANDING_WORDS removed, no LH / RH / clockwise in any detail or variant (doors v3)');
  const hingeLine = det(S, 'Door hinges')?.detail || '';
  ok(new RegExp(`${S.derived.door.leaves[0].weightKg} kg`).test(hingeLine), `hinge detail prints the leaf weight: ${hingeLine}`);
  const thr = (fc, pid) => {
    const x = (fc.doorType === 'french' ? french : door)(fc.doorType === 'french' ? 1600 : 900, 2100, fc);
    return sum(x)[pid] === 1;
  };
  ok(thr({ thresholdType: 'aluminium' }, 'd_threshold_alu_single') && thr({ thresholdType: 'aluminium', doorType: 'french' }, 'd_threshold_alu_double')
    && thr({ thresholdType: 'low-profile' }, 'd_threshold_low_single') && thr({ thresholdType: 'low-profile', doorType: 'french' }, 'd_threshold_low_double'),
    'thresholds: aluminium / low-profile, single / double rows, 1 pc each');
  ok(!Object.keys(sum(S)).some((k) => k.startsWith('d_threshold')), 'standard (timber cill): no threshold product');
  // doors v3 (owner box item 9): aluminium / low-profile also buy the threshold seal, one
  // length per door opening in metres (900: 900 - 2 x 47 = 806 mm); timber and inward none
  const seal = (fc) => door(900, 2100, fc).derived.door.hardware.metres?.d_threshold_seal;
  ok(seal({ thresholdType: 'aluminium' }) === 0.81 && seal({ thresholdType: 'low-profile' }) === 0.81 && !seal({}) && !seal({ doorOpenDirection: 'inward', thresholdType: 'aluminium' }),
    'threshold seal 0.81 m with aluminium / low-profile only (doors v3)');
  ok(!Object.keys(sum(door(900, 2100, { doorOpenDirection: 'inward', thresholdType: 'aluminium' }))).some((k) => k.startsWith('d_threshold')), 'inward + aluminium: no threshold product (the timber inward cill, doors v3)');
  const hw = lists.buildHardwareList(S.spec, S.derived);
  // doors v3 (owner box item 10): the trickle vent line joins (habitable room, sole window: 2),
  // a client line on the trickleVents slot; the four door lines stay engine parts
  ok(hw.length === 5 && hw.filter((l) => l.enginePart === true).length === 4 && hw.find((l) => !l.enginePart)?.item === 'Trickle vents' && hw.find((l) => !l.enginePart).quantity === 2,
    'hardware lines: the 4 door lines are engine parts, plus Trickle vents x2 (doors v3)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - BOM part quantities');
{
  const ALL = new Set(store.ALL_PARTS.map((p) => p.id));
  const doors = [S, F, door(900, 2100, { doorStyle: 'half-glazed', doorOpenDirection: 'inward' }),
    french(1600, 2100, { sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500, transomType: 'opening', transomHeight: 450, doorStyle: 'three-quarter' }),
    french(1600, 2100, { transomType: 'fixed', transomHeight: 450, thresholdType: 'aluminium' })];
  const names = new Set(doors.flatMap((x) => [...x.derived.components.box, ...x.derived.components.sash, ...x.derived.components.beading].map((r) => r.elementName)));
  const unmapped = [...names].filter((n) => !bom.ELEMENT_TO_PART_ID[n] || !ALL.has(bom.ELEMENT_TO_PART_ID[n]));
  ok(unmapped.length === 0, `every door element name maps to an Assign Materials row (${names.size} names)`, unmapped.join(', '));
  const qs = doors.map(pq);
  ok(qs.every((q) => Object.keys(q).every((k) => ALL.has(k))), 'every quantity the BOM writes for a door is a row of ALL_PARTS');
  const sashRows = ['paint_primer', 'paint_preserver', 'paint_white_9016', 'silicone', 'weights_normal', 'weights_slim', 'glass_double', 'bead_tape', 'cord'];
  ok(qs.every((q) => sashRows.every((k) => !q[k])), 'no door quantity on a sash row (paint, silicone, counterweights, window double glass)');
  const q = pq(S);
  ok(near(q.d_glass_double_6_12_6?.qty, 1.11), `glass on d_glass_double_6_12_6: ${q.d_glass_double_6_12_6?.qty} m2`);
  const glassRow = (fc) => Object.keys(pq(door(900, 2100, fc))).filter((k) => /^(d_glass|glass_)/.test(k)).join(',');
  ok(glassRow({ glassType: 'double_slim' }) === 'glass_double_slim', 'slim door: the window slim row');
  ok(glassRow({ glassType: 'triple' }) === 'glass_triple', 'triple door: the window triple row');
  ok(glassRow({ glassSpec: 'acoustic' }) === 'glass_acoustic' && glassRow({ glassSpec: 'laminated' }) === 'glass_acoustic', 'Laminate / Acoustic (and Laminated on a double): the window acoustic row');
  const ac = door(900, 2100, { glassSpec: 'acoustic' });
  ok(ac.spec.glazing.thickness === 24.8 && lists.buildGlassListForWindow(ac.derived, ac.spec)[0].makeup === '4x14x6.8' && pq(ac).c_glass_clips_laminated?.qty === 8,
    'acoustic door: 24.8, makeup 4x14x6.8, 24.8 clips');
  const sl = door(900, 2100, { glassType: 'double_slim' }), tr = door(900, 2100, { glassType: 'triple' });
  ok(lists.buildGlassListForWindow(sl.derived, sl.spec)[0].makeup === '4x8x4' && sl.spec.glazing.thickness === 16, 'slim door: the window makeup 4x8x4, 16');
  ok(lists.buildGlassListForWindow(tr.derived, tr.spec)[0].makeup === '4x8x4x8x4' && tr.spec.glazing.thickness === 28 && rec(tr.derived, 'D-STILE (L)').section === '94x61' && pq(tr).c_glass_clips_triple?.qty === 8,
    'triple door: the window makeup, 28, leaf 61, triple clips');
  ok(near(q.c_paint_primer?.qty, 2.52) && near(q.c_paint_preserver?.qty, 0.25) && near(q.c_paint_white_9016?.qty, 1.26), 'paint on the casement rows, area 900 x 2100 (2.52 / 0.25 / 1.26 L)');
  const blue = door(900, 2100, { woodColor: '#1A3060', ralCode: '5010' });
  ok(pq(blue).c_paint_bespoke?.qty > 0 && !pq(blue).c_paint_white_9016, 'a coloured door: c_paint_bespoke');
  ok(q.c_glazing_packer?.qty === 8 && q.c_glass_clips_double?.qty === 8 && q.c_silicone?.qty > 0 && q.c_bead_tape_1mm?.qty > 0 && q.c_seal_frame_black?.qty > 0 && q.c_seal_hj_black?.qty > 0,
    'consumables on the casement rows: packers 8, clips 8 (pane > 500), silicone, bead tape, seals');
  ok(q.d_hinges?.qty === 3 && q.d_lock_single_kit?.qty === 1 && q.d_cylinder?.qty === 1 && q.d_handle_set?.qty === 1, 'hardware rows in the BOM');
  ok(q.d_leaf_stile?.mm === 2 * (1998 + 10) && q.d_leaf_top_rail?.mm === 808 && q.d_leaf_bottom_rail?.mm === 808 && q.d_frame_jamb?.mm === 2 * 2110 && q.d_frame_head?.mm === 910 && q.d_frame_cill?.mm === 910,
    'timber via the pre-cut lengths (+10 allowance): stiles 2 x 2008 (doors v3, was 2012), rails 808, jambs 2 x 2110, head 910, cill 910');
  const qf = pq(F);
  ok(qf.d_leaf_meeting_stile?.mm === 2 * 2008 && qf.d_leaf_stile?.mm === 2 * 2008, 'french: meeting stiles 2 x 2008 on their own row, hinge stiles 2 x 2008 (doors v3)');
  ok(qs.every((x) => !Object.keys(x).some((k) => /^c_frame|^c_mullion|^c_transom/.test(k))), 'door frame timber never lands on the casement frame rows');
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - pre-cut: one assigned material = one group');
{
  const doorTimber = store.DOOR_PARTS.frame.concat(store.DOOR_PARTS.leaf, store.DOOR_PARTS.sidePanel).map((p) => p.id);
  const materials = [{ id: 'oak', name: 'Oak 100 x 63', size: '100 x 63mm' }];
  const base = Object.fromEntries(doorTimber.map((id) => [id, { material_id: 'oak', yield: 1 }]));
  const data = { schema: 2, base, overrides: {} };
  const resolveRaw = bom.makeRawResolver({ assignments: LIVE.partRegistry.expandAssignments(data), assignmentsData: data, materials, frameType: 'standard' });
  const x = french(1600, 2100, { sidePanels: 'left', sideLeftWidth: 500, doorStyle: 'half-glazed' });
  const pre = lists.buildPrecutForWindow(x.derived, x.spec, {}, resolveRaw);
  const groups = [...pre.sashEngineering.map((g) => g.section), ...pre.boxSapele.map((g) => g.preCutWidth)];
  const all = pre.sashEngineering.flatMap((g) => g.items.map((i) => i.elementName));
  ok(groups.length === 1 && groups[0] === '100x63', `door frame, leaf and side panel members of one material: ONE group (${groups.join(', ')})`);
  // doors v3: a mullion stands where the coupling post stood
  ok(['D-FRAME HEAD', 'D-FRAME JAMB (L)', 'D-MULLION', 'D-FRAME CILL', 'D-STILE (L)', 'D-MEETING STILE', 'D-TOP RAIL', 'D-BOTTOM RAIL', 'D-MID RAIL', 'D-SIDE STILE'].every((n) => all.includes(n)),
    'the group holds frame, mullion, cill, stiles, meeting stile, rails, mid rail, side panel members');
  const un = lists.buildPrecutForWindow(F.derived, F.spec, {}, null);
  const secs = un.sashEngineering.map((g) => g.section);
  ok(!secs.includes('63x63') && secs.includes('94x57') && secs.includes('100x57') && secs.includes('180x57') && un.boxSapele.length === 0,
    `unassigned: leaf and frame members by finished section (${secs.join(', ')}), never the sash profile fallback 63x63, frame members in the same list`);
  // doors v3: the side panel light is 64 / 64 / 180 x 57: unassigned, its stiles and top rail
  // are a 64x57 group and its bottom rail joins the door bottom rails (180x57); a section map
  // entry for a door section is honoured, the sash profile fallback never is
  const SL = french(1600, 2100, { sidePanels: 'left', sideLeftWidth: 500 });
  const unS = lists.buildPrecutForWindow(SL.derived, SL.spec, {}, null);
  const sideGroup = unS.sashEngineering.find((g) => g.items.some((i) => i.elementName === 'D-SIDE STILE'));
  const bottomGroup = unS.sashEngineering.find((g) => g.items.some((i) => i.elementName === 'D-SIDE BOTTOM RAIL'));
  ok(sideGroup?.section === '64x57' && sideGroup.items.every((i) => /^D-SIDE (STILE|TOP RAIL)$/.test(i.elementName)) && bottomGroup?.section === '180x57' && bottomGroup.items.some((i) => i.elementName === 'D-BOTTOM RAIL') && unS.sashEngineering.some((g) => g.section === '94x57'),
    `unassigned side light (doors v3): stiles and top rail ${sideGroup?.section}, bottom rail with the door bottom rails ${bottomGroup?.section}; the leaf stays 94x57`);
  const unM = lists.buildPrecutForWindow(F.derived, F.spec, { sectionMap: { '94x57': '100x63' } }, null);
  ok(unM.sashEngineering.some((g) => g.section === '100x63' && g.items.some((i) => i.elementName === 'D-STILE (L)' || i.elementName === 'D-STILE (R)')),
    'a section map entry for a door section (94x57 -> 100x63) is honoured');
  const sel = bom.assignedMaterialForItems(pre.sashEngineering[0].items, { assignments: LIVE.partRegistry.expandAssignments(data), assignmentsData: data, materials });
  ok(sel?.id === 'oak', 'the pre-cut group header names the assigned material');
  const sym = (n) => LIVE.partSymbols.getPartSymbol(n).symbol;
  // doors v3: the mullion takes the casement mullion symbol M, the fixed fan FFS / FFTR / FFBR;
  // the old coupling post keeps CP for anything stored with it
  ok(['D-FRAME HEAD', 'D-FRAME JAMB (L)', 'D-FRAME CILL', 'D-COUPLING POST', 'D-MULLION', 'D-TRANSOM', 'D-MEETING STILE', 'D-MID RAIL', 'D-SIDE STILE', 'D-SIDE TOP RAIL', 'D-SIDE BOTTOM RAIL', 'D-FAN STILE (L)', 'D-FAN TOP RAIL', 'D-FAN BOTTOM RAIL', 'D-FIX FAN STILE (L)', 'D-FIX FAN TOP RAIL', 'D-FIX FAN BOTTOM RAIL'].map(sym).join(' ')
    === 'FH J-L CILL CP M T MS MR SP-ST SP-TR SP-BR FS-L FTR FBR FFS-L FFTR FFBR', 'part symbols without the D prefix: FH J-L CILL CP M T MS MR SP-ST SP-TR SP-BR FS-L FTR FBR FFS-L FFTR FFBR (doors v3: M, FF*)');
  const col = (n) => LIVE.partColours.partColourForElement(n)?.id;
  ok(['D-FRAME HEAD', 'D-FRAME JAMB (R)', 'D-FRAME CILL', 'D-COUPLING POST', 'D-MULLION', 'D-TRANSOM', 'D-STILE (L)', 'D-MEETING STILE', 'D-TOP RAIL', 'D-MID RAIL', 'D-BOTTOM RAIL', 'D-SIDE STILE', 'D-FAN TOP RAIL', 'D-FIX FAN STILE (L)', 'D-FIX FAN BOTTOM RAIL'].every((n) => col(n)?.startsWith('door_')),
    'every door part has a door colour group (doors v3: the mullion, the fixed fan)');
  ok(LIVE.partColours.PART_COLOUR_GROUPS.filter((g) => g.family === 'frame' || g.family === 'leaf').every((g) => !g.id.startsWith('door_')), 'the casement key families stay casement only');
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - cut list');
{
  const cut = lists.buildCutListForWindow(F.derived, F.spec).map((r) => ({ ...r, windowName: 'F1' }));
  const g = lists.buildGroupedCutList(cut);
  const by = (s) => g.find((x) => x.symbol === s);
  // symbols without the D prefix since 08.10.2026 (Piotr: the prefix said nothing)
  ok(by('ST-L/R')?.rows.length === 1 && by('ST-L/R').rows[0].qty === 2 && /hinge \(passive\)/.test(by('ST-L/R').rows[0].notes) && /hinge \(active\)/.test(by('ST-L/R').rows[0].notes),
    `french hinge stiles: one row x2, notes "${by('ST-L/R')?.rows[0]?.notes}"`);
  ok(by('MS')?.rows[0]?.qty === 2 && /meeting \(passive\)/.test(by('MS').rows[0].notes) && /meeting \(active\)/.test(by('MS').rows[0].notes), `meeting stiles: one row x2, notes "${by('MS')?.rows[0]?.notes}"`);
  ok(by('TR')?.rows[0]?.qty === 2 && /passive/.test(by('TR').rows[0].notes) && /active/.test(by('TR').rows[0].notes), 'top rails: one row x2, active and passive noted');
  ok(!g.some((x) => x.symbol === '?'), 'no door element falls into the "?" safety net');
  const cas = mk(LIVE, 1000, 1200, { windowCategory: 'casement', casementLayout: '040L' });
  const gc = lists.buildGroupedCutList(lists.buildCutListForWindow(cas.derived, cas.spec).map((r) => ({ ...r, windowName: 'C1' })));
  ok(gc.every((x) => x.rows.every((r) => !('notes' in r))), 'casement groups unchanged: no notes key');
  const H = french(1600, 2100, { doorStyle: 'half-glazed', transomType: 'opening', transomHeight: 450 });
  const gh = lists.buildGroupedCutList(lists.buildCutListForWindow(H.derived, H.spec).map((r) => ({ ...r, windowName: 'H1' })));
  ok(['MR', 'FS-L/R', 'FTR', 'FBR'].every((s) => gh.some((x) => x.symbol === s)), 'mid rail and fan leaf groups present (symbols without the D prefix)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - fanlight');
{
  const O = french(1600, 2100, { transomType: 'opening', transomHeight: 450 });
  const fl = O.derived.door.fanLeaves;
  ok(fl.length === 1 && fl[0].w === 1498 && fl[0].h === 385 && fl[0].fixed === false, `opening fan leaf ${fl[0]?.w} x ${fl[0]?.h} = (1600 - 102) x (450 - 65) (doors v3: T is the transom axis, fan T - 65; was 450 - 51 - 51)`);
  const cS = CP.elements.leafStile.face, cT = CP.elements.leafTop.face, cB = CP.elements.leafBottom.face;
  ok(cS === 64 && cT === 64 && cB === 67, 'casement leaf faces 64 / 64 / 67');
  ok(recs(O.derived, 'D-FAN STILE (L)')[0]?.section === '64x57' && recs(O.derived, 'D-FAN STILE (R)')[0]?.length === 385 && rec(O.derived, 'D-FAN TOP RAIL')?.section === '64x57' && rec(O.derived, 'D-FAN BOTTOM RAIL')?.section === '67x57' && rec(O.derived, 'D-FAN BOTTOM RAIL').length === 1498,
    'fan members 64x57 / 64x57 / 67x57 at the full leaf dimensions (stile L385, doors v3)');
  ok(['D-FAN STILE (L)', 'D-FAN STILE (R)', 'D-FAN TOP RAIL', 'D-FAN BOTTOM RAIL'].map((n) => bom.ELEMENT_TO_PART_ID[n]).join(' ') === 'c_sash_stile c_sash_stile c_sash_top_rail c_sash_bottom_rail', 'fan members buy the casement leaf timber');
  const ded = profile.casementGlassDeductions(CP);
  const fg = O.derived.customGlassUnits.find((u) => u.role === 'fanlight');
  ok(fg.width === 1498 - ded.width && fg.height === 385 - ded.height, `fan glass ${fg.width} x ${fg.height} = leaf - ${ded.width} / ${ded.height} (casement rule; doors v3 leaf H 385)`);
  const fh = O.derived.door.hardware.fan;
  ok(fh?.hingePicks?.length === 1 && fh.hingePicks[0].hung === 'top' && fh.lockPicks[0]?.slotId === 'c_lock_1260', `casement picks: hinge ${fh?.hingePicks?.[0]?.slotId}, lock ${fh?.lockPicks?.[0]?.slotId}`);
  ok(fh.hingePicks[0].overLimit === true, 'a 1498 wide top hung leaf is over every top hung row (max 1200): flagged, never hidden');
  const q = pq(O);
  ok(q[fh.hingePicks[0].slotId]?.qty === 1 && q.c_lock_1260_top?.qty === 1, 'the casement hinge and lock rows carry the fan');
  ok(lists.buildHardwareList(O.spec, O.derived).some((l) => l.item === 'Casement handle' && !l.enginePart), 'a casement handle line for the opening fan (client product)');
  const single = door(900, 2100, { transomType: 'opening', transomHeight: 450 });
  ok(single.derived.door.fanLeaves.length === 1 && single.derived.door.hardware.fan.hingePicks[0].overLimit !== true, 'single 900 with an opening fan: transom honoured on any door type; 798 wide fan leaf within the top hung rows');
  const X = french(1600, 2100, { transomType: 'fixed', transomHeight: 450 });
  const xg = X.derived.customGlassUnits.find((u) => u.role === 'fanlight');
  const xf = X.derived.door.fanLeaves;
  // doors v3 (owner box item 7): the fixed fanlight is a non-opening casement leaf 64 / 64 / 67
  // of the opening fan's size (1498 x 385), glass by the casement rule (W - 105, H - 108), no
  // hardware (was glass 1487 x 337 glazed into the frame, no leaf)
  ok(xf.length === 1 && xf[0].fixed === true && xf[0].w === 1498 && xf[0].h === 385 && xg.width === 1393 && xg.height === 277 && !X.derived.door.hardware.fan
    && rec(X.derived, 'D-FIX FAN TOP RAIL')?.section === '64x57' && rec(X.derived, 'D-FIX FAN BOTTOM RAIL')?.section === '67x57' && !recs(X.derived, 'D-FAN TOP RAIL').length,
    'fixed fanlight: a fixed leaf 1498 x 385, glass 1393 x 277, members 64 / 64 / 67, no hardware (doors v3)');
  // doors v3: the transom is the casement transom (segment = field leaf W + 8.5); H is the
  // overall frame, so the jambs are H (was 2100 + 450)
  ok(rec(X.derived, 'D-TRANSOM')?.section === '68x93' && rec(X.derived, 'D-TRANSOM').length === 1498 + 8.5 && rec(X.derived, 'D-FRAME JAMB (L)').length === 2100, 'transom 68x93 L1506.5 (1498 + 8.5), jambs 2100 (doors v3)');
  ok(!/pending/.test(JSON.stringify(O.derived.customGlassUnits)), 'no "64 sash pending" label left');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - side panels and bars');
{
  // doors v3: W is the overall frame, so 2600 keeps the 1600 door field between two 500 zones
  const P = french(2600, 2100, { sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500, sideHBars: 1, sideVBars: 1 });
  const pl = P.derived.door.panelLeaves;
  ok(pl.length === 2 && pl.every((p) => p.w === 432 && p.h === 1998 && p.fixed === true), 'side panel lights 500 - 51 - 17 = 432 x 1998 (doors v3: casement fixed light behind the mullion)');
  ok(recs(P.derived, 'D-SIDE STILE').every((r) => r.section === '64x57' && r.quantity === 2) && recs(P.derived, 'D-SIDE BOTTOM RAIL').every((r) => r.section === '180x57')
    && recs(P.derived, 'D-MULLION').length === 2 && !recs(P.derived, 'D-COUPLING POST').length && P.derived.door.leaves.every((l) => l.w === 789),
    'side light members 64x57 / 180x57, two mullions, no coupling post; door leaves (1600 - 2 x 17) / 2 + 6 = 789 between the mullions (doors v3)');
  const sg = P.derived.customGlassUnits.filter((u) => u.role === 'side');
  ok(sg.length === 2 && sg.every((u) => u.width === 327 && u.height === 1777 && u.bars.h === 1 && u.bars.v === 1), 'side panel glass 327 x 1777 (432 - 105, 1998 - 221; doors v3), bars 1 H x 1 V from sidePanels.barsH / barsV');
  const B = door(900, 2100, { doorHBars: 2, doorVBars: 1 });
  const ub = B.derived.customGlassUnits[0].bars;
  ok(ub.h === 2 && ub.v === 1 && ub.x.length === 1 && ub.y.length === 2, `door bars on the unit: ${JSON.stringify(ub)}`);
  ok(near(ub.x[0], 633 / 2), `vertical bar on the unit centre line (${ub.x[0]})`);
  const row = lists.buildGlassListForWindow(B.derived, B.spec)[0];
  ok(row.bars === '2H × 1V astragal' && row.barsH === 2 && row.barsV === 1, `glass order row: ${row.bars}`);
  const day = B.derived.door.leaves[0].daylight;
  const barRun = 2 * 633 + 1 * 1747;   // doors v3: glass H 1747
  ok(rec(B.derived, 'C-TRIANGLE BEADING (EXT)')?.length === Math.round(barRun * 1.15) && rec(B.derived, 'C-GEORGIAN MIDDLE BEADING')?.length === Math.round(barRun * 1.15),
    `astragal beads ext / int = (2 x 633 + 1747) x 1.15 = ${Math.round(barRun * 1.15)} on the casement rows (doors v3: the message followed the glass H, was 1751)`);
  ok(!rec(door(900, 2100, { doorHBars: 2, doorVBars: 1, doorBarType: 'georgian' }).derived, 'C-TRIANGLE BEADING (EXT)'), 'internal georgian bars: no astragal bead');
  ok(day.w === 610 && day.h === 1724, 'daylight 610 x 1724 (unit less 2 x 11.5; doors v3)');
  const M = french(1600, 2100, { doorVBars: 1, transomType: 'fixed', transomHeight: 450, transomBars: 'match' });
  const fanBars = M.derived.customGlassUnits.find((u) => u.role === 'fanlight').bars;
  const doorX = M.derived.door.leaves.flatMap((l) => l.bars.frame.vBars.map((b) => b.cx));
  const fanX = M.derived.door.fanLeaves[0].bars.frame.vBars.map((b) => b.cx);   // doors v3: the fixed fan is a leaf (fanPanes gone)
  ok(fanBars.v === 3 && fanBars.h === 0 && doorX.every((x) => fanX.includes(x)) && fanX.includes(800), `transom bars 'match': the door verticals continue into the fan (+ the meeting line): ${fanX.join(', ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('11 - weights, seals, beading, consumables by hand');
{
  const kg = profile.kgPerM;
  const timber = 2 * kg(94, 57) * 1.998 + kg(94, 57) * 0.798 + kg(180, 57) * 0.798;   // doors v3: leaf 1998
  const glass = 0.633 * 1.747 * 30;
  const w = R1((timber + glass) * 1.05);
  ok(S.derived.door.leaves[0].weightKg === w, `single leaf weight ${S.derived.door.leaves[0].weightKg} kg = (timber ${R1(timber)} + glass ${R1(glass)} at 30 kg/m2) x 1.05 = ${w}`);
  ok(S.derived.weights.total > 0 && S.derived.weights.timber > 0 && S.derived.weights.glass > 0, `derived.weights ${JSON.stringify(S.derived.weights)}`);
  const c = S.derived.consumables;
  ok(c.sealFrame.meters === Math.round((2 * 1998 + 2 * 798) * 1.1 / 1000 * 100) / 100 && c.sealHeadJambs.meters === Math.round((2 * 1998 + 798) * 1.1 / 1000 * 100) / 100,
    `seals per leaf x 1.10: frame ${c.sealFrame.meters} m, head & jambs ${c.sealHeadJambs.meters} m`);
  const perim = 2 * (633 + 1747);   // doors v3: glass H 1747
  ok(rec(S.derived, 'D-GLAZING BEADING')?.length === Math.round(perim * 1.15), `glazing bead = ${perim} x 1.15 on the door bead row`);
  ok(c.silicone.tubes === Math.round(0.1 * perim / 1000 * 10) / 10 && c.beadTapeSide.meters === Math.round(perim / 1000 * 100) / 100, `silicone ${c.silicone.tubes} tubes, bead tape ${c.beadTapeSide.meters} m per face`);
  const P = french(1600, 2100, { sidePanels: 'left', sideLeftWidth: 500, transomType: 'opening', transomHeight: 450 });
  const L = [...P.derived.door.leaves, ...P.derived.door.panelLeaves, ...P.derived.door.fanLeaves];
  ok(L.length === 5 && P.derived.consumables.sealFrame.meters === Math.round(L.reduce((a, l) => a + 2 * l.h + 2 * l.w, 0) * 1.1 / 1000 * 100) / 100,
    'seals over the door leaves, the side panel leaf and both fan leaves (one per frame)');
  const H = door(900, 2100, { doorStyle: 'half-glazed' });
  ok(rec(H.derived, 'D-GLAZING BEADING').length === Math.round((2 * (633 + 881) + 2 * (644 + 806)) * 1.15), 'half-glazed: the panel is beaded in the same rebate (pane + panel perimeters x 1.15; doors v3 glass 881, panel 644 x 806)');
  ok(pq(H).c_glazing_packer.qty === 8, 'packers per glass pane only (the panel takes none)');
  const white = door(900, 2100, { sealColour: 'white' });
  ok(pq(white).c_seal_frame_white?.qty > 0 && !pq(white).c_seal_frame_black, 'seal colour white: the white rows');
}

// ═════════════════════════════════════════════════════════════════════════════
section('12 - threshold extension');
{
  const E = door(900, 2100, { thresholdExtension: 35 });
  ok(rec(E.derived, 'D-FRAME CILL').length === 935 && /ext 35mm/.test(rec(E.derived, 'D-FRAME CILL').notes), 'cill length = 900 + threshold extension 35 (brief 3.7)');
  ok(pq(E).c_sill_ext_35?.mm === 935, 'sill extension board 35 = the cill length');
  const legacy = door(900, 2100, { sillExtension: 60, sillWider: true });
  ok(rec(legacy.derived, 'D-FRAME CILL').length === 900 && !pq(legacy).c_sill_ext_60, 'cill.extension / cill.wider are not door fields: ignored');
  ok(!pq(door(900, 2100, { thresholdExtension: 40 })).c_sill_ext_35, 'a free extension (40) has no board row (BLOCKERS)');
  ok(!pq(door(900, 2100, { thresholdExtension: 35, thresholdType: 'aluminium' })).c_sill_ext_35, 'no timber cill: no extension board');
}

// ═════════════════════════════════════════════════════════════════════════════
section('13 - migration and withProfiles');
{
  const mig = profile.migrateDoorProfile;
  const old = clone(START.profile.DEFAULT_DOOR_PROFILE);
  ok(old.schema === 1 && old.leafDepth === 61 && old.geometry.land === 43 && old.frenchOverlap === 6, 'START tree: the schema-1 door profile (leaf 61, land 43, overlap 6)');
  const m = mig(old);
  const D = DP;
  // doors v3: the migration walks schema by schema, so the schema-1 leaf rules end on the
  // schema-3 derived 102 (94 -> 98 -> 102, 53 -> 57 -> 102) and the copy lands on schema 3
  ok(m.schema === 3 && m.leafDepth === 57 && m.geometry.land === 47 && m.geometry.rebate === 21 && m.deductions.leafAtJamb === 51 && m.deductions.leafFullHeight === 102 && m.deductions.leafNoThreshold === 102,
    'schema-1 copy: every old default moves (57 / 47 / 21 / 51 / 102 / 102; doors v3)');
  ok(m.elements.leafMeeting.face === 100 && m.frenchLip === 6 && m.elements.transomRail.face === 68 && m.leafDepthTriple === 61 && m.hinges.perLeaf === 3 && m.hardware.backset === 45
    && m.deductions.leafAtFloor === 51 && m.deductions.fanFromAxis === 65 && m.deductions.leafBelowAxis === 17 && m.sidePanel.bottom === 180 && m.fixedFan.bottom === 67 && m.panel.inset === 17 && m.lengths.transomSeat === 8.5,
    'missing keys filled: meeting 100, lip 6 (from frenchOverlap), transom rail 68 (from transom.rail), triple 61, hinges, hardware, the v3 keys (leafAtFloor, fan rule, side light, fixed fan, panel inset, seat)');
  ok(JSON.stringify({ ...m }) === JSON.stringify({ ...mig(clone(D)) }) || ['schema', 'leafDepth', 'geometry', 'deductions', 'elements', 'frenchLip'].every((k) => JSON.stringify(m[k]) === JSON.stringify(D[k])),
    'a migrated schema-1 default equals today\'s default on every number the engine reads');
  const hand = clone(old); hand.geometry.land = 45; hand.deductions.leafAtJamb = 49; hand.leafDepth = 60; hand.frenchOverlap = 8; hand.transom = { rail: 70 };
  const mh = mig(hand);
  ok(mh.geometry.land === 45 && mh.deductions.leafAtJamb === 49 && mh.leafDepth === 60 && mh.frenchLip === 8 && mh.elements.transomRail.face === 70 && mh.deductions.leafFullHeight === 102,
    'hand edits stay (land 45, leafAtJamb 49, leaf 60, lip 8, rail 70); untouched old defaults still move (to 102, doors v3)');
  // doors v3: the current schema is 3, so a schema-3 copy is never migrated
  const s3 = clone(D); s3.geometry.land = 43; s3.deductions.leafAtJamb = 47;
  const m3 = mig(s3);
  ok(m3.geometry.land === 43 && m3.deductions.leafAtJamb === 47, 'a schema-3 copy is never migrated: 43 / 47 there are hand edits');
  ok(mig(null) === null && mig({}).schema === 3 && mig({}).deductions.leafAtJamb === 51, 'empty copy: the default (schema 3)');
  // withProfiles: the door snapshot is used inside and restored after; the 3-argument call still works
  const snap = clone(D); snap.deductions.leafAtJamb = 61;
  const inside = profile.withProfiles(null, null, snap, () => door(900, 2100).derived.door.leafW);
  ok(inside === 900 - 122 && door(900, 2100).derived.door.leafW === 798, `withProfiles(sash, casement, door, fn): leaf ${inside} with the snapshot, 798 after`);
  ok(profile.withProfiles(null, null, () => door(900, 2100).derived.door.leafW) === 798, 'withProfiles(sash, casement, fn): the live door profile');
  profile.setActiveDoorProfile(old);
  ok(profile.getDoorProfile().deductions.leafAtJamb === 51 && profile.getDoorProfile().schema === 3, 'setActiveDoorProfile migrates a stored schema-1 copy (to schema 3, doors v3)');
  profile.setActiveDoorProfile(null);
  ok(profile.getDoorProfile() === DP, 'setActiveDoorProfile(null): the default again');
}

// ═════════════════════════════════════════════════════════════════════════════
section('14 - the profile store');
{
  const S0 = LIVE.profileStore.useWindowProfileStore;
  const st = S0.getState();
  ok(st.door && st.door.schema === 3 && st.door.deductions.leafAtJamb === 51, 'windowProfileStore holds the door profile (door key, schema 3)');
  ok(typeof st.setDoorPath === 'function' && typeof st.resetDoorToDefaults === 'function', 'setDoorPath / resetDoorToDefaults');
  st.setDoorPath(['elements', 'leafStile', 'face'], 92);
  ok(S0.getState().door.elements.leafStile.face === 92 && profile.getDoorProfile().elements.leafStile.face === 92, 'an edit lands in the store AND the engine (_sync)');
  ok(door(900, 2100).derived.customGlassUnits[0].width === 798 - 2 * (92 - 11.5), 'the engine uses the edit: glass 798 - 2 x 80.5');
  st.setDoorPath(['nonsense', 'x'], 1); st.setDoorPath(['geometry', 'notAKey'], 1); st.setDoorPath(['frenchLip'], 'abc');
  ok(!('nonsense' in S0.getState().door) && !('notAKey' in S0.getState().door.geometry) && S0.getState().door.frenchLip === 6, 'unknown roots / keys and non-numbers are refused');
  st.setDoorPath(['hardware', 'faceplate'], 'square');
  ok(S0.getState().door.hardware.faceplate === 'square', 'string leaves (hardware variants) are written as strings');
  S0.getState().resetDoorToDefaults();
  ok(JSON.stringify(S0.getState().door) === JSON.stringify(DP) && profile.getDoorProfile().elements.leafStile.face === 94, 'reset: the default door profile, pushed to the engine');
  const keys = Object.keys(S0.getState());
  ok(!Object.getOwnPropertyNames(S0.getState()).some((k) => Object.getOwnPropertyDescriptor(S0.getState(), k)?.get), 'no getter properties in the store');
  void keys;
}

// ═════════════════════════════════════════════════════════════════════════════
section('15 - Assign Materials rows');
{
  const ids = store.ALL_PARTS.map((p) => p.id);
  const want = ['d_frame_head', 'd_frame_jamb', 'd_frame_cill', 'd_frame_cill_inward', 'd_coupling_post', 'd_transom_rail',
    'd_leaf_stile', 'd_leaf_meeting_stile', 'd_leaf_top_rail', 'd_leaf_bottom_rail', 'd_leaf_mid_rail',
    'd_panel_tricoya_18', 'd_panel_mdf_core', 'd_side_stile', 'd_side_top_rail', 'd_side_bottom_rail',
    'd_glass_double_6_12_6', 'd_glazing_beading',
    'd_hinges', 'd_lock_single_kit', 'd_lock_double_kit', 'd_cylinder', 'd_handle_set', 'd_bolts',
    'd_threshold_alu_single', 'd_threshold_alu_double', 'd_threshold_low_single', 'd_threshold_low_double',
    // doors v3 (09.10.2026): the threshold seal, the mullion and the fixed fan rows, appended last
    'd_threshold_seal', 'd_mullion', 'd_fan_fixed_stile', 'd_fan_fixed_top_rail', 'd_fan_fixed_bottom_rail'];
  ok(want.every((id) => ids.includes(id)) && store.DOOR_ALL_PARTS.length === want.length && JSON.stringify(store.DOOR_ALL_PARTS.map((p) => p.id)) === JSON.stringify(want),
    `the ${want.length} door rows of the brief, in this order, nothing else`, want.filter((id) => !ids.includes(id)).join(', '));
  ok(new Set(ids).size === ids.length, 'no duplicate ids in ALL_PARTS');
  const firstD = ids.findIndex((id) => id.startsWith('d_')), lastC = ids.map((id) => id.startsWith('c_')).lastIndexOf(true);
  ok(firstD > lastC && JSON.stringify(ids.slice(0, firstD)) === JSON.stringify(START.store.ALL_PARTS.map((p) => p.id)), 'door rows appended after every existing row (index-based sets keep their rows)');
  const byId = Object.fromEntries(store.ALL_PARTS.map((p) => [p.id, p]));
  ok(byId.d_frame_head.section === '68×93' && byId.d_frame_cill_inward.section === '40×93' && byId.d_coupling_post.section === '136×93' && byId.d_leaf_meeting_stile.section === '100×57' && byId.d_leaf_bottom_rail.section === '180×57'
    && byId.d_side_stile.section === '64×57' && byId.d_side_bottom_rail.section === '180×57' && byId.d_mullion.section === '68×93' && byId.d_fan_fixed_bottom_rail.section === '67×57',
    'section labels with the multiplication sign, from the door profile (doors v3: side light 64 / 180, mullion 68, fixed fan 67)');
  ok(store.DOOR_PARTS.ironmongery.every((p) => p.hint && p.defaultCategory) && /3 hinges, 4 when the leaf is taller than 2100/.test(byId.d_hinges.hint), 'ironmongery rows carry the counting rule (hint) and their catalogue tab');
  ok(!JSON.stringify(store.DOOR_ALL_PARTS).match(/[\u2013\u2014]/), 'no en / em dash in the door rows');
  ok(['c_silicone', 'c_bead_tape_1mm', 'c_seal_frame_black', 'c_paint_primer', 'c_glazing_packer', 'c_glass_clips_double', 'c_triangle_beading_ext'].every((id) => /also doors/.test(byId[id].hint)), 'casement rows that carry doors say "also doors"');
  ok(['cylinders', 'doorHandles', 'doorHinges', 'multipointLocks', 'thresholds', 'bolts'].every((k) => store.DOOR_PARTS.ironmongery.some((p) => p.defaultCategory === k) || k === 'thresholds'), 'every door ironmongery category has a row');
}

// ═════════════════════════════════════════════════════════════════════════════
section('16 - the window door slot, optimiser over-length');
{
  const IRN = [{ id: 'irn-hinge', name: 'Winkhaus hinge', unit: 'pcs', cost_per_unit: 10 }, { id: 'irn-cyl', name: 'Euro cylinder', unit: 'pcs', cost_per_unit: 20 }];
  const spec = { ...S.spec, hardware: { ...S.spec.hardware, slots: { doorHinges: 'irn-hinge', cylinders: 'irn-cyl' } } };
  const ctx = { assignments: {}, assignmentsData: { schema: 2, base: {}, overrides: {} }, materials: [], ALL_PARTS: store.ALL_PARTS, ironmongeryItems: IRN, settings: {} };
  const lines = bom.buildWindowMaterialLines({ derived: S.derived, windowSpec: spec, batch: null }, ctx);
  const l = (k) => lines.find((x) => x.key === k);
  ok(l('mat:irn-hinge')?.qty === 3 && l('mat:irn-cyl')?.qty === 1 && !l('part:d_hinges') && !l('part:d_cylinder'), 'a product in the window\'s door slot is bought on the row\'s count (3 hinges, 1 cylinder)');
  // the lock kit line carries its variant as its note (brief 3.5, the purchase list note); the row key
  // does not change, the purchase-list row lists its variants with their quantities
  const kit = lines.find((x) => x.part?.id === 'd_lock_single_kit');
  ok(kit?.qty === 1 && kit.key === 'part:d_lock_single_kit' && l('part:d_handle_set')?.qty === 1, 'rows without a slot product stay on their row');
  // doors v3: the variant note carries the handing as the configurator states it
  ok(/^Hinge (left|right) · opens (outward|inward) · door thickness 56 · backset 45 · faceplate radius · keeps full length$/.test(kit?.note || ''), `ThunderBolt variant note: "${kit?.note}"`);
  const R = door(900, 2100, { doorHinge: 'right' });
  const two = bom.mergeWindowMaterials([{ derived: S.derived, windowSpec: S.spec, batch: null }, { derived: R.derived, windowSpec: R.spec, batch: null }], ctx);
  const same = bom.mergeWindowMaterials([{ derived: S.derived, windowSpec: S.spec, batch: null }, { derived: S.derived, windowSpec: S.spec, batch: null }], ctx);
  const kitRow = (rows) => rows.find((r) => r.key === 'part:d_lock_single_kit');
  // doors v3: the variants differ in "Hinge left" / "Hinge right" (was LH / RH, the first 2 characters)
  const hand = (n) => n.note.split(' · ')[0];
  ok(kitRow(two)?.qty === 2 && kitRow(two).notes?.length === 2 && kitRow(two).notes.every((n) => n.qty === 1) && new Set(kitRow(two).notes.map(hand)).size === 2
    && kitRow(same)?.qty === 2 && kitRow(same).notes?.length === 1 && kitRow(same).notes[0].qty === 2,
    `purchase list: one kit row x2 listing its variants (${(kitRow(two)?.notes || []).map((n) => `${n.qty} ${hand(n)}`).join(' + ')}); two equal doors: one variant x2`);
  ok(two.filter((r) => r.notes).every((r) => /^part:d_(lock_single_kit|lock_double_kit|cylinder)$/.test(r.key)), 'only the lock kit (and FGTE cylinder) rows carry variant notes');
  const FD = french(1600, 2100, { lockType: 'double' });
  const fl = bom.buildWindowMaterialLines({ derived: FD.derived, windowSpec: FD.spec, batch: null }, ctx);
  const fk = fl.find((x) => x.part?.id === 'd_lock_double_kit');
  ok(/^Hinge left · opens outward · slave shootbolts only · height band 1965-2161 · slave backset 45 · centre line 22 · cill keep yes$/.test(fk?.note || '') && fl.find((x) => x.part?.id === 'd_cylinder')?.note === 'keyed alike pair',
    `FGTE variant note: "${fk?.note}"; cylinders "keyed alike pair"`);
  // doors v3: the trickle vents are a client line (the trickleVents slot), counted once through
  // buildWindowHardware; every door engine line still counts only on its Assign Materials row
  ok(!lines.some((x) => x.line?.enginePart) && lines.filter((x) => x.line?.item === 'Trickle vents').length === 1 && lines.find((x) => x.line?.item === 'Trickle vents').qty === 2,
    'no hardware line counted twice (door lines are engine parts); the vents line once, 2 (doors v3)');
  const det = bom.windowHardwareDetailRows(spec, null, IRN, S.derived);
  ok(det.some((r) => r.item === 'Winkhaus hinge' && /weight for information/.test(r.detail)) && det.filter((r) => r.item !== 'Trickle vents').every((r) => !('assigned' in r)) && det.find((r) => r.item === 'Trickle vents')?.assigned === false,
    'BOM PDF detail: the slot product name with the engine detail; the vents a client row (assigned false, doors v3)');
  const opt = LIVE.optimizer.bestFitDecreasing
    ? LIVE.optimizer.bestFitDecreasing({ items: [{ length: 4000, quantity: 1, elementName: 'D-FRAME JAMB (L)', windowName: 'D1' }, { length: 1000, quantity: 1 }], stockLength: 3700, kerf: 3, endTrim: 10, minimumPiece: 200, prefix: 'B' })
    : LIVE.optimizer.optimisePrecut({ sashEngineering: [], boxSapele: [{ preCutWidth: '68x93', stockLength: 3700, items: [{ length: 4000, quantity: 1, elementName: 'D-FRAME JAMB (L)', windowName: 'D1' }, { length: 1000, quantity: 1 }] }] }, { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 3700 }).boxSapele[0];
  ok(opt.summary.overLength?.length === 1 && opt.summary.overLength[0].length === 4000 && opt.bars.some((b) => b.overLength && b.cuts.includes(4000)),
    'a 4000 piece on 3700 stock: reported (summary.overLength, bar.overLength), still on a bar of its own');
  const fine = LIVE.optimizer.optimisePrecut({ sashEngineering: [{ section: '68x93', items: [{ length: 2000, quantity: 2 }] }], boxSapele: [] }, { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 3700 }).sashEngineering[0];
  ok(!('overLength' in fine.summary) && fine.bars.every((b) => !('overLength' in b)), 'no over-length key when every piece fits (outputs unchanged)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('17 - controls: casement and sash equal to START');
{
  const CTL = [
    ['casement 040L 1000 x 1200', { windowCategory: 'casement', casementLayout: '040L' }, 1000, 1200],
    ['casement 022 1200 x 1500 bars', { windowCategory: 'casement', casementLayout: '022', casementHBars: 1, casementVBars: 1 }, 1200, 1500],
    ['sash 1000 x 1600', { windowCategory: 'sash', frameType: 'standard' }, 1000, 1600],
    ['sash 1000 x 1500 2x2', { windowCategory: 'sash', frameType: 'standard', upperBars: '2x2', lowerBars: '2x2' }, 1000, 1500],
  ];
  for (const [name, fc, w, h] of CTL) {
    const a = mk(LIVE, w, h, fc), b = mk(START, w, h, fc);
    // 09.10.2026 (sash proportions, brief 2.4): a sash derived carries two new keys and a sash
    // windowSpec sash.proportion; every other key stays byte for byte, the new ones are standard
    // (meeting fraction by hand: bottom = (H - 92 + 33) / 2, f = (bottom - 43 / 2) / (H - 92 - 43)).
    // A casement derives and specifies exactly as START (no new key at all).
    const isSash = fc.windowCategory === 'sash';
    const handFraction = (((h - 92 + 33) / 2) - 43 / 2) / (h - 92 - 43);
    const noNewKeys = (d) => { const c = { ...d }; if (isSash) { delete c.sashProportion; delete c.meetingFraction; } return c; };
    ok(JSON.stringify(noNewKeys(a.derived)) === JSON.stringify(b.derived)
      && (isSash ? a.derived.sashProportion === 'standard' && near(a.derived.meetingFraction, handFraction, 1e-12) : !('sashProportion' in a.derived) && !('meetingFraction' in a.derived)),
      `${name}: derived deep-equal to START${isSash ? ` but for the two new keys (standard, meetingFraction ${a.derived.meetingFraction})` : ''}`);
    // every windowSpec carries the door defaults block; on a window only its informational
    // leafDepth moved (61 -> 57, the door profile), nothing reads it outside a door
    const noDoor = (x) => { const c = clone(x); delete c.door; if (isSash && c.sash) delete c.sash.proportion; return c; };
    ok(JSON.stringify(noDoor(a.spec)) === JSON.stringify(noDoor(b.spec)) && JSON.stringify({ ...a.spec.door, leafDepth: 0 }) === JSON.stringify({ ...b.spec.door, leafDepth: 0 })
      && !('proportion' in b.spec.sash) && (isSash ? a.spec.sash.proportion === 'standard' : !('proportion' in a.spec.sash)),
      `${name}: windowSpec equal to START but for the door block's informational leafDepth (${b.spec.door.leafDepth} -> ${a.spec.door.leafDepth})${isSash ? ' and the new sash.proportion (standard)' : ''}`);
    // 08.10.2026: the pre-cut allowance is a setting, default 10 (START added a fixed 20).
    // With 20 asked for, the live pre-cut and the BOM metres equal START exactly; at the
    // default every straight piece is 10 shorter and nothing else moves.
    const A20 = { precutAllowance: 20 };
    ok(JSON.stringify(lists.buildCutListForWindow(a.derived, a.spec)) === JSON.stringify(START.lists.buildCutListForWindow(b.derived, b.spec))
      && JSON.stringify(lists.buildGlassListForWindow(a.derived, a.spec)) === JSON.stringify(START.lists.buildGlassListForWindow(b.derived, b.spec))
      && JSON.stringify(lists.buildPrecutForWindow(a.derived, a.spec, A20, null)) === JSON.stringify(START.lists.buildPrecutForWindow(b.derived, b.spec, {}, null))
      && JSON.stringify(lists.buildHardwareList(a.spec, a.derived)) === JSON.stringify(START.lists.buildHardwareList(b.spec, b.derived)),
      `${name}: cut list, glass list, pre-cut (allowance 20) and hardware list equal to START`);
    const pcItems = (pc) => [...pc.sashEngineering.flatMap((g) => g.items), ...pc.boxSapele.flatMap((g) => g.items)];
    const p10 = pcItems(lists.buildPrecutForWindow(a.derived, a.spec, {}, null)), p20 = pcItems(START.lists.buildPrecutForWindow(b.derived, b.spec, {}, null));
    ok(p10.length === p20.length && p10.every((it, i) => JSON.stringify({ ...it, length: 0 }) === JSON.stringify({ ...p20[i], length: 0 }) && (it.blank ? it.length === p20[i].length : it.length === p20[i].length - 10)),
      `${name}: default pre-cut = START with every straight piece 10 shorter (${p10.length} pieces)`);
    ok(JSON.stringify(bom.buildWindowPartQtys(a.derived, a.spec, A20)) === JSON.stringify(START.bom.buildWindowPartQtys(b.derived, b.spec, {})), `${name}: BOM part quantities (allowance 20) equal to START`);
    // 08.10.2026: Cut List symbols lost the C prefix and every group names its engine element
    const ga = lists.buildGroupedCutList(lists.buildCutListForWindow(a.derived, a.spec).map((r) => ({ ...r, windowName: 'W' })));
    const gb = START.lists.buildGroupedCutList(START.lists.buildCutListForWindow(b.derived, b.spec).map((r) => ({ ...r, windowName: 'W' })));
    const sansElement = (g) => g.map(({ element, ...rest }) => rest);
    const sansPrefix = (g) => g.map((x) => ({ ...x, symbol: String(x.symbol).replace(/^[CDS]-/, '') }));
    ok(JSON.stringify(sansElement(ga)) === JSON.stringify(sansPrefix(gb)) && ga.every((x) => typeof x.element === 'string' && x.element.length > 0),
      `${name}: grouped cut list equal to START but for the dropped C prefix; every group carries its element`);
  }
  ok(JSON.stringify(profile.DEFAULT_CASEMENT_PROFILE) === JSON.stringify(START.profile.DEFAULT_CASEMENT_PROFILE) && JSON.stringify(profile.DEFAULT_SASH_PROFILE) === JSON.stringify(START.profile.DEFAULT_SASH_PROFILE),
    'casement and sash default profiles equal to START');
}

section('18 - door sheets: the components the screen, the PDFs and the pack mount');
{
  // Bundle the door sheets the way verify/arch/lib/sheets.mjs bundles the casement
  // ones, and render through DoorSheet + doorSheetPlan (DrawingsPanel, its PDF rig,
  // the Elements PDF and the production pack mount exactly these), the elevation
  // and one DoorGlassDrawing2D per groupDoorGlass group.
  const entry = resolve(AUDIT, 't41-sheets-entry.mjs');
  const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
  writeFileSync(entry, [
    `export { default as DoorSheet } from '${rel('components/drawings/DoorSheet.jsx')}';`,
    `export { default as Elevation } from '${rel('components/drawings/DoorElevation2D.jsx')}';`,
    `export { default as Glass } from '${rel('components/drawings/DoorGlassDrawing2D.jsx')}';`,
    `export * as ddu from '${rel('components/drawings/doorDrawUtils.js')}';`,
    `export * as specification from '${rel('engine/specification.js')}';`,
    `export * as calculations from '${rel('engine/calculations.js')}';`,
    `export * as lists from '${rel('engine/lists.js')}';`,
    `export * as profile from '${rel('engine/profile.js')}';`,
  ].join('\n'));
  const out = resolve(AUDIT, 't41-sheets-bundle.mjs');
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const SH = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
  const render = (C, props) => renderToStaticMarkup(React.createElement(C, props));
  const sk = (w, h, fc) => mk(SH, w, h, { windowCategory: 'door', ...fc });
  const SET = {
    'single 900 x 2100 outward': sk(900, 2100, { doorType: 'single-external' }),
    'single inward': sk(900, 2100, { doorType: 'single-external', doorOpenDirection: 'inward' }),
    'single aluminium threshold': sk(900, 2100, { doorType: 'single-external', thresholdType: 'aluminium' }),
    'single half-glazed': sk(900, 2100, { doorType: 'single-external', doorStyle: 'half-glazed' }),
    'single three-quarter': sk(900, 2100, { doorType: 'single-external', doorStyle: 'three-quarter' }),
    'french lockType single': sk(1600, 2100, { doorType: 'french', lockType: 'single' }),
    'french lockType double': sk(1600, 2100, { doorType: 'french', lockType: 'double' }),
    'french side panels 500 / 500': sk(1600, 2100, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500 }),
    'french fanlight 450 fixed': sk(1600, 2100, { doorType: 'french', transomType: 'fixed', transomHeight: 450 }),
    'french fanlight 450 opening': sk(1600, 2100, { doorType: 'french', transomType: 'opening', transomHeight: 450 }),
    'single bars h2 v1': sk(900, 2100, { doorType: 'single-external', doorHBars: 2, doorVBars: 1 }),
    'single triple': sk(900, 2100, { doorType: 'single-external', glassType: 'triple' }),
    'single 900 x 2248 (4 hinges)': sk(900, 2248, { doorType: 'single-external' }),
    // doors v3 (09.10.2026): the cases of CLAUDE.md 3.10 and section 6, and every threshold
    'french 2400 x 2400 sides 400 / 400 opening fan 450': sk(2400, 2400, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'opening', transomHeight: 450 }),
    'french 2400 x 2400 sides 400 / 400 fixed fan 450': sk(2400, 2400, { doorType: 'french', sidePanels: 'both', sideLeftWidth: 400, sideRightWidth: 400, transomType: 'fixed', transomHeight: 450 }),
    'single 1000 x 2100 side 450 right': sk(1000, 2100, { doorType: 'single-external', sidePanels: 'right', sideRightWidth: 450 }),
    'single low-profile threshold': sk(900, 2100, { doorType: 'single-external', thresholdType: 'low-profile' }),
    'single inward aluminium (ignored)': sk(900, 2100, { doorType: 'single-external', doorOpenDirection: 'inward', thresholdType: 'aluminium' }),
    'single hinge right': sk(900, 2100, { doorType: 'single-external', doorHinge: 'right' }),
  };
  // CLAUDE.md 3.15: every leaf height from 1900 to 2400 with 3 and with 4 hinges (the hinge
  // rule is a profile value: tallAbove 1 forces 4, a huge one forces 3), single and french
  const FORCED = {};
  for (const lh of [1900, 2000, 2100, 2200, 2300, 2400]) {
    for (const n of [3, 4]) {
      FORCED[`single leaf ${lh} ${n} hinges`] = { n, w: 900, h: lh + DP.deductions.leafAtJamb + DP.deductions.leafAtFloor, fc: { doorType: 'single-external' } };
      FORCED[`french leaf ${lh} ${n} hinges`] = { n, w: 1600, h: lh + DP.deductions.leafAtJamb + DP.deductions.leafAtFloor, fc: { doorType: 'french', lockType: 'double' } };
    }
  }
  const fmt = (v) => String(Math.round(Number(v) * 10) / 10);
  const sheetsOf = (spec, derived) => {
    const plan = SH.ddu.doorSheetPlan(derived);
    const sheets = { elevation: render(SH.Elevation, { windowSpec: spec, derived, projectNumber: 'P-1' }) };
    for (const p of plan) sheets[p.key] = render(SH.DoorSheet, { sheet: p, windowSpec: spec, derived, projectNumber: 'P-1' });
    const groups = SH.ddu.groupDoorGlass(derived, spec);
    groups.forEach((g, i) => { sheets[`glass${i}`] = render(SH.Glass, { windowSpec: spec, derived, group: g }); });
    return { plan, sheets, groups };
  };
  const forcedProfile = (n) => ({ ...DP, hinges: { ...DP.hinges, tallAbove: n === 4 ? 1 : 99999 } });
  const RUNS = [
    ...Object.entries(SET).map(([name, { spec, derived }]) => ({ name, spec, derived, ...sheetsOf(spec, derived) })),
    ...Object.entries(FORCED).map(([name, f]) => SH.profile.withProfiles(null, null, forcedProfile(f.n), () => {
      const { spec, derived } = sk(f.w, f.h, f.fc);
      return { name, spec, derived, forced: f.n, ...sheetsOf(spec, derived) };
    })),
  ];
  for (const { name, spec, derived, plan, sheets, groups, forced } of RUNS) {
    const dr = derived.door;
    // the plan: frame, leaf, one per side panel, one per fan leaf (opening or fixed, doors v3), the plan section
    const wantKeys = ['doorframe', 'doorleaf', ...(dr.panelLeaves || []).map((pl) => `doorside-${pl.side}`),
      ...(dr.fanLeaves || []).map((_, i) => `doorfan-${i}`), 'doorsection'];
    ok(JSON.stringify(plan.map((p) => p.key)) === JSON.stringify(wantKeys), `${name}: sheet plan ${plan.map((p) => p.key).join(', ')}`);
    // CLAUDE.md 3.15 (doors v3): no two texts overlap on any door sheet (font size x 0.55 x characters, rotation applied)
    const col = collisionFailures(sheets);
    ok(col.length === 0, `${name}: no overlapping texts on the ${Object.keys(sheets).length} sheets`, describeFailures(col));
    const bad = Object.entries(sheets).filter(([, m]) => !/^<svg|<svg/.test(m) || /NaN|undefined|[\u2013\u2014]/.test(m)).map(([k]) => k);
    ok(bad.length === 0, `${name}: ${Object.keys(sheets).length} sheets render as svg with no NaN / undefined / long dash`, bad.join(', '));
    const dimBad = Object.entries(sheets).map(([k, m]) => [k, checkDimRule(m)]).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.why}`);
    ok(dimBad.length === 0, `${name}: every sheet keeps the dimension rule (width on top, heights right, chains bottom / left)`, dimBad.join(' | '));
    // the leaf sheet prints the glass of the schedule (the glass list rows), every door leaf
    const rows = lists.buildGlassListForWindow(derived, spec);
    const mainRows = rows.filter((r) => r.role === 'main');
    ok(mainRows.length === dr.leaves.length && mainRows.every((r) => sheets.doorleaf.includes(`${fmt(r.width)} × ${fmt(r.height)}`)),
      `${name}: leaf sheet prints the schedule glass ${mainRows.map((r) => `${r.width} × ${r.height}`).join(', ')}`);
    // one glass drawing per unique unit, its size = the schedule rows
    ok(rows.every((r) => groups.some((g) => g.w === r.width && g.h === r.height)) && groups.every((g, i) => sheets[`glass${i}`].includes(`${fmt(g.w)} × ${fmt(g.h)}`)),
      `${name}: glass drawings ${groups.map((g) => `${g.w} × ${g.h}`).join(', ')} = the glass schedule`);
    // the frame sheet layer chain: land 47 and gap 4 (it printed 43 / -43)
    ok(sheets.doorframe.includes(`>${DP.geometry.land}<`) && sheets.doorframe.includes(`>${DP.geometry.gap}<`) && !/>-?43</.test(sheets.doorframe),
      `${name}: frame sheet chain prints land ${DP.geometry.land} and gap ${DP.geometry.gap}, never 43 / -43`);
    // the plan section is a real drawing (it was a placeholder card)
    ok(/<svg/.test(sheets.doorsection) && !/Not drawn yet/.test(sheets.doorsection), `${name}: the plan section is an svg drawing`);
    // the hinge rule from derived
    const nh = dr.leaves[0].hinges.length;
    ok(sheets.doorleaf.includes(`${nh} hinges per leaf`) && nh === (forced || (dr.leafH > DP.hinges.tallAbove ? DP.hinges.perLeafTall : DP.hinges.perLeaf)),
      `${name}: leaf sheet prints ${nh} hinges per leaf (leaf ${dr.leafH}${forced ? `, forced ${forced}` : ''})`);
    if (dr.isFrench) {
      // member codes without the D- prefix on the sheets since 08.10.2026
      ok(/>MS \d/.test(sheets.doorleaf) && !sheets.doorleaf.includes('D-MS') && sheets.doorleaf.includes(`>${DP.elements.leafMeeting.face}<`) && sheets.doorsection.includes(`>${DP.elements.leafMeeting.face}<`),
        `${name}: the meeting stile ${DP.elements.leafMeeting.face} (MS) printed on the leaf sheet and the plan section`);
    }
    if (dr.panels?.length) {
      ok(/>MR \d/.test(sheets.doorleaf) && !sheets.doorleaf.includes('D-MR') && dr.panels.every((pn) => sheets.doorleaf.includes(`panel ${fmt(pn.w)} × ${fmt(pn.h)}`)),
        `${name}: leaf sheet prints MR and the panel ${dr.panels.map((pn) => `${pn.w} × ${pn.h}`).join(', ')}`);
    }
    if (spec.glazing.type === 'triple') ok(sheets.doorleaf.includes(`leaf depth ${DP.leafDepthTriple}`), `${name}: leaf depth ${DP.leafDepthTriple} printed (from the cut list record)`);
    if ((dr.fanLeaves || []).length) ok(dr.fanLeaves.every((_, i) => /<svg/.test(sheets[`doorfan-${i}`]) && sheets[`doorfan-${i}`].includes(`${fmt(dr.fanLeaves[i].w)}`)),
      `${name}: fan leaf sheet drawn at ${dr.fanLeaves.map((f) => `${f.w} × ${f.h}`).join(', ')}`);
    ok(/Threshold: /.test(sheets.elevation), `${name}: the threshold is named on the elevation`);
  }
  // the four reference numbers of the box, read off the rendered leaf sheet
  const leafOf = (k) => render(SH.DoorSheet, { sheet: SH.ddu.doorSheetPlan(SET[k].derived)[1], windowSpec: SET[k].spec, derived: SET[k].derived, projectNumber: 'P-1' });
  // doors v3 (09.10.2026, CLAUDE.md 3.10): every leaf 51 above the floor, glass H 1747 (was 1751), half-glazed 881 (was 883)
  ok(leafOf('single 900 x 2100 outward').includes('633 × 1747'), 'box: single 900 x 2100 leaf sheet prints glass 633 × 1747 (doors v3, was 633 × 1751)');
  ok(leafOf('french lockType double').includes('584 × 1747'), 'box: french 1600 x 2100 leaf sheet prints glass 584 × 1747 (doors v3, was 584 × 1751)');
  ok(leafOf('single half-glazed').includes('633 × 881'), 'box: half-glazed single leaf sheet prints glass 633 × 881 (doors v3, was 633 × 883)');
  // doors v3 additions: the panel outer size (daylight 610 x 772 + 2 x 17), the 2400 case of 3.10
  ok(leafOf('single half-glazed').includes('panel 644 × 806'), 'box: half-glazed leaf sheet prints panel 644 × 806 (daylight + 2 x 17)');
  ok(leafOf('french 2400 x 2400 sides 400 / 400 opening fan 450').includes('618 × 1631'), 'box: french 2400 x 2400 with side panels and a fan: leaf glass 618 × 1631');
  {
    const k = 'french 2400 x 2400 sides 400 / 400 opening fan 450';
    const { sheets } = sheetsOf(SET[k].spec, SET[k].derived);
    ok(sheets['doorside-left'].includes('227 × 1661') && sheets['doorside-right'].includes('227 × 1661'), `box: ${k}: side light sheets print glass 227 × 1661`);
    ok(sheets.doorframe.includes('M1 2323') && sheets.doorframe.includes('T1 340.5') && sheets.doorframe.includes('T2 1574.5'), `box: ${k}: frame sheet prints the mullion M1 2323 and the transom segments T1 340.5 / T2 1574.5`);
    ok(sheets.doorframe.includes('T 450') && sheets.elevation.includes('T 450'), `box: ${k}: the transom axis T 450 on the frame sheet and the elevation`);
    const f = 'french 2400 x 2400 sides 400 / 400 fixed fan 450';
    const fx = sheetsOf(SET[f].spec, SET[f].derived).sheets;
    ok(Object.keys(fx).filter((x) => x.startsWith('doorfan-')).every((x) => /Fixed Fanlight/.test(fx[x]) && !/Hinges:|Lock:/.test(fx[x])), `box: ${f}: every fan sheet is a Fixed Fanlight with no hinge / lock line`);
    const inw = sheetsOf(SET['single inward aluminium (ignored)'].spec, SET['single inward aluminium (ignored)'].derived).sheets;
    ok(['doorframe', 'elevation', 'doorsection'].every((x) => inw[x].includes('inward door: timber threshold')), 'box: inward + stored aluminium: "inward door: timber threshold" on the frame sheet, the elevation and the section');
    const all = RUNS.flatMap((r) => Object.values(r.sheets)).join('\n');
    ok(!/anti-clockwise|clockwise closing|\bLH\b|\bRH\b|coupling post/i.test(all), 'no Winkhaus handing words and no coupling post on any door sheet (doors v3, CLAUDE.md 3.8)');
  }
}

console.log(`\n${passes} pass, ${fails} fail`);
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
