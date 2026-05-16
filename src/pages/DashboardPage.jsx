import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { mockProjects } from '../mocks/mockProjects.js';

export default function DashboardPage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.projectsLoading);
  const error = useProjectStore((s) => s.projectsError);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setLoading = useProjectStore((s) => s.setProjectsLoading);
  const setError = useProjectStore((s) => s.setProjectsError);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [projName, setProjName] = useState('');
  const [projAddress, setProjAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: load from Supabase when connected
        if (!cancelled) setProjects(mockProjects);
      } catch (e) {
        console.error('Failed to load projects:', e);
        if (!cancelled) { setError(e.message); setProjects(mockProjects); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (projects.length === 0) load();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = () => {
    if (!projName.trim()) return;
    const proj = createProject(projName.trim(), projAddress.trim());
    setProjName(''); setProjAddress(''); setShowForm(false);
    navigate(`/projects/${proj.id}`);
  };

  const handleDelete = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm('Delete this project and all its batches?')) deleteProject(id);
  };

  const totalWindows = (proj) =>
    (proj.batches || []).reduce((sum, b) => sum + (b.windows?.length || 0), 0);

  const statusSummary = (proj) => {
    const batches = proj.batches || [];
    if (batches.length === 0) return 'empty';
    if (batches.every(b => b.status === 'complete')) return 'complete';
    if (batches.some(b => b.status === 'in-production')) return 'in-production';
    return 'preparation';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-ink-600">Production projects with batch windows.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600">
          + New Project
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-medium mb-3">New Project</div>
          <div className="space-y-3">
            <input type="text" placeholder="Project name (e.g. 12 Belgrave Square)" value={projName}
              onChange={(e) => setProjName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" autoFocus />
            <input type="text" placeholder="Address (optional)" value={projAddress}
              onChange={(e) => setProjAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
            <div className="flex gap-3">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600">Create</button>
              <button onClick={() => { setShowForm(false); setProjName(''); setProjAddress(''); }}
                className="px-4 py-2 bg-ink-200 text-ink-700 text-sm rounded-lg hover:bg-ink-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-ink-400">Loading projects…</div>}
      {error && <div className="text-xs text-red-600 mb-4">{error}</div>}
      {!loading && projects.length === 0 && (
        <div className="card p-8 text-center text-ink-400">No projects yet. Create one to get started.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((proj) => (
          <Link key={proj.id} to={`/projects/${proj.id}`} className="card p-5 hover:shadow-md transition-shadow relative group">
            <button onClick={(e) => handleDelete(e, proj.id)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ink-100 text-ink-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete project">✕</button>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{proj.name}</div>
              <StatusBadge status={statusSummary(proj)} />
            </div>
            {proj.address && <div className="text-xs text-ink-500 mb-3">{proj.address}</div>}
            <div className="flex items-center justify-between text-xs text-ink-400 mb-2">
              <span>{(proj.batches || []).length} batches</span>
              <span>{totalWindows(proj)} windows</span>
            </div>
            {(proj.batches || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(proj.batches || []).map((b) => (
                  <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-600">
                    {b.type} ({b.windows?.length || 0})
                  </span>
                ))}
              </div>
            )}
            <div className="text-[10px] text-ink-300 mt-3">{formatDate(proj.created_at)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    'complete': 'bg-emerald-100 text-emerald-800',
    'in-production': 'bg-blue-100 text-blue-800',
    'preparation': 'bg-amber-100 text-amber-800',
    'empty': 'bg-ink-200 text-ink-600',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[status] || styles.empty}`}>
      {status}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
