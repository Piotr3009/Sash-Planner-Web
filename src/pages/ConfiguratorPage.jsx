import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { useIronmongeryStore, IRONMONGERY_CATEGORIES } from '../stores/ironmongeryStore.js';
import IronmongeryPickerModal from '../components/IronmongeryPickerModal.jsx';
import { GLASS_TYPES, GLASS_SPECS, GLASS_COATINGS, GLASS_FINISHES, FROSTED_LOCATIONS, SPACERS, SPACER_TYPES, SWATCHES, RAL_GROUPS, FB_GROUPS } from '../config.js';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import { buildVentGrilles } from '../engine/lists.js';
import { FAN_AXIS_OFFSET_TOP, FAN_AXIS_OFFSET_BOTTOM } from '../engine/casementLayouts.js';
import CasementLayoutPicker from '../components/configurator/CasementLayoutPicker.jsx';
import NumInput from '../components/NumInput.jsx';
import {
  LAYOUT_DEFAULTS as CAS_LAYOUT_DEFAULTS,
  FANLIGHT_LAYOUTS, FAN2_LAYOUTS, TRIPLE_LAYOUTS,
  CASEMENT_GEO_DEFAULTS,
} from '../engine/casementLayouts.js';

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
const CAS_BAR_COUNTS = [0, 1, 2, 3, 4].map(n => ({ value: n, label: String(n) }));
const CAS_FAN_BAR_COUNTS = [0, 1, 2].map(n => ({ value: n, label: String(n) }));
const ROOM_TYPES = [{ value: 'habitable', label: 'Habitable' }, { value: 'kitchen', label: 'Kitchen' }, { value: 'bathroom', label: 'Bathroom' }, { value: 'other', label: 'No vent' }];
// Vent-category merge: windows saved before it keep their product under the
// retired casementVents key — surface it as trickleVents on prefill.
const migrateSlots = (slots) => {
  const s = { ...(slots || {}) };
  if (s.casementVents && !s.trickleVents) s.trickleVents = s.casementVents;
  delete s.casementVents;
  return s;
};
const SOLE_OPTIONS = [{ value: true, label: 'Only window' }, { value: false, label: 'More than one' }];
const IRON_OPTIONS = [{ value: 'brass', label: 'Brass' }, { value: 'chrome', label: 'Chrome' }, { value: 'stainless', label: 'Stainless' }, { value: 'antique_brass', label: 'Antique Brass' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }];
const SEAL_OPTIONS = [{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }];
const SILL_OPTIONS = [{ value: 0, label: 'None' }, { value: 35, label: '35mm' }, { value: 60, label: '60mm' }, { value: 85, label: '85mm' }];
const SILL_WIDER_OPTIONS = [{ value: false, label: 'No' }, { value: true, label: 'Yes (+50mm each side)' }];
const GAS_OPTIONS = [{ value: 'argon', label: 'Argon' }, { value: 'air', label: 'Air' }];
const BAR_TYPE_OPTIONS = [{ value: 'astragal', label: 'External astragal (stick-on)' }, { value: 'georgian', label: 'Internal georgian' }];
const HORN_OPTIONS = [{ value: 'none', label: 'No Horns' }, { value: 'A', label: 'Richmond' }, { value: 'D', label: 'Type D' }];
const COLOUR_MODES = [{ value: 'single', label: 'Single' }, { value: 'dual', label: 'Dual (Ext/Int)' }];

// ── Door options — values match the PSW door-controller vocabulary 1:1 so a
// future PSW→PC import maps across without translation. Labels are corrected
// where PSW had them swapped (hinge side, open direction).
const DOOR_TYPES = [{ value: 'single-external', label: 'Single Patio' }, { value: 'french', label: 'French' }];
const DOOR_SHAPES = [{ value: 'standard', label: 'Standard' }];
const DOOR_STYLES = [{ value: 'full-glass', label: 'Full Glass' }, { value: 'three-quarter', label: '3/4 Glazed' }, { value: 'half-glazed', label: 'Half Glazed' }];
const DOOR_PANELING = [{ value: 'flat', label: 'Flat' }, { value: 'panel', label: 'Panel' }, { value: 'beading', label: 'Beading' }, { value: 'bespoke', label: 'Bespoke' }];
const DOOR_MULLION = [{ value: false, label: 'No' }, { value: true, label: 'Yes' }];
const SIDE_PANEL_MODES = [{ value: 'none', label: 'None' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }];
const SIDE_PANEL_STYLES = [{ value: 'full-glass', label: 'Full Glass' }, { value: 'same', label: 'Same as door' }];
const BAR_COUNTS = [0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? 'None' : String(n) }));
const HINGE_SIDES = [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }];
const OPEN_DIRECTIONS = [{ value: 'outward', label: 'Outward' }, { value: 'inward', label: 'Inward' }];
// Multipoint is a given — the choice is one handle or two (Piotr 04.08).
const LOCK_TYPES = [{ value: 'single', label: 'Single (1 handle)' }, { value: 'double', label: 'Double (2 handles)' }];
const THRESHOLDS = [{ value: 'standard', label: 'Standard Hardwood' }, { value: 'aluminium', label: 'Aluminium' }, { value: 'low-profile', label: 'Low Profile' }];
const TRANSOM_TYPES = [{ value: 'none', label: 'None' }, { value: 'fixed', label: 'Fixed' }, { value: 'opening', label: 'Opening' }];
const TRANSOM_BARS = [{ value: 'none', label: 'None' }, { value: 'match', label: 'Match door' }];
// Dimension limits per door type — straight from PSW DOOR_DIMS.
// Default (starting) sizes per door type — Piotr 04.08. The wider PSW limits
// stay as the allowed range; these are what a fresh door starts at.
const DOOR_DIMS = {
  'single-external': { wMin: 600, wMax: 1100, hMin: 1900, hMax: 3000, defW: 900, defH: 2000 },
  french: { wMin: 1000, wMax: 2000, hMin: 1900, hMax: 3000, defW: 1600, defH: 2000 },
};
const DOOR_DEFAULT_SIZES = Object.values(DOOR_DIMS).map((x) => `${x.defW}x${x.defH}`);

// ─── Frame drives the glass type (box depth + glazing are one decision) ───
// Depths come from the workshop Window Settings profile (live).
const FRAME_ORDER = ['slim', 'standard', 'triple', 'heritage'];
const FRAME_GLASS = { slim: 'double_slim', standard: 'double', triple: 'triple' }; // heritage → user picks
const HERITAGE_GLASS_OPTIONS = [
  { value: 'passive', label: 'Passive (U: 0.8)' },
  { value: 'single', label: 'Single Laminated' },
];
const glassLabel = (v) => (GLASS_TYPES.find((g) => g.value === v) || {}).label || v;

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

// Map a saved window onto the new 4-value frame choice.
// Legacy windows stored frameType slim|standard, with triple/heritage implied by glass.
function frameFromWindow(w) {
  const ft = w.frameType;
  if (ft === 'triple' || ft === 'heritage' || ft === 'slim') return ft;
  if (w.glassType === 'triple') return 'triple';
  if (w.glassType === 'single' || w.glassType === 'passive') return 'heritage';
  return ft === 'standard' ? 'standard' : 'standard';
}

export default function ConfiguratorPage() {
  const { projectId, batchId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addWindow = useProjectStore((s) => s.addWindowToBatch);
  const tenantSettings = useProjectStore((s) => s.settings);
  const updateWindow = useProjectStore((s) => s.updateWindowInBatch);

  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const batch = project?.batches?.find(b => b.id === batchId);
  const def = batch?.defaults || {};
  const ironItems = useIronmongeryStore((s) => s.items);
  const sashProfile = useWindowProfileStore((s) => s.sash);
  const FRAME_DEPTHS = useMemo(() => Object.fromEntries(
    FRAME_ORDER.map((k) => [k, sashProfile.variants[k]?.boxDepth || 164])
  ), [sashProfile]);
  const FRAME_OPTIONS = useMemo(() => FRAME_ORDER.map((k) => ({
    value: k,
    label: `${sashProfile.variants[k]?.label || k} (${FRAME_DEPTHS[k]}mm)`,
  })), [sashProfile, FRAME_DEPTHS]);

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
  const [ironSlots, setIronSlots] = useState({});      // { categoryKey: itemId }
  const [pickerSlot, setPickerSlot] = useState(null);  // categoryKey of the open picker
  const [horn, setHorn] = useState('A');
  const [frameType, setFrameType] = useState('standard');
  const [colourMode, setColourMode] = useState('single');
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
  const [glassType, setGlassType] = useState('double');
  const [glassSpec, setGlassSpec] = useState('toughened');
  const [glassCoating, setGlassCoating] = useState('standard');
  const [glassGas, setGlassGas] = useState('argon');
  const [casBarType, setCasBarType] = useState('astragal');
  const [sealColour, setSealColour] = useState('black');
  const [sillExt, setSillExt] = useState(0);
  const [sillWider, setSillWider] = useState(false);
  const [spacerColor, setSpacerColor] = useState('white');
  const [spacerType, setSpacerType] = useState('warm');
  const [pas24, setPas24] = useState(false);
  const [childRestrictor, setChildRestrictor] = useState(true);

  // Casement state — field names match PSW payload 1:1 (import/export contract)
  const [casLayout, setCasLayout] = useState('040L');
  const [casHinges, setCasHinges] = useState(null);
  const [fanMm, setFanMm] = useState('');
  const [fan2Mm, setFan2Mm] = useState('');
  const [midMm, setMidMm] = useState('');
  const [casHB, setCasHB] = useState(0);
  const [casVB, setCasVB] = useState(0);
  const [casFanHB, setCasFanHB] = useState(0);
  const [casFanVB, setCasFanVB] = useState(0);
  const [casFan2HB, setCasFan2HB] = useState(0);
  const [casFan2VB, setCasFan2VB] = useState(0);

  // Door state — field names match the PSW payload 1:1 (import/export contract)
  const [doorType, setDoorType] = useState('single-external');
  const [doorShape, setDoorShape] = useState('standard');
  const [doorStyle, setDoorStyle] = useState('full-glass');
  const [doorPaneling, setDoorPaneling] = useState('flat');
  const [centerMullion, setCenterMullion] = useState(false);
  const [doorHB, setDoorHB] = useState(0);
  const [doorVB, setDoorVB] = useState(0);
  const [sidePanels, setSidePanels] = useState('none');
  const [sideLeftW, setSideLeftW] = useState(500);
  const [sideRightW, setSideRightW] = useState(500);
  const [sideStyle, setSideStyle] = useState('full-glass');
  const [sideHB, setSideHB] = useState(0);
  const [sideVB, setSideVB] = useState(0);
  const [transomType, setTransomType] = useState('none');
  const [transomHeight, setTransomHeight] = useState(450);
  const [transomBars, setTransomBars] = useState('none');
  const [hingeSide, setHingeSide] = useState('left');
  const [openDirection, setOpenDirection] = useState('outward');
  const [lockType, setLockType] = useState('single');
  const [doorBarType, setDoorBarType] = useState('astragal');
  const [threshold, setThreshold] = useState('standard');
  const [thresholdExt, setThresholdExt] = useState(0);

  // Frame choice drives glass type; heritage opens a passive/single choice instead.
  const changeFrame = (v) => {
    setFrameType(v);
    if (v === 'heritage') {
      if (glassType !== 'passive' && glassType !== 'single') setGlassType('passive');
    } else {
      setGlassType(FRAME_GLASS[v]);
    }
  };
  const changeHeritageGlass = (v) => {
    setGlassType(v);
    if (v === 'single') setGlassSpec('laminated');
  };

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
    setIronSlots(migrateSlots(w.ironmongerySlots || def.ironmongerySlots || {}));
    setHorn(w.hornType || def.hornType || 'A');
    setFrameType(frameFromWindow(w));
    setColourMode(w.colourMode || def.colourMode || 'single');
    setWoodColor(w.woodColor || def.woodColor || '#F6F6F6');
    setWoodColorExt(w.woodColorExt || w.woodColor || def.woodColorExt || '#F6F6F6');
    setWoodColorInt(w.woodColorInt || w.woodColor || def.woodColorInt || '#F6F6F6');
    setGlassType(w.glassType || def.glassType || 'double');
    setGlassSpec(w.glassSpec || def.glassSpec || 'toughened');
    setGlassCoating(w.glassCoating || def.glassCoating || 'standard');
    setGlassGas(w.glassGas || def.glassGas || 'argon');
    setCasBarType(w.casementBarType || def.casementBarType || 'astragal');
    setSealColour(w.sealColour || def.sealColour || 'black');
    setSillExt(Number(w.sillExtension ?? def.sillExtension) || 0);
    setSillWider(!!(w.sillWider ?? def.sillWider));
    setSpacerColor(w.spacerColor || def.spacerColor || 'white');
    setSpacerType(w.spacerType || def.spacerType || 'warm');
    setPas24(w.pas24 !== undefined ? !!w.pas24 : (def.pas24 || false));
    setChildRestrictor(w.childRestrictor !== undefined ? !!w.childRestrictor : (def.childRestrictor ?? tenantSettings?.childRestrictorDefault ?? true));
    // Casement fields (harmless no-ops for sash windows)
    setCasLayout(w.casementLayout || '040L');
    setCasHinges(Array.isArray(w.casementHinges) ? w.casementHinges : null);
    setFanMm(w.fanlightAxis ?? (w.fanlightHeight != null && w.fanlightHeight !== ''
      ? Number(w.fanlightHeight) + FAN_AXIS_OFFSET_TOP : ''));
    setFan2Mm(w.fan2Axis ?? (w.casementFan2Height != null && w.casementFan2Height !== ''
      ? (Number(w.height ?? w.extHeight) || 0) - Number(w.casementFan2Height) - FAN_AXIS_OFFSET_BOTTOM : ''));
    setMidMm(w.casementMiddleWidth || '');
    setCasHB(w.casementHBars || 0);
    setCasVB(w.casementVBars || 0);
    setCasFanHB(w.casementFanHBars || 0);
    setCasFanVB(w.casementFanVBars || 0);
    setCasFan2HB(w.casementFan2HBars || 0);
    setCasFan2VB(w.casementFan2VBars || 0);
    // Door fields (harmless no-ops for sash/casement windows)
    setDoorType(w.doorType || 'single-external');
    setDoorShape(w.doorShape || 'standard');
    setDoorStyle(w.doorStyle || 'full-glass');
    setDoorPaneling(w.paneling || 'flat');
    setCenterMullion(!!w.centerMullion);
    setDoorHB(w.doorHBars || 0);
    setDoorVB(w.doorVBars || 0);
    setSidePanels(w.sidePanels || 'none');
    setSideLeftW(Number(w.sideLeftWidth) || 500);
    setSideRightW(Number(w.sideRightWidth) || 500);
    setSideStyle(w.sideStyle || 'full-glass');
    setSideHB(w.sideHBars || 0);
    setSideVB(w.sideVBars || 0);
    setTransomType(w.transomType || 'none');
    setTransomHeight(Number(w.transomHeight) || 450);
    setTransomBars(w.transomBars || 'none');
    setHingeSide(w.doorHinge || 'left');
    setOpenDirection(w.doorOpenDirection || 'outward');
    setLockType(w.lockType === 'double' ? 'double' : 'single');
    setDoorBarType(w.doorBarType || 'astragal');
    setThreshold(w.thresholdType || 'standard');
    setThresholdExt(Number(w.thresholdExtension) || 0);
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
        setIronSlots(migrateSlots(def.ironmongerySlots || {}));
        setHorn(def.hornType || 'A');
        const ft = (def.frameType === 'slim') ? 'slim' : 'standard';
        setFrameType(ft);
        setGlassType(FRAME_GLASS[ft]);
        setColourMode(def.colourMode || 'single');
        setWoodColor(def.woodColor || '#F6F6F6');
        setWoodColorExt(def.woodColorExt || '#F6F6F6');
        setWoodColorInt(def.woodColorInt || '#F6F6F6');
        setGlassSpec(def.glassSpec || 'toughened');
        setGlassCoating(def.glassCoating || 'standard');
        setGlassGas(def.glassGas || 'argon');
        setCasBarType(def.casementBarType || 'astragal');
        setSealColour(def.sealColour || 'black');
        setSillExt(Number(def.sillExtension) || 0);
        setSillWider(!!def.sillWider);
        setSpacerColor(def.spacerColor || 'white');
        setSpacerType(def.spacerType || 'warm');
        setPas24(def.pas24 || false);
        setChildRestrictor(def.childRestrictor ?? tenantSettings?.childRestrictorDefault ?? true);
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
  const hasGasFill = glassType !== 'single' && glassType !== 'passive'; // sealed units only
  const frameDepth = FRAME_DEPTHS[frameType] || 164;

  const extW = Number(inW) || 400;
  const extH = Number(inH) || 400;
  const effectiveLBars = sameBars ? uBars : lBars;
  const isCasement = batch?.type === 'casement';
  const isDoor = batch?.type === 'door' || batch?.type === 'doors';

  // Switching door type loads that type's default size — but only while the
  // size is still untouched (equal to some door default or the generic 1000×1500
  // the page starts with). A size the user has typed is never overwritten.
  const applyDoorType = (t) => {
    setDoorType(t);
    const dims = DOOR_DIMS[t];
    if (!dims) return;
    const cur = `${Number(inW) || 0}x${Number(inH) || 0}`;
    if (cur === '1000x1500' || DOOR_DEFAULT_SIZES.includes(cur)) {
      setInW(dims.defW);
      setInH(dims.defH);
    }
  };
  const isFrench = isDoor && doorType === 'french';
  const doorLimits = DOOR_DIMS[doorType] || DOOR_DIMS['single-external'];

  // Casement effective values — PSW clamps 1:1: fanlight 15–50% innerH step 10,
  // fan2 shares a 70% guard with fanlight, middle 300..(W-600) step 10.
  const casCalc = useMemo(() => {
    const innerH = extH - CASEMENT_GEO_DEFAULTS.frameFace - CASEMENT_GEO_DEFAULTS.bottomFace;
    // v1.2: inputs are transom AXES from the frame TOP. PSW zone limits
    // (15–50% of innerH, ≤800, fans together ≤70%) translate through the
    // fixed offsets: axisTop = zone + 91, axis2 = extH − zone2 − 102.
    const zMin = innerH * 0.15;
    const zMax = Math.min(800, innerH * 0.5);
    const fMin = Math.ceil((zMin + FAN_AXIS_OFFSET_TOP) / 10) * 10;
    const fMax = Math.floor((zMax + FAN_AXIS_OFFSET_TOP) / 10) * 10;
    const rawFan = Number(fanMm);
    let fanEff = Math.round((rawFan > 0 ? rawFan : innerH * 0.3 + FAN_AXIS_OFFSET_TOP) / 10) * 10;
    fanEff = Math.max(fMin, Math.min(fMax, fanEff));
    const zone1 = fanEff - FAN_AXIS_OFFSET_TOP;
    const z2Cap = Math.min(zMax, Math.max(zMin, innerH * 0.7 - zone1));
    const f2Min = Math.ceil((extH - FAN_AXIS_OFFSET_BOTTOM - z2Cap) / 10) * 10;
    const f2Max = Math.floor((extH - FAN_AXIS_OFFSET_BOTTOM - zMin) / 10) * 10;
    const rawFan2 = Number(fan2Mm);
    let fan2Eff = Math.round((rawFan2 > 0 ? rawFan2 : extH - FAN_AXIS_OFFSET_BOTTOM - innerH * 0.33) / 10) * 10;
    fan2Eff = Math.max(f2Min, Math.min(f2Max, fan2Eff));
    const zone2 = extH - FAN_AXIS_OFFSET_BOTTOM - fan2Eff;
    const midMax = Math.floor((extW - 600) / 10) * 10;
    const rawMid = Number(midMm);
    const midEff = rawMid > 0 ? Math.max(300, Math.min(midMax, Math.round(rawMid / 10) * 10)) : 0;
    return {
      innerH, fMin, fMax, fanEff, f2Min, f2Max, fan2Eff, midMax, midEff,
      hasFan: FANLIGHT_LAYOUTS.includes(casLayout),
      hasFan2: FAN2_LAYOUTS.includes(casLayout),
      isTriple: TRIPLE_LAYOUTS.includes(casLayout),
      fanRatio: Math.max(0.15, Math.min(0.5, zone1 / innerH)),
      fan2Ratio: Math.max(0.15, Math.min(0.5, zone2 / innerH)),
    };
  }, [extW, extH, fanMm, fan2Mm, midMm, casLayout]);

  // Layout picker apply: PSW behaviour — new layout sets its default frame
  // dimensions and resets fanlight/fan2/middle to auto.
  const applyCasementLayout = (code, hingesArr) => {
    setCasLayout(code);
    setCasHinges(hingesArr);
    const d = CAS_LAYOUT_DEFAULTS[code];
    if (d) { setInW(d.w); setInH(d.h); }
    setFanMm(''); setFan2Mm(''); setMidMm('');
  };

  // ─── 3D sync ───
  const sync = useCallback(() => {
    if (typeof window.update3D !== 'function') return;
    if (isDoor) {
      // Flat door keys — the 3D App was ported from PSW and reads them directly.
      window.update3D({
        windowCategory: 'door', extWidth: extW, extHeight: extH,
        doorType, doorShape, doorStyle, paneling: doorPaneling, centerMullion,
        doorHinge: hingeSide, doorOpenDirection: openDirection,
        doorHBars: doorHB, doorVBars: doorVB,
        sidePanels, sideLeftWidth: sideLeftW, sideRightWidth: sideRightW,
        sideStyle, sideHBars: sideHB, sideVBars: sideVB,
        // Transom is a french-only feature; force it off for single doors so a
        // leftover value cannot silently render a fanlight.
        transomType: isFrench ? transomType : 'none',
        transomHeight, transomBars: isFrench ? transomBars : 'none',
        thresholdType: threshold, thresholdExtension: thresholdExt,
        doorOpening: 0,
        woodColor, woodColorExt: isSingle ? woodColor : woodColorExt,
        woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
        doubleGlazing: glassType !== 'triple', spacerColor,
        glassFinish: gFin,
        sealColour, sillExtension: sillExt, sillWider, ironmongery: iron,
      });
      return;
    }
    if (isCasement) {
      window.update3D({
        windowCategory: 'casement', extWidth: extW, extHeight: extH,
        casementLayout: casLayout,
        casementHinges: casHinges ? [...casHinges] : null,
        casementMiddleWidth: casCalc.isTriple ? casCalc.midEff : 0,
        fanlightRatio: casCalc.fanRatio,
        casementFan2Ratio: casCalc.fan2Ratio,
        casementHBars: casHB, casementVBars: casVB,
        casementFanHBars: casCalc.hasFan ? Math.min(2, casFanHB) : 0,
        casementFanVBars: casCalc.hasFan ? Math.min(2, casFanVB) : 0,
        casementFan2HBars: casCalc.hasFan2 ? Math.min(2, casFan2HB) : 0,
        casementFan2VBars: casCalc.hasFan2 ? Math.min(2, casFan2VB) : 0,
        casementOpening: 0,
        woodColor, woodColorExt: isSingle ? woodColor : woodColorExt,
        woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
        doubleGlazing: glassType !== 'triple', spacerColor,
        glassFinish: gFin,
        frostedLocation: frostLoc,
        trickleVent: buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } }) > 0 ? 'frame' : 'none',
        trickleColour: 'white',
        sealColour, sillExtension: sillExt, sillWider, ironmongery: iron,
      });
      return;
    }
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
      doubleGlazing: glassType !== 'single',
      spacerColor, sashType, splitRatio, headType, openingType: opening,
      boxType: frameType === 'slim' ? 'slim' : 'standard', boxDepth: frameDepth,
    });
  }, [extW, extH, uBars, effectiveLBars, sameBars, uCustom, lCustom, horn, woodColor, woodColorExt, woodColorInt, isSingle, iron, gFin, frostLoc, glassType, spacerColor, sashType, splitRatio, headType, opening, frameType, frameDepth, batch?.type, isCasement, casLayout, casHinges, casCalc, casHB, casVB, casFanHB, casFanVB, casFan2HB, casFan2VB, sillExt, sillWider, sealColour, ventRoomType, ventSoleWindow, isDoor, isFrench, doorType, doorShape, doorStyle, doorPaneling, centerMullion, doorHB, doorVB, sidePanels, sideLeftW, sideRightW, sideStyle, sideHB, sideVB, transomType, transomHeight, transomBars, hingeSide, openDirection, threshold, thresholdExt, lockType, doorBarType]);
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
      colourMode, sameColor: isSingle, ironmongery: iron, ironmongerySlots: ironSlots, doubleGlazing: glassType !== 'single',
      upperGlass: gFin === 'frosted' && frostLoc === 'both' ? 'frosted' : 'clear',
      lowerGlass: gFin === 'frosted' ? 'frosted' : 'clear',
      glassType, glassSpec, glassCoating, glassGas, casementBarType: casBarType, sealColour, sillExtension: sillExt, sillWider, glassFinish: gFin, frostedLocation: frostLoc,
      spacerColor, spacerType, sashType, splitRatio, headType, openingType: opening,
      ventRoomType, ventSoleWindow,
      frameType, frameDepth, pas24, childRestrictor,
      ...(isCasement ? {
        casementLayout: casLayout,
        casementHinges: casHinges ? [...casHinges] : null,
        fanlightAxis: casCalc.hasFan ? casCalc.fanEff : null,
        fan2Axis: casCalc.hasFan2 ? casCalc.fan2Eff : null,
        casementMiddleWidth: casCalc.isTriple ? casCalc.midEff : 0,
        casementHBars: casHB, casementVBars: casVB,
        casementFanHBars: Math.min(2, casFanHB), casementFanVBars: Math.min(2, casFanVB),
        casementFan2HBars: Math.min(2, casFan2HB), casementFan2VBars: Math.min(2, casFan2VB),
      } : {}),
      ...(isDoor ? {
        doorType, doorShape, doorStyle, doorPaneling, centerMullion,
        doorHinge: hingeSide, doorOpenDirection: openDirection, lockType, doorBarType,
        doorHBars: doorHB, doorVBars: doorVB,
        sidePanels, sideLeftWidth: sideLeftW, sideRightWidth: sideRightW,
        sideStyle, sideHBars: sideHB, sideVBars: sideVB,
        transomType: isFrench ? transomType : 'none',
        transomHeight, transomBars: isFrench ? transomBars : 'none',
        thresholdType: threshold, thresholdExtension: thresholdExt,
      } : {}),
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
  // Batch type may be 'door' or 'doors' depending on how it was created —
  // normalise so door slots surface either way.
  const slotType = (batch.type === 'doors' ? 'door' : (batch.type || 'sash'));
  const slotCategories = IRONMONGERY_CATEGORIES.filter(c => (c.windowType === slotType || c.windowType === 'all') && c.slot !== false);
  const getSlotItem = (key) => ironItems.find(m => m.id === ironSlots[key]) || null;

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

          {isCasement && <Sec t="Window Type">
            <CasementLayoutPicker
              layout={casLayout}
              casementHinges={casHinges}
              dims={{ w: extW, h: extH, fanMm: casCalc.fanEff, fan2Mm: casCalc.fan2Eff, middleMm: casCalc.midEff }}
              onApply={applyCasementLayout}
            />
          </Sec>}

          {isSash && <Sec t="Sash Type">
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <select value={splitRatio} onChange={e => setSplitRatio(e.target.value)} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2">{SPLIT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
            <Lbl>Head</Lbl><HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
          </Sec>}

          {isSash && <Sec t="Frame">
            <HChips o={FRAME_OPTIONS} v={frameType} c={changeFrame} />
            <div className="text-[11px] text-ink-300">
              Box depth: <span className="text-accent-400 font-medium">{frameDepth}mm</span>
              {frameType !== 'heritage' && <> · Glass: <span className="text-accent-400 font-medium">{glassLabel(glassType)}</span></>}
            </div>
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
            {isCasement && casCalc.hasFan && <>
              <Lbl>Transom axis — from frame top (mm) <span className="text-ink-500">({casCalc.fMin}–{casCalc.fMax})</span></Lbl>
              <input type="number" min={casCalc.fMin} max={casCalc.fMax} step={10}
                value={fanMm === '' ? casCalc.fanEff : fanMm}
                onChange={e => setFanMm(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setFanMm(casCalc.fanEff)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
            </>}
            {isCasement && casCalc.hasFan2 && <>
              <Lbl>Transom 2 axis — from frame top (mm) <span className="text-ink-500">({casCalc.f2Min}–{casCalc.f2Max})</span></Lbl>
              <input type="number" min={casCalc.f2Min} max={casCalc.f2Max} step={10}
                value={fan2Mm === '' ? casCalc.fan2Eff : fan2Mm}
                onChange={e => setFan2Mm(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setFan2Mm(casCalc.fan2Eff)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
            </>}
            {isCasement && casCalc.isTriple && <>
              <Lbl>Middle section (mm) <span className="text-ink-500">(300–{casCalc.midMax}, empty = equal)</span></Lbl>
              <input type="number" min={300} max={casCalc.midMax} step={10}
                value={midMm}
                placeholder="Equal split"
                onChange={e => setMidMm(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => setMidMm(casCalc.midEff > 0 ? casCalc.midEff : '')}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              <div className="text-[11px] text-ink-300 mt-1">
                Sides: <span className="text-accent-400 font-medium">
                  {casCalc.midEff > 0 ? `${Math.round((extW - casCalc.midEff) / 2)}mm each` : 'equal split'}
                </span>
              </div>
            </>}
          </Sec>

          {isCasement && <Sec t="Glazing Bars">
            <Lbl>Main — horizontal</Lbl><HChips o={CAS_BAR_COUNTS} v={casHB} c={setCasHB} />
            <Lbl>Main — vertical</Lbl><HChips o={CAS_BAR_COUNTS} v={casVB} c={setCasVB} />
            {casCalc.hasFan && <>
              <Lbl>Fanlight — horizontal</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFanHB} c={setCasFanHB} />
              <Lbl>Fanlight — vertical</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFanVB} c={setCasFanVB} />
            </>}
            {casCalc.hasFan2 && <>
              <Lbl>Fanlight 2 — horizontal</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFan2HB} c={setCasFan2HB} />
              <Lbl>Fanlight 2 — vertical</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFan2VB} c={setCasFan2VB} />
            </>}
            {(casHB + casVB + casFanHB + casFanVB + casFan2HB + casFan2VB) > 0 && (
              <><Lbl>Bar type</Lbl><HChips o={BAR_TYPE_OPTIONS} v={casBarType} c={setCasBarType} /></>
            )}
          </Sec>}

          {isSash && <Sec t="Georgian Bars">
            <Lbl>Upper</Lbl><GChips o={BAR_OPTIONS} v={uBars} c={v => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && <CBarEd bars={uCustom} maxVal={extW} onAdd={type => addBar(setUCustom, uCustom, type)} onChange={(i, v) => updateBarMm(setUCustom, uCustom, i, v)} onFinalize={i => finalizeBarMm(setUCustom, uCustom, i)} onRemove={i => removeBar(setUCustom, uCustom, i)} />}
            <label className="flex items-center gap-2 text-xs text-ink-400 mb-2 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={e => setSameBars(e.target.checked)} className="accent-accent-500" />Same upper & lower</label>
            {!sameBars && <><Lbl>Lower</Lbl><GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />{lBars === 'custom' && <CBarEd bars={lCustom} maxVal={extW} onAdd={type => addBar(setLCustom, lCustom, type)} onChange={(i, v) => updateBarMm(setLCustom, lCustom, i, v)} onFinalize={i => finalizeBarMm(setLCustom, lCustom, i)} onRemove={i => removeBar(setLCustom, lCustom, i)} />}</>}
          </Sec>}

          {isSash && <Sec t="Opening"><HChips o={OPENINGS} v={opening} c={setOpening} /></Sec>}

          {/* ── Doors — every PSW choice, one shared set for single and french.
               Transom is french-only; PSW hides it the same way. ── */}
          {isDoor && <>
            <Sec t="Door Type">
              <HChips o={DOOR_TYPES} v={doorType} c={applyDoorType} />
              <div className="text-[11px] text-ink-500 mt-1.5">
                Width {doorLimits.wMin}–{doorLimits.wMax} · Height {doorLimits.hMin}–{doorLimits.hMax} mm
                {(extW < doorLimits.wMin || extW > doorLimits.wMax || extH < doorLimits.hMin || extH > doorLimits.hMax) && (
                  <span className="text-amber-400"> · current size is outside this range</span>
                )}
              </div>
            </Sec>

            <Sec t="Door Design">
              <Lbl>Shape</Lbl><HChips o={DOOR_SHAPES} v={doorShape} c={setDoorShape} />
              <Lbl>Style</Lbl><HChips o={DOOR_STYLES} v={doorStyle} c={setDoorStyle} />
              <Lbl>Paneling</Lbl><HChips o={DOOR_PANELING} v={doorPaneling} c={setDoorPaneling} />
              {isFrench && <><Lbl>Centre mullion</Lbl><HChips o={DOOR_MULLION} v={centerMullion} c={setCenterMullion} /></>}
              <Lbl>Bars — horizontal</Lbl><HChips o={BAR_COUNTS} v={doorHB} c={setDoorHB} />
              <Lbl>Bars — vertical</Lbl><HChips o={BAR_COUNTS} v={doorVB} c={setDoorVB} />
              {(doorHB > 0 || doorVB > 0) && (
                <><Lbl>Bar type</Lbl><HChips o={BAR_TYPE_OPTIONS} v={doorBarType} c={setDoorBarType} /></>
              )}
            </Sec>

            <Sec t="Side Panels">
              <HChips o={SIDE_PANEL_MODES} v={sidePanels} c={setSidePanels} />
              {sidePanels !== 'none' && <>
                {(sidePanels === 'left' || sidePanels === 'both') && <>
                  <Lbl>Left width (mm)</Lbl>
                  <NumInput value={sideLeftW} onCommit={(v) => setSideLeftW(Math.min(800, Math.max(200, Number(v) || 500)))}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-2" />
                </>}
                {(sidePanels === 'right' || sidePanels === 'both') && <>
                  <Lbl>Right width (mm)</Lbl>
                  <NumInput value={sideRightW} onCommit={(v) => setSideRightW(Math.min(800, Math.max(200, Number(v) || 500)))}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-2" />
                </>}
                <Lbl>Panel style</Lbl><HChips o={SIDE_PANEL_STYLES} v={sideStyle} c={setSideStyle} />
                <Lbl>Panel bars — horizontal</Lbl><HChips o={BAR_COUNTS} v={sideHB} c={setSideHB} />
                <Lbl>Panel bars — vertical</Lbl><HChips o={BAR_COUNTS} v={sideVB} c={setSideVB} />
              </>}
            </Sec>

            {isFrench && <Sec t="Transom / Fanlight">
              <HChips o={TRANSOM_TYPES} v={transomType} c={setTransomType} />
              {transomType !== 'none' && <>
                <Lbl>Transom height (mm)</Lbl>
                <NumInput value={transomHeight} onCommit={(v) => setTransomHeight(Math.min(750, Math.max(250, Number(v) || 450)))}
                  className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-2" />
                <Lbl>Transom bars</Lbl><HChips o={TRANSOM_BARS} v={transomBars} c={setTransomBars} />
              </>}
            </Sec>}

            <Sec t="Hardware & Threshold">
              <Lbl>Hinge side</Lbl><HChips o={HINGE_SIDES} v={hingeSide} c={setHingeSide} />
              <Lbl>Opening direction</Lbl><HChips o={OPEN_DIRECTIONS} v={openDirection} c={setOpenDirection} />
              <Lbl>Lock</Lbl><HChips o={LOCK_TYPES} v={lockType} c={setLockType} />
              <Lbl>Threshold</Lbl><HChips o={THRESHOLDS} v={threshold} c={setThreshold} />
              <Lbl>Threshold extension (mm)</Lbl>
              <NumInput value={thresholdExt} onCommit={(v) => setThresholdExt(Math.min(100, Math.max(0, Number(v) || 0)))}
                className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
            </Sec>
          </>}

          <Sec t="Ventilation">
            <Lbl>Room type</Lbl>
            <HChips o={ROOM_TYPES} v={ventRoomType} c={setVentRoomType} />
            {(ventRoomType === 'habitable' || ventRoomType === 'kitchen') && (
              <><Lbl>Only window in this room?</Lbl><HChips o={SOLE_OPTIONS} v={ventSoleWindow} c={setVentSoleWindow} /></>
            )}
            <div className="text-[11px] text-ink-300 mt-1.5">Trickle vents: <span className="text-accent-400 font-medium">{buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } })}</span></div>
          </Sec>

          <Sec t="Glass">
            {isCasement ? (
              <><Lbl>Type</Lbl><HChips o={GLASS_TYPES.filter(g => g.value === 'double' || g.value === 'triple')} v={glassType} c={setGlassType} /></>
            ) : !isSash ? (
              <><Lbl>Type</Lbl><HChips o={GLASS_TYPES.filter(g => g.value === 'double' || g.value === 'double_slim' || g.value === 'triple')} v={glassType} c={setGlassType} /></>
            ) : frameType === 'heritage' ? (
              <><Lbl>Type</Lbl><HChips o={HERITAGE_GLASS_OPTIONS} v={glassType} c={changeHeritageGlass} /></>
            ) : (
              <div className="text-[11px] text-ink-300 mb-2">Type: <span className="text-accent-400 font-medium">{glassLabel(glassType)}</span> <span className="text-ink-500">— set by frame</span></div>
            )}
            <Lbl>Spec</Lbl><HChips o={GLASS_SPECS} v={glassSpec} c={setGlassSpec} />
            <Lbl>Coating</Lbl><HChips o={GLASS_COATINGS} v={glassCoating} c={setGlassCoating} />
            <Lbl>Finish</Lbl><HChips o={GLASS_FINISHES} v={gFin} c={setGFin} />
            {gFin === 'frosted' && <><Lbl>Location</Lbl><HChips o={FROSTED_LOCATIONS} v={frostLoc} c={setFrostLoc} /></>}
            <Lbl>Spacer</Lbl><HChips o={SPACERS} v={spacerColor} c={setSpacerColor} />
            <Lbl>Spacer type</Lbl><HChips o={SPACER_TYPES} v={spacerType} c={setSpacerType} />
            {isCasement ? (
              <><Lbl>Gas</Lbl><HChips o={GAS_OPTIONS} v={glassGas} c={setGlassGas} /></>
            ) : (hasGasFill && <div className="text-[11px] text-ink-300 mt-1">Gas: <span className="text-accent-400 font-medium">Argon</span> <span className="text-ink-500">— fixed</span></div>)}
          </Sec>

          <Sec t={isCasement ? 'Security & External Cill' : 'Horns & Security'}>
            {isSash && <><Lbl>Horns</Lbl><HChips o={HORN_OPTIONS} v={horn} c={setHorn} /></>}
            {isCasement && <>
              <Lbl>Cill projection</Lbl><HChips o={SILL_OPTIONS} v={sillExt} c={setSillExt} />
              <Lbl>Extend cill 50mm each side?</Lbl><HChips o={SILL_WIDER_OPTIONS} v={sillWider} c={setSillWider} />
            </>}
            <label className="flex items-center gap-2 text-xs text-ink-400 mt-1.5 cursor-pointer"><input type="checkbox" checked={pas24} onChange={e => setPas24(e.target.checked)} className="accent-accent-500" />PAS24 security</label>
            {isCasement && (
              <label className="flex items-center gap-2 text-xs text-ink-400 mt-1.5 cursor-pointer">
                <input type="checkbox" checked={childRestrictor} onChange={e => setChildRestrictor(e.target.checked)} className="accent-accent-500" />
                Child restrictor
                <span
                  title="Building Regs AD K: an openable window below 800mm floor level with an external drop of 600mm or more must restrict initial opening to 100mm. On escape (egress) windows the restrictor must be releasable without tools (AD B). Hinge slots 350\u2013700mm have the restriction built in; XL / small sashes get a separate releasable restrictor added automatically (Nico Safety Catch, BJ Waller RST42012A)."
                  onClick={(e) => e.preventDefault()}
                  className="w-4 h-4 flex items-center justify-center rounded-full bg-surface-600 text-accent-400 text-[9px] font-bold cursor-help shrink-0"
                >?</span>
              </label>
            )}
          </Sec>

          <Sec t="Colour">
            <HChips o={COLOUR_MODES} v={colourMode} c={setColourMode} />
            <ColorField label={isSingle ? 'Colour' : 'Exterior'} value={isSingle ? woodColor : woodColorExt} onChange={isSingle ? setWoodColor : setWoodColorExt} />
            {!isSingle && <ColorField label="Interior" value={woodColorInt} onChange={setWoodColorInt} />}
            {isCasement && <><Lbl>Seal colour</Lbl><HChips o={SEAL_OPTIONS} v={sealColour} c={setSealColour} /></>}
          </Sec>

          <Sec t="Ironmongery">
            <Lbl>Finish</Lbl>
            <HChips o={IRON_OPTIONS} v={iron} c={setIron} />
            <Lbl>Products</Lbl>
            <div className="space-y-1.5">
              {slotCategories.map(cat => {
                const item = getSlotItem(cat.key);
                return (
                  <div key={cat.key}
                    onClick={() => setPickerSlot(cat.key)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      item
                        ? 'border-accent-500/30 bg-accent-500/5 hover:bg-accent-500/10'
                        : 'border-surface-500 bg-surface-700/20 hover:bg-surface-700/40 border-dashed'
                    }`}
                  >
                    <div className="w-9 h-9 rounded bg-surface-600 shrink-0 overflow-hidden">
                      {item?.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-500 text-[10px]">+</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-ink-400 uppercase tracking-wider">{cat.label}</div>
                      {item ? (
                        <div className="text-[11px] text-ink-100 font-medium truncate">{item.name} {item.color && `(${item.color})`}</div>
                      ) : (
                        <div className="text-[11px] text-ink-500 italic">Click to assign...</div>
                      )}
                    </div>
                    {item && item.cost_per_unit > 0 && (
                      <div className="text-[10px] font-mono text-accent-400 shrink-0">£{Number(item.cost_per_unit).toFixed(2)}</div>
                    )}
                  </div>
                );
              })}
            </div>
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
          {isCasement && <SG t="Layout">
            <SR l="Type" v={casLayout} />
            <SR l="Openers" v={casHinges ? String(casHinges.filter(h => h === true || (typeof h === 'string' && h !== 'fixed')).length) : '—'} />
            {casCalc.hasFan && <SR l="Transom axis" v={`${casCalc.fanEff}mm`} />}
            {casCalc.hasFan2 && <SR l="Transom 2 axis" v={`${casCalc.fan2Eff}mm`} />}
            {casCalc.isTriple && <SR l="Middle" v={casCalc.midEff > 0 ? `${casCalc.midEff}mm` : 'equal'} />}
            <SR l="Bars" v={`${casHB}H × ${casVB}V`} />
            {(casHB + casVB + casFanHB + casFanVB + casFan2HB + casFan2VB) > 0 && (
              <SR l="Bar type" v={casBarType === 'astragal' ? 'External astragal' : 'Internal georgian'} />
            )}
          </SG>}
          {isSash && <SG t="Bars">
            <SR l="Upper" v={uBars} />
            {uBars === 'custom' && uCustom.length > 0 && <div className="px-4 py-0.5 text-[10px] text-accent-400">{formatBars(uCustom)}</div>}
            {!sameBars && <SR l="Lower" v={lBars} />}
            {!sameBars && lBars === 'custom' && lCustom.length > 0 && <div className="px-4 py-0.5 text-[10px] text-accent-400">{formatBars(lCustom)}</div>}
          </SG>}
          <SG t="Frame & Horns">
            <SR l="Frame" v={`${frameType} · ${frameDepth}mm`} />
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
            <SR l="Type" v={glassLabel(glassType)} />
            <SR l="Spec" v={glassSpec} />
            <SR l="Coating" v={(GLASS_COATINGS.find(c => c.value === glassCoating) || {}).label || 'Standard'} />
            <SR l="Finish" v={gFin} />
            {(isCasement || hasGasFill) && <SR l="Gas" v={isCasement ? (glassGas === 'argon' ? 'Argon' : 'Air') : 'Argon'} />}
            <SR l="Spacer" v={spacerColor} />
            <SR l="Spacer Type" v={(SPACER_TYPES.find(t => t.value === spacerType) || {}).label || 'Warm Edge'} />
          </SG>
          <SG t="Ventilation">
            <SR l="Room" v={ventRoomType} />
            <SR l="Sole window" v={ventSoleWindow ? 'Yes' : 'No'} />
            <SR l="Trickle vents" v={String(buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } }))} />
          </SG>
          {isCasement && <SG t="External Cill">
            <SR l="Projection" v={sillExt ? `${sillExt}mm` : 'None'} />
            <SR l="Wider" v={sillWider ? '+50mm each side' : 'No'} />
            <SR l="Seal" v={sealColour === 'black' ? 'Black' : 'White'} />
          </SG>}
          {isSash && <SG t="Opening"><SR l="Type" v={opening} /></SG>}
          <SG t="Hardware">
            <SR l="PAS24" v={pas24 ? 'Yes' : 'No'} />
            <SR l="Ironmongery" v={iron} />
            {slotCategories.map(cat => {
              const item = getSlotItem(cat.key);
              return item ? <SR key={cat.key} l={cat.label} v={item.name} /> : null;
            })}
          </SG>
        </div>
      </div>

      {/* Ironmongery Picker Modal */}
      {pickerSlot && (
        <IronmongeryPickerModal
          categoryKey={pickerSlot}
          currentItemId={ironSlots[pickerSlot] || null}
          onSelect={(itemId) => setIronSlots(s => ({ ...s, [pickerSlot]: itemId }))}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}

// ─── UI Components ───
function Sec({ t, children }) { return <div className="px-4 py-3 border-b border-surface-500"><div className="text-xs font-semibold text-ink-100 uppercase tracking-wider mb-2">{t}</div>{children}</div>; }
function Lbl({ children }) { return <div className="text-xs text-ink-400 font-medium mb-1 mt-1.5">{children}</div>; }
function HChips({ o, v, c }) { return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => <button key={String(x.value)} onClick={() => c(x.value)} className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }
function GChips({ o, v, c }) { return <div className="grid grid-cols-4 gap-1 mb-2">{o.map(x => <button key={x.value} onClick={() => c(x.value)} className={`px-1.5 py-1 text-[11px] rounded border transition-all ${v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>)}</div>; }

// ─── Colour picker field: single row of 5 small swatches + custom, RAL + F&B dropdowns ───
function ColorField({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded border border-surface-400 shrink-0" style={{ backgroundColor: value }} />
        <span className="text-xs text-ink-100 font-medium truncate">{hexToName(value)}</span>
      </div>
      <div className="flex gap-1">
        {SWATCHES.slice(0, 5).map((s) => (
          <div key={s.hex} onClick={() => onChange(s.hex)} title={s.name}
            className={`w-6 h-6 rounded cursor-pointer border ${value === s.hex ? 'border-accent-500 border-2' : 'border-surface-500'}`}
            style={{ backgroundColor: s.hex }} />
        ))}
        <label className="w-6 h-6 rounded border border-dashed border-surface-400 flex items-center justify-center cursor-pointer text-ink-400 hover:text-ink-200 text-xs relative" title="Custom colour">
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
