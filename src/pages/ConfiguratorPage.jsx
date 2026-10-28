import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { useIronmongeryStore, IRONMONGERY_CATEGORIES } from '../stores/ironmongeryStore.js';
import IronmongeryPickerModal from '../components/IronmongeryPickerModal.jsx';
import { GLASS_TYPES, GLASS_SPECS, GLASS_COATINGS, GLASS_FINISHES, FROSTED_LOCATIONS, SPACERS, SPACER_TYPES, SWATCHES, RAL_GROUPS, FB_GROUPS } from '../config.js';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import { buildVentGrilles } from '../engine/lists.js';
import { FAN_AXIS_OFFSET_TOP, FAN_AXIS_OFFSET_BOTTOM } from '../engine/casementLayouts.js';
import {
  GOTHIC_PROFILE_RATIO, ROUND_AUTO_RATIO, LEGACY_ARCH_SHAPES, PATTERNS_FOR_SHAPE, ARCH_BAR_PATTERN_LABELS,
  isHubPattern, isGothicShape, resolveRoundShape, buildArchPlan, buildSashArchGeometry, planArchSegments, buildCirclePlan,
} from '../engine/arch.js';
import { DEFAULT_DOOR_PROFILE, DEFAULT_PARTITION_PROFILE, DEFAULT_FIREDOOR_PROFILE, FIREDOOR_CLOSER_KINDS, FIREDOOR_CLOSER_LABELS, getCasementProfile, getDoorProfile, getPartitionProfile, getFireDoorProfile, getWindowProfile } from '../engine/profile.js';
import { casementFrameDims, doorFrameDims, doorGeometryFromSpec, fireDoorGeometryFromSpec } from '../utils/windowSpecToConfig.js';
// Fire doors (27.10.2026): the door numbering helper, the engine's own error class
// and (v1.1) the opening <-> leaf size rule the chips and the v1 load use
import { nextFireDoorName, FireDoorGeometryError, fireDoorOpeningForLeaf, fireDoorVpInput } from '../engine/fireDoor.js';
import { normaliseToWindowSpec, SASH_PROPORTIONS, SASH_PROPORTION_OPTIONS, SASH_PROPORTION_LABELS, COTTAGE_MIN_FRAME_HEIGHT, effectiveSashProportion, TRIPLE_OPENING_LABEL, fireDoorCloserKind, fireDoorVpField } from '../engine/specification.js';
import { CONSTANTS, meetingFractionFor, deriveWindowData } from '../engine/calculations.js';
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
  { value: '4x4', label: '4×4' }, { value: '6x6', label: '6×6' }, { value: '8x8', label: '8×8' }, { value: '9x9', label: '9×9' },
  { value: 'custom', label: 'Custom' },
];
const SASH_TYPES = [{ value: 'double', label: 'Double Hung' }, { value: 'triple', label: 'Triple Sash' }];
const SPLIT_RATIOS = [
  { value: '1/4-1/2-1/4', label: '1/4 – 1/2 – 1/4' },
  { value: '1/3-1/3-1/3', label: '1/3 – 1/3 – 1/3' },
  { value: '1/5-3/5-1/5', label: '1/5 – 3/5 – 1/5' },
];
const HEAD_TYPES = [{ value: 'flat', label: 'Flat' }, { value: 'arch', label: 'Arch' }];
// Arched sash (arched-windows-v3 Block 1 B): the frame itself is arched (Round | Gothic, arch start from the
// cill) — distinct from the glazing-arch head type above (rectangular frame, arched glass line, Block 4 note).
const SASH_FRAME_SHAPES = [{ value: 'standard', label: 'Standard' }, { value: 'arched', label: 'Arched' }];
const SASH_BAR_COUNTS = [0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }));
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
const SIDE_PANEL_MODES = [{ value: 'none', label: 'None' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }];
const SIDE_PANEL_STYLES = [{ value: 'full-glass', label: 'Full Glass' }, { value: 'same', label: 'Same as door' }];
const BAR_COUNTS = [0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? 'None' : String(n) }));
// "Open side", not "hinge side" (Piotr 05.08; PSW calls it "Open First").
// Convention: LEFT = the door opens to YOUR left as you walk through it, so
// seen from OUTSIDE its hinges are on the RIGHT. The 3D model already follows
// this (layout 040L → panel hinge 'right').
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
// Partition walls (25.10.2026): W x H is the wall (the bay between the end
// boards and the head board), typed as a layout string of screens (S) and
// doors (D). A fresh wall starts at the owner's Windmill Street bay; the range
// is a UI clamp only (the engine raises PartitionGeometryError when the bay
// cannot hold its layout). The partition numbers come from the partition profile.
const PARTITION_CONSTRAINTS = { minW: 600, maxW: 8000, minH: 1800, maxH: 4000, defW: 2525, defH: 2165 };
const PARTITION_LIGHTS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));
// Hinge side seen from the corridor (the front face); swing out = towards the corridor.
const PARTITION_HINGE_SIDES = [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }];
const PARTITION_SWINGS = [{ value: 'out', label: 'Out (to the corridor)' }, { value: 'in', label: 'In (into the room)' }];
const cleanPartitionLayout = (v) => String(v || '').toUpperCase().replace(/[^SD]/g, '');
// Fire doors (27.10.2026): internal door sets (leaf + frame, CLAUDE.md fire
// doors v1, v1.1 of 27.10.2026 evening). The option vocabularies of the spec
// block (brief 3.1); the sizes, the suggestion chips and the style tables come
// from the fire door profile (Window Settings · Fire Doors), never from a
// literal here. v1.1: no swing (an internal door is handed by its hinge side
// only), the closer is a kind (none / surface / built in, labels from the
// profile module), the intumescent is one strip size by rating (read only).
const FD_FIRE = [{ value: true, label: 'Fire door' }, { value: false, label: 'Non-fire' }];
const FD_RATINGS = [{ value: 'FD30', label: 'FD30' }, { value: 'FD60', label: 'FD60' }];
// Hinge side seen from the PULL side (the side the knuckles show); printed "Hinge left / Hinge right" (the PSW wording rule)
const FD_HINGE_SIDES = [{ value: 'left', label: 'Hinge left' }, { value: 'right', label: 'Hinge right' }];
const FD_LOCKS = [{ value: 'latch', label: 'Latch' }, { value: 'euro', label: 'Sashlock euro' }, { value: 'bathroom', label: 'Bathroom' }];
const FD_LOCK_LABEL = Object.fromEntries(FD_LOCKS.map((o) => [o.value, o.label]));
const FD_CLOSERS = FIREDOOR_CLOSER_KINDS.map((k) => ({ value: k, label: FIREDOOR_CLOSER_LABELS[k] || k }));
const FD_YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];
// v1.2 (owner 28.10.2026): the vision panel is a TYPE (the chips come from the
// profile's vp.types) with its size, panes and a position. The eleven keys of
// the stored firedoorVp block, the arrangement and the two position modes with
// the label of their one mm field (the engine's words, fireDoor.js).
const FD_VP_KEYS = ['type', 'shape', 'width', 'height', 'count', 'arrange', 'gap', 'across', 'acrossOffset', 'down', 'downOffset'];
const FD_VP_COUNTS = [1, 2, 3, 4, 5];
const FD_VP_ARRANGE = [{ value: 'stack', label: 'One above another' }, { value: 'side', label: 'Side by side' }];
const FD_VP_ACROSS = [{ value: 'centre', label: 'Centred', field: 'Shift (+ towards the lock edge)' }, { value: 'hinge', label: 'From hinge edge', field: 'From the hinge edge' }, { value: 'lock', label: 'From lock edge', field: 'From the lock edge' }];
const FD_VP_DOWN = [{ value: 'top', label: 'Top from the leaf top', field: 'Top below the leaf top' }, { value: 'centre', label: 'Centre above the leaf bottom', field: 'Centre above the leaf bottom' }, { value: 'bottom', label: 'Bottom above the leaf bottom', field: 'Bottom above the leaf bottom' }];
// the chip look of HChips, for the fire door chips that carry an icon, a swatch or a data attribute
const fdChipCls = (on) => `px-2.5 py-1 text-[11px] rounded-lg border transition-all ${on ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`;
// a leaf override field: '' (empty, the engine derives the leaf from the opening) or a number; stored as 0 when empty
const fdLeafStore = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) <= 0 ? 0 : Number(v));
// the 3D opens the leaf this far by default (FIREDOOR-CONTRACT section 7: fireDoorOpen, degrees)
const FD_3D_OPEN_DEG = 30;

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
// Triple sash runs to 3500 wide (Piotr 15.10.2026; was 3000): the engine, lists, sheets, 3D and
// pricing carry no width cap of their own, this clamp is the only one. Double stays at 3000.
const TRIPLE_CONSTRAINTS = { minW: 1400, maxW: 3500, defaultW: 2000, minH: 1200, maxH: 2500 };
const DOUBLE_CONSTRAINTS = { minW: 400, maxW: 3000, minH: 400, maxH: 3000 };
// Casement runs wider than a sash box: four lights need more than 3000
// (Piotr 21.08). Height stays at the sash limit. Note this is a FRAME limit
// only — per-leaf hardware limits live in casementHardware.js and still apply.
const CASEMENT_CONSTRAINTS = { minW: 400, maxW: 5000, minH: 400, maxH: 3000 };
// Arched casement (arched-casement-v2): shape is an attribute of the casement,
// never a separate batch type. The joiner picks Round | Gothic and types WHERE
// THE ARCH STARTS (mm from the cill); rise = H − start. A Round arch resolves
// to the engine's 'semi-circle' (start exactly H − W/2) or 'three-centre'
// (resolveRoundShape, rule C: every arch starts vertical at the jambs); Gothic
// + profile → 'gothic-equilateral' / 'gothic-drop' with a derived start.
// Radii are results, shown in the right panel, never typed.
const CAS_FRAME_SHAPES = [{ value: 'standard', label: 'Standard' }, { value: 'arched', label: 'Arched' }];
const CAS_ARCH_SHAPES = [{ value: 'round', label: 'Round' }, { value: 'gothic', label: 'Gothic' }];
const CAS_GOTHIC_PROFILES = [{ value: 'equilateral', label: 'Equilateral' }, { value: 'drop', label: 'Drop' }, { value: 'shallow', label: 'Shallow' }];
const CAS_ARCH_HINGES = [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }];
// v3 Block 3 — FIXED window in the casement batch (Piotr 07.09): the
// casement frame + a non-opening leaf, no hardware. Kind chips + shape chips
// (Rectangle | Round | Gothic | Circle); the circle's height = its diameter.
const CAS_KINDS = [{ value: 'opening', label: 'Opening' }, { value: 'fixed', label: 'Fixed' }];
const CAS_FIX_SHAPES = [{ value: 'rectangle', label: 'Rectangle' }, { value: 'round', label: 'Round' }, { value: 'gothic', label: 'Gothic' }, { value: 'circle', label: 'Circle' }];
const gothicPcShape = (profile) => (profile === 'equilateral' ? 'gothic-equilateral' : 'gothic-drop');
// Saved PC shape → chip: gothic-* → Gothic; semi-circle / three-centre and the v1-era 'segmental' → Round.
const pcArchToUi = (pc) => (isGothicShape(pc) ? 'gothic' : 'round');
// The shared 3D (ArchedCasementWindow) draws the arch from arch.js since
// arched-casement-v2 night 4 (F): it takes the PC shape name, the typed rise,
// the gothic profile, the bar pattern and the two profile arch rules.

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
  const [sashProportion, setSashProportion] = useState('standard');   // cottage (Piotr 09.10.2026)
  const [headType, setHeadType] = useState('flat');
  const [sashFrameShape, setSashFrameShape] = useState('standard');   // v3 Block 1: Standard | Arched
  const [sashArchHB, setSashArchHB] = useState(0);                    // upper sash straight bars (h)
  const [sashArchVB, setSashArchVB] = useState(0);                    // upper sash straight bars (v)
  const [sashLowerHB, setSashLowerHB] = useState(0);                  // lower sash straight bars (h only)
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
  const [casFrameShape, setCasFrameShape] = useState('standard');
  const [casKind, setCasKind] = useState('opening');            // v3 Block 3: 'opening' | 'fixed'
  const [casFixShape, setCasFixShape] = useState('rectangle');  // v3 Block 3: fixed window shape chip
  const [casArchShapeUi, setCasArchShapeUi] = useState('round');
  const [casArchProfile, setCasArchProfile] = useState('equilateral');
  const [casArchStart, setCasArchStart] = useState('');        // mm from the cill (v2 P4)
  const [casArchRiseSource, setCasArchRiseSource] = useState('ratio');
  const [casArchHinge, setCasArchHinge] = useState('left');
  const [casArchPattern, setCasArchPattern] = useState('none'); // bar pattern in the arch (v2 P5)
  const [casArchSpokes, setCasArchSpokes] = useState(5);          // v3 0.4 custom hub: spoke count 3–9
  const [casArchRingsText, setCasArchRingsText] = useState('0.3, 0.6');   // v3 0.4 custom hub: ring fractions of the half width
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

  // Partition wall state (25.10.2026): the keys the window record stores
  // (partition* in projectStore.addWindowToBatch) and specification.js reads.
  const partitionDefaults = getPartitionProfile().defaults || DEFAULT_PARTITION_PROFILE.defaults;
  const [partitionLayout, setPartitionLayout] = useState(partitionDefaults.layout || 'SDS');
  const [partitionDoorWidth, setPartitionDoorWidth] = useState(partitionDefaults.doorWidth || 800);
  const [partitionLights, setPartitionLights] = useState(partitionDefaults.lights || 3);
  const [partitionPanelHeight, setPartitionPanelHeight] = useState(partitionDefaults.panelHeight ?? 790);
  const [partitionHingeSide, setPartitionHingeSide] = useState(partitionDefaults.hingeSide || 'left');
  const [partitionSwing, setPartitionSwing] = useState(partitionDefaults.swing || 'out');

  // Fire door state (27.10.2026): the firedoor* keys the window record stores
  // (FIREDOOR-CONTRACT section 2) and specification.js reads, seeded from the
  // fire door profile defaults. The closer starts null = "follows fire" until
  // the user picks one (v1.1: a kind, resolved to the profile's closerFire /
  // closerNonFire). v1.1: the STRUCTURAL OPENING is the size input (a new door
  // starts at the opening of the profile's default leaf, through the engine's
  // own size rule); the leaf fields are an optional override, empty ('') by
  // default = the engine derives the leaf from the opening. The sizes and the
  // wall depth are free numbers: the chips insert a value, nothing clamps (the
  // engine's sanity limits fail the one door with a message in the summary).
  const fdProfile = getFireDoorProfile() || DEFAULT_FIREDOOR_PROFILE;
  const fdDefaults = fdProfile.defaults || DEFAULT_FIREDOOR_PROFILE.defaults;
  const fdDefaultOpening = fireDoorOpeningForLeaf(fdProfile, Number(fdProfile.leaf?.defaultWidth) || DEFAULT_FIREDOOR_PROFILE.leaf.defaultWidth, Number(fdProfile.leaf?.defaultHeight) || DEFAULT_FIREDOOR_PROFILE.leaf.defaultHeight);
  const [fdFire, setFdFire] = useState(fdDefaults.fire !== false);
  const [fdRating, setFdRating] = useState(fdDefaults.rating === 'FD60' ? 'FD60' : 'FD30');
  const [fdOpeningWidth, setFdOpeningWidth] = useState(fdDefaultOpening.width);
  const [fdOpeningHeight, setFdOpeningHeight] = useState(fdDefaultOpening.height);
  const [fdLeafWidth, setFdLeafWidth] = useState('');
  const [fdLeafHeight, setFdLeafHeight] = useState('');
  const [fdHingeSide, setFdHingeSide] = useState(fdDefaults.hingeSide === 'right' ? 'right' : 'left');
  const [fdFrameDepth, setFdFrameDepth] = useState(Number(fdProfile.frame?.defaultDepth) || DEFAULT_FIREDOOR_PROFILE.frame.defaultDepth);
  const [fdLockType, setFdLockType] = useState(FD_LOCK_LABEL[fdDefaults.lockType] ? fdDefaults.lockType : 'latch');
  const [fdCloser, setFdCloser] = useState(null);
  const [fdVpStyle, setFdVpStyle] = useState(Number(fdDefaults.vpStyle) || 0);
  const [fdVpCustom, setFdVpCustom] = useState({ ...DEFAULT_FIREDOOR_PROFILE.defaults.vpCustom, ...(fdDefaults.vpCustom || {}) });
  const [fdLeadEdge, setFdLeadEdge] = useState(fdDefaults.leadEdge !== false);
  // v1.2 (owner 28.10.2026): the vision panel block (firedoorVp: null = not
  // touched, the engine reads the stored / default Master_Door style above into
  // the type model), the glass (null = by rating) and the strip colour (null =
  // the profile default). The legacy style and custom block stay as stored.
  const [fdVp, setFdVp] = useState(null);
  const [fdGlass, setFdGlass] = useState(null);
  const [fdIntuColour, setFdIntuColour] = useState(null);

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
    setSashProportion(w.sashProportion || 'standard');
    setHeadType(w.headType || 'flat');
    setSashFrameShape(w.frameShape === 'arched' || w.sashType === 'arched-group' ? 'arched' : 'standard');
    setSashArchHB(Number(w.archHBars) || 0);
    setSashArchVB(Number(w.archVBars) || 0);
    setSashLowerHB(Number(w.lowerHBars) || 0);
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
    setCasFrameShape(w.casementType === 'arched' && w.archShape !== 'circle' ? 'arched' : 'standard');
    setCasKind(w.casementKind === 'fixed' ? 'fixed' : 'opening');
    setCasFixShape(w.archShape === 'circle' ? 'circle' : w.casementType === 'arched' ? (isGothicShape(w.archShape) ? 'gothic' : 'round') : 'rectangle');
    setCasArchShapeUi(pcArchToUi(w.archShape));
    setCasArchProfile(w.archShape === 'gothic-drop' ? (w.archProfile === 'shallow' ? 'shallow' : 'drop') : (w.archProfile || 'equilateral'));
    // v2: the arch start from the cill; a v1 window carries archRise only
    // (start = H − rise); a v1-era 'segmental' migrates to Round on the Auto
    // ratio with riseSource 'ratio' (spec v2 P10 / §3 A).
    const wH = Number(w.height) || 0;
    const legacyShape = !!LEGACY_ARCH_SHAPES[w.archShape];
    const startFromRise = w.archRise != null && w.archRise !== '' && wH > 0 ? wH - Number(w.archRise) : null;
    const savedStart = legacyShape ? null : (w.archStart ?? startFromRise);
    setCasArchStart(savedStart != null ? String(savedStart) : '');
    setCasArchRiseSource(legacyShape ? 'ratio' : (w.archRiseSource || (savedStart != null ? 'custom' : 'ratio')));
    setCasArchHinge(w.archHinge === 'right' ? 'right' : 'left');
    setCasArchPattern(w.archBarPattern || 'none');
    setCasArchSpokes(Number(w.archSpokes) || 5);
    setCasArchRingsText(Array.isArray(w.archRings) && w.archRings.length ? w.archRings.join(', ') : '0.3, 0.6');
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
    // the window record stores doorPaneling (save below); paneling is the old / PSW name
    setDoorPaneling(w.doorPaneling || w.paneling || 'flat');
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
    // Partition fields (harmless no-ops for the other categories); a stored
    // panel height of 0 (no panel) is kept, only a missing one takes the default.
    const pd = getPartitionProfile().defaults || DEFAULT_PARTITION_PROFILE.defaults;
    setPartitionLayout(cleanPartitionLayout(w.partitionLayout) || pd.layout || 'SDS');
    setPartitionDoorWidth(Number(w.partitionDoorWidth) || pd.doorWidth || 800);
    setPartitionLights(Number(w.partitionLights) || pd.lights || 3);
    setPartitionPanelHeight(w.partitionPanelHeight != null && w.partitionPanelHeight !== '' ? Math.max(0, Number(w.partitionPanelHeight) || 0) : (pd.panelHeight ?? 790));
    setPartitionHingeSide(w.partitionHingeSide === 'right' ? 'right' : (w.partitionHingeSide === 'left' ? 'left' : (pd.hingeSide || 'left')));
    setPartitionSwing(w.partitionSwing === 'in' ? 'in' : (w.partitionSwing === 'out' ? 'out' : (pd.swing || 'out')));
    // Fire door fields (harmless no-ops for the other categories): the stored
    // firedoor* keys (top level of the window record), else the profile
    // defaults; a stored closer counts as "touched" (it no longer follows fire).
    // v1.1 sizes: the stored opening (firedoorOpeningWidth / Height) fills the
    // opening fields and a stored leaf (> 0) fills the override fields. A v1
    // door stored only its leaf: the opening fields then show the opening that
    // leaf needs (fireDoorOpeningForLeaf, the engine's own rule) so the user
    // sees both; the live derive keeps the leaf as the override. A door with
    // neither starts at the opening of the profile's default leaf.
    const fdp = getFireDoorProfile() || DEFAULT_FIREDOOR_PROFILE;
    const fdd = fdp.defaults || DEFAULT_FIREDOOR_PROFILE.defaults;
    const fdNum = (v, fb) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fb);
    setFdFire(typeof w.firedoorFire === 'boolean' ? w.firedoorFire : (fdd.fire !== false));
    setFdRating(w.firedoorRating === 'FD60' ? 'FD60' : (w.firedoorRating === 'FD30' ? 'FD30' : (fdd.rating === 'FD60' ? 'FD60' : 'FD30')));
    const storedLeafW = fdLeafStore(w.firedoorLeafWidth), storedLeafH = fdLeafStore(w.firedoorLeafHeight);
    const storedOpenW = fdLeafStore(w.firedoorOpeningWidth), storedOpenH = fdLeafStore(w.firedoorOpeningHeight);
    const defLeafW = Number(fdp.leaf?.defaultWidth) || DEFAULT_FIREDOOR_PROFILE.leaf.defaultWidth;
    const defLeafH = Number(fdp.leaf?.defaultHeight) || DEFAULT_FIREDOOR_PROFILE.leaf.defaultHeight;
    const openFromLeaf = fireDoorOpeningForLeaf(fdp, storedLeafW || defLeafW, storedLeafH || defLeafH);
    setFdOpeningWidth(storedOpenW || openFromLeaf.width);
    setFdOpeningHeight(storedOpenH || openFromLeaf.height);
    setFdLeafWidth(storedLeafW || '');
    setFdLeafHeight(storedLeafH || '');
    setFdHingeSide(w.firedoorHingeSide === 'right' ? 'right' : (w.firedoorHingeSide === 'left' ? 'left' : (fdd.hingeSide === 'right' ? 'right' : 'left')));
    setFdFrameDepth(Number(w.firedoorFrameDepth) || Number(fdp.frame?.defaultDepth) || DEFAULT_FIREDOOR_PROFILE.frame.defaultDepth);
    setFdLockType(FD_LOCK_LABEL[w.firedoorLockType] ? w.firedoorLockType : (FD_LOCK_LABEL[fdd.lockType] ? fdd.lockType : 'latch'));
    // the closer kind (v1.1); a v1 boolean maps through the contract's reading (true = built in, false = none)
    setFdCloser(w.firedoorCloser == null ? null : fireDoorCloserKind(w.firedoorCloser, 'none'));
    setFdVpStyle(fdNum(w.firedoorVpStyle, Number(fdd.vpStyle) || 0));
    const vpc = w.firedoorVpCustom && typeof w.firedoorVpCustom === 'object' ? w.firedoorVpCustom : {};
    const vpd = { ...DEFAULT_FIREDOOR_PROFILE.defaults.vpCustom, ...(fdd.vpCustom || {}) };
    setFdVpCustom(Object.fromEntries(Object.keys(vpd).map((k) => [k, fdNum(vpc[k], vpd[k])])));
    setFdLeadEdge(typeof w.firedoorLeadEdge === 'boolean' ? w.firedoorLeadEdge : (fdd.leadEdge !== false));
    // v1.2: the stored panel block (plain keys; null on a v1 / v1.1 door), the glass and the strip colour
    setFdVp(fireDoorVpField(w.firedoorVp));
    setFdGlass(w.firedoorGlass ? String(w.firedoorGlass) : null);
    setFdIntuColour(w.firedoorIntuColour ? String(w.firedoorIntuColour) : null);
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
        // First window in a DOOR batch: start at the door default size rather
        // than the generic 1000×1500 (Piotr 04.08). Only in this branch —
        // copying a previous window must keep that window's size.
        if (batch.type === 'door' || batch.type === 'doors') {
          const dims = DOOR_DIMS[def.doorType] || DOOR_DIMS['single-external'];
          setDoorType(def.doorType || 'single-external');
          setInW(dims.defW);
          setInH(dims.defH);
        }
        // First wall in a PARTITION batch: the owner's reference bay size.
        if (batch.type === 'partition') {
          setInW(PARTITION_CONSTRAINTS.defW);
          setInH(PARTITION_CONSTRAINTS.defH);
        }
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

  // isCasement is also derived below with the other effective values; this
  // early copy exists because the dimension inputs are constrained by it.
  const isCasementBatch = batch?.type === 'casement';
  // Partition walls (25.10.2026): one flag for the form, the 3D sync, the save and the size clamp.
  const isPartition = batch?.type === 'partition';
  // Fire doors (27.10.2026): one flag for the form, the live derive, the 3D sync, the save and the numbering.
  const isFireDoor = batch?.type === 'firedoor';
  // batch.type read directly: `isSash` is declared much later in this component (TDZ crash on render, 06.09)
  const isArchedSash = batch?.type === 'sash' && sashType !== 'triple' && sashFrameShape === 'arched';
  const isArched = (isCasementBatch && casFrameShape === 'arched') || isArchedSash;
  // v3 Block 3: fixed window (kind) and the circle (shape chip; frame shape stays 'standard')
  const isFixedCas = isCasementBatch && casKind === 'fixed';
  const isCircle = isFixedCas && casFixShape === 'circle';
  const archLimits = isArched || isCircle ? ((isArchedSash ? getWindowProfile()?.sashArch?.limits : getCasementProfile()?.arch?.limits) || {}) : null;
  const extW = Number(inW) || 400;
  const extH = isCircle ? extW : (Number(inH) || 400);
  // Sash proportions (cottage, Piotr 09.10.2026): double and triple only, not on an
  // arched sash, cottage from a 900 frame up. The effective value is what the 3D
  // shows and the save stores; leaving the range (arched, or a height committed
  // below 900) sets the choice back to standard.
  const cottageAllowed = !isArchedSash && extH >= COTTAGE_MIN_FRAME_HEIGHT;
  const sashProp = effectiveSashProportion(sashProportion, { frameHeight: extH, arched: isArchedSash });
  // a stored value the engine does not know (e.g. a newer PSW one): said next to the control, not saved, no 3D line from it
  const proportionError = SASH_PROPORTIONS.includes(sashProp) ? null : `Unknown sash proportion "${sashProp}": choose one of the three.`;
  useEffect(() => { if (isArchedSash) setSashProportion('standard'); }, [isArchedSash]);
  // the circle's height is its diameter — the height input follows the width
  useEffect(() => {
    if (isCircle && Number(inH) !== Number(inW)) setInH(Number(inW) || 400);
  }, [isCircle, inW, inH]);
  // the fixed shape chip drives the arch controls: Round / Gothic = the arched casement without a hinge
  const pickFixShape = (v) => {
    setCasFixShape(v);
    if (v === 'round' || v === 'gothic') { setCasFrameShape('arched'); setCasArchShapeUi(v); }
    else setCasFrameShape('standard');
  };

  // ── Arched casement (v2): Round | Gothic, arch start measured from the cill ──
  const isGothicUi = casArchShapeUi === 'gothic';
  const gothicRatio = GOTHIC_PROFILE_RATIO[casArchProfile] || GOTHIC_PROFILE_RATIO.equilateral;
  // Auto start: Round = H − 0.325 × W (PSW elliptical default); Gothic = H − profile ratio × W (always derived)
  const archAutoStart = Math.round(extH - (isGothicUi ? gothicRatio : ROUND_AUTO_RATIO) * extW);
  const archHalfStart = Math.round(extH - extW / 2);           // semi-circle: rise = W/2
  const minStraight = archLimits?.minStraightBelowRise || 900;
  const dimConstraints = isCircle
    ? { minW: archLimits.minWidth || 400, maxW: archLimits.maxWidth || 1500, minH: archLimits.minWidth || 400, maxH: archLimits.maxWidth || 1500 }
    : isArched
    ? {
        minW: archLimits.minWidth || 400, maxW: archLimits.maxWidth || 1500,
        // Gothic: the start is derived, so the height must leave the straight part
        // below the rise; Round: the typed start carries the rule (start >= 900),
        // the height only needs to clear it — arch.js reports the rest as text.
        minH: Math.max(CASEMENT_CONSTRAINTS.minH, isGothicUi ? Math.round(gothicRatio * extW + minStraight) : minStraight + 1),
        maxH: CASEMENT_CONSTRAINTS.maxH,
      }
    : isPartition
    ? PARTITION_CONSTRAINTS
    : isCasementBatch
      ? CASEMENT_CONSTRAINTS
      : (sashType === 'triple' ? TRIPLE_CONSTRAINTS : DOUBLE_CONSTRAINTS);
  useEffect(() => {
    if (!isArched) return;
    // Gothic: the start is always derived. Round on Auto: start follows W and H;
    // a typed (custom) start is kept when H changes — the rise recomputes.
    if (isGothicUi) {
      if (casArchRiseSource !== 'ratio') setCasArchRiseSource('ratio');
      setCasArchStart(String(archAutoStart));
    } else if (casArchRiseSource === 'ratio') {
      setCasArchStart(String(archAutoStart));
    }
  }, [isArched, isGothicUi, casArchRiseSource, archAutoStart]);
  const archStartNum = Number(casArchStart) || 0;
  const archRiseNum = archStartNum > 0 ? extH - archStartNum : 0;
  // Resolved engine shape — Round: semi-circle at exactly half the width, three-centre below, error above (use Gothic)
  const archShapeResolved = useMemo(() => {
    if (!isArched) return { shape: null, error: null };
    if (isGothicUi) return { shape: gothicPcShape(casArchProfile), error: null };
    if (!(archRiseNum > 0)) return { shape: null, error: 'Arch start must be below the frame height' };
    try { return { shape: resolveRoundShape(extW, archRiseNum), error: null }; }
    catch (e) { return { shape: null, error: e?.message || String(e) }; }
  }, [isArched, isGothicUi, casArchProfile, extW, archRiseNum]);
  const pcArchShape = archShapeResolved.shape;
  const archPatterns = isCircle ? PATTERNS_FOR_SHAPE.circle : (PATTERNS_FOR_SHAPE[pcArchShape] || PATTERNS_FOR_SHAPE['three-centre']);   // frozen arrays: stable effect deps
  // v3 0.4 custom hub: ring list parsed once (fractions 0 < k < 1, sorted); saved only while the pattern is custom
  const casArchRings = useMemo(() => String(casArchRingsText).split(/[,\s]+/).map(Number).filter((k) => k > 0 && k < 1).sort((a, b) => a - b), [casArchRingsText]);
  const isCustomHub = isArched && casArchPattern === 'custom';
  useEffect(() => {
    // a pattern the resolved shape does not offer (e.g. a hub on a three-centre) falls back to none
    if ((isArched || isCircle) && !archPatterns.includes(casArchPattern)) setCasArchPattern('none');
  }, [isArched, isCircle, archPatterns, casArchPattern]);
  const archPlan = useMemo(() => {
    if (!isArched) return null;
    if (archShapeResolved.error) return { error: archShapeResolved.error };
    try {
      if (isArchedSash) {
        // sash: geometry from the sash profile (head 80, stile line), blank plans from the casement arch block
        const SA = buildSashArchGeometry({ shape: pcArchShape, width: extW, height: extH, rise: archRiseNum }, getWindowProfile(), CONSTANTS.GLASS_REBATE);
        const cp = getCasementProfile();
        const plans = { frameHead: planArchSegments(SA.head, cp.arch, cp.cnc), leafTop: planArchSegments(SA.topRail, cp.arch, cp.cnc) };
        return { ...SA, frameHead: SA.head, leafTop: SA.topRail, plans, noStock: plans.frameHead.noStock || plans.leafTop.noStock };
      }
      return buildArchPlan({ shape: pcArchShape, width: extW, height: extH, rise: archRiseNum, hinge: casArchHinge }, getCasementProfile());
    } catch (e) {
      return { error: e?.message || String(e) };
    }
  }, [isArched, isArchedSash, archShapeResolved, pcArchShape, extW, extH, archRiseNum, casArchHinge]);
  // v3 Block 3: circle plan (frame ring + leaf ring on the profile faces) — errors block the save like an arch
  const circlePlan = useMemo(() => {
    if (!isCircle) return null;
    try { return buildCirclePlan({ width: extW, height: extW }, getCasementProfile()); }
    catch (e) { return { error: e?.message || String(e) }; }
  }, [isCircle, extW]);
  const archError = archPlan?.error || circlePlan?.error || null;
  const shapeBlocked = (isArched || isCircle) && !!archError;
  // Radii are results: "R 150 / 1400 / 150" (three-centre), "R 500" (semi-circle), "R 1000" (gothic, both arcs equal)
  const archRadiiText = (() => {
    if (!archPlan || archPlan.error) return '—';
    const radii = (archPlan.arcs || []).map((a) => Math.round(a.r));
    return new Set(radii).size === 1 ? `R ${radii[0]}` : `R ${radii.join(' / ')}`;
  })();
  const archPlanRow = (member) => {
    const m = archPlan?.plans?.[member];
    const ring = archPlan?.[member];
    if (!m || !ring) return '—';
    // every arc: one radius for a semi-circle, three for a three-centre, two for a gothic
    const radii = (ring.outer || []).map((a) => Math.round(a.r)).join(' / ');
    const parts = (m.arcs || []).map((a) => a.default ? `${a.default.n} × ${a.default.stock}` : '?').join(' + ');
    return `R ${radii} · ${parts}`;
  };

  // ─── Effective values ───
  const isSingle = colourMode === 'single';
  const hasGasFill = glassType !== 'single' && glassType !== 'passive'; // sealed units only
  // Doors (08.10.2026): the door frame is 93 deep from the door profile, not a
  // sash box depth (brief 6.1); the batch type check is repeated here because
  // isDoor is declared below.
  const frameDepth = (batch?.type === 'door' || batch?.type === 'doors')
    ? (Number(getDoorProfile().frameDepth) || DEFAULT_DOOR_PROFILE.frameDepth)
    // a partition wall: the member depth of the partition profile (54)
    : batch?.type === 'partition'
    ? (Number(getPartitionProfile().depth) || DEFAULT_PARTITION_PROFILE.depth)
    // a fire door (27.10.2026): the wall thickness the user typed is the frame depth; the profile default when blank
    : batch?.type === 'firedoor'
    ? (Number(fdFrameDepth) || Number(getFireDoorProfile().frame?.defaultDepth) || DEFAULT_FIREDOOR_PROFILE.frame.defaultDepth)
    : (FRAME_DEPTHS[frameType] || 164);
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
  // Partition walls: the layout as the engine reads it (S and D only, at least one bay)
  const partitionLayoutClean = cleanPartitionLayout(partitionLayout) || 'S';
  const partitionHasDoor = partitionLayoutClean.includes('D');
  const partitionScreens = partitionLayoutClean.split('').filter((c) => c === 'S').length;
  const partitionDoors = partitionLayoutClean.length - partitionScreens;
  // Doors v3 (09.10.2026): W is the overall frame and the side panel zones sit
  // inside it, so the PSW door width limits apply to the door field (W less
  // the side zones); the height limits stay on H.
  const doorSideW = (sidePanels === 'left' || sidePanels === 'both' ? Number(sideLeftW) || 0 : 0)
    + (sidePanels === 'right' || sidePanels === 'both' ? Number(sideRightW) || 0 : 0);
  const doorFieldW = extW - doorSideW;

  // ── Fire door live derive (27.10.2026): the engine on the fields exactly as
  // the save stores them. Every number the form, the summary and the 3D print
  // comes from here or the profile (rule 7). A FireDoorGeometryError (a leaf
  // outside the sanity limits, a head joint the engine does not cut) blocks
  // the Save with its message in the summary; nothing is ever clamped.
  // v1.1: the closer kind follows fire (closerFire / closerNonFire of the
  // profile defaults) until picked; an empty leaf field is stored as 0 so the
  // engine derives the leaf from the structural opening.
  const fdCloserEff = fdCloser == null
    ? fireDoorCloserKind(fdFire ? fdDefaults.closerFire : fdDefaults.closerNonFire, 'none')
    : fdCloser;
  // the opening chips (v1.1): the profile's leaf suggestions turned into the
  // opening each needs by the engine's own size rule ("912 (leaf 826)"), the
  // height chip from the profile's height suggestion the same way
  const fdOpeningChips = useMemo(() => {
    const widths = fdProfile.leaf?.widthSuggestions || DEFAULT_FIREDOOR_PROFILE.leaf.widthSuggestions;
    const hSug = Number(fdProfile.leaf?.heightSuggestion) || DEFAULT_FIREDOOR_PROFILE.leaf.heightSuggestion;
    const hOpen = fireDoorOpeningForLeaf(fdProfile, widths[0] || DEFAULT_FIREDOOR_PROFILE.leaf.defaultWidth, hSug).height;
    return {
      widths: widths.map((w) => { const o = fireDoorOpeningForLeaf(fdProfile, w, hSug); return { value: o.width, label: `${o.width} (leaf ${w})` }; }),
      heights: [{ value: hOpen, label: `${hOpen} (leaf ${hSug})` }],
    };
  }, [fdProfile]);
  // v1.2: the vision panel types (the chips), the three glasses and the strip colours, all from the profile
  const fdVpTypes = fdProfile.vp?.types || DEFAULT_FIREDOOR_PROFILE.vp.types;
  const fdGlassTypes = fdProfile.vp?.glass?.types || DEFAULT_FIREDOOR_PROFILE.vp.glass.types;
  const fdIntuColours = fdProfile.intumescent?.colours || DEFAULT_FIREDOOR_PROFILE.intumescent.colours;
  const fdItem = useMemo(() => (isFireDoor ? {
    windowCategory: 'firedoor',
    firedoorFire: fdFire, firedoorRating: fdRating,
    firedoorOpeningWidth: fdLeafStore(fdOpeningWidth), firedoorOpeningHeight: fdLeafStore(fdOpeningHeight),
    firedoorLeafWidth: fdLeafStore(fdLeafWidth), firedoorLeafHeight: fdLeafStore(fdLeafHeight),
    firedoorHingeSide: fdHingeSide, firedoorFrameDepth: Number(fdFrameDepth),
    firedoorLockType: fdLockType, firedoorCloser: fdCloserEff,
    firedoorVpStyle: Number(fdVpStyle), firedoorVpCustom: { ...fdVpCustom },
    firedoorLeadEdge: fdLeadEdge,
    // v1.2: null = not set (the engine reads the legacy style / the rating / the profile default)
    firedoorVp: fdVp ? { ...fdVp } : null, firedoorGlass: fdGlass, firedoorIntuColour: fdIntuColour,
    ventRoomType: 'other', pas24: false, childRestrictor: false,
  } : null), [isFireDoor, fdFire, fdRating, fdOpeningWidth, fdOpeningHeight, fdLeafWidth, fdLeafHeight, fdHingeSide, fdFrameDepth, fdLockType, fdCloserEff, fdVpStyle, fdVpCustom, fdLeadEdge, fdVp, fdGlass, fdIntuColour]);
  const fdLive = useMemo(() => {
    if (!fdItem) return null;
    try {
      // the stored width / height are the frame overall the engine derives; the opening stands in until it has
      const ws = normaliseToWindowSpec({
        id: 'configurator', name: winName || 'FD', width: fdItem.firedoorOpeningWidth, height: fdItem.firedoorOpeningHeight,
        ...fdItem,
        glassType, glassSpec, glassCoating, glassGas, glassFinish: gFin, frostedLocation: frostLoc,
        woodColor, woodColorExt: isSingle ? woodColor : woodColorExt, woodColorInt: isSingle ? woodColor : woodColorInt,
        colourMode, ironmongery: iron, ironmongerySlots: ironSlots,
      });
      const derived = deriveWindowData(ws, tenantSettings);
      if (!derived?.firedoor?.frame?.overall) throw new Error('The engine returned no fire door data');
      return { ws, derived, error: null, geometry: false };
    } catch (e) {
      return { ws: null, derived: null, error: e?.message || String(e), geometry: e instanceof FireDoorGeometryError };
    }
  }, [fdItem, winName, glassType, glassSpec, glassCoating, glassGas, gFin, frostLoc, woodColor, woodColorExt, woodColorInt, isSingle, colourMode, iron, ironSlots, tenantSettings]);
  const fd = fdLive?.derived?.firedoor || null;
  const fdOverall = fd?.frame?.overall || null;
  const fdBlocked = isFireDoor && !fdOverall;
  // v1.2: the vision panel the editor shows = the door's own block, else the
  // engine's reading of the door (fd.inputs.vp: a v1 / v1.1 door's style read
  // into the type model); without a derive the engine helper reads the same.
  // Every edit writes the WHOLE block (the eleven keys, from what is shown).
  const fdVpView = useMemo(() => {
    if (!isFireDoor) return null;
    if (fdVp) return fdVp;
    if (fd?.inputs?.vp) return fd.inputs.vp;
    try { return fireDoorVpInput(fdProfile.vp || DEFAULT_FIREDOOR_PROFILE.vp, null, fdVpStyle, fdVpCustom); } catch { return null; }
  }, [isFireDoor, fdVp, fd, fdProfile, fdVpStyle, fdVpCustom]);
  const patchFdVp = (patch) => {
    const base = fdVpView || {};
    const next = Object.fromEntries(FD_VP_KEYS.map((k) => [k, k in patch ? patch[k] : (base[k] ?? null)]));
    // a legacy two-size style (style 2) carries its pane sizes; the engine keeps them only while the size is unchanged
    if (Array.isArray(base.paneSizes) && base.paneSizes.length) next.paneSizes = base.paneSizes;
    setFdVp(next);
  };

  // ── Fire door numbering (brief 3.2): FDR-01 / DR-01, counted per prefix over
  // every window of every batch of the project. Proposed on a NEW door while
  // the name is empty or still the last proposal, re-proposed when `fire` flips
  // (the prefix changes), never on a saved door (edit mode), always overwritable.
  const fdAutoName = useMemo(() => {
    if (!isFireDoor) return '';
    const names = (project?.batches || []).flatMap((b) => b.windows || []).map((w) => w?.name).filter(Boolean);
    try { return nextFireDoorName(names, fdFire) || ''; } catch { return ''; }
  }, [isFireDoor, project, fdFire]);
  const fdAutoNameRef = useRef('');
  useEffect(() => {
    if (!isFireDoor || isEditMode || !prefilled || !fdAutoName) return;
    // the updater runs at the next render: compare against the proposal captured now, not the ref after the swap
    const prevProposal = fdAutoNameRef.current;
    fdAutoNameRef.current = fdAutoName;
    setWinName((cur) => (String(cur || '').trim() === '' || cur === prevProposal ? fdAutoName : cur));
  }, [isFireDoor, isEditMode, prefilled, fdAutoName]);

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
    if (isFireDoor) {
      // Fire doors (27.10.2026): the 3D draws the door set from the engine's
      // geometry (fireDoorGeometryFromSpec, FIREDOOR-CONTRACT section 7); the
      // category alone keeps the sash model off the door data.
      let fireDoorGeo = null;
      try { fireDoorGeo = fdLive?.derived ? fireDoorGeometryFromSpec(fdLive.ws, fdLive.derived) : null; } catch { fireDoorGeo = null; }
      window.update3D({
        windowCategory: 'firedoor',
        extWidth: fdOverall?.width ?? fdLeafStore(fdOpeningWidth), extHeight: fdOverall?.height ?? fdLeafStore(fdOpeningHeight),
        woodColor, woodColorExt: isSingle ? woodColor : woodColorExt,
        woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
        doubleGlazing: false, spacerColor, glassFinish: gFin, ironmongery: iron,
        fireDoorGeo, fireDoorOpen: FD_3D_OPEN_DEG,
      });
      return;
    }
    if (isPartition) {
      // Partition walls (25.10.2026): no 3D model yet. The category alone makes
      // the 3D App draw nothing (never the sash model on wall data).
      window.update3D({
        windowCategory: 'partition', extWidth: extW, extHeight: extH,
        woodColor, woodColorExt: woodColor, woodColorInt: woodColor, sameColor: true,
        doubleGlazing: true, spacerColor, glassFinish: gFin, ironmongery: iron,
      });
      return;
    }
    if (isDoor) {
      // Flat door keys — the 3D App was ported from PSW and reads them directly.
      window.update3D({
        windowCategory: 'door', extWidth: extW, extHeight: extH,
        frameDims: doorFrameDims(),   // v4 Block F: door frame face / land from the profile
        doorType, doorShape, doorStyle, paneling: doorPaneling,
        // French leaves ALWAYS meet on a rebate — never a centre mullion
        // (Piotr 09.08). Field kept false for PSW import parity.
        centerMullion: false,
        doorHinge: hingeSide, doorOpenDirection: openDirection,
        doorHBars: doorHB, doorVBars: doorVB,
        sidePanels, sideLeftWidth: sideLeftW, sideRightWidth: sideRightW,
        sideStyle, sideHBars: sideHB, sideVBars: sideVB,
        // Transom is a french-only feature; force it off for single doors so a
        // leftover value cannot silently render a fanlight.
        transomType: isFrench ? transomType : 'none',
        transomHeight, transomBars: isFrench ? transomBars : 'none',
        thresholdType: threshold, thresholdExtension: thresholdExt,
        // Doors to production (08.10.2026): the 3D draws the door from the
        // engine's door geometry (leaf sizes, members, glass, panel, hinges,
        // fanlight), derived from the same keys the Save below stores.
        doorGeo: (() => {
          try {
            return doorGeometryFromSpec(normaliseToWindowSpec(
              { id: 'configurator', name: 'door', width: extW, height: extH },
              { fullConfig: {
                windowCategory: 'door', extWidth: extW, extHeight: extH,
                glassType, glassSpec, glassCoating, glassGas, glassFinish: gFin, frostedLocation: frostLoc,
                spacerColor, spacerType, sealColour,
                doorType, doorShape, doorStyle, doorPaneling, centerMullion: false,
                doorHinge: hingeSide, doorOpenDirection: openDirection, lockType, doorBarType,
                doorHBars: doorHB, doorVBars: doorVB,
                sidePanels, sideLeftWidth: sideLeftW, sideRightWidth: sideRightW,
                sideStyle, sideHBars: sideHB, sideVBars: sideVB,
                transomType: isFrench ? transomType : 'none',
                transomHeight, transomBars: isFrench ? transomBars : 'none',
                thresholdType: threshold, thresholdExtension: thresholdExt,
              } },
            ));
          } catch { return null; }
        })(),
        doorOpening: 0,
        woodColor, woodColorExt: isSingle ? woodColor : woodColorExt,
        woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
        doubleGlazing: glassType !== 'triple', spacerColor,
        glassFinish: gFin,
        sealColour, sillExtension: sillExt, sillWider, ironmongery: iron,
      });
      return;
    }
    if (isCircle) {
      // circle fixed window: PSW's fix-frame viewer (FixFrameWindow circle branch, shared 1:1)
      window.update3D({
        windowCategory: 'fix-only', extWidth: extW, extHeight: extW,
        fixShape: 'circle', fixType: 'standard',
        fixCircleBarPattern: casArchPattern === 'sunburst' ? 'sunburst' : 'none',
        fixCircleBarOffset: getCasementProfile().arch?.patterns?.sunburst?.offset || 200,
        casementHBars: casHB, casementVBars: casVB,
        woodColor, woodColorExt: isSingle ? woodColor : woodColorExt,
        woodColorInt: isSingle ? woodColor : woodColorInt, sameColor: isSingle,
        doubleGlazing: glassType !== 'triple', spacerColor,
        glassFinish: gFin,
      });
      return;
    }
    if (isCasement) {
      window.update3D({
        windowCategory: 'casement', extWidth: extW, extHeight: extH,
        // v3 Block 3: fixed leaf — no handle, opening locked, the single pane fixed
        fixedLeaf: isFixedCas,
        // 3D reads casArchShape / casArchHinge (archShape below is the PC field);
        // the component accepts the PC shape names and draws the typed rise (F)
        casArchShape: isArched ? pcArchShape : 'semi-circle',
        casArchHinge: isArched ? casArchHinge : 'left',
        barPattern: isArched ? casArchPattern : 'none',
        archSpokes: isCustomHub ? casArchSpokes : null,
        archRings: isCustomHub ? casArchRings : null,
        archMinHaunchRadius: getCasementProfile().arch.minHaunchRadius,
        archPatterns: getCasementProfile().arch.patterns,
        frameDims: casementFrameDims(),   // v4 Block F: frame face / land from the profile
        casementLayout: isFixedCas ? '040L' : isArched ? (casArchHinge === 'right' ? '040R' : '040L') : casLayout,
        casementHinges: isFixedCas ? ['fixed'] : isArched ? null : (casHinges ? [...casHinges] : null),
        // Arched casement (PC-native fields read by specification.js archFromSpec).
        casementType: isArched && !isArchedSash ? 'arched' : 'standard',
        // arched sash (v3 Block 1 I): the 3D's arched branch takes PC's shape + the real rise
        ...(isArchedSash ? { sashType: 'arched', archHBars: sashArchHB, archVBars: isHubPattern(casArchPattern) ? 0 : sashArchVB, lowerHBars: sashLowerHB } : {}),
        archShape: isCircle ? 'circle' : isArched ? pcArchShape : null,
        archProfile: isArched && isGothicUi ? casArchProfile : null,
        archStart: isArched ? archStartNum : null,
        archRise: isArched ? archRiseNum : null,
        archRiseSource: isArched ? casArchRiseSource : null,
        archHinge: isArched ? casArchHinge : null,
        archBarPattern: isArched || isCircle ? casArchPattern : null,
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
      // the meeting line where production puts it (engine helper, every sash window)
      sashProportion: sashProp, meetingFraction: proportionError ? undefined : meetingFractionFor(extH, sashProp),
      boxType: frameType === 'slim' ? 'slim' : 'standard', boxDepth: frameDepth,
    });
  }, [extW, extH, uBars, effectiveLBars, sameBars, uCustom, lCustom, horn, woodColor, woodColorExt, woodColorInt, isSingle, iron, gFin, frostLoc, glassType, spacerColor, sashType, splitRatio, sashProp, proportionError, headType, opening, frameType, frameDepth, batch?.type, isCasement, casLayout, casHinges, isArched, isFixedCas, isCircle, pcArchShape, isGothicUi, casArchProfile, casArchRiseSource, archStartNum, archRiseNum, casArchHinge, casArchPattern, isCustomHub, casArchSpokes, casArchRings, isArchedSash, sashArchHB, sashArchVB, sashLowerHB, casCalc, casHB, casVB, casFanHB, casFanVB, casFan2HB, casFan2VB, sillExt, sillWider, sealColour, ventRoomType, ventSoleWindow, isDoor, isFrench, doorType, doorShape, doorStyle, doorPaneling, doorHB, doorVB, sidePanels, sideLeftW, sideRightW, sideStyle, sideHB, sideVB, transomType, transomHeight, transomBars, hingeSide, openDirection, threshold, thresholdExt, lockType, doorBarType, glassSpec, glassCoating, glassGas, spacerType, isPartition, isFireDoor, fdLive, fdOverall, fdOpeningWidth, fdOpeningHeight]);
  useEffect(() => { sync(); }, [sync]);

  // ─── B4: Listen for 3D ready event and re-sync ───
  useEffect(() => {
    const handler = () => sync();
    window.addEventListener('3d-ready', handler);
    return () => window.removeEventListener('3d-ready', handler);
  }, [sync]);

  // ─── Save ───
  const save = () => {
    if (isSash && proportionError) return;   // an unknown stored proportion: said next to the control, never saved
    if (fdBlocked) return;                   // a fire door the engine refused: its message sits in the summary, nothing is saved
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
      spacerColor, spacerType, sashType, splitRatio, sashProportion: sashProp, headType, openingType: opening,
      ventRoomType, ventSoleWindow,
      frameType, frameDepth, pas24, childRestrictor,
      ...(isCasement ? {
        casementLayout: isFixedCas ? '040L' : isArched ? (casArchHinge === 'right' ? '040R' : '040L') : casLayout,
        casementHinges: isFixedCas ? null : isArched ? null : (casHinges ? [...casHinges] : null),
        // v3 Block 3: fixed window in the casement batch; the circle is archShape 'circle' (no casementType)
        casementKind: isFixedCas ? 'fixed' : 'opening',
        // Arched casement (PC-native fields read by specification.js archFromSpec).
        casementType: isArched && !isArchedSash ? 'arched' : 'standard',
        // arched sash (v3 Block 1): frame shape + straight bar counts in the PSW names
        frameShape: isArchedSash ? 'arched' : 'standard',
        archHBars: isArchedSash ? sashArchHB : null,
        archVBars: isArchedSash ? (isHubPattern(casArchPattern) ? 0 : sashArchVB) : null,
        lowerHBars: isArchedSash ? sashLowerHB : null,
        archShape: isCircle ? 'circle' : isArched ? pcArchShape : null,
        archProfile: isArched && isGothicUi ? casArchProfile : null,
        // v2: the start from the cill is what the joiner typed; archRise = H − start is kept for compatibility
        archStart: isArched ? archStartNum : null,
        archRise: isArched ? archRiseNum : null,
        archRiseSource: isArched ? casArchRiseSource : null,
        archHinge: isArched ? casArchHinge : null,
        archBarPattern: isArched || isCircle ? casArchPattern : null,
        archSpokes: isCustomHub ? casArchSpokes : null,
        archRings: isCustomHub ? casArchRings : null,
        fanlightAxis: casCalc.hasFan ? casCalc.fanEff : null,
        fan2Axis: casCalc.hasFan2 ? casCalc.fan2Eff : null,
        casementMiddleWidth: casCalc.isTriple ? casCalc.midEff : 0,
        casementHBars: casHB, casementVBars: casVB,
        casementFanHBars: Math.min(2, casFanHB), casementFanVBars: Math.min(2, casFanVB),
        casementFan2HBars: Math.min(2, casFan2HB), casementFan2VBars: Math.min(2, casFan2VB),
      } : {}),
      ...(isDoor ? {
        doorType, doorShape, doorStyle, doorPaneling, centerMullion: false,
        doorHinge: hingeSide, doorOpenDirection: openDirection, lockType, doorBarType,
        doorHBars: doorHB, doorVBars: doorVB,
        sidePanels, sideLeftWidth: sideLeftW, sideRightWidth: sideRightW,
        sideStyle, sideHBars: sideHB, sideVBars: sideVB,
        transomType: isFrench ? transomType : 'none',
        transomHeight, transomBars: isFrench ? transomBars : 'none',
        thresholdType: threshold, thresholdExtension: thresholdExt,
      } : {}),
      // Partition walls (25.10.2026): the layout string and the wall numbers;
      // the door width only when the layout has a door. No trickle vents and no
      // PAS24 on an internal wall, whatever the hidden sections still hold.
      ...(isPartition ? {
        partitionLayout: partitionLayoutClean,
        partitionDoorWidth, partitionLights, partitionPanelHeight, partitionHingeSide, partitionSwing,
        ventRoomType: 'other', pas24: false, childRestrictor: false,
      } : {}),
      // Fire doors (27.10.2026): the firedoor* keys of the contract (fdItem, the
      // same object the live derive ran on) and the stored width / height = the
      // FRAME OVERALL the engine derived from the leaf. No trickle vents, no
      // PAS24, no restrictor on an internal door.
      ...(isFireDoor && fdItem && fdOverall ? {
        ...fdItem,
        extWidth: fdOverall.width, extHeight: fdOverall.height, inputWidth: fdOverall.width, inputHeight: fdOverall.height,
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
  // alsoFor: a partition wall takes the door hinge / handle slots (ironmongeryStore); an internal wall has no trickle vents
  // a fire door (27.10.2026) takes its own slots (windowType 'firedoor') and the door hinge / handle / cylinder slots that list it in alsoFor; no trickle vents on an internal door
  const slotCategories = IRONMONGERY_CATEGORIES.filter(c => (c.windowType === slotType || (c.windowType === 'all' && slotType !== 'partition' && slotType !== 'firedoor') || (c.alsoFor || []).includes(slotType)) && c.slot !== false);
  const getSlotItem = (key) => ironItems.find(m => m.id === ironSlots[key]) || null;

  // Format custom bars for spec panel
  const formatBars = (bars) => bars.map(b => `${b.type.toUpperCase()}:${b.mm}`).join(', ');

  // Arch shape / start controls shared by the arched casement and the arched sash (v3 Block 1 B)
  const archControls = isArched ? (<>
              <Lbl>Arch shape</Lbl><HChips o={CAS_ARCH_SHAPES} v={casArchShapeUi} c={setCasArchShapeUi} />
              {isGothicUi && <>
                <Lbl>Gothic profile</Lbl><HChips o={CAS_GOTHIC_PROFILES} v={casArchProfile} c={setCasArchProfile} />
              </>}
              <Lbl>Arch starts at (mm from cill)</Lbl>
              <div className="flex items-center gap-2 mb-1">
                <NumInput
                  value={casArchStart}
                  disabled={isGothicUi}
                  onCommit={(v) => {
                    const n = Number(v);
                    if (Number.isFinite(n) && n > 0) { setCasArchStart(String(Math.round(n))); setCasArchRiseSource('custom'); }
                  }}
                  className="w-24 px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-sm disabled:opacity-50"
                />
                {!isGothicUi && <>
                  <button
                    type="button"
                    onClick={() => { setCasArchRiseSource('ratio'); setCasArchStart(String(archAutoStart)); }}
                    title={`H − ${ROUND_AUTO_RATIO} × W = ${archAutoStart}`}
                    className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${casArchRiseSource === 'ratio' ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCasArchRiseSource('custom'); setCasArchStart(String(archHalfStart)); }}
                    title={`H − W/2 = ${archHalfStart} (semi-circle)`}
                    className="px-2.5 py-1 text-[11px] rounded-lg border transition-all border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500"
                  >
                    Half
                  </button>
                </>}
              </div>
              <div className="text-[11px] text-ink-500 mb-1">
                {isGothicUi
                  ? `Start is derived: H − ${gothicRatio.toFixed(3)} × W (${casArchProfile}).`
                  : 'Auto = H − 0.325 × W. Half = H − W/2 (semi-circle). Typing a value switches to custom and stays put when H changes; below half the width the arch is a three-centre, above it use Gothic.'}
              </div>
              <div className="text-[11px] text-ink-300 mb-2">
                Rise <span className="text-accent-400 font-medium">{archRiseNum}</span> · <span className="text-accent-400 font-medium">{archRadiiText}</span>
                {!isGothicUi && pcArchShape && <span className="text-ink-500"> · {pcArchShape}</span>}
              </div>
  </>) : null;

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
          {isFireDoor ? (
            // fire door: Save waits for the engine (a refused size keeps its message in the summary, nothing is saved)
            <button
              onClick={save}
              disabled={fdBlocked}
              title={fdBlocked ? `Fire door: ${fdLive?.error || 'not derived'}` : undefined}
              className={`btn ${isEditMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'btn-primary'} ${fdBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isEditMode ? '✓ Update Window' : '✓ Save to Batch'}
            </button>
          ) : (
          <button
            onClick={save}
            disabled={shapeBlocked}
            title={shapeBlocked ? `${isCircle ? 'Circle' : 'Arch'}: ${archError}` : (isSash && proportionError) || undefined}
            className={`btn ${isEditMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'btn-primary'} ${shapeBlocked || (isSash && proportionError) ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {isEditMode ? '✓ Update Window' : '✓ Save to Batch'}
          </button>
          )}
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
            <Lbl>Kind</Lbl><HChips o={CAS_KINDS} v={casKind} c={(v) => { setCasKind(v); if (v === 'fixed') pickFixShape(casFixShape); else { setCasFrameShape('standard'); } }} />
            {isFixedCas && <>
              <Lbl>Shape</Lbl><HChips o={CAS_FIX_SHAPES} v={casFixShape} c={pickFixShape} />
              {isCircle && (
                <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 mt-1 mb-2">
                  Circle: the height equals the diameter (width). Frame ring {getCasementProfile()?.elements?.frameHead?.face}, leaf ring inside it — both finger-jointed blanks.
                  Diameter {dimConstraints.minW}–{dimConstraints.maxW}.
                  {circlePlan && !circlePlan.error && <> Radii <span className="text-accent-400 font-medium">R {Math.round(circlePlan.frameHead.outer[0].r)} / {Math.round(circlePlan.frameHead.inner[0].r)} · leaf R {Math.round(circlePlan.leafTop.outer[0].r)} / {Math.round(circlePlan.leafTop.inner[0].r)}</span></>}
                </div>
              )}
              {!isCircle && (
                <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 mt-1 mb-2">
                  Fixed leaf: the casement frame + a non-opening leaf (same members), no hinges, no handle.
                </div>
              )}
            </>}
            {!isFixedCas && <>
              <Lbl>Frame shape</Lbl><HChips o={CAS_FRAME_SHAPES} v={casFrameShape} c={setCasFrameShape} />
            </>}
            {!isArched && !isFixedCas && (
              <CasementLayoutPicker
                layout={casLayout}
                casementHinges={casHinges}
                dims={{ w: extW, h: extH, fanMm: casCalc.fanEff, fan2Mm: casCalc.fan2Eff, middleMm: casCalc.midEff }}
                onApply={applyCasementLayout}
              />
            )}
            {isArched && <>
              {archControls}
              {!isFixedCas && <><Lbl>Hinge side</Lbl><HChips o={CAS_ARCH_HINGES} v={casArchHinge} c={setCasArchHinge} /></>}
              <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 mt-1">
                Single leaf. Lights, layout card and fanlight bars are hidden while Arched is on.
                Width {dimConstraints.minW}–{dimConstraints.maxW}, arch start at least {minStraight} from the cill.
              </div>
            </>}
          </Sec>}

          {isSash && <Sec t="Sash Type">
            <HChips o={SASH_TYPES} v={sashType} c={setSashType} />
            {sashType === 'triple' && <select value={splitRatio} onChange={e => setSplitRatio(e.target.value)} className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2">{SPLIT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}
            {!isArchedSash && <>
              <Lbl>Sash proportions</Lbl>
              <HChips o={SASH_PROPORTION_OPTIONS} v={sashProp} c={setSashProportion} disabled={(x) => x.value !== 'standard' && !cottageAllowed} />
              {!cottageAllowed && <div className="text-[10px] text-ink-400 -mt-1 mb-2">Cottage needs a frame height of {COTTAGE_MIN_FRAME_HEIGHT} mm or more.</div>}
              {proportionError && <div className="text-[11px] text-red-400 -mt-1 mb-2">{proportionError}</div>}
            </>}
            <Lbl>Head</Lbl><HChips o={HEAD_TYPES} v={headType} c={setHeadType} />
            {sashType !== 'triple' && <>
              <Lbl>Frame shape</Lbl><HChips o={SASH_FRAME_SHAPES} v={sashFrameShape} c={setSashFrameShape} />
              {isArchedSash && <>
                {archControls}
                <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 mt-1">
                  Arched box head {getWindowProfile()?.sashArch?.headFace} deep, upper sash with an arched top rail; the lower sash stops at the arch start.
                  Width {dimConstraints.minW}–{dimConstraints.maxW}, arch start at least {minStraight} from the cill, upper straight stile (H/2 − rise) at least {archLimits?.minUpperStile || 100}.
                </div>
              </>}
            </>}
          </Sec>}

          {isSash && <Sec t="Frame">
            <HChips o={FRAME_OPTIONS} v={frameType} c={changeFrame} />
            <div className="text-[11px] text-ink-300">
              Box depth: <span className="text-accent-400 font-medium">{frameDepth}mm</span>
              {frameType !== 'heritage' && <> · Glass: <span className="text-accent-400 font-medium">{glassLabel(glassType)}</span></>}
            </div>
          </Sec>}

          {/* a fire door (27.10.2026) has no typed frame size: the leaf is typed in its own section and the frame overall is derived */}
          {!isFireDoor && <Sec t={isPartition ? 'Dimensions (Wall)' : 'Dimensions (Frame)'}>
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
                  onBlur={e => { const v = Number(e.target.value); const nv = isNaN(v) || v < dimConstraints.minH ? dimConstraints.minH : v > dimConstraints.maxH ? dimConstraints.maxH : v; setInH(nv); if (nv < COTTAGE_MIN_FRAME_HEIGHT) setSashProportion('standard'); }}
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
          </Sec>}

          {isCasement && <Sec t="Glazing Bars">
            <Lbl>Main — horizontal{isArched ? ' (below the springing)' : ''}</Lbl><HChips o={CAS_BAR_COUNTS} v={casHB} c={setCasHB} />
            {!(isArched && isHubPattern(casArchPattern)) && <>
              <Lbl>Main — vertical</Lbl><HChips o={CAS_BAR_COUNTS} v={casVB} c={setCasVB} />
            </>}
            {isCircle && <>
              <Lbl>Pattern in the circle</Lbl>
              <HChips o={archPatterns.map((p) => ({ value: p, label: ARCH_BAR_PATTERN_LABELS[p] || p }))} v={casArchPattern} c={setCasArchPattern} />
              <div className="text-[11px] text-ink-500 mb-2">Sunburst = a ring {getCasementProfile()?.arch?.patterns?.sunburst?.offset} in from the glass edge with {getCasementProfile()?.arch?.patterns?.sunburst?.spokes} spokes (PSW); the straight bars are chords.</div>
            </>}
            {isArched && <>
              <Lbl>Pattern in the arch</Lbl>
              <HChips o={archPatterns.map((p) => ({ value: p, label: ARCH_BAR_PATTERN_LABELS[p] || p }))} v={casArchPattern} c={setCasArchPattern} />
              {isHubPattern(casArchPattern) && (
                <div className="text-[11px] text-ink-500 mb-2">Hub patterns bring their own verticals below the springing (the ring ends) — the vertical count is not used (PSW rule).</div>
              )}
              {isCustomHub && <>
                <Lbl>Custom hub — spokes (3–9, evenly from springing to springing)</Lbl>
                <HChips o={[3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: n, label: String(n) }))} v={casArchSpokes} c={setCasArchSpokes} />
                <Lbl>Custom hub — rings (fractions of the half width, e.g. 0.3, 0.6)</Lbl>
                <input type="text" value={casArchRingsText} onChange={(e) => setCasArchRingsText(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2" />
                <div className="text-[11px] text-ink-500 mb-2">{casArchRings.length ? `Rings at ${casArchRings.join(' / ')} of the half width` : 'Enter at least one fraction between 0 and 1'}</div>
              </>}
              {archPatterns.length === 1 && (
                <div className="text-[11px] text-ink-500 mb-2">Patterns exist for a semi-circle (Half) and for gothic arches; a three-centre takes straight bars only.</div>
              )}
            </>}
            {casCalc.hasFan && !isArched && <>
              <Lbl>Fanlight — horizontal</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFanHB} c={setCasFanHB} />
              <Lbl>Fanlight — vertical</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFanVB} c={setCasFanVB} />
            </>}
            {casCalc.hasFan2 && !isArched && <>
              <Lbl>Fanlight 2 — horizontal</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFan2HB} c={setCasFan2HB} />
              <Lbl>Fanlight 2 — vertical</Lbl><HChips o={CAS_FAN_BAR_COUNTS} v={casFan2VB} c={setCasFan2VB} />
            </>}
            {((casHB + casVB + casFanHB + casFanVB + casFan2HB + casFan2VB) > 0 || ((isArched || isCircle) && casArchPattern !== 'none')) && (
              <><Lbl>Bar type</Lbl><HChips o={BAR_TYPE_OPTIONS} v={casBarType} c={setCasBarType} /></>
            )}
          </Sec>}

          {isSash && isArchedSash && <Sec t="Glazing Bars">
            <Lbl>Upper sash — horizontal (below the springing)</Lbl><HChips o={SASH_BAR_COUNTS} v={sashArchHB} c={setSashArchHB} />
            {!isHubPattern(casArchPattern) && <><Lbl>Upper sash — vertical</Lbl><HChips o={SASH_BAR_COUNTS} v={sashArchVB} c={setSashArchVB} /></>}
            <Lbl>Pattern in the arch</Lbl>
            <HChips o={archPatterns.map((p) => ({ value: p, label: ARCH_BAR_PATTERN_LABELS[p] || p }))} v={casArchPattern} c={setCasArchPattern} />
            {isHubPattern(casArchPattern) && (
              <div className="text-[11px] text-ink-500 mb-2">Hub patterns bring their own verticals below the springing (the ring ends) — the vertical count is not used (PSW rule).</div>
            )}
            {isCustomHub && <>
              <Lbl>Custom hub — spokes (3–9)</Lbl>
              <HChips o={[3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: n, label: String(n) }))} v={casArchSpokes} c={setCasArchSpokes} />
              <Lbl>Custom hub — rings (fractions of the half width)</Lbl>
              <input type="text" value={casArchRingsText} onChange={(e) => setCasArchRingsText(e.target.value)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs mb-2" />
            </>}
            <Lbl>Lower sash — horizontal</Lbl><HChips o={SASH_BAR_COUNTS} v={sashLowerHB} c={setSashLowerHB} />
          </Sec>}
          {isSash && !isArchedSash && <Sec t="Georgian Bars">
            <Lbl>Upper</Lbl><GChips o={BAR_OPTIONS} v={uBars} c={v => { setUBars(v); if (sameBars) setLBars(v); }} />
            {uBars === 'custom' && <CBarEd bars={uCustom} maxVal={extW} onAdd={type => addBar(setUCustom, uCustom, type)} onChange={(i, v) => updateBarMm(setUCustom, uCustom, i, v)} onFinalize={i => finalizeBarMm(setUCustom, uCustom, i)} onRemove={i => removeBar(setUCustom, uCustom, i)} />}
            <label className="flex items-center gap-2 text-xs text-ink-400 mb-2 cursor-pointer"><input type="checkbox" checked={sameBars} onChange={e => setSameBars(e.target.checked)} className="accent-accent-500" />Same upper & lower</label>
            {!sameBars && <><Lbl>Lower</Lbl><GChips o={BAR_OPTIONS} v={lBars} c={setLBars} />{lBars === 'custom' && <CBarEd bars={lCustom} maxVal={extW} onAdd={type => addBar(setLCustom, lCustom, type)} onChange={(i, v) => updateBarMm(setLCustom, lCustom, i, v)} onFinalize={i => finalizeBarMm(setLCustom, lCustom, i)} onRemove={i => removeBar(setLCustom, lCustom, i)} />}</>}
          </Sec>}

          {isSash && <Sec t="Opening">
            {sashType === 'triple'
              ? <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2">Triple sash: {TRIPLE_OPENING_LABEL} (the fixed sections and the middle upper sash never move).</div>
              : <HChips o={OPENINGS} v={opening} c={setOpening} />}
          </Sec>}

          {/* ── Doors — every PSW choice, one shared set for single and french.
               Transom is french-only; PSW hides it the same way. ── */}
          {isDoor && <>
            <Sec t="Door Type">
              <HChips o={DOOR_TYPES} v={doorType} c={applyDoorType} />
              <div className="text-[11px] text-ink-500 mt-1.5">
                Width {doorLimits.wMin}–{doorLimits.wMax} · Height {doorLimits.hMin}–{doorLimits.hMax} mm
                {doorSideW > 0 && <span> · door width = W less the side panels = {doorFieldW} mm</span>}
                {(doorFieldW < doorLimits.wMin || doorFieldW > doorLimits.wMax || extH < doorLimits.hMin || extH > doorLimits.hMax) && (
                  <span className="text-amber-400"> · current size is outside this range</span>
                )}
              </div>
            </Sec>

            <Sec t="Door Design">
              <Lbl>Shape</Lbl><HChips o={DOOR_SHAPES} v={doorShape} c={setDoorShape} />
              <Lbl>Style</Lbl><HChips o={DOOR_STYLES} v={doorStyle} c={setDoorStyle} />
              <Lbl>Paneling</Lbl><HChips o={DOOR_PANELING} v={doorPaneling} c={setDoorPaneling} />
              <Lbl>Bars — horizontal</Lbl><HChips o={BAR_COUNTS} v={doorHB} c={setDoorHB} />
              <Lbl>Bars — vertical</Lbl><HChips o={BAR_COUNTS} v={doorVB} c={setDoorVB} />
              {(doorHB > 0 || doorVB > 0) && (
                <><Lbl>Bar type</Lbl><HChips o={BAR_TYPE_OPTIONS} v={doorBarType} c={setDoorBarType} /></>
              )}
            </Sec>

            <Sec t="Side Panels">
              <HChips o={SIDE_PANEL_MODES} v={sidePanels} c={setSidePanels} />
              {sidePanels !== 'none' && <>
                <div className="text-[11px] text-ink-500 mb-2">Inside the frame W: each width runs from the outer frame edge to the mullion axis (68 casement mullion between the panel and the door).</div>
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
                <div className="text-[11px] text-ink-500 mb-1">Inside the frame H: from the frame top to the transom axis.</div>
                <NumInput value={transomHeight} onCommit={(v) => setTransomHeight(Math.min(750, Math.max(250, Number(v) || 450)))}
                  className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-2" />
                <Lbl>Transom bars</Lbl><HChips o={TRANSOM_BARS} v={transomBars} c={setTransomBars} />
              </>}
            </Sec>}

            <Sec t="Hardware & Threshold">
              <Lbl>Open side</Lbl><HChips o={HINGE_SIDES} v={hingeSide} c={setHingeSide} />
              <div className="text-[11px] text-ink-500 mb-2">Seen from inside — the door opens towards your left / right{isFrench ? '; the active leaf sits on that side' : ''}.</div>
              <Lbl>Opening direction</Lbl><HChips o={OPEN_DIRECTIONS} v={openDirection} c={setOpenDirection} />
              <Lbl>Lock</Lbl><HChips o={LOCK_TYPES} v={lockType} c={setLockType} />
              <Lbl>Threshold</Lbl><HChips o={THRESHOLDS} v={threshold} c={setThreshold} disabled={(x) => openDirection === 'inward' && x.value !== 'standard'} />
              {openDirection === 'inward' && (
                <div className="text-[11px] text-ink-500 mb-2">Inward door: timber threshold (the inward cill). Aluminium and low profile are for outward doors{threshold !== 'standard' ? '; the saved choice is ignored' : ''}.</div>
              )}
              <Lbl>Threshold extension (mm)</Lbl>
              <NumInput value={thresholdExt} onCommit={(v) => setThresholdExt(Math.min(100, Math.max(0, Number(v) || 0)))}
                className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
            </Sec>
          </>}

          {/* Partition walls (25.10.2026): the bay as a layout string, the lights,
               the panel and the door; the wall size is the Dimensions section above. */}
          {isPartition && <Sec t="Partition Wall">
            <Lbl>Layout (left to right, seen from the corridor)</Lbl>
            <input type="text" value={partitionLayout} maxLength={12} spellCheck={false}
              onChange={(e) => setPartitionLayout(cleanPartitionLayout(e.target.value))}
              onBlur={() => setPartitionLayout(partitionLayoutClean)}
              className="w-full px-3 py-2 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm font-mono tracking-[0.3em] uppercase mb-1" />
            <div className="text-[11px] text-ink-500 mb-2">S = glazed screen, D = door. {partitionScreens} screen{partitionScreens === 1 ? '' : 's'}{partitionDoors > 0 ? `, ${partitionDoors} door${partitionDoors === 1 ? '' : 's'}` : ', no door'}.</div>
            {partitionHasDoor && <>
              <Lbl>Door opening width (mm)</Lbl>
              <NumInput value={partitionDoorWidth} onCommit={(v) => setPartitionDoorWidth(Math.max(400, Math.round(Number(v) || partitionDefaults.doorWidth || 800)))}
                className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-2" />
            </>}
            <Lbl>Lights per screen</Lbl>
            <HChips o={PARTITION_LIGHTS} v={partitionLights} c={setPartitionLights} />
            <Lbl>Panel height (mm, 0 = no panel)</Lbl>
            <NumInput value={partitionPanelHeight} onCommit={(v) => setPartitionPanelHeight(Math.max(0, Math.round(Number(v) || 0)))}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-2" />
            {partitionHasDoor && <>
              <Lbl>Hinge side (seen from the corridor)</Lbl>
              <HChips o={PARTITION_HINGE_SIDES} v={partitionHingeSide} c={setPartitionHingeSide} />
              <Lbl>Swing</Lbl>
              <HChips o={PARTITION_SWINGS} v={partitionSwing} c={setPartitionSwing} />
            </>}
            <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 mt-1">
              Solid oak, oiled; members {frameDepth} deep. The screen widths are derived from the wall width less the door and the posts.
            </div>
          </Sec>}

          {/* Fire doors (27.10.2026, v1.1): the inputs of the spec block (brief 3.1). The
               STRUCTURAL OPENING is the size input (chips = the openings of the profile's
               leaf suggestions through the engine's size rule); the leaf fields are an
               optional override, empty = derived from the opening (the placeholder shows
               it). Every size and the wall depth are free numbers (the chips insert a
               value, nothing clamps); the frame overall, the leaf, the rebate and the
               member sizes are derived. */}
          {isFireDoor && <Sec t="Fire Door">
            <HChips o={FD_FIRE} v={fdFire} c={setFdFire} />
            {fdFire && <><Lbl>Rating</Lbl><HChips o={FD_RATINGS} v={fdRating} c={setFdRating} /></>}
            <Lbl>Structural opening width (mm)</Lbl>
            <NumInput value={fdOpeningWidth} onCommit={(v) => setFdOpeningWidth(Number(v))}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-1" />
            <HChips o={fdOpeningChips.widths} v={fdLeafStore(fdOpeningWidth)} c={setFdOpeningWidth} />
            <Lbl>Structural opening height (mm)</Lbl>
            <NumInput value={fdOpeningHeight} onCommit={(v) => setFdOpeningHeight(Number(v))}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-1" />
            <HChips o={fdOpeningChips.heights} v={fdLeafStore(fdOpeningHeight)} c={setFdOpeningHeight} />
            <div className="text-[11px] text-ink-500 mb-1">Frame = opening - {fd?.opening?.wallGapSide ?? fdProfile.frame?.wallGapSide ?? DEFAULT_FIREDOOR_PROFILE.frame.wallGapSide} a side / - {fd?.opening?.wallGapHead ?? fdProfile.frame?.wallGapHead ?? DEFAULT_FIREDOOR_PROFILE.frame.wallGapHead} at the head; the leaf follows from the frame.</div>
            <Lbl>Leaf (optional override, mm) <span className="text-ink-500">empty = derived from the opening</span></Lbl>
            <div className="flex items-center gap-2 mb-1">
              <FdOptionalNumInput value={fdLeafWidth} onCommit={setFdLeafWidth} placeholder={fd ? `${fd.leaf?.width}` : 'width'} title="Leaf width; empty = derived from the opening"
                className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm placeholder:text-ink-500" />
              <span className="text-ink-500 text-xs">x</span>
              <FdOptionalNumInput value={fdLeafHeight} onCommit={setFdLeafHeight} placeholder={fd ? `${fd.leaf?.height}` : 'height'} title="Leaf height; empty = derived from the opening"
                className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm placeholder:text-ink-500" />
              {(fdLeafWidth !== '' || fdLeafHeight !== '') && (
                <button type="button" onClick={() => { setFdLeafWidth(''); setFdLeafHeight(''); }}
                  className="px-2 py-1 text-[11px] rounded-lg border border-surface-500 text-ink-300 bg-surface-600 hover:bg-surface-500">derive from the opening</button>
              )}
            </div>
            <div className="text-[11px] text-ink-300 mb-1">Leaf <span className="text-accent-400 font-medium">{fd ? `${fd.leaf?.width} x ${fd.leaf?.height} x ${fd.leaf?.thickness} mm` : 'n/a'}</span> <span className="text-ink-500">(thickness by rating{fd?.opening?.source === 'leaf' ? '; size typed, the opening follows from it' : fd?.opening?.source === 'mixed' ? '; one axis typed' : ''})</span></div>
            <Lbl>Hinge side (seen from the pull side, where the knuckles show)</Lbl>
            <HChips o={FD_HINGE_SIDES} v={fdHingeSide} c={setFdHingeSide} />
            <Lbl>Wall thickness = frame depth (mm)</Lbl>
            <NumInput value={fdFrameDepth} onCommit={(v) => setFdFrameDepth(Number(v))}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm mb-1" />
            <HChips o={(fdProfile.frame?.depthSuggestions || DEFAULT_FIREDOOR_PROFILE.frame.depthSuggestions).map((n) => ({ value: n, label: String(n) }))} v={Number(fdFrameDepth)} c={setFdFrameDepth} />
            <Lbl>Lock</Lbl>
            <HChips o={FD_LOCKS} v={fdLockType} c={setFdLockType} />
            <Lbl>Closer {fdCloser == null && <span className="text-ink-500">(follows fire: {FIREDOOR_CLOSER_LABELS[fdCloserEff] || fdCloserEff})</span>}</Lbl>
            <HChips o={FD_CLOSERS} v={fdCloserEff} c={setFdCloser} />
            {/* v1.2 (owner 28.10.2026): the vision panel as a type with its size, panes and position (FdVisionPanel below) */}
            <FdVisionPanel types={fdVpTypes} view={fdVpView} fd={fd} hingeSide={fdHingeSide} onPatch={patchFdVp}
              legacyStyle={!fdVp && fd?.inputs?.vp?.source === 'legacy' ? fd.inputs.vp.legacyStyle : null} />
            {/* v1.1: one strip size by rating (FD30 one, FD60 two, non-fire none), read only from the engine */}
            <div className="text-[11px] text-ink-300 mb-1" data-firedoor-intu>Intumescent <span className="text-accent-400 font-medium">{fd ? (fd.intumescent ? fd.intumescent.label : 'none (non-fire)') : 'n/a'}</span> <span className="text-ink-500">(by rating{fd?.intumescent ? `, ${fd.intumescent.metres} m` : ''})</span></div>
            {/* v1.2: the strip colour (the profile's colours; null = the profile default) */}
            {fd?.intumescent && <>
              <Lbl>Intumescent colour {fdIntuColour == null && <span className="text-ink-500">(default: {fd.intumescent.colour?.label})</span>}</Lbl>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fdIntuColours.map((c) => (
                  <button key={c.id} type="button" onClick={() => setFdIntuColour(c.id)} data-firedoor-intu-colour={c.id}
                    className={fdChipCls((fdIntuColour ?? fd.intumescent.colour?.id) === c.id)}>
                    <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-surface-400 inline-block" style={{ backgroundColor: c.hex }} />{c.label}</span>
                  </button>
                ))}
              </div>
            </>}
            <Lbl>Leading edge bevel (lock edge)</Lbl>
            <HChips o={FD_YES_NO} v={fdLeadEdge} c={setFdLeadEdge} />
            <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 mt-1" data-firedoor-live>
              {fdOverall
                ? <>Opening <span className="text-accent-400 font-medium">{fd.opening?.width} x {fd.opening?.height}</span> · frame overall <span className="text-accent-400 font-medium">{fdOverall.width} x {fdOverall.height}</span> · leaf <span className="text-accent-400 font-medium">{fd.leaf?.width} x {fd.leaf?.height}</span> · rebate {fd.frame?.rebate?.width} x {fd.frame?.rebate?.depth} · members {fd.frame?.thickness} x {fd.frame?.depth} finished, {fd.frame?.rawThickness} x {fd.frame?.rawWidth} raw · hinges {(fd.hinges?.positions || []).map((h) => h.top).join(' / ')} from the leaf top</>
                : <span className="text-amber-400">{fdLive?.error || 'Fire door not derived'}</span>}
            </div>
          </Sec>}

          {!isPartition && !isFireDoor && <Sec t="Ventilation">
            <Lbl>Room type</Lbl>
            <HChips o={ROOM_TYPES} v={ventRoomType} c={setVentRoomType} />
            {(ventRoomType === 'habitable' || ventRoomType === 'kitchen') && (
              <><Lbl>Only window in this room?</Lbl><HChips o={SOLE_OPTIONS} v={ventSoleWindow} c={setVentSoleWindow} /></>
            )}
            <div className="text-[11px] text-ink-300 mt-1.5">Trickle vents: <span className="text-accent-400 font-medium">{buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } })}</span></div>
          </Sec>}

          {/* Fire doors v1.2 (owner 28.10.2026): the vision panel glass is one of three (FD30 standard,
               FD insulated, Frosted) and nothing else: no type / spec / coating / finish / spacer choice */}
          {isFireDoor && <Sec t="Glass">
            <Lbl>Vision panel glass {fdGlass == null && fd?.vp?.glass && <span className="text-ink-500">(default for {fd.fire ? fd.rating : 'a non-fire door'})</span>}</Lbl>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {fdGlassTypes.map((g) => (
                <button key={g.id} type="button" onClick={() => setFdGlass(g.id)} data-firedoor-glass={g.id}
                  className={fdChipCls((fdGlass ?? fd?.vp?.glass?.type) === g.id)}>{g.label}</button>
              ))}
              {fdGlass != null && (
                <button type="button" onClick={() => setFdGlass(null)} data-firedoor-glass-reset
                  className="px-2 py-1 text-[11px] rounded-lg border border-surface-500 text-ink-300 bg-surface-600 hover:bg-surface-500">by rating</button>
              )}
            </div>
            <div className="text-[11px] text-ink-300 mb-1" data-firedoor-glass-line>
              {fd?.vp?.glass
                ? <><span className="text-accent-400 font-medium">{fd.vp.glass.label} {fd.vp.glass.thickness} mm</span> <span className="text-ink-500">{fd.vp.panes?.length ? `· ${fd.vp.glassSqm} m² in ${fd.vp.panes.length} pane${fd.vp.panes.length === 1 ? '' : 's'}` : '· no vision panel: the glass applies when one is set'}</span></>
                : 'n/a'}
            </div>
          </Sec>}
          {!isFireDoor && <Sec t="Glass">
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
          </Sec>}

          {!isPartition && !isFireDoor && <Sec t={isCasement ? 'Security & External Cill' : 'Horns & Security'}>
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
                  title="Building Regs AD K: an openable window below 800mm floor level with an external drop of 600mm or more must restrict initial opening to 100mm. On escape (egress) windows the restrictor must be releasable without tools (AD B). None of the friction hinge rows has a restriction built in: with this box ticked the engine adds one separate releasable restrictor per side hung opener (the Child Restrictor row in Assign Materials); top hung openers get none."
                  onClick={(e) => e.preventDefault()}
                  className="w-4 h-4 flex items-center justify-center rounded-full bg-surface-600 text-accent-400 text-[9px] font-bold cursor-help shrink-0"
                >?</span>
              </label>
            )}
          </Sec>}

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
          <SG t="Dimensions"><SR l="Frame" v={isFireDoor ? (fdOverall ? `${fdOverall.width} × ${fdOverall.height}` : 'n/a') : `${extW} × ${extH}`} /><SR l="Depth" v={`${frameDepth}mm`} /></SG>
          {isSash && <SG t="Product"><SR l="Sash" v={sashType} />{!isArchedSash && <SR l="Proportions" v={SASH_PROPORTION_LABELS[sashProp] || sashProp} />}<SR l="Head" v={headType} />{isArchedSash && <SR l="Frame" v={`arched · ${pcArchShape || '—'} · rise ${archRiseNum}`} />}</SG>}
          {isCasement && isArched && <SG t="Layout">
            <SR l="Type" v={`Arched · ${isGothicUi ? `Gothic (${casArchProfile})` : `Round (${pcArchShape || '?'})`}`} />
            <SR l="Arch starts at" v={`${archStartNum} mm · ${casArchRiseSource === 'ratio' ? 'auto' : 'custom'}`} />
            <SR l="Rise" v={`${archRiseNum} · ${archRadiiText}`} />
            <SR l="Leaves" v={`1 · hinge ${casArchHinge}`} />
            <SR l="Bars" v={`${casHB}H × ${isHubPattern(casArchPattern) ? 0 : casVB}V${casArchPattern !== 'none' ? ` · ${ARCH_BAR_PATTERN_LABELS[casArchPattern] || casArchPattern}` : ''}`} />
          </SG>}
          {isCasement && isArched && <SG t="CNC">
            {archError
              ? <div className="px-4 py-1 text-[11px] text-amber-400">Arch: {archError}</div>
              : <>
                <SR l="Head" v={archPlanRow('frameHead')} />
                <SR l="Leaf top" v={archPlanRow('leafTop')} />
                <SR l="Arch DXF" v={archPlan?.noStock ? 'no board fits' : 'ready'} />
              </>}
          </SG>}
          {isCasement && !isArched && <SG t="Layout">
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
          {isPartition && <SG t="Partition Wall">
            <SR l="Layout" v={partitionLayoutClean} />
            <SR l="Screens" v={String(partitionScreens)} />
            {partitionHasDoor && <SR l="Door opening" v={`${partitionDoorWidth} mm`} />}
            <SR l="Lights" v={`${partitionLights} per screen`} />
            <SR l="Panel" v={partitionPanelHeight > 0 ? `${partitionPanelHeight} mm` : 'none'} />
            {partitionHasDoor && <SR l="Hinge" v={`${partitionHingeSide} · opens ${partitionSwing}`} />}
          </SG>}
          {/* Fire doors (27.10.2026): the live summary, every number from the engine's derived.firedoor */}
          {isFireDoor && <SG t="Fire Door">
            {fdLive?.error && <div className="px-4 py-1 text-[11px] text-amber-400" data-firedoor-error>{fdLive.geometry ? 'Geometry' : 'Error'}: {fdLive.error}</div>}
            {/* v1.1: the engine's warnings (a typed opening overridden by a typed leaf, crowded dowels); never a block */}
            {(fd?.warnings || []).map((w, i) => <div key={i} className="px-4 py-1 text-[11px] text-amber-400" data-firedoor-warning>Warning: {w}</div>)}
            {fd && <>
              <SR l="Name" v={winName || fdAutoName || 'n/a'} />
              <SR l="Rating" v={fd.fire ? fd.rating : 'Non-fire'} />
              <SR l="Structural opening" v={`${fd.opening?.width} × ${fd.opening?.height}${fd.opening?.source === 'leaf' ? ' (from the leaf)' : fd.opening?.source === 'mixed' ? ' (one axis from the leaf)' : ''}`} />
              <SR l="Frame overall" v={`${fdOverall.width} × ${fdOverall.height}`} />
              <SR l="Leaf" v={`${fd.leaf?.width} × ${fd.leaf?.height} × ${fd.leaf?.thickness}`} />
              <SR l="Rebate" v={`${fd.frame?.rebate?.width} × ${fd.frame?.rebate?.depth} · faces ${fd.frame?.faces?.outside} / ${fd.frame?.faces?.inside}`} />
              {(fd.frame?.members || []).map((m) => <SR key={m.id} l={m.id} v={`${m.length}${m.rawSection ? ` · raw ${m.rawSection}` : ''}`} />)}
              {fd.frame?.dowels?.count > 0 && <SR l="Corner dowels" v={`${fd.frame.dowels.perJoint} × ${fd.frame.dowels.dia} × ${fd.frame.dowels.length} per corner`} />}
              <SR l="Hand" v={fd.handing?.label || `Hinge ${fdHingeSide}`} />
              <SR l="Hinges (leaf top)" v={(fd.hinges?.positions || []).map((h) => h.top).join(' / ')} />
              {fd.hinges?.midAboveCentre != null && (fd.hinges?.positions || []).length === 3 && <SR l="Middle hinge" v={`centre ${fd.hinges.midAboveCentre} above the leaf centre`} />}
              <SR l="Hinges (jamb top)" v={(fd.hinges?.positions || []).map((h) => h.jambTop).join(' / ')} />
              <SR l="Lock" v={`${FD_LOCK_LABEL[fd.lock?.type] || fd.lock?.type} · spindle ${fd.lock?.spindle?.fromBottom} up`} />
              <SR l="Keep centre" v={`${fd.keep?.centreFromFoot} from the jamb foot`} />
              <SR l="Closer" v={fd.closer ? fd.closer.label : 'None'} />
              <SR l="Vision panel" v={fd.vp?.label || 'None'} />
              {/* v1.2: the panel's place in words, the glass of three, the strip colour */}
              {fd.vp?.positionLabel && <div className="px-4 pb-0.5 text-right text-[10px] text-ink-300" data-firedoor-vp-position-summary>{fd.vp.positionLabel}</div>}
              {fd.vp?.panes?.length > 0 && <SR l="Glass" v={`${fd.vp.glass?.label} · ${fd.vp.glass?.thickness} mm`} />}
              <SR l="Intumescent" v={fd.intumescent ? `${fd.intumescent.label} · ${fd.intumescent.metres} m${fd.intumescent.colour ? ` · ${fd.intumescent.colour.label}` : ''}` : 'none (non-fire)'} />
            </>}
          </SG>}
          {isPartition
            ? <SG t="Members"><SR l="Timber" v="solid oak, oiled" /><SR l="Depth" v={`${frameDepth}mm`} /></SG>
            : isFireDoor
            ? <SG t="Frame members"><SR l="Finished" v={fd ? `${fd.frame?.thickness} × ${fd.frame?.depth}` : 'n/a'} /><SR l="Raw" v={fd ? `${fd.frame?.rawThickness} × ${fd.frame?.rawWidth}` : 'n/a'} /></SG>
            : <SG t="Frame & Horns">
              <SR l="Frame" v={`${frameType} · ${frameDepth}mm`} />
              {isSash && <SR l="Horns" v={horn} />}
            </SG>}
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
          {/* fire doors v1.2: the vision panel glass only (one of three) */}
          {isFireDoor && <SG t="Glass">
            <SR l="Vision panel" v={fd?.vp?.glass ? `${fd.vp.glass.label} · ${fd.vp.glass.thickness} mm` : 'n/a'} />
            {fd?.vp?.panes?.length > 0 && <SR l="Area" v={`${fd.vp.glassSqm} m²`} />}
          </SG>}
          {!isFireDoor && <SG t="Glass">
            <SR l="Type" v={glassLabel(glassType)} />
            <SR l="Spec" v={glassSpec} />
            <SR l="Coating" v={(GLASS_COATINGS.find(c => c.value === glassCoating) || {}).label || 'Standard'} />
            <SR l="Finish" v={gFin} />
            {(isCasement || hasGasFill) && <SR l="Gas" v={isCasement ? (glassGas === 'argon' ? 'Argon' : 'Air') : 'Argon'} />}
            <SR l="Spacer" v={spacerColor} />
            <SR l="Spacer Type" v={(SPACER_TYPES.find(t => t.value === spacerType) || {}).label || 'Warm Edge'} />
          </SG>}
          {!isPartition && !isFireDoor && <SG t="Ventilation">
            <SR l="Room" v={ventRoomType} />
            <SR l="Sole window" v={ventSoleWindow ? 'Yes' : 'No'} />
            <SR l="Trickle vents" v={String(buildVentGrilles({ vent: { roomType: ventRoomType, soleWindow: ventSoleWindow } }))} />
          </SG>}
          {isCasement && <SG t="External Cill">
            <SR l="Projection" v={sillExt ? `${sillExt}mm` : 'None'} />
            <SR l="Wider" v={sillWider ? '+50mm each side' : 'No'} />
            <SR l="Seal" v={sealColour === 'black' ? 'Black' : 'White'} />
          </SG>}
          {isSash && <SG t="Opening"><SR l="Type" v={sashType === 'triple' ? TRIPLE_OPENING_LABEL : opening} /></SG>}
          <SG t="Hardware">
            {!isPartition && !isFireDoor && <SR l="PAS24" v={pas24 ? 'Yes' : 'No'} />}
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

// ─── Fire doors v1.2 (owner 28.10.2026): the vision panel editor ───
// The owner: "many choices but not my way of positioning (centre, shift right,
// 100 from the edge); describe them better: round, square, standard, double".
// A row of TYPE chips (the profile's vp.types, each with a small icon of its
// shape), the size fields of the shape, the panes with their arrangement and
// gap, the position across (centred with a shift, or a distance from the hinge
// / lock edge) and up / down (the top from the leaf top, the centre or the
// bottom above the leaf bottom), and a preview of the engine's panes. `view` =
// the panel shown (the door's block, else the engine's reading of the door);
// onPatch(changed keys) and the parent writes the whole block. Nothing here
// sizes or places a pane: the preview draws fd.vp.panes and fd.hinges.
function FdVisionPanel({ types, view, fd, hingeSide, onPatch, legacyStyle }) {
  const v = view || {};
  const shape = v.shape || 'none';
  const has = shape !== 'none' && Number(v.count) > 0;
  const group = fd?.vp?.group || null;
  const numCls = 'w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm';
  const num = (k) => (val) => onPatch({ [k]: Number(val) });
  const pickType = (t) => onPatch({ type: t.id, shape: t.shape, width: t.width, height: t.height, count: t.count, arrange: t.arrange, gap: t.gap });
  // a mode switch keeps the panel where it is: its distance from that edge as the engine placed it (fd.vp.group)
  const pickAcross = (mode) => {
    if (mode === v.across) return;
    const off = mode === 'centre' ? 0 : group ? (mode === 'hinge' ? group.fromHingeEdge : group.fromLockEdge) : v.acrossOffset;
    onPatch({ across: mode, acrossOffset: off });
  };
  const pickDown = (mode) => {
    if (mode === v.down) return;
    const off = !group ? v.downOffset : mode === 'top' ? group.fromTop : mode === 'bottom' ? group.fromBottom : group.centreFromBottom;
    onPatch({ down: mode, downOffset: off });
  };
  const sizeFields = shape === 'round' ? [['width', 'Diameter (mm)']] : shape === 'diamond' ? [['width', 'Size (mm, turned 45)']] : [['width', 'Width (mm)'], ['height', 'Height (mm)']];
  const across = FD_VP_ACROSS.find((o) => o.value === v.across) || FD_VP_ACROSS[0];
  const down = FD_VP_DOWN.find((o) => o.value === v.down) || FD_VP_DOWN[0];
  return (
    <div data-firedoor-vp>
      <Lbl>Vision panel</Lbl>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {types.map((t) => (
          <button key={t.id} type="button" onClick={() => pickType(t)} data-firedoor-vp-type={t.id} className={fdChipCls(v.type === t.id)} title={t.shape === 'none' ? 'No vision panel' : `${t.label}: ${t.shape === 'round' ? `dia ${t.width}` : t.shape === 'diamond' ? `${t.width} x ${t.width} turned 45` : `${t.width} x ${t.height}`}${Number(t.count) > 1 ? `, ${t.count} panes` : ''}`}>
            <span className="inline-flex items-center gap-1.5"><FdVpTypeIcon t={t} />{t.label}</span>
          </button>
        ))}
      </div>
      {legacyStyle != null && legacyStyle !== 0 && <div className="text-[10px] text-ink-500 mb-1" data-firedoor-vp-legacy>Read from the saved Master_Door style {legacyStyle}; any change here stores the new vision panel.</div>}
      {has && <>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1">
          {sizeFields.map(([k, l]) => (
            <div key={k}>
              <Lbl>{l}</Lbl>
              <NumInput value={v[k]} onCommit={num(k)} data-firedoor-vp-field={k} className={numCls} />
            </div>
          ))}
        </div>
        <Lbl>Panes</Lbl>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {FD_VP_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => onPatch({ count: n })} data-firedoor-vp-count={n} className={fdChipCls(Number(v.count) === n)}>{n}</button>
          ))}
        </div>
        {Number(v.count) > 1 && <>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {FD_VP_ARRANGE.map((o) => (
              <button key={o.value} type="button" onClick={() => onPatch({ arrange: o.value })} data-firedoor-vp-arrange={o.value} className={fdChipCls((v.arrange === 'side' ? 'side' : 'stack') === o.value)}>{o.label}</button>
            ))}
          </div>
          <Lbl>Gap between the panes (mm)</Lbl>
          <NumInput value={v.gap} onCommit={num('gap')} data-firedoor-vp-field="gap" className={numCls + ' mb-1'} />
        </>}
        <Lbl>Position across</Lbl>
        <div className="flex flex-wrap gap-1.5 mb-1">
          {FD_VP_ACROSS.map((o) => (
            <button key={o.value} type="button" onClick={() => pickAcross(o.value)} data-firedoor-vp-across={o.value} className={fdChipCls(across.value === o.value)}>{o.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-1">
          <NumInput value={v.acrossOffset} onCommit={num('acrossOffset')} data-firedoor-vp-field="acrossOffset" className={numCls} />
          <span className="text-[11px] text-ink-400" data-firedoor-vp-across-label>{across.field} (mm)</span>
        </div>
        <Lbl>Position up / down</Lbl>
        <div className="flex flex-wrap gap-1.5 mb-1">
          {FD_VP_DOWN.map((o) => (
            <button key={o.value} type="button" onClick={() => pickDown(o.value)} data-firedoor-vp-down={o.value} className={fdChipCls(down.value === o.value)}>{o.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <NumInput value={v.downOffset} onCommit={num('downOffset')} data-firedoor-vp-field="downOffset" className={numCls} />
          <span className="text-[11px] text-ink-400" data-firedoor-vp-down-label>{down.field} (mm)</span>
        </div>
      </>}
      {fd && <div className="flex items-start gap-3 bg-surface-700/50 border border-surface-500 rounded-lg px-2 py-2 mb-2">
        <FdVpPreview fd={fd} hingeSide={hingeSide} />
        <div className="text-[11px] min-w-0">
          <div className="text-accent-400 font-medium" data-firedoor-vp-label>{fd.vp?.label || 'None'}</div>
          {fd.vp?.positionLabel && <div className="text-ink-300 mt-0.5" data-firedoor-vp-position-label>{fd.vp.positionLabel}</div>}
          <div className="text-ink-500 mt-1">Seen from the pull side; the hinge edge is the thick line.</div>
          {(fd.vp?.warnings || []).map((w, i) => <div key={i} className="text-amber-400 mt-1" data-firedoor-vp-warning>{w}</div>)}
        </div>
      </div>}
    </div>
  );
}

// A type chip's icon: the preset's panes in a 14 x 18 box (a rectangle, a
// square, a slot, a circle, a diamond, panes one above another / side by
// side); none = a crossed box. A schematic: each pane keeps its proportion,
// the panes sit a fixed 2 px apart and never thinner than 3 px, so two tall
// slots still read as two. Drawing only: the sizes are the preset's own.
function FdVpTypeIcon({ t }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(t?.count) || 0)));
  const w0 = Number(t?.width) || 0, h0 = t?.shape === 'rect' ? (Number(t?.height) || 0) : w0;
  const side = t?.arrange === 'side';
  const svgProps = { width: 14, height: 18, viewBox: '0 0 14 18', className: 'shrink-0', 'aria-hidden': true };
  if (!t || t.shape === 'none' || !n || !(w0 > 0) || !(h0 > 0)) {
    return <svg {...svgProps}><rect x="1.5" y="1.5" width="11" height="15" rx="1" fill="none" stroke="currentColor" strokeWidth="1" /><path d="M1.5 1.5 L12.5 16.5 M12.5 1.5 L1.5 16.5" stroke="currentColor" strokeWidth="1" /></svg>;
  }
  const G = 2, MIN = 3;
  const availW = 12 - (side ? (n - 1) * G : 0), availH = 16 - (side ? 0 : (n - 1) * G);
  const k = Math.min(availW / (side ? n * w0 : w0), availH / (side ? h0 : n * h0));
  const pw = Math.max(MIN, w0 * k), ph = Math.max(MIN, h0 * k);
  const gw = side ? n * pw + (n - 1) * G : pw, gh = side ? ph : n * ph + (n - 1) * G;
  const ox = (14 - gw) / 2, oy = (18 - gh) / 2;
  const panes = Array.from({ length: n }, (_, i) => ({
    x: ox + (side ? i * (pw + G) : 0), y: oy + (side ? 0 : i * (ph + G)), w: pw, h: ph,
  }));
  return (
    <svg {...svgProps}>
      {panes.map((p, i) => (t.shape === 'round'
        ? <circle key={i} cx={p.x + p.w / 2} cy={p.y + p.h / 2} r={p.w / 2} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />
        : t.shape === 'diamond'
          ? <path key={i} d={`M${p.x + p.w / 2} ${p.y} L${p.x + p.w} ${p.y + p.h / 2} L${p.x + p.w / 2} ${p.y + p.h} L${p.x} ${p.y + p.h / 2} Z`} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />
          : <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx="0.8" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />))}
    </svg>
  );
}

// The live preview: the leaf outline 120 px high, seen from the pull side (the
// hinge edge on the hinge side, a thick line with the hinges on it), the lever
// rose at the spindle and the engine's panes (fd.vp.panes: x from the leaf top,
// y from the hinge edge; a rectangle with its corner radius, a circle, a
// diamond turned 45).
function FdVpPreview({ fd, hingeSide }) {
  const W = Number(fd?.leaf?.width) || 0, H = Number(fd?.leaf?.height) || 0;
  if (!(W > 0) || !(H > 0)) return null;
  const hingeLeft = (fd?.handing?.hingeSide || hingeSide) !== 'right';
  const sx = (y, w) => (hingeLeft ? y : W - y - w);
  const m = Math.round(H * 0.03);
  const vbW = W + 2 * m, vbH = H + 2 * m;
  const pxH = 120, pxW = Math.max(30, Math.round(pxH * vbW / vbH));
  const frosted = fd?.vp?.glass?.type === 'frosted';
  const paneFill = frosted ? 'rgba(226, 232, 240, 0.75)' : 'rgba(125, 185, 235, 0.45)';
  const ns = { vectorEffect: 'non-scaling-stroke' };
  const hingeX = hingeLeft ? 0 : W;
  const spindle = fd?.lock?.spindle;
  return (
    <svg data-firedoor-vp-preview width={pxW} height={pxH} viewBox={`${-m} ${-m} ${vbW} ${vbH}`} className="shrink-0 text-ink-300">
      <rect x="0" y="0" width={W} height={H} fill="rgba(160, 160, 160, 0.08)" stroke="currentColor" strokeWidth="1" {...ns} />
      <line x1={hingeX} y1="0" x2={hingeX} y2={H} stroke="currentColor" strokeWidth="3" {...ns} data-vp-hinge-edge={hingeLeft ? 'left' : 'right'} />
      {(fd?.hinges?.positions || []).map((h) => (
        <rect key={h.i} x={hingeLeft ? -m * 0.7 : W} y={h.top} width={m * 0.7} height={Math.max(1, (h.bottom ?? h.top) - h.top)} fill="currentColor" />
      ))}
      {spindle && Number.isFinite(Number(spindle.fromTop)) && (
        <circle cx={hingeLeft ? W - Number(spindle.fromLockEdge || 0) : Number(spindle.fromLockEdge || 0)} cy={Number(spindle.fromTop)} r={Math.max(12, m * 0.8)} fill="none" stroke="currentColor" strokeWidth="1" {...ns} data-vp-handle />
      )}
      {(fd?.vp?.panes || []).map((p) => {
        const bw = Number(p.box?.w) || Number(p.w) || 0, bh = Number(p.box?.h) || Number(p.h) || 0;
        const x = sx(Number(p.y) || 0, bw), y = Number(p.x) || 0;
        if (p.shape === 'round') return <circle key={p.i} cx={x + bw / 2} cy={y + bh / 2} r={Number(p.w) / 2} fill={paneFill} stroke="currentColor" strokeWidth="1" {...ns} data-vp-pane="round" />;
        if (p.shape === 'diamond') return <path key={p.i} d={`M${x + bw / 2} ${y} L${x + bw} ${y + bh / 2} L${x + bw / 2} ${y + bh} L${x} ${y + bh / 2} Z`} fill={paneFill} stroke="currentColor" strokeWidth="1" {...ns} data-vp-pane="diamond" />;
        return <rect key={p.i} x={x} y={y} width={bw} height={bh} rx={Number(p.radius) || 0} fill={paneFill} stroke="currentColor" strokeWidth="1" {...ns} data-vp-pane="rect" />;
      })}
    </svg>
  );
}

// ─── UI Components ───
// Fire doors (v1.1): the optional leaf override field. Unlike NumInput an EMPTY
// field commits '' (= derived from the opening) instead of keeping the last
// value, so clearing the box hands the size back to the engine; a valid number
// commits as it is typed; blur re-syncs to the stored text. type="number", so
// the global index.css rule hides the spinner like every fire door input.
function FdOptionalNumInput({ value, onCommit, ...rest }) {
  const [text, setText] = useState(value === undefined || value === null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value === undefined || value === null ? '' : String(value)); }, [value]);
  return (
    <input type="number" value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(value === undefined || value === null ? '' : String(value)); }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t === '') onCommit('');
        else if (!Number.isNaN(Number(t))) onCommit(Number(t));
      }}
      {...rest} />
  );
}

function Sec({ t, children }) { return <div className="px-4 py-3 border-b border-surface-500"><div className="text-xs font-semibold text-ink-100 uppercase tracking-wider mb-2">{t}</div>{children}</div>; }
function Lbl({ children }) { return <div className="text-xs text-ink-400 font-medium mb-1 mt-1.5">{children}</div>; }
function HChips({ o, v, c, disabled }) { return <div className="flex flex-wrap gap-1.5 mb-2">{o.map(x => { const off = !!disabled?.(x); return <button key={String(x.value)} disabled={off} onClick={() => { if (!off) c(x.value); }} className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${off ? 'border-surface-500 text-ink-500 bg-surface-700 opacity-50 cursor-not-allowed' : v === x.value ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>{x.label}</button>; })}</div>; }
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
