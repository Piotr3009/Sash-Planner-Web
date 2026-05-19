/**
 * ProductionPackPage.jsx
 *
 * Full-screen batch-level merged view. 9 tabs:
 * Overview | 3D Views | 2D Elevations | 2D Sections | 2D Elements |
 * Glass Schedule | Pre-Cut List | Cut List | BOM
 *
 * Computes derived data for ALL windows in the batch and merges
 * cut lists, glass, hardware using buildProjectAggregates.
 */
import { useState, useMemo, useEffect, Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import {
  buildCutListForWindow,
  buildPrecutForWindow,
  buildGlassListForWindow,
  buildHardwareList,
} from '../engine/lists.js';
import { optimisePrecut } from '../engine/optimizer.js';
import { mockProjects } from '../mocks/mockProjects.js';
import FrontElevation2D from '../components/drawings/FrontElevation2D.jsx';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import VerticalSection2D from '../components/drawings/VerticalSection2D.jsx';
import HorizontalSection2D from '../components/drawings/HorizontalSection2D.jsx';
import GlassDrawing2D from '../components/drawings/GlassDrawing2D.jsx';
import WindowPreview3D from '../components/viewer/WindowPreview3D.jsx';

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
  { id: 'bom',          label: 'BOM',             icon: '📦' },
];

// ─── Main Component ───
export default function ProductionPackPage() {
  const { projectId, batchId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const settings = useProjectStore((s) => s.settings);
  const [tab, setTab] = useState('overview');

  // Ensure projects loaded
  useEffect(() => {
    if (projects.length === 0) useProjectStore.getState().setProjects(mockProjects);
  }, [projects.length]);

  // Find project + batch
  const project = useMemo(
    () => (useProjectStore.getState().projects || projects).find((p) => p.id === projectId),
    [projectId, projects]
  );
  const batch = useMemo(
    () => project?.batches?.find((b) => b.id === batchId),
    [project, batchId]
  );

  // Compute per-window data
  const windowsData = useMemo(() => {
    if (!batch?.windows?.length) return [];
    return batch.windows.map((win) => {
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
  }, [batch, settings]);

  // Merged lists
  const merged = useMemo(() => {
    if (!windowsData.length) return null;

    const allCut = [];
    const allPrecut = { sashEngineering: [], boxSapele: [] };
    const allGlass = [];
    const allHardware = [];

    windowsData.forEach(({ win, windowSpec, derived }) => {
      if (!derived || !windowSpec) return;
      // Cut list
      const cuts = buildCutListForWindow(derived, windowSpec);
      allCut.push(...cuts.map((r) => ({ ...r, windowName: win.name })));

      // Precut
      const pre = buildPrecutForWindow(derived, windowSpec, settings);
      pre.sashEngineering.forEach((g) => {
        g.items.forEach((it) => { it.windowName = win.name; });
        const found = allPrecut.sashEngineering.find((x) => x.section === g.section);
        if (found) found.items.push(...g.items);
        else allPrecut.sashEngineering.push({ section: g.section, items: [...g.items] });
      });
      pre.boxSapele.forEach((g) => {
        g.items.forEach((it) => { it.windowName = win.name; });
        const found = allPrecut.boxSapele.find((x) => x.preCutWidth === g.preCutWidth);
        if (found) found.items.push(...g.items);
        else allPrecut.boxSapele.push({ preCutWidth: g.preCutWidth, items: [...g.items] });
      });

      // Glass
      const glass = buildGlassListForWindow(derived, windowSpec);
      allGlass.push(...glass.map((g) => ({ ...g, windowName: win.name })));

      // Hardware
      const hw = buildHardwareList(windowSpec);
      allHardware.push(...hw.map((h) => ({ ...h, windowName: win.name })));
    });

    // Optimization
    let optimization = null;
    try {
      optimization = optimisePrecut(allPrecut, settings);
    } catch (e) {
      console.warn('Optimizer failed:', e);
    }

    return { cutList: allCut, precut: allPrecut, glass: allGlass, hardware: allHardware, optimization };
  }, [windowsData, settings]);

  // ─── Render ───
  if (!project || !batch) {
    return (
      <div className="min-h-screen bg-surface-800 p-8">
        <Link to={`/projects/${projectId || ''}`} className="text-xs text-ink-400 hover:text-accent-400">← Back to project</Link>
        <div className="mt-8 text-center text-ink-400">Batch not found.</div>
      </div>
    );
  }

  const backUrl = `/projects/${projectId}`;

  return (
    <div className="min-h-screen bg-surface-800">
      {/* Header */}
      <header className="border-b border-surface-500 bg-surface-900 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <Link to={backUrl} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to project</Link>
            <h1 className="text-xl font-bold text-ink-50 mt-1">
              Production Pack — {batch.label}
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              {project.name} · {batch.windows?.length || 0} windows · {batch.status}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn btn-secondary text-xs">🖨️ Print</button>
          </div>
        </div>
      </header>

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
        {tab === 'overview'   && <OverviewTab batch={batch} windowsData={windowsData} projectId={projectId} batchId={batchId} />}
        {tab === '3d'         && <ThreeDTab windowsData={windowsData} projectId={projectId} batchId={batchId} />}
        {tab === 'elevations' && <ElevationsTab windowsData={windowsData} projectId={projectId} batchId={batchId} />}
        {tab === 'sections'   && <SectionsTab windowsData={windowsData} />}
        {tab === 'elements'   && <ElementsTab windowsData={windowsData} projectId={projectId} batchId={batchId} />}
        {tab === 'glass'      && <GlassTab merged={merged} windowsData={windowsData} />}
        {tab === 'precut'     && <PreCutTab merged={merged} settings={settings} />}
        {tab === 'cutlist'    && <CutListTab merged={merged} />}
        {tab === 'bom'        && <BOMTab merged={merged} batch={batch} windowsData={windowsData} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Overview
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ batch, windowsData, projectId, batchId }) {
  return (
    <div className="space-y-4">
      {/* Batch defaults summary */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-ink-50 mb-3">Batch Defaults</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-400">
          <span>Type: <strong className="text-ink-100">{batch.type}</strong></span>
          <span>Colour: <strong className="text-ink-100">{batch.defaults?.colourMode === 'dual' ? 'Dual' : 'Single'}</strong></span>
          <span>Glass: <strong className="text-ink-100">{batch.defaults?.glassType}</strong></span>
          <span>Frame: <strong className="text-ink-100">{batch.defaults?.frameType}</strong></span>
          <span>Ironmongery: <strong className="text-ink-100">{batch.defaults?.ironmongery}</strong></span>
          {batch.type === 'sash' && <span>Horns: <strong className="text-ink-100">{batch.defaults?.hornType}</strong></span>}
          <span>PAS24: <strong className="text-ink-100">{batch.defaults?.pas24 ? 'Yes' : 'No'}</strong></span>
        </div>
      </div>

      {/* Windows table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500">
          <div className="text-sm font-semibold text-ink-50">Windows in Batch ({windowsData.length})</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/50">
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Name</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Bars</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Head</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Glass</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Opening</th>
                <th className="px-4 py-2.5 text-center text-ink-400 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {windowsData.map(({ win }) => (
                <tr key={win.id} className="border-b border-surface-500/50 hover:bg-surface-700/30">
                  <td className="px-4 py-2.5 text-ink-100 font-medium">{win.name}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.sashType || 'double'}</td>
                  <td className="px-4 py-2.5 text-right text-ink-200">{win.width} mm</td>
                  <td className="px-4 py-2.5 text-right text-ink-200">{win.height} mm</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.upperBars || 'none'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.headType || 'flat'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.glassFinish || 'clear'}</td>
                  <td className="px-4 py-2.5 text-ink-300">{win.openingType || 'both'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Link to={`/projects/${projectId}/batches/${batchId}/windows/${win.id}`}
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
function ThreeDTab({ windowsData, projectId, batchId }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {windowsData.map(({ win, windowSpec }) => (
        <div key={win.id} className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-surface-500 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-50">{win.name} — {win.width}×{win.height} mm</span>
            <Link to={`/projects/${projectId}/batches/${batchId}/windows/${win.id}`}
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
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 2D Elevations
// ═══════════════════════════════════════════════════════════════
function ElevationsTab({ windowsData, projectId, batchId }) {
  return (
    <div className="space-y-6">
      {windowsData.map(({ win, windowSpec, derived }) => (
        <div key={win.id} className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-ink-50">
              {win.name} — {win.width}×{win.height} mm
            </div>
            <Link to={`/projects/${projectId}/batches/${batchId}/windows/${win.id}`}
              className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors">
              View Details →
            </Link>
          </div>
          {derived ? (
            <FrontElevation2D windowSpec={windowSpec} derived={derived} />
          ) : (
            <div className="text-xs text-ink-400 py-8 text-center">Calculations not available for this window.</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 2D Sections (shared for batch — V-Section + H-Section)
// ═══════════════════════════════════════════════════════════════
function SectionsTab({ windowsData }) {
  // Use first window's data — sections are shared (same profiles for entire batch)
  const first = windowsData[0];
  if (!first?.windowSpec || !first?.derived) {
    return <div className="card p-8 text-center text-ink-400">No data available.</div>;
  }
  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="text-sm font-semibold text-ink-50 mb-3">Vertical Section</div>
        <div className="text-[10px] text-ink-400 mb-2">
          Cross-section from head to sill (shared for all windows in this batch — same profile type).
        </div>
        <VerticalSection2D windowSpec={first.windowSpec} derived={first.derived} />
      </div>
      <div className="card p-4">
        <div className="text-sm font-semibold text-ink-50 mb-3">Horizontal Section</div>
        <div className="text-[10px] text-ink-400 mb-2">
          Cross-section at meeting rail level — exterior to interior.
        </div>
        <HorizontalSection2D windowSpec={first.windowSpec} derived={first.derived} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: 2D Elements (per window: Box + Upper Sash + Lower Sash)
// ═══════════════════════════════════════════════════════════════
function ElementsTab({ windowsData, projectId, batchId }) {
  return (
    <div className="space-y-8">
      {windowsData.map(({ win, windowSpec, derived }) => (
        <div key={win.id} className="space-y-4">
          <div className="flex items-center justify-between border-b border-surface-500 pb-2">
            <div className="text-sm font-bold text-ink-50">
              {win.name} — {win.width}×{win.height} mm
            </div>
            <Link to={`/projects/${projectId}/batches/${batchId}/windows/${win.id}`}
              className="text-[10px] text-accent-400 hover:text-accent-300 transition-colors">
              View Details →
            </Link>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs font-semibold text-ink-200 mb-2">Box Detail</div>
              {derived ? (
                <BoxDetail2D windowSpec={windowSpec} derived={derived} />
              ) : (
                <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
              )}
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-ink-200 mb-2">Upper Sash</div>
              {derived ? (
                <SashDetail2D windowSpec={windowSpec} derived={derived} type="upper" />
              ) : (
                <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
              )}
            </div>
            <div className="card p-4">
              <div className="text-xs font-semibold text-ink-200 mb-2">Lower Sash</div>
              {derived ? (
                <SashDetail2D windowSpec={windowSpec} derived={derived} type="lower" />
              ) : (
                <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Glass Schedule
// ═══════════════════════════════════════════════════════════════
function GlassTab({ merged, windowsData }) {
  if (!merged?.glass?.length) {
    return <div className="card p-8 text-center text-ink-400">No glass data available.</div>;
  }

  // Group identical glass panes
  const grouped = groupGlassItems(merged.glass);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500">
          <div className="text-sm font-semibold text-ink-50">Glass Order — All Windows</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/50">
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Qty</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Type</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Spacer</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Finish</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Makeup</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Windows</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g, i) => (
                <tr key={i} className="border-b border-surface-500/50">
                  <td className="px-4 py-2.5 text-ink-100 font-mono">{g.width} mm</td>
                  <td className="px-4 py-2.5 text-ink-100 font-mono">{g.height} mm</td>
                  <td className="px-4 py-2.5 text-right text-ink-100 font-semibold">{g.totalQty}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.type}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.spacer}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.finish}</td>
                  <td className="px-4 py-2.5 text-ink-300">{g.makeup || '—'}</td>
                  <td className="px-4 py-2.5 text-ink-400">{g.windows.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Glass drawings per window */}
      <div className="space-y-4">
        {windowsData.map(({ win, windowSpec, derived }) => (
          <div key={win.id} className="card p-4">
            <div className="text-sm font-semibold text-ink-50 mb-2">
              {win.name} — Glass Drawing
            </div>
            {derived ? (
              <GlassDrawing2D windowSpec={windowSpec} derived={derived} />
            ) : (
              <div className="text-xs text-ink-400 py-8 text-center">No data.</div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="card p-4">
        <div className="text-xs text-ink-400">
          Total panes: <strong className="text-ink-100">{grouped.reduce((s, g) => s + g.totalQty, 0)}</strong> across{' '}
          <strong className="text-ink-100">{grouped.length}</strong> unique sizes
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Pre-Cut List (per element, grouped by identical dimensions)
// ═══════════════════════════════════════════════════════════════
function PreCutTab({ merged, settings }) {
  if (!merged?.precut) {
    return <div className="card p-8 text-center text-ink-400">No pre-cut data available.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Sash Engineering */}
      {merged.precut.sashEngineering.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-500">
            <div className="text-sm font-semibold text-ink-50">Sash Engineering — Pre-Cut</div>
          </div>
          {merged.precut.sashEngineering.map((group) => (
            <div key={group.section}>
              <div className="px-4 py-2 bg-surface-700/50 border-b border-surface-500 text-xs font-medium text-ink-200">
                Section: {group.section}
              </div>
              <GroupedElementTable items={group.items} />
            </div>
          ))}
        </div>
      )}

      {/* Box Sapele */}
      {merged.precut.boxSapele.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-500">
            <div className="text-sm font-semibold text-ink-50">Box Sapele — Pre-Cut</div>
          </div>
          {merged.precut.boxSapele.map((group) => (
            <div key={group.preCutWidth}>
              <div className="px-4 py-2 bg-surface-700/50 border-b border-surface-500 text-xs font-medium text-ink-200">
                Pre-cut width: {group.preCutWidth} mm
              </div>
              <GroupedElementTable items={group.items} />
            </div>
          ))}
        </div>
      )}

      {/* Optimizer */}
      {merged.optimization?.sashEngineering?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-500">
            <div className="text-sm font-semibold text-ink-50">Bar Layout Optimizer</div>
          </div>
          <div className="p-4 space-y-4">
            {merged.optimization.sashEngineering.map((g) => (
              <div key={g.section}>
                <div className="text-xs font-medium text-ink-200 mb-2">Section: {g.section}</div>
                <BarVis bars={g.bars} stockLength={settings?.stockLengthSash || 5900} endTrim={settings?.endTrim || 10} />
                <div className="text-[10px] text-ink-400 mt-1">
                  Bars: {g.summary.totalBars} · Waste: {g.summary.wasteTotal} mm · Utilisation: {(g.summary.utilAvg * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Cut List (final, per element, grouped)
// ═══════════════════════════════════════════════════════════════
function CutListTab({ merged }) {
  if (!merged?.cutList?.length) {
    return <div className="card p-8 text-center text-ink-400">No cut list data available.</div>;
  }

  const grouped = groupCutListItems(merged.cutList);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-500">
        <div className="text-sm font-semibold text-ink-50">Cut List — All Windows (grouped by element)</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-500 bg-surface-700/50">
              <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Element</th>
              <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Section</th>
              <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Length</th>
              <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Qty</th>
              <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Material</th>
              <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Windows</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g, i) => (
              <tr key={i} className="border-b border-surface-500/50">
                <td className="px-4 py-2.5 text-ink-100 font-medium">{g.element}</td>
                <td className="px-4 py-2.5 text-ink-300">{g.section}</td>
                <td className="px-4 py-2.5 text-right text-ink-100 font-mono">{g.length} mm</td>
                <td className="px-4 py-2.5 text-right text-ink-100 font-semibold">{g.totalQty}</td>
                <td className="px-4 py-2.5 text-ink-300">{g.material}</td>
                <td className="px-4 py-2.5 text-ink-400">{g.windows.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-surface-500 text-xs text-ink-400">
        Total unique elements: {grouped.length} · Total pieces: {grouped.reduce((s, g) => s + g.totalQty, 0)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: BOM
// ═══════════════════════════════════════════════════════════════
function BOMTab({ merged, batch, windowsData }) {
  if (!merged) {
    return <div className="card p-8 text-center text-ink-400">No data available.</div>;
  }

  // Group hardware by item name
  const hardwareGrouped = groupHardwareItems(merged.hardware);

  return (
    <div className="space-y-4">
      {/* Timber summary from cut list */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500">
          <div className="text-sm font-semibold text-ink-50">Timber — Summary</div>
        </div>
        <TimberSummaryTable cutList={merged.cutList} />
      </div>

      {/* Hardware / Ironmongery */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500">
          <div className="text-sm font-semibold text-ink-50">Hardware & Ironmongery</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/50">
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Item</th>
                <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Detail</th>
                <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {hardwareGrouped.map((h, i) => (
                <tr key={i} className="border-b border-surface-500/50">
                  <td className="px-4 py-2.5 text-ink-100 font-medium">{h.item}</td>
                  <td className="px-4 py-2.5 text-ink-300">{h.detail}</td>
                  <td className="px-4 py-2.5 text-right text-ink-100 font-semibold">{h.totalQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Glass total */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500">
          <div className="text-sm font-semibold text-ink-50">Glass — Summary</div>
        </div>
        <div className="p-4 text-xs text-ink-300">
          Total panes: <strong className="text-ink-100">{merged.glass.reduce((s, g) => s + (g.quantity || 1), 0)}</strong> ·
          Type: <strong className="text-ink-100">{batch.defaults?.glassType || 'double'}</strong> ·
          Spacer: <strong className="text-ink-100">{batch.defaults?.spacerColor || 'black'}</strong>
          <span className="ml-4 text-ink-400">(See Glass Schedule tab for full breakdown)</span>
        </div>
      </div>

      {/* Consumables */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-ink-50 mb-3">Consumables (estimated)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-ink-400">
          <div className="flex justify-between p-2 bg-surface-600 rounded"><span>Glazing putty</span><span className="text-ink-200">{windowsData.length} sets</span></div>
          <div className="flex justify-between p-2 bg-surface-600 rounded"><span>Weather stripping</span><span className="text-ink-200">{windowsData.length} sets</span></div>
          <div className="flex justify-between p-2 bg-surface-600 rounded"><span>Staff beads</span><span className="text-ink-200">{windowsData.length} sets</span></div>
          <div className="flex justify-between p-2 bg-surface-600 rounded"><span>Parting beads</span><span className="text-ink-200">{windowsData.length} sets</span></div>
          <div className="flex justify-between p-2 bg-surface-600 rounded"><span>Screws / Fixings</span><span className="text-ink-200">As needed</span></div>
          <div className="flex justify-between p-2 bg-surface-600 rounded"><span>Adhesive / Glue</span><span className="text-ink-200">As needed</span></div>
        </div>
      </div>

      <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg text-xs text-accent-400">
        Full BOM with pricing — coming with Materials database integration.
      </div>
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
function GroupedElementTable({ items }) {
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = `${it.elementName}|${it.length}`;
      if (!map.has(key)) {
        map.set(key, { element: it.elementName, length: it.length, totalQty: 0, windows: [] });
      }
      const g = map.get(key);
      g.totalQty += it.quantity;
      if (it.windowName && !g.windows.includes(it.windowName)) g.windows.push(it.windowName);
    });
    return Array.from(map.values()).sort((a, b) => a.element.localeCompare(b.element));
  }, [items]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-500/50 bg-surface-700/30">
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Element</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Length</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Total Qty</th>
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Windows</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((g, i) => (
            <tr key={i} className="border-b border-surface-500/30">
              <td className="px-4 py-2 text-ink-100">{g.element}</td>
              <td className="px-4 py-2 text-right text-ink-100 font-mono">{g.length} mm</td>
              <td className="px-4 py-2 text-right text-ink-100 font-semibold">{g.totalQty}</td>
              <td className="px-4 py-2 text-ink-400">{g.windows.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Timber summary — group by material, sum total length */
function TimberSummaryTable({ cutList }) {
  const groups = useMemo(() => {
    const map = new Map();
    cutList.forEach((c) => {
      const key = `${c.material || 'Unknown'}|${c.section || ''}`;
      if (!map.has(key)) {
        map.set(key, { material: c.material || 'Unknown', section: c.section || '', totalLength: 0, totalPieces: 0 });
      }
      const g = map.get(key);
      g.totalLength += (c.length || 0) * (c.quantity || 1);
      g.totalPieces += c.quantity || 1;
    });
    return Array.from(map.values());
  }, [cutList]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-500 bg-surface-700/50">
            <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Material</th>
            <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Section</th>
            <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Pieces</th>
            <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Total Length</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={i} className="border-b border-surface-500/50">
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
      });
    }
    const g = map.get(key);
    g.totalQty += c.quantity || 1;
    if (c.windowName && !g.windows.includes(c.windowName)) g.windows.push(c.windowName);
  });
  return Array.from(map.values()).sort((a, b) => a.element.localeCompare(b.element) || a.length - b.length);
}

/** Group glass items by width+height+type+spacer+finish */
function groupGlassItems(glassList) {
  const map = new Map();
  glassList.forEach((g) => {
    const key = `${g.width}|${g.height}|${g.type}|${g.spacer}|${g.finish}`;
    if (!map.has(key)) {
      map.set(key, {
        width: g.width, height: g.height,
        type: g.type, spacer: g.spacer, finish: g.finish,
        makeup: g.makeup,
        totalQty: 0, windows: [],
      });
    }
    const entry = map.get(key);
    entry.totalQty += g.quantity || 1;
    if (g.windowName && !entry.windows.includes(g.windowName)) entry.windows.push(g.windowName);
  });
  return Array.from(map.values()).sort((a, b) => a.width - b.width || a.height - b.height);
}

/** Group hardware items by item+detail */
function groupHardwareItems(hwList) {
  const map = new Map();
  hwList.forEach((h) => {
    const key = `${h.item}|${h.detail}`;
    if (!map.has(key)) {
      map.set(key, { item: h.item, detail: h.detail, totalQty: 0 });
    }
    map.get(key).totalQty += h.quantity || 1;
  });
  return Array.from(map.values()).sort((a, b) => a.item.localeCompare(b.item));
}
