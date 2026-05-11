import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import '../3d/styles.css';
const Viewer3D = lazy(() => import('../3d/App.jsx'));

const BAR_OPTIONS = [
  { value: 'none', label: 'None' }, { value: '2x2', label: '2×2' }, { value: '3x3', label: '3×3' },
  { value: '4x4', label: '4×4' }, { value: '6x6', label: '6×6' }, { value: '9x9', label: '9×9' },
];
const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const SASH_TYPES = [{ value: 'double', label: 'Double Hung' }, { value: 'triple', label: 'Triple Sash' }];
const SPLIT_RATIOS = [
  { value: '1/4-1/2-1/4', label: '1/4 – 1/2 – 1/4 (Classic)' },
  { value: '1/3-1/3-1/3', label: '1/3 – 1/3 – 1/3 (Equal)' },
  { value: '1/5-3/5-1/5', label: '1/5 – 3/5 – 1/5 (Wide Centre)' },
];
const HEAD_TYPES = [{ value: 'flat', label: 'Standard (Flat)' }, { value: 'arch', label: 'Glazing Arch' }];
const FRAME_TYPES = [{ value: 'standard', label: 'Standard Frame (164mm)' }, { value: 'slim', label: 'Slim Frame (144mm)' }];
const GLASS_TYPES = [
  { value: 'double', label: 'Double Glazing (U: 1.4)' }, { value: 'triple', label: 'Triple Glazing (U: 1.2)' },
  { value: 'passive', label: 'Passive Glass (U: 0.8)' },
];
const GLASS_SPECS = [{ value: 'toughened', label: 'Toughened (Standard)' }, { value: 'laminated', label: 'Laminated (Extra Security)' }];
const GLASS_FINISHES = [{ value: 'clear', label: 'Clear' }, { value: 'frosted', label: 'Frosted' }];
const FROSTED_LOCS = [{ value: 'bottom', label: 'Bottom Sash Only' }, { value: 'both', label: 'Both Sashes' }];
const SPACERS = [{ value: 'silver', label: 'Silver' }, { value: 'black', label: 'Black' }, { value: 'gold', label: 'Gold' }, { value: 'white', label: 'White' }];
const OPENINGS = [{ value: 'both', label: 'Both Sashes Open' }, { value: 'bottom', label: 'Bottom Sash Only' }, { value: 'fixed', label: 'Fixed (Non-opening)' }];
const IRON_FINISHES = [
  { value: 'brass', label: 'Brass' }, { value: 'chrome', label: 'Chrome' }, { value: 'stainless', label: 'Stainless Steel' },
  { value: 'antique_brass', label: 'Antique Brass' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' },
];
const SWATCHES = [
  { n: 'Pure White', h: '#FAFAFA' }, { n: 'Jet Black', h: '#0A0A0A' }, { n: 'Anthracite', h: '#293133' },
  { n: 'Olive Green', h: '#424632' }, { n: 'Off-White', h: '#F7F9F5' }, { n: 'Cream', h: '#F1EFDC' },
  { n: 'Burgundy', h: '#5E2028' }, { n: 'Royal Blue', h: '#222D5A' },
];
const RAL = [
  { g: 'Whites', o: [['#FFFFFF','9010 Pure White'],['#F6F6F6','9016 Traffic White'],['#F4F4F4','9003 Signal White'],['#FDF4E3','9001 Cream White'],['#E7EBDA','9002 Grey White'],['#E6D690','1015 Light Ivory'],['#C2B078','1001 Beige']] },
  { g: 'Greys', o: [['#D7D7D7','7035 Light Grey'],['#B5B8B1','7038 Agate Grey'],['#8D948D','7042 Traffic Grey A'],['#78858B','7000 Squirrel Grey'],['#474A51','7024 Graphite Grey'],['#293133','7016 Anthracite'],['#23282B','7021 Black Grey'],['#434750','7015 Slate Grey']] },
  { g: 'Blacks', o: [['#0A0A0A','9005 Jet Black'],['#1C2023','9011 Graphite Black'],['#1E1E1E','9017 Traffic Black'],['#282828','9004 Signal Black']] },
  { g: 'Greens', o: [['#31372B','6009 Fir Green'],['#2F4538','6005 Moss Green'],['#343B29','6007 Bottle Green'],['#4A4F3B','6003 Olive Green'],['#587246','6011 Reseda Green'],['#35682D','6010 Grass Green'],['#1E5945','6016 Turquoise Green']] },
  { g: 'Blues', o: [['#1E2460','5002 Ultramarine Blue'],['#1B2A4A','5011 Steel Blue'],['#2271B3','5015 Sky Blue'],['#063971','5017 Traffic Blue'],['#3B83BD','5012 Light Blue']] },
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
  const [sashType, setSashType] = useState('double');
  const [splitRatio, setSplitRatio] = useState('1/4-1/2-1/4');
  const [headType, setHeadType] = useState('flat');
  const [mType, setMType] = useState('box-to-box');
  const [inW, setInW] = useState(1000);
  const [inH, setInH] = useState(1500);
  const extW = mType === 'brick-to-brick' ? inW + 150 : inW;
  const extH = mType === 'brick-to-brick' ? inH + 75 : inH;
  const [uBars, setUBars] = useState('none');
  const [lBars, setLBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  const [boxType, setBoxType] = useState('standard');
  const [horn, setHorn] = useState('A');
  const [colType, setColType] = useState('single');
  const [wc, setWc] = useState('#FAFAFA');
  const [wcE, setWcE] = useState('#FAFAFA');
  const [wcI, setWcI] = useState('#FAFAFA');
  const [gType, setGType] = useState('double');
  const [gSpec, setGSpec] = useState('toughened');
  const [gFin, setGFin] = useState('clear');
  const [frostLoc, setFrostLoc] = useState('bottom');
  const [spacer, setSpacer] = useState('silver');
  const [opening, setOpening] = useState('both');
  const [pas24, setPas24] = useState(false);
  const [iron, setIron] = useState('brass');

  const isSingle = colType === 'single';
  const sync = useCallback(() => {
    if (typeof window.update3D !== 'function') return;
    window.update3D({
      windowCategory: 'sash', extWidth: extW, extHeight: extH,
      upperBars: uBars, lowerBars: sameBars ? uBars : lBars, sameBars,
      showHorns: horn !== 'none', hornType: horn === 'none' ? 'A' : horn,
      woodColor: wc, woodColorExt: isSingle ? wc : wcE, woodColorInt: isSingle ? wc : wcI, sameColor: isSingle,
      ironmongery: iron,
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening, boxType,
    });
  }, [extW, extH, uBars, lBars, sameBars, horn, wc, wcE, wcI, isSingle, iron, gFin, frostLoc, spacer, sashType, splitRatio, headType, opening, boxType]);
  useEffect(() => { sync(); }, [sync]);

  const setColor = (hex) => { setWc(hex); if (isSingle) { setWcE(hex); setWcI(hex); } };

  const save = () => {
    addWindow(estimateId, {
      windowCategory: 'sash', extWidth: extW, extHeight: extH,
      upperBars: uBars, lowerBars: sameBars ? uBars : lBars, sameBars,
      showHorns: horn !== 'none', hornType: horn,
      woodColor: wc, woodColorExt: isSingle ? wc : wcE, woodColorInt: isSingle ? wc : wcI, sameColor: isSingle,
      ironmongery: iron, doubleGlazing: gType !== 'single',
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      glassType: gType, glassSpec: gSpec, glassFinish: gFin, frostedLocation: frostLoc,
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening, boxType, pas24,
    });
    navigate(`/estimates/${estimateId}`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-200 bg-white shrink-0">
        <div>
          <button onClick={() => navigate(`/estimates/${estimateId}`)} className="text-xs text-ink-400 hover:text-ink-600">← Back to estimate</button>
          <h1 className="text-lg font-semibold">Sash Window Configurator</h1>
        </div>
        <button onClick={save} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">✓ Save to Estimate</button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 shrink-0 border-r border-ink-200 bg-white overflow-y-auto">
          <P t="1. Product Range">
            <L>Window Type</L>
            <div className="flex gap-2 mb-3"><Tg active>Sash Window</Tg><Tg disabled>Casement</Tg><Tg disabled>Fix Frame</Tg><Tg disabled title="Door code not available">Door 🔒</Tg></div>
            <L>Sash Type</L><RG n="st" o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType==='triple'&&<><L>Panel Proportions</L><select value={splitRatio} onChange={e=>setSplitRatio(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs mb-3">{SPLIT_RATIOS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></>}
            <L>Head Type</L><RG n="ht" o={HEAD_TYPES} v={headType} c={setHeadType} />
          </P>
          <P t="2. Dimensions">
            <L>Measurement Method</L>
            <RG n="mt" o={[{value:'box-to-box',label:'Frame Dimensions'},{value:'brick-to-brick',label:'Structural Opening'}]} v={mType} c={setMType} />
            {mType==='brick-to-brick'&&<div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">Frame = structural + 150mm (W) / + 75mm (H)<br/>Frame: <strong>{extW} × {extH} mm</strong></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><L>Width (mm)</L><input type="number" min={400} max={3000} step={10} value={inW} onChange={e=>setInW(Number(e.target.value)||400)} onBlur={e=>setInW(Math.max(400,Math.min(3000,Number(e.target.value)||400)))} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm" /></div>
              <div><L>Height (mm)</L><input type="number" min={400} max={3000} step={10} value={inH} onChange={e=>setInH(Number(e.target.value)||400)} onBlur={e=>setInH(Math.max(400,Math.min(3000,Number(e.target.value)||400)))} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm" /></div>
            </div>
          </P>
          <P t="3. Georgian Bars">
            <L>Upper Sash Bars</L><Ch o={BAR_OPTIONS} v={uBars} c={v=>{setUBars(v);if(sameBars)setLBars(v);}} />
            <label className="flex items-center gap-2 text-xs text-ink-600 mb-3 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={e=>setSameBars(e.target.checked)} className="accent-accent-500" />Same bars upper & lower</label>
            {!sameBars&&<><L>Lower Sash Bars</L><Ch o={BAR_OPTIONS} v={lBars} c={setLBars} /></>}
          </P>
          <P t="4. Frame & Horns">
            <L>Frame Version</L><RG n="ft" o={FRAME_TYPES} v={boxType} c={setBoxType} />
            <L>Sash Horns</L><RG n="hn" o={HORN_OPTIONS} v={horn} c={setHorn} />
          </P>
          <P t="5. Colour">
            <RG n="ct" o={[{value:'single',label:'Single Colour'},{value:'dual',label:'Dual Colour (+15%)'}]} v={colType} c={setColType} />
            {isSingle?<><L>Select Colour</L><CP v={wc} c={setColor}/></>:<><L>Exterior</L><CP v={wcE} c={setWcE}/><L>Interior</L><CP v={wcI} c={setWcI}/></>}
          </P>
          <P t="6. Glass">
            <L>Glass Type</L><RG n="gt" o={GLASS_TYPES} v={gType} c={setGType} />
            <L>Specification</L><RG n="gs" o={GLASS_SPECS} v={gSpec} c={setGSpec} />
            <L>Finish</L><RG n="gf" o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin==='frosted'&&<><L>Frosted Location</L><RG n="fl" o={FROSTED_LOCS} v={frostLoc} c={setFrostLoc} /></>}
            <L>Spacer Colour</L><Ch o={SPACERS} v={spacer} c={setSpacer} />
          </P>
          <P t="7. Opening"><RG n="op" o={OPENINGS} v={opening} c={setOpening} /></P>
          <P t="8. Hardware">
            <L>PAS 24 Security</L><RG n="p24" o={[{value:'no',label:'No — Standard'},{value:'yes',label:'Yes — PAS 24'}]} v={pas24?'yes':'no'} c={v=>setPas24(v==='yes')} />
            <L>Ironmongery Finish</L><Ch o={IRON_FINISHES} v={iron} c={setIron} cols={3} />
            <div className="mt-3 p-3 bg-ink-50 rounded-lg text-xs text-ink-500 italic">Ironmongery gallery coming soon — database needed.</div>
          </P>
          <P t="Summary" hl>
            <div className="space-y-1 text-xs">
              <SR l="Type" v={`Sash — ${sashType}`}/><SR l="Frame size" v={`${extW} × ${extH} mm`}/>
              {mType==='brick-to-brick'&&<SR l="Structural" v={`${inW} × ${inH} mm`}/>}
              <SR l="Bars" v={`${uBars}${!sameBars?` / ${lBars}`:''}`}/><SR l="Frame" v={boxType==='standard'?'164mm':'144mm'}/>
              <SR l="Horns" v={horn==='none'?'None':horn}/><SR l="Colour" v={isSingle?'Single':'Dual (+15%)'}/>
              <SR l="Glass" v={`${gType} / ${gSpec} / ${gFin}`}/>{gFin==='frosted'&&<SR l="Frosted" v={frostLoc}/>}
              <SR l="Spacer" v={spacer}/><SR l="Opening" v={opening}/><SR l="PAS24" v={pas24?'Yes':'No'}/><SR l="Ironmongery" v={iron}/>
            </div>
          </P>
        </div>
        <div className="flex-1 bg-gradient-to-br from-ink-100 to-ink-200 relative">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">Loading 3D…</div>}><Viewer3D /></Suspense>
        </div>
      </div>
    </div>
  );
}

function P({t,hl,children}){return <div className={`px-5 py-4 border-b border-ink-200 ${hl?'bg-ink-50':''}`}><div className="text-xs font-semibold text-ink-800 uppercase tracking-wider mb-3">{t}</div>{children}</div>}
function L({children}){return <div className="text-xs text-ink-500 font-medium mb-1.5 mt-2">{children}</div>}
function Tg({children,active,disabled,title}){if(disabled)return<span className="px-3 py-1.5 text-xs rounded-lg border border-ink-200 text-ink-300 cursor-not-allowed" title={title}>{children}</span>;if(active)return<span className="px-3 py-1.5 text-xs rounded-lg border border-accent-500 bg-accent-50 text-accent-700 font-medium">{children}</span>;return<span className="px-3 py-1.5 text-xs rounded-lg border border-ink-200 text-ink-600">{children}</span>}
function RG({n,o,v,c}){return<div className="space-y-1.5 mb-3">{o.map(x=><label key={x.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-xs ${v===x.value?'border-accent-500 bg-accent-50 text-accent-700':'border-ink-200 text-ink-600 hover:bg-ink-50'}`}><input type="radio" name={n} value={x.value} checked={v===x.value} onChange={()=>c(x.value)} className="accent-accent-500"/>{x.label}</label>)}</div>}
function Ch({o,v,c,cols=4}){return<div className="grid gap-1.5 mb-3" style={{gridTemplateColumns:`repeat(${cols},1fr)`}}>{o.map(x=><button key={x.value} onClick={()=>c(x.value)} className={`px-2 py-1.5 text-xs rounded border ${v===x.value?'border-accent-500 bg-accent-50 text-accent-700 font-medium':'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{x.label}</button>)}</div>}
function CP({v,c}){return<div className="mb-3"><div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg border-2 border-ink-200" style={{backgroundColor:v}}/><span className="text-xs text-ink-400 font-mono">{v.toUpperCase()}</span></div><div className="grid grid-cols-5 gap-2 mb-3">{SWATCHES.map(s=><div key={s.h} onClick={()=>c(s.h)} title={s.n} className="aspect-square rounded-lg cursor-pointer hover:scale-110 transition-transform" style={{backgroundColor:s.h,border:v===s.h?'3px solid #3B82F6':'2px solid rgba(0,0,0,0.12)'}}/>)}<label className="aspect-square rounded-lg cursor-pointer flex items-center justify-center text-lg text-ink-400" style={{border:'2px dashed rgba(0,0,0,0.2)'}}>+<input type="color" value={v} onChange={e=>c(e.target.value)} className="sr-only"/></label></div><select value="" onChange={e=>e.target.value&&c(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs mb-2"><option value="">— RAL —</option>{RAL.map(g=><optgroup key={g.g} label={g.g}>{g.o.map(([hex,lab])=><option key={hex} value={hex}>{lab}</option>)}</optgroup>)}</select><select value="" onChange={e=>e.target.value&&c(e.target.value)} className="w-full px-3 py-2 border border-ink-300 rounded-lg text-xs"><option value="">— Farrow & Ball —</option>{FB.map(g=><optgroup key={g.g} label={g.g}>{g.o.map(([hex,lab])=><option key={hex} value={hex}>{lab}</option>)}</optgroup>)}</select></div>}
function SR({l,v}){return<div className="flex justify-between gap-2"><span className="text-ink-400">{l}</span><span className="text-ink-800 font-medium text-right">{v}</span></div>}