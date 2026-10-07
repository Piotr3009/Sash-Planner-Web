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
 *   7  pre-cut: one assigned material = one group; unassigned never 63x63
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
 *
 * Run: node verify/parity/t41_doors_production.mjs [start]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  ok(DP.schema === 2, `schema ${DP.schema}`);
  ok(DP.frameDepth === 93 && e.frameHead.face === 68 && e.frameJamb.face === 68 && e.frameCill.face === 68 && e.transomRail.face === 68,
    'frame: depth 93, head / jamb / cill / transom rail face 68 (box item 1)');
  ok(g.land === 47 && g.rebate === 21 && g.gap === 4 && g.gapCill === 6 && g.cillVisible === 41 && g.glassInset === 11.5 && g.glazingRebate === 18,
    'geometry: land 47, rebate 21, gap 4, gapCill 6, cillVisible 41, glassInset 11.5, glazingRebate 18');
  ok(d.leafAtJamb === 51 && d.leafFullHeight === 98 && d.leafNoThreshold === 57, 'deductions: leafAtJamb 51, leafFullHeight 98, leafNoThreshold 57 (box items 5 and 6)');
  ok(DP.leafDepth === 57 && DP.leafDepthTriple === 61, 'leaf depth 57, 61 with a triple unit (box item 4)');
  ok(e.leafStile.face === 94 && e.leafTop.face === 94 && e.leafBottom.face === 180 && e.leafMid.face === 94 && e.leafMeeting.face === 100,
    'leaf faces: stile 94, top 94, bottom 180, mid 94, meeting 100 (box item 4)');
  ok(DP.frenchLip === 6 && DP.frenchClearance === undefined, 'frenchLip 6; no centre clearance set (owner: later)');
  ok(DP.cillInward.faceInternal === 40 && DP.cillInward.faceExternal === 35, 'inward cill 40 -> 35 (box item 2)');
  ok(DP.couplingPost.width === 136 && DP.sidePanel.member === 57 && DP.sidePanel.depth === 57, 'coupling post 136, side panel members 57 x 57 (unchanged)');
  ok(d.fanAtHead === 51 && d.fanAtRail === 51, 'opening fanlight: 51 at the head, 51 at the rail (box item 11)');
  ok(DP.hinges.perLeaf === 3 && DP.hinges.perLeafTall === 4 && DP.hinges.tallAbove === 2100, 'hinges 3 per leaf, 4 above 2100 (box item 12)');
  ok(DP.panel.boardThickness === 18 && DP.panel.boards === 2 && DP.panel.coreThickness === 18, 'panel 2 x 18 Tricoya + 18 core (box item 10)');
  const h = DP.hardware;
  ok(h.doorThickness === 56 && h.backset === 45 && h.faceplate === 'radius' && h.keeps === 'full length' && h.fgteShootbolts === 'slave' && h.fgteSlaveBackset === 45 && h.fgteCentreLine === 22 && h.cillKeep === 'yes',
    'hardware defaults: thickness 56, backset 45, radius, full length keeps, FGTE slave, slave backset 45, centre line 22, cill keep yes');
  ok(d.leafAtJamb === g.land + g.gap, 'identity: leafAtJamb = land + gap');
  ok(d.leafFullHeight === d.leafAtJamb + g.gapCill + g.cillVisible, 'identity: leafFullHeight = leafAtJamb + gapCill + cillVisible = 47 + 4 + 6 + 41');
  ok(d.leafNoThreshold === d.leafAtJamb + g.gapCill, 'identity: leafNoThreshold = leafAtJamb + gapCill = 47 + 4 + 6');
  ok(g.land + g.rebate === e.frameJamb.face, 'identity: land + rebate = frame face');
  ok(e.leafMeeting.face === e.leafStile.face + DP.frenchLip, 'identity: meeting stile = stile + lip');
  const cg = CP.geometry, ce = CP.elements;
  ok(g.land === cg.land && g.rebate === cg.rebate && g.gap === cg.gap && g.gapCill === cg.gapCill && g.cillVisible === cg.cillVisible && g.glassInset === cg.glassInset && g.glazingRebate === cg.glazingRebate
    && d.leafAtJamb === CP.deductions.leafAtJamb && d.leafFullHeight === CP.deductions.leafFullHeight && DP.leafDepth === CP.leafDepth && DP.leafDepthTriple === CP.leafDepthTriple
    && DP.frameDepth === CP.frameDepth && e.frameHead.face === ce.frameHead.face && e.frameJamb.face === ce.frameJamb.face && e.frameCill.face === ce.frameCill.face,
    'as casement: land, rebate, gap, gapCill, cillVisible, glassInset, glazingRebate, leafAtJamb, leafFullHeight, leaf depths, frame depth and faces equal the casement profile');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - single door 900 x 2100');
const S = door(900, 2100);
{
  const dr = S.derived.door, lf = dr.leaves[0];
  ok(lf.w === 798 && lf.h === 2002 && dr.leafW === 798 && dr.leafH === 2002, `leaf ${lf.w} x ${lf.h} = (900 - 2 x 51) x (2100 - 98) = 798 x 2002`);
  const sl = rec(S.derived, 'D-STILE (L)'), sr = rec(S.derived, 'D-STILE (R)'), tr = rec(S.derived, 'D-TOP RAIL'), br = rec(S.derived, 'D-BOTTOM RAIL');
  ok(sl?.section === '94x57' && sl.length === 2002 && sr?.section === '94x57' && sr.length === 2002, 'stiles 94x57 L2002 (both)');
  ok(tr?.section === '94x57' && tr.length === 798, 'top rail 94x57 L798');
  ok(br?.section === '180x57' && br.length === 798, 'bottom rail 180x57 L798');
  ok(!rec(S.derived, 'D-MEETING STILE') && !rec(S.derived, 'D-MID RAIL'), 'single full glass: no meeting stile, no mid rail');
  const u = S.derived.customGlassUnits;
  ok(u.length === 1 && u[0].width === 633 && u[0].height === 1751, `glass ${u[0]?.width} x ${u[0]?.height} = (798 - 2 x 82.5) x (2002 - 82.5 - 168.5) = 633 x 1751`);
  ok(S.spec.glazing.makeup === '6x12x6' && S.spec.glazing.thickness === 24, `makeup ${S.spec.glazing.makeup}, thickness ${S.spec.glazing.thickness}`);
  const gl = lists.buildGlassListForWindow(S.derived, S.spec);
  ok(gl.length === 1 && gl[0].width === 633 && gl[0].height === 1751 && gl[0].makeup === '6x12x6', 'glass schedule row 633 x 1751, 6x12x6');
  ok(S.spec.frame.depth === 93, `frame depth ${S.spec.frame.depth} (the door profile, never the sash box)`);
  const sp164 = specification.normaliseToWindowSpec({ id: 'y', name: 'Y', width: 900, height: 2100, frameDepth: 164 }, { fullConfig: { windowCategory: 'door' } });
  ok(sp164.frame.depth === 93, 'a door saved with the sash box depth 164 still reads 93');
  ok(rec(S.derived, 'D-FRAME HEAD')?.section === '68x93' && rec(S.derived, 'D-FRAME JAMB (L)')?.length === 2100 && rec(S.derived, 'D-FRAME CILL')?.section === '68x93',
    'frame head 68x93 L900, jambs L2100, cill 68x93 (outward, the casement cill)');
  const inw = door(900, 2100, { doorOpenDirection: 'inward' });
  ok(inw.derived.door.leaves[0].w === 798 && inw.derived.door.leaves[0].h === 2002, 'inward: the same leaf 798 x 2002 (H - 98 in both directions, box item 6)');
  const ic = rec(inw.derived, 'D-FRAME CILL (INWARD)');
  ok(ic?.section === '40x93' && !rec(inw.derived, 'D-FRAME CILL'), 'inward cill: its own element, 40x93 (unrebated, 40 -> 35)');
  for (const thr of ['aluminium', 'low-profile']) {
    const x = door(900, 2100, { thresholdType: thr });
    ok(x.derived.door.leaves[0].h === 2043 && !recs(x.derived, 'D-FRAME CILL').length && !recs(x.derived, 'D-FRAME CILL (INWARD)').length,
      `${thr} threshold: no timber cill, leaf H 2100 - 57 = ${x.derived.door.leaves[0].h}`);
    ok(x.derived.customGlassUnits[0].height === 1792, `${thr}: glass H 2043 - 251 = ${x.derived.customGlassUnits[0].height}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - french door 1600 x 2100');
const F = french(1600, 2100);
{
  const dr = F.derived.door;
  ok(dr.half === 749 && dr.leafW === 755 && dr.leafH === 2002, `half ${dr.half} = (1600 - 102) / 2, leaf ${dr.leafW} x ${dr.leafH} = half + 6`);
  ok(dr.leaves.length === 2 && dr.leaves.every((l) => l.w === 755 && l.h === 2002), 'two leaves 755 x 2002');
  ok(dr.leaves[0].x === 51 && dr.leaves[1].x === 1600 - 51 - 755, `leaves at x 51 and ${1600 - 51 - 755}: each 6 past the centre line ${dr.zones.meetingX}`);
  ok(dr.zones.meetingX === 800 && dr.leaves[0].x + 755 - 800 === 6 && 800 - dr.leaves[1].x === 6, 'meetingX 800, lip 6 each side');
  const ms = recs(F.derived, 'D-MEETING STILE');
  ok(ms.length === 2 && ms.every((r) => r.section === '100x57' && r.length === 2002 && r.code === 'D-MS'), 'meeting stile 100x57 L2002, one per leaf, code D-MS');
  const hs = [...recs(F.derived, 'D-STILE (L)'), ...recs(F.derived, 'D-STILE (R)')];
  ok(hs.length === 2 && hs.every((r) => r.section === '94x57' && /^hinge/.test(r.notes)), 'one hinge stile 94x57 per leaf, noted hinge');
  ok(recs(F.derived, 'D-TOP RAIL').every((r) => r.length === 755) && recs(F.derived, 'D-BOTTOM RAIL').every((r) => r.length === 755 && r.section === '180x57'), 'rails the full leaf width 755');
  const u = F.derived.customGlassUnits;
  ok(u.length === 2 && u.every((g) => g.width === 584 && g.height === 1751), `glass ${u.map((g) => `${g.width} x ${g.height}`).join(', ')} = 755 - 82.5 - 88.5`);
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
  ok(l.midRail?.axis === 1001, `half-glazed: mid rail axis ${l.midRail?.axis} = leaf H / 2`);
  const mr = rec(H.derived, 'D-MID RAIL');
  ok(mr?.section === '94x57' && mr.length === 798 && mr.code === 'D-MR', 'D-MID RAIL 94x57 L798, code D-MR');
  const u = H.derived.customGlassUnits;
  ok(u.length === 1 && u[0].width === 633 && u[0].height === 883, `glass ${u[0].width} x ${u[0].height} = (1001 - 47) - 94 + 23 = 883`);
  const pn = H.derived.door.panels;
  ok(pn.length === 1 && pn[0].w === 633 && pn[0].h === 797, `panel ${pn[0]?.w} x ${pn[0]?.h} = (2002 - 180) - (1001 + 47) + 23 = 797`);
  ok(!u.some((g) => g.height === 797), 'the panel is not a glass unit');
  ok(near(H.derived.consumables.glass.sqm, Math.round(633 * 883 / 1e6 * 100) / 100), `glass m2 ${H.derived.consumables.glass.sqm} = the glass only`);
  const T = door(900, 2100, { doorStyle: 'three-quarter' });
  const tu = T.derived.customGlassUnits[0], tp = T.derived.door.panels[0];
  ok(T.derived.door.leaves[0].midRail.axis === 1501.5, 'three-quarter: axis 0.75 x 2002 = 1501.5 from the top');
  ok(tu.width === 633 && tu.height === 1383.5, `three-quarter glass ${tu.width} x ${tu.height}`);
  ok(tp.w === 633 && tp.h === 296.5, `three-quarter panel ${tp.w} x ${tp.h}`);
  const q = pq(H);
  const area = 633 * 797 / 1e6;
  ok(near(q.d_panel_tricoya_18?.qty, Math.round(2 * area * 10000) / 10000) && near(q.d_panel_mdf_core?.qty, Math.round(area * 10000) / 10000),
    `panel boards: Tricoya ${q.d_panel_tricoya_18?.qty} m2 = 2 x ${R1(area * 1000) / 1000}, core ${q.d_panel_mdf_core?.qty} m2 = 1 x`);
  ok(pn[0].thickness === 54, 'panel build 18 + 18 + 18 = 54 (flagged in BLOCKERS: in the 11.5 rebate with the 24 unit)');
  const FH = french(1600, 2100, { doorStyle: 'half-glazed' });
  ok(recs(FH.derived, 'D-MID RAIL').length === 2 && FH.derived.door.panels.length === 2 && FH.derived.customGlassUnits.every((g) => g.width === 584 && g.height === 883),
    'french half-glazed: two mid rails, two panels, glass 584 x 883');
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
  const tall = door(900, 2150 + 98);
  ok(tall.derived.door.leafH === 2150 && sum(tall).d_hinges === 4, `leaf 2150: ${sum(tall).d_hinges} hinges`);
  const edge = door(900, 2100 + 98);
  ok(edge.derived.door.leafH === 2100 && sum(edge).d_hinges === 3, 'leaf exactly 2100: 3 hinges (4 only when taller)');
  ok(sum(french(1600, 2150 + 98)).d_hinges === 8, 'french with leaves of 2150: 8 hinges');
  ok(JSON.stringify(S.derived.door.leaves[0].hinges.map((y) => R1(y - S.derived.door.leaves[0].y))) === JSON.stringify([200, 901, 1852]),
    'hinge centres from the leaf top: 200, 2002 / 2 - 100 = 901, 2002 - 150 = 1852');
  ok(tall.derived.door.leaves[0].hinges.length === 4, '4 hinge positions on the tall leaf');
  const fg = f2.derived.door.hardware.fgte;
  ok(fg?.family === 'slave' && fg.band?.lo === 1965 && fg.band?.hi === 2161, `FGTE band for leaf 2002: ${fg?.band?.lo}-${fg?.band?.hi} (slave shootbolts only, default)`);
  ok(LIVE.doorHw.fgteBand(2002, 'both') === null && LIVE.doorHw.fgteBand(2150, 'both')?.lo === 2108, 'master and slave family: no band for 2002, 2108-2161 for 2150');
  ok(LIVE.doorHw.fgteBand(1818, 'slave')?.lo === 1818 && LIVE.doorHw.fgteBand(3061, 'slave')?.hi === 3061 && LIVE.doorHw.fgteBand(3062, 'slave') === null, 'band edges inclusive, beyond 3061 none');
  const det = (x, item) => x.derived.door.hardware.detail.find((l) => l.item === item);
  ok(/keyed alike/.test(det(f2, 'Door cylinder')?.detail || ''), 'FGTE pair: cylinders keyed alike');
  ok(/1965-2161/.test(det(f2, 'Multipoint lock, double door kit')?.detail || '') && /slave backset 45/.test(det(f2, 'Multipoint lock, double door kit').detail) && /centre line 22/.test(det(f2, 'Multipoint lock, double door kit').detail) && /cill option yes/.test(det(f2, 'Multipoint lock, double door kit').detail),
    'FGTE detail: band, slave backset, centre line, cill keep');
  const tb = det(S, 'Multipoint lock, single door kit')?.detail || '';
  ok(/RH \(clockwise closing\)/.test(tb) && /door thickness 56/.test(tb) && /backset 45/.test(tb) && /faceplate radius/.test(tb) && /keeps full length/.test(tb),
    `ThunderBolt detail: ${tb}`);
  ok(S.derived.door.hardware.handing === 'RH', 'outward, open left (hinges right from outside): RH, clockwise closing');
  ok(door(900, 2100, { doorHinge: 'right' }).derived.door.hardware.handing === 'LH', 'outward, open right: LH');
  ok(door(900, 2100, { doorOpenDirection: 'inward' }).derived.door.hardware.handing === 'LH', 'inward, open left (hinges left from inside): LH, anti-clockwise closing');
  ok(LIVE.doorHw.HANDING_WORDS.LH === 'anti-clockwise closing' && LIVE.doorHw.HANDING_WORDS.RH === 'clockwise closing', 'Winkhaus words');
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
  const hw = lists.buildHardwareList(S.spec, S.derived);
  ok(hw.length === 4 && hw.every((l) => l.enginePart === true), 'hardware lines: every door line is an engine part (its count is an Assign Materials row)');
  ok(!lists.buildHardwareList(S.spec, S.derived).some((l) => /trickle/i.test(l.item)), 'no trickle vent line on a door (BLOCKERS 5.8)');
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
  ok(q.d_leaf_stile?.mm === 2 * (2002 + 20) && q.d_leaf_top_rail?.mm === 818 && q.d_leaf_bottom_rail?.mm === 818 && q.d_frame_jamb?.mm === 2 * 2120 && q.d_frame_head?.mm === 920 && q.d_frame_cill?.mm === 920,
    'timber via the pre-cut lengths (+20 machining): stiles 2 x 2022, rails 818, jambs 2 x 2120, head 920, cill 920');
  const qf = pq(F);
  ok(qf.d_leaf_meeting_stile?.mm === 2 * 2022 && qf.d_leaf_stile?.mm === 2 * 2022, 'french: meeting stiles 2 x 2022 on their own row, hinge stiles 2 x 2022');
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
  ok(['D-FRAME HEAD', 'D-FRAME JAMB (L)', 'D-COUPLING POST', 'D-FRAME CILL', 'D-STILE (L)', 'D-MEETING STILE', 'D-TOP RAIL', 'D-BOTTOM RAIL', 'D-MID RAIL', 'D-SIDE STILE'].every((n) => all.includes(n)),
    'the group holds frame, post, cill, stiles, meeting stile, rails, mid rail, side panel members');
  const un = lists.buildPrecutForWindow(F.derived, F.spec, {}, null);
  const secs = un.sashEngineering.map((g) => g.section);
  ok(!secs.includes('63x63') && secs.includes('94x57') && secs.includes('100x57') && secs.includes('180x57') && un.boxSapele.length === 0,
    `unassigned: by finished section (${secs.join(', ')}), never the sash 63x63, frame members in the same list`);
  const sel = bom.assignedMaterialForItems(pre.sashEngineering[0].items, { assignments: LIVE.partRegistry.expandAssignments(data), assignmentsData: data, materials });
  ok(sel?.id === 'oak', 'the pre-cut group header names the assigned material');
  const sym = (n) => LIVE.partSymbols.getPartSymbol(n).symbol;
  ok(['D-FRAME HEAD', 'D-FRAME JAMB (L)', 'D-FRAME CILL', 'D-COUPLING POST', 'D-TRANSOM', 'D-MEETING STILE', 'D-MID RAIL', 'D-SIDE STILE', 'D-SIDE TOP RAIL', 'D-SIDE BOTTOM RAIL', 'D-FAN STILE (L)', 'D-FAN TOP RAIL', 'D-FAN BOTTOM RAIL'].map(sym).join(' ')
    === 'DFH DFJ DFC DCP DTR DMS DMR DSS DST DSB DFS DFT DFB', 'part symbols DFH DFJ DFC DCP DTR DMS DMR DSS DST DSB DFS DFT DFB');
  const col = (n) => LIVE.partColours.partColourForElement(n)?.id;
  ok(['D-FRAME HEAD', 'D-FRAME JAMB (R)', 'D-FRAME CILL', 'D-COUPLING POST', 'D-TRANSOM', 'D-STILE (L)', 'D-MEETING STILE', 'D-TOP RAIL', 'D-MID RAIL', 'D-BOTTOM RAIL', 'D-SIDE STILE', 'D-FAN TOP RAIL'].every((n) => col(n)?.startsWith('door_')),
    'every door part has a door colour group');
  ok(LIVE.partColours.PART_COLOUR_GROUPS.filter((g) => g.family === 'frame' || g.family === 'leaf').every((g) => !g.id.startsWith('door_')), 'the casement key families stay casement only');
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - cut list');
{
  const cut = lists.buildCutListForWindow(F.derived, F.spec).map((r) => ({ ...r, windowName: 'F1' }));
  const g = lists.buildGroupedCutList(cut);
  const by = (s) => g.find((x) => x.symbol === s);
  ok(by('D-ST-L/R')?.rows.length === 1 && by('D-ST-L/R').rows[0].qty === 2 && /hinge \(passive\)/.test(by('D-ST-L/R').rows[0].notes) && /hinge \(active\)/.test(by('D-ST-L/R').rows[0].notes),
    `french hinge stiles: one row x2, notes "${by('D-ST-L/R')?.rows[0]?.notes}"`);
  ok(by('D-MS')?.rows[0]?.qty === 2 && /meeting \(passive\)/.test(by('D-MS').rows[0].notes) && /meeting \(active\)/.test(by('D-MS').rows[0].notes), `meeting stiles: one row x2, notes "${by('D-MS')?.rows[0]?.notes}"`);
  ok(by('D-TR')?.rows[0]?.qty === 2 && /passive/.test(by('D-TR').rows[0].notes) && /active/.test(by('D-TR').rows[0].notes), 'top rails: one row x2, active and passive noted');
  ok(!g.some((x) => x.symbol === '?'), 'no door element falls into the "?" safety net');
  const cas = mk(LIVE, 1000, 1200, { windowCategory: 'casement', casementLayout: '040L' });
  const gc = lists.buildGroupedCutList(lists.buildCutListForWindow(cas.derived, cas.spec).map((r) => ({ ...r, windowName: 'C1' })));
  ok(gc.every((x) => x.rows.every((r) => !('notes' in r))), 'casement groups unchanged: no notes key');
  const H = french(1600, 2100, { doorStyle: 'half-glazed', transomType: 'opening', transomHeight: 450 });
  const gh = lists.buildGroupedCutList(lists.buildCutListForWindow(H.derived, H.spec).map((r) => ({ ...r, windowName: 'H1' })));
  ok(['D-MR', 'D-FS-L/R', 'D-FTR', 'D-FBR'].every((s) => gh.some((x) => x.symbol === s)), 'mid rail and fan leaf groups present');
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - fanlight');
{
  const O = french(1600, 2100, { transomType: 'opening', transomHeight: 450 });
  const fl = O.derived.door.fanLeaves;
  ok(fl.length === 1 && fl[0].w === 1498 && fl[0].h === 348, `opening fan leaf ${fl[0]?.w} x ${fl[0]?.h} = (1600 - 102) x (450 - 51 - 51)`);
  const cS = CP.elements.leafStile.face, cT = CP.elements.leafTop.face, cB = CP.elements.leafBottom.face;
  ok(cS === 64 && cT === 64 && cB === 67, 'casement leaf faces 64 / 64 / 67');
  ok(recs(O.derived, 'D-FAN STILE (L)')[0]?.section === '64x57' && recs(O.derived, 'D-FAN STILE (R)')[0]?.length === 348 && rec(O.derived, 'D-FAN TOP RAIL')?.section === '64x57' && rec(O.derived, 'D-FAN BOTTOM RAIL')?.section === '67x57' && rec(O.derived, 'D-FAN BOTTOM RAIL').length === 1498,
    'fan members 64x57 / 64x57 / 67x57 at the full leaf dimensions');
  ok(['D-FAN STILE (L)', 'D-FAN STILE (R)', 'D-FAN TOP RAIL', 'D-FAN BOTTOM RAIL'].map((n) => bom.ELEMENT_TO_PART_ID[n]).join(' ') === 'c_sash_stile c_sash_stile c_sash_top_rail c_sash_bottom_rail', 'fan members buy the casement leaf timber');
  const ded = profile.casementGlassDeductions(CP);
  const fg = O.derived.customGlassUnits.find((u) => u.role === 'fanlight');
  ok(fg.width === 1498 - ded.width && fg.height === 348 - ded.height, `fan glass ${fg.width} x ${fg.height} = leaf - ${ded.width} / ${ded.height} (casement rule)`);
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
  ok(xg.width === 1487 && xg.height === 337 && !X.derived.door.fanLeaves.length && !recs(X.derived, 'D-FAN TOP RAIL').length, 'fixed fanlight: glass 1487 x 337 in the frame, no leaf (as before)');
  ok(rec(X.derived, 'D-TRANSOM')?.section === '68x93' && rec(X.derived, 'D-TRANSOM').length === 1600 - 136 && rec(X.derived, 'D-FRAME JAMB (L)').length === 2550, 'transom rail 68x93 L1464, jambs 2550');
  ok(!/pending/.test(JSON.stringify(O.derived.customGlassUnits)), 'no "64 sash pending" label left');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - side panels and bars');
{
  const P = french(1600, 2100, { sidePanels: 'both', sideLeftWidth: 500, sideRightWidth: 500, sideHBars: 1, sideVBars: 1 });
  const pl = P.derived.door.panelLeaves;
  ok(pl.length === 2 && pl.every((p) => p.w === 398 && p.h === 2002), 'side panel leaves 500 - 102 = 398 x 2002');
  ok(recs(P.derived, 'D-SIDE STILE').every((r) => r.section === '57x57' && r.quantity === 2) && rec(P.derived, 'D-COUPLING POST')?.quantity === 2, 'side panel members 57x57 (unchanged), two coupling posts');
  const sg = P.derived.customGlassUnits.filter((u) => u.role === 'side');
  ok(sg.length === 2 && sg.every((u) => u.width === 307 && u.height === 1911 && u.bars.h === 1 && u.bars.v === 1), 'side panel glass 307 x 1911, bars 1 H x 1 V from sidePanels.barsH / barsV');
  const B = door(900, 2100, { doorHBars: 2, doorVBars: 1 });
  const ub = B.derived.customGlassUnits[0].bars;
  ok(ub.h === 2 && ub.v === 1 && ub.x.length === 1 && ub.y.length === 2, `door bars on the unit: ${JSON.stringify(ub)}`);
  ok(near(ub.x[0], 633 / 2), `vertical bar on the unit centre line (${ub.x[0]})`);
  const row = lists.buildGlassListForWindow(B.derived, B.spec)[0];
  ok(row.bars === '2H × 1V astragal' && row.barsH === 2 && row.barsV === 1, `glass order row: ${row.bars}`);
  const day = B.derived.door.leaves[0].daylight;
  const barRun = 2 * 633 + 1 * 1751;
  ok(rec(B.derived, 'C-TRIANGLE BEADING (EXT)')?.length === Math.round(barRun * 1.15) && rec(B.derived, 'C-GEORGIAN MIDDLE BEADING')?.length === Math.round(barRun * 1.15),
    `astragal beads ext / int = (2 x 633 + 1751) x 1.15 = ${Math.round(barRun * 1.15)} on the casement rows`);
  ok(!rec(door(900, 2100, { doorHBars: 2, doorVBars: 1, doorBarType: 'georgian' }).derived, 'C-TRIANGLE BEADING (EXT)'), 'internal georgian bars: no astragal bead');
  ok(day.w === 610 && day.h === 1728, 'daylight 610 x 1728 (unit less 2 x 11.5)');
  const M = french(1600, 2100, { doorVBars: 1, transomType: 'fixed', transomHeight: 450, transomBars: 'match' });
  const fanBars = M.derived.customGlassUnits.find((u) => u.role === 'fanlight').bars;
  const doorX = M.derived.door.leaves.flatMap((l) => l.bars.frame.vBars.map((b) => b.cx));
  const fanX = M.derived.door.zones.transom.fanPanes[0].bars.frame.vBars.map((b) => b.cx);
  ok(fanBars.v === 3 && fanBars.h === 0 && doorX.every((x) => fanX.includes(x)) && fanX.includes(800), `transom bars 'match': the door verticals continue into the fan (+ the meeting line): ${fanX.join(', ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════
section('11 - weights, seals, beading, consumables by hand');
{
  const kg = profile.kgPerM;
  const timber = 2 * kg(94, 57) * 2.002 + kg(94, 57) * 0.798 + kg(180, 57) * 0.798;
  const glass = 0.633 * 1.751 * 30;
  const w = R1((timber + glass) * 1.05);
  ok(S.derived.door.leaves[0].weightKg === w, `single leaf weight ${S.derived.door.leaves[0].weightKg} kg = (timber ${R1(timber)} + glass ${R1(glass)} at 30 kg/m2) x 1.05 = ${w}`);
  ok(S.derived.weights.total > 0 && S.derived.weights.timber > 0 && S.derived.weights.glass > 0, `derived.weights ${JSON.stringify(S.derived.weights)}`);
  const c = S.derived.consumables;
  ok(c.sealFrame.meters === Math.round((2 * 2002 + 2 * 798) * 1.1 / 1000 * 100) / 100 && c.sealHeadJambs.meters === Math.round((2 * 2002 + 798) * 1.1 / 1000 * 100) / 100,
    `seals per leaf x 1.10: frame ${c.sealFrame.meters} m, head & jambs ${c.sealHeadJambs.meters} m`);
  const perim = 2 * (633 + 1751);
  ok(rec(S.derived, 'D-GLAZING BEADING')?.length === Math.round(perim * 1.15), `glazing bead = ${perim} x 1.15 on the door bead row`);
  ok(c.silicone.tubes === Math.round(0.1 * perim / 1000 * 10) / 10 && c.beadTapeSide.meters === Math.round(perim / 1000 * 100) / 100, `silicone ${c.silicone.tubes} tubes, bead tape ${c.beadTapeSide.meters} m per face`);
  const P = french(1600, 2100, { sidePanels: 'left', sideLeftWidth: 500, transomType: 'opening', transomHeight: 450 });
  const L = [...P.derived.door.leaves, ...P.derived.door.panelLeaves, ...P.derived.door.fanLeaves];
  ok(L.length === 5 && P.derived.consumables.sealFrame.meters === Math.round(L.reduce((a, l) => a + 2 * l.h + 2 * l.w, 0) * 1.1 / 1000 * 100) / 100,
    'seals over the door leaves, the side panel leaf and both fan leaves (one per frame)');
  const H = door(900, 2100, { doorStyle: 'half-glazed' });
  ok(rec(H.derived, 'D-GLAZING BEADING').length === Math.round((2 * (633 + 883) + 2 * (633 + 797)) * 1.15), 'half-glazed: the panel is beaded in the same rebate (pane + panel perimeters x 1.15)');
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
  ok(m.schema === 2 && m.leafDepth === 57 && m.geometry.land === 47 && m.geometry.rebate === 21 && m.deductions.leafAtJamb === 51 && m.deductions.leafFullHeight === 98 && m.deductions.leafNoThreshold === 57,
    'schema-1 copy: every old default moves (57 / 47 / 21 / 51 / 98 / 57)');
  ok(m.elements.leafMeeting.face === 100 && m.frenchLip === 6 && m.elements.transomRail.face === 68 && m.leafDepthTriple === 61 && m.hinges.perLeaf === 3 && m.hardware.backset === 45 && m.deductions.fanAtRail === 51,
    'missing keys filled: meeting 100, lip 6 (from frenchOverlap), transom rail 68 (from transom.rail), triple 61, hinges, hardware, fan rule');
  ok(JSON.stringify({ ...m }) === JSON.stringify({ ...mig(clone(D)) }) || ['schema', 'leafDepth', 'geometry', 'deductions', 'elements', 'frenchLip'].every((k) => JSON.stringify(m[k]) === JSON.stringify(D[k])),
    'a migrated schema-1 default equals today\'s default on every number the engine reads');
  const hand = clone(old); hand.geometry.land = 45; hand.deductions.leafAtJamb = 49; hand.leafDepth = 60; hand.frenchOverlap = 8; hand.transom = { rail: 70 };
  const mh = mig(hand);
  ok(mh.geometry.land === 45 && mh.deductions.leafAtJamb === 49 && mh.leafDepth === 60 && mh.frenchLip === 8 && mh.elements.transomRail.face === 70 && mh.deductions.leafFullHeight === 98,
    'hand edits stay (land 45, leafAtJamb 49, leaf 60, lip 8, rail 70); untouched old defaults still move');
  const s2 = clone(D); s2.geometry.land = 43; s2.deductions.leafAtJamb = 47;
  const m2 = mig(s2);
  ok(m2.geometry.land === 43 && m2.deductions.leafAtJamb === 47, 'a schema-2 copy is never migrated: 43 / 47 there are hand edits');
  ok(mig(null) === null && mig({}).schema === 2 && mig({}).deductions.leafAtJamb === 51, 'empty copy: the default');
  // withProfiles: the door snapshot is used inside and restored after; the 3-argument call still works
  const snap = clone(D); snap.deductions.leafAtJamb = 61;
  const inside = profile.withProfiles(null, null, snap, () => door(900, 2100).derived.door.leafW);
  ok(inside === 900 - 122 && door(900, 2100).derived.door.leafW === 798, `withProfiles(sash, casement, door, fn): leaf ${inside} with the snapshot, 798 after`);
  ok(profile.withProfiles(null, null, () => door(900, 2100).derived.door.leafW) === 798, 'withProfiles(sash, casement, fn): the live door profile');
  profile.setActiveDoorProfile(old);
  ok(profile.getDoorProfile().deductions.leafAtJamb === 51 && profile.getDoorProfile().schema === 2, 'setActiveDoorProfile migrates a stored schema-1 copy');
  profile.setActiveDoorProfile(null);
  ok(profile.getDoorProfile() === DP, 'setActiveDoorProfile(null): the default again');
}

// ═════════════════════════════════════════════════════════════════════════════
section('14 - the profile store');
{
  const S0 = LIVE.profileStore.useWindowProfileStore;
  const st = S0.getState();
  ok(st.door && st.door.schema === 2 && st.door.deductions.leafAtJamb === 51, 'windowProfileStore holds the door profile (door key)');
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
    'd_threshold_alu_single', 'd_threshold_alu_double', 'd_threshold_low_single', 'd_threshold_low_double'];
  ok(want.every((id) => ids.includes(id)) && store.DOOR_ALL_PARTS.length === want.length, `the ${want.length} door rows of the brief, nothing else`, want.filter((id) => !ids.includes(id)).join(', '));
  ok(new Set(ids).size === ids.length, 'no duplicate ids in ALL_PARTS');
  const firstD = ids.findIndex((id) => id.startsWith('d_')), lastC = ids.map((id) => id.startsWith('c_')).lastIndexOf(true);
  ok(firstD > lastC && JSON.stringify(ids.slice(0, firstD)) === JSON.stringify(START.store.ALL_PARTS.map((p) => p.id)), 'door rows appended after every existing row (index-based sets keep their rows)');
  const byId = Object.fromEntries(store.ALL_PARTS.map((p) => [p.id, p]));
  ok(byId.d_frame_head.section === '68×93' && byId.d_frame_cill_inward.section === '40×93' && byId.d_coupling_post.section === '136×93' && byId.d_leaf_meeting_stile.section === '100×57' && byId.d_leaf_bottom_rail.section === '180×57' && byId.d_side_stile.section === '57×57',
    'section labels with the multiplication sign, from the door profile');
  ok(store.DOOR_PARTS.ironmongery.every((p) => p.hint && p.defaultCategory) && /3 hinges, 4 when the leaf is taller than 2100/.test(byId.d_hinges.hint), 'ironmongery rows carry the counting rule (hint) and their catalogue tab');
  ok(!JSON.stringify(store.DOOR_ALL_PARTS).match(/[–—]/), 'no en / em dash in the door rows');
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
  ok(l('part:d_lock_single_kit')?.qty === 1 && l('part:d_handle_set')?.qty === 1, 'rows without a slot product stay on their row');
  ok(!lines.some((x) => x.line), 'no hardware line counted twice (door lines are engine parts)');
  const det = bom.windowHardwareDetailRows(spec, null, IRN, S.derived);
  ok(det.some((r) => r.item === 'Winkhaus hinge' && /weight for information/.test(r.detail)) && det.every((r) => !('assigned' in r)), 'BOM PDF detail: the slot product name with the engine detail');
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
    ok(JSON.stringify(a.derived) === JSON.stringify(b.derived), `${name}: derived deep-equal to START`);
    // every windowSpec carries the door defaults block; on a window only its informational
    // leafDepth moved (61 -> 57, the door profile), nothing reads it outside a door
    const noDoor = (x) => { const c = clone(x); delete c.door; return c; };
    ok(JSON.stringify(noDoor(a.spec)) === JSON.stringify(noDoor(b.spec)) && JSON.stringify({ ...a.spec.door, leafDepth: 0 }) === JSON.stringify({ ...b.spec.door, leafDepth: 0 }),
      `${name}: windowSpec equal to START but for the door block's informational leafDepth (${b.spec.door.leafDepth} -> ${a.spec.door.leafDepth})`);
    ok(JSON.stringify(lists.buildCutListForWindow(a.derived, a.spec)) === JSON.stringify(START.lists.buildCutListForWindow(b.derived, b.spec))
      && JSON.stringify(lists.buildGlassListForWindow(a.derived, a.spec)) === JSON.stringify(START.lists.buildGlassListForWindow(b.derived, b.spec))
      && JSON.stringify(lists.buildPrecutForWindow(a.derived, a.spec, {}, null)) === JSON.stringify(START.lists.buildPrecutForWindow(b.derived, b.spec, {}, null))
      && JSON.stringify(lists.buildHardwareList(a.spec, a.derived)) === JSON.stringify(START.lists.buildHardwareList(b.spec, b.derived)),
      `${name}: cut list, glass list, pre-cut and hardware list equal to START`);
    ok(JSON.stringify(bom.buildWindowPartQtys(a.derived, a.spec, {})) === JSON.stringify(START.bom.buildWindowPartQtys(b.derived, b.spec, {})), `${name}: BOM part quantities equal to START`);
    const ga = lists.buildGroupedCutList(lists.buildCutListForWindow(a.derived, a.spec).map((r) => ({ ...r, windowName: 'W' })));
    const gb = START.lists.buildGroupedCutList(START.lists.buildCutListForWindow(b.derived, b.spec).map((r) => ({ ...r, windowName: 'W' })));
    ok(JSON.stringify(ga) === JSON.stringify(gb), `${name}: grouped cut list equal to START`);
  }
  ok(JSON.stringify(profile.DEFAULT_CASEMENT_PROFILE) === JSON.stringify(START.profile.DEFAULT_CASEMENT_PROFILE) && JSON.stringify(profile.DEFAULT_SASH_PROFILE) === JSON.stringify(START.profile.DEFAULT_SASH_PROFILE),
    'casement and sash default profiles equal to START');
}

console.log(`\n${passes} pass, ${fails} fail`);
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
