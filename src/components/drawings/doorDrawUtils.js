/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * doorDrawUtils.js: shared helpers for the door 2D sheets (08.10.2026, doors
 * to production). ONE plan of the door sheets for the Drawings panel tabs, the
 * PDF capture rig, the Elements PDF and the production pack; ONE grouping of
 * the door glass units for the glass drawings. Every number comes from the
 * derived data (deriveDoorWindow): nothing is computed here.
 */
import { casementPaneFinish } from './casementDrawUtils.js';

/**
 * The detail sheets of one door, in tab and PDF order (the front elevation is
 * its own tab): the frame, the leaf sheet (both leaves of a french door), one
 * sheet per side panel, one per fan leaf (doors v3: fixed fanlights are
 * non-opening casement leaves with their own sheet, labelled fixed; the keys
 * stay doorfan-<i> over derived.door.fanLeaves), and the plan section.
 * Each entry: { key, label, sheet: 'frame' | 'leaf' | 'side' | 'fan' | 'section', props }.
 */
export function doorSheetPlan(derived) {
  const dr = derived?.door;
  if (!dr) return [];
  const plan = [
    // the tab names the owner knows (Frame / Leaf / Sections) are kept
    { key: 'doorframe', label: 'Frame', sheet: 'frame', props: {} },
    { key: 'doorleaf', label: 'Leaf', sheet: 'leaf', props: {} },
  ];
  (dr.panelLeaves || []).forEach((pl) => {
    plan.push({ key: `doorside-${pl.side}`, label: `Side Panel ${pl.side === 'left' ? 'Left' : 'Right'}`, sheet: 'side', props: { side: pl.side } });
  });
  const fans = dr.fanLeaves || [];
  fans.forEach((fl, i) => {
    const name = fl.fixed ? 'Fixed Fanlight' : 'Fanlight Leaf';
    plan.push({ key: `doorfan-${i}`, label: fans.length > 1 ? `${name} ${i + 1} (${fl.over}${fl.side ? ` ${fl.side}` : ''})` : name, sheet: 'fan', props: { index: i } });
  });
  plan.push({ key: 'doorsection', label: 'Sections', sheet: 'section', props: {} });
  return plan;
}

/**
 * Unique door glass units (size + finish) → one factory drawing per size,
 * the pane locations listed (the glass schedule rows). Door fanlights count
 * as fans for the frosted scope (casementPaneFinish).
 * Each group: { key, w, h, finish, rep (customGlassUnits index), units: [indices], panes: [locations] }.
 */
export function groupDoorGlass(derived, windowSpec) {
  if (derived?.category !== 'door') return [];
  const groups = [];
  (derived.customGlassUnits || []).forEach((u, i) => {
    const w = u?.width, h = u?.height;
    if (!w || !h) return;
    const finish = casementPaneFinish(u.role || 'main', windowSpec?.glazing);
    const bars = u.bars ? `${u.bars.h || 0}h${u.bars.v || 0}v` : '';
    const key = `${w}x${h}|${finish}|${bars}`;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, w, h, finish, rep: i, units: [], panes: [] }; groups.push(g); }
    g.units.push(i);
    g.panes.push(u.location || `unit ${i + 1}`);
  });
  return groups;
}
