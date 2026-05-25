import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Sash Window Parts (hardcoded — structural, used by calculations engine) ───
// section = pre-cut (raw) section that needs to be matched to a stock material
export const SASH_WINDOW_PARTS = {
  box: [
    { id: 'head',            name: 'Head',                  section: '28×141',  pcs: 1, materialType: 'hardwood' },
    { id: 'jambs',           name: 'Jambs',                 section: '28×141',  pcs: 2, materialType: 'hardwood' },
    { id: 'cill',            name: 'Cill',                  section: '69×46',   pcs: 1, materialType: 'hardwood' },
    { id: 'cill_nose',       name: 'Cill Nose',             section: '64×128',  pcs: 1, materialType: 'hardwood' },
    { id: 'cill_extension',  name: 'Cill Extension',        section: '—',       pcs: 1, materialType: 'hardwood', optional: true },
    { id: 'ext_head_liner',  name: 'External Head Liner',   section: '17×102',  pcs: 1, materialType: 'softwood' },
    { id: 'int_head_liner',  name: 'Internal Head Liner',   section: '17×86',   pcs: 1, materialType: 'softwood' },
    { id: 'ext_jamb_liner',  name: 'External Jamb Liner',   section: '17×102',  pcs: 2, materialType: 'softwood' },
    { id: 'int_jamb_liner',  name: 'Internal Jamb Liner',   section: '17×86',   pcs: 2, materialType: 'softwood' },
  ],
  sash: [
    { id: 'top_rail',             name: 'Top Rail',              section: '63×63',  finishedSection: '57×57',  pcs: 1, materialType: 'hardwood' },
    { id: 'stiles_top_sash',      name: 'Stiles Top Sash',       section: '63×63',  finishedSection: '57×57',  pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'stiles_bottom_sash',   name: 'Stiles Bottom Sash',    section: '63×63',  finishedSection: '57×57',  pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'bottom_rail',          name: 'Bottom Rail',            section: '63×95',  finishedSection: '57×90',  pcs: 1, materialType: 'hardwood' },
    { id: 'top_meet_rail',        name: 'Top Meeting Rail',       section: '63×63',  finishedSection: '57×43',  pcs: 1, materialType: 'hardwood' },
    { id: 'bottom_meet_rail',     name: 'Bottom Meeting Rail',    section: '63×63',  finishedSection: '57×43',  pcs: 1, materialType: 'hardwood' },
  ],
  beading: [
    { id: 'glazing_bar_beading',      name: 'Glazing Bar Beading',        section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'internal_georgian_beading', name: 'Internal Georgian Beading',  section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'triangle_beading_ext',      name: 'Triangle Beading (Ext)',     section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'parting_beading',           name: 'Parting Beading',            section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'staff_beading',            name: 'Staff Beading',              section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'meeting_beading_a',         name: 'Meeting Beading A',          section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'meeting_beading_b',         name: 'Meeting Beading B',          section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
  ],
  glass: [
    { id: 'glass_double',     name: 'Double Glazing',       section: '4-16-4',   pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_triple',     name: 'Triple Glazing',       section: '4-12-4-12-4', pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_single',     name: 'Single Heritage',      section: '6mm',      pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_passive',    name: 'Passive (Vacuum)',     section: 'vacuum',   pcs: 2, materialType: 'glass', unit: 'm²' },
  ],
  paint: [
    { id: 'paint_primer',     name: 'Primer',               section: '—',  pcs: 1, materialType: 'paint', unit: 'L' },
    { id: 'paint_white_9016', name: 'White Standard 9016',  section: '—',  pcs: 1, materialType: 'paint', unit: 'L' },
    { id: 'paint_bespoke',    name: 'Bespoke Colour',       section: '—',  pcs: 1, materialType: 'paint', unit: 'L', optional: true },
  ],
  consumables: [
    { id: 'cord',               name: 'Cord / Rope',              section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'glazing_clips_24mm', name: 'Glazing Clips 24mm',       section: '24mm', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'double glazing' },
    { id: 'glazing_clips_28mm', name: 'Glazing Clips 28mm',       section: '28mm', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'triple glazing' },
    { id: 'glazing_clips_14mm', name: 'Glazing Clips 14mm',       section: '14mm', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'slim frame' },
    { id: 'spacer_1mm',         name: 'Glazing Packer 1mm',       section: '—',  pcs: 20, materialType: 'consumable', unit: 'pcs' },
    { id: 'spacer_2mm',         name: 'Glazing Packer 2mm',       section: '—',  pcs: 4, materialType: 'consumable', unit: 'pcs' },
    { id: 'bead_tape',          name: 'Georgian Bar/Bead Tape',   section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'silicone',           name: 'Silicone',                 section: '—',  pcs: 1, materialType: 'consumable', unit: 'tubes' },
    { id: 'weights_normal',     name: 'Weights Normal',           section: '—',  pcs: 1, materialType: 'consumable', unit: 'kg', note: 'standard frame' },
    { id: 'weights_slim',       name: 'Weights Slim',             section: '—',  pcs: 1, materialType: 'consumable', unit: 'kg', note: 'slim frame' },
    { id: 'seal_sliding_6070',  name: 'Sliding Sash Seal 6070',   section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'seal_bottom_6009',   name: 'Bottom Seal 6009',         section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
  ],
};

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
export const useMaterialAssignmentStore = create(
  persist(
    (set, get) => ({
      // assignments: { [part_id]: { material_id, yield } }
      assignments: {},

      // Set assignment for a part (includes category/subcategory filter)
      setAssignment: (partId, materialId, yieldCoeff = 1.0, category = '', subcategory = '') => {
        set((s) => ({
          assignments: {
            ...s.assignments,
            [partId]: {
              material_id: materialId,
              yield: yieldCoeff,
              category: category || s.assignments[partId]?.category || '',
              subcategory: subcategory || s.assignments[partId]?.subcategory || '',
            },
          },
        }));
      },

      // Update filter (category/subcategory) for a part
      setFilter: (partId, category, subcategory = '') => {
        set((s) => ({
          assignments: {
            ...s.assignments,
            [partId]: {
              ...s.assignments[partId],
              material_id: s.assignments[partId]?.material_id || '',
              yield: s.assignments[partId]?.yield ?? 1.0,
              category,
              subcategory,
            },
          },
        }));
      },

      // Update yield only
      setYield: (partId, yieldCoeff) => {
        set((s) => ({
          assignments: {
            ...s.assignments,
            [partId]: { ...s.assignments[partId], yield: yieldCoeff },
          },
        }));
      },

      // Remove assignment
      removeAssignment: (partId) => {
        set((s) => {
          const next = { ...s.assignments };
          delete next[partId];
          return { assignments: next };
        });
      },

      // Get assignment for a part
      getAssignment: (partId) => get().assignments[partId] || null,

      // Clear all assignments
      clearAll: () => set({ assignments: {} }),
    }),
    {
      name: 'sp-material-assignments',
    }
  )
);
