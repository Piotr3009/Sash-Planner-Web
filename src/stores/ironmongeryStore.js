import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const uid = () => `irn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const nextItemNumber = (items) => {
  let max = 0;
  items.forEach((m) => {
    const match = m.item_number?.match(/^IRN-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `IRN-${String(max + 1).padStart(3, '0')}`;
};

export const IRONMONGERY_CATEGORIES = [
  'locks', 'handles', 'pulleys', 'hinges', 'fasteners', 'vents', 'restrictors', 'other',
];

export const IRONMONGERY_FINISHES = [
  'brass', 'chrome', 'stainless', 'antique brass', 'black', 'white', 'satin', 'other',
];

export const useIronmongeryStore = create(
  persist(
    (set, get) => ({
      items: [],
      loaded: false,

      setItems: (items) => set({ items, loaded: true }),

      // ─── CRUD ───
      addItem: (data) => {
        const items = get().items;
        const item = {
          id: uid(),
          item_number: nextItemNumber(items),
          name: data.name || 'New Item',
          category: data.category || 'other',
          subcategory: data.subcategory || '',
          finish: data.finish || '',
          size: data.size || '',
          unit: data.unit || 'pcs',
          cost_per_unit: data.cost_per_unit || 0,
          image_url: data.image_url || '',
          jc_uuid: data.jc_uuid || '',
          notes: data.notes || '',
          created_at: new Date().toISOString(),
        };
        set({ items: [...items, item] });
        return item;
      },

      updateItem: (id, patch) => {
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
      },

      deleteItem: (id) => {
        set((s) => ({ items: s.items.filter((m) => m.id !== id) }));
      },

      deleteMultiple: (ids) => {
        const idSet = new Set(ids);
        set((s) => ({ items: s.items.filter((m) => !idSet.has(m.id)) }));
      },

      // ─── Queries ───
      getById: (id) => get().items.find((m) => m.id === id) || null,

      getByCategory: (category) =>
        category ? get().items.filter((m) => m.category === category) : get().items,

      getByFinish: (finish) =>
        finish ? get().items.filter((m) => m.finish === finish) : get().items,

      search: (query) => {
        if (!query) return get().items;
        const q = query.toLowerCase();
        return get().items.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.item_number?.toLowerCase().includes(q) ||
            m.finish?.toLowerCase().includes(q) ||
            m.size?.toLowerCase().includes(q) ||
            m.subcategory?.toLowerCase().includes(q)
        );
      },

      // ─── Import CSV (same format as JC export) ───
      importFromCSV: (csvData) => {
        const existing = get().items;
        const imported = [];
        let updated = 0;

        const normalize = (row) => ({
          name: row.name || '',
          category: row.category || 'other',
          subcategory: row.subcategory || '',
          finish: row.finish || row.color || '',
          size: row.size || '',
          unit: row.unit || 'pcs',
          cost_per_unit: parseFloat(row.cost_per_unit) || 0,
          image_url: row.image_url || '',
          jc_uuid: row.jc_uuid || '',
          notes: row.notes || '',
        });

        csvData.forEach((row) => {
          if (row.jc_uuid && existing.some((m) => m.jc_uuid === row.jc_uuid)) {
            set((s) => ({
              items: s.items.map((m) =>
                m.jc_uuid === row.jc_uuid ? { ...m, ...normalize(row) } : m
              ),
            }));
            updated++;
          } else {
            imported.push({
              id: uid(),
              item_number: row.item_number || nextItemNumber([...existing, ...imported]),
              ...normalize(row),
              created_at: new Date().toISOString(),
            });
          }
        });
        if (imported.length > 0) {
          set((s) => ({ items: [...s.items, ...imported] }));
        }
        return { added: imported.length, updated };
      },
    }),
    {
      name: 'sp-ironmongery',
      merge: (persisted, current) => {
        if (!persisted || !persisted.items) {
          return { ...current, items: [], loaded: true };
        }
        return { ...current, ...persisted, loaded: true };
      },
    }
  )
);
