// moveToProduction.js — turns a "won" estimate into a production project.
//
// Windows already carry their full config (no batch defaults needed), so each
// type just becomes a clean batch and every window keeps its own settings.
// The £/window production charge is part of the future billing system and is
// not applied here.

// Estimate window category → production batch type.
const CATEGORY_TO_BATCH = {
  sash: 'sash',
  casement: 'casement',
  door: 'door',
  fix: 'fix-frame',
  'fix-frame': 'fix-frame',
};

// Pure helper that plans the batches (used for the confirm summary).
export function planProduction(estimate) {
  const items = estimate?.items || [];
  const groups = {};
  items.forEach((it) => {
    const cat = (it.config?.windowCategory || 'sash').toLowerCase();
    const type = CATEGORY_TO_BATCH[cat] || 'sash';
    (groups[type] = groups[type] || []).push(it);
  });
  return { windowCount: items.length, batchCount: Object.keys(groups).length, groups };
}

/**
 * moveToProduction(estimate, store)
 *   store: { createProject, createBatch, addWindowToBatch, updateEstimate, clientName }
 * Returns the created project, or null if there's nothing to move / already moved.
 */
export function moveToProduction(estimate, store) {
  const { createProject, createBatch, addWindowToBatch, updateEstimate, clientName } = store;
  const items = estimate?.items || [];
  if (!items.length || estimate.project_id) return null;

  // 1. Create the project from the estimate.
  const project = createProject(
    estimate.title || estimate.estimate_number || 'New Project',
    '',
    null,
    estimate.client_id || null,
    clientName || ''
  );

  // 2. Group windows by type, one batch per type.
  const { groups } = planProduction(estimate);
  Object.entries(groups).forEach(([type, groupItems]) => {
    const batch = createBatch(project.id, type);
    if (!batch) return;
    groupItems.forEach((it) => addWindowToBatch(project.id, batch.id, it.config || {}));
  });

  // 3. Link the estimate to the project (blocks a second move).
  updateEstimate(estimate.id, { project_id: project.id });

  return project;
}
