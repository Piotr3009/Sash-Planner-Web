/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * tripleDrawUtils.js: the triple sash sections for the 2D sheets, the Drawings
 * panel, the Elements plan and the production pack (Piotr 13.10.2026: the
 * window page showed a triple sash as one double-hung sash, the 3D as a double).
 *
 * One law, read from the engine and never recomputed here: `derived.tripleSections`
 * (calculations.js tripleSectionWidths, the same numbers behind the cut list rows
 * "(FIX L)", "(C)", "(FIX R)" and the two MULLION rows) gives the sash widths, the
 * section openings, the running gap of every sash (the double-hung rule, 3 a side)
 * and the clear width between the internal jamb liners. Left to right inside that
 * clear width: gap / 2, sash, gap / 2, mullion post, gap / 2, sash, ... so the x of
 * every sash and post here is measured from the LEFT EDGE OF THE CLEAR OPENING
 * (frame x = (frameWidth - clear) / 2). A double-hung window has no sections
 * (null) and every caller keeps its single-sash path untouched.
 *
 * Bars: the configurator's 3D draws the glazing bars on the centre (opening)
 * sash only, the fixed sections carry none; the sheets follow the 3D. The
 * glass rows of a triple (lists.js) carry no bar pattern today: see
 * BLOCKERS.md, open owner decision.
 */

/** The glass-list location word of each section (lists.js triple rows: 'fix L upper', 'centre lower', ...). */
const LIST_LOCATION = { L: 'fix L', C: 'centre', R: 'fix R' };

/**
 * Sections and mullions of a triple sash, x measured from the LEFT edge of the
 * clear opening between the internal jamb liners (frame x = (frameWidth - clear) / 2),
 * or null for a double-hung.
 * { sections: [{ key, label, index, width, opening, fixed, x, listLocation }],
 *   mullions: [{ key, label, x, width }], mullionFace, gap, clear, totalWidth }
 */
export function tripleSections(derived) {
  const t = derived?.tripleSections;
  if (!t) return null;
  const mullionFace = Number(t.mullionFace) || 0;
  const gap = Number(t.gap) || 0;
  const op = t.openings || {};
  const defs = [
    { key: 'L', label: 'FIX L', width: Number(t.left) || 0, opening: Number(op.left) || (Number(t.left) || 0) + gap, fixed: true },
    { key: 'C', label: 'C', width: Number(t.center) || 0, opening: Number(op.center) || (Number(t.center) || 0) + gap, fixed: false },
    { key: 'R', label: 'FIX R', width: Number(t.right) || 0, opening: Number(op.right) || (Number(t.right) || 0) + gap, fixed: true },
  ];
  let x = 0;               // the left edge of the current section opening
  const sections = [];
  const mullions = [];
  defs.forEach((s, index) => {
    sections.push({ ...s, index, x: x + gap / 2, listLocation: LIST_LOCATION[s.key] });
    x += s.opening;
    if (index < 2) {
      mullions.push({ key: index === 0 ? 'L' : 'R', label: `MULLION (${index === 0 ? 'L' : 'R'})`, x, width: mullionFace });
      x += mullionFace;
    }
  });
  const clear = Number(t.clear) || x;
  return { sections, mullions, mullionFace, gap, clear, totalWidth: x };
}

/** The sheet / rig key of one section's sash sheet: 'upperL', 'lowerC', ... */
export function tripleSheetKey(type, section) {
  return `${type}${section.key}`;
}

/** The sheet label: 'Upper Sash FIX L', 'Lower Sash C', ... */
export function tripleSheetLabel(type, section) {
  return `${type === 'upper' ? 'Upper' : 'Lower'} Sash ${section.label}`;
}

/** The engine's mullion record (cut list row MULLION (L) / (R)) of a triple sash, or null. */
export function tripleMullionRecord(derived, key = 'L') {
  const rows = derived?.components?.sash || [];
  return rows.find((c) => c.elementName === `MULLION (${key})`) || null;
}
