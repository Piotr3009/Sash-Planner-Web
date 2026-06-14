import { useEffect, useMemo, useRef } from 'react';
import Window3DCaptureRig from './viewer/Window3DCaptureRig.jsx';
import { normaliseToWindowSpec } from '../engine/specification.js';
import { exportEstimatePdf } from '../utils/estimatePdfExport.js';

// Orchestrates the estimate PDF: first captures an offscreen 3D render of each
// window (via Window3DCaptureRig — the same rig the Production Pack uses), then
// calls the PDF generator with those images. Mounted only while a PDF is being
// built; calls onDone() when finished (success or empty).
//
// props:
//   estimate — the estimate to export
//   opts     — { company, pdfSettings, settings, clientName }
//   onDone() — called after the PDF is generated (parent unmounts this)
export default function EstimatePdfBuilder({ estimate, opts = {}, onDone }) {
  const firedRef = useRef(false);

  const windows = useMemo(
    () => (estimate?.items || []).map((it) => ({
      id: it.id,
      windowSpec: normaliseToWindowSpec({
        ...(it.config || {}), width: it.config?.extWidth, height: it.config?.extHeight,
        name: it.windowName, id: it.id, quantity: 1,
      }),
    })),
    [estimate]
  );

  const finish = (results) => {
    if (firedRef.current) return;
    firedRef.current = true;
    const shots = {};
    (results || []).forEach((r) => { if (r && r.url) shots[r.id] = r.url; });
    try { exportEstimatePdf(estimate, { ...opts, screenshots: shots }); }
    finally { onDone && onDone(); }
  };

  // No windows → export straight away (no 3D to capture).
  useEffect(() => {
    if (windows.length === 0 && !firedRef.current) {
      firedRef.current = true;
      try { exportEstimatePdf(estimate, { ...opts, screenshots: {} }); }
      finally { onDone && onDone(); }
    }
  }, [windows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (windows.length === 0) return null;
  return <Window3DCaptureRig windows={windows} side="exterior" size={600} onComplete={finish} />;
}
