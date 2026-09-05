# ARCHED CASEMENT v1 — handover for the coding session

> **STATUS 06.09.2026:** the package was built on 05.09 WITHOUT this file (it had not been
> committed). The code on `main` is the night build; the deviations from this spec are listed
> as tasks in `ARCHED-CASEMENT-v1-AUDIT.md`. This spec remains the reference — where the
> as-built differs, the spec wins unless the audit says otherwise.

Repo: `Piotr3009/Sash-Planner-Web` (Production Core, "PC") —
`https://github.com/Piotr3009/Sash-Planner-Web`.
Reference repo (read-only, OPTIONAL): `Piotr3009/Prime-Sash-Windows` ("PSW").
Clone exactly like this (Piotr's rule):
```
git -c http.proxyAuthMethod=basic clone --depth 1 https://github.com/Piotr3009/Prime-Sash-Windows.git psw
```
Never push to PSW. If the clone fails (repo private), do NOT ask for a token — every PSW
number this package needs is quoted below (§3) with file and line, so the package can be
built from this document alone. All decisions below were taken with Piotr on
05.09.2026 and are final unless marked **DEFAULT (open)**.

Deliverable of this package: **arched casement geometry + segmented blank plan + CNC DXF
for frame head and leaf top rail.** No 2D drawings, no 3D, no cut-list records yet
(those are the next packages, see §12).

---

## 0. Session rules (Piotr's, non-negotiable)

- Code and comments in **English only**. No Polish anywhere in source files.
- Clone: `git -c http.proxyAuthMethod=basic clone --depth 1 <url>`.
- `npx esbuild@0.25.0 <file> --loader:.js=js --format=esm --outfile=/dev/null`
  (`--loader:.jsx=jsx --jsx=automatic` for JSX) on **every** touched file.
- After every write: `grep -F` for a string you just wrote. Never trust "build OK" alone.
- **Harness before ZIP.** Node scripts, bundle with esbuild into `<repo>/.audit/`, assert on
  real derived data. Grep-level audits are not evidence.
- ZIP gate on ONE `&&` chain: esbuild all → zip → `test -f` → `unzip` → `diff` each file →
  copy to outputs → `present_files`. Cumulative ZIP with `src/...` paths. New name per rebuild
  (`-v2`, `-v3`). SQL never inside a ZIP.
- Never modify existing functions beyond the stated scope. Any deviation = ask first.
- **Beading is frozen** — curved glazing beads are OUT of this package (Piotr did not release them).
- Do not touch `casementLayouts.js` panel order (PSW parity) — this package does not need it.
- `get xyz()` getters are forbidden in Zustand stores (breaks persist hydration).
- Never use `sc` multiplier for `fontSize`/`strokeWidth`; all 2D visual constants live in
  `drawingTheme.js` (irrelevant here, no 2D in this package — noted for later packages).

---

## 1. Scope

**IN**
1. `src/engine/arch.js` — pure geometry module (all shapes), segment planner.
2. `src/engine/cnc/archDxf.js` — DXF R12 entity builder: CONTOUR / ASSEMBLY / PIECES layers,
   frame head + leaf top rail, styled like `jambDxf.js`.
3. `src/utils/cncExport.js` — new export functions for arched members (single window +
   merged for batch/pack), wired next to the existing jambs export.
4. Casement profile settings for arches (`profile.js`).
5. `windowSpec.arch` normalisation in `specification.js` (with PSW field mapping).
6. UI: one button "Arch DXF" next to "Jambs DXF" on `WindowDetailPage.jsx` and the merged
   equivalent on `ProductionPackPage.jsx`. Visible only when the window has an arch.
7. Harness `verify/arch/t16.mjs` with the test vectors in §10 (numbers are pre-computed —
   the harness must reproduce them, not the other way round).

**OUT (next packages)** — cut-list records for curved members, glass shape/templates,
2D SVG, 3D port, sash/fix-frame/door arches, bar patterns, curved beads, pricing.

---

## 2. Decisions locked (with source)

| # | Decision | Source |
|---|---|---|
| D1 | Arch is a **shape attribute of an existing window type**, never a separate batch type | Piotr 05.09; PSW does the same (`casement-type='arched'`) |
| D2 | **Casement first**, single leaf (as PSW `ArchedCasementWindow` = frame + one leaf) | Piotr 05.09 |
| D3 | **Concentric arcs** — inner edge = outer edge offset by the member face. PSW 3D is NOT concentric (see §3) and is not copied | Piotr 05.09 |
| D4 | Blank construction: **segmented** — straight pieces, ends cut at half the segment angle, finger-jointed, then contour cut on the 5-axis CNC, then spindle moulder. Where the fingers are cut is a process note only (see D5) — the DXF is identical either way | Piotr 05.09 |
| D5 | Finger joint tool: **Stark 15-16 Finger Joint Head D-250 B-30.4 d-50** (Scott+Sargeant SKTG05FC06). Industry naming "15/16" = **finger length 15 mm, groove 16 mm (1 mm tip gap)**, pitch 3.8 mm on this class of cutter (verify pitch on the knife sheet — `no evidence` on the product page). **Conflict:** Piotr quoted 10–11 mm from memory; that is the 10/11 profile, not this tool. Default = **15 / 16 / 3.8** from the tool he chose; all three are profile settings. NOTE: this is a bored 250 mm block (d50, stackable 30.4) — on the 5-axis CNC it needs a d50 arbor holder and rpm ≤ the head's nMax; otherwise the fingers are cut on the spindle moulder with a tilted fence and only the contour goes to the CNC. Flag for Piotr, do not decide in code | Piotr 05.09 + product page |
| D6 | Contour allowance **10 mm per side** — profile setting | Piotr 05.09 |
| D7 | Available stock widths **50 · 63 · 75 · 95 · 105 · 180 · 200** — profile setting | Piotr 05.09 |
| D8 | Max segment angle **36°** (grain run-out) — profile setting | proposed, accepted |
| D9 | Elliptical arch = **three-centre arch** (basket handle), never a true ellipse | Piotr 05.09 |
| D10 | Member sections come from the **existing casement profile** — no new sections. Head uses `frameHead.face`, leaf top rail uses `leafTop.face` | Piotr 05.09 |
| D11 | Rise default = **PSW ratio × external width**; **editable** in PC. An edited rise cannot round-trip to PSW — accepted | Piotr answered "ok" to the explanation |
| D12 | Export format: **DXF R12 with bulge polylines** (existing `dxfWriter.js`), consumed by VCarve. LSP is legacy, DWG never | evidence: `jambDxf.js` header |
| D13 | Piece selection when several N fit: **DEFAULT (open)** — narrowest stock that fits with `N ≤ N_min + 2`, tie → fewer pieces; the alternative is printed on the sheet | Piotr did not answer; default chosen, print alt |

---

## 3. PSW reference — what to take, what NOT to copy

### 3.1 Files (PSW)
- `3d-src/src/components/ArchedSashWindow.jsx` — lines 60–140: `ARCH_RISE_RATIO`,
  `GOTHIC_PROFILE_RATIO`, `archRiseFor`, `gothicCentreOffset`, `archedSashMetrics`.
- `js/price-calculator.js` lines ~990–1010: `PATTERNS_FOR_SHAPE`, limits, `riseFor`.
  **This table is duplicated in PSW** (jsx ↔ js, "keep them in step"). PC keeps ONE copy.
- `3d-src/src/components/fix-frame/FixFrameWindow.jsx` `SegmentalFrame` (line 1091+):
  outer radius formula (correct); inner arc recomputed from `(rise − face, halfW − face)`
  — **NOT concentric, face width varies along the arc. Do not port.**
- `3d-src/src/components/casement/ArchedCasementWindow.jsx` (469 lines): frame + one leaf,
  `LEAF_GAP 4`, rebate layers `EXT_FACE_W = FRAME_FACE − REBATE_STEP`. Structural reference
  only.
- `js/estimate-renderer.js` lines 1430, 2212: arches drawn as **quadratic Bézier `Q`** —
  not circles. Do not port.
- `js/casement-controller.js` 169–235, 469–472: form fields for arched casement.
- `js/estimate-manager.js` 682–692: persisted sash arch fields (`archShape, archRise,
  archBarPattern, archHBars, archVBars, archProfile`). **Casement arch fields are NOT
  persisted as dedicated columns — only inside `fullConfig`.**

### 3.2 Ratios (rise = ratio × EXTERNAL frame width)
```
segmental-arch   0.20
elliptical-arch  0.325
semi-circle      0.50
gothic-arch      sqrt(3)/2 = 0.8660254   (profile 'equilateral')
gothic drop      0.70
gothic shallow   0.60
```
Gothic: two arcs, centres on the arch-start line at ±c,
`c = (rise² − halfW²) / (2·halfW)`, radius `= halfW + c` (equilateral → c = halfW, R = W).

### 3.3 PSW limits (sash; adopt for casement until Piotr says otherwise)
width 400–1500 · `H ≥ rise + 900` · straight stile of the arched leaf ≥ 100.

### 3.4 Three vocabularies in PSW for the same four shapes — map ALL of them
```
PSW sash form  (arch-style)     : semicircular | gothic | elliptical | segmental
PSW casement   (cas-arch-shape) : semi-circle | gothic-arch | elliptical-arch | segmental-arch
PSW ratio keys                  : same as casement
PC canonical (windowSpec.arch.shape): 'segmental' | 'semi-circle' | 'gothic' | 'three-centre'
```
`'elliptical'`/`'elliptical-arch'` → PC `'three-centre'` (D9). Keep `ARCH_SHAPE_ALIASES` in
`arch.js` and use it in `specification.js`.

---

## 4. Data model (PC)

### 4.1 `windowSpec.arch` (added by `normaliseToWindowSpec`, casement only in this package)
```js
arch: null | {
  shape:   'segmental' | 'semi-circle' | 'gothic' | 'three-centre',
  rise:    Number,          // mm, default = ratio × frame.width (see §3.2); editable
  profile: 'equilateral' | 'drop' | 'shallow' | null,   // gothic only
  riseSource: 'ratio' | 'custom',
}
```
Rules:
- `arch` is `null` unless the source says arched. Never infer an arch from a size.
- Casement with `arch` ⇒ **layout is forced to a single leaf**; ignore `casementLayout`
  and `casementHinges` for geometry, keep `hinge` = `casementArchHinge || 'left'`.
- Shape without rise ⇒ compute from ratio; shape unknown ⇒ **throw** (silent rectangles
  were the CRITICAL import bug — do not reproduce it).

### 4.2 Source fields read by `normaliseToWindowSpec`
```
PC item / fullConfig            PSW item / fullConfig
------------------------------  --------------------------------------------
casementType === 'arched'       casementType === 'arched'  (fullConfig)
casementArchShape               casArchShape | archShape   (fullConfig)
casementArchHinge               casArchHinge | cas-arch-opening value ('right' means LEFT hinge in the PSW form — see note)
casementArchRise (optional)     archRise (sash only) | fixArchRise (fix only)
casementArchProfile             archProfile
```
Note on PSW hinge value: in `online-estimate.html:887-888` the radio **labelled "Left
Hinge" has value `right`** and vice-versa (PSW stores the OPEN side, PC stores the hinge
side, consistent with the door convention already in PC). Map `right → hinge 'left'`,
`left → hinge 'right'`. Write this in a comment; it will bite otherwise.

### 4.3 Derived contract (for later packages; expose now from `arch.js`)
```js
archGeometry(spec) → {
  shape, rise, straightHeight,          // straightHeight = frame.height − rise
  outer:  ArcChain,                     // frame outer edge
  head:   { outer: ArcChain, inner: ArcChain, face },          // concentric
  leafTop:{ outer: ArcChain, inner: ArcChain, face },          // R − leafAtJamb, face = leafTop.face
  glass:  { outer: ArcChain },          // leafTop.inner offset by (leafTop.face − glassInset) from leaf outer — i.e. leafTop.outer − (face − glassInset)
}
ArcChain = [{ cx, cy, r, a0, a1 }]     // radians, CCW, y up, origin = frame bottom-left
```
Multi-arc chains: gothic = 2 arcs, three-centre = 3 arcs. Every chain is tangent-continuous.

---

## 5. Profile settings (`profile.js`, casement profile)
```js
arch: {
  riseRatio: { 'segmental': 0.20, 'three-centre': 0.325, 'semi-circle': 0.50, 'gothic': Math.sqrt(3) / 2 },
  gothicProfileRatio: { equilateral: Math.sqrt(3) / 2, drop: 0.70, shallow: 0.60 },
  limits: { minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 },
  blank: {
    fingerJoint: { length: 15, groove: 16, pitch: 3.8 },   // Stark 15-16 head (D5); Piotr's spoken 10–11 = other profile
    contourAllowance: 10,     // mm per side, Piotr 05.09
    maxSegmentAngleDeg: 36,   // grain run-out limit
    stockWidths: [50, 63, 75, 95, 105, 180, 200],   // Piotr 05.09
    pieceSpacing: 200,        // DXF layout, same as jambDxf
    windowSpacing: 300,       // merged files, same as jambDxf
  },
}
```
Everything above is workshop data → editable per tenant like the other profile values.

---

## 6. `src/engine/arch.js` — geometry

Coordinate system: mm, **y up**, origin at frame outer bottom-left, arch-start line at
`y = straightHeight = H − rise`, arch symmetric about `x = W/2`. Angles in radians, CCW.

### 6.1 Shapes → outer ArcChain (external width W, rise)
**segmental / semi-circle (one centre)**
```
halfW = W/2
R     = (rise² + halfW²) / (2·rise)          // semi-circle: rise = halfW → R = halfW
cy    = straightHeight − (R − rise)          // below the arch-start line
theta = 2·asin(halfW / R)                    // included angle; semi-circle → π
arc   = { cx: W/2, cy, r: R, a0: π/2 − theta/2, a1: π/2 + theta/2 }
```
**gothic (two centres)** — `c = (rise² − halfW²)/(2·halfW)`, `R = halfW + c`
```
right arc centre (W/2 − c, straightHeight) → arc from apex to RIGHT springing:
   a0 = atan2(rise, c)  (apex, measured from the +x axis of that centre? — NO: see below)
```
Define explicitly to avoid sign errors:
- Left half of the arch is drawn by the arc centred at `(W/2 + c, straightHeight)`,
  from the left springing point `(0, straightHeight)` (angle π) to the apex
  `(W/2, straightHeight + rise)` (angle `π − atan2(rise, c)`), i.e. `a0 = π − atan(rise/c)`,
  `a1 = π`. Span = `atan(rise/c)` = 60° for equilateral.
- Right half mirrored: centre `(W/2 − c, straightHeight)`, `a0 = 0`, `a1 = atan(rise/c)`.
- Chain order for CCW traversal: right arc (a0→a1), then left arc (a0→a1).
**three-centre (three centres)** — a = halfW, b = rise
```
r  = b² / a                                   // end-arc radius = ellipse curvature at the springing
R  = ((a − r)² + b² − r²) / (2·(b − r))       // tangency condition
Cs = (±(a − r), straightHeight)              // small centres
CL = (W/2, straightHeight + b − R)            // large centre (below the arch-start line)
T  = Cs + r · unit(Cs − CL)                   // tangent points (one per side)
small span = atan2(T.y − Cs.y, T.x − Cs.x)    // 47.0° for W=1200
large span = π − 2·small span
```
Chain: right small arc (0 → t), large arc (t → π − t), left small arc (π − t → π).

### 6.2 Concentric offsets
`offset(chain, d)` = same centres, `r − d`, same angles. Face bands:
- head: outer = frame outer chain, inner = offset(face = `frameHead.face`)
- leaf top rail: outer = offset(`deductions.leafAtJamb` = 40), inner = outer offset(`leafTop.face` = 67)
- glass (for later): leaf outer offset(`leafTop.face − geometry.glassInset`)
Ends: every chain is clipped at the arch-start line **y = straightHeight**. Inner chains
meet that line further in (the "haunch"); compute the intersection x analytically per arc:
`x = cx ± sqrt(r² − (straightHeight − cy)²)`.

### 6.3 Helpers (export all, pure)
```
archRiseFor(shape, W, profile)              // §3.2
archOuterChain(shape, W, rise, profile)     // §6.1
offsetChain(chain, d)
clipChainAtY(chain, y)                      // trims end arcs to the arch-start line
arcLength(chain)                            // Σ r·(a1 − a0)
samplePoints(chain, stepMm)                 // for extents / projections
bulgeFor(a0, a1)                            // tan((a1 − a0)/4), sign = direction
chainToPolyVertices(chain, y0)              // [[x,y,bulge]...] — one vertex per arc start, bulge to next
```
`chainToPolyVertices` must produce a polyline VCarve reads as true arcs: vertex at arc start
with `bulge = tan(Δ/4)`, next vertex at arc end. Verified in §10 by re-reading with `ezdxf`
(`pip install ezdxf --break-system-packages`) and comparing `entity.bulge` and computed
arc length within 0.01 mm.

---

## 7. Segment planner (`planSegments`)

Input: a face band `{ outer: ArcChain, inner: ArcChain }` clipped at the arch-start line,
plus `blank` settings. Output: pieces with stock sizes and flat outlines.

1. Split the band **per arc of the chain** (joint mandatory at every tangent point).
2. For each arc of included angle θ: `N_min = max(2, ceil(θ / maxSegmentAngle))` per arc;
   for **segmental with θ < maxSegmentAngle use N_min = 1 only if the piece fits stock**, else 2.
   (Piotr's expectation: segmental ≈ 3, gothic 2 per side, semi-circle 5.)
3. For `N in N_min .. N_min + 3`: `φ = θ/N`; piece k spans `[a0 + kφ, a0 + (k+1)φ]`.
   Piece axis = tangent direction at the mid-angle; piece normal = radial at mid-angle.
4. Build the **allowance band**: outer offset `+contourAllowance`, inner offset
   `−contourAllowance`, bounded by the two joint planes (radial lines) — and for the two
   end pieces by the arch-start line instead of the outer joint plane (this is what makes
   the end pieces wider: the haunch).
5. Sample the band polygon (arc steps ≤ 1°), project every point onto the piece axis (→ L)
   and normal (→ W_req). `W_req = max − min` on the normal, `L = max − min` on the axis.
   This projection method replaces the closed formulas below and covers the haunch
   automatically; the formulas are kept only as a sanity check for middle pieces:
   ```
   W_req_mid = (Ro + a) − (Ri − a)·cos(φ/2)
   L_out_mid = 2·(Ro + a)·sin(φ/2)
   ```
6. `stock = smallest value in stockWidths ≥ W_req`; none → this N is infeasible.
7. Rough length = `L + fingerJoint.length × jointedEnds` (jointed ends: 1 for end pieces,
   2 for middle pieces; **conservative**, documented in code — Piotr can lower it).
   Finger zone drawn on the PIECES layer = `fingerJoint.groove` deep from the jointed end.
8. End cut angle at a joint = `φ/2` from the perpendicular to the piece axis (joint plane
   is radial). End cut at the arch-start line for end pieces = angle between the piece axis
   and the horizontal (report it explicitly, the CNC needs it).
9. Choose N per **D13**; keep the full candidate table in the result (`options[]`) and
   print the runner-up on the sheet.

Output per piece:
```js
{ code: 'HEAD-S1', arcIndex, k, N, phiDeg, axisAngleDeg, L, Lin, W_req, stock, rough,
  endCuts: [{ kind: 'joint'|'spring', angleDeg }, {...}],
  flatOutline: [[x,y]...],        // piece in its own frame, axis = +x, y up, origin = left-bottom of the stock rectangle
  fingerZones: [[[x,y],[x,y]]],   // dashed lines offset fingerJoint.groove from jointed ends, in the flat frame
  placedOutline: [[x,y]...],      // same outline in window coordinates (ASSEMBLY layer)
}
```

---

## 8. `src/engine/cnc/archDxf.js`

Mirror `jambDxf.js` exactly in style: entity list `{poly|circle|text}`, mm, y up,
layers via `CNC_LAYERS`-like constant, serialised by `dxfWriter.js`. Add layers:
```
ARCH_CONTOUR   (colour 7)   finished members: head band + leaf-top band, closed polylines with bulge
ARCH_ASSEMBLY  (colour 3)   pieces placed on the arc (closed polys), joint lines (radial), arch-start line, centre circles + text "C R=…"
ARCH_PIECES    (colour 1)   pieces flat in a row, 200 mm apart; finger zones as separate short polylines on layer ARCH_FINGER (colour 6)
ARCH_TEXT      (colour 2)   labels
```
Sheet layout (per window, y up):
- Row 1 (top): ASSEMBLY view of the head with the CONTOUR overlaid, leaf band below it in
  the same view (they are concentric, so one view shows both).
- Row 2: PIECES of the head, `HEAD-S1..Sn`, left to right.
- Row 3: PIECES of the leaf top rail, `LEAF-S1..Sn`.
- Text block: window name · shape · W × H · rise · `head R_out/R_in` · `leaf R_out/R_in` ·
  `N × stock` for head and leaf · finger depth · allowance · runner-up option.
- Each piece: label, `L_out / L_in × W`, end-cut angles, `finger both ends` / `finger one end`.
- Merged export (batch/pack): windows stacked `windowSpacing` apart, labels from window names —
  identical to `buildMergedJambEntities`.

Bulge direction: CCW positive. The CONTOUR polylines must be closed (`closed: true`) and
must contain exactly one vertex per arc endpoint — no sampled polygons on that layer.
ASSEMBLY/PIECES outlines are straight polylines (pieces are straight timber).

File naming: `{name}_arch.dxf`; merged `{label}_arch.dxf` (same `safeName` as `cncExport.js`).

---

## 9. Export wiring

- `cncExport.js`: add `canExportArchDxf(spec)` (true iff `spec.arch` and category casement),
  `exportArchDxfForWindow(spec, name)`, `exportArchDxfMerged(windows, label)` — same
  `downloadDxf` helper, same rules (skip windows without arch, never guess).
- `WindowDetailPage.jsx`: button "Arch DXF" next to the existing jambs button, gated by
  `canExportArchDxf`. `ProductionPackPage.jsx`: merged button next to `exportCncJambsMerged`.
- No new page, no settings UI in this package (profile values are code defaults for now).
- **Mockup rule**: the button placement is trivial and pre-approved by scope; anything beyond
  a button requires a mockup and Piotr's approval — do not add an arch configurator UI.
  (The configurator inputs for `casementType/casementArchShape/rise/hinge` are a separate,
  mockup-gated package. For this package the harness feeds `windowSpec` directly.)

---

## 10. Test vectors (pre-computed, W = 1200, casement profile faces 57 / 67, leafAtJamb 40)

### 10.1 Geometry
```
segmental  rise 240 : R_out 870.00  R_in 813.00  theta 87.21°  arcLen_out 1324.16  arcLen_in 1237.41
                      centre 630.00 below arch-start   inner arc meets arch-start at x = W/2 ± 513.88
semi-circle rise 600: R_out 600.00  R_in 543.00  theta 180°    arcLen_out 1884.96  arcLen_in 1705.88
gothic equilateral  : rise 1039.23  c 600.00  R_out 1200.00  R_in 1143.00  span 60° each  arcLen_out 1256.64 each
gothic drop         : rise 840.00   c 288.00  R_out 888.00   R_in 831.00   span 71.08°    arcLen_out 1101.56 each
three-centre rise 390: r 253.50  R 761.54  small centres x = W/2 ± 346.50  large centre 371.54 below arch-start
                       tangent point (W/2 + 519.40, arch-start + 185.39)  small span 47.00°  large span 86.01°
                       arcLen small 207.93 each  arcLen large 1143.13   check: |Cs − CL| = R − r = 508.04
leaf (segmental)    : R_out 830.00  R_in 763.00
```

### 10.2 Segment plans (allowance 10, finger length 15, maxSegmentAngle 36°, stock list D7)
```
HEAD segmental 1200 (θ 87.21°):
  N=3  φ 29.07°  W_req 102.70  L_out 441.71  L_in 403.06  end cut 14.53°  stock 105  rough mid 471.71 / end 456.71
  N=4  φ 21.80°  W_req  91.49  L_out 332.85  L_in 303.72  end cut 10.90°  stock  95
  N=5  φ 17.44°  W_req  86.28  L_out 266.86                                 stock  95
  D13 default → N=4 × 95   (runner-up printed: 3 × 105)
LEAF segmental 1200 (R 830/763, θ 87.21°):
  N=3  W_req 111.1 → stock 180 (wasteful)     N=4  W_req 100.6 → stock 105
  D13 default → N=4 × 105   (runner-up: 3 × 180)
HEAD semi-circle 1200 (θ 180°):
  N=5  φ 36°  W_req 103.09  L_out 377.00  L_in 329.41  end cut 18°  stock 105  rough mid 407.00 / end 392.00
  N=6  φ 30°  W_req  95.16  stock 105     N=7  φ 25.71°  W_req 90.36  stock 95
  D13 default → N=7 × 95   (runner-up: 5 × 105)
```
The `W_req` values above come from the closed formula for middle pieces. The projection
method (§7.5) must give the **same value for middle pieces (±0.05)**; for the two end pieces
it gives a value **≥ the middle value** (the arch-start corner can add width on steep arcs;
for the segmental case above it does not — verified 06.09 on the as-built projection). The
harness asserts `==` for middle pieces and `>=` for end pieces.

### 10.3 Harness `verify/arch/t16.mjs` — assertions
1. `archRiseFor` reproduces §3.2 for all shapes/profiles.
2. Every chain in §10.1 within 0.01 mm / 0.01° of the listed values.
3. `offsetChain` keeps centres, reduces r by exactly the face; `clipChainAtY` endpoints lie
   on `y = straightHeight` (|Δy| < 1e-6).
4. Three-centre: tangency `|Cs − CL| = R − r`, and the tangent point lies on both circles.
5. Bulge polylines: write CONTOUR to a temp DXF, read with `ezdxf` (python subprocess),
   recompute arc length from vertices + bulges = `arcLength(chain)` within 0.01.
6. Segment plans reproduce §10.2 (N candidates, W_req for middle pieces, stock pick per D13).
7. Every piece's `flatOutline` fits inside a `stock × rough` rectangle; every `placedOutline`
   contains its portion of the allowance band (point-in-polygon on sampled band points).
8. Export functions: `canExportArchDxf` false for rectangular casement, false for sash/door;
   merged export skips non-arched windows and stacks the rest at 300 mm.
9. `normaliseToWindowSpec`: PSW `fullConfig` with `casementType:'arched', casArchShape:
   'elliptical-arch', 'cas-arch-opening': 'right'` → `arch.shape 'three-centre'`, hinge `'left'`,
   rise 390 at W 1200, `riseSource 'ratio'`; unknown shape → throws.
10. Nothing in `casementLayouts.js`, `lists.js`, `calculations.js` changes (git diff empty).

---

## 11. Delivery
ZIP `arched-casement-v1.zip` with:
```
src/engine/arch.js
src/engine/cnc/archDxf.js
src/engine/profile.js
src/engine/specification.js
src/utils/cncExport.js
src/pages/WindowDetailPage.jsx
src/pages/ProductionPackPage.jsx
```
plus `verify/arch/t16.mjs` presented separately (not in the ZIP), and one sample
`sample_arch_1200_segmental.dxf` generated by the harness so Piotr can open it in VCarve
before pushing. Piotr pushes himself.

---

## 12. Next packages (do not start; listed so nothing is forgotten)
- **P3** cut-list records: `C-ARCH HEAD`, `C-ARCH TOP RAIL` (length = arc length at member
  centre line, notes = R, N pieces, stock), `D-*` equivalents later; consumables/paint use
  arc length; weights use the band area.
- **P4b** glass: shaped unit — DXF template per unit (leaf outer offset by `face − glassInset`),
  PDF glass schedule gains `shape / R / rise` columns.
- **P5** 2D: SVG path `A` from the same ArcChain (no Bézier), elevation + frame + leaf sheets;
  Production Pack section "Curved members".
- **P6** sash arch (PSW has the full product: upper sash arched, `HEAD_FACE 80`, limits §3.3),
  fix frame (needs the fix-frame engine first — today `emptyDerived`), door arched fanlight
  (PSW: semi-circle only, rise `W/2 + 80`, blocked for double front doors).
- **P7** bar patterns in arches (`PATTERNS_FOR_SHAPE`), radial bars, per-bar templates.
- **P8** 3D in PC: port from PSW (2756 lines), decide whether to correct the non-concentric arc.
- Curved glazing bead — **frozen until Piotr releases it**.
- Configurator UI for arches — **mockup first**.
- Pending unrelated TODOs in Petros: door leaf 92 mm (material 014), casement jambs/head 68 mm
  (changes `frameHead.face` — the arch module must read it from the profile, never hardcode 57).
