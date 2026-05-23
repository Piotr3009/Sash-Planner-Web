/**
 * drawingTheme.js
 *
 * Single source of truth for all 2D technical drawing styles.
 * Every drawing component imports from here — change once, update everywhere.
 */

// ─── Colors ───
export const COLORS = {
  // Structural elements
  frame:       '#CBD5E1',
  frameFill:   'rgba(148,163,184,0.06)',
  sash:        '#E2E8F0',
  bar:         '#94A3B8',
  glass:       '#0EA5E9',
  glassOpacity: 0.12,
  meeting:     '#64748b',
  sillDetail:  '#94A3B8',

  // Dimensions (teal — was red)
  dim:         '#00B4A0',

  // Labels — part names (red — was teal)
  label:       '#EF4444',

  // Title / subtitle (white)
  title:       '#E2E8F0',
  subtitle:    '#E2E8F0',

  // Accents
  notch:       '#F59E0B',
  horn:        '#F59E0B',

  // Sections
  section:     '#7C8FA6',
  sectionFill: '#94A3B8',

  // Background
  bg:          '#1a1f2e',
};

// ─── Font ───
export const FONT_FAMILY = 'DM Sans, system-ui, sans-serif';

// Base sizes — used as fixed pixel font-size in SVG text elements.
// SVG `font-size="Npx"` renders Npx on screen regardless of viewBox / aspect ratio.
// To change text size everywhere, change values here only.
export const SIZES = {
  dimLarge:    32,
  dimSmall:    26,
  label:       24,
  title:       36,
  subtitle:    28,
  annotation:  26,  // mid-size: glass specs, section labels
  notch:       20,
};

// ─── Weights ───
export const WEIGHTS = {
  dim:      '400',
  label:    '500',
  title:    '600',
  subtitle: '400',
};

// ─── Scale divisor ───
// sc = viewBoxWidth / SC_DIVISOR
// Ensures text is always ~3% of viewBox width = identical visual size everywhere
export const SC_DIVISOR = 700;