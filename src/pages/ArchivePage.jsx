/**
 * ArchivePage.jsx — archived projects (ARCHED-WINDOWS-v3 Block 6, Piotr 07.09:
 * finished projects were cluttering the dashboard).
 *
 * Plain table: Project · Client · Batches · Windows · Archived on · Restore,
 * search box on top, same card / table styles as the dashboard. A row opens
 * the project page read-only (production pack, cut lists and exports keep
 * working on an archived project); Restore puts it back on the dashboard.
 * Data: projectStore.archivedProjects (loaded from Supabase on mount when the
 * cloud is configured; in-memory otherwise).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
};

export default function ArchivePage() {
  const archivedProjects = useProjectStore((s) => s.archivedProjects);
  const archivedLoaded = useProjectStore((s) => s.archivedLoaded);
  const loadArchivedProjects = useProjectStore((s) => s.loadArchivedProjects);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const [q, setQ] = useState('');

  useEffect(() => { loadArchivedProjects(); }, [loadArchivedProjects]);

  const needle = q.trim().toLowerCase();
  const rows = (needle
    ? archivedProjects.filter((p) => [p.name, p.project_number, p.client, p.address].filter(Boolean).join(' ').toLowerCase().includes(needle))
    : archivedProjects
  ).map((p) => {
    const batches = p.batches || [];
    return {
      id: p.id,
      name: p.name,
      number: p.project_number,
      client: p.client || '—',
      batches: batches.length,
      windows: batches.reduce((n, b) => n + (b.windows?.length || 0), 0),
      archivedAt: p.archived_at,
    };
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-50 mb-1">Archive</h1>
          <p className="text-[13px] text-ink-400">
            Archived projects stay out of the production dashboard. Open one to read its packs and cut lists; Restore brings it back.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search archive…"
            className="input text-[13px] w-[220px]"
          />
          <div className="text-[11px] text-ink-400">{rows.length}/{archivedProjects.length} projects</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-400 border-b border-surface-500">
              <th className="px-4 py-2.5 font-semibold">Project</th>
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold text-right">Batches</th>
              <th className="px-4 py-2.5 font-semibold text-right">Windows</th>
              <th className="px-4 py-2.5 font-semibold">Archived on</th>
              <th className="px-4 py-2.5 font-semibold text-right">Restore</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-600/60 hover:bg-surface-700/40 transition-colors">
                <td className="px-4 py-2.5">
                  <Link to={`/projects/${r.id}`} className="text-ink-50 font-medium hover:text-accent-400 transition-colors">{r.name}</Link>
                  <div className="text-[11px] text-ink-400">{r.number}</div>
                </td>
                <td className="px-4 py-2.5 text-ink-200">{r.client}</td>
                <td className="px-4 py-2.5 text-right text-ink-200 tabular-nums">{r.batches}</td>
                <td className="px-4 py-2.5 text-right text-ink-200 tabular-nums">{r.windows}</td>
                <td className="px-4 py-2.5 text-ink-300 tabular-nums">{fmtDate(r.archivedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => restoreProject(r.id)}
                    className="text-[12px] px-3 py-1 rounded-lg border border-surface-500 text-ink-200 hover:border-accent-500 hover:text-accent-400 transition-colors"
                    title="Put the project back on the production dashboard"
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500 text-[12px]">
                  {!archivedLoaded ? 'Loading…' : needle ? 'No archived project matches the search.' : 'Nothing archived yet. Archive a finished project from its card on the dashboard.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
