/**
 * DrawingsPanel.jsx
 * Container for 2D technical drawings with sub-tabs.
 */
import { useState } from 'react';
import FrontElevation2D from './FrontElevation2D.jsx';

const SUB_TABS = [
  { id: 'elevation', label: 'Front Elevation' },
  { id: 'box', label: 'Box Detail' },
  { id: 'upper', label: 'Upper Sash' },
  { id: 'lower', label: 'Lower Sash' },
  { id: 'vsection', label: 'V-Section' },
  { id: 'hsection', label: 'H-Section' },
];

export default function DrawingsPanel({ windowSpec, settings, derived }) {
  const [subTab, setSubTab] = useState('elevation');

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              subTab === t.id
                ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium'
                : 'border-surface-500 text-ink-400 bg-surface-600 hover:bg-surface-500 hover:text-ink-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Drawing area */}
      <div className="card p-4 min-h-[400px]">
        {subTab === 'elevation' && (
          <FrontElevation2D windowSpec={windowSpec} derived={derived} />
        )}
        {subTab === 'box' && (
          <Placeholder title="Box Detail" desc="Cross-section of the box frame — head, sill, jamb profiles with dimensions." />
        )}
        {subTab === 'upper' && (
          <Placeholder title="Upper Sash Detail" desc="Upper sash with stiles, top rail, meeting rail, bars, horn detail." />
        )}
        {subTab === 'lower' && (
          <Placeholder title="Lower Sash Detail" desc="Lower sash with stiles, bottom rail, meeting rail, bars, horn detail." />
        )}
        {subTab === 'vsection' && (
          <Placeholder title="Vertical Section" desc="Full vertical cut through the window — head to sill, showing all profiles." />
        )}
        {subTab === 'hsection' && (
          <Placeholder title="Horizontal Section" desc="Horizontal cut at meeting rail level — parting bead, staff bead, sash overlap." />
        )}
      </div>
    </div>
  );
}

function Placeholder({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="text-3xl mb-3 opacity-30">📐</div>
      <div className="text-sm font-medium text-ink-200 mb-1">{title}</div>
      <div className="text-xs text-ink-400 max-w-sm">{desc}</div>
      <div className="mt-4 px-3 py-1 rounded-full bg-surface-600 border border-surface-500 text-[10px] text-ink-400">
        Coming soon
      </div>
    </div>
  );
}
