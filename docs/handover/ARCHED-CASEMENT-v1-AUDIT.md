# ARCHED CASEMENT v1 — AUDIT of the night build (05.09.2026)

Audited on `main` after fast-forwarding `claude/arched-casement-v1` (7 commits, 00:49–01:06).
Auditor: Claude (chat session with Piotr), 06.09.2026. Every finding below was re-run
independently — not taken from BUILD-LOG.

## 1. Root cause of the ⚠️
The spec `docs/handover/ARCHED-CASEMENT-v1.md` was never committed (commit `78ac6f5`
contained only `CLAUDE.md`). The build used CLAUDE.md + PSW sources and **invented every
missing number**, listing each in `BLOCKERS.md §4` as an assumption. The harness therefore
verifies the build's own numbers (tautology). This is fixed by this commit: the spec is in.

## 2. Verified correct — keep
- Geometry matches spec §10.1 to 0.01 for **segmental, semi-circle, gothic equilateral,
  gothic drop** (R 870 / 87.21°, R 600, R 1200 / 60°, R 888 / 71.08°).
- `sample_arch_1200_segmental.dxf`: `CONTOUR` = closed POLYLINE, 4 vertices, 2 bulges;
  layers CONTOUR / ASSEMBLY / PIECES / FINGER / TEXT; `ezdxf` round-trip OK.
- PSW hinge inversion (`online-estimate.html:887-888`) handled in `specification.js`.
- Untouched, as required: `jambDxf.js` code paths, `casementLayouts.js`, `calculations.js`,
  `lists.js`, sash beading module. `npm run build` passes. No Polish in sources.
- Width limits 400–1500 enforced with readable errors.
- True finding worth keeping: **no arched casement can be created in PC today** (no
  configurator field, no PSW import) — the "Arch DXF" button is always disabled. That is
  by spec (UI is mockup-gated); it means the package is only reachable through the harness
  until the configurator package lands.

## 3. TASKS (do in this order; each one is a small edit)

### T1 [HIGH] — max segment angle · `src/engine/arch.js` `planArchSegments`
No grain limit ⇒ default N=2 (43.6° per piece); the sample DXF shows the **leaf top rail as
ONE board 225 × 1081** cut from solid. Add `profile.arch.maxSegmentAngleDeg = 36` and use
`N_min = max(2, ceil(span / maxSegmentAngle))` per arc (spec §7.2; segmental with span <
36° may use N=1 only if a board fits). Expected after fix (spec stock list): head 1200
segmental → candidates start at N=3; semi-circle → N=5; gothic → 2 per side.

### T2 [HIGH] — stock list · `src/engine/profile.js` `DEFAULT_CASEMENT_PROFILE.arch`
`stockWidths: [100,125,150,175,200,225,250]` is invented. Piotr's list (D7):
`[50, 63, 75, 95, 105, 180, 200]`. Keep `widthAllowance: 20` — it is equivalent to the
spec's 10 mm per side on the width (checked: 103.02 vs 102.70 for N=3).

### T3 [MEDIUM] — rough length and length allowance · `arch.js` pieces
Pieces carry `chordLength` only. Add per piece: `lengthOuter = chord + 2 × allowancePerSide
projected` (spec: `2·(Ro + a)·sin(φ/2)` ⇒ 441.71 not 436.67 for N=3), `jointedEnds` (1 for
end pieces, 2 for middle), `roughLength = lengthOuter + finger.length × jointedEnds`
(15 per jointed end, conservative, spec §7.7). Print `L <rough>` on the PIECES label and the
finger zone `finger.depth` (16) deep from each jointed end — today the FINGER layer draws the
joint face only, which is fine, but the label must show the cut length.

### T4 [MEDIUM] — three-centre haunch radius · `arch.js` `THREE_CENTRE_HAUNCH_RATIO`
As built: `r = 0.5 × rise` (195 at W 1200) ⇒ crown R 713.08. Spec §6.1: `r = rise² / halfW`
(ellipse curvature at the springing) = 253.50 ⇒ R 761.54, tangent point (W/2 + 519.40,
+185.39), small span 47.00°, large span 86.01°. Replace the constant with the formula; keep
the tangency solve as is (it is correct).

### T5 [MEDIUM] — limits · `arch.js` `ARCH_LIMITS`
Add PSW's `H ≥ rise + 900` (`minStraightBelowRise`) and the leaf straight stile ≥ 100
(`minLeafStraightStile`) from spec §3.3 / §5; keep width 400–1500. Remove the invented
per-shape rise ratio windows (BLOCKERS 4.1) **unless** they are stricter than physics
(rise > W/2 for a single-centre arc is impossible — keep that one as a hard error).

### T6 [MEDIUM] — D13 default · `arch.js` `planArchSegments`
As built: default = fewest pieces, alternative = narrowest board. Spec D13 (Piotr has NOT
decided): default = narrowest board with `N ≤ N_min + 2`, tie → fewer pieces; print the
other one as ALT. Implement the spec default behind ONE profile switch
`profile.arch.pieceRule: 'narrowest' | 'fewest'` (default `'narrowest'`) so Piotr flips it
without code.

### T7 [HIGH] — harness · `verify/arch/t16.mjs`
Replace the `EXPECTED` tables with spec §10.1 / §10.2 vectors. Assert `==` (±0.05) for
middle-piece `W_req` and `>=` for end pieces. Keep the 203 existing structural checks. Add
the §10.3 list (items 1–10). Rerun; the build is ✅ only when this passes.

### T8 [LOW] — housekeeping
Delete branch `claude/arched-casement-v1-m23u5x` (duplicate). Regenerate
`docs/handover/samples/sample_arch_1200_segmental.dxf` after T1–T6 (it currently shows the
solid-board leaf). Update `BLOCKERS.md §4`: mark 4.1, 4.3, 4.7 as resolved by spec, keep D13
/ D5 / d50-arbor open for Piotr.

## 4. Spec corrections made on the spec side (auditor's own errors)
- §10.2: end pieces are **not** always wider than middle pieces — assertion changed to `>=`.
- Rough length wording tightened (finger per jointed end, allowance also on length).

## 5. Then, and only then: STAGE 2 (from the night-1 brief)
a) sample DXF for every shape (frame + leaf) into `docs/handover/samples/`, ezdxf-checked;
b) edge-case harness (W 400 / 1500, rise below/above limits, no fitting board);
c) `verify/parity/psw-casement-layouts.mjs` read-only PSW↔PC report →
   `docs/handover/PSW-PARITY-REPORT.md`; d) "Rano dla Piotra" section in BUILD-LOG.

## 6. Verdict after fixes (expected)
✅ if T1–T7 pass the harness with the spec vectors and the regenerated sample shows
head 3 × 105 (or 4 × 95 under `'narrowest'`) and leaf 4 × 105 — never a single solid board.
