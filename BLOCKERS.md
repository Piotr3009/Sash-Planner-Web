# BLOCKERS.md

Open questions, missing inputs, and improvements deferred for review by Piotr.

---

## 2026-09-06 — ARCHED-WINDOWS-v4 night 6: **STOPPED AT THE START GATE** (branch `claude/arched-windows-v4-5rqezr`)

### A. [CRITICAL — BLOCKS THE WHOLE NIGHT] The `arch-pieces-v1` package is not in the repository

`CLAUDE.md` (night 6) and `docs/handover/ARCHED-WINDOWS-v4.md` both open with the same gate: the chat
package **arch-pieces-v1** (06.09) must be on `main` before the night starts, verified by three greps.
**All three fail**, so the session stopped there, as the gate instructs.

| Gate check (CLAUDE.md) | Required | Actual on `origin/main` = `048e47c` |
|---|---|---|
| `grep -c pieceStockTrapezoid src/engine/arch.js` | > 0 | **0** |
| `grep -c glazingRebate src/engine/profile.js` | > 0 | **0** |
| no "Tracery LSP" button | absent | **present**, `src/pages/WindowDetailPage.jsx:160–162` |

**Where I looked (exhaustive, all negative for source code):**
- Working tree, and every one of the 8 branches on `origin`
  (`git show <ref>:src/engine/arch.js | grep -c pieceStockTrapezoid` → 0 on all).
- The **whole history**: `git log --all -S'pieceStockTrapezoid' --oneline`, and the same for
  `pieceStockEdges`, `glazingRebate`, `minClampLength`. Each returns exactly one commit, `048e47c`
  ("v6 noc", 06.09 15:45), and that commit touches **only two files**: `CLAUDE.md` and
  `docs/handover/ARCHED-WINDOWS-v4.md`. The names have therefore never existed under `src/` in any
  commit of this repository — they exist only as prose in the spec that assumes them.
- Petros (`entries`): one matching note, `warsztat/biesse` 06.09 14:34, "Rover A 1532: minimalna
  dlugosc elementu 450 mm…". It carries the Block C **numbers** (`cnc.minClampLength` 450,
  `arch.minPieceLength` 400, boards 63/75/95/105/120/150/180/200) but no code and nothing about the
  trapezoid piece model, the glued blank, `glazingRebate`, or the LSP removal.
- Google Drive (`fullText contains 'pieceStockTrapezoid' or 'arch-pieces'`) → nothing.
- Gmail (`pieceStockTrapezoid OR "arch-pieces" OR glazingRebate newer_than:14d`) → nothing.

**What `arch.js` actually still is:** the v1/v3 planner. `planArchSegments()` partitions **each arc of
the ring separately** (`ring.outer.map((outer, i) => …)`, `src/engine/arch.js:788`) — precisely the
behaviour v4 C.3 exists to replace — sizing boards from the allowance band projection
(`allowanceBand` + `partitionArc` + `stockFor`), with `PIECE_RULES` `'narrowest' | 'fewest'` and
`minPieceLength` warn-only. There is no trapezoid abstraction and no ASSEMBLY (glued blank) model.

**Current profile values, for the record (they are the v4 "before" column):**
`arch.stockWidths [50, 63, 75, 95, 105, 180, 200]` · `arch.minPieceLength 150` (warn) · no
`cnc.minClampLength` · no `arch.wasteThreshold` · no `cnc.clamp` · casement `frameHead.face 57`,
`frameJamb.face 57`, `geometry.land 36`, `deductions.leafAtJamb 40` · door `couplingPost.width 114`
· no `geometry.glazingRebate`.

**Ask (this is the one thing that unblocks night 7):** push the arch-pieces-v1 code to `main`, or say
"build it" and give it a spec section in `docs/handover/`. I deliberately did **not** invent
`pieceStockTrapezoid` / `pieceStockEdges` / `glazingRebate`: Block C is written to consume them
(v4 C.3 names them as inputs), so guessing their shape would put a night's work on top of an API you
would then have to merge against — the exact failure the gate was added to prevent.

### B. Baseline of `main` measured tonight (so night 7 does not start blind)

`npm install` (the container ships without `node_modules`), `pip install ezdxf` → 1.4.4, then every
harness on the session checklist, on an untouched `origin/main` = `048e47c`:

| Harness | Result |
|---|---|
| t16, t17_edges, t18, t19, t20, t20_bars, t21, t22, t23 | **ALL PASS** (9 of 10) |
| t24_stage4 | **25 passed, 1 FAILED** |
| `npm run build` | **green** (21.4 s; the pre-existing >500 kB chunk warning only) |

### C. [t24_stage4 FAIL — not a regression, an out-of-date assertion] Dashboard archive flow

`verify/arch/t24_stage4.mjs:80` still asserts the night-5 rule:
`dp.includes("if (open === 0) { archiveProject(project.id); return; }")` — archive immediately when
every batch pack is complete, confirm otherwise.

You changed that yourself in commit `dce5a16` (06.09 12:19, `Update DashboardPage.jsx`), and the code
says why:

```js
// v3 Block 6: Archive — ALWAYS behind a confirm (Piotr 06.09: an accidental click made a
// project vanish). Open batches only add a warning line; they never change the flow.
```

So the application is right and the harness is stale. **I did not touch either** — the fix is one line
in the harness, but it is outside the v4 scope and the night stopped at the gate, so it is your call:

**Ask:** confirm "always confirm" is final, and I will re-point that assertion at the new flow
(`openLine` warning + a single `setConfirmAction` path) in the first commit of night 7. Until then the
session checklist cannot read ALL PASS, and the cause is this one assertion, not the arch code.
Note this also makes BLOCKERS §15.6 ("archive from the card: immediate when every batch's pack is
complete, confirm otherwise") out of date.
### D. Which v4 stages actually need `arch-pieces-v1` — so night 7 can be re-ordered

I mapped each block against the missing package (17 agents: one analyst per block, three adversarial
refuters each). Where their conclusions conflicted I re-ran the check myself on the bundled engine
(`.audit/`, not committed) rather than take a verdict on trust.

| Stage | Block | Needs arch-pieces-v1? | Evidence |
|---|---|---|---|
| 1 | **C** — segment planner | **YES, genuinely** | C.3 names `pieceStockTrapezoid` / `pieceStockEdges` as its inputs, and see §E1: the C.5 reference vectors are unreachable from the current primitives |
| 2 | **B** — glazier PDF | **NO** | mentions the package once, in passing ("as the on-screen sheet since arch-pieces-v1"). Everything it consumes exists: `barEndRows()` `glassBars.js:138-195`, `BAR_ID_PREFIX` `arch.js:957`, the node PDF path already exercised by `t18.mjs:363-383`, the three v3 sample fixtures. `glassPdfExport.js` imports nothing from the piece planner |
| 3 | **E** — `intersecting` from vertical bars | **NO** | the block names no package artefact. The reference implementation is **already in this repo**, not only in PSW: `src/3d/components/ArchedSashWindow.jsx:933-958` is the rule line for line — `mullions = columns.length ? columns : [-halfW/2, halfW/2]` (:936 = the "0 bars → ±¼" rule), `R = gothicCentreOffset + halfW` else `halfW` (:937-939), `cx = mx − dir·R` (:941), clipped on `archYAt` (:947-950); the "no springing bar for intersecting" note is at :868-872. So it is a PC-file → PC-file port |
| 4 | **F** — frame 68 | **NO at symbol level**, but see §E2/§E3 | F.1–F.5 touch only profile constants, `casementLayouts.js:34`, the 3D constants and `materialAssignmentStore`. Verified empirically at face 68: no new `ArchError`, no new `plan.noStock`; F.6's own prediction reproduces — casement 1000 × 1500 leaf **920 → 898**, leaf height **1402** |

**Recommendation for night 7, if the package still is not ready:** run **E → B → F.1–F.5**, leave C for
when arch-pieces-v1 lands. That is three of the four stages. It reverses the spec's order, which is why
I did not start it tonight on my own: the gate says stop, and re-ordering your stages is your call, not
mine.

### E. Three things the v4 spec does not account for (found while checking, not guesses)

**E1. [CRITICAL for Stage 1] The C.5 reference vectors do not come out of the current geometry.**
I ran the spec's five cases through the existing planner (`buildArchGeometry` → `planArchSegments`,
head ring, profile defaults, face 57 / allowance 10 / finger 15):

```
                              spec C.5                          current planner
HALF 1000  semi-circle    3 pieces · 150 (134.7) · 508.8/432    6 pieces · 95 (91.8) · 264.0/224.1
ROUND 1000 3-centre 250   2 pieces · 180 (158.3) · 572.5/468.9  7 pieces · 95 (89.8) · 303.5/41.6
HALF 1500  semi-circle    3 pieces · 180 (168.1) · —/681.5      7 pieces · 95 (94.1) · 338.2/304.0
tc240 1200 3-centre 240   2 pieces · 180 (170.6) · 659.2/—      7 pieces · 95 (87.8) · 349.0/48.1
GOTHIC 1000 equilateral   4 pieces · 120 (112.6) · 524.1/463.5  shape name 'gothic' does not exist
```

That gap is structural, not a tolerance: `planArchSegments` floors at `nMin = Math.max(2, …)` **per arc**
(`arch.js:792`) and only exempts a single-arc ring (`:795`), so a three-centre head can never plan fewer
than 6 pieces — the spec asks for 2. The `inner 41.6` / `48.1` rows above are exactly the ~100 mm haunch
triangles you rejected, which is what C.3 is written to fix. Two consequences:
- the whole-chain partitioner is **new geometry**, not a rename of what exists (one of my own refuters
  argued the opposite; the numbers above settle it against them);
- **the C.5 numbers were computed against arch-pieces-v1, so t25 is only writable once that lands.** An
  independent probe reproduced ROUND 1000 (158.3 / 572.5 / 468.9) and tc240 (170.6 / 659.2) exactly from
  an equal-arc-length chain split, and HALF 1000 to within ~1 mm — but **GOTHIC 1000 misses by 18.5 mm on
  the inner edge** (463.5 spec vs 445.0/485.5 by either method). **Ask:** is 463.5 right, and what is the
  gothic split rule — equal arc length per side, or something else?
- `gothic` as a shape name does not exist in the engine (`gothic-equilateral` / `gothic-drop`); the
  rename is on the "NIE RÓB DZIŚ" list, so C.5's label needs mapping when t25 is written.

**E2. [CRITICAL for Stage 4] Editing `DEFAULT_CASEMENT_PROFILE` will not change anything for you — and
the harnesses will not notice.** F.1 says "everything downstream reads these". It does not: the profile
is persisted (`windowProfileStore.js` `persist`, key `pc-window-profile`) and on rehydrate
`migrateCasementProfile` spreads the **stored** blocks over the defaults —
`elements: { ...D.elements, ...profile.elements }`, same for `geometry` and `deductions`
(`src/engine/profile.js:271-275`) — then `loadFromCloud()` lets the Supabase tenant copy outrank the
local cache (`windowProfileStore.js:186-190`). So any tenant with a saved profile keeps face 57 / land 36
/ leafAtJamb 40 after the change, while every harness reads `DEFAULT_CASEMENT_PROFILE` directly
(`t16.mjs:51`, `t18.mjs:48`) and would report ALL PASS on a change that is inert in the app.
The fix is the mechanism you already use for the `arch` block, which carries a schema version and is
"replaced whole" when older (`profile.js:276-280`): give `elements` / `geometry` / `deductions` the same
version + replace-whole migration. **Ask:** confirm that, and confirm a stored profile should be
overwritten (a tenant who deliberately set 57 loses it) — this is F.5's "profile snapshot per project"
question arriving early, and it now blocks the stage rather than being a design note.

**E3. F.6 as written cannot be done before Block C.** It requires re-baselining the arch plan vectors,
but those plans are exactly what Block C changes. Doing F first re-baselines `t18`'s arch numbers and the
`sample_arch_*.dxf` twice. **Ask:** confirm F.6 is narrowed to the straight-window snapshots (casement /
door rectangular fixtures, the 920 → 898 / 1402 numbers) and the arch plan re-baseline waits for C.
### F. What unblocks night 7 — pick one of two routes

**Route 1 (preferred): push arch-pieces-v1 to `main`.** Nothing else is needed; the night runs as v4
specifies, with §E1–E3 answered along the way.

**Route 2: tell me to build arch-pieces-v1 first, and answer these seven.** They are the decisions the
chat package already took that the code cannot recover. Numbered, priority-tagged:

1. **[CRITICAL]** `pieceStockTrapezoid(piece)` — what does it return? My reading of C.5/C.6 is the flat
   board footprint as four corners (or `{ length, width, angle0, angle1 }`) whose two parallel edges are
   the outer (rough) and inner stock edges. Confirm the shape and the field names.
2. **[CRITICAL]** `pieceStockEdges(piece)` — outer and inner edge **lengths**, or their end points?
   And is the inner edge the band's inner **chord** or its projected **span**? They differ by ~1 mm on a
   compound piece (468.9 vs 470.1 on ROUND 1000) and C.5 quotes 468.9, i.e. the span.
3. **[CRITICAL]** The gothic split rule — §E1: 463.5 does not come out of an equal-arc-length split
   (445.0) nor of the per-side engine partition (483.0 / 445.0). Which rule gives 463.5?
4. **[HIGH]** `geometry.glazingRebate = 18` — this is the tracery-into-timber rebate that replaces
   `glassInset 12.5` for the tracery board (`traceryExport.js:774-777`). Confirm it applies to the
   tracery board only, and that `glassInset 12.5` stays for the leaf glass rebate.
5. **[HIGH]** ASSEMBLY vs PIECES — CLAUDE.md's STAN line says "proste trapezy (PIECES) i sklejony blank
   (ASSEMBLY), długość surowa = krawędź deski + palec". Today `ASSEMBLY` draws stock rectangles
   (`archDxf.js:37`) and `PIECES` draws the curved contour (`:38`). Confirm the new split: PIECES = the
   flat trapezoids to cut, ASSEMBLY = the glued-up blank with the finger joints marked.
6. **[MEDIUM]** Rough length — is the finger added at **every** jointed end (today
   `p.L + finger × p.jointedEnds`, `arch.js:775`), or once per piece?
7. **[MEDIUM]** LSP removal scope — just the button (`WindowDetailPage.jsx:160-162`), or also
   `exportTraceryLspForWindow` / `writeTraceryLsp` (`cncExport.js:262,301`,
   `src/engine/cnc/traceryExport.js`) and the eight `.lsp` files in `docs/handover/samples/`?
   (v4 §0 says "No LISP output anywhere", which reads as all of it.)

Answer 1–3 and I can write Block C and a t25 whose vectors I derive from the formulas rather than from
C.5; answer 4–7 and the rest of arch-pieces-v1 follows. Either route, **say whether night 7 may run
E → B → F.1–F.5 first** (§D) instead of holding the whole night on Stage 1.

---

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
