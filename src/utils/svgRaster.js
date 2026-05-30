/**
 * svgRaster.js
 *
 * Native (dependency-free) helpers for putting on-screen drawings into a PDF.
 *
 * svgNodeToPng: serialize a rendered inline <svg> DOM node → PNG data URL.
 *   The drawing components style colours via fill=/stroke= attributes (no CSS
 *   vars), so the serialized SVG is self-contained and rasterizes faithfully.
 *   A white background is painted first (SVG element background is CSS-only and
 *   would otherwise be transparent). Fully local — no network, no CORS.
 *
 * loadImageSize: read natural dimensions of an image (base64 or URL) for
 *   aspect-fit in the PDF.
 *
 * Both are async (image decode) and resolve to null on failure (never throw).
 */

export function svgNodeToPng(svgEl, { scale = 2, bg = '#ffffff' } = {}) {
  return new Promise((resolve) => {
    if (!svgEl) { resolve(null); return; }
    try {
      const rect = svgEl.getBoundingClientRect();
      let w = rect.width;
      let h = rect.height;
      if (!w || !h) {
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        w = (vb && vb.width) || 600;
        h = (vb && vb.height) || 400;
      }
      const outW = Math.max(1, Math.round(w * scale));
      const outH = Math.max(1, Math.round(h * scale));

      const clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', w);
      clone.setAttribute('height', h);
      const xml = new XMLSerializer().serializeToString(clone);
      const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, outW, outH); }
          ctx.drawImage(img, 0, 0, outW, outH);
          resolve({ url: canvas.toDataURL('image/png'), w: outW, h: outH });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = svg64;
    } catch (e) {
      resolve(null);
    }
  });
}

export function loadImageSize(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
