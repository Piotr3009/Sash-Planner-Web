import { useState, useMemo } from 'react';
import { useIronmongeryStore, IRONMONGERY_CATEGORIES, IRONMONGERY_FINISHES } from '../stores/ironmongeryStore.js';

const IRONMONGERY_UNITS = ['pcs', 'pair', 'set', 'unit'];

// ─── Confirmation Modal ───
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-ink-50 mb-2">{title}</div>
        <div className="text-xs text-ink-300 mb-4">{message}</div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={onConfirm} className="text-xs px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Image Lightbox ───
function ImageLightbox({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative max-w-lg max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain" />
        <button onClick={onClose} className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-surface-700 border border-surface-500 text-ink-200 text-sm flex items-center justify-center hover:bg-surface-600">×</button>
      </div>
    </div>
  );
}

// ─── Add / Edit Modal (no category field — auto-assigned) ───
function ItemFormModal({ material, activeCategory, onSave, onCancel }) {
  const isEdit = !!material;
  const catLabel = IRONMONGERY_CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory;
  const [form, setForm] = useState({
    name: material?.name || '',
    subcategory: material?.subcategory || '',
    size: material?.size || '',
    finish: material?.finish || '',
    color: material?.color || '',
    unit: material?.unit || 'pcs',
    cost_per_unit: material?.cost_per_unit || '',
    image_url: material?.image_url || '',
    jc_uuid: material?.jc_uuid || '',
    notes: material?.notes || '',
  });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      category: activeCategory, // auto-assigned from active tab
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-ink-50 mb-1">{isEdit ? 'Edit item' : 'Add item'}</div>
        <div className="text-[10px] text-accent-400 mb-4">Category: {catLabel}</div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Name *</label>
            <input className="input text-xs w-full" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Sash Lock PAS24" autoFocus />
          </div>

          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Subcategory</label>
            <input className="input text-xs w-full" value={form.subcategory} onChange={(e) => update('subcategory', e.target.value)} placeholder="e.g. PAS24, Standard" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Size</label>
              <input className="input text-xs w-full" value={form.size} onChange={(e) => update('size', e.target.value)} placeholder="e.g. 116 x 25mm" />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Finish</label>
              <input className="input text-xs w-full" value={form.finish} onChange={(e) => update('finish', e.target.value)} placeholder="e.g. 18mm" />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Color / Finish</label>
              <select className="input text-xs w-full" value={form.color} onChange={(e) => update('color', e.target.value)}>
                <option value="">— Select —</option>
                {IRONMONGERY_FINISHES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Unit</label>
              <select className="input text-xs w-full" value={form.unit} onChange={(e) => update('unit', e.target.value)}>
                {IRONMONGERY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Cost per unit (£)</label>
              <input type="number" step="0.01" className="input text-xs w-full" value={form.cost_per_unit} onChange={(e) => update('cost_per_unit', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Image URL</label>
            <input className="input text-xs w-full" value={form.image_url} onChange={(e) => update('image_url', e.target.value)} placeholder="https://... or leave empty" />
          </div>

          {form.jc_uuid && (
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Joinery Core UUID</label>
              <input className="input text-xs w-full font-mono text-ink-400" value={form.jc_uuid} readOnly />
            </div>
          )}

          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Notes</label>
            <textarea className="input text-xs w-full" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onCancel} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary text-xs px-4">{isEdit ? 'Save changes' : 'Add item'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ───
export default function IronmongeryPage() {
  const items = useIronmongeryStore((s) => s.items);
  const addItem = useIronmongeryStore((s) => s.addItem);
  const updateItem = useIronmongeryStore((s) => s.updateItem);
  const deleteItem = useIronmongeryStore((s) => s.deleteItem);

  const [activeTab, setActiveTab] = useState(null); // null = no category selected
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('item_number');
  const [sortDir, setSortDir] = useState('asc');
  const [showForm, setShowForm] = useState(false);     // false | 'add' | material object (edit)
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [selected, setSelected] = useState(new Set());

  // Count items per category
  const counts = useMemo(() => {
    const c = {};
    IRONMONGERY_CATEGORIES.forEach(cat => {
      c[cat.key] = items.filter(m => m.category === cat.key).length;
    });
    c._total = items.length;
    return c;
  }, [items]);

  // Filtered items (by active tab + search)
  const filtered = useMemo(() => {
    if (!activeTab) return [];
    let list = items.filter(m => m.category === activeTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.item_number?.toLowerCase().includes(q) ||
        m.color?.toLowerCase().includes(q) ||
        m.size?.toLowerCase().includes(q) ||
        m.subcategory?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let va = a[sortBy] ?? '';
      let vb = b[sortBy] ?? '';
      if (sortBy === 'cost_per_unit') { va = Number(va) || 0; vb = Number(vb) || 0; }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [items, activeTab, searchQuery, sortBy, sortDir]);

  // Selection
  const allSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id));
  const someSelected = selected.size > 0;
  const toggleSelect = (id) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleSelectAll = () => { if (allSelected) setSelected(new Set()); else setSelected(new Set(filtered.map(m => m.id))); };

  // Handlers
  const handleSave = (data) => {
    if (showForm && showForm !== 'add' && showForm.id) {
      updateItem(showForm.id, data);
    } else {
      addItem(data);
    }
    setShowForm(false);
  };

  const confirmDeleteAction = () => {
    if (confirmDelete === 'bulk') {
      selected.forEach(id => deleteItem(id));
      setSelected(new Set());
    } else if (confirmDelete?.id) {
      deleteItem(confirmDelete.id);
      setSelected(prev => { const next = new Set(prev); next.delete(confirmDelete.id); return next; });
    }
    setConfirmDelete(null);
  };

  const handleImportCSV = () => {
    if (!activeTab) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        let text = await file.text();
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        let data;
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else {
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) return;
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = values[i] || ''; });
            return obj;
          });
        }
        if (Array.isArray(data) && data.length > 0) {
          // Force category from active tab
          data = data.map(row => ({ ...row, category: activeTab }));
          const result = useIronmongeryStore.getState().importFromCSV(data);
          alert(`Import complete: ${result.added} added, ${result.updated} updated — all assigned to "${IRONMONGERY_CATEGORIES.find(c => c.key === activeTab)?.label}".`);
        }
      } catch (err) {
        alert('Error importing file: ' + err.message);
      }
    };
    input.click();
  };

  const handleExportCSV = () => {
    const exportItems = activeTab ? items.filter(m => m.category === activeTab) : items;
    const headers = ['item_number', 'name', 'category', 'subcategory', 'size', 'finish', 'color', 'unit', 'cost_per_unit', 'jc_uuid', 'notes'];
    const rows = exportItems.map(m => headers.map(h => `"${String(m[h] || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironmongery-${activeTab || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCatLabel = IRONMONGERY_CATEGORIES.find(c => c.key === activeTab)?.label;

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Ironmongery Catalog</h1>
            <p className="text-[10px] text-ink-400 mt-0.5">{items.length} items total · Select a category to manage</p>
          </div>
          <button onClick={handleExportCSV} className="btn btn-secondary text-xs">↓ Export CSV</button>
        </div>

        {/* Hardcoded category tabs */}
        <div className="flex gap-1 mb-5 border-b border-surface-500">
          {IRONMONGERY_CATEGORIES.map(cat => {
            const isActive = activeTab === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveTab(isActive ? null : cat.key); setSelected(new Set()); setSearchQuery(''); }}
                className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${isActive
                  ? 'text-accent-400'
                  : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                {cat.label}
                <span className={`ml-1.5 text-[10px] ${isActive ? 'text-accent-400' : 'text-ink-500'}`}>({counts[cat.key] || 0})</span>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t" />}
              </button>
            );
          })}
        </div>

        {/* No tab selected */}
        {!activeTab && (
          <div className="text-center py-16 text-ink-400">
            <div className="text-2xl mb-3">↑</div>
            <div className="text-sm">Select a category above to view, add or import items</div>
          </div>
        )}

        {/* Active tab content */}
        {activeTab && (
          <>
            {/* Action bar (only visible when tab is active) */}
            <div className="flex items-center justify-between mb-4">
              <input
                type="text"
                placeholder={`Search in ${activeCatLabel}...`}
                className="input text-xs w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex gap-2 items-center">
                {someSelected && (
                  <button onClick={() => setConfirmDelete('bulk')} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors">
                    Delete selected ({selected.size})
                  </button>
                )}
                <button onClick={handleImportCSV} className="btn btn-secondary text-xs">
                  <svg className="inline w-3.5 h-3.5 -mt-0.5 mr-1" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4A030" strokeWidth="1.5" fill="#D4A030" fillOpacity="0.15"/></svg> Import from Joinery Core
                </button>
                <button onClick={() => setShowForm('add')} className="btn btn-primary text-xs">
                  + Add {activeCatLabel?.replace(/^Sash /, '')}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-500 bg-surface-700/50">
                      <th className="px-3 py-2.5 w-8">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-blue-500 cursor-pointer" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider">Image</th>
                      {[
                        { key: 'item_number', label: 'Item #' },
                        { key: 'name', label: 'Name' },
                        { key: 'subcategory', label: 'Type' },
                        { key: 'size', label: 'Size' },
                        { key: 'color', label: 'Color / Finish' },
                      ].map(col => (
                        <th key={col.key}
                          className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider cursor-pointer hover:text-ink-200 transition-colors select-none"
                          onClick={() => { if (sortBy === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortBy(col.key); setSortDir('asc'); } }}>
                          {col.label} {sortBy === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-right text-ink-400 font-medium uppercase text-[10px] tracking-wider cursor-pointer hover:text-ink-200 transition-colors select-none"
                        onClick={() => { if (sortBy === 'cost_per_unit') setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortBy('cost_per_unit'); setSortDir('asc'); } }}>
                        Cost/Unit {sortBy === 'cost_per_unit' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-ink-400">
                          {searchQuery ? 'No items match your search.' : `No ${activeCatLabel} yet. Add an item or import from Joinery Core.`}
                        </td>
                      </tr>
                    )}
                    {filtered.map(m => {
                      const isSelected = selected.has(m.id);
                      const isJC = !!m.jc_uuid;
                      return (
                        <tr key={m.id} className={`border-b border-surface-500/50 hover:bg-surface-700/30 transition-colors ${isSelected ? 'bg-blue-500/5' : ''}`}>
                          <td className="px-3 py-1.5">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(m.id)} className="accent-blue-500 cursor-pointer" />
                          </td>
                          <td className="px-3 py-1.5">
                            {m.image_url ? (
                              <img src={m.image_url} alt="" className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-surface-500/50"
                                onClick={() => setLightboxSrc(m.image_url)} />
                            ) : (
                              <div className="w-10 h-10 rounded bg-surface-600/80 border border-surface-500/50 grid place-items-center text-ink-500 text-[11px]">—</div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-ink-300">{m.item_number}</td>
                          <td className="px-3 py-1.5">
                            <div className="text-ink-100 font-medium flex items-center gap-1.5">
                              {m.name}
                              {isJC && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25 font-normal uppercase tracking-wider" title={`JC: ${m.jc_uuid}`}>JC</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-ink-300 capitalize">{m.subcategory || '—'}</td>
                          <td className="px-3 py-1.5 text-ink-300">{m.size || '—'}</td>
                          <td className="px-3 py-1.5 text-ink-300">{m.color || '—'}</td>
                          <td className="px-3 py-1.5 text-right text-ink-100 font-mono">
                            {m.cost_per_unit > 0 ? `£${Number(m.cost_per_unit).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => setShowForm(m)} className="text-ink-400 hover:text-ink-200 transition-colors text-[11px] p-1" title="Edit">✎</button>
                              <button onClick={() => setConfirmDelete(m)} className="text-ink-400 hover:text-red-400 transition-colors text-[11px] p-1" title="Delete">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > 0 && (
                <div className="px-4 py-2.5 border-t border-surface-500 text-[10px] text-ink-400 flex justify-between">
                  <span>Showing {filtered.length} items in {activeCatLabel}</span>
                  <span>🔗 JC = Imported from Joinery Core</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {showForm && activeTab && (
        <ItemFormModal
          material={showForm !== 'add' ? showForm : null}
          activeCategory={activeTab}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete === 'bulk' ? `Delete ${selected.size} items?` : `Delete "${confirmDelete.name}"?`}
          message={confirmDelete === 'bulk'
            ? `This will permanently remove ${selected.size} selected items.`
            : `This will permanently remove ${confirmDelete.item_number} from the catalog.`}
          onConfirm={confirmDeleteAction}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}