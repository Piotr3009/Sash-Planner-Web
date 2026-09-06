# PSW 3D arch port — copying the arched casement viewer back to Prime-Sash-Windows

Written 06.09.2026 (arched-casement-v2 night 4, spec §4 F). `src/3d/` is shared with PSW
`3d-src` byte-for-byte; night 4 rewrote the arched casement component on `arch.js`, so the
three files below have to be copied to PSW after Piotr's review or the two viewers drift.

## 1. Files to copy (PC → PSW `3d-src/src/`)

| PC path | PSW path | Note |
|---|---|---|
| `src/3d/components/casement/ArchedCasementWindow.jsx` | `components/casement/ArchedCasementWindow.jsx` | rewritten (F) |
| `src/3d/components/casement/archedCasementGeometry.js` | `components/casement/archedCasementGeometry.js` | new, pure (no React / THREE) |
| `src/engine/arch.js` | `engine/arch.js` (new folder) | pure, no imports; the geometry helper imports it as `../../../engine/arch.js` — keep the same relative depth or fix the one import line |

`src/3d/App.jsx` also changed (five new `update3D` keys, see §3). PSW's own App reads its
configurator state, so port the five props the way PSW wires the others — the diff is small
(`git diff 5ba3661 -- src/3d/App.jsx`).

Nothing else in `src/3d/` changed. `FixFrameWindow.jsx` is untouched (the arched leaf no longer
delegates to it; the fix-frame shapes stay as they are in PSW).

## 2. Props of `ArchedCasementWindow`

Kept (PSW names, same meaning): `width`, `height`, `archShape`, `hingeDirection`, `opening`,
`hBars`, `vBars`, `woodColor*`, `sameColor`, `spacerColor`, `glassFinish`, `showGuides`,
`brightness`, `ironmongery`, `sealColour`, `sillExtension`, `sillWider`, `fixSemiBarPattern`,
`fixGothicBars`.

`archShape` accepts BOTH vocabularies:

| PSW | PC | rise when `archRise` is absent |
|---|---|---|
| `semi-circle` | `semi-circle` | W/2 |
| `segmental-arch` | `three-centre` (rise 0.20 W) | 0.20 W — drawn as a three-centre now, not a single segment |
| `elliptical-arch` | `three-centre` (rise 0.325 W) | 0.325 W — three-centre basket handle, not an ellipse |
| `gothic-arch` | `gothic-equilateral` | 0.866 W |
| — | `gothic-drop` | profile ratio (drop 0.70 W, shallow 0.60 W) |

New props:

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `archRise` | mm | `null` | the typed rise (PC "Arch starts at" → `H − start`). Absent → the ratio above, so a PSW copy without it behaves like today's PSW defaults. A Round rise resolves to semi-circle (= W/2) or three-centre; an impossible rise (above W/2) falls back to the ratio |
| `archProfile` | `'equilateral' \| 'drop' \| 'shallow' \| null` | `null` | gothic profile; sets the shape (`gothic-equilateral` / `gothic-drop`) and the default rise |
| `barPattern` | PC pattern name | `null` | `none \| half-hub \| hub-spoke \| double-hub-spoke \| triple-hub-spoke \| intersecting`. `null` → derived from `fixSemiBarPattern` / `fixGothicBars` (PSW props); PSW `patternA` has no PC counterpart and draws no pattern |
| `archMinHaunchRadius` | mm | `0` | PC profile `arch.minHaunchRadius` (150): the smallest haunch radius of a three-centre arch (P3). PSW may pass 150 to match production, or leave 0 (pure r = rise²/halfW rule) |
| `archPatterns` | object | `null` | PC profile `arch.patterns` (`{ hubRingRatios, intersecting: { pitch, minMullions, maxMullions, minRadius } }`). `null` → the PSW literals (0.3 / 0.6 / 0.8, 450, 2..4, 30) |

## 3. `update3D` keys (PC configurator → 3D App)

`casArchShape` (now a PC name — the component accepts it), `casArchHinge`, `archRise`,
`archProfile`, `barPattern`, `archMinHaunchRadius`, `archPatterns`. `windowSpecToConfig.js`
emits the same keys for the detail-page viewers.

## 4. What changes visually (PSW users)

1. **Rule C** — every arch starts vertical at the jambs; the head band is the frame face wide
   at the springing (the old semi-circle / gothic already did; segmental and elliptical did not).
2. **Segmental → three-centre** with rise 0.20 W: two small haunch arcs (r ≥ 150 when
   `archMinHaunchRadius` is passed) + a large crown arc instead of one flat segment.
3. **Elliptical → three-centre** with rise 0.325 W: circular arcs, no ellipse.
4. **Frame / leaf / glass rings are concentric** (`arch.js offsetArcs`): the leaf top rail is a
   true ring (40 in from the frame outer, 64 face), the rebate step and the gasket follow the same
   centres — no centroid-inset polygons.
5. **Rise follows the input** (`archRise`), not a fixed ratio; the frame is still forced to at
   least `rise + 50` high (PSW rule kept).
6. **Bars**: straight bars (h / v, hub ring-end verticals, intersecting mullions) are the
   profiled trapezoid / ovolo bars; rings and tracery are layered strips along the exact arc — the
   PSW `intersectingData` / `buildRingLayers` approach, reused. Spoke insets (0.6 / 0.4 bar
   widths) kept. Hub patterns ignore `vBars` (PSW rule, PC BLOCKERS 9.6).
7. **Contour beads** on the leaf: chamfer (ext) + ovolo (int) as layered strips offset
   concentrically (32 layers each instead of 64).

## 5. Checks after the copy

- `node verify/arch/t19.mjs` in PC (section 3D) — the geometry helper on every shape + PSW names.
- In PSW: open an arched casement with each of the four PSW shapes and no `archRise` — the
  frame outline extents must equal W × H (the helper asserts this in t19), the gasket must sit
  inside the rebate, the leaf must swing on `opening`.

---

## 6. Arched SASH (ARCHED-WINDOWS-v3 Block 1 I, 07.09.2026)

PC ported PSW's `ArchedSashWindow.jsx` and rebuilt its outline on `arch.js`. Files to copy back
(PC → PSW `3d-src/src/`) after Piotr's review:

| PC path | PSW path | Note |
|---|---|---|
| `src/3d/components/ArchedSashWindow.jsx` | `components/ArchedSashWindow.jsx` | PSW file as the base; `ArchedSashWindowOuter` default export resolves the shape name and passes `pcShape`; `arcPtsPC` / `shapeContourPC` / `apexRisePC` replace the radial sampler for the frame head, the sash outline and the apex rise (PSW's sampler kept as the fallback) |
| `src/3d/components/archedSashGeometry.js` | `components/archedSashGeometry.js` | new, pure: `PC_TO_PSW_SHAPE`, `resolvePcShape`, `engineArcs` (`archArcs` + `offsetArcs` → constant band), `engineArcPoints`, `engineApexRise`, `chainTo3D`; imports `../../engine/arch.js` |
| `src/3d/components/ParametricSashWindow.jsx` | `components/ParametricSashWindow.jsx` | PSW's named-export block appended (PSW already has it — diff should be empty there) |
| `src/3d/components/fix-frame/FixFrameWindow.jsx` | `components/fix-frame/FixFrameWindow.jsx` | PSW's named-export block appended (same) |

### Props (PSW names kept)

`width`, `height`, `archShape` (PSW id or PC name — both resolve), `archProfile`, `archBarPattern`,
`archHBars`, `archVBars`, `lowerHBars`, colours / glass / ironmongery as the rectangular sash.
New: `archRise` (mm, `null` → PSW ratio) and `archMinHaunchRadius` (mm, `0` → pure rule, PC passes
the profile's 150).

### `update3D` / `windowSpecToConfig` keys

`sashType: 'arched'`, `archShape`, `archRise`, `archProfile`, `barPattern`, `archHBars`,
`archVBars`, `lowerHBars`, `archMinHaunchRadius`. `App.jsx` renders `<ArchedSashWindow>` when
`config.sashType === 'arched'` (before the plain `ParametricSashWindow`).

### What changes visually

1. Rule C — the head ring starts vertical at the pulley stiles; the band is `HEAD_FACE` 80 wide
   everywhere (concentric offset, not a radial inset).
2. Segmental / elliptical draw as three-centre arches (two haunch arcs + crown), rise from
   `archRise` when given.
3. The upper sash top rail is a true ring at the stile line (constant `SASH_ARCH_FACE` band).
4. Bars still come from PSW's `useArchedSashBars` (pattern by name) — see PC BLOCKERS 13.2.

### Checks after the copy

`node verify/arch/t22.mjs` §5 in PC (helper on every shape, fallback, names). In PSW: open an arched
sash with each radio shape and no `archRise` — extents W × H, head band constant, sash swings.

---

## 7. FIXED windows, the circle, doors (ARCHED-WINDOWS-v3 Block 3 / Block 4, 07.09.2026)

**Fixed rectangle** — no 3D change: `CasementWindow` with `casementHinges ['fixed']` draws its
own fixed pane (no handle). PC's `windowSpecToConfig` forces layout `040L` + `['fixed']` for
`casement.kind 'fixed'`.

**Fixed Round / Gothic** — `ArchedCasementWindow` gained one prop:

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `fixedLeaf` | boolean | `false` | fixed window: the handle is not drawn and `opening` is forced to 0 |

`App.jsx` passes `fixedLeaf={!!config.fixedLeaf}` and `opening={config.fixedLeaf ? 0 : …}` in
the arched casement branch. PSW's fix-only arch shapes could use the same component with this
prop instead of `FixFrameWindow`'s own arch branches (concentric rings, rule C) — a PSW decision.

**Circle** — PC routes a circle fixed window to PSW's `FixFrameWindow` circle branch
(`windowCategory 'fix-only'`, `fixShape 'circle'`, `fixCircleBarPattern`, `fixCircleBarOffset`,
`casementHBars` / `casementVBars`). PC's copy of `FixFrameWindow.jsx` is byte-identical to PSW's
apart from the named-export block at its end (§6) — nothing to port. Note the engine's circle
(`arch.js buildCircleGeometry`) puts the leaf ring at 40 / 107 and the glass at 94.5 in from the
frame outer; `FixFrameWindow` draws a single 57 frame ring with the glass behind it (no leaf
ring) — the viewer and the cut list differ by design here (PSW's product has no leaf).

**Doors** — untouched in v3 (Piotr 07.09: doors, sliding, bifold, front door out of scope). No
PSW door 3D file changed.

## 8. Intersecting from the vertical bars (ARCHED-WINDOWS-v4 Block E, 06.09.2026)

**Rule (one engine, casement / sash / fixed):** the user's vertical bars run to the springing line
and every bar top spawns two tracery arcs (left- and right-curving) with the arch's own radius —
the glass outline's arc radius (semi-circle: the clear half width; gothic: the concentric radius
of the outline arcs) — centred on the springing line on the opposite side (`cx = x_bar − dir·R`),
clipped where they meet the outline; 0 vertical bars → two default columns at ±¼ of the clear
width; no springing bar. This is PSW's SASH rule (`ArchedSashWindow.jsx` 915–940, `useArchedSashBars`);
PSW's fix-frame `intersectingData` (pitch mullions, arcs centred on the frame corners) is no longer
what the casement 3D shows.

**PC 3D change:** `casement/archedCasementGeometry.js` — `PSW_BAR_PATTERN_SETTINGS` lost its
`intersecting { pitch, minMullions, maxMullions, minRadius }` entry (the engine's `buildArchBars`
no longer reads it); `ArchedCasementWindow` draws the engine's bar list as before, so the arcs
follow automatically. `ArchedSashWindow.jsx` (PSW copy) is untouched — its own `isIntersecting`
branch already IS this rule, with one difference: PSW computes the gothic radius as
`gothicCentreOffset(halfW, rise) + halfW` on the daylight numbers (905.4 on W 1000), the engine
takes the exact concentric outline radius (905.5). Visually identical.

**PSW port:** `3d-src/src/components/fix-frame/FixFrameWindow.jsx` `intersectingData` (667–830) is
the old geometry for fix-only gothic / semi-circle products — replace it with the sash rule above
(columns from `casementVBars`, default ±¼, arcs `R` = outline radius) when PSW's fix-frame should
match PC's cut list / tracery; until then a fix-only window ordered from PSW draws different
tracery in PSW's viewer than PC produces.

## 9. Frame face 68 — `frameDims` prop (ARCHED-WINDOWS-v4 Block F, 06.09.2026)

PC's copies of `casement/CasementFrame.jsx`, `casement/CasementWindow.jsx`,
`casement/ArchedCasementWindow.jsx`, `door/DoorFrame.jsx`, `door/DoorWindow.jsx` and
`door/DoorSidePanel.jsx` take an optional `frameDims` prop `{ frameFace, extFace }` (extFace = the
visible land = face − rebate 21). The module constants `FRAME_FACE = 57` / `EXT_FACE = 36` stay as
the defaults (`resolveFrameDims(null)` → 57 / 36), so copying the files into PSW changes nothing
until PSW passes the prop. PC passes `{ 68, 47 }` for casements and `{ 68, 36 }` for doors from
the profiles (`windowSpecToConfig.js` `casementFrameDims()` / `doorFrameDims()`, the App's
`update3D({ frameDims })`). `CasementWindow` also hands `geo: { frameFace, bottomFace, mullionW }`
to `resolveCasementLayout`, so the layout's mullion positions follow the face. Untouched:
`ArchedDoorWindow.jsx` and `TransomPanel.jsx` (not rendered by PC — arched doors and door transom
panels are out of PC's scope), `FixFrameWindow.jsx` (PSW's own 64 frame). The full PSW-side list
of lines is in `PSW-FRAME-68-PORT.md`.
