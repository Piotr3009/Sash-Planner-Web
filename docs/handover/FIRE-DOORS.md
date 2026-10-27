<!--
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
-->

# Fire doors: internal door sets as built (v1 27.10.2026, v1.1 the same evening)

**v1.1 (27.10.2026 evening, branch `claude/fire-doors-v1-1`, owner decisions in the chat after the v1 merge):**
the STRUCTURAL OPENING is the size input (frame = opening - 5 a side / - 5 at the head, leaf = frame - 76 / - 43;
1000 x 2100 -> 990 x 2095 -> 914 x 2052; a typed leaf still overrides); NO swing (an internal door is handed by its
hinge side only); the middle hinge sits 200 ABOVE the leaf centre (2040: tops 150 / 769 / 1738); ONE intumescent
strip size 15 x 4 all around (groove 15.5 x 4; FD30 one strip, FD60 two; the macro style table and the 10 / 20
strips are gone); the closer is a KIND (none / surface / built in, CLOSER 0 / 1 / 2); the mitred corners are
DOWELLED 8 x 40, 3 per corner, bored square to the mitre face (on the frame sheet, in the CSV / JSON and the frame
rows as DOWEL_*). Every number is a profile key (`frame.wallGapSide / wallGapHead / dowels`,
`hinges.midAboveCentre`, `intumescent.*`, `defaults.closerFire / closerNonFire`). Items for Piotr: `BLOCKERS.md`
36.x. The sections below describe the v1 model with the v1.1 changes marked.

Owner input (Piotr, 27.10.2026 conversation; his bSolid leaf master `FD_LEAF_MASTER_PIOTR.bSolid` with the macro
`Master_Door_PIOTR`; the AutoCAD kits `KIT_DOOR_SINGLE.lsp` / `KIT_DOOR_DOUBLE.lsp`; the old Weeke programs; every
number read from them is in `docs/handover/fire-doors/WORKSHOP-NOTES.md`): one PC type `firedoor` with a Fire
switch (FDR-nn fire doors FD30 / FD60, DR-nn non-fire doors), a bought leaf blank in a three-member frame rebated
from solid, frame timber 63 machined to 50 and as wide as the wall (100 to 200), hinges / lock / keep exactly as
the macro cuts them, four bSuite rows per door with the macro's own variable names and a STOP row between the
blocks, a machine neutral machining list for the 5-axis frame programmer, and everything the windows already get
(lists, purchasing, pre-cut, drawings, pack, price). Branch `claude/fire-doors-v1`. Items for Piotr:
`BLOCKERS.md` 35.x. The file list, the reference table and the verification: `BUILD-LOG.md` (27.10.2026).

## 1. The model in one page

Every number lives in `DEFAULT_FIREDOOR_PROFILE` (`src/engine/profile.js`, schema 1) and is editable in Window
Settings · Fire Doors. `deriveFireDoorWindow` (`src/engine/fireDoor.js`) is the only place that turns it into sizes,
positions, cut list records, machining ops and the bSuite variable table; the lists, BOM, pricing, sheets, 3D,
PDFs, the pack and both exports read `derived.firedoor`. A door set is a window record of the batch type
'firedoor' (`windowSpec.category 'firedoor'`, `windowSpec.firedoor { fire, rating, openingWidth, openingHeight,
leafWidth, leafHeight, hingeSide, frameDepth, lockType, closer, vpStyle, vpCustom, leadEdge }` (v1.1: no swing, no
intuStyle; `closer` a kind); the item stores the same values as `firedoor*` keys and its width / height = the
overall frame the engine derives.

**Structural opening (v1.1).** The user types the wall opening W x H (`firedoorOpeningWidth / Height`). Frame
overall = opening - 2 x `frame.wallGapSide` 5 wide and opening - `frame.wallGapHead` 5 high (the frame foot
stands on the floor); the leaf = overall - 76 / - 43 (below). A typed leaf (`firedoorLeafWidth / Height` > 0) wins
on its axis and the opening is reported from it; nothing typed = the profile's default leaf 826 x 2040 (opening
912 x 2088). `derived.firedoor.opening { width, height, wallGapSide, wallGapHead, source 'opening' | 'leaf' |
'default' | 'mixed' }`; helpers `fireDoorSizeRule`, `fireDoorOpeningForLeaf`, `fireDoorLeafForOpening` give the
form the same arithmetic. Example: 1000 x 2100 -> frame 990 x 2095 -> leaf 914 x 2052.

**Leaf.** One bought blank W x H x T; T = `leaf.thicknessByRating` (FD30 44, FD60 54, non-fire 44). The bSolid
board is LPX = H, LPY = W, LPZ = T (owner decision 09.10.2026). Width and height are NEVER clamped: only the hard
sanity limits `leaf.limits` (width 300 to 1500, height 1500 to 3000, depth 50 to 400) fail that ONE door with a
message on its card (`FireDoorGeometryError` with `.details`, the LEAF value even when the opening was typed); the
page never blanks.

**Frame section.** Raw 63 x (depth + 5) (`frame.rawThickness`, `frame.rawWidthAllowance`), finished 50 x depth
(`frame.thickness`; depth = the finished wall thickness, `frameDepth`). The rebate is milled from solid on every
member: width = overlap 12 + gapSide 3 = 15 across the 50 (`frame.overlap`, `frame.gapSide`); depth = T +
rebateClearance 3 = 47 along the depth (57 on FD60). The frame shows 35 on the outside (50 - 15, the pull / stop
side) and 50 on the inside, as the LSP draws it.

**Overall frame.** Width = W + 2 x (gapSide 3 + 35) = W + 76; height = floorGap 5 + H + gapHead 3 + 35 = H + 43
(the `KIT_DOOR_SINGLE.lsp` formulas). FD-HEAD = the overall width at the long points, both ends mitred 45; FD-JAMB-H
(hinge jamb) and FD-JAMB-L (lock jamb) = the overall height at the long point, top mitred 45, bottom square on the
floor (`frame.headJoint 'mitre'` is the only value implemented; any other fails the door with a message).

**Corner dowels (v1.1).** Each mitred corner takes `frame.dowels.perJoint` 3 dowels `dia` 8 x `length` 40, bored
square to the mitre face (45 to the member axis), half the length (20) into each piece, on the centre of the 50
thickness, spread along the frame depth `margin` 20 in from each face (depth 100: 20 / 50 / 80). Ops `dowelBore`
on face `mitre` (x y z = the bore centre, angle 45) on every mitred end; 6 dowels per door in the order; the frame
rows carry DOWEL_N / DOWEL_D / DOWEL_L / DOWEL_DEPTH / DOWEL_1..n. `perJoint 0` switches them off.

**Hinges (v1.1, the owner's rule).** From the leaf TOP to the hinge top edge: the top hinge at `hinges.topOffset`
150; the bottom hinge ends `hinges.bottomOffset` 200 above the leaf bottom (top edge = H - 200 - 102); with three
hinges the middle one has its CENTRE `hinges.midAboveCentre` 200 above the leaf centre (top edge = H / 2 - 200 -
51; 2040: 150 / 769 / 1738; 2052: 150 / 775 / 1750); with more than three the inner ones spread equally. The old
equal spacing (the macro's `(lpx - 150 - 200 - w) / (repn - 1)`, 794 on 2040) is kept as `hinges.step` for the
sheets only. Recess 103 x 30 x 3 with R6 corners (`hinges.recessLength / recessWidth / recessDepth /
cornerRadius`, plate + 1, the 12 cutter) on the hinge edge from the pull face. On the hinge jamb the same recesses
at the same heights shifted by the head: jambTop_i = (50 - 15) + gapHead 3 + top_i from the jamb top long point
(2040: 188 / 807 / 1776). Macro HINGE 1 fire / 0 standard; the positions go out as HINGE_1..3.

**Lock (the DIN lock from Petros).** Spindle 1000 above the leaf bottom (`lock.spindleHeight`, the macro LOCK_H),
backset 60 from the lock edge; forend 235 x 24 milled 236 x 25 (full radius ends, R12.5), 4 deep, its centre 15
below the spindle (`lock.forendCentreBelowSpindle`, from the macro `lock_h - 15`); case 85 deep x 150 high in a
pocket 17 wide x 87 deep x 153 high on the lock edge centred on T / 2, its top 46.5 above the spindle
(`lock.caseTopAboveSpindle`, from `lock_h + 46.5`); the spindle hole through both faces at 1000 / backset 60; the
euro hole 72 under the spindle (`lock.euroCentres`) or the bathroom hole 78 under it (`lock.bathroomCentres`); a
latch has no second hole. Macro LOCK 1 standard / 2 FD30 / 3 FD60, EURO 1 only on 'euro', SPINDLE 1.

**Keep (on the lock jamb).** Plate 175 x 39 milled 176 x 40, 3 deep (`keep.plateDepth`), one pocket 120 x 18 x 15
behind it for the latch and the bolt (`keep.pocket`), both centred floorGap 5 + 1000 - 15 = 990 above the jamb foot
(the forend centre mapped onto the jamb). The lock jamb row carries KEEP 1 / 2 / 3 (as LOCK), KEEP_STYLE 1 and
KEEP_Y 990; the leaf row writes KEEP 0 / KEEP_STYLE 0 (the keep of a single door is in the frame).

**Vision panel.** The macro VP_STYLE table 1:1 (`vp.styles`, ids 0 and 1 to 14, there is no 3; 14 = Custom with
`vpCustom { length, width, count, rail, pos }`). The macro's own placement is NOT decoded: PC places the panes
centred across the leaf with the first pane top at `vp.topRail` 150, the A/B pair styles (2, 12) `vp.midRail` 450
apart, the nNo styles (6, 7, 8, 13) `vp.stackGap` 100 apart, a pane turned 90 when the stack does not fit the leaf
height, the diamond (5) a square turned 45; every sheet and every unit note says "layout per bSolid macro"; the
export sends only VP_STYLE and the C_VP_* values and the macro places the cut. Per pane: glass m2, beads = perimeter
x `vp.beadFaces` 2, glazing intumescent = perimeter (fire only); glass 6 thick (`vp.glassThickness`), fire glass on a
fire door, toughened otherwise; one Glass Schedule row per pane.

**Intumescent (v1.1, fire only).** ONE strip size, `intumescent.width` 15 x `thickness` 4, all around (top,
hinge and lock edges); the groove `grooveWidth` 15.5 x `grooveDepth` 4 (two passes of the 10 disk); strips by
rating `stripsByRating` FD30 1 / FD60 2 (two strips at T / 2 +- `twoStripOffset` 11: 16 and 38 on the 54 leaf);
metres = strips x (2 x H + W) / 1000 (826 x 2040: 4.906 m FD30, 9.812 m FD60). The leaf row writes INTU (the
strip count 0 / 1 / 2), INTU_W 15, INTU_T 4 and, for the Master_Door macro, INTU_STYLE = `macroStyleByStrips`
(1 strip = style 1, 2 strips = style 4). Fire OFF: INTU 0, no strip row, no grooves. The v1 style table and the
10 / 20 strips are gone (a stored profile loses them in the migration).

**Closer (v1.1).** A kind: 'none' / 'surface' (overhead, the standard fire door set) / 'builtin' (concealed in
the leaf top and the head). Defaults `defaults.closerFire` 'surface' on a fire door, `defaults.closerNonFire`
'none' on a DR door, until the user picks one (a v1 boolean true reads as 'builtin'). `derived.firedoor.closer`
= null or `{ type, label, machined false }`; a hardware line and a slot per kind, CLOSER 0 / 1 / 2 in the leaf row,
one price rate for any closer; the built in closer is NOT machined until the owner's component files arrive
(BLOCKERS 36).

**Numbering.** `nextFireDoorName(existingNames, fire)`: the lowest free FDR-nn (fire) / DR-nn (non-fire), two digits,
counted per prefix over every window of every batch of the project; the configurator suggests it, the user may
overwrite it; the prefix follows the Fire switch on an unsaved door only, a saved door is never renamed.

**Handing (v1.1).** `hingeSide` 'left' / 'right' is seen from the PULL side (the side the hinge knuckles show,
which is the 35 frame face: the leaf sits against the stop and can only swing out of the rebate towards the 35
face) and is printed "Hinge left / Hinge right" (the PSW wording rule) on every sheet, list and page. There is no
swing: in / out belongs to external doors, an internal door is handed by its hinge side only (the outside
elevation is the pull side, the inside elevation the 50 face, the plan opens the leaf out of the rebate).

The reference doors, every row from the live engine with the default profile and asserted by
`verify/parity/t51_fire_door.mjs` (v1.1 numbers):

| | FD30, leaf 826 x 2040 (nothing typed = the default leaf; opening 912 x 2088), depth 100, hinge left, latch | rule |
|---|---|---|
| leaf | 826 x 2040 x 44, the blank the same (allowance 0) | `leaf.thicknessByRating.FD30` |
| frame overall | 902 x 2083; opening 912 x 2088 reported | W + 76, H + 43; + 5 a side / + 5 head |
| members | FD-HEAD 902 (mitre / mitre), FD-JAMB-H 2083 and FD-JAMB-L 2083 (mitre / square) | long points |
| section | raw 63x105, finished 50x100, rebate 15 x 47, faces 35 / 50 | 63 x (100 + 5); 12 + 3; 44 + 3 |
| dowels | 3 per corner, 8 x 40, 20 deep, at 20 / 50 / 80 along the depth, y 25; 6 per door | `frame.dowels` |
| hinges | tops 150 / 769 / 1738 from the leaf top (bottoms 252 / 871 / 1840, centres 201 / 820 / 1789) | 150; H / 2 - 200 - 51; H - 200 - 102 |
| jamb recesses | tops 188 / 807 / 1776 from the jamb top long point | 35 + 3 + top_i |
| lock | spindle 1000 from the bottom (1040 from the top), forend centre 985, case top 1046.5; LOCK 2 | |
| keep | centre 990 above the jamb foot (1093 from the jamb top); KEEP 2, KEEP_STYLE 1, KEEP_Y 990 | 5 + 1000 - 15 |
| intumescent | 1 x 15 x 4 all around, 4.906 m, groove 15.5 x 4 on z 14.3; INTU 1, INTU_STYLE 1 | 1 x (2 x 2040 + 826) / 1000 |
| closer | surface (the fire default): CLOSER 1 | `defaults.closerFire` |
| paint | 3.8 m2: 5.07 L primer, 2.53 L topcoat | leaf both faces + (35 + 50) x the three lengths |
| **opening 1000 x 2100** | frame 990 x 2095, leaf 914 x 2052; hinges 150 / 775 / 1750; spindle 1052 from the top; LPX 2052 LPY 914, head 990, jambs 2095 | the owner's example |
| opening 1000 x 2100 + leaf 826 typed | leaf 826 x 2052, frame 902 x 2095, opening reported 912 x 2100 (source mixed) | the leaf wins on its axis |
| FD60 | leaf 54, rebate 15 x 57, REB_D 57, LOCK 3, KEEP 3; 2 x 15 x 4, 9.812 m, grooves at z 8.3 and 30.3 (16 / 38 +- 7.75); INTU 2, INTU_STYLE 4 | `leaf.thicknessByRating.FD60`, T / 2 +- 11 |
| non-fire DR | HINGE 0, LOCK 1, KEEP 1, INTU 0, no intumescent, no closer, toughened glass | |
| leaf 762 x 1981 | overall 838 x 2024 (opening 848 x 2029); hinges 150 / 739.5 / 1679; jamb 188 / 777.5 / 1717 | |
| euro, VP style 1, hinge right | cylinder 928 from the bottom (bore 18), EURO 1, HAND 1 / RH 1; pane 450 x 450 at x 150, y 188; 0.203 m2, beads 3.6 m, glazing intumescent 1.8 m | |
| bathroom | hole 922 from the bottom (bore 10) | |
| closer kinds | none CLOSER 0 (no row), surface CLOSER 1, built in CLOSER 2 (a v1 boolean true = built in) | |
| free width 803 | overall 879 x 2083, no clamp; width 200 fails that door: "leaf width 200 is outside 300 to 1500"; an opening 350 fails on the leaf 264 | `leaf.limits` |

## 2. Where it lives

- Profile, migration, snapshot: `engine/profile.js` (`DEFAULT_FIREDOOR_PROFILE`, `migrateFireDoorProfile` block by
  block, `migrateFireDoorBsuite` keeping the uploaded `stored` programs and a target still called 'machine',
  `mergeStylesById` for the two style tables, `setActiveFireDoorProfile` / `getFireDoorProfile`,
  `withProfiles(sash, casement, door, partition, firedoor, fn)` with every older call form kept),
  `stores/windowProfileStore.js` (the 'firedoor' kind, `FIREDOOR_PATH_ROOTS`, `setFireDoorPath`, `setFireDoorList`
  for the comma lists, `setFireDoorBsuiteTargets`, `resetFireDoorToDefaults`, the engine sync, the cloud merge),
  `stores/projectStore.js` (`BATCH_DEFAULTS.firedoor`: painted, stainless, single glass, no PAS24; the batch label
  'Fire doors'; `fireDoorItemFields` copied by name on add AND on update; the batch `_profileSnapshot.firedoor`).
- Engine: `engine/fireDoor.js` (`deriveFireDoorWindow`, `nextFireDoorName`, `fireDoorLeafThickness`,
  `FireDoorGeometryError`; the coordinate systems of the machining ops in its header), `engine/calculations.js`
  (the dispatch on `category 'firedoor'`), `engine/specification.js` (the `firedoor` block from the item fields, then
  the fullConfig, then the profile defaults; the frame depth = the wall depth; glazing thickness 6; no `firedoor`
  key on any other category), `utils/windowBoundary.js` (the error class known to the per-window boundary),
  `utils/moveToProduction.js` (`CATEGORY_TO_BATCH.firedoor`).
- Lists and BOM: `engine/lists.js` (the FD- cut list material words, the pre-cut raw rule with the record's
  `rawSection`, the leaf skipped in the pre-cut, the vision panel glass rows, `FIREDOOR_HARDWARE` the one table
  line / row / slot, `fireDoorIntumescentPartId`, the fire door hardware list, `CUT_LIST_ORDER` LEAF / FH / HJ / LJ),
  `engine/partSymbols.js` (`TYPE_PREFIX_RE` `^(FD|[CDSW])-`, the fd- registry rows), `engine/partColours.js` (the
  `fire_door` family: head, jambs, leaf), `engine/bom.js` (`ELEMENT_TO_PART_ID` FD- members to `fd_frame_timber`,
  `FIREDOOR_BLANK_PART_ID`, `FIREDOOR_GLASS_PART_ID`, `FIREDOOR_PART_SLOT` / `FIREDOOR_ITEM_SLOT`, the firedoor branch
  of `buildWindowPartQtys`, paint on the casement rows, the door slot rule in `buildWindowMaterialLines`),
  `stores/materialAssignmentStore.js` (`FIREDOOR_PARTS` / `FIREDOOR_ALL_PARTS` appended last to `ALL_PARTS`),
  `stores/ironmongeryStore.js` (`fireDoorLocks`, `keeps`, `doorClosers`; `alsoFor: 'firedoor'` on the door handles,
  hinges and cylinders), `utils/precutPdfExport.js` (the fire door colour
  key page), `utils/glassDxfExport.js` (the category allowed), `utils/elementsPayload.js` (the sheet plan for the
  Elements PDF and the pack), `utils/batchSummary.js` (the Rating / Lock / Closer rows of the batch strip),
  `components/dashboard/PreCutPanel.jsx` ('Timber' for FD- groups).
- Pricing and config: `engine/pricing.js` (`calculateFireDoor`, `DEFAULT_PRICING.firedoor { leafPrice, framePerM,
  vpPerSqm, closerPrice }` all 0), `utils/windowSpecToConfig.js` (the flat firedoor config for the pricing and
  `fireDoorGeometryFromSpec` for the 3D), `pages/SettingsPage.jsx` (the four rates).
- Sheets: `components/drawings/fireDoorDrawUtils.js` (`fireDoorSheetPlan`, `fireDoorHeroSheet`, the elevation and
  plan geometry, `groupFireDoorGlass`, the member descriptors and op table rows, the LSP symbol sizes `IRON`,
  `hingeWord` / `swingWord`), `FireDoorSheet.jsx` (the PartitionSheet pattern), `FireDoorElevation2D.jsx`,
  `FireDoorPlan2D.jsx`, `FireDoorLeaf2D.jsx`, `FireDoorFrame2D.jsx`, `DoorGlassDrawing2D.jsx` (the single pane),
  `DrawingsPanel.jsx` (one tab per sheet; a fire door never reaches the sash sheets).
- 3D: `3d/components/firedoor/FireDoor.jsx`, `3d/App.jsx` (the configurator 3D and its open angle slider),
  `components/viewer/WindowPreview3D.jsx`, `components/viewer/Window3DCaptureRig.jsx`,
  `components/dashboard/ThreeDPanel.jsx` (the open angle control of the window page).
- Export: `utils/bsuiteExport.js` (`FIREDOOR_ROW_KEYS`, `bsuiteStopRow`, `buildBsuiteFireDoorRows`,
  `exportBsuiteFireDoorsMerged`, the STOP line in `writeWorklistXml`; the casement rows untouched),
  `utils/fireDoorMachiningExport.js` (`buildFireDoorMachiningRows`, `fireDoorMachiningCsv`,
  `fireDoorMachiningJson`, `exportFireDoorMachining`); the program uploads go through the unchanged
  `services/bsuitePrograms.js` under the target id 'fd-machine' (a folder of their own).
- UI: the batch type "Fire doors" (`ProjectDetailPage`: add batch, `TYPE_LABELS`, the card subtitle with the rating,
  the leaf and the hand; `DashboardPage`: a red of its own, the label, the new pack select), the configurator
  "Fire door" section (`ConfiguratorPage`), Window Settings · Fire Doors (`WindowSettingsPage` `FireDoorSettings`),
  the sidebar links (`AppSidebar`: Materials > Assignments > Fire doors, Window Settings > Fire doors),
  `MaterialAssignmentsPage` (the fire door rows and their ironmongery tabs), `BatchDefaultsPage` (no Security /
  Frame / PAS24 on a fire door batch; the fire door ironmongery slots), `WindowDetailPage` (the Fire door spec
  section, the overall frame from the engine, the two export buttons, the glass groups),
  `ProductionPackPage` (the overview cells, the Elevations / Elements / Glass / Spraying tabs, the two export buttons).
- Tests: `verify/parity/t51_fire_door.mjs` (the engine, the lists, the sheets, the export, the controls, the
  pages headless), `verify/parity/t52_fire_door_ui.mjs` (the pages a user clicks, driven in Chromium).

## 3. The configurator and the settings

**Configurator** (`ConfiguratorPage`, batch type 'firedoor', the "Fire door" section): Fire door / Non-fire chips;
rating FD30 / FD60 (fire only); leaf width with the suggestion chips of `leaf.widthSuggestions` (626 / 686 / 726 /
762 / 826 / 838 / 926 / 1056, a click inserts, the field stays free and is never clamped); leaf height with the 2040
chip; Hinge left / Hinge right; opens in / out; wall thickness = frame depth with the chips of
`frame.depthSuggestions` (100 to 200, default 100); lock Latch (standard) / Sashlock euro / Bathroom; concealed
closer yes / no (follows the Fire switch until picked); vision panel style from `vp.styles` with the custom fields
(length, width, count, rail, pos 0 / 90) on style 14; intumescent style from `intumescent.styles` (fire only);
leading edge; colour and finish as the other types. Number inputs without spinners. The name field carries the auto
number (FDR-nn / DR-nn, editable). The engine runs live on the fields exactly as the save stores them
(`deriveWindowData` on a spec built from the `firedoor*` keys) and the summary prints the frame overall, the hinge
positions, the rebate and the FD30 / FD60 / non-fire rating; a door the engine refuses shows its message in the
summary and blocks the save. The 3D preview draws the door set from the same derive. The save stores the
`firedoor*` keys (`fireDoorItemFields`) and width / height = the overall frame.

**Window Settings · Fire Doors** (`/window-settings/firedoor`): one card per block of the profile (leaf, frame,
hinges, lock, keep, vision panel, intumescent, bSuite, configurator defaults), every field through `setFireDoorPath`
(root whitelisted, the key must exist, numbers finite), the comma lists through `setFireDoorList`, a lock toggle per
card, a reset button; a live sample door (the reference door, its size, rating and depth editable on the page) prints
the leaf, the frame overall, the hinge positions, the spindle, the keep centre and the strip metres under the
cards. The bSuite card: the targets, the four program paths (leaf / head / hinge jamb / lock jamb), the .bSolid
upload per key (green = uploaded and embedded on export, amber = missing, the row would be red in bSolid), the
STOP rows switch, the HAND values of Hinge left / right, the execution parameters block. The batch snapshot
(`_profileSnapshot.firedoor`) freezes the profile when a batch moves to production, as the other kinds.

## 4. The sheets

`fireDoorSheetPlan(derived)` is the one list the Drawings tabs, the PDF rig, the Elements PDF and the production
pack mount: `fdoutside` (Outside Elevation, the hero sheet of the pack and the Elements PDF), `fdinside` (Inside
Elevation), `fdplan` (Plan), `fdleaf` (Leaf Machining), `fdframe` (Frame Machining). `groupFireDoorGlass` gives one
glass drawing per unique pane size (`DoorGlassDrawing2D`: a single 6 fire / toughened pane, no spacer, no bars).
Every sheet takes `{ sheet, windowSpec, derived, projectNumber, windowTag }` through `FireDoorSheet`.

**The handing convention on the sheets.** The engine's "Hinge left" is seen from the PULL side, which is the 35
face view: so hinge left = hinges on the LEFT of the Outside Elevation and on the right of the Inside Elevation.
The LSP's own "Open way L" drew the hinges on the RIGHT of its outside view (it hands the door from the push side,
as the UK trade does), so the LSP's L is the engine's 'right'. The sheets print only the engine's wording ("Hinge
left / Hinge right") and never the LSP's LH / RH, so the two conventions cannot be read for each other.

- **Outside Elevation** (`FireDoorElevation2D` view 'outside', the LSP's B, the PULL side): the frame outer lines
  and the 35 face, the jambs standing the floor gap below the leaf, the 45 mitre lines at the head corners, the
  leaf with its hinge edge line (and the frame's inner line beside it) INTERRUPTED at the three hinges, the hinge
  rectangles with three bearing lines, the handle rose on the spindle with the lever towards the hinge side, the
  euro cylinder or the bathroom turn symbol at the cylinder height (nothing for a latch), the vision panel panes
  (the diamond rotated), the handing and the door name; the dimensions as the LSP places them: the frame height on
  the far left, the leaf height nearer, the leaf width above the frame and the frame width above that.
- **Inside Elevation** (view 'inside', the LSP's C, the PUSH side): the 50 face lapping the leaf edge by 12, the leaf
  dashed behind it, no hinges, the handle and the lock symbol mirrored; the frame width on top and the height on the
  right (the LSP draws no dimensions on this view; the house rule places them).
- **Plan** (`FireDoorPlan2D`, the LSP's D): the door closed and open 30 side by side, seen from above with the pull
  face at the bottom of the page: the L shaped rebated jambs (50 x depth with the 15 x 47 notch on the opening
  side), the leaf flush with the pull face in the rebate, the knuckle in the gap, the handle on both faces, the
  open leaf swung about the knuckle with its arc, "Closed" and "Open 30", the leaf width under the closed view and
  the frame depth on its left. A multi-detail sheet, the subtitle wrapped at its separators.
- **Leaf Machining** (`FireDoorLeaf2D`): the leaf 1:1 seen from the pull face with its three machined edges unfolded
  beside it (hinge edge, lock edge, top edge as bands one thickness wide): every op of `machining.leaf` where the
  engine puts it (hinge recesses, forend recess and case pocket, spindle and cylinder bores, vision panel cut-outs,
  intumescent grooves, the leading edge); the leaf width on top, the height on the right, the hinge chain (150 /
  hinge / 794 / hinge / 794 / hinge / 200) beside the hinge edge, the vision panel chain on the left, the spindle and
  cylinder heights from the leaf bottom on the right, the backset along the bottom; then the op table (no, operation,
  face, x, y, z, length, width, depth, radius, note) and the notes. Board coordinates as the bSolid master.
- **Frame Machining** (`FireDoorFrame2D`, for the 5-axis programmer): the three members 1:1 one above the other,
  each seen from the opening side with the outside (35) face and the inside (50) face unfolded beside it, the
  rebate cheek hatched, the mitres as the 45 lines and the stepped ends, the hinge recesses on the hinge jamb
  dimensioned from the top long point by the macro chain (188 / 982 / 1776), the keep plate and pocket on the lock
  jamb from the top and from the foot (990), the rebate section enlarged beside the head, the op table and the notes.

The harness renders every sheet of six doors through `renderToStaticMarkup` and checks: svg, no NaN / undefined /
Infinity / long dash, no two texts overlapping (`verify/arch/lib/textCollision.mjs`), the dimension rule
(`dimRule.mjs`) on the Inside Elevation and the Leaf sheet (the Outside Elevation follows the LSP placement with
the heights on the left by design, `OUTSIDE_HEIGHT_DIMS_SIDE`; the Plan and the Frame sheet are multi-detail
sheets with chains under their members) and the reference strings (902, 2083, 826, 2040, the hinge chain, 1000).

## 5. The lists

- **Cut list** (`buildCutListForWindow`): four records per door: FD-HEAD, FD-JAMB-H, FD-JAMB-L (group `box`,
  material 'Hardwood (door frame)', the finished section 50x100, the long point length, quantity 1, the note with
  the mitres, the recesses or the keep and the rebate; each record also carries `rawSection` 63x105, `mitreTop`,
  `mitreBottom`, `role`) and FD-LEAF (group `sash`, material 'Door blank (bought)', section 44x826, length 2040, the
  note "door blank FD30 / FD60 / non-fire"). `buildGroupedCutList` groups them under the symbols LEAF, FH, HJ, LJ
  (`CUT_LIST_ORDER`), the FD- prefix dropped on the sheets by `displayCode` (`TYPE_PREFIX_RE`), the notes kept.
- **Pre-cut** (`buildPrecutForWindow`): the three frame members only (the leaf is a bought blank, never stock), the
  door rule one step further: the assigned material, else the section map, else the record's RAW section 63x105, so
  the pre-cut shows the raw stock and never the finished 50 x depth; every piece + the pre-cut allowance; the
  applied colours rule as partition (the `fire_door` family: head, jambs, leaf; a colour key page in the pre-cut
  PDF). The pre-cut panel labels an FD- group 'Timber'.
- **Glass schedule** (`buildGlassListForWindow`): one row per vision panel pane from `customGlassUnits` (type
  `fire` on a fire door, `toughened` otherwise, thickness 6 from the spec glazing block, no spacer, no gas, no bars,
  location "vision panel n", the note "layout per bSolid macro"); style 0 gives no rows; the glass DXF export accepts
  the category.
- **Hardware** (`buildHardwareList`, every line an `enginePart` with its Assign Materials row from the one table
  `FIREDOOR_HARDWARE`): Fire door hinge / Door hinge (3, the length, the positions from the leaf top and the handing),
  Lock case latch / sashlock euro / bathroom (the rating, the backset, the spindle height), Euro cylinder (euro) or
  Thumbturn and release (bathroom, on the cylinders slot), Lever handle set (on rose, the batch finish), Keep (the
  plate, the centre from the jamb foot), Concealed closer (when ticked, "no machining yet"), Intumescent strip (fire
  only, in metres, the style label and the strips per edge). Slots: `doorHinges`, `fireDoorLocks`, `cylinders`,
  `doorHandles`, `keeps`, `doorClosers` (`HARDWARE_TO_SLOT_KEY`); the window's slot product shows on the line and on
  the material row (the door rule of 08.10.2026, `FIREDOOR_PART_SLOT`).
- **Assign Materials** (`FIREDOOR_PARTS`, `windowType 'firedoor'`, `/materials/assignments/firedoor`): Door Blank
  FD30 44 / FD60 54 / non-fire 44 (pcs), Frame Timber 63 x (depth + 5) (m, by raw section), Fire Door Hinge, Door
  Hinge (standard), Lock Case Latch / Sashlock Euro / Bathroom, Euro Cylinder, Thumbturn and Release, Lever Handle
  Set, Keep, Concealed Closer (pcs, from the Ironmongery catalogue, the tab of their slot), Intumescent Strip 10 / 15 /
  20 (m), Fire Glass, Toughened Glass (vision panel) (m2), Vision Panel Beads (m), Glazing Intumescent (m). Paint on
  the casement rows as the external doors (`derived.paint`, the casement / door rule: per 1.5 m2 2 L primer + 1 L
  topcoat on the leaf both faces + the 35 and 50 faces of the three members).
- **BOM** (`buildWindowPartQtys`): one blank by rating (pcs), the frame timber metres from the pre-cut, the hinges,
  the lock case by type, the cylinder or the thumbturn, one handle set and one keep per door, the closer when ticked,
  the intumescent metres on the row of its width, the vision panel glass m2 (rounded to 2 dp: 0.2 for a 450 x 450
  pane) on the fire or toughened row, the beads and the glazing intumescent metres; no counterweights, no sash
  consumables. Purchase list from the single doors under the client; the batch is the sum.
- **Pricing**: `calculateFireDoor` = `leafPrice` + frame metres (head + two jambs at the long points) x `framePerM` +
  vision panel m2 x `vpPerSqm` + `closerPrice` when the door has one, the quantity discount as the other types; every
  rate 0 until set in Settings > Pricing > Fire doors, so a door prices at 0, never at a sash rate.
- **Weights**: `derived.weights { timber, glass, total, leaves[] }` (the frame by `kgPerM`, the leaf by its section,
  glass 2.5 kg per m2 per mm, margin 5 %): the reference leaf 47.5 kg.

## 6. The 3D

`FireDoor.jsx` draws from `fireDoorGeometryFromSpec(windowSpec, derived)` (plain numbers: the leaf, the frame with
its rebate, the hinge positions, the spindle, the vision panel panes, the handing): the three members as L sections
(the 35 wall part over the full depth, the 15 stop part behind the 47 rebate depth), the leaf in the rebate with a
hole per pane (the diamond a turned square), a glass pane and beads in every hole, a forend plate on the lock edge,
three knuckles at the engine's hinge positions, a lever on a rose at the spindle on both faces (a euro escutcheon or
a bathroom turn below it when the lock has one), a keep plate on the lock jamb cheek, one `woodColor` from the
finish. The leaf swings about the knuckle axis by the open angle (0 to 90, default 30: the slider of the
configurator 3D and the control of the window page 3D tab, the PDF capture takes the same angle). The viewer's
exterior camera is the corridor side: swing 'in' (the default) shows the PUSH face (the 50 frame face, the leaf in
the opening, the handle), swing 'out' turns the set and shows the PULL face with the knuckles. Look only: no
dimensions in 3D. Wired in `App.jsx` (the configurator), `WindowPreview3D.jsx`, `Window3DCaptureRig.jsx`,
`windowSpecToConfig.js` (`config.windowCategory 'firedoor'`, `fireDoorGeo`, `fireDoorOpen`), `ThreeDPanel.jsx`.

## 7. The export

**bSuite** (`buildBsuiteFireDoorRows(windows, profile, target)` -> `{ rows, skipped, messages }`,
`exportBsuiteFireDoorsMerged(windows, label, profile, loadProgram)` -> `{label}_firedoors.ewlist`, the same writer,
ZIP, program embedding and targets as the casement frames; the casement rows stay byte identical, t32 proves it).
Per door four rows, Label = the door name, Quantity 1, Description = the element, the board and the handing:

| row | element (Description) | program key (`bsuite.targets[].programs`) | default path |
|---|---|---|---|
| 1 | FD_LEAF | `leaf` | `C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid` |
| 2 | FD_HEAD | `head` | empty: the 5-axis master does not exist yet |
| 3 | FD_JAMB_HINGE | `jambHinge` | empty |
| 4 | FD_JAMB_LOCK | `jambLock` | empty |

The list is ORDERED all leaves, then all heads, then all hinge jambs, then all lock jambs (the table is re-tooled
between the blocks); identical rows across doors collapse into one row with Quantity n and the door names joined,
as the casement rows do; one STOP row between consecutive non-empty blocks when `bsuite.stopRows`. A program key
without a path or without an uploaded file skips that row for every door with one message per key listing the
doors ("FD_HEAD: no program path on target Machine (Rover) (Window Settings · Fire Doors · bSuite), rows skipped
for FDR-01, FDR-02"); never a throw; the other rows still go. A row whose program file is not uploaded for the
target is still written (bSolid shows it red) and reported; no uploaded program at all = no file.

**The STOP row.** `<StopWorklistItem Id="GUID" Label="" />`, a sibling of `CadProgramWorklistItem` inside
`<Items>`, a new GUID per STOP: the form of the Biesse UK sample `docs/handover/workshop/JOINERY_NETWORK_EVENT.ewlist`,
identical to the owner's line of 27.10.2026. Found, no action needed.

**The variables.** LPX / LPY / LPZ go to the `ProgramPanelNode` as Double (the way the casement rows and the
list bSolid itself saved write the board); EVERY other entry of `derived.firedoor.bsuiteVars.<row>` is a DOCUMENT
variable (`ParametricVariable TypeCode="String"` under the `ProgramDocumentNode`), copied in the engine's key order,
named 1:1 as the macro parameters (table 4.7 of the brief). Why the split: the owner's leaf master has only LPX /
LPY / LPZ at the document level today, so the board size MUST reach the panel node to take effect, while the macro
parameters can only be driven from a worklist once the owner adds document variables with these names and binds
them inside `Master_Door_PIOTR` (BLOCKERS 35.10). The reference FD30 826 x 2040, hinge left, latch:

| row | variable | value | from |
|---|---|---|---|
| FD_LEAF | LPX / LPY / LPZ | 2040 / 826 / 44 | leaf height / width / thickness (the panel node) |
| | HAND | 0 | `bsuite.hand[hingeSide]` (left 0, right 1) |
| | LH / RH | 1 / 0 | 1 on the matching side |
| | HINGE | 1 | 1 fire / 0 standard |
| | LOCK | 2 | 1 standard / 2 FD30 / 3 FD60 |
| | LOCK_H | 1000 | `lock.spindleHeight` |
| | SPINDLE | 1 | `bsuite.macroDefaults` |
| | EURO | 0 | 1 only on the euro lock |
| | KEEP / KEEP_STYLE | 0 / 0 | the leaf of a single door (`macroDefaults.KEEP_LEAF`, `KEEP_STYLE_LEAF`) |
| | INTU_STYLE | 1 | the intumescent style, 0 when fire is off |
| | VP_STYLE | 0 | the vision panel style id |
| | C_VP_L / C_VP_W / C_VP_NUM / C_VP_RAIL / C_VP_POS | 600 / 150 / 1 / 100 / 0 | `vpCustom` (style 14) |
| | D_TOP_RAIL / D_MID_RAIL / D_SIDE_MARGIN | 150 / 450 / 150 | `vp.topRail / midRail / sideMargin` (one source with the sheets) |
| | LEAD_EDGE | 1 | the leading edge switch |
| | REBATE / REBATE_STYLE | 0 / 1 | `macroDefaults` (a single door: no meeting rebate; the master stores 1, BLOCKERS 35.11) |
| | SPY_ON / SPY_H | 0 / 1450 | `macroDefaults` |
| | LBOX / L_BOX_H | 0 / 1000 | `macroDefaults` |
| | DROP_CILL / PREM_DOOR | 0 / 0 | `macroDefaults` |
| | HINGE_1 / HINGE_2 / HINGE_3 | 150 / 944 / 1738 | top_i (one per hinge of `hinges.count`; new names, the owner adds them) |
| | HINGE_D | 3 | `hinges.recessDepth` (new name) |
| | CLOSER | 1 | the closer switch (new name) |
| FD_HEAD | LPX / LPY / LPZ | 902 / 100 / 50 | the long point length / the frame depth / 50 |
| | REB_W / REB_D | 15 / 47 | the rebate |
| | HAND / HINGE / HINGE_D | 0 / 1 / 3 | as the leaf |
| | MITRE_TOP / MITRE_BOTTOM | 1 / 1 | both ends mitred |
| FD_JAMB_HINGE | LPX / LPY / LPZ, REB_W / REB_D, HAND / HINGE | 2083 / 100 / 50, 15 / 47, 0 / 1 | |
| | HINGE_1 / HINGE_2 / HINGE_3 | 188 / 982 / 1776 | jambTop_i from the top long point |
| | HINGE_D | 3 | |
| | MITRE_TOP / MITRE_BOTTOM | 1 / 0 | top mitred, bottom square |
| FD_JAMB_LOCK | LPX / LPY / LPZ, REB_W / REB_D, HAND / HINGE / HINGE_D | 2083 / 100 / 50, 15 / 47, 0 / 1 / 3 | |
| | KEEP / KEEP_STYLE | 2 / 1 | 1 standard / 2 FD30 / 3 FD60; `keep.keepStyle` |
| | KEEP_Y | 990 | the keep centre from the jamb foot |
| | MITRE_TOP / MITRE_BOTTOM | 1 / 0 | |

FD60 writes LPZ 54, REB_D 57, LOCK 3, KEEP 3; a non-fire door HINGE 0, LOCK 1, KEEP 1, INTU_STYLE 0, CLOSER 0; hinge
right HAND 1, LH 0, RH 1; the euro lock EURO 1.

**The machine neutral machining list** (`exportFireDoorMachining(windows, label)`): `{label}_firedoor_machining.csv`
(one line per op, the columns `door, element, op, face, x, y, z, length, width, depth, radius, angle, value, note`,
comma separated, CRLF, UTF-8, numbers to 0.1, the element names the cut list names FD-LEAF / FD-HEAD / FD-JAMB-H /
FD-JAMB-L, doors in the list order, groups leaf / head / hinge jamb / lock jamb, ops in the engine's order) and
`{label}_firedoor_machining.json` (the format header `production-core-firedoor-machining` v1, the coordinate notes,
one object per door with name, fire, rating, handing, inputs, leaf, frame, hinges, lock, keep, vp, intumescent,
closer, bsuiteVars and machining, all copied from `derived.firedoor`). The ops come from
`derived.firedoor.machining` and are never recomputed in the export.

**The coordinate systems** (the header of `src/engine/fireDoor.js`, repeated in the JSON). Every op
`{ id, kind, face, x, y, z, length, width, depth, radius, note? }`, mm, rounded to 0.1; x, y, z = the op's
reference corner (the minimum x, y, z of its bounding box) in the board's own system, EXCEPT the holes
(spindleHole, cylinderHole), whose x, y are the hole CENTRE and whose length and width are the bore; `depth` goes
into the face.

- LEAF board (bSolid LPX x LPY x LPZ): x along the HEIGHT from the leaf TOP (0 = top, LPX = bottom); y across the
  WIDTH from the HINGE edge (0 = hinge edge, LPY = lock edge); z through the THICKNESS from the PULL face (0 = pull
  face, the face the hinge knuckles show on; LPZ = push face). Faces: pull, push, hingeEdge, lockEdge, top, bottom.
  `length` runs along x and `width` along the other in-face axis (y on pull / push, z on the two edges); on top /
  bottom `length` runs along y (the full width) and `width` along z. Handing never moves a leaf op. Kinds:
  hingeRecess x3 (hingeEdge, x = top_i - 0.5, z = 0, 103 x 30 x 3 R6), forendRecess (lockEdge, 236 x 25 x 4 R12.5
  centred on the forend centre and on LPZ / 2), casePocket (lockEdge, 153 x 17 x 87), spindleHole and cylinderHole
  (pull, through, x y = centre), vpCutout per pane (pull, through, R6; the diamond carries rotated true, angle 45
  and its bounding box), intuGroove per strip per edge (top, hingeEdge, lockEdge; fire only), leadEdge (lockEdge,
  depth 0, `value` = the macro value -8).
- FRAME members (FD-HEAD, FD-JAMB-H, FD-JAMB-L): x along the LENGTH from the TOP long point (jambs) or the LEFT long
  point (head), 0 .. length; y across the 50 THICKNESS from the WALL face (0 = wall side, 50 = opening); z along the
  FRAME DEPTH from the OUTSIDE face (0 = the face that shows 35, the pull / stop side; depth = the inside face that
  shows 50). The rebate occupies y in [35, 50] and z in [0, 47] along the full length: op `rebate` on face `opening`.
  The hinge recesses (FD-JAMB-H, x = jambTop_i - 0.5) and the keep plate / pocket (FD-JAMB-L, centred on the keep
  centre and on z = T / 2) sit on face `rebateCheek`, the face at y = 35 that meets the leaf edge. Mitres: op
  `mitre` on face `end`, x = 0 (top / left) or x = length (the head's right end), angle 45, width 50, depth = the
  frame depth.

Buttons: the Production Pack header "bSuite fire doors -> <target>" and "Fire door machining (CSV)" (shown on a fire
door pack / batch or whenever the pack holds a fire door, every door under the batch's profile snapshot); the window
page header the same for one door, shown only for a fire door.

## 8. Verification (`verify/parity/t51_fire_door.mjs`, `verify/parity/t52_fire_door_ui.mjs`)

Run: `node verify/parity/t51_fire_door.mjs` (sections 1 to 3b import the live engine directly; sections 4 to 12
bundle the JSX sheets, the pages and the 3D with esbuild the way t50 does, `build('t51-live', ...)`, the bundles in
`.audit`). Sections of t51:

1. the profile keys and tables, `migrateFireDoorProfile` (block by block; a stored bsuite target keeps its uploaded
   programs), the store setters, `withProfiles` with the 5th argument and every older call form;
2. the spec: the category, the `firedoor` block defaults, the item fields over the fullConfig, frame depth from the
   block, glazing thickness 6; no `firedoor` key on a casement, a sash, a door, a partition;
3. the engine: every number of the brief's 3.10 (the table in section 1), the variable table of 4.7 (leaf, head,
   hinge jamb, lock jamb), the numbering, a free width 803 (no clamp), the hard limits (one door fails with its
   message, the next derives), the cylinders, the vision panels (style 1, custom 14), the machining ops and their
   coordinates, the records, weights, paint and consumables; 3b: FD60, the non-fire door, the 762 x 1981 leaf,
   hinge right, euro / bathroom;
4. the lists: cut list rows and grouped symbols, pre-cut groups (63x105), glass schedule rows, hardware lines and
   their slots, the DXF params;
5. the BOM: the slots per door (FD30 / FD60 / non-fire), the material lines, the merge of two doors, the Assign
   Materials rows and the ironmongery categories, the registry, the PDFs a fire door reaches;
6. pricing with zero rates (0, no throw), `resolvePricing`, `windowSpecToConfig`;
7. the sheets: six doors x five sheets, no NaN / undefined / Infinity / long dash, no text collisions, the dimension
   rule on the inside elevation and the leaf sheet, the reference strings, `elementsPlan`, the Drawings panel tabs;
8. the 3D: `fireDoorGeometryFromSpec` and the model mounted headless;
9. the export: `buildBsuiteFireDoorRows` (the default profile and dummy frame paths), the document variables of
   4.7, the STOP rows in the sample's form, the ZIP round trip, the machining rows, CSV and JSON;
10. the controls (the baseline rule): a casement 1200 x 1200, a sash 900 x 1500, a single door 900 x 2100 and the
    t50 partition bay derive BYTE IDENTICAL to the Stage 0 dumps written on the starting commit 623b282 (compared
    file by file and by a typed hash), and `t32_bsuite.mjs` unchanged (54 passed, 0 failed: the casement frame
    rows are byte identical);
11. the pages: the overview cells, the glass groups, the Elements / Elevations / Glass / Spraying tabs, the pack and
    the window page through the router;
12. the batch summary strip and the pre-cut panel label.

`node verify/parity/t52_fire_door_ui.mjs` drives the pages a user clicks in a real Chromium (the t39 pattern: one
esbuild iife bundle of the live page with the stores per part, the Supabase client on an empty env, nothing on the
network; it needs the Playwright of the global node install and exits 2 without it, not a failure): A, Window
Settings · Fire Doors (the sample door readout 902 x 2083, the hinges 150 / 944 / 1738 and 188 / 982 / 1776, the
keep 990, the intumescent 4.906 m, the rebate 15 x 47, the members; the FD60 / non-fire sample chips; a typed top
offset 145 moves the sample hinges; the width list sorted and cleaned; the defaults card; the bSuite card with the
STOP rows, the path with its quotes stripped, add / fill / remove target, a macro default; the head joint select;
the reset); B, the configurator on a fire door batch (the proposed name FDR-01, the Fire door section and no
Dimensions / Ventilation / Horns, the live summary numbers, the slots, fire OFF renaming to DR-01 and a typed name
kept, the free width 803, the 926 chip, a width 200 disabling Save with the geometry message, the closer / lock /
VP controls, the save with the stored `firedoor*` keys and width = the frame overall, the second door FDR-02
prefilled from the first, DR-01, edit mode never renames); C, the project page (the Fire doors batch, the card
902 x 2083 and its subtitle, Add Batch, Project Materials), the batch defaults page (the fire door slots, no sash
rows), Material Assignments · Fire doors (the four sections and their rows), the dashboard (the type key, the new
pack select). Every number is typed as a literal and read back from the live store or the rendered page.

Counts of the final runs: `BUILD-LOG.md` (27.10.2026). Controls: `verify/arch/t27.mjs` (the engine grep gate for
bare workshop numbers), t41 and t50 (the door and partition keys), t32 (the casement bSuite rows).

## 9. Assumptions (ZAŁOŻENIE, every one a profile key)

The owner items are `BLOCKERS.md` 35.1 to 35.19. The assumptions, with the key in `DEFAULT_FIREDOOR_PROFILE` and
the value used:

| assumption | key | value |
|---|---|---|
| one type with a Fire switch, FDR / DR numbering | `defaults.fire`, `defaults.rating` | true, 'FD30' |
| the blank is bought oversize, the CNC cuts the size | `leaf.blankAllowance` | 0 |
| the macro LEAD_EDGE value (unit not decoded; the CSV `value` only) | `leaf.leadEdgeMacroValue` | -8 |
| raw board width = frame depth + 5 | `frame.rawWidthAllowance` | 5 |
| the leaf stands 5 above the floor (the LSP) | `frame.floorGap` | 5 |
| the head meets the jambs on a 45 mitre (the LSP) | `frame.headJoint` | 'mitre' |
| hinges counted from the leaf TOP (the 150 end of LPX is the top; not confirmed in bSolid) | `hinges.topOffset`, `hinges.bottomOffset` | 150, 200 |
| hinge recess plate + 1, R6 (12 cutter), 3 deep (old Weeke 3.2 / 4 / 4.2) | `hinges.recessLength / recessWidth / recessDepth / cornerRadius` | 103, 30, 3, 6 |
| the lock case pocket (the owner's proposal) | `lock.case.pocketDepth`, `lock.case.pocketHeight` | 87, 153 |
| the case top above the spindle (the macro `lock_h + 46.5`) | `lock.caseTopAboveSpindle` | 46.5 |
| the forend centre below the spindle (the macro `lock_h - 15`) | `lock.forendCentreBelowSpindle` | 15 |
| the hole diameters (drawings and CSV only) | `lock.spindleBore`, `lock.euroBore`, `lock.bathroomBore` | 10, 18, 10 |
| the keep plate depth | `keep.plateDepth` | 3 |
| one keep pocket for the latch and the bolt, centred on the plate | `keep.pocket` | 120 x 18 x 15 |
| the vision panel placement (not the macro's) | `vp.topRail`, `vp.midRail`, `vp.sideMargin`, `vp.stackGap` | 150, 450, 150, 100 |
| the cut-out corner radius, the bead faces, the glass thickness (fire and toughened) | `vp.cornerRadius`, `vp.beadFaces`, `vp.glassThickness` | 6, 2, 6 |
| strips per edge of the INTU_STYLE labels | `intumescent.styles[].strips` | 1 for 1, 2, 5, 6; 2 for 3, 4, 7 |
| the groove is the strip + 0.5 (the macro cuts 15.5 for a 15 strip) | `intumescent.grooveOversize` | 0.5 |
| two strips sit at T / 2 +- 11 (the macro's +- 2.75 are the two saw passes of ONE groove) | `intumescent.twoStripOffset` | 11 |
| macro HAND 0 = Hinge left of the form | `bsuite.hand` | { left 0, right 1 } |
| the leaf master path | `bsuite.targets[0].programs.leaf.path` | `C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid` |
| the frame masters do not exist: empty paths, rows skipped with a message | `bsuite.targets[0].programs.head / jambHinge / jambLock.path` | '' |
| the upload folder of the fire door programs | `bsuite.activeTarget`, `bsuite.targets[0].id` | 'fd-machine' |
| REBATE 0 on a single door (the master stores 1), the other macro switches | `bsuite.macroDefaults` | REBATE 0, REBATE_STYLE 1, SPY_ON 0, SPY_H 1450, LBOX 0, L_BOX_H 1000, DROP_CILL 0, PREM_DOOR 0, SPINDLE 1, KEEP_LEAF 0, KEEP_STYLE_LEAF 0 |
| the paint rule (not a key): the casement / door rule on the leaf both faces + the 35 and 50 faces of the members | `fireDoor.js paintFromAreaSqm` | per 1.5 m2 2 L primer + 1 L topcoat |

## 10. Next steps

1. The owner adds the document variables of section 7 to `FD_LEAF_MASTER_PIOTR` and binds them in
   `Master_Door_PIOTR` (BLOCKERS 35.10), then proves on the machine that a worklist row moves the hinges and the
   lock (the lesson of 06.10.2026: the casement macros did not react from a list that looked fine).
2. The three frame masters (FD_HEAD, FD_JAMB_HINGE, FD_JAMB_LOCK) for the 5-axis CNC from the machining CSV / JSON
   and the Frame Machining sheet; their paths and uploads in Window Settings · Fire Doors · bSuite; then the head
   and jamb rows go in the list.
3. The owner's answers to BLOCKERS 35: the hinge rule (35.13: the three sources and a 4th hinge), the closer
   machining (35.12), the intumescent pads (35.17), smoke seals / architraves / signs / drop seal (35.14), the
   suspect master values (35.11).
4. Pricing rates (`pricing.firedoor`) from PSW; the Settings > Pricing > Fire doors card holds them.
5. Double doors (KIT_DOOR_DOUBLE: frame outer = leaves + 79, height + 43, centre gap 3, the active leaf rebated 12
   at the meeting edge, the handle leaf chosen from inside): the next tura (BLOCKERS 35.15).
6. The vision panel placement decoded from the macro (today PC's own placement, "layout per bSolid macro" on the
   sheets); the Weeke MPR export if the old machine is to cut leaves again (out of scope here).
