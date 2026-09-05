/**
 * glassBars.js — glazier geometry shared by the glass sheet (2D), the glass
 * PDF and the glazier DXF (ARCHED-WINDOWS-v3 Block 0.2 / 0.3).
 *
 * ONE CONTOUR rule: every consumer draws the SAME bands, the same edge line
 * and prints the SAME bar-end numbers — this module is the only place that
 * computes them. Inputs are the engine's objects (derived.arch.glassOutline,
 * derived.arch.bars) in the GLASS frame (unit bottom-left, y up, mm); the
 * numbers that could differ per workshop (spacer bar width, edge cover) come
 * from the casement profile `glass` block — nothing is defaulted here.
 *
 *   spacer band  two curves ±barWidth/2 from the bar axis (bulge on arcs)
 *   edge line    the unit contour offset inward by edgeCover all round —
 *                concentric arcs (offsetArcs in the arch frame), sides and
 *                bottom shifted by the cover; the sealed-unit perimeter spacer
 *   bar ends     straight edges: positions from the bottom corners along the
 *                edge; on the arch: ARC LENGTH FROM THE APEX (left / right) so
 *                symmetric bars carry the same number; spoke: s from apex ·
 *                angle from the hub · L; ring: R · centre
 */
import { ArchError, offsetArcs, arcPoint, arcLen, arcsLength } from './arch.js';

const DEG = 180 / Math.PI;
const r1 = (v) => Math.round(v * 10) / 10;

/** Read the glazier numbers of the casement profile for one glass type. */
export function readGlassProfile(profile, glassType = 'double') {
  const g = profile?.glass;
  const barWidth = Number(g?.barWidth);
  if (!(barWidth > 0)) throw new ArchError('Casement profile glass.barWidth is missing (spacer bar width, mm)');
  const covers = g?.edgeCover || {};
  const cover = Number(covers[glassType] ?? covers.default);
  if (!(cover >= 0)) throw new ArchError(`Casement profile glass.edgeCover has no value for glass type "${glassType}" (and no default)`);
  return { barWidth, edgeCover: cover };
}

/** Both edges of a bar's spacer band, half width `hw`: [{ kind, from, to, arc? }, …] (same centre, r ± hw for arcs). */
export function barBandCurves(bar, hw) {
  if (bar.kind === 'arc') {
    const a = bar.arc;
    return [a.r + hw, a.r - hw].filter((r) => r > 0).map((r) => {
      const arc = { cx: a.cx, cy: a.cy, r, a0: a.a0, a1: a.a1 };
      return { kind: 'arc', arc, from: arcPoint(arc, arc.a0), to: arcPoint(arc, arc.a1) };
    });
  }
  const [x0, y0] = bar.from, [x1, y1] = bar.to;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len * hw, ny = (x1 - x0) / len * hw;
  return [
    { kind: 'straight', from: [x0 + nx, y0 + ny], to: [x1 + nx, y1 + ny] },
    { kind: 'straight', from: [x0 - nx, y0 - ny], to: [x1 - nx, y1 - ny] },
  ];
}

/**
 * Arcs of the edge line (glass frame): the outline arcs moved back into the
 * arch frame (axis x = 0, springing y = 0), offset concentrically by `cover`
 * (clipped ends recomputed — rule C keeps them vertical at x = ±(xg − cover))
 * and moved back.
 */
export function glassEdgeArcs(outline, cover) {
  const xg = outline.width / 2, ys = outline.springing;
  const archFrame = outline.arcs.map((a) => ({ ...a, cx: a.cx - xg, cy: a.cy - ys }));
  return offsetArcs(archFrame, cover).map((a) => ({ ...a, cx: a.cx + xg, cy: a.cy + ys }));
}

/**
 * Closed bulge polyline of the edge line (glass frame): bottom-left → bottom-
 * right → right springing → arcs counter-clockwise → left springing → close.
 * Same vertex rule as glassOutlinePoly (one vertex per arc end point).
 */
export function glassEdgePoly(outline, cover) {
  const arcs = glassEdgeArcs(outline, cover);
  const Wg = outline.width;
  const pts = [[cover, cover, 0], [Wg - cover, cover, 0]];
  for (const a of arcs) pts.push([...arcPoint(a, a.a0), Math.tan((a.a1 - a.a0) / 4)]);
  const last = arcs[arcs.length - 1];
  pts.push([...arcPoint(last, last.a1), 0]);
  return { arcs, pts };
}

/**
 * Arc length along the outline chain from its RIGHT springing end to a point
 * on the chain, or null when the point is not on it (tolerance in mm). The
 * chain runs counter-clockwise right → apex → left.
 */
export function chainLengthTo(arcs, point, tol = 0.05) {
  let s = 0;
  for (const a of arcs) {
    const d = Math.hypot(point[0] - a.cx, point[1] - a.cy);
    if (Math.abs(d - a.r) <= tol) {
      let ang = Math.atan2(point[1] - a.cy, point[0] - a.cx);
      // the chains here live in the upper half plane, angles 0 … π
      if (ang < a.a0 - 1e-6 && ang + 2 * Math.PI <= a.a1 + 1e-6) ang += 2 * Math.PI;
      if (ang >= a.a0 - 1e-6 && ang <= a.a1 + 1e-6) return s + a.r * (ang - a.a0);
    }
    s += arcLen(a);
  }
  return null;
}

/** Arc length from the apex (x = axis) to a point on the outline chain: { s, side: 'left' | 'right' }, or null. */
export function arcLengthFromApex(outline, point, tol = 0.05) {
  const s = chainLengthTo(outline.arcs, point, tol);
  if (s == null) return null;
  const half = arcsLength(outline.arcs) / 2;                  // the chains are symmetric about the axis
  const xg = outline.width / 2;
  return { s: Math.abs(s - half), side: point[0] < xg - 1e-6 ? 'left' : point[0] > xg + 1e-6 ? 'right' : 'apex' };
}

const onArch = (p, outline, eps = 0.01) => p[1] > outline.springing + eps;

/**
 * Bar-end dimensioning (0.3) for one bar list on one outline — the numbers
 * every consumer prints. Returns [{ id, role, kind, L, from, end, angle, r,
 * centre, label, cells }]:
 *   v (vertical)   from = x from the bottom-left corner; end = s from apex + side
 *   h / springing  from = y from the bottom corners (both ends on the sides)
 *   spoke          end = s from apex + side; angle = degrees from the hub centre
 *   ring           r, centre
 *   tracery        r, centre; end = s from apex of the end that meets the arch
 *   other straight both end points (fallback, never for the engine's own roles)
 * `label` = the short text beside the bar on a drawing with ≤ 4 bars;
 * `cells` = { s, L, angle } as strings for the table (> 4 bars).
 */
export function barEndRows(bars, outline) {
  const xg = outline.width / 2;
  const f = (v) => { const r = r1(v); return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const endText = (e) => (e ? `${f(e.s)} from apex${e.side === 'apex' ? '' : ' ' + e.side[0].toUpperCase()}` : null);
  return (bars || []).map((b) => {
    const row = { id: b.id, role: b.role, kind: b.kind, L: b.length, from: null, end: null, angle: null, r: null, centre: null };
    if (b.kind === 'arc') {
      row.r = b.arc.r;
      row.centre = [b.arc.cx, b.arc.cy];
      if (b.role === 'ring') {
        row.label = `${b.id} R ${f(b.arc.r)} · c ${f(b.arc.cx)} / ${f(b.arc.cy)}`;
        row.cells = { s: `R ${f(b.arc.r)}`, L: f(b.length), angle: `c ${f(b.arc.cx)} / ${f(b.arc.cy)}` };
        return row;
      }
      const hit = [b.from, b.to].find((p) => onArch(p, outline));
      row.end = hit ? arcLengthFromApex(outline, hit) : null;
      row.label = `${b.id} R ${f(b.arc.r)}${row.end ? ' · ' + endText(row.end) : ''}`;
      row.cells = { s: row.end ? endText(row.end) : '—', L: f(b.length), angle: `R ${f(b.arc.r)}` };
      return row;
    }
    const [x0, y0] = b.from, [x1, y1] = b.to;
    const vertical = Math.abs(x1 - x0) < 1e-6, horizontal = Math.abs(y1 - y0) < 1e-6;
    if (vertical) {
      row.from = { axis: 'x', value: x0 };
      const top = y0 > y1 ? b.from : b.to;
      row.end = onArch(top, outline) ? arcLengthFromApex(outline, top) : null;
      row.label = `${b.id} x ${f(x0)}${row.end ? ' · ' + endText(row.end) : ''} · L ${f(b.length)}`;
      row.cells = { s: row.end ? endText(row.end) : `x ${f(x0)}`, L: f(b.length), angle: '90°' };
      return row;
    }
    if (horizontal) {
      row.from = { axis: 'y', value: y0 };
      row.label = `${b.id} y ${f(y0)} · L ${f(b.length)}`;
      row.cells = { s: `y ${f(y0)}`, L: f(b.length), angle: '0°' };
      return row;
    }
    // spoke: the end on the arch, the angle seen from the hub (the end nearer the axis)
    const hub = Math.hypot(x0 - xg, y0 - outline.springing) < Math.hypot(x1 - xg, y1 - outline.springing) ? b.from : b.to;
    const far = hub === b.from ? b.to : b.from;
    row.angle = Math.atan2(far[1] - hub[1], far[0] - hub[0]) * DEG;
    row.end = onArch(far, outline) ? arcLengthFromApex(outline, far) : null;
    // a spoke segment between two rings: its radial extent from the hub centre
    const hubC = [xg, outline.springing];
    const radial = `r ${f(Math.hypot(hub[0] - hubC[0], hub[1] - hubC[1]))}-${f(Math.hypot(far[0] - hubC[0], far[1] - hubC[1]))}`;
    row.label = `${b.id} ${row.end ? endText(row.end) : radial} · ${f(row.angle)}° · L ${f(b.length)}`;
    row.cells = { s: row.end ? endText(row.end) : radial, L: f(b.length), angle: `${f(row.angle)}°` };
    return row;
  });
}

/** More than this many bars → numbers in a table under the drawing, ids only beside the bars. */
export const BAR_TABLE_THRESHOLD = 4;
export const useBarTable = (bars) => (bars?.length || 0) > BAR_TABLE_THRESHOLD;
