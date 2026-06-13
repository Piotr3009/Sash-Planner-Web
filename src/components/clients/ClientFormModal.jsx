import { useState } from 'react';

// Shared client form. Collects data and calls onSave(data); the parent decides
// whether to create or update (and persists via clientStore).
export default function ClientFormModal({ client, onSave, onClose }) {
  const [fullName, setFullName] = useState(client?.full_name || '');
  const [company, setCompany] = useState(client?.company_name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [address, setAddress] = useState(client?.address || '');
  const [notes, setNotes] = useState(client?.notes || '');

  const submit = () => {
    if (!fullName.trim()) return;
    onSave({
      full_name: fullName.trim(),
      company_name: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
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
        <div className="text-sm font-semibold text-ink-50 mb-3">{client ? 'Edit client' : 'New client'}</div>
        <div className="space-y-2">
          <Field label="Name *">
            <input className="input text-xs w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </Field>
          <Field label="Company">
            <input className="input text-xs w-full" value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Email">
              <input className="input text-xs w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input text-xs w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Address">
            <input className="input text-xs w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className="input text-xs w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={submit} className="btn btn-primary text-xs px-4">{client ? 'Save' : 'Add client'}</button>
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
