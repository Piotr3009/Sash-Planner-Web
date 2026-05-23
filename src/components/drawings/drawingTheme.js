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

  // Dimensions (RED — consistent everywhere)
  dim:         '#EF4444',

  // Labels — part names (teal)
  label:       '#00B4A0',

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

// Base sizes — multiplied by component's own scale factor (sc)
export const SIZES = {
  dimLarge:  21,
  dimSmall:  17,
  label:     13,
  title:     21,
  subtitle:  17,
  notch:     9,
};

// ─── Weights ───
export const WEIGHTS = {
  dim:      '400',
  label:    '500',
  title:    '600',
  subtitle: '400',
};
