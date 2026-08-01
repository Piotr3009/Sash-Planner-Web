/**
 * glassRefs.js — tenant "Technical references" images for the Glass tab.
 *
 * Storage: Supabase bucket 'glass-references', object path `${tenantId}/${uuid}.jpg`.
 * The list itself ({ name, url, path }) lives in per-tenant settings under
 * settings.glassReferences (persisted by the existing saveSettings flow).
 * Images are resized client-side to keep files around ~200KB.
 */
import { supabase } from './supabase.js';
import { currentTenantId } from './cloudSync.js';

const BUCKET = 'glass-references';
const MAX_DIM = 1400;
const JPEG_Q = 0.82;

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image encode failed'))),
        'image/jpeg', JPEG_Q
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')); };
    img.src = url;
  });
}

export async function uploadGlassRef(file) {
  if (!supabase) throw new Error('Cloud sync is not configured');
  const tenantId = await currentTenantId();
  if (!tenantId) throw new Error('No tenant');
  const blob = await resizeImage(file);
  const path = `${tenantId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const name = (file.name || 'reference').replace(/\.[^.]+$/, '');
  return { name, url: data.publicUrl, path };
}

export async function deleteGlassRef(path) {
  if (!supabase || !path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
