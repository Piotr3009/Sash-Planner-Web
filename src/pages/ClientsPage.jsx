import { useState, useMemo } from 'react';
import { useClientStore } from '../stores/clientStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import ClientFormModal from '../components/clients/ClientFormModal.jsx';

export default function ClientsPage() {
  const clients = useClientStore((s) => s.clients);
  const addClient = useClientStore((s) => s.addClient);
  const updateClient = useClientStore((s) => s.updateClient);
  const archiveClient = useClientStore((s) => s.archiveClient);
  const projects = useProjectStore((s) => s.projects);

  const [modal, setModal] = useState(null);          // null | {} (new) | client (edit)
  const [confirmArchive, setConfirmArchive] = useState(null);

  // How many projects point at each client.
  const projectCount = useMemo(() => {
    const m = {};
    projects.forEach((p) => { if (p.client_id) m[p.client_id] = (m[p.client_id] || 0) + 1; });
    return m;
  }, [projects]);

  const sorted = useMemo(
    () => [...clients].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')),
    [clients]
  );

  return (
    <div className="min-h-full bg-surface-800">
      <header className="border-b border-surface-500 bg-surface-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-50">Clients</h1>
          <p className="text-xs text-ink-400 mt-0.5">Client database · linked to projects</p>
        </div>
        <button className="btn btn-primary text-xs px-4" onClick={() => setModal({})}>+ New client</button>
      </header>

      <main className="max-w-[1100px] mx-auto p-6">
        {sorted.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-lg font-semibold text-ink-200 mb-2">No clients yet</div>
            <div className="text-sm text-ink-400 mb-5">Add your first client, then attach them to projects.</div>
            <button className="btn btn-primary text-xs px-4" onClick={() => setModal({})}>+ New client</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-900 text-ink-400">
                  <Th>Name</Th><Th>Company</Th><Th>Email</Th><Th>Phone</Th>
                  <Th className="text-center">Projects</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.id} className="border-t border-surface-500 hover:bg-surface-700/40 transition-colors">
                    <td className="px-4 py-3 text-ink-50 font-medium">
                      {c.full_name}
                      {c.jc_uuid ? <span className="ml-2 text-[10px] text-amber-400/90 border border-amber-700/50 rounded px-1 py-0.5">JC</span> : null}
                    </td>
                    <td className="px-4 py-3 text-ink-300">{c.company_name || '—'}</td>
                    <td className="px-4 py-3 text-ink-300">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-ink-300">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-accent-500/12 text-accent-400">{projectCount[c.id] || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button className="text-ink-300 hover:text-accent-400 mr-4 transition-colors" onClick={() => setModal(c)}>Edit</button>
                      <button className="text-ink-300 hover:text-red-400 transition-colors" onClick={() => setConfirmArchive(c)}>Archive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modal && (
        <ClientFormModal
          client={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.id) updateClient(modal.id, data);
            else addClient(data);
            setModal(null);
          }}
        />
      )}

      {confirmArchive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConfirmArchive(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-ink-50 mb-2">Archive client?</div>
            <div className="text-xs text-ink-300 mb-4">
              {confirmArchive.full_name} will be hidden from the list. Projects already linked keep their reference.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmArchive(null)} className="btn btn-secondary text-xs px-4">Cancel</button>
              <button
                onClick={() => { archiveClient(confirmArchive.id); setConfirmArchive(null); }}
                className="text-xs px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`text-left font-medium uppercase tracking-wider text-[10px] px-4 py-2.5 ${className}`}>{children}</th>;
}
