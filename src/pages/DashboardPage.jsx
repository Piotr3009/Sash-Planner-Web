import { useEffect } from 'react';
import { Link } from 'react-router-dom';
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Estimates</h1>
          <p className="text-sm text-ink-600">Pick an estimate to plan production for its windows.</p>
        </div>
        {error && <div className="text-xs text-red-600 max-w-sm">Backend error — showing mock data. {error}</div>}
      </div>

      {loading && <div className="text-sm text-ink-400">Loading estimates…</div>}

      {!loading && estimates.length === 0 && (
        <div className="card p-8 text-center text-ink-400">No estimates available.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {estimates.map((est) => (
          <Link key={est.id} to={`/estimates/${est.id}`} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{est.estimate_number || est.id.slice(0, 8)}</div>
              <span className={statusClass(est.status)}>{est.status || 'draft'}</span>
            </div>
            {est.project_name && <div className="text-sm text-ink-600 mb-3">{est.project_name}</div>}
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>{est.window_count ?? 0} windows</span>
              <span>{formatDate(est.created_at)}</span>
            </div>
            {est.total_price != null && (
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
