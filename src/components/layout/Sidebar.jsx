import { NavLink, useParams } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore.js';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '📋', label: 'Projects' },
  // Future nav items:
  // { to: '/materials', icon: '🪵', label: 'Materials' },
  // { to: '/stock', icon: '📦', label: 'Stock' },
  // { to: '/suppliers', icon: '🚚', label: 'Suppliers' },
  // { to: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function Sidebar() {
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentBatch = useProjectStore((s) => s.currentBatch);
  const currentWindows = useProjectStore((s) => s.currentWindows);
  const { projectId, batchId, windowId } = useParams();

  return (
    <aside className="w-64 shrink-0 border-r border-surface-500 bg-surface-900 flex flex-col">
      {/* Main nav */}
      <nav className="p-3 space-y-1 border-b border-surface-500">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-accent-500/15 text-accent-400' : 'text-ink-200 hover:bg-surface-700 hover:text-ink-50'
              }`
            }>
            <span className="text-base">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Projects list */}
      <div className="flex-1 overflow-auto p-3">
        <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium px-2 mb-2">
          Projects ({projects.length})
        </div>
        {projects.length === 0 && (
          <div className="text-xs text-ink-400 px-3 py-4">No projects yet.</div>
        )}
        {projects.map((proj) => {
          const isActive = projectId === proj.id;
          const totalWin = (proj.batches || []).reduce((s, b) => s + (b.windows?.length || 0), 0);
          return (
            <NavLink key={proj.id} to={`/projects/${proj.id}`}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                isActive ? 'bg-surface-700 text-ink-50 border-l-2 border-accent-500' : 'text-ink-200 hover:bg-surface-700/50'
              }`}>
              <div className="font-medium truncate">{proj.name}</div>
              <div className="text-[10px] text-ink-400 flex items-center justify-between mt-0.5">
                <span>{(proj.batches || []).length} batches</span>
                <span>{totalWin} win</span>
              </div>
            </NavLink>
          );
        })}
      </div>

      {/* Batches in current project */}
      {currentProject && (currentProject.batches || []).length > 0 && (
        <div className="border-t border-surface-500 p-3 max-h-44 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium px-2 mb-2">Batches</div>
          {(currentProject.batches || []).map((batch) => (
            <div key={batch.id}
              className={`px-3 py-1.5 rounded-lg text-xs mb-1 ${
                batchId === batch.id ? 'bg-accent-500/10 text-accent-400' : 'text-ink-200'
              }`}>
              <div className="font-medium">{batch.label}</div>
              <div className="text-[10px] text-ink-400">{batch.windows?.length || 0} win · {batch.status}</div>
            </div>
          ))}
        </div>
      )}

      {/* Windows in current batch */}
      {currentBatch && currentWindows.length > 0 && (
        <div className="border-t border-surface-500 p-3 max-h-44 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium px-2 mb-2">Windows</div>
          {currentWindows.map((win) => (
            <NavLink key={win.id}
              to={`/projects/${currentProject?.id}/batches/${currentBatch.id}/windows/${win.id}`}
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-lg text-xs mb-1 transition-colors ${
                  isActive || windowId === win.id ? 'bg-accent-500/10 text-accent-400' : 'text-ink-200 hover:bg-surface-700/50'
                }`
              }>
              <div className="font-medium">{win.name}</div>
              <div className="text-[10px] text-ink-400">{win.width}×{win.height}</div>
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  );
}
