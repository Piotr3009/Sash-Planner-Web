/**
 * lists.js — production list builders for a single window.
 *
 * Wraps `deriveWindowData` output into shapes that the UI tables and
 * the optimizer expect. Mirrors the aggregation logic in calculations.js
 * (`summariseProjectWindows`) but scoped to a single window.
 */

import { CONSTANTS, deriveWindowData } from './calculations.js';

const DEFAULT_SETTINGS = {
  kerf: 3,
  endTrim: 10,
  minimumPiece: 200,
  stockLengthSash: 5900,
  stockLengthBox: 2500,
  boxWidthAllowance: 20,
  hornExtensionDefault: 75,
  glazingAllowanceWidth: 4,
  glazingAllowanceHeight: 4,
  sectionMap: {
    '57x57': '63x63',
    '57x90': '63x95',
    '57x43': '63x63'
  }
};

function settingsWithDefaults(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    sectionMap: { ...DEFAULT_SETTINGS.sectionMap, ...(settings?.sectionMap || {}) }
  };
}

export function buildCutListForWindow(derived, windowSpec) {
  if (!derived) return [];
  const out = [];
  // Box (frame) components
  derived.components.box.forEach((c) => {
    out.push({
      element: c.elementName,
      section: c.section,
      length: c.length,
      quantity: c.quantity,
      material: 'Sapele / Engineered timber',
      notes: c.notes || ''
    });
  });
  // Sash components
  derived.components.sash.forEach((c) => {
    out.push({
      element: c.elementName,
      section: c.section,
      length: c.length,
      quantity: c.quantity,
      material: 'Hardwood (sash)',
      notes: c.notes || ''
    });
  });
  // Glazing bars
  const bars = derived.barPositions;
  const sashH2 = (derived.topSashHeight || derived.sashHeight / 2) - CONSTANTS.TOP_RAIL_WIDTH - CONSTANTS.MEETING_RAIL_WIDTH;
  const sashW = derived.sashWidth - 2 * CONSTANTS.STILE_WIDTH;
  if (bars?.vertical?.length) {
    out.push({
      element: 'Vertical glazing bar',
      section: `${CONSTANTS.GLAZING_BAR_WIDTH}x${CONSTANTS.GLAZING_BAR_DEPTH}`,
      length: Math.round(sashH2),
      quantity: bars.vertical.length * 2,
      material: 'Hardwood (bar stock)',
      notes: 'Per sash × 2'
    });
  }
  if (bars?.horizontal?.length) {
    out.push({
      element: 'Horizontal glazing bar',
      section: `${CONSTANTS.GLAZING_BAR_WIDTH}x${CONSTANTS.GLAZING_BAR_DEPTH}`,
      length: Math.round(sashW),
      quantity: bars.horizontal.length * 2,
      material: 'Hardwood (bar stock)',
      notes: 'Per sash × 2'
    });
  }
  return out.map((row) => ({ ...row, length: Math.round(row.length) }));
}

export function buildPrecutForWindow(derived, windowSpec, settingsArg) {
  const settings = settingsWithDefaults(settingsArg);
  if (!derived) return { sashEngineering: [], boxSapele: [] };

  // Sash precut groups by section (mapped via settings.sectionMap to raw)
  const bySection = new Map();
  derived.components.sash.forEach((c) => {
    const raw = settings.sectionMap[c.section] || settings.sectionMap['57x57'];
    if (!raw) return;
    if (!bySection.has(raw)) bySection.set(raw, []);
    bySection.get(raw).push({
      elementName: c.elementName,
      length: c.length,
      quantity: c.quantity,
      windowId: c.windowId,
      windowName: c.windowName
    });
  });

  // Box precut grouped by finished width + allowance
  const allowance = settings.boxWidthAllowance ?? 20;
  const byWidth = new Map();
  derived.components.box.forEach((c) => {
    if (c.finishedWidth == null) return;
    const widthWithAllowance = c.finishedWidth + allowance;
    if (!byWidth.has(widthWithAllowance)) byWidth.set(widthWithAllowance, []);
    byWidth.get(widthWithAllowance).push({
      elementName: c.elementName,
      length: c.length,
      quantity: c.quantity,
      windowId: c.windowId,
      windowName: c.windowName
    });
  });

  return {
    sashEngineering: Array.from(bySection.entries()).map(([section, items]) => ({ section, items })),
    boxSapele: Array.from(byWidth.entries()).map(([preCutWidth, items]) => ({ preCutWidth, items }))
  };
}

export function buildGlassListForWindow(derived, windowSpec) {
  if (!derived) return [];
  const item = derived.glazingItems?.[0];
  if (!item) return [];
  const total = item.panes || (item.rows * item.cols * 2);
  const finish = windowSpec?.glazing?.frosted ? 'frosted' : windowSpec?.glazing?.finish || 'clear';
  return [
    {
      label: `${item.rows}×${item.cols} pane`,
      width: item.width,
      height: item.height,
      quantity: total,
      type: windowSpec?.glazing?.type || 'double',
      spacer: item.spacerColour,
      finish,
      makeup: item.makeup
    }
  ];
}

export function buildHardwareList(windowSpec) {
  const finish = windowSpec?.hardware?.finish || 'brass';
  const isPas24 = windowSpec?.hardware?.catches === 'PAS24';
  const list = [
    { item: 'Sash lock', detail: `${finish} finish`, quantity: 1 },
    { item: 'Finger pull (lower sash)', detail: finish, quantity: 1 },
    { item: 'Sash lift / cup handles', detail: finish, quantity: 2 },
    { item: 'Pulley wheels', detail: 'Spring balance / cord', quantity: 4 },
    { item: 'Trickle vent', detail: 'Concealed head vent', quantity: 1 },
    { item: 'Weather seal', detail: 'Brush pile', quantity: 1 }
  ];
  if (isPas24) {
    list.push({ item: 'Restrictor (PAS24)', detail: `${finish}`, quantity: 1 });
  }
  return list;
}

export function buildProjectAggregates(items, windowSpecs, settingsArg) {
  const settings = settingsWithDefaults(settingsArg);
  const allCut = [];
  const allPrecut = { sashEngineering: [], boxSapele: [] };
  const allGlass = [];
  const allHardware = [];

  items.forEach((item, idx) => {
    const ws = windowSpecs[idx];
    if (!ws) return;
    const derived = deriveWindowData(ws, settings);
    allCut.push(...buildCutListForWindow(derived, ws).map((r) => ({ ...r, windowId: ws.id, windowName: ws.name })));
    const pre = buildPrecutForWindow(derived, ws, settings);
    pre.sashEngineering.forEach((g) => {
      const found = allPrecut.sashEngineering.find((x) => x.section === g.section);
      if (found) found.items.push(...g.items);
      else allPrecut.sashEngineering.push({ section: g.section, items: [...g.items] });
    });
    pre.boxSapele.forEach((g) => {
      const found = allPrecut.boxSapele.find((x) => x.preCutWidth === g.preCutWidth);
      if (found) found.items.push(...g.items);
      else allPrecut.boxSapele.push({ preCutWidth: g.preCutWidth, items: [...g.items] });
    });
    allGlass.push(...buildGlassListForWindow(derived, ws));
    allHardware.push(...buildHardwareList(ws));
  });

  return { cutList: allCut, precut: allPrecut, glass: allGlass, hardware: allHardware };
}
