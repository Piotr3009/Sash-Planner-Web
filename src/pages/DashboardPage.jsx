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

// ─── Dynamic height per project (based on batch count) ───
const BATCH_PILL_H = 32;
const BATCH_PILL_GAP = 6;
const CARD_PADDING = 24;
const MIN_CARD_H = 130;
const PROJECT_GAP = 12;

function getProjectCardHeight(batchCount) {
  if (batchCount <= 0) return MIN_CARD_H;
  const batchesHeight = batchCount * BATCH_PILL_H + (batchCount - 1) * BATCH_PILL_GAP + CARD_PADDING;
  return Math.max(MIN_CARD_H, batchesHeight);
}

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

// ─── Edit Project modal ───
function EditProjectModal({ project, onSave, onCancel }) {
  const [name, setName] = useState(project.name || '');
  const [number, setNumber] = useState(project.project_number || '');
  const [client, setClient] = useState(project.client || '');
  const [address, setAddress] = useState(project.address || '');

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      project_number: number.trim(),
      client: client.trim(),
      address: address.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-ink-50 mb-3">Edit Project</div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-0.5">Project name (max 5 chars) *</label>
            <input className="input text-xs w-full" value={name} maxLength={5} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-0.5">Project number (max 5 chars)</label>
            <input className="input text-xs w-full" value={number} maxLength={5} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-0.5">Client</label>
            <input className="input text-xs w-full" value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-ink-400 uppercase tracking-wider block mb-0.5">Address</label>
            <input className="input text-xs w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onCancel} className="btn btn-secondary text-xs px-4">Cancel</button>
          <button onClick={submit} className="btn btn-primary text-xs px-4">Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom batch-assign dropdown ───
function BatchAssignDropdown({ batchId, projectId, productionPacks, currentPPId, onAssign }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const currentPP = productionPacks.find((pp) => pp.id === currentPPId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-surface-700/60 hover:bg-surface-600 text-ink-300 hover:text-ink-100 transition-colors"
      >
        <span className="truncate max-w-[60px]">{currentPP ? currentPP.name : '— assign'}</span>
        <svg className="w-2.5 h-2.5 shrink-0 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute z-40 top-full mt-1 left-0 min-w-[140px] bg-surface-700 border border-surface-500 rounded-lg shadow-xl py-1 max-h-[200px] overflow-y-auto">
          <button
            className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-surface-600 transition-colors ${!currentPPId ? 'text-accent-400 font-medium' : 'text-ink-300'}`}
            onClick={(e) => { e.stopPropagation(); onAssign(batchId, projectId, null); setOpen(false); }}
          >
            — unassign
          </button>
          {productionPacks.map((pp) => {
            const tc = typeColor(pp.type);
            return (
              <button
                key={pp.id}
                className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-surface-600 transition-colors flex items-center gap-2 ${pp.id === currentPPId ? 'text-accent-400 font-medium' : 'text-ink-200'}`}
                onClick={(e) => { e.stopPropagation(); onAssign(batchId, projectId, pp.id); setOpen(false); }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tc.dot }} />
                <span className="truncate">{pp.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SVG connection lines (Project→Batch, Batch→PP, PP→Delivery) ───
function ConnectionLines({ containerRef, projects, productionPacks }) {
  const [lines, setLines] = useState([]);

  const compute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const newLines = [];

    // ── Project → Batch lines ──
    projects.forEach((project) => {
      const projEl = container.querySelector(`[data-project-id="${project.id}"]`);
      if (!projEl) return;
      const pRect = projEl.getBoundingClientRect();
      const pRightX = pRect.right - cRect.left;
      const pCenterY = pRect.top - cRect.top + pRect.height / 2;

      (project.batches || []).forEach((batch) => {
        const batchEl = container.querySelector(`[data-batch-id="${batch.id}"]`);
        if (!batchEl) return;
        const bRect = batchEl.getBoundingClientRect();
        const bLeftX = bRect.left - cRect.left;
        const bY = bRect.top - cRect.top + bRect.height / 2;

        const tc = typeColor(batch.type || 'sash');
        newLines.push({
          key: `p-${project.id}-${batch.id}`,
          x1: pRightX, y1: pCenterY,
          x2: bLeftX, y2: bY,
          color: tc.line,
          opacity: 0.25,
        });
      });
    });

    // ── Batch → PP lines ──
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

      // ── PP → Delivery lines ──
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

// ─── New Project form (with short name enforcement) ───
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
      <div>
        <input className="input text-xs w-full" placeholder="Project name * (max 5)" maxLength={5} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="text-[9px] text-ink-400 mt-0.5 text-right">{name.length}/5</div>
      </div>
      <div>
        <input className="input text-xs w-full" placeholder="Project number (max 5)" maxLength={5} value={number} onChange={(e) => setNumber(e.target.value)} />
        <div className="text-[9px] text-ink-400 mt-0.5 text-right">{number.length}/5</div>
      </div>
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
        Upload from <svg className="inline w-3.5 h-3.5 -mt-0.5 mx-0.5" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4A030" strokeWidth="1.5" fill="#D4A030" fillOpacity="0.15"/></svg> Joinery Core
      </button>
    </div>
  );
}

// ─── Main ───
export default function DashboardPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const productionPacks = useProjectStore((s) => s.productionPacks);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
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
  const [confirmAction, setConfirmAction] = useState(null);
  const [editProject, setEditProject] = useState(null); // project being edited

  // ─── Per-project dynamic heights ───
  const projectHeights = useMemo(() => {
    const heights = {};
    projects.forEach((p) => {
      heights[p.id] = getProjectCardHeight((p.batches || []).length);
    });
    return heights;
  }, [projects]);

  const deliveryData = useMemo(() => {
    return projects.map((project) => {
      const batches = project.batches || [];
      const summary = {};
      let totalWindows = 0;
      let completedBatches = 0;

      batches.forEach((batch) => {
        const winCount = batch.windows?.length || 0;
        totalWindows += winCount;
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

  const handleEditProjectSave = (patch) => {
    if (editProject) {
      updateProject(editProject.id, patch);
      setEditProject(null);
    }
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

  // Total height for PP centering
  const projectsBlockHeight = projects.reduce((sum, p) => sum + (projectHeights[p.id] || MIN_CARD_H), 0) + Math.max(0, projects.length - 1) * PROJECT_GAP;

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

            {/* ─── Col 1: Projects (160px, dynamic height cards) ─── */}
            <div style={{ width: 160 }} className="shrink-0">
              <div style={{ display: 'flex', flexDirection: 'column', gap: PROJECT_GAP }}>
                {projects.map((project) => {
                  const h = projectHeights[project.id] || MIN_CARD_H;
                  return (
                    <div
                      key={project.id}
                      data-project-id={project.id}
                      className="relative group"
                      style={{ height: h }}
                    >
                      <Link
                        to={`/projects/${project.id}`}
                        className="card p-3 block hover:border-accent-500/40 transition-all overflow-hidden h-full"
                      >
                        <div className="text-xs font-semibold text-ink-50 truncate pr-10">{project.name}</div>
                        <div className="text-[10px] text-ink-400 mt-0.5">{project.project_number}</div>
                        <div className="text-[10px] text-ink-200 mt-1 truncate">{project.client}</div>
                        <div className="text-[9px] text-ink-400 mt-1 truncate">{project.address}</div>
                      </Link>
                      {/* Edit button */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditProject(project); }}
                        className="absolute top-2 right-8 w-5 h-5 rounded flex items-center justify-center text-ink-400 hover:text-accent-400 hover:bg-accent-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Edit project"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteProject(e, project)}
                        className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[10px] text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete project"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
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

            {/* ─── Col 2: Batches (200px, dynamic height, centered per project) ─── */}
            <div style={{ width: 200, marginLeft: 16 }} className="shrink-0">
              <div style={{ display: 'flex', flexDirection: 'column', gap: PROJECT_GAP }}>
                {projects.map((project) => {
                  const batches = project.batches || [];
                  const h = projectHeights[project.id] || MIN_CARD_H;
                  return (
                    <div key={project.id} style={{ height: h }} className="flex flex-col justify-center">
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
                              <span className="ml-auto">
                                <BatchAssignDropdown
                                  batchId={batch.id}
                                  projectId={project.id}
                                  productionPacks={productionPacks}
                                  currentPPId={assignedPP?.id || ''}
                                  onAssign={handleAssign}
                                />
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
                          <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0 font-medium" style={{ background: tc.bg, color: tc.text }}>
                            {typeLabel(pp.type)}
                          </span>
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

            {/* ─── Col 4: Project Complete (dynamic height, matching project cards) ─── */}
            <div style={{ marginLeft: 100, minWidth: 160 }} className="flex-1">
              <div style={{ display: 'flex', flexDirection: 'column', gap: PROJECT_GAP }}>
                {deliveryData.map((d) => {
                  const h = projectHeights[d.projectId] || MIN_CARD_H;
                  const progress = d.totalBatches > 0
                    ? Math.round((d.completedBatches / d.totalBatches) * 100)
                    : 0;

                  return (
                    <div
                      key={d.projectId}
                      data-delivery-id={d.projectId}
                      className="card p-3 overflow-hidden"
                      style={{ height: h }}
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

      {/* Edit project modal */}
      {editProject && (
        <EditProjectModal
          project={editProject}
          onSave={handleEditProjectSave}
          onCancel={() => setEditProject(null)}
        />
      )}
    </>
  );
}
