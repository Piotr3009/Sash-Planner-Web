import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeSashProfile, migrateCasementProfile, migrateDoorProfile, DEFAULT_SASH_PROFILE, DEFAULT_CASEMENT_PROFILE, DEFAULT_DOOR_PROFILE, setActiveWindowProfile, setActiveCasementProfile, setActiveDoorProfile, casementGlassDeduction } from '../engine/profile.js';
import { loadWindowProfiles, saveWindowProfiles } from '../services/cloudSync.js';

// Deep clone helper for the plain-JSON profile object
const clone = (o) => JSON.parse(JSON.stringify(o));

// ─── Cloud save that merges (Piotr 09.10.2026, owner box item 20) ──────────
// Until 09.10.2026 every edit saved { sash, casement, door } from this tab's
// memory WHOLE, so a tab opened before a change on another computer wrote its
// stale copy over that change (the bSuite target lost on 07.10.2026). Now the
// store records the paths it changed since its last cloud load ("profile" or
// "profile.firstKey", e.g. 'casement.bsuite', 'door.deductions'); the save
// loads the current cloud copy, overlays ONLY those paths from memory, writes
// the merged object, takes it as the local copy and clears the paths saved.
// A cloud load (app start, entering Window Settings, the tab coming back)
// keeps the unsaved local paths on top of the cloud copy. The same path
// changed in two tabs: the later save wins (BLOCKERS 31).
//
// The cloud is an adapter so a harness can run two tabs over one fake cloud
// (setWindowProfileCloud); the default is the Supabase settings row.
const KINDS = ['sash', 'casement', 'door'];
let cloudAdapter = { load: loadWindowProfiles, save: saveWindowProfiles };
export function setWindowProfileCloud(adapter) {
  cloudAdapter = adapter || { load: loadWindowProfiles, save: saveWindowProfiles };
}

/** A copy of one profile kind as the engine reads it (the stored-copy migrations). */
function migrateKind(kind, profile) {
  if (!profile) return null;
  if (kind === 'sash') return normalizeSashProfile(clone(profile));
  if (kind === 'casement') return migrateCasementProfile(clone(profile)) || clone(DEFAULT_CASEMENT_PROFILE);
  return migrateDoorProfile(clone(profile));
}

/**
 * The cloud copy with the dirty paths of `local` laid over it. `cloud` and
 * `local` are { sash, casement, door }; `dirty` holds 'kind' (the whole
 * profile, a reset) or 'kind.firstKey'. A kind the cloud does not hold yet is
 * taken whole from `local`. The casement glass width deduction is recomputed
 * on the result (it is derived from the stile face and glassInset). Pure.
 */
export function mergeWindowProfiles(cloud, local, dirty) {
  const out = {};
  for (const kind of KINDS) {
    const base = migrateKind(kind, cloud?.[kind]);
    if (!base) { out[kind] = clone(local[kind]); continue; }
    const paths = (dirty || []).filter((d) => d === kind || d.startsWith(`${kind}.`));
    if (paths.includes(kind)) { out[kind] = clone(local[kind]); continue; }
    for (const d of paths) {
      const key = d.slice(kind.length + 1);
      if (local[kind] && key in local[kind]) base[key] = clone(local[kind][key]);
      else delete base[key];
    }
    out[kind] = kind === 'casement' ? syncGlassDeduction(base) : base;
  }
  return out;
}

const addDirty = (list, paths) => [...new Set([...(list || []), ...paths])];
/** The value at 'kind' or 'kind.firstKey' of a { sash, casement, door } state. */
const valueAt = (state, path) => {
  const [kind, key] = String(path).split('.');
  return key ? state?.[kind]?.[key] : state?.[kind];
};
let cloudSaveTimer = null;
let saveChain = Promise.resolve();
const scheduleCloudSave = (run) => {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(run, 800);
};

// Keep the stored casement deductions.glass in step with the stile face and
// glassInset (06.10.2026): it holds the WIDTH deduction, the readers take both
// deductions from casementGlassDeductions, and the stored copy must never
// disagree with them. The height deduction (top and bottom rails) is not stored.
function syncGlassDeduction(casement) {
  if (casement?.deductions && casement.geometry?.glassInset != null) {
    casement.deductions.glass = casementGlassDeduction(casement);
  }
  return casement;
}

// Door profile keys the Window Settings Doors card may write (setDoorPath):
// the first path segment must be one of these, and the last one must already
// exist in the profile, so a typo can never grow it. String-valued leaves are
// the hardware variant names; every other leaf is a finite number.
// Schema 3 (doors v3): fixedFan joins; sidePanel and panel carry nested keys
// (sidePanel.stile / top / bottom / depth, panel.inset, panel.edge.*).
// couplingPost stays writable for stored copies (not read by the engine).
const DOOR_PATH_ROOTS = ['frameDepth', 'leafDepth', 'leafDepthTriple', 'frenchLip', 'elements', 'geometry', 'deductions', 'cillInward', 'sidePanel', 'fixedFan', 'couplingPost', 'panel', 'hinges', 'hardware', 'lengths'];
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
        get()._edit(['sash.variants'], (s) => {
          const sash = clone(s.sash);
          if (!sash.variants[variantKey]) return {};
          sash.variants[variantKey][field] =
            field === 'label' ? String(value) : (Number(value) || 0);
          return { sash };
        });
      },

      setElementField: (elementKey, field, value) => {
        get()._edit(['sash.elements'], (s) => {
          const sash = clone(s.sash);
          if (!sash.elements[elementKey]) return {};
          sash.elements[elementKey][field] =
            field === 'raw' ? String(value) : (Number(value) || 0);
          return { sash };
        });
      },

      setGlassMakeup: (glassType, value) => {
        get()._edit(['sash.glassMakeup'], (s) => {
          const sash = clone(s.sash);
          sash.glassMakeup = { ...(sash.glassMakeup || {}), [glassType]: String(value) };
          return { sash };
        });
      },

      setHornExtension: (value) => {
        get()._edit(['sash.hornExtension'], (s) => {
          const sash = clone(s.sash);
          sash.hornExtension = Number(value) || 0;
          return { sash };
        });
      },

      setDeduction: (key, value) => {
        get()._edit(['sash.deductions'], (s) => {
          const sash = clone(s.sash);
          sash.deductions[key] = Number(value) || 0;
          return { sash };
        });
      },

      setCillTwoPiece: (twoPiece) => {
        get()._edit(['sash.cillTwoPiece'], (s) => ({ sash: { ...clone(s.sash), cillTwoPiece: !!twoPiece } }));
      },

      setCasementElementField: (elementKey, field, value) => {
        get()._edit(['casement.elements'], (s) => {
          const casement = clone(s.casement);
          if (!casement.elements[elementKey]) return {};
          casement.elements[elementKey][field] =
            field === 'raw' ? String(value) : (Number(value) || 0);
          return { casement: syncGlassDeduction(casement) };
        });
      },

      setCasementDeduction: (key, value) => {
        get()._edit(['casement.deductions'], (s) => {
          const casement = clone(s.casement);
          casement.deductions[key] = Number(value) || 0;
          return { casement: syncGlassDeduction(casement) };
        });
      },

      setCasementDepth: (value) => {
        get()._edit(['casement.depth'], (s) => ({ casement: { ...clone(s.casement), depth: Number(value) || 57 } }));
      },

      // ── v1.1 profile setters (Window Settings — Casement rebuild, 04.08) ──
      setCasementTopField: (key, value) => {
        if (!['frameDepth', 'leafDepth', 'leafDepthTriple'].includes(key)) return;
        get()._edit([`casement.${key}`], (s) => ({ casement: { ...clone(s.casement), [key]: Number(value) || 0 } }));
      },

      setCasementGeometry: (key, value) => {
        get()._edit(['casement.geometry'], (s) => {
          const casement = clone(s.casement);
          if (!casement.geometry || !(key in casement.geometry)) return {};
          casement.geometry[key] = Number(value) || 0;
          return { casement: syncGlassDeduction(casement) };
        });
      },

      setCasementLength: (key, value) => {
        get()._edit(['casement.lengths'], (s) => {
          const casement = clone(s.casement);
          if (!casement.lengths || !(key in casement.lengths)) return {};
          casement.lengths[key] = Number(value) || 0;
          return { casement };
        });
      },

      // Stiles and top rail share ONE width (Piotr 07.10.2026): one input, two
      // writes. The bottom rail has its own width (setCasementElementField
      // 'leafBottom'), so this setter never touches it.
      setCasementLeafFace: (value) => {
        get()._edit(['casement.elements'], (s) => {
          const casement = clone(s.casement);
          const v = Number(value) || 0;
          ['leafStile', 'leafTop'].forEach((k) => {
            if (casement.elements[k]) casement.elements[k].face = v;
          });
          return { casement: syncGlassDeduction(casement) };
        });
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
        get()._edit([`casement.${path[0]}`], (s) => {
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
        get()._edit(['casement.bsuite'], (s) => {
          const casement = clone(s.casement);
          casement.bsuite = { ...casement.bsuite, targets: clone(targets), activeTarget: ids.has(activeTarget) ? activeTarget : targets[0].id };
          return { casement };
        });
      },

      // Stock widths as a comma list ("63, 75, 95") → sorted positive numbers;
      // an empty or all-junk list is refused (the planner needs a board).
      setCasementStockWidths: (text) => {
        const widths = String(text ?? '').split(/[,\s;]+/).map(Number).filter((w) => Number.isFinite(w) && w > 0);
        if (!widths.length) return;
        const sorted = [...new Set(widths)].sort((a, b) => a - b);
        get()._edit(['casement.arch'], (s) => {
          const casement = clone(s.casement);
          if (!casement.arch) return {};
          casement.arch.stockWidths = sorted;
          return { casement };
        });
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
        get()._edit([`door.${path[0]}`], (s) => {
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
      },

      resetDoorToDefaults: () => {
        get()._edit(['door'], { door: clone(DEFAULT_DOOR_PROFILE) });
      },

      resetToDefaults: () => {
        get()._edit(['sash', 'casement'], { sash: clone(DEFAULT_SASH_PROFILE), casement: clone(DEFAULT_CASEMENT_PROFILE) });
      },

      // Paths changed since the last cloud load / save ('kind' or 'kind.firstKey'), plain data.
      dirty: [],

      // One edit: apply the updater, mark the given paths dirty when their value really
      // changed (a refused edit marks nothing), push to the engine, schedule the save.
      _edit: (paths, updater) => {
        const before = paths.map((p) => JSON.stringify(valueAt(get(), p)));
        set(updater);
        const changed = paths.filter((p, i) => JSON.stringify(valueAt(get(), p)) !== before[i]);
        if (changed.length) set({ dirty: addDirty(get().dirty, changed) });
        get()._sync();
      },

      _sync: () => {
        setActiveWindowProfile(get().sash);
        setActiveCasementProfile(get().casement);
        setActiveDoorProfile(get().door);
        if ((get().dirty || []).length) scheduleCloudSave(() => get().saveToCloud());
      },

      // Save the dirty paths: load the cloud copy, overlay ONLY the dirty paths
      // from memory, write the merged object, take it as the local copy. An
      // edit made while the save ran stays on top and stays dirty. A failed
      // load or write keeps every path dirty for the next save. Saves run one
      // after the other. Returns the merged object (null when nothing saved).
      saveToCloud: () => {
        clearTimeout(cloudSaveTimer);
        cloudSaveTimer = null;
        saveChain = saveChain.then(async () => {
          const dirty = [...(get().dirty || [])];
          if (!dirty.length) return null;
          const local = { sash: clone(get().sash), casement: clone(get().casement), door: clone(get().door) };
          let merged;
          try {
            const cloud = await cloudAdapter.load();
            merged = mergeWindowProfiles(cloud, local, dirty);
            const ok = await cloudAdapter.save(merged);
            if (ok === false) return null;
          } catch (err) {
            console.error('windowProfile saveToCloud', err);
            return null;
          }
          const now = get();
          const stillDirty = (now.dirty || []).filter((p) => !dirty.includes(p) || JSON.stringify(valueAt(now, p)) !== JSON.stringify(valueAt(local, p)));
          set({ ...mergeWindowProfiles(merged, now, stillDirty), dirty: stillDirty });
          setActiveWindowProfile(get().sash);
          setActiveCasementProfile(get().casement);
          setActiveDoorProfile(get().door);
          return merged;
        });
        return saveChain;
      },

      // Pull tenant profiles from the cloud: app start, entering Window
      // Settings, the tab coming back. Unsaved local paths stay on top.
      loadFromCloud: async () => {
        try {
          const cloud = await cloudAdapter.load();
          if (cloud?.sash || cloud?.casement || cloud?.door) {
            const local = { sash: get().sash, casement: get().casement, door: get().door };
            set(mergeWindowProfiles(cloud, local, get().dirty || []));
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
        // Tenant profile from Supabase wins over the local cache, but for the
        // paths this browser changed and has not saved yet (persisted `dirty`):
        // those stay on top and are saved now.
        setTimeout(async () => {
          await useWindowProfileStore.getState().loadFromCloud();
          if ((useWindowProfileStore.getState().dirty || []).length) useWindowProfileStore.getState().saveToCloud();
        }, 0);
      },
    }
  )
);

// Cold start before rehydrate: engine falls back to defaults inside profile.js

// The tab coming back (another computer may have saved meanwhile): reload,
// keeping this tab's unsaved paths on top (owner box item 20). Browser only.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') useWindowProfileStore.getState().loadFromCloud();
  });
}
