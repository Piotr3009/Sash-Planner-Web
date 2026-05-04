import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { optimisePrecut } from '../../engine/optimizer.js';
import { buildPrecutForWindow, buildCutListForWindow, buildGlassListForWindow, buildHardwareList } from '../../engine/lists.js';

export default function CutListPanel({ item, windowSpec, settings, derived }) {
  const lists = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const cutList = buildCutListForWindow(derived, windowSpec);
    const precut = buildPrecutForWindow(derived, windowSpec, settings);
    const glass = buildGlassListForWindow(derived, windowSpec);
    const hardware = buildHardwareList(windowSpec);
    let optimization = null;
    try {
      optimization = optimisePrecut(precut, settings);
    } catch (e) {
      console.warn('optimisePrecut failed:', e);
    }
    return { cutList, precut, glass, hardware, optimization };
  }, [windowSpec, derived, settings]);

  if (!lists) return <div className="text-ink-400">Calculations not available.</div>;

  return (
    <div className="space-y-4">
      <Section title={`Cut List — ${item.window_number || 'Window'}`}>
        <Table
          columns={['Element', 'Section', 'Length (mm)', 'Qty', 'Material', 'Notes']}
          rows={lists.cutList.map((c) => [c.element, c.section || '', c.length, c.quantity, c.material || '', c.notes || ''])}
        />
      </Section>

      <Section title="Pre-cut groups (sash sections)">
        {lists.precut.sashEngineering.length === 0 ? (
          <div className="text-ink-400 text-sm">No sash pre-cut required.</div>
        ) : (
          lists.precut.sashEngineering.map((g) => (
            <div key={g.section} className="mb-3">
              <div className="text-sm font-medium mb-1">Section {g.section}</div>
              <Table
                columns={['Element', 'Length (mm)', 'Qty', 'Window']}
                rows={g.items.map((it) => [it.elementName, it.length, it.quantity, it.windowName || ''])}
              />
            </div>
          ))
        )}
      </Section>

      {lists.optimization && (
        <Section title="Optimizer — Bar layout">
          {lists.optimization.sashEngineering.length === 0 ? (
            <div className="text-ink-400 text-sm">No optimizer output.</div>
          ) : (
            lists.optimization.sashEngineering.map((g) => (
              <div key={g.section} className="mb-4">
                <div className="text-sm font-medium mb-1">Section {g.section}</div>
                <BarVisualization
                  bars={g.bars}
                  stockLength={settings.stockLengthSash}
                  endTrim={settings.endTrim}
                />
                <div className="text-xs text-ink-400 mt-1">
                  Total bars: {g.summary.totalBars} · Waste: {g.summary.wasteTotal} mm · Avg utilisation: {(g.summary.utilAvg * 100).toFixed(1)}%
                </div>
              </div>
            ))
          )}
        </Section>
      )}

      <Section title="Glass list">
        <Table
          columns={['Pane', 'Width × Height (mm)', 'Qty', 'Type', 'Spacer', 'Finish']}
          rows={lists.glass.map((p) => [p.label, `${p.width} × ${p.height}`, p.quantity, p.type, p.spacer, p.finish])}
        />
      </Section>

      <Section title="Hardware / Ironmongery">
        <Table columns={['Item', 'Detail', 'Qty']} rows={lists.hardware.map((h) => [h.item, h.detail, h.quantity])} />
      </Section>

      <Section title="Frame constants used">
        <div className="text-xs text-ink-400 grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4">
          <Const label="Sash W deduction" value={`${CONSTANTS.SASH_WIDTH_DEDUCTION} mm`} />
          <Const label="Sash H deduction" value={`${CONSTANTS.SASH_HEIGHT_DEDUCTION} mm`} />
          <Const label="Stile width" value={`${CONSTANTS.STILE_WIDTH} mm`} />
          <Const label="Top rail" value={`${CONSTANTS.TOP_RAIL_WIDTH} mm`} />
          <Const label="Meeting rail" value={`${CONSTANTS.MEETING_RAIL_WIDTH} mm`} />
          <Const label="Bottom rail" value={`${CONSTANTS.BOTTOM_RAIL_WIDTH} mm`} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function Const({ label, value }) {
  return (
    <div className="flex justify-between border-b border-dashed border-ink-200 pb-0.5">
      <span>{label}</span>
      <span className="text-ink-800 font-medium">{value}</span>
    </div>
  );
}

function Table({ columns, rows }) {
  if (rows.length === 0) return <div className="text-ink-400 text-sm">No rows.</div>;
  return (
    <div className="overflow-auto border border-ink-200 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-ink-50 text-ink-600 uppercase tracking-wider">
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-ink-200">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-ink-800">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarVisualization({ bars, stockLength, endTrim }) {
  return (
    <div className="space-y-1">
      {bars.map((bar) => {
        let cursor = endTrim;
        return (
          <div key={bar.barId} className="flex items-center gap-2">
            <div className="w-24 text-[11px] text-ink-600 font-mono">{bar.barId}</div>
            <div className="flex-1 h-6 bg-ink-100 rounded relative overflow-hidden border border-ink-200">
              <div
                className="absolute inset-y-0 bg-ink-200"
                style={{ left: 0, width: `${(endTrim / stockLength) * 100}%` }}
                title={`End trim ${endTrim} mm`}
              />
              {bar.cuts.map((cut, idx) => {
                const left = (cursor / stockLength) * 100;
                const width = (cut / stockLength) * 100;
                cursor += cut;
                return (
                  <div
                    key={idx}
                    className="absolute inset-y-0 bg-accent-500/80 border-r border-white text-[10px] text-white grid place-items-center"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${cut} mm`}
                  >
                    {cut > stockLength * 0.05 ? cut : ''}
                  </div>
                );
              })}
            </div>
            <div className="w-20 text-[11px] text-ink-400 text-right">{(bar.utilization * 100).toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}
