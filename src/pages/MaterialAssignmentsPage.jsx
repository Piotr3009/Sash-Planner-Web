import { useState, useMemo } from 'react';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, SASH_WINDOW_PARTS, ALL_PARTS } from '../stores/materialAssignmentStore.js';

// ─── Part Group Section ───
function PartGroupSection({ title, subtitle, parts, assignments, timberMaterials, onAssign, onYieldChange, onRemove }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold text-ink-50">{title}</h2>
        <span className="text-[10px] text-ink-400">{subtitle}</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-500 bg-surface-700/50">
              <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[200px]">Part</th>
              <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[90px]">Section</th>
              <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[50px]">Pcs</th>
              <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[70px]">Type</th>
              <th className="px-3 py-2.5 text-left text-ink-400 font-medium uppercase text-[10px] tracking-wider">Assigned Material</th>
              <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[80px]">Yield</th>
              <th className="px-3 py-2.5 text-center text-ink-400 font-medium uppercase text-[10px] tracking-wider w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => {
              const assignment = assignments[part.id];
              const assignedMat = assignment
                ? timberMaterials.find((m) => m.id === assignment.material_id)
                : null;

              return (
                <tr
                  key={part.id}
                  className={`border-b border-surface-500/50 transition-colors ${
                    part.optional ? 'opacity-60 hover:opacity-100' : ''
                  } ${assignment ? 'hover:bg-surface-700/30' : 'hover:bg-surface-700/20'}`}
                >
                  {/* Part name */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-100 font-medium">{part.name}</span>
                      {part.optional && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 uppercase tracking-wider">
                          opt
                        </span>
                      )}
                      {part.mirror && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 uppercase tracking-wider">
                          mirror
                        </span>
                      )}
                    </div>
                    {part.finishedSection && (
                      <div className="text-[10px] text-ink-400 mt-0.5">
                        finished: {part.finishedSection}
                      </div>
                    )}
                  </td>

                  {/* Section (pre-cut) */}
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-300">{part.section}</td>

                  {/* Pcs per window */}
                  <td className="px-3 py-2 text-center text-ink-300">{part.pcs}</td>

                  {/* Material type */}
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      part.materialType === 'hardwood'
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-green-500/15 text-green-400'
                    }`}>
                      {part.materialType}
                    </span>
                  </td>

                  {/* Material dropdown */}
                  <td className="px-3 py-2">
                    <select
                      className="input text-xs w-full max-w-[300px]"
                      value={assignment?.material_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          onAssign(part.id, e.target.value, assignment?.yield || 1.0);
                        } else {
                          onRemove(part.id);
                        }
                      }}
                    >
                      <option value="">— Not assigned —</option>
                      {timberMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.item_number} — {m.name} {m.size ? `(${m.size})` : ''} {m.cost_per_unit > 0 ? `£${Number(m.cost_per_unit).toFixed(2)}/${m.unit}` : ''}
                        </option>
                      ))}
                    </select>
                    {assignedMat && (
                      <div className="text-[10px] text-ink-400 mt-0.5 flex items-center gap-2">
                        <span>{assignedMat.size || '—'}</span>
                        {assignedMat.jc_uuid && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25">JC</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Yield */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      max="10"
                      className="input text-xs w-[60px] text-center font-mono"
                      value={assignment?.yield ?? 1.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onYieldChange(part.id, val);
                        }
                      }}
                      disabled={!assignment}
                    />
                  </td>

                  {/* Status indicator */}
                  <td className="px-3 py-2 text-center">
                    {assignment ? (
                      <span className="text-green-400 text-sm" title="Assigned">✓</span>
                    ) : (
                      <span className="text-ink-500 text-sm" title="Not assigned">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main ───
export default function MaterialAssignmentsPage() {
  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const setAssignment = useMaterialAssignmentStore((s) => s.setAssignment);
  const setYield = useMaterialAssignmentStore((s) => s.setYield);
  const removeAssignment = useMaterialAssignmentStore((s) => s.removeAssignment);
  const clearAll = useMaterialAssignmentStore((s) => s.clearAll);

  const [confirmClear, setConfirmClear] = useState(false);

  // Filter timber materials only
  const timberMaterials = useMemo(() => {
    return materials.filter((m) =>
      m.category?.toLowerCase() === 'timber'
    );
  }, [materials]);

  // Stats
  const totalParts = ALL_PARTS.length;
  const assignedCount = ALL_PARTS.filter((p) => assignments[p.id]).length;
  const requiredParts = ALL_PARTS.filter((p) => !p.optional);
  const requiredAssigned = requiredParts.filter((p) => assignments[p.id]).length;

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Material Assignments</h1>
            <p className="text-[10px] text-ink-400 mt-0.5">
              Assign timber from catalog to each window part · Sash window template
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress */}
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

            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
              disabled={assignedCount === 0}
            >
              Clear all
            </button>
          </div>
        </div>

        {/* Warning if no timber materials */}
        {timberMaterials.length === 0 && (
          <div className="card p-4 mb-5 border-yellow-500/30 bg-yellow-500/5">
            <div className="text-xs text-yellow-400">
              No timber materials in catalog. Import from Joinery Core or add manually in Materials → Catalog first.
            </div>
          </div>
        )}

        {/* Box Frame section */}
        <PartGroupSection
          title="Box Frame"
          subtitle={`${SASH_WINDOW_PARTS.box.length} parts · frame, cill, liners`}
          parts={SASH_WINDOW_PARTS.box}
          assignments={assignments}
          timberMaterials={timberMaterials}
          onAssign={setAssignment}
          onYieldChange={setYield}
          onRemove={removeAssignment}
        />

        {/* Sash section */}
        <PartGroupSection
          title="Sash"
          subtitle={`${SASH_WINDOW_PARTS.sash.length} parts · rails, stiles`}
          parts={SASH_WINDOW_PARTS.sash}
          assignments={assignments}
          timberMaterials={timberMaterials}
          onAssign={setAssignment}
          onYieldChange={setYield}
          onRemove={removeAssignment}
        />

        {/* Legend */}
        <div className="mt-3 flex gap-4 flex-wrap text-[10px] text-ink-400">
          <span><span className="text-orange-400">●</span> hardwood</span>
          <span><span className="text-green-400">●</span> softwood</span>
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
            <div className="text-xs text-ink-300 mb-4">This will remove all material assignments. You'll need to reassign materials to every part.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClear(false)} className="btn btn-secondary text-xs px-4">Cancel</button>
              <button onClick={() => { clearAll(); setConfirmClear(false); }} className="text-xs px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">Clear all</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
