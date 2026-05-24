import { useState, useMemo } from 'react';
import { useMaterialStore } from '../stores/materialStore.js';

// ─── Confirmation modal ───
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

export default function ManageCategoriesPage() {
  const materials = useMaterialStore((s) => s.materials);
  const renameCategory = useMaterialStore((s) => s.renameCategory);
  const canDeleteCategory = useMaterialStore((s) => s.canDeleteCategory);
  const renameSubcategory = useMaterialStore((s) => s.renameSubcategory);
  const canDeleteSubcategory = useMaterialStore((s) => s.canDeleteSubcategory);

  const [editingCat, setEditingCat] = useState(null); // { name, draft }
  const [editingSub, setEditingSub] = useState(null); // { category, name, draft }
  const [confirmAction, setConfirmAction] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});

  // Build category → subcategories map with counts
  const categoryMap = useMemo(() => {
    const map = {};
    materials.forEach((m) => {
      if (!m.category) return;
      if (!map[m.category]) map[m.category] = { count: 0, subcategories: {} };
      map[m.category].count++;
      if (m.subcategory) {
        if (!map[m.category].subcategories[m.subcategory]) {
          map[m.category].subcategories[m.subcategory] = 0;
        }
        map[m.category].subcategories[m.subcategory]++;
      }
    });
    return map;
  }, [materials]);

  const categoryNames = Object.keys(categoryMap).sort();

  const toggleExpand = (cat) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // ─── Rename category ───
  const handleRenameCatSave = () => {
    if (!editingCat) return;
    const trimmed = editingCat.draft.trim();
    if (!trimmed || trimmed === editingCat.name) {
      setEditingCat(null);
      return;
    }
    renameCategory(editingCat.name, trimmed);
    setEditingCat(null);
  };

  // ─── Delete category ───
  const handleDeleteCategory = (catName) => {
    const canDelete = canDeleteCategory(catName);
    if (!canDelete) {
      setConfirmAction({
        title: `Cannot delete "${catName}"`,
        message: `This category has ${categoryMap[catName]?.count || 0} materials assigned. Move or delete them first.`,
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    // Category with 0 materials — nothing to delete (it's derived)
    setConfirmAction(null);
  };

  // ─── Rename subcategory ───
  const handleRenameSubSave = () => {
    if (!editingSub) return;
    const trimmed = editingSub.draft.trim();
    if (!trimmed || trimmed === editingSub.name) {
      setEditingSub(null);
      return;
    }
    renameSubcategory(editingSub.category, editingSub.name, trimmed);
    setEditingSub(null);
  };

  // ─── Delete subcategory ───
  const handleDeleteSubcategory = (cat, sub) => {
    const canDelete = canDeleteSubcategory(cat, sub);
    if (!canDelete) {
      setConfirmAction({
        title: `Cannot delete "${sub}"`,
        message: `This subcategory has ${categoryMap[cat]?.subcategories[sub] || 0} materials assigned. Move or delete them first.`,
        onConfirm: () => setConfirmAction(null),
      });
      return;
    }
    setConfirmAction(null);
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-ink-50">Manage Categories</h1>
        <p className="text-[10px] text-ink-400 mt-0.5">
          Rename or delete categories and subcategories. Categories with assigned materials cannot be deleted.
        </p>
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {categoryNames.length === 0 && (
          <div className="card p-6 text-center text-sm text-ink-400">
            No categories yet. Add materials in the Production Materials catalog to create categories.
          </div>
        )}

        {categoryNames.map((catName) => {
          const catData = categoryMap[catName];
          const subs = Object.keys(catData.subcategories).sort();
          const isExpanded = expandedCats[catName];
          const isEditing = editingCat?.name === catName;

          return (
            <div key={catName} className="card overflow-hidden">
              {/* Category row */}
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-800">
                <button
                  onClick={() => toggleExpand(catName)}
                  className="text-ink-400 hover:text-ink-200 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

                {isEditing ? (
                  <input
                    className="flex-1 text-sm font-medium text-ink-50 bg-surface-700 border border-surface-500 rounded px-2 py-0.5 outline-none focus:border-accent-500"
                    value={editingCat.draft}
                    onChange={(e) => setEditingCat({ ...editingCat, draft: e.target.value })}
                    onBlur={handleRenameCatSave}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCatSave(); if (e.key === 'Escape') setEditingCat(null); }}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium text-ink-50">{catName}</span>
                )}

                <span className="text-[10px] text-ink-400 bg-surface-700 px-2 py-0.5 rounded-full">
                  {catData.count} material{catData.count !== 1 ? 's' : ''}
                </span>

                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingCat({ name: catName, draft: catName })}
                      className="w-6 h-6 rounded flex items-center justify-center text-ink-400 hover:text-accent-400 hover:bg-accent-500/10 transition-colors"
                      title="Rename"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(catName)}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        catData.count > 0
                          ? 'text-ink-400/30 cursor-not-allowed'
                          : 'text-ink-400 hover:text-red-400 hover:bg-red-500/10'
                      }`}
                      title={catData.count > 0 ? 'Cannot delete — has materials' : 'Delete'}
                      disabled={catData.count > 0}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Subcategories */}
              {isExpanded && (
                <div className="border-t border-surface-500/50">
                  {subs.length === 0 && (
                    <div className="px-4 py-2 pl-10 text-[11px] text-ink-400 italic">No subcategories</div>
                  )}
                  {subs.map((subName) => {
                    const subCount = catData.subcategories[subName];
                    const isEditingSub_ = editingSub?.category === catName && editingSub?.name === subName;

                    return (
                      <div key={subName} className="flex items-center gap-3 px-4 py-2 pl-10 hover:bg-surface-700/30 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-ink-400/40 shrink-0" />

                        {isEditingSub_ ? (
                          <input
                            className="flex-1 text-xs text-ink-200 bg-surface-700 border border-surface-500 rounded px-2 py-0.5 outline-none focus:border-accent-500"
                            value={editingSub.draft}
                            onChange={(e) => setEditingSub({ ...editingSub, draft: e.target.value })}
                            onBlur={handleRenameSubSave}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubSave(); if (e.key === 'Escape') setEditingSub(null); }}
                            autoFocus
                          />
                        ) : (
                          <span className="flex-1 text-xs text-ink-200">{subName}</span>
                        )}

                        <span className="text-[9px] text-ink-400">{subCount}</span>

                        {!isEditingSub_ && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingSub({ category: catName, name: subName, draft: subName })}
                              className="w-5 h-5 rounded flex items-center justify-center text-ink-400 hover:text-accent-400 hover:bg-accent-500/10 transition-colors"
                              title="Rename"
                            >
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSubcategory(catName, subName)}
                              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                subCount > 0
                                  ? 'text-ink-400/30 cursor-not-allowed'
                                  : 'text-ink-400 hover:text-red-400 hover:bg-red-500/10'
                              }`}
                              title={subCount > 0 ? 'Cannot delete — has materials' : 'Delete'}
                              disabled={subCount > 0}
                            >
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add subcategory — info */}
                  <div className="px-4 py-2 pl-10 text-[10px] text-ink-400/60 italic">
                    Add subcategories via Production Materials catalog
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="mt-6 card p-4 bg-surface-800/60">
        <div className="text-[11px] text-ink-400 leading-relaxed">
          <strong className="text-ink-300">Note:</strong> Categories are derived from materials in the Production Materials catalog.
          To create a new category, add a material with that category name in the catalog.
          Categories with assigned materials cannot be deleted — move or remove the materials first.
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
