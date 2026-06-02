import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, hasSupabaseConfig } from '../services/supabase.js';

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
    supabase.auth.onAuthStateChange((_event, sess) => set({ session: sess }));
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
    return { ok: true };
  },

  signOut: async () => {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut();
    }
    set({ session: null });
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