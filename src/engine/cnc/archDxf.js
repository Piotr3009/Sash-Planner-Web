/**
 * archDxf.js — CNC drawing generator for arched casement heads
 * (arched-casement-v1). Same entity model and drawing style as jambDxf.js:
 * flat entity list ({poly|circle|text}) in mm, y up, origin = bottom-left of
 * the drawing, serialised by dxfWriter.js (R12, POLYLINE + bulge).
 *
 * Two members per window, each drawn twice:
 *   FRAME HEAD  (ring 0 → frameHead.face)
 *   LEAF TOP    (ring leafAtJamb → leafAtJamb + leafTop.face)
 *
 * Rows, top to bottom (200 mm apart, like the jamb pieces):
 *   1. FRAME HEAD — CONTOUR: the finished member routed from the glued blank;
 *                   ASSEMBLY: the boards of the default plan in their glued
 *                   position; FINGER: joint faces; TEXT: plan summary
 *   2. FRAME HEAD — PIECES: every board laid flat (chord horizontal) with the
 *                   piece contour to rout, its stock rectangle (ASSEMBLY) and
 *                   its finger-joint faces (FINGER)
 *   3./4. the same for LEAF TOP
 *
 * The finger profile is NOT drawn as teeth — the FINGER layer carries the
 * joint plane only; the Stark head cuts the profile. The profile numbers are
 * printed on the TEXT layer.
 */
import { ArchError, piecePoly, pieceJoints, ringPoly } from '../arch.js';
import { entitiesBBox, MERGE_GAP } from './jambDxf.js';

export const ARCH_LAYERS = Object.freeze([
  { name: 'CONTOUR',  color: 7 },   // finished member outline (rout after glue-up)
  { name: 'ASSEMBLY', color: 8 },   // stock boards (assembled + flat)
  { name: 'PIECES',   color: 5 },   // piece contours laid flat
  { name: 'FINGER',   color: 1 },   // finger-joint faces
  { name: 'TEXT',     color: 94 },
]);

export const ARCH_CNC = Object.freeze({
  rowGap: 200,       // between rows (jambDxf.jambGap)
  pieceGap: 200,     // between boards in a PIECES row
  textH: 15,         // jambDxf.headTextH
  lineH: 22,         // text line pitch
  textGap: 100,      // text block offset from the drawing on the right
  textBlockW: 900,   // reserved width for the text block
});

const R1 = (v) => Math.round(v * 10) / 10;
const fmt1 = (v) => String(R1(v));

// ── entity helpers (jambDxf conventions) ────────────────────────────────────
const polyE = (layer, pts, closed = true) => ({ type: 'poly', layer, closed, pts });
const lineE = (layer, p, q) => ({ type: 'poly', layer, closed: false, pts: [[p[0], p[1], 0], [q[0], q[1], 0]] });
// jambDxf sw:drawText → middle-center
const labelE = (layer, x, y, h, str, rot = 0) => ({ type: 'text', layer, x, y, h, str, rot, halign: 1, valign: 2 });
// left-aligned note (insertion point = bottom-left)
const noteE = (layer, x, y, h, str) => ({ type: 'text', layer, x, y, h, str, rot: 0, halign: 0, valign: 0 });

const shift = (pts, dx, dy) => pts.map(([x, y, b]) => [x + dx, y + dy, b ?? 0]);
function rotate(pts, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return pts.map(([x, y, b]) => [x * c - y * s, x * s + y * c, b ?? 0]);
}
const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

/** Stock board rectangle of a piece in its OWN axes → world points (assembled position). */
function boardRectWorld(piece, stock) {
  const { b, u } = piece.axes;
  const [sMin, sMax] = piece.extents.s;
  const wLo = piece.extents.w[0] - (stock - piece.projectedWidth) / 2;   // piece centred in the board
  const wHi = wLo + stock;
  const P = (s, w) => [s * u[0] + w * b[0], s * u[1] + w * b[1], 0];
  return [P(sMin, wLo), P(sMax, wLo), P(sMax, wHi), P(sMin, wHi)];
}

function planSummary(plan) {
  return plan.arcs.map((a, i) => {
    const d = a.default;
    const alt = a.alternative;
    const arcTxt = `ARC ${i + 1} R${fmt1(a.radiusOuter)} L${fmt1(a.radiusOuter * a.span)} ${fmt1(a.spanDeg)}DEG`;
    if (!d) return `${arcTxt}: NO STOCK BOARD FITS (needs ${fmt1(a.options[a.options.length - 1].boardWidth)}+)`;
    const altTxt = alt ? ` (ALT ${alt.n} x board ${alt.stock})` : '';
    return `${arcTxt}: ${d.n} x board ${d.stock} L${fmt1(d.chordLength)}${altTxt}`;
  });
}

function shiftEntities(E, dx, dy) {
  return E.map((e) => (e.type === 'poly' ? { ...e, pts: shift(e.pts, dx, dy) }
    : e.type === 'circle' ? { ...e, cx: e.cx + dx, cy: e.cy + dy }
    : { ...e, x: e.x + dx, y: e.y + dy }));
}

/**
 * Contour + assembly row for one ring. Built in arch coordinates (axis at
 * x = 0, arch-start line at y = 0), then moved so the row's bottom-left
 * corner — tilted stock boards included, they overhang the ring — is (ox, oy).
 * Returns { entities, width, height }.
 */
function contourRow(ring, plan, ctx, ox, oy) {
  const E = [];
  E.push(polyE('CONTOUR', ringPoly(ring)));
  const seen = new Set();
  for (const pc of plan.pieces) {
    E.push(polyE('ASSEMBLY', boardRectWorld(pc, pc.stock)));
    for (const [pi, po] of pieceJoints(pc)) {
      const k = key(pi) + '|' + key(po);
      if (seen.has(k)) continue;
      seen.add(k);
      E.push(lineE('FINGER', pi, po));
    }
  }
  const rowBB = entitiesBBox(E);
  // text block to the right of the arch, top-aligned with the row
  const C = ARCH_CNC;
  const tx = rowBB.maxX + C.textGap;
  const lines = [
    `${ctx.winNum ? ctx.winNum + ' - ' : ''}${ring.label}`,
    `${ctx.shapeLabel.toUpperCase()} W${fmt1(ctx.width)} RISE${fmt1(ctx.rise)}${ctx.height ? ' H' + fmt1(ctx.height) : ''} HINGE ${ctx.hinge === 'right' ? 'R' : 'L'}`,
    `FACE ${fmt1(ring.thickness)} OFFSET ${fmt1(ring.offsets.outer)} OUTER L${fmt1(ring.lengths.outer)} INNER L${fmt1(ring.lengths.inner)}`,
    ...planSummary(plan),
    `FINGER ${ctx.finger.length}/${ctx.finger.depth}/${ctx.finger.pitch}`,
    `ALLOWANCE ${fmt1(plan.contourAllowance)} PER SIDE  MAX SEGMENT ${fmt1(plan.maxSegmentAngleDeg)} DEG`,
  ];
  const blockH = lines.length * C.lineH;
  const height = Math.max(rowBB.maxY - rowBB.minY, blockH);
  const top = rowBB.minY + height;
  lines.forEach((str, i) => E.push(noteE('TEXT', tx, top - (i + 1) * C.lineH + (C.lineH - C.textH) / 2, C.textH, str)));
  return {
    entities: shiftEntities(E, ox - rowBB.minX, oy - rowBB.minY),
    width: (rowBB.maxX - rowBB.minX) + C.textGap + C.textBlockW,
    height,
  };
}

/** Pieces row for one ring: every default piece laid flat on its stock board. */
function piecesRow(ring, plan, ctx, ox, oy) {
  const C = ARCH_CNC;
  const E = [];
  let x = ox;
  let rowH = 0;
  for (const pc of plan.pieces) {
    const theta = Math.PI / 2 - pc.axes.bisector;      // bisector → +y, chord → x
    const [sMin, sMax] = pc.extents.s;
    const pad = (pc.stock - pc.projectedWidth) / 2;
    const wLo = pc.extents.w[0] - pad;
    // after rotation the chord axis u maps to −x, so s ∈ [sMin, sMax] → x ∈ [−sMax, −sMin]
    const dx = x + sMax, dy = oy - wLo;
    const L = sMax - sMin;
    E.push(polyE('ASSEMBLY', [[x, oy, 0], [x + L, oy, 0], [x + L, oy + pc.stock, 0], [x, oy + pc.stock, 0]]));
    E.push(polyE('PIECES', shift(rotate(piecePoly(pc), theta), dx, dy)));
    for (const [pi, po] of pieceJoints(pc)) {
      const [[ax, ay], [bx, by]] = rotate([[pi[0], pi[1], 0], [po[0], po[1], 0]], theta);
      E.push(lineE('FINGER', [ax + dx, ay + dy], [bx + dx, by + dy]));
    }
    E.push(labelE('TEXT', x + L / 2, oy + pc.stock / 2, C.textH,
      `${ctx.winNum ? ctx.winNum + ' - ' : ''}${ring.label} P${pc.no} ${fmt1(L)}x${pc.stock}`));
    x += L + C.pieceGap;
    rowH = Math.max(rowH, pc.stock);
  }
  return { entities: E, width: Math.max(0, x - C.pieceGap - ox), height: rowH };
}

/**
 * Entity list for ONE window's arched members.
 * @param {object} plan  output of arch.buildArchPlan (geometry + plans + finger)
 * @param {string} winNum window label
 * @param {number} ox insertion x (left edge)
 * @param {number} oy insertion y (bottom edge)
 */
export function buildArchEntities(plan, winNum = '', ox = 0, oy = 0) {
  if (!plan?.frameHead || !plan?.leafTop || !plan?.plans) throw new ArchError('buildArchEntities needs a plan from buildArchPlan');
  if (plan.noStock) throw new ArchError('No stock board fits an arch piece — see the plan options');
  const ctx = {
    winNum: winNum ? String(winNum) : '',
    shapeLabel: plan.label,
    width: plan.width,
    rise: plan.rise,
    height: plan.straightHeight != null ? plan.straightHeight + plan.rise : null,
    hinge: plan.hinge,
    finger: plan.finger,
  };
  // Rows are laid out bottom-up so the origin is the drawing's bottom-left;
  // the reading order top-down is: FRAME HEAD contour, FRAME HEAD pieces,
  // LEAF TOP contour, LEAF TOP pieces.
  const rows = [
    (x, y) => piecesRow(plan.leafTop, plan.plans.leafTop, ctx, x, y),
    (x, y) => contourRow(plan.leafTop, plan.plans.leafTop, ctx, x, y),
    (x, y) => piecesRow(plan.frameHead, plan.plans.frameHead, ctx, x, y),
    (x, y) => contourRow(plan.frameHead, plan.plans.frameHead, ctx, x, y),
  ];
  const E = [];
  let y = oy;
  for (const row of rows) {
    const r = row(ox, y);
    E.push(...r.entities);
    y += r.height + ARCH_CNC.rowGap;
  }
  return E;
}

/**
 * Merge many windows into one entity list, stacked in rows top-down
 * (same convention as buildMergedJambEntities).
 * items: [{ plan, winNum }]
 */
export function buildMergedArchEntities(items) {
  const all = [];
  let cursorY = 0;
  for (const it of items) {
    const ents = buildArchEntities(it.plan, it.winNum, 0, 0);
    const bb = entitiesBBox(ents);
    const oy = cursorY - bb.maxY;
    for (const e of ents) {
      if (e.type === 'poly') all.push({ ...e, pts: e.pts.map(([x, yy, b]) => [x, yy + oy, b]) });
      else if (e.type === 'circle') all.push({ ...e, cy: e.cy + oy });
      else all.push({ ...e, y: e.y + oy });
    }
    cursorY = oy + bb.minY - MERGE_GAP;
  }
  return all;
}

/** Sum of arc + straight lengths of a bulge polyline (mm) — used by the harness and labels. */
export function polyLength(pts, closed = true) {
  let arcs = 0, straight = 0;
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [x0, y0, b] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const chord = Math.hypot(x1 - x0, y1 - y0);
    if (b) {
      const theta = 4 * Math.atan(Math.abs(b));
      const r = chord / (2 * Math.sin(theta / 2));
      arcs += r * theta;
    } else straight += chord;
  }
  return { arcs, straight, total: arcs + straight };
}
