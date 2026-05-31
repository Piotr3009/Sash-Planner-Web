/**
 * SectionsUpload.jsx
 * Single-window 2D sections — upload-based, identical to the Production Pack
 * SectionsTab. Shares the SAME localStorage pool ('pc-section-images') as the
 * Production Pack, so sections uploaded in either place appear in both.
 * Export = exportSectionsPDF (separate PDF, same as PP).
 */
import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore.js';
import { exportSectionsPDF } from '../../utils/drawingsPdfExport.js';
import { loadImageSize } from '../../utils/svgRaster.js';

export default function SectionsUpload({ item, batch }) {
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
    exportSectionsPDF({
      title: item?.name || item?.window_number || batch?.name || 'Window',
      projects: batch?.projectNumber ? [batch.projectNumber] : [],
      date: new Date().toLocaleDateString('en-GB'),
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      items,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-50">2D Sections</div>
        <button onClick={handleExport} disabled={!sectionImages.length}
          className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          📄 Export PDF
        </button>
      </div>

      {/* Containers grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sectionImages.map((sec) => (
          <div key={sec.id} className="card overflow-hidden relative group">
            <div className="px-4 py-2 border-b border-surface-500 flex items-center justify-between bg-surface-800">
              <span className="text-xs font-medium text-ink-200 truncate">{sec.label || 'Section'}</span>
              <button onClick={() => handleRemoveImage(sec.id)}
                className="w-5 h-5 rounded flex items-center justify-center text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all text-xs">×</button>
            </div>
            <div className="p-3 flex items-center justify-center cursor-zoom-in" onClick={() => setZoomedImg(sec.src)}>
              <img src={sec.src} alt={sec.label} className="max-w-full max-h-[400px] rounded" />
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
          Upload section drawings or detail images. Shared with the Production Pack sections.
        </div>
      )}

      {/* Zoom modal */}
      {zoomedImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} alt="Zoomed" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
