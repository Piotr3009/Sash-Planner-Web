# BLOCKERS.md

Open questions, missing inputs, and improvements deferred for review by Piotr.

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
