/**
 * specification.js — adapter between Supabase estimate_items rows and
 * the windowSpec shape expected by calculations.js (`deriveWindowData`).
 *
 * estimate_items.specification is a JSON string from the online configurator
 * (Prime Sash Windows) — it contains the full configurator state ("fullConfig"
 * is nested inside). Different sash window types (sash / casement / fix-frame /
 * door) expose dimensions slightly differently, but for production planning we
 * focus on sash windows; other types are passed through with sensible defaults
 * so the UI does not crash.
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
  const upper = (item?.upper_bars || spec?.upperBars || '').toLowerCase();
  const lower = (item?.lower_bars || spec?.lowerBars || '').toLowerCase();
  // Supported configurator values: "none", "2x2", "3x3", "4x4", "6x6", "9x9", or "custom"
  const candidate = lower && lower !== 'none' ? lower : upper;
  if (!candidate || candidate === 'none') return '2x2';
  if (/^\d+x\d+$/.test(candidate)) return candidate;
  if (candidate === 'custom') return 'custom';
  return '2x2';
}

function customBarsFromSpec(spec) {
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
 * Build a windowSpec object for the calculation engine from a Supabase
 * estimate_items row + parsed specification JSON. Falls back to safe
 * defaults when fields are missing.
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

  const horns = item?.horns || fc.horns || spec.horns || 'none';
  const hasHorns = horns && horns !== 'none';

  const colorSingle = item?.color_single || fc.colorSingleName || fc.singleColor || 'White';
  const colorInside = item?.color_interior || fc.interiorColor || colorSingle;
  const colorOutside = item?.color_exterior || fc.exteriorColor || colorSingle;

  return {
    id: item?.id || `mock_${Math.random().toString(36).slice(2, 8)}`,
    name: item?.window_number || spec.windowName || 'Window',
    type: item?.window_type || spec.windowType || 'sash',
    quantity: Number(item?.quantity || 1),
    frame: { width, height },
    sash: {
      horns: hasHorns,
      hornExtension: 75,
      grid: {
        mode: gridMode,
        rows,
        cols,
        customBars: customBarsFromSpec(spec)
      }
    },
    color: {
      ral: fc.ralCode || '',
      inside: colorInside,
      outside: colorOutside,
      single: colorSingle,
      type: item?.color_type || fc.colorType || 'single'
    },
    hardware: {
      finish: item?.ironmongery_finish || fc.ironmongeryFinish || 'brass',
      catches: item?.pas24 ? 'PAS24' : 'NON PAS24'
    },
    cill: { extension: Number(spec.sillExtension || item?.sill_extension || 0) },
    glazing: {
      type: item?.glass_type || spec.glassType || 'double',
      spec: item?.glass_spec || spec.glassSpec || '',
      finish: item?.glass_finish || spec.glassFinish || 'clear',
      thickness: 24,
      makeup: '4x16x4',
      toughened: Boolean(spec.safetyGlass || item?.safety_glass),
      frosted: (item?.glass_finish || spec.glassFinish) === 'frosted',
      spacerColour: item?.spacer_color || fc.spacerColor || 'silver'
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
