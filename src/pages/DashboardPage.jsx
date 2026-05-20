import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { mockProjects, mockProductionPacks } from '../mocks/mockProjects.js';

// ─── Type colors ───
const TYPE_COLORS = {
  sash:     { bg: 'rgba(127,119,221,0.12)', border: 'rgba(127,119,221,0.3)', text: '#AFA9EC', line: '#7F77DD', dot: '#7F77DD' },
  casement: { bg: 'rgba(212,83,126,0.12)',  border: 'rgba(212,83,126,0.3)',  text: '#ED93B1', line: '#D4537E', dot: '#D4537E' },
  doors:    { bg: 'rgba(239,159,39,0.12)',  border: 'rgba(239,159,39,0.3)',  text: '#FAC775', line: '#EF9F27', dot: '#EF9F27' },
  special:  { bg: 'rgba(29,158,117,0.12)',  border: 'rgba(29,158,117,0.3)',  text: '#5DCAA5', line: '#1D9E75', dot: '#1D9E75' },
};
const typeColor = (type) => TYPE_COLORS[type] || TYPE_COLORS.sash;
const typeLabel = (type) => ({ sash: 'Sash', casement: 'Casement', doors: 'Doors', special: 'Special' }[type] || type);

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
          <option value="special">Special</option>
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
  const projects = useProjectStore((s) => s.projects);
  const productionPacks = useProjectStore((s) => s.productionPacks);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setProductionPacks = useProjectStore((s) => s.setProductionPacks);
  const createProject = useProjectStore((s) => s.createProject);
  const createProductionPack = useProjectStore((s) => s.createProductionPack);
  const assignBatch = useProjectStore((s) => s.assignBatchToProductionPack);
  const unassignBatch = useProjectStore((s) => s.unassignBatchFromProductionPack);
  const getPackForBatch = useProjectStore((s) => s.getProductionPackForBatch);
  const containerRef = useRef(null);

  const [showNewPP, setShowNewPP] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    if (projects.length === 0) setProjects(mockProjects);
    if (productionPacks.length === 0) setProductionPacks(mockProductionPacks);
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
        if (batch.status === 'complete') completedBatches++;
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
  }, [projects]);

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

  return (
    <div className="h-screen flex bg-surface-800">

      {/* ─── Left placeholder (future menu) ─── */}
      <div className="w-32 shrink-0 bg-surface-900 border-r border-surface-500">
        <div className="p-4">
          <div className="text-xs font-semibold text-accent-500">Sash Planner</div>
          <div className="text-[9px] text-ink-400 mt-0.5">Production</div>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 overflow-auto p-6">
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
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="card p-3 block hover:border-accent-500/40 transition-all overflow-hidden"
                    style={{ height: PROJECT_CARD_H }}
                  >
                    <div className="text-xs font-semibold text-ink-50 truncate">{project.name}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5">{project.project_number}</div>
                    <div className="text-[10px] text-ink-200 mt-1 truncate">{project.client}</div>
                    <div className="text-[9px] text-ink-400 mt-1 truncate">{project.address}</div>
                  </Link>
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

                  const statusColor = pp.status === 'complete' ? '#10B981' : pp.status === 'in-production' ? '#3B82F6' : '#F59E0B';
                  const statusLabel = pp.status === 'complete' ? 'Complete' : pp.status === 'in-production' ? 'In production' : 'Preparation';

                  return (
                    <div
                      key={pp.id}
                      data-pp-id={pp.id}
                      className="card-elevated p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tc.dot }} />
                        <span className="text-xs font-semibold text-ink-50 truncate">{pp.name}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: `${statusColor}20`, color: statusColor, border: `0.5px solid ${statusColor}40` }}
                        >
                          {statusLabel}
                        </span>
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
    </div>
  );
}
