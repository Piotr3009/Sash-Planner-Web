/**
 * optimizer.js — pre-cut bar optimizer (best-fit-decreasing).
 * Adapted verbatim from Windows-App-electron-/js/optimizer.js,
 * with the only change being that settings is passed in instead of imported from state.
 */

function expandItems(items) {
  const expanded = [];
  items.forEach(({ length, quantity, elementName, windowId }) => {
    for (let i = 0; i < quantity; i += 1) {
      expanded.push({ length: Number(length), elementName, windowId });
    }
  });
  return expanded.filter((item) => Number.isFinite(item.length) && item.length > 0);
}

function bestFitDecreasing({ items, stockLength, kerf, endTrim, minimumPiece, prefix }) {
  const cuts = expandItems(items).sort((a, b) => b.length - a.length);
  const bars = [];

  cuts.forEach(() => {});
  cuts.forEach((cut) => {
    let bestBar = null;
    let bestBarIndex = -1;
    let bestWaste = Infinity;

    bars.forEach((bar, idx) => {
      const kerfAllowance = bar.cuts.length > 0 ? kerf : 0;
      const potentialUsed = bar.used + kerfAllowance + cut.length;
      const remainingAfterEndTrim = stockLength - (potentialUsed + endTrim);
      if (remainingAfterEndTrim < 0) return;
      if (remainingAfterEndTrim !== 0 && remainingAfterEndTrim < minimumPiece) return;
      if (remainingAfterEndTrim < bestWaste) {
        bestWaste = remainingAfterEndTrim;
        bestBar = bar;
        bestBarIndex = idx;
      }
    });

    if (!bestBar) {
      const newBar = {
        barId: `${prefix}-${bars.length + 1}`,
        cuts: [],
        used: endTrim,
        waste: 0,
        utilization: 0
      };
      bars.push(newBar);
      bestBar = newBar;
      bestBarIndex = bars.length - 1;
    }

    const kerfAllowance = bestBar.cuts.length > 0 ? kerf : 0;
    bestBar.cuts.push(cut.length);
    bestBar.used += kerfAllowance + cut.length;
    const remaining = stockLength - (bestBar.used + endTrim);
    bestBar.waste = Math.max(remaining, 0);
    const totalCutLength = bestBar.cuts.reduce((sum, value) => sum + value, 0);
    bestBar.utilization = totalCutLength / stockLength;
    bars[bestBarIndex] = bestBar;
  });

  const summary = bars.reduce(
    (acc, bar) => {
      acc.totalBars += 1;
      acc.wasteTotal += bar.waste;
      acc.utilizationTotal += bar.utilization;
      return acc;
    },
    { totalBars: 0, wasteTotal: 0, utilizationTotal: 0 }
  );

  return {
    bars,
    summary: {
      totalBars: summary.totalBars,
      wasteTotal: Math.round(summary.wasteTotal),
      utilAvg: summary.totalBars ? summary.utilizationTotal / summary.totalBars : 0
    }
  };
}

function buildGroup(items, descriptor, settings) {
  return bestFitDecreasing({
    items,
    stockLength: descriptor.stockLength,
    kerf: settings.kerf,
    endTrim: settings.endTrim,
    minimumPiece: settings.minimumPiece,
    prefix: descriptor.prefix
  });
}

export function optimisePrecut(precutGroups, settings) {
  const sashGroups = (precutGroups.sashEngineering || []).map((group) => ({
    section: group.section,
    ...buildGroup(group.items, { stockLength: settings.stockLengthSash, prefix: `S-${group.section}` }, settings)
  }));

  const boxGroups = (precutGroups.boxSapele || []).map((group) => ({
    preCutWidth: group.preCutWidth,
    ...buildGroup(group.items, { stockLength: settings.stockLengthBox, prefix: `B-${group.preCutWidth}` }, settings)
  }));

  return { sashEngineering: sashGroups, boxSapele: boxGroups };
}

export function buildOptimizationRequest(precut, settings) {
  return optimisePrecut(precut, settings);
}
