import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { hasSupabaseConfig, supabase } from '../services/supabase.js';
import { mockEstimates } from '../mocks/mockEstimates.js';

export default function DashboardPage() {
  const estimates = useProjectStore((s) => s.estimates);
  const loading = useProjectStore((s) => s.estimatesLoading);
  const error = useProjectStore((s) => s.estimatesError);
  const setEstimates = useProjectStore((s) => s.setEstimates);
  const setLoading = useProjectStore((s) => s.setEstimatesLoading);
  const setError = useProjectStore((s) => s.setEstimatesError);
  const createEstimate = useProjectStore((s) => s.createEstimate);
  const deleteEstimate = useProjectStore((s) => s.deleteEstimate);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!hasSupabaseConfig) {
          if (!cancelled) setEstimates(mockEstimates.map((e) => ({ ...e, window_count: e.items.length })));
          return;
        }
        const { data, error: err } = await supabase
          .from('estimates')
          .select('id, estimate_number, status, created_at, total_price, project_name, customer_id, estimate_items(count)')
          .order('created_at', { ascending: false });
        if (err) throw err;
        const enriched = (data || []).map((e) => ({
          ...e,
          window_count: Array.isArray(e.estimate_items) ? e.estimate_items[0]?.count ?? 0 : 0
        }));
        if (!cancelled) setEstimates(enriched);
      } catch (e) {
        console.error('Failed to load estimates:', e);
        if (!cancelled) {
          setError(e.message);
          setEstimates(mockEstimates.map((m) => ({ ...m, window_count: m.items.length })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [setEstimates, setLoading, setError]);

  const handleCreate = () => {
    if (!projectName.trim()) return;
    const est = createEstimate(projectName.trim());
    setProjectName('');
    setShowForm(false);
    navigate(`/estimates/${est.id}`);
  };

  const handleDelete = (e, estId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Delete this estimate and all its windows?')) {
      deleteEstimate(estId);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Estimates</h1>
          <p className="text-sm text-ink-600">Pick an estimate to plan production for its windows.</p>
        </div>
        <div className="flex items-center gap-3">
          {error && <div className="text-xs text-red-600 max-w-sm">Backend error — showing mock data. {error}</div>}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600 transition-colors"
          >
            + New Estimate
          </button>
        </div>
      </div>

      {/* New Estimate Form */}
      {showForm && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-medium mb-3">New Estimate</div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Project name (e.g. 12 Belgrave Square)"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600"
            >
              Create
            </button>
            <button
              onClick={() => { setShowForm(false); setProjectName(''); }}
              className="px-4 py-2 bg-ink-200 text-ink-700 text-sm rounded-lg hover:bg-ink-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-ink-400">Loading estimates…</div>}

      {!loading && estimates.length === 0 && (
        <div className="card p-8 text-center text-ink-400">No estimates available. Create one to get started.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {estimates.map((est) => (
          <Link key={est.id} to={`/estimates/${est.id}`} className="card p-5 hover:shadow-md transition-shadow relative group">
            <button
              onClick={(e) => handleDelete(e, est.id)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ink-100 text-ink-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete estimate"
            >
              ✕
            </button>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{est.estimate_number || est.id.slice(0, 8)}</div>
              <span className={statusClass(est.status)}>{est.status || 'draft'}</span>
            </div>
            {est.project_name && <div className="text-sm text-ink-600 mb-3">{est.project_name}</div>}
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>{est.window_count ?? 0} windows</span>
              <span>{formatDate(est.created_at)}</span>
            </div>
            {est.total_price != null && est.total_price > 0 && (
              <div className="mt-3 pt-3 border-t border-ink-200 text-sm">
                <span className="text-ink-400">Total</span>{' '}
                <strong>£{Number(est.total_price).toFixed(2)}</strong>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function statusClass(status) {
  const base = 'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full';
  switch (status) {
    case 'finished':
    case 'won':
      return `${base} bg-emerald-100 text-emerald-800`;
    case 'sent':
      return `${base} bg-blue-100 text-blue-800`;
    case 'draft':
      return `${base} bg-ink-200 text-ink-800`;
    default:
      return `${base} bg-ink-200 text-ink-800`;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}