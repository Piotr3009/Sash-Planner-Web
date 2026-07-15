// ─── Window construction profile ───
// Workshop-editable dimensions that drive the engine: finished sections,
// box depths, length deductions, raw-stock mapping and timber weights.
// Different workshops = different NUMBERS, never different formulas.
//
// The defaults below are the OTD profile (Prime Sash Windows' current values).
// The active profile is pushed in by windowProfileStore (persisted per user);
// the engine always reads through getWindowProfile() so plain-function code
// needs no React/store imports.

export const DEFAULT_SASH_PROFILE = {
  // Frame variants: box depth + finished sash depth (planed from the same raw stock)
  variants: {
    standard: { label: 'Standard', boxDepth: 164, sashDepth: 57 },
    slim:     { label: 'Slim',     boxDepth: 144, sashDepth: 47 },
    heritage: { label: 'Heritage', boxDepth: 134, sashDepth: 42 },
    triple:   { label: 'Triple glazing', boxDepth: 172, sashDepth: 61 },
  },
  // Head/Jamb board width = boxDepth − boardInset (164−23=141, 144→121, 134→111, 172→149)
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
    cill:         { w: 69, h: 46 },
    cillNose:     { w: 64, h: 128 },
    // Triple sash mullion post (matches the 3D viewer's 50mm) — FLAGGED default
    mullion:      { face: 50, raw: '63x63' },
  },
  // Length rules (mm subtracted from the window dimension). "Advanced" —
  // geometrically coupled values; changing them reshapes the whole window.
  deductions: {
    sashWidth: 178,   // sash W = frame W − this
    sashHeight: 92,   // total sash H = frame H − this
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


/** Called by windowProfileStore whenever the persisted profile changes. */
export function setActiveWindowProfile(profile) {
  activeProfile = profile || null;
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

export function profileBoardWidth(frameDepth) {
  const p = getWindowProfile();
  const depth = Number(frameDepth) || p.variants.standard.boxDepth;
  return depth - p.boardInset;
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
