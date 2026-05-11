import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
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
  { value: '1/4-1/2-1/4', label: '1/4 – 1/2 – 1/4 (Classic)' },
  { value: '1/3-1/3-1/3', label: '1/3 – 1/3 – 1/3 (Equal)' },
  { value: '1/5-3/5-1/5', label: '1/5 – 3/5 – 1/5 (Wide Centre)' },
];
const HEAD_TYPES = [{ value: 'flat', label: 'Flat' }, { value: 'arch', label: 'Glazing Arch' }];
const FRAME_TYPES = [{ value: 'standard', label: 'Standard (164mm)' }, { value: 'slim', label: 'Slim (144mm)' }];
const GLASS_TYPES = [
  { value: 'double', label: 'Double (U: 1.4)' }, { value: 'triple', label: 'Triple (U: 1.2)' },
  { value: 'passive', label: 'Passive (U: 0.8)' },
];
const GLASS_SPECS = [{ value: 'toughened', label: 'Toughened' }, { value: 'laminated', label: 'Laminated' }];
const GLASS_FINISHES = [{ value: 'clear', label: 'Clear' }, { value: 'frosted', label: 'Frosted' }];
const FROSTED_LOCS = [{ value: 'bottom', label: 'Bottom Only' }, { value: 'both', label: 'Both Sashes' }];
const SPACERS = [{ value: 'silver', label: 'Silver' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }];
const OPENINGS = [{ value: 'both', label: 'Both Open' }, { value: 'bottom', label: 'Bottom Only' }, { value: 'fixed', label: 'Fixed' }];

const RAL = [
  { g: 'Whites & Creams', o: [['#FFFFFF','9010 Pure White'],['#F6F6F6','9016 Traffic White'],['#F4F4F4','9003 Signal White'],['#FDF4E3','9001 Cream White'],['#E7EBDA','9002 Grey White'],['#E6D690','1015 Light Ivory'],['#C2B078','1001 Beige'],['#C6A664','1002 Sand Yellow']] },
  { g: 'Greys', o: [['#D7D7D7','7035 Light Grey'],['#B5B8B1','7038 Agate Grey'],['#8D948D','7042 Traffic Grey A'],['#7D7F7D','7037 Dusty Grey'],['#78858B','7000 Squirrel Grey'],['#9EA0A1','7004 Signal Grey'],['#474A51','7024 Graphite Grey'],['#293133','7016 Anthracite'],['#23282B','7021 Black Grey'],['#434750','7015 Slate Grey']] },
  { g: 'Blacks', o: [['#0A0A0A','9005 Jet Black'],['#1C2023','9011 Graphite Black'],['#1E1E1E','9017 Traffic Black'],['#282828','9004 Signal Black']] },
  { g: 'Greens', o: [['#31372B','6009 Fir Green'],['#2F4538','6005 Moss Green'],['#343B29','6007 Bottle Green'],['#1F3A3D','6004 Blue Green'],['#4A4F3B','6003 Olive Green'],['#587246','6011 Reseda Green'],['#35682D','6010 Grass Green'],['#1E5945','6016 Turquoise Green']] },
  { g: 'Blues', o: [['#1E2460','5002 Ultramarine'],['#1B2A4A','5011 Steel Blue'],['#2271B3','5015 Sky Blue'],['#063971','5017 Traffic Blue'],['#3B83BD','5012 Light Blue']] },
  { g: 'Reds', o: [['#AF2B1E','3000 Flame Red'],['#9B111E','3003 Ruby Red'],['#75151E','3004 Purple Red'],['#5E2129','3005 Wine Red']] },
  { g: 'Browns', o: [['#955F20','8001 Ochre Brown'],['#6F4F28','8008 Olive Brown'],['#6F3B2A','8011 Nut Brown'],['#4E3B31','8028 Terra Brown'],['#45322E','8017 Chocolate Brown']] },
];
const FB = [
  { g: 'Whites', o: [['#fdfbfc','All White 2005'],['#f2f0e8','Strong White 2001'],['#ede8dc','Great White 2006'],['#f0ece0','Wimborne White 239'],['#fdfeec','Pointing 2003'],['#ede6d5','White Tie 2002'],['#ede3ce','Slipper Satin 2004']] },
  { g: 'Neutrals', o: [['#ccbfb3',"Elephant's Breath 229"],['#d0ccc4','Ammonite 274'],['#c8c4b8','Cornforth White 228'],['#c0b8a8','Purbeck Stone 275'],['#9d9088',"Mole's Breath 276"],['#8c7c68',"Mouse's Back 40"]] },
  { g: 'Greys', o: [['#b9beaa','Pigeon 25'],['#a8a8a0','Pavilion Gray 242'],['#9c9c98','Lamp Room Gray 88'],['#787470','Plummett 272'],['#3c3d42','Down Pipe 26'],['#45484b','Railings 31'],['#313639','Off-Black 57']] },
  { g: 'Greens', o: [['#5a6850','Calke Green 34'],['#485840','Viridian 214'],['#636f65','Green Smoke 47'],['#73806e','Card Room Green 79'],['#708068','Chappell Green 83']] },
  { g: 'Blues', o: [['#2c3437','Hague Blue 30'],['#2c3a48','Stiffkey Blue 281'],['#586768','Inchyra Blue 289'],['#759194','Stone Blue 86']] },
];

export default function ConfiguratorPage() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const addWindow = useProjectStore((s) => s.addWindowToEstimate);

  // Window name
  const [winName, setWinName] = useState('');

  // Product Range
  const [sashType, setSashType] = useState('double');
  const [splitRatio, setSplitRatio] = useState('1/4-1/2-1/4');
  const [headType, setHeadType] = useState('flat');

  // Dimensions
  const [mType, setMType] = useState('box-to-box');
  const [inW, setInW] = useState(1000);
  const [inH, setInH] = useState(1500);
  const extW = mType === 'brick-to-brick' ? (Number(inW) || 400) + 150 : (Number(inW) || 400);
  const extH = mType === 'brick-to-brick' ? (Number(inH) || 400) + 75 : (Number(inH) || 400);

  // Bars
  const [uBars, setUBars] = useState('none');
  const [lBars, setLBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  // Custom bars as array of { type: 'v'|'h', position: number }
  const [uCustom, setUCustom] = useState([]);
  const [lCustom, setLCustom] = useState([]);

  // Frame
  const [boxType, setBoxType] = useState('standard');

  // Horns
  const [horn, setHorn] = useState('A');

  // Colour — default RAL 9016 Traffic White
  const [colType, setColType] = useState('single');
  const [wc, setWc] = useState('#F6F6F6');
  const [wcE, setWcE] = useState('#F6F6F6');
  const [wcI, setWcI] = useState('#F6F6F6');

  // Glass
  const [gType, setGType] = useState('double');
  const [gSpec, setGSpec] = useState('toughened');
  const [gFin, setGFin] = useState('clear');
  const [frostLoc, setFrostLoc] = useState('bottom');
  const [spacer, setSpacer] = useState('silver');

  // Opening
  const [opening, setOpening] = useState('both');

  // Hardware
  const [pas24, setPas24] = useState(false);
  const [iron, setIron] = useState('brass');

  const isSingle = colType === 'single';

  // Frame depth: triple glazing requires 172mm
  const frameDepth = gType === 'triple' ? 172 : (boxType === 'standard' ? 164 : 144);

  // ─── Sync with 3D ───
  const sync = useCallback(() => {
    if (typeof window.update3D !== 'function') return;
    const effectiveLBars = sameBars ? uBars : lBars;
    window.update3D({
      windowCategory: 'sash', extWidth: extW, extHeight: extH,
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? (sameBars ? uCustom : lCustom) : [],
      showHorns: horn !== 'none', hornType: horn === 'none' ? 'A' : horn,
      woodColor: wc, woodColorExt: isSingle ? wc : wcE, woodColorInt: isSingle ? wc : wcI, sameColor: isSingle,
      ironmongery: iron,
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening,
      boxType: gType === 'triple' ? 'standard' : boxType,
      boxDepth: frameDepth,
    });
  }, [extW, extH, uBars, lBars, sameBars, uCustom, lCustom, horn, wc, wcE, wcI, isSingle, iron, gFin, frostLoc, spacer, sashType, splitRatio, headType, opening, boxType, gType, frameDepth]);
  useEffect(() => { sync(); }, [sync]);

  const setColor = (hex) => { setWc(hex); if (isSingle) { setWcE(hex); setWcI(hex); } };

  // ─── Save ───
  const save = () => {
    const effectiveLBars = sameBars ? uBars : lBars;
    addWindow(estimateId, {
      windowCategory: 'sash', extWidth: extW, extHeight: extH,
      windowName: winName || undefined,
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? (sameBars ? uCustom : lCustom) : [],
      showHorns: horn !== 'none', hornType: horn,
      woodColor: wc, woodColorExt: isSingle ? wc : wcE, woodColorInt: isSingle ? wc : wcI, sameColor: isSingle,
      ironmongery: iron, doubleGlazing: gType !== 'single',
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      glassType: gType, glassSpec: gSpec, glassFinish: gFin, frostedLocation: frostLoc,
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening,
      boxType: gType === 'triple' ? 'standard' : boxType, frameDepth, pas24,
    });
    navigate(`/estimates/${estimateId}`);
  };

  // Custom bar helpers
  const addBar = (setter, list, type) => {
    const pos = prompt(`Position in mm from ${type === 'v' ? 'left' : 'top'} edge:`);
    if (pos && !isNaN(Number(pos)) && Number(pos) > 0) {
      setter([...list, { type, position: Number(pos) }].sort((a, b) => a.position - b.position));
    }
  };
  const removeBar = (setter, list, idx) => setter(list.filter((_, i) => i !== idx));

  // ─── RENDER ───
  return (
    <div className="h-full flex flex-col">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <button onClick={() => navigate(`/estimates/${estimateId}`)} className="text-xs text-ink-400 hover:text-ink-600">← Back to estimate</button>
            <h1 className="text-lg font-semibold">Sash Window Configurator</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Window name (e.g. W1, Kitchen Left)"
            value={winName}
            onChange={e => setWinName(e.target.value)}
            className={`px-3 py-2 border-2 rounded-lg text-sm w-64 ${winName.trim() ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50'}`}
          />
          <button onClick={save} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">✓ Save to Estimate</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 shrink-0 border-r border-ink-200 bg-white overflow-y-auto">

          {/* 1. PRODUCT RANGE */}
          <Sec t="1. Product Range">
            <Lbl>Window Type</Lbl>
            <div className="flex gap-2 mb-3">
              <Pill active>Sash</Pill><Pill disabled>Casement</Pill><Pill disabled>Fix Frame</Pill><Pill disabled>Door 🔒</Pill>
            </div>
            <Lbl>Sash Type</Lbl>
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <>
              <Lbl>Proportions</Lbl>
              <select value={splitRatio} onChange={e => setSplitRatio(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs mb-3">
                {SPLIT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </>}
            <Lbl>Head Type</Lbl>
            <HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
          </Sec>

          {/* 2. DIMENSIONS */}
          <Sec t="2. Dimensions">
            <Lbl>Measurement</Lbl>
            <HChips o={[{ value: 'box-to-box', label: 'Frame' }, { value: 'brick-to-brick', label: 'Structural Opening' }]} v={mType} c={setMType} />
            {mType === 'brick-to-brick' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 mb-3">
                Frame = structural + 150 (W) / + 75 (H) → <strong>{extW} × {extH} mm</strong>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl>Width (mm)</Lbl>
                <input type="number" min={400} max={3000} step={10} value={inW}
                  onChange={e => setInW(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={e => { const v = Number(e.target.value); setInW(isNaN(v) || v < 400 ? 400 : v > 3000 ? 3000 : v); }}
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm" />
              </div>
              <div>
                <Lbl>Height (mm)</Lbl>
                <input type="number" min={400} max={3000} step={10} value={inH}
                  onChange={e => setInH(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={e => { const v = Number(e.target.value); setInH(isNaN(v) || v < 400 ? 400 : v > 3000 ? 3000 : v); }}
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm" />
              </div>
            </div>
          </Sec>

          {/* 3. BARS */}
          <Sec t="3. Georgian Bars">
            <Lbl>Upper Sash</Lbl>
            <GChips o={BAR_OPTIONS} v={uBars} c={v => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && (
              <CBarEd bars={uCustom}
                onAddV={() => addBar(setUCustom, uCustom, 'v')}
                onAddH={() => addBar(setUCustom, uCustom, 'h')}
                onRemove={i => removeBar(setUCustom, uCustom, i)} />
            )}
            <label className="flex items-center gap-2 text-xs text-ink-600 mb-3 cursor-pointer">
              <input type="checkbox" checked={sameBars} onChange={e => setSameBars(e.target.checked)} className="accent-accent-500" />
              Same bars upper & lower
            </label>
            {!sameBars && <>
              <Lbl>Lower Sash</Lbl>
              <GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />
              {lBars === 'custom' && (
                <CBarEd bars={lCustom}
                  onAddV={() => addBar(setLCustom, lCustom, 'v')}
                  onAddH={() => addBar(setLCustom, lCustom, 'h')}
                  onRemove={i => removeBar(setLCustom, lCustom, i)} />
              )}
            </>}
          </Sec>

          {/* 4. FRAME & HORNS */}
          <Sec t="4. Frame & Horns">
            <Lbl>Frame</Lbl>
            {gType === 'triple' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800 mb-3">
                Triple glazing requires 172mm frame (auto-set)
              </div>
            ) : (
              <HChips o={FRAME_TYPES} v={boxType} c={setBoxType} />
            )}
            <Lbl>Horns</Lbl>
            <HChips o={HORN_OPTIONS} v={horn} c={setHorn} />
          </Sec>

          {/* 5. COLOUR */}
          <Sec t="5. Colour">
            <HChips o={[{ value: 'single', label: 'Single' }, { value: 'dual', label: 'Dual (+15%)' }]} v={colType} c={setColType} />
            {isSingle ? (
              <ColPick label="Colour" value={wc} onChange={setColor} />
            ) : (<>
              <ColPick label="Exterior" value={wcE} onChange={setWcE} />
              <ColPick label="Interior" value={wcI} onChange={setWcI} />
            </>)}
          </Sec>

          {/* 6. GLASS */}
          <Sec t="6. Glass">
            <Lbl>Type</Lbl>
            <HChips o={GLASS_TYPES} v={gType} c={setGType} />
            <Lbl>Spec</Lbl>
            <HChips o={GLASS_SPECS} v={gSpec} c={setGSpec} />
            <Lbl>Finish</Lbl>
            <HChips o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin === 'frosted' && <><Lbl>Frosted Location</Lbl><HChips o={FROSTED_LOCS} v={frostLoc} c={setFrostLoc} /></>}
            <Lbl>Spacer</Lbl>
            <HChips o={SPACERS} v={spacer} c={setSpacer} />
          </Sec>

          {/* 7. OPENING */}
          <Sec t="7. Opening">
            <HChips o={OPENINGS} v={opening} c={setOpening} />
          </Sec>

          {/* 8. HARDWARE */}
          <Sec t="8. Hardware">
            <Lbl>PAS 24</Lbl>
            <HChips o={[{ value: 'no', label: 'No — Standard' }, { value: 'yes', label: 'Yes — PAS 24' }]} v={pas24 ? 'yes' : 'no'} c={v => setPas24(v === 'yes')} />
            <Lbl>Ironmongery</Lbl>
            <button onClick={() => alert('Ironmongery database — coming soon')}
              className="w-full px-4 py-3 border-2 border-dashed border-ink-300 rounded-lg text-xs text-ink-500 hover:border-accent-400 hover:text-accent-600 transition-colors text-center">
              🔧 Select ironmongery from database →
            </button>
            <div className="text-[10px] text-ink-400 mt-1">Current: {iron}</div>
          </Sec>

          {/* SUMMARY */}
          <Sec t="Summary" hl>
            <div className="space-y-1 text-xs">
              {winName && <SR l="Name" v={winName} />}
              <SR l="Type" v={`Sash — ${sashType}`} />
              <SR l="Size" v={`${extW} × ${extH} mm`} />
              {mType === 'brick-to-brick' && <SR l="Input" v={`${inW} × ${inH} (structural)`} />}
              <SR l="Bars" v={`${uBars}${!sameBars ? ` / ${lBars}` : ''}`} />
              <SR l="Frame" v={`${frameDepth}mm${gType === 'triple' ? ' (triple req.)' : ''}`} />
              <SR l="Horns" v={horn === 'none' ? 'None' : horn} />
              <SR l="Colour" v={isSingle ? 'Single' : 'Dual'} />
              <SR l="Glass" v={`${gType} / ${gSpec} / ${gFin}`} />
              {gFin === 'frosted' && <SR l="Frosted" v={frostLoc} />}
              <SR l="Spacer" v={spacer} />
              <SR l="Opening" v={opening} />
              <SR l="PAS24" v={pas24 ? 'Yes' : 'No'} />
              <SR l="Ironmongery" v={iron} />
            </div>
          </Sec>

        </div>

        {/* 3D VIEWER */}
        <div className="flex-1 bg-gradient-to-br from-ink-100 to-ink-200 relative">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">Loading 3D…</div>}>
            <Viewer3D />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// ─── UI COMPONENTS ───

function Sec({ t, hl, children }) {
  return <div className={`px-5 py-4 border-b border-ink-200 ${hl ? 'bg-ink-50' : ''}`}><div className="text-xs font-semibold text-ink-800 uppercase tracking-wider mb-3">{t}</div>{children}</div>;
}
function Lbl({ children }) {
  return <div className="text-xs text-ink-500 font-medium mb-1.5 mt-2">{children}</div>;
}
function Pill({ children, active, disabled }) {
  if (disabled) return <span className="px-3 py-1.5 text-xs rounded-lg border border-ink-200 text-ink-300 cursor-not-allowed">{children}</span>;
  if (active) return <span className="px-3 py-1.5 text-xs rounded-lg border border-accent-500 bg-accent-50 text-accent-700 font-medium">{children}</span>;
  return <span className="px-3 py-1.5 text-xs rounded-lg border border-ink-200 text-ink-600">{children}</span>;
}
function HChips({ o, v, c }) {
  return <div className="flex flex-wrap gap-1.5 mb-3">{o.map(x => (
    <button key={x.value} onClick={() => c(x.value)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${v === x.value ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{x.label}</button>
  ))}</div>;
}
function GChips({ o, v, c }) {
  return <div className="grid grid-cols-4 gap-1.5 mb-3">{o.map(x => (
    <button key={x.value} onClick={() => c(x.value)} className={`px-2 py-1.5 text-xs rounded border transition-colors ${v === x.value ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{x.label}</button>
  ))}</div>;
}
function CBarEd({ bars, onAddV, onAddH, onRemove }) {
  const vBars = bars.filter(b => b.type === 'v');
  const hBars = bars.filter(b => b.type === 'h');
  return (
    <div className="bg-ink-50 rounded-lg p-3 mb-3 text-xs">
      <div className="flex gap-2 mb-2">
        <button onClick={onAddV} className="px-2 py-1 bg-white border border-ink-300 rounded hover:bg-ink-100">+ Vertical</button>
        <button onClick={onAddH} className="px-2 py-1 bg-white border border-ink-300 rounded hover:bg-ink-100">+ Horizontal</button>
      </div>
      {vBars.length > 0 && <div className="mb-1"><span className="text-ink-400">V: </span>{vBars.map((b, i) => {
        const realIdx = bars.indexOf(b);
        return <span key={i} className="inline-flex items-center gap-1 bg-white border border-ink-200 rounded px-1.5 py-0.5 mr-1 mb-1">{b.position}mm <button onClick={() => onRemove(realIdx)} className="text-red-400 hover:text-red-600">×</button></span>;
      })}</div>}
      {hBars.length > 0 && <div><span className="text-ink-400">H: </span>{hBars.map((b, i) => {
        const realIdx = bars.indexOf(b);
        return <span key={i} className="inline-flex items-center gap-1 bg-white border border-ink-200 rounded px-1.5 py-0.5 mr-1 mb-1">{b.position}mm <button onClick={() => onRemove(realIdx)} className="text-red-400 hover:text-red-600">×</button></span>;
      })}</div>}
      {bars.length === 0 && <div className="text-ink-400 italic">No custom bars yet</div>}
    </div>
  );
}
function ColPick({ label, value, onChange }) {
  return (
    <div className="mb-3">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded border-2 border-ink-200 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-xs text-ink-400 font-mono">{value.toUpperCase()}</span>
        <label className="ml-auto text-xs text-accent-600 cursor-pointer hover:underline">Custom<input type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" /></label>
      </div>
      <select value="" onChange={e => e.target.value && onChange(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs mb-2">
        <option value="">— RAL Colour —</option>
        {RAL.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
      <select value="" onChange={e => e.target.value && onChange(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs">
        <option value="">— Farrow & Ball —</option>
        {FB.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
    </div>
  );
}
function SR({ l, v }) {
  return <div className="flex justify-between gap-2"><span className="text-ink-400">{l}</span><span className="text-ink-800 font-medium text-right">{v}</span></div>;
}