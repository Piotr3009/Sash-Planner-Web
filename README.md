# Sash Planner Web

Web production planner for sash window manufacturers. Reads estimates from
Supabase (or built-in mock data), turns each window's specification into cut
lists, optimised bar layouts, glass and hardware schedules, plus 2D technical
drawings and a 3D preview, and exports the result as PDF / Excel / DXF.

## Quick start

```bash
npm install
npm run dev    # http://localhost:5173
```

## With real Supabase data

```bash
cp .env.example .env
# Edit .env and add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# (use the same Supabase project as Prime Sash Windows)
npm run dev
```

The app expects:

- `estimates(id, estimate_number, status, created_at, total_price, project_name, …)`
- `estimate_items(id, estimate_id, window_number, window_type, width, height, quantity, unit_price, total_price, specification, …)`

The `specification` column is the JSON-encoded full configurator state. See
`src/engine/specification.js` for the adapter that normalises it into the
shape `calculations.js` expects.

## Without Supabase (mock mode)

If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing or contain
the placeholder values from `.env.example`, the app:

- Detects the missing config and shows a yellow **Mock data mode** badge.
- Loads three sample estimates from `src/mocks/mockEstimates.js`.
- Lets you sign in via the **Continue with mock data** button on `/login`.

This is the fastest way to evaluate the app.

## Build for production

```bash
npm run build
npm run preview
```

The build output lives in `dist/`. Deploy as static files (Vercel,
Cloudflare Pages, S3 + CloudFront, etc).

## Architecture

```
src/
├── App.jsx                    React Router routes + auth gate
├── main.jsx                   Vite entry
├── components/
│   ├── layout/                Header, Sidebar, AppLayout
│   ├── dashboard/             Estimate cards, window cards, cut-list panel
│   ├── viewer/                3D + 2D viewer wrappers
│   ├── export/                PDF/Excel/DXF UI
│   └── common/
├── pages/                     Login, Dashboard, EstimateDetail, WindowDetail
├── engine/
│   ├── calculations.js        Sash window cut-length engine (from Electron app)
│   ├── canvas-renderer.js     2D technical-drawing renderer (Canvas API)
│   ├── lists.js               Builders for cut/precut/glass/hardware lists
│   ├── optimizer.js           Best-fit-decreasing bar optimiser
│   └── specification.js       Supabase row + JSON spec → windowSpec adapter
├── 3d/
│   └── SashWindow3D.jsx       Slim parametric R3F viewer
├── stores/                    Zustand: auth, project
├── services/supabase.js       Lazy Supabase client + hasSupabaseConfig
├── mocks/mockEstimates.js     Sample data for Supabase-less mode
├── utils/                     PDF / Excel / DXF exporters
└── styles/index.css           Tailwind + components
```

### Source repos this project pulls from

- `Windows-App-electron-` (private) — `js/calculations.js` (verbatim) and
  `js/optimizer.js` (refactored to take settings as arg). 2D renderer
  adapted from `js/renderer.js` to remove globals.
- `Prime-Sash-Windows` (public) — referenced for the `specification` JSON
  shape and the configurator schema (window types, bars, horns, glass,
  ironmongery). 3D viewer is a slim re-implementation in the same R3F
  style as `3d-src/src/components/ParametricSashWindow.jsx` but built
  parametrically from `CONSTANTS` so geometry matches the cut list.

## Stack

- React 18 + Vite 5
- Zustand for state
- Tailwind CSS (custom `ink` / `accent` palette)
- React Router v6
- @react-three/fiber + @react-three/drei + three.js for the 3D viewer
- Canvas API for the 2D technical drawing
- Supabase JS client v2 for auth + data
- jsPDF + jspdf-autotable for PDF export
- SheetJS (xlsx) for Excel export
- Custom DXF generator (no external dep)

## Status

| Phase | Scope | State |
| ----- | ----- | ----- |
| 0 | Vite skeleton + routing + Tailwind layout | done |
| 1 | Supabase + mocks + estimate/window cards + calculations | done |
| 2 | 3D preview (slim parametric R3F viewer) | done |
| 3 | 2D technical drawing canvas | done |
| 4 | Cut list, pre-cut, optimiser, glass, hardware | done |
| 5 | PDF / Excel / DXF export | done |
| 6 | Manual creator (no estimate) | not started — out of scope per brief |
| 7 | SaaS multi-tenant | not started — out of scope per brief |

See `BUILD-LOG.md` for verdicts per phase and `BLOCKERS.md` for open questions.
