import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import WindowPreview3D from '../components/viewer/WindowPreview3D.jsx';
import DrawingsPanel from '../components/drawings/DrawingsPanel.jsx';
import CutListPanel from '../components/dashboard/CutListPanel.jsx';
import ExportControls from '../components/export/ExportControls.jsx';


const TABS = [
  { id: '3d', label: '3D Preview', icon: '🧊' },
  { id: '2d', label: '2D Drawings', icon: '📐' },
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
    try { return deriveWindowData(windowSpec, settings); }
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
            <div className="card p-2">
              <div className="flex items-center justify-between p-2">
                <div className="text-sm font-medium text-ink-50">3D Preview</div>
                <Link to={editUrl} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
                  ✏️ Edit
                </Link>
              </div>
              <div className="aspect-[4/3] bg-gradient-to-br from-surface-600 to-surface-700 rounded-lg overflow-hidden">
                <WindowPreview3D windowSpec={windowSpec} side="exterior" />
              </div>
            </div>
          )}

          {tab === '2d' && (
            <DrawingsPanel windowSpec={windowSpec} settings={settings} derived={derived} />
          )}

          {tab === 'cutlist' && (
            <div>
              <CutListPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} />
            </div>
          )}

          {tab === 'glass' && (
            <GlassPanel windowSpec={windowSpec} derived={derived} />
          )}

          {tab === 'bom' && (
            <BOMPanel item={item} windowSpec={windowSpec} derived={derived} />
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

// ─── Glass Panel (placeholder with schedule) ───
function GlassPanel({ windowSpec, derived }) {
  if (!derived?.glazingItems?.length) {
    return <div className="card p-8 text-center text-ink-400">No glass data.</div>;
  }
  const g = derived.glazingItems[0];
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-ink-50 mb-4">Glass Schedule</div>
      <div className="bg-surface-600 rounded-lg border border-surface-500 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-500">
              <th className="px-4 py-2 text-left text-ink-400 font-medium">Pane</th>
              <th className="px-4 py-2 text-right text-ink-400 font-medium">Width</th>
              <th className="px-4 py-2 text-right text-ink-400 font-medium">Height</th>
              <th className="px-4 py-2 text-right text-ink-400 font-medium">Qty</th>
              <th className="px-4 py-2 text-left text-ink-400 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {g.panes?.map((p, i) => (
              <tr key={i} className="border-b border-surface-500/50">
                <td className="px-4 py-2 text-ink-100">{p.label || `Pane ${i + 1}`}</td>
                <td className="px-4 py-2 text-right text-ink-200">{p.width} mm</td>
                <td className="px-4 py-2 text-right text-ink-200">{p.height} mm</td>
                <td className="px-4 py-2 text-right text-ink-200">{p.quantity || 1}</td>
                <td className="px-4 py-2 text-ink-400">{windowSpec?.glazing.type} / {windowSpec?.glazing.spec}</td>
              </tr>
            )) || (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-ink-400">Glass data format not yet supported for detailed schedule. Check Export tab.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[10px] text-ink-400">
        Glass drawing with pane positions coming soon.
      </div>
    </div>
  );
}

// ─── BOM Panel ───
function BOMPanel({ item, windowSpec, derived }) {
  const w = derived?.weights;
  const p = derived?.paint;
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-ink-50 mb-4">Bill of Materials</div>
      <div className="space-y-3">
        <BOMGroup title="Timber" items={derived?.components?.box || []} />
        <BOMGroup title="Sash Components" items={derived?.components?.sash || []} />
        <BOMGroup title="Beading" items={derived?.components?.beading || []} unit="m" />

        {/* Weights */}
        {w && (
          <div className="bg-surface-600 rounded-lg border border-surface-500 p-4">
            <div className="text-xs font-medium text-ink-200 mb-2">Weights</div>
            <div className="space-y-1 text-xs text-ink-400">
              <div className="flex justify-between"><span>Timber (both sashes)</span><span className="text-ink-200">{w.timber} kg</span></div>
              <div className="flex justify-between"><span>Glass ({w.glassType}, {w.kgPerSqm} kg/m²)</span><span className="text-ink-200">{w.glass} kg</span></div>
              <div className="flex justify-between border-t border-surface-500/50 pt-1 mt-1">
                <span className="text-ink-100 font-medium">Total (+5%)</span>
                <span className="text-ink-100 font-semibold">{w.total} kg</span>
              </div>
            </div>
          </div>
        )}

        {/* Paint */}
        {p && (
          <div className="bg-surface-600 rounded-lg border border-surface-500 p-4">
            <div className="text-xs font-medium text-ink-200 mb-2">Paint — {p.areaSqm} m²</div>
            <div className="space-y-1 text-xs text-ink-400">
              <div className="flex justify-between"><span>Primer</span><span className="text-ink-200">{p.primer} L</span></div>
              <div className="flex justify-between"><span>Topcoat (White 9016 or Bespoke)</span><span className="text-ink-200">{p.topcoat} L</span></div>
            </div>
          </div>
        )}

        <div className="bg-surface-600 rounded-lg border border-surface-500 p-4">
          <div className="text-xs font-medium text-ink-200 mb-2">Hardware & Consumables</div>
          <div className="space-y-1 text-xs text-ink-400">
            <div className="flex justify-between"><span>Sash weights</span><span>2 pcs</span></div>
            <div className="flex justify-between"><span>Sash cords</span><span>2 pcs</span></div>
            <div className="flex justify-between"><span>Pulleys</span><span>2 pcs</span></div>
            <div className="flex justify-between"><span>Sash lock ({windowSpec?.hardware.finish})</span><span>1 pc</span></div>
            <div className="flex justify-between"><span>Sash lifts ({windowSpec?.hardware.finish})</span><span>2 pcs</span></div>
            <div className="flex justify-between"><span>Weather stripping</span><span>Set</span></div>
            <div className="flex justify-between"><span>Glazing putty</span><span>As needed</span></div>
          </div>
        </div>
      </div>
      <div className="mt-4 p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg text-xs text-accent-400">
        Full BOM with quantities and pricing — coming with Materials database integration.
      </div>
    </div>
  );
}

function BOMGroup({ title, items, unit = 'mm' }) {
  if (!items.length) return null;
  const isMeters = unit === 'm';
  return (
    <div className="bg-surface-600 rounded-lg border border-surface-500 overflow-hidden">
      <div className="px-4 py-2 border-b border-surface-500 text-xs font-medium text-ink-200">{title}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-500/50">
            <th className="px-4 py-1.5 text-left text-ink-400">Element</th>
            <th className="px-4 py-1.5 text-left text-ink-400">Section</th>
            <th className="px-4 py-1.5 text-right text-ink-400">Length</th>
            <th className="px-4 py-1.5 text-right text-ink-400">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, i) => (
            <tr key={i} className="border-b border-surface-500/30">
              <td className="px-4 py-1.5 text-ink-100">{c.elementName}</td>
              <td className="px-4 py-1.5 text-ink-300">{c.section}</td>
              <td className="px-4 py-1.5 text-right text-ink-200">{isMeters ? (c.length / 1000).toFixed(2) : c.length} {unit}</td>
              <td className="px-4 py-1.5 text-right text-ink-200">{c.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
