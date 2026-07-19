import { useState, useMemo } from 'react';
import NumInput from '../components/NumInput.jsx';
import { useParams } from 'react-router-dom';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, SASH_WINDOW_PARTS, ALL_PARTS, CASEMENT_PARTS, CASEMENT_ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { liveSectionsFor } from '../engine/partRegistry.js';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';

const TYPE_LABELS = {
  sash: 'Sash Windows',
  casement: 'Casement',
  'fix-frame': 'Fix Frame',
  doors: 'Doors',
  other: 'Other',
};

// ─── Part Row ───
function PartRow({ part, assignment, materials, categories, subcategoriesByCategory, onAssign, onFilter, onYieldChange, onRemove, disabled }) {
  const selCat = assignment?.category || '';
  const selSub = assignment?.subcategory || '';

  // Filter materials by selected category + subcategory
  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (selCat) list = list.filter((m) => m.category === selCat);
    if (selSub) list = list.filter((m) => m.subcategory === selSub);
    return list;
  }, [materials, selCat, selSub]);

  const subcategories = selCat ? (subcategoriesByCategory[selCat] || []) : [];
  const sashProfile = useWindowProfileStore((s) => s.sash);
  const live = liveSectionsFor(part.id, sashProfile);
  const assignedMat = assignment?.material_id
    ? materials.find((m) => m.id === assignment.material_id)
    : null;

  return (
    <tr className={`border-b border-surface-500/50 transition-colors ${
      part.optional ? 'opacity-60 hover:opacity-100' : ''
    } ${assignment?.material_id ? 'hover:bg-surface-700/30' : 'hover:bg-surface-700/20'}`}>
      {/* Part name */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-ink-100 font-medium">{part.name}</span>
          {part.optional && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 uppercase tracking-wider">opt</span>
          )}
          {part.mirror && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 uppercase tracking-wider">mirror</span>
          )}
        </div>
        {(live?.finishedSection || part.finishedSection) && (
          <div className="text-[10px] text-ink-400 mt-0.5">finished: {live?.finishedSection ?? part.finishedSection}</div>
        )}
      </td>

      {/* Section (pre-cut) */}
      <td className="px-3 py-2 font-mono text-[11px] text-ink-300">{live?.section ?? part.section}</td>

      {/* Pcs */}
      <td className="px-3 py-2 text-center text-ink-300">{part.pcs}</td>

      {/* Category filter */}
      <td className="px-3 py-2">
        <select
          className="input text-[11px] w-full"
          value={selCat}
          disabled={disabled}
          onChange={(e) => {
            onFilter(part.id, e.target.value, '');
            // Clear material if category changed
            if (assignment?.material_id) onRemove(part.id);
          }}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>

      {/* Subcategory filter */}
      <td className="px-3 py-2">
        <select
          className="input text-[11px] w-full"
          value={selSub}
          onChange={(e) => {
            onFilter(part.id, selCat, e.target.value);
            if (assignment?.material_id) onRemove(part.id);
          }}
          disabled={disabled || !selCat}
        >
          <option value="">All</option>
          {subcategories.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>

      {/* Material dropdown (filtered) */}
      <td className="px-3 py-2">
        <select
          className="input text-xs w-full"
          value={assignment?.material_id || ''}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) {
              onAssign(part.id, e.target.value, assignment?.yield || 1.0, selCat, selSub);
            } else {
              onRemove(part.id);
            }
          }}
        >
          <option value="">— Select material —</option>
          {filteredMaterials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.item_number} — {m.name} {m.size ? `(${m.size})` : ''} {m.cost_per_unit > 0 ? `£${Number(m.cost_per_unit).toFixed(2)}/${m.unit}` : ''}
            </option>
          ))}
        </select>
        {assignedMat && (
          <div className="text-[10px] text-ink-400 mt-0.5 flex items-center gap-2">
            <span>{assignedMat.size || '—'}</span>
            {assignedMat.jc_uuid && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>
            )}
          </div>
        )}
      </td>

      {/* Yield */}
      <td className="px-3 py-2 text-center">
        <NumInput
          step="0.05"
          min="0.01"
          max="10"
          className="input text-xs w-[60px] text-center font-mono"
          value={assignment?.yield ?? 1.0}
          onCommit={(v) => {
            const val = parseFloat(v);
            if (!isNaN(val) && val > 0) onYieldChange(part.id, val);
          }}
          disabled={disabled || !assignment?.material_id}
        />
      </td>

      {/* Status */}
      <td className="px-3 py-2 text-center">
        {assignment?.material_id ? (
          <span className="text-green-400 text-sm" title="Assigned">✓</span>
        ) : (
          <span className="text-ink-500 text-sm" title="Not assigned">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Part Group Section ───
function PartGroupSection({ title, subtitle, parts, assignments, materials, categories, subcategoriesByCategory, onAssign, onFilter, onYieldChange, onRemove, disabled }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold text-ink-50">{title}</h2>
        <span className="text-[10px] text-ink-400">{subtitle}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/50">
                <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[180px]">Part</th>
                <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[80px]">Section</th>
                <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[40px]">Pcs</th>
                <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[120px]">Category</th>
                <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[120px]">Subcategory</th>
                <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider">Material</th>
                <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[80px]">Yield</th>
                <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  assignment={assignments[part.id]}
                  materials={materials}
                  categories={categories}
                  subcategoriesByCategory={subcategoriesByCategory}
                  onAssign={onAssign}
                  onFilter={onFilter}
                  onYieldChange={onYieldChange}
                  onRemove={onRemove}
                  disabled={disabled}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main ───
export default function MaterialAssignmentsPage() {
  const { typeId = 'sash' } = useParams();
  const typeName = TYPE_LABELS[typeId] || typeId;
  const isSash = typeId === 'sash';

  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const setAssignment = useMaterialAssignmentStore((s) => s.setAssignment);
  const setFilter = useMaterialAssignmentStore((s) => s.setFilter);
  const setYield = useMaterialAssignmentStore((s) => s.setYield);
  const removeAssignment = useMaterialAssignmentStore((s) => s.removeAssignment);
  const clearAll = useMaterialAssignmentStore((s) => s.clearAll);

  const [confirmClear, setConfirmClear] = useState(false);
  const [locked, setLocked] = useState(true);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  // Dynamic categories from all materials
  const categories = useMemo(() => {
    const s = new Set();
    materials.forEach((m) => { if (m.category) s.add(m.category); });
    return [...s].sort();
  }, [materials]);

  // Subcategories grouped by category
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

  // Stats — only for current type
  const isCasement = typeId === 'casement';
  const typeParts = isSash ? ALL_PARTS : isCasement ? CASEMENT_ALL_PARTS : [];
  const totalParts = typeParts.length;
  const assignedCount = typeParts.filter((p) => assignments[p.id]?.material_id).length;
  const requiredParts = typeParts.filter((p) => !p.optional);
  const requiredAssigned = requiredParts.filter((p) => assignments[p.id]?.material_id).length;

  // Coming soon for non-sash types
  if (!isSash) {
    return (
      <div className="p-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-ink-50">Material Assignments — {typeName}</h1>
          <p className="text-[10px] text-ink-400 mt-0.5">Assign materials for {typeName} parts</p>
        </div>
        <div className="card p-12 text-center">
          <div className="text-3xl mb-4">🚧</div>
          <div className="text-lg font-semibold text-ink-200 mb-2">{typeName} — coming soon</div>
          <div className="text-sm text-ink-400 max-w-md mx-auto">
            Parts list for {typeName} is being built. Sash Windows assignments are available now.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Material Assignments — {typeName}</h1>
            <p className="text-[10px] text-ink-400 mt-0.5">
              Assign materials from catalog to each part · {typeName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-ink-200">
                <span className={requiredAssigned === requiredParts.length ? 'text-green-400' : 'text-yellow-400'}>
                  {assignedCount}
                </span>
                <span className="text-ink-400"> / {totalParts} assigned</span>
              </div>
              <div className="w-[120px] h-1.5 bg-surface-600 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    requiredAssigned === requiredParts.length ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${(assignedCount / totalParts) * 100}%` }}
                />
              </div>
            </div>
            {!locked && (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
                disabled={assignedCount === 0}
              >
                Clear all
              </button>
            )}
            {locked ? (
              <button
                onClick={() => setConfirmUnlock(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-600 text-ink-300 border border-surface-500 hover:bg-surface-500 transition-colors"
              >
                🔒 Locked
              </button>
            ) : (
              <button
                onClick={() => setLocked(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                🔓 Editing
              </button>
            )}
          </div>
        </div>

        {/* Warning if no materials */}
        {materials.length === 0 && (
          <div className="card p-4 mb-5 border-yellow-500/30 bg-yellow-500/5">
            <div className="text-xs text-yellow-400">
              No materials in catalog. Import from Joinery Core or add manually in Materials → Catalog first.
            </div>
          </div>
        )}

        {isCasement && (
          <>
            <PartGroupSection
              title="🪵 Frame"
              subtitle={`${CASEMENT_PARTS.frame.length} parts · head, jambs, cill`}
              parts={CASEMENT_PARTS.frame}
              assignments={assignments}
              materials={materials}
              categories={categories}
              subcategoriesByCategory={subcategoriesByCategory}
              onAssign={setAssignment}
              onFilter={setFilter}
              onYield={setYield}
            />
            <PartGroupSection
              title="🪵 Sash"
              subtitle={`${CASEMENT_PARTS.sash.length} parts · stiles, rails`}
              parts={CASEMENT_PARTS.sash}
              assignments={assignments}
              materials={materials}
              categories={categories}
              subcategoriesByCategory={subcategoriesByCategory}
              onAssign={setAssignment}
              onFilter={setFilter}
              onYield={setYield}
            />
          </>
        )}

        {isSash && <>
        {/* Box Frame */}
        <PartGroupSection
          title="🪵 Box Frame"
          subtitle={`${SASH_WINDOW_PARTS.box.length} parts · frame, cill, liners · head/jambs per frame type`}
          parts={SASH_WINDOW_PARTS.box}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
        />

        {/* Sash */}
        <PartGroupSection
          title="🪵 Sash"
          subtitle={`${SASH_WINDOW_PARTS.sash.length} parts · rails, stiles`}
          parts={SASH_WINDOW_PARTS.sash}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
        />

        {/* Beading */}
        <PartGroupSection
          title="📏 Beading"
          subtitle={`${SASH_WINDOW_PARTS.beading.length} parts · glazing, triangle, parting, staff, meeting`}
          parts={SASH_WINDOW_PARTS.beading}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
        />

        {/* Glass */}
        <PartGroupSection
          title="🪟 Glass"
          subtitle={`${SASH_WINDOW_PARTS.glass.length} types · double, slim, triple, single, passive`}
          parts={SASH_WINDOW_PARTS.glass}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
        />

        {/* Paint */}
        <PartGroupSection
          title="🎨 Paint"
          subtitle={`${SASH_WINDOW_PARTS.paint.length} types · primer, white 9016, bespoke`}
          parts={SASH_WINDOW_PARTS.paint}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
        />

        {/* Consumables */}
        <PartGroupSection
          title="🔩 Consumables"
          subtitle={`${SASH_WINDOW_PARTS.consumables.length} items · cord, clips, spacers, tape, silicone, weights`}
          parts={SASH_WINDOW_PARTS.consumables}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
        />
        </>}

        {/* Legend */}
        <div className="mt-3 flex gap-4 flex-wrap text-[10px] text-ink-400">
          <span><span className="px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[8px]">mirror</span> — L/R mirror cutting pair</span>
          <span><span className="px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 text-[8px]">opt</span> — optional part</span>
          <span>Yield = material multiplier (0.5 = rip in half, 1.0 = full board)</span>
        </div>
      </div>

      {/* Confirm clear modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmClear(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-ink-50 mb-2">Clear all assignments?</div>
            <div className="text-xs text-ink-300 mb-4">This will remove all material assignments and filters.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClear(false)} className="btn btn-secondary text-xs px-4">Cancel</button>
              <button onClick={() => { clearAll(); setConfirmClear(false); }} className="text-xs px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">Clear all</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm unlock modal */}
      {confirmUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmUnlock(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-ink-50 mb-2">Unlock material assignments?</div>
            <div className="text-xs text-ink-300 mb-4">Changes to assignments will affect all BOM calculations across projects. Make sure you know what you are doing.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmUnlock(false)} className="btn btn-secondary text-xs px-4">Cancel</button>
              <button onClick={() => { setLocked(false); setConfirmUnlock(false); }} className="text-xs px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors">Unlock</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
