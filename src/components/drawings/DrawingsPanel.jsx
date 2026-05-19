/**
 * DrawingsPanel.jsx
 * Container for 2D technical drawings with sub-tabs.
 */
import { useState } from 'react';
import FrontElevation2D from './FrontElevation2D.jsx';
import BoxDetail2D from './BoxDetail2D.jsx';
import SashDetail2D from './SashDetail2D.jsx';
import VerticalSection2D from './VerticalSection2D.jsx';
import HorizontalSection2D from './HorizontalSection2D.jsx';

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
          <BoxDetail2D windowSpec={windowSpec} derived={derived} />
        )}
        {subTab === 'upper' && (
          <SashDetail2D windowSpec={windowSpec} derived={derived} type="upper" />
        )}
        {subTab === 'lower' && (
          <SashDetail2D windowSpec={windowSpec} derived={derived} type="lower" />
        )}
        {subTab === 'vsection' && (
          <VerticalSection2D windowSpec={windowSpec} derived={derived} />
        )}
        {subTab === 'hsection' && (
          <HorizontalSection2D windowSpec={windowSpec} derived={derived} />
        )}
      </div>
    </div>
  );
}
