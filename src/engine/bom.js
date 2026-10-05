/**
 * bom.js — SINGLE SOURCE OF TRUTH for a window's purchasable materials.
 *
 * Built on top of deriveWindowData (the calculation engine). Both the
 * Single Window BOM tab and the Project Materials list use this so the
 * numbers are identical — project = simple sum of single-window results.
 *
 * Two layers:
 *   buildWindowPartQtys(derived, windowSpec, settings)
 *     → { [partId]: { mm?, qty?, unit } }   (materialAssignmentStore parts)
 *   buildWindowHardware(windowSpec, batch, ironmongeryItems)
 *     → [{ line, product }]                 (ironmongeryStore products via batch slots)
 *
 * One list on top of them:
 *   buildWindowMaterialLines(win, ctx)  → the material lines of ONE window
 *   windowBomCards(lines)               → that window's BOM tab (cards)
 *   mergeWindowMaterials(windows, ctx)  → the sum of every window's lines =
 *                                         the purchase list of a project / pack
 * Nothing else may count a window's materials: a second loop on a page is how
 * the single window and its purchase list drifted apart (05.10.2026).
 */

import { buildPrecutForWindow, buildHardwareList } from './lists.js';
import { assignmentFor, legacyToCanonical } from './partRegistry.js';
import { lockPartId, hingeWedgeMm, childRestrictorCounts, CHILD_RESTRICTOR_PART } from './casementHardware.js';
import { isAcousticUnit } from './specification.js';

/** Normalise a material catalog size ('150 x 38mm') to a raw-section key ('150x38'). */
export function materialSizeToRaw(size) {
  const s = String(size || '').toLowerCase().replace(/mm/g, '').replace(/\s+/g, '');
  return /^\d+x\d+$/.test(s) ? s : null;
}

/**
 * Effective assignment for a legacy/canonical part id in the context of ONE
 * window (frame variant). schema-2 aware: per-variant overrides win, base
 * inherits; falls back to the flat map when no schema-2 data is provided.
 */
export function effectiveAssignment(part_id, frameType, assignmentsData, flatAssignments) {
  if (assignmentsData) {
    const { key, variantKey } = legacyToCanonical(part_id);
    return assignmentFor(assignmentsData, key, variantKey || frameType || 'standard');
  }
  return flatAssignments?.[part_id] || null;
}

// Engine element name → materialAssignmentStore part id (timber + beading)
export const ELEMENT_TO_PART_ID = {
  'HEAD': 'head', 'CILL': 'cill', 'CILL NOSE': 'cill_nose', 'CILL EXTENSION': 'cill_extension',
  'JAMB LEFT': 'jambs', 'JAMB RIGHT': 'jambs',
  'INTERNAL HEAD LINER': 'int_head_liner', 'EXTERNAL HEAD LINER': 'ext_head_liner',
  'INTERNAL JAMB LINER (L)': 'int_jamb_liner', 'INTERNAL JAMB LINER (R)': 'int_jamb_liner',
  'EXTERNAL JAMB LINER (L)': 'ext_jamb_liner', 'EXTERNAL JAMB LINER (R)': 'ext_jamb_liner',
  'TOP RAIL': 'top_rail', 'BOTTOM RAIL': 'bottom_rail',
  'S-ARCH HEAD': 'head', 'S-ARCH TOP RAIL': 'top_rail',   // arched sash (v3 Block 1): same material slots, arc lengths
  'STILES TOP (L)': 'stiles_top_sash', 'STILES TOP (R)': 'stiles_top_sash',
  'STILES BOTTOM SASH (L)': 'stiles_bottom_sash', 'STILES BOTTOM SASH (R)': 'stiles_bottom_sash',
  'TOP MEET RAIL': 'top_meet_rail', 'BOTTOM MEET RAIL': 'bottom_meet_rail',
  'GLAZING BEADING': 'glazing_beading', 'TRIANGLE BEADING (EXT)': 'triangle_beading_ext',
  'GEORGIAN MIDDLE BEADING': 'georgian_middle_beading',
  'C-GLAZING BEADING': 'c_glazing_beading', 'C-TRIANGLE BEADING (EXT)': 'c_triangle_beading_ext',
  'C-GEORGIAN MIDDLE BEADING': 'c_georgian_middle_beading',
  'PARTING BEADING': 'parting_beading', 'STAFF BEADING': 'staff_beading',
  'MEETING BEADING A': 'meeting_beading_a', 'MEETING BEADING B': 'meeting_beading_b',
};

// Glazing clip size → assignment part id (size depends on glass/frame type)
export const CLIP_SIZE_TO_PART_ID = {
  '24mm': 'glazing_clips_24mm',
  '24.8mm': 'glazing_clips_24_8mm', // laminated / acoustic unit (4-14-6.8 = 24.8), 02.10.2026
  '28mm': 'glazing_clips_28mm',
  '16mm': 'glazing_clips_14mm', // part id kept for existing assignments; label is 16mm
  '14mm': 'glazing_clips_14mm', // legacy derived snapshots
  'heritage': 'glazing_clips_heritage',
};

// Glass type → assignment part id
// Laminate / Acoustic unit (4-14-6.8): its own row whatever the glass TYPE chip
// says — sash and casement (Piotr 05.10.2026; until then its m² landed on the
// Double row). Doors keep their own makeup, so they stay on the type row.
export const GLASS_ACOUSTIC_PART_ID = 'glass_acoustic';
// Preserver: 10% of the PRIMER litres, every window type (Piotr 05.10.2026).
export const PRESERVER_OF_PRIMER = 0.10;

export const GLASS_TYPE_TO_PART_ID = {
  double: 'glass_double',
  double_slim: 'glass_double_slim',
  triple: 'glass_triple',
  single: 'glass_single',
  passive: 'glass_passive',
};

// Triple sash + casement element → part mappings
Object.assign(ELEMENT_TO_PART_ID, {
  'MULLION (L)': 'mullion',
  'MULLION (R)': 'mullion',
  'C-FRAME HEAD': 'c_frame_head',
  'C-TRACERY': 'c_tracery',            // v3 0.4: tracery board (material line in the BOM)
  'C-FRAME CILL': 'c_frame_cill',
  'C-FRAME JAMB (L)': 'c_frame_jamb',
  'C-FRAME JAMB (R)': 'c_frame_jamb',
  'C-STILE (L)': 'c_sash_stile',
  'C-STILE (R)': 'c_sash_stile',
  'C-TOP RAIL': 'c_sash_top_rail',
  // Arched casement (arched-casement-v2): curved members buy the same part
  // slots as their straight counterparts (the blank is glued from the board
  // stock in profile.arch — see BLOCKERS §9); without these rows the BOM
  // silently dropped the arch timber.
  'C-ARCH HEAD': 'c_frame_head',
  'C-ARCH TOP RAIL': 'c_sash_top_rail',
  'C-FRAME RING': 'c_frame_head',      // v3 Block 3: circle rings take the head / top-rail stock
  'C-LEAF RING': 'c_sash_top_rail',
  'C-BOTTOM RAIL': 'c_sash_bottom_rail',
  'C-MULLION': 'c_mullion',
  'C-TRANSOM': 'c_transom',
});

// Box head/jamb parts split per frame type (raw board width differs)
/**
 * makeRawResolver — elementName → raw stock section from Material Assignments.
 * Single source for BOM merge AND pre-cut, so both always agree on the
 * purchased section for a part.
 */
export function makeRawResolver({ assignments, assignmentsData, materials, frameType = 'standard' }) {
  return (elementName, opts) => {
    // v3 Block 4: a laminated BLANK (curved member) is bought as boards of the
    // planner's stock width × the member depth, whatever timber is assigned to
    // the part — the assignment only names the species / supplier line (jc_uuid).
    if (opts?.kind === 'blank') return `${opts.stock}x${opts.depth}`;
    const pid = ELEMENT_TO_PART_ID[String(elementName).replace(/ \((FIX L|FIX R|C)\)$/, '')] || ELEMENT_TO_PART_ID[elementName];
    const a = pid ? effectiveAssignment(pid, frameType, assignmentsData, assignments) : null;
    const mat = a?.material_id ? (materials || []).find((m) => m.id === a.material_id) : null;
    return mat ? materialSizeToRaw(mat.size) : null;
  };
}

/**
 * The material assigned to a group of pre-cut items (group header on the
 * Pre-Cut tab, single window and pack alike). One material: that material;
 * several: { mixed: n }; none: null. An item of a pack carries its window's
 * frame variant as `_frameType`; a single window passes `frameType`.
 */
export function assignedMaterialForItems(items, { assignments, assignmentsData, materials, frameType = 'standard' }) {
  const ids = new Set();
  (items || []).forEach((it) => {
    const base = String(it.elementName || '').replace(/ \((FIX L|FIX R|C)\)$/, '');
    const pid = ELEMENT_TO_PART_ID[base] || ELEMENT_TO_PART_ID[it.elementName];
    const a = pid ? effectiveAssignment(pid, it._frameType || frameType, assignmentsData, assignments) : null;
    if (a?.material_id) ids.add(a.material_id);
  });
  if (ids.size === 1) return (materials || []).find((m) => m.id === [...ids][0]) || null;
  if (ids.size > 1) return { mixed: ids.size };
  return null;
}

export const FRAME_BOX_PART_SUFFIX = { slim: '_slim', heritage: '_heritage', triple: '_triple' };

// Hardware line (buildHardwareList item name) → ironmongery slot category key
export const HARDWARE_TO_SLOT_KEY = {
  'Sash lock': 'locks',
  'Finger lift': 'fingerLifts',
  'Sash pull handle': 'pullHandles',
  'Pulley wheels': 'pulleys',
  'Window stopper': 'stoppers',
  'Trickle vent': 'trickleVents',
  // Casement — vents share the sash category (one physical product, merged
  // tab); 'Casement stay' was retired: friction stays are engine-selected
  // hinge slots now, not a client product.
  'Casement handle': 'casementHandles',
  'Trickle vents': 'trickleVents',
};

// Format a quantity for display by unit (pcs are whole; tubes/m/L/etc. keep 2dp)
export function formatQty(value, unit) {
  const n = Number(value) || 0;
  const whole = unit === 'pcs';
  return `${whole ? Math.round(n) : n.toFixed(2)} ${unit}`;
}

/**
 * Per-window material quantities keyed by materialAssignmentStore part id.
 * Timber/beading carry `mm` (raw length, before yield); other parts carry
 * `qty` in their native unit. Yield is NOT applied here — apply per consumer.
 */
export function buildWindowPartQtys(derived, windowSpec, settings, resolveRaw) {
  if (!derived || !windowSpec) return {};
  const map = {}; // partId → { mm?, qty?, unit }
  const addMm = (pid, mm) => {
    if (!pid || !mm) return;
    if (!map[pid]) map[pid] = { mm: 0, unit: 'm' };
    map[pid].mm += mm;
  };
  const setQty = (pid, qty, unit) => {
    if (!pid || !qty) return;
    map[pid] = { qty: (map[pid]?.qty || 0) + qty, unit };
  };

  // ── Timber from pre-cut (has machining allowance) — totals in mm ──
  // Head/Jambs use a different board width per frame type → route to the matching part.
  const boxSuffix = FRAME_BOX_PART_SUFFIX[windowSpec?.frame?.type] || '';
  const partIdFor = (elementName) => {
    // Triple sash suffixes '(FIX L)/(C)/(FIX R)' map to the same base parts
    const baseName = String(elementName).replace(/ \((FIX L|FIX R|C)\)$/, '');
    const pid = ELEMENT_TO_PART_ID[baseName] || ELEMENT_TO_PART_ID[elementName];
    return (boxSuffix && (pid === 'head' || pid === 'jambs')) ? `${pid}${boxSuffix}` : pid;
  };
  const precut = buildPrecutForWindow(derived, windowSpec, settings, resolveRaw);
  if (precut) {
    const addItems = (items) => items.forEach((it) => {
      addMm(partIdFor(it.elementName), it.length * (it.quantity || 1));
    });
    (precut.sashEngineering || []).forEach((g) => addItems(g.items));
    (precut.boxSapele || []).forEach((g) => addItems(g.items));
  }

  // ── Beading from derived (already in mm totals) ──
  (derived.components?.beading || []).forEach((b) => {
    addMm(ELEMENT_TO_PART_ID[b.elementName], b.length * (b.quantity || 1));
  });

  // ── Consumables (native units) ──
  const c = derived.consumables;
  if (c) {
    setQty('cord', c.cord?.meters, 'm');
    setQty(CLIP_SIZE_TO_PART_ID[c.clips?.size], c.clips?.qty, 'pcs');
    setQty('spacer_1mm', c.spacer1mm?.qty, 'pcs');
    setQty('spacer_2mm', c.spacer2mm?.qty, 'pcs');
    const beadTapeM = c.beadTape?.meters || 0;
    setQty('bead_tape', beadTapeM / 2, 'm');       // 1mm (one side)
    setQty('bead_tape_2mm', beadTapeM / 2, 'm');   // 2mm (other side)
    // Casement has its own silicone row (c_silicone, below): feeding the sash
    // row too counted every casement tube twice (05.10.2026).
    if (derived.category !== 'casement') setQty('silicone', c.silicone?.tubes, 'tubes');
    setQty('seal_sliding_6070', c.seal6070?.meters, 'm');
    setQty('seal_bottom_6009', c.seal6009?.meters, 'm');
  }

  // ── Glass (sqm to purchase) ──
  const g = derived.consumables?.glass;
  if (g?.sqm) {
    const acoustic = windowSpec.category !== 'door' && isAcousticUnit(windowSpec.glazing);
    setQty(acoustic ? GLASS_ACOUSTIC_PART_ID : (GLASS_TYPE_TO_PART_ID[g.type] || 'glass_double'), g.sqm, 'm²');
  }

  // ── Weights (total window mass +5% = counterbalance to buy) ──
  // Sash only: casement now reports real weights too (hinge selection), but
  // a casement window has no counterweights to purchase.
  if (derived.weights?.total && derived.category !== 'casement') {
    const wPid = (c?.weightType === 'slim') ? 'weights_slim' : 'weights_normal';
    setQty(wPid, derived.weights.total, 'kg');
  }

  // ── Paint (litres) ──
  // Topcoat material depends on colour: 9016 (default white) → white paint;
  // any other colour → bespoke. Quantity (litres) is the same either way.
  const p = derived.paint;
  if (p) {
    const isCas = derived.category === 'casement';
    setQty(isCas ? 'c_paint_primer' : 'paint_primer', p.primer, 'L');
    setQty(isCas ? 'c_paint_preserver' : 'paint_preserver', Math.round((Number(p.primer) || 0) * PRESERVER_OF_PRIMER * 100) / 100, 'L');
    const hex = (windowSpec.color?.single || '').toUpperCase();
    const ral = String(windowSpec.color?.ral || '').replace(/[^0-9]/g, '');
    const isWhite9016 = ral === '9016' || hex === '#F6F6F6' || (!hex && !ral);
    setQty(isWhite9016
      ? (isCas ? 'c_paint_white_9016' : 'paint_white_9016')
      : (isCas ? 'c_paint_bespoke' : 'paint_bespoke'), p.topcoat, 'L');
  }

  // ── Casement ironmongery + glazing (engine hinge picks → slot quantities) ──
  // Hinges: ONE row per slot, counted in pairs — one per opener. The stays
  // are bought per pair with no LH / RH code, so side hung slots are no longer
  // split into LH / RH rows (04.10.2026); a product sold per piece takes
  // Yield 2 on its row.
  const cw = derived.casement;
  if (derived.category === 'casement' && cw?.hardware) {
    const { hingeSummary } = cw.hardware;
    let wedgeMm = 0;
    Object.entries(hingeSummary).forEach(([slotId, e]) => {
      setQty(slotId, e.pairs, 'pairs');
      wedgeMm += e.pairs * hingeWedgeMm(slotId);
    });
    // Child restrictors: one per side hung opener, split by hand, plus one
    // stud each, only when the window has the box ticked (05.10.2026). Top
    // hung openers never get one.
    const cr = childRestrictorCounts(cw.hardware.lockPicks, windowSpec.childRestrictor);
    setQty(CHILD_RESTRICTOR_PART.LH, cr.LH, 'pcs');
    setQty(CHILD_RESTRICTOR_PART.RH, cr.RH, 'pcs');
    setQty(CHILD_RESTRICTOR_PART.STUD, cr.studs, 'pcs');
    // Wedge packers in METRES (05.10.2026; was 1 pcs per hinge pair): one
    // wedge per side hung opener, under the bottom hinge, as long as the hinge.
    addMm('c_wedge_packer', wedgeMm);
    // Espag lock kits: one kit per opener from the engine lock ladder
    // (the Excalibur kit already includes the shootbolts). LH, RH and TOP are
    // three separate SKUs → three assignment rows per size band (04.10.2026);
    // the <350 slot is one row, so its three counts add up there.
    Object.entries(cw.hardware.lockSummary || {}).forEach(([slotId, e]) => {
      setQty(lockPartId(slotId, 'LH'), e.LH, 'pcs');
      setQty(lockPartId(slotId, 'RH'), e.RH, 'pcs');
      setQty(lockPartId(slotId, 'TOP'), e.unhanded, 'pcs');
    });
    const panes = Array.isArray(derived.customGlassUnits) ? derived.customGlassUnits : [];
    if (panes.length > 0) {
      setQty('c_glazing_packer', panes.length * 8, 'pcs');
      // Beading lengths now come from derived.components.beading (C- names)
      // through the shared component mapping above.
      // Glass clips (Piotr 02.08.2026): fans always 6 (never more); main panes
      // 8 when the pane is taller than 500mm, otherwise 6. Slot by glazing type.
      const clipsQty = panes.reduce((a, g) => {
        const isFan = String(g.role || '').startsWith('fan');
        return a + (isFan ? 6 : ((g.height || 0) > 500 ? 8 : 6));
      }, 0);
      // Laminate / Acoustic spec, or Laminated on a double / passive unit → the
      // 24.8mm clip (Piotr 02.10.2026); a laminated triple keeps the triple clip.
      const gType = windowSpec.glazing?.type || 'double';
      const is248 = isAcousticUnit(windowSpec.glazing);
      const clipsPid = is248 ? 'c_glass_clips_laminated'
        : (gType === 'triple') ? 'c_glass_clips_triple' : 'c_glass_clips_double';
      setQty(clipsPid, clipsQty, 'pcs');
    }
    // ── Consumables: silicone, astragal tape (1mm/2mm one side each), seals ──
    const cc = derived.consumables || {};
    setQty('c_silicone', cc.silicone?.tubes, 'tubes');
    if (cc.beadTapeSide?.meters > 0) {
      setQty('c_bead_tape_1mm', cc.beadTapeSide.meters, 'm');
      setQty('c_bead_tape_2mm', cc.beadTapeSide.meters, 'm');
    }
    const white = cc.sealColour === 'white';
    setQty(white ? 'c_seal_frame_white' : 'c_seal_frame_black', cc.sealFrame?.meters, 'm');
    setQty(white ? 'c_seal_hj_white' : 'c_seal_hj_black', cc.sealHeadJambs?.meters, 'm');
    // ── Sill extension board: metres of the cill length for the fitted size ──
    const extPid = { 35: 'c_sill_ext_35', 60: 'c_sill_ext_60', 85: 'c_sill_ext_85' }[cw.cill?.extension];
    if (extPid) addMm(extPid, cw.cill.length || 0);
  }

  return map;
}

/**
 * Resolve a part entry to a final quantity in its unit, applying yield to
 * mm-based (timber/beading) parts. Returns { total, unit }.
 */
export function resolvePartTotal(entry, yieldCoeff = 1.0) {
  if (!entry) return { total: 0, unit: 'm' };
  if (entry.mm != null) return { total: (entry.mm / 1000) * yieldCoeff, unit: entry.unit };
  // Yield applies to every unit (pcs/tubes/m/L/m²) so the row multiplier the
  // user sets actually does something on non-length parts too (Piotr 02.08.2026).
  return { total: (Number(entry.qty) || 0) * yieldCoeff, unit: entry.unit };
}

/**
 * Hardware lines for a window with the ironmongery product assigned via slots.
 * Per-window slots (windowSpec.hardware.slots) take precedence, category by
 * category, over legacy batch-level defaults. qty comes from buildHardwareList.
 */
export function buildWindowHardware(windowSpec, batch, ironmongeryItems = [], derived = null) {
  if (!windowSpec) return [];
  const cat = windowSpec.category || 'sash';
  if (cat !== 'sash' && cat !== 'casement') return []; // door hardware later
  const lines = buildHardwareList(windowSpec, derived);
  const slots = {
    ...(batch?.defaults?.ironmongerySlots || {}),
    ...(windowSpec?.hardware?.slots || {}),
  };
  // Legacy slot key: windows saved before the vent-category merge stored the
  // product under casementVents — honour it unless the new key is set.
  if (slots.casementVents && !slots.trickleVents) slots.trickleVents = slots.casementVents;
  return lines.map((h) => {
    const slotKey = HARDWARE_TO_SLOT_KEY[h.item];
    const itemId = slotKey ? slots[slotKey] : null;
    const product = itemId ? ironmongeryItems.find((m) => m.id === itemId) : null;
    return { line: h, product };
  });
}

/**
 * Material lines of ONE window — the single source of every material list.
 *
 * "Single window first; a project or a pack is the sum of single windows"
 * (Piotr 07.09.2026). The window's BOM tab draws its cards from these lines
 * (windowBomCards) and the purchase list of a project / pack is nothing but
 * their sum (mergeWindowMaterials), so a window cannot show anything its
 * purchase list does not. Until 05.10.2026 the tab built its cards with a
 * second loop of its own: it listed the engine-picked casement hardware twice
 * (a ghost "unassigned" card per hinge / lock line) and never showed the
 * custom consumables.
 *
 * win: { derived, windowSpec, batch }
 * Returns one line per counted item, in list order — custom consumables, the
 * Assign Materials rows, the client-chosen hardware:
 *   { key, name, unit, qty, costPerUnit, source, material | product, _assigned,
 *     part?       the Assign Materials row or custom consumable behind the line
 *     yieldCoeff? the row multiplier already applied to qty
 *     custom?     true for a custom consumable
 *     line?       the hardware line behind an ironmongery line }
 * The first eight fields are the purchase-list row; the rest is detail for the
 * single window.
 */
export function buildWindowMaterialLines(win, { assignments, assignmentsData, materials, ALL_PARTS, ironmongeryItems, settings }) {
  const { derived, windowSpec, batch } = win || {};
  if (!derived || !windowSpec) return [];
  const lines = [];

  // ── materialAssignmentStore parts (timber/beading/glass/consumables/paint) ──
  const frameType = windowSpec?.frame?.type || 'standard';
  const resolveRaw = makeRawResolver({ assignments, assignmentsData, materials, frameType });
  const partQtys = buildWindowPartQtys(derived, windowSpec, settings, resolveRaw);

  // ── User-defined consumables: fixed quantity per window ──
  (assignmentsData?.customParts || []).forEach((cp) => {
    const assignment = effectiveAssignment(cp.id, frameType, assignmentsData, assignments);
    const yieldCoeff = assignment?.yield || 1.0;
    const total = (Number(cp.qtyPerWindow) || 0) * yieldCoeff;
    if (!total) return;
    const mat = assignment?.material_id ? materials.find((m) => m.id === assignment.material_id) : null;
    if (mat) {
      lines.push({
        key: `mat:${mat.id}`, name: mat.name, unit: cp.unit || 'pcs',
        costPerUnit: Number(mat.cost_per_unit) || 0,
        source: 'material', material: mat, _assigned: true,
        qty: total, part: cp, yieldCoeff, custom: true,
      });
    } else {
      lines.push({
        key: `part:${cp.id}`, name: cp.name, unit: cp.unit || 'pcs',
        costPerUnit: 0, source: 'part', material: null, _assigned: false,
        qty: total, part: cp, yieldCoeff, custom: true,
      });
    }
  });

  ALL_PARTS.forEach((part) => {
    const entry = partQtys[part.id];
    if (!entry) return;
    const assignment = effectiveAssignment(part.id, frameType, assignmentsData, assignments);
    const yieldCoeff = assignment?.yield || 1.0;
    const { total, unit } = resolvePartTotal(entry, yieldCoeff);
    if (!total) return;

    if (assignment?.material_id) {
      // Hinge / lock / restrictor rows are assigned from the Ironmongery
      // catalogue (IRN-xxx) since 05.10.2026 — look the id up there too.
      const mat = materials.find((m) => m.id === assignment.material_id)
        || (ironmongeryItems || []).find((m) => m.id === assignment.material_id);
      if (mat) {
        lines.push({
          key: `mat:${mat.id}`,
          name: mat.name,
          unit,
          costPerUnit: Number(mat.cost_per_unit) || 0,
          source: 'material',
          material: mat,
          _assigned: true,
          qty: total, part, yieldCoeff,
        });
        return;
      }
    }
    // Unassigned — one line per part so the user sees what needs assigning
    lines.push({
      key: `part:${part.id}`,
      name: part.name,
      unit,
      costPerUnit: 0,
      source: 'material',
      material: null,
      _assigned: false,
      qty: total, part, yieldCoeff,
    });
  });

  // ── ironmongeryStore products (via batch slots) ──
  buildWindowHardware(windowSpec, batch, ironmongeryItems, derived).forEach(({ line, product }) => {
    // Engine-picked casement hardware is already above as an Assign Materials
    // row — a hardware line of its own doubled it as an "unassigned" item
    // (05.10.2026).
    if (line.enginePart) return;
    const qty = Number(line.quantity) || 0;
    if (!qty) return;
    if (product) {
      lines.push({
        key: `irn:${product.id}`,
        name: product.name,
        unit: product.unit || 'pcs',
        costPerUnit: Number(product.cost_per_unit) || 0,
        source: 'ironmongery',
        product,
        _assigned: true,
        qty, line,
      });
    } else {
      lines.push({
        key: `hw:${line.item}`,
        name: line.item,
        unit: 'pcs',
        costPerUnit: 0,
        source: 'ironmongery',
        product: null,
        _assigned: false,
        qty, line,
      });
    }
  });

  return lines;
}

/**
 * Sum material lines into purchase-list rows: same key → quantities add up.
 * Returns: [{ key, qty, name, unit, costPerUnit, source, material|product, _assigned }]
 *   sorted with assigned materials first, then unassigned.
 */
export function mergeMaterialLines(lines) {
  // key → { qty, name, unit, costPerUnit, source, material/product, _assigned }
  const acc = {};
  (lines || []).forEach((l) => {
    if (!acc[l.key]) {
      // The first line of a key names the row; the single-window detail
      // (part / yieldCoeff / custom / line) stays behind.
      const { key, qty, part, yieldCoeff, custom, line, ...fields } = l;
      acc[l.key] = { qty: 0, ...fields };
    }
    acc[l.key].qty += l.qty;
  });

  const rows = Object.entries(acc).map(([key, v]) => ({ key, ...v }));
  // Assigned first, then unassigned; alphabetical within each group
  rows.sort((a, b) => {
    if (a._assigned !== b._assigned) return a._assigned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

/**
 * Merge many windows into ONE flat purchase list (Project Materials, pack BOM).
 * Simple addition of every window's lines: same material → quantities sum.
 * Mixed window types OK.
 *
 * windows: [{ derived, windowSpec, batch }]
 * Returns: [{ key, name, qty, unit, costPerUnit, source, material|product|null }]
 *   sorted with assigned materials first, then unassigned.
 */
export function mergeWindowMaterials(windows, ctx) {
  const lines = [];
  (windows || []).forEach((w) => { lines.push(...buildWindowMaterialLines(w, ctx)); });
  return mergeMaterialLines(lines);
}

/**
 * The single window's BOM cards, from its material lines:
 *   rows       the window's purchase-list rows (mergeMaterialLines) — cost, PDF
 *   materials  one card per assigned material: { key, material, parts, total, unit }
 *   unassigned { parts } — rows still to assign in Assign Materials, or null.
 *              No total: its rows are metres, litres, pieces… (the card used to
 *              add them all up into one number).
 *   hardware   client-chosen products (handles, vents, sash furniture):
 *              [{ key, line, product }] — never an engine-picked line.
 * Every card total and unit IS the purchase-list row with the same key, and
 * every part row carries its own { total, unit, yieldCoeff }.
 * Cards keep the Assign Materials order; custom consumables come after it.
 */
export function windowBomCards(lines) {
  const all = lines || [];
  const rows = mergeMaterialLines(all);
  const rowByKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const partLines = all.filter((l) => l.part);
  const ordered = [...partLines.filter((l) => !l.custom), ...partLines.filter((l) => l.custom)];

  const cards = {};
  const unassignedParts = [];
  ordered.forEach((l) => {
    const partRow = { ...l.part, total: l.qty, unit: l.unit, yieldCoeff: l.yieldCoeff, custom: !!l.custom };
    if (!l._assigned) { unassignedParts.push(partRow); return; }
    if (!cards[l.key]) {
      const row = rowByKey[l.key];
      cards[l.key] = { key: l.key, material: l.material, parts: [], total: row.qty, unit: row.unit };
    }
    cards[l.key].parts.push(partRow);
  });

  return {
    rows,
    materials: Object.values(cards),
    unassigned: unassignedParts.length ? { parts: unassignedParts } : null,
    hardware: all.filter((l) => l.line).map((l) => ({ key: l.key, line: l.line, product: l.product || null })),
  };
}

/**
 * Rows of the window BOM PDF's "HARDWARE — ENGINE SELECTION" table: every
 * hardware line with its detail (hand split, size, "! verify" flags).
 * `assigned` is stated for a client-chosen product only. An engine-picked line
 * is an Assign Materials row: whether THAT row has a material is said once, in
 * the materials table above — the table used to print "— unassigned" after
 * every hinge and lock line whatever was assigned (05.10.2026).
 */
export function windowHardwareDetailRows(windowSpec, batch, ironmongeryItems = [], derived = null) {
  return buildWindowHardware(windowSpec, batch, ironmongeryItems, derived).map(({ line, product }) => ({
    item: product?.name || line.item,
    detail: line.detail || '',
    qty: line.quantity,
    ...(line.enginePart ? {} : { assigned: !!product }),
  }));
}
