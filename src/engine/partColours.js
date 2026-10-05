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
// right of a pair share a colour. Casement only for now: any other part has
// no colour and keeps the single default colour.

export const PART_COLOUR_GROUPS = [
  { id: 'frame_head', family: 'frame', name: 'Frame Head', note: 'top of the frame', hex: '#F5E050' },
  { id: 'frame_jambs', family: 'frame', name: 'Frame Jambs', note: 'left and right together', hex: '#7CC4F5' },
  { id: 'frame_cill', family: 'frame', name: 'Frame Cill', note: 'bottom of the frame', hex: '#F2A03D' },
  { id: 'mullion', family: 'frame', name: 'Mullion', note: 'vertical divider', hex: '#5CCBA9' },
  { id: 'transom', family: 'frame', name: 'Transom', note: 'horizontal divider', hex: '#D99AC5' },
  { id: 'leaf_stiles', family: 'leaf', name: 'Leaf Stiles', note: 'left and right together', hex: '#FFFFFF' },
  { id: 'leaf_top_rail', family: 'leaf', name: 'Leaf Top Rail', note: 'top of the leaf', hex: '#A98BE8' },
  { id: 'leaf_bottom_rail', family: 'leaf', name: 'Leaf Bottom Rail', note: 'bottom of the leaf', hex: '#EE7D5B' },
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
};

// Cut List group symbol (lists.js CUT_LIST_ORDER) to the same colour group.
const CUT_SYMBOL_TO_GROUP = {
  'C-FH': 'frame_head', 'C-AH': 'frame_head', 'C-FRR': 'frame_head',
  'C-J-L/R': 'frame_jambs',
  'C-CILL': 'frame_cill',
  'C-M': 'mullion',
  'C-T': 'transom',
  'C-ST-L/R': 'leaf_stiles',
  'C-TR': 'leaf_top_rail', 'C-ATR': 'leaf_top_rail', 'C-LFR': 'leaf_top_rail',
  'C-BR': 'leaf_bottom_rail',
};

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
