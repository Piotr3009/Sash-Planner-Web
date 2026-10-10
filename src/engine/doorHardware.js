/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOOR HARDWARE (Piotr 08.10.2026, doors to production): the counting rules
// for door ironmongery and the variant attributes the buyer selects on the
// BJ Waller page (Winkhaus products). The engine (deriveDoorWindow) calls
// selectDoorHardware once per door; the BOM turns the summary into Assign
// Materials quantities (d_* rows) and the hardware list prints the detail.
//
// Rows and counts (owner box items 12 to 15):
//   every door leaf               d_hinges 3, or 4 when the leaf is taller
//                                 than hinges.tallAbove (2100)
//   single door                   d_lock_single_kit 1 (ThunderBolt multipoint
//                                 single door kit), d_cylinder 1, d_handle_set 1
//   french, lockType 'double'     d_lock_double_kit 1 (FGTE double door kit:
//                                 master, slave, shootbolts), d_cylinder 2
//                                 (keyed alike), d_handle_set 2
//   french, lockType 'single'     d_lock_single_kit 1 (active leaf), d_bolts 2
//                                 (passive leaf, top and bottom), d_cylinder 1,
//                                 d_handle_set 1
//   aluminium threshold           d_threshold_alu_single / _double 1 pc
//   low-profile threshold         d_threshold_low_single / _double 1 pc
//   either of the two             d_threshold_seal, one length per door
//                                 opening, in metres (doors v3, 09.10.2026)
//   inward door                   always the timber inward cill: no product
//
// Handing (doors v3, owner box item 11): the printouts say exactly what the
// configurator says, the PSW convention: "Hinge left" = hinges on the left
// seen from INSIDE, plus "opens outward" / "opens inward". The Winkhaus words
// (LH / RH, anti-clockwise / clockwise closing) are not printed any more; the
// kit handing the engine would pick stays internal (doorHanding, kitHanding).
//
// Hinges are an owner product, not a ladder: no automatic size selection and
// no load limit (owner box item 12, 09.10.2026), at least DOOR_MIN_HINGES a
// leaf. The leaf weight is reported for information only.
//
// This module imports nothing: keep it cycle-free (stores import from here).
// ─────────────────────────────────────────────────────────────────────────────

// FGTE double door kit height bands (BJ Waller page, 08.10.2026), by LEAF
// height. 'slave' = slave shootbolts only; 'both' = master and slave shootbolts.
export const FGTE_BANDS = {
  slave: [[1818, 1964], [1965, 2161], [2162, 2611], [2612, 3061]],
  both: [[2108, 2161], [2162, 2181], [2182, 2378], [2379, 2611], [2612, 2828], [2829, 3061]],
};

/** The FGTE band that carries this leaf height, or null when none does. */
export function fgteBand(leafH, family = 'slave') {
  const bands = FGTE_BANDS[family] || FGTE_BANDS.slave;
  const h = Number(leafH) || 0;
  const b = bands.find(([lo, hi]) => h >= lo && h <= hi);
  return b ? { lo: b[0], hi: b[1] } : null;
}

/**
 * The kit handing of a door leaf (INTERNAL, never printed since doors v3):
 * LH / RH read from the side the leaf swings TOWARDS (the outside for an
 * outward door, the inside for an inward one), hinges on the left there = LH.
 * `hingeFromOutside` is the leaf hinge as drawn in the exterior view
 * ('left' | 'right'). Kept so the order can name a handed kit variant if the
 * supplier needs one (BLOCKERS 31).
 */
export function doorHanding(hingeFromOutside, inward) {
  const seen = inward
    ? (hingeFromOutside === 'left' ? 'right' : 'left')   // seen from inside, left and right swap
    : hingeFromOutside;
  return seen === 'left' ? 'LH' : 'RH';
}

/**
 * The handing as printed (doors v3, owner box item 11, the PSW convention):
 * the configurator value, "Hinge left" = hinges on the left seen from inside,
 * and the opening direction. "Hinge left · opens outward".
 */
export function doorHandingLabel(hingeSide, inward) {
  return `Hinge ${hingeSide === 'right' ? 'right' : 'left'} · opens ${inward ? 'inward' : 'outward'}`;
}

/** The fewest hinges a door leaf takes, whatever the profile says (owner box item 12). */
export const DOOR_MIN_HINGES = 3;

/** Hinges on one door leaf: perLeaf, or perLeafTall above tallAbove. */
export function doorHingeCount(leafH, rule) {
  const r = rule || {};
  // Owner box item 12 (09.10.2026): no load limit, but never fewer than 3 hinges a leaf
  return Math.max(DOOR_MIN_HINGES, (Number(leafH) || 0) > (Number(r.tallAbove) || 2100)
    ? (Number(r.perLeafTall) || 4)
    : (Number(r.perLeaf) || 3));
}

/**
 * Hinge centres, mm from the leaf TOP (the sheets' rule since 05.08.2026):
 * top fromTop below the leaf top, middle aboveCentre above the leaf centre,
 * bottom fromBottom above the leaf bottom; a 4th hinge halfway between the top
 * and the middle one when the leaf takes four.
 */
export function doorHingePositions(leafH, rule) {
  const r = rule || {};
  const h = Number(leafH) || 0;
  const top = Number(r.fromTop ?? 200);
  const middle = h / 2 - Number(r.aboveCentre ?? 100);
  const bottom = h - Number(r.fromBottom ?? 150);
  return doorHingeCount(h, r) === 4 ? [top, (top + middle) / 2, middle, bottom] : [top, middle, bottom];
}

// ── Assign Materials rows (materialAssignmentStore DOOR_PARTS.ironmongery) ──
// `slot` = the configurator ironmongery category whose per-window product,
// when set, is bought for that window instead of the row's own material.
export const DOOR_HARDWARE_PARTS = [
  { id: 'd_hinges', name: 'Door Hinges', slot: 'doorHinges',
    hint: 'Counted per door leaf: 3 hinges, 4 when the leaf is taller than 2100mm (Window Settings, Doors). Pieces. Side panel leaves are fixed and get none. The leaf weight is printed on the hardware detail for information: no automatic size selection, assign a hinge rated for your heaviest leaf.' },
  { id: 'd_lock_single_kit', name: 'Multipoint Lock: Single Door Kit (ThunderBolt)', slot: 'multipointLocks',
    hint: 'Winkhaus ThunderBolt 5-point single door kit. 1 per single door; 1 per french door with ONE handle (lockType single, on the active leaf). The detail prints the handing as the configurator states it (Hinge left / right, seen from inside; opens outward / inward), door thickness, backset, faceplate and keeps to select on the BJ Waller page.' },
  { id: 'd_lock_double_kit', name: 'Multipoint Lock: Double Door Kit (FGTE)', slot: 'multipointLocks',
    hint: 'Winkhaus FGTE double door kit (master, slave, shootbolts). 1 per french door with TWO handles (lockType double). The height band comes from the leaf height; the detail prints the band, the shootbolt family, the slave backset, the lock centre line and the cill keep option.' },
  { id: 'd_cylinder', name: 'Door Cylinder', slot: 'cylinders',
    hint: 'Euro cylinder. 1 per single door, 1 per french door with one handle, 2 per french door with two handles (keyed alike).' },
  { id: 'd_handle_set', name: 'Door Handle Set', slot: 'doorHandles',
    hint: 'Lever handle set (inside and outside). 1 per single door, 1 per french door with one handle, 2 per french door with two handles.' },
  { id: 'd_bolts', name: 'Door Bolts', slot: 'bolts',
    hint: 'Flush bolts on the passive leaf of a french door with ONE handle: 2 per door (top and bottom). The FGTE kit of a two-handle french door has its own shootbolts.' },
  { id: 'd_threshold_alu_single', name: 'Aluminium Threshold: Single Door', slot: 'thresholds',
    hint: '1 piece per single door with the aluminium threshold (no timber cill).' },
  { id: 'd_threshold_alu_double', name: 'Aluminium Threshold: French Door', slot: 'thresholds',
    hint: '1 piece per french door with the aluminium threshold (no timber cill).' },
  { id: 'd_threshold_low_single', name: 'Low Profile Threshold: Single Door', slot: 'thresholds',
    hint: '1 piece per single door with the low-profile threshold (no timber cill).' },
  { id: 'd_threshold_low_double', name: 'Low Profile Threshold: French Door', slot: 'thresholds',
    hint: '1 piece per french door with the low-profile threshold (no timber cill).' },
  // Doors v3 (owner box item 9): the seal bought with every aluminium or
  // low-profile threshold. Metres; no per-window slot (the window's threshold
  // product must not replace it), the row opens on the thresholds tab.
  { id: 'd_threshold_seal', name: 'Threshold Seal', slot: null, category: 'thresholds', unit: 'm',
    hint: 'With an aluminium or low-profile threshold: one length per door opening (the clear width between the frame lands of the door), in metres. A timber cill (and every inward door) buys none.' },
];
export const DOOR_PART_SLOT = Object.fromEntries(DOOR_HARDWARE_PARTS.filter((p) => p.slot).map((p) => [p.id, p.slot]));

// Hardware list item names (lists.buildHardwareList) and the ironmongery slot
// each one shows the product of (bom.HARDWARE_TO_SLOT_KEY).
export const DOOR_HARDWARE_ITEMS = {
  hinges: 'Door hinges',
  singleKit: 'Multipoint lock, single door kit',
  doubleKit: 'Multipoint lock, double door kit',
  cylinder: 'Door cylinder',
  handle: 'Door handle set',
  bolts: 'Door bolts',
  threshold: 'Door threshold',
  thresholdSeal: 'Threshold seal',
};
export const DOOR_ITEM_SLOT = {
  [DOOR_HARDWARE_ITEMS.hinges]: 'doorHinges',
  [DOOR_HARDWARE_ITEMS.singleKit]: 'multipointLocks',
  [DOOR_HARDWARE_ITEMS.doubleKit]: 'multipointLocks',
  [DOOR_HARDWARE_ITEMS.cylinder]: 'cylinders',
  [DOOR_HARDWARE_ITEMS.handle]: 'doorHandles',
  [DOOR_HARDWARE_ITEMS.bolts]: 'bolts',
  [DOOR_HARDWARE_ITEMS.threshold]: 'thresholds',
};

/**
 * The hardware of ONE door.
 *   leaves:  derived door leaves [{ h, hinge, role, weightKg }]
 *   isFrench, lockType ('single' | 'double'), inward, hingeSide (the
 *   configurator value), threshold (the EFFECTIVE type: an inward door is
 *   always 'standard'), hasTimberCill, thresholdSeal ({ length, metres } or null)
 *   hinges:  profile hinge rule; hw: profile hardware defaults
 * Returns { summary: { partId: qty } (pieces), metres: { partId: m },
 *           detail: [{ item, detail, quantity, partId, unit? }],
 *           handing (the printed label), kitHanding (internal LH / RH), kit, fgte }.
 */
export function selectDoorHardware({ leaves, isFrench, lockType, inward, hingeSide, threshold, hasTimberCill, thresholdSeal, hinges, hw, leafDepth }) {
  const H = hw || {};
  const summary = {};
  const metres = {};
  const detail = [];
  const add = (partId, qty) => { if (qty > 0) summary[partId] = (summary[partId] || 0) + qty; };
  const ls = leaves || [];

  // Hinges: per leaf
  const hingeCounts = ls.map((l) => doorHingeCount(l.h, hinges));
  const hingeTotal = hingeCounts.reduce((a, n) => a + n, 0);
  add('d_hinges', hingeTotal);
  if (hingeTotal > 0) {
    const perLeaf = ls.map((l, i) => `${hingeCounts[i]} on ${l.role === 'single' ? 'the leaf' : `the ${l.role} leaf`} (H ${l.h}${l.weightKg != null ? `, ${l.weightKg} kg` : ''})`).join(' · ');
    detail.push({ item: DOOR_HARDWARE_ITEMS.hinges, partId: 'd_hinges', quantity: hingeTotal,
      detail: `${perLeaf} · weight for information, no automatic size selection` });
  }

  // Lock: the active leaf (single door: the leaf) carries the handing. The
  // printed handing is the configurator's (Hinge left / right seen from
  // inside, opens outward / inward); the kit handing stays internal.
  const active = ls.find((l) => l.role === 'active' || l.role === 'single') || ls[0] || null;
  const kitHanding = active ? doorHanding(active.hinge, inward) : null;
  const handWords = doorHandingLabel(hingeSide, inward);
  const twoHandles = isFrench && lockType === 'double';
  let fgte = null;
  if (twoHandles) {
    const family = H.fgteShootbolts === 'both' ? 'both' : 'slave';
    const leafH = active ? active.h : 0;
    const band = fgteBand(leafH, family);
    fgte = { family, band, leafH, slaveBackset: H.fgteSlaveBackset, centreLine: H.fgteCentreLine, cillKeep: hasTimberCill ? (H.cillKeep || 'yes') : 'no' };
    add('d_lock_double_kit', 1);
    add('d_cylinder', 2);
    add('d_handle_set', 2);
    detail.push({ item: DOOR_HARDWARE_ITEMS.doubleKit, partId: 'd_lock_double_kit', quantity: 1,
      detail: [
        `master on the active leaf ${handWords}`,
        `${family === 'both' ? 'master and slave shootbolts' : 'slave shootbolts only'}`,
        band ? `leaf ${leafH}: height band ${band.lo}-${band.hi}` : `leaf ${leafH}: no height band, verify size`,
        `slave backset ${H.fgteSlaveBackset}`,
        `lock centre line ${H.fgteCentreLine}`,
        `shootbolt keep cill option ${fgte.cillKeep}`,
      ].join(' · '),
      // the attributes the buyer selects on the supplier page (purchase list note)
      variant: [
        handWords,
        family === 'both' ? 'master and slave shootbolts' : 'slave shootbolts only',
        band ? `height band ${band.lo}-${band.hi}` : 'no height band',
        `slave backset ${H.fgteSlaveBackset}`,
        `centre line ${H.fgteCentreLine}`,
        `cill keep ${fgte.cillKeep}`,
      ].filter(Boolean).join(' · ') });
    detail.push({ item: DOOR_HARDWARE_ITEMS.cylinder, partId: 'd_cylinder', quantity: 2, detail: 'keyed alike (FGTE pair)', variant: 'keyed alike pair' });
    detail.push({ item: DOOR_HARDWARE_ITEMS.handle, partId: 'd_handle_set', quantity: 2, detail: 'one per leaf' });
  } else {
    add('d_lock_single_kit', 1);
    add('d_cylinder', 1);
    add('d_handle_set', 1);
    detail.push({ item: DOOR_HARDWARE_ITEMS.singleKit, partId: 'd_lock_single_kit', quantity: 1,
      detail: [
        isFrench ? `on the active leaf ${handWords}` : handWords,
        `door thickness ${H.doorThickness}${leafDepth ? ` (leaf ${leafDepth})` : ''}`,
        `backset ${H.backset}`,
        `faceplate ${H.faceplate}`,
        `keeps ${H.keeps}`,
      ].join(' · '),
      // the attributes the buyer selects on the supplier page (purchase list note)
      variant: [
        handWords,
        `door thickness ${H.doorThickness}`,
        `backset ${H.backset}`,
        `faceplate ${H.faceplate}`,
        `keeps ${H.keeps}`,
      ].filter(Boolean).join(' · ') });
    detail.push({ item: DOOR_HARDWARE_ITEMS.cylinder, partId: 'd_cylinder', quantity: 1, detail: '' });
    detail.push({ item: DOOR_HARDWARE_ITEMS.handle, partId: 'd_handle_set', quantity: 1, detail: isFrench ? 'active leaf' : '' });
    if (isFrench) {
      add('d_bolts', 2);
      detail.push({ item: DOOR_HARDWARE_ITEMS.bolts, partId: 'd_bolts', quantity: 2, detail: 'passive leaf, top and bottom' });
    }
  }

  // Threshold products (no timber cill)
  const kind = threshold === 'aluminium' ? 'alu' : threshold === 'low-profile' ? 'low' : null;
  if (kind) {
    const pid = `d_threshold_${kind}_${isFrench ? 'double' : 'single'}`;
    add(pid, 1);
    detail.push({ item: DOOR_HARDWARE_ITEMS.threshold, partId: pid, quantity: 1,
      detail: `${kind === 'alu' ? 'aluminium' : 'low profile'} · ${isFrench ? 'french (double)' : 'single'} door` });
    if (thresholdSeal && thresholdSeal.metres > 0) {
      metres.d_threshold_seal = (metres.d_threshold_seal || 0) + thresholdSeal.metres;
      detail.push({ item: DOOR_HARDWARE_ITEMS.thresholdSeal, partId: 'd_threshold_seal', quantity: thresholdSeal.metres, unit: 'm',
        detail: `one length per door opening · ${thresholdSeal.length} mm` });
    }
  }

  return { summary, metres, detail, handing: handWords, kitHanding, kit: twoHandles ? 'fgte' : 'thunderbolt', fgte };
}
