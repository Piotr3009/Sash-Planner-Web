import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { mockProjects } from '../mocks/mockProjects.js';
import '../3d/styles.css';
const Viewer3D = lazy(() => import('../3d/App.jsx'));

const BAR_OPTIONS = [
  { value: 'none', label: 'None' }, { value: '2x2', label: '2×2' }, { value: '3x3', label: '3×3' },
  { value: '4x4', label: '4×4' }, { value: '6x6', label: '6×6' }, { value: '9x9', label: '9×9' },
  { value: 'custom', label: 'Custom' },
];
const SASH_TYPES = [{ value: 'double', label: 'Double Hung' }, { value: 'triple', label: 'Triple Sash' }];
const SPLIT_RATIOS = [
  { value: '1/4-1/2-1/4', label: '1/4 – 1/2 – 1/4' },
  { value: '1/3-1/3-1/3', label: '1/3 – 1/3 – 1/3' },
  { value: '1/5-3/5-1/5', label: '1/5 – 3/5 – 1/5' },
];
const HEAD_TYPES = [{ value: 'flat', label: 'Flat' }, { value: 'arch', label: 'Arch' }];
const GLASS_FINISHES = [{ value: 'clear', label: 'Clear' }, { value: 'frosted', label: 'Frosted' }];
const FROSTED_LOCS = [{ value: 'bottom', label: 'Bottom Only' }, { value: 'both', label: 'Both' }];
const OPENINGS = [{ value: 'both', label: 'Both Open' }, { value: 'bottom', label: 'Bottom Only' }, { value: 'fixed', label: 'Fixed' }];

export default function ConfiguratorPage() {
  const { projectId, batchId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const addWindow = useProjectStore((s) => s.addWindowToBatch);

  useEffect(() => {
    if (projects.length === 0) useProjectStore.getState().setProjects(mockProjects);
  }, []);

  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const batch = project?.batches?.find(b => b.id === batchId);
  const def = batch?.defaults || {};

  // Per-window state
  const [winName, setWinName] = useState('');
  const [sashType, setSashType] = useState('double');
  const [splitRatio, setSplitRatio] = useState('1/4-1/2-1/4');
  const [headType, setHeadType] = useState('flat');
  const [inW, setInW] = useState(1000);
  const [inH, setInH] = useState(1500);
  const [uBars, setUBars] = useState('none');
  const [lBars, setLBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  const [uCustom, setUCustom] = useState([]);
  const [lCustom, setLCustom] = useState([]);
  const [opening, setOpening] = useState('both');
  const [gFin, setGFin] = useState('clear');
  const [frostLoc, setFrostLoc] = useState('bottom');

  // From batch defaults (read-only in configurator)
  const horn = def.hornType || 'A';
  const boxType = def.frameType || 'standard';
  const colType = def.colourMode || 'single';
  const wc = def.woodColor || '#F6F6F6';
  const wcE = def.woodColorExt || '#F6F6F6';
  const wcI = def.woodColorInt || '#F6F6F6';
  const isSingle = colType === 'single';
  const gType = def.glassType || 'double';
  const gSpec = def.glassSpec || 'toughened';
  const spacer = def.spacerColor || 'silver';
  const pas24 = def.pas24 || false;
  const iron = def.ironmongery || 'brass';
  const frameDepth = gType === 'triple' ? 172 : (boxType === 'standard' ? 164 : 144);

  const extW = Number(inW) || 400;
  const extH = Number(inH) || 400;
  const effectiveLBars = sameBars ? uBars : lBars;

  // 3D sync
  const sync = useCallback(() => {
    if (typeof window.update3D !== 'function') return;
    window.update3D({
      windowCategory: batch?.type || 'sash', extWidth: extW, extHeight: extH,
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? (sameBars ? uCustom : lCustom) : [],
      showHorns: horn !== 'none', hornType: horn === 'none' ? 'A' : horn,
      woodColor: wc, woodColorExt: isSingle ? wc : wcE, woodColorInt: isSingle ? wc : wcI, sameColor: isSingle,
      ironmongery: iron,
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening,
      boxType: gType === 'triple' ? 'standard' : boxType, boxDepth: frameDepth,
    });
  }, [extW, extH, uBars, effectiveLBars, sameBars, uCustom, lCustom, horn, wc, wcE, wcI, isSingle, iron, gFin, frostLoc, spacer, sashType, splitRatio, headType, opening, boxType, gType, frameDepth, batch?.type]);
  useEffect(() => { sync(); }, [sync]);

  const save = () => {
    addWindow(projectId, batchId, {
      windowName: winName, windowCategory: batch?.type || 'sash',
      extWidth: extW, extHeight: extH, inputWidth: inW, inputHeight: inH, measurementType: 'box-to-box',
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? (sameBars ? uCustom : lCustom) : [],
      showHorns: horn !== 'none', hornType: horn,
      woodColor: wc, woodColorExt: isSingle ? wc : wcE, woodColorInt: isSingle ? wc : wcI,
      colourMode: colType, sameColor: isSingle, ironmongery: iron, doubleGlazing: gType !== 'single',
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      glassType: gType, glassSpec: gSpec, glassFinish: gFin, frostedLocation: frostLoc,
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening,
      frameType: gType === 'triple' ? 'standard' : boxType, frameDepth, pas24,
    });
    navigate(`/projects/${projectId}`);
  };

  const addBar = (setter, list, type) => {
    const pos = prompt(`Position in mm from ${type === 'v' ? 'left' : 'top'} edge:`);
    if (pos && !isNaN(Number(pos)) && Number(pos) > 0) setter([...list, { type, position: Number(pos) }].sort((a, b) => a.position - b.position));
  };
  const removeBar = (setter, list, idx) => setter(list.filter((_, i) => i !== idx));

  if (!batch) return <div className="p-8 text-ink-400">Batch not found.</div>;
  const isSash = batch.type === 'sash';

  return (
    <div className="h-full flex flex-col bg-surface-800">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-500 bg-surface-900 shrink-0">
        <div>
          <button onClick={() => navigate(`/projects/${projectId}`)} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to {project?.name || 'project'}</button>
          <h1 className="text-lg font-semibold text-ink-50">{batch.label} — Add Window</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Window name (W1, Kitchen Left)" value={winName} onChange={e => setWinName(e.target.value)}
            className={`px-3 py-2 border-2 rounded-lg text-sm w-56 bg-surface-800 ${winName.trim() ? 'border-accent-500 text-ink-50' : 'border-status-danger/50 text-ink-200'}`} />
          <button onClick={save} className="btn btn-primary">✓ Save to Batch</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Per-window controls only */}
        <div className="w-80 shrink-0 border-r border-surface-500 bg-surface-900 overflow-y-auto">
          {/* Batch defaults info */}
          <div className="px-4 py-2 bg-accent-500/10 border-b border-accent-500/20 text-[10px] text-accent-400">
            Batch: {def.ironmongery}, {isSingle ? 'single' : 'dual'} colour, {gType} glass{isSash ? `, horns ${horn}` : ''}, frame {frameDepth}mm
          </div>

          {isSash && <Sec t="Sash Type">
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <select value={splitRatio} onChange={e => setSplitRatio(e.target.value)} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2">{SPLIT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
            <Lbl>Head</Lbl><HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
          </Sec>}

          <Sec t="Dimensions (Frame)">
            <div className="grid grid-cols-2 gap-3">
              <div><Lbl>Width (mm)</Lbl><input type="number" min={400} max={3000} step={10} value={inW} onChange={e => setInW(e.target.value === '' ? '' : Number(e.target.value))} onBlur={e => { const v = Number(e.target.value); setInW(isNaN(v) || v < 400 ? 400 : v > 3000 ? 3000 : v); }} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" /></div>
              <div><Lbl>Height (mm)</Lbl><input type="number" min={400} max={3000} step={10} value={inH} onChange={e => setInH(e.target.value === '' ? '' : Number(e.target.value))} onBlur={e => { const v = Number(e.target.value); setInH(isNaN(v) || v < 400 ? 400 : v > 3000 ? 3000 : v); }} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" /></div>
            </div>
          </Sec>

          {isSash && <Sec t="Georgian Bars">
            <Lbl>Upper</Lbl><GChips o={BAR_OPTIONS} v={uBars} c={v => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && <CBarEd bars={uCustom} onAddV={() => addBar(setUCustom, uCustom, 'v')} onAddH={() => addBar(setUCustom, uCustom, 'h')} onRemove={i => removeBar(setUCustom, uCustom, i)} />}
            <label className="flex items-center gap-2 text-xs text-ink-400 mb-2 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={e => setSameBars(e.target.checked)} className="accent-accent-500" />Same upper & lower</label>
            {!sameBars && <><Lbl>Lower</Lbl><GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />{lBars === 'custom' && <CBarEd bars={lCustom} onAddV={() => addBar(setLCustom, lCustom, 'v')} onAddH={() => addBar(setLCustom, lCustom, 'h')} onRemove={i => removeBar(setLCustom, lCustom, i)} />}</>}
          </Sec>}

          <Sec t="Opening"><HChips o={OPENINGS} v={opening} c={setOpening} /></Sec>

          <Sec t="Glass Finish">
            <HChips o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin === 'frosted' && <><Lbl>Location</Lbl><HChips o={FROSTED_LOCS} v={frostLoc} c={setFrostLoc} /></>}
          </Sec>
        </div>

        {/* CENTER: 3D */}
        <div className="flex-1 relative">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">Loading 3D…</div>}>
            <Viewer3D />
          </Suspense>
        </div>

        {/* RIGHT: Spec panel */}
        <div className="w-64 shrink-0 border-l border-surface-500 bg-surface-900 overflow-y-auto text-xs">
          <div className="px-4 py-2 bg-surface-700 border-b border-surface-500 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Specification</div>
          <SG t="Dimensions"><SR l="Frame" v={`${extW} × ${extH}`} /><SR l="Depth" v={`${frameDepth}mm`} /></SG>
          {isSash && <SG t="Product"><SR l="Sash" v={sashType} /><SR l="Head" v={headType} /></SG>}
          <SG t="Bars"><SR l="Upper" v={uBars} />{!sameBars && <SR l="Lower" v={lBars} />}</SG>
          <SG t="Frame & Horns"><SR l="Frame" v={`${frameDepth}mm`} /><SR l="Horns" v={horn} /></SG>
          <SG t="Colour">
            <SR l="Mode" v={colType} />
            <div className="flex items-center gap-2 px-4 py-1">
              <div className="w-3 h-3 rounded border border-surface-400" style={{ backgroundColor: wc }} />
              <span className="text-ink-200">{isSingle ? wc : `Ext: ${wcE}`}</span>
            </div>
            {!isSingle && <div className="flex items-center gap-2 px-4 py-1">
              <div className="w-3 h-3 rounded border border-surface-400" style={{ backgroundColor: wcI }} />
              <span className="text-ink-200">Int: {wcI}</span>
            </div>}
          </SG>
          <SG t="Glass"><SR l="Type" v={gType} /><SR l="Spec" v={gSpec} /><SR l="Finish" v={gFin} /><SR l="Spacer" v={spacer} /></SG>
          <SG t="Opening"><SR l="Type" v={opening} /></SG>
          <SG t="Hardware"><SR l="PAS24" v={pas24 ? 'Yes' : 'No'} /><SR l="Ironmongery" v={iron} /></SG>
        </div>
      </div>
    </div>
  );
}

// ─── UI Components (dark theme) ───
function Sec({ t, children }) { return <div className="px-4 py-3 border-b border-surface-500"><div className="text-xs font-semibold text-ink-100 uppercase tracking-wider mb-2">{t}</div>{children}</div>; }
function Lbl({ children }) { return <div className="text-xs text-ink-400 font-medium mb-1 mt-1.5">{children}</div>; }
function HChips({ o, v, c }) { return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => <button key={String(x.value)} onClick={() => c(x.value)} className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }
function GChips({ o, v, c }) { return <div className="grid grid-cols-4 gap-1 mb-2">{o.map(x => <button key={x.value} onClick={() => c(x.value)} className={`px-1.5 py-1 text-[11px] rounded border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }
function CBarEd({ bars, onAddV, onAddH, onRemove }) {
  return <div className="bg-surface-600 rounded-lg p-2 mb-2 text-xs border border-surface-500">
    <div className="flex gap-2 mb-1"><button onClick={onAddV} className="px-2 py-0.5 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-200 hover:bg-surface-500">+V</button><button onClick={onAddH} className="px-2 py-0.5 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-200 hover:bg-surface-500">+H</button></div>
    {bars.map((b, i) => <span key={i} className="inline-flex items-center gap-0.5 bg-surface-700 border border-surface-500 rounded px-1 py-0.5 mr-1 mb-0.5 text-[10px] text-ink-200">{b.type}:{b.position}mm <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-300">×</button></span>)}
    {bars.length === 0 && <span className="text-ink-400 text-[10px]">No custom bars</span>}
  </div>;
}
function SG({ t, children }) { return <div className="border-b border-surface-500"><div className="px-4 py-1.5 bg-surface-700 text-[10px] font-semibold text-ink-400 uppercase">{t}</div><div className="py-0.5">{children}</div></div>; }
function SR({ l, v }) { return <div className="flex justify-between px-4 py-0.5"><span className="text-ink-400">{l}</span><span className="text-ink-100 font-medium">{v}</span></div>; }
