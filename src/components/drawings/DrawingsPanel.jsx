/**
 * DrawingsPanel.jsx
 * Container for 2D technical drawings with sub-tabs.
 */
import { useState, useRef } from 'react';
import FrontElevation2D from './FrontElevation2D.jsx';
import BoxDetail2D from './BoxDetail2D.jsx';
import SashDetail2D from './SashDetail2D.jsx';
import SectionsUpload from './SectionsUpload.jsx';
import { useProjectStore } from '../../stores/projectStore.js';
import { exportElevationsPDF, exportElementsPDF } from '../../utils/drawingsPdfExport.js';
import { svgNodeToPng } from '../../utils/svgRaster.js';

const SUB_TABS = [
  { id: 'elevation', label: 'Front Elevation' },
  { id: 'box', label: 'Box Detail' },
  { id: 'upper', label: 'Upper Sash' },
  { id: 'lower', label: 'Lower Sash' },
  { id: 'vsection', label: '2D Sections' },
];

export default function DrawingsPanel({ item, windowSpec, settings, derived, batch }) {
  const [subTab, setSubTab] = useState('elevation');
  const [busy, setBusy] = useState(false);
  const refs = useRef({});

  const winW = item?.width || windowSpec?.frame?.width || '';
  const winH = item?.height || windowSpec?.frame?.height || '';

  // Capture the auto-generated SVG drawings → PDF (same technique as Production
  // Pack: querySelector('svg') → svgNodeToPng({ printMode }) → export util).
  const handleExportElevation = async () => {
    if (busy || !derived) return;
    setBusy(true);
    try {
      const svg = refs.current['elevation']?.querySelector('svg');
      const png = svg ? await svgNodeToPng(svg, { scale: 3, printMode: true }) : null;
      const company = useProjectStore.getState().settings.company || {};
      exportElevationsPDF({
        title: item?.name || batch?.name || 'Window',
        projects: batch?.projectNumber ? [batch.projectNumber] : [],
        date: new Date().toLocaleDateString('en-GB'),
        companyName: company.companyName || 'COMPANY NAME',
        companyAddress: company.companyAddress || '',
        logo: company.logo || '',
        items: [{ image: png?.url || null, w: png?.w, h: png?.h, no: 1, projectNum: batch?.projectNumber || '', name: item?.name || '', dims: `${winW}×${winH} mm` }],
      });
    } finally { setBusy(false); }
  };

  const handleExportElements = async () => {
    if (busy || !derived) return;
    setBusy(true);
    try {
      const types = [['box', 'Box Detail'], ['upper', 'Upper Sash'], ['lower', 'Lower Sash']];
      const drawings = [];
      for (const [t, label] of types) {
        const svg = refs.current[t]?.querySelector('svg');
        const png = svg ? await svgNodeToPng(svg, { scale: 3, printMode: true }) : null;
        drawings.push({ image: png?.url || null, w: png?.w, h: png?.h, label });
      }
      const company = useProjectStore.getState().settings.company || {};
      exportElementsPDF({
        title: item?.name || batch?.name || 'Window',
        projects: batch?.projectNumber ? [batch.projectNumber] : [],
        date: new Date().toLocaleDateString('en-GB'),
        companyName: company.companyName || 'COMPANY NAME',
        companyAddress: company.companyAddress || '',
        logo: company.logo || '',
        windows: [{ no: 1, caption: `${item?.name || ''} — ${winW}×${winH} mm`, drawings }],
      });
    } finally { setBusy(false); }
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              subTab === t.id
                ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium'
                : 'border-surface-500 text-ink-400 bg-surface-600 hover:bg-surface-500 hover:text-ink-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Drawing area */}
      {subTab === 'vsection' ? (
        <SectionsUpload item={item} batch={batch} />
      ) : (
        <div>
          <div className="flex items-center justify-end gap-2 mb-3">
            <button onClick={handleExportElevation} disabled={busy || !derived}
              className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              📄 Elevation PDF
            </button>
            <button onClick={handleExportElements} disabled={busy || !derived}
              className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              📄 Elements PDF
            </button>
          </div>
          <div className="card p-4 min-h-[400px]">
            {subTab === 'elevation' && (
              <FrontElevation2D windowSpec={windowSpec} derived={derived} />
            )}
            {subTab === 'box' && (
              <BoxDetail2D windowSpec={windowSpec} derived={derived} />
            )}
            {subTab === 'upper' && (
              <SashDetail2D windowSpec={windowSpec} derived={derived} type="upper" />
            )}
            {subTab === 'lower' && (
              <SashDetail2D windowSpec={windowSpec} derived={derived} type="lower" />
            )}
          </div>
        </div>
      )}

      {/* Hidden capture rig — always mounted off-screen so any drawing can be
          rasterised for PDF regardless of the active sub-tab. */}
      {derived && (
        <div aria-hidden="true" style={{ position: 'absolute', left: '-99999px', top: 0, width: '1200px' }}>
          <div ref={(el) => { refs.current['elevation'] = el; }}>
            <FrontElevation2D windowSpec={windowSpec} derived={derived} />
          </div>
          <div ref={(el) => { refs.current['box'] = el; }}>
            <BoxDetail2D windowSpec={windowSpec} derived={derived} />
          </div>
          <div ref={(el) => { refs.current['upper'] = el; }}>
            <SashDetail2D windowSpec={windowSpec} derived={derived} type="upper" />
          </div>
          <div ref={(el) => { refs.current['lower'] = el; }}>
            <SashDetail2D windowSpec={windowSpec} derived={derived} type="lower" />
          </div>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="card px-6 py-4 text-sm text-ink-100">Generating PDF…</div>
        </div>
      )}
    </div>
  );
}
