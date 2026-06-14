// cloudSync.js — bridges the in-memory project store to Supabase.
// The store keeps its nested shape (projects → batches → windows) in memory so
// components need no changes; this module loads that tree from the flat DB tables
// on login and pushes every mutation back to the cloud (scoped by user_id via RLS).
//
// All writes are best-effort and non-blocking: the in-memory state updates
// immediately (snappy UI), the DB call runs in the background. Failures are
// logged, not thrown, so the UI never breaks on a transient network error.

import { supabase, hasSupabaseConfig } from './supabase.js';

async function currentUserId() {
  if (!hasSupabaseConfig) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// The tenant (organization) the logged-in user belongs to. Everything is
// scoped to this, not to the individual user — so all members of a firm
// share the same data. Resolved from user_profiles.
let _tenantCache = null;
async function currentTenantId() {
  if (!hasSupabaseConfig) return null;
  if (_tenantCache) return _tenantCache;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('user_profiles').select('tenant_id').eq('id', uid).maybeSingle();
  if (error) { console.error('currentTenantId', error); return null; }
  _tenantCache = data?.tenant_id || null;
  return _tenantCache;
}

// Call on sign-out so the next user doesn't inherit the cached tenant.
export function clearTenantCache() { _tenantCache = null; }

const enabled = () => hasSupabaseConfig;

// ─────────────────────────────────────────────────────────────
// LOAD — pull the whole tree for the logged-in user from the DB
// and rebuild the nested shape the store/components expect.
// ─────────────────────────────────────────────────────────────
export async function loadAll() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;

  const [projectsRes, batchesRes, windowsRes, packsRes, settingsRes, clientsRes] = await Promise.all([
    supabase.from('projects').select('*').eq('archived', false).order('created_at', { ascending: true }),
    supabase.from('batches').select('*').order('created_at', { ascending: true }),
    supabase.from('windows').select('*').order('sort_order', { ascending: true }),
    supabase.from('production_packs').select('*').eq('archived', false).order('created_at', { ascending: true }),
    supabase.from('settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('clients').select('*').eq('archived', false),
  ]);

  if (projectsRes.error) { console.error('loadAll projects', projectsRes.error); return null; }

  const windowsByBatch = {};
  (windowsRes.data || []).forEach((w) => {
    (windowsByBatch[w.batch_id] = windowsByBatch[w.batch_id] || []).push(dbWindowToMem(w));
  });

  const batchesByProject = {};
  (batchesRes.data || []).forEach((b) => {
    const mem = dbBatchToMem(b);
    mem.windows = windowsByBatch[b.id] || [];
    (batchesByProject[b.project_id] = batchesByProject[b.project_id] || []).push(mem);
  });

  const clientsById = {};
  (clientsRes.data || []).forEach((c) => { clientsById[c.id] = c; });

  const projects = (projectsRes.data || []).map((p) => {
    const mem = dbProjectToMem(p, clientsById);
    mem.batches = batchesByProject[p.id] || [];
    return mem;
  });

  const productionPacks = (packsRes.data || []).map(dbPackToMem);

  const settings = settingsRes.data?.constants
    ? { ...(settingsRes.data.constants || {}), company: settingsRes.data.company || {} }
    : null;

  return { projects, productionPacks, settings };
}

// ─────────────────────────────────────────────────────────────
// MAPPERS — memory shape ↔ DB row shape
// ─────────────────────────────────────────────────────────────
function dbProjectToMem(p, clientsById) {
  return {
    id: p.id,
    name: p.name,
    project_number: p.project_number,
    client_id: p.client_id || null,
    client: (clientsById && p.client_id && clientsById[p.client_id]?.full_name) || '',
    address: p.address || '',
    status: p.status,
    created_at: p.created_at,
    batches: [],
  };
}

function dbBatchToMem(b) {
  return {
    id: b.id,
    project_id: b.project_id,
    type: b.type,
    label: b.defaults?._label || `Batch — ${b.type}`,
    status: b.status,
    defaults: b.defaults || {},
    windows: [],
    created_at: b.created_at,
  };
}

// Windows: common cols are columns; everything else lives in config jsonb.
function dbWindowToMem(w) {
  return {
    id: w.id,
    batch_id: w.batch_id,
    name: w.name,
    window_type: w.window_type,
    width: w.width,
    height: w.height,
    openingType: w.opening_type,
    glassFinish: w.glass_finish,
    woodColor: w.colour,
    ...(w.config || {}),  // all the rest (sashType, bars, horn, frame, specification…)
  };
}

function memWindowToDb(w, tenantId, batchId, sortOrder) {
  // Pull common fields into columns; stash the rest in config.
  const {
    id, batch_id, name, window_type, width, height, openingType, glassFinish, woodColor,
    ...rest
  } = w;
  return {
    id, tenant_id: tenantId, batch_id: batchId || batch_id,
    name, window_type: window_type || 'sash',
    width: width || null, height: height || null,
    opening_type: openingType || null,
    glass_finish: glassFinish || null,
    colour: woodColor || null,
    config: rest,
    sort_order: sortOrder ?? 0,
  };
}

function dbPackToMem(pp) {
  return {
    id: pp.id,
    name: pp.name,
    type: pp.type,
    deadline: pp.deadline || '',
    responsible: pp.responsible || '',
    status: pp.status,
    assignments: pp.assignments || [],
    precutSettings: pp.precut_settings || undefined,
    created_at: pp.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// WRITES — best-effort, non-blocking. Each returns a promise but
// callers don't await (fire-and-forget); errors are logged.
// ─────────────────────────────────────────────────────────────
function bg(promise, label) {
  if (!promise?.then) return;
  promise.then(({ error } = {}) => {
    if (error) console.error(`cloudSync ${label}`, error);
  }).catch((e) => console.error(`cloudSync ${label}`, e));
}

export async function saveProject(p) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  const uid = await currentUserId();
  if (!tenantId) return;
  bg(supabase.from('projects').upsert({
    id: p.id, tenant_id: tenantId, created_by: uid, name: p.name, project_number: p.project_number,
    client_id: p.client_id || null, address: p.address || null, status: p.status || 'preparation',
  }), 'saveProject');
}

export async function deleteProjectCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('projects').delete().eq('id', id), 'deleteProject');
}

// ─────────────────────────────────────────────────────────────
// CLIENTS — maps to clients table (tenant-scoped via RLS).
// ─────────────────────────────────────────────────────────────
function dbClientToMem(c) {
  return {
    id: c.id,
    full_name: c.full_name || '',
    company_name: c.company_name || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    notes: c.notes || '',
    jc_uuid: c.jc_uuid || '',
    archived: !!c.archived,
    created_at: c.created_at,
  };
}
function memClientToDb(c, tenantId) {
  return {
    id: c.id,
    tenant_id: tenantId,
    full_name: c.full_name || 'New Client',
    company_name: c.company_name || null,
    email: c.email || null,
    phone: c.phone || null,
    address: c.address || null,
    notes: c.notes || null,
    jc_uuid: c.jc_uuid || null,
    archived: !!c.archived,
  };
}
export async function loadClients() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('clients').select('*').eq('tenant_id', tenantId).eq('archived', false).order('full_name', { ascending: true });
  if (error) { console.error('loadClients', error); return null; }
  return (data || []).map(dbClientToMem);
}
export async function saveClient(c) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('clients').upsert(memClientToDb(c, tenantId)), 'saveClient');
}
export async function deleteClientCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('clients').delete().eq('id', id), 'deleteClient');
}

// ─────────────────────────────────────────────────────────────
// ACCOUNT / ORGANIZATION — read helpers for the Settings page.
// ─────────────────────────────────────────────────────────────
export async function getMyProfile() {
  if (!enabled()) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const { data: authData } = await supabase.auth.getUser();
  const email = authData?.user?.email || '';
  const { data, error } = await supabase.from('user_profiles').select('full_name, role').eq('id', uid).maybeSingle();
  if (error) { console.error('getMyProfile', error); return { email, full_name: '', role: '' }; }
  return { email, full_name: data?.full_name || '', role: data?.role || '' };
}
export async function saveMyProfile(patch) {
  if (!enabled()) return;
  const uid = await currentUserId();
  if (!uid) return;
  bg(supabase.from('user_profiles').update({ full_name: patch.full_name ?? null }).eq('id', uid), 'saveMyProfile');
}
export async function getMyOrg() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('organizations').select('name, plan, max_users').eq('id', tenantId).maybeSingle();
  if (error) { console.error('getMyOrg', error); return null; }
  return data ? { name: data.name || '', plan: data.plan || 'trial', max_users: data.max_users ?? null } : null;
}

export async function saveBatch(b, projectId) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  const defaults = { ...(b.defaults || {}), _label: b.label };
  bg(supabase.from('batches').upsert({
    id: b.id, tenant_id: tenantId, project_id: projectId || b.project_id,
    type: b.type, status: b.status || 'preparation', defaults,
  }), 'saveBatch');
}

export async function deleteBatchCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('batches').delete().eq('id', id), 'deleteBatch');
}

export async function saveWindow(w, batchId, sortOrder) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('windows').upsert(memWindowToDb(w, tenantId, batchId, sortOrder)), 'saveWindow');
}

export async function deleteWindowCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('windows').delete().eq('id', id), 'deleteWindow');
}

export async function savePack(pp) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('production_packs').upsert({
    id: pp.id, tenant_id: tenantId, name: pp.name, type: pp.type,
    status: pp.status || 'preparation', deadline: pp.deadline || null,
    responsible: pp.responsible || null,
    assignments: pp.assignments || [],
    precut_settings: pp.precutSettings || {},
  }), 'savePack');
}

export async function deletePackCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('production_packs').delete().eq('id', id), 'deletePack');
}

export async function saveSettings(settings) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  const { company, ...constants } = settings || {};
  bg(supabase.from('settings').upsert({
    tenant_id: tenantId, company: company || {}, constants,
  }, { onConflict: 'tenant_id' }), 'saveSettings');
}

// ─────────────────────────────────────────────────────────────
// MATERIALS — common cols + config jsonb (category/subcategory/
// color/unit live in config; they aren't dedicated columns).
// ─────────────────────────────────────────────────────────────
function memMaterialToDb(m, tenantId) {
  const { id, item_number, name, size, thickness, cost_per_unit, image_url, jc_uuid, notes,
    ...rest } = m;  // rest = category, subcategory, color, unit, created_at…
  return {
    id, tenant_id: tenantId, item_number: item_number || null, name,
    size: size || null,
    thickness: (thickness === '' || thickness == null) ? null : Number(thickness) || null,
    cost: cost_per_unit || null,
    photo_url: image_url || null,
    jc_uuid: jc_uuid || null, notes: notes || null,
    config: { category: rest.category, subcategory: rest.subcategory, color: rest.color, unit: rest.unit },
  };
}
function dbMaterialToMem(r) {
  const c = r.config || {};
  return {
    id: r.id, item_number: r.item_number || '', name: r.name,
    size: r.size || '', thickness: r.thickness ?? '',
    cost_per_unit: r.cost || 0, image_url: r.photo_url || '',
    jc_uuid: r.jc_uuid || '', notes: r.notes || '',
    category: c.category || 'consumables', subcategory: c.subcategory || '',
    color: c.color || '', unit: c.unit || 'pcs',
    created_at: r.created_at,
  };
}

export async function loadMaterials() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('materials').select('*').eq('tenant_id', tenantId).eq('archived', false).order('item_number', { ascending: true });
  if (error) { console.error('loadMaterials', error); return null; }
  return (data || []).map(dbMaterialToMem);
}
export async function saveMaterial(m) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('materials').upsert(memMaterialToDb(m, tenantId)), 'saveMaterial');
}
export async function deleteMaterialCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('materials').delete().eq('id', id), 'deleteMaterial');
}

// ─────────────────────────────────────────────────────────────
// IRONMONGERY — maps to ironmongery table.
// ─────────────────────────────────────────────────────────────
function memIronToDb(it, tenantId) {
  const { id, name, category, finish, size, is_pas24, auto_quantity, cost, cost_per_unit,
    image_url, jc_uuid, notes, ...rest } = it;
  return {
    id, tenant_id: tenantId, category: category || 'other', name,
    finish: finish || rest.color || null, size: size || null,
    is_pas24: !!is_pas24, auto_quantity: auto_quantity ?? null,
    cost: cost ?? cost_per_unit ?? null,
    photo_url: image_url || null, jc_uuid: jc_uuid || null, notes: notes || null,
  };
}
function dbIronToMem(r) {
  return {
    id: r.id, category: r.category, name: r.name, finish: r.finish || '',
    size: r.size || '', is_pas24: !!r.is_pas24, auto_quantity: r.auto_quantity ?? null,
    cost_per_unit: r.cost || 0, image_url: r.photo_url || '',
    jc_uuid: r.jc_uuid || '', notes: r.notes || '', created_at: r.created_at,
  };
}

export async function loadIronmongery() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('ironmongery').select('*').eq('tenant_id', tenantId).eq('archived', false).order('category', { ascending: true });
  if (error) { console.error('loadIronmongery', error); return null; }
  return (data || []).map(dbIronToMem);
}
export async function saveIron(it) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('ironmongery').upsert(memIronToDb(it, tenantId)), 'saveIron');
}
export async function deleteIronCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('ironmongery').delete().eq('id', id), 'deleteIron');
}

// ─────────────────────────────────────────────────────────────
// MATERIAL ASSIGNMENTS — small per-user map {part_id:{material_id,
// yield,…}}. Stored inside settings.constants.assignments (no own table).
// ─────────────────────────────────────────────────────────────
export async function loadAssignments() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('settings').select('constants').eq('tenant_id', tenantId).maybeSingle();
  if (error) { console.error('loadAssignments', error); return null; }
  return data?.constants?.assignments || {};
}

export async function saveAssignments(assignments) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  // Merge into existing constants so we don't clobber other settings.
  const { data } = await supabase.from('settings').select('company, constants').eq('tenant_id', tenantId).maybeSingle();
  const constants = { ...(data?.constants || {}), assignments: assignments || {} };
  bg(supabase.from('settings').upsert({
    tenant_id: tenantId, company: data?.company || {}, constants,
  }, { onConflict: 'tenant_id' }), 'saveAssignments');
}

// ─────────────────────────────────────────────────────────────
// ESTIMATES — maps to estimates table (tenant-scoped via RLS).
// items/extras/totals are stored as jsonb; client_id may be null.
// ─────────────────────────────────────────────────────────────
function dbEstimateToMem(e) {
  return {
    id: e.id,
    client_id: e.client_id || null,
    estimate_number: e.estimate_number || '',
    title: e.title || '',
    status: e.status || 'draft',
    items: Array.isArray(e.items) ? e.items : [],
    extras: Array.isArray(e.extras) ? e.extras : [],
    totals: e.totals || { ex_vat: 0, vat: 0, inc_vat: 0 },
    notes: e.notes || '',
    archived: !!e.archived,
    project_id: e.project_id || null,
    created_at: e.created_at,
  };
}
function memEstimateToDb(e, tenantId, createdBy) {
  return {
    id: e.id,
    tenant_id: tenantId,
    created_by: createdBy || null,
    client_id: e.client_id || null,
    estimate_number: e.estimate_number || null,
    title: e.title || 'Untitled estimate',
    status: e.status || 'draft',
    items: Array.isArray(e.items) ? e.items : [],
    extras: Array.isArray(e.extras) ? e.extras : [],
    totals: e.totals || {},
    notes: e.notes || null,
    archived: !!e.archived,
    project_id: e.project_id || null,
    updated_at: new Date().toISOString(),
  };
}
export async function loadEstimates() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('estimates')
    .select('*').eq('tenant_id', tenantId).eq('archived', false)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadEstimates', error); return null; }
  return (data || []).map(dbEstimateToMem);
}
export async function saveEstimate(e) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  const uid = await currentUserId();
  if (!tenantId) return;
  bg(supabase.from('estimates').upsert(memEstimateToDb(e, tenantId, uid)), 'saveEstimate');
}
export async function deleteEstimateCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('estimates').delete().eq('id', id), 'deleteEstimate');
}

// ─────────────────────────────────────────────────────────────
// PRICING SETTINGS — one row per tenant; all editable rates in `config`.
// Returns null when the tenant has no row yet (engine uses DEFAULT_PRICING).
// ─────────────────────────────────────────────────────────────
export async function loadPricingSettings() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('pricing_settings')
    .select('config').eq('tenant_id', tenantId).maybeSingle();
  if (error) { console.error('loadPricingSettings', error); return null; }
  return data?.config || null;
}
export async function savePricingSettings(config) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('pricing_settings').upsert({
    tenant_id: tenantId, config: config || {}, updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' }), 'savePricingSettings');
}

// ─────────────────────────────────────────────────────────────
// ESTIMATE PDF SETTINGS — one row per tenant (accent colour, terms, payment).
// Logo is reused from settings.company (not stored here).
// ─────────────────────────────────────────────────────────────
export async function loadEstimatePdfSettings() {
  if (!enabled()) return null;
  const tenantId = await currentTenantId();
  if (!tenantId) return null;
  const { data, error } = await supabase.from('estimate_pdf_settings')
    .select('accent_color, terms_text, payment_terms').eq('tenant_id', tenantId).maybeSingle();
  if (error) { console.error('loadEstimatePdfSettings', error); return null; }
  return data || null;
}
export async function saveEstimatePdfSettings(s) {
  if (!enabled()) return;
  const tenantId = await currentTenantId();
  if (!tenantId) return;
  bg(supabase.from('estimate_pdf_settings').upsert({
    tenant_id: tenantId,
    accent_color: s.accent_color || '#0A1628',
    terms_text: s.terms_text || null,
    payment_terms: s.payment_terms || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' }), 'saveEstimatePdfSettings');
}
