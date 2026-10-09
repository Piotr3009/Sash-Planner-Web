/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * windowBoundary.js: one window's derivation inside its own error boundary
 * (Piotr 09.10.2026, owner box item 19). An unknown sash proportion, an
 * unknown bar pattern, an arch the engine cannot build or a door frame that
 * leaves no leaf (DoorGeometryError) fails THAT window
 * only: the page shows the message on the window's card or row, leaves the
 * window out of the lists and PDFs with a visible note, and renders every
 * other window. ProjectDetailPage, ProductionPackPage and WindowDetailPage
 * share these helpers, so the three pages catch the same errors the same way.
 */

import { parseSpecification, normaliseToWindowSpec, SashProportionError, BarPatternError } from '../engine/specification.js';
import { ArchError } from '../engine/arch.js';
import { sashBarPattern, DoorGeometryError } from '../engine/calculations.js';

/** The engine errors that describe the window's own data (the owner fixes the window, not the code). */
export function isWindowDataError(e) {
  return e instanceof SashProportionError || e instanceof BarPatternError || e instanceof ArchError || e instanceof DoorGeometryError;
}

/** The error a page prints for one window: the engine message, the error name for the log. */
export function windowErrorOf(e) {
  return {
    name: e?.name || 'Error',
    message: e?.message || String(e),
    known: isWindowDataError(e),
  };
}

/**
 * Normalise and derive ONE window inside a boundary.
 * `derive(windowSpec)` runs the engine (the caller wraps it in its batch
 * profile snapshot). Returns { win, spec, windowSpec, derived, error }: error
 * is null when the window derived, else { name, message, known } and derived
 * is null (windowSpec too when the normaliser itself raised).
 */
export function deriveWindowBounded(win, derive) {
  let spec = null;
  let windowSpec = null;
  try {
    spec = parseSpecification(win?.specification);
    windowSpec = normaliseToWindowSpec(win, spec);
    const derived = derive(windowSpec);
    if (!derived) throw new Error('The engine returned no data');
    return { win, spec, windowSpec, derived, error: null };
  } catch (e) {
    console.warn(`Calc failed for ${win?.name || '?'}:`, e);
    return { win, spec, windowSpec, derived: null, error: windowErrorOf(e) };
  }
}

/** Split bounded rows into the windows that derived and the excluded ones (order kept). */
export function splitBounded(rows) {
  const list = rows || [];
  return { ok: list.filter((r) => !r.error), excluded: list.filter((r) => r.error) };
}

/** The note a page prints above its lists: '' when nothing was excluded. */
export function excludedWindowsNote(excluded) {
  const n = (excluded || []).length;
  if (!n) return '';
  return `${n} window${n === 1 ? '' : 's'} excluded from the lists and PDFs: ${excluded.map((r) => r.win?.name || '?').join(', ')}`;
}

/**
 * The bars label of one window for cards and overview rows (sash): the
 * pattern of each sash from the normalised spec, so a PSW item with the bars
 * only inside its fullConfig shows them. One pattern when both sashes agree
 * ('2x2', 'none'), else 'upper / lower' ('6x6 / none'), as the estimate PDF
 * prints a window without "same bars".
 */
export function sashBarsLabel(windowSpec) {
  const upper = sashBarPattern(windowSpec, 'upper');
  const lower = sashBarPattern(windowSpec, 'lower');
  return upper === lower ? upper : `${upper} / ${lower}`;
}
