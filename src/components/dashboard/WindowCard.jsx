import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { normaliseToWindowSpec } from '../../engine/specification.js';
import { deriveWindowData } from '../../engine/calculations.js';
import MiniWindowSvg from './MiniWindowSvg.jsx';

export default function WindowCard({ item, spec, estimateId }) {
  const windowSpec = useMemo(() => normaliseToWindowSpec(item, spec), [item, spec]);
  const derived = useMemo(() => {
    try {
      return deriveWindowData(windowSpec);
    } catch (e) {
      return null;
    }
  }, [windowSpec]);

  return (
    <Link
      to={`/estimates/${estimateId}/windows/${item.id}`}
      className="card p-4 hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold">{item.window_number || `Window ${item.id.slice(0, 6)}`}</div>
          <div className="text-xs text-ink-400">{item.window_type || 'sash'}</div>
        </div>
        <div className="text-right text-xs">
          <div className="font-medium">{item.width}×{item.height}</div>
          <div className="text-ink-400">qty {item.quantity || 1}</div>
        </div>
      </div>

      <div className="flex-1 grid place-items-center bg-ink-50 rounded-lg p-3 mb-3">
        <MiniWindowSvg windowSpec={windowSpec} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Tag label="Bars" value={windowSpec.sash.grid.mode} />
        <Tag label="Glass" value={item.glass_type || 'double'} />
        <Tag label="Colour" value={item.color_single || windowSpec.color.single} />
        <Tag label="Horns" value={item.horns || 'none'} />
      </div>

      {derived && (
        <div className="mt-3 pt-3 border-t border-ink-200 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
          <span className="text-ink-400">Sash W</span>
          <span className="text-right">{derived.sashWidth} mm</span>
          <span className="text-ink-400">Top sash H</span>
          <span className="text-right">{derived.topSashHeight} mm</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-ink-400">Unit £{Number(item.unit_price || 0).toFixed(0)}</span>
        <span className="font-medium">£{Number(item.total_price || 0).toFixed(2)}</span>
      </div>
    </Link>
  );
}

function Tag({ label, value }) {
  if (!value) return <div />;
  return (
    <div className="px-2 py-1 rounded-md bg-ink-100 text-ink-700">
      <span className="text-ink-400 mr-1">{label}:</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}
