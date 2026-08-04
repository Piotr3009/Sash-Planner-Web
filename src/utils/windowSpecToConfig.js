/**
 * windowSpecToConfig.js
 * 
 * Bridge between Sash Planner's windowSpec (from specification.js)
 * and ParametricSashWindow component props (from 3D configurator).
 * 
 * windowSpec shape (from normaliseToWindowSpec):
 *   { frame: { width, height }, sash: { horns, grid: { mode, rows, cols, customBars } },
 *     color: { single, inside, outside, type, ral }, hardware: { finish },
 *     glazing: { type, finish, spacerColour }, rawSpec }
 * 
 * ParametricSashWindow props:
 *   { width, height, upperBars, lowerBars, upperCustomBars, lowerCustomBars,
 *     woodColor, woodColorExt, woodColorInt, sameColor, showHorns, hornType,
 *     upperGlass, lowerGlass, doubleGlazing, spacerColor, ironmongery,
 *     sashType, opening, upperOpening, showGuides, ... }
 */

// Named colour → hex mapping (matches Prime Sash Windows configurator palette)
const COLOR_MAP = {
  'white':        '#F4F4F2',
  'pure white':   '#F4F4F2',
  'off-white':    '#F0EEE8',
  'cream':        '#EDE8D8',
  'ivory':        '#FFFFF0',
  'black':        '#1C1C1C',
  'jet black':    '#1C1C1C',
  'anthracite':   '#2E3A3F',
  'grey':         '#808080',
  'light grey':   '#C0C0C0',
  'dark grey':    '#404040',
  'sage green':   '#4A4F3B',
  'sage':         '#4A4F3B',
  'olive green':  '#4A4F3B',
  'green':        '#2F4538',
  'heritage green': '#2F4538',
  'burgundy':     '#6B1A2A',
  'royal blue':   '#1A3060',
  'blue':         '#1A3060',
  'oak':          '#C8853A',
  'light oak':    '#D4A76A',
  'dark oak':     '#6B4226',
  'mahogany':     '#4E2728',
  'natural':      '#DEC89A',
  'unpainted':    '#DEC89A',
};

import { buildVentGrilles } from '../engine/lists.js';
import { RAL_LOOKUP as RAL_COLORS } from '../config.js';
import { fanAxisToRatio, fan2AxisToRatio, CASEMENT_GEO_DEFAULTS } from '../engine/casementLayouts.js';
import { profileBoxDepth } from '../engine/profile.js';

function resolveColor(name, ral) {
  if (!name && !ral) return '#F4F4F2'; // default white

  // Try RAL first
  if (ral) {
    const ralKey = String(ral).replace(/^ral\s*/i, '').trim();
    if (RAL_COLORS[ralKey]) return RAL_COLORS[ralKey];
  }

  // Try named colour
  if (name) {
    // If it's already a hex
    if (/^#[0-9a-fA-F]{3,8}$/.test(name)) return name;
    const key = name.toLowerCase().trim();
    if (COLOR_MAP[key]) return COLOR_MAP[key];
  }

  return '#F4F4F2'; // fallback white
}

/**
 * Convert a windowSpec object (from specification.js normaliseToWindowSpec)
 * into props that ParametricSashWindow accepts.
 */
export function windowSpecToConfig(windowSpec) {
  if (!windowSpec) return {};

  // Casement windows route to CasementWindow via casementProps; width/height
  // stay top-level for the shared camera auto-fit in the viewer Scenes.
  if ((windowSpec.category || 'sash') === 'casement') {
    const casementProps = windowSpecToCasementProps(windowSpec);
    return {
      windowCategory: 'casement',
      width: casementProps.width,
      height: casementProps.height,
      casementProps,
    };
  }

  // Doors: the 3D App reads FLAT door fields (it was ported from PSW that way),
  // so translate the nested windowSpec.door block into those exact keys.
  if (['door', 'doors'].includes(windowSpec.category || 'sash')) {
    const d = windowSpec.door || {};
    const sp = d.sidePanels || {};
    const tr = d.transom || {};
    const gz = windowSpec.glazing || {};
    const col = windowSpec.color || {};
    const dual = col.type === 'dual';
    return {
      windowCategory: 'door',
      width: windowSpec.frame?.width || 900,
      height: windowSpec.frame?.height || 2100,
      extWidth: windowSpec.frame?.width || 900,
      extHeight: windowSpec.frame?.height || 2100,
      doorType: d.type || 'single-external',
      doorShape: d.shape || 'standard',
      doorStyle: d.style || 'full-glass',
      paneling: d.paneling || 'flat',
      centerMullion: !!d.centerMullion,
      doorHinge: d.hingeSide || 'left',
      doorOpenDirection: d.openDirection || 'outward',
      doorHBars: d.bars?.h || 0,
      doorVBars: d.bars?.v || 0,
      sidePanels: sp.mode || 'none',
      sideLeftWidth: sp.leftWidth || 500,
      sideRightWidth: sp.rightWidth || 500,
      sideStyle: sp.style || 'full-glass',
      sideHBars: sp.barsH || 0,
      sideVBars: sp.barsV || 0,
      transomType: tr.type || 'none',
      transomHeight: tr.height || 450,
      transomBars: tr.bars || 'none',
      thresholdType: d.threshold || 'standard',
      thresholdExtension: d.thresholdExtension || 0,
      doubleGlazing: gz.type !== 'triple',
      glassType: gz.type === 'triple' ? 'triple' : 'double',
      glassFinish: gz.finish || 'clear',
      spacerColor: gz.spacerColour || 'white',
      sealColour: windowSpec.casement?.sealColour || 'black',
      sillExtension: windowSpec.cill?.extension || 0,
      sillWider: !!windowSpec.cill?.wider,
      sameColor: !dual,
      woodColor: col.single || col.outside || '#F6F6F6',
      woodColorExt: col.outside || col.single || '#F6F6F6',
      woodColorInt: col.inside || col.single || '#F6F6F6',
    };
  }

  const w = windowSpec.frame?.width || 1200;
  const h = windowSpec.frame?.height || 1800;

  // Bars — windowSpec stores grid mode like '6x6', '3x3', 'none', 'custom'
  const gridMode = windowSpec.sash?.grid?.mode || 'none';
  const barsValue = gridMode === 'custom' ? 'custom' : gridMode;

  // Custom bars — ParametricSashWindow expects per-sash arrays of {type:'v'|'h', mm}.
  // Primary source: rawSpec.fullConfig, which stores the exact per-sash bars the
  // configurator saved. Accepts legacy {type, position} entries and skips junk.
  const cleanBars = (list) => (Array.isArray(list) ? list : [])
    .filter((b) => b && (b.type === 'v' || b.type === 'h'))
    .map((b) => ({ type: b.type, mm: Number(b.mm ?? b.position) }))
    .filter((b) => Number.isFinite(b.mm) && b.mm > 0);
  const rawFc = windowSpec.rawSpec?.fullConfig || {};
  let upperCustom = cleanBars(rawFc.upperCustomBars);
  let lowerCustom = cleanBars(rawFc.lowerCustomBars);
  if (upperCustom.length === 0 && lowerCustom.length === 0) {
    // Legacy fallback: windowSpec grid keeps direction-keyed positions
    // (vertical/horizontal) without the upper/lower split — apply to both sashes.
    const cb = windowSpec.sash?.grid?.customBars || {};
    const legacy = [
      ...(Array.isArray(cb.vertical) ? cb.vertical : []).map(Number).filter(Number.isFinite).map((mm) => ({ type: 'v', mm })),
      ...(Array.isArray(cb.horizontal) ? cb.horizontal : []).map(Number).filter(Number.isFinite).map((mm) => ({ type: 'h', mm })),
    ];
    upperCustom = legacy;
    lowerCustom = legacy;
  }

  // Horns
  const hasHorns = Boolean(windowSpec.sash?.horns);
  // hornType comes from rawSpec or defaults to 'A'
  const rawHornType = windowSpec.rawSpec?.fullConfig?.horns || 
                      windowSpec.rawSpec?.horns || 'none';
  const hornType = (rawHornType && rawHornType !== 'none') ? rawHornType : 'A';

  // Colours
  const colorType = windowSpec.color?.type || 'single';
  const isSameColor = colorType === 'single';
  const woodColor = resolveColor(windowSpec.color?.single || windowSpec.color?.outside, windowSpec.color?.ral);
  const woodColorExt = isSameColor ? woodColor : resolveColor(windowSpec.color?.outside, windowSpec.color?.ral);
  const woodColorInt = isSameColor ? woodColor : resolveColor(windowSpec.color?.inside, windowSpec.color?.ral);

  // Glass
  const glassFinish = windowSpec.glazing?.finish || 'clear';
  const frostedLocation = windowSpec.glazing?.frostedLocation || windowSpec.glazing?.frosted_location || 'bottom';
  const isDouble = (windowSpec.glazing?.type || 'double') !== 'single';

  // Frosted applies per-sash: lower when frosted; upper only when location = both.
  const upperFrosted = glassFinish === 'frosted' && frostedLocation === 'both' ? 'frosted' : 'clear';
  const lowerFrosted = glassFinish === 'frosted' ? 'frosted' : 'clear';

  // Ironmongery
  const ironmongery = windowSpec.hardware?.finish || 'brass';

  // Spacer
  const spacerColor = windowSpec.glazing?.spacerColour || windowSpec.glazing?.spacerColor || 'silver';

  return {
    width: w,
    height: h,
    upperBars: barsValue,
    lowerBars: barsValue,
    upperCustomBars: upperCustom,
    lowerCustomBars: lowerCustom,
    showHorns: hasHorns,
    hornType,
    woodColor,
    woodColorExt: isSameColor ? null : woodColorExt,
    woodColorInt: isSameColor ? null : woodColorInt,
    sameColor: isSameColor,
    upperGlass: upperFrosted,
    lowerGlass: lowerFrosted,
    doubleGlazing: isDouble,
    spacerColor,
    ironmongery,
    sashType: 'double',
    splitRatio: '1/4-1/2-1/4',
    headType: 'flat',
    opening: 0,
    upperOpening: 0,
    showGuides: false,
    boxDepth: windowSpec.frame?.depth || profileBoxDepth('standard'),
    sashDepth: 57,
  };
}

// ─── Casement: windowSpec → CasementWindow props ───
// Same clamps as the configurator/engine (single source: casementLayouts.js).

export function windowSpecToCasementProps(windowSpec) {
  const frame = windowSpec?.frame || {};
  const cas = windowSpec?.casement || {};
  const color = windowSpec?.color || {};
  const glazing = windowSpec?.glazing || {};
  const width = Number(frame.width) || 1200;
  const height = Number(frame.height) || 1200;
  const innerH = height - CASEMENT_GEO_DEFAULTS.frameFace - CASEMENT_GEO_DEFAULTS.bottomFace;
  const single = resolveColor(color.single, color.ral);
  const isDual = color.type === 'dual';
  return {
    width, height,
    layout: cas.layout || '040L',
    casementHinges: Array.isArray(cas.hinges) ? cas.hinges : null,
    fanlightRatio: fanAxisToRatio(cas.fanlightHeight, innerH),
    fan2Ratio: fan2AxisToRatio(cas.fan2Height, height, innerH),
    middleSection: Number(cas.middleWidth) || 0,
    hBars: cas.bars?.h || 0,
    vBars: cas.bars?.v || 0,
    fanHBars: cas.bars?.fanH || 0,
    fanVBars: cas.bars?.fanV || 0,
    fan2HBars: cas.bars?.fan2H || 0,
    fan2VBars: cas.bars?.fan2V || 0,
    opening: 0,
    woodColor: single,
    woodColorExt: isDual ? resolveColor(color.outside, '') : single,
    woodColorInt: isDual ? resolveColor(color.inside, '') : single,
    sameColor: !isDual,
    glassType: glazing.type === 'triple' ? 'triple' : 'double',
    spacerColor: glazing.spacerColour || 'silver',
    glassFinish: glazing.finish || 'clear',
    frostedLocation: glazing.frostedLocation || 'bottom',
    trickleVent: buildVentGrilles(windowSpec) > 0 ? 'frame' : 'none',
    trickleColour: 'white',
    sealColour: windowSpec.casement?.sealColour || 'black',
    sillExtension: Number(windowSpec.cill?.extension) || 0,
    sillWider: !!windowSpec.cill?.wider,
    showGuides: false,
    ironmongery: windowSpec?.hardware?.finish || 'brass',
  };
}
