import { create } from 'zustand';
import * as cloud from '../services/cloudSync.js';

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// Next sequential estimate number for the current year, e.g. EST-2026-001.
function nextEstimateNumber(existing) {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  let max = 0;
  existing.forEach((e) => {
    if (e.estimate_number && e.estimate_number.startsWith(prefix)) {
      const n = parseInt(e.estimate_number.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

const EMPTY_TOTALS = { ex_vat: 0, vat: 0, inc_vat: 0 };

export const useEstimateStore = create((set, get) => ({
  estimates: [],
  estimatesLoaded: false,

  // Tenant pricing rates (jsonb config). null = not loaded yet → engine uses
  // DEFAULT_PRICING. An object = the tenant's saved overrides.
  pricingSettings: null,
  pricingLoaded: false,

  setEstimates: (estimates) => set({ estimates, estimatesLoaded: true }),

  // Resolve an estimate by id (helper for detail page). Not a getter.
  getEstimate: (id) => get().estimates.find((e) => e.id === id) || null,

  // ─── CRUD ───
  addEstimate: (data = {}) => {
    const estimate = {
      id: uid(),
      client_id: data.client_id || null, // null = "no client estimate"
      estimate_number: nextEstimateNumber(get().estimates),
      title: (data.title || '').trim() || 'Untitled estimate',
      status: 'draft', // draft | sent | won | lost
      items: Array.isArray(data.items) ? data.items : [],
      extras: Array.isArray(data.extras) ? data.extras : [],
      totals: data.totals || { ...EMPTY_TOTALS },
      notes: (data.notes || '').trim(),
      archived: false,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ estimates: [...s.estimates, estimate] }));
    cloud.saveEstimate(estimate);
    return estimate;
  },

  updateEstimate: (id, patch) => {
    set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
    const e = get().estimates.find((x) => x.id === id);
    if (e) cloud.saveEstimate(e);
  },

  setStatus: (id, status) => {
    get().updateEstimate(id, { status });
  },

  // Soft-delete: flag archived in the cloud, drop from the in-memory list.
  archiveEstimate: (id) => {
    const e = get().estimates.find((x) => x.id === id);
    if (e) cloud.saveEstimate({ ...e, archived: true });
    set((s) => ({ estimates: s.estimates.filter((x) => x.id !== id) }));
  },

  // ─── PRICING SETTINGS ───
  setPricingSettings: (config) => set({ pricingSettings: config, pricingLoaded: true }),

  savePricingSettings: (config) => {
    set({ pricingSettings: config });
    cloud.savePricingSettings(config);
  },

  loadPricingFromCloud: async () => {
    const config = await cloud.loadPricingSettings();
    set({ pricingSettings: config || null, pricingLoaded: true });
  },

  // ─── CLOUD ───
  loadFromCloud: async () => {
    const data = await cloud.loadEstimates();
    if (data) set({ estimates: data, estimatesLoaded: true });
    else set({ estimatesLoaded: true });
    // Pricing rates are part of the estimates module — load them together.
    get().loadPricingFromCloud();
  },

  clearAll: () => set({ estimates: [], estimatesLoaded: false, pricingSettings: null, pricingLoaded: false }),
}));
