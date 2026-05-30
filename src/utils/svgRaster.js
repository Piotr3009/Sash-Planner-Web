/**
 * svgRaster.js
 *
 * Native (dependency-free) helpers for putting on-screen drawings into a PDF.
 *
 * svgNodeToPng: serialize a rendered inline <svg> DOM node → image data URL.
 *   The drawing components are styled for the DARK app theme (light lines on a
 *   dark background), which is unreadable on a white printed page. With
 *   { printMode: true } the serialized SVG's known dark-theme palette is remapped
 *   to a print palette (dark lines on white) BEFORE rasterizing, and the output
 *   is an opaque JPEG (white background, no alpha → no black-fill quirks in jsPDF).
 *   Colours come from fill=/stroke= attributes (no CSS vars), so the SVG is
 *   self-contained. Fully local — no network, no CORS.
 *
 * loadImageSize: read natural dimensions of an image (base64 or URL) for
 *   aspect-fit in the PDF.
 *
 * Both are async (image decode) and resolve to null on failure (never throw).
 */
import { COLORS } from '../components/drawings/drawingTheme.js';

// Dark-theme colour → print colour. Keys are the live theme values, so this
// stays in sync if drawingTheme colours change. Lines are darkened for contrast
// on white; dimension teal / label red / horn+notch amber read fine on white
// and are left untouched.
const PRINT_MAP = {
  [COLORS.bg]:      '#FFFFFF', // dark page bg → white (also neutralises CSS background)
  [COLORS.frame]:   '#334155', // light frame → dark slate
  [COLORS.sash]:    '#475569', // light sash (also title/subtitle) → dark
  [COLORS.bar]:     '#475569', // mid (also sillDetail/sectionFill) → darker
  [COLORS.section]: '#475569',
};

function applyPrintPalette(xml) {
  let out = xml;
  for (const [from, to] of Object.entries(PRINT_MAP)) {
    if (from && from !== to) out = out.split(from).join(to);
  }
  return out;
}

export function svgNodeToPng(svgEl, { scale = 3, bg = '#ffffff', printMode = false } = {}) {
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
      let xml = new XMLSerializer().serializeToString(clone);
      if (printMode) {
        xml = applyPrintPalette(xml); // darken light lines (hex attributes)
        // The SVG background is set via inline style (serialized as rgb(...)),
        // which the hex palette map cannot catch — force it white in any form.
        xml = xml.replace(/background\s*:\s*[^;"']+/gi, 'background:#ffffff');
      }
      const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          // opaque white background (always — guarantees no transparency → no black)
          ctx.fillStyle = bg || '#ffffff';
          ctx.fillRect(0, 0, outW, outH);
          ctx.drawImage(img, 0, 0, outW, outH);
          // JPEG = opaque, sidesteps jsPDF PNG-alpha rendering quirks
          const url = printMode
            ? canvas.toDataURL('image/jpeg', 0.92)
            : canvas.toDataURL('image/png');
          resolve({ url, w: outW, h: outH });
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
