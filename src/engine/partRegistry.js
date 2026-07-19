// ─────────────────────────────────────────────────────────────────────────────
// PART REGISTRY — single source of truth for part identity (sash windows).
//
// One canonical key per physical part ties together:
//   • the Assign Materials row (assignment key),
//   • the engine component names (createComponentRecord elementName),
//   • the drawing highlight key (BoxDetail2D / SashDetail2D),
//   • the display label,
//   • LIVE sections computed from the workshop profile (no baked "28×141").
//
// Assignment model (schema 2): ONE base assignment per part covers ALL frame
// variants via inheritance; optional per-variant overrides. Legacy per-variant
// ids (head_slim, jambs_triple, …) map here for migration and are expanded
// back for consumers that still read the flat shape.
//
// liveSection() takes the profile as an ARGUMENT — this module imports no
// stores and stays cycle-free.
// ─────────────────────────────────────────────────────────────────────────────

import { VARIANT_ORDER } from './profile.js';

const fmt = (a, b) => `${a}×${b}`;

// variantAware: true → base assignment inherits to every variant, overrides allowed.
// legacyVariantIds: old flat assignment ids that meant "this part, that variant".
export const PART_REGISTRY = {
  // ── Box frame ──────────────────────────────────────────────────────────────
  head: {
    label: 'Head', category: 'box', pcs: 1, materialType: 'hardwood',
    variantAware: true,
    legacyVariantIds: { slim: 'head_slim', heritage: 'head_heritage', triple: 'head_triple' },
    engineNames: ['HEAD'], drawingKey: 'head',
    liveSection: (p, v = 'standard') =>
      fmt(p?.elements?.head?.thickness ?? 28, p?.variants?.[v]?.boardWidth ?? p?.variants?.standard?.boardWidth ?? 141),
  },
  jambs: {
    label: 'Jambs', category: 'box', pcs: 2, materialType: 'hardwood',
    variantAware: true,
    legacyVariantIds: { slim: 'jambs_slim', heritage: 'jambs_heritage', triple: 'jambs_triple' },
    engineNames: ['JAMB (L)', 'JAMB (R)'], drawingKey: 'jambs',
    liveSection: (p, v = 'standard') =>
      fmt(p?.elements?.jambs?.thickness ?? 28, p?.variants?.[v]?.boardWidth ?? p?.variants?.standard?.boardWidth ?? 141),
  },
  mullion: {
    label: 'Mullion Post', category: 'box', pcs: 2, materialType: 'hardwood', note: 'triple sash',
    variantAware: true, engineNames: [], drawingKey: null,
    liveSection: (p, v = 'standard') =>
      fmt(p?.elements?.mullion?.face ?? 50, p?.variants?.[v]?.boardWidth ?? 141),
  },
  cill: {
    label: 'Cill', category: 'box', pcs: 1, materialType: 'hardwood',
    engineNames: ['CILL'], drawingKey: 'cill',
    liveSection: (p) => fmt(p?.elements?.cill?.w ?? 69, p?.elements?.cill?.h ?? 46),
  },
  cill_nose: {
    label: 'Cill Nose', category: 'box', pcs: 1, materialType: 'hardwood',
    engineNames: ['CILL NOSE'], drawingKey: 'cill',
    liveSection: (p) => fmt(p?.elements?.cillNose?.w ?? 64, p?.elements?.cillNose?.h ?? 128),
  },
  cill_extension: {
    label: 'Cill Extension', category: 'box', pcs: 1, materialType: 'hardwood', optional: true,
    engineNames: ['CILL EXTENSION'], drawingKey: 'cill',
    liveSection: () => '—',
  },
  ext_head_liner: {
    label: 'External Head Liner', category: 'box', pcs: 1, materialType: 'softwood',
    engineNames: ['EXTERNAL HEAD LINER'], drawingKey: 'extHeadLiner',
    liveSection: (p) => fmt(p?.elements?.extHeadLiner?.w ?? 17, p?.elements?.extHeadLiner?.h ?? 102),
  },
  int_head_liner: {
    label: 'Internal Head Liner', category: 'box', pcs: 1, materialType: 'softwood',
    engineNames: ['INTERNAL HEAD LINER'], drawingKey: 'intHeadLiner',
    liveSection: (p) => fmt(p?.elements?.intHeadLiner?.w ?? 17, p?.elements?.intHeadLiner?.h ?? 86),
  },
  ext_jamb_liner: {
    label: 'External Jamb Liner', category: 'box', pcs: 2, materialType: 'softwood',
    engineNames: ['EXTERNAL JAMB LINER (L)', 'EXTERNAL JAMB LINER (R)'], drawingKey: 'extJambLiner',
    liveSection: (p) => fmt(p?.elements?.extJambLiner?.w ?? 17, p?.elements?.extJambLiner?.h ?? 102),
  },
  int_jamb_liner: {
    label: 'Internal Jamb Liner', category: 'box', pcs: 2, materialType: 'softwood',
    engineNames: ['INTERNAL JAMB LINER (L)', 'INTERNAL JAMB LINER (R)'], drawingKey: 'intJambLiner',
    liveSection: (p) => fmt(p?.elements?.intJambLiner?.w ?? 17, p?.elements?.intJambLiner?.h ?? 86),
  },

  // ── Sash ───────────────────────────────────────────────────────────────────
  // Raw column stays the stored raw stock; finished section is live:
  // variant sashDepth × profile face. Variant-aware via depth (57/47/42/61).
  top_rail: {
    label: 'Top Rail', category: 'sash', pcs: 1, materialType: 'hardwood',
    variantAware: true,
    engineNames: ['TOP RAIL'], drawingKey: 'topRail',
    liveSection: (p, v = 'standard') =>
      fmt(p?.variants?.[v]?.sashDepth ?? 57, p?.elements?.topRail?.face ?? 57),
  },
  stiles_top_sash: {
    label: 'Stiles Top', category: 'sash', pcs: 2, materialType: 'hardwood', mirror: true,
    variantAware: true,
    engineNames: ['STILES TOP (L)', 'STILES TOP (R)'], drawingKey: 'stiles',
    liveSection: (p, v = 'standard') =>
      fmt(p?.variants?.[v]?.sashDepth ?? 57, p?.elements?.stiles?.face ?? 57),
  },
  stiles_bottom_sash: {
    label: 'Stiles Bottom Sash', category: 'sash', pcs: 2, materialType: 'hardwood', mirror: true,
    variantAware: true,
    engineNames: ['STILES BOTTOM SASH (L)', 'STILES BOTTOM SASH (R)'], drawingKey: 'stiles',
    liveSection: (p, v = 'standard') =>
      fmt(p?.variants?.[v]?.sashDepth ?? 57, p?.elements?.stiles?.face ?? 57),
  },
  bottom_rail: {
    label: 'Bottom Rail', category: 'sash', pcs: 1, materialType: 'hardwood',
    variantAware: true,
    engineNames: ['BOTTOM RAIL'], drawingKey: 'bottomRail',
    liveSection: (p, v = 'standard') =>
      fmt(p?.variants?.[v]?.sashDepth ?? 57, p?.elements?.bottomRail?.face ?? 90),
  },
  top_meet_rail: {
    label: 'Top Meeting Rail', category: 'sash', pcs: 1, materialType: 'hardwood',
    variantAware: true,
    engineNames: ['TOP MEETING RAIL'], drawingKey: 'meetingRail',
    liveSection: (p, v = 'standard') =>
      fmt(p?.variants?.[v]?.sashDepth ?? 57, p?.elements?.meetingRail?.face ?? 43),
  },
  bottom_meet_rail: {
    label: 'Bottom Meeting Rail', category: 'sash', pcs: 1, materialType: 'hardwood',
    variantAware: true,
    engineNames: ['BOTTOM MEETING RAIL'], drawingKey: 'meetingRail',
    liveSection: (p, v = 'standard') =>
      fmt(p?.variants?.[v]?.sashDepth ?? 57, p?.elements?.meetingRail?.face ?? 43),
  },
};

// ── Legacy id → canonical mapping ───────────────────────────────────────────
// legacyToCanonical('head_slim') → { key: 'head', variantKey: 'slim' }
// legacyToCanonical('head')      → { key: 'head', variantKey: null }  (base)
// Unknown ids (beading, glass, paint, consumables, casement) → themselves.
const LEGACY_MAP = (() => {
  const m = {};
  for (const [key, def] of Object.entries(PART_REGISTRY)) {
    m[key] = { key, variantKey: null };
    for (const [vk, legacyId] of Object.entries(def.legacyVariantIds || {})) {
      m[legacyId] = { key, variantKey: vk };
    }
  }
  return m;
})();

export function legacyToCanonical(id) {
  return LEGACY_MAP[id] || { key: id, variantKey: null };
}

// ── Assignments schema 2 ────────────────────────────────────────────────────
// { schema: 2, base: { [key]: {material_id, yield, ...} },
//   overrides: { [key]: { [variantKey]: {material_id, yield, ...} } } }

export function normalizeAssignments(raw) {
  if (!raw || typeof raw !== 'object') return { schema: 2, base: {}, overrides: {} };
  if (raw.schema === 2) {
    return { schema: 2, base: raw.base || {}, overrides: raw.overrides || {}, customParts: raw.customParts || [] };
  }
  const out = { schema: 2, base: {}, overrides: {}, customParts: [] };
  for (const [id, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;
    const { key, variantKey } = legacyToCanonical(id);
    if (!variantKey) { out.base[key] = { ...val }; }
  }
  // Second pass: variant rows become overrides only where they differ from base.
  for (const [id, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;
    const { key, variantKey } = legacyToCanonical(id);
    if (!variantKey) continue;
    const base = out.base[key];
    if (!base && val.material_id) {
      // Family has no base row assigned — promote the first variant to base.
      out.base[key] = { ...val };
      continue;
    }
    const differs = base && (
      (val.material_id || '') !== (base.material_id || '') ||
      Number(val.yield ?? 1) !== Number(base.yield ?? 1)
    );
    if (differs) {
      out.overrides[key] = out.overrides[key] || {};
      out.overrides[key][variantKey] = { ...val };
    }
  }
  return out;
}

// Flat legacy view WITH inheritance: every legacy id (base + all variant ids)
// resolves to its effective assignment. Keeps the current UI/consumers working
// unchanged, and makes "assign base once → all variants covered" visible.
export function expandAssignments(data) {
  const d = normalizeAssignments(data);
  const flat = {};
  for (const [key, val] of Object.entries(d.base)) {
    flat[key] = { ...val };
    const def = PART_REGISTRY[key];
    for (const [vk, legacyId] of Object.entries(def?.legacyVariantIds || {})) {
      flat[legacyId] = { ...(d.overrides?.[key]?.[vk] || val) };
    }
  }
  // Overrides whose family has no base yet (edge case) still surface.
  for (const [key, byVariant] of Object.entries(d.overrides || {})) {
    const def = PART_REGISTRY[key];
    for (const [vk, val] of Object.entries(byVariant)) {
      const legacyId = def?.legacyVariantIds?.[vk];
      if (legacyId && !flat[legacyId]) flat[legacyId] = { ...val };
    }
  }
  return flat;
}

// Effective assignment for a part + window variant (engine/BOM entry point).
export function assignmentFor(data, partKey, variantKey = 'standard') {
  const d = normalizeAssignments(data);
  return d.overrides?.[partKey]?.[variantKey] || d.base?.[partKey] || null;
}

// ── Live sections for the Assign Materials page ─────────────────────────────
// Returns { section, finishedSection } computed from the profile, or null when
// the part is not in the registry (beading/glass/paint/consumables/casement —
// their static labels are profile-independent).
export function liveSectionsFor(partId, profile, variantKey = 'standard') {
  const def = PART_REGISTRY[legacyToCanonical(partId).key];
  if (!def) return null;
  const vk = legacyToCanonical(partId).variantKey || variantKey;
  if (def.liveSection) return { section: def.liveSection(profile, vk), finishedSection: null };
  if (def.liveRaw) {
    return {
      section: String(def.liveRaw(profile)).replace('x', '×'),
      finishedSection: def.liveFinished ? def.liveFinished(profile, vk) : null,
    };
  }
  return null;
}

export const REGISTRY_VARIANTS = VARIANT_ORDER;
