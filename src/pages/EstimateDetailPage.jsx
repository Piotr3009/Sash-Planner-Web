import { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { hasSupabaseConfig, supabase } from '../services/supabase.js';
import { mockEstimates } from '../mocks/mockEstimates.js';
import { parseSpecification } from '../engine/specification.js';
import WindowCard from '../components/dashboard/WindowCard.jsx';

export default function EstimateDetailPage() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const currentEstimate = useProjectStore((s) => s.currentEstimate);
  const currentItems = useProjectStore((s) => s.currentItems);
  const loading = useProjectStore((s) => s.currentLoading);
  const error = useProjectStore((s) => s.currentError);
  const setCurrentEstimate = useProjectStore((s) => s.setCurrentEstimate);
  const setLoading = useProjectStore((s) => s.setCurrentLoading);
  const setError = useProjectStore((s) => s.setCurrentError);
  const removeWindowFromEstimate = useProjectStore((s) => s.removeWindowFromEstimate);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!hasSupabaseConfig) {
          // Check user-created estimates first (in store)
          const allEstimates = useProjectStore.getState().estimates;
          const found = allEstimates.find((e) => e.id === estimateId);
          if (found && !cancelled) {
            setCurrentEstimate(found, found.items || []);
            return;
          }
          // Fallback to mock
          const mock = mockEstimates.find((e) => e.id === estimateId);
          if (mock && !cancelled) {
            setCurrentEstimate(mock, mock.items);
          }
          return;
        }

        const [{ data: estimate, error: e1 }, { data: items, error: e2 }] = await Promise.all([
          supabase.from('estimates').select('*').eq('id', estimateId).single(),
          supabase.from('estimate_items').select('*').eq('estimate_id', estimateId).order('created_at')
        ]);

        if (e1) throw e1;
        if (e2) throw e2;
        if (!cancelled) setCurrentEstimate(estimate, items || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(e.message);
          const mock = mockEstimates.find((m) => m.id === estimateId) || mockEstimates[0];
          if (mock) setCurrentEstimate(mock, mock.items);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [estimateId, setCurrentEstimate, setLoading, setError]);

  const handleDeleteWindow = (itemId) => {
    if (window.confirm('Remove this window from the estimate?')) {
      removeWindowFromEstimate(estimateId, itemId);
    }
  };

  if (loading) return <div className="p-8 text-sm text-ink-400">Loading estimate…</div>;
  if (!currentEstimate) return <div className="p-8 text-sm text-ink-400">Estimate not found.</div>;

  const total = currentItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link to="/dashboard" className="text-xs text-ink-400 hover:text-ink-600">← Back to estimates</Link>
        <div className="flex items-end justify-between mt-2">
          <div>
            <h1 className="text-2xl font-semibold">{currentEstimate.estimate_number || currentEstimate.id}</h1>
            {currentEstimate.project_name && (
              <p className="text-sm text-ink-600">{currentEstimate.project_name}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {total > 0 && (
              <div className="text-right text-sm">
                <div className="text-ink-400 text-xs">Total</div>
                <div className="text-xl font-semibold">£{total.toFixed(2)}</div>
              </div>
            )}
            <button
              onClick={() => navigate(`/estimates/${estimateId}/configurator`)}
              className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600 transition-colors"
            >
              + Add Window
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-xs text-amber-600">Showing mock data — {error}</div>}
      </div>

      {currentItems.length === 0 && (
        <div className="card p-8 text-center text-ink-400">
          <p className="mb-4">No windows in this estimate yet.</p>
          <button
            onClick={() => navigate(`/estimates/${estimateId}/configurator`)}
            className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600"
          >
            + Add Your First Window
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {currentItems.map((item) => (
          <div key={item.id} className="relative group">
            <WindowCard
              item={item}
              spec={parseSpecification(item.specification)}
              estimateId={currentEstimate.id}
            />
            <button
              onClick={() => handleDeleteWindow(item.id)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ink-100 text-ink-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
              title="Remove window"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}