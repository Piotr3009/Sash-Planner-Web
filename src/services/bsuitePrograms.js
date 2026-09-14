/**
 * bsuitePrograms.js — Matt's .bSolid programs for the bSuite worklist export.
 *
 * bSolid reads a worklist's programs from INSIDE the .ewlist (`Programs\NAME.bSolid`), not
 * from the disk (14.09.2026 — a list saved by Piotr's own bSolid carries the program; every
 * list without it showed "The program does not exist"). So the export needs the program
 * bytes: uploaded once per target in Window Settings, stored in the private bucket
 * 'bsuite-programs' under `<tenant>/<target>/<key>/<file>.bSolid`, downloaded on export.
 */
import { supabase } from './supabase.js';
import { currentTenantId } from './cloudSync.js';

const BUCKET = 'bsuite-programs';
const MAX_BYTES = 50 * 1024 * 1024;

/** Upload one program for a target's element. Returns { storagePath, fileName, bytes, uploadedAt }. */
export async function uploadBsuiteProgram(targetId, key, file) {
  if (!supabase) throw new Error('Cloud sync is not configured');
  if (!file || !/\.bsolid$/i.test(file.name)) throw new Error('Choose a .bSolid program file');
  if (file.size > MAX_BYTES) throw new Error('The program file is over 50 MB');
  const tenantId = await currentTenantId();
  if (!tenantId) throw new Error('No tenant');
  const storagePath = `${tenantId}/${targetId}/${key}/${file.name}`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(storagePath, file, { contentType: 'application/octet-stream', upsert: true });
  if (error) throw error;
  return { storagePath, fileName: file.name, bytes: file.size, uploadedAt: new Date().toISOString() };
}

/** Download a stored program as Uint8Array (for embedding). */
export async function downloadBsuiteProgram(storagePath) {
  if (!supabase) throw new Error('Cloud sync is not configured');
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

/** Remove a stored program (Settings → clear). */
export async function removeBsuiteProgram(storagePath) {
  if (!supabase || !storagePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}
