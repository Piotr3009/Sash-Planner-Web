import { NavLink, useParams } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore.js';

export default function Sidebar() {
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentBatch = useProjectStore((s) => s.currentBatch);
  const currentWindows = useProjectStore((s) => s.currentWindows);
  const { projectId, batchId, windowId } = useParams();

  return (
    <aside className="w-72 shrink-0 border-r border-ink-200 bg-white flex flex-col">
      <div className="p-4 border-b border-ink-200">
        <div className="label">Projects</div>
        <div className="text-sm text-ink-600">{projects.length} loaded</div>
      </div>

      <nav className="flex-1 overflow-auto p-2 space-y-1">
        {projects.length === 0 && (
          <div className="text-xs text-ink-400 px-3 py-4">No projects yet.</div>
        )}
        {projects.map((proj) => {
          const totalWin = (proj.batches || []).reduce((s, b) => s + (b.windows?.length || 0), 0);
          return (
            <NavLink key={proj.id} to={`/projects/${proj.id}`}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive || projectId === proj.id ? 'bg-accent-500/10 text-accent-600' : 'hover:bg-ink-100 text-ink-800'}`
              }>
              <div className="font-medium truncate">{proj.name}</div>
              <div className="text-[11px] text-ink-400 flex items-center justify-between">
                <span>{(proj.batches || []).length} batches</span>
                <span>{totalWin} windows</span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Batches in current project */}
      {currentProject && (currentProject.batches || []).length > 0 && (
        <div className="border-t border-ink-200 p-2 max-h-48 overflow-auto">
          <div className="label px-2">Batches</div>
          {(currentProject.batches || []).map((batch) => (
            <div key={batch.id} className={`px-3 py-1.5 rounded-lg text-xs ${batchId === batch.id ? 'bg-accent-500/10 text-accent-600' : 'text-ink-600'}`}>
              <div className="font-medium">{batch.label}</div>
              <div className="text-[10px] text-ink-400">{batch.windows?.length || 0} windows · {batch.status}</div>
            </div>
          ))}
        </div>
      )}

      {/* Windows in current batch */}
      {currentBatch && currentWindows.length > 0 && (
        <div className="border-t border-ink-200 p-2 max-h-48 overflow-auto">
          <div className="label px-2">Windows in batch</div>
          {currentWindows.map((win) => (
            <NavLink key={win.id}
              to={`/projects/${currentProject?.id}/batches/${currentBatch.id}/windows/${win.id}`}
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive || windowId === win.id ? 'bg-accent-500/10 text-accent-600' : 'hover:bg-ink-100 text-ink-800'}`
              }>
              <div className="font-medium">{win.name}</div>
              <div className="text-[10px] text-ink-400">{win.width}×{win.height} · {win.window_type || 'sash'}</div>
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  );
}
