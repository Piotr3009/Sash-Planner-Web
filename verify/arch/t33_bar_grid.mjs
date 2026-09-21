/**
 * t33 — one bar grid for the casement window (Piotr 21.09.2026).
 *
 * "Jedna siatka linii na całe okno": the horizontal glazing bars of every main
 * light sit on the lines of the tallest main light; a light under a fanlight
 * shows the lines that cross its glass and drops a line whose sliver would be
 * lower than 1/3 of a normal pane. Fans keep their own counts, the fan height
 * is whatever the client set. Engine: src/engine/casementBarGrid.js.
 *
 * On the REAL data path (PC item → normaliseToWindowSpec → deriveWindowData →
 * lists / sheets / glazier DXF) this harness asserts:
 *   1  131 (3 lights, fan over the middle) 2100 × 1400, 3H × 1V, fan 30 %:
 *      side lights 3 bars, the light under the fan 2 bars (8 / 6 / 8 panes)
 *      ON THE SAME frame lines as the sides, the fan its own 0 H / 1 V;
 *      an independent formula (daylight + equal panes + the 1/3 rule) gives
 *      the same lines and the same drop;
 *   2  the fan height decides how many lines fall under it: 15 % → 2 bars
 *      (the transom band eats line 1), 50 % → 1 bar; the 1/3 boundary itself
 *      (on one bar, where it lies inside the fan clamp), 1 mm either side;
 *   3  every consumer prints the engine's numbers: glass rows (counts, label,
 *      axes), astragal beading run, elevation SVG (the middle light's bar
 *      rects reuse the sides' y attributes), leaf and glass sheets, glazier
 *      DXF (axes mirrored to y-up), the 3D plan (same rule on the 3D rects);
 *   4  equal-height layouts are untouched: 040L, 120, 133 (all under fans),
 *      013 (3-tier) keep their own counts, aligned = false, dropped = 0;
 *   5  142 (fans over the two centre lights) and 052L (fan left) follow the rule;
 *   6  wiring evidence: the 3D components carry hBarPositions, no sheet
 *      recomputes bars (no computeBarPositions / casementBarCounts left in the
 *      casement sheets), lists / PDF / DXF read barAxes.
 *
 * Run: node verify/arch/t33_bar_grid.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, bundleTree, renderSheets, deriveItem } from './lib/sheets.mjs';

const M = await bundleTree(resolve(ROOT, 'src'), 't33', [
  ['barGrid', 'engine/casementBarGrid.js'],
  ['layouts', 'engine/casementLayouts.js'],
  ['glassDxf', 'utils/glassDxfExport.js'],
]);
const P = M.profile.DEFAULT_CASEMENT_PROFILE;
const STILE = P.elements.leafStile.face;   // 67
const BAR = M.barGrid.BAR_WIDTH;           // 22

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const sameList = (a, b, tol = 1e-6) => a.length === b.length && a.every((v, i) => near(v, b[i], tol));
const section = (t) => console.log(`\n== ${t} ==`);

const cas = (name, width, height, fc) => deriveItem(M, { id: 'w_' + name, width, height, name }, { windowCategory: 'casement', ...fc });
const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');

// ── independent formula: equal panes on the daylight, then the grid + 1/3 rule ──
function ownLines(rect, hCount) {
  const top = rect.y + STILE, glassH = rect.h - 2 * STILE;
  const pane = (glassH - hCount * BAR) / (hCount + 1);
  return Array.from({ length: hCount }, (_, j) => top + (j + 1) * pane + j * BAR + BAR / 2);
}
function gridLines(derived, hCount, i) {
  // reference = tallest main light; a shorter main keeps the reference lines with a sliver ≥ pane / 3
  const panels = derived.casement.layoutDef.panels;
  const rects = derived.casement.leafRects;
  let ref = -1;
  panels.forEach((p, k) => { if ((p._role || 'main') === 'main' && (ref < 0 || rects[k].h > rects[ref].h)) ref = k; });
  const refLines = ownLines(rects[ref], hCount);
  const pane = (rects[ref].h - 2 * STILE - hCount * BAR) / (hCount + 1);
  const lo = rects[i].y + STILE, hi = rects[i].y + rects[i].h - STILE;
  if (rects[i].h === rects[ref].h && rects[i].y === rects[ref].y) return { lines: refLines, dropped: 0 };
  const kept = refLines.filter((c) => (c - BAR / 2) - lo >= pane / 3 - 1e-9 && hi - (c + BAR / 2) >= pane / 3 - 1e-9);
  return { lines: kept, dropped: refLines.length - kept.length };
}

// ═══════════════════════════════════════════════════════════════════════════
section('1 — 131 (fan over the middle) 2100 × 1400, 3H × 1V, fan 30 %: 8 / 6 / 8 on the same lines');
const W131 = cas('G131', 2100, 1400, { casementLayout: '131', casementHBars: 3, casementVBars: 1, casementFanVBars: 1, casementMiddleWidth: 800 });
const D = W131.derived;
const L = D.casement.leaves;
const roles = D.casement.layoutDef.panels.map((p) => p._role);
check('panel roles: main (left), fan, main (under the fan), main (right)', roles.join(',') === 'main,fan,main,main', roles.join(','));
check('side lights: 3 H bars, own lines (aligned false, dropped 0)', L[0].bars.counts.h === 3 && L[3].bars.counts.h === 3 && !L[0].bars.aligned && !L[3].bars.aligned && L[0].bars.dropped === 0, JSON.stringify([L[0].bars.counts, L[3].bars.counts]));
check('the light under the fan: 2 H bars, aligned, 1 dropped (6 panes)', L[2].bars.counts.h === 2 && L[2].bars.aligned === true && L[2].bars.dropped === 1 && L[2].bars.counts.v === 1, JSON.stringify(L[2].bars.counts));
check('the fan keeps its own bars: 0 H × 1 V', L[1].bars.counts.h === 0 && L[1].bars.counts.v === 1 && !L[1].bars.aligned, JSON.stringify(L[1].bars.counts));
const sideY = L[0].bars.frame.hBars.map((b) => b.cy);
const midY = L[2].bars.frame.hBars.map((b) => b.cy);
check(`the middle light's lines are EXACTLY the 2nd and 3rd side lines (frame y ${midY.map((v) => v.toFixed(2)).join(' / ')})`, midY.length === 2 && midY[0] === sideY[1] && midY[1] === sideY[2], JSON.stringify([sideY, midY]));
check('right light = left light, bit for bit', JSON.stringify(L[3].bars.frame.hBars) === JSON.stringify(L[0].bars.frame.hBars));
{
  const e0 = gridLines(D, 3, 0), e2 = gridLines(D, 3, 2);
  check('independent formula: side lines match the engine', sameList(e0.lines, sideY), JSON.stringify([e0.lines, sideY]));
  check('independent formula: the light under the fan keeps lines 2 and 3, drops 1', sameList(e2.lines, midY) && e2.dropped === 1, JSON.stringify([e2.lines, midY]));
  // leaf-local = frame − leaf y; the unit axis = local − (stile − glassInset)
  const r2 = D.casement.leafRects[2];
  const localY = L[2].bars.local.hBars.map((b) => b.cy);
  check('leaf coordinates = frame lines − leaf y', sameList(localY, midY.map((y) => y - r2.y)), JSON.stringify(localY));
  const unit = D.customGlassUnits[2];
  check('glass unit axes = leaf lines − (stile − glassInset) = − 54.5; counts on the unit', sameList(unit.bars.y, localY.map((y) => y - (STILE - P.geometry.glassInset))) && unit.bars.h === 2 && unit.bars.v === 1, JSON.stringify(unit.bars));
  const sliver = (midY[0] - BAR / 2) - (r2.y + STILE);
  const pane = (D.casement.leafRects[0].h - 2 * STILE - 3 * BAR) / 4;
  check(`the top pane under the fan is a sliver of ${sliver.toFixed(1)} (≥ pane/3 = ${(pane / 3).toFixed(1)}); the dropped line would have left ${((sideY[0] - BAR / 2) - (r2.y + STILE)).toFixed(1)}`, sliver >= pane / 3 && (sideY[0] - BAR / 2) - (r2.y + STILE) < pane / 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — the fan height decides: 15 % → 2 bars (the transom band eats line 1), 50 % → 1 bar, the 1/3 boundary ± 1 mm');
{
  const innerH = 1400 - P.elements.frameHead.face - P.elements.frameCill.face;
  const axisFor = (ratio) => M.layouts.FAN_AXIS_OFFSET_TOP + innerH * ratio;   // fanlightAxis = frame top → transom axis
  const low = cas('G131L', 2100, 1400, { casementLayout: '131', casementHBars: 3, casementVBars: 1, fanlightAxis: axisFor(0.15) }).derived;
  const high = cas('G131H', 2100, 1400, { casementLayout: '131', casementHBars: 3, casementVBars: 1, fanlightAxis: axisFor(0.5) }).derived;
  // fan 15 %: the transom axis sits 291.6 from the top; transom land 13 + gap 4 + leaf rail 67 put the
  // lower daylight at 375.6, the sides' first line at 405.5 — a 19 mm sliver, under pane/3 (92) → dropped
  const lowSliver = (low.casement.leaves[0].bars.frame.hBars[0].cy - BAR / 2) - (low.casement.leafRects[2].y + STILE);
  check(`fan 15 %: line 1 would leave a ${lowSliver.toFixed(1)} mm sliver → dropped, the light under the fan carries 2 lines (independent formula ${gridLines(low, 3, 2).lines.length})`,
    low.casement.leaves[2].bars.counts.h === 2 && low.casement.leaves[2].bars.dropped === 1 && gridLines(low, 3, 2).lines.length === 2 && lowSliver < ((low.casement.leafRects[0].h - 2 * STILE - 3 * BAR) / 4) / 3, JSON.stringify(low.casement.leaves[2].bars.counts));
  check('fan 15 %: the sides are untouched (3 own lines)', low.casement.leaves[0].bars.counts.h === 3 && !low.casement.leaves[0].bars.aligned);
  check('fan 50 %: the light under it carries 1 line (4 panes), dropped 2', high.casement.leaves[2].bars.counts.h === 1 && high.casement.leaves[2].bars.dropped === 2, JSON.stringify(high.casement.leaves[2].bars.counts));
  check('fan 50 %: that one line IS the sides\' third line', high.casement.leaves[2].bars.frame.hBars[0].cy === high.casement.leaves[0].bars.frame.hBars[2].cy);
  // the boundary, on 1 H bar (with 3 bars the boundary lies below the 15 % fan clamp): fan axis T such
  // that the sliver above the sides' line = pane / 3 exactly, then ± 1 mm
  const g = P.geometry;
  const one = cas('G131_1', 2100, 1400, { casementLayout: '131', casementHBars: 1, casementVBars: 1 }).derived;
  const side = one.casement.leafRects[0];
  const pane = (side.h - 2 * STILE - 1 * BAR) / 2;
  const line1 = side.y + STILE + pane + BAR / 2;
  // lower leaf top = T + transomLandBelow + gapBelowTransom; sliver = (line1 − 11) − (leafTop + stile)
  const T0 = (line1 - BAR / 2) - pane / 3 - g.transomLandBelow - g.gapBelowTransom - STILE;
  const ratio0 = (T0 - M.layouts.FAN_AXIS_OFFSET_TOP) / innerH;
  check(`the boundary fan axis ${T0.toFixed(1)} is inside the 15..50 % clamp (${(ratio0 * 100).toFixed(1)} %)`, ratio0 > 0.15 && ratio0 < 0.5);
  const keep = cas('G131K', 2100, 1400, { casementLayout: '131', casementHBars: 1, casementVBars: 1, fanlightAxis: T0 - 1 }).derived;
  const drop = cas('G131D', 2100, 1400, { casementLayout: '131', casementHBars: 1, casementVBars: 1, fanlightAxis: T0 + 1 }).derived;
  check(`boundary: fan axis ${(T0 - 1).toFixed(1)} (sliver 1 mm over pane/3) keeps the line`, keep.casement.leaves[2].bars.counts.h === 1 && keep.casement.leaves[2].bars.frame.hBars[0].cy === keep.casement.leaves[0].bars.frame.hBars[0].cy, JSON.stringify(keep.casement.leaves[2].bars.counts));
  check(`boundary: fan axis ${(T0 + 1).toFixed(1)} (sliver 1 mm under pane/3) drops it — 0 bars, 2 panes`, drop.casement.leaves[2].bars.counts.h === 0 && drop.casement.leaves[2].bars.dropped === 1, JSON.stringify(drop.casement.leaves[2].bars.counts));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — every consumer prints the engine numbers');
{
  const rows = M.lists.buildGlassListForWindow(D, W131.spec);
  check('glass rows: sides 3H × 1V, fan 0H × 1V, the light under the fan 2H × 1V (label + counts)',
    rows[0].barsH === 3 && rows[3].barsH === 3 && rows[1].barsH === 0 && rows[1].barsV === 1 && rows[2].barsH === 2 && rows[2].bars === '2H × 1V astragal', JSON.stringify(rows.map((r) => r.bars)));
  check('glass rows carry the axes (barAxes.y) — 2 for the middle unit, 3 for a side unit', rows[2].barAxes.y.length === 2 && rows[0].barAxes.y.length === 3 && sameList(rows[2].barAxes.y, D.customGlassUnits[2].bars.y), JSON.stringify(rows[2].barAxes));
  // astragal run = Σ h·W + v·H over the units with the ACTUAL counts
  const run = D.customGlassUnits.reduce((a, u) => a + u.bars.h * u.width + u.bars.v * u.height, 0);
  const bead = D.components.beading.find((b) => b.elementName === 'C-TRIANGLE BEADING (EXT)');
  const oldRun = D.customGlassUnits.reduce((a, u) => a + (u.role === 'fan' ? 0 : 3) * u.width + 1 * u.height, 0);
  check(`astragal beading = Σ actual bars × 1.15 (${Math.round(run * 1.15)}), not the spec count (${Math.round(oldRun * 1.15)})`, bead && bead.length === Math.round(run * 1.15) && Math.round(run * 1.15) < Math.round(oldRun * 1.15), JSON.stringify(bead));
  // sheets
  const S = renderSheets(M, W131.spec, D);
  const rects = [...S.elevation.matchAll(/<rect[^>]*?(?:x="([^"]+)")[^>]*?y="([^"]+)"[^>]*?width="([^"]+)"[^>]*?height="22"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]) }));
  const sideW = D.casement.leafRects[0].w - 2 * STILE, midW = D.casement.leafRects[2].w - 2 * STILE;
  const sideRects = rects.filter((r) => near(r.w, sideW)), midRects = rects.filter((r) => near(r.w, midW));
  check(`elevation SVG: ${sideRects.length} side h-bar rects (3 + 3) and ${midRects.length} middle (2 under the fan, 0 in the fan)`, sideRects.length === 6 && midRects.length === 2, JSON.stringify(rects.map((r) => [r.w, r.y])));
  const sideYs = new Set(sideRects.map((r) => r.y));
  check('elevation SVG: the middle rects reuse the sides\' y attributes exactly', midRects.every((r) => sideYs.has(r.y)), JSON.stringify([...sideYs, midRects.map((r) => r.y)]));
  const leafGroups = M.cdu.groupCasementLeaves(D);
  const midGroup = leafGroups.find((gp) => gp.rep === 2);
  const midLeaf = S.leaf.find((s) => s.key === midGroup.key).svg;
  // the leaf sheet draws each bar as top/bottom edge lines at Y(hb.top) / Y(hb.bot), oy = 80 × max(leafW, leafH) / 500
  const lf2 = D.casement.leaves[2];
  const oyLeaf = 80 * (Math.max(lf2.leafW, lf2.leafH) / 500);
  const leafEdges = lf2.bars.local.hBars.flatMap((hb) => [oyLeaf + hb.top, oyLeaf + hb.bot]);
  const ownDropped = ownLines(D.casement.leafRects[2], 3)[0] - D.casement.leafRects[2].y;   // the line its own count would have put first
  check(`leaf sheet of the light under the fan: the 2 engine bars' edges are drawn (${leafEdges.length} y values), the own-count line is NOT`,
    leafEdges.every((y) => midLeaf.includes(`y1="${y}" x2=`) || midLeaf.includes(`y1="${y}"`)) && !midLeaf.includes(`y1="${oyLeaf + ownDropped - BAR / 2}"`), JSON.stringify(leafEdges));
  const glassGroups = M.cdu.groupCasementGlass(D, W131.spec);
  const midGlass = S.glass.find((s) => s.key === glassGroups.find((gp) => gp.rep === 2).key).svg;
  const u2 = D.customGlassUnits[2];
  const oyGlass = 80 * (Math.max(u2.width, u2.height) / 500);
  const spacerEdges = u2.bars.y.flatMap((cy) => [oyGlass + (cy - 9), oyGlass + (cy + 9)]);
  check(`glass sheet of that unit: the 2 spacer bands (18) sit on the engine axes (${u2.bars.y.map((v) => v.toFixed(1)).join(' / ')})`,
    spacerEdges.every((y) => midGlass.includes(`y1="${y}"`)), JSON.stringify(spacerEdges));
  // glazier DXF: axes mirrored to y-up
  const bars = M.glassDxf.rectBarsForRow(rows[2], W131.spec, D);
  const hAx = bars.filter((b) => b.role === 'h').map((b) => b.from[1]).sort((a, b) => a - b);
  check('glazier DXF: the middle unit has H1, H2 at unitH − axis (y up), V1 at the axis', hAx.length === 2 && sameList(hAx, rows[2].barAxes.y.map((y) => rows[2].height - y).sort((a, b) => a - b)) && bars.filter((b) => b.role === 'v').length === 1, JSON.stringify(bars.map((b) => [b.id, b.from])));
  // 3D plan: the same rule on the 3D glass rects (equal split reference, y up)
  const innerW = 2100 - 2 * 68, innerH = 1400 - 136;
  const def = M.layouts.resolveCasementLayout({ code: '131', innerW, innerH, height: 1400, fanlightRatio: 0.3, fan2Ratio: 0.3, middleSectionMm: 800, geo: { frameFace: 68, bottomFace: 68, mullionW: 68 } });
  const lights = def.panels.map((p) => {
    const glassH = (p.h + 21 * 2 - 4 * 2) - 64 * 2;
    const lo = p.y - glassH / 2, hi = p.y + glassH / 2;
    const n = p._role === 'fan' ? 0 : 3;
    return { role: p._role, lo, hi, lines: Array.from({ length: n }, (_, i) => lo + (glassH / (n + 1)) * (i + 1)) };
  });
  const plan = M.barGrid.alignMainBarLines(lights, { barW: 22 });
  check('3D plan (CasementWindow rule on its own rects): sides 3, fan 0, the light under the fan 2 lines = the sides\' lower two (y up)', plan[0].lines.length === 3 && plan[1].lines.length === 0 && plan[2].lines.length === 2 && plan[2].aligned && sameList(plan[2].lines, plan[0].lines.slice(0, 2)), JSON.stringify(plan.map((p) => p.lines)));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — equal-height layouts untouched (own counts, aligned false)');
for (const [code, w, h, fc] of [
  ['040L', 1000, 1500, { casementHBars: 1, casementVBars: 2 }],
  ['120', 1200, 1200, { casementHBars: 2, casementVBars: 1 }],
  ['133', 1800, 1500, { casementHBars: 3, casementVBars: 1, casementFanHBars: 1 }],
  ['013', 700, 2400, { casementHBars: 2, casementVBars: 1, casementFanHBars: 1, casementFan2HBars: 1 }],
]) {
  const d = cas('E' + code, w, h, { casementLayout: code, ...fc }).derived;
  const mains = d.casement.leaves.filter((l, i) => d.casement.layoutDef.panels[i]._role === 'main');
  const fans = d.casement.leaves.filter((l, i) => d.casement.layoutDef.panels[i]._role !== 'main');
  check(`${code}: every main light ${fc.casementHBars}H own (aligned false, dropped 0); fans keep fanH`,
    mains.every((l) => l.bars.counts.h === fc.casementHBars && !l.bars.aligned && l.bars.dropped === 0) &&
    fans.every((l, i) => l.bars.counts.h === (d.casement.layoutDef.panels.find((p) => p._role === 'fan2') && i === fans.length - 1 ? fc.casementFan2HBars : fc.casementFanHBars)),
    JSON.stringify(d.casement.leaves.map((l) => l.bars.counts)));
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — 142 (fans over the two centre lights) and 052L (fan left)');
{
  const d142 = cas('G142', 2400, 1500, { casementLayout: '142', casementHBars: 3, casementVBars: 1 }).derived;
  const c = d142.casement.leaves.map((l) => l.bars.counts.h);
  check('142: end lights 3, fans 0, the two centre lights under the fans 2 each, on the end lights\' lines', c.join(',') === '3,0,2,0,2,3' && d142.casement.leaves[2].bars.frame.hBars[0].cy === d142.casement.leaves[0].bars.frame.hBars[1].cy && d142.casement.leaves[4].bars.frame.hBars[1].cy === d142.casement.leaves[0].bars.frame.hBars[2].cy, c.join(','));
  const d052 = cas('G052', 1200, 1500, { casementLayout: '052L', casementHBars: 2, casementVBars: 0 }).derived;
  const c2 = d052.casement.leaves.map((l) => l.bars.counts.h);
  const e = gridLines(d052, 2, 1);
  check(`052L: fan 0, the light under it ${c2[1]} (independent formula ${e.lines.length}), the right light 2`, c2[0] === 0 && c2[2] === 2 && c2[1] === e.lines.length && sameList(d052.casement.leaves[1].bars.frame.hBars.map((b) => b.cy), e.lines), c2.join(','));
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — wiring evidence');
{
  const cw = src('3d/components/casement/CasementWindow.jsx');
  check('CasementWindow.jsx: alignMainBarLines imported from the engine, hBarPlan built on the 3D glass rects, hBarPositions passed per panel', /alignMainBarLines/.test(cw) && /hBarPlan/.test(cw) && /hBarPositions=\{hBarPlan\[i\]\}/.test(cw));
  const cp = src('3d/components/casement/CasementPanel.jsx');
  check('CasementPanel.jsx hands hBarPositions to SashFrame → CasementGlazing', (cp.match(/hBarPositions/g) || []).length >= 4);
  const cg = src('3d/components/casement/CasementGlazing.jsx');
  check('CasementGlazing.jsx: positions win over the equal split when given', /Array\.isArray\(hBarPositions\)/.test(cg) && /else for \(let i = 1; i <= \(hBars\|\|0\)/.test(cg));
  for (const f of ['CasementElevation2D.jsx', 'CasementLeafDetail2D.jsx', 'CasementGlassDrawing2D.jsx']) {
    const s = src('components/drawings/' + f);
    check(`${f}: no bar recomputation (no computeBarPositions / casementBarCounts), reads the engine bars`, !/computeBarPositions|casementBarCounts/.test(s) && /\.bars/.test(s));
  }
  check('lists.js: the glass row takes counts + axes from the unit (u.bars), no casementBarCounts', /u\.bars/.test(src('engine/lists.js')) && !/casementBarCounts/.test(src('engine/lists.js')));
  check('glassPdfExport.js: the sketch draws row.barAxes; glassDxfExport.js: rectBarsForRow reads row.barAxes', /g\.barAxes/.test(src('utils/glassPdfExport.js')) && /row\.barAxes/.test(src('utils/glassDxfExport.js')));
  check('calculations.js: the astragal run uses the unit\'s own bars (g.bars.h / g.bars.v)', /g\.bars\.h \* \(g\.width/.test(src('engine/calculations.js')));
  check('casementDrawUtils.js and drawingUtils.jsx re-export the engine helpers (one law, one place)', /export \{ casementBarCounts \}/.test(src('components/drawings/casementDrawUtils.js')) && /export \{ computeBarPositions \}/.test(src('components/drawings/drawingUtils.jsx')));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('ALL PASS');
