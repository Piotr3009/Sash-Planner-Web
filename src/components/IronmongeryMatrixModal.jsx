import { useState, useMemo } from 'react';
import { useIronmongeryStore, IRONMONGERY_CATEGORIES, IRONMONGERY_FINISHES, FINISH_SWATCH } from '../stores/ironmongeryStore.js';

// PSW-style ironmongery picker: one large modal, window types as columns,
// colours as rows. Each cell shows the product photo for that (type, colour)
// pair — pick one product per column. Clicking a row colour selects it across
// every column that has a product. "Others" column/row hold non-standard items.
// "Bespoke" disables the grid (priced manually).
//
// props:
//   currentSlots   — { [categoryKey]: productId } already chosen
//   currentBespoke — bool
//   onApply(slots, bespoke)
//   onClose()
export default function IronmongeryMatrixModal({ currentSlots = {}, currentBespoke = false, onApply, onClose }) {
  const items = useIronmongeryStore((s) => s.items);
  const cats = useMemo(() => IRONMONGERY_CATEGORIES.filter((c) => c.windowType === 'sash'), []);

  const [slots, setSlots] = useState({ ...currentSlots });
  const [bespoke, setBespoke] = useState(currentBespoke);

  // First product for a (category, colour) pair, matching on color or finish.
  const productAt = (catKey, colour) =>
    items.find((m) => m.category === catKey && ((m.color || '').toLowerCase() === colour || (m.finish || '').toLowerCase() === colour)) || null;

  const fmt = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const selectedProducts = Object.values(slots).map((id) => items.find((m) => m.id === id)).filter(Boolean);
  const total = selectedProducts.reduce((s, p) => s + Number(p.cost_per_unit || 0), 0);
  const rowHasProducts = (colour) => cats.some((c) => productAt(c.key, colour));

  const pickCell = (catKey, product) => {
    if (!product) return;
    setBespoke(false);
    setSlots((prev) => (prev[catKey] === product.id
      ? (() => { const n = { ...prev }; delete n[catKey]; return n; })()
      : { ...prev, [catKey]: product.id }));
  };

  // Select a whole colour row across every column that has that product.
  const pickRow = (colour) => {
    if (!rowHasProducts(colour)) return;
    setBespoke(false);
    setSlots((prev) => {
      const next = { ...prev };
      cats.forEach((c) => { const p = productAt(c.key, colour); if (p) next[c.key] = p.id; });
      return next;
    });
  };

  const apply = () => { onApply(bespoke ? {} : slots, bespoke); onClose(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl w-[95vw] max-w-6xl shadow-xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-500 shrink-0 flex items-center justify-between">
          <div className="text-base font-semibold text-ink-50">Select ironmongery</div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200 text-xl leading-none">×</button>
        </div>

        {/* Grid */}
        <div className={`px-6 py-4 overflow-auto ${bespoke ? 'opacity-40 pointer-events-none' : ''}`}>
          <table className="w-full border-collapse text-[11px] min-w-[820px]">
            <thead>
              <tr>
                <th className="text-left py-2 px-2 text-ink-400 font-medium sticky left-0 bg-surface-800"></th>
                {cats.map((c) => (
                  <th key={c.key} className={`py-2 px-1 font-semibold text-center whitespace-nowrap ${c.key === 'other' ? 'text-accent-400' : 'text-ink-200'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IRONMONGERY_FINISHES.map((colour) => {
                const has = rowHasProducts(colour.value);
                return (
                  <tr key={colour.value} className="hover:bg-surface-700/20 border-t border-surface-500/40">
                    <td className={`py-2 px-2 whitespace-nowrap select-none sticky left-0 bg-surface-800 ${has ? 'cursor-pointer' : ''}`} onClick={() => pickRow(colour.value)} title={has ? 'Select this colour for all types' : ''}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 border border-surface-400" style={{ backgroundColor: FINISH_SWATCH[colour.value] || '#888' }} />
                      <span className={`align-middle ${colour.value === 'other' ? 'text-accent-400' : 'text-ink-200'}`}>{colour.label}</span>
                    </td>
                    {has ? (
                      cats.map((c) => {
                        const p = productAt(c.key, colour.value);
                        const sel = p && slots[c.key] === p.id;
                        return (
                          <td key={c.key} className="text-center py-2 px-1.5 align-top">
                            {p ? (
                              <button onClick={() => pickCell(c.key, p)} className="block mx-auto group" title={p.name}>
                                <div className={`relative w-14 h-14 mx-auto rounded-md overflow-hidden border-2 transition-colors ${sel ? 'border-accent-500' : 'border-surface-500 group-hover:border-surface-400'} bg-surface-700`}>
                                  {p.image_url
                                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-ink-500 text-lg">+</div>}
                                  {sel && <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-accent-500 text-white text-[10px] leading-[18px] text-center shadow">✓</span>}
                                </div>
                                <div className="text-[9px] text-ink-400 mt-1 truncate max-w-[60px] mx-auto">{p.name}</div>
                                {p.cost_per_unit > 0 && <div className="text-[9px] text-ink-500">{fmt(p.cost_per_unit)}{c.key === 'other' ? '*' : ''}</div>}
                              </button>
                            ) : (
                              <span className="text-ink-600 inline-block pt-5">—</span>
                            )}
                          </td>
                        );
                      })
                    ) : (
                      <td colSpan={cats.length} className="text-center text-ink-600 text-[10px] py-3">— no {colour.label.toLowerCase()} products —</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="text-[11px] text-ink-400 mt-3">No ironmongery in your catalogue yet. Add products in Materials → Ironmongery first.</div>
          )}
          <div className="text-[10px] text-ink-500 mt-3">* “Others” products are priced manually — they’re not added to the window total automatically.</div>
        </div>

        {/* Bespoke + hint */}
        <div className="px-6 py-2.5 border-t border-surface-500 flex items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] cursor-pointer text-ink-200">
            <input type="checkbox" checked={bespoke} onChange={(e) => setBespoke(e.target.checked)} className="accent-amber-500" />
            Bespoke ironmongery <span className="text-ink-500">(no auto price — add manually)</span>
          </label>
          {!bespoke && <span className="text-[10px] text-ink-500 ml-auto">Click a row colour to select it everywhere, or pick cells.</span>}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-500 shrink-0 flex items-center justify-between">
          <div className="text-[11px] text-ink-400">
            {bespoke ? <span className="text-amber-400">Bespoke ironmongery</span> : <>Selected: <span className="text-ink-100 font-medium">{selectedProducts.length}</span> · <span className="text-ink-100 font-medium">{fmt(total)}</span> <span className="text-ink-500">(unit)</span></>}
          </div>
          <button onClick={apply} className="btn btn-primary text-xs px-5">Add to estimate</button>
        </div>
      </div>
    </div>
  );
}
