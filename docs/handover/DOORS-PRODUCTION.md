<!--
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
-->

# Doors to production, single and french: as built (08.10.2026)

Owner decisions (Piotr, 08.10.2026, the box of the tura brief), branch `claude/doors-production`, from `main` at
410cb5d. The audit behind it: `DOORS-AUDIT-2026-10-07.md`. Items for Piotr: `BLOCKERS.md` 29.x. Verdict and
suite counts: `BUILD-LOG.md` (08.10.2026).

## 1. The model in one page

Every number lives in `DEFAULT_DOOR_PROFILE` (`src/engine/profile.js`, schema 2) and is editable in Window Settings
· Doors. `deriveDoorWindow` (`src/engine/calculations.js`) is the only place that turns it into sizes; the BOM,
lists, sheets, PDFs, pack and 3D read `derived.door`.

| | value | rule / source |
|---|---|---|
| frame | head, jambs, cill 68 x 93, transom rail 68 x 93, coupling post 136 x 93 | as casement; land 47, rebate 21, gap 4, gapCill 6, cill visible 41 |
| inward door | cill 40 x 93 unrebated, falls to 35 | `cillInward` |
| aluminium / low-profile threshold | no timber cill, threshold 1 pc (single or double row) | |
| leaf | 57 deep (61 triple); stiles 94, top rail 94, bottom rail 180, mid rail 94, meeting stile 100 | box item 4 |
| single leaf | W - 102 by H - 98 (timber cill, both directions) or H - 57 (no timber cill) | 102 = 2 x (47 + 4); 98 = 51 + 6 + 41; 57 = 51 + 6 |
| french leaf | half = (W - 102 - clearance) / 2, leaf = half + lip 6 (clearance 0, owner: later) | each leaf runs 6 past the centre line on its 100 meeting stile |
| glass | leafW - (stileL - 11.5) - (stileR - 11.5) by leafH - (94 - 11.5) - (180 - 11.5) | the meeting stile counts 100 |
| half glazed | mid rail axis at leafH / 2 | glass H = (axis - 47) - 94 + 23; panel H = (leafH - 180) - (axis + 47) + 23 |
| three quarter | mid rail axis at 0.75 x leafH | same formulas |
| panel | 2 x 18 Tricoya MDF + MDF core 18 (flagged), in the 11.5 rebate, width = glass width | `d_panel_tricoya_18` m² x 2, `d_panel_mdf_core` m² x 1 |
| door glass | double 6x12x6 (24) on `d_glass_double_6_12_6`; slim, triple, laminate / acoustic 24.8 on the window rows | `DOOR_GLASS_MAKEUP`, `DOOR_GLASS_THICKNESS` |
| fixed fanlight | glazed into the frame: W_frame - 2 x (68 - 11.5) by transomH - 2 x (68 - 11.5) | |
| opening fanlight | a casement top hung leaf 64 / 64 / 67 x 57, W_frame - 102 by transomH - 102 | casement glass rule, hinge and lock picks, seals, consumables, handle |
| hinges | 3 per leaf, 4 when the leaf is taller than 2100 | centres 200 from the top, 100 above the centre, 150 from the bottom |
| single door | ThunderBolt single door kit 1, cylinder 1, handle set 1 | |
| french, lockType double | FGTE double door kit 1, cylinders 2 (keyed alike), handle sets 2 | height band from the leaf height |
| french, lockType single | ThunderBolt 1 (active leaf), bolts 2 (passive leaf), cylinder 1, handle set 1 | |
| consumables, seals, paint | the casement rows (silicone, bead tape, packers, clips, seals, astragal, paint) | per door leaf, side panel leaf and fan leaf |
| beading | pane (and panel) perimeters x 1.15 on `d_glazing_beading` | |

Single 900 x 2100: leaf 798 x 2002, glass 633 x 1751. French 1600 x 2100: half 749, leaf 755 x 2002, meeting stile
100 x 57, glass 584 x 1751 (= the 749 leaf with two 94 stiles). Half glazed single: glass 633 x 883, panel 633 x 797.

## 2. Where it lives

- Profile, migration, snapshot: `profile.js` (`DEFAULT_DOOR_PROFILE`, `migrateDoorProfile`, `getDoorProfile`,
  `withProfiles(sash, casement, door, fn)`), `windowProfileStore.js` (`door` key, `setDoorPath`,
  `resetDoorToDefaults`), `projectStore.js` (batch `_profileSnapshot.door`).
- Engine: `calculations.js` `deriveDoorWindow` (v4), `doorHardware.js` (hinge count and positions, handing, FGTE
  band, the door hardware picks), `specification.js` (door glass makeup and thickness, frame depth 93).
- Materials: `materialAssignmentStore.js` `DOOR_PARTS` (Frame, Leaf, Panel, Side panel, Glass, Beading,
  Ironmongery), `MaterialAssignmentsPage.jsx` Doors branch; `bom.js` door block, `ELEMENT_TO_PART_ID` for every
  `D-` name; `lists.js` door pre-cut / cut list / hardware list; `partSymbols.js`, `partColours.js`;
  `optimizer.js` over-length guard.
- Sheets: `DoorElevation2D`, `DoorFrameDetail2D`, `DoorLeafDetail2D`, `DoorSidePanelDetail2D`,
  `DoorFanlightDetail2D`, `DoorSection2D`, `DoorGlassDrawing2D`, one plan of the door sheets in
  `doorDrawUtils.js` (`doorSheetPlan`, `groupDoorGlass`) mounted through `DoorSheet.jsx` by the Drawings panel,
  its PDF rig, the Elements PDF and the production pack.
- 3D: `windowSpecToConfig.js` `doorGeometryFromSpec` (the engine door geometry as a plain object, config key
  `doorGeo`); `DoorWindow` draws it through `DoorAssembly.jsx` when present and renders the old PSW door without
  it. The preview, the pack capture rig and the configurator iframe pass it. Renders: `samples/doors/`.
- Configurator: door frame depth 93 from the door profile, `doorPaneling` prefill, `doorGeo` in the 3D sync.
- Tests: `verify/parity/t41_doors_production.mjs` (engine, BOM, lists, hardware, migration, sheets),
  `verify/parity/t40_bottom_rail_3d.mjs` section 6 (door meshes).

## 3. What PSW would have to port

PSW was not read in this tura (no clone in the session). PC re-derives every imported door from its own profile,
so a PSW estimate drawing and the PC production numbers can disagree until PSW takes the same model:

1. Frame: face 68, depth 93, land 47, rebate 21, gap 4, cill 68 x 93 with 41 visible (the casement frame).
2. Leaf: 57 deep (61 triple), stiles 94, top rail 94, bottom rail 180, mid rail 94; leaf W - 102, H - 98 with a
   timber cill, H - 57 without.
3. French: each leaf = (W - 102) / 2 + 6, meeting stile 100 (94 + the 6 lip), no centre mullion.
4. Glass: door double 6x12x6 (24).
5. Styles: half glazed mid rail axis at leafH / 2, three quarter at 0.75 x leafH, panel 2 x 18 Tricoya + 18 core.
6. Opening fanlight: a casement leaf 64 / 64 / 67, W_frame - 102 by transomH - 102.
