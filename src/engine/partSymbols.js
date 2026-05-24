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
 * Look up symbol info by element name (fuzzy match).
 * Falls back to first 3 chars uppercased if not found.
 */
export function getPartSymbol(elementName) {
  // Try exact id match first
  const byId = PART_SYMBOLS[elementName];
  if (byId) return byId;

  // Try matching by name
  const lower = (elementName || '').toLowerCase();
  for (const [, info] of Object.entries(PART_SYMBOLS)) {
    if (info.name.toLowerCase() === lower) return info;
  }

  // Partial match
  for (const [, info] of Object.entries(PART_SYMBOLS)) {
    if (lower.includes(info.name.toLowerCase().split(' ')[0].toLowerCase())) return info;
  }

  // Fallback
  return {
    symbol: (elementName || 'UNK').slice(0, 4).toUpperCase(),
    name: elementName || 'Unknown',
    group: 'other',
    mirror: false,
  };
}
