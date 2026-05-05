import { create } from 'zustand';
import { supabase, hasSupabaseConfig } from '../services/supabase.js';

const MOCK_SESSION = {
  user: { id: 'mock-user', email: 'demo@sashplanner.local' },
  mock: true
};

export const useAuthStore = create((set, get) => ({
  session: null,
  loading: true,
  error: null,

  init: async () => {
    // Don't wipe an existing session (e.g. mock session already set)
    if (get().session) {
      set({ loading: false });
      return;
    }
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
      set({ session: MOCK_SESSION });
      return { ok: true, mock: true };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }
    set({ session: data.session });
    return { ok: true };
  },

  signInWithMockData: () => {
    set({ session: MOCK_SESSION, error: null });
  },

  signOut: async () => {
    if (hasSupabaseConfig && !get().session?.mock) {
      await supabase.auth.signOut();
    }
    set({ session: null });
  }
}));