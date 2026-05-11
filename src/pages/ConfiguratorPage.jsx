import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import '../3d/styles.css';

// Lazy-load the 3D viewer to keep initial bundle small
const Viewer3D = lazy(() => import('../3d/App.jsx'));

const WINDOW_CATEGORIES = [
  { id: 'sash', label: 'Sash Window' },
  { id: 'casement', label: 'Casement' },
  { id: 'fix-only', label: 'Fix Frame' },
  { id: 'door', label: 'Door' },
];

const BAR_OPTIONS = ['none', '2x2', '3x3', '4x4', '6x6', '9x9'];
const HORN_TYPES = ['A', 'B', 'C'];
const IRONMONGERY_OPTIONS = ['brass', 'chrome', 'stainless', 'antique_brass', 'black', 'white'];
const SPACER_OPTIONS = ['silver', 'black', 'gold', 'white'];

const SWATCHES = [
  { name: 'Pure White', hex: '#F4F4F2' },
  { name: 'Traffic White', hex: '#F6F6F6' },
  { name: 'Jet Black', hex: '#1C1C1C' },
  { name: 'Anthracite', hex: '#2E3A3F' },
  { name: 'Olive Green', hex: '#4A4F3B' },
  { name: 'Off-White', hex: '#F0EEE8' },
  { name: 'Cream', hex: '#EDE8D8' },
  { name: 'Burgundy', hex: '#6B1A2A' },
  { name: 'Royal Blue', hex: '#1A3060' },
  { name: 'Oak', hex: '#C8853A' },
];

export default function ConfiguratorPage() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const addWindowToEstimate = useProjectStore((s) => s.addWindowToEstimate);

  // ─── Configurator state ───
  const [windowCategory, setWindowCategory] = useState('sash');
  const [extWidth, setExtWidth] = useState(1000);
  const [extHeight, setExtHeight] = useState(1500);
  const [upperBars, setUpperBars] = useState('none');
  const [lowerBars, setLowerBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  const [showHorns, setShowHorns] = useState(true);
  const [hornType, setHornType] = useState('A');
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
  const [sameColor, setSameColor] = useState(true);
  const [ironmongery, setIronmongery] = useState('brass');
  const [upperGlass, setUpperGlass] = useState('clear');
  const [lowerGlass, setLowerGlass] = useState('clear');
  const [spacerColor, setSpacerColor] = useState('silver');
  const [sashType, setSashType] = useState('double');

  // ─── Sync with 3D viewer via window.update3D ───
  const sync3D = useCallback((overrides = {}) => {
    if (typeof window.update3D === 'function') {
      window.update3D({
        windowCategory,
        extWidth,
        extHeight,
        upperBars,
        lowerBars: sameBars ? upperBars : lowerBars,
        sameBars,
        showHorns,
        hornType,
        woodColor,
        woodColorExt: sameColor ? woodColor : woodColorExt,
        woodColorInt: sameColor ? woodColor : woodColorInt,
        sameColor,
        ironmongery,
        upperGlass,
        lowerGlass,
        spacerColor,
        sashType,
        ...overrides,
      });
    }
  }, [windowCategory, extWidth, extHeight, upperBars, lowerBars, sameBars,
      showHorns, hornType, woodColor, woodColorExt, woodColorInt, sameColor,
      ironmongery, upperGlass, lowerGlass, spacerColor, sashType]);

  // Sync on every state change
  useEffect(() => {
    sync3D();
  }, [sync3D]);

  // Helper: update state + sync
  const update = (setter, value, key) => {
    setter(value);
  };

  const handleColorChange = (hex) => {
    setWoodColor(hex);
    if (sameColor) { setWoodColorExt(hex); setWoodColorInt(hex); }
  };

  // ─── Save to estimate ───
  const handleSave = () => {
    const config = {
      windowCategory,
      extWidth,
      extHeight,
      upperBars,
      lowerBars: sameBars ? upperBars : lowerBars,
      sameBars,
      showHorns,
      hornType,
      woodColor,
      woodColorExt: sameColor ? woodColor : woodColorExt,
      woodColorInt: sameColor ? woodColor : woodColorInt,
      sameColor,
      ironmongery,
      upperGlass,
      lowerGlass,
      doubleGlazing: true,
      spacerColor,
      sashType,
      glassFinish: upperGlass,
    };
    addWindowToEstimate(estimateId, config);
    navigate(`/estimates/${estimateId}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-200 bg-white">
        <div>
          <button
            onClick={() => navigate(`/estimates/${estimateId}`)}
            className="text-xs text-ink-400 hover:text-ink-600"
          >
            ← Back to estimate
          </button>
          <h1 className="text-lg font-semibold">Window Configurator</h1>
        </div>
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          ✓ Save to Estimate
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left panel: Controls ─── */}
        <div className="w-80 shrink-0 border-r border-ink-200 bg-white overflow-y-auto p-5 space-y-6">

          {/* Window type */}
          <Section title="Window Type">
            <div className="grid grid-cols-2 gap-2">
              {WINDOW_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setWindowCategory(cat.id)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                    windowCategory === cat.id
                      ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium'
                      : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Dimensions */}
          <Section title="Dimensions">
            <SliderControl label="Width" value={extWidth} min={400} max={2500} step={10} suffix=" mm" onChange={setExtWidth} />
            <SliderControl label="Height" value={extHeight} min={400} max={3000} step={10} suffix=" mm" onChange={setExtHeight} />
          </Section>

          {/* Bars */}
          {windowCategory === 'sash' && (
            <Section title="Glazing Bars">
              <label className="text-xs text-ink-500 mb-1 block">Upper bars</label>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {BAR_OPTIONS.map((b) => (
                  <button key={b} onClick={() => { setUpperBars(b); if (sameBars) setLowerBars(b); }}
                    className={`px-2 py-1.5 text-xs rounded border ${upperBars === b ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                  >{b}</button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-600 mb-2">
                <input type="checkbox" checked={sameBars} onChange={(e) => setSameBars(e.target.checked)} />
                Same bars upper &amp; lower
              </label>
              {!sameBars && (
                <>
                  <label className="text-xs text-ink-500 mb-1 block">Lower bars</label>
                  <div className="grid grid-cols-3 gap-1">
                    {BAR_OPTIONS.map((b) => (
                      <button key={b} onClick={() => setLowerBars(b)}
                        className={`px-2 py-1.5 text-xs rounded border ${lowerBars === b ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                      >{b}</button>
                    ))}
                  </div>
                </>
              )}
            </Section>
          )}

          {/* Horns */}
          {windowCategory === 'sash' && (
            <Section title="Horns">
              <label className="flex items-center gap-2 text-xs text-ink-600 mb-2">
                <input type="checkbox" checked={showHorns} onChange={(e) => setShowHorns(e.target.checked)} />
                Show horns
              </label>
              {showHorns && (
                <div className="flex gap-2">
                  {HORN_TYPES.map((h) => (
                    <button key={h} onClick={() => setHornType(h)}
                      className={`px-3 py-1.5 text-xs rounded border ${hornType === h ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                    >Type {h}</button>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Sash type */}
          {windowCategory === 'sash' && (
            <Section title="Sash Type">
              <div className="flex gap-2">
                {['double', 'single-top', 'single-bottom'].map((t) => (
                  <button key={t} onClick={() => setSashType(t)}
                    className={`px-3 py-1.5 text-xs rounded border ${sashType === t ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                  >{t}</button>
                ))}
              </div>
            </Section>
          )}

          {/* Colour */}
          <Section title="Colour">
            <div className="grid grid-cols-5 gap-2 mb-3">
              {SWATCHES.map(({ name, hex }) => (
                <div
                  key={hex}
                  onClick={() => handleColorChange(hex)}
                  title={name}
                  className="aspect-square rounded-lg cursor-pointer"
                  style={{
                    backgroundColor: hex,
                    border: woodColor === hex ? '3px solid #3B82F6' : '2px solid rgba(0,0,0,0.12)',
                  }}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-600 mb-2">
              <input type="checkbox" checked={sameColor} onChange={(e) => setSameColor(e.target.checked)} />
              Same colour inside &amp; outside
            </label>
            {!sameColor && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-500 w-16">Exterior</span>
                  <input type="color" value={woodColorExt} onChange={(e) => setWoodColorExt(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <span className="text-xs text-ink-400 font-mono">{woodColorExt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-500 w-16">Interior</span>
                  <input type="color" value={woodColorInt} onChange={(e) => setWoodColorInt(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <span className="text-xs text-ink-400 font-mono">{woodColorInt}</span>
                </div>
              </div>
            )}
          </Section>

          {/* Glass */}
          <Section title="Glass">
            <div className="flex gap-2 mb-2">
              {['clear', 'frosted', 'obscure'].map((g) => (
                <button key={g} onClick={() => { setUpperGlass(g); setLowerGlass(g); }}
                  className={`px-3 py-1.5 text-xs rounded border capitalize ${upperGlass === g ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                >{g}</button>
              ))}
            </div>
            <label className="text-xs text-ink-500 mb-1 block">Spacer colour</label>
            <div className="flex gap-2">
              {SPACER_OPTIONS.map((s) => (
                <button key={s} onClick={() => setSpacerColor(s)}
                  className={`px-3 py-1.5 text-xs rounded border capitalize ${spacerColor === s ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                >{s}</button>
              ))}
            </div>
          </Section>

          {/* Ironmongery */}
          <Section title="Ironmongery">
            <div className="grid grid-cols-3 gap-2">
              {IRONMONGERY_OPTIONS.map((i) => (
                <button key={i} onClick={() => setIronmongery(i)}
                  className={`px-2 py-1.5 text-xs rounded border capitalize ${ironmongery === i ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium' : 'border-ink-200 text-ink-600'}`}
                >{i.replace('_', ' ')}</button>
              ))}
            </div>
          </Section>

          {/* Summary */}
          <div className="bg-ink-50 rounded-lg p-4 text-xs text-ink-600 space-y-1">
            <div className="font-medium text-ink-800 mb-2">Summary</div>
            <div className="flex justify-between"><span>Type</span><span>{windowCategory}</span></div>
            <div className="flex justify-between"><span>Size</span><span>{extWidth} × {extHeight} mm</span></div>
            <div className="flex justify-between"><span>Bars</span><span>{upperBars}{!sameBars ? ` / ${lowerBars}` : ''}</span></div>
            <div className="flex justify-between"><span>Horns</span><span>{showHorns ? hornType : 'none'}</span></div>
            <div className="flex justify-between"><span>Glass</span><span>{upperGlass}</span></div>
            <div className="flex justify-between"><span>Ironmongery</span><span>{ironmongery}</span></div>
          </div>

        </div>

        {/* ─── Right: 3D Viewer ─── */}
        <div className="flex-1 bg-gradient-to-br from-ink-100 to-ink-200 relative">
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">
              Loading 3D viewer…
            </div>
          }>
            <Viewer3D />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  );
}

function SliderControl({ label, value, min, max, step, suffix, onChange }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ink-500">{label}</span>
        <span className="font-medium text-ink-800">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-ink-200 rounded-full appearance-none cursor-pointer accent-accent-500"
      />
    </div>
  );
}
