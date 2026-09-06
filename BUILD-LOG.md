# BUILD-LOG.md

Verdicts per phase, in execution order.

---

## 2026-09-06 — ARCHED-WINDOWS-v4 night 6 (branch `claude/arched-windows-v4-stages-9diax6`)

Inputs read in full: `CLAUDE.md` → `docs/handover/ARCHED-WINDOWS-v4.md` → `BLOCKERS.md` (headers + open items) →
`BUILD-LOG.md` (night 5) → `arch.js`, `profile.js`, `archDxf.js`, `dxfWriter.js`, `cncExport.js`, `calculations.js`
(arch plan wiring), `lists.js` (curved members, pre-cut blanks), `WindowSettingsPage.jsx`, `windowProfileStore.js`,
`NumInput.jsx`, the t16–t24 harness conventions. Entry gate (CLAUDE.md): `pieceStockTrapezoid` 2, `glazingRebate` 1,
"Tracery LSP" 0 → arch-pieces-v1 is on `main`. Baseline on the branch start: t16 507, t17 72, t18 178, t19 244,
t20 116, t20_bars 28, t21 120, t22 75, t23 80, t24 26 — ALL PASS (after `npm install`, `pip install ezdxf`).

Stages tonight (Piotr 06.09, gate before each next stage): 1 = Block C planner v2, 2 = Block B glazier PDF,
3 = Block E intersecting, 4 = Block F frame 68.

### STAGE 1 — Block C: segment planner v2 (`profile.js`, `arch.js`, `archDxf.js`, `cncExport.js`, `calculations.js`, `ConfiguratorPage.jsx`, `lists.js`, `windowProfileStore.js`, `WindowSettingsPage.jsx`, `verify/arch/t25.mjs` new, `verify/arch/lib/indPlanner.mjs` new, t16 / t17 / t18 / t19 / t20 / t21 / t22 / t23 / t24 re-vectored)

**Understanding:** the v1 planner cut every arc of the chain on its own (a joint at every tangent point) with a 36°
grain-run-out rule, which produced the ~100 mm haunch triangles Piotr rejected. v4: the WHOLE chain (springing →
springing) is partitioned by outer arc length into N equal pieces — a piece may carry a haunch and part of the crown
(the CNC cuts the compound curve from one board); a gothic is split at the apex first. Two HARD limits replace the
36° rule: overall length ≥ `cnc.minClampLength` 450 (Rover A 1532: two Uniclamps + end cuts) and the shorter stock
edge ≥ `arch.minPieceLength` 400; the board cap is the widest entry of the new stock list `63 75 95 105 120 150 180 200`.
Fewest pieces first; an economy alternative (N + 1 … N + 3 on a narrower board) wins when the fewest plan wastes
more than `arch.wasteThreshold` 0.45 of its boards. CLAMPS layer with two Uniclamp footprints per flat piece; a
"CNC & arches" card edits every number.

**Two approaches, one rejected:**
- Springing end of the RAW piece: (a) keep the v1 horizontal cut on the springing line — rejected: on a tilted
  compound piece (three-centre 1000 × 250, piece axis 26.6° to the horizontal) the horizontal cut runs the board
  215 mm past the frame edge (outer 829 / inner 379) and FAILS the 400 limit on a plan the spec declares valid;
  (b) cut the raw springing end SQUARE to the piece axis at the band extent and let the CNC rout the horizontal
  springing face with the contour (it is part of the CONTOUR polyline since v1) — chosen; cut code `Q`; the spec's
  C.5 verdicts hold. Logged as a DEFAULT (open) decision, BLOCKERS 16.3.
- Board placement on the band: centred (arch-pieces-v1) kept; the flush-inner alternative would lengthen the
  shorter edge (sash 1000 head 395.5 → 410, circle 800 leaf 390 → 400) — not changed silently, BLOCKERS 16.4.

**Built:**
- `profile.js` — `arch.version 4`: `stockWidths [63, 75, 95, 105, 120, 150, 180, 200]`, `minPieceLength 400` (hard),
  `wasteThreshold 0.45`; `maxSegmentAngleDeg` and `pieceRule` (D13) removed — D13 is closed by v4 C.3/C.4. New block
  `cnc { minClampLength 450, clamp { base 130, minThickness 40, maxThickness 98, minPiece 140 }, clampClearance 20 }`.
  Migration: a stored v3 arch block is replaced whole, a v4 block merges key by key (the card edits it from now on),
  `cnc` filled from the default.
- `arch.js` — `ringGroups` (chain / gothic sides / closed ring), `partitionGroup` (N equal by outer arc length,
  chord axis u + outward normal b, band projection with `arcsExtent`, end planes: radial / vertical apex axis /
  square springing), `piecePoly` / `pieceBandPoly` / `pieceJoints` / `pieceEndEdge` / `pieceStockTrapezoid` /
  `pieceStockEdges` generalised to arc ARRAYS per piece, `bulgePolyArea` (exact band area), `planArchSegments(ring,
  arch, cnc)` with the two limits, fewest + economy, `noStockReason` 'no stock board fits' | 'below minimum length'
  and readable `reasons`; `buildArchPlan` / `buildCirclePlan` carry `cnc`, `depths` (93 / 57) and `blank` (limits).
  The v1 `partitionArc` / `pickOption` / `PIECE_RULES` / `endCut` are gone (superseded, no caller left).
- `archDxf.js` — layer `CLAMPS` (colour 3): `clampFootprints` — two `clamp.base` squares per flat piece, centred
  across the board, `clampClearance` from both end-cut LINES over the square's whole height (the joint planes lie 15
  inside the rough ends), pushed to the two ends; one square + warning when the room is under 2 × base, none +
  warning under 1 × base; thickness warning when the member depth is outside the jaws (the sash box head 164 →
  `WARNING: PIECE THICKNESS 164 OUTSIDE THE UNICLAMP JAWS 40-98`). Text block per ring: `CHAIN / SIDE n / RING
  R… L… …DEG: FEWEST n x board s L… ROUGH … WASTE p%`, `ECONOMY ALT … -> DEFAULT FEWEST|ECONOMY (THRESHOLD 45%)`
  or `NO ECONOMY ALT WITHIN N PIECES`, `LIMITS: OVERALL >= 450 (CLAMP)  SHORTER EDGE >= 400  STOCK MAX 200`,
  `CLAMPS (SUGGESTION): UNICLAMP 130 x 130, CLEARANCE 20 …, PIECE THICKNESS 93`; cut codes `J<deg>` / `Q` / `A<deg>`.
- `cncExport.js` — `buildSashArchPlan` passes `cnc` + depths (box depth / sash depth from the sash profile);
  `archParamsForWindow` skip = `no valid blank plan (<reason>): <member> <group>: …` with the failing piece named.
  `calculations.js` (3 call sites), `ConfiguratorPage.jsx`, `lists.js` (cut code `Q`) follow.
- Settings: `windowProfileStore.setCasementPath(path, value)` (roots arch / cnc / tracery / geometry, finite numbers
  only) + `setCasementStockWidths(text)` (comma list → sorted positive numbers, empty refused); `WindowSettingsPage`
  casement page gets the **CNC & arches** card (lock toggle like the others): finger length / groove / pitch,
  contour allowance, glazing rebate, stock widths, min clamp length, min piece length, waste threshold, Uniclamp
  base / jaws / clearance, tracery paneOffset / profileWidth / ridgeLand / edgeLand / mitreLeg, and a validation
  line = the live plan of a semi-circle at the sample width (`✓ frame head 3 × 150 · leaf top 2 × 200` or the
  planner's reason / `ArchError`). No spinner arrows (global CSS rule).

**Numbers (independent sampler in `lib/indPlanner.mjs`, 800 points per arc, head ring face 57, allowance 10, finger 15):**
| arch | fewest (spec C.5) | W_req mine / spec | economy default @ 0.45 | raw edges of the fewest plan (outer / inner) |
|---|---|---|---|---|
| HALF 1000 | 3 × 150 ✓ | 135.0 / 134.7 | 3 × 150 (4 × 120 fails 450: rough 441.7) | 553.8 / 467.2 · 597.6 / 424.3 · 553.8 / 467.2 |
| ROUND 1000 rise 250 | 2 × 180 ✓ | 155.7 / 158.3 | 2 × 180 (3 × 150 fails 400) | 621.9 / 531.9 ×2 |
| GOTHIC 1000 (per side) | 2 × 120 ✓ | 108.8 / 112.6 | 2 × 120 (3 × 95 fails 450) | 533.5 / 501.4 · 580.6 / 428.5 |
| HALF 1500 | 3 × 180 ✓ | 168.5 / 168.1 | **4 × 150** (waste 63 % > 45 %, alt 55 %) | 884.2 / 676.4 ×3 |
| tc240 1200 | 2 × 180 ✓ | 166.6 / 170.6 | **3 × 150** (waste 61 %, alt 55 %) | 968.4 / 446.4 ×2 |
Stock capped at 105: none of the five has a plan — a board fits at 5 / 6 / 3-per-side / 6 / 7 pieces and the
overall length then fails 450 (339 / 230 / 369 / 416 / 233). **Spec errata E3:** the C.5 edge lengths (508.8 / 432,
572.5 / 468.9, …) are the allowance-band chords of v1 (`L` / `L_in`), not raw-piece edges, and its W_req differ from
the sampler by up to 4 mm; the piece counts and boards agree exactly — BLOCKERS 16.1. Circle: one closed group per
ring (800 frame 4 × 180; 1000 frame 6 × 150 economy / leaf 5 × 180 economy). 2D contours, glazier exports and
the 3D are untouched (the planner feeds the CNC DXF, cut list notes, pre-cut, BOM, PP only).

**Consequences of the hard limits (honest report, BLOCKERS 16.2 — the engine reports, never splits finer):**
- gothic 1000 LEAF top rail: 2 per side on 120 → shorter edge 386.2 < 400 → no valid plan (the head is fine);
- circle 800 LEAF ring: 4 × 180 → 390.1 < 400 → no plan (frame ring 4 × 180 fine);
- arched SASH 1000 semi-circle box head (80 face): 3 × 180 → 395.5 < 400; gothic 1000 sash head likewise;
- every W 400 arch and the W 470 elliptical: no piece can reach 450 (semi-circle outer length 628) → no plan;
- the Arch DXF export skips these with `no valid blank plan (below minimum length): …`; cut list notes say
  `no stock board fits`; the PP curved row flags the reasons. Piotr can lower the limits on the new card.
Harness samples moved off the blocked sizes: sash CNC samples 1200 (`sample_sash_arch_1200_semi-circle.dxf`,
`_1200_gothic.dxf` — the stale 1000 files deleted), circle CNC sample 1000 (`sample_circle_1000_sunburst.dxf`, the
800 CNC file deleted; the 800 glass / tracery samples stay — no planner in them); t19's gothic 1000 contour
comparison runs with `minPieceLength 0` after asserting the honest skip.

**Verification:** t25 121/121 (profile v4 + migration; C.5 fewest plans = spec; W_req / raw edges / waste vs the
independent sampler ±0.5 / ±0.005; cap-105 blocks with the reason; invariants — compound pieces, apex split, closed
ring, one-board plan, band inside the trapezoid; economy rule at thresholds 1.0 / 0 / 0.45; DXF CLAMPS on four
regenerated samples via ezdxf — 2 squares per piece, 130 × 130, centred, ≥ 20 (+15 finger) from the cuts, text
lines, cut codes with Q, thickness warning on the sash head; pre-cut / PP / export skips; settings card + store
grep). Re-vectored: t16 367 (planner sections against `lib/indPlanner.mjs`, closed forms for single-arc middle
pieces, sample DXF texts, migration), t17 70, t18 178, t19 246, t20 116, t20_bars 28, t21 120, t22 77, t23 81,
t24 26 — ALL PASS. `npm run build` OK. esbuild on every touched file, `grep -F` after every write.
**Not verified:** the card in a browser (no UI run in the container — structural grep + esbuild only), the DXF in
VCarve / bSolid (CLAMPS placement is a suggestion; whether the Uniclamp really sits under the piece that way is
Piotr's call), the economy threshold on real jobs (0.45 fires on most semi-circles with a feasible alternative —
BLOCKERS 16.5), the square springing end on the CNC (16.3).
**Verdict: ✅ Stage 1 (Block C)** — t25 + t16–t24 ALL PASS, build green; ⚠️ the limits block four common sizes
(listed above) until Piotr confirms the numbers or the edge model.

## 2026-09-07 — ARCHED-WINDOWS-v3 night 5 (branch `claude/arched-windows-v3-9v0sw7`)

Inputs read in full: `CLAUDE.md` → `docs/handover/ARCHED-WINDOWS-v3.md` → `BLOCKERS.md` → `BUILD-LOG.md`
(night 4) → `arka_CNC-piotr.dxf` through ezdxf (every entity dumped, see 0.4) → the `arka-lsp-package`
README / JSON / LSP (offsets and section only) → `arch.js`, `archDxf.js`, `dxfWriter.js`, `glassDxfExport.js`,
`glassPdfExport.js`, `CasementGlassDrawing2D.jsx`, `archDrawUtils.js`, `profile.js`, `calculations.js`
(casement + sash branches), `specification.js`, `lists.js`, `cncExport.js`, the t18 / t19 harness conventions,
PSW `price-calculator.js` 940–1075, `online-estimate.html` (arch radios, hinge radio, fix bars),
`estimate-manager.js` 675–700, `ArchedSashWindow.jsx` 95–120 / 340–420. Baseline on the branch start
(`origin/main`): t16 504/504, t17 72/72, t18 178/178, t19 241/241 ALL PASS (after `npm install` — the container
had no `node_modules`; t18 / t19 need react-dom / jspdf resolvable).

Stages tonight (Piotr 07.09, gate before each next stage): 1 = Block 0, 2 = Block 1 A–E, 3 = Block 1 F–J +
Block 3, 4 = Block 4 + Block 6.

### STAGE 3a — Block 1 F–J: arched SASH, drawings / exports / 3D (`archDxf.js`, `cncExport.js`, `glassDxfExport.js`, `traceryExport.js`, `FrontElevation2D.jsx`, `BoxDetail2D.jsx`, `SashDetail2D.jsx`, `GlassDrawing2D.jsx`, `VerticalSection2D.jsx`, `CasementGlassDrawing2D.jsx`, `ArchedSashWindow.jsx` new, `archedSashGeometry.js` new, `App.jsx`, `windowSpecToConfig.js`, `WindowDetailPage.jsx`, `verify/arch/t22.mjs`)

**Understanding:** Stage 2 gave the arched sash an engine; the workshop still needs the two curved members on the
CNC (box head 80 face, top rail 57), the glazier's upper unit, the tracery board when a pattern is set, the five
2D sheets with the arc, and a 3D that is not the rectangular sash. Rectangular sash sheets must not move by a byte.

**Baseline first (J):** `verify/arch/t22_baseline.mjs` → `fixtures/rect-sash-sheets.json`: the six rectangular
fixtures × 7 sheets (elevation, box, upper, lower, glass ×2, section) = 42 SVGs rendered from HEAD **before** any
sheet was touched (`lib/sashSheets.mjs` bundles the sash sheet tree the way t19 does for the casement).

**Two approaches, one rejected (F):** (a) a second DXF builder for the sash (`sashArchDxf.js`) — rejected: the
CONTOUR / PIECES / FIT rows are the same drawing with other radii, a copy drifts; (b) `buildSashArchPlan()` in
`cncExport.js` builds a plan with `kind 'sash'` (head ring + top rail ring from `buildSashArchGeometry`, glass
outline, `fit.gap` 9, no rebate wall) and `archDxf.js` accepts it — chosen. The FIT text of a sash reads
`RUNNING GAP 9 (HEAD 80 FACE, SASH AT THE STILE LINE)`; the casement row is unchanged.

**Built:**
- **F** `archDxf.js` — `plan.kind === 'sash'`: rows `S-ARCH HEAD` / `S-ARCH TOP RAIL`, no hinge text (`SASH`),
  FIT row without the rebate wall; `cncExport.js` — `buildSashArchPlan`, `archParamsForWindow` accepts a sash
  (triple never), `downloadDxf(filename, content, mime)`. Samples `sample_sash_arch_1000_semi-circle.dxf`,
  `_1200_three-centre.dxf`, `_1000_gothic.dxf`.
- **G** `glassDxfParamsForWindow` / `traceryParamsForWindow` accept `category 'sash'` (upper unit = the engine's
  `glassOutline`, bands / edge cover / axes from Block 0, glass inset override for the sash rebate);
  `canExportTracery` for a patterned sash; samples `sample_glass_sash_1000x2200_semi-circle_hub-spoke.dxf`,
  `sample_tracery_sash_hub.dxf`. `WindowDetailPage`: Arch DXF / Tracery / Glass DXF buttons enabled for
  `category === 'casement' || windowSpec.arch.shape`.
- **H** 2D from `derived.arch` ArcChains through `archDrawUtils` (no second geometry): `FrontElevation2D` — head
  ring band, jambs to the springing, upper sash outline + unit + bars, lower h bars, dims start / rise, R labels,
  third title line, `data-arch-origin` for the harness; `BoxDetail2D` — head ring, jambs to the springing,
  `S-ARCH HEAD 80` label; `SashDetail2D` — arched upper sash outline / daylight / unit / bars, springing line,
  `rise` chain; `GlassDrawing2D` — the upper arched unit delegates to `CasementGlassDrawing2D` (Block 0 glazier
  sheet: bands, edge line, bar-end table) with a `sash-upper` group; `VerticalSection2D` — `ARCH HEAD` / `ARCH
  TOP RAIL` labels on the curved members. Every rectangular path is behind `derived.arch?.geometry` checks.
- **I** `ArchedSashWindow.jsx` ported from PSW (1003 lines, PSW file 1:1 as the base) with an `Outer` wrapper:
  `resolvePcShape` (PC names first, PSW ids mapped, unknown → semi-circle), props `archRise`,
  `archMinHaunchRadius`, `pcShape`; the outline builders `arcPtsPC` / `shapeContourPC` / `apexRisePC` read
  `archedSashGeometry.js` (new, pure: `engineArcs` = `archArcs` + `offsetArcs` → constant band, `engineArcPoints`,
  `engineApexRise`, `chainTo3D`) and fall back to PSW's sampler when the engine cannot offset the contour.
  PSW's named-export blocks appended to `ParametricSashWindow.jsx` and `FixFrameWindow.jsx` (export, no copy —
  nothing above the block changed). `App.jsx` renders `<ArchedSashWindow>` for `sashType 'arched'`, keys
  `archHBars` / `archVBars` / `lowerHBars` added; `windowSpecToConfig` emits `sashType 'arched'`, `archShape`,
  `archRise`, `archProfile`, `barPattern`, bars, `archMinHaunchRadius` for an arched sash.

**Verification (t22 75/75 ALL PASS):** §1 42/42 rectangular sheets byte-identical to the fixture; §2 sash DXF
rows / radii / FIT gap 9, ezdxf round-trip on the three samples; §3 glazier DXF layers + tracery for the upper
unit; §4 every SVG arc on the five arched sheets sits on an engine ring (centre + radius ±0.01 after the sheet
transform); §5 3D helper (constant band, rule C start, fallback null, names) + `windowSpecToConfig`; §6 wiring
grep. The arched sheets were rendered headless (Chromium) and looked at as PNG. `npm run build` OK.
**Not verified:** the 3D in a browser (no WebGL render in the container — same as night 4), the DXF in VCarve /
AutoCAD, the PDFs. **Findings → BLOCKERS §13.** **Verdict: ✅ Block 1 F–J** (3D ⚠️ compiled + helper-tested only).

### STAGE 3b — Block 3: FIXED windows in the casement batch (`profile.js`, `arch.js`, `specification.js`, `calculations.js`, `lists.js`, `bom.js`, `glassBars.js`, `traceryExport.js`, `archDxf.js`, `cncExport.js`, `glassDxfExport.js`, `glassPdfExport.js`, `projectStore.js`, `ConfiguratorPage.jsx`, `windowSpecToConfig.js`, `App.jsx`, `ArchedCasementWindow.jsx`, `archDrawUtils.js`, `CircleFixedDrawing2D.jsx` new, four casement sheets, `verify/arch/t23.mjs`)

**Understanding:** Piotr 07.09 — a fixed window "podchodzi pod casement batch, ale jednak nie casement": the casement
frame + a leaf that never opens ("leaf tylko"), no hinges, no handle, no opening symbol; shapes rectangle / Round /
Gothic / circle. PSW sells it as the fix-only product (`fixShape`, `fixType`, `fixArchRise`, `fixCircleBarPattern`,
`fixCircleOffset`, `fixSemiBarPattern` / `fixGothicBars`).

**Two approaches, one rejected:** (a) a fourth engine (`deriveFixWindow`) with its own members — rejected: the fixed
leaf IS the casement leaf (same sections, same deductions), a copy drifts; (b) `casement.kind 'fixed'` inside
`deriveCasementWindow`: the layout is forced to `040L` with `casementHinges ['fixed']`, so the existing dummy-sash
path (no hardware picks, no opener) does the work and every number stays the hinged casement's — chosen. The circle
is the one new geometry: the frame and the leaf are full rings, so `arch.js` gets `circleArcs` (two half-arcs,
centre at the origin — every chain helper, the ring builder and the segment planner work unchanged) and
`buildCircleGeometry` on the same profile faces as the arch.

**Built:**
- Data: `casement.kind` ('opening' | 'fixed'; PSW `windowType 'fix-only'` → casement batch + fixed), `archFromSpec`
  reads the PSW fix fields (`fixShape` rectangle / circle / arch ids, `fixArchRise`, the three pattern fields,
  `fixCircleOffset` → `bars.circleOffset`), `circleFromSpec` (shape 'circle', rise = start = W/2, hinge null, pattern
  none | sunburst). Store whitelist `casementKind`, `fixCircleOffset`.
- Profile: `fix.construction 'fixedLeaf'` (DEFAULT open; `directGlazed` refused readably — no rebate numbers),
  `arch.patterns.sunburst { offset 200, spokes 6 }` (PSW CircleFrame), `migrateCasementProfile` fills both.
- Engine: fixed → `040L` + `['fixed']`, notes `fixed leaf`, `derived.casement.kind`; circle → `buildCircleGeometry`
  (800: frame 400 → 343, leaf 360 → 293, glass 305.5, rebate wall 364), `C-FRAME RING` (`C-FRR`, 57x93, centre
  2π·371.5) and `C-LEAF RING` (`C-LFR`, 67x57, 2π·326.5) instead of head / jambs / cill / stiles / rails, glass unit
  `kind 'circle'` (611 × 611, true area), `buildCircleBars` (chords h / v as PSW, sunburst = ring at R − offset + 6
  spokes to the glass edge), tracery on the circle board (full mode), seal = ring circumference, paint π·R².
  Cut list / BOM rows for the two rings (head / top-rail stock).
- Glazier: `glassBars.js` circle branches (edge poly two half circles, bar ends measured from the top of the circle,
  chords by x / y), glazier DXF (`DIAMETER 611 R 305.5`), glass PDF outline path, `CasementGlassDrawing2D` circle
  contour + centre lines. Tracery: `boardFromOutline` circle board, full mode; two fixes in the arrangement —
  overlapping-piece dedupe keyed by the mid-point (the two halves of a circle share both ends) and `offsetFace` on
  a single merged full-circle edge (hub pane, board).
- CNC: `buildCirclePlan` (kind 'circle'), `archDxf` prints `FIXED LEAF` instead of `HINGE L / R` (also for a fixed
  arched casement: `plan.fixed`), FIT row with the rings + the dashed rebate wall; `archParamsForWindow` routes the
  circle. Samples `sample_circle_800_sunburst.dxf`, `sample_glass_circle_800_sunburst.dxf`,
  `sample_tracery_circle_800_sunburst.dxf` / `.lsp`.
- 2D: `CircleFixedDrawing2D` (elevation / frame / leaf views: rings, rebate wall, glass, bars, centre lines, radii, Ø
  dims, blank-plan text) — the three casement sheets delegate a circle to it after their hooks; the rectangular /
  arched sheets are untouched apart from the pane role text (`P1 fixed`).
- 3D: fixed → `casementHinges ['fixed']` (CasementWindow's own fixed pane) / `fixedLeaf` prop on
  `ArchedCasementWindow` (no handle, opening 0); circle → PSW's `FixFrameWindow` circle branch (PC's copy is already
  1:1 with PSW — the "raise it" in the spec was stale) via `windowCategory 'fix-only'`.
- Configurator: Kind chips Opening | Fixed; Fixed → Shape chips Rectangle | Round | Gothic | Circle (Round / Gothic
  reuse the shared arch controls without a hinge side; the layout picker is hidden), circle locks the height to the
  width and shows the ring radii, pattern chips none | sunburst; `buildCirclePlan` errors block the save.

**Verification (t23 79/79 ALL PASS):** §1 circle geometry (400 / 343 / 360 / 293 / 305.5, planner 2 × 5 pieces, errors
for H ≠ W and W < 400, sunburst ring 105.5 + 6 spokes L 200 at 60°, chords, per-window offset, hub-on-circle and
sunburst-on-arch refused); §2 engine circle 800 (two ring records, no hardware, glass true area, tracery 7 panes,
seals / paint / beading); §3 rectangle fixed = 040L stripped JSON byte-equal; §4 arched fixed = arched casement
stripped JSON byte-equal (+ gothic); §5 PSW fix-only circle / gothic / semi-circle / rectangle imports, PC kind,
import errors; §6 CNC DXF ezdxf round-trip (rows, FIXED LEAF, FIT radii, dashed wall, 24 piece contours, merged
export); §7 glazier DXF (contour 2 × bulge 1 R 305.5, edge 294.5, bands) + tracery DXF / LSP round trip (7 panes,
hub rail / limit radii); §8 sheets: every SVG arc of the three circle sheets concentric on the sheet centre with an
engine radius, glass sheet likewise, fixed rectangle without the opening symbol and otherwise identical; §9 3D
config; §10 wiring grep. Rendered the circle elevation / leaf / glass sheets headless and looked at them.
**Not verified:** the configurator and the 3D in a browser, the DXFs in VCarve, the fixed window inside the
production pack / PDFs beyond the engine records. **Verdict: ✅ Block 3** with the DEFAULT (open) entries in
BLOCKERS §14 (2D circle case ✅, 3D fixed leaf ⚠️ compiled only).

### STAGE 3 GATE — ✅ ALL PASS

t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30 · t21 120 · t22 75 · t23 79 · `npm run build` OK.
Rectangular casement (t18 / t19 / t20 fixtures) and rectangular sash (t21 / t22 fixtures) derived JSON and
sheets byte-identical (`derived.casement.kind` is present only on a fixed window). t16 / t18 assertions updated
for the v3 vocabulary (a rectangular sash now skips as "not an arched sash", sunburst in ARCH_BAR_PATTERNS, the
configurator's save gate reads `shapeBlocked`).

### NIGHT 5 — FINAL VERDICT (all four stages) and the CLAUDE.md checklist

**Gates:** Stage 1 (t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30), Stage 2 (+ t21 120), Stage 3
(+ t22 75 · t23 79), Stage 4 (+ t24 26) — every harness ALL PASS on the final tree, `npm run build` green,
esbuild clean on every touched file, no Polish in sources (Piotr's quotes paraphrased in English).
Rectangular casement and sash: derived JSON + sheets byte-identical to the HEAD fixtures (t18 / t19 / t20 /
t21 / t22). t16 / t18 assertions were updated where v3 changed the rule (hinge value 1:1, sash exports,
sunburst vocabulary, blank board metres in the BOM, the configurator's save gate).

**Checklist:** branch pushed after every stage, `main` untouched · harnesses ALL PASS · build OK · esbuild OK ·
diff limited to the spec's files + verify / docs / BUILD-LOG / BLOCKERS / CLAUDE.md · samples in
`docs/handover/samples/` (arch ×5, glass ×4 + merged, tracery DWG / hub / quad / gothic / custom / sash / circle
DXF + LSP, sash arch ×3, circle arch) · BUILD-LOG per stage · BLOCKERS §11–§15 with every DEFAULT (open) ·
SQL in `docs/handover/sql/`.

**What was NOT verified tonight (honest list):**
1. Nothing in a browser: the configurator (Kind / Shape chips, circle height lock, custom hub, arched sash),
   the 3D (arched sash port, fixed leaf, circle via FixFrameWindow), the Archive page, the dashboard Archive
   button, the read-only project page, the PP Curved members card.
2. No CAD: the DXFs (arch, sash, circle, tracery, glazier) were round-tripped through ezdxf and the LSP parsed
   back, never opened in VCarve / AutoCAD; the LSP never run in AutoCAD.
3. No PDF opened: the glass / elevation / elements / cut-list PDFs with arched, sash-arched and circle sheets.
4. Supabase: the archive SQL was not run; RLS not exercised (manual check in BLOCKERS 15.7); cloud writes of
   `archived` / `archived_at` only grep-checked.
5. Physical sanity that only Piotr can give: the 80 sash head ring and the 89 inset (12.1), the circle leaf's
   4 / 17 running fit all round (14.3), the blank rough-length rule (15.3), the sunburst 200 / 6 (14.5).

### STAGE 4 — Block 6 project ARCHIVE + Block 4 cross-cutting (`docs/handover/sql/2026-09-07_projects_archive.sql` new, `cloudSync.js`, `projectStore.js`, `ArchivePage.jsx`, `DashboardPage.jsx`, `ProjectDetailPage.jsx`, `lists.js`, `bom.js`, `pricing.js`, `ProductionPackPage.jsx`, `verify/parity/psw-casement-layouts.mjs`, `PSW-PARITY-REPORT.md`, `PSW-3D-ARCH-PORT.md`, `verify/arch/t24_stage4.mjs`)

**Block 6 — understanding:** Piotr 07.09 — finished projects clutter the dashboard. An archived project leaves
the dashboard, keeps its batches / windows / packs readable, and can come back.
**Two approaches, one rejected:** (a) `projects.status = 'archived'` — rejected: `status` is the production
status the dashboard already reads (`preparation` …) and `loadAll` already filters a boolean `archived`; (b)
`archived` boolean (made explicit) + `archived_at timestamptz` — chosen, SQL as a separate file, RLS untouched.
**Built:** SQL migration (idempotent: columns if not exists, backfill, tenant + archived index);
`cloudSync.saveProject` writes both fields, `loadArchivedProjects()` pulls archived = true with batches +
windows; store `archivedProjects` / `archiveProject` / `restoreProject` / `loadArchivedProjects` /
`getProjectById` (both lists), `clearAll` resets; `ArchivePage` table Project · Client · Batches · Windows ·
Archived on · Restore + search; dashboard card Archive button (immediate when every batch's pack is complete,
confirm modal otherwise — `ConfirmModal` gained `confirmLabel` / `tone`); project page opens an archived project
read-only (banner with Restore, no Add Batch / delete batch).

**Block 4 — built:** `lists.js` `CURVED_MEMBER_PLAN` / `buildCurvedMembersForWindow` (rows with radii, pieces,
per-arc n × stock × rough, finger) and `blankPiecesForRecord` — the pre-cut lists a curved member as its blank
pieces (qty n, rough length, section stock × depth), never as the arc length; `bom.makeRawResolver(name,
{ kind: 'blank', stock, depth })`; BOM board metres follow the blanks. PP: `CurvedMembersSection` in the Cut
List tab (per type); Arch DXF (all) + Tracery DXF / LSP (all) enabled for sash batches / packs (merged exports
for the arched sash). Pricing: `archedCasement.curvedMemberSurcharge` (0) × 2 members, in the breakdown. Parity
script updated to the v3 contract (hinge value 1:1, import ratios = PSW `RISE_RATIO`) and the report regenerated
(23 PASS · 2 DIFF · 0 HARD). Port doc §7 (fixed / circle / doors). Sash glazing arch left out of the engine
(BLOCKERS 15.1). PDFs: the sheets already reach the PDFs through `svgNodeToPng`, so the arched / circle sheets
ride the same path (not opened as PDFs tonight — 15.5).

**Verification (t24 26/26 ALL PASS):** §1 store round-trip archive → hidden → restore → visible (offline store, cloud
disabled), currentProject follows, delete / clearAll; §2 SQL file content, cloud writes, pages grep; §3 blanks
for an arched casement / arched sash / circle, BOM mm = Σ n × rough, rectangular pre-cut unchanged, PP grep; §4
pricing neutral at 0 and +80 at 40, parity report, port doc. **Not verified:** the SQL against Supabase (run by
hand, 15.7), the Archive page / dashboard button / read-only project page in a browser, the PP section on
screen, the cut-list PDF with blanks. **Verdict: ✅ Block 6, ✅ Block 4** (PDF / browser items ⚠️ unverified).

### 0.4 — tracery export DXF + LSP, the `arka` convention (`src/engine/cnc/traceryExport.js` new, `dxfWriter.js` POINT, `arch.js` patterns, `calculations.js`, `lists.js`, `bom.js`, `cncExport.js`, pages, configurator, 3D props)

**Understanding:** one timber board over the arched unit, cut on the CNC to the pane pattern; the bead R8 runs
along every opening. The workshop DWG (one quadrant, R 600, quad-hub-spoke) is the thing to reproduce; the
package explains the offsets (+2 rail / +10 limit / 22 bar / 18 margin) and the section; its mitre legs are
placed the wrong way round.

**Read from the DWG (ezdxf, not memory):** centre (−3227.6189, 1606.5905); board OUTLINE 4D6 R 600 to
x = centre + 7; panes 4D3 (hub R 189), 4CD / 4D0 (R 211–389), 4C5 / 4C8 (R 411–582), all bottoms at
centre + 18, hub cut at centre − 11; +2 (PANE) and +10 (FRONT_HINGES_3MM) as concentric offsets; 20 MITRE
polylines (19 corners, 581 + 587 one corner in two halves), e.g. 51A apex (−3510.4607, 1888.0181) → legs
(−3499.8541, 1877.4115) along the 45° spoke edge and (−3520.8413, 1877.1854) along the R 399 arc — both INTO
pane 4D2; section LINE 4E9 (6 mm) + ARC 4EA (R 8, 90°) on layer 0 = the package polyline `(0,0) → bulge
−0.4142 → (8,8) → (8,14)` after translation (asserted in t20 §4 — the section is NOT a DWG/package difference).

**Two approaches, one rejected:** (a) analytic panes per pattern (sectors of rings for hubs, lens shapes for
intersecting) — rejected: a second geometry per pattern and nothing for straight bars crossing a haunch;
(b) a planar arrangement of lines + circular arcs (split at intersections, overlapping pieces merged, stubs
pruned, faces walked with the interior on the left), each face offset edge-wise (bar edge barWidth/2, board
edge edgeMargin; arcs keep their centre, corners = intersection of the offset edges nearest the original
corner, vanishing edges dropped) — chosen: pattern-agnostic, exact arcs, the DWG falls out of it.

**Built:**
- `traceryExport.js`: curves, `intersections` (line/line, line/circle, circle/circle incl. T-junctions),
  `arrangementFaces`, `offsetFace`, `cornerGuides` (tangent difference > 0.5°, legs 15 mm along the curve
  into the pane, bulge kept), `boardFromOutline` (daylight = unit inset by `glassInset`), `barCurves`,
  `buildTraceryGeometry` (mode auto: quadrant when no pane straddles the axis — the axis becomes a bar edge
  and the cut a board edge 18 − 11 = 7 past it, exactly the DWG's 4D6; else full), `buildTraceryEntities`
  (layers `ARKA_OUTLINE · ARKA_PANE · ARKA_FRONT_HINGES_3MM · ARKA_MITRE · ARKA_SECTION · ARKA_PANE_ZEWN_REF ·
  ARKA_CENTRE · ARKA_INFO_NO_CUT`, section outside the board with `START`, texts incl. `NOT A TOOLPATH` and
  warnings), `writeTraceryLsp` (`(defun c:ARKA …)`, insertion point prompt Enter = 0,0, `-LAYER`, `entmake`
  LWPOLYLINE 90/70/10/42, POINT, TEXT — plain AutoLISP), `parseTraceryLsp` (harness), `buildTraceryForDerived`.
- Profile `tracery { paneOffset 2, profileWidth 8, ridgeLand 2, edgeLand 8, mitreLeg 15, sides 1,
  boardThickness 18 }` → bar 22 / margin 18 / limit +10 derived, never typed twice.
- Patterns (`arch.js`): generic `hubSpoke({ spokes, rings, hubVertical })` behind every hub preset
  (`HUB_PRESETS`: half-hub 0/1, hub-spoke 4/1, double 6/2, triple 8/3 from the profile ratios,
  **quad-hub-spoke 5 / [1/3, 2/3] + hub vertical** from the DWG) and `custom` (spokes 3–9, ring list from the
  window: `archSpokes` / `archRings`); `PSW_PATTERNS_FOR_SHAPE` kept 1:1, `PC_EXTRA_PATTERNS` only on the
  semi-circle. Ring-end verticals skipped on a zero-height springing (fanlight board).
- Engine: `derived.arch.tracery { mode, panes, areas, bbox, warnings }`, `C-TRACERY` (`C-TRY-P1`) record,
  paint + tracery face; `CUT_LIST_ORDER` `C-TRY`; BOM slot `c_tracery` (+ part list). Export:
  `traceryParamsForWindow` / `exportTraceryDxfForWindow` / `exportTraceryLspForWindow` / `exportTraceryMerged`;
  buttons `Tracery DXF` / `Tracery LSP` next to `Arch DXF` (disabled with the reason when no pattern),
  `Tracery DXF (all)` / `LSP (all)` on the pack. Configurator: the two presets in the chip row, custom UI.
  3D: `archSpokes` / `archRings` through App.jsx → ArchedCasementWindow → geometry helper (which now falls
  back to straight bars instead of throwing on bad bar data).

**Verification (t20 §4–§6, ALL PASS):** DWG reproduction — quadrant, 5 panes, 19 guides, pane radii 189 /
211–389 / 411–582 ±0.5 (the DWG's own hub arc is 0.32 off its circle), the 5 OUTLINE panes, 5 PANE and
5 FRONT_HINGES_3MM contours vertex for vertex ±0.5, +2 / +10 concentric exactly, every DWG MITRE matched
(apex ±0.5, legs ±1 mm — corner 51A to 0.02), legs 15.00 along the curve, section verbatim = DWG = package
DXF, board to +7, ZEWN_REF R 598; DXF read back by ezdxf (8 layers, counts), LSP parsed back = the same
45 entities. Engine windows: hub-spoke full 6 panes, quad-hub-spoke + 1V full 13, gothic intersecting,
custom 7 / [0.25, 0.55] — no collapse, panes inside the board; single + merged exports; samples written.
esbuild OK on every file, eslint no-undef clean, `npm run build` OK. Not verified: AutoCAD / VCarve (no CAD
here — BLOCKERS 11.16), a click-through of the buttons. **Verdict: ✅ 0.4** with DEFAULT (open) entries
11.4–11.8 / 11.12 / 11.13.

### 0.4b — hinge value 1:1 with PSW (`specification.js`)

Inversion removed: `hinge = value === 'left' ? 'left' : 'right'` (PSW default value `right`). t16 (7
assertions) / t18 (1) rewritten for the identity; t20 §7 asserts it and greps the old ternary away. PSW
label wording logged as 11.11. **Verdict: ✅ 0.4b**

### 0.4c — bar logic audit (`verify/arch/t20_bars.mjs`, ALL PASS 30)

208 shape × pattern × 0–3 h × 0–3 v cases (semi-circle 8 patterns, three-centre 1, gothic ×2 2): every user
vertical ends on the outline (< 0.01), the gothic centre bar at the apex, h bars strictly between the glass
bottom and the springing at the requested count (also at the profile's minimum straight height; 10 mm below
→ readable ArchError), hub ring-end verticals bottom → springing, no bar end outside the unit, bar run =
Σ lengths, beading = run × 1.15. PSW `PATTERNS_FOR_SHAPE` literal (990–995) = `PSW_PATTERNS_FOR_SHAPE`,
re-read from the live clone; fix radios none | sunburst / none | patternA read from `online-estimate.html`
(Block 3 vocabulary). `intersecting`: the PSW sampling loop (FixFrameWindow.jsx 667–700) copied — every
PSW vertex lies on a PC arc within its range (±1 step) for W 1000 / 1400 equilateral and 1000 drop; PC ends
exactly on the outline. Elevation / leaf sheet / glazier DXF: same bar count, DXF axes = engine ends.
**No PC bug found**; two PSW-behaviour questions logged (11.6, 11.12). **Verdict: ✅ 0.4c**

### 0.5 — small fixes from BLOCKERS §10

Leaf sheet R labels inside the daylight (haunch label collided with the `67` chain); arched elevation subtitle
without the layout code; 3D guides `rise … mm` + `start … mm`; rasteriser: the clipPath elevation rendered
through an `<img>` data URL in headless Chromium (bars clipped) — jsPDF itself not run in a browser. t19
244/244 (rectangular snapshot untouched). **Verdict: ✅ 0.5** (PDF page: morning, 11.10)

### 0.6 — profile decisions

`arch.minPieceLength` 150 (new, warn only: `plan.shortPieces`), the rest confirmed unchanged (t20 §7).
**Verdict: ✅ 0.6** (all DEFAULT (open), BLOCKERS 11.2 / 11.3)

### STAGE 1 GATE — ✅ ALL PASS

t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30 · `npm run build` OK · rectangular casements
byte-identical (t18 §3, t19 §1, t20 §6). Assertions rewritten tonight because the spec changed the rule:
t16 hinge ×7, t18 layers / text lines / PDF header / hinge / vocabulary / pattern table, t19 bar-end format
(x·y pairs gone) and the `GLASS_BAR_AXES` layer — each one names the v3 item.

### 0.2 + 0.3 — glazier DXF bands / edge / axes, bar-end dimensioning (`glassBars.js` new, `glassDxfExport.js`, `CasementGlassDrawing2D.jsx`, `glassPdfExport.js`, `profile.js`)

**Understanding:** the glazier lays an 18 mm spacer bar in the pattern and a perimeter spacer 11 mm inside the
contour; today the DXF gave him axes only and the sheet printed x·y pairs he cannot measure on a curve. Three
consumers (sheet, PDF, DXF) must show the same bands, the same edge line and the same bar-end numbers.

**Two approaches, one rejected:** (a) extend each consumer in place (three copies of the band / offset / apex
arc-length maths) — rejected, night 4 already paid for that with `archDrawUtils.js`; (b) one pure module
`src/engine/glassBars.js` (band curves, edge chain through `offsetArcs` in the arch frame, arc length from the
apex, the dimensioning rows + labels + table cells) and three thin consumers — chosen. New file outside the
spec's list, logged in BLOCKERS.

**Built:**
- Profile: `DEFAULT_CASEMENT_PROFILE.glass = { barWidth 18, edgeCover { default 11, double, double_slim,
  triple, single, passive: 11 } }` (DEFAULT (open): 11 for every type until Piotr gives the triple value) +
  `tracery` block for 0.4; `migrateCasementProfile` fills both from the default for stored copies.
- DXF layers `GLASS_CONTOUR · GLASS_EDGE · GLASS_BARS (bands, ±barWidth/2, bulge on arcs) · GLASS_BAR_AXES ·
  GLASS_TEXT`; the text block keeps the geometry line per bar and adds the bar-end rows (`BAR ENDS: ID  S FROM
  APEX / POSITION  L  ANGLE / R`, degree sign → `DEG`, R12 is ASCII).
- Dimensioning (0.3): vertical bar `x from the bottom-left · s from apex L/R · L`; spoke `s from apex · angle
  from the hub · L` (a ring→ring segment prints its radial extent `r 121.7-243.3` instead); ring `R · centre`;
  h / springing `y from the bottom corners`; tracery `R · s from apex`. More than 4 bars → ids beside the bars,
  the numbers in a table under the drawing (sheet: 4 columns, `MGN_TABLE` grows the viewBox; PDF: same table
  under the sketch in the cell, header line says `N bars — see table`; DXF: the rows in GLASS_TEXT). The
  x·y pairs of night 4 are gone (t19 asserts the regex `>x · y<` no longer matches).
- Sheet / PDF draw the edge line and the bands from the profile numbers (PDF: edge dashed, bands solid, axes
  dotted, ids at the arch ends).
- Rectangular branch of the sheet untouched (t19 §1 snapshot byte-identical).

**Verification:** esbuild OK on all five files · t16 504/504 · t18 178/178 (assertions updated: axes now on
`GLASS_BAR_AXES`, two TEXT lines per bar, PDF header "V1 x 270.3 … from apex … L 1297", hub row "7 bars — see
table") · t19 244/244 (assertions updated: the sheet prints exactly the module's labels / table cells; every
straight or tracery end on the arch carries an `s from apex`) · three sheets rendered through headless
Chromium and looked at (hub-spoke 7 bars, triple hub + 1H 34 bars with the table, gothic intersecting 9
bars): bands, dashed edge, ids beside the ends, table readable. Not verified: the PDF opened in a viewer
(built in node, text asserted by string search only); the triple `edgeCover` value is a placeholder.
**Verdict: ✅ 0.2 / 0.3** (t20 adds the SVG ↔ DXF band / edge arc comparison ±0.01).

### STAGE 2 — Block 1 A–E: arched SASH, engine side (`profile.js`, `arch.js`, `specification.js`, `calculations.js`, `lists.js`, `bom.js`, `projectStore.js`, `ConfiguratorPage.jsx`, `verify/arch/t21.mjs`, fixture `rect-sash-base.json`)

**Understanding:** PSW's flagship arched product is a double-hung sash whose box head and upper sash top rail are
curved; the lower sash is square and stops at the arch start. PC needs the same object as the casement
(`windowSpec.arch` + `lowerHBars`), the PSW import names, a configurator switch, an engine branch that keeps the
rectangular sash byte-identical, the two curved members in the cut list, and the true-outline weights that feed
the balance.

**Baseline first:** `verify/arch/fixtures/rect-sash-base.json` — six rectangular sash windows (standard 2×2,
slim + horns, triple 6×6, heritage single 4×4, triple-glazed 9×9 with a wider cill, glazing-arch head type)
derived from HEAD before any sash edit: derived / cut / glass / precut JSON. t21 §6 re-derives them.

**Two approaches, one rejected (vertical layout):** (a) re-derive PC's rectangular top / bottom gaps from the
135 deduction and place the arch on top of them — rejected: the split of 135 is not written anywhere and the
concentric ring must meet the stile line anyway; (b) PSW's explicit rule (price-calculator.js metricsFor: arch
starts at H − rise, meeting line at H/2, `MIN_UPPER_STILE` on H/2 − rise) + the concentric rings at the profile
offsets — chosen and logged as DEFAULT (open).

**Built:**
- Profile: `DEFAULT_SASH_PROFILE.sashArch { headFace 80, minHaunchRadius 150, limits { 400, 1500, 900,
  minUpperStile 100 } }` (`normalizeSashProfile` fills stored copies). Blank planner / pattern numbers are read
  from the casement `arch` block (one place for the CNC's numbers).
- `buildSashArchGeometry` (arch.js): head ring 0 → 80; top rail ring `sashWidth/2` (89) → 89 + topRail.face
  (57); glass line 89 + 57 − 12.5 = 133.5; rule C (all chains start vertical at the stile line); `upperStileClear
  = H/2 − rise ≥ 100`, `upperStraightStile = clear + MR/2` (the STILES TOP piece to the meeting rail bottom).
- Import (`specification.js`): `sashArchFromSpec` — `sashType 'arched-group'` or `frameShape 'arched'`; PSW ids
  and the radio names (`PSW_SASH_RADIO_SHAPE`: semicircular / gothic / elliptical / segmental → P10 shapes),
  `archRise`, `archProfile`, `archBarPattern`, `archHBars` / `archVBars`, `lowerHBars` (`lowerVBars` ignored:
  lower straight h only). Shared `archFieldsFromSpec` with the casement; the arch object is null on every
  rectangular sash; `arch.hinge` null.
- Engine (sash branch of `deriveWindowData`, conditional on `arch.shape`, never for a triple): `S-ARCH HEAD`
  (`80x164`, head ring centre-line length, planner notes) replaces HEAD; jambs = start − (jambHeight − 80);
  head liners dropped, jamb liners to the springing; `S-ARCH TOP RAIL` (57x57, ring centre) replaces TOP RAIL;
  STILES TOP = straight stile (+ horns); meeting rails, lower sash, cill untouched. Upper unit = arched outline
  in the glass frame (springing = stile clear − MR/2 + rebate), bars = upper straight + pattern
  (`buildArchBars`), lower h bars = equal divisions of the lower daylight; `customGlassUnits` = [upper arched,
  lower rectangular (sash − 89 × lower − 108)]. Weights from the true outline: `upperKg` / `lowerKg` / `total`
  (timber Σ length × kg/m of the finished section + glass area × kg/m²); paint from W × start + arch area; seal
  6070 with the upper sash's equivalent height. `derived.arch` carries geometry, plans, bars, lowerBars,
  upperSash, glassOutline (+ origin in frame coordinates).
- Cut list: `S-AH` after HEAD, `S-ATR` after TR; BOM slots head / top_rail. Store whitelist: `frameShape`,
  `archHBars`, `archVBars`, `lowerHBars`. Configurator: Sash Type → Frame shape Standard | Arched; the arch
  shape / start controls extracted into `archControls` shared with the casement; Glazing Bars section for the
  arched sash (upper h / v, pattern chips per shape, custom hub, lower h) replaces the Georgian grid chips; the
  3D stays the rectangular sash until Stage 3 (I).

**Verification (t21 120/120):** 9 vectors W 1000 / 1200 / 1500 × semi-circle / three-centre (start = H − 0.3 W)
/ gothic: rings 0 → 80 / 89 → 146 / 133.5 concentric, rule C, semi-circle closed forms (S-AH π(R − 40), S-ATR
π(R − 117.5)), stile rule; PSW parity: rise = ratio × W (±0.5, PSW rounds), `minHeightFor` = PC's own limits
(derives at the minimum, throws 10 below with the 900 / 100 message); import mapping incl. radio names; cut
list / BOM / grouped order; weights vs the closed-form area (π R²/2 + Wg × springing); rectangular fixture
6/6 identical + a triple with an arched flag identical to the plain triple. Rendered nothing (no 2D yet).
**Finding (sash F2):** PSW's segmental default (rise 0.20 W) cannot be built as a rule-C sash — the top rail
ring at 146 with the 150 haunch floor leaves an inner radius 4 → readable ArchError; at W 1000 a Round sash needs
rise > ~279 (BLOCKERS 12.4). Not verified: the configurator in a browser, the arched sash in any drawing / 3D /
export (Stage 3). **Verdict: ✅ Stage 2 (A–E)** with the DEFAULT (open) entries 12.1–12.6.

### STAGE 2 GATE — ✅ ALL PASS

t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30 · t21 120 · `npm run build` OK.

### 0.1 — FIT view in the arch CNC DXF (`arch.js`, `archDxf.js`)

**Understanding:** Piotr overlaid the frame ring and the leaf ring by hand and read the 17 mm rebate lap as an
error. A row that draws frame ring, rebate wall, leaf ring and glass outline concentric in their assembly
position makes the 4 mm running gap and the 17 mm lap readable without overlaying anything.

**Two approaches, one rejected:** (a) draw the FIT view in `cncExport.js` from `getCasementProfile()` — rejected:
a second place reading `geometry.land` / `gap`, and the harness could not reach it without the browser wrapper;
(b) `buildArchGeometry` gains `rebateWall` (= `offsetArcs(base, geometry.land)`) and `fit { gap, lap, land }`,
`archDxf.js` draws them — chosen (one contour source, rule 11 of CLAUDE.md: land / gap / faces from the profile).

**Built:** layer `FIT` (colour 4) first in `ARCH_LAYERS`; `fitRow()` = `ringPoly(frameHead)`, `ringPoly(leafTop)`,
closed glass chain, rebate wall as 20 / 10 mm dashes (`dashedChain`, 2-vertex bulge polylines — `dxfWriter` has
no linetypes and adding them is on the "not today" list); text block `FIT (ASSEMBLY, NOT A TOOLPATH)` · `GAP 4
LAP 17 (REBATE)` · frame / wall / leaf / glass radii. The row is the TOP row of the drawing (rows are stacked
bottom-up, FIT pushed last); CONTOUR / PIECES rows untouched. `buildArchEntities` refuses a plan without the v3
fields instead of drawing a partial FIT.

**Verification:** esbuild OK (`arch.js`, `archDxf.js`) · W 1200 semi-circle: frame 600 / 543, rebate wall 564,
leaf 560 / 493, glass 505.5, gap 4, lap 17 — the spec's verified numbers · `.audit/fit_1200.dxf` read back by
ezdxf: layer `FIT` present, 63 FIT entities (3 closed rings + 60 dashes) · t16 504/504 still ALL PASS.
Not verified: the DXF opened in VCarve / AutoCAD (no CAD in the container). **Verdict: ✅ 0.1** (t20 §1 asserts the
numbers again through the export path).

---

## 2026-09-06 — arched-casement-v2 night 4: D + E + F + t19 (branch `claude/arched-casement-v2-def-enkyue`)

Inputs read in full, in this order: `CLAUDE.md` → `ARCHED-CASEMENT-v2.md` §4 (+ §0–2 for the data model) →
`BUILD-LOG.md` (night 3) → `BLOCKERS.md` §9 → the four `Casement*2D.jsx`, `drawingUtils.jsx`, `drawingTheme.js`,
`casementDrawUtils.js`, `arch.js`, the arched branch of `calculations.js`, `ArchedCasementWindow.jsx`,
`FixFrameWindow.jsx` (PSW bar strips), `CasementFrame.jsx` / `CasementPanel.jsx` constants, `windowSpecToConfig.js`,
`src/3d/App.jsx` (`update3D`), `archDxf.js` / `glassDxfExport.js` entity builders, `t18.mjs`. Baseline on the branch
start (`5ba3661` = `origin/main`): t16 504/504, t17 72/72, t18 178/178 ALL PASS (re-run at the end of the night).

Decisions taken up front:
1. **One contour = one module.** The sheets never compute an arc: every `A` command is written by
   `src/components/drawings/archDrawUtils.js` (new, pure, no React) straight from an `arch.js` arc
   `{ cx, cy, r, a0, a1 }` — the same objects `derived.arch.geometry` / `glassOutline` / `bars` hand to the DXF
   builders. Sweep flag from the chain direction (counter-clockwise a0 → a1 in the y-up frame = sweep 0 on the
   y-down sheet, 1 when traversed backwards), large-arc flag from the span. Outside the spec's file list — added
   because the alternative was the same 60 lines copied into four sheets.
2. **Bars on the elevation / leaf sheet are the engine axes (glass frame, to the unit edge) clipped to the
   daylight with an SVG `clipPath`** built from the daylight chain — the bars keep the glazier's geometry
   exactly and the wood hides the 12.5 mm that sits in the rebate, as on the real window. No bar is re-cut to
   the daylight in code (circle–circle work for tracery arcs would have been a second geometry).
3. **Exterior land line** on the elevation / frame sheet = `offsetArcs(outer, geometry.land)` (36 in), the
   arched twin of the existing `landRect`; the DXF ring inner (57) is not what the eye sees from outside.
4. **Snapshot = fixture, not hashes.** `verify/arch/t19_baseline.mjs` rendered the four sheets (22 SVGs, all
   panes / glass groups of the four rectangular fixtures) from `HEAD` with react-dom/server BEFORE any sheet
   was touched → `verify/arch/fixtures/rect-casement-sheets.json` (full strings, so a failure shows a diff).

### D0 — baseline snapshot (`verify/arch/lib/sheets.mjs`, `verify/arch/t19_baseline.mjs`, fixture)

**Built:** `bundleTree(srcRoot, tag)` bundles the four sheets + engine of ANY source tree (`git archive` of a
commit or the live `src/`) with esbuild (react / react-dom external), `renderSheets` renders every sheet the
DrawingsPanel / WindowDetailPage show (elevation, frame, one leaf sheet per `groupCasementLeaves` group, one glass
sheet per `groupCasementGlass` group) with `renderToStaticMarkup`. Render proven deterministic (two runs
byte-identical). **Verdict: ✅ D0**

### D1 — `archDrawUtils.js` + `CasementElevation2D.jsx`

**Understanding:** the exterior view of an arched casement shows the frame band (outer contour → land line),
the leaf top rail outer edge, the daylight and the bars — all curved from the springing line up.

**Two approaches, one rejected:** (a) offset the ArcChain *in the sheet* (radius − 36 etc.) — rejected: a second
offset implementation next to `arch.js` `offsetArcs`; (b) build every contour with `offsetArcs` / the ring
chains the engine already exposes and only *serialise* them here — chosen.

**Built:** `archToSheet` / `glassToSheet` transforms, `svgArc`, `chainArcsD`, `archedOutlineD` (sides at the
chain's own end x — rule C — bottom at a given y), `ringBandD`, `barBandD` (22 mm band: rotated polygon for a
straight bar, r ± 11 arcs for a ring / tracery), `barAxisD`, `arcLabelPoint` (crown arc: mid angle; haunch arc:
¾ of the way from the springing end so the label clears the corner dims), `radiiText`, `onCurve`.
Elevation: when `derived.arch` exists — frame band (evenodd outer + land outlines), outer / land strokes,
leaf outline from `leafTop.outer`, daylight from `leafTop.inner` (glass fill), bars from `derived.arch.bars`
transformed through `glassOutline.origin`, clipped to the daylight; opening symbol starts on the springing line
(`lf.topY`); springing centre-line (dash pattern of the transom axes), `start` and `rise` DimV on the left, an
`R …` label per outer arc, third title line `Three-centre · start 1300 · rise 200 · R 150 / 1400 / 150`
(`TITLE_AREA` 75 instead of 50 only when arched), `data-arch-origin="ox,oy"` on the `<svg>` (only when arched)
so t19 can map sheet coordinates back to the frame. Rectangular branch: JSX untouched, output byte-identical
(fixture, 4 windows / 22 sheets). Rendered to PNG through headless Chromium and looked at: three-centre 1H 2V,
semi-circle hub-spoke, gothic intersecting, semi-circle triple hub — arcs, bands, clipped bars, dims in place;
the first pass had the haunch `R 150` label on top of the `rise` dim and centre crosses inside the glass —
label moved (`arcLabelPoint`), crosses dropped (the CNC sheet carries the centres).
**Verification:** esbuild OK (both files) · no Polish letters · snapshot IDENTICAL · `A` count per sheet =
7 × arcs + 2 × arc bars (checked by hand on four windows, asserted in t19). **Verdict: ✅ D1**

### D2 — `CasementFrameDetail2D.jsx`

**Built:** head band + strokes from the same outer / land chains; `C-AH <length>` label (length + notes read
from the cut-list record `C-ARCH HEAD` in `derived.components.box` — the sheet prints what the cut list prints),
`C-J/L` / `C-J/R <start>` centred on the straight jamb, right chain `rise · start−41 · 41` (no top chain on an
arched frame — the head is curved, dimensioned by the radii and the C-AH length), springing line, `start` /
`rise` dims, `R` labels, third title line with the planner notes (`R 150/1400/150 · 8 pieces · stock 95/95/95`);
click zones: head = the outer/land band path, jambs from the springing down. Rectangular output byte-identical.
Rendered and looked at (three-centre, gothic). **Verification:** esbuild OK · no Polish letters · snapshot
IDENTICAL. **Verdict: ✅ D2** (t19 assertions added at the end of the night, see T19).

### D3 — `CasementLeafDetail2D.jsx`

**Understanding:** the leaf sheet is what the bench sees: outer leaf (straight stiles + the C-ARCH TOP RAIL
outer chain), the 24 mm unit edge (= the glazier's outline), the daylight (top rail inner chain), bars with
the crossing / notch symbols, chains of stile · bars · stile.

**Built:** arched branch when `derived.arch` exists and the group is the (single) arched leaf: leaf outline /
daylight / unit edge from `leafTop.outer`, `leafTop.inner` and `glassOutline.arcs` (leaf coordinates via
`archToSheet(fw, rise, ox − rect.x, oy − rect.y)` and `glassToSheet` at the 54.5 unit inset); bars = 22 mm
bands on the engine axes clipped to the daylight; crosses at every straight v × h crossing and V-notches at
the straight-edge ends (v bottoms, h / springing ends) — the same symbols as the rectangular leaf, only where
a bar meets a straight edge; chains built from the engine's straight bars (`role v`, `h` / `springing`,
de-duplicated by position, so the two springing segments of a hub print as one 22 cut); springing line,
`stile <leafStraightStile>` + `rise` dims on the right, overall H moved out (80·ts) only when arched; `R`
labels — haunch / gothic arcs outside near the corner (`isHaunchArc`), crown / semi-circle inside the
daylight; third title line `Three-centre · stile 1253 · rise 160 · top rail R 110 / 1360 / 110 · C-ATR 949.8`
(length from the cut-list record). Opening symbol starts on the springing line. Click zones: top rail = the
ring band path, stiles from the springing down. The rectangular `computeBarPositions` lists are emptied on an
arched leaf so the old bar drawing renders nothing there (rectangular output byte-identical). Rendered and
looked at (three-centre 1H 2V, semi-circle hub-spoke, gothic intersecting).
**Verification:** esbuild OK · no Polish letters (codepoint check, not a byte grep) · snapshot IDENTICAL.
**Verdict: ✅ D3**

### D4 + E — `CasementGlassDrawing2D.jsx` (glazier sheet, bar end numbers)

**Understanding:** the glazier cuts the outline from the DXF; the sheet is the human copy — the same outline,
the seal, the spacer bars, and (E) a number at every bar end he cannot measure off a straight edge because it
lies on a curve.

**Two approaches for the seal, one rejected:** (a) inset the closed polygon (vertex normals, PSW centroid
trick) — rejected: not concentric, wrong at the tangent points; (b) `offsetArcs(geometry.glass.arcs, 11)`
in the arch frame, shifted into the glass frame — chosen (exact, rule C keeps the sides at ±(xg − 11)).

**Built:** unit outline = `glassOutline.arcs` (glass frame → sheet), seal = concentric 11 mm offset (frosted
hatch fills the seal path), spacers = 18 mm bands on the engine bar axes (straight bands, exact arcs for rings
/ tracery), top / left chains from the straight bars (v; h + springing de-duplicated), springing line,
`springing` + `rise` dims (right, 34·ts) with the overall H at 74·ts when arched, `R` labels for every glass
arc (haunch outside / crown inside), third title line `Three-centre · springing 1198.5 · rise 105.5 · R 55.5 /
1305.5 / 55.5 · 3 bars`, title `811 × 1304 mm · arched`. **E:** straight bar whose top end lies above the
springing (`onCurve`) → `V1 1297` beside the bar 56 mm below its end (x is on the chain); spoke → `K1 608.3 ·
1249.7` set back along the spoke; ring → `R1 R 121.7` inside the ring; tracery arc → `T1 R 364.8` at 30 % from
its springing end (`barArcLabelPoint`, two tracery arcs cross near the axis at their middles) + the end that
lies on the outline (`from` for right-centred arcs, `to` for left-centred — PSW's arc direction) printed
outside the outline `62.1 · 1162`. Rendered and looked at (three-centre, semi-circle hub-spoke, gothic
intersecting): first pass had `V1` on top of `R 1305.5` and `T2` / `T3` on top of each other, and the
right-hand tracery ends unlabelled (the `to` end sits on the springing there) — all three fixed.
**Verification:** esbuild OK · no Polish letters · snapshot IDENTICAL (4 windows / 22 sheets) · `A` count per
sheet = 2 × outline arcs (unit + seal) + 2 × arc bars (checked by hand: 6 / 4 / 12 / 2 / 8).
**Verdict: ✅ D4 + E** (2D part; E in 3D is part of F).

### F — 3D (`archedCasementGeometry.js` new, `ArchedCasementWindow.jsx` rewritten, `windowSpecToConfig.js`, `ConfiguratorPage.jsx` update3D, `src/3d/App.jsx`, `docs/handover/PSW-3D-ARCH-PORT.md`)

**Understanding:** the configurator's 3D must show the arch the joiner typed — rule C, concentric rings,
the rise — instead of the PSW fixed ratios; the component keeps the PSW prop names so it can go back to PSW.

**Two approaches, one rejected:** (a) keep delegating the leaf to `FixFrameWindow` and only fix the frame —
rejected: the leaf shapes in FixFrameWindow are the PSW ratios (ellipse, 0.4 W segment) and a `fixArchRise`
hack; the leaf top would never match the frame ring; (b) one pure helper that builds every contour from
`arch.js` and a component that only turns contours into THREE shapes — chosen, and the helper is what t19 tests.

**Built:**
- `archedCasementGeometry.js` (pure, no React / THREE, importable in node): `resolveArchProps` (PSW + PC shape
  names, `archRise` or the PSW ratio, gothic profile), `sampleArc` / `contourUnder` / `contourAt` (concentric
  offset of a contour: `offsetArcs` + sides and bottom moved in), `archedCasementGeometry` → outer, inner (57),
  rebated (36), gasket inner (36 + 19), leaf outer (40) / inner (104), glass outline + bars via `buildGlassOutline`
  / `buildArchBars` on the 3D daylight, in mm around the window centre; `safeArchedCasementGeometry` falls back to
  the ratio rise (reason kept) and never throws for a viewer. Dimensions come in as `dims` from the 3D constants
  (`CasementFrame` / `CasementPanel`), never literals; the two profile rules the 3D cannot know arrive as props
  (`archMinHaunchRadius`, `archPatterns`) with the PSW literals as the fallback (`PSW_BAR_PATTERN_SETTINGS`).
  Two drawing floors found by the harness: a haunch must be deeper than the deepest ring drawn (leaf inner 104
  + bead 10 → 114; production's 150 wins when passed) and the frame must leave the leaf's straight part below the
  springing (rise + 125, PSW had rise + 50) — both derived from `dims`, logged in BLOCKERS §10.
- `ArchedCasementWindow.jsx`: frame ext / int layers + gasket from the helper contours (the gasket inner edge is a
  true offset, no centroid inset), the leaf drawn here (ring split ext / int, chamfer + ovolo contour beads as 32
  concentric layered strips each, glass `ShapeGeometry` + 1 mm spacer ring, handle, pivot), bars: straight =
  profiled trapezoid / ovolo extrusions rotated along the segment (18 mm overshoot; spokes inset 0.6 / 0.4 bar
  widths as PSW), rings / tracery = 64 layered strips along the exact arc (PSW `intersectingData` /
  `buildRingLayers`, reused). Props: PSW names kept + `archRise`, `archProfile`, `barPattern` (falls back to
  `fixSemiBarPattern` / `fixGothicBars`; PSW `patternA` → none), `archMinHaunchRadius`, `archPatterns`. Guides
  print the real rise.
- Wiring: `windowSpecToConfig` emits `casArchShape` = PC name, `archRise`, `archProfile`, `barPattern`,
  `archMinHaunchRadius`, `archPatterns` (profile); `ConfiguratorPage` `update3D` the same (`PC_TO_3D_ARCH` removed —
  the component takes PC names now, justification: dead mapping); `src/3d/App.jsx` stores the five keys, hands them
  to the component and keeps them in the category bucket (outside the spec's file list — without it the props
  never reach the component; PSW's App needs the same five lines, see the port doc).
- `docs/handover/PSW-3D-ARCH-PORT.md`: files, props, what changes visually, checks after the copy.

**Verification:** esbuild OK on all six files · `npm run build` OK · helper in node: extents = W × H for
semi-circle / three-centre / gothic × 2 and the four PSW names, rings nest (57 / 36 / 40 / 104), rule C at the
springing, bar counts and roles = the engine list, tracery centred on the outer corners, fallback on an
impossible rise, floors (t19 §4, 40 checks) · t19 §5 structural evidence of the wiring.
NOT verified in a browser: the WebGL render itself and the configurator click-through. A headless Chromium
(SwiftShader) capture of a scratch page mounting `<Canvas><ArchedCasementWindow …/></Canvas>` was attempted five
ways (screenshot with / without virtual time, `toDataURL` through `--dump-dom`, `localhost` vs `127.0.0.1`): the
page mounts the canvas, but no rendered frame came back inside the time budget — so the 3D look (frame, gasket,
leaf, beads, bars, handle, opening pivot) has ONLY the node-side geometry evidence behind it (t19 §4).
**Verdict: ⚠️ F** (geometry proven in node; the rendered look needs Piotr's eye in the morning — Configurator →
casement → Arched → Round / Gothic with bars, open the leaf).

### T19 — `verify/arch/t19.mjs` + closing checks

**Built:** bundles the live `src/` (sheets + engine + archDxf + glassDxf + cncExport + the 3D helper +
windowSpecToConfig) and asserts: §1 the four rectangular fixtures → 22 sheets byte-identical to the pre-night
fixture (`rect-casement-sheets.json`, rendered from `5ba3661`); §2 six arched windows (semi-circle / three-centre
1300 / gothic × plain and 2v/1h + pattern): no NaN, `A` count per sheet = 7n / 4n / 4n / 2n (+ 2 per arc bar), no
Bezier command, head / leaf / glass radius labels, start / rise / stile / springing dims, C-AH / C-J cut-list
lengths, E bar-end numbers (`V1 1297`, `K1 608.3 · 1249.7`, `R1 R 121.7`, tracery ends), clipPath + one band per
bar, every `<text>` anchor inside the viewBox; §3 ONE CONTOUR — every SVG `A` converted to its circle with the
W3C endpoint → centre formula (independent of `archDrawUtils`) and mapped into the arch frame through
`data-arch-origin`; the arch CNC DXF rings (`cncExport.archParamsForWindow` → `buildArchEntities`, each row pinned
by its ring's outer start point) and the glazier DXF (`GLASS_CONTOUR`, `GLASS_BARS`) converted from bulges: same
centre set, every DXF ring / contour / bar arc has an SVG twin ±0.01 mm (bands r ± 11 / ± 9, seal r − 11, land
r − 36), every SVG arc sits on a DXF centre; §4 the 3D helper (above); §5 wiring.
**Result:** t19 **241 / 241 ALL PASS** · t16 504 / 504 · t17 72 / 72 · t18 178 / 178 (ezdxf installed in the
session first — the DXF probes need it) · `npm run build` OK · esbuild on every touched file · no Polish
letters (codepoint check) · `git diff origin/main --stat` = spec §5 night-4 files + `archDrawUtils.js`,
`archedCasementGeometry.js`, `src/3d/App.jsx`, `ConfiguratorPage.jsx` (update3D block), verify / fixtures / docs /
logs — `casementLayouts.js`, beading, `jambDxf.js`, `arch.js`, `calculations.js` untouched.
**Verdict: ✅ T19**

### Rano dla Piotra — what to look at (5 minutes)
1. Window (arched casement) → Drawings: Elevation, Frame, Leaf sheets; Glass tab → glass drawing. Every arc is an
   SVG arc from `derived.arch`; look at the label placement (BLOCKERS 10.10) and press Elements PDF / Glass Drawings
   PDF once (clipPath through the rasteriser, BLOCKERS 10.9).
2. Configurator → casement → Arched: Round with a typed start (e.g. 1300 on 1000 × 1500), Half, Gothic; add 1H 2V
   and a pattern; drag the opening — the 3D now follows the rise (F). This is the part no harness could see.
3. `node verify/arch/t19.mjs` → 241 / 241; the rectangular sheets are byte-identical to `5ba3661`.
4. Decide BLOCKERS 10.1 (arched 3D in the window detail preview — six lines) and 10.3 (3D faces from the profile).

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

### C — glazier exports (`glassDxfExport.js` new, `glassPdfExport.js`, `cncExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`)

**Understanding:** the glazier gets the exact contour + bar axes as a DXF (cutting reference) and the
schedule PDF gains a Shape column, an outline drawing and the bar positions in mm and % (P6).

**Two approaches, one rejected:** (a) thumbnails via SVG → canvas captured from the DOM (the "other
thumbnails" of the glass-drawings PDF) — rejected: needs a browser, cannot run in the harness and the
schedule PDF already draws its rectangles with jsPDF primitives; (b) draw the outline with jsPDF paths —
exact arcs as cubic Béziers (≤ 90° per segment, the standard 4/3·tan(Δ/4) construction) — chosen; the
DXF stays the exact reference.

**Built:**
- `glassDxfExport.js` (new, R12 via `dxfWriter.js`): layers `GLASS_CONTOUR` (7, closed bulge polyline,
  one vertex per arc end), `GLASS_BARS` (3, straight bars as 2-vertex polylines, rings / tracery as
  2-vertex bulge polylines), `GLASS_TEXT` (2: window – unit id – shape, `W × H RISE SPRINGING R …`,
  the glass spec line, `BARS n [PATTERN …] TOTAL L=…`, one line per bar `V1 V X=… Y=…-… L=…`). Units are
  the SAME rows the Glass tab shows (`buildGlassListForWindow`), qty repeated, stacked top-down
  `MERGE_GAP` (300) apart; merged files stack windows the same way. `glassDxfParamsForWindow` skips with a
  reason (not a casement / not arched / no shaped unit), `canExportGlassDxf`, `exportGlassDxfForWindow`
  (`{name}_glass.dxf`), `exportGlassDxfMerged` (`{label}_glass.dxf`, rectangular-only windows listed as
  skipped). `downloadDxf` + `safeName` are now exported from `cncExport.js` (one download path, one
  file-name rule) — the only change there.
- Buttons: Window → Glass tab, "📐 Glass DXF" next to "📄 Export PDF" (casement windows; disabled with the
  reason on rectangular ones); Production Pack header, "📐 Glass DXF (all)" next to "📄 Export PDF" while
  the Glass tab is active (the pack's PDF export lives in that header).
- `glassPdfExport.js`: column layout re-spaced for a `Shape` column (`rect` / `arched · R 55.5/1305.5`
  with a 6 × 4.5 mm outline glyph — the GLASS radii, what the glazier cuts, not the frame's); shaped rows
  take extra 3.2 mm lines: `springing 1198.5 (92%) · H1 y 599.3 (46%) x 0-811 · V1 x 270.3 (33%) to y 1297
  …` (x as % of the clear width, y as % of the unit height); the bars cell shortens pattern names
  (`hub`, `dbl hub`, `intersect`); drawing cells for shaped units (`drawShapedGlass`): exact outline
  (fill + stroke), bar axes, chain H on top from the vertical bars, chain V on the left from the h bars +
  springing + apex, overall W / H, a `rise` tick on the right, and a second header line `R … · rise … ·
  springing … · bars mm + %`. No edge-seal offset on shaped units (documented in the code). Rectangular
  cells and rows untouched.

**Verification:** DXF round-trip through ezdxf on three windows (three-centre 1000×1500 start 1300 with
1H 2V, semi-circle hub-spoke, gothic intersecting): contour closed, vertex count 6 / 4 / 5, bulge count =
arcs (3 / 1 / 2), arc length = outline arch length to 0.01, straight length = Wg + 2·springing, bar
polylines = bars.length (3 / 7 / 7), bar length sum = Σ bar lengths (±0.5 rounding); merged file 3 contours
+ 1 skipped rectangular window with its reason; layers present. PDF built in node (jsPDF) for the same
three + one rectangular window: 2 pages, 47 KB, strings `arched · R 55.5/1305.5`, `rect`, `springing
1198.5 (92%)`, `V1 x 270.3 (33%)`, `R1 ring R 121.7`, `rise 105.5`, `1304 mm` present, 20 Bézier ops.
Sample `docs/handover/samples/sample_glass_order_arched.pdf` saved for the morning look. esbuild +
eslint clean · no Polish letters · t16 504/504 after the `cncExport.js` change · `npm run build` OK.
NOT verified: the PDF was not opened in a viewer (node only) — the layout of the shaped drawing cell
and the re-spaced table columns need Piotr's eye; buttons not clicked in a browser.

**Verdict: ⚠️ C** (data path proven; visual layout unseen).

### H — harness `verify/arch/t18.mjs` (spec v2 §3 vectors), samples, closing checks

**Built:** `t18` bundles arch / profile / specification / calculations / lists / bom / dxfWriter /
glassDxfExport / glassPdfExport (jsx loader, react + jspdf external) and asserts on the real path
(PC item with `archStart` → `normaliseToWindowSpec` → `deriveWindowData` → lists → DXF → ezdxf → PDF):
1. geometry vectors verbatim from spec §3 — 1000/1500 start 1300 (r 150, R 1400, Cs ±350, CL −1200,
   T (392, 144), 73.74° / 32.52°, 193.05 + 794.62 + 193.05 = 1180.72, rings 93/1343 · 110/1360 · 43/1293 ·
   55.5/1305.5), start 1175 (r 211.25, R 634.62, T (432.83, 154.49), 47.00° / 86.01°, 1299.17), 1500/2000
   start 1700 (r 150, R 1425, 61.93° / 56.14°, 1720.63), start 1100 (r 320, R 562.5, 42.08° / 95.85°,
   1410.99), Half → semi-circle R 500 length 1570.80, start = H − 520 → "use Gothic" (from
   `normaliseToWindowSpec` and `resolveRoundShape`), rise 140 → F2 message, gothic start / radii;
2. bars — 2 verticals at ±135.17, tops 382.31 above the springing (L 1281), 1 h bar at 449.25, hub ring
   121.65, spokes 0/60/120/180° ring → outline (L 284), ring-end verticals, half / double / triple role
   counts (2 / 18 / 34 bars, rings 121.65 / 243.3 / 324.4), intersecting on gothic + semi-circle
   (2 mullions, 4 tracery arcs centred on the outer corners ±94.5 outside the glass, ends ON the outline),
   pattern availability errors, v-bar tops on the three-centre chain, Green area = numeric integral;
3. cut list — C-AH 1091.19 = ring centre line (= mean of outer 1180.72 / inner 1001.65), notes
   `R 150/1400/150 · 8 pieces · stock 95/95/95`, jambs 1300, C-ATR 949.82, stiles 1253, bottom rail 920,
   040L / 040R by hinge, grouped symbols `C-AH C-J-L/R C-CILL C-ST-L/R C-ATR C-BR` (no `?`), glass unit
   811 × 1304 with shape, rows + labels, paint / seals / glass m² from the true outline, timber weight =
   Σ section × density × length, BOM slots for both curved members, and the 4 rectangular fixtures
   JSON-identical to `origin/main`;
4. glazier DXF — three samples written to `docs/handover/samples/` (`sample_glass_1000x1500_three-centre_
   start1300.dxf`, `…_semi-circle_hub-spoke.dxf`, `sample_glass_1000x1800_gothic_intersecting.dxf`) +
   `sample_glass_pack_merged.dxf`: R12, layers, contour closed with `arcs + 3` vertices and bulge count =
   arcs, arc length = glass arch length, straight = Wg + 2·springing, bar axes = bars.length, Σ lengths,
   text block = `unitTextLines`, skips (rectangular / sash / null derived), merged stacked exactly 300
   apart on TRUE extents (a `polyBBox` with arc extents was added after the first run showed the
   vertex-only bbox would let a semi-circle apex overlap the unit above — fixed in `glassDxfExport.js`);
5. PSW import — `segmental-arch` W1200 → three-centre rise 240 start 1760 riseSource ratio (derives with
   r 150 / R 1320), elliptical 390, semi-circle 600, gothic drop 840, v1 'segmental' migration, v1
   `archRise`-only item, Auto item, hinge inversion;
6. glass PDF in node — 2 pages, Shape header, `rect`, `arched · R 55.5/1305.5`, the mm + % line, hub row,
   shaped drawing strings and Bézier operators;
7. profile v3 block / vocabulary / cut-list order / BOM map; 8. structural evidence (labelled as such):
   store whitelist text, configurator chips + save fields, all samples present.

**Result:** t18 **178 / 178 ALL PASS** · t16 504 / 504 · t17 72 / 72 · `npm run build` OK · esbuild on
every touched file · no Polish letters in src / verify · `git diff origin/main --stat`: spec §5 files +
`bom.js` (2 rows), `cncExport.js` (2 exports), `WindowDetailPage.jsx` / `ProductionPackPage.jsx`
(buttons), verify, samples, docs, logs — `casementLayouts.js`, beading, `jambDxf.js`, `src/3d` untouched.

**Verdict: ✅ H**

### Rano dla Piotra — what to look at (5 minutes)
1. Configurator → casement batch → Arched: chips **Round | Gothic**, type "Arch starts at" (e.g. 1300 on
   1000 × 1500 → `Rise 200 · R 150 / 1400 / 150`), **Half** → `R 500`, patterns appear only on Half;
   type 850 → the CNC row shows "use Gothic" and Save is greyed. Then Save → Cut list shows
   `C-AH 1091` and `C-ATR 950`, Glass tab shows 811 × 1304 with `Shape` and the **📐 Glass DXF** button.
2. Open `docs/handover/samples/sample_glass_1000x1500_semi-circle_hub-spoke.dxf` in VCarve: closed
   contour, ring + spokes + ring-end verticals on GLASS_BARS, text on GLASS_TEXT.
3. Open `docs/handover/samples/sample_glass_order_arched.pdf`: page 1 Shape column + the mm/% lines,
   page 2 the three shaped drawings — the layout is the thing this session could not see.
4. Answer BLOCKERS §9.1 (900), 9.3 (short haunch pieces), 9.4 (rise > 150 at W < 462) when you can.

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
