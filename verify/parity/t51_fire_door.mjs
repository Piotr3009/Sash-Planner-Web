/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t51: fire doors v1 (Piotr 27.10.2026), the 'firedoor' category: internal door
 * sets FDR-nn (FD30 / FD60) and DR-nn (non-fire), leaf + three-member frame.
 * The reference door is the brief's 3.10: a single FD30, leaf 826 x 2040,
 * frame depth 100, hinge left, latch, the engine's own defaults; every number
 * below is typed as a literal and checked against the live engine.
 *   1  the profile: DEFAULT_FIREDOOR_PROFILE keys and tables, migrateFireDoorProfile
 *      (block by block, the bsuite targets keep their uploaded programs),
 *      withProfiles with a 5th profile argument and every older call form;
 *   2  the spec: category, the firedoor block defaults, the item fields over the
 *      fullConfig, frame depth from the block, glazing thickness 6; no firedoor
 *      key on a casement / sash / door / partition spec;
 *   3  the engine: every number of the brief's 3.10 (frame, members, rebate,
 *      faces, hinges, jamb recesses, spindle, keep, intumescent; FD60; non-fire;
 *      the 762 x 1981 leaf), the macro variable table of 4.7 (leaf, head, hinge
 *      jamb, lock jamb), the numbering, a free width (803, no clamp), the hard
 *      limits (one door fails, the next derives), the cylinders, the vision
 *      panels (style 1, custom 14), the machining ops and their coordinates,
 *      the records, weights, paint and consumables;
 *   4+ (appended by the test agent) the lists, the sheets, the export, the
 *      controls (a casement, a sash, a door and a partition byte identical to
 *      Stage 0). Those sections need the JSX sheets: add an esbuild bundle of
 *      the modules the way t50_partition.mjs does (build('t51-live', [...])).
 *
 * Run: node verify/parity/t51_fire_door.mjs
 */
import * as specification from '../../src/engine/specification.js';
import * as calculations from '../../src/engine/calculations.js';
import * as profile from '../../src/engine/profile.js';
import * as fireDoor from '../../src/engine/fireDoor.js';

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.01) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const clone = (o) => JSON.parse(JSON.stringify(o));
const J = (o) => JSON.stringify(o);
const R = (v) => Math.round(v * 10) / 10;   // the engine's op rounding (0.1)

const FP = profile.DEFAULT_FIREDOOR_PROFILE;
// a fire door item the way the configurator saves it: the firedoor* keys on the item (or in the fullConfig), category 'firedoor'
const mk = (fc = {}, name = 'FDR-01', item = {}) => {
  const spec = specification.normaliseToWindowSpec({ id: 'd1', name, width: 0, height: 0, ...item }, { fullConfig: { windowCategory: 'firedoor', ...fc } });
  return { spec, derived: calculations.deriveWindowData(spec, {}) };
};
const opsOf = (d, group, kind) => d.firedoor.machining[group].filter((o) => o.kind === kind);
const opIs = (o, face, x, y, z, length, width, depth, radius) => !!o && o.face === face && near(o.x, x, 0.05) && near(o.y, y, 0.05) && near(o.z, z, 0.05)
  && near(o.length, length, 0.05) && near(o.width, width, 0.05) && near(o.depth, depth, 0.05) && near(o.radius, radius, 0.05);

// ═════════════════════════════════════════════════════════════════════════════
section('1 - the fire door profile, its migration and withProfiles');
{
  ok(FP.schema === 1 && J(Object.keys(FP)) === J(['schema', 'leaf', 'frame', 'hinges', 'lock', 'keep', 'vp', 'intumescent', 'bsuite', 'defaults']),
    `DEFAULT_FIREDOOR_PROFILE schema 1, blocks ${Object.keys(FP).join(' / ')}`);
  ok(J(FP.leaf.widthSuggestions) === J([626, 686, 726, 762, 826, 838, 926, 1056]) && FP.leaf.heightSuggestion === 2040 && FP.leaf.defaultWidth === 826 && FP.leaf.defaultHeight === 2040,
    'leaf: width suggestions 626 .. 1056, height 2040, defaults 826 x 2040');
  ok(J(FP.leaf.thicknessByRating) === J({ FD30: 44, FD60: 54, none: 44 }) && FP.leaf.blankAllowance === 0 && FP.leaf.leadEdgeMacroValue === -8
    && J(FP.leaf.limits) === J({ minWidth: 300, maxWidth: 1500, minHeight: 1500, maxHeight: 3000, minDepth: 50, maxDepth: 400 }),
    'leaf: thickness FD30 44 / FD60 54 / none 44, blank allowance 0, LEAD_EDGE -8, limits 300..1500 x 1500..3000, depth 50..400');
  ok(FP.frame.rawThickness === 63 && FP.frame.thickness === 50 && FP.frame.rawWidthAllowance === 5 && FP.frame.overlap === 12 && FP.frame.gapSide === 3 && FP.frame.gapHead === 3
    && FP.frame.floorGap === 5 && FP.frame.rebateClearance === 3 && FP.frame.headJoint === 'mitre' && J(FP.frame.depthSuggestions) === J([100, 125, 150, 175, 200]) && FP.frame.defaultDepth === 100,
    'frame: raw 63 to 50, raw width + 5, overlap 12, gaps 3 / 3, floor 5, rebate clearance 3, mitre head, depths 100 .. 200 default 100');
  ok(J(FP.hinges) === J({ count: 3, length: 102, topOffset: 150, bottomOffset: 200, recessLength: 103, recessWidth: 30, recessDepth: 3, cornerRadius: 6 }),
    'hinges: 3 x 102, 150 from the top, 200 from the bottom, recess 103 x 30 x 3 R6');
  ok(FP.lock.spindleHeight === 1000 && FP.lock.backset === 60 && J(FP.lock.forend) === J({ length: 235, width: 24, millOversize: 1, depth: 4 })
    && J(FP.lock.case) === J({ depth: 85, height: 150, pocketWidth: 17, pocketDepth: 87, pocketHeight: 153 }) && FP.lock.euroCentres === 72 && FP.lock.bathroomCentres === 78
    && FP.lock.caseTopAboveSpindle === 46.5 && FP.lock.forendCentreBelowSpindle === 15 && FP.lock.spindleBore === 10 && FP.lock.euroBore === 18 && FP.lock.bathroomBore === 10,
    'lock: spindle 1000, backset 60, forend 235 x 24 (+1, 4 deep), case 85 x 150 pocket 17 x 87 x 153, euro 72, bathroom 78, case top +46.5, forend centre -15, bores 10 / 18 / 10');
  ok(J(FP.keep) === J({ length: 175, width: 39, millOversize: 1, plateDepth: 3, pocket: { length: 120, width: 18, depth: 15 } }), 'keep: 175 x 39 (+1), plate 3 deep, pocket 120 x 18 x 15');
  ok(FP.vp.topRail === 150 && FP.vp.midRail === 450 && FP.vp.sideMargin === 150 && FP.vp.stackGap === 100 && FP.vp.cornerRadius === 6 && FP.vp.beadFaces === 2 && FP.vp.glassThickness === 6,
    'vp: top rail 150, mid rail 450, side margin 150, stack gap 100, R6, beads both faces, glass 6');
  const vpIds = FP.vp.styles.map((s) => s.id);
  ok(J(vpIds) === J([0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), `vp styles ids 1:1 with the macro (no 3): ${vpIds.join(' ')}`);
  const vpBy = (id) => FP.vp.styles.find((s) => s.id === id);
  ok(J([vpBy(1).w, vpBy(1).h, vpBy(1).count, vpBy(1).arrange]) === J([450, 450, 1, 'single']) && vpBy(5).arrange === 'diamond' && vpBy(14).arrange === 'custom'
    && J(vpBy(2).panes) === J([{ w: 150, h: 760 }, { w: 150, h: 450 }]) && vpBy(2).arrange === 'stack' && vpBy(2).gap === 'midRail' && vpBy(12).gap === 'midRail'
    && [6, 7, 8, 13].every((id) => vpBy(id).arrange === 'stack' && vpBy(id).gap === 'stackGap') && J([vpBy(8).w, vpBy(8).h, vpBy(8).count]) === J([200, 500, 5]) && J([vpBy(11).w, vpBy(11).h]) === J([508, 1500]),
    'vp table: 1 single 450, 5 diamond, 14 custom, 2 a stack of 150 x 760 + 150 x 450 at the mid rail, 12 at the mid rail, 6 / 7 / 8 / 13 stacks at the stack gap, 8 = 5No 200 x 500, 11 = 508 x 1500');
  ok(J(FP.intumescent.styles.map((s) => [s.id, s.width, s.thickness, s.strips])) === J([[1, 15, 4, 1], [2, 20, 4, 1], [3, 10, 4, 2], [4, 15, 4, 2], [5, 15, 4, 1], [6, 20, 4, 1], [7, 15, 4, 2]])
    && FP.intumescent.styles[0].label === '15mm x 4mm Intu Strip Lock Center' && FP.intumescent.grooveOversize === 0.5 && Number.isFinite(FP.intumescent.twoStripOffset),
    'intumescent table ids 1..7: widths 15 / 20 / 10 / 15 / 15 / 20 / 15, thickness 4, strips 1 / 1 / 2 / 2 / 1 / 1 / 2; groove + 0.5');
  const tgt = FP.bsuite.targets[0];
  ok(FP.bsuite.activeTarget === 'machine' && tgt.id === 'machine' && J(Object.keys(tgt.programs)) === J(['leaf', 'head', 'jambHinge', 'jambLock'])
    && tgt.programs.leaf.path === 'C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid' && tgt.programs.head.path === '' && tgt.programs.jambHinge.path === '' && tgt.programs.jambLock.path === ''
    && FP.bsuite.stopRows === true && J(FP.bsuite.hand) === J({ left: 0, right: 1 }) && FP.bsuite.macroDefaults.SPY_H === 1450 && FP.bsuite.macroDefaults.REBATE === 0 && FP.bsuite.macroDefaults.REBATE_STYLE === 1,
    'bsuite: one target with leaf / head / jambHinge / jambLock, the leaf master path, empty frame paths, stop rows, hand left 0 / right 1, macro defaults');
  ok(J(FP.defaults) === J({ fire: true, rating: 'FD30', hingeSide: 'left', swing: 'in', lockType: 'latch', vpStyle: 0, intuStyle: 1, leadEdge: true, vpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 } }),
    'defaults: fire FD30, hinge left, opens in, latch, no VP, intu 1, lead edge, custom VP 600 x 150 x 1 rail 100 pos 0');
  // migration: block by block, a stored value kept, every other key from the default
  const mig = profile.migrateFireDoorProfile({ schema: 1, frame: { floorGap: 7 }, lock: { forend: { depth: 5 } } });
  const sans = (p) => { const c = clone(p); delete c.frame.floorGap; delete c.lock.forend.depth; return c; };
  ok(mig && mig.frame.floorGap === 7 && mig.lock.forend.depth === 5 && mig.frame.gapHead === 3 && mig.lock.forend.length === 235 && J(sans(mig)) === J(sans(FP)),
    'migrateFireDoorProfile({ frame.floorGap 7, lock.forend.depth 5 }): both kept, every other key and block from the default, same key order');
  ok(profile.migrateFireDoorProfile(null) === null, 'migrateFireDoorProfile(null) is null');
  const migB = profile.migrateFireDoorProfile({ bsuite: { activeTarget: 'office', targets: [{ id: 'office', name: 'Office PC', programs: { leaf: { path: 'D:/fd/leaf.bSolid', stored: { name: 'leaf.bSolid', key: 'k1' } } } }] } });
  const bp = migB.bsuite.targets[0].programs;
  ok(migB.bsuite.activeTarget === 'office' && migB.bsuite.targets.length === 1 && bp.leaf.path === 'D:/fd/leaf.bSolid' && J(bp.leaf.stored) === J({ name: 'leaf.bSolid', key: 'k1' }) && bp.leaf.panelId === 1001
    && J(bp.head) === J({ path: '', panelId: 1001, panelName: 'P1001' }) && 'jambHinge' in bp && 'jambLock' in bp && migB.bsuite.stopRows === true && J(migB.bsuite.hand) === J({ left: 0, right: 1 }),
    'a stored bsuite target keeps its uploaded `stored` leaf program and gains the missing head / jamb keys, stopRows and hand');
  const migA = profile.migrateFireDoorProfile({ bsuite: { activeTarget: 'nope' } });
  ok(migA.bsuite.activeTarget === 'machine' && migA.bsuite.targets.length === 1 && migA.bsuite.targets[0].programs.leaf.path === tgt.programs.leaf.path, 'an unknown activeTarget falls back to the default target');
  const migS = profile.migrateFireDoorProfile({ vp: { styles: [{ id: 1, label: 'Square 450' }, { id: 99, label: 'Mine', w: 100, h: 100, count: 1, arrange: 'single' }] }, intumescent: { styles: [{ id: 3, strips: 3 }] } });
  ok(migS.vp.styles.length === 15 && migS.vp.styles[1].label === 'Square 450' && migS.vp.styles[1].w === 450 && migS.vp.styles[14].id === 99 && migS.intumescent.styles.length === 7 && migS.intumescent.styles[2].strips === 3 && migS.intumescent.styles[2].width === 10,
    'a stored styles table merges by id over the default (a label edit kept, an extra id appended, the other fields from the default)');
  // the engine sync and withProfiles
  profile.setActiveFireDoorProfile({ frame: { floorGap: 7 } });
  ok(profile.getFireDoorProfile().frame.floorGap === 7 && profile.getFireDoorProfile().frame.gapHead === 3, 'setActiveFireDoorProfile migrates on the way in; getFireDoorProfile reads it');
  profile.setActiveFireDoorProfile(null);
  ok(profile.getFireDoorProfile() === FP, 'setActiveFireDoorProfile(null): the default again');
  const inside = profile.withProfiles(null, null, null, null, { ...FP, frame: { ...FP.frame, floorGap: 9 } }, () => mk().derived.firedoor.frame.gaps.floor);
  ok(inside === 9 && mk().derived.firedoor.frame.gaps.floor === 5, `withProfiles(sash, casement, door, partition, firedoor, fn): floor gap ${inside} inside, 5 after`);
  ok(profile.withProfiles(null, null, null, null, () => mk().derived.firedoor.frame.gaps.floor) === 5
    && profile.withProfiles(null, null, null, () => mk().derived.firedoor.frame.gaps.floor) === 5
    && profile.withProfiles(null, null, () => mk().derived.firedoor.frame.gaps.floor) === 5,
    'withProfiles(sash, casement, door, partition, fn), (sash, casement, door, fn) and (sash, casement, fn) still take the callback in that place');
  const partInside = profile.withProfiles(null, null, null, { ...profile.DEFAULT_PARTITION_PROFILE, depth: 60 }, null, () => profile.getPartitionProfile().depth);
  ok(partInside === 60 && profile.getPartitionProfile().depth === 54, 'the 4th argument is still the partition profile in the 6-argument form');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - the spec: the firedoor block, frame depth, glazing; no firedoor key on the other categories');
{
  const { spec: s } = mk();
  ok(s.category === 'firedoor' && J(s.firedoor) === J({ fire: true, rating: 'FD30', leafWidth: 826, leafHeight: 2040, hingeSide: 'left', swing: 'in', frameDepth: 100, lockType: 'latch', closer: true, vpStyle: 0, vpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 }, intuStyle: 1, leadEdge: true }),
    `spec.category firedoor, spec.firedoor at the defaults ${J(s.firedoor)}`);
  ok(s.frame.depth === 100 && s.glazing.thickness === 6, `frame depth ${s.frame.depth} (the block's frameDepth), glazing thickness ${s.glazing.thickness}`);
  const { spec: s2 } = mk({ firedoorLeafWidth: 686, firedoorFrameDepth: 150 }, 'FDR-02', { firedoorLeafWidth: 762, firedoorFire: false, firedoorRating: 'FD60', firedoorLockType: 'euro', firedoorHingeSide: 'right', firedoorSwing: 'out', firedoorVpStyle: 14, firedoorVpCustom: { length: 500, count: 2, pos: 90 }, firedoorIntuStyle: 4, firedoorLeadEdge: false });
  ok(s2.firedoor.leafWidth === 762 && s2.firedoor.frameDepth === 150 && s2.frame.depth === 150 && s2.firedoor.fire === false && s2.firedoor.closer === false && s2.firedoor.rating === 'FD60' && s2.firedoor.lockType === 'euro'
    && s2.firedoor.hingeSide === 'right' && s2.firedoor.swing === 'out' && s2.firedoor.vpStyle === 14 && J(s2.firedoor.vpCustom) === J({ length: 500, width: 150, count: 2, rail: 100, pos: 90 }) && s2.firedoor.intuStyle === 4 && s2.firedoor.leadEdge === false,
    'the item fields win over the fullConfig (762 over 686), the fullConfig over the defaults (depth 150); fire off makes the closer default off; the custom VP merges over its default');
  const { spec: s3 } = mk({ firedoorFire: 'false', firedoorCloser: true, firedoorLockType: 'nope', firedoorLeafWidth: 'abc' });
  ok(s3.firedoor.fire === false && s3.firedoor.closer === true && s3.firedoor.lockType === 'latch' && s3.firedoor.leafWidth === 826, "a stored 'false' reads false, an explicit closer stays, an unknown lock type and a non-number fall to the defaults");
  // projectStore (fireDoorItemFields) stores a vpCustom number that did not parse as null: the ?? rule gives the profile default, never Number(null) = 0
  const { spec: s4 } = mk({ firedoorVpStyle: 14, firedoorVpCustom: { length: null, width: null, count: null, rail: null, pos: null } });
  ok(J(s4.firedoor.vpCustom) === J({ length: 600, width: 150, count: 1, rail: 100, pos: 0 }) && s4.firedoor.vpStyle === 14, 'a stored vpCustom with null numbers reads the profile defaults (600 x 150 x 1, rail 100, pos 0), not zeros', J(s4.firedoor.vpCustom));
  const cas = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 1200, height: 1200 }, { fullConfig: { windowCategory: 'casement' } });
  const sash = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 900, height: 1500 }, { fullConfig: {} });
  const door = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 900, height: 2100 }, { fullConfig: { windowCategory: 'door', doorType: 'single-external' } });
  const part = specification.normaliseToWindowSpec({ id: 'x', name: 'X', width: 2525, height: 2165 }, { fullConfig: { windowCategory: 'partition', partitionLayout: 'SDS', partitionDoorWidth: 800, partitionLights: 3, partitionPanelHeight: 790 } });
  ok(!('firedoor' in cas) && !('firedoor' in sash) && !('firedoor' in door) && !('firedoor' in part) && cas.category === 'casement' && sash.category === 'sash' && door.category === 'door' && part.category === 'partition',
    'a casement, a sash, a door and a partition spec carry NO firedoor key');
  ok(cas.frame.depth === 93 || cas.frame.depth === 164 || cas.frame.depth > 0, 'the casement frame depth still resolves through the old chain');
  ok(part.frame.depth === 54 && part.glazing.thickness === 28 && door.frame.depth === 93 && sash.glazing.thickness === 24, 'partition depth 54 / glass 28, door depth 93, sash glass 24 as before');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - the engine: the reference FD30 826 x 2040, depth 100, hinge left, latch (brief 3.10 and 4.7)');
const REF = mk();
const f = REF.derived.firedoor;
{
  const d = REF.derived;
  ok(d.category === 'firedoor' && f && f.name === 'FDR-01' && f.fire === true && f.rating === 'FD30', 'derived.category firedoor, name FDR-01, fire FD30');
  ok(J(f.leaf) === J({ width: 826, height: 2040, thickness: 44, blank: { width: 826, height: 2040, thickness: 44, allowance: 0 } }), `leaf ${J(f.leaf)}`);
  ok(J(f.frame.overall) === J({ width: 902, height: 2083 }) && J(d.frame) === J({ width: 902, height: 2083 }), `frame overall ${J(f.frame.overall)} (826 + 76, 2040 + 43)`);
  ok(f.frame.depth === 100 && f.frame.thickness === 50 && f.frame.rawThickness === 63 && f.frame.rawWidth === 105, 'frame depth 100, finished 50, raw 63 x 105');
  ok(J(f.frame.rebate) === J({ width: 15, depth: 47 }) && J(f.frame.faces) === J({ outside: 35, inside: 50 }) && J(f.frame.gaps) === J({ side: 3, head: 3, floor: 5 }) && f.frame.headJoint === 'mitre',
    'rebate 15 x 47, faces 35 outside / 50 inside, gaps 3 / 3 / 5, mitre head');
  const m = f.frame.members;
  ok(m.length === 3 && J(m.map((x) => [x.id, x.role, x.length, x.mitreTop, x.mitreBottom])) === J([['FD-HEAD', 'head', 902, true, true], ['FD-JAMB-H', 'jambHinge', 2083, true, false], ['FD-JAMB-L', 'jambLock', 2083, true, false]]),
    'members: FD-HEAD 902 mitred both ends, FD-JAMB-H and FD-JAMB-L 2083 mitred top, square bottom');
  ok(m.every((x) => x.section === '50x100' && x.rawSection === '63x105' && J(x.finished) === J({ w: 50, d: 100 }) && J(x.raw) === J({ w: 63, d: 105 }) && x.quantity === 1),
    'every member finished 50x100, raw 63x105, quantity 1');
  const h = f.hinges;
  ok(h.count === 3 && h.length === 102 && h.step === 794 && h.macroHinge === 1 && h.product === 'fire' && J(h.recess) === J({ length: 103, width: 30, depth: 3, radius: 6 }),
    'hinges: 3 x 102, step 794 ((2040 - 150 - 200 - 102) / 2), HINGE 1 fire, recess 103 x 30 x 3 R6');
  ok(J(h.positions.map((p) => p.top)) === J([150, 944, 1738]) && J(h.positions.map((p) => p.bottom)) === J([252, 1046, 1840]) && J(h.positions.map((p) => p.centre)) === J([201, 995, 1789]),
    'hinge tops 150 / 944 / 1738 from the leaf top, the last one ending 1840 = 2040 - 200');
  ok(J(h.positions.map((p) => p.jambTop)) === J([188, 982, 1776]), 'jamb hinge recess tops 188 / 982 / 1776 from the jamb top (35 + 3 + top)');
  const lk = f.lock;
  ok(lk.type === 'latch' && lk.macroLock === 2 && lk.euro === false && lk.spindleHeight === 1000 && lk.backset === 60 && lk.cylinder === null, 'lock: latch, LOCK 2 (FD30), spindle 1000, backset 60, no cylinder');
  ok(J(lk.spindle) === J({ fromBottom: 1000, fromTop: 1040, fromLockEdge: 60, bore: 10 }), `spindle ${J(lk.spindle)}`);
  ok(J(lk.forend) === J({ length: 235, width: 24, millLength: 236, millWidth: 25, depth: 4, centreFromBottom: 985, centreFromTop: 1055, radius: 12.5 }), `forend ${J(lk.forend)} (centre 1000 - 15)`);
  ok(J(lk.case) === J({ depth: 85, height: 150, pocketWidth: 17, pocketDepth: 87, pocketHeight: 153, topFromBottom: 1046.5, topFromTop: 993.5 }), `case ${J(lk.case)} (top 1000 + 46.5)`);
  const k = f.keep;
  ok(k.macroKeep === 2 && k.keepStyle === 1 && J(k.plate) === J({ length: 175, width: 39, millLength: 176, millWidth: 40, depth: 3 }) && J(k.pocket) === J({ length: 120, width: 18, depth: 15 }) && k.centreFromFoot === 990 && k.centreFromTop === 1093,
    'keep: KEEP 2, plate 175 x 39 milled 176 x 40 x 3, pocket 120 x 18 x 15, centre 990 above the jamb foot (5 + 1000 - 15), 1093 from the top');
  ok(J(f.intumescent) === J({ style: 1, label: '15mm x 4mm Intu Strip Lock Center', width: 15, thickness: 4, strips: 1, metres: 4.906 }), 'intumescent 15 x 4: 4.906 m (2 x 2040 + 826)');
  ok(f.closer === true && f.vp.style === 0 && f.vp.panes.length === 0 && f.vp.glassSqm === 0 && J(f.vp.warnings) === J([]), 'closer on, no vision panel');
  ok(J(f.handing) === J({ hingeSide: 'left', swing: 'in', label: 'Hinge left · opens in' }), `handing ${J(f.handing)}`);
  ok(J(f.inputs) === J({ leafWidth: 826, leafHeight: 2040, frameDepth: 100, hingeSide: 'left', swing: 'in', lockType: 'latch', closer: true, vpStyle: 0, vpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 }, intuStyle: 1, leadEdge: true }), 'inputs echoed');
  // the macro variable table (4.7), names and key order 1:1
  const LV = f.bsuiteVars.leaf;
  ok(J(Object.keys(LV)) === J(['LPX', 'LPY', 'LPZ', 'HAND', 'LH', 'RH', 'HINGE', 'LOCK', 'LOCK_H', 'SPINDLE', 'EURO', 'KEEP', 'KEEP_STYLE', 'INTU_STYLE', 'VP_STYLE', 'C_VP_L', 'C_VP_W', 'C_VP_NUM', 'C_VP_RAIL', 'C_VP_POS',
    'D_TOP_RAIL', 'D_MID_RAIL', 'D_SIDE_MARGIN', 'LEAD_EDGE', 'REBATE', 'REBATE_STYLE', 'SPY_ON', 'SPY_H', 'LBOX', 'L_BOX_H', 'DROP_CILL', 'PREM_DOOR', 'HINGE_1', 'HINGE_2', 'HINGE_3', 'HINGE_D', 'CLOSER']),
    'leaf row: the variable names of 4.7 in the write order');
  ok(LV.LPX === 2040 && LV.LPY === 826 && LV.LPZ === 44 && LV.HAND === 0 && LV.LH === 1 && LV.RH === 0 && LV.HINGE === 1 && LV.LOCK === 2 && LV.LOCK_H === 1000 && LV.SPINDLE === 1 && LV.EURO === 0 && LV.KEEP === 0 && LV.KEEP_STYLE === 0,
    'leaf row: LPX 2040 LPY 826 LPZ 44, HAND 0 LH 1 RH 0, HINGE 1, LOCK 2, LOCK_H 1000, SPINDLE 1, EURO 0, KEEP 0, KEEP_STYLE 0');
  ok(LV.INTU_STYLE === 1 && LV.VP_STYLE === 0 && LV.C_VP_L === 600 && LV.C_VP_W === 150 && LV.C_VP_NUM === 1 && LV.C_VP_RAIL === 100 && LV.C_VP_POS === 0 && LV.D_TOP_RAIL === 150 && LV.D_MID_RAIL === 450 && LV.D_SIDE_MARGIN === 150,
    'leaf row: INTU_STYLE 1, VP_STYLE 0, C_VP 600 / 150 / 1 / 100 / 0, D_TOP_RAIL 150, D_MID_RAIL 450, D_SIDE_MARGIN 150');
  ok(LV.LEAD_EDGE === 1 && LV.REBATE === 0 && LV.REBATE_STYLE === 1 && LV.SPY_ON === 0 && LV.SPY_H === 1450 && LV.LBOX === 0 && LV.L_BOX_H === 1000 && LV.DROP_CILL === 0 && LV.PREM_DOOR === 0,
    'leaf row: LEAD_EDGE 1, REBATE 0, REBATE_STYLE 1, SPY_ON 0, SPY_H 1450, LBOX 0, L_BOX_H 1000, DROP_CILL 0, PREM_DOOR 0');
  ok(LV.HINGE_1 === 150 && LV.HINGE_2 === 944 && LV.HINGE_3 === 1738 && LV.HINGE_D === 3 && LV.CLOSER === 1, 'leaf row: HINGE_1..3 150 / 944 / 1738, HINGE_D 3, CLOSER 1 (the new names the owner adds)');
  ok(J(f.bsuiteVars.head) === J({ LPX: 902, LPY: 100, LPZ: 50, REB_W: 15, REB_D: 47, HAND: 0, HINGE: 1, HINGE_D: 3, MITRE_TOP: 1, MITRE_BOTTOM: 1 }), `head row ${J(f.bsuiteVars.head)}`);
  ok(J(f.bsuiteVars.jambHinge) === J({ LPX: 2083, LPY: 100, LPZ: 50, REB_W: 15, REB_D: 47, HAND: 0, HINGE: 1, HINGE_1: 188, HINGE_2: 982, HINGE_3: 1776, HINGE_D: 3, MITRE_TOP: 1, MITRE_BOTTOM: 0 }), `hinge jamb row ${J(f.bsuiteVars.jambHinge)}`);
  ok(J(f.bsuiteVars.jambLock) === J({ LPX: 2083, LPY: 100, LPZ: 50, REB_W: 15, REB_D: 47, HAND: 0, HINGE: 1, HINGE_D: 3, KEEP: 2, KEEP_STYLE: 1, KEEP_Y: 990, MITRE_TOP: 1, MITRE_BOTTOM: 0 }), `lock jamb row ${J(f.bsuiteVars.jambLock)}`);
  // the records
  const box = d.components.box, sash = d.components.sash;
  ok(box.length === 3 && J(box.map((r) => [r.group, r.elementName, r.section, r.length, r.quantity, r.rawSection, r.mitreTop, r.mitreBottom, r.windowName])) === J([
    ['box', 'FD-HEAD', '50x100', 902, 1, '63x105', true, true, 'FDR-01'], ['box', 'FD-JAMB-H', '50x100', 2083, 1, '63x105', true, false, 'FDR-01'], ['box', 'FD-JAMB-L', '50x100', 2083, 1, '63x105', true, false, 'FDR-01']]),
    'components.box: FD-HEAD 50x100 x 902, FD-JAMB-H / FD-JAMB-L 50x100 x 2083, rawSection 63x105, the mitre flags, the door name');
  ok(sash.length === 1 && sash[0].elementName === 'FD-LEAF' && sash[0].section === '44x826' && sash[0].length === 2040 && sash[0].quantity === 1 && sash[0].notes === 'door blank FD30' && sash[0].thickness === 44 && sash[0].finishedWidth === 826 && J(d.components.beading) === J([]),
    'components.sash: FD-LEAF 44x826 x 2040 "door blank FD30"; beading empty');
  ok(J(d.customGlassUnits) === J([]) && J(d.panels) === J([]) && J(d.config) === J({ key: 'firedoor', rows: 1, cols: 1 }) && J(d.barPositions) === J({ vertical: [], horizontal: [] }), 'no glass units, no panels, config firedoor 1 x 1, no bars');
  // weights (timber 610 kg/m3 by the finished section, the partition rule), paint (per 1.5 m2 2 L primer + 1 L topcoat on 2 x 0.826 x 2.04 + 0.085 x 5.068 = 3.8)
  ok(near(d.weights.timber, 60.68) && d.weights.glass === 0 && near(d.weights.total, 63.72) && d.weights.leaves.length === 1 && d.weights.leaves[0].role === 'leaf' && near(d.weights.leaves[0].weightKg, 47.49),
    `weights timber ${d.weights.timber} (3 members 15.46 + leaf 45.22), total ${d.weights.total} (+5 %), leaf ${d.weights.leaves[0].weightKg}`);
  ok(J(d.paint) === J({ areaSqm: 3.8, primer: 5.07, topcoat: 2.53 }) && f.paintAreaSqm === 3.8, `paint ${J(d.paint)} (leaf both faces + 35 / 50 frame faces)`);
  ok(J(d.consumables) === J({ glass: { type: 'fire', sqm: 0 }, hinges: { count: 3, product: 'fire' }, lock: { type: 'latch' }, keep: 1, closer: 1, intumescent: { metres: 4.906, width: 15, thickness: 4 }, glazingBeads: { metres: 0 }, glazingIntumescent: { metres: 0 } }),
    `consumables ${J(d.consumables)}`);
  // the machining ops (the coordinate systems of the file header)
  const hr = opsOf(d, 'leaf', 'hingeRecess');
  ok(hr.length === 3 && opIs(hr[0], 'hingeEdge', 149.5, 0, 0, 103, 30, 3, 6) && opIs(hr[1], 'hingeEdge', 943.5, 0, 0, 103, 30, 3, 6) && opIs(hr[2], 'hingeEdge', 1737.5, 0, 0, 103, 30, 3, 6),
    'leaf hinge recesses on the hinge edge at x 149.5 / 943.5 / 1737.5 (top - 0.5), z 0, 103 x 30 x 3 R6');
  ok(opIs(opsOf(d, 'leaf', 'forendRecess')[0], 'lockEdge', 937, 826, 9.5, 236, 25, 4, 12.5), 'leaf forend recess on the lock edge: x 937 (1055 - 118), z 9.5 (22 - 12.5), 236 x 25 x 4 R12.5');
  ok(opIs(opsOf(d, 'leaf', 'casePocket')[0], 'lockEdge', 992, 826, 13.5, 153, 17, 87, 8.5), 'leaf case pocket on the lock edge: x 992 (993.5 - 1.5), z 13.5, 153 x 17 x 87');
  ok(opIs(opsOf(d, 'leaf', 'spindleHole')[0], 'pull', 1040, 766, 0, 10, 10, 44, 5) && opsOf(d, 'leaf', 'cylinderHole').length === 0, 'leaf spindle hole through the pull face, centre x 1040 (2040 - 1000), y 766 (826 - 60), bore 10; no cylinder hole on a latch');
  const ig = opsOf(d, 'leaf', 'intuGroove');
  ok(ig.length === 3 && J(ig.map((o) => o.face)) === J(['top', 'hingeEdge', 'lockEdge']) && opIs(ig[0], 'top', 0, 0, 14.3, 826, 15.5, 4, 0) && opIs(ig[1], 'hingeEdge', 0, 0, 14.3, 2040, 15.5, 4, 0) && opIs(ig[2], 'lockEdge', 0, 826, 14.3, 2040, 15.5, 4, 0),
    'one intumescent groove 15.5 x 4 centred on the thickness (z 22 - 7.75 = 14.25, written 14.3 at the 0.1 rounding) on the top, hinge and lock edges');
  const le = opsOf(d, 'leaf', 'leadEdge')[0];
  ok(opIs(le, 'lockEdge', 0, 826, 0, 2040, 44, 0, 0) && le.value === -8, 'lead edge on the lock edge, full length, value -8');
  ok(opsOf(d, 'leaf', 'vpCutout').length === 0 && d.firedoor.machining.leaf.length === 10, '10 leaf ops: 3 hinges, forend, case, spindle, 3 grooves, lead edge');
  const jh = d.firedoor.machining.jambHinge;
  ok(opIs(opsOf(d, 'jambHinge', 'rebate')[0], 'opening', 0, 35, 0, 2083, 15, 47, 0), 'hinge jamb rebate on the opening face: y 35, full length 2083, 15 x 47');
  const jr = opsOf(d, 'jambHinge', 'hingeRecess');
  ok(jr.length === 3 && opIs(jr[0], 'rebateCheek', 187.5, 35, 0, 103, 30, 3, 6) && opIs(jr[1], 'rebateCheek', 981.5, 35, 0, 103, 30, 3, 6) && opIs(jr[2], 'rebateCheek', 1775.5, 35, 0, 103, 30, 3, 6),
    'hinge jamb recesses on the rebate cheek at x 187.5 / 981.5 / 1775.5 (jamb top - 0.5), y 35, z 0');
  const jm = opsOf(d, 'jambHinge', 'mitre');
  ok(jm.length === 1 && opIs(jm[0], 'end', 0, 0, 0, 0, 50, 100, 0) && jm[0].angle === 45 && jh.length === 5, 'hinge jamb: one mitre at the top (x 0, 45), 5 ops in all');
  ok(opIs(opsOf(d, 'jambLock', 'keepPlate')[0], 'rebateCheek', 1005, 35, 2, 176, 40, 3, 20), 'lock jamb keep plate on the rebate cheek: x 1005 (1093 - 88), z 2 (22 - 20), 176 x 40 x 3 R20');
  ok(opIs(opsOf(d, 'jambLock', 'keepPocket')[0], 'rebateCheek', 1033, 35, 13, 120, 18, 15, 9), 'lock jamb keep pocket: x 1033 (1093 - 60), z 13 (22 - 9), 120 x 18 x 15');
  ok(opsOf(d, 'jambLock', 'mitre').length === 1 && opsOf(d, 'jambLock', 'hingeRecess').length === 0 && d.firedoor.machining.jambLock.length === 4, 'lock jamb: rebate, keep plate, keep pocket, one top mitre');
  const hm = opsOf(d, 'head', 'mitre');
  ok(opIs(opsOf(d, 'head', 'rebate')[0], 'opening', 0, 35, 0, 902, 15, 47, 0) && hm.length === 2 && opIs(hm[0], 'end', 0, 0, 0, 0, 50, 100, 0) && opIs(hm[1], 'end', 902, 0, 0, 0, 50, 100, 0) && d.firedoor.machining.head.length === 3,
    'head: rebate 902 long, mitres at x 0 and x 902, 3 ops');
  const allOps = ['leaf', 'head', 'jambHinge', 'jambLock'].flatMap((g) => d.firedoor.machining[g]);
  ok(allOps.every((o) => ['id', 'kind', 'face', 'x', 'y', 'z', 'length', 'width', 'depth', 'radius'].every((key) => key in o) && [o.x, o.y, o.z, o.length, o.width, o.depth, o.radius].every((v) => Number.isFinite(v) && Math.abs(v * 10 - Math.round(v * 10)) < 1e-6))
    && new Set(allOps.map((o) => o.id)).size === allOps.length, `every op carries id, kind, face, x, y, z, length, width, depth, radius, rounded to 0.1, ids unique (${allOps.length} ops)`);
}

section('3b - FD60, non-fire DR, the 762 x 1981 leaf, hinge right, euro / bathroom, the vision panels, the limits, the numbering');
{
  const fd60 = mk({ firedoorRating: 'FD60' }).derived.firedoor;
  ok(fd60.rating === 'FD60' && fd60.leaf.thickness === 54 && fd60.frame.rebate.depth === 57 && fd60.frame.rebate.width === 15 && J(fd60.frame.overall) === J({ width: 902, height: 2083 }),
    'FD60: leaf 54, rebate 15 x 57, the same overall 902 x 2083');
  ok(fd60.lock.macroLock === 3 && fd60.keep.macroKeep === 3 && fd60.bsuiteVars.leaf.LOCK === 3 && fd60.bsuiteVars.leaf.LPZ === 54 && fd60.bsuiteVars.jambLock.KEEP === 3 && fd60.bsuiteVars.head.REB_D === 57 && fd60.hinges.macroHinge === 1,
    'FD60: LOCK 3, KEEP 3, LPZ 54, REB_D 57, HINGE 1');
  ok(opIs(opsOf({ firedoor: fd60 }, 'leaf', 'forendRecess')[0], 'lockEdge', 937, 826, 14.5, 236, 25, 4, 12.5) && opIs(opsOf({ firedoor: fd60 }, 'leaf', 'spindleHole')[0], 'pull', 1040, 766, 0, 10, 10, 54, 5),
    'FD60 leaf ops follow the 54 thickness (forend z 14.5, spindle through 54)');
  const dr = mk({ firedoorFire: false }, 'DR-01').derived;
  const fdr = dr.firedoor;
  ok(fdr.fire === false && fdr.rating === 'none' && fdr.leaf.thickness === 44 && fdr.hinges.macroHinge === 0 && fdr.hinges.product === 'standard' && fdr.lock.macroLock === 1 && fdr.keep.macroKeep === 1 && fdr.closer === false,
    'non-fire DR: rating none, leaf 44, HINGE 0 standard, LOCK 1, KEEP 1, closer off by default');
  ok(fdr.intumescent === null && dr.consumables.intumescent === null && fdr.bsuiteVars.leaf.INTU_STYLE === 0 && fdr.bsuiteVars.leaf.HINGE === 0 && fdr.bsuiteVars.leaf.LOCK === 1 && fdr.bsuiteVars.leaf.CLOSER === 0 && fdr.bsuiteVars.jambLock.KEEP === 1 && fdr.bsuiteVars.head.HINGE === 0,
    'non-fire DR: no intumescent rows, INTU_STYLE 0, HINGE 0, LOCK 1, CLOSER 0, KEEP 1 on the lock jamb');
  ok(opsOf(dr, 'leaf', 'intuGroove').length === 0 && dr.consumables.glass.type === 'toughened' && dr.consumables.hinges.product === 'standard' && dr.components.sash[0].notes === 'door blank non-fire',
    'non-fire DR: no grooves, toughened glass slot, standard hinges, "door blank non-fire"');
  const drc = mk({ firedoorFire: false, firedoorCloser: true, firedoorIntuStyle: 4 }).derived.firedoor;
  ok(drc.closer === true && drc.bsuiteVars.leaf.CLOSER === 1 && drc.intumescent === null && drc.bsuiteVars.leaf.INTU_STYLE === 0, 'non-fire with the closer ticked: CLOSER 1; a stored intu style is forced to 0');
  const n = mk({ firedoorLeafWidth: 762, firedoorLeafHeight: 1981 }).derived.firedoor;
  ok(n.hinges.step === 764.5 && J(n.hinges.positions.map((p) => p.top)) === J([150, 914.5, 1679]) && J(n.hinges.positions.map((p) => p.jambTop)) === J([188, 952.5, 1717]) && J(n.frame.overall) === J({ width: 838, height: 2024 }),
    'leaf 762 x 1981: step 764.5, hinges 150 / 914.5 / 1679, jamb 188 / 952.5 / 1717, frame 838 x 2024');
  ok(n.bsuiteVars.leaf.HINGE_2 === 914.5 && n.bsuiteVars.jambHinge.HINGE_2 === 952.5 && n.lock.spindle.fromTop === 981 && n.keep.centreFromTop === 1034, '762 x 1981: HINGE_2 914.5 / 952.5, spindle 981 from the top, keep 1034 from the jamb top');
  const rh = mk({ firedoorHingeSide: 'right', firedoorSwing: 'out' }).derived.firedoor;
  ok(rh.bsuiteVars.leaf.HAND === 1 && rh.bsuiteVars.leaf.LH === 0 && rh.bsuiteVars.leaf.RH === 1 && rh.bsuiteVars.head.HAND === 1 && rh.bsuiteVars.jambHinge.HAND === 1 && rh.bsuiteVars.jambLock.HAND === 1
    && J(rh.handing) === J({ hingeSide: 'right', swing: 'out', label: 'Hinge right · opens out' }),
    'hinge right, opens out: HAND 1, LH 0, RH 1 on every row, label "Hinge right · opens out"');
  ok(J(rh.hinges.positions.map((p) => p.top)) === J([150, 944, 1738]) && J(opsOf({ firedoor: rh }, 'leaf', 'hingeRecess').map((o) => o.x)) === J([149.5, 943.5, 1737.5]) && opsOf({ firedoor: rh }, 'leaf', 'spindleHole')[0].y === 766,
    'handing never moves a leaf op (y from the hinge edge, z from the pull face)');
  const eu = mk({ firedoorLockType: 'euro' }).derived, ba = mk({ firedoorLockType: 'bathroom' }).derived;
  ok(J(eu.firedoor.lock.cylinder) === J({ kind: 'euro', fromBottom: 928, fromTop: 1112, fromLockEdge: 60, bore: 18 }) && eu.firedoor.lock.euro === true && eu.firedoor.bsuiteVars.leaf.EURO === 1 && eu.firedoor.lock.macroLock === 2,
    'euro: cylinder 928 from the bottom (1000 - 72), bore 18, EURO 1, LOCK 2');
  ok(J(ba.firedoor.lock.cylinder) === J({ kind: 'bathroom', fromBottom: 922, fromTop: 1118, fromLockEdge: 60, bore: 10 }) && ba.firedoor.bsuiteVars.leaf.EURO === 0, 'bathroom: cylinder 922 from the bottom (1000 - 78), bore 10, EURO 0');
  ok(opIs(opsOf(eu, 'leaf', 'cylinderHole')[0], 'pull', 1112, 766, 0, 18, 18, 44, 9) && opIs(opsOf(ba, 'leaf', 'cylinderHole')[0], 'pull', 1118, 766, 0, 10, 10, 44, 5) && eu.firedoor.machining.leaf.length === 11,
    'the cylinder hole: euro centre x 1112 bore 18, bathroom x 1118 bore 10, through the leaf');
  ok(J(eu.consumables.lock) === J({ type: 'euro' }) && J(ba.consumables.lock) === J({ type: 'bathroom' }), 'consumables.lock.type euro / bathroom');
  // the vision panels
  const v1 = mk({ firedoorVpStyle: 1 }).derived;
  const p1 = v1.firedoor.vp.panes[0];
  ok(v1.firedoor.vp.style === 1 && v1.firedoor.vp.label === '450mm Square' && v1.firedoor.vp.panes.length === 1 && J([p1.i, p1.w, p1.h, p1.x, p1.y, p1.rotated, p1.angle]) === J([1, 450, 450, 150, 188, false, 0]) && J(p1.box) === J({ w: 450, h: 450 }),
    'VP style 1: one 450 x 450 pane, top 150 from the leaf top, 188 from the hinge edge ((826 - 450) / 2)');
  ok(near(v1.firedoor.vp.glassSqm, 0.2025) && near(v1.firedoor.vp.beadM, 3.6) && near(v1.firedoor.vp.intuM, 1.8) && v1.firedoor.vp.glassThickness === 6 && J(v1.firedoor.vp.warnings) === J([]),
    'VP style 1: glass 0.2025 m2, beads 3.6 m (perimeter x 2 faces), glazing intumescent 1.8 m');
  ok(J(v1.customGlassUnits.map((u) => [u.width, u.height, u.qty, u.role, u.location, u.fire])) === J([[450, 450, 1, 'vp', 'vision panel 1', true]]) && /layout per bSolid macro/.test(v1.customGlassUnits[0].note),
    'VP style 1: one glass unit 450 x 450, role vp, "vision panel 1", fire, noted "layout per bSolid macro"');
  ok(J(v1.consumables.glass) === J({ type: 'fire', sqm: 0.2 }) && near(v1.consumables.glazingBeads.metres, 3.6) && near(v1.consumables.glazingIntumescent.metres, 1.8) && near(v1.weights.glass, 3.04),
    'VP style 1: consumables fire glass 0.2 m2, beads 3.6, glazing intumescent 1.8; glass weight 3.04 kg (2.5 x 6 x 0.2025)');
  const vc = opsOf(v1, 'leaf', 'vpCutout');
  ok(vc.length === 1 && opIs(vc[0], 'pull', 150, 188, 0, 450, 450, 44, 6) && vc[0].rotated === false && vc[0].pane === 1 && v1.firedoor.bsuiteVars.leaf.VP_STYLE === 1, 'VP style 1 cut-out through the pull face at x 150 y 188, 450 x 450 R6; VP_STYLE 1');
  const v2 = mk({ firedoorVpStyle: 2 }).derived.firedoor.vp;
  ok(J(v2.panes.map((p) => [p.w, p.h, p.x, p.y])) === J([[150, 760, 150, 338], [150, 450, 1360, 338]]), 'VP style 2: 150 x 760 at 150 then 150 x 450 at 1360 (760 + the 450 mid rail), both 338 from the hinge edge');
  const v7 = mk({ firedoorVpStyle: 7 }).derived.firedoor.vp;
  ok(J(v7.panes.map((p) => [p.w, p.h, p.x, p.y])) === J([[200, 450, 150, 313], [200, 450, 700, 313], [200, 450, 1250, 313]]), 'VP style 7: three 200 x 450 panes at 150 / 700 / 1250 (the 100 stack gap)');
  const v5 = mk({ firedoorVpStyle: 5 }).derived;
  const p5 = v5.firedoor.vp.panes[0];
  ok(p5.w === 350 && p5.h === 350 && p5.rotated === true && p5.angle === 45 && near(p5.box.w, 495, 0.1) && near(p5.box.h, 495, 0.1) && p5.x === 150 && near(p5.y, 165.5, 0.1) && opsOf(v5, 'leaf', 'vpCutout')[0].rotated === true && near(opsOf(v5, 'leaf', 'vpCutout')[0].width, 495, 0.1),
    'VP style 5 diamond: a 350 square turned 45, bounding box 495 x 495 centred (y 165.5), the cut-out carries rotated and the box');
  const v8 = mk({ firedoorVpStyle: 8 }).derived.firedoor.vp;
  ok(v8.panes.length === 5 && v8.panes.every((p) => p.w === 500 && p.h === 200 && p.rotated === true && p.angle === 90) && v8.panes[4].x === 1350 && J(v8.warnings) === J([]),
    'VP style 8 (5No 200 x 500): the native stack 2900 does not fit 2040, so the panes turn 500 x 200 (last at 1350), no warning');
  const vw = mk({ firedoorVpStyle: 11, firedoorLeafWidth: 626 }).derived.firedoor.vp;
  ok(vw.panes.length === 1 && vw.panes[0].w === 508 && vw.warnings.length === 1 && /508 wide/.test(vw.warnings[0]), 'VP style 11 on a 626 leaf: placed with a width warning, the door never fails');
  const vx = mk({ firedoorVpStyle: 3 }).derived.firedoor.vp;
  ok(vx.style === 3 && vx.panes.length === 0 && vx.warnings.length === 1 && /unknown vision panel style 3/.test(vx.warnings[0]), 'an unknown style id (3) places nothing and warns');
  const vcu = mk({ firedoorVpStyle: 14, firedoorVpCustom: { length: 600, width: 150, count: 2, rail: 100, pos: 0 } }).derived;
  ok(vcu.firedoor.vp.style === 14 && J(vcu.firedoor.vp.panes.map((p) => [p.w, p.h, p.x, p.y])) === J([[150, 600, 150, 338], [150, 600, 850, 338]]) && vcu.customGlassUnits.length === 2 && vcu.customGlassUnits[1].location === 'vision panel 2',
    'custom style 14, 600 x 150 x 2 rail 100 pos 0: two 150 x 600 panes at 150 and 850, two glass units');
  ok(vcu.firedoor.bsuiteVars.leaf.VP_STYLE === 14 && vcu.firedoor.bsuiteVars.leaf.C_VP_L === 600 && vcu.firedoor.bsuiteVars.leaf.C_VP_W === 150 && vcu.firedoor.bsuiteVars.leaf.C_VP_NUM === 2 && vcu.firedoor.bsuiteVars.leaf.C_VP_RAIL === 100 && vcu.firedoor.bsuiteVars.leaf.C_VP_POS === 0,
    'custom style 14: VP_STYLE 14, C_VP_L 600, C_VP_W 150, C_VP_NUM 2, C_VP_RAIL 100, C_VP_POS 0');
  const vch = mk({ firedoorVpStyle: 14, firedoorVpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 90 } }).derived.firedoor;
  ok(J(vch.vp.panes.map((p) => [p.w, p.h, p.x, p.y])) === J([[600, 150, 150, 113]]) && vch.bsuiteVars.leaf.C_VP_POS === 90, 'custom pos 90: the pane lies 600 wide x 150 high, C_VP_POS 90');
  // two intumescent strips
  const two = mk({ firedoorIntuStyle: 4 }).derived.firedoor;
  const tg = two.machining.leaf.filter((o) => o.kind === 'intuGroove');
  ok(J(two.intumescent) === J({ style: 4, label: '2No 15mm x 4mm', width: 15, thickness: 4, strips: 2, metres: 9.812 }) && tg.length === 6 && tg.filter((o) => o.strip === 1).every((o) => near(o.z, R(22 - FP.intumescent.twoStripOffset - 7.75), 0.001))
    && tg.filter((o) => o.strip === 2).every((o) => near(o.z, R(22 + FP.intumescent.twoStripOffset - 7.75), 0.001)) && tg.every((a) => tg.every((b) => a === b || a.face !== b.face || a.z + a.width <= b.z + 1e-6 || b.z + b.width <= a.z + 1e-6)),
    'intu style 4 (2No 15 x 4): 9.812 m, six grooves (two per edge) at LPZ / 2 +- twoStripOffset, never overlapping');
  // the frame depth
  const dp = mk({ firedoorFrameDepth: 150 }).derived.firedoor;
  ok(dp.frame.depth === 150 && dp.frame.rawWidth === 155 && dp.frame.members[0].section === '50x150' && dp.frame.members[0].rawSection === '63x155' && dp.bsuiteVars.head.LPY === 150 && opsOf({ firedoor: dp }, 'head', 'mitre')[0].depth === 150,
    'frame depth 150: members 50x150 raw 63x155, LPY 150, the mitre 150 deep');
  // free sizes, the hard limits, one door at a time
  const free = mk({ firedoorLeafWidth: 803 }).derived.firedoor;
  ok(free.leaf.width === 803 && free.frame.overall.width === 879 && free.bsuiteVars.leaf.LPY === 803 && opsOf({ firedoor: free }, 'leaf', 'spindleHole')[0].y === 743, 'a free width 803 derives without clamp: frame 879, LPY 803, spindle y 743');
  const results = [];
  for (const w of [200, 826, 1600]) {
    try { results.push({ w, ok: mk({ firedoorLeafWidth: w }, `FDR-0${w}`).derived.firedoor.frame.overall.width }); }
    catch (e) { results.push({ w, err: e }); }
  }
  ok(results[0].err instanceof fireDoor.FireDoorGeometryError && results[0].err.name === 'FireDoorGeometryError' && /FDR-0200/.test(results[0].err.message) && /200/.test(results[0].err.message) && results[0].err.details.value === 200 && results[0].err.details.door === 'FDR-0200',
    `a width 200 throws FireDoorGeometryError naming the door and the value: "${results[0].err?.message}"`);
  ok(results[1].ok === 902 && results[2].err instanceof fireDoor.FireDoorGeometryError, 'the 826 door in the same loop still derives (902); 1600 throws too');
  const thrown = (fc, name = 'X') => { try { mk(fc, name); return null; } catch (e) { return e; } };
  ok(thrown({ firedoorLeafHeight: 1200 }) instanceof fireDoor.FireDoorGeometryError && thrown({ firedoorLeafHeight: 3100 }) instanceof fireDoor.FireDoorGeometryError && thrown({ firedoorFrameDepth: 40 }) instanceof fireDoor.FireDoorGeometryError && thrown({ firedoorFrameDepth: 450 }) instanceof fireDoor.FireDoorGeometryError,
    'heights 1200 / 3100 and depths 40 / 450 throw; the limits are the profile leaf.limits');
  ok(thrown({ firedoorLeafWidth: 300 }) === null && thrown({ firedoorLeafWidth: 1500 }) === null && thrown({ firedoorLeafHeight: 1500 }) === null && thrown({ firedoorLeafHeight: 3000 }) === null && thrown({ firedoorFrameDepth: 50 }) === null && thrown({ firedoorFrameDepth: 400 }) === null,
    'the limit values themselves derive (300 / 1500 wide, 1500 / 3000 high, depth 50 / 400)');
  const hj = profile.withProfiles(null, null, null, null, { ...FP, frame: { ...FP.frame, headJoint: 'butt' } }, () => thrown({}, 'FDR-07'));
  ok(hj instanceof fireDoor.FireDoorGeometryError && /butt/.test(hj.message) && /FDR-07/.test(hj.message) && hj.details.headJoint === 'butt', "a headJoint other than 'mitre' fails the door with a message naming it");
  // the helpers
  ok(fireDoor.nextFireDoorName(['FDR-01', 'DR-01', 'W1'], true) === 'FDR-02' && fireDoor.nextFireDoorName(['FDR-01', 'DR-01', 'W1'], false) === 'DR-02', "nextFireDoorName over ['FDR-01', 'DR-01', 'W1']: FDR-02 and DR-02");
  ok(fireDoor.nextFireDoorName([], true) === 'FDR-01' && fireDoor.nextFireDoorName([], false) === 'DR-01' && fireDoor.nextFireDoorName(null, true) === 'FDR-01', 'an empty list gives FDR-01 / DR-01');
  ok(fireDoor.nextFireDoorName(['FDR-01', 'FDR-03', 'fdr-04'], true) === 'FDR-02' && fireDoor.nextFireDoorName(['DR-09'], false) === 'DR-01' && fireDoor.nextFireDoorName(['FDR-1', 'FDR-2'], true) === 'FDR-03' && fireDoor.nextFireDoorName(['DR-99', 'DR-100'], false) === 'DR-01',
    'the lowest free number per prefix, case insensitive, one- and three-digit names counted, a DR name never counts for FDR');
  ok(fireDoor.fireDoorLeafThickness(FP, true, 'FD30') === 44 && fireDoor.fireDoorLeafThickness(FP, true, 'FD60') === 54 && fireDoor.fireDoorLeafThickness(FP, false, 'FD60') === 44 && fireDoor.fireDoorLeafThickness(null, true, 'nope') === 44,
    'fireDoorLeafThickness: FD30 44, FD60 54, non-fire 44 whatever the rating, an unknown rating 44');
}

// ═════════════════════════════════════════════════════════════════════════════
// Sections 4+ (lists, BOM, assign materials, glass schedule, pricing, the sheets,
// the bSuite rows, the machining export, the Stage 0 controls) are appended
// here by the test agent. They need an esbuild bundle for the JSX sheets: see
// t50_partition.mjs build('t50-live', ...) and copy the pattern as 't51-live'.
// ═════════════════════════════════════════════════════════════════════════════

console.log(`\nt51: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
