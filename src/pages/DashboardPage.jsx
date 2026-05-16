import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { mockProjects } from '../mocks/mockProjects.js';

export default function DashboardPage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.projectsLoading);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setLoading = useProjectStore((s) => s.setProjectsLoading);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [projName, setProjName] = useState('');
  const [projAddress, setProjAddress] = useState('');
  const [projNumber, setProjNumber] = useState('');
  const [projClient, setProjClient] = useState('');

  useEffect(() => {
    if (projects.length === 0) {
      setLoading(true);
      setTimeout(() => { setProjects(mockProjects); setLoading(false); }, 200);
    }
  }, []);

  const handleCreate = () => {
    if (!projName.trim()) return;
    const proj = createProject(projName.trim(), projAddress.trim(), projNumber.trim(), projClient.trim());
    setProjName(''); setProjAddress(''); setProjNumber(''); setProjClient('');
    setShowForm(false);
    navigate(`/projects/${proj.id}`);
  };

  const handleDelete = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm('Delete this project and all its batches?')) deleteProject(id);
  };

  const totalWindows = (proj) =>
    (proj.batches || []).reduce((sum, b) => sum + (b.windows?.length || 0), 0);

  const statusOf = (proj) => {
    const b = proj.batches || [];
    if (b.length === 0) return 'empty';
    if (b.every(x => x.status === 'complete')) return 'complete';
    if (b.some(x => x.status === 'in-production')) return 'in-production';
    return 'preparation';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">Projects</h1>
          <p className="text-sm text-ink-400 mt-1">Production projects with batch windows.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">+ New Project</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Projects" value={projects.length} icon="📋" />
        <StatCard label="Total Windows" value={projects.reduce((s, p) => s + totalWindows(p), 0)} icon="🪟" />
        <StatCard label="In Production" value={projects.filter(p => statusOf(p) === 'in-production').length} icon="🔧" accent />
        <StatCard label="Complete" value={projects.filter(p => statusOf(p) === 'complete').length} icon="✅" />
      </div>

      {/* New Project form */}
      {showForm && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-semibold text-ink-50 mb-4">New Project</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Project Number</label>
              <input type="text" placeholder="PRJ-2025-003 (auto if empty)" value={projNumber}
                onChange={(e) => setProjNumber(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Client</label>
              <input type="text" placeholder="Client name" value={projClient}
                onChange={(e) => setProjClient(e.target.value)} className="input" />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Project Name *</label>
              <input type="text" placeholder="e.g. 12 Belgrave Square" value={projName}
                onChange={(e) => setProjName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="input" autoFocus />
            </div>
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Address</label>
              <input type="text" placeholder="Address (optional)" value={projAddress}
                onChange={(e) => setProjAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="input" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} className="btn btn-primary">Create</button>
              <button onClick={() => { setShowForm(false); setProjName(''); setProjAddress(''); setProjNumber(''); setProjClient(''); }} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-ink-400">Loading projects…</div>}

      {!loading && projects.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🏗️</div>
          <div className="text-ink-200 mb-2">No projects yet</div>
          <button onClick={() => setShowForm(true)} className="btn btn-primary mt-4">+ New Project</button>
        </div>
      )}

      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const st = statusOf(proj);
          const batches = proj.batches || [];
          return (
            <Link key={proj.id} to={`/projects/${proj.id}`}
              className="card p-5 hover:border-accent-500/40 hover:shadow-glow transition-all relative group">
              <button onClick={(e) => handleDelete(e, proj.id)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-surface-600 text-ink-400 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>

              {/* Project number + status */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-400 font-mono">{proj.project_number || '—'}</span>
                <StatusBadge status={st} />
              </div>

              {/* Name */}
              <h3 className="font-semibold text-ink-50 mb-1">{proj.name}</h3>

              {/* Client */}
              {proj.client && (
                <div className="text-xs text-accent-400 mb-1">👤 {proj.client}</div>
              )}

              {/* Address */}
              {proj.address && <div className="text-xs text-ink-400 mb-3 truncate">{proj.address}</div>}

              {/* Batch chips */}
              {batches.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {batches.map((b) => (
                    <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-600 text-ink-200 border border-surface-500">
                      {b.type} ({b.windows?.length || 0})
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-ink-400 pt-3 border-t border-surface-500">
                <span>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
                <span>{totalWindows(proj)} win</span>
                <span>{formatDate(proj.created_at)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className={`card-elevated p-4 flex items-center gap-4 ${accent ? 'border-accent-500/30' : ''}`}>
      <div className="text-2xl">{icon}</div>
      <div>
        <div className={`text-2xl font-bold ${accent ? 'text-accent-400' : 'text-ink-50'}`}>{value}</div>
        <div className="text-[11px] text-ink-400 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    'complete': 'badge-done',
    'in-production': 'badge-active',
    'preparation': 'badge-prep',
    'empty': 'text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-600 text-ink-400 border border-surface-500',
  };
  return <span className={map[status] || map.empty}>{status}</span>;
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
