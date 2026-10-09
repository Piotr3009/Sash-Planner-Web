/**
 * specification.js — adapter between window data rows and the windowSpec
 * shape expected by calculations.js (`deriveWindowData`).
 *
 * Supports BOTH:
 * - Old estimate_items format (underscore: color_single, glass_type, etc.)
 * - New Production Batch format (camelCase: woodColor, glassType, etc.)
 */

export function parseSpecification(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse specification:', e);
    return null;
  }
}

// Sash glazing bar patterns ('N x N' = N panes PER SASH, "N over N"; PSW and the
// configurators share this vocabulary). "6 over 1" = upper '6x6', lower 'none'.
export const SASH_BAR_PATTERNS = Object.freeze(['none', '2x2', '3x3', '4x4', '6x6', '8x8', '9x9', 'custom']);
/** Raised for a bar pattern the engine does not know ('2x3', '6x1'): per window, never a blank page. */
export class BarPatternError extends Error {
  constructor(message) { super(message); this.name = 'BarPatternError'; }
}

/**
 * The bar pattern of each sash (Piotr 09.10.2026, owner box item 16): the
 * window record (upperBars / lowerBars), then the specification's top level,
 * then the estimate fullConfig (PSW sometimes sends the bars only there), then
 * 'none'. A value that is no pattern at all (empty, a pricing word) is 'none'
 * as it always was; an 'N x M' the engine has no table for raises
 * BarPatternError (it threw a plain error deep in the engine before).
 */
function readSashBars(spec, item, windowName) {
  const fc = spec?.fullConfig || {};
  const read = (which) => {
    const raw = String(item?.[`${which}Bars`] || item?.[`${which}_bars`] || spec?.[`${which}Bars`] || fc[`${which}Bars`] || '').toLowerCase();
    if (!raw || raw === 'none') return 'none';
    if (raw === 'custom') return 'custom';
    if (/^\d+x\d+$/.test(raw)) {
      if (!SASH_BAR_PATTERNS.includes(raw)) throw new BarPatternError(`Unknown bar pattern "${raw}" on the ${which} sash of window "${windowName || '?'}" (allowed: ${SASH_BAR_PATTERNS.join(', ')})`);
      return raw;
    }
    return 'none';
  };
  return { upper: read('upper'), lower: read('lower') };
}

// The one pattern of the legacy grid (grid.mode): the lower sash wins unless it
// has none. Every reader moved to the per-sash patterns (grid.upper / grid.lower)
// on 09.10.2026; this value stays for a window whose sashes agree.
function detectGridMode(spec, item, windowName) {
  const { upper, lower } = readSashBars(spec, item, windowName);
  return lower !== 'none' ? lower : upper;
}

// Sealed unit makeup/thickness per glass type — single source of truth.
// Passive (vacuum) and single have no unit makeup; gas fill only applies to sealed units.
export const GLASS_MAKEUP = { double: '4x16x4', double_slim: '4x8x4', triple: '4x8x4x8x4', passive: '', single: '' };
export const GLASS_THICKNESS = { double: 24, double_slim: 16, triple: 28 };
// Laminate / Acoustic SPEC (Piotr 01.10.2026): the unit is 4 × 14 × 6.8 = 24.8mm whatever the
// glass TYPE chip says, and it takes 24.8mm clips. Doors too since 08.10.2026 (owner box item 8).
export const ACOUSTIC_MAKEUP = '4x14x6.8';
export const ACOUSTIC_THICKNESS = 24.8;
/**
 * Is this the Laminate / Acoustic unit (4 × 14 × 6.8 = 24.8mm)?
 * The Laminate / Acoustic spec on any glass type, or the plain Laminated spec
 * on a double / passive unit — Piotr 05.10.2026: that is the SAME glass, so it
 * takes the same makeup, thickness, clips and Assign Materials row. A laminated
 * triple stays a triple and Single Heritage stays single (02.10.2026).
 * ONE definition for the makeup, the thickness, both clip rules and the BOM row.
 */
export function isAcousticUnit(glazing) {
  const spec = glazing?.spec;
  const type = glazing?.type || 'double';
  return spec === 'acoustic' || (spec === 'laminated' && (type === 'double' || type === 'passive'));
}
/** The makeup printed on glass orders: explicit override → Laminate / Acoustic unit → profile per type → default. */
export function glassMakeupFor(glazing, profile) {
  if (glazing?.makeup != null) return glazing.makeup;
  const type = glazing?.type || 'double';
  if (isAcousticUnit(glazing)) return profile?.glassMakeup?.acoustic ?? ACOUSTIC_MAKEUP;
  return profile?.glassMakeup?.[type] ?? (GLASS_MAKEUP[type] ?? GLASS_MAKEUP.double);
}

// Door glass (owner box item 8, 08.10.2026): the standard door unit is a
// double 6 × 12 × 6 = 24mm (6mm panes, the same 24mm thickness as the 4-16-4
// window unit, so the same rebate), so the door leaf is the casement 57 again
// (61 with a triple, as casement). Slim and triple take the WINDOW makeups
// (GLASS_MAKEUP, so the workshop's sash profile glassMakeup), and the
// Laminate / Acoustic rule (isAcousticUnit, 24.8) applies to doors as well.
// Until 07.10.2026 (door schema 1): double 6x16x6 and triple on ONE 28mm unit, leaf 61.
export const DOOR_GLASS_MAKEUP = { double: '6x12x6' };
export const DOOR_GLASS_THICKNESS = { double: 24, double_slim: 16, triple: 28 };
// Read from the default door profile: the numbers live there and nowhere else.
export const DOOR_LEAF_DEPTH = DEFAULT_DOOR_PROFILE.leafDepth;
export const DOOR_FRAME_DEPTH = DEFAULT_DOOR_PROFILE.frameDepth;
export const glassGas = (type) => (type === 'single' || type === 'passive') ? '' : 'argon';

// Sash proportions (cottage, Piotr 09.10.2026). The field name and the three
// values are the contract with PSW: `sashProportion`, saved in the estimate
// fullConfig like `splitRatio`; a missing, null or empty value is 'standard'.
// The split itself is computed in ONE place: calculations.js sashHeightsFor().
export const SASH_PROPORTIONS = Object.freeze(['standard', 'cottage-40-60', 'cottage-1-3']);
export const SASH_PROPORTION_LABELS = Object.freeze({
  standard: 'Standard',
  'cottage-40-60': 'Cottage 40/60',
  'cottage-1-3': 'Cottage 1/3-2/3',
});
// The configurator offers cottage from this frame height up; a stored cottage
// window below it still derives (the detail page shows a warning line).
export const COTTAGE_MIN_FRAME_HEIGHT = 900;
export const isCottageProportion = (value) => value === 'cottage-40-60' || value === 'cottage-1-3';
/** The configurator chips (value + label), in the contract order. */
export const SASH_PROPORTION_OPTIONS = Object.freeze(SASH_PROPORTIONS.map((value) => Object.freeze({ value, label: SASH_PROPORTION_LABELS[value] })));
/**
 * The proportion a configurator saves and shows: a cottage value falls back to
 * standard on an arched sash and below COTTAGE_MIN_FRAME_HEIGHT (the cottage
 * chips are disabled there). Any other value passes through unchanged, so an
 * unknown one still reaches normaliseToWindowSpec and its explicit error.
 */
export function effectiveSashProportion(value, { frameHeight, arched = false } = {}) {
  if (!value) return 'standard';
  if (!isCottageProportion(value)) return value;
  if (arched || !(Number(frameHeight) >= COTTAGE_MIN_FRAME_HEIGHT)) return 'standard';
  return value;
}
/** Raised for an unknown sashProportion value, or a cottage value on an arched window (the ArchError way). */
export class SashProportionError extends Error {
  constructor(message) { super(message); this.name = 'SashProportionError'; }
}
import { FAN_AXIS_OFFSET_TOP, FAN_AXIS_OFFSET_BOTTOM } from './casementLayouts.js';
import { profileBoxDepth, getDoorProfile, DEFAULT_DOOR_PROFILE } from './profile.js';
import {
  PSW_ARCH_SHAPE, PSW_ARCH_RISE_RATIO, PSW_SASH_RADIO_SHAPE, LEGACY_ARCH_SHAPES, ARCH_RISE_RATIO, GOTHIC_PROFILE_RATIO,
  ARCH_BAR_PATTERNS, isArchShape, isRoundShape, resolveRoundShape, ArchError, CIRCLE_SHAPE, patternsForShape,
} from './arch.js';

// Custom bar lists per sash (09.10.2026): the window record's upper / lower list,
// else the fullConfig's; a lower sash without its own list takes the upper one
// (what the configurators save with "same bars", and what the single list did).
function customBarsPerSash(spec, item) {
  const fc = spec?.fullConfig || spec || {};
  const fromList = (list) => {
    if (Array.isArray(list)) {
      const positions = (type) => list.filter((b) => b && b.type === type).map((b) => Number(b.mm ?? b.position)).filter((n) => Number.isFinite(n) && n > 0);
      return { vertical: positions('v'), horizontal: positions('h') };
    }
    if (list && typeof list === 'object') {
      const collect = (l) => (Array.isArray(l) ? l.map(Number).filter(Number.isFinite) : []);
      return { vertical: collect(list.vertical), horizontal: collect(list.horizontal) };
    }
    return { vertical: [], horizontal: [] };
  };
  const has = (l) => l.vertical.length + l.horizontal.length > 0;
  const own = (which) => {
    const onItem = item?.[`${which}CustomBars`];
    if (Array.isArray(onItem) && onItem.length) return fromList(onItem);
    return fromList(fc[`${which}CustomBars`] || fc[`${which}CustomBarsArray`]);
  };
  const upper = own('upper');
  const lowerOwn = own('lower');
  return { upper, lower: has(lowerOwn) ? lowerOwn : upper };
}

function customBarsFromSpec(spec, item) {
  // New format: item stores custom bars directly as arrays of {type, mm}
  // (legacy entries may still carry {type, position} — accept both).
  const uCustom = item?.upperCustomBars || [];
  const lCustom = item?.lowerCustomBars || [];
  if (Array.isArray(uCustom) && uCustom.length > 0) {
    const positions = (list, type) => list
      .filter(b => b && b.type === type)
      .map(b => Number(b.mm ?? b.position))
      .filter((n) => Number.isFinite(n) && n > 0);
    return {
      vertical: positions(uCustom, 'v'),
      horizontal: positions(uCustom, 'h'),
    };
  }
  // Old format from spec
  const fc = spec?.fullConfig || spec || {};
  const upper = fc.upperCustomBars || fc.upperCustomBarsArray || [];
  const lower = fc.lowerCustomBars || fc.lowerCustomBarsArray || [];
  const collect = (list) => (Array.isArray(list) ? list.map(Number).filter(Number.isFinite) : []);
  return {
    vertical: collect(upper.vertical || lower.vertical || []),
    horizontal: collect(upper.horizontal || lower.horizontal || [])
  };
}

/**
 * Arched casement fields (arched-casement-v1, v2 shape model). Returns null
 * for every window that is not an arched casement, so consumers test
 * `windowSpec.arch?.shape`.
 *
 * PSW source: casement-controller.js getCasementConfig() writes
 *   casementType 'arched', casArchShape (gothic-arch | semi-circle |
 *   segmental-arch | elliptical-arch), casArchHinge ('right' | 'left').
 * PSW form (online-estimate.html 887–888): the radio LABELLED "Left Hinge"
 * carries value="right". Since v3 0.4b the VALUE is taken 1:1 (identity
 * mapping, Piotr 07.09) — both 3Ds render the same estimate identically; the
 * label wording is a PSW-side question (BLOCKERS).
 * PC-native items carry archShape / archStart / archRise / archRiseSource /
 * archHinge / archProfile / archBarPattern directly, in PC vocabulary.
 *
 * Rise (v2 P4): the configurator stores WHERE THE ARCH STARTS (`archStart`,
 * mm from the cill) — rise = height − start. A v1 item without a start keeps
 * its explicit `archRise`; without either the rise is ratio × external width
 * (`riseSource: 'ratio'`). Shape (v2 P2 / P10): a Round arch resolves from its
 * rise — exactly half the width is a semi-circle, below it a three-centre,
 * above it an ArchError ("use Gothic"). PSW 'segmental-arch' → three-centre
 * with the PSW segmental rise 0.20 × W, 'elliptical-arch' → 0.325 × W; a v1-era
 * PC 'segmental' migrates the same way with riseSource 'ratio'. PSW gothic +
 * archProfile 'drop' / 'shallow' → PC 'gothic-drop' with that profile's rise.
 *
 * Spec §4.1: an UNKNOWN shape throws (a silent rectangle was the critical
 * import bug); so does an unknown bar pattern. `width` / `height` = external
 * frame size (mm).
 */
export function archFromSpec(item, fc, width, height) {
  let pcShapeRaw = item?.archShape || fc.archShape;
  let pswShape = item?.casArchShape || fc.casArchShape;
  // v3 Block 3 — FIXED window in the casement batch: PC-native `casementKind
  // 'fixed'` + the same arch fields (archShape 'circle' for the circle), or the
  // PSW fix-only product: `fixShape` (rectangle | circle | the PSW arch ids),
  // `fixArchRise`, `fixSemiBarPattern` / `fixGothicBars` / `fixCircleBarPattern`,
  // `fixCircleOffset` (estimate-renderer.js 418–435, price-calculator.js 411–435).
  const fixed = casementKindFromSpec(item, fc) === 'fixed';
  const fixShape = fixed ? (item?.fixShape || fc.fixShape || null) : null;
  if (fixed && fixShape && fixShape !== 'rectangle' && !pcShapeRaw && !pswShape) {
    if (fixShape === CIRCLE_SHAPE) pcShapeRaw = CIRCLE_SHAPE;
    else pswShape = fixShape;                                            // PSW arch id — archFieldsFromSpec validates it
  }
  if (pcShapeRaw === CIRCLE_SHAPE) return circleFromSpec(item, fc, width, height);
  const isArched = (item?.casementType || fc.casementType) === 'arched' || !!pcShapeRaw || (fixed && !!pswShape);
  if (!isArched) return null;
  const fcFix = fixed ? {
    ...fc,
    archRise: fc.archRise ?? fc.fixArchRise,
    archBarPattern: fc.archBarPattern || firstPattern(fc.fixSemiBarPattern, fc.fixGothicBars),
  } : fc;
  return archFieldsFromSpec(item, fcFix, width, height, { pcShapeRaw, pswShape, category: 'casement' });
}

const firstPattern = (...vals) => vals.find((v) => v && v !== 'none') || null;

/** 'opening' | 'fixed' — PC `casementKind`, or PSW's fix-only product (`windowType 'fix-only'`). */
export function casementKindFromSpec(item, fc) {
  const raw = item?.casementKind || fc?.casementKind || ((item?.windowType || fc?.windowType) === 'fix-only' ? 'fixed' : null);
  return raw === 'fixed' ? 'fixed' : 'opening';
}

/**
 * Circle fixed window (v3 Block 3): the arch object with shape 'circle' —
 * rise = start = W / 2 (the horizontal diameter), no hinge, no profile;
 * bars: the straight counts + the pattern (none | sunburst) + PSW's
 * `fixCircleOffset` as `circleOffset` (null → profile arch.patterns.sunburst.offset).
 */
export function circleFromSpec(item, fc, width, height) {
  const name = item?.name || item?.window_number || '?';
  const W = Number(width), H = Number(height);
  if (!(W > 0)) throw new ArchError(`Circle window "${name}" has no width (diameter)`);
  if (H > 0 && Math.abs(H - W) > 0.5) throw new ArchError(`Circle window "${name}" is ${W} wide but ${H} high — the height must equal the diameter`);
  const pattern = item?.archBarPattern || fc.archBarPattern || firstPattern(item?.fixCircleBarPattern, fc.fixCircleBarPattern) || 'none';
  if (!patternsForShape(CIRCLE_SHAPE).includes(pattern)) throw new ArchError(`Bar pattern "${pattern}" is not available on a circle window "${name}" (allowed: ${patternsForShape(CIRCLE_SHAPE).join(', ')})`);
  const offRaw = item?.fixCircleOffset ?? fc.fixCircleOffset;
  const circleOffset = offRaw == null || offRaw === '' ? null : Number(offRaw);
  return {
    shape: CIRCLE_SHAPE,
    profile: null,
    rise: W / 2,
    start: W / 2,
    riseSource: 'circle',
    hinge: null,
    bars: {
      pattern,
      h: Number(item?.casementHBars ?? fc.casementHBars) || 0,
      v: Number(item?.casementVBars ?? fc.casementVBars) || 0,
      spokes: 0,
      rings: [],
      circleOffset: Number.isFinite(circleOffset) && circleOffset > 0 ? circleOffset : null,
    },
  };
}

/**
 * Arched SASH fields (ARCHED-WINDOWS-v3 Block 1 A). PSW: `sashType 'arched-group'`
 * with `archShape` = the PSW shape id (semi-circle | gothic-arch | elliptical-arch
 * | segmental-arch, price-calculator.js SHAPE_FROM_RADIO) or the raw radio value
 * (semicircular | gothic | elliptical | segmental), `archRise`, `archProfile`,
 * `archBarPattern`, `archHBars` / `archVBars` (upper straight bars), `lowerHBars`
 * (estimate-manager.js 682–692). PC-native: `frameShape 'arched'` + the same PC
 * fields as the casement (archShape in PC vocabulary, archStart, …). Returns the
 * casement's arch object plus `lowerHBars`; no hinge. Null when not arched.
 */
export function sashArchFromSpec(item, fc, width, height) {
  const sashType = item?.sashType || fc.sashType;
  const frameShape = item?.frameShape || fc.frameShape;
  const raw = item?.archShape || fc.archShape || null;
  const isArched = sashType === 'arched-group' || frameShape === 'arched';
  if (!isArched) return null;
  let pcShapeRaw = null, pswShape = null;
  if (raw) {
    if (PSW_ARCH_SHAPE[raw]) pswShape = raw;
    else if (PSW_SASH_RADIO_SHAPE[raw]) pswShape = PSW_SASH_RADIO_SHAPE[raw];
    else pcShapeRaw = raw;
  }
  const a = archFieldsFromSpec(item, fc, width, height, { pcShapeRaw, pswShape, category: 'sash' });
  a.hinge = null;
  a.bars.h = Number(item?.archHBars ?? fc.archHBars ?? item?.casementHBars ?? fc.casementHBars) || 0;
  a.bars.v = Number(item?.archVBars ?? fc.archVBars ?? item?.casementVBars ?? fc.casementVBars) || 0;
  a.lowerHBars = Number(item?.lowerHBars ?? fc.lowerHBars) || 0;
  return a;
}

function archFieldsFromSpec(item, fc, width, height, { pcShapeRaw, pswShape, category }) {
  const name = item?.name || item?.window_number || '?';
  const profileRaw = item?.archProfile || fc.archProfile || item?.casArchProfile || fc.casArchProfile || null;
  const legacy = pcShapeRaw ? LEGACY_ARCH_SHAPES[pcShapeRaw] : null;
  let shape;
  let ratio = null;
  if (legacy) { shape = legacy.shape; ratio = legacy.riseRatio; }                  // P10: v1 'segmental' → three-centre, 0.20 × W
  else if (pcShapeRaw) shape = pcShapeRaw;
  else if (pswShape) {
    shape = PSW_ARCH_SHAPE[pswShape];
    if (!shape) throw new ArchError(`Unknown PSW arch shape "${pswShape}" on window "${name}" — cannot build an arched casement from it`);
    ratio = PSW_ARCH_RISE_RATIO[pswShape];
    if (shape === 'gothic-equilateral' && profileRaw && profileRaw !== 'equilateral') shape = 'gothic-drop';
  } else {                                                                          // PSW default when the radio never changed
    shape = PSW_ARCH_SHAPE['semi-circle'];
    ratio = PSW_ARCH_RISE_RATIO['semi-circle'];
  }
  if (!isArchShape(shape)) throw new ArchError(`Unknown arch shape "${shape}" on window "${name}" — cannot build an arched casement from it`);
  const profile = shape === 'gothic-equilateral' ? 'equilateral'
    : shape === 'gothic-drop' ? (profileRaw === 'shallow' ? 'shallow' : 'drop')
    : null;
  if (profile) ratio = GOTHIC_PROFILE_RATIO[profile];
  else if (ratio == null) ratio = ARCH_RISE_RATIO[shape];
  const W = Number(width);
  const H = Number(height);
  const startRaw = item?.archStart ?? fc.archStart;
  const riseRaw = item?.archRise ?? fc.archRise;
  const startNum = startRaw == null || startRaw === '' ? Number.NaN : Number(startRaw);
  const riseNum = riseRaw == null || riseRaw === '' ? Number.NaN : Number(riseRaw);
  let rise, riseSource;
  if (!legacy && Number.isFinite(startNum) && H > 0) {
    rise = H - startNum;                                                            // v2: the joiner measures where the arch starts
    riseSource = (item?.archRiseSource || fc.archRiseSource) === 'ratio' ? 'ratio' : 'custom';
  } else if (!legacy && Number.isFinite(riseNum)) {
    rise = riseNum;                                                                 // v1 item: explicit rise, no start
    riseSource = 'custom';
  } else {
    rise = W > 0 ? ratio * W : null;                                                // shape default (PSW ratio) — also every migrated v1 'segmental'
    riseSource = 'ratio';
  }
  if (isRoundShape(shape) && Number.isFinite(rise)) shape = resolveRoundShape(W, rise);   // v2 §2.2, may throw "use Gothic"
  const start = Number.isFinite(rise) && H > 0 ? H - rise : null;
  void category;
  // Hinge (v3 0.4b, Piotr 07.09 "PSW–PC musi sie zgadzac 1 do 1"): the VALUE is
  // the contract — PSW's 3D passes casArchHinge straight to hingeDirection and
  // PC's 3D is the same component, so PC keeps it as is. (The PSW radio
  // labelled "Left Hinge" carries value="right" — a PSW-side question, BLOCKERS.)
  const hingeRaw = item?.archHinge || fc.archHinge || item?.casArchHinge || fc.casArchHinge || fc['cas-arch-opening'] || 'right';
  const hinge = hingeRaw === 'left' ? 'left' : 'right';
  const pattern = item?.archBarPattern || fc.archBarPattern || 'none';
  if (!ARCH_BAR_PATTERNS.includes(pattern)) throw new ArchError(`Unknown arch bar pattern "${pattern}" on window "${name}"`);
  const ringsRaw = item?.archRings ?? fc.archRings;
  const bars = {
    pattern,
    h: Number(item?.casementHBars ?? fc.casementHBars) || 0,   // straight bars below the springing
    v: Number(item?.casementVBars ?? fc.casementVBars) || 0,   // straight bars across the clear width
    // v3 0.4 custom hub: spoke count + ring fractions (only read when pattern === 'custom')
    spokes: Number(item?.archSpokes ?? fc.archSpokes) || 0,
    rings: Array.isArray(ringsRaw) ? ringsRaw.map(Number).filter((k) => k > 0 && k < 1)
      : typeof ringsRaw === 'string' ? ringsRaw.split(/[,\s]+/).map(Number).filter((k) => k > 0 && k < 1) : [],
  };
  return { shape, profile, rise, start, riseSource, hinge, bars };
}

/**
 * Build a windowSpec object for the calculation engine.
 * Reads from both old (underscore) and new (camelCase) field names.
 */
export function normaliseToWindowSpec(item, parsedSpec = null) {
  const spec = parsedSpec || parseSpecification(item?.specification) || {};
  const fc = spec.fullConfig || spec || {};

  const width = Number(item?.width ?? spec.width ?? fc.width ?? 1000);
  const height = Number(item?.height ?? spec.height ?? fc.height ?? 1500);

  const windowName = item?.name || item?.window_number || '?';
  const sashBars = readSashBars(spec, item, windowName);
  const gridMode = detectGridMode(spec, item, windowName);
  const customPerSash = customBarsPerSash(spec, item);
  const [rowsStr, colsStr] = gridMode !== 'custom' ? gridMode.split('x') : ['2', '2'];
  const rows = Math.max(1, Number(rowsStr) || 2);
  const cols = Math.max(1, Number(colsStr) || 2);

  // Horns — new: item.hornType, old: item.horns
  const hornsVal = item?.hornType || item?.horns || fc.horns || spec.horns || 'none';
  const hasHorns = hornsVal && hornsVal !== 'none';

  // Colors — new: item.woodColor/woodColorExt/woodColorInt, old: item.color_single/color_exterior/color_interior
  const colorSingle = item?.woodColor || item?.color_single || fc.colorSingleName || fc.singleColor || fc.woodColor || '#F6F6F6';
  const colorInside = item?.woodColorInt || item?.color_interior || fc.interiorColor || fc.woodColorInt || colorSingle;
  const colorOutside = item?.woodColorExt || item?.color_exterior || fc.exteriorColor || fc.woodColorExt || colorSingle;
  const colorType = item?.colourMode || item?.color_type || fc.colorType || fc.colourMode || 'single';

  // Glass — new: item.glassType/glassSpec/glassFinish/spacerColor, old: item.glass_type/glass_spec/glass_finish/spacer_color
  const glassType = item?.glassType || item?.glass_type || spec.glassType || fc.glassType || 'double';
  const glassSpec = item?.glassSpec || item?.glass_spec || spec.glassSpec || fc.glassSpec || 'toughened';
  const glassFinish = item?.glassFinish || item?.glass_finish || spec.glassFinish || fc.glassFinish || 'clear';
  const spacerColor = item?.spacerColor || item?.spacer_color || fc.spacerColor || 'silver';
  const spacerType = item?.spacerType || item?.spacer_type || fc.spacerType || 'warm';
  const frostedLocation = item?.frostedLocation || item?.frosted_location || fc.frostedLocation || 'bottom';

  // Hardware — new: item.ironmongery, old: item.ironmongery_finish
  const ironFinish = item?.ironmongery || item?.ironmongery_finish || fc.ironmongeryFinish || fc.ironmongery || 'brass';
  const pas24 = item?.pas24 !== undefined ? item.pas24 : (fc.pas24 || false);

  // Frame type — feeds engine's isSlim (clip size, weight type). Was never set before,
  // so slim-specific consumables silently fell back to standard.
  const frameType = item?.frameType || item?.frame_type || fc.frameType || 'standard';
  // Batches exist with BOTH 'door' and 'doors' as their type. Normalise here,
  // once, so every consumer downstream (drawings, 3D, engine, PP) sees exactly
  // one value. Without this the engine derived doors while the drawings fell
  // through to the sash component and rendered NaN coordinates (Piotr 05.08).
  // v3 Block 3: PSW's fix-only product lives in PC's casement batch (Piotr 07.09).
  const rawCategory = item?.windowCategory || ((item?.windowType || fc.windowType) === 'fix-only' ? 'casement' : fc.windowCategory) || 'sash';
  const category = rawCategory === 'doors' ? 'door' : rawCategory;
  const isDoorCategory = category === 'door';
  // Frame depth — stored on the window; legacy windows fall back to the profile
  // Doors: always the door profile's frame depth (93). The configurator saved
  // the SASH box depth (164) on doors until 08.10.2026, so a stored value is
  // not read for a door.
  const frameDepth = isDoorCategory
    ? (Number(getDoorProfile().frameDepth) || DOOR_FRAME_DEPTH)
    : (item?.frameDepth || profileBoxDepth(glassType === 'triple' ? 'triple' : frameType));

  // Opening type — new: item.openingType
  const openingType = item?.openingType || item?.opening_type || fc.openingType || 'both';

  // Trickle vent — room type drives grille count (Approved Document F, Vol 1).
  // Defaults are deliberately the safest (most ventilation): habitable + sole window.
  const ventRoomType = item?.ventRoomType || spec.ventRoomType || fc.ventRoomType || 'habitable';
  const ventSoleWindow = item?.ventSoleWindow !== undefined ? !!item.ventSoleWindow
    : spec.ventSoleWindow !== undefined ? !!spec.ventSoleWindow
    : fc.ventSoleWindow !== undefined ? !!fc.ventSoleWindow
    : true;

  // Arched casement (arched-casement-v1): null unless casementType 'arched';
  // arched sash (arched-windows-v3 Block 1): null unless sashType 'arched-group' / frameShape 'arched'
  const arch = category === 'sash' ? sashArchFromSpec(item, fc, width, height) : archFromSpec(item, fc, width, height);

  // Sash proportion (cottage, Piotr 09.10.2026): read like splitRatio. An unknown
  // value, or a cottage value on an arched sash, is an explicit error for this
  // window (never a silent standard). Only a sash reads it.
  let sashProportion = null;
  if (category === 'sash') {
    sashProportion = item?.sashProportion || fc.sashProportion || 'standard';
    const name = item?.name || item?.window_number || '?';
    if (!SASH_PROPORTIONS.includes(sashProportion)) {
      throw new SashProportionError(`Unknown sash proportion "${sashProportion}" on window "${name}" (allowed: ${SASH_PROPORTIONS.join(', ')})`);
    }
    if (arch?.shape && sashProportion !== 'standard') {
      throw new SashProportionError(`Sash proportion "${sashProportion}" is not available on the arched window "${name}": cottage needs a rectangular sash`);
    }
  }

  return {
    id: item?.id || `mock_${Math.random().toString(36).slice(2, 8)}`,
    name: item?.name || item?.window_number || spec.windowName || 'Window',
    type: item?.window_type || spec.windowType || 'sash',
    quantity: Number(item?.quantity || 1),
    frame: { width, height, depth: frameDepth, type: frameType },
    category,
    sash: {
      type: item?.sashType || fc.sashType || 'double',
      splitRatio: item?.splitRatio || fc.splitRatio || '1/4-1/2-1/4',
      // only a sash carries it (a casement / door windowSpec stays as it was)
      ...(category === 'sash' ? { proportion: sashProportion } : {}),
      openingType,
      horns: hasHorns,
      hornType: hornsVal,
      // Per-window override only when explicitly provided; otherwise undefined so
      // the engine falls back to the workshop profile (getWindowProfile().hornExtension).
      hornExtension: Number(item?.hornExtension) || Number(spec?.sash?.hornExtension) || undefined,
      grid: {
        mode: gridMode,
        rows,
        cols,
        customBars: customBarsFromSpec(spec, item),
        // Bars per sash (Piotr 09.10.2026, owner box item 16): each sash keeps
        // its own pattern end to end; the four keys above stay for a window
        // whose sashes agree (legacy readers).
        upper: { mode: sashBars.upper, customBars: customPerSash.upper },
        lower: { mode: sashBars.lower, customBars: customPerSash.lower },
      }
    },
    casement: {
      // v3 Block 3: 'opening' (default) | 'fixed' — a fixed leaf: no hardware, no opening symbol
      kind: casementKindFromSpec(item, fc),
      layout: item?.casementLayout || fc.casementLayout || '040L',
      hinges: Array.isArray(item?.casementHinges) ? item.casementHinges
        : Array.isArray(fc.casementHinges) ? fc.casementHinges : null,
      // v1.2 convention: values below are transom AXES from the frame top.
      // New saves write fanlightAxis/fan2Axis; legacy rows stored the PSW
      // internal zone and are converted here once, on read.
      fanlightHeight: (() => {
        const ax = item?.fanlightAxis ?? fc.fanlightAxis;
        if (ax != null && ax !== '') return Number(ax);
        const z = item?.fanlightHeight ?? fc.fanlightHeight;
        return z != null && z !== '' ? Number(z) + FAN_AXIS_OFFSET_TOP : null;
      })(),
      fan2Height: (() => {
        const ax = item?.fan2Axis ?? fc.fan2Axis;
        if (ax != null && ax !== '') return Number(ax);
        const z = item?.casementFan2Height ?? fc.casementFan2Height;
        if (z == null || z === '') return null;
        const H = Number(item?.height ?? item?.extHeight ?? fc.extHeight) || 0;
        return H - Number(z) - FAN_AXIS_OFFSET_BOTTOM;
      })(),
      middleWidth: Number(item?.casementMiddleWidth ?? fc.casementMiddleWidth) || 0,
      barType: item?.casementBarType || fc.casementBarType || 'astragal',
      sealColour: item?.sealColour || fc.sealColour || 'black',
      bars: {
        h: Number(item?.casementHBars ?? fc.casementHBars) || 0,
        v: Number(item?.casementVBars ?? fc.casementVBars) || 0,
        fanH: Number(item?.casementFanHBars ?? fc.casementFanHBars) || 0,
        fanV: Number(item?.casementFanVBars ?? fc.casementFanVBars) || 0,
        fan2H: Number(item?.casementFan2HBars ?? fc.casementFan2HBars) || 0,
        fan2V: Number(item?.casementFan2VBars ?? fc.casementFan2VBars) || 0,
      },
    },
    // ── Arched casement / arched sash: computed above, before the proportion check
    arch,
    // ── Doors (PSW parity, Piotr 04.08) ─────────────────────────────────
    // Field names and value vocabularies match the PSW door-controller 1:1 so
    // a future PSW→PC import maps straight across. Two known PSW bugs are NOT
    // copied: hinge-side and open-direction labels were swapped there; here
    // value and meaning agree. Single and french share ONE set of fields —
    // PSW duplicates them behind an `fd-` prefix, which we deliberately drop.
    door: {
      type: item?.doorType || fc.doorType || 'single-external',
      shape: item?.doorShape || fc.doorShape || 'standard',
      style: item?.doorStyle || fc.doorStyle || 'full-glass',
      paneling: item?.doorPaneling || fc.doorPaneling || item?.paneling || fc.paneling || 'flat',
      centerMullion: !!(item?.centerMullion ?? fc.centerMullion),
      hingeSide: item?.doorHinge || fc.doorHinge || 'left',
      openDirection: item?.doorOpenDirection || fc.doorOpenDirection || 'outward',
      // Multipoint is a given on our doors — the choice is ONE handle or TWO
      // (Piotr 04.08). PSW still offers multipoint/standard; noted for a later
      // PSW fix. Legacy values map onto the new vocabulary.
      lockType: (() => {
        const v = item?.lockType || fc.lockType || 'single';
        if (v === 'double') return 'double';
        if (v === 'single') return 'single';
        return 'single';   // 'multipoint' / 'standard' legacy → single handle
      })(),
      barType: item?.doorBarType || fc.doorBarType || 'astragal',
      // Informational: the engine reads the leaf depth from the door profile
      // (57, 61 with a triple unit).
      leafDepth: Number(glassType === 'triple' ? (getDoorProfile().leafDepthTriple || getDoorProfile().leafDepth) : getDoorProfile().leafDepth) || DOOR_LEAF_DEPTH,
      threshold: item?.thresholdType || fc.thresholdType || 'standard',
      thresholdExtension: Number(item?.thresholdExtension ?? fc.thresholdExtension) || 0,
      bars: {
        h: Number(item?.doorHBars ?? fc.doorHBars) || 0,
        v: Number(item?.doorVBars ?? fc.doorVBars) || 0,
      },
      sidePanels: {
        mode: item?.sidePanels || fc.sidePanels || 'none',
        leftWidth: Number(item?.sideLeftWidth ?? fc.sideLeftWidth) || 500,
        rightWidth: Number(item?.sideRightWidth ?? fc.sideRightWidth) || 500,
        style: item?.sideStyle || fc.sideStyle || 'full-glass',
        barsH: Number(item?.sideHBars ?? fc.sideHBars) || 0,
        barsV: Number(item?.sideVBars ?? fc.sideVBars) || 0,
      },
      // Fanlight (coupled transom). The configurator offers it on a french
      // door only; the engine builds whatever transom.type says, on any door type.
      transom: {
        type: item?.transomType || fc.transomType || 'none',
        height: Number(item?.transomHeight ?? fc.transomHeight) || 450,
        bars: item?.transomBars || fc.transomBars || 'none',
      },
    },
    color: {
      ral: fc.ralCode || '',
      inside: colorInside,
      outside: colorOutside,
      single: colorSingle,
      type: colorType
    },
    hardware: {
      finish: ironFinish,
      catches: pas24 ? 'PAS24' : 'NON PAS24',
      // Per-window ironmongery product assignments { categoryKey: itemId }
      slots: item?.ironmongerySlots || fc.ironmongerySlots || {},
    },
    vent: {
      roomType: ventRoomType,   // 'habitable' | 'kitchen' | 'bathroom' | 'other'
      soleWindow: ventSoleWindow
    },
    // Configurator checkbox. Only a window saved with the box ticked asks for
    // child restrictors (Piotr 05.10.2026); not set = not asked.
    childRestrictor: (item?.childRestrictor ?? fc.childRestrictor) === true,
    cill: {
      extension: Number(item?.sillExtension ?? spec.sillExtension ?? item?.sill_extension) || 0,
      wider: !!(item?.sillWider ?? spec.sillWider),
    },
    glazing: {
      type: glassType,
      spec: glassSpec,
      finish: glassFinish,
      frostedLocation,
      coating: item?.glassCoating || fc.glassCoating || 'standard',
      gas: item?.glassGas ?? fc.glassGas ?? glassGas(glassType),
      thickness: isAcousticUnit({ spec: glassSpec, type: glassType }) ? ACOUSTIC_THICKNESS
        : isDoorCategory ? (DOOR_GLASS_THICKNESS[glassType] ?? GLASS_THICKNESS[glassType] ?? 24)
        : (GLASS_THICKNESS[glassType] ?? 24),
      // Explicit per-window override only; otherwise undefined so consumers
      // fall back to the workshop profile's glassMakeup (live, snapshot-aware).
      // A door double is the 6x12x6 door unit; a door slim / triple / Laminate
      // / Acoustic unit takes the window makeup through the same fallback.
      makeup: item?.makeup ?? item?.glazing?.makeup
        ?? ((isDoorCategory && !isAcousticUnit({ spec: glassSpec, type: glassType }) && DOOR_GLASS_MAKEUP[glassType]) || undefined),
      toughened: glassSpec === 'toughened',
      frosted: glassFinish === 'frosted',
      spacerColour: spacerColor,
      spacerType
    },
    materials: {
      sashRaw: [
        { section: '63x63', stockLength: 5900, enabled: true },
        { section: '63x95', stockLength: 5900, enabled: true },
        { section: '63x120', stockLength: 5900, enabled: false }
      ],
      boxRaw: { stockLength: 2500, widthAllowance: 20 }
    },
    rawSpec: spec
  };
}