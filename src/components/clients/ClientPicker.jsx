import { useState, useRef, useEffect } from 'react';
import { useClientStore } from '../../stores/clientStore.js';
import ClientFormModal from './ClientFormModal.jsx';

// Dropdown bound to a client id. Lists existing clients + "+ New client…" which
// opens the shared form, creates the client, and selects it. onChange(id|null).
export default function ClientPicker({ value, onChange }) {
  const clients = useClientStore((s) => s.clients);
  const addClient = useClientStore((s) => s.addClient);
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = clients.find((c) => c.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input text-xs w-full flex items-center justify-between text-left"
      >
        <span className={selected ? 'text-ink-100 truncate' : 'text-ink-400'}>
          {selected ? selected.full_name : '— select client'}
        </span>
        <svg className="w-3 h-3 shrink-0 text-ink-400 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-700 border border-surface-500 rounded-lg shadow-xl py-1 max-h-[220px] overflow-y-auto">
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-surface-600 transition-colors ${!value ? 'text-accent-400 font-medium' : 'text-ink-300'}`}
            onClick={() => { onChange(null); setOpen(false); }}
          >
            — none
          </button>
          {clients.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-surface-600 transition-colors ${c.id === value ? 'text-accent-400 font-medium' : 'text-ink-200'}`}
              onClick={() => { onChange(c.id); setOpen(false); }}
            >
              {c.full_name}{c.company_name ? <span className="text-ink-400"> · {c.company_name}</span> : null}
            </button>
          ))}
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-[11px] text-accent-400 border-t border-surface-500 hover:bg-surface-600 transition-colors"
            onClick={() => { setModal(true); setOpen(false); }}
          >
            + New client…
          </button>
        </div>
      )}

      {modal && (
        <ClientFormModal
          onClose={() => setModal(false)}
          onSave={(data) => { const c = addClient(data); onChange(c.id); setModal(false); }}
        />
      )}
    </div>
  );
}
