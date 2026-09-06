# BLOCKERS.md

Open questions, missing inputs, and improvements deferred for review by Piotr.

---

## 2026-09-06 — NIGHT 7 (zadanie nocne 7), stages on the rebased branch `claude/zadanie-nocne-7-glass-dxf-wb0eay`

Entry gate re-run after `gothic-full-v1` landed on `main` (e037020): both markers 1 — §20 above is CLOSED, the
night ran. Open items from the stages:

### 21. Stage 1 — glass DXF for every unit: erratum and decisions taken

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 21.1 | **Brief erratum: "okno 133 → 3 jednostki"** | Layout `133` is "3 Lights + Fanlights" (`casementLayouts.js` LAYOUT_NAMES), so the engine orders **6** units: 3 fanlights 434.3 × 337.2 + 3 lights 434.3 × 815.8. t28 asserts the engine's 6, and additionally `130` (3 lights, no fanlights) → 3 units — the layout the brief's number actually describes | FYI — the engine is right; no code follows the brief's 3 |
| 21.2 | **The arched sash file grows** | `sample_glass_sash_1000x2200_semi-circle_hub-spoke.dxf` now carries 2 units: the arched upper AND the rectangular lower 733 × 962.5 the glazier previously only saw on the PDF. This is the point of the stage ("ONE file with all the glass"), so the gate's "kształtowe bajt w bajt" was verified as: whole-file identity for the four ALL-shaped windows, and per-unit entity identity for the shaped unit of this mixed window | FYI — confirm in the morning that the glazier wants the lower unit in the same DXF (it is what the brief says) |
| 21.3 | **Bands are not clipped at crossings** | A vertical band runs the full height of the unit and a horizontal band the full width; they cross. The shaped path (`barBandCurves`) has always drawn whole bands, and the glazier reads one continuous bar — the glass PDF sketch, by contrast, breaks them at the crossing | Should the DXF break the bands at the crossings like the PDF sketch does? Not done — the shaped units would have to change too |
| 21.4 | **Double-hung bar rule** | Sash units keep the sash-frame placement (wood bar centres, `computeGlassBarPositions`): 6x6 on a 733 wide unit gives axes 244.8 / 488.2, NOT the equal splits 244.3 / 488.7 a casement would give. This matches the glass PDF and the 2D sheets exactly | FYI — the two documents now agree by construction |
| 21.5 | **Samples the stage did NOT produce** | `sample_arch_*`, `sample_arch_c5_*`, `sample_circle_1000_sunburst`, `sample_sash_arch_1200_*`, `sample_tracery_gothic` changed on this branch because **gothic-full-v1** (e037020) landed without regenerating them (labels moved below the piece, tracery always full); the harness run refreshed them | FYI — the repo's samples now match the code again |

---

## 2026-09-06 — NIGHT 7 (zadanie nocne 7) NOT STARTED — entry gate failed (branch `claude/zadanie-nocne-7-glass-dxf-wb0eay`)

### 20. [CRITICAL → CLOSED 06.09 by e037020] `gothic-full-v1` was not in this repository — the first night-7 attempt stopped before any code

CLAUDE.md opens night 7 with a hard gate: "Sprawdź na starcie, że `gothic-full-v1` jest na `main` … Jeśli nie —
STOP, wpis w BLOCKERS." Both markers are 0, so nothing was implemented. **No source file was touched tonight.**

**Evidence (in the order it was gathered):**

| # | Check | Expected | Result |
|---|-------|----------|--------|
| a | `grep -c "mode = 'full'" src/engine/cnc/traceryExport.js` | > 0 | **0** |
| b | `grep -c "labels BESIDE the piece" src/engine/cnc/archDxf.js` | > 0 | **0** |
| c | Both strings anywhere in `src/` + `verify/` | present | **0 hits** |
| d | `git log -S"<string>" --all` for both strings | a commit that adds them to the engine | **only `0801c78 "Update CLAUDE.md"`** — the strings exist solely inside the gate sentence in CLAUDE.md; the code they look for has never been committed here |
| e | `git ls-remote --heads origin` | a gothic-full branch | 9 heads, **none** is gothic-full / arch-pieces; remote `main` = `0801c78` = this branch's base (the local `origin/main` ref was stale at `78ac6f5`) |

**The behaviour matches the greps — it is the feature that is missing, not just a renamed string:**

- **"traceria zawsze cała"** — `traceryExport.js:579-584` still resolves the mode by `auto`
  (`mode = straddles ? 'full' : 'quadrant'`), so a half board is still produced, and line 696 still prints
  `TRACERY QUADRANT (LEFT HALF - MIRROR FOR THE RIGHT)`. The committed sample
  `docs/handover/samples/sample_tracery_dwg_R600_quad-hub-spoke.dxf` is exactly such a quadrant board; under
  "tracery always full" it would have been regenerated as FULL.
- **"napisy pod kawałkami"** — `archDxf.js:300-303` (`piecesRow`) still writes both label lines ON the piece
  (centred at `x + roughDrawn / 2`, over the trapezoid band), not beside / under it.

**The other 06.09 package IS in** — `arch-pieces-v1` passes night 6's own entry gate on this tree
(`pieceStockTrapezoid` 4 in `archDxf.js`, `glazingRebate` 1 in `profile.js`, "Tracery LSP" 0), and the trapezoid /
pre-cut code carries the 06.09 comments. So one of the two chat packages landed on `main` and the other did not.

**The base is healthy, just one package behind:** the tree is the night-6 tree bit for bit — `node verify/arch/t16.mjs`
… `t27.mjs` give the night-6 numbers exactly (t16 368, t17_edges 70, t18 178, t19 244, t20 116, t20_bars 32,
t21 120, t22 77, t23 81, t24_stage4 26, t25 201, t26 36, t27 64 = **1613 checks, ALL PASS**) and `npm run build`
is green (17.95 s). Nothing is broken; the gate is simply not satisfied.

| # | Item | Ask for Piotr |
|---|------|---------------|
| 20.1 | **Re-send / apply `gothic-full-v1`** | The package was delivered in the 06.09 chat and never reached the repo (Piotr pushes by hand — `arch-pieces-v1` from the same chat did land). Apply it to `main`, then night 7 can run against the base its gate describes |
| 20.2 | **Or: is the gate stale?** | If gothic-full-v1 was in fact applied under different wording, the two grep markers in CLAUDE.md are wrong and must be replaced with markers that really exist — say which two strings to use |
| 20.3 | **Honest engineering note — the four stages look file-disjoint from the missing package** | gothic-full-v1 touches `traceryExport.js` + `archDxf.js`. Night 7 stage 1 touches `glassDxfExport.js` + two pages, stage 2 the 2D sheets, stage 3 `profile.js` / `calculations.js` (doors), stage 4 `src/3d` + `windowSpecToConfig`. No overlap, so the night could technically run on this base. I did not do it: the gate is explicit and doubled (CLAUDE.md + tonight's start instruction), and two stage gates take baselines — stage 1 "kształtowe bajt w bajt … snapshot z `sample_glass_*`" and stage 2's t19 / t22 rect snapshot rebase — that would be frozen against a base you are about to change. **If you want the night run on this base anyway, one line in the next brief is enough** ("run night 7 without the gothic-full gate"), and the stage-1 / stage-2 baselines then have to be re-checked after gothic-full-v1 is applied |
| 20.4 | **Nothing from stages 1–4 was started** | Glass DXF for rectangular units, the dimension rule on Leaf / Elements / sash sheets, the door option B (land 43 / `leafAtJamb` 47 — note this also settles §19.1), and the 3D check after the 68 frame (§19.9) all remain open, unchanged |

---

## 2026-09-06 — ARCHED-WINDOWS-v4 night 6, Stages 1–4 = Blocks C / B / E / F (branch `claude/arched-windows-v4-stages-9diax6`)

Status of the older entries: **§1 D13 (piece rule) → CLOSED by v4 C.3 / C.4** (fewest pieces first, economy
alternative above the waste threshold — `pieceRule` removed from the profile); **§9.3 minimum piece length → v4
C.1 `arch.minPieceLength` 400 HARD** (was 150 warn); §2 D5 / §3 d50 / §9.1 P9 / §9.4 F2 unchanged.

### 19. Stage 4 — frame face 68 everywhere (Block F, option B): DEFAULT (open) values, consequences, questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 19.1 | **Door land / leafAtJamb** | Spec F: doors change the face (68) and the coupling post (136) only — `DEFAULT_DOOR_PROFILE.geometry.land` stays 36, `deductions.leafAtJamb` 40, so a 1000 door leaf is still 920 and a 68 door jamb shows 36 with a 32 rebate step (68 − 36), not the casement's 21. Physically odd: the same 68 × 93 section rebated 21 on a casement and 32 on a door | Should the door follow option B too (land 47, leafAtJamb 51, leafFullHeight 98, coupling post visible band 47 + 47)? One line in the profile + t27 §5 re-vector |
| 19.2 | **Stored profile migration (`frameSchema` 2)** | Piotr's tenant profile in Supabase / localStorage still holds 57 / 36 / 40 / 87 / 54. `migrateCasementProfile` now moves each of those keys to the new default ONLY when it still equals the old default; a hand-edited value stays; a copy already marked `frameSchema 2` is never touched. The migrated profile is saved back by the store on its next sync | FYI — if the workshop had deliberately set a 57 jamb in Window Settings it stays 57 (by design); press "Reset to defaults" to take the whole 68 set |
| 19.3 | **Profile snapshot per project (spec F.5 design note)** | Not built. A profile change re-derives every existing window live — the 06.09 change turns a quoted 920 leaf into 898 on the next open of an old project. `deriveWindowData()` is the single source of truth by design; freezing numbers per project would need a `profileSnapshot` stored with the project (the batch already carries `_profileSnapshot.casement` — unused by the engine) and an engine entry point that takes the snapshot instead of the active profile | Decide: (a) live re-derive (today), (b) snapshot at project creation with a "re-derive with the current profile" button, (c) snapshot at production-pack release only |
| 19.4 | **Circle 800 frame ring now needs a 200 board** | Frame ring 400 / 332 (was 400 / 343): the independent planner and the engine both give W_req 182.3 > 180 for 4 pieces → **4 × 200** (was 4 × 180); 5 and 6 pieces fit 150 but fail the 400 shorter-edge limit, so no economy alternative. The leaf ring (349 / 282) stays blocked (4 × 180 → shorter edge 371.3 < 400; was 390.1) | FYI — a real material change for the workshop (the widest board on every 800 circle) |
| 19.5 | **Economy rule C.4 with the smaller leaf ring** | 1200 three-centre rise 240 LEAF top rail at face 68: fewest = ONE 200 board (W_req 199.0, waste 56 %), the C.4 rule then takes 2 × 180 (a narrower board, waste 57.2 % — HIGHER). The rule as written compares board width, not waste; the engine and the harness follow it literally. Head: 2 × 180 fewest, no alternative (was 2 × 180 → economy 3 × 150 at face 57) | Add "AND lower waste" to C.4? (`fewest.waste > threshold && alt.waste < fewest.waste`) — a one-line change in `arch.js` + `indPlanner.mjs`, not made tonight (rule is DEFAULT (open) §16.2) |
| 19.6 | **Spec C.5 table at face 57** | The C.5 reference numbers (134.7 / 158.3 / 112.6 / 168.1 / 170.6) are the 57-frame numbers by the spec's own words ("Face 57 head ring"). t25 keeps them against a schema-1 profile variant built in the harness and checks the live 68 profile against the independent planner; the face-68 numbers are printed in the BUILD-LOG Stage 4 table | Re-issue C.5 for the 68 frame in the next spec revision |
| 19.7 | **Part Registry 68 × 93** | `materialAssignmentStore` labels the frame head / jambs `68×93` (hint names the old 57×93); the Part Registry (Supabase data) must carry a 68 × 93 raw material — no DB change in this package | Add the 68 × 93 material in Part Registry and assign it to Frame Head / Frame Jambs; old projects keep their 57 × 93 assignment |
| 19.8 | **PSW still describes a 57 frame** | Until `PSW-FRAME-68-PORT.md` is applied, PSW imports arrive with 57-based geometry; PC re-derives from its own profile (898 leaf), so the PSW estimate drawing and the PC numbers disagree by 11 per jamb | Port PSW (list of lines in the doc) and bump `window.CASEMENT_LAYOUTS_VERSION` to 3 |
| 19.9 | **3D not seen** | The `frameDims` threading (11 files) builds and its wiring is asserted by t27 §7, but no browser: the 68 frame in the viewer, the door coupling post 136 and the fanlight axis 102 are unverified visually | Open a 1000 × 1500 casement and a door with a side panel in the viewer in the morning |
| 19.10 | **`ArchedDoorWindow.jsx` / `TransomPanel.jsx`** | Not threaded (PC never renders them: arched doors and door transom panels are out of PC's scope, CLAUDE.md); they still read `FRAME_FACE` 57 from `DoorFrame.jsx` | FYI |

### 18. Stage 3 — intersecting from the vertical bars (Block E): errata and questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 18.1 | **Spec errata E4 — the gothic radius** | Spec E quotes "gothic 1000 × 1900 with 3 V bars → 6 arcs, R = 1000" and "semi-circle 1000 with 2 V → 4 arcs R 405.5 (glass)". 1000 is the FRAME radius (c + halfW on the frame numbers); on the glass, where the bars live, the outline's radius is 905.5 (PSW's own daylight formula gives 905.4). Taken: R = the glass outline's arc radius for every shape (405.5 / 905.5) — "the arch's own radius" as drawn on the glass sheet | Confirm the glass radius; if the frame radius (1000) was meant, the arcs would be flatter than the outline they meet |
| 18.2 | **PSW fix-frame parity** | PSW's fix-frame `intersectingData` (FixFrameWindow.jsx 667–830) still draws pitch mullions + corner-centred arcs for fix-only products; PC now produces the sash rule for every window type. A fix-only gothic ordered in PSW shows different tracery in PSW's viewer than PC's cut list / tracery board / glass order | Port the sash rule into PSW's fix-frame (PSW-3D-ARCH-PORT.md §8), or accept the viewer difference |
| 18.3 | **Default columns when 0 V** | ±¼ of the clear width (PSW `[-halfW/2, halfW/2]`), reported as `role 'v'` bars (they are cut as bars) while `barCounts.v` stays 0 (the user set none) | Should the schedule / cut list count the two default columns as bars (they are timber)? Today the bar run and the beading include them; the "bars" text in the schedule says the user's count |
| 18.4 | **Profile keys removed** | `arch.patterns.intersecting` (pitch 450 / 2–4 mullions / minRadius 30) deleted from the default; a stored v4 profile keeps the key inertly (merge) | FYI |

### 17. Stage 2 — glazier PDF layout (Block B): DEFAULT (open) values and questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 17.1 | **Window thumbnail on the bars page** | The frame's OUTER contour (straight part + the arch chain, or the circle) with the shaped unit filled at its place — no members, mullions or the lower sash unit drawn (a 35 mm sketch to recognise the window, not an elevation sheet). Sash windows: the box contour with the upper unit filled | Enough to identify the window, or should the leaf / lower unit outlines be added? |
| 17.2 | **Schedule page (page 1) per-unit line** | Kept as v3: springing + the bar positions for ≤ 4 bars, `k bars — see table` above — "table" now means the bars page | Drop the positions from the schedule line now that the bars pages carry them? |
| 17.3 | **Springing bar ids on the drawing** | `S1 / S2` (hub patterns) sit at the outline's springing corners, next to the right-hand overall-height dimension line (as in v3) | Move the springing ids inside the unit, or drop them from the drawing (they stay in the table)? |
| 17.4 | **Bars page order / grouping** | Blocks in schedule order (unit index), one table per unit even when two units of one window are identical (qty 2 = two blocks) | Merge identical units into one block with "× n"? |
| 17.5 | **A3 for the single-window export** | The Window Detail page's glass PDF stays A4 (it has no format switch); the pack's export follows the pack setting | FYI |
| 17.6 | **Block taller than a page** | Never happens with the engine's patterns (≤ 20 rows ≈ 74 mm); a block taller than the content height would still start on a fresh page and overflow, not break | FYI |

### 16. Stage 1 — segment planner v2 (Block C): DEFAULT (open) values, spec errata, consequences

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 16.1 | **Spec errata E3 — C.5 reference numbers** | The piece counts and boards of C.5 are reproduced exactly (3 × 150, 2 × 180, 2 + 2 × 120, 3 × 180, 2 × 180; capped at 105 → no plan). The quoted edge lengths (HALF 1000 "outer 508.8 · inner 432", ROUND "572.5 / 468.9", …) are the v1 allowance-band chords (`L` / `L_in`), not raw-piece stock edges — the raw trapezoid of the ROUND 2-piece plan measures 621.9 / 531.9. The quoted W_req differ from the 800-point sampler by up to 4 mm (158.3 vs 155.7; 112.6 vs 108.8). t25 asserts the sampler's numbers ±0.5 and records the spec's alongside | Confirm the limits are meant on the RAW stock edges (as C.1 says) — see 16.4 for what the band-chord reading would change |
| 16.2 | **Sizes blocked by the two hard limits** (engine reports `below minimum length`, export skipped, never split finer) | gothic 1000 leaf top rail (2 per side on 120: shorter edge 386.2 < 400); circle 800 leaf ring (4 × 180: 390.1 < 400); arched SASH 1000 semi-circle box head 80 face (3 × 180: 395.5 < 400) and gothic 1000 sash head; every W 400 arch and W 470 elliptical (no piece reaches 450 — a 400 semi-circle's whole outer arc is 628). Harness samples moved to 1200 / circle 1000 | Are 450 / 400 right for the leaf and sash rings too (thinner members, tighter radii)? A 390 vs 400 mm piece decides whether a common window plans. Lower on the CNC & arches card if so |
| 16.3 | **Springing end of the raw piece: SQUARE** (DEFAULT open) | v1 cut the raw springing end horizontal (on the springing line). v4 compound pieces sit up to 26.6° to the horizontal: the horizontal cut adds 215 mm of board on the ROUND 1000 × 250 piece (outer 829 / inner 379) and fails the 400 limit on a plan the spec calls valid. Taken: the raw end is cut square at the band extent (cut code `Q`), the CNC routs the horizontal springing face with the contour (it is on the CONTOUR polyline since v1). Joints (radial, apex) unchanged | Confirm, or revert to the horizontal raw cut — then the ROUND 1000 × 250 head has NO valid plan under 450 / 400 |
| 16.4 | **Board placement on the band: centred** (arch-pieces-v1 kept) | The stock board is centred on the allowance band. Placing it flush on the INNER side (excess width outward) lengthens the shorter edge to the band's inner chord: sash 1000 head 395.5 → 410, circle 800 leaf 390 → 400.2 — both would pass 400 — and matches the spec's C.5 inner numbers | Say which placement the workshop uses when the board is wider than the band |
| 16.5 | **C.4 waste threshold 0.45** (DEFAULT open) | Waste of a curved piece cut from a straight board is 50–65 % on every semi-circle / three-centre plan, so 0.45 fires whenever a narrower alternative passes: HALF 1500 3 × 180 (63 %) → 4 × 150 (55 %), tc240 1200 2 × 180 (61 %) → 3 × 150, semi 1200 3 × 150 → 4 × 120, tc390 1200 2 × 200 → 3 × 150, circle 1000 rings. Both plans are printed on the DXF (`FEWEST … / ECONOMY ALT … -> DEFAULT …`) | Set 1.0 to always take the fewest pieces, or a threshold near 0.6 if only the very wasteful plans should switch |
| 16.6 | **C.6 CLAMPS layer** (DEFAULT open: on always, clearance 20) | Two `cnc.clamp.base` (130) squares per flat piece on layer `CLAMPS`, centred across the board, ≥ `cnc.clampClearance` (20) from both END-CUT lines (the joint planes lie 15 inside the rough ends), pushed to the two ends; one square + `WARNING … ONE CLAMP ONLY` when the room is under 260, none under 130. "From the band contour" in C.6 cannot be met across the width (the band arcs run within 7.5 mm of the board edges on a 150 board) — taken as the end-cut clearance only. A 130 square on a 120 board overhangs the edges (drawn as such). Thickness outside the jaws 40–98 → text warning (the arched sash box head, 164 deep, gets it on every drawing) | Is the footprint the base under the piece or the jaw zone? Should the layer be switchable off per window / profile? Clearance value? Boards narrower than 130? |
| 16.7 | **Sash box head thickness 164** | The arched sash head blank is 80 × box depth (164) — outside the Uniclamp jaws, so every sash arch DXF prints `WARNING: PIECE THICKNESS 164 OUTSIDE THE UNICLAMP JAWS 40-98` | How is the sash head blank held (vacuum, a different clamp, or is the head laminated from thinner boards)? |
| 16.8 | **Profile v4 migration** | A stored v3 `arch` block (36° rule, pieceRule, 150 warn) is replaced whole by the v4 default; from v4 the card edits the block, so a stored v4 block merges key by key. A tenant who had edited nothing loses nothing | FYI |
| 16.9 | **Circle rings = one closed group** | A circle ring is planned as one 360° chain on radial joints (v1: two half-rings with a mandatory joint on the diameter). 800: frame 4 × 180 (leaf blocked, 16.2); 1000: frame 6 × 150 / leaf 5 × 180 (economy) | FYI |
| 16.10 | **Grain run-out** | The 36° per-board rule is gone (v4 C.3): a 1000 × rise 200 leaf top rail is ONE 180 board 940 long (rise of the leaf contour 160 across it). No limit replaces it | Is a single-board shallow arch acceptable for the grain, or should a maximum rise-per-board (or angle) come back as a profile number? |

## 2026-09-07 — ARCHED-WINDOWS-v3 night 5, Stage 1 = Block 0 (branch `claude/arched-windows-v3-9v0sw7`)

Status of the older entries: **§9.1 P9 (900) OPEN → v3 0.6 keeps 900**, **§9.2 D13 OPEN → 'narrowest' kept**,
**§9.3 minimum piece length → v3 0.6 `arch.minPieceLength` 150 (warn)**, **§9.4 F2 OPEN → `minHaunchRadius` 150 kept**,
§1 D13 / §2 D5 / §3 d50 unchanged. §10.9 (rasteriser) verified in Chromium, §10.10 (R labels) partly fixed — see 11.9.

### 15. Stage 4 — cross-cutting (Block 4) and the project archive (Block 6): DEFAULT (open) values and questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 15.1 | **Sash glazing arch (`headType 'arch'`)** | Kept OUT of the engine (spec DEFAULT open): PSW is inconsistent with itself (2D `min(0.14·W, 150)`, 3D `7 %, 50–80`); PC's 3D and the +10 % price line stay as they were | Keep the glazing arch as a cosmetic 3D / price option, or drop it? |
| 15.2 | **Curved-member surcharge** | `DEFAULT_PRICING.archedCasement.curvedMemberSurcharge = 0` × 2 members (head + top rail; a circle's two rings) — shown in the breakdown (`curvedMembers`, `curvedPrice`), neutral until set. The arched SASH has no PC price path at all (PSW prices it) | Give the per-member number (lamination + finger joints + CNC); say if the sash needs a PC price |
| 15.3 | **Blank pieces in the pre-cut** | A curved member is pre-cut as its blank pieces: qty = pieces per arc, length = the planner's rough length (chord + contour band + finger allowance, no extra 20 mm machining), section = stock board × member depth (e.g. `95x93`), grouped by that section like any other timber; the BOM board metres follow. `makeRawResolver(name, { kind: 'blank', stock, depth })` returns that section whatever material is assigned (the assignment names the species / JC line) | Confirm the rough length rule and whether the blank boards should be a separate BOM line per stock width |
| 15.4 | **PP Curved members section** | Inside the Cut List tab (first card), per window type: window, member, shape, radii, arc length, blank plan (n × stock × depth × rough per arc), finger, short-piece warnings. No PDF export of that card yet (the cut list PDF prints the element groups) | Say whether the section belongs in the Cut List PDF or in the Pre-Cut PDF |
| 15.5 | **PDFs through the rasteriser** | Elevation / elements / glass PDFs capture the on-screen SVG sheets (`svgNodeToPng`) — the arched and circle sheets go through the same path, verified only by the harness renders, not by opening a PDF | Morning: export the three PDFs of an arched sash, an arched casement and a circle |
| 15.6 | **Archive rules** | `archived` + `archived_at` on `projects` (SQL file `docs/handover/sql/2026-09-07_projects_archive.sql`, run by hand); archive from the card: immediate when every batch's pack is complete, confirm otherwise; the project page opens read-only (no add / delete batch); packs, cut lists, exports keep working; a pack still assigned to an archived project's batch keeps its assignment (the pack card counts it with the archived project's name missing) | Should archiving also unassign / close the packs, and should windows / the configurator be locked at route level too (today only the buttons are hidden)? |
| 15.7 | **RLS check for the archive** | No Supabase test helper exists in the repo — manual check: run the SQL, archive a project as tenant A, log in as tenant B: the Archive page must be empty; restore as A: the dashboard shows it again | Do it once after running the SQL |
| 15.8 | **Parity report** | `PSW-PARITY-REPORT.md` regenerated against PSW 619703e: 23 PASS · 2 documented DIFF · 0 HARD (hinge value 1:1 per 0.4b; import ratios = PSW `RISE_RATIO`; the segmental rise at W 1200 differs — PC builds it as a three-centre with the 150 haunch floor) | FYI |
| 15.9 | **PSW `fixType` FD30 / FD60** | ignored on import (14.9) | — |

### 14. Stage 3 — fixed windows in the casement batch (Block 3): DEFAULT (open) values and questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 14.1 | **Construction of a fixed window** | `fix.construction: 'fixedLeaf'` — casement frame + a non-opening leaf with the casement leaf sections (67 × 57), glass in the leaf rebate as today. `'directGlazed'` (glass straight into the frame rebate, no leaf) is refused with a readable error: the profile has no direct-glazing rebate numbers | Confirm the fixed leaf; if the workshop glazes small fixed lights direct, give the frame rebate / glass inset and it becomes the second construction |
| 14.2 | **Cut list names for a fixed window** | Existing `C-*` names with the note `fixed leaf` (grouping and PP stay); the circle adds `C-FRAME RING` (`C-FRR`) and `C-LEAF RING` (`C-LFR`) — there is no straight member to name | Say if the fixed leaf should be a separate group on the sheet (`C-FIX *`) |
| 14.3 | **Circle radii** | Frame ring 0 → 57 (frameHead.face), leaf ring 40 → 107 (leafAtJamb + leafTop.face), glass at 94.5 (− glassInset), rebate wall at 36: the arch offsets on a full circle. 800 circle: R 400 / 343, 360 / 293, glass 305.5 | Confirm the 4 mm running gap and the 17 mm lap hold all round a circle leaf (it cannot be lifted in like a square leaf — is it screwed through the frame ring?) |
| 14.4 | **Circle blank plan** | Each half-circle of a ring is planned like an arch arc (max 36° per board → 5 pieces per half, 10 per frame ring, 14 per leaf ring at R 360 on 95 stock) — the two halves meet on the horizontal diameter with a finger joint like every other piece | Say if the workshop glues a circle from fewer, wider segments (D8 / D13 for full circles) |
| 14.5 | **Sunburst geometry** | PSW's `CircleFrame`: ring at glass R − 200 (profile `arch.patterns.sunburst.offset`, or the imported `fixCircleOffset`), 6 spokes at 0° / 60° / … from the right, spokes from the ring to the glass edge; user h / v bars are chords through the hub (PSW draws them too). No configurator field for the offset yet (profile default 200) | Confirm 200 / 6; ask if the offset should be per window in the configurator |
| 14.6 | **Circle glazing** | Glass unit 611 × 611 kind `circle`, true area π·R²; the edge cover 11 and the 18 spacer bands as Block 0; bar ends are measured from the TOP of the circle along the edge (`s from apex`) | Confirm the glazier reads a circle from the apex |
| 14.7 | **Circle limits** | Diameter within the arch limits 400–1500 (profile `arch.limits`); height locked to the width in the configurator and refused at import when different | Give a circle-specific minimum if 400 is too small for two rings (leaf ring inner 93 at 400) |
| 14.8 | **Fixed leaf weight / hardware** | Zero hardware, no hinge / lock picks, `leafWeights` null (no balance, no hinge limit) — the fixed leaf's timber still counts in `weights.timber` | FYI |
| 14.9 | **PSW `fixType` fd30 / fd60** | Imported nowhere — PC has no fire-rated construction; the value is ignored silently (BLOCKERS, not an error) | Say whether FD30 / FD60 are products PC must plan (glass spec, intumescent) |
| 14.10 | **3D of a fixed window** | Rectangle: `CasementWindow` with `casementHinges ['fixed']` (its own fixed pane, no handle); Round / Gothic: `ArchedCasementWindow` with `fixedLeaf` (handle removed, opening 0); circle: PSW's `FixFrameWindow` circle branch (frame 57 face, PSW's own bars). Not seen rendered in a browser | Morning: casement batch → Kind Fixed → each shape → 3D tab |
| 14.11 | **Circle sheets** | `CircleFixedDrawing2D` (elevation / frame / leaf) replaces the three rectangular sheets for a circle; the glass sheet draws the circle contour. The frame / leaf sheets show the ring radii, the blank plan text and Ø dims — no cut-length chains (there is no straight member) | Say what else the workshop wants on a ring sheet (piece angles? finger positions?) |

### 13. Stage 3 — arched sash drawings / exports / 3D (Block 1 F–J): findings and questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 13.1 | **3D arched sash not seen rendered** | `ArchedSashWindow` ported from PSW, outline rebuilt on `arch.js` (rule C, constant band, real rise), helper asserted in t22 §5; the component compiled (esbuild + `npm run build`) but no WebGL frame was captured in the container | Morning: sash batch → Frame shape Arched → 3D tab; compare the head band with the 2D box sheet |
| 13.2 | **3D bars follow PSW's own pattern code** | The arched sash 3D draws the pattern with PSW's `useArchedSashBars` (hub ring at PSW ratios, spokes by name) — not from the engine's `derived.arch.bars`; the counts / pattern name are the same, the ring radii can differ by a few mm from the cut list | Accept for the viewer (the cut list / glazier sheets are the engine's), or a later pass that feeds `derived.arch.bars` into the 3D like the casement does |
| 13.3 | **Box sheet subtitle sits below the viewBox** | `BoxDetail2D` prints its subtitle at a y outside the viewBox on tall windows — pre-existing on HEAD (the rectangular fixture reproduces it byte-for-byte), so left alone to keep the snapshot | Separate fix (viewBox height), not tonight |
| 13.4 | **Elevation: lower sash top under the arched upper sash** | The lower sash is drawn to the meeting line at H/2 and the upper sash from the meeting line up to the ring; the meeting rail overlap (the two 21.5 halves) is drawn as on the rectangular sash | FYI — check the elevation of a 1000 × 2200 Round sash |
| 13.5 | **Sash beading on the arched sheets** | No curved bead is drawn on any sash sheet (beading frozen, 12.5); the rectangular parting / staff bead lines stop at the springing | Same package as 12.5 |
| 13.6 | **Sash 3D fallback to PSW's sampler** | When the engine cannot offset a contour (three-centre with a haunch at the 150 floor and a deep inset), the 3D falls back to PSW's radial sampler for that ring only — the engine refuses the window earlier anyway (ArchError), so this only shows on a rise the configurator rejects | FYI |

### 12. Stage 2 — arched sash (Block 1 A–E): DEFAULT (open) values and questions

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 12.1 | **Rule C + concentric rings for the sash** | Head ring 0 → `sashArch.headFace` 80 (PSW HEAD_FACE); upper sash top rail ring at `deductions.sashWidth / 2` = 89 (the stile line) → 89 + `topRail.face` 57; glass line 133.5. The rectangular sash's head gap is ~84 (H/2 − 62.5 with the meeting line at H/2); the arched apex gap is 89 — 5 mm more clearance at the head so the ring is concentric | Confirm 80 for the curved box head (section 80 × box depth) and the 89 inset |
| 12.2 | **Vertical layout (PSW rule)** | Arch starts at H − rise from the cill, meeting line at H/2 → upper straight stile clear = H/2 − rise ≥ `minUpperStile` 100; the STILES TOP piece = clear + 21.5 (to the meeting rail bottom) + horns | Confirm the meeting line at H/2 for the arched sash |
| 12.3 | **Jambs and liners on the arched head** | Jamb = start − (`jambHeight` 108 − 80) = start − 28 (the head zone of the rectangular deduction is the ring now); head liners (int 17×86 / ext 17×102) are NOT generated — a curved liner is another curved member the spec does not name; jamb liners run to the springing | Say what the 108 is made of, whether the arched head takes liners (curved) and what the jamb really stops at |
| 12.4 | **Sash F2 — Round sash needs a deep rise** | With the top rail ring at 146 and `minHaunchRadius` 150 the inner ring needs r ≥ 10 (allowance band) → haunch r > 156 → `rise²/(W/2) > 156`: at W 1000 rise > 279 (0.28 W), at W 1500 > 342. PSW's segmental default 0.20 W is rejected with a readable ArchError; elliptical 0.325 W builds | Accept (a 200 mm rise on a 1000 sash is not a product with a 57 top rail) or lower `sashArch.minHaunchRadius` |
| 12.5 | **Beading (frozen)** | The rectangular beading records stay as they are on an arched sash (parting / staff from W and H, glazing bead from the rectangular glass). The curved parting bead along the head ring, the curved staff bead and the curved glazing bead of the upper sash are NOT generated | Separate package (beading module is frozen) |
| 12.6 | **Blank planner numbers** | The sash reads `getCasementProfile().arch` (stock widths, finger, allowance, max angle, piece rule, minPieceLength) — one place for the CNC's numbers; a separate sash copy would drift | Confirm, or ask for a sash copy |
| 12.7 | **Glass list rows for the arched sash** | `customGlassUnits` path (casement style): upper row with `shape.kind 'arched'` (bars from the engine), lower row rectangular (sash − 89 × lower − 108). The double-hung rows' pane / bars text (grid mode) does not apply — the arched sash has counts, not `2x2` grids | FYI — the Glass tab shows two rows named upper / lower |
| 12.8 | **Cord / weights** | `weights.upperKg` / `lowerKg` (+5 %) from the true outline are new fields; the cord length rule (3 × H) is unchanged; no balance selector exists in PC yet | FYI |
| 12.9 | **PSW `lowerVBars`, `upperMaxDrop`, `lowerMaxLift`, `straightHeight`, `upperSashHeight`** | Ignored on import: PC derives the straight height and the sash heights itself; PSW's `upperSashHeight = (H − 144)/2` is the 3D's own layout | FYI |
| 12.10 | **Configurator not run in a browser** | Compiled (esbuild + build) and linted; the shared `archControls` fragment renders inside both the casement and the sash section; the 3D preview of an arched sash is still the rectangular sash (Stage 3 I) | Morning: open a sash batch → Frame shape Arched |

### 11. DEFAULT (open) values taken tonight and questions for Piotr

| # | Item | Taken | Ask |
|---|------|-------|-----|
| 11.1 | **0.2 `glass.edgeCover[type]`** | `DEFAULT_CASEMENT_PROFILE.glass.edgeCover = { default 11, double 11, double_slim 11, triple 11, single 11, passive 11 }`; `barWidth 18`. The DXF / sheet / PDF read the value for the unit's glass type | Give the triple-unit spacer perimeter (or confirm 11); one profile value, no code |
| 11.2 | **0.6 `arch.minPieceLength` 150** | New profile key. A finished piece shorter than 150 mm is listed in `plan.shortPieces` (the 1000 × 1500 start-1300 head: 6 of 8 pieces) — never blocked, nothing changes in the plan. Not printed on the DXF sheet yet (text block untouched) | Decide the length (or 0 = off); say if the DXF TEXT block should print the warning |
| 11.3 | **0.6 confirmations** | `arch.limits.minStraightBelowRise` 900, `arch.pieceRule` 'narrowest', `arch.minHaunchRadius` 150, `deductions.leafAtJamb` 40 — all unchanged, asserted in t20 §7 | Confirm |
| 11.4 | **0.4 tracery `quad-hub-spoke` — the vertical spoke runs through the hub** | `arka_CNC-piotr.dxf`: the hub pane 4D3 is cut at x = centre − 11 and MITRE 586 sits on that corner → a 22 mm bar runs down the centre INSIDE ring 1; the 45° spokes do not enter the hub. Built as `HUB_PRESETS['quad-hub-spoke'].hubVertical = true` (this preset only; PSW hub-spoke / double / triple keep the open hub, BLOCKERS 9.6 / 9.7) | Confirm the centre bar through the hub is intended (or is it only the mirror cut of the quadrant program?) |
| 11.5 | **0.4 quadrant board edge at centre + 7** | DWG OUTLINE 4D6 runs to x = centre + 7 = edge margin 18 measured from the hub pane edge at −11. Reproduced: the quadrant board edge is treated as a BOARD edge (18 from the pane), the axis as a BAR edge. When the two mirrored programs meet, the outline cut at +7 would pass through the centre bar timber | Is the +7 edge machined, or only the arc + bottom? If the operator does not cut it, nothing changes; if he does, say and I move the cut to the axis |
| 11.6 | **0.4 quadrant vs full on engine windows** | The DWG is a fanlight (board bottom = springing). Every PC casement keeps the rectangular part below the springing; hub patterns ignore the user's verticals (PSW rule 9.6), so the lower pane always straddles the axis → every engine window exports in **full** mode (13 panes for quad-hub-spoke + 1V). Quadrant mode is exercised by the DWG harness case only | Accept full mode for casements (one board, no mirroring), or allow a user vertical at the axis under a hub (9.6) so the quadrant applies |
| 11.7 | **0.4 tracery board = the whole daylight** | Spec: board outline = leaf glass daylight (leaf-top ring inner edge, stiles' and bottom rail inner edges) — for a 1000 × 1500 casement that is a 786 × 1279 board with one big lower opening (or several with h bars). The tracery board of the DWG covers the arch only | Confirm the board covers the full daylight, or should it stop at the springing (arch only, the lower part left to straight astragals)? One line in `boardFromOutline` |
| 11.8 | **0.4 `C-TRACERY` section / BOM** | Record `C-TRACERY` (`C-TRY-P1`), qty = `tracery.sides` (1), section `boardThickness x blankW` (18 × bbox W + 2 × 10 allowance), length = blank H, notes `blank W x H · pattern · N panes · mode`; BOM slot `c_tracery` added to the casement sash part list ("Tracery Board", section shown as `18×blank`). `tracery.boardThickness` 18 is a DEFAULT (open). Cut list group `C-TRY` after `C-BR`. Paint area adds the board face minus panes × sides | Give the board thickness and the material (hardwood / plywood?) — assign in Assign Materials |
| 11.9 | **0.5 R labels** | Leaf sheet: every R label now inside the daylight (the haunch `R 110` collided with the top-rail `67` chain dim). Elevation / frame sheets: unchanged (looked at the PNGs: the left `R 150` sits beside the `rise 200` dim, no overlap). Subtitle of the arched elevation drops the layout code (`Casement · arched · 1000 × 1500`). 3D guides: `rise … mm` + new `start … mm` guide on the left | Piotr's eye |
| 11.10 | **0.5 rasteriser / clipPath** | The elevation SVG (hub-spoke, bars clipped with `clipPath`) was loaded through an `<img>` data URL in headless Chromium — the same mechanism as `svgNodeToPng` — and rendered with the bars clipped. The jsPDF page itself was not produced in a browser | Morning: Drawings → Elements PDF once, to close 10.9 |
| 11.11 | **0.4b PSW label wording (PSW-side question)** | `online-estimate.html` 887–888: the radio LABELLED "Left Hinge" carries `value="right"`, group "Opening Direction". PC now takes the VALUE 1:1 (identity mapping, no inversion) — `casArchHinge right` → PC `hinge right` → layout 040R; both 3Ds render the same. Estimates saved before tonight from PSW with `casArchHinge` now open on the other side in PC than before | Decide on the PSW side whether the label or the value is wrong; PC does not touch it |
| 11.12 | **0.4 intersecting + user verticals** | `intersecting` keeps the user's v bars AND its own mullions (PSW port, 9.6): with v = 1 the user bar runs through the tracery arcs at the axis. t20_bars accepts it as PSW behaviour | Say if the user verticals should be suppressed under `intersecting` like under the hubs |
| 11.13 | **0.4 custom hub** | `custom` = spokes 3–9 (evenly springing → springing), rings = fractions of the half width (text field `0.3, 0.6`), saved as `archSpokes` / `archRings` (store whitelist, PSW has no counterpart — a PC-only pattern, never exported to PSW). The 3D takes the same numbers through `archSpokes` / `archRings` props (App.jsx shared with PSW: two more keys, port doc line) | FYI |
| 11.14 | **New files outside the spec's list** | `src/engine/glassBars.js` (bands / edge / bar-end rows shared by sheet, PDF, DXF), `verify/arch/t20.mjs`, `verify/arch/t20_bars.mjs`, `docs/handover/samples/sample_tracery_*.dxf / .lsp` (5 tracery samples incl. the DWG reproduction). `dxfWriter.js` gained the POINT entity (ARKA_CENTRE); `materialAssignmentStore.js` the `c_tracery` slot; `App.jsx` / `ArchedCasementWindow.jsx` / `archedCasementGeometry.js` / `windowSpecToConfig.js` the custom-hub props | FYI |
| 11.15 | **Tracery: pane collapse** | A pane whose offsets cross (a very acute corner under the 11 / 18 offsets) is dropped with a `WARNING` text on `ARKA_INFO_NO_CUT` and in the export alert — never silently. None of the harness windows (hub / quad / custom / gothic intersecting) collapses | FYI |
| 11.16 | **LSP not run in AutoCAD** | The LSP is plain AutoLISP (`entmake`, `-LAYER`, no ActiveX) parsed back by a tokenizer against the DXF entity list; the DXF is read back by ezdxf. Neither was opened in AutoCAD / VCarve (no CAD here) | Morning: APPLOAD `sample_tracery_dwg_R600_quad-hub-spoke.lsp`, type `ARKA`, overlay on `arka_CNC-piotr.dxf` |


## 2026-09-06 — arched-casement-v2 night 4 (D + E + F + t19, branch `claude/arched-casement-v2-def-enkyue`)

Status of the older entries: **§9.1 P9 (900) OPEN**, **§9.2 D13 OPEN**, **§9.3 minimum piece length OPEN**,
**§9.4 F2 (rise > 150) OPEN**, §1 D13 / §2 D5 / §3 d50 unchanged. §9.14 (windowSpecToConfig) is closed by F below.

### 10. Open after night 4 (for Piotr)

| # | Item | What was built | Ask |
|---|------|----------------|-----|
| 10.1 | **Window detail / capture 3D still rectangular for arched windows** | `WindowPreview3D.jsx` and `Window3DCaptureRig.jsx` render `CasementWindow` for every casement. `windowSpecToConfig` now emits everything `ArchedCasementWindow` needs (`casementType`, `casArchShape`, `archRise`, `archProfile`, `barPattern`, `archMinHaunchRadius`, `archPatterns`), but the two viewers were outside the spec's file list and were not touched | A six-line switch in each viewer (`config.casementType === 'arched' ? <ArchedCasementWindow …> : <CasementWindow …>`) — say yes and it is a small package |
| 10.2 | `src/3d/App.jsx` touched (shared with PSW) | five `update3D` keys stored, bucketed and handed to the component — without them F never reaches the configurator's 3D. PSW's own App needs the same lines (port doc §3) | FYI |
| 10.3 | **3D bars sit on the 3D leaf face (64), production on the profile (67)** | the 3D builds from its own constants (`CasementFrame` / `CasementPanel`, PSW parity), so the 3D daylight is 104 in and the engine's glass outline 94.5 → a vertical bar at a third of the clear width lands ~2 mm from the production position. Only the preview | accept, or let the 3D read the casement profile faces (breaks byte parity of `CasementFrame.jsx` with PSW) |
| 10.4 | **3D drawing floors** | a three-centre haunch must be deeper than the deepest ring drawn (leaf inner 104 + bead 10 = 114) and the frame must be at least `rise + 125` high (leaf straight part), else the rings cannot be offset. PC passes the profile minimum 150 which wins; a PSW copy without the prop draws segmental / elliptical arches with r = 114 where production has 150 | FYI — pass 150 in PSW if the previews should match |
| 10.5 | PSW `fixGothicBars: 'patternA'` | no PC counterpart (a Bezier bar in PSW) → `ArchedCasementWindow` draws no pattern for it. `intersecting` maps | FYI |
| 10.6 | Contour beads: 32 layered strips per bead (PSW 64), curved bars 64 as PSW | performance choice in the leaf; visually the same | FYI |
| 10.7 | New files outside the spec's list | `src/components/drawings/archDrawUtils.js` (one arc → SVG serialiser for four sheets), `src/3d/components/casement/archedCasementGeometry.js` (pure helper the harness can load — the component itself imports drei), `verify/arch/lib/sheets.mjs`, `verify/arch/t19_baseline.mjs`, fixture `rect-casement-sheets.json` (204 KB, full SVG strings so a snapshot failure shows a diff) | FYI |
| 10.8 | Spec §4 "text fits the viewBox (v1 guard)" | no such guard existed in t16–t18; t19 asserts every `<text>` anchor inside the viewBox (rotated text: the anchor point) | FYI |
| 10.9 | Bars clipped with SVG `clipPath` on the elevation / leaf sheet | the engine axes run to the unit edge (12.5 under the wood); the daylight clip hides that. `svgNodeToPng` (drawings PDF) rasterises through an `<img>` — clipPath is standard SVG, but the PDF was not produced in a browser tonight | morning: open Drawings → Elements PDF on an arched window |
| 10.10 | Label placement is a first pass | haunch / gothic radii outside near the corners, crown / semi-circle radii inside; glass sheet: `V1 1297` beside the bar 56 mm below its end, spokes set back along the bar, tracery ends outside the outline; frame sheet has no top member chain when arched (the head is curved) | Piotr's eye on the PNGs / screen |
| 10.11 | Leaf sheet crosses / notches | only for the straight bars (v × h crossings, ends on straight edges); a ring / spoke / tracery has no notch symbol | FYI |
| 10.12 | Frame sheet C-AH label | prints the cut-list length + planner notes (`R 150/1400/150 · 8 pieces · stock 95/95/95`) in the third title line; the first render used the fallback because the record field is `elementName` (fixed) | FYI |

## 2026-09-06 — arched-casement-v2 night 3 (A + B + C + t18, branch `claude/arched-casement-v2-impl-0j27uw`)

Status of the older entries: **§1 D13 OPEN** (unchanged — `profile.arch.pieceRule` 'narrowest', ALT printed),
**§2 D5 OPEN**, **§3 d50 arbor OPEN**, **§6.5 minimum piece length OPEN** (worse under P3, see 9.3),
**P9 OPEN** (9.1). §6.3 (E2) and §6.2 (E1) are moot — the segmental shape is gone (P2).

### 9. Open after night 3 (for Piotr)

| # | Item | What was built | Ask |
|---|------|----------------|-----|
| 9.1 | **P9 — straight height limit for the casement** | `profile.arch.limits.minStraightBelowRise` stays **900** (PSW sash rule). In the v2 configurator the rule sits on the typed start: "arch start at least 900 from the cill" (Round) / `H ≥ ratio·W + 900` (Gothic) | Give the casement number (or confirm 900) — one profile value, no code |
| 9.2 | **D13** piece rule | unchanged: 'narrowest' default, the other rule printed as ALT | decide |
| 9.3 | **Minimum piece length** (§6.5) — now sharper | Under P3 the haunch arcs are r 150 with spans up to ~90°: the 1000 × 1500 start-1300 head plans **3 pieces of ~65 mm** per haunch (rough ~98 with fingers), the 1200/240 head 2 × ~110. The angle rule (36°) forces it; nothing in the spec allows a longer board on a small radius | Is a 65–110 mm finger-jointed piece acceptable, or a `minPieceLength` (single board per haunch below it)? Profile setting, not decided in code |
| 9.4 | **F2 — Round arch needs rise > 150** | P3's `minHaunchRadius` 150 replaces the v1 F1 finding: `rise ≤ 150` leaves no crown arc (rise = r is a flat top) → readable ArchError. At W 400 the PSW defaults (segmental-arch 80, elliptical-arch 130) are rejected; **Auto (0.325 W) clears 150 only from W 462**; the configurator shows the message and disables Save | Accept (a 400-wide Round arch with a 130 rise is not a product) or lower `minHaunchRadius` (the leaf inner ring needs r > 107, the allowance band r > 117) |
| 9.5 | v1-era `segmental` windows | migrate on load to three-centre with rise **0.20 W**, riseSource **'ratio'** (spec A wording, even when a custom rise was saved). The configurator's Auto for Round is **0.325 W**, so opening such a window in the editor shows Auto = 0.325 W and re-saving moves it there; the engine uses 0.20 W until then | Only the 05.09 test windows are affected; confirm or ask for 'custom' with the 0.20 start kept |
| 9.6 | Hub patterns ignore the vertical count | PSW rule ported 1:1 (`semiBarPattern` has no user verticals on hub patterns — the ring ends are the verticals). The configurator hides the vertical chips while a hub pattern is selected and the row label prints `0V`; `intersecting` keeps the user's straight bars (as PSW) | FYI — say if you want user verticals on hubs anyway |
| 9.7 | Springing bar on hub patterns | PSW `hub-spoke` / double / triple have NO full-width springing bar — the springing is made of the two end spokes from ring 1 outward (the hub interior stays open). Only `half-hub` has the full bar. Ported as is; spec §2.3 says the end spokes "ARE the springing bar" — same reading | FYI; a full springing bar on every hub would be a one-line change |
| 9.8 | Spoke insets | PSW draws spokes from `ring + 0.6·BAR_W` to `outline − 0.4·BAR_W` (3D anti-overlap). The glazier list gives axes ring → ring → outline, exact | FYI |
| 9.9 | Shape column radii | The PDF Shape column and the DXF text print the **glass** radii (55.5 / 1305.5 for the 1000 × 1500 start-1300 window), not the frame's (150 / 1400) — the glazier cuts the glass. Identical radii are printed once (`R 55.5/1305.5`); the drawing note prints all three | confirm |
| 9.10 | BOM part slots for the curved members | `C-ARCH HEAD` → `c_frame_head`, `C-ARCH TOP RAIL` → `c_sash_top_rail` (else the BOM drops the timber). The blank is really glued from `profile.arch.stockWidths` boards (95 / 105 …), so the metres booked against the 57 × 93 / 67 × 57 slots are the arc lengths, not the board purchase — the arch DXF sheet carries the real board list | Decide whether the BOM should book the planner's boards (N × stock × rough per piece) — separate small package |
| 9.11 | `bom.js` / `cncExport.js` touched outside the spec's file list | two `ELEMENT_TO_PART_ID` rows (9.10) and `export` on `downloadDxf` / `safeName` (one download path for the glazier DXF) | FYI |
| 9.12 | Merged DXF stacking on arc extents | `glassDxfExport` stacks units on their TRUE extents (arc apex). `archDxf` / `jambDxf` `entitiesBBox` is vertex-only; the arch sheets are covered by the straight ASSEMBLY boards so no overlap is known, but a semi-circle CONTOUR alone would overlap — not touched (jambDxf is frozen) | FYI |
| 9.13 | Height rule vs the typed start | Round: the H input clamps to ≥ 901 only; the 900 rule is reported by arch.js as text ("leaves 850mm straight below the arch — minimum 900mm") and Save is disabled. Gothic: H clamps to `ratio·W + 900` as before | FYI |
| 9.14 | `windowSpecToConfig.js` (3D) | untouched: still maps PC shapes onto PSW names for the shared viewer (`three-centre` → `elliptical-arch`), so a Round arch with rise 0.20 W previews as the PSW ellipse until night 4 (F) | night 4 |
| 9.15 | Configurator not run in a browser | every UI change compiled (esbuild + `npm run build`) and linted (`no-undef`), logic proven through the same engine calls, but no click-through | morning test |

## 2026-09-06 — arched-casement-v1: audit fixes T1–T8 (night run 2)

Status of the night-1 entries below: **§0 resolved** (spec committed 06.09), **§1 D13 OPEN**,
**§2 D5 OPEN**, **§3 d50 arbor OPEN**, §4 assumptions — see the updated table, §5 Stage 2 done
tonight (BUILD-LOG). New items from night 2:

### 6. Spec errata and decisions taken by the "spec wins" rule (for Piotr to confirm)

| # | Item | What the spec says | What was built | Ask |
|---|------|--------------------|----------------|-----|
| 6.1 | Allowance model | §7.4 band: outer + 10, inner − 10 per side (`contourAllowance`); audit T2 said "keep `widthAllowance: 20`, equivalent" | Band model. "+20 after projection" gives 103.02, the spec formula 102.70 — T7's ±0.05 cannot hold with +20. Profile key is `arch.contourAllowance: 10` (per side) | Confirm 10 per side is the workshop number (D6 says so) |
| 6.2 | **E1** §10.1 segmental `arcLen_in 1237.41` | Equals R_in × θ_out — the inner arc with the OUTER angle (unclipped) | §6.2 clips every chain at the arch-start line ⇒ inner arc 1112.55 (the same spec line's `x = ±513.88` needs the clip). Harness asserts both numbers, labelled | Fix the spec line; no code change |
| 6.3 | **E2** §10.2 LEAF line "R 830/763, θ 87.21°", W_req 111.1 / 100.6, default 4 × 105 | Computed with the HEAD angle | The leaf ring clipped at the same line spans 81.24° (§6.2) ⇒ W_req 107.93 / 98.80 / 94.56 ⇒ stock 180 / 105 / 95 ⇒ D13 'narrowest' gives **5 × 95 (ALT 3 × 180)**, not 4 × 105. The sample DXF shows 5 × 95 for the leaf | Decide: leaf planned on its own span (built) or forced to the head's angular partition (joints aligned with the head — not what §7 says) |
| 6.4 | Rough length of end pieces | §10.2 "rough end 456.71" = middle L_out + 15 | The band's outer corner on the arch-start line projects ~10 mm further than the finished corner ⇒ end L_out 451.77, rough 466.77 (asserted `≥` 456.71) | Cosmetic in the spec; the DXF board is the longer, safe one |
| 6.5 | Minimum piece length | §7.2 `N_min = max(2, …)` per arc, no minimum length | Three-centre haunch arcs (r 253.5, 47°) get 2 pieces of ~107 mm rough with a 15 mm finger at one end; gothic 3 × 95 per side is fine | Is a 100 mm finger-jointed piece acceptable, or should short arcs (< some length) be one board? If yes: a `minPieceLength` profile setting, not decided in code |
| 6.6 | Unknown shape throws in `normaliseToWindowSpec` | §4.1 "shape unknown ⇒ throw" | Implemented. Callers (window cards, project page, PDF builders) do not catch, so ONE corrupt `casArchShape` value would blank that estimate page rather than one button. PSW's radios only produce the four known values, so this needs corrupt data | Accept (spec) or ask for a guarded card render — separate small UI package |
| 6.7 | Finger zone line style | §7.7 "dashed" | `dxfWriter` writes CONTINUOUS only (no LTYPE table) — plain short polylines on FINGER, 16 mm in from each jointed board end | Cosmetic; adding linetypes to the R12 writer is a separate change (jambs share it) |
| 6.8 | Shape vocabulary | §3.4 canonical `'gothic'` + `profile` and `ARCH_SHAPE_ALIASES` | PC keeps the night-1 shapes `gothic-equilateral` / `gothic-drop` (audit §2 signed the geometry off) and `PSW_ARCH_SHAPE`; `arch.profile` ('equilateral' / 'drop' / 'shallow' / null) is carried as the spec asks, PSW `archProfile` drop / shallow map to `gothic-drop` with 0.70 / 0.60 × W | Rename only if the configurator package needs the spec's names — not done "by the way" |
| 6.9 | Straight leaf stile rule | §3.3 "straight stile of the arched leaf ≥ 100" | Built as `(H − rise) − (leafFullHeight − leafAtJamb)` = straight part − 47 (gap + cill land from the profile). It never binds while `H ≥ rise + 900` holds | Confirm the 47 mm reading of "straight stile" |
| 6.10 | Profile `arch` block version | — | `arch.version: 2`; a stored block with another version (night-1 keys, invented stock list) is replaced whole by the default — there is no UI for this block, so nothing user-set is lost | FYI |

### 7. Branches

`claude/arched-casement-v1` and `claude/arched-casement-v1-m23u5x` (night 1) no longer exist on
the remote — they were merged into `main` (6b4203b) and deleted before this session; nothing to
delete. This session's work: `claude/arched-casement-audit-t1-t8-7d5fuk`, to be merged by Piotr.

### 8. Findings from the Stage-2 edge harness (`verify/arch/t17_edges.mjs`) and the PSW parity report

| # | Finding | Evidence | Ask |
|---|---------|----------|-----|
| 8.1 | **F1 — minimum rise is set by the leaf ring depth + allowance, not by the PSW ratio.** The deepest contour (leaf inner = leafAtJamb 40 + leafTop.face 67 = 107) plus the 10 mm allowance band must stay above the arch-start line, so no segmental arch with rise ≤ 117 mm and no three-centre with haunch radius ≤ 117 mm can be planned, whatever the width. At **W 400 the PSW defaults are rejected**: segmental rise 80 (0.20 × W) and elliptical rise 130 (r = 130²/200 = 84.5). Segmental needs ≥ 0.30 × W there (rise 120 builds), three-centre rise > 153 (rise 160 builds). Semi-circle and both gothics build at 400. Errors are readable and name the ring (`LEAF TOP allowance band (10mm per side): …`). | t17 sections 1–2 | Either accept (a 400 mm segmental / elliptical arched casement is not a product) or let PC raise the default rise to the minimum for the width — a configurator-package decision, not done here |
| 8.2 | The 900 mm straight rule dominates every other height rule; the leaf-stile rule (100) never binds at the defaults | t17 "height rules" | FYI (6.9) |
| 8.3 | No-stock behaviour: planner never throws, exporter names both members and the widest board; with only a 300 mm board the angle rule still forces N_min pieces (the board never lowers N) | t17 "no fitting board" | FYI — matches spec §7 |
| 8.4 | PSW parity (`docs/handover/PSW-PARITY-REPORT.md`, PSW 619703e): 24 PASS, 1 documented difference (PC hides the `010` picker card as an alias of `040L`), 0 HARD. `casementLayoutDef` identical in 960 cases (panel order, x/y/w/h, hinge, mullions, transoms); arch ratios, limits, radio values and the reversed hinge all in step | parity script | FYI — nothing to fix on either side |

---

## 2026-09-05 — arched-casement-v1

### 0. [CRITICAL → RESOLVED 06.09] The package spec is missing from the repository

`docs/handover/ARCHED-CASEMENT-v1.md` does not exist on `main`, on any remote branch, in the
git history, in Petros (`software/*` cabinets), in Google Drive or in Gmail. CLAUDE.md (commit
78ac6f5, 05.09 01:17) references it, but the `docs/` directory was never committed. Only this
session exists for the package, so no earlier Claude session holds it either.

What I did instead (per the night rules: simplest solution consistent with what IS known):
- Scope, file list, layer names, module order, button placement, BLOCKERS entries and the
  "NIE RÓB DZIŚ" list come verbatim from CLAUDE.md.
- PSW numbers come from the PSW source itself (read-only clone): `js/price-calculator.js`
  `window.ArchedSash` (RISE_RATIO, GOTHIC_PROFILE_RATIO, MIN_WIDTH 400 / MAX_WIDTH 1500),
  `js/casement-controller.js` (`casArchShape`, `casArchHinge`), `online-estimate.html` lines
  846–888 (shape radios; the hinge radio labelled "Left Hinge" carries `value="right"`).
- Every other number is my assumption, listed below with the alternative. All of them sit in
  one place (`DEFAULT_CASEMENT_PROFILE.arch` or the constants at the top of `arch.js`).
- The harness cross-checks closed-form geometry; it CANNOT reproduce spec §10. When you commit
  the spec, the `EXPECTED` tables in `verify/arch/t16.mjs` must be replaced by the §10 vectors.

**Ask:** commit the spec (or paste it) — then one pass of the harness tells us which assumptions
below differ from your decisions.

### 1. D13 — number of pieces N (fewer pieces vs narrower board) — **OPEN**

Night 2 (T6): the spec default is implemented — `profile.arch.pieceRule: 'narrowest'` (narrowest
stock with `N ≤ N_min + 2`, tie → fewer pieces); `'fewest'` is the other value. The other rule's
plan is always printed as ALT. **Piotr has not decided** — flip the profile value, no code.
Night-1 text: default was "fewest pieces"; alternative "narrowest board".

### 2. D5 — finger joint profile — **OPEN**

Piotr said "finger 10–11"; the chosen tool is the 15/16 profile. Taken: **15 / 16 / 3.8**
(`profile.arch.finger = { length: 15, depth: 16, pitch: 3.8 }`), printed as `FINGER 15/16/3.8` on
the TEXT layer. The FINGER layer carries the joint faces only (no teeth drawn).

### 3. Stark d50 head on the 5-axis CNC needs a d50 arbor — **OPEN**

Process decision for Piotr — the DXF is unchanged either way (joint faces are plain lines; the
tool does the profile).

### 5. Stage 2 not started (deliberate) — done in night 2, see BUILD-LOG

Piotr's gate: Stage 2 only after a ✅ Stage 1. Without the spec the harness cannot reproduce §10,
so Stage 1 is ⚠️ and Stage 2 (samples for every shape, edge-case harness, PSW parity report)
was not begun. Each is small once the spec is in: the harness already round-trips every shape
into `.audit/arch_1200_<shape>.dxf`, the limits already throw readable errors, and the PSW clone
command works from this container (`git -c http.proxyAuthMethod=basic clone --depth 1 …`).

### 4. ASSUMPTIONS made because the spec is missing — status after night 2

| # | Item | Taken (night 1) | Status 06.09 |
|---|------|-----------------|--------------|
| 4.1 | Rise limits for free-rise shapes | segmental 0.10–0.45 W, gothic drop 0.55–0.85 W, three-centre 0.15–0.45 W | **RESOLVED by spec (T5):** windows removed; only physics remains (segmental / three-centre rise < W/2, gothic-drop rise ≥ W/2) + `profile.arch.limits` |
| 4.2 | Gothic drop default rise | 0.70 W | **RESOLVED by spec §3.2 (T7):** `GOTHIC_PROFILE_RATIO` drop 0.70 / shallow 0.60 / equilateral √3/2 |
| 4.3 | Three-centre haunch radius | rise × 0.5 | **RESOLVED by spec §6.1 (T4):** r = rise² / halfW |
| 4.4 | PSW `elliptical-arch` | mapped to `three-centre` | **CONFIRMED by spec D9** |
| 4.5 | Rise vs height | only "straight part > 0" | **RESOLVED by spec §3.3 (T5):** H ≥ rise + 900, leaf straight stile ≥ 100 (`profile.arch.limits`) |
| 4.6 | Branch name | commits pushed to both night-1 branches | **RESOLVED:** both merged to main and gone (§7 above) |
| 4.7 | Board stock for arch pieces | `[100 … 250]`, `widthAllowance 20`, `maxPieces 8` | **RESOLVED by spec D7 / D6 / §7.3 (T2, T1):** `[50, 63, 75, 95, 105, 180, 200]`, `contourAllowance 10` per side, candidates N_min … N_min + 3 |
| 4.8 | Piece length limits | none | still none (spec has none); see 6.5 for the opposite question (minimum) |
| 4.9 | Profile snapshot in the pack export | single-window "Arch DXF" plans under the batch's `_profileSnapshot.casement` (like `derived`); "Arch DXF (all)" in the Production Pack plans under the ACTIVE profile (a pack spans batches) | pass per-window snapshots through `windowsData` if it ever matters |
| 4.10 | How an arched casement gets INTO PC | only through window data carrying PSW fields (`casementType: 'arched'`, `casArchShape`, `casArchHinge`) or PC-native `archShape` / `archRise` / `archHinge`; the PC configurator has no arched option (spec: "no new configurator UI"), and PC's estimates are PC-made — there is no PSW→PC import path in the code today | the button is visible on every casement window, disabled with the reason; enabling it in the UI needs either a PSW import or an `archShape` field in the configurator (separate package) |

---

## Branch name mismatch (procedural)

`CLAUDE.md` instructs me to work on `claude/full-build`, but the harness mandates `claude/build-sash-planner-web-exXYt` and explicitly forbids pushing elsewhere without permission.

I'm pushing all phases to **`claude/build-sash-planner-web-exXYt`** (already checked out at session start). If you'd prefer the branch named exactly `claude/full-build`, this is a one-liner:
```bash
git branch -m claude/build-sash-planner-web-exXYt claude/full-build
git push origin :claude/build-sash-planner-web-exXYt claude/full-build
```

---

## Supabase keys (missing — fell through to mocks)

`.env.example` has placeholders. No real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` were provided. The app detects this and:
- Switches to `mocks/mockEstimates.js` (3 estimates, 7 windows).
- Shows a yellow "Mock data mode" badge in the header.
- Login screen offers "Continue with mock data".

**To use real data:** copy `.env.example` to `.env`, paste keys from the same Supabase project Prime Sash Windows uses. The schema assumed: `estimates(id, estimate_number, status, created_at, total_price, project_name, customer_id)` and `estimate_items(id, estimate_id, window_number, window_type, width, height, quantity, unit_price, total_price, specification, ...)`. Confirm column names match before going live; if any of the secondary fields (`upper_bars`, `lower_bars`, `horns`, `color_*`, etc.) are missing, the spec adapter falls back to parsing them from the `specification` JSON.

---

## Specification JSON shape — assumption, not verified

I read `Prime-Sash-Windows/js/estimate-manager.js` and inferred that `estimate_items.specification` stores the full configurator state (with a nested `fullConfig` object) as a JSON string. The adapter in `src/engine/specification.js` (`normaliseToWindowSpec`) handles both shapes:
- Top-level `windowConfig` fields (`upperBars`, `lowerBars`, `horns`, `glassType`, ...).
- Nested `fullConfig` fields (`colorSingleName`, `interiorColor`, `ironmongery`, ...).

**Risk:** if the live shape diverges from what I read in the source, some windows may render with default 2×2 bars / white colour instead of their real config. **Mitigation:** unit-test against a real estimate row before going to production. I can write the test if you point me at one known-good row.

---

## 3D viewer — slim parametric vs. full Prime-Sash-Windows component (deliberate)

The brief said *"Importuj source JSX components, nie skompilowany bundle"* and *"Jeśli za skomplikowane: Placeholder + BLOCKERS.md"*.

I went with a third option: built a slim parametric sash window from primitives in `src/3d/SashWindow3D.jsx`, using the same `CONSTANTS` (jamb/stile/rail widths) the 2D drawing and cut list use — so geometry matches what gets cut. This is more useful than a placeholder and roughly 100× smaller than copying the full configurator (`3d-src/src/components/ParametricSashWindow.jsx` is 124 kB, with deep dependencies on configurator state, RAL palettes, ironmongery, etc).

**What's missing vs. the original:**
- Profile beads (ovolo / lambs tongue / square).
- Horns shape variants (only the rectangular extension is rendered when enabled).
- Casement / fix-frame / door types (only sash window is rendered; other types currently render the same sash mesh — a non-blocker for sash-only customers, but a UX issue otherwise).
- Ironmongery handles / catches.
- Per-pane glass finish (frosted vs clear).

**LOGIC FAILURE check:** None — the slim component does not lie about geometry; it shows the exact dimensions the planner cuts to. If a higher-fidelity preview is needed for sales-style screenshots, Phase 2.1 should pull in the full component and adapt props.

---

## Window types other than `sash`

The configurator schema includes `casement`, `fix-frame`, and `door`. `calculations.js` (from the Electron app) only models sash windows. Currently:
- The card / window detail page show the type label and dimensions.
- Cut list / 3D / 2D / exports assume sash geometry.

**For non-sash items in an estimate**, the calculator may produce numbers that don't apply (e.g. casement has no meeting rail). I haven't added a guard rail because the Electron app didn't have one either — answer me: should non-sash items be hidden, marked as "not supported", or do you have a separate calculator for them?

---

## Manual / Custom bars

Custom-bar positions are read from `fullConfig.upperCustomBars / lowerCustomBars` in the spec adapter, but only the upper-set's vertical/horizontal arrays are wired through to the renderer. **Lower-sash custom bar positions are not yet rendered separately** — both sashes use the same set. If your customers configure asymmetric upper/lower bar layouts, this is a Phase 3.1 follow-up.

---

## Bundle size

`dist/assets/index-*.js` is ~1.1 MB (gzip 352 kB). Vite warns at 500 kB. Causes:
- `xlsx` (SheetJS) is a 700 kB chunk on its own.
- `jspdf` + `jspdf-autotable` add ~200 kB.

**Fix path:** route-level lazy loading for `WindowDetailPage` (the only page that imports the export utils). I split `SashWindow3D` already (897 kB → lazy chunk). Splitting export utils is a 5-minute change but the warning is currently the only cost — runtime is fine. Flagged here so it's not a surprise.

---

## Things explicitly out-of-scope per the brief

- Phases 6 (Manual Creator) and 7 (SaaS multi-tenant) — not started, per CLAUDE.md "Fazy 6 i 7 — NIE rób teraz".
- Production data import for non-Skylon companies (will need `companies` table + RLS).
- PWA / offline cache.
