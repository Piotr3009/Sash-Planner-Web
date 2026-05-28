import { useState, useMemo } from 'react';
import { useIronmongeryStore, IRONMONGERY_CATEGORIES } from '../stores/ironmongeryStore.js';

export default function IronmongeryPickerModal({ categoryKey, currentItemId, onSelect, onClose }) {
  const items = useIronmongeryStore((s) => s.items);
  const [selected, setSelected] = useState(currentItemId || null);
  const [search, setSearch] = useState('');

  const catLabel = IRONMONGERY_CATEGORIES.find(c => c.key === categoryKey)?.label || categoryKey;

  const filtered = useMemo(() => {
    let list = items.filter(m => m.category === categoryKey);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.color?.toLowerCase().includes(q) ||
        m.size?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, categoryKey, search]);

  const handleAssign = () => {
    onSelect(selected);
    onClose();
  };

  const selectedItem = items.find(m => m.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl w-full max-w-3xl mx-4 shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-500 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-ink-50">Select {catLabel}</div>
              <div className="text-[10px] text-ink-400 mt-0.5">{filtered.length} items available</div>
            </div>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-200 text-lg">×</button>
          </div>
          <input
            type="text"
            placeholder={`Search ${catLabel.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-xs w-full"
            autoFocus
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <div className="text-sm mb-1">No {catLabel.toLowerCase()} in catalog</div>
              <div className="text-[10px]">Go to Ironmongery page to add or import items first</div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(item => {
              const isSelected = selected === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
                    isSelected
                      ? 'border-accent-500 bg-accent-500/5 shadow-lg shadow-accent-500/10'
                      : 'border-surface-500 bg-surface-700/30 hover:border-surface-400 hover:bg-surface-700/50'
                  }`}
                >
                  {/* Image */}
                  <div className="aspect-square bg-surface-600 relative overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-500 text-xs">No image</div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent-500 flex items-center justify-center text-white text-xs font-bold">✓</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <div className="text-xs font-medium text-ink-100 truncate">{item.name}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5 space-y-0.5">
                      {item.size && <div>{item.size}</div>}
                      {item.color && <div>{item.color}</div>}
                      {item.subcategory && <div className="capitalize">{item.subcategory}</div>}
                    </div>
                    <div className="text-xs font-mono text-accent-400 mt-1.5">
                      {item.cost_per_unit > 0 ? `£${Number(item.cost_per_unit).toFixed(2)}` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-500 shrink-0 flex items-center justify-between">
          <div className="text-xs text-ink-400">
            {selectedItem ? (
              <span>Selected: <span className="text-ink-100 font-medium">{selectedItem.name}</span> {selectedItem.color && `(${selectedItem.color})`}</span>
            ) : (
              <span>Click a product to select</span>
            )}
          </div>
          <div className="flex gap-2">
            {currentItemId && (
              <button onClick={() => { onSelect(null); onClose(); }} className="btn btn-secondary text-xs px-4">
                Remove
              </button>
            )}
            <button onClick={onClose} className="btn btn-secondary text-xs px-4">Cancel</button>
            <button
              onClick={handleAssign}
              disabled={!selected}
              className={`text-xs px-5 py-1.5 rounded-lg font-medium transition-colors ${
                selected
                  ? 'bg-accent-500 text-white hover:bg-accent-400'
                  : 'bg-surface-600 text-ink-500 cursor-not-allowed'
              }`}
            >
              Assign to batch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
