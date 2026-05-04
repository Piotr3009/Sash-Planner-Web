import { NavLink, useParams } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore.js';

export default function Sidebar() {
  const estimates = useProjectStore((s) => s.estimates);
  const currentEstimate = useProjectStore((s) => s.currentEstimate);
  const currentItems = useProjectStore((s) => s.currentItems);
  const { estimateId, itemId } = useParams();

  return (
    <aside className="w-72 shrink-0 border-r border-ink-200 bg-white flex flex-col">
      <div className="p-4 border-b border-ink-200">
        <div className="label">Estimates</div>
        <div className="text-sm text-ink-600">{estimates.length} loaded</div>
      </div>

      <nav className="flex-1 overflow-auto p-2 space-y-1">
        {estimates.length === 0 && (
          <div className="text-xs text-ink-400 px-3 py-4">No estimates loaded yet.</div>
        )}
        {estimates.map((est) => (
          <NavLink
            key={est.id}
            to={`/estimates/${est.id}`}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive || estimateId === est.id ? 'bg-accent-500/10 text-accent-600' : 'hover:bg-ink-100 text-ink-800'
              }`
            }
          >
            <div className="font-medium truncate">{est.estimate_number || est.id.slice(0, 8)}</div>
            <div className="text-[11px] text-ink-400 flex items-center justify-between">
              <span>{est.status || 'draft'}</span>
              <span>{est.window_count ?? '·'} windows</span>
            </div>
          </NavLink>
        ))}
      </nav>

      {currentEstimate && currentItems.length > 0 && (
        <div className="border-t border-ink-200 p-2 max-h-72 overflow-auto">
          <div className="label px-2">Windows in estimate</div>
          {currentItems.map((item) => (
            <NavLink
              key={item.id}
              to={`/estimates/${currentEstimate.id}/windows/${item.id}`}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-xs transition-colors ${
                  isActive || itemId === item.id ? 'bg-accent-500/10 text-accent-600' : 'hover:bg-ink-100 text-ink-800'
                }`
              }
            >
              <div className="font-medium">{item.window_number || `Window ${item.id.slice(0, 6)}`}</div>
              <div className="text-[10px] text-ink-400">
                {item.width}×{item.height} · {item.window_type || 'sash'}
              </div>
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  );
}
