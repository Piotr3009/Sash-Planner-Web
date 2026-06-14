import { useState } from 'react';
import ClientPicker from '../clients/ClientPicker.jsx';

// Shared estimate form. Collects title + optional client + notes and calls
// onSave(data); the parent decides create vs update (persists via estimateStore).
// Client is optional on purpose — a "no client estimate" is allowed.
export default function EstimateFormModal({ estimate, onSave, onClose }) {
  const [title, setTitle] = useState(estimate?.title || '');
  const [clientId, setClientId] = useState(estimate?.client_id || null);
  const [notes, setNotes] = useState(estimate?.notes || '');

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      client_id: clientId || null,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-ink-50 mb-3">{estimate ? 'Edit estimate' : 'New estimate'}</div>
        <div className="space-y-2">
          <Field label="Title *">
            <input className="input text-xs w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 14 Acacia Ave — front windows" autoFocus />
          </Field>
          <Field label="Client (optional)">
            <ClientPicker value={clientId} onChange={setClientId} />
            <p className="text-[10px] text-ink-500 mt-1">Leave empty for a quick quote with no client.</p>
          </Field>
          <Field label="Notes">
            <textarea className="input text-xs w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={submit} className="btn btn-primary text-xs px-4">{estimate ? 'Save' : 'Create estimate'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
