/**
 * windowSpecToConfig.js
 * 
 * Bridge between Sash Planner's windowSpec (from specification.js)
 * and ParametricSashWindow component props (from 3D configurator).
 * 
 * windowSpec shape (from normaliseToWindowSpec):
 *   { frame: { width, height }, sash: { horns, grid: { mode, rows, cols, customBars } },
 *     color: { single, inside, outside, type, ral }, hardware: { finish },
 *     glazing: { type, finish, spacerColour }, rawSpec }
 * 
 * ParametricSashWindow props:
 *   { width, height, upperBars, lowerBars, upperCustomBars, lowerCustomBars,
 *     woodColor, woodColorExt, woodColorInt, sameColor, showHorns, hornType,
 *     upperGlass, lowerGlass, doubleGlazing, spacerColor, ironmongery,
 *     sashType, opening, upperOpening, showGuides, ... }
 */

// Named colour → hex mapping (matches Prime Sash Windows configurator palette)
const COLOR_MAP = {
  'white':        '#F4F4F2',
  'pure white':   '#F4F4F2',
  'off-white':    '#F0EEE8',
  'cream':        '#EDE8D8',
  'ivory':        '#FFFFF0',
  'black':        '#1C1C1C',
  'jet black':    '#1C1C1C',
  'anthracite':   '#2E3A3F',
  'grey':         '#808080',
  'light grey':   '#C0C0C0',
  'dark grey':    '#404040',
  'sage green':   '#4A4F3B',
  'sage':         '#4A4F3B',
  'olive green':  '#4A4F3B',
  'green':        '#2F4538',
  'heritage green': '#2F4538',
  'burgundy':     '#6B1A2A',
  'royal blue':   '#1A3060',
  'blue':         '#1A3060',
  'oak':          '#C8853A',
  'light oak':    '#D4A76A',
  'dark oak':     '#6B4226',
  'mahogany':     '#4E2728',
  'natural':      '#DEC89A',
  'unpainted':    '#DEC89A',
};

import { buildVentGrilles } from '../engine/lists.js';
import { RAL_LOOKUP as RAL_COLORS } from '../config.js';
import { fanAxisToRatio, fan2AxisToRatio, CASEMENT_GEO_DEFAULTS } from '../engine/casementLayouts.js';
import { profileBoxDepth, getCasementProfile, getWindowProfile, getDoorProfile, getFireDoorProfile } from '../engine/profile.js';
import { deriveWindowData, meetingFractionFor, sashBarPattern } from '../engine/calculations.js';

function resolveColor(name, ral) {
  if (!name && !ral) return '#F4F4F2'; // default white

  // Try RAL first
  if (ral) {
    const ralKey = String(ral).replace(/^ral\s*/i, '').trim();
    if (RAL_COLORS[ralKey]) return RAL_COLORS[ralKey];
  }

  // Try named colour
  if (name) {
    // If it's already a hex
    if (/^#[0-9a-fA-F]{3,8}$/.test(name)) return name;
    const key = name.toLowerCase().trim();
    if (COLOR_MAP[key]) return COLOR_MAP[key];
  }

  return '#F4F4F2'; // fallback white
}

/**
 * Convert a windowSpec object (from specification.js normaliseToWindowSpec)
 * into props that ParametricSashWindow accepts.
 */
export function windowSpecToConfig(windowSpec, derived = null) {
  if (!windowSpec) return {};

  // Casement windows route to CasementWindow via casementProps; width/height
  // stay top-level for the shared camera auto-fit in the viewer Scenes.
  if ((windowSpec.category || 'sash') === 'casement') {
    // v3 Block 3: circle fixed window → PSW's fix-frame viewer (FixFrameWindow circle branch)
    if (windowSpec.arch?.shape === 'circle') {
      const cp = windowSpecToCasementProps(windowSpec);
      return {
        windowCategory: 'fix-only',
        width: cp.width, height: cp.width, extWidth: cp.width, extHeight: cp.width,
        fixShape: 'circle', fixType: 'standard',
        fixCircleBarPattern: windowSpec.arch.bars?.pattern === 'sunburst' ? 'sunburst' : 'none',
        fixCircleBarOffset: Number(windowSpec.arch.bars?.circleOffset) || Number(getCasementProfile().arch?.patterns?.sunburst?.offset) || 200,
        casementHBars: cp.hBars, casementVBars: cp.vBars,
        woodColor: cp.woodColor, woodColorExt: cp.woodColorExt, woodColorInt: cp.woodColorInt, sameColor: cp.sameColor,
        spacerColor: cp.spacerColor, glassFinish: cp.glassFinish, doubleGlazing: cp.glassType !== 'triple',
        showGuides: false,
      };
    }
    const casementProps = windowSpecToCasementProps(windowSpec);
    // Arched casement (arched-casement-v2 night 4, F): ArchedCasementWindow now
    // draws the arch from arch.js and accepts the PC shape names, the typed rise,
    // the gothic profile and the bar pattern; the two arch RULES it cannot know
    // (three-centre haunch minimum, bar-pattern ratios) come from the profile.
    const arch = windowSpec.arch || null;
    const archProfileSettings = arch ? getCasementProfile().arch : null;
    const archConfig = arch ? {
      casementType: 'arched',
      casArchShape: arch.shape,
      casArchHinge: arch.hinge === 'right' ? 'right' : 'left',
      archRise: Number(arch.rise) || null,
      archProfile: arch.profile || null,
      barPattern: arch.bars?.pattern || 'none',
      archMinHaunchRadius: Number(archProfileSettings?.minHaunchRadius) || 0,
      archPatterns: archProfileSettings?.patterns || null,
      archSpokes: Number(arch.bars?.spokes) || null,
      archRings: Array.isArray(arch.bars?.rings) && arch.bars.rings.length ? [...arch.bars.rings] : null,
      // Piotr 07.09: the user's bar counts never reached the 3D — casementHBars / casementVBars sat
      // in casementProps, which the arched component does not read, so it fell back to the automatic
      // mullion count (a 3-bar gothic was drawn with 6). The engine takes them from arch.bars; so does 3D now.
      casementHBars: Number(arch.bars?.h) || 0,
      casementVBars: Number(arch.bars?.v) || 0,
    } : { casementType: 'standard' };
    return {
      windowCategory: 'casement',
      width: casementProps.width,
      height: casementProps.height,
      // ArchedCasementWindow sizes itself from extWidth/extHeight (the standard
      // CasementWindow reads casementProps) — without these the arched preview
      // stayed at the viewer's default 1000 × 1500.
      extWidth: casementProps.width,
      extHeight: casementProps.height,
      casementProps,
      // v4 Block F: frame face / land for the 3D frame (App passes it as a prop)
      frameDims: casementProps.frameDims,
      ...archConfig,
      // v3 Block 3: fixed leaf — no handle, no opening
      fixedLeaf: windowSpec.casement?.kind === 'fixed',
    };
  }

  // Partition walls (25.10.2026): the flat partition fields for the pricing
  // and the 3D App (which renders nothing for this category yet).
  if ((windowSpec.category || 'sash') === 'partition') {
    const pw = windowSpec.partition || {};
    const col = windowSpec.color || {};
    return {
      windowCategory: 'partition',
      width: windowSpec.frame?.width || 2500,
      height: windowSpec.frame?.height || 2165,
      extWidth: windowSpec.frame?.width || 2500,
      extHeight: windowSpec.frame?.height || 2165,
      partitionLayout: pw.layout || 'S',
      partitionDoorWidth: pw.doorWidth,
      partitionLights: pw.lights,
      partitionPanelHeight: pw.panelHeight,
      partitionHingeSide: pw.hingeSide || 'left',
      partitionSwing: pw.swing || 'out',
      woodColor: col.single || COLOR_MAP.oak,
      doubleGlazing: true,
      quantity: windowSpec.quantity || 1,
    };
  }

  // Fire doors (27.10.2026): the engine geometry for the 3D (FireDoor.jsx,
  // fireDoorGeometryFromSpec) and the flat firedoor numbers the pricing reads.
  // Never throws on a missing or failed derived: the config then carries no
  // fireDoorGeo and the 3D draws nothing for the door.
  if ((windowSpec.category || 'sash') === 'firedoor') {
    const fd = windowSpec.firedoor || {};
    const col = windowSpec.color || {};
    const gz = windowSpec.glazing || {};
    const dual = col.type === 'dual';
    const single = (col.single || col.outside) ? resolveColor(col.single || col.outside, col.ral) : '#F6F6F6';
    const geo = fireDoorGeometryFromSpec(windowSpec, derived);
    const members = geo?.frame?.members || [];
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const W = geo?.totalWidth || Number(windowSpec.frame?.width) || 0;
    const H = geo?.totalHeight || Number(windowSpec.frame?.height) || 0;
    return {
      windowCategory: 'firedoor',
      width: W,
      height: H,
      extWidth: W,
      extHeight: H,
      ...(geo ? { fireDoorGeo: geo } : {}),
      fireDoorOpen: 30,
      sameColor: !dual,
      woodColor: single,
      woodColorExt: dual && col.outside ? resolveColor(col.outside, col.ral) : single,
      woodColorInt: dual && col.inside ? resolveColor(col.inside, col.ral) : single,
      ironmongery: windowSpec.hardware?.finish || 'brass',
      glassFinish: gz.finish || 'clear',
      quantity: windowSpec.quantity || 1,
      // the pricing's flat numbers (pricing.js calculateFireDoor). v1.1: the
      // structural opening the engine reports (typed, or from a typed leaf),
      // the leaf as derived, the closer as a kind ('none' | 'surface' |
      // 'builtin'); no swing, no intumescent style.
      firedoorFire: !!fd.fire,
      firedoorRating: geo?.rating ?? fd.rating ?? null,
      firedoorOpeningWidth: geo?.opening?.w ?? num(fd.openingWidth),
      firedoorOpeningHeight: geo?.opening?.h ?? num(fd.openingHeight),
      firedoorLeafWidth: geo?.leaf?.w ?? num(fd.leafWidth),
      firedoorLeafHeight: geo?.leaf?.h ?? num(fd.leafHeight),
      firedoorFrameDepth: geo?.frame?.depth ?? num(fd.frameDepth),
      firedoorHingeSide: fd.hingeSide || 'left',
      firedoorLockType: fd.lockType || 'latch',
      firedoorCloser: geo ? (geo.closer ? geo.closer.type : 'none') : (typeof fd.closer === 'string' ? fd.closer : (fd.closer ? 'builtin' : 'none')),
      firedoorVpStyle: Number(fd.vpStyle) || 0,
      firedoorVpSqm: geo?.vp?.glassSqm ?? num(derived?.firedoor?.vp?.glassSqm) ?? 0,
      firedoorFrameMetres: members.reduce((s, m) => s + (Number(m.length) || 0) * (Number(m.quantity) || 1), 0) / 1000,
    };
  }

  // Doors: the 3D App reads FLAT door fields (it was ported from PSW that way),
  // so translate the nested windowSpec.door block into those exact keys.
  if (['door', 'doors'].includes(windowSpec.category || 'sash')) {
    const d = windowSpec.door || {};
    const sp = d.sidePanels || {};
    const tr = d.transom || {};
    const gz = windowSpec.glazing || {};
    const col = windowSpec.color || {};
    const dual = col.type === 'dual';
    return {
      windowCategory: 'door',
      // v4 Block F + night 7 stage 3: the door frame face / land from the door profile (68 / 47)
      frameDims: doorFrameDims(),
      width: windowSpec.frame?.width || 900,
      height: windowSpec.frame?.height || 2100,
      extWidth: windowSpec.frame?.width || 900,
      extHeight: windowSpec.frame?.height || 2100,
      doorType: d.type || 'single-external',
      doorShape: d.shape || 'standard',
      doorStyle: d.style || 'full-glass',
      paneling: d.paneling || 'flat',
      centerMullion: !!d.centerMullion,
      doorHinge: d.hingeSide || 'left',
      doorOpenDirection: d.openDirection || 'outward',
      doorHBars: d.bars?.h || 0,
      doorVBars: d.bars?.v || 0,
      sidePanels: sp.mode || 'none',
      sideLeftWidth: sp.leftWidth || 500,
      sideRightWidth: sp.rightWidth || 500,
      sideStyle: sp.style || 'full-glass',
      sideHBars: sp.barsH || 0,
      sideVBars: sp.barsV || 0,
      transomType: tr.type || 'none',
      transomHeight: tr.height || 450,
      transomBars: tr.bars || 'none',
      thresholdType: d.threshold || 'standard',
      thresholdExtension: d.thresholdExtension || 0,
      doubleGlazing: gz.type !== 'triple',
      glassType: gz.type === 'triple' ? 'triple' : 'double',
      glassFinish: gz.finish || 'clear',
      spacerColor: gz.spacerColour || 'white',
      sealColour: windowSpec.casement?.sealColour || 'black',
      sillExtension: windowSpec.cill?.extension || 0,
      sillWider: !!windowSpec.cill?.wider,
      sameColor: !dual,
      woodColor: col.single || col.outside || '#F6F6F6',
      woodColorExt: col.outside || col.single || '#F6F6F6',
      woodColorInt: col.inside || col.single || '#F6F6F6',
      // Doors to production (brief 5.1): the hinge / handle finish and the
      // engine geometry the 3D draws from (DoorWindow doorGeo prop). Doors v3:
      // the page's derived data (computed under the batch profile snapshot)
      // is the geometry; the door is derived again only when none is given.
      ironmongery: windowSpec.hardware?.finish || 'brass',
      doorGeo: doorGeometryFromSpec(windowSpec, derived),
    };
  }

  const w = windowSpec.frame?.width || 1200;
  const h = windowSpec.frame?.height || 1800;

  // Bars per sash (Piotr 09.10.2026, owner box item 16): each sash its own
  // pattern ('6x6', 'none', 'custom', ...), so "6 over 1" reaches the 3D; a
  // windowSpec without the per-sash keys falls back to grid.mode for both.
  const upperBarsValue = sashBarPattern(windowSpec, 'upper');
  const lowerBarsValue = sashBarPattern(windowSpec, 'lower');

  // Custom bars — ParametricSashWindow expects per-sash arrays of {type:'v'|'h', mm}.
  // Primary source: rawSpec.fullConfig, which stores the exact per-sash bars the
  // configurator saved. Accepts legacy {type, position} entries and skips junk.
  const cleanBars = (list) => (Array.isArray(list) ? list : [])
    .filter((b) => b && (b.type === 'v' || b.type === 'h'))
    .map((b) => ({ type: b.type, mm: Number(b.mm ?? b.position) }))
    .filter((b) => Number.isFinite(b.mm) && b.mm > 0);
  const rawFc = windowSpec.rawSpec?.fullConfig || {};
  let upperCustom = cleanBars(rawFc.upperCustomBars);
  let lowerCustom = cleanBars(rawFc.lowerCustomBars);
  if (upperCustom.length === 0 && lowerCustom.length === 0) {
    // windowSpec grid keeps direction-keyed positions (vertical/horizontal): per
    // sash since 09.10.2026 (grid.upper / grid.lower, a lower sash without its own
    // list takes the upper one); a windowSpec without them applies the single
    // legacy list to both sashes.
    const toList = (cb) => [
      ...(Array.isArray(cb?.vertical) ? cb.vertical : []).map(Number).filter(Number.isFinite).map((mm) => ({ type: 'v', mm })),
      ...(Array.isArray(cb?.horizontal) ? cb.horizontal : []).map(Number).filter(Number.isFinite).map((mm) => ({ type: 'h', mm })),
    ];
    const g = windowSpec.sash?.grid || {};
    if (g.upper?.customBars || g.lower?.customBars) {
      upperCustom = toList(g.upper?.customBars);
      lowerCustom = toList(g.lower?.customBars);
    } else {
      const legacy = toList(g.customBars || {});
      upperCustom = legacy;
      lowerCustom = legacy;
    }
  }

  // Horns
  const hasHorns = Boolean(windowSpec.sash?.horns);
  // hornType comes from rawSpec or defaults to 'A'
  const rawHornType = windowSpec.rawSpec?.fullConfig?.horns || 
                      windowSpec.rawSpec?.horns || 'none';
  const hornType = (rawHornType && rawHornType !== 'none') ? rawHornType : 'A';

  // Colours
  const colorType = windowSpec.color?.type || 'single';
  const isSameColor = colorType === 'single';
  const woodColor = resolveColor(windowSpec.color?.single || windowSpec.color?.outside, windowSpec.color?.ral);
  const woodColorExt = isSameColor ? woodColor : resolveColor(windowSpec.color?.outside, windowSpec.color?.ral);
  const woodColorInt = isSameColor ? woodColor : resolveColor(windowSpec.color?.inside, windowSpec.color?.ral);

  // Glass
  const glassFinish = windowSpec.glazing?.finish || 'clear';
  const frostedLocation = windowSpec.glazing?.frostedLocation || windowSpec.glazing?.frosted_location || 'bottom';
  const isDouble = (windowSpec.glazing?.type || 'double') !== 'single';

  // Frosted applies per-sash: lower when frosted; upper only when location = both.
  const upperFrosted = glassFinish === 'frosted' && frostedLocation === 'both' ? 'frosted' : 'clear';
  const lowerFrosted = glassFinish === 'frosted' ? 'frosted' : 'clear';

  // Ironmongery
  const ironmongery = windowSpec.hardware?.finish || 'brass';

  // Spacer
  const spacerColor = windowSpec.glazing?.spacerColour || windowSpec.glazing?.spacerColor || 'silver';

  return {
    width: w,
    height: h,
    upperBars: upperBarsValue,
    lowerBars: lowerBarsValue,
    upperCustomBars: upperCustom,
    lowerCustomBars: lowerCustom,
    showHorns: hasHorns,
    hornType,
    woodColor,
    woodColorExt: isSameColor ? null : woodColorExt,
    woodColorInt: isSameColor ? null : woodColorInt,
    sameColor: isSameColor,
    upperGlass: upperFrosted,
    lowerGlass: lowerFrosted,
    doubleGlazing: isDouble,
    spacerColor,
    ironmongery,
    // triple sash (Piotr 13.10.2026): the type and the split come from the
    // windowSpec, as the configurator hands them to the same 3D component;
    // they were hard-coded 'double' here, so the window page, the pack and
    // the 3D PDF drew every triple as a double-hung sash.
    sashType: windowSpec.sash?.type === 'triple' ? 'triple' : 'double',
    splitRatio: windowSpec.sash?.splitRatio || '1/4-1/2-1/4',
    // cottage (Piotr 09.10.2026): the proportion and the meeting line fraction from
    // the engine (every sash window, standard included: the 3D meeting line sits
    // where production puts it). A page that derived the window (under the batch
    // profile snapshot) passes its derived data, so the 3D uses that very number.
    sashProportion: windowSpec.sash?.proportion || 'standard',
    meetingFraction: derived?.category === 'sash' && Number.isFinite(derived.meetingFraction)
      ? derived.meetingFraction
      : meetingFractionFor(h, windowSpec.sash?.proportion || 'standard'),
    headType: 'flat',
    // arched sash (v3 Block 1 I): the PSW `sashType 'arched'` branch of the shared App with PC's shape + real rise
    ...(windowSpec.category === 'sash' && windowSpec.arch?.shape && windowSpec.sash?.type !== 'triple' ? {
      sashType: 'arched',
      archShape: windowSpec.arch.shape,
      archRise: Number(windowSpec.arch.rise) || null,
      archProfile: windowSpec.arch.profile || null,
      barPattern: windowSpec.arch.bars?.pattern || 'none',
      archHBars: Number(windowSpec.arch.bars?.h) || 0,
      archVBars: Number(windowSpec.arch.bars?.v) || 0,
      lowerHBars: Number(windowSpec.arch.lowerHBars) || 0,
      archMinHaunchRadius: Number(getWindowProfile()?.sashArch?.minHaunchRadius) || 0,
    } : {}),
    opening: 0,
    upperOpening: 0,
    showGuides: false,
    boxDepth: windowSpec.frame?.depth || profileBoxDepth('standard'),
    sashDepth: 57,
  };
}

// ─── Frame dims for the 3D (ARCHED-WINDOWS-v4 Block F) ───
// The 3D components carry the PSW constants (57 / 36) as defaults; PC hands
// them the profile numbers: frameFace = head / jamb face, extFace = visible
// land (face − rebate). Doors keep their own profile (face 68, land 47).
export function casementFrameDims() {
  const p = getCasementProfile();
  return { frameFace: p.elements.frameHead.face, extFace: p.geometry.land };
}
export function doorFrameDims() {
  const p = getDoorProfile();
  return { frameFace: p.elements.frameHead.face, extFace: p.geometry.land };
}

// ─── Door geometry for the 3D (doors to production, brief 5.1; doors v3) ───
// The door 3D draws every frame member, leaf, glass, panel, hinge and handle
// from the engine (derived.door), so it cannot disagree with the cut list, the
// glass schedule and the sheets. Coordinates are the engine's: frame mm,
// origin at the frame top-left seen from OUTSIDE, y DOWN. Since doors v3 W x H
// is the OVERALL frame: the side panels stand inside it behind casement
// mullions, the fanlight above a casement transom (axis T from the frame top).
//
// `derived` is the page's own deriveWindowData result (the batch profile
// snapshot is applied there, withProfiles); the door is derived again here,
// with the active profile, only when the caller has none (the configurator).
// The few profile numbers the engine does not echo (the inward cill's fall
// run, the hinge barrel, the handle backset) are read from the active door
// profile HERE, so the 3D components never import the profile (PSW port
// rule): DoorWindow takes this object as its optional `doorGeo` prop and,
// without it, renders as it always did. Returns null for anything that is not
// a door (or a door the engine cannot derive). The configurator builds the
// same object from its form state:
// doorGeometryFromSpec(normaliseToWindowSpec(item, { fullConfig })).
export function doorGeometryFromSpec(windowSpec, derivedIn = null) {
  if (!windowSpec || !['door', 'doors'].includes(windowSpec.category || 'sash')) return null;
  let derived = derivedIn?.category === 'door' && derivedIn.door ? derivedIn : null;
  if (!derived) {
    try { derived = deriveWindowData(windowSpec, {}); } catch { return null; }
  }
  const d = derived?.door;
  if (!d || !Array.isArray(d.leaves) || d.leaves.length === 0) return null;
  const p = getDoorProfile();
  const z = d.zones || {};
  const tr = d.transom || null;
  const ti = d.thresholdInfo || {};
  const rect = (r) => (r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null);
  const bars = (b) => ({
    v: (b?.frame?.vBars || []).map((v) => v.cx),
    h: (b?.frame?.hBars || []).map((h) => h.cy),
  });
  const leafMembers = (m) => (m ? { stile: m.stile, top: m.top, bottom: m.bottom, depth: m.depth } : null);
  const glassThickness = Number(windowSpec.glazing?.thickness);
  return {
    type: d.type,
    isFrench: !!d.isFrench,
    style: d.style,
    paneling: d.paneling,
    lockType: d.lockType,
    inward: !!d.inward,
    threshold: d.threshold,
    hasTimberCill: !!d.hasTimberCill,
    thresholdExtension: Number(d.thresholdExtension) || 0,
    // the threshold the engine builds: an inward door always takes the timber
    // inward cill (effectiveType 'standard'), whatever the stored value
    thresholdInfo: {
      type: ti.type ?? d.threshold,
      effectiveType: ti.effectiveType ?? d.threshold,
      ignored: !!ti.ignored,
      timberCill: ti.timberCill ?? !!d.hasTimberCill,
      openingWidth: ti.openingWidth ?? null,
      seal: ti.seal ? { length: ti.seal.length, metres: ti.seal.metres } : null,
    },
    // the overall frame W x H, and the point the 3D group is centred on (the
    // frame centre): the assembly, the guides, the capture rig and the
    // harnesses all read this one field
    totalWidth: d.totalWidth,
    totalHeight: d.totalHeight,
    origin: { x: d.totalWidth / 2, y: d.totalHeight / 2 },
    // the door field (from the jamb or the mullion axis to the other bound)
    doorX: z.doorX,
    doorW: z.doorW,
    frameDepth: d.frameDepth,
    leafDepth: d.leafDepth,
    glassThickness: glassThickness > 0 ? glassThickness : null,
    lip: d.lip,
    overlap: d.overlap,
    meetingX: z.meetingX,
    meetingLap: z.meetingLap ? { leaf: z.meetingLap.leaf, face: z.meetingLap.face } : null,
    members: {
      ...d.members,
      sidePanel: d.members?.sidePanel ? { ...d.members.sidePanel } : null,
      fixedFan: d.members?.fixedFan ? { ...d.members.fixedFan } : null,
    },
    // cill: the face (68 outward, 40 inward) and the visible front seen from
    // outside (zones.bottomVisible: 41 outward, the inward cill's outside
    // face 35, 0 without a timber cill) from the engine; the inward cill's
    // fall run from the profile
    cill: {
      face: d.members?.frameCill,
      visible: Number(z.bottomVisible) || 0,
      inwardInternal: d.inward ? d.members?.frameCill : p.cillInward?.faceInternal,
      inwardExternal: d.inward ? z.bottomVisible : p.cillInward?.faceExternal,
      inwardRun: p.cillInward?.runDepth,
      length: d.cill?.length ?? null,
    },
    hingeBarrel: p.hinges?.barrel,
    handle: {
      backset: p.hardware?.backset,
      slaveBackset: d.hardware?.fgte?.slaveBackset ?? p.hardware?.fgteSlaveBackset,
    },
    // fields: from the outer frame edge or a mullion axis to the next bound
    frames: (z.frames || []).map((f) => ({ x: f.x, w: f.w, kind: f.kind, side: f.side || null })),
    // casement mullions 68 x 93, full height through the transom: the visible
    // land x1..x2 (axis +- 13) from yTop to yBottom
    mullions: (d.mullions || []).map((m) => ({
      axisX: m.axisX, x1: m.x1, x2: m.x2, yTop: m.yTop, yBottom: m.yBottom,
      code: m.code, length: m.length, timberCill: !!m.timberCill,
    })),
    // the casement transom: axis T from the frame top, the rail face, the
    // visible band (8 above, 13 below the axis) and one segment per field
    transom: tr ? {
      axisT: tr.axisT, type: tr.type, bars: tr.bars, railH: tr.railH,
      band: tr.band ? { y: tr.band.y, h: tr.band.h } : null,
      segments: (tr.segments || []).map((s) => ({
        x1: s.x1, x2: s.x2, bandTop: s.bandTop, bandBottom: s.bandBottom,
        code: s.code, length: s.length, over: s.over, side: s.side || null,
      })),
    } : null,
    // the visible frame openings (exterior view), one per field and tier
    openings: (z.openings || []).map((o) => ({ kind: o.kind, over: o.over || null, side: o.side || null, x: o.x, y: o.y, w: o.w, h: o.h })),
    leaves: d.leaves.map((l) => ({
      x: l.x, y: l.y, w: l.w, h: l.h,
      hinge: l.hinge, role: l.role, meetingSide: l.meetingSide,
      stileL: l.stileL, stileR: l.stileR,
      daylight: rect(l.daylight), glass: rect(l.glass), bars: bars(l.bars),
      midRail: l.midRail ? { axis: l.midRail.axis, y: l.midRail.y, face: l.midRail.face } : null,
      // the panel at its OUTER size (daylight + 2 x inset 17) with its edge profile
      panel: l.panel ? {
        ...rect(l.panel), daylight: rect(l.panel.daylight),
        inset: l.panel.inset, thickness: l.panel.thickness,
        edge: l.panel.edge ? { tongue: l.panel.edge.tongue, slope: l.panel.edge.slope, flat: l.panel.edge.flat } : null,
      } : null,
      hinges: [...(l.hinges || [])],
      hingeEdgeX: l.hingeEdgeX,
      handleY: l.handleY,
      // the french meeting stile of this leaf (24.10.2026): its lip face and
      // thickness, the rebate the CNC cuts and the lip plane the 3D splits at
      meeting: l.meeting ? {
        role: l.meeting.role, lipFace: l.meeting.lipFace, lip: l.meeting.lip, splitZ: l.meeting.splitZ,
        rebate: l.meeting.rebate ? { width: l.meeting.rebate.width, depth: l.meeting.rebate.depth, fromFace: l.meeting.rebate.fromFace } : null,
      } : null,
    })),
    // the joint numbers (rebate width = lap + gap, the lips, the seal space)
    meeting: d.meeting ? { ...d.meeting } : null,
    panels: (d.panels || []).map((pn) => ({ leaf: pn.leaf, thickness: pn.thickness, paneling: pn.paneling })),
    // side panels: casement fixed lights behind the mullion (64 / 64 / 180 x 57)
    panelLeaves: (d.panelLeaves || d.sidePanels || []).map((pl) => ({
      x: pl.x, y: pl.y, w: pl.w, h: pl.h, side: pl.side, fixed: true,
      members: leafMembers(pl.members),
      daylight: rect(pl.daylight), glass: rect(pl.glass), bars: bars(pl.bars),
    })),
    // fan leaves: opening (casement top hung) or fixed (non-opening 64 / 64 / 67)
    fanLeaves: (d.fanLeaves || []).map((fl) => ({
      x: fl.x, y: fl.y, w: fl.w, h: fl.h, over: fl.over, side: fl.side || null,
      hinge: fl.hinge, fixed: !!fl.fixed,
      members: leafMembers(fl.members),
      daylight: rect(fl.daylight), glass: rect(fl.glass), bars: bars(fl.bars),
    })),
  };
}

// ─── Casement: windowSpec → CasementWindow props ───
// Same clamps as the configurator/engine (single source: casementLayouts.js).

export function windowSpecToCasementProps(windowSpec) {
  const frame = windowSpec?.frame || {};
  const cas = windowSpec?.casement || {};
  const color = windowSpec?.color || {};
  const glazing = windowSpec?.glazing || {};
  const width = Number(frame.width) || 1200;
  const height = Number(frame.height) || 1200;
  const frameDims = casementFrameDims();
  const innerH = height - frameDims.frameFace - CASEMENT_GEO_DEFAULTS.bottomFace;
  const single = resolveColor(color.single, color.ral);
  const isDual = color.type === 'dual';
  return {
    width, height,
    layout: cas.kind === 'fixed' ? '040L' : (cas.layout || '040L'),
    casementHinges: cas.kind === 'fixed' ? ['fixed'] : Array.isArray(cas.hinges) ? cas.hinges : null,
    fanlightRatio: fanAxisToRatio(cas.fanlightHeight, innerH),
    fan2Ratio: fan2AxisToRatio(cas.fan2Height, height, innerH),
    middleSection: Number(cas.middleWidth) || 0,
    hBars: cas.bars?.h || 0,
    vBars: cas.bars?.v || 0,
    fanHBars: cas.bars?.fanH || 0,
    fanVBars: cas.bars?.fanV || 0,
    fan2HBars: cas.bars?.fan2H || 0,
    fan2VBars: cas.bars?.fan2V || 0,
    opening: 0,
    woodColor: single,
    woodColorExt: isDual ? resolveColor(color.outside, '') : single,
    woodColorInt: isDual ? resolveColor(color.inside, '') : single,
    sameColor: !isDual,
    glassType: glazing.type === 'triple' ? 'triple' : 'double',
    spacerColor: glazing.spacerColour || 'silver',
    glassFinish: glazing.finish || 'clear',
    frostedLocation: glazing.frostedLocation || 'bottom',
    trickleVent: buildVentGrilles(windowSpec) > 0 ? 'frame' : 'none',
    trickleColour: 'white',
    sealColour: windowSpec.casement?.sealColour || 'black',
    sillExtension: Number(windowSpec.cill?.extension) || 0,
    sillWider: !!windowSpec.cill?.wider,
    showGuides: false,
    ironmongery: windowSpec?.hardware?.finish || 'brass',
    frameDims,
  };
}

// ─── Fire door geometry for the 3D (fire doors v1, 27.10.2026) ───
// The fire door 3D (src/3d/components/firedoor/FireDoor.jsx) draws the frame,
// the leaf, the vision panel glass, the hinges, the handle and the keep from
// the engine (derived.firedoor), so it cannot disagree with the sheets, the
// cut list and the machine export. Plain numbers in mm. Coordinates for the
// model: frame mm, origin at the frame top-left seen from the PULL side (the
// face the hinge knuckles show on, the 35 face), y DOWN; the group is
// centred on `origin` (W / 2, H / 2) like the door (doorGeo), so the viewer
// Scenes, the capture rig and the harness read totalWidth / totalHeight /
// origin the same way for both. The vision panel panes keep the engine's
// own fields: x from the leaf TOP to the pane top, y from the HINGE edge to
// the pane left. The only profile number read here is the vision panel glass
// thickness (the windowSpec glazing thickness when the spec carries it).
//
// `derived` is the page's own deriveWindowData result (batch profile
// snapshot applied there); the door is derived again, with the active
// profile, only when the caller has none (the configurator). Returns null
// for anything that is not a fire door, or one the engine cannot derive.
export function fireDoorGeometryFromSpec(windowSpec, derivedIn = null) {
  if (!windowSpec || (windowSpec.category || 'sash') !== 'firedoor') return null;
  let derived = derivedIn?.category === 'firedoor' && derivedIn.firedoor ? derivedIn : null;
  if (!derived) {
    try { derived = deriveWindowData(windowSpec, {}); } catch { return null; }
  }
  const f = derived?.firedoor;
  if (!f || !f.leaf || !f.frame?.overall) return null;
  const n = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  const fr = f.frame;
  const W = n(fr.overall.width), H = n(fr.overall.height);
  const lw = n(f.leaf.width), lh = n(f.leaf.height), lt = n(f.leaf.thickness);
  if (!(W > 0) || !(H > 0) || !(lw > 0) || !(lh > 0)) return null;
  const faces = { outside: n(fr.faces?.outside), inside: n(fr.faces?.inside) };
  const gaps = { side: n(fr.gaps?.side), head: n(fr.gaps?.head), floor: n(fr.gaps?.floor) };
  // the leaf in the frame: the visible face plus the side gap in from the
  // frame edge, the same down from the top, the floor gap above the feet
  // (W = leaf + 2 x 38, H = leaf + 38 + 5 at the defaults)
  const leafX = faces.outside + gaps.side;
  const leafY = faces.outside + gaps.head;
  // v1.1: handed by the hinge side only (no swing on an internal door)
  const hingeSide = f.handing?.hingeSide === 'right' ? 'right' : 'left';
  const op = f.opening || null;
  const specGlass = n(windowSpec.glazing?.thickness);
  const glassThickness = specGlass > 0 ? specGlass : n(getFireDoorProfile()?.vp?.glassThickness);
  const lk = f.lock || {};
  const sp = lk.spindle || {};
  const cyl = lk.cylinder || null;
  const fo = lk.forend || null;
  const kp = f.keep || null;
  return {
    name: f.name ?? windowSpec.name ?? '',
    fire: !!f.fire,
    rating: f.rating ?? null,
    leaf: { w: lw, h: lh, t: lt, x: leafX, y: leafY },
    frame: {
      overall: { w: W, h: H },
      depth: n(fr.depth), thickness: n(fr.thickness),
      rebate: { w: n(fr.rebate?.width), d: n(fr.rebate?.depth) },
      faces, gaps,
      headJoint: fr.headJoint ?? null,
      members: (fr.members || []).map((m) => ({
        id: m.id, role: m.role, length: n(m.length), quantity: n(m.quantity, 1),
        mitreTop: !!m.mitreTop, mitreBottom: !!m.mitreBottom,
      })),
    },
    hinges: {
      count: n(f.hinges?.count), length: n(f.hinges?.length),
      recess: f.hinges?.recess ? { ...f.hinges.recess } : null,
      positions: (f.hinges?.positions || []).map((p, i) => ({
        i: p.i ?? i, top: n(p.top), bottom: n(p.bottom), centre: n(p.centre), jambTop: n(p.jambTop),
      })),
    },
    lock: {
      type: lk.type ?? null,
      spindle: {
        fromBottom: n(sp.fromBottom), fromTop: n(sp.fromTop),
        fromLockEdge: n(sp.fromLockEdge ?? lk.backset), bore: n(sp.bore),
      },
      cylinder: cyl ? {
        kind: cyl.kind ?? null, fromBottom: n(cyl.fromBottom), fromTop: n(cyl.fromTop),
        fromLockEdge: n(cyl.fromLockEdge ?? sp.fromLockEdge ?? lk.backset), bore: n(cyl.bore),
      } : null,
      forend: fo ? {
        length: n(fo.millLength ?? fo.length), width: n(fo.millWidth ?? fo.width),
        centreFromTop: n(fo.centreFromTop), centreFromBottom: n(fo.centreFromBottom),
      } : null,
    },
    keep: kp ? {
      centreFromFoot: n(kp.centreFromFoot), centreFromTop: n(kp.centreFromTop),
      plate: { length: n(kp.plate?.millLength ?? kp.plate?.length), width: n(kp.plate?.millWidth ?? kp.plate?.width) },
    } : null,
    vp: {
      style: f.vp?.style ?? 0, label: f.vp?.label ?? '',
      glassThickness, glassSqm: n(f.vp?.glassSqm),
      // angle: 45 the diamond (drawn turned), 90 a pane the engine turned to
      // fit (w / h already swapped, axis aligned), 0 upright; box = the
      // axis-aligned bounding box the leaf is cut to
      panes: (f.vp?.panes || []).map((p, i) => ({
        i: p.i ?? i, w: n(p.w), h: n(p.h), x: n(p.x), y: n(p.y),
        rotated: !!p.rotated, angle: n(p.angle),
        box: { w: n(p.box?.w ?? p.w), h: n(p.box?.h ?? p.h) },
      })),
    },
    handing: { hingeSide, label: f.handing?.label ?? '' },
    // v1.1: the closer as the engine reports it (null = none) and the
    // structural opening the frame sits in (informational for the 3D)
    closer: f.closer ? { type: f.closer.type ?? null, label: f.closer.label ?? '', machined: !!f.closer.machined } : null,
    opening: op ? { w: n(op.width), h: n(op.height), source: op.source ?? null } : null,
    // the overall frame W x H and the point the 3D group is centred on
    totalWidth: W,
    totalHeight: H,
    origin: { x: W / 2, y: H / 2 },
  };
}
