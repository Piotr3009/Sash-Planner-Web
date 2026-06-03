import { useState, useMemo } from 'react';
import { useMaterialStore, MATERIAL_UNITS } from '../stores/materialStore.js';
import ManageCategoriesModal from '../components/ManageCategoriesModal.jsx';

// ─── Dynamic category colors (consistent hash-based) ───
const PALETTE = [
  { bg: 'rgba(239,159,39,0.12)', border: 'rgba(239,159,39,0.3)', text: '#FAC775' },
  { bg: 'rgba(127,119,221,0.12)', border: 'rgba(127,119,221,0.3)', text: '#AFA9EC' },
  { bg: 'rgba(55,138,221,0.12)',  border: 'rgba(55,138,221,0.3)',  text: '#85B7EB' },
  { bg: 'rgba(29,158,117,0.12)',  border: 'rgba(29,158,117,0.3)',  text: '#5DCAA5' },
  { bg: 'rgba(212,83,126,0.12)',  border: 'rgba(212,83,126,0.3)',  text: '#ED93B1' },
  { bg: 'rgba(168,130,50,0.12)',  border: 'rgba(168,130,50,0.3)',  text: '#D4B872' },
  { bg: 'rgba(80,170,200,0.12)',  border: 'rgba(80,170,200,0.3)',  text: '#7FD0E8' },
  { bg: 'rgba(190,100,60,0.12)',  border: 'rgba(190,100,60,0.3)',  text: '#E0A880' },
];
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
const catColor = (cat) => PALETTE[hashStr((cat || '').toLowerCase()) % PALETTE.length];

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

// ─── Add / Edit Modal ───
function MaterialFormModal({ material, existingCategories, existingSubcategories, onSave, onCancel }) {
  const isEdit = !!material;
  const [form, setForm] = useState({
    name: material?.name || '',
    category: material?.category || '',
    subcategory: material?.subcategory || '',
    size: material?.size || '',
    thickness: material?.thickness || '',
    color: material?.color || '',
    unit: material?.unit || 'pcs',
    cost_per_unit: material?.cost_per_unit || '',
    image_url: material?.image_url || '',
    jc_uuid: material?.jc_uuid || '',
    notes: material?.notes || '',
  });
  const [customCategory, setCustomCategory] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (!form.category.trim()) return;
    onSave({
      ...form,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
    });
  };

  // Subcategories filtered by selected category
  const relevantSubs = useMemo(() => {
    return existingSubcategories[form.category] || [];
  }, [form.category, existingSubcategories]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-ink-50 mb-4">{isEdit ? 'Edit material' : 'Add material'}</div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Name *</label>
            <input className="input text-xs w-full" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Sash Lock PAS24" autoFocus />
          </div>

          {/* Category + Subcategory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Category *</label>
              {!customCategory ? (
                <div className="flex gap-1">
                  <select className="input text-xs w-full" value={form.category} onChange={(e) => { if (e.target.value === '__new__') { setCustomCategory(true); update('category', ''); } else update('category', e.target.value); }}>
                    <option value="">— Select —</option>
                    {existingCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__new__">+ New category...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input className="input text-xs w-full" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Type new category" autoFocus />
                  <button onClick={() => setCustomCategory(false)} className="text-ink-400 hover:text-ink-200 text-xs px-1">✕</button>
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Subcategory</label>
              <input className="input text-xs w-full" value={form.subcategory} onChange={(e) => update('subcategory', e.target.value)} placeholder="e.g. Pulley, Mdf" list="subcategory-list" />
              <datalist id="subcategory-list">
                {relevantSubs.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {/* Size + Thickness + Color */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Size</label>
              <input className="input text-xs w-full" value={form.size} onChange={(e) => update('size', e.target.value)} placeholder="e.g. 116 x 25mm" />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Thickness</label>
              <input className="input text-xs w-full" value={form.thickness} onChange={(e) => update('thickness', e.target.value)} placeholder="e.g. 18mm" />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Color / Finish</label>
              <input className="input text-xs w-full" value={form.color} onChange={(e) => update('color', e.target.value)} placeholder="e.g. PVD Brass" />
            </div>
          </div>

          {/* Unit + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Unit</label>
              <select className="input text-xs w-full" value={form.unit} onChange={(e) => update('unit', e.target.value)}>
                {MATERIAL_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Cost per unit (£)</label>
              <input type="number" step="0.01" className="input text-xs w-full" value={form.cost_per_unit} onChange={(e) => update('cost_per_unit', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Image URL</label>
            <input className="input text-xs w-full" value={form.image_url} onChange={(e) => update('image_url', e.target.value)} placeholder="https://... or leave empty" />
          </div>

          {/* JC UUID (read-only display if present) */}
          {form.jc_uuid && (
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Joinery Core UUID</label>
              <input className="input text-xs w-full font-mono text-ink-400" value={form.jc_uuid} readOnly />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Notes</label>
            <textarea className="input text-xs w-full" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onCancel} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary text-xs px-4">{isEdit ? 'Save changes' : 'Add material'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ───
export default function MaterialsPage() {
  const materials = useMaterialStore((s) => s.materials);
  const addMaterial = useMaterialStore((s) => s.addMaterial);
  const updateMaterial = useMaterialStore((s) => s.updateMaterial);
  const deleteMaterial = useMaterialStore((s) => s.deleteMaterial);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('item_number');
  const [sortDir, setSortDir] = useState('asc');
  const [showForm, setShowForm] = useState(false);     // false | 'add' | material object (edit)
  const [confirmDelete, setConfirmDelete] = useState(null); // null | 'bulk' | material
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [selected, setSelected] = useState(new Set());

  // ─── Dynamic categories from data ───
  const categories = useMemo(() => {
    const catSet = new Set();
    materials.forEach((m) => { if (m.category) catSet.add(m.category); });
    return [...catSet].sort();
  }, [materials]);

  // Subcategories grouped by category (for form)
  const subcategoriesByCategory = useMemo(() => {
    const map = {};
    materials.forEach((m) => {
      if (m.category && m.subcategory) {
        if (!map[m.category]) map[m.category] = new Set();
        map[m.category].add(m.subcategory);
      }
    });
    const result = {};
    Object.entries(map).forEach(([cat, subs]) => { result[cat] = [...subs].sort(); });
    return result;
  }, [materials]);

  // Category counts
  const counts = useMemo(() => {
    const c = { all: materials.length };
    categories.forEach((cat) => {
      c[cat] = materials.filter((m) => m.category === cat).length;
    });
    return c;
  }, [materials, categories]);

  // Filtered + searched + sorted materials
  const filtered = useMemo(() => {
    let list = materials;
    if (categoryFilter) list = list.filter((m) => m.category === categoryFilter);
    if (subcategoryFilter) list = list.filter((m) => m.subcategory === subcategoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.item_number?.toLowerCase().includes(q) ||
          m.color?.toLowerCase().includes(q) ||
          m.size?.toLowerCase().includes(q) ||
          m.subcategory?.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      let va = a[sortBy] ?? '';
      let vb = b[sortBy] ?? '';
      if (sortBy === 'cost_per_unit') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [materials, categoryFilter, subcategoryFilter, searchQuery, sortBy, sortDir]);

  // ─── Selection ───
  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const someSelected = selected.size > 0;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((m) => m.id)));
    }
  };

  // ─── Handlers ───
  const handleSave = (data) => {
    if (showForm && showForm !== 'add' && showForm.id) {
      updateMaterial(showForm.id, data);
    } else {
      addMaterial(data);
    }
    setShowForm(false);
  };

  const handleDeleteSingle = (material) => {
    setConfirmDelete(material);
  };

  const handleBulkDelete = () => {
    setConfirmDelete('bulk');
  };

  const confirmDeleteAction = () => {
    if (confirmDelete === 'bulk') {
      selected.forEach((id) => deleteMaterial(id));
      setSelected(new Set());
    } else if (confirmDelete?.id) {
      deleteMaterial(confirmDelete.id);
      setSelected((prev) => { const next = new Set(prev); next.delete(confirmDelete.id); return next; });
    }
    setConfirmDelete(null);
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        let text = await file.text();
        // Strip UTF-8 BOM if present
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        let data;
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else {
          // Simple CSV parse
          const lines = text.split('\n').filter((l) => l.trim());
          if (lines.length < 2) return;
          const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
          data = lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = values[i] || ''; });
            return obj;
          });
        }
        if (Array.isArray(data) && data.length > 0) {
          const result = useMaterialStore.getState().importFromCSV(data);
          alert(`Import complete: ${result.added} added, ${result.updated} updated.`);
        }
      } catch (err) {
        alert('Error importing file: ' + err.message);
      }
    };
    input.click();
  };

  const handleExportCSV = () => {
    const headers = ['item_number', 'name', 'category', 'subcategory', 'size', 'thickness', 'color', 'unit', 'cost_per_unit', 'jc_uuid', 'notes'];
    const rows = materials.map((m) =>
      headers.map((h) => `"${String(m[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'production-core-materials.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Materials Catalog</h1>
            <p className="text-[10px] text-ink-400 mt-0.5">
              {materials.length} items across {categories.length} categories
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 items-center">
              {someSelected && (
                <button onClick={handleBulkDelete} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors">
                  Delete selected ({selected.size})
                </button>
              )}
              <button onClick={handleImportCSV} className="btn btn-secondary text-xs">
                <svg className="inline w-3.5 h-3.5 -mt-0.5 mr-1" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4A030" strokeWidth="1.5" fill="#D4A030" fillOpacity="0.15"/></svg> Import from JC
              </button>
              <button onClick={handleExportCSV} className="btn btn-secondary text-xs">
                ↓ Export CSV
              </button>
              <button onClick={() => setShowForm('add')} className="btn btn-primary text-xs">
                + Add material
              </button>
            </div>
            <button onClick={() => setShowCategories(true)} className="text-[11px] text-ink-400 hover:text-accent-400 transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Manage Categories
            </button>
          </div>
        </div>

        {/* Category filter pills (dynamic) */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => { setCategoryFilter(''); setSubcategoryFilter(''); }}
            className={`text-[11px] px-3 py-1 rounded-full transition-colors ${
              !categoryFilter ? 'bg-surface-600 text-ink-50' : 'bg-surface-700/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            All ({counts.all})
          </button>
          {categories.map((cat) => {
            const cc = catColor(cat);
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => { setCategoryFilter(isActive ? '' : cat); setSubcategoryFilter(''); }}
                className="text-[11px] px-3 py-1 rounded-full transition-colors capitalize"
                style={{
                  background: isActive ? cc.bg : 'transparent',
                  color: isActive ? cc.text : '#6B7385',
                  border: isActive ? `0.5px solid ${cc.border}` : '0.5px solid transparent',
                }}
              >
                {cat} ({counts[cat] || 0})
              </button>
            );
          })}
        </div>

        {/* Subcategory pills — shown when category is selected */}
        {categoryFilter && subcategoriesByCategory[categoryFilter]?.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap pl-4 border-l-2 border-surface-500/50">
            <button
              onClick={() => setSubcategoryFilter('')}
              className={`text-[10px] px-2.5 py-0.5 rounded-full transition-colors ${
                !subcategoryFilter ? 'bg-surface-600 text-ink-100' : 'bg-surface-700/50 text-ink-400 hover:text-ink-200'
              }`}
            >
              All
            </button>
            {subcategoriesByCategory[categoryFilter].map((sub) => {
              const isActive = subcategoryFilter === sub;
              return (
                <button
                  key={sub}
                  onClick={() => setSubcategoryFilter(isActive ? '' : sub)}
                  className={`text-[10px] px-2.5 py-0.5 rounded-full transition-colors capitalize ${
                    isActive ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30' : 'bg-surface-700/50 text-ink-400 hover:text-ink-200 border border-transparent'
                  }`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search materials..."
          className="input text-xs w-full mb-4"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-500 bg-surface-700/50">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider">Image</th>
                  {[
                    { key: 'item_number', label: 'Item #' },
                    { key: 'name', label: 'Name' },
                    { key: 'size', label: 'Size' },
                    { key: 'thickness', label: 'Thickness' },
                    { key: 'color', label: 'Color' },
                    { key: 'category', label: 'Category' },
                    { key: 'subcategory', label: 'Subcategory' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider cursor-pointer hover:text-ink-200 transition-colors select-none"
                      onClick={() => {
                        if (sortBy === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        else { setSortBy(col.key); setSortDir('asc'); }
                      }}
                    >
                      {col.label} {sortBy === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th
                    className="px-3 py-2.5 text-right text-ink-400 font-medium uppercase text-[10px] tracking-wider cursor-pointer hover:text-ink-200 transition-colors select-none"
                    onClick={() => {
                      if (sortBy === 'cost_per_unit') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('cost_per_unit'); setSortDir('asc'); }
                    }}
                  >
                    Cost/Unit {sortBy === 'cost_per_unit' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-ink-400">
                      {searchQuery || categoryFilter || subcategoryFilter ? 'No materials match your search.' : 'No materials yet. Import from JC or add your first material.'}
                    </td>
                  </tr>
                )}
                {filtered.map((m) => {
                  const cc = catColor(m.category);
                  const isSelected = selected.has(m.id);
                  const isJC = !!m.jc_uuid;
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-surface-500/50 hover:bg-surface-700/30 transition-colors ${isSelected ? 'bg-blue-500/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(m.id)}
                          className="accent-blue-500 cursor-pointer"
                        />
                      </td>
                      {/* Image */}
                      <td className="px-3 py-1.5">
                        {m.image_url ? (
                          <img
                            src={m.image_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity border border-surface-500/50"
                            onClick={() => setLightboxSrc(m.image_url)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-surface-600/80 border border-surface-500/50 grid place-items-center text-ink-500 text-[11px]">
                            —
                          </div>
                        )}
                      </td>
                      {/* Item # */}
                      <td className="px-3 py-1.5 font-mono text-[10px] text-ink-300">{m.item_number}</td>
                      {/* Name */}
                      <td className="px-3 py-1.5">
                        <div className="text-ink-100 font-medium flex items-center gap-1.5">
                          {m.name}
                          {isJC && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25 font-normal uppercase tracking-wider" title={`JC: ${m.jc_uuid}`}>
                              JC
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Size */}
                      <td className="px-3 py-1.5 text-ink-300">{m.size || '—'}</td>
                      {/* Thickness */}
                      <td className="px-3 py-1.5 text-ink-300">{m.thickness ? `${m.thickness}${String(m.thickness).includes('mm') ? '' : 'mm'}` : '—'}</td>
                      {/* Color */}
                      <td className="px-3 py-1.5 text-ink-300">{m.color || '—'}</td>
                      {/* Category */}
                      <td className="px-3 py-1.5">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                          style={{ background: cc.bg, color: cc.text }}
                        >
                          {m.category}
                        </span>
                      </td>
                      {/* Subcategory */}
                      <td className="px-3 py-1.5 text-ink-300 capitalize">{m.subcategory || '—'}</td>
                      {/* Cost/Unit */}
                      <td className="px-3 py-1.5 text-right text-ink-100 font-mono">
                        {m.cost_per_unit > 0 ? `£${Number(m.cost_per_unit).toFixed(2)}` : '—'}
                      </td>
                      {/* Actions */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => setShowForm(m)}
                            className="text-ink-400 hover:text-ink-200 transition-colors text-[11px] p-1"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(m)}
                            className="text-ink-400 hover:text-red-400 transition-colors text-[11px] p-1"
                            title="Delete"
                          >
                            ✕
                          </button>
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
              <span>
                Showing {filtered.length} of {materials.length} materials
                {categoryFilter && ` · Filtered by "${categoryFilter}"`}
                {subcategoryFilter && ` > "${subcategoryFilter}"`}
              </span>
              <span>
                🔗 JC = Imported from Joinery Core
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Add / Edit Modal */}
      {showForm && (
        <MaterialFormModal
          material={showForm !== 'add' ? showForm : null}
          existingCategories={categories}
          existingSubcategories={subcategoriesByCategory}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete === 'bulk' ? `Delete ${selected.size} materials?` : `Delete "${confirmDelete.name}"?`}
          message={
            confirmDelete === 'bulk'
              ? `This will permanently remove ${selected.size} selected materials from the catalog.`
              : `This will permanently remove ${confirmDelete.item_number} from the materials catalog.`
          }
          onConfirm={confirmDeleteAction}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {/* Manage Categories modal */}
      {showCategories && (
        <ManageCategoriesModal onClose={() => setShowCategories(false)} />
      )}
    </>
  );
}
