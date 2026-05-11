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

// RAL code → hex (subset — full table is in 3d/App.jsx RAL_COLORS)
const RAL_COLORS = {
  '9010': '#FFFFFF', '9016': '#F6F6F6', '9001': '#FDF4E3',
  '9005': '#0A0A0A', '7016': '#293133', '7021': '#23282B',
  '7035': '#D7D7D7', '6005': '#2F4538', '6009': '#31372B',
  '3005': '#5E2129', '5011': '#1B2A4A',
};

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

  const w = windowSpec.frame?.width || 1200;
  const h = windowSpec.frame?.height || 1800;

  // Bars — windowSpec stores grid mode like '6x6', '3x3', 'none', 'custom'
  const gridMode = windowSpec.sash?.grid?.mode || '2x2';
  const barsValue = gridMode === 'custom' ? 'custom' : gridMode;

  // Custom bars
  const customBars = windowSpec.sash?.grid?.customBars || {};
  const upperCustom = customBars.vertical || [];
  const lowerCustom = customBars.horizontal || [];

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
  const isDouble = (windowSpec.glazing?.type || 'double') !== 'single';

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
    upperGlass: glassFinish,
    lowerGlass: glassFinish,
    doubleGlazing: isDouble,
    spacerColor,
    ironmongery,
    sashType: 'double',
    splitRatio: '1/4-1/2-1/4',
    headType: 'flat',
    opening: 0,
    upperOpening: 0,
    showGuides: false,
    boxDepth: 164,
    sashDepth: 57,
  };
}
