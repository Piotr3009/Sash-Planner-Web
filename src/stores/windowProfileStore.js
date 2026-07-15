import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SASH_PROFILE, setActiveWindowProfile } from '../engine/profile.js';

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

      setVariantField: (variantKey, field, value) => {
        set((s) => {
          const sash = clone(s.sash);
          if (!sash.variants[variantKey]) return {};
          sash.variants[variantKey][field] = Number(value) || 0;
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

      setDeduction: (key, value) => {
        set((s) => {
          const sash = clone(s.sash);
          sash.deductions[key] = Number(value) || 0;
          return { sash };
        });
        get()._sync();
      },

      setBoardInset: (value) => {
        set((s) => ({ sash: { ...clone(s.sash), boardInset: Number(value) || 0 } }));
        get()._sync();
      },

      setCillTwoPiece: (twoPiece) => {
        set((s) => ({ sash: { ...clone(s.sash), cillTwoPiece: !!twoPiece } }));
        get()._sync();
      },

      resetToDefaults: () => {
        set({ sash: clone(DEFAULT_SASH_PROFILE) });
        get()._sync();
      },

      _sync: () => setActiveWindowProfile(get().sash),
    }),
    {
      name: 'pc-window-profile',
      onRehydrateStorage: () => (state) => {
        // Push the persisted profile into the engine on app start
        if (state?.sash) setActiveWindowProfile(state.sash);
      },
    }
  )
);

// Cold start before rehydrate: engine falls back to defaults inside profile.js
