import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, hasSupabaseConfig } from '../services/supabase.js';
import { useProjectStore } from './projectStore.js';
import { useMaterialStore } from './materialStore.js';
import { useClientStore } from './clientStore.js';
import { useIronmongeryStore } from './ironmongeryStore.js';
import { useMaterialAssignmentStore } from './materialAssignmentStore.js';
import { clearTenantCache } from '../services/cloudSync.js';

function loadAllStores() {
  useProjectStore.getState().loadFromCloud();
  useClientStore.getState().loadFromCloud();
  useMaterialStore.getState().loadFromCloud();
  useIronmongeryStore.getState().loadFromCloud();
  useMaterialAssignmentStore.getState().loadFromCloud();
}
function clearAllStores() {
  clearTenantCache();
  useProjectStore.getState().clearAll();
  useClientStore.getState().clearAll();
  useMaterialStore.getState().clearAll();
  useIronmongeryStore.getState().clearAll();
  useMaterialAssignmentStore.getState().clearAll();
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

  changePassword: async (currentPassword, newPassword) => {
    if (!hasSupabaseConfig) return { ok: false, error: 'Supabase not configured.' };
    const email = get().session?.user?.email;
    if (!email) return { ok: false, error: 'No active session.' };
    // Re-verify the current password before allowing a change.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthErr) return { ok: false, error: 'Current password is incorrect.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
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