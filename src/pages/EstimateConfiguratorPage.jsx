import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEstimateStore } from '../stores/estimateStore.js';
import { useIronmongeryStore, IRONMONGERY_CATEGORIES, IRONMONGERY_FINISHES } from '../stores/ironmongeryStore.js';
import IronmongeryPickerModal from '../components/IronmongeryPickerModal.jsx';
import { GLASS_TYPES, GLASS_FINISHES, FROSTED_LOCATIONS, SPACERS, SPACER_TYPES, SWATCHES, RAL_GROUPS, FB_GROUPS } from '../config.js';
import { buildVentGrilles } from '../engine/lists.js';
import { calculatePrice } from '../engine/pricing.js';

// Reuse the SAME 3D viewer the production configurator uses (window.update3D bridge).
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
const OPENINGS = [{ value: 'both', label: 'Both Open' }, { value: 'bottom', label: 'Bottom Only' }, { value: 'fixed', label: 'Fixed' }];
const ROOM_TYPES = [{ value: 'habitable', label: 'Habitable' }, { value: 'kitchen', label: 'Kitchen' }, { value: 'bathroom', label: 'Bathroom' }, { value: 'other', label: 'No vent' }];
const SOLE_OPTIONS = [{ value: true, label: 'Only window' }, { value: false, label: 'More than one' }];
const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const COLOUR_MODES = [{ value: 'single', label: 'Single' }, { value: 'dual', label: 'Dual (Ext/Int)' }];

// Ironmongery finish options = the catalogue finishes + a Bespoke escape hatch.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const FINISH_OPTIONS = [...IRONMONGERY_FINISHES.map((f) => ({ value: f, label: cap(f) })), { value: 'bespoke', label: 'Bespoke' }];

const TRIPLE_CONSTRAINTS = { minW: 1400, maxW: 3000, minH: 1200, maxH: 2500 };
const DOUBLE_CONSTRAINTS = { minW: 400, maxW: 3000, minH: 400, maxH: 3000 };

const WHITE_HEXES = ['#F6F6F6', '#FAFAFA', '#FFFFFF', '#FFF'];
const isWhiteHex = (hex) => WHITE_HEXES.includes((hex || '').toUpperCase());

// hex → human colour name (RAL / Farrow & Ball / swatch). Built once.
const COLOR_NAME = {};
[...RAL_GROUPS, ...FB_GROUPS].forEach((g) => (g.o || []).forEach(([hex, label]) => { COLOR_NAME[(hex || '').toUpperCase()] = label; }));
SWATCHES.forEach((s) => { const k = (s.hex || '').toUpperCase(); if (!COLOR_NAME[k]) COLOR_NAME[k] = s.name; });
const hexToName = (hex) => COLOR_NAME[(hex || '').toUpperCase()] || (hex || '—');

// Map a catalogue finish to a value the 3D viewer understands (unknowns → neutral metal).
const FINISH_3D = { brass: 'brass', chrome: 'chrome', stainless: 'stainless', 'antique brass': 'antique_brass', black: 'black', white: 'white' };
const finishTo3D = (f) => FINISH_3D[f] || 'stainless';

const toCustomBars = (arr) => ({
  horizontal: (arr || []).filter((b) => b.type === 'h'),
  vertical: (arr || []).filter((b) => b.type === 'v'),
});

function migrateBars(bars) {
  if (!Array.isArray(bars)) return [];
  return bars.map((b) => ({ type: b.type, mm: b.mm ?? b.position ?? 100 }));
}

// How many of each hardware category a sash window needs (mirrors buildHardwareList).
function hardwareQty(key, opening, frameWidth, hasBars, ventQty) {
  if (key === 'trickleVents') return ventQty;
  if (opening === 'fixed') return 0; // fixed window = no sash hardware
  switch (key) {
    case 'pulleys': return opening === 'bottom' ? 2 : 4;
    case 'fingerLifts': return 2;
    case 'locks': return (frameWidth > 1200 || hasBars) ? 2 : 1;
    case 'pullHandles': return 1;
    case 'stoppers': return 1;
    default: return 0;
  }
}

export default function EstimateConfiguratorPage() {
  const { estimateId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const estimate = useEstimateStore((s) => s.estimates.find((e) => e.id === estimateId));
  const pricingSettings = useEstimateStore((s) => s.pricingSettings);
  const addItem = useEstimateStore((s) => s.addItem);
  const updateItem = useEstimateStore((s) => s.updateItem);
  const removeItem = useEstimateStore((s) => s.removeItem);
  const ironItems = useIronmongeryStore((s) => s.items);

  const editItemId = searchParams.get('edit');
  const editingItem = useMemo(
    () => (editItemId && estimate ? (estimate.items || []).find((it) => it.id === editItemId) : null),
    [editItemId, estimate]
  );
  const isEditMode = !!editingItem;

  // ─── Per-window state (all explicit — no batch defaults) ───
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
  const [ventRoomType, setVentRoomType] = useState('habitable');
  const [ventSoleWindow, setVentSoleWindow] = useState(true);
  const [glassType, setGlassType] = useState('double');
  const [glassSpec] = useState('toughened');
  const [gFin, setGFin] = useState('clear');
  const [frostLoc, setFrostLoc] = useState('bottom');
  const [colourMode, setColourMode] = useState('single');
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
  const [ironFinish, setIronFinish] = useState('brass');
  const [ironSlots, setIronSlots] = useState({}); // { categoryKey: itemId }
  const [pickerSlot, setPickerSlot] = useState(null);
  const [horn, setHorn] = useState('A');
  const [spacer, setSpacer] = useState('white');
  const [spacerType, setSpacerType] = useState('warm');
  const [pas24, setPas24] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // ─── Prefill when editing an existing item ───
  useEffect(() => {
    if (editingItem && !prefilled) {
      const c = editingItem.config || {};
      setWinName(editingItem.windowName || '');
      setSashType(c.sashType || 'double');
      setSplitRatio(c.splitRatio || '1/4-1/2-1/4');
      setHeadType(c.headType || 'flat');
      setInW(c.inputWidth || c.extWidth || 1000);
      setInH(c.inputHeight || c.extHeight || 1500);
      setUBars(c.upperBars || 'none');
      setLBars(c.lowerBars || 'none');
      setSameBars(c.sameBars ?? true);
      setUCustom(migrateBars(c.upperCustomBars));
      setLCustom(migrateBars(c.lowerCustomBars));
      setOpening(c.openingType || 'both');
      setVentRoomType(c.ventRoomType || 'habitable');
      setVentSoleWindow(c.ventSoleWindow ?? true);
      setGlassType(c.glassType || 'double');
      setGFin(c.glassFinish || 'clear');
      setFrostLoc(c.frostedLocation || 'bottom');
      setColourMode(c.colourMode || 'single');
      setWoodColor(c.woodColor || '#F6F6F6');
      setWoodColorExt(c.woodColorExt || '#F6F6F6');
      setWoodColorInt(c.woodColorInt || '#F6F6F6');
      setIronFinish(c.ironmongeryBespoke ? 'bespoke' : (c.ironmongery || 'brass'));
      setIronSlots(c.ironmongerySlots || {});
      setHorn(c.hornType || 'A');
      setSpacer(c.spacerColor || 'white');
      setSpacerType(c.spacerType || 'warm');
      setPas24(c.pas24 || false);
      setPrefilled(true);
    }
  }, [editingItem, prefilled]);

  const dimConstraints = sashType === 'triple' ? TRIPLE_CONSTRAINTS : DOUBLE_CONSTRAINTS;
  const extW = Number(inW) || 400;
  const extH = Number(inH) || 400;
  const isSingle = colourMode === 'single';
  const isBespoke = ironFinish === 'bespoke';
  const effectiveLBars = sameBars ? uBars : lBars;
  const effectiveLCustom = sameBars ? uCustom : lCustom;
  const hasBars = uBars !== 'none' || effectiveLBars !== 'none';
  const frameType = 'standard';
  const frameDepth = glassType === 'triple' ? 172 : (frameType === 'standard' ? 164 : 144);
  const ventQty = buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } });

  // Categories shown as slots (Trickle Vents only when the room actually needs vents).
  const slotCategories = useMemo(
    () => IRONMONGERY_CATEGORIES.filter((c) => c.windowType === 'sash' && (c.key !== 'trickleVents' || ventQty > 0)),
    [ventQty]
  );

  // ─── 3D sync (same bridge + config shape as the production configurator) ───
  const sync = useCallback(() => {
    if (typeof window.update3D !== 'function') return;
    window.update3D({
      windowCategory: 'sash', extWidth: extW, extHeight: extH,
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? effectiveLCustom : [],
      showHorns: horn !== 'none', hornType: horn === 'none' ? 'A' : horn,
      woodColor, woodColorExt: isSingle ? woodColor : woodColorExt, woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
      ironmongery: finishTo3D(ironFinish),
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      spacerColor: spacer, sashType, splitRatio, headType, openingType: opening,
      boxType: glassType === 'triple' ? 'standard' : frameType, boxDepth: frameDepth,
    });
  }, [extW, extH, uBars, effectiveLBars, sameBars, uCustom, effectiveLCustom, horn, woodColor, woodColorExt, woodColorInt, isSingle, ironFinish, gFin, frostLoc, spacer, sashType, splitRatio, headType, opening, glassType, frameType, frameDepth]);
  useEffect(() => { sync(); }, [sync]);
  useEffect(() => {
    const handler = () => sync();
    window.addEventListener('3d-ready', handler);
    return () => window.removeEventListener('3d-ready', handler);
  }, [sync]);

  // ─── Ironmongery price contribution (per chosen product × its window quantity) ───
  const ironmongeryForPrice = useMemo(() => {
    if (isBespoke) return []; // bespoke = no automatic price; added manually
    const arr = [];
    Object.entries(ironSlots).forEach(([key, itemId]) => {
      const prod = ironItems.find((m) => m.id === itemId);
      if (!prod) return;
      const qty = hardwareQty(key, opening, extW, hasBars, ventQty);
      if (qty > 0) arr.push({ price: prod.cost_per_unit || 0, quantity: qty });
    });
    return arr;
  }, [isBespoke, ironSlots, ironItems, opening, extW, hasBars, ventQty]);

  // ─── Pricing config (maps current state to what pricing.js expects) ───
  const pricingConfig = useMemo(() => ({
    windowType: 'sash',
    sashType,
    width: extW, height: extH,
    actualFrameWidth: extW, actualFrameHeight: extH,
    upperBars: uBars, lowerBars: effectiveLBars,
    customBars: { upper: toCustomBars(uCustom), lower: toCustomBars(effectiveLCustom) },
    glassType, glassSpec, glassFinish: gFin,
    colorType: colourMode, colorSingle: isWhiteHex(woodColor) ? 'white' : 'custom',
    openingType: opening, headType,
    frameType, sillExtension: 'none', pas24: pas24 ? 'yes' : 'no',
    ironmongery: ironmongeryForPrice,
  }), [sashType, extW, extH, uBars, effectiveLBars, uCustom, effectiveLCustom, glassType, glassSpec, gFin, colourMode, woodColor, opening, headType, frameType, pas24, ironmongeryForPrice]);

  const price = useMemo(() => calculatePrice(pricingConfig, pricingSettings), [pricingConfig, pricingSettings]);

  // ─── Full item config (compatible with production save shape) ───
  const buildSaveConfig = () => ({
    windowName: winName, windowCategory: 'sash',
    extWidth: extW, extHeight: extH, inputWidth: inW, inputHeight: inH, measurementType: 'box-to-box',
    upperBars: uBars, lowerBars: effectiveLBars, sameBars,
    upperCustomBars: uBars === 'custom' ? uCustom : [],
    lowerCustomBars: effectiveLBars === 'custom' ? effectiveLCustom : [],
    showHorns: horn !== 'none', hornType: horn,
    woodColor, woodColorExt: isSingle ? woodColor : woodColorExt, woodColorInt: isSingle ? woodColor : woodColorInt,
    colourMode, sameColor: isSingle,
    ironmongery: isBespoke ? 'bespoke' : ironFinish, ironmongerySlots: isBespoke ? {} : ironSlots, ironmongeryBespoke: isBespoke,
    doubleGlazing: glassType !== 'single',
    upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
    lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
    glassType, glassSpec, glassFinish: gFin, frostedLocation: frostLoc,
    spacerColor: spacer, spacerType, sashType, splitRatio, headType, openingType: opening,
    ventRoomType, ventSoleWindow,
    frameType: glassType === 'triple' ? 'standard' : frameType, frameDepth, pas24,
  });

  const handleSave = () => {
    if (!winName.trim()) return;
    const item = {
      windowName: winName.trim(),
      config: buildSaveConfig(),
      pricing: pricingConfig,
      price,
    };
    if (isEditMode) {
      updateItem(estimateId, editItemId, item);
    } else {
      addItem(estimateId, item);
      setWinName(''); // ready for the next window; keep the rest for variations
    }
    navigate(`/estimates/${estimateId}/configure`);
    setPrefilled(false);
  };

  // ─── Custom bar helpers ───
  const addBar = (setter, list, type) => setter([...list, { type, mm: 200 }].sort((a, b) => a.mm - b.mm));
  const updateBarMm = (setter, list, idx, val) => { const next = [...list]; next[idx] = { ...next[idx], mm: val === '' ? '' : Number(val) }; setter(next); };
  const finalizeBarMm = (setter, list, idx) => { const next = [...list]; const v = Number(next[idx].mm); next[idx] = { ...next[idx], mm: (isNaN(v) || v < 10) ? 10 : Math.round(v) }; setter(next); };
  const removeBar = (setter, list, idx) => setter(list.filter((_, i) => i !== idx));

  if (!estimate) return <div className="p-8 text-ink-400">Estimate not found.</div>;

  const items = estimate.items || [];
  const fmt = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const getSlotItem = (key) => ironItems.find((m) => m.id === ironSlots[key]) || null;
  const chosenProducts = slotCategories.map((c) => getSlotItem(c.key)).filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-surface-800">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-500 bg-surface-900 shrink-0">
        <div>
          <button onClick={() => navigate('/estimates')} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to estimates</button>
          <h1 className="text-lg font-semibold text-ink-50">{estimate.estimate_number} — {isEditMode ? `Edit ${editingItem?.windowName || 'window'}` : 'Add window'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Window name (max 7)" maxLength={7} value={winName} onChange={(e) => setWinName(e.target.value)}
            className={`px-3 py-2 border-2 rounded-lg text-sm w-56 bg-surface-800 ${winName.trim() ? 'border-accent-500 text-ink-50' : 'border-status-danger/50 text-ink-200'}`} />
          <button onClick={handleSave} className={`btn ${isEditMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'btn-primary'}`}>
            {isEditMode ? '✓ Update window' : '✓ Add to estimate'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: controls (all explicit) */}
        <div className="w-80 shrink-0 border-r border-surface-500 bg-surface-900 overflow-y-auto">
          <Sec t="Sash Type">
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <select value={splitRatio} onChange={(e) => setSplitRatio(e.target.value)} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2">{SPLIT_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
            <Lbl>Head</Lbl><HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
          </Sec>

          <Sec t="Dimensions (Frame)">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl>Width (mm)</Lbl>
                <input type="number" min={dimConstraints.minW} max={dimConstraints.maxW} step={10} value={inW}
                  onChange={(e) => setInW(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={(e) => { const v = Number(e.target.value); setInW(isNaN(v) || v < dimConstraints.minW ? dimConstraints.minW : v > dimConstraints.maxW ? dimConstraints.maxW : v); }}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                {sashType === 'triple' && <div className="text-[9px] text-ink-400 mt-0.5">Min {TRIPLE_CONSTRAINTS.minW}mm for triple</div>}
              </div>
              <div>
                <Lbl>Height (mm)</Lbl>
                <input type="number" min={dimConstraints.minH} max={dimConstraints.maxH} step={10} value={inH}
                  onChange={(e) => setInH(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={(e) => { const v = Number(e.target.value); setInH(isNaN(v) || v < dimConstraints.minH ? dimConstraints.minH : v > dimConstraints.maxH ? dimConstraints.maxH : v); }}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              </div>
            </div>
          </Sec>

          <Sec t="Georgian Bars">
            <Lbl>Upper</Lbl><GChips o={BAR_OPTIONS} v={uBars} c={(v) => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && <CBarEd bars={uCustom} maxVal={extW} onAdd={(type) => addBar(setUCustom, uCustom, type)} onChange={(i, v) => updateBarMm(setUCustom, uCustom, i, v)} onFinalize={(i) => finalizeBarMm(setUCustom, uCustom, i)} onRemove={(i) => removeBar(setUCustom, uCustom, i)} />}
            <label className="flex items-center gap-2 text-xs text-ink-400 mb-2 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={(e) => setSameBars(e.target.checked)} className="accent-accent-500" />Same upper & lower</label>
            {!sameBars && <><Lbl>Lower</Lbl><GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />{lBars === 'custom' && <CBarEd bars={lCustom} maxVal={extW} onAdd={(type) => addBar(setLCustom, lCustom, type)} onChange={(i, v) => updateBarMm(setLCustom, lCustom, i, v)} onFinalize={(i) => finalizeBarMm(setLCustom, lCustom, i)} onRemove={(i) => removeBar(setLCustom, lCustom, i)} />}</>}
          </Sec>

          <Sec t="Opening"><HChips o={OPENINGS} v={opening} c={setOpening} /></Sec>

          <Sec t="Ventilation">
            <Lbl>Room type</Lbl>
            <HChips o={ROOM_TYPES} v={ventRoomType} c={setVentRoomType} />
            {(ventRoomType === 'habitable' || ventRoomType === 'kitchen') && (
              <><Lbl>Only window in this room?</Lbl><HChips o={SOLE_OPTIONS} v={ventSoleWindow} c={setVentSoleWindow} /></>
            )}
            <div className="text-[11px] text-ink-300 mt-1.5">Trickle vents: <span className="text-accent-400 font-medium">{ventQty}</span></div>
          </Sec>

          <Sec t="Glass">
            <Lbl>Type</Lbl><HChips o={GLASS_TYPES} v={glassType} c={setGlassType} />
            <Lbl>Finish</Lbl><HChips o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin === 'frosted' && <><Lbl>Location</Lbl><HChips o={FROSTED_LOCATIONS} v={frostLoc} c={setFrostLoc} /></>}
            <Lbl>Spacer</Lbl><HChips o={SPACERS} v={spacer} c={setSpacer} />
            <Lbl>Spacer type</Lbl><HChips o={SPACER_TYPES} v={spacerType} c={setSpacerType} />
          </Sec>

          <Sec t="Colour">
            <HChips o={COLOUR_MODES} v={colourMode} c={setColourMode} />
            <ColorField label={isSingle ? 'Colour' : 'Exterior'} value={isSingle ? woodColor : woodColorExt} onChange={isSingle ? setWoodColor : setWoodColorExt} />
            {!isSingle && <ColorField label="Interior" value={woodColorInt} onChange={setWoodColorInt} />}
          </Sec>

          <Sec t="Ironmongery">
            <Lbl>Finish</Lbl>
            <HChips o={FINISH_OPTIONS} v={ironFinish} c={setIronFinish} />
            {isBespoke ? (
              <div className="mt-1 p-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 text-[11px] text-amber-300">
                Bespoke ironmongery — not priced automatically. Add the cost to the window manually; the BOM will show “Bespoke ironmongery”.
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {slotCategories.map((cat) => {
                  const item = getSlotItem(cat.key);
                  const qty = hardwareQty(cat.key, opening, extW, hasBars, ventQty);
                  return (
                    <div key={cat.key} onClick={() => setPickerSlot(cat.key)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${item ? 'border-accent-500/30 bg-accent-500/5 hover:bg-accent-500/10' : 'border-surface-500 bg-surface-700/20 hover:bg-surface-700/40 border-dashed'}`}>
                      <div className="w-11 h-11 rounded bg-surface-600 shrink-0 overflow-hidden">
                        {item?.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ink-500 text-[10px]">+</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-ink-400 uppercase tracking-wider">{cat.label}{qty > 0 ? ` ×${qty}` : ''}</div>
                        {item ? <div className="text-xs text-ink-100 font-medium truncate">{item.name}</div> : <div className="text-xs text-ink-500 italic">Click to assign…</div>}
                      </div>
                      {item && item.cost_per_unit > 0 && <div className="text-xs font-mono text-accent-400 shrink-0">{fmt(item.cost_per_unit * (qty || 1))}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </Sec>

          <Sec t="Hardware extras">
            <Lbl>Horns</Lbl><HChips o={HORN_OPTIONS} v={horn} c={setHorn} />
            <label className="flex items-center gap-2 text-xs text-ink-400 mt-1.5 cursor-pointer"><input type="checkbox" checked={pas24} onChange={(e) => setPas24(e.target.checked)} className="accent-accent-500" />PAS24 security</label>
          </Sec>
        </div>

        {/* CENTER: 3D */}
        <div className="flex-1 relative">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">Loading 3D…</div>}>
            <Viewer3D />
          </Suspense>
        </div>

        {/* RIGHT: spec + price + items list */}
        <div className="w-72 shrink-0 border-l border-surface-500 bg-surface-900 overflow-y-auto text-xs flex flex-col">
          <div className="px-4 py-2 bg-surface-700 border-b border-surface-500 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Specification</div>
          <SG t="Dimensions"><SR l="Frame" v={`${extW} × ${extH} mm`} /><SR l="Depth" v={`${frameDepth}mm`} /></SG>
          <SG t="Product"><SR l="Sash" v={sashType} /><SR l="Head" v={headType} />{sashType === 'triple' && <SR l="Split" v={splitRatio} />}</SG>
          <SG t="Bars"><SR l="Upper" v={uBars} /><SR l="Lower" v={sameBars ? uBars : lBars} /></SG>
          <SG t="Ventilation"><SR l="Room" v={(ROOM_TYPES.find((r) => r.value === ventRoomType) || {}).label} /><SR l="Trickle vents" v={ventQty} /></SG>
          <SG t="Glass">
            <SR l="Type" v={glassType} /><SR l="Finish" v={gFin} />
            {gFin === 'frosted' && <SR l="Frosted" v={frostLoc} />}
            <SR l="Spacer" v={spacer} /><SR l="Spacer type" v={(SPACER_TYPES.find((t) => t.value === spacerType) || {}).label} />
          </SG>
          <SG t="Colour">
            <SR l="Mode" v={colourMode} />
            <SR l={isSingle ? 'Colour' : 'Exterior'} v={hexToName(isSingle ? woodColor : woodColorExt)} />
            {!isSingle && <SR l="Interior" v={hexToName(woodColorInt)} />}
          </SG>
          <SG t="Opening"><SR l="Type" v={opening} /></SG>
          <SG t="Frame"><SR l="Type" v={frameType} /><SR l="Depth" v={`${frameDepth}mm`} /></SG>
          <SG t="Hardware">
            <SR l="Finish" v={isBespoke ? 'Bespoke' : cap(ironFinish)} />
            <SR l="Horns" v={horn} />
            <SR l="PAS24" v={pas24 ? 'Yes' : 'No'} />
            {isBespoke ? (
              <div className="px-4 py-0.5 text-[10px] text-amber-400">Bespoke ironmongery</div>
            ) : (
              chosenProducts.map((p) => <div key={p.id} className="px-4 py-0.5 text-[10px] text-ink-300 truncate">• {p.name}</div>)
            )}
          </SG>

          {/* PRICE BREAKDOWN */}
          <div className="px-4 py-2 bg-surface-700 border-y border-surface-500 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Price</div>
          <div className="px-4 py-3 space-y-1.5">
            {price.noDimensions ? (
              <div className="text-ink-400 text-[11px]">Enter dimensions to see price.</div>
            ) : (
              <>
                <PR l={`Base (${price.breakdown.sqm} m²)`} v={fmt(price.breakdown.basePrice)} />
                {Number(price.breakdown.barsPrice) > 0 && <PR l="Bars" v={fmt(price.breakdown.barsPrice)} />}
                {Number(price.breakdown.fixBarsPrice) > 0 && <PR l="Fix bars" v={fmt(price.breakdown.fixBarsPrice)} />}
                {Number(price.breakdown.additionalOptions) !== 0 && <PR l="Options / glass / iron" v={fmt(price.breakdown.additionalOptions)} />}
                {isBespoke && <div className="text-[10px] text-amber-400">+ bespoke ironmongery (added manually)</div>}
                <div className="flex justify-between pt-1.5 border-t border-surface-500">
                  <span className="text-ink-300">This window (ex VAT)</span>
                  <span className="text-ink-50 font-medium">{fmt(price.unitPrice)}</span>
                </div>
                <div className="text-[10px] text-ink-400 text-right">{fmt(price.breakdown.totalWithVat)} inc. VAT</div>
              </>
            )}
          </div>

          {/* ITEMS in this estimate */}
          <div className="px-4 py-2 bg-surface-700 border-y border-surface-500 text-[10px] font-semibold text-ink-400 uppercase tracking-wider flex justify-between">
            <span>Windows in estimate</span><span>{items.length}</span>
          </div>
          <div className="flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-4 text-ink-400 text-[11px]">No windows added yet. Configure one on the left, then “Add to estimate”.</div>
            ) : (
              items.map((it) => (
                <div key={it.id} className={`px-4 py-2 border-b border-surface-500/60 flex items-center justify-between ${it.id === editItemId ? 'bg-accent-500/10' : ''}`}>
                  <div className="min-w-0">
                    <div className="text-ink-100 font-medium truncate">{it.windowName}</div>
                    <div className="text-[10px] text-ink-400">{fmt(it.price?.totalPrice)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setPrefilled(false); navigate(`/estimates/${estimateId}/configure?edit=${it.id}`); }} className="text-ink-300 hover:text-accent-400">Edit</button>
                    <button onClick={() => removeItem(estimateId, it.id)} className="text-ink-300 hover:text-red-400 text-sm leading-none">×</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ESTIMATE TOTAL */}
          <div className="px-4 py-3 border-t border-surface-500 bg-surface-800">
            <div className="flex justify-between text-ink-300"><span>Estimate total (ex VAT)</span><span className="text-ink-50 font-semibold text-sm">{fmt(estimate.totals?.ex_vat)}</span></div>
            <div className="flex justify-between text-[10px] text-ink-400 mt-0.5"><span>inc. VAT</span><span>{fmt(estimate.totals?.inc_vat)}</span></div>
          </div>
        </div>
      </div>

      {pickerSlot && (
        <IronmongeryPickerModal
          categoryKey={pickerSlot}
          currentItemId={ironSlots[pickerSlot] || null}
          finishFilter={ironFinish}
          onSelect={(itemId) => setIronSlots({ ...ironSlots, [pickerSlot]: itemId })}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}

// ─── UI Components ───
function Sec({ t, children }) { return <div className="px-4 py-3 border-b border-surface-500"><div className="text-xs font-semibold text-ink-100 uppercase tracking-wider mb-2">{t}</div>{children}</div>; }
function Lbl({ children }) { return <div className="text-xs text-ink-400 font-medium mb-1 mt-1.5">{children}</div>; }
function HChips({ o, v, c }) { return <div className="flex flex-wrap gap-1.5 mb-2">{o.map((x) => <button key={String(x.value)} onClick={() => c(x.value)} className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }
function GChips({ o, v, c }) { return <div className="grid grid-cols-4 gap-1 mb-2">{o.map((x) => <button key={x.value} onClick={() => c(x.value)} className={`px-1.5 py-1 text-[11px] rounded border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }

function ColorField({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded border border-surface-400 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-xs text-ink-100 font-medium truncate">{hexToName(value)}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {SWATCHES.map((s) => (
          <div key={s.hex} onClick={() => onChange(s.hex)} title={s.name}
            className={`aspect-square rounded cursor-pointer border ${value === s.hex ? 'border-accent-500 border-2' : 'border-surface-500'}`}
            style={{ backgroundColor: s.hex }} />
        ))}
        <label className="aspect-square rounded border border-dashed border-surface-400 flex items-center justify-center cursor-pointer text-ink-400 hover:text-ink-200 text-sm relative" title="Custom colour">
          +
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute opacity-0 w-0 h-0" />
        </label>
      </div>
      <select value="" onChange={(e) => e.target.value && onChange(e.target.value)} className="w-full mt-1 px-2 py-1 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-200">
        <option value="">— RAL —</option>
        {RAL_GROUPS.map((g) => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
      <select value="" onChange={(e) => e.target.value && onChange(e.target.value)} className="w-full mt-1 px-2 py-1 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-200">
        <option value="">— Farrow & Ball —</option>
        {FB_GROUPS.map((g) => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
      </select>
    </div>
  );
}

function CBarEd({ bars, maxVal, onAdd, onChange, onFinalize, onRemove }) {
  return (
    <div className="bg-surface-600 rounded-lg p-2 mb-2 text-xs border border-surface-500">
      <div className="flex gap-2 mb-2">
        <button onClick={() => onAdd('v')} className="px-2 py-1 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-200 hover:bg-surface-500">+ Vertical</button>
        <button onClick={() => onAdd('h')} className="px-2 py-1 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-200 hover:bg-surface-500">+ Horizontal</button>
      </div>
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] font-bold w-4 ${b.type === 'v' ? 'text-teal-400' : 'text-purple-400'}`}>{b.type.toUpperCase()}</span>
          <input type="range" min={10} max={maxVal || 1500} step={1} value={b.mm === '' ? 10 : b.mm}
            onChange={(e) => onChange(i, e.target.value)} className="flex-1 accent-accent-500 h-1.5" />
          <input type="number" min={10} max={maxVal || 1500} value={b.mm}
            onChange={(e) => onChange(i, e.target.value)} onBlur={() => onFinalize(i)}
            className="w-16 px-1.5 py-0.5 bg-surface-700 border border-surface-500 rounded text-[10px] text-ink-100 text-center" />
          <span className="text-[9px] text-ink-400">mm</span>
          <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-300 text-sm leading-none">×</button>
        </div>
      ))}
      {bars.length === 0 && <span className="text-ink-400 text-[10px]">No custom bars — add vertical or horizontal</span>}
    </div>
  );
}

function SG({ t, children }) { return <div className="border-b border-surface-500"><div className="px-4 py-1.5 bg-surface-700 text-[10px] font-semibold text-ink-400 uppercase">{t}</div><div className="py-0.5">{children}</div></div>; }
function SR({ l, v }) { return <div className="flex justify-between px-4 py-0.5"><span className="text-ink-400">{l}</span><span className="text-ink-100 font-medium">{v}</span></div>; }
function PR({ l, v }) { return <div className="flex justify-between"><span className="text-ink-400">{l}</span><span className="text-ink-200">{v}</span></div>; }
