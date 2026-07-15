import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { useIronmongeryStore } from '../stores/ironmongeryStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import { withProfiles } from '../engine/profile.js';
import { buildGlassListForWindow, buildVentGrilles } from '../engine/lists.js';
import { buildWindowPartQtys, buildWindowHardware, resolvePartTotal, formatQty, mergeWindowMaterials } from '../engine/bom.js';
import ImageLightbox from '../components/ImageLightbox.jsx';
import DrawingsPanel from '../components/drawings/DrawingsPanel.jsx';
import GlassDrawing2D from '../components/drawings/GlassDrawing2D.jsx';
import CutListPanel from '../components/dashboard/CutListPanel.jsx';
import PreCutPanel from '../components/dashboard/PreCutPanel.jsx';
import ThreeDPanel from '../components/dashboard/ThreeDPanel.jsx';
import ExportControls from '../components/export/ExportControls.jsx';
import { exportGlassPDF } from '../utils/glassPdfExport.js';
import { exportBomPDF } from '../utils/bomPdfExport.js';


const TABS = [
  { id: '3d', label: '3D Preview', icon: '🧊' },
  { id: '2d', label: '2D Drawings', icon: '📐' },
  { id: 'precut', label: 'Pre-Cut', icon: '📏' },
  { id: 'cutlist', label: 'Cut List', icon: '🪚' },
  { id: 'glass', label: 'Glass', icon: '🪟' },
  { id: 'bom', label: 'BOM', icon: '📋' },
];

export default function WindowDetailPage() {
  const { projectId, batchId, windowId } = useParams();
  const projects = useProjectStore((s) => s.projects);
  const currentWindows = useProjectStore((s) => s.currentWindows);
  const currentBatch = useProjectStore((s) => s.currentBatch);
  const settings = useProjectStore((s) => s.settings);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentBatch = useProjectStore((s) => s.setCurrentBatch);

  useEffect(() => {
    const allProjects = useProjectStore.getState().projects;
    const project = allProjects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      const batch = project.batches?.find(b => b.id === batchId);
      if (batch) setCurrentBatch(batch);
    }
  }, [projectId, batchId, projects.length]);

  const item = useMemo(() => {
    let found = currentWindows.find((w) => w.id === windowId);
    if (!found) {
      const project = projects.find(p => p.id === projectId);
      const batch = project?.batches?.find(b => b.id === batchId);
      found = batch?.windows?.find(w => w.id === windowId);
    }
    return found || null;
  }, [currentWindows, projects, projectId, batchId, windowId]);

  const spec = useMemo(() => (item ? parseSpecification(item.specification) : null), [item]);
  const windowSpec = useMemo(() => (item ? normaliseToWindowSpec(item, spec) : null), [item, spec]);
  const derived = useMemo(() => {
    if (!windowSpec) return null;
    try { return withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, () => deriveWindowData(windowSpec, settings)); }
    catch (e) { console.warn('Calculation failed:', e); return null; }
  }, [windowSpec, settings]);

  const [tab, setTab] = useState('3d');

  const backUrl = `/projects/${projectId}`;
  const editUrl = `/projects/${projectId}/batches/${batchId}/configurator?edit=${windowId}`;

  if (!item) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link to={backUrl} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to project</Link>
        <div className="card p-8 mt-4 text-center text-ink-400">Window not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to={backUrl} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to project</Link>
      <div className="flex items-end justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">{item.name || `Window`}</h1>
          <p className="text-sm text-ink-400">
            {item.window_type || 'sash'} · {item.width}×{item.height} mm
            {currentBatch && <span> · {currentBatch.label}</span>}
          </p>
        </div>
        <Link to={editUrl} className="btn btn-primary text-sm">✏️ Edit Configuration</Link>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-surface-500 flex gap-1 mb-4">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === t.id
                ? 'border-accent-500 text-accent-400'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}>
            <span className="text-base">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="xl:col-span-2">
          {tab === '3d' && (
            <ThreeDPanel item={item} windowSpec={windowSpec} batch={currentBatch} editUrl={editUrl} />
          )}

          {tab === '2d' && (
            <DrawingsPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} />
          )}

          {tab === 'cutlist' && (
            <CutListPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} />
          )}

          {tab === 'precut' && (
            <PreCutPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} />
          )}

          {tab === 'glass' && (
            <GlassPanel item={item} windowSpec={windowSpec} derived={derived} batch={currentBatch} settings={settings} />
          )}

          {tab === 'bom' && (
            <BOMPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} />
          )}
        </div>

        {/* RIGHT: Spec panel */}
        <aside className="card p-5 space-y-4 self-start">
          <SpecSection title="Frame">
            <SpecRow label="Width" value={`${windowSpec?.frame.width} mm`} />
            <SpecRow label="Height" value={`${windowSpec?.frame.height} mm`} />
            <SpecRow label="Depth" value={`${windowSpec?.frame.depth || 164} mm`} />
          </SpecSection>
          <SpecSection title="Sashes & Bars">
            <SpecRow label="Grid" value={windowSpec?.sash.grid.mode} />
            <SpecRow label="Upper" value={item.upperBars || 'none'} />
            {!item.sameBars && <SpecRow label="Lower" value={item.lowerBars || 'none'} />}
            <SpecRow label="Horns" value={windowSpec?.sash.hornType || 'none'} />
          </SpecSection>
          <SpecSection title="Glass">
            <SpecRow label="Type" value={windowSpec?.glazing.type} />
            <SpecRow label="Spec" value={windowSpec?.glazing.spec} />
            <SpecRow label="Finish" value={windowSpec?.glazing.finish} />
            <SpecRow label="Spacer" value={windowSpec?.glazing.spacerColour} />
          </SpecSection>
          <SpecSection title="Colour">
            <SpecRow label="Mode" value={windowSpec?.color.type} />
            <ColourRow label="Colour" hex={windowSpec?.color.single} />
            {windowSpec?.color.type === 'dual' && <>
              <ColourRow label="Exterior" hex={windowSpec?.color.outside} />
              <ColourRow label="Interior" hex={windowSpec?.color.inside} />
            </>}
          </SpecSection>
          <SpecSection title="Hardware">
            <SpecRow label="Finish" value={windowSpec?.hardware.finish} />
            <SpecRow label="Security" value={windowSpec?.hardware.catches} />
            <SpecRow label="Trickle vent" value={`${buildVentGrilles(windowSpec)} · ${windowSpec?.vent?.roomType || 'habitable'}`} />
          </SpecSection>
          {derived && (
            <SpecSection title="Calculated">
              <SpecRow label="Sash W" value={`${derived.sashWidth} mm`} />
              <SpecRow label="Top H" value={`${derived.topSashHeight} mm`} />
              <SpecRow label="Bot H" value={`${derived.bottomSashHeight} mm`} />
            </SpecSection>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Glass Panel — same source as Production Pack ───
function GlassPanel({ item, windowSpec, derived, batch, settings }) {
  const glassList = useMemo(
    () => (derived && windowSpec ? buildGlassListForWindow(derived, windowSpec) : []),
    [derived, windowSpec]
  );

  const handleExport = () => {
    if (!derived || !windowSpec) return;
    const company = settings?.company || {};
    const projects = batch ? [{ number: batch.projectNumber || '', name: batch.projectName || '', id: batch.id }] : [];
    exportGlassPDF({
      batch,
      windowsData: [{ win: { ...item, _projectNumber: batch?.projectNumber || '' }, windowSpec, derived }],
      projects,
      companySettings: company,
    });
  };

  if (!glassList.length) {
    return <div className="card p-8 text-center text-ink-400">No glass data.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Glass schedule table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-ink-50">Glass Schedule</div>
          <button onClick={handleExport} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
            📄 Export PDF
          </button>
        </div>
        <div className="bg-surface-600 rounded-lg border border-surface-500 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500">
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Pane</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Qty</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Type</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Makeup</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Coating</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Gas</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Finish</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Spacer</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Spacer Type</th>
              </tr>
            </thead>
            <tbody>
              {glassList.map((g, i) => (
                <tr key={i} className="border-b border-surface-500/50">
                  <td className="px-4 py-2 text-ink-100">{g.label}</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{g.width} mm</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{g.height} mm</td>
                  <td className="px-4 py-2 text-right text-ink-200">{g.quantity}</td>
                  <td className="px-4 py-2 text-ink-300">{g.type} / {g.spec}</td>
                  <td className="px-4 py-2 text-ink-300">{g.makeup || '—'}</td>
                  <td className="px-4 py-2 text-ink-300">{g.coating === 'soft_coat' ? 'Soft Coat (Low-E)' : 'Standard'}</td>
                  <td className="px-4 py-2 text-ink-300">{g.gas ? 'Argon' : '—'}</td>
                  <td className="px-4 py-2 text-ink-300">{g.finish}</td>
                  <td className="px-4 py-2 text-ink-300">{g.spacer}</td>
                  <td className="px-4 py-2 text-ink-300">{g.spacerType === 'alu' ? 'Aluminium' : 'Warm Edge'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Glass drawings — upper + lower */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs font-semibold text-ink-200 mb-2">Upper Glass</div>
          <GlassDrawing2D windowSpec={windowSpec} derived={derived} type="upper" />
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-ink-200 mb-2">Lower Glass</div>
          <GlassDrawing2D windowSpec={windowSpec} derived={derived} type="lower" />
        </div>
      </div>
    </div>
  );
}

// ─── BOM Panel — Purchase list matching Project Materials layout ───
function BOMPanel({ item, windowSpec, settings, derived, batch }) {
  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const ironmongeryItems = useIronmongeryStore((s) => s.items);
  const [zoomSrc, setZoomSrc] = useState(null);

  // Build qty map per part — shared single source (bom.js)
  const partQtys = useMemo(
    () => buildWindowPartQtys(derived, windowSpec, settings),
    [derived, windowSpec, settings]
  );

  // Group by material (same structure as Project Materials)
  const bomGroups = useMemo(() => {
    const matMap = {};
    const unassigned = { material: null, parts: [], total: 0, unit: 'm' };

    ALL_PARTS.forEach((part) => {
      const entry = partQtys[part.id];
      if (!entry) return;

      const assignment = assignments[part.id];
      const yieldCoeff = assignment?.yield || 1.0;
      const { total, unit } = resolvePartTotal(entry, yieldCoeff);
      const pcsTotal = part.pcs;
      const partData = { ...part, pcsTotal, total, unit, yield: yieldCoeff };

      if (assignment?.material_id) {
        const matId = assignment.material_id;
        const mat = materials.find((m) => m.id === matId);
        if (mat) {
          if (!matMap[matId]) matMap[matId] = { material: mat, parts: [], total: 0, unit };
          matMap[matId].parts.push(partData);
          matMap[matId].total += total;
          matMap[matId].unit = unit;
          return;
        }
      }
      unassigned.parts.push(partData);
      unassigned.total += total;
      unassigned.unit = unit;
    });

    const groups = Object.values(matMap);
    if (unassigned.parts.length > 0) groups.push(unassigned);
    return groups;
  }, [partQtys, assignments, materials]);

  // Ironmongery (hardware) as card-A groups — shared single source (bom.js)
  const hardwareGroups = useMemo(
    () => buildWindowHardware(windowSpec, batch, ironmongeryItems),
    [windowSpec, batch, ironmongeryItems]
  );

  // Total material + ironmongery for this one window — same source as Project
  // Materials / BOM export (mergeWindowMaterials), so figures match everywhere.
  const bomRows = useMemo(() => {
    if (!derived || !windowSpec) return [];
    return mergeWindowMaterials(
      [{ derived, windowSpec, batch }],
      { assignments, materials, ALL_PARTS, ironmongeryItems, settings }
    );
  }, [derived, windowSpec, batch, assignments, materials, ironmongeryItems, settings]);

  const windowCost = useMemo(
    () => bomRows.reduce((s, r) => s + (r.costPerUnit > 0 ? r.qty * r.costPerUnit : 0), 0),
    [bomRows]
  );

  const handleExport = () => {
    if (!bomRows.length) return;
    const company = settings?.company || {};
    exportBomPDF({
      title: item?.name || item?.window_number || 'Window',
      projects: batch?.projectNumber ? [batch.projectNumber] : [],
      date: new Date().toLocaleDateString('en-GB'),
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      subtitle: 'BILL OF MATERIALS — WINDOW',
      scopeLabel: 'Window',
      rows: bomRows.map((r) => ({
        name: r.name,
        itemNumber: r.material?.item_number || r.product?.item_number || '',
        qty: formatQty(r.qty, r.unit),
        unitCost: r.costPerUnit > 0 ? `£${r.costPerUnit.toFixed(2)}` : '—',
        estCost: r.costPerUnit > 0 ? `£${(r.qty * r.costPerUnit).toFixed(2)}` : '—',
        ironmongery: r.source === 'ironmongery',
        assigned: r._assigned,
      })),
      total: `£${windowCost.toFixed(2)}`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-50">Bill of Materials</div>
        <button onClick={handleExport} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
          📄 Export PDF
        </button>
      </div>
      {/* Material groups — identical to Project Materials */}
      {bomGroups.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">📋</div>
          <div className="text-sm text-ink-300">No material data available.</div>
        </div>
      ) : (
        bomGroups.map((group, gi) => (
          <div key={gi} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {group.material?.image_url ? (
                  <img src={group.material.image_url} alt=""
                    onClick={() => setZoomSrc(group.material.image_url)}
                    className="w-10 h-10 rounded object-cover border border-surface-500 cursor-zoom-in hover:opacity-80 transition-opacity" />
                ) : (
                  <div className="w-10 h-10 rounded bg-surface-600 border border-surface-500 grid place-items-center text-ink-500 text-xs">
                    {group.material ? '—' : '?'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-ink-50">
                    {group.material ? group.material.name : 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-ink-400 flex items-center gap-2">
                    {group.material ? (
                      <>
                        <span>{group.material.item_number}</span>
                        <span>{group.material.size || '—'}</span>
                        {group.material.cost_per_unit > 0 && <span>£{Number(group.material.cost_per_unit).toFixed(2)}/{group.material.unit}</span>}
                        {group.material.jc_uuid && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>}
                      </>
                    ) : (
                      <span>Go to Materials → Assignments to assign</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-ink-100">{formatQty(group.total, group.unit)}</div>
                <div className="text-[10px] text-ink-400">total</div>
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-500/50">
                  <th className="py-1.5 text-left text-ink-400 font-medium">Part</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Section</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Pcs</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Yield</th>
                  <th className="py-1.5 text-right text-ink-400 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {group.parts.map((gp, pi) => (
                  <tr key={pi} className="border-b border-surface-500/30">
                    <td className="py-1.5 text-ink-200">{gp.name}</td>
                    <td className="py-1.5 text-center text-ink-300 font-mono">{gp.section}</td>
                    <td className="py-1.5 text-center text-ink-300">{gp.pcsTotal}</td>
                    <td className="py-1.5 text-center text-ink-300">{gp.yield}</td>
                    <td className="py-1.5 text-right text-ink-100 font-mono font-medium">{formatQty(gp.total, gp.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Glass now renders as a material card above (block A style); dimensions live in the Glass tab */}

      {/* Consumables, Paint, Weights now render as material cards above (block A style) */}

      {/* Ironmongery — same card layout as block A; product from batch slots, qty from rules */}
      {hardwareGroups.length === 0 ? (
        <div className="card p-4 text-xs text-ink-500 italic">Fixed window — no hardware</div>
      ) : (
        hardwareGroups.map((g, gi) => (
          <div key={gi} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {g.product?.image_url ? (
                  <img src={g.product.image_url} alt=""
                    onClick={() => setZoomSrc(g.product.image_url)}
                    className="w-10 h-10 rounded object-cover border border-surface-500 cursor-zoom-in hover:opacity-80 transition-opacity" />
                ) : (
                  <div className="w-10 h-10 rounded bg-surface-600 border border-surface-500 grid place-items-center text-ink-500 text-xs">
                    {g.product ? '—' : '?'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-ink-50">
                    {g.product ? g.product.name : 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-ink-400 flex items-center gap-2">
                    {g.product ? (
                      <>
                        <span>{g.product.item_number}</span>
                        {g.product.finish && <span>{g.product.finish}</span>}
                        {g.product.cost_per_unit > 0 && <span>£{Number(g.product.cost_per_unit).toFixed(2)}/{g.product.unit || 'pcs'}</span>}
                        {g.product.jc_uuid && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>}
                      </>
                    ) : (
                      <span>{g.line.item} — unassigned</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-ink-100">{g.line.quantity} pcs</div>
                <div className="text-[10px] text-ink-400">{g.line.item}</div>
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-500/50">
                  <th className="py-1.5 text-left text-ink-400 font-medium">Type</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Detail</th>
                  <th className="py-1.5 text-right text-ink-400 font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-500/30">
                  <td className="py-1.5 text-ink-200">{g.line.item}</td>
                  <td className="py-1.5 text-center text-ink-300">{g.line.detail}</td>
                  <td className="py-1.5 text-right text-ink-100 font-mono font-medium">{g.line.quantity} pcs</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Paint & Weights now render as material cards above (block A style) */}

      {/* Total material + ironmongery cost for this window */}
      <div className="card p-4 flex items-center justify-between border border-accent-500/20">
        <div>
          <div className="text-sm font-semibold text-ink-50">Material cost per window</div>
          <div className="text-[10px] text-ink-400">Estimate · assigned items only · yield applied</div>
        </div>
        <div className="text-lg font-bold text-accent-400 font-mono">£{windowCost.toFixed(2)}</div>
      </div>

      {zoomSrc && <ImageLightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  );
}

// ─── Spec Panel Components ───
function SpecSection({ title, children }) {
  return <div><div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">{title}</div><div className="space-y-1">{children}</div></div>;
}
function SpecRow({ label, value }) {
  if (value == null || value === '') return null;
  return <div className="flex justify-between gap-2"><span className="text-ink-400 text-xs">{label}</span><span className="text-ink-100 text-xs font-medium">{String(value)}</span></div>;
}
function ColourRow({ label, hex }) {
  if (!hex) return null;
  return <div className="flex justify-between items-center gap-2"><span className="text-ink-400 text-xs">{label}</span><div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border border-surface-400" style={{ backgroundColor: hex }} /><span className="text-ink-200 text-xs font-mono">{hex}</span></div></div>;
}
