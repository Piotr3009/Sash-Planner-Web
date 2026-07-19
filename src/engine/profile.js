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

// ─── Casement profile (simple: outer frame + sash all round; mullions/transoms later) ───
// FLAGGED defaults — drawn from sash practice, Piotr to verify in Window Settings.
export const DEFAULT_CASEMENT_PROFILE = {
  depth: 57, // finished depth for all casement members
  elements: {
    frameHead:  { face: 57, raw: '63x63' },
    frameJamb:  { face: 57, raw: '63x63' },
    frameCill:  { face: 70, raw: '63x95' },
    sashStile:  { face: 47, raw: '63x63' },
    sashTop:    { face: 47, raw: '63x63' },
    sashBottom: { face: 70, raw: '63x95' },
  },
  deductions: {
    // sash sits inside the outer frame: opening minus fitting gap each side
    sashWidth: 122,   // frame W − 2×frame face − 2×4 gap
    sashHeight: 122,
    glassWidth: 64,   // sash W − 2×stile face + 2×15 rebate
    glassHeight: 64,
  },
};

let activeProfile = null;
let activeCasementProfile = null;

export function setActiveCasementProfile(profile) {
  activeCasementProfile = profile || null;
}
export function getCasementProfile() {
  return activeCasementProfile || DEFAULT_CASEMENT_PROFILE;
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
  if (casementProfile) activeCasementProfile = casementProfile;
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
