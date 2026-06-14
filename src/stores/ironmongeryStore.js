import { create } from 'zustand';
import * as cloud from '../services/cloudSync.js';

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const nextItemNumber = (items) => {
  let max = 0;
  items.forEach((m) => {
    const match = m.item_number?.match(/^IRN-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `IRN-${String(max + 1).padStart(3, '0')}`;
};

export const IRONMONGERY_CATEGORIES = [
  { key: 'pulleys', label: 'Pulleys', windowType: 'sash' },
  { key: 'fingerLifts', label: 'Finger Lifts', windowType: 'sash' },
  { key: 'locks', label: 'Sash Locks', windowType: 'sash' },
  { key: 'pullHandles', label: 'Pull Handles', windowType: 'sash' },
  { key: 'stoppers', label: 'Stoppers', windowType: 'sash' },
  { key: 'trickleVents', label: 'Trickle Vents', windowType: 'sash' },
  { key: 'other', label: 'Others', windowType: 'sash' },
];

// Ironmongery finishes — single source of truth, matching PSW exactly so
// Materials, the estimate matrix and PSW all line up. (Bespoke lives only in
// the estimate as an escape hatch; it is not a catalogue finish.)
export const IRONMONGERY_FINISHES = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'satin', label: 'Satin' },
  { value: 'brass', label: 'Brass (Gold)' },
  { value: 'antique-brass', label: 'Antique Brass' },
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'other', label: 'Others' },
];

// Swatch colour for each finish (UI dots in the matrix / pickers).
export const FINISH_SWATCH = {
  chrome: '#C0C0C8', satin: '#B8B0A0', brass: '#C8A24B',
  'antique-brass': '#8A7A55', black: '#2A2A2A', white: '#F0F0F0', other: '#9090A0',
};

export const useIronmongeryStore = create((set, get) => ({
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
        cloud.saveIron(item);
        return item;
      },

      updateItem: (id, patch) => {
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
        const it = get().items.find((x) => x.id === id);
        if (it) cloud.saveIron(it);
      },

      deleteItem: (id) => {
        set((s) => ({ items: s.items.filter((m) => m.id !== id) }));
        cloud.deleteIronCloud(id);
      },

      deleteMultiple: (ids) => {
        const idSet = new Set(ids);
        set((s) => ({ items: s.items.filter((m) => !idSet.has(m.id)) }));
        ids.forEach((id) => cloud.deleteIronCloud(id));
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
          imported.forEach((it) => cloud.saveIron(it));
        }
        return { added: imported.length, updated };
      },

      // ─── CLOUD ───
      loadFromCloud: async () => {
        const data = await cloud.loadIronmongery();
        if (data) set({ items: data, loaded: true });
        else set({ loaded: true });
      },
      clearAll: () => set({ items: [], loaded: false }),
}));