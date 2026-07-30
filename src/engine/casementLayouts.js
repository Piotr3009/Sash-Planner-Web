/**
 * casementLayouts.js
 * Canonical casement layout definitions — single source of truth for the
 * calculation engine (derive), 3D preview, 2D drawings and the configurator
 * layout picker.
 *
 * Ported 1:1 from Prime-Sash-Windows (PSW):
 *   - geometry:  js/estimate-renderer.js -> EstimateRenderer.casementLayoutDef()
 *   - metadata:  js/casement-controller.js (LAYOUT_DEFAULTS, FANLIGHT/FAN2/TRIPLE)
 *                js/casement-type-modal.js (HIDDEN_DUPLICATES, DISPLAY_NAMES)
 *   - overlay:   3d-src/src/components/casement/CasementWindow.jsx (roles + hinges)
 *
 * HARD RULE — PSW import/export compatibility:
 *   Layout codes AND the panel order inside every definition must stay
 *   identical with PSW. `casementHinges` arrays are index-aligned to
 *   def.panels order — reordering panels silently corrupts imported
 *   estimates. Never "improve" geometry here without changing PSW in the
 *   same session and bumping CASEMENT_LAYOUTS_VERSION.
 *
 * Intentional, import-safe difference vs PSW:
 *   geometry constants are parameters (`geo`) with PSW defaults instead of
 *   hardcoded values, so per-workshop casement profiles can supply their own
 *   faces later. Formulas and panel order are untouched.
 */

export const CASEMENT_LAYOUTS_VERSION = 1;

// PSW hardcodes: FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68
export const CASEMENT_GEO_DEFAULTS = Object.freeze({
  frameFace: 57,
  bottomFace: 68,
  mullionW: 68,
});

// Fanlight tier height clamp — PSW: 15%..50% of inner height
export const FAN_RATIO_MIN = 0.15;
export const FAN_RATIO_MAX = 0.5;

/** Convert a fanlight height in mm to the clamped ratio the defs consume.
 *  Falsy mm falls back to the PSW default of 30% inner height. */
export function clampFanRatio(fanMm, innerH) {
  const mm = Number(fanMm) || innerH * 0.3;
  return Math.max(FAN_RATIO_MIN, Math.min(FAN_RATIO_MAX, mm / innerH));
}

/** Inner (glass-area) dimensions from overall frame dimensions. */
export function casementInnerDims(frameWidth, frameHeight, geo = CASEMENT_GEO_DEFAULTS) {
  return {
    innerW: frameWidth - 2 * geo.frameFace,
    innerH: frameHeight - geo.frameFace - geo.bottomFace,
  };
}

// Default overall dimensions per layout — PSW js/casement-controller.js
export const LAYOUT_DEFAULTS = Object.freeze({
  '010':  { w: 600,  h: 1000 },
  '010T': { w: 1000, h: 1200 },
  '040L': { w: 600,  h: 1200 },
  '040R': { w: 600,  h: 1200 },
  '040D': { w: 1200, h: 1200 },
  '120':  { w: 1200, h: 1200 },
  '051L': { w: 1200, h: 1200 },
  '051R': { w: 1200, h: 1200 },
  '052L': { w: 1200, h: 1500 },
  '052R': { w: 1200, h: 1500 },
  '022':  { w: 1200, h: 1500 },
  '180L': { w: 1500, h: 1200 },
  '180R': { w: 1500, h: 1200 },
  '021':  { w: 800,  h: 1400 },
  '021L': { w: 800,  h: 1400 },
  '021R': { w: 800,  h: 1400 },
  '031':  { w: 1200, h: 1400 },
  '031L': { w: 1200, h: 1400 },
  '031R': { w: 1200, h: 1400 },
  '032':  { w: 1200, h: 1400 },
  '130':  { w: 1800, h: 1200 },
  '131':  { w: 1800, h: 1500 },
  '132':  { w: 1800, h: 1500 },
  '133':  { w: 1800, h: 1500 },
  '013':  { w: 700,  h: 2400 },
  '023':  { w: 1300, h: 2400 },
  '140L': { w: 2400, h: 1200 },
  '140R': { w: 2400, h: 1200 },
});

// Layouts with a top fanlight tier — PSW js/casement-controller.js.
// NOTE (PSW quirk kept 1:1): 021L/021R/031L/031R DO have a fanlight
// geometrically but are absent here, exactly as in PSW where this list
// only drives UI visibility for picker-selectable codes.
export const FANLIGHT_LAYOUTS = Object.freeze([
  '021', '031', '032', '052L', '052R', '022', '131', '132', '133', '013', '023',
]);

// 3-tier layouts with a second (bottom) fanlight tier
export const FAN2_LAYOUTS = Object.freeze(['013', '023']);

// Triple-light layouts supporting a custom middle section width
export const TRIPLE_LAYOUTS = Object.freeze(['130', '131', '132', '133']);

// Structural duplicates hidden in the picker: identical panel geometry,
// only the default opening differed — opening is now chosen per pane.
// Codes stay fully valid engine-side (old PSW estimates, pricing, imports).
export const HIDDEN_DUPLICATES = Object.freeze({
  '051L': 1, '051R': 1, '021L': 1, '021R': 1,
  '031L': 1, '031R': 1, '040R': 1, '140R': 1,
});

// Friendly picker names — PSW js/casement-type-modal.js
export const DISPLAY_NAMES = Object.freeze({
  '040L': 'Single', '010T': 'Single Top-Hung', '040D': '2 Lights',
  '021': '1 Light + Fanlight', '022': '2 Lights + Fanlights',
  '052L': '2 Lights + Fan Left', '052R': '2 Lights + Fan Right',
  '133': '3 Lights + Fanlights',
  '013': 'Single — 3 Tier', '023': '2 Lights — 3 Tier',
  '140L': '4 Lights',
});

export const CASEMENT_LAYOUT_CODES = Object.freeze(Object.keys(LAYOUT_DEFAULTS));

export function isCasementLayoutCode(code) {
  return CASEMENT_LAYOUT_CODES.includes(code);
}

/**
 * Canonical layout geometry — ported verbatim from PSW.
 * Returns { panels: [{ x, y, w, h, hinge }], mullions?: [], transoms?: [] }.
 * Panels are centred on the glass area (x, y from centre); mullion x is
 * measured from the frame outside edge; transom y from the frame bottom.
 * `height` is the OVERALL frame height (used by partial mullions in 031*).
 */
export function casementLayoutDef(
  code, innerW, innerH, height, fanlightRatio, fan2Ratio,
  middleSectionMm = 0, geo = CASEMENT_GEO_DEFAULTS
) {
  const FRAME_FACE = geo.frameFace, BOTTOM_FACE = geo.bottomFace, MULLION_W = geo.mullionW;

  const half = innerW / 2;
  const third = innerW / 3;
  const mullW = MULLION_W;
  const FR = fanlightRatio || 0.3;
  const FR2 = fan2Ratio || 0.3;
  void half; void third; // parity with PSW source (unused there as well)

  switch (code) {
    // ─── SINGLE PANELS ───
    case '040L':
    case '010':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'right' }],
      };
    case '040R':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
      };
    case '010T':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'top' }],
      };
    case '040D': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── DOUBLE SIDE-BY-SIDE ───
    case '120': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }
    case '051L': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed' },
        ],
      };
    }
    case '051R': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 052L: Mullion full + transom LEFT only (top-hung vent left) ───
    case '052L': {
      const panelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + panelW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [mullX],
        transoms: [{ y: transomY, width: panelW, offsetX: -(panelW + mullW) / 2 }],
        panels: [
          { x: -(panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: -(panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 052R: Mullion full + transom RIGHT only (top-hung vent right) ───
    case '052R': {
      const panelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + panelW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [mullX],
        transoms: [{ y: transomY, width: panelW, offsetX: (panelW + mullW) / 2 }],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x:  (panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'right' },
        ],
      };
    }
    case '180L': {
      const openW = innerW * 0.4;
      const fixedW = innerW - mullW - openW;
      return {
        mullions: [FRAME_FACE + openW + mullW / 2],
        panels: [
          { x: -(fixedW + mullW) / 2, y: 0, w: openW, h: innerH, hinge: 'left' },
          { x:  (openW + mullW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
        ],
      };
    }
    case '180R': {
      const openW = innerW * 0.4;
      const fixedW = innerW - mullW - openW;
      return {
        mullions: [FRAME_FACE + fixedW + mullW / 2],
        panels: [
          { x: -(openW + mullW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
          { x:  (fixedW + mullW) / 2, y: 0, w: openW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── WITH FANLIGHT (top-hung top + side-hung bottom) ───
    case '022': {
      const panelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + panelW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [mullX],
        transoms: [
          { y: transomY, width: panelW, offsetX: -(panelW + mullW) / 2 },
          { y: transomY, width: panelW, offsetX: (panelW + mullW) / 2 },
        ],
        panels: [
          { x: -(panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: (panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: -(panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'fixed' },
          { x: (panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'fixed' },
        ],
      };
    }
    case '133': {
      // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
      const eqW = (innerW - mullW * 2) / 3;
      const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
      const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
      const off = panelC / 2 + mullW + panelS / 2;
      const m1 = FRAME_FACE + panelS + mullW / 2;
      const m2 = m1 + panelC + mullW;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [m1, m2],
        transoms: [
          { y: transomY, width: panelS, offsetX: -off },
          { y: transomY, width: panelC, offsetX: 0 },
          { y: transomY, width: panelS, offsetX: off },
        ],
        panels: [
          { x: -off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
          { x: 0,                 y: (bottomH + MULLION_W) / 2, w: panelC, h: topH, hinge: 'top' },
          { x:  off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
          { x: -off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'fixed' },
          { x: 0,                 y: -(topH + MULLION_W) / 2, w: panelC, h: bottomH, hinge: 'fixed' },
          { x:  off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'fixed' },
        ],
      };
    }
    case '013': {
      const topH = innerH * FR;
      const botH = innerH * FR2;
      const midH = innerH - topH - botH - MULLION_W * 2;
      const t1Y = BOTTOM_FACE + botH + MULLION_W + midH + MULLION_W / 2;
      const t2Y = BOTTOM_FACE + botH + MULLION_W / 2;
      return {
        mullions: [],
        transoms: [t1Y, t2Y],
        panels: [
          { x: 0, y: (innerH - topH) / 2, w: innerW, h: topH, hinge: 'top' },
          { x: 0, y: -innerH / 2 + botH + MULLION_W + midH / 2, w: innerW, h: midH, hinge: 'left' },
          { x: 0, y: -(innerH - botH) / 2, w: innerW, h: botH, hinge: 'fixed' },
        ],
      };
    }
    case '023': {
      const panelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + panelW + mullW / 2;
      const topH = innerH * FR;
      const botH = innerH * FR2;
      const midH = innerH - topH - botH - MULLION_W * 2;
      const t1Y = BOTTOM_FACE + botH + MULLION_W + midH + MULLION_W / 2;
      const t2Y = BOTTOM_FACE + botH + MULLION_W / 2;
      const xL = -(panelW + mullW) / 2, xR = (panelW + mullW) / 2;
      return {
        mullions: [mullX],
        transoms: [
          { y: t1Y, width: panelW, offsetX: xL }, { y: t1Y, width: panelW, offsetX: xR },
          { y: t2Y, width: panelW, offsetX: xL }, { y: t2Y, width: panelW, offsetX: xR },
        ],
        panels: [
          { x: xL, y: (innerH - topH) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: xR, y: (innerH - topH) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: xL, y: -innerH / 2 + botH + MULLION_W + midH / 2, w: panelW, h: midH, hinge: 'left' },
          { x: xR, y: -innerH / 2 + botH + MULLION_W + midH / 2, w: panelW, h: midH, hinge: 'right' },
          { x: xL, y: -(innerH - botH) / 2, w: panelW, h: botH, hinge: 'fixed' },
          { x: xR, y: -(innerH - botH) / 2, w: panelW, h: botH, hinge: 'fixed' },
        ],
      };
    }
    case '021': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'fixed' },
        ],
      };
    }
    case '021L': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
        ],
      };
    }
    case '021R': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
        ],
      };
    }
    case '031': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + topPanelW + mullW / 2;
      const mullStartY = transomY + MULLION_W / 2;
      const mullEndY = height;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'fixed' },
        ],
      };
    }
    case '031L': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + topPanelW + mullW / 2;
      const mullStartY = transomY + MULLION_W / 2;
      const mullEndY = height;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
        ],
      };
    }
    case '031R': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + topPanelW + mullW / 2;
      const mullStartY = transomY + MULLION_W / 2;
      const mullEndY = height;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
        ],
      };
    }

    // ─── 032: Transom full width + mullion ONLY below transom ───
    case '032': {
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      const bottomPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + bottomPanelW + mullW / 2;
      const mullEndY = transomY - MULLION_W / 2;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: 0, endY: mullEndY, touchesBottom: true, touchesTop: false }],
        panels: [
          { x: 0, y: (bottomH + MULLION_W) / 2, w: innerW, h: topH, hinge: 'top' },
          { x: -(bottomPanelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: bottomPanelW, h: bottomH, hinge: 'left' },
          { x:  (bottomPanelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: bottomPanelW, h: bottomH, hinge: 'right' },
        ],
      };
    }

    // ─── TRIPLE ───
    case '130': {
      // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
      const eqW = (innerW - mullW * 2) / 3;
      const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
      const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
      const off = panelC / 2 + mullW + panelS / 2;
      const m1 = FRAME_FACE + panelS + mullW / 2;
      const m2 = m1 + panelC + mullW;
      return {
        mullions: [m1, m2],
        panels: [
          { x: -off, y: 0, w: panelS, h: innerH, hinge: 'left' },
          { x: 0,                 y: 0, w: panelC, h: innerH, hinge: 'fixed' },
          { x:  off, y: 0, w: panelS, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 140L: Quad — left opens, rest fixed ───
    case '140L': {
      const panelW = (innerW - mullW * 3) / 4;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      const m3 = FRAME_FACE + panelW * 3 + mullW * 2 + mullW / 2;
      return {
        mullions: [m1, m2, m3],
        panels: [
          { x: -(1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x: -(0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
        ],
      };
    }

    // ─── 140R: Quad — right opens, rest fixed ───
    case '140R': {
      const panelW = (innerW - mullW * 3) / 4;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      const m3 = FRAME_FACE + panelW * 3 + mullW * 2 + mullW / 2;
      return {
        mullions: [m1, m2, m3],
        panels: [
          { x: -(1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x: -(0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 131: Triple + transom ONLY in center ───
    case '131': {
      // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
      const eqW = (innerW - mullW * 2) / 3;
      const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
      const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
      const off = panelC / 2 + mullW + panelS / 2;
      const m1 = FRAME_FACE + panelS + mullW / 2;
      const m2 = m1 + panelC + mullW;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [m1, m2],
        transoms: [{ y: transomY, width: panelC }],
        panels: [
          { x: -off, y: 0, w: panelS, h: innerH, hinge: 'left' },
          { x: 0, y: (bottomH + MULLION_W) / 2, w: panelC, h: topH, hinge: 'top' },
          { x: 0, y: -(topH + MULLION_W) / 2, w: panelC, h: bottomH, hinge: 'fixed' },
          { x:  off, y: 0, w: panelS, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 132: Triple + transom full width ───
    case '132': {
      // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
      const eqW = (innerW - mullW * 2) / 3;
      const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
      const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
      const off = panelC / 2 + mullW + panelS / 2;
      const m1 = FRAME_FACE + panelS + mullW / 2;
      const m2 = m1 + panelC + mullW;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [m1, m2],
        transoms: [
          { y: transomY, width: panelS, offsetX: -off },  // left transom
          { y: transomY, width: panelS, offsetX: off },   // right transom
        ],
        panels: [
          { x: -off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
          { x: 0,                 y: 0, w: panelC, h: innerH, hinge: 'fixed' },
          { x:  off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
          { x: -off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'left' },
          { x:  off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'right' },
        ],
      };
    }

    // Default: single left
    default:
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
      };
  }
}

// ─── Opener overlay + panel roles (PSW 3D CasementWindow.jsx, verbatim semantics) ───

// Legacy 022 estimates stored booleans; true maps positionally to:
const H022 = ['top', 'top', 'left', 'right'];
const VALID_HINGES = ['fixed', 'left', 'right', 'top'];

/**
 * Panel roles from the ORIGINAL hinge (before the opener overlay) — height
 * heuristics break on 3-tier layouts where the middle pane can be under 50%
 * of innerH. Role drives per-zone glazing bars: 'fan' | 'fan2' | 'main'.
 * Mutates and returns def (defs are fresh per casementLayoutDef call).
 */
export function assignPanelRoles(def, code) {
  if (!def || !def.panels) return def;
  def.panels = def.panels.map((p) => ({
    ...p,
    _role: p.hinge === 'top' ? 'fan' : (FAN2_LAYOUTS.includes(code) && p.hinge === 'fixed' ? 'fan2' : 'main'),
  }));
  return def;
}

/**
 * Clickable openers overlay — casementHinges[i] = 'fixed'|'left'|'right'|'top',
 * index-aligned to def.panels order. Legacy booleans supported:
 * true -> H022[i] for '022', otherwise the panel's own default hinge;
 * false -> 'fixed'. Invalid entries leave the panel's default hinge intact.
 * Mutates and returns def.
 */
export function applyCasementHinges(def, casementHinges, code) {
  if (!Array.isArray(casementHinges) || !def || !def.panels) return def;
  const norm = casementHinges.map((v, i) => {
    if (v === true) return code === '022' ? H022[i] : (def.panels[i] ? def.panels[i].hinge : 'fixed');
    if (v === false) return 'fixed';
    return v;
  });
  def.panels = def.panels.map((p, i) => {
    const h = norm[i];
    return VALID_HINGES.includes(h) ? { ...p, hinge: h } : p;
  });
  return def;
}

/**
 * Recommended consumer entry point. Guarantees the correct sequence:
 * geometry -> roles (from original hinges) -> opener overlay.
 */
export function resolveCasementLayout({
  code, innerW, innerH, height, fanlightRatio, fan2Ratio,
  middleSectionMm = 0, casementHinges = null, geo = CASEMENT_GEO_DEFAULTS,
}) {
  const def = casementLayoutDef(
    code, innerW, innerH, height, fanlightRatio, fan2Ratio, middleSectionMm, geo
  );
  assignPanelRoles(def, code);
  applyCasementHinges(def, casementHinges, code);
  return def;
}

/** Number of operable panels in a RESOLVED def (after the opener overlay). */
export function countCasementOpeners(def) {
  if (!def || !def.panels) return 0;
  return def.panels.filter((p) => p.hinge !== 'fixed').length;
}
