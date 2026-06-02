import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockProjects, mockProductionPacks } from '../mocks/mockProjects.js';

// ─── Production settings (preserved from original — used by calculations engine) ───
const defaultSettings = {
  kerf: 3,
  endTrim: 10,
  minimumPiece: 200,
  stockLengthSash: 5900,
  stockLengthBox: 3700,
  boxWidthAllowance: 20,
  hornExtensionDefault: 75,
  glazingAllowanceWidth: 4,
  glazingAllowanceHeight: 4,
  sectionMap: {
    '57x57': '63x63',
    '57x90': '63x95',
    '57x43': '63x63'
  },
  company: {
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    logo: '',   // base64 data URL — auto-inserted into PDF headers when set
  }
};

// ─── Default batch settings per window type ───
const BATCH_DEFAULTS = {
  sash: {
    ironmongery: 'brass',
    ironmongerySlots: {},
    colourMode: 'single',
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    glassType: 'double',
    glassSpec: 'toughened',
    spacerColor: 'white',
    spacerType: 'warm',
    pas24: false,
    frameType: 'standard',
    hornType: 'A',
  },
  casement: {
    ironmongery: 'chrome',
    colourMode: 'single',
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    glassType: 'double',
    glassSpec: 'toughened',
    spacerColor: 'white',
    spacerType: 'warm',
    pas24: false,
    frameType: 'standard',
    hornType: 'none',
  },
  'fix-frame': {
    ironmongery: 'none',
    colourMode: 'single',
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    glassType: 'double',
    glassSpec: 'toughened',
    spacerColor: 'white',
    spacerType: 'warm',
    pas24: false,
    frameType: 'standard',
    hornType: 'none',
  },
  doors: {
    ironmongery: 'chrome',
    colourMode: 'single',
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    glassType: 'double',
    glassSpec: 'toughened',
    spacerColor: 'white',
    spacerType: 'warm',
    pas24: true,
    frameType: 'standard',
    hornType: 'none',
  },
  special: {
    ironmongery: 'chrome',
    colourMode: 'single',
    woodColor: '#F6F6F6',
    woodColorExt: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    glassType: 'double',
    glassSpec: 'toughened',
    spacerColor: 'white',
    spacerType: 'warm',
    pas24: false,
    frameType: 'standard',
    hornType: 'none',
  },
};

const BATCH_STATUSES = ['preparation', 'in-production', 'complete'];

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export { BATCH_DEFAULTS, BATCH_STATUSES };

export const useProjectStore = create(
  persist(
    (set, get) => ({

  // ─── State ───
  projects: [],
  projectsLoaded: false,
  projectsLoading: false,
  projectsError: null,

  productionPacks: [],

  sprayNotes: {},   // key: `${windowId}_${element}_${face}` → text (spraying additional info)

  currentProject: null,
  currentBatch: null,
  currentWindows: [],    // windows in current batch
  currentLoading: false,
  currentError: null,

  selectedWindowId: null,
  settings: { ...defaultSettings },

  // ─── Setters ───
  setProjects: (projects) => set({ projects }),
  setProductionPacks: (packs) => set({ productionPacks: packs }),
  setProjectsLoading: (loading) => set({ projectsLoading: loading }),
  setProjectsError: (error) => set({ projectsError: error }),

  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentBatch: (batch) => {
    set({ currentBatch: batch, currentWindows: batch?.windows || [] });
  },
  setCurrentLoading: (loading) => set({ currentLoading: loading }),
  setCurrentError: (error) => set({ currentError: error }),

  selectWindow: (id) => set({ selectedWindowId: id }),

  // ─── Settings (preserved — used by calculations engine) ───
  updateSettings: (patch) =>
    set((s) => ({
      settings: {
        ...s.settings,
        ...patch,
        sectionMap: { ...s.settings.sectionMap, ...(patch.sectionMap || {}) }
      }
    })),

  setSprayNote: (key, value) =>
    set((s) => {
      const next = { ...s.sprayNotes };
      if (value && value.trim()) next[key] = value;
      else delete next[key];
      return { sprayNotes: next };
    }),

  // ─── Getters ───
  getProjectById: (id) => get().projects.find((p) => p.id === id) || null,
  getBatchById: (projectId, batchId) => {
    const project = get().projects.find((p) => p.id === projectId);
    return project?.batches?.find((b) => b.id === batchId) || null;
  },
  getWindowById: (id) => get().currentWindows.find((w) => w.id === id) || null,

  // Backward compat: calculations engine uses getItemById
  getItemById: (id) => get().currentWindows.find((w) => w.id === id) || null,

  // ─── PROJECT CRUD ───
  createProject: (name, address, projectNumber, client) => {
    const id = uid();
    const project = {
      id,
      name: name || 'New Project',
      project_number: projectNumber || `PRJ-${new Date().getFullYear()}-${String(get().projects.length + 1).padStart(3, '0')}`,
      client: client || '',
      address: address || '',
      created_at: new Date().toISOString(),
      batches: [],
    };
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  deleteProject: (projectId) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
      // Clean up production pack assignments referencing this project
      productionPacks: s.productionPacks.map((pp) => ({
        ...pp,
        assignments: pp.assignments.filter((a) => a.projectId !== projectId),
      })),
      currentProject: s.currentProject?.id === projectId ? null : s.currentProject,
      currentBatch: null,
      currentWindows: [],
    }));
  },

  updateProject: (projectId, patch) => {
    set((s) => {
      const updatedProjects = s.projects.map((p) =>
        p.id === projectId ? { ...p, ...patch } : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, ...patch }
        : s.currentProject;
      return { projects: updatedProjects, currentProject: updatedCurrent };
    });
  },

  // ─── BATCH CRUD ───
  createBatch: (projectId, windowType) => {
    const id = uid();
    const batchNum = (get().projects.find(p => p.id === projectId)?.batches?.length || 0) + 1;
    const typeLabel = windowType === 'fix-frame' ? 'Fix Frame' : windowType.charAt(0).toUpperCase() + windowType.slice(1);
    const batch = {
      id,
      project_id: projectId,
      type: windowType,
      label: `Batch ${batchNum} — ${typeLabel}`,
      status: 'preparation',
      defaults: { ...(BATCH_DEFAULTS[windowType] || BATCH_DEFAULTS.sash) },
      windows: [],
      created_at: new Date().toISOString(),
    };
    set((s) => {
      const updatedProjects = s.projects.map((p) =>
        p.id === projectId
          ? { ...p, batches: [...(p.batches || []), batch] }
          : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: [...(s.currentProject.batches || []), batch] }
        : s.currentProject;
      return { projects: updatedProjects, currentProject: updatedCurrent };
    });
    return batch;
  },

  deleteBatch: (projectId, batchId) => {
    set((s) => {
      const updatedProjects = s.projects.map((p) =>
        p.id === projectId
          ? { ...p, batches: (p.batches || []).filter((b) => b.id !== batchId) }
          : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).filter((b) => b.id !== batchId) }
        : s.currentProject;
      // Clean up production pack assignments referencing this batch
      const updatedPacks = s.productionPacks.map((pp) => ({
        ...pp,
        assignments: pp.assignments.filter(
          (a) => !(a.projectId === projectId && a.batchId === batchId)
        ),
      }));
      return {
        projects: updatedProjects,
        currentProject: updatedCurrent,
        productionPacks: updatedPacks,
        currentBatch: s.currentBatch?.id === batchId ? null : s.currentBatch,
        currentWindows: s.currentBatch?.id === batchId ? [] : s.currentWindows,
      };
    });
  },

  updateBatchDefaults: (projectId, batchId, newDefaults) => {
    set((s) => {
      const updateBatch = (b) =>
        b.id === batchId ? { ...b, defaults: { ...b.defaults, ...newDefaults } } : b;

      const updatedProjects = s.projects.map((p) =>
        p.id === projectId
          ? { ...p, batches: (p.batches || []).map(updateBatch) }
          : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(updateBatch) }
        : s.currentProject;
      const updatedBatch = s.currentBatch?.id === batchId
        ? { ...s.currentBatch, defaults: { ...s.currentBatch.defaults, ...newDefaults } }
        : s.currentBatch;
      return { projects: updatedProjects, currentProject: updatedCurrent, currentBatch: updatedBatch };
    });
  },

  updateBatchStatus: (projectId, batchId, status) => {
    set((s) => {
      const updateBatch = (b) => b.id === batchId ? { ...b, status } : b;
      const updatedProjects = s.projects.map((p) =>
        p.id === projectId ? { ...p, batches: (p.batches || []).map(updateBatch) } : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(updateBatch) }
        : s.currentProject;
      const updatedBatch = s.currentBatch?.id === batchId ? { ...s.currentBatch, status } : s.currentBatch;
      return { projects: updatedProjects, currentProject: updatedCurrent, currentBatch: updatedBatch };
    });
  },

  updateBatchLabel: (projectId, batchId, label) => {
    set((s) => {
      const updateBatch = (b) => b.id === batchId ? { ...b, label } : b;
      const updatedProjects = s.projects.map((p) =>
        p.id === projectId ? { ...p, batches: (p.batches || []).map(updateBatch) } : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(updateBatch) }
        : s.currentProject;
      const updatedBatch = s.currentBatch?.id === batchId ? { ...s.currentBatch, label } : s.currentBatch;
      return { projects: updatedProjects, currentProject: updatedCurrent, currentBatch: updatedBatch };
    });
  },

  // ─── PRODUCTION PACK CRUD ───
  createProductionPack: (name, type, deadline) => {
    const id = uid();
    const pack = {
      id,
      name: name || `#${get().productionPacks.length + 1} ${type || 'Sash'}`,
      type: type || 'sash',
      deadline: deadline || '',
      responsible: '',
      status: 'preparation',
      assignments: [],
      created_at: new Date().toISOString(),
    };
    set((s) => ({ productionPacks: [...s.productionPacks, pack] }));
    return pack;
  },

  deleteProductionPack: (ppId) => {
    set((s) => ({ productionPacks: s.productionPacks.filter((pp) => pp.id !== ppId) }));
  },

  updateProductionPack: (ppId, patch) => {
    set((s) => ({
      productionPacks: s.productionPacks.map((pp) =>
        pp.id === ppId ? { ...pp, ...patch } : pp
      ),
    }));
  },

  // Persist pre-cut editable settings (stock lengths + offcuts) to the active
  // container: a production pack (isPP=true) or a batch's defaults (isPP=false).
  setPrecutSettings: (id, isPP, precutSettings) => {
    if (isPP) {
      set((s) => ({
        productionPacks: s.productionPacks.map((pp) =>
          pp.id === id ? { ...pp, precutSettings } : pp
        ),
      }));
      return;
    }
    set((s) => {
      const patchBatch = (b) =>
        b.id === id
          ? { ...b, defaults: { ...(b.defaults || {}), precutSettings } }
          : b;
      return {
        projects: s.projects.map((p) => ({ ...p, batches: (p.batches || []).map(patchBatch) })),
        currentProject: s.currentProject
          ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(patchBatch) }
          : s.currentProject,
      };
    });
  },

  assignBatchToProductionPack: (ppId, projectId, batchId) => {
    set((s) => {
      // Guard: batch already assigned to another production pack
      const alreadyInOther = s.productionPacks.some((pp) =>
        pp.id !== ppId && pp.assignments.some((a) => a.projectId === projectId && a.batchId === batchId)
      );
      if (alreadyInOther) return s;

      return {
        productionPacks: s.productionPacks.map((pp) => {
          if (pp.id !== ppId) return pp;
          const already = pp.assignments.some((a) => a.projectId === projectId && a.batchId === batchId);
          if (already) return pp;
          return { ...pp, assignments: [...pp.assignments, { projectId, batchId }] };
        }),
      };
    });
  },

  unassignBatchFromProductionPack: (ppId, projectId, batchId) => {
    set((s) => ({
      productionPacks: s.productionPacks.map((pp) => {
        if (pp.id !== ppId) return pp;
        return {
          ...pp,
          assignments: pp.assignments.filter(
            (a) => !(a.projectId === projectId && a.batchId === batchId)
          ),
        };
      }),
    }));
  },

  getProductionPackById: (id) => get().productionPacks.find((pp) => pp.id === id) || null,

  // Reverse lookup: which production pack is this batch assigned to?
  getProductionPackForBatch: (projectId, batchId) =>
    get().productionPacks.find((pp) =>
      pp.assignments.some((a) => a.projectId === projectId && a.batchId === batchId)
    ) || null,

  // Helper: get all windows assigned to a production pack
  getProductionPackWindows: (ppId) => {
    const pp = get().productionPacks.find((p) => p.id === ppId);
    if (!pp) return [];
    const windows = [];
    for (const { projectId, batchId } of pp.assignments) {
      const project = get().projects.find((p) => p.id === projectId);
      const batch = project?.batches?.find((b) => b.id === batchId);
      if (batch?.windows) {
        windows.push(...batch.windows.map((w) => ({ ...w, _projectId: projectId, _projectName: project.name })));
      }
    }
    return windows;
  },

  // ─── WINDOW CRUD ───
  addWindowToBatch: (projectId, batchId, windowConfig) => {
    const batch = get().getBatchById(projectId, batchId);
    if (!batch) return null;

    const windowId = uid();
    const windowNum = (batch.windows?.length || 0) + 1;
    const defaults = batch.defaults || {};

    // Merge batch defaults with window-specific config
    const win = {
      id: windowId,
      batch_id: batchId,
      name: windowConfig.windowName || `W${windowNum}`,
      window_type: batch.type,
      width: windowConfig.extWidth || 1000,
      height: windowConfig.extHeight || 1500,
      measurementType: windowConfig.measurementType || 'box-to-box',
      inputWidth: windowConfig.inputWidth || windowConfig.extWidth || 1000,
      inputHeight: windowConfig.inputHeight || windowConfig.extHeight || 1500,
      sashType: windowConfig.sashType || 'double',
      splitRatio: windowConfig.splitRatio || '1/4-1/2-1/4',
      headType: windowConfig.headType || 'flat',
      upperBars: windowConfig.upperBars || 'none',
      lowerBars: windowConfig.lowerBars || 'none',
      sameBars: windowConfig.sameBars !== undefined ? windowConfig.sameBars : true,
      upperCustomBars: windowConfig.upperCustomBars || [],
      lowerCustomBars: windowConfig.lowerCustomBars || [],
      openingType: windowConfig.openingType || 'both',
      glassFinish: windowConfig.glassFinish || 'clear',
      frostedLocation: windowConfig.frostedLocation || 'bottom',
      // Inherited from batch defaults (can be overridden)
      hornType: windowConfig.hornType || defaults.hornType || 'A',
      frameType: windowConfig.frameType || defaults.frameType || 'standard',
      frameDepth: windowConfig.frameDepth || (defaults.frameType === 'slim' ? 144 : 164),
      ironmongery: windowConfig.ironmongery || defaults.ironmongery || 'brass',
      colourMode: windowConfig.colourMode || defaults.colourMode || 'single',
      woodColor: windowConfig.woodColor || defaults.woodColor || '#F6F6F6',
      woodColorExt: windowConfig.woodColorExt || defaults.woodColorExt || '#F6F6F6',
      woodColorInt: windowConfig.woodColorInt || defaults.woodColorInt || '#F6F6F6',
      glassType: windowConfig.glassType || defaults.glassType || 'double',
      glassSpec: windowConfig.glassSpec || defaults.glassSpec || 'toughened',
      spacerColor: windowConfig.spacerColor || defaults.spacerColor || 'silver',
      spacerType: windowConfig.spacerType || defaults.spacerType || 'warm',
      pas24: windowConfig.pas24 !== undefined ? windowConfig.pas24 : (defaults.pas24 || false),
      // Full specification JSON for calculations engine
      specification: JSON.stringify({
        windowType: batch.type,
        width: (windowConfig.extWidth || 1000) - 104,
        height: (windowConfig.extHeight || 1500) - 87,
        upperBars: windowConfig.upperBars || 'none',
        lowerBars: windowConfig.lowerBars || 'none',
        horns: (windowConfig.hornType || defaults.hornType || 'A') === 'none' ? 'none' : (windowConfig.hornType || defaults.hornType || 'A'),
        glassType: windowConfig.glassType || defaults.glassType || 'double',
        glassFinish: windowConfig.glassFinish || 'clear',
        fullConfig: {
          ...defaults,
          ...windowConfig,
          colorSingleName: windowConfig.woodColor || defaults.woodColor || '#F6F6F6',
          interiorColor: windowConfig.woodColorInt || defaults.woodColorInt || '#F6F6F6',
          exteriorColor: windowConfig.woodColorExt || defaults.woodColorExt || '#F6F6F6',
          ironmongeryFinish: windowConfig.ironmongery || defaults.ironmongery || 'brass',
          spacerColor: windowConfig.spacerColor || defaults.spacerColor || 'silver',
      spacerType: windowConfig.spacerType || defaults.spacerType || 'warm',
        }
      }),
    };

    set((s) => {
      const addWinToBatch = (b) =>
        b.id === batchId ? { ...b, windows: [...(b.windows || []), win] } : b;

      const updatedProjects = s.projects.map((p) =>
        p.id === projectId ? { ...p, batches: (p.batches || []).map(addWinToBatch) } : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(addWinToBatch) }
        : s.currentProject;
      const updatedBatch = s.currentBatch?.id === batchId
        ? { ...s.currentBatch, windows: [...(s.currentBatch.windows || []), win] }
        : s.currentBatch;
      const updatedWindows = s.currentBatch?.id === batchId
        ? [...s.currentWindows, win]
        : s.currentWindows;

      return {
        projects: updatedProjects,
        currentProject: updatedCurrent,
        currentBatch: updatedBatch,
        currentWindows: updatedWindows,
      };
    });
    return windowId;
  },

  updateWindowInBatch: (projectId, batchId, windowId, windowConfig) => {
    const batch = get().getBatchById(projectId, batchId);
    if (!batch) return null;
    const existing = batch.windows?.find((w) => w.id === windowId);
    if (!existing) return null;

    const defaults = batch.defaults || {};

    const win = {
      ...existing,
      name: windowConfig.windowName || existing.name,
      width: windowConfig.extWidth || existing.width,
      height: windowConfig.extHeight || existing.height,
      measurementType: windowConfig.measurementType || 'box-to-box',
      inputWidth: windowConfig.inputWidth || windowConfig.extWidth || existing.width,
      inputHeight: windowConfig.inputHeight || windowConfig.extHeight || existing.height,
      sashType: windowConfig.sashType || 'double',
      splitRatio: windowConfig.splitRatio || '1/4-1/2-1/4',
      headType: windowConfig.headType || 'flat',
      upperBars: windowConfig.upperBars || 'none',
      lowerBars: windowConfig.lowerBars || 'none',
      sameBars: windowConfig.sameBars !== undefined ? windowConfig.sameBars : true,
      upperCustomBars: windowConfig.upperCustomBars || [],
      lowerCustomBars: windowConfig.lowerCustomBars || [],
      openingType: windowConfig.openingType || 'both',
      glassFinish: windowConfig.glassFinish || 'clear',
      frostedLocation: windowConfig.frostedLocation || 'bottom',
      hornType: windowConfig.hornType || defaults.hornType || 'A',
      frameType: windowConfig.frameType || defaults.frameType || 'standard',
      frameDepth: windowConfig.frameDepth || (defaults.frameType === 'slim' ? 144 : 164),
      ironmongery: windowConfig.ironmongery || defaults.ironmongery || 'brass',
      colourMode: windowConfig.colourMode || defaults.colourMode || 'single',
      woodColor: windowConfig.woodColor || defaults.woodColor || '#F6F6F6',
      woodColorExt: windowConfig.woodColorExt || defaults.woodColorExt || '#F6F6F6',
      woodColorInt: windowConfig.woodColorInt || defaults.woodColorInt || '#F6F6F6',
      glassType: windowConfig.glassType || defaults.glassType || 'double',
      glassSpec: windowConfig.glassSpec || defaults.glassSpec || 'toughened',
      spacerColor: windowConfig.spacerColor || defaults.spacerColor || 'silver',
      spacerType: windowConfig.spacerType || defaults.spacerType || 'warm',
      pas24: windowConfig.pas24 !== undefined ? windowConfig.pas24 : (defaults.pas24 || false),
      specification: JSON.stringify({
        windowType: batch.type,
        width: (windowConfig.extWidth || existing.width) - 104,
        height: (windowConfig.extHeight || existing.height) - 87,
        upperBars: windowConfig.upperBars || 'none',
        lowerBars: windowConfig.lowerBars || 'none',
        horns: (windowConfig.hornType || defaults.hornType || 'A') === 'none' ? 'none' : (windowConfig.hornType || defaults.hornType || 'A'),
        glassType: windowConfig.glassType || defaults.glassType || 'double',
        glassFinish: windowConfig.glassFinish || 'clear',
        fullConfig: {
          ...defaults,
          ...windowConfig,
          colorSingleName: windowConfig.woodColor || defaults.woodColor || '#F6F6F6',
          interiorColor: windowConfig.woodColorInt || defaults.woodColorInt || '#F6F6F6',
          exteriorColor: windowConfig.woodColorExt || defaults.woodColorExt || '#F6F6F6',
          ironmongeryFinish: windowConfig.ironmongery || defaults.ironmongery || 'brass',
          spacerColor: windowConfig.spacerColor || defaults.spacerColor || 'silver',
      spacerType: windowConfig.spacerType || defaults.spacerType || 'warm',
        }
      }),
    };

    set((s) => {
      const replaceWin = (b) =>
        b.id === batchId ? { ...b, windows: (b.windows || []).map((w) => w.id === windowId ? win : w) } : b;

      const updatedProjects = s.projects.map((p) =>
        p.id === projectId ? { ...p, batches: (p.batches || []).map(replaceWin) } : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(replaceWin) }
        : s.currentProject;
      const updatedBatch = s.currentBatch?.id === batchId
        ? { ...s.currentBatch, windows: (s.currentBatch.windows || []).map((w) => w.id === windowId ? win : w) }
        : s.currentBatch;
      const updatedWindows = s.currentBatch?.id === batchId
        ? s.currentWindows.map((w) => w.id === windowId ? win : w)
        : s.currentWindows;

      return {
        projects: updatedProjects,
        currentProject: updatedCurrent,
        currentBatch: updatedBatch,
        currentWindows: updatedWindows,
      };
    });
    return windowId;
  },

  removeWindowFromBatch: (projectId, batchId, windowId) => {
    set((s) => {
      const removeWin = (b) =>
        b.id === batchId ? { ...b, windows: (b.windows || []).filter((w) => w.id !== windowId) } : b;

      const updatedProjects = s.projects.map((p) =>
        p.id === projectId ? { ...p, batches: (p.batches || []).map(removeWin) } : p
      );
      const updatedCurrent = s.currentProject?.id === projectId
        ? { ...s.currentProject, batches: (s.currentProject.batches || []).map(removeWin) }
        : s.currentProject;
      const updatedBatch = s.currentBatch?.id === batchId
        ? { ...s.currentBatch, windows: (s.currentBatch.windows || []).filter((w) => w.id !== windowId) }
        : s.currentBatch;
      const updatedWindows = s.currentBatch?.id === batchId
        ? s.currentWindows.filter((w) => w.id !== windowId)
        : s.currentWindows;

      return {
        projects: updatedProjects,
        currentProject: updatedCurrent,
        currentBatch: updatedBatch,
        currentWindows: updatedWindows,
      };
    });
  },

}),
    {
      name: 'sp-projects',
      partialize: (state) => ({
        projects: state.projects,
        productionPacks: state.productionPacks,
        settings: state.settings,
        sprayNotes: state.sprayNotes,
        projectsLoaded: state.projectsLoaded,
      }),
      merge: (persisted, current) => {
        if (!persisted || !persisted.projects) {
          // First visit — no saved data at all, use mocks
          return { ...current, projects: mockProjects, productionPacks: mockProductionPacks, projectsLoaded: true };
        }
        // Saved data exists — always restore it.
        // Deep-merge settings so newly-added defaults (e.g. company) survive old saves.
        return {
          ...current,
          ...persisted,
          settings: {
            ...current.settings,
            ...(persisted.settings || {}),
            company: { ...current.settings.company, ...((persisted.settings || {}).company || {}) },
          },
          projectsLoaded: true,
        };
      },
    }
  )
);
