<!--
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
-->

# Meeting room partition walls: as built (v1, 25.10.2026)

Owner input (Piotr, 25.10.2026, chat, on the Windmill Street DXF): one 6/16/6 unit per screen with applied 22 bars,
rebate 18, glass = opening + 27, members and leaf 54 deep, no threshold, panels and mid rails selectable, dowels
8 mm three per joint and no screws, L shaped members, Enduro 102 x 76 x 3 radius fire hinges, handle 1000 with a
normal latch, the door opens from the room outward, the 20 element a wider decorative board, one straight wall per
record, solid oak, the hinge rule as the single door, "KODU CO CHCESZ" for the rest. Chat change on `main` f4b0e47.
Items for Piotr: `BLOCKERS.md` 34.x. Verdict and the file list: `BUILD-LOG.md` (25.10.2026). What Piotr sees:
`CO-ZMIENIONE-walls-2510.md`.

## 1. The model in one page

Every number lives in `DEFAULT_PARTITION_PROFILE` (`src/engine/profile.js`, schema 1) and is editable in Window
Settings > Partition. `derivePartitionWindow` (`src/engine/partition.js`) is the only place that turns it into sizes;
the lists, BOM, pricing, sheets, PDFs and the pack read `derived.partition`. A wall is a window record of the batch
type 'partition' (`windowSpec.category 'partition'`, `windowSpec.partition { layout, doorWidth, lights,
panelHeight, hingeSide, swing }`).

**Coordinates.** x from the LEFT outer face of the left end board, y from the TOP of the head board; the floor is
y = H. The FRONT face is the corridor side (the plan drawing's front, the layout is read left to right from there);
the beads and the door stop are on the ROOM face; the door swings out to the corridor (`swing 'out'`). z in the
sections runs from the front face (0) to the room face (depth).

**The section rule (every member, the L).** depth 54 (`depth`); a solid upstand on the front face, the glass zone
behind it (unit 28 + 2 x 1 tape = 30, `glazing.unit`, `glazing.tape`), a bead 18 x 12 on the room face
(`elements.bead`); upstand = 54 - 30 - 12 = 12 (derived; under 8 the engine throws). The rebate goes 18 into the
member width (`glazing.rebateDepth`) and 42 into the depth (the pocket from the room face to the upstand); the unit
sits 13.5 into it (`glazing.glassIn`: unit = daylight + 27) on 4.5 packers (`glazing.packer` = the play 18 - 13.5).
Rails are cut square at the field width with THROUGH rebates; posts and stiles carry STOPPED pockets, one per
opening, 18 longer than the opening at each end; the beads mitre inside (length = daylight + 36). The solid panel is
30 thick (`panel.thickness`) and takes the same pocket and beads (`panel.panelIn 13.5`).

**The layout string.** `partition.layout` holds S (glazed screen) and D (door) only, left to right from the
corridor (`normalisePartitionLayout`: 'sds x' reads SDS). Posts stand between the fields and at both ends (fields
+ 1). The end boards 20 x 74 (`elements.board { face 20, overhang 10 }`: depth + 2 x 10 wide, 10 proud each face)
stand on the floor under a head board of the wall width; the top rail 50 x 54 runs in ONE piece between the end
boards over the posts; every post runs from the top rail underside to the floor (no threshold).

| | the bay 2525 x 2165 SDS, door 800, 3 lights, panel 790 | rule |
|---|---|---|
| inner width | 2485 = 2525 - 2 x 20 | W - 2 x board |
| posts | 4 x 50 at x 20 / 812.5 / 1662.5 / 2455, roles end / hinge / lock / end, 2095 long | fields + 1; length = H - board - topRail = 2165 - 20 - 50 |
| screens | 742.5 each at x 70 and 1712.5 | (inner - posts x 50 - doors x doorWidth) / screens; under 200 throws |
| glazed zone | y 70 to 1275, h 1205 | top rail underside to the mid rail (or the bottom rail with panelHeight 0) |
| lights | 3 x 387 at y 70 / 479 / 888; bars 22 x 8 at y 457 / 866 | (zone - (lights - 1) x 22) / lights; under 100 throws |
| mid rail, panel, bottom rail | 50 at y 1275; panel 790 at y 1325 (size 769.5 x 817 x 30); 50 at y 2115 | bottom rail on the floor, the panel above it, the mid rail above the panel |
| screen unit | 769.5 x 1232, bars 2H at 411.5 / 820.5 from the unit top | daylight + 27 each way; bar axis + 13.5 |
| top rail pockets | 32 to 810.5 and 1674.5 to 2453 (x from the rail's left end), 18 x 42 | screen x - 18 - board to screen x + w + 18 - board |
| post P1 pockets | glass 0 to 1223, panel 1237 to 2063 (from the post top), right side | zone and panel 18 past each end |
| lock post | blank 67 x 54, the 17 x 31 stop lip on the door side, room face | post + stopWidth; 31 = depth - lipFront 20 - gap 3 |
| door opening | 800 x 2095 at x 862.5 | doorWidth; a door-only wall takes (inner - posts x 50) / doors (900: 760) |
| leaf | 794 x 2087 x 54 at (865.5, 73) | opening - 2 x gap 3; height - gap 3 - floor clearance 5 |
| leaf members | stiles 120, top 100, mid 50 on the screen mid rail axis, bottom 180 | `elements.doorStile / doorTop / doorMid / doorBottom` |
| daylight | 554 x 1102 at (985.5, 173); lights 284 / 387 / 387; unit 581 x 1129, bars at 308.5 / 717.5 | the door bars follow the screen bar lines inside the leaf zone; a door-only wall splits its own zone |
| door panel | 655 high, size 581 x 682 x 30 | between the leaf mid rail and the 180 bottom rail |
| hinges | 3 at 200 / 943.5 / 1937 from the leaf top (1892 / 1148.5 / 155 from the floor), recess 102 x 31 x 3 on the hinge edge and the hinge post P2, knuckles on the swing face | the single door rule (`hinges.fromTop 200, aboveCentre 100, fromBottom 150, tallAbove 2200`); flap = (76 - 14) / 2 |
| latch | tubular 76 case, backset 57, 1092 from the leaf top (1000 from the floor); axis 37 from the front face, spindle 74 from the lip edge, bore 16, forend and keep 57 x 25 x 2, keep bolt 16 x 15 in the P3 lip | in the REBATED part of the lock edge: axis = lip 20 + 34 / 2, spindle = backset + stopWidth |
| lock edge | lip 20 on the swing face, rebate 17 x 34 full height; the same at the leaf head (planted head stop 17 x 31 x 800 under the top rail) | `door.lipFront`, `door.stopWidth`, `door.headStop` |
| dowels | 54 in 18 joints, 8 x 40, three per joint | 4 post tops + 2 ends x (bottom + mid) x 2 screens + 2 ends x 3 door rails |
| weights | leaf 54.1 kg (hinge 120 kg); timber by `kgPerM`, glass 30 kg/m2, panel 700 kg/m3, margin 5 % | `glazing.kgPerSqm`, `panel.densityKgM3` |

**The joint rule (`src/engine/partitionJoints.js`).** `bodyBand(face, 18, { low, high })` is the solid band of an
end face: the face width less the rebated edges (a post with one screen side: [0, 32] or [18, 50]; a mid rail or a
post between two screens: [18, 32]; the door top rail: [0, 82]; the door bottom rail above the panel: [18, 180]).
`dowelHoles` places `perJoint` holes in that band over the depth behind the upstand: the triangle `pattern50`
[[10, 20], [22, 33], [10, 46]] (across from the solid edge, depth from the front) when the body is at least 2 x
dia + 2 wide and narrower than the row threshold; a row of three at `rowDepth 33`, `rowMargin 15` in from the body
edges, in bodies 62 and wider (82: 15 / 41 / 67; 162: 33 / 99 / 165); else a vertical row at the body centre spread
from upstand + 6 to depth - 6 (14 wide: across 25, depths 18 / 33 / 48). Every hole { across, depth } is in the
member's own end face coordinates; `derived.partition.joints[]` names the element, the end, the part it goes into,
the body band and the holes; the rail holes appear again on the stile sheets as edge operations.

**Hinge side and swing.** `hingeSide 'left' | 'right'` (seen from the corridor): the hinge post is the post on that
side of the door field, the lock post the other one and it takes the lip (`lips.left` on P3 of the bay with the
left hand door, `lips.right` on P2 with a right hand door). `swing 'out'` (default): the swing face is the FRONT
(the knuckles and the leaf lip there), the stop face the ROOM; `swing 'in'` mirrors both. The latch always sits in
the rebated part of the lock edge, so its axis is measured from the front face either way.

**Errors.** `PartitionGeometryError` (name, message, `.details`): a wall too narrow for its layout (screens under
200), a door opening or daylight too narrow, a glazed zone or lights under 100, an upstand under 8. The window page
shows the message as any derive error.

## 2. Where it lives

- Profile, migration, snapshot: `engine/profile.js` (`DEFAULT_PARTITION_PROFILE`, `migratePartitionProfile`,
  `setActivePartitionProfile` / `getPartitionProfile`, `withProfiles(sash, casement, door, partition, fn)`),
  `stores/windowProfileStore.js` (the 'partition' kind, `PARTITION_PATH_ROOTS`, `setPartitionPath`,
  `resetPartitionToDefaults`, the cloud merge), `stores/projectStore.js` (batch `_profileSnapshot.partition`,
  `BATCH_DEFAULTS.partition`, the partition* item fields).
- Engine: `engine/partition.js` (`derivePartitionWindow`, `normalisePartitionLayout`, `partitionFields`,
  `PartitionGeometryError`), `engine/partitionJoints.js` (`dowelHoles`, `bodyBand`), `engine/records.js`
  (`createComponentRecord`, `round`, `parseSection`, moved out of `calculations.js`), `engine/calculations.js`
  (the dispatch), `engine/specification.js` (the partition block, frame depth, glazing 28 / 6/16/6),
  `engine/doorHardware.js` (`doorHingePositions`, `doorHingeCount` reused with the partition hinge block).
- Lists and BOM: `engine/lists.js` (the W- pre-cut rule, 'Oak (solid)', the applied bar rows with `barAxes`, the
  partition hardware list, `CUT_LIST_ORDER` W- entries), `engine/partSymbols.js` (W- stripped on the sheets),
  `engine/partColours.js` (`wall_frame`, `wall_leaf`), `engine/bom.js` (no counterweights / paint; hardware lines),
  `utils/precutPdfExport.js` (the partition colour key page), `utils/glassDxfExport.js` (the category allowed).
- Pricing and config: `engine/pricing.js` (`calculatePartition`, `DEFAULT_PRICING.partition`),
  `utils/windowSpecToConfig.js` (the flat partition config; the 3D renders a placeholder).
- Sheets: `components/drawings/partitionDrawUtils.js` (`partitionSheetPlan`, `postGroups`, `groupPartitionGlass`,
  `partitionPlanGeometry`, `partitionVerticalSection`, `memberSheetItems`), `PartitionSheet.jsx` (the DoorSheet
  pattern: one plan entry mounted as its sheet), `PartitionElevation2D.jsx`, `PartitionLeaf2D.jsx`,
  `PartitionMember2D.jsx`, `PartitionSection2D.jsx`, `DoorGlassDrawing2D.jsx` (the partition units),
  `DrawingsPanel.jsx` (the tabs), the PDF rig, the Elements PDF and the production pack mount the same plan.
- UI: the batch type "Partition walls" (`ProjectDetailPage`, `DashboardPage`), the configurator "Partition Wall"
  section (`ConfiguratorPage`: layout, door opening width, lights per screen, panel height, hinge side, swing; the
  wall size is the Dimensions section), Window Settings > Partition (`WindowSettingsPage` `PartitionSettings`),
  the 3D placeholder (`ThreeDPanel`, `WindowPreview3D`, `Window3DCaptureRig`).
- Tests: `verify/parity/t50_partition.mjs`.

## 3. The sheets

`partitionSheetPlan(derived)` is the one list the Drawings tabs, the PDF rig, the Elements PDF and the production
pack mount (the Front Elevation is its own tab in front of it): `wallleaf-N` (Door Leaf), `wallpost-<group>` (one
per post group: End Posts P1, P4 / Hinge Post P2 / Lock Post P3 on the bay; a mirror image shares the sheet and is
named on it), `walltoprail` (Top Rail), `wallrails` (Screen Rails, when there are screens), `wallstiles-N` (Door
Stiles), `walldoorrails-N` (Door Rails), `wallsection` (Sections). `groupPartitionGlass` gives one glass drawing
per unique unit (769.5 x 1232 with 2 panes, 581 x 1129 on the bay), rendered by `DoorGlassDrawing2D`.

- **Front Elevation** (`PartitionElevation2D`): the wall from the corridor in the door drawing system (mm, dark
  theme, non-scaling strokes): boards, top rail, posts, the screens with lights, applied bars, mid rail, PANEL and
  bottom rail, the leaf with its lights, bars, panel, opening symbol, hinge barrels (when the knuckles face the
  front) and the handle; the overall width at the top, the heights on the right (the handle 1000 and H), the field
  chain along the bottom (boards, posts, fields), the member chain on the left through a screen, the leaf height;
  the notes name the layout, the screen and door numbers, the finish, the faces and the dowel count.
- **Door Leaf** (`PartitionLeaf2D`): the leaf alone with the stiles and rails labelled from the cut list records
  (DS/H, DS/L, DTR, DMR, DBR with their lengths and sections), the daylight and the unit edge (dashed), the applied
  bars, the panel with its outer size, the opening symbol, the lock edge rebate line, the hinge recesses on the
  hinge edge, the latch forend and the lever; chains: the stiles along the bottom, the rails / lights / bars on
  the left, the hinge centres on the right, the handle above the leaf bottom (and above the floor), the spindle
  from the lock edge; the notes give the opening and the gaps, the unit, the hinges and the latch.
- **Member sheets** (`PartitionMember2D`, the CNC sheets: posts, top rail, screen rails, door stiles, door rails):
  the member laid down at 1:1 with its length along the sheet and its face across: VERTICAL MEMBERS (posts and
  stiles) are shown with the ROOM face up (the pockets open to the room) and the TOP end at the LEFT, so the edge at
  the top of the drawing is the one facing LEFT in the front elevation; RAILS are shown from the FRONT with the top
  edge up and the left end (as the elevation shows it) at the left. Above and below the face strip the two edges
  are unfolded as bands (the front face at the outer side) carrying the edge operations: hinge recesses, the latch
  forend and bore, the keep plate and keep bolt pocket on the lock post lip, the dowel holes the rails bring into
  the stiles and the posts bring into the top rail underside, the planted head stop; on the face: the stopped
  pockets (hatched), the through rebates, the stop lip from solid, the lock edge and head rebates (the cut away
  part hatched), the spindle bore. Every feature is numbered: a callout over the strip, a row in the operation
  table (from / to / length / width / depth / where) with its detail line, and a chain of the feature edges and
  centres along the bottom. A member longer than the sheet is folded into rows ("continued"). The END FACES at
  up to 3:1 (smaller for the wide door rails) draw the L (the pocket and lip cut away) with the numbered dowel holes and their coordinates (across from
  the top edge of the drawing, depth from the front face, 20 deep). The notes repeat the orientation rule, the
  pocket and dowel numbers, the mirror images and (on the stiles) the hinge and latch.
- **Sections** (`PartitionSection2D`, by the sheets agent, from `partitionPlanGeometry` and
  `partitionVerticalSection`): the PLAN through the glazed zone (end boards proud, posts with their pockets and the
  lock post lip, the units with their panes and spacers, the beads on the room side, the leaf closed with its
  stiles, the lock edge rebate, the knuckle and the swing arc) and the VERTICAL sections through a screen (head
  board, top rail pocket, unit, applied bars with the dummy spacer, mid rail, panel, bottom rail on the floor) and
  through the door (the planted head stop, the leaf top rail with its head rebate, the mid and bottom rails, the 5
  above the floor).
- **Glass drawings** (`DoorGlassDrawing2D`): one per unique unit with the 6/16/6 makeup, the applied bars at their
  axes and the dummy spacer, the panes listed (screen S1, S2; door D1 with the safety glass note).

The harness renders every sheet through `renderToStaticMarkup` and checks: svg, no NaN / undefined / long dash,
no two texts overlapping (`verify/arch/lib/textCollision.mjs`); the dimension rule (`dimRule.mjs`: the overall
width on top, the heights on the right, the chains along the bottom and the left) on the elevation, the leaf, the
Sections sheet and the glass drawings. The member sheets are folded CNC sheets with a dimension chain under every
row, so the rule's "no horizontal dims in the top half" clause cannot hold for them by design: they are checked
for their face and end captions and for the large length dim over the first row and the rotated 'face N' dim at
its right.

## 4. The lists

- **Cut list** (`buildCutListForWindow`): every record of a wall is a W- element with a `code` (W-HB, W-EB, W-TR,
  W-P, W-PL, W-MR, W-BR, W-GB, W-BD, W-HS; the leaf W-DS/H, W-DS/L, W-DTR, W-DMR, W-DBR, W-DGB, W-DBD), material
  'Oak (solid)', the section as face x depth (50x54, 67x54, 120x54, 100x54, 180x54, 20x74, 22x8, 18x12, 17x31),
  the length to 0.1 and a note (the post roles, the rebates, the hinge recesses, the latch position, the bead
  side). The bay: 19 box + 10 sash records. `buildGroupedCutList` groups by `CUT_LIST_ORDER` into the symbols HB,
  EB, TR, P, PL, MR, BR, HS, DS-H, DS-L, DTR, DMR, DBR, GB, DGB, BD, DBD (the W- prefix stripped on the sheets by
  `displayCode`), the notes kept.
- **Pre-cut** (`buildPrecutForWindow`): the W- members follow the door rule (the assigned material, else the
  section map, else the finished section; never the sash face lookup), so without an assignment the groups are the
  finished sections (50x54 with 7 items, 120x54 with 2 on the bay), every straight piece + the pre-cut allowance
  (10); `boxSapele` stays empty. The pre-cut PDF carries a partition colour key page (`wall_frame`, `wall_leaf`).
- **Glass list** (`buildGlassListForWindow`): one row per unit from `customGlassUnits` (769.5 x 1232 screen S1 /
  S2, 581 x 1129 door D1 left), makeup 6/16/6, `bars` "2H x 0V applied", `barsH`, `barAxes.y` from the unit top
  (411.5 / 820.5; 308.5 / 717.5), the batch spacer and finish; the glass DXF export accepts the category.
- **Hardware** (`buildHardwareList`): Door hinge (the Enduro name, per door the count, hand and swing), Tubular
  latch (76 case, 57 backset, per door), Lever handle set (on rose, the batch finish, 1000 from the floor), Dowels
  (8 x 40 hardwood, 3 per joint, the wall count). No `enginePart` rows yet (no Assign Materials rows for W-).
- **BOM** (`buildWindowPartQtys`): no counterweights and no paint rows for a wall; the glass m2 and the hardware
  lines go through. **Weights**: `derived.weights { timber, glass, panel, total, leaves[] }`.
- **Pricing**: `calculatePartition` = wall m2 x `basePerSqm` + doors x `doorLeafPrice`, both 0 until PSW sets them.

## 5. Verification (`verify/parity/t50_partition.mjs`)

Run: `node verify/parity/t50_partition.mjs` (bundles the live src with esbuild like t49; while
`PartitionSection2D.jsx` is missing it bundles the leaf and member sheets without `PartitionSheet.jsx`, prints a
SKIP line and counts one FAIL per case for the missing Sections sheet). Sections:

1. the profile keys, `migratePartitionProfile` (a copy with depth 60 keeps it, the rest from the default; null is
   null), the store (`setPartitionPath` numbers and string leaves, an unknown root / leaf / non-number refused,
   the engine sync, `resetPartitionToDefaults`), `withProfiles` with the 4th argument and the older forms;
2. the spec: category, the partition block, frame depth 54, glazing 28 / 6/16/6, 'sds x' to SDS, no partition key
   on a casement, a sash, a door;
3. the bay geometry: every number of the table in section 1;
4. the dowel joints: 54 in 18, the triangle [0, 32], the rebated post [18, 50] 28 / 40 / 28, the narrow row at 25,
   the wide rows (82: 15 / 41 / 67; 180: 33 / 99 / 165), every hole clear of the upstand and the room face;
5. the records: every W- record with its section, length, quantity and code; the glass units, the panels, the
   weights (leaf 45 to 65 kg), the consumables;
6. the lists: 'Oak (solid)', the 17 grouped symbols with their notes, the pre-cut groups and the allowance, the
   glass rows with `barAxes`, the hardware lines and their details;
7. pricing and config: `windowSpecToConfig`, `calculatePrice` 0, `DEFAULT_PRICING.partition`;
8. variants: SS 2000 (the mullion post rebated both sides, its narrow row), D 900 (door 760, 2 posts, the door
   splits its own zone), panelHeight 0 (no mid rail, one pocket to the bottom rail, the door glazed full), hinge
   right (hinge post P3, the lip on P2's right), swing in (the faces mirrored); the errors (a 1200 SDS wall, 20
   lights) with `.details`;
9. controls: a casement 1200 x 1200, a sash 900 x 1500 and a door 900 x 2100 derive with no partition key, no
   Dowels line;
10. the sheets: the plan keys and labels, `postGroups`, every sheet of the bay and of the SS, D and panelHeight 0
    variants through the collision and NaN checks, the dimension rule on the non-member sheets, the face and end
    captions and the large dims on the member sheets, the elevation texts (2525, 2165, 742.5, handle 1000), the
    leaf (794, 2087, 554, the hinges, the unit, the panel), the post sheets (P1 / P4 mirror, the dowel
    coordinates "n: across / depth" and the "(across, depth)" table pairs, the hinge recesses, the stop lip, keep
    plate and keep bolt pocket), the top rail pockets, head stop and post dowel holes, the rails, the stiles (lock
    edge rebate, spindle 74, the rail holes in the glass edge), the door rails (the wide rows, the head rebate),
    the glass drawings; the Sections sheet prints 'PLAN 1:1' and a head detail (the dimension rule of the
    elevations governs the elevation, the leaf and the glass drawings only: the member sheets and the Sections
    sheet are multi-detail sheets with chains under every row or window). Final run 25.10.2026: 139 passed, 0 failed.

Controls: `node verify/arch/t27.mjs` (the engine grep gate for bare workshop numbers; the partition engine files
are in its scope), t41 section 17 (the casement and sash keys), t49 (the door store setter the partition one
copies).

## 6. Assumptions and next steps

The assumptions are `BLOCKERS.md` 34.1 to 34.18 (the 12 / 30 / 12 split, the 22 x 8 bars and the dummy spacer, the
30 panel, the stopped pockets and through rebates, the dowel pattern, the stop from solid and the planted head
stop, the hinge knuckle 14, the tubular latch numbers, the lock edge rebate, the glass and weights, the pricing
placeholders, no BOM rows, the 3D placeholder, one wall and one door, the door bars, swing in, the unanswered
mockup questions, the superseded DXF numbers).

Next steps, in order:

1. Assign Materials rows for the W- parts (an oak stock per section, the beads and bars from the small stock) so
   the pre-cut groups by stock and the BOM carries the oak metres.
2. Pricing rates (`pricing.partition.basePerSqm`, `doorLeafPrice`) from PSW, then the configurator price.
3. The 3D model of a wall (boards, posts, rails, units with applied bars, the leaf) in `windowSpecToConfig` and
   the 3D App; until then the placeholder.
4. Corners and returns (two walls meeting), more than one door per wall on the sheets and in the hardware list,
   a fanlight over the door.
5. The DXF export of the members with their pockets, recesses and dowel holes (the member descriptors of
   `memberSheetItems` already carry every feature in member coordinates), for the CNC.
