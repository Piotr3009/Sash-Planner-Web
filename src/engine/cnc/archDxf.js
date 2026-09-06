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
 *   0. FIT — frame ring, rebate wall (dashed), leaf ring, glass outline in
 *      their assembly position (v3 0.1): the 4 mm gap and the 17 mm lap read
 *      directly; not a toolpath
 *   1. FRAME HEAD — CONTOUR: the finished member routed from the glued blank;
 *                   ASSEMBLY: the raw pieces of the default plan as straight
 *                   trapezoids meeting on their joint planes (the glued blank
 *                   position; FINGER: joint faces; TEXT: plan summary
 *   2. FRAME HEAD — PIECES: every raw board laid flat (chord horizontal) as
 *                   the straight trapezoid after its end cuts (stock width ×
 *                   rough length, finger extension on jointed ends) with two
 *                   suggested Uniclamp footprints (CLAMPS, v4 C.6: base
 *                   cnc.clamp.base square, cnc.clampClearance from the end
 *                   cuts, as far apart as the piece allows, centred across
 *                   the width — a suggestion, never a toolpath)
 *   3./4. the same for LEAF TOP
 * v4 (ARCHED-WINDOWS-v4 Block C): the plan is the whole-chain planner — one
 * summary line per planning group (CHAIN / SIDE 1-2 / RING) with the FEWEST
 * plan, the ECONOMY alternative and which one is the default; both hard
 * limits (cnc.minClampLength on the overall length, arch.minPieceLength on
 * the shorter edge) and the board cap are printed. Cut codes: J = joint from
 * square, Q = square (the springing face is routed with the contour), A =
 * apex from square.
 *
 * The finger profile is NOT drawn as teeth — the FINGER layer carries the
 * joint plane and the zone line only; the Stark head cuts the profile. The
 * profile numbers are printed on the TEXT layer. dxfWriter has no linetypes
 * (every layer is CONTINUOUS), so the zone lines are plain short polylines.
 */
import { ArchError, pieceJoints, ringPoly, arcPoint, arcBulge, pieceStockTrapezoid } from '../arch.js';
import { entitiesBBox, MERGE_GAP } from './jambDxf.js';

export const ARCH_LAYERS = Object.freeze([
  { name: 'FIT',      color: 4 },   // assembly view: frame ring, rebate wall, leaf ring, glass — concentric (v3 0.1)
  { name: 'CONTOUR',  color: 7 },   // finished member outline (rout after glue-up)
  { name: 'ASSEMBLY', color: 8 },   // stock boards (assembled + flat)
  { name: 'PIECES',   color: 5 },   // piece contours laid flat
  { name: 'FINGER',   color: 1 },   // finger-joint faces
  { name: 'CLAMPS',   color: 3 },   // v4 C.6: suggested Uniclamp footprints on the flat pieces (Rover A 1532)
  { name: 'TEXT',     color: 94 },
]);

export const ARCH_CNC = Object.freeze({
  rowGap: 200,       // between rows (jambDxf.jambGap)
  pieceGap: 200,     // between boards in a PIECES row
  textH: 15,         // jambDxf.headTextH
  noteH: 10,         // second label line on a flat piece (lengths, end cuts, finger)
  lineH: 22,         // text line pitch
  textGap: 100,      // text block offset from the drawing on the right
  textBlockW: 900,   // reserved width for the text block
  fitDash: 20,       // rebate wall on the FIT row: dash length (dxfWriter has no linetypes — plain short arcs)
  fitGap: 10,        // … and the gap between dashes
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

const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`);
const optTxt = (o) => `${o.n} x board ${o.stock} L${fmt1(o.chordLength)} ROUGH ${fmt1(o.roughLength)} WASTE ${pct(o.waste)}`;

/** One line per planning group (v4): the fewest plan, the economy alternative, the default. */
function planSummary(plan) {
  const lines = [];
  const groups = plan.arcs;
  for (const g of groups) {
    const name = g.kind === 'ring' ? 'RING' : g.kind === 'side' ? `SIDE ${g.index + 1}` : 'CHAIN';
    const radii = g.radii.map(fmt1);
    const head = `${name} R${radii.every((r) => r === radii[0]) ? radii[0] : radii.join('/')} L${fmt1(g.length)} ${fmt1(g.spanDeg)}DEG`;
    if (!g.default) {
      const last = g.options[g.options.length - 1];
      const why = g.reason === 'below minimum length'
        ? `${last.n} PIECES FIT BOARD ${last.stock} BUT ${last.failures[0].toUpperCase()}`
        : `NO STOCK BOARD FITS (NEEDS ${fmt1(last.wReq)}+ FOR ${last.n} PIECES)`;
      lines.push(`${head}: NO VALID PLAN - ${why}`);
      continue;
    }
    lines.push(`${head}: FEWEST ${optTxt(g.fewest)}`);
    if (g.alternative) lines.push(`  ECONOMY ALT ${optTxt(g.alternative)} -> DEFAULT ${g.rule.toUpperCase()} (THRESHOLD ${pct(plan.wasteThreshold)})`);
    else lines.push(`  NO ECONOMY ALT WITHIN ${g.fewest.n + 3} PIECES -> DEFAULT FEWEST`);
  }
  return lines;
}

function shiftEntities(E, dx, dy) {
  return E.map((e) => (e.type === 'poly' ? { ...e, pts: shift(e.pts, dx, dy) }
    : e.type === 'circle' ? { ...e, cx: e.cx + dx, cy: e.cy + dy }
    : { ...e, x: e.x + dx, y: e.y + dy }));
}

/** CLAMPS text (v4 C.6): the Uniclamp numbers, the piece thickness check and the per-piece warnings. */
function clampLines(ctx, depth, warnings) {
  const c = ctx.cnc?.clamp || {};
  const out = [`CLAMPS (SUGGESTION): UNICLAMP ${fmt1(c.base)} x ${fmt1(c.base)}, CLEARANCE ${fmt1(ctx.cnc?.clampClearance)} FROM THE END CUTS, JAWS ${fmt1(c.minThickness)}-${fmt1(c.maxThickness)}${depth ? `, PIECE THICKNESS ${fmt1(depth)}` : ''}`];
  if (depth && (depth < c.minThickness || depth > c.maxThickness)) out.push(`WARNING: PIECE THICKNESS ${fmt1(depth)} OUTSIDE THE UNICLAMP JAWS ${fmt1(c.minThickness)}-${fmt1(c.maxThickness)}`);
  for (const w of warnings) out.push(`WARNING: ${w}`);
  return out;
}

/**
 * Contour + assembly row for one ring. Built in arch coordinates (axis at
 * x = 0, arch-start line at y = 0), then moved so the row's bottom-left
 * corner — tilted stock boards included, they overhang the ring — is (ox, oy).
 * Returns { entities, width, height }.
 */
function contourRow(ring, plan, ctx, ox, oy, depth = null, clampWarnings = []) {
  const E = [];
  E.push(polyE('CONTOUR', ringPoly(ring)));
  const seen = new Set();
  for (const pc of plan.pieces) {
    // glued-up blank: the stock trapezoids meet on their joint planes, no overlap (Piotr 06.09)
    E.push(polyE('ASSEMBLY', pieceStockTrapezoid(pc, pc.stock)));
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
    `${ctx.shapeLabel.toUpperCase()} W${fmt1(ctx.width)} RISE${fmt1(ctx.rise)}${ctx.height ? ' H' + fmt1(ctx.height) : ''} ${ctx.fixed ? 'FIXED LEAF' : ctx.hinge ? 'HINGE ' + (ctx.hinge === 'right' ? 'R' : 'L') : 'SASH'}`,
    `FACE ${fmt1(ring.thickness)} OFFSET ${fmt1(ring.offsets.outer)} OUTER L${fmt1(ring.lengths.outer)} INNER L${fmt1(ring.lengths.inner)}`,
    ...planSummary(plan),
    `FINGER ${ctx.finger.length}/${ctx.finger.depth}/${ctx.finger.pitch}`,
    `ALLOWANCE ${fmt1(plan.contourAllowance)} PER SIDE  LIMITS: OVERALL >= ${fmt1(plan.minClampLength)} (CLAMP)  SHORTER EDGE >= ${fmt1(plan.minPieceLength)}  STOCK MAX ${fmt1(Math.max(0, ...plan.stockWidths))}`,
    ...clampLines(ctx, depth, clampWarnings),
    'CUT CODES: J = JOINT FROM SQUARE  Q = SQUARE (SPRINGING FACE ROUTED WITH THE CONTOUR)  A = APEX FROM SQUARE',
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

/** Closed bulge polyline of an arc chain (counter-clockwise) shut along the arch-start line. */
function chainPoly(arcs) {
  const pts = [];
  for (const a of arcs) pts.push([...arcPoint(a, a.a0), arcBulge(a)]);
  const last = arcs[arcs.length - 1];
  pts.push([...arcPoint(last, last.a1), 0]);
  return pts;
}

/** Dashed rendering of an arc chain: short 2-vertex bulge polylines, dash / gap in mm along the arc. */
function dashedChain(layer, arcs, dash, gap) {
  const E = [];
  for (const a of arcs) {
    const step = (dash + gap) / a.r, dAng = dash / a.r;
    for (let t = a.a0; t < a.a1 - 1e-9; t += step) {
      const t1 = Math.min(t + dAng, a.a1);
      E.push(polyE(layer, [[...arcPoint(a, t), Math.tan((t1 - t) / 4)], [...arcPoint(a, t1), 0]], false));
    }
  }
  return E;
}

/**
 * FIT row (v3 0.1): the frame ring, the rebate wall (R − land, dashed), the
 * leaf ring and the glass outline drawn CONCENTRIC in their assembly
 * position, so the running gap between the rebate wall and the leaf and the
 * rebate lap (frame timber under the leaf) can be read directly. The
 * CONTOUR / PIECES rows stay per piece for the CNC.
 */
function fitRow(plan, ctx, ox, oy) {
  const E = [];
  E.push(polyE('FIT', ringPoly(plan.frameHead)));
  E.push(polyE('FIT', ringPoly(plan.leafTop)));
  E.push(polyE('FIT', chainPoly(plan.glass.arcs)));
  if (plan.rebateWall) E.push(...dashedChain('FIT', plan.rebateWall, ARCH_CNC.fitDash, ARCH_CNC.fitGap));
  const rowBB = entitiesBBox(E);
  const C = ARCH_CNC;
  const tx = rowBB.maxX + C.textGap;
  const rr = (arcs) => arcs.map((a) => fmt1(a.r)).join('/');
  // casement: frame ring, rebate wall (dashed), leaf ring, glass; sash (v3 Block 1 F): box head ring,
  // arched top rail ring at the stile line, glass — the running gap between them, no rebate
  const lines = plan.rebateWall ? [
    `${ctx.winNum ? ctx.winNum + ' - ' : ''}FIT (ASSEMBLY, NOT A TOOLPATH)`,
    `GAP ${fmt1(plan.fit.gap)} LAP ${fmt1(plan.fit.lap)} (REBATE)`,
    `FRAME R${rr(plan.frameHead.outer)} / ${rr(plan.frameHead.inner)}  REBATE WALL R${rr(plan.rebateWall)} (LAND ${fmt1(plan.fit.land)}, DASHED)`,
    `LEAF R${rr(plan.leafTop.outer)} / ${rr(plan.leafTop.inner)}  GLASS R${rr(plan.glass.arcs)}`,
  ] : [
    `${ctx.winNum ? ctx.winNum + ' - ' : ''}FIT (ASSEMBLY, NOT A TOOLPATH)`,
    `RUNNING GAP ${fmt1(plan.fit.gap)} (HEAD ${fmt1(plan.frameHead.thickness)} FACE, SASH AT THE STILE LINE)`,
    `HEAD R${rr(plan.frameHead.outer)} / ${rr(plan.frameHead.inner)}`,
    `TOP RAIL R${rr(plan.leafTop.outer)} / ${rr(plan.leafTop.inner)}  GLASS R${rr(plan.glass.arcs)}`,
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

const cutCode = (c) => (c.kind === 'square' ? 'Q' : `${c.kind === 'joint' ? 'J' : 'A'}${fmt1(c.angleDeg)}`);

/**
 * Pieces row for one ring: every default piece laid flat on its ROUGH stock
 * board. In the flat frame the piece's END end (counter-clockwise end) is on
 * the left and its START end on the right (the rotation maps the tangent
 * axis u onto −x); jointed ends get the finger length outside the band.
 */
/**
 * Two Uniclamp footprints on a flat piece (v4 C.6). `cut` = the end-cut
 * trapezoid in the flat frame (no finger extension — the joint planes are
 * cut inside the rough ends), y from `y0` to `y0 + stock`. The squares are
 * centred across the width, kept `clearance` from both end-cut lines over
 * their whole height, and pushed to the two ends. Returns { squares, warning }.
 */
export function clampFootprints(cut, stock, y0, clamp, clearance, label = '') {
  const B = Number(clamp?.base);
  const cl = Number(clearance);
  if (!(B > 0) || !(cl >= 0)) return { squares: [], warning: null };
  const yLo = y0 + (stock - B) / 2, yHi = yLo + B;
  // flat frame: END end on the left (E0 bottom, E1 top), START end on the right (S0 bottom, S1 top)
  const [S0, E0, E1, S1] = cut;
  const xAt = (p, q, y) => (Math.abs(q[1] - p[1]) < 1e-9 ? Math.max(p[0], q[0]) : p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]));
  const left = Math.max(xAt(E0, E1, yLo), xAt(E0, E1, yHi)) + cl;
  const right = Math.min(xAt(S0, S1, yLo), xAt(S0, S1, yHi)) - cl;
  const room = right - left;
  const sq = (x) => [[x, yLo, 0], [x + B, yLo, 0], [x + B, yHi, 0], [x, yHi, 0]];
  if (room >= 2 * B) return { squares: [sq(left), sq(right - B)], warning: null };
  if (room >= B) return { squares: [sq((left + right - B) / 2)], warning: `${label} TAKES ONE CLAMP ONLY (${fmt1(room)} BETWEEN THE END CUTS AFTER CLEARANCE)` };
  return { squares: [], warning: `${label} TOO SHORT FOR A CLAMP (${fmt1(room)} BETWEEN THE END CUTS AFTER CLEARANCE)` };
}

/**
 * Pieces row for one ring: every default piece laid flat on its ROUGH stock
 * board. In the flat frame the piece's END end (counter-clockwise end) is on
 * the left and its START end on the right (the rotation maps the tangent
 * axis u onto −x); jointed ends get the finger length outside the band.
 * CLAMPS (v4 C.6): two suggested Uniclamp squares per piece.
 */
function piecesRow(ring, plan, ctx, ox, oy, warningsOut = []) {
  const C = ARCH_CNC;
  const E = [];
  let x = ox;
  let rowH = 0;
  const f = ctx.finger;
  for (const pc of plan.pieces) {
    const theta = Math.PI / 2 - pc.axes.bisector;      // bisector → +y, chord → x
    const [cutStart, cutEnd] = pc.endCuts;
    const L = pc.outerEdge ?? pc.L;
    // The raw piece: a straight trapezoid (angled ends, finger extension on jointed
    // ends) laid flat — chord horizontal, END end on the left. Fingers are a note,
    // not drawn (Piotr 06.09: "fingers tylko jako obliczenia").
    const trap = rotate(pieceStockTrapezoid(pc, pc.stock, f.length), theta);
    const minX = Math.min(...trap.map((q) => q[0])), minY = Math.min(...trap.map((q) => q[1]));
    const dx = x - minX, dy = oy - minY;
    E.push(polyE('PIECES', shift(trap, dx, dy)));
    // CLAMPS: the end-cut trapezoid (no finger extension) in the same flat frame
    const label = `${ring.label} P${pc.no}`;
    const cut = shift(rotate(pieceStockTrapezoid(pc, pc.stock, 0), theta), dx, dy);
    const fp = clampFootprints(cut, pc.stock, oy, ctx.cnc?.clamp, ctx.cnc?.clampClearance, label);
    for (const sq of fp.squares) E.push(polyE('CLAMPS', sq));
    if (fp.warning) warningsOut.push(fp.warning);
    const fingerTxt = pc.jointedEnds === 2 ? 'FINGER BOTH ENDS' : pc.jointedEnds === 1 ? 'FINGER ONE END' : 'NO FINGER';
    const roughDrawn = Math.max(...trap.map((q) => q[0])) - minX;      // rough length = drawn width incl. fingers
    E.push(labelE('TEXT', x + roughDrawn / 2, oy + pc.stock / 2 + C.noteH, C.textH,
      `${ctx.winNum ? ctx.winNum + ' - ' : ''}${label} L${fmt1(roughDrawn)} x${pc.stock}`));
    E.push(labelE('TEXT', x + roughDrawn / 2, oy + C.noteH, C.noteH,
      `OUT ${fmt1(L)} IN ${fmt1(pc.innerEdge ?? pc.Lin)} CUT ${cutCode(cutEnd)}/${cutCode(cutStart)} ${fingerTxt}`));
    x += roughDrawn + C.pieceGap;
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
  if (!plan.fit || !plan.glass?.arcs) throw new ArchError('buildArchEntities needs fit / glass from buildArchGeometry (v3)');
  if (plan.kind !== 'sash' && !plan.rebateWall) throw new ArchError('buildArchEntities needs rebateWall from buildArchGeometry (v3)');
  if (plan.noStock) throw new ArchError('No stock board fits an arch piece — see the plan options');
  const ctx = {
    winNum: winNum ? String(winNum) : '',
    shapeLabel: plan.label,
    width: plan.width,
    rise: plan.rise,
    height: plan.straightHeight != null ? plan.straightHeight + plan.rise : null,
    hinge: plan.kind === 'sash' || plan.fixed ? null : plan.hinge,
    fixed: !!plan.fixed || plan.kind === 'circle',   // v3 Block 3: fixed leaf (no hinge side)
    finger: plan.finger,
    cnc: plan.cnc || null,                            // v4 C.6: Uniclamp footprint + clearance
  };
  const depths = plan.depths || {};
  // Rows are laid out bottom-up so the origin is the drawing's bottom-left;
  // the reading order top-down is: FIT (assembly), FRAME HEAD contour,
  // FRAME HEAD pieces, LEAF TOP contour, LEAF TOP pieces.
  // the pieces row collects the clamp warnings its contour row prints (it is built first — bottom-up)
  const warnLeaf = [], warnHead = [];
  const rows = [
    (x, y) => piecesRow(plan.leafTop, plan.plans.leafTop, ctx, x, y, warnLeaf),
    (x, y) => contourRow(plan.leafTop, plan.plans.leafTop, ctx, x, y, depths.leafTop, warnLeaf),
    (x, y) => piecesRow(plan.frameHead, plan.plans.frameHead, ctx, x, y, warnHead),
    (x, y) => contourRow(plan.frameHead, plan.plans.frameHead, ctx, x, y, depths.frameHead, warnHead),
    (x, y) => fitRow(plan, ctx, x, y),
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
