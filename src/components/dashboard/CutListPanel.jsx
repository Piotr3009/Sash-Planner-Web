/**
 * CutListPanel.jsx
 * Single-window cut list — styled to match Production Pack CutListTab.
 * Grouped by element with part symbols, mirror indicators, dark theme.
 */
import { useMemo } from 'react';
import { buildCutListForWindow } from '../../engine/lists.js';
import { getPartSymbol } from '../../engine/partSymbols.js';
import { useMaterialAssignmentStore } from '../../stores/materialAssignmentStore.js';
import { useMaterialStore } from '../../stores/materialStore.js';
import { exportCutListPDF } from '../../utils/cutListPdfExport.js';

export default function CutListPanel({ item, windowSpec, settings, derived, batch }) {
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const materials = useMaterialStore((s) => s.materials);
  const cutList = useMemo(() => {
    if (!derived || !windowSpec) return [];
    return buildCutListForWindow(derived, windowSpec);
  }, [derived, windowSpec]);

  const byElement = useMemo(() => {
    const map = new Map();
    cutList.forEach((c) => {
      const key = c.element;
      if (!map.has(key)) {
        map.set(key, {
          element: c.element,
          section: c.section,
          symbolInfo: getPartSymbol(c.element),
          items: [],
        });
      }
      map.get(key).items.push(c);
    });

    const groups = Array.from(map.values());
    groups.forEach((g) => {
      // Aggregate identical lengths
      const agg = new Map();
      g.items.forEach((it) => {
        const k = `${it.length}`;
        if (!agg.has(k)) agg.set(k, { ...it, totalQty: 0 });
        agg.get(k).totalQty += (it.quantity || 1);
      });
      g.aggregated = Array.from(agg.values()).sort((a, b) => a.length - b.length);
    });

    return groups;
  }, [cutList]);

  const totalPieces = cutList.reduce((s, c) => s + (c.quantity || 1), 0);

  const getMaterialForElement = (elementName) => {
    const sym = getPartSymbol(elementName);
    if (sym?.partId) {
      const a = assignments[sym.partId];
      if (a?.material_id) return materials.find((m) => m.id === a.material_id) || null;
    }
    return null;
  };

  const handleExport = () => {
    if (!byElement.length) return;
    const company = settings?.company || {};
    const groups = byElement.map((g) => {
      const m = getMaterialForElement(g.element);
      return {
        symbol: g.symbolInfo?.symbol || '',
        element: g.element,
        mirror: g.symbolInfo?.mirror,
        section: g.items[0]?.section || '',
        material: m ? `${m.item_number || ''} ${m.name || ''}`.trim() : '',
        rows: g.aggregated.map((it) => ({
          projectNum: batch?.projectNumber || '',
          window: item?.name || item?.window_number || '',
          length: it.length,
          qty: it.totalQty,
        })),
      };
    });
    exportCutListPDF({
      companyName: company.companyName || 'COMPANY NAME',
      companyAddress: company.companyAddress || '',
      logo: company.logo || '',
      title: item?.name || item?.window_number || 'Window',
      projects: batch?.projectNumber ? [batch.projectNumber] : [],
      date: new Date().toLocaleDateString('en-GB'),
      isPPMode: false,
      totalPieces,
      groups,
    });
  };

  if (!cutList.length) {
    return <div className="card p-8 text-center text-ink-400">No cut list data available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-50">Cut List <span className="text-ink-400 font-normal">· {totalPieces} pcs</span></div>
        <button onClick={handleExport} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
          📄 Export PDF
        </button>
      </div>
      {byElement.map((group) => {
        const sym = group.symbolInfo;
        const finishedSection = group.items[0]?.section || '—';

        return (
          <div key={group.element} className="card overflow-hidden">
            {/* Section header */}
            <div className="px-4 py-3 border-b border-surface-500 flex items-center gap-3 bg-surface-800">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">{sym.symbol}</span>
                  <span className="text-sm font-semibold text-ink-50">{group.element}</span>
                  {sym.mirror && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded" title="Mirror pair (L+R)">⟷ mirror</span>
                  )}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  Section: {finishedSection} · {group.aggregated.reduce((s, a) => s + a.totalQty, 0)} pcs
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-500 bg-surface-700/30">
                    <th className="px-4 py-2 text-left text-ink-400 font-medium w-16">Symbol</th>
                    <th className="px-4 py-2 text-right text-ink-400 font-medium">Length</th>
                    <th className="px-4 py-2 text-right text-ink-400 font-medium">Qty</th>
                    <th className="px-4 py-2 text-left text-ink-400 font-medium">Finished</th>
                    <th className="px-4 py-2 text-center text-ink-400 font-medium w-16">Mirror</th>
                  </tr>
                </thead>
                <tbody>
                  {group.aggregated.map((row, idx) => (
                    <tr key={idx} className="border-b border-surface-500/30 hover:bg-surface-700/20">
                      <td className="px-4 py-2 font-mono font-bold text-accent-400">{sym.symbol}</td>
                      <td className="px-4 py-2 text-right text-ink-100 font-mono">{row.length} mm</td>
                      <td className="px-4 py-2 text-right text-ink-100 font-semibold">{row.totalQty}</td>
                      <td className="px-4 py-2 text-ink-300">{finishedSection}</td>
                      <td className="px-4 py-2 text-center">
                        {sym.mirror ? <span className="text-purple-400">⟷</span> : <span className="text-ink-400/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="card px-4 py-3 text-xs text-ink-400">
        Total element types: {byElement.length} · Total pieces: {totalPieces}
      </div>
    </div>
  );
}
