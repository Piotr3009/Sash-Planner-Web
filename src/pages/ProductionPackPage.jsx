/**
 * ProductionPackPage.jsx
 *
 * Full-screen batch-level merged view. 9 tabs:
 * Overview | 3D Views | 2D Elevations | 2D Sections | 2D Elements |
 * Glass Schedule | Pre-Cut List | Cut List | BOM
 *
 * Computes derived data for ALL windows in the batch and merges
 * cut lists, glass, hardware for the batch production view.
 */
import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore, BATCH_STATUSES } from '../stores/projectStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useIronmongeryStore } from '../stores/ironmongeryStore.js';
import { mergeWindowMaterials, formatQty } from '../engine/bom.js';
import { summarizeWindows } from '../utils/batchSummary.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import {
  buildCutListForWindow,
  buildGroupedCutList,
  buildPrecutForWindow,
  buildGlassListForWindow,
  buildHardwareList,
  buildVentGrilles,
} from '../engine/lists.js';
import { optimisePrecut } from '../engine/optimizer.js';
import { exportGlassPDF } from '../utils/glassPdfExport.js';
import { exportPreCutPDF } from '../utils/precutPdfExport.js';
import { exportSprayingPDF } from '../utils/sprayingPdfExport.js';
import { exportCutListPDF } from '../utils/cutListPdfExport.js';
import { exportOverviewPDF } from '../utils/overviewPdfExport.js';
import { exportThreeDPDF } from '../utils/threeDPdfExport.js';
import { exportBomPDF } from '../utils/bomPdfExport.js';
import { exportElevationsPDF, exportElementsPDF, exportSectionsPDF } from '../utils/drawingsPdfExport.js';
import { buildProductionBook } from '../utils/productionBookExport.js';
import { svgNodeToPng, loadImageSize } from '../utils/svgRaster.js';
import { getColorName } from '../config.js';
import { getPartSymbol } from '../engine/partSymbols.js';

import FrontElevation2D from '../components/drawings/FrontElevation2D.jsx';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import GlassDrawing2D from '../components/drawings/GlassDrawing2D.jsx';
import WindowPreview3D from '../components/viewer/WindowPreview3D.jsx';
import Window3DCaptureRig from '../components/viewer/Window3DCaptureRig.jsx';
import ImageLightbox from '../components/ImageLightbox.jsx';

// ─── Tab config ───
const TABS = [
  { id: 'overview',     label: 'Overview',        icon: '📋' },
  { id: '3d',           label: '3D Views',        icon: '🧊' },
  { id: 'elevations',   label: '2D Elevations',   icon: '📐' },
  { id: 'sections',     label: '2D Sections',     icon: '🔲' },
  { id: 'elements',     label: '2D Elements',     icon: '🪟' },
  { id: 'glass',        label: 'Glass Schedule',  icon: '💎' },
  { id: 'precut',       label: 'Pre-Cut List',    icon: '📏' },
  { id: 'cutlist',      label: 'Cut List',        icon: '🪚' },
  { id: 'spraying',     label: 'Spraying',        icon: '🎨' },
  { id: 'bom',          label: 'BOM',             icon: '📦' },
];

// Tabs that currently have a PDF export implemented
const EXPORTABLE_TABS = ['overview', '3d', 'elevations', 'sections', 'elements', 'glass', 'precut', 'cutlist', 'spraying', 'bom'];

/**
 * Build Cut List section bytes for the Production Book, independent of the
 * CutListTab component (which is only mounted when its tab is active).
 * Mirrors the grouping/sorting the tab uses (buildGroupedCutList).
 */
function buildCutListBookBytes({ merged, isPPMode, baseInfo }) {
  if (!merged?.cutList?.length) return null;
  const groups = buildGroupedCutList(merged.cutList).map((g) => ({
    symbol: g.symbol,
    element: g.label,
    mirror: g.mirror,
    section: g.section,
    rows: g.rows.map((r) => ({
      projectNum: r.projectNum, window: r.window, length: r.length, qty: r.qty,
    })),
  }));
  const totalPieces = merged.cutList.reduce((s, c) => s + (c.quantity || 1), 0);
  return exportCutListPDF({
    ...baseInfo, isPPMode, totalPieces, groups, format: 'a3', returnDoc: true,
  });
}

// ─── Status config ───
const STATUS_CONFIG = {
  preparation:    { label: 'Preparation',    color: '#F59E0B' },
  'in-production': { label: 'In production', color: '#3B82F6' },
  complete:       { label: 'Complete',       color: '#10B981' },
};

// ─── Main Component ───
export default function ProductionPackPage() {
  const { projectId, batchId, ppId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const productionPacks = useProjectStore((s) => s.productionPacks);
  const settings = useProjectStore((s) => s.settings);
  const updateProductionPack = useProjectStore((s) => s.updateProductionPack);
  const updateBatchLabel = useProjectStore((s) => s.updateBatchLabel);
  const [tab, setTab] = useState('overview');

  // Header export: each tab registers its export handler; the header button fires the active tab's.
  const [exportFormat, setExportFormat] = useState('a3');
  const [precutModalOpen, setPrecutModalOpen] = useState(false);
  const exportHandlersRef = useRef({});
  const registerExport = useCallback((id, fn) => { exportHandlersRef.current[id] = fn; }, []);
  const canExport = EXPORTABLE_TABS.includes(tab);
  // Pre-Cut export first asks what to print (graphics / list / both); other tabs run directly.
  const handleHeaderExport = () => {
    if (tab === 'precut') { setPrecutModalOpen(true); return; }
    exportHandlersRef.current[tab]?.();
  };
  const runPrecutExport = (content) => {
    setPrecutModalOpen(false);
    exportHandlersRef.current['precut']?.(content);
  };

  // Production Pack Book — combine sections into one A3 PDF (Etap 1: overview + cut list).
  const handleExportBook = async () => {
    const company = useProjectStore.getState().settings.company || {};
    const projs = [...new Set(windowsData.map(({ win }) => win._projectNumber).filter(Boolean))];
    const baseInfo = {
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      title: pp?.name || batch?.name || 'Pack',
      projects: projs,
      date: new Date().toLocaleDateString('en-GB'),
      rev: 'A',
    };

    // Overview section bytes
    const ovWindows = windowsData.map(({ win }) => ({
      projectNum: win._projectNumber, name: win.name, type: win.sashType || 'double',
      width: win.width, height: win.height, bars: win.upperBars || 'none',
      head: win.headType || 'flat', glass: win.glassFinish || 'clear', opening: win.openingType || 'both',
    }));
    const overviewBytes = exportOverviewPDF({ ...baseInfo, isPPMode, windows: ovWindows, returnDoc: true });

    // Cut List section bytes (reuse the same grouping the tab uses)
    const cutListBytes = buildCutListBookBytes({ merged, isPPMode, settings, baseInfo });

    await buildProductionBook({
      info: baseInfo,
      sections: [
        { name: 'Overview', bytes: overviewBytes },
        { name: 'Cut List', bytes: cutListBytes },
      ],
    });
  };
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // PP mode: cross-project merged windows
  const pp = useMemo(
    () => ppId ? productionPacks.find((p) => p.id === ppId) : null,
    [ppId, productionPacks]
  );

  // Legacy mode: single project + batch
  const project = useMemo(
    () => !ppId ? (useProjectStore.getState().projects || projects).find((p) => p.id === projectId) : null,
    [projectId, projects, ppId]
  );
  const batch = useMemo(
    () => project?.batches?.find((b) => b.id === batchId),
    [project, batchId]
  );

  // Resolve windows: PP mode = cross-project, legacy = single batch
  const sourceWindows = useMemo(() => {
    if (pp) {
      // PP mode: gather windows from all assigned batches
      const windows = [];
      (pp.assignments || []).forEach(({ projectId: pId, batchId: bId }) => {
        const proj = projects.find((p) => p.id === pId);
        const b = proj?.batches?.find((bt) => bt.id === bId);
        if (b?.windows) {
          windows.push(...b.windows.map((w) => ({
            ...w,
            _projectId: pId,
            _projectNumber: proj?.project_number || proj?.name || pId,
            _batchId: bId,
            _batch: b,
          })));
        }
      });
      return windows;
    }
    if (batch?.windows) {
      return batch.windows.map((w) => ({
        ...w,
        _projectId: projectId,
        _projectNumber: project?.project_number || project?.name || '',
        _batchId: batchId,
        _batch: batch,
      }));
    }
    return [];
  }, [pp, batch, projects, projectId, batchId, project]);

  // Compute per-window data
  const windowsData = useMemo(() => {
    if (!sourceWindows.length) return [];
    return sourceWindows.map((win) => {
      const spec = parseSpecification(win.specification);
      const windowSpec = normaliseToWindowSpec(win, spec);
      let derived = null;
      try {
        derived = deriveWindowData(windowSpec, settings);
      } catch (e) {
        console.warn(`Calc failed for ${win.name}:`, e);
      }
      return { win, spec, windowSpec, derived };
    });
  }, [sourceWindows, settings]);

  // Merged lists
  const merged = useMemo(() => {
    if (!windowsData.length) return null;

    const allCut = [];
    const allPrecut = { sashEngineering: [], boxSapele: [] };
    const allGlass = [];
    const allHardware = [];
    const allBeading = [];
    const allWeights = [];
    let totalPaint = { areaSqm: 0, primer: 0, topcoat: 0 };
    let totalConsumables = { glassSqm: 0, cordM: 0, clips: 0, spacer1mm: 0, spacer2mm: 0, beadTapeM: 0, siliconeTubes: 0, seal6070M: 0, seal6009M: 0 };
    let glassType = 'double';
    let clipSize = '24mm';

    windowsData.forEach(({ win, windowSpec, derived }) => {
      if (!derived || !windowSpec) return;
      // Cut list
      const cuts = buildCutListForWindow(derived, windowSpec);
      allCut.push(...cuts.map((r) => ({ ...r, windowName: win.name, _projectNumber: win._projectNumber })));

      // Precut
      const pre = buildPrecutForWindow(derived, windowSpec, settings);
      pre.sashEngineering.forEach((g) => {
        g.items.forEach((it) => { it.windowName = win.name; it._projectNumber = win._projectNumber; });
        const found = allPrecut.sashEngineering.find((x) => x.section === g.section);
        if (found) found.items.push(...g.items);
        else allPrecut.sashEngineering.push({ section: g.section, items: [...g.items] });
      });
      pre.boxSapele.forEach((g) => {
        g.items.forEach((it) => { it.windowName = win.name; it._projectNumber = win._projectNumber; });
        const found = allPrecut.boxSapele.find((x) => x.preCutWidth === g.preCutWidth);
        if (found) found.items.push(...g.items);
        else allPrecut.boxSapele.push({ preCutWidth: g.preCutWidth, items: [...g.items] });
      });

      // Glass
      const glass = buildGlassListForWindow(derived, windowSpec);
      allGlass.push(...glass.map((g) => ({ ...g, windowName: win.name, _projectNumber: win._projectNumber })));

      // Hardware
      const hw = buildHardwareList(windowSpec);
      allHardware.push(...hw.map((h) => ({ ...h, windowName: win.name, _projectNumber: win._projectNumber })));

      // Beading
      if (derived.components?.beading) {
        allBeading.push(...derived.components.beading.map((b) => ({ ...b, windowName: win.name, _projectNumber: win._projectNumber })));
      }

      // Weights
      if (derived.weights) {
        allWeights.push({ ...derived.weights, windowName: win.name, _projectNumber: win._projectNumber });
      }

      // Paint
      if (derived.paint) {
        totalPaint.areaSqm += derived.paint.areaSqm;
        totalPaint.primer += derived.paint.primer;
        totalPaint.topcoat += derived.paint.topcoat;
      }

      // Consumables
      if (derived.consumables) {
        const c = derived.consumables;
        totalConsumables.glassSqm += c.glass.sqm;
        totalConsumables.cordM += c.cord.meters;
        totalConsumables.clips += c.clips.qty;
        totalConsumables.spacer1mm += c.spacer1mm.qty;
        totalConsumables.spacer2mm += c.spacer2mm.qty;
        totalConsumables.beadTapeM += c.beadTape.meters;
        totalConsumables.siliconeTubes += c.silicone.tubes;
        totalConsumables.seal6070M += c.seal6070?.meters || 0;
        totalConsumables.seal6009M += c.seal6009?.meters || 0;
        glassType = c.glass.type;
        clipSize = c.clips.size;
      }
    });

    // Optimization
    let optimization = null;
    try {
      optimization = optimisePrecut(allPrecut, settings);
    } catch (e) {
      console.warn('Optimizer failed:', e);
    }

    return { cutList: allCut, precut: allPrecut, glass: allGlass, hardware: allHardware, beading: allBeading, weights: allWeights, paint: totalPaint, consumables: { ...totalConsumables, glassType, clipSize }, optimization };
  }, [windowsData, settings]);

  // ─── Render ───
  const isPPMode = !!pp;
  if (!isPPMode && (!project || !batch)) {
    return (
      <div className="min-h-full bg-surface-800 p-8">
        <div className="text-center text-ink-400">Batch not found.</div>
      </div>
    );
  }
  if (ppId && !pp) {
    return (
      <div className="min-h-full bg-surface-800 p-8">
        <div className="text-center text-ink-400">Production pack not found.</div>
      </div>
    );
  }

  const headerTitle = isPPMode
    ? pp.name
    : batch.label;
  const headerSub = isPPMode
    ? `${pp.type} · ${sourceWindows.length} windows · ${pp.assignments?.length || 0} batches · ${pp.status}`
    : `${project.name} · ${batch.windows?.length || 0} windows · ${batch.status}`;

  const handleNameSave = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setEditingName(false); return; }
    if (isPPMode) {
      updateProductionPack(pp.id, { name: trimmed });
    } else {
      updateBatchLabel(projectId, batchId, trimmed);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') setEditingName(false);
  };

  return (
    <div className="min-h-full bg-surface-800">
      {/* Header */}
      <header className="border-b border-surface-500 bg-surface-900 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-surface-700 hover:bg-surface-600 text-ink-300 hover:text-ink-50 flex items-center justify-center transition-colors shrink-0"
              title="Go back"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">Production Pack —</span>
                {editingName ? (
                  <input
                    className="text-xl font-bold text-ink-50 bg-surface-700 border border-surface-500 rounded-lg px-2 py-0.5 outline-none focus:border-accent-500"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={handleNameKeyDown}
                    autoFocus
                  />
                ) : (
                  <h1
                    className="text-xl font-bold text-ink-50 cursor-pointer hover:text-accent-400 transition-colors"
                    onClick={() => { setNameDraft(headerTitle); setEditingName(true); }}
                    title="Click to edit name"
                  >
                    {headerTitle}
                    <svg className="inline w-3.5 h-3.5 ml-1.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-xs text-ink-400">
                  {headerSub}
                </p>
                {isPPMode && (
                  <select
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border cursor-pointer outline-none"
                    style={{
                      background: `${STATUS_CONFIG[pp.status]?.color || '#F59E0B'}20`,
                      color: STATUS_CONFIG[pp.status]?.color || '#F59E0B',
                      borderColor: `${STATUS_CONFIG[pp.status]?.color || '#F59E0B'}40`,
                    }}
                    value={pp.status}
                    onChange={(e) => updateProductionPack(pp.id, { status: e.target.value })}
                  >
                    {BATCH_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                    ))}
                  </select>
                )}
                {isPPMode && (
                  <span className="flex items-center gap-1 text-[10px] text-ink-400">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      className="bg-transparent border-b border-surface-500 text-[10px] text-ink-200 outline-none focus:border-accent-500 w-24 placeholder:text-ink-400/50"
                      placeholder="Responsible"
                      value={pp.responsible || ''}
                      onChange={(e) => updateProductionPack(pp.id, { responsible: e.target.value })}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'precut' && (
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="text-[10px] bg-surface-700 border border-surface-500 rounded px-2 py-1 text-ink-200 outline-none"
              >
                <option value="a3">A3 Landscape</option>
                <option value="a4">A4 Landscape</option>
              </select>
            )}
            <button
              onClick={handleHeaderExport}
              disabled={!canExport}
              title={canExport ? 'Export this tab to PDF' : 'No PDF export for this tab yet'}
              className={`btn btn-primary text-xs px-4 ${!canExport ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              📄 Export PDF
            </button>
            <button
              onClick={handleExportBook}
              title="Export the full Production Pack as one A3 book (Overview + Cut List)"
              className="btn btn-secondary text-xs px-4"
            >
              📖 Export Book
            </button>
          </div>
        </div>
      </header>

      {/* Pre-Cut export — content choice modal */}
      {precutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPrecutModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-surface-500 bg-surface-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-600">
              <h3 className="text-sm font-semibold text-ink-50">Export Pre-Cut List</h3>
              <p className="text-xs text-ink-400 mt-0.5">Choose what to include in the PDF.</p>
            </div>
            <div className="p-4 space-y-2">
              <button type="button" onClick={() => runPrecutExport('both')}
                className="w-full text-left px-4 py-3 rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-accent-500 transition-colors">
                <div className="text-sm font-medium text-ink-50">Graphics + List</div>
                <div className="text-[11px] text-ink-400">Bar layout optimizer and the full element table.</div>
              </button>
              <button type="button" onClick={() => runPrecutExport('graphics')}
                className="w-full text-left px-4 py-3 rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-accent-500 transition-colors">
                <div className="text-sm font-medium text-ink-50">Graphics only</div>
                <div className="text-[11px] text-ink-400">Bar layout optimizer (cutting diagram) only.</div>
              </button>
              <button type="button" onClick={() => runPrecutExport('list')}
                className="w-full text-left px-4 py-3 rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-accent-500 transition-colors">
                <div className="text-sm font-medium text-ink-50">List only</div>
                <div className="text-[11px] text-ink-400">Element table only, no diagram.</div>
              </button>
            </div>
            <div className="px-4 py-3 border-t border-surface-600 flex justify-end">
              <button type="button" onClick={() => setPrecutModalOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg text-ink-300 hover:text-ink-100 hover:bg-surface-700 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="border-b border-surface-500 bg-surface-900/80 px-6 overflow-x-auto">
        <div className="max-w-[1400px] mx-auto flex gap-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                tab === t.id
                  ? 'border-accent-500 text-accent-400'
                  : 'border-transparent text-ink-400 hover:text-ink-200'
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto p-6">
        {tab === 'overview'   && <OverviewTab batch={batch} pp={pp} isPPMode={isPPMode} windowsData={windowsData} registerExport={registerExport} />}
        {tab === '3d'         && <ThreeDTab windowsData={windowsData} pp={pp} batch={batch} registerExport={registerExport} />}
        {tab === 'elevations' && <ElevationsTab windowsData={windowsData} pp={pp} batch={batch} registerExport={registerExport} />}
        {tab === 'sections'   && <SectionsTab windowsData={windowsData} pp={pp} batch={batch} registerExport={registerExport} />}
        {tab === 'elements'   && <ElementsTab windowsData={windowsData} pp={pp} batch={batch} registerExport={registerExport} />}
        {tab === 'glass'      && <GlassTab merged={merged} windowsData={windowsData} isPPMode={isPPMode} batch={batch} pp={pp} registerExport={registerExport} />}
        {tab === 'precut'     && <PreCutTab merged={merged} settings={settings} batch={batch} pp={pp} isPPMode={isPPMode} projects={projects} registerExport={registerExport} exportFormat={exportFormat} />}
        {tab === 'cutlist'    && <CutListTab merged={merged} isPPMode={isPPMode} pp={pp} batch={batch} registerExport={registerExport} exportFormat={exportFormat} />}
        {tab === 'spraying'   && <SprayingTab windowsData={windowsData} batch={batch} pp={pp} registerExport={registerExport} />}
        {tab === 'bom'        && <BOMTab merged={merged} batch={batch} pp={pp} isPPMode={isPPMode} windowsData={windowsData} registerExport={registerExport} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Overview
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ batch, pp, isPPMode, windowsData, registerExport }) {
  const handleExport = () => {
    const company = useProjectStore.getState().settings.company || {};
    const projects = [...new Set(windowsData.map(({ win }) => win._projectNumber).filter(Boolean))];
    const windows = windowsData.map(({ win }) => ({
      projectNum: win._projectNumber, name: win.name, type: win.sashType || 'double',
      width: win.width, height: win.height, bars: win.upperBars || 'none',
      head: win.headType || 'flat', glass: win.glassFinish || 'clear', opening: win.openingType || 'both',
    }));
    exportOverviewPDF({
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      title: pp?.name || batch?.name || 'Pack',
      projects, date: new Date().toLocaleDateString('en-GB'),
      isPPMode, windows,
    });
  };
  registerExport('overview', handleExport);

  return (
    <div className="space-y-4">
      {/* Batch/PP info summary */}
      {!isPPMode && batch && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-ink-50 mb-3">Batch Specification</div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-400">
            <span>Type: <strong className="text-ink-100">{batch.type}</strong></span>
            {(batch.windows?.length || 0) > 0 ? (
              summarizeWindows(batch.windows, batch.type).map((row) => (
                <span key={row.label}>{row.label}: <strong className="text-ink-100">{row.text}</strong></span>
              ))
            ) : (
              <span className="italic">No windows in this batch yet.</span>
            )}
          </div>
        </div>
      )}
      {isPPMode && pp && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-ink-50 mb-3">Production Pack Info</div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-400">
            <span>Type: <strong className="text-ink-100">{pp.type}</strong></span>
            <span>Status: <strong className="text-ink-100">{pp.status}</strong></span>
            {pp.deadline && <span>Deadline: <strong className="text-ink-100">{new Date(pp.deadline).toLocaleDateString('en-GB')}</strong></span>}
            <span>Batches: <strong className="text-ink-100">{pp.assignments?.length || 0}</strong></span>
            <span>Windows: <strong className="text-ink-100">{windowsData.length}</strong></span>
          </div>
        </div>
      )}

      {/* Windows table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500">
          <div className="text-sm font-semibold text-ink-50">Windows ({windowsData.length})</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/50">
                {isPPMode && <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Project</th>}
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Name</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Bars</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Head</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Glass</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Opening</th>
                <th className="px-4 py-2.5 text-center text-ink-400 font-medium">Vent</th>
                <th className="px-4 py-2.5 text-center text-ink-400 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {windowsData.map(({ win, windowSpec }) => (
                <tr key={win.id} className="border-b border-surface-500/50 hover:bg-surface-700/30">
                  {isPPMode && <td className="px-4 py-2.5 text-accent-400 font-medium">{win._projectNumber}</td>}
                  <td className="px-4 py-2.5 text-ink-100 font-medium">{win.name}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.sashType || 'double'}</td>
                  <td className="px-4 py-2.5 text-right text-ink-200">{win.width} mm</td>
                  <td className="px-4 py-2.5 text-right text-ink-200">{win.height} mm</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.upperBars || 'none'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.headType || 'flat'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.glassFinish || 'clear'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.openingType || 'both'}</td>
                  <td className="px-4 py-2.5 text-center text-ink-200">{buildVentGrilles(windowSpec)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Link to={`/projects/${win._projectId}/batches/${win._batchId || win.batch_id}/windows/${win.id}`}
                      className="text-accent-400 hover:text-accent-300 transition-colors">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 3D Views
// ═══════════════════════════════════════════════════════════════
function ThreeDTab({ windowsData, pp, batch, registerExport }) {
  const [capturing, setCapturing] = useState(false);

  // Stable list for the capture rig (id + spec), aligned to windowsData order.
  const captureList = useMemo(
    () => windowsData.map((d) => ({ id: d.win.id, windowSpec: d.windowSpec })),
    [windowsData]
  );

  // Header "Export PDF" triggers an off-screen, fixed-angle capture run.
  const handleExport = useCallback(() => {
    if (capturing || !captureList.length) return;
    setCapturing(true);
  }, [capturing, captureList]);
  registerExport && registerExport('3d', handleExport);

  // When all windows are captured: build the PDF, then unmount the rig.
  const handleComplete = useCallback((results) => {
    const byId = {};
    results.forEach((r) => { byId[r.id] = r.url; });
    const st = useProjectStore.getState();
    const company = st.settings.company || {};
    const items = windowsData.map((d, i) => ({
      image: byId[d.win.id] || null,
      no: i + 1,
      projectNum: d.win._projectNumber || '',
      name: d.win.name || '',
      dims: `${d.win.width}×${d.win.height} mm`,
    }));
    const projects = [...new Set(windowsData.map((d) => d.win._projectNumber).filter(Boolean))];
    setCapturing(false);
    exportThreeDPDF({
      title: pp?.name || batch?.name || 'Pack',
      projects,
      date: new Date().toLocaleDateString('en-GB'),
      deadline: pp?.deadline || '',
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      items,
    });
  }, [windowsData, pp, batch]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {windowsData.map(({ win, windowSpec }) => (
          <div key={win.id} className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-surface-500 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-50">
                {win._projectNumber ? `${win._projectNumber} · ` : ''}{win.name} — {win.width}×{win.height} mm
              </span>
              <Link to={`/projects/${win._projectId}/batches/${win._batchId || win.batch_id}/windows/${win.id}`}
                className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors">
                View Details →
              </Link>
            </div>
            <div className="aspect-[4/3] bg-gradient-to-br from-surface-600 to-surface-700">
              <WindowPreview3D windowSpec={windowSpec} side="exterior" />
            </div>
          </div>
        ))}
      </div>

      {capturing && (
        <>
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
            <div className="card px-6 py-4 text-sm text-ink-100">
              Generating 3D PDF…
            </div>
          </div>
          <Window3DCaptureRig windows={captureList} side="exterior" onComplete={handleComplete} />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 2D Elevations
// ═══════════════════════════════════════════════════════════════
function ElevationsTab({ windowsData, pp, batch, registerExport }) {
  const [busy, setBusy] = useState(false);
  const refs = useRef({});

  const handleExport = async () => {
    if (busy || !windowsData.length) return;
    setBusy(true);
    try {
      const items = [];
      let no = 0;
      for (const d of windowsData) {
        no += 1;
        const svg = refs.current[d.win.id]?.querySelector('svg');
        const png = svg ? await svgNodeToPng(svg, { scale: 3, printMode: true }) : null;
        items.push({
          image: png?.url || null, w: png?.w, h: png?.h,
          no, projectNum: d.win._projectNumber || '', name: d.win.name || '',
          dims: `${d.win.width}×${d.win.height} mm`,
        });
      }
      const company = useProjectStore.getState().settings.company || {};
      const projects = [...new Set(windowsData.map((d) => d.win._projectNumber).filter(Boolean))];
      exportElevationsPDF({
        title: pp?.name || batch?.name || 'Pack', projects,
        date: new Date().toLocaleDateString('en-GB'), deadline: pp?.deadline || '',
        companyName: company.companyName || 'COMPANY NAME', companyAddress: company.companyAddress || '',
        logo: company.logo || '', items,
      });
    } finally { setBusy(false); }
  };
  registerExport && registerExport('elevations', handleExport);

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {windowsData.map(({ win, windowSpec, derived }) => (
          <div key={win.id} className="card p-4">
            <div className="text-xs font-semibold text-ink-200 mb-2">
              {win._projectNumber ? `${win._projectNumber} · ` : ''}{win.name} — {win.width}×{win.height} mm
            </div>
            {derived ? (
              <div ref={(el) => { refs.current[win.id] = el; }}>
                <FrontElevation2D windowSpec={windowSpec} derived={derived} />
              </div>
            ) : (
              <div className="text-xs text-ink-400 py-8 text-center">Calculations not available for this window.</div>
            )}
          </div>
        ))}
      </div>
      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="card px-6 py-4 text-sm text-ink-100">Generating PDF…</div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 2D Sections — container-based image upload system
// ═══════════════════════════════════════════════════════════════
function SectionsTab({ windowsData, pp, batch, registerExport }) {
  const [sectionImages, setSectionImages] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem('pc-section-images') || '[]'); return Array.isArray(d) ? d : []; } catch { return []; }
  });
  const [zoomedImg, setZoomedImg] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const updated = [...sectionImages, { id: `sec-${Date.now()}`, src: dataUrl, label: file.name.replace(/\.[^.]+$/, '') }];
        setSectionImages(updated);
        localStorage.setItem('pc-section-images', JSON.stringify(updated));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveImage = (id) => {
    const updated = sectionImages.filter((s) => s.id !== id);
    setSectionImages(updated);
    localStorage.setItem('pc-section-images', JSON.stringify(updated));
  };

  const handleExport = async () => {
    if (!sectionImages.length) return;
    const items = [];
    let no = 0;
    for (const s of sectionImages) {
      no += 1;
      const size = await loadImageSize(s.src);
      items.push({ image: s.src, w: size?.w, h: size?.h, no, label: s.label || 'Section' });
    }
    const company = useProjectStore.getState().settings.company || {};
    const projects = [...new Set((windowsData || []).map((d) => d.win?._projectNumber).filter(Boolean))];
    exportSectionsPDF({
      title: pp?.name || batch?.name || 'Pack', projects,
      date: new Date().toLocaleDateString('en-GB'), deadline: pp?.deadline || '',
      companyName: company.companyName || 'COMPANY NAME', companyAddress: company.companyAddress || '',
      logo: company.logo || '', items,
    });
  };
  registerExport && registerExport('sections', handleExport);

  return (
    <div className="space-y-4">
      {/* Containers grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sectionImages.map((item) => (
          <div key={item.id} className="card overflow-hidden relative group">
            <div className="px-4 py-2 border-b border-surface-500 flex items-center justify-between bg-surface-800">
              <span className="text-xs font-medium text-ink-200 truncate">{item.label || 'Section'}</span>
              <button onClick={() => handleRemoveImage(item.id)}
                className="w-5 h-5 rounded flex items-center justify-center text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all text-xs">×</button>
            </div>
            <div className="p-3 flex items-center justify-center cursor-zoom-in" onClick={() => setZoomedImg(item.src)}>
              <img src={item.src} alt={item.label} className="max-w-full max-h-[400px] rounded" />
            </div>
          </div>
        ))}

        {/* Add container button */}
        <label className="card flex flex-col items-center justify-center py-12 cursor-pointer hover:border-accent-500/40 transition-all">
          <svg className="w-8 h-8 mb-2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-xs text-ink-400">Add section image</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
      </div>

      {sectionImages.length === 0 && (
        <div className="text-center text-[11px] text-ink-400 py-4">
          Upload section drawings or detail images. Each container holds one image with zoom capability.
        </div>
      )}

      {/* Zoom modal */}
      {zoomedImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} alt="Zoomed" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
          <button onClick={() => setZoomedImg(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-700 border border-surface-500 text-ink-300 hover:text-ink-50 flex items-center justify-center text-lg">×</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 2D Elements (per window: Box + Upper Sash + Lower Sash)
// ═══════════════════════════════════════════════════════════════
function ElementsTab({ windowsData, pp, batch, registerExport }) {
  const [expandedDrawing, setExpandedDrawing] = useState(null); // { windowSpec, derived, type: 'box'|'upper'|'lower', title }
  const [busy, setBusy] = useState(false);
  const refs = useRef({});

  const handleExport = async () => {
    if (busy || !windowsData.length) return;
    setBusy(true);
    try {
      const windows = [];
      let no = 0;
      for (const d of windowsData) {
        no += 1;
        const types = [['box', 'Box Detail'], ['upper', 'Upper Sash'], ['lower', 'Lower Sash']];
        const drawings = [];
        for (const [t, label] of types) {
          const svg = refs.current[`${d.win.id}-${t}`]?.querySelector('svg');
          const png = svg ? await svgNodeToPng(svg, { scale: 3, printMode: true }) : null;
          drawings.push({ image: png?.url || null, w: png?.w, h: png?.h, label });
        }
        windows.push({
          no,
          caption: `${d.win._projectNumber ? `${d.win._projectNumber} · ` : ''}${d.win.name} — ${d.win.width}×${d.win.height} mm`,
          drawings,
        });
      }
      const company = useProjectStore.getState().settings.company || {};
      const projects = [...new Set(windowsData.map((d) => d.win._projectNumber).filter(Boolean))];
      exportElementsPDF({
        title: pp?.name || batch?.name || 'Pack', projects,
        date: new Date().toLocaleDateString('en-GB'), deadline: pp?.deadline || '',
        companyName: company.companyName || 'COMPANY NAME', companyAddress: company.companyAddress || '',
        logo: company.logo || '', windows,
      });
    } finally { setBusy(false); }
  };
  registerExport && registerExport('elements', handleExport);

  return (
    <div className="space-y-8">
      {windowsData.map(({ win, windowSpec, derived }) => (
        <div key={win.id} className="space-y-4">
          <div className="flex items-center justify-between border-b border-surface-500 pb-2">
            <div className="text-sm font-bold text-ink-50">
              {win._projectNumber ? `${win._projectNumber} · ` : ''}{win.name} — {win.width}×{win.height} mm
            </div>
            <Link to={`/projects/${win._projectId}/batches/${win._batchId || win.batch_id}/windows/${win.id}`}
              className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors">
              View Details →
            </Link>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs font-semibold text-ink-200 mb-2">Box Detail</div>
              {derived ? (
                <div ref={(el) => { refs.current[`${win.id}-box`] = el; }}>
                  <BoxDetail2D windowSpec={windowSpec} derived={derived} projectNumber={win._projectNumber}
                    onExpand={() => setExpandedDrawing({ windowSpec, derived, type: 'box', title: `${win.name} — Box Detail`, projectNumber: win._projectNumber })} />
                </div>
              ) : (
                <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
              )}
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-ink-200 mb-2">Upper Sash</div>
              {derived ? (
                <div ref={(el) => { refs.current[`${win.id}-upper`] = el; }}>
                  <SashDetail2D windowSpec={windowSpec} derived={derived} type="upper" projectNumber={win._projectNumber}
                    onExpand={() => setExpandedDrawing({ windowSpec, derived, type: 'upper', title: `${win.name} — Upper Sash`, projectNumber: win._projectNumber })} />
                </div>
              ) : (
                <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
              )}
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-ink-200 mb-2">Lower Sash</div>
              {derived ? (
                <div ref={(el) => { refs.current[`${win.id}-lower`] = el; }}>
                  <SashDetail2D windowSpec={windowSpec} derived={derived} type="lower" projectNumber={win._projectNumber}
                    onExpand={() => setExpandedDrawing({ windowSpec, derived, type: 'lower', title: `${win.name} — Lower Sash`, projectNumber: win._projectNumber })} />
                </div>
              ) : (
                <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
              )}
            </div>
          </div>
        </div>
      ))}

      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="card px-6 py-4 text-sm text-ink-100">Generating PDF…</div>
        </div>
      )}

      {/* Full-screen expand modal */}
      {expandedDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setExpandedDrawing(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-ink-50">{expandedDrawing.title}</div>
              <button onClick={() => setExpandedDrawing(null)}
                className="w-8 h-8 rounded-full bg-surface-700 border border-surface-500 text-ink-300 hover:text-ink-50 flex items-center justify-center text-sm">×</button>
            </div>
            <div className="card p-6 overflow-auto flex-1">
              {expandedDrawing.type === 'box' && (
                <BoxDetail2D windowSpec={expandedDrawing.windowSpec} derived={expandedDrawing.derived} projectNumber={expandedDrawing.projectNumber} />
              )}
              {expandedDrawing.type === 'upper' && (
                <SashDetail2D windowSpec={expandedDrawing.windowSpec} derived={expandedDrawing.derived} type="upper" projectNumber={expandedDrawing.projectNumber} />
              )}
              {expandedDrawing.type === 'lower' && (
                <SashDetail2D windowSpec={expandedDrawing.windowSpec} derived={expandedDrawing.derived} type="lower" projectNumber={expandedDrawing.projectNumber} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Glass Schedule
// ═══════════════════════════════════════════════════════════════
function GlassTab({ merged, windowsData, isPPMode, batch, pp, registerExport }) {
  if (!merged?.glass?.length) {
    return <div className="card p-8 text-center text-ink-400">No glass data available.</div>;
  }

  // Group identical glass panes
  const grouped = groupGlassItems(merged.glass);

  const handleExportPDF = () => {
    const projects = isPPMode
      ? pp?.assignments?.map((a) => ({ number: a._projectNumber || '', name: '', id: a.projectId })) || []
      : batch ? [{ number: batch.projectNumber || '', name: batch.projectName || '', id: batch.id }] : [];

    exportGlassPDF({
      batch: batch || pp,
      windowsData,
      projects,
      companySettings: useProjectStore.getState().settings.company || {},
    });
  };
  registerExport('glass', handleExportPDF);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500 flex items-center justify-between">
          <div className="text-sm font-semibold text-ink-50">Glass Order — All Windows</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/50">
                {isPPMode && <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Projects</th>}
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Qty</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Type</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Makeup</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Spec</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Coating</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Gas</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Finish</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Spacer</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Spacer Type</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Windows</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g, i) => (
                <tr key={i} className="border-b border-surface-500/50">
                  {isPPMode && <td className="px-4 py-2.5 text-accent-400 text-[10px]">{g.projects.join(', ')}</td>}
                  <td className="px-4 py-2.5 text-ink-100 font-mono">{g.width} mm</td>
                  <td className="px-4 py-2.5 text-ink-100 font-mono">{g.height} mm</td>
                  <td className="px-4 py-2.5 text-right text-ink-100 font-semibold">{g.totalQty}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.type}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.makeup || '—'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.spec || '—'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.coating === 'soft_coat' ? 'Soft Coat (Low-E)' : 'Standard'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.gas ? 'Argon' : '—'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.finish}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.spacer}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.spacerType === 'alu' ? 'Aluminium' : 'Warm Edge'}</td>
                  <td className="px-4 py-2.5 text-ink-400">{g.windows.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Glass drawings per window — upper + lower */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {windowsData.flatMap(({ win, windowSpec, derived }) => [
          <div key={`${win.id}-upper`} className="card p-4">
            <div className="text-xs font-semibold text-ink-200 mb-2">
              {isPPMode && win._projectNumber ? `${win._projectNumber} · ` : ''}{win.name} — Upper Glass
            </div>
            {derived ? (
              <GlassDrawing2D windowSpec={windowSpec} derived={derived} type="upper" />
            ) : (
              <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
            )}
          </div>,
          <div key={`${win.id}-lower`} className="card p-4">
            <div className="text-xs font-semibold text-ink-200 mb-2">
              {isPPMode && win._projectNumber ? `${win._projectNumber} · ` : ''}{win.name} — Lower Glass
            </div>
            {derived ? (
              <GlassDrawing2D windowSpec={windowSpec} derived={derived} type="lower" />
            ) : (
              <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
            )}
          </div>,
        ])}
      </div>

      {/* Summary */}
      <div className="card p-4">
        <div className="text-xs text-ink-400">
          Total sealed units: <strong className="text-ink-100">{grouped.reduce((s, g) => s + g.totalQty, 0)}</strong> across{' '}
          <strong className="text-ink-100">{grouped.length}</strong> unique sizes
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Pre-Cut List — grouped by section, BLO with offcuts
// ═══════════════════════════════════════════════════════════════
function PreCutTab({ merged, settings, batch, pp, isPPMode, projects, registerExport, exportFormat }) {
  // Material assignment lookup
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const getMaterialById = useMaterialStore((s) => s.getMaterialById);

  // Resolve full material info for a group by checking assignments of its items
  const getMaterialForGroup = (items) => {
    for (const item of items) {
      const sym = getPartSymbol(item.elementName);
      if (sym?.partId) {
        const assignment = assignments[sym.partId];
        if (assignment?.material_id) {
          const mat = getMaterialById(assignment.material_id);
          if (mat) return mat;
        }
      }
    }
    return null;
  };

  // Editable stock lengths and offcuts per group — persisted to the active
  // container (production pack or batch) so they survive tab switches & reloads.
  const savedPrecut = isPPMode ? (pp?.precutSettings) : (batch?.defaults?.precutSettings);
  const [stockLengths, setStockLengths] = useState(savedPrecut?.stockLengths || {});
  const [offcutsMap, setOffcutsMap] = useState(savedPrecut?.offcuts || {}); // key → [length, ...]
  const [offcutInput, setOffcutInput] = useState({}); // key → current input string (not persisted)
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedTables, setExpandedTables] = useState({}); // inner element-table toggle (collapsed by default)

  // Persist stock/offcut changes back to the store (debounced via effect).
  const persistPrecut = useProjectStore((s) => s.setPrecutSettings);
  const didMountPrecut = useRef(false);
  useEffect(() => {
    // Skip the very first run (initial load) to avoid a redundant write.
    if (!didMountPrecut.current) { didMountPrecut.current = true; return; }
    const targetId = isPPMode ? pp?.id : batch?.id;
    if (!targetId) return;
    persistPrecut(targetId, isPPMode, { stockLengths, offcuts: offcutsMap });
  }, [stockLengths, offcutsMap]);

  if (!merged?.precut) {
    return <div className="card p-8 text-center text-ink-400">No pre-cut data available.</div>;
  }

  // Build unified groups: sash (by section) + box (by preCutWidth)
  const allGroups = [];

  (merged.precut.sashEngineering || []).forEach((g) => {
    allGroups.push({
      key: `sash-${g.section}`,
      label: `Engineering Wood — ${g.section}`,
      section: g.section,
      type: 'sash',
      items: g.items,
      defaultStock: settings?.stockLengthSash || 5900,
    });
  });

  (merged.precut.boxSapele || []).forEach((g) => {
    // Derive descriptive label from element names in group
    const names = g.items.map(i => (i.elementName || '').toUpperCase());
    const sec = g.items[0]?.section || `${g.preCutWidth}`;
    const secDisplay = sec.replace('x', ' x ');
    let boxLabel;
    if (names.some(n => n.includes('CILL NOSE') || n.includes('CILL_NOSE'))) {
      boxLabel = `Cill Nose — ${secDisplay}`;
    } else if (names.some(n => n === 'CILL')) {
      boxLabel = `Sill Timber — ${secDisplay}`;
    } else if (names.some(n => n.includes('LINER'))) {
      boxLabel = `Liner — ${secDisplay}`;
    } else {
      boxLabel = `Box — ${secDisplay}`;
    }
    allGroups.push({
      key: `box-${g.preCutWidth}`,
      label: boxLabel,
      section: `${g.preCutWidth}`,
      type: 'box',
      items: g.items,
      defaultStock: settings?.stockLengthBox || 3700,
    });
  });

  // Re-run optimizer with custom stock lengths + offcuts
  const localOptimization = useMemo(() => {
    const precutWithStock = {
      sashEngineering: (merged.precut.sashEngineering || []).map((g) => ({
        ...g,
        stockLength: stockLengths[`sash-${g.section}`] || settings?.stockLengthSash || 5900,
      })),
      boxSapele: (merged.precut.boxSapele || []).map((g) => ({
        ...g,
        stockLength: stockLengths[`box-${g.preCutWidth}`] || settings?.stockLengthBox || 3700,
      })),
    };
    try {
      return optimisePrecut(precutWithStock, settings, offcutsMap);
    } catch (e) {
      console.warn('Optimizer with offcuts failed:', e);
      return null;
    }
  }, [merged.precut, settings, stockLengths, offcutsMap]);

  const toggleExpand = (key) => setExpandedGroups((p) => ({ ...p, [key]: !p[key] }));
  const toggleTable = (key) => setExpandedTables((p) => ({ ...p, [key]: !p[key] }));

  // 3c: step stock length by ±100mm. Lower bound = longest required piece in group.
  const stepStock = (group, current, delta) => {
    const minStock = Math.max(...group.items.map((it) => it.length || 0), 0);
    const next = Math.max(minStock, (current || 0) + delta);
    setStockLengths((p) => ({ ...p, [group.key]: next }));
  };

  const handleAddOffcut = (groupKey) => {
    const val = parseFloat(offcutInput[groupKey]);
    if (!val || val <= 0) return;
    setOffcutsMap((p) => ({
      ...p,
      [groupKey]: [...(p[groupKey] || []), Math.round(val)],
    }));
    setOffcutInput((p) => ({ ...p, [groupKey]: '' }));
  };

  const handleRemoveOffcut = (groupKey, idx) => {
    setOffcutsMap((p) => ({
      ...p,
      [groupKey]: (p[groupKey] || []).filter((_, i) => i !== idx),
    }));
  };

  const getOptGroup = (group) => {
    if (!localOptimization) return null;
    if (group.type === 'sash') {
      return localOptimization.sashEngineering?.find((g) => g.section === group.section);
    }
    return localOptimization.boxSapele?.find((g) => String(g.preCutWidth) === group.section);
  };

  const handleExportPDF = (content = 'both') => {
    const exportGroups = allGroups.map((g) => ({
      ...g,
      stockLength: stockLengths[g.key] || g.defaultStock,
      materialInfo: getMaterialForGroup(g.items),
    }));
    const projList = isPPMode
      ? [...new Set((pp?.assignments || []).map((a) => {
          const proj = (projects || []).find((p) => p.id === a.projectId);
          return { number: proj?.project_number, name: proj?.name, id: a.projectId };
        }).filter(Boolean))]
      : [{ number: batch?.label, name: '' }];

    exportPreCutPDF({
      groups: exportGroups,
      optimization: localOptimization,
      settings,
      batch,
      pp,
      projects: projList,
      isPPMode,
      format: exportFormat,
      content,
    });
  };
  registerExport('precut', handleExportPDF);

  return (
    <div className="space-y-4">
      {allGroups.map((group) => {
        const optGroup = getOptGroup(group);
        const isExpanded = expandedGroups[group.key] !== false; // default expanded
        const stock = stockLengths[group.key] || group.defaultStock;
        const groupOffcuts = offcutsMap[group.key] || [];
        // Visual width scale: wider sections get wider bars
        const sectionNum = parseInt(group.section) || 63;
        const barHeight = Math.max(20, Math.min(36, Math.round(sectionNum / 4)));

        return (
          <div key={group.key} className="card overflow-hidden">
            {/* Group header */}
            <div
              className="px-4 py-3 border-b border-surface-500 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => toggleExpand(group.key)}
                className="shrink-0 cursor-pointer text-ink-400 hover:text-ink-200 transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <div className="text-sm font-semibold text-ink-50">{group.label}</div>
              {(() => {
                const mat = getMaterialForGroup(group.items);
                return mat ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-accent-400 bg-accent-500/10 px-2 py-0.5 rounded font-mono">{mat.item_number}</span>
                    <span className="text-[10px] text-ink-100 font-medium">{mat.name}</span>
                    {mat.size && <span className="text-[9px] text-ink-300">Size: {mat.size}</span>}
                    {mat.thickness && <span className="text-[9px] text-ink-300">Thick: {mat.thickness}</span>}
                    {mat.category && <span className="text-[9px] text-ink-400">{mat.category}{mat.subcategory ? ` / ${mat.subcategory}` : ''}</span>}
                  </div>
                ) : (
                  <span className="text-[10px] text-ink-400/50 italic">No material assigned</span>
                );
              })()}
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-ink-400">Stock:</span>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => stepStock(group, stock, 100)}
                      className="text-ink-400 hover:text-accent-400 leading-none text-[8px] px-0.5"
                      aria-label="Increase stock by 100mm"
                    >▲</button>
                    <button
                      type="button"
                      onClick={() => stepStock(group, stock, -100)}
                      className="text-ink-400 hover:text-accent-400 leading-none text-[8px] px-0.5"
                      aria-label="Decrease stock by 100mm"
                    >▼</button>
                  </div>
                  <input
                    className="w-16 text-[11px] text-ink-100 bg-surface-700 border border-surface-500 rounded px-1.5 py-0.5 text-center outline-none focus:border-accent-500"
                    value={stock}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setStockLengths((p) => ({ ...p, [group.key]: v }));
                    }}
                  />
                  <span className="text-[10px] text-ink-400">mm</span>
                </div>
                <span className="text-[10px] text-ink-400">
                  {group.items.length} elements · {group.items.reduce((s, it) => s + (it.quantity || 1), 0)} pcs
                </span>
              </div>
            </div>

            {isExpanded && (
              <div>
                {/* BLO visualization */}
                {optGroup?.bars?.length > 0 && (
                  <div className="p-4 border-b border-surface-500/50 bg-surface-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-ink-200">Bar Layout Optimizer</div>
                      <div className="text-[10px] text-ink-400">
                        Bars: {optGroup.summary.totalBars} · Waste: {optGroup.summary.wasteTotal} mm · Util: {(optGroup.summary.utilAvg * 100).toFixed(1)}%
                      </div>
                    </div>
                    {/* Bars — scaled proportionally to longest bar */}
                    <div className="space-y-1">
                      {(() => {
                        const maxStock = Math.max(...optGroup.bars.map((b) => b.stockLength || stock));
                        return optGroup.bars.map((bar) => {
                          const barStock = bar.stockLength || stock;
                          const barWidthPct = (barStock / maxStock) * 100;
                          let cursor = settings?.endTrim || 10;
                          const details = bar.cutDetails || bar.cuts.map((c) => ({ length: c, elementName: '' }));
                          return (
                            <div key={bar.barId} className="flex items-center gap-2">
                              <div className="w-20 text-[10px] text-ink-400 font-mono flex items-center gap-1">
                                {bar.isOffcut && <span className="text-amber-400" title="Offcut">◆</span>}
                                {bar.barId}
                              </div>
                              <div className="flex-1 relative" style={{ height: barHeight }}>
                                <div
                                  className="bg-surface-600 rounded relative overflow-hidden border border-surface-500 h-full"
                                  style={{ width: `${barWidthPct}%` }}
                                >
                                  <div className="absolute inset-y-0 bg-surface-500"
                                    style={{ left: 0, width: `${((settings?.endTrim || 10) / barStock) * 100}%` }} />
                                  {details.map((detail, idx) => {
                                    const cutLen = typeof detail === 'number' ? detail : detail.length;
                                    const elName = typeof detail === 'number' ? '' : (detail.elementName || '');
                                    const winName = typeof detail === 'number' ? '' : (detail.windowName || '');
                                    const projNum = typeof detail === 'number' ? '' : (detail.projectNumber || '');
                                    const sym = elName ? getPartSymbol(elName) : null;
                                    const label = sym ? `${projNum ? projNum + '-' : ''}${winName ? winName + '-' : ''}${sym.symbol}` : '';
                                    const left = (cursor / barStock) * 100;
                                    const width = (cutLen / barStock) * 100;
                                    cursor += cutLen + (settings?.kerf || 3);
                                    return (
                                      <div key={idx}
                                        className="absolute inset-y-0 border-r border-surface-800 text-[8px] text-white flex items-center justify-center overflow-hidden px-0.5"
                                        style={{
                                          left: `${left}%`,
                                          width: `${width}%`,
                                          background: bar.isOffcut ? 'rgba(217,161,53,0.6)' : 'rgba(0,180,160,0.6)',
                                        }}
                                        title={`${label} ${cutLen} mm${elName ? ' — ' + elName : ''}`}>
                                        <span className="truncate">
                                          {cutLen > barStock * 0.08 ? `${label} ${cutLen}` : (label || '')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="w-20 text-[10px] text-ink-400 text-right font-mono">
                                {(bar.utilization * 100).toFixed(0)}% {bar.isOffcut ? `(${barStock})` : ''}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Offcuts input */}
                    <div className="mt-3 pt-3 border-t border-surface-500/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-ink-400">Offcuts:</span>
                        {groupOffcuts.map((oc, idx) => (
                          <span key={idx} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {oc} mm
                            <button onClick={() => handleRemoveOffcut(group.key, idx)} className="text-amber-400 hover:text-amber-200">×</button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            className="w-16 text-[10px] bg-surface-700 border border-surface-500 rounded px-1.5 py-0.5 text-ink-200 outline-none focus:border-accent-500"
                            placeholder="mm"
                            value={offcutInput[group.key] || ''}
                            onChange={(e) => setOffcutInput((p) => ({ ...p, [group.key]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddOffcut(group.key); }}
                          />
                          <button
                            onClick={() => handleAddOffcut(group.key)}
                            className="text-[10px] px-2 py-0.5 rounded bg-surface-700 text-ink-300 hover:text-accent-400 hover:bg-surface-600 border border-surface-500 transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Elements table — independent collapse, collapsed by default */}
                {(() => {
                  const tableOpen = expandedTables[group.key] === true;
                  return (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleTable(group.key)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-[11px] text-ink-400 hover:text-ink-200 hover:bg-surface-700/30 transition-colors border-t border-surface-500/40 cursor-pointer"
                        aria-label={tableOpen ? 'Collapse element list' : 'Expand element list'}
                      >
                        <svg className={`w-3 h-3 transition-transform ${tableOpen ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        <span className="font-medium">Element list</span>
                        <span className="text-ink-500">· {group.items.length} elements</span>
                      </button>
                      {tableOpen && <GroupedElementTable items={group.items} />}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {allGroups.length === 0 && (
        <div className="card p-8 text-center text-ink-400">No pre-cut groups available.</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Cut List — grouped by element, symbols, mirror, sorted
// ═══════════════════════════════════════════════════════════════
function CutListTab({ merged, isPPMode, pp, batch, registerExport, exportFormat }) {
  // Material assignment lookup
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const getMaterialById = useMaterialStore((s) => s.getMaterialById);

  const getMaterialForElement = (elementName) => {
    const sym = getPartSymbol(elementName);
    if (sym?.partId) {
      const assignment = assignments[sym.partId];
      if (assignment?.material_id) {
        const mat = getMaterialById(assignment.material_id);
        if (mat) return mat;
      }
    }
    return null;
  };

  const [elementImages, setElementImages] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem('pc-element-images') || '{}'); return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {}; } catch { return {}; }
  });

  const handleImageUpload = (elementKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const updated = { ...elementImages, [elementKey]: dataUrl };
        setElementImages(updated);
        localStorage.setItem('pc-element-images', JSON.stringify(updated));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (elementKey) => {
    const updated = { ...elementImages };
    delete updated[elementKey];
    setElementImages(updated);
    localStorage.setItem('pc-element-images', JSON.stringify(updated));
  };

  const [zoomedElement, setZoomedElement] = useState(null);
  if (!merged?.cutList?.length) {
    return <div className="card p-8 text-center text-ink-400">No cut list data available.</div>;
  }

  // Build ordered groups (one per element TYPE, all windows inside, pairs ×2,
  // longest-first) from the single source buildGroupedCutList, then adapt to the
  // shape this tab's render expects ({ element, symbolInfo, items, aggregated }).
  const byElement = useMemo(() => {
    const groups = buildGroupedCutList(merged.cutList);
    return groups.map((g) => ({
      element: g.label,
      section: g.section,
      symbolInfo: { symbol: g.symbol, name: g.label, mirror: g.mirror },
      items: g.rows.map((r) => ({ length: r.length, windowName: r.window, _projectNumber: r.projectNum, quantity: r.qty, section: g.section, mismatch: r.mismatch })),
      aggregated: g.rows.map((r) => ({ length: r.length, windowName: r.window, _projectNumber: r.projectNum, totalQty: r.qty, mismatch: r.mismatch })),
      _rows: g.rows,
    }));
  }, [merged.cutList]);

  const totalPieces = merged.cutList.reduce((s, c) => s + (c.quantity || 1), 0);

  const handleExport = () => {
    const company = useProjectStore.getState().settings.company || {};
    const projects = [...new Set(merged.cutList.map((c) => c._projectNumber).filter(Boolean))];
    const groups = byElement.map((g) => {
      const m = getMaterialForElement(g.element);
      return {
        symbol: g.symbolInfo?.symbol || '',
        element: g.element,
        mirror: g.symbolInfo?.mirror,
        section: g.section || '',
        material: m ? `${m.item_number || ''} ${m.name || ''}`.trim() : '',
        rows: g._rows.map((r) => ({
          projectNum: r.projectNum, window: r.window, length: r.length, qty: r.qty,
        })),
      };
    });
    exportCutListPDF({
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      title: pp?.name || batch?.name || 'Pack',
      projects, date: new Date().toLocaleDateString('en-GB'),
      isPPMode, totalPieces, groups,
      format: exportFormat,
    });
  };
  registerExport('cutlist', handleExport);

  return (
    <div className="space-y-4">
      {byElement.map((group) => {
        const sym = group.symbolInfo;
        // Find finished section from SASH_WINDOW_PARTS if available
        const finishedSection = group.section || group.items[0]?.section || '—';

        return (
          <div key={group.element} className="card overflow-hidden">
            {/* Section header: image + name + symbol — single row */}
            <div className="px-4 py-3 border-b border-surface-500 flex items-center gap-3 bg-surface-800">
              {/* 2D images — two slots side by side, ~80x80, zoomable */}
              {[group.element, `${group.element}:2`].map((imgKey, slotIdx) => (
                elementImages[imgKey] ? (
                  <div key={slotIdx} className="relative group/img shrink-0">
                    <img
                      src={elementImages[imgKey]}
                      alt={group.element}
                      className="w-20 h-20 rounded border border-surface-500 object-cover cursor-zoom-in"
                      onClick={() => setZoomedElement(elementImages[imgKey])}
                    />
                    <button onClick={() => handleRemoveImage(imgKey)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-[9px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">×</button>
                  </div>
                ) : (
                  <label key={slotIdx} className="w-20 h-20 rounded bg-surface-700 border border-dashed border-surface-500 flex flex-col items-center justify-center text-ink-400 hover:text-accent-400 hover:border-accent-500 cursor-pointer transition-colors shrink-0" title="Upload 2D drawing">
                    <svg className="w-5 h-5 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
                    <span className="text-[8px]">2D</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(imgKey, e)} />
                  </label>
                )
              ))}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">{sym.symbol}</span>
                  <span className="text-sm font-semibold text-ink-50">{group.element}</span>
                  {sym.mirror && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded" title="Mirror pair (L+R)">⟷ mirror</span>
                  )}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  Section: {finishedSection} · {group.aggregated.reduce((s, a) => s + a.totalQty, 0)} pcs
                  {(() => {
                    const mat = getMaterialForElement(group.element);
                    return mat ? (
                      <span className="ml-2">
                        <span className="text-accent-400 font-mono">{mat.item_number}</span>
                        <span className="text-ink-200 ml-1">{mat.name}</span>
                        {mat.size && <span className="text-ink-400 ml-1">· {mat.size}</span>}
                        {mat.thickness && <span className="text-ink-400 ml-1">· t:{mat.thickness}</span>}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-500 bg-surface-700/30">
                    <th className="px-4 py-2 text-left text-ink-400 font-medium w-16">Symbol</th>
                    {isPPMode && <th className="px-4 py-2 text-left text-ink-400 font-medium">Project</th>}
                    <th className="px-4 py-2 text-left text-ink-400 font-medium">Windows</th>
                    <th className="px-4 py-2 text-right text-ink-400 font-medium">Length</th>
                    <th className="px-4 py-2 text-right text-ink-400 font-medium">Qty</th>
                    <th className="px-4 py-2 text-left text-ink-400 font-medium">Finished</th>
                    <th className="px-4 py-2 text-center text-ink-400 font-medium w-16">Mirror</th>
                  </tr>
                </thead>
                <tbody>
                  {group.aggregated.map((item, idx) => (
                    <tr key={idx} className="border-b border-surface-500/30 hover:bg-surface-700/20">
                      <td className="px-4 py-2 font-mono font-bold text-accent-400">{sym.symbol}</td>
                      {isPPMode && <td className="px-4 py-2 text-ink-300 text-[10px]">{item._projectNumber || '—'}</td>}
                      <td className="px-4 py-2 text-ink-200">{item.windowName || '—'}</td>
                      <td className="px-4 py-2 text-right text-ink-100 font-mono">{item.length} mm</td>
                      <td className="px-4 py-2 text-right text-ink-100 font-semibold">{item.totalQty}</td>
                      <td className="px-4 py-2 text-ink-300">{finishedSection}</td>
                      <td className="px-4 py-2 text-center">
                        {sym.mirror ? <span className="text-purple-400">⟷</span> : <span className="text-ink-400/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="card px-4 py-3 text-xs text-ink-400">
        Total element types: {byElement.length} · Total pieces: {totalPieces}
      </div>

      {/* Zoom modal */}
      {zoomedElement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setZoomedElement(null)}>
          <img src={zoomedElement} alt="Zoomed" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
          <button onClick={() => setZoomedElement(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-700 border border-surface-500 text-ink-300 hover:text-ink-50 flex items-center justify-center text-lg">×</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: BOM
// ═══════════════════════════════════════════════════════════════
// ─── TAB: Spraying ───
// Structure 2: Part A = elements (box + sashes) by colour (single grouped, dual separate);
// Part B = beadings (staff/parting/glazing/georgian) by INTERIOR colour, as lm + pcs.
const SPRAY_BEADINGS = {
  'STAFF BEADING': 'Staff',
  'PARTING BEADING': 'Parting',
  'GLAZING BEADING': 'Glazing',
  'GEORGIAN MIDDLE BEADING': 'Georgian',
};
const SPRAY_BAR_LEN_M = 3;            // beading supplied in 3 m bars
const ceilHalf = (x) => Math.ceil(x * 2) / 2;   // round up to nearest 0.5

function ColorChip({ hex, name }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3.5 h-3.5 rounded border border-surface-400" style={{ background: hex }} />
      <span className="text-ink-100">{name}</span>
    </span>
  );
}

function SprayNoteInput({ noteKey }) {
  const value = useProjectStore((s) => s.sprayNotes[noteKey] || '');
  const setSprayNote = useProjectStore((s) => s.setSprayNote);
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setSprayNote(noteKey, e.target.value)}
      placeholder="add note…"
      className="w-full bg-surface-800 border border-surface-500 rounded px-2 py-1 text-xs text-ink-100 focus:border-ink-300 focus:outline-none"
    />
  );
}

function SprayMeta({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
      <div className="text-ink-100 font-medium">{value || '—'}</div>
    </div>
  );
}

const SPRAY_ELEM_ORDER = { 'Box': 0, 'Upper Sash': 1, 'Lower Sash': 2 };

function SprayingTab({ windowsData, batch, pp, registerExport }) {
  const data = useMemo(() => {
    const wins = (windowsData || []).filter((wd) => wd.derived);
    const colorSections = {};  // hex → { hex, name, rows:[{projectNum, window, element, colour, size, sort}] }
    const beadByColor = {};    // interior hex → { hex, name, beads:{label: mm} }

    const addRow = (hex, row) => {
      if (!colorSections[hex]) colorSections[hex] = { hex, name: getColorName(hex), rows: [] };
      colorSections[hex].rows.push(row);
    };

    wins.forEach(({ win, windowSpec, derived }) => {
      const c = windowSpec.color || {};
      const single = c.single || '#F6F6F6';
      const outside = c.outside || single;
      const inside = c.inside || single;
      const isDual = (c.type && c.type !== 'single') && (outside !== inside);

      const projectNum = win._projectNumber || '';
      const fw = Math.round(windowSpec.frame?.width || 0);
      const fh = Math.round(windowSpec.frame?.height || 0);
      const sW = Math.round(derived.sashWidth || 0);
      const tH = Math.round(derived.topSashHeight || 0);
      const bH = Math.round(derived.bottomSashHeight || 0);
      const elements = [
        { element: 'Box', size: `${fw} × ${fh}` },
        { element: 'Upper Sash', size: `${sW} × ${tH}` },
        { element: 'Lower Sash', size: `${sW} × ${bH}` },
      ];

      // PART A — each element row goes into its colour section.
      // Dual: row appears in BOTH the outside and inside colour sections (face labelled).
      elements.forEach((el) => {
        const base = { projectNum, window: win.name, element: el.element, size: el.size, sort: SPRAY_ELEM_ORDER[el.element] ?? 9 };
        if (isDual) {
          addRow(outside, { ...base, colour: `${getColorName(outside)} (out)`, noteKey: `${win.id}_${el.element}_out` });
          addRow(inside,  { ...base, colour: `${getColorName(inside)} (in)`,  noteKey: `${win.id}_${el.element}_in` });
        } else {
          addRow(single, { ...base, colour: getColorName(single), noteKey: `${win.id}_${el.element}_single` });
        }
      });

      // PART B — beadings always under interior colour
      if (!beadByColor[inside]) beadByColor[inside] = { hex: inside, name: getColorName(inside), beads: {} };
      (derived.components?.beading || []).forEach((b) => {
        const label = SPRAY_BEADINGS[b.elementName];
        if (!label) return; // exclude triangle + meeting (attached to sash)
        const mm = (b.length || 0) * (b.quantity || 1);
        beadByColor[inside].beads[label] = (beadByColor[inside].beads[label] || 0) + mm;
      });
    });

    // Sort each section's rows: by element (Box → Upper → Lower), then window
    const sections = Object.values(colorSections).map((s) => ({
      hex: s.hex, name: s.name,
      rows: s.rows.slice().sort((a, b) => a.sort - b.sort || String(a.window).localeCompare(String(b.window))),
    }));

    const beadGroups = Object.values(beadByColor).map((g) => ({
      hex: g.hex, name: g.name,
      rows: ['Staff', 'Parting', 'Glazing', 'Georgian']
        .map((label) => ({ label, mm: g.beads[label] || 0 }))
        .filter((r) => r.mm > 0)
        .map((r) => { const lm = r.mm / 1000; return { label: r.label, lm, pcs: ceilHalf(lm / SPRAY_BAR_LEN_M) }; }),
    })).filter((g) => g.rows.length > 0);

    const projects = [...new Set(wins.map((w) => w.win._projectNumber).filter(Boolean))];
    const colourChips = sections.map((s) => ({ hex: s.hex, name: s.name }));

    return { sections, beadGroups, projects, colourChips };
  }, [windowsData]);

  const handleExport = () => {
    const st = useProjectStore.getState();
    const notes = st.sprayNotes;
    const company = st.settings.company || {};
    const sections = data.sections.map((s) => ({
      name: s.name, hex: s.hex,
      rows: s.rows.map((r) => ({
        projectNum: r.projectNum, window: r.window, element: r.element,
        colour: r.colour, size: r.size, additional: notes[r.noteKey] || '',
      })),
    }));
    exportSprayingPDF({
      title: pp?.name || batch?.name || 'Pack',
      projects: data.projects,
      date: new Date().toLocaleDateString('en-GB'),
      deadline: pp?.deadline || '',
      colours: data.colourChips.map((c) => c.name),
      sections,
      beadGroups: data.beadGroups,
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
    });
  };
  registerExport('spraying', handleExport);

  if (!data.sections.length && !data.beadGroups.length) {
    return <div className="card p-8 text-center text-ink-400">No data available.</div>;
  }

  const countBoxes = (rows) => rows.filter((r) => r.element === 'Box').length;
  const countSashes = (rows) => rows.filter((r) => r.element !== 'Box').length;
  const packName = pp?.name || batch?.name || 'Pack';
  const packType = pp?.type || batch?.type || 'sash';
  const deadline = pp?.deadline || '';
  const today = new Date().toLocaleDateString('en-GB');

  return (
    <div className="space-y-6">
      {/* Header — Spraying Information */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-ink-50">Spraying Information</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <SprayMeta label="Pack" value={packName} />
          <SprayMeta label="Type" value={packType} />
          <SprayMeta label="Deadline" value={deadline} />
          <SprayMeta label="Date" value={today} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="text-ink-500">Colours:</span>
          {data.colourChips.map((c) => <ColorChip key={c.hex} hex={c.hex} name={c.name} />)}
        </div>
        {data.projects.length > 0 && (
          <div className="mt-1.5 text-xs"><span className="text-ink-500">Projects: </span><span className="text-ink-200">{data.projects.join(' · ')}</span></div>
        )}
      </div>

      {/* PART A — Elements: colour sections, sorted by element */}
      <div>
        <div className="text-sm font-semibold text-ink-50 mb-3">Part A — Elements <span className="text-ink-400 font-normal">· by colour, sorted by element</span></div>
        {data.sections.map((g) => (
          <div key={g.hex} className="card overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-surface-500 flex items-center justify-between">
              <ColorChip hex={g.hex} name={g.name} />
              <span className="text-[10px] text-ink-400">{countBoxes(g.rows)} box{countBoxes(g.rows) !== 1 ? 'es' : ''} · {countSashes(g.rows)} sash{countSashes(g.rows) !== 1 ? 'es' : ''}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-500/50 bg-surface-800">
                  <th className="px-3 py-2 text-left text-ink-400 font-medium w-10">#</th>
                  <th className="px-3 py-2 text-left text-ink-400 font-medium">Project №</th>
                  <th className="px-3 py-2 text-left text-ink-400 font-medium">Window</th>
                  <th className="px-3 py-2 text-left text-ink-400 font-medium">Element</th>
                  <th className="px-3 py-2 text-left text-ink-400 font-medium">Colour</th>
                  <th className="px-3 py-2 text-right text-ink-400 font-medium">Size (mm)</th>
                  <th className="px-3 py-2 text-left text-ink-400 font-medium">Additional info</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i} className="border-b border-surface-500/30">
                    <td className="px-3 py-1.5 text-ink-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-1.5 text-ink-300 font-mono">{r.projectNum || '—'}</td>
                    <td className="px-3 py-1.5 text-ink-200">{r.window}</td>
                    <td className="px-3 py-1.5 text-ink-300">{r.element}</td>
                    <td className="px-3 py-1.5 text-ink-300">{r.colour}</td>
                    <td className="px-3 py-1.5 text-right text-ink-100 font-mono">{r.size}</td>
                    <td className="px-3 py-1 w-[28%]"><SprayNoteInput noteKey={r.noteKey} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* PART B — Beadings */}
      <div>
        <div className="text-sm font-semibold text-ink-50 mb-3">Part B — Beadings <span className="text-ink-400 font-normal">· painted first · by interior colour</span></div>
        {data.beadGroups.map((g) => (
          <div key={g.hex} className="card overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-surface-500">
              <ColorChip hex={g.hex} name={g.name} />
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-500/50 bg-surface-800">
                  <th className="px-4 py-2 text-left text-ink-400 font-medium">Type</th>
                  <th className="px-4 py-2 text-right text-ink-400 font-medium">Linear m</th>
                  <th className="px-4 py-2 text-right text-ink-400 font-medium">Bars (pcs)</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i} className="border-b border-surface-500/30">
                    <td className="px-4 py-1.5 text-ink-200">{r.label}</td>
                    <td className="px-4 py-1.5 text-right text-ink-100 font-mono">{r.lm.toFixed(2)}</td>
                    <td className="px-4 py-1.5 text-right text-ink-100 font-mono font-medium">{r.pcs.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function BOMTab({ batch, pp, isPPMode, windowsData, registerExport }) {
  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const ironmongeryItems = useIronmongeryStore((s) => s.items);
  const settings = useProjectStore((s) => s.settings);
  const [zoomSrc, setZoomSrc] = useState(null);

  // Same engine as Single Window BOM / Project Materials, merged over THIS pack's
  // windows (which may span multiple projects). Source of truth: deriveWindowData per window.
  const rows = useMemo(() => {
    const windows = (windowsData || [])
      .filter((wd) => wd.derived && wd.windowSpec)
      .map((wd) => ({ derived: wd.derived, windowSpec: wd.windowSpec, batch: wd.win?._batch }));
    if (!windows.length) return [];
    return mergeWindowMaterials(windows, { assignments, materials, ALL_PARTS, ironmongeryItems, settings });
  }, [windowsData, assignments, materials, ironmongeryItems, settings]);

  const totalCost = rows.reduce((s, r) => s + (r.costPerUnit > 0 ? r.qty * r.costPerUnit : 0), 0);

  // Header "Export PDF" → flat purchase list (same data as the table below).
  const handleExport = () => {
    if (!rows.length) return;
    const company = useProjectStore.getState().settings.company || {};
    const projects = [...new Set((windowsData || []).map((d) => d.win?._projectNumber).filter(Boolean))];
    exportBomPDF({
      title: pp?.name || batch?.name || 'Pack',
      projects,
      date: new Date().toLocaleDateString('en-GB'),
      deadline: pp?.deadline || '',
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      rows: rows.map((r) => ({
        name: r.name,
        itemNumber: r.material?.item_number || r.product?.item_number || '',
        qty: formatQty(r.qty, r.unit),
        unitCost: r.costPerUnit > 0 ? `£${r.costPerUnit.toFixed(2)}` : '—',
        estCost: r.costPerUnit > 0 ? `£${(r.qty * r.costPerUnit).toFixed(2)}` : '—',
        ironmongery: r.source === 'ironmongery',
        assigned: r._assigned,
      })),
      total: `£${totalCost.toFixed(2)}`,
    });
  };
  registerExport && registerExport('bom', handleExport);

  if (!rows.length) {
    return <div className="card p-8 text-center text-ink-400">No materials — add windows and assign materials in Materials → Assignments.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500 flex items-center justify-between">
          <div className="text-sm font-semibold text-ink-50">Production Pack Materials</div>
          <div className="text-[10px] text-ink-400">{rows.length} material{rows.length !== 1 ? 's' : ''} · Purchase list · Yield applied</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-800">
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Material</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Qty</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-surface-500/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {(row.material?.image_url || row.product?.image_url) ? (
                        <img src={row.material?.image_url || row.product?.image_url} alt=""
                          onClick={() => setZoomSrc(row.material?.image_url || row.product?.image_url)}
                          className="w-[34px] h-[34px] rounded object-cover border border-surface-500 cursor-zoom-in hover:opacity-80 transition-opacity" />
                      ) : (
                        <div className="w-[34px] h-[34px] rounded bg-surface-600 border border-surface-500 grid place-items-center text-ink-500 text-[10px]">{row._assigned ? '—' : '?'}</div>
                      )}
                      <div>
                        <div className={`font-medium ${row._assigned ? 'text-ink-100' : 'text-ink-300 italic'}`}>{row.name}</div>
                        <div className="text-[10px] text-ink-400 flex items-center gap-2">
                          {(row.material?.item_number || row.product?.item_number) && <span>{row.material?.item_number || row.product?.item_number}</span>}
                          {row.source === 'ironmongery' && <span className="text-[8px] px-1 py-0.5 rounded bg-surface-600 text-ink-400 border border-surface-500">ironmongery</span>}
                          {(row.material?.jc_uuid || row.product?.jc_uuid) && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>}
                          {!row._assigned && <span>unassigned</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-100 font-mono font-medium whitespace-nowrap">{formatQty(row.qty, row.unit)}</td>
                  <td className="px-4 py-2.5 text-right text-ink-300 font-mono whitespace-nowrap">{row.costPerUnit > 0 ? `£${(row.qty * row.costPerUnit).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-surface-500 flex justify-end">
          <div className="text-xs text-ink-300">Est. total: <strong className="text-ink-100 font-mono">£{totalCost.toFixed(2)}</strong></div>
        </div>
      </div>
      {zoomSrc && <ImageLightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Placeholder
// ═══════════════════════════════════════════════════════════════
function PlaceholderTab({ title, desc }) {
  return (
    <div className="card p-12 text-center">
      <div className="text-3xl mb-4">🚧</div>
      <div className="text-lg font-semibold text-ink-200 mb-2">{title}</div>
      <div className="text-sm text-ink-400 max-w-md mx-auto">{desc}</div>
      <div className="mt-4 text-xs text-ink-400">Coming in the next session.</div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Shared Sub-Components
// ═══════════════════════════════════════════════════════════════

/** Grouped element table — groups items by element+length, shows windows list */
function GroupedElementTable({ items, isPPMode }) {
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = `${it.elementName}|${it.length}`;
      if (!map.has(key)) {
        map.set(key, { element: it.elementName, length: it.length, finishedLength: it.finishedLength || it.length, section: it.section || '', totalQty: 0, windows: [], projects: [] });
      }
      const g = map.get(key);
      g.totalQty += it.quantity;
      if (it.windowName && !g.windows.includes(it.windowName)) g.windows.push(it.windowName);
      if (it._projectNumber && !g.projects.includes(it._projectNumber)) g.projects.push(it._projectNumber);
    });
    return Array.from(map.values()).sort((a, b) => a.element.localeCompare(b.element));
  }, [items]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-500/50 bg-surface-700/30">
            {isPPMode && <th className="px-4 py-2 text-left text-ink-400 font-medium">Projects</th>}
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Element</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Pre-Cut</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Finished</th>
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Section</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Total Qty</th>
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Windows</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((g, i) => {
            const sym = getPartSymbol(g.element);
            return (
            <tr key={i} className="border-b border-surface-500/30">
              {isPPMode && <td className="px-4 py-2 text-accent-400 text-[10px]">{g.projects.join(', ')}</td>}
              <td className="px-4 py-2 text-ink-100">{g.element} <span className="text-accent-400 font-mono text-[10px]">({sym.symbol})</span>{sym.mirror ? <span className="text-purple-400 text-[9px] ml-1">⟷</span> : ''}</td>
              <td className="px-4 py-2 text-right text-ink-100 font-mono">{g.length} mm</td>
              <td className="px-4 py-2 text-right text-ink-300 font-mono">{g.finishedLength} mm</td>
              <td className="px-4 py-2 text-ink-300">{g.section}</td>
              <td className="px-4 py-2 text-right text-ink-100 font-semibold">{g.totalQty}</td>
              <td className="px-4 py-2 text-ink-400">{g.windows.join(', ')}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Timber summary — group by material, sum total length */
function TimberSummaryTable({ cutList, isPPMode }) {
  const groups = useMemo(() => {
    const map = new Map();
    cutList.forEach((c) => {
      const key = `${c.material || 'Unknown'}|${c.section || ''}`;
      if (!map.has(key)) {
        map.set(key, { material: c.material || 'Unknown', section: c.section || '', totalLength: 0, totalPieces: 0, projects: [] });
      }
      const g = map.get(key);
      g.totalLength += (c.length || 0) * (c.quantity || 1);
      g.totalPieces += c.quantity || 1;
      if (c._projectNumber && !g.projects.includes(c._projectNumber)) g.projects.push(c._projectNumber);
    });
    return Array.from(map.values());
  }, [cutList]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-500 bg-surface-700/50">
            {isPPMode && <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Projects</th>}
            <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Material</th>
            <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Section</th>
            <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Pieces</th>
            <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Length</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={i} className="border-b border-surface-500/50">
              {isPPMode && <td className="px-4 py-2.5 text-accent-400 text-[10px]">{g.projects.join(', ')}</td>}
              <td className="px-4 py-2.5 text-ink-100">{g.material}</td>
              <td className="px-4 py-2.5 text-ink-300">{g.section}</td>
              <td className="px-4 py-2.5 text-right text-ink-200">{g.totalPieces}</td>
              <td className="px-4 py-2.5 text-right text-ink-100 font-mono">
                {g.totalLength >= 1000 ? `${(g.totalLength / 1000).toFixed(2)} m` : `${g.totalLength} mm`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bar visualization (reused from CutListPanel pattern) */
function BarVis({ bars, stockLength, endTrim }) {
  return (
    <div className="space-y-1">
      {bars.map((bar) => {
        let cursor = endTrim;
        return (
          <div key={bar.barId} className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-ink-400 font-mono">{bar.barId}</div>
            <div className="flex-1 h-5 bg-surface-600 rounded relative overflow-hidden border border-surface-500">
              <div className="absolute inset-y-0 bg-surface-500"
                style={{ left: 0, width: `${(endTrim / stockLength) * 100}%` }} />
              {bar.cuts.map((cut, idx) => {
                const left = (cursor / stockLength) * 100;
                const width = (cut / stockLength) * 100;
                cursor += cut;
                return (
                  <div key={idx}
                    className="absolute inset-y-0 bg-accent-500/70 border-r border-surface-800 text-[9px] text-white grid place-items-center"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${cut} mm`}>
                    {cut > stockLength * 0.06 ? cut : ''}
                  </div>
                );
              })}
            </div>
            <div className="w-16 text-[10px] text-ink-400 text-right">{(bar.utilization * 100).toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Grouping Helper Functions
// ═══════════════════════════════════════════════════════════════

/** Group cut list items by element+section+length, aggregate qty, collect window names */
function groupCutListItems(cutList) {
  const map = new Map();
  cutList.forEach((c) => {
    const key = `${c.element}|${c.section}|${c.length}`;
    if (!map.has(key)) {
      map.set(key, {
        element: c.element,
        section: c.section,
        length: c.length,
        totalQty: 0,
        material: c.material,
        windows: [],
        projects: [],
      });
    }
    const g = map.get(key);
    g.totalQty += c.quantity || 1;
    if (c.windowName && !g.windows.includes(c.windowName)) g.windows.push(c.windowName);
    if (c._projectNumber && !g.projects.includes(c._projectNumber)) g.projects.push(c._projectNumber);
  });
  return Array.from(map.values()).sort((a, b) => a.element.localeCompare(b.element) || a.length - b.length);
}

/** Group glass items by width+height+type+spec+coating+spacer+finish */
function groupGlassItems(glassList) {
  const map = new Map();
  glassList.forEach((g) => {
    const key = `${g.width}|${g.height}|${g.type}|${g.spec}|${g.coating || 'standard'}|${g.spacer}|${g.spacerType || 'warm'}|${g.finish}`;
    if (!map.has(key)) {
      map.set(key, {
        width: g.width, height: g.height,
        type: g.type, spec: g.spec || 'toughened',
        coating: g.coating || 'standard', gas: g.gas ?? '',
        spacer: g.spacer, spacerType: g.spacerType || 'warm', finish: g.finish,
        makeup: g.makeup,
        totalQty: 0, windows: [], projects: [],
      });
    }
    const entry = map.get(key);
    entry.totalQty += g.quantity || 1;
    if (g.windowName && !entry.windows.includes(g.windowName)) entry.windows.push(g.windowName);
    if (g._projectNumber && !entry.projects.includes(g._projectNumber)) entry.projects.push(g._projectNumber);
  });
  return Array.from(map.values()).sort((a, b) => a.width - b.width || a.height - b.height);
}

/** Group hardware items by item+detail */
function groupHardwareItems(hwList) {
  const map = new Map();
  hwList.forEach((h) => {
    const key = `${h.item}|${h.detail}`;
    if (!map.has(key)) {
      map.set(key, { item: h.item, detail: h.detail, totalQty: 0, windows: [], projects: [] });
    }
    const g = map.get(key);
    g.totalQty += h.quantity || 1;
    if (h.windowName && !g.windows.includes(h.windowName)) g.windows.push(h.windowName);
    if (h._projectNumber && !g.projects.includes(h._projectNumber)) g.projects.push(h._projectNumber);
  });
  return Array.from(map.values()).sort((a, b) => a.item.localeCompare(b.item));
}