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

const enabled = () => hasSupabaseConfig;

// ─────────────────────────────────────────────────────────────
// LOAD — pull the whole tree for the logged-in user from the DB
// and rebuild the nested shape the store/components expect.
// ─────────────────────────────────────────────────────────────
export async function loadAll() {
  if (!enabled()) return null;
  const uid = await currentUserId();
  if (!uid) return null;

  const [projectsRes, batchesRes, windowsRes, packsRes, settingsRes] = await Promise.all([
    supabase.from('projects').select('*').eq('archived', false).order('created_at', { ascending: true }),
    supabase.from('batches').select('*').order('created_at', { ascending: true }),
    supabase.from('windows').select('*').order('sort_order', { ascending: true }),
    supabase.from('production_packs').select('*').eq('archived', false).order('created_at', { ascending: true }),
    supabase.from('settings').select('*').eq('user_id', uid).maybeSingle(),
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

  const projects = (projectsRes.data || []).map((p) => {
    const mem = dbProjectToMem(p);
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
function dbProjectToMem(p) {
  return {
    id: p.id,
    name: p.name,
    project_number: p.project_number,
    client: p.client_id || '',
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

function memWindowToDb(w, userId, batchId, sortOrder) {
  // Pull common fields into columns; stash the rest in config.
  const {
    id, batch_id, name, window_type, width, height, openingType, glassFinish, woodColor,
    ...rest
  } = w;
  return {
    id, user_id: userId, batch_id: batchId || batch_id,
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
  const uid = await currentUserId();
  if (!uid) return;
  bg(supabase.from('projects').upsert({
    id: p.id, user_id: uid, name: p.name, project_number: p.project_number,
    client_id: null, address: p.address || null, status: p.status || 'preparation',
  }), 'saveProject');
}

export async function deleteProjectCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('projects').delete().eq('id', id), 'deleteProject');
}

export async function saveBatch(b, projectId) {
  if (!enabled()) return;
  const uid = await currentUserId();
  if (!uid) return;
  const defaults = { ...(b.defaults || {}), _label: b.label };
  bg(supabase.from('batches').upsert({
    id: b.id, user_id: uid, project_id: projectId || b.project_id,
    type: b.type, status: b.status || 'preparation', defaults,
  }), 'saveBatch');
}

export async function deleteBatchCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('batches').delete().eq('id', id), 'deleteBatch');
}

export async function saveWindow(w, batchId, sortOrder) {
  if (!enabled()) return;
  const uid = await currentUserId();
  if (!uid) return;
  bg(supabase.from('windows').upsert(memWindowToDb(w, uid, batchId, sortOrder)), 'saveWindow');
}

export async function deleteWindowCloud(id) {
  if (!enabled()) return;
  bg(supabase.from('windows').delete().eq('id', id), 'deleteWindow');
}

export async function savePack(pp) {
  if (!enabled()) return;
  const uid = await currentUserId();
  if (!uid) return;
  bg(supabase.from('production_packs').upsert({
    id: pp.id, user_id: uid, name: pp.name, type: pp.type,
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
  const uid = await currentUserId();
  if (!uid) return;
  const { company, ...constants } = settings || {};
  bg(supabase.from('settings').upsert({
    user_id: uid, company: company || {}, constants,
  }, { onConflict: 'user_id' }), 'saveSettings');
}
