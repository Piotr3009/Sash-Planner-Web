import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * MaterialPicker — custom replacement for the native material <select>.
 *
 * The open panel renders through a PORTAL into document.body, so no card,
 * table or overflow container can ever cover or clip it. It positions itself
 * to the trigger button, flips upwards when there is more room above than
 * below, tracks scroll/resize, and clamps to the viewport edges.
 *
 * Pure UI — emits the chosen material via onSelect(material); stores, engine
 * and assignments are untouched.
 */
export default function MaterialPicker({ materials = [], value, onSelect, disabled, placeholder = '— select material —', className = '', allowClear = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, bottom: null, left: 0, width: 800, maxH: 440 });

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.max(Math.min(800, vw - 24), Math.min(r.width, vw - 24));
    let left = r.left;
    if (left + width > vw - 12) left = Math.max(12, vw - 12 - width);
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const want = Math.min(vh * 0.7, 680);
    const up = below < 320 && above > below;
    const maxH = Math.max(220, Math.min(want, up ? above : below));
    setPos(up
      ? { top: null, bottom: vh - r.top + 6, left, width, maxH }
      : { top: r.bottom + 6, bottom: null, left, width, maxH });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onMove = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  useEffect(() => { if (!open) setQ(''); }, [open]);

  const needle = q.trim().toLowerCase();
  const list = needle
    ? materials.filter((m) => `${m.item_number || m.id} ${m.name || ''} ${m.size || ''}`.toLowerCase().includes(needle))
    : materials;

  const selected = value ? materials.find((m) => m.id === value) : null;
  const label = selected
    ? `${selected.item_number || selected.id} — ${selected.name}${selected.size ? ` (${selected.size})` : ''}`
    : placeholder;

  const panel = open ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxH,
        ...(pos.bottom != null ? { bottom: pos.bottom } : { top: pos.top }),
      }}
      className="z-[1000] rounded-lg border border-surface-400 bg-surface-800 shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="p-2 border-b border-surface-500 shrink-0">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number, name or size…"
          className="input w-full text-xs"
        />
      </div>
      <div className="overflow-y-auto min-h-0 flex-1">
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
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`input text-left w-full flex items-center justify-between gap-2 disabled:opacity-50 ${selected ? 'text-ink-100' : 'text-ink-400'}`}
      >
        <span className="truncate">{label}</span>
        <span className="text-ink-500 text-[10px] shrink-0">▾</span>
      </button>
      {panel}
    </div>
  );
}
