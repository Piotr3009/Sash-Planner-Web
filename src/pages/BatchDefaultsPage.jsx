import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore, BATCH_DEFAULTS } from '../stores/projectStore.js';
import { GLASS_TYPES, GLASS_SPECS, SPACERS, RAL_GROUPS as RAL, FB_GROUPS as FB } from '../config.js';


const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const FRAME_TYPES = [{ value: 'standard', label: 'Standard (164mm)' }, { value: 'slim', label: 'Slim (144mm)' }];
const IRON_FINISHES = [
  { value: 'brass', label: 'Brass' }, { value: 'chrome', label: 'Chrome' }, { value: 'stainless', label: 'Stainless' },
  { value: 'antique_brass', label: 'Antique Brass' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' },
];

export default function BatchDefaultsPage() {
  const { projectId, batchId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const updateBatchDefaults = useProjectStore((s) => s.updateBatchDefaults);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const batch = project?.batches?.find(b => b.id === batchId);
  const [d, setD] = useState(batch?.defaults || BATCH_DEFAULTS[batch?.type] || BATCH_DEFAULTS.sash);

  useEffect(() => { if (batch?.defaults) setD(batch.defaults); }, [batch?.id]);

  if (!project || !batch) return <div className="p-8 text-ink-400">Batch not found.</div>;

  const isSash = batch.type === 'sash';
  const upd = (key, val) => setD(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    updateBatchDefaults(projectId, batchId, d);
    const updatedProject = useProjectStore.getState().projects.find(p => p.id === projectId);
    if (updatedProject) setCurrentProject(updatedProject);
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-surface-800 p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(`/projects/${projectId}`)} className="text-xs text-ink-400 hover:text-accent-400 mb-2 block transition-colors">← Back to {project.name}</button>
        <h1 className="text-2xl font-bold text-ink-50 mb-1">{batch.label} — Defaults</h1>
        <p className="text-sm text-ink-400 mb-6">These settings apply to all windows in this batch. Override per window is not available — create a separate batch for different settings.</p>

        <div className="card p-6 space-y-6">

          {/* 1. COLOUR */}
          <Sec title="Colour">
            <HChips o={[{ value: 'single', label: 'Single Colour' }, { value: 'dual', label: 'Dual (+15%)' }]} v={d.colourMode} c={v => upd('colourMode', v)} />
            {d.colourMode === 'single' ? (
              <ColPick label="Colour" value={d.woodColor} onChange={hex => { upd('woodColor', hex); upd('woodColorExt', hex); upd('woodColorInt', hex); }} />
            ) : (<>
              <ColPick label="Exterior" value={d.woodColorExt} onChange={hex => upd('woodColorExt', hex)} />
              <ColPick label="Interior" value={d.woodColorInt} onChange={hex => upd('woodColorInt', hex)} />
            </>)}
          </Sec>

          {/* 2. GLASS */}
          <Sec title="Glass">
            <Lbl>Type</Lbl><HChips o={GLASS_TYPES} v={d.glassType} c={v => upd('glassType', v)} />
            <Lbl>Specification</Lbl><HChips o={GLASS_SPECS} v={d.glassSpec} c={v => upd('glassSpec', v)} />
            <Lbl>Spacer</Lbl><HChips o={SPACERS} v={d.spacerColor} c={v => upd('spacerColor', v)} />
          </Sec>

          {/* 3. SECURITY */}
          <Sec title="Security">
            <HChips o={[{ value: false, label: 'Standard' }, { value: true, label: 'PAS 24' }]} v={d.pas24} c={v => upd('pas24', v)} />
          </Sec>

          {/* 4. FRAME */}
          <Sec title="Frame">
            {d.glassType === 'triple' ? (
              <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-3 text-xs text-accent-400">Triple glazing → 172mm frame (auto)</div>
            ) : (
              <HChips o={FRAME_TYPES} v={d.frameType} c={v => upd('frameType', v)} />
            )}
          </Sec>

          {/* 5. HORNS (sash only) */}
          {isSash && (
            <Sec title="Horns">
              <HChips o={HORN_OPTIONS} v={d.hornType} c={v => upd('hornType', v)} />
            </Sec>
          )}

          {/* 6. IRONMONGERY (last) */}
          <Sec title="Ironmongery Finish">
            <HChips o={IRON_FINISHES} v={d.ironmongery} c={v => upd('ironmongery', v)} />
            <button onClick={() => navigate('/ironmongery')}
              className="w-full mt-2 px-4 py-3 border-2 border-dashed border-surface-500 rounded-lg text-xs text-ink-400 hover:border-accent-500/40 hover:text-accent-400 transition-colors text-center">
              🔧 Browse ironmongery database →
            </button>
          </Sec>

          {/* SUMMARY */}
          <div className="bg-surface-600 rounded-lg p-4 text-xs space-y-1.5 border border-surface-500">
            <div className="font-semibold text-ink-100 mb-2">Batch Defaults Summary</div>
            <SR l="Colour" v={d.colourMode === 'single' ? 'Single' : 'Dual (+15%)'} />
            <SR l="Glass" v={`${d.glassType} / ${d.glassSpec}`} />
            <SR l="Spacer" v={d.spacerColor} />
            <SR l="PAS24" v={d.pas24 ? 'Yes' : 'No'} />
            <SR l="Frame" v={d.glassType === 'triple' ? '172mm (triple)' : (d.frameType === 'standard' ? '164mm' : '144mm')} />
            {isSash && <SR l="Horns" v={d.hornType === 'none' ? 'None' : d.hornType} />}
            <SR l="Ironmongery" v={d.ironmongery} />
          </div>

          <button onClick={handleSave} className="w-full btn btn-primary py-3 text-sm">✓ Save Defaults & Continue</button>
        </div>
      </div>
    </div>
  );
}

// ─── UI Components ───
function Sec({ title, children }) {
  return <div className="border-b border-surface-500 pb-5"><div className="text-sm font-semibold text-ink-50 mb-3">{title}</div>{children}</div>;
}
function Lbl({ children }) { return <div className="text-xs text-ink-400 font-medium mb-1.5 mt-2">{children}</div>; }
function HChips({ o, v, c }) {
  return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => (
    <button key={String(x.value)} onClick={() => c(x.value)}
      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500 hover:text-ink-50'}`}>{x.label}</button>
  ))}</div>;
}
function ColPick({ label, value, onChange }) {
  return (
    <div className="mb-3">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded border-2 border-surface-400 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-xs text-ink-400 font-mono">{value?.toUpperCase()}</span>
        <label className="ml-auto text-xs text-accent-400 cursor-pointer hover:text-accent-300 transition-colors">Custom<input type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" /></label>
      </div>
      <select value="" onChange={e => e.target.value && onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-accent-500">
        <option value="">— RAL Colour —</option>
        {RAL.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
      <select value="" onChange={e => e.target.value && onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-accent-500">
        <option value="">— Farrow & Ball —</option>
        {FB.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
    </div>
  );
}
function SR({ l, v }) {
  return <div className="flex justify-between"><span className="text-ink-400">{l}</span><span className="text-ink-100 font-medium">{v}</span></div>;
}
