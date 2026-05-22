import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Sash Window Parts (hardcoded — structural, used by calculations engine) ───
// section = pre-cut (raw) section that needs to be matched to a stock material
export const SASH_WINDOW_PARTS = {
  box: [
    { id: 'head',            name: 'Head',                  section: '28×141',  pcs: 1, materialType: 'hardwood' },
    { id: 'jambs',           name: 'Jambs',                 section: '28×141',  pcs: 2, materialType: 'hardwood' },
    { id: 'cill',            name: 'Cill',                  section: '69×46',   pcs: 1, materialType: 'hardwood' },
    { id: 'cill_nose',       name: 'Cill Nose',             section: '28×141',  pcs: 1, materialType: 'hardwood' },
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
};

// Flat list for lookups
export const ALL_PARTS = [...SASH_WINDOW_PARTS.box, ...SASH_WINDOW_PARTS.sash];

// ─── Store ───
export const useMaterialAssignmentStore = create(
  persist(
    (set, get) => ({
      // assignments: { [part_id]: { material_id, yield } }
      assignments: {},

      // Set assignment for a part
      setAssignment: (partId, materialId, yieldCoeff = 1.0) => {
        set((s) => ({
          assignments: {
            ...s.assignments,
            [partId]: { material_id: materialId, yield: yieldCoeff },
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
