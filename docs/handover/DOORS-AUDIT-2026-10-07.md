# Production Core: DOORS audit (07.10.2026, main @ 7a333d8)

Technical appendix for the doors tura. Read-only audit of the repo plus engine runs in Node. Nothing was changed. File paths are relative to `src/` unless stated. "run" = observed by deriving a sample door with the live engine.

## 0. Sample doors used (run)

| Door | Engine today |
|---|---|
| single 900 x 2100, standard threshold | leaf 806 x 2006; stiles 94x61 L2006, top rail 94x61 L806, bottom rail 180x61 L806; frame 68x93 (head 900, jambs 2100, cill 900); glass 641 x 1755, makeup 6x16x6, thickness 28; paint primer 2.52 L, topcoat 1.26 L; weights 0; beading none; hardware none |
| french 1600 x 2100, standard threshold | clear 1506; each leaf 756 x 2006 (overlap 6 total, +3 per leaf); meeting stiles 94; glass 2 x 591 x 1755; paint primer 4.48 L, topcoat 2.24 L |

## 1. Engine (`engine/calculations.js` deriveDoorWindow 1201-1426, `engine/profile.js` DEFAULT_DOOR_PROFILE)

1. Outputs frame (head, jambs, cill, coupling post, transom rail), leaf members, side panel members and glass units only. `beading: []` (1413), `weights: { total: 0 }` (1416), consumables = glass m2 only (1418-1423), no hardware picks.
2. Ignores spec fields: `style`, `paneling`, `bars`, `barType`, `lockType`, `shape`, `thresholdExtension`, `sidePanels.style`, side bars, `transom.bars`, `centerMullion`. `leafMid` (profile 628) and `midRailDeduct` (683) exist and are unused.
3. French meeting: `leafW = (clearW + 6) / 2` (1280-1281), meeting stiles 94. Owner rule (07.10.2026): each leaf = half + 6, meeting stile 94 + 6 lip; see the chat decision.
4. Threshold: `standard` = timber cill; `aluminium` and `low-profile` give identical output: no bottom member, leaf = H - 53 (1229-1231, 1278, 1311). No threshold product, no dependence on its height.
5. `thresholdExtension` (door form) never reaches the engine; the cill length adds `cill.extension` / `cill.wider` instead (1232-1233, 1315), which the door form does not offer.
6. Opening fanlight: glass sized as fixed, no 64 sash timber, label "(opening, 64 sash pending)" printed in the glass schedule (1380).
7. The engine builds a transom on a single door whenever `transom.type` is set; only the configurator forces none for single (spec comment 455 is stale).
8. Door glass constants (`engine/specification.js` 60-66): `DOOR_GLASS_MAKEUP { double: '6x16x6', triple: '4x8x4x8x4' }`, `DOOR_GLASS_THICKNESS 28`, `DOOR_LEAF_DEPTH 61`. Owner (07.10.2026): standard door unit 24 mm, 6x12x6. The leaf depth 61 and frame rebate 25 were chosen FOR the 28 mm unit (comment 60-62; profile "rebate 4mm deeper"); with 24 mm the casement values (leaf 57, rebate 21, land 47, leafAtJamb 51) become possible again. Owner decision needed.
9. `double_slim` is selectable for a door and silently becomes 6x16x6 on the double_slim BOM row; `acoustic` spec changes nothing for doors.
10. Paint uses `calculatePaint(totalWidth, totalHeight)` (448-460, 1417): overall rectangle incl. panels and transom, sash formula.
11. No stored door profile: `setActiveDoorProfile` has no caller (profile 695); `withProfiles` takes sash and casement only, so no batch snapshot for doors; Window Settings sidebar says "Doors, soon" (`components/layout/AppSidebar.jsx` 228).
12. Stale comments: calculations 1177-1180 (two 57 jambs), 1187-1192 (2 x 563, post 114, 72 / 93); profile 639-641; `docs/handover/PSW-3D-ARCH-PORT.md` 183 and `PSW-FRAME-68-PORT.md` (door land 36).

## 2. Materials, BOM, pre-cut (`engine/bom.js`, `engine/lists.js`, `stores/materialAssignmentStore.js`, `pages/MaterialAssignmentsPage.jsx`)

1. `ELEMENT_TO_PART_ID` has no `D-` key (bom 48-65, 94-116). All 13 door element names are unmapped: D-FRAME HEAD, D-FRAME JAMB (L), D-FRAME JAMB (R), D-COUPLING POST, D-FRAME CILL, D-TRANSOM, D-STILE (L), D-STILE (R), D-TOP RAIL, D-BOTTOM RAIL, D-SIDE STILE, D-SIDE TOP RAIL, D-SIDE BOTTOM RAIL. `addMm` returns silently on an unknown id, so door timber never reaches the BOM (run).
2. Rows a door feeds today (run): glass on the WINDOW glass type row (`glass_double`, labelled 4-16-4), paint on the SASH rows (`paint_primer`, `paint_preserver`, `paint_white_9016` / `paint_bespoke`), custom consumables. Nothing else.
3. Hardware: `bom.js` 358 `return []; // door hardware later`, `lists.js` 534. The five door slots in `stores/ironmongeryStore.js` 37-41 (doorHandles, doorHinges, multipointLocks, thresholds, bolts) plus Trickle Vents can be picked in the configurator and are saved to `windowSpec.hardware.slots`, but nothing counts them. `HARDWARE_TO_SLOT_KEY` has no door entries. `door.lockType` single / double is stored only.
4. Assign Materials page: route `/materials/assignments/doors` exists and shows "coming soon" (MaterialAssignmentsPage 551-567). `ALL_PARTS` (store 193-201) is sash + casement only; `buildWindowMaterialLines` walks only this list, so door ids must be appended there. Casement pattern to copy: flat part lists with static section labels; hinge and lock rows generated from an engine catalogue (`engine/casementHardware.js`).
5. Pre-cut (`lists.js` 209-290, run): leaf members group by finished section as raw (`94x61`, `180x61`); side panel 57x57 becomes `63x63` only via the sash sectionMap; frame members do not start with `C-` so they take the sash box branch (272-283) which never calls `resolveRaw`: even after mapping, the door frame would ignore the assigned material unless line 257 is widened to `D-`.
6. Pre-cut symbols collide (`engine/partSymbols.js` 142-148): DFRA for head, jamb and cill; DSID for all side panel members. No colour group for doors (`engine/partColours.js` 13-14). Jamb with a transom can exceed the 3700 box stock; the optimiser has no over-length guard (`engine/optimizer.js` 128-158).
7. Cut list grouping works (D-codes in `lists.js` 643-656); on a french door the four stiles merge into one row x4 and the hinge / meeting notes are dropped.
8. Tests: `verify/parity/t37_single_window_bom.mjs` pins "doors have zero hardware" (168, 347); `t34`, `t38`, `t27`, `t29` derive doors as controls. No test pins door timber rows, hardware, style or bars.
9. Ironmongery catalogue defect (all types): `services/cloudSync.js` 449-468 does not save `unit` or `subcategory`.

## 3. Drawings and exports

### Sheets (`components/drawings/`)
1. `DrawingsPanel.jsx` 41-47, 154-165: door tabs Front Elevation / Frame / Leaf / Sections. `DoorSection2D.jsx` is a placeholder card ("Not drawn yet"). No uploaded-sections fallback for doors (132-140 is casement only). One Leaf tab only: side panel leaves and fanlight have no sheet.
2. `DoorElevation2D.jsx`: handles french, side panels, transom, inward. Bugs: side panel bars read `d.sideBars` (110) which does not exist (spec: `sidePanels.barsH/barsV`); handle dimension runs to the frame bottom but is labelled 1000 (155, 204-205); opening symbol apex at the closing edge, casement puts it at the hinge; for 3/4 and half-glazed the mid rail is drawn over full-height glass. Hardcoded: handle 1000, hinge barrel 102 x 10, spacing 200 / 100 / 150 and the 4th hinge above leaf 2100, bar width 22, bolts 16 x 90, text "3 clearance", side member `|| 57`. Header comment still says post 114 and 72 / 93.
3. `DoorFrameDetail2D.jsx`: bugs: layer chain `[X(0), X(g.land), X(doorX)]` (198-199) prints "43 / -43" on every door without a left panel; "head 68" / "jamb 68" label a 43 span (182-185); cill dimension uses `fh` instead of `frameH` so it sits a transom height too high (188-189). "40 to 35 fall" hardcoded text (162). Unused vars 39-41, 59. Comment 129 says 114.
4. `DoorLeafDetail2D.jsx`: one leaf, french titled "x2 (mirrored pair)", no meeting rebate detail, no bolts, no glass size, no handle / lock position; `glassInset` read and unused (80); second copy of the hinge rule (21-29). Draws rails BETWEEN the stiles while the cut list gives rails the full leaf width (every `lengths.*Deduct` is 0) and the 3D says "rails full width, stiles between": the joint convention is undefined. Mid rail at 0.75 / 0.5 of the leaf has no D-code.
5. No door glass drawing (`casementDrawUtils.js` groupCasementGlass needs `derived.casement`).

### Window page (`pages/WindowDetailPage.jsx`)
6. Glass tab draws the SASH `GlassDrawing2D` as Upper / Lower for a door (445-455); single door: lower card NaN viewBox and "NaN mm"; units beyond the second get nothing. Bars column always a dash for doors (274-282).
7. Right-hand spec panel is sash only: "Calculated: Sash W / Top H / Bot H" prints "undefined mm" (259-264). Depth row shows the sash box depth (164) because the configurator saves `frameDepth` from the sash profile (`pages/ConfiguratorPage.jsx` 587, 786; spec 340-342 prefers it over 93).
8. Hidden for doors: CNC Jamb DXF, Arch DXF, Tracery DXF, bSuite, Glass DXF, Glass Drawings PDF. BOM tab shows "Fixed window, no hardware" (628-629).

### Exports (`utils/`)
9. Elevation PDF on a door exports the SASH elevation: the capture rig mounts `isCasement ? CasementElevation2D : FrontElevation2D` (DrawingsPanel 194-198), 14 NaN attributes on door data (run). The rig never mounts the door sheets (212-222 mounts BoxDetail2D and SashDetail2D).
10. Elements PDF on a door saves a sheet with a header and no drawings: `elementsPayload.js` 66-71 `supported:false`, yet one page is emitted (`drawingsPdfExport.js` 193-195); the button is not disabled.
11. `glassPdfExport.js`: door units print as plain rectangles; bars never reach the glass order for doors (570-586). `glassDxfExport.js` 411-412 refuses doors. `cncExport.js`, `bsuiteExport.js` sash / casement only (expected).

### Production pack (`pages/ProductionPackPage.jsx`)
12. Elevations and Elements tabs: door card says "engine pending" and is skipped in the PDF (858-860, 896-899, 1054-1057, 1099-1103).
13. Glass tab draws sash Upper / Lower for doors (1398-1428); "Glass DXF (all)" returns "No glass units" for a door pack (463-483).
14. Spraying list shows a door as "Box", "Upper Sash 0 x 0", "Lower Sash 0 x 0" (2193-2210), no beading rows.
15. Overview, its PDF and the Book use sash columns: Type "double", Bars "none", Opening "both" (152-156, 649-656, 740-747).
16. Pre-Cut shows "Engineering Wood 94x61 / 180x61" and "Box 68 x 93" with no material (1495-1529). 3D Views and Cut List work.

## 4. 3D (`3d/components/door/`)

1. Only `frameDims` {face 68, land 43} come from the profile (`utils/windowSpecToConfig.js` 298-301). Everything else is PSW geometry: rebate 21 (`DoorFrame.jsx` 17, `DoorPanel.jsx` 922), leaf 93 / 93 / 185 x 57 (`DoorPanel.jsx` 21-26), glass unit 24 (`DoorGlazing.jsx` 16), leaf = W - 102, H - 102 whatever the threshold (`DoorWindow.jsx` 505-506, 815-816).
2. French: no rebate modelled; each leaf is 17 past the centre, overlap 34, band 152 (`DoorWindow.jsx` 72-80, 815, 826). Both leaves carry handles. Active leaf is the OPPOSITE one to the engine and the 2D (`DoorWindow.jsx` 838 vs calculations 1286-1291).
3. Head land 47 (`DoorFrame.jsx` 241-242), right jamb strip 21-64 (291): both from the casement 21 rebate.
4. Side panel: two complete abutting frames (68 + 68) instead of one 136 post; panel rails fall back to 93 / 185 instead of 57 (`DoorSidePanel.jsx` 88-119).
5. Threshold: `BottomRail` never rendered; threshold 40 high with a 7 degree fall drawn for both directions; jambs start 40 above the bottom; the leaf never grows for aluminium / low-profile (`DoorFrame.jsx` 37-41, 135-232, 284-287, 584-586). `thresholdExtension` shows in 3D only (`DoorFrame.jsx` 141-143, `DoorWindow.jsx` 984-1010).
6. Hinges: barrel 10 x 100, 4th when FRAME height > 2400 (`DoorWindow.jsx` 1078-1113); 2D: 102 tall, 4th when LEAF height > 2100.
7. Styles: 3D half-glazed = bottom rail H/2, three-quarter = H/3 (`DoorPanel.jsx` 174-177), paneling raised-and-fielded / beading / flat; engine nothing; 2D a 94 mid rail at 50 % / 75 %. Three different doors.
8. Fanlight: 3D always a 64 sash, fixed and opening (`DoorWindow.jsx` 513, 638-682); engine direct glazing.
9. `TransomPanel.jsx` imported and never rendered; `ArchedDoorWindow.jsx` imported nowhere (both still 57 / 36). Arched door not supported anywhere; configurator offers only "Standard".
10. Previews never pass `ironmongery`, so handles are always brass / chrome regardless of finish.

## 5. Configurator and spec (`pages/ConfiguratorPage.jsx`, `engine/specification.js` 416-461)

1. Paneling resets to Flat on edit or copy: saved as `doorPaneling` (817) but prefilled from `w.paneling` (374).
2. Door frame depth saved as 164 (sash box depth) at 587 and 786.
3. `transomType` offered for french only in the UI (822, 1167); `centerMullion` hard-coded false (664, 817).
4. Glass chips for doors: double / double_slim / triple (1201-1202); spec toughened / laminated / acoustic; gas fixed Argon.
5. Door size limits are a warning, not a clamp (89-92, 1129-1133).
6. Trickle vents slot and "Trickle vents: 2" show for doors (1189-1196) with no BOM line.

## 6. Recorded open items touching doors

- BLOCKERS 23.3 / 19.3: live re-derive vs profile snapshot. 23.4: no stored door profile. 23.5 / 19.9: side panel never checked in the viewer. 23.6: pricing / BOM spot-check. 19.7: 68 x 93 raw material must exist in Part Registry. 19.10: ArchedDoorWindow / TransomPanel not threaded.
- `docs/handover/ARCHED-CASEMENT-v1.md` 444: door leaf 92 (material 014) pending; code 94, 3D 93.
- Project doc handover 05.10 section 9.2: door timber and hardware have no Assign Materials rows (this audit confirms).
- Scope decided 07.09: front door, sliding, bifold and arched doors are out.
