<!--
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
-->

# Casement leaf 64 and transom seat 8.5: as built (06.10.2026)

Owner decisions (Piotr, 06.10.2026), branch `claude/casement-leaf-64`, from `main` at 5459f5b.

## A. Leaf members 64 (were 67)

- `src/engine/profile.js`, `DEFAULT_CASEMENT_PROFILE.elements`: `leafStile`, `leafTop`, `leafBottom` `face: 64`.
- The glass deduction follows the face: `deductions.glass` 105 = 2 x (64 - 11.5) (was 111). `glassInset` 11.5,
  leaf depth 57 (61 triple), leaf outer sizes and every `deductions.leaf*` value are unchanged.
- **One source for the deduction**: `casementGlassDeduction(profile)` in `profile.js`. The engine, the leaf /
  glass / production elevation sheets and Window Settings read it; the sheets print the engine's own glass unit
  (`derived.customGlassUnits`). The stored `deductions.glass` is rewritten to the derived value on every
  migration and on every store write of the face or `glassInset`, so it can no longer disagree with the face.
- Stored profiles: **`leafSchema: 2`**. A copy below 2 moves each face that still equals 67 to 64; a hand-edited
  face is kept.
- Effect per window: section 64x57, glass + 6 in width and height (040L 1000 x 1200: 793 x 997), beading and
  bead tape a little longer, leaf a little lighter (27 -> 26.8 kg), hinge slots unchanged in every window checked.
  Arched leaves: the glass line 3 mm further out, the curved top rail longer by 1.5 mm x its sweep, and some
  blank plans change (1000 x rise 200: 2 x 150 instead of 1 x 180).
- Assign Materials: the three leaf slots read `64×57`; assignments are by slot id and stay as they are.

## B. Transom seat 8.5 (was 8)

- `lengths.transomSeat: 8.5`: `C-TRANSOM` and `transomRuns[].length` = field leaf width + 8.5 (021 1000 x 1200:
  906.5; Pre-Cut 927).
- Stored profiles: **`lengthSchema: 2`**. A copy below 2 moves `transomSeat` only while it equals 8.
- `partialMullionSeat` stays 8 (provisional; BLOCKERS 27.3).
- Display: one decimal on the frame sheet and in bSuite (906.5); the cut list and the Pre-Cut finished column keep
  their whole-mm rule (907; BLOCKERS 27.7 b).

## Proof

`node verify/parity/t38_leaf_64_seat_85.mjs` (311 checks against the start commit), plus the whole suite; see
BUILD-LOG 06.10.2026.

## What PSW would have to check to match

PSW (Prime-Sash-Windows) is not in this repository; nothing there was read or changed.

1. **3D**: PC's casement 3D (`src/3d/components/casement/CasementPanel.jsx`, a PSW parity copy) already draws the
   leaf at 64 (`SASH_RAIL = 64`). Confirm PSW's own `CasementPanel` has the same 64: then the engine and both 3D
   previews agree, and nothing changes in PSW's 3D.
2. **Estimate renderer** (`js/estimate-renderer.js`, not in this repo): check whether its 2D casement drawing uses
   a leaf member width (67) or a glass deduction (111 / 109) anywhere, and whether any glass size, glass area or
   price is computed from them. If so, move it to 64 / 105.
3. **Price calculator**: check whether casement glass m² or glazing bead metres are priced from the leaf minus a
   fixed deduction; with 64 every unit is 6 mm larger each way.
4. **Transom length**: check whether PSW computes or prints a casement transom length with a seat of 8; PC now
   uses 8.5.

## C. Correction 07.10.2026: the bottom rail is 67

Owner box (Piotr, 07.10.2026), branch `claude/casement-bottom-rail-67`, from `main` at bdd2092 (= 95a83e9, the merge
of PR #11, plus the brief). Section A above made all four leaf members 64; the owner wants the **bottom rail 67** and
only the stiles and the top rail 64. As built:

- `profile.js`: `leafStile` 64, `leafTop` 64, **`leafBottom` 67**; **`leafSchema: 3`**. A stored copy migrates by
  the schema it is on: schema 1 (67 all round) moves each face of 67 to today's default (64 / 64 / 67); schema 2
  (64 all round) moves only the bottom rail 64 -> 67; schema 3 is left alone; a hand-edited face is kept.
- **Two glass deductions, one source**: `casementGlassDeductions(profile)` = width `2 x (stile - 11.5)` = 105,
  height `(top - 11.5) + (bottom - 11.5)` = 52.5 + 55.5 = 108. `deductions.glass` keeps the width (105).
  `casementGlassDeduction` (the width) is kept for the store and the migration.
- Engine: stiles 64x57, top rail / arched top rail / leaf ring 64x57, **bottom rail 67x57** (triple 67x61); glass
  `leaf W - 105` x `leaf H - 108` for every rectangular pane; the bar daylight `leaf - 2 x 64` x `leaf - 64 - 67`;
  leaf weight per member. The arched glass already took the bottom rail (glass bottom 47 + 55.5 = 102.5 above the
  frame bottom), so the arched unit is the outline with no deduction on top: the bottom rail counted once.
- 040L 1000 x 1200: leaf 898 x 1102, **glass 793 x 994**, daylight 770 x 971, beading 4110. 021 1000 x 1200: glass
  **793 x 248.2** and **793 x 606.8**.
- Sheets (leaf, front elevation, production elevation, glass, glass PDF): the bottom rail drawn and dimensioned 67,
  the vertical daylight `leaf H - 131`, the glass of the glass schedule (the leaf sheet prints it to 0.1 mm; its
  dimension chains stay on the 0.5 grid).
- Window Settings: each leaf card shows its own section; Stiles and Top rail edit both together, Bottom rail its
  own; the readout shows glass W and glass H.
- Assign Materials: Leaf Bottom Rail `67×57`.
- 3D: `SASH_BOTTOM_RAIL = 67` (exported beside `SASH_RAIL = 64`); `CasementWindow` and `ArchedCasementWindow` draw
  the 67 bottom rail, the glass `- 64 - 67` with its centre 1.5 mm higher. `FixFrameWindow`'s rectangle keeps 64.

Proof: `node verify/parity/t38_leaf_64_seat_85.mjs` (against 5459f5b AND bdd2092), `t39_settings_leaf_cards.mjs`
(Window Settings in Chromium), `t40_bottom_rail_3d.mjs` (the 3D components); BUILD-LOG 07.10.2026; BLOCKERS 28.

For PSW (not in this repository): the items above still apply with **64 / 64 / 67**: a glass height deduction of
108 (not 105) and a 3D bottom rail of 67 with the glass centre 1.5 mm higher.
