// ─── Window construction profile ───
// Workshop-editable dimensions that drive the engine: finished sections,
// box depths, length deductions, raw-stock mapping and timber weights.
// Different workshops = different NUMBERS, never different formulas.
//
// The defaults below are the OTD profile (Prime Sash Windows' current values).
// The active profile is pushed in by windowProfileStore (persisted per user);
// the engine always reads through getWindowProfile() so plain-function code
// needs no React/store imports.

// Canonical UI order for frame variants. Supabase stores the profile as
// JSONB, which re-sorts object keys (by length, then bytewise) — so tab
// order must NEVER come from Object.keys of the stored object.
export const VARIANT_ORDER = ['standard', 'slim', 'triple', 'heritage'];

export const DEFAULT_SASH_PROFILE = {
  // Frame variants: box depth + finished sash depth (planed from the same raw stock)
  variants: {
    standard: { label: 'Standard', boxDepth: 164, sashDepth: 57, boardWidth: 141 },
    slim:     { label: 'Slim',     boxDepth: 144, sashDepth: 47, boardWidth: 121 },
    heritage: { label: 'Heritage', boxDepth: 134, sashDepth: 42, boardWidth: 111 },
    triple:   { label: 'Triple glazing', boxDepth: 172, sashDepth: 61, boardWidth: 149 },
  },
  // Legacy only: pre-boardWidth profiles derived board = boxDepth − boardInset.
  // boardWidth on each variant is now the source of truth (workshop-editable).
  boardInset: 23,
  // Window sill construction: true = cill + separate nose, false = one piece
  cillTwoPiece: true,
  // Per-element finished dimensions; sash depth comes from the variant.
  elements: {
    stiles:       { face: 57, raw: '63x63' },
    topRail:      { face: 57, raw: '63x63' },
    meetingRail:  { face: 43, raw: '63x63' },
    bottomRail:   { face: 90, raw: '63x95' },
    head:         { thickness: 28 },
    jambs:        { thickness: 28 },
    extHeadLiner: { w: 17, h: 102, deduction: 204 },
    intHeadLiner: { w: 17, h: 86,  deduction: 172 },
    extJambLiner: { w: 17, h: 102, deduction: 0 },
    intJambLiner: { w: 17, h: 86,  deduction: 0 },
    cill:         { w: 69, h: 46 },   // legacy field names: w = vertical HEIGHT (69), h = WIDTH/depth (46); UI + drawings map accordingly — do not swap the data (stored profiles, "69×46" section convention)
    cillNose:     { w: 64, h: 128 },
    // Triple sash mullion post (matches the 3D viewer's 50mm) — FLAGGED default
    mullion:      { face: 50, raw: '63x63' },
  },
  // Length rules (mm subtracted from the window dimension). "Advanced" —
  // geometrically coupled values; changing them reshapes the whole window.
  // Glass makeup labels printed on glass orders (free text; no effect on sizes).
  // Keyed by glass type; the frame variant chooses the type per window.
  glassMakeup: { double: '4x16x4', double_slim: '4x8x4', triple: '4x8x4x8x4', single: '', passive: '' },
  hornExtension: 70,  // sash horn height; per-window spec override wins, this is the workshop default
  dedSchema: 2,       // v2: sashHeight is the PURE opening deduction (MR excluded)
  deductions: {
    sashWidth: 178,   // sash W = frame W − this
    sashHeight: 135,  // OPENING deduction: total sash H = frame H − this + meeting rail face
    // Derivation (Adam's Excel, verified 1:1): upper sash = H/2 − 62.5, lower = H/2 − 29.5
    //   62.5 + 29.5 = 92   → legacy v1 total-CUT deduction (MR=43 baked in)
    //   62.5 − 29.5 = 33   → sash height difference = bottomRail.face − topRail.face
    //   92 + 43     = 135  → v2 pure OPENING deduction; engine adds live MR
    // This number does NOT react to MR/rail edits by design — those enter the formulas directly.
    jambHeight: 108,  // jamb L = frame H − this
    headWidth: 0,     // head L = frame W − this
  },
};

// Timber density calibrated from the legacy kg/m constants
// (2.0 @ 57×57 → 616, 3.1 @ 57×90 → 604, 1.5 @ 57×43 → 612 kg/m³)
export const TIMBER_DENSITY_KG_M3 = 610;

/** kg per running metre for a finished section (mm × mm). */
export function kgPerM(faceMm, depthMm) {
  return (Number(faceMm) * Number(depthMm) * TIMBER_DENSITY_KG_M3) / 1e6;
}

// ─── Casement profile v1 — Piotr 30.07.2026 (casement-dimensioning-v1.md) ───
// FINISHED dimensions only. Raw material is never stored here — it comes from
// Part Registry assignments (resolveRaw). Every value is a per-workshop
// editable default ("settings by client"); formulas in calculations.js read
// exclusively from this object — no bare numbers there.
export const DEFAULT_CASEMENT_PROFILE = {
  frameDepth: 93,   // finished depth of frame / mullion / transom members
  leafDepth: 57,
  leafDepthTriple: 61,  // 28mm triple unit needs a deeper rebate    // finished depth of all leaf members
  elements: {
    frameHead:  { face: 57 },
    frameJamb:  { face: 57 },
    frameCill:  { face: 68 },   // profiled section; envelope 68×93
    mullion:    { face: 68 },   // visible land 26 (13 per side)
    transom:    { face: 68 },
    leafStile:  { face: 67 },   // vertogen: all four leaf members one section,
    leafTop:    { face: 67 },   // each cut to the FULL leaf dimension
    leafBottom: { face: 67 },
  },
  geometry: {
    land: 36,             // frame land (przylga) — visible frame margin
    rebate: 21,           // frame rebate depth (57 − 36)
    gap: 4,               // leaf side fitting gap (jambs, mullions, head)
    mullionLand: 26,      // mullion visible land (13 + 13, symmetric)
    // Transom land is ASYMMETRIC around the element axis (v1.1):
    transomLandAbove: 8,  // visible land above the axis
    transomLandBelow: 13, // visible land below the axis
    gapFanTransom: 6,     // gap between fan bottom rail and transom land
    gapBelowTransom: 4,   // gap between transom land and lower top rail
    gapCill: 6,           // gap between bottom rail and cill
    cillVisible: 41,      // cill front height seen from outside
    glassInset: 12.5,     // glass enters the leaf rebate this deep, per side
    // Layer closure: 36+4 + leafH + 6+41 = extH  (full = extH − 87)
    //                top 36+4 + fan + 6+8 = T    (fan  = T − 54)
    //                13+4 + lower + 6+41 = extH − T (lower = extH − T − 64)
  },
  deductions: {
    // Leaf WIDTH per edge (from frame edge / member axis):
    leafAtJamb: 40,        // land 36 + gap 4
    leafAtMullionAxis: 17, // half-land 13 + gap 4
    // Leaf HEIGHT (T = frame top -> transom axis) — v1.1 layer-verified:
    leafFullHeight: 87,    // no transom: leafH = extH − 87  (40 top + 47 cill side)
    fanFromAxis: 54,       // fan (above transom): leafH = T − 54  (40 + 6 + 8)
    lowerFromAxis: 64,     // below transom: leafH = extH − T − 64  (13+4 + 6+41)
    // Middle tier (transom above AND below, 3-tier 013/023):
    // UNCONFIRMED — awaiting Piotr; provisional symmetric 2×17 like mullions.
    middleTierFromAxes: 34,
    // Glass: DERIVED from the leaf member face — glass = leaf − 2×(face −
    // glassInset). Kept here as the resolved value for display/back-compat;
    // the engine computes it so changing the leaf face resizes the glass
    // (Piotr 04.08). 109 = 2×(67 − 12.5).
    glass: 109,
  },
  lengths: {
    mullion: 77,       // C-M = extH − 77 (full height, runs through)
    transomSeat: 8,    // C-T segment = leaf width of its field + 8
    // Per-element cut deductions (Piotr 04.08) — every member runs the FULL
    // dimension by default (T&G joint), so these are 0 and today's cut lists
    // are unchanged. A workshop without T&G subtracts its own numbers here;
    // cut list AND pre-cut both read them, exactly like the sash page.
    headDeduct: 0,       // C-H  = frame W − this
    jambDeduct: 0,       // C-J  = frame H − this
    cillDeduct: 0,       // C-CILL = frame W (+ ext) − this
    stileDeduct: 0,      // C-ST = leaf H − this
    topRailDeduct: 0,    // C-TR = leaf W − this
    bottomRailDeduct: 0, // C-BR = leaf W − this
    // Partial mullion (031/032 tier divider) — UNCONFIRMED, provisional
    // transom-style rule: adjacent tier leafH + partialMullionSeat.
    partialMullionSeat: 8,
  },
  rounding: 0.1,       // mm — CNC-ready, one decimal
};

let activeProfile = null;
let activeCasementProfile = null;

/**
 * Casement profile schema migration. Stored copies (windowProfileStore
 * persistence, batch _profileSnapshot.casement) may predate v1/v1.1:
 * - pre-v1 prototype (raw fields, sashWidth deductions, no geometry/lengths):
 *   nothing user-set worth keeping — replaced by the current default;
 * - v1 (missing v1.1 transom-layer keys): missing keys filled from the
 *   default, existing values preserved.
 * Without this, deriveCasementWindow crashes on `geometry.land` of undefined
 * and every consumer sees derived = null (blank tabs).
 */
export function migrateCasementProfile(profile) {
  if (!profile) return null;
  const D = DEFAULT_CASEMENT_PROFILE;
  const oldShape = !profile.geometry || !profile.lengths || !profile.elements?.leafStile;
  if (oldShape) return D;
  return {
    ...D, ...profile,
    elements: { ...D.elements, ...profile.elements },
    geometry: { ...D.geometry, ...profile.geometry },
    deductions: { ...D.deductions, ...profile.deductions },
    lengths: { ...D.lengths, ...profile.lengths },
  };
}

export function setActiveCasementProfile(profile) {
  activeCasementProfile = migrateCasementProfile(profile);
}
export function getCasementProfile() {
  return activeCasementProfile || DEFAULT_CASEMENT_PROFILE;
}

// ─── DOOR PROFILE v1 ────────────────────────────────────────────────────────
// Piotr 04.08: the door FRAME is the casement frame with a 4mm deeper rebate
// (61 instead of 57). The LEAF is different: 94mm all round INCLUDING internal
// members, except the bottom rail at 180mm — the height is what keeps a door
// rigid. Threshold has three variants; with 'none' there is NO bottom frame
// member at all, so it must never appear in the cut list.
export const DEFAULT_DOOR_PROFILE = Object.freeze({
  schema: 1,
  frameDepth: 93,
  leafDepth: 61,          // = casement 57 + 4mm deeper rebate
  elements: {
    frameHead:  { face: 57 },
    frameJamb:  { face: 57 },
    frameCill:  { face: 68 },   // outward-opening: same as casement cill
    mullion:    { face: 68 },   // french centre mullion
    leafStile:  { face: 94 },
    leafTop:    { face: 94 },
    leafBottom: { face: 180 },  // deliberately taller — door stiffness
    leafMid:    { face: 94 },   // internal rail (half-glazed / three-quarter)
  },
  // Inward-opening doors cannot have a rebated cill (the leaf must swing in):
  // the internal face is 40mm and falls to 35mm across the leaf depth, so rain
  // runs out. Outward-opening doors reuse the casement cill unchanged.
  cillInward: { faceInternal: 40, faceExternal: 35, runDepth: 61 },
  geometry: {
    land: 36,
    rebate: 25,           // casement 21 + 4mm deeper
    gap: 4,
    mullionLand: 26,
    gapCill: 6,
    cillVisible: 41,
    glassInset: 12.5,
  },
  deductions: {
    leafAtJamb: 40,          // land 36 + gap 4
    leafAtMullionAxis: 17,   // half-land 13 + gap 4
    leafFullHeight: 87,      // with a cill/threshold present
    leafNoThreshold: 46,     // threshold 'none': no bottom member to deduct
  },
  lengths: {
    headDeduct: 0,
    jambDeduct: 0,
    cillDeduct: 0,
    stileDeduct: 0,
    topRailDeduct: 0,
    bottomRailDeduct: 0,
    midRailDeduct: 0,
    mullion: 77,
  },
});

let activeDoorProfile = null;
export function setActiveDoorProfile(profile) {
  activeDoorProfile = profile ? { ...DEFAULT_DOOR_PROFILE, ...profile } : null;
}
export function getDoorProfile() {
  return activeDoorProfile || DEFAULT_DOOR_PROFILE;
}


/**
 * Schema migration for stored sash profiles (Supabase, localStorage cache,
 * batch _profileSnapshot). v1: deductions.sashHeight already "contained" the
 * meeting rail (calibrated at MR=43, total = H − 92). v2: sashHeight is the
 * pure opening deduction and the engine adds MR (total = H − 135 + MR).
 * Idempotent: v1 value += that profile's own meetingRail face, flag set.
 */
export function normalizeSashProfile(p) {
  if (!p || !p.deductions) return p;
  if (!p.glassMakeup) {
    p.glassMakeup = { ...DEFAULT_SASH_PROFILE.glassMakeup };
  }
  if (p.dedSchema !== 2) {
    const mr = Number(p.elements?.meetingRail?.face) || DEFAULT_SASH_PROFILE.elements.meetingRail.face;
    p.deductions.sashHeight = (Number(p.deductions.sashHeight) || 0) + mr;
    p.dedSchema = 2;
  }
  return p;
}

/** Called by windowProfileStore whenever the persisted profile changes. */
export function setActiveWindowProfile(profile) {
  activeProfile = profile ? normalizeSashProfile(profile) : null;
}

/** The engine's single read point. Falls back to the OTD defaults. */
export function getWindowProfile() {
  return activeProfile || DEFAULT_SASH_PROFILE;
}

export function profileVariant(frameType) {
  const p = getWindowProfile();
  return p.variants[frameType] || p.variants.standard;
}

export function profileSashDepth(frameType) {
  return profileVariant(frameType).sashDepth;
}

export function profileBoxDepth(frameType) {
  return profileVariant(frameType).boxDepth;
}

/** Head/Jamb board width for a frame variant. boardWidth is authoritative;
 *  legacy persisted profiles without it fall back to depth − inset. */
export function profileBoardWidth(frameType) {
  const p = getWindowProfile();
  const v = p.variants[frameType] || p.variants.standard;
  return v.boardWidth ?? (v.boxDepth - (p.boardInset ?? 23));
}

/** Legacy helper (by depth) kept for old call sites. */
export function boardWidthForDepth(frameDepth) {
  const p = getWindowProfile();
  const depth = Number(frameDepth) || p.variants.standard.boxDepth;
  const v = Object.values(p.variants).find((x) => x.boxDepth === depth);
  if (v) return v.boardWidth ?? (v.boxDepth - (p.boardInset ?? 23));
  return depth - (p.boardInset ?? 23);
}

/** Temporarily compute with frozen (batch snapshot) profiles. */
export function withProfiles(sashProfile, casementProfile, fn) {
  const prevSash = activeProfile;
  const prevCas = activeCasementProfile;
  if (sashProfile) activeProfile = normalizeSashProfile(sashProfile);
  if (casementProfile) activeCasementProfile = migrateCasementProfile(casementProfile);
  try { return fn(); } finally {
    activeProfile = prevSash;
    activeCasementProfile = prevCas;
  }
}

/**
 * Raw stock for a finished sash section string like "47x90".
 * Matches by face width (second number) against the profile elements,
 * so any variant depth maps correctly (fixes the BR→63x63 regression).
 */
export function profileRawForSection(section) {
  const p = getWindowProfile();
  const face = Number(String(section).toLowerCase().split('x')[1]);
  if (!Number.isFinite(face)) return null;
  const els = p.elements;
  if (face === els.bottomRail.face) return els.bottomRail.raw;
  if (face === els.meetingRail.face) return els.meetingRail.raw;
  if (face === els.stiles.face) return els.stiles.raw;
  if (face === els.topRail.face) return els.topRail.raw;
  if (els.mullion && face === els.mullion.face) return els.mullion.raw;
  const c = getCasementProfile().elements;
  for (const el of Object.values(c)) {
    if (face === el.face) return el.raw;
  }
  return null;
}
