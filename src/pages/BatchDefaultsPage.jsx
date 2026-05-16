import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore, BATCH_DEFAULTS } from '../stores/projectStore.js';
import { mockProjects } from '../mocks/mockProjects.js';

const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const FRAME_TYPES = [{ value: 'standard', label: 'Standard (164mm)' }, { value: 'slim', label: 'Slim (144mm)' }];
const GLASS_TYPES = [{ value: 'double', label: 'Double (U: 1.4)' }, { value: 'triple', label: 'Triple (U: 1.2)' }, { value: 'passive', label: 'Passive (U: 0.8)' }];
const GLASS_SPECS = [{ value: 'toughened', label: 'Toughened' }, { value: 'laminated', label: 'Laminated' }];
const SPACERS = [{ value: 'silver', label: 'Silver' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }];
const IRON_FINISHES = [
  { value: 'brass', label: 'Brass' }, { value: 'chrome', label: 'Chrome' }, { value: 'stainless', label: 'Stainless Steel' },
  { value: 'antique_brass', label: 'Antique Brass' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' },
];

const RAL = [
  { g: 'Whites', o: [['#FFFFFF','9010 Pure White'],['#F6F6F6','9016 Traffic White'],['#FDF4E3','9001 Cream White']] },
  { g: 'Greys', o: [['#D7D7D7','7035 Light Grey'],['#293133','7016 Anthracite'],['#23282B','7021 Black Grey']] },
  { g: 'Blacks', o: [['#0A0A0A','9005 Jet Black'],['#1E1E1E','9017 Traffic Black']] },
  { g: 'Greens', o: [['#2F4538','6005 Moss Green'],['#4A4F3B','6003 Olive Green']] },
  { g: 'Blues', o: [['#1E2460','5002 Ultramarine'],['#1B2A4A','5011 Steel Blue']] },
  { g: 'Reds', o: [['#5E2129','3005 Wine Red']] },
  { g: 'Browns', o: [['#6F4F28','8008 Olive Brown'],['#45322E','8017 Chocolate Brown']] },
];

export default function BatchDefaultsPage() {
  const { projectId, batchId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const updateBatchDefaults = useProjectStore((s) => s.updateBatchDefaults);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  // Load project if needed
  useEffect(() => {
    if (projects.length === 0) useProjectStore.getState().setProjects(mockProjects);
  }, []);

  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const batch = project?.batches?.find(b => b.id === batchId);

  const [d, setD] = useState(batch?.defaults || BATCH_DEFAULTS[batch?.type] || BATCH_DEFAULTS.sash);

  useEffect(() => {
    if (batch?.defaults) setD(batch.defaults);
  }, [batch?.id]);

  if (!project || !batch) return <div className="p-8 text-ink-400">Batch not found.</div>;

  const isSash = batch.type === 'sash';
  const upd = (key, val) => setD(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    updateBatchDefaults(projectId, batchId, d);
    // Update currentProject in store
    const updatedProject = useProjectStore.getState().projects.find(p => p.id === projectId);
    if (updatedProject) setCurrentProject(updatedProject);
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate(`/projects/${projectId}`)} className="text-xs text-ink-400 hover:text-ink-600 mb-2 block">
        ← Back to {project.name}
      </button>
      <h1 className="text-2xl font-semibold mb-1">{batch.label} — Defaults</h1>
      <p className="text-sm text-ink-500 mb-6">
        These settings apply to all windows in this batch. You can override per window.
      </p>

      <div className="card p-6 space-y-5">

        {/* Ironmongery */}
        <Sec title="Ironmongery Finish">
          <HChips o={IRON_FINISHES} v={d.ironmongery} c={v => upd('ironmongery', v)} />
        </Sec>

        {/* Colour */}
        <Sec title="Colour">
          <HChips o={[{ value: 'single', label: 'Single Colour' }, { value: 'dual', label: 'Dual (+15%)' }]}
            v={d.colourMode} c={v => upd('colourMode', v)} />
          {d.colourMode === 'single' ? (
            <ColPick label="Colour" value={d.woodColor} onChange={hex => { upd('woodColor', hex); upd('woodColorExt', hex); upd('woodColorInt', hex); }} />
          ) : (<>
            <ColPick label="Exterior" value={d.woodColorExt} onChange={hex => upd('woodColorExt', hex)} />
            <ColPick label="Interior" value={d.woodColorInt} onChange={hex => upd('woodColorInt', hex)} />
          </>)}
        </Sec>

        {/* Glass */}
        <Sec title="Glass">
          <Lbl>Type</Lbl>
          <HChips o={GLASS_TYPES} v={d.glassType} c={v => upd('glassType', v)} />
          <Lbl>Specification</Lbl>
          <HChips o={GLASS_SPECS} v={d.glassSpec} c={v => upd('glassSpec', v)} />
          <Lbl>Spacer</Lbl>
          <HChips o={SPACERS} v={d.spacerColor} c={v => upd('spacerColor', v)} />
        </Sec>

        {/* PAS24 */}
        <Sec title="Security">
          <HChips o={[{ value: false, label: 'Standard' }, { value: true, label: 'PAS 24' }]}
            v={d.pas24} c={v => upd('pas24', v)} />
        </Sec>

        {/* Frame */}
        <Sec title="Frame">
          {d.glassType === 'triple' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              Triple glazing → 172mm frame (auto)
            </div>
          ) : (
            <HChips o={FRAME_TYPES} v={d.frameType} c={v => upd('frameType', v)} />
          )}
        </Sec>

        {/* Horns (sash only) */}
        {isSash && (
          <Sec title="Horns">
            <HChips o={HORN_OPTIONS} v={d.hornType} c={v => upd('hornType', v)} />
          </Sec>
        )}

        {/* Summary */}
        <div className="bg-ink-50 rounded-lg p-4 text-xs space-y-1">
          <div className="font-semibold text-ink-700 mb-2">Batch Defaults Summary</div>
          <SR l="Ironmongery" v={d.ironmongery} />
          <SR l="Colour" v={d.colourMode === 'single' ? 'Single' : 'Dual (+15%)'} />
          <SR l="Glass" v={`${d.glassType} / ${d.glassSpec}`} />
          <SR l="Spacer" v={d.spacerColor} />
          <SR l="PAS24" v={d.pas24 ? 'Yes' : 'No'} />
          <SR l="Frame" v={d.glassType === 'triple' ? '172mm (triple)' : (d.frameType === 'standard' ? '164mm' : '144mm')} />
          {isSash && <SR l="Horns" v={d.hornType === 'none' ? 'None' : d.hornType} />}
        </div>

        <button onClick={handleSave}
          className="w-full px-5 py-3 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          ✓ Save Defaults & Continue
        </button>
      </div>
    </div>
  );
}

// ─── UI Components ───
function Sec({ title, children }) {
  return <div className="border-b border-ink-100 pb-4"><div className="text-sm font-semibold text-ink-800 mb-2">{title}</div>{children}</div>;
}
function Lbl({ children }) { return <div className="text-xs text-ink-500 font-medium mb-1.5 mt-2">{children}</div>; }
function HChips({ o, v, c }) {
  return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => (
    <button key={String(x.value)} onClick={() => c(x.value)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${v === x.value ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{x.label}</button>
  ))}</div>;
}
function ColPick({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded border-2 border-ink-200 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-xs text-ink-400 font-mono">{value?.toUpperCase()}</span>
        <label className="ml-auto text-xs text-accent-600 cursor-pointer hover:underline">Custom<input type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" /></label>
      </div>
      <select value="" onChange={e => e.target.value && onChange(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs">
        <option value="">— RAL Colour —</option>
        {RAL.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
    </div>
  );
}
function SR({ l, v }) {
  return <div className="flex justify-between"><span className="text-ink-400">{l}</span><span className="text-ink-800 font-medium">{v}</span></div>;
}
