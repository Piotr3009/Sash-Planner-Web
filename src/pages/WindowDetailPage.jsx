import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { svgNodeToPng } from '../utils/svgRaster.js';
import { exportElementsPDF } from '../utils/drawingsPdfExport.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { useIronmongeryStore } from '../stores/ironmongeryStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import { withProfiles } from '../engine/profile.js';
import { buildGlassListForWindow, buildVentGrilles } from '../engine/lists.js';
import { effectiveAssignment, buildWindowPartQtys, buildWindowHardware, resolvePartTotal, formatQty, mergeWindowMaterials } from '../engine/bom.js';
import { liveSectionsFor } from '../engine/partRegistry.js';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import ImageLightbox from '../components/ImageLightbox.jsx';
import DrawingsPanel from '../components/drawings/DrawingsPanel.jsx';
import GlassDrawing2D from '../components/drawings/GlassDrawing2D.jsx';
import CasementGlassDrawing2D from '../components/drawings/CasementGlassDrawing2D.jsx';
import { groupCasementGlass } from '../components/drawings/casementDrawUtils.js';
import CutListPanel from '../components/dashboard/CutListPanel.jsx';
import PreCutPanel from '../components/dashboard/PreCutPanel.jsx';
import ThreeDPanel from '../components/dashboard/ThreeDPanel.jsx';
import ExportControls from '../components/export/ExportControls.jsx';
import { exportGlassPDF } from '../utils/glassPdfExport.js';
import { exportGlassDxfForWindow, glassDxfParamsForWindow } from '../utils/glassDxfExport.js';
import { exportBomPDF } from '../utils/bomPdfExport.js';
import { exportCncJambsForWindow, canExportCncJambs, exportArchDxfForWindow, archParamsForWindow, traceryParamsForWindow, exportTraceryDxfForWindow } from '../utils/cncExport.js';


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

  // Real project entity — exports print "064 (Wandsworth)", never a DB id
  // (Piotr 02.08). Batches do not carry project fields.
  const projectEntity = useMemo(() => projects.find((p) => p.id === projectId) || null, [projects, projectId]);
  const projectLabel = projectEntity
    ? `${projectEntity.project_number || ''}${projectEntity.name ? ` (${projectEntity.name})` : ''}`.trim()
    : '';

  const spec = useMemo(() => (item ? parseSpecification(item.specification) : null), [item]);
  const windowSpec = useMemo(() => (item ? normaliseToWindowSpec(item, spec) : null), [item, spec]);
  const derived = useMemo(() => {
    if (!windowSpec) return null;
    try { return withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, () => deriveWindowData(windowSpec, settings)); }
    catch (e) { console.warn('Calculation failed:', e); return null; }
  }, [windowSpec, settings]);
  // Arched casement CNC export — planned under the batch's profile snapshot,
  // exactly like `derived` above; `skip` doubles as the button tooltip.
  const archExport = useMemo(() => {
    if (!windowSpec) return { skip: 'no data' };
    return withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, () => archParamsForWindow(windowSpec, item?.name));
  }, [windowSpec, item?.name, currentBatch]);

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
        <div className="flex items-center gap-2">
          {(windowSpec?.category || 'sash') === 'sash' && (
            <button
              onClick={() => {
                const r = exportCncJambsForWindow(windowSpec, item.name);
                if (r.error) alert(`CNC export unavailable: ${r.error}`);
                else if (r.warning) alert(`CNC DXF exported — VERIFY: ${r.warning}`);
              }}
              disabled={!canExportCncJambs(windowSpec)}
              title={canExportCncJambs(windowSpec)
                ? 'Download the CNC jamb drawing (DXF for VCarve)'
                : 'No CNC variant for heritage frames'}
              className={`btn text-sm bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 ${!canExportCncJambs(windowSpec) ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              🛠 CNC Jamb DXF
            </button>
          )}
          {((windowSpec?.category || 'sash') === 'casement' || !!windowSpec?.arch?.shape) && (
            <button
              onClick={() => {
                const r = withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, () => exportArchDxfForWindow(windowSpec, item.name));
                if (r.error) alert(`Arch DXF unavailable: ${r.error}`);
              }}
              disabled={!!archExport.skip}
              title={archExport.skip
                ? `Arch DXF unavailable: ${archExport.skip}`
                : 'Download the arched head CNC drawing — frame head + leaf top (DXF for VCarve)'}
              className={`btn text-sm bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 ${archExport.skip ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              🛠 Arch DXF
            </button>
          )}
          {((windowSpec?.category || 'sash') === 'casement' || !!windowSpec?.arch?.shape) && (() => {
            // v3 0.4: tracery board (DXF for VCarve + LSP for AutoCAD) — only with a bar pattern in the arch
            const tr = withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, () => traceryParamsForWindow(windowSpec, derived, item?.name));
            const cls = `btn text-sm bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 ${tr.skip ? 'opacity-40 cursor-not-allowed' : ''}`;
            const run = (fn, label) => {
              const r = withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, () => fn(windowSpec, derived, item?.name));
              if (r.error) alert(`${label} unavailable: ${r.error}`);
              else if (r.warnings?.length) alert(`${label}: ${r.warnings.join('; ')}`);
            };
            return (<>
              <button onClick={() => run(exportTraceryDxfForWindow, 'Tracery DXF')} disabled={!!tr.skip}
                title={tr.skip ? `Tracery DXF unavailable: ${tr.skip}` : 'Tracery board DXF (arka layers: pane daylights, +2 rail, +10 limit, corner guides, section) for VCarve'}
                className={cls}>🪟 Tracery DXF</button>
            </>);
          })()}
          <Link to={editUrl} className="btn btn-primary text-sm">✏️ Edit Configuration</Link>
        </div>
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
            <DrawingsPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} projectLabel={projectLabel} />
          )}

          {tab === 'cutlist' && (
            <CutListPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} />
          )}

          {tab === 'precut' && (
            <PreCutPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} projectLabel={projectLabel} />
          )}

          {tab === 'glass' && (
            <GlassPanel item={item} windowSpec={windowSpec} derived={derived} batch={currentBatch} settings={settings} projectEntity={projectEntity} projectLabel={projectLabel} />
          )}

          {tab === 'bom' && (
            <BOMPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} batch={currentBatch} projectLabel={projectLabel} />
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
            {windowSpec?.color.type === 'dual' ? <>
              <ColourRow label="Exterior" hex={windowSpec?.color.outside} />
              <ColourRow label="Interior" hex={windowSpec?.color.inside} />
            </> : (
              <ColourRow label="Colour" hex={windowSpec?.color.single} />
            )}
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
function GlassPanel({ item, windowSpec, derived, batch, settings, projectEntity, projectLabel }) {
  const barsText = (spec, g) => {
    if ((spec?.category || 'sash') === 'casement') {
      // Single source: the engine row carries the label (barsV/barsH + type).
      return g.bars || '—';
    }
    const pat = g.sash === 'upper' ? (spec?.upperBars || spec?.bars?.upper)
      : g.sash === 'lower' ? (spec?.lowerBars || spec?.bars?.lower) : null;
    return pat && pat !== 'none' ? String(pat) : '—';
  };
  const rowArea = (g) =>
    ((Number(g.width) || 0) * (Number(g.height) || 0) * (Number(g.quantity) || 0)) / 1e6;

  const glassList = useMemo(
    () => (derived && windowSpec ? buildGlassListForWindow(derived, windowSpec) : []),
    [derived, windowSpec]
  );

  const handleExport = async () => {
    if (!derived || !windowSpec) return;
    const company = settings?.company || {};
    const projects = projectEntity
      ? [{ number: projectEntity.project_number || '', name: projectEntity.name || '', id: projectEntity.id }]
      : [];
    // Reference images are a PACK concept (per-pack checkbox selection,
    // Piotr 04.08) — the single-window glass PDF prints without them.
    exportGlassPDF({
      batch,
      windowsData: [{ win: { ...item, _projectNumber: projectEntity?.project_number || '' }, windowSpec, derived }],
      projects,
      companySettings: company,
    });
  };

  // Factory glass drawings (casement): capture each per-size drawing card and
  // ship them as a clean standalone PDF for the glass supplier — no costs, no
  // schedule, just the drawings (Piotr 02.08, PDF audit item 4).
  const glassDrawRefs = useRef({});
  const [glassBusy, setGlassBusy] = useState(false);
  const handleExportGlassDrawings = async () => {
    if (glassBusy || !derived) return;
    setGlassBusy(true);
    try {
      const groups = groupCasementGlass(derived, windowSpec);
      const drawings = [];
      for (const gp of groups) {
        const svg = glassDrawRefs.current[gp.key]?.querySelector('svg');
        const png = svg ? await svgNodeToPng(svg, { scale: 3, printMode: true }) : null;
        drawings.push({ image: png?.url || null, w: png?.w, h: png?.h, label: `Glass ${gp.w} × ${gp.h} · ×${gp.panes.length}` });
      }
      const company = settings?.company || {};
      exportElementsPDF({
        subtitle: 'GLASS DRAWINGS',
        cols: 2,
        title: item?.name || 'Window',
        projects: projectLabel ? [projectLabel] : [],
        date: new Date().toLocaleDateString('en-GB'),
        companyName: company.companyName || 'COMPANY NAME',
        companyAddress: company.companyAddress || '',
        logo: company.logo || '',
        windows: [{ no: 1, caption: `${item?.name || ''} — glass units`, drawings }],
      });
    } finally { setGlassBusy(false); }
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
          <div className="flex items-center gap-2">
            {/* Glazier DXF for shaped (arched) units — arched-casement-v2 C. Same
                row and style as the PDF export; disabled with the reason on
                windows without a shaped unit. */}
            {((windowSpec?.category || 'sash') === 'casement' || !!windowSpec?.arch?.shape) && (() => {
              const r = glassDxfParamsForWindow(windowSpec, derived, item?.name);
              return (
                <button
                  onClick={() => {
                    const res = exportGlassDxfForWindow(windowSpec, derived, item?.name);
                    if (res.error) alert(`Glass DXF unavailable: ${res.error}`);
                  }}
                  disabled={!!r.skip}
                  title={r.skip ? `Glass DXF unavailable: ${r.skip}` : 'Glazier DXF: exact contour + bar axes of every shaped unit'}
                  className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  📐 Glass DXF
                </button>
              );
            })()}
            <button onClick={handleExport} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
              📄 Export PDF
            </button>
          </div>
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
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Bars</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Area m²</th>
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
                  <td className="px-4 py-2 text-ink-300">{barsText(windowSpec, g)}</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{rowArea(g).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t border-surface-400/60 text-accent-300">
                <td className="px-4 py-2 font-medium" colSpan={3}>Total</td>
                <td className="px-4 py-2 text-right">{glassList.reduce((a, g) => a + (Number(g.quantity) || 0), 0)}</td>
                <td className="px-4 py-2" colSpan={7}></td>
                <td className="px-4 py-2 text-right font-mono font-medium">
                  {glassList.reduce((a, g) => a + rowArea(g), 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


      {/* Glass drawings — per sash (upper/lower) or per unique casement unit */}
      {(windowSpec?.category || 'sash') === 'casement' ? (
        <div>
          <div className="flex items-center justify-end mb-2">
            <button onClick={handleExportGlassDrawings} disabled={glassBusy}
              className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              📐 Glass Drawings PDF
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groupCasementGlass(derived, windowSpec).map((gp) => (
            <div key={gp.key} className="card p-4" ref={(el) => { glassDrawRefs.current[gp.key] = el; }}>
              <div className="text-xs font-semibold text-ink-200 mb-2">
                Glass {gp.w} × {gp.h} · ×{gp.panes.length}
              </div>
              <CasementGlassDrawing2D windowSpec={windowSpec} derived={derived} group={gp} />
            </div>
          ))}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ─── BOM Panel — Purchase list matching Project Materials layout ───
function BOMPanel({ item, windowSpec, settings, derived, batch, projectLabel }) {
  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const assignmentsData = useMaterialAssignmentStore((s) => s.data);
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

    const frameType = windowSpec?.frame?.type || 'standard';
    const sashProfile = batch?.defaults?.sashProfile || useWindowProfileStore.getState().sash;
    ALL_PARTS.forEach((part) => {
      const entry = partQtys[part.id];
      if (!entry) return;

      const assignment = effectiveAssignment(part.id, frameType, assignmentsData, assignments);
      const yieldCoeff = assignment?.yield || 1.0;
      const { total, unit } = resolvePartTotal(entry, yieldCoeff);
      const pcsTotal = part.pcs;
      // Section: LIVE finished dims from the profile (per this window's frame
      // variant) — static list labels never show invented material sizes.
      const live = liveSectionsFor(part.id, sashProfile, frameType);
      const partData = { ...part, section: live?.section || part.section || '—', pcsTotal, total, unit, yield: yieldCoeff };

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
  }, [partQtys, assignments, assignmentsData, materials, windowSpec, batch]);

  // Ironmongery (hardware) as card-A groups — shared single source (bom.js)
  const hardwareGroups = useMemo(
    () => buildWindowHardware(windowSpec, batch, ironmongeryItems, derived),
    [windowSpec, batch, ironmongeryItems, derived]
  );

  // Total material + ironmongery for this one window — same source as Project
  // Materials / BOM export (mergeWindowMaterials), so figures match everywhere.
  const bomRows = useMemo(() => {
    if (!derived || !windowSpec) return [];
    return mergeWindowMaterials(
      [{ derived, windowSpec, batch }],
      { assignments, assignmentsData, materials, ALL_PARTS, ironmongeryItems, settings }
    );
  }, [derived, windowSpec, batch, assignments, assignmentsData, materials, ironmongeryItems, settings]);

  const windowCost = useMemo(
    () => bomRows.reduce((s, r) => s + (r.costPerUnit > 0 ? r.qty * r.costPerUnit : 0), 0),
    [bomRows]
  );

  const handleExport = () => {
    if (!bomRows.length) return;
    const company = settings?.company || {};
    exportBomPDF({
      title: item?.name || item?.window_number || 'Window',
      projects: projectLabel ? [projectLabel] : [],
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
      // Engine hardware picks with hands/sizes/kit detail — the merged rows
      // above only carry summed quantities (PDF audit item 1).
      hardware: hardwareGroups.map(({ line, product }) => ({
        item: product?.name || line.item,
        detail: line.detail || '',
        qty: line.quantity,
        assigned: !!product,
      })),
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
