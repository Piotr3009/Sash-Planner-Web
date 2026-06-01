/**
 * PreCutPanel.jsx
 * Single-window pre-cut view — styled to match Production Pack PreCutTab.
 * Grouped sections, BLO bars, offcuts, stock length input.
 */
import { useState, useMemo } from 'react';
import { buildPrecutForWindow } from '../../engine/lists.js';
import { optimisePrecut } from '../../engine/optimizer.js';
import { getPartSymbol } from '../../engine/partSymbols.js';
import { useMaterialAssignmentStore } from '../../stores/materialAssignmentStore.js';
import { useMaterialStore } from '../../stores/materialStore.js';
import { exportPreCutPDF } from '../../utils/precutPdfExport.js';

export default function PreCutPanel({ item, windowSpec, settings, derived, batch }) {
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const materials = useMaterialStore((s) => s.materials);
  const [exportFormat, setExportFormat] = useState('a3');
  const [stockLengths, setStockLengths] = useState({});
  const [offcutsMap, setOffcutsMap] = useState({});
  const [offcutInput, setOffcutInput] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  const precut = useMemo(() => {
    if (!derived || !windowSpec) return null;
    return buildPrecutForWindow(derived, windowSpec, settings);
  }, [derived, windowSpec, settings]);

  if (!precut) {
    return <div className="card p-8 text-center text-ink-400">No pre-cut data available.</div>;
  }

  // Build unified groups: sash (by section) + box (by preCutWidth)
  const allGroups = [];

  (precut.sashEngineering || []).forEach((g) => {
    const finished = g.items[0]?.finishedSection || g.section;
    allGroups.push({
      key: `sash-${g.section}`,
      label: `Sash Timber — ${finished}`,
      precutSection: g.section,
      section: g.section,
      type: 'sash',
      items: g.items,
      defaultStock: settings?.stockLengthSash || 5900,
    });
  });

  (precut.boxSapele || []).forEach((g) => {
    const names = g.items.map(i => (i.elementName || '').toUpperCase());
    const finished = g.items[0]?.finishedSection || g.items[0]?.section || `${g.preCutWidth}`;
    const finDisplay = finished.replace('x', ' x ');
    let boxLabel;
    if (names.some(n => n.includes('CILL NOSE') || n.includes('CILL_NOSE'))) {
      boxLabel = `Cill Nose — ${finDisplay}`;
    } else if (names.some(n => n === 'CILL')) {
      boxLabel = `Sill Timber — ${finDisplay}`;
    } else if (names.some(n => n.includes('LINER'))) {
      boxLabel = `Liner — ${finDisplay}`;
    } else {
      boxLabel = `Box — ${finDisplay}`;
    }
    allGroups.push({
      key: `box-${g.preCutWidth}`,
      label: boxLabel,
      precutSection: `${g.preCutWidth}`,
      section: `${g.preCutWidth}`,
      type: 'box',
      items: g.items,
      defaultStock: settings?.stockLengthBox || 3700,
    });
  });

  // Re-run optimizer with custom stock lengths + offcuts
  const localOptimization = useMemo(() => {
    if (!precut) return null;
    const precutWithStock = {
      sashEngineering: (precut.sashEngineering || []).map((g) => ({
        ...g,
        stockLength: stockLengths[`sash-${g.section}`] || settings?.stockLengthSash || 5900,
      })),
      boxSapele: (precut.boxSapele || []).map((g) => ({
        ...g,
        stockLength: stockLengths[`box-${g.preCutWidth}`] || settings?.stockLengthBox || 3700,
      })),
    };
    try {
      return optimisePrecut(precutWithStock, settings, offcutsMap);
    } catch (e) {
      console.warn('Optimizer with offcuts failed:', e);
      return null;
    }
  }, [precut, settings, stockLengths, offcutsMap]);

  const toggleExpand = (key) => setExpandedGroups((p) => ({ ...p, [key]: !p[key] }));

  // 3c: step stock length by ±100mm. Lower bound = longest required piece in the
  // group (a stock shorter than the longest piece can't fit it).
  const stepStock = (group, current, delta) => {
    const minStock = Math.max(...group.items.map((it) => it.length || 0), 0);
    const next = Math.max(minStock, (current || 0) + delta);
    setStockLengths((p) => ({ ...p, [group.key]: next }));
  };

  const handleAddOffcut = (groupKey) => {
    const val = parseFloat(offcutInput[groupKey]);
    if (!val || val <= 0) return;
    setOffcutsMap((p) => ({
      ...p,
      [groupKey]: [...(p[groupKey] || []), Math.round(val)],
    }));
    setOffcutInput((p) => ({ ...p, [groupKey]: '' }));
  };

  const handleRemoveOffcut = (groupKey, idx) => {
    setOffcutsMap((p) => ({
      ...p,
      [groupKey]: (p[groupKey] || []).filter((_, i) => i !== idx),
    }));
  };

  const getOptGroup = (group) => {
    if (!localOptimization) return null;
    if (group.type === 'sash') {
      return localOptimization.sashEngineering?.find((g) => g.section === group.section);
    }
    return localOptimization.boxSapele?.find((g) => String(g.preCutWidth) === group.section);
  };

  const getMaterialForGroup = (items) => {
    const el = items?.[0]?.elementName;
    if (!el) return null;
    const sym = getPartSymbol(el);
    if (sym?.partId) {
      const a = assignments[sym.partId];
      if (a?.material_id) return materials.find((m) => m.id === a.material_id) || null;
    }
    return null;
  };

  const handleExport = () => {
    if (!localOptimization || !allGroups.length) return;
    const company = settings?.company || {};
    const exportGroups = allGroups.map((g) => ({
      ...g,
      stockLength: stockLengths[g.key] || g.defaultStock,
      materialInfo: getMaterialForGroup(g.items),
    }));
    const projList = batch
      ? [{ number: batch.projectNumber || batch.label || '', name: batch.projectName || '' }]
      : [];
    exportPreCutPDF({
      groups: exportGroups,
      optimization: localOptimization,
      settings,
      batch,
      projects: projList,
      isPPMode: false,
      format: exportFormat,
      companySettings: company,
    });
  };

  if (allGroups.length === 0) {
    return <div className="card p-8 text-center text-ink-400">No pre-cut groups available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-50">Pre-Cut List</div>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="text-[10px] bg-surface-700 border border-surface-500 rounded px-2 py-1 text-ink-200 outline-none"
          >
            <option value="a3">A3 Landscape</option>
            <option value="a4">A4 Landscape</option>
          </select>
          <button onClick={handleExport} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
            📄 Export PDF
          </button>
        </div>
      </div>
      {allGroups.map((group) => {
        const optGroup = getOptGroup(group);
        const isExpanded = expandedGroups[group.key] !== false;
        const stock = stockLengths[group.key] || group.defaultStock;
        const groupOffcuts = offcutsMap[group.key] || [];
        const sectionNum = parseInt(group.section) || 63;
        const barHeight = Math.max(20, Math.min(36, Math.round(sectionNum / 4)));

        return (
          <div key={group.key} className="card overflow-hidden">
            {/* Group header */}
            <div
              className="px-4 py-3 border-b border-surface-500 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => toggleExpand(group.key)}
                className="shrink-0 cursor-pointer text-ink-400 hover:text-ink-200 transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <div>
                <div className="text-sm font-semibold text-ink-50">{group.label}</div>
                <div className="text-[10px] text-ink-400">pre-cut: {group.precutSection}</div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-ink-400">Stock:</span>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => stepStock(group, stock, 100)}
                      className="text-ink-400 hover:text-accent-400 leading-none text-[8px] px-0.5"
                      aria-label="Increase stock by 100mm"
                    >▲</button>
                    <button
                      type="button"
                      onClick={() => stepStock(group, stock, -100)}
                      className="text-ink-400 hover:text-accent-400 leading-none text-[8px] px-0.5"
                      aria-label="Decrease stock by 100mm"
                    >▼</button>
                  </div>
                  <input
                    className="w-16 text-[11px] text-ink-100 bg-surface-700 border border-surface-500 rounded px-1.5 py-0.5 text-center outline-none focus:border-accent-500"
                    value={stock}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setStockLengths((p) => ({ ...p, [group.key]: v }));
                    }}
                  />
                  <span className="text-[10px] text-ink-400">mm</span>
                </div>
                <span className="text-[10px] text-ink-400">
                  {group.items.length} elements · {group.items.reduce((s, it) => s + (it.quantity || 1), 0)} pcs
                </span>
              </div>
            </div>

            {isExpanded && (
              <div>
                {/* BLO visualization */}
                {optGroup?.bars?.length > 0 && (
                  <div className="p-4 border-b border-surface-500/50 bg-surface-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-ink-200">Bar Layout Optimizer</div>
                      <div className="text-[10px] text-ink-400">
                        Bars: {optGroup.summary.totalBars} · Waste: {optGroup.summary.wasteTotal} mm · Util: {(optGroup.summary.utilAvg * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(() => {
                        const maxStock = Math.max(...optGroup.bars.map((b) => b.stockLength || stock));
                        return optGroup.bars.map((bar) => {
                          const barStock = bar.stockLength || stock;
                          const barWidthPct = (barStock / maxStock) * 100;
                          let cursor = settings?.endTrim || 10;
                          const details = bar.cutDetails || bar.cuts.map((c) => ({ length: c, elementName: '' }));
                          return (
                            <div key={bar.barId} className="flex items-center gap-2">
                              <div className="w-20 text-[10px] text-ink-400 font-mono flex items-center gap-1">
                                {bar.isOffcut && <span className="text-amber-400" title="Offcut">◆</span>}
                                {bar.barId}
                              </div>
                              <div className="flex-1 relative" style={{ height: barHeight }}>
                                <div
                                  className="bg-surface-600 rounded relative overflow-hidden border border-surface-500 h-full"
                                  style={{ width: `${barWidthPct}%` }}
                                >
                                  <div className="absolute inset-y-0 bg-surface-500"
                                    style={{ left: 0, width: `${((settings?.endTrim || 10) / barStock) * 100}%` }} />
                                  {details.map((detail, idx) => {
                                    const cutLen = typeof detail === 'number' ? detail : detail.length;
                                    const elName = typeof detail === 'number' ? '' : (detail.elementName || '');
                                    const sym = elName ? getPartSymbol(elName) : null;
                                    const label = sym ? sym.symbol : '';
                                    const left = (cursor / barStock) * 100;
                                    const width = (cutLen / barStock) * 100;
                                    cursor += cutLen + (settings?.kerf || 3);
                                    return (
                                      <div key={idx}
                                        className="absolute inset-y-0 border-r border-surface-800 text-[8px] text-white flex items-center justify-center overflow-hidden px-0.5"
                                        style={{
                                          left: `${left}%`,
                                          width: `${width}%`,
                                          background: bar.isOffcut ? 'rgba(217,161,53,0.6)' : 'rgba(0,180,160,0.6)',
                                        }}
                                        title={`${label} ${cutLen} mm${elName ? ' — ' + elName : ''}`}>
                                        <span className="truncate">
                                          {cutLen > barStock * 0.08 ? `${label} ${cutLen}` : (label || '')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="w-20 text-[10px] text-ink-400 text-right font-mono">
                                {(bar.utilization * 100).toFixed(0)}% {bar.isOffcut ? `(${barStock})` : ''}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Offcuts input */}
                    <div className="mt-3 pt-3 border-t border-surface-500/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-ink-400">Offcuts:</span>
                        {groupOffcuts.map((oc, idx) => (
                          <span key={idx} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {oc} mm
                            <button onClick={() => handleRemoveOffcut(group.key, idx)} className="text-amber-400 hover:text-amber-200">×</button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            className="w-16 text-[10px] bg-surface-700 border border-surface-500 rounded px-1.5 py-0.5 text-ink-200 outline-none focus:border-accent-500"
                            placeholder="mm"
                            value={offcutInput[group.key] || ''}
                            onChange={(e) => setOffcutInput((p) => ({ ...p, [group.key]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddOffcut(group.key); }}
                          />
                          <button
                            onClick={() => handleAddOffcut(group.key)}
                            className="text-[10px] px-2 py-0.5 rounded bg-surface-700 text-ink-300 hover:text-accent-400 hover:bg-surface-600 border border-surface-500 transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Elements table */}
                <GroupedElementTable items={group.items} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupedElementTable({ items }) {
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = `${it.elementName}|${it.length}`;
      if (!map.has(key)) {
        map.set(key, { element: it.elementName, length: it.length, finishedLength: it.finishedLength || it.length, section: it.section || '', totalQty: 0 });
      }
      map.get(key).totalQty += it.quantity;
    });
    return Array.from(map.values()).sort((a, b) => a.element.localeCompare(b.element));
  }, [items]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-500/50 bg-surface-700/30">
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Element</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Pre-Cut</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Finished</th>
            <th className="px-4 py-2 text-left text-ink-400 font-medium">Section</th>
            <th className="px-4 py-2 text-right text-ink-400 font-medium">Total Qty</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((g, i) => {
            const sym = getPartSymbol(g.element);
            return (
              <tr key={i} className="border-b border-surface-500/30">
                <td className="px-4 py-2 text-ink-100">{g.element} <span className="text-accent-400 font-mono text-[10px]">({sym.symbol})</span>{sym.mirror ? <span className="text-purple-400 text-[9px] ml-1">⟷</span> : ''}</td>
                <td className="px-4 py-2 text-right text-ink-100 font-mono">{g.length} mm</td>
                <td className="px-4 py-2 text-right text-ink-300 font-mono">{g.finishedLength} mm</td>
                <td className="px-4 py-2 text-ink-300">{g.section}</td>
                <td className="px-4 py-2 text-right text-ink-100 font-semibold">{g.totalQty}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
