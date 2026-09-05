# ARCHED WINDOWS v3 — phase 3 handover (nights 5, 6, 7) + PSW↔PC gap list

Follows v1 (geometry, blank planner, CNC DXF), v1-AUDIT, v2 (rule C, configurator, engine
records, glazier exports, 2D, bars, 3D). All of that is on `main` (PR #3, #4, #5). Decisions
below were taken with Piotr on 06–07.09.2026. Where Piotr did NOT answer, the item says
**DEFAULT (open)** — implement the default, log it in `BLOCKERS.md`, never silently guess.

Nights (Piotr 07.09: windows only — doors, sliding, bifold, front door are NOT in scope now):
- **Night 5 = Block 0 + Block 1 (A–E)** — casement polish (incl. hinge 1:1 with PSW and the
  per-shape bar audit) and the arched SASH engine side.
- **Night 6 = Block 1 (F–J) + Block 3** — sash 2D/3D/exports, FIXED windows inside the casement batch.
- **Night 7 = Block 4 + Block 6** — cross-cutting, project Archive.
Block 2 (fix frame as a separate product) is REPLACED by Block 3. Block 5 items 1–3 and 7
are dropped by Piotr (too early / not a measurement tool). Do not start a later block early.
Each block ends with its harness ALL PASS and `npm run build`.

---

## 0. Rules — unchanged (v1 §0, v2 §0) plus

- One contour everywhere: screen (2D/3D) = glazier DXF = glazier PDF = CNC DXF = tracery LSP.
  Every export reads `derived.arch` / `derived.*.glassOutline`; nothing recomputes geometry.
- Every number that could differ per workshop is in the profile (`DEFAULT_*_PROFILE`).
- Bead profile section (Block 0.5) is copied **verbatim** from the workshop DWG — never
  parametrised, never "improved".
- `src/3d` stays PSW-compatible (prop names); every 3D change gets a line in
  `docs/handover/PSW-3D-ARCH-PORT.md`.

---

## BLOCK 0 — arched casement: polish and the workshop exports (night 5)

### 0.1 FIT view in the arch CNC DXF (`archDxf.js`)
Piotr overlaid the frame ring and the leaf ring from our sheet by hand and read a 17 mm
"overlap" as an error. It is the rebate lap (leaf edge = land 36 + gap 4 = 40 from the frame
edge; frame inner timber edge at R − 57 sits UNDER the leaf). Add a layer/row **`FIT`**: frame
ring, leaf ring, glass outline drawn **concentric, in assembly position**, plus the rebate wall
line at `R − geometry.land` **dashed**, so the 4 mm gap between rebate wall and leaf is visible
directly. Text: `gap 4 · lap 17 (rebate)`. The CONTOUR/PIECES rows stay as they are (per-piece
for CNC). Verified numbers, W 1200 semi-circle: frame 600 / 543, rebate wall 564, leaf 560 / 493,
glass 505.5.

### 0.2 Glazier DXF — bands, edge, axes (`glassDxfExport.js`, `CasementGlassDrawing2D`, `glassPdfExport.js`)
- Bars are **bands `profile.glass.barWidth` (18) wide**, two offset polylines (bulge on arcs,
  ±9 from the axis), layer `GLASS_BARS`; the axis moves to `GLASS_BAR_AXES`.
- **Edge line** `profile.glass.edgeCover` (11) inside the contour all round (bulge on arcs),
  layer `GLASS_EDGE`. **DEFAULT (open):** 11 = the sealed-unit perimeter spacer; a triple unit
  may differ → the value is per glass type in the profile (`glass.edgeCover[type]`, default 11).
- Layers: `GLASS_CONTOUR · GLASS_EDGE · GLASS_BARS · GLASS_BAR_AXES · GLASS_TEXT`.
- The 2D glass sheet already draws the ±9 band and the −11 line — the DXF must be the same
  geometry (t20 compares band/edge arcs SVG ↔ DXF ±0.01 as t19 §3 does for contours).

### 0.3 Bar-end dimensioning (drawing, PDF, DXF text — same numbers)
- Straight edges (bottom, sides): positions **from the bottom corners** along the edge.
- Arc: bar ends as **arc length from the apex**, left / right, so symmetric bars carry the same
  number. Vertical bar: `x from bottom-left · end on arc: s from apex · L`. Spoke: `s from apex ·
  angle from the hub · L`. Ring: `R · centre` (unchanged).
- More than 4 bars → numbers only on the drawing, the values in a **table under the drawing**
  (`K1 … K18`: s, L, angle). The PDF prints the same table; the DXF `GLASS_TEXT` too.
- Replaces the x·y pairs shown today (`K1 608.3 · 1249.7`) — those go away.

### 0.4 Tracery export — `src/engine/cnc/traceryExport.js` (new): DXF + LSP, the `arka` convention

**What the tracery physically is (Piotr 07.09):** the window has ONE arched sealed unit with an
**18 mm spacer bar** laid out in the pattern (already in the glazier exports — unchanged). Over
the glass sits a **timber tracery cut from ONE board on the CNC, applied on ONE side** (Piotr:
"z jednej"); its openings are the pane daylights, the bead profile R8 runs along every opening
edge. It looks divided, it is not. So: the glass schedule keeps one shaped unit; the tracery is a
new timber part.

**Precedence (Piotr 07.09): the DWG is the reference to reproduce; the package only explains it.
Wherever the two differ (mitre orientation is the known case), the DWG wins.**

**Sources (commit both, read them with `ezdxf`, do not transcribe from memory):**
- `docs/handover/workshop/arka_CNC-piotr.dxf` — the workshop drawing (one quadrant, R 600
  example, layers OUTLINE / PANE / FRONT_HINGES_3MM / MITRE / CENTRE / 0).
- `docs/handover/workshop/arka-lsp-package/` — `Arka_Bary_R8_V1.lsp` + README + demo DXF +
  section DXF + geometry-check JSON: an independent analysis of the same DWG. **Use it to
  understand the offsets (+2 / +10), the section polyline and the layer roles — not as code and
  not for the mitre placement** — its README states it was never run in AutoCAD, and its mitres are
  placed the wrong way. Offsets and section are re-implemented in JS on ArcChains; mitres follow
  the DWG.

**Layer semantics (from the package, confirmed by Piotr):**
| output layer (Piotr 07.09: "jak arka w pakiecie") | geometry | meaning |
|---|---|---|
| `ARKA_OUTLINE` | pane daylight outlines (closed, bulge) + the board outline | what touches timber after cutting |
| `ARKA_PANE` | pane outline **+2 mm** outward | the **rail** for VCarve Moulding Toolpath (inner edge of the bead) |
| `ARKA_FRONT_HINGES_3MM` | pane outline **+10 mm** | outer limit of the bead: 2 + profile width 8 |
| `ARKA_MITRE` | two-leg open polylines at every real corner of a pane's +10 limit contour: the apex IS the corner, each leg runs **15 mm along that pane's own limit edge, into the pane** (on an arc: along the arc, bulge kept) — exactly as in `arka_CNC-piotr.dxf` (e.g. corner (−3510.46, 1888.02) → legs to (−3499.85, 1877.41) and (−3520.84, 1877.19)). **The package puts the legs the other way round (into the bar, an X at crossings) — Piotr 07.09: that is wrong; the DWG wins.** Skip joints with tangent difference ≤ 0.5° (tangent-continuous three-centre transitions are not corners). | corner guides for the moulding toolpath |
| `ARKA_SECTION` | ONE open LWPOLYLINE `(0,0) → arc R8 (bulge −0.414213562373095) → (8,8) → (8,14)`, drawn outside the board, START marked | the bead cross-section — **verbatim, never parametrised** |
| `ARKA_PANE_ZEWN_REF` | board outline **−2 mm** | reference for the outer rail, kept separate so it is never picked as an inner rail |
| `ARKA_CENTRE` | POINT | arc centre |
| `ARKA_INFO_NO_CUT` | texts: window, pattern, bar width, spokes, rings, `NOT A TOOLPATH` | never machined |

**Derived numbers (profile `profile.tracery`, defaults from the DWG):** `paneOffset 2 ·
profileWidth 8 · ridgeLand 2 · edgeLand 8 · mitreLeg 15 · sides 1`. Timber bar width =
`2·(paneOffset + profileWidth) + ridgeLand` = **22**; board edge margin = `paneOffset +
profileWidth + edgeLand` = **18** (the DWG's 18 above the centre line and 582 → 600).

**Geometry rules:**
- Board outline = the leaf's glass **daylight** (leaf-top ring inner edge, stiles' inner edges,
  bottom rail inner edge) — in the casement `R_leaf − leafTop.face` on the arc.
- Pane daylights = the daylight outline cut by the bar axes (`derived.arch.bars`) with the
  timber bar width 22 (not the 18 spacer): each pane = outline offset inward by 11 from every
  bar axis and by `edgeMargin` 18 from the board edge; corners are where two offsets meet.
  ArcChain offsets keep the centres (r ± d); straight edges shift by d.
- +2 / +10 layers = further outward offsets of each pane (never of the board outline).
- One QUADRANT for symmetric windows (the operator mirrors; as the DWG), `full` for asymmetric
  ones; insertion point prompt in the LSP (`Enter` = 0,0), DXF at 0,0.
- Two outputs from the same entity list: `{name}_tracery.dxf` (R12, `dxfWriter.js`, VCarve
  imports it directly) and `{name}_tracery.lsp` (`(defun c:ARKA ...)`, `entmake` LWPOLYLINE with
  groups 90/70/10/42, layers made with `-LAYER`). Buttons `Tracery DXF` / `Tracery LSP` next to
  `Arch DXF`, enabled only when the window has a pattern.
- Cut list: new part **`C-TRACERY`** (`C-TRY`), qty = `sides` (1), section = board thickness ×
  blank W × H (bounding box of the board outline + `contourAllowance`), material line in BOM;
  paint area adds the tracery face; the 2D elevation draws the timber bar (22) while the glass
  sheet keeps the spacer (18).

**Patterns — generic engine (Piotr 07.09: "kąty się różnią", no single rule):**
`hubSpoke({ spokes, rings })` on the pane reference: spokes evenly from 0 to π (endpoints on
the springing line = the springing bar), rings at the given fractions of the glass half-width.
Presets: PSW `hub-spoke` (4 / [0.3]), `double-hub-spoke` (6 / [0.3, 0.6]), `triple-hub-spoke`
(8 / [0.3, 0.6, 0.8]), `half-hub` (springing bar + ring 0.3, no spokes above), and the workshop
preset **`quad-hub-spoke`** from the DWG (5 spokes = 45°, rings [1/3, 2/3]). The configurator
offers the presets plus "custom" (spoke count 3–9, ring list). `intersecting` stays a port of
PSW's `intersectingData`. All of this feeds 2D, 3D, glazier exports and the tracery export from
one bar list.

**Harness (t20):** generate the quadrant for the DWG's own size (R 600 outline, quad-hub-spoke,
bar 22) and compare with `arka_CNC-piotr.dxf`: 5 panes, pane radii 189 / 211–389 / 411–582
(±0.5), 22 mm between panes, +2 / +10 offsets, corner guides: for every DWG `MITRE` polyline a
generated one with the same apex (±0.5) and legs along the same two edges (the DWG has 20
because one corner is drawn as two pieces), section polyline identical; then round-trip the DXF through `ezdxf`
and parse the LSP back with a tokenizer, asserting the same entity list in both files.

### 0.4b Hinge value 1:1 with PSW (Piotr 07.09 — "PSW–PC musi się zgadzać 1 do 1")
The night-3 importer INVERTS `casArchHinge` (PSW value `right` → PC hinge `left`) because the
PSW radio labelled "Left Hinge" carries `value="right"`. Piotr overruled that: the **value** is the
contract, both apps look at the window from outside, PSW's 3D passes the value straight to
`hingeDirection` and PC's 3D is the same component. Therefore: **identity mapping** — PC
`arch.hinge = casArchHinge` unchanged, PC's own chips store `'left' | 'right'` with the same meaning
as PSW's values, and the same estimate renders identically in both 3Ds. Log the PSW label wording
(`Left Hinge` ↔ `value="right"`, group titled "Opening Direction") in BLOCKERS as a PSW-side
question for Piotr — do not "fix" it in PC.

### 0.4c Bar logic audit per shape (Piotr 07.09 — "czy aby na pewno logika barów na archach jest
taka sama, patrz gothic")
Write `verify/arch/t20_bars.mjs` that, for every shape × pattern × 0–3 straight bars, asserts:
- every straight vertical bar ends ON the glass outline (distance to the ArcChain < 0.01) — on a
  gothic the centre bar ends at the apex point, the others on the correct half-arc;
- horizontal bars never cross the springing line; on a gothic with a short straight stile they
  are clamped, never dropped silently (count = requested or an explicit warning);
- pattern availability per shape is **1:1 with PSW**: casement/sash `PATTERNS_FOR_SHAPE`
  (`price-calculator.js` 990–995: semi-circle → half-hub, hub-spoke, double-hub-spoke,
  triple-hub-spoke, intersecting; gothic → intersecting; three-centre → none), fix
  `fix-circle-bars` (none, sunburst) and `fix-gothic-bars` (none) from `online-estimate.html`;
- `intersecting` on a gothic = PSW `intersectingData` port, vertex for vertex (compare with a
  point set generated by the PSW function copied into the harness);
- bar lengths in the cut list = Σ of the drawn segments/arcs (±0.5);
- the two 2D sheets and the glazier DXF draw the same bar set (count and end points).
Any mismatch is a BLOCKERS entry with the PSW line reference — fix only what is clearly a PC bug.

### 0.5 Small fixes carried from BLOCKERS §10
Label placement of `R` on the three-centre sheets; Elements PDF / Glass PDF through the
rasteriser (clipPath); sheet subtitle without the layout code (`040L`) on arched windows; 3D
guides text.

### 0.6 Profile decisions (write them, log in BLOCKERS as DEFAULT (open))
`arch.limits.minStraightBelowRise` stays **900**; `arch.pieceRule` stays `'narrowest'`;
new `arch.minPieceLength` **150** (warn, never block); `arch.minHaunchRadius` **150**;
`deductions.leafAtJamb` **40** confirmed as the rebate rule (Piotr asked; not contradicted).

---

## BLOCK 1 — arched SASH (PSW's flagship arched product) — nights 5–6

PSW reference: `3d-src/src/components/ArchedSashWindow.jsx` (metrics, `HEAD_FACE 80`,
`SASH_ARCH_FACE 64`), `js/price-calculator.js` 985–1012 (patterns, limits), form fields
`arch-style / arch-profile / arch-h-bars / arch-v-bars / arch-lower-h-bars / arch-bar-pattern`,
persisted `archShape, archRise, archBarPattern, archHBars, archVBars, archProfile`
(`estimate-manager.js` 682–692).

- **A** Data: `windowSpec.arch` for `category 'sash'` (same object as casement + `lowerHBars`);
  import mapping of the PSW sash names (`semicircular/gothic/elliptical/segmental` → PC per v2
  P10). Store whitelist.
- **B** Configurator (sash): Frame shape Standard | Arched → Round | Gothic, "Arch starts at",
  Auto / Half, upper bars (h/v), lower bars (h), pattern chips per shape. Limits from PSW
  (§3.3 v1) in `profile.sashArch.limits`.
- **C** Engine `deriveSashWindow` arch branch: **rule C** (DEFAULT (open) — Piotr did not
  answer; vertical start on the pulley stiles, three-centre below half, semi-circle at half).
  Box: arched head **section `sashArch.headFace` = 80** (PSW `HEAD_FACE`, DEFAULT (open)) ×
  box depth; pulley stiles to the start line; parting/staff beads **NOT** generated for the
  arch (beading frozen — record the gap in BLOCKERS, do not invent). Upper sash: arched top
  rail (`S-ARCH TOP RAIL`, face from profile — PSW's 64 is a mesh artefact, use `sash.topRail`),
  stiles to the start line, meeting rail unchanged. Glass: upper unit as `shape: arched`.
  Bars: upper straight + pattern, lower straight (h only). **Weights**: upper sash weight from
  the true outline (area × density) — this feeds the balance/cord calculation, must not use the
  bounding box. Paint/seal from the true perimeter.
- **D** Cut list: `S-ARCH HEAD` (`S-AH`), `S-ARCH TOP RAIL` (`S-ATR`) in `CUT_LIST_ORDER`;
  `planArchSegments` reused for both (blank plan, D13, finger).
- **E** Harness `t21`: vectors for W 1000 / 1200 / 1500 × (semi-circle, three-centre start,
  gothic), PSW ratio parity, weights vs area formula, rectangular sash derived JSON-identical.
- **F** CNC DXF for sash members (`archDxf` gains a sash variant: box head 80 face, top rail),
  FIT view.
- **G** Glazier DXF/PDF for the upper unit (Block 0 rules), tracery LSP when a pattern is set.
- **H** 2D: `FrontElevation2D`, `BoxDetail2D`, `SashDetail2D`, `GlassDrawing2D`,
  `VerticalSection2D` — arcs from ArcChains, dims W, H, start, rise, radii; rectangular sheets
  snapshot-identical.
- **I** 3D: port `ArchedSashWindow.jsx` from PSW into `src/3d/components/`, then rewrite the
  outline on `arch.js` (real rise, rule C, constant band), props PSW-compatible + `archRise`;
  `windowSpecToConfig` + `update3D` wiring; port notes.
- **J** Harness `t22` (sheets + 3D helper, like t19).

---

## BLOCK 2 — (replaced by Block 3, see Nights)

## BLOCK 3 — FIXED windows inside the casement batch — night 6

Piotr 07.09: a fixed window "podchodzi pod casement batch, ale jednak nie casement" — it lives in
the casement batch with its own kind, built as a **fixed leaf** ("czyli leaf tylko"): the casement
frame + a non-opening leaf, no hinges, no handle, no opening symbol — the same construction as the
door side panels (`D-SIDE *`, 57 members) but with casement sections. Shapes: **rectangle, arched
(Round | Gothic), circle** ("patrz koło"). PSW reference: `fix-shape` (rectangle, segmental-arch,
semi-circle, gothic-arch, elliptical-arch, circle), `fix-type`, `fix-circle-bars` (none,
sunburst), `fix-gothic-bars` (none), `fix-arch-rise`; 3D `FixFrameWindow.jsx` (PSW 1839 lines,
PC copy 1282 — raise it).
- **DEFAULT (open):** construction = fixed leaf; profile switch `fix.construction:
  'fixedLeaf' | 'directGlazed'` so the workshop can flip it without code.
- Data: `windowSpec.casement.kind = 'opening' | 'fixed'` (default opening), `fixShape` = the same
  `arch` object plus `'circle'`; import from PSW `fixShape/fixType/fixArchRise/fixCircleBarPattern`.
- Configurator (casement batch): Kind chips **Opening | Fixed**; Fixed hides layouts/hinges,
  shows Shape (Rectangle | Round | Gothic | Circle), "Arch starts at" for Round/Gothic, diameter
  = width for Circle (height locked = width), bars + patterns (circle: sunburst).
- Engine: reuse `deriveCasementWindow` with a fixed leaf (no hardware, no opening symbol, glass
  as today); circle = new geometry in `arch.js` (`circleChain`: two half-arcs, no springing);
  cut list `C-FIX *` names or the existing `C-*` with `fixed` notes (DEFAULT (open): existing names
  + note, so grouping stays); PP/pre-cut untouched.
- 2D: elevation/frame/leaf/glass sheets already handle arcs — add the circle case (four arcs,
  no straight members: the whole frame and leaf are rings → segment planner on full circles,
  finger joints, FIT view).
- 3D: fixed leaf = `ArchedCasementWindow`/`CasementWindow` with `opening` locked at 0 and no
  handle; circle = `FixFrameWindow` circle branch raised to PSW's version.
- Glazier DXF/PDF, CNC DXF (rings), tracery LSP (sunburst) — same pipeline.
- Harness `t23`: circle 800 (R 400 outer, rings 343 / 360 / 293 / 305.5 for face 57 / 40 / 67 /
  94.5 offsets), rectangle fixed = casement 040L minus hardware, arched fixed = arched casement
  minus hardware (derived JSON identical apart from hardware/opening fields).

## BLOCK 4 — cross-cutting — night 7

- Production Pack: section **Curved members** (per pack, per type) + Pre-Cut with blank sizes
  (stock × rough length × pieces) + BOM: laminated blank as a raw-stock line (`makeRawResolver`
  gains a `blank` kind) — JC import keeps `jc_uuid` matching.
- Pricing: per-curved-member surcharge in `pricing.js` (profile value, default 0 → visible but
  neutral until Piotr sets it).
- PDFs: Elements / Elevation / Glass with arcs through the rasteriser; merged DXF/LSP for a
  batch and a pack.
- `docs/handover/PSW-PARITY-REPORT.md` regenerated; `PSW-3D-ARCH-PORT.md` extended to sash /
  fix / door.
- Sash **glazing arch** (`head-type 'arch'`, rectangular frame, arched glass line): PSW is
  inconsistent with itself (2D `min(0.14·W, 150)`, 3D `7 %, 50–80`). **DEFAULT (open):** keep it
  out of the engine; leave the 3D as is; BLOCKERS entry asking Piotr to keep or drop it.

---

## BLOCK 6 — project ARCHIVE — night 7 (Piotr 07.09: "wszystko mam na dashboardzie i to mi się miesza")
`ArchivePage.jsx` is a placeholder. Deliver:
- Data: `projects.status` gains `'archived'` (or `archived_at timestamptz null`) — **SQL as a
  separate migration file** in `docs/handover/sql/`, never inside app code; RLS unchanged
  (tenant scoped).
- Store: `archiveProject(id)` / `restoreProject(id)`; dashboard queries exclude archived; PP,
  cut lists, exports keep working on an archived project (read-only banner, no edits).
- UI (layout approved by Piotr's request, keep it plain): Archive page = table `Project · Client ·
  Batches · Windows · Archived on · Restore`; on the Production Dashboard a project card gets
  **Archive** in its menu once every batch is done (and always available with a confirm when not).
  Search box on top. Dark theme, same card/table styles as the dashboard.
- Harness: store round-trip (archive → hidden from active → restore → visible), RLS smoke via
  the existing Supabase test helper if present, otherwise a documented manual check.

## BLOCK 5 — PSW ↔ PC gap list (found 07.09 by grep, with evidence) — for Piotr to prioritise

Not part of the nights above unless Piotr says so. Ordered by what a customer can order in PSW
today but PC cannot produce.

1. ~~**Front door**~~ — dropped by Piotr 07.09 (too early). (`doorType 'front-door'`): panels (`fdr-panels`), leaves 1–2 (`fdr-leaves`),
   side panels, fanlight incl. arched (`fdr-fanlight`), top (`fdr-top`), paneling/shape/style
   (`fd-door-*`). PC door types: `single-external`, `french` only.
2. ~~**Sliding door**~~ — dropped by Piotr 07.09. (`'sliding'`): `sl-door-panel-count`, `sl-door-slide-direction`,
   `sl-door-extra-width`; 3D uses `SLIDING_FRAME_FACE 50`. PC: nothing (references only in
   `DoorWindow.jsx` copy and `pricing.js`).
3. ~~**Bifold door**~~ — dropped by Piotr 07.09. (`'bifold'`): `bf-fold-direction`, `bf-open-direction`, `bf-traffic-door`.
   PC: nothing.
4. **Fix frame** — Block 2.
5. **Arched sash** — Block 1. **Arched fix** — Block 2. **Door arched fanlight** — Block 3.
6. **Sash `arched-group`** (`sash-type value="arched-group"`): a grouped/arched sash variant in
   the PSW form — clarify with Piotr what it is before porting.
7. ~~**`measurement-type`**~~ — irrelevant (Piotr 07.09: PC is a production tool, not a measuring tool).
8. **`product-range`** (sash form): product tier; PC has no notion — affects pricing/BOM only.
9. **`c-safety-glass`** (casement): toughened/laminated safety flag per window; PC has glass
   spec chips but no "safety required" rule (e.g. below 800 mm from floor).
10. **`c-color-type` / `c-trickle-colour`**: trickle vent colour choice — PC has the vent count,
    not the colour; BOM line missing.
11. **Door `doorShape`** values beyond `standard` (PSW `fd-door-shape`) — PC constant has one
    entry.
12. **Door glass divider name** — still unknown (needs the PSW form label; Piotr).
13. **Sash glazing arch** (`head-type 'arch'`) — Block 4 note.
14. **Casement mullions / transoms not in the cut list** (`components.box` has head/cill/jambs
    only for every multi-light layout) — known engine gap since v1, still open.
15. **Casement glazing beads not modelled at all** (no bead records, no profile section) —
    frozen by Piotr; the arched leaf physically has a curved bead.
16. **PSW hinge value/label** — Piotr 07.09: values are 1:1 between PSW and PC (Block 0.4b);
    only the PSW label wording is a PSW-side question.
17. **`EstimateConfiguratorPage.jsx` width limit 3000** while production allows 5000 —
    unresolved since 21.08.

---

## Delivery per night
Night 5: Block 0 files (+ `specification.js` hinge identity, `verify/arch/t20_bars.mjs`) (`archDxf.js`, `glassDxfExport.js`, `glassPdfExport.js`,
`CasementGlassDrawing2D.jsx`, `traceryLsp.js` new, `profile.js`, `cncExport.js`, pages
buttons, `docs/handover/workshop/arka_CNC-piotr.dxf`) + Block 1 A–E (`specification.js`,
`projectStore.js`, `ConfiguratorPage.jsx`, `calculations.js` sash branch, `lists.js`,
`verify/arch/t20.mjs`, `t21.mjs`). Night 6: Block 1 F–J + Block 3 (fixed windows). Night 7: Block 4 + Block 6 (archive).
BUILD-LOG per task, BLOCKERS for every DEFAULT (open) above, rectangular snapshots unchanged.
