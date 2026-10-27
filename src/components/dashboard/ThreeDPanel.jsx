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

export default function ThreeDPanel({ item, windowSpec, batch, editUrl, derived = null }) {
  const [capturing, setCapturing] = useState(false);

  const winW = item?.width || windowSpec?.frame?.width || '';
  const winH = item?.height || windowSpec?.frame?.height || '';
  // Partition walls (25.10.2026): no 3D model yet, the preview shows a note and the PDF button is off.
  const isPartition = (windowSpec?.category || 'sash') === 'partition';
  // Fire doors v1 (27.10.2026): the 3D draws the door set; the leaf open angle
  // (degrees, 0 to 90, default 30) is the page's control, used by the preview
  // and the PDF capture alike.
  const isFireDoor = (windowSpec?.category || 'sash') === 'firedoor';
  const [openAngle, setOpenAngle] = useState(30);

  // Header "Export PDF" triggers an off-screen, fixed-angle capture run.
  const handleExport = useCallback(() => {
    if (capturing || !windowSpec || isPartition) return;
    setCapturing(true);
  }, [capturing, windowSpec, isPartition]);

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
          {isFireDoor && (
            <label className="flex items-center gap-2 text-xs text-ink-300" title="Leaf open angle, 0 to 90 degrees">
              <span>Open</span>
              <input type="range" min={0} max={90} step={1} value={openAngle}
                onChange={(e) => setOpenAngle(Number(e.target.value))}
                className="w-24 accent-accent-500" aria-label="Leaf open angle" />
              <span className="w-10 tabular-nums text-ink-200">{openAngle} deg</span>
            </label>
          )}
          <button onClick={handleExport} disabled={capturing || isPartition}
            title={isPartition ? '3D preview is not available for partition walls yet' : undefined}
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
        <WindowPreview3D windowSpec={windowSpec} side="exterior" derived={derived} openAngle={isFireDoor ? openAngle : null} />
      </div>

      {capturing && (
        <>
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
            <div className="card px-6 py-4 text-sm text-ink-100">Generating 3D PDF…</div>
          </div>
          <Window3DCaptureRig windows={[{ id: item?.id || 'win', windowSpec, derived, fireDoorOpen: isFireDoor ? openAngle : null }]} side="exterior" onComplete={handleComplete} />
        </>
      )}
    </div>
  );
}
