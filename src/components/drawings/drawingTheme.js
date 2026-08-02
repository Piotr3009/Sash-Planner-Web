/**
 * drawingTheme.js
 *
 * SINGLE source of truth for ALL 2D drawing styles.
 * Change a number here → changes in every drawing component.
 *
 * SIZES  = approximate screen-pixel sizes for text.
 * STROKES = screen-pixel widths for lines (via vectorEffect="non-scaling-stroke").
 * Both are FIXED on screen — they do NOT scale with the drawing/viewBox.
 */

// ─── Reference width ───
// Used internally by drawingUtils to keep text size constant across different viewBox widths.
// You never need to touch this.
export const VIEWBOX_REF = 700;

// ─── Colors ───
export const COLORS = {
  highlight: '#2dd4bf',
  highlightFill: 'rgba(45,212,191,0.16)',
  frame:       '#CBD5E1',
  frameFill:   'rgba(148,163,184,0.06)',
  sash:        '#E2E8F0',
  bar:         '#94A3B8',
  glass:       '#0EA5E9',
  glassOpacity: 0.12,
  meeting:     '#64748b',
  sillDetail:  '#94A3B8',
  dim:         '#00B4A0',
  label:       '#EF4444',
  title:       '#E2E8F0',
  subtitle:    '#E2E8F0',
  notch:       '#F59E0B',
  horn:        '#F59E0B',
  section:     '#7C8FA6',
  sectionFill: '#94A3B8',
  bg:          '#1a1f2e',
};

// ─── Font ───
export const FONT_FAMILY = 'DM Sans, system-ui, sans-serif';

// ─── Text sizes (approx screen px) ───
// Change these → text changes everywhere, identically.
export const SIZES = {
  dimLarge:    21,
  dimSmall:    17,
  label:       15,
  title:       24,
  subtitle:    18,
  annotation:  17,
  code:        13,   // element code labels on casement frame detail
  notch:       14,
};

// ─── Font weights ───
export const WEIGHTS = {
  dim:      '400',
  label:    '500',
  title:    '600',
  subtitle: '400',
};

// ─── Stroke widths (screen px, via vectorEffect) ───
// Change these → line thickness changes everywhere, identically.
export const STROKES = {
  frame:       2,
  boardIndicator: 3,   // head/jamb board mounting indicator (board is 28 mm)
  // Mullions and transoms are structural members, not helper lines — at 0.5 they
  // rasterised to a grey smear on paper (Piotr 02.08). Now 0.65 of the frame.
  frameLight:  1.3,
  sash:        1,
  sashLight:   0.3,
  meeting:     0.8,
  bar:         0.5,
  glass:       1,
  glassLight:  0.5,

  dim:         0.7,
  ext:         0.3,
  leader:      0.3,

  outer:       1,
  rebate:      0.8,
  notch:       1.2,
  notchCircle: 0.5,

  horn:        2,
  center:      0.5,
  section:     1,
};

// ─── Dimension geometry (spacing in approx screen px, same system as SIZES) ───
export const DIMS = {
  tickHalf:      4,
  extOvershoot:  8,
  textGap:       6,
  leaderV:       14,
  leaderHOff:    13,
  dashPattern:   '4,3',
};
// ─── CAD scheme (white paper) — casement production drawings ───
// Approved exterior-view mockups 30.07.2026. Fixed screen px (viewBox 700).
export const CAD = {
  bg:        '#FFFFFF',
  paperEdge: '#C8C8C8',
  line:      '#1A1A1A',   // frame / member edges
  leaf:      '#1A1A1A',
  glassEdge: '#5A5A5A',
  bar:       '#8A8A8A',
  axis:      '#8A8A8A',
  dim:       '#666666',
  chain:     '#888888',
  ext:       '#888888',
  leader:    '#9A9A9A',
  text:      '#333333',
  textDark:  '#1A1A1A',
  textMuted: '#555555',
  textFaint: '#999999',
  open:      '#2C6FBF',
  warn:      '#B23B3B',
};

export const CAD_SIZES = { dim: 11, label: 11, callout: 11, strip: 11 };

export const CAD_STROKES = {
  frame: 2, member: 0.9, leaf: 1.3, glassEdge: 0.7, bar: 0.6,
  open: 1, dim: 0.8, chain: 0.6, ext: 0.5, leader: 0.5, axis: 0.5,
};

export const CAD_DIMS = { tick: 5, axisDash: '8 3 2 3', leaderDash: '3 3', openDash: '6 4' };
