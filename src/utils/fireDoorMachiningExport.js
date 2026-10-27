/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * fireDoorMachiningExport.js: the machine-neutral machining list of fire door sets
 * (FIRE DOORS v1, 27.10.2026).
 *
 * bSuite takes the leaf (bsuiteExport.js, buildBsuiteFireDoorRows); the frame members will
 * be machined on a 5-axis CNC whose programs do not exist yet. This file hands the programmer
 * every element and every operation with its position, straight from
 * `derived.firedoor.machining` (the ops the engine computes in the board coordinate systems
 * documented at the top of src/engine/fireDoor.js). Two files per export:
 *   {label}_firedoor_machining.csv   one line per op: door, element, op, face, x, y, z,
 *                                    length, width, depth, radius, angle, value, note
 *   {label}_firedoor_machining.json  per door: name, inputs, leaf, frame members, hinges,
 *                                    lock, keep, vp, intumescent, bsuiteVars, machining
 * Rules: every number comes from `derived` (never recomputed here), numbers to 0.1, the
 * element names are the cut list names (FD-LEAF, FD-HEAD, FD-JAMB-H, FD-JAMB-L) read from
 * the derived records. The browser download stays inside exportFireDoorMachining so node
 * (the harness) can import the module.
 */
import { downloadDxf, safeName } from './cncExport.js';

const r1 = (v) => Math.round(Number(v) * 10) / 10;
const fmtNum = (v) => String(r1(v));

/** The CSV columns, in this order (the optional angle / value / note are blank when an op has none). */
export const FIREDOOR_MACHINING_COLUMNS = Object.freeze(['door', 'element', 'op', 'face', 'x', 'y', 'z', 'length', 'width', 'depth', 'radius', 'angle', 'value', 'note']);

/** The machining groups of derived.firedoor.machining, in the order the list is written (leaf, head, hinge jamb, lock jamb). */
export const FIREDOOR_MACHINING_KEYS = Object.freeze(['leaf', 'head', 'jambHinge', 'jambLock']);

/** The coordinate systems, repeated in the JSON so the file explains itself to the 5-axis programmer. */
export const FIREDOOR_COORDINATE_NOTES = Object.freeze({
  units: 'mm, rounded to 0.1',
  op: 'x, y, z = the reference corner (minimum x, y, z of the bounding box) in the board system; length along x, width along the other in-face axis, depth into the face, radius = corner or end radius; holes (spindleHole, cylinderHole) give their centre in x, y and the bore in length and width',
  leaf: 'x along the height from the leaf top (0 = top, LPX = bottom); y across the width from the hinge edge (0 = hinge edge, LPY = lock edge); z through the thickness from the pull face (0 = pull face, LPZ = push face); faces pull, push, hingeEdge, lockEdge, top, bottom',
  frame: 'x along the length from the top long point (jambs) or the left long point (head); y across the 50 thickness from the wall face (0 = wall, 50 = opening); z along the frame depth from the outside face (0 = the face that shows 35, depth = the inside face that shows 50); faces opening, rebateCheek, end',
});

/** The fire doors of a window list as [{ name, derived }], every other window left out. */
function fireDoorsOf(windows) {
  const out = [];
  for (const w of windows || []) {
    const derived = w?.derived;
    if (!derived || derived.category !== 'firedoor' || !derived.firedoor?.machining) continue;
    const name = String(w?.name || w?.windowSpec?.name || derived.firedoor.name || '').trim() || 'FDR';
    out.push({ name, derived });
  }
  return out;
}

/** The cut list name of a machining group: the leaf record, else the frame member with that role. */
function elementNameOf(derived, key) {
  if (key === 'leaf') return derived.components?.sash?.[0]?.elementName || key;
  const member = (derived.firedoor?.frame?.members || []).find((m) => m.role === key);
  return member?.id || key;
}

/**
 * One row per op of every fire door, doors in the given order, groups leaf / head / hinge
 * jamb / lock jamb, ops in the engine's order. Row: { door, element, op, face, x, y, z,
 * length, width, depth, radius } plus angle / value / note when the op carries them.
 */
export function buildFireDoorMachiningRows(windows) {
  const rows = [];
  for (const { name, derived } of fireDoorsOf(windows)) {
    const M = derived.firedoor.machining;
    for (const key of FIREDOOR_MACHINING_KEYS) {
      const element = elementNameOf(derived, key);
      for (const op of M[key] || []) {
        const row = {
          door: name, element, op: op.kind, face: op.face,
          x: r1(op.x), y: r1(op.y), z: r1(op.z),
          length: r1(op.length), width: r1(op.width), depth: r1(op.depth), radius: r1(op.radius),
        };
        if (op.angle != null) row.angle = r1(op.angle);
        if (op.value != null) row.value = r1(op.value);
        if (op.note) row.note = String(op.note);
        rows.push(row);
      }
    }
  }
  return rows;
}

/** A CSV cell: numbers to 0.1, strings quoted (doubled quotes) only when they hold a comma, a quote or a line break. */
function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') return fmtNum(v);
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The CSV text: a header line, then one line per row, comma separated, CRLF, UTF-8 (no BOM). */
export function fireDoorMachiningCsv(rows) {
  const lines = [FIREDOOR_MACHINING_COLUMNS.join(',')];
  for (const r of rows || []) lines.push(FIREDOOR_MACHINING_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * The JSON text (2-space indent): the format header, the coordinate notes and one object per
 * door with name, fire, rating, handing, inputs, leaf, frame (overall, sections, rebate,
 * members), hinges, lock, keep, vp, intumescent, closer, bsuiteVars and machining, all copied
 * from derived.firedoor.
 */
export function fireDoorMachiningJson(windows) {
  const doors = fireDoorsOf(windows).map(({ name, derived }) => {
    const FD = derived.firedoor;
    return {
      name, fire: FD.fire, rating: FD.rating, handing: FD.handing, inputs: FD.inputs,
      leaf: FD.leaf, frame: FD.frame, hinges: FD.hinges, lock: FD.lock, keep: FD.keep,
      vp: FD.vp, intumescent: FD.intumescent, closer: FD.closer,
      bsuiteVars: FD.bsuiteVars, machining: FD.machining,
    };
  });
  return JSON.stringify({ format: 'production-core-firedoor-machining', version: 1, coordinates: FIREDOOR_COORDINATE_NOTES, doors }, null, 2);
}

/**
 * Browser: downloads {label}_firedoor_machining.csv and .json for the fire doors of
 * `windows` ([{ windowSpec, derived, name }]) through the shared blob download helper of
 * cncExport.js. Returns { ok, doors, rows, files } or { error } when the list has no fire door.
 */
export function exportFireDoorMachining(windows, fileLabel) {
  const doors = fireDoorsOf(windows);
  if (!doors.length) return { error: 'no fire doors to export (fire door sets only)' };
  const rows = buildFireDoorMachiningRows(windows);
  const base = `${safeName(fileLabel || 'pack')}_firedoor_machining`;
  const files = [`${base}.csv`, `${base}.json`];
  downloadDxf(files[0], fireDoorMachiningCsv(rows), 'text/csv');
  downloadDxf(files[1], fireDoorMachiningJson(windows), 'application/json');
  return { ok: true, doors: doors.length, rows: rows.length, files };
}
