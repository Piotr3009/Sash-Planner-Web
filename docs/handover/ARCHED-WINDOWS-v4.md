# ARCHED WINDOWS v4 — night 6 handover

Follows v1 → v3 (all on `main`) and the chat package **arch-pieces-v1** (06.09, on `main` before
this night starts — verify: `src/engine/arch.js` exports `pieceStockTrapezoid`, the tracery export
has no LSP button, `profile.geometry.glazingRebate` = 18). Decisions below were taken with Piotr on
06.09.2026 and override anything older. Where Piotr did not decide, the item says **DEFAULT (open)**:
implement the default, log it in `BLOCKERS.md`.

Four gated stages, one night. The next stage starts ONLY after the previous stage's harness is ALL
PASS and `npm run build` is green.

- **Stage 1 = Block C** — the segment planner (machine + joinery limits, real stock list, pieces across
  arc boundaries, economy rule), CLAMPS layer, finger / limits in Window Settings. Gate: t25 + t16–t24.
- **Stage 2 = Block B** — the glazier PDF layout. Gate: t26.
- **Stage 3 = Block E** — `intersecting` from the vertical bars (casement, sash, fixed). Gate: t20_bars,
  t22, t23 updated.
- **Stage 4 = Block F** — frame face 68 everywhere (option B) + door coupling post 136 + PSW port
  instructions. Gate: every harness re-vectored from formulas + rectangular snapshots re-baselined
  on purpose (this stage CHANGES every straight window — see F.6).

---

## 0. Rules (v1 §0, v2 §0, v3 §0) plus

- One contour everywhere; numbers in the profile; no bare numbers in formulas.
- Harness vectors are derived from formulas written in the harness, never read back from the code.
  Stage 4 is the big one: every expected number that contains 57 / 36 / 40 / 114 changes — compute
  the new value in the harness from the profile constant, do not paste the code's output.
- Beading stays frozen. No LISP output anywhere (Piotr 06.09).
- `src/3d` keeps PSW prop names; every 3D change gets a line in `docs/handover/PSW-3D-ARCH-PORT.md`.

---

## BLOCK C — segment planner v2 (Stage 1)

### C.1 Two length limits (Piotr 06.09)
| profile key | default | measured on | reason |
|---|---|---|---|
| `cnc.minClampLength` | **450** | the piece's overall length — longer stock edge incl. finger extension | Rover A 1532: two Uniclamps + end cuts (Piotr's measurement) |
| `arch.minPieceLength` | **400** | the piece's SHORTER stock edge (inner edge for a convex arch) | joinery: fewer joints |
A piece must satisfy both. Replace the v3 `minPieceLength: 150 (warn only)` — both are HARD: a plan
that cannot satisfy them is reported (`plan.noStock` with reason `'below minimum length'`), never
silently split finer.

### C.2 Stock list (Piotr 06.09)
`arch.stockWidths = [63, 75, 95, 105, 120, 150, 180, 200]` (50 removed, 120 and 150 added). Max board
200 is the list's last entry, not a separate constant.

### C.3 Pieces across arc boundaries
The v1 planner partitions EACH arc of the chain separately (haunch / crown / haunch), which produced
the ~100 mm haunch triangles Piotr rejected. New rule: partition the **whole chain** (springing to
springing) by arc length into N equal pieces; a piece may contain a tangent point (haunch + part of
the crown) — the CNC cuts the compound curve from one straight board. End pieces start on the
springing line. For a gothic the chain is split at the apex first (the apex is always a joint), then
each side partitioned.
- Piece end planes: radial to the local arc at the cut point (unchanged), springing line at the
  arch start, vertical axis at a gothic apex.
- Board size per piece: the projection method on the allowance band between the two end planes
  (v1 §7.1) — this already handles a piece spanning two radii; `pieceStockTrapezoid` /
  `pieceStockEdges` (arch-pieces-v1) give the trapezoid, the outer edge (rough) and the inner edge.
- `N` search: from `N_min = 1` (gothic: 1 per side) upwards; the first N whose pieces ALL satisfy
  C.1 with a board ≤ 200 is the **fewest** solution; keep searching to `N + 3` for the economy
  alternative (C.4).

### C.4 Economy rule (DEFAULT (open))
`arch.wasteThreshold = 0.45`: the fewest-pieces solution is chosen unless its waste
(`Σ board area − Σ band area`) / `Σ board area` exceeds the threshold AND the next N passes C.1 with a
narrower board — then the next N wins. Both are printed on the DXF text block (`RULE FEWEST · ALT N+1`).
Piotr can set the threshold to 1.0 to always take the fewest.

### C.5 Reference results (harness `t25` EXPECTED, computed from the formulas, ±0.5 / ±1 on stock)
Face 57 head ring, allowance 10, finger 15 — independent projection of the sampled band on the
piece chord (the harness re-implements the projection with its own sampler, 800 points per arc):
```
HALF 1000 (semi-circle W1000):   3 pieces · board 150 (134.7 needed) · outer 508.8 · inner 432  (2 pieces need 203.8 → no)
ROUND 1000 rise 250 (3-centre):  2 pieces · board 180 (158.3)       · outer 572.5 · inner 468.9
GOTHIC 1000 (equilateral):       4 pieces (2 per side) · board 120 (112.6) · outer 524.1 · inner 463.5
HALF 1500 (semi-circle W1500):   3 pieces · board 180 (168.1) · inner 681.5   (2 pieces need 277 → no)
tc240 1200 (3-centre rise 240):  2 pieces · board 180 (170.6) · outer 659.2 (+15 finger) · inner ≥ 450
Every plan above: all pieces ≥ 450 overall and ≥ 400 on the shorter edge; with stock capped at 105 the
same four arches have NO valid plan (5 / 10 / 6 / 6 pieces, shorter edges 268 / 93 / 309 / 350).
```

### C.5b Reference results re-issued for the 68 frame (night 7 stage 5; BLOCKERS §19.6 closed)
The C.5 table above is the **57-frame** table, by its own premises. Block F widened the frame to 68, which
grows the head ring, so the required board width moved. Same independent projection, same allowance 10 and
finger 15, land 47 / leafAtJamb 51. **Piece counts and boards are UNCHANGED — only W_req moved.**
`t25` §2c asserts every line below against the live profile, so this table cannot drift from the engine.
```
HALF 1000 (semi-circle W1000):   3 pieces · board 150 (144.5 needed, was 134.7) · outer 551.0/592.1/551.0 · inner 464.4/418.8/464.4  (2 pieces need 211.6 → no)
ROUND 1000 rise 250 (3-centre):  2 pieces · board 180 (165.5, was 158.3)        · outer 619.5/619.5       · inner 529.5/529.5
GOTHIC 1000 (equilateral):       2 pieces per side · board 120 (119.4, was 112.6) · outer 532.1/573.9 · inner 500.0/421.7
HALF 1500 (semi-circle W1500):   3 pieces · board 180 (178.0, was 168.1)        · outer 819.4/878.7/819.4 · inner 715.4/670.9/715.4  (2 pieces need 284.8 → no) · economy default 4 × 150
tc240 1200 (3-centre rise 240):  2 pieces · board 180 (176.8, was 170.6)        · outer 697.9/697.9       · inner 625.9/625.9
```

### C.6 CLAMPS layer (Piotr 06.09: the Rover A 1532 holds pieces in Uniclamps, not vacuum pods)
Arch DXF gains layer **`CLAMPS`**: for each flat piece in the PIECES row, two suggested Uniclamp
footprints (`cnc.clamp`: base **130 × 130**, jaws for a piece thickness 40–98 — the 93 depth fits;
Biesse minimum workpiece 140, Piotr's minimum 450 = C.1) placed inside the trapezoid at least
`cnc.clampClearance` (DEFAULT 20 mm) from the two angled end cuts and from the band contour, as far
apart as the piece allows, centred across the width. Text `CLAMPS (SUGGESTION)`. Profile keys:
`cnc.clamp = { base: 130, minThickness: 40, maxThickness: 98, minPiece: 140 }`, `cnc.clampClearance`.
A piece thinner than 40 or thicker than 98 → warning in the text block (never a silent skip).

### C.7 Settings UI (Piotr 06.09: "bardzo proszę")
`WindowSettingsPage` gets a **CNC & arches** card (same styling as the other cards, no mockup needed
— it is a list of numeric fields): finger length / groove / pitch, contour allowance, stock widths
(comma list), `minClampLength`, `minPieceLength`, `wasteThreshold`, `glazingRebate`, clamp base / thickness range +
clearance, tracery `paneOffset / profileWidth / ridgeLand / edgeLand / mitreLeg`. Values go to the
tenant profile (`settings` table, existing mechanism) and the engine reads them through
`getCasementProfile()`. No spinner arrows (rule 18). Validation messages from `ArchError`.

### C.8 Pre-cut, BOM, PP, DXF
Follow the new plan automatically (they read `plan.pieces`). DXF text block prints both limits and the
economy alternative. `sample_arch_*.dxf` regenerated.

---

## BLOCK B — glazier PDF layout (Stage 2)

Piotr 06.09 (SS2): the per-unit table next to the drawing made the drawing unreadable.
- **Drawing cells:** the unit drawing fills the cell (max scale), title line + spec line under it, the
  bar-spacing chain at the BOTTOM and the overall width at the TOP (as the on-screen sheet since
  arch-pieces-v1). No table in the cell.
- **Bars page(s) at the END:** one block per shaped unit that has bars: a thumbnail of the WINDOW
  (elevation, ~35 mm high), the window name + unit id, then the bar table (`ID · s from apex /
  position · L · angle / R`) — blocks stacked, page-breaking between blocks, never inside a table.
- Rectangular units unchanged. A3 / A4 follow the existing export setting.
- Labels on the drawing: only ids (`V1`, `K1`, `R1`); numbers live in the table.
- Harness `t26`: render the PDF for the three v3 samples (semi hub-spoke, three-centre bars, gothic
  intersecting) through the existing node PDF path; assert page count = drawings + bars pages, the
  bars page contains every bar id of every unit, no text overlaps the drawing cell (bbox check of the
  jsPDF text positions), rectangular-only exports byte-identical to before.

---

## BLOCK E — `intersecting` from the vertical bars (Stage 3)

Piotr 06.09 (SS1 = PSW arched sash): the tracery arcs must spring from the tops of the vertical bars —
PSW's sash does this (`ArchedSashWindow.jsx` 915–940), PSW's fix-frame `intersectingData` does not
(independent geometry) and v3 ported the wrong one for the casement.
Rule (one engine, every window type):
- Vertical bars run to the springing line; **each bar top spawns two arcs** (left-curving and
  right-curving) with the **arch's own radius** (gothic `c + halfW`, semi-circle `halfW`), centre on
  the opposite side (`cx = x_bar − dir·R`), clipped to the glass outline. Arcs from the springing
  corners are the frame itself and are not drawn.
- No horizontal bar on the springing line for `intersecting` (PSW 23.08: "its columns flow straight
  into the tracery arcs"); hub patterns keep theirs.
- 0 vertical bars → two default columns at ±¼ of the clear width (PSW).
- `intersectingData` port removed. `PATTERNS_FOR_SHAPE` unchanged.
- Harness: gothic 1000 × 1900 with 3 V bars → 6 arcs, each starting at a bar x, R = 1000, ends on the
  outline; semi-circle 1000 with 2 V → 4 arcs R 405.5 (glass); 0 V → columns at ±202.75. 2D / glazier /
  tracery / 3D consume the same list (t20_bars, t22, t23 updated; rectangular snapshots untouched).

---

## BLOCK F — frame face 68 everywhere (Stage 4) — option B

Piotr 06.09: head and jambs 57 → **68** on casement AND doors. Option **B**: the rebate stays 21, the
visible land grows 36 → **47**, gap 4, so `deductions.leafAtJamb` 40 → **51** (1000 frame → 898 leaf).
The **cill is unchanged** (68 with its fall, 41 visible outside, `gapCill` 6). Door: same face, coupling
post 2 × 68 = **136**, transom rail unchanged.
1. `DEFAULT_CASEMENT_PROFILE`: `frameHead.face 68`, `frameJamb.face 68`, `geometry.land 47`,
   `deductions.leafAtJamb 51`; `DEFAULT_DOOR_PROFILE`: `frameHead / frameJamb face 68`,
   `couplingPost.width 136`. Everything downstream reads these.
2. `casementLayouts.js`: `FRAME_FACE = 68` (only that constant) + `CASEMENT_LAYOUTS_VERSION` bump to
   the next integer; write `docs/handover/PSW-FRAME-68-PORT.md`: the PSW files and lines to change
   (`estimate-renderer.js` FRAME_FACE, `casement-controller.js`, 3D `CasementFrame.jsx` /
   `DoorFrame.jsx` / `ArchedCasementWindow.jsx` constants) — Piotr ports PSW later; pricing is by
   outer size, unaffected.
3. 3D (`src/3d`): replace the hard-coded 57 / 36 / 40 / 114 with values passed from the profile via
   `windowSpecToConfig` / `update3D` (`frameFace`, `land`, `leafAtJamb`, `couplingPost`) with the
   old numbers as defaults so the PSW copy keeps working until ported.
4. Engine: verify the door side-panel post (`D-COUPLING POST 136 × 93`), french leaves, arch rings
   (offset by the new face) — no literal 57 / 36 / 40 remains in `src/engine` (grep gate).
5. Materials: the 68 × 93 raw section must exist in Part Registry; add it to `materialAssignmentStore`
   defaults next to 57 × 93 (do not delete 57 — old projects). BLOCKERS: profile snapshot per project
   (a profile change re-derives old windows live) — design note only.
6. Harness: every vector containing 57 / 36 / 40 / 114 recomputed in the harness from the profile;
   rectangular snapshot fixtures (`rect-casement-*.json`, `rect-sash-*.json` are NOT affected — sash
   unchanged) re-baselined for casement/door with a BUILD-LOG line quoting the old and new leaf
   width for 1000 × 1500 (920 → 898). Casement 040L 1000 × 1500: head 1000, jambs 1500 − cill, leaf
   898 × 1409?? — compute from the profile, do not guess: leafH = extH − (land + gap) − (gapCill +
   cillVisible) = 1500 − 51 − 47 = 1402. Print the numbers you get and the formula.

---

## Delivery
Branch of the session, commit + push per stage; samples regenerated; BUILD-LOG per stage with the
honest not-verified list (browser, VCarve, bSolid, PDF viewer); BLOCKERS for every DEFAULT (open):
C.4 threshold, C.6 clamps on/off + clearance, F.5 profile snapshot.
