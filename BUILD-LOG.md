# BUILD-LOG.md

Verdicts per phase, in execution order.

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
