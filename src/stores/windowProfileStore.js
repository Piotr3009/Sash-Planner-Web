import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeSashProfile, migrateCasementProfile, migrateDoorProfile, DEFAULT_SASH_PROFILE, DEFAULT_CASEMENT_PROFILE, DEFAULT_DOOR_PROFILE, setActiveWindowProfile, setActiveCasementProfile, setActiveDoorProfile, casementGlassDeduction } from '../engine/profile.js';
import { loadWindowProfiles, saveWindowProfiles } from '../services/cloudSync.js';

let cloudSaveTimer = null;
const scheduleCloudSave = (profiles) => {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveWindowProfiles(profiles), 800);
};

// Deep clone helper for the plain-JSON profile object
const clone = (o) => JSON.parse(JSON.stringify(o));

// Keep the stored casement deductions.glass in step with the stile face and
// glassInset (06.10.2026): it holds the WIDTH deduction, the readers take both
// deductions from casementGlassDeductions, and the stored copy must never
// disagree with them. The height deduction (top and bottom rails) is not stored.
const syncGlassDeduction = (casement) => {
  if (casement?.deductions && casement.geometry?.glassInset != null) {
    casement.deductions.glass = casementGlassDeduction(casement);
  }
  return casement;
};

// Door profile keys the Window Settings Doors card may write (setDoorPath):
// the first path segment must be one of these, and the last one must already
// exist in the profile, so a typo can never grow it. String-valued leaves are
// the hardware variant names; every other leaf is a finite number.
const DOOR_PATH_ROOTS = ['frameDepth', 'leafDepth', 'leafDepthTriple', 'frenchLip', 'elements', 'geometry', 'deductions', 'cillInward', 'sidePanel', 'couplingPost', 'panel', 'hinges', 'hardware', 'lengths'];
const DOOR_STRING_LEAVES = ['faceplate', 'keeps', 'fgteShootbolts', 'cillKeep'];

/**
 * Workshop window-construction profile (Window Settings page): sash, casement
 * and doors (08.10.2026), saved and loaded together as windowProfiles.
 * Every mutation pushes the fresh profile into the engine via
 * setActiveWindowProfile / setActiveCasementProfile / setActiveDoorProfile so
 * calculations pick it up immediately.
 */
export const useWindowProfileStore = create(
  persist(
    (set, get) => ({
      sash: clone(DEFAULT_SASH_PROFILE),
      casement: clone(DEFAULT_CASEMENT_PROFILE),
      door: clone(DEFAULT_DOOR_PROFILE),

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

      setGlassMakeup: (glassType, value) => {
        set((s) => {
          const sash = clone(s.sash);
          sash.glassMakeup = { ...(sash.glassMakeup || {}), [glassType]: String(value) };
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
          return { casement: syncGlassDeduction(casement) };
        });
        get()._sync();
      },

      setCasementDeduction: (key, value) => {
        set((s) => {
          const casement = clone(s.casement);
          casement.deductions[key] = Number(value) || 0;
          return { casement: syncGlassDeduction(casement) };
        });
        get()._sync();
      },

      setCasementDepth: (value) => {
        set((s) => ({ casement: { ...clone(s.casement), depth: Number(value) || 57 } }));
        get()._sync();
      },

      // ── v1.1 profile setters (Window Settings — Casement rebuild, 04.08) ──
      setCasementTopField: (key, value) => {
        if (!['frameDepth', 'leafDepth', 'leafDepthTriple'].includes(key)) return;
        set((s) => ({ casement: { ...clone(s.casement), [key]: Number(value) || 0 } }));
        get()._sync();
      },

      setCasementGeometry: (key, value) => {
        set((s) => {
          const casement = clone(s.casement);
          if (!casement.geometry || !(key in casement.geometry)) return {};
          casement.geometry[key] = Number(value) || 0;
          return { casement: syncGlassDeduction(casement) };
        });
        get()._sync();
      },

      setCasementLength: (key, value) => {
        set((s) => {
          const casement = clone(s.casement);
          if (!casement.lengths || !(key in casement.lengths)) return {};
          casement.lengths[key] = Number(value) || 0;
          return { casement };
        });
        get()._sync();
      },

      // Stiles and top rail share ONE width (Piotr 07.10.2026): one input, two
      // writes. The bottom rail has its own width (setCasementElementField
      // 'leafBottom'), so this setter never touches it.
      setCasementLeafFace: (value) => {
        set((s) => {
          const casement = clone(s.casement);
          const v = Number(value) || 0;
          ['leafStile', 'leafTop'].forEach((k) => {
            if (casement.elements[k]) casement.elements[k].face = v;
          });
          return { casement: syncGlassDeduction(casement) };
        });
        get()._sync();
      },

      // ── v4 (ARCHED-WINDOWS-v4 Block C) — the "CNC & arches" card ──────────
      // One generic setter for the numeric fields of the arch / cnc / tracery
      // blocks and geometry.glazingRebate: `path` = ['arch', 'finger', 'length'].
      // Roots are whitelisted so a typo can never grow the profile; the value
      // must parse as a finite number (an empty field commits nothing).
      setCasementPath: (path, value) => {
        const roots = ['arch', 'cnc', 'tracery', 'geometry', 'bsuite'];
        if (!Array.isArray(path) || path.length < 2 || !roots.includes(path[0])) return;
        // 12.09: the bsuite block holds strings (folder, file names, 'start' | 'end') and booleans,
        // the other roots are numeric only — keep the numeric guard for them
        const isBsuite = path[0] === 'bsuite';
        const v = isBsuite ? (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' ? value : null) : Number(value);
        if (v === null || (!isBsuite && !Number.isFinite(v))) return;
        set((s) => {
          const casement = clone(s.casement);
          let node = casement;
          for (let i = 0; i < path.length - 1; i++) {
            if (node[path[i]] == null || typeof node[path[i]] !== 'object') return {};
            node = node[path[i]];
          }
          if (!(path[path.length - 1] in node)) return {};
          node[path[path.length - 1]] = v;
          return { casement: syncGlassDeduction(casement) };
        });
        get()._sync();
      },

      // 14.09: bSuite targets (computers with their own program paths) — replaced whole,
      // validated: ids unique and non-empty, names non-empty, six program paths per target
      setCasementBsuiteTargets: (targets, activeTarget) => {
        if (!Array.isArray(targets) || !targets.length) return;
        const ids = new Set();
        for (const t of targets) {
          if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.name !== 'string' || !t.name.trim()) return;
          if (!t.programs || !['head', 'cill', 'jambL', 'jambR', 'mullion', 'transom'].every((k) => typeof t.programs[k]?.path === 'string')) return;
          ids.add(t.id);
        }
        set((s) => {
          const casement = clone(s.casement);
          casement.bsuite = { ...casement.bsuite, targets: clone(targets), activeTarget: ids.has(activeTarget) ? activeTarget : targets[0].id };
          return { casement };
        });
        get()._sync();
      },

      // Stock widths as a comma list ("63, 75, 95") → sorted positive numbers;
      // an empty or all-junk list is refused (the planner needs a board).
      setCasementStockWidths: (text) => {
        const widths = String(text ?? '').split(/[,\s;]+/).map(Number).filter((w) => Number.isFinite(w) && w > 0);
        if (!widths.length) return;
        const sorted = [...new Set(widths)].sort((a, b) => a - b);
        set((s) => {
          const casement = clone(s.casement);
          if (!casement.arch) return {};
          casement.arch.stockWidths = sorted;
          return { casement };
        });
        get()._sync();
      },

      // ── Doors (08.10.2026): one generic setter for the Doors card. `path` =
      // ['elements', 'leafStile', 'face'] or ['frenchLip']; roots whitelisted
      // (DOOR_PATH_ROOTS), the key must already exist, numbers must be finite.
      setDoorPath: (path, value) => {
        if (!Array.isArray(path) || !path.length || !DOOR_PATH_ROOTS.includes(path[0])) return;
        const leaf = path[path.length - 1];
        const isString = path[0] === 'hardware' && DOOR_STRING_LEAVES.includes(leaf);
        const v = isString ? String(value ?? '') : Number(value);
        if (!isString && (value === '' || value == null || !Number.isFinite(v))) return;
        set((s) => {
          const door = clone(s.door);
          let node = door;
          for (let i = 0; i < path.length - 1; i++) {
            if (node[path[i]] == null || typeof node[path[i]] !== 'object') return {};
            node = node[path[i]];
          }
          if (!(leaf in node)) return {};
          node[leaf] = v;
          return { door };
        });
        get()._sync();
      },

      resetDoorToDefaults: () => {
        set({ door: clone(DEFAULT_DOOR_PROFILE) });
        get()._sync();
      },

      resetToDefaults: () => {
        set({ sash: clone(DEFAULT_SASH_PROFILE), casement: clone(DEFAULT_CASEMENT_PROFILE) });
        get()._sync();
      },

      _sync: () => {
        setActiveWindowProfile(get().sash);
        setActiveCasementProfile(get().casement);
        setActiveDoorProfile(get().door);
        scheduleCloudSave({ sash: get().sash, casement: get().casement, door: get().door });
      },

      // Pull tenant profiles from Supabase (called once after rehydrate)
      loadFromCloud: async () => {
        try {
          const cloud = await loadWindowProfiles();
          if (cloud?.sash || cloud?.casement || cloud?.door) {
            const migratedCas = cloud.casement
              ? (migrateCasementProfile(cloud.casement) || clone(DEFAULT_CASEMENT_PROFILE))
              : null;
            const migratedDoor = cloud.door ? migrateDoorProfile(cloud.door) : null;
            set({
              ...(cloud.sash ? { sash: normalizeSashProfile(cloud.sash) } : {}),
              ...(migratedCas ? { casement: migratedCas } : {}),
              ...(migratedDoor ? { door: migratedDoor } : {}),
            });
            setActiveWindowProfile(get().sash);
            setActiveCasementProfile(get().casement);
            setActiveDoorProfile(get().door);
          }
        } catch (err) {
          console.error('windowProfile loadFromCloud', err);
        }
      },
    }),
    {
      name: 'pc-window-profile',
      onRehydrateStorage: () => (state) => {
        // Push the persisted profile into the engine on app start.
        if (state?.sash) setActiveWindowProfile(normalizeSashProfile(state.sash));
        // Old localStorage may still hold the pre-v1 casement prototype; the
        // NEW settings UI reads v1.1 keys (geometry/lengths), so the store
        // itself must be migrated — engine-only migration is not enough.
        if (state?.casement) {
          const m = migrateCasementProfile(state.casement) || clone(DEFAULT_CASEMENT_PROFILE);
          setActiveCasementProfile(m);
          setTimeout(() => useWindowProfileStore.setState({ casement: m }), 0);
        }
        // Doors (08.10.2026): a stored copy below schema 2 is migrated key by
        // key, in the store as well as in the engine (the Doors card reads it).
        if (state?.door) {
          const d = migrateDoorProfile(state.door);
          setActiveDoorProfile(d);
          setTimeout(() => useWindowProfileStore.setState({ door: d }), 0);
        }
        // Tenant profile from Supabase wins over the local cache
        setTimeout(() => useWindowProfileStore.getState().loadFromCloud(), 0);
      },
    }
  )
);

// Cold start before rehydrate: engine falls back to defaults inside profile.js
