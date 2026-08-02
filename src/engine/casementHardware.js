// ─────────────────────────────────────────────────────────────────────────────
// CASEMENT HARDWARE — hinge slot catalogue + per-opener selector.
//
// Slots are ASSIGNABLE parts (materialAssignmentStore imports the defs for the
// Assign Materials rows); the engine picks a slot per opener from leaf width
// and computed leaf weight (deriveCasementWindow.leafWeights, margin already
// included). The user decides WHICH product sits in a slot — `hint` is only a
// recommendation shown in the "?" tooltip (Piotr 02.08.2026).
//
// Width limits follow the Nico/BJ Waller catalogue verified 02.08.2026:
//   Restricted Egress 300mm → vent ≤600mm ≤22kg   (8431L/R, 13mm stack)
//   Restricted Egress 400mm → vent ≤700mm ≤26kg   (8441L/R)
//   Atlas Quad 14″          → vent ≤700mm ≤45kg   (Mighton says 700, one
//                             distributor says 750 — kept at 700 until the
//                             Nico datasheet is confirmed at purchase)
//   Atlas HD Egress 16″     → vent ≤1000mm ≤50kg  (no restriction — pair with
//                             a releasable cable restrictor)
// minW = hinge length + fitting clearance (the stay must fit the sash edge).
//
// This module imports nothing — keep it cycle-free (stores import from here).
// ─────────────────────────────────────────────────────────────────────────────

export const CASEMENT_HINGE_SLOTS = [
  {
    id: 'c_hinge_small',
    name: 'Side Hinges — sash <350mm',
    sub: 'friction pair · standard stay + cable restrictor',
    hung: 'side', restricted: false,
    limits: { minW: 0, maxW: 350, maxKg: 18, maxH: Infinity },
    hint: 'Recommended: short standard friction stay (8", confirm SKU when ordering) + the Child Restrictor slot (Nico Safety Catch, BJ Waller RST42012A). No restricted-egress hinge fits below ~350mm.',
  },
  {
    id: 'c_hinge_600',
    name: 'Side Hinges — sash 350–600mm · ≤22kg',
    sub: 'friction pair · restricted egress',
    hung: 'side', restricted: true,
    limits: { minW: 350, maxW: 600, maxKg: 22, maxH: 1300 },
    hint: 'Recommended: Nico Restricted Egress 300mm — SKU 8431L/8431R (13mm stack) or 8436L/8436R (17mm). BJ Waller. Max vent 600mm wide / 1300mm high / 22kg.',
  },
  {
    id: 'c_hinge_700',
    name: 'Side Hinges — sash 600–700mm · ≤26kg',
    sub: 'friction pair · restricted egress',
    hung: 'side', restricted: true,
    limits: { minW: 350, maxW: 700, maxKg: 26, maxH: 1300 },
    hint: 'Recommended: Nico Restricted Egress 400mm — SKU 8441L/8441R (13mm stack) or 8446L/8446R (17mm). BJ Waller. Max vent 700mm wide / 1300mm high / 26kg.',
  },
  {
    id: 'c_hinge_hd',
    name: 'Side Hinges HD — sash ≤700mm · ≤45kg',
    sub: 'friction pair · Quad: restricted + egress + easy clean + heavy duty',
    hung: 'side', restricted: true,
    limits: { minW: 400, maxW: 700, maxKg: 45, maxH: Infinity }, // height limit TBC from Nico datasheet
    hint: 'Recommended: Nico Atlas Quad 14″ — SKU 8470L/8470R (13mm) or 8471L/8471R (17mm), Mighton part numbers. Confirm the Nico code and max vent width (700 vs 750mm) on the datasheet when ordering.',
  },
  {
    id: 'c_hinge_xl',
    name: 'Side Hinges XL — sash 700–1000mm · ≤50kg',
    sub: 'friction pair · egress only, no restriction — add cable restrictor',
    hung: 'side', restricted: false,
    limits: { minW: 450, maxW: 1000, maxKg: 50, maxH: Infinity }, // height limit TBC from Nico datasheet
    hint: 'Recommended: Nico Atlas HD Egress 16″ (BJ Waller — confirm SKU when ordering). No built-in restriction — the engine adds the Child Restrictor slot item (Nico Safety Catch RST42012A) for this slot.',
  },
  // Top hung ladder: the stay sits on the SIDES of the sash, so hinge length
  // must fit the sash HEIGHT (length + ~50mm fitting clearance). Whole-window
  // top hung sashes can be tall, hence four lengths (Nico range 8–24").
  // maxKg 60 is the Nico HD headline figure — per-size limits TBC from the
  // datasheet. No child restriction on top hung (Piotr 02.08.2026).
  {
    id: 'c_hinge_top_8',
    name: 'Top Hung Hinges — sash ≤360mm',
    sub: 'friction pair · 8″ (203mm) · fans and small vents',
    hung: 'top', restricted: false,
    limits: { minH: 253, maxH: 360, maxKg: 60 },
    hint: 'Recommended: Nico HD Top Hung 8″ (confirm SKU when ordering). Sash height 253–360mm.',
  },
  {
    id: 'c_hinge_top_12',
    name: 'Top Hung Hinges — sash 360–660mm',
    sub: 'friction pair · 12″ (305mm)',
    hung: 'top', restricted: false,
    limits: { minH: 355, maxH: 660, maxKg: 60 },
    hint: 'Recommended: Nico HD Top Hung 12″ (confirm SKU when ordering). Sash height 360–660mm.',
  },
  {
    id: 'c_hinge_top_16',
    name: 'Top Hung Hinges — sash 660–1060mm',
    sub: 'friction pair · 16″ (406mm)',
    hung: 'top', restricted: false,
    limits: { minH: 456, maxH: 1060, maxKg: 60 },
    hint: 'Recommended: Nico HD Top Hung 16″ (confirm SKU when ordering). Sash height 660–1060mm.',
  },
  {
    id: 'c_hinge_top_20',
    name: 'Top Hung Hinges — sash >1060mm',
    sub: 'friction pair · 20″ (508mm) · whole-window top hung',
    hung: 'top', restricted: false,
    limits: { minH: 558, maxH: Infinity, maxKg: 60 },
    hint: 'Recommended: Nico HD Top Hung 20″ (confirm SKU when ordering). Sash height above 1060mm.',
  },
];

const TOP_LADDER = ['c_hinge_top_8', 'c_hinge_top_12', 'c_hinge_top_16', 'c_hinge_top_20'];


// ── Espag lock kits (Kenrick Excalibur PAS 24, Suits Lignum — BJ Waller) ──
// One kit per opener: claw lock + steel shootbolts in a single kit, 22mm
// backset, night-vent keeps, SBD. Sizing per the BJ Waller card:
// "To Suit Sash Rebate Size — HEIGHT for side hung / WIDTH for top hung".
// Side-hung kits are handed; the card states LH/RH viewed from the INSIDE,
// which maps onto the same letters as the hinge rule (hinged-left outside →
// RH) — verify on the first order. Top hung kits are unhanded.
export const CASEMENT_LOCK_SLOTS = [
  { id: 'c_lock_312', lo: 312, hi: 448 },
  { id: 'c_lock_372', lo: 372, hi: 508 },
  { id: 'c_lock_502', lo: 502, hi: 702 },
  { id: 'c_lock_702', lo: 702, hi: 962 },
  { id: 'c_lock_958', lo: 958, hi: 1218 },
  { id: 'c_lock_1218', lo: 1218, hi: 1482 },
].map((r) => ({
  ...r,
  name: `Espag Lock Kit \u2014 sash ${r.lo}\u2013${r.hi}mm`,
  sub: 'PAS24 claw + shootbolt kit \u00b7 side: sash height / top: sash width',
  hint: `Recommended: Kenrick Excalibur PAS 24 Kit (Suits Lignum), BJ Waller \u2014 rebate size ${r.lo}\u2013${r.hi}mm. Pick LH/RH (side hung) and packer colour when ordering; SKU shows after size selection on the BJ Waller card.`,
}));

/**
 * Pick a lock kit per opener. Side hung sizes by sash HEIGHT, top hung by
 * sash WIDTH (per the Excalibur card). Overlapping bands resolve to the
 * smallest kit that covers the dimension. Out-of-range picks are flagged,
 * never hidden.
 */
export function selectCasementLocks(panels, leafSizes) {
  return panels.map((pn, i) => {
    if (pn.hinge === 'fixed') return null;
    const sz = leafSizes[i] || {};
    const top = pn.hinge === 'top';
    const dim = top ? (sz.leafW || 0) : (sz.leafH || 0);
    const handing = top ? null : (pn.hinge === 'left' ? 'RH' : 'LH');
    const slot = CASEMENT_LOCK_SLOTS.find((r) => dim >= r.lo && dim <= r.hi);
    if (slot) {
      return { panel: i + 1, hung: top ? 'top' : 'side', handing, slotId: slot.id, dim };
    }
    const fallback = dim < CASEMENT_LOCK_SLOTS[0].lo
      ? CASEMENT_LOCK_SLOTS[0]
      : CASEMENT_LOCK_SLOTS[CASEMENT_LOCK_SLOTS.length - 1];
    return { panel: i + 1, hung: top ? 'top' : 'side', handing, slotId: fallback.id, dim, overLimit: true };
  });
}

/** Aggregate lock picks: { slotId: { LH, RH, unhanded, count, overLimit } }. */
export function summariseLocks(picks) {
  const out = {};
  (picks || []).forEach((p) => {
    if (!p) return;
    const e = (out[p.slotId] ||= { LH: 0, RH: 0, unhanded: 0, count: 0, overLimit: false });
    e.count += 1;
    if (p.handing === 'LH') e.LH += 1;
    else if (p.handing === 'RH') e.RH += 1;
    else e.unhanded += 1;
    if (p.overLimit) e.overLimit = true;
  });
  return out;
}

const SIDE_LADDER = ['c_hinge_600', 'c_hinge_700', 'c_hinge_hd', 'c_hinge_xl'];
const slotById = Object.fromEntries(CASEMENT_HINGE_SLOTS.map((s) => [s.id, s]));

/**
 * Pick a hinge slot per opener.
 * panels[i].hinge: 'fixed' | 'left' | 'right' | 'top'
 * leafSizes[i]: { leafW, leafH }; leafWeights[i]: { weightKg } | null.
 *
 * Handing (Nico/Mighton rule, quoted from the Mighton product page):
 * "A right hand opening window (hinged on the left) requires a right handed
 * pair" — so hinged LEFT → RH pair, hinged RIGHT → LH pair, top hung → none.
 *
 * Returns per-opener picks (null for fixed). `overLimit: true` marks openers
 * outside every catalogue limit — never hide the problem, flag it.
 */
export function selectCasementHinges(panels, leafSizes, leafWeights) {
  return panels.map((pn, i) => {
    if (pn.hinge === 'fixed') return null;
    const s = leafSizes[i] || {};
    const kg = leafWeights?.[i]?.weightKg ?? 0;
    if (pn.hinge === 'top') {
      const H = s.leafH || 0;
      // Longest stay that physically fits the sash height wins.
      let pick = null;
      for (const id of TOP_LADDER) {
        const L = slotById[id].limits;
        if (H >= L.minH && H <= L.maxH) pick = id;
      }
      const over = !pick || kg > slotById[pick || 'c_hinge_top_8'].limits.maxKg;
      return {
        panel: i + 1, hung: 'top', handing: null, slotId: pick || 'c_hinge_top_8',
        leafH: H, weightKg: kg, overLimit: over || undefined,
      };
    }
    const w = s.leafW || 0;
    const handing = pn.hinge === 'left' ? 'RH' : 'LH';
    if (w < slotById.c_hinge_600.limits.minW) {
      const small = slotById.c_hinge_small;
      return {
        panel: i + 1, hung: 'side', handing, slotId: small.id,
        leafW: w, weightKg: kg, overLimit: kg > small.limits.maxKg,
      };
    }
    for (const id of SIDE_LADDER) {
      const L = slotById[id].limits;
      const h = s.leafH || 0;
      if (w >= L.minW && w <= L.maxW && kg <= L.maxKg && h <= L.maxH) {
        return { panel: i + 1, hung: 'side', handing, slotId: id, leafW: w, weightKg: kg };
      }
    }
    // Nothing in the catalogue carries this opener — report on XL, flagged.
    return {
      panel: i + 1, hung: 'side', handing, slotId: 'c_hinge_xl',
      leafW: w, weightKg: kg, overLimit: true,
    };
  });
}

/** Aggregate per-opener picks into pairs per slot: { slotId: { LH, RH, pairs, overLimit } }. */
export function summariseHinges(picks) {
  const out = {};
  (picks || []).forEach((p) => {
    if (!p) return;
    const e = (out[p.slotId] ||= { LH: 0, RH: 0, pairs: 0, overLimit: false });
    e.pairs += 1;
    if (p.handing === 'LH') e.LH += 1;
    if (p.handing === 'RH') e.RH += 1;
    if (p.overLimit) e.overLimit = true;
  });
  return out;
}
