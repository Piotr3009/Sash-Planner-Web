import { create } from 'zustand';
import * as cloud from '../services/cloudSync.js';

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const useClientStore = create((set, get) => ({
  clients: [],
  clientsLoaded: false,
  archivedClients: [],
  archivedLoaded: false,

  setClients: (clients) => set({ clients, clientsLoaded: true }),

  // Resolve a client by id (helper for project display / pickers). Not a getter.
  getClient: (id) => get().clients.find((c) => c.id === id) || null,

  // ─── CRUD ───
  addClient: (data) => {
    const client = {
      id: uid(),
      full_name: (data.full_name || '').trim() || 'New Client',
      company_name: (data.company_name || '').trim(),
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      address: (data.address || '').trim(),
      notes: (data.notes || '').trim(),
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      client_number: (data.client_number || '').trim(),
      vat_number: (data.vat_number || '').trim(),
      type: data.type || '',
      source: data.source || '',
      jc_uuid: data.jc_uuid || '',
      archived: false,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ clients: [...s.clients, client] }));
    cloud.saveClient(client);
    return client;
  },

  updateClient: (id, patch) => {
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    const c = get().clients.find((x) => x.id === id);
    if (c) cloud.saveClient(c);
  },

  // Soft-delete: flag archived in the cloud, drop from the in-memory list.
  archiveClient: (id) => {
    const c = get().clients.find((x) => x.id === id);
    if (c) cloud.saveClient({ ...c, archived: true });
    set((s) => ({ clients: s.clients.filter((x) => x.id !== id) }));
  },

  // Load the archived list on demand (for the "Archived" view).
  loadArchived: async () => {
    const data = await cloud.loadArchivedClients();
    set({ archivedClients: data || [], archivedLoaded: true });
  },

  // Restore an archived client back into the active list.
  restoreClient: (id) => {
    const c = get().archivedClients.find((x) => x.id === id);
    if (c) cloud.saveClient({ ...c, archived: false });
    set((s) => ({
      archivedClients: s.archivedClients.filter((x) => x.id !== id),
      clients: c ? [...s.clients, { ...c, archived: false }] : s.clients,
    }));
  },

  // ─── CLOUD ───
  loadFromCloud: async () => {
    const data = await cloud.loadClients();
    if (data) set({ clients: data, clientsLoaded: true });
    else set({ clientsLoaded: true });
  },
  clearAll: () => set({ clients: [], clientsLoaded: false }),
}));
