/**
 * ImageLightbox.jsx
 *
 * Shared click-to-enlarge image overlay. Render conditionally:
 *   {zoomSrc && <ImageLightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
 *
 * Closes on backdrop click, the × button, or Escape.
 * Fixed-position (z-[60]) so it can be mounted anywhere in the tree and sits
 * above other overlays.
 */
import { useEffect } from 'react';

export default function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface-700 border border-surface-500 text-ink-200 text-sm flex items-center justify-center hover:bg-surface-600"
        >×</button>
      </div>
    </div>
  );
}
