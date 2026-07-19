import { useEffect, useRef, useState } from 'react';

/**
 * MaterialPicker — custom replacement for the native material <select>.
 * The browser's dropdown can't be styled (row height, images, search), so
 * this renders its own panel: search box, roomy rows, thumbnail (image_url
 * from the catalog / JC import; placeholder otherwise), item number, name,
 * size and price. Escape or an outside click closes it.
 *
 * Pure UI — emits the chosen material via onSelect(material); stores, engine
 * and assignments are untouched.
 */
export default function MaterialPicker({ materials = [], value, onSelect, disabled, placeholder = '— select material —', className = '', allowClear = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const selected = value ? materials.find((m) => m.id === value) : null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { if (!open) setQ(''); }, [open]);

  const needle = q.trim().toLowerCase();
  const list = needle
    ? materials.filter((m) => `${m.item_number || m.id} ${m.name || ''} ${m.size || ''}`.toLowerCase().includes(needle))
    : materials;

  const label = selected
    ? `${selected.item_number || selected.id} — ${selected.name}${selected.size ? ` (${selected.size})` : ''}`
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`input text-left w-full flex items-center justify-between gap-2 disabled:opacity-50 ${selected ? 'text-ink-100' : 'text-ink-400'}`}
      >
        <span className="truncate">{label}</span>
        <span className="text-ink-500 text-[10px] shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-[600px] max-w-[85vw] min-w-full max-h-[70vh] rounded-lg border border-surface-400 bg-surface-800 shadow-xl flex flex-col overflow-hidden">
          <div className="p-2 border-b border-surface-500 shrink-0">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, name or size…"
              className="input w-full text-xs"
            />
          </div>
          <div className="overflow-y-auto">
            {allowClear && value && (
              <button type="button" onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-ink-400 border-b border-surface-600/60 hover:bg-surface-700 hover:text-red-400 transition-colors">
                — No material (clear) —
              </button>
            )}
            {list.length === 0 && (
              <div className="px-3 py-4 text-xs text-ink-500">No materials match</div>
            )}
            {list.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelect(m); setOpen(false); }}
                className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-surface-600/60 hover:bg-surface-700 transition-colors ${m.id === value ? 'bg-accent-500/10' : ''}`}
              >
                {m.image_url ? (
                  <img src={m.image_url} alt="" className="w-12 h-12 rounded object-cover bg-surface-600 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded bg-surface-600 flex items-center justify-center text-xs text-ink-500 shrink-0">🪵</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-ink-100 truncate">
                    {m.item_number || m.id} — {m.name}
                  </div>
                  <div className="text-[10px] text-ink-400 flex items-center gap-2">
                    {m.size && <span className="font-mono">{m.size}</span>}
                    {m.cost_per_unit > 0 && <span>£{Number(m.cost_per_unit).toFixed(2)}{m.unit ? `/${m.unit}` : ''}</span>}
                    {m.jc_uuid && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
