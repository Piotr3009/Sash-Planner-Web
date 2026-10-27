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
| meeting joint (24.10.2026) | each meeting stile 100 keeps a full-length rebate 16 wide (lap 12 + gap 4); active lip 37 on the face the door swings to (cut 20 from the other face), passive lip 14.5 on the other face (cut 42.5), 5.5 between the lips for the seal (3 mm groove in the passive shoulder) | `meeting { gap, lipActive, lipPassive, sealGroove }`, `frenchMeetingGeometry` / `leafMeeting` in `doorLockMachining.js`; `derived.door.meeting`, `leaves[i].meeting` |
| spindle datum (24.10.2026) | ONE spindle axis 1050 above the LEAF BOTTOM on every door (1101 above the floor at the 51 foot); the lock axis 12 + 21 / 2 = 22.5 from the lip face on both french leaves, centred (28.5) on a single door | `hardware.spindleFromLeafBottom`, `lockEdgeMargin`, `faceplateWidth`; 0 falls back to `handleHeight` above the floor; flagged (BLOCKERS 33.1) |
| lock machining (24.10.2026) | ThunderBolt 1770 (product DXF T-FGAO2070): faceplate 21 x 3 from -906 to +864, rail channel 12.2 x 8, pockets -840.5..-700.5 (47), -135.5..+94.5 (D+21), +649.5..+789.5 (47), the data sheet's aux pocket +256.7..+366.7 only with `auxHousing`; cylinder -92; keeps F2402 on the deadbolt axes -753.5 / +736.5 and F24-912W at the spindle on the passive shoulder or the lock side jamb; FGTE master / slave per the Winkhaus rebated routing (58 slab) | `leafLockMachining`, `jambKeepMachining`; `leaves[i].machining`, `door.jambMachining`; the Lock Machining sheets (one per edge, the plates from the Winkhaus DXF outlines) |
| handing | "Hinge left / Hinge right" (the configurator value, hinges seen from inside) + "opens outward / inward" | the kit handing (LH / RH) stays internal (`kitHanding`) |
| hinges | 3 per leaf, 4 when the leaf is taller than 2100 | centres 200 from the top, 100 above the centre, 150 from the bottom |
| single / french kits | ThunderBolt single kit; french two handles FGTE double kit, one handle ThunderBolt + 2 bolts | unchanged |
| consumables, seals, paint, beading | the casement rows per door leaf, side light and fan leaf; pane and panel perimeters x 1.15 | unchanged |

Reference (default profile): single 900 x 2100 leaf 798 x 1998, glass 633 x 1747 (timber, aluminium or inward
alike); half glazed glass 633 x 881, mid rail axis 999, panel 644 x 806; french 1600 x 2100 leaves 755 x 1998, glass
584 x 1747; french 2400 x 2400 with side panels 400 + 400 and a fan at T 450: door leaves 789 x 1882 (glass 618 x
1631), side lights 332 x 1882 (glass 227 x 1661), fan leaves 332 / 1566 / 332 x 385, mullions 2323 (2364 without
a timber cill), transom segments 340.5 / 1574.5 / 340.5, visible band 442 to 463.

### 1a. The meeting joint and the lock machining (Piotr 24.10.2026)

Pattern: the Winkhaus UK "FGTE Rebated Master / Slave Routing Detail, 45 mm backset, 58 mm slab" (BJ Waller pack):
rebate 18 wide with a 4 gap, master lip 39 (cut 19), slave lip 15, 4 between the lips, lock axis 22 from the lip
face, faceplate recess 20.5 x 3 (master) / 20.5 x 5 (slave), rod channel 12.2 x 12 / x 15, Q-lon Aquamac 124 in a 3 mm
groove in the slave shoulder. The owner's numbers on the 57 leaf: lap 12 + gap 4 = rebate 16; active lip 37 (cut 20
from the face opposite the swing), passive lip 14.5 (cut 42.5 from the swing face), 5.5 seal space; faceplate recess
21 at 12 from the lip face, axis 22.5 (the FGTE "22 mm centre line" variant, `fgteCentreLine 22`).

Rules (`src/engine/doorLockMachining.js`, pure, called once per door by `deriveDoorWindow`):

* `frenchMeetingGeometry`: `overlap = 2 x frenchLip - frenchClearance` (12), `rebateWidth = overlap + gap` (16),
  `cutActive = leafDepth - lipActive` (20), `cutPassive = leafDepth - lipPassive` (42.5), `sealSpace = leafDepth -
  lipActive - lipPassive` (5.5), `lapFace` exterior outward / interior inward; `valid` false when the lips do not fit.
* `leafMeeting(role)`: the active lip on the lap face, the passive lip on the other face; the rebate cut from the face
  opposite the lip; `splitZ` = the lip plane from the exterior (the 3D splits its EXT / INT member halves there:
  outward 37 / 42.5, inward 20 / 14.5).
* `leafLockMachining`: every position from the SPINDLE (+ up) with the absolute form from the leaf bottom beside it.
  `thunderbolt` (single door, french active with one handle): faceplate 1770 (906 below, 864 above), the rail
  channel 12.2 x 8, three pockets 18 wide (the deadbolt housings 140 long x 47 centred on the DXF housings at
  -840.5..-700.5 and +649.5..+789.5, the main case 230 x D+21 at -135.5..+94.5), the data sheet's auxiliary pocket
  +256.7..+366.7 only with `hardware.auxHousing`, spindle 0 and cylinder -92 at the backset, deadbolt axes -753.5 /
  +736.5 (the DXF double bolts); `keeps`
  (french passive with one handle; `jambKeepMachining` for the single door's lock jamb): F2402 plate 24 x 176 x 2.5
  with an 18 x 120 x 25 pocket at each deadbolt, F24-912W plate 235 (-126.5..+108.5) with a 182 pocket
  (-106.5..+75.5), both 24 x 2.5 / 18 x 25; `fgte-master` / `fgte-slave` (two handles): the Winkhaus routing pockets
  (R8.5 = 17 wide) with the main case D+23 / D+26 deep, the rod channel, the slave end plates 20.5 x 65 x 3 at both
  leaf ends. The face the plate sits on: the 37 active lip (4 left to the step), the 42.5 passive shoulder (9.5 to
  the lip), or the full 57 lock stile centred.
* The drawings: the plan detail notches each meeting stile 16 wide to its lip (the gap shows); the Lock Machining
  sheets (`DoorLockMachining2D`, ONE PER MACHINED EDGE, keys `doormachining` and `doormachining-passive` /
  `doormachining-jamb`, the `band` prop) lay the edge down at 1:1 with the PLATE drawn from the Winkhaus product
  drawing (`engine/hardware/winkhausOutlines.js`, generated by `verify/tools/winkhaus_dxf_outlines.py` from Piotr's
  DXF files: the ThunderBolt 1770 radius plate with its bolt / latch windows, screw holes, housings, follower and
  PZ bores; the FGTE slave strip 1702.68 with its keep boxes, keep windows, lever and guide blocks, the spindle 919.5
  above its bottom end), the keeps from the BJ Waller data sheets (`engine/hardware/winkhausKeeps.js`: R12 plates,
  R6 pockets, bolt windows, countersunk screws, adjusters), the pockets hatched with the cutter radius (12 / 17), the
  housings and bores dashed (hidden), then the DETAILS: the features clustered into lettered windows (a gap over 110
  starts a new one) at one scale (3:1 down to 1.5:1; one row at 2:1 or better, else two rows), the positions from
  the leaf bottom under each window, the table (from the leaf bottom and from the spindle) and the notes; the FGTE
  master plate is schematic (no drawing of it, BLOCKERS 33.11). Every machining result names its plate (`plate`:
  outline, from / to, crop) and its `cutter`. The leaf and section sheets name the joint in their notes; the 3D cuts
  the rebate 16 to the lip plane (t40).

Reference (default profile, french 1600 x 2100 outward, one handle): active lip edge: faceplate 144 to 1914,
pockets 209.5..349.5, 914.5..1144.5, 1699.5..1839.5, spindle 1050, cylinder 958; passive shoulder: keeps at 296.5 /
1050 / 1786.5 (plates 208.5..384.5, 923.5..1158.5, 1698.5..1874.5). Inward: the same from the interior face.

## 2. Where it lives

- Profile, migration, snapshot: `profile.js` (`DEFAULT_DOOR_PROFILE` schema 3, `migrateDoorProfile` walking schema 1
  to 2 to 3, a value equal to the old default moves, a hand edit stays; `withProfiles(sash, casement, door, fn)`),
  `windowProfileStore.js` (`DOOR_PATH_ROOTS`, the dirty-path cloud save), `projectStore.js` (batch
  `_profileSnapshot.door`, `batchDefaultsFor('door')`).
- Engine: `casementRules.js` (the shared casement helpers), `calculations.js` `deriveDoorWindow` (v5:
  `mullions[]`, `transom`, `sidePanels[]`, `fanLeaves[]` with `fixed`, `panels[]`, `thresholdInfo`, `handing`,
  `zones.openings`), `doorHardware.js` (hinges, `doorHandingLabel`, internal kit handing, FGTE band, threshold
  product and seal), `doorLockMachining.js` (24.10.2026: `frenchMeetingGeometry`, `leafMeeting`,
  `leafLockMachining`, `jambKeepMachining`, the Winkhaus constants `THUNDERBOLT_1770`, `FGTE_MASTER`, `FGTE_SLAVE`,
  `KEEPS`).
- Materials: `materialAssignmentStore.js` `DOOR_PARTS` (mullion, side light 64 x 57 / 180 x 57, fixed fan 64 / 64
  / 67, threshold seal; unassigned rows take their casement counterpart, `PART_DEFAULT_FROM`),
  `MaterialAssignmentsPage.jsx` Doors branch; `bom.js` door block; `lists.js` (symbols M, T, FFS-L/R, FFTR, FFBR,
  the vents line); `partSymbols.js`, `partColours.js`.
- Sheets: `DoorElevation2D`, `DoorFrameDetail2D` (mullions M1 with their lengths, transom segments, T),
  `DoorLeafDetail2D` (H1 to H4 smaller and spread, the panel edge note), `DoorSidePanelDetail2D` (fixed light),
  `DoorFanlightDetail2D` (fixed and opening), `DoorSection2D` (panel edge detail, the meeting rebate with its gap
  and lips), `DoorLockMachining2D` (24.10.2026, keys `doormachining` and `doormachining-passive` / `-jamb`, one
  edge per sheet: the edge at 1:1 with the Winkhaus plate and the keeps, lettered details at one scale, the table
  from the leaf bottom and from the spindle; the plate outlines in `engine/hardware/winkhausOutlines.js`
  (generated) and the keep faces in `engine/hardware/winkhausKeeps.js`), `DoorGlassDrawing2D`, mounted through
  `DoorSheet.jsx` by the Drawings panel, its PDF rig, the Elements PDF and the production pack.
- 3D: `windowSpecToConfig.js` `doorGeometryFromSpec(windowSpec, derived)` (the page's derived under the batch
  snapshot), `DoorAssembly.jsx` (frame land = complement of the openings, fixed lights, bevelled panel),
  `verify/parity/render_door_samples.mjs` writes `samples/doors/`.
- Tests: `verify/parity/t49_door_meeting_machining.mjs` (24.10.2026: the profile keys and migration, the joint
  geometry outward / inward / 61, the ThunderBolt pockets and keeps, FGTE master and slave, the single door's jamb
  keeps, the owner switches, `setDoorPath`, the plan detail notches, the Lock Machining sheets of the one handle,
  two handle and single door cases, the generated plate outlines against the kits and the keep faces against KEEPS),
  `verify/parity/t44_doors_v3.mjs` (every 3.10 row, thresholds, vents, handing, migration, controls, BOM),
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
