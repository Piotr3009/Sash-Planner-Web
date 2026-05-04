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

  getItemById: (id) => get().currentItems.find((i) => i.id === id) || null
}));
