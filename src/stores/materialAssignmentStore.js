import { create } from 'zustand';
import * as cloud from '../services/cloudSync.js';
import { normalizeAssignments, expandAssignments, legacyToCanonical } from '../engine/partRegistry.js';

// ─── Sash Window Parts (hardcoded — structural, used by calculations engine) ───
// section = pre-cut (raw) section that needs to be matched to a stock material
export const SASH_WINDOW_PARTS = {
  box: [
    { id: 'head',            name: 'Head',                  section: '28×141',  pcs: 1, materialType: 'hardwood' },
    { id: 'jambs',           name: 'Jambs',                 section: '28×141',  pcs: 2, materialType: 'hardwood' },
    { id: 'head_slim',       name: 'Head (Slim)',           section: '28×121',  pcs: 1, materialType: 'hardwood', note: 'slim frame' },
    { id: 'jambs_slim',      name: 'Jambs (Slim)',          section: '28×121',  pcs: 2, materialType: 'hardwood', note: 'slim frame' },
    { id: 'head_heritage',   name: 'Head (Heritage)',       section: '28×111',  pcs: 1, materialType: 'hardwood', note: 'heritage frame' },
    { id: 'jambs_heritage',  name: 'Jambs (Heritage)',      section: '28×111',  pcs: 2, materialType: 'hardwood', note: 'heritage frame' },
    { id: 'head_triple',     name: 'Head (Triple)',         section: '28×149',  pcs: 1, materialType: 'hardwood', note: 'triple glazing frame' },
    { id: 'jambs_triple',    name: 'Jambs (Triple)',        section: '28×149',  pcs: 2, materialType: 'hardwood', note: 'triple glazing frame' },
    { id: 'mullion',         name: 'Mullion Post',          section: '50×141',  pcs: 2, materialType: 'hardwood', note: 'triple sash' },
    { id: 'cill',            name: 'Cill',                  section: '69×46',   pcs: 1, materialType: 'hardwood' },
    { id: 'cill_nose',       name: 'Cill Nose',             section: '64×128',  pcs: 1, materialType: 'hardwood' },
    { id: 'cill_extension',  name: 'Cill Extension',        section: '—',       pcs: 1, materialType: 'hardwood', optional: true },
    { id: 'ext_head_liner',  name: 'External Head Liner',   section: '17×102',  pcs: 1, materialType: 'softwood' },
    { id: 'int_head_liner',  name: 'Internal Head Liner',   section: '17×86',   pcs: 1, materialType: 'softwood' },
    { id: 'ext_jamb_liner',  name: 'External Jamb Liner',   section: '17×102',  pcs: 2, materialType: 'softwood' },
    { id: 'int_jamb_liner',  name: 'Internal Jamb Liner',   section: '17×86',   pcs: 2, materialType: 'softwood' },
  ],
  sash: [
    { id: 'top_rail',             name: 'Top Rail',              section: '—',  finishedSection: '57×57',  pcs: 1, materialType: 'hardwood' },
    { id: 'stiles_top_sash',      name: 'Stiles Top',            section: '—',  finishedSection: '57×57',  pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'stiles_bottom_sash',   name: 'Stiles Bottom Sash',    section: '—',  finishedSection: '57×57',  pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'bottom_rail',          name: 'Bottom Rail',            section: '—',  finishedSection: '57×90',  pcs: 1, materialType: 'hardwood' },
    { id: 'top_meet_rail',        name: 'Top Meeting Rail',       section: '—',  finishedSection: '57×43',  pcs: 1, materialType: 'hardwood' },
    { id: 'bottom_meet_rail',     name: 'Bottom Meeting Rail',    section: '—',  finishedSection: '57×43',  pcs: 1, materialType: 'hardwood' },
  ],
  beading: [
    { id: 'glazing_beading',           name: 'Glazing Beading',            section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'triangle_beading_ext',      name: 'Triangle Beading (Ext)',     section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'georgian_middle_beading',   name: 'Georgian Middle Beading',    section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'parting_beading',           name: 'Parting Beading',            section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'staff_beading',            name: 'Staff Beading',              section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'meeting_beading_a',         name: 'Meeting Beading A',          section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'meeting_beading_b',         name: 'Meeting Beading B',          section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
  ],
  glass: [
    { id: 'glass_double',     name: 'Double Glazing',       section: '4-16-4',   pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_double_slim', name: 'Double Slim Glazing',  section: '4-8-4',    pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_triple',     name: 'Triple Glazing',       section: '4-8-4-8-4', pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_single',     name: 'Single Heritage',      section: '6.8mm lam',      pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_passive',    name: 'Passive (Vacuum)',     section: 'vacuum',   pcs: 2, materialType: 'glass', unit: 'm²' },
  ],
  paint: [
    { id: 'paint_primer',     name: 'Primer',               section: '—',  pcs: 1, materialType: 'paint', unit: 'L' },
    { id: 'paint_white_9016', name: 'White Standard 9016',  section: '—',  pcs: 1, materialType: 'paint', unit: 'L' },
    { id: 'paint_bespoke',    name: 'Bespoke Colour',       section: '—',  pcs: 1, materialType: 'paint', unit: 'L', optional: true },
  ],
  consumables: [
    { id: 'cord',               name: 'Cord / Rope',              section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'glazing_clips_24mm', name: 'Glazing Clips — standard frame', section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'glazing_clips_28mm', name: 'Glazing Clips — triple frame',   section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'glazing_clips_14mm', name: 'Glazing Clips — slim frame',     section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'glazing_clips_heritage', name: 'Glazing Clips — heritage frame', section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'spacer_1mm',         name: 'Glazing Packer 1mm',       section: '—',  pcs: 20, materialType: 'consumable', unit: 'pcs' },
    { id: 'spacer_2mm',         name: 'Glazing Packer 2mm',       section: '—',  pcs: 4, materialType: 'consumable', unit: 'pcs' },
    { id: 'bead_tape',          name: 'Georgian Bar/Bead Tape 1mm', section: '1mm', pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'bead_tape_2mm',      name: 'Georgian Bar/Bead Tape 2mm', section: '2mm', pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'silicone',           name: 'Silicone',                 section: '—',  pcs: 1, materialType: 'consumable', unit: 'tubes' },
    { id: 'weights_normal',     name: 'Weights Normal',           section: '—',  pcs: 1, materialType: 'consumable', unit: 'kg', note: 'standard frame' },
    { id: 'weights_slim',       name: 'Weights Slim',             section: '—',  pcs: 1, materialType: 'consumable', unit: 'kg', note: 'slim frame' },
    { id: 'seal_sliding_6070',  name: 'Sliding Sash Seal 6070',   section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'seal_bottom_6009',   name: 'Bottom Seal 6009',         section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
  ],
};

// ─── Casement (simple: outer frame + sash all round; mullions/transoms later) ───
export const CASEMENT_PARTS = {
  frame: [
    { id: 'c_frame_head', name: 'Frame Head',   section: '57×57', pcs: 1, materialType: 'hardwood' },
    { id: 'c_frame_jamb', name: 'Frame Jambs',  section: '57×57', pcs: 2, materialType: 'hardwood' },
    { id: 'c_frame_cill', name: 'Frame Cill',   section: '57×70', pcs: 1, materialType: 'hardwood' },
  ],
  sash: [
    { id: 'c_sash_stile',       name: 'Sash Stiles',      section: '57×47', pcs: 2, materialType: 'hardwood' },
    { id: 'c_sash_top_rail',    name: 'Sash Top Rail',    section: '57×47', pcs: 1, materialType: 'hardwood' },
    { id: 'c_sash_bottom_rail', name: 'Sash Bottom Rail', section: '57×70', pcs: 1, materialType: 'hardwood' },
  ],
};
export const CASEMENT_ALL_PARTS = [...CASEMENT_PARTS.frame, ...CASEMENT_PARTS.sash];

// Flat list for lookups
export const ALL_PARTS = [
  ...SASH_WINDOW_PARTS.box,
  ...SASH_WINDOW_PARTS.sash,
  ...SASH_WINDOW_PARTS.beading,
  ...SASH_WINDOW_PARTS.glass,
  ...SASH_WINDOW_PARTS.paint,
  ...SASH_WINDOW_PARTS.consumables,
];

// ─── Store ───
// Canonical shape (schema 2): base assignment per part + per-variant overrides.
// `assignments` stays as a FLAT legacy view (expanded, inheritance applied) so
// the current page, counter and any flat consumers keep working unchanged.
function project(data) {
  const d = normalizeAssignments(data);
  return { data: d, assignments: expandAssignments(d) };
}

export const useMaterialAssignmentStore = create((set, get) => ({
      // data: { schema: 2, base: {...}, overrides: {...} } — source of truth
      data: { schema: 2, base: {}, overrides: {} },
      // assignments: flat legacy view derived from `data` (read-only)
      assignments: {},

      // Set assignment for a part (includes category/subcategory filter)
      setAssignment: (partId, materialId, yieldCoeff = 1.0, category = '', subcategory = '', explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          const prev = (variantKey ? d.overrides?.[key]?.[variantKey] : d.base?.[key]) || s.assignments[partId] || {};
          const next = {
            material_id: materialId,
            yield: yieldCoeff,
            category: category || prev.category || '',
            subcategory: subcategory || prev.subcategory || '',
          };
          if (variantKey) {
            d.overrides[key] = { ...(d.overrides[key] || {}), [variantKey]: next };
          } else {
            d.base[key] = next;
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Update filter (category/subcategory) for a part
      setFilter: (partId, category, subcategory = '', explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          const prev = (variantKey ? d.overrides?.[key]?.[variantKey] : d.base?.[key]) || s.assignments[partId] || {};
          const next = {
            material_id: prev.material_id || '',
            yield: prev.yield ?? 1.0,
            category,
            subcategory,
          };
          if (variantKey) {
            d.overrides[key] = { ...(d.overrides[key] || {}), [variantKey]: next };
          } else {
            d.base[key] = next;
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Update yield only
      setYield: (partId, yieldCoeff, explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          const prev = (variantKey ? d.overrides?.[key]?.[variantKey] : d.base?.[key]) || s.assignments[partId] || {};
          const next = { ...prev, yield: yieldCoeff };
          if (variantKey) {
            d.overrides[key] = { ...(d.overrides[key] || {}), [variantKey]: next };
          } else {
            d.base[key] = next;
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Remove assignment
      // Base part → removes base (and its overrides). Variant row → removes
      // just the override; the row falls back to the inherited base value.
      removeAssignment: (partId, explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          if (variantKey) {
            if (d.overrides[key]) {
              const o = { ...d.overrides[key] };
              delete o[variantKey];
              if (Object.keys(o).length) d.overrides[key] = o; else delete d.overrides[key];
            }
          } else {
            delete d.base[key];
            delete d.overrides[key];
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Get assignment for a part
      getAssignment: (partId) => get().assignments[partId] || null,

      // ── Custom consumables (user-defined, counted as qtyPerWindow × windows) ──
      addCustomPart: ({ name, unit, qtyPerWindow }) => {
        set((s) => {
          const d = normalizeAssignments(s.data);
          d.customParts = [...(d.customParts || []), {
            id: `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
            name: String(name || '').trim() || 'Custom consumable',
            unit: unit || 'pcs',
            qtyPerWindow: Number(qtyPerWindow) || 1,
          }];
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },
      updateCustomPart: (id, patch) => {
        set((s) => {
          const d = normalizeAssignments(s.data);
          d.customParts = (d.customParts || []).map((cp) => (cp.id === id ? { ...cp, ...patch, qtyPerWindow: Number(patch.qtyPerWindow ?? cp.qtyPerWindow) || 1 } : cp));
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },
      removeCustomPart: (id) => {
        set((s) => {
          const d = normalizeAssignments(s.data);
          d.customParts = (d.customParts || []).filter((cp) => cp.id !== id);
          delete d.base[id];
          delete d.overrides[id];
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Clear all assignments (local only — used on sign-out)
      clearAll: () => set({ data: { schema: 2, base: {}, overrides: {} }, assignments: {} }),

      // Load assignments for the logged-in user from the cloud.
      // Legacy flat blobs are migrated to schema 2 on the fly (idempotent).
      loadFromCloud: async () => {
        const raw = await cloud.loadAssignments();
        if (raw) set(project(raw));
      },
}));
