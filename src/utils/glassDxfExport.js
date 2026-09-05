/**
 * glassDxfExport.js — glazier DXF for SHAPED glass units (arched-casement-v2 C).
 *
 * One entity set per shaped unit, in the unit's own frame (origin = the
 * unit's bottom-left corner, y up, mm — exactly what the glazier cuts to):
 *   GLASS_CONTOUR  closed POLYLINE with bulge vertices — exact arcs, one vertex
 *                  per arc end point (VCarve / the glass CNC read true arcs)
 *   GLASS_BARS     bar AXES: straight bars as 2-vertex polylines, curved bars
 *                  (rings, tracery) as 2-vertex bulge polylines
 *   GLASS_TEXT     window name, unit id, W × H, radii, rise, springing, the
 *                  glass spec line and one line per bar (`V1 x=… L=…`)
 * Units are stacked top-down, MERGE_GAP (300 mm) apart, like the jamb and
 * arch CNC files. Serialised by dxfWriter.js (R12, POLYLINE + bulge).
 * Rectangular units are NOT exported here (the glass PDF covers them); a
 * window without a shaped unit is skipped with the reason, never guessed.
 * File names: {name}_glass.dxf, merged {label}_glass.dxf.
 */
import { writeDxf } from '../engine/cnc/dxfWriter.js';
import { MERGE_GAP } from '../engine/cnc/jambDxf.js';
import { buildGlassListForWindow } from '../engine/lists.js';
import { downloadDxf, safeName } from './cncExport.js';

export const GLASS_LAYERS = Object.freeze([
  { name: 'GLASS_CONTOUR', color: 7 },   // finished unit outline (cut line)
  { name: 'GLASS_BARS',    color: 3 },   // bar axes (astragal / duplex positions)
  { name: 'GLASS_TEXT',    color: 2 },
]);

export const GLASS_DXF = Object.freeze({
  textH: 15,        // text height (jambDxf.headTextH)
  lineH: 22,        // text line pitch
  textGap: 100,     // text block offset right of the unit
  textBlockW: 900,  // reserved width for the text block
  unitGap: MERGE_GAP,
});

const R1 = (v) => Math.round(v * 10) / 10;
const fmt1 = (v) => String(R1(v));
const DEG = 180 / Math.PI;

const polyE = (layer, pts, closed) => ({ type: 'poly', layer, closed, pts });
const noteE = (layer, x, y, h, str) => ({ type: 'text', layer, x, y, h, str, rot: 0, halign: 0, valign: 0 });
const shift = (pts, dx, dy) => pts.map(([x, y, b]) => [x + dx, y + dy, b ?? 0]);

/** Bulge for an arc traversed from a0 to a1 counter-clockwise (tan of a quarter of the span). */
const bulgeOf = (arc) => Math.tan((arc.a1 - arc.a0) / 4);

/**
 * Exact bounding box of a bulge polyline — arc EXTENTS included (a glass
 * unit's contour has no vertex at its apex: the arc rises above the springing
 * vertices, so a vertex-only box would let stacked units overlap).
 */
export function polyBBox(pts, closed = true) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    const [x0, y0, b] = pts[i];
    take(x0, y0);
    if (i >= last || !b) continue;
    const [x1, y1] = pts[(i + 1) % n];
    // arc from (x0, y0) to (x1, y1) with bulge b: included angle θ, radius r,
    // centre on the perpendicular bisector (left of the chord for b > 0)
    const theta = 4 * Math.atan(Math.abs(b));
    const chord = Math.hypot(x1 - x0, y1 - y0);
    if (!(chord > 0)) continue;
    const r = chord / (2 * Math.sin(theta / 2));
    const d = r * Math.cos(theta / 2) * Math.sign(b);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const nx = -(y1 - y0) / chord, ny = (x1 - x0) / chord;
    const cx = mx + nx * d, cy = my + ny * d;
    // sweep from the start angle over θ (counter-clockwise for b > 0)
    const a0 = Math.atan2(y0 - cy, x0 - cx);
    const dir = Math.sign(b);
    for (const k of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      let rel = (k - a0) * dir;
      rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (rel > 0 && rel < theta) take(cx + r * Math.cos(k), cy + r * Math.sin(k));
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Bounding box of an entity list with exact arc extents (text ignored). */
export function glassEntitiesBBox(entities) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    if (e.type !== 'poly') continue;
    const b = polyBBox(e.pts, !!e.closed);
    if (b.minX < minX) minX = b.minX; if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY; if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Shaped glass units of one window — the SAME rows the Glass tab and the glass
 * PDF show (lists.buildGlassListForWindow), one entry per ordered unit
 * (qty > 1 → repeated), only rows carrying a shape.
 * Returns [{ id, row, shape }].
 */
export function shapedGlassUnits(windowSpec, derived) {
  if (!windowSpec || !derived) return [];
  const rows = buildGlassListForWindow(derived, windowSpec) || [];
  const out = [];
  for (const r of rows) {
    if (r?.shape?.kind !== 'arched' || !Array.isArray(r.shape.poly)) continue;
    const qty = Math.max(1, Math.round(Number(r.quantity ?? r.qty ?? 1)));
    for (let n = 0; n < qty; n++) out.push({ id: `G${out.length + 1}`, row: r, shape: r.shape });
  }
  return out;
}

/** One text line per bar — positions in mm in the unit frame. */
export function barTextLine(b) {
  const L = fmt1(b.length);
  if (b.kind === 'arc') {
    const a = b.arc;
    return `${b.id} ${b.role.toUpperCase()} C=(${fmt1(a.cx)},${fmt1(a.cy)}) R=${fmt1(a.r)} ${fmt1(a.a0 * DEG)}-${fmt1(a.a1 * DEG)}DEG L=${L}`;
  }
  const [x0, y0] = b.from, [x1, y1] = b.to;
  if (Math.abs(x1 - x0) < 1e-6) return `${b.id} ${b.role.toUpperCase()} X=${fmt1(x0)} Y=${fmt1(Math.min(y0, y1))}-${fmt1(Math.max(y0, y1))} L=${L}`;
  if (Math.abs(y1 - y0) < 1e-6) return `${b.id} ${b.role.toUpperCase()} Y=${fmt1(y0)} X=${fmt1(Math.min(x0, x1))}-${fmt1(Math.max(x0, x1))} L=${L}`;
  return `${b.id} ${b.role.toUpperCase()} (${fmt1(x0)},${fmt1(y0)})-(${fmt1(x1)},${fmt1(y1)}) L=${L}`;
}

/** Text lines of one unit (also reused by the harness). */
export function unitTextLines(unit, winName) {
  const { row, shape } = unit;
  const name = winName ? `${winName} - ` : '';
  const lines = [
    `${name}${unit.id} GLASS ${String(shape.archShape || 'arched').toUpperCase()}`,
    `W${fmt1(row.width)} x H${fmt1(row.height)} RISE ${fmt1(shape.rise)} SPRINGING ${fmt1(shape.springing)} R ${shape.radii.map(fmt1).join('/')}`,
    [row.type, row.makeup, row.spec, row.coating === 'soft_coat' ? 'SOFT COAT' : null, row.gas, row.finish, row.spacer ? `SPACER ${row.spacer}` : null]
      .filter(Boolean).map((s) => String(s).toUpperCase()).join(' '),
  ];
  const bars = shape.bars || [];
  lines.push(bars.length ? `BARS ${bars.length}${shape.pattern && shape.pattern !== 'none' ? ' PATTERN ' + String(shape.pattern).toUpperCase() : ''} TOTAL L=${fmt1(bars.reduce((s, b) => s + b.length, 0))}` : 'NO BARS');
  for (const b of bars) lines.push(barTextLine(b));
  return lines;
}

/**
 * Entity list of ONE shaped unit placed with its bottom-left corner at (ox, oy).
 * Returns { entities, width, height } (text block included in the width).
 */
export function buildGlassUnitEntities(unit, winName = '', ox = 0, oy = 0) {
  const { shape } = unit;
  const E = [];
  E.push(polyE('GLASS_CONTOUR', shift(shape.poly, ox, oy), true));
  for (const b of shape.bars || []) {
    if (b.kind === 'arc') {
      const a = b.arc;
      const p0 = [a.cx + a.r * Math.cos(a.a0), a.cy + a.r * Math.sin(a.a0)];
      const p1 = [a.cx + a.r * Math.cos(a.a1), a.cy + a.r * Math.sin(a.a1)];
      E.push(polyE('GLASS_BARS', [[p0[0] + ox, p0[1] + oy, bulgeOf(a)], [p1[0] + ox, p1[1] + oy, 0]], false));
    } else {
      E.push(polyE('GLASS_BARS', [[b.from[0] + ox, b.from[1] + oy, 0], [b.to[0] + ox, b.to[1] + oy, 0]], false));
    }
  }
  const C = GLASS_DXF;
  const lines = unitTextLines(unit, winName);
  const tx = ox + shape.outline.width + C.textGap;
  const top = oy + Math.max(shape.outline.height, lines.length * C.lineH);
  lines.forEach((str, i) => E.push(noteE('GLASS_TEXT', tx, top - (i + 1) * C.lineH + (C.lineH - C.textH) / 2, C.textH, str)));
  return {
    entities: E,
    width: shape.outline.width + C.textGap + C.textBlockW,
    height: Math.max(shape.outline.height, lines.length * C.lineH),
  };
}

/** All shaped units of one window, stacked top-down from (ox, oy = top). */
export function buildGlassWindowEntities(units, winName = '', ox = 0, oy = 0) {
  const E = [];
  let y = oy;
  // lay out bottom-up so the first unit ends on top (reading order)
  const built = units.map((u) => buildGlassUnitEntities(u, winName, 0, 0));
  for (let i = built.length - 1; i >= 0; i--) {
    for (const e of built[i].entities) {
      if (e.type === 'poly') E.push({ ...e, pts: shift(e.pts, ox, y) });
      else E.push({ ...e, x: e.x + ox, y: e.y + y });
    }
    y += built[i].height + GLASS_DXF.unitGap;
  }
  return E;
}

/**
 * Merge many windows into one entity list, stacked top-down MERGE_GAP apart
 * (same convention as buildMergedJambEntities / buildMergedArchEntities).
 * items: [{ units, winNum }]
 */
export function buildMergedGlassEntities(items) {
  const all = [];
  let cursorY = 0;
  for (const it of items) {
    const ents = buildGlassWindowEntities(it.units, it.winNum, 0, 0);
    const bb = glassEntitiesBBox(ents);
    const oy = cursorY - bb.maxY;
    for (const e of ents) {
      if (e.type === 'poly') all.push({ ...e, pts: e.pts.map(([x, yy, b]) => [x, yy + oy, b]) });
      else if (e.type === 'circle') all.push({ ...e, cy: e.cy + oy });
      else all.push({ ...e, y: e.y + oy });
    }
    cursorY = oy + bb.minY - MERGE_GAP;
  }
  return all;
}

/**
 * Map one PC window onto the glazier DXF.
 * Returns { params: { units, winNum } } or { skip: reason } — never throws for
 * "nothing shaped"; a derivation error upstream arrives as derived = null.
 */
export function glassDxfParamsForWindow(windowSpec, derived, name) {
  if (!windowSpec) return { skip: 'no data' };
  if ((windowSpec.category || 'sash') !== 'casement') return { skip: 'not a casement window' };
  if (!derived) return { skip: 'window could not be calculated' };
  if (!windowSpec.arch?.shape) return { skip: 'not an arched casement — rectangular units go on the glass PDF' };
  const units = shapedGlassUnits(windowSpec, derived);
  if (!units.length) return { skip: 'no shaped glass unit' };
  return { params: { units, winNum: String(name || windowSpec.name || '') } };
}

/** True when the single-window "Glass DXF" button should be enabled. */
export function canExportGlassDxf(windowSpec, derived) {
  return !glassDxfParamsForWindow(windowSpec, derived, '').skip;
}

/** Single window → download {name}_glass.dxf. Returns { ok, units } or { error }. */
export function exportGlassDxfForWindow(windowSpec, derived, name) {
  const r = glassDxfParamsForWindow(windowSpec, derived, name);
  if (r.skip) return { error: r.skip };
  const ents = buildGlassWindowEntities(r.params.units, r.params.winNum, 0, 0);
  downloadDxf(`${safeName(r.params.winNum)}_glass.dxf`, writeDxf(ents, GLASS_LAYERS));
  return { ok: true, units: r.params.units.length };
}

/**
 * Many windows (PP or batch) → one merged download {label}_glass.dxf.
 * windows: [{ windowSpec, derived, name }]
 * Returns { ok, exported, units, skipped: [{ name, reason }] } or { error, skipped }.
 */
export function exportGlassDxfMerged(windows, fileLabel) {
  const items = [];
  const skipped = [];
  let units = 0;
  for (const w of windows || []) {
    const r = glassDxfParamsForWindow(w.windowSpec, w.derived, w.name);
    if (r.skip) skipped.push({ name: w.name || '?', reason: r.skip });
    else { items.push({ units: r.params.units, winNum: r.params.winNum }); units += r.params.units.length; }
  }
  if (!items.length) return { error: 'No shaped glass units in this pack', skipped };
  const ents = buildMergedGlassEntities(items);
  downloadDxf(`${safeName(fileLabel || 'pack')}_glass.dxf`, writeDxf(ents, GLASS_LAYERS));
  return { ok: true, exported: items.length, units, skipped };
}
