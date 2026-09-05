/**
 * cncExport.js — browser download wrappers for the CNC DXF generators.
 *
 * Jambs: geometry in src/engine/cnc/jambDxf.js (1:1 port of the workshop's
 * KIT_SASH_JAMB.lsp). Arched heads (arched-casement-v1): geometry + planner
 * in src/engine/arch.js, drawing in src/engine/cnc/archDxf.js. This module
 * only maps PC window data onto the generators' inputs and hands the
 * resulting R12 file to the browser.
 *
 * Jamb rules (Piotr 02.08.2026):
 *  - sash only; heritage frames have no lisp variant → skipped, never guessed
 *  - vent count comes from the window's Ventilation section, hard-capped by
 *    the lisp gate (fw < 1050mm → always 1)
 *  - single window → {name}_jambs.dxf; PP/batch → one merged file, windows
 *    stacked 300mm apart, labels from window names
 * Arch rules:
 *  - casement with windowSpec.arch only; every other window is skipped with
 *    the reason (shown as the button tooltip / alert), never guessed
 *  - the plan uses the ACTIVE casement profile (callers wrap in withProfiles
 *    when a batch snapshot must apply, exactly like deriveWindowData)
 *  - single window → {name}_arch.dxf; PP/batch → {label}_arch.dxf merged
 */
import {
  buildJambEntities, buildMergedJambEntities, CNC_LAYERS, jambVentCount,
} from '../engine/cnc/jambDxf.js';
import { buildArchEntities, buildMergedArchEntities, ARCH_LAYERS } from '../engine/cnc/archDxf.js';
import { buildArchPlan, isArchShape, ArchError } from '../engine/arch.js';
import { getCasementProfile } from '../engine/profile.js';
import { writeDxf } from '../engine/cnc/dxfWriter.js';
import { buildVentGrilles } from '../engine/lists.js';

// PC frame type → lisp variant. heritage intentionally absent.
const FRAME_TO_CNC = { standard: 'standard', slim: 'slim', triple: 'triple' };

// Shared with glassDxfExport.js (arched-casement-v2 C): one file-name rule,
// one browser download path for every DXF the app writes.
export const safeName = (s) => String(s || 'window').replace(/[^\w.-]+/g, '_');

export function downloadDxf(filename, content) {
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Map one PC window onto generator params.
 * Returns { params, warning? } or { skip: reason }.
 * `warning` = the spec asked for more vents than the jamb width allows
 * (drawn clamped, but NEVER silently — callers must show it).
 */
export function cncParamsForWindow(windowSpec, name) {
  if (!windowSpec) return { skip: 'no data' };
  if ((windowSpec.category || 'sash') !== 'sash') return { skip: 'not a sash window' };
  const frameType = FRAME_TO_CNC[windowSpec.frame?.type || 'standard'];
  if (!frameType) return { skip: 'heritage' };
  const fw = Number(windowSpec.frame?.width) || 0;
  const wh = Number(windowSpec.frame?.height) || 0;
  if (!(fw > 250) || !(wh > 250)) return { skip: 'size out of range' };
  const vent = jambVentCount(fw, buildVentGrilles(windowSpec));
  return {
    params: {
      fw, wh, frameType,
      ventCount: vent.count,
      winNum: String(name || windowSpec.name || ''),
    },
    warning: vent.clamped
      ? `spec 2 vents, width ${fw}mm allows 1 — drawn with 1, verify`
      : null,
  };
}

/** True when the single-window button should be enabled. */
export function canExportCncJambs(windowSpec) {
  return !cncParamsForWindow(windowSpec, '').skip;
}

/** Single window → download. Returns { ok, warning? } or { error }. */
export function exportCncJambsForWindow(windowSpec, name) {
  const r = cncParamsForWindow(windowSpec, name);
  if (r.skip) return { error: r.skip };
  const ents = buildJambEntities(r.params, 0, 0);
  downloadDxf(`${safeName(r.params.winNum)}_jambs.dxf`, writeDxf(ents, CNC_LAYERS));
  return { ok: true, warning: r.warning || null };
}

/**
 * Many windows (PP or batch) → one merged download.
 * windows: [{ windowSpec, name }]
 * Returns { ok, exported, skipped: [{name, reason}], warnings: [string] }
 * or { error }.
 */
export function exportCncJambsMerged(windows, fileLabel) {
  const params = [];
  const skipped = [];
  const warnings = [];
  for (const w of windows || []) {
    const r = cncParamsForWindow(w.windowSpec, w.name);
    if (r.skip) skipped.push({ name: w.name || '?', reason: r.skip });
    else {
      params.push(r.params);
      if (r.warning) warnings.push(`${w.name || '?'}: ${r.warning}`);
    }
  }
  if (!params.length) return { error: 'No CNC-capable sash windows in this pack', skipped };
  const ents = buildMergedJambEntities(params);
  downloadDxf(`${safeName(fileLabel || 'pack')}_jambs.dxf`, writeDxf(ents, CNC_LAYERS));
  return { ok: true, exported: params.length, skipped, warnings };
}

// ─── Arched casement heads (arched-casement-v1) ─────────────────────────────

/**
 * Map one PC window onto the arch generator.
 * Returns { params: { plan, winNum } } or { skip: reason }.
 * Geometry errors (rise / width limits, member face larger than the rise,
 * no stock board) come back as readable `skip` reasons — never as throws.
 */
export function archParamsForWindow(windowSpec, name) {
  if (!windowSpec) return { skip: 'no data' };
  if ((windowSpec.category || 'sash') !== 'casement') return { skip: 'not a casement window' };
  const a = windowSpec.arch;
  if (!a?.shape) return { skip: 'not an arched casement' };
  if (!isArchShape(a.shape)) return { skip: `unsupported arch shape "${a.shape}"` };
  try {
    const plan = buildArchPlan({
      shape: a.shape,
      width: windowSpec.frame?.width,
      height: windowSpec.frame?.height,
      rise: a.rise,
      hinge: a.hinge,
    }, getCasementProfile());
    if (plan.noStock) {
      const needs = [];
      for (const [label, pl] of [['frame head', plan.plans.frameHead], ['leaf top', plan.plans.leafTop]]) {
        for (const arc of pl.arcs) {
          if (arc.default) continue;
          const narrowest = arc.options[arc.options.length - 1];
          needs.push(`${label} arc ${arc.index + 1} needs a board >= ${Math.ceil(narrowest.boardWidth)}mm`);
        }
      }
      const maxStock = Math.max(0, ...(plan.plans.frameHead.stockWidths || []));
      return { skip: `no stock board fits (widest ${maxStock}mm): ${needs.join('; ')}` };
    }
    return { params: { plan, winNum: String(name || windowSpec.name || '') } };
  } catch (e) {
    if (e instanceof ArchError) return { skip: e.message };
    throw e;
  }
}

/** True when the single-window "Arch DXF" button should be enabled. */
export function canExportArchDxf(windowSpec) {
  return !archParamsForWindow(windowSpec, '').skip;
}

/** Single window → download. Returns { ok } or { error }. */
export function exportArchDxfForWindow(windowSpec, name) {
  const r = archParamsForWindow(windowSpec, name);
  if (r.skip) return { error: r.skip };
  const ents = buildArchEntities(r.params.plan, r.params.winNum, 0, 0);
  downloadDxf(`${safeName(r.params.winNum)}_arch.dxf`, writeDxf(ents, ARCH_LAYERS));
  return { ok: true };
}

/**
 * Many windows (PP or batch) → one merged download.
 * windows: [{ windowSpec, name }]
 * Returns { ok, exported, skipped: [{name, reason}] } or { error, skipped }.
 */
export function exportArchDxfMerged(windows, fileLabel) {
  const items = [];
  const skipped = [];
  for (const w of windows || []) {
    const r = archParamsForWindow(w.windowSpec, w.name);
    if (r.skip) skipped.push({ name: w.name || '?', reason: r.skip });
    else items.push({ plan: r.params.plan, winNum: r.params.winNum });
  }
  if (!items.length) return { error: 'No arched casements in this pack', skipped };
  const ents = buildMergedArchEntities(items);
  downloadDxf(`${safeName(fileLabel || 'pack')}_arch.dxf`, writeDxf(ents, ARCH_LAYERS));
  return { ok: true, exported: items.length, skipped };
}
