import { create } from 'zustand';

const defaultSettings = {
  kerf: 3,
  endTrim: 10,
  minimumPiece: 200,
  stockLengthSash: 5900,
  stockLengthBox: 2500,
  boxWidthAllowance: 20,
  hornExtensionDefault: 75,
  glazingAllowanceWidth: 4,
  glazingAllowanceHeight: 4,
  sectionMap: {
    '57x57': '63x63',
    '57x90': '63x95',
    '57x43': '63x63'
  }
};

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useProjectStore = create((set, get) => ({
  estimates: [],
  estimatesLoading: false,
  estimatesError: null,

  currentEstimate: null,
  currentItems: [],
  currentLoading: false,
  currentError: null,

  selectedItemId: null,
  settings: { ...defaultSettings },

  setEstimates: (estimates) => set({ estimates }),
  setEstimatesLoading: (loading) => set({ estimatesLoading: loading }),
  setEstimatesError: (error) => set({ estimatesError: error }),

  setCurrentEstimate: (estimate, items) =>
    set({ currentEstimate: estimate, currentItems: items || [] }),
  setCurrentLoading: (loading) => set({ currentLoading: loading }),
  setCurrentError: (error) => set({ currentError: error }),

  selectItem: (id) => set({ selectedItemId: id }),

  updateSettings: (patch) =>
    set((s) => ({
      settings: {
        ...s.settings,
        ...patch,
        sectionMap: { ...s.settings.sectionMap, ...(patch.sectionMap || {}) }
      }
    })),

  getItemById: (id) => get().currentItems.find((i) => i.id === id) || null,

  // ─── NEW: Create estimate ───
  createEstimate: (projectName) => {
    const id = uid();
    const estimate = {
      id,
      estimate_number: `EST-${new Date().getFullYear()}-${String(get().estimates.length + 1).padStart(3, '0')}`,
      project_name: projectName || 'New Project',
      status: 'draft',
      created_at: new Date().toISOString(),
      total_price: 0,
      items: [],
      window_count: 0,
    };
    set((s) => ({ estimates: [...s.estimates, estimate] }));
    return estimate;
  },

  // ─── NEW: Delete estimate ───
  deleteEstimate: (estimateId) => {
    set((s) => ({
      estimates: s.estimates.filter((e) => e.id !== estimateId),
      currentEstimate: s.currentEstimate?.id === estimateId ? null : s.currentEstimate,
      currentItems: s.currentEstimate?.id === estimateId ? [] : s.currentItems,
    }));
  },

  // ─── NEW: Add window to estimate ───
  addWindowToEstimate: (estimateId, windowConfig) => {
    const itemId = uid();
    const item = {
      id: itemId,
      estimate_id: estimateId,
      window_number: `W${(get().currentItems.length || 0) + 1}`,
      window_type: windowConfig.windowCategory || 'sash',
      width: windowConfig.extWidth || 1000,
      height: windowConfig.extHeight || 1500,
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      upper_bars: windowConfig.upperBars || 'none',
      lower_bars: windowConfig.lowerBars || 'none',
      horns: windowConfig.showHorns ? (windowConfig.hornType || 'A') : 'none',
      glass_type: windowConfig.doubleGlazing ? 'double' : 'single',
      glass_finish: windowConfig.glassFinish || windowConfig.upperGlass || 'clear',
      spacer_color: windowConfig.spacerColor || 'silver',
      color_type: windowConfig.sameColor ? 'single' : 'dual',
      color_single: windowConfig.woodColor || '#F6F6F6',
      color_exterior: windowConfig.woodColorExt || windowConfig.woodColor || '#F6F6F6',
      color_interior: windowConfig.woodColorInt || windowConfig.woodColor || '#F6F6F6',
      ironmongery_finish: windowConfig.ironmongery || 'brass',
      specification: JSON.stringify({
        windowType: windowConfig.windowCategory || 'sash',
        width: (windowConfig.extWidth || 1000) - 104,
        height: (windowConfig.extHeight || 1500) - 87,
        upperBars: windowConfig.upperBars || 'none',
        lowerBars: windowConfig.lowerBars || 'none',
        horns: windowConfig.showHorns ? (windowConfig.hornType || 'A') : 'none',
        glassType: windowConfig.doubleGlazing ? 'double' : 'single',
        glassFinish: windowConfig.glassFinish || windowConfig.upperGlass || 'clear',
        fullConfig: {
          ...windowConfig,
          colorSingleName: windowConfig.woodColor || '#F6F6F6',
          interiorColor: windowConfig.woodColorInt || windowConfig.woodColor || '#F6F6F6',
          exteriorColor: windowConfig.woodColorExt || windowConfig.woodColor || '#F6F6F6',
          ironmongeryFinish: windowConfig.ironmongery || 'brass',
          spacerColor: windowConfig.spacerColor || 'silver',
        }
      }),
    };

    set((s) => {
      const newItems = [...s.currentItems, item];
      // Update estimate in estimates list
      const updatedEstimates = s.estimates.map((e) =>
        e.id === estimateId
          ? { ...e, items: newItems, window_count: newItems.length }
          : e
      );
      // Update currentEstimate items
      const updatedCurrent = s.currentEstimate?.id === estimateId
        ? { ...s.currentEstimate, items: newItems, window_count: newItems.length }
        : s.currentEstimate;
      return {
        estimates: updatedEstimates,
        currentEstimate: updatedCurrent,
        currentItems: newItems,
      };
    });
    return itemId;
  },

  // ─── NEW: Remove window from estimate ───
  removeWindowFromEstimate: (estimateId, itemId) => {
    set((s) => {
      const newItems = s.currentItems.filter((i) => i.id !== itemId);
      const updatedEstimates = s.estimates.map((e) =>
        e.id === estimateId
          ? { ...e, items: newItems, window_count: newItems.length }
          : e
      );
      const updatedCurrent = s.currentEstimate?.id === estimateId
        ? { ...s.currentEstimate, items: newItems, window_count: newItems.length }
        : s.currentEstimate;
      return {
        estimates: updatedEstimates,
        currentEstimate: updatedCurrent,
        currentItems: newItems,
      };
    });
  },
}));