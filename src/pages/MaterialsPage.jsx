import { useState, useEffect, useMemo } from 'react';
import { useMaterialStore, MATERIAL_CATEGORIES, MATERIAL_UNITS } from '../stores/materialStore.js';

// ─── Category colors (matching dashboard type colors) ───
const CAT_COLORS = {
  timber:      { bg: 'rgba(239,159,39,0.12)', border: 'rgba(239,159,39,0.3)', text: '#FAC775' },
  ironmongery: { bg: 'rgba(127,119,221,0.12)', border: 'rgba(127,119,221,0.3)', text: '#AFA9EC' },
  glass:       { bg: 'rgba(55,138,221,0.12)',  border: 'rgba(55,138,221,0.3)',  text: '#85B7EB' },
  consumables: { bg: 'rgba(29,158,117,0.12)',  border: 'rgba(29,158,117,0.3)',  text: '#5DCAA5' },
};
const catColor = (cat) => CAT_COLORS[cat] || CAT_COLORS.consumables;

// ─── Confirmation Modal (reused pattern) ───
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

// ─── Add / Edit Modal ───
function MaterialFormModal({ material, onSave, onCancel }) {
  const isEdit = !!material;
  const [form, setForm] = useState({
    name: material?.name || '',
    category: material?.category || 'ironmongery',
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

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
    });
  };

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
              <select className="input text-xs w-full" value={form.category} onChange={(e) => update('category', e.target.value)}>
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Subcategory</label>
              <input className="input text-xs w-full" value={form.subcategory} onChange={(e) => update('subcategory', e.target.value)} placeholder="e.g. sash-locks" />
            </div>
          </div>

          {/* Size + Thickness + Color */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Size</label>
              <input className="input text-xs w-full" value={form.size} onChange={(e) => update('size', e.target.value)} placeholder="e.g. 63 x 63 mm" />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Thickness</label>
              <input className="input text-xs w-full" value={form.thickness} onChange={(e) => update('thickness', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Color / Finish</label>
              <input className="input text-xs w-full" value={form.color} onChange={(e) => update('color', e.target.value)} placeholder="e.g. Chrome" />
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

          {/* JC UUID */}
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-1">Joinery Core UUID</label>
            <input className="input text-xs w-full font-mono" value={form.jc_uuid} onChange={(e) => update('jc_uuid', e.target.value)} placeholder="Auto-filled on import from JC" />
          </div>

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
  const loadMaterials = useMaterialStore((s) => s.loadMaterials);
  const addMaterial = useMaterialStore((s) => s.addMaterial);
  const updateMaterial = useMaterialStore((s) => s.updateMaterial);
  const deleteMaterial = useMaterialStore((s) => s.deleteMaterial);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);     // false | 'add' | material object (edit)
  const [confirmDelete, setConfirmDelete] = useState(null); // material to delete
  const [menuOpen, setMenuOpen] = useState(null);      // material id with open menu

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Filtered + searched materials
  const filtered = useMemo(() => {
    let list = materials;
    if (categoryFilter) list = list.filter((m) => m.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.item_number?.toLowerCase().includes(q) ||
          m.color?.toLowerCase().includes(q) ||
          m.size?.toLowerCase().includes(q) ||
          m.subcategory?.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [materials, categoryFilter, searchQuery]);

  // Category counts
  const counts = useMemo(() => {
    const c = { all: materials.length };
    MATERIAL_CATEGORIES.forEach((cat) => {
      c[cat.id] = materials.filter((m) => m.category === cat.id).length;
    });
    return c;
  }, [materials]);

  const handleSave = (data) => {
    if (showForm && showForm !== 'add' && showForm.id) {
      // Edit mode
      updateMaterial(showForm.id, data);
    } else {
      // Add mode
      addMaterial(data);
    }
    setShowForm(false);
  };

  const handleDelete = (material) => {
    setMenuOpen(null);
    setConfirmDelete(material);
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
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
          const count = useMaterialStore.getState().importFromCSV(data);
          alert(`Imported ${count} new materials. Existing items updated by JC UUID.`);
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
    a.download = 'sash-planner-materials.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Materials catalog</h1>
            <p className="text-[10px] text-ink-400 mt-0.5">{materials.length} items across {MATERIAL_CATEGORIES.length} categories</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleImportCSV} className="btn btn-secondary text-xs">
              ↑ Import from JC
            </button>
            <button onClick={handleExportCSV} className="btn btn-secondary text-xs">
              ↓ Export CSV
            </button>
            <button onClick={() => setShowForm('add')} className="btn btn-primary text-xs">
              + Add material
            </button>
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCategoryFilter('')}
            className={`text-[11px] px-3 py-1 rounded-full transition-colors ${
              !categoryFilter ? 'bg-surface-600 text-ink-50' : 'bg-surface-700/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            All ({counts.all})
          </button>
          {MATERIAL_CATEGORIES.map((cat) => {
            const cc = catColor(cat.id);
            const isActive = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(isActive ? '' : cat.id)}
                className="text-[11px] px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
                style={{
                  background: isActive ? cc.bg : 'transparent',
                  color: isActive ? cc.text : '#6B7385',
                  border: isActive ? `0.5px solid ${cc.border}` : '0.5px solid transparent',
                }}
              >
                <span>{cat.icon}</span>
                {cat.label} ({counts[cat.id] || 0})
              </button>
            );
          })}
        </div>

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
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium w-8"></th>
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium">Item #</th>
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium">Name</th>
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium">Category</th>
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium">Spec</th>
                  <th className="px-3 py-2.5 text-left text-ink-400 font-medium">Unit</th>
                  <th className="px-3 py-2.5 text-right text-ink-400 font-medium">Price</th>
                  <th className="px-3 py-2.5 text-center text-ink-400 font-medium">JC</th>
                  <th className="px-2 py-2.5 text-center text-ink-400 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-ink-400">
                      {searchQuery || categoryFilter ? 'No materials match your search.' : 'No materials yet. Add your first material.'}
                    </td>
                  </tr>
                )}
                {filtered.map((m) => {
                  const cc = catColor(m.category);
                  const spec = [m.color, m.size, m.thickness].filter(Boolean).join(' · ') || '—';
                  return (
                    <tr key={m.id} className="border-b border-surface-500/50 hover:bg-surface-700/30">
                      {/* Image */}
                      <td className="px-3 py-2">
                        {m.image_url ? (
                          <img src={m.image_url} alt="" className="w-7 h-7 rounded object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-surface-600 grid place-items-center text-[10px] text-ink-400">
                            {MATERIAL_CATEGORIES.find((c) => c.id === m.category)?.icon || '📦'}
                          </div>
                        )}
                      </td>
                      {/* Item # */}
                      <td className="px-3 py-2 text-ink-400 font-mono text-[10px]">{m.item_number}</td>
                      {/* Name */}
                      <td className="px-3 py-2 text-ink-100 font-medium">{m.name}</td>
                      {/* Category */}
                      <td className="px-3 py-2">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: cc.bg, color: cc.text }}
                        >
                          {MATERIAL_CATEGORIES.find((c) => c.id === m.category)?.label || m.category}
                        </span>
                      </td>
                      {/* Spec */}
                      <td className="px-3 py-2 text-ink-300">{spec}</td>
                      {/* Unit */}
                      <td className="px-3 py-2 text-ink-300">{m.unit}</td>
                      {/* Price */}
                      <td className="px-3 py-2 text-right text-ink-100 font-mono">
                        {m.cost_per_unit > 0 ? `£${m.cost_per_unit.toFixed(2)}` : '—'}
                      </td>
                      {/* JC link */}
                      <td className="px-3 py-2 text-center">
                        {m.jc_uuid ? (
                          <span className="text-green-400 text-xs" title={`JC: ${m.jc_uuid}`}>🔗</span>
                        ) : (
                          <span className="text-ink-500 text-xs" title="Not linked to JC">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-2 py-2 text-center relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                          className="text-ink-400 hover:text-ink-200 transition-colors text-sm"
                        >
                          ⋮
                        </button>
                        {menuOpen === m.id && (
                          <div className="absolute right-2 top-8 z-20 bg-surface-700 border border-surface-500 rounded-lg shadow-xl py-1 min-w-[100px]">
                            <button
                              onClick={() => { setMenuOpen(null); setShowForm(m); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-ink-200 hover:bg-surface-600 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(m)}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-surface-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-surface-500 text-[10px] text-ink-400">
              Showing {filtered.length} of {materials.length} materials
              {categoryFilter && ` · Filtered by ${MATERIAL_CATEGORIES.find((c) => c.id === categoryFilter)?.label}`}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex gap-4 text-[10px] text-ink-400">
          <span>🔗 = Linked to Joinery Core (has UUID)</span>
          <span>— = Local only (no JC connection)</span>
        </div>
      </div>

      {/* Close menu on outside click */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <MaterialFormModal
          material={showForm !== 'add' ? showForm : null}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message={`This will permanently remove ${confirmDelete.item_number} from the materials catalog.`}
          onConfirm={() => { deleteMaterial(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
