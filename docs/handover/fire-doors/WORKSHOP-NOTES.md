# Fire doors: workshop notes (source material for the fire doors tura)

Collected 27.10.2026 from the owner's files and his notes (Petros, cabinet `warsztat/biesse`). Read-only reference. Numbers here are what the files say; where something is a reading or a guess it says so.

Files in `source/`:
- `FD_LEAF_MASTER_PIOTR.bSolid`: the owner's bSolid leaf master (saved 10.10.2026 16:12, bSuite 14.5.41.0, machine RoverA_1532). A ZIP: `document.bSolid` (binary), `Tools/` (12 tool definitions), table setup XML.
- `KIT_DOOR_SINGLE.lsp`, `KIT_DOOR_DOUBLE.lsp`: the owner's AutoCAD drawing kits (3 views: outside, inside, plan closed + open 30).
- `weeke/*.mpr`: 7 WoodWOP programs from the OLD machine (Weeke BHC), door leaves.

---

## 1. The bSolid leaf master

- Board: LPX 2040 x LPY 926 x LPZ 44 (LPX = door height, LPY = width, LPZ = thickness; owner decision 09.10.2026).
- One macro: P1528 `Master_Door_PIOTR` (library path `C:\BIESSE\bSuite\Macro\Master_Door_PIOTR\Master_Door_PIOTR.bSolid`, a copy of the previous owner's `Master_Door`, tools remapped to the owner's tools on 10.10.2026, 0 errors).
- Document variables: ONLY LPX, LPY, LPZ. Everything else is a parameter INSIDE the macro. A worklist (.ewlist) row can only set document variables, so today PC could change the board size and nothing else. To drive hinges, lock etc. from PC the owner must add document variables with the same names and bind the macro parameters to them.
- Tools in the file: 20RUS, 12RDS, 12RDS_MF, 16MMROUTER, 10_125_DISK (owner's) plus 12MM-ROUT, 12MM-HINGE, 12MM-SPY-CUTTER, 16MM-LOCK-HINGE, 20MM-SHORT-CUT, 10MM-GROOVE-SAW, REBATE-BLOCK (previous owner's definitions imported to the office database).

### 1.1 Macro parameters and the values saved in the file

| Parameter | Saved value | Meaning (from the macro conditions and form) |
|---|---|---|
| HAND | 1 | 0 / 1 = LH / RH ("Stan Hinge LH" = `(hinge = 0) & (hand = 0)`) |
| LH, RH | 0, 0 | used by the leading edge: `(lead_edge = 1) & (rh = 1)` |
| HINGE | 1 | 0 Standard, 1 Fire |
| LOCK | 2 | 1 Stan lock, 2 FD30 Lock, 3 FD60 Lock |
| LOCK_H | 1000 | spindle height |
| SPINDLE | 1 | spindle hole on / off |
| EURO | 1 | euro cylinder hole on / off |
| KEEP_STYLE | 0 | 1 keep lock, 2 dead lock keep |
| KEEP | 2 | 1 Stan, 2 FD30, 3 FD60 |
| INTU_STYLE | 1 | see 1.3 |
| VP_STYLE | 0 | see 1.2 |
| C_VP_L / C_VP_W / C_VP_NUM / C_VP_RAIL / C_VP_POS | 600 / 150 / "3" / 100 / 0 | custom vision panel (style 14), POS 0 or 90 |
| D_TOP_RAIL / D_MID_RAIL / D_SIDE_MARGIN / MID_RAIL | 150 / 450 / 150 / 212 | vision panel placement |
| VP_FIRST_CUT / VP_SECOND_CUT | "20RUS" | tools for the VP |
| LEAD_EDGE | 1 | leading edge bevel, expression `(lpz < 50) * -8 + (lpz > 50) * -8` |
| REBATE / REBATE_STYLE | 1 / 1 | meeting rebate for pairs: 1 "Rebate & Meeting Style RH pull FD30", 2 "RH Pull none FR", 3 "LH Pull None FR", 4 "LH Pull FD30". Looks wrong ON for a single door: ask the owner |
| SPY_ON / SPY_H | 0 / 1450 | spyhole |
| LBOX / L_BOX_H | 0 / 1000 | letter box |
| DROP_CILL | 0 | drop down seal |
| PREM_DOOR | 0 | conditions `(lpz = 44) & (prem_door = 0/1/2)` |

### 1.2 Vision panel styles (macro labels)

1 450mm Square; 2 150mm x 760mm/150mm x 450mm; 4 150mm x 1410mm; 5 350mm Diamond; 6 2No. 150mm 800mm; 7 3No 200mm 450mm; 8 5No 200mm 500mm; 9 450mm x 700mm; 10 150mm x 760mm; 11 508mm x 1500mm; 12 150mm x 700mm/150mm x 700mm; 13 5No 200mm 200mm; 14 Custom. (No style 3 found.) Expression samples: `lpy / 2 - h / 2` (centred across), `Mid_rail + d_top_rail + 760`, `d_top_rail + 247.5`, `w + d_mid_rail`.

### 1.3 Intumescent styles (macro labels)

1 15mm x 4mm Intu Strip Lock Center; 2 20mm x 4mm Intu Strip Lock Center; 3 2No 10mm x 4mm; 4 2No 15mm x 4mm; 5 15mm x 4mm Central 2L Top; 6 20mm x 4mm Central 2L Top; 7 2No 15mm x 4mm 2L Top; 8 15mm TH + 2No 10mm x 4mm; 9 Single 10mm for Pair; 10 15mm TH + 1No 10mm x 4mm Pair; 11 15mm TH; 12 2No 15mm x 4mm Top&Hinge; 13 20mm TH. Groove tool 10MM-GROOVE-SAW (owner: 10_125_DISK), groove 15.5 for a 15 strip (two passes). Sample depths: `lpz / 2 - 2.75`, `lpz / 2 + 2.75`, `lpz - 7`.

### 1.4 Hinges in the macro

Spacing expression `(lpx - 150 - 200 - w) / (repn - 1)`; the file stores 794 for LPX 2040 (w = 102, repn = 3). So: first hinge 150 from one end, last one ends 200 from the other end, equal spacing. Which end of LPX is the door top is NOT confirmed. Other hinge numbers seen: `29.5 + 7` = 36.5 and `7 + 5` = 12 (reading: recess width about 29.5 plus a 7 run-out; not confirmed). Fire hinges cut spirally with a 12 mm cutter, corners R6 (owner note 10.10.2026).

### 1.5 Lock and keep expressions in the macro

`lock_h - 107.5`, `lock_h - 138`, `lock_h - 145`, `lock_h - 103.5`, `lock_h - 92.2`, `lock_h - 77.33`, `lock_h - 82.5`, `lock_h - 93`, `lock_h - 76.5`, `lock_h - 17.5`, `lock_h + 46.5`, `lock_h + 52.5`, `lock_h + 63`, `lock_h - 15`, `lock_h - 15 - 10`, `lock_h - 15 + 10`, `lock_h - 15 - 15`, `(lock_h - 15) - (w / 2)`. Not decoded into a drawing; the macro is the truth for the leaf cut.

---

## 2. Owner rules (Petros)

**FD30 DIN lock (10.10.2026)**: bathroom and sashlock euro cases identical. Forend 235 x 24, ends full radius (R12). Case 85 deep x 150 high, 14 thick. Backset 60. Euro centres 72, bathroom 78. Keep (frame) 175 x 39, radius ends.
Clearances: every plate (forend, keep, hinges) milled 1 mm larger (0.5 a side) for paint: forend 236 x 25, keep 176 x 40. Case pocket 17 wide (14 + 3 for the intumescent wrap); depth and height to confirm (proposal 87 x 153). Standard = latch without cylinder; bathroom and euro are special. One pocket for all, the cylinder / WC hole only on request (flag LOCK_TYPE = LATCH / BATHROOM / EURO), on condition the standard latch has the same 235 / 85 / 150 case. Case tool 16 mm.

**Doorset decision (09.10.2026)**: bSolid masters FD_LEAF (from Master_Door) + FD_HEAD, FD_JAMB_HINGE, FD_JAMB_LOCK. Board sizes = built-in LPX / LPY / LPZ. Frame computed by formulas from the leaf variables (e.g. jamb length = leaf height + top gap + floor gap + rebate; hinge recess = HINGE_n + top gap); hinges and lock entered once, for the leaf. PC: DOORSET record -> 4 .ewlist rows with the same variables, Label = door ID, list sorted by program type (leaves, heads, jambs) with a STOP row between blocks (manual p. 1244) to re-tool the table. Nothing moves from bSolid into PC: PC holds master paths and the variable dictionary. FD30: 3 hinges, rebate milled from solid. Fire doors = a module of Production Core, not a separate program; compliance = Fire Desk (separate software).

**Vision panel (05.09.2026)**: router only, through pocket, about 12 mm cutter, several passes, last on a 0.5 skin or 3 to 4 bridges; corners R = half the cutter (hidden under FD30 beads). Not the saw (300 saw ramp 84 mm on 44).

**Worklists (14.09.2026, 06.10.2026)**: bSolid reads programs from INSIDE the .ewlist (`Programs\NAME.bSolid`). On 06.10 the casement mullion / transom macros were NOT inserted from the worklist although the list showed fine. Lesson: prove that the master reacts to document variables from a worklist before trusting the export.

**27.10.2026 conversation**: numbering FDR-01 (fire) / DR-01 (non fire). Widths: standard sizes as suggestions, never forced. Frame timber 63 thick machined to 50, width 100 to 200 (= frame depth from the wall). Frame will be machined on a 5-axis CNC; PC computes hinges (heights, depth, type) to match the bSolid leaf, keeps on the opposite jamb, and all elements.

---

## 3. KIT_DOOR_SINGLE.lsp / KIT_DOOR_DOUBLE.lsp (drawing kits)

- Leaf 44; standard widths 626 / 686 / 726 / 762 / 826 / 838 / 926 / 1056; height default 2040.
- Outside view: frame face 35, gap 3 sides and head, frame foot 5 below the leaf; head corners mitred 45. Inside view: frame face 50 (covers the leaf edge by 12), leaf dashed.
- Plan: jamb with a rebate notch 15 wide (12 overlap + 3 gap) and 47 deep (leaf 44 + 3); frame depth from the prompt (default 100). The plan draws the jamb 45 wide; the elevations use 35 + 15 = 50 (the owner's 50 is binding).
- Hinges 3 x 102 x 10 (drawing symbol): top 145 from the top, middle 700 from the top, bottom 200 from the bottom.
- Handle rose R27.5 at 1000 from the leaf bottom, 60 from the lock edge; lock symbol at 922 (euro or bathroom). Opening drawn 30 degrees.
- Single handing: "Open way L/R"; L = hinges on the right in the OUTSIDE view (so on the left seen from inside).
- Double: input overall frame size; frame width = leaves + 3 + 76 = leaves + 79; height = leaf + 43; centre gap 3; active leaf rebated 12 at the meeting edge; handle leaf asked from INSIDE and mirrored for outside.

## 4. Old Weeke programs (`weeke/*.mpr`, WoodWOP 4.0, WEEKE BHC)

- Board = leaf: L (height) 2040 or 2001, W 726 / 826 / 831 / 832 / 1026 / 1056, T 44 or 45.
- Hinges: component `ASkyloonJoinery/r8hinge.mpr` x 3, at 145 / 700 / 1722 from the top (LH files measured from the other end: L-247 / L-802 / L-1824, same places with a 102 offset). Fixed vars H1 0, H2 516, HINGE2 1, H3 915, HINGE4 0, H4 355, DS 1. Recess depth `HD` -3.2 / -4 / -4.2. One test file (826_lh_test) has the top hinge at L-147 (looks like a typo).
- Concealed closer: component `ASkyloonJoinery/concealed_closer_lhits11.mpr` (4 files) or `concealed_closer_RHits1120.mpr` (2 files), at XA 0, no parameters. The component files themselves are NOT in this pack, so the recess sizes are unknown. Two files named "rh" use the lh closer component.
- Lock: two horizontal edge pockets (HTasc) centred in the thickness (Z 22 / 22.5) around 920 to 1120 from the bottom:
  - farrington d01 / 18cc oak: case 185 x 21, 105 deep; forend 236 x 25, R12.2, 4 deep.
  - 18cc rozne / rh 726: case 170 x 20, 95 deep; forend 236 x 25 (once 237 x 26), R12.2, 3.5 / 6 deep.
  - farringtonrh d05: case 30 x 20, 90 deep; forend 60.5 x 25.5, no radius (a small latch).
- The old machine cut different lock cases from the DIN lock the owner now uses (85 x 150 x 14).
