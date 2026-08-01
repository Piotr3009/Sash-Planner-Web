/**
 * GlassReferences.jsx — tenant technical-reference images (bar sections,
 * spacer details, photos). Used inline on the window Glass tab and as the
 * "Glass references" card in Settings. List persists in
 * settings.glassReferences via updateSettings; files live in Supabase
 * Storage (see services/glassRefs.js).
 */
import { useRef, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore.js';
import { uploadGlassRef, deleteGlassRef } from '../../services/glassRefs.js';

export default function GlassReferences({ variant = 'inline' }) {
  const refs = useProjectStore((s) => s.settings?.glassReferences) || [];
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setError('');
    const added = [];
    for (const f of files) {
      try { added.push(await uploadGlassRef(f)); }
      catch (err) { setError(err?.message || 'Upload failed'); }
    }
    if (added.length) updateSettings({ glassReferences: [...refs, ...added] });
    setBusy(false);
  };

  const handleDelete = async (ref) => {
    try { await deleteGlassRef(ref.path); } catch { /* keep list consistent anyway */ }
    updateSettings({ glassReferences: refs.filter((r) => r.path !== ref.path) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-ink-200">
          Technical references <span className="text-ink-500 font-normal">tenant library</span>
        </div>
        {variant === 'inline' && (
          <div className="text-[10px] text-ink-500">manage in Settings — Glass references</div>
        )}
      </div>
      {error && <div className="text-[11px] text-red-400 mb-2">{error}</div>}
      <div className="flex flex-wrap gap-3">
        {refs.map((r) => (
          <div key={r.path} className="w-[120px] group relative">
            <button type="button" onClick={() => setLightbox(r)}
              className="block w-full h-[80px] rounded-lg overflow-hidden border border-surface-500 bg-surface-700 hover:border-surface-400">
              <img src={r.url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
            </button>
            <button type="button" onClick={() => handleDelete(r)} title="Delete"
              className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-5 h-5 rounded bg-surface-800/80 text-ink-300 hover:text-red-400 text-xs">
              ✕
            </button>
            <div className="mt-1 text-[10px] text-ink-400 text-center truncate">{r.name}</div>
          </div>
        ))}
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
          className="w-[120px] h-[80px] rounded-lg border border-dashed border-surface-400 text-ink-400 hover:text-ink-200 hover:border-surface-300 flex flex-col items-center justify-center text-xs disabled:opacity-50">
          <span className="text-lg leading-none">＋</span>
          <span className="mt-1">{busy ? 'Uploading…' : 'Add image'}</span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}>
          <div className="max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.name} className="max-h-[80vh] rounded-lg" />
            <div className="mt-2 text-center text-ink-200 text-sm">{lightbox.name}</div>
          </div>
        </div>
      )}
    </div>
  );
}
