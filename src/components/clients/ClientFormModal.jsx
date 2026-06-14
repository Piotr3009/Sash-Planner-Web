import { useState } from 'react';

const TYPE_OPTIONS = ['', 'one-time', 'vip'];
const SOURCE_OPTIONS = ['', 'referral', 'google', 'facebook', 'other'];

// Shared client form. Collects data and calls onSave(data); the parent decides
// whether to create or update (and persists via clientStore).
// Fields mirror the JC client export so import/export stays 1:1.
export default function ClientFormModal({ client, onSave, onClose }) {
  const [fullName, setFullName] = useState(client?.full_name || '');
  const [company, setCompany] = useState(client?.company_name || '');
  const [clientNumber, setClientNumber] = useState(client?.client_number || '');
  const [vatNumber, setVatNumber] = useState(client?.vat_number || '');
  const [type, setType] = useState(client?.type || '');
  const [source, setSource] = useState(client?.source || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [address, setAddress] = useState(client?.address || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [contacts, setContacts] = useState(Array.isArray(client?.contacts) ? client.contacts : []);

  const addContact = () => setContacts([...contacts, { name: '', position: '', email: '', phone: '' }]);
  const updateContact = (i, k, v) => setContacts(contacts.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const removeContact = (i) => setContacts(contacts.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!fullName.trim()) return;
    onSave({
      full_name: fullName.trim(),
      company_name: company.trim(),
      client_number: clientNumber.trim(),
      vat_number: vatNumber.trim(),
      type,
      source,
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
      // keep only rows with something filled in
      contacts: contacts
        .map((c) => ({ name: (c.name || '').trim(), position: (c.position || '').trim(), email: (c.email || '').trim(), phone: (c.phone || '').trim() }))
        .filter((c) => c.name || c.email || c.phone),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-lg w-full mx-4 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-ink-50 mb-3">{client ? 'Edit client' : 'New client'}</div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name *">
              <input className="input text-xs w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
            </Field>
            <Field label="Company">
              <input className="input text-xs w-full" value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Client #">
              <input className="input text-xs w-full" placeholder="CL022/2026" value={clientNumber} onChange={(e) => setClientNumber(e.target.value)} />
            </Field>
            <Field label="VAT number">
              <input className="input text-xs w-full" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select className="input text-xs w-full" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select className="input text-xs w-full" value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Email">
              <input className="input text-xs w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input text-xs w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>

          <Field label="Address">
            <textarea className="input text-xs w-full" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          {/* Contacts list (one company, several people — matches JC) */}
          <div className="border-t border-surface-600 pt-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-ink-400 uppercase tracking-wider">Contacts</span>
              <button onClick={addContact} className="text-[11px] text-accent-400 hover:text-accent-300 transition-colors">+ Add contact</button>
            </div>
            {contacts.length === 0 && <div className="text-[10px] text-ink-500 italic mb-1">No extra contacts.</div>}
            {contacts.map((ct, i) => (
              <div key={i} className="border border-surface-600 rounded-lg p-2 mb-1.5 bg-surface-900/40">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                  <input className="input text-xs w-full" placeholder="Name" value={ct.name} onChange={(e) => updateContact(i, 'name', e.target.value)} />
                  <input className="input text-xs w-full" placeholder="Position" value={ct.position} onChange={(e) => updateContact(i, 'position', e.target.value)} />
                  <button onClick={() => removeContact(i)} aria-label="Remove contact" className="text-ink-400 hover:text-status-danger px-2 py-1 transition-colors text-base leading-none">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <input className="input text-xs w-full" placeholder="Email" value={ct.email} onChange={(e) => updateContact(i, 'email', e.target.value)} />
                  <input className="input text-xs w-full" placeholder="Phone" value={ct.phone} onChange={(e) => updateContact(i, 'phone', e.target.value)} />
                </div>
              </div>
            ))}
          </div>

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
