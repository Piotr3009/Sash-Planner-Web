/**
 * Mock estimate data — realistic shapes mirroring Supabase estimate_items
 * rows (with a `specification` JSON string mirroring the online-estimate
 * fullConfig). Used when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are not set.
 */

const buildSpec = (overrides = {}) =>
  JSON.stringify({
    windowType: 'sash',
    windowName: overrides.window_number || 'W1',
    width: overrides.width,
    height: overrides.height,
    upperBars: overrides.upper_bars || 'none',
    lowerBars: overrides.lower_bars || 'none',
    horns: overrides.horns || 'none',
    glassType: overrides.glass_type || 'double',
    glassSpec: overrides.glass_spec || '4-16-4',
    glassFinish: overrides.glass_finish || 'clear',
    spacerColor: overrides.spacer_color || 'silver',
    colorType: overrides.color_type || 'single',
    fullConfig: {
      colorSingleName: overrides.color_single || 'White',
      interiorColor: overrides.color_interior || 'White',
      exteriorColor: overrides.color_exterior || 'White',
      ralCode: overrides.ral || '',
      ironmongery: { lock: { color: overrides.ironmongery_finish || 'brass' } },
      pas24: overrides.pas24 ? 'yes' : 'no',
      horns: overrides.horns || 'none'
    }
  });

const item = (id, est, num, fields) => ({
  id,
  estimate_id: est,
  window_number: num,
  quantity: 1,
  unit_price: fields.unit_price || 800,
  total_price: fields.total_price || fields.unit_price || 800,
  measurement_type: 'made_to_size',
  ...fields,
  specification: buildSpec({ window_number: num, ...fields })
});

export const mockEstimates = [
  {
    id: 'est-001',
    estimate_number: 'EST-2025-001',
    project_name: '12 Belgrave Square — Drawing Room Restoration',
    status: 'sent',
    created_at: '2025-09-12T10:30:00Z',
    total_price: 6480,
    items: [
      item('it-001-1', 'est-001', 'W1', {
        window_type: 'sash',
        width: 900,
        height: 1500,
        upper_bars: '6x6',
        lower_bars: '6x6',
        horns: 'A',
        glass_type: 'double',
        glass_spec: '4-16-4',
        spacer_color: 'silver',
        color_single: 'White',
        unit_price: 1620,
        total_price: 1620
      }),
      item('it-001-2', 'est-001', 'W2', {
        window_type: 'sash',
        width: 900,
        height: 1500,
        upper_bars: '6x6',
        lower_bars: '6x6',
        horns: 'A',
        glass_type: 'double',
        unit_price: 1620,
        total_price: 1620
      }),
      item('it-001-3', 'est-001', 'W3', {
        window_type: 'sash',
        width: 1100,
        height: 1800,
        upper_bars: '3x3',
        lower_bars: '3x3',
        horns: 'B',
        glass_type: 'double',
        unit_price: 1620,
        total_price: 1620
      }),
      item('it-001-4', 'est-001', 'W4', {
        window_type: 'sash',
        width: 1100,
        height: 1800,
        upper_bars: '3x3',
        lower_bars: '3x3',
        horns: 'B',
        glass_type: 'double',
        unit_price: 1620,
        total_price: 1620
      })
    ]
  },
  {
    id: 'est-002',
    estimate_number: 'EST-2025-002',
    project_name: '47 Highbury Park — Loft Conversion',
    status: 'draft',
    created_at: '2025-10-02T14:00:00Z',
    total_price: 2400,
    items: [
      item('it-002-1', 'est-002', 'W1', {
        window_type: 'sash',
        width: 800,
        height: 1200,
        upper_bars: '2x2',
        lower_bars: 'none',
        horns: 'none',
        glass_type: 'double',
        color_single: 'Sage Green',
        unit_price: 1200,
        total_price: 1200
      }),
      item('it-002-2', 'est-002', 'W2', {
        window_type: 'sash',
        width: 800,
        height: 1200,
        upper_bars: '2x2',
        lower_bars: 'none',
        horns: 'none',
        glass_type: 'double',
        color_single: 'Sage Green',
        unit_price: 1200,
        total_price: 1200
      })
    ]
  },
  {
    id: 'est-003',
    estimate_number: 'EST-2025-003',
    project_name: 'Mews Cottage — Single Window Replacement',
    status: 'won',
    created_at: '2025-11-01T08:15:00Z',
    total_price: 980,
    items: [
      item('it-003-1', 'est-003', 'W1', {
        window_type: 'sash',
        width: 700,
        height: 1100,
        upper_bars: '4x4',
        lower_bars: 'none',
        horns: 'none',
        glass_type: 'double',
        glass_finish: 'frosted',
        color_single: 'Heritage Cream',
        unit_price: 980,
        total_price: 980
      })
    ]
  }
];
