# ARCHED CASEMENT v2 — phase 2 handover (nights 3 + 4)

Follows `ARCHED-CASEMENT-v1.md` (geometry core, blank planner, CNC DXF — done, on `main`) and
`ARCHED-CASEMENT-v1-AUDIT.md`. Decisions below were taken with Piotr on 05–06.09.2026 and
override v1 where they conflict (§1). Everything else in v1 still applies (rules, harness
discipline, profile-driven numbers, PSW parity notes).

**What this phase delivers:** an arched casement that is real in every tab — cut list with
curved members, glass schedule with shaped units + glazier DXF/PDF, bars (straight and
PSW patterns) with lengths, 2D sheets drawn from true arcs, 3D preview that follows the
rise, and a configurator that asks for the arch the way a joiner measures it.

Two nights. **Night 3 = A + B + C + harness. Night 4 = D + E + F.** Do not start night-4
work in night 3.

---

## 0. Rules (unchanged, see v1 §0) plus phase-2 specifics

- Cloud session on its own branch; Piotr merges in the morning. Never touch `main` directly.
- `src/3d/` is shared with PSW byte-for-byte today. The 3D rewrite (F) breaks that until Piotr
  copies the new files to PSW — keep the **PSW prop names** on the component so the copy is a
  drop-in (`archShape`, `hingeDirection`, `hBars`, `vBars`, plus the new `archRise`,
  `archProfile`, `barPattern`). Never import from `src/pages` or stores into `src/3d`;
  importing `src/engine/arch.js` from `src/3d` is allowed (pure module, no deps).
- All numbers from the profile (`DEFAULT_CASEMENT_PROFILE`), never literals: `frameHead.face`,
  `leafTop.face`, `deductions.leafAtJamb`, `geometry.glassInset`, `arch.*`.
- Beading stays frozen (no curved bead records — casement has no bead records at all).
- No `casementLayouts.js` changes.

---

## 1. Decisions (phase 2)

| # | Decision | Source |
|---|---|---|
| P1 | **Rule C — every arch starts vertical at the jambs.** A horizontal cut at the springing line then equals the member face by construction (Piotr's requirement: the head must be exactly the frame width where it meets the jamb; option A "haunch 148 mm" and option B "two circles, 49 mm mid-arc" were rejected on 06.09) | Piotr 06.09 |
| P2 | Consequence: below half-width the arch is a **three-centre** (small haunch arcs tangent to the jambs + crown arc); at exactly half it is a **semi-circle**; above half → gothic only. **`segmental` is removed** from the PC shape list | Piotr 06.09 |
| P3 | Haunch radius rule: `r = max(rise² / halfW, profile.arch.minHaunchRadius)`, `minHaunchRadius` default **150** (the leaf-top inner ring must keep a positive radius: 150 − 40 − 67 = 43 > 0). Crown radius from tangency (v1 §6.1) | derived, ratified by the 05.09 samples |
| P4 | Configurator asks for **width + "Arch starts at" (mm from cill)**; `rise = H − start`; radius is a result, shown, never typed. Custom start allowed up to `rise = W/2` inclusive ("exactly half" must be reachable — it was not) | Piotr 06.09 |
| P5 | Bars in arches: **straight bars AND the PSW patterns**, now, in one package | Piotr 06.09 |
| P6 | Glazier gets **DXF + PDF** (mm; bar positions also as % of the clear opening on the PDF, one extra line) | Piotr 06.09 |
| P7 | 3D: **rewrite the shared component on `arch.js`** — the 3D is "a copy of the PSW viewer", so the new files go back to PSW after | Piotr 06.09 |
| P8 | Gothic unchanged: equilateral (rise 0.866 W, fixed), drop 0.70, shallow 0.60; gothic arcs already start vertical (equilateral) or near-vertical — accepted as is | v1 |
| P9 | Straight height limit `H ≥ rise + minStraightBelowRise` stays at **900** in the profile until Piotr gives a casement number (he was asked, no answer yet) | open |
| P10 | PSW import: `segmental-arch` → PC `three-centre` with rise 0.20 W; `elliptical-arch` → `three-centre` with rise 0.325 W; `semi-circle` → `semi-circle`; `gothic-arch` (+profile) → gothic. A saved PC window with `archShape: 'segmental'` (v1 era) migrates the same way on load | derived from P2 |

---

## 2. Data model changes

### 2.1 `windowSpec.arch`
```js
arch: null | {
  shape: 'semi-circle' | 'three-centre' | 'gothic-equilateral' | 'gothic-drop',
  rise: Number,            // mm, = height − start
  start: Number,           // mm from cill (external frame bottom) — what the user typed / auto
  riseSource: 'ratio' | 'custom',
  profile: 'equilateral' | 'drop' | 'shallow' | null,
  hinge: 'left' | 'right',
  bars: { pattern: 'none' | 'half-hub' | 'hub-spoke' | 'double-hub-spoke' | 'triple-hub-spoke' | 'intersecting',
          h: Number, v: Number },   // straight bars below the springing (h) and across the width (v)
}
```
Persisted item fields (configurator → store → item, PC names): `casementType`, `archShape`,
`archStart`, `archRise` (kept for compatibility = H − start), `archRiseSource`, `archProfile`,
`archHinge`, `archBarPattern`, `casementHBars`, `casementVBars` (the existing bar counts are
reused — on an arched casement they mean the straight bars).
Store whitelist (`projectStore.js`, both add and update): add `archStart`, `archBarPattern`.

### 2.2 Shape resolution (single function, `arch.js`)
```
resolveRoundShape(W, rise) → rise === W/2 (±0.5 mm) ? 'semi-circle' : 'three-centre'
rise > W/2 on a Round arch → ArchError "rise above half width: use Gothic"
```
`three-centre` geometry = v1 §6.1 with `r` from P3 (replaces the v1 `r = b²/a` alone).

### 2.3 Bars in the arch — geometry contract
- Reference frame: the **glass outline** of the leaf (leaf-top ring inner offset by
  `leafTop.face − glassInset`, straight sides at the leaf stiles' glass edge, bottom at the
  bottom rail's glass edge). Clear width `Wg`, springing line `y_s` (= start line offset the
  same way), apex `y_a`.
- **Vertical bars (v):** equal divisions of `Wg`; each bar runs from the glass bottom edge up to
  its intersection with the glass outline (arc chain) → per-bar `length`, `x`, `topY`.
- **Horizontal bars (h):** equal divisions of the straight glass height **below the springing**
  (bars never cross the arc); each spans `Wg`.
- **Patterns** (semi-circle only, except `intersecting` also for gothic) — geometry ported 1:1
  from PSW `3d-src/src/components/fix-frame/FixFrameWindow.jsx` lines 847–940 (`semiBarPattern`)
  and 667–830 (`intersectingData`), expressed on the glass outline:
  - `hub-spoke`: 4 spokes at angles `i/(n−1)·π`, i = 0..3 (the two end spokes lie on the
    springing line → they ARE the horizontal springing bar), hub ring radius `0.3 · Wg/2`;
    `double-hub-spoke`: 6 spokes, rings 0.3 and 0.6; `triple-hub-spoke`: 8 spokes, rings
    0.3 / 0.6 / 0.8; `half-hub`: springing bar + ring 0.3, no spokes above.
  - Below the springing the hub rings continue as vertical bars at the ring end-x
    (PSW lines 875–886), full straight height.
  - `intersecting` (gothic and semi-circle): port `intersectingData` as is (curves + straight
    bars), no reinterpretation.
  - Every curved bar element is an **ArcChain** (same type as the frame arcs) so DXF and SVG
    reuse the arc renderers; a straight bar is a segment.
- Output: `derived.arch.bars = [{ id, kind: 'straight'|'arc', from:[x,y], to:[x,y] | arc:{cx,cy,r,a0,a1}, length, role: 'v'|'h'|'spoke'|'ring'|'springing' }]`
  with lengths rounded to 0.5 mm. Bar section = the casement bar profile already in the engine.

---

## 3. NIGHT 3

### A — Configurator restructure (`ConfiguratorPage.jsx`, `projectStore.js`, `specification.js`)
- Frame shape chips stay: Standard | Arched.
- Arch shape chips: **Round | Gothic** (segmental and three-centre chips removed; the
  three-centre/semi-circle split is automatic per §2.2).
- Round: field **"Arch starts at (mm from cill)"** (NumInput, no spinners), chip **Auto**
  (`start = H − 0.325·W`, the PSW elliptical default) and button **Half** (`start = H − W/2`).
  Typing switches to custom. Changing H keeps `start`, recomputes rise. Rise and radii shown
  read-only in the right panel: `Rise 200 · R 150 / 1400 / 150` or `R 500` for a semi-circle.
- Gothic: profile chips (Equilateral | Drop | Shallow); start is derived (`H − ratio·W`), field
  read-only.
- Bars section when arched: straight counts (existing chips) + **Pattern** chips filtered by
  shape (`PATTERNS_FOR_SHAPE` from PSW `price-calculator.js` 990–995: semi-circle → none,
  half-hub, hub-spoke, double-hub-spoke, triple-hub-spoke, intersecting; gothic → none,
  intersecting; three-centre → none).
- Validation messages come from `arch.js` (ArchError text), shown in the CNC panel row; the
  dimension clamp uses `profile.arch.limits`.
- Edit-mode load and last-window prefill restore all fields (including a v1-era
  `archShape: 'segmental'` → migrate per P10 and set `riseSource: 'ratio'`).

### B — Engine (`calculations.js` `deriveCasementWindow`, `arch.js`, `lists.js`)
When `windowSpec.arch` is set:
1. Geometry from `buildArchGeometry` (v1) with P3; layout forced to one leaf (already).
2. **Box parts:** replace the straight `C-FRAME HEAD` with `C-ARCH HEAD` — `length` = arc length
   of the head ring **centre line** (mean of outer and inner chains), `section` from
   `frameHead.face × frameDepth`, notes `R … · N pieces · stock …` from `planArchSegments`,
   `code 'C-AH'`. Jambs: length = `start` − the existing jamb deductions (straight part only).
3. **Sash parts:** replace `C-TOP RAIL` with `C-ARCH TOP RAIL` (`C-ATR`), length = leaf-top ring
   centre-line arc length; stiles = straight height of the leaf to the springing (existing
   deductions apply to the straight part).
4. **Glass unit:** `{ width: Wg, height: y_a − glassBottom, qty: 1, role: 'main', shape: {
   kind: 'arched', outline: ArcChain + straight sides/bottom, springing: y_s − glassBottom,
   radii: [...], rise }, location: 'arched leaf' }`. Rectangular consumers keep working on
   `width × height` (bounding box); shaped consumers read `shape`.
5. **Bars:** §2.3 list; `consumables` bar length = Σ lengths; `bom` counts per bar.
6. Paint / seal / weights: perimeter and area from the true outline (arc length + straight
   sides), not the bounding box.
7. `lists.js`: `CUT_LIST_ORDER` + symbols for `C-ARCH HEAD` (`C-AH`) and `C-ARCH TOP RAIL`
   (`C-ATR`) right after their straight counterparts; grouping consolidates by length as usual.
8. `derived.arch` (new): `{ geometry, plans, bars, glassOutline }` for the drawings and exports.

### C — Glazier exports (`src/utils/glassDxfExport.js` new, `glassPdfExport.js` extended)
- **DXF** (R12, `dxfWriter.js`): one entity set per shaped unit — layer `GLASS_CONTOUR` (closed
  bulge polyline, exact arcs), `GLASS_BARS` (bar axes: lines / bulge polylines), `GLASS_TEXT`
  (window name, unit id, `W × H`, radii, rise, bar list `V1 x=… L=…`). Units laid out
  `windowSpacing` apart; file `{name}_glass.dxf`, merged `{label}_glass.dxf`. Button next to the
  existing glass PDF export on the Glass tab (mockup-free: same row, same style).
- **PDF**: the existing glass schedule gains a `Shape` column (`arched · R 500` / `rect`), a
  thumbnail drawn from the outline (SVG → canvas as the other thumbnails), and for shaped units
  a second line: bar positions in **mm and in % of the clear width/height** (P6).
- Rectangular units unchanged.

### Harness `verify/arch/t18.mjs` (night 3)
Vectors (profile faces 57 / 67, leafAtJamb 40, glassInset 12.5, minHaunchRadius 150):
```
Round W1000 H1500 start 1300 (rise 200): three-centre r 150 R 1400.00 · Cs x ±350 · CL y −1200 · T (392.00, 144.00)
   haunch span 73.74° · crown span 32.52° · arc lengths 193.05 + 794.62 + 193.05 = 1180.72
   rings: head inner r 93 / R 1343 · leaf outer 110 / 1360 · leaf inner 43 / 1293 · glass 55.5 / 1305.5
Round W1000 H1500 start 1175 (rise 325): r 211.25 R 634.62 · T (432.83, 154.49) · spans 47.00° / 86.01° · total 1299.17
Round W1500 H2000 start 1700 (rise 300): r 150 R 1425.00 · spans 61.93° / 56.14° · total 1720.63
Round W1000 H1500 start 1100 (rise 400): r 320 R 562.50 · spans 42.08° / 95.85° · total 1410.99
Round W1000 start = H − 500 → shape 'semi-circle', R 500, one arc, length 1570.80
Round W1000 start = H − 520 (rise 520 > W/2) → ArchError (use Gothic)
Semi-circle W1000: 2 vertical bars at thirds of Wg = 811 (glass half 405.5): x = ±135.17 from centre,
   top 382.31 above the springing; 4-spoke hub: spoke angles 0/60/120/180°, ring r 121.65
Cut list: C-AH length = centre-line arc length (head ring), C-ATR = leaf ring centre line; no '?' groups
Glass DXF: ezdxf round-trip, contour closed, bulge count = number of arcs, bar axes count = bars.length
PSW import: casArchShape 'segmental-arch' W1200 → three-centre, rise 240, start = H − 240, riseSource 'ratio'
```
All night-1/2 harnesses (`t16`, `t17`) must still pass after B (the planner is reused, not changed
— except P3, which changes the three-centre vectors in `t16` §10.1: update them to the numbers
above, they supersede v1's `r = b²/a` alone).

---

## 4. NIGHT 4

### D — 2D sheets (`src/components/drawings/`)
- `CasementElevation2D`, `CasementFrameDetail2D`, `CasementLeafDetail2D`, `CasementGlassDrawing2D`:
  when `derived.arch` exists, draw the head, leaf top and glass from the ArcChains with SVG `A`
  segments (sweep flags derived from the chain direction; never Bézier), members as concentric
  bands, bars from `derived.arch.bars`. Dimensions: `W`, `H`, `start` (from cill), `rise`, and
  every radius on the head (`R 150 / 1400`), leaf top radius, glass radius on the glass sheet.
- Exterior view, `drawingTheme.js` only, `sc` never for fonts/strokes (v1 §0).
- Straight-only windows: byte-identical output (snapshot test: render a rectangular casement
  before/after and diff the SVG string).

### E — Bars, complete
- Straight + patterns per §2.3 in engine (done in B), drawn in 2D (D), exported to the glazier
  DXF/PDF (C), and in 3D (F). Bar dimension numbers on the glass sheet only where the bar end
  lies on a curve (memory: "needed at arches because bar ends lie on a curve").

### F — 3D rewrite (`src/3d/components/casement/ArchedCasementWindow.jsx`)
- Replace the fixed-ratio outline (`rise = halfW·0.4`, `W·√3/2`, `W/2`) with chains from
  `arch.js` (`archArcs` + offsets): outer frame, frame inner (constant `frameHead.face`), leaf
  outer/inner, glass — i.e. rule C, concentric, rise-driven.
- Props: keep `archShape` (accept BOTH PSW names and PC names via `PSW_ARCH_SHAPE`), add
  `archRise` (mm; when absent fall back to the PSW ratio so the PSW copy behaves as today),
  `archProfile`, `barPattern`, keep `hingeDirection`, `hBars`, `vBars`, `opening`.
- Bars as thin boxes along straight segments and as extruded strips along arcs (the PSW
  `intersecting` strip approach, FixFrameWindow 924+) — reuse, do not invent.
- `windowSpecToConfig.js` and the configurator's `update3D` pass `archRise`, `archProfile`,
  `barPattern` (`casArchShape` may now be a PC name).
- Parity: after Piotr's review the same file + `arch.js` are copied to PSW `3d-src` (write the
  instruction file `docs/handover/PSW-3D-ARCH-PORT.md`: files, props, what changes visually).

### Harness `verify/arch/t19.mjs` (night 4)
Renders (react-dom/server) of the four casement sheets for: rectangular (snapshot equal to
before), semi-circle 1000×1500, three-centre 1000×1500 start 1300, gothic 1000×1800, each with
0 bars and with 2v/1h + one pattern. Assert: no `NaN`, every `<path>` `A` count = number of arcs
drawn, radius labels present, text fits the viewBox (v1 guard). 3D: mount `ArchedCasementWindow`
with `@react-three/test-renderer` if present, otherwise call the exported geometry helper and
assert vertex counts > 0 and outline extents = W × H ± 1 mm for all shapes.

---

## 5. Delivery
Night 3 ZIP/branch: `ConfiguratorPage.jsx`, `projectStore.js`, `specification.js`, `arch.js`,
`calculations.js`, `lists.js`, `glassDxfExport.js` (new), `glassPdfExport.js`, `profile.js`
(`minHaunchRadius`, pattern list), `verify/arch/t18.mjs`, samples `docs/handover/samples/*_glass.dxf`.
Night 4: the four `Casement*2D.jsx`, `ArchedCasementWindow.jsx`, `windowSpecToConfig.js`,
`verify/arch/t19.mjs`, `docs/handover/PSW-3D-ARCH-PORT.md`.
BUILD-LOG per task, BLOCKERS for anything undecided (P9 limit, minimum piece length 6.5, D13).

## 6. Not in this phase
Sash arches, fix-frame arches, door arched fanlights, curved beads, pricing of arches, the
Production Book. Glass bars on **rectangular** casements keep their current behaviour.
