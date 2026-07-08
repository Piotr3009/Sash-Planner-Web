import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { GLASS_TYPES, GLASS_SPECS, GLASS_FINISHES, FROSTED_LOCATIONS, SPACERS, SPACER_TYPES, SWATCHES, RAL_GROUPS, FB_GROUPS } from '../config.js';
import { CONSTANTS } from '../engine/calculations.js';
import { buildVentGrilles } from '../engine/lists.js';

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
const IRON_OPTIONS = [{ value: 'brass', label: 'Brass' }, { value: 'chrome', label: 'Chrome' }, { value: 'stainless', label: 'Stainless' }, { value: 'antique_brass', label: 'Antique Brass' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }];
const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const COLOUR_MODES = [{ value: 'single', label: 'Single' }, { value: 'dual', label: 'Dual (Ext/Int)' }];
const FRAME_OPTIONS = [{ value: 'standard', label: `Standard (${CONSTANTS.FRAME_DEPTH_STANDARD}mm)` }, { value: 'slim', label: `Slim (${CONSTANTS.FRAME_DEPTH_SLIM}mm)` }];

// Hex → colour name lookup (RAL / F&B / swatches), matching EstimateConfiguratorPage
const COLOR_NAME = {};
[...RAL_GROUPS, ...FB_GROUPS].forEach((g) => (g.o || []).forEach(([hex, label]) => { COLOR_NAME[(hex || '').toUpperCase()] = label; }));
SWATCHES.forEach((s) => { const k = (s.hex || '').toUpperCase(); if (!COLOR_NAME[k]) COLOR_NAME[k] = s.name; });
const hexToName = (hex) => COLOR_NAME[(hex || '').toUpperCase()] || (hex || '—');

// ─── Triple sash dimension constraints (matching PSW) ───
const TRIPLE_CONSTRAINTS = { minW: 1400, maxW: 3000, defaultW: 2000, minH: 1200, maxH: 2500 };
const DOUBLE_CONSTRAINTS = { minW: 400, maxW: 3000, minH: 400, maxH: 3000 };

// Migrate old custom bar format (position → mm)
function migrateBars(bars) {
  if (!Array.isArray(bars)) return [];
  return bars.map(b => ({ type: b.type, mm: b.mm ?? b.position ?? 100 }));
}

export default function ConfiguratorPage() {
  const { projectId, batchId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addWindow = useProjectStore((s) => s.addWindowToBatch);
  const updateWindow = useProjectStore((s) => s.updateWindowInBatch);

  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const batch = project?.batches?.find(b => b.id === batchId);
  const def = batch?.defaults || {};

  // ─── Edit mode ───
  const editWindowId = searchParams.get('edit');
  const editingWindow = useMemo(() => {
    if (!editWindowId || !batch) return null;
    return batch.windows?.find((w) => w.id === editWindowId) || null;
  }, [editWindowId, batch]);
  const isEditMode = !!editingWindow;

  // ─── Per-window state ───
  const [winName, setWinName] = useState('');
  const [sashType, setSashType] = useState('double');
  const [splitRatio, setSplitRatio] = useState('1/4-1/2-1/4');
  const [headType, setHeadType] = useState('flat');
  const [inW, setInW] = useState(1000);
  const [inH, setInH] = useState(1500);
  const preTripleWRef = useRef(null); // remembers width before triple switch
  const [uBars, setUBars] = useState('none');
  const [lBars, setLBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  const [uCustom, setUCustom] = useState([]);
  const [lCustom, setLCustom] = useState([]);
  const [opening, setOpening] = useState('both');
  const [ventRoomType, setVentRoomType] = useState('habitable');
  const [ventSoleWindow, setVentSoleWindow] = useState(true);
  const [gFin, setGFin] = useState('clear');
  const [frostLoc, setFrostLoc] = useState('bottom');
  const [prefilled, setPrefilled] = useState(false);
  const [prefillSource, setPrefillSource] = useState(null); // name of the window we copied from

  // ─── Full per-window specification (no batch overrides — window is the source of truth) ───
  const [iron, setIron] = useState('brass');
  const [horn, setHorn] = useState('A');
  const [frameType, setFrameType] = useState('standard');
  const [colourMode, setColourMode] = useState('single');
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
  const [glassType, setGlassType] = useState('double');
  const [glassSpec, setGlassSpec] = useState('toughened');
  const [spacerColor, setSpacerColor] = useState('white');
  const [spacerType, setSpacerType] = useState('warm');
  const [pas24, setPas24] = useState(false);

  // Applies a saved window's values to the form (edit mode + copy-from-last prefill)
  const applyWindow = useCallback((w, { copyName }) => {
    setWinName(copyName ? (w.name || '') : '');
    setSashType(w.sashType || 'double');
    setSplitRatio(w.splitRatio || '1/4-1/2-1/4');
    setHeadType(w.headType || 'flat');
    setInW(w.width || 1000);
    setInH(w.height || 1500);
    setUBars(w.upperBars || 'none');
    setLBars(w.lowerBars || 'none');
    setSameBars(w.sameBars !== undefined ? w.sameBars : true);
    setUCustom(migrateBars(w.upperCustomBars));
    setLCustom(migrateBars(w.lowerCustomBars));
    setOpening(w.openingType || 'both');
    setVentRoomType(w.ventRoomType || 'habitable');
    setVentSoleWindow(w.ventSoleWindow !== undefined ? w.ventSoleWindow : true);
    setGFin(w.glassFinish || 'clear');
    setFrostLoc(w.frostedLocation || 'bottom');
    // Specification (windows store effective values, incl. legacy override-era windows)
    setIron(w.ironmongery || def.ironmongery || 'brass');
    setHorn(w.hornType || def.hornType || 'A');
    setFrameType(w.frameType || def.frameType || 'standard');
    setColourMode(w.colourMode || def.colourMode || 'single');
    setWoodColor(w.woodColor || def.woodColor || '#F6F6F6');
    setWoodColorExt(w.woodColorExt || w.woodColor || def.woodColorExt || '#F6F6F6');
    setWoodColorInt(w.woodColorInt || w.woodColor || def.woodColorInt || '#F6F6F6');
    setGlassType(w.glassType || def.glassType || 'double');
    setGlassSpec(w.glassSpec || def.glassSpec || 'toughened');
    setSpacerColor(w.spacerColor || def.spacerColor || 'white');
    setSpacerType(w.spacerType || def.spacerType || 'warm');
    setPas24(w.pas24 !== undefined ? !!w.pas24 : (def.pas24 || false));
  }, [def]);

  // Prefill form when editing an existing window
  useEffect(() => {
    if (editingWindow && !prefilled) {
      applyWindow(editingWindow, { copyName: true });
      setPrefilled(true);
    }
  }, [editingWindow, prefilled, applyWindow]);

  // Prefill a NEW window from the last window in the batch (fast entry for series);
  // empty batch falls back to batch defaults / type defaults.
  useEffect(() => {
    if (!editWindowId && batch && !prefilled) {
      const last = batch.windows?.length ? batch.windows[batch.windows.length - 1] : null;
      if (last) {
        applyWindow(last, { copyName: false });
        setPrefillSource(last.name || 'previous window');
      } else {
        setIron(def.ironmongery || 'brass');
        setHorn(def.hornType || 'A');
        setFrameType(def.frameType || 'standard');
        setColourMode(def.colourMode || 'single');
        setWoodColor(def.woodColor || '#F6F6F6');
        setWoodColorExt(def.woodColorExt || '#F6F6F6');
        setWoodColorInt(def.woodColorInt || '#F6F6F6');
        setGlassType(def.glassType || 'double');
        setGlassSpec(def.glassSpec || 'toughened');
        setSpacerColor(def.spacerColor || 'white');
        setSpacerType(def.spacerType || 'warm');
        setPas24(def.pas24 || false);
      }
      setPrefilled(true);
    }
  }, [editWindowId, batch, prefilled, applyWindow, def]);

  // ─── B1: Triple sash dimension clamp + restore on double ───
  useEffect(() => {
    if (sashType === 'triple') {
      // Save current width before clamping
      preTripleWRef.current = inW;
      setInW(prev => {
        const v = Number(prev);
        if (isNaN(v) || v < TRIPLE_CONSTRAINTS.minW) return TRIPLE_CONSTRAINTS.defaultW;
        return v;
      });
      setInH(prev => {
        const v = Number(prev);
        if (isNaN(v) || v < TRIPLE_CONSTRAINTS.minH) return Math.max(v, TRIPLE_CONSTRAINTS.minH);
        return v;
      });
    } else {
      // Restore pre-triple width if we had one
      if (preTripleWRef.current !== null) {
        setInW(preTripleWRef.current);
        preTripleWRef.current = null;
      }
    }
  }, [sashType]);

  const dimConstraints = sashType === 'triple' ? TRIPLE_CONSTRAINTS : DOUBLE_CONSTRAINTS;

  // ─── Effective values ───
  const isSingle = colourMode === 'single';
  const isTripleGlass = glassType === 'triple';
  // Triple glazing needs the deeper box — slim is not available, standard is forced.
  const effFrameType = isTripleGlass ? 'standard' : frameType;
  const frameDepth = isTripleGlass
    ? CONSTANTS.FRAME_DEPTH_TRIPLE
    : (effFrameType === 'slim' ? CONSTANTS.FRAME_DEPTH_SLIM : CONSTANTS.FRAME_DEPTH_STANDARD);

  const extW = Number(inW) || 400;
  const extH = Number(inH) || 400;
  const effectiveLBars = sameBars ? uBars : lBars;

  // ─── 3D sync ───
  const sync = useCallback(() => {
    if (typeof window.update3D !== 'function') return;
    window.update3D({
      windowCategory: batch?.type || 'sash', extWidth: extW, extHeight: extH,
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? (sameBars ? uCustom : lCustom) : [],
      showHorns: horn !== 'none', hornType: horn === 'none' ? 'A' : horn,
      woodColor, woodColorExt: isSingle ? woodColor : woodColorExt, woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
      ironmongery: iron,
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      spacerColor, sashType, splitRatio, headType, openingType: opening,
      boxType: effFrameType, boxDepth: frameDepth,
    });
  }, [extW, extH, uBars, effectiveLBars, sameBars, uCustom, lCustom, horn, woodColor, woodColorExt, woodColorInt, isSingle, iron, gFin, frostLoc, spacerColor, sashType, splitRatio, headType, opening, effFrameType, frameDepth, batch?.type]);
  useEffect(() => { sync(); }, [sync]);

  // ─── B4: Listen for 3D ready event and re-sync ───
  useEffect(() => {
    const handler = () => sync();
    window.addEventListener('3d-ready', handler);
    return () => window.removeEventListener('3d-ready', handler);
  }, [sync]);

  // ─── Save ───
  const save = () => {
    const config = {
      windowName: winName, windowCategory: batch?.type || 'sash',
      extWidth: extW, extHeight: extH, inputWidth: inW, inputHeight: inH, measurementType: 'box-to-box',
      upperBars: uBars, lowerBars: effectiveLBars, sameBars,
      upperCustomBars: uBars === 'custom' ? uCustom : [],
      lowerCustomBars: effectiveLBars === 'custom' ? (sameBars ? uCustom : lCustom) : [],
      showHorns: horn !== 'none', hornType: horn,
      woodColor, woodColorExt: isSingle ? woodColor : woodColorExt, woodColorInt: isSingle ? woodColor : woodColorInt,
      colourMode, sameColor: isSingle, ironmongery: iron, doubleGlazing: glassType !== 'single',
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      glassType, glassSpec, glassFinish: gFin, frostedLocation: frostLoc,
      spacerColor, spacerType, sashType, splitRatio, headType, openingType: opening,
      ventRoomType, ventSoleWindow,
      frameType: effFrameType, frameDepth, pas24,
    };

    if (isEditMode) {
      updateWindow(projectId, batchId, editWindowId, config);
      navigate(`/projects/${projectId}/batches/${batchId}/windows/${editWindowId}`);
    } else {
      addWindow(projectId, batchId, config);
      navigate(`/projects/${projectId}`);
    }
  };

  // ─── B2+B3: Custom bar helpers (stores { type, mm }) ───
  const addBar = (setter, list, type) => {
    setter([...list, { type, mm: 200 }].sort((a, b) => a.mm - b.mm));
  };
  const updateBarMm = (setter, list, idx, val) => {
    const next = [...list];
    // Allow empty string during typing — store raw value
    next[idx] = { ...next[idx], mm: val === '' ? '' : Number(val) };
    setter(next); // NO sort during editing
  };
  const finalizeBarMm = (setter, list, idx) => {
    const next = [...list];
    const v = Number(next[idx].mm);
    next[idx] = { ...next[idx], mm: (isNaN(v) || v < 10) ? 10 : Math.round(v) };
    setter(next);
  };
  const removeBar = (setter, list, idx) => setter(list.filter((_, i) => i !== idx));

  if (!batch) return <div className="p-8 text-ink-400">Batch not found.</div>;
  const isSash = batch.type === 'sash';

  // Format custom bars for spec panel
  const formatBars = (bars) => bars.map(b => `${b.type.toUpperCase()}:${b.mm}`).join(', ');

  return (
    <div className="h-full flex flex-col bg-surface-800">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-500 bg-surface-900 shrink-0">
        <div>
          <button onClick={() => navigate(isEditMode ? `/projects/${projectId}/batches/${batchId}/windows/${editWindowId}` : `/projects/${projectId}`)} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to {isEditMode ? (editingWindow?.name || 'window') : (project?.name || 'project')}</button>
          <h1 className="text-lg font-semibold text-ink-50">{batch.label} — {isEditMode ? `Edit ${editingWindow?.name || 'Window'}` : 'Add Window'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Window name (max 7)" maxLength={7} value={winName} onChange={e => setWinName(e.target.value)}
            className={`px-3 py-2 border-2 rounded-lg text-sm w-56 bg-surface-800 ${winName.trim() ? 'border-accent-500 text-ink-50' : 'border-status-danger/50 text-ink-200'}`} />
          <button onClick={save} className={`btn ${isEditMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'btn-primary'}`}>
            {isEditMode ? '✓ Update Window' : '✓ Save to Batch'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Per-window controls */}
        <div className="w-80 shrink-0 border-r border-surface-500 bg-surface-900 overflow-y-auto">
          {/* Prefill info */}
          {!isEditMode && prefillSource && (
            <div className="px-4 py-2 bg-accent-500/10 border-b border-accent-500/20 text-[10px] text-accent-400">
              Prefilled from last window: <strong>{prefillSource}</strong> — adjust anything below
            </div>
          )}

          {isSash && <Sec t="Sash Type">
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <select value={splitRatio} onChange={e => setSplitRatio(e.target.value)} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2">{SPLIT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
            <Lbl>Head</Lbl><HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
          </Sec>}

          <Sec t="Dimensions (Frame)">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Lbl>Width (mm)</Lbl>
                <input type="number" min={dimConstraints.minW} max={dimConstraints.maxW} step={10} value={inW}
                  onChange={e => setInW(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={e => { const v = Number(e.target.value); setInW(isNaN(v) || v < dimConstraints.minW ? dimConstraints.minW : v > dimConstraints.maxW ? dimConstraints.maxW : v); }}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                {sashType === 'triple' && <div className="text-[9px] text-ink-400 mt-0.5">Min {TRIPLE_CONSTRAINTS.minW}mm for triple</div>}
              </div>
              <div>
                <Lbl>Height (mm)</Lbl>
                <input type="number" min={dimConstraints.minH} max={dimConstraints.maxH} step={10} value={inH}
                  onChange={e => setInH(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={e => { const v = Number(e.target.value); setInH(isNaN(v) || v < dimConstraints.minH ? dimConstraints.minH : v > dimConstraints.maxH ? dimConstraints.maxH : v); }}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              </div>
            </div>
          </Sec>

          {isSash && <Sec t="Georgian Bars">
            <Lbl>Upper</Lbl><GChips o={BAR_OPTIONS} v={uBars} c={v => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && <CBarEd bars={uCustom} maxVal={extW} onAdd={type => addBar(setUCustom, uCustom, type)} onChange={(i, v) => updateBarMm(setUCustom, uCustom, i, v)} onFinalize={i => finalizeBarMm(setUCustom, uCustom, i)} onRemove={i => removeBar(setUCustom, uCustom, i)} />}
            <label className="flex items-center gap-2 text-xs text-ink-400 mb-2 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={e => setSameBars(e.target.checked)} className="accent-accent-500" />Same upper & lower</label>
            {!sameBars && <><Lbl>Lower</Lbl><GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />{lBars === 'custom' && <CBarEd bars={lCustom} maxVal={extW} onAdd={type => addBar(setLCustom, lCustom, type)} onChange={(i, v) => updateBarMm(setLCustom, lCustom, i, v)} onFinalize={i => finalizeBarMm(setLCustom, lCustom, i)} onRemove={i => removeBar(setLCustom, lCustom, i)} />}</>}
          </Sec>}

          <Sec t="Opening"><HChips o={OPENINGS} v={opening} c={setOpening} /></Sec>

          <Sec t="Ventilation">
            <Lbl>Room type</Lbl>
            <HChips o={ROOM_TYPES} v={ventRoomType} c={setVentRoomType} />
            {(ventRoomType === 'habitable' || ventRoomType === 'kitchen') && (
              <><Lbl>Only window in this room?</Lbl><HChips o={SOLE_OPTIONS} v={ventSoleWindow} c={setVentSoleWindow} /></>
            )}
            <div className="text-[11px] text-ink-300 mt-1.5">Trickle vents: <span className="text-accent-400 font-medium">{buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } })}</span></div>
          </Sec>

          <Sec t="Glass">
            <Lbl>Type</Lbl><HChips o={GLASS_TYPES} v={glassType} c={setGlassType} />
            <Lbl>Spec</Lbl><HChips o={GLASS_SPECS} v={glassSpec} c={setGlassSpec} />
            <Lbl>Finish</Lbl><HChips o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin === 'frosted' && <><Lbl>Location</Lbl><HChips o={FROSTED_LOCATIONS} v={frostLoc} c={setFrostLoc} /></>}
            <Lbl>Spacer</Lbl><HChips o={SPACERS} v={spacerColor} c={setSpacerColor} />
            <Lbl>Spacer type</Lbl><HChips o={SPACER_TYPES} v={spacerType} c={setSpacerType} />
          </Sec>

          <Sec t="Frame & Horns">
            <Lbl>Frame</Lbl>
            {isTripleGlass ? (
              <div className="px-3 py-2 mb-2 rounded-lg border border-amber-500/40 bg-amber-500/5 text-[11px] text-amber-300">
                Triple glazing forces the standard box — {CONSTANTS.FRAME_DEPTH_TRIPLE}mm deep. Slim frame is not available.
              </div>
            ) : (
              <HChips o={FRAME_OPTIONS} v={frameType} c={setFrameType} />
            )}
            <div className="text-[11px] text-ink-300 mb-1">Box depth: <span className="text-accent-400 font-medium">{frameDepth}mm</span></div>
            {isSash && <><Lbl>Horns</Lbl><HChips o={HORN_OPTIONS} v={horn} c={setHorn} /></>}
            <label className="flex items-center gap-2 text-xs text-ink-400 mt-1.5 cursor-pointer"><input type="checkbox" checked={pas24} onChange={e => setPas24(e.target.checked)} className="accent-accent-500" />PAS24 security</label>
          </Sec>

          <Sec t="Colour">
            <HChips o={COLOUR_MODES} v={colourMode} c={setColourMode} />
            <ColorField label={isSingle ? 'Colour' : 'Exterior'} value={isSingle ? woodColor : woodColorExt} onChange={isSingle ? setWoodColor : setWoodColorExt} />
            {!isSingle && <ColorField label="Interior" value={woodColorInt} onChange={setWoodColorInt} />}
          </Sec>

          <Sec t="Ironmongery">
            <HChips o={IRON_OPTIONS} v={iron} c={setIron} />
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
          <SG t="Bars">
            <SR l="Upper" v={uBars} />
            {uBars === 'custom' && uCustom.length > 0 && <div className="px-4 py-0.5 text-[10px] text-accent-400">{formatBars(uCustom)}</div>}
            {!sameBars && <SR l="Lower" v={lBars} />}
            {!sameBars && lBars === 'custom' && lCustom.length > 0 && <div className="px-4 py-0.5 text-[10px] text-accent-400">{formatBars(lCustom)}</div>}
          </SG>
          <SG t="Frame & Horns">
            <SR l="Frame" v={`${effFrameType} · ${frameDepth}mm`} />
            {isSash && <SR l="Horns" v={horn} />}
          </SG>
          <SG t="Colour">
            <SR l="Mode" v={colourMode} />
            <div className="flex items-center gap-2 px-4 py-1">
              <div className="w-3 h-3 rounded border border-surface-400" style={{ backgroundColor: isSingle ? woodColor : woodColorExt }} />
              <span className="text-ink-200">{isSingle ? hexToName(woodColor) : `Ext: ${hexToName(woodColorExt)}`}</span>
            </div>
            {!isSingle && <div className="flex items-center gap-2 px-4 py-1">
              <div className="w-3 h-3 rounded border border-surface-400" style={{ backgroundColor: woodColorInt }} />
              <span className="text-ink-200">Int: {hexToName(woodColorInt)}</span>
            </div>}
          </SG>
          <SG t="Glass">
            <SR l="Type" v={glassType} />
            <SR l="Spec" v={glassSpec} /><SR l="Finish" v={gFin} />
            <SR l="Spacer" v={spacerColor} />
            <SR l="Spacer Type" v={(SPACER_TYPES.find(t => t.value === spacerType) || {}).label || 'Warm Edge'} />
          </SG>
          <SG t="Opening"><SR l="Type" v={opening} /></SG>
          <SG t="Hardware">
            <SR l="PAS24" v={pas24 ? 'Yes' : 'No'} />
            <SR l="Ironmongery" v={iron} />
          </SG>
        </div>
      </div>
    </div>
  );
}

// ─── UI Components ───
function Sec({ t, children }) { return <div className="px-4 py-3 border-b border-surface-500"><div className="text-xs font-semibold text-ink-100 uppercase tracking-wider mb-2">{t}</div>{children}</div>; }
function Lbl({ children }) { return <div className="text-xs text-ink-400 font-medium mb-1 mt-1.5">{children}</div>; }
function HChips({ o, v, c }) { return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => <button key={String(x.value)} onClick={() => c(x.value)} className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }
function GChips({ o, v, c }) { return <div className="grid grid-cols-4 gap-1 mb-2">{o.map(x => <button key={x.value} onClick={() => c(x.value)} className={`px-1.5 py-1 text-[11px] rounded border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }

// ─── Colour picker field (swatches + custom + RAL + F&B), matching EstimateConfiguratorPage ───
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

// ─── B2+B3: Custom bar editor with inline inputs ───
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
            onChange={e => onChange(i, e.target.value)}
            className="flex-1 accent-accent-500 h-1.5" />
          <input type="number" min={10} max={maxVal || 1500} value={b.mm}
            onChange={e => onChange(i, e.target.value)}
            onBlur={() => onFinalize(i)}
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
