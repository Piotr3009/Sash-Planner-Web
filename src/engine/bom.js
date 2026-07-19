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
 * mergeWindowMaterials(...) sums many windows into a flat purchase list.
 */

import { buildPrecutForWindow, buildHardwareList } from './lists.js';
import { assignmentFor, legacyToCanonical } from './partRegistry.js';

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
  'STILES TOP (L)': 'stiles_top_sash', 'STILES TOP (R)': 'stiles_top_sash',
  'STILES BOTTOM SASH (L)': 'stiles_bottom_sash', 'STILES BOTTOM SASH (R)': 'stiles_bottom_sash',
  'TOP MEET RAIL': 'top_meet_rail', 'BOTTOM MEET RAIL': 'bottom_meet_rail',
  'GLAZING BEADING': 'glazing_beading', 'TRIANGLE BEADING (EXT)': 'triangle_beading_ext',
  'GEORGIAN MIDDLE BEADING': 'georgian_middle_beading',
  'PARTING BEADING': 'parting_beading', 'STAFF BEADING': 'staff_beading',
  'MEETING BEADING A': 'meeting_beading_a', 'MEETING BEADING B': 'meeting_beading_b',
};

// Glazing clip size → assignment part id (size depends on glass/frame type)
export const CLIP_SIZE_TO_PART_ID = {
  '24mm': 'glazing_clips_24mm',
  '28mm': 'glazing_clips_28mm',
  '16mm': 'glazing_clips_14mm', // part id kept for existing assignments; label is 16mm
  '14mm': 'glazing_clips_14mm', // legacy derived snapshots
};

// Glass type → assignment part id
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
  'C-FRAME CILL': 'c_frame_cill',
  'C-FRAME JAMB (L)': 'c_frame_jamb',
  'C-FRAME JAMB (R)': 'c_frame_jamb',
  'C-STILE (L)': 'c_sash_stile',
  'C-STILE (R)': 'c_sash_stile',
  'C-TOP RAIL': 'c_sash_top_rail',
  'C-BOTTOM RAIL': 'c_sash_bottom_rail',
});

// Box head/jamb parts split per frame type (raw board width differs)
export const FRAME_BOX_PART_SUFFIX = { slim: '_slim', heritage: '_heritage', triple: '_triple' };

// Hardware line (buildHardwareList item name) → ironmongery slot category key
export const HARDWARE_TO_SLOT_KEY = {
  'Sash lock': 'locks',
  'Finger lift': 'fingerLifts',
  'Sash pull handle': 'pullHandles',
  'Pulley wheels': 'pulleys',
  'Window stopper': 'stoppers',
  'Trickle vent': 'trickleVents',
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
    setQty('silicone', c.silicone?.tubes, 'tubes');
    setQty('seal_sliding_6070', c.seal6070?.meters, 'm');
    setQty('seal_bottom_6009', c.seal6009?.meters, 'm');
  }

  // ── Glass (sqm to purchase) ──
  const g = derived.consumables?.glass;
  if (g?.sqm) {
    setQty(GLASS_TYPE_TO_PART_ID[g.type] || 'glass_double', g.sqm, 'm²');
  }

  // ── Weights (total window mass +5% = counterbalance to buy) ──
  if (derived.weights?.total) {
    const wPid = (c?.weightType === 'slim') ? 'weights_slim' : 'weights_normal';
    setQty(wPid, derived.weights.total, 'kg');
  }

  // ── Paint (litres) ──
  // Topcoat material depends on colour: 9016 (default white) → white paint;
  // any other colour → bespoke. Quantity (litres) is the same either way.
  const p = derived.paint;
  if (p) {
    setQty('paint_primer', p.primer, 'L');
    const hex = (windowSpec.color?.single || '').toUpperCase();
    const ral = String(windowSpec.color?.ral || '').replace(/[^0-9]/g, '');
    const isWhite9016 = ral === '9016' || hex === '#F6F6F6' || (!hex && !ral);
    setQty(isWhite9016 ? 'paint_white_9016' : 'paint_bespoke', p.topcoat, 'L');
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
  return { total: entry.qty, unit: entry.unit };
}

/**
 * Hardware lines for a window with the ironmongery product assigned via slots.
 * Per-window slots (windowSpec.hardware.slots) take precedence, category by
 * category, over legacy batch-level defaults. qty comes from buildHardwareList.
 */
export function buildWindowHardware(windowSpec, batch, ironmongeryItems = []) {
  if (!windowSpec) return [];
  if ((windowSpec.category || 'sash') !== 'sash') return [];
  const lines = buildHardwareList(windowSpec);
  const slots = {
    ...(batch?.defaults?.ironmongerySlots || {}),
    ...(windowSpec?.hardware?.slots || {}),
  };
  return lines.map((h) => {
    const slotKey = HARDWARE_TO_SLOT_KEY[h.item];
    const itemId = slotKey ? slots[slotKey] : null;
    const product = itemId ? ironmongeryItems.find((m) => m.id === itemId) : null;
    return { line: h, product };
  });
}

/**
 * Merge many windows into ONE flat purchase list (Project Materials).
 * Simple addition: same material → quantities sum. Mixed window types OK.
 *
 * windows: [{ derived, windowSpec, batch }]
 * Returns: [{ key, name, qty, unit, costPerUnit, source, material|product|null }]
 *   sorted with assigned materials first, then unassigned.
 */
export function mergeWindowMaterials(windows, { assignments, assignmentsData, materials, ALL_PARTS, ironmongeryItems, settings }) {
  // key → { name, qty, unit, costPerUnit, source, material/product, _assigned }
  const acc = {};

  const bump = (key, fields, addQty) => {
    if (!acc[key]) acc[key] = { qty: 0, ...fields };
    acc[key].qty += addQty;
  };

  windows.forEach(({ derived, windowSpec, batch }) => {
    if (!derived || !windowSpec) return;

    // ── materialAssignmentStore parts (timber/beading/glass/consumables/paint) ──
    const frameType = windowSpec?.frame?.type || 'standard';
    const resolveRaw = (elementName) => {
      const pid = ELEMENT_TO_PART_ID[String(elementName).replace(/ \((FIX L|FIX R|C)\)$/, '')] || ELEMENT_TO_PART_ID[elementName];
      const a = pid ? effectiveAssignment(pid, frameType, assignmentsData, assignments) : null;
      const mat = a?.material_id ? materials.find((m) => m.id === a.material_id) : null;
      return mat ? materialSizeToRaw(mat.size) : null;
    };
    const partQtys = buildWindowPartQtys(derived, windowSpec, settings, resolveRaw);

    // ── User-defined consumables: fixed quantity per window ──
    (assignmentsData?.customParts || []).forEach((cp) => {
      const assignment = effectiveAssignment(cp.id, frameType, assignmentsData, assignments);
      const yieldCoeff = assignment?.yield || 1.0;
      const total = (Number(cp.qtyPerWindow) || 0) * yieldCoeff;
      if (!total) return;
      const mat = assignment?.material_id ? materials.find((m) => m.id === assignment.material_id) : null;
      if (mat) {
        bump(`mat:${mat.id}`, {
          name: mat.name, unit: cp.unit || 'pcs',
          costPerUnit: Number(mat.cost_per_unit) || 0,
          source: 'material', material: mat, _assigned: true,
        }, total);
      } else {
        bump(`part:${cp.id}`, {
          name: cp.name, unit: cp.unit || 'pcs',
          costPerUnit: 0, source: 'part', material: null, _assigned: false,
        }, total);
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
        const mat = materials.find((m) => m.id === assignment.material_id);
        if (mat) {
          bump(`mat:${mat.id}`, {
            name: mat.name,
            unit,
            costPerUnit: Number(mat.cost_per_unit) || 0,
            source: 'material',
            material: mat,
            _assigned: true,
          }, total);
          return;
        }
      }
      // Unassigned — group by part so the user sees what needs assigning
      bump(`part:${part.id}`, {
        name: part.name,
        unit,
        costPerUnit: 0,
        source: 'material',
        material: null,
        _assigned: false,
      }, total);
    });

    // ── ironmongeryStore products (via batch slots) ──
    buildWindowHardware(windowSpec, batch, ironmongeryItems).forEach(({ line, product }) => {
      const qty = Number(line.quantity) || 0;
      if (!qty) return;
      if (product) {
        bump(`irn:${product.id}`, {
          name: product.name,
          unit: product.unit || 'pcs',
          costPerUnit: Number(product.cost_per_unit) || 0,
          source: 'ironmongery',
          product,
          _assigned: true,
        }, qty);
      } else {
        bump(`hw:${line.item}`, {
          name: line.item,
          unit: 'pcs',
          costPerUnit: 0,
          source: 'ironmongery',
          product: null,
          _assigned: false,
        }, qty);
      }
    });
  });

  const rows = Object.entries(acc).map(([key, v]) => ({ key, ...v }));
  // Assigned first, then unassigned; alphabetical within each group
  rows.sort((a, b) => {
    if (a._assigned !== b._assigned) return a._assigned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return rows;
}
