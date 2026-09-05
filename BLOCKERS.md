# BLOCKERS.md

Open questions, missing inputs, and improvements deferred for review by Piotr.

---

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
