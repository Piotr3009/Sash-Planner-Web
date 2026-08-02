/**
 * cncExport.js — browser download wrappers for the CNC jamb DXF generator.
 *
 * The geometry lives in src/engine/cnc/jambDxf.js (1:1 port of the workshop's
 * KIT_SASH_JAMB.lsp). This module only maps PC window data onto the
 * generator's inputs and hands the resulting R12 file to the browser.
 *
 * Rules (Piotr 02.08.2026):
 *  - sash only; heritage frames have no lisp variant → skipped, never guessed
 *  - vent count comes from the window's Ventilation section, hard-capped by
 *    the lisp gate (fw < 1050mm → always 1)
 *  - single window → {name}_jambs.dxf; PP/batch → one merged file, windows
 *    stacked 300mm apart, labels from window names
 */
import {
  buildJambEntities, buildMergedJambEntities, CNC_LAYERS, jambVentCount,
} from '../engine/cnc/jambDxf.js';
import { writeDxf } from '../engine/cnc/dxfWriter.js';
import { buildVentGrilles } from '../engine/lists.js';

// PC frame type → lisp variant. heritage intentionally absent.
const FRAME_TO_CNC = { standard: 'standard', slim: 'slim', triple: 'triple' };

const safeName = (s) => String(s || 'window').replace(/[^\w.-]+/g, '_');

function downloadDxf(filename, content) {
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
