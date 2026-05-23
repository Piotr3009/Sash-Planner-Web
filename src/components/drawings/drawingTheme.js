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
  frame:       1.5,
  frameLight:  0.5,
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
  center:      0.3,
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