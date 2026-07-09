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

  // Frame depth — new: item.frameDepth
  const frameDepth = item?.frameDepth || (glassType === 'triple' ? 172 : 164);
  // Frame type — feeds engine's isSlim (clip size, weight type). Was never set before,
  // so slim-specific consumables silently fell back to standard.
  const frameType = item?.frameType || item?.frame_type || fc.frameType || 'standard';

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
    sash: {
      openingType,
      horns: hasHorns,
      hornType: hornsVal,
      hornExtension: 75,
      grid: {
        mode: gridMode,
        rows,
        cols,
        customBars: customBarsFromSpec(spec, item)
      }
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
      catches: pas24 ? 'PAS24' : 'NON PAS24'
    },
    vent: {
      roomType: ventRoomType,   // 'habitable' | 'kitchen' | 'bathroom' | 'other'
      soleWindow: ventSoleWindow
    },
    cill: { extension: Number(spec.sillExtension || item?.sill_extension || 0) },
    glazing: {
      type: glassType,
      spec: glassSpec,
      finish: glassFinish,
      frostedLocation,
      thickness: glassType === 'triple' ? 28 : 24,
      makeup: glassType === 'triple' ? '4x8x4x8x4' : '4x16x4',
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