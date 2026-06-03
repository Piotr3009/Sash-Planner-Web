import { create } from 'zustand';
import * as cloud from '../services/cloudSync.js';

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// Auto-generate item_number: MAT-001, MAT-002, ...
const nextItemNumber = (materials) => {
  let max = 0;
  materials.forEach((m) => {
    const match = m.item_number?.match(/^MAT-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `MAT-${String(max + 1).padStart(3, '0')}`;
};

export const MATERIAL_CATEGORIES = [
  { id: 'timber', label: 'Timber', icon: '🪵' },
  { id: 'ironmongery', label: 'Ironmongery', icon: '🔩' },
  { id: 'glass', label: 'Glass', icon: '💎' },
  { id: 'consumables', label: 'Consumables', icon: '📦' },
];

export const MATERIAL_UNITS = ['pcs', 'm', 'kg', 'set', 'unit', 'litre', 'pair'];

export const useMaterialStore = create((set, get) => ({
  materials: [],
  materialsLoaded: false,

  setMaterials: (materials) => set({ materials, materialsLoaded: true }),

  // ─── CRUD ───
  addMaterial: (data) => {
    const materials = get().materials;
    const material = {
      id: uid(),
      item_number: nextItemNumber(materials),
      name: data.name || 'New Material',
      category: data.category || 'consumables',
      subcategory: data.subcategory || '',
      size: data.size || '',
      thickness: data.thickness || '',
      color: data.color || '',
      unit: data.unit || 'pcs',
      cost_per_unit: data.cost_per_unit || 0,
      image_url: data.image_url || '',
      jc_uuid: data.jc_uuid || '',
      notes: data.notes || '',
      created_at: new Date().toISOString(),
    };
    set({ materials: [...materials, material] });
    cloud.saveMaterial(material);
    return material;
  },

  updateMaterial: (id, patch) => {
    set((s) => ({
      materials: s.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    const m = get().materials.find((x) => x.id === id);
    if (m) cloud.saveMaterial(m);
  },

  deleteMaterial: (id) => {
    set((s) => ({
      materials: s.materials.filter((m) => m.id !== id),
    }));
    cloud.deleteMaterialCloud(id);
  },

  // ─── Queries ───
  getMaterialById: (id) => get().materials.find((m) => m.id === id) || null,

  getMaterialsByCategory: (category) =>
    category ? get().materials.filter((m) => m.category === category) : get().materials,

  searchMaterials: (query) => {
    if (!query) return get().materials;
    const q = query.toLowerCase();
    return get().materials.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.item_number.toLowerCase().includes(q) ||
        m.color?.toLowerCase().includes(q) ||
        m.size?.toLowerCase().includes(q) ||
        m.subcategory?.toLowerCase().includes(q)
    );
  },

  // ─── Import / Export ───
  importFromCSV: (csvData) => {
    // csvData = array of objects with JC fields
    const existing = get().materials;
    const imported = [];
    let updated = 0;

    // Normalize a row from CSV strings to proper types
    const normalize = (row) => ({
      name: row.name || '',
      category: row.category || 'consumables',
      subcategory: row.subcategory || '',
      size: row.size || '',
      thickness: row.thickness || '',
      color: row.color || '',
      unit: row.unit || 'pcs',
      cost_per_unit: parseFloat(row.cost_per_unit) || 0,
      image_url: row.image_url || '',
      jc_uuid: row.jc_uuid || '',
      project_types: row.project_types || '',
      notes: row.notes || '',
    });

    csvData.forEach((row) => {
      // Check if already exists by jc_uuid (upsert)
      if (row.jc_uuid && existing.some((m) => m.jc_uuid === row.jc_uuid)) {
        // Update existing — keep local id & item_number, update rest from JC
        set((s) => ({
          materials: s.materials.map((m) =>
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
      set((s) => ({ materials: [...s.materials, ...imported] }));
      imported.forEach((m) => cloud.saveMaterial(m));
    }
    return { added: imported.length, updated };
  },

  // ─── Category management ───
  renameCategory: (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    set((s) => ({
      materials: s.materials.map((m) =>
        m.category === oldName ? { ...m, category: newName } : m
      ),
    }));
  },

  canDeleteCategory: (categoryName) => {
    return !get().materials.some((m) => m.category === categoryName);
  },

  renameSubcategory: (category, oldSub, newSub) => {
    if (!oldSub || !newSub || oldSub === newSub) return;
    set((s) => ({
      materials: s.materials.map((m) =>
        m.category === category && m.subcategory === oldSub
          ? { ...m, subcategory: newSub }
          : m
      ),
    }));
  },

  canDeleteSubcategory: (category, subcategory) => {
    return !get().materials.some((m) => m.category === category && m.subcategory === subcategory);
  },

  // ─── CLOUD ───
  loadFromCloud: async () => {
    const data = await cloud.loadMaterials();
    if (data) set({ materials: data, materialsLoaded: true });
    else set({ materialsLoaded: true });
  },
  clearAll: () => set({ materials: [], materialsLoaded: false }),
}));