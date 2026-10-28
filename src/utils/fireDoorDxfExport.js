/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * fireDoorDxfExport.js (fire doors v1.2, 28.10.2026): the DXF of every element of a fire door
 * set (the owner asked for "DWG, all the elements, including nicely drawn hinges"). A true
 * .dwg needs a proprietary library or a converter (no new dependency is allowed), so the
 * files are DXF R12: AutoCAD and bSolid open them directly.
 *
 * The drawing itself is built by src/engine/cnc/fireDoorDxf.js (pure, from derived.firedoor
 * and its machining ops) and written by the shared R12 writer (dxfWriter.js, unchanged).
 * This module only names, packs and downloads:
 *   fireDoorDxfText(derived)                    one door, all four elements on one sheet
 *   fireDoorElementDxfText(derived, element)    one element: 'leaf' | 'head' | 'jambHinge' | 'jambLock'
 *   fireDoorDxfZipFiles(windows)                { path: text } of a pack: per door one
 *                                               all-elements DXF plus a folder of the four
 *                                               element DXFs
 *   downloadFireDoorDxf({ name, derived })      browser: one door's .dxf
 *   downloadFireDoorDxfZip(windows, label)      browser: the zip of fireDoorDxfZipFiles
 * `windows` = [{ windowSpec, derived, name }] as the fire door machining export takes them;
 * every non fire door is left out. The texts and the zip bytes are pure, so node (the t53
 * harness) can call them; only the two download functions touch the DOM.
 */
import { zipSync, strToU8 } from 'fflate';
import { writeDxf } from '../engine/cnc/dxfWriter.js';
import { fireDoorDxfEntities, FIREDOOR_DXF_ELEMENTS } from '../engine/cnc/fireDoorDxf.js';
import { downloadDxf, safeName } from './cncExport.js';

export { FIREDOOR_DXF_ELEMENTS };

/** The button tooltip: what the file is and why it is not a .dwg. */
export const FIREDOOR_DXF_TOOLTIP = 'DXF, opens in AutoCAD and bSolid (a true .dwg needs a converter)';

/** The fire doors of a window list as [{ name, derived }] (the rule of the machining export), every other window left out. */
export function fireDoorDxfDoors(windows) {
  const out = [];
  for (const w of windows || []) {
    const derived = w?.derived;
    if (!derived || derived.category !== 'firedoor' || !derived.firedoor?.machining) continue;
    const name = String(w?.name || w?.windowSpec?.name || derived.firedoor.name || '').trim() || 'FDR';
    out.push({ name, derived });
  }
  return out;
}

/** The cut list name of an element: the leaf record (FD-LEAF), else the frame member with that role (FD-HEAD, FD-JAMB-H, FD-JAMB-L). */
export function fireDoorElementName(derived, element) {
  if (element === 'leaf') return derived?.components?.sash?.[0]?.elementName || 'FD-LEAF';
  return (derived?.firedoor?.frame?.members || []).find((m) => m.role === element)?.id || element;
}

function dxfOf(derived, elements) {
  const r = fireDoorDxfEntities(derived, elements ? { elements } : {});
  if (r.error) throw new Error(`fire door DXF: ${r.error}`);
  return writeDxf(r.entities, r.layers);
}

/** The DXF text of one door: the leaf, head, hinge jamb and lock jamb on one sheet. */
export function fireDoorDxfText(derived) {
  return dxfOf(derived, null);
}

/** The DXF text of one element of a door ('leaf' | 'head' | 'jambHinge' | 'jambLock'). */
export function fireDoorElementDxfText(derived, element) {
  if (!FIREDOOR_DXF_ELEMENTS.includes(element)) throw new Error(`fire door DXF: unknown element '${element}' (leaf, head, jambHinge, jambLock)`);
  return dxfOf(derived, [element]);
}

/** The file name of one door's all-elements DXF. */
export const fireDoorDxfFileName = (name) => `${safeName(name || 'FDR')}_firedoor.dxf`;

/**
 * The files of a pack as { path: text }: per door `{door}_firedoor.dxf` (all elements) and
 * the folder `{door}/` with `{door}_{FD-LEAF|FD-HEAD|FD-JAMB-H|FD-JAMB-L}.dxf`. Two doors of
 * the same name keep apart (_2, _3 on the later ones).
 */
export function fireDoorDxfZipFiles(windows) {
  const files = {};
  const used = new Map();
  for (const { name, derived } of fireDoorDxfDoors(windows)) {
    const base = safeName(name);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    const door = n > 1 ? `${base}_${n}` : base;
    files[fireDoorDxfFileName(door)] = fireDoorDxfText(derived);
    for (const el of FIREDOOR_DXF_ELEMENTS) {
      files[`${door}/${door}_${safeName(fireDoorElementName(derived, el))}.dxf`] = fireDoorElementDxfText(derived, el);
    }
  }
  return files;
}

/** The zip bytes of fireDoorDxfZipFiles (fflate, like the bSuite export); `files` when already built. */
export function fireDoorDxfZipBytes(windows, files = fireDoorDxfZipFiles(windows)) {
  const entries = {};
  const mtime = new Date();
  for (const [path, textData] of Object.entries(files)) entries[path] = [strToU8(textData), { mtime }];
  return zipSync(entries, { mtime });
}

/** Browser: downloads one door's all-elements DXF. Returns { ok, filename } or { error }. */
export function downloadFireDoorDxf({ name, derived }) {
  if (!derived || derived.category !== 'firedoor' || !derived.firedoor?.machining) return { error: 'not a calculated fire door (fire door sets only)' };
  const filename = fireDoorDxfFileName(name || derived.firedoor.name);
  downloadDxf(filename, fireDoorDxfText(derived));
  return { ok: true, filename };
}

/**
 * Browser: downloads `{label}_firedoor_dxf.zip` with every fire door of `windows` (one
 * all-elements DXF per door plus its folder of four element DXFs). Returns { ok, doors,
 * files, filename } or { error } when the list holds no fire door.
 */
export function downloadFireDoorDxfZip(windows, label) {
  const doors = fireDoorDxfDoors(windows);
  if (!doors.length) return { error: 'no fire doors to export (fire door sets only)' };
  const files = fireDoorDxfZipFiles(windows);
  const bytes = fireDoorDxfZipBytes(windows, files);
  const filename = `${safeName(label || 'pack')}_firedoor_dxf.zip`;
  downloadDxf(filename, bytes, 'application/zip');
  return { ok: true, doors: doors.length, files: Object.keys(files).length, filename };
}
