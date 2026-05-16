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
const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const SASH_TYPES = [{ value: 'double', label: 'Double Hung' }, { value: 'triple', label: 'Triple Sash' }];
const SPLIT_RATIOS = [
  { value: '1/4-1/2-1/4', label: '1/4 – 1/2 – 1/4' },
  { value: '1/3-1/3-1/3', label: '1/3 – 1/3 – 1/3' },
  { value: '1/5-3/5-1/5', label: '1/5 – 3/5 – 1/5' },
];
const HEAD_TYPES = [{ value: 'flat', label: 'Flat' }, { value: 'arch', label: 'Arch' }];
const FRAME_TYPES = [{ value: 'standard', label: 'Standard (164mm)' }, { value: 'slim', label: 'Slim (144mm)' }];
const GLASS_TYPES = [{ value: 'double', label: 'Double' }, { value: 'triple', label: 'Triple' }, { value: 'passive', label: 'Passive' }];
const GLASS_SPECS = [{ value: 'toughened', label: 'Toughened' }, { value: 'laminated', label: 'Laminated' }];
const GLASS_FINISHES = [{ value: 'clear', label: 'Clear' }, { value: 'frosted', label: 'Frosted' }];
const FROSTED_LOCS = [{ value: 'bottom', label: 'Bottom Only' }, { value: 'both', label: 'Both' }];
const SPACERS = [{ value: 'silver', label: 'Silver' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }];
const OPENINGS = [{ value: 'both', label: 'Both Open' }, { value: 'bottom', label: 'Bottom Only' }, { value: 'fixed', label: 'Fixed' }];

const RAL = [
  { g: 'Whites', o: [['#FFFFFF','9010'],['#F6F6F6','9016'],['#FDF4E3','9001']] },
  { g: 'Greys', o: [['#D7D7D7','7035'],['#293133','7016'],['#23282B','7021']] },
  { g: 'Blacks', o: [['#0A0A0A','9005'],['#1E1E1E','9017']] },
  { g: 'Greens', o: [['#2F4538','6005'],['#4A4F3B','6003']] },
  { g: 'Blues', o: [['#1E2460','5002'],['#1B2A4A','5011']] },
  { g: 'Reds', o: [['#5E2129','3005']] },
  { g: 'Browns', o: [['#6F4F28','8008'],['#45322E','8017']] },
];
const FB = [
  { g: 'Whites', o: [['#fdfbfc','All White'],['#f2f0e8','Strong White'],['#ede8dc','Great White']] },
  { g: 'Neutrals', o: [['#ccbfb3',"Elephant's Breath"],['#d0ccc4','Ammonite']] },
  { g: 'Greys', o: [['#45484b','Railings'],['#313639','Off-Black']] },
  { g: 'Greens', o: [['#485840','Viridian'],['#708068','Chappell Green']] },
  { g: 'Blues', o: [['#2c3437','Hague Blue'],['#2c3a48','Stiffkey Blue']] },
];

export default function ConfiguratorPage() {
  const { projectId, batchId } = useParams();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const addWindow = useProjectStore((s) => s.addWindowToBatch);

  // Load projects if needed
  useEffect(() => {
    if (projects.length === 0) useProjectStore.getState().setProjects(mockProjects);
  }, []);

  // Get batch and its defaults
  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const batch = project?.batches?.find(b => b.id === batchId);
  const def = batch?.defaults || {};

  // State — initialized from batch defaults
  const [winName, setWinName] = useState('');
  const [sashType, setSashType] = useState('double');
  const [splitRatio, setSplitRatio] = useState('1/4-1/2-1/4');
  const [headType, setHeadType] = useState('flat');
  const [mType, setMType] = useState('box-to-box');
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

  // These come from batch defaults
  const [boxType, setBoxType] = useState(def.frameType || 'standard');
  const [horn, setHorn] = useState(def.hornType || 'A');
  const [colType, setColType] = useState(def.colourMode || 'single');
  const [wc, setWc] = useState(def.woodColor || '#F6F6F6');
  const [wcE, setWcE] = useState(def.woodColorExt || '#F6F6F6');
  const [wcI, setWcI] = useState(def.woodColorInt || '#F6F6F6');
  const [gType, setGType] = useState(def.glassType || 'double');
  const [gSpec, setGSpec] = useState(def.glassSpec || 'toughened');
  const [spacer, setSpacer] = useState(def.spacerColor || 'silver');
  const [pas24, setPas24] = useState(def.pas24 || false);
  const [iron, setIron] = useState(def.ironmongery || 'brass');

  const isSingle = colType === 'single';
  const extW = mType === 'brick-to-brick' ? (Number(inW) || 400) + 150 : (Number(inW) || 400);
  const extH = mType === 'brick-to-brick' ? (Number(inH) || 400) + 75 : (Number(inH) || 400);
  const frameDepth = gType === 'triple' ? 172 : (boxType === 'standard' ? 164 : 144);
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

  const setColor = (hex) => { setWc(hex); if (isSingle) { setWcE(hex); setWcI(hex); } };

  const save = () => {
    addWindow(projectId, batchId, {
      windowName: winName, windowCategory: batch?.type || 'sash',
      extWidth: extW, extHeight: extH, inputWidth: inW, inputHeight: inH, measurementType: mType,
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-200 bg-white shrink-0">
        <div>
          <button onClick={() => navigate(`/projects/${projectId}`)} className="text-xs text-ink-400 hover:text-ink-600">← Back to {project?.name || 'project'}</button>
          <h1 className="text-lg font-semibold">{batch.label} — Add Window</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Window name (W1, Kitchen Left)" value={winName} onChange={e => setWinName(e.target.value)}
            className={`px-3 py-2 border-2 rounded-lg text-sm w-56 ${winName.trim() ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50'}`} />
          <button onClick={save} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">✓ Save to Batch</button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 shrink-0 border-r border-ink-200 bg-white overflow-y-auto">
          {/* Only show window-specific options — batch defaults are inherited */}
          <div className="px-4 py-2 bg-accent-50 border-b border-accent-200 text-xs text-accent-700">
            Batch defaults applied: {def.ironmongery}, {def.colourMode === 'dual' ? 'dual' : 'single'} colour, {def.glassType} glass, {isSash ? `horns ${def.hornType}` : 'no horns'}
          </div>

          {isSash && <Sec t="Sash Type">
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <select value={splitRatio} onChange={e => setSplitRatio(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs mb-2">{SPLIT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
            <Lbl>Head</Lbl><HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
          </Sec>}

          <Sec t="Dimensions">
            <HChips o={[{ value: 'box-to-box', label: 'Frame' }, { value: 'brick-to-brick', label: 'Structural' }]} v={mType} c={setMType} />
            {mType === 'brick-to-brick' && <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 mb-2">Frame: {extW}×{extH}mm</div>}
            <div className="grid grid-cols-2 gap-3">
              <div><Lbl>Width</Lbl><input type="number" min={400} max={3000} step={10} value={inW} onChange={e => setInW(e.target.value === '' ? '' : Number(e.target.value))} onBlur={e => { const v = Number(e.target.value); setInW(isNaN(v) || v < 400 ? 400 : v > 3000 ? 3000 : v); }} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm" /></div>
              <div><Lbl>Height</Lbl><input type="number" min={400} max={3000} step={10} value={inH} onChange={e => setInH(e.target.value === '' ? '' : Number(e.target.value))} onBlur={e => { const v = Number(e.target.value); setInH(isNaN(v) || v < 400 ? 400 : v > 3000 ? 3000 : v); }} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm" /></div>
            </div>
          </Sec>

          {isSash && <Sec t="Bars">
            <Lbl>Upper</Lbl><GChips o={BAR_OPTIONS} v={uBars} c={v => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && <CBarEd bars={uCustom} onAddV={() => addBar(setUCustom, uCustom, 'v')} onAddH={() => addBar(setUCustom, uCustom, 'h')} onRemove={i => removeBar(setUCustom, uCustom, i)} />}
            <label className="flex items-center gap-2 text-xs text-ink-600 mb-2 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={e => setSameBars(e.target.checked)} className="accent-accent-500" />Same upper & lower</label>
            {!sameBars && <><Lbl>Lower</Lbl><GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />{lBars === 'custom' && <CBarEd bars={lCustom} onAddV={() => addBar(setLCustom, lCustom, 'v')} onAddH={() => addBar(setLCustom, lCustom, 'h')} onRemove={i => removeBar(setLCustom, lCustom, i)} />}</>}
          </Sec>}

          <Sec t="Opening"><HChips o={OPENINGS} v={opening} c={setOpening} /></Sec>

          <Sec t="Glass Finish">
            <HChips o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin === 'frosted' && <HChips o={FROSTED_LOCS} v={frostLoc} c={setFrostLoc} />}
          </Sec>

          {/* Override batch defaults section */}
          <Sec t="Override Batch Defaults">
            <div className="text-[10px] text-ink-400 mb-2">Change only if this window differs from batch.</div>
            <Lbl>Horns</Lbl><HChips o={HORN_OPTIONS} v={horn} c={setHorn} />
            <Lbl>Frame</Lbl>
            {gType === 'triple' ? <div className="text-xs text-blue-700 mb-2">172mm (triple)</div> : <HChips o={FRAME_TYPES} v={boxType} c={setBoxType} />}
            <Lbl>Colour</Lbl>
            <HChips o={[{ value: 'single', label: 'Single' }, { value: 'dual', label: 'Dual' }]} v={colType} c={setColType} />
            {isSingle ? <ColPick v={wc} c={setColor} /> : <><ColPick v={wcE} c={setWcE} label="Ext" /><ColPick v={wcI} c={setWcI} label="Int" /></>}
            <Lbl>Glass Type</Lbl><HChips o={GLASS_TYPES} v={gType} c={setGType} />
            <Lbl>Spec</Lbl><HChips o={GLASS_SPECS} v={gSpec} c={setGSpec} />
            <Lbl>Spacer</Lbl><HChips o={SPACERS} v={spacer} c={setSpacer} />
            <Lbl>PAS24</Lbl><HChips o={[{ value: 'no', label: 'Standard' }, { value: 'yes', label: 'PAS 24' }]} v={pas24 ? 'yes' : 'no'} c={v => setPas24(v === 'yes')} />
            <Lbl>Ironmongery</Lbl>
            <button onClick={() => alert('Database — coming soon')} className="w-full px-3 py-2 border-2 border-dashed border-ink-300 rounded-lg text-xs text-ink-500 hover:border-accent-400">🔧 Select from database →</button>
          </Sec>
        </div>

        {/* 3D */}
        <div className="flex-1 bg-gradient-to-br from-ink-100 to-ink-200 relative">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">Loading 3D…</div>}><Viewer3D /></Suspense>
        </div>

        {/* Spec panel */}
        <div className="w-64 shrink-0 border-l border-ink-200 bg-white overflow-y-auto text-xs">
          <div className="px-4 py-2 bg-ink-50 border-b border-ink-200 text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Specification</div>
          <SG t="Dimensions"><SR l="Frame" v={`${extW}×${extH}`} /><SR l="Measurement" v={mType === 'box-to-box' ? 'Frame' : 'Structural'} /></SG>
          {isSash && <SG t="Product"><SR l="Sash" v={sashType} /><SR l="Head" v={headType} /></SG>}
          <SG t="Bars"><SR l="Upper" v={uBars} />{!sameBars && <SR l="Lower" v={lBars} />}</SG>
          <SG t="Frame"><SR l="Depth" v={`${frameDepth}mm`} /><SR l="Horns" v={horn} /></SG>
          <SG t="Colour"><SR l="Mode" v={colType} /><div className="flex items-center gap-1 px-4 py-0.5"><div className="w-3 h-3 rounded border" style={{ backgroundColor: wc }} /><span className="text-ink-600">{wc}</span></div></SG>
          <SG t="Glass"><SR l="Type" v={gType} /><SR l="Spec" v={gSpec} /><SR l="Finish" v={gFin} /><SR l="Spacer" v={spacer} /></SG>
          <SG t="Opening"><SR l="Type" v={opening} /></SG>
          <SG t="Hardware"><SR l="PAS24" v={pas24?'Yes':'No'} /><SR l="Iron." v={iron} /></SG>
        </div>
      </div>
    </div>
  );
}

function Sec({ t, children }) { return <div className="px-4 py-3 border-b border-ink-200"><div className="text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">{t}</div>{children}</div>; }
function Lbl({ children }) { return <div className="text-xs text-ink-500 font-medium mb-1 mt-1.5">{children}</div>; }
function HChips({ o, v, c }) { return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => <button key={String(x.value)} onClick={() => c(x.value)} className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${v === x.value ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{x.label}</button>)}</div>; }
function GChips({ o, v, c }) { return <div className="grid grid-cols-4 gap-1 mb-2">{o.map(x => <button key={x.value} onClick={() => c(x.value)} className={`px-1.5 py-1 text-[11px] rounded border ${v === x.value ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{x.label}</button>)}</div>; }
function CBarEd({ bars, onAddV, onAddH, onRemove }) {
  return <div className="bg-ink-50 rounded-lg p-2 mb-2 text-xs">
    <div className="flex gap-2 mb-1"><button onClick={onAddV} className="px-2 py-0.5 bg-white border border-ink-300 rounded text-[10px]">+V</button><button onClick={onAddH} className="px-2 py-0.5 bg-white border border-ink-300 rounded text-[10px]">+H</button></div>
    {bars.map((b, i) => <span key={i} className="inline-flex items-center gap-0.5 bg-white border border-ink-200 rounded px-1 py-0.5 mr-1 mb-0.5 text-[10px]">{b.type}:{b.position}mm <button onClick={() => onRemove(i)} className="text-red-400">×</button></span>)}
    {bars.length === 0 && <span className="text-ink-400 text-[10px]">No custom bars</span>}
  </div>;
}
function ColPick({ v, c, label }) {
  return <div className="flex items-center gap-2 mb-1.5">
    {label && <span className="text-[10px] text-ink-400 w-6">{label}</span>}
    <div className="w-5 h-5 rounded border-2 border-ink-200" style={{ backgroundColor: v }} />
    <select value="" onChange={e => e.target.value && c(e.target.value)} className="flex-1 px-2 py-1 border border-ink-300 rounded text-[10px]">
      <option value="">RAL</option>{RAL.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</optgroup>)}
    </select>
    <label className="text-[10px] text-accent-600 cursor-pointer">⚙<input type="color" value={v} onChange={e => c(e.target.value)} className="sr-only" /></label>
  </div>;
}
function SG({ t, children }) { return <div className="border-b border-ink-100"><div className="px-4 py-1.5 bg-ink-50/50 text-[10px] font-semibold text-ink-500 uppercase">{t}</div><div className="py-0.5">{children}</div></div>; }
function SR({ l, v }) { return <div className="flex justify-between px-4 py-0.5"><span className="text-ink-400">{l}</span><span className="text-ink-800 font-medium">{v}</span></div>; }
