import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore, BATCH_STATUSES } from '../stores/projectStore.js';
import { mockProjects } from '../mocks/mockProjects.js';

const TYPE_LABELS = { sash: 'Sash Windows', casement: 'Casement Windows', 'fix-frame': 'Fix Frame' };
const STATUS_STYLES = {
  'preparation': { bg: 'bg-amber-100 text-amber-800', icon: '📋' },
  'in-production': { bg: 'bg-blue-100 text-blue-800', icon: '🔧' },
  'complete': { bg: 'bg-emerald-100 text-emerald-800', icon: '✅' },
};

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setProjects = useProjectStore((s) => s.setProjects);
  const createBatch = useProjectStore((s) => s.createBatch);
  const deleteBatch = useProjectStore((s) => s.deleteBatch);
  const updateBatchStatus = useProjectStore((s) => s.updateBatchStatus);
  const loading = useProjectStore((s) => s.currentLoading);

  const [showAddBatch, setShowAddBatch] = useState(false);

  useEffect(() => {
    // Load projects if empty (direct URL access)
    if (projects.length === 0) {
      useProjectStore.getState().setProjects(mockProjects);
    }
    // Find project
    const allProjects = useProjectStore.getState().projects;
    const found = allProjects.find((p) => p.id === projectId);
    if (found) setCurrentProject(found);
  }, [projectId, projects.length]);

  if (!currentProject) return <div className="p-8 text-sm text-ink-400">Project not found.</div>;

  const batches = currentProject.batches || [];

  const handleAddBatch = (type) => {
    const batch = createBatch(projectId, type);
    setShowAddBatch(false);
    navigate(`/projects/${projectId}/batches/${batch.id}/defaults`);
  };

  const handleDeleteBatch = (batchId) => {
    if (window.confirm('Delete this batch and all its windows?')) {
      deleteBatch(projectId, batchId);
    }
  };

  const handleStatusChange = (batchId, status) => {
    updateBatchStatus(projectId, batchId, status);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link to="/dashboard" className="text-xs text-ink-400 hover:text-ink-600">← All Projects</Link>

      <div className="flex items-end justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{currentProject.name}</h1>
          {currentProject.address && <p className="text-sm text-ink-500">{currentProject.address}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddBatch(true)}
            className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600">
            + Add Batch
          </button>
          {batches.length > 1 && (
            <button onClick={() => alert('Merge — coming soon')}
              className="px-4 py-2 border border-ink-300 text-ink-600 text-sm rounded-lg hover:bg-ink-50">
              Merge Batches
            </button>
          )}
        </div>
      </div>

      {/* Add Batch picker */}
      {showAddBatch && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-medium mb-3">Select window type for new batch:</div>
          <div className="flex gap-3">
            <button onClick={() => handleAddBatch('sash')}
              className="px-5 py-3 border-2 border-ink-300 rounded-lg text-sm hover:border-accent-500 hover:bg-accent-50 transition-colors">
              🪟 Sash Windows
            </button>
            <button onClick={() => handleAddBatch('casement')}
              className="px-5 py-3 border-2 border-ink-300 rounded-lg text-sm hover:border-accent-500 hover:bg-accent-50 transition-colors">
              🔲 Casement
            </button>
            <button onClick={() => handleAddBatch('fix-frame')}
              className="px-5 py-3 border-2 border-ink-300 rounded-lg text-sm hover:border-accent-500 hover:bg-accent-50 transition-colors">
              ◻️ Fix Frame
            </button>
            <button disabled className="px-5 py-3 border-2 border-ink-200 rounded-lg text-sm text-ink-300 cursor-not-allowed">
              🚪 Door 🔒
            </button>
            <button onClick={() => setShowAddBatch(false)}
              className="px-4 py-3 text-sm text-ink-500 hover:text-ink-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {batches.length === 0 && !showAddBatch && (
        <div className="card p-8 text-center text-ink-400">
          <p className="mb-4">No production batches yet.</p>
          <button onClick={() => setShowAddBatch(true)}
            className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600">
            + Add Your First Batch
          </button>
        </div>
      )}

      {/* Batches grid */}
      <div className="space-y-4">
        {batches.map((batch) => {
          const st = STATUS_STYLES[batch.status] || STATUS_STYLES.preparation;
          const winCount = batch.windows?.length || 0;
          return (
            <div key={batch.id} className="card p-5 relative group">
              {/* Delete button */}
              <button onClick={() => handleDeleteBatch(batch.id)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ink-100 text-ink-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete batch">✕</button>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{batch.label}</h2>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${st.bg}`}>
                      {st.icon} {batch.status}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    {TYPE_LABELS[batch.type] || batch.type} — {winCount} window{winCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status buttons */}
                  <select value={batch.status} onChange={(e) => handleStatusChange(batch.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-ink-300 rounded-lg">
                    {BATCH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Batch defaults summary */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 mb-4 px-3 py-2 bg-ink-50 rounded-lg">
                <span>Ironmongery: <strong className="text-ink-700">{batch.defaults?.ironmongery}</strong></span>
                <span>Colour: <strong className="text-ink-700">{batch.defaults?.colourMode === 'dual' ? 'Dual' : 'Single'}</strong></span>
                <span>Glass: <strong className="text-ink-700">{batch.defaults?.glassType}</strong></span>
                <span>Frame: <strong className="text-ink-700">{batch.defaults?.frameType}</strong></span>
                {batch.type === 'sash' && <span>Horns: <strong className="text-ink-700">{batch.defaults?.hornType}</strong></span>}
                <span>PAS24: <strong className="text-ink-700">{batch.defaults?.pas24 ? 'Yes' : 'No'}</strong></span>
                <Link to={`/projects/${projectId}/batches/${batch.id}/defaults`}
                  className="text-accent-600 hover:underline ml-auto">Edit defaults</Link>
              </div>

              {/* Windows in batch */}
              {winCount > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {batch.windows.map((win) => (
                    <Link key={win.id} to={`/projects/${projectId}/batches/${batch.id}/windows/${win.id}`}
                      className="p-3 border border-ink-200 rounded-lg hover:border-accent-400 hover:bg-accent-50/30 transition-colors">
                      <div className="font-medium text-sm">{win.name}</div>
                      <div className="text-xs text-ink-400">{win.width} × {win.height} mm</div>
                      <div className="text-[10px] text-ink-400 mt-1">
                        {win.upperBars !== 'none' ? `Bars: ${win.upperBars}` : 'No bars'}
                        {win.glassFinish === 'frosted' ? ' • Frosted' : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-ink-400 italic">No windows in this batch.</div>
              )}

              {/* Add window button */}
              <div className="mt-3">
                <Link to={`/projects/${projectId}/batches/${batch.id}/configurator`}
                  className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 hover:underline">
                  + Add window to batch
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
