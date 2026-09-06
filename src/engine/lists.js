/**
 * lists.js — production list builders for a single window.
 *
 * Wraps `deriveWindowData` output into shapes that the UI tables and
 * the optimizer expect. Each builder is scoped to a single window;
 * `bom.js` (`mergeWindowMaterials`) merges many windows into one list.
 */

import { CONSTANTS, deriveWindowData } from './calculations.js';
import { CASEMENT_HINGE_SLOTS, CASEMENT_LOCK_SLOTS } from './casementHardware.js';
import { GLASS_MAKEUP, glassGas } from './specification.js';
import { profileRawForSection, getWindowProfile, getCasementProfile } from './profile.js';
// Pure helper (no React) — shared with the 2D drawings so panel, PDF and
// sketch all count bars the same way.
import { casementBarCounts, casementPaneFinish } from '../components/drawings/casementDrawUtils.js';

const DEFAULT_SETTINGS = {
  kerf: 3,
  endTrim: 10,
  minimumPiece: 200,
  stockLengthSash: 5900,
  stockLengthBox: 2500,
  boxWidthAllowance: 20,
  hornExtensionDefault: 70,
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

// resolveRaw?: (elementName) => rawSectionString|null — raw stock taken from the
// ASSIGNED MATERIAL's size (e.g. '150 x 38mm' → '150x38'); falls back to the
// legacy chain (sectionMap / profile raw) when absent. Optional → zero regression.
// ── Curved members (ARCHED-WINDOWS-v3 Block 4) ─────────────────────────────
// A curved member is glued from straight boards on finger joints and routed
// afterwards (arch.js planArchSegments): what the workshop CUTS is the blank
// pieces — stock board width × rough length × pieces — never the arc length.
// Cut-list element name → the blank plan on derived.arch.plans.
export const CURVED_MEMBER_PLAN = Object.freeze({
  'C-ARCH HEAD': 'frameHead', 'C-FRAME RING': 'frameHead',
  'C-ARCH TOP RAIL': 'leafTop', 'C-LEAF RING': 'leafTop',
  'S-ARCH HEAD': 'frameHead', 'S-ARCH TOP RAIL': 'leafTop',
});
export const isCurvedMember = (elementName) => CURVED_MEMBER_PLAN[String(elementName)] !== undefined;

/** The blank plan of a curved cut-list record, or null (no arch on the window / no plan). */
export function curvedPlanFor(derived, elementName) {
  const key = CURVED_MEMBER_PLAN[String(elementName)];
  const plans = derived?.arch?.plans;
  if (!key || !plans) return null;
  return plans[key] || (key === 'frameHead' ? plans.head : plans.topRail) || null;
}

/**
 * Curved members of one window for the production pack: one row per member
 * with the ring radii and the blank plan (pieces × stock × rough length,
 * finger joint). `depth` = the member's finished depth (the blank's thickness).
 */
export function buildCurvedMembersForWindow(derived, windowSpec) {
  if (!derived?.arch?.plans) return [];
  const rows = [];
  const all = [...(derived.components?.box || []), ...(derived.components?.sash || [])];
  for (const c of all) {
    const plan = curvedPlanFor(derived, c.elementName);
    if (!plan) continue;
    const depth = Number(String(c.section).split('x')[1]) || null;
    const geomKey = CURVED_MEMBER_PLAN[c.elementName];
    const ring = derived.arch.geometry?.[geomKey] || derived.arch.geometry?.[geomKey === 'frameHead' ? 'head' : 'topRail'] || null;
    rows.push({
      windowId: c.windowId, windowName: c.windowName || windowSpec?.name || '',
      elementName: c.elementName, code: c.code || '', section: c.section, depth,
      length: c.length, quantity: c.quantity || 1,
      shape: derived.arch.shape,
      radii: ring ? ring.outer.map((a) => Math.round(a.r * 10) / 10) : [],
      pieces: plan.totalPieces,
      noStock: !!plan.noStock,
      arcs: (plan.arcs || []).map((a) => ({ n: a.default?.n ?? null, stock: a.default?.stock ?? null, roughLength: a.default?.roughLength != null ? Math.round(a.default.roughLength) : null, chord: a.default?.chordLength != null ? Math.round(a.default.chordLength) : null, spanDeg: Math.round(a.spanDeg) })),
      shortPieces: plan.shortPieces || [],
      // the finger profile lives on the casement profile (buildArchPlan copies it; derived plans do not)
      finger: plan.finger || getCasementProfile()?.arch?.finger || null,
    });
  }
  return rows;
}

/**
 * Blank pieces of a curved record for the pre-cut list: one item per arc
 * option (n pieces of stock × depth, rough length = chord + finger allowance
 * from the planner — no extra machining allowance, the contour band is already
 * in the rough length). `resolveRaw(name, { kind: 'blank', stock, depth })`
 * lets Material Assignments override the raw section; default = stock × depth.
 */
export function blankPiecesForRecord(c, plan, resolveRaw) {
  const depth = Number(String(c.section).split('x')[1]) || 0;
  const out = [];
  // Piotr 06.09: the pre-cut list shows EVERY piece of the blank (5 pieces on the arc = 5 rows),
  // each with its own stock board, rough length (outer stock edge + finger per jointed end) and
  // end cuts — end pieces differ from middle pieces, so one row per piece, not one per arc.
  // v4: J = joint from square, Q = square (springing face routed with the contour), A = apex from square
  const cutCode = (cut) => (cut.kind === 'square' ? 'Q' : `${cut.kind === 'joint' ? 'J' : 'A'}${Math.round(cut.angleDeg * 10) / 10}`);
  if (Array.isArray(plan.pieces) && plan.pieces.length && plan.pieces.every((pc) => pc.stock)) {
    plan.pieces.forEach((pc, i) => {
      const raw = resolveRaw?.(c.elementName, { kind: 'blank', stock: pc.stock, depth }) || `${pc.stock}x${depth}`;
      const [cutStart, cutEnd] = pc.endCuts || [];
      const finger = pc.jointedEnds === 2 ? 'finger both ends' : pc.jointedEnds === 1 ? 'finger one end' : 'no finger';
      out.push({
        elementName: c.elementName,
        length: Math.round(pc.roughLength),
        finishedLength: Math.round(pc.outerEdge ?? pc.L),
        section: raw,
        finishedSection: c.section,
        quantity: c.quantity || 1,
        windowId: c.windowId,
        windowName: c.windowName,
        blank: true,
        piece: `S${pc.no ?? i + 1}`,
        note: `blank piece S${pc.no ?? i + 1} of ${c.elementName} · cut ${cutStart ? cutCode(cutStart) : '?'} / ${cutEnd ? cutCode(cutEnd) : '?'} · ${finger}`,
      });
    });
    return out;
  }
  for (const a of plan.arcs || []) {
    const d = a.default;
    if (!d || !d.stock) continue;
    const raw = resolveRaw?.(c.elementName, { kind: 'blank', stock: d.stock, depth }) || `${d.stock}x${depth}`;
    out.push({
      elementName: c.elementName,
      length: Math.round(d.roughLength),
      finishedLength: Math.round(d.chordLength),
      section: raw,
      finishedSection: c.section,
      quantity: d.n * (c.quantity || 1),
      windowId: c.windowId,
      windowName: c.windowName,
      blank: true,
      note: `blank piece of ${c.elementName} arc ${a.index + 1} · ${d.n} per member · finger-jointed`,
    });
  }
  return out;
}

export function buildPrecutForWindow(derived, windowSpec, settingsArg, resolveRaw) {
  if (derived?.unsupported) return [];
  const settings = settingsWithDefaults(settingsArg);
  if (!derived) return { sashEngineering: [], boxSapele: [] };

  const MACHINING_ALLOWANCE = 20; // mm added to finished length for pre-cut

  // Sash precut groups by section (mapped via settings.sectionMap to raw)
  const bySection = new Map();
  // v3 Block 4: a curved member is pre-cut as its blank pieces (stock × depth × rough length)
  const pushBlanks = (c) => {
    const plan = curvedPlanFor(derived, c.elementName);
    if (!plan) return false;
    for (const it of blankPiecesForRecord(c, plan, resolveRaw)) {
      if (!bySection.has(it.section)) bySection.set(it.section, []);
      bySection.get(it.section).push(it);
    }
    return true;
  };
  derived.components.sash.forEach((c) => {
    if (pushBlanks(c)) return;
    const raw = resolveRaw?.(c.elementName) || settings?.sectionMap?.[c.section] || profileRawForSection(c.section) || c.section;
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
    if (pushBlanks(c)) return;   // v3 Block 4: curved head / ring → blank pieces
    // Casement frame members (C-*): same raw-keyed list as the rest of the
    // casement timber, so one material assigned across frame + mullions +
    // leaves lands in ONE group and the optimizer cuts it from the same bars.
    if (c.elementName?.startsWith('C-')) {
      const raw = resolveRaw?.(c.elementName) || settings?.sectionMap?.[c.section] || profileRawForSection(c.section) || c.section;
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
      return;
    }
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

function buildGlassRow(windowSpec, width, height, location, qty, finishOverride, role) {
  const glassType = windowSpec?.glazing?.type || 'double';
  const glassSpec = windowSpec?.glazing?.spec || 'toughened';
  const spacer = windowSpec?.glazing?.spacerColour || 'silver';
  const spacerType = windowSpec?.glazing?.spacerType || 'warm';
  const makeup = windowSpec?.glazing?.makeup ?? getWindowProfile()?.glassMakeup?.[glassType] ?? (GLASS_MAKEUP[glassType] ?? GLASS_MAKEUP.double);
  const coating = windowSpec?.glazing?.coating || 'standard';
  const gas = windowSpec?.glazing?.gas ?? glassGas(glassType);
  const finish = finishOverride || windowSpec?.glazing?.finish || windowSpec?.glazing?.lowerGlass || 'clear';
  return {
    width: Math.round(Math.max(0, width) * 100) / 100,
    height: Math.round(Math.max(0, height) * 100) / 100,
    qty, location,
    label: location, quantity: qty, role: role || 'main',
    type: glassType, spec: glassSpec,
    spacer, spacerType, makeup, coating, gas, finish,
  };
}

export function buildGlassListForWindow(derived, windowSpec) {
  if (!derived || derived.unsupported) return [];

  // Non-double-hung sources (casement, triple sections) supply units directly
  if (Array.isArray(derived.customGlassUnits) && derived.customGlassUnits.length > 0) {
    const barType = windowSpec?.casement?.barType === 'georgian' ? 'georgian' : 'astragal';
    return derived.customGlassUnits.map((u) => {
      // Casement frosted scope lives in ONE place: casementPaneFinish
      // ('bottom' = main lights only, 'both' = every pane). Screen drawings
      // and 3D call the same helper, so they cannot drift from these rows.
      const gz = windowSpec?.glazing || {};
      let finishOverride;
      if (gz.finish === 'frosted') {
        const eff = casementPaneFinish(u.role, gz);
        if (eff !== gz.finish) finishOverride = eff;
      }
      const row = buildGlassRow(windowSpec, u.width, u.height, u.location, u.qty || 1, finishOverride, u.role);
      // Bars belong on the ROW (Piotr 02.08, PDF audit item 5): the screen used
      // to recompute them locally while the PDF printed nothing — one engine
      // field now feeds the panel text, the PDF column AND the PDF sketch.
      if (derived.category === 'casement') {
        const { v, h } = casementBarCounts(windowSpec?.casement?.bars, u.role || 'main');
        if (v > 0 || h > 0) {
          row.barsV = v;
          row.barsH = h;
          row.bars = `${h}H × ${v}V ${barType}`;
        }
      }
      // Shaped unit (arched casement, arched-casement-v2): the row keeps the
      // bounding width × height; `shape` carries the outline + bar list for the
      // glazier exports, and the bars label comes from the engine's bar list
      // (hub patterns drop the straight verticals, PSW rule).
      if (u.shape) {
        row.shape = u.shape;
        const bc = u.shape.barCounts || { h: 0, v: 0 };
        const pat = u.shape.pattern && u.shape.pattern !== 'none' ? u.shape.pattern : null;
        row.barsV = bc.v;
        row.barsH = bc.h;
        const parts = [];
        if (bc.v > 0 || bc.h > 0) parts.push(`${bc.h}H × ${bc.v}V`);
        if (pat) parts.push(pat);
        if (parts.length) row.bars = `${parts.join(' · ')} ${barType}`;
        else delete row.bars;
      }
      return row;
    });
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
  const makeup = windowSpec?.glazing?.makeup ?? getWindowProfile()?.glassMakeup?.[glassType] ?? (GLASS_MAKEUP[glassType] ?? GLASS_MAKEUP.double);
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

export function buildHardwareList(windowSpec, derived = null) {
  const cat = windowSpec?.category || 'sash';
  if (cat === 'casement') {
    // Needs engine picks — callers without `derived` get [] exactly as before.
    const hw = derived?.casement?.hardware;
    if (!hw) return [];
    const list = [];
    const slotName = (id) => CASEMENT_HINGE_SLOTS.find((s) => s.id === id)?.name || id;
    Object.entries(hw.hingeSummary).forEach(([slotId, e]) => {
      const handed = slotId.startsWith('c_hinge_top')
        ? 'pairs'
        : `${e.LH} LH / ${e.RH} RH${e.overLimit ? ' · ! verify limits' : ''}`;
      list.push({ item: slotName(slotId), detail: handed, quantity: e.pairs });
    });
    const unrestricted = (hw.hingeSummary.c_hinge_xl?.pairs || 0)
      + (hw.hingeSummary.c_hinge_small?.pairs || 0);
    if (unrestricted > 0 && windowSpec.childRestrictor !== false) {
      list.push({ item: 'Child restrictor', detail: 'releasable · for unrestricted hinges', quantity: unrestricted });
    }
    const sidePairs = Object.entries(hw.hingeSummary)
      .filter(([id]) => !id.startsWith('c_hinge_top'))
      .reduce((a, [, e]) => a + e.pairs, 0);
    if (sidePairs > 0) {
      list.push({ item: 'Wedge packers', detail: '1 set per hinge pair (verify)', quantity: sidePairs });
    }
    Object.entries(hw.lockSummary || {}).forEach(([slotId, e]) => {
      const nm = CASEMENT_LOCK_SLOTS.find((r) => r.id === slotId)?.name || slotId;
      const parts = [];
      if (e.LH) parts.push(`${e.LH} LH`);
      if (e.RH) parts.push(`${e.RH} RH`);
      if (e.unhanded) parts.push(`${e.unhanded} top (unhanded)`);
      if (e.overLimit) parts.push('! verify size');
      list.push({ item: nm, detail: parts.join(' / '), quantity: e.count });
    });
    // Client-facing items — resolved to products via per-window ironmongery
    // slots (casementHandles / trickleVents). No stay line: friction stays
    // ARE the hinge slots above, engine-selected.
    const totalOpeners = Object.values(hw.hingeSummary).reduce((a, e) => a + e.pairs, 0);
    if (totalOpeners > 0) {
      list.push({ item: 'Casement handle', detail: 'per opener', quantity: totalOpeners });
    }
    const vents = buildVentGrilles(windowSpec);
    if (vents > 0) {
      list.push({ item: 'Trickle vents', detail: 'from Ventilation section', quantity: vents });
    }
    return list;
  }
  if (cat !== 'sash') return []; // door hardware comes later
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
  // ── Casement (Piotr 02.08.2026, PDF audit item 0 — grouping never knew C-*) ──
  'C-FRAME JAMB (L)':         { right: 'C-FRAME JAMB (R)',         symbol: 'C-J-L/R', label: 'Frame Jambs (pair)' },
  'C-STILE (L)':              { right: 'C-STILE (R)',              symbol: 'C-ST-L/R', label: 'Leaf Stiles (pair)' },
  // ── Doors (Piotr 09.08 — the D-* vocabulary never reached the grouping,
  //    exactly the casement gap repeated; parts fell into the '?' safety net) ──
  'D-FRAME JAMB (L)':         { right: 'D-FRAME JAMB (R)',         symbol: 'D-J-L/R', label: 'Door Frame Jambs (pair)' },
  'D-STILE (L)':              { right: 'D-STILE (R)',              symbol: 'D-ST-L/R', label: 'Door Leaf Stiles (pair)' },
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
  // Arched sash (arched-windows-v3 Block 1 D): curved box head, length = ring centre-line arc
  { match: 'S-ARCH HEAD',               symbol: 'S-AH',    label: 'Arched Box Head' },
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
  { match: 'S-ARCH TOP RAIL',           symbol: 'S-ATR',   label: 'Arched Top Rail' },
  { match: 'TOP MEET RAIL',             symbol: 'TMR',     label: 'Top Meet Rail' },
  { match: 'BOTTOM MEET RAIL',          symbol: 'BMR',     label: 'Bottom Meet Rail' },
  { match: 'BOTTOM RAIL',               symbol: 'BR',      label: 'Bottom Rail' },
  // ── CASEMENT (frame first, then dividers, then leaves) ──
  { match: 'C-FRAME HEAD',              symbol: 'C-FH',    label: 'Frame Head' },
  // Arched casement (arched-casement-v2): curved head / leaf top rail, length = arc length at the member centre line
  { match: 'C-ARCH HEAD',               symbol: 'C-AH',    label: 'Arched Frame Head' },
  // v3 Block 3: circle fixed window — the frame and the leaf are full rings
  { match: 'C-FRAME RING',              symbol: 'C-FRR',   label: 'Frame Ring (circle)' },
  { match: 'C-FRAME JAMB (L)',          symbol: 'C-J-L/R', label: 'Frame Jambs (pair)',          isPair: true },
  { match: 'C-FRAME CILL',              symbol: 'C-CILL',  label: 'Frame Cill' },
  { match: 'C-MULLION',                 symbol: 'C-M',     label: 'Mullion' },
  { match: 'C-TRANSOM',                 symbol: 'C-T',     label: 'Transom' },
  { match: 'C-STILE (L)',               symbol: 'C-ST-L/R', label: 'Leaf Stiles (pair)',         isPair: true },
  { match: 'C-TOP RAIL',                symbol: 'C-TR',    label: 'Leaf Top Rail' },
  { match: 'C-ARCH TOP RAIL',           symbol: 'C-ATR',   label: 'Arched Leaf Top Rail' },
  { match: 'C-LEAF RING',               symbol: 'C-LFR',   label: 'Leaf Ring (circle)' },
  { match: 'C-BOTTOM RAIL',             symbol: 'C-BR',    label: 'Leaf Bottom Rail' },
  // v3 0.4: timber tracery board over the arched unit (one board, one side; section = thickness x blank W, length = blank H)
  { match: 'C-TRACERY',                 symbol: 'C-TRY',   label: 'Tracery Board' },
  // ── DOOR (frame first, then dividers, then leaves, then side panels).
  //    French leaves share the single-leaf element names: identical lengths
  //    consolidate into one row (qty summed), pairs merge per window. ──
  { match: 'D-FRAME HEAD',              symbol: 'D-FH',    label: 'Door Frame Head' },
  { match: 'D-FRAME JAMB (L)',          symbol: 'D-J-L/R', label: 'Door Frame Jambs (pair)',    isPair: true },
  { match: 'D-FRAME CILL',              symbol: 'D-CILL',  label: 'Door Frame Cill' },
  { match: 'D-COUPLING POST',           symbol: 'D-JC',    label: 'Door Coupling Post' },
  { match: 'D-TRANSOM',                 symbol: 'D-T',     label: 'Door Transom Rail' },
  { match: 'D-STILE (L)',               symbol: 'D-ST-L/R', label: 'Door Leaf Stiles (pair)',   isPair: true },
  { match: 'D-TOP RAIL',                symbol: 'D-TR',    label: 'Door Leaf Top Rail' },
  { match: 'D-BOTTOM RAIL',             symbol: 'D-BR',    label: 'Door Leaf Bottom Rail' },
  { match: 'D-SIDE STILE',              symbol: 'D-SP-ST', label: 'Side Panel Stiles' },
  { match: 'D-SIDE TOP RAIL',           symbol: 'D-SP-TR', label: 'Side Panel Top Rail' },
  { match: 'D-SIDE BOTTOM RAIL',        symbol: 'D-SP-BR', label: 'Side Panel Bottom Rail' },
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
    byElement.delete(def.match);
    if (def.isPair) {
      const pair = MIRROR_PAIRS[def.match];
      const rightRows = [...(byElement.get(pair.right) || [])];
      byElement.delete(pair.right);
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

  // Safety net (lesson from the casement gap): any element name the order
  // table does not know still gets a group — visible with its raw name —
  // instead of silently vanishing from the cut list.
  [...byElement.keys()].sort().forEach((name) => {
    const rows = byElement.get(name).map((r) => ({
      window: win(r), projectNum: proj(r), length: r.length, qty: r.quantity || 1, section: r.section,
    }));
    const consolidated = consolidate(rows);
    consolidated.sort((a, b) => (b.length - a.length) || (a.window || '').localeCompare(b.window || ''));
    groups.push({ symbol: '?', label: name, mirror: false, section: consolidated[0].section || '', rows: consolidated });
  });

  return groups;
}
