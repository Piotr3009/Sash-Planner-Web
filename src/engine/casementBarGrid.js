/**
 * casementBarGrid.js — ONE grid of glazing-bar lines for a casement window.
 *
 * Piotr, 21.09.2026: "jedna siatka linii na całe okno". The horizontal bars
 * of every main light sit on the SAME lines as the full-height lights. The
 * lines are set out on the tallest main light; a shorter main light (under a
 * fanlight, above a bottom fan) shows the lines that cross its own glass and
 * drops a line whose sliver of glass against the light's edge would be lower
 * than 1/3 of a normal pane ("niż 1/3 będzie ok"). Fanlights keep their own
 * counts (fanH / fanV, fan2H / fan2V). The fanlight height stays whatever the
 * client set — nothing snaps.
 *
 * Who reads what:
 *   · engine (calculations.js deriveCasementWindow) → casementLeafBars() once
 *     per window → derived.casement.leaves[i].bars (frame + leaf coordinates)
 *     and derived.customGlassUnits[i].bars (glass-unit coordinates);
 *   · 2D sheets (elevation, leaf, glass), the glass rows, the glass PDF, the
 *     glazier DXF and the astragal run read those numbers — nothing recomputes;
 *   · the 3D preview (CasementWindow.jsx, a PSW parity file) applies the same
 *     rule, alignMainBarLines(), to its own glass rects.
 */

/** Wood glazing bar face (mm) — the 2D sheets' constant. */
export const BAR_WIDTH = 22;

/** Piotr 21.09.2026: a sliver lower than 1/3 of a normal pane drops the bar. */
export const MIN_SLIVER_RATIO = 1 / 3;

/** Bar counts per pane role — main lights share h/v, fans have their own. */
export function casementBarCounts(bars, role) {
  const b = bars || {};
  if (role === 'fan') return { v: b.fanV || 0, h: b.fanH || 0 };
  if (role === 'fan2') return { v: b.fan2V || 0, h: b.fan2H || 0 };
  return { v: b.v || 0, h: b.h || 0 };
}

/**
 * Bar positions of ONE glass area: equal panes between wood bars of width
 * barW (the sash / casement sheet law). Origin = the glass top-left corner
 * of whatever coordinate system the caller passes (frame, leaf, sheet).
 */
export function computeBarPositions({ glassX, glassY, glassW, glassH, vCount, hCount, barW }) {
  const paneW = vCount > 0 ? Math.max((glassW - vCount * barW) / (vCount + 1), 0) : glassW;
  const paneH = hCount > 0 ? Math.max((glassH - hCount * barW) / (hCount + 1), 0) : glassH;
  const vBars = [];
  for (let i = 0; i < vCount; i++) {
    const left = glassX + (i + 1) * paneW + i * barW;
    vBars.push({ cx: left + barW / 2, left, right: left + barW });
  }
  const hBars = [];
  for (let j = 0; j < hCount; j++) {
    const top = glassY + (j + 1) * paneH + j * barW;
    hBars.push({ cy: top + barW / 2, top, bot: top + barW });
  }
  return { vBars, hBars, paneW, paneH };
}

/**
 * The rule. `lights` = one entry per pane, in ONE linear y axis (up or down,
 * the rule is symmetric): { role, lo, hi, lines } where lo < hi bound the
 * pane's glass and `lines` are the centre lines of the pane's OWN horizontal
 * bars (the caller's placement law, as if the pane stood alone).
 * Returns, per pane, { lines, aligned, dropped }:
 *   · fan / fan2 → own lines, untouched;
 *   · the tallest main light (the reference) and every main light with the
 *     same glass extent → own lines, untouched (byte-identical to before);
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

/**
 * Engine entry — the bars of every leaf of a casement window, once.
 *   leafRects: derived.casement.leafRects (mm, origin = frame top-left, y down)
 *   panels:    layoutDef.panels (roles)
 *   bars:      windowSpec.casement.bars
 *   stile:     leaf member face (the daylight is the leaf inset by it)
 * Returns per leaf:
 *   { counts: { v, h }, aligned, dropped,
 *     frame: { vBars, hBars },   // frame coordinates (the elevation sheet)
 *     local: { vBars, hBars } }  // leaf coordinates (leaf sheet, glass unit)
 * where vBars = [{ cx, left, right }], hBars = [{ cy, top, bot }].
 * The counts are the bars the leaf REALLY carries (a light under a fan may
 * carry fewer than windowSpec asks for).
 */
export function casementLeafBars({ leafRects, panels, bars, stile, barW = BAR_WIDTH }) {
  const per = (leafRects || []).map((r, i) => {
    const role = panels?.[i]?._role || 'main';
    const counts = casementBarCounts(bars, role);
    const glassW = r.w - 2 * stile, glassH = r.h - 2 * stile;
    const frame = computeBarPositions({ glassX: r.x + stile, glassY: r.y + stile, glassW, glassH, vCount: counts.v, hCount: counts.h, barW });
    const local = computeBarPositions({ glassX: stile, glassY: stile, glassW, glassH, vCount: counts.v, hCount: counts.h, barW });
    return { role, counts, r, glassH, frame, local };
  });
  const lights = per.map((p) => ({ role: p.role, lo: p.r.y + stile, hi: p.r.y + stile + p.glassH, lines: p.frame.hBars.map((b) => b.cy) }));
  const aligned = alignMainBarLines(lights, { barW });
  return per.map((p, i) => {
    const a = aligned[i];
    const strip = (pos) => ({ vBars: pos.vBars, hBars: pos.hBars });
    if (!a.aligned) return { counts: p.counts, aligned: false, dropped: 0, frame: strip(p.frame), local: strip(p.local) };
    const band = (cy) => ({ cy, top: cy - barW / 2, bot: cy + barW / 2 });
    return {
      counts: { v: p.counts.v, h: a.lines.length },
      aligned: true,
      dropped: a.dropped,
      frame: { vBars: p.frame.vBars, hBars: a.lines.map(band) },
      local: { vBars: p.local.vBars, hBars: a.lines.map((cy) => band(cy - p.r.y)) },
    };
  });
}

/**
 * The same bars in GLASS-UNIT coordinates (origin = the unit's top-left
 * corner; the unit reaches glassInset beyond the daylight on every side).
 * Returns { x: [...], y: [...] } — bar centre lines, sorted.
 */
export function leafBarsToUnit(leafBars, stile, glassInset) {
  const origin = stile - glassInset;
  return {
    x: leafBars.local.vBars.map((b) => b.cx - origin),
    y: leafBars.local.hBars.map((b) => b.cy - origin),
  };
}
