/**
 * Starter materials catalog.
 * Ironmongery prices from Prime Sash Windows.
 * Timber / Glass / Consumables are placeholder prices — user should update.
 */

let _id = 0;
const mid = () => `mock-mat-${String(++_id).padStart(3, '0')}`;

// ─── Helper: create ironmongery item ───
const iron = (name, subcategory, color, netPrice, opts = {}) => ({
  id: mid(),
  item_number: `MAT-${String(_id).padStart(3, '0')}`,
  name,
  category: 'ironmongery',
  subcategory,
  size: opts.size || '',
  thickness: '',
  color,
  unit: 'pcs',
  cost_per_unit: netPrice,
  image_url: '',
  jc_uuid: '',
  notes: opts.notes || '',
  created_at: '2026-01-01T00:00:00.000Z',
});

// ─── Helper: create timber item ───
const timber = (name, size, pricePerMetre, opts = {}) => ({
  id: mid(),
  item_number: `MAT-${String(_id).padStart(3, '0')}`,
  name,
  category: 'timber',
  subcategory: opts.subcategory || 'engineering',
  size,
  thickness: opts.thickness || '',
  color: '',
  unit: 'm',
  cost_per_unit: pricePerMetre,
  image_url: '',
  jc_uuid: '',
  notes: opts.notes || '',
  created_at: '2026-01-01T00:00:00.000Z',
});

// ─── Helper: create glass item ───
const glass = (name, spec, unit, price, opts = {}) => ({
  id: mid(),
  item_number: `MAT-${String(_id).padStart(3, '0')}`,
  name,
  category: 'glass',
  subcategory: opts.subcategory || 'sealed-unit',
  size: spec,
  thickness: '',
  color: '',
  unit,
  cost_per_unit: price,
  image_url: '',
  jc_uuid: '',
  notes: opts.notes || '',
  created_at: '2026-01-01T00:00:00.000Z',
});

// ─── Helper: create consumable ───
const consumable = (name, unit, price, opts = {}) => ({
  id: mid(),
  item_number: `MAT-${String(_id).padStart(3, '0')}`,
  name,
  category: 'consumables',
  subcategory: opts.subcategory || 'general',
  size: '',
  thickness: '',
  color: '',
  unit,
  cost_per_unit: price,
  image_url: '',
  jc_uuid: '',
  notes: opts.notes || '',
  created_at: '2026-01-01T00:00:00.000Z',
});

// ═══════════════════════════════════════════════════════════════
// IRONMONGERY — Sash Windows (prices from Prime Sash Windows)
// ═══════════════════════════════════════════════════════════════

const sashIronmongery = [
  // Sash Locks — PAS24
  iron('Sash Lock PAS24', 'sash-locks', 'Chrome',        25.00, { notes: 'PAS24 certified' }),
  iron('Sash Lock PAS24', 'sash-locks', 'Satin',         25.00, { notes: 'PAS24 certified' }),
  iron('Sash Lock PAS24', 'sash-locks', 'Brass',         27.00, { notes: 'PAS24 certified' }),
  iron('Sash Lock PAS24', 'sash-locks', 'Antique Brass', 27.00, { notes: 'PAS24 certified' }),
  iron('Sash Lock PAS24', 'sash-locks', 'Black',         25.00, { notes: 'PAS24 certified' }),
  iron('Sash Lock PAS24', 'sash-locks', 'White',         25.00, { notes: 'PAS24 certified' }),

  // Sash Finger Lifts
  iron('Sash Finger Lift', 'sash-finger-lifts', 'Chrome',        8.50),
  iron('Sash Finger Lift', 'sash-finger-lifts', 'Satin',         8.50),
  iron('Sash Finger Lift', 'sash-finger-lifts', 'Brass',         9.50),
  iron('Sash Finger Lift', 'sash-finger-lifts', 'Antique Brass', 9.50),
  iron('Sash Finger Lift', 'sash-finger-lifts', 'Black',         8.50),
  iron('Sash Finger Lift', 'sash-finger-lifts', 'White',         8.50),

  // Sash Pull Handles
  iron('Sash Pull Handle', 'sash-pull-handles', 'Chrome',        12.00),
  iron('Sash Pull Handle', 'sash-pull-handles', 'Satin',         12.00),
  iron('Sash Pull Handle', 'sash-pull-handles', 'Brass',         14.00),
  iron('Sash Pull Handle', 'sash-pull-handles', 'Antique Brass', 14.00),
  iron('Sash Pull Handle', 'sash-pull-handles', 'Black',         12.00),
  iron('Sash Pull Handle', 'sash-pull-handles', 'White',         12.00),

  // Sash Window Stoppers
  iron('Sash Window Stopper', 'sash-stoppers', 'Chrome', 6.50),
  iron('Sash Window Stopper', 'sash-stoppers', 'Satin',  6.50),
  iron('Sash Window Stopper', 'sash-stoppers', 'Brass',  7.50),
  iron('Sash Window Stopper', 'sash-stoppers', 'Black',  6.50),
  iron('Sash Window Stopper', 'sash-stoppers', 'White',  6.50),
];

// ═══════════════════════════════════════════════════════════════
// IRONMONGERY — Casement Windows
// ═══════════════════════════════════════════════════════════════

const casementIronmongery = [
  iron('Casement Handle',  'casement-handles', 'Chrome', 15.00),
  iron('Casement Handle',  'casement-handles', 'Brass',  18.00),
  iron('Casement Handle',  'casement-handles', 'Black',  15.00),
  iron('Casement Handle',  'casement-handles', 'White',  15.00),

  iron('Casement Stay',    'casement-stays',   'Chrome', 10.00),
  iron('Casement Stay',    'casement-stays',   'Brass',  12.00),
  iron('Casement Stay',    'casement-stays',   'Black',  10.00),
  iron('Casement Stay',    'casement-stays',   'White',  10.00),

  iron('Casement Lock',    'casement-locks',   'Chrome', 8.00),
  iron('Casement Lock',    'casement-locks',   'Brass',  10.00),
  iron('Casement Lock',    'casement-locks',   'Black',  8.00),
  iron('Casement Lock',    'casement-locks',   'White',  8.00),
];

// ═══════════════════════════════════════════════════════════════
// TIMBER — Common sash window sections
// ═══════════════════════════════════════════════════════════════

const timberItems = [
  timber('Sapele engineering',  '63 x 63 mm',  4.20, { subcategory: 'sash-engineering' }),
  timber('Sapele engineering',  '63 x 95 mm',  5.80, { subcategory: 'sash-engineering' }),
  timber('Sapele box board',    '25 x varies', 3.50, { subcategory: 'box-sapele', notes: 'Box lining boards' }),
  timber('Sapele sill',        '75 x 150 mm', 8.50, { subcategory: 'sills' }),
  timber('Oak engineering',     '63 x 63 mm',  6.00, { subcategory: 'sash-engineering' }),
  timber('Oak engineering',     '63 x 95 mm',  8.20, { subcategory: 'sash-engineering' }),
  timber('Accoya engineering',  '63 x 63 mm',  7.50, { subcategory: 'sash-engineering' }),
  timber('Accoya engineering',  '63 x 95 mm', 10.00, { subcategory: 'sash-engineering' }),
];

// ═══════════════════════════════════════════════════════════════
// GLASS — Sealed units
// ═══════════════════════════════════════════════════════════════

const glassItems = [
  glass('Double glazed unit',     '4-16-4 argon',           'unit', 0, { notes: 'Price per m² — varies by size' }),
  glass('Double glazed unit',     '4-20-4 argon',           'unit', 0, { notes: 'Price per m² — varies by size' }),
  glass('Triple glazed unit',     '4-12-4-12-4 argon',      'unit', 0, { notes: 'Price per m² — varies by size' }),
  glass('Laminated glass',        '6.4mm laminated',        'unit', 0, { notes: 'Price per m² — varies by size' }),
  glass('Toughened glass',        '4mm toughened',           'unit', 0, { notes: 'Single pane, toughened' }),
  glass('Obscure glass',          '4mm obscure pattern',     'unit', 0, { notes: 'Privacy glass' }),
];

// ═══════════════════════════════════════════════════════════════
// CONSUMABLES
// ═══════════════════════════════════════════════════════════════

const consumableItems = [
  consumable('Glazing putty',       'kg',  3.50,  { subcategory: 'glazing' }),
  consumable('Weather stripping',   'set', 4.00,  { subcategory: 'seals' }),
  consumable('Staff bead',          'm',   1.20,  { subcategory: 'beads' }),
  consumable('Parting bead',        'm',   1.00,  { subcategory: 'beads' }),
  consumable('Draught seal',        'm',   0.80,  { subcategory: 'seals' }),
  consumable('Balance spring',      'pair', 22.00, { subcategory: 'springs', notes: 'Pair — sized per window weight' }),
  consumable('Screws & fixings',    'set', 2.50,  { subcategory: 'fixings' }),
  consumable('Adhesive / Glue',     'unit', 8.00, { subcategory: 'adhesives' }),
];

// ═══════════════════════════════════════════════════════════════

export const mockMaterials = [
  ...sashIronmongery,
  ...casementIronmongery,
  ...timberItems,
  ...glassItems,
  ...consumableItems,
];
