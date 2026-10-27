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
  ok(FP.bsuite.activeTarget === 'fd-machine' && tgt.id === 'fd-machine' && J(Object.keys(tgt.programs)) === J(['leaf', 'head', 'jambHinge', 'jambLock'])
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
  ok(migA.bsuite.activeTarget === 'fd-machine' && migA.bsuite.targets.length === 1 && migA.bsuite.targets[0].programs.leaf.path === tgt.programs.leaf.path, 'an unknown activeTarget falls back to the default target');
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
  ok(h.topOffset === 150 && h.bottomOffset === 200, 'hinges carry the rule offsets topOffset 150 / bottomOffset 200 (the sheets print the rule from them, never a literal)');
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

// ═════════════════════════════════════════════════════════════════════════════
// Sections 4 to 12 (the test agent, Stage 4). The lists, the BOM and the Assign
// Materials rows, the pricing and the config bridge, the five sheets of six
// doors, the 3D mounted headless, the bSuite rows and the machining export, the
// Stage 0 controls (byte identical, a typed hash) and t32, the pack and window
// pages, the batch summary strip and the pre-cut panel. The JSX sheets, the
// pages and the 3D need esbuild bundles the way t50_partition.mjs builds them
// (build('t51-live', ...)); the bundles and the page copies live in .audit,
// which git ignores. The modules are loaded here, not at the top of the file,
// so sections 1 to 3b above stay exactly as the engine agent wrote them.
//   4  the lists: cut list rows and grouped symbols, pre-cut groups, glass
//      schedule rows, hardware lines and their slots, the DXF params;
//   5  the BOM: part quantities per slot (FD30 / FD60 / non-fire), material
//      lines, the merge of two doors, the Assign Materials rows and the
//      ironmongery categories, the registry, the PDFs a fire door reaches;
//   6  pricing (zero rates give 0 without a throw) and windowSpecToConfig;
//   7  the sheets: six doors x five sheets, no NaN / undefined / Infinity /
//      long dash, no text collisions, the dimension rule on the inside
//      elevation and the leaf sheet, the reference strings, elementsPlan,
//      the Drawings panel tabs;
//   8  the 3D: fireDoorGeometryFromSpec and the model mounted headless;
//   9  the export: buildBsuiteFireDoorRows (default profile and dummy frame
//      paths), the document variables of 4.7, the STOP rows in the sample's
//      form, the ZIP round trip, the machining rows, CSV and JSON;
//  10  the controls: the Stage 0 dump compared file by file and by a typed
//      hash, t32 unchanged (54 passed, 0 failed);
//  11  the pages: overview cells, the glass groups, the Elements / Elevations /
//      Glass / Spraying tabs, the pack and window pages through the router;
//  12  the batch summary strip and the pre-cut panel label.
// ═════════════════════════════════════════════════════════════════════════════
const { execFileSync } = await import('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
const { resolve, dirname } = await import('node:path');
const { fileURLToPath, pathToFileURL } = await import('node:url');
const { inflateRawSync } = await import('node:zlib');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { checkDimRule } = await import('../arch/lib/dimRule.mjs');
const { collisionFailures, describeFailures, textBoxes } = await import('../arch/lib/textCollision.mjs');
const h = React.createElement;
// zustand 5 hands useSyncExternalStore the store's INITIAL state as the server
// snapshot; the pages rendered below must read the seeded state (the C4 technique)
const origUSES = React.useSyncExternalStore;
React.useSyncExternalStore = (sub, get) => origUSES(sub, get, get);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
const ESBUILD = ['-y', 'esbuild@0.25.0'];
const build = (name, lines, extra = []) => {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  writeFileSync(entry, lines.join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', [...ESBUILD, entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three', ...extra,
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return pathToFileURL(out).href;
};
// a copy of a page with absolute imports, the 3D viewers stubbed and its inner
// helpers exported (only the names the page really holds, so a helper that moves
// to a utils module never breaks the bundle)
const copyPage = (name, stubs, names) => {
  let src = readFileSync(resolve(ROOT, `src/pages/${name}.jsx`), 'utf8');
  src = src.replace(/from '\.\.\//g, `from '${ROOT}/src/`);
  for (const [imp, stub] of stubs) {
    if (!src.includes(imp)) throw new Error(`t51: stub target missing in ${name}: ${imp}`);
    src = src.replace(imp, stub);
  }
  const present = names.filter((n) => new RegExp(`\\b${n}\\b`).test(src));
  src += `\nexport { ${present.join(', ')} };\n`;
  const p = resolve(AUDIT, `t51-${name}-copy.jsx`);
  writeFileSync(p, src);
  return p;
};
const pppCopy = copyPage('ProductionPackPage', [
  [`import WindowPreview3D from '${ROOT}/src/components/viewer/WindowPreview3D.jsx';`, 'const WindowPreview3D = () => null;'],
  [`import Window3DCaptureRig from '${ROOT}/src/components/viewer/Window3DCaptureRig.jsx';`, 'const Window3DCaptureRig = () => null;'],
], ['overviewCells', 'winBarsLabel', 'ElevationsTab', 'ElementsTab', 'GlassTab', 'SprayingTab', 'groupFireDoorGlass']);
const wdpCopy = copyPage('WindowDetailPage', [
  [`import ThreeDPanel from '${ROOT}/src/components/dashboard/ThreeDPanel.jsx';`, 'const ThreeDPanel = () => null;'],
], ['GlassPanel', 'BOMPanel', 'groupFireDoorGlass']);
const liveUrl = build('t51-live', [
  ...['specification', 'calculations', 'profile', 'lists', 'bom', 'pricing', 'partRegistry', 'partColours', 'optimizer'].map((m) => `export * as ${m} from '${resolve(ROOT, `src/engine/${m}.js`)}';`),
  `export * as store from '${resolve(ROOT, 'src/stores/materialAssignmentStore.js')}';`,
  `export * as iron from '${resolve(ROOT, 'src/stores/ironmongeryStore.js')}';`,
  `export { useProjectStore } from '${resolve(ROOT, 'src/stores/projectStore.js')}';`,
  `export * as cfg from '${resolve(ROOT, 'src/utils/windowSpecToConfig.js')}';`,
  `export * as bsuite from '${resolve(ROOT, 'src/utils/bsuiteExport.js')}';`,
  `export * as machining from '${resolve(ROOT, 'src/utils/fireDoorMachiningExport.js')}';`,
  `export * as batchSummary from '${resolve(ROOT, 'src/utils/batchSummary.js')}';`,
  `export { elementsPlan } from '${resolve(ROOT, 'src/utils/elementsPayload.js')}';`,
  `export * as precutPdf from '${resolve(ROOT, 'src/utils/precutPdfExport.js')}';`,
  `export * as glassDxf from '${resolve(ROOT, 'src/utils/glassDxfExport.js')}';`,
  `export * as glassPdf from '${resolve(ROOT, 'src/utils/glassPdfExport.js')}';`,
  `export * as bomPdf from '${resolve(ROOT, 'src/utils/bomPdfExport.js')}';`,
  `export * as cutPdf from '${resolve(ROOT, 'src/utils/cutListPdfExport.js')}';`,
  `export * as fdu from '${resolve(ROOT, 'src/components/drawings/fireDoorDrawUtils.js')}';`,
  `export { default as FireDoorSheet } from '${resolve(ROOT, 'src/components/drawings/FireDoorSheet.jsx')}';`,
  `export { default as DrawingsPanel } from '${resolve(ROOT, 'src/components/drawings/DrawingsPanel.jsx')}';`,
  `export { default as PreCutPanel } from '${resolve(ROOT, 'src/components/dashboard/PreCutPanel.jsx')}';`,
  `export * as PPP from '${pppCopy}';`,
  `export * as WDP from '${wdpCopy}';`,
  "export { MemoryRouter, Routes, Route } from 'react-router-dom';",
], ['--external:react-router-dom', '--external:@react-three/fiber', '--external:@react-three/drei']);
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist|Calc failed|localStorage/i.test(String(a[0]))) return; warn(...a); };
const M = await import(`${liveUrl}?t=${Date.now()}`);

// the doors of sections 4 to 12 derive on the bundle's own engine instance
const mkB = (fc = {}, name = 'FDR-01', item = {}) => {
  const spec = M.specification.normaliseToWindowSpec({ id: `d-${name}`, name, width: 0, height: 0, ...item }, { fullConfig: { windowCategory: 'firedoor', ...fc } });
  return { spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const render = (C, props) => renderToStaticMarkup(h(C, props));
const count = (s, re) => (String(s).match(re) || []).length;
const has = (s, t) => String(s).includes(t);
// the Tj strings of a jsPDF document (latin1 and UTF-16 runs), for the PDF checks
const pdfStrings = (buf) => [...Buffer.from(buf).toString('latin1').matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)].map((m) => {
  const raw = m[1].replace(/\\(.)/gs, '$1');
  if (!raw.includes('\0')) return raw;
  let t = '';
  for (let i = 0; i + 1 < raw.length; i += 2) t += String.fromCharCode((raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1));
  return t;
});
const CTX = { assignments: {}, assignmentsData: { schema: 2, base: {}, overrides: {} }, materials: [], ALL_PARTS: M.store.ALL_PARTS, ironmongeryItems: [], settings: {} };

// ═════════════════════════════════════════════════════════════════════════════
section('4 - the lists: cut list, grouped symbols, pre-cut, glass schedule, hardware');
{
  const R = mkB();
  const cut = M.lists.buildCutListForWindow(R.derived, R.spec);
  const byEl = Object.fromEntries(cut.map((r) => [r.element, r]));
  ok(cut.length === 4 && byEl['FD-HEAD']?.length === 902 && byEl['FD-JAMB-H']?.length === 2083 && byEl['FD-JAMB-L']?.length === 2083 && byEl['FD-LEAF']?.length === 2040,
    `cut list: 4 rows, FD-HEAD 902, FD-JAMB-H 2083, FD-JAMB-L 2083, FD-LEAF 2040 (${cut.map((r) => `${r.element} ${r.length}`).join(', ')})`);
  ok(byEl['FD-HEAD']?.section === '50x100' && byEl['FD-JAMB-H']?.section === '50x100' && byEl['FD-JAMB-L']?.section === '50x100' && byEl['FD-LEAF']?.section === '44x826' && cut.every((r) => r.qty === 1 || r.quantity === 1),
    'cut list: the finished sections 50x100 on the members, 44x826 on the leaf, quantity 1 each');
  const groups = M.lists.buildGroupedCutList(cut.map((r) => ({ ...r, windowName: 'FDR-01' })));
  ok(J(groups.map((g) => g.symbol)) === J(['LEAF', 'FH', 'HJ', 'LJ']), `grouped cut list symbols LEAF / FH / HJ / LJ in the CUT_LIST_ORDER (${groups.map((g) => g.symbol).join(' ')}), no ? group`);
  ok(groups.every((g) => typeof g.rows[0].notes === 'string') && groups[0].rows[0].notes === 'door blank FD30', `the grouped FD- rows keep their notes (leaf "${groups[0].rows[0].notes}")`);
  ok(groups.every((g) => M.partColours.partColourForElement(g.element)) && M.partColours.PART_COLOUR_GROUPS.some((g) => g.id === 'fire_door_head'), 'every FD- group has a part colour; the fire_door_head colour group exists');
  const cas = (() => { const sp = M.specification.normaliseToWindowSpec({ id: 'c', name: 'W', width: 1000, height: 1200 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L' } }); return { spec: sp, derived: M.calculations.deriveWindowData(sp, {}) }; })();
  const cg = M.lists.buildGroupedCutList(M.lists.buildCutListForWindow(cas.derived, cas.spec).map((r) => ({ ...r, windowName: 'W' })));
  ok(cg.length > 0 && cg.every((g) => g.rows.every((r) => !('notes' in r))), 'a casement grouped cut list still carries no notes key (control)');
  // pre-cut: the three members in one raw group, never the leaf
  const pc = M.lists.buildPrecutForWindow(R.derived, R.spec, {}, null);
  const items = [...pc.sashEngineering.flatMap((g) => g.items), ...pc.boxSapele.flatMap((g) => g.items)];
  ok(pc.sashEngineering.length === 1 && pc.boxSapele.length === 0 && pc.sashEngineering[0].section === '63x105' && items.length === 3 && items.every((it) => it.section === '63x105'),
    `pre-cut: one 63x105 group of 3 members, boxSapele empty (${items.map((it) => `${it.elementName} ${it.length}`).join(', ')})`);
  ok(items.find((it) => it.elementName === 'FD-HEAD')?.length === 912 && items.filter((it) => /JAMB/.test(it.elementName)).every((it) => it.length === 2093) && items.every((it) => it.length === it.finishedLength + 10),
    'pre-cut lengths 912 / 2093 / 2093 (finished + the 10 allowance)');
  ok(!items.some((it) => it.elementName === 'FD-LEAF'), 'pre-cut: no leaf (a bought blank)');
  const pc15 = M.lists.buildPrecutForWindow(R.derived, R.spec, { precutAllowance: 15 }, null);
  ok(pc15.sashEngineering[0].items.every((it) => it.length === it.finishedLength + 15), 'a 15 mm pre-cut allowance setting is honoured');
  const resolveRaw = M.bom.makeRawResolver({ assignments: {}, assignmentsData: { schema: 2, base: { fd_frame_timber: { material_id: 'm1', yield: 1 } }, overrides: {} }, materials: [{ id: 'm1', name: 'Sapele 63x110', size: '63 x 110mm' }] });
  ok(M.lists.buildPrecutForWindow(R.derived, R.spec, {}, resolveRaw).sashEngineering[0].section === '63x110', 'an assigned frame timber drives the raw section (63x110)');
  ok(M.lists.buildPrecutForWindow(R.derived, R.spec, { sectionMap: { '50x100': '63x120' } }, null).sashEngineering[0].section === '63x120', 'the pre-cut section map is honoured before the record raw section');
  ok(J(M.bom.ELEMENT_TO_PART_ID['FD-HEAD']) === J('fd_frame_timber') && M.bom.ELEMENT_TO_PART_ID['FD-JAMB-H'] === 'fd_frame_timber' && M.bom.ELEMENT_TO_PART_ID['FD-JAMB-L'] === 'fd_frame_timber' && !M.bom.ELEMENT_TO_PART_ID['FD-LEAF'],
    'ELEMENT_TO_PART_ID: the three members buy fd_frame_timber, the leaf is not timber metres');
  const lab = M.precutPdf.labelForPiece(items[0], { mode: 'part' });
  ok(lab.part && !/^FD-/.test(lab.part) && lab.colour === M.partColours.PART_COLOUR_GROUPS.find((g) => g.id === 'fire_door_head').hex, `pre-cut label part "${lab.part}" without the FD- prefix, the head colour`);
  // glass schedule rows from the vision panels
  const g1 = mkB({ firedoorVpStyle: 1 });
  const rows = M.lists.buildGlassListForWindow(g1.derived, g1.spec);
  ok(rows.length === 1 && rows[0].width === 450 && rows[0].height === 450 && rows[0].type === 'fire' && rows[0].bars === 'none' && /vision panel 1/.test(rows[0].location) && rows[0].thickness === 6,
    `glass schedule style 1: one 450 x 450 fire row, bars none, thickness 6, location "${rows[0]?.location}"`);
  ok(M.lists.buildGlassListForWindow(R.derived, R.spec).length === 0, 'glass schedule style 0: no rows');
  const gn = mkB({ firedoorVpStyle: 1, firedoorFire: false }, 'DR-01');
  ok(M.lists.buildGlassListForWindow(gn.derived, gn.spec)[0]?.type === 'toughened', 'glass schedule non-fire: toughened');
  const g2 = mkB({ firedoorVpStyle: 2 });
  const r2 = M.lists.buildGlassListForWindow(g2.derived, g2.spec);
  ok(r2.length === 2 && r2[0].width === 150 && r2[0].height === 760 && r2[1].width === 150 && r2[1].height === 450, `glass schedule style 2: two rows 150 x 760 + 150 x 450 (${r2.map((r) => `${r.width}x${r.height}`).join(', ')})`);
  const dx = M.glassDxf.glassDxfParamsForWindow(g1.spec, g1.derived, 'FDR-01');
  ok(!dx.skip && dx.params.units.length === 1 && dx.params.units[0].rect.width === 450 && dx.params.units[0].rect.height === 450, 'glass DXF: the vision panel exports as one 450 x 450 rectangular unit');
  ok(M.glassDxf.glassDxfParamsForWindow(R.spec, R.derived, 'x').skip === 'no glass unit', 'glass DXF: a style 0 door is skipped with "no glass unit"');
  // hardware lines
  const e = mkB({ firedoorLockType: 'euro', firedoorCloser: true });
  const hw = M.lists.buildHardwareList(e.spec, e.derived);
  ok(hw.length === 7 && J(hw.map((x) => x.item)) === J(['Fire door hinge', 'Lock case, sashlock euro', 'Euro cylinder', 'Lever handle set', 'Keep', 'Concealed closer', 'Intumescent strip']),
    `hardware euro + closer: 7 lines in order (${hw.map((x) => x.item).join(' | ')})`);
  ok(J(hw.map((x) => x.partId)) === J(['fd_hinge_fire', 'fd_lock_euro', 'fd_cylinder_euro', 'fd_handle_set', 'fd_keep', 'fd_closer', 'fd_intu_15']) && hw.every((x) => x.enginePart === true),
    'hardware partIds fd_hinge_fire / fd_lock_euro / fd_cylinder_euro / fd_handle_set / fd_keep / fd_closer / fd_intu_15, every line enginePart');
  ok(J(hw.map((x) => x.quantity)) === J([3, 1, 1, 1, 1, 1, 4.906]) && hw[6].unit === 'm', 'hardware quantities 3 / 1 / 1 / 1 / 1 / 1 / 4.906 m');
  ok(/150 \/ 944 \/ 1738/.test(hw[0].detail) && /Hinge left/.test(hw[0].detail), `the hinge detail carries the positions and the handing ("${hw[0].detail}")`);
  const b = mkB({ firedoorLockType: 'bathroom', firedoorFire: false, firedoorCloser: false }, 'DR-01');
  ok(J(M.lists.buildHardwareList(b.spec, b.derived).map((x) => x.item)) === J(['Door hinge', 'Lock case, bathroom', 'Thumbturn and release', 'Lever handle set', 'Keep']), 'hardware non-fire bathroom: Door hinge, Lock case bathroom, Thumbturn and release, Lever handle set, Keep');
  ok(J(M.lists.buildHardwareList(R.spec, R.derived).map((x) => x.item)) === J(['Fire door hinge', 'Lock case, latch', 'Lever handle set', 'Keep', 'Concealed closer', 'Intumescent strip']), 'hardware default latch door: 6 lines, no cylinder');
  const K = M.bom.HARDWARE_TO_SLOT_KEY;
  ok(K['Lock case, latch'] === 'fireDoorLocks' && K['Lock case, sashlock euro'] === 'fireDoorLocks' && K['Lock case, bathroom'] === 'fireDoorLocks' && K['Keep'] === 'keeps' && K['Concealed closer'] === 'doorClosers' && K['Fire door hinge'] === 'doorHinges' && K['Door hinge'] === 'doorHinges' && K['Euro cylinder'] === 'cylinders' && K['Lever handle set'] === 'doorHandles',
    'HARDWARE_TO_SLOT_KEY: locks -> fireDoorLocks, keep -> keeps, closer -> doorClosers, hinges -> doorHinges, cylinder -> cylinders, handle -> doorHandles');
  const IRN = [{ id: 'irn-h', name: 'Royde & Tucker H102', category: 'doorHinges', unit: 'pcs', cost_per_unit: 4 }];
  const specH = { ...e.spec, hardware: { ...e.spec.hardware, slots: { doorHinges: 'irn-h' } } };
  const wh = M.bom.buildWindowHardware(specH, null, IRN, e.derived);
  ok(wh.length === 7 && wh[0].product?.id === 'irn-h' && wh[1].product === null, 'buildWindowHardware accepts a firedoor and resolves the hinge slot product');
  const dr = M.bom.windowHardwareDetailRows(specH, null, IRN, e.derived);
  ok(dr.length === 7 && dr[0].item === 'Royde & Tucker H102' && dr.every((r) => !('assigned' in r)), 'windowHardwareDetailRows: 7 rows, the product name on the hinge line, no "assigned" on engine lines');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - the BOM: slots per door, material lines, the merge, the Assign Materials rows, the PDFs');
{
  const e = mkB({ firedoorVpStyle: 1, firedoorLockType: 'euro', firedoorCloser: true });
  const q = M.bom.buildWindowPartQtys(e.derived, e.spec, {}, null);
  const pc = M.lists.buildPrecutForWindow(e.derived, e.spec, {}, null);
  const mm = pc.sashEngineering.flatMap((g) => g.items).reduce((a, it) => a + it.length * it.quantity, 0);
  ok(q.fd_blank_fd30?.qty === 1 && q.fd_blank_fd30.unit === 'pcs' && !q.fd_blank_fd60 && !q.fd_blank_std, 'fd_blank_fd30 1 pcs, no other blank');
  ok(q.fd_frame_timber?.mm === mm && mm === 912 + 2093 * 2, `fd_frame_timber mm = the pre-cut sum ${mm} (912 + 2 x 2093)`);
  ok(q.fd_hinge_fire?.qty === 3 && !q.fd_hinge_std, 'fd_hinge_fire 3, no standard hinge');
  ok(q.fd_lock_euro?.qty === 1 && q.fd_cylinder_euro?.qty === 1 && !q.fd_lock_latch && !q.fd_lock_bathroom && !q.fd_thumbturn, 'fd_lock_euro 1, fd_cylinder_euro 1, no latch / bathroom / thumbturn');
  ok(q.fd_handle_set?.qty === 1 && q.fd_keep?.qty === 1 && q.fd_closer?.qty === 1, 'fd_handle_set 1, fd_keep 1, fd_closer 1');
  ok(near(q.fd_intu_15?.qty, 4.906) && q.fd_intu_15.unit === 'm' && !q.fd_intu_10 && !q.fd_intu_20, 'fd_intu_15 4.906 m, no 10 / 20 rows');
  ok(q.fd_glass_fire?.qty === 0.2 && q.fd_glass_fire.unit === 'm²' && near(e.derived.firedoor.vp.glassSqm, 0.2025) && !q.fd_glass_toughened && !q.glass_double,
    `fd_glass_fire ${q.fd_glass_fire?.qty} m2 (consumables.glass.sqm rounded to 2 dp as the casement; vp.glassSqm ${e.derived.firedoor.vp.glassSqm}), no toughened / window glass rows`);
  ok(near(q.fd_glazing_bead?.qty, 3.6) && q.fd_glazing_bead.unit === 'm' && near(q.fd_glazing_intu?.qty, 1.8) && q.fd_glazing_intu.unit === 'm',
    `fd_glazing_bead ${q.fd_glazing_bead?.qty} m (perimeter 1.8 x 2 faces), fd_glazing_intu ${q.fd_glazing_intu?.qty} m (the perimeter)`);
  ok(q.c_paint_primer?.qty > 0 && q.c_paint_white_9016?.qty > 0 && q.c_paint_preserver?.qty > 0 && !q.paint_primer, 'paint on the c_paint_* rows (the external door rule)');
  ok(!q.weights_normal && !q.weights_slim && !q.cord && !q.silicone && !q.c_silicone && !q.c_glazing_packer, 'no counterweight, cord, silicone or packer rows');
  const ALL = new Set(M.store.ALL_PARTS.map((p) => p.id));
  ok(Object.keys(q).every((k) => ALL.has(k)), 'every quantity the BOM writes is a row of ALL_PARTS', Object.keys(q).filter((k) => !ALL.has(k)).join(','));
  const n = mkB({ firedoorFire: false, firedoorVpStyle: 1 }, 'DR-01');
  const qn = M.bom.buildWindowPartQtys(n.derived, n.spec, {}, null);
  ok(qn.fd_blank_std?.qty === 1 && qn.fd_hinge_std?.qty === 3 && qn.fd_lock_latch?.qty === 1 && !qn.fd_closer && !qn.fd_intu_15 && !qn.fd_intu_10 && !qn.fd_intu_20 && !qn.fd_glazing_intu && qn.fd_glass_toughened?.qty === 0.2 && !qn.fd_glass_fire,
    'non-fire: fd_blank_std, fd_hinge_std 3, fd_lock_latch, no closer, no fd_intu_* and no fd_glazing_intu rows, toughened glass 0.2');
  const s60 = mkB({ firedoorRating: 'FD60' });
  const q60 = M.bom.buildWindowPartQtys(s60.derived, s60.spec, {}, null);
  ok(q60.fd_blank_fd60?.qty === 1 && !q60.fd_blank_fd30 && q60.fd_hinge_fire?.qty === 3, 'FD60: fd_blank_fd60 1, fire hinges');
  const ba = mkB({ firedoorLockType: 'bathroom' });
  const qb = M.bom.buildWindowPartQtys(ba.derived, ba.spec, {}, null);
  ok(qb.fd_lock_bathroom?.qty === 1 && qb.fd_thumbturn?.qty === 1 && !qb.fd_cylinder_euro, 'bathroom: fd_lock_bathroom 1, fd_thumbturn 1, no cylinder');
  // material lines and the merge
  const lines = M.bom.buildWindowMaterialLines({ derived: e.derived, windowSpec: e.spec, batch: null }, CTX);
  const keys = lines.map((l) => l.key);
  ok(lines.length > 0 && new Set(keys).size === keys.length && !lines.some((l) => l.line), `${lines.length} material lines, unique keys, no ghost hardware line`);
  const one = M.bom.mergeWindowMaterials([{ derived: e.derived, windowSpec: e.spec, batch: null }], CTX);
  const two = M.bom.mergeWindowMaterials([{ derived: e.derived, windowSpec: e.spec, batch: null }, { derived: e.derived, windowSpec: e.spec, batch: null }], CTX);
  ok(one.length === two.length && one.length === lines.length && one.every((r) => near(two.find((x) => x.key === r.key).qty, 2 * r.qty)), 'mergeWindowMaterials of two doors = exactly double one door');
  const cards = M.bom.windowBomCards(lines);
  ok(cards.rows.length === one.length && cards.hardware.length === 0 && cards.unassigned.parts.length === lines.length, 'windowBomCards: every line unassigned (no materials), no hardware card');
  const IRN = [{ id: 'irn-h', name: 'Royde & Tucker H102', category: 'doorHinges', unit: 'pcs', cost_per_unit: 4 }];
  const l2 = M.bom.buildWindowMaterialLines({ derived: e.derived, windowSpec: { ...e.spec, hardware: { ...e.spec.hardware, slots: { doorHinges: 'irn-h' } } }, batch: null }, { ...CTX, ironmongeryItems: IRN });
  const hl = l2.find((l) => l.part?.id === 'fd_hinge_fire');
  ok(hl && hl.key === 'mat:irn-h' && hl.qty === 3 && hl._assigned, 'the hinge slot product is what the hinge row buys (3 pcs)');
  const ordered = lines.map((l) => M.store.ALL_PARTS.findIndex((p) => p.id === l.part.id));
  ok(ordered.every((v, i) => i === 0 || v > ordered[i - 1]), 'the lines keep the Assign Materials order');
  // the Assign Materials rows, the registry, the ironmongery categories
  const ids = M.store.FIREDOOR_ALL_PARTS.map((p) => p.id);
  const WANT = ['fd_blank_fd30', 'fd_blank_fd60', 'fd_blank_std', 'fd_frame_timber', 'fd_hinge_fire', 'fd_hinge_std', 'fd_lock_latch', 'fd_lock_euro', 'fd_lock_bathroom', 'fd_cylinder_euro', 'fd_thumbturn', 'fd_handle_set', 'fd_keep', 'fd_closer', 'fd_intu_10', 'fd_intu_15', 'fd_intu_20', 'fd_glass_fire', 'fd_glass_toughened', 'fd_glazing_bead', 'fd_glazing_intu'];
  ok(ids.length === 21 && J(ids) === J(WANT), `FIREDOOR_ALL_PARTS: the 21 ids of the contract (${ids.length})`, J(ids));
  const all = M.store.ALL_PARTS.map((p) => p.id);
  ok(J(all.slice(-21)) === J(WANT) && new Set(all).size === all.length && WANT.every((id) => all.filter((x) => x === id).length === 1), 'the 21 ids are present once in ALL_PARTS and last');
  ok(all.indexOf('fd_blank_fd30') > all.indexOf(M.store.DOOR_ALL_PARTS[M.store.DOOR_ALL_PARTS.length - 1].id), 'after the last external door row');
  ok(M.store.FIREDOOR_ALL_PARTS.every((p) => p.windowType === 'firedoor' && p.name && p.unit && p.materialType && p.hint), 'every row has windowType firedoor, name, unit, materialType, hint');
  const byId = Object.fromEntries(M.store.FIREDOOR_ALL_PARTS.map((p) => [p.id, p]));
  ok(byId.fd_blank_fd30.section === '44mm' && byId.fd_blank_fd60.section === '54mm' && byId.fd_blank_std.section === '44mm' && byId.fd_frame_timber.section === '63 x (depth + 5)' && byId.fd_intu_15.section === '15 x 4' && byId.fd_glass_fire.section === '6mm',
    'row sections from the profile: 44mm / 54mm / 44mm, 63 x (depth + 5), 15 x 4, 6mm');
  ok(['fd_blank_fd30', 'fd_blank_fd60', 'fd_blank_std', 'fd_frame_timber'].every((id) => byId[id].unit === (id === 'fd_frame_timber' ? 'm' : 'pcs')) && ['fd_intu_10', 'fd_intu_15', 'fd_intu_20', 'fd_glazing_bead', 'fd_glazing_intu'].every((id) => byId[id].unit === 'm') && byId.fd_glass_fire.unit === 'm²' && byId.fd_glass_toughened.unit === 'm²',
    'units: blanks pcs, frame timber m, strips and beads m, glass m²');
  ok(!/[\u2013\u2014]/.test(J(M.store.FIREDOOR_ALL_PARTS)), 'no en / em dash in the fire door rows');
  const data = { schema: 2, base: Object.fromEntries(ids.map((id) => [id, { material_id: `m-${id}`, yield: 1 }])), overrides: {} };
  ok(ids.every((id) => M.partRegistry.legacyToCanonical(id).key === id && M.partRegistry.legacyToCanonical(id).variantKey === null), 'legacyToCanonical maps every fd_ id to itself');
  ok(ids.every((id) => M.partRegistry.assignmentFor(data, id)?.material_id === `m-${id}`) && ids.every((id) => M.bom.effectiveAssignment(id, 'standard', data, null)?.material_id === `m-${id}`) && ids.every((id) => !M.partRegistry.PART_DEFAULT_FROM[id]),
    'assignmentFor and effectiveAssignment resolve every fd_ id, none with a counterpart');
  ok(ids.every((id) => M.partRegistry.expandAssignments(data)[id]?.material_id === `m-${id}`), 'expandAssignments keeps every fd_ id');
  const cats = M.iron.IRONMONGERY_CATEGORIES;
  const cat = (k) => cats.find((c) => c.key === k);
  ok(cat('doorHandles').alsoFor.includes('firedoor') && cat('doorHinges').alsoFor.includes('firedoor') && cat('cylinders').alsoFor.includes('firedoor'), 'alsoFor firedoor on doorHandles, doorHinges, cylinders');
  ok(cat('fireDoorLocks')?.windowType === 'firedoor' && cat('fireDoorLocks').label === 'Fire Door Locks' && cat('keeps')?.windowType === 'firedoor' && cat('keeps').label === 'Keeps' && cat('doorClosers')?.windowType === 'firedoor' && cat('doorClosers').label === 'Door Closers',
    'the new categories fireDoorLocks / keeps / doorClosers, windowType firedoor');
  ok(cats[cats.length - 1].key === 'other' && new Set(cats.map((c) => c.key)).size === cats.length, 'Others stays the last tab, keys unique');
  ok(M.store.FIREDOOR_ALL_PARTS.filter((p) => p.materialType === 'ironmongery').every((p) => p.defaultCategory && cats.some((c) => c.key === p.defaultCategory)), 'every ironmongery row opens on an existing ironmongery category');
  ok([...new Set(Object.values(M.bom.HARDWARE_TO_SLOT_KEY))].every((k) => cats.some((c) => c.key === k)), 'every HARDWARE_TO_SLOT_KEY target is an ironmongery category');
  // the PDFs a fire door reaches (jsPDF in node, returnDoc)
  const R = mkB();
  const pcR = M.lists.buildPrecutForWindow(R.derived, R.spec, {}, null);
  [...pcR.sashEngineering, ...pcR.boxSapele].forEach((g) => g.items.forEach((it) => { it.windowName = 'FDR-01'; it._projectNumber = '115'; it.windowId = 'id1'; }));
  const opt = M.optimizer.optimisePrecut(pcR, { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 2500 });
  const pgroups = pcR.sashEngineering.map((g) => ({ key: `sash-${g.section}`, label: g.section, type: 'sash', section: g.section, items: g.items }));
  try {
    const bytes = M.precutPdf.exportPreCutPDF({ groups: pgroups, optimization: opt, settings: {}, batch: { name: 't51' }, projects: [], isPPMode: false, format: 'a4', content: 'both', colourMode: 'part', returnDoc: true, windowList: [] });
    const txt = pdfStrings(bytes);
    ok(bytes && bytes.byteLength > 2000 && txt.some((x) => /COLOUR KEY/.test(x) && /FIRE DOOR/.test(x)), `the pre-cut PDF builds in part colour mode with a COLOUR KEY · FIRE DOOR page (${bytes?.byteLength} bytes)`, txt.filter((x) => /KEY/.test(x)).join(' | '));
    ok(txt.includes('Frame Head') && txt.includes('Frame Jambs') && txt.includes('Door Leaf') && !txt.some((x) => /^FD-/.test(x)) && !txt.some((x) => /COLOUR KEY . (CASEMENT|DOOR|PARTITION WALL)$/.test(x)),
      'the key legend names the head, the jambs and the leaf; no FD- prefix; no casement / door / partition key page');
    const labels = M.precutPdf.buildLabelList(pgroups, opt, { mode: 'part', windowIndexOf: () => 0 });
    ok(labels.length === 3 && labels.every((l) => l.colour && !/^FD-/.test(l.part) && l.precut === l.cut + 10), `3 pre-cut labels, coloured by part, no prefix (${labels.map((l) => `${l.part} ${l.cut}`).join(', ')})`);
    const lb = M.precutPdf.exportPreCutLabelsPDF({ groups: pgroups, optimization: opt, settings: {}, batch: { name: 't51' }, colourMode: 'part', windowIndexOf: () => 0, returnDoc: true });
    ok(lb && lb.byteLength > 1000, 'the pre-cut labels PDF builds');
  } catch (err) { ok(false, 'the pre-cut PDF builds for a fire door', String(err?.stack || err).slice(0, 400)); }
  try {
    const cut = M.lists.buildCutListForWindow(e.derived, e.spec).map((r) => ({ ...r, windowName: 'FDR-01', _projectNumber: '115' }));
    const cgroups = M.lists.buildGroupedCutList(cut).map((g) => ({ symbol: g.symbol, element: g.label, mirror: g.mirror, section: g.section, rows: g.rows.map((r) => ({ projectNum: r.projectNum, window: r.window, length: r.length, qty: r.qty })) }));
    const buf = M.cutPdf.exportCutListPDF({ batch: { name: 't51' }, projects: [], companyName: 'HARNESS', isPPMode: false, totalPieces: 4, groups: cgroups, format: 'a3', returnDoc: true });
    const txt = pdfStrings(buf);
    ok(buf && buf.byteLength > 1000 && txt.includes('LEAF') && txt.includes('HJ') && txt.includes('LJ') && !txt.some((x) => /^FD-/.test(x)), `the cut list PDF builds: LEAF / HJ / LJ groups, no FD- prefix (${buf?.byteLength} bytes)`);
  } catch (err) { ok(false, 'the cut list PDF builds for a fire door', String(err?.stack || err).slice(0, 300)); }
  try {
    const list = M.bom.windowBomCards(lines).rows;
    const hrows = M.bom.windowHardwareDetailRows(e.spec, null, [], e.derived);
    const buf = M.bomPdf.exportBomPDF({ title: 't51', projects: ['115'], date: '27/10/2026', companyName: 'HARNESS', subtitle: 'BILL OF MATERIALS', scopeLabel: 'Window',
      rows: list.map((r) => ({ name: r.name, itemNumber: '', qty: M.bom.formatQty(r.qty, r.unit), unitCost: '-', estCost: '-', ironmongery: r.source === 'ironmongery', assigned: r._assigned })),
      total: '0.00', hardware: hrows, returnDoc: true });
    const txt = pdfStrings(buf);
    ok(buf && buf.byteLength > 1000 && txt.some((x) => /Door Blank FD30/.test(x)) && txt.some((x) => /Fire door hinge/.test(x)) && txt.some((x) => /Intumescent/.test(x)), `the window BOM PDF builds with the blank, the hinge line and the intumescent (${buf?.byteLength} bytes)`);
    const marked = txt.filter((x) => /unassigned/.test(x));
    ok(marked.length === lines.length, `"unassigned" printed once per material row (${lines.length}), never after an engine hardware line (${marked.length})`);
  } catch (err) { ok(false, 'the window BOM PDF builds for a fire door', String(err?.stack || err).slice(0, 300)); }
  try {
    const buf = M.glassPdf.exportGlassPDF({ batch: { label: 't51' }, windowsData: [{ win: { name: 'FDR-01', _projectNumber: '115' }, windowSpec: e.spec, derived: e.derived }], projects: [{ number: '115', name: 't51' }], companySettings: { companyName: 'HARNESS' }, returnDoc: true });
    const txt = pdfStrings(buf);
    ok(buf && buf.byteLength > 1000 && txt.some((x) => /450/.test(x)) && txt.some((x) => /fire/i.test(x)), `the glass PDF builds with the 450 x 450 fire pane (${buf?.byteLength} bytes)`);
  } catch (err) { ok(false, 'the glass PDF builds for a fire door', String(err?.stack || err).slice(0, 300)); }
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - pricing with zero rates, resolvePricing, windowSpecToConfig');
{
  const cfg = { width: 902, height: 2083, measurementType: 'box-to-box', windowCategory: 'firedoor', firedoorFire: true, firedoorRating: 'FD30', firedoorLeafWidth: 826, firedoorLeafHeight: 2040, firedoorFrameDepth: 100, firedoorCloser: true, firedoorVpSqm: 0.2025, firedoorFrameMetres: 5.068 };
  let p = null, threw = null;
  try { p = M.pricing.calculatePrice(cfg); } catch (err) { threw = err; }
  ok(!threw && p && p.unitPrice === 0 && p.totalPrice === 0 && p.breakdown.windowType === 'firedoor' && p.breakdown.closer === true && p.breakdown.frameMetres === '5.068', `calculatePrice at the zero default rates: 0 without throwing (windowType ${p?.breakdown?.windowType})`, String(threw));
  const p2 = M.pricing.calculatePrice(cfg, { firedoor: { leafPrice: 100, framePerM: 10, vpPerSqm: 200, closerPrice: 50 } });
  ok(near(p2.unitPrice, 241.18), `rates 100 / 10 / 200 / 50: ${p2.unitPrice} = 100 + 50.68 + 40.5 + 50`);
  const p3 = M.pricing.calculatePrice({ ...cfg, firedoorFrameMetres: undefined, firedoorCloser: false }, { firedoor: { leafPrice: 0, framePerM: 10, vpPerSqm: 0, closerPrice: 50 } });
  ok(near(p3.unitPrice, 50.68), `no frame metres given: head + 2 jambs from the config size (${p3.unitPrice} = 5.068 x 10), no closer price`);
  ok(J(M.pricing.DEFAULT_PRICING.firedoor) === J({ leafPrice: 0, framePerM: 0, vpPerSqm: 0, closerPrice: 0 }), 'DEFAULT_PRICING.firedoor { leafPrice 0, framePerM 0, vpPerSqm 0, closerPrice 0 }');
  const rp = M.pricing.resolvePricing({ casement: { basePriceMin: 1 } });
  ok(rp.firedoor && rp.firedoor.leafPrice === 0 && rp.firedoor.closerPrice === 0 && M.pricing.resolvePricing({ firedoor: { leafPrice: 7 } }).firedoor.framePerM === 0, 'a stored pricing without the firedoor block (or a partial one) resolves to the defaults');
  const sash = M.pricing.calculatePrice({ width: 1000, height: 1500, sashType: 'double', measurementType: 'box-to-box' });
  ok(sash.unitPrice > 0 && !sash.breakdown.windowType, 'a sash price is untouched (control)');
  // the config bridge
  const e = mkB({ firedoorVpStyle: 1, firedoorLockType: 'euro', firedoorCloser: true }, 'FDR-01', { width: 902, height: 2083 });
  const c = M.cfg.windowSpecToConfig(e.spec, e.derived);
  ok(c.windowCategory === 'firedoor' && c.width === 902 && c.height === 2083 && c.extWidth === 902 && c.extHeight === 2083, `windowSpecToConfig: category firedoor, ${c.width} x ${c.height}`);
  ok(c.firedoorFire === true && c.firedoorRating === 'FD30' && c.firedoorLeafWidth === 826 && c.firedoorLeafHeight === 2040 && c.firedoorFrameDepth === 100 && c.firedoorCloser === true,
    'windowSpecToConfig: the firedoor pricing fields (fire, FD30, 826 x 2040, depth 100, closer)');
  ok(near(c.firedoorVpSqm, 0.2025, 0.001) && near(c.firedoorFrameMetres, 5.068, 0.0001), `windowSpecToConfig: firedoorVpSqm ${c.firedoorVpSqm}, firedoorFrameMetres ${c.firedoorFrameMetres} (902 + 2 x 2083)`);
  ok(c.fireDoorGeo && c.fireDoorGeo.totalWidth === 902 && c.fireDoorOpen === 30 && typeof c.woodColor === 'string' && c.woodColor.startsWith('#'), 'windowSpecToConfig: fireDoorGeo, fireDoorOpen 30, a wood colour');
  ok(M.cfg.windowSpecToConfig(e.spec).fireDoorGeo?.leaf?.w === 826, 'windowSpecToConfig without derived: the bridge derives the door itself');
  const pr = M.pricing.calculatePrice(c);
  ok(pr.unitPrice === 0 && pr.breakdown.windowType === 'firedoor', 'the bridged config prices at 0 through calculatePrice');
  ok(pr.breakdown.frameWidth === 902 && pr.breakdown.frameHeight === 2083 && pr.breakdown.frameMetres === '5.068',
    `the bridged breakdown prints the door's overall 902 x 2083 (not the brick-to-brick 1052 x 2158 of frameDims): ${pr.breakdown.frameWidth} x ${pr.breakdown.frameHeight}`);
  const p4 = M.pricing.calculatePrice({ ...cfg, measurementType: undefined, firedoorFrameMetres: undefined }, { firedoor: { leafPrice: 0, framePerM: 10, vpPerSqm: 0, closerPrice: 0 } });
  ok(near(p4.unitPrice, 50.68) && p4.breakdown.frameWidth === 902 && p4.breakdown.frameHeight === 2083, `no measurement type and no metres: the fallback metres come from the stored overall (${p4.unitPrice} = 5.068 x 10), never from the +150 / +75 allowance`);
  const sp = M.specification.normaliseToWindowSpec({ id: 'S', name: 'S', width: 1000, height: 1600 }, { fullConfig: {} });
  const cp = M.specification.normaliseToWindowSpec({ id: 'C', name: 'C', width: 1000, height: 1200 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L' } });
  ok(M.cfg.fireDoorGeometryFromSpec(sp) === null && M.cfg.fireDoorGeometryFromSpec(cp) === null && M.cfg.windowSpecToConfig(sp).fireDoorGeo === undefined && M.cfg.windowSpecToConfig(cp).fireDoorGeo === undefined,
    'a sash and a casement get no fire door geometry and no fireDoorGeo');
  let bad = null, badThrew = false;
  const badSpec = M.specification.normaliseToWindowSpec({ id: 'bad', name: 'BAD', width: 0, height: 0 }, { fullConfig: { windowCategory: 'firedoor', firedoorLeafWidth: 100 } });
  try { bad = M.cfg.windowSpecToConfig(badSpec); } catch { badThrew = true; }
  ok(!badThrew && bad && bad.windowCategory === 'firedoor' && bad.fireDoorGeo === undefined, 'a leaf 100 wide (sanity error): the bridge never throws, a config without fireDoorGeo');
}

// ═════════════════════════════════════════════════════════════════════════════
section('7 - the sheets: six doors x five sheets, collisions, the dimension rule, the reference strings, the Drawings panel');
{
  const BASE = { firedoorFire: true, firedoorRating: 'FD30', firedoorLeafWidth: 826, firedoorLeafHeight: 2040, firedoorFrameDepth: 100, firedoorHingeSide: 'left', firedoorSwing: 'in', firedoorLockType: 'euro', firedoorCloser: true, firedoorVpStyle: 1, firedoorIntuStyle: 1, firedoorLeadEdge: true };
  const door = (key, name, extra) => ({ key, name, ...mkB({ ...BASE, ...extra }, name, { width: 902, height: 2083 }) });
  const DOORS = [
    door('ref', 'FDR-01', {}),
    door('right', 'FDR-02', { firedoorHingeSide: 'right' }),
    door('nonfire-latch', 'DR-01', { firedoorFire: false, firedoorLockType: 'latch', firedoorCloser: false, firedoorVpStyle: 0 }),
    door('fd60-bathroom', 'FDR-03', { firedoorRating: 'FD60', firedoorLockType: 'bathroom', firedoorVpStyle: 5, firedoorIntuStyle: 4 }),
    door('762x1981', 'FDR-04', { firedoorLeafWidth: 762, firedoorLeafHeight: 1981, firedoorSwing: 'out', firedoorVpStyle: 2 }),
    door('custom-vp-pos90', 'FDR-05', { firedoorLeafWidth: 1056, firedoorVpStyle: 14, firedoorVpCustom: { length: 600, width: 150, count: 3, rail: 100, pos: 90 }, firedoorFrameDepth: 150 }),
  ];
  const tag = { number: 3, hex: '#F59E0B', name: 'FDR-01' };
  const all = {}, kinds = {};
  for (const d of DOORS) {
    const plan = M.fdu.fireDoorSheetPlan(d.derived);
    ok(J(plan.map((p) => p.key)) === J(['fdoutside', 'fdinside', 'fdplan', 'fdleaf', 'fdframe']) && J(plan.map((p) => p.label)) === J(['Outside Elevation', 'Inside Elevation', 'Plan', 'Leaf Machining', 'Frame Machining']),
      `${d.key}: fireDoorSheetPlan keys fdoutside / fdinside / fdplan / fdleaf / fdframe with their labels`, J(plan));
    let err = null;
    for (const p of plan) {
      try { all[`${d.key}-${p.key}`] = render(M.FireDoorSheet, { sheet: p, windowSpec: d.spec, derived: d.derived, projectNumber: 'P-1', windowTag: tag }); }
      catch (e) { err = e; all[`${d.key}-${p.key}`] = ''; }
      kinds[`${d.key}-${p.key}`] = p.sheet;
    }
    ok(!err, `${d.key}: the five sheets render without throwing`, err ? String(err.stack || err).slice(0, 300) : '');
    const ep = M.elementsPlan(d.spec, d.derived);
    ok(ep.category === 'firedoor' && ep.supported && ep.hero?.key === 'fdoutside' && ep.hero.label === 'Outside Elevation' && J(ep.rig) === J(['fdoutside', 'fdinside', 'fdplan', 'fdleaf', 'fdframe']) && ep.drawings.length === 4 && ep.drawings[0].key === 'fdinside' && Array.isArray(ep.fireDoorSheets) && ep.fireDoorSheets.length === 5 && ep.cill === null && J(ep.leafGroups) === J([]),
      `${d.key}: elementsPlan firedoor shape (hero fdoutside, rig of 5, 4 grid drawings, no cill, no leaf groups)`, J({ hero: ep.hero, rig: ep.rig, drawings: ep.drawings?.map((x) => x.key), cill: ep.cill }));
  }
  const bad = Object.entries(all).filter(([, m]) => !/<svg/.test(m) || /NaN|undefined|Infinity|[\u2013\u2014]/.test(m)).map(([k]) => k);
  ok(bad.length === 0, `every sheet renders as svg with no NaN / undefined / Infinity / U+2013 / U+2014 (${Object.keys(all).length} sheets)`, bad.join(', '));
  const col = collisionFailures(all);
  ok(col.length === 0, 'collisionFailures empty: no overlapping texts on any of the 30 sheets', describeFailures(col, 40));
  const outside = [];
  for (const [k, m] of Object.entries(all)) {
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(m);
    if (!vb) { outside.push(`${k}: no viewBox`); continue; }
    const W = Number(vb[1]), H = Number(vb[2]);
    textBoxes(m).forEach((t) => { if (t.box.x0 < -1 || t.box.x1 > W + 1 || t.box.y0 < -1 || t.box.y1 > H + 1) outside.push(`${k}: "${t.str.slice(0, 40)}" [${t.box.x0.toFixed(0)}..${t.box.x1.toFixed(0)}] of ${W.toFixed(0)}`); });
  }
  ok(outside.length === 0, 'every text sits inside its sheet', outside.slice(0, 12).join(' | '));
  // the dimension rule governs the inside elevation and the leaf sheet (single drawings);
  // the outside elevation keeps the LSP placement (heights on the LEFT) by the brief,
  // the plan and the frame sheet are multi detail sheets
  const ruled = Object.entries(all).filter(([k]) => kinds[k] === 'inside' || kinds[k] === 'leaf');
  const dimBad = ruled.map(([k, m]) => [k, checkDimRule(m)]).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.why}`);
  ok(ruled.length === 12 && dimBad.length === 0, `the inside elevation and the leaf sheet of every door keep the dimension rule (${ruled.length} sheets)`, dimBad.join(' | '));
  ok(M.fdu.OUTSIDE_HEIGHT_DIMS_SIDE === 'left', "the outside elevation's heights sit on the LEFT (OUTSIDE_HEIGHT_DIMS_SIDE), the LSP placement");
  const S = (k) => all[k];
  ok(['902', '2083', '826', '2040', 'Hinge left - Outside', 'FDR-01', 'VP 450 × 450'].every((t) => has(S('ref-fdoutside'), t)), 'ref outside: 902 / 2083 / 826 / 2040, "Hinge left - Outside", FDR-01, the VP label');
  ok(['Hinge left - Inside', '902', '2083'].every((t) => has(S('ref-fdinside'), t)) && !/VP 450/.test(S('ref-fdinside')), 'ref inside: "Hinge left - Inside", 902 / 2083, no VP label');
  // rule 7 on the notes: the hinge rule and the two frame faces are printed from derived.firedoor, never a literal
  const RULE = 'the macro rule 150 from the top, 200 from the bottom', FACES = ['shows the 35 frame face', 'the 50 face with the stop'];
  ok(has(S('ref-fdoutside'), RULE) && has(S('ref-fdinside'), RULE), 'ref outside and inside: the hinge note prints the rule offsets 150 / 200 from derived.firedoor.hinges');
  ok(['ref-fdoutside', 'ref-fdinside', 'ref-fdplan', 'ref-fdleaf', 'ref-fdframe'].every((k) => FACES.every((t) => has(S(k), t))), 'every ref sheet: the pull face note prints the 35 / 50 faces from derived.firedoor.frame.faces');
  ok(M.fdu.pullFaceNote({ handing: { swing: 'out' }, frame: { faces: { outside: 40, inside: 55 } } }) === 'Opens out: the pull face (the corridor side) shows the 40 frame face and the hinge knuckles, the push face (the room side) the 55 face with the stop',
    'pullFaceNote follows the derived faces (40 / 55) and the swing');
  {
    const mut = JSON.parse(JSON.stringify(DOORS[0].derived));
    mut.firedoor.hinges.topOffset = 145; mut.firedoor.hinges.bottomOffset = 210; mut.firedoor.frame.faces = { outside: 40, inside: 55 };
    const sheets = M.fdu.fireDoorSheetPlan(mut);
    const out = render(M.FireDoorSheet, { sheet: sheets[0], windowSpec: DOORS[0].spec, derived: mut, projectNumber: 'P-1', windowTag: tag });
    const ins = render(M.FireDoorSheet, { sheet: sheets[1], windowSpec: DOORS[0].spec, derived: mut, projectNumber: 'P-1', windowTag: tag });
    ok(has(out, 'the macro rule 145 from the top, 210 from the bottom') && has(ins, 'the macro rule 145 from the top, 210 from the bottom') && has(out, 'shows the 40 frame face') && has(out, 'the 55 face with the stop') && !has(out, RULE) && !FACES.some((t) => has(out, t)),
      'a derived with offsets 145 / 210 and faces 40 / 55 renders those numbers in the notes (no 150 / 200 / 35 / 50 literal survives)');
  }
  ok(['Closed', 'Open 30', '826', '100'].every((t) => has(S('ref-fdplan'), t)), 'ref plan: Closed / Open 30 / 826 / 100');
  ok(['150', '102', '692', '200', 'H1 150', 'H2 944', 'H3 1738', 'spindle 1000', 'euro 928', 'FOREND 236 × 25', 'CASE 17 × 153 × 87', '60', 'hinge recess', 'intumescent groove', 'leading edge'].every((t) => has(S('ref-fdleaf'), t)),
    'ref leaf: the hinge chain 150 / 102 / 692 / 200, H1 150 / H2 944 / H3 1738, spindle 1000, euro 928, FOREND 236 × 25, CASE 17 × 153 × 87, backset 60, the op kinds');
  ok(['H1 188', 'H2 982', 'H3 1776', '188', '205', 'KEEP 990 from the foot', '902', '2083', 'depth 100', 'SECTION 4:1', 'rebate 15 × 47', 'mitre', 'keep plate', 'keep pocket'].every((t) => has(S('ref-fdframe'), t)),
    'ref frame: H1 188 / H2 982 / H3 1776, the chain 188 / 205, KEEP 990 from the foot, 902 / 2083, depth 100, SECTION 4:1, rebate 15 × 47, the op kinds');
  ok(/Hinge right - Outside/.test(S('right-fdoutside')) && /Hinge right - Inside/.test(S('right-fdinside')), 'hinge right: "Hinge right - Outside" / "Hinge right - Inside"');
  ok(/non-fire/.test(S('nonfire-latch-fdoutside')) && /DR-01/.test(S('nonfire-latch-fdoutside')) && count(S('nonfire-latch-fdleaf'), /intumescent groove/g) === 0 && /No intumescent strip/.test(S('nonfire-latch-fdleaf'))
    && count(S('nonfire-latch-fdleaf'), /cylinder hole/g) === 1 && /no cylinder hole/.test(S('nonfire-latch-fdleaf')) && count(S('ref-fdleaf'), /intumescent groove/g) === 3 && count(S('ref-fdleaf'), /cylinder hole/g) === 1 && !/no cylinder hole/.test(S('ref-fdleaf')),
    'non-fire latch: "non-fire", DR-01, no groove rows, "No intumescent strip", "no cylinder hole" (the ref leaf lists 3 grooves and a cylinder hole)');
  ok(/FD60/.test(S('fd60-bathroom-fdoutside')) && /bathroom 922/.test(S('fd60-bathroom-fdleaf')) && /rebate 15 × 57/.test(S('fd60-bathroom-fdframe')) && /diamond/.test(S('fd60-bathroom-fdleaf')), 'FD60 bathroom diamond: FD60, bathroom 922, rebate 15 × 57, diamond');
  ok(['150', '102', '662', '200', 'H2 914.5', 'H3 1679'].every((t) => has(S('762x1981-fdleaf'), t)) && /838/.test(S('762x1981-fdoutside')) && /2024/.test(S('762x1981-fdoutside')), '762 x 1981: the chain 150 / 102 / 662 / 200, H2 914.5, H3 1679, frame 838 x 2024');
  ok(/1056/.test(S('custom-vp-pos90-fdoutside')) && /1132/.test(S('custom-vp-pos90-fdoutside')) && /depth 150/.test(S('custom-vp-pos90-fdframe')) && count(S('custom-vp-pos90-fdleaf'), /vision panel/g) >= 3, 'custom VP pos 90 on a 1056 leaf: 1056 / 1132 on the outside, depth 150 on the frame sheet, three vision panel rows');
  // the Drawings panel for a fire door: the five tabs, never a sash / casement / door sheet
  {
    const d = DOORS[0];
    const item = { id: 'x', name: 'FDR-01', width: 902, height: 2083, windowCategory: 'firedoor' };
    let html = '', err = null;
    try { html = render(M.DrawingsPanel, { item, windowSpec: d.spec, settings: {}, derived: d.derived, batch: { projectNumber: 'P-1' }, projectLabel: 'P-1' }); } catch (e) { err = e; }
    ok(!err, 'DrawingsPanel renders a fire door without throwing', err ? String(err.stack || err).slice(0, 300) : '');
    const labels = ['Outside Elevation', 'Inside Elevation', 'Plan', 'Leaf Machining', 'Frame Machining'];
    ok(labels.every((l) => has(html, `>${l}<`)), 'DrawingsPanel: only the five fire door tabs', labels.filter((l) => !has(html, `>${l}<`)).join(', '));
    ok(!/Box Detail|Upper Sash|Lower Sash|Frame Detail|Front Elevation/.test(html), 'DrawingsPanel: no sash / casement / door / partition tab for a fire door');
    ok(count(html, /<svg /g) === 7 && /Hinge left - Outside/.test(html) && count(html, /Leaf Machining · P-1/g) === 1, `DrawingsPanel: the active sheet, the rig elevation and the five rig sheets (${count(html, /<svg /g)} svgs); the outside elevation shows by default`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('8 - the 3D: fireDoorGeometryFromSpec and the model mounted headless');
{
  const e = mkB({ firedoorVpStyle: 1, firedoorLockType: 'euro', firedoorCloser: true }, 'FDR-01', { width: 902, height: 2083 });
  const geo = M.cfg.fireDoorGeometryFromSpec(e.spec, e.derived);
  ok(!!geo && geo.leaf.w === 826 && geo.leaf.h === 2040 && geo.leaf.t === 44 && geo.leaf.x === 38 && geo.leaf.y === 38, `geo leaf 826 x 2040 x 44 at (38, 38) in the frame`);
  ok(geo.frame.overall.w === 902 && geo.frame.overall.h === 2083 && geo.totalWidth === 902 && geo.totalHeight === 2083 && geo.origin.x === 451 && geo.origin.y === 1041.5, 'geo frame overall 902 x 2083, origin at the frame centre (451, 1041.5)');
  ok(geo.frame.depth === 100 && geo.frame.thickness === 50 && geo.frame.rebate.w === 15 && geo.frame.rebate.d === 47 && geo.frame.faces.outside === 35 && geo.frame.faces.inside === 50 && geo.frame.gaps.floor === 5,
    'geo frame depth 100, thickness 50, rebate 15 x 47, faces 35 / 50, floor gap 5');
  ok(J(geo.hinges.positions.map((p) => p.top)) === J([150, 944, 1738]) && geo.hinges.length === 102, 'geo hinges 150 / 944 / 1738, 102 long');
  ok(geo.lock.spindle.fromBottom === 1000 && geo.lock.spindle.fromLockEdge === 60 && geo.lock.cylinder?.kind === 'euro' && geo.lock.cylinder.fromBottom === 928, 'geo spindle 1000 / 60, euro cylinder 928');
  ok(geo.vp.panes.length === 1 && geo.vp.panes[0].w === 450 && geo.vp.panes[0].h === 450 && !geo.vp.panes[0].rotated && geo.vp.glassThickness === 6, 'geo one VP pane 450 x 450, glass 6');
  ok(geo.handing.hingeSide === 'left' && geo.handing.swing === 'in' && geo.keep?.centreFromFoot === 990 && geo.keep.plate.length === 176 && geo.keep.plate.width === 40, 'geo handing left / in, keep 990 from the foot, plate 176 x 40');
  ok(geo.frame.members.length === 3 && J(geo.frame.members.map((m) => m.length)) === J([902, 2083, 2083]), 'geo members 902 / 2083 / 2083');
  // the model mounted with R3F on a stub renderer (the t40 / C2 mechanics): the bundle carries react, three and fiber
  const OUT3D = resolve(AUDIT, 't51-3d');
  mkdirSync(OUT3D, { recursive: true });
  const entry3d = resolve(OUT3D, 'entry.mjs');
  writeFileSync(entry3d, [
    "export { createRoot, extend } from '@react-three/fiber';",
    "export * as THREE from 'three';",
    "export { createElement } from 'react';",
    `export { default as FireDoor } from '${resolve(ROOT, 'src/3d/components/firedoor/FireDoor.jsx')}';`,
  ].join('\n'));
  const out3d = resolve(OUT3D, 'bundle.mjs');
  let T = null, bundleErr = null;
  try {
    execFileSync('npx', [...ESBUILD, entry3d, '--bundle', '--format=esm', '--platform=node', '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error', `--outfile=${out3d}`],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_PATH: resolve(ROOT, 'node_modules') } });
    T = await import(`${pathToFileURL(out3d).href}?t=${Date.now()}`);
  } catch (err) { bundleErr = err; }
  ok(!!T && !bundleErr, 'the 3D bundle (FireDoor.jsx with react, three and fiber) builds and loads', String(bundleErr || '').slice(0, 300));
  if (T) {
    const newCanvas = () => ({ width: 800, height: 600, style: {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; }, clientWidth: 800, clientHeight: 600, parentElement: null });
    const gl = (canvas) => ({ render() {}, setPixelRatio() {}, getPixelRatio: () => 1, setSize() {}, setAnimationLoop() {}, dispose() {},
      xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} },
      shadowMap: { enabled: false }, domElement: canvas, info: { render: {} }, outputColorSpace: '', toneMapping: 0 });
    const meshes = async (props) => {
      T.extend(T.THREE);
      const canvas = newCanvas();
      const root = T.createRoot(canvas);
      await root.configure({ gl: () => gl(canvas), frameloop: 'never', size: { width: 800, height: 600, top: 0, left: 0 }, events: undefined });
      const store = root.render(T.createElement(T.FireDoor, props));
      await new Promise((r) => setTimeout(r, 300));
      const scene = store.getState().scene;
      scene.updateMatrixWorld(true);
      const res = [];
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const b = new T.THREE.Box3().setFromObject(o);
        const mmr = (v) => Math.round(v * 1e5) / 100;
        const names = [];
        for (let p = o; p; p = p.parent) if (p.name) names.push(p.name);
        res.push({ kind: o.geometry.type, names, min: [mmr(b.min.x), mmr(b.min.y), mmr(b.min.z)], max: [mmr(b.max.x), mmr(b.max.y), mmr(b.max.z)] });
      });
      root.unmount();
      return res;
    };
    const R2 = (v) => Math.round(v * 100) / 100;
    const w = (m) => R2(m.max[0] - m.min[0]), hh = (m) => R2(m.max[1] - m.min[1]), dd = (m) => R2(m.max[2] - m.min[2]);
    const cy = (m) => R2((m.min[1] + m.max[1]) / 2), cx = (m) => R2((m.min[0] + m.max[0]) / 2);
    const hasN = (m, n) => m.names.includes(n);
    const bbox = (ms) => ms.reduce((b, m) => ({ min: b.min.map((v, i) => Math.min(v, m.min[i])), max: b.max.map((v, i) => Math.max(v, m.max[i])) }), { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
    let ms = [], mountErr = null;
    try { ms = await meshes({ geo, woodColor: '#F6F6F6', openAngle: 0, ironmongery: 'brass', glassFinish: 'clear' }); } catch (err) { mountErr = err; }
    ok(!mountErr && ms.length > 0, `FireDoor mounts headless: ${ms.length} meshes (> 0)`, String(mountErr || '').slice(0, 300));
    const leaf = ms.find((m) => hasN(m, 'leaf-body'));
    ok(!!leaf && near(w(leaf), 826, 0.02) && near(hh(leaf), 2040, 0.02) && near(dd(leaf), 44, 0.02), `the leaf box ${leaf ? `${w(leaf)} x ${hh(leaf)} x ${dd(leaf)}` : 'missing'} (826 x 2040 x 44)`);
    const frame = ms.filter((m) => hasN(m, 'fd-frame'));
    const fb = bbox(frame);
    ok(frame.length === 6 && near(fb.max[0] - fb.min[0], 902, 0.02) && near(fb.max[1] - fb.min[1], 2083, 0.02) && near(fb.max[2] - fb.min[2], 100, 0.02) && near(fb.min[1], -1041.5, 0.02) && near(fb.max[0], 451, 0.02),
      `the frame: ${frame.length} boxes, overall ${R2(fb.max[0] - fb.min[0])} x ${R2(fb.max[1] - fb.min[1])} x ${R2(fb.max[2] - fb.min[2])} (902 x 2083 x 100), centred on the origin`);
    ok(!!leaf && near(leaf.min[1], -1036.5, 0.02) && near(leaf.max[1], 1003.5, 0.02), `the leaf stands 5 above the feet (${leaf?.min[1]}) and 38 under the frame top (${leaf?.max[1]})`);
    const hinges = ms.filter((m) => hasN(m, 'fd-hinge'));
    const hy = hinges.map(cy).sort((a, b) => b - a);
    ok(hinges.length === 3 && near(hy[0], 802.5, 0.02) && near(hy[1], 8.5, 0.02) && near(hy[2], -785.5, 0.02) && hinges.every((m) => near(hh(m), 102, 0.02)),
      `3 hinge knuckles 102 long centred at y ${hy.join(' / ')} (leaf top 1003.5 - 201 / 995 / 1789)`);
    const glass = ms.filter((m) => hasN(m, 'vp-glass'));
    ok(glass.length === 1 && near(w(glass[0]), 450, 0.02) && near(hh(glass[0]), 450, 0.02) && near(dd(glass[0]), 6, 0.02) && near(cx(glass[0]), 0, 0.02) && near(glass[0].max[1], 1003.5 - 150, 0.02),
      `the VP glass 450 x 450 x 6 centred across the leaf, its top 150 under the leaf top (${glass[0] ? `${w(glass[0])} x ${hh(glass[0])} x ${dd(glass[0])}, top ${glass[0].max[1]}` : 'missing'})`);
    const keep = ms.find((m) => hasN(m, 'keep-plate'));
    ok(!!keep && near(hh(keep), 176, 0.02) && near(dd(keep), 40, 0.02) && near(cy(keep), -1041.5 + 990, 0.02), `the keep plate 176 x 40 centred 990 above the feet (y ${keep && cy(keep)})`);
    const roses = ms.filter((m) => hasN(m, 'fd-handle') && m.kind === 'CylinderGeometry' && near(w(m), 52, 0.02));
    ok(roses.length === 2 && roses.every((m) => near(cy(m), -36.5, 0.02) && near(Math.abs(cx(m)), 353, 0.02)), `2 handle roses at the spindle (y -36.5 = feet + 5 + 1000, |x| 353 = lock edge - 60)`);
    ok(ms.filter((m) => hasN(m, 'fd-euro')).length === 4 && ms.filter((m) => hasN(m, 'vp-beads')).length === 8, 'four euro escutcheons, eight glazing beads');
    const open = await meshes({ geo, openAngle: 30 });
    const lo = open.find((m) => hasN(m, 'leaf-body'));
    ok(!!lo && near(dd(lo), 826 * Math.sin(Math.PI / 6) + 44 * Math.cos(Math.PI / 6), 0.5) && lo.min[2] < leaf.min[2] - 300 && near(lo.max[0], leaf.max[0], 2), `open 30: the leaf swings toward the pull side about its hinge edge (z ${lo?.min[2]} .. ${lo?.max[2]})`);
    ok(J(open.filter((m) => hasN(m, 'fd-hinge')).map(cx)) === J(hinges.map(cx)), 'the knuckles do not move with the leaf');
    const geoR = M.cfg.fireDoorGeometryFromSpec(mkB({ firedoorHingeSide: 'right', firedoorSwing: 'out', firedoorLockType: 'bathroom', firedoorVpStyle: 5 }, 'FDR-02').spec);
    const msR = await meshes({ geo: geoR, openAngle: 0 });
    const gR = msR.filter((m) => hasN(m, 'vp-glass'));
    ok(geoR.handing.hingeSide === 'right' && msR.filter((m) => hasN(m, 'fd-bathroom')).length === 4 && msR.filter((m) => hasN(m, 'fd-euro')).length === 0 && gR.length === 1 && near(w(gR[0]), 350 * Math.SQRT2, 0.05),
      'hinge right, bathroom, diamond VP: four thumbturn parts, no euro escutcheon, the diamond glass box 494.97 wide');
    const msN = await meshes({ geo: M.cfg.fireDoorGeometryFromSpec(mkB({ firedoorFire: false, firedoorLockType: 'latch', firedoorVpStyle: 0 }, 'DR-01').spec), openAngle: 0 });
    ok(msN.filter((m) => hasN(m, 'vp-glass')).length === 0 && msN.filter((m) => hasN(m, 'fd-euro') || hasN(m, 'fd-bathroom')).length === 0 && !!msN.find((m) => hasN(m, 'leaf-body')), 'a non-fire latch door without a VP: no glass, no cylinder parts, the leaf drawn');
    ok((await meshes({ geo: null, openAngle: 30 })).length === 0, 'geo null: nothing drawn, no throw');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('9 - the export: bSuite fire door rows, the variables of 4.7, the STOP rows, the ZIP, the machining CSV / JSON');
const unzip = (buf) => {
  const out = {}; let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034B50) {
    const method = buf.readUInt16LE(p + 8), crc = buf.readUInt32LE(p + 14), csize = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    const data = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    out[name] = { method, crc, data: method === 8 ? inflateRawSync(data) : Buffer.from(data) };
    p += 30 + nlen + xlen + csize;
  }
  return out;
};
{
  const X = M.bsuite, P = M.profile;
  const mkX = (name, extra) => { const { spec, derived } = mkB({ firedoorLockType: 'euro', firedoorCloser: true, firedoorVpStyle: 1, ...extra }, name, { width: 902, height: 2083 }); return { name, windowSpec: spec, derived }; };
  const d1 = mkX('FDR-01', {});
  const d2 = mkX('FDR-02', { firedoorRating: 'FD60', firedoorLockType: 'latch', firedoorCloser: false, firedoorVpStyle: 0 });
  const d3 = mkX('DR-01', { firedoorFire: false, firedoorLockType: 'bathroom', firedoorCloser: false, firedoorVpStyle: 0, firedoorHingeSide: 'right' });
  const windows = [d1, d2, d3];
  const prof = P.getFireDoorProfile();
  const TGT = P.bsuiteActiveTarget(prof.bsuite);
  ok(!!TGT && TGT.programs.leaf.path === 'C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid' && TGT.programs.head.path === '' && TGT.programs.jambHinge.path === '' && TGT.programs.jambLock.path === '',
    `the active fire door target "${TGT?.name}" (${TGT?.id}): the leaf master path, empty frame paths`);
  const { rows, skipped, messages } = X.buildBsuiteFireDoorRows(windows, prof);
  ok(rows.length === 3 && rows.every((r) => r.kind !== 'stop' && r.member === 'leaf' && r.program === 'FD_LEAF_MASTER_PIOTR.bSolid') && J(rows.map((r) => r.label)) === J(['FDR-01', 'FDR-02', 'DR-01']) && rows.every((r) => r.quantity === 1),
    'default profile: 3 leaf rows labelled FDR-01 / FDR-02 / DR-01, quantity 1, no STOP');
  ok(skipped.length === 9 && skipped.every((s) => ['head', 'jambHinge', 'jambLock'].includes(s.key) && /FD_(HEAD|JAMB_HINGE|JAMB_LOCK): no program path/.test(s.reason) && /^(FDR|DR)-0\d$/.test(s.door)), `9 skipped frame rows naming door and member (${skipped.length})`, J(skipped));
  ok(messages.length === 3 && messages.every((m) => /FDR-01, FDR-02, DR-01/.test(m)) && /^FD_HEAD:/.test(messages[0]) && /^FD_JAMB_HINGE:/.test(messages[1]) && /^FD_JAMB_LOCK:/.test(messages[2]), `3 messages, one per missing key, listing the three doors`, messages.join(' | '));
  const L = rows[0];
  ok(L.vars.LPX === 2040 && L.vars.LPY === 826 && L.vars.LPZ === 44 && L.panelId === 1001 && L.panelName === 'P1001' && L.path === TGT.programs.leaf.path && L.element === 'FD_LEAF' && L.window === 'FDR-01' && /FD_LEAF 2040 x 826 x 44/.test(L.note),
    'the leaf row: panel LPX 2040 / LPY 826 / LPZ 44 on P1001, path, element FD_LEAF, window, note');
  const ORDER = ['HAND', 'LH', 'RH', 'HINGE', 'LOCK', 'LOCK_H', 'SPINDLE', 'EURO', 'KEEP', 'KEEP_STYLE', 'INTU_STYLE', 'VP_STYLE', 'C_VP_L', 'C_VP_W', 'C_VP_NUM', 'C_VP_RAIL', 'C_VP_POS', 'D_TOP_RAIL', 'D_MID_RAIL', 'D_SIDE_MARGIN', 'LEAD_EDGE', 'REBATE', 'REBATE_STYLE', 'SPY_ON', 'SPY_H', 'LBOX', 'L_BOX_H', 'DROP_CILL', 'PREM_DOOR', 'HINGE_1', 'HINGE_2', 'HINGE_3', 'HINGE_D', 'CLOSER'];
  ok(rows.every((r) => J(Object.keys(r.docVars)) === J(ORDER)), 'every leaf row writes the document variables in the exact 4.7 order (LPX / LPY / LPZ on the panel node)', Object.keys(L.docVars).join());
  const E1 = { HAND: 0, LH: 1, RH: 0, HINGE: 1, LOCK: 2, LOCK_H: 1000, SPINDLE: 1, EURO: 1, KEEP: 0, KEEP_STYLE: 0, INTU_STYLE: 1, VP_STYLE: 1, C_VP_L: 600, C_VP_W: 150, C_VP_NUM: 1, C_VP_RAIL: 100, C_VP_POS: 0, D_TOP_RAIL: 150, D_MID_RAIL: 450, D_SIDE_MARGIN: 150, LEAD_EDGE: 1, REBATE: 0, REBATE_STYLE: 1, SPY_ON: 0, SPY_H: 1450, LBOX: 0, L_BOX_H: 1000, DROP_CILL: 0, PREM_DOOR: 0, HINGE_1: 150, HINGE_2: 944, HINGE_3: 1738, HINGE_D: 3, CLOSER: 1 };
  const E2 = { ...E1, LOCK: 3, EURO: 0, VP_STYLE: 0, CLOSER: 0 };
  const E3 = { ...E1, HAND: 1, LH: 0, RH: 1, HINGE: 0, LOCK: 1, EURO: 0, INTU_STYLE: 0, VP_STYLE: 0, CLOSER: 0 };
  const diff = (got, want) => Object.keys(want).filter((k) => got[k] !== want[k]).map((k) => `${k}=${got[k]} (exp ${want[k]})`);
  ok(diff(L.docVars, E1).length === 0 && J(L.docVars) === J(E1), 'FDR-01 (FD30 euro VP 1 closer): every 4.7 value', diff(L.docVars, E1).join(', '));
  ok(diff(rows[1].docVars, E2).length === 0 && rows[1].vars.LPZ === 54, 'FDR-02 (FD60 latch): LPZ 54, LOCK 3, EURO 0, VP_STYLE 0, CLOSER 0, HINGE 1, INTU_STYLE 1', diff(rows[1].docVars, E2).join(', '));
  ok(diff(rows[2].docVars, E3).length === 0 && rows[2].vars.LPZ === 44, 'DR-01 (non-fire bathroom hinge right): HAND 1, LH 0, RH 1, HINGE 0, LOCK 1, EURO 0, INTU_STYLE 0, CLOSER 0, LPZ 44', diff(rows[2].docVars, E3).join(', '));
  const twin = X.buildBsuiteFireDoorRows([d1, { ...d1, name: 'FDR-09' }], prof);
  ok(twin.rows.length === 1 && twin.rows[0].quantity === 2 && twin.rows[0].label === 'FDR-01, FDR-09', 'two identical doors collapse into one leaf row, Quantity 2, both names in the label');
  const mixed = X.buildBsuiteFireDoorRows([d1, { name: 'W1', windowSpec: {}, derived: { category: 'casement' } }, { name: 'X', derived: null }], prof);
  ok(mixed.rows.length === 1 && mixed.skipped.some((s) => s.door === 'W1' && s.key === 'window' && /not a fire door/.test(s.reason)) && mixed.skipped.some((s) => s.door === 'X' && /no derived/.test(s.reason)), 'a casement and a failed window are skipped with a reason, never thrown');
  ok(X.buildBsuiteFireDoorRows([], prof).rows.length === 0 && X.buildBsuiteFireDoorRows([], prof).messages.length === 1, 'an empty list: no rows, one message');
  // dummy frame paths: 15 entries in blocks with STOP rows between
  const full = { ...prof, bsuite: { ...prof.bsuite, targets: [{ ...TGT, programs: { ...TGT.programs, head: { ...TGT.programs.head, path: 'C:/bSolid/FD_HEAD.bSolid' }, jambHinge: { ...TGT.programs.jambHinge, path: 'C:/bSolid/FD_JAMB_HINGE.bSolid' }, jambLock: { ...TGT.programs.jambLock, path: 'C:/bSolid/FD_JAMB_LOCK.bSolid' } } }] } };
  const F = X.buildBsuiteFireDoorRows(windows, full);
  const kinds = F.rows.map((r) => (r.kind === 'stop' ? 'STOP' : r.member));
  ok(F.rows.length === 15 && J(kinds) === J(['leaf', 'leaf', 'leaf', 'STOP', 'head', 'head', 'head', 'STOP', 'jambHinge', 'jambHinge', 'jambHinge', 'STOP', 'jambLock', 'jambLock', 'jambLock']) && F.skipped.length === 0 && F.messages.length === 0,
    '15 entries: leaves / STOP / heads / STOP / hinge jambs / STOP / lock jambs, nothing skipped', kinds.join());
  ok(J(F.rows.filter((r) => r.kind !== 'stop').map((r) => r.program)) === J([...Array(3).fill('FD_LEAF_MASTER_PIOTR.bSolid'), ...Array(3).fill('FD_HEAD.bSolid'), ...Array(3).fill('FD_JAMB_HINGE.bSolid'), ...Array(3).fill('FD_JAMB_LOCK.bSolid')]), '12 program rows, the program names per block');
  const head = F.rows[4], jh = F.rows[8], jl = F.rows[12];
  ok(head.vars.LPX === 902 && head.vars.LPY === 100 && head.vars.LPZ === 50 && J(head.docVars) === J({ REB_W: 15, REB_D: 47, HAND: 0, HINGE: 1, HINGE_D: 3, MITRE_TOP: 1, MITRE_BOTTOM: 1 }), `the head row FDR-01: panel 902 x 100 x 50, ${J(head.docVars)}`);
  ok(jh.vars.LPX === 2083 && J(jh.docVars) === J({ REB_W: 15, REB_D: 47, HAND: 0, HINGE: 1, HINGE_1: 188, HINGE_2: 982, HINGE_3: 1776, HINGE_D: 3, MITRE_TOP: 1, MITRE_BOTTOM: 0 }), `the hinge jamb row FDR-01: LPX 2083, ${J(jh.docVars)}`);
  ok(jl.vars.LPX === 2083 && J(jl.docVars) === J({ REB_W: 15, REB_D: 47, HAND: 0, HINGE: 1, HINGE_D: 3, KEEP: 2, KEEP_STYLE: 1, KEEP_Y: 990, MITRE_TOP: 1, MITRE_BOTTOM: 0 }), `the lock jamb row FDR-01: ${J(jl.docVars)}`);
  ok(F.rows[13].docVars.KEEP === 3 && F.rows[13].docVars.REB_D === 57 && F.rows[5].docVars.REB_D === 57 && F.rows[14].docVars.KEEP === 1 && F.rows[14].docVars.HAND === 1 && F.rows[10].docVars.HAND === 1 && F.rows[10].docVars.HINGE === 0,
    'FDR-02 (FD60): KEEP 3, REB_D 57 on the head and the lock jamb; DR-01: KEEP 1, HAND 1, HINGE 0');
  ok(X.buildBsuiteFireDoorRows(windows, { ...full, bsuite: { ...full.bsuite, stopRows: false } }).rows.length === 12, 'stopRows false: the same 12 rows without STOP');
  const partial = X.buildBsuiteFireDoorRows(windows, { ...full, bsuite: { ...full.bsuite, targets: [{ ...full.bsuite.targets[0], programs: { ...full.bsuite.targets[0].programs, head: { ...TGT.programs.head, path: '' } } }] } });
  ok(partial.rows.filter((r) => r.kind === 'stop').length === 2 && partial.rows.length === 11 && partial.messages.length === 1 && /^FD_HEAD:/.test(partial.messages[0]), 'the head path empty: one STOP between non-empty blocks only (11 entries), the head skipped with a message');
  // the ZIP written and re-read; the STOP line in the sample's form
  const now = new Date(2026, 9, 27, 12, 0, 0);
  const bytes = X.buildEwlist(F.rows, { now, programs: { 'FD_LEAF_MASTER_PIOTR.bSolid': new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]) } });
  const z = unzip(Buffer.from(bytes));
  const xml = z['worklist.wld'].data.toString('utf8');
  ok(J(Object.keys(z)) === J(['worklist.wld', 'Programs/', 'Programs\\FD_LEAF_MASTER_PIOTR.bSolid', 'version']) && z['version'].data.toString() === '5' && z['worklist.wld'].crc === X.crc32(z['worklist.wld'].data),
    'ZIP entries worklist.wld / Programs/ / the leaf program / version 5, CRC32 ok (no program entry for a STOP row)');
  const stops = [...xml.matchAll(/^    <StopWorklistItem Id="([0-9a-f-]{36})" Label="" \/>\r$/gm)].map((m) => m[1]);
  ok(stops.length === 3 && new Set(stops).size === 3, `3 StopWorklistItem lines with distinct GUIDs (${stops.length} lines, ${new Set(stops).size} GUIDs)`);
  const sampleXml = unzip(readFileSync(resolve(ROOT, 'docs/handover/workshop/JOINERY_NETWORK_EVENT.ewlist')))['worklist.wld'].data.toString('utf8');
  const refStop = sampleXml.match(/^    <StopWorklistItem [^\n]*$/m)[0].replace(/Id="[0-9a-f-]{36}"/, 'Id="#"');
  const myStops = [...xml.matchAll(/^    <StopWorklistItem [^\n]*$/gm)].map((m) => m[0].replace(/Id="[0-9a-f-]{36}"/, 'Id="#"'));
  ok(myStops.length === 3 && myStops.every((s) => s === refStop) && refStop === '    <StopWorklistItem Id="#" Label="" />\r', `every STOP line is the Biesse sample's line character for character (modulo the GUID): ${J(refStop)}`);
  ok(J([...xml.matchAll(/^    <(CadProgramWorklistItem|StopWorklistItem) /gm)].map((m) => (m[1] === 'StopWorklistItem' ? 'S' : 'P')).join('')) === J('PPPSPPPSPPPSPPP') && count(xml, /<CadProgramWorklistItem /g) === 12,
    'the XML item order: 3 programs, STOP, 3, STOP, 3, STOP, 3 (12 CadProgramWorklistItem)');
  ok(/Label="FDR-01" Quantity="1"/.test(xml) && /Label="DR-01" Quantity="1"/.test(xml) && xml.includes('ProgramUri="file:///C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid"'), 'Label = the door name, Quantity 1, the leaf ProgramUri as file:///');
  ok(/<ProgramPanelNode Id="1001" Name="P1001">\r\n            <Variables>\r\n              <ParametricVariable TypeCode="Double" VariableName="LPX" Expression="2040" ExpressionValue="2040" MeasureUnit="mm" \/>/.test(xml)
    && /TypeCode="String" VariableName="HAND" Expression="0"/.test(xml) && /TypeCode="String" VariableName="CLOSER" Expression="1"/.test(xml) && /TypeCode="String" VariableName="HINGE_3" Expression="1738"/.test(xml) && !/TypeCode="String" VariableName="LPX"/.test(xml),
    'the leaf row: LPX / LPY / LPZ as Double on the panel node, HAND .. CLOSER as String document variables');
  ok(/VariableName="KEEP_Y" Expression="990"/.test(xml) && /VariableName="HINGE_1" Expression="188"/.test(xml) && /VariableName="MITRE_BOTTOM" Expression="0"/.test(xml), 'the frame rows: KEEP_Y 990, HINGE_1 188, MITRE_BOTTOM 0 as document variables');
  ok(xml.startsWith('<Worklist Description="" Version="4">\r\n') && xml.endsWith('  <Variables />\r\n</Worklist>') && !xml.includes('<?xml'), 'root and tail as the sample, CRLF, no xml header');
  const ids = F.rows.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  ok(X.writeWorklistXml(F.rows, { now, ids }) === X.writeWorklistXml(F.rows, { now, ids }) && X.writeWorklistXml(F.rows, { now, ids }).includes('<StopWorklistItem Id="00000000-0000-4000-8000-000000000003" Label="" />'), 'deterministic with fixed ids (the STOP rows take ids from the same list)');
  // the merged export (download stubbed)
  globalThis.document = { createElement: () => ({ click() {}, remove() {}, style: {} }), body: { appendChild() {}, removeChild() {} } };
  globalThis.URL.createObjectURL = () => 'blob:x'; globalThis.URL.revokeObjectURL = () => {};
  globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
  const noProg = await X.exportBsuiteFireDoorsMerged(windows, 'Pack 1', prof, async () => new Uint8Array(3));
  ok(!!noProg.error && /upload the \.bSolid files/.test(noProg.error) && noProg.skipped.length === 9, 'no uploaded program on the target: an error naming the settings page, no download');
  const stored = { ...prof, bsuite: { ...prof.bsuite, targets: [{ ...TGT, programs: { ...TGT.programs, leaf: { ...TGT.programs.leaf, stored: { storagePath: 't/leaf/FD_LEAF_MASTER_PIOTR.bSolid' } } } }] } };
  const okRes = await X.exportBsuiteFireDoorsMerged(windows, 'Pack 1', stored, async () => new Uint8Array([1, 2, 3]));
  ok(okRes.ok && okRes.filename === 'Pack_1_firedoors.ewlist' && okRes.rows === 3 && okRes.stops === 0 && okRes.pieces === 3 && okRes.embedded === 1 && okRes.skipped.length === 9 && okRes.target === TGT.name,
    `the leaf program uploaded: ok, Pack_1_firedoors.ewlist, 3 rows, 0 stops, 1 embedded, 9 skipped, target "${okRes.target}"`, J(okRes));
  ok(!!(await X.exportBsuiteFireDoorsMerged([{ name: 'W', windowSpec: {}, derived: { category: 'sash' } }], 'x', prof, async () => new Uint8Array(1))).error, 'no fire doors: an error, no throw');
  // the machining rows, the CSV and the JSON
  const mr = M.machining.buildFireDoorMachiningRows(windows);
  const sum = windows.reduce((s, wnd) => s + ['leaf', 'head', 'jambHinge', 'jambLock'].reduce((t, k) => t + wnd.derived.firedoor.machining[k].length, 0), 0);
  ok(mr.length === sum && sum === 12 + 3 + 5 + 4 + 10 + 3 + 5 + 4 + 8 + 3 + 5 + 4, `machining rows = the ops of the three doors (${mr.length} = 24 + 22 + 20: a 12 op leaf with the VP cut-out and the cylinder, a 10 op FD60 latch leaf, an 8 op non-fire leaf, 12 frame ops each)`);
  ok(J([...new Set(mr.map((r) => r.element))]) === J(['FD-LEAF', 'FD-HEAD', 'FD-JAMB-H', 'FD-JAMB-L']), 'the element names FD-LEAF / FD-HEAD / FD-JAMB-H / FD-JAMB-L');
  const h1 = mr.find((r) => r.door === 'FDR-01' && r.element === 'FD-LEAF' && r.op === 'hingeRecess');
  const jr = mr.find((r) => r.door === 'FDR-01' && r.element === 'FD-JAMB-H' && r.op === 'hingeRecess');
  const mt = mr.find((r) => r.door === 'FDR-01' && r.element === 'FD-HEAD' && r.op === 'mitre');
  ok(h1 && h1.face === 'hingeEdge' && h1.x === 149.5 && h1.length === 103 && h1.width === 30 && h1.depth === 3 && h1.radius === 6 && jr && jr.x === 187.5 && mt && mt.angle === 45, 'the first leaf hinge recess x 149.5 (103 x 30 x 3 R6), the jamb recess x 187.5, the head mitre angle 45');
  ok(mr.filter((r) => r.door === 'DR-01' && r.op === 'intuGroove').length === 0 && mr.filter((r) => r.door === 'FDR-01' && r.op === 'intuGroove').length === 3 && mr.find((r) => r.door === 'FDR-01' && r.op === 'leadEdge')?.value === -8, 'DR-01 has no groove rows, FDR-01 three; the lead edge row carries value -8');
  const csv = M.machining.fireDoorMachiningCsv(mr);
  const lines = csv.split('\r\n').filter((l) => l.length);
  ok(lines[0] === 'door,element,op,face,x,y,z,length,width,depth,radius,angle,value,note' && lines.length === mr.length + 1, `the CSV header and ${lines.length - 1} lines (one per op)`);
  ok(/FDR-01,FD-LEAF,hingeRecess,hingeEdge,149\.5,0,0,103,30,3,6,,,/.test(csv) && /"vision panel 1 450 x 450, layout per bSolid macro"/.test(csv), 'the CSV: numbers to 0.1, a note with commas quoted');
  const json = M.machining.fireDoorMachiningJson(windows);
  let parsed = null;
  try { parsed = JSON.parse(json); } catch { parsed = null; }
  ok(!!parsed && parsed.doors.length === 3 && parsed.doors.every((d) => d.name && d.inputs && d.leaf && d.frame?.members?.length === 3 && d.hinges && d.lock && d.keep && d.vp && 'intumescent' in d && d.bsuiteVars?.leaf && d.machining?.leaf) && parsed.coordinates?.leaf && parsed.doors[2].intumescent === null,
    'the JSON parses: 3 doors with name, inputs, leaf, frame, hinges, lock, keep, vp, intumescent, bsuiteVars, machining; the coordinate notes; DR-01 intumescent null');
  const ex = M.machining.exportFireDoorMachining(windows, 'Pack 1');
  ok(ex.ok && J(ex.files) === J(['Pack_1_firedoor_machining.csv', 'Pack_1_firedoor_machining.json']) && ex.doors === 3 && ex.rows === mr.length && !!M.machining.exportFireDoorMachining([{ derived: { category: 'sash' } }], 'x').error,
    'exportFireDoorMachining: the two files, 3 doors, the row count; an error without a fire door');
}

// ═════════════════════════════════════════════════════════════════════════════
section('10 - the controls: a casement, a sash, a door and a partition byte identical to Stage 0; t32 unchanged');
{
  // the four Stage 0 controls, built exactly as the Stage 0 dump script
  // (scratchpad/stage0/controls/dump_controls.mjs) builds them: the DEFAULT
  // profiles forced, JSON.stringify(x, null, 2). The hashes below are djb2 over
  // those strings, computed on 27.10.2026 from the Stage 0 dump taken at the
  // starting commit 623b282 (before any fire door code), typed here as literals.
  const djb2 = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = (((x << 5) + x) ^ s.charCodeAt(i)) >>> 0; return x.toString(16).padStart(8, '0'); };
  const STAGE0 = {
    casement: { derived: '3efb600c', spec: '078a4965' },
    sash: { derived: 'ffb43a60', spec: 'ad52bfec' },
    door: { derived: '327a74b3', spec: 'c37ff346' },
    partition: { derived: '51004da3', spec: 'ff58d553' },
  };
  const ctl = (w, ht, fc, id = 'x', name = 'X') => {
    const spec = specification.normaliseToWindowSpec({ id, name, width: w, height: ht }, { fullConfig: fc });
    return { spec, derived: calculations.deriveWindowData(spec, {}) };
  };
  const CASES = {
    casement: () => ctl(1200, 1200, { windowCategory: 'casement' }),
    sash: () => ctl(900, 1500, {}),
    door: () => ctl(900, 2100, { windowCategory: 'door', doorType: 'single-external' }),
    partition: () => ctl(2525, 2165, { windowCategory: 'partition', partitionLayout: 'SDS', partitionDoorWidth: 800, partitionLights: 3, partitionPanelHeight: 790 }, 'w1', 'Bay 1'),
  };
  const results = profile.withProfiles(profile.DEFAULT_SASH_PROFILE, profile.DEFAULT_CASEMENT_PROFILE, profile.DEFAULT_DOOR_PROFILE, profile.DEFAULT_PARTITION_PROFILE,
    () => Object.fromEntries(Object.entries(CASES).map(([k, make]) => [k, make()])));
  for (const [name, { spec, derived }] of Object.entries(results)) {
    const hd = djb2(JSON.stringify(derived, null, 2)), hs = djb2(JSON.stringify(spec, null, 2));
    ok(hd === STAGE0[name].derived && hs === STAGE0[name].spec, `${name}: derived hash ${hd} and spec hash ${hs} equal the Stage 0 dump (${STAGE0[name].derived} / ${STAGE0[name].spec})`);
    ok(!('firedoor' in derived) && !('firedoor' in spec) && derived.category === (name === 'sash' ? 'sash' : name), `${name}: no firedoor key, category ${derived.category}`);
  }
  // the Stage 0 dump itself, file by file, when the scratch folder of this
  // session still exists (T51_STAGE0_CONTROLS overrides the folder)
  const S0 = process.env.T51_STAGE0_CONTROLS || '/tmp/claude-0/-home-user-Sash-Planner-Web/a38243cc-6e72-5710-b36f-23590aaa815c/scratchpad/stage0/controls';
  const dumpScript = resolve(S0, 'dump_controls.mjs');
  if (existsSync(dumpScript)) {
    const OUTC = resolve(AUDIT, 't51-controls');
    mkdirSync(OUTC, { recursive: true });
    let dumpErr = null;
    try { execFileSync('node', [dumpScript, OUTC], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] }); } catch (err) { dumpErr = err; }
    ok(!dumpErr, 'the Stage 0 dump script runs on the live code', String(dumpErr?.stderr || dumpErr || '').slice(0, 300));
    for (const name of ['casement', 'sash', 'door', 'partition']) {
      for (const ext of ['json', 'spec.json']) {
        const a = existsSync(resolve(S0, `${name}.${ext}`)) ? readFileSync(resolve(S0, `${name}.${ext}`), 'utf8') : null;
        const b = existsSync(resolve(OUTC, `${name}.${ext}`)) ? readFileSync(resolve(OUTC, `${name}.${ext}`), 'utf8') : null;
        ok(a !== null && a === b, `${name}.${ext}: the live dump is byte identical to the Stage 0 dump (${a?.length} chars)`);
      }
    }
  } else {
    console.log(`SKIP  the Stage 0 dump folder is not on this machine (${S0}); the typed hashes above stand in for it`);
  }
  // t32: the casement bSuite export must stay byte identical (54 passed, 0 failed)
  let t32 = '';
  let t32Err = null;
  try { t32 = execFileSync('node', [resolve(ROOT, 'verify/parity/t32_bsuite.mjs')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (err) { t32Err = err; t32 = String(err.stdout || ''); }
  ok(!t32Err && /54 passed, 0 failed/.test(t32), `t32_bsuite.mjs: ${(t32.match(/\d+ passed, \d+ failed/) || ['no summary line'])[0]}`, t32.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 5).join(' | ') || String(t32Err || '').slice(0, 200));
}

// ═════════════════════════════════════════════════════════════════════════════
section('11 - the pages: overview cells, glass groups, the Elements / Elevations / Glass / Spraying tabs, the pack and window pages');
// the doors and the controls as the configurator stores them (top-level firedoor* keys, width / height = the frame overall)
const fdItem = (id, name, fc) => ({
  id, name, windowCategory: 'firedoor', window_type: 'firedoor',
  firedoorFire: true, firedoorRating: 'FD30', firedoorLeafWidth: 826, firedoorLeafHeight: 2040, firedoorFrameDepth: 100,
  firedoorHingeSide: 'left', firedoorSwing: 'in', firedoorLockType: 'euro', firedoorCloser: true, firedoorVpStyle: 1,
  firedoorIntuStyle: 1, firedoorLeadEdge: true, width: 902, height: 2083,
  ironmongery: 'brass', colourMode: 'single', glassType: 'double',
  specification: JSON.stringify({ windowType: 'firedoor', fullConfig: { windowCategory: 'firedoor' } }),
  ...fc,
});
const ITEMS = {
  fdr01: fdItem('fdr01', 'FDR-01', {}),
  fdr02: fdItem('fdr02', 'FDR-02', { firedoorRating: 'FD60', firedoorLockType: 'bathroom', firedoorHingeSide: 'right', firedoorSwing: 'out', firedoorVpStyle: 5, firedoorIntuStyle: 4, firedoorCloser: false, firedoorFrameDepth: 150 }),
  dr01: fdItem('dr01', 'DR-01', { firedoorFire: false, firedoorLockType: 'latch', firedoorVpStyle: 0, firedoorCloser: false }),
  sash: { id: 'sash1', name: 'W1', width: 900, height: 1500, window_type: 'sash', specification: JSON.stringify({ windowType: 'sash', fullConfig: {} }) },
  cas: { id: 'cas1', name: 'C1', width: 1200, height: 1200, window_type: 'casement', windowCategory: 'casement', specification: JSON.stringify({ windowType: 'casement', fullConfig: { windowCategory: 'casement' } }) },
  door: { id: 'door1', name: 'D1', width: 900, height: 2100, window_type: 'doors', windowCategory: 'door', specification: JSON.stringify({ windowType: 'doors', fullConfig: { windowCategory: 'door', doorType: 'single-external' } }) },
  wall: { id: 'wall1', name: 'Bay 1', width: 2525, height: 2165, window_type: 'partition', windowCategory: 'partition', specification: JSON.stringify({ windowType: 'partition', fullConfig: { windowCategory: 'partition', partitionLayout: 'SDS', partitionDoorWidth: 800, partitionLights: 3, partitionPanelHeight: 790 } }) },
};
const batchFD = { id: 'b1', type: 'firedoor', label: 'Fire doors', status: 'planning', projectNumber: '064', defaults: { colourMode: 'single', woodColor: '#F6F6F6', precutSettings: { colourMode: 'window' } }, windows: [ITEMS.fdr01, ITEMS.fdr02, ITEMS.dr01] };
const batchSash = { id: 'b2', type: 'sash', label: 'Sash', status: 'planning', projectNumber: '064', defaults: { colourMode: 'single', woodColor: '#F6F6F6' }, windows: [ITEMS.sash] };
const batchMix = { id: 'b3', type: 'casement', label: 'Mixed', status: 'planning', projectNumber: '064', defaults: {}, windows: [ITEMS.cas, ITEMS.door, ITEMS.wall] };
const wd = (item, b) => {
  const win = { ...item, _projectId: 'p1', _projectNumber: '064', _batchId: b.id, _batch: b };
  const windowSpec = M.specification.normaliseToWindowSpec(win, M.specification.parseSpecification(win.specification));
  return { win, windowSpec, derived: M.calculations.deriveWindowData(windowSpec, {}) };
};
const W = {};
for (const [k, it] of Object.entries(ITEMS)) {
  const b = k.startsWith('fdr') || k === 'dr01' ? batchFD : k === 'sash' ? batchSash : batchMix;
  try { W[k] = wd(it, b); } catch (e) { console.log(`control ${k} failed to derive: ${e.message}`); }
}
const pageUrl = (path, pattern, Comp) => renderToStaticMarkup(h(M.MemoryRouter, { initialEntries: [path] }, h(M.Routes, null, h(M.Route, { path: pattern, element: h(Comp) }))));
{
  const renderR = (el) => renderToStaticMarkup(h(M.MemoryRouter, null, el));
  const noop = () => {};
  ok(W.fdr01?.derived?.category === 'firedoor' && W.fdr02?.derived?.category === 'firedoor' && W.dr01?.derived?.category === 'firedoor' && W.fdr01.derived.firedoor.frame.overall.width === 902, 'the three stored doors derive as firedoor through parseSpecification + normaliseToWindowSpec');
  ok(W.sash?.derived?.category === 'sash' && W.cas?.derived?.category === 'casement' && W.door?.derived?.category === 'door' && W.wall?.derived?.category === 'partition', 'the four controls derive (sash, casement, door, partition)');
  const doorsOnly = [W.fdr01, W.fdr02, W.dr01];
  const mixed = [W.fdr01, W.sash, W.cas, W.door, W.wall, W.dr01];
  // overviewCells / winBarsLabel
  const c1 = M.PPP.overviewCells(W.fdr01), c2 = M.PPP.overviewCells(W.fdr02), c3 = M.PPP.overviewCells(W.dr01);
  ok(c1.type === 'FD30' && c1.head === 'leaf 826 × 2040 × 44 · VP 450mm Square' && c1.opening === 'Hinge left · opens in · sashlock euro · closer' && c1.box === 100,
    'overviewCells FDR-01: FD30 / leaf 826 × 2040 × 44 · VP 450mm Square / Hinge left · opens in · sashlock euro · closer / box 100', J(c1));
  ok(c2.type === 'FD60' && c2.head === 'leaf 826 × 2040 × 54 · VP 350mm Diamond' && c2.opening === 'Hinge right · opens out · bathroom' && c2.box === 150, 'overviewCells FDR-02: FD60 / leaf 54 · diamond / Hinge right · opens out · bathroom (no closer) / box 150', J(c2));
  ok(c3.type === 'DR' && c3.head === 'leaf 826 × 2040 × 44 · no VP' && c3.opening === 'Hinge left · opens in · latch' && c3.box === 100, 'overviewCells DR-01: DR / no VP / latch, no closer', J(c3));
  const cs = M.PPP.overviewCells(W.sash), cd = M.PPP.overviewCells(W.door), cw = M.PPP.overviewCells(W.wall);
  ok(cs.type === 'double' && cs.head === 'flat' && cs.box === 164 && cd.type === 'single' && cd.box === 93 && String(cw.type).startsWith('wall '), 'overviewCells controls unchanged: sash double / flat / 164, door single / 93, partition "wall ..."');
  ok(M.PPP.winBarsLabel(W.fdr01) === 'none' && M.PPP.winBarsLabel(W.dr01) === 'none', 'winBarsLabel of a fire door: none');
  // groupFireDoorGlass (on the pages, or in fireDoorDrawUtils once it moves there)
  const groupGlass = M.fdu.groupFireDoorGlass || M.PPP.groupFireDoorGlass;
  ok(typeof groupGlass === 'function', `groupFireDoorGlass is exported (${M.fdu.groupFireDoorGlass ? 'fireDoorDrawUtils' : 'ProductionPackPage'})`);
  const g1 = groupGlass(W.fdr01.derived, W.fdr01.windowSpec);
  ok(g1.length === 1 && g1[0].w === 450 && g1[0].h === 450 && g1[0].panes.length === 1 && g1[0].panes[0] === 'vision panel 1', 'groupFireDoorGlass FDR-01: one 450 x 450 group of one pane', J(g1));
  const g2 = groupGlass(W.fdr02.derived, W.fdr02.windowSpec);
  ok(g2.length === 1 && g2[0].w === 350 && g2[0].h === 350, 'groupFireDoorGlass FDR-02: one 350 x 350 group (the diamond)', J(g2));
  ok(groupGlass(W.dr01.derived, W.dr01.windowSpec).length === 0 && groupGlass(W.sash.derived, W.sash.windowSpec).length === 0 && groupGlass(W.door.derived, W.door.windowSpec).length === 0, 'groupFireDoorGlass: empty for DR-01 (VP 0), a sash and a door');
  const wGroup = M.WDP.groupFireDoorGlass || M.fdu.groupFireDoorGlass;
  ok(typeof wGroup === 'function' && J(wGroup(W.fdr01.derived, W.fdr01.windowSpec)) === J(g1), 'the window page grouper gives the same groups');
  // ElementsTab
  {
    const html = renderR(h(M.PPP.ElementsTab, { windowsData: doorsOnly, pp: null, batch: batchFD, isPPMode: false, registerExport: noop }));
    const labels = ['Outside Elevation', 'Inside Elevation', 'Plan', 'Leaf Machining', 'Frame Machining'];
    ok(labels.every((l) => count(html, new RegExp(`mb-2">${l}<`, 'g')) === 3), 'ElementsTab: the five fire door cards once per door (3 doors)', labels.map((l) => `${l}: ${count(html, new RegExp(`mb-2">${l}<`, 'g'))}`).join(', '));
    ok(count(html, /<svg/g) === 15 && !has(html, 'Box Detail') && !has(html, 'Upper Sash') && !has(html, 'Frame Detail') && !has(html, 'engine pending'), `ElementsTab: 15 svgs (5 x 3), no sash / casement card, no "engine pending"`);
    ok(has(html, 'Hinge left - Outside') && has(html, 'Hinge right - Outside') && !/NaN|undefined|Infinity/.test(html), 'ElementsTab: the outside elevations print both handings, no NaN / undefined / Infinity');
    const mix = renderR(h(M.PPP.ElementsTab, { windowsData: mixed, pp: null, batch: batchMix, isPPMode: true, registerExport: noop }));
    ok(count(mix, /mb-2">Box Detail</g) === 1 && count(mix, /mb-2">Frame Detail</g) === 1 && count(mix, /mb-2">Front Elevation</g) === 1 && count(mix, /mb-2">Outside Elevation</g) === 2,
      'ElementsTab mixed: one Box Detail (sash), one Frame Detail (casement), one Front Elevation (partition), two Outside Elevations (the fire doors)');
  }
  // ElevationsTab
  {
    const html = renderR(h(M.PPP.ElevationsTab, { windowsData: mixed, pp: null, batch: batchMix, isPPMode: true, registerExport: noop }));
    ok(count(html, /<svg/g) >= mixed.length && has(html, 'Hinge left - Outside') && !has(html, 'engine pending'), `ElevationsTab mixed: an svg per window (${count(html, /<svg/g)} for ${mixed.length}), the fire door shows its outside elevation`);
  }
  // GlassTab
  {
    const glassRows = (list) => list.flatMap(({ win, windowSpec, derived }) => M.lists.buildGlassListForWindow(derived, windowSpec).map((g) => ({ ...g, windowName: win.name, _projectNumber: win._projectNumber })));
    const html = renderR(h(M.PPP.GlassTab, { merged: { glass: glassRows(doorsOnly) }, windowsData: doorsOnly, isPPMode: false, batch: batchFD, pp: null, registerExport: noop, exportFormat: 'a3' }));
    ok(has(html, 'FDR-01: Vision panel glass 450 × 450 · ×1') && has(html, 'FDR-02: Vision panel glass 350 × 350 · ×1'), 'GlassTab: one vision panel card per door with glass (450 and 350)');
    ok(!has(html, 'mb-2">DR-01:') && !has(html, 'Upper Glass') && !has(html, 'Lower Glass') && has(html, '450 mm') && has(html, 'fire'), 'GlassTab: no card for the door without a VP, no sash fallback card, the schedule lists the 450 fire pane');
    ok(count(html, /No data\./g) === 0, 'GlassTab: the vision panel drawing cards render a drawing, never "No data." (DoorGlassDrawing2D accepts a fire door group)', `${count(html, /No data\./g)} "No data." card(s)`);
  }
  // SprayingTab
  {
    const html = renderR(h(M.PPP.SprayingTab, { windowsData: mixed, batch: batchMix, pp: null, registerExport: noop }));
    ok(has(html, '>Leaf<') && has(html, '826 × 2040') && has(html, '>Head<') && has(html, '902 × 100') && has(html, '>Jamb hinge<') && has(html, '>Jamb lock<') && has(html, '2083 × 100'),
      'SprayingTab: Leaf 826 × 2040, Head 902 × 100, Jamb hinge / Jamb lock 2083 × 100 rows for the fire door');
    ok(count(html, />FDR-01</g) === 4 && count(html, />DR-01</g) === 4 && count(html, />Box</g) === 1 && count(html, />Upper Sash</g) === 1 && has(html, 'Bay 1') && has(html, 'oiled oak'),
      'SprayingTab: four element rows per fire door; the sash keeps Box / Upper Sash; the partition stays oiled oak');
  }
  // the whole pages through the router with a seeded store
  M.useProjectStore.setState({
    projects: [{ id: 'p1', project_number: '064', name: 'Test', batches: [batchFD, batchSash, batchMix] }],
    productionPacks: [{ id: 'pp1', name: 'Pack 1', type: 'sash', assignments: [{ projectId: 'p1', batchId: 'b2' }, { projectId: 'p1', batchId: 'b1' }] }],
    currentWindows: [], currentBatch: null,
  });
  M.useProjectStore.getServerState = () => M.useProjectStore.getState();
  M.useProjectStore.getInitialState = () => M.useProjectStore.getState();
  const tgtName = M.profile.bsuiteActiveTarget(M.profile.getFireDoorProfile().bsuite)?.name;
  {
    const html = pageUrl('/projects/p1/batches/b1/production-pack', '/projects/:projectId/batches/:batchId/production-pack', M.PPP.default);
    ok(has(html, 'bSuite fire doors') && has(html, 'Fire door machining (CSV)') && has(html, tgtName), `Pack page (firedoor batch): the "bSuite fire doors" and "Fire door machining (CSV)" buttons, the target "${tgtName}" named`);
    ok(!has(html, 'bSuite frames') && !has(html, 'CNC Jamb DXF'), 'Pack page (firedoor batch): no casement / sash export buttons');
    ok(has(html, 'FD30') && has(html, 'FD60') && has(html, '>DR<') && has(html, 'Hinge left · opens in · sashlock euro · closer') && has(html, '>100 mm<') && has(html, '>150 mm<'), 'Pack page overview: the type, opening and wall depth cells of the three doors');
    ok(!/NaN|undefined|Infinity/.test(html), 'Pack page (firedoor batch): no NaN / undefined / Infinity');
    const sashPage = pageUrl('/projects/p1/batches/b2/production-pack', '/projects/:projectId/batches/:batchId/production-pack', M.PPP.default);
    ok(!has(sashPage, 'bSuite fire doors') && !has(sashPage, 'Fire door machining') && has(sashPage, 'CNC Jamb DXF'), 'Pack page (sash batch): no fire door buttons, the sash buttons stay');
    const pp = pageUrl('/production-packs/pp1', '/production-packs/:ppId', M.PPP.default);
    ok(has(pp, 'bSuite fire doors') && has(pp, 'Fire door machining (CSV)') && has(pp, 'CNC Jamb DXF'), 'Pack page (a sash PP holding fire doors): the fire door buttons next to the sash ones');
  }
  {
    const html = pageUrl('/projects/p1/batches/b1/windows/fdr01', '/projects/:projectId/batches/:batchId/windows/:windowId', M.WDP.default);
    ok(has(html, 'bSuite fire doors') && has(html, 'Fire door machining (CSV)') && !has(html, 'bSuite frames') && !has(html, 'CNC Jamb DXF') && has(html, 'Fire door</div>'), 'Window page FDR-01: the two fire door buttons, no casement / sash ones, the "Fire door" spec section');
    const rowsW = [['Rating', 'FD30'], ['Leaf', '826 × 2040 × 44 mm'], ['Handing', 'Hinge left · opens in'], ['Wall depth', '100 mm'], ['Lock', 'sashlock euro'], ['Closer', 'concealed closer'],
      ['Vision panel', '450mm Square'], ['Intumescent', '15mm x 4mm Intu Strip Lock Center'], ['Leading edge', 'bevelled (macro LEAD_EDGE)'],
      ['Width', '902 mm'], ['Height', '2083 mm'], ['Depth', '100 mm'],
      ['Frame overall', '902 × 2083 mm'], ['Head', '902 mm long point · mitred both ends'], ['Jamb hinge', '2083 mm long point · mitred top'], ['Jamb lock', '2083 mm long point · mitred top'],
      ['Member', '50 × 100 finished · 63 × 105 raw'], ['Rebate', '15 × 47 · faces 35 / 50'], ['Hinges', '3 × 102 · 150 / 944 / 1738 from the leaf top'], ['Jamb recesses', '188 / 982 / 1776 from the jamb top'],
      ['Spindle', '1000 above the leaf bottom · backset 60'], ['Cylinder', '928 above the leaf bottom'], ['Keep centre', '990 above the jamb foot'], ['Intumescent', '4.906 m'], ['VP glass', '0.203 m² · beads 3.6 m'],
      ['Type', 'fire 6 mm'], ['Panes', '1 · 0.203 m²']];
    const missing = rowsW.filter(([label, value]) => !new RegExp(`${label}</span><span[^>]*>${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`).test(html));
    ok(missing.length === 0, `Window page FDR-01: the ${rowsW.length} spec and calculated rows (Rating FD30 .. Panes 1 · 0.203 m²)`, missing.map(([l, v]) => `${l} = ${v}`).join(' | '));
    ok(!has(html, 'Sashes &amp; Bars') && !has(html, 'Trickle vent') && !has(html, 'Security') && !/NaN|undefined|Infinity/.test(html), 'Window page FDR-01: no Sashes & Bars section, no trickle vent / security rows, no NaN / undefined / Infinity');
    const dr = pageUrl('/projects/p1/batches/b1/windows/dr01', '/projects/:projectId/batches/:batchId/windows/:windowId', M.WDP.default);
    ok(/Rating<\/span><span[^>]*>Non fire</.test(dr) && /Intumescent<\/span><span[^>]*>none \(non-fire door\)</.test(dr) && /Vision panel<\/span><span[^>]*>none</.test(dr) && /Lock<\/span><span[^>]*>latch \(standard\)</.test(dr) && /Closer<\/span><span[^>]*>none</.test(dr),
      'Window page DR-01: Non fire, no intumescent, no vision panel, latch (standard), no closer');
    ok(!/Intumescent<\/span><span[^>]*>[\d.]+ m</.test(dr) && !has(dr, 'Cylinder</span>') && !has(dr, 'VP glass</span>'), 'Window page DR-01: no intumescent metres, cylinder or VP glass row in Calculated');
    const fd60 = pageUrl('/projects/p1/batches/b1/windows/fdr02', '/projects/:projectId/batches/:batchId/windows/:windowId', M.WDP.default);
    ok(/Rating<\/span><span[^>]*>FD60</.test(fd60) && /Leaf<\/span><span[^>]*>826 × 2040 × 54 mm</.test(fd60) && /Rebate<\/span><span[^>]*>15 × 57 · faces 35 \/ 50</.test(fd60) && /Thumbturn<\/span><span[^>]*>922 above the leaf bottom</.test(fd60) && /Handing<\/span><span[^>]*>Hinge right · opens out</.test(fd60) && /Wall depth<\/span><span[^>]*>150 mm</.test(fd60),
      'Window page FDR-02: FD60, leaf 54, rebate 15 × 57, thumbturn 922, Hinge right · opens out, wall 150');
    const sashPage = pageUrl('/projects/p1/batches/b2/windows/sash1', '/projects/:projectId/batches/:batchId/windows/:windowId', M.WDP.default);
    ok(has(sashPage, 'Sashes &amp; Bars') && has(sashPage, 'Trickle vent') && !has(sashPage, 'Fire door</div>') && !has(sashPage, 'bSuite fire doors'), 'Window page sash control: Sashes & Bars, trickle vent, no fire door section or buttons');
  }
  // the GlassPanel and the BOMPanel of the window page
  {
    const fd = W.fdr01;
    const html = renderR(h(M.WDP.GlassPanel, { item: fd.win, windowSpec: fd.windowSpec, derived: fd.derived, batch: batchFD, settings: {}, projectEntity: null, projectLabel: '064' }));
    ok(has(html, 'vision panel 1') && has(html, '450 mm') && has(html, 'fire / fire') && has(html, '6mm fire'), 'GlassPanel FDR-01: the vision panel row (450, fire, 6mm fire)');
    ok(has(html, 'Glass DXF') && has(html, 'Glass Drawings PDF') && has(html, 'Vision panel glass 450 × 450 · ×1') && !has(html, 'Upper Glass') && !has(html, 'Lower Glass'), 'GlassPanel FDR-01: the DXF and drawings PDF buttons, the vision panel card, no sash glass cards');
    ok(count(html, /No data\./g) === 0 && !!html.match(/<td class="px-4 py-2 text-ink-300">none<\/td>/), 'GlassPanel FDR-01: the drawing card renders a drawing (no "No data."), the Bars cell prints none');
    const dr = renderR(h(M.WDP.GlassPanel, { item: W.dr01.win, windowSpec: W.dr01.windowSpec, derived: W.dr01.derived, batch: batchFD, settings: {}, projectEntity: null, projectLabel: '064' }));
    ok(has(dr, 'No glass data.'), 'GlassPanel DR-01 (VP 0): "No glass data."');
    const bom = renderR(h(M.WDP.BOMPanel, { item: fd.win, windowSpec: fd.windowSpec, settings: {}, derived: fd.derived, batch: batchFD, projectLabel: '064' }));
    ok(has(bom, 'Fire door hardware') && has(bom, 'Fire door hinge') && has(bom, '150 / 944 / 1738 from the leaf top') && has(bom, 'Lock case, sashlock euro') && has(bom, 'Euro cylinder') && has(bom, 'Keep') && has(bom, 'Concealed closer') && has(bom, 'Intumescent strip'),
      'BOMPanel FDR-01: the "Fire door hardware" card with hinges (positions), lock, cylinder, keep, closer, intumescent');
    ok(!has(bom, 'Fixed window'), 'BOMPanel FDR-01: never the "Fixed window" copy');
  }
  // the button handlers' calls (the same expressions the pages run)
  {
    const doors = doorsOnly.map(({ windowSpec, derived, win }) => ({ windowSpec, derived, name: win?.name }));
    const r = await M.bsuite.exportBsuiteFireDoorsMerged(doors, 'Pack_1', undefined, async () => { throw new Error('no supabase'); });
    ok(!!r.error && /upload|program/i.test(r.error) && Array.isArray(r.messages), `exportBsuiteFireDoorsMerged(doors, label, undefined, loader): the no-program error ("${String(r.error).slice(0, 60)}...")`);
    const downloads = [];
    globalThis.document = { createElement: () => ({ click() {}, remove() {}, set href(v) { downloads.push(v); }, style: {} }), body: { appendChild() {}, removeChild() {} } };
    const m = M.machining.exportFireDoorMachining(doors, 'Pack_1');
    ok(m.ok && m.doors === 3 && m.rows > 0 && m.files.length === 2 && downloads.length === 2, `exportFireDoorMachining(doors, label): ${m.doors} doors, ${m.rows} ops, two downloads`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('12 - the batch summary strip and the pre-cut panel label');
{
  // the strip of a fire door batch: Ironmongery / Colour / Glass, then Rating / Lock / Closer
  // from the stored firedoor* fields; no Frame, Horns or PAS24 row (FDR-01 euro + closer,
  // FDR-02 FD60 bathroom no closer, DR-01 non-fire latch no closer)
  const rowsFD = M.batchSummary.summarizeWindows(batchFD.windows, 'firedoor');
  ok(J(rowsFD.map((r) => r.label)) === J(['Ironmongery', 'Colour', 'Glass', 'Rating', 'Lock', 'Closer']), `summarizeWindows(fire doors, 'firedoor'): the rows Ironmongery / Colour / Glass / Rating / Lock / Closer, no Frame / Horns / PAS24 (${rowsFD.map((r) => r.label).join(' / ')})`);
  const row = (l) => rowsFD.find((r) => r.label === l)?.text;
  ok(row('Rating') === 'FD30 \u00d71, FD60 \u00d71, non fire \u00d71', `Rating tallies the three doors: "${row('Rating')}"`);
  ok(row('Lock') === 'sashlock euro \u00d71, bathroom \u00d71, latch \u00d71', `Lock: "${row('Lock')}"`);
  ok(row('Closer') === 'no \u00d72, yes \u00d71', `Closer (FDR-01 yes, FDR-02 and DR-01 no): "${row('Closer')}"`);
  ok(row('Ironmongery') === 'brass' && row('Colour') === 'Single' && row('Glass') === 'double', `Ironmongery "${row('Ironmongery')}", Colour "${row('Colour')}", Glass "${row('Glass')}" as the other batches`);
  const unset = M.batchSummary.summarizeWindows([{ windowCategory: 'firedoor' }], 'firedoor');
  const u = (l) => unset.find((r) => r.label === l)?.text;
  ok(u('Rating') === 'FD30' && u('Lock') === 'latch' && u('Closer') === 'yes', `a fire door with the fields unset reads the profile defaults: Rating "${u('Rating')}", Lock "${u('Lock')}", Closer "${u('Closer')}"`);
  const nf = M.batchSummary.summarizeWindows([{ windowCategory: 'firedoor', firedoorFire: false }], 'firedoor');
  ok(nf.find((r) => r.label === 'Rating').text === 'non fire' && nf.find((r) => r.label === 'Closer').text === 'no', 'a non-fire door with the closer unset: Rating "non fire", Closer "no" (the engine rule)');
  const rowsS = M.batchSummary.summarizeWindows([{ ironmongery: 'brass', colourMode: 'single', glassType: 'double', frameType: 'standard', hornType: 'none', pas24: false }], 'sash');
  ok(J(rowsS.map((r) => r.label)) === J(['Ironmongery', 'Colour', 'Glass', 'Frame', 'Horns', 'PAS24']) && rowsS[0].text === 'brass' && rowsS[3].text === 'standard' && rowsS[5].text === 'No', 'a sash batch strip unchanged (Ironmongery / Colour / Glass / Frame / Horns / PAS24)');
  const rowsC = M.batchSummary.summarizeWindows([{ ironmongery: 'chrome', colourMode: 'dual', glassType: 'double', frameType: 'standard', pas24: true }], 'casement');
  ok(J(rowsC.map((r) => r.label)) === J(['Ironmongery', 'Colour', 'Glass', 'Frame', 'PAS24']) && rowsC[1].text === 'Dual' && rowsC[4].text === 'Yes', 'a casement batch strip unchanged (no Horns row)');
  const pack = pageUrl('/projects/p1/batches/b1/production-pack', '/projects/:projectId/batches/:batchId/production-pack', M.PPP.default);
  ok(has(pack, 'Batch Specification') && rowsFD.every((r) => has(pack, `${r.label}: <strong class="text-ink-100">${r.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</strong>`)),
    'the pack page prints every strip row of summarizeWindows for the fire door batch');
  // the pre-cut panel: the one 63x105 member group labelled "Timber" (the C- / W- / FD- word), never "Sash Timber";
  // the settings are the ones the window page passes (kerf, trims, stock lengths)
  const fd = W.fdr01;
  const pcSettings = { kerf: 3, endTrim: 10, minimumPiece: 200, stockLengthSash: 5900, stockLengthBox: 3700 };
  let html = '', err = null;
  try { html = renderToStaticMarkup(h(M.MemoryRouter, null, h(M.PreCutPanel, { item: fd.win, windowSpec: fd.windowSpec, settings: pcSettings, derived: fd.derived, batch: batchFD, projectLabel: '064' }))); } catch (e) { err = e; }
  ok(!err, 'PreCutPanel renders a fire door without throwing', err ? String(err.stack || err).slice(0, 300) : '');
  const labels = [...html.matchAll(/<div class="text-sm font-semibold text-ink-50">([^<]*)<\/div>/g)].map((m) => m[1]).filter((l) => /Timber/.test(l));
  ok(labels.length === 1 && labels[0] === 'Timber \u2014 50x100', `PreCutPanel: one timber group labelled "${labels[0]}" (Timber, the finished 50x100; not "Sash Timber")`, labels.join(' | '));
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(/pre-cut: 63x105/.test(txt) && /3 elements \u00b7 3 pcs/.test(txt) && /HEAD \(FH\) 912 mm 902 mm 63x105 1/.test(txt) && /JAMB-H \(HJ\) 2093 mm 2083 mm 63x105 1/.test(txt) && /JAMB-L \(LJ\) 2093 mm 2083 mm 63x105 1/.test(txt),
    'PreCutPanel: pre-cut 63x105, 3 elements, the table HEAD (FH) 912 / 902, JAMB-H (HJ) and JAMB-L (LJ) 2093 / 2083');
  // one 5900 bar: 2093 + 2093 + 912 = 5098, waste 802 - 2 x 10 end trims - 2 x 3 kerfs = 776, utilisation 5098 / 5900 = 86.4 %
  ok(!/FD-/.test(txt) && !/NaN|undefined|Infinity/.test(txt) && !/No pre-cut data/.test(txt) && /Bars: 1 · Waste: 776 mm · Util: 86\.4%/.test(txt) && /HJ 2093 LJ 2093 FH 912/.test(txt),
    'PreCutPanel: no FD- prefix in the visible text, no NaN / undefined / Infinity; one bar HJ 2093 LJ 2093 FH 912, waste 776 mm, util 86.4%', txt.match(/Bars: [^O]*/)?.[0]);
}

console.log(`\nt51: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
