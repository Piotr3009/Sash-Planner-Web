import { useState, useMemo } from 'react';
import NumInput from '../components/NumInput.jsx';
import MaterialPicker from '../components/MaterialPicker.jsx';
import { useParams } from 'react-router-dom';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, SASH_WINDOW_PARTS, ALL_PARTS, CASEMENT_PARTS, CASEMENT_ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { liveSectionsFor, PART_REGISTRY, REGISTRY_VARIANTS } from '../engine/partRegistry.js';
import { deriveWindowData } from '../engine/calculations.js';
import { normaliseToWindowSpec } from '../engine/specification.js';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import JambDetail2D from '../components/drawings/JambDetail2D.jsx';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';

const TYPE_LABELS = {
  sash: 'Sash Windows',
  casement: 'Casement',
  'fix-frame': 'Fix Frame',
  doors: 'Doors',
  other: 'Other',
};

// ─── Part Row ───
// Base part lists generated from the registry — variant families collapse to
// ONE row (head, jambs, …) with an expandable per-variant panel. Static
// categories (beading/glass/paint/consumables) stay on their legacy lists.
const regPartsFor = (category) => Object.entries(PART_REGISTRY)
  .filter(([, d]) => d.category === category)
  .map(([id, d]) => ({
    id, name: d.label, pcs: d.pcs, materialType: d.materialType,
    optional: d.optional, note: d.note, mirror: d.mirror,
    variantAware: !!d.variantAware, section: '—',
  }));
const REG_BOX_PARTS = regPartsFor('box');
const REG_SASH_PARTS = regPartsFor('sash');

// drawingKey → registry part key, per drawing context (stiles/meeting are ambiguous)
function partForDrawingKey(dk, ctx) {
  if (dk === 'stiles') return ctx === 'lower' ? 'stiles_bottom_sash' : 'stiles_top_sash';
  if (dk === 'meetingRail') return ctx === 'lower' ? 'bottom_meet_rail' : 'top_meet_rail';
  const hit = Object.entries(PART_REGISTRY).find(([, d]) => d.drawingKey === dk);
  return hit ? hit[0] : null;
}

function PartRow({ part, assignment, materials, categories, subcategoriesByCategory, onAssign, onFilter, onYieldChange, onRemove, disabled, selected, onSelect }) {
  const [open, setOpen] = useState(false);
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
  const flat = useMaterialAssignmentStore((s) => s.assignments);

  // Variant families: header row is a SUMMARY only (no material name — every
  // workshop uses its own); the four equal selects live in the expansion.
  if (part.variantAware) {
    const ids = [part.id, ...Object.values(PART_REGISTRY[part.id]?.legacyVariantIds || {})];
    const mats = ids.map((id) => flat[id]?.material_id).filter(Boolean);
    const assignedN = mats.length;
    const distinct = new Set(mats).size;
    const status = assignedN === ids.length
      ? (distinct === 1 ? 'All variants assigned' : `${distinct} materials across variants`)
      : `${assignedN}/${ids.length} variants assigned`;
    return (
      <>
      <tr className={`border-b border-surface-400/60 transition-colors cursor-pointer ${
        selected ? 'bg-accent-500/10 border-l-2 border-l-accent-500' : 'hover:bg-surface-700/30'
      }`} onClick={() => onSelect?.(part.id)}>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              title={open ? 'Hide variants' : 'Show variants'}
              className="w-6 h-6 -ml-1 flex items-center justify-center rounded text-accent-400 hover:text-accent-300 hover:bg-surface-600 text-base shrink-0">
              {open ? '▾' : '▸'}
            </button>
            <span className="text-ink-100 font-medium">{part.name} materials</span>
          </div>
        </td>
        <td className="px-3 py-2 font-mono text-[11px] text-ink-500">—</td>
        <td className="px-3 py-2 text-center text-ink-300">{part.pcs}</td>
        <td></td><td></td>
        <td className="px-3 py-2 text-[11px] text-ink-300">{status}</td>
        <td></td>
        <td className="px-3 py-2 text-center">
          {assignedN === ids.length
            ? <span className="text-green-400" title="All variants assigned">✓</span>
            : <span className="text-ink-500" title="Not fully assigned">—</span>}
        </td>
      </tr>
      {open && REGISTRY_VARIANTS.map((vk) => (
        <VariantRow key={vk} part={part} vk={vk} materials={materials}
          categories={categories} subcategoriesByCategory={subcategoriesByCategory}
          onAssign={onAssign} onFilter={onFilter} onYieldChange={onYieldChange} onRemove={onRemove} disabled={disabled} />
      ))}
      </>
    );
  }

  return (
    <>
    <tr className={`border-b border-surface-400/60 transition-colors cursor-pointer ${
      part.optional ? 'opacity-60 hover:opacity-100' : ''
    } ${selected ? 'bg-accent-500/10 border-l-2 border-l-accent-500' : assignment?.material_id ? 'hover:bg-surface-700/30' : 'hover:bg-surface-700/20'}`}
      onClick={() => onSelect?.(part.id)}>
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
        <MaterialPicker
          materials={filteredMaterials}
          value={assignment?.material_id || ''}
          disabled={disabled}
          allowClear
          onSelect={(m) => (m ? onAssign(part.id, m.id, assignment?.yield || 1.0, selCat, selSub) : onRemove(part.id))}
          className="w-full"
        />
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
    </>
  );
}

// ─── Variant row — four equal selects; Standard is the anchor (base), the
// others follow it until the user picks something else for that variant. ───
function VariantRow({ part, vk, materials, categories, subcategoriesByCategory, onAssign, onFilter, onYieldChange, onRemove, disabled }) {
  const sashProfile = useWindowProfileStore((s) => s.sash);
  const flat = useMaterialAssignmentStore((s) => s.assignments);
  const overrides = useMaterialAssignmentStore((s) => s.data?.overrides);
  const legacyId = PART_REGISTRY[part.id]?.legacyVariantIds?.[vk] || null;
  const targetId = legacyId || part.id;           // standard edits the base
  const eff = flat[targetId];
  const hasOverride = !!(legacyId && overrides?.[part.id]?.[vk]);
  const live = liveSectionsFor(part.id, sashProfile, vk);
  const vLabel = sashProfile?.variants?.[vk]?.label || vk;
  const selCat = eff?.category || '';
  const selSub = eff?.subcategory || '';
  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (selCat) list = list.filter((m) => m.category === selCat);
    if (selSub) list = list.filter((m) => m.subcategory === selSub);
    return list;
  }, [materials, selCat, selSub]);
  const subcategories = selCat ? (subcategoriesByCategory[selCat] || []) : [];

  return (
    <tr className="border-b border-surface-500/60 bg-surface-800/60 text-[11px]">
      <td className="px-3 py-1.5">
        <span className="text-ink-300 pl-5">↳ {vLabel}</span>
      </td>
      <td className="px-3 py-1.5 font-mono text-ink-300">{live?.section || '—'}</td>
      <td></td>
      <td className="px-3 py-1.5">
        <select value={selCat} disabled={disabled}
          onChange={(e) => onFilter(targetId, e.target.value, '')}
          className="input text-[11px] w-full">
          <option value="">All</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <select value={selSub} disabled={disabled || !selCat}
          onChange={(e) => onFilter(targetId, selCat, e.target.value)}
          className="input text-[11px] w-full">
          <option value="">All</option>
          {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-3 py-1.5">
        <MaterialPicker
          materials={filteredMaterials}
          value={eff?.material_id || ''}
          disabled={disabled}
          onSelect={(m) => m && onAssign(targetId, m.id, eff?.yield ?? 1.0)}
          className="w-full max-w-[420px]"
        />
      </td>
      <td className="px-3 py-1.5 text-center">
        <NumInput step="0.05" min="0.01" max="10" value={eff?.yield ?? 1.0}
          onCommit={(v) => { const val = parseFloat(v); if (!isNaN(val) && val > 0) onYieldChange(targetId, val); }}
          disabled={disabled}
          className="input text-[11px] w-[60px] text-center font-mono" />
      </td>
      <td className="px-3 py-1.5 text-center">
        {hasOverride && (
          <button type="button" onClick={() => onRemove(legacyId)} disabled={disabled}
            title="Back to Standard material"
            className="text-ink-500 hover:text-red-400 text-xs">✕</button>
        )}
        {!legacyId && eff?.material_id && (
          <button type="button" onClick={() => onRemove(part.id)} disabled={disabled}
            title="Clear this part (all variants)"
            className="text-ink-500 hover:text-red-400 text-xs">✕</button>
        )}
      </td>
    </tr>
  );
}

// ─── Part Group Section ───
function PartGroupSection({ title, subtitle, parts, assignments, materials, categories, subcategoriesByCategory, onAssign, onFilter, onYieldChange, onRemove, disabled, selectedPart, onSelect }) {
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
                  selected={selectedPart === part.id}
                  onSelect={onSelect}
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

  // ── Split view: selected part ↔ drawings highlight ──
  const [selectedPart, setSelectedPart] = useState(null);
  const sashProfile = useWindowProfileStore((s) => s.sash);
  const drawingsSpec = useMemo(() => normaliseToWindowSpec({
    name: 'SAMPLE', width: 1000, height: 1500, frameType: 'standard', frameDepth: 164,
    sashType: 'double', glassType: 'double', upperBars: 'none', lowerBars: 'none',
    sameBars: true, hornType: 'A', openingType: 'both',
  }), []);
  const drawingsDerived = useMemo(() => {
    try { return deriveWindowData(drawingsSpec); } catch { return null; }
    // sashProfile in deps → drawings re-derive live when the workshop profile changes
  }, [drawingsSpec, sashProfile]);
  const selDrawKey = selectedPart ? (PART_REGISTRY[selectedPart]?.drawingKey || null) : null;
  const boxKeys = ['head', 'jambs', 'cill', 'extHeadLiner', 'intHeadLiner', 'extJambLiner', 'intJambLiner'];
  const sashKeys = ['stiles', 'topRail', 'meetingRail', 'bottomRail'];
  const extSel = boxKeys.includes(selDrawKey) && !selDrawKey.startsWith('int') ? selDrawKey : null;
  const intSel = boxKeys.includes(selDrawKey) && !selDrawKey.startsWith('ext') ? selDrawKey : null;
  const sashSel = sashKeys.includes(selDrawKey) ? selDrawKey : null;
  const toggleSelect = (id) => setSelectedPart((cur) => (cur === id ? null : id));
  const pickFromDrawing = (ctx) => (dk) => {
    const pid = partForDrawingKey(dk, ctx);
    if (pid) setSelectedPart(pid);
  };

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
  const typeParts = isSash
    ? [...REG_BOX_PARTS, ...REG_SASH_PARTS, ...SASH_WINDOW_PARTS.beading, ...SASH_WINDOW_PARTS.glass, ...SASH_WINDOW_PARTS.paint, ...SASH_WINDOW_PARTS.consumables]
    : isCasement ? CASEMENT_ALL_PARTS : [];
  // Counter counts EVERY unit (part × variant), not families — the base
  // assignment still fills all four variants in one click via inheritance,
  // so the counter tells the whole truth without extra clicking.
  const unitCounts = useMemo(() => {
    let total = 0, assigned = 0, reqTotal = 0, reqAssigned = 0;
    typeParts.forEach((p) => {
      const ids = p.variantAware
        ? [p.id, ...Object.values(PART_REGISTRY[p.id]?.legacyVariantIds || {})]
        : [p.id];
      ids.forEach((id) => {
        total += 1;
        const ok = !!assignments[id]?.material_id;
        if (ok) assigned += 1;
        if (!p.optional) { reqTotal += 1; if (ok) reqAssigned += 1; }
      });
    });
    return { total, assigned, reqTotal, reqAssigned };
  }, [typeParts, assignments]);
  const totalParts = unitCounts.total;
  const assignedCount = unitCounts.assigned;

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
                <span className={unitCounts.reqAssigned === unitCounts.reqTotal ? 'text-green-400' : 'text-yellow-400'}>
                  {assignedCount}
                </span>
                <span className="text-ink-400"> / {totalParts} assigned</span>
              </div>
              <div className="w-[120px] h-1.5 bg-surface-600 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    unitCounts.reqAssigned === unitCounts.reqTotal ? 'bg-green-500' : 'bg-yellow-500'
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

        {isSash && <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">
        {/* Box Frame */}
        <PartGroupSection
          title="🪵 Box Frame"
          subtitle={`${REG_BOX_PARTS.length} parts · one material per part covers every frame variant · ▸ = per-variant override`}
          parts={REG_BOX_PARTS}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
          selectedPart={selectedPart}
          onSelect={toggleSelect}
        />

        {/* Sash */}
        <PartGroupSection
          title="🪵 Sash"
          subtitle={`${SASH_WINDOW_PARTS.sash.length} parts · rails, stiles`}
          parts={REG_SASH_PARTS}
          assignments={assignments}
          materials={materials}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          onAssign={setAssignment}
          onFilter={setFilter}
          onYieldChange={setYield}
          onRemove={removeAssignment}
          disabled={locked}
          selectedPart={selectedPart}
          onSelect={toggleSelect}
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
          selectedPart={selectedPart}
          onSelect={toggleSelect}
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
          selectedPart={selectedPart}
          onSelect={toggleSelect}
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
          selectedPart={selectedPart}
          onSelect={toggleSelect}
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
          selectedPart={selectedPart}
          onSelect={toggleSelect}
        />
        </div>

        {/* Right: sticky drawings — click a row to see where the part lives */}
        <div className="hidden xl:block w-[520px] shrink-0 sticky top-4">
          <div className="text-[10px] text-ink-400 mb-2">Sample 1000 × 1500 · click a part row or a drawing element</div>
          <div className="grid grid-cols-2 gap-3">
            <BoxDetail2D windowSpec={drawingsSpec} derived={drawingsDerived} view="external"
              selectedElement={extSel} onElementClick={pickFromDrawing('box')} />
            <BoxDetail2D windowSpec={drawingsSpec} derived={drawingsDerived} view="internal"
              selectedElement={intSel} onElementClick={pickFromDrawing('box')} />
            <SashDetail2D windowSpec={drawingsSpec} derived={drawingsDerived} type="upper"
              selectedElement={sashSel} onElementClick={pickFromDrawing('upper')} />
            <SashDetail2D windowSpec={drawingsSpec} derived={drawingsDerived} type="lower"
              selectedElement={sashSel} onElementClick={pickFromDrawing('lower')} />
            <div className="col-span-2">
              <JambDetail2D
                boardWidth={sashProfile?.variants?.standard?.boardWidth ?? 141}
                thickness={sashProfile?.elements?.head?.thickness ?? 28}
                selectedElement={selDrawKey === 'head' || selDrawKey === 'jambs' ? selDrawKey : null}
                onElementClick={pickFromDrawing('box')} />
            </div>
          </div>
        </div>
        </div>}

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
