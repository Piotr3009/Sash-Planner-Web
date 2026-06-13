import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore.js';
import { useClientStore } from '../stores/clientStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useIronmongeryStore } from '../stores/ironmongeryStore.js';
import { useMaterialAssignmentStore } from '../stores/materialAssignmentStore.js';
import { useAuthStore } from '../stores/authStore.js';
import * as cloud from '../services/cloudSync.js';

// Placeholder pricing — PC's usage-based model isn't finalised. Edit here when set.
const PLANS = [
  { key: 'solo',  name: 'Solo',  price: 19,  users: '1 user' },
  { key: 'small', name: 'Small', price: 49,  users: 'Up to 5 users' },
  { key: 'basic', name: 'Basic', price: 149, users: 'Up to 15 users' },
  { key: 'pro',   name: 'Pro',   price: 249, users: 'Up to 30 users' },
];

const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro' },
  { code: 'USD', symbol: '$', label: 'USD — US Dollar' },
];

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'company', label: 'Company', admin: true },
  { id: 'billing', label: 'Billing' },
  { id: 'data',    label: 'Your Data' },
  { id: 'about',   label: 'About' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('account');

  return (
    <div className="min-h-full bg-surface-800">
      <header className="border-b border-surface-500 bg-surface-900 px-6 py-4">
        <h1 className="text-xl font-bold text-ink-50 flex items-center gap-2">
          <Gear /> Settings
        </h1>
      </header>

      {/* Tabs */}
      <div className="border-b border-surface-500 bg-surface-900 px-6">
        <div className="max-w-[820px] mx-auto flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative py-3 text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                tab === t.id ? 'text-accent-400 font-medium' : 'text-ink-300 hover:text-ink-100'
              }`}
            >
              {t.label}
              {t.admin && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-600/40 rounded px-1 py-0.5">ADMIN</span>}
              {tab === t.id && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent-400 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[820px] mx-auto p-6">
        {tab === 'account' && <AccountTab />}
        {tab === 'company' && <CompanyTab />}
        {tab === 'billing' && <BillingTab />}
        {tab === 'data' && <DataTab />}
        {tab === 'about' && <AboutTab />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ACCOUNT
// ─────────────────────────────────────────────────────────────
function AccountTab() {
  const session = useAuthStore((s) => s.session);
  const changePassword = useAuthStore((s) => s.changePassword);

  const [profile, setProfile] = useState({ email: '', full_name: '', role: '' });
  const [fullName, setFullName] = useState('');
  const [nameMsg, setNameMsg] = useState('');

  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    let on = true;
    cloud.getMyProfile().then((p) => { if (on && p) { setProfile(p); setFullName(p.full_name || ''); } });
    return () => { on = false; };
  }, []);

  const saveName = async () => {
    await cloud.saveMyProfile({ full_name: fullName.trim() });
    setNameMsg('Saved');
    setTimeout(() => setNameMsg(''), 2000);
  };

  const submitPw = async () => {
    setPwMsg(null);
    if (nw.length < 6) { setPwMsg({ ok: false, text: 'New password must be at least 6 characters.' }); return; }
    if (nw !== cf) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    setPwBusy(true);
    const res = await changePassword(cur, nw);
    setPwBusy(false);
    if (res.ok) { setPwMsg({ ok: true, text: 'Password changed.' }); setCur(''); setNw(''); setCf(''); }
    else setPwMsg({ ok: false, text: res.error || 'Could not change password.' });
  };

  const email = session?.user?.email || profile.email || '';

  return (
    <div className="space-y-5">
      <Section title="Your Account">
        <FieldRO label="Email Address" value={email} />
        <div>
          <Label>Full Name</Label>
          <div className="flex gap-2">
            <input className="input text-sm flex-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <button className="btn btn-primary text-xs px-4" onClick={saveName}>Save</button>
          </div>
          {nameMsg && <div className="text-[11px] text-accent-400 mt-1">{nameMsg}</div>}
        </div>
        <FieldRO label="Role" value={profile.role || '—'} />
      </Section>

      <Section title="Change Password">
        <div><Label>Current Password</Label><PasswordInput value={cur} onChange={setCur} placeholder="Enter your current password" /></div>
        <div><Label>New Password</Label><PasswordInput value={nw} onChange={setNw} placeholder="Min 6 characters" /></div>
        <div><Label>Confirm New Password</Label><PasswordInput value={cf} onChange={setCf} placeholder="Repeat new password" /></div>
        {pwMsg && <div className={`text-[11px] ${pwMsg.ok ? 'text-accent-400' : 'text-red-400'}`}>{pwMsg.text}</div>}
        <button className="btn btn-primary text-xs px-4 disabled:opacity-50" onClick={submitPw} disabled={pwBusy}>
          {pwBusy ? 'Saving…' : '🔒 Change Password'}
        </button>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPANY
// ─────────────────────────────────────────────────────────────
function CompanyTab() {
  const settings = useProjectStore((s) => s.settings);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const c = settings.company || {};

  const [companyName, setCompanyName] = useState(c.companyName || '');
  const [address, setAddress] = useState(c.companyAddress || '');
  const [phone, setPhone] = useState(c.companyPhone || '');
  const [email, setEmail] = useState(c.companyEmail || '');
  const [vat, setVat] = useState(c.vat || '');
  const [currency, setCurrency] = useState(c.currency || 'GBP');
  const [logo, setLogo] = useState(c.logo || '');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setLogo(await fileToResizedDataURL(file, 400)); } catch { /* ignore */ }
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = () => {
    updateSettings({
      company: {
        ...c,
        companyName: companyName.trim(),
        companyAddress: address.trim(),
        companyPhone: phone.trim(),
        companyEmail: email.trim(),
        vat: vat.trim(),
        currency,
        logo,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sym = CURRENCIES.find((x) => x.code === currency)?.symbol || '£';

  return (
    <div className="space-y-5">
      <Section title="Company Branding">
        <Label>Company Logo</Label>
        <div className="flex items-center gap-4">
          <div className="w-[120px] h-[60px] rounded-lg border border-dashed border-surface-500 bg-surface-900 flex items-center justify-center overflow-hidden shrink-0">
            {logo ? <img src={logo} alt="logo" className="max-w-full max-h-full object-contain" /> : <span className="text-[11px] text-ink-400">No logo</span>}
          </div>
          <div>
            <div className="flex gap-2">
              <button className="btn btn-secondary text-xs px-3" onClick={() => fileRef.current?.click()}>Upload Logo</button>
              {logo && <button className="text-xs px-3 py-1.5 rounded-lg border border-surface-500 text-ink-300 hover:text-red-400" onClick={() => setLogo('')}>Remove</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
            <div className="text-[11px] text-ink-400 mt-1.5 leading-snug">PNG/JPG, auto-resized. Shown top-left on every PDF.</div>
          </div>
        </div>
      </Section>

      <Section title="Company Details">
        <div><Label>Company Name</Label><input className="input text-sm w-full" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Prime Sash Windows Ltd" /></div>
        <div><Label>Address</Label><textarea className="input text-sm w-full" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, Postcode" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><input className="input text-sm w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 …" /></div>
          <div><Label>Email</Label><input className="input text-sm w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" /></div>
        </div>
        <div><Label>VAT Number <span className="text-ink-400 normal-case">(optional)</span></Label><input className="input text-sm w-full" value={vat} onChange={(e) => setVat(e.target.value)} placeholder="e.g. GB123456789" /></div>
      </Section>

      <Section title="Currency">
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <Label>Currency Code</Label>
            <select className="input text-sm w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Symbol Preview</Label>
            <div className="w-12 h-9 rounded-lg border border-surface-500 bg-surface-900 flex items-center justify-center text-ink-100 text-lg">{sym}</div>
          </div>
        </div>
        <div className="text-[11px] text-ink-400">Stored for future use — does not reformat existing £ figures across the app yet.</div>
      </Section>

      <div className="flex justify-end items-center gap-3">
        {saved && <span className="text-[11px] text-accent-400">Saved</span>}
        <button className="btn btn-primary text-sm px-5" onClick={save}>Save</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BILLING (read-only — checkout not wired)
// ─────────────────────────────────────────────────────────────
function BillingTab() {
  const [org, setOrg] = useState(null);
  useEffect(() => { let on = true; cloud.getMyOrg().then((o) => { if (on) setOrg(o); }); return () => { on = false; }; }, []);

  const planKey = (org?.plan || '').toLowerCase();
  const currentPlan = PLANS.find((p) => p.key === planKey);

  return (
    <div className="space-y-5">
      <Section title="Your Plan">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider bg-surface-600 text-ink-50 rounded px-2.5 py-1">{currentPlan?.name || org?.plan || 'TRIAL'}</span>
          <span className="text-xs text-accent-400">Active</span>
        </div>
        <div className="text-xs text-ink-300">Max users: <span className="text-ink-50 font-medium">{org?.max_users ?? '—'}</span></div>
      </Section>

      <Section title="Choose a Plan">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLANS.map((p) => {
            const isCurrent = p.key === planKey;
            return (
              <div key={p.key} className={`rounded-xl border p-4 text-center ${isCurrent ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-surface-500 bg-surface-900'}`}>
                <div className="text-sm font-bold text-ink-50">{p.name}</div>
                <div className="text-xl font-bold text-accent-400 mt-1">£{p.price}<span className="text-[11px] text-ink-400 font-normal">/mo</span></div>
                <div className="text-[11px] text-ink-400 mt-1">{p.users}</div>
                {isCurrent && <div className="text-[11px] text-emerald-400 mt-1.5">✓ Current plan</div>}
              </div>
            );
          })}
        </div>
        <div className="text-center text-[11px] text-ink-400">+ VAT where applicable · placeholder pricing</div>
        <button className="w-full py-2.5 rounded-lg bg-surface-600 text-ink-400 text-sm cursor-not-allowed" disabled title="Billing not yet available">
          Manage Subscription — coming soon
        </button>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// YOUR DATA (export works; delete is a safe stub)
// ─────────────────────────────────────────────────────────────
function DataTab() {
  const signOut = useAuthStore((s) => s.signOut);
  const [confirmText, setConfirmText] = useState('');

  const exportData = () => {
    const ps = useProjectStore.getState();
    const data = {
      exported_at: new Date().toISOString(),
      app: 'Production Core',
      projects: ps.projects,
      productionPacks: ps.productionPacks,
      settings: ps.settings,
      clients: useClientStore.getState().clients,
      materials: useMaterialStore.getState().materials,
      ironmongery: useIronmongeryStore.getState().items,
      assignments: useMaterialAssignmentStore.getState().assignments,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-core-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestDelete = () => {
    // Safe stub — real deletion needs a server-side cascade (auth user + tenant data).
    alert('Account deletion is handled manually for now. You will be signed out; contact piotr@joinerycore.com to complete removal.');
    signOut();
  };

  return (
    <div className="space-y-6">
      <Section title="Export Your Data">
        <div className="text-sm text-ink-300">Download all your data in JSON format — projects, clients, materials, ironmongery, production packs and settings.</div>
        <button className="text-sm px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors" onClick={exportData}>
          Export All Data
        </button>
        <div className="text-[11px] text-ink-400">File attachments / images are not included in the export.</div>
      </Section>

      <Section title="Delete Account" danger>
        <div className="text-sm text-ink-300">Permanently delete your account and all associated data. This action cannot be undone.</div>
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-xs text-ink-300">
          <div className="text-red-400 font-semibold mb-2">⚠ Warning: deleting your account will permanently remove:</div>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>All projects (active, pipeline and archived)</li>
            <li>All client information</li>
            <li>All materials, ironmongery and stock data</li>
            <li>All uploaded files and documents</li>
            <li>All settings and company details</li>
          </ul>
        </div>
        <div>
          <Label>Type DELETE to confirm</Label>
          <input className="input text-sm w-full max-w-xs" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
        </div>
        <button
          className="text-sm px-4 py-2 rounded-lg bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          disabled={confirmText !== 'DELETE'}
          onClick={requestDelete}
        >
          Delete My Account
        </button>
      </Section>

      <Section title="Your Rights">
        <div className="text-sm text-ink-300">
          Under UK GDPR, you have the right to access, rectify and delete your personal data. For any data-related requests, contact{' '}
          <a className="text-blue-400 hover:underline" href="mailto:piotr@joinerycore.com">piotr@joinerycore.com</a>.
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABOUT (static)
// ─────────────────────────────────────────────────────────────
const FEATURES = [
  { t: 'Production Planning', d: 'Batches, production packs and cut lists for sash, casement and door joinery.' },
  { t: 'Project Management', d: 'Track projects from client through batches to production-ready drawings.' },
  { t: '3D Configurator', d: 'Parametric sash window model driving every cut, glass and ironmongery figure.' },
  { t: 'Materials & BOM', d: 'Material catalogue, per-window assignments and merged purchase lists.' },
];

function AboutTab() {
  return (
    <div className="space-y-6">
      <div className="text-center pt-2">
        <div className="inline-block bg-surface-900 border border-surface-500 rounded-lg px-5 py-3 text-accent-400 font-bold tracking-[0.15em] text-sm">PRODUCTION CORE</div>
        <div className="text-2xl font-bold text-ink-50 mt-4">Production Core</div>
        <div className="text-sm text-ink-300">Joinery Production Management</div>
        <div className="text-[11px] text-ink-400 mt-0.5">Version 1.0</div>
      </div>

      <Section title="About">
        <div className="text-sm text-ink-300 leading-relaxed">
          Production Core is a production-management tool for sash-window and joinery workshops. It turns each window
          into precise cut lists, glass schedules, ironmongery and BOMs, then groups batches into production packs for the workshop floor.
        </div>
      </Section>

      <Section title="Key Features">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-lg border border-surface-500 bg-surface-900 p-4">
              <div className="text-sm font-semibold text-accent-400">{f.t}</div>
              <div className="text-xs text-ink-300 mt-1 leading-snug">{f.d}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────
function Section({ title, children, danger }) {
  return (
    <div className="card p-5">
      <div className={`text-sm font-semibold mb-3 pb-2 border-b border-surface-500 ${danger ? 'text-red-400' : 'text-ink-50'}`}>{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Label({ children }) {
  return <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">{children}</label>;
}
function FieldRO({ label, value }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="input text-sm w-full text-ink-400 select-text">{value || '—'}</div>
    </div>
  );
}
function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="input text-sm w-full pr-9"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-100 text-xs">
        {show ? 'hide' : 'show'}
      </button>
    </div>
  );
}
function Gear() {
  return (
    <svg className="w-5 h-5 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// Read a file → downscaled PNG data URL (keeps the settings row small; no upload server).
function fileToResizedDataURL(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
