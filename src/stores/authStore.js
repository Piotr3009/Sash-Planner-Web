import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, hasSupabaseConfig } from '../services/supabase.js';
import { useProjectStore } from './projectStore.js';
import { useMaterialStore } from './materialStore.js';
import { useIronmongeryStore } from './ironmongeryStore.js';

function loadAllStores() {
  useProjectStore.getState().loadFromCloud();
  useMaterialStore.getState().loadFromCloud();
  useIronmongeryStore.getState().loadFromCloud();
}
function clearAllStores() {
  useProjectStore.getState().clearAll();
  useMaterialStore.getState().clearAll();
  useIronmongeryStore.getState().clearAll();
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
  session: null,
  loading: true,
  error: null,

  init: async () => {
    if (!hasSupabaseConfig) {
      set({ session: null, loading: false });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, loading: false });
    if (data.session) loadAllStores();
    supabase.auth.onAuthStateChange((_event, sess) => {
      set({ session: sess });
      if (sess) loadAllStores();
      else clearAllStores();
    });
  },

  signIn: async (email, password) => {
    set({ error: null });
    if (!hasSupabaseConfig) {
      const msg = 'Supabase not configured.';
      set({ error: msg });
      return { ok: false, error: msg };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }
    set({ session: data.session });
    clearAllStores();
    await loadAllStores();
    return { ok: true };
  },

  signOut: async () => {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut();
    }
    set({ session: null });
    clearAllStores();
  }
}),
    {
      name: 'sp-auth',
      partialize: (state) => ({
        session: state.session,
      }),
    }
  )
);