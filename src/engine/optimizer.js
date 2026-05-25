/**
 * optimizer.js — pre-cut bar optimizer (best-fit-decreasing).
 * Offcuts use knapsack (DP) for optimal filling before BFD runs on remaining cuts.
 */

function expandItems(items) {
  const expanded = [];
  items.forEach(({ length, quantity, elementName, windowId, windowName, _projectNumber }) => {
    for (let i = 0; i < quantity; i += 1) {
      expanded.push({ length: Number(length), elementName, windowId, windowName: windowName || '', projectNumber: _projectNumber || '' });
    }
  });
  return expanded.filter((item) => Number.isFinite(item.length) && item.length > 0);
}

/**
 * 0-1 knapsack: find best subset of cuts to maximise utilization of an offcut bar.
 * Returns array of indices into `cuts` that should go on this offcut.
 */
function findBestSubsetForOffcut(cuts, offcutLength, endTrim, kerf) {
  // Capacity = offcut minus both end trims, plus one kerf (first cut has no kerf before it)
  const capacity = Math.floor(offcutLength - 2 * endTrim + kerf);
  if (capacity <= 0 || cuts.length === 0) return [];

  const n = cuts.length;
  // Each item weight = length + kerf (extra kerf compensated by +kerf in capacity)
  const weights = cuts.map((c) => Math.ceil(c.length + kerf));

  // DP table: dpTable[i][c] = max total cut length using items 0..i-1 within weight c
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(capacity + 1));

  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1];
    const v = Math.round(cuts[i - 1].length);
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (c >= w && dp[i - 1][c - w] + v > dp[i][c]) {
        dp[i][c] = dp[i - 1][c - w] + v;
      }
    }
  }

  // Backtrack to find selected indices
  const selected = [];
  let rem = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][rem] !== dp[i - 1][rem]) {
      selected.push(i - 1);
      rem -= weights[i - 1];
    }
  }

  return selected;
}

function bestFitDecreasing({ items, stockLength, kerf, endTrim, minimumPiece, prefix, offcuts }) {
  const cuts = expandItems(items).sort((a, b) => b.length - a.length);
  const bars = [];
  let remainingCuts = [...cuts];

  // ─── Phase 1: Optimally fill offcut bars using knapsack ───
  if (offcuts && offcuts.length > 0) {
    offcuts.forEach((offcutLength, idx) => {
      if (offcutLength <= endTrim * 2) return;

      const selected = findBestSubsetForOffcut(remainingCuts, offcutLength, endTrim, kerf);
      if (selected.length === 0) return;

      const bar = {
        barId: `${prefix}-OC${idx + 1}`,
        cuts: [],
        cutDetails: [],
        used: endTrim,
        waste: 0,
        utilization: 0,
        stockLength: offcutLength,
        isOffcut: true,
      };

      // Extract selected cuts (sort indices descending so splice is safe)
      const sortedIndices = [...selected].sort((a, b) => b - a);
      const selectedCuts = selected.map((i) => remainingCuts[i]);
      sortedIndices.forEach((i) => remainingCuts.splice(i, 1));

      // Sort selected cuts by length desc for consistent display
      selectedCuts.sort((a, b) => b.length - a.length);

      selectedCuts.forEach((cut) => {
        const kerfAllowance = bar.cuts.length > 0 ? kerf : 0;
        bar.cuts.push(cut.length);
        bar.cutDetails.push({
          length: cut.length,
          elementName: cut.elementName || '',
          windowName: cut.windowName || '',
          projectNumber: cut.projectNumber || '',
        });
        bar.used += kerfAllowance + cut.length;
      });

      const remaining = offcutLength - (bar.used + endTrim);
      bar.waste = Math.max(remaining, 0);
      const totalCutLength = bar.cuts.reduce((sum, v) => sum + v, 0);
      bar.utilization = totalCutLength / offcutLength;

      bars.push(bar);
    });
  }

  // ─── Phase 2: BFD on remaining cuts with standard stock ───
  remainingCuts.forEach((cut) => {
    let bestBar = null;
    let bestBarIndex = -1;
    let bestWaste = Infinity;

    bars.forEach((bar, idx) => {
      const barStock = bar.stockLength || stockLength;
      const kerfAllowance = bar.cuts.length > 0 ? kerf : 0;
      const potentialUsed = bar.used + kerfAllowance + cut.length;
      const remainingAfterEndTrim = barStock - (potentialUsed + endTrim);
      if (remainingAfterEndTrim < 0) return;
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
        cutDetails: [],
        used: endTrim,
        waste: 0,
        utilization: 0,
        stockLength: stockLength,
        isOffcut: false,
      };
      bars.push(newBar);
      bestBar = newBar;
      bestBarIndex = bars.length - 1;
    }

    const barStock = bestBar.stockLength || stockLength;
    const kerfAllowance = bestBar.cuts.length > 0 ? kerf : 0;
    bestBar.cuts.push(cut.length);
    if (!bestBar.cutDetails) bestBar.cutDetails = [];
    bestBar.cutDetails.push({
      length: cut.length,
      elementName: cut.elementName || '',
      windowName: cut.windowName || '',
      projectNumber: cut.projectNumber || '',
    });
    bestBar.used += kerfAllowance + cut.length;
    const remaining = barStock - (bestBar.used + endTrim);
    bestBar.waste = Math.max(remaining, 0);
    const totalCutLength = bestBar.cuts.reduce((sum, value) => sum + value, 0);
    bestBar.utilization = totalCutLength / barStock;
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
    prefix: descriptor.prefix,
    offcuts: descriptor.offcuts || [],
  });
}

export function optimisePrecut(precutGroups, settings, offcutsMap) {
  const ocMap = offcutsMap || {};

  const sashGroups = (precutGroups.sashEngineering || []).map((group) => ({
    section: group.section,
    ...buildGroup(group.items, {
      stockLength: group.stockLength || settings.stockLengthSash,
      prefix: `S-${group.section}`,
      offcuts: ocMap[`sash-${group.section}`] || [],
    }, settings)
  }));

  const boxGroups = (precutGroups.boxSapele || []).map((group) => ({
    preCutWidth: group.preCutWidth,
    ...buildGroup(group.items, {
      stockLength: group.stockLength || settings.stockLengthBox,
      prefix: `B-${group.preCutWidth}`,
      offcuts: ocMap[`box-${group.preCutWidth}`] || [],
    }, settings)
  }));

  return { sashEngineering: sashGroups, boxSapele: boxGroups };
}

export function buildOptimizationRequest(precut, settings) {
  return optimisePrecut(precut, settings);
}
