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

      // Track which projects this PP connects to (for PP→Delivery lines)
      const connectedProjects = new Set();

      pp.assignments.forEach(({ projectId, batchId }) => {
        // Batch → PP lines
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
        });

        connectedProjects.add(projectId);
      });

      // PP → Delivery lines
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
          opacity: 0.25,
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
        const dx = (l.x2 - l.x1) * 0.45;
        return (
          <path
            key={l.key}
            d={`M${l.x1} ${l.y1} C${l.x1 + dx} ${l.y1}, ${l.x2 - dx} ${l.y2}, ${l.x2} ${l.y2}`}
            fill="none"
            stroke={l.color}
            strokeWidth="1.5"
            opacity={l.opacity || 0.45}
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
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), address.trim(), '', client.trim());
    setName(''); setAddress(''); setClient('');
  };

  return (
    <div className="card p-3 space-y-2">
      <input className="input text-xs" placeholder="Project name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="input text-xs" placeholder="Client" value={client} onChange={(e) => setClient(e.target.value)} />
      <input className="input text-xs" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-primary text-xs flex-1" onClick={submit}>Create</button>
        <button className="btn btn-secondary text-xs" onClick={onCancel}>Cancel</button>
      </div>
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

  // Load mock data
  useEffect(() => {
    if (projects.length === 0) setProjects(mockProjects);
    if (productionPacks.length === 0) setProductionPacks(mockProductionPacks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute delivery data per project
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
        summary,
        totalWindows,
        totalBatches: batches.length,
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
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Production planner</h1>
          <p className="text-[10px] text-ink-400 mt-0.5">Assign batches to production packs · track delivery</p>
        </div>
        <div className="text-[10px] text-ink-400">
          {projects.length} projects · {productionPacks.length} production packs
        </div>
      </div>

      {/* Column headers */}
      <div className="grid gap-3 mb-2" style={{ gridTemplateColumns: '150px 190px 1fr 150px' }}>
        <div className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Projects</div>
        <div className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Batches</div>
        <div className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Production packs</div>
        <div className="text-[9px] uppercase tracking-widest text-ink-400 font-semibold">Delivery</div>
      </div>

      {/* Main grid with connections */}
      <div ref={containerRef} className="relative">
        <ConnectionLines containerRef={containerRef} projects={projects} productionPacks={productionPacks} />

        <div className="grid gap-3" style={{ gridTemplateColumns: '150px 190px 1fr 150px' }}>

          {/* ─── Col 1: Projects ─── */}
          <div className="space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="card p-2.5 block hover:border-accent-500/40 transition-all"
              >
                <div className="text-[11px] font-semibold text-ink-50 truncate">{project.name}</div>
                <div className="text-[9px] text-ink-400 mt-0.5">{project.project_number}</div>
                <div className="text-[9px] text-ink-200 truncate">{project.client}</div>
              </Link>
            ))}
            {showNewProject ? (
              <NewProjectForm onCreate={handleCreateProject} onCancel={() => setShowNewProject(false)} />
            ) : (
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full py-2 rounded-lg border border-dashed border-surface-500 text-ink-400 text-[10px] hover:border-accent-500 hover:text-accent-400 transition-all"
              >
                + New project
              </button>
            )}
          </div>

          {/* ─── Col 2: Batches ─── */}
          <div className="space-y-2">
            {projects.map((project) => (
              <div key={project.id} className="space-y-1" style={{ minHeight: '66px' }}>
                {(project.batches || []).map((batch) => {
                  const tc = typeColor(batch.type);
                  const assignedPP = getPackForBatch(project.id, batch.id);
                  const winCount = batch.windows?.length || 0;

                  return (
                    <div
                      key={batch.id}
                      data-batch-id={batch.id}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]"
                      style={{ background: tc.bg, border: `0.5px solid ${tc.border}` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tc.dot }} />
                      <span className="font-medium truncate" style={{ color: tc.text }}>
                        {typeLabel(batch.type)} ×{winCount}
                      </span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <select
                          className="bg-transparent text-[9px] outline-none cursor-pointer"
                          style={{ color: assignedPP ? tc.text : '#6B7385', maxWidth: '65px', appearance: 'none', WebkitAppearance: 'none' }}
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
                {(project.batches || []).length === 0 && (
                  <div className="text-[9px] text-ink-400 italic py-1">No batches</div>
                )}
              </div>
            ))}
          </div>

          {/* ─── Col 3: Production Packs (compact) ─── */}
          <div className="space-y-1.5">
            {productionPacks.map((pp) => {
              const tc = typeColor(pp.type);
              const assignedBatches = pp.assignments || [];
              let totalWindows = 0;
              const projectIds = new Set();

              assignedBatches.forEach(({ projectId, batchId }) => {
                const project = projects.find((p) => p.id === projectId);
                const batch = project?.batches?.find((b) => b.id === batchId);
                totalWindows += batch?.windows?.length || 0;
                if (project) projectIds.add(projectId);
              });

              const statusDot = pp.status === 'complete' ? '#10B981' : pp.status === 'in-production' ? '#3B82F6' : '#F59E0B';

              return (
                <Link
                  key={pp.id}
                  to={`/projects/${assignedBatches[0]?.projectId || ''}/batches/${assignedBatches[0]?.batchId || ''}/production-pack`}
                  data-pp-id={pp.id}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:brightness-110 transition-all cursor-pointer"
                  style={{ background: tc.bg, border: `0.5px solid ${tc.border}` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tc.dot }} />
                  <span className="text-[10px] font-medium truncate" style={{ color: tc.text }}>{pp.name}</span>
                  <span className="text-[9px] shrink-0" style={{ color: tc.text, opacity: 0.6 }}>
                    {totalWindows}w · {projectIds.size}p
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-auto" style={{ background: statusDot }} title={pp.status} />
                </Link>
              );
            })}

            {showNewPP ? (
              <NewPPForm onCreate={handleCreatePP} onCancel={() => setShowNewPP(false)} />
            ) : (
              <button
                onClick={() => setShowNewPP(true)}
                className="w-full py-1.5 rounded-md border border-dashed border-surface-500 text-ink-400 text-[10px] hover:border-accent-500 hover:text-accent-400 transition-all"
              >
                + New production pack
              </button>
            )}
          </div>

          {/* ─── Col 4: Delivery ─── */}
          <div className="space-y-2">
            {deliveryData.map((d) => {
              const progress = d.totalBatches > 0
                ? Math.round((d.completedBatches / d.totalBatches) * 100)
                : 0;

              return (
                <div key={d.projectId} data-delivery-id={d.projectId} className="card p-2.5">
                  <div className="text-[10px] font-semibold text-ink-50 truncate">{d.projectNumber}</div>
                  <div className="text-[9px] text-ink-200 truncate">{d.projectName}</div>

                  <div className="mt-1.5 space-y-0.5">
                    {Object.entries(d.summary).map(([type, count]) => {
                      const tc = typeColor(type);
                      return (
                        <div key={type} className="flex items-center gap-1 text-[9px]">
                          <span className="w-1 h-1 rounded-full" style={{ background: tc.dot }} />
                          <span style={{ color: tc.text }}>{count} {typeLabel(type).toLowerCase()}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5">
                    <div className="h-1 rounded-full bg-surface-500 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: d.allComplete ? '#10B981' : '#00B4A0',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-ink-400 mt-0.5">
                      <span>{d.completedBatches}/{d.totalBatches}</span>
                      <span>{progress}%</span>
                    </div>
                  </div>

                  {d.allComplete && (
                    <div className="text-[8px] text-green-400 mt-1 uppercase tracking-wider font-medium">
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
  );
}
