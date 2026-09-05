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
