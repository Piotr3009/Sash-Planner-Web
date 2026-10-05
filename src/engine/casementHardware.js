// ─────────────────────────────────────────────────────────────────────────────
// CASEMENT HARDWARE — hinge slot catalogue + per-opener selector.
//
// Slots are ASSIGNABLE parts (materialAssignmentStore imports the defs for the
// Assign Materials rows); the engine picks a slot per opener from the leaf
// size and the computed leaf weight (deriveCasementWindow.leafWeights, margin
// already included). The user decides WHICH product sits in a slot.
//
// HINGE SET (Piotr 04.10.2026) — ten rows named by their RANGE only: no brand,
// no model, no LH / RH. The supplier lists ONE code per size, sold "Per Pair",
// with no LH / RH option — read as: a pair fits a sash of either hand (an
// inference from the single code, not a sentence on the card). So a row counts
// PAIRS — one per opener — and is not split by hand.
//
// The limits are the BJ Waller cards of the stays the workshop fits, read
// 04.10.2026 (max sash width / height / weight for the application):
//   side hung  HIN06108     210mm standard       ≤400 w   ≤1200 h  18kg → up to 360
//              HIN06412EC   311mm egress / e.c.  ≤600 w   ≤1200 h  18kg → 360–460
//              HIN06416EC   413mm egress / e.c.  ≤600 w   ≤1200 h  21kg → 460–600
//              HIN06416ECEX 406mm extreme HD     ≤800 w   (none)   35kg → HD 460–800
//   top hung   HIN06108     210mm standard       ≤1200 w  ≤300 h   10kg → up to 300
//              HIN06110     260mm standard       ≤1200 w  ≤450 h   16kg → 300–450
//              HIN06120     511mm standard       ≤1200 w  ≤900 h   24kg → 450–900
//              HIN06124     616mm standard       ≤1200 w  ≤1500 h  50kg → HD 660–1500
// plus one XL row per application for oversize sashes — up to 1200 × 1800mm,
// no weight limit; the workshop assigns what it fits there.
//
// MINIMUM SIZE = stay length + ~50mm fitting clearance: the stay must fit the
// edge it is fixed along — the sash WIDTH for side hung, the sash HEIGHT for
// top hung. That is the engine's own assumption (kept from the 02.08.2026
// catalogue), not a figure from the cards; the row boundaries 360 / 460 / 660
// are those minimums rounded to the row names, and the 300–450 top hung row
// starts at 300 as its name says (260mm stay + 40mm) so that 300–310 is not a
// gap. The XL rows start where the HD rows start (460 wide / 660 high).
//
// HD side hung: the card gives no height limit — the row is capped at 1800mm,
// the oversize envelope, so that nothing taller passes without a flag.
//
// The gaps are deliberate and flagged, never hidden:
//   side hung — a sash under 460mm wide that is over 1200mm high or over 18kg
//               (no longer stay fits its width);
//   top hung  — a sash 451–560mm high (over the 260mm stay's height limit,
//               too short for the 511mm stay — BJ Waller's standard range has
//               nothing between them), and a sash under 660mm high that is
//               too heavy for its row.
//
// Child restriction: none of these stays is restricted, so the BOM adds the
// separate Child Restrictor for EVERY side hung opener when the window asks
// for it (bom.js). No child restriction on top hung (Piotr 02.08.2026).
//
// This module imports nothing — keep it cycle-free (stores import from here).
// ─────────────────────────────────────────────────────────────────────────────

// Ladder order = selection order: the first row whose limits all hold wins.
//   side: { minW, maxW, maxH, maxKg }   top: { minH, maxH, maxW, maxKg }
//
// WEDGE PACKER (Piotr 05.10.2026): one wedge per SIDE hung opener, under the
// BOTTOM hinge only — on the cill, or on the transom when the leaf sits above
// one — as long as the hinge itself. HINGE_WEDGE_MM holds that length per side
// hung row: the stay the row is sized for (210 / 311 / 413 / 406), and an
// agreed 500mm on the XL row, whose product is the workshop's choice. Top hung
// rows have none (the stays sit on the sides of the sash).
const HINGE_WEDGE_MM = {
  c_hinge_side_360: 210,
  c_hinge_side_460: 311,
  c_hinge_side_600: 413,
  c_hinge_side_800: 406,
  c_hinge_side_xl: 500,
};

/** Wedge packer length (mm) for ONE opener on this hinge slot; 0 for top hung. */
export function hingeWedgeMm(slotId) {
  return HINGE_WEDGE_MM[slotId] || 0;
}
const HINGE_ROWS = [
  // ── Side hung — by sash WIDTH ──
  ['c_hinge_side_360', 'Side Hinges — sash up to 360mm · ≤18kg', 'side', { minW: 260, maxW: 360, maxH: 1200, maxKg: 18 }],
  ['c_hinge_side_460', 'Side Hinges — sash 360–460mm · ≤18kg', 'side', { minW: 360, maxW: 460, maxH: 1200, maxKg: 18 }],
  ['c_hinge_side_600', 'Side Hinges — sash 460–600mm · ≤21kg', 'side', { minW: 460, maxW: 600, maxH: 1200, maxKg: 21 }],
  ['c_hinge_side_800', 'Side Hinges HD — sash 460–800mm · ≤35kg', 'side', { minW: 460, maxW: 800, maxH: 1800, maxKg: 35 }],
  ['c_hinge_side_xl', 'Side Hinges XL — oversize up to 1200 × 1800mm', 'side', { minW: 460, maxW: 1200, maxH: 1800, maxKg: Infinity }],
  // ── Top hung — by sash HEIGHT (the stays sit on the sides of the sash) ──
  ['c_hinge_top_300', 'Top Hung Hinges — sash up to 300mm · ≤10kg', 'top', { minH: 260, maxH: 300, maxW: 1200, maxKg: 10 }],
  ['c_hinge_top_450', 'Top Hung Hinges — sash 300–450mm · ≤16kg', 'top', { minH: 300, maxH: 450, maxW: 1200, maxKg: 16 }],
  ['c_hinge_top_900', 'Top Hung Hinges — sash 450–900mm · ≤24kg', 'top', { minH: 561, maxH: 900, maxW: 1200, maxKg: 24 }],
  ['c_hinge_top_1500', 'Top Hung Hinges HD — sash 660–1500mm · ≤50kg', 'top', { minH: 660, maxH: 1500, maxW: 1200, maxKg: 50 }],
  ['c_hinge_top_xl', 'Top Hung Hinges XL — oversize up to 1200 × 1800mm', 'top', { minH: 660, maxH: 1800, maxW: 1200, maxKg: Infinity }],
];

const HINGE_XL_NOTE = 'no weight limit: assign a hinge rated for the heaviest sash you make.';
const FLAG = '"! verify limits"';

// Does any later row of the same ladder ever take a sash this row refuses —
// one that reaches down to this row's edge AND carries more weight or a
// bigger other dimension? False for "up to 360" (HD starts at 460) and
// "300–450" (the next stay needs 561): a sash over those limits is always
// flagged, and the hint says so instead of promising a stronger row.
const hasStrongerRow = (i) => {
  const [, , hung, L] = HINGE_ROWS[i];
  const edgeMax = hung === 'side' ? L.maxW : L.maxH;
  const otherMax = hung === 'side' ? L.maxH : L.maxW;
  return HINGE_ROWS.slice(i + 1).some(([, , h2, M]) => h2 === hung
    && (hung === 'side' ? M.minW : M.minH) <= edgeMax
    && (M.maxKg > L.maxKg || (hung === 'side' ? M.maxH : M.maxW) > otherMax));
};

// The "?" tooltips carry the limits only, built from the numbers the selector
// reads — a hint can never disagree with the engine.
const hingeHint = (i) => {
  const [, , hung, L] = HINGE_ROWS[i];
  const side = hung === 'side';
  const pairNote = side ? ' One pair per opener — the same row for left and right hand.' : ' One pair per opener.';
  if (L.maxKg === Infinity) {
    return `${side ? 'Side' : 'Top'} hung, oversize — the engine sends here every sash from ${side ? `${L.minW}mm wide` : `${L.minH}mm high`} that the rows above cannot carry. Limits: sash width up to ${L.maxW}mm · sash height up to ${L.maxH}mm · ${HINGE_XL_NOTE} A sash above ${L.maxW} × ${L.maxH}mm is flagged ${FLAG}.${pairNote}`;
  }
  const flagNote = hasStrongerRow(i)
    ? `A sash over a limit moves to the next stronger row that fits it; if no row fits, it is flagged ${FLAG}.`
    : `A sash over a limit is flagged ${FLAG} — no stronger row takes a sash this ${side ? 'narrow' : 'short'}.`;
  return side
    ? `Side hung — the engine picks the row by sash WIDTH. Limits: sash width ${L.minW}–${L.maxW}mm · sash height up to ${L.maxH}mm · sash weight up to ${L.maxKg}kg. ${flagNote}${pairNote}`
    : `Top hung — the engine picks the row by sash HEIGHT. Limits: sash height ${L.minH}–${L.maxH}mm · sash width up to ${L.maxW}mm · sash weight up to ${L.maxKg}kg. ${flagNote}${pairNote}`;
};

export const CASEMENT_HINGE_SLOTS = HINGE_ROWS.map(([id, name, hung, limits], i) => ({
  id, name, hung, limits,
  sub: `friction pair · ${hung} hung`,
  hint: hingeHint(i),
}));


// ── Espag lock kits (Kenrick Excalibur PAS 24, Suits Lignum — BJ Waller) ──
// One kit per opener: claw lock + steel shootbolts in a single kit, 22mm
// backset, night-vent keeps, SBD.
//
// SIZE BANDS = the BJ Waller card, "To Suit Sash Rebate Size — HEIGHT for side
// hung / WIDTH for top hung", read on the card 04.10.2026: the PAS 24 kits,
// side and top hung, carry exactly these six bands (the Standard kits too, bar
// one variant listed as 480–750), and the Joinery Core materials are entered
// with the same sizes. They replace the 312–448 … 1218–1482 ladder of
// 02.08.2026, which does not match the card.
//
// Three purchasable codes per band — LH and RH (side hung, handed) and TOP
// (top hung, unhanded) — so every band expands into three assignment rows
// (CASEMENT_LOCK_PARTS below). The hinge rows are NOT split: one code per
// size, sold per pair.
//
// Below 350mm no kit is made (the shortest shootbolt extension, 135mm, suits
// 350–490): those openers go to `c_lock_sub350` — ONE row for every hand, the
// workshop assigns what it fits there. Above 1520mm the largest kit is
// reported and flagged — out-of-range picks are never hidden.
//
// Handing, from the card: "LH — Anti-clockwise Opening (Viewed From the Inside
// / Outward Opening)", "RH — Clockwise Opening (…)". Seen from above, a sash
// hinged on its LEFT (inside view) swings anti-clockwise as it opens outward,
// so LH = hinged left from INSIDE = hinged RIGHT from OUTSIDE — panel hinge
// 'right' → LH, 'left' → RH (the layouts are drawn in the exterior view).
// Confirm on the first order.
//
// The engine compares the overall LEAF height / width with the band, as it
// did before. The card says "sash rebate size": whether that equals the leaf
// size on this profile is the workshop's call (open point, 04.10.2026).
const LOCK_SUB_ID = 'c_lock_sub350';
const LOCK_KIT_BANDS = [[350, 490], [420, 550], [540, 750], [740, 1000], [1000, 1260], [1260, 1520]];

export const CASEMENT_LOCK_SLOTS = [
  {
    id: LOCK_SUB_ID, lo: 0, hi: LOCK_KIT_BANDS[0][0], kit: false,   // hi is exclusive: 350 itself takes the first kit
    name: 'Lock — sash <350mm',
    sub: 'no espag kit this short · gearbox only or casement fastener',
    hint: 'No Excalibur kit is made this short: the smallest BJ Waller kit suits a 350mm sash rebate (shortest shootbolt extension 135mm). Assign what the workshop fits instead — the Excalibur gearbox with claws on its own (BJ Waller KEX20022XL, 22mm backset, no shootbolts) or a casement fastener. Outside the PAS 24 tested kit sizes. One row for LH, RH and top hung alike; side hung counts by sash height, top hung by sash width.',
  },
  ...LOCK_KIT_BANDS.map(([lo, hi], i) => ({
    id: `c_lock_${lo}`, lo, hi, kit: true,
    name: `Espag Lock Kit — sash ${lo}–${hi}mm`,
    sub: 'PAS24 claw + shootbolt kit · side: sash height / top: sash width',
    hint: `Kenrick Excalibur PAS 24 Kit (Suits Lignum), BJ Waller — to suit sash rebate size ${lo}–${hi}mm, 22mm backset. Pick the packer colour when ordering.${
      i === LOCK_KIT_BANDS.length - 1
        ? ` Above ${hi}mm the engine still reports this kit, flagged "! verify size" — BJ Waller lists a 300mm extension piece (KEX90300) as "additional required for 1470mm +"; confirm with the supplier.`
        : ''}`,
  })),
];

const LOCK_KIT_SLOTS = CASEMENT_LOCK_SLOTS.filter((s) => s.kit);

/**
 * Pick a lock per opener. Side hung sizes by sash HEIGHT, top hung by sash
 * WIDTH (per the Excalibur card). Below the smallest kit → the <350 slot.
 * Overlapping bands resolve to the smallest kit that covers the dimension.
 * Above the largest kit, or with no size at all, the pick is flagged
 * (`overLimit`), never hidden.
 */
export function selectCasementLocks(panels, leafSizes) {
  return panels.map((pn, i) => {
    if (pn.hinge === 'fixed') return null;
    const sz = leafSizes[i] || {};
    const top = pn.hinge === 'top';
    const dim = top ? (sz.leafW || 0) : (sz.leafH || 0);
    const handing = top ? null : (pn.hinge === 'left' ? 'RH' : 'LH');
    const base = { panel: i + 1, hung: top ? 'top' : 'side', handing };
    // A missing size is a data problem, not a small sash.
    if (!(dim > 0)) return { ...base, slotId: LOCK_SUB_ID, dim, overLimit: true };
    if (dim < LOCK_KIT_SLOTS[0].lo) return { ...base, slotId: LOCK_SUB_ID, dim };
    const slot = LOCK_KIT_SLOTS.find((r) => dim >= r.lo && dim <= r.hi);
    if (slot) return { ...base, slotId: slot.id, dim };
    return { ...base, slotId: LOCK_KIT_SLOTS[LOCK_KIT_SLOTS.length - 1].id, dim, overLimit: true };
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

const HINGE_LADDER = {
  side: CASEMENT_HINGE_SLOTS.filter((s) => s.hung === 'side'),
  top: CASEMENT_HINGE_SLOTS.filter((s) => s.hung === 'top'),
};

/** Every limit of the slot holds for this sash (a limit the slot lacks is open). */
function hingeSlotCarries(slot, w, h, kg) {
  const L = slot.limits;
  return w >= (L.minW ?? 0) && w <= (L.maxW ?? Infinity)
    && h >= (L.minH ?? 0) && h <= (L.maxH ?? Infinity)
    && kg <= (L.maxKg ?? Infinity);
}

/**
 * Pick a hinge slot per opener.
 * panels[i].hinge: 'fixed' | 'left' | 'right' | 'top'
 * leafSizes[i]: { leafW, leafH }; leafWeights[i]: { weightKg } | null.
 *
 * The FIRST row of the ladder whose limits all hold wins — the smallest stay
 * that carries the sash; a sash too heavy or too tall for its row moves on to
 * the stronger ones (HD, then XL).
 *
 * When no row carries the opener it is reported, flagged, on the LARGEST row
 * whose stay still fits the sash edge (width for side hung, height for top
 * hung) — a stay that can physically be fitted, over its rating — or on the
 * smallest row when even that one is too long. `overLimit: true` marks those
 * picks — never hide the problem, flag it.
 *
 * No handing: the stays have no LH / RH code (the lock picks carry the hand).
 * Returns per-opener picks (null for fixed).
 */
export function selectCasementHinges(panels, leafSizes, leafWeights) {
  return panels.map((pn, i) => {
    if (pn.hinge === 'fixed') return null;
    const s = leafSizes[i] || {};
    const w = s.leafW || 0;
    const h = s.leafH || 0;
    const kg = leafWeights?.[i]?.weightKg ?? 0;
    const top = pn.hinge === 'top';
    const ladder = top ? HINGE_LADDER.top : HINGE_LADDER.side;
    const base = { panel: i + 1, hung: top ? 'top' : 'side' };
    const size = { leafW: w, leafH: h, weightKg: kg };
    const slot = ladder.find((r) => hingeSlotCarries(r, w, h, kg));
    if (slot) return { ...base, slotId: slot.id, ...size };
    const edge = top ? h : w;
    const fitting = ladder.filter((r) => edge >= (top ? r.limits.minH : r.limits.minW));
    const home = fitting[fitting.length - 1] || ladder[0];
    return { ...base, slotId: home.id, ...size, overLimit: true };
  });
}

/** Aggregate per-opener picks into pairs per slot: { slotId: { pairs, overLimit } }. */
export function summariseHinges(picks) {
  const out = {};
  (picks || []).forEach((p) => {
    if (!p) return;
    const e = (out[p.slotId] ||= { pairs: 0, overLimit: false });
    e.pairs += 1;
    if (p.overLimit) e.overLimit = true;
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT ROWS (Assign Materials) — one row per hinge slot.
//
// The stays are bought per PAIR with no LH / RH code, so a side hung slot is
// ONE row for both hands (until 04.10.2026 it was split into an LH and an RH
// row); the quantity is pairs, one per opener. A product sold per piece is
// handled with Yield 2 on its row.
// ─────────────────────────────────────────────────────────────────────────────
export const CASEMENT_HINGE_PARTS = CASEMENT_HINGE_SLOTS.map((s) => ({
  id: s.id, name: s.name, hint: s.hint, hand: null, slotId: s.id,
}));

// ── Lock assignment rows ── one row per PURCHASABLE code: each kit band
// splits into LH / RH (side hung) and TOP (top hung, unhanded) — three separate
// products with their own stock; the <350 slot stays ONE row.
// Viewpoints: our drawings are the exterior view, the BJ Waller card is the
// interior view — the notes below spell out both.
const LOCK_HAND_NOTE = {
  LH: 'LH kit — sash hinged RIGHT viewed from OUTSIDE (BJ Waller card: "LH — anti-clockwise opening, viewed from the inside"). Sized by sash HEIGHT. ',
  RH: 'RH kit — sash hinged LEFT viewed from OUTSIDE (BJ Waller card: "RH — clockwise opening, viewed from the inside"). Sized by sash HEIGHT. ',
  TOP: 'Top hung kit — unhanded. Sized by sash WIDTH. ',
};

/**
 * Assignment part id for a lock slot + hand: 'LH' | 'RH' (side hung), or null
 * / 'TOP' for top hung — null is how the picks carry a top hung opener. The
 * <350 slot is a single row whatever the hand.
 */
export function lockPartId(slotId, handing) {
  if (!slotId) return null;
  if (slotId === LOCK_SUB_ID) return slotId;
  return `${slotId}_${handing ? String(handing).toLowerCase() : 'top'}`;
}

export const CASEMENT_LOCK_PARTS = CASEMENT_LOCK_SLOTS.flatMap((s) => (
  s.kit
    ? ['LH', 'RH', 'TOP'].map((hand) => ({
      id: lockPartId(s.id, hand),
      name: `${s.name} · ${hand}`,
      hint: `${LOCK_HAND_NOTE[hand]}${s.hint}`,
      hand,
      slotId: s.id,
    }))
    : [{ id: s.id, name: s.name, hint: s.hint, hand: null, slotId: s.id }]
));
