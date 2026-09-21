# PSW port — one glazing-bar grid for the casement window (Piotr 21.09.2026)

Piotr, 21.09.2026, from a 3-light casement with a fanlight over the middle light: *"mamy 8 ale pod
fanem też mamy 8 a powinno być 6 i totalnie wyrównane z prawym i lewym skrzydłem"*. Today every
light spreads the same number of horizontal bars over its own height, so the light under the fan
gets the same 3 bars squeezed into a shorter glass and none of them lines up with the side lights.

**The rule (approved 21.09.2026):**

1. The horizontal bars are ONE grid for the whole window: the lines are set out on the tallest
   main light (equal panes, as today), and every main light shows the lines that cross its own glass.
2. A line whose sliver of glass against the light's edge (transom side) would be lower than **1/3 of
   a normal pane** is dropped (Piotr: *"niż 1/3 będzie ok"*).
3. Fanlights keep their own counts (fanH / fanV, fan2H / fan2V). Vertical bars stay per light.
4. The fan height stays whatever the client set. Nothing snaps. The fan decides how many lines fall
   under it: on a 2100 × 1400 131 with 3 H bars, fan 30 % → 2 bars (6 panes), fan 50 % → 1 bar.
5. Layouts where every main light has the same height (040L, 120, 130, 133, 022, 144, 013, 023 …)
   do not change at all. Only 131, 142, 052L / 052R (a fan over SOME lights) change.

PC (this repo) carries it from `main`: `src/engine/casementBarGrid.js` (the rule), the engine puts
the bars of every leaf on `derived.casement.leaves[i].bars` and every glass unit on
`derived.customGlassUnits[i].bars`; the 2D sheets, the glass rows, the glass PDF, the glazier DXF
and the astragal run read those numbers; the 3D `CasementWindow.jsx` applies the same rule to its
own glass rects. Harness: `node verify/arch/t33_bar_grid.mjs`.

**Until PSW is ported, a PSW estimate with a fan over some lights shows the squeezed bars in its 2D
drawing and its 3D, while PC makes the window on the grid.** PSW's price is by the spec count
(`js/price-calculator.js` line 353: `hBars + vBars`), not per light — the port does not touch it.

Line numbers below are PSW `main` at `b699610` (19.09.2026, "arches").

## 0. The helper — the same function in both places, verbatim

Copy this function once into the 3D (new file `3d-src/src/components/casement/casementBarGrid.js`)
and once as a static method of `EstimateRenderer` (`js/estimate-renderer.js`, no modules there).
It is the whole rule; PC's engine has the identical text.

```js
/** Wood glazing bar face (mm). */
export const BAR_WIDTH = 22;

/** Piotr 21.09.2026: a sliver lower than 1/3 of a normal pane drops the bar. */
export const MIN_SLIVER_RATIO = 1 / 3;

/**
 * ONE grid of horizontal bar lines for a casement window (Piotr 21.09.2026).
 * `lights` = one entry per pane, in ONE linear y axis (up or down, the rule is
 * symmetric): { role, lo, hi, lines } where lo < hi bound the pane's glass and
 * `lines` are the centre lines of the pane's OWN horizontal bars (the caller's
 * placement law, as if the pane stood alone).
 * Returns, per pane, { lines, aligned, dropped }:
 *   · fan / fan2 → own lines, untouched;
 *   · the tallest main light (the reference) and every main light with the
 *     same glass extent → own lines, untouched;
 *   · any other main light → the reference lines that cross its glass, minus
 *     the ones whose sliver against an edge is lower than minSliverRatio of a
 *     normal pane.
 */
export function alignMainBarLines(lights, { barW = BAR_WIDTH, minSliverRatio = MIN_SLIVER_RATIO } = {}) {
  const EPS = 1e-9;
  const roleOf = (l) => l.role || 'main';
  const ref = lights.reduce((best, l) => {
    if (roleOf(l) !== 'main') return best;
    return !best || (l.hi - l.lo) > (best.hi - best.lo) + EPS ? l : best;
  }, null);
  return lights.map((l) => {
    const own = { lines: (l.lines || []).slice(), aligned: false, dropped: 0 };
    if (!ref || roleOf(l) !== 'main') return own;
    if (Math.abs(l.lo - ref.lo) < EPS && Math.abs(l.hi - ref.hi) < EPS) return own;
    const refLines = (ref.lines || []).slice().sort((a, b) => a - b);
    if (!refLines.length) return own;
    // a normal pane = the glass between two reference bars (one bar: edge to bar)
    const pane = refLines.length > 1 ? (refLines[1] - refLines[0]) - barW : (refLines[0] - barW / 2) - ref.lo;
    const minSliver = pane * minSliverRatio;
    const lines = refLines.filter((c) => (c - barW / 2) - l.lo >= minSliver - EPS && l.hi - (c + barW / 2) >= minSliver - EPS);
    return { lines, aligned: true, dropped: refLines.length - lines.length };
  });
}
```

For `js/estimate-renderer.js` drop the `export` keywords and paste it as
`static alignMainBarLines(lights, opts = {}) { const { barW = 22, minSliverRatio = 1 / 3 } = opts; … }`
inside the `EstimateRenderer` class (next to `static casementLayoutDef`, line 1505).

## 1. `js/estimate-renderer.js` — the estimate drawing (`casementPreviewSVG`, lines 2154 – 2191)

`casBars` draws every panel's bars as equal splits of that panel's glass. Give it the horizontal
lines from outside and build them once for the whole window.

| line | now | change to |
|---|---|---|
| 2154 | `const casBars = (gx, gy, gw, gh, bH, bV) => {` | `const casBars = (gx, gy, gw, gh, bH, bV, hLines) => {` |
| 2161 – 2164 | `for (let j = 1; j <= bH; j++) { const cy = gy + gh * j / (bH + 1); if (gh > G.barW * (bH + 1)) s += …; }` | `const cys = Array.isArray(hLines) ? hLines : Array.from({ length: bH }, (_, j) => gy + gh * (j + 1) / (bH + 1));`<br>`cys.forEach((cy) => { if (gh > G.barW * (cys.length + 1)) s += \`<rect x="${gx}" y="${cy - G.barW / 2}" width="${gw}" height="${G.barW}" ${barStyle}/>\`; });` |

Then, between line 2170 (`const gcRealY = BOTTOM_FACE + innerH / 2;`) and the panel loop at 2171,
build the grid on the SAME glass rects the loop draws (fixed panel = the whole panel, opening leaf =
inset by `LEAF_FACE`; SVG y runs down, which the rule does not mind):

```js
        // ── One bar grid for the window (Piotr 21.09.2026): every main light on the tallest light's lines
        const lights = (def.panels || []).map(p => {
            const bH = p._role === 'fan' ? fanHN : p._role === 'fan2' ? fan2HN : hN;
            const px = gcx + p.x - p.w / 2;
            const py = SY(gcRealY + p.y + p.h / 2);
            const gy = p.hinge === 'fixed' ? py : py + LEAF_FACE;
            const gh = p.hinge === 'fixed' ? p.h : p.h - 2 * LEAF_FACE;
            const lines = Array.from({ length: bH }, (_, j) => gy + gh * (j + 1) / (bH + 1));
            return { role: p._role, lo: gy, hi: gy + gh, lines };
        });
        const barPlan = EstimateRenderer.alignMainBarLines(lights, { barW: G.barW });
```

and hand each panel its lines (the loop needs the index):

| line | now | change to |
|---|---|---|
| 2171 | `(def.panels \|\| []).forEach(p => {` | `(def.panels \|\| []).forEach((p, pi) => {` |
| 2178 | `svg += casBars(px, py, p.w, p.h, bH, bV);` | `svg += casBars(px, py, p.w, p.h, bH, bV, barPlan[pi].lines);` |
| 2188 | `svg += casBars(gx, gy, gw, gh, bH, bV);` | `svg += casBars(gx, gy, gw, gh, bH, bV, barPlan[pi].lines);` |

The estimate PDF and the customer portal render this same SVG, so both follow.

## 2. 3D — `3d-src/src/components/casement/`

### 2.1 `CasementWindow.jsx`

| line | now | change to |
|---|---|---|
| 32 | `import CasementPanel, { SASH_RAIL } from './CasementPanel';` | keep, and add below it: `import { alignMainBarLines } from './casementBarGrid.js';` |
| 664 – 666 | `  );` (end of the `layoutDef` memo) … `const W = mm(width);` | insert the block below between them |
| 697 | `const leafGap = 4;` (inside the panel loop) | delete this line — `leafGap` now lives above the loop (the block below) |
| 718 | `hBars={p._role === 'fan' ? fanHBars : p._role === 'fan2' ? fan2HBars : hBars}` | keep, and add the next line: `hBarPositions={hBarPlan[i]}` |

The block for line 664 (PC's `CasementWindow.jsx` has the identical text; `fan2HBars` is already
a prop in PSW):

```jsx
  // Leaf sits in rebate: extends 21mm into frame rebate on each side, minus 4mm gap
  const leafGap = 4;

  // ─── Horizontal glazing bars: ONE grid for the window (Piotr 21.09.2026) ───
  // Every main light's bars sit on the lines of the tallest main light; a light
  // under a fan shows the lines that cross its glass (a sliver lower than 1/3
  // of a pane drops the bar). Fans keep their own count.
  const hBarPlan = useMemo(() => {
    const lights = (layoutDef.panels || []).map((p) => {
      const glassH = (p.h + REBATE_STEP * 2 - leafGap * 2) - SASH_RAIL * 2;
      const lo = p.y - glassH / 2, hi = p.y + glassH / 2;
      const n = p._role === 'fan' ? fanHBars : p._role === 'fan2' ? fan2HBars : hBars;
      const lines = [];
      for (let i = 1; i <= (n || 0); i++) lines.push(lo + (glassH / (n + 1)) * i);
      return { role: p._role, lo, hi, lines };
    });
    return alignMainBarLines(lights, { barW: 22 }).map((a, i) => {
      const c = (lights[i].lo + lights[i].hi) / 2;
      return a.lines.map((y) => y - c);   // mm from the glass centre, y up
    });
  }, [layoutDef, hBars, fanHBars, fan2HBars]);
```

(`SASH_RAIL` and `REBATE_STEP` are already imported on lines 31 – 32.)

### 2.2 `CasementPanel.jsx` — pass the positions through

| line | now | change to |
|---|---|---|
| 123 | `function SashFrame({ width, height, mat, matInt, spacerColor, glassFinish, hBars, vBars, archRise = 0 }) {` | `… glassFinish, hBars, hBarPositions, vBars, archRise = 0 }) {` |
| 256 | `<CasementGlazing width={glassW} height={glassH} hBars={hBars} vBars={vBars} …` | `<CasementGlazing width={glassW} height={glassH} hBars={hBars} hBarPositions={hBarPositions} vBars={vBars} …` |
| 278 – 279 | `hBars = 0,` / `vBars = 0,` (the `CasementPanel` props) | add between them: `hBarPositions = null,   // mm from the glass centre (one grid for the window) — overrides the hBars split` |
| 332 | `<SashFrame … hBars={hBars} vBars={vBars} archRise={archRise} />` | `<SashFrame … hBars={hBars} hBarPositions={hBarPositions} vBars={vBars} archRise={archRise} />` |

### 2.3 `CasementGlazing.jsx` — draw the positions when given

| line | now | change to |
|---|---|---|
| 30 – 31 | `hBars = 0,` / `vBars = 0,` | add between them: `hBarPositions = null,   // mm from the glass centre, y up — the window grid (CasementWindow); null → equal split` |
| 148 | `for (let i = 1; i <= (hBars\|\|0); i++) items.push({ type:'h', x: 0, y: -H/2 + (H/(hBars+1))*i });` | `if (Array.isArray(hBarPositions)) hBarPositions.forEach((yMm) => items.push({ type:'h', x: 0, y: mm(yMm) }));`<br>`else for (let i = 1; i <= (hBars\|\|0); i++) items.push({ type:'h', x: 0, y: -H/2 + (H/(hBars+1))*i });` |
| 150 | `}, [hBars, vBars, W, H]);` | `}, [hBars, hBarPositions, vBars, W, H]);` |

`ArchedCasementWindow.jsx`, `FixFrameWindow.jsx` and the door components pass no `hBarPositions`,
so they keep the equal split — nothing to do there.

## 3. What to look at after the port

- Casement **131** (3 lights, fan over the middle), 2100 × 1400, 3 H × 1 V, fan at the default: side
  lights 8 panes, the light under the fan **6 panes**, its two bars exactly on the sides' lower two
  bars, the fan its own bars. The same in the 2D estimate drawing and in the 3D.
- Drag the fan height: at 50 % the light under the fan drops to 1 bar (4 panes); the sides never move.
- **133** (fans over all three lights) and **120** must look exactly as before.
- PC and PSW show the same picture for the same estimate.

## 4. Not done here, on purpose

- No `CASEMENT_LAYOUTS_VERSION` bump: the layout geometry (panels, mullions, transoms) is untouched.
- The PSW bar PRICE stays by the spec count (`hBars + vBars`), not by the bars a light really
  carries — PC does not price casement bars at all. If the price should follow the real count,
  that is a separate decision.
