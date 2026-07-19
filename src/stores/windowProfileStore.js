import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeSashProfile, DEFAULT_SASH_PROFILE, DEFAULT_CASEMENT_PROFILE, setActiveWindowProfile, setActiveCasementProfile } from '../engine/profile.js';
import { loadWindowProfiles, saveWindowProfiles } from '../services/cloudSync.js';

let cloudSaveTimer = null;
const scheduleCloudSave = (profiles) => {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveWindowProfiles(profiles), 800);
};

// Deep clone helper for the plain-JSON profile object
const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * Workshop window-construction profile (Window Settings page).
 * Currently sash only; casement/fix/doors will get their own keys later.
 * Every mutation pushes the fresh profile into the engine via
 * setActiveWindowProfile so calculations pick it up immediately.
 */
export const useWindowProfileStore = create(
  persist(
    (set, get) => ({
      sash: clone(DEFAULT_SASH_PROFILE),
      casement: clone(DEFAULT_CASEMENT_PROFILE),

      setVariantField: (variantKey, field, value) => {
        set((s) => {
          const sash = clone(s.sash);
          if (!sash.variants[variantKey]) return {};
          sash.variants[variantKey][field] =
            field === 'label' ? String(value) : (Number(value) || 0);
          return { sash };
        });
        get()._sync();
      },

      setElementField: (elementKey, field, value) => {
        set((s) => {
          const sash = clone(s.sash);
          if (!sash.elements[elementKey]) return {};
          sash.elements[elementKey][field] =
            field === 'raw' ? String(value) : (Number(value) || 0);
          return { sash };
        });
        get()._sync();
      },

      setHornExtension: (value) => {
        set((s) => {
          const sash = clone(s.sash);
          sash.hornExtension = Number(value) || 0;
          return { sash };
        });
        get()._sync();
      },

      setDeduction: (key, value) => {
        set((s) => {
          const sash = clone(s.sash);
          sash.deductions[key] = Number(value) || 0;
          return { sash };
        });
        get()._sync();
      },

      setCillTwoPiece: (twoPiece) => {
        set((s) => ({ sash: { ...clone(s.sash), cillTwoPiece: !!twoPiece } }));
        get()._sync();
      },

      setCasementElementField: (elementKey, field, value) => {
        set((s) => {
          const casement = clone(s.casement);
          if (!casement.elements[elementKey]) return {};
          casement.elements[elementKey][field] =
            field === 'raw' ? String(value) : (Number(value) || 0);
          return { casement };
        });
        get()._sync();
      },

      setCasementDeduction: (key, value) => {
        set((s) => {
          const casement = clone(s.casement);
          casement.deductions[key] = Number(value) || 0;
          return { casement };
        });
        get()._sync();
      },

      setCasementDepth: (value) => {
        set((s) => ({ casement: { ...clone(s.casement), depth: Number(value) || 57 } }));
        get()._sync();
      },

      resetToDefaults: () => {
        set({ sash: clone(DEFAULT_SASH_PROFILE), casement: clone(DEFAULT_CASEMENT_PROFILE) });
        get()._sync();
      },

      _sync: () => {
        setActiveWindowProfile(get().sash);
        setActiveCasementProfile(get().casement);
        scheduleCloudSave({ sash: get().sash, casement: get().casement });
      },

      // Pull tenant profiles from Supabase (called once after rehydrate)
      loadFromCloud: async () => {
        try {
          const cloud = await loadWindowProfiles();
          if (cloud?.sash || cloud?.casement) {
            set({
              ...(cloud.sash ? { sash: normalizeSashProfile(cloud.sash) } : {}),
              ...(cloud.casement ? { casement: cloud.casement } : {}),
            });
            setActiveWindowProfile(get().sash);
            setActiveCasementProfile(get().casement);
          }
        } catch (err) {
          console.error('windowProfile loadFromCloud', err);
        }
      },
    }),
    {
      name: 'pc-window-profile',
      onRehydrateStorage: () => (state) => {
        // Push the persisted profile into the engine on app start
        if (state?.sash) setActiveWindowProfile(normalizeSashProfile(state.sash));
        if (state?.casement) setActiveCasementProfile(state.casement);
        // Tenant profile from Supabase wins over the local cache
        setTimeout(() => useWindowProfileStore.getState().loadFromCloud(), 0);
      },
    }
  )
);

// Cold start before rehydrate: engine falls back to defaults inside profile.js
