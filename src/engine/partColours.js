/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

// Colour by part for the Pre-Cut and Cut List (Piotr 05.10.2026).
// One colour = one compartment on the bench: pre-cut pieces are sorted by
// colour and the cut stage takes them from that compartment. The left and
// right of a pair share a colour. Casement and doors (08.10.2026); any other
// part has no colour and keeps the single default colour. The door family
// mirrors the casement colours (frame head, jambs, cill, post, transom, leaf
// stiles, meeting stile, rails, mid rail, side panel, fan) and has its own key
// sheet (precutPdfExport, COLOUR KEY · DOOR). The bottom rail red is the
// stronger one of the window palette (Piotr 08.10.2026, so it reads on paper).

export const PART_COLOUR_GROUPS = [
  { id: 'frame_head', family: 'frame', name: 'Frame Head', note: 'top of the frame', hex: '#F5E050' },
  { id: 'frame_jambs', family: 'frame', name: 'Frame Jambs', note: 'left and right together', hex: '#7CC4F5' },
  { id: 'frame_cill', family: 'frame', name: 'Frame Cill', note: 'bottom of the frame', hex: '#F2A03D' },
  { id: 'mullion', family: 'frame', name: 'Mullion', note: 'vertical divider', hex: '#5CCBA9' },
  { id: 'transom', family: 'frame', name: 'Transom', note: 'horizontal divider', hex: '#D99AC5' },
  { id: 'leaf_stiles', family: 'leaf', name: 'Leaf Stiles', note: 'left and right together', hex: '#FFFFFF' },
  { id: 'leaf_top_rail', family: 'leaf', name: 'Leaf Top Rail', note: 'top of the leaf', hex: '#A98BE8' },
  { id: 'leaf_bottom_rail', family: 'leaf', name: 'Leaf Bottom Rail', note: 'bottom of the leaf', hex: '#E04A2A' },
  // Doors: own families (door_frame / door_leaf), so the casement key sheet
  // never lists them; colours mirror the casement compartments.
  { id: 'door_frame_head', family: 'door_frame', name: 'Door Frame Head', note: 'top of the frame', hex: '#F5E050' },
  { id: 'door_frame_jambs', family: 'door_frame', name: 'Door Frame Jambs', note: 'left and right together', hex: '#7CC4F5' },
  { id: 'door_frame_cill', family: 'door_frame', name: 'Door Frame Cill', note: 'outward or inward cill', hex: '#F2A03D' },
  { id: 'door_post', family: 'door_frame', name: 'Coupling Post', note: 'between door and side panel', hex: '#5CCBA9' },
  { id: 'door_transom', family: 'door_frame', name: 'Transom Rail', note: 'under the fanlight', hex: '#D99AC5' },
  { id: 'door_leaf_stiles', family: 'door_leaf', name: 'Door Leaf Stiles', note: 'hinge and lock stiles', hex: '#FFFFFF' },
  { id: 'door_meeting_stile', family: 'door_leaf', name: 'Meeting Stile', note: 'french, with the lip', hex: '#C9D4DE' },
  { id: 'door_top_rail', family: 'door_leaf', name: 'Door Top Rail', note: 'top of the leaf', hex: '#A98BE8' },
  { id: 'door_mid_rail', family: 'door_leaf', name: 'Door Mid Rail', note: 'between glass and panel', hex: '#8FB3E8' },
  { id: 'door_bottom_rail', family: 'door_leaf', name: 'Door Bottom Rail', note: 'bottom of the leaf', hex: '#E04A2A' },
  { id: 'door_side_panel', family: 'door_leaf', name: 'Side Panel', note: 'fixed side panel members', hex: '#B5D99C' },
  { id: 'door_fan', family: 'door_leaf', name: 'Fan Leaf', note: 'opening fanlight members', hex: '#E8C38F' },
];

const BY_ID = Object.fromEntries(PART_COLOUR_GROUPS.map((g) => [g.id, g]));

// Engine element name (pre-cut items) to colour group.
const ELEMENT_TO_GROUP = {
  'C-FRAME HEAD': 'frame_head', 'C-ARCH HEAD': 'frame_head', 'C-FRAME RING': 'frame_head',
  'C-FRAME JAMB (L)': 'frame_jambs', 'C-FRAME JAMB (R)': 'frame_jambs',
  'C-FRAME CILL': 'frame_cill',
  'C-MULLION': 'mullion',
  'C-TRANSOM': 'transom',
  'C-STILE (L)': 'leaf_stiles', 'C-STILE (R)': 'leaf_stiles',
  'C-TOP RAIL': 'leaf_top_rail', 'C-ARCH TOP RAIL': 'leaf_top_rail', 'C-LEAF RING': 'leaf_top_rail',
  'C-BOTTOM RAIL': 'leaf_bottom_rail',
  'D-FRAME HEAD': 'door_frame_head',
  'D-FRAME JAMB (L)': 'door_frame_jambs', 'D-FRAME JAMB (R)': 'door_frame_jambs',
  'D-FRAME CILL': 'door_frame_cill', 'D-FRAME CILL (INWARD)': 'door_frame_cill',
  'D-COUPLING POST': 'door_post',
  'D-TRANSOM': 'door_transom',
  'D-STILE (L)': 'door_leaf_stiles', 'D-STILE (R)': 'door_leaf_stiles',
  'D-MEETING STILE': 'door_meeting_stile',
  'D-TOP RAIL': 'door_top_rail',
  'D-MID RAIL': 'door_mid_rail',
  'D-BOTTOM RAIL': 'door_bottom_rail',
  'D-SIDE STILE': 'door_side_panel', 'D-SIDE TOP RAIL': 'door_side_panel', 'D-SIDE BOTTOM RAIL': 'door_side_panel',
  'D-FAN STILE (L)': 'door_fan', 'D-FAN STILE (R)': 'door_fan', 'D-FAN TOP RAIL': 'door_fan', 'D-FAN BOTTOM RAIL': 'door_fan',
};

// Cut List group symbol (lists.js CUT_LIST_ORDER) to the same colour group.
// Since 08.10.2026 the symbols carry no C- / D- prefix, so a symbol alone no
// longer says casement or door: colour the Cut List by the group's ELEMENT
// (partColourForElement(group.element)); this table stays for callers that
// still pass a symbol. Casement and door symbols that coincide (FH, J-L/R,
// CILL, T, ST-L/R, TR, BR) share the same hex in both families.
const CUT_SYMBOL_TO_GROUP = {
  'FH': 'frame_head', 'AH': 'frame_head', 'FRR': 'frame_head',
  'J-L/R': 'frame_jambs',
  'CILL': 'frame_cill',
  'M': 'mullion',
  'T': 'transom',
  'ST-L/R': 'leaf_stiles',
  'TR': 'leaf_top_rail', 'ATR': 'leaf_top_rail', 'LFR': 'leaf_top_rail',
  'BR': 'leaf_bottom_rail',
  'CILL-IN': 'door_frame_cill',
  'CP': 'door_post',
  'MS': 'door_meeting_stile',
  'MR': 'door_mid_rail',
  'SP-ST': 'door_side_panel', 'SP-TR': 'door_side_panel', 'SP-BR': 'door_side_panel',
  'FS-L/R': 'door_fan', 'FTR': 'door_fan', 'FBR': 'door_fan',
  // the pre-08.10 symbols, for anything saved with them
  'C-FH': 'frame_head', 'C-AH': 'frame_head', 'C-FRR': 'frame_head', 'C-J-L/R': 'frame_jambs', 'C-CILL': 'frame_cill',
  'C-M': 'mullion', 'C-T': 'transom', 'C-ST-L/R': 'leaf_stiles', 'C-TR': 'leaf_top_rail', 'C-ATR': 'leaf_top_rail',
  'C-LFR': 'leaf_top_rail', 'C-BR': 'leaf_bottom_rail',
  'D-FH': 'door_frame_head', 'D-J-L/R': 'door_frame_jambs', 'D-CILL': 'door_frame_cill', 'D-CILL-IN': 'door_frame_cill',
  'D-JC': 'door_post', 'D-T': 'door_transom', 'D-ST-L/R': 'door_leaf_stiles', 'D-MS': 'door_meeting_stile',
  'D-TR': 'door_top_rail', 'D-MR': 'door_mid_rail', 'D-BR': 'door_bottom_rail',
  'D-SP-ST': 'door_side_panel', 'D-SP-TR': 'door_side_panel', 'D-SP-BR': 'door_side_panel',
  'D-FS-L/R': 'door_fan', 'D-FTR': 'door_fan', 'D-FBR': 'door_fan',
};

// ─── Colour by WINDOW (Piotr 08.10.2026) ───
// The second colour mode of the Pre-Cut: one colour = one window of the pack,
// by the window's position in the pack (window 1 is always colour 1). Ten
// colours (the part palette plus white and brown; red and brown stronger since
// 08.10.2026 so they read on paper); from the eleventh window the colours
// repeat (11 = colour 1) and nothing more happens, by owner decision. Works
// for every pack type, sash included. The Cut List is not coloured in this
// mode, only the Pre-Cut (screen, PDF, labels).
export const WINDOW_COLOURS = [
  '#F5E050', '#F2A03D', '#E04A2A', '#D99AC5', '#A98BE8',
  '#7CC4F5', '#5CCBA9', '#9BD36A', '#FFFFFF', '#A06A2C',
];
export const COLOUR_MODES = ['off', 'part', 'window'];
export const COLOUR_MODE_LABELS = { off: 'Off', part: 'Per part', window: 'Per window' };

/** The colour of the window at `index` (0-based position in the pack). */
export function windowColourForIndex(index) {
  // null / '' / booleans would coerce to 0 and steal colour 1: an unknown window has no colour.
  if (index === null || index === undefined || index === '' || typeof index === 'boolean') return null;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) return null;
  return { index: i, hex: WINDOW_COLOURS[i % WINDOW_COLOURS.length], repeatOf: i >= WINDOW_COLOURS.length ? (i % WINDOW_COLOURS.length) : null };
}

/**
 * The colour mode saved with a pack or batch (precutSettings). Packs saved
 * before the window mode carry `colourByPart` only: true (or absent) was the
 * part colours ON, false was OFF.
 */
export function normaliseColourMode(precutSettings) {
  const m = precutSettings?.colourMode;
  if (COLOUR_MODES.includes(m)) return m;
  return precutSettings?.colourByPart === false ? 'off' : 'part';
}

/** Colour group of a pre-cut item, or null when the part has no colour. */
export function partColourForElement(elementName) {
  return BY_ID[ELEMENT_TO_GROUP[String(elementName || '')]] || null;
}

/** Colour group of a Cut List group (by its symbol), or null. */
export function partColourForCutSymbol(symbol) {
  return BY_ID[CUT_SYMBOL_TO_GROUP[String(symbol || '')]] || null;
}

/** '#RRGGBB' to [r, g, b] for jsPDF. */
export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

/**
 * Label of a piece on a bar: the full description when it fits the piece,
 * otherwise the dimension alone, otherwise nothing. The font is never made
 * smaller (Piotr 05.10.2026: the dimension is what the saw needs).
 * `measure(text)` returns the text width in the same unit as `available`.
 */
export function barLabelThatFits(full, short, available, measure) {
  if (measure(full) <= available) return full;
  if (measure(short) <= available) return short;
  return '';
}
