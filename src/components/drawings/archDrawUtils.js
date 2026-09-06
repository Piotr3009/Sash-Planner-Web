/**
 * archDrawUtils.js — ArcChain (src/engine/arch.js) → SVG path data for the
 * casement 2D sheets (arched-casement-v2 night 4, spec §4 D).
 *
 * ONE contour rule (Piotr 06.09): what the screen draws and what goes to the
 * glazier / CNC DXF is the same ArcChain from `derived.arch`. These helpers
 * only re-express an arc { cx, cy, r, a0, a1 } as an SVG `A` command — the
 * centre and the radius are the chain's own numbers, never re-derived and
 * never approximated by a Bezier.
 *
 * Coordinate frames:
 *   arch frame   axis x = 0, arch-start (springing) line y = 0, y UP;
 *                arcs run counter-clockwise a0 → a1 (right → apex → left)
 *   glass frame  glass unit bottom-left corner, y UP (derived.arch.glassOutline)
 *   sheet        mm, y DOWN (SVG). A transform `tx(x, y) → [X, Y]` maps a
 *                frame into the sheet; both frames flip y, so a counter-
 *                clockwise arc in the frame is drawn counter-clockwise on the
 *                screen = SVG sweep-flag 0 (sweep 1 when the arc is traversed
 *                backwards, a1 → a0).
 * Pure module: no React, no theme — sizes / colours stay in the sheets.
 */
import { arcPoint, arcSpan } from '../../engine/arch.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const num = (v) => String(r3(v));
const pt = (p) => `${num(p[0])} ${num(p[1])}`;

/** arch frame → sheet: x = frameWidth/2 + x + dx, y = rise − y + dy (dx / dy shift the sheet origin, e.g. into leaf coordinates). */
export function archToSheet(frameWidth, rise, dx = 0, dy = 0) {
  const hw = Number(frameWidth) / 2;
  return (x, y) => [hw + x + dx, rise - y + dy];
}

/** glass frame → sheet: the unit's top-left corner on the sheet and its height. */
export function glassToSheet(unitLeft, unitTop, unitHeight) {
  return (x, y) => [unitLeft + x, unitTop + unitHeight - y];
}

/** SVG `A` command for one arc, traversed a0 → a1 (forward) or a1 → a0 (reverse), from the current point. */
export function svgArc(arc, tx, reverse = false) {
  const end = tx(...arcPoint(arc, reverse ? arc.a0 : arc.a1));
  const large = arcSpan(arc) > Math.PI + 1e-9 ? 1 : 0;
  const sweep = reverse ? 1 : 0;
  return `A ${num(arc.r)} ${num(arc.r)} 0 ${large} ${sweep} ${pt(end)}`;
}

/** Sheet point where a chain starts (right springing end) / ends (left end). */
export const chainStart = (arcs, tx) => tx(...arcPoint(arcs[0], arcs[0].a0));
export const chainEnd = (arcs, tx) => tx(...arcPoint(arcs[arcs.length - 1], arcs[arcs.length - 1].a1));

/** `A` commands for a whole chain from its start (forward) or from its end (reverse). */
export function chainArcsD(arcs, tx, reverse = false) {
  if (!reverse) return arcs.map((a) => svgArc(a, tx, false)).join(' ');
  return [...arcs].reverse().map((a) => svgArc(a, tx, true)).join(' ');
}

/**
 * Closed outline of the region under a chain: bottom-left → bottom-right →
 * up the right side to the chain start → arcs → left end → close. The sides
 * sit at the chain's own end x (rule C: the chain starts vertical), the
 * bottom at `yBottom` (sheet).
 */
export function archedOutlineD(arcs, tx, yBottom) {
  const s = chainStart(arcs, tx), e = chainEnd(arcs, tx);
  return `M ${num(e[0])} ${num(yBottom)} H ${num(s[0])} V ${num(s[1])} ${chainArcsD(arcs, tx)} Z`;
}

/** Closed contour of a chain that returns to its start (v3 Block 3: the two half-arcs of a circle) — no straight edge. */
export function closedChainD(arcs, tx) {
  const s = chainStart(arcs, tx);
  return `M ${pt(s)} ${chainArcsD(arcs, tx)} Z`;
}

/** Closed band between two chains of the same ring (outer forward, inner backward), cut on the springing line — ringPoly for SVG. */
export function ringBandD(outer, inner, tx) {
  const os = chainStart(outer, tx);
  const ie = chainEnd(inner, tx);
  return `M ${pt(os)} ${chainArcsD(outer, tx)} L ${pt(ie)} ${chainArcsD(inner, tx, true)} Z`;
}

/**
 * Band of a glazing bar (derived.arch.bars item) of half width `hw` (mm):
 * straight → the 4-corner polygon around the axis; arc → outer arc forward,
 * inner arc backward, radial ends. Same centre as the bar's axis arc.
 */
export function barBandD(bar, tx, hw) {
  if (bar.kind === 'arc') {
    const a = bar.arc;
    const outer = { ...a, r: a.r + hw };
    const inner = { ...a, r: Math.max(a.r - hw, 0.001) };
    return `M ${pt(tx(...arcPoint(outer, outer.a0)))} ${svgArc(outer, tx)} L ${pt(tx(...arcPoint(inner, inner.a1)))} ${svgArc(inner, tx, true)} Z`;
  }
  const [x0, y0] = bar.from, [x1, y1] = bar.to;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len * hw, ny = (x1 - x0) / len * hw;
  const c = [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]].map((p) => tx(p[0], p[1]));
  return `M ${pt(c[0])} L ${pt(c[1])} L ${pt(c[2])} L ${pt(c[3])} Z`;
}

/** Axis of a bar as a path (line or single arc) — the glazier's centre line. */
export function barAxisD(bar, tx) {
  if (bar.kind === 'arc') return `M ${pt(tx(...arcPoint(bar.arc, bar.arc.a0)))} ${svgArc(bar.arc, tx)}`;
  return `M ${pt(tx(bar.from[0], bar.from[1]))} L ${pt(tx(bar.to[0], bar.to[1]))}`;
}

/** Point at the middle angle of an arc, pushed `offset` mm outward (+) / inward (−) along the radius — sheet coords. */
export function arcMidPoint(arc, tx, offset = 0) {
  const m = (arc.a0 + arc.a1) / 2;
  return tx(arc.cx + (arc.r + offset) * Math.cos(m), arc.cy + (arc.r + offset) * Math.sin(m));
}

/**
 * Where a radius label sits: on the arc pushed `offset` mm outward, at the
 * middle angle for a crown / apex arc, three quarters of the way from the
 * springing end towards the tangent end for a haunch arc (keeps the label
 * away from the corner dims).
 */
export function arcLabelPoint(arc, tx, offset = 0) {
  let m = (arc.a0 + arc.a1) / 2;
  const span = arc.a1 - arc.a0;
  if (arc.clip0 === 'archStart' && arc.clip1 !== 'archStart') m = arc.a0 + 0.75 * span;
  else if (arc.clip1 === 'archStart' && arc.clip0 !== 'archStart') m = arc.a1 - 0.75 * span;
  return tx(arc.cx + (arc.r + offset) * Math.cos(m), arc.cy + (arc.r + offset) * Math.sin(m));
}

/** A haunch / gothic arc: exactly one end on the springing line (its label goes outside, near the corner). */
export const isHaunchArc = (arc) => (arc.clip0 === 'archStart') !== (arc.clip1 === 'archStart');

/**
 * Label point for a BAR arc (no clip info): a ring (centred on the axis) at
 * its middle angle; a tracery arc (centred on a frame corner) 30 % of the
 * way from its springing end — two tracery arcs cross near the axis at their
 * middles. `axisX` = the glass frame axis (Wg / 2). Pushed `offset` mm outward.
 */
export function barArcLabelPoint(arc, tx, axisX, offset = 0) {
  const span = arc.a1 - arc.a0;
  let m = (arc.a0 + arc.a1) / 2;
  if (arc.cx < axisX - 1e-6) m = arc.a0 + 0.3 * span;          // starts on the springing at a0
  else if (arc.cx > axisX + 1e-6) m = arc.a1 - 0.3 * span;     // ends on the springing at a1
  return tx(arc.cx + (arc.r + offset) * Math.cos(m), arc.cy + (arc.r + offset) * Math.sin(m));
}

/** `R 150 / 1400 / 150` — every arc's radius in chain order (one decimal when needed). */
export function radiiText(arcs) {
  const f = (r) => { const v = Math.round(r * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); };
  return `R ${arcs.map((a) => f(a.r)).join(' / ')}`;
}

/** True when a bar end point (glass frame) lies on the arch — above the springing line of the outline. */
export const onCurve = (point, outline, eps = 0.01) => point[1] > outline.springing + eps;
