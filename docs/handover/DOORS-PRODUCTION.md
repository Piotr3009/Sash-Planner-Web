<!--
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
-->

# Doors to production, single and french: as built (v3, 09.10.2026)

Owner decisions (Piotr, 09.10.2026, answers 1 to 23 in the box of the doors v3 brief), branch `claude/doors-v3`,
from `main` at 150500e. v3 replaces the door frame rules of 08.10.2026 (coupling post 136, side panel members 57 x
57, a transom band of its own, a threshold-dependent leaf height) with the casement rules inside the door frame.
Items for Piotr: `BLOCKERS.md` 31.x. Verdict, before / after tables and suite counts: `BUILD-LOG.md` (09.10.2026).

## 1. The model in one page

Every number lives in `DEFAULT_DOOR_PROFILE` (`src/engine/profile.js`, schema 3) and is editable in Window Settings
· Doors. `deriveDoorWindow` (`src/engine/calculations.js`) is the only place that turns it into sizes; where a rule
is "as casement" it calls the same helper the casement engine calls (`src/engine/casementRules.js`). The BOM, lists,
sheets, PDFs, pack and 3D read `derived.door`.

| | value | rule / source |
|---|---|---|
| frame | W x H is the OVERALL frame (side panels and fanlight inside); head, jambs, cill 68 x 93 | as casement; land 47, rebate 21, gap 4, cill visible 41 |
| mullion | 68 x 93 between a door and a side panel, full height through the transom; land 26 (13 + 13) | casement `fullMullionRun`: L = H - 77 with a timber cill, H - 36 without |
| side panel zone | `sideLeftWidth` / `sideRightWidth` = outer frame edge to the mullion axis | flagged (BLOCKERS 31.1 a) |
| transom | 68 x 93, axis at T = `transomHeight` from the frame top; land 8 above, 13 below; cut in segments between jambs and mullions | casement `transomRun`: segment = field leaf W + 8.5; T is flagged (31.1 b) |
| leaf height | every leaf bottom 51 above the floor (any threshold, either direction) | H - 51 - 51 = H - 102; under a transom H - T - 17 - 51 |
| leaf width | single W - 2 x 51; at a mullion axis 17 instead of 51; french half = (field - edges - clearance) / 2, leaf = half + lip 6 | `leafAtJamb 51`, `leafAtMullionAxis 17`, `frenchLip 6`, clearance 0 |
| leaf | 57 deep (61 triple); stiles 94, top rail 94, bottom rail 180, mid rail 94, meeting stile 100 | unchanged |
| glass | leafW - (stileL - 11.5) - (stileR - 11.5) by leafH - (94 - 11.5) - (180 - 11.5) | the meeting stile counts 100 |
| half glazed / three quarter | mid rail axis at leafH / 2, 0.75 x leafH | unchanged formulas |
| panel | 2 x 18 Tricoya MDF + MDF core 18 = 54; edge machined to a 24 tongue, 17 into the 18 glazing rebate | outer = daylight + 2 x 17; edge 24 / 40 / 15 and boards at the outer size flagged (31.1 d, e) |
| side panel | a casement fixed light behind the mullion: stiles 64, top rail 64, bottom rail 180, 57 deep; no hardware | W = zone - 51 - 17, H as the leaf; glass W - 105, H - 221 |
| fixed fanlight | a non-opening casement leaf 64 / 64 / 67 x 57, the size of the opening fan leaf | glass W - 105, H - 108; bottom 67 flagged (31.1 c) |
| opening fanlight | a casement top hung leaf 64 / 64 / 67 x 57: W = zone - edges (51 jamb, 17 mullion), H = T - 65 | 65 = 51 + 6 + 8; casement hinge and lock picks, seals, consumables, handle |
| threshold | timber: the cill 68 x 93 (nothing bought); aluminium / low-profile: the threshold product + "Threshold seal" (m, door opening) | inward door: always the timber inward cill 40 / 35; a stored aluminium is ignored with "inward door: timber threshold" |
| trickle vents | by room type, as a window (`buildVentGrilles`, `trickleVents` slot) | BOM and hardware list |
| handing | "Hinge left / Hinge right" (the configurator value, hinges seen from inside) + "opens outward / inward" | the kit handing (LH / RH) stays internal (`kitHanding`) |
| hinges | 3 per leaf, 4 when the leaf is taller than 2100 | centres 200 from the top, 100 above the centre, 150 from the bottom |
| single / french kits | ThunderBolt single kit; french two handles FGTE double kit, one handle ThunderBolt + 2 bolts | unchanged |
| consumables, seals, paint, beading | the casement rows per door leaf, side light and fan leaf; pane and panel perimeters x 1.15 | unchanged |

Reference (default profile): single 900 x 2100 leaf 798 x 1998, glass 633 x 1747 (timber, aluminium or inward
alike); half glazed glass 633 x 881, mid rail axis 999, panel 644 x 806; french 1600 x 2100 leaves 755 x 1998, glass
584 x 1747; french 2400 x 2400 with side panels 400 + 400 and a fan at T 450: door leaves 789 x 1882 (glass 618 x
1631), side lights 332 x 1882 (glass 227 x 1661), fan leaves 332 / 1566 / 332 x 385, mullions 2323 (2364 without
a timber cill), transom segments 340.5 / 1574.5 / 340.5, visible band 442 to 463.

## 2. Where it lives

- Profile, migration, snapshot: `profile.js` (`DEFAULT_DOOR_PROFILE` schema 3, `migrateDoorProfile` walking schema 1
  to 2 to 3, a value equal to the old default moves, a hand edit stays; `withProfiles(sash, casement, door, fn)`),
  `windowProfileStore.js` (`DOOR_PATH_ROOTS`, the dirty-path cloud save), `projectStore.js` (batch
  `_profileSnapshot.door`, `batchDefaultsFor('door')`).
- Engine: `casementRules.js` (the shared casement helpers), `calculations.js` `deriveDoorWindow` (v5:
  `mullions[]`, `transom`, `sidePanels[]`, `fanLeaves[]` with `fixed`, `panels[]`, `thresholdInfo`, `handing`,
  `zones.openings`), `doorHardware.js` (hinges, `doorHandingLabel`, internal kit handing, FGTE band, threshold
  product and seal).
- Materials: `materialAssignmentStore.js` `DOOR_PARTS` (mullion, side light 64 x 57 / 180 x 57, fixed fan 64 / 64
  / 67, threshold seal; unassigned rows take their casement counterpart, `PART_DEFAULT_FROM`),
  `MaterialAssignmentsPage.jsx` Doors branch; `bom.js` door block; `lists.js` (symbols M, T, FFS-L/R, FFTR, FFBR,
  the vents line); `partSymbols.js`, `partColours.js`.
- Sheets: `DoorElevation2D`, `DoorFrameDetail2D` (mullions M1 with their lengths, transom segments, T),
  `DoorLeafDetail2D` (H1 to H4 smaller and spread, the panel edge note), `DoorSidePanelDetail2D` (fixed light),
  `DoorFanlightDetail2D` (fixed and opening), `DoorSection2D` (panel edge detail), `DoorGlassDrawing2D`, mounted
  through `DoorSheet.jsx` by the Drawings panel, its PDF rig, the Elements PDF and the production pack.
- 3D: `windowSpecToConfig.js` `doorGeometryFromSpec(windowSpec, derived)` (the page's derived under the batch
  snapshot), `DoorAssembly.jsx` (frame land = complement of the openings, fixed lights, bevelled panel),
  `verify/parity/render_door_samples.mjs` writes `samples/doors/`.
- Tests: `verify/parity/t44_doors_v3.mjs` (every 3.10 row, thresholds, vents, handing, migration, controls, BOM),
  `t41_doors_production.mjs` (engine, BOM, lists, hardware, sheets with the text collision check), `t40` section 6
  (door meshes).

## 3. What PSW would have to port

PC re-derives every imported door from its own profile, so a PSW estimate drawing and the PC production numbers
disagree until PSW takes the same model:

1. W x H is the overall frame: side panels and the fanlight sit inside it (PSW adds them outside W, and its door
   price still adds the side panels to W: BLOCKERS 31.1 a).
2. Frame: the casement frame (68 x 93, land 47, rebate 21, gap 4, cill 41 visible); a casement mullion 68 x 93
   between a door and a side panel; a casement transom with its axis at T from the frame top.
3. Leaf: 57 deep (61 triple), stiles 94, top rail 94, bottom rail 180, mid rail 94; every leaf 51 above the floor:
   H - 102, under a transom H - T - 17 - 51; 17 from a mullion axis, 51 from a jamb.
4. French: each leaf = (field - edges) / 2 + 6, meeting stile 100.
5. Side panel: a fixed light 64 / 64 / 180, zone - 51 - 17 wide. Fans: casement leaves 64 / 64 / 67, T - 65 high,
   fixed or opening.
6. Panel: daylight + 2 x 17, 54 thick, edge 24 / 40 / 15. Glass: door double 6x12x6 (24).
7. Handing: "Hinge left / right" seen from inside plus "opens outward / inward".
