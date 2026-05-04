import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import WindowPreview3D from '../components/viewer/WindowPreview3D.jsx';
import TechnicalDrawing2D from '../components/viewer/TechnicalDrawing2D.jsx';
import CutListPanel from '../components/dashboard/CutListPanel.jsx';
import ExportControls from '../components/export/ExportControls.jsx';

const TABS = [
  { id: '3d', label: '3D Preview' },
  { id: '2d', label: '2D Drawing' },
  { id: 'cutlist', label: 'Cut List' },
  { id: 'export', label: 'Export' }
];

export default function WindowDetailPage() {
  const { estimateId, itemId } = useParams();
  const items = useProjectStore((s) => s.currentItems);
  const settings = useProjectStore((s) => s.settings);

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const spec = useMemo(() => (item ? parseSpecification(item.specification) : null), [item]);
  const windowSpec = useMemo(() => (item ? normaliseToWindowSpec(item, spec) : null), [item, spec]);
  const derived = useMemo(() => {
    if (!windowSpec) return null;
    try {
      return deriveWindowData(windowSpec, settings);
    } catch (e) {
      console.warn('Calculation failed:', e);
      return null;
    }
  }, [windowSpec, settings]);

  const [tab, setTab] = useState('3d');
  const [viewSide, setViewSide] = useState('exterior');

  if (!item) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link to={`/estimates/${estimateId}`} className="text-xs text-ink-400 hover:text-ink-600">← Back to estimate</Link>
        <div className="card p-8 mt-4 text-center text-ink-400">
          Window not found in current estimate. Open the estimate first to load it.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to={`/estimates/${estimateId}`} className="text-xs text-ink-400 hover:text-ink-600">← Back to estimate</Link>
      <div className="flex items-end justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {item.window_number || `Window ${item.id.slice(0, 6)}`}
          </h1>
          <p className="text-sm text-ink-600">
            {item.window_type || 'sash'} · {item.width}×{item.height} mm · qty {item.quantity || 1}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-ink-400 text-xs">Unit / Total</div>
          <div className="font-semibold">£{Number(item.unit_price || 0).toFixed(2)} · £{Number(item.total_price || 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="border-b border-ink-200 flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-accent-500 text-accent-600' : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {tab === '3d' && (
            <div className="card p-2">
              <div className="flex items-center justify-between p-2">
                <div className="text-sm font-medium">3D Preview</div>
                <div className="flex gap-1">
                  <button
                    className={`px-3 py-1 text-xs rounded ${viewSide === 'exterior' ? 'bg-accent-500 text-white' : 'bg-ink-100'}`}
                    onClick={() => setViewSide('exterior')}
                  >
                    Exterior
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded ${viewSide === 'interior' ? 'bg-accent-500 text-white' : 'bg-ink-100'}`}
                    onClick={() => setViewSide('interior')}
                  >
                    Interior
                  </button>
                </div>
              </div>
              <div className="aspect-[4/3] bg-gradient-to-br from-ink-50 to-ink-100 rounded-lg overflow-hidden">
                <WindowPreview3D windowSpec={windowSpec} side={viewSide} />
              </div>
            </div>
          )}
          {tab === '2d' && (
            <div className="card p-4">
              <div className="text-sm font-medium mb-3">Technical Drawing — Front Elevation</div>
              <TechnicalDrawing2D windowSpec={windowSpec} settings={settings} />
            </div>
          )}
          {tab === 'cutlist' && (
            <CutListPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} />
          )}
          {tab === 'export' && (
            <ExportControls item={item} windowSpec={windowSpec} settings={settings} derived={derived} />
          )}
        </div>

        <aside className="card p-5 space-y-4 self-start">
          <SpecSection title="Frame">
            <SpecRow label="Width" value={`${windowSpec?.frame.width} mm`} />
            <SpecRow label="Height" value={`${windowSpec?.frame.height} mm`} />
            <SpecRow label="Type" value={item.window_type || 'sash'} />
          </SpecSection>
          <SpecSection title="Sashes & Bars">
            <SpecRow label="Grid" value={windowSpec?.sash.grid.mode} />
            <SpecRow label="Upper bars" value={item.upper_bars || 'none'} />
            <SpecRow label="Lower bars" value={item.lower_bars || 'none'} />
            <SpecRow label="Horns" value={item.horns || 'none'} />
          </SpecSection>
          <SpecSection title="Glass">
            <SpecRow label="Type" value={item.glass_type || 'double'} />
            <SpecRow label="Spec" value={item.glass_spec} />
            <SpecRow label="Finish" value={item.glass_finish || 'clear'} />
            <SpecRow label="Spacer" value={item.spacer_color} />
          </SpecSection>
          <SpecSection title="Colour">
            <SpecRow label="Type" value={item.color_type} />
            <SpecRow label="Single" value={item.color_single} />
            <SpecRow label="Interior" value={item.color_interior} />
            <SpecRow label="Exterior" value={item.color_exterior} />
          </SpecSection>
          {derived && (
            <SpecSection title="Calculated">
              <SpecRow label="Sash W" value={`${derived.sashWidth} mm`} />
              <SpecRow label="Top sash H" value={`${derived.topSashHeight} mm`} />
              <SpecRow label="Bottom sash H" value={`${derived.bottomSashHeight} mm`} />
            </SpecSection>
          )}
        </aside>
      </div>
    </div>
  );
}

function SpecSection({ title, children }) {
  return (
    <div>
      <div className="label">{title}</div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function SpecRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-800 text-right truncate max-w-[60%]">{String(value)}</span>
    </div>
  );
}
