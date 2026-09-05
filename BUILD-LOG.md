# BUILD-LOG.md

Verdicts per phase, in execution order.

---

## 2026-09-06 — arched-casement-v2 night 3: A + B + C + t18 (branch `claude/arched-casement-v2-impl-0j27uw`)

Inputs read in full, in this order: `CLAUDE.md` → `ARCHED-CASEMENT-v2.md` (spec, P1–P10 override v1) →
`ARCHED-CASEMENT-v1.md` §0 → `ARCHED-CASEMENT-v1-AUDIT.md` §2 → `-AS-BUILT.md`, `BLOCKERS.md`, `BUILD-LOG.md`
(night 2). Baseline on the branch start (`faedf98` = `origin/main`): t16 465/465, t17 73/73 ALL PASS.
The spec v2 §3 vectors were checked by hand before coding (r 150 / R 1400 / T (392, 144) / 73.74° /
1180.72 etc. all follow from P3) — they are the expected values, the harness reproduces them.
PSW clone (read-only) succeeded: `FixFrameWindow.jsx` 667–830 / 847–1030 and `price-calculator.js`
985–1000 were read for the bar patterns and `PATTERNS_FOR_SHAPE`.

Decisions taken up front (details in BLOCKERS.md §9):
1. `segmental` is removed from `ARCH_SHAPES` (P2). The t16 §10.1 / §10.2 segmental vectors are
   superseded by a three-centre rise 240 under P3 (r clamps to 150, crown R 1320); the 390 vector is
   unchanged (r 253.5 > 150). t16 §10.3 item 10 now freezes `casementLayouts.js` + `jambDxf.js` only —
   `lists.js` / `calculations.js` are in scope for v2 (B).
2. `archArcs(shape, W, rise, { minHaunchRadius })`: the P3 minimum is an option so pure-geometry
   callers keep the v1 rule; `buildArchGeometry` reads it from `profile.arch.minHaunchRadius` (required,
   readable error when missing). Consequence F2: a Round arch needs rise > 150 (rise = r leaves no crown
   arc) — at W 400 the PSW defaults (80 / 130) are rejected; Auto (0.325 W) clears 150 from W 462.
3. Profile `arch` block → version 3 (`minHaunchRadius`, `patterns` ring ratios / tracery pitch); a stored
   v2 block is replaced whole (no UI edits it).

### A — configurator (`ConfiguratorPage.jsx`, `projectStore.js`, `specification.js`, `arch.js`, `profile.js`)

**Understanding:** the joiner picks Round | Gothic and types where the arch starts (mm from the cill);
rise = H − start; the engine shape (semi-circle / three-centre) is a result, as are the radii.

**Two approaches, one rejected:** (a) keep `rise` as the state and derive `start` for display — rejected:
"changing H keeps start, recomputes rise" (P4) is natural only when `start` is the state; (b) `start` is
the state, `rise` derived, `resolveRoundShape` picks the engine shape — chosen.

**Built:**
- `arch.js`: `ARCH_SHAPES` without segmental, `LEGACY_ARCH_SHAPES` (v1 'segmental' → three-centre 0.20 W),
  `PSW_ARCH_RISE_RATIO`, `ROUND_AUTO_RATIO` 0.325, `resolveRoundShape(W, rise)` (±0.5 → semi-circle, above
  half → "use Gothic"), `readMinHaunchRadius`, bar-pattern vocabulary (`ARCH_BAR_PATTERNS`,
  `PATTERNS_FOR_SHAPE` from PSW 990–995, `isHubPattern`), `buildArchGeometry` returns `start`, `radii`,
  `minHaunchRadius`, `glass.halfWidth`; rings expose the `centre` chain.
- `specification.js` `archFromSpec(item, fc, width, height)`: `archStart` → rise = H − start (riseSource from
  the item, default custom); v1 `archRise` still honoured; PSW `segmental-arch` → three-centre 0.20 W,
  `elliptical-arch` → 0.325 W; v1-era PC 'segmental' → three-centre 0.20 W with riseSource 'ratio' even if
  it had a custom rise (spec A wording); Round shapes re-resolved through `resolveRoundShape` (a start
  giving rise > W/2 throws "use Gothic" — never a silent shape); `arch.bars = { pattern, h, v }`, unknown
  pattern throws.
- `projectStore.js`: `archStart`, `archBarPattern` whitelisted in both builders.
- Configurator: chips Round | Gothic; "Arch starts at (mm from cill)" NumInput (no spinners) + chip Auto
  (H − 0.325 W) + button Half (H − W/2, sets custom); Gothic profile chips with a derived, disabled start;
  live line `Rise 200 · R 150 / 1400 / 150` (`R 500` semi-circle, `R 1000` gothic); right panel: Type,
  Arch starts at (auto/custom), Rise · R, Leaves, Bars (+ pattern); CNC row prints the ArchError text and
  the Save button is disabled while the arch is invalid; Pattern chips filtered by the resolved shape
  (a pattern the shape does not offer resets to none); vertical chips hidden for hub patterns (PSW ignores
  v there — the ring ends are the verticals); edit / prefill restore start (from `archStart`, else H −
  `archRise`), riseSource, pattern; a v1 'segmental' loads as Round on Auto. Height clamp: Gothic
  `ratio·W + 900`, Round `901` (the typed start carries the 900 rule, reported by arch.js).
- 3D sync unchanged apart from the removed segmental key (night 4 rewrites the component).

**Verification:** esbuild OK on all five files · scratch eslint `no-undef` clean · no Polish letters ·
t16 rewritten for v2: 504/504 ALL PASS (incl. `resolveRoundShape`, P3 clamp, v3 profile migration,
PC `archStart` / Half / "use Gothic" / legacy migration / bars mapping) · t17: 72/72 ALL PASS (F2 boundary
150 / 151, W 400 rise 160 → r 150, exporter skips) · sample `sample_arch_1200_segmental.dxf` replaced by
`sample_arch_1200_three-centre-rise240.dxf` (head 2 + 3 + 2 × 95, leaf 2 + 4 + 2 × 95).
NOT verified: the configurator in a browser (no UI run in this session — Piotr's morning test).

**Verdict: ✅ A** (engine-side proven by harness; UI compiled and linted only).

### B — engine (`arch.js` bars, `calculations.js`, `lists.js`, `bom.js`)

**Understanding:** when `windowSpec.arch` is set the casement engine keeps the straight rules below
the springing and swaps the head / leaf top rail for curved members, the glass for a shaped unit and
the bar counts for a real bar list; paint, seals and weights follow the true outline.

**Two approaches, one rejected:** (a) derive the arch in a separate `deriveArchedCasement` and merge
— rejected: hardware picks, cill, beading, consumables and the record helper would be duplicated;
(b) one guarded branch (`archSpec`) inside `deriveCasementWindow`, every rectangular line untouched —
chosen; proven by the fixture (§ below).

**Built:**
- `arch.js` (glass outline + bars, v2 §2.3): `chainYAtX`, `chainAreaAboveLine` (Green's theorem, exact —
  matches a 200 000-strip numeric integral on the gothic chain), `buildGlassOutline` (glass frame: origin
  = unit bottom-left, y up; asserts rule C — the chain starts at x = xg), `glassOutlinePoly` (closed bulge
  polyline, one vertex per arc end), `buildArchBars`: straight v (equal divisions of Wg, bottom → outline)
  and h (equal divisions of the straight height below the springing, full width); hub patterns ported
  from PSW `semiBarPattern` (rings 0.3 / 0.6 / 0.8 · xg, spokes at i/(n−1)·π segmented ring → ring →
  outline, the two end spokes ON the springing line = the springing bar, ring-end verticals below the
  line, half-hub = full springing bar + ring 1, v count ignored for hubs — PSW); `intersecting` ported from
  `intersectingData` (n = clamp(round(Wg / 450), 2, 4) mullions to the springing, tracery arcs centred on
  the OUTER frame corners ±W/2, stopped at the outline by exact circle–circle intersection, quarter turn
  max, radius < 30 skipped). Roles v | h | springing | ring | spoke | tracery; ids V1…, H1…, S1…, R1…, K1…,
  T1…; lengths rounded to 0.5. Pattern availability enforced (`PATTERNS_FOR_SHAPE`) — a hub on a
  three-centre throws readably. PSW's spoke insets / bar-top clearance are 3D cosmetics and are not
  ported: the axes meet the rings and the outline exactly.
- `calculations.js` `deriveCasementWindow`: layout forced to `040L` / `040R` by the hinge, hinge array
  ignored; `C-ARCH HEAD` (`C-AH`, `frameHead.face × frameDepth`, length = ring CENTRE-line arc length,
  notes `R 150/1400/150 · 8 pieces · stock 95/95/95` from `planArchSegments`); jambs = `start` −
  jambDeduct; `C-STILE` = `leafStraightStile` − stileDeduct (leaf bottom → springing); `C-ARCH TOP RAIL`
  (`C-ATR`, leaf ring centre line); bottom rail unchanged; glass unit `{ width Wg, height apex, qty 1,
  role main, location 'arched leaf', shape: { kind 'arched', archShape, outline, poly, springing, apex,
  rise, radii, area, perimeter, bars, pattern, barCounts } }`; `glassSqm`, pane weight, bead perimeter
  from the true area / perimeter; astragal bar run = Σ bar lengths; seals: 2·start + head outer arc
  (+ cill); paint from `W·start + area under the outer chain` (`paintFromAreaSqm` shared with the
  rectangular path — same numbers); leaf timber run = 2 straight stiles + bottom rail + curved top rail;
  `derived.arch = { shape, geometry, plans, bars, barCounts, barTotalLength, pattern, glassOutline (+ origin
  in frame coordinates: x = W/2 − xg = 94.5, y = 101.5) }` — spread in only when arched, so a rectangular
  casement's output has no new key. Invalid arch numbers throw `ArchError` (every caller —
  WindowCard, ProjectDetailPage, ProductionPackPage, WindowDetailPage, canvas renderer, Material
  Assignments — already catches; never a silent rectangle).
- `lists.js`: `C-ARCH HEAD` → `C-AH` right after `C-FRAME HEAD`, `C-ARCH TOP RAIL` → `C-ATR` right after
  `C-TOP RAIL` (no `?` groups); glass rows carry `shape` and a bars label from the engine's counts +
  pattern (`1H × 2V astragal`, `hub-spoke astragal`, `1H · intersecting astragal`).
- `bom.js`: `C-ARCH HEAD` → `c_frame_head`, `C-ARCH TOP RAIL` → `c_sash_top_rail` — outside the spec's
  file list, added because `buildWindowPartQtys` silently drops any element name it cannot map (the
  arch timber would vanish from the BOM). The blank is really glued from `profile.arch.stockWidths`
  boards — BLOCKERS §9.

**Verification (node, real path `normaliseToWindowSpec → deriveWindowData → lists`):**
- rectangular fixture (4 windows: 040L 1000×1500 1H×2V, 052L fanlight, 120 georgian triple frosted,
  180L wider cill) dumped from `origin/main` before any change: `derived`, cut list and glass rows are
  JSON-identical after B, no `arch` key.
- three-centre 1000×1500 start 1300 (spec §3 vector): C-AH 1091.2 (centre line), jambs 1300, stiles 1253,
  C-ATR 949.8, glass 811 × 1304 (springing 1198.5, apex 1304, radii 55.5 / 1305.5 / 55.5), bars H1 811 +
  V1/V2 1297, seal frame 5.26 m, no `?` cut-list group.
- semi-circle 1000×1500 (Half) hub-spoke: C-AH 1481.3 (π × 471.5), C-ATR 1339.9, 7 bars (ring R 121.65
  L 382, 2 springing segments, 2 spokes at 60° / 120°, 2 ring-end verticals), v count dropped.
- gothic 1000×1800 intersecting: 2 mullions + 4 tracery arcs; jambs 934, stiles 887.
- t16 504/504, t17 72/72 ALL PASS after the engine change · esbuild + eslint clean on the four files ·
  no Polish letters.
NOT verified: the 2D sheets / 3D still draw the arched window as a rectangle (night 4, by design);
hardware (hinge/lock) picks on the arched leaf use the bounding leaf height — unchanged from v1.

**Verdict: ✅ B**

## 2026-09-06 — arched-casement-v1: audit fixes T1–T8, then Stage 2 (night run 2, branch `claude/arched-casement-audit-t1-t8-7d5fuk`)

Inputs read in full, in this order: `ARCHED-CASEMENT-v1-AUDIT.md` → `ARCHED-CASEMENT-v1.md` (spec,
wins on every discrepancy) → `ARCHED-CASEMENT-v1-AS-BUILT.md`. Baseline before any change:
`node verify/arch/t16.mjs` 203 checks ALL PASS on `main` (b801039). Order of work per CLAUDE.md:
T2 → T1 → T6 → T3 → T4 → T5 → T7 → T8 → Stage 2 a→d. One commit per closed task.

Two spec-vs-audit conflicts settled up front by the rule "spec wins" (details in BLOCKERS.md §6):
1. Audit T2 says keep `widthAllowance: 20` ("equivalent to 10 per side"); audit T7 demands
   middle-piece `W_req` == spec §10.2 within ±0.05. Both cannot hold: "+20 after projection" gives
   103.02 for N = 3, the spec's band formula `(Ro + a) − (Ri − a)·cos(φ/2)` gives 102.70. The
   planner is moved to the spec §7.4 model (allowance band 10 mm per side, `contourAllowance`) in T1.
2. Spec §10.2 "LEAF segmental (R 830/763, θ 87.21°)" reuses the HEAD's included angle. By spec §6.2
   every chain is clipped at the arch-start line, so the leaf ring's own span at R 830 is 81.24°.
   With 87.21° the closed formula reproduces the spec's 111.1 / 100.6 exactly; with the leaf's own
   span it gives 107.9 / 98.8. The geometry follows §6.2; the leaf line is logged as a spec erratum.

### T2 — stock list D7 (`src/engine/profile.js`)

**Understanding:** the board widths the planner may pick from are workshop data; the night-1 list
`[100 … 250]` was invented. Piotr's list (D7): `[50, 63, 75, 95, 105, 180, 200]`.

**Change:** `DEFAULT_CASEMENT_PROFILE.arch.stockWidths` → D7. `widthAllowance: 20` and
`maxPieces: 8` untouched in this step (T1 replaces both, see above). Harness: the local
`PLAN_OPTS` copy now carries the same list; every plan literal in the DXF section (piece counts,
board heights, FINGER count, `ALT` text, flat labels) is now derived from the harness's own
independent option table instead of hard-coded `2 × 150 / 1 × 225`, so the checks stay structural
until the spec vectors land in T7. Gothic piece-end checks generalised to N pieces per side.

**Observed with D7 under the night-1 rule (fewest pieces):** head 2 × 180, leaf 2 × 180, semi-circle
3 × 180, gothic 2 + 2 × 180 — all still too few pieces (43° per board); that is T1's job.

**Verification:** esbuild `profile.js` OK · no Polish letters in touched files · harness 203/203
ALL PASS · sample DXF NOT regenerated (restored via git; regenerated after T6/T8 as instructed).

**Verdict: ✅ T2** (stock list is now Piotr's, verified in the profile and through the DXF path).

### T1 — max segment angle, N_min, allowance band (`arch.js`, `profile.js`, `archDxf.js`)

**Understanding:** a board may not span more than 36° of arc (grain run-out), so every arc needs
`N_min = max(2, ceil(θ / 36°))` pieces; candidates run `N_min … N_min + 3`. A single-centre arc
shorter than 36° may be one board only when a stock board really fits it. The board a piece needs
is the projection of the ALLOWANCE BAND (outer + 10, inner − 10, spec §7.4) onto the piece axes —
not "piece + 20".

**Two approaches, one rejected:** (a) keep the night-1 projection of the finished piece and add
`widthAllowance` afterwards — rejected: 103.02 vs the spec's 102.70 for N = 3 (the inner offset
arc sags less than the finished inner arc), fails T7's ±0.05; (b) offset both contours by the
allowance with the existing `offsetArcs` (clipped ends recomputed on the band radii) and project
that band with the existing exact extent code — chosen, four lines of new geometry.

**Changes:** `allowanceBand(ring, a)`, `partitionArc(ring, i, n, band)` (band-driven extents,
finished arcs kept for the drawing, per piece `phi/phiDeg/axisAngleDeg/wReq/L/band`),
`planArchSegments` reads `contourAllowance` + `maxSegmentAngleDeg` (throws a readable ArchError
when a setting is missing — no defaults in the planner), N window per spec §7.2–7.3, `nMin/nMax/
spanDeg` on every arc result. Profile: `arch.version 2`, `contourAllowance 10`,
`maxSegmentAngleDeg 36`; `widthAllowance` and `maxPieces` removed (replaced by the spec model —
justification above); `migrateCasementProfile` replaces a stored arch block whose version differs
(no UI edits this block, so nothing user-set is lost; a night-1 block persisted in a browser would
otherwise keep the invented list and lack the new keys). DXF: arc line now prints the span in
degrees, new TEXT line `ALLOWANCE 10 PER SIDE  MAX SEGMENT 36 DEG`.

**Edge cases:** allowance 0 accepted; `contourAllowance` ≥ inner radius → `offsetArcs` throws
readably; θ < 36° single arc with no fitting board → N_min 2; three-centre haunch arcs (38.6° at the
night-1 radius) get 2 pieces of 69 mm — the spec's rule, flagged in BLOCKERS §6 as a question
(minimum piece length).

**Results (W 1200, D7, rule still "fewest pieces" until T6):** head segmental N 3…6, W_req
102.70 / 91.49 / 86.28 / 83.45 → stock 105 / 95 / 95 / 95, middle L 441.69 (spec 441.71),
end pieces W_req = middle (not wider), default 3 × 105, alt 4 × 95; semi-circle N 5…8, W_req
103.09 / 95.16 / 90.36 / 87.24, L 377.00 — every number equals spec §10.2 within 0.02;
gothic 2 per side; leaf segmental (own span 81.24°) 107.93 / 98.80 / 94.56 / 92.25 → 180 / 105 /
95 / 95.

**Verification:** esbuild OK on the three files · no Polish letters · harness rewritten in this
area: independent option table now builds the band with its own clip formulas, samples 4000 points
per arc, cross-checks the closed forms for middle pieces, asserts N candidates / N_min, every
piece's W_req and L, and end pieces ≥ middle; profile v2 + migration-replacement checks; 226/226
ALL PASS · sample DXF restored (regenerated later).

**Verdict: ✅ T1.**

### T6 — D13 piece rule switch (`arch.js` `pickOption`, `profile.js` `arch.pieceRule`)

**Understanding:** when several N fit, which one is the DEFAULT is Piotr's open decision (D13).
Spec default: narrowest stock with `N ≤ N_min + 2`, tie → fewer pieces; the other candidate is
printed as ALT. Night 1 had the opposite (fewest pieces) hard-wired.

**Change:** `profile.arch.pieceRule: 'narrowest' | 'fewest'` (default `'narrowest'`, comment says
it is OPEN); `pickOption(options, nMin, rule)` implements both; `alternative` = the plan the OTHER
rule picks (null when both agree), so the sheet always shows the trade-off. If nothing fits within
`N_min + 2`, the narrowest rule falls back to the remaining feasible candidate (N_min + 3) rather
than reporting no plan. Unknown rule → readable ArchError (no silent default). DXF TEXT line now
ends with `RULE NARROWEST` / `RULE FEWEST`.

**Results (W 1200, D7, narrowest):** head segmental 4 × 95 (ALT 3 × 105) and semi-circle 7 × 95
(ALT 5 × 105) — exactly spec §10.2; gothic 3 + 3 × 95 (ALT 2 + 2 × 180); leaf segmental on its
own span 5 × 95 (ALT 3 × 180) — the spec's "4 × 105" for the leaf comes from the head's θ
(BLOCKERS §6, erratum). With `'fewest'` the plans flip back to 3 × 105 / 5 × 105.

**Verification:** esbuild OK · harness: both rules asserted on the same option table for every
shape, alternative = other rule, unknown rule / missing settings throw; 236/236 ALL PASS.

**Verdict: ✅ T6** (D13 itself stays OPEN in BLOCKERS — the switch is Piotr's, not mine).

### T3 — rough length, end cuts, piece labels, finger zones (`arch.js`, `archDxf.js`)

**Understanding:** a piece is cut from a board `stock × rough`; rough = band length + finger length
per JOINTED end (spec §7.7, conservative — the arch-start cut is not a joint). The operator needs,
per piece: outer / inner length, the two end-cut angles, how many ends get fingers, and where the
finger zone ends on the board.

**Changes:** per piece `Lin` (band inner chord = `2·(Ri − a)·sin(φ/2)` for middle pieces),
`jointedEnds`, `roughLength`, `endCuts` = `[start, end]` of `{ kind: 'joint' | 'spring' | 'apex',
jointed, angleDeg, fromSquareDeg }` (`endCut()` documents both conventions: joint φ/2 from square;
spring = piece axis to the horizontal as the spec asks, plus 90° − that from square; apex = axis to
the vertical, from square = axis to horizontal). `planArchSegments` reads `finger.length` from the
profile (throws readably when missing); options carry `roughLength` (max over pieces). DXF pieces
row: the ASSEMBLY rectangle is now `stock × rough` with the band placed `finger.length` in from
each jointed board end (END end drawn on the left — the flat rotation maps the tangent axis onto
−x, noted in code); FINGER layer adds one zone line `finger.depth` (16) in from each jointed board
end, full board height; labels: `W1 - FRAME HEAD P1 L358.1 x95` (rough, audit T3) plus a 10 mm
note `OUT 343.1 IN 230.7 CUT J10.9/S32.7 FINGER ONE END`; the assembly text block prints
`ROUGH` per arc and a cut-code legend. `dxfWriter` has no linetypes (all CONTINUOUS) → the zone
lines are plain, not dashed (spec §7.7 says dashed; noted, not a functional loss).

**Numbers (head segmental N = 3):** middle L 441.69 / L_in 403.04 / rough 471.69 (spec 441.71 /
403.06 / 471.71, within 0.02); end pieces L 451.77 (the band's outer corner on the arch-start
line projects 10 mm further than the finished corner) → rough 466.77 ≥ spec's 456.71 (which uses
the middle L for the ends); joint cut 14.53°, arch-start cut 29.07° axis-to-horizontal (60.93°
from square). Gothic apex pieces: A50.0 (axis to vertical) / 40.0 from square.

**Verification:** esbuild OK · no Polish letters · harness: jointedEnds / rough / end-cut kinds and
φ/2 on every option of every shape, spec literals for N = 3, DXF flat boards = rough, FINGER count
5·(N − 1) per ring with zone lines 16 mm from a board end, label / note regexes, legend; 256/256
ALL PASS · rendered `.audit/t3_segmental.dxf` to PNG (ezdxf + matplotlib) and looked at the head
P1 board: joint face + zone line at the left, tilted arch-start cut at the right, both labels
inside the board.

**Verdict: ✅ T3.**

### T4 — three-centre haunch radius (`arch.js` `archArcs`)

**Understanding:** the "elliptical" arch is a basket handle (D9): two haunch circles on the
springing line + one crown circle below it, tangent-continuous. Night 1 fixed the haunch radius at
`0.5 × rise` (invented); spec §6.1 sets it to the ellipse's radius of curvature at the springing,
`r = rise² / halfW`, so the basket handle actually approximates the ellipse the customer saw.

**Change:** `THREE_CENTRE_HAUNCH_RATIO` removed (it was the invented constant — justification:
replaced by the spec formula, nothing else read it); `r = h²/hw`; the tangency solve kept as is
(audit: correct). New guard: three-centre rise ≥ W/2 throws readably (r ≥ rise → no crown circle;
at W/2 the shape is a semi-circle). Too small a rise still fails readably one step later
(`rise 180 → r 54 < frame face 57 → "Offset 57mm exceeds the arc radius 54mm"`).

**Numbers (W 1200, rise 390):** r 253.50, R 761.54, small centres ±346.50, crown centre 371.54
below the arch-start line, tangent point (W/2 + 519.40, +185.39), spans 47.00° / 86.01°, arc
lengths 207.93 each / 1143.13, |Cs − CL| = 508.04 = R − r — every spec §10.1 value within 0.01.
Plans (narrowest): haunches 2 × 95 each (107 mm rough pieces), crown 4 × 95 (ALT 3 × 105).

**Verification:** esbuild OK · harness: the independent three-centre formula now uses r = h²/(W/2);
spec literals asserted explicitly (radii, tangent point on both circles, spans, lengths, tangency,
mirror), two new error cases; 267/267 ALL PASS.

**Verdict: ✅ T4.**

### T5 — limits (`profile.js` `arch.limits`, `arch.js` `readArchLimits` / `assertRisePhysics`)

**Understanding:** two kinds of limits were mixed in night 1. Workshop / product limits (width
400–1500 from PSW, `H ≥ rise + 900`, straight leaf stile ≥ 100 — PSW arched-sash rules adopted
for the casement, spec §3.3) belong in the profile like every other number. Physical limits (a
single-centre arc cannot rise more than W/2; a pointed arch needs rise ≥ W/2; a three-centre needs
rise < W/2) are geometry and stay in `arch.js`. The night-1 per-shape "windows" (segmental
0.10–0.45, drop 0.55–0.85, three-centre 0.15–0.45) were invented — removed (audit T5).

**Changes:** `profile.arch.limits = { minWidth 400, maxWidth 1500, minStraightBelowRise 900,
minLeafStraightStile 100 }` (nested merge in the migration); `ARCH_LIMITS` export removed
(justification: replaced by the profile block, single source — the harness asserts it is gone);
`resolveArchRise(shape, W, rise, limits)` now requires the limits (readable throw when missing);
`assertRisePhysics` shared by `resolveArchRise` and `archArcs`; `buildArchGeometry` enforces
`H − rise ≥ minStraightBelowRise` and the leaf straight stile `(H − rise) − (leafFullHeight −
leafAtJamb) ≥ minLeafStraightStile` (47 mm cill-side deduction read from the profile, never
hard-coded) and exposes `straightHeight`, `leafStraightStile`, `limits`. The old "no straight
part" message is replaced by the 900 rule.

**Edge cases verified:** H = rise + 900 passes, 899 fails with the numbers in the message; the
stile rule only bites when the 900 rule is relaxed (straight 140 → stile 93 < 100); rise ≤ 0,
segmental ≥ W/2 (both entry points), gothic-drop < W/2, three-centre ≥ W/2 all throw readably;
gothic-drop = W/2 degenerates into a semi-circle and is accepted; a tiny three-centre rise (120)
passes the rise rules and fails on the member face (`Offset 57mm exceeds the arc radius 24mm`) —
readable, not silent.

**Verification:** esbuild OK · no Polish letters · harness 281/281 ALL PASS.

**Verdict: ✅ T5.**

### T7 — harness on the spec vectors (`verify/arch/t16.mjs`, `dxf_probe.py`, `specification.js`, `arch.js`)

**Understanding:** the night-1 harness proved the build's own numbers (tautology). Now the
EXPECTED values are the spec's §10.1 / §10.2 vectors typed in verbatim, the assertions follow
§10.3 items 1–10, and the independent closed forms / sampling stay as cross-checks where the spec
lists no number. Three spec numbers are internally inconsistent; each is asserted BOTH ways and
labelled, never silently adjusted (BLOCKERS §6, E1–E2):
- E1 §10.1 segmental `arcLen_in 1237.41` = R_in × θ_out (unclipped concentric arc). §6.2 and the
  same line's `x = W/2 ± 513.88` require the clip at the arch-start line ⇒ 1112.55.
- E2 §10.2 LEAF line uses the head's θ 87.21° (its 111.1 / 100.6 / "4 × 105" are reproduced from
  that angle); the leaf ring's own clipped span is 81.24° ⇒ 107.93 / 98.80 / 94.56, D13 5 × 95.
- (§10.2 "rough end 456.71" uses the middle L for the end pieces; asserted as `≥` — the band's
  outer corner on the arch-start line projects 10 mm longer: 466.77.)

**Code needed by §10.3 items 1 and 9 (spec §3.2 / §4.1 / §4.2):** `GOTHIC_PROFILE_RATIO`
(equilateral / drop 0.70 / shallow 0.60) in `arch.js`; `archFromSpec(item, fc, width)` now
resolves `rise = ratio × width` with `riseSource: 'ratio'` (`'custom'` when a rise is stored),
carries `profile` (gothic only), reads the raw PSW form field `cas-arch-opening` as a hinge
source, maps PSW `gothic-arch` + `archProfile` drop / shallow → `gothic-drop` with that
profile's ratio, and **throws a readable ArchError for an unknown shape** (spec: a silent
rectangle was the critical import bug). The exporter's "unknown shape" skip path is therefore
unreachable from PSW data — kept as a guard. Risk noted in BLOCKERS §6: callers of
`normaliseToWindowSpec` (window cards, project page) do not catch, so one corrupt shape value
would blank that estimate page instead of one button — that is the spec's choice, flagged.
`dxf_probe.py` now returns polyline vertices (point-in-polygon for item 7).

**Harness sections:** pt 1 rise defaults (5 shapes + 3 gothic profiles) · pt 2–4 every §10.1
number within 0.01 mm / 0.01° (radii, θ, centres, arc lengths, inner x, three-centre tangent
point on both circles, spans, lengths, |Cs − CL| = R − r), offsets keep centres and reduce r by
exactly the face, clipped ends analytic on y = 0, bulge = tan(Δ/4) · limits & physics (T5) ·
pt 6 §10.2 HEAD segmental / semi-circle option tables (φ, W_req == ±0.05 middle, ≥ ends, L_out,
L_in, joint cut φ/2, rough middle ==, rough end ≥, stock, D13 default + runner-up), LEAF with E2
both ways, planner vs independent sampled band for all five shapes and both D13 rules, N_min /
single-board rule (W 1500 rise 110 → θ 33.4°, N 1 with 180 mm stock, N 2 with 95 only), tiling,
gothic apex / three-centre tangent joints, no-stock and missing-setting errors · pt 7 sampled
band inside its board for every default piece and every feasible option (plan data) and, on the
DXF, inside the assembled ASSEMBLY quads (point-in-polygon) and flat pieces inside stock × rough ·
pt 5 ezdxf round-trip: CONTOUR arc length from vertices + bulges = `arcLength(chain)` within 0.01
for all five shapes, one vertex per arc end, closed, plus the structural checks from night 1
(layers, counts, FINGER lengths, labels, notes, legend, origin) · pt 8 `canExportArchDxf` false
for rectangular casement / sash / door, `exportArchDxfMerged` run end-to-end with the browser
download stubbed (Blob read back, ezdxf-probed: 2 exported, 2 skipped with reasons, name
`Pack_1_arch.dxf`, 300 mm stacking) · pt 9 the spec vector verbatim (`elliptical-arch` +
`cas-arch-opening: right` → three-centre / hinge left / rise 390 / ratio), unknown shape throws,
profiles, custom rise, `deriveWindowData` path, profile v2 + migration · pt 10 `git diff` of
`casementLayouts.js`, `lists.js`, `calculations.js`, `jambDxf.js` against the merge-base with
main is empty, working tree clean.

**Verification:** esbuild OK on `arch.js`, `specification.js` · no Polish letters · harness
**465/465 ALL PASS** · `npm run build` passes (only the pre-existing chunk-size warning).

**Verdict: ✅ T7 — the harness reproduces the spec (every §10 number is either matched within its
tolerance or reproduced with its erratum shown).** Stage-1 ✅ is confirmed after T8's sample.

### T8 — housekeeping: sample DXF, BLOCKERS §4, branches

**Sample:** `docs/handover/samples/sample_arch_1200_segmental.dxf` regenerated by the harness
after T1–T7 (not earlier — restored via git after every intermediate run). ezdxf: AC1009, layers
CONTOUR / ASSEMBLY / PIECES / FINGER / TEXT, 2 CONTOUR rings, 9 PIECES, 18 ASSEMBLY (9 assembled +
9 flat rough boards), 35 FINGER lines, 32 TEXT, CRLF byte-exact. Plan lines: head `4 x board 95
L343.1 ROUGH 362.8 (ALT 3 x board 105)`, leaf `5 x board 95 L248.9 ROUGH 267.4 (ALT 3 x board
180)`. Rendered to PNG (ezdxf + matplotlib) and inspected: head assembly = four 95 mm boards in
the glued position with three radial joints, contour overlaid; flat rows with rough boards, zone
lines and two-line labels. **Never a single solid board** (audit §6). The leaf is 5 × 95, not the
audit's "4 × 105" — erratum E2 (BLOCKERS 6.3).

**BLOCKERS:** new night-2 section (§6 spec errata / decisions 6.1–6.10, §7 branches); night-1 §4
table rewritten with status per row: 4.1, 4.2, 4.3, 4.5, 4.7 resolved by spec, 4.4 confirmed, 4.6
resolved; §0 resolved; **D13 (§1), D5 (§2), d50 arbor (§3) left OPEN** — not closed by me.

**Branches:** `claude/arched-casement-v1-m23u5x` (and `claude/arched-casement-v1`) do not exist
on the remote any more — merged into `main` (6b4203b) and deleted before this session. Nothing to
delete; noted in BLOCKERS §7. This session's branch: `claude/arched-casement-audit-t1-t8-7d5fuk`.

**Verdict: ✅ T8.**

### STAGE 1 VERDICT after T1–T8 — ✅

Harness `node verify/arch/t16.mjs` 465/465 ALL PASS on the spec §10.1 / §10.2 vectors and the
§10.3 list 1–10; `npm run build` passes; frozen files untouched (asserted by the harness); no
Polish in sources. Three spec-side inconsistencies (E1, E2, end-piece rough) are asserted both
ways and listed for Piotr — none of them changes a stock pick except E2 (leaf 5 × 95 vs 4 × 105),
which is a real decision, not a bug. Stage 2 follows below.

### Stage 2a — sample DXF per shape (`docs/handover/samples/`)

`node verify/arch/t16.mjs` now writes `sample_arch_1200_{segmental,semi-circle,gothic-equilateral,
gothic-drop,three-centre}.dxf` (W 1200, H 2000, PSW default rise, hinge L for the segmental, R for
the others) and probes each with ezdxf: CONTOUR arc length from vertices + bulges = `arcLength`
of the chains within 0.01, one vertex per arc end point (4 / 6 / 8 per ring), PIECES tile the
rings, every flat piece inside a stock × rough board, HINGE printed. Rendered all five to PNG and
looked at them: semi-circle 7 + 7 boards, gothic 3 + 3 per side with the apex joint on the axis,
three-centre 2 + 4 + 2 with the tangent joints shared by haunch and crown. CRLF byte-exact
(`.gitattributes`). **✅**

### Stage 2b — edge-case harness (`verify/arch/t17_edges.mjs`, 73 checks ALL PASS)

W 400 / 1500 for every shape at the PSW default rise (plans build, every arc ≥ 2 pieces ≤ 36°,
boards fit, no NaN, DXF round-trip), width just inside / outside 400–1500 (incl. NaN / 0), rise
just inside / outside every physics rule and both fixed shapes, string / empty / negative rises,
the 900 rule and the leaf-stile rule at their boundaries, no fitting board (empty list, junk
entries, boards ≤ 75, only 300), exporter skip messages on the real `windowSpec` path, a merged
export of mixed good / bad edge windows. **Finding F1 (BLOCKERS 8.1):** the leaf ring depth 107 +
allowance 10 sets a hard minimum rise of 117 mm — at W 400 the PSW default segmental (80) and
elliptical (r 84.5) are rejected readably. One code change came out of it: the planner now wraps
an allowance-band failure with the ring name and the allowance (`LEAF TOP allowance band (10mm per
side): …`) instead of the bare `Offset 10mm exceeds the arc radius 5.5mm`. **✅**

### Stage 2c — PSW parity report (`verify/parity/psw-casement-layouts.mjs` → `docs/handover/PSW-PARITY-REPORT.md`)

Read-only: PSW cloned with the mandated command into the session scratchpad (public repo,
619703e of 02.09), never edited. The script parses `LAYOUT_DEFAULTS`, the fanlight / fan2 / triple
lists, `CASEMENT_LAYOUTS_VERSION`, `HIDDEN_DUPLICATES`, `DISPLAY_NAMES`, the `ArchedSash` constants
and the arch radios from the PSW source text, extracts the self-contained `static
casementLayoutDef` body and executes it next to the PC port for 960 cases (30 codes × 4 sizes ×
FR × FR2 × middle section) comparing panels IN ORDER (x, y, w, h, hinge), mullions and transoms.
**Result: 24 PASS · 1 documented difference (PC hides the `010` card as an alias of `040L`;
engine-side valid) · 0 HARD.** Version 2 = 2; the reversed hinge radio (`id cas-arch-open-left`
→ `value="right"`) confirmed in the HTML and matched by the inversion in `specification.js`.
`casementLayouts.js` untouched. **✅**

### Stage 2d — see "Rano dla Piotra" below. **✅**

### FINAL VERDICT (night 2) — ✅ with the open decisions listed

Delivered on `claude/arched-casement-audit-t1-t8-7d5fuk` (10 commits, `main` untouched): T1–T8
from the audit, Stage 2 a–d, harnesses `t16` (465) + `t17` (73) ALL PASS on the spec vectors,
parity report 0 HARD, `npm run build` OK, five sample DXFs, BLOCKERS with D13 / D5 / d50 still
OPEN plus §6 (spec errata, decisions) and §8 (edge findings).

**NOT verified tonight (honest list):**
1. VCarve import of any DXF — only ezdxf 1.4.4 round-trips and matplotlib renders were checked.
2. The browser click path (WindowDetailPage / ProductionPackPage buttons) — `npm run build` passes
   and the export functions run end-to-end in node with the download stubbed; no browser session.
3. Stark 15/16 tool numbers (D5), the d50 arbor (§3), the workshop's reading of "straight stile"
   (6.9) and the minimum sensible piece length (6.5) — decisions, not code.
4. Whether the leaf should be planned on its own clipped span (built, spec §6.2) or on the head's
   angular partition (E2) — the only spec discrepancy that changes a stock pick (5 × 95 vs 4 × 105).
5. Persisted browser profiles: the v2 arch block replaces a night-1 block by version — tested in
   node on the migration function, not in a browser with a real persisted store.
6. PSW parity covers layouts + arch constants only; pricing, bar patterns and 3D were not compared.

### Rano dla Piotra

**Co jest zrobione:** wszystkie osiem zadań z audytu (T1–T8) i Etap 2 a–d. Harness `node
verify/arch/t16.mjs` odtwarza wektory ze spec §10 (465 checków), `node verify/arch/t17_edges.mjs`
sprawdza krawędzie (73), `node verify/parity/psw-casement-layouts.mjs <ścieżka-psw>` generuje
raport parytetu (0 twardych różnic). `npm run build` przechodzi.

**Co otworzyć w VCarve (`docs/handover/samples/`):** `sample_arch_1200_segmental.dxf` — głowica
4 × 95 (ALT 3 × 105), skrzydło 5 × 95 (ALT 3 × 180); do tego cztery pozostałe kształty
(`semi-circle`, `gothic-equilateral`, `gothic-drop`, `three-centre`). Każda deska płaska ma teraz
długość surową (pas + 15 mm palca na złączonym końcu), etykietę `L<surowa> x<deska>`, drugą linię
`OUT / IN / CUT J14.5/S29.1 / FINGER ONE END` i linię strefy palca 16 mm od złączonego końca.
Kody cięć: J = złącze od kąta prostego, S = linia startu łuku (oś deski do poziomu), A = szczyt
gotyku od kąta prostego. Sprawdź: (a) czy łuki importują się jako łuki; (b) czy kąty cięć są
w konwencji, której używa operator; (c) czy 10 mm tekst drugiej linii jest czytelny.

**Trzy decyzje, które zmieniają plan (BLOCKERS §6):**
1. **E2 (6.3):** spec liczy skrzydło z kątem głowicy (87.21°) → 4 × 105; wg §6.2 skrzydło ma
   własny kąt po przycięciu (81.24°) → 5 × 95. Zbudowane wg §6.2. Jeśli wolisz 4 × 105 — decyzja.
2. **D13 (§1):** domyślnie `narrowest` (spec). Przełącznik w profilu: `arch.pieceRule: 'fewest'`.
3. **6.5:** trzyśrodkowy daje na hausze 2 deski po ~107 mm surowej długości z palcem — czy taki
   krótki kawałek jest OK, czy ma być minimalna długość?

**Erraty spec (nie kod):** E1 — `arcLen_in 1237.41` w §10.1 to łuk nieprzycięty (813 × 87.21°);
po przycięciu 1112.55. E2 — jak wyżej. „rough end 456.71" — końcówki wychodzą 466.77 (róg pasa
na linii startu). Harness pokazuje obie liczby przy każdej z nich.

**Znalezisko krawędziowe (BLOCKERS 8.1):** przy W 400 domyślne strzałki PSW dla segmentala (80)
i eliptycznego (r 84.5) nie mieszczą pierścienia skrzydła 107 + 10 naddatku — eksport odmawia
czytelnie. Minimalna strzałka segmentala to > 117 mm niezależnie od szerokości.

**Otwarte bez zmian:** D5 palec 15/16 vs 10–11, głowica d50 na CNC.

**Merge:** branch `claude/arched-casement-audit-t1-t8-7d5fuk` → `main`, `main` nietknięty.

## 2026-09-05 — arched-casement-v1 (night run, branch `claude/arched-casement-v1`)

**Blocking fact first:** `docs/handover/ARCHED-CASEMENT-v1.md` (the package spec) is NOT in the
repository, in any branch, in Petros, Drive or Gmail. Everything below is built from CLAUDE.md,
the PSW source (`js/price-calculator.js` `window.ArchedSash`, `js/casement-controller.js`,
`online-estimate.html`) and the existing PC engine conventions. Every number the spec would have
fixed is listed in BLOCKERS.md as an ASSUMPTION. The harness reproduces closed-form geometry, not
the spec's §10 vectors — so no step in this section can honestly carry ✅. See the final verdict.

### FINAL VERDICT — ⚠️ (built and machine-verified; not verified against the spec)

**Delivered on `claude/arched-casement-v1` (and `claude/arched-casement-v1-m23u5x`, same
commits):** all seven §11 files, harness (203 checks ALL PASS), `npm run build` ✓, sample DXF,
as-built document, BLOCKERS with D13 / D5 / Stark d50 + ten assumptions. `main` untouched.

**Why not ✅:** `docs/handover/ARCHED-CASEMENT-v1.md` does not exist anywhere I could reach.
The harness reproduces closed-form geometry and my own D13 / stock / limit decisions — it
cannot prove the spec's §10 vectors. Stage 2 was therefore not started (Piotr's gate).

**NOT verified tonight (honest list):**
1. Every number in BLOCKERS §4 (rise limits, three-centre haunch ratio, elliptical → three-centre,
   stock widths, allowance 20, maxPieces 8, straight-part rule) — assumptions.
2. D13 default direction ("fewest pieces") — assumption; alternative is printed.
3. Finger profile 15/16/3.8 — read from CLAUDE.md, tool never seen.
4. VCarve import of the DXF — only ezdxf 1.4.4 round-trip + a matplotlib render were checked.
5. The UI click path in a browser (build passes, no arched casement exists in PC data — see
   BLOCKERS 4.10).
6. Merged "Arch DXF (all)" under a batch profile snapshot (uses the active profile, 4.9).
7. Board LENGTH limits, piece minimum length (none implemented, 4.8).

### Rano dla Piotra

**Co otworzyć w VCarve:** `docs/handover/samples/sample_arch_1200_segmental.dxf` (mm). Cztery
rzędy od góry: FRAME HEAD kontur (CONTOUR) z deskami w pozycji sklejenia (ASSEMBLY) i
płaszczyznami palców (FINGER, czerwone); FRAME HEAD kawałki płasko na deskach (PIECES + ASSEMBLY);
to samo dla LEAF TOP. Tekst po prawej każdego konturu: kształt, W, strzałka, zawias, promienie,
plan (2 × deska 150, ALT 4 × deska 100), `FINGER 15/16/3.8`. Sprawdź: (a) łuki importują się jako
łuki (bulge), nie łamane; (b) czy rysować deski w widoku złożenia (warstwę ASSEMBLY można wyłączyć);
(c) czy czcionka/rozmiar tekstu 15 mm jest OK; (d) czy palec ma być na płaszczyźnie (tak jak
teraz) czy z narysowanymi zębami.

**Pozostałe kształty:** `node verify/arch/t16.mjs` zapisuje `.audit/arch_1200_semi-circle.dxf`,
`…gothic-equilateral.dxf`, `…gothic-drop.dxf`, `…three-centre.dxf` (katalog `.audit` jest
ignorowany przez git).

**Co sprawdzić w UI:** okno casement → nagłówek strony: przycisk „🛠 Arch DXF" obok „✏️ Edit
Configuration" (dla sash jest tam „🛠 CNC Jamb DXF"). Dla zwykłego casementu jest wyszarzony z
tooltipem „not an arched casement". Production Pack typu casement → „🛠 Arch DXF (all)". Aktywny
przycisk wymaga okna z polami PSW (`casementType: 'arched'`) — w PC nie ma dziś drogi, żeby takie
okno powstało (BLOCKERS 4.10). To jest luka do decyzji, nie do naprawy „przy okazji".

**Decyzje, które czekają:** (1) wgrać spec i podmienić wektory §10 w harnessie; (2) D13 — „mniej
kawałków" czy „węższa deska" jako domyślne; (3) D5 — 15/16/3,8 potwierdzone?; (4) lista desek
stockowych i zapas 20 mm (profil casement → `arch`); (5) PSW „elliptical" jako trzyśrodkowy;
(6) limity strzałki per kształt; (7) skąd PC ma dostać łukowy casement (import z PSW czy pole w
konfiguratorze — osobny pakiet); (8) Stark d50 / trzpień.


### Step 1 — geometry (`src/engine/arch.js`, harness §10.1)

**Understanding:** one arched member = ring between two concentric contours of the window's outer
arch, clipped at the arch-start line (y = 0). Shapes: segmental (1 centre below the line),
semi-circle (1), gothic equilateral / gothic drop (2 centres on the line), three-centre (2 haunch
centres + 1 crown centre). Rise defaults from PSW `RISE_RATIO` / `GOTHIC_PROFILE_RATIO.drop`.

**Context:** engine only — `arch.js` reads `frameHead.face`, `leafAtJamb`, `leafTop.face`,
`glassInset` from the casement profile passed in; nothing hard-coded (CLAUDE.md rule 11).

**Two approaches, one rejected:** (a) port the PSW 3D point sampling (`arcPoints`, Bézier for the
ellipse) — rejected: sampled polylines cannot carry bulges and the 3D "elliptical" is not
routable from concentric arcs; (b) keep every arc as (centre, radius, a0, a1) with clip flags and
offset by shrinking radii — chosen (matches the Petros "concentricity" patent and DXF bulge).

**Edge cases handled:** rise smaller than a member face (contour never reaches y = 0 → ArchError),
rise ≥ height, width outside 400–1500, foreign rise on a fixed-rise shape, unknown shape,
`atan2(−0, −x)` returning −π on the left arch-start end (found by the harness, fixed).

**Harness:** `node verify/arch/t16.mjs` — 77 checks, ALL PASS: radii, centres, outer / frame-inner
/ leaf-outer / leaf-inner / glass lengths for all five shapes at W = 1200 against formulas written
independently in the harness; concentricity; clipping; bulge polyline rebuilds every radius.

**Verdict: ⚠️** code verified against closed-form geometry only; NOT verified against spec §10.1
(file missing). Not verified: rise limits per shape (my ratios), three-centre haunch ratio 0.5.

### Step 2 — segment planner (`arch.js` §7, harness §10.2)

**Understanding:** a curved member is glued from N straight boards on radial finger joints and
routed afterwards. For each arc of a ring and each N = 1…maxPieces: split by equal outer angle,
project every piece onto its board axes (bisector = width, chord = length), board = projected
width + allowance, stock = narrowest board ≥ that. D13 default = fewest pieces that fit a stock
board; alternative = plan on the narrowest board (returned, to be printed by the DXF).

**Two approaches, one rejected:** (a) closed-form width ρo − ρi·cos(φ/2) for every piece —
rejected because end pieces are clipped (arch-start line, gothic apex on the axis) and the inner
corner is no longer the lowest point (segmental N = 1: 240 mm, not 281 mm); (b) exact projection
of the actual piece boundary (arc extrema + corners) — chosen; the harness cross-checks it by
brute-force sampling (4000 points per arc) AND by the closed form on radial-radial pieces.

**Edge cases:** no stock fits → options keep `stock = null`, `noStock = true`, no throw; gothic
apex = one joint on the axis (finger), arch-start cuts are not joints; three-centre tangent
joints are one shared radial line for both neighbours.

**Harness:** 140 checks ALL PASS. W = 1200, stock 100–250, allowance 20: segmental 2 pcs / 150
board (alt 4 / 100), semi-circle 2 / 250 (alt 6 / 100), gothic 1 + 1 (alt 3 + 3), three-centre
1 + 2 + 1 (alt crown 4).

**Verdict: ⚠️** planner verified two independent ways; D13 default and the stock list are my
assumptions (BLOCKERS 1, 4.7). Not verified: piece minimum length, board length limits (none in
the code — a 1500 semi-circle N = 1 asks for a 750 mm board and is simply infeasible).

### Step 3 — CNC drawing (`src/engine/cnc/archDxf.js`, harness §10.3 round-trip)

**Understanding:** one DXF per window with four rows (top-down): FRAME HEAD contour + assembly,
FRAME HEAD pieces laid flat, LEAF TOP contour + assembly, LEAF TOP pieces. Layers: CONTOUR =
finished member (routed after glue-up), ASSEMBLY = stock boards (assembled and flat), PIECES =
piece contours to rout, FINGER = joint faces (planes only, the Stark head cuts the teeth), TEXT =
labels + plan summary incl. the D13 alternative. Entity model, R12 writer, 200 mm gaps, 15 mm
text and the merged-stack convention are 1:1 `jambDxf.js`.

**Two approaches, one rejected:** drawing the finger teeth (pitch 3.8 → hundreds of vertices per
joint, useless to a 5-axis operator) — rejected; joint planes + printed profile — chosen.

**Bug found by the harness:** tilted stock boards in the assembled view overhang the ring's
bounding box (−29.6 mm left of the origin) → rows are now placed by the bbox of ALL their
entities. Three other failures were wrong assertions (a single-piece board is axis-aligned too;
1324.2 not 1324.1; leaf contour picked instead of frame), fixed in the harness, not the code.

**Harness:** `docs/handover/samples/sample_arch_1200_segmental.dxf` written and read back with
ezdxf 1.4.4 (`verify/arch/dxf_probe.py`): AC1009, five layers, CONTOUR arc lengths = outer +
inner of both rings (closed form), straight cuts = arch-start ends, PIECES arcs tile the rings,
one board per piece assembled + flat, FINGER faces 57 mm long, TEXT lines (labels, shape line,
`FINGER 15/16/3.8`, `ARC 1 R870 L1324.2: 2 x board 150 … (ALT 4 x board 100)`). Same round-trip
for semi-circle, gothic equilateral, gothic drop, three-centre; merged export stacks 300 mm
apart; a no-stock plan is refused with a readable ArchError. 176 checks ALL PASS. Rendered the
three files to PNG via ezdxf/matplotlib and eyeballed the layout (rows, tilted boards, joints).

**Verdict: ⚠️** DXF verified by round-trip and by eye in a renderer — NOT in VCarve (Piotr,
morning). Not verified: text placement inside VCarve, whether the workshop wants the assembled
boards drawn at all (ASSEMBLY layer can simply be switched off).

### Step 4 — profile `arch` section + `windowSpec.arch` (spec §4–5, harness §10.3 pt 9)

**Understanding:** the arch geometry already reads its faces from the casement profile; the
planner and the drawing additionally need the finger profile and the board stock — that is the
whole `arch` section (`finger 15/16/3.8`, `stockWidths`, `widthAllowance 20`, `maxPieces 8`).
`normaliseToWindowSpec` gains `arch: { shape, rise, hinge } | null` from PSW's `casementType`
/ `casArchShape` / `casArchHinge` (or PC-native `archShape` / `archRise` / `archHinge`).

**Reversed hinge:** PSW `online-estimate.html` 887–888 — the radio labelled "Left Hinge" has
`value="right"` and vice versa, so the saved value is the opposite of what the customer chose. PC
stores the meaning: `casArchHinge 'right' → hinge 'left'` (default too), `'left' → 'right'`.
Same policy as the door hinge/open-direction fix already in `specification.js`. Note: PSW's own
3D passes the raw value straight to `hingeDirection` (`src/3d/App.jsx` 453) — read-only, left as is.

**Migration:** `migrateCasementProfile` fills `arch` (deep-merging `finger`) for every stored
profile that predates it — persisted user profiles and batch `_profileSnapshot.casement` alike;
the settings UI edits `elements` / `deductions` only, so nothing there iterates the new key.

**Edge cases:** PSW arched with the radios never touched → `semi-circle` / `hinge left` (PSW
defaults); unknown PSW shape kept verbatim so the exporter reports it instead of guessing;
standard casement and sash → `arch: null`; `deriveWindowData` on an arched spec keeps deriving
the rectangular casement (cut list for arches is a later package — the engine is untouched).

**Harness:** 19 new checks, 195 ALL PASS — including the real data path
`normaliseToWindowSpec → deriveWindowData → buildArchPlan(getCasementProfile())`.

**Verdict: ⚠️** mapping verified against the PSW source, not against spec §4.2 (missing). Not
verified: whether Piotr wants PSW `elliptical-arch` built as a three-centre (BLOCKERS 4.4).

### Step 5 — export + buttons (`src/utils/cncExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`)

**Understanding:** same shape as the jamb export — `archParamsForWindow` maps a windowSpec onto
the generator or returns a readable `skip` (not a casement / not arched / unsupported shape /
geometry error / no stock board), `exportArchDxfForWindow` → `{name}_arch.dxf`,
`exportArchDxfMerged` → `{label}_arch.dxf` stacked 300 mm apart, `canExportArchDxf` for parity.

**UI (no configurator changes):** WindowDetailPage — "🛠 Arch DXF" next to the jamb button,
shown for every casement window, disabled with the skip reason as tooltip when the window is
not an arched casement; the plan runs under the batch's profile snapshot through `withProfiles`,
exactly like `derived`. ProductionPackPage — "🛠 Arch DXF (all)" for casement packs; windows
that are not arched are listed as skipped in the alert. The merged export plans under the
ACTIVE profile (a pack can span batches; noted in BLOCKERS 4.9).

**Two approaches, one rejected:** show the button only for arched windows — rejected: Piotr
would never find it (Petros rule "new function = visible entry"); shown for all casements,
disabled with the reason.

**Verification:** esbuild on `cncExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`;
`grep -F` on every inserted identifier; harness §9 (8 checks: skip reasons, plan params,
no-throw contract) → 203 ALL PASS; `npm run build` ✓ (20.7 s, same chunk-size warning as before).

**Verdict: ⚠️** logic verified by harness and build; the click path itself NOT exercised in a
browser tonight (no arched casement exists in PC data until one is imported from PSW — see
"Rano dla Piotra").

### Step 6 — sample DXF, docs, checklist

- `docs/handover/samples/sample_arch_1200_segmental.dxf` — written by the harness on every run,
  byte-identical between runs (md5 7129d427…), committed.
- `docs/handover/ARCHED-CASEMENT-v1-AS-BUILT.md` — what was built, per section, for diffing
  against the real spec. The spec itself was NOT fabricated.
- CLAUDE.md „ZADANIE NOCNE" updated with the state and the next step; „NIE RÓB DZIŚ" untouched.
- Checklist: esbuild ✓ on all 7 touched files · zero Polish characters in sources (UTF-8 grep) ·
  `node verify/arch/t16.mjs` 203/203 ALL PASS · `npm run build` ✓ · `git diff main --stat` = the
  seven §11 files + verify/ + docs/ + BUILD-LOG + BLOCKERS + .gitignore (`.audit`) · `main` untouched.

**Verdict: ⚠️** — see FINAL VERDICT at the top of this section.

---

## Phase 0 — Project skeleton (React + Vite + layout)

**Goal:** Empty app with layout loads in the browser.

**What I did:**
- Initialised Vite + React 18 project (chose React 18 instead of 19 to maximise compatibility with `@react-three/fiber@8`, which is the last version with stable React 18 support).
- Installed: `react`, `react-dom`, `react-router-dom`, `zustand`, `@supabase/supabase-js`, `tailwindcss`, `postcss`, `autoprefixer`, `@react-three/fiber`, `@react-three/drei`, `three`, `jspdf`, `jspdf-autotable`, `xlsx`.
- Configured Tailwind with custom palette (`ink`, `accent`).
- Layout: `Header` (logo, nav, sign-out, mock-data badge) + `Sidebar` (estimate list + windows-in-estimate sub-list) + `Outlet` main content.
- Pages: `LoginPage`, `DashboardPage`, `EstimateDetailPage`, `WindowDetailPage`.
- Routing: `/login`, `/dashboard`, `/estimates/:id`, `/estimates/:id/windows/:itemId`. Auth-gated routes redirect unauthenticated users to `/login`.
- `src/services/supabase.js` lazily initialises the client; exposes `hasSupabaseConfig` so we can fall through to mocks.
- Stores: `useAuthStore` (session, signIn, signInWithMockData, signOut) + `useProjectStore` (estimates, current estimate/items, settings).
- `.env.example` with placeholder keys.

**Multi-pass verification:**
- *Logical correctness:* Each route mounts a page; auth gate works (no session → /login).
- *Integration:* `npm run build` passes (1053 modules transformed, 14.5 s).
- *Edge cases:* No Supabase env → app falls back to mock data; user gets visible "Mock data mode" badge.

**Verdict:** ✅ Done. `npm run dev` starts in <300 ms; `npm run build` succeeds.

---

## Phase 1 — Import Estimate

**Goal:** Sign in → see estimates → click → see windows with calculations.

**What I did:**
- `DashboardPage` fetches `estimates` (with `estimate_items(count)` join) when Supabase is configured; falls back to `mocks/mockEstimates.js` otherwise.
- `EstimateDetailPage` fetches the estimate + all its `estimate_items`, then renders one `WindowCard` per item.
- `WindowCard` shows: window number, type, dimensions, mini-SVG elevation thumbnail, bars/glass/colour/horns tags, calculated sash width + top-sash height, prices.
- `engine/specification.js`: parses the `specification` JSON column and normalises a Supabase row + parsed spec into the `windowSpec` shape that `calculations.js` expects (frame, sash.grid, color, hardware, glazing, materials).
- `engine/calculations.js`: copied verbatim from `Windows-App-electron-/js/calculations.js`. Already exports as ES module — no adaptation needed.
- `mocks/mockEstimates.js`: 3 estimates (sent / draft / won) with 7 items spanning sash window + bar combinations 6×6, 3×3, 4×4, 2×2.

**Multi-pass verification:**
- *Logical correctness:* `parseSpecification` handles strings, objects, and `null`; `normaliseToWindowSpec` defaults missing fields to safe values.
- *Integration:* `deriveWindowData` runs on mock data without throwing — `WindowCard` displays the "Sash W / Top sash H" footer.
- *Edge cases:* Empty estimate items array shows a card-style empty state instead of crashing; missing `specification` JSON falls back to dimensions from the row.

**Verdict:** ✅ Done. Mock data flow works end-to-end; Supabase flow uses the same shapes (will work once keys are provided — see BLOCKERS.md).

---

## Phase 2 — 3D Preview

**Goal:** Click window → see 3D preview.

**What I did:**
- `src/3d/SashWindow3D.jsx`: parametric 3D sash window using `@react-three/fiber` + `@react-three/drei` primitives. Built directly from `CONSTANTS` in `calculations.js` so the geometry matches what cut lists / 2D drawing show — same `JAMBS_WIDTH`, `STILE_WIDTH`, `TOP_RAIL_WIDTH`, `MEETING_RAIL_WIDTH`, `BOTTOM_RAIL_WIDTH`, `GLAZING_BAR_WIDTH`.
- Renders frame (head, jambs, sill), top sash + bottom sash (each with stiles, rails, glass plane and bars), glazing bars (rows × cols).
- `OrbitControls`, `ContactShadows`, `Environment` for realistic shading.
- Exterior / Interior toggle = group rotation by π around Y axis, camera Z flipped.
- Wood colour picked from `windowSpec.color.outside/single` via a small named-colour map (white, cream, sage, green, black, heritage, grey) + hex passthrough.
- Lazy-loaded via `React.lazy(() => import('../../3d/SashWindow3D.jsx'))` so the 3D bundle (≈900 kB) doesn't block initial page load.

**Why this approach instead of copying `ParametricSashWindow.jsx` verbatim:**
The original file is 124 kB / ~3000 lines of code with many dependencies on RAL palettes, ironmongery models, profile beads, horns variants, and runtime configurator props. For production planning we don't need that level of fidelity — we need geometry that *matches the cut list*. Building a slim parametric component from `CONSTANTS` directly guarantees this, and keeps the 3D bundle reasonable. Copying the heavy component would still need significant prop-shape adaptation. Documented as a deliberate trade-off rather than missing work.

**Multi-pass verification:**
- *Logical correctness:* All dimensions come from the same `CONSTANTS` table the 2D + cut list use — no drift.
- *Integration:* Renders inside its tab without errors; lazy chunk only loads when 3D tab is opened.
- *Edge cases:* `deriveWindowData` failure falls back to safe defaults; missing colour string defaults to white.

**Verdict:** ✅ Done — basic but correct. Logged in BLOCKERS.md as `IMPROVEMENT` (not blocker): if higher-fidelity 3D is required (profile beads, horn variants, ironmongery), Phase 2.1 should bring in the full `ParametricSashWindow.jsx` and adapt prop shapes.

---

## Phase 3 — 2D Technical Drawing

**Goal:** Canvas-based technical elevation with dimensions.

**What I did:**
- `src/engine/canvas-renderer.js`: adapted from `Windows-App-electron-/js/renderer.js`. Refactored to:
  - Accept a passed-in `<canvas>` element (no global ID lookup, no global `panzoom` singleton).
  - Take `windowSpec + settings` as plain arguments (no global state.js dependency).
  - Single fit-to-canvas zoom (no pan/zoom for now — keeps the drawing tab static and printable).
  - Preserved style: black-on-white CAD look, red dimension lines with witness lines + 45° tick marks + label backgrounds.
- `TechnicalDrawing2D.jsx`: React wrapper that calls `drawTechnicalElevation(canvas, windowSpec, settings)` on mount and on resize.
- Dimensions drawn:
  - Overall frame width (top)
  - Overall frame height (left)
  - Top sash height (right, inside)
  - Bottom sash height (right, inside)
  - Sash width (under frame)

**Multi-pass verification:**
- *Logical correctness:* Bar positions come from `derived.barPositions`, which `calculations.js` computes from grid mode — same data path as 3D and cut list.
- *Integration:* Canvas resizes correctly with `devicePixelRatio` for crisp rendering.
- *Edge cases:* `glassH <= 0` (sash too small) doesn't throw; `Number.isFinite` guards on dimensions.

**Verdict:** ✅ Done. Drawing matches the source renderer's output style; dimensions are mathematically consistent with the cut list.

---

## Phase 4 — Cut List & Materials

**Goal:** Per-window cut list, pre-cut groups, optimiser, glass + hardware.

**What I did:**
- `src/engine/optimizer.js`: copied the best-fit-decreasing algorithm from `Windows-App-electron-/js/optimizer.js`. Only change: `optimisePrecut(precut, settings)` takes settings as an argument instead of importing the global `state.js`. Algorithm preserved verbatim.
- `src/engine/lists.js`: per-window builders for cut list, pre-cut groups (sash + box, with section→raw mapping from settings), glass list, hardware list.
- `CutListPanel.jsx`: 5 sections rendered as tables —
  1. Cut list (frame + sash + glazing bars)
  2. Pre-cut groups (sash sections grouped)
  3. Optimiser output with bar layout visualisation (each bar drawn as a stacked horizontal bar with cuts coloured, end-trim greyed, utilisation % on the right)
  4. Glass list
  5. Hardware list
  - Footer: frame constants used (cross-reference for engineers).

**Multi-pass verification:**
- *Logical correctness:* Optimiser uses `settings.kerf`, `settings.endTrim`, `settings.minimumPiece`, `settings.stockLengthSash` exactly as the original.
- *Integration:* `buildCutListForWindow` uses `derived.components.box` and `derived.components.sash` — the same shapes `calculations.js` returns from `deriveWindowData`.
- *Edge cases:* Empty pre-cut groups show "No sash pre-cut required" instead of an empty table.

**Verdict:** ✅ Done. Numbers traceable end-to-end (constants → derived → list → optimiser).

---

## Phase 5 — Export PDF / Excel / DXF

**Goal:** Client-side download for production documents.

**What I did:**
- `utils/pdfExport.js` (jsPDF + jspdf-autotable):
  - Header with window name, dimensions, qty, generated timestamp.
  - Embedded technical drawing PNG (rendered offscreen via `drawTechnicalElevation` → `canvas.toDataURL`).
  - Cut list table.
  - One pre-cut + optimiser table per sash section.
  - Glass + hardware tables.
  - Auto page-breaks via `y > threshold` checks.
- `utils/excelExport.js` (xlsx / SheetJS):
  - Worksheets: `Summary`, `Cut list`, `Pre-cut`, `Optimiser`, `Glass`, `Hardware`.
- `utils/dxfExport.js`:
  - Minimal AutoCAD DXF: frame outline + opening + sash-top + sash-bottom on separate layers (`FRAME`, `OPENING`, `SASH-TOP`, `SASH-BOTTOM`). Coordinates in millimetres so the file imports 1:1 into CAD software.
- `ExportControls.jsx`: three buttons (PDF / Excel / DXF) with busy state + error display.

**Multi-pass verification:**
- *Logical correctness:* All three exports use the same `buildCutListForWindow` / `buildPrecutForWindow` / `optimisePrecut` source data — no divergence.
- *Integration:* `renderDrawingToDataURL` mounts the canvas off-screen briefly to call `drawTechnicalElevation`, then removes it.
- *Edge cases:* `derived == null` short-circuits with an explanatory message; no crash on empty cut lists.

**Verdict:** ✅ Done — all three formats produce downloadable files. Tested via build only; runtime download tested by the user is the next step.

---

## Final checks

- ✅ `npm run dev` starts cleanly in <300 ms (port 5173).
- ✅ `npm run build` completes (1053 modules → ~1.1 MB index bundle, 897 kB lazy 3D bundle, gzip ≈ 351 kB + 246 kB).
- ✅ README.md, BLOCKERS.md present.
- ⚠️ Bundle size warning is real — `index.js` is over 500 kB. Could be reduced with `manualChunks` for jsPDF / xlsx; not blocking for first delivery.
