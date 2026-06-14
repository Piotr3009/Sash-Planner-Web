import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstimateStore } from '../stores/estimateStore.js';
import { useClientStore } from '../stores/clientStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { exportEstimatePdf } from '../utils/estimatePdfExport.js';
import { moveToProduction, planProduction } from '../utils/moveToProduction.js';
import EstimateFormModal from '../components/estimates/EstimateFormModal.jsx';

const STATUSES = ['draft', 'sent', 'won', 'lost'];

// Tailwind classes per status (kept explicit so the JIT compiler keeps them).
const STATUS_CLASS = {
  draft: 'bg-surface-600 text-ink-300 border-surface-500',
  sent: 'bg-accent-500/12 text-accent-400 border-accent-500/30',
  won: 'bg-green-500/15 text-green-400 border-green-500/30',
  lost: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function EstimatesPage() {
  const estimates = useEstimateStore((s) => s.estimates);
  const addEstimate = useEstimateStore((s) => s.addEstimate);
  const updateEstimate = useEstimateStore((s) => s.updateEstimate);
  const setStatus = useEstimateStore((s) => s.setStatus);
  const archiveEstimate = useEstimateStore((s) => s.archiveEstimate);
  const clients = useClientStore((s) => s.clients);
  const pdfSettings = useEstimateStore((s) => s.pdfSettings);
  const company = useProjectStore((s) => s.settings.company || {});
  const createProject = useProjectStore((s) => s.createProject);
  const createBatch = useProjectStore((s) => s.createBatch);
  const addWindowToBatch = useProjectStore((s) => s.addWindowToBatch);
  const navigate = useNavigate();

  const [modal, setModal] = useState(null);          // null | {} (new) | estimate (edit)
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmMove, setConfirmMove] = useState(null);

  const handleMove = () => {
    const e = confirmMove;
    if (!e) return;
    const project = moveToProduction(e, {
      createProject, createBatch, addWindowToBatch, updateEstimate, clientName: clientName(e.client_id),
    });
    setConfirmMove(null);
    if (project) navigate(`/projects/${project.id}`);
  };

  const clientName = (id) => {
    if (!id) return null;
    const c = clients.find((x) => x.id === id);
    return c ? c.full_name : null;
  };

  const sorted = useMemo(
    () => [...estimates].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [estimates]
  );

  const fmtMoney = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  return (
    <div className="min-h-full bg-surface-800">
      <header className="border-b border-surface-500 bg-surface-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-50">Estimates</h1>
          <p className="text-xs text-ink-400 mt-0.5">Quotes for clients · a won estimate becomes a project</p>
        </div>
        <button className="btn btn-primary text-xs px-4" onClick={() => setModal({})}>+ New estimate</button>
      </header>

      <main className="max-w-[1200px] mx-auto p-6">
        {sorted.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-lg font-semibold text-ink-200 mb-2">No estimates yet</div>
            <div className="text-sm text-ink-400 mb-5">Create your first quote. You can attach a client or leave it as a quick no-client estimate.</div>
            <button className="btn btn-primary text-xs px-4" onClick={() => setModal({})}>+ New estimate</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-900 text-ink-400">
                  <Th>Number</Th><Th>Title</Th><Th>Client</Th>
                  <Th className="text-center">Windows</Th><Th className="text-center">Status</Th>
                  <Th className="text-right">Total (ex VAT)</Th><Th>Created</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => {
                  const name = clientName(e.client_id);
                  return (
                    <tr key={e.id} className="border-t border-surface-500 hover:bg-surface-700/40 transition-colors">
                      <td className="px-4 py-3 text-ink-200 font-mono">{e.estimate_number || '—'}</td>
                      <td className="px-4 py-3 text-ink-50 font-medium">{e.title}</td>
                      <td className="px-4 py-3 text-ink-300">
                        {name || <span className="text-ink-500 italic">No client</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-ink-300">{e.items?.length || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={e.status}
                          onChange={(ev) => setStatus(e.id, ev.target.value)}
                          className={`text-[11px] capitalize rounded-full border px-2 py-0.5 bg-transparent cursor-pointer ${STATUS_CLASS[e.status] || STATUS_CLASS.draft}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s} className="bg-surface-800 text-ink-100">{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-200">{fmtMoney(e.totals?.ex_vat)}</td>
                      <td className="px-4 py-3 text-ink-400">{fmtDate(e.created_at)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {e.project_id ? (
                          <button className="text-green-400 hover:text-green-300 font-medium mr-4 transition-colors" onClick={() => navigate(`/projects/${e.project_id}`)}>View project →</button>
                        ) : e.status === 'won' ? (
                          <button className="text-accent-400 hover:text-accent-300 font-semibold mr-4 transition-colors" onClick={() => setConfirmMove(e)}>→ Move to production</button>
                        ) : null}
                        <button className="text-accent-400 hover:text-accent-300 font-medium mr-4 transition-colors" onClick={() => navigate(`/estimates/${e.id}/configure`)}>Configure</button>
                        <button className="text-ink-300 hover:text-accent-400 mr-4 transition-colors" onClick={() => exportEstimatePdf(e, { company, pdfSettings, settings: {}, clientName: clientName(e.client_id) })}>PDF</button>
                        <button className="text-ink-300 hover:text-accent-400 mr-4 transition-colors" onClick={() => setModal(e)}>Edit</button>
                        <button className="text-ink-300 hover:text-red-400 transition-colors" onClick={() => setConfirmArchive(e)}>Archive</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modal && (
        <EstimateFormModal
          estimate={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.id) updateEstimate(modal.id, data);
            else addEstimate(data);
            setModal(null);
          }}
        />
      )}

      {confirmMove && (() => {
        const plan = planProduction(confirmMove);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConfirmMove(null)}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="text-sm font-semibold text-ink-50 mb-2">Move to production?</div>
              <div className="text-xs text-ink-300 mb-4">
                Creates project <span className="text-ink-100 font-medium">“{confirmMove.title || confirmMove.estimate_number}”</span> with <span className="text-ink-100 font-medium">{plan.windowCount}</span> window{plan.windowCount === 1 ? '' : 's'} grouped into <span className="text-ink-100 font-medium">{plan.batchCount}</span> batch{plan.batchCount === 1 ? '' : 'es'} by type. Continue?
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmMove(null)} className="btn btn-secondary text-xs px-4">Cancel</button>
                <button onClick={handleMove} className="btn btn-primary text-xs px-4">Create project</button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmArchive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConfirmArchive(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-ink-50 mb-2">Archive estimate?</div>
            <div className="text-xs text-ink-300 mb-4">
              {confirmArchive.estimate_number} — {confirmArchive.title} will be hidden from the list.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmArchive(null)} className="btn btn-secondary text-xs px-4">Cancel</button>
              <button
                onClick={() => { archiveEstimate(confirmArchive.id); setConfirmArchive(null); }}
                className="text-xs px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`text-left font-medium uppercase tracking-wider text-[10px] px-4 py-2.5 ${className}`}>{children}</th>;
}
