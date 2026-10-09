import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { svgNodeToPng } from '../utils/svgRaster.js';
import { exportElementsPDF } from '../utils/drawingsPdfExport.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { useIronmongeryStore } from '../stores/ironmongeryStore.js';
import { SASH_PROPORTION_LABELS, COTTAGE_MIN_FRAME_HEIGHT, isCottageProportion } from '../engine/specification.js';
import { deriveWindowData, sashBarPattern } from '../engine/calculations.js';
import { deriveWindowBounded } from '../utils/windowBoundary.js';
import { withProfiles, getCasementProfile, bsuiteActiveTarget } from '../engine/profile.js';
import { buildGlassListForWindow, buildVentGrilles } from '../engine/lists.js';
import { formatQty, buildWindowMaterialLines, windowBomCards, windowHardwareDetailRows } from '../engine/bom.js';
import { liveSectionsFor } from '../engine/partRegistry.js';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import ImageLightbox from '../components/ImageLightbox.jsx';
import DrawingsPanel from '../components/drawings/DrawingsPanel.jsx';
import GlassDrawing2D from '../components/drawings/GlassDrawing2D.jsx';
import CasementGlassDrawing2D from '../components/drawings/CasementGlassDrawing2D.jsx';
import { groupCasementGlass } from '../components/drawings/casementDrawUtils.js';
import DoorGlassDrawing2D from '../components/drawings/DoorGlassDrawing2D.jsx';
import { groupDoorGlass } from '../components/drawings/doorDrawUtils.js';
import CutListPanel from '../components/dashboard/CutListPanel.jsx';
import PreCutPanel from '../components/dashboard/PreCutPanel.jsx';
import ThreeDPanel from '../components/dashboard/ThreeDPanel.jsx';
import ExportControls from '../components/export/ExportControls.jsx';
import { exportGlassPDF } from '../utils/glassPdfExport.js';
import { exportGlassDxfForWindow, glassDxfParamsForWindow } from '../utils/glassDxfExport.js';
import { exportBomPDF } from '../utils/bomPdfExport.js';
import { exportCncJambsForWindow, canExportCncJambs, exportArchDxfForWindow, archParamsForWindow, traceryParamsForWindow, exportTraceryDxfForWindow } from '../utils/cncExport.js';
import { exportBsuiteFramesMerged } from '../utils/bsuiteExport.js';
import { downloadBsuiteProgram } from '../services/bsuitePrograms.js';


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

  // The window normalised and derived inside its own boundary (owner box item 19):
  // an unknown sash proportion or bar pattern, or an arch the engine refuses,
  // shows its message on this page instead of a blank one.
  const bounded = useMemo(() => (item
    ? deriveWindowBounded(item, (ws) => withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, currentBatch?.defaults?._profileSnapshot?.door, () => deriveWindowData(ws, settings)))
    : null), [item, settings, currentBatch]);
  const windowSpec = bounded?.windowSpec || null;
  const derived = bounded?.derived || null;
  const windowError = bounded?.error || null;
  // Arched casement CNC export — planned under the batch's profile snapshot,
  // exactly like `derived` above; `skip` doubles as the button tooltip.
  const archExport = useMemo(() => {
    if (!windowSpec) return { skip: 'no data' };
    return withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, currentBatch?.defaults?._profileSnapshot?.door, () => archParamsForWindow(windowSpec, item?.name));
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

  if (windowError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
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
        <div className="card p-6 border border-red-500/40" data-window-error={item.id}>
          <div className="text-sm font-semibold text-red-400">This window cannot be calculated</div>
          <p className="text-sm text-ink-100 mt-2">{windowError.message}</p>
          <p className="text-xs text-ink-400 mt-2">Correct it in the configurator (Edit Configuration). The production pack and the project materials leave this window out until then; every other window is unaffected.</p>
        </div>
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
          {/* cottage below the configurator's minimum frame height: it still derives (it is not wrong), but say so */}
          {(windowSpec?.category || 'sash') === 'sash' && isCottageProportion(windowSpec?.sash?.proportion) && Number(windowSpec?.frame?.height) < COTTAGE_MIN_FRAME_HEIGHT && (
            <p className="text-xs text-amber-400 mt-1">
              {SASH_PROPORTION_LABELS[windowSpec.sash.proportion]} on a {windowSpec.frame.height} mm frame: below the {COTTAGE_MIN_FRAME_HEIGHT} mm minimum for cottage sashes. Check the proportions with the customer.
            </p>
          )}
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
                const r = withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, currentBatch?.defaults?._profileSnapshot?.door, () => exportArchDxfForWindow(windowSpec, item.name));
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
            const tr = withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, currentBatch?.defaults?._profileSnapshot?.door, () => traceryParamsForWindow(windowSpec, derived, item?.name));
            const cls = `btn text-sm bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 ${tr.skip ? 'opacity-40 cursor-not-allowed' : ''}`;
            const run = (fn, label) => {
              const r = withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, currentBatch?.defaults?._profileSnapshot?.door, () => fn(windowSpec, derived, item?.name));
              if (r.error) alert(`${label} unavailable: ${r.error}`);
              else if (r.warnings?.length) alert(`${label}: ${r.warnings.join('; ')}`);
            };
            return (<>
              <button onClick={() => run(exportTraceryDxfForWindow, 'Tracery DXF')} disabled={!!tr.skip}
                title={tr.skip ? `Tracery DXF unavailable: ${tr.skip}` : 'Tracery board DXF (arka layers: pane daylights, +2 rail, +10 limit, corner guides, section) for VCarve'}
                className={cls}>🪟 Tracery DXF</button>
            </>);
          })()}
          {(windowSpec?.category || 'sash') === 'casement' && (
            // 12.09: bSuite worklist for ONE window (Piotr: single window first, the pack is built from them)
            <button
              onClick={async () => {
                const r = await withProfiles(currentBatch?.defaults?._profileSnapshot?.sash, currentBatch?.defaults?._profileSnapshot?.casement, currentBatch?.defaults?._profileSnapshot?.door,
                  () => exportBsuiteFramesMerged([{ windowSpec, derived, name: item?.name }], item?.name || 'window', undefined, null, downloadBsuiteProgram));
                if (r.error) { alert(`bSuite frames unavailable: ${r.error}`); return; }
                const sk = r.skipped?.length ? `\nSkipped: ${r.skipped.map((x) => `${x.element} (${x.reason})`).join(', ')}` : '';
                alert(`${r.filename} for ${r.target}: ${r.rows} rows, ${r.pieces} pieces, ${r.embedded} programs embedded.${sk}`);
              }}
              title="bSolid worklist (.ewlist) for this window's frame: head, cill, jambs, mullions, transoms — Matt's FC_* programs with LPX = finished length"
              className="btn text-sm bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50"
            >
              🏭 bSuite frames → {bsuiteActiveTarget(getCasementProfile().bsuite).name}
            </button>
          )}
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
            <ThreeDPanel item={item} windowSpec={windowSpec} batch={currentBatch} editUrl={editUrl} derived={derived} />
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
            {/* a door: the door profile depth (93) from the engine, never the sash box default */}
            <SpecRow label="Depth" value={`${(derived?.category === 'door' && derived.door?.frameDepth) || windowSpec?.frame.depth || 164} mm`} />
          </SpecSection>
          {windowSpec?.category === 'door' ? (
            <SpecSection title="Door">
              <SpecRow label="Type" value={windowSpec.door?.type === 'french' ? 'French' : 'Single'} />
              <SpecRow label="Style" value={windowSpec.door?.style} />
              {windowSpec.door?.style !== 'full-glass' && <SpecRow label="Panel" value={windowSpec.door?.paneling} />}
              {/* doors v3: the handing as the configurator states it (Hinge left / right seen from inside, opens outward / inward) */}
              <SpecRow label="Opening" value={derived?.door?.handing?.label || `Hinge ${windowSpec.door?.hingeSide} · opens ${windowSpec.door?.openDirection}`} />
              <SpecRow label="Lock" value={windowSpec.door?.type === 'french' ? (windowSpec.door?.lockType === 'double' ? 'two handles' : 'one handle') : 'single door kit'} />
              {/* doors v3: the threshold the engine builds (an inward door always takes the timber cill; aluminium / low profile + the threshold seal) */}
              <SpecRow label="Threshold" value={`${derived?.door?.thresholdInfo
                ? [{ standard: 'timber cill', aluminium: 'aluminium', 'low-profile': 'low profile' }[derived.door.thresholdInfo.effectiveType] || derived.door.thresholdInfo.effectiveType,
                  derived.door.thresholdInfo.seal ? `threshold seal ${derived.door.thresholdInfo.seal.metres} m` : '',
                  derived.door.thresholdInfo.ignored ? derived.door.thresholdInfo.note : ''].filter(Boolean).join(' · ')
                : windowSpec.door?.threshold}${windowSpec.door?.thresholdExtension ? ` · ext ${windowSpec.door.thresholdExtension}` : ''}`} />
              <SpecRow label="Bars" value={`${windowSpec.door?.bars?.h || 0}H × ${windowSpec.door?.bars?.v || 0}V · ${windowSpec.door?.barType}`} />
              {windowSpec.door?.sidePanels?.mode !== 'none' && <SpecRow label="Side panels" value={windowSpec.door?.sidePanels?.mode} />}
              {windowSpec.door?.transom?.type !== 'none' && <SpecRow label="Fanlight" value={`${windowSpec.door?.transom?.type} · ${windowSpec.door?.transom?.height}`} />}
            </SpecSection>
          ) : (
          <SpecSection title="Sashes & Bars">
            {(windowSpec?.category || 'sash') === 'sash' && <SpecRow label="Proportions" value={SASH_PROPORTION_LABELS[windowSpec?.sash?.proportion] || windowSpec?.sash?.proportion} />}
            <SpecRow label="Grid" value={windowSpec?.sash.grid.mode} />
            {/* bars per sash (Piotr 09.10.2026, owner box item 16): the pattern each sash is built with */}
            <SpecRow label="Upper" value={sashBarPattern(windowSpec, 'upper')} />
            {(!item.sameBars || sashBarPattern(windowSpec, 'upper') !== sashBarPattern(windowSpec, 'lower')) && <SpecRow label="Lower" value={sashBarPattern(windowSpec, 'lower')} />}
            <SpecRow label="Horns" value={windowSpec?.sash.hornType || 'none'} />
          </SpecSection>
          )}
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
          {derived && derived.category === 'door' && derived.door ? (
            <SpecSection title="Calculated">
              {derived.door.leaves.map((lf, i) => (
                <SpecRow key={i} label={derived.door.isFrench ? `Leaf ${lf.role}` : 'Leaf'} value={`${lf.w} × ${lf.h} mm`} />
              ))}
              {derived.door.isFrench && <SpecRow label="Half + lip" value={`${derived.door.half} + ${derived.door.lip} mm`} />}
              {derived.door.panelLeaves.map((pl, i) => (
                <SpecRow key={`p${i}`} label={`Side light ${pl.side}`} value={`${pl.w} × ${pl.h} mm · fixed`} />
              ))}
              {derived.door.fanLeaves.map((fl, i) => (
                <SpecRow key={`f${i}`} label={fl.fixed ? 'Fixed fan leaf' : 'Fan leaf'} value={`${fl.w} × ${fl.h} mm`} />
              ))}
              <SpecRow label="Assembly" value={`${derived.door.totalWidth} × ${derived.door.totalHeight} mm`} />
              <SpecRow label="Leaf depth" value={`${derived.door.leafDepth} mm`} />
              <SpecRow label="Handing" value={derived.door.handing?.label || derived.door.hardware?.handing || 'n/a'} />
              <SpecRow label="Weight" value={`${derived.weights?.total} kg`} />
            </SpecSection>
          ) : derived && (
            <SpecSection title="Calculated">
              <SpecRow label="Sash W" value={`${derived.sashWidth} mm`} />
              <SpecRow label="Top H" value={`${Math.round(derived.topSashHeight * 100) / 100} mm`} />
              <SpecRow label="Bot H" value={`${Math.round(derived.bottomSashHeight * 100) / 100} mm`} />
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
    if ((spec?.category || 'sash') === 'casement' || spec?.category === 'door') {
      // Single source: the engine row carries the label (barsV/barsH + type); doors too (08.10.2026).
      return g.bars || '—';
    }
    // sash rows carry their own sash's pattern (lists.js, 09.10.2026); this read
    // spec.upperBars, a field the normalised spec never has, so it printed a dash
    const pat = g.sash === 'upper' || g.sash === 'lower' ? g.bars : null;
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
      const groups = windowSpec?.category === 'door' ? groupDoorGlass(derived, windowSpec) : groupCasementGlass(derived, windowSpec);
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
            {/* Glazier DXF — every glass unit of the window, shaped and rectangular
                (night 7 stage 1: the glazier gets ONE file with all the glass).
                Same row and style as the PDF export; disabled with the reason on
                a window that carries no glass. */}
            {(['casement', 'sash'].includes(windowSpec?.category || 'sash') || windowSpec?.category === 'door') && (() => {
              const r = glassDxfParamsForWindow(windowSpec, derived, item?.name);
              return (
                <button
                  onClick={() => {
                    const res = exportGlassDxfForWindow(windowSpec, derived, item?.name);
                    if (res.error) alert(`Glass DXF unavailable: ${res.error}`);
                  }}
                  disabled={!!r.skip}
                  title={r.skip ? `Glass DXF unavailable: ${r.skip}` : `Glazier DXF: exact contour, edge cover and bar axes of every glass unit (${r.params.units.length})`}
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


      {/* Glass drawings: per sash (upper/lower), per unique casement unit, or per unique door unit */}
      {windowSpec?.category === 'door' ? (
        <div>
          <div className="flex items-center justify-end mb-2">
            <button onClick={handleExportGlassDrawings} disabled={glassBusy}
              className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              📐 Glass Drawings PDF
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groupDoorGlass(derived, windowSpec).map((gp) => (
            <div key={gp.key} className="card p-4" ref={(el) => { glassDrawRefs.current[gp.key] = el; }}>
              <div className="text-xs font-semibold text-ink-200 mb-2">
                Glass {gp.w} × {gp.h} · ×{gp.panes.length}
              </div>
              <DoorGlassDrawing2D windowSpec={windowSpec} derived={derived} group={gp} />
            </div>
          ))}
          </div>
        </div>
      ) : (windowSpec?.category || 'sash') === 'casement' ? (
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

  // ONE source for this tab — the window's material lines (bom.js). The cards,
  // the cost and the PDF below all come from them, and the purchase list of
  // the project / pack is the sum of the very same lines, so this window can
  // never show anything its purchase list does not (Piotr: single window
  // first, the list is the sum of single windows). No quantity is counted here.
  const bom = useMemo(() => {
    if (!derived || !windowSpec) return { rows: [], materials: [], unassigned: null, hardware: [] };
    return windowBomCards(buildWindowMaterialLines(
      { derived, windowSpec, batch },
      { assignments, assignmentsData, materials, ALL_PARTS, ironmongeryItems, settings },
    ));
  }, [derived, windowSpec, batch, assignments, assignmentsData, materials, ironmongeryItems, settings]);

  // Material cards (same structure as Project Materials) + one card of the
  // rows still to assign. Section: LIVE finished dims from the profile (per
  // this window's frame variant) — static list labels never show invented
  // material sizes. A custom consumable has no section and no pcs.
  const bomGroups = useMemo(() => {
    const frameType = windowSpec?.frame?.type || 'standard';
    const sashProfile = batch?.defaults?.sashProfile || useWindowProfileStore.getState().sash;
    const partData = (part) => ({
      ...part,
      section: part.custom ? '—' : (liveSectionsFor(part.id, sashProfile, frameType)?.section || part.section || '—'),
      pcsTotal: part.custom ? '—' : part.pcs,
      yield: part.yieldCoeff,
    });
    const groups = bom.materials.map((g) => ({ material: g.material, parts: g.parts.map(partData), total: g.total, unit: g.unit }));
    // No total on the unassigned card: its rows are metres, litres, pieces…
    if (bom.unassigned) groups.push({ material: null, parts: bom.unassigned.parts.map(partData) });
    return groups;
  }, [bom, windowSpec, batch]);

  // Ironmongery cards: the client-chosen products only (handles, vents, sash
  // furniture). Engine-picked casement hardware — hinges, locks, restrictors,
  // wedge packers — is an Assign Materials row and sits in the cards above.
  const hardwareGroups = bom.hardware;

  // Total material + ironmongery for this one window — the same rows as
  // Project Materials / BOM export, so figures match everywhere.
  const bomRows = bom.rows;

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
      hardware: windowHardwareDetailRows(windowSpec, batch, ironmongeryItems, derived),
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
                <div className="text-sm font-semibold text-ink-100">
                  {group.material ? formatQty(group.total, group.unit) : `${group.parts.length} ${group.parts.length === 1 ? 'part' : 'parts'}`}
                </div>
                <div className="text-[10px] text-ink-400">{group.material ? 'total' : 'to assign'}</div>
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
      {/* Doors (08.10.2026): the door hardware is engine-counted on the door Assign
          Materials rows (cards above); this card prints the detail the buyer
          selects on the supplier page (handing, kit variants, FGTE band, leaf weight). */}
      {windowSpec?.category === 'door' && (() => {
        const rows = windowHardwareDetailRows(windowSpec, batch, ironmongeryItems, derived);
        return rows.length > 0 && (
          <div className="card p-4">
            <div className="text-sm font-semibold text-ink-50 mb-1">Door hardware</div>
            <div className="text-[10px] text-ink-400 mb-3">Counted on the Assign Materials rows above · the detail to select on the supplier page</div>
            <table className="w-full text-xs">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-surface-500/30">
                    <td className="py-1.5 text-ink-200 pr-3">{r.item}</td>
                    <td className="py-1.5 text-ink-400">{r.detail}</td>
                    <td className="py-1.5 text-right text-ink-100 font-mono">{r.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
      {hardwareGroups.length === 0 ? (
        <div className="card p-4 text-xs text-ink-500 italic">{windowSpec?.category === 'door' ? 'No client-chosen products (the door hardware is counted above)' : 'Fixed window — no hardware'}</div>
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
