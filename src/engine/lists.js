/**
 * lists.js — production list builders for a single window.
 *
 * Wraps `deriveWindowData` output into shapes that the UI tables and
 * the optimizer expect. Each builder is scoped to a single window;
 * `bom.js` (`mergeWindowMaterials`) merges many windows into one list.
 */

import { CONSTANTS, deriveWindowData } from './calculations.js';
import { GLASS_MAKEUP, glassGas } from './specification.js';
import { profileRawForSection } from './profile.js';

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

/**
 * BOX_MATERIAL_SECTION — maps a box element's FINISHED cross-section (as produced
 * by the engine) to the RAW cross-section actually purchased. Used ONLY by the
 * Pre-Cut list for (a) the displayed Section label and (b) grouping elements that
 * share one purchased material into a single bar-optimizer block (less waste).
 *
 * It changes NO calculation: lengths and finished sizes from deriveWindowData are
 * untouched. Elements sharing a target material are cut from the same stock:
 *   head + jambs            → 38x150
 *   all liners (int/ext,    → 25x120
 *     head + jamb)
 *   cill                    → 50x75
 *   cill nose               → 50x150
 */
const BOX_MATERIAL_SECTION = {
  '28x141': '38x150', // head, jambs
  '17x86':  '25x120', // internal liners (head + jamb)
  '17x102': '25x120', // external liners (head + jamb)
  '69x46':  '50x75',  // cill
  '64x128': '50x150', // cill nose
};

export function buildCutListForWindow(derived, windowSpec) {
  if (derived?.unsupported) return [];
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
  if (derived?.unsupported) return [];
  const settings = settingsWithDefaults(settingsArg);
  if (!derived) return { sashEngineering: [], boxSapele: [] };

  const MACHINING_ALLOWANCE = 20; // mm added to finished length for pre-cut

  // Sash precut groups by section (mapped via settings.sectionMap to raw)
  const bySection = new Map();
  derived.components.sash.forEach((c) => {
    const raw = (settings?.sectionMap?.[c.section] || profileRawForSection(c.section) || settings.sectionMap[c.section]) || settings.sectionMap['57x57'];
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

  // Box precut grouped by PURCHASED material section (Pre-Cut scope only).
  // Elements that share a stock cross-section (e.g. all liners → 25x120,
  // head + jambs → 38x150) land in one group so the optimizer cuts them from
  // the same bars. The displayed Section shows the material we buy; lengths and
  // finished sizes are unchanged.
  const byMaterial = new Map();
  derived.components.box.forEach((c) => {
    if (c.section == null) return;
    const materialSection = BOX_MATERIAL_SECTION[c.section] || c.section;
    if (!byMaterial.has(materialSection)) byMaterial.set(materialSection, []);
    byMaterial.get(materialSection).push({
      elementName: c.elementName,
      length: Math.round(c.length + MACHINING_ALLOWANCE),
      finishedLength: Math.round(c.length),
      section: materialSection,    // purchased material (display + grouping)
      finishedSection: c.section,  // finished element cross-section (unchanged)
      quantity: c.quantity,
      windowId: c.windowId,
      windowName: c.windowName
    });
  });

  return {
    sashEngineering: Array.from(bySection.entries()).map(([section, items]) => ({ section, items })),
    boxSapele: Array.from(byMaterial.entries()).map(([preCutWidth, items]) => ({ preCutWidth, items }))
  };
}

function buildGlassRow(windowSpec, width, height, location, qty) {
  const glassType = windowSpec?.glazing?.type || 'double';
  const glassSpec = windowSpec?.glazing?.spec || 'toughened';
  const spacer = windowSpec?.glazing?.spacerColour || 'silver';
  const spacerType = windowSpec?.glazing?.spacerType || 'warm';
  const makeup = windowSpec?.glazing?.makeup ?? (GLASS_MAKEUP[glassType] ?? GLASS_MAKEUP.double);
  const coating = windowSpec?.glazing?.coating || 'standard';
  const gas = windowSpec?.glazing?.gas ?? glassGas(glassType);
  const finish = windowSpec?.glazing?.finish || windowSpec?.glazing?.lowerGlass || 'clear';
  return {
    width: Math.round(Math.max(0, width) * 100) / 100,
    height: Math.round(Math.max(0, height) * 100) / 100,
    qty, location,
    type: glassType, spec: glassSpec,
    spacer, spacerType, makeup, coating, gas, finish,
  };
}

export function buildGlassListForWindow(derived, windowSpec) {
  if (!derived || derived.unsupported) return [];

  // Non-double-hung sources (casement, triple sections) supply units directly
  if (Array.isArray(derived.customGlassUnits) && derived.customGlassUnits.length > 0) {
    return derived.customGlassUnits.map((u) => buildGlassRow(windowSpec, u.width, u.height, u.location, u.qty || 1));
  }
  // Triple sash: two panes per section, same heights as double-hung
  if (derived.tripleSections) {
    const t = derived.tripleSections;
    const rows = [];
    const sd3 = derived.sashDims || {};
    const s3 = Number(sd3.stile) || CONSTANTS.STILE_WIDTH;
    const t3 = Number(sd3.topRail) || CONSTANTS.TOP_RAIL_WIDTH;
    const m3 = Number(sd3.meetingRail) || CONSTANTS.MEETING_RAIL_WIDTH;
    const b3 = Number(sd3.bottomRail) || CONSTANTS.BOTTOM_RAIL_WIDTH;
    const R3 = 2 * CONSTANTS.GLASS_REBATE;
    [['fix L', t.left], ['centre', t.center], ['fix R', t.right]].forEach(([loc, w]) => {
      rows.push(buildGlassRow(windowSpec, w - (2 * s3 - R3), derived.topSashHeight - (t3 + m3 - R3), `${loc} upper`, 1));
      rows.push(buildGlassRow(windowSpec, w - (2 * s3 - R3), derived.bottomSashHeight - (m3 + b3 - R3), `${loc} lower`, 1));
    });
    return rows;
  }

  const sw = derived.sashWidth;
  const topH = derived.topSashHeight;
  const botH = derived.bottomSashHeight;
  if (!sw || !topH || !botH) return [];

  // Sealed glass unit dimensions (verified against Excel; defaults 89/75/108).
  // Live rail/stile faces come from derived.sashDims (snapshot-aware), so a
  // meeting rail of 53 or a bottom rail of 120 keeps both units correct & equal.
  const sd = derived.sashDims || {};
  const fStile = Number(sd.stile) || CONSTANTS.STILE_WIDTH;
  const fTop = Number(sd.topRail) || CONSTANTS.TOP_RAIL_WIDTH;
  const fMeet = Number(sd.meetingRail) || CONSTANTS.MEETING_RAIL_WIDTH;
  const fBottom = Number(sd.bottomRail) || CONSTANTS.BOTTOM_RAIL_WIDTH;
  const R2 = 2 * CONSTANTS.GLASS_REBATE;
  const unitW = Math.round((sw - (2 * fStile - R2)) * 100) / 100;
  const unitHupper = Math.round((topH - (fTop + fMeet - R2)) * 100) / 100;
  const unitHlower = Math.round((botH - (fMeet + fBottom - R2)) * 100) / 100;

  const glassType = windowSpec?.glazing?.type || 'double';
  const glassSpec = windowSpec?.glazing?.spec || 'toughened';
  const spacer = windowSpec?.glazing?.spacerColour || 'silver';
  const spacerType = windowSpec?.glazing?.spacerType || 'warm';
  const makeup = windowSpec?.glazing?.makeup ?? (GLASS_MAKEUP[glassType] ?? GLASS_MAKEUP.double);
  const coating = windowSpec?.glazing?.coating || 'standard';
  const gas = windowSpec?.glazing?.gas ?? glassGas(glassType);
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
      coating,
      gas,
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
      coating,
      gas,
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
  const cat = windowSpec?.category || 'sash';
  if (cat !== 'sash') return []; // casement/door hardware comes later
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

/**
 * MIRROR_PAIRS — left element name → { right element name, merged symbol, merged label }.
 * Pairs are merged per window into a single row (qty ×2) since L/R are identical.
 */
export const MIRROR_PAIRS = {
  'JAMB LEFT':                { right: 'JAMB RIGHT',                symbol: 'JB-L/R',  label: 'Jambs (pair)' },
  'INTERNAL JAMB LINER (L)':  { right: 'INTERNAL JAMB LINER (R)',  symbol: 'IL-L/R',  label: 'Internal Jamb Liner (pair)' },
  'EXTERNAL JAMB LINER (L)':  { right: 'EXTERNAL JAMB LINER (R)',  symbol: 'EL-L/R',  label: 'External Jamb Liner (pair)' },
  'STILES TOP (L)':           { right: 'STILES TOP (R)',           symbol: 'ST-L/R',  label: 'Stiles Top (pair)' },
  'STILES BOTTOM SASH (L)':   { right: 'STILES BOTTOM SASH (R)',   symbol: 'SBS-L/R', label: 'Stiles Bottom Sash (pair)' },
};

/**
 * CUT_LIST_ORDER — the fixed display order of element TYPES in the cut list.
 * Each entry maps an engine element name to its symbol/label. Pair entries
 * (isPair) merge the L element with its MIRROR_PAIRS right partner per window.
 * The cut list groups ALL windows under each type (no per-window sections),
 * never sums across windows, and sorts pieces longest-first within each group.
 */
export const CUT_LIST_ORDER = [
  // ── BOX ──
  { match: 'HEAD',                      symbol: 'HEAD',    label: 'Head' },
  { match: 'JAMB LEFT',                 symbol: 'JB-L/R',  label: 'Jambs (pair)',                isPair: true },
  { match: 'INTERNAL JAMB LINER (L)',   symbol: 'IL-L/R',  label: 'Internal Jamb Liner (pair)',  isPair: true },
  { match: 'EXTERNAL JAMB LINER (L)',   symbol: 'EL-L/R',  label: 'External Jamb Liner (pair)',  isPair: true },
  { match: 'INTERNAL HEAD LINER',       symbol: 'IHL',     label: 'Internal Head Liner' },
  { match: 'EXTERNAL HEAD LINER',       symbol: 'EHL',     label: 'External Head Liner' },
  { match: 'CILL',                      symbol: 'SILL',    label: 'Cill' },
  { match: 'CILL NOSE',                 symbol: 'CNOS',    label: 'Cill Nose' },
  // ── SASH ──
  { match: 'STILES TOP (L)',            symbol: 'ST-L/R',  label: 'Stiles Top (pair)',           isPair: true },
  { match: 'STILES BOTTOM SASH (L)',    symbol: 'SBS-L/R', label: 'Stiles Bottom Sash (pair)',   isPair: true },
  { match: 'TOP RAIL',                  symbol: 'TR',      label: 'Top Rail' },
  { match: 'TOP MEET RAIL',             symbol: 'TMR',     label: 'Top Meet Rail' },
  { match: 'BOTTOM MEET RAIL',          symbol: 'BMR',     label: 'Bottom Meet Rail' },
  { match: 'BOTTOM RAIL',               symbol: 'BR',      label: 'Bottom Rail' },
];

/**
 * buildGroupedCutList — single source of cut-list grouping.
 * Returns an ORDERED array of groups (one per element TYPE present), following
 * CUT_LIST_ORDER. Each group:
 *   { symbol, label, mirror, section, rows: [{ window, projectNum, length, qty, mismatch? }] }
 * Rules:
 *   - Group by TYPE across ALL windows (no per-window sections).
 *   - Pair types merge L+R of the SAME window & SAME length into one row qty×2.
 *     A pair whose L/R differ in length is NOT merged (kept as two rows, flagged
 *     mismatch:true) — that signals a calculation error.
 *   - Never sum across windows: each window's piece is its own row.
 *   - Sort rows longest-first; ties broken by window name (asc).
 *   - Groups with no rows are omitted.
 */
export function buildGroupedCutList(rawCutList) {
  if (!Array.isArray(rawCutList) || rawCutList.length === 0) return [];

  const win = (r) => r.windowName || r.window || '';
  const proj = (r) => r._projectNumber || r.projectNum || '';

  // Consolidate rows of the SAME length within a group into one row:
  // sum the quantities and collect the contributing window names.
  // Rows flagged mismatch are never merged (kept separate as error signals).
  const consolidate = (rows) => {
    const byLen = new Map();
    const passthrough = [];
    rows.forEach((r) => {
      if (r.mismatch) { passthrough.push(r); return; }
      const k = r.length;
      if (!byLen.has(k)) {
        byLen.set(k, { length: r.length, qty: 0, windows: [], projectNum: r.projectNum, section: r.section });
      }
      const agg = byLen.get(k);
      agg.qty += r.qty;
      if (r.window && !agg.windows.includes(r.window)) agg.windows.push(r.window);
    });
    const merged = Array.from(byLen.values()).map((a) => ({
      length: a.length, qty: a.qty,
      window: a.windows.join(', '),   // listed windows, e.g. "W2, r5, w4"
      windowCount: a.windows.length,
      projectNum: a.projectNum, section: a.section,
    }));
    return [...merged, ...passthrough];
  };

  // Bucket rows by engine element name.
  const byElement = new Map();
  rawCutList.forEach((row) => {
    const k = row.element;
    if (!byElement.has(k)) byElement.set(k, []);
    byElement.get(k).push(row);
  });

  const groups = [];

  CUT_LIST_ORDER.forEach((def) => {
    const leftRows = byElement.get(def.match) || [];
    if (def.isPair) {
      const pair = MIRROR_PAIRS[def.match];
      const rightRows = [...(byElement.get(pair.right) || [])];
      const rows = [];
      leftRows.forEach((L) => {
        // Find the right partner from the SAME window with the SAME length.
        const idx = rightRows.findIndex(
          (R) => win(R) === win(L) && R.length === L.length
        );
        if (idx >= 0) {
          const R = rightRows.splice(idx, 1)[0];
          rows.push({
            window: win(L), projectNum: proj(L), length: L.length,
            qty: (L.quantity || 1) + (R.quantity || 1), section: L.section,
          });
        } else {
          // No equal-length partner in same window → keep L alone, flag mismatch.
          rows.push({
            window: win(L), projectNum: proj(L), length: L.length,
            qty: L.quantity || 1, section: L.section, mismatch: true,
          });
        }
      });
      // Any leftover right rows had no left partner → also mismatch.
      rightRows.forEach((R) => {
        rows.push({
          window: win(R), projectNum: proj(R), length: R.length,
          qty: R.quantity || 1, section: R.section, mismatch: true,
        });
      });
      if (rows.length) {
        const consolidated = consolidate(rows);
        consolidated.sort((a, b) => (b.length - a.length) || (a.window || '').localeCompare(b.window || ''));
        groups.push({ symbol: def.symbol, label: def.label, mirror: true, section: consolidated[0].section || '', rows: consolidated });
      }
    } else {
      if (leftRows.length) {
        const rows = leftRows.map((r) => ({
          window: win(r), projectNum: proj(r), length: r.length, qty: r.quantity || 1, section: r.section,
        }));
        const consolidated = consolidate(rows);
        consolidated.sort((a, b) => (b.length - a.length) || (a.window || '').localeCompare(b.window || ''));
        groups.push({ symbol: def.symbol, label: def.label, mirror: false, section: consolidated[0].section || '', rows: consolidated });
      }
    }
  });

  return groups;
}
