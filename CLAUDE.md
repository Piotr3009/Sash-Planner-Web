# CLAUDE.md: TURA PC · DOORS TO PRODUCTION (single and french)

This file is the brief for ONE overnight tura in this repo (`Piotr3009/Sash-Planner-Web`, Production Core, "PC"). If your session was started for a different task, ignore this file.

---

## RAMKA DLA PIOTRA (owner box, binding)

Piotr czyta tylko tę ramkę przed startem. Reszta pliku mówi to samo po angielsku, ze szczegółami.

**Rama drzwi**
1. Drzwi otwierane na zewnątrz: rama identyczna jak casement. Lico 68, głębokość 93, wręb 21, land 47, luz 4, cill 68x93 z 41 widocznymi na zewnątrz.
2. Drzwi otwierane do wewnątrz: ta sama rama, cill bez wrębu 40 do 35 (jak zaplanowano wcześniej).
3. Próg aluminium albo low profile: bez drewnianego cilla, próg liczony w sztukach, osobne wiersze dla single i double.

**Skrzydło**
4. Głębokość 57 (61 przy triple, jak casement). Stile 94, top rail 94, bottom rail 180, mid rail 94. Meeting stile w drzwiach francuskich 100 (94 plus 6 lip), osobny wiersz w Assign Materials.
5. Szerokość: single = W minus 102. French: połowa = (W minus 102) / 2, każde skrzydło = połowa plus 6. Luzu na środku na razie nie liczymy.
6. Wysokość: z drewnianym cillem H minus 98 (47 plus 4 plus 6 plus 41), w obu kierunkach otwierania. Bez drewnianego cilla H minus 57.
7. Przykład single 900 x 2100: skrzydło 798 x 2002, szkło 633 x 1751. Przykład french 1600 x 2100: połowa 749, skrzydło 755 x 2002, meeting stile 100x57, szkło 584 x 1751 (takie samo jak bez lipu).

**Szkło**
8. Standard drzwiowy: double = 6x12x6 (24 mm), osobny wiersz "Door Glass 6-12-6". Slim, triple i Laminate / Acoustic 24.8 jak w oknach, na wierszach okiennych.

**Styl**
9. Full glass jak dziś. Half glazed: mid rail 94, oś w połowie wysokości skrzydła, pod nim panel. Three quarter: szkło to górne 3/4, mid rail poniżej, pod nim panel.
10. Panel: 2 x 18 Tricoya MDF plus zwykła MDF w środku (grubość środka do potwierdzenia, przyjmujemy 18). Panel siedzi w tym samym wrębie co szkło (11.5 na stronę).

**Fanlight nad drzwiami (transom)**
11. Otwierany fanlight: kontynuacja casement, czyli skrzydło casement (64 / 64 / 67 x 57) z okuciami i uszczelkami jak casement. Stały fanlight: jak dziś, szklony w ramę.

**Okucia (produkty Winkhaus z BJ Waller)**
12. Zawiasy: 3 na skrzydło drzwiowe, 4 gdy skrzydło wyższe niż 2100.
13. Single door: 1 zestaw ThunderBolt (multipoint single door kit), 1 cylinder, 1 komplet klamek.
14. French z dwiema klamkami (lockType double): 1 zestaw FGTE double door kit (master, slave, shootbolty), 2 cylindry, 2 komplety klamek. Wariant wysokości z wysokości skrzydła.
15. French z jedną klamką (lockType single): 1 ThunderBolt na skrzydle czynnym, 2 rygle na skrzydle biernym, 1 cylinder, 1 komplet klamek.

**Reszta**
16. Uszczelki, listwy przyszybowe, silikon, taśma, klipsy, packery, farba: jak casement, na skrzydło. Zużywki i farby na tych samych wierszach co casement, nie dublujemy.
17. Assign Materials: sekcja Doors z własnymi wierszami na drewno, szkło 6-12-6, panel, okucia, progi. Pre-cut łączy elementy, które mają ten sam materiał.
18. Rysunki, PDF, 3D i paczka doprowadzone do stanu casement. Jedna tura, agenci wedle potrzeby, koniec na PR bez merge.

If anything below seems to conflict with this box, the box wins. If the box itself is unclear for a case you meet, do not guess: skip that case and write it in `BLOCKERS.md`.

---

## 0. Why this tura exists

The door engine (04.08 to 09.08.2026) cuts frames and leaves, but a door reaches the BOM as glass and paint only, has no Assign Materials section, no hardware, unfinished sheets, broken PDFs and a 3D that disagrees with the engine. The owner decided on 08.10.2026 (box above) to take single and french doors to full production. `docs/handover/DOORS-AUDIT-2026-10-07.md` is the file by file audit behind this brief; read it first.

---

## 1. How to run this tura

1. Run autonomously. No questions. If something is unclear or outside the scope below, skip it and write it in `BLOCKERS.md`.
2. Start from the current `main`. Work on a branch named `claude/doors-production`. Commit per stage. Open a PR to `main`. Do not merge. Do not push to `main`. No force push.
3. Code, comments and UI copy in English.
4. Every NEW file starts with the Skylon Development Ltd header. Copy it from `src/engine/partColours.js`.
5. In text you write (comments, logs, UI copy, PR text) do not use the em dash or en dash characters. Hyphens are fine.
6. No new dependencies. Do not remove or rename existing functions or UI the owner uses. If you believe one of these is needed, do not do it: write it in `BLOCKERS.md`.
7. `deriveWindowData()` is the single source of truth. Components never calculate per-window data on their own. Every number a sheet, the 3D or a PDF prints must come from the derived data or from the door profile, never from a literal in the component.
8. Zustand stores: no ES6 getter properties.
9. A grep is not proof. Prove every claim with the harness on derived data, and test the component (the sheet) that reaches the screen, not only the geometry under it.
10. Subagents: read-only agents for the Stage 0 sweep; one agent per independent area in Stages 4 and 5 is allowed ONLY on disjoint files (sheets, 3D, pack), never two agents in the same file; at the end one independent review agent that has not seen your work. It re-derives the box numbers by hand, confirms that no assertion was weakened or deleted, reads the fixture diffs and opens the rendered sheets. Fix what it finds and record its verdict in `BUILD-LOG.md`.
11. Order of value if the night runs short: Stages 1, 2, 3 and 7 are the product (numbers, BOM, hardware, tests). Stage 4 next. Stages 5 and 6 last. Never leave a stage half applied: finish it or revert it and report.
12. Do not edit this file.

---

## 2. Scope

**In scope**: everything in the box for `windowSpec.category === 'door'`: profile, engine, Assign Materials, BOM, pre-cut, cut list, hardware, sheets, PDFs, pack tabs, 3D, configurator fixes, tests, logs.

**Out of scope, do not touch**: sash and casement engines and numbers (casement code is reused for the fanlight, not changed); the bSuite export; the settings cloud sync mechanics (`windowProfileStore` load / save, `projectStore.saveSettings`); the Dashboard and the welcome page; pricing (`engine/pricing.js`); arched doors, front doors, sliding and bifold (decided out on 07.09.2026); PSW.

---

## 3. The door model (binding numbers)

All values live in `DEFAULT_DOOR_PROFILE` (`src/engine/profile.js`) and nowhere else. Where the box says "like casement", copy the casement value and comment the source.

### 3.1 Frame

- `frameDepth 93`, `elements.frameHead / frameJamb / frameCill / transomRail face 68`.
- `geometry`: `land 47`, `rebate 21`, `gap 4`, `gapCill 6`, `cillVisible 41`, `glassInset 11.5`, `glazingRebate 18` (as casement).
- `deductions.leafAtJamb 51` (land 47 + gap 4), `leafFullHeight 98` (51 + 6 + 41), `leafNoThreshold 57` (51 + 6).
- Inward: `cillInward { faceInternal 40, faceExternal 35 }` stays; the leaf height is the SAME `leafFullHeight 98` in both directions (box item 6). The door rebate flips to the interior as today.
- Coupling post stays `136 x 93` (2 x 68), side panel members stay `57 x 57` fixed leaves (not in the box: unchanged, report as 5.2).
- Transom rail stays 68, cut `totalWidth - 2 x 68`.

### 3.2 Leaf

- `leafDepth 57`, `leafDepthTriple 61`.
- `elements.leafStile 94`, `leafTop 94`, `leafBottom 180`, `leafMid 94`, NEW `leafMeeting 100`.
- Width: single `leafW = W - 2 x 51`. French: `half = (W - 2 x 51) / 2`, `leafW = half + frenchLip` with NEW `frenchLip 6` (replaces `frenchOverlap`; keep the old key readable for stored copies). No centre clearance value (owner: later, after tests; leave a commented profile key `frenchClearance 0` that the engine honours when set).
- Member list per french leaf: `D-STILE (hinge) 94`, `D-MEETING STILE 100` (new cut list name, new code `D-MS`), `D-TOP RAIL 94`, `D-BOTTOM RAIL 180`, plus `D-MID RAIL 94` (code `D-MR`) when the style has a panel. Single leaf: `D-STILE (L)`, `D-STILE (R)`, rails. Rail lengths stay the full leaf width (as today, `lengths.*Deduct 0`).
- Glass width: `leafW - (stileL - inset) - (stileR - inset)` where the meeting stile counts 100. Glass height full glass: `leafH - (94 - inset) - (180 - inset)`.
- Style `half-glazed`: mid rail axis at `leafH / 2`. Style `three-quarter`: the glazed zone is the top three quarters: mid rail axis at `0.75 x leafH` from the top. Glass height = (axis - 47) - 94 + 2 x inset. Panel height = (leafH - 180) - (axis + 47) + 2 x inset; panel width = glass width. Panel in the same 11.5 rebate as the glass.
- Panel build (box item 10): two boards `Tricoya MDF 18` and one `MDF core` (profile `panel.coreThickness 18`, flagged). Materials: `d_panel_tricoya_18` in m2 counted twice per panel, `d_panel_mdf_core` in m2 once per panel.
- Bars: `door.bars.h / v` and `barType` work exactly like casement bars on a leaf (bar grid helper, astragal or georgian beading rows, bar runs on the glass order). `sidePanels.barsH / barsV` likewise on the side panel leaves. `transom.bars 'match'` copies the door bars onto the fanlight.

### 3.3 Fanlight (door transom)

- Fixed (`transom.type 'fixed'`): as today, glazed into the frame: glass `W_frame - 2 x (68 - inset)` by `transomH - 2 x (68 - inset)`.
- Opening (`transom.type 'opening'`): a casement top-hung leaf in the transom zone, built with the CASEMENT profile values: members 64 / 64 / 67 x 57 (`getCasementProfile().elements.leaf*`), leaf width `W_frame - 2 x 51`, leaf height `transomH - 2 x 51` (51 at the head as the width rule, 51 at the rail: the rail is rebated like the head). Flag the rail lap for the owner's drawing check (5.4). Glass by the casement rule (`casementGlassDeduction`, 64 / 67). Hinges and lock from the casement engine picks (`selectCasementHinges`, `selectCasementLocks`), seals and consumables by the casement per-leaf rules, and the casement Assign Materials rows for that hardware. Cut list names `D-FAN STILE (L) / (R)`, `D-FAN TOP RAIL`, `D-FAN BOTTOM RAIL`, mapped to the casement leaf part ids (`c_sash_stile`, `c_sash_top_rail`, `c_sash_bottom_rail`) so they buy the casement leaf timber.
- The engine must not build a transom on a single door unless the spec asks for it; the configurator keeps offering it for french only. Leave both as they are and make spec comment 455 true (engine: `transom.type` is honoured for any door type).

### 3.4 Glass

- `src/engine/specification.js`: `DOOR_GLASS_MAKEUP.double = '6x12x6'`, `DOOR_GLASS_THICKNESS` becomes a map `{ double: 24, double_slim: 16, triple: 28 }`; slim and triple take the WINDOW makeups (`GLASS_MAKEUP`); the Laminate / Acoustic rule (`isAcousticUnit`) applies to doors too (24.8, window acoustic row, 24.8 clips). Remove the door exclusions at `bom.js` 241 and `specification.js` 36 comment.
- BOM rows: door double on NEW `d_glass_double_6_12_6`; door slim on `glass_double_slim`, door triple on `glass_triple`, door acoustic on `glass_acoustic` (window rows, box item 8).

### 3.5 Hardware (Winkhaus, BJ Waller; owner links of 08.10.2026)

Products are per-window ironmongery slots the owner fills in the configurator (`windowSpec.hardware.slots`), with Assign Materials rows for the counts. Add catalogue categories `cylinders` (windowType door) and keep `doorHandles`, `doorHinges`, `multipointLocks`, `thresholds`, `bolts`. Quantities (box items 12 to 15):

| Door | Rows and counts |
|---|---|
| every door leaf | `d_hinges`: 3, or 4 when leafH > 2100 |
| single | `d_lock_single_kit` (ThunderBolt 5-point single door kit) 1, `d_cylinder` 1, `d_handle_set` 1 |
| french, lockType `double` | `d_lock_double_kit` (FGTE double door kit) 1, `d_cylinder` 2, `d_handle_set` 2 |
| french, lockType `single` | `d_lock_single_kit` 1 (active leaf), `d_bolts` 2 (passive leaf, top and bottom), `d_cylinder` 1, `d_handle_set` 1 |
| threshold aluminium | `d_threshold_alu_single` or `d_threshold_alu_double` 1 pc |
| threshold low-profile | `d_threshold_low_single` or `d_threshold_low_double` 1 pc |
| opening fanlight | casement hinge and lock rows from the casement picks |

Variant attributes the engine computes per door and prints in the hardware detail rows and the purchase list note (the buyer selects them on the BJ Waller page):
- Handing from `hingeSide` and `openDirection` as `LH` or `RH`; the Winkhaus wording is "anti-clockwise closing" (LH) / "clockwise closing" (RH). Print both words. Flag the mapping for the owner (5.5), the handing diagram PDF is on the product page.
- ThunderBolt: door thickness variant `56` (leaf 57), backset from profile `hardware.backset 45` (45 or 55), faceplate `radius` (profile), keeps `full length` (profile).
- FGTE double door kit: height band from the LEAF height against the page's bands: slave-only bands 1818 to 1964, 1965 to 2161, 2162 to 2611, 2612 to 3061; master and slave bands 2108 to 2161, 2162 to 2181, 2182 to 2378, 2379 to 2611, 2612 to 2828, 2829 to 3061. Profile `hardware.fgteShootbolts 'slave'` (or `'both'`) picks the family; slave backset `45` (35 or 45), lock centre line `22` (12 or 22) from profile; shootbolt keep cill option `yes` when the door has a timber cill. All four defaults flagged (5.5).
- Cylinders for a FGTE pair: note "keyed alike".

Weights: compute the door leaf weight the casement way (timber kg/m by member, glass by m2) and report it in `derived.weights` and the hinge detail row for information. Door hinges are an owner product, not a ladder: no automatic size selection; flag the load question (5.5).

### 3.6 Consumables, seals, beading, paint (box item 16)

Per door leaf, side panel leaf and fan leaf, the casement rules: glazing bead = pane perimeters x 1.15 on NEW `d_glazing_beading` (door bead profile, own row); astragal ext / int, bead tape 1 mm / 2 mm, silicone 0.1 tube per m, glazing packers 8 per pane, clips per unit type (door double 24 mm = `c_glass_clips_double`, acoustic = `c_glass_clips_laminated`, triple = `c_glass_clips_triple`), frame seal and head and jambs seal x 1.10 by seal colour: all on the EXISTING casement rows (`c_silicone`, `c_bead_tape_1mm/2mm`, `c_glazing_packer`, `c_glass_clips_*`, `c_seal_*`, `c_triangle_beading_ext`, `c_georgian_middle_beading`). Paint on the casement rows `c_paint_*` with the existing area model on `totalWidth x totalHeight`. Say so in the row hints ("also doors").

### 3.7 Threshold extension and cill

- `door.thresholdExtension` (the door form field) replaces `cill.extension` for doors in the cill length and in the sill extension board rows; `cill.wider` is not a door field: ignore it for doors.

---

## 4. Work, in this order

### Stage 0: baseline and sweep (no code changes)

1. Run every harness in `verify/arch/t*.mjs` and `verify/parity/*.mjs` on the starting commit. Record the pass count per file. `npm run build`.
2. Read `docs/handover/DOORS-AUDIT-2026-10-07.md`. Confirm each cited line on your commit; note drift.
3. Derive the reference set with the live engine and keep the numbers as the "before" table: single 900 x 2100 outward standard; the same inward; the same aluminium threshold; single half-glazed and three-quarter; french 1600 x 2100 lockType single and double; french with side panels 500 / 500; french with transom 450 fixed and opening; single with bars 2 x 1; controls: a casement 040L 1000 x 1200 and a sash window.
4. Write it as the first part of a new entry at the top of `BUILD-LOG.md`.

### Stage 1: profile, settings, snapshot

1. `DEFAULT_DOOR_PROFILE` per section 3, `schema 2`, with a `migrateDoorProfile` in the casement style (a stored copy below schema 2 gets the new values only where it still equals the old default; a hand edit is kept).
2. Store: door profile in `windowProfileStore` next to sash and casement (`door` key), saved and loaded with `windowProfiles` through the existing path; `setActiveDoorProfile` wired on hydrate, cloud load and every edit; `withProfiles(sash, casement, door, fn)` with the door snapshot read from `batch.defaults._profileSnapshot?.door` wherever the two others are read (grep every `withProfiles(` call). Keep the two-argument call shape working.
3. Window Settings: a "Doors" card in the style of the casement card: frame faces, depths, land / rebate / gap / cill, leaf faces incl. meeting and mid rail, panel boards, french lip, hinge rule (count and the 2100 threshold), hardware defaults (backset, faceplate, keeps, FGTE shootbolts, centre line), fan rule. Replace "Doors, soon" in `AppSidebar.jsx` 228. No new layout language: reuse the casement card components.

### Stage 2: engine (`deriveDoorWindow`)

1. Widths and heights per 3.1 and 3.2 for single and french; `D-MEETING STILE 100` row; `D-MID RAIL` and panel for the two styles; glass per leaf zone; bars; weights; seals; beading; consumables; hardware picks (counts and variant attributes) in `derived.door.hardware` with the same shape idea as `derived.casement.hardware` (summary per part id plus detail rows).
2. Fanlight per 3.3, with casement picks.
3. Threshold product selection per 3.5 and the threshold extension per 3.7.
4. Side panel leaves: unchanged members, now with glass bars, seals, beading, consumables like a leaf.
5. Keep `derived.door.zones` complete for the sheets and the 3D: add `meetingX` (centre line), the lips, the mid rail axis, the panel rect, the fan leaf rect and hinge positions (3 or 4, spacing 200 / centre - 100 / 150 as the sheets use today) so the sheets and the 3D stop computing their own.
6. Stale comments in calculations 1177 to 1192 and profile 639 to 641 brought up to date.

### Stage 3: Assign Materials, BOM, pre-cut, cut list

1. `materialAssignmentStore.js`: `DOOR_PARTS` with sections Frame (`d_frame_head 68×93`, `d_frame_jamb 68×93 x2`, `d_frame_cill 68×93`, `d_frame_cill_inward 40×93`, `d_coupling_post 136×93`, `d_transom_rail 68×93`), Leaf (`d_leaf_stile 94×57 x2`, `d_leaf_meeting_stile 100×57`, `d_leaf_top_rail 94×57`, `d_leaf_bottom_rail 180×57`, `d_leaf_mid_rail 94×57`), Panel (`d_panel_tricoya_18` m2, `d_panel_mdf_core` m2), Side panel (`d_side_stile 57×57 x2`, `d_side_top_rail`, `d_side_bottom_rail`), Glass (`d_glass_double_6_12_6` m2; the window rows for slim, triple, acoustic are shown read-only as "shared with windows"), Beading (`d_glazing_beading` m), Ironmongery (`d_hinges`, `d_lock_single_kit`, `d_lock_double_kit`, `d_cylinder`, `d_handle_set`, `d_bolts`, `d_threshold_alu_single`, `d_threshold_alu_double`, `d_threshold_low_single`, `d_threshold_low_double`), with hints that state the counting rule of 3.5. Append to `ALL_PARTS`. Section labels with the multiplication sign as the casement rows do.
2. `MaterialAssignmentsPage.jsx`: the Doors branch replaces "coming soon", same `PartGroupSection` pattern; ironmongery groups filtered to the door categories plus cylinders; a note under Consumables and Paint: "Doors use the casement rows".
3. `bom.js`: `ELEMENT_TO_PART_ID` for every D- name incl. the new ones and the fan names; a door block in `buildWindowPartQtys` (timber via pre-cut mm, beading, consumables, seals, clips, packers, glass row per 3.4, panel m2, paint on `c_paint_*`, hardware counts per 3.5, sill extension boards); `buildWindowHardware` and `windowHardwareDetailRows` for doors (slot products, counts, variant notes); `HARDWARE_TO_SLOT_KEY` door entries.
4. `lists.js`: the box branch at 257 widened to `D-` so door frame members take the assigned material and merge with other door timber of the same material (box item 17); `buildHardwareList` door lines; cut list keeps the hinge / meeting / active / passive notes per row (today they are dropped when rows merge: keep merging, append the notes).
5. `partSymbols.js`: distinct symbols for `D-FRAME HEAD` (DFH), `D-FRAME JAMB` (DFJ), `D-FRAME CILL` (DFC), `D-COUPLING POST` (DCP), `D-TRANSOM` (DTR), `D-MEETING STILE` (DMS), `D-MID RAIL` (DMR), side panel members (DSS, DST, DSB), fan members (DFS, DFT, DFB). `partColours.js`: a door family mirroring the casement colours (frame head, jambs, cill, post, transom, leaf stiles, meeting stile, rails, mid rail, side panel, fan) with a legend sheet like the casement one.
6. `optimizer.js`: an over-length guard: a piece longer than the stock length is reported, never silently dropped (a jamb with a transom can exceed 3700).

### Stage 4: sheets, PDFs, pack

1. `DoorElevation2D.jsx`: side panel bars from `sidePanels.barsH/barsV`; handle dimension from the correct datum; opening symbol apex at the hinge like casement; styles drawn from the zones (mid rail, panel, no glass below); meeting lips 6 drawn and noted; opening fanlight drawn as a leaf; threshold named; hinge positions from derived; header comment updated.
2. `DoorFrameDetail2D.jsx`: fix the layer chain (`43 / -43`), the head / jamb 68 labels, the cill dimension with a transom; show section depth and rebate; inward cill text from the profile.
3. `DoorLeafDetail2D.jsx`: glass unit size from the schedule, handle and lock position, meeting stile 100 with the lip, mid rail and panel with D-codes, bolts on the passive leaf; french draws BOTH leaves (active and passive) or one with a clear mirrored note plus the meeting detail; hinge rule from derived.
4. New `DoorSidePanelDetail2D.jsx` and `DoorFanlightDetail2D.jsx` (or tabs of the leaf sheet) for the side panel leaf and the fan leaf.
5. `DoorSection2D.jsx`: the plan view: frame 68 x 93 with the 21 rebate, leaf 57 in the rebate with the 4 gap, french meeting with the two 6 lips and the 100 stiles, swing arcs, active / passive, inward / outward; all numbers from the profile and derived.
6. New door glass drawing in the Glass tab (window page and pack), replacing the sash Upper / Lower cards for doors; Glass Drawings PDF for doors; bars on the glass order (`glassPdfExport.js`); `glassDxfExport.js` accepts doors.
7. `DrawingsPanel.jsx` and the capture rig: Elevation PDF and Elements PDF mount the DOOR sheets; `elementsPayload.js` door plan supported; uploaded sections fallback available for doors.
8. `WindowDetailPage.jsx`: a door spec panel instead of the sash "Calculated" block; BOM tab hardware for doors; depth 93.
9. `ProductionPackPage.jsx`: Elevations and Elements tabs render door sheets; Glass tab door drawings; spraying list rows per door leaf and frame; Overview columns for doors (type single / french, style, lock, threshold); Pre-Cut shows the assigned material.

### Stage 5: 3D (`src/3d/components/door/`)

1. Drive the 3D from the door profile and derived zones: leaf 94 / 94 / 180 x 57, mid rail 94 and panel per style (replace the grown bottom rail), meeting stiles 100 with 6 lips (replace the 34 overlap), land 47 passed as today (now consistent with the engine), leaf sizes W - 102 and the height rule incl. no-cill thresholds, side panel rails 57, hinge rule from derived, active leaf the same as the engine (today opposite), glass 24. Keep the handle at 1000 unless derived says otherwise.
2. One coupling post 136 instead of two abutting frames only if it does not require rewriting `DoorSidePanel`; otherwise keep and report.
3. Render the reference set headless if a Chromium is available in the environment (do not download one) and save PNGs under `docs/handover/samples/doors/`; otherwise say so.

### Stage 6: configurator

1. Save `frameDepth 93` for doors (lines 587, 786); prefill `doorPaneling` correctly (line 374); keep glass chips double / slim / triple with the spec chips; `thresholdExtension` flows per 3.7; no new fields.

### Stage 7: tests

1. New `verify/parity/t41_doors_production.mjs` with the reference set of Stage 0 and the box literals: single 900 x 2100: leaf 798 x 2002, stiles 94x57 L2002, top 94x57 L798, bottom 180x57 L798, glass 633 x 1751, makeup 6x12x6, thickness 24; no timber cill: leaf 2043; french 1600 x 2100: leaf 755 x 2002, meeting stile 100x57, hinge stile 94x57, glass 584 x 1751 and the identity "glass equals the 749 leaf with two 94 stiles"; half-glazed single: glass 633 x 883, panel 633 x 797, D-MID RAIL 94x57 L798; three-quarter: glass 633 x 1383.5, panel 633 x 296.5; hardware counts per 3.5 for single, french single-lock, french double-lock, with hinge 3 and 4 (leaf 2150); FGTE band for leaf 2002 (1965 to 2161 slave-only by default); threshold rows; BOM part qtys: every D- part maps, the glass row ids per type, the shared casement rows carry the door consumables, paint on `c_paint_*`; pre-cut: door frame and leaf members of one assigned material land in ONE group; fanlight opening: casement leaf 64 / 64 / 67, casement hinge and lock picks present; controls: casement and sash deep-equal to the starting commit.
2. Sheets: render the door sheets for the reference set the way `verify/arch/lib/sheets.mjs` does; no NaN; the glass printed equals the schedule; the meeting stile prints 100; the plan view renders.
3. Migration: a stored door profile below schema 2 comes out per section 3; a hand-edited value stays.
4. `t37_single_window_bom.mjs`: replace the "doors have zero hardware" pins with the new truth and explain each change in `BUILD-LOG.md`. Never weaken or delete an assertion to get a pass; fixtures regenerate only after reading the diff; sash and casement fixtures byte-identical.
5. `t30_preview.mjs` and `t40_bottom_rail_3d.mjs` stay green; add a door 3D mesh check (leaf 94 / 180, meeting 100) in the t40 style.
6. Full suite twice on the final tree, then `npm run build`. Record the pass counts per file.

### Stage 8: logs, review, PR

1. Independent review agent per rule 10. Fix findings; record the verdict.
2. `BUILD-LOG.md` entry: verdict, before / after tables, suite counts. `BLOCKERS.md` entry with section 5. `docs/handover/DOORS-PRODUCTION.md`: as built, the model of section 3 in one page, and what PSW would have to port (frame 68 / 47, leaf 94 / 180 x 57, french lip 6, glass 6x12x6).
3. PR description: the owner box numbers first, then summary, files changed, suite counts, the items for Piotr.

---

## 5. Items to report to Piotr in `BLOCKERS.md` (short, numbered)

1. **What happens at merge.** Every door is recalculated (leaf W - 102 instead of W - 94, height H - 98 instead of H - 94, glass 6x12x6). Quoted doors move; no batch is frozen.
2. **Side panels** stay 57 x 57 fixed leaves; a casement-style fixed light (64 / 64 / 67 dummy sash) would be the alternative. Fixed fanlight stays frame-glazed; the casement rule (dummy sash) would be the alternative.
3. **Panel core thickness** assumed 18 and the panel in the 11.5 rebate; confirm.
4. **Fan leaf rule** transomH - 102 (51 at the head, 51 at the rail); confirm on the drawing.
5. **Hardware defaults**: handing wording (anti-clockwise / clockwise closing), door thickness variant 56, backset 45, faceplate radius, keeps full length, FGTE shootbolts slave-only, centre line 22, cill keep yes with a timber cill; hinge load limits for the chosen door hinge (leaf weight is reported).
6. **French centre clearance** left at 0 by owner decision; profile key ready.
7. **Threshold seal** (bottom seal for aluminium / low-profile thresholds) not counted: say if a row is wanted.
8. **Trickle vents on doors**: the slot shows in the configurator; not counted in the BOM: say if it should be.
9. Anything skipped, with the reason.
