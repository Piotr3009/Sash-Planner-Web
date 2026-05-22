import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';


const TYPE_LABELS = { sash: 'Sash Windows', casement: 'Casement Windows', 'fix-frame': 'Fix Frame', doors: 'Doors', special: 'Special / Other' };
const STATUS_STYLES = {
  'preparation': { cls: 'badge-prep', icon: '📋' },
  'in-production': { cls: 'badge-active', icon: '🔧' },
  'complete': { cls: 'badge-done', icon: '✅' },
};

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const createBatch = useProjectStore((s) => s.createBatch);
  const deleteBatch = useProjectStore((s) => s.deleteBatch);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);

  useEffect(() => {
    const allProjects = useProjectStore.getState().projects;
    const found = allProjects.find((p) => p.id === projectId);
    if (found) setCurrentProject(found);
  }, [projectId, projects.length]);

  if (!currentProject) return <div className="p-8 text-sm text-ink-400">Project not found.</div>;

  const batches = currentProject.batches || [];

  // ─── Project Materials Aggregation ───
  const projectMaterials = useMemo(() => {
    const totalWindows = batches.reduce((sum, b) => sum + (b.windows?.length || 0), 0);
    if (totalWindows === 0) return [];

    // Group by material_id
    const matMap = {};
    ALL_PARTS.forEach((part) => {
      const assignment = assignments[part.id];
      if (!assignment?.material_id) return;

      const matId = assignment.material_id;
      const mat = materials.find((m) => m.id === matId);
      if (!mat) return;

      if (!matMap[matId]) {
        matMap[matId] = {
          material: mat,
          parts: [],
          totalPcs: 0,
        };
      }
      const pcsTotal = part.pcs * totalWindows;
      matMap[matId].parts.push({ ...part, pcsTotal, yield: assignment.yield || 1.0 });
      matMap[matId].totalPcs += pcsTotal;
    });

    return Object.values(matMap);
  }, [batches, assignments, materials]);

  const handleAddBatch = (type) => {
    const batch = createBatch(projectId, type);
    setShowAddBatch(false);
    navigate(`/projects/${projectId}/batches/${batch.id}/defaults`);
  };

  const handleDeleteBatch = (batchId) => {
    if (window.confirm('Delete this batch and all its windows?')) deleteBatch(projectId, batchId);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link to="/dashboard" className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← All Projects</Link>

      <div className="flex items-end justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">{currentProject.name}</h1>
          {currentProject.address && <p className="text-sm text-ink-400 mt-1">{currentProject.address}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowMaterials(true)} className="btn btn-secondary text-sm">
            📋 See Project Materials
          </button>
          <button onClick={() => setShowAddBatch(true)} className="btn btn-primary">+ Add Batch</button>
        </div>
      </div>

      {/* Add Batch picker */}
      {showAddBatch && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-semibold text-ink-50 mb-3">Select window type for new batch:</div>
          <div className="flex gap-3">
            {[
              { type: 'sash', icon: '🪟', label: 'Sash Windows' },
              { type: 'casement', icon: '🔲', label: 'Casement' },
              { type: 'doors', icon: '🚪', label: 'Doors' },
              { type: 'special', icon: '✦', label: 'Special / Other' },
            ].map(({ type, icon, label }) => (
              <button key={type} onClick={() => handleAddBatch(type)}
                className="px-5 py-3 bg-surface-600 border border-surface-500 rounded-lg text-sm text-ink-100 hover:border-accent-500 hover:bg-surface-500 transition-all">
                {icon} {label}
              </button>
            ))}
            <button onClick={() => setShowAddBatch(false)} className="px-4 py-3 text-sm text-ink-400 hover:text-ink-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {batches.length === 0 && !showAddBatch && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🏗️</div>
          <div className="text-ink-200 mb-2">No production batches yet.</div>
          <button onClick={() => setShowAddBatch(true)} className="btn btn-primary mt-4">+ Add Your First Batch</button>
        </div>
      )}

      {/* Batches */}
      <div className="space-y-4">
        {batches.map((batch) => {
          const st = STATUS_STYLES[batch.status] || STATUS_STYLES.preparation;
          const winCount = batch.windows?.length || 0;
          return (
            <div key={batch.id} className="card p-5 relative group">
              {/* Delete */}
              <button onClick={() => handleDeleteBatch(batch.id)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-surface-600 text-ink-400 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-ink-50">{batch.label}</h2>
                    <span className={st.cls}>{st.icon} {batch.status}</span>
                  </div>
                  <div className="text-xs text-ink-400 mt-1">
                    {TYPE_LABELS[batch.type] || batch.type} — {winCount} window{winCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Batch defaults summary */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400 mb-4 px-4 py-2.5 bg-surface-600 rounded-lg border border-surface-500">
                <span>Ironmongery: <strong className="text-ink-100">{batch.defaults?.ironmongery}</strong></span>
                <span>Colour: <strong className="text-ink-100">{batch.defaults?.colourMode === 'dual' ? 'Dual' : 'Single'}</strong></span>
                <span>Glass: <strong className="text-ink-100">{batch.defaults?.glassType}</strong></span>
                <span>Frame: <strong className="text-ink-100">{batch.defaults?.frameType}</strong></span>
                {batch.type === 'sash' && <span>Horns: <strong className="text-ink-100">{batch.defaults?.hornType}</strong></span>}
                <span>PAS24: <strong className="text-ink-100">{batch.defaults?.pas24 ? 'Yes' : 'No'}</strong></span>
                <Link to={`/projects/${projectId}/batches/${batch.id}/defaults`}
                  className="text-accent-400 hover:text-accent-300 ml-auto transition-colors">Edit defaults</Link>
              </div>

              {/* Windows */}
              {winCount > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {batch.windows.map((win) => (
                    <Link key={win.id} to={`/projects/${projectId}/batches/${batch.id}/windows/${win.id}`}
                      className="p-3 bg-surface-600 border border-surface-500 rounded-lg hover:border-accent-500/40 hover:shadow-glow transition-all">
                      <div className="font-semibold text-sm text-ink-50">{win.name}</div>
                      <div className="text-xs text-ink-400 mt-0.5">{win.width} × {win.height} mm</div>
                      <div className="text-[10px] text-ink-400 mt-1">
                        {win.upperBars && win.upperBars !== 'none' ? `Bars: ${win.upperBars}` : 'No bars'}
                        {win.glassFinish === 'frosted' ? ' · Frosted' : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-ink-400 italic">No windows in this batch.</div>
              )}

              {/* Add window */}
              <div className="mt-3">
                <Link to={`/projects/${projectId}/batches/${batch.id}/configurator`}
                  className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 transition-colors">
                  + Add window to batch
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Materials Modal */}
      {showMaterials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowMaterials(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-800 border border-surface-500 rounded-xl w-full max-w-3xl mx-4 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 border-b border-surface-500 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-ink-50">Project Materials — {currentProject.name}</h2>
                <p className="text-[10px] text-ink-400 mt-0.5">
                  {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {batches.reduce((s, b) => s + (b.windows?.length || 0), 0)} windows
                </p>
              </div>
              <button onClick={() => setShowMaterials(false)} className="w-7 h-7 rounded-full bg-surface-600 text-ink-400 hover:text-ink-200 flex items-center justify-center text-sm">×</button>
            </div>

            {/* Content */}
            <div className="overflow-auto flex-1 p-5">
              {projectMaterials.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">📋</div>
                  <div className="text-sm text-ink-300 mb-1">No materials assigned yet.</div>
                  <p className="text-[10px] text-ink-400">Go to Materials → Assignments to assign timber to window parts.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projectMaterials.map(({ material, parts, totalPcs }) => (
                    <div key={material.id} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {material.image_url ? (
                            <img src={material.image_url} alt="" className="w-10 h-10 rounded object-cover border border-surface-500" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-surface-600 border border-surface-500 grid place-items-center text-ink-500 text-xs">—</div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-ink-50">{material.name}</div>
                            <div className="text-[10px] text-ink-400 flex items-center gap-2">
                              <span>{material.item_number}</span>
                              <span>{material.size || '—'}</span>
                              {material.cost_per_unit > 0 && <span>£{Number(material.cost_per_unit).toFixed(2)}/{material.unit}</span>}
                              {material.jc_uuid && <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25">JC</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-ink-100">{totalPcs} pcs</div>
                          <div className="text-[10px] text-ink-400">across all windows</div>
                        </div>
                      </div>

                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-surface-500/50">
                            <th className="py-1.5 text-left text-ink-400 font-medium">Part</th>
                            <th className="py-1.5 text-center text-ink-400 font-medium">Section</th>
                            <th className="py-1.5 text-center text-ink-400 font-medium">Pcs/Win</th>
                            <th className="py-1.5 text-center text-ink-400 font-medium">Total Pcs</th>
                            <th className="py-1.5 text-center text-ink-400 font-medium">Yield</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parts.map((p) => (
                            <tr key={p.id} className="border-b border-surface-500/30">
                              <td className="py-1.5 text-ink-200">{p.name}</td>
                              <td className="py-1.5 text-center text-ink-300 font-mono">{p.section}</td>
                              <td className="py-1.5 text-center text-ink-300">{p.pcs}</td>
                              <td className="py-1.5 text-center text-ink-100 font-medium">{p.pcsTotal}</td>
                              <td className="py-1.5 text-center text-ink-300">{p.yield}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-surface-500 flex justify-between items-center shrink-0">
              <div className="text-[10px] text-ink-400">
                {projectMaterials.length} material{projectMaterials.length !== 1 ? 's' : ''} assigned · Quantities are per-window totals (cutting lengths calculated in BOM)
              </div>
              <button onClick={() => setShowMaterials(false)} className="btn btn-secondary text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
