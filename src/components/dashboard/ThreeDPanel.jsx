/**
 * ThreeDPanel.jsx
 * Single-window 3D preview + PDF export — same capture technique as the
 * Production Pack ThreeDTab: an off-screen Window3DCaptureRig renders the model
 * at a fixed angle, captures the WebGL canvas, then exportThreeDPDF builds the PDF.
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import WindowPreview3D from '../viewer/WindowPreview3D.jsx';
import Window3DCaptureRig from '../viewer/Window3DCaptureRig.jsx';
import { exportThreeDPDF } from '../../utils/threeDPdfExport.js';
import { useProjectStore } from '../../stores/projectStore.js';

export default function ThreeDPanel({ item, windowSpec, batch, editUrl }) {
  const [capturing, setCapturing] = useState(false);

  const winW = item?.width || windowSpec?.frame?.width || '';
  const winH = item?.height || windowSpec?.frame?.height || '';

  // Header "Export PDF" triggers an off-screen, fixed-angle capture run.
  const handleExport = useCallback(() => {
    if (capturing || !windowSpec) return;
    setCapturing(true);
  }, [capturing, windowSpec]);

  // When the rig finishes: build the PDF, then unmount the rig.
  const handleComplete = useCallback((results) => {
    const company = useProjectStore.getState().settings.company || {};
    const url = results?.[0]?.url || null;
    setCapturing(false);
    exportThreeDPDF({
      title: item?.name || batch?.name || 'Window',
      projects: batch?.projectNumber ? [batch.projectNumber] : [],
      date: new Date().toLocaleDateString('en-GB'),
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      items: [{ image: url, no: 1, projectNum: batch?.projectNumber || '', name: item?.name || '', dims: `${winW}×${winH} mm` }],
    });
  }, [item, batch, winW, winH]);

  return (
    <div className="card p-2">
      <div className="flex items-center justify-between p-2">
        <div className="text-sm font-medium text-ink-50">3D Preview</div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={capturing}
            className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            📄 Export PDF
          </button>
          {editUrl && (
            <Link to={editUrl} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
              ✏️ Edit
            </Link>
          )}
        </div>
      </div>
      <div className="aspect-[4/3] bg-gradient-to-br from-surface-600 to-surface-700 rounded-lg overflow-hidden">
        <WindowPreview3D windowSpec={windowSpec} side="exterior" />
      </div>

      {capturing && (
        <>
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
            <div className="card px-6 py-4 text-sm text-ink-100">Generating 3D PDF…</div>
          </div>
          <Window3DCaptureRig windows={[{ id: item?.id || 'win', windowSpec }]} side="exterior" onComplete={handleComplete} />
        </>
      )}
    </div>
  );
}
