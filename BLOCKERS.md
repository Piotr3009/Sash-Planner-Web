# BLOCKERS.md

Open questions, missing inputs, and improvements deferred for review by Piotr.

---

## 2026-09-05 — arched-casement-v1

### 0. [CRITICAL] The package spec is missing from the repository

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

### 1. D13 — number of pieces N (fewer pieces vs narrower board)

Default taken: **fewest pieces whose projected width (+ allowance) fits a stock board**.
Alternative printed in the DXF TEXT block: the plan on the **narrowest** stock board (more pieces).
Both plans come out of `planArchSegments`; only the default is drawn as PIECES.

### 2. D5 — finger joint profile

Piotr said "finger 10–11"; the chosen tool is the 15/16 profile. Taken: **15 / 16 / 3.8**
(`profile.arch.finger = { length: 15, depth: 16, pitch: 3.8 }`), printed as `FINGER 15/16/3.8` on
the TEXT layer. The FINGER layer carries the joint faces only (no teeth drawn).

### 3. Stark d50 head on the 5-axis CNC needs a d50 arbor

Process decision for Piotr — the DXF is unchanged either way (joint faces are plain lines; the
tool does the profile).

### 4. ASSUMPTIONS made because the spec is missing (each one is one edit away)

| # | Item | Taken | Alternative / where |
|---|------|-------|---------------------|
| 4.1 | Rise limits for free-rise shapes | segmental 0.10–0.45 W, gothic drop 0.55–0.85 W, three-centre 0.15–0.45 W | `ARCH_LIMITS.riseRatio` in `arch.js` |
| 4.2 | Gothic drop default rise | 0.70 W (PSW `GOTHIC_PROFILE_RATIO.drop`) | PSW also has `shallow` 0.60 |
| 4.3 | Three-centre haunch radius | rise × 0.5, crown radius from tangency | `THREE_CENTRE_HAUNCH_RATIO` |
| 4.4 | PSW `elliptical-arch` | mapped to `three-centre` (routable from arcs; ellipse is not) | keep as unsupported → export disabled |
| 4.5 | Rise vs height | only "straight part > 0" is enforced | PSW arched SASH uses ≥ 900 mm straight; casement has no rule in PSW |
| 4.6 | Branch name | CLAUDE.md says `claude/arched-casement-v1`; the session harness mandates `claude/arched-casement-v1-m23u5x` — commits pushed to BOTH | delete the one you don't want |

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
