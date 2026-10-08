/**
 * partSymbols.js — Collision-free short codes for all sash window parts.
 * Used in BLO labels, Pre-Cut List, and Cut List.
 *
 * Format on BLO/Cut List: PRJ01-W1-JB-L (project-window-part)
 * L/R parts have explicit separate symbols (no generic mirror flag).
 */

export const PART_SYMBOLS = {
  // Box
  head:            { partId: 'head',            symbol: 'HEAD', name: 'Head',                  group: 'box',  mirror: false },
  jamb_left:       { partId: 'jamb_left',       symbol: 'JB-L', name: 'Jamb Left',             group: 'box',  mirror: true  },
  jamb_right:      { partId: 'jamb_right',      symbol: 'JB-R', name: 'Jamb Right',            group: 'box',  mirror: true  },
  cill:            { partId: 'cill',            symbol: 'CILL', name: 'Cill',                  group: 'box',  mirror: false },
  cill_nose:       { partId: 'cill_nose',       symbol: 'CNOS', name: 'Cill Nose',             group: 'box',  mirror: false },
  cill_extension:  { partId: 'cill_extension',  symbol: 'CEXT', name: 'Cill Extension',        group: 'box',  mirror: false },
  ext_head_liner:  { partId: 'ext_head_liner',  symbol: 'EHL',  name: 'External Head Liner',   group: 'box',  mirror: false },
  int_head_liner:  { partId: 'int_head_liner',  symbol: 'IHL',  name: 'Internal Head Liner',   group: 'box',  mirror: false },
  ext_liner_left:  { partId: 'ext_liner_left',  symbol: 'EL-L', name: 'External Liner Left',   group: 'box',  mirror: true  },
  ext_liner_right: { partId: 'ext_liner_right', symbol: 'EL-R', name: 'External Liner Right',  group: 'box',  mirror: true  },
  int_liner_left:  { partId: 'int_liner_left',  symbol: 'IL-L', name: 'Internal Liner Left',   group: 'box',  mirror: true  },
  int_liner_right: { partId: 'int_liner_right', symbol: 'IL-R', name: 'Internal Liner Right',  group: 'box',  mirror: true  },

  // Sash
  top_rail:            { partId: 'top_rail',            symbol: 'TR',    name: 'Top Rail',             group: 'sash', mirror: false },
  bottom_rail:         { partId: 'bottom_rail',         symbol: 'BR',    name: 'Bottom Rail',          group: 'sash', mirror: false },
  top_meet_rail:       { partId: 'top_meet_rail',       symbol: 'TMR',   name: 'Top Meeting Rail',     group: 'sash', mirror: false },
  bottom_meet_rail:    { partId: 'bottom_meet_rail',    symbol: 'BMR',   name: 'Bottom Meeting Rail',  group: 'sash', mirror: false },
  stile_top_left:      { partId: 'stile_top_left',      symbol: 'ST-L', name: 'Stile Top Left',  group: 'sash', mirror: true  },
  stile_top_right:     { partId: 'stile_top_right',     symbol: 'ST-R', name: 'Stile Top Right', group: 'sash', mirror: true  },
  stile_bottom_left:   { partId: 'stile_bottom_left',   symbol: 'SBS-L', name: 'Stile Bottom Sash Left',  group: 'sash', mirror: true  },
  stile_bottom_right:  { partId: 'stile_bottom_right',  symbol: 'SBS-R', name: 'Stile Bottom Sash Right', group: 'sash', mirror: true  },

  // Beading
  glazing_beading:            { partId: 'glazing_beading',            symbol: 'GB',  name: 'Glazing Beading',          group: 'beading', mirror: false },
  triangle_beading_ext:       { partId: 'triangle_beading_ext',       symbol: 'TBE', name: 'Triangle Beading Ext',     group: 'beading', mirror: false },
  parting_beading:             { partId: 'parting_beading',             symbol: 'PB',  name: 'Parting Beading',           group: 'beading', mirror: false },
  staff_beading:               { partId: 'staff_beading',               symbol: 'SB',  name: 'Staff Beading',            group: 'beading', mirror: false },
  meeting_beading_a:           { partId: 'meeting_beading_a',           symbol: 'MBA', name: 'Meeting Beading A',        group: 'beading', mirror: false },
  meeting_beading_b:           { partId: 'meeting_beading_b',           symbol: 'MBB', name: 'Meeting Beading B',        group: 'beading', mirror: false },
};

/**
 * Direct lookup: engine elementName → symbol info.
 * Engine uses UPPERCASE names with (L)/(R) suffixes.
 */
const _TR   = PART_SYMBOLS.top_rail;
const _BR   = PART_SYMBOLS.bottom_rail;
const _TMR  = PART_SYMBOLS.top_meet_rail;
const _BMR  = PART_SYMBOLS.bottom_meet_rail;
const _STL  = PART_SYMBOLS.stile_top_left;
const _STR  = PART_SYMBOLS.stile_top_right;
const _SBL  = PART_SYMBOLS.stile_bottom_left;
const _SBR  = PART_SYMBOLS.stile_bottom_right;
const _HEAD = PART_SYMBOLS.head;
const _CILL = PART_SYMBOLS.cill;
const _CNOS = PART_SYMBOLS.cill_nose;
const _CEXT = PART_SYMBOLS.cill_extension;
const _JBL  = PART_SYMBOLS.jamb_left;
const _JBR  = PART_SYMBOLS.jamb_right;
const _IHL  = PART_SYMBOLS.int_head_liner;
const _EHL  = PART_SYMBOLS.ext_head_liner;
const _ILL  = PART_SYMBOLS.int_liner_left;
const _ILR  = PART_SYMBOLS.int_liner_right;
const _ELL  = PART_SYMBOLS.ext_liner_left;
const _ELR  = PART_SYMBOLS.ext_liner_right;
const _GB   = PART_SYMBOLS.glazing_beading;
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
  'stiles top':              _STL,
  'stiles top (l)':          _STL,
  'stiles top (r)':          _STR,
  'stiles bottom sash':      _SBL,
  'stiles bottom sash (l)':  _SBL,
  'stiles bottom sash (r)':  _SBR,
  // Box
  'head':                    _HEAD,
  'cill':                    _CILL,
  'cill nose':               _CNOS,
  'cill extension':          _CEXT,
  'jamb left':               _JBL,
  'jamb right':              _JBR,
  'jambs':                   _JBL,
  'internal head liner':     _IHL,
  'external head liner':     _EHL,
  'internal liner left':     _ILL,
  'internal liner right':    _ILR,
  'internal liner (l)':      _ILL,
  'internal liner (r)':      _ILR,
  'internal jamb liner':     _ILL,
  'internal jamb liner (l)': _ILL,
  'internal jamb liner (r)': _ILR,
  'external liner left':     _ELL,
  'external liner right':    _ELR,
  'external liner (l)':      _ELL,
  'external liner (r)':      _ELR,
  'external jamb liner':     _ELL,
  'external jamb liner (l)': _ELL,
  'external jamb liner (r)': _ELR,
  // Beading
  'glazing beading':              _GB,
  'glazing bar beading':          _GB,
  'triangle beading (ext)':      _TBE,
  'parting beading':             _PB,
  'staff beading':               _SB,
  'meeting beading a':           _MBA,
  'meeting beading b':           _MBB,
  // Bars
  'vertical glazing bar':        { symbol: 'VGB', name: 'Vertical Glazing Bar', group: 'bar', mirror: false },
  'horizontal glazing bar':      { symbol: 'HGB', name: 'Horizontal Glazing Bar', group: 'bar', mirror: false },
  // Doors (08.10.2026, doors to production): one symbol per door part. Until
  // then the fallback gave DFRA to head, jamb and cill alike and DSID to every
  // side panel member. The leaf stile / top / bottom keep the symbols the
  // fallback already printed (DSTI / DTOP / DBOT). partId = the Assign
  // Materials row (the fan leaf buys the casement leaf rows).
  'd-frame head':                { partId: 'd_frame_head', symbol: 'FH', name: 'Door Frame Head', group: 'door', mirror: false },
  'd-frame jamb (l)':            { partId: 'd_frame_jamb', symbol: 'J-L', name: 'Door Frame Jamb Left', group: 'door', mirror: true },
  'd-frame jamb (r)':            { partId: 'd_frame_jamb', symbol: 'J-R', name: 'Door Frame Jamb Right', group: 'door', mirror: true },
  'd-frame cill':                { partId: 'd_frame_cill', symbol: 'CILL', name: 'Door Frame Cill', group: 'door', mirror: false },
  'd-frame cill (inward)':       { partId: 'd_frame_cill_inward', symbol: 'CILL-IN', name: 'Door Frame Cill (inward)', group: 'door', mirror: false },
  'd-coupling post':             { partId: 'd_coupling_post', symbol: 'CP', name: 'Door Coupling Post', group: 'door', mirror: false },
  'd-transom':                   { partId: 'd_transom_rail', symbol: 'T', name: 'Door Transom Rail', group: 'door', mirror: false },
  'd-stile (l)':                 { partId: 'd_leaf_stile', symbol: 'ST-L', name: 'Door Leaf Stile Left', group: 'door', mirror: true },
  'd-stile (r)':                 { partId: 'd_leaf_stile', symbol: 'ST-R', name: 'Door Leaf Stile Right', group: 'door', mirror: true },
  'd-meeting stile':             { partId: 'd_leaf_meeting_stile', symbol: 'MS', name: 'Door Meeting Stile', group: 'door', mirror: false },
  'd-top rail':                  { partId: 'd_leaf_top_rail', symbol: 'TR', name: 'Door Leaf Top Rail', group: 'door', mirror: false },
  'd-bottom rail':               { partId: 'd_leaf_bottom_rail', symbol: 'BR', name: 'Door Leaf Bottom Rail', group: 'door', mirror: false },
  'd-mid rail':                  { partId: 'd_leaf_mid_rail', symbol: 'MR', name: 'Door Leaf Mid Rail', group: 'door', mirror: false },
  'd-side stile':                { partId: 'd_side_stile', symbol: 'SP-ST', name: 'Side Panel Stile', group: 'door', mirror: true },
  'd-side top rail':             { partId: 'd_side_top_rail', symbol: 'SP-TR', name: 'Side Panel Top Rail', group: 'door', mirror: false },
  'd-side bottom rail':          { partId: 'd_side_bottom_rail', symbol: 'SP-BR', name: 'Side Panel Bottom Rail', group: 'door', mirror: false },
  'd-fan stile (l)':             { partId: 'c_sash_stile', symbol: 'FS-L', name: 'Fan Leaf Stile Left', group: 'door', mirror: true },
  'd-fan stile (r)':             { partId: 'c_sash_stile', symbol: 'FS-R', name: 'Fan Leaf Stile Right', group: 'door', mirror: true },
  'd-fan top rail':              { partId: 'c_sash_top_rail', symbol: 'FTR', name: 'Fan Leaf Top Rail', group: 'door', mirror: false },
  'd-fan bottom rail':           { partId: 'c_sash_bottom_rail', symbol: 'FBR', name: 'Fan Leaf Bottom Rail', group: 'door', mirror: false },
  // Casement (08.10.2026, Piotr: no C prefix anywhere; before this the fallback
  // printed CFRA for head, jamb and cill alike). partId = the Assign Materials row.
  'c-frame head':                { partId: 'c_frame_head', symbol: 'FH', name: 'Frame Head', group: 'casement', mirror: false },
  'c-frame jamb (l)':            { partId: 'c_frame_jamb', symbol: 'J-L', name: 'Frame Jamb Left', group: 'casement', mirror: true },
  'c-frame jamb (r)':            { partId: 'c_frame_jamb', symbol: 'J-R', name: 'Frame Jamb Right', group: 'casement', mirror: true },
  'c-frame cill':                { partId: 'c_frame_cill', symbol: 'CILL', name: 'Frame Cill', group: 'casement', mirror: false },
  'c-mullion':                   { partId: 'c_mullion', symbol: 'M', name: 'Mullion', group: 'casement', mirror: false },
  'c-transom':                   { partId: 'c_transom', symbol: 'T', name: 'Transom', group: 'casement', mirror: false },
  'c-stile (l)':                 { partId: 'c_sash_stile', symbol: 'ST-L', name: 'Leaf Stile Left', group: 'casement', mirror: true },
  'c-stile (r)':                 { partId: 'c_sash_stile', symbol: 'ST-R', name: 'Leaf Stile Right', group: 'casement', mirror: true },
  'c-top rail':                  { partId: 'c_sash_top_rail', symbol: 'TR', name: 'Leaf Top Rail', group: 'casement', mirror: false },
  'c-bottom rail':               { partId: 'c_sash_bottom_rail', symbol: 'BR', name: 'Leaf Bottom Rail', group: 'casement', mirror: false },
  'c-arch head':                 { partId: 'c_frame_head', symbol: 'AH', name: 'Arched Frame Head', group: 'casement', mirror: false },
  'c-arch top rail':             { partId: 'c_sash_top_rail', symbol: 'ATR', name: 'Arched Leaf Top Rail', group: 'casement', mirror: false },
  'c-frame ring':                { partId: 'c_frame_head', symbol: 'FRR', name: 'Frame Ring', group: 'casement', mirror: false },
  'c-leaf ring':                 { partId: 'c_sash_top_rail', symbol: 'LFR', name: 'Leaf Ring', group: 'casement', mirror: false },
  'c-tracery':                   { partId: 'c_tracery', symbol: 'TRY', name: 'Tracery Board', group: 'casement', mirror: false },
  // Arched sash members (the S- prefix dropped the same way)
  's-arch head':                 { partId: 'head', symbol: 'AH', name: 'Arched Box Head', group: 'box', mirror: false },
  's-arch top rail':             { partId: 'top_rail', symbol: 'ATR', name: 'Arched Top Rail', group: 'sash', mirror: false },
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

  // Fallback: the window type prefix (C- / D- / S-) says nothing inside a pack
  // of one type (Piotr 08.10.2026), so it never reaches a symbol.
  return {
    symbol: displayElementName(elementName).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
    name: displayElementName(elementName),
    group: 'other',
    mirror: false,
  };
}

/**
 * An engine element name as the screens, PDFs and labels print it: without
 * the window type prefix (C- casement, D- door, S- sash arch), which says
 * nothing inside a pack of one type (Piotr 08.10.2026). The engine names
 * themselves never change: they key the Assign Materials and colour maps.
 */
export function displayElementName(elementName) {
  return String(elementName || '').replace(/^[CDS]-/, '');
}
