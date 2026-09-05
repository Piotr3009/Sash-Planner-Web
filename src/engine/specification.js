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

function detectGridMode(spec, item) {
  const upper = (item?.upperBars || item?.upper_bars || spec?.upperBars || '').toLowerCase();
  const lower = (item?.lowerBars || item?.lower_bars || spec?.lowerBars || '').toLowerCase();
  const candidate = lower && lower !== 'none' ? lower : upper;
  if (!candidate || candidate === 'none') return 'none';
  if (/^\d+x\d+$/.test(candidate)) return candidate;
  if (candidate === 'custom') return 'custom';
  return 'none';
}

// Sealed unit makeup/thickness per glass type — single source of truth.
// Passive (vacuum) and single have no unit makeup; gas fill only applies to sealed units.
export const GLASS_MAKEUP = { double: '4x16x4', double_slim: '4x8x4', triple: '4x8x4x8x4', passive: '', single: '' };
export const GLASS_THICKNESS = { double: 24, double_slim: 16, triple: 28 };

// Doors take THICKER panes than windows (Piotr 04.08): minimum 6mm glass, and
// double/triple deliberately land on the SAME 28mm unit, so one rebate depth
// serves both. Leaf member 61mm, frame 93mm with a deeper rebate.
export const DOOR_GLASS_MAKEUP = { double: '6x16x6', triple: '4x8x4x8x4' };
export const DOOR_GLASS_THICKNESS = 28;
export const DOOR_LEAF_DEPTH = 61;
export const DOOR_FRAME_DEPTH = 93;
export const glassGas = (type) => (type === 'single' || type === 'passive') ? '' : 'argon';
import { FAN_AXIS_OFFSET_TOP, FAN_AXIS_OFFSET_BOTTOM } from './casementLayouts.js';
import { profileBoxDepth } from './profile.js';
import {
  PSW_ARCH_SHAPE, PSW_ARCH_RISE_RATIO, LEGACY_ARCH_SHAPES, ARCH_RISE_RATIO, GOTHIC_PROFILE_RATIO,
  ARCH_BAR_PATTERNS, isArchShape, isRoundShape, resolveRoundShape, ArchError,
} from './arch.js';

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
  const pcShapeRaw = item?.archShape || fc.archShape;
  const pswShape = item?.casArchShape || fc.casArchShape;
  const isArched = (item?.casementType || fc.casementType) === 'arched' || !!pcShapeRaw;
  if (!isArched) return null;
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

  const gridMode = detectGridMode(spec, item);
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
  const rawCategory = item?.windowCategory || fc.windowCategory || 'sash';
  const category = rawCategory === 'doors' ? 'door' : rawCategory;
  const isDoorCategory = category === 'door';
  // Frame depth — stored on the window; legacy windows fall back to the profile
  const frameDepth = item?.frameDepth
    || (isDoorCategory ? DOOR_FRAME_DEPTH
      : profileBoxDepth(glassType === 'triple' ? 'triple' : frameType));

  // Opening type — new: item.openingType
  const openingType = item?.openingType || item?.opening_type || fc.openingType || 'both';

  // Trickle vent — room type drives grille count (Approved Document F, Vol 1).
  // Defaults are deliberately the safest (most ventilation): habitable + sole window.
  const ventRoomType = item?.ventRoomType || spec.ventRoomType || fc.ventRoomType || 'habitable';
  const ventSoleWindow = item?.ventSoleWindow !== undefined ? !!item.ventSoleWindow
    : spec.ventSoleWindow !== undefined ? !!spec.ventSoleWindow
    : fc.ventSoleWindow !== undefined ? !!fc.ventSoleWindow
    : true;

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
        customBars: customBarsFromSpec(spec, item)
      }
    },
    casement: {
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
    // ── Arched casement (arched-casement-v1) — null unless casementType 'arched'
    arch: archFromSpec(item, fc, width, height),
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
      leafDepth: DOOR_LEAF_DEPTH,
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
      // Coupled transom — french only; the engine/3D ignore it otherwise.
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
      thickness: isDoorCategory ? DOOR_GLASS_THICKNESS : (GLASS_THICKNESS[glassType] ?? 24),
      // Explicit per-window override only; otherwise undefined so consumers
      // fall back to the workshop profile's glassMakeup (live, snapshot-aware).
      makeup: item?.makeup ?? item?.glazing?.makeup
        ?? (isDoorCategory ? (DOOR_GLASS_MAKEUP[glassType] || DOOR_GLASS_MAKEUP.double) : undefined),
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