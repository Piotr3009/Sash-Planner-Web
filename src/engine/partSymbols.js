/**
 * partSymbols.js — Collision-free short codes for all sash window parts.
 * Used in BLO labels, Pre-Cut List, and Cut List.
 *
 * Format on BLO/Cut List: PRJ01-W1-BMR (project-window-part)
 * Max 4 chars per symbol.
 */

export const PART_SYMBOLS = {
  // Box
  head:            { symbol: 'HEAD', name: 'Head',                  group: 'box',  mirror: false },
  jambs:           { symbol: 'JAMB', name: 'Jambs',                 group: 'box',  mirror: true  },
  cill:            { symbol: 'CILL', name: 'Cill',                  group: 'box',  mirror: false },
  cill_nose:       { symbol: 'CNOS', name: 'Cill Nose',             group: 'box',  mirror: false },
  cill_extension:  { symbol: 'CEXT', name: 'Cill Extension',        group: 'box',  mirror: false },
  ext_head_liner:  { symbol: 'EL',   name: 'External Head Liner',   group: 'box',  mirror: false },
  int_head_liner:  { symbol: 'IL',   name: 'Internal Head Liner',   group: 'box',  mirror: false },
  ext_jamb_liner:  { symbol: 'EL',   name: 'External Jamb Liner',   group: 'box',  mirror: true  },
  int_jamb_liner:  { symbol: 'IL',   name: 'Internal Jamb Liner',   group: 'box',  mirror: true  },

  // Sash
  top_rail:            { symbol: 'TR',  name: 'Top Rail',             group: 'sash', mirror: false },
  bottom_rail:         { symbol: 'BR',  name: 'Bottom Rail',          group: 'sash', mirror: false },
  top_meet_rail:       { symbol: 'TMR', name: 'Top Meeting Rail',     group: 'sash', mirror: false },
  bottom_meet_rail:    { symbol: 'BMR', name: 'Bottom Meeting Rail',  group: 'sash', mirror: false },
  stiles_top_sash:     { symbol: 'STS', name: 'Stiles Top Sash',     group: 'sash', mirror: true  },
  stiles_bottom_sash:  { symbol: 'SBS', name: 'Stiles Bottom Sash',  group: 'sash', mirror: true  },

  // Beading
  glazing_bar_beading:      { symbol: 'GBB', name: 'Glazing Bar Beading',       group: 'beading', mirror: false },
  internal_georgian_beading:{ symbol: 'IGB', name: 'Internal Georgian Beading', group: 'beading', mirror: false },
  triangle_beading_ext:     { symbol: 'TBE', name: 'Triangle Beading Ext',      group: 'beading', mirror: false },
  parting_beading:           { symbol: 'PB',  name: 'Parting Beading',           group: 'beading', mirror: false },
  staff_beading:             { symbol: 'SB',  name: 'Staff Beading',            group: 'beading', mirror: false },
  meeting_beading_a:         { symbol: 'MBA', name: 'Meeting Beading A',        group: 'beading', mirror: false },
  meeting_beading_b:         { symbol: 'MBB', name: 'Meeting Beading B',        group: 'beading', mirror: false },
};

/**
 * Direct lookup: engine elementName → symbol info.
 * Engine uses UPPERCASE names with (L)/(R) suffixes.
 */
// Named shortcuts for ENGINE_NAME_MAP
const _TR   = PART_SYMBOLS.top_rail;
const _BR   = PART_SYMBOLS.bottom_rail;
const _TMR  = PART_SYMBOLS.top_meet_rail;
const _BMR  = PART_SYMBOLS.bottom_meet_rail;
const _STS  = PART_SYMBOLS.stiles_top_sash;
const _SBS  = PART_SYMBOLS.stiles_bottom_sash;
const _HEAD = PART_SYMBOLS.head;
const _CILL = PART_SYMBOLS.cill;
const _CNOS = PART_SYMBOLS.cill_nose;
const _CEXT = PART_SYMBOLS.cill_extension;
const _JAMB = PART_SYMBOLS.jambs;
const _IL   = PART_SYMBOLS.int_head_liner;
const _EL   = PART_SYMBOLS.ext_head_liner;
const _GBB  = PART_SYMBOLS.glazing_bar_beading;
const _IGB  = PART_SYMBOLS.internal_georgian_beading;
const _TBE  = PART_SYMBOLS.triangle_beading_ext;
const _PB   = PART_SYMBOLS.parting_beading;
const _SB   = PART_SYMBOLS.staff_beading;
const _MBA  = PART_SYMBOLS.meeting_beading_a;
const _MBB  = PART_SYMBOLS.meeting_beading_b;

const ENGINE_NAME_MAP = {
  // Sash
  'top rail':                _TR,
  'bottom rail':             _BR,
  'top meet rail':           _TMR,
  'top meeting rail':        _TMR,
  'bottom meet rail':        _BMR,
  'bottom meeting rail':     _BMR,
  'stiles top sash':         _STS,
  'stiles top sash (l)':     _STS,
  'stiles top sash (r)':     _STS,
  'stiles bottom sash':      _SBS,
  'stiles bottom sash (l)':  _SBS,
  'stiles bottom sash (r)':  _SBS,
  // Box
  'head':                    _HEAD,
  'cill':                    _CILL,
  'cill nose':               _CNOS,
  'cill extension':          _CEXT,
  'jamb left':               _JAMB,
  'jamb right':              _JAMB,
  'jambs':                   _JAMB,
  'internal head liner':     _IL,
  'external head liner':     _EL,
  'internal jamb liner':     _IL,
  'internal jamb liner (l)': _IL,
  'internal jamb liner (r)': _IL,
  'external jamb liner':     _EL,
  'external jamb liner (l)': _EL,
  'external jamb liner (r)': _EL,
  // Beading
  'glazing bar beading':         _GBB,
  'internal georgian beading':   _IGB,
  'triangle beading (ext)':      _TBE,
  'parting beading':             _PB,
  'staff beading':               _SB,
  'meeting beading a':           _MBA,
  'meeting beading b':           _MBB,
  // Bars
  'vertical glazing bar':        { symbol: 'VGB', name: 'Vertical Glazing Bar', group: 'bar', mirror: false },
  'horizontal glazing bar':      { symbol: 'HGB', name: 'Horizontal Glazing Bar', group: 'bar', mirror: false },
};

/**
 * Look up symbol info by element name (from engine).
 * Uses exact lowercase match against ENGINE_NAME_MAP.
 * Falls back to first 4 chars uppercased if not found.
 */
export function getPartSymbol(elementName) {
  if (!elementName) return { symbol: 'UNK', name: 'Unknown', group: 'other', mirror: false };

  const lower = elementName.toLowerCase().trim();

  // Direct lookup
  if (ENGINE_NAME_MAP[lower]) return ENGINE_NAME_MAP[lower];

  // Try by PART_SYMBOLS id
  const byId = PART_SYMBOLS[lower.replace(/\s+/g, '_')];
  if (byId) return byId;

  // Fallback
  return {
    symbol: elementName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
    name: elementName,
    group: 'other',
    mirror: false,
  };
}
