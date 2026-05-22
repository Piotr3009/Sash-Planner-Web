import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore, BATCH_STATUSES } from '../stores/projectStore.js';

// ─── Type colors ───
const TYPE_COLORS = {
  sash:     { bg: 'rgba(127,119,221,0.12)', border: 'rgba(127,119,221,0.3)', text: '#AFA9EC', line: '#7F77DD', dot: '#7F77DD' },
  casement: { bg: 'rgba(212,83,126,0.12)',  border: 'rgba(212,83,126,0.3)',  text: '#ED93B1', line: '#D4537E', dot: '#D4537E' },
  doors:    { bg: 'rgba(239,159,39,0.12)',  border: 'rgba(239,159,39,0.3)',  text: '#FAC775', line: '#EF9F27', dot: '#EF9F27' },
  special:  { bg: 'rgba(29,158,117,0.12)',  border: 'rgba(29,158,117,0.3)',  text: '#5DCAA5', line: '#1D9E75', dot: '#1D9E75' },
};
const typeColor = (type) => TYPE_COLORS[type] || TYPE_COLORS.sash;
const typeLabel = (type) => ({ sash: 'Sash', casement: 'Casement', doors: 'Doors', special: 'Special / Other' }[type] || type);

const STATUS_CONFIG = {
  preparation:     { label: 'Prep',    color: '#F59E0B' },
  'in-production': { label: 'Prod',    color: '#3B82F6' },
  complete:        { label: 'Done',    color: '#10B981' },
};

// ─── Confirmation modal ───
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-ink-50 mb-2">{title}</div>
        <div className="text-xs text-ink-300 mb-4">{message}</div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={onConfirm} className="text-xs px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

const PROJECT_CARD_H = 130;
const PROJECT_GAP = 12;

// ─── SVG connection lines (Batch→PP and PP→Delivery) ───
function ConnectionLines({ containerRef, projects, productionPacks }) {
  const [lines, setLines] = useState([]);

  const compute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const newLines = [];

    productionPacks.forEach((pp) => {
      const ppEl = container.querySelector(`[data-pp-id="${pp.id}"]`);
      if (!ppEl) return;
      const ppRect = ppEl.getBoundingClientRect();
      const ppLeftX = ppRect.left - cRect.left;
      const ppRightX = ppRect.right - cRect.left;
      const ppY = ppRect.top - cRect.top + ppRect.height / 2;

      const connectedProjects = new Set();

      pp.assignments.forEach(({ projectId, batchId }) => {
        const batchEl = container.querySelector(`[data-batch-id="${batchId}"]`);
        if (!batchEl) return;
        const bRect = batchEl.getBoundingClientRect();
        const bX = bRect.right - cRect.left;
        const bY = bRect.top - cRect.top + bRect.height / 2;

        const batch = projects
          .find((p) => p.id === projectId)
          ?.batches?.find((b) => b.id === batchId);

        newLines.push({
          key: `b-${batchId}-${pp.id}`,
          x1: bX, y1: bY,
          x2: ppLeftX, y2: ppY,
          color: typeColor(batch?.type || 'sash').line,
          opacity: 0.45,
        });

        connectedProjects.add(projectId);
      });

      connectedProjects.forEach((projectId) => {
        const delEl = container.querySelector(`[data-delivery-id="${projectId}"]`);
        if (!delEl) return;
        const dRect = delEl.getBoundingClientRect();
        const dX = dRect.left - cRect.left;
        const dY = dRect.top - cRect.top + dRect.height / 2;

        newLines.push({
          key: `d-${pp.id}-${projectId}`,
          x1: ppRightX, y1: ppY,
          x2: dX, y2: dY,
          color: typeColor(pp.type || 'sash').line,
          opacity: 0.45,
        });
      });
    });
    setLines(newLines);
  }, [containerRef, projects, productionPacks]);

  useEffect(() => {
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [compute]);

  if (lines.length === 0) return null;
  const maxY = Math.max(...lines.map((l) => Math.max(l.y1, l.y2)), 0) + 40;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: maxY, pointerEvents: 'none', overflow: 'visible' }}>
      {lines.map((l) => {
        const dx = (l.x2 - l.x1) * 0.4;
        return (
          <path
            key={l.key}
            d={`M${l.x1} ${l.y1} C${l.x1 + dx} ${l.y1}, ${l.x2 - dx} ${l.y2}, ${l.x2} ${l.y2}`}
            fill="none"
            stroke={l.color}
            strokeWidth="1.5"
            opacity={l.opacity}
          />
        );
      })}
    </svg>
  );
}

// ─── New Production Pack form ───
function NewPPForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('sash');
  const [deadline, setDeadline] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), type, deadline);
    setName(''); setType('sash'); setDeadline('');
  };

  return (
    <div className="card p-3 space-y-2">
      <input className="input text-xs" placeholder="Name, e.g. #2 Sash windows" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <select className="input text-xs flex-1" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="sash">Sash</option>
          <option value="casement">Casement</option>
          <option value="doors">Doors</option>
          <option value="special">Special / Other</option>
        </select>
        <input type="date" className="input text-xs flex-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary text-xs flex-1" onClick={submit}>Create</button>
        <button className="btn btn-secondary text-xs" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── New Project form ───
function NewProjectForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [client, setClient] = useState('');
  const [address, setAddress] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), address.trim(), number.trim(), client.trim());
    setName(''); setNumber(''); setClient(''); setAddress('');
  };

  return (
    <div className="card p-3 space-y-2">
      <input className="input text-xs" placeholder="Project name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="input text-xs" placeholder="Project number" value={number} onChange={(e) => setNumber(e.target.value)} />
      <input className="input text-xs" placeholder="Client" value={client} onChange={(e) => setClient(e.target.value)} />
      <input className="input text-xs" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-primary text-xs flex-1" onClick={submit}>Create</button>
        <button className="btn btn-secondary text-xs" onClick={onCancel}>Cancel</button>
      </div>
      <button
        className="w-full py-2 rounded-lg border border-surface-500 text-accent-400 text-[10px] hover:bg-surface-700 transition-all"
        onClick={() => { /* Future: Joinery Core import */ }}
      >
        Upload from Joinery Core
      </button>
    </div>
  );
}

// ─── Main ───
export default function DashboardPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const productionPacks = useProjectStore((s) => s.productionPacks);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const createProductionPack = useProjectStore((s) => s.createProductionPack);
  const assignBatch = useProjectStore((s) => s.assignBatchToProductionPack);
  const unassignBatch = useProjectStore((s) => s.unassignBatchFromProductionPack);
  const getPackForBatch = useProjectStore((s) => s.getProductionPackForBatch);
  const updateProductionPack = useProjectStore((s) => s.updateProductionPack);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const deleteProductionPack = useProjectStore((s) => s.deleteProductionPack);
  const containerRef = useRef(null);

  const [showNewPP, setShowNewPP] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm }

  useEffect(() => {
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Total height of projects column (for PP centering)
  const projectsBlockHeight = projects.length * PROJECT_CARD_H + Math.max(0, projects.length - 1) * PROJECT_GAP;

  const deliveryData = useMemo(() => {
    return projects.map((project) => {
      const batches = project.batches || [];
      const summary = {};
      let totalWindows = 0;
      let completedBatches = 0;

      batches.forEach((batch) => {
        const winCount = batch.windows?.length || 0;
        totalWindows += winCount;
        // Completion is determined by Production Pack status, not batch status
        const assignedPP = productionPacks.find((pp) =>
          pp.assignments.some((a) => a.projectId === project.id && a.batchId === batch.id)
        );
        if (assignedPP?.status === 'complete') completedBatches++;
        const t = batch.type || 'sash';
        summary[t] = (summary[t] || 0) + winCount;
      });

      return {
        projectId: project.id,
        projectName: project.name,
        projectNumber: project.project_number,
        summary, totalWindows, totalBatches: batches.length,
        completedBatches,
        allComplete: batches.length > 0 && completedBatches === batches.length,
      };
    });
  }, [projects, productionPacks]);

  const handleAssign = (batchId, projectId, ppId) => {
    const currentPP = getPackForBatch(projectId, batchId);
    if (currentPP) unassignBatch(currentPP.id, projectId, batchId);
    if (ppId) assignBatch(ppId, projectId, batchId);
  };

  const handleCreatePP = (name, type, deadline) => {
    createProductionPack(name, type, deadline);
    setShowNewPP(false);
  };

  const handleCreateProject = (name, address, number, client) => {
    createProject(name, address, number, client);
    setShowNewProject(false);
  };

  const handleDeleteProject = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    const batchCount = project.batches?.length || 0;
    setConfirmAction({
      title: `Delete "${project.name}"?`,
      message: `This will permanently delete the project${batchCount > 0 ? `, all ${batchCount} batches, and their windows` : ''}. Batch assignments in production packs will be removed.`,
      onConfirm: () => { deleteProject(project.id); setConfirmAction(null); },
    });
  };

  const handleDeletePP = (e, pp) => {
    e.preventDefault();
    e.stopPropagation();
    const batchCount = pp.assignments?.length || 0;
    setConfirmAction({
      title: `Delete "${pp.name}"?`,
      message: `This will permanently delete the production pack.${batchCount > 0 ? ` ${batchCount} batch assignments will be unlinked (batches themselves remain in their projects).` : ''}`,
      onConfirm: () => { deleteProductionPack(pp.id); setConfirmAction(null); },
    });
  };

  const handlePPStatusChange = (e, ppId) => {
    e.preventDefault();
    e.stopPropagation();
    updateProductionPack(ppId, { status: e.target.value });
  };

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Production planner</h1>
            <p className="text-[10px] text-ink-400 mt-0.5">Assign batches to production packs · track project completion</p>
          </div>
          <div className="text-[10px] text-ink-400">
            {projects.length} projects · {productionPacks.length} production packs
          </div>
        </div>

        {/* Column headers */}
        <div className="flex mb-2">
          <div style={{ width: 160 }} className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Projects</div>
          <div style={{ width: 200, marginLeft: 16 }} className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Batches</div>
          <div style={{ width: 500, marginLeft: 100 }} className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Production packs</div>
          <div style={{ marginLeft: 100 }} className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Project complete</div>
        </div>

        {/* Main content with connections */}
        <div ref={containerRef} className="relative">
          <ConnectionLines containerRef={containerRef} projects={projects} productionPacks={productionPacks} />

          <div className="flex items-start">

            {/* ─── Col 1: Projects (160px, fixed 130px cards) ─── */}
            <div style={{ width: 160 }} className="shrink-0">
              <div style={{ display: 'flex', flexDirection: 'column', gap: PROJECT_GAP }}>
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="relative group"
                    style={{ height: PROJECT_CARD_H }}
                  >
                    <Link
                      to={`/projects/${project.id}`}
                      className="card p-3 block hover:border-accent-500/40 transition-all overflow-hidden h-full"
                    >
                      <div className="text-xs font-semibold text-ink-50 truncate pr-5">{project.name}</div>
                      <div className="text-[10px] text-ink-400 mt-0.5">{project.project_number}</div>
                      <div className="text-[10px] text-ink-200 mt-1 truncate">{project.client}</div>
                      <div className="text-[9px] text-ink-400 mt-1 truncate">{project.address}</div>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteProject(e, project)}
                      className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[10px] text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete project"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                {showNewProject ? (
                  <NewProjectForm onCreate={handleCreateProject} onCancel={() => setShowNewProject(false)} />
                ) : (
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-surface-500 text-ink-400 text-xs hover:border-accent-500 hover:text-accent-400 transition-all"
                  >
                    + New project
                  </button>
                )}
              </div>
            </div>

            {/* ─── Col 2: Batches (200px, 16px gap, centered per project) ─── */}
            <div style={{ width: 200, marginLeft: 16 }} className="shrink-0">
              <div style={{ display: 'flex', flexDirection: 'column', gap: PROJECT_GAP }}>
                {projects.map((project) => {
                  const batches = project.batches || [];
                  return (
                    <div key={project.id} style={{ height: PROJECT_CARD_H }} className="flex flex-col justify-center">
                      <div className="space-y-1.5">
                        {batches.map((batch) => {
                          const tc = typeColor(batch.type);
                          const assignedPP = getPackForBatch(project.id, batch.id);
                          const winCount = batch.windows?.length || 0;

                          return (
                            <div
                              key={batch.id}
                              data-batch-id={batch.id}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs"
                              style={{ background: tc.bg, border: `0.5px solid ${tc.border}` }}
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tc.dot }} />
                              <span className="font-medium truncate" style={{ color: tc.text }}>
                                {typeLabel(batch.type)} ×{winCount}
                              </span>
                              <span className="ml-auto flex items-center gap-0.5">
                                <select
                                  className="bg-transparent text-[9px] outline-none cursor-pointer"
                                  style={{ color: assignedPP ? tc.text : '#6B7385', maxWidth: '68px', appearance: 'none', WebkitAppearance: 'none' }}
                                  value={assignedPP?.id || ''}
                                  onChange={(e) => handleAssign(batch.id, project.id, e.target.value || null)}
                                >
                                  <option value="">— assign</option>
                                  {productionPacks.map((pp) => (
                                    <option key={pp.id} value={pp.id}>{pp.name}</option>
                                  ))}
                                </select>
                                <span style={{ color: '#6B7385', fontSize: '8px', pointerEvents: 'none' }}>▾</span>
                              </span>
                            </div>
                          );
                        })}
                        {batches.length === 0 && (
                          <div className="text-[10px] text-ink-400 italic">No batches</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Col 3: Production Packs (500px, 100px gap, vertically centered) ─── */}
            <div style={{ width: 500, marginLeft: 100, minHeight: projectsBlockHeight }} className="shrink-0 flex flex-col justify-center">
              <div className="space-y-4">
                {productionPacks.map((pp) => {
                  const tc = typeColor(pp.type);
                  const assignedBatches = pp.assignments || [];
                  let totalWindows = 0;
                  const projectSummary = [];

                  assignedBatches.forEach(({ projectId, batchId }) => {
                    const project = projects.find((p) => p.id === projectId);
                    const batch = project?.batches?.find((b) => b.id === batchId);
                    const wc = batch?.windows?.length || 0;
                    totalWindows += wc;
                    if (project) {
                      projectSummary.push({ name: project.project_number || project.name, count: wc });
                    }
                  });

                  const statusColor = STATUS_CONFIG[pp.status]?.color || '#F59E0B';

                  return (
                    <div key={pp.id} className="relative group">
                      <div
                        data-pp-id={pp.id}
                        className="card-elevated p-3 block hover:border-accent-500/40 transition-all cursor-pointer"
                        onClick={() => navigate(`/production-packs/${pp.id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tc.dot }} />
                          <span className="text-xs font-semibold text-ink-50 truncate pr-6">{pp.name}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-1.5">
                          <select
                            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full cursor-pointer outline-none"
                            style={{
                              background: `${statusColor}20`,
                              color: statusColor,
                              border: `0.5px solid ${statusColor}40`,
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              paddingRight: '14px',
                            }}
                            value={pp.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { e.stopPropagation(); handlePPStatusChange(e, pp.id); }}
                          >
                            {BATCH_STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_CONFIG[s]?.label === 'Prep' ? 'Preparation' : STATUS_CONFIG[s]?.label === 'Prod' ? 'In production' : STATUS_CONFIG[s]?.label || s}</option>
                            ))}
                          </select>
                          <span style={{ color: statusColor, fontSize: '7px', marginLeft: '-12px', pointerEvents: 'none' }}>▾</span>
                          {pp.deadline && (
                            <span className="text-[9px] text-ink-400">
                              DL {new Date(pp.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-ink-200 mb-1.5">
                          {totalWindows} window{totalWindows !== 1 ? 's' : ''} · {assignedBatches.length} batch{assignedBatches.length !== 1 ? 'es' : ''}
                        </div>

                        {projectSummary.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {projectSummary.map((ps, i) => (
                              <span
                                key={i}
                                className="text-[9px] px-1.5 py-0.5 rounded"
                                style={{ background: tc.bg, color: tc.text }}
                              >
                                {ps.name} ×{ps.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeletePP(e, pp)}
                        className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[10px] text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete production pack"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}

                {showNewPP ? (
                  <NewPPForm onCreate={handleCreatePP} onCancel={() => setShowNewPP(false)} />
                ) : (
                  <button
                    onClick={() => setShowNewPP(true)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-surface-500 text-ink-400 text-xs hover:border-accent-500 hover:text-accent-400 transition-all"
                  >
                    + New production pack
                  </button>
                )}
              </div>
            </div>

            {/* ─── Col 4: Project Complete (100px gap, fixed 130px cards) ─── */}
            <div style={{ marginLeft: 100, minWidth: 160 }} className="flex-1">
              <div style={{ display: 'flex', flexDirection: 'column', gap: PROJECT_GAP }}>
                {deliveryData.map((d) => {
                  const progress = d.totalBatches > 0
                    ? Math.round((d.completedBatches / d.totalBatches) * 100)
                    : 0;

                  return (
                    <div
                      key={d.projectId}
                      data-delivery-id={d.projectId}
                      className="card p-3 overflow-hidden"
                      style={{ height: PROJECT_CARD_H }}
                    >
                      <div className="text-xs font-semibold text-ink-50 truncate">{d.projectNumber}</div>
                      <div className="text-[10px] text-ink-200 mt-0.5 truncate">{d.projectName}</div>

                      <div className="mt-1.5 space-y-0.5">
                        {Object.entries(d.summary).map(([type, count]) => {
                          const tc = typeColor(type);
                          return (
                            <div key={type} className="flex items-center gap-1.5 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: tc.dot }} />
                              <span style={{ color: tc.text }}>{count} {typeLabel(type).toLowerCase()}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[9px] text-ink-400 mb-0.5">
                          <span>{d.completedBatches}/{d.totalBatches} batches</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-500 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progress}%`,
                              background: d.allComplete ? '#10B981' : '#00B4A0',
                            }}
                          />
                        </div>
                      </div>

                      {d.allComplete && (
                        <div className="text-[9px] text-green-400 mt-1 uppercase tracking-wider font-medium">
                          Ready for delivery
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}