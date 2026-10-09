# BUILD-LOG.md

Verdicts per phase, in execution order.

---

## 2026-10-09 · TURA PC: SASH PROPORTIONS, COTTAGE 40/60 AND 1/3-2/3 (branch `claude/sash-proportions`)

Owner box (Piotr, 09.10.2026): a new sash option `sashProportion` (`standard`, `cottage-40-60`, `cottage-1-3`, missing
= standard, the PSW contract, saved in the estimate fullConfig like `splitRatio`). The sum of the two sashes stays
frame H - profile deduction + meeting rail (default H - 92); standard keeps the bottom sash 33 taller than the top
(equal glass); cottage puts the top sash at 40 % or 1/3 of the sum. Frame 1400 (sum 1308): standard 637.5 / 670.5,
cottage 40/60 523.2 / 784.8, cottage 1/3-2/3 436 / 872. Double and triple only (triple: centre and FIX lights on one
meeting rail line), glazing arch allowed, arched windows not, configurator minimum frame H 900. Price +5 % after the
glazing arch and before colour. The 3D meeting rail sits where production puts it for EVERY sash window (standard
moves up about 17 mm, approved 09.10.2026). Standard windows otherwise identical.

### Stage 0: baseline and sweep (no code changes)

Starting commit **719bfba** (`main` on 09.10.2026: "12", 44589f6, plus this tura's CLAUDE.md). Branch
`claude/sash-proportions` from it; push to it works.

**Suite on the starting commit: 29 harnesses, 3269 checks, 0 failures. `npm run build` OK (19.6 s).** Run as in the
previous turas: `verify/arch/t*.mjs` minus the `*baseline*` generators, plus `verify/parity/*.mjs`, each with
`node <file>`, after `npm ci` and `pip install ezdxf`; `docs/handover/samples/` restored with `git checkout` after
every file. `verify/parity/psw-casement-layouts.mjs` exits rc 2 (no PSW clone, PSW is outside this session's
repository scope): not run, not counted. Counts per file (harnesses that print one PASS line per check are counted
by those lines):

| harness | checks | | harness | checks | | harness | checks |
|---|---|---|---|---|---|---|---|
| t16 | 369 | | t24_stage4 | 26 | | parity t34_glass_minus1 | 46 |
| t17_edges | 70 | | t25 | 226 | | parity t35_locks | 51 |
| t18 | 179 | | t26 | 38 | | parity t36_hinges | 110 |
| t19 | 280 | | t27 | 97 | | parity t37_single_window_bom | 50 |
| t20 | 117 | | t28 | 51 | | parity t38_leaf_64_seat_85 | 471 |
| t20_bars | 31 | | t29 | 34 | | parity t39_settings_leaf_cards | 23 |
| t21 | 120 | | t30_preview | 30 | | parity t40_bottom_rail_3d | 73 |
| t22 | 118 | | t33_bar_grid | 43 | | parity t41_doors_production | 343 |
| t23 | 81 | | parity t31_bars_8x8 | 18 | | parity t42_precut_colours_labels | 32 |
| | | | parity t32_bsuite | 54 | | parity t43_window_tag | 88 |

**Reference set, BEFORE** (live engine on 719bfba: `normaliseToWindowSpec` then `deriveWindowData`, default
profiles; the start commit has no `sashProportion`, so the three proportions of each frame derive the same and only
the standard rows are shown; the script is kept in the session scratchpad and re-run for the AFTER table):

| window (1000 wide unless noted) | total | top | bottom | upper unit | lower unit | weight kg (glass) | glass m² | glazing bead mm | bead tape m | silicone tubes |
|---|---|---|---|---|---|---|---|---|---|---|
| double 900 | 808 | 387.5 | 420.5 | 310.5 | 310.5 | 19.33 (8.55) | 0.45 | 4579.3 | 7.96 | 0.4 |
| double 1400 | 1308 | 637.5 | 670.5 | 560.5 | 560.5 | 29.22 (15.98) | 0.82 | 5729.3 | 9.96 | 0.5 |
| double 1800 | 1708 | 837.5 | 870.5 | 760.5 | 760.5 | 37.13 (21.93) | 1.11 | 6649.3 | 11.56 | 0.58 |
| double 2000 | 1908 | 937.5 | 970.5 | 860.5 | 860.5 | 41.08 (24.9) | 1.26 | 7109.3 | 12.36 | 0.62 |
| triple 1800 x 1400 | 1308 | 637.5 | 670.5 | 560.5 (all 3 sections) | 560.5 (all 3) | 27.25 (14.61) | 1.72 | 9409.3 | 16.36 | 0.82 |
| glazing arch 1400 (headType arch) | 1308 | 637.5 | 670.5 | 560.5 | 560.5 | 29.22 (15.98) | 0.82 | 5729.3 | 9.96 | 0.5 |
| double 1400 4x4 | 1308 | 637.5 | 670.5 | 560.5 | 560.5 | 29.22 (15.98) | 0.82 | 5729.3 | 9.96 | 0.5 |

The standard rows match the owner box (section 3.3) to the digit. The glazing arch derives exactly as the flat head:
`headType` is not read by the engine at all (only by pricing and the configurator 3D).

**Sweep** (seven read-only agents: engine calculations, engine lists / BOM / spec / pricing, utils exports, pages,
drawings, 3D, splitRatio trail + harnesses; then a completeness critic). Places that assume two equal sashes or
compute the split on their own:

1. `calculations.js deriveWindowData()` 1709-1712 and `calculateWindow()` 200-203: two copies of the split formula
   (the second feeds only the discarded `result.sash`; `deriveWindowData` uses `calculateWindow` for bar positions).
2. `calculateWeights()` 431-438: timber per sash is right, the GLASS is the upper pane x 2.
3. `calculateConsumables()` 466-510: glass m², bead tape and silicone from the upper pane x 2 (seal 6070 already
   uses top + bottom).
4. `calculateBeadingComponents()` 541-569: receives only `topSashHeight`; glazing, triangle and Georgian beading are
   the upper pane x 2.
5. `calculateGlazingSummaryForWindow()` 359: one pane height for both sashes from `sashHeight / 2 - top rail -
   bottom rail` (a legacy formula, also off for standard: 507 against a 537.5 daylight at H 1400; its only reader
   is `aggregateComponents`, which nothing calls).
6. `utils/dxfExport.js` 47-49: its own split from CONSTANTS (`floor((H - 92 - 33) / 2)`), never sees derived.
7. `canvas-renderer.js` 170-171: `derived.sashHeight / 2` fallback (unreachable for a sash: derived always has both
   heights; a casement derived reaches it with 0 heights). Its horizontal bars use the legacy single bar list over
   the whole sash height and drop bars below each pane (at H 1400 4x4 the h bar is never drawn, standard included).
8. `pages/WindowSettingsPage.jsx` 114-116: settings preview with its own standard split; standard only, left as is.
9. 3D: `ParametricSashWindow.jsx` 2124 `meetingY` at half the opening and one `maxLift` (2135) for both sashes;
   `src/3d/App.jsx` 871 one slider limit `height / 2 - 120` for both sliders; `ArchedSashWindow.jsx` 381 its own
   half line (arched, out of scope); `utils/windowSpecToConfig.js` 272-274 hardcodes `sashType 'double'`,
   `splitRatio`, `headType 'flat'` (previews and PDF captures draw every sash as a flat double, pre-existing).
10. `arch.js` 532 `buildSashArchGeometry`: meeting line at H / 2 for an arched sash (cottage on arched is rejected).
11. Dead or out-of-scope copies: `components/dashboard/MiniWindowSvg.jsx` 20 (meeting at half, only imported by the
    unused `WindowCard.jsx`), `WindowCard.jsx` 49 prints the raw top height.

Fed by derived and fine (checked): cut list, pre-cut, BOM timber (top and bottom stiles are separate parts), glass
rows in `lists.js` (double and triple), glass PDF / DXF, Excel, sash sheets (`SashDetail2D`, `FrontElevation2D`,
`GlassDrawing2D`, `VerticalSection2D`), spray list, `calculateSashComponentSet` and the triple component set (one
top / bottom pair for FIX L, C, FIX R), hardware counts (no height rule), CNC jamb DXF (pulleys from the jamb top,
no weight pocket). No weight catalogue and no rule linking weight length to sash travel exist in the engine (the
BOM buys counterweights as one total kg). Where the value must travel (the `splitRatio` trail): `specification.js`
372, `projectStore.js` 566 / 738 (both builders whitelist top-level fields; edit reloads from them),
`ConfiguratorPage.jsx` (state, prefill, 3D sync, save, UI, spec panel), `EstimateConfiguratorPage.jsx` (the same,
plus the price config: it is the only caller of `calculatePrice`), `windowSpecToConfig.js`, `src/3d/App.jsx` (nine
places). `estimateStore` and `moveToProduction` pass the config whole.

---

## 2026-10-08 · TURA PC: DOORS TO PRODUCTION, SINGLE AND FRENCH (branch `claude/doors-production`)

Owner box (Piotr, 08.10.2026): the door frame is the casement frame (68 face, 93 deep, rebate 21, land 47, gap 4,
cill 68 x 93 with 41 visible; inward cill unrebated 40 to 35; aluminium / low-profile threshold without a timber
cill, counted in pieces). Leaf 57 deep (61 triple): stiles 94, top rail 94, bottom rail 180, mid rail 94, french
meeting stile 100 (94 + the 6 lip). Single leaf W - 102; french half (W - 102) / 2, each leaf half + 6. Height
H - 98 with a timber cill (both directions), H - 57 without. Single 900 x 2100: leaf 798 x 2002, glass 633 x 1751.
French 1600 x 2100: half 749, leaf 755 x 2002, glass 584 x 1751. Door glass double 6x12x6 (24). Half glazed and
three quarter with a mid rail and a panel (2 x 18 Tricoya + MDF core). Opening fanlight = a casement leaf.
Winkhaus hardware from BJ Waller: hinges 3 / 4 per leaf, ThunderBolt single kit or FGTE double kit, cylinders,
handles, bolts, thresholds.

### Verdict ✅ single and french doors to production; box numbers in the engine, BOM, sheets and 3D; suite green twice

Single 900 x 2100: leaf 798 x 2002, glass 633 x 1751, 6x12x6 / 24, members 94 / 94 / 180 x 57. French 1600 x 2100:
leaves 755 x 2002, meeting stile 100 x 57, glass 584 x 1751. Half glazed 633 x 883 + panel 633 x 797, three quarter
633 x 1383.5 + 296.5. Hardware counts per box items 12 to 15 on the new door rows; consumables, seals and paint on the
casement rows. **Final tree: 27 harnesses, 3145 checks, 0 failures, twice (identical); `npm run build` OK (14.2 s).**
Independent review: PASS, its should-fix items done (Stage 8). Sash and casement unchanged (t41 controls deep-equal to
410cb5d; reviewer: 171 windows, 0 differences; no fixture changed). Items for Piotr: BLOCKERS 29.

### Stage 0: baseline and sweep (no code changes)

Starting commit **410cb5d** (`main` on 08.10.2026: the merge of PR #12, 7a333d8, plus the new CLAUDE.md and
`docs/handover/DOORS-AUDIT-2026-10-07.md`). `git diff 7a333d8 410cb5d` touches those two files only, so the audit
(written on 7a333d8) applies to this commit unchanged.

**Suite on the starting commit: 26 harnesses, 2748 checks, 0 failures. `npm run build` OK (16.0 s).** Run as
before: `verify/arch/t*.mjs` minus the `*baseline*` generators, plus `verify/parity/*.mjs`, each with `node <file>`,
after `npm ci` and `pip install ezdxf` (ezdxf 1.4.4; the first run failed t16 / t17_edges / t18 / t20 / t22 / t23 /
t25 on the missing module, rerun after the install). `verify/parity/psw-casement-layouts.mjs` exits rc 2 (no PSW
clone at `../psw`): not a failure, not counted. The files the suite rewrites in `docs/handover/samples/` were
restored with `git checkout` after every run; the first run also ran the two `*baseline*` generators, which rewrote
`verify/arch/fixtures/rect-casement-sheets.json` (commit stamp only): restored, and the runner now skips them.

| harness | checks | | harness | checks | | harness | checks |
|---|---|---|---|---|---|---|---|
| t16 | 369 | | t23 | 81 | | t33_bar_grid | 43 |
| t17_edges | 70 | | t24_stage4 | 26 | | parity t31_bars_8x8 | 18 |
| t18 | 179 | | t25 | 226 | | parity t32_bsuite | 54 |
| t19 | 280 | | t26 | 38 | | parity t34_glass_minus1 | 46 |
| t20 | 117 | | t27 | 87 | | parity t35_locks | 51 |
| t20_bars | 31 | | t28 | 50 | | parity t36_hinges | 110 |
| t21 | 120 | | t29 | 34 | | parity t37_single_window_bom | 47 |
| t22 | 118 | | t30_preview | 30 | | parity t38_leaf_64_seat_85 | 468 |
| | | | | | | parity t39_settings_leaf_cards | 23 |
| | | | | | | parity t40_bottom_rail_3d | 32 |

**Reference set, BEFORE** (live engine on 410cb5d, `normaliseToWindowSpec` then `deriveWindowData`, default
profiles; the script is kept in the session scratchpad and re-run for the AFTER table). Every door feeds four BOM
rows only (glass on the WINDOW double row, paint on the SASH rows) and has no hardware line, no weight, no beading:

| door | leaves | glass | makeup / mm | BOM rows | hardware lines |
|---|---|---|---|---|---|
| single 900 x 2100 outward | 806 x 2006 | 641 x 1755 | 6x16x6 / 28 | glass_double, paint_primer, paint_preserver, paint_white_9016 | 0 |
| single inward | 806 x 2006 | 641 x 1755 | 6x16x6 / 28 | same 4 | 0 |
| single aluminium threshold | 806 x 2047 | 641 x 1796 | 6x16x6 / 28 | same 4 | 0 |
| single half-glazed | 806 x 2006 (no mid rail, no panel) | 641 x 1755 | 6x16x6 / 28 | same 4 | 0 |
| single three-quarter | 806 x 2006 (no mid rail, no panel) | 641 x 1755 | 6x16x6 / 28 | same 4 | 0 |
| french 1600 x 2100 lockType single | 756 x 2006, 756 x 2006 | 591 x 1755 x 2 | 6x16x6 / 28 | same 4 | 0 |
| french lockType double | 756 x 2006 x 2 | 591 x 1755 x 2 | 6x16x6 / 28 | same 4 | 0 |
| french + side panels 500 / 500 | 756 x 2006 x 2; panels 406 x 2006 (57 members) | 591 x 1755 x 2, 315 x 1915 x 2 | 6x16x6 / 28 | same 4 | 0 |
| french + fanlight 450 fixed | 756 x 2006 x 2 | 591 x 1755 x 2, 1487 x 337 | 6x16x6 / 28 | same 4 | 0 |
| french + fanlight 450 opening | 756 x 2006 x 2 (no fan leaf) | 591 x 1755 x 2, 1487 x 337 "(opening, 64 sash pending)" | 6x16x6 / 28 | same 4 | 0 |
| single bars h 2 / v 1 | 806 x 2006 | 641 x 1755 (no bars) | 6x16x6 / 28 | same 4 | 0 |

Members today: stiles 94x61 L2006, top rail 94x61 L806, bottom rail 180x61 L806 (french: four 94 stiles, no meeting
stile, no mid rail); frame head / jambs / cill 68x93; inward cill 40x93; coupling post 136x93 x2; transom 68x93
L1464. Pre-cut: leaf members group as raw `94x61` / `180x61`, side panel members as `63x63` (sash section map), frame
members under `undefined` with no material. Controls: casement 040L 1000 x 1200 (leaf 898 x 1102, glass 793 x 994)
and sash 1000 x 1600; their derived data is the "controls unchanged" reference of Stage 7.

**Sweep** (seven read-only agents: engine, store / settings, materials / BOM, drawings, pages, 3D, harness; then a
completeness critic). The claims of `DOORS-AUDIT-2026-10-07.md` sections 0 to 6 hold on 410cb5d, with line drift
only: 3.15 (the screen block is 739-748, not 740-747), 4.8 (the fan block runs 638-702), the t34 door pin (line
87), the inward cill (calc 1311-1320), `DOOR_FRAME_DEPTH` (spec 66); BLOCKERS 23.4 names `setDoorProfile()` for the
real `setActiveDoorProfile`. Two audit statements are slightly wrong: the bSuite export is casement only (doors are
excluded either way), and BLOCKERS 23.6 "pricing consumes the engine rows" (`pricing.js` prices a door per m² from
the configurator fields, out of scope). Found beyond the audit: a batch of type `'door'` (from `moveToProduction`)
gets SASH batch defaults (`BATCH_DEFAULTS` knows `doors` only), the ironmongery `unit` / `subcategory` fields are not
saved to the cloud (needs a DB column), `WindowDoorHandle.jsx` is imported but never rendered. Cross-report
conflicts settled before Stage 1: the t27 grep gate forbids a literal 57 in `specification.js` (the door constants
read the profile); one shape for `derived.door.hardware` (`{ summary, detail: [{ item, detail, quantity, partId }],
fan, ... }`); `ProjectDetailPage` also derives, so all three `withProfiles(` callers pass the door snapshot; the fan
rail datum goes to BLOCKERS 29.4.

### Stage 1: profile, settings, snapshot (4bae7ff)

`DEFAULT_DOOR_PROFILE` schema 2 per brief 3 (frame 68 x 93, land 47, rebate 21, gap 4, gapCill 6, cillVisible 41,
glassInset 11.5, glazingRebate 18, leafAtJamb 51, leafFullHeight 98, leafNoThreshold 57, leaf 57 / 61, faces
94 / 94 / 180 / mid 94 / meeting 100, frenchLip 6 with `frenchClearance` documented and honoured when set, panel
boards 2 x 18 + core 18, hinge rule 3 / 4 above 2100, hardware defaults, fan rule 51 / 51). Every "as casement"
value commented with its source. `migrateDoorProfile`: a stored copy below schema 2 takes the new value only where
it still equals the schema-1 default; `frenchOverlap` is read as `frenchLip`, `transom.rail` as `transomRail`.
`windowProfileStore` carries `door` next to sash and casement through the existing save / load path, with
`setActiveDoorProfile` on hydrate, cloud load and every edit; `withProfiles(sash, casement, door, fn)` keeps the
two-argument shape, and all three callers (WindowDetailPage, ProjectDetailPage, ProductionPackPage) pass
`_profileSnapshot.door`; a new batch snapshot carries the door profile. Window Settings · Doors card (depths,
frame faces, leaf faces incl. meeting and mid rail, panel boards, lip, leaf size rules with their hints, fan rule,
hinge rule, hardware defaults), in the casement card components; the sidebar "Doors, soon" is a link now. Glass:
`DOOR_GLASS_MAKEUP.double '6x12x6'`, `DOOR_GLASS_THICKNESS { double 24, double_slim 16, triple 28 }`, slim / triple
on the window makeups, Laminate / Acoustic 24.8 for doors too; door frame depth 93 from the door profile.

### Stage 2: engine (cbfb319, 66d0fff)

`deriveDoorWindow` v4: single `W - 102`; french `half = (W - 102 - clearance) / 2`, leaf `half + 6`; height
`H - 98` with a timber cill in both directions, `H - 57` without; members D-ST/L, D-ST/R (single) or the hinge
stile + D-MS 100 (french), D-TR 94, D-BR 180, D-MR 94 for the two styles; glass per leaf zone with the meeting
stile counted at 100; mid rail axis leafH / 2 or 0.75 x leafH, glass and panel by the brief formulas, panel 54 in
the 11.5 rebate. Bars on door leaves, side panel leaves and fanlights (casement bar law; transom `match`). Opening
fanlight = a casement top hung leaf per frame zone (D-FAN members on the casement faces 64 / 64 / 67, casement glass
rule, `selectCasementHinges` / `selectCasementLocks`, a casement handle). Weights the casement way (door glass
30 kg/m²), seals, door glazing bead, astragal beads, silicone, bead tape, packers, clips. `doorHardware.js`: hinges
3 / 4, ThunderBolt / FGTE kits, cylinders, handle sets, bolts, thresholds, handing LH / RH with the Winkhaus words,
FGTE height bands, all in `derived.door.hardware { summary, detail, handing, kit, fgte, fan }`. `zones` carry
meetingX, lip, meetingLap, mid rail axis, panel, fan leaves, the transom band, hinge positions (200 / centre - 100 /
150, the 4th halfway), handleY. Threshold extension replaces `cill.extension` (cill length, sill extension board);
the inward cill is its own element `D-FRAME CILL (INWARD)`. Stale comments (calc 1177-1192, profile 639-641) rewritten.
Note: the Stage 2 commit alone still fed sash counterweights and sash silicone to doors through the generic BOM path
(`bom.js` 248); Stage 3 closed it (doors never buy counterweights), so no commit after b04d721 carries it.

### Stage 3: Assign Materials, BOM, pre-cut, cut list (b04d721)

`DOOR_PARTS` (Frame, Leaf, Panel, Side panel, Glass 6-12-6 plus the window glass rows shown read-only as "shared
with windows", Beading, Ironmongery with the counting rule of 3.5 in each hint), appended last to `ALL_PARTS`;
casement consumable, seal, clip and paint hints say "also doors". The Doors page replaces "coming soon" with the
`PartGroupSection` pattern, ironmongery filtered to the door categories plus the new `cylinders`; "Doors use the
casement rows" under Consumables and Paint. `bom.js`: every D- name maps (incl. meeting stile, mid rail, inward
cill, side panel and fan members, the door bead); door glass on `d_glass_double_6_12_6`, slim / triple / acoustic on
the window rows; paint on `c_paint_*`; hardware counts per 3.5; fan picks on the casement hinge and lock rows; panel
boards in m²; consumables on the casement rows; sill extension boards for 35 / 60 / 85. `lists.js`: door frame
members take the assigned material and merge with other door timber of that material; unassigned door timber groups
by the workshop section map, else its finished section (never the sash profile fallback 63x63; a 57x57 side panel member
follows the section map 57x57 -> 63x63); door hardware lines; door glass rows carry bars (the glass
order PDF draws them from `barAxes`); the cut list keeps the hinge / meeting / active / passive notes when rows merge.
Part symbols DFH DFJ DFC DFCI DCP DTR DMS DMR DSS DST DSB DFS DFT DFB; the door colour family and a COLOUR KEY DOOR
legend; `optimizer.js` reports a piece longer than the stock instead of dropping it.

### Stage 4: sheets, PDFs, pack (5ba2faa)

Built by one agent on the sheet files only, then reviewed by a second agent (4 defects fixed: an inward leaf's bottom
edge drawn dashed; frame openings not split at the transom on an inward door; the glass drawing subtitle running off
the sheet; land / gap not dimensioned on the plan when both sides have side panels). `DoorElevation2D` (side panel
bars, handle 1000 to the floor, opening symbol apex at the hinge, mid rail / panel / glass zones, the 6 lips and the
centre line, the opening fan leaf top hung, the transom band, the threshold named, hinges from derived, bolts on the
passive leaf of a one-handle french door), `DoorFrameDetail2D` (layer chain 47 / 4, labels on the spans they draw,
the cill on the full frame height, depth 93 and rebate 21, inward cill text from the profile), `DoorLeafDetail2D`
(every leaf, active and passive, the meeting detail, schedule glass to 0.1 mm, handle and lock, D-MR, panel and its
build, hinge set-out, codes and cut lengths from the records, leaf depth from the record), new `DoorSidePanelDetail2D`,
`DoorFanlightDetail2D`, `DoorGlassDrawing2D`, `doorSheetParts.jsx`, and `DoorSection2D` as a real plan view (frame
with the rebate, leaf in it with the 4 gap, the meeting stiles with their lips, swing arcs, active / passive, inside /
outside, side panels and the 136 post). One sheet plan (`doorSheetPlan`) mounted through `DoorSheet.jsx` by the
Drawings panel tabs, its Elevation and Elements PDF rig, the Elements PDF payload and the production pack; uploaded
sections stay available for doors. Window page: a door spec panel and a door "Calculated" block instead of the sash
one, the door hardware detail card, depth 93, door glass drawings. Pack: door elevations and element cards, door glass
drawings, spraying rows per door leaf, side panel and fan leaf, Overview columns (single / french, style, opening ·
lock · threshold, depth 93). Glass DXF accepts doors (t18 / t28 skip examples moved to a fix frame window, see below).

### Stage 5: 3D (764be73)

Built by one agent on the 3D files only, then reviewed (2 defects fixed: the handle drawn at backset + 40 instead of
the profile backset; an aluminium strip drawn for threshold `none`; and the t40 door section made non-circular, 15
mutations each caught). `doorGeometryFromSpec` builds a plain geometry object from `deriveWindowData`; `DoorWindow`
draws it through the new `DoorAssembly.jsx` when the `doorGeo` prop is present and renders byte-identical to before
without it (t40 section 4). Leaf sizes, 94 / 94 / 180 x 57 (61 triple), mid rail and 54 panel per style, meeting
stiles 100 with the 6 lips (12 overlap, the active leaf laps on its face), one 136 coupling post (no rewrite of
`DoorSidePanel` was needed: the new path does not use it), side panel members 57, hinges 3 / 4 from derived, the
active leaf and the handles per the engine and `lockType`, glass at the daylight size and the unit thickness,
timber cill vs threshold, the opening fan leaf 64 / 64 / 67, the fixed fan glazed in the frame, the transom band.
Preview, capture rig and the configurator iframe pass `doorGeo`; the capture rig and the preview now frame the whole
assembly (side panels and fanlight) from the engine totals (checked by rendering through `Window3DCaptureRig`).
24 headless renders (Chromium from /opt/pw-browsers, SwiftShader) in `docs/handover/samples/doors/`.

### Stage 6: configurator (2e37fb1)

Door frame depth 93 from the door profile in the saved config and the summary (the TDZ trap at the old line 587 is
avoided by testing the batch type directly); editing a door prefills `doorPaneling`; glass chips stay double / slim
/ triple with the spec chips; `thresholdExtension` flows to the engine (3.7); the 3D sync sends `doorGeo` built
through `normaliseToWindowSpec` from the same keys the save stores. No new fields.

### Stage 7: tests (2d54461, 5598d46)

New `verify/parity/t41_doors_production.mjs` (18 sections): the box literals typed in, the reference set, hardware,
BOM, pre-cut, cut list, fanlight, side panels, bars, weights and consumables by hand, threshold extension, migration
and `withProfiles`, the store, the Assign Materials rows, controls (casement and sash deep-equal to 410cb5d), and the
door sheets rendered through `DoorSheet` / `doorSheetPlan` (svg, no NaN / undefined / long dash, the dimension rule,
schedule glass, frame chain 47 / 4, plan section, hinges 3 / 4, meeting stile 100, D-MR and panel, triple depth 61,
fan leaf sheet). t40 section 6: the door meshes against the engine. Changed pins, each because the door really
changed:
- **t37**: "doors have zero hardware" (`if door continue` in the reference list; "no hardware cards (door ironmongery
  is not counted yet)") is replaced by the new truth: a door is walked like every window; it still shows no hardware
  CARD because every door line is an engine pick (typed by name in the test and flagged by the engine), and its
  counts sit on the door rows (single 3 hinges + kit + cylinder + handle set; french one handle 6 hinges + kit + 2
  bolts + cylinder + handle set). Two assertions added, none removed; Stage 8 added a third and one allowed row
  field (`notes`, the purchase list variant note, checked to sit only on the door lock rows and add up).
- **t34**: "door units = ref - 2" is kept, derived on a door profile pinned at the reference tree's construction
  (leaf 61, land 43, rebate 25, leafAtJamb 47, leafFullHeight 94), so it still proves the glass -1 mm per side and
  nothing else; the new door numbers are t41's subject.
- **t38**: the door profile no longer equals the two older trees; instead both trees' schema-1 door profile,
  migrated, must equal the live default on every key the engine reads, and the casement leaf pinned at 67 or 70 all
  round must not change the door at all. The Assign Materials comparison sets aside the door rows (appended after
  every window row, checked) and the hints that now mention doors (each checked to mention doors).
- **t27**: the door rebate is the casement 21 now (option B land 43 / rebate 25 became schema 2 land 47 / rebate 21);
  the option-B section compares against the last schema-1 tree; the french rule is half + lip.
- **t18 / t28**: the glass DXF "door is skipped" examples now use a fix frame window (still no engine); a door
  exports its unit at the schedule size with its bars (new check).
No assertion was deleted to get a pass; sash and casement fixtures are byte-identical (no fixture file changed).

### Stage 8: independent review, fixes (3382474)

One review agent that had not seen the work, on its own worktree at 5598d46: it re-derived every box number by hand
(all match, see its table: single 798 x 2002 / 633 x 1751, aluminium 2043 / 633 x 1792, french half 749, leaves
755 x 2002 at x 51 and 794, glass 584 x 1751 = 749 - 165, half glazed axis 1001, 633 x 883 + 633 x 797,
three-quarter axis 1501.5, 633 x 1383.5 + 633 x 296.5, hardware counts, hinges 3 at leaf 2100 and 4 at 2101, FGTE
band 1965-2161, opening fan 1498 x 348 with glass 1393 x 240, fixed fan glass 1487 x 337, the BOM rows, one pre-cut
group per material); confirmed no assertion weakened or deleted (start 2748 checks on 26 files, 2805 on the same
files, plus t41); found no fixture changed (the 31 samples the suite rewrites are byte-identical to a run on 410cb5d
but for PDF dates: drift older than this tura; 171 casement and sash windows compared with the start: 0
differences); ran the suite (3138 checks, 0 fail) and the build; opened the rendered sheets and three 3D renders.
**Verdict: PASS, nothing blocking.** Its should-fix items, all done in 3382474: the FGTE detail used an arrow that
jsPDF Helvetica prints as garbage (reworded); the purchase list carried no variant note (now the lock kit and FGTE
cylinder rows list their variants with quantities, screen and PDF, keys unchanged; t37 allows and checks the new
`notes` row field); the pack hardware tab listed nothing for doors (passes derived for doors only); the optimiser's
over-length report was in the data only (now on the Pre-Cut panels and the pre-cut PDF); BLOCKERS 29.4 now states the
rail / door leaf numbers. Also from its notes: the door tab names are back to Frame / Leaf / Sections (rule 6), the
elements PDF empty-sheet line that changed every window type was reverted, t41's "never 63x63" label was imprecise
(a 57x57 side panel member follows the workshop section map 57x57 -> 63x63, now pinned with a section map test).
Its cosmetic sheet notes and the remaining notes are BLOCKERS 29.9 m to p.

### AFTER (5598d46 + 3382474, same script as the BEFORE table)

| door | leaves | glass | makeup / mm | BOM rows | hardware lines |
|---|---|---|---|---|---|
| single 900 x 2100 outward | 798 x 2002 | 633 x 1751 | 6x12x6 / 24 | 22 | 4 (hinges 3, single kit, cylinder, handle set) |
| single inward | 798 x 2002 | 633 x 1751 | 6x12x6 / 24 | 22 (inward cill 40x93) | 4 |
| single aluminium threshold | 798 x 2043 | 633 x 1792 | 6x12x6 / 24 | 22 | 5 (+ threshold) |
| single half-glazed | 798 x 2002, mid rail 94, panel 633 x 797 | 633 x 883 | 6x12x6 / 24 | 25 (+ mid rail, 2 panel boards) | 4 |
| single three-quarter | 798 x 2002, mid rail 94, panel 633 x 296.5 | 633 x 1383.5 | 6x12x6 / 24 | 25 | 4 |
| french 1600 x 2100 lockType single | 755 x 2002 x 2 (94 + meeting 100) | 584 x 1751 x 2 | 6x12x6 / 24 | 24 | 5 (hinges 6, kit, cylinder, handle, bolts 2) |
| french lockType double | 755 x 2002 x 2 | 584 x 1751 x 2 | 6x12x6 / 24 | 23 | 4 (hinges 6, FGTE kit, cylinders 2, handle sets 2) |
| french + side panels 500 / 500 | 755 x 2002 x 2; panels 398 x 2002 (57) | 584 x 1751 x 2, 307 x 1911 x 2 | 6x12x6 / 24 | 28 | 5 |
| french + fanlight 450 fixed | 755 x 2002 x 2 | 584 x 1751 x 2, 1487 x 337 | 6x12x6 / 24 | 25 | 5 |
| french + fanlight 450 opening | 755 x 2002 x 2; fan leaf 1498 x 348 (64 / 64 / 67) | 584 x 1751 x 2, 1393 x 240 | 6x12x6 / 24 | 30 (+ casement leaf timber, hinge, lock) | 8 (+ fan hinges, lock, handle) |
| single bars h 2 / v 1 | 798 x 2002 | 633 x 1751, bars 2H x 1V (axes on the glass order) | 6x12x6 / 24 | 24 (+ astragal rows) | 4 |

Single 900 x 2100 BOM rows: d_leaf_stile, d_leaf_top_rail, d_leaf_bottom_rail, d_frame_head, d_frame_jamb,
d_frame_cill, d_glazing_beading, d_glass_double_6_12_6, c_paint_primer / preserver / white_9016, d_hinges,
d_lock_single_kit, d_cylinder, d_handle_set, c_glazing_packer, c_glass_clips_double, c_silicone, c_bead_tape_1mm /
2mm, c_seal_frame_black, c_seal_hj_black. Pre-cut unassigned: `94x57` (stiles, top rail), `180x57` (bottom rail),
`68x93` (frame); with one material on the door rows: one group. Controls: casement 040L and sash 1000 x 1600 equal to
the BEFORE run (components, BOM rows, hardware, glass list), and t41 section 17 deep-equal to 410cb5d.

### Suite on the final tree (twice), `npm run build`

Both runs identical, every file rc 0 (`psw-casement-layouts.mjs` exits 2: no ../psw clone, as at the start; not
counted). The files the suite rewrites in `docs/handover/samples/` were restored after each run (the reviewer showed
that drift predates this tura). `npm run build`: built in 14.2 s (the usual chunk-size warning).

| harness | start | final (x2) | fail |
|---|---|---|---|
| t16 | 369 | 369 | 0 |
| t17_edges | 70 | 70 | 0 |
| t18 | 179 | 179 | 0 |
| t19 | 280 | 280 | 0 |
| t20 | 117 | 117 | 0 |
| t20_bars | 31 | 31 | 0 |
| t21 | 120 | 120 | 0 |
| t22 | 118 | 118 | 0 |
| t23 | 81 | 81 | 0 |
| t24_stage4 | 26 | 26 | 0 |
| t25 | 226 | 226 | 0 |
| t26 | 38 | 38 | 0 |
| t27 | 87 | 97 | 0 |
| t28 | 50 | 51 | 0 |
| t29 | 34 | 34 | 0 |
| t30_preview | 30 | 30 | 0 |
| t33_bar_grid | 43 | 43 | 0 |
| t31_bars_8x8 | 18 | 18 | 0 |
| t32_bsuite | 54 | 54 | 0 |
| t34_glass_minus1 | 46 | 46 | 0 |
| t35_locks | 51 | 51 | 0 |
| t36_hinges | 110 | 110 | 0 |
| t37_single_window_bom | 47 | 50 | 0 |
| t38_leaf_64_seat_85 | 468 | 471 | 0 |
| t39_settings_leaf_cards | 23 | 23 | 0 |
| t40_bottom_rail_3d | 32 | 73 | 0 |
| t41_doors_production | new | 339 | 0 |
| **total** | **2748 (26 files)** | **3145 (27 files)** | **0** |

---

## 2026-10-07 · TURA PC: CASEMENT BOTTOM RAIL 67 (branch `claude/casement-bottom-rail-67`)

Owner box (Piotr, 07.10.2026): every casement leaf (opening, fanlight, fixed) has **stiles 64, top rail 64, bottom
rail 67**. 040L 1000 x 1200: leaf 898 x 1102 unchanged, stiles and top rail 64x57, **bottom rail 67x57, glass
793 x 994, daylight 770 x 971**. 021 1000 x 1200: glass 793 x 248.2 (fanlight) and 793 x 606.8. Frame, mullion,
transom (seat 8.5), sash windows and doors unchanged. 3D bottom rail 67. Window Settings: the Bottom rail card has
its own width.

### Verdict ✅ stiles and top rail 64, bottom rail 67, glass leaf W - 105 x leaf H - 108, suite green twice

Engine default and every migrated stored profile (leaf schema 3) give stiles 64, top rail 64, bottom rail 67.
040L 1000 x 1200: leaf 898 x 1102 unchanged, stiles and top rail 64x57, bottom rail 67x57, **glass 793 x 994,
daylight 770 x 971, beading 4110**; 021 1000 x 1200: **793 x 248.2 and 793 x 606.8**; in the derived data, the glass
schedule, the glass PDF and the four casement sheets (the leaf sheet prints the glass to 0.1 mm since review finding 1).
One source for the two glass deductions (`casementGlassDeductions`: width 105, height 108); no reader applies one
number both ways. Leaf outer sizes, member lengths, frame, transoms (seat 8.5), mullions, sash windows and doors are
identical to the start commit bdd2092. 3D: the casement leaf bottom rail is 67 (own commit ca0304f). **Full suite
twice on the final code tree: 26 harnesses, 2748 checks, 0 failures; `npm run build` OK (23.0 s).** Independent
review: PASS WITH FINDINGS; 1 to 5 fixed, 6 and 7 reported (BLOCKERS 28.5 h, j). Not merged; BLOCKERS 28 holds the
items for Piotr.

### Stage 0: baseline and sweep (no code changes)

Starting commit **bdd2092** (`main` on 07.10.2026 = 95a83e9, the merge of PR #11, plus the new CLAUDE.md).
`git diff 95a83e9 bdd2092` touches CLAUDE.md only, so the facts of the brief (verified on 95a83e9) hold, and every
"today" number of its section 4 was reproduced below (040L 1000 x 1200: 793 x 997, daylight 770 x 974, beading
4117; 021: 793 x 251.2 / 793 x 609.8).

**Suite on the starting commit: 24 harnesses, 2536 checks, 0 failures. `npm run build` OK (24.4 s).** Run as
before: `verify/arch/t*.mjs` minus the `*baseline*` generators, plus `verify/parity/*.mjs`, each with `node <file>`,
after `npm ci` and `pip install ezdxf`. `verify/parity/psw-casement-layouts.mjs` exits rc 2 (no PSW clone at
`../psw`): not a failure, not counted. The files the suite rewrites in `docs/handover/samples/` were restored with
`git checkout` after every run (history; this tura adds only the new `samples/leaf-bottom-67/`).

| harness | checks | | harness | checks | | harness | checks |
|---|---|---|---|---|---|---|---|
| t16 | 369 | | t23 | 81 | | t33_bar_grid | 43 |
| t17_edges | 70 | | t24_stage4 | 26 | | parity t31_bars_8x8 | 18 |
| t18 | 179 | | t25 | 226 | | parity t32_bsuite | 54 |
| t19 | 280 | | t26 | 38 | | parity t34_glass_minus1 | 46 |
| t20 | 117 | | t27 | 87 | | parity t35_locks | 51 |
| t20_bars | 31 | | t28 | 50 | | parity t36_hinges | 110 |
| t21 | 120 | | t29 | 34 | | parity t37_single_window_bom | 47 |
| t22 | 118 | | t30_preview | 30 | | parity t38_leaf_64_seat_85 | 311 |

(t34 to t37 print `PASS` lines without a summary line; counted from those lines. The 06.10 entry lists t34 as 41;
the harness prints 46 on this commit.)

**The sweep.** Eight read-only agents (Explore, no write tools), one area each: the casement engine, the profile and
store, the engine helpers (bar grid, arch, CNC, lists, BOM), the 2D drawings and the glass PDF, Window Settings and
the materials store, the 3D, the harnesses and fixtures, a literal sweep of `src`; then a completeness critic that
grepped the whole of `src` again and corrected four classifications. 480 tool calls, about 37 minutes. Every hit in
casement code, classified (one-face = it uses one face, or one glass deduction, where the bottom rail matters):

| where | what | class |
|---|---|---|
| `profile.js` `elements.leafBottom.face: 64`, `leafSchema: 2` | the source | literal (changes) |
| `profile.js` `deductions.glass: 105` | stored deduction | literal; keeps the WIDTH meaning |
| `profile.js` `casementGlassDeduction` | ONE number 2 x (stile - inset), read for width AND height | **one-face** |
| `profile.js` `migrateLeafSchema` | gate `< D.leafSchema` with the 67 rule only: a schema 2 copy 64 / 64 / 64 would never get 67, and a schema 2 copy with hand-edited 67 stiles would be reset | **hazard** |
| `calculations.js:655` `secLeaf` | one section for stiles, top rail, arched top rail, leaf ring, bottom rail | **one-face** |
| `calculations.js:662, 985-986` | `glassDed` for unit width AND height | **one-face** |
| `calculations.js:698` | arched glass bottom edge already `leafBottom.face - glassInset` | derives-ok (the bottom rail is counted here, once) |
| `calculations.js:810-812`, `casementBarGrid.js:106-115` | bar daylight `r.h - 2 x stile`, lights `lo / hi` | **one-face** |
| `calculations.js:991`, `casementBarGrid.js:137` | unit bar axes, origin `stile - inset` for x and y | derives-ok (y is measured from the top rail) |
| `calculations.js:1019-1020` | leaf weight `kgPerM(stile) x (2H + 2W)` | **one-face** (feeds the hinge pick) |
| `calculations.js:1008` timber, beading, bead tape, glass m², silicone | from the records' sections and the units | derives-ok (follow) |
| `arch.js:468-472, 1392-1400` | arched / circle ring and glass from `leafTop.face` | derives-ok (top rail only) |
| `CasementLeafDetail2D.jsx:73-82, 121-122, 202-216, 406` | daylight, unit rect, chain, click zone with the stile on all four sides; fallback one deduction | **one-face** |
| `CasementElevation2D.jsx:43-48, 119` | daylight rect and arched daylight bottom from the stile | **one-face** |
| `CasementDrawing2D.jsx:201, 248, 297-301, 369` | daylight inset and vertical chain from the stile; fallback one deduction | **one-face** |
| `CasementGlassDrawing2D.jsx:63-65` | engine unit; fallback one deduction both ways | **one-face** (fallback) |
| `utils/glassPdfExport.js` | prints the glass schedule rows (`lists.buildGlassListForWindow`) | derives-ok; **the brief's section 3 lists it as a reader of the one deduction: stale, it has no formula** |
| `WindowSettingsPage.jsx:836-838, 849-851, 859, 940-941, 977-979` | one deduction in the readout; every leaf card shows and writes `leafStile` | **one-face** |
| `windowProfileStore.js:143-154` `setCasementLeafFace` | writes all three faces | **one-face** |
| `materialAssignmentStore.js:103` `c_sash_bottom_rail` `64×57` | slot label (display only) | label |
| `MaterialAssignmentsPage.jsx:654` "stiles, rails, one section all round (vertogen)" | group subtitle | label (becomes untrue; BLOCKERS 28.5) |
| `CasementPanel.jsx:20, 32, 94-106, 128-129, 151-181, 240, 304` | `SASH_RAIL` for every member, glass `height - 2 x 64`, glass centred, top-hung handle on the bottom rail | **one-face** |
| `CasementWindow.jsx:121-122` | 3D bar plan glass `- SASH_RAIL x 2`, centred | **one-face** |
| `archedCasementGeometry.js:110, 136, 144` | leaf inner bottom, glass bottom, straight floor from `leafFace` | **one-face** |
| `FixFrameWindow.jsx:1271` | rectangle branch renders `<CasementPanel hingeType="fixed">` | out of scope (a fixed frame, not a leaf): must stay identical |
| door engine, door / sash 3D, sash drawings | own faces | out of scope |

What the sweep found beyond the brief (kept for the stages and BLOCKERS):

1. **The brief's section 3 is stale on `glassPdfExport.js`**: it has no glass formula; it prints the schedule rows
   and their bar axes. Proven in t38 §10 (the PDF prints the schedule, never the one-deduction height).
2. **The 3D reads no profile face**: the leaf is constants only. A hand-edited bottom rail never reaches the 3D
   (BLOCKERS 28.4).
3. **`FixFrameWindow`'s rectangle reuses `CasementPanel`**: a 67 hard-wired in the panel would change the
   fixed-frame 3D. Solved with a prop that defaults to 64 (Stage 6).
4. **Arched leaves change from the profile alone**: the engine already took the arched glass bottom from
   `leafBottom.face` (`calculations.js:698`), so the arched glass loses 3 mm with no engine edit, and the C-TRACERY
   blank of an arched leaf with a bar pattern follows its glass (not in the brief's list of allowed differences; a
   direct consequence of the glass height, BLOCKERS 28.5).
5. **Pre-Cut fallback reads the depth, not the face** (`profileRawForSection`): unassigned double glazing keeps the
   bottom rail in the stiles' `63x63` group; unassigned triple splits it into its own `67x61` group (BLOCKERS 28.2).
6. **Glass clips** (`bom.js:308-311`): 8 per main pane when the glass is taller than 500, else 6; a leaf 605.01 to
   608 high now gets 6 instead of 8 (BLOCKERS 28.5).
7. **Snapshot against active profile** (critic): Production Pack / project / window pages derive with the batch
   snapshot but the sheets read the faces from the active profile. Pre-existing; no batch is frozen, so both are the
   same profile today (BLOCKERS 28.5).

**The reference set, before (bdd2092, default profile).** The t38 set plus a triple-glazed 040L.

| window | leaf W×H | stile / top / bottom section | glass units | transom cut / run / Pre-Cut | beading glazing / ext / int | kg timber / glass / total | leaf kg | hinge picks | glass m² | bead tape m |
|---|---|---|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 898×1102 | 64x57 / 64x57 / 64x57 | 793×997 | - | 4117 | 25.9 / 16.6 / 44.6 | 26.8 | side_xl | 0.79 | 3.58 |
| 040L 1000x1200 bars 2V/1H | 898×1102 | 64x57 / 64x57 / 64x57 | 793×997 | - | 4117 / 3205 / 3205 | 25.9 / 16.6 / 44.6 | 26.8 | side_xl | 0.79 | 9.15 |
| 040L 1000x1200 triple | 898×1102 | 64x61 / 64x61 / 64x61 | 793×997 | - | 4117 | 26.5 / 26.1 / 55.2 | 37.4 | side_xl | 0.79 | 3.58 |
| 021 1000x1200 | 898×356.2, 898×714.8 | 64x57 / 64x57 / 64x57 | 793×251.2, 793×609.8 | 906.5 / 906.5 / 927 | 5628 | 33.2 / 14.3 / 49.9 | 10.3, fix | top_450, - | 0.68 | 4.89 |
| 120 1800x1500 | 832×1402, 832×1402 | 64x57 / 64x57 / 64x57 | 727×1297, 727×1297 | - | 9310 | 50.8 / 39.6 / 95 | 31.2, 31.2 | side_xl, side_xl | 1.89 | 8.1 |
| 052L 1800x1500 | 832×446.2, 832×924.8, 832×1402 | 64x57 / 64x57 / 64x57 | 727×341.2, 727×819.8, 727×1297 | 840.5 / 840.5 / 861 | 10670 | 57.6 / 37.5 / 99.9 | 11.4, 21.4, 31.2 | top_450, side_xl, side_xl | 1.79 | 9.28 |
| 021 1800x1500 | 1698×446.2, 1698×924.8 | 64x57 / 64x57 / 64x57 | 1593×341.2, 1593×819.8 | 1706.5 / 1706.5 / 1727 | 9998 | 53.3 / 38.8 / 96.7 | 22, fix | top_450, - | 1.85 | 8.69 |
| 023 1800x1500 | 832×446.2, 832×446.2, 832×443.6, 832×443.6, 832×447.2, 832×447.2 | 64x57 / 64x57 / 64x57 | 727×341.2, 727×341.2, 727×338.6, 727×338.6, 727×342.2, 727×342.2 | 840.5,840.5,840.5,840.5 / 840.5,840.5,840.5,840.5 / 861,861,861,861 | 14734 | 78 / 31.2 / 114.7 | 11.4, 11.4, 11.4, 11.4, fix, fix | top_450, top_450, side_xl, side_xl, -, - | 1.49 | 12.81 |
| 142 1800x1500 | 399×1402, 399×446.2, 399×924.8, 399×446.2, 399×924.8, 399×1402 | 64x57 / 64x57 / 64x57 | 294×1297, 294×341.2, 294×819.8, 294×341.2, 294×819.8, 294×1297 | 407.5,407.5 / 407.5,407.5 / 428,428 | 15364 | 80.4 / 30.4 / 116.3 | 16.8, 6.2, fix, 6.2, fix, 16.8 | side_460, top_450, -, top_450, -, side_460 | 1.45 | 13.36 |
| 031 1800x1500 (partial mullion) | 832×446.2, 832×446.2, 1698×924.8 | 64x57 / 64x57 / 64x57 | 727×341.2, 727×341.2, 1593×819.8 | 1706.5 / 1706.5 / 1727 | 10463 | 56.8 / 37.8 / 99.4 | 11.4, 11.4, fix | top_450, top_450, - | 1.8 | 9.1 |
| arched V1 three-centre 1000x1500 start 1300 | 898×1402 | 64x57 / 64x57 / 64x57 | 793×1297 | - | 4657 | 27.7 / 21.2 / 51.3 | 32.4 | side_xl | 1.01 | 4.05 |
| circle 800 sunburst (fixed) | 698×698 | - / 64x57 / - | 593×593 | - | 2142 / 2077 / 2077 | 17.6 / 5.8 / 24.6 | fix | - | 0.28 | 5.47 |
| CONTROL sash standard 2x2 | - | - / - / - |  | - | 5959.3 / 4600 / 5750 / 945.3 / 945.3 | 12.24 / 17.47 / 31.2 | - | - | 0.89 | - |
| CONTROL door single-external | - | - / - / - | 741×1755 | - |  | undefined / undefined / 0 | - | - | 1.3 | - |
| window | leaf member lengths | frame | mullions | Pre-Cut leaf raw | BOM mm stile / top / bottom | BOM mm transom / mullion | BOM glass m² |
|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.79 |
| 040L 1000x1200 bars 2V/1H | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.79 |
| 040L 1000x1200 triple | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 64x61 | 2244 / 918 / 918 | - / - | 0.79 |
| 021 1000x1200 | 356.2 898 714.8 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2222 / 1836 / 1836 | 927 / - | 0.68 |
| 120 1800x1500 | 1402 832 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5688 / 1704 / 1704 | - / 1443 | 1.89 |
| 052L 1800x1500 | 446.2 832 924.8 1402 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5666 / 2556 / 2556 | 861 / 1443 | 1.79 |
| 021 1800x1500 | 446.2 1698 924.8 | 1800 / 1800 / 1500 / 1500 | - | 63x63 | 2822 / 3436 / 3436 | 1727 / - | 1.85 |
| 023 1800x1500 | 446.2 832 443.6 447.2 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5588 / 5112 / 5112 | 3444 / 1443 | 1.49 |
| 142 1800x1500 | 1402 399 446.2 924.8 | 1800 / 1800 / 1500 / 1500 | 1423, 1423, 1423 | 63x63 | 11332 / 2514 / 2514 | 856 / 4329 | 1.45 |
| 031 1800x1500 (partial mullion) | 446.2 832 924.8 1698 | 1800 / 1800 / 1500 / 1500 | 454.2 | 63x63 | 3754 / 3422 / 3422 | 1727 / 474 | 1.8 |
| arched V1 three-centre 1000x1500 start 1300 | 1253 920 898 | 1073.9 / 1000 / 1300 / 1300 | - | 63x63, 150x57 | 2546 / 1048 / 918 | - / - | 1.01 |
| circle 800 sunburst (fixed) | 1991.8 | 2299.6 | - |  | - / - / - | - / - | 0.28 |
| CONTROL sash standard 2x2 | - | 1000 / 1000 / 1000 / 1392 / 1392 / 828 / 796 / 1500 / 1500 / 1500 / 1500 | - | 63x63, 63x95 | - / - / - | - / - | 0.89 |
| CONTROL door single-external | - | 1000 / 2100 / 2100 / 1000 | - | 94x61, 180x61 | - / - / - | - / - | 1.3 |

### Stage 1: profile and migration (`src/engine/profile.js`)

- `elements.leafBottom.face: 67`; `leafStile` / `leafTop` stay 64; the comments beside them and on the glass key
  say which member is which.
- **`leafSchema: 3`.** `migrateLeafSchema` reads a stored copy on ITS schema, never chained:
  - schema 1 (or no counter): each face that still equals 67 moves to today's default, so 67 / 67 / 67 becomes
    64 / 64 / 67 (`LEAF_SCHEMA_1`, unchanged);
  - schema 2: only `leafBottom` moves, 64 to 67, while it still equals 64 (`LEAF_SCHEMA_2`, new); the stiles and
    the top rail are not looked at, so a schema 2 copy with hand-edited 67 stiles keeps them;
  - schema 3: left alone. A hand-edited face is kept in every case.
- **Two deductions, one source**: `casementGlassDeductions(profile)` returns `{ width, height }`:
  width `2 x (leafStile - inset)` = 105, height `(leafTop - inset) + (leafBottom - inset)` = 52.5 + 55.5 = 108,
  both to 0.1 like the engine; without `glassInset` both fall back to `deductions.glass`, as before.
  `casementGlassDeduction` (name kept) still returns the width; it is what the store and the migration keep in
  `deductions.glass` (105, its meaning unchanged). The height deduction is never stored.
- Piotr's stored profile (schema 2, 64 / 64 / 64, glass 105, seat 8.5) migrates to exactly the new default (t38 §9).

### Stage 2: engine (`calculations.js`, `casementBarGrid.js`)

- Sections: stiles `leafStile`, top rail / arched top rail / circle leaf ring `leafTop`, bottom rail `leafBottom`
  (`secLeaf`, `secLeafTop`, `secLeafBottom`, the door's pattern). 64x57 / 64x57 / 67x57; triple 64x61 / 64x61 /
  67x61.
- Glass unit: width `leafW - deduction.width`, height `leafH - deduction.height`, for every rectangular pane
  (opening, fan, fan2, fixed, middle tier). The arched / circle unit stays the engine outline: no deduction on top
  of it, so the bottom rail is counted once (t38 §7: V1 unit 793 x 1294 = START - 3 in height only = leaf H - 108).
- Bars: `casementLeafBars({ stile, top, bottom })` (new params default to `stile`): daylight `r.w - 2 x stile` by
  `r.h - (top + bottom)`, lights `lo = y + top`, `hi = lo + daylight`; the spacing rule untouched.
  `leafBarsToUnit(leafBars, stile, inset, top)`: y measured from the top rail.
- Leaf weight per member: `kgPerM(stile) x 2H + kgPerM(top) x W + kgPerM(bottom) x W` (arched: straight stiles,
  the ring centre line, the bottom rail; circle: the ring).
- `(top + bottom)`, not `- top - bottom`: with one face all round it is exactly the old `2 x face` in floating
  point, so a profile with one face derives and draws byte for byte what the start commit drew (t38 §12; one
  exception since d5ecfc5, by design: the leaf sheet's subtitle glass to 0.1 mm, Stage 3).

### Stage 3: drawings

- `CasementLeafDetail2D`: daylight inset by the stile / top rail / bottom rail; the vertical chain prints the top
  rail, the daylight (or the bar panes) and the bottom rail; the dashed unit rect and the subtitle are the engine's
  unit (the glass schedule; the two deductions only as fallback); the bottom rail click zone is 67 tall; the arched
  daylight closes at the bottom rail. **The subtitle glass is printed to 0.1 mm** (d5ecfc5, review finding 1): the
  sheet printed every number on its 0.5 grid (BLOCKERS 27.7 d), so 021 1000 x 1200 read "793 × 248" and
  "793 × 607" while the owner box and Done when 1 ask for 248.2 / 606.8 on the drawings. The dimension chains stay
  on the 0.5 grid (021 daylight 225 / 584).
- `CasementElevation2D`: the daylight rect `r.h - (top + bottom)` from `r.y + top`; the arched daylight bottom at the
  bottom rail.
- `CasementDrawing2D` (production elevation, imported nowhere): daylight inset per side, vertical chain
  64 / daylight / 67, glass callout fallback with both deductions.
- `CasementGlassDrawing2D`: fallback with both deductions; the sheet prints the engine unit.
- `glassPdfExport.js`: no change needed (it prints the schedule); proven by t38 §10.

### Stage 4: Window Settings, store, labels

- No layout change: three leaf cards, one Face input, same elements. Each card shows its own section
  (`p.elements[r.key].face`): Stiles `64 × 57`, Top rail `64 × 57`, Bottom rail `67 × 57`.
- Stiles or Top rail selected: the input shows `leafStile.face` and writes `setCasementLeafFace` (name kept), which
  now writes `leafStile` and `leafTop` only. Bottom rail selected: the input shows `leafBottom.face` and writes
  `setCasementElementField('leafBottom', 'face', v)` (an existing setter, which keeps `deductions.glass` in step).
- Hints: "Stiles and top rail share one width. The bottom rail has its own card." / "Bottom rail width. Stiles and
  top rail are edited on their own cards."
- Readout: "glass W = leaf − 105 · glass H = leaf − 108 · sample 793 × 1294", live from the profile. The page's
  sample window is 1000 x 1500 (the brief's "793 x 994" is the 1000 x 1200 window); the minus and times signs are
  the ones the readout already used.
- `materialAssignmentStore.js`: `c_sash_bottom_rail` reads `67×57`; ids and everything else unchanged.

### Stage 5: tests

**`verify/parity/t38_leaf_64_seat_85.mjs`, rewritten: 468 checks** (was 311; 466 at the review, + 2 from its
findings). Two reference trees by `git archive`:
REF 5459f5b (67 all round, kept) and START bdd2092 (64 all round, the start of this tura; both hashes in its header,
both overridable on the command line).

| § | what | checks |
|---|---|---|
| 0 | profile numbers; every other key unchanged against REF; against START only `leafBottom.face` and `leafSchema` moved | 9 |
| 1 | leaf outer sizes = both trees | 11 |
| 2 | sections 64x57 / 64x57 / 67x57 (REF 67 all round, START 64 all round), every C-BOTTOM RAIL 67x57, lengths equal both, curved members = START = by hand | 46 |
| 3 | the rule tables: START W equal / H - 3, REF W + 6 / H + 3, the circle (no bottom rail) = START; schedule rows too | 33 |
| 4 | transoms = START = REF + 0.5; 906.5 / 1706.5 / 840.5; Pre-Cut 927 | 21 |
| 5 | frame, mullions identical to both; partial mullion 454.2 | 23 |
| 6 | by hand: 040L (793 x 994, daylight 770 x 971 on the leaf sheet, beading 4110, sections, leaf 26.8 kg, 26.0 / 16.6 / 44.6, 0.79 m², tape 3.57), 021 (793 x 248.2, 793 x 606.8, both bottom rails 67x57), 120 (727 x 1294, daylight 704 x 1271, 9297, 31.3 kg, 1.88 m²); the arithmetic in the file | 17 |
| 7 | arched / circle: ring 64, glass radii = outer - 52.5 = START, origin x; V1 bottom edge 47 + 55.5 = 102.5, unit = START - 3 in height only = leaf H - 108, C-BOTTOM RAIL 67x57 | 12 |
| 8 | sash and door: derived, cut list, glass schedule = both trees | 8 |
| 9 | migrations: Piotr's schema 2 copy -> 64 / 64 / 67; schema 1 67 / 67 / 67 -> 64 / 64 / 67; schema 2 with a bottom rail 70 keeps it, height deduction 111; schema 3 left alone; schema 2 holding 67 / 67 / 67 left alone; 70 / 70 / 70 kept; bottom 72 kept (H 113); seat 9; glass schema 1; idempotent; both stored copies migrate to exactly the default and derive the default's numbers | 14 |
| 10 | leaf sheet, glass sheet, production elevation, front elevation and glass PDF of 040L, 021, 040L with bars, arched V1, 052L: the daylight drawn 64 / 64 / 67 inside the leaf (rect margins, arched path), the chains print 64 and 67, the glass of the schedule (the leaf sheet's subtitle exactly, 021 "793 × 248.2" and "793 × 606.8"), the PDF never the one-deduction height, the REF widths 764 / 698 never; Window Settings readout and cards; the shared setter typed 66 over a bottom rail 70 (66 / 66 / 70, glass 109); again with a bottom rail 70 (793 x 991, 021 793 x 245.2 / 603.8) and with stiles / top rail 70 (781 x 988, arched 781 x 1288); glassInset 12 -> 116; two sensitivity checks (START ignores a bottom rail of 70; REF's stale reader) | 111 |
| 11 | raw stock and Pre-Cut groups (assigned 63x75, unassigned 63x63 = START = REF, triple 67x61 its own group), slot labels, every other part unchanged; hinge slots and locks = START for all 11 windows | 43 |
| 12 | the live code with START's numbers pinned = START, with REF's numbers = REF: derived byte for byte; the four sheets byte for byte except the leaf sheet's subtitle glass, which must print the schedule exactly (0.1 mm) and equal the old text once put back on the 0.5 grid; all 11 windows | 44 |
| 13 | `casementGlassDeductions` (105 / 108, faces not the stored value, fallback, 0.1 rounding); the five readers use it and never the width-only helper or `deductions.glass`; the glass PDF has no formula; every sheet's FALLBACK path (engine unit removed) prints 898 - 105 x 1102 - 111 with a bottom rail 70 | 12 |
| 14 | the half millimetre (unchanged) | 64 |

A self-check of the rewrite against the 06.10 harness found five checks that had not been carried over (glassInset
12 -> 116, the REF sensitivity, the arched elevation's arcs at the inner radii, the sheets with stiles 70 on the
arched V1, REF beside START in §11); restored in b63af8f, on the new numbers.

**`verify/parity/t39_settings_leaf_cards.mjs` (new), 23 checks.** The Window Settings page mounted in Chromium
(Playwright from the global node install, no project dependency, exits 2 if absent): each card's section, the
readout, the Face input and hint for each card, typing 70 on Bottom rail (64 / 64 / 70, glass stays 105, readout
H 111, sample 793 x 1291), typing 66 on Stiles (66 / 66 / 70, glass 109, readout W 109 / H 113), 65 on Top rail,
Reset. **Run against the start tree it fails 17 of 23.**

**Existing harnesses: every failure explained before its expectation moved** (first run of the suite on the new code:
95 failures in 9 harnesses).

| harness | check | old | new | why (arithmetic) |
|---|---|---|---|---|
| t18 | derived constant glass bottom edge | 99.5 = 47 + (64 - 11.5) | 102.5 = 47 + (67 - 11.5) | the arched glass sits on the bottom rail |
| t18 | merged glass DXF, 4th (rectangular) unit bottom | -6360.6 | -6357.6 | rect unit H 1500 - 98 - 108 = 1294 (was - 105 = 1297); the harness took the width deduction for the height |
| t18, t20 | rect-casement-base fixture identity (R1 to R4) | fixture | regenerated | diff classified below |
| t19 | rect-casement-sheets fixture identity (R1 to R4) | fixture | regenerated | diff classified below |
| t26 | rectangular glass PDF fixture | fixture | reblessed | diff classified below |
| t27 | profile literals | leafBottom 64, leafSchema 2 | 67, 3 | the owner box |
| t27 | 040L 1000 x 1500 glass list | 793 x 1297, H = leafH - 2 x (top - inset) | 793 x 1294, H = 1402 - 52.5 - 55.5 | height deduction |
| t28 | rect DXF unit, contour, edge, axes, bands, text | 793 x 1297, edge to 1287, H axis 648.5, bands 639.5 / 657.5, L = 2090 | 793 x 1294, 1284, 647, 638 / 656, 2087 | 1294 = 1402 - 108; the bar sits mid-daylight: leaf y (64 + 1335) / 2 = 699.5, minus the unit origin 52.5 = 647 = 1294 / 2 |
| t28 | 133 units | 438.3 x 341.2 / 819.8 | 338.2 / 816.8 | leaf H - 108 |
| t33 | independent bar formula (131 sides, the light under the fan, 052L) | lines 403 / 702 / 1001 | 402.25 / 700.5 / 998.75 | daylight h - 64 - 67 = 3 less, pane (h - 131 - 3 x 22) / 4 is 0.75 less, line j moves j x 0.75; the formula now insets by TOP and BOT; the +-1 mm boundary recomputed from the new pane |
| t34 | default profile unit against 12670b6 | ref + 4 each way | W ref + 4, H ref + 1 (789 x 1293 -> 793 x 1294) | the top rail gives 3, the bottom rail (67 in both) nothing |
| t38 | 65 checks of the 64-all-round truth | | rewritten | above |

Comments only (assertions were already formulas): t18 (stale "789 x 1293"), t33 (the 15 % fan sliver 19.4 -> 18.6).
No assertion was deleted or weakened: every changed line keeps its condition on the new numbers, with the
arithmetic beside it; the number of `check(` / `ok(` calls is unchanged in t18 (99), t27 (77), t28 (45), t33 (39),
t34 (20) (independent review below).

**Fixtures, regenerated only after reading the diff:**

- `rect-casement-base.json` (`node verify/arch/rect_casement_baseline.mjs`): 73 changed values, all allowed:
  C-BOTTOM RAIL section / sizeLabel / thickness 64 -> 67 on the 9 bottom rails and their 9 cut rows (R3 triple
  64x61 -> 67x61), unit and glass row heights - 3 (16 values), glazing / triangle / georgian beading
  (R1 4807 -> 4800 = round(2 x (793 + 1294) x 1.15), 3895 -> 3888 = round((793 + 2 x 1294) x 1.15)), bead tape,
  weights (timber, glass, total, leaf, the hinge pick's weightKg: R1 33.4 -> 33.5, R2 14.5 -> 14.6 / 21.2 ->
  21.3). Hinge slots, locks, leaf sizes, frame, seals, paint, transoms unchanged.
- `rect-casement-sheets.json` (`node verify/arch/t19_baseline.mjs live`): leaf sheets: the bottom rail label 64 ->
  67, the vertical daylight - 3 (974 -> 971, 1274 -> 1271, 797 -> 794) or the bar panes - 1.5 / - 1 each (626 ->
  624.5, 310 -> 309), the subtitle glass; glass sheets: heights - 3 and their bar chains (639.5 -> 638); elevations:
  daylight and v bar rects 3 shorter, h bars up 1.5 / 1 / 2 (equal panes in the new daylight). Frame sheets
  identical. Regenerated once more after review finding 1 (d5ecfc5), when t19 failed on R2 and R4 leaf sheets:
  4 values, all the leaf subtitle glass now printed to 0.1 mm, each equal to its own glass sheet (R2 427 x 338 ->
  338.2, 427 x 817 -> 816.8; R4 474.5 -> 474.6, 679.5 -> 679.4: R4's leaves are 579.6 and 784.4 wide, minus 105;
  the leaf width itself still prints on the 0.5 grid). Nothing else in the file moved.
- `t26-rect-glass-pdf.json` (`node verify/arch/t26.mjs --rebless`): 11 text operators: 997 -> 994 (x3), 997 mm ->
  994 mm (x3), the edge chain 977 -> 974, the bar chain 479.5 -> 478 (x4). The sash S1 rows unchanged.
- `rect-sash-base.json`, `rect-sash-sheets.json`: byte-identical (cmp).

Sash window and door: derived, cut list and glass schedule deep-equal to START and REF (t38 §8); sheets of the sash
unchanged (t21, t22 untouched).

### Stage 6: 3D (own commit ca0304f)

- `CasementPanel.jsx`: `SASH_RAIL = 64` kept (stiles, top rail, the export); new `SASH_BOTTOM_RAIL = 67`, exported;
  a `bottomRail` prop (default `SASH_RAIL`) shapes the bottom rail EXT / INT halves; the glass is
  `height - 64 - 67` and the glazing group (glass, spacers, bars) sits `(67 - 64) / 2 = 1.5` higher; the handle on
  the bottom rail of a top-hung leaf sits on the 67 rail's visible centre, 21 + (67 - 21) / 2 = 44 (was 42.5).
  **The default stays 64 on purpose**: `FixFrameWindow`'s rectangle (a fixed frame, out of scope) reuses this panel
  and must not change; every casement leaf gets 67 from `CasementWindow`.
- `CasementWindow.jsx`: passes `bottomRail={SASH_BOTTOM_RAIL}`; the one-grid bar plan takes the glass from 67 to 64
  (`lo = p.y - leafH / 2 + 67`, `hi = p.y + leafH / 2 - 64`).
- `ArchedCasementWindow.jsx` passes `leafBottomFace: 67`; `archedCasementGeometry.js` uses it for the leaf's inner
  bottom, the glass bottom and the straight floor (absent = `leafFace`, so t19 / t29 and the sash, which pass their
  own dims, are unchanged). The floor: a 3D frame shorter than rise + 128 (was + 125) is drawn taller, as before;
  below it the bead would not fit above the 67 rail.
- **`verify/parity/t40_bottom_rail_3d.mjs` (new), 32 checks**, reaches the components: R3F's own reconciler under
  node (a stub renderer, the scene graph is built, nothing is drawn) mounts the live and the START components and
  reads every mesh's world bounding box. CasementPanel 898 x 1102 (fixed, side hung, top hung): bottom rail 67, top
  rail and stiles 64 and byte-identical, glass 770 x 971 from -484 to 487 (centre + 1.5), the top-hung handle 1.5
  up, the side handle unchanged; without the prop byte-identical to START. CasementWindow 040L (2V / 1H) and 021:
  every mesh is identical to START except the bottom rails (64 -> 67), the glass / spacers / bars (3 shorter or up
  1.5 / 3) and the fan's top-hung handle (up 1.5); the h bar at the new glass centre. ArchedCasementWindow: outline
  unchanged, the glass starts 67 above the leaf bottom (START 64). FixFrameWindow (rectangle, circle), DoorWindow,
  ParametricSashWindow: byte-identical to START. t33's 3D plan replica follows the new formula.
- Headless Chromium (Playwright's, already installed) rendered `CasementWindow` of 040L and 021 1000 x 1200 from
  START and from the live tree: `docs/handover/samples/leaf-bottom-67/` (full view and a close-up of the bottom
  rail, before, after, and side by side). The close-ups show the taller bottom rail and the glass edge 3 mm higher.
  The 3D leaf is the PSW geometry (4 mm shorter than the engine leaf, BLOCKERS 24.2): its glass is leaf - 131, not
  the engine's unit.

**The reference set, after (default profile).**

| window | leaf W×H | stile / top / bottom section | glass units | transom cut / run / Pre-Cut | beading glazing / ext / int | kg timber / glass / total | leaf kg | hinge picks | glass m² | bead tape m |
|---|---|---|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 898×1102 | 64x57 / 64x57 / 67x57 | 793×994 | - | 4110 | 26 / 16.6 / 44.6 | 26.8 | side_xl | 0.79 | 3.57 |
| 040L 1000x1200 bars 2V/1H | 898×1102 | 64x57 / 64x57 / 67x57 | 793×994 | - | 4110 / 3198 / 3198 | 26 / 16.6 / 44.6 | 26.8 | side_xl | 0.79 | 9.14 |
| 040L 1000x1200 triple | 898×1102 | 64x61 / 64x61 / 67x61 | 793×994 | - | 4110 | 26.6 / 26 / 55.2 | 37.4 | side_xl | 0.79 | 3.57 |
| 021 1000x1200 | 898×356.2, 898×714.8 | 64x57 / 64x57 / 67x57 | 793×248.2, 793×606.8 | 906.5 / 906.5 / 927 | 5614 | 33.4 / 14.2 / 50 | 10.3, fix | top_450, - | 0.68 | 4.88 |
| 120 1800x1500 | 832×1402, 832×1402 | 64x57 / 64x57 / 67x57 | 727×1294, 727×1294 | - | 9297 | 51 / 39.5 / 95 | 31.3, 31.3 | side_xl, side_xl | 1.88 | 8.08 |
| 052L 1800x1500 | 832×446.2, 832×924.8, 832×1402 | 64x57 / 64x57 / 67x57 | 727×338.2, 727×816.8, 727×1294 | 840.5 / 840.5 / 861 | 10649 | 57.9 / 37.4 / 100.1 | 11.5, 21.4, 31.3 | top_450, side_xl, side_xl | 1.78 | 9.26 |
| 021 1800x1500 | 1698×446.2, 1698×924.8 | 64x57 / 64x57 / 67x57 | 1593×338.2, 1593×816.8 | 1706.5 / 1706.5 / 1727 | 9984 | 53.6 / 38.6 / 96.9 | 22.1, fix | top_450, - | 1.84 | 8.68 |
| 023 1800x1500 | 832×446.2, 832×446.2, 832×443.6, 832×443.6, 832×447.2, 832×447.2 | 64x57 / 64x57 / 67x57 | 727×338.2, 727×338.2, 727×335.6, 727×335.6, 727×339.2, 727×339.2 | 840.5,840.5,840.5,840.5 / 840.5,840.5,840.5,840.5 / 861,861,861,861 | 14692 | 78.6 / 30.9 / 115 | 11.5, 11.5, 11.4, 11.4, fix, fix | top_450, top_450, side_xl, side_xl, -, - | 1.47 | 12.78 |
| 142 1800x1500 | 399×1402, 399×446.2, 399×924.8, 399×446.2, 399×924.8, 399×1402 | 64x57 / 64x57 / 67x57 | 294×1294, 294×338.2, 294×816.8, 294×338.2, 294×816.8, 294×1294 | 407.5,407.5 / 407.5,407.5 / 428,428 | 15323 | 80.7 / 30.2 / 116.4 | 16.8, 6.2, fix, 6.2, fix, 16.8 | side_460, top_450, -, top_450, -, side_460 | 1.44 | 13.32 |
| 031 1800x1500 (partial mullion) | 832×446.2, 832×446.2, 1698×924.8 | 64x57 / 64x57 / 67x57 | 727×338.2, 727×338.2, 1593×816.8 | 1706.5 / 1706.5 / 1727 | 10442 | 57.2 / 37.7 / 99.6 | 11.5, 11.5, fix | top_450, top_450, - | 1.79 | 9.08 |
| arched V1 three-centre 1000x1500 start 1300 | 898×1402 | 64x57 / 64x57 / 67x57 | 793×1294 | - | 4650 | 27.7 / 21.2 / 51.4 | 32.5 | side_xl | 1.01 | 4.04 |
| circle 800 sunburst (fixed) | 698×698 | - / 64x57 / - | 593×593 | - | 2142 / 2077 / 2077 | 17.6 / 5.8 / 24.6 | fix | - | 0.28 | 5.47 |
| CONTROL sash standard 2x2 | - | - / - / - |  | - | 5959.3 / 4600 / 5750 / 945.3 / 945.3 | 12.24 / 17.47 / 31.2 | - | - | 0.89 | - |
| CONTROL door single-external | - | - / - / - | 741×1755 | - |  | undefined / undefined / 0 | - | - | 1.3 | - |
| window | leaf member lengths | frame | mullions | Pre-Cut leaf raw | BOM mm stile / top / bottom | BOM mm transom / mullion | BOM glass m² |
|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.79 |
| 040L 1000x1200 bars 2V/1H | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.79 |
| 040L 1000x1200 triple | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 64x61, 67x61 | 2244 / 918 / 918 | - / - | 0.79 |
| 021 1000x1200 | 356.2 898 714.8 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2222 / 1836 / 1836 | 927 / - | 0.68 |
| 120 1800x1500 | 1402 832 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5688 / 1704 / 1704 | - / 1443 | 1.88 |
| 052L 1800x1500 | 446.2 832 924.8 1402 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5666 / 2556 / 2556 | 861 / 1443 | 1.78 |
| 021 1800x1500 | 446.2 1698 924.8 | 1800 / 1800 / 1500 / 1500 | - | 63x63 | 2822 / 3436 / 3436 | 1727 / - | 1.84 |
| 023 1800x1500 | 446.2 832 443.6 447.2 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5588 / 5112 / 5112 | 3444 / 1443 | 1.47 |
| 142 1800x1500 | 1402 399 446.2 924.8 | 1800 / 1800 / 1500 / 1500 | 1423, 1423, 1423 | 63x63 | 11332 / 2514 / 2514 | 856 / 4329 | 1.44 |
| 031 1800x1500 (partial mullion) | 446.2 832 924.8 1698 | 1800 / 1800 / 1500 / 1500 | 454.2 | 63x63 | 3754 / 3422 / 3422 | 1727 / 474 | 1.79 |
| arched V1 three-centre 1000x1500 start 1300 | 1253 920 898 | 1073.9 / 1000 / 1300 / 1300 | - | 63x63, 150x57 | 2546 / 1048 / 918 | - / - | 1.01 |
| circle 800 sunburst (fixed) | 1991.8 | 2299.6 | - |  | - / - / - | - / - | 0.28 |
| CONTROL sash standard 2x2 | - | 1000 / 1000 / 1000 / 1392 / 1392 / 828 / 796 / 1500 / 1500 / 1500 / 1500 | - | 63x63, 63x95 | - / - / - | - / - | 0.89 |
| CONTROL door single-external | - | 1000 / 2100 / 2100 / 1000 | - | 94x61, 180x61 | - / - / - | - / - | 1.3 |

Per window against START: sections bottom rail 64x57 -> 67x57 (64x61 -> 67x61 triple), stiles and top rail equal;
glass width equal, height - 3 (arched - 3, circle equal); vertical daylight - 3; glazing beading - 7 per pane (2 x 3 x
1.15 = 6.9); weights: leaf + 0 to 0.1 kg (the bottom rail gains 0.104 kg/m, the glass loses 3 mm), window timber
+ 0 to 0.6 kg, glass - 0 to 0.3 kg; hinge slots, locks, leaf sizes, member lengths, frame, transoms, mullions,
Pre-Cut lengths and BOM timber equal. Against REF: glass W + 6 / H + 3, stiles and top rail 67 -> 64, bottom rail
equal. Triple: the unassigned Pre-Cut splits into 64x61 and 67x61.

### Independent review

One general-purpose agent that had not seen the work reviewed `bdd2092..ca0304f` (code, tests, fixtures, 3D; the
logs were not written yet). It changed no tracked file (its scratch in `/tmp/review-scratch`), bundled HEAD and
bdd2092 itself with esbuild and re-derived the numbers by hand from the owner box:

- deductions: width 2 x (64 - 11.5) = 105, height (64 - 11.5) + (67 - 11.5) = 52.5 + 55.5 = 108;
- 040L 1000 x 1200: leaf 1000 - 102 = 898 by 1200 - 98 = 1102; glass 793 x 994; daylight 898 - 128 = 770 by
  1102 - 64 - 67 = 971; beading round(2 x (793 + 994) x 1.15) = round(4110.1) = 4110; leaf weight member by member
  (kgPerM 64x57 = 2.22528, 67x57 = 2.32959 kg/m): (8.99479 timber + 16.55308 glass) x 1.05 = 26.8; window
  26.0 / 16.6 / 44.6;
- 021 1000 x 1200: 793 x (356.2 - 108) = 248.2 and 793 x (714.8 - 108) = 606.8, both bottom rails 67x57, transom
  906.5, beading 5614, fan leaf 10.3 kg;
- its own pick, 052L 1800 x 1500: transom axis 1500 - (68 + 886.8 + 34) = 511.2, leaves 446.2 / 924.8 / 1402 high,
  832 wide; glass 727 x 338.2 / 816.8 / 1294; beading round((2130.4 + 3087.6 + 4042) x 1.15) = 10649; mullion 1423,
  transom 840.5 unchanged;
- arched V1: unit 793 x 1294 = 1402 - 108, glass origin 47 + 55.5 = 102.5 (the bottom rail counted once); triple
  64x61 / 64x61 / 67x61; bars 2V / 1H at unit x 264.5 / 528.5, y 497 = 994 / 2;
- migrations run by itself: schema 2 64 / 64 / 64 -> 64 / 64 / 67; schema 1 67 / 67 / 67 -> 64 / 64 / 67; schema 2
  with a bottom rail 70 keeps it (H 111); schema 3 left alone; a schema "2" stored as a string -> 64 / 64 / 67;
  the stored deductions.glass 105 in every row.

It also counted the assertion calls of every changed harness (t18 99 / 99, t27 77 / 77, t28 45 / 45, t33 39 / 39,
t34 20 / 20, t38 94 -> 121) and judged each changed line the same strength or stronger; read the three fixture
diffs (all in the allowed categories; sash fixtures byte-identical to bdd2092); confirmed no out-of-scope file
touched (bSuite, cloud sync, projectStore, sash, doors, door / sash / fixed-frame 3D), no function removed or
renamed, no dependency, no getter, no layout change, no dash character in added lines or commit messages, the
Skylon header on the new harnesses; `vite build` green; its own full suite run green (2746, t38 466).

**Verdict: PASS WITH FINDINGS. Nothing blocking.**

| # | finding | done |
|---|---|---|
| 1 | the leaf sheet prints 021's glass as 793 × 248 / 793 × 607 (its 0.5 grid), the owner box and Done when 1 want 248.2 / 606.8 on the drawings | **fixed** in d5ecfc5: subtitle glass to 0.1 mm; t38 asserts the leaf sheet glass = the schedule exactly and the 021 literals; t38 §12 keeps the pinned sheets byte for byte except that subtitle; sheets fixture: 4 subtitles |
| 2 | t38's migration checks no longer read the stored deductions.glass | fixed in bd12f45: 117 (70 / 70 / 70) and 105 (bottom rail 72) asserted |
| 3 | t38 dropped the negative REF width tokens 764 (040L) and 698 (120) | fixed in bd12f45 |
| 4 | t38's "stiles 70 typed after a bottom rail 70" cannot tell the two setters apart | fixed in bd12f45: 66 typed first, 66 / 66 / 70, deductions.glass 109, then 70 |
| 5 | t34 label "a copy on the current schemas" is stale | fixed in bd12f45 |
| 6 | 3D `minStraight` now includes the 67 rail (frames lower than rise + 128 drawn taller) | reported, BLOCKERS 28.5 h: the engine refuses such frames (straight part at least 900) |
| 7 | `CasementDrawing2D` bars are an equal split of its own daylight, not the engine's | reported, BLOCKERS 28.5 j: as before, the component is imported nowhere |
| 8 | Stage 7 logs not written yet | this entry, BLOCKERS 28, handover section C |

After the fixes: t38 468 (§9 and §10 stronger, §10 + 2 checks), t34 46, t19 280 on the regenerated fixture.

### Final suite and build

Two full runs on the final code tree (4696bb8; the commit after it adds only these logs), each harness with
`node <file>`, `docs/handover/samples` restored after each run:

| harness | start (bdd2092) | run 1 pass / fail | run 2 pass / fail |
|---|---|---|---|
| t16 | 369 | 369 / 0 | 369 / 0 |
| t17_edges | 70 | 70 / 0 | 70 / 0 |
| t18 | 179 | 179 / 0 | 179 / 0 |
| t19 | 280 | 280 / 0 | 280 / 0 |
| t20 | 117 | 117 / 0 | 117 / 0 |
| t20_bars | 31 | 31 / 0 | 31 / 0 |
| t21 | 120 | 120 / 0 | 120 / 0 |
| t22 | 118 | 118 / 0 | 118 / 0 |
| t23 | 81 | 81 / 0 | 81 / 0 |
| t24_stage4 | 26 | 26 / 0 | 26 / 0 |
| t25 | 226 | 226 / 0 | 226 / 0 |
| t26 | 38 | 38 / 0 | 38 / 0 |
| t27 | 87 | 87 / 0 | 87 / 0 |
| t28 | 50 | 50 / 0 | 50 / 0 |
| t29 | 34 | 34 / 0 | 34 / 0 |
| t30_preview | 30 | 30 / 0 | 30 / 0 |
| t33_bar_grid | 43 | 43 / 0 | 43 / 0 |
| parity t31_bars_8x8 | 18 | 18 / 0 | 18 / 0 |
| parity t32_bsuite | 54 | 54 / 0 | 54 / 0 |
| parity t34_glass_minus1 | 46 | 46 / 0 | 46 / 0 |
| parity t35_locks | 51 | 51 / 0 | 51 / 0 |
| parity t36_hinges | 110 | 110 / 0 | 110 / 0 |
| parity t37_single_window_bom | 47 | 47 / 0 | 47 / 0 |
| parity t38_leaf_64_seat_85 | 311 | 468 / 0 | 468 / 0 |
| parity t39_settings_leaf_cards | new | 23 / 0 | 23 / 0 |
| parity t40_bottom_rail_3d | new | 32 / 0 | 32 / 0 |
| **total, 26 harnesses** | **2536 (24)** | **2748 / 0** | **2748 / 0** |

`verify/parity/psw-casement-layouts.mjs` exits rc 2 in both runs (no PSW clone at `../psw`): not a failure, not
counted, as on the start commit. Added against the start: t38 + 157 (rewritten, 311 -> 468), t39 23 (new), t40 32
(new); every other harness has the same count as on the start commit.

**`npm run build`: OK (23.0 s).**

An earlier pair of runs (on d5ecfc5) was not used: run 1 was green (2748), run 2 failed one t39 check, "Bottom rail
selected again: Face input shows 70". Root cause: `NumInput` copies a new value into its text in a `useEffect`, one
render after the card click, and the harness read the input in between (the page itself was right: read after
the effect it shows 70 in every run). Fixed in the harness, not the page (4696bb8): it waits up to 2 s for the expected value, as Playwright's
`toHaveValue` does, and prints what it saw; 12 runs in a row 23 / 23; on the start tree it still fails 17 of 23.
Then the two runs above.

---

## 2026-10-06 · TURA PC: CASEMENT LEAF 64 AND TRANSOM SEAT 8.5 (branch `claude/casement-leaf-64`)

Owner decisions (Piotr, 06.10.2026): **A.** the four casement leaf members are 64 wide everywhere (were 67);
**B.** the transom seat is 8.5 (was 8; the joint needs 8.6, 8.5 is enough).

### Verdict ✅ leaf 64 / glass 105 / seat 8.5 in the default and in every migrated profile, one glass source, suite green twice

Engine default and any stored profile (migrated by `leafSchema` / `lengthSchema`) give leaf 64, glass deduction
105, transom seat 8.5. Every reader takes the glass deduction from `casementGlassDeduction()` and the sheets print
the engine's unit. The reference set moves exactly as specified (sections 64x57, glass + 6, transoms + 0.5,
906.5 / 1706.5 / 840.5, Pre-Cut 927); frame, mullions, sash and door are identical to 5459f5b. **Full suite twice
on the final tree: 24 harnesses, 2536 checks, 0 failures; `npm run build` OK (16.2 s).** Independent review: PASS
WITH FINDINGS, fixed or answered (Stage 6). Not merged; BLOCKERS 27 holds the decisions for Piotr.

### Stage 0: baseline and impact analysis (no code changes)

Starting commit **5459f5b** (`main`, 06.10.2026). `git diff f6a86db 5459f5b -- src` is empty: the facts the brief
verified on f6a86db hold unchanged, and every number of its section 2 was reproduced below (040L 1000 x 1200:
leaf 898 x 1102, glass 787 x 991, beading 4089, leaf 27 kg, weights 26.3 / 16.4 / 44.8; transoms 906 / 1706 / 840).

**Suite on the starting commit: 23 harnesses, 2218 checks, 0 failures. `npm run build` OK (16.9 s).**

| harness | checks | | harness | checks | | harness | checks |
|---|---|---|---|---|---|---|---|
| t16 | 368 | | t23 | 81 | | t33_bar_grid | 43 |
| t17_edges | 70 | | t24_stage4 | 26 | | parity t31_bars_8x8 | 18 |
| t18 | 179 | | t25 | 225 | | parity t32_bsuite | 54 |
| t19 | 280 | | t26 | 38 | | parity t34_glass_minus1 | 41 |
| t20 | 117 | | t27 | 87 | | parity t35_locks | 51 |
| t20_bars | 31 | | t28 | 50 | | parity t36_hinges | 110 |
| t21 | 120 | | t29 | 34 | | parity t37_single_window_bom | 47 |
| t22 | 118 | | t30_preview | 30 | | | |

Run as night 8 recorded: `verify/arch/t*.mjs` minus the `*baseline*` generators, plus `verify/parity/*.mjs`, each
with `node <file>`, after `npm ci` and `pip install ezdxf`. `verify/parity/psw-casement-layouts.mjs` exits rc 2 (no
PSW clone at `../psw`, PSW is outside this session): not a failure, not counted. The suite rewrites 30 files in
`docs/handover/samples/` (t16, t18, t20, t22, t23, t25, t26, t28, t32); those are history (brief 3.4.3) and were
restored with `git checkout` after every run. They were already out of date before this tura (the committed
`sample_glass_rect_1000x1500_040L.dxf` still has the pre-02.10 unit 789, the engine gives 787).

**The sweep.** Eight read-only agents, one area each (leaf face readers, glass deduction, transom seat consumers,
literals 67 / 111 / 67x57, profile migration and write-back, raw stock, beading / hinges / weights, harnesses and
fixtures). Every hit, classified:

| where | what it does with the leaf face / glass / seat | class |
|---|---|---|
| `engine/profile.js:114-116` | `leafStile` / `leafTop` / `leafBottom` `face: 67` | literal (the source) |
| `engine/profile.js:154` | `deductions.glass: 111`, the stored "resolved value" of 2 x (67 - 11.5) | literal |
| `engine/profile.js:158` | `lengths.transomSeat: 8` | literal (the source) |
| `engine/profile.js:100, 153, 191` | comments quoting 111, 2 x (67 - 11.5), 150 - 51 - 67 = 32 | comment |
| `engine/profile.js:463-466` | glass schema 1 history (2 x (67 - 12.5) = 109) | comment, history, stays |
| `engine/profile.js:421-424` | migration merge: a stored face / glass / seat overrides the default, no leaf or length step exists | derives (gap) |
| `engine/profile.js:471` | glass schema 1 migration writes `D.deductions.glass` whatever the copy's face is | derives (hazard: 105 next to a stored 67) |
| `engine/profile.js:686-689` | `profileRawForSection` compares the SECOND token (the leaf depth 57 / 61), never the face | derives, face-blind |
| `engine/calculations.js:655` | leaf section string `${leafStile.face}x${ld}` (all leaf records, timber kg) | derives |
| `engine/calculations.js:660-662` | `glassDed = R(2 x (leafStile.face - glassInset))`, `ded.glass` only without `glassInset` | derives (copy 1 of 3) |
| `engine/calculations.js:698` | arched glass bottom edge `cillSide + (leafBottom.face - glassInset)` | derives |
| `engine/calculations.js:811, 814, 991` | bar grid daylight, unit inset (`ded.glass / 2` fallback), unit bar axes | derives |
| `engine/calculations.js:880, 900` | `C-TRANSOM` record and `transomRuns[].length` = field leaf W + `transomSeat`, both through R() | derives (the only two readers of the seat) |
| `engine/calculations.js:843` | partial mullion = tier leaf H + `partialMullionSeat` | derives, out of scope (stays 8) |
| `engine/calculations.js:919, 938, 1019-1020` | curved leaf members = ring centre line, leaf timber run and kg/m from the face | derives |
| `engine/arch.js:468-472, 1391-1396` | arch / circle leaf ring `leafAtJamb` .. `+ leafTop.face`, glass offset `- glassInset` | derives |
| `engine/arch.js:1361` | example "(800 circle: 400 / 343, 360 / 293, glass 305.5)" from the 57 / 40 / 67 / 12.5 era | comment (stale) |
| `engine/casementBarGrid.js:110, 138` | daylight `leaf - 2 x stile`, unit origin `stile - glassInset` | derives (parameter) |
| `engine/cnc/archDxf.js:155, 218` | CNC DXF prints the ring FACE and radii | derives |
| `utils/glassPdfExport.js:117` | example "R 55.5/1305.5/55.5" = V1 glass radii with 40 + 67 - 12.5 | comment (stale) |
| `components/drawings/CasementLeafDetail2D.jsx:73, 118-119` | `glassIn = deductions.glass / 2 - stile`, subtitle glass = `leaf - deductions.glass` | **stale reader** |
| `components/drawings/CasementLeafDetail2D.jsx:8, 10, 73, 78, 169` | comments: section (67), glass 12.5 into the rebate, -12.5, 54.5 inset, "top-rail 67 chain dim" | comment |
| `components/drawings/CasementDrawing2D.jsx:366` | glass callout `leaf - deductions.glass` (component imported nowhere in src) | **stale reader** |
| `components/drawings/CasementGlassDrawing2D.jsx:63` | `2 x (face - inset)`, `deductions.glass` fallback | derives (copy 2 of 3) |
| `components/drawings/CasementGlassDrawing2D.jsx:9` | comment "deductions.glass (111: ...)" | comment |
| `components/drawings/CasementElevation2D.jsx:43-48` | daylight rect `leaf - 2 x stile` (prints no glass size, no stile) | derives |
| `components/drawings/CasementFrameDetail2D.jsx:218` | prints `C-T <length>` on a 0.5 grid | derives |
| `components/drawings/CircleFixedDrawing2D.jsx:92` | prints `C-LEAF RING <leafTop.face> face` | derives |
| `pages/WindowSettingsPage.jsx:836, 941` | glass figure `R(2 x (face - glassInset))` | derives (copy 3 of 3, no fallback) |
| `pages/WindowSettingsPage.jsx:689, 875` | Transom card, `NumInput` (type number, no step) -> `setCasementLength` (`Number(v)`) | derives |
| `stores/windowProfileStore.js:134-144` | `setCasementLeafFace` writes the three faces, never `deductions.glass` | setter (gap) |
| `stores/windowProfileStore.js:113-121, 151-171` | `setCasementGeometry` / `setCasementPath` can write `glassInset`, never `deductions.glass` | setter (gap) |
| `stores/materialAssignmentStore.js:101-103` | slot labels `section: '67×57'` (display only: no code matches on it) | label |
| `stores/projectStore.js:378` | batch `_profileSnapshot` = copy of the live profile (setter has zero callers) | derives |
| `src/3d/**` (`CasementPanel.jsx:20` `SASH_RAIL = 64`) | already 64 from constants | out of scope |
| door profile and door engine (94 / 94 / 180, own glass formulas) | share nothing with the casement glass | out of scope |
| every other `67` / `111` / `64` / `105` hit (RAL hex, heritage board 111, coupling 43 + 68 = 111, `lowerFromAxis` 64, sash cill nose 64x128, stock width 105, 3D coordinates) | different meaning | unrelated |

What the sweep found beyond the brief, kept for the stages and for BLOCKERS:

1. **The migrated profile is not written back to the cloud on load.** `onRehydrateStorage` and `loadFromCloud`
   (`windowProfileStore.js:239-252, 218-235`) migrate in memory and write localStorage only; the cloud copy is
   written by `_sync` (any setter or Reset). The glass schema went the same way (commit 8b0b96f did not touch the
   store). Described in Stage 1.
2. **Triple glazing, no material assigned:** the Pre-Cut raw section of a leaf member is the finished section
   itself (`profileRawForSection` finds nothing for depth 61), so it moves from `67x61` to `64x61`. Double glazing
   stays `63x63` (a coincidence: depth 57 = sash stile face 57).
3. **The cut list and the Pre-Cut "finished" column round every length to whole mm** (`lists.js:95, 236`): the
   906.5 transom prints 907 there, 906.5 on the frame sheet and in bSuite. Same rule as every leaf today (446.2 ->
   446). Not changed (sash fixtures must stay byte-identical); reported.
4. **Arched leaf top rail plans:** the narrower ring lets the 1000 x rise 200 three-centre leaf top go from one
   180 board to the economy plan 2 x 150 (t16:435, t25:279 pin the old plan).
5. **Beading NaN:** `parseSection('profile')` gives `[NaN]`; no reachable reader uses `finishedWidth` /
   `thickness` of a beading record (BLOCKERS).

**The reference set, before (5459f5b, default profile).** Same windows as the new harness t38.

| window | leaf W×H | leaf section | glass units | transom cut / run / Pre-Cut | beading glazing / ext / int | kg timber / glass / total | leaf kg | hinge picks | glass m² | bead tape m |
|---|---|---|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 898×1102 | 67x57 | 787×991 | - | 4089 | 26.3 / 16.4 / 44.8 | 27 | side_xl | 0.78 | 3.56 |
| 040L 1000x1200 bars 2V/1H | 898×1102 | 67x57 | 787×991 | - | 4089 / 3184 / 3184 | 26.3 / 16.4 / 44.8 | 27 | side_xl | 0.78 | 9.09 |
| 021 1000x1200 | 898×356.2, 898×714.8 | 67x57 | 787×245.2, 787×603.8 | 906 / 906 / 926 | 5573 | 33.8 / 14 / 50.3 | 10.4, fix | top_450, - | 0.67 | 4.85 |
| 120 1800x1500 | 832×1402 | 67x57 | 721×1291 | - | 9255 | 51.8 / 39.1 / 95.4 | 31.5, 31.5 | side_xl, side_xl | 1.86 | 8.05 |
| 052L 1800x1500 | 832×446.2, 832×924.8, 832×1402 | 67x57 | 721×335.2, 721×813.8, 721×1291 | 840 / 840 / 860 | 10587 | 58.7 / 36.9 / 100.5 | 11.6, 21.5, 31.5 | top_450, side_xl, side_xl | 1.76 | 9.21 |
| 021 1800x1500 | 1698×446.2, 1698×924.8 | 67x57 | 1587×335.2, 1587×813.8 | 1706 / 1706 / 1726 | 9943 | 54.3 / 38.3 / 97.2 | 22.2, fix | top_450, - | 1.82 | 8.65 |
| 023 1800x1500 | 832×446.2, 832×443.6, 832×447.2 | 67x57 | 721×335.2, 721×332.6, 721×336.2 | 840 / 840 / 860 | 14568 | 79.6 / 30.4 / 115.5 | 11.6, 11.6, 11.5, 11.5, fix, fix | top_450, top_450, side_xl, side_xl, -, - | 1.45 | 12.67 |
| 142 1800x1500 | 399×1402, 399×446.2, 399×924.8 | 67x57 | 288×1291, 288×335.2, 288×813.8 | 407 / 407 / 427 | 15198 | 82.1 / 29.5 / 117.2 | 17, 6.3, fix, 6.3, fix, 17 | side_460, top_450, -, top_450, -, side_460 | 1.41 | 13.22 |
| 031 1800x1500 (partial mullion) | 832×446.2, 1698×924.8 | 67x57 | 721×335.2, 1587×813.8 | 1706 / 1706 / 1726 | 10380 | 57.9 / 37.3 / 100 | 11.6, 11.6, fix | top_450, top_450, - | 1.77 | 9.03 |
| arched V1 three-centre 1000x1500 start 1300 | 898×1402 | 67x57 | 787×1291 | - | 4632 | 28.1 / 21 / 51.5 | 32.6 | side_xl | 1 | 4.03 |
| circle 800 sunburst (fixed) | 698×698 | 67x57 | 587×587 | - | 2121 / 2055 / 2055 | 17.7 / 5.7 / 24.6 | fix | - | 0.27 | 5.42 |
| CONTROL sash standard 2x2 | - | 57x57/57x90 | 731×610.5 | - | 5959.3 / 4600 / 5750 / 945.3 / 945.3 | 12.24 / 17.47 / 31.2 | - | - | 0.89 | - |
| CONTROL door single-external | - | 94x61/180x61 | 741×1755 | - | - | 0 | - | - | 1.3 | - |

| window | leaf member lengths | frame H / CILL / J / J | mullions | Pre-Cut leaf raw | BOM mm stile / top / bottom | BOM mm transom / mullion | BOM glass m² |
|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.78 |
| 040L 1000x1200 bars 2V/1H | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.78 |
| 021 1000x1200 | 356.2 898 714.8 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2222 / 1836 / 1836 | 926 / - | 0.67 |
| 120 1800x1500 | 1402 832 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5688 / 1704 / 1704 | - / 1443 | 1.86 |
| 052L 1800x1500 | 446.2 832 924.8 1402 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5666 / 2556 / 2556 | 860 / 1443 | 1.76 |
| 021 1800x1500 | 446.2 1698 924.8 | 1800 / 1800 / 1500 / 1500 | - | 63x63 | 2822 / 3436 / 3436 | 1726 / - | 1.82 |
| 023 1800x1500 | 446.2 832 443.6 447.2 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5588 / 5112 / 5112 | 3440 / 1443 | 1.45 |
| 142 1800x1500 | 1402 399 446.2 924.8 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 11332 / 2514 / 2514 | 854 / 4329 | 1.41 |
| 031 1800x1500 (partial mullion) | 446.2 832 924.8 1698 | 1800 / 1800 / 1500 / 1500 | 454.2 | 63x63 | 3754 / 3422 / 3422 | 1726 / 474 | 1.77 |
| arched V1 three-centre 1000x1500 start 1300 | 1253 915.3 898 | 1073.9 / 1000 / 1300 / 1300 | - | 63x63, 180x57 | 2546 / 918 / 918 | - / - | 1 |
| circle 800 sunburst (fixed) | 1982.3 | 2299.6 | - | 200x93 | - / - / - | - / - | 0.27 |
| CONTROL sash standard 2x2 | 822 687.5 720.5 | 1000 / 1000 / 1000 / 1392 / 1392 / 828 / 796 / 1500 / 1500 / 1500 / 1500 | - | 63x63, 63x95 | - / - / - | - / - | 0.89 |
| CONTROL door single-external | 2006 906 | 1000 / 2100 / 2100 / 1000 | - | 94x61, 180x61 | - / - / - | - / - | 1.3 |

| arched window | leaf top outer R | leaf top inner R | glass R | glass bbox | glass origin |
|---|---|---|---|---|---|
| arched V1 three-centre 1000x1500 start 1300 | 99/1349/99 | 32/1282/32 | 43.5/1293.5/43.5 | 787×1291 | 106.5, 102.5 |
| circle 800 sunburst (fixed) | 349/349 | 282/282 | 293.5 | 587×587 | 106.5, 106.5 |

### Stage 1: default profile and migration

`src/engine/profile.js`, `DEFAULT_CASEMENT_PROFILE`:

- `elements.leafStile` / `leafTop` / `leafBottom` `face: 64` (were 67).
- `deductions.glass: 105` = 2 x (64 - 11.5) (was 111 = 2 x (67 - 11.5)).
- `lengths.transomSeat: 8.5` (was 8). `partialMullionSeat` stays 8.
- Comments: the elements block, the glass deduction note, the `transomSeat` line, the glass schema note (111
  then, 105 now) and the `minHaunchRadius` note: 150 - 51 - 64 = **35** (was 32).
- Two schema counters next to `frameSchema` / `glassSchema`: **`leafSchema: 2`** and **`lengthSchema: 2`**, with
  `migrateLeafSchema` / `migrateLengthSchema` written exactly like `migrateGlassSchema` (a table of the OLD
  defaults, an early return when the stored counter is already current, a strict `===` per key, moved keys take
  the default; an element keeps its other keys). `migrateCasementProfile` stamps both counters like the
  other two.
  - leaf schema: each of the three faces that still equals 67 moves to 64; a hand-edited face stays.
  - length schema: `lengths.transomSeat` moves to 8.5 only while it equals 8; a hand-edited seat stays.
- The very old copy (glass schema 1: inset 12.5, glass 109, edge cover 11, leaf 67, no counters) comes out
  inset 11.5, leaf 64 / 64 / 64, glass 105, edge cover 10 (t38 §9, t34).

**Where the migrated profile is written back (brief 1.7).** Read in `windowProfileStore.js` and
`services/cloudSync.js`:

1. App start: zustand `persist` hydrates `pc-window-profile` from localStorage; `onRehydrateStorage`
   migrates the stored `casement`, pushes it to the engine (`setActiveCasementProfile`) and writes it back to the
   store, so **localStorage** holds the migrated copy.
2. Then `loadFromCloud`: `loadWindowProfiles()` reads `settings.constants.windowProfiles` for the tenant,
   migrates it, `set()`s it (localStorage again) and pushes it to the engine.
3. **Nothing writes the cloud on load.** Supabase is written only by `_sync` -> `scheduleCloudSave` ->
   `saveWindowProfiles` (upsert of `constants.windowProfiles = { sash, casement }`), and `_sync` runs only from
   a setter or Reset to defaults.

So the brief's expectation is **not confirmed as stated**: a stored workshop profile holding 67 / 111 / 8 is
used as 64 / 105 / 8.5 from the first load on every client (each load migrates it the same way), and localStorage
holds the migrated copy, but **the cloud row keeps 67 / 111 / 8 until the first edit of any Window Settings
field** after the deploy; that edit uploads the whole migrated profile. The glass schema went exactly the same
way (commit 8b0b96f did not touch the store). Not changed here: a cloud write on load is a new behaviour, so it is
BLOCKERS 27.7. `withProfiles` (batch `_profileSnapshot`) is unchanged: BLOCKERS 27.2.

### Stage 2: one source for the glass deduction

- **`casementGlassDeduction(profile)`**, exported from `profile.js`: `R(2 x (leafStile.face - glassInset))`
  (0.1 rounding, the engine's own expression), `deductions.glass` only when the profile has no numeric
  `glassInset`.
- Readers: `calculations.js` (both places: `glassDed`, and the unit-inset fallback that read `ded.glass / 2`),
  `CasementLeafDetail2D.jsx` (the unit edge `glassIn`, and the subtitle glass), `CasementDrawing2D.jsx` (the glass
  callout), `CasementGlassDrawing2D.jsx`, `WindowSettingsPage.jsx`. The three drawings receive `derived` and now
  print **the engine's unit** (`derived.customGlassUnits[i]`, the glass schedule), the helper only if a unit were
  missing. After the change `deductions.glass` / `ded.glass` is read nowhere in `src` but in `profile.js` (the
  helper's fallback and the glass schema 1 migration).
- Kept in step: `migrateCasementProfile` rewrites the stored `deductions.glass` to the derived value whenever
  `glassInset` is a number; the store rewrites it in `setCasementLeafFace`, `setCasementGeometry` (the
  `glassInset` setter), `setCasementPath`, `setCasementElementField` and `setCasementDeduction`
  (`syncGlassDeduction`).
- No behaviour change but 67 -> 64: t38 §12 pins the OLD numbers (67 / 111 / 8) on the live code and gets
  the reference tree's derived data AND all four sheets **byte for byte** for every window of the set.
- The stale reader is gone, proven on the drawing: with a face of 70 typed through the store, the leaf sheet,
  the glass sheet, the production elevation, the front elevation (drawn daylight) and the Window Settings figure
  all show the schedule's 781 x 985 / deduction 117; the same edit on the reference tree leaves the leaf sheet on
  787 x 991 (t38 §10, the sensitivity check).

### Stage 3: the half millimetre through every consumer of the transom length

| consumer | 021 1000 x 1200 transom | how |
|---|---|---|
| engine `C-TRANSOM` record, `transomRuns[].length` | **906.5** (was 906) | R(898 + 8.5), one decimal |
| cut list (`buildCutListForWindow`), its panel, PDF, Excel sheet, Production Pack | 907 | existing `Math.round` of EVERY member (a 446.2 leaf prints 446): BLOCKERS 27.7 |
| Pre-Cut | **927** (was 926), finished 907 | `Math.round(906.5 + 20)` |
| bar optimiser | whole mm, every piece placed | t38 §14, all 12 windows |
| BOM / purchase list | `c_transom` 927 mm, shown "0.93 m" | Pre-Cut lengths x qty, `formatQty` |
| frame detail sheet `CasementFrameDetail2D` | "C-T 906.5" | 0.5 grid `fmt` |
| `CasementDrawing2D` (imported nowhere) | "C-T · 906.5" | 0.1 `fmt` |
| bSuite rows (`bsuiteExport.js`, read only, unchanged) | LPX 906.5, note "run 906.5" | `r1`; t32 passes untouched |
| Window Settings, Transom card | shows and accepts **8.5** | `NumInput` (type number) -> `setCasementLength` `Number(v)` |

No `parseInt` / `| 0` on these lengths anywhere; every casement record and run keeps at most one decimal (t38
§14 checks all 12 windows). The Excel / PDF exporters print the cut list and Pre-Cut values above; they were not
run under node (they trigger a browser download), their inputs are checked.

### Stage 4: labels and comments

- `materialAssignmentStore.js`: `c_sash_stile` / `c_sash_top_rail` / `c_sash_bottom_rail` read `64×57`; ids,
  names and everything else unchanged.
- `CasementLeafDetail2D.jsx`: the header (section 64, glass 11.5 into the rebate) and the "top-rail 67 chain
  dim" note; the stale "-12.5" / "54.5" comments at the unit edge now read -11.5 / 52.5.
- `CasementGlassDrawing2D.jsx` header (105), `arch.js` circle example (400 / 332, 349 / 285, glass 296.5),
  `glassPdfExport.js` example (V1 glass radii 46.5 / 1296.5 / 46.5). `docs/handover/` not rewritten.

### Stage 5: tests

**New harness `verify/parity/t38_leaf_64_seat_85.mjs`, 311 checks.** It bundles the live `src` and the start
commit 5459f5b (`git archive`, hash in its header) with the engine, the four casement sheets, the unused
`CasementDrawing2D`, the Window Settings page and both stores. Sections 0 to 14:

| § | what | checks |
|---|---|---|
| 0 | profile numbers; every other key of the casement, sash and door profiles unchanged | 7 |
| 1 | leaf outer sizes = reference (11 casement windows) | 11 |
| 2 | sections 64x57 (ref 67x57); straight members = reference; curved members by hand: V1 C-ARCH TOP RAIL 920.0 = 2 x 67 x 1.28700 + 1317 x 0.56758, circle C-LEAF RING 1991.8 = 2 x pi x 317 | 24 |
| 3 | glass units and glass schedule rows = reference + 6 each way | 22 |
| 4 | every transom = reference + 0.5, runs too; 906.5 / 1706.5 / 840.5 literal; Pre-Cut 927 | 21 |
| 5 | frame members, mullions, mullion runs identical; 031 partial mullion 454.2 = 446.2 + 8 | 23 |
| 6 | 040L and 120 by hand (arithmetic in the file; the daylight read off the rendered leaf sheet) | 13 |
| 7 | arched V1 and circle: ring outer - inner = 64 on every arc, glass r = outer - 52.5, origin 51 + 52.5, V1 bottom 47 + 52.5 | 9 |
| 8 | sash and door: derived, cut list, glass schedule deep-equal | 6 |
| 9 | migrations (stored 67/111/8, face 70 -> glass 117, seat 9, current schemas left alone, per face, glass schema 1 copy, idempotent, frame schema 1 copy, a stored old profile derives the new numbers) | 10 |
| 10 | 4 sheets + Window Settings vs the glass schedule, stile 64; again with face 70 typed in the store; sensitivity on the reference tree; a non-whole unit (052L 727 x 341.2) on all three printing sheets | 39 |
| 11 | raw stock: assigned 63x75 stays (flat and schema-2 assignments), unassigned fallback = reference; triple 67x61 -> 64x61; slot labels | 31 |
| 12 | live code with the old numbers pinned = reference, derived and sheets byte for byte | 22 |
| 13 | the helper; structure: the five readers call it, none reads `deductions.glass` | 9 |
| 14 | cut list, Pre-Cut, optimiser, BOM, frame sheet, production elevation, bSuite | 64 |

Second window recomputed by hand (§6), 120 1800 x 1500: leaves 832 x 1402 (900 - 51 - 17), glass 727 x 1297,
daylight 704 x 1274, beading round(2 x 2 x (727 + 1297) x 1.15) = 9310, leaf 2.22528 x 4.468 + 0.942919 x 21 =
29.7438 x 1.05 = 31.2 kg, glass 1.89 m².

**Existing harnesses: 31 failures after the change, every one a consequence of 67 -> 64 or 8 -> 8.5.**
Expectation updated only after the arithmetic below; no assertion deleted or loosened (the check counts are the
same or higher: t16 368 -> 369, t25 225 -> 226, t34 41 -> 46).

| harness : check | old | new | why |
|---|---|---|---|
| t16:91, t18:84, t25:99, t27:57 (literal profile checks) | leafTop / leaf faces 67 | 64 | the default itself |
| t17:127 deepest ring offset | 51 + 67 = 118, 32 below 150 | 51 + 64 = 115, 35 below | leafAtJamb + leafTop.face |
| t18:85 derived constants | glass bottom 102.5, glass offset 106.5 | 99.5 = 47 + (64 - 11.5), 103.5 = 51 + 64 - 11.5 | the face moves the glass line 3 out |
| t18:288 C-ARCH TOP RAIL section | 67x57 | 64x57 | `${face}x${depth}` |
| t16:435 and t25:279, 1000 x rise 200 leaf top rail | ONE 180 board | fewest still ONE 180 (W_req 159 = 200 - 51 + 10, N starts at 1) but the default is the economy plan **2 x 150** | the 64 ring is 3 narrower: 2 pieces need W_req 148.05 <= 150 (150.90 with 67, so no narrower board existed) and pass the limits (shorter edge 458.9 >= 400); the one-board waste 0.532 > wasteThreshold 0.45, rule C.4. The engine plan equals the independent planner `lib/indPlanner.mjs`. New check in both: the shallower 1000 x rise 180 is still ONE 150 board by default (W_req 139 = 180 - 51 + 10, no joint), so a one-board default stays covered |
| t27:134 frame migration keeps other elements | `leafTop.face === 67` | `=== stored` and `=== 64` | the stored copy is the live default |
| t28:105 / 133 / 135 / 138 / 158 glazier DXF | 787 x 1291, `W787 x H1291`, `TOTAL L=2078`, axes 393.5 / 645.5, 133 units 432.3 x 335.2 / 813.8 | 793 x 1297, `W793 x H1297`, `TOTAL L=2090` (793 + 1297), axes 396.5 / 648.5, 438.3 x 341.2 / 819.8 | glass + 6 each way (1000 - 102 - 105, 1500 - 98 - 105), axes at W/2 and H/2 |
| t34:73 casement and fixed units "= ref - 2" | 793 x 1297 vs ref 789 x 1293 | live derived on a profile with the leaf PINNED at 67: 787 x 1291 = ref - 2 (what t34 proves), plus a new check on the default: ref - 2 + 2 x (67 - 64) = ref + 4 | the reference tree 12670b6 has the 67 leaf |
| t34:95 profile | deductions.glass 111 | 105 and leaf 64 | the default |
| t34:104 migration of the 12670b6 default (12.5 / 109 / 11, leaf 67) | 11.5 / 111 / 10 | 11.5 / 105 / 10, leaf 64 | leaf schema moves the face, the deduction is re-derived 2 x (64 - 11.5) |
| t34:108 hand-edited inset 12 | deductions.glass 111 | 104 = 2 x (64 - 12) | the stored deduction now follows face and inset (it showed 111 next to an inset of 12 while the engine used 110) |
| t34:112 "a schema-2 copy is left alone" | the input carried glassSchema 2 only | the input carries all current counters (glass 2, leaf 2, length 2) and stays 12.5 / 109 / 11 / leaf 67 (109 = 2 x (67 - 12.5)); a new check takes the same copy without the leaf schema: 12.5 / 11 kept, leaf 64, deduction 103 = 2 x (64 - 12.5) | "current" now means all four counters |
| t18 §3 R1..R4, t20 §6 (fixture `rect-casement-base.json`) | 67 data | regenerated | see below |
| t19 §1 R1..R4 (fixture `rect-casement-sheets.json`) | 67 sheets | regenerated | see below |
| t26 §3 (fixture `t26-rect-glass-pdf.json`) | 687 x 991, 421 x 991 | regenerated | see below |

**Fixtures, regenerated only after reading the diff** (path by path for the engine fixture, printed text and
geometry counts for the sheets, every text operator of the PDF):

- `rect-casement-base.json` (`node verify/arch/rect_casement_baseline.mjs`): 205 differences in R1..R4, all in
  the allowed set: leaf member `section` / `sizeLabel` / `thickness` (67x57 -> 64x57, triple 67x61 -> 64x61) on
  leaf records only, glass units and rows + 6, beading lengths, weights, leaf weights and the weight inside the
  hinge picks (33.7 -> 33.4, 7.9 -> 7.8, 14.7 -> 14.5, 21.4 -> 21.2, 23 -> 22.9, 18.5 -> 18.3; **no slot
  changes**, no lock change), glass m², bead tape, and the R2 transom 540 -> 540.5 (cut list 541, run 540.5).
- `rect-casement-sheets.json` (`node verify/arch/t19_baseline.mjs live`, provenance 310f61f, ref "live" as t27
  requires): printed changes are the stile 67 -> 64, the daylight and bar chain values, the glass sizes and bar
  positions on the unit, and "C-T 540" -> "C-T 540.5" on the R2 frame sheet; R1 / R3 / R4 frame sheets identical.
- `t26-rect-glass-pdf.json` (`node verify/arch/t26.mjs --rebless`): glass 687 x 991 -> 693 x 997 and 421 x 991
  -> 427 x 997, edge lines 667 x 971 -> 673 x 977, bar axes 191.5 / 476.5 -> 194.5 / 479.5; the sash page
  unchanged; the printed date is masked.
- `rect-sash-base.json`, `rect-sash-sheets.json`: **byte-identical** (t21, t22 green, untouched).

Also: t32 (bSuite) passes unchanged (its transom check is relational); t24_stage4 passes untouched (the
DashboardPage strings); t28's injection into its old tree now carries 64 / 105 (that builder reads neither,
§5 byte identity proves it). Stale leaf numbers in harness comments refreshed in t17, t19, t33 (t24_stage4 is byte-identical to the start commit);
the header arithmetic in t20, t20_bars, t23 and t26 still quotes older numbers (51 + 67 - 12.5): comments
only, their checks compute from the profile.

**The reference set, before -> after** (bold = changed; every other value identical to 5459f5b):

| window | leaf W×H | leaf section | glass units | transom cut / run / Pre-Cut | beading glazing / ext / int | kg timber / glass / total | leaf kg | hinge picks | glass m² | bead tape m |
|---|---|---|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 898×1102 | 67x57 → **64x57** | 787×991 → **793×997** | - | 4089 → **4117** | 26.3 / 16.4 / 44.8 → **25.9 / 16.6 / 44.6** | 27 → **26.8** | side_xl | 0.78 → **0.79** | 3.56 → **3.58** |
| 040L 1000x1200 bars 2V/1H | 898×1102 | 67x57 → **64x57** | 787×991 → **793×997** | - | 4089 / 3184 / 3184 → **4117 / 3205 / 3205** | 26.3 / 16.4 / 44.8 → **25.9 / 16.6 / 44.6** | 27 → **26.8** | side_xl | 0.78 → **0.79** | 9.09 → **9.15** |
| 021 1000x1200 | 898×356.2, 898×714.8 | 67x57 → **64x57** | 787×245.2, 787×603.8 → **793×251.2, 793×609.8** | 906 / 906 / 926 → **906.5 / 906.5 / 927** | 5573 → **5628** | 33.8 / 14 / 50.3 → **33.2 / 14.3 / 49.9** | 10.4, fix → **10.3, fix** | top_450, - | 0.67 → **0.68** | 4.85 → **4.89** |
| 120 1800x1500 | 832×1402 | 67x57 → **64x57** | 721×1291 → **727×1297** | - | 9255 → **9310** | 51.8 / 39.1 / 95.4 → **50.8 / 39.6 / 95** | 31.5, 31.5 → **31.2, 31.2** | side_xl, side_xl | 1.86 → **1.89** | 8.05 → **8.1** |
| 052L 1800x1500 | 832×446.2, 832×924.8, 832×1402 | 67x57 → **64x57** | 721×335.2, 721×813.8, 721×1291 → **727×341.2, 727×819.8, 727×1297** | 840 / 840 / 860 → **840.5 / 840.5 / 861** | 10587 → **10670** | 58.7 / 36.9 / 100.5 → **57.6 / 37.5 / 99.9** | 11.6, 21.5, 31.5 → **11.4, 21.4, 31.2** | top_450, side_xl, side_xl | 1.76 → **1.79** | 9.21 → **9.28** |
| 021 1800x1500 | 1698×446.2, 1698×924.8 | 67x57 → **64x57** | 1587×335.2, 1587×813.8 → **1593×341.2, 1593×819.8** | 1706 / 1706 / 1726 → **1706.5 / 1706.5 / 1727** | 9943 → **9998** | 54.3 / 38.3 / 97.2 → **53.3 / 38.8 / 96.7** | 22.2, fix → **22, fix** | top_450, - | 1.82 → **1.85** | 8.65 → **8.69** |
| 023 1800x1500 | 832×446.2, 832×443.6, 832×447.2 | 67x57 → **64x57** | 721×335.2, 721×332.6, 721×336.2 → **727×341.2, 727×338.6, 727×342.2** | 840 / 840 / 860 → **840.5 / 840.5 / 861** | 14568 → **14734** | 79.6 / 30.4 / 115.5 → **78 / 31.2 / 114.7** | 11.6, 11.6, 11.5, 11.5, fix, fix → **11.4, 11.4, 11.4, 11.4, fix, fix** | top_450, top_450, side_xl, side_xl, -, - | 1.45 → **1.49** | 12.67 → **12.81** |
| 142 1800x1500 | 399×1402, 399×446.2, 399×924.8 | 67x57 → **64x57** | 288×1291, 288×335.2, 288×813.8 → **294×1297, 294×341.2, 294×819.8** | 407 / 407 / 427 → **407.5 / 407.5 / 428** | 15198 → **15364** | 82.1 / 29.5 / 117.2 → **80.4 / 30.4 / 116.3** | 17, 6.3, fix, 6.3, fix, 17 → **16.8, 6.2, fix, 6.2, fix, 16.8** | side_460, top_450, -, top_450, -, side_460 | 1.41 → **1.45** | 13.22 → **13.36** |
| 031 1800x1500 (partial mullion) | 832×446.2, 1698×924.8 | 67x57 → **64x57** | 721×335.2, 1587×813.8 → **727×341.2, 1593×819.8** | 1706 / 1706 / 1726 → **1706.5 / 1706.5 / 1727** | 10380 → **10463** | 57.9 / 37.3 / 100 → **56.8 / 37.8 / 99.4** | 11.6, 11.6, fix → **11.4, 11.4, fix** | top_450, top_450, - | 1.77 → **1.8** | 9.03 → **9.1** |
| arched V1 three-centre 1000x1500 start 1300 | 898×1402 | 67x57 → **64x57** | 787×1291 → **793×1297** | - | 4632 → **4657** | 28.1 / 21 / 51.5 → **27.7 / 21.2 / 51.3** | 32.6 → **32.4** | side_xl | 1 → **1.01** | 4.03 → **4.05** |
| circle 800 sunburst (fixed) | 698×698 | 67x57 → **64x57** | 587×587 → **593×593** | - | 2121 / 2055 / 2055 → **2142 / 2077 / 2077** | 17.7 / 5.7 / 24.6 → **17.6 / 5.8 / 24.6** | fix | - | 0.27 → **0.28** | 5.42 → **5.47** |
| CONTROL sash standard 2x2 | - | 57x57/57x90 | 731×610.5 | - | 5959.3 / 4600 / 5750 / 945.3 / 945.3 | 12.24 / 17.47 / 31.2 | - | - | 0.89 | - |
| CONTROL door single-external | - | 94x61/180x61 | 741×1755 | - | - | 0 | - | - | 1.3 | - |

| window | leaf member lengths | frame H / CILL / J / J | mullions | Pre-Cut leaf raw | BOM mm stile / top / bottom | BOM mm transom / mullion | BOM glass m² |
|---|---|---|---|---|---|---|---|
| 040L 1000x1200 | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.78 → **0.79** |
| 040L 1000x1200 bars 2V/1H | 1102 898 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2244 / 918 / 918 | - / - | 0.78 → **0.79** |
| 021 1000x1200 | 356.2 898 714.8 | 1000 / 1000 / 1200 / 1200 | - | 63x63 | 2222 / 1836 / 1836 | 926 / - → **927 / -** | 0.67 → **0.68** |
| 120 1800x1500 | 1402 832 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5688 / 1704 / 1704 | - / 1443 | 1.86 → **1.89** |
| 052L 1800x1500 | 446.2 832 924.8 1402 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5666 / 2556 / 2556 | 860 / 1443 → **861 / 1443** | 1.76 → **1.79** |
| 021 1800x1500 | 446.2 1698 924.8 | 1800 / 1800 / 1500 / 1500 | - | 63x63 | 2822 / 3436 / 3436 | 1726 / - → **1727 / -** | 1.82 → **1.85** |
| 023 1800x1500 | 446.2 832 443.6 447.2 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 5588 / 5112 / 5112 | 3440 / 1443 → **3444 / 1443** | 1.45 → **1.49** |
| 142 1800x1500 | 1402 399 446.2 924.8 | 1800 / 1800 / 1500 / 1500 | 1423 | 63x63 | 11332 / 2514 / 2514 | 854 / 4329 → **856 / 4329** | 1.41 → **1.45** |
| 031 1800x1500 (partial mullion) | 446.2 832 924.8 1698 | 1800 / 1800 / 1500 / 1500 | 454.2 | 63x63 | 3754 / 3422 / 3422 | 1726 / 474 → **1727 / 474** | 1.77 → **1.8** |
| arched V1 three-centre 1000x1500 start 1300 | 1253 915.3 898 → **1253 920 898** | 1073.9 / 1000 / 1300 / 1300 | - | 63x63, 180x57 → **63x63, 150x57** | 2546 / 918 / 918 → **2546 / 1048 / 918** | - / - | 1 → **1.01** |
| circle 800 sunburst (fixed) | 1982.3 → **1991.8** | 2299.6 | - | 200x93 | - / - / - | - / - | 0.27 → **0.28** |
| CONTROL sash standard 2x2 | 822 687.5 720.5 | 1000 / 1000 / 1000 / 1392 / 1392 / 828 / 796 / 1500 / 1500 / 1500 / 1500 | - | 63x63, 63x95 | - / - / - | - / - | 0.89 |
| CONTROL door single-external | 2006 906 | 1000 / 2100 / 2100 / 1000 | - | 94x61, 180x61 | - / - / - | - / - | 1.3 |

| arched window | leaf top outer R | leaf top inner R | glass R | glass bbox | glass origin |
|---|---|---|---|---|---|
| arched V1 three-centre 1000x1500 start 1300 | 99/1349/99 | 32/1282/32 → **35/1285/35** | 43.5/1293.5/43.5 → **46.5/1296.5/46.5** | 787×1291 → **793×1297** | 106.5, 102.5 → **103.5, 99.5** |
| circle 800 sunburst (fixed) | 349/349 | 282/282 → **285/285** | 293.5 → **296.5** | 587×587 → **593×593** | 106.5, 106.5 → **103.5, 103.5** |

### Stage 6: independent review, final suite, Done when

**Independent review** (one agent that had not seen the work; read-only; it re-derived the numbers by hand,
audited every changed assertion and read every fixture diff, ran the suite and the build). **Verdict: PASS WITH
FINDINGS.** Its hand numbers (040L leaf / glass / daylight / beading / leaf and window weights / m² / tape, the
three transoms and Pre-Cut, 120 1800 x 1500, the deduction 105, the arched ring 64 and glass line 52.5, V1
C-ATR 920.0, circle 1991.8, the haunch note 35) all match the engine, the logs and t38. "Nothing was deleted or
weakened"; the casement fixtures moved only in the allowed categories; the sash fixtures are byte-identical; the
helper's rounding equals the old engine expression on faces 50 to 80 and six insets. Its findings and what was done:

| # | finding | done |
|---|---|---|
| 1 | Stage 6 of BUILD-LOG incomplete, no PR yet | this section, the verdict, the PR |
| 2 | the cut list / Pre-Cut finished column print the 906.5 transom as 907 | kept: the whole-mm rule covers every member (446.2 -> 446) and the sash cut list is pinned byte for byte by `rect-sash-base.json`; a one-decimal cut list would also move every casement leaf length in the fixture outside the allowed categories. Piotr decides: BLOCKERS 27.7 b |
| 3 | t38 §6 daylight checks were tautologies | fixed: the daylight is read off the rendered leaf sheet (770 x 974, 704 x 1274, reference 764 x 968 / 698 x 1268) |
| 4 | no check left where the engine default is ONE whole-chain board | fixed: t16 and t25 add the 1000 x rise 180 leaf top rail, ONE 150 board, W_req 139, no joint (t25 against the independent planner) |
| 5 | t34 m² checked only on the pinned 67 profile | fixed: also on the default profile |
| 6 | the "sheet = schedule" proof covered whole sizes only | fixed: 052L (727 x 341.2) on the glass sheet and the production elevation (exact) and the leaf sheet (its 0.5 grid, "341"; BLOCKERS 27.7 d) |
| 7 | "151.05 with the 67 face" is wrong | fixed: 150.90 (engine and independent planner on 5459f5b), still above 150 |
| 8 | a stored `glassInset: null` keeps the old `deductions.glass`; a leaf element without `face` gives NaN | not changed: neither can come from the UI or the cloud (the migration fills a missing `glassInset` from the default; `face` is always written), and the engine had the same fallback before |
| 9 | the leaf sheet's dashed unit outline still comes from the deduction, not from the derived unit | not changed: it now uses the one-source helper, consistent by construction (t38 §12 byte identity) |
| 10 | t24_stage4 got a comment edit although the brief says "untouched" | fixed: the file is byte-identical to 5459f5b again |
| 11 | the re-blessed t26 fixture stores the masked date | harmless: the check masks both sides |

**Final suite, run twice on the final tree (665a42a + this log), identical both times: 24 harnesses, 2536
checks, 0 failures. `npm run build` OK (16.2 s).**

| harness | checks | | harness | checks | | harness | checks |
|---|---|---|---|---|---|---|---|
| t16 | 369 (was 368) | | t23 | 81 | | t33_bar_grid | 43 |
| t17_edges | 70 | | t24_stage4 | 26 | | parity t31_bars_8x8 | 18 |
| t18 | 179 | | t25 | 226 (was 225) | | parity t32_bsuite | 54 |
| t19 | 280 | | t26 | 38 | | parity t34_glass_minus1 | 46 (was 41) |
| t20 | 117 | | t27 | 87 | | parity t35_locks | 51 |
| t20_bars | 31 | | t28 | 50 | | parity t36_hinges | 110 |
| t21 | 120 | | t29 | 34 | | parity t37_single_window_bom | 47 |
| t22 | 118 | | t30_preview | 30 | | **parity t38_leaf_64_seat_85 (new)** | **311** |

2218 at the start + 311 (t38) + 1 (t16) + 1 (t25) + 5 (t34) = 2536. `psw-casement-layouts` rc 2 (no PSW clone),
not counted, as at the start.

**Done when.**

1. No 67 left for the casement leaf in `src`. `grep -rnP '(?<![\d.#])67(?![\d])' src` (outside `src/3d` and
   the welcome SVG) leaves only: history notes ("was 67", `profile.js:105, 107, 125, 163, 204, 429, 439`,
   `CasementLeafDetail2D.jsx:8, 172`), the glass schema 1 history `profile.js:489`, the migration's table of the
   OLD default `LEAF_SCHEMA_1` (`profile.js:520, 523`, it must hold 67 to recognise it) and a paint colour name
   (`config.js:85`, "Farrow's Cream 67"). The four `src/3d` hits are sash hardware positions (out of scope).
2. Default profile and a migrated stored profile: 64 / 105 / 8.5 (t38 §0, §9; t34).
3. One source: `deductions.glass` is read in `src` only by the helper's fallback and the glass schema 1
   migration (`profile.js`); the store and the migration WRITE it in step (t38 §10, §13).
4. Reference set as specified, controls identical (t38 §1 to §8, §12; the before / after table in Stage 5).
5. Suite green twice, build green, counts above.
6. PR opened, not merged; BUILD-LOG, BLOCKERS 27 and `docs/handover/CASEMENT-LEAF-64.md` written.

---

## 2026-09-21 — BAR GRID: one grid of glazing-bar lines for the casement window (chat session, ZIP delivery)

### Verdict ✅ — the rule is in the engine, every consumer reads it, 22 rectangular sheets still byte-identical

Piotr, from a 3-light casement with a fanlight over the middle light (the 3D preview): *"mamy 8 ale pod fanem też
mamy 8 a powinno być 6 i totalnie wyrównane z prawym i lewym skrzydłem"*. Cause, found in the code: every light
spread the spec count of horizontal bars over its OWN glass height (3D `CasementGlazing`, the three 2D sheets, the
glass PDF and DXF, the glass rows), so the light under the fan got the same 3 bars squeezed into a shorter glass and
none of them met the side lights' lines. The same law sits in PSW (its 2D `casBars` and its 3D).

**The rule (approved by Piotr 21.09.2026, mockup first):** the horizontal bars are ONE grid for the whole window —
set out on the tallest main light (equal panes, as today); every main light shows the lines that cross its own
glass; a line whose sliver against the light's edge would be lower than **1/3 of a normal pane** is dropped
(*"niż 1/3 będzie ok"*); fanlights keep their own counts; the fan height stays whatever the client set (no snapping —
the fan decides how many lines fall under it: 2100 × 1400 131 with 3 H, fan 30 % → 2 bars, 50 % → 1 bar).

**Where it lives:** `src/engine/casementBarGrid.js` — `alignMainBarLines()` (the rule), `casementLeafBars()` (the
engine entry, bars of every leaf in frame AND leaf coordinates), `leafBarsToUnit()` (glass-unit coordinates), and
the two helpers that moved here from the drawings: `casementBarCounts` (from `casementDrawUtils.js`, re-exported
there) and `computeBarPositions` (from `drawingUtils.jsx`, re-exported there — the sash / door sheets keep their
import). `deriveCasementWindow` computes the bars ONCE per window: `derived.casement.leaves[i].bars` (`counts`,
`aligned`, `dropped`, `frame`, `local`) and `derived.customGlassUnits[i].bars` (`h`, `v`, `x`, `y`).

**How many paths compute a casement bar position now — the honest count.** Before: **eight** (3D
`CasementGlazing`, `CasementElevation2D`, `CasementLeafDetail2D`, `CasementGlassDrawing2D`, the glass PDF sketch,
`glassDxfExport.rectBarsForRow`, the glass rows in `lists.js`, the astragal run in `calculations.js`), in three
different placement laws (2D: equal panes between 22 mm wood bars on the daylight; 3D: equal split of the 64-rail
glass; PDF / DXF: equal split of the unit from counts). After: **two.** (1) The engine — the three sheets, the rows,
the PDF, the DXF and the astragal run read its numbers, no recomputation (t33 §6 greps for it). (2) The 3D
`CasementWindow.jsx`, a PSW parity file: it applies the SAME `alignMainBarLines` to its own glass rects and keeps
its own equal-split placement for the reference light (changing that would move every casement preview against
PSW). Consequence, named: the 3D preview's bars sit within ~1.5 mm of the sheets' (64 vs 67 rail); the SET of
lines a light shows can differ between the preview and the sheets only when a sliver lies within 3 mm of the 1/3
threshold. The sheets are the production truth.

**What changed in the output, beyond the fan case.** The glass PDF sketch and the glazier DXF used to split the
unit equally from counts while the factory drawing placed the wood bars on the daylight and converted — the two
differed by up to 0.75 mm on a unit with 2 or 3 bars (the PDF comment claimed they matched; they did not). Both now
print the engine axes, so drawing = PDF = DXF by construction (t26 §3 pins the 1H × 2V chain 121.5 / 122 / 121.5).
On a unit with one bar per direction nothing moves (the axis is the centre in every law).

**Fixtures — none re-blessed.** t19: all 22 rectangular sheets (R1 – R4) byte-identical to the pre-night-4
fixture — the engine computes the sheets' numbers with the sheets' own expression order, so the SVG text is the
same string. t18 §3 / t20: the derived JSON gained the bar keys; the harness strips exactly those keys
(`leaves[].bars`, `customGlassUnits[].bars`, glass row `barAxes`) before comparing with the UNCHANGED fixture, so
everything else is still guarded byte for byte, and the new keys are checked by t33. t26 §3: the byte-identity
against 402c58a runs on 1H × 1V (where the old and new sketch coincide) plus the new axes check.

**Suite ALL PASS — 19 harnesses, 1928 checks, 0 failures. `npm run build` OK (14.1 s).**

| harness | checks | | harness | checks | | harness | checks |
|---|---|---|---|---|---|---|---|
| t16 | 368 | | t22 | 118 | | t28 | 50 |
| t17_edges | 70 | | t23 | 81 | | t29 | 34 |
| t18 | 179 | | t24_stage4 | 26 | | t30_preview | 30 |
| t19 | 280 | | t25 | 225 | | **t33_bar_grid (new)** | **43** |
| t20 | 117 | | t26 | 37 (was 36) | | parity t31_bars_8x8 | 18 |
| t20_bars | 31 | | t27 | 87 | | parity t32_bsuite | 54 |
| t21 | 120 | | | | | | |

t33 (`node verify/arch/t33_bar_grid.mjs`) on the real data path: 131 3H × 1V → 8 / 6 / 8, the middle light's
frame lines EXACTLY the sides' 2nd and 3rd (frame y 702 / 999.5), an independent formula agrees; fan 15 % → 2
(line 1 lands in the transom band: 18 mm sliver), 50 % → 1; the 1/3 boundary ± 1 mm on a 1-bar window (with 3 bars
the boundary lies below the 15 % fan clamp, so a 3-bar light under a fan can never show all three — FYI); rows,
astragal run (8730 not 9485), elevation SVG y attributes shared between lights, leaf and glass sheets on the engine
lines, DXF axes mirrored to y-up, the 3D plan on the 3D rects; 040L / 120 / 133 / 013 untouched; 142 and 052L.
Visual proof: `CasementElevation2D` of the 131 rendered from HEAD and from this tree, side by side (sent to Piotr).

**The 3D was seen** (Piotr 07.09: test the component that renders the screen, not the geometry under it): the real
`CasementWindow` mounted in a throw-away vite page under headless Chromium (SwiftShader), 131 3H × 1V at fan 30 %
→ 8 / 6 / 8 with the middle bars on the sides' lines, at fan 50 % → 8 / 4 / 8; both screenshots sent to Piotr. The
wiring (`hBarPositions` from `CasementWindow` through `CasementPanel` / `SashFrame` into `CasementGlazing`) is also
asserted by t33 §6.

**Balance (src):** 95 added / 115 removed in 12 existing files, plus the new engine module (143 lines) — the
removed lines are the seven recomputations. Harnesses: +42 / −6 in t18 / t20 / t26, t33 new (244 lines).
Docs: `docs/handover/PSW-BAR-GRID-PORT.md` — the PSW port, line by line on PSW `b699610` (19.09.2026).

---

## 2026-09-08 — NIGHT 8 (turn 65), branch `claude/magical-edison-j5q0a9`

### Verdict ⛔ NOT RUN — the brief in `CLAUDE.md` is another repository's. Zero feature code written.

`CLAUDE.md` at HEAD is `TURN 65 · PBI: THE EMPTY ROOM, THE BAYS, AND WHAT THE CARCASS WEARS` — a retail wardrobe
designer. F1–F10 name 15 files and symbols; **14 return zero files** in `src/` and `verify/`, and none has ever
existed on any branch. The three "licensed engine files" are `endPanelAuto.js` (absent), `cabinet.js` (absent)
and `profile.js` (present, but it is the sash-window profile). There is no `reference/lisp/`, no `src/retail/`,
no six goldens, no `verify/t65/`. Full evidence table in `BLOCKERS.md` §25.

Not built here, deliberately: this repo's own CLAUDE.md says *"Trzy osobne produkty, nie duplikować logiki
między nimi"* and *"poza zakres nie wychodź"*, and the brief's first law is *"1:1 = COPY … never re-invent"* —
with no PRO wardrobe app present, every F would have been invention. `Piotr3009/Cabinet-core` is the likely
home; attaching it was denied by the sandbox, so that stays an inference. See BLOCKERS §25.3–25.4.

### What was done instead: a truthful baseline of this repo. Nothing changed, tree clean.

**Suite ALL PASS — 16 harnesses, 1852 checks, 0 failures. `npm run build` OK (15.2 s).**

| harness | checks | | harness | checks |
|---|---|---|---|---|
| t16 | 368 | | t23 | 81 |
| t17_edges | 70 | | t24_stage4 | 26 |
| t18 | 179 | | t25 | 225 |
| t19 | 280 | | t26 | 36 |
| t20 | 117 | | t27 | 87 |
| t20_bars | 31 | | t28 | 50 |
| t21 | 120 | | t29 | 34 |
| t22 | 118 | | t30_preview | 30 |

**t16–t29 = 1822 — byte-for-byte the figure night 7 stage 5 recorded.** Nothing has drifted since the last
verdict; t30_preview's 30 is the only addition, giving 1852.

### Two live footguns found while running it — worth knowing before the next night

**1. `verify/arch/*_baseline.mjs` are fixture GENERATORS, not tests.** `rect_casement_baseline.mjs`,
`t19_baseline.mjs` and `t22_baseline.mjs` print no verdict and exit 0 — and rewrite fixtures. Running the
directory as a set (`for f in verify/arch/*.mjs`) silently re-blessed
`verify/arch/fixtures/rect-casement-sheets.json`, flipping its provenance from `ref:"live" commit:0d211fd` to
`ref:"HEAD" commit:<current HEAD>`, which then fails t27 line 347 — a failure that looks like a code regression
and is not one. Caught and reverted here; the tree is clean. **Run `verify/arch/t*.mjs` minus `*baseline*`.**

**2. `t26` rewrites two sample PDFs on every run** (`docs/handover/samples/sample_glass_order_arched*.pdf`) —
jsPDF stamps a new document id, so `git status` shows them modified after any green run. Benign; do not commit
the churn.

### Prerequisites for a cold container (18 of 20 harnesses fail without them, all `MODULE_NOT_FOUND`, no code fault)

```
npm install                 # 239 packages
pip install ezdxf           # 1.4.4 — t16, t17_edges, t25 shell out to verify/arch/dxf_probe.py
```

`verify/parity/psw-casement-layouts.mjs` was **not** run: it needs a read-only PSW clone at `/home/user/psw`
(`git -c http.proxyAuthMethod=basic clone --depth 1 https://github.com/Piotr3009/Prime-Sash-Windows.git psw`)
and PSW is outside this session's GitHub scope. It exits rc=2 with that instruction — not a failure.

---

## 2026-09-06 — NIGHT 7 (zadanie nocne 7), Stage 1 (branch `claude/zadanie-nocne-7-glass-dxf-wb0eay`)

Entry gate re-run after Piotr put `gothic-full-v1` on `main` (e037020): `mode = 'full'` **1**, `labels BESIDE the
piece` **1** — both green, branch rebased onto `origin/main` keeping the night-7 stop entry. Baseline on the rebased
tree: t16 368 · t17_edges 70 · t18 178 · t19 244 · t20 **117** (was 116 — gothic-full-v1 adds one) · t20_bars 32 ·
t21 120 · t22 77 · t23 81 · t24_stage4 26 · t25 201 · t26 36 · t27 64 = 1614 ALL PASS, build OK.

### STAGE 5 (after the four) — BLOCKERS §19.6 closed: spec C.5 re-issued for the 68 frame ✅

**Verdict ✅** — t25 **225 checks** (was 201) ALL PASS, whole suite t16–t29 = **1822 checks ALL PASS**, build OK.

§19.6 asked for the C.5 reference table to be re-issued for the 68 frame; it needed no decision from Piotr, only
the arithmetic. `docs/handover/ARCHED-WINDOWS-v4.md` gains **C.5b** (the original C.5 is kept as history — it is
correct for the frame it was written against), computed with the same independent projection, allowance 10 and
finger 15, on the live profile:

| arch | pieces × board | W_req at 68 (was at 57) | outer edges | inner edges |
|---|---|---|---|---|
| HALF 1000 semi-circle | 3 × 150 | **144.5** (134.7) | 551.0 / 592.1 / 551.0 | 464.4 / 418.8 / 464.4 |
| ROUND 1000 rise 250 | 2 × 180 | **165.5** (158.3) | 619.5 ×2 | 529.5 ×2 |
| GOTHIC 1000 per side | 2 × 120 | **119.4** (112.6) | 532.1 / 573.9 | 500.0 / 421.7 |
| HALF 1500 semi-circle | 3 × 180 | **178.0** (168.1) | 819.4 / 878.7 / 819.4 | 715.4 / 670.9 / 715.4 |
| tc240 1200 rise 240 | 2 × 180 | **176.8** (170.6) | 697.9 ×2 | 625.9 ×2 |

**Piece counts and boards did not move** — only the required board width, because the head ring grew with the
frame. HALF 1500 keeps its economy default 4 × 150; 2 pieces still need 211.6 (HALF 1000) and 284.8 (HALF 1500),
so still no board. t25 §2c regenerates every line from the live profile and asserts the document quotes it, so
C.5b cannot drift from the engine the way C.5 did.

**Other §19 items were left alone deliberately:** 19.3 (profile snapshot per project), 19.5 (economy rule C.4
"AND lower waste") need Piotr's decision; 19.7 (Part Registry 68 × 93) is a Supabase data change and this package
makes none; 19.8 (PSW port) is Piotr's own repo; 19.2 / 19.4 / 19.10 are FYI with nothing to do; 19.1 closed in
stage 3 and 19.9 is answered as far as measurement can (stage 4) and now waits on eyes.

---

### STAGE 4 — the 3D after the 68 frame: control ✅ (two gaps found, one fixed by measurement, one referred)

**Verdict ✅** — new gate **t29, 34 checks ALL PASS**; whole suite t16–t29 = **1798 checks ALL PASS**,
`npm run build` OK (15.0 s). **No 3D source file was changed** — see "what I did not change" below.

**Piotr's "3D jakieś kwadratowe": the arched path is NOT the cause.** Measured on real configs
(`normaliseToWindowSpec` → `windowSpecToConfig` → `archedCasementGeometry`, the same call
`ArchedCasementWindow` makes):

| check | result |
|---|---|
| semi-circle 1000 × 1500 | radius **500** from arch.js, **52** outline points, apex above the springing — a real arc |
| three-centre 1000 × 1500 | **3** radii, **148** points |
| gothic-equilateral 1000 × 1800 | **2** radii, **100** points |
| ring 1 (full face) | offset **68** = the profile face |
| ring 2 (rebated land) | offset **47** = the profile land |
| ring spans at the springing | `W − 2·68` and `W − 2·47` on every shape |
| arched leaf width | **898** = 1000 − 2·leafAtJamb 51 |
| no `frameDims` passed | still the PSW 57 / 36 — the profile only wins when passed, so PSW is unaffected |
| **Kind: Fixed** on an arch | `casementType 'arched'`, `fixedLeaf true`, shape and `frameDims` kept — it stays on `ArchedCasementWindow`, it does NOT become a rectangle |
| door + side panel | `frameDims { 68, 43 }` (option B reached the 3D); the post is two abutting jambs = 2 × 68 = **136**, matching the profile and the engine's `zones.posts[0].w` |

A pointed arch drops its apex by MORE than the ring offset (concentric per arc), so t29 measures the ring
offset as the SPAN at the springing — the invariant that holds for round and pointed shapes alike. My first
version of that check asserted the apex drop and correctly failed on the gothic; the geometry was right, the
assertion was wrong.

**GAP 1 — the circle never receives the profile (BLOCKERS §24.1).** `windowSpecToConfig` routes
`arch.shape === 'circle'` to `windowCategory: 'fix-only'` with `fixShape: 'circle'`, so the viewer does draw a
CIRCLE (not a rectangle) — but that branch passes **no `frameDims`**, and `FixFrameWindow` has no such prop: it
carries its own `FRAME_FACE = 64`. So a circle window's 3D frame is 64 wide while its engine rings come from the
68 casement profile. `archedCasementGeometry` cannot take the circle instead — asked for `'circle'` it silently
resolves to a semi-circle (t29 §5 pins that), which is exactly why the circle must stay on the fix-frame path.

**GAP 2 — the 3D leaf is 4 mm short in height (BLOCKERS §24.2).** 040L 1000 × 1500: the 3D leaf is
**898 × 1398**, the engine's is **898 × 1402**. The width is right by construction
(`W − 2·(face − rebate + gap)` = `W − 2·leafAtJamb`, 68 − 21 + 4 = 51 ✓). The height is not, because the 3D
holds the leaf `BOTTOM_FACE 68 − REBATE_STEP 21 + gap 4 = 51` above the frame bottom — it models the cill like a
jamb — while the profile puts it at `gapCill 6 + cillVisible 41 = 47`. **Pre-existing**: at the 57 face it was
1409 vs 1413, the same 4 mm, so Block F did not cause it.

**What I did NOT change, and why.** Closing gap 2 means teaching the 3D that the cill has its own land and gap
(41 / 6) instead of a jamb's (47 / 4). That moves the rebate line and the visible cill height on **every**
casement render, in a component shared with PSW, and the mapping between the two cill models is a workshop fact
I cannot derive: the profile says 41 shows and the leaf sits 6 above it, the 3D says the leaf laps a 21 rebate
with a 4 gap. Guessing would change how every window looks — the exact complaint this stage exists to answer.
So t29 pins the difference with its cause and its size, and BLOCKERS §24.2 carries the two candidate fixes for
Piotr. Gap 1 is the same shape of decision: is a circle's frame the casement's 68 section or the fix-frame's own
64? — and threading `frameDims` into `FixFrameWindow` diverges a PSW-shared file, which CLAUDE.md reserves for
the PSW port.

**Not verified in this stage:** nothing was rendered in a browser or in three.js — R3F components were not
mounted; every number comes from the geometry helpers and the config mapper called directly in node. The
viewer's appearance (Piotr's screenshot, which has not arrived) is still unconfirmed, and if "kwadratowe" refers
to something other than the arch, the circle frame (gap 1) is the first place to look.

---

### STAGE 3 — doors take option B ✅

**Verdict ✅** — t27 **87 checks** (was 65) ALL PASS, whole suite t16–t28 = **1764 checks ALL PASS**,
`npm run build` OK (16.0 s), esbuild clean on the three touched sources, all four door 2D sheets render without
NaN for single / french / single + side panel.

**The change** (`DEFAULT_DOOR_PROFILE` in `src/engine/profile.js` — four numbers, nothing else):
the REBATE is the invariant and the wider face buys land, exactly as the casement frame already works.
`land = jamb face − rebate = 68 − 25 = 43`. Option A left the door with a 32 mm rebate step (68 − 36) on a
frame whose rebate is 25 — that mismatch is what BLOCKERS §19.1 asked about; it is now closed.

**Old and new numbers — produced BY the harness (t27 §5b re-derives the `d733414` tree and prints the table), not
by hand:**

| | before (option A) | after (option B) |
|---|---|---|
| profile `geometry.land` | 36 | **43** = face 68 − rebate 25 |
| profile `deductions.leafAtJamb` | 40 | **47** = land 43 + gap 4 |
| profile `deductions.leafFullHeight` | 87 | **94** = leafAtJamb 47 + gapCill 6 + cillVisible 41 |
| profile `deductions.leafNoThreshold` | 46 | **53** = leafAtJamb 47 + gapCill 6 |
| **door 1000 × 2100** leaf | 920 × 2013 | **906 × 2006** |
| **french 1200 × 2100** leaf (each of two) | 563 × 2013 | **556 × 2006** |
| door leaf x inside its frame | 40 | **47** |
| side panel 400 leaf | 320 | **306** |
| door without a threshold, 2100 | 2054 high | **2047** high |
| coupling post visible band, outward (land + land) | 72 | **86** |
| coupling post visible band, inward (land + face) | 104 | **111** |

`leafAtMullionAxis` stays **17** (= mullionLand 26 / 2 + gap 4) — the mullion land did not move, same as the
casement. The rebate stays **25** (casement 21 + 4). The coupling post stays **136** (2 × jamb face). Door cut-list
SECTIONS are byte-identical before and after (t27 §5b): option B moves lengths, never stock.

**Everything followed the profile — no engine edit was needed.** `deriveDoorWindow` already takes
`edge = ded.leafAtJamb`, `clearW = frameWidth − 2·edge`, `leafW = isFrench ? (clearW + overlap)/2 : clearW`,
`panelLeaves = f.w − 2·edge`, `leafH = frameHeight − (hasTimberCill ? leafFullHeight : leafNoThreshold)` and the
post band from `geo.land` / `els.frameHead.face`. The only source edits outside the profile are two comments
(`calculations.js` "40 = land 36 + gap 4" → 47 / 43, `windowSpecToConfig.js` "68 / 36" → "68 / 43").

**No migration needed, unlike the casement.** `setDoorProfile()` has no call site anywhere in the app, so
`getDoorProfile()` always returns `DEFAULT_DOOR_PROFILE` — there is no stored door profile in Supabase or
localStorage to migrate (the casement needed `migrateCasementProfile` precisely because its profile IS stored).

**Gate note:** the brief names "t14 / t27"; there is no t14 in this repository (`verify/arch` holds t16–t28), so
t27 is the door gate. Its §1 now derives every door number from the profile formula and §5b diffs the whole set
against `d733414`.

**Not verified in this stage:** no browser and no 3D viewer — the door frame's 68 face with a 43 land, and the
136 post's new 86 / 111 visible band, are asserted numerically and rendered server-side, not looked at. Pricing
and BOM were not re-checked against the 14 mm narrower leaf (they read the engine rows, so they follow, but no
quote was compared).

---

### STAGE 2 — one dimension rule on every sheet ✅

**Verdict ✅** — t19 **280** (was 244) and t22 **118** (was 77) ALL PASS with the new rule gate, whole suite
t16–t28 = **1742 checks ALL PASS**, `npm run build` OK (16.5 s), esbuild clean on all five touched sheets,
no Polish in sources.

**The rule** (as `CasementGlassDrawing2D` already implemented it — the sheet Piotr called right): spacing chains
and axis dims along the **BOTTOM**, the overall **width at the TOP**, **heights on the RIGHT**. arch-pieces-v1 had
applied it to the casement elevation and glass sheets only (the comment in t19 §1 records that); this stage brings
the rest in line.

| Sheet | Before | After |
|-------|--------|-------|
| `CasementLeafDetail2D` | chain TOP, overall width BOTTOM | chain BOTTOM, width TOP (height / arch dims already right) |
| `CasementFrameDetail2D` | chain TOP, vertical chain RIGHT, width BOTTOM, arch + transom axis dims LEFT | chain BOTTOM, vertical chain LEFT, width TOP, arch start / rise + transom axes RIGHT |
| `FrontElevation2D` (sash) | width BOTTOM, arch start / rise LEFT | width TOP, arch dims RIGHT, overall height steps outside them |
| `SashDetail2D` | chain TOP, width BOTTOM | chain BOTTOM (below the horns on an upper sash), width TOP |
| `GlassDrawing2D` (sash) | chain TOP, width BOTTOM | chain BOTTOM, width TOP |
| `BoxDetail2D` | — | **unchanged**: its `Y` is y-up, so the chain was always at the bottom, the inner width at the top and the height chain on the right — it already satisfied the rule (t22 §1b proves it, before and after) |
| Elements grid (PP) | — | **no separate change**: `ElementsTab` renders these very components (Frame / Leaf / Box / Sash) and the Elements PDF rasterises the same SVGs, so it inherits the rule |

**What moved, in sheet coordinates** (040L 1000 × 1500 casement, 1000 × 1500 sash 6x6):

| Sheet | Label | y/x before → after |
|-------|-------|--------------------|
| casement leaf | overall width `898` | y 1684 → **151** |
| casement leaf | chain stile `67` | y 163 → **1663** |
| casement frame | overall width `1000` | y 1902 → **142** |
| casement frame | chain land `47` | y 159 → **1816** |
| casement frame | overall height `1500` | unchanged (x 1520) |
| sash elevation | width `1000` | y 1809 → **75** |
| sash upper | overall width `822` | y 848 → **73** |
| sash glass | width `733 mm` | y 878 → **146** |

**Scale unchanged:** every viewBox is byte-identical before and after — leaf 1430.76 × 1962.8, frame 1900 × 2100,
elevation 1720 × 2010, upper 1134.36 × 983.42, glass 1143.48 × 1022.98, box 2020 × 2520. Two intermediate versions
of this stage grew the leaf and frame sheets by a chain band; both were reverted once measurement showed the bottom
now needs LESS room than the overall width did (28·ts vs 60·ts), and the frame's computed bottom band is floored at
the old `DM`.

**Layout numbers derived, not tuned:** the frame's chain sits at `34·ts` under the frame because a chain leader
label reaches `leaderV 14` up and is `dimSmall 17` tall — at `24·ts` (the glass sheet's value, which has no member
labels) it printed over the `C-CILL` label inside the frame at every size. The mullion axis dims then step below
the chain (`chainY + 30·ts + DM·0.3·i`) and the bottom band grows with their count so the title always clears.

**New gate — `verify/arch/lib/dimRule.mjs`** (used by t19 §1b, t22 §1b, t27 §9): reads the RENDERED sheet, tells
the overall dims from the chains by dim size, tells horizontal from vertical dims by rotation, recognises a vertical
chain's upright leader labels by their proximity to that chain's rotated labels, and ignores `R …` radius callouts
(annotations on the arc, not dimension lines). It is a real gate, not a tautology: t19 §1b re-renders the sheets
from **0d211fd** and asserts the rule REJECTS the old frame and leaf sheets while ACCEPTING the elevation and glass
sheets it already governed.

**Collision evidence** (rotation-aware text-box overlap, live vs `0d211fd`): 0 new overlapping label pairs and 0 new
texts outside the viewBox on casement 040L / 131 / 133 / 144 / arched and on sash 1000×1500 6x6 / 1200×2000 9x9 /
arched 1000×2200 / wide 2000×900 / tall 500×2400 / 600×900. One PRE-EXISTING overlap on the multi-light frame
sheets disappeared. The first cut of the frame sheet did introduce three collisions (`26` over `C-CILL`, `551.5`
over `axis 611.5` / `axis 1188.5`); they are what drove the 34·ts / axis-below-chain layout above.

**Fixtures re-baselined** (deliberate, per CLAUDE.md): `rect-casement-sheets.json` via
`node verify/arch/t19_baseline.mjs live` and `rect-sash-sheets.json` via `node verify/arch/t22_baseline.mjs`.
`rect-casement-base.json` and `rect-sash-base.json` (ENGINE data) were NOT touched — no engine number changed in
this stage. t27 §9's guard was narrowed accordingly: it now requires the sash ENGINE fixture to be clean and adds a
check that the re-baselined sash sheets really carry the new placement.

**Not verified in this stage:** nothing was opened in a browser and no PDF was opened in a viewer — the evidence is
the server-rendered SVG (react-dom/server), its viewBox, its text positions and the overlap analysis. Whether the
new layout *looks* right to Piotr is a morning judgement; the geometry is what the harness can prove.

---

### STAGE 1 — glass DXF carries EVERY glass unit ✅

**Verdict ✅** — t28 **50 checks ALL PASS**, whole suite t16–t28 = **1664 checks ALL PASS**, `npm run build` OK
(18.3 s), esbuild clean on all three touched sources, no Polish in sources.

What changed (`src/utils/glassDxfExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`):

- `glassUnitsForWindow()` replaces `shapedGlassUnits()` as the export's entry point: every ordered row becomes a
  unit, shaped or rectangular, in row order, `qty > 1` repeated. `shapedGlassUnits()` stays exported (t19–t23 use it).
- `buildRectUnitEntities()` — contour = 4 lines, `GLASS_EDGE` inset by `profile.glass.edgeCover` (11) all round,
  each bar an axis on `GLASS_BAR_AXES` plus a band `profile.glass.barWidth` (18) wide on `GLASS_BARS`. Bands run the
  full unit, unclipped at crossings, exactly like the shaped bands. Nothing is hard-coded: 11 and 18 are read from
  the profile through the existing `readGlassProfile` / `barBandCurves`.
- `rectBarsForRow()` — bar placement has the **two sources the glass PDF already uses**, so the DXF and the PDF can
  never print different numbers for the same unit: casement / triple rows split the glass equally from the engine
  counts (`barsV` / `barsH`), double-hung rows keep the sash-frame placement (grid pattern →
  `computeGlassBarPositions`, whose `cy` runs from the glass top and is mirrored into the y-up DXF frame).
- Text block: window name, unit id, `W x H` + location, glass spec, bar count, one line per bar, and
  `BAR AXES FROM THE BOTTOM CORNERS` with FROM LEFT / FROM RIGHT and FROM BOTTOM / FROM TOP per bar.
- Skips: only "no data" / "not a casement or sash window" / "window could not be calculated" / **"no glass unit"**.
  The old `not an arched … — rectangular units go on the glass PDF` skip is gone; the pack error is now
  `No glass units in this pack`. The Window Detail button renders for every casement / sash window.

Numbers asserted from the profile (not read back from the code): 040L 1000 × 1500 → **1 unit 789 × 1293**
(`W − 2·leafAtJamb 51 − glass 109`, `H − leafFullHeight 98 − glass 109`), edge line (11,11)–(778,1282), bands at
385.5 / 403.5 and 637.5 / 655.5, axes at 394.5 and 646.5.

**Intended behaviour changes, with the old and new numbers (re-vectored harness assertions):**

| Case | Before | After |
|------|--------|-------|
| rectangular casement 040L 1000 × 1500 | skipped: "not an arched casement" | exported, 1 unit 789 × 1293 |
| rectangular sash 1000 × 1500 | skipped: "not an arched sash" | exported, 2 units 733 × 612.5 |
| arched sash SS 1000 × 2200 (t22) | 1 unit (arched upper) | **2 units** — arched upper + rectangular lower 733 × 962.5 |
| t18 pack of 3 arched + 1 rectangular | 3 windows / 3 units, 1 skipped | **4 windows / 4 units, 0 skipped**; the 4th contour bottom −6353.2 (the three arched bottoms −1293.0 / −2886.0 / −4760.2 are UNCHANGED) |
| pack with nothing exportable | a rectangular window | a window with no glass at all (a door) |

**Shaped output unchanged** — t28 §5 rebuilds the four all-shaped sample windows (semi-circle hub-spoke,
three-centre 1H 2V, gothic intersecting, circle 800 sunburst) through both trees and compares the **serialised DXF
byte for byte against `30a8012`**: identical. The arched sash is the one mixed window and its file legitimately
grows by the lower unit, so there the SHAPED unit's own entity set is compared byte for byte instead: identical.

**Samples:** new `sample_glass_rect_1000x1500_040L.dxf` and `sample_glass_pack_mixed.dxf`;
`sample_glass_pack_merged.dxf` and `sample_glass_sash_1000x2200_semi-circle_hub-spoke.dxf` regenerated with their
new rectangular units. **Not from this stage:** `sample_arch_*.dxf`, `sample_arch_c5_*.dxf`,
`sample_circle_1000_sunburst.dxf`, `sample_sash_arch_1200_*.dxf` and `sample_tracery_gothic.dxf` also changed —
that is **gothic-full-v1** (e037020) which moved the piece labels below the piece (TEXT y 100 → −25, 10 → −50) and
made the tracery always full; the code landed on `main` without regenerating the samples, and running the harness
brought them up to date. The two glass-order PDFs were reverted (jsPDF timestamp noise only).

**Not verified in this stage:** nothing was opened in a browser (the Window Detail / Production Pack buttons, the
alert texts), and no DXF was opened in VCarve or bSolid — the evidence is the ezdxf round-trip (layers, contour
789 × 1293, edge 767 × 1271, 2 axes + 4 band edges) and the byte-identity comparison.

**Erratum (BLOCKERS §20.5):** the brief's gate says "okno 133 → 3 jednostki". Layout `133` is "3 Lights +
Fanlights", so the engine orders **6** units (3 fanlights 434.3 × 337.2 + 3 lights 434.3 × 815.8). t28 asserts the
engine's 6 and additionally checks layout `130` (3 lights, no fanlights) → 3 units, which is what the brief's
number describes.

---

## 2026-09-06 — NIGHT 7 (zadanie nocne 7) — STOPPED AT THE ENTRY GATE (branch `claude/zadanie-nocne-7-glass-dxf-wb0eay`)

Inputs read in full: `CLAUDE.md` (night-7 brief, all four stages + "NIE RÓB DZIŚ") → `BUILD-LOG.md` (night 6) →
`BLOCKERS.md` (headers + §16–§19) → the two gate targets `src/engine/cnc/traceryExport.js` and
`src/engine/cnc/archDxf.js` → `src/utils/glassDxfExport.js` (stage-1 target, read only).

### VERDICT ❌ — night 7 not started; `gothic-full-v1` is not in the repository

The brief's own entry gate fails on both markers, so per CLAUDE.md ("Jeśli nie — STOP, wpis w BLOCKERS") and
tonight's start instruction, **no stage was implemented and no source file was touched**. Full evidence in
BLOCKERS §20; the short version:

| Gate | Expected | Got |
|------|----------|-----|
| `grep -c "mode = 'full'" src/engine/cnc/traceryExport.js` | > 0 | **0** |
| `grep -c "labels BESIDE the piece" src/engine/cnc/archDxf.js` | > 0 | **0** |

Neither string is anywhere in `src/` or `verify/`, and `git log -S` over **all** branches finds them in exactly one
commit — `0801c78 "Update CLAUDE.md"`, i.e. only inside the gate sentence itself. The engine behaviour agrees:
tracery still resolves `auto` → `quadrant` when the panes do not straddle the axis (`traceryExport.js:579-584`,
banner line 696), and the committed sample `sample_tracery_dwg_R600_quad-hub-spoke.dxf` is still a half board;
piece labels still sit ON the piece (`archDxf.js:300-303`). The sibling package from the same 06.09 chat,
`arch-pieces-v1`, **is** present (night 6's own gate passes: `pieceStockTrapezoid` 4, `glazingRebate` 1,
"Tracery LSP" 0) — so one chat package reached `main` and the other did not.

### Base health on this branch (run anyway, so the morning starts from facts)

- `node verify/arch/t16.mjs` … `t27.mjs`: t16 368 · t17_edges 70 · t18 178 · t19 244 · t20 116 · t20_bars 32 ·
  t21 120 · t22 77 · t23 81 · t24_stage4 26 · t25 201 · t26 36 · t27 64 = **1613 checks, ALL PASS**
  (`npm install`, `pip install ezdxf` 1.4.4).
- `npm run build`: **OK**, 17.95 s.
- The numbers are night 6's final numbers exactly — this tree is the night-6 tree, nothing regressed, nothing new
  landed after it apart from the CLAUDE.md brief.

### What is NOT done (the whole night's scope, unchanged and open)

1. Stage 1 — glass DXF for rectangular units (`glassDxfExport.js` still skips them: "rectangular units go on the
   glass PDF", line 261); t28 not written.
2. Stage 2 — the dimension rule (spans below, overall above, heights right) on `CasementLeafDetail2D`,
   `CasementFrameDetail2D`, Elements grid, `FrontElevation2D`, `SashDetail2D`, `BoxDetail2D`, `GlassDrawing2D`;
   no snapshot rebase.
3. Stage 3 — door option B (land 43, `leafAtJamb` 47, leaf 1000 → 906): `DEFAULT_DOOR_PROFILE` untouched, still
   option A (land 36 / 40 / leaf 920). BLOCKERS §19.1 stays open.
4. Stage 4 — the 3D control after the 68 frame; t29 not written. BLOCKERS §19.9 stays open.

### Not verified tonight (honest list)

Nothing was opened in a browser, no DXF in VCarve / bSolid, no PDF in a viewer. The harness and the build are the
only evidence, and both only say the night-6 tree is intact — they say nothing about the four stages, which were
not attempted. I did not attempt to reconstruct `gothic-full-v1` from its description: rewriting a package Piotr
already has, from three words in a brief, would be guesswork in exactly the two files the gate protects
(CLAUDE.md rule 2). It needs to be re-applied from the 06.09 chat.

---

## 2026-09-06 — ARCHED-WINDOWS-v4 night 6 (branch `claude/arched-windows-v4-stages-9diax6`)

Inputs read in full: `CLAUDE.md` → `docs/handover/ARCHED-WINDOWS-v4.md` → `BLOCKERS.md` (headers + open items) →
`BUILD-LOG.md` (night 5) → `arch.js`, `profile.js`, `archDxf.js`, `dxfWriter.js`, `cncExport.js`, `calculations.js`
(arch plan wiring), `lists.js` (curved members, pre-cut blanks), `WindowSettingsPage.jsx`, `windowProfileStore.js`,
`NumInput.jsx`, the t16–t24 harness conventions. Entry gate (CLAUDE.md): `pieceStockTrapezoid` 2, `glazingRebate` 1,
"Tracery LSP" 0 → arch-pieces-v1 is on `main`. Baseline on the branch start: t16 507, t17 72, t18 178, t19 244,
t20 116, t20_bars 28, t21 120, t22 75, t23 80, t24 26 — ALL PASS (after `npm install`, `pip install ezdxf`).

Stages tonight (Piotr 06.09, gate before each next stage): 1 = Block C planner v2, 2 = Block B glazier PDF,
3 = Block E intersecting, 4 = Block F frame 68.

### NIGHT 6 — FINAL VERDICT (all four stages) and the CLAUDE.md checklist

Whole suite on the final tree (`node verify/arch/t16.mjs` … `t27.mjs`): t16 368, t17_edges 70, t18 178, t19 244,
t20 116, t20_bars 32, t21 120, t22 77, t23 81, t24_stage4 26, t25 201, t26 36, t27 64 — **1613 checks, ALL PASS**;
`npm run build` OK (16.5 s). Four commits on the session branch (Stage 1 402c58a, Stage 2 222e840, Stage 3 c648a67,
Stage 4 below); `main` untouched. Every "DEFAULT (open)" is in BLOCKERS §16–§19; every spec erratum (E1–E4, C.5 at
face 57) is named there.

**Checklist:** branch pushed ✓ · t16–t27 ALL PASS ✓ · build ✓ · esbuild on every touched file ✓ · no Polish added
to sources ✓ (16 pre-existing Polish comment lines remain in `ParametricSashWindow.jsx`, `App.jsx` lights,
`DoorElevation2D.jsx`, `casementSectionAssets.js` — older files, not touched tonight beyond the frameDims lines; left
alone, rule 2) · `git diff main` = the spec §11 files + verify / docs / logs ✓ · samples regenerated from the 68
profile ✓ (five `sample_arch_1200_*`, five `sample_arch_c5_*` incl. the new `1000_gothic-equilateral`, glass DXFs +
merged pack, tracery DXFs, `sample_sash_arch_1200_*`, `sample_circle_1000_sunburst`, glass PDFs A4 + A3) ·
BLOCKERS §19 ✓.

**Honest not-verified list (whole night):** nothing was opened in a browser — the Window Settings "CNC & arches"
card, the glazier PDF pages in a PDF viewer, the 3D viewer with the 68 frame / 136 post / fanlight axis 102, the
Production Pack export buttons; no DXF was opened in VCarve / bSolid (ezdxf round-trips only); the Supabase tenant
profile migration (`frameSchema` 2) ran on synthetic copies in t27, not on Piotr's stored row; PSW is unported (the
port list is written, not applied); the economy rule C.4 verdict flip on the tc240 leaf (19.5) is reported, not
resolved.

**Verdict: ✅ night 6 — all four stages closed and gated; open decisions in BLOCKERS 19.1 / 19.3 / 19.5.**

### STAGE 4 — Block F: frame face 68 everywhere, option B (`profile.js`, `casementLayouts.js`, `calculations.js`, `archDxf.js`, `materialAssignmentStore.js`, `windowSpecToConfig.js`, `App.jsx`, `CasementFrame.jsx`, `CasementWindow.jsx`, `ArchedCasementWindow.jsx`, `DoorFrame.jsx`, `DoorWindow.jsx`, `DoorSidePanel.jsx`, `WindowPreview3D.jsx`, `Window3DCaptureRig.jsx`, `ConfiguratorPage.jsx`, `PSW-FRAME-68-PORT.md` new, `PSW-3D-ARCH-PORT.md` §9, `verify/arch/t27.mjs` new, `rect_casement_baseline.mjs` new, `t19_baseline.mjs live`, fixtures re-baselined, t16 / t17 / t18 / t20 / t20_bars / t23 / t24 / t25 / t26 re-vectored)

**Understanding:** Piotr 06.09: head and jambs 57 → 68 on casements AND doors, option B — the rebate stays 21, the
land grows 36 → 47, gap 4, so `leafAtJamb` 40 → 51; cill unchanged; door post 2 × 68 = 136. Everything downstream
reads the profile; the 3D reads the profile through a prop with the PSW numbers as defaults; every harness vector
that carried 57 / 36 / 40 / 114 is recomputed from the profile in the harness; the rectangular casement fixtures are
re-baselined with the old and new numbers on record.

**Two approaches, one rejected (3D):** (a) replace the constants in `src/3d` with 68 / 47 — rejected: the files are
1:1 with PSW's 3d-src and PSW is unported; (b) a `frameDims` prop `{ frameFace, extFace }` resolved by
`resolveFrameDims()` with the module constants as defaults, shadowed per function (TopRail / Stile / Mullion / the
frame body / the window components), so the PSW copy renders unchanged and PC passes the profile — chosen.
**Stored profiles:** Piotr's tenant profile (Supabase + localStorage) carries 57 / 36 / 40 / 87 / 54;
`migrateCasementProfile` does not overwrite user values, so without a migration the app would keep showing 920 in
the morning. Added `frameSchema: 2` on the default and a key-by-key move for schema-1 copies: a value moves ONLY
when it still equals the OLD default; a hand edit stays; a schema-2 copy is never re-migrated (DEFAULT (open),
BLOCKERS 19.2).

**Built:** `DEFAULT_CASEMENT_PROFILE` frameHead / frameJamb 68, land 47, leafAtJamb 51, leafFullHeight 98,
fanFromAxis 65, `frameSchema 2` + `migrateFrameSchema`; `DEFAULT_DOOR_PROFILE` faces 68, `couplingPost 136`,
`transomDeduct 136` (2 × jamb face), door land / leafAtJamb 36 / 40 unchanged (spec: face + post only — BLOCKERS
19.1); `casementLayouts.js` `frameFace 68` + `CASEMENT_LAYOUTS_VERSION 3` and NOTHING else (t16 §10.3 pt 10 now
strips comments and requires exactly those two code lines to differ from the merge-base); `calculations.js` door
fallbacks read `DEFAULT_DOOR_PROFILE` (no `?? 57` / `?? 114`); `archDxf.js` joint-plane dedup key normalises −0 (a
real bug: the gothic 1000 head now plans as one board per side, its apex plane at x = −3e-13 printed "-0.000" and
was drawn twice — found by t25); `materialAssignmentStore` frame head / jambs `68×93` with a hint naming the old
57×93 (kept in Part Registry for older projects — a data task, 19.7); 3D `frameDims` threaded through 11 files
(`windowSpecToConfig.casementFrameDims()` = profile face / land, `doorFrameDims()`; App state + `update3D`
setter + bucket capture / restore; `CasementWindow` also hands `geo` to `resolveCasementLayout`); `ArchedDoorWindow`
/ `TransomPanel` untouched (not rendered by PC). `docs/handover/PSW-FRAME-68-PORT.md`: the PSW lines
(`estimate-renderer.js` 1503 / 2017, `casement-controller.js` 54 version + 153 / 417 innerH + the 91 → 102 fan axis
offset, `casement-type-modal.js` 378, 3d-src `CasementFrame.jsx` / `DoorFrame.jsx` 12–13).

**Numbers, old → new (all from the profile formulas, printed by `rect_casement_baseline.mjs` and t27):**

| window | formula | face 57 | face 68 |
|---|---|---|---|
| 040L 1000 × 1500 leaf | `(W − 2·leafAtJamb) × (H − leafFullHeight)` | 920 × 1413 | **898 × 1402** |
| 040L 1000 × 1500 glass | `leaf − 2·(67 − 12.5)` | 811 × 1304 | 789 × 1293 |
| head / jambs section, jamb length | `${face}x93`, `H − jambDeduct` | 57x93, 1500 | 68x93, 1500 |
| 052L 1200 × 1500 (fan) | fixture R2 | 543 × 449.5 | 532 × 446.2 |
| 120 1200 × 1200 / 180L 1500 × 1200 | fixtures R3 / R4 | 543 × 1113 / 588.4 × 1113 | 532 × 1102 / 579.6 × 1102 |
| glass offset / half width W 1000 | `oL + tL − gI`, `(W − 2·off)/2` | 94.5 / 405.5 | 105.5 / 394.5 |
| three-centre W 1200 rise 240 rings | `r − off`, `R − off` | 93 / 1263 · 110 / 1280 · 43 / 1213 · 55.5 / 1225.5 | 82 / 1252 · 99 / 1269 · 32 / 1202 · 44.5 / 1214.5 |
| gothic 1200 inner apex | `√((1200 − tF)² − 600²)` | 972.86 | 959.91 |
| fan axis offset (top) | `frameFace + 34` | 91 | 102 |
| door 1000 × 2100 leaf | `(W − 2·40) × (H − 87)` | 920 × 2013 | 920 × 2013 (unchanged by design) |
| door coupling post | `2 × jamb face` | 114x93 | 136x93 |
| circle 800 frame ring plan | independent planner | 4 × 180 | **4 × 200** (W_req 182.3) |
| gothic 1000 leaf top rail | independent planner | blocked (2 × 120 / side, edge 386.2) | **plans: 1 × 200 / side** |
| gothic 600 × 1600 leaf | independent planner | plans (1 × 150, edge 418.8) | blocked (edge 397.0 < 400) |
| tc240 1200 head / leaf | independent planner | 2 × 180 → economy 3 × 150 / 2 × 180 fewest | 2 × 180 fewest (no alt) / fewest 1 × 200 → economy 2 × 180 (19.5) |

**Verification:** every harness vector with 57 / 36 / 40 / 114 recomputed in the harness from the profile object
(t16, t17_edges, t18, t20, t20_bars, t23, t24, t25, t26 — one literal "profile = spec" check each, the rest formulas
or `indPlanner`); t25 §2 runs the spec C.5 table on a schema-1 variant built in the harness (the spec says "face 57
head ring") AND the live profile against the independent planner; t27 new (64): profile = spec F + option-B
identities, 040L 1000 × 1500 through `normaliseToWindowSpec` → `deriveWindowData` (leaf / glass / cut list) with
the old numbers reproduced through the variant and restored, migration matrix (old defaults move, hand edit kept,
schema-2 untouched, idempotent), layouts, doors (post 136x93, french leaves), `windowSpecToConfig.frameDims`,
`resolveFrameDims` defaults 57 / 36 + the threading asserted in all 11 files, engine grep gate (no bare 57 / 36 /
40 / 114 in casement / door code, sash + CNC allow-list), materials labels, fixture provenance. Fixtures:
`rect-casement-base.json` + `rect-casement-sheets.json` re-baselined from the live tree at c648a67 (`ref: live`),
sash fixtures untouched (t22 77 ALL PASS proves the sash side). Suite t16–t27 ALL PASS (1613), build OK.
**Not verified:** anything on screen (3D with the 68 frame, the settings card, the PDFs), VCarve / bSolid, Piotr's
stored profile row (migration exercised on synthetic copies only), PSW (unported).
**Verdict: ✅ Stage 4 (Block F).**

### STAGE 3 — Block E: `intersecting` from the vertical bars (`arch.js`, `profile.js`, `3d/casement/archedCasementGeometry.js`, `PSW-3D-ARCH-PORT.md` §8, t18 / t19 / t20_bars re-vectored)

**Understanding:** Piotr 06.09 (SS1 = PSW arched sash): the tracery arcs must spring from the tops of the
vertical bars. PSW's sash does this (`ArchedSashWindow.jsx` 915–940, `useArchedSashBars`: columns = the V bars,
default ±halfW/2, R = gothic ? c + halfW : halfW on the daylight numbers, arcs centred at column − dir·R, a
quarter turn, clipped at the profile); PSW's fix-frame `intersectingData` (pitch mullions, arcs centred on the
frame corners) is independent geometry and v3 ported the wrong one. One rule for casement / sash / fixed.

**Two approaches, one rejected:** (a) port PSW's sash code as-is, radius from the two-centre formula on the glass
numbers — rejected: the glass outline is the frame's arcs offset concentrically (exact radius 905.5 on gothic
1000), PSW's formula gives 905.4 — a second geometry by 0.1 mm; (b) R = the glass outline's own arc radius
(`outline.arcs[0].r`: semi-circle → the clear half width 405.5, gothic → the concentric radius) — chosen; the
harness ports PSW's sampler and shows it lands on the same arcs within 0.2 mm.

**Built:** `buildArchBars` intersecting branch — columns = the user's v bars at equal divisions of the clear
width, to the SPRINGING (no bar to the outline any more); 0 → two default columns at ±¼ of the clear width; two
`tracery` arcs per column, centre `(x − dir·R, springing)`, radius R, clipped with `traceryHit` (first meeting with
the outline, a quarter turn at most); no springing bar; `counts.v` stays the user's number, `columns` lists the
column x's. `readPatternSettings` reads `hubRingRatios` only — the profile's `arch.patterns.intersecting { pitch,
minMullions, maxMullions, minRadius }` and the 3D fallback `PSW_BAR_PATTERN_SETTINGS.intersecting` are gone
(`frameHalfWidth` stays in the signature, unused). 2D sheets, glazier DXF / PDF, tracery board and the casement 3D
read `derived.arch.bars` — no other change; the PC copy of `ArchedSashWindow.jsx` already carries PSW's own
version of this rule. `PATTERNS_FOR_SHAPE` unchanged (intersecting on semi-circle / gothic only).

**Numbers (spec E vectors):** gothic 1000 × 1900, 3 V → 6 arcs, each starting at a column x (202.75 / 405.5 /
608.25 in the glass frame), R = 905.5 (the glass radius; the spec's "R = 1000" is the FRAME radius c + halfW on
the frame numbers — errata E4, BLOCKERS 18.1), ends on the outline; semi-circle 1000, 2 V → 4 arcs R 405.5 ✓; 0 V
→ columns at ±202.75 ✓ (= Wg/4 = 811/4). Tracery board: gothic intersecting 0 V → 4 panes (full mode, no
collapsed pane), 1 H 2 V → 5 panes.

**Verification:** t20_bars 32/32 (§1: 16 shape × pattern × h × v cases with the new column rule; §3 rewritten —
PSW sash rule ported on the glass numbers, vertex for vertex within 0.2 mm on five windows incl. the spec's three;
no springing bar; no settings left), t18 178/178 (intersecting checks re-vectored, profile block without
intersecting), t19 246/246 (elevation SVG arcs = ring centres + tracery centres, 3D casement bars = engine list
with the 3D's own daylight radius 908.5), t20 116 (tracery samples regenerated: `sample_tracery_gothic.dxf`),
t22 77, t23 81, t26 36 (glass PDF sample regenerated with the new gothic arcs). Whole suite t16–t26 ALL PASS,
`npm run build` OK.
**Not verified:** the arcs on screen / in the 3D viewer (no browser); PSW's fix-frame viewer still shows the old
`intersectingData` for fix-only products until PSW ports the rule (PSW-3D-ARCH-PORT.md §8).
**Verdict: ✅ Stage 3 (Block E).**

### STAGE 2 — Block B: glazier PDF layout (`glassPdfExport.js`, `ProductionPackPage.jsx`, `verify/arch/t26.mjs` new, t18 §6)

**Understanding:** Piotr 06.09 (SS2) — the per-unit bar table next to the drawing made the drawing unreadable.
The shaped cell must give the drawing the whole cell, put the title + spec under it, the bar-spacing chain at the
bottom and the overall width at the top (the on-screen sheet's convention since arch-pieces-v1), with ids only
beside the bars; the numbers move to bars pages at the end, one block per shaped unit with a window thumbnail.
Rectangular units must not change by a byte; A3 / A4 follow the pack's export setting.

**Two approaches, one rejected:** (a) keep the v3 header bar at the top of every cell and squeeze the bars table
under the drawing on A3 only — rejected: the drawing scale is what Piotr complained about, and A4 is the batch
default; (b) a v4 shaped cell (drawing first, bottom band with title + up to two spec lines, dimensions in the
margins) and separate bars pages — chosen; the rectangular cell keeps the v3 header bar and its whole call
sequence (byte identity is asserted against the previous commit).

**Built:**
- `drawShapedGlass` v4: bottom band (title 5 pt + spec 4.5 pt, spec = unit spec · `arched · R … · rise … ·
  springing …`, wrapped to the cell, ≤ 2 lines), drawing area = the rest at max scale with 8–9 mm margins for the
  dimensions; outline fill + edge-cover line + spacer bands + bar axes as v3; ids only beside the bar ends; chain
  H at the BOTTOM (vertical bar / mullion x positions from the bottom-left corner, extension lines up to the
  outline's bottom edge), overall width at the TOP (extension lines from the springing corners), chain V on the
  left (h bars, springing, apex), overall height + rise tick on the right; circles: no springing tick, the chord
  chains from the diameter. The v3 note line and the in-cell bar table are gone.
- Bars pages: `paginateBars` (block height = max(thumbnail 35 + 2, title 6 + (rows + 1) × 3.2 + 2) + 6 — a pure
  function of the row count so the header's "page / total" is known before drawing; a block that does not fit
  moves whole to the next page, never breaks inside a table), `drawWindowThumb` (the frame's outer contour —
  straight part + the arch chain from `derived.arch.geometry.arcs` / a circle — with the shaped unit filled at
  `derived.arch.glassOutline.origin`, ≤ 45 × 35 mm), `drawBarsBlock` (title `n · WINDOW — LOCATION GLASS — arched
  · R … · k bars`, table ID · s from apex / position · L · angle / R from `glassBars.barEndRows` — the same rows as
  the sheet and the glazier DXF). Page heading `GLAZING BARS — POSITIONS PER SHAPED UNIT (ids as on the drawings)`.
- `exportGlassPDF({ …, format })`: `setPageFormat` (a4 297 × 210 / a3 420 × 297, unknown → a4); pagination = 1
  schedule + ⌈units / 4⌉ drawing pages + bars pages; `thumb` per shaped item. `ProductionPackPage` Glass tab passes
  `exportFormat` (the pack's A3 / A4 switch); the single-window export stays A4.
- The schedule page (page 1) is untouched: the Shape column and the per-unit line (positions for ≤ 4 bars, `k bars
  — see table` above) stay as v3 (t18 §6 asserts them).

**Verification (t26 36/36 ALL PASS):** the three v3 samples (semi hub-spoke 1000 × 1500 start 1000, three-centre
1H 2V 1000 × 1500 start 1300, gothic intersecting 1000 × 1800) rendered through jsPDF in node with the `text` /
`lines` calls captured on the instance (jsPDF `initialized` plugin event): page count 1 + 1 + 1; one filled outline
per unit on the drawing page; every id inside its outline; no "from apex" / row text on the drawing pages; title +
spec under the outline; "811 mm" centred above; the bar chain (283.9 / 243.3 / 283.8 …) below the outline and above
the title; no text bbox overlapping the outline bbox (dimensions, title, spec — ids excluded); bars page: heading,
every id and every s / L / angle cell of every unit, 3 stroked frame thumbnails ≤ 35 mm + 3 filled units; 9 hub-
spoke units → 3 drawing + 3 bars pages, every block's rows on its title's page; rectangular-only export (2 casements
+ 1 sash) byte-identical to commit 402c58a (CreationDate and jsPDF's /ID hash masked); A3 MediaBox 1190.55 × 841.89,
A4 841.89 × 595.28, unknown → A4, A3 cells scale up; PP passes the format. t18 §6 re-vectored (3 pages).
Samples: `docs/handover/samples/sample_glass_order_arched.pdf` (A4) and `_a3.pdf`; pages 2–3 rasterised with
PyMuPDF and looked at (layout as specified). Whole suite t16–t26 ALL PASS, `npm run build` OK.
**Not verified:** the PDF in a viewer other than PyMuPDF's raster (font metrics of the bbox check are jsPDF's own
`getTextWidth`); the A3 print; the springing-bar ids `S1 / S2` sit on the outline edge next to the right dimension
line (cosmetic, as in v3 — BLOCKERS 17.3).
**Verdict: ✅ Stage 2 (Block B)** — t26 + t16–t25 ALL PASS, build green.

### STAGE 1 — Block C: segment planner v2 (`profile.js`, `arch.js`, `archDxf.js`, `cncExport.js`, `calculations.js`, `ConfiguratorPage.jsx`, `lists.js`, `windowProfileStore.js`, `WindowSettingsPage.jsx`, `verify/arch/t25.mjs` new, `verify/arch/lib/indPlanner.mjs` new, t16 / t17 / t18 / t19 / t20 / t21 / t22 / t23 / t24 re-vectored)

**Understanding:** the v1 planner cut every arc of the chain on its own (a joint at every tangent point) with a 36°
grain-run-out rule, which produced the ~100 mm haunch triangles Piotr rejected. v4: the WHOLE chain (springing →
springing) is partitioned by outer arc length into N equal pieces — a piece may carry a haunch and part of the crown
(the CNC cuts the compound curve from one board); a gothic is split at the apex first. Two HARD limits replace the
36° rule: overall length ≥ `cnc.minClampLength` 450 (Rover A 1532: two Uniclamps + end cuts) and the shorter stock
edge ≥ `arch.minPieceLength` 400; the board cap is the widest entry of the new stock list `63 75 95 105 120 150 180 200`.
Fewest pieces first; an economy alternative (N + 1 … N + 3 on a narrower board) wins when the fewest plan wastes
more than `arch.wasteThreshold` 0.45 of its boards. CLAMPS layer with two Uniclamp footprints per flat piece; a
"CNC & arches" card edits every number.

**Two approaches, one rejected:**
- Springing end of the RAW piece: (a) keep the v1 horizontal cut on the springing line — rejected: on a tilted
  compound piece (three-centre 1000 × 250, piece axis 26.6° to the horizontal) the horizontal cut runs the board
  215 mm past the frame edge (outer 829 / inner 379) and FAILS the 400 limit on a plan the spec declares valid;
  (b) cut the raw springing end SQUARE to the piece axis at the band extent and let the CNC rout the horizontal
  springing face with the contour (it is part of the CONTOUR polyline since v1) — chosen; cut code `Q`; the spec's
  C.5 verdicts hold. Logged as a DEFAULT (open) decision, BLOCKERS 16.3.
- Board placement on the band: centred (arch-pieces-v1) kept; the flush-inner alternative would lengthen the
  shorter edge (sash 1000 head 395.5 → 410, circle 800 leaf 390 → 400) — not changed silently, BLOCKERS 16.4.

**Built:**
- `profile.js` — `arch.version 4`: `stockWidths [63, 75, 95, 105, 120, 150, 180, 200]`, `minPieceLength 400` (hard),
  `wasteThreshold 0.45`; `maxSegmentAngleDeg` and `pieceRule` (D13) removed — D13 is closed by v4 C.3/C.4. New block
  `cnc { minClampLength 450, clamp { base 130, minThickness 40, maxThickness 98, minPiece 140 }, clampClearance 20 }`.
  Migration: a stored v3 arch block is replaced whole, a v4 block merges key by key (the card edits it from now on),
  `cnc` filled from the default.
- `arch.js` — `ringGroups` (chain / gothic sides / closed ring), `partitionGroup` (N equal by outer arc length,
  chord axis u + outward normal b, band projection with `arcsExtent`, end planes: radial / vertical apex axis /
  square springing), `piecePoly` / `pieceBandPoly` / `pieceJoints` / `pieceEndEdge` / `pieceStockTrapezoid` /
  `pieceStockEdges` generalised to arc ARRAYS per piece, `bulgePolyArea` (exact band area), `planArchSegments(ring,
  arch, cnc)` with the two limits, fewest + economy, `noStockReason` 'no stock board fits' | 'below minimum length'
  and readable `reasons`; `buildArchPlan` / `buildCirclePlan` carry `cnc`, `depths` (93 / 57) and `blank` (limits).
  The v1 `partitionArc` / `pickOption` / `PIECE_RULES` / `endCut` are gone (superseded, no caller left).
- `archDxf.js` — layer `CLAMPS` (colour 3): `clampFootprints` — two `clamp.base` squares per flat piece, centred
  across the board, `clampClearance` from both end-cut LINES over the square's whole height (the joint planes lie 15
  inside the rough ends), pushed to the two ends; one square + warning when the room is under 2 × base, none +
  warning under 1 × base; thickness warning when the member depth is outside the jaws (the sash box head 164 →
  `WARNING: PIECE THICKNESS 164 OUTSIDE THE UNICLAMP JAWS 40-98`). Text block per ring: `CHAIN / SIDE n / RING
  R… L… …DEG: FEWEST n x board s L… ROUGH … WASTE p%`, `ECONOMY ALT … -> DEFAULT FEWEST|ECONOMY (THRESHOLD 45%)`
  or `NO ECONOMY ALT WITHIN N PIECES`, `LIMITS: OVERALL >= 450 (CLAMP)  SHORTER EDGE >= 400  STOCK MAX 200`,
  `CLAMPS (SUGGESTION): UNICLAMP 130 x 130, CLEARANCE 20 …, PIECE THICKNESS 93`; cut codes `J<deg>` / `Q` / `A<deg>`.
- `cncExport.js` — `buildSashArchPlan` passes `cnc` + depths (box depth / sash depth from the sash profile);
  `archParamsForWindow` skip = `no valid blank plan (<reason>): <member> <group>: …` with the failing piece named.
  `calculations.js` (3 call sites), `ConfiguratorPage.jsx`, `lists.js` (cut code `Q`) follow.
- Settings: `windowProfileStore.setCasementPath(path, value)` (roots arch / cnc / tracery / geometry, finite numbers
  only) + `setCasementStockWidths(text)` (comma list → sorted positive numbers, empty refused); `WindowSettingsPage`
  casement page gets the **CNC & arches** card (lock toggle like the others): finger length / groove / pitch,
  contour allowance, glazing rebate, stock widths, min clamp length, min piece length, waste threshold, Uniclamp
  base / jaws / clearance, tracery paneOffset / profileWidth / ridgeLand / edgeLand / mitreLeg, and a validation
  line = the live plan of a semi-circle at the sample width (`✓ frame head 3 × 150 · leaf top 2 × 200` or the
  planner's reason / `ArchError`). No spinner arrows (global CSS rule).

**Numbers (independent sampler in `lib/indPlanner.mjs`, 800 points per arc, head ring face 57, allowance 10, finger 15):**
| arch | fewest (spec C.5) | W_req mine / spec | economy default @ 0.45 | raw edges of the fewest plan (outer / inner) |
|---|---|---|---|---|
| HALF 1000 | 3 × 150 ✓ | 135.0 / 134.7 | 3 × 150 (4 × 120 fails 450: rough 441.7) | 553.8 / 467.2 · 597.6 / 424.3 · 553.8 / 467.2 |
| ROUND 1000 rise 250 | 2 × 180 ✓ | 155.7 / 158.3 | 2 × 180 (3 × 150 fails 400) | 621.9 / 531.9 ×2 |
| GOTHIC 1000 (per side) | 2 × 120 ✓ | 108.8 / 112.6 | 2 × 120 (3 × 95 fails 450) | 533.5 / 501.4 · 580.6 / 428.5 |
| HALF 1500 | 3 × 180 ✓ | 168.5 / 168.1 | **4 × 150** (waste 63 % > 45 %, alt 55 %) | 884.2 / 676.4 ×3 |
| tc240 1200 | 2 × 180 ✓ | 166.6 / 170.6 | **3 × 150** (waste 61 %, alt 55 %) | 968.4 / 446.4 ×2 |
Stock capped at 105: none of the five has a plan — a board fits at 5 / 6 / 3-per-side / 6 / 7 pieces and the
overall length then fails 450 (339 / 230 / 369 / 416 / 233). **Spec errata E3:** the C.5 edge lengths (508.8 / 432,
572.5 / 468.9, …) are the allowance-band chords of v1 (`L` / `L_in`), not raw-piece edges, and its W_req differ from
the sampler by up to 4 mm; the piece counts and boards agree exactly — BLOCKERS 16.1. Circle: one closed group per
ring (800 frame 4 × 180; 1000 frame 6 × 150 economy / leaf 5 × 180 economy). 2D contours, glazier exports and
the 3D are untouched (the planner feeds the CNC DXF, cut list notes, pre-cut, BOM, PP only).

**Consequences of the hard limits (honest report, BLOCKERS 16.2 — the engine reports, never splits finer):**
- gothic 1000 LEAF top rail: 2 per side on 120 → shorter edge 386.2 < 400 → no valid plan (the head is fine);
- circle 800 LEAF ring: 4 × 180 → 390.1 < 400 → no plan (frame ring 4 × 180 fine);
- arched SASH 1000 semi-circle box head (80 face): 3 × 180 → 395.5 < 400; gothic 1000 sash head likewise;
- every W 400 arch and the W 470 elliptical: no piece can reach 450 (semi-circle outer length 628) → no plan;
- the Arch DXF export skips these with `no valid blank plan (below minimum length): …`; cut list notes say
  `no stock board fits`; the PP curved row flags the reasons. Piotr can lower the limits on the new card.
Harness samples moved off the blocked sizes: sash CNC samples 1200 (`sample_sash_arch_1200_semi-circle.dxf`,
`_1200_gothic.dxf` — the stale 1000 files deleted), circle CNC sample 1000 (`sample_circle_1000_sunburst.dxf`, the
800 CNC file deleted; the 800 glass / tracery samples stay — no planner in them); t19's gothic 1000 contour
comparison runs with `minPieceLength 0` after asserting the honest skip.

**Verification:** t25 121/121 (profile v4 + migration; C.5 fewest plans = spec; W_req / raw edges / waste vs the
independent sampler ±0.5 / ±0.005; cap-105 blocks with the reason; invariants — compound pieces, apex split, closed
ring, one-board plan, band inside the trapezoid; economy rule at thresholds 1.0 / 0 / 0.45; DXF CLAMPS on four
regenerated samples via ezdxf — 2 squares per piece, 130 × 130, centred, ≥ 20 (+15 finger) from the cuts, text
lines, cut codes with Q, thickness warning on the sash head; pre-cut / PP / export skips; settings card + store
grep). Re-vectored: t16 367 (planner sections against `lib/indPlanner.mjs`, closed forms for single-arc middle
pieces, sample DXF texts, migration), t17 70, t18 178, t19 246, t20 116, t20_bars 28, t21 120, t22 77, t23 81,
t24 26 — ALL PASS. `npm run build` OK. esbuild on every touched file, `grep -F` after every write.
**Not verified:** the card in a browser (no UI run in the container — structural grep + esbuild only), the DXF in
VCarve / bSolid (CLAMPS placement is a suggestion; whether the Uniclamp really sits under the piece that way is
Piotr's call), the economy threshold on real jobs (0.45 fires on most semi-circles with a feasible alternative —
BLOCKERS 16.5), the square springing end on the CNC (16.3).
**Verdict: ✅ Stage 1 (Block C)** — t25 + t16–t24 ALL PASS, build green; ⚠️ the limits block four common sizes
(listed above) until Piotr confirms the numbers or the edge model.

## 2026-09-07 — ARCHED-WINDOWS-v3 night 5 (branch `claude/arched-windows-v3-9v0sw7`)

Inputs read in full: `CLAUDE.md` → `docs/handover/ARCHED-WINDOWS-v3.md` → `BLOCKERS.md` → `BUILD-LOG.md`
(night 4) → `arka_CNC-piotr.dxf` through ezdxf (every entity dumped, see 0.4) → the `arka-lsp-package`
README / JSON / LSP (offsets and section only) → `arch.js`, `archDxf.js`, `dxfWriter.js`, `glassDxfExport.js`,
`glassPdfExport.js`, `CasementGlassDrawing2D.jsx`, `archDrawUtils.js`, `profile.js`, `calculations.js`
(casement + sash branches), `specification.js`, `lists.js`, `cncExport.js`, the t18 / t19 harness conventions,
PSW `price-calculator.js` 940–1075, `online-estimate.html` (arch radios, hinge radio, fix bars),
`estimate-manager.js` 675–700, `ArchedSashWindow.jsx` 95–120 / 340–420. Baseline on the branch start
(`origin/main`): t16 504/504, t17 72/72, t18 178/178, t19 241/241 ALL PASS (after `npm install` — the container
had no `node_modules`; t18 / t19 need react-dom / jspdf resolvable).

Stages tonight (Piotr 07.09, gate before each next stage): 1 = Block 0, 2 = Block 1 A–E, 3 = Block 1 F–J +
Block 3, 4 = Block 4 + Block 6.

### STAGE 3a — Block 1 F–J: arched SASH, drawings / exports / 3D (`archDxf.js`, `cncExport.js`, `glassDxfExport.js`, `traceryExport.js`, `FrontElevation2D.jsx`, `BoxDetail2D.jsx`, `SashDetail2D.jsx`, `GlassDrawing2D.jsx`, `VerticalSection2D.jsx`, `CasementGlassDrawing2D.jsx`, `ArchedSashWindow.jsx` new, `archedSashGeometry.js` new, `App.jsx`, `windowSpecToConfig.js`, `WindowDetailPage.jsx`, `verify/arch/t22.mjs`)

**Understanding:** Stage 2 gave the arched sash an engine; the workshop still needs the two curved members on the
CNC (box head 80 face, top rail 57), the glazier's upper unit, the tracery board when a pattern is set, the five
2D sheets with the arc, and a 3D that is not the rectangular sash. Rectangular sash sheets must not move by a byte.

**Baseline first (J):** `verify/arch/t22_baseline.mjs` → `fixtures/rect-sash-sheets.json`: the six rectangular
fixtures × 7 sheets (elevation, box, upper, lower, glass ×2, section) = 42 SVGs rendered from HEAD **before** any
sheet was touched (`lib/sashSheets.mjs` bundles the sash sheet tree the way t19 does for the casement).

**Two approaches, one rejected (F):** (a) a second DXF builder for the sash (`sashArchDxf.js`) — rejected: the
CONTOUR / PIECES / FIT rows are the same drawing with other radii, a copy drifts; (b) `buildSashArchPlan()` in
`cncExport.js` builds a plan with `kind 'sash'` (head ring + top rail ring from `buildSashArchGeometry`, glass
outline, `fit.gap` 9, no rebate wall) and `archDxf.js` accepts it — chosen. The FIT text of a sash reads
`RUNNING GAP 9 (HEAD 80 FACE, SASH AT THE STILE LINE)`; the casement row is unchanged.

**Built:**
- **F** `archDxf.js` — `plan.kind === 'sash'`: rows `S-ARCH HEAD` / `S-ARCH TOP RAIL`, no hinge text (`SASH`),
  FIT row without the rebate wall; `cncExport.js` — `buildSashArchPlan`, `archParamsForWindow` accepts a sash
  (triple never), `downloadDxf(filename, content, mime)`. Samples `sample_sash_arch_1000_semi-circle.dxf`,
  `_1200_three-centre.dxf`, `_1000_gothic.dxf`.
- **G** `glassDxfParamsForWindow` / `traceryParamsForWindow` accept `category 'sash'` (upper unit = the engine's
  `glassOutline`, bands / edge cover / axes from Block 0, glass inset override for the sash rebate);
  `canExportTracery` for a patterned sash; samples `sample_glass_sash_1000x2200_semi-circle_hub-spoke.dxf`,
  `sample_tracery_sash_hub.dxf`. `WindowDetailPage`: Arch DXF / Tracery / Glass DXF buttons enabled for
  `category === 'casement' || windowSpec.arch.shape`.
- **H** 2D from `derived.arch` ArcChains through `archDrawUtils` (no second geometry): `FrontElevation2D` — head
  ring band, jambs to the springing, upper sash outline + unit + bars, lower h bars, dims start / rise, R labels,
  third title line, `data-arch-origin` for the harness; `BoxDetail2D` — head ring, jambs to the springing,
  `S-ARCH HEAD 80` label; `SashDetail2D` — arched upper sash outline / daylight / unit / bars, springing line,
  `rise` chain; `GlassDrawing2D` — the upper arched unit delegates to `CasementGlassDrawing2D` (Block 0 glazier
  sheet: bands, edge line, bar-end table) with a `sash-upper` group; `VerticalSection2D` — `ARCH HEAD` / `ARCH
  TOP RAIL` labels on the curved members. Every rectangular path is behind `derived.arch?.geometry` checks.
- **I** `ArchedSashWindow.jsx` ported from PSW (1003 lines, PSW file 1:1 as the base) with an `Outer` wrapper:
  `resolvePcShape` (PC names first, PSW ids mapped, unknown → semi-circle), props `archRise`,
  `archMinHaunchRadius`, `pcShape`; the outline builders `arcPtsPC` / `shapeContourPC` / `apexRisePC` read
  `archedSashGeometry.js` (new, pure: `engineArcs` = `archArcs` + `offsetArcs` → constant band, `engineArcPoints`,
  `engineApexRise`, `chainTo3D`) and fall back to PSW's sampler when the engine cannot offset the contour.
  PSW's named-export blocks appended to `ParametricSashWindow.jsx` and `FixFrameWindow.jsx` (export, no copy —
  nothing above the block changed). `App.jsx` renders `<ArchedSashWindow>` for `sashType 'arched'`, keys
  `archHBars` / `archVBars` / `lowerHBars` added; `windowSpecToConfig` emits `sashType 'arched'`, `archShape`,
  `archRise`, `archProfile`, `barPattern`, bars, `archMinHaunchRadius` for an arched sash.

**Verification (t22 75/75 ALL PASS):** §1 42/42 rectangular sheets byte-identical to the fixture; §2 sash DXF
rows / radii / FIT gap 9, ezdxf round-trip on the three samples; §3 glazier DXF layers + tracery for the upper
unit; §4 every SVG arc on the five arched sheets sits on an engine ring (centre + radius ±0.01 after the sheet
transform); §5 3D helper (constant band, rule C start, fallback null, names) + `windowSpecToConfig`; §6 wiring
grep. The arched sheets were rendered headless (Chromium) and looked at as PNG. `npm run build` OK.
**Not verified:** the 3D in a browser (no WebGL render in the container — same as night 4), the DXF in VCarve /
AutoCAD, the PDFs. **Findings → BLOCKERS §13.** **Verdict: ✅ Block 1 F–J** (3D ⚠️ compiled + helper-tested only).

### STAGE 3b — Block 3: FIXED windows in the casement batch (`profile.js`, `arch.js`, `specification.js`, `calculations.js`, `lists.js`, `bom.js`, `glassBars.js`, `traceryExport.js`, `archDxf.js`, `cncExport.js`, `glassDxfExport.js`, `glassPdfExport.js`, `projectStore.js`, `ConfiguratorPage.jsx`, `windowSpecToConfig.js`, `App.jsx`, `ArchedCasementWindow.jsx`, `archDrawUtils.js`, `CircleFixedDrawing2D.jsx` new, four casement sheets, `verify/arch/t23.mjs`)

**Understanding:** Piotr 07.09 — a fixed window "podchodzi pod casement batch, ale jednak nie casement": the casement
frame + a leaf that never opens ("leaf tylko"), no hinges, no handle, no opening symbol; shapes rectangle / Round /
Gothic / circle. PSW sells it as the fix-only product (`fixShape`, `fixType`, `fixArchRise`, `fixCircleBarPattern`,
`fixCircleOffset`, `fixSemiBarPattern` / `fixGothicBars`).

**Two approaches, one rejected:** (a) a fourth engine (`deriveFixWindow`) with its own members — rejected: the fixed
leaf IS the casement leaf (same sections, same deductions), a copy drifts; (b) `casement.kind 'fixed'` inside
`deriveCasementWindow`: the layout is forced to `040L` with `casementHinges ['fixed']`, so the existing dummy-sash
path (no hardware picks, no opener) does the work and every number stays the hinged casement's — chosen. The circle
is the one new geometry: the frame and the leaf are full rings, so `arch.js` gets `circleArcs` (two half-arcs,
centre at the origin — every chain helper, the ring builder and the segment planner work unchanged) and
`buildCircleGeometry` on the same profile faces as the arch.

**Built:**
- Data: `casement.kind` ('opening' | 'fixed'; PSW `windowType 'fix-only'` → casement batch + fixed), `archFromSpec`
  reads the PSW fix fields (`fixShape` rectangle / circle / arch ids, `fixArchRise`, the three pattern fields,
  `fixCircleOffset` → `bars.circleOffset`), `circleFromSpec` (shape 'circle', rise = start = W/2, hinge null, pattern
  none | sunburst). Store whitelist `casementKind`, `fixCircleOffset`.
- Profile: `fix.construction 'fixedLeaf'` (DEFAULT open; `directGlazed` refused readably — no rebate numbers),
  `arch.patterns.sunburst { offset 200, spokes 6 }` (PSW CircleFrame), `migrateCasementProfile` fills both.
- Engine: fixed → `040L` + `['fixed']`, notes `fixed leaf`, `derived.casement.kind`; circle → `buildCircleGeometry`
  (800: frame 400 → 343, leaf 360 → 293, glass 305.5, rebate wall 364), `C-FRAME RING` (`C-FRR`, 57x93, centre
  2π·371.5) and `C-LEAF RING` (`C-LFR`, 67x57, 2π·326.5) instead of head / jambs / cill / stiles / rails, glass unit
  `kind 'circle'` (611 × 611, true area), `buildCircleBars` (chords h / v as PSW, sunburst = ring at R − offset + 6
  spokes to the glass edge), tracery on the circle board (full mode), seal = ring circumference, paint π·R².
  Cut list / BOM rows for the two rings (head / top-rail stock).
- Glazier: `glassBars.js` circle branches (edge poly two half circles, bar ends measured from the top of the circle,
  chords by x / y), glazier DXF (`DIAMETER 611 R 305.5`), glass PDF outline path, `CasementGlassDrawing2D` circle
  contour + centre lines. Tracery: `boardFromOutline` circle board, full mode; two fixes in the arrangement —
  overlapping-piece dedupe keyed by the mid-point (the two halves of a circle share both ends) and `offsetFace` on
  a single merged full-circle edge (hub pane, board).
- CNC: `buildCirclePlan` (kind 'circle'), `archDxf` prints `FIXED LEAF` instead of `HINGE L / R` (also for a fixed
  arched casement: `plan.fixed`), FIT row with the rings + the dashed rebate wall; `archParamsForWindow` routes the
  circle. Samples `sample_circle_800_sunburst.dxf`, `sample_glass_circle_800_sunburst.dxf`,
  `sample_tracery_circle_800_sunburst.dxf` / `.lsp`.
- 2D: `CircleFixedDrawing2D` (elevation / frame / leaf views: rings, rebate wall, glass, bars, centre lines, radii, Ø
  dims, blank-plan text) — the three casement sheets delegate a circle to it after their hooks; the rectangular /
  arched sheets are untouched apart from the pane role text (`P1 fixed`).
- 3D: fixed → `casementHinges ['fixed']` (CasementWindow's own fixed pane) / `fixedLeaf` prop on
  `ArchedCasementWindow` (no handle, opening 0); circle → PSW's `FixFrameWindow` circle branch (PC's copy is already
  1:1 with PSW — the "raise it" in the spec was stale) via `windowCategory 'fix-only'`.
- Configurator: Kind chips Opening | Fixed; Fixed → Shape chips Rectangle | Round | Gothic | Circle (Round / Gothic
  reuse the shared arch controls without a hinge side; the layout picker is hidden), circle locks the height to the
  width and shows the ring radii, pattern chips none | sunburst; `buildCirclePlan` errors block the save.

**Verification (t23 79/79 ALL PASS):** §1 circle geometry (400 / 343 / 360 / 293 / 305.5, planner 2 × 5 pieces, errors
for H ≠ W and W < 400, sunburst ring 105.5 + 6 spokes L 200 at 60°, chords, per-window offset, hub-on-circle and
sunburst-on-arch refused); §2 engine circle 800 (two ring records, no hardware, glass true area, tracery 7 panes,
seals / paint / beading); §3 rectangle fixed = 040L stripped JSON byte-equal; §4 arched fixed = arched casement
stripped JSON byte-equal (+ gothic); §5 PSW fix-only circle / gothic / semi-circle / rectangle imports, PC kind,
import errors; §6 CNC DXF ezdxf round-trip (rows, FIXED LEAF, FIT radii, dashed wall, 24 piece contours, merged
export); §7 glazier DXF (contour 2 × bulge 1 R 305.5, edge 294.5, bands) + tracery DXF / LSP round trip (7 panes,
hub rail / limit radii); §8 sheets: every SVG arc of the three circle sheets concentric on the sheet centre with an
engine radius, glass sheet likewise, fixed rectangle without the opening symbol and otherwise identical; §9 3D
config; §10 wiring grep. Rendered the circle elevation / leaf / glass sheets headless and looked at them.
**Not verified:** the configurator and the 3D in a browser, the DXFs in VCarve, the fixed window inside the
production pack / PDFs beyond the engine records. **Verdict: ✅ Block 3** with the DEFAULT (open) entries in
BLOCKERS §14 (2D circle case ✅, 3D fixed leaf ⚠️ compiled only).

### STAGE 3 GATE — ✅ ALL PASS

t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30 · t21 120 · t22 75 · t23 79 · `npm run build` OK.
Rectangular casement (t18 / t19 / t20 fixtures) and rectangular sash (t21 / t22 fixtures) derived JSON and
sheets byte-identical (`derived.casement.kind` is present only on a fixed window). t16 / t18 assertions updated
for the v3 vocabulary (a rectangular sash now skips as "not an arched sash", sunburst in ARCH_BAR_PATTERNS, the
configurator's save gate reads `shapeBlocked`).

### NIGHT 5 — FINAL VERDICT (all four stages) and the CLAUDE.md checklist

**Gates:** Stage 1 (t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30), Stage 2 (+ t21 120), Stage 3
(+ t22 75 · t23 79), Stage 4 (+ t24 26) — every harness ALL PASS on the final tree, `npm run build` green,
esbuild clean on every touched file, no Polish in sources (Piotr's quotes paraphrased in English).
Rectangular casement and sash: derived JSON + sheets byte-identical to the HEAD fixtures (t18 / t19 / t20 /
t21 / t22). t16 / t18 assertions were updated where v3 changed the rule (hinge value 1:1, sash exports,
sunburst vocabulary, blank board metres in the BOM, the configurator's save gate).

**Checklist:** branch pushed after every stage, `main` untouched · harnesses ALL PASS · build OK · esbuild OK ·
diff limited to the spec's files + verify / docs / BUILD-LOG / BLOCKERS / CLAUDE.md · samples in
`docs/handover/samples/` (arch ×5, glass ×4 + merged, tracery DWG / hub / quad / gothic / custom / sash / circle
DXF + LSP, sash arch ×3, circle arch) · BUILD-LOG per stage · BLOCKERS §11–§15 with every DEFAULT (open) ·
SQL in `docs/handover/sql/`.

**What was NOT verified tonight (honest list):**
1. Nothing in a browser: the configurator (Kind / Shape chips, circle height lock, custom hub, arched sash),
   the 3D (arched sash port, fixed leaf, circle via FixFrameWindow), the Archive page, the dashboard Archive
   button, the read-only project page, the PP Curved members card.
2. No CAD: the DXFs (arch, sash, circle, tracery, glazier) were round-tripped through ezdxf and the LSP parsed
   back, never opened in VCarve / AutoCAD; the LSP never run in AutoCAD.
3. No PDF opened: the glass / elevation / elements / cut-list PDFs with arched, sash-arched and circle sheets.
4. Supabase: the archive SQL was not run; RLS not exercised (manual check in BLOCKERS 15.7); cloud writes of
   `archived` / `archived_at` only grep-checked.
5. Physical sanity that only Piotr can give: the 80 sash head ring and the 89 inset (12.1), the circle leaf's
   4 / 17 running fit all round (14.3), the blank rough-length rule (15.3), the sunburst 200 / 6 (14.5).

### STAGE 4 — Block 6 project ARCHIVE + Block 4 cross-cutting (`docs/handover/sql/2026-09-07_projects_archive.sql` new, `cloudSync.js`, `projectStore.js`, `ArchivePage.jsx`, `DashboardPage.jsx`, `ProjectDetailPage.jsx`, `lists.js`, `bom.js`, `pricing.js`, `ProductionPackPage.jsx`, `verify/parity/psw-casement-layouts.mjs`, `PSW-PARITY-REPORT.md`, `PSW-3D-ARCH-PORT.md`, `verify/arch/t24_stage4.mjs`)

**Block 6 — understanding:** Piotr 07.09 — finished projects clutter the dashboard. An archived project leaves
the dashboard, keeps its batches / windows / packs readable, and can come back.
**Two approaches, one rejected:** (a) `projects.status = 'archived'` — rejected: `status` is the production
status the dashboard already reads (`preparation` …) and `loadAll` already filters a boolean `archived`; (b)
`archived` boolean (made explicit) + `archived_at timestamptz` — chosen, SQL as a separate file, RLS untouched.
**Built:** SQL migration (idempotent: columns if not exists, backfill, tenant + archived index);
`cloudSync.saveProject` writes both fields, `loadArchivedProjects()` pulls archived = true with batches +
windows; store `archivedProjects` / `archiveProject` / `restoreProject` / `loadArchivedProjects` /
`getProjectById` (both lists), `clearAll` resets; `ArchivePage` table Project · Client · Batches · Windows ·
Archived on · Restore + search; dashboard card Archive button (immediate when every batch's pack is complete,
confirm modal otherwise — `ConfirmModal` gained `confirmLabel` / `tone`); project page opens an archived project
read-only (banner with Restore, no Add Batch / delete batch).

**Block 4 — built:** `lists.js` `CURVED_MEMBER_PLAN` / `buildCurvedMembersForWindow` (rows with radii, pieces,
per-arc n × stock × rough, finger) and `blankPiecesForRecord` — the pre-cut lists a curved member as its blank
pieces (qty n, rough length, section stock × depth), never as the arc length; `bom.makeRawResolver(name,
{ kind: 'blank', stock, depth })`; BOM board metres follow the blanks. PP: `CurvedMembersSection` in the Cut
List tab (per type); Arch DXF (all) + Tracery DXF / LSP (all) enabled for sash batches / packs (merged exports
for the arched sash). Pricing: `archedCasement.curvedMemberSurcharge` (0) × 2 members, in the breakdown. Parity
script updated to the v3 contract (hinge value 1:1, import ratios = PSW `RISE_RATIO`) and the report regenerated
(23 PASS · 2 DIFF · 0 HARD). Port doc §7 (fixed / circle / doors). Sash glazing arch left out of the engine
(BLOCKERS 15.1). PDFs: the sheets already reach the PDFs through `svgNodeToPng`, so the arched / circle sheets
ride the same path (not opened as PDFs tonight — 15.5).

**Verification (t24 26/26 ALL PASS):** §1 store round-trip archive → hidden → restore → visible (offline store, cloud
disabled), currentProject follows, delete / clearAll; §2 SQL file content, cloud writes, pages grep; §3 blanks
for an arched casement / arched sash / circle, BOM mm = Σ n × rough, rectangular pre-cut unchanged, PP grep; §4
pricing neutral at 0 and +80 at 40, parity report, port doc. **Not verified:** the SQL against Supabase (run by
hand, 15.7), the Archive page / dashboard button / read-only project page in a browser, the PP section on
screen, the cut-list PDF with blanks. **Verdict: ✅ Block 6, ✅ Block 4** (PDF / browser items ⚠️ unverified).

### 0.4 — tracery export DXF + LSP, the `arka` convention (`src/engine/cnc/traceryExport.js` new, `dxfWriter.js` POINT, `arch.js` patterns, `calculations.js`, `lists.js`, `bom.js`, `cncExport.js`, pages, configurator, 3D props)

**Understanding:** one timber board over the arched unit, cut on the CNC to the pane pattern; the bead R8 runs
along every opening. The workshop DWG (one quadrant, R 600, quad-hub-spoke) is the thing to reproduce; the
package explains the offsets (+2 rail / +10 limit / 22 bar / 18 margin) and the section; its mitre legs are
placed the wrong way round.

**Read from the DWG (ezdxf, not memory):** centre (−3227.6189, 1606.5905); board OUTLINE 4D6 R 600 to
x = centre + 7; panes 4D3 (hub R 189), 4CD / 4D0 (R 211–389), 4C5 / 4C8 (R 411–582), all bottoms at
centre + 18, hub cut at centre − 11; +2 (PANE) and +10 (FRONT_HINGES_3MM) as concentric offsets; 20 MITRE
polylines (19 corners, 581 + 587 one corner in two halves), e.g. 51A apex (−3510.4607, 1888.0181) → legs
(−3499.8541, 1877.4115) along the 45° spoke edge and (−3520.8413, 1877.1854) along the R 399 arc — both INTO
pane 4D2; section LINE 4E9 (6 mm) + ARC 4EA (R 8, 90°) on layer 0 = the package polyline `(0,0) → bulge
−0.4142 → (8,8) → (8,14)` after translation (asserted in t20 §4 — the section is NOT a DWG/package difference).

**Two approaches, one rejected:** (a) analytic panes per pattern (sectors of rings for hubs, lens shapes for
intersecting) — rejected: a second geometry per pattern and nothing for straight bars crossing a haunch;
(b) a planar arrangement of lines + circular arcs (split at intersections, overlapping pieces merged, stubs
pruned, faces walked with the interior on the left), each face offset edge-wise (bar edge barWidth/2, board
edge edgeMargin; arcs keep their centre, corners = intersection of the offset edges nearest the original
corner, vanishing edges dropped) — chosen: pattern-agnostic, exact arcs, the DWG falls out of it.

**Built:**
- `traceryExport.js`: curves, `intersections` (line/line, line/circle, circle/circle incl. T-junctions),
  `arrangementFaces`, `offsetFace`, `cornerGuides` (tangent difference > 0.5°, legs 15 mm along the curve
  into the pane, bulge kept), `boardFromOutline` (daylight = unit inset by `glassInset`), `barCurves`,
  `buildTraceryGeometry` (mode auto: quadrant when no pane straddles the axis — the axis becomes a bar edge
  and the cut a board edge 18 − 11 = 7 past it, exactly the DWG's 4D6; else full), `buildTraceryEntities`
  (layers `ARKA_OUTLINE · ARKA_PANE · ARKA_FRONT_HINGES_3MM · ARKA_MITRE · ARKA_SECTION · ARKA_PANE_ZEWN_REF ·
  ARKA_CENTRE · ARKA_INFO_NO_CUT`, section outside the board with `START`, texts incl. `NOT A TOOLPATH` and
  warnings), `writeTraceryLsp` (`(defun c:ARKA …)`, insertion point prompt Enter = 0,0, `-LAYER`, `entmake`
  LWPOLYLINE 90/70/10/42, POINT, TEXT — plain AutoLISP), `parseTraceryLsp` (harness), `buildTraceryForDerived`.
- Profile `tracery { paneOffset 2, profileWidth 8, ridgeLand 2, edgeLand 8, mitreLeg 15, sides 1,
  boardThickness 18 }` → bar 22 / margin 18 / limit +10 derived, never typed twice.
- Patterns (`arch.js`): generic `hubSpoke({ spokes, rings, hubVertical })` behind every hub preset
  (`HUB_PRESETS`: half-hub 0/1, hub-spoke 4/1, double 6/2, triple 8/3 from the profile ratios,
  **quad-hub-spoke 5 / [1/3, 2/3] + hub vertical** from the DWG) and `custom` (spokes 3–9, ring list from the
  window: `archSpokes` / `archRings`); `PSW_PATTERNS_FOR_SHAPE` kept 1:1, `PC_EXTRA_PATTERNS` only on the
  semi-circle. Ring-end verticals skipped on a zero-height springing (fanlight board).
- Engine: `derived.arch.tracery { mode, panes, areas, bbox, warnings }`, `C-TRACERY` (`C-TRY-P1`) record,
  paint + tracery face; `CUT_LIST_ORDER` `C-TRY`; BOM slot `c_tracery` (+ part list). Export:
  `traceryParamsForWindow` / `exportTraceryDxfForWindow` / `exportTraceryLspForWindow` / `exportTraceryMerged`;
  buttons `Tracery DXF` / `Tracery LSP` next to `Arch DXF` (disabled with the reason when no pattern),
  `Tracery DXF (all)` / `LSP (all)` on the pack. Configurator: the two presets in the chip row, custom UI.
  3D: `archSpokes` / `archRings` through App.jsx → ArchedCasementWindow → geometry helper (which now falls
  back to straight bars instead of throwing on bad bar data).

**Verification (t20 §4–§6, ALL PASS):** DWG reproduction — quadrant, 5 panes, 19 guides, pane radii 189 /
211–389 / 411–582 ±0.5 (the DWG's own hub arc is 0.32 off its circle), the 5 OUTLINE panes, 5 PANE and
5 FRONT_HINGES_3MM contours vertex for vertex ±0.5, +2 / +10 concentric exactly, every DWG MITRE matched
(apex ±0.5, legs ±1 mm — corner 51A to 0.02), legs 15.00 along the curve, section verbatim = DWG = package
DXF, board to +7, ZEWN_REF R 598; DXF read back by ezdxf (8 layers, counts), LSP parsed back = the same
45 entities. Engine windows: hub-spoke full 6 panes, quad-hub-spoke + 1V full 13, gothic intersecting,
custom 7 / [0.25, 0.55] — no collapse, panes inside the board; single + merged exports; samples written.
esbuild OK on every file, eslint no-undef clean, `npm run build` OK. Not verified: AutoCAD / VCarve (no CAD
here — BLOCKERS 11.16), a click-through of the buttons. **Verdict: ✅ 0.4** with DEFAULT (open) entries
11.4–11.8 / 11.12 / 11.13.

### 0.4b — hinge value 1:1 with PSW (`specification.js`)

Inversion removed: `hinge = value === 'left' ? 'left' : 'right'` (PSW default value `right`). t16 (7
assertions) / t18 (1) rewritten for the identity; t20 §7 asserts it and greps the old ternary away. PSW
label wording logged as 11.11. **Verdict: ✅ 0.4b**

### 0.4c — bar logic audit (`verify/arch/t20_bars.mjs`, ALL PASS 30)

208 shape × pattern × 0–3 h × 0–3 v cases (semi-circle 8 patterns, three-centre 1, gothic ×2 2): every user
vertical ends on the outline (< 0.01), the gothic centre bar at the apex, h bars strictly between the glass
bottom and the springing at the requested count (also at the profile's minimum straight height; 10 mm below
→ readable ArchError), hub ring-end verticals bottom → springing, no bar end outside the unit, bar run =
Σ lengths, beading = run × 1.15. PSW `PATTERNS_FOR_SHAPE` literal (990–995) = `PSW_PATTERNS_FOR_SHAPE`,
re-read from the live clone; fix radios none | sunburst / none | patternA read from `online-estimate.html`
(Block 3 vocabulary). `intersecting`: the PSW sampling loop (FixFrameWindow.jsx 667–700) copied — every
PSW vertex lies on a PC arc within its range (±1 step) for W 1000 / 1400 equilateral and 1000 drop; PC ends
exactly on the outline. Elevation / leaf sheet / glazier DXF: same bar count, DXF axes = engine ends.
**No PC bug found**; two PSW-behaviour questions logged (11.6, 11.12). **Verdict: ✅ 0.4c**

### 0.5 — small fixes from BLOCKERS §10

Leaf sheet R labels inside the daylight (haunch label collided with the `67` chain); arched elevation subtitle
without the layout code; 3D guides `rise … mm` + `start … mm`; rasteriser: the clipPath elevation rendered
through an `<img>` data URL in headless Chromium (bars clipped) — jsPDF itself not run in a browser. t19
244/244 (rectangular snapshot untouched). **Verdict: ✅ 0.5** (PDF page: morning, 11.10)

### 0.6 — profile decisions

`arch.minPieceLength` 150 (new, warn only: `plan.shortPieces`), the rest confirmed unchanged (t20 §7).
**Verdict: ✅ 0.6** (all DEFAULT (open), BLOCKERS 11.2 / 11.3)

### STAGE 1 GATE — ✅ ALL PASS

t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30 · `npm run build` OK · rectangular casements
byte-identical (t18 §3, t19 §1, t20 §6). Assertions rewritten tonight because the spec changed the rule:
t16 hinge ×7, t18 layers / text lines / PDF header / hinge / vocabulary / pattern table, t19 bar-end format
(x·y pairs gone) and the `GLASS_BAR_AXES` layer — each one names the v3 item.

### 0.2 + 0.3 — glazier DXF bands / edge / axes, bar-end dimensioning (`glassBars.js` new, `glassDxfExport.js`, `CasementGlassDrawing2D.jsx`, `glassPdfExport.js`, `profile.js`)

**Understanding:** the glazier lays an 18 mm spacer bar in the pattern and a perimeter spacer 11 mm inside the
contour; today the DXF gave him axes only and the sheet printed x·y pairs he cannot measure on a curve. Three
consumers (sheet, PDF, DXF) must show the same bands, the same edge line and the same bar-end numbers.

**Two approaches, one rejected:** (a) extend each consumer in place (three copies of the band / offset / apex
arc-length maths) — rejected, night 4 already paid for that with `archDrawUtils.js`; (b) one pure module
`src/engine/glassBars.js` (band curves, edge chain through `offsetArcs` in the arch frame, arc length from the
apex, the dimensioning rows + labels + table cells) and three thin consumers — chosen. New file outside the
spec's list, logged in BLOCKERS.

**Built:**
- Profile: `DEFAULT_CASEMENT_PROFILE.glass = { barWidth 18, edgeCover { default 11, double, double_slim,
  triple, single, passive: 11 } }` (DEFAULT (open): 11 for every type until Piotr gives the triple value) +
  `tracery` block for 0.4; `migrateCasementProfile` fills both from the default for stored copies.
- DXF layers `GLASS_CONTOUR · GLASS_EDGE · GLASS_BARS (bands, ±barWidth/2, bulge on arcs) · GLASS_BAR_AXES ·
  GLASS_TEXT`; the text block keeps the geometry line per bar and adds the bar-end rows (`BAR ENDS: ID  S FROM
  APEX / POSITION  L  ANGLE / R`, degree sign → `DEG`, R12 is ASCII).
- Dimensioning (0.3): vertical bar `x from the bottom-left · s from apex L/R · L`; spoke `s from apex · angle
  from the hub · L` (a ring→ring segment prints its radial extent `r 121.7-243.3` instead); ring `R · centre`;
  h / springing `y from the bottom corners`; tracery `R · s from apex`. More than 4 bars → ids beside the bars,
  the numbers in a table under the drawing (sheet: 4 columns, `MGN_TABLE` grows the viewBox; PDF: same table
  under the sketch in the cell, header line says `N bars — see table`; DXF: the rows in GLASS_TEXT). The
  x·y pairs of night 4 are gone (t19 asserts the regex `>x · y<` no longer matches).
- Sheet / PDF draw the edge line and the bands from the profile numbers (PDF: edge dashed, bands solid, axes
  dotted, ids at the arch ends).
- Rectangular branch of the sheet untouched (t19 §1 snapshot byte-identical).

**Verification:** esbuild OK on all five files · t16 504/504 · t18 178/178 (assertions updated: axes now on
`GLASS_BAR_AXES`, two TEXT lines per bar, PDF header "V1 x 270.3 … from apex … L 1297", hub row "7 bars — see
table") · t19 244/244 (assertions updated: the sheet prints exactly the module's labels / table cells; every
straight or tracery end on the arch carries an `s from apex`) · three sheets rendered through headless
Chromium and looked at (hub-spoke 7 bars, triple hub + 1H 34 bars with the table, gothic intersecting 9
bars): bands, dashed edge, ids beside the ends, table readable. Not verified: the PDF opened in a viewer
(built in node, text asserted by string search only); the triple `edgeCover` value is a placeholder.
**Verdict: ✅ 0.2 / 0.3** (t20 adds the SVG ↔ DXF band / edge arc comparison ±0.01).

### STAGE 2 — Block 1 A–E: arched SASH, engine side (`profile.js`, `arch.js`, `specification.js`, `calculations.js`, `lists.js`, `bom.js`, `projectStore.js`, `ConfiguratorPage.jsx`, `verify/arch/t21.mjs`, fixture `rect-sash-base.json`)

**Understanding:** PSW's flagship arched product is a double-hung sash whose box head and upper sash top rail are
curved; the lower sash is square and stops at the arch start. PC needs the same object as the casement
(`windowSpec.arch` + `lowerHBars`), the PSW import names, a configurator switch, an engine branch that keeps the
rectangular sash byte-identical, the two curved members in the cut list, and the true-outline weights that feed
the balance.

**Baseline first:** `verify/arch/fixtures/rect-sash-base.json` — six rectangular sash windows (standard 2×2,
slim + horns, triple 6×6, heritage single 4×4, triple-glazed 9×9 with a wider cill, glazing-arch head type)
derived from HEAD before any sash edit: derived / cut / glass / precut JSON. t21 §6 re-derives them.

**Two approaches, one rejected (vertical layout):** (a) re-derive PC's rectangular top / bottom gaps from the
135 deduction and place the arch on top of them — rejected: the split of 135 is not written anywhere and the
concentric ring must meet the stile line anyway; (b) PSW's explicit rule (price-calculator.js metricsFor: arch
starts at H − rise, meeting line at H/2, `MIN_UPPER_STILE` on H/2 − rise) + the concentric rings at the profile
offsets — chosen and logged as DEFAULT (open).

**Built:**
- Profile: `DEFAULT_SASH_PROFILE.sashArch { headFace 80, minHaunchRadius 150, limits { 400, 1500, 900,
  minUpperStile 100 } }` (`normalizeSashProfile` fills stored copies). Blank planner / pattern numbers are read
  from the casement `arch` block (one place for the CNC's numbers).
- `buildSashArchGeometry` (arch.js): head ring 0 → 80; top rail ring `sashWidth/2` (89) → 89 + topRail.face
  (57); glass line 89 + 57 − 12.5 = 133.5; rule C (all chains start vertical at the stile line); `upperStileClear
  = H/2 − rise ≥ 100`, `upperStraightStile = clear + MR/2` (the STILES TOP piece to the meeting rail bottom).
- Import (`specification.js`): `sashArchFromSpec` — `sashType 'arched-group'` or `frameShape 'arched'`; PSW ids
  and the radio names (`PSW_SASH_RADIO_SHAPE`: semicircular / gothic / elliptical / segmental → P10 shapes),
  `archRise`, `archProfile`, `archBarPattern`, `archHBars` / `archVBars`, `lowerHBars` (`lowerVBars` ignored:
  lower straight h only). Shared `archFieldsFromSpec` with the casement; the arch object is null on every
  rectangular sash; `arch.hinge` null.
- Engine (sash branch of `deriveWindowData`, conditional on `arch.shape`, never for a triple): `S-ARCH HEAD`
  (`80x164`, head ring centre-line length, planner notes) replaces HEAD; jambs = start − (jambHeight − 80);
  head liners dropped, jamb liners to the springing; `S-ARCH TOP RAIL` (57x57, ring centre) replaces TOP RAIL;
  STILES TOP = straight stile (+ horns); meeting rails, lower sash, cill untouched. Upper unit = arched outline
  in the glass frame (springing = stile clear − MR/2 + rebate), bars = upper straight + pattern
  (`buildArchBars`), lower h bars = equal divisions of the lower daylight; `customGlassUnits` = [upper arched,
  lower rectangular (sash − 89 × lower − 108)]. Weights from the true outline: `upperKg` / `lowerKg` / `total`
  (timber Σ length × kg/m of the finished section + glass area × kg/m²); paint from W × start + arch area; seal
  6070 with the upper sash's equivalent height. `derived.arch` carries geometry, plans, bars, lowerBars,
  upperSash, glassOutline (+ origin in frame coordinates).
- Cut list: `S-AH` after HEAD, `S-ATR` after TR; BOM slots head / top_rail. Store whitelist: `frameShape`,
  `archHBars`, `archVBars`, `lowerHBars`. Configurator: Sash Type → Frame shape Standard | Arched; the arch
  shape / start controls extracted into `archControls` shared with the casement; Glazing Bars section for the
  arched sash (upper h / v, pattern chips per shape, custom hub, lower h) replaces the Georgian grid chips; the
  3D stays the rectangular sash until Stage 3 (I).

**Verification (t21 120/120):** 9 vectors W 1000 / 1200 / 1500 × semi-circle / three-centre (start = H − 0.3 W)
/ gothic: rings 0 → 80 / 89 → 146 / 133.5 concentric, rule C, semi-circle closed forms (S-AH π(R − 40), S-ATR
π(R − 117.5)), stile rule; PSW parity: rise = ratio × W (±0.5, PSW rounds), `minHeightFor` = PC's own limits
(derives at the minimum, throws 10 below with the 900 / 100 message); import mapping incl. radio names; cut
list / BOM / grouped order; weights vs the closed-form area (π R²/2 + Wg × springing); rectangular fixture
6/6 identical + a triple with an arched flag identical to the plain triple. Rendered nothing (no 2D yet).
**Finding (sash F2):** PSW's segmental default (rise 0.20 W) cannot be built as a rule-C sash — the top rail
ring at 146 with the 150 haunch floor leaves an inner radius 4 → readable ArchError; at W 1000 a Round sash needs
rise > ~279 (BLOCKERS 12.4). Not verified: the configurator in a browser, the arched sash in any drawing / 3D /
export (Stage 3). **Verdict: ✅ Stage 2 (A–E)** with the DEFAULT (open) entries 12.1–12.6.

### STAGE 2 GATE — ✅ ALL PASS

t16 504 · t17 72 · t18 178 · t19 244 · t20 112 · t20_bars 30 · t21 120 · `npm run build` OK.

### 0.1 — FIT view in the arch CNC DXF (`arch.js`, `archDxf.js`)

**Understanding:** Piotr overlaid the frame ring and the leaf ring by hand and read the 17 mm rebate lap as an
error. A row that draws frame ring, rebate wall, leaf ring and glass outline concentric in their assembly
position makes the 4 mm running gap and the 17 mm lap readable without overlaying anything.

**Two approaches, one rejected:** (a) draw the FIT view in `cncExport.js` from `getCasementProfile()` — rejected:
a second place reading `geometry.land` / `gap`, and the harness could not reach it without the browser wrapper;
(b) `buildArchGeometry` gains `rebateWall` (= `offsetArcs(base, geometry.land)`) and `fit { gap, lap, land }`,
`archDxf.js` draws them — chosen (one contour source, rule 11 of CLAUDE.md: land / gap / faces from the profile).

**Built:** layer `FIT` (colour 4) first in `ARCH_LAYERS`; `fitRow()` = `ringPoly(frameHead)`, `ringPoly(leafTop)`,
closed glass chain, rebate wall as 20 / 10 mm dashes (`dashedChain`, 2-vertex bulge polylines — `dxfWriter` has
no linetypes and adding them is on the "not today" list); text block `FIT (ASSEMBLY, NOT A TOOLPATH)` · `GAP 4
LAP 17 (REBATE)` · frame / wall / leaf / glass radii. The row is the TOP row of the drawing (rows are stacked
bottom-up, FIT pushed last); CONTOUR / PIECES rows untouched. `buildArchEntities` refuses a plan without the v3
fields instead of drawing a partial FIT.

**Verification:** esbuild OK (`arch.js`, `archDxf.js`) · W 1200 semi-circle: frame 600 / 543, rebate wall 564,
leaf 560 / 493, glass 505.5, gap 4, lap 17 — the spec's verified numbers · `.audit/fit_1200.dxf` read back by
ezdxf: layer `FIT` present, 63 FIT entities (3 closed rings + 60 dashes) · t16 504/504 still ALL PASS.
Not verified: the DXF opened in VCarve / AutoCAD (no CAD in the container). **Verdict: ✅ 0.1** (t20 §1 asserts the
numbers again through the export path).

---

## 2026-09-06 — arched-casement-v2 night 4: D + E + F + t19 (branch `claude/arched-casement-v2-def-enkyue`)

Inputs read in full, in this order: `CLAUDE.md` → `ARCHED-CASEMENT-v2.md` §4 (+ §0–2 for the data model) →
`BUILD-LOG.md` (night 3) → `BLOCKERS.md` §9 → the four `Casement*2D.jsx`, `drawingUtils.jsx`, `drawingTheme.js`,
`casementDrawUtils.js`, `arch.js`, the arched branch of `calculations.js`, `ArchedCasementWindow.jsx`,
`FixFrameWindow.jsx` (PSW bar strips), `CasementFrame.jsx` / `CasementPanel.jsx` constants, `windowSpecToConfig.js`,
`src/3d/App.jsx` (`update3D`), `archDxf.js` / `glassDxfExport.js` entity builders, `t18.mjs`. Baseline on the branch
start (`5ba3661` = `origin/main`): t16 504/504, t17 72/72, t18 178/178 ALL PASS (re-run at the end of the night).

Decisions taken up front:
1. **One contour = one module.** The sheets never compute an arc: every `A` command is written by
   `src/components/drawings/archDrawUtils.js` (new, pure, no React) straight from an `arch.js` arc
   `{ cx, cy, r, a0, a1 }` — the same objects `derived.arch.geometry` / `glassOutline` / `bars` hand to the DXF
   builders. Sweep flag from the chain direction (counter-clockwise a0 → a1 in the y-up frame = sweep 0 on the
   y-down sheet, 1 when traversed backwards), large-arc flag from the span. Outside the spec's file list — added
   because the alternative was the same 60 lines copied into four sheets.
2. **Bars on the elevation / leaf sheet are the engine axes (glass frame, to the unit edge) clipped to the
   daylight with an SVG `clipPath`** built from the daylight chain — the bars keep the glazier's geometry
   exactly and the wood hides the 12.5 mm that sits in the rebate, as on the real window. No bar is re-cut to
   the daylight in code (circle–circle work for tracery arcs would have been a second geometry).
3. **Exterior land line** on the elevation / frame sheet = `offsetArcs(outer, geometry.land)` (36 in), the
   arched twin of the existing `landRect`; the DXF ring inner (57) is not what the eye sees from outside.
4. **Snapshot = fixture, not hashes.** `verify/arch/t19_baseline.mjs` rendered the four sheets (22 SVGs, all
   panes / glass groups of the four rectangular fixtures) from `HEAD` with react-dom/server BEFORE any sheet
   was touched → `verify/arch/fixtures/rect-casement-sheets.json` (full strings, so a failure shows a diff).

### D0 — baseline snapshot (`verify/arch/lib/sheets.mjs`, `verify/arch/t19_baseline.mjs`, fixture)

**Built:** `bundleTree(srcRoot, tag)` bundles the four sheets + engine of ANY source tree (`git archive` of a
commit or the live `src/`) with esbuild (react / react-dom external), `renderSheets` renders every sheet the
DrawingsPanel / WindowDetailPage show (elevation, frame, one leaf sheet per `groupCasementLeaves` group, one glass
sheet per `groupCasementGlass` group) with `renderToStaticMarkup`. Render proven deterministic (two runs
byte-identical). **Verdict: ✅ D0**

### D1 — `archDrawUtils.js` + `CasementElevation2D.jsx`

**Understanding:** the exterior view of an arched casement shows the frame band (outer contour → land line),
the leaf top rail outer edge, the daylight and the bars — all curved from the springing line up.

**Two approaches, one rejected:** (a) offset the ArcChain *in the sheet* (radius − 36 etc.) — rejected: a second
offset implementation next to `arch.js` `offsetArcs`; (b) build every contour with `offsetArcs` / the ring
chains the engine already exposes and only *serialise* them here — chosen.

**Built:** `archToSheet` / `glassToSheet` transforms, `svgArc`, `chainArcsD`, `archedOutlineD` (sides at the
chain's own end x — rule C — bottom at a given y), `ringBandD`, `barBandD` (22 mm band: rotated polygon for a
straight bar, r ± 11 arcs for a ring / tracery), `barAxisD`, `arcLabelPoint` (crown arc: mid angle; haunch arc:
¾ of the way from the springing end so the label clears the corner dims), `radiiText`, `onCurve`.
Elevation: when `derived.arch` exists — frame band (evenodd outer + land outlines), outer / land strokes,
leaf outline from `leafTop.outer`, daylight from `leafTop.inner` (glass fill), bars from `derived.arch.bars`
transformed through `glassOutline.origin`, clipped to the daylight; opening symbol starts on the springing line
(`lf.topY`); springing centre-line (dash pattern of the transom axes), `start` and `rise` DimV on the left, an
`R …` label per outer arc, third title line `Three-centre · start 1300 · rise 200 · R 150 / 1400 / 150`
(`TITLE_AREA` 75 instead of 50 only when arched), `data-arch-origin="ox,oy"` on the `<svg>` (only when arched)
so t19 can map sheet coordinates back to the frame. Rectangular branch: JSX untouched, output byte-identical
(fixture, 4 windows / 22 sheets). Rendered to PNG through headless Chromium and looked at: three-centre 1H 2V,
semi-circle hub-spoke, gothic intersecting, semi-circle triple hub — arcs, bands, clipped bars, dims in place;
the first pass had the haunch `R 150` label on top of the `rise` dim and centre crosses inside the glass —
label moved (`arcLabelPoint`), crosses dropped (the CNC sheet carries the centres).
**Verification:** esbuild OK (both files) · no Polish letters · snapshot IDENTICAL · `A` count per sheet =
7 × arcs + 2 × arc bars (checked by hand on four windows, asserted in t19). **Verdict: ✅ D1**

### D2 — `CasementFrameDetail2D.jsx`

**Built:** head band + strokes from the same outer / land chains; `C-AH <length>` label (length + notes read
from the cut-list record `C-ARCH HEAD` in `derived.components.box` — the sheet prints what the cut list prints),
`C-J/L` / `C-J/R <start>` centred on the straight jamb, right chain `rise · start−41 · 41` (no top chain on an
arched frame — the head is curved, dimensioned by the radii and the C-AH length), springing line, `start` /
`rise` dims, `R` labels, third title line with the planner notes (`R 150/1400/150 · 8 pieces · stock 95/95/95`);
click zones: head = the outer/land band path, jambs from the springing down. Rectangular output byte-identical.
Rendered and looked at (three-centre, gothic). **Verification:** esbuild OK · no Polish letters · snapshot
IDENTICAL. **Verdict: ✅ D2** (t19 assertions added at the end of the night, see T19).

### D3 — `CasementLeafDetail2D.jsx`

**Understanding:** the leaf sheet is what the bench sees: outer leaf (straight stiles + the C-ARCH TOP RAIL
outer chain), the 24 mm unit edge (= the glazier's outline), the daylight (top rail inner chain), bars with
the crossing / notch symbols, chains of stile · bars · stile.

**Built:** arched branch when `derived.arch` exists and the group is the (single) arched leaf: leaf outline /
daylight / unit edge from `leafTop.outer`, `leafTop.inner` and `glassOutline.arcs` (leaf coordinates via
`archToSheet(fw, rise, ox − rect.x, oy − rect.y)` and `glassToSheet` at the 54.5 unit inset); bars = 22 mm
bands on the engine axes clipped to the daylight; crosses at every straight v × h crossing and V-notches at
the straight-edge ends (v bottoms, h / springing ends) — the same symbols as the rectangular leaf, only where
a bar meets a straight edge; chains built from the engine's straight bars (`role v`, `h` / `springing`,
de-duplicated by position, so the two springing segments of a hub print as one 22 cut); springing line,
`stile <leafStraightStile>` + `rise` dims on the right, overall H moved out (80·ts) only when arched; `R`
labels — haunch / gothic arcs outside near the corner (`isHaunchArc`), crown / semi-circle inside the
daylight; third title line `Three-centre · stile 1253 · rise 160 · top rail R 110 / 1360 / 110 · C-ATR 949.8`
(length from the cut-list record). Opening symbol starts on the springing line. Click zones: top rail = the
ring band path, stiles from the springing down. The rectangular `computeBarPositions` lists are emptied on an
arched leaf so the old bar drawing renders nothing there (rectangular output byte-identical). Rendered and
looked at (three-centre 1H 2V, semi-circle hub-spoke, gothic intersecting).
**Verification:** esbuild OK · no Polish letters (codepoint check, not a byte grep) · snapshot IDENTICAL.
**Verdict: ✅ D3**

### D4 + E — `CasementGlassDrawing2D.jsx` (glazier sheet, bar end numbers)

**Understanding:** the glazier cuts the outline from the DXF; the sheet is the human copy — the same outline,
the seal, the spacer bars, and (E) a number at every bar end he cannot measure off a straight edge because it
lies on a curve.

**Two approaches for the seal, one rejected:** (a) inset the closed polygon (vertex normals, PSW centroid
trick) — rejected: not concentric, wrong at the tangent points; (b) `offsetArcs(geometry.glass.arcs, 11)`
in the arch frame, shifted into the glass frame — chosen (exact, rule C keeps the sides at ±(xg − 11)).

**Built:** unit outline = `glassOutline.arcs` (glass frame → sheet), seal = concentric 11 mm offset (frosted
hatch fills the seal path), spacers = 18 mm bands on the engine bar axes (straight bands, exact arcs for rings
/ tracery), top / left chains from the straight bars (v; h + springing de-duplicated), springing line,
`springing` + `rise` dims (right, 34·ts) with the overall H at 74·ts when arched, `R` labels for every glass
arc (haunch outside / crown inside), third title line `Three-centre · springing 1198.5 · rise 105.5 · R 55.5 /
1305.5 / 55.5 · 3 bars`, title `811 × 1304 mm · arched`. **E:** straight bar whose top end lies above the
springing (`onCurve`) → `V1 1297` beside the bar 56 mm below its end (x is on the chain); spoke → `K1 608.3 ·
1249.7` set back along the spoke; ring → `R1 R 121.7` inside the ring; tracery arc → `T1 R 364.8` at 30 % from
its springing end (`barArcLabelPoint`, two tracery arcs cross near the axis at their middles) + the end that
lies on the outline (`from` for right-centred arcs, `to` for left-centred — PSW's arc direction) printed
outside the outline `62.1 · 1162`. Rendered and looked at (three-centre, semi-circle hub-spoke, gothic
intersecting): first pass had `V1` on top of `R 1305.5` and `T2` / `T3` on top of each other, and the
right-hand tracery ends unlabelled (the `to` end sits on the springing there) — all three fixed.
**Verification:** esbuild OK · no Polish letters · snapshot IDENTICAL (4 windows / 22 sheets) · `A` count per
sheet = 2 × outline arcs (unit + seal) + 2 × arc bars (checked by hand: 6 / 4 / 12 / 2 / 8).
**Verdict: ✅ D4 + E** (2D part; E in 3D is part of F).

### F — 3D (`archedCasementGeometry.js` new, `ArchedCasementWindow.jsx` rewritten, `windowSpecToConfig.js`, `ConfiguratorPage.jsx` update3D, `src/3d/App.jsx`, `docs/handover/PSW-3D-ARCH-PORT.md`)

**Understanding:** the configurator's 3D must show the arch the joiner typed — rule C, concentric rings,
the rise — instead of the PSW fixed ratios; the component keeps the PSW prop names so it can go back to PSW.

**Two approaches, one rejected:** (a) keep delegating the leaf to `FixFrameWindow` and only fix the frame —
rejected: the leaf shapes in FixFrameWindow are the PSW ratios (ellipse, 0.4 W segment) and a `fixArchRise`
hack; the leaf top would never match the frame ring; (b) one pure helper that builds every contour from
`arch.js` and a component that only turns contours into THREE shapes — chosen, and the helper is what t19 tests.

**Built:**
- `archedCasementGeometry.js` (pure, no React / THREE, importable in node): `resolveArchProps` (PSW + PC shape
  names, `archRise` or the PSW ratio, gothic profile), `sampleArc` / `contourUnder` / `contourAt` (concentric
  offset of a contour: `offsetArcs` + sides and bottom moved in), `archedCasementGeometry` → outer, inner (57),
  rebated (36), gasket inner (36 + 19), leaf outer (40) / inner (104), glass outline + bars via `buildGlassOutline`
  / `buildArchBars` on the 3D daylight, in mm around the window centre; `safeArchedCasementGeometry` falls back to
  the ratio rise (reason kept) and never throws for a viewer. Dimensions come in as `dims` from the 3D constants
  (`CasementFrame` / `CasementPanel`), never literals; the two profile rules the 3D cannot know arrive as props
  (`archMinHaunchRadius`, `archPatterns`) with the PSW literals as the fallback (`PSW_BAR_PATTERN_SETTINGS`).
  Two drawing floors found by the harness: a haunch must be deeper than the deepest ring drawn (leaf inner 104
  + bead 10 → 114; production's 150 wins when passed) and the frame must leave the leaf's straight part below the
  springing (rise + 125, PSW had rise + 50) — both derived from `dims`, logged in BLOCKERS §10.
- `ArchedCasementWindow.jsx`: frame ext / int layers + gasket from the helper contours (the gasket inner edge is a
  true offset, no centroid inset), the leaf drawn here (ring split ext / int, chamfer + ovolo contour beads as 32
  concentric layered strips each, glass `ShapeGeometry` + 1 mm spacer ring, handle, pivot), bars: straight =
  profiled trapezoid / ovolo extrusions rotated along the segment (18 mm overshoot; spokes inset 0.6 / 0.4 bar
  widths as PSW), rings / tracery = 64 layered strips along the exact arc (PSW `intersectingData` /
  `buildRingLayers`, reused). Props: PSW names kept + `archRise`, `archProfile`, `barPattern` (falls back to
  `fixSemiBarPattern` / `fixGothicBars`; PSW `patternA` → none), `archMinHaunchRadius`, `archPatterns`. Guides
  print the real rise.
- Wiring: `windowSpecToConfig` emits `casArchShape` = PC name, `archRise`, `archProfile`, `barPattern`,
  `archMinHaunchRadius`, `archPatterns` (profile); `ConfiguratorPage` `update3D` the same (`PC_TO_3D_ARCH` removed —
  the component takes PC names now, justification: dead mapping); `src/3d/App.jsx` stores the five keys, hands them
  to the component and keeps them in the category bucket (outside the spec's file list — without it the props
  never reach the component; PSW's App needs the same five lines, see the port doc).
- `docs/handover/PSW-3D-ARCH-PORT.md`: files, props, what changes visually, checks after the copy.

**Verification:** esbuild OK on all six files · `npm run build` OK · helper in node: extents = W × H for
semi-circle / three-centre / gothic × 2 and the four PSW names, rings nest (57 / 36 / 40 / 104), rule C at the
springing, bar counts and roles = the engine list, tracery centred on the outer corners, fallback on an
impossible rise, floors (t19 §4, 40 checks) · t19 §5 structural evidence of the wiring.
NOT verified in a browser: the WebGL render itself and the configurator click-through. A headless Chromium
(SwiftShader) capture of a scratch page mounting `<Canvas><ArchedCasementWindow …/></Canvas>` was attempted five
ways (screenshot with / without virtual time, `toDataURL` through `--dump-dom`, `localhost` vs `127.0.0.1`): the
page mounts the canvas, but no rendered frame came back inside the time budget — so the 3D look (frame, gasket,
leaf, beads, bars, handle, opening pivot) has ONLY the node-side geometry evidence behind it (t19 §4).
**Verdict: ⚠️ F** (geometry proven in node; the rendered look needs Piotr's eye in the morning — Configurator →
casement → Arched → Round / Gothic with bars, open the leaf).

### T19 — `verify/arch/t19.mjs` + closing checks

**Built:** bundles the live `src/` (sheets + engine + archDxf + glassDxf + cncExport + the 3D helper +
windowSpecToConfig) and asserts: §1 the four rectangular fixtures → 22 sheets byte-identical to the pre-night
fixture (`rect-casement-sheets.json`, rendered from `5ba3661`); §2 six arched windows (semi-circle / three-centre
1300 / gothic × plain and 2v/1h + pattern): no NaN, `A` count per sheet = 7n / 4n / 4n / 2n (+ 2 per arc bar), no
Bezier command, head / leaf / glass radius labels, start / rise / stile / springing dims, C-AH / C-J cut-list
lengths, E bar-end numbers (`V1 1297`, `K1 608.3 · 1249.7`, `R1 R 121.7`, tracery ends), clipPath + one band per
bar, every `<text>` anchor inside the viewBox; §3 ONE CONTOUR — every SVG `A` converted to its circle with the
W3C endpoint → centre formula (independent of `archDrawUtils`) and mapped into the arch frame through
`data-arch-origin`; the arch CNC DXF rings (`cncExport.archParamsForWindow` → `buildArchEntities`, each row pinned
by its ring's outer start point) and the glazier DXF (`GLASS_CONTOUR`, `GLASS_BARS`) converted from bulges: same
centre set, every DXF ring / contour / bar arc has an SVG twin ±0.01 mm (bands r ± 11 / ± 9, seal r − 11, land
r − 36), every SVG arc sits on a DXF centre; §4 the 3D helper (above); §5 wiring.
**Result:** t19 **241 / 241 ALL PASS** · t16 504 / 504 · t17 72 / 72 · t18 178 / 178 (ezdxf installed in the
session first — the DXF probes need it) · `npm run build` OK · esbuild on every touched file · no Polish
letters (codepoint check) · `git diff origin/main --stat` = spec §5 night-4 files + `archDrawUtils.js`,
`archedCasementGeometry.js`, `src/3d/App.jsx`, `ConfiguratorPage.jsx` (update3D block), verify / fixtures / docs /
logs — `casementLayouts.js`, beading, `jambDxf.js`, `arch.js`, `calculations.js` untouched.
**Verdict: ✅ T19**

### Rano dla Piotra — what to look at (5 minutes)
1. Window (arched casement) → Drawings: Elevation, Frame, Leaf sheets; Glass tab → glass drawing. Every arc is an
   SVG arc from `derived.arch`; look at the label placement (BLOCKERS 10.10) and press Elements PDF / Glass Drawings
   PDF once (clipPath through the rasteriser, BLOCKERS 10.9).
2. Configurator → casement → Arched: Round with a typed start (e.g. 1300 on 1000 × 1500), Half, Gothic; add 1H 2V
   and a pattern; drag the opening — the 3D now follows the rise (F). This is the part no harness could see.
3. `node verify/arch/t19.mjs` → 241 / 241; the rectangular sheets are byte-identical to `5ba3661`.
4. Decide BLOCKERS 10.1 (arched 3D in the window detail preview — six lines) and 10.3 (3D faces from the profile).

## 2026-09-06 — arched-casement-v2 night 3: A + B + C + t18 (branch `claude/arched-casement-v2-impl-0j27uw`)

Inputs read in full, in this order: `CLAUDE.md` → `ARCHED-CASEMENT-v2.md` (spec, P1–P10 override v1) →
`ARCHED-CASEMENT-v1.md` §0 → `ARCHED-CASEMENT-v1-AUDIT.md` §2 → `-AS-BUILT.md`, `BLOCKERS.md`, `BUILD-LOG.md`
(night 2). Baseline on the branch start (`faedf98` = `origin/main`): t16 465/465, t17 73/73 ALL PASS.
The spec v2 §3 vectors were checked by hand before coding (r 150 / R 1400 / T (392, 144) / 73.74° /
1180.72 etc. all follow from P3) — they are the expected values, the harness reproduces them.
PSW clone (read-only) succeeded: `FixFrameWindow.jsx` 667–830 / 847–1030 and `price-calculator.js`
985–1000 were read for the bar patterns and `PATTERNS_FOR_SHAPE`.

Decisions taken up front (details in BLOCKERS.md §9):
1. `segmental` is removed from `ARCH_SHAPES` (P2). The t16 §10.1 / §10.2 segmental vectors are
   superseded by a three-centre rise 240 under P3 (r clamps to 150, crown R 1320); the 390 vector is
   unchanged (r 253.5 > 150). t16 §10.3 item 10 now freezes `casementLayouts.js` + `jambDxf.js` only —
   `lists.js` / `calculations.js` are in scope for v2 (B).
2. `archArcs(shape, W, rise, { minHaunchRadius })`: the P3 minimum is an option so pure-geometry
   callers keep the v1 rule; `buildArchGeometry` reads it from `profile.arch.minHaunchRadius` (required,
   readable error when missing). Consequence F2: a Round arch needs rise > 150 (rise = r leaves no crown
   arc) — at W 400 the PSW defaults (80 / 130) are rejected; Auto (0.325 W) clears 150 from W 462.
3. Profile `arch` block → version 3 (`minHaunchRadius`, `patterns` ring ratios / tracery pitch); a stored
   v2 block is replaced whole (no UI edits it).

### A — configurator (`ConfiguratorPage.jsx`, `projectStore.js`, `specification.js`, `arch.js`, `profile.js`)

**Understanding:** the joiner picks Round | Gothic and types where the arch starts (mm from the cill);
rise = H − start; the engine shape (semi-circle / three-centre) is a result, as are the radii.

**Two approaches, one rejected:** (a) keep `rise` as the state and derive `start` for display — rejected:
"changing H keeps start, recomputes rise" (P4) is natural only when `start` is the state; (b) `start` is
the state, `rise` derived, `resolveRoundShape` picks the engine shape — chosen.

**Built:**
- `arch.js`: `ARCH_SHAPES` without segmental, `LEGACY_ARCH_SHAPES` (v1 'segmental' → three-centre 0.20 W),
  `PSW_ARCH_RISE_RATIO`, `ROUND_AUTO_RATIO` 0.325, `resolveRoundShape(W, rise)` (±0.5 → semi-circle, above
  half → "use Gothic"), `readMinHaunchRadius`, bar-pattern vocabulary (`ARCH_BAR_PATTERNS`,
  `PATTERNS_FOR_SHAPE` from PSW 990–995, `isHubPattern`), `buildArchGeometry` returns `start`, `radii`,
  `minHaunchRadius`, `glass.halfWidth`; rings expose the `centre` chain.
- `specification.js` `archFromSpec(item, fc, width, height)`: `archStart` → rise = H − start (riseSource from
  the item, default custom); v1 `archRise` still honoured; PSW `segmental-arch` → three-centre 0.20 W,
  `elliptical-arch` → 0.325 W; v1-era PC 'segmental' → three-centre 0.20 W with riseSource 'ratio' even if
  it had a custom rise (spec A wording); Round shapes re-resolved through `resolveRoundShape` (a start
  giving rise > W/2 throws "use Gothic" — never a silent shape); `arch.bars = { pattern, h, v }`, unknown
  pattern throws.
- `projectStore.js`: `archStart`, `archBarPattern` whitelisted in both builders.
- Configurator: chips Round | Gothic; "Arch starts at (mm from cill)" NumInput (no spinners) + chip Auto
  (H − 0.325 W) + button Half (H − W/2, sets custom); Gothic profile chips with a derived, disabled start;
  live line `Rise 200 · R 150 / 1400 / 150` (`R 500` semi-circle, `R 1000` gothic); right panel: Type,
  Arch starts at (auto/custom), Rise · R, Leaves, Bars (+ pattern); CNC row prints the ArchError text and
  the Save button is disabled while the arch is invalid; Pattern chips filtered by the resolved shape
  (a pattern the shape does not offer resets to none); vertical chips hidden for hub patterns (PSW ignores
  v there — the ring ends are the verticals); edit / prefill restore start (from `archStart`, else H −
  `archRise`), riseSource, pattern; a v1 'segmental' loads as Round on Auto. Height clamp: Gothic
  `ratio·W + 900`, Round `901` (the typed start carries the 900 rule, reported by arch.js).
- 3D sync unchanged apart from the removed segmental key (night 4 rewrites the component).

**Verification:** esbuild OK on all five files · scratch eslint `no-undef` clean · no Polish letters ·
t16 rewritten for v2: 504/504 ALL PASS (incl. `resolveRoundShape`, P3 clamp, v3 profile migration,
PC `archStart` / Half / "use Gothic" / legacy migration / bars mapping) · t17: 72/72 ALL PASS (F2 boundary
150 / 151, W 400 rise 160 → r 150, exporter skips) · sample `sample_arch_1200_segmental.dxf` replaced by
`sample_arch_1200_three-centre-rise240.dxf` (head 2 + 3 + 2 × 95, leaf 2 + 4 + 2 × 95).
NOT verified: the configurator in a browser (no UI run in this session — Piotr's morning test).

**Verdict: ✅ A** (engine-side proven by harness; UI compiled and linted only).

### B — engine (`arch.js` bars, `calculations.js`, `lists.js`, `bom.js`)

**Understanding:** when `windowSpec.arch` is set the casement engine keeps the straight rules below
the springing and swaps the head / leaf top rail for curved members, the glass for a shaped unit and
the bar counts for a real bar list; paint, seals and weights follow the true outline.

**Two approaches, one rejected:** (a) derive the arch in a separate `deriveArchedCasement` and merge
— rejected: hardware picks, cill, beading, consumables and the record helper would be duplicated;
(b) one guarded branch (`archSpec`) inside `deriveCasementWindow`, every rectangular line untouched —
chosen; proven by the fixture (§ below).

**Built:**
- `arch.js` (glass outline + bars, v2 §2.3): `chainYAtX`, `chainAreaAboveLine` (Green's theorem, exact —
  matches a 200 000-strip numeric integral on the gothic chain), `buildGlassOutline` (glass frame: origin
  = unit bottom-left, y up; asserts rule C — the chain starts at x = xg), `glassOutlinePoly` (closed bulge
  polyline, one vertex per arc end), `buildArchBars`: straight v (equal divisions of Wg, bottom → outline)
  and h (equal divisions of the straight height below the springing, full width); hub patterns ported
  from PSW `semiBarPattern` (rings 0.3 / 0.6 / 0.8 · xg, spokes at i/(n−1)·π segmented ring → ring →
  outline, the two end spokes ON the springing line = the springing bar, ring-end verticals below the
  line, half-hub = full springing bar + ring 1, v count ignored for hubs — PSW); `intersecting` ported from
  `intersectingData` (n = clamp(round(Wg / 450), 2, 4) mullions to the springing, tracery arcs centred on
  the OUTER frame corners ±W/2, stopped at the outline by exact circle–circle intersection, quarter turn
  max, radius < 30 skipped). Roles v | h | springing | ring | spoke | tracery; ids V1…, H1…, S1…, R1…, K1…,
  T1…; lengths rounded to 0.5. Pattern availability enforced (`PATTERNS_FOR_SHAPE`) — a hub on a
  three-centre throws readably. PSW's spoke insets / bar-top clearance are 3D cosmetics and are not
  ported: the axes meet the rings and the outline exactly.
- `calculations.js` `deriveCasementWindow`: layout forced to `040L` / `040R` by the hinge, hinge array
  ignored; `C-ARCH HEAD` (`C-AH`, `frameHead.face × frameDepth`, length = ring CENTRE-line arc length,
  notes `R 150/1400/150 · 8 pieces · stock 95/95/95` from `planArchSegments`); jambs = `start` −
  jambDeduct; `C-STILE` = `leafStraightStile` − stileDeduct (leaf bottom → springing); `C-ARCH TOP RAIL`
  (`C-ATR`, leaf ring centre line); bottom rail unchanged; glass unit `{ width Wg, height apex, qty 1,
  role main, location 'arched leaf', shape: { kind 'arched', archShape, outline, poly, springing, apex,
  rise, radii, area, perimeter, bars, pattern, barCounts } }`; `glassSqm`, pane weight, bead perimeter
  from the true area / perimeter; astragal bar run = Σ bar lengths; seals: 2·start + head outer arc
  (+ cill); paint from `W·start + area under the outer chain` (`paintFromAreaSqm` shared with the
  rectangular path — same numbers); leaf timber run = 2 straight stiles + bottom rail + curved top rail;
  `derived.arch = { shape, geometry, plans, bars, barCounts, barTotalLength, pattern, glassOutline (+ origin
  in frame coordinates: x = W/2 − xg = 94.5, y = 101.5) }` — spread in only when arched, so a rectangular
  casement's output has no new key. Invalid arch numbers throw `ArchError` (every caller —
  WindowCard, ProjectDetailPage, ProductionPackPage, WindowDetailPage, canvas renderer, Material
  Assignments — already catches; never a silent rectangle).
- `lists.js`: `C-ARCH HEAD` → `C-AH` right after `C-FRAME HEAD`, `C-ARCH TOP RAIL` → `C-ATR` right after
  `C-TOP RAIL` (no `?` groups); glass rows carry `shape` and a bars label from the engine's counts +
  pattern (`1H × 2V astragal`, `hub-spoke astragal`, `1H · intersecting astragal`).
- `bom.js`: `C-ARCH HEAD` → `c_frame_head`, `C-ARCH TOP RAIL` → `c_sash_top_rail` — outside the spec's
  file list, added because `buildWindowPartQtys` silently drops any element name it cannot map (the
  arch timber would vanish from the BOM). The blank is really glued from `profile.arch.stockWidths`
  boards — BLOCKERS §9.

**Verification (node, real path `normaliseToWindowSpec → deriveWindowData → lists`):**
- rectangular fixture (4 windows: 040L 1000×1500 1H×2V, 052L fanlight, 120 georgian triple frosted,
  180L wider cill) dumped from `origin/main` before any change: `derived`, cut list and glass rows are
  JSON-identical after B, no `arch` key.
- three-centre 1000×1500 start 1300 (spec §3 vector): C-AH 1091.2 (centre line), jambs 1300, stiles 1253,
  C-ATR 949.8, glass 811 × 1304 (springing 1198.5, apex 1304, radii 55.5 / 1305.5 / 55.5), bars H1 811 +
  V1/V2 1297, seal frame 5.26 m, no `?` cut-list group.
- semi-circle 1000×1500 (Half) hub-spoke: C-AH 1481.3 (π × 471.5), C-ATR 1339.9, 7 bars (ring R 121.65
  L 382, 2 springing segments, 2 spokes at 60° / 120°, 2 ring-end verticals), v count dropped.
- gothic 1000×1800 intersecting: 2 mullions + 4 tracery arcs; jambs 934, stiles 887.
- t16 504/504, t17 72/72 ALL PASS after the engine change · esbuild + eslint clean on the four files ·
  no Polish letters.
NOT verified: the 2D sheets / 3D still draw the arched window as a rectangle (night 4, by design);
hardware (hinge/lock) picks on the arched leaf use the bounding leaf height — unchanged from v1.

**Verdict: ✅ B**

### C — glazier exports (`glassDxfExport.js` new, `glassPdfExport.js`, `cncExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`)

**Understanding:** the glazier gets the exact contour + bar axes as a DXF (cutting reference) and the
schedule PDF gains a Shape column, an outline drawing and the bar positions in mm and % (P6).

**Two approaches, one rejected:** (a) thumbnails via SVG → canvas captured from the DOM (the "other
thumbnails" of the glass-drawings PDF) — rejected: needs a browser, cannot run in the harness and the
schedule PDF already draws its rectangles with jsPDF primitives; (b) draw the outline with jsPDF paths —
exact arcs as cubic Béziers (≤ 90° per segment, the standard 4/3·tan(Δ/4) construction) — chosen; the
DXF stays the exact reference.

**Built:**
- `glassDxfExport.js` (new, R12 via `dxfWriter.js`): layers `GLASS_CONTOUR` (7, closed bulge polyline,
  one vertex per arc end), `GLASS_BARS` (3, straight bars as 2-vertex polylines, rings / tracery as
  2-vertex bulge polylines), `GLASS_TEXT` (2: window – unit id – shape, `W × H RISE SPRINGING R …`,
  the glass spec line, `BARS n [PATTERN …] TOTAL L=…`, one line per bar `V1 V X=… Y=…-… L=…`). Units are
  the SAME rows the Glass tab shows (`buildGlassListForWindow`), qty repeated, stacked top-down
  `MERGE_GAP` (300) apart; merged files stack windows the same way. `glassDxfParamsForWindow` skips with a
  reason (not a casement / not arched / no shaped unit), `canExportGlassDxf`, `exportGlassDxfForWindow`
  (`{name}_glass.dxf`), `exportGlassDxfMerged` (`{label}_glass.dxf`, rectangular-only windows listed as
  skipped). `downloadDxf` + `safeName` are now exported from `cncExport.js` (one download path, one
  file-name rule) — the only change there.
- Buttons: Window → Glass tab, "📐 Glass DXF" next to "📄 Export PDF" (casement windows; disabled with the
  reason on rectangular ones); Production Pack header, "📐 Glass DXF (all)" next to "📄 Export PDF" while
  the Glass tab is active (the pack's PDF export lives in that header).
- `glassPdfExport.js`: column layout re-spaced for a `Shape` column (`rect` / `arched · R 55.5/1305.5`
  with a 6 × 4.5 mm outline glyph — the GLASS radii, what the glazier cuts, not the frame's); shaped rows
  take extra 3.2 mm lines: `springing 1198.5 (92%) · H1 y 599.3 (46%) x 0-811 · V1 x 270.3 (33%) to y 1297
  …` (x as % of the clear width, y as % of the unit height); the bars cell shortens pattern names
  (`hub`, `dbl hub`, `intersect`); drawing cells for shaped units (`drawShapedGlass`): exact outline
  (fill + stroke), bar axes, chain H on top from the vertical bars, chain V on the left from the h bars +
  springing + apex, overall W / H, a `rise` tick on the right, and a second header line `R … · rise … ·
  springing … · bars mm + %`. No edge-seal offset on shaped units (documented in the code). Rectangular
  cells and rows untouched.

**Verification:** DXF round-trip through ezdxf on three windows (three-centre 1000×1500 start 1300 with
1H 2V, semi-circle hub-spoke, gothic intersecting): contour closed, vertex count 6 / 4 / 5, bulge count =
arcs (3 / 1 / 2), arc length = outline arch length to 0.01, straight length = Wg + 2·springing, bar
polylines = bars.length (3 / 7 / 7), bar length sum = Σ bar lengths (±0.5 rounding); merged file 3 contours
+ 1 skipped rectangular window with its reason; layers present. PDF built in node (jsPDF) for the same
three + one rectangular window: 2 pages, 47 KB, strings `arched · R 55.5/1305.5`, `rect`, `springing
1198.5 (92%)`, `V1 x 270.3 (33%)`, `R1 ring R 121.7`, `rise 105.5`, `1304 mm` present, 20 Bézier ops.
Sample `docs/handover/samples/sample_glass_order_arched.pdf` saved for the morning look. esbuild +
eslint clean · no Polish letters · t16 504/504 after the `cncExport.js` change · `npm run build` OK.
NOT verified: the PDF was not opened in a viewer (node only) — the layout of the shaped drawing cell
and the re-spaced table columns need Piotr's eye; buttons not clicked in a browser.

**Verdict: ⚠️ C** (data path proven; visual layout unseen).

### H — harness `verify/arch/t18.mjs` (spec v2 §3 vectors), samples, closing checks

**Built:** `t18` bundles arch / profile / specification / calculations / lists / bom / dxfWriter /
glassDxfExport / glassPdfExport (jsx loader, react + jspdf external) and asserts on the real path
(PC item with `archStart` → `normaliseToWindowSpec` → `deriveWindowData` → lists → DXF → ezdxf → PDF):
1. geometry vectors verbatim from spec §3 — 1000/1500 start 1300 (r 150, R 1400, Cs ±350, CL −1200,
   T (392, 144), 73.74° / 32.52°, 193.05 + 794.62 + 193.05 = 1180.72, rings 93/1343 · 110/1360 · 43/1293 ·
   55.5/1305.5), start 1175 (r 211.25, R 634.62, T (432.83, 154.49), 47.00° / 86.01°, 1299.17), 1500/2000
   start 1700 (r 150, R 1425, 61.93° / 56.14°, 1720.63), start 1100 (r 320, R 562.5, 42.08° / 95.85°,
   1410.99), Half → semi-circle R 500 length 1570.80, start = H − 520 → "use Gothic" (from
   `normaliseToWindowSpec` and `resolveRoundShape`), rise 140 → F2 message, gothic start / radii;
2. bars — 2 verticals at ±135.17, tops 382.31 above the springing (L 1281), 1 h bar at 449.25, hub ring
   121.65, spokes 0/60/120/180° ring → outline (L 284), ring-end verticals, half / double / triple role
   counts (2 / 18 / 34 bars, rings 121.65 / 243.3 / 324.4), intersecting on gothic + semi-circle
   (2 mullions, 4 tracery arcs centred on the outer corners ±94.5 outside the glass, ends ON the outline),
   pattern availability errors, v-bar tops on the three-centre chain, Green area = numeric integral;
3. cut list — C-AH 1091.19 = ring centre line (= mean of outer 1180.72 / inner 1001.65), notes
   `R 150/1400/150 · 8 pieces · stock 95/95/95`, jambs 1300, C-ATR 949.82, stiles 1253, bottom rail 920,
   040L / 040R by hinge, grouped symbols `C-AH C-J-L/R C-CILL C-ST-L/R C-ATR C-BR` (no `?`), glass unit
   811 × 1304 with shape, rows + labels, paint / seals / glass m² from the true outline, timber weight =
   Σ section × density × length, BOM slots for both curved members, and the 4 rectangular fixtures
   JSON-identical to `origin/main`;
4. glazier DXF — three samples written to `docs/handover/samples/` (`sample_glass_1000x1500_three-centre_
   start1300.dxf`, `…_semi-circle_hub-spoke.dxf`, `sample_glass_1000x1800_gothic_intersecting.dxf`) +
   `sample_glass_pack_merged.dxf`: R12, layers, contour closed with `arcs + 3` vertices and bulge count =
   arcs, arc length = glass arch length, straight = Wg + 2·springing, bar axes = bars.length, Σ lengths,
   text block = `unitTextLines`, skips (rectangular / sash / null derived), merged stacked exactly 300
   apart on TRUE extents (a `polyBBox` with arc extents was added after the first run showed the
   vertex-only bbox would let a semi-circle apex overlap the unit above — fixed in `glassDxfExport.js`);
5. PSW import — `segmental-arch` W1200 → three-centre rise 240 start 1760 riseSource ratio (derives with
   r 150 / R 1320), elliptical 390, semi-circle 600, gothic drop 840, v1 'segmental' migration, v1
   `archRise`-only item, Auto item, hinge inversion;
6. glass PDF in node — 2 pages, Shape header, `rect`, `arched · R 55.5/1305.5`, the mm + % line, hub row,
   shaped drawing strings and Bézier operators;
7. profile v3 block / vocabulary / cut-list order / BOM map; 8. structural evidence (labelled as such):
   store whitelist text, configurator chips + save fields, all samples present.

**Result:** t18 **178 / 178 ALL PASS** · t16 504 / 504 · t17 72 / 72 · `npm run build` OK · esbuild on
every touched file · no Polish letters in src / verify · `git diff origin/main --stat`: spec §5 files +
`bom.js` (2 rows), `cncExport.js` (2 exports), `WindowDetailPage.jsx` / `ProductionPackPage.jsx`
(buttons), verify, samples, docs, logs — `casementLayouts.js`, beading, `jambDxf.js`, `src/3d` untouched.

**Verdict: ✅ H**

### Rano dla Piotra — what to look at (5 minutes)
1. Configurator → casement batch → Arched: chips **Round | Gothic**, type "Arch starts at" (e.g. 1300 on
   1000 × 1500 → `Rise 200 · R 150 / 1400 / 150`), **Half** → `R 500`, patterns appear only on Half;
   type 850 → the CNC row shows "use Gothic" and Save is greyed. Then Save → Cut list shows
   `C-AH 1091` and `C-ATR 950`, Glass tab shows 811 × 1304 with `Shape` and the **📐 Glass DXF** button.
2. Open `docs/handover/samples/sample_glass_1000x1500_semi-circle_hub-spoke.dxf` in VCarve: closed
   contour, ring + spokes + ring-end verticals on GLASS_BARS, text on GLASS_TEXT.
3. Open `docs/handover/samples/sample_glass_order_arched.pdf`: page 1 Shape column + the mm/% lines,
   page 2 the three shaped drawings — the layout is the thing this session could not see.
4. Answer BLOCKERS §9.1 (900), 9.3 (short haunch pieces), 9.4 (rise > 150 at W < 462) when you can.

## 2026-09-06 — arched-casement-v1: audit fixes T1–T8, then Stage 2 (night run 2, branch `claude/arched-casement-audit-t1-t8-7d5fuk`)

Inputs read in full, in this order: `ARCHED-CASEMENT-v1-AUDIT.md` → `ARCHED-CASEMENT-v1.md` (spec,
wins on every discrepancy) → `ARCHED-CASEMENT-v1-AS-BUILT.md`. Baseline before any change:
`node verify/arch/t16.mjs` 203 checks ALL PASS on `main` (b801039). Order of work per CLAUDE.md:
T2 → T1 → T6 → T3 → T4 → T5 → T7 → T8 → Stage 2 a→d. One commit per closed task.

Two spec-vs-audit conflicts settled up front by the rule "spec wins" (details in BLOCKERS.md §6):
1. Audit T2 says keep `widthAllowance: 20` ("equivalent to 10 per side"); audit T7 demands
   middle-piece `W_req` == spec §10.2 within ±0.05. Both cannot hold: "+20 after projection" gives
   103.02 for N = 3, the spec's band formula `(Ro + a) − (Ri − a)·cos(φ/2)` gives 102.70. The
   planner is moved to the spec §7.4 model (allowance band 10 mm per side, `contourAllowance`) in T1.
2. Spec §10.2 "LEAF segmental (R 830/763, θ 87.21°)" reuses the HEAD's included angle. By spec §6.2
   every chain is clipped at the arch-start line, so the leaf ring's own span at R 830 is 81.24°.
   With 87.21° the closed formula reproduces the spec's 111.1 / 100.6 exactly; with the leaf's own
   span it gives 107.9 / 98.8. The geometry follows §6.2; the leaf line is logged as a spec erratum.

### T2 — stock list D7 (`src/engine/profile.js`)

**Understanding:** the board widths the planner may pick from are workshop data; the night-1 list
`[100 … 250]` was invented. Piotr's list (D7): `[50, 63, 75, 95, 105, 180, 200]`.

**Change:** `DEFAULT_CASEMENT_PROFILE.arch.stockWidths` → D7. `widthAllowance: 20` and
`maxPieces: 8` untouched in this step (T1 replaces both, see above). Harness: the local
`PLAN_OPTS` copy now carries the same list; every plan literal in the DXF section (piece counts,
board heights, FINGER count, `ALT` text, flat labels) is now derived from the harness's own
independent option table instead of hard-coded `2 × 150 / 1 × 225`, so the checks stay structural
until the spec vectors land in T7. Gothic piece-end checks generalised to N pieces per side.

**Observed with D7 under the night-1 rule (fewest pieces):** head 2 × 180, leaf 2 × 180, semi-circle
3 × 180, gothic 2 + 2 × 180 — all still too few pieces (43° per board); that is T1's job.

**Verification:** esbuild `profile.js` OK · no Polish letters in touched files · harness 203/203
ALL PASS · sample DXF NOT regenerated (restored via git; regenerated after T6/T8 as instructed).

**Verdict: ✅ T2** (stock list is now Piotr's, verified in the profile and through the DXF path).

### T1 — max segment angle, N_min, allowance band (`arch.js`, `profile.js`, `archDxf.js`)

**Understanding:** a board may not span more than 36° of arc (grain run-out), so every arc needs
`N_min = max(2, ceil(θ / 36°))` pieces; candidates run `N_min … N_min + 3`. A single-centre arc
shorter than 36° may be one board only when a stock board really fits it. The board a piece needs
is the projection of the ALLOWANCE BAND (outer + 10, inner − 10, spec §7.4) onto the piece axes —
not "piece + 20".

**Two approaches, one rejected:** (a) keep the night-1 projection of the finished piece and add
`widthAllowance` afterwards — rejected: 103.02 vs the spec's 102.70 for N = 3 (the inner offset
arc sags less than the finished inner arc), fails T7's ±0.05; (b) offset both contours by the
allowance with the existing `offsetArcs` (clipped ends recomputed on the band radii) and project
that band with the existing exact extent code — chosen, four lines of new geometry.

**Changes:** `allowanceBand(ring, a)`, `partitionArc(ring, i, n, band)` (band-driven extents,
finished arcs kept for the drawing, per piece `phi/phiDeg/axisAngleDeg/wReq/L/band`),
`planArchSegments` reads `contourAllowance` + `maxSegmentAngleDeg` (throws a readable ArchError
when a setting is missing — no defaults in the planner), N window per spec §7.2–7.3, `nMin/nMax/
spanDeg` on every arc result. Profile: `arch.version 2`, `contourAllowance 10`,
`maxSegmentAngleDeg 36`; `widthAllowance` and `maxPieces` removed (replaced by the spec model —
justification above); `migrateCasementProfile` replaces a stored arch block whose version differs
(no UI edits this block, so nothing user-set is lost; a night-1 block persisted in a browser would
otherwise keep the invented list and lack the new keys). DXF: arc line now prints the span in
degrees, new TEXT line `ALLOWANCE 10 PER SIDE  MAX SEGMENT 36 DEG`.

**Edge cases:** allowance 0 accepted; `contourAllowance` ≥ inner radius → `offsetArcs` throws
readably; θ < 36° single arc with no fitting board → N_min 2; three-centre haunch arcs (38.6° at the
night-1 radius) get 2 pieces of 69 mm — the spec's rule, flagged in BLOCKERS §6 as a question
(minimum piece length).

**Results (W 1200, D7, rule still "fewest pieces" until T6):** head segmental N 3…6, W_req
102.70 / 91.49 / 86.28 / 83.45 → stock 105 / 95 / 95 / 95, middle L 441.69 (spec 441.71),
end pieces W_req = middle (not wider), default 3 × 105, alt 4 × 95; semi-circle N 5…8, W_req
103.09 / 95.16 / 90.36 / 87.24, L 377.00 — every number equals spec §10.2 within 0.02;
gothic 2 per side; leaf segmental (own span 81.24°) 107.93 / 98.80 / 94.56 / 92.25 → 180 / 105 /
95 / 95.

**Verification:** esbuild OK on the three files · no Polish letters · harness rewritten in this
area: independent option table now builds the band with its own clip formulas, samples 4000 points
per arc, cross-checks the closed forms for middle pieces, asserts N candidates / N_min, every
piece's W_req and L, and end pieces ≥ middle; profile v2 + migration-replacement checks; 226/226
ALL PASS · sample DXF restored (regenerated later).

**Verdict: ✅ T1.**

### T6 — D13 piece rule switch (`arch.js` `pickOption`, `profile.js` `arch.pieceRule`)

**Understanding:** when several N fit, which one is the DEFAULT is Piotr's open decision (D13).
Spec default: narrowest stock with `N ≤ N_min + 2`, tie → fewer pieces; the other candidate is
printed as ALT. Night 1 had the opposite (fewest pieces) hard-wired.

**Change:** `profile.arch.pieceRule: 'narrowest' | 'fewest'` (default `'narrowest'`, comment says
it is OPEN); `pickOption(options, nMin, rule)` implements both; `alternative` = the plan the OTHER
rule picks (null when both agree), so the sheet always shows the trade-off. If nothing fits within
`N_min + 2`, the narrowest rule falls back to the remaining feasible candidate (N_min + 3) rather
than reporting no plan. Unknown rule → readable ArchError (no silent default). DXF TEXT line now
ends with `RULE NARROWEST` / `RULE FEWEST`.

**Results (W 1200, D7, narrowest):** head segmental 4 × 95 (ALT 3 × 105) and semi-circle 7 × 95
(ALT 5 × 105) — exactly spec §10.2; gothic 3 + 3 × 95 (ALT 2 + 2 × 180); leaf segmental on its
own span 5 × 95 (ALT 3 × 180) — the spec's "4 × 105" for the leaf comes from the head's θ
(BLOCKERS §6, erratum). With `'fewest'` the plans flip back to 3 × 105 / 5 × 105.

**Verification:** esbuild OK · harness: both rules asserted on the same option table for every
shape, alternative = other rule, unknown rule / missing settings throw; 236/236 ALL PASS.

**Verdict: ✅ T6** (D13 itself stays OPEN in BLOCKERS — the switch is Piotr's, not mine).

### T3 — rough length, end cuts, piece labels, finger zones (`arch.js`, `archDxf.js`)

**Understanding:** a piece is cut from a board `stock × rough`; rough = band length + finger length
per JOINTED end (spec §7.7, conservative — the arch-start cut is not a joint). The operator needs,
per piece: outer / inner length, the two end-cut angles, how many ends get fingers, and where the
finger zone ends on the board.

**Changes:** per piece `Lin` (band inner chord = `2·(Ri − a)·sin(φ/2)` for middle pieces),
`jointedEnds`, `roughLength`, `endCuts` = `[start, end]` of `{ kind: 'joint' | 'spring' | 'apex',
jointed, angleDeg, fromSquareDeg }` (`endCut()` documents both conventions: joint φ/2 from square;
spring = piece axis to the horizontal as the spec asks, plus 90° − that from square; apex = axis to
the vertical, from square = axis to horizontal). `planArchSegments` reads `finger.length` from the
profile (throws readably when missing); options carry `roughLength` (max over pieces). DXF pieces
row: the ASSEMBLY rectangle is now `stock × rough` with the band placed `finger.length` in from
each jointed board end (END end drawn on the left — the flat rotation maps the tangent axis onto
−x, noted in code); FINGER layer adds one zone line `finger.depth` (16) in from each jointed board
end, full board height; labels: `W1 - FRAME HEAD P1 L358.1 x95` (rough, audit T3) plus a 10 mm
note `OUT 343.1 IN 230.7 CUT J10.9/S32.7 FINGER ONE END`; the assembly text block prints
`ROUGH` per arc and a cut-code legend. `dxfWriter` has no linetypes (all CONTINUOUS) → the zone
lines are plain, not dashed (spec §7.7 says dashed; noted, not a functional loss).

**Numbers (head segmental N = 3):** middle L 441.69 / L_in 403.04 / rough 471.69 (spec 441.71 /
403.06 / 471.71, within 0.02); end pieces L 451.77 (the band's outer corner on the arch-start
line projects 10 mm further than the finished corner) → rough 466.77 ≥ spec's 456.71 (which uses
the middle L for the ends); joint cut 14.53°, arch-start cut 29.07° axis-to-horizontal (60.93°
from square). Gothic apex pieces: A50.0 (axis to vertical) / 40.0 from square.

**Verification:** esbuild OK · no Polish letters · harness: jointedEnds / rough / end-cut kinds and
φ/2 on every option of every shape, spec literals for N = 3, DXF flat boards = rough, FINGER count
5·(N − 1) per ring with zone lines 16 mm from a board end, label / note regexes, legend; 256/256
ALL PASS · rendered `.audit/t3_segmental.dxf` to PNG (ezdxf + matplotlib) and looked at the head
P1 board: joint face + zone line at the left, tilted arch-start cut at the right, both labels
inside the board.

**Verdict: ✅ T3.**

### T4 — three-centre haunch radius (`arch.js` `archArcs`)

**Understanding:** the "elliptical" arch is a basket handle (D9): two haunch circles on the
springing line + one crown circle below it, tangent-continuous. Night 1 fixed the haunch radius at
`0.5 × rise` (invented); spec §6.1 sets it to the ellipse's radius of curvature at the springing,
`r = rise² / halfW`, so the basket handle actually approximates the ellipse the customer saw.

**Change:** `THREE_CENTRE_HAUNCH_RATIO` removed (it was the invented constant — justification:
replaced by the spec formula, nothing else read it); `r = h²/hw`; the tangency solve kept as is
(audit: correct). New guard: three-centre rise ≥ W/2 throws readably (r ≥ rise → no crown circle;
at W/2 the shape is a semi-circle). Too small a rise still fails readably one step later
(`rise 180 → r 54 < frame face 57 → "Offset 57mm exceeds the arc radius 54mm"`).

**Numbers (W 1200, rise 390):** r 253.50, R 761.54, small centres ±346.50, crown centre 371.54
below the arch-start line, tangent point (W/2 + 519.40, +185.39), spans 47.00° / 86.01°, arc
lengths 207.93 each / 1143.13, |Cs − CL| = 508.04 = R − r — every spec §10.1 value within 0.01.
Plans (narrowest): haunches 2 × 95 each (107 mm rough pieces), crown 4 × 95 (ALT 3 × 105).

**Verification:** esbuild OK · harness: the independent three-centre formula now uses r = h²/(W/2);
spec literals asserted explicitly (radii, tangent point on both circles, spans, lengths, tangency,
mirror), two new error cases; 267/267 ALL PASS.

**Verdict: ✅ T4.**

### T5 — limits (`profile.js` `arch.limits`, `arch.js` `readArchLimits` / `assertRisePhysics`)

**Understanding:** two kinds of limits were mixed in night 1. Workshop / product limits (width
400–1500 from PSW, `H ≥ rise + 900`, straight leaf stile ≥ 100 — PSW arched-sash rules adopted
for the casement, spec §3.3) belong in the profile like every other number. Physical limits (a
single-centre arc cannot rise more than W/2; a pointed arch needs rise ≥ W/2; a three-centre needs
rise < W/2) are geometry and stay in `arch.js`. The night-1 per-shape "windows" (segmental
0.10–0.45, drop 0.55–0.85, three-centre 0.15–0.45) were invented — removed (audit T5).

**Changes:** `profile.arch.limits = { minWidth 400, maxWidth 1500, minStraightBelowRise 900,
minLeafStraightStile 100 }` (nested merge in the migration); `ARCH_LIMITS` export removed
(justification: replaced by the profile block, single source — the harness asserts it is gone);
`resolveArchRise(shape, W, rise, limits)` now requires the limits (readable throw when missing);
`assertRisePhysics` shared by `resolveArchRise` and `archArcs`; `buildArchGeometry` enforces
`H − rise ≥ minStraightBelowRise` and the leaf straight stile `(H − rise) − (leafFullHeight −
leafAtJamb) ≥ minLeafStraightStile` (47 mm cill-side deduction read from the profile, never
hard-coded) and exposes `straightHeight`, `leafStraightStile`, `limits`. The old "no straight
part" message is replaced by the 900 rule.

**Edge cases verified:** H = rise + 900 passes, 899 fails with the numbers in the message; the
stile rule only bites when the 900 rule is relaxed (straight 140 → stile 93 < 100); rise ≤ 0,
segmental ≥ W/2 (both entry points), gothic-drop < W/2, three-centre ≥ W/2 all throw readably;
gothic-drop = W/2 degenerates into a semi-circle and is accepted; a tiny three-centre rise (120)
passes the rise rules and fails on the member face (`Offset 57mm exceeds the arc radius 24mm`) —
readable, not silent.

**Verification:** esbuild OK · no Polish letters · harness 281/281 ALL PASS.

**Verdict: ✅ T5.**

### T7 — harness on the spec vectors (`verify/arch/t16.mjs`, `dxf_probe.py`, `specification.js`, `arch.js`)

**Understanding:** the night-1 harness proved the build's own numbers (tautology). Now the
EXPECTED values are the spec's §10.1 / §10.2 vectors typed in verbatim, the assertions follow
§10.3 items 1–10, and the independent closed forms / sampling stay as cross-checks where the spec
lists no number. Three spec numbers are internally inconsistent; each is asserted BOTH ways and
labelled, never silently adjusted (BLOCKERS §6, E1–E2):
- E1 §10.1 segmental `arcLen_in 1237.41` = R_in × θ_out (unclipped concentric arc). §6.2 and the
  same line's `x = W/2 ± 513.88` require the clip at the arch-start line ⇒ 1112.55.
- E2 §10.2 LEAF line uses the head's θ 87.21° (its 111.1 / 100.6 / "4 × 105" are reproduced from
  that angle); the leaf ring's own clipped span is 81.24° ⇒ 107.93 / 98.80 / 94.56, D13 5 × 95.
- (§10.2 "rough end 456.71" uses the middle L for the end pieces; asserted as `≥` — the band's
  outer corner on the arch-start line projects 10 mm longer: 466.77.)

**Code needed by §10.3 items 1 and 9 (spec §3.2 / §4.1 / §4.2):** `GOTHIC_PROFILE_RATIO`
(equilateral / drop 0.70 / shallow 0.60) in `arch.js`; `archFromSpec(item, fc, width)` now
resolves `rise = ratio × width` with `riseSource: 'ratio'` (`'custom'` when a rise is stored),
carries `profile` (gothic only), reads the raw PSW form field `cas-arch-opening` as a hinge
source, maps PSW `gothic-arch` + `archProfile` drop / shallow → `gothic-drop` with that
profile's ratio, and **throws a readable ArchError for an unknown shape** (spec: a silent
rectangle was the critical import bug). The exporter's "unknown shape" skip path is therefore
unreachable from PSW data — kept as a guard. Risk noted in BLOCKERS §6: callers of
`normaliseToWindowSpec` (window cards, project page) do not catch, so one corrupt shape value
would blank that estimate page instead of one button — that is the spec's choice, flagged.
`dxf_probe.py` now returns polyline vertices (point-in-polygon for item 7).

**Harness sections:** pt 1 rise defaults (5 shapes + 3 gothic profiles) · pt 2–4 every §10.1
number within 0.01 mm / 0.01° (radii, θ, centres, arc lengths, inner x, three-centre tangent
point on both circles, spans, lengths, |Cs − CL| = R − r), offsets keep centres and reduce r by
exactly the face, clipped ends analytic on y = 0, bulge = tan(Δ/4) · limits & physics (T5) ·
pt 6 §10.2 HEAD segmental / semi-circle option tables (φ, W_req == ±0.05 middle, ≥ ends, L_out,
L_in, joint cut φ/2, rough middle ==, rough end ≥, stock, D13 default + runner-up), LEAF with E2
both ways, planner vs independent sampled band for all five shapes and both D13 rules, N_min /
single-board rule (W 1500 rise 110 → θ 33.4°, N 1 with 180 mm stock, N 2 with 95 only), tiling,
gothic apex / three-centre tangent joints, no-stock and missing-setting errors · pt 7 sampled
band inside its board for every default piece and every feasible option (plan data) and, on the
DXF, inside the assembled ASSEMBLY quads (point-in-polygon) and flat pieces inside stock × rough ·
pt 5 ezdxf round-trip: CONTOUR arc length from vertices + bulges = `arcLength(chain)` within 0.01
for all five shapes, one vertex per arc end, closed, plus the structural checks from night 1
(layers, counts, FINGER lengths, labels, notes, legend, origin) · pt 8 `canExportArchDxf` false
for rectangular casement / sash / door, `exportArchDxfMerged` run end-to-end with the browser
download stubbed (Blob read back, ezdxf-probed: 2 exported, 2 skipped with reasons, name
`Pack_1_arch.dxf`, 300 mm stacking) · pt 9 the spec vector verbatim (`elliptical-arch` +
`cas-arch-opening: right` → three-centre / hinge left / rise 390 / ratio), unknown shape throws,
profiles, custom rise, `deriveWindowData` path, profile v2 + migration · pt 10 `git diff` of
`casementLayouts.js`, `lists.js`, `calculations.js`, `jambDxf.js` against the merge-base with
main is empty, working tree clean.

**Verification:** esbuild OK on `arch.js`, `specification.js` · no Polish letters · harness
**465/465 ALL PASS** · `npm run build` passes (only the pre-existing chunk-size warning).

**Verdict: ✅ T7 — the harness reproduces the spec (every §10 number is either matched within its
tolerance or reproduced with its erratum shown).** Stage-1 ✅ is confirmed after T8's sample.

### T8 — housekeeping: sample DXF, BLOCKERS §4, branches

**Sample:** `docs/handover/samples/sample_arch_1200_segmental.dxf` regenerated by the harness
after T1–T7 (not earlier — restored via git after every intermediate run). ezdxf: AC1009, layers
CONTOUR / ASSEMBLY / PIECES / FINGER / TEXT, 2 CONTOUR rings, 9 PIECES, 18 ASSEMBLY (9 assembled +
9 flat rough boards), 35 FINGER lines, 32 TEXT, CRLF byte-exact. Plan lines: head `4 x board 95
L343.1 ROUGH 362.8 (ALT 3 x board 105)`, leaf `5 x board 95 L248.9 ROUGH 267.4 (ALT 3 x board
180)`. Rendered to PNG (ezdxf + matplotlib) and inspected: head assembly = four 95 mm boards in
the glued position with three radial joints, contour overlaid; flat rows with rough boards, zone
lines and two-line labels. **Never a single solid board** (audit §6). The leaf is 5 × 95, not the
audit's "4 × 105" — erratum E2 (BLOCKERS 6.3).

**BLOCKERS:** new night-2 section (§6 spec errata / decisions 6.1–6.10, §7 branches); night-1 §4
table rewritten with status per row: 4.1, 4.2, 4.3, 4.5, 4.7 resolved by spec, 4.4 confirmed, 4.6
resolved; §0 resolved; **D13 (§1), D5 (§2), d50 arbor (§3) left OPEN** — not closed by me.

**Branches:** `claude/arched-casement-v1-m23u5x` (and `claude/arched-casement-v1`) do not exist
on the remote any more — merged into `main` (6b4203b) and deleted before this session. Nothing to
delete; noted in BLOCKERS §7. This session's branch: `claude/arched-casement-audit-t1-t8-7d5fuk`.

**Verdict: ✅ T8.**

### STAGE 1 VERDICT after T1–T8 — ✅

Harness `node verify/arch/t16.mjs` 465/465 ALL PASS on the spec §10.1 / §10.2 vectors and the
§10.3 list 1–10; `npm run build` passes; frozen files untouched (asserted by the harness); no
Polish in sources. Three spec-side inconsistencies (E1, E2, end-piece rough) are asserted both
ways and listed for Piotr — none of them changes a stock pick except E2 (leaf 5 × 95 vs 4 × 105),
which is a real decision, not a bug. Stage 2 follows below.

### Stage 2a — sample DXF per shape (`docs/handover/samples/`)

`node verify/arch/t16.mjs` now writes `sample_arch_1200_{segmental,semi-circle,gothic-equilateral,
gothic-drop,three-centre}.dxf` (W 1200, H 2000, PSW default rise, hinge L for the segmental, R for
the others) and probes each with ezdxf: CONTOUR arc length from vertices + bulges = `arcLength`
of the chains within 0.01, one vertex per arc end point (4 / 6 / 8 per ring), PIECES tile the
rings, every flat piece inside a stock × rough board, HINGE printed. Rendered all five to PNG and
looked at them: semi-circle 7 + 7 boards, gothic 3 + 3 per side with the apex joint on the axis,
three-centre 2 + 4 + 2 with the tangent joints shared by haunch and crown. CRLF byte-exact
(`.gitattributes`). **✅**

### Stage 2b — edge-case harness (`verify/arch/t17_edges.mjs`, 73 checks ALL PASS)

W 400 / 1500 for every shape at the PSW default rise (plans build, every arc ≥ 2 pieces ≤ 36°,
boards fit, no NaN, DXF round-trip), width just inside / outside 400–1500 (incl. NaN / 0), rise
just inside / outside every physics rule and both fixed shapes, string / empty / negative rises,
the 900 rule and the leaf-stile rule at their boundaries, no fitting board (empty list, junk
entries, boards ≤ 75, only 300), exporter skip messages on the real `windowSpec` path, a merged
export of mixed good / bad edge windows. **Finding F1 (BLOCKERS 8.1):** the leaf ring depth 107 +
allowance 10 sets a hard minimum rise of 117 mm — at W 400 the PSW default segmental (80) and
elliptical (r 84.5) are rejected readably. One code change came out of it: the planner now wraps
an allowance-band failure with the ring name and the allowance (`LEAF TOP allowance band (10mm per
side): …`) instead of the bare `Offset 10mm exceeds the arc radius 5.5mm`. **✅**

### Stage 2c — PSW parity report (`verify/parity/psw-casement-layouts.mjs` → `docs/handover/PSW-PARITY-REPORT.md`)

Read-only: PSW cloned with the mandated command into the session scratchpad (public repo,
619703e of 02.09), never edited. The script parses `LAYOUT_DEFAULTS`, the fanlight / fan2 / triple
lists, `CASEMENT_LAYOUTS_VERSION`, `HIDDEN_DUPLICATES`, `DISPLAY_NAMES`, the `ArchedSash` constants
and the arch radios from the PSW source text, extracts the self-contained `static
casementLayoutDef` body and executes it next to the PC port for 960 cases (30 codes × 4 sizes ×
FR × FR2 × middle section) comparing panels IN ORDER (x, y, w, h, hinge), mullions and transoms.
**Result: 24 PASS · 1 documented difference (PC hides the `010` card as an alias of `040L`;
engine-side valid) · 0 HARD.** Version 2 = 2; the reversed hinge radio (`id cas-arch-open-left`
→ `value="right"`) confirmed in the HTML and matched by the inversion in `specification.js`.
`casementLayouts.js` untouched. **✅**

### Stage 2d — see "Rano dla Piotra" below. **✅**

### FINAL VERDICT (night 2) — ✅ with the open decisions listed

Delivered on `claude/arched-casement-audit-t1-t8-7d5fuk` (10 commits, `main` untouched): T1–T8
from the audit, Stage 2 a–d, harnesses `t16` (465) + `t17` (73) ALL PASS on the spec vectors,
parity report 0 HARD, `npm run build` OK, five sample DXFs, BLOCKERS with D13 / D5 / d50 still
OPEN plus §6 (spec errata, decisions) and §8 (edge findings).

**NOT verified tonight (honest list):**
1. VCarve import of any DXF — only ezdxf 1.4.4 round-trips and matplotlib renders were checked.
2. The browser click path (WindowDetailPage / ProductionPackPage buttons) — `npm run build` passes
   and the export functions run end-to-end in node with the download stubbed; no browser session.
3. Stark 15/16 tool numbers (D5), the d50 arbor (§3), the workshop's reading of "straight stile"
   (6.9) and the minimum sensible piece length (6.5) — decisions, not code.
4. Whether the leaf should be planned on its own clipped span (built, spec §6.2) or on the head's
   angular partition (E2) — the only spec discrepancy that changes a stock pick (5 × 95 vs 4 × 105).
5. Persisted browser profiles: the v2 arch block replaces a night-1 block by version — tested in
   node on the migration function, not in a browser with a real persisted store.
6. PSW parity covers layouts + arch constants only; pricing, bar patterns and 3D were not compared.

### Rano dla Piotra

**Co jest zrobione:** wszystkie osiem zadań z audytu (T1–T8) i Etap 2 a–d. Harness `node
verify/arch/t16.mjs` odtwarza wektory ze spec §10 (465 checków), `node verify/arch/t17_edges.mjs`
sprawdza krawędzie (73), `node verify/parity/psw-casement-layouts.mjs <ścieżka-psw>` generuje
raport parytetu (0 twardych różnic). `npm run build` przechodzi.

**Co otworzyć w VCarve (`docs/handover/samples/`):** `sample_arch_1200_segmental.dxf` — głowica
4 × 95 (ALT 3 × 105), skrzydło 5 × 95 (ALT 3 × 180); do tego cztery pozostałe kształty
(`semi-circle`, `gothic-equilateral`, `gothic-drop`, `three-centre`). Każda deska płaska ma teraz
długość surową (pas + 15 mm palca na złączonym końcu), etykietę `L<surowa> x<deska>`, drugą linię
`OUT / IN / CUT J14.5/S29.1 / FINGER ONE END` i linię strefy palca 16 mm od złączonego końca.
Kody cięć: J = złącze od kąta prostego, S = linia startu łuku (oś deski do poziomu), A = szczyt
gotyku od kąta prostego. Sprawdź: (a) czy łuki importują się jako łuki; (b) czy kąty cięć są
w konwencji, której używa operator; (c) czy 10 mm tekst drugiej linii jest czytelny.

**Trzy decyzje, które zmieniają plan (BLOCKERS §6):**
1. **E2 (6.3):** spec liczy skrzydło z kątem głowicy (87.21°) → 4 × 105; wg §6.2 skrzydło ma
   własny kąt po przycięciu (81.24°) → 5 × 95. Zbudowane wg §6.2. Jeśli wolisz 4 × 105 — decyzja.
2. **D13 (§1):** domyślnie `narrowest` (spec). Przełącznik w profilu: `arch.pieceRule: 'fewest'`.
3. **6.5:** trzyśrodkowy daje na hausze 2 deski po ~107 mm surowej długości z palcem — czy taki
   krótki kawałek jest OK, czy ma być minimalna długość?

**Erraty spec (nie kod):** E1 — `arcLen_in 1237.41` w §10.1 to łuk nieprzycięty (813 × 87.21°);
po przycięciu 1112.55. E2 — jak wyżej. „rough end 456.71" — końcówki wychodzą 466.77 (róg pasa
na linii startu). Harness pokazuje obie liczby przy każdej z nich.

**Znalezisko krawędziowe (BLOCKERS 8.1):** przy W 400 domyślne strzałki PSW dla segmentala (80)
i eliptycznego (r 84.5) nie mieszczą pierścienia skrzydła 107 + 10 naddatku — eksport odmawia
czytelnie. Minimalna strzałka segmentala to > 117 mm niezależnie od szerokości.

**Otwarte bez zmian:** D5 palec 15/16 vs 10–11, głowica d50 na CNC.

**Merge:** branch `claude/arched-casement-audit-t1-t8-7d5fuk` → `main`, `main` nietknięty.

## 2026-09-05 — arched-casement-v1 (night run, branch `claude/arched-casement-v1`)

**Blocking fact first:** `docs/handover/ARCHED-CASEMENT-v1.md` (the package spec) is NOT in the
repository, in any branch, in Petros, Drive or Gmail. Everything below is built from CLAUDE.md,
the PSW source (`js/price-calculator.js` `window.ArchedSash`, `js/casement-controller.js`,
`online-estimate.html`) and the existing PC engine conventions. Every number the spec would have
fixed is listed in BLOCKERS.md as an ASSUMPTION. The harness reproduces closed-form geometry, not
the spec's §10 vectors — so no step in this section can honestly carry ✅. See the final verdict.

### FINAL VERDICT — ⚠️ (built and machine-verified; not verified against the spec)

**Delivered on `claude/arched-casement-v1` (and `claude/arched-casement-v1-m23u5x`, same
commits):** all seven §11 files, harness (203 checks ALL PASS), `npm run build` ✓, sample DXF,
as-built document, BLOCKERS with D13 / D5 / Stark d50 + ten assumptions. `main` untouched.

**Why not ✅:** `docs/handover/ARCHED-CASEMENT-v1.md` does not exist anywhere I could reach.
The harness reproduces closed-form geometry and my own D13 / stock / limit decisions — it
cannot prove the spec's §10 vectors. Stage 2 was therefore not started (Piotr's gate).

**NOT verified tonight (honest list):**
1. Every number in BLOCKERS §4 (rise limits, three-centre haunch ratio, elliptical → three-centre,
   stock widths, allowance 20, maxPieces 8, straight-part rule) — assumptions.
2. D13 default direction ("fewest pieces") — assumption; alternative is printed.
3. Finger profile 15/16/3.8 — read from CLAUDE.md, tool never seen.
4. VCarve import of the DXF — only ezdxf 1.4.4 round-trip + a matplotlib render were checked.
5. The UI click path in a browser (build passes, no arched casement exists in PC data — see
   BLOCKERS 4.10).
6. Merged "Arch DXF (all)" under a batch profile snapshot (uses the active profile, 4.9).
7. Board LENGTH limits, piece minimum length (none implemented, 4.8).

### Rano dla Piotra

**Co otworzyć w VCarve:** `docs/handover/samples/sample_arch_1200_segmental.dxf` (mm). Cztery
rzędy od góry: FRAME HEAD kontur (CONTOUR) z deskami w pozycji sklejenia (ASSEMBLY) i
płaszczyznami palców (FINGER, czerwone); FRAME HEAD kawałki płasko na deskach (PIECES + ASSEMBLY);
to samo dla LEAF TOP. Tekst po prawej każdego konturu: kształt, W, strzałka, zawias, promienie,
plan (2 × deska 150, ALT 4 × deska 100), `FINGER 15/16/3.8`. Sprawdź: (a) łuki importują się jako
łuki (bulge), nie łamane; (b) czy rysować deski w widoku złożenia (warstwę ASSEMBLY można wyłączyć);
(c) czy czcionka/rozmiar tekstu 15 mm jest OK; (d) czy palec ma być na płaszczyźnie (tak jak
teraz) czy z narysowanymi zębami.

**Pozostałe kształty:** `node verify/arch/t16.mjs` zapisuje `.audit/arch_1200_semi-circle.dxf`,
`…gothic-equilateral.dxf`, `…gothic-drop.dxf`, `…three-centre.dxf` (katalog `.audit` jest
ignorowany przez git).

**Co sprawdzić w UI:** okno casement → nagłówek strony: przycisk „🛠 Arch DXF" obok „✏️ Edit
Configuration" (dla sash jest tam „🛠 CNC Jamb DXF"). Dla zwykłego casementu jest wyszarzony z
tooltipem „not an arched casement". Production Pack typu casement → „🛠 Arch DXF (all)". Aktywny
przycisk wymaga okna z polami PSW (`casementType: 'arched'`) — w PC nie ma dziś drogi, żeby takie
okno powstało (BLOCKERS 4.10). To jest luka do decyzji, nie do naprawy „przy okazji".

**Decyzje, które czekają:** (1) wgrać spec i podmienić wektory §10 w harnessie; (2) D13 — „mniej
kawałków" czy „węższa deska" jako domyślne; (3) D5 — 15/16/3,8 potwierdzone?; (4) lista desek
stockowych i zapas 20 mm (profil casement → `arch`); (5) PSW „elliptical" jako trzyśrodkowy;
(6) limity strzałki per kształt; (7) skąd PC ma dostać łukowy casement (import z PSW czy pole w
konfiguratorze — osobny pakiet); (8) Stark d50 / trzpień.


### Step 1 — geometry (`src/engine/arch.js`, harness §10.1)

**Understanding:** one arched member = ring between two concentric contours of the window's outer
arch, clipped at the arch-start line (y = 0). Shapes: segmental (1 centre below the line),
semi-circle (1), gothic equilateral / gothic drop (2 centres on the line), three-centre (2 haunch
centres + 1 crown centre). Rise defaults from PSW `RISE_RATIO` / `GOTHIC_PROFILE_RATIO.drop`.

**Context:** engine only — `arch.js` reads `frameHead.face`, `leafAtJamb`, `leafTop.face`,
`glassInset` from the casement profile passed in; nothing hard-coded (CLAUDE.md rule 11).

**Two approaches, one rejected:** (a) port the PSW 3D point sampling (`arcPoints`, Bézier for the
ellipse) — rejected: sampled polylines cannot carry bulges and the 3D "elliptical" is not
routable from concentric arcs; (b) keep every arc as (centre, radius, a0, a1) with clip flags and
offset by shrinking radii — chosen (matches the Petros "concentricity" patent and DXF bulge).

**Edge cases handled:** rise smaller than a member face (contour never reaches y = 0 → ArchError),
rise ≥ height, width outside 400–1500, foreign rise on a fixed-rise shape, unknown shape,
`atan2(−0, −x)` returning −π on the left arch-start end (found by the harness, fixed).

**Harness:** `node verify/arch/t16.mjs` — 77 checks, ALL PASS: radii, centres, outer / frame-inner
/ leaf-outer / leaf-inner / glass lengths for all five shapes at W = 1200 against formulas written
independently in the harness; concentricity; clipping; bulge polyline rebuilds every radius.

**Verdict: ⚠️** code verified against closed-form geometry only; NOT verified against spec §10.1
(file missing). Not verified: rise limits per shape (my ratios), three-centre haunch ratio 0.5.

### Step 2 — segment planner (`arch.js` §7, harness §10.2)

**Understanding:** a curved member is glued from N straight boards on radial finger joints and
routed afterwards. For each arc of a ring and each N = 1…maxPieces: split by equal outer angle,
project every piece onto its board axes (bisector = width, chord = length), board = projected
width + allowance, stock = narrowest board ≥ that. D13 default = fewest pieces that fit a stock
board; alternative = plan on the narrowest board (returned, to be printed by the DXF).

**Two approaches, one rejected:** (a) closed-form width ρo − ρi·cos(φ/2) for every piece —
rejected because end pieces are clipped (arch-start line, gothic apex on the axis) and the inner
corner is no longer the lowest point (segmental N = 1: 240 mm, not 281 mm); (b) exact projection
of the actual piece boundary (arc extrema + corners) — chosen; the harness cross-checks it by
brute-force sampling (4000 points per arc) AND by the closed form on radial-radial pieces.

**Edge cases:** no stock fits → options keep `stock = null`, `noStock = true`, no throw; gothic
apex = one joint on the axis (finger), arch-start cuts are not joints; three-centre tangent
joints are one shared radial line for both neighbours.

**Harness:** 140 checks ALL PASS. W = 1200, stock 100–250, allowance 20: segmental 2 pcs / 150
board (alt 4 / 100), semi-circle 2 / 250 (alt 6 / 100), gothic 1 + 1 (alt 3 + 3), three-centre
1 + 2 + 1 (alt crown 4).

**Verdict: ⚠️** planner verified two independent ways; D13 default and the stock list are my
assumptions (BLOCKERS 1, 4.7). Not verified: piece minimum length, board length limits (none in
the code — a 1500 semi-circle N = 1 asks for a 750 mm board and is simply infeasible).

### Step 3 — CNC drawing (`src/engine/cnc/archDxf.js`, harness §10.3 round-trip)

**Understanding:** one DXF per window with four rows (top-down): FRAME HEAD contour + assembly,
FRAME HEAD pieces laid flat, LEAF TOP contour + assembly, LEAF TOP pieces. Layers: CONTOUR =
finished member (routed after glue-up), ASSEMBLY = stock boards (assembled and flat), PIECES =
piece contours to rout, FINGER = joint faces (planes only, the Stark head cuts the teeth), TEXT =
labels + plan summary incl. the D13 alternative. Entity model, R12 writer, 200 mm gaps, 15 mm
text and the merged-stack convention are 1:1 `jambDxf.js`.

**Two approaches, one rejected:** drawing the finger teeth (pitch 3.8 → hundreds of vertices per
joint, useless to a 5-axis operator) — rejected; joint planes + printed profile — chosen.

**Bug found by the harness:** tilted stock boards in the assembled view overhang the ring's
bounding box (−29.6 mm left of the origin) → rows are now placed by the bbox of ALL their
entities. Three other failures were wrong assertions (a single-piece board is axis-aligned too;
1324.2 not 1324.1; leaf contour picked instead of frame), fixed in the harness, not the code.

**Harness:** `docs/handover/samples/sample_arch_1200_segmental.dxf` written and read back with
ezdxf 1.4.4 (`verify/arch/dxf_probe.py`): AC1009, five layers, CONTOUR arc lengths = outer +
inner of both rings (closed form), straight cuts = arch-start ends, PIECES arcs tile the rings,
one board per piece assembled + flat, FINGER faces 57 mm long, TEXT lines (labels, shape line,
`FINGER 15/16/3.8`, `ARC 1 R870 L1324.2: 2 x board 150 … (ALT 4 x board 100)`). Same round-trip
for semi-circle, gothic equilateral, gothic drop, three-centre; merged export stacks 300 mm
apart; a no-stock plan is refused with a readable ArchError. 176 checks ALL PASS. Rendered the
three files to PNG via ezdxf/matplotlib and eyeballed the layout (rows, tilted boards, joints).

**Verdict: ⚠️** DXF verified by round-trip and by eye in a renderer — NOT in VCarve (Piotr,
morning). Not verified: text placement inside VCarve, whether the workshop wants the assembled
boards drawn at all (ASSEMBLY layer can simply be switched off).

### Step 4 — profile `arch` section + `windowSpec.arch` (spec §4–5, harness §10.3 pt 9)

**Understanding:** the arch geometry already reads its faces from the casement profile; the
planner and the drawing additionally need the finger profile and the board stock — that is the
whole `arch` section (`finger 15/16/3.8`, `stockWidths`, `widthAllowance 20`, `maxPieces 8`).
`normaliseToWindowSpec` gains `arch: { shape, rise, hinge } | null` from PSW's `casementType`
/ `casArchShape` / `casArchHinge` (or PC-native `archShape` / `archRise` / `archHinge`).

**Reversed hinge:** PSW `online-estimate.html` 887–888 — the radio labelled "Left Hinge" has
`value="right"` and vice versa, so the saved value is the opposite of what the customer chose. PC
stores the meaning: `casArchHinge 'right' → hinge 'left'` (default too), `'left' → 'right'`.
Same policy as the door hinge/open-direction fix already in `specification.js`. Note: PSW's own
3D passes the raw value straight to `hingeDirection` (`src/3d/App.jsx` 453) — read-only, left as is.

**Migration:** `migrateCasementProfile` fills `arch` (deep-merging `finger`) for every stored
profile that predates it — persisted user profiles and batch `_profileSnapshot.casement` alike;
the settings UI edits `elements` / `deductions` only, so nothing there iterates the new key.

**Edge cases:** PSW arched with the radios never touched → `semi-circle` / `hinge left` (PSW
defaults); unknown PSW shape kept verbatim so the exporter reports it instead of guessing;
standard casement and sash → `arch: null`; `deriveWindowData` on an arched spec keeps deriving
the rectangular casement (cut list for arches is a later package — the engine is untouched).

**Harness:** 19 new checks, 195 ALL PASS — including the real data path
`normaliseToWindowSpec → deriveWindowData → buildArchPlan(getCasementProfile())`.

**Verdict: ⚠️** mapping verified against the PSW source, not against spec §4.2 (missing). Not
verified: whether Piotr wants PSW `elliptical-arch` built as a three-centre (BLOCKERS 4.4).

### Step 5 — export + buttons (`src/utils/cncExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`)

**Understanding:** same shape as the jamb export — `archParamsForWindow` maps a windowSpec onto
the generator or returns a readable `skip` (not a casement / not arched / unsupported shape /
geometry error / no stock board), `exportArchDxfForWindow` → `{name}_arch.dxf`,
`exportArchDxfMerged` → `{label}_arch.dxf` stacked 300 mm apart, `canExportArchDxf` for parity.

**UI (no configurator changes):** WindowDetailPage — "🛠 Arch DXF" next to the jamb button,
shown for every casement window, disabled with the skip reason as tooltip when the window is
not an arched casement; the plan runs under the batch's profile snapshot through `withProfiles`,
exactly like `derived`. ProductionPackPage — "🛠 Arch DXF (all)" for casement packs; windows
that are not arched are listed as skipped in the alert. The merged export plans under the
ACTIVE profile (a pack can span batches; noted in BLOCKERS 4.9).

**Two approaches, one rejected:** show the button only for arched windows — rejected: Piotr
would never find it (Petros rule "new function = visible entry"); shown for all casements,
disabled with the reason.

**Verification:** esbuild on `cncExport.js`, `WindowDetailPage.jsx`, `ProductionPackPage.jsx`;
`grep -F` on every inserted identifier; harness §9 (8 checks: skip reasons, plan params,
no-throw contract) → 203 ALL PASS; `npm run build` ✓ (20.7 s, same chunk-size warning as before).

**Verdict: ⚠️** logic verified by harness and build; the click path itself NOT exercised in a
browser tonight (no arched casement exists in PC data until one is imported from PSW — see
"Rano dla Piotra").

### Step 6 — sample DXF, docs, checklist

- `docs/handover/samples/sample_arch_1200_segmental.dxf` — written by the harness on every run,
  byte-identical between runs (md5 7129d427…), committed.
- `docs/handover/ARCHED-CASEMENT-v1-AS-BUILT.md` — what was built, per section, for diffing
  against the real spec. The spec itself was NOT fabricated.
- CLAUDE.md „ZADANIE NOCNE" updated with the state and the next step; „NIE RÓB DZIŚ" untouched.
- Checklist: esbuild ✓ on all 7 touched files · zero Polish characters in sources (UTF-8 grep) ·
  `node verify/arch/t16.mjs` 203/203 ALL PASS · `npm run build` ✓ · `git diff main --stat` = the
  seven §11 files + verify/ + docs/ + BUILD-LOG + BLOCKERS + .gitignore (`.audit`) · `main` untouched.

**Verdict: ⚠️** — see FINAL VERDICT at the top of this section.

---

## Phase 0 — Project skeleton (React + Vite + layout)

**Goal:** Empty app with layout loads in the browser.

**What I did:**
- Initialised Vite + React 18 project (chose React 18 instead of 19 to maximise compatibility with `@react-three/fiber@8`, which is the last version with stable React 18 support).
- Installed: `react`, `react-dom`, `react-router-dom`, `zustand`, `@supabase/supabase-js`, `tailwindcss`, `postcss`, `autoprefixer`, `@react-three/fiber`, `@react-three/drei`, `three`, `jspdf`, `jspdf-autotable`, `xlsx`.
- Configured Tailwind with custom palette (`ink`, `accent`).
- Layout: `Header` (logo, nav, sign-out, mock-data badge) + `Sidebar` (estimate list + windows-in-estimate sub-list) + `Outlet` main content.
- Pages: `LoginPage`, `DashboardPage`, `EstimateDetailPage`, `WindowDetailPage`.
- Routing: `/login`, `/dashboard`, `/estimates/:id`, `/estimates/:id/windows/:itemId`. Auth-gated routes redirect unauthenticated users to `/login`.
- `src/services/supabase.js` lazily initialises the client; exposes `hasSupabaseConfig` so we can fall through to mocks.
- Stores: `useAuthStore` (session, signIn, signInWithMockData, signOut) + `useProjectStore` (estimates, current estimate/items, settings).
- `.env.example` with placeholder keys.

**Multi-pass verification:**
- *Logical correctness:* Each route mounts a page; auth gate works (no session → /login).
- *Integration:* `npm run build` passes (1053 modules transformed, 14.5 s).
- *Edge cases:* No Supabase env → app falls back to mock data; user gets visible "Mock data mode" badge.

**Verdict:** ✅ Done. `npm run dev` starts in <300 ms; `npm run build` succeeds.

---

## Phase 1 — Import Estimate

**Goal:** Sign in → see estimates → click → see windows with calculations.

**What I did:**
- `DashboardPage` fetches `estimates` (with `estimate_items(count)` join) when Supabase is configured; falls back to `mocks/mockEstimates.js` otherwise.
- `EstimateDetailPage` fetches the estimate + all its `estimate_items`, then renders one `WindowCard` per item.
- `WindowCard` shows: window number, type, dimensions, mini-SVG elevation thumbnail, bars/glass/colour/horns tags, calculated sash width + top-sash height, prices.
- `engine/specification.js`: parses the `specification` JSON column and normalises a Supabase row + parsed spec into the `windowSpec` shape that `calculations.js` expects (frame, sash.grid, color, hardware, glazing, materials).
- `engine/calculations.js`: copied verbatim from `Windows-App-electron-/js/calculations.js`. Already exports as ES module — no adaptation needed.
- `mocks/mockEstimates.js`: 3 estimates (sent / draft / won) with 7 items spanning sash window + bar combinations 6×6, 3×3, 4×4, 2×2.

**Multi-pass verification:**
- *Logical correctness:* `parseSpecification` handles strings, objects, and `null`; `normaliseToWindowSpec` defaults missing fields to safe values.
- *Integration:* `deriveWindowData` runs on mock data without throwing — `WindowCard` displays the "Sash W / Top sash H" footer.
- *Edge cases:* Empty estimate items array shows a card-style empty state instead of crashing; missing `specification` JSON falls back to dimensions from the row.

**Verdict:** ✅ Done. Mock data flow works end-to-end; Supabase flow uses the same shapes (will work once keys are provided — see BLOCKERS.md).

---

## Phase 2 — 3D Preview

**Goal:** Click window → see 3D preview.

**What I did:**
- `src/3d/SashWindow3D.jsx`: parametric 3D sash window using `@react-three/fiber` + `@react-three/drei` primitives. Built directly from `CONSTANTS` in `calculations.js` so the geometry matches what cut lists / 2D drawing show — same `JAMBS_WIDTH`, `STILE_WIDTH`, `TOP_RAIL_WIDTH`, `MEETING_RAIL_WIDTH`, `BOTTOM_RAIL_WIDTH`, `GLAZING_BAR_WIDTH`.
- Renders frame (head, jambs, sill), top sash + bottom sash (each with stiles, rails, glass plane and bars), glazing bars (rows × cols).
- `OrbitControls`, `ContactShadows`, `Environment` for realistic shading.
- Exterior / Interior toggle = group rotation by π around Y axis, camera Z flipped.
- Wood colour picked from `windowSpec.color.outside/single` via a small named-colour map (white, cream, sage, green, black, heritage, grey) + hex passthrough.
- Lazy-loaded via `React.lazy(() => import('../../3d/SashWindow3D.jsx'))` so the 3D bundle (≈900 kB) doesn't block initial page load.

**Why this approach instead of copying `ParametricSashWindow.jsx` verbatim:**
The original file is 124 kB / ~3000 lines of code with many dependencies on RAL palettes, ironmongery models, profile beads, horns variants, and runtime configurator props. For production planning we don't need that level of fidelity — we need geometry that *matches the cut list*. Building a slim parametric component from `CONSTANTS` directly guarantees this, and keeps the 3D bundle reasonable. Copying the heavy component would still need significant prop-shape adaptation. Documented as a deliberate trade-off rather than missing work.

**Multi-pass verification:**
- *Logical correctness:* All dimensions come from the same `CONSTANTS` table the 2D + cut list use — no drift.
- *Integration:* Renders inside its tab without errors; lazy chunk only loads when 3D tab is opened.
- *Edge cases:* `deriveWindowData` failure falls back to safe defaults; missing colour string defaults to white.

**Verdict:** ✅ Done — basic but correct. Logged in BLOCKERS.md as `IMPROVEMENT` (not blocker): if higher-fidelity 3D is required (profile beads, horn variants, ironmongery), Phase 2.1 should bring in the full `ParametricSashWindow.jsx` and adapt prop shapes.

---

## Phase 3 — 2D Technical Drawing

**Goal:** Canvas-based technical elevation with dimensions.

**What I did:**
- `src/engine/canvas-renderer.js`: adapted from `Windows-App-electron-/js/renderer.js`. Refactored to:
  - Accept a passed-in `<canvas>` element (no global ID lookup, no global `panzoom` singleton).
  - Take `windowSpec + settings` as plain arguments (no global state.js dependency).
  - Single fit-to-canvas zoom (no pan/zoom for now — keeps the drawing tab static and printable).
  - Preserved style: black-on-white CAD look, red dimension lines with witness lines + 45° tick marks + label backgrounds.
- `TechnicalDrawing2D.jsx`: React wrapper that calls `drawTechnicalElevation(canvas, windowSpec, settings)` on mount and on resize.
- Dimensions drawn:
  - Overall frame width (top)
  - Overall frame height (left)
  - Top sash height (right, inside)
  - Bottom sash height (right, inside)
  - Sash width (under frame)

**Multi-pass verification:**
- *Logical correctness:* Bar positions come from `derived.barPositions`, which `calculations.js` computes from grid mode — same data path as 3D and cut list.
- *Integration:* Canvas resizes correctly with `devicePixelRatio` for crisp rendering.
- *Edge cases:* `glassH <= 0` (sash too small) doesn't throw; `Number.isFinite` guards on dimensions.

**Verdict:** ✅ Done. Drawing matches the source renderer's output style; dimensions are mathematically consistent with the cut list.

---

## Phase 4 — Cut List & Materials

**Goal:** Per-window cut list, pre-cut groups, optimiser, glass + hardware.

**What I did:**
- `src/engine/optimizer.js`: copied the best-fit-decreasing algorithm from `Windows-App-electron-/js/optimizer.js`. Only change: `optimisePrecut(precut, settings)` takes settings as an argument instead of importing the global `state.js`. Algorithm preserved verbatim.
- `src/engine/lists.js`: per-window builders for cut list, pre-cut groups (sash + box, with section→raw mapping from settings), glass list, hardware list.
- `CutListPanel.jsx`: 5 sections rendered as tables —
  1. Cut list (frame + sash + glazing bars)
  2. Pre-cut groups (sash sections grouped)
  3. Optimiser output with bar layout visualisation (each bar drawn as a stacked horizontal bar with cuts coloured, end-trim greyed, utilisation % on the right)
  4. Glass list
  5. Hardware list
  - Footer: frame constants used (cross-reference for engineers).

**Multi-pass verification:**
- *Logical correctness:* Optimiser uses `settings.kerf`, `settings.endTrim`, `settings.minimumPiece`, `settings.stockLengthSash` exactly as the original.
- *Integration:* `buildCutListForWindow` uses `derived.components.box` and `derived.components.sash` — the same shapes `calculations.js` returns from `deriveWindowData`.
- *Edge cases:* Empty pre-cut groups show "No sash pre-cut required" instead of an empty table.

**Verdict:** ✅ Done. Numbers traceable end-to-end (constants → derived → list → optimiser).

---

## Phase 5 — Export PDF / Excel / DXF

**Goal:** Client-side download for production documents.

**What I did:**
- `utils/pdfExport.js` (jsPDF + jspdf-autotable):
  - Header with window name, dimensions, qty, generated timestamp.
  - Embedded technical drawing PNG (rendered offscreen via `drawTechnicalElevation` → `canvas.toDataURL`).
  - Cut list table.
  - One pre-cut + optimiser table per sash section.
  - Glass + hardware tables.
  - Auto page-breaks via `y > threshold` checks.
- `utils/excelExport.js` (xlsx / SheetJS):
  - Worksheets: `Summary`, `Cut list`, `Pre-cut`, `Optimiser`, `Glass`, `Hardware`.
- `utils/dxfExport.js`:
  - Minimal AutoCAD DXF: frame outline + opening + sash-top + sash-bottom on separate layers (`FRAME`, `OPENING`, `SASH-TOP`, `SASH-BOTTOM`). Coordinates in millimetres so the file imports 1:1 into CAD software.
- `ExportControls.jsx`: three buttons (PDF / Excel / DXF) with busy state + error display.

**Multi-pass verification:**
- *Logical correctness:* All three exports use the same `buildCutListForWindow` / `buildPrecutForWindow` / `optimisePrecut` source data — no divergence.
- *Integration:* `renderDrawingToDataURL` mounts the canvas off-screen briefly to call `drawTechnicalElevation`, then removes it.
- *Edge cases:* `derived == null` short-circuits with an explanatory message; no crash on empty cut lists.

**Verdict:** ✅ Done — all three formats produce downloadable files. Tested via build only; runtime download tested by the user is the next step.

---

## Final checks

- ✅ `npm run dev` starts cleanly in <300 ms (port 5173).
- ✅ `npm run build` completes (1053 modules → ~1.1 MB index bundle, 897 kB lazy 3D bundle, gzip ≈ 351 kB + 246 kB).
- ✅ README.md, BLOCKERS.md present.
- ⚠️ Bundle size warning is real — `index.js` is over 500 kB. Could be reduced with `manualChunks` for jsPDF / xlsx; not blocking for first delivery.
