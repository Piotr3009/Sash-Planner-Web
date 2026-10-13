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
 * One law, read from the engine and never recomputed here: the section widths
 * are `derived.tripleSections` (calculations.js tripleSectionWidths, the same
 * numbers behind the cut list rows "(FIX L)", "(C)", "(FIX R)" and the two
 * MULLION rows), the sections sit inside the sash width (`derived.sashWidth`)
 * left to right with a mullion post of `mullionFace` between them. A
 * double-hung window has no sections (null) and every caller keeps its
 * single-sash path untouched.
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
 * sash area (frame x = (frameWidth - sashWidth) / 2), or null for a double-hung.
 * { sections: [{ key, label, index, width, fixed, x, listLocation }], mullions: [{ key, label, x, width }], mullionFace, totalWidth }
 */
export function tripleSections(derived) {
  const t = derived?.tripleSections;
  if (!t) return null;
  const mullionFace = Number(t.mullionFace) || 0;
  const defs = [
    { key: 'L', label: 'FIX L', width: Number(t.left) || 0, fixed: true },
    { key: 'C', label: 'C', width: Number(t.center) || 0, fixed: false },
    { key: 'R', label: 'FIX R', width: Number(t.right) || 0, fixed: true },
  ];
  let x = 0;
  const sections = defs.map((s, index) => {
    const section = { ...s, index, x, listLocation: LIST_LOCATION[s.key] };
    x += s.width + mullionFace;
    return section;
  });
  const mullions = [
    { key: 'L', label: 'MULLION (L)', x: sections[0].x + sections[0].width, width: mullionFace },
    { key: 'R', label: 'MULLION (R)', x: sections[1].x + sections[1].width, width: mullionFace },
  ];
  return { sections, mullions, mullionFace, totalWidth: x - mullionFace };
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
