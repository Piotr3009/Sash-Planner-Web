/**
 * lists.js — production list builders for a single window.
 *
 * Wraps `deriveWindowData` output into shapes that the UI tables and
 * the optimizer expect. Mirrors the aggregation logic in calculations.js
 * (`summariseProjectWindows`) but scoped to a single window.
 */

import { CONSTANTS, deriveWindowData } from './calculations.js';

const DEFAULT_SETTINGS = {
  kerf: 3,
  endTrim: 10,
  minimumPiece: 200,
  stockLengthSash: 5900,
  stockLengthBox: 2500,
  boxWidthAllowance: 20,
  hornExtensionDefault: 75,
  glazingAllowanceWidth: 4,
  glazingAllowanceHeight: 4,
  sectionMap: {
    '57x57': '63x63',
    '57x90': '63x95',
    '57x43': '63x63'
  }
};

function settingsWithDefaults(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    sectionMap: { ...DEFAULT_SETTINGS.sectionMap, ...(settings?.sectionMap || {}) }
  };
}

export function buildCutListForWindow(derived, windowSpec) {
  if (!derived) return [];
  const out = [];
  // Box (frame) components
  derived.components.box.forEach((c) => {
    out.push({
      element: c.elementName,
      section: c.section,
      length: c.length,
      quantity: c.quantity,
      material: 'Sapele / Engineered timber',
      notes: c.notes || ''
    });
  });
  // Sash components
  derived.components.sash.forEach((c) => {
    out.push({
      element: c.elementName,
      section: c.section,
      length: c.length,
      quantity: c.quantity,
      material: 'Hardwood (sash)',
      notes: c.notes || ''
    });
  });
  // NOTE: Glazing bars (VGB/HGB) and beading are intentionally NOT listed here.
  // - Beading is cut on the fly; it remains in the engine (derived.components.beading),
  //   BOM and material list (bom.js reads it directly from derived.components.beading).
  // - Glazing bars between panes are not used in current (non-heritage) windows.
  // Cut list shows only timber that is actually cut to length: frame (box) + sash.
  return out.map((row) => ({ ...row, length: Math.round(row.length) }));
}

export function buildPrecutForWindow(derived, windowSpec, settingsArg) {
  const settings = settingsWithDefaults(settingsArg);
  if (!derived) return { sashEngineering: [], boxSapele: [] };

  const MACHINING_ALLOWANCE = 20; // mm added to finished length for pre-cut

  // Sash precut groups by section (mapped via settings.sectionMap to raw)
  const bySection = new Map();
  derived.components.sash.forEach((c) => {
    const raw = settings.sectionMap[c.section] || settings.sectionMap['57x57'];
    if (!raw) return;
    if (!bySection.has(raw)) bySection.set(raw, []);
    bySection.get(raw).push({
      elementName: c.elementName,
      length: Math.round(c.length + MACHINING_ALLOWANCE),
      finishedLength: Math.round(c.length),
      section: raw,
      finishedSection: c.section,
      quantity: c.quantity,
      windowId: c.windowId,
      windowName: c.windowName
    });
  });

  // Box precut grouped by finished width + allowance
  const allowance = settings.boxWidthAllowance ?? 20;
  const byWidth = new Map();
  derived.components.box.forEach((c) => {
    if (c.finishedWidth == null) return;
    const widthWithAllowance = c.finishedWidth + allowance;
    if (!byWidth.has(widthWithAllowance)) byWidth.set(widthWithAllowance, []);
    byWidth.get(widthWithAllowance).push({
      elementName: c.elementName,
      length: Math.round(c.length + MACHINING_ALLOWANCE),
      finishedLength: Math.round(c.length),
      section: c.section,
      finishedSection: c.section,
      quantity: c.quantity,
      windowId: c.windowId,
      windowName: c.windowName
    });
  });

  return {
    sashEngineering: Array.from(bySection.entries()).map(([section, items]) => ({ section, items })),
    boxSapele: Array.from(byWidth.entries()).map(([preCutWidth, items]) => ({ preCutWidth, items }))
  };
}

export function buildGlassListForWindow(derived, windowSpec) {
  if (!derived) return [];

  const sw = derived.sashWidth;
  const topH = derived.topSashHeight;
  const botH = derived.bottomSashHeight;
  if (!sw || !topH || !botH) return [];

  // Sealed glass unit dimensions (verified against Excel)
  const unitW = Math.round((sw - CONSTANTS.GLASS_WIDTH_DEDUCTION) * 100) / 100;
  const unitHupper = Math.round((topH - CONSTANTS.GLASS_HEIGHT_DEDUCTION) * 100) / 100;
  // Lower deduction: meetRail(43) + botRail(90) - 2×rebate(12.5) = 108
  const LOWER_DEDUCTION = CONSTANTS.MEETING_RAIL_WIDTH + CONSTANTS.BOTTOM_RAIL_WIDTH - 2 * 12.5;
  const unitHlower = Math.round((botH - LOWER_DEDUCTION) * 100) / 100;

  const glassType = windowSpec?.glazing?.type || 'double';
  const glassSpec = windowSpec?.glazing?.spec || 'toughened';
  const spacer = windowSpec?.glazing?.spacerColour || 'silver';
  const spacerType = windowSpec?.glazing?.spacerType || 'warm';
  const makeup = windowSpec?.glazing?.makeup || (glassType === 'triple' ? '4x8x4x8x4' : '4x16x4');
  const isFrosted = windowSpec?.glazing?.finish === 'frosted';
  const frostedLoc = windowSpec?.glazing?.frostedLocation || 'bottom';

  // Determine finish per sash
  let upperFinish = 'clear';
  let lowerFinish = 'clear';
  if (isFrosted) {
    lowerFinish = 'frosted';
    upperFinish = frostedLoc === 'both' ? 'frosted' : 'clear';
  }

  // Bar pattern info for reference
  const gridMode = windowSpec?.sash?.grid?.mode || 'none';

  return [
    {
      label: 'Upper Glass',
      sash: 'upper',
      width: unitW,
      height: unitHupper,
      quantity: 1,
      type: glassType,
      spec: glassSpec,
      spacer,
      spacerType,
      finish: upperFinish,
      makeup,
      bars: gridMode,
    },
    {
      label: 'Lower Glass',
      sash: 'lower',
      width: unitW,
      height: unitHlower,
      quantity: 1,
      type: glassType,
      spec: glassSpec,
      spacer,
      spacerType,
      finish: lowerFinish,
      makeup,
      bars: gridMode,
    },
  ];
}

/**
 * Trickle vent grille count per window (Approved Document F, Vol 1, Table 1.7,
 * multi-storey dwellings; grille equivalent area ≈ 4300mm²).
 *   habitable / kitchen : requires 8000mm² → 2 grilles when this is the room's
 *                         sole window, else 1 (the 8000mm² is shared across the
 *                         room's windows).
 *   bathroom            : requires 4000mm² → 1 grille.
 *   other (utility / WC / non-habitable) : no minimum → 0.
 * Single-storey dwellings (10,000mm²) are intentionally out of scope.
 */
export function buildVentGrilles(windowSpec) {
  const roomType = windowSpec?.vent?.roomType || 'habitable';
  const sole = windowSpec?.vent?.soleWindow !== false; // default true
  switch (roomType) {
    case 'habitable':
    case 'kitchen':
      return sole ? 2 : 1;
    case 'bathroom':
      return 1;
    default:
      return 0;
  }
}

export function buildHardwareList(windowSpec) {
  const finish = windowSpec?.hardware?.finish || 'brass';
  const isPas24 = windowSpec?.hardware?.catches === 'PAS24';
  const openingType = windowSpec?.sash?.openingType || 'both';
  const isFixed = openingType === 'fixed';
  const isBottomOnly = openingType === 'bottom';
  const frameWidth = windowSpec?.frame?.width || 1000;
  const hasBars = windowSpec?.sash?.grid?.mode && windowSpec.sash.grid.mode !== 'none';

  const list = [];

  // Trickle vent — room ventilation, independent of opening type (a fixed window
  // still ventilates its room). Count from the Approved Document F room-type rule.
  const ventQty = buildVentGrilles(windowSpec);
  if (ventQty > 0) {
    list.push({ item: 'Trickle vent', detail: 'Concealed', quantity: ventQty });
  }

  // Fixed windows = no sash hardware (the trickle vent above still applies)
  if (isFixed) return list;

  // Locks: 1 normally, 2 if width > 1200mm OR has Georgian bars (PSW rule)
  const lockQty = (frameWidth > 1200 || hasBars) ? 2 : 1;
  list.push({ item: 'Sash lock', detail: `${finish} finish${isPas24 ? ' (PAS24)' : ''}`, quantity: lockQty });

  // Finger lifts: always 2 per opening window
  list.push({ item: 'Finger lift', detail: finish, quantity: 2 });

  // Pull handles: 1 per window
  list.push({ item: 'Sash pull handle', detail: finish, quantity: 1 });

  // Pulleys: 4 for both, 2 for bottom-only
  const pulleyQty = isBottomOnly ? 2 : 4;
  list.push({ item: 'Pulley wheels', detail: 'Spring balance', quantity: pulleyQty });

  // Stoppers: 1 set per opening window (set already contains the pair)
  list.push({ item: 'Window stopper', detail: finish, quantity: 1 });

  // PAS24 restrictor
  if (isPas24) {
    list.push({ item: 'Restrictor (PAS24)', detail: finish, quantity: 1 });
  }

  return list;
}

export function buildProjectAggregates(items, windowSpecs, settingsArg) {
  const settings = settingsWithDefaults(settingsArg);
  const allCut = [];
  const allPrecut = { sashEngineering: [], boxSapele: [] };
  const allGlass = [];
  const allHardware = [];
  const allBeading = [];

  items.forEach((item, idx) => {
    const ws = windowSpecs[idx];
    if (!ws) return;
    const derived = deriveWindowData(ws, settings);
    allCut.push(...buildCutListForWindow(derived, ws).map((r) => ({ ...r, windowId: ws.id, windowName: ws.name })));
    const pre = buildPrecutForWindow(derived, ws, settings);
    pre.sashEngineering.forEach((g) => {
      const found = allPrecut.sashEngineering.find((x) => x.section === g.section);
      if (found) found.items.push(...g.items);
      else allPrecut.sashEngineering.push({ section: g.section, items: [...g.items] });
    });
    pre.boxSapele.forEach((g) => {
      const found = allPrecut.boxSapele.find((x) => x.preCutWidth === g.preCutWidth);
      if (found) found.items.push(...g.items);
      else allPrecut.boxSapele.push({ preCutWidth: g.preCutWidth, items: [...g.items] });
    });
    allGlass.push(...buildGlassListForWindow(derived, ws));
    allHardware.push(...buildHardwareList(ws));
    if (derived.components?.beading) {
      allBeading.push(...derived.components.beading.map((b) => ({ ...b, windowId: ws.id, windowName: ws.name })));
    }
  });

  return { cutList: allCut, precut: allPrecut, glass: allGlass, hardware: allHardware, beading: allBeading };
}

/**
 * MIRROR_PAIRS — left element name → { right element name, merged symbol, merged label }.
 * Used by buildGroupedCutList to merge mirror L/R pairs into a single row (qty ×2),
 * since both sides are identical (mirror). Single source of cut-list grouping logic,
 * consumed by single-window panel, Production Pack tab, PDF and Excel export.
 */
export const MIRROR_PAIRS = {
  'JAMB LEFT':                { right: 'JAMB RIGHT',                symbol: 'JB-L/R',  label: 'Jambs (L/R)' },
  'INTERNAL JAMB LINER (L)':  { right: 'INTERNAL JAMB LINER (R)',  symbol: 'IL-L/R',  label: 'Internal Jamb Liner (L/R)' },
  'EXTERNAL JAMB LINER (L)':  { right: 'EXTERNAL JAMB LINER (R)',  symbol: 'EL-L/R',  label: 'External Jamb Liner (L/R)' },
  'STILES TOP SASH (L)':      { right: 'STILES TOP SASH (R)',      symbol: 'STS-L/R', label: 'Stiles Top Sash (L/R)' },
  'STILES BOTTOM SASH (L)':   { right: 'STILES BOTTOM SASH (R)',   symbol: 'SBS-L/R', label: 'Stiles Bottom Sash (L/R)' },
};

/**
 * buildGroupedCutList — single source of cut-list presentation logic.
 * Takes a raw cut list (array of rows from buildCutListForWindow) and:
 *   1. Merges mirror L/R pairs into one row (qty doubled), using MIRROR_PAIRS.
 *      If a pair has UNEQUAL lengths, it is NOT merged (kept separate + flagged
 *      with mismatch:true) — unequal mirror parts signal a calculation error.
 *   2. Sorts the resulting rows by length DESCENDING (longest first) — the correct
 *      cutting order so the longest pieces are cut before short offcuts remain.
 *
 * Returns array of rows. Merged rows carry { mergedSymbol, mergedLabel, mirror:true };
 * unmerged rows are passed through unchanged.
 */
export function buildGroupedCutList(rawCutList) {
  if (!Array.isArray(rawCutList) || rawCutList.length === 0) return [];

  // Index rows by element name for pair lookup.
  const byElement = new Map();
  rawCutList.forEach((row) => {
    if (!byElement.has(row.element)) byElement.set(row.element, []);
    byElement.get(row.element).push(row);
  });

  const out = [];
  const consumed = new Set(); // element names already merged as a right-side partner

  rawCutList.forEach((row) => {
    if (consumed.has(`${row.element}|${row.length}`)) return;

    const pair = MIRROR_PAIRS[row.element];
    if (pair) {
      // Find a right-side row of the SAME length (mirror parts must be equal).
      const rights = byElement.get(pair.right) || [];
      const match = rights.find(
        (r) => r.length === row.length && !consumed.has(`${pair.right}|${r.length}`)
      );
      if (match) {
        consumed.add(`${pair.right}|${match.length}`);
        out.push({
          ...row,
          element: pair.label,
          mergedSymbol: pair.symbol,
          mergedLabel: pair.label,
          mirror: true,
          quantity: (row.quantity || 1) + (match.quantity || 1),
        });
        return;
      }
      // No equal-length partner → keep separate, flag mismatch (calculation error signal).
      out.push({ ...row, mismatch: true });
      return;
    }

    // Right-side element handled only if its left partner already merged it.
    const isRightSide = Object.values(MIRROR_PAIRS).some((p) => p.right === row.element);
    if (isRightSide && consumed.has(`${row.element}|${row.length}`)) return;

    out.push({ ...row });
  });

  // Sort by length DESCENDING (longest first = correct cutting order).
  out.sort((a, b) => (b.length || 0) - (a.length || 0));
  return out;
}
