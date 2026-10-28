/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * fireDoorDxf.js (fire doors v1.2, 28.10.2026): the shop drawing of EVERY element of one
 * fire door set as DXF entities, for the owner ("I need DWG, all the elements in DWG,
 * including nicely drawn hinges"). A true .dwg cannot be written without a proprietary
 * library or a converter (no new dependency is allowed), so the drawing goes out as DXF
 * R12 through the existing dxfWriter.js: AutoCAD and bSolid open it directly.
 *
 * Pure: derived -> { entities, layers, views }; no DOM (the downloads live in
 * src/utils/fireDoorDxfExport.js). Every door number comes from derived.firedoor: the
 * machining OPS of the engine (so the drawing is exactly what the machine export says,
 * the coordinate systems are documented at the top of src/engine/fireDoor.js), the leaf
 * and member sizes, the hinge positions, the vision panel panes and the closer symbol.
 * The constants below are drawing sizes only (text heights, spacing, the hinge symbol).
 *
 * THE SHEET (mm, 1:1, DXF y up). The elements stand in a row at their true heights: the
 * jamb feet on Y = 0 (the floor), the leaf bottom floorGap above it, the head wall face on
 * Y = the frame overall height, so a hinge on the leaf and its recess on the hinge jamb
 * line up across the sheet.
 *   LEAF        (a) pull face, seen from the pull side (the hinge knuckle side): the hinge
 *               edge on the left for 'Hinge left', mirrored for 'Hinge right'; the vision
 *               panel cut-outs by shape, the spindle / cylinder holes, the lock forend and
 *               case pocket hidden, the hinge knuckles, the closer symbol;
 *               (b) hinge edge and (c) lock edge, each beside the edge it shows (third
 *               angle: the pull face nearest the face view); (d) top edge above the face
 *               view (the pull face at the bottom).
 *   HEAD        elevation (seen from the outside face, the wall face on top), the soffit
 *               (the opening face, seen from below) and the two mitre faces unfolded.
 *   JAMBS       elevation (seen from the outside face, standing, top long point up), the
 *               opening face (rebate cheek) beside it and the top mitre face unfolded above.
 * Layers are named by operation with the depth in the name (a dot written as P: 3.2 ->
 * D3P2, R12 layer names take no dot); geometry seen through the material sits on a
 * *_HIDDEN layer (set a dashed linetype on those in CAD); the writer has no DIMENSION
 * entity, so the dimensions are drawn (extension lines, dimension line, 45 ticks, text)
 * on FD_DIM.
 */

const SQ2 = Math.SQRT2;
const BULGE_QUARTER = Math.tan(Math.PI / 8);   // the bulge of a 90 degree arc

// ── drawing sizes (text, spacing, symbols); never a door number ──
const HEADER_H = 42;          // the door header over the row
const TITLE_H = 20;           // a view title
const SUB_H = 10;             // the line under a view title
const DIM_H = 12;             // dimension text
const NOTE_H = 10;            // notes inside a view
const LABEL_H = 8;            // PULL / PUSH face labels
const BLOCK_TEXT_H = 16;      // the title block lines
const VIEW_GAP = 160;         // between neighbouring views of one element (outside their dimensions)
const BLOCK_GAP = 500;        // between the elements of the row
const DIM_FIRST = 42;         // the first dimension lane from a view
const DIM_LANE = 30;          // between dimension lanes
const EXT_GAP = 3;            // extension line gap from the feature
const EXT_OVER = 4;           // extension line past the dimension line
const TICK = 3;               // half the 45 degree tick
const TEXT_OFF = 3;           // dimension text off its line
const CHAR_W = 0.8;           // text width estimate per character per height
const CENTRE_MARK = 6;        // half a centre cross
const TITLE_GAP = 42;         // a view title off the view
// the drawn butt hinge over each recess (a symbol: the plate, its countersunk screws, the knuckle)
const HINGE_KNUCKLE_DIA = 13;
const HINGE_KNUCKLES = 5;
const HINGE_SCREW_DIA = 4.5;
const HINGE_SCREW_HEAD_DIA = 9;
const HINGE_SCREW_AT = [0.18, 0.5, 0.82];   // along the hinge length
const HINGE_PLATE_CORNER_R = 2;

/** The elements of a door set, in the row order (the machining groups of derived.firedoor). */
export const FIREDOOR_DXF_ELEMENTS = Object.freeze(['leaf', 'head', 'jambHinge', 'jambLock']);

/** The ACI colour of each layer family (one colour per layer of a door). */
export const FIREDOOR_DXF_COLOURS = Object.freeze({
  OUTLINE: 7, MITRE: 20, REBATE: 4,
  HINGE_RECESS: 1, HINGE_DRAWING: 30,
  LOCK_FOREND: 3, LOCK_FOREND_HIDDEN: 252, LOCK_CASE: 94, LOCK_CASE_HIDDEN: 8,
  HOLE: 6, VP: 5, INTU: 2,
  KEEP_PLATE: 110, KEEP_POCKET: 170,
  DOWEL: 210, DOWEL_HIDDEN: 9,
  CLOSER: 42, CLOSER_HIDDEN: 41,
  CENTRE: 253, DIM: 140, TEXT: 150,
});
const C = FIREDOOR_DXF_COLOURS;

const LOCK_LABELS = { latch: 'Latch', euro: 'Sashlock euro', bathroom: 'Bathroom' };
const ROLE_LABELS = { head: 'head', jambHinge: 'hinge jamb', jambLock: 'lock jamb' };

// ── numbers and text ──
const R1 = (v) => Math.round(Number(v) * 10) / 10;
const fmt = (v) => { const r = R1(v); return Number.isFinite(r) ? (Object.is(r, -0) ? '0' : String(r)) : '?'; };
const numTag = (v) => fmt(v).replace('-', 'M').replace('.', 'P');
const depthTag = (d, through) => (through ? 'THROUGH' : `D${numTag(d)}`);
/** DXF R12 text: plain ASCII (x for the multiplication sign, a hyphen for the long dashes, no %% control codes). */
const ascii = (s) => String(s ?? '')
  .replace(/[\u2013\u2014\u2212]/g, '-')
  .replace(/\u00d7/g, 'x')
  .replace(/\u00b7/g, ',')
  .replace(/\u00b2/g, '2')
  .replace(/[^\x20-\x7e]/g, '')
  .replace(/%%/g, '%');
const textW = (str, h) => String(str).length * h * CHAR_W;

// ── entities (the dxfWriter.js model; `tag` and `view` ride along for the harness, the writer ignores them) ──
function poly(E, layer, pts, closed, tag) {
  E.push({ type: 'poly', layer, closed: !!closed, pts: pts.map((p) => [p[0], p[1], p[2] || 0]), ...(tag ? { tag } : {}) });
}
function line(E, layer, x1, y1, x2, y2, tag) { poly(E, layer, [[x1, y1], [x2, y2]], false, tag); }
function circle(E, layer, cx, cy, r, tag) { if (r > 0) E.push({ type: 'circle', layer, cx, cy, r, ...(tag ? { tag } : {}) }); }
function text(E, layer, x, y, h, str, o = {}) {
  E.push({ type: 'text', layer, x, y, h, str: ascii(str), rot: o.rot || 0, halign: o.halign ?? 0, valign: o.valign ?? 0, ...(o.tag ? { tag: o.tag } : {}) });
}

/**
 * An axis-aligned rectangle with corner radius r as a closed polyline (bulged corners);
 * r of half the short side = a slot with full radius ends; a square with r of half its
 * side = a circle; r 0 = plain corners.
 */
function roundRect(E, layer, xa, ya, xb, yb, r, tag) {
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
  const w = x1 - x0, h = y1 - y0;
  if (!(w > 0) || !(h > 0)) return;
  const rr = Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2));
  if (rr <= 1e-6) { poly(E, layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, tag); return; }
  const fullW = Math.abs(rr - w / 2) < 1e-6, fullH = Math.abs(rr - h / 2) < 1e-6;
  if (fullW && fullH) { circle(E, layer, (x0 + x1) / 2, (y0 + y1) / 2, rr, tag); return; }
  if (fullH) { poly(E, layer, [[x0 + rr, y0], [x1 - rr, y0, 1], [x1 - rr, y1], [x0 + rr, y1, 1]], true, tag); return; }
  if (fullW) { poly(E, layer, [[x1, y0 + rr], [x1, y1 - rr, 1], [x0, y1 - rr], [x0, y0 + rr, 1]], true, tag); return; }
  const b = BULGE_QUARTER;
  poly(E, layer, [[x0 + rr, y0], [x1 - rr, y0, b], [x1, y0 + rr], [x1, y1 - rr, b], [x1 - rr, y1], [x0 + rr, y1, b], [x0, y1 - rr], [x0, y0 + rr, b]], true, tag);
}

// ── views: a local system mapped onto the sheet by an axis-aligned map (a, b) -> [X, Y] ──
function newView(id, element, map) { return { id, element, map, E: [] }; }
const P = (V, a, b) => V.map(a, b);
function rectL(V, layer, a0, b0, a1, b1, r, tag) { const p = P(V, a0, b0), q = P(V, a1, b1); roundRect(V.E, layer, p[0], p[1], q[0], q[1], r, tag); }
function lineL(V, layer, a0, b0, a1, b1, tag) { const p = P(V, a0, b0), q = P(V, a1, b1); line(V.E, layer, p[0], p[1], q[0], q[1], tag); }
function polyL(V, layer, pts, closed, tag) { poly(V.E, layer, pts.map(([a, b]) => P(V, a, b)), closed, tag); }
function circleL(V, layer, a, b, r, tag) { const p = P(V, a, b); circle(V.E, layer, p[0], p[1], r, tag); }
function centreMark(V, LY, a, b, k = CENTRE_MARK) {
  const p = P(V, a, b);
  const layer = LY.add('FD_CENTRE', C.CENTRE);
  line(V.E, layer, p[0] - k, p[1], p[0] + k, p[1]);
  line(V.E, layer, p[0], p[1] - k, p[0], p[1] + k);
}

/** The bounding box of entities: polyline vertices and their arc midpoints, circles, text by an estimate. */
function bboxOf(E) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const e of E) {
    if (e.type === 'poly') {
      const n = e.pts.length;
      e.pts.forEach(([x, y, b], i) => {
        add(x, y);
        if (b && (i < n - 1 || e.closed)) {
          const [qx, qy] = e.pts[(i + 1) % n];
          const dx = qx - x, dy = qy - y, c = Math.hypot(dx, dy);
          if (c > 0) { const s = (b * c) / 2; add((x + qx) / 2 + (dy / c) * s, (y + qy) / 2 - (dx / c) * s); }
        }
      });
    } else if (e.type === 'circle') {
      add(e.cx - e.r, e.cy - e.r); add(e.cx + e.r, e.cy + e.r);
    } else if (e.type === 'text') {
      const w = textW(e.str, e.h), h = e.h;
      const along = e.halign === 1 ? [-w / 2, w / 2] : e.halign === 2 ? [-w, 0] : [0, w];
      const across = e.valign === 2 ? [-h / 2, h / 2] : e.valign === 3 ? [-h, 0] : [0, h];
      if (e.rot === 90) { add(e.x - across[1], e.y + along[0]); add(e.x - across[0], e.y + along[1]); }
      else { add(e.x + along[0], e.y + across[0]); add(e.x + along[1], e.y + across[1]); }
    }
  }
  return { x0, y0, x1, y1 };
}
function shift(E, dx, dy) {
  for (const e of E) {
    if (e.type === 'poly') e.pts = e.pts.map(([x, y, b]) => [x + dx, y + dy, b]);
    else if (e.type === 'circle') { e.cx += dx; e.cy += dy; }
    else if (e.type === 'text') { e.x += dx; e.y += dy; }
  }
}

// ── dimensions (drawn: the R12 writer has no DIMENSION entity) ──
const lane = (edge, dir, k) => edge + dir * (DIM_FIRST + k * DIM_LANE);
/**
 * A linear dimension between the sheet points a and b: axis 'x' measures along X with the
 * dimension line at Y = at, axis 'y' along Y with the line at X = at. Extension lines from
 * the features, 45 ticks, the value (or opts.text) centred over the line, or past its end
 * when the span is shorter than the text.
 */
function dim(E, LY, a, b, axis, at, opts = {}) {
  const layer = LY.add('FD_DIM', C.DIM);
  const h = opts.h || DIM_H;
  if (axis === 'x') {
    const v = Math.abs(b[0] - a[0]);
    if (!(v > 0.05) || !Number.isFinite(v)) return;
    for (const p of [a, b]) {
      const s = Math.sign(at - p[1]) || 1;
      if (Math.abs(at - p[1]) > EXT_GAP) line(E, layer, p[0], p[1] + s * EXT_GAP, p[0], at + s * EXT_OVER);
      line(E, layer, p[0] - TICK, at - TICK, p[0] + TICK, at + TICK);
    }
    line(E, layer, a[0], at, b[0], at);
    const str = opts.text ?? fmt(v);
    const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
    if (textW(str, h) + 6 <= hi - lo) text(E, layer, (lo + hi) / 2, at + TEXT_OFF, h, str, { halign: 1, tag: 'dimText' });
    else text(E, layer, hi + TICK + 3, at + TEXT_OFF, h, str, { halign: 0, tag: 'dimText' });
  } else {
    const v = Math.abs(b[1] - a[1]);
    if (!(v > 0.05) || !Number.isFinite(v)) return;
    for (const p of [a, b]) {
      const s = Math.sign(at - p[0]) || 1;
      if (Math.abs(at - p[0]) > EXT_GAP) line(E, layer, p[0] + s * EXT_GAP, p[1], at + s * EXT_OVER, p[1]);
      line(E, layer, at - TICK, p[1] - TICK, at + TICK, p[1] + TICK);
    }
    line(E, layer, at, a[1], at, b[1]);
    const str = opts.text ?? fmt(v);
    const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
    if (textW(str, h) + 6 <= hi - lo) text(E, layer, at - TEXT_OFF, (lo + hi) / 2, h, str, { rot: 90, halign: 1, tag: 'dimText' });
    else text(E, layer, at - TEXT_OFF, hi + TICK + 3, h, str, { rot: 90, halign: 0, tag: 'dimText' });
  }
}
/** A chain of dimensions on one line: points[i] to points[i + 1], labels[i] the text of that piece (null = the value). */
function chain(E, LY, points, labels, axis, at) {
  for (let i = 0; i < points.length - 1; i += 1) dim(E, LY, points[i], points[i + 1], axis, at, labels?.[i] ? { text: labels[i] } : {});
}
/** Intervals [s, e, item] without repeats (to 0.1), sorted by s. */
function uniqIntervals(list) {
  const seen = new Set(), out = [];
  for (const iv of list) {
    const k = `${R1(iv[0])}|${R1(iv[1])}`;
    if (!seen.has(k)) { seen.add(k); out.push(iv); }
  }
  return out.sort((p, q) => p[0] - q[0]);
}

/** A view title (and the lines under it) below the view (or above with where 'above'), aligned left / centre / right on its box. */
function addTitle(V, LY, title, subs, where = 'below', align = 'left') {
  const layer = LY.add('FD_TEXT', C.TEXT);
  const bb = bboxOf(V.E);
  if (!Number.isFinite(bb.x0)) return;
  const halign = align === 'centre' ? 1 : align === 'right' ? 2 : 0;
  const x = align === 'centre' ? (bb.x0 + bb.x1) / 2 : align === 'right' ? bb.x1 : bb.x0;
  const lines = [{ s: title, h: TITLE_H }, ...(subs || []).filter(Boolean).map((s) => ({ s, h: SUB_H }))];
  if (where === 'above') {
    let y = bb.y1 + TITLE_GAP / 2;
    [...lines].reverse().forEach((l) => { text(V.E, layer, x, y, l.h, l.s, { halign, tag: l.h === TITLE_H ? 'viewTitle' : 'viewSub' }); y += l.h + 6; });
  } else {
    let y = bb.y0 - TITLE_GAP;
    lines.forEach((l) => { y -= l.h; text(V.E, layer, x, y, l.h, l.s, { halign, tag: l.h === TITLE_H ? 'viewTitle' : 'viewSub' }); y -= 6; });
  }
}

/**
 * A label of a few lines centred on a sheet point inside a box w x h (sheet units): turned
 * 90 when the box is narrower than the text and taller than wide.
 */
function labelLines(E, layer, p, lines, boxW, boxH) {
  const widest = Math.max(...lines.map((l) => textW(l.s, l.h)));
  const total = lines.reduce((a, l) => a + l.h + 4, -4);
  const turn = widest + 8 > boxW && boxH > boxW;
  let off = total / 2;
  lines.forEach((l) => {
    const c = off - l.h / 2;
    if (turn) text(E, layer, p[0] - c, p[1], l.h, l.s, { rot: 90, halign: 1, valign: 2 });
    else text(E, layer, p[0], p[1] + c, l.h, l.s, { halign: 1, valign: 2 });
    off -= l.h + 4;
  });
}

// ── the drawn hinge and the knuckle ──
/** The knuckle of a hinge between a0 and a1 along the edge, centred on c = cAxis: the barrel and its knuckle joints. */
function knuckleL(V, LY, a0, a1, cAxis, tag) {
  const layer = LY.add('FD_HINGE_DRAWING', C.HINGE_DRAWING);
  const k = HINGE_KNUCKLE_DIA / 2;
  rectL(V, layer, a0, cAxis - k, a1, cAxis + k, 0, tag);
  for (let i = 1; i < HINGE_KNUCKLES; i += 1) {
    const a = a0 + ((a1 - a0) * i) / HINGE_KNUCKLES;
    lineL(V, layer, a, cAxis - k, a, cAxis + k);
  }
}
/**
 * A butt hinge over its recess, in a face whose local axes are a (along the edge) and c
 * (into the face from the knuckle side, c = 0 = the face the knuckle shows on): the
 * knuckle on c = 0, the leaf plate from the knuckle to plateW with its countersunk screws.
 */
function hingeL(V, LY, a0, a1, plateW, tag) {
  const layer = LY.add('FD_HINGE_DRAWING', C.HINGE_DRAWING);
  const k = HINGE_KNUCKLE_DIA / 2;
  knuckleL(V, LY, a0, a1, 0, `${tag}Knuckle`);
  rectL(V, layer, a0, k, a1, plateW, HINGE_PLATE_CORNER_R, `${tag}Plate`);
  const cS = (k + plateW) / 2;
  HINGE_SCREW_AT.forEach((f) => {
    const a = a0 + (a1 - a0) * f;
    circleL(V, layer, a, cS, HINGE_SCREW_DIA / 2, `${tag}Screw`);
    circleL(V, layer, a, cS, HINGE_SCREW_HEAD_DIA / 2, `${tag}ScrewHead`);
  });
}

/** The PULL / PUSH face labels over an edge view strip (turned 90, inside the strip). */
function faceLabels(V, LY, topA, T) {
  const layer = LY.add('FD_TEXT', C.TEXT);
  const pull = P(V, topA, 0), push = P(V, topA, T);
  const dirIn = Math.sign(push[0] - pull[0]) || 1;
  const y = Math.max(pull[1], push[1]) + 8;
  const at = (x0, inward) => (inward > 0 ? x0 + 2 + LABEL_H : x0 - 2);
  text(V.E, layer, at(pull[0], dirIn), y, LABEL_H, 'PULL', { rot: 90 });
  text(V.E, layer, at(push[0], -dirIn), y, LABEL_H, 'PUSH', { rot: 90 });
}

// ═════════════════════════════════════════════════════════════════════════════
// THE LEAF
// ═════════════════════════════════════════════════════════════════════════════
function leafViews(fd, LY, leafName) {
  const W = Number(fd.leaf.width), H = Number(fd.leaf.height), T = Number(fd.leaf.thickness);
  const hl = fd.handing?.hingeSide !== 'right';
  const hand = fd.handing?.label || (hl ? 'Hinge left' : 'Hinge right');
  const ops = fd.machining?.leaf || [];
  const opsOf = (kind, face) => ops.filter((o) => o.kind === kind && (!face || o.face === face));
  const through = (o) => Number(o.depth) >= T - 0.05;
  const K = HINGE_KNUCKLE_DIA;
  const hingePos = fd.hinges?.positions || [];
  const recess = fd.hinges?.recess || {};
  const hingeLen = Number(fd.hinges?.length) || 0;
  // the hinge leaf plate: the recess less the same mill oversize its length carries (103 - 102 = 1)
  const plateRaw = Number(recess.width) - (Number(recess.length) - hingeLen);
  const plateW = plateRaw > K / 2 + 2 ? plateRaw : Number(recess.width);
  const layerOf = {
    outline: LY.add('FD_OUTLINE', C.OUTLINE),
    vp: (o) => LY.add(`FD_VP_CUTOUT_${depthTag(o.depth, through(o))}`, C.VP),
    hole: (o) => LY.add(`FD_HOLE_${depthTag(o.depth, through(o))}`, C.HOLE),
    hingeRecess: (o) => LY.add(`FD_HINGE_RECESS_${depthTag(o.depth)}`, C.HINGE_RECESS),
    forend: (o, hidden) => LY.add(`FD_LOCK_FOREND_${depthTag(o.depth)}${hidden ? '_HIDDEN' : ''}`, hidden ? C.LOCK_FOREND_HIDDEN : C.LOCK_FOREND),
    casePocket: (o, hidden) => LY.add(`FD_LOCK_CASE_${depthTag(o.depth)}${hidden ? '_HIDDEN' : ''}`, hidden ? C.LOCK_CASE_HIDDEN : C.LOCK_CASE),
    groove: (o) => LY.add(`FD_INTU_GROOVE_${depthTag(o.depth)}`, C.INTU),
    closer: (hidden) => LY.add(hidden ? 'FD_CLOSER_SYMBOL_HIDDEN' : 'FD_CLOSER_SYMBOL', hidden ? C.CLOSER_HIDDEN : C.CLOSER),
    text: LY.add('FD_TEXT', C.TEXT),
  };
  const sym = fd.closer?.symbol || null;
  const panes = fd.vp?.panes || [];
  const glass = fd.vp?.glass ? `${fd.vp.glass.label} ${fmt(fd.vp.glass.thickness)}` : '';

  // ── (a) the pull face: a = x from the leaf top, b = y from the hinge edge; leaf bottom on local Y 0 ──
  const VF = newView('leafPull', 'leaf', (a, b) => [hl ? b : W - b, H - a]);
  const hingeX = hl ? 0 : W, hingeDir = hl ? -1 : 1, lockX = hl ? W : 0, lockDir = -hingeDir;
  {
    const V = VF;
    rectL(V, layerOf.outline, 0, 0, H, W, 0, 'leafOutline');
    // the vision panel cut-outs, one per pane op, by shape
    const vpOps = opsOf('vpCutout');
    vpOps.forEach((o) => {
      const layer = layerOf.vp(o);
      const a0 = o.x, b0 = o.y, a1 = o.x + o.length, b1 = o.y + o.width, ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
      if (o.shape === 'round') { circleL(V, layer, ac, bc, o.radius > 0 ? o.radius : o.length / 2, 'vpRound'); centreMark(V, LY, ac, bc); }
      else if (o.shape === 'diamond') polyL(V, layer, [[a0, bc], [ac, b1], [a1, bc], [ac, b0]], true, 'vpDiamond');
      else rectL(V, layer, a0, b0, a1, b1, o.radius, 'vpRect');
      const pane = panes.find((q) => q.i === o.pane) || {};
      const size = o.shape === 'round' ? `dia ${fmt(pane.w ?? o.length)}` : o.shape === 'diamond' ? `${fmt(pane.w ?? o.width)} sq at 45` : `${fmt(pane.w ?? o.width)} x ${fmt(pane.h ?? o.length)}`;
      const boxW = o.shape === 'diamond' ? o.width / 2 : o.width, boxH = o.shape === 'diamond' ? o.length / 2 : o.length;
      // a round pane carries its centre mark: the label sits in the lower half
      const la = o.shape === 'round' ? ac + o.length / 4 : ac;
      labelLines(V.E, layerOf.text, P(V, la, bc), [{ s: `VP${o.pane ?? ''}`, h: DIM_H }, { s: size, h: NOTE_H }, ...(glass ? [{ s: glass, h: NOTE_H }] : [])], boxW, o.shape === 'round' ? boxH / 2 : boxH);
    });
    // the spindle and the cylinder / thumbturn holes (x y = the centre, length = the bore)
    const holes = ops.filter((o) => o.kind === 'spindleHole' || o.kind === 'cylinderHole');
    holes.forEach((o) => {
      const r = o.length / 2;
      circleL(V, layerOf.hole(o), o.x, o.y, r, o.kind);
      centreMark(V, LY, o.x, o.y, r + 4);
      const p = P(V, o.x, o.y);
      const what = o.kind === 'spindleHole' ? 'spindle' : (fd.lock?.cylinder?.kind === 'bathroom' ? 'thumbturn' : 'euro cylinder');
      text(V.E, layerOf.text, p[0] + hingeDir * (r + CENTRE_MARK + 6), p[1] - NOTE_H / 2, NOTE_H, `${what} dia ${fmt(o.length)} ${through(o) ? 'through' : `${fmt(o.depth)} deep`}`, { halign: hl ? 2 : 0 });
    });
    // the lock forend recess and the case pocket, seen through the face
    opsOf('forendRecess').forEach((o) => rectL(V, layerOf.forend(o, true), o.x, o.y - o.depth, o.x + o.length, o.y, 0, 'forendHidden'));
    opsOf('casePocket').forEach((o) => rectL(V, layerOf.casePocket(o, true), o.x, o.y - o.depth, o.x + o.length, o.y, 0, 'caseHidden'));
    // the hinge knuckles on the hinge edge (the pull face shows them)
    hingePos.forEach((hp) => knuckleL(V, LY, hp.top, hp.bottom, 0, 'knuckleFace'));
    // the closer symbol (derived.firedoor.closer.symbol, leaf coordinates; not machined)
    if (sym?.kind === 'surface') {
      const hidden = sym.face === 'push';
      const layer = layerOf.closer(hidden);
      const bd = sym.body, arm = sym.arm, shoe = sym.shoe;
      rectL(V, layer, bd.x, bd.y, bd.x + bd.height, bd.y + bd.length, 0, 'closerBody');
      const da = arm.to.x - arm.from.x, db = arm.to.y - arm.from.y, len = Math.hypot(da, db) || 1;
      const na = (-db / len) * (arm.width / 2), nb = (da / len) * (arm.width / 2);
      polyL(V, layer, [[arm.from.x + na, arm.from.y + nb], [arm.to.x + na, arm.to.y + nb], [arm.to.x - na, arm.to.y - nb], [arm.from.x - na, arm.from.y - nb]], true, 'closerArm');
      circleL(V, layer, arm.from.x, arm.from.y, arm.width / 2, 'closerPivot');
      circleL(V, layer, arm.to.x, arm.to.y, arm.width / 2, 'closerPivot');
      rectL(V, layer, shoe.x - shoe.height / 2, shoe.y - shoe.length / 2, shoe.x + shoe.height / 2, shoe.y + shoe.length / 2, 0, 'closerShoe');
      labelLines(V.E, layerOf.text, P(V, bd.x + bd.height / 2, bd.y + bd.length / 2), [{ s: 'surface closer', h: NOTE_H }, { s: `symbol, ${hidden ? 'push face, ' : ''}not machined`, h: LABEL_H }], bd.length, bd.height);
    } else if (sym?.kind === 'builtin') {
      const bd = sym.body;
      rectL(V, layerOf.closer(true), bd.x, bd.y, bd.x + bd.depth, bd.y + bd.length, 0, 'closerBodyHidden');
      labelLines(V.E, layerOf.text, P(V, bd.x + bd.depth / 2, bd.y + bd.length / 2), [{ s: 'built in closer (symbol)', h: LABEL_H }], bd.length, bd.depth);
    }

    // dimensions: the hinge tops from the leaf top, then the leaf height (hinge side)
    let k = 0;
    hingePos.forEach((hp) => dim(V.E, LY, P(V, 0, 0), [hingeX + hingeDir * (K / 2), H - hp.top], 'y', lane(hingeX, hingeDir, k++)));
    dim(V.E, LY, P(V, H, 0), P(V, 0, 0), 'y', lane(hingeX, hingeDir, k++));
    // lock side: the vision panel down the leaf (top -> panes -> bottom), the holes from the leaf bottom
    k = 0;
    if (vpOps.length) {
      const ivs = uniqIntervals(vpOps.map((o) => [o.x, o.x + o.length, o]));
      const pts = [P(V, 0, W)], labels = [];
      // pieces: edge -> pane 1, pane 1, gap, pane 2, ..., last pane -> edge (a zero piece is skipped by dim)
      ivs.forEach(([s, e, o]) => {
        const bRef = o.shape === 'rect' || !o.shape ? o.y + o.width : o.y + o.width / 2;
        labels.push(null);
        pts.push(P(V, s, bRef)); pts.push(P(V, e, bRef));
        labels.push(o.shape === 'round' ? `dia ${fmt(o.length)}` : null);
      });
      labels.push(null);
      pts.push(P(V, H, W));
      chain(V.E, LY, pts, labels, 'y', lane(lockX, lockDir, k++));
    }
    [...holes].sort((p, q) => q.x - p.x).forEach((o) => dim(V.E, LY, P(V, H, W), P(V, o.x, o.y), 'y', lane(lockX, lockDir, k++)));
    // the backset: lock edge to the hole centres, under the lowest hole
    if (holes.length) {
      const low = holes.reduce((p, q) => (q.x > p.x ? q : p));
      const at = P(V, low.x, low.y)[1] - (low.length / 2 + 26);
      const seen = new Set();
      [...holes].sort((p, q) => q.x - p.x).forEach((o) => { if (seen.has(R1(o.y))) return; seen.add(R1(o.y)); dim(V.E, LY, P(V, o.x, o.y), P(V, o.x, W), 'x', at); });
    }
    // under the leaf: the vision panel across (hinge edge -> panes -> lock edge), then the leaf width
    k = 0;
    if (vpOps.length) {
      const ivs = uniqIntervals(vpOps.map((o) => [o.y, o.y + o.width, o]));
      const pts = [P(V, H, 0)], labels = [];
      ivs.forEach(([s, e, o]) => {
        const aRef = o.shape === 'rect' || !o.shape ? o.x + o.length : o.x + o.length / 2;
        labels.push(null);
        pts.push(P(V, aRef, s)); pts.push(P(V, aRef, e));
        labels.push(o.shape === 'round' ? `dia ${fmt(o.width)}` : null);
      });
      labels.push(null);
      pts.push(P(V, H, W));
      chain(V.E, LY, pts, labels, 'x', lane(0, -1, k++));
    }
    dim(V.E, LY, P(V, H, 0), P(V, H, W), 'x', lane(0, -1, k++));
    const vpLine = fd.vp?.panes?.length ? `vision panel ${fd.vp.label}; ${fd.vp.positionLabel}; glass ${glass}` : 'no vision panel';
    addTitle(V, LY, `${leafName}  PULL FACE`, [
      `seen from the pull side (the hinge knuckles), ${hand}: the hinge edge on the ${hl ? 'left' : 'right'}`,
      `leaf ${fmt(W)} x ${fmt(H)} x ${fmt(T)}; ${vpLine}`,
      `${LOCK_LABELS[fd.lock?.type] || fd.lock?.type || ''} lock: spindle ${fmt(fd.lock?.spindle?.fromBottom)} above the leaf bottom, backset ${fmt(fd.lock?.backset)}${fd.lock?.cylinder ? `, ${fd.lock.cylinder.kind === 'bathroom' ? 'thumbturn' : 'cylinder'} ${fmt(fd.lock.cylinder.fromBottom)}` : ''}`,
    ], 'below', 'centre');
  }

  // ── (b) the hinge edge and (c) the lock edge: a = x from the leaf top, c = z from the pull face ──
  const edgeMap = (onLeft) => (onLeft ? (a, c) => [T - c, H - a] : (a, c) => [c, H - a]);
  const hingeOnLeft = hl, lockOnLeft = !hl;
  const VH = newView('leafHingeEdge', 'leaf', edgeMap(hingeOnLeft));
  {
    const V = VH;
    rectL(V, layerOf.outline, 0, 0, H, T, 0, 'leafEdgeOutline');
    const rec = opsOf('hingeRecess', 'hingeEdge');
    rec.forEach((o) => rectL(V, layerOf.hingeRecess(o), o.x, o.z, o.x + o.length, o.z + o.width, o.radius, 'hingeRecessLeaf'));
    const grooves = opsOf('intuGroove', 'hingeEdge').sort((p, q) => p.z - q.z);
    grooves.forEach((o) => rectL(V, layerOf.groove(o), o.x, o.z, o.x + o.length, o.z + o.width, 0, 'grooveHinge'));
    hingePos.forEach((hp) => hingeL(V, LY, hp.top, hp.bottom, plateW, 'hingeLeaf'));
    faceLabels(V, LY, 0, T);
    const farX = P(V, 0, T)[0], farDir = hingeOnLeft ? -1 : 1;
    let k = 0;
    rec.forEach((o) => dim(V.E, LY, P(V, 0, T), P(V, o.x, o.z + o.width), 'y', lane(farX, farDir, k++)));
    if (rec[0]) dim(V.E, LY, P(V, rec[0].x, rec[0].z + rec[0].width), P(V, rec[0].x + rec[0].length, rec[0].z + rec[0].width), 'y', lane(farX, farDir, k++));
    k = 0;
    const last = rec[rec.length - 1];
    if (last) {
      const aE = last.x + last.length;
      dim(V.E, LY, P(V, aE, last.z), P(V, aE, last.z + last.width), 'x', lane(0, -1, k++));
    }
    grooves.forEach((o) => {
      if (o.z > 0.05) dim(V.E, LY, P(V, H, 0), P(V, H, o.z), 'x', lane(0, -1, k++));
      dim(V.E, LY, P(V, H, o.z), P(V, H, o.z + o.width), 'x', lane(0, -1, k++));
    });
    dim(V.E, LY, P(V, H, 0), P(V, H, T), 'x', lane(0, -1, k++));
    const r0 = rec[0];
    addTitle(V, LY, `${leafName}  HINGE EDGE`, [
      r0 ? `${rec.length} hinge recesses ${fmt(r0.length)} x ${fmt(r0.width)} x ${fmt(r0.depth)} deep R${fmt(r0.radius)}, from the pull face` : 'no hinge recess',
      `hinges ${fmt(hingeLen)} drawn (tops ${hingePos.map((hp) => fmt(hp.top)).join(' / ')} from the leaf top)`,
      grooves.length ? `intumescent groove ${fmt(grooves[0].width)} x ${fmt(grooves[0].depth)} deep, ${grooves.length} per edge` : '',
    ], 'below', hingeOnLeft ? 'right' : 'left');
  }
  const VL = newView('leafLockEdge', 'leaf', edgeMap(lockOnLeft));
  {
    const V = VL;
    rectL(V, layerOf.outline, 0, 0, H, T, 0, 'leafEdgeOutline');
    const fo = opsOf('forendRecess', 'lockEdge')[0];
    const cp = opsOf('casePocket', 'lockEdge')[0];
    const grooves = opsOf('intuGroove', 'lockEdge').sort((p, q) => p.z - q.z);
    if (fo) rectL(V, layerOf.forend(fo, false), fo.x, fo.z, fo.x + fo.length, fo.z + fo.width, fo.radius, 'forendSlot');
    if (cp) rectL(V, layerOf.casePocket(cp, false), cp.x, cp.z, cp.x + cp.length, cp.z + cp.width, cp.radius, 'casePocketEdge');
    grooves.forEach((o) => rectL(V, layerOf.groove(o), o.x, o.z, o.x + o.length, o.z + o.width, 0, 'grooveLock'));
    const centre = LY.add('FD_CENTRE', C.CENTRE);
    // the spindle (and cylinder) height across the edge, for orientation
    ops.filter((o) => o.kind === 'spindleHole' || o.kind === 'cylinderHole').forEach((o) => lineL(V, centre, o.x, -CENTRE_MARK, o.x, T + CENTRE_MARK));
    faceLabels(V, LY, 0, T);
    const farX = P(V, 0, T)[0], farDir = lockOnLeft ? -1 : 1;
    let k = 0;
    if (fo) {
      const aF = fo.x + fo.length / 2, cc = fo.z + fo.width / 2;
      lineL(V, centre, aF, fo.z - CENTRE_MARK, aF, T);
      dim(V.E, LY, P(V, 0, T), P(V, aF, T), 'y', lane(farX, farDir, k++));
      dim(V.E, LY, P(V, fo.x, cc), P(V, fo.x + fo.length, cc), 'y', lane(farX, farDir, k++));
    }
    if (cp) {
      const cc = cp.z + cp.width / 2;
      dim(V.E, LY, P(V, 0, T), P(V, cp.x, cc), 'y', lane(farX, farDir, k++));
      dim(V.E, LY, P(V, cp.x, cc), P(V, cp.x + cp.length, cc), 'y', lane(farX, farDir, k++));
    }
    k = 0;
    if (fo) { const aE = fo.x + fo.length - fo.radius; dim(V.E, LY, P(V, aE, fo.z), P(V, aE, fo.z + fo.width), 'x', lane(0, -1, k++)); }
    if (cp) { const aE = cp.x + cp.length - cp.radius; dim(V.E, LY, P(V, aE, cp.z), P(V, aE, cp.z + cp.width), 'x', lane(0, -1, k++)); }
    grooves.forEach((o) => {
      if (o.z > 0.05) dim(V.E, LY, P(V, H, 0), P(V, H, o.z), 'x', lane(0, -1, k++));
      dim(V.E, LY, P(V, H, o.z), P(V, H, o.z + o.width), 'x', lane(0, -1, k++));
    });
    dim(V.E, LY, P(V, H, 0), P(V, H, T), 'x', lane(0, -1, k++));
    const lead = opsOf('leadEdge')[0];
    addTitle(V, LY, `${leafName}  LOCK EDGE`, [
      fo ? `forend ${fmt(fo.length)} x ${fmt(fo.width)} x ${fmt(fo.depth)} deep, full radius ends, centre ${fmt(fd.lock?.forend?.centreFromTop)} from the leaf top` : '',
      cp ? `case pocket ${fmt(cp.length)} x ${fmt(cp.width)} x ${fmt(cp.depth)} deep R${fmt(cp.radius)}; both centred on the thickness` : '',
      lead ? `leading edge bevel (macro LEAD_EDGE ${fmt(lead.value)})` : '',
    ], 'below', lockOnLeft ? 'right' : 'left');
  }

  // ── (d) the top edge: b = y from the hinge edge, c = z from the pull face (pull face at the bottom) ──
  const VT = newView('leafTopEdge', 'leaf', (b, c) => [hl ? b : W - b, c]);
  {
    const V = VT;
    rectL(V, layerOf.outline, 0, 0, W, T, 0, 'leafTopOutline');
    const grooves = opsOf('intuGroove', 'top').sort((p, q) => p.z - q.z);
    grooves.forEach((o) => rectL(V, layerOf.groove(o), o.y, o.z, o.y + o.length, o.z + o.width, 0, 'grooveTop'));
    // the knuckles seen from above (one barrel over the other)
    if (hingePos.length) circleL(V, LY.add('FD_HINGE_DRAWING', C.HINGE_DRAWING), 0, 0, K / 2, 'knuckleTop');
    let closerNote = '';
    if (sym?.kind === 'surface') {
      const bd = sym.body;
      const c0 = sym.face === 'push' ? T : -bd.depth, c1 = sym.face === 'push' ? T + bd.depth : 0;
      rectL(V, layerOf.closer(false), bd.y, c0, bd.y + bd.length, c1, 0, 'closerBodyTop');
      closerNote = `surface closer on the ${sym.face} face (symbol, not machined)`;
    } else if (sym?.kind === 'builtin') {
      const bd = sym.body, tr = sym.track;
      rectL(V, layerOf.closer(false), bd.y, bd.z, bd.y + bd.length, bd.z + bd.width, 0, 'closerPocketTop');
      if (tr) rectL(V, layerOf.closer(true), tr.y, T / 2 - tr.width / 2, tr.y + tr.length, T / 2 + tr.width / 2, 0, 'closerTrackHidden');
      closerNote = `built in closer: body ${fmt(bd.length)} x ${fmt(bd.width)} x ${fmt(bd.depth)} deep at ${fmt(bd.y)} from the hinge edge${tr ? `, track ${fmt(tr.length)} in the head soffit (hidden)` : ''}; symbol, not machined`;
    }
    const tl = P(V, W, 0), tu = P(V, W, T);
    const lx = tl[0] + (hl ? -4 : 4);
    text(V.E, layerOf.text, lx, tl[1] - LABEL_H - 4, LABEL_H, 'PULL FACE', { halign: hl ? 2 : 0 });
    text(V.E, layerOf.text, lx, tu[1] + 4, LABEL_H, 'PUSH FACE', { halign: hl ? 2 : 0 });
    let k = 0;
    grooves.forEach((o) => {
      if (o.z > 0.05) dim(V.E, LY, P(V, W, 0), P(V, W, o.z), 'y', lane(lockX, lockDir, k++));
      dim(V.E, LY, P(V, W, o.z), P(V, W, o.z + o.width), 'y', lane(lockX, lockDir, k++));
    });
    dim(V.E, LY, P(V, W, 0), P(V, W, T), 'y', lane(lockX, lockDir, k++));
    addTitle(V, LY, `${leafName}  TOP EDGE`, [
      'seen from above, the pull face at the bottom',
      grooves.length ? `intumescent groove ${fmt(grooves[0].width)} x ${fmt(grooves[0].depth)} deep (${fd.intumescent?.label || ''}, ${fd.intumescent?.colour?.label || ''})` : 'no intumescent (non-fire)',
      closerNote,
    ], 'above', 'centre');
  }
  return { VF, VH, VL, VT, hl, floor: Number(fd.frame?.gaps?.floor) || 0 };
}
/** The leaf block: the face view at its true height (bottom floorGap above the jamb foot), the edge views beside it, the top edge above. */
function leafBlock(fd, LY, leafName) {
  const { VF, VH, VL, VT, hl, floor } = leafViews(fd, LY, leafName);
  shift(VF.E, 0, floor); shift(VH.E, 0, floor); shift(VL.E, 0, floor); shift(VT.E, 0, floor);
  const bf = bboxOf(VF.E);
  const left = hl ? VH : VL, right = hl ? VL : VH;
  const bl = bboxOf(left.E); shift(left.E, bf.x0 - VIEW_GAP - bl.x1, 0);
  const br = bboxOf(right.E); shift(right.E, bf.x1 + VIEW_GAP - br.x0, 0);
  const bt = bboxOf(VT.E); shift(VT.E, 0, bf.y1 + VIEW_GAP - bt.y0);
  return [VF, VH, VL, VT];
}

// ═════════════════════════════════════════════════════════════════════════════
// THE FRAME MEMBERS
// ═════════════════════════════════════════════════════════════════════════════
function memberBlock(fd, LY, role) {
  const m = (fd.frame?.members || []).find((x) => x.role === role);
  if (!m) return [];
  const M = fd.machining?.[role] || [];
  const L = Number(m.length), t = Number(fd.frame.thickness), D = Number(fd.frame.depth);
  const rb = M.find((o) => o.kind === 'rebate');
  const ry = rb ? Number(rb.y) : Number(fd.frame.faces?.outside), rw = rb ? Number(rb.width) : Number(fd.frame.rebate?.width), rd = rb ? Number(rb.depth) : Number(fd.frame.rebate?.depth);
  const mitres = M.filter((o) => o.kind === 'mitre');
  const mStart = mitres.some((o) => o.x < L / 2), mEnd = mitres.some((o) => o.x >= L / 2);
  const xs = (y) => (mStart ? y : 0), xe = (y) => (mEnd ? L - y : L);
  const isHead = role === 'head';
  const hl = fd.handing?.hingeSide !== 'right';
  // a jamb seen from the outside (pull) face: the hinge jamb stands on the hinge side, its wall face outermost
  const wallLeft = role === 'jambHinge' ? hl : !hl;
  const name = m.id;
  const LYR = {
    outline: LY.add('FD_OUTLINE', C.OUTLINE),
    mitre: LY.add('FD_MITRE', C.MITRE),
    rebate: LY.add(`FD_REBATE_${numTag(rw)}x${numTag(rd)}`, C.REBATE),
    centre: LY.add('FD_CENTRE', C.CENTRE),
    text: LY.add('FD_TEXT', C.TEXT),
  };
  const dowels = M.filter((o) => o.kind === 'dowelBore');
  const dowelLayer = (o, hidden) => LY.add(`FD_DOWEL_${numTag(o.width)}_D${numTag(o.depth)}${hidden ? '_HIDDEN' : ''}`, hidden ? C.DOWEL_HIDDEN : C.DOWEL);
  const endsWithDowels = [mStart ? 'start' : null, mEnd ? 'end' : null].filter(Boolean)
    .map((e) => ({ e, list: dowels.filter((o) => (e === 'start' ? o.x < L / 2 : o.x >= L / 2)).sort((p, q) => p.z - q.z) }));
  const dw = dowels[0];
  const dowelNote = dw ? `${endsWithDowels[0]?.list.length || 0} dowels dia ${fmt(dw.width)} per mitre, bored ${fmt(dw.depth)} square to the mitre (${fmt(fd.frame?.dowels?.length)} long, half in each piece)` : '';

  // ── (a) the elevation: x along the length, y across the thickness from the wall face ──
  const VE = newView(`${role}Elevation`, role, isHead ? (x, y) => [x, -y] : (x, y) => [wallLeft ? y : t - y, L - x]);
  {
    const V = VE;
    polyL(V, LYR.outline, [[0, 0], [L, 0], [xe(t), t], [xs(t), t]], true, 'memberOutline');
    if (mStart) lineL(V, LYR.mitre, 0, 0, t, t, 'mitreLine');
    if (mEnd) lineL(V, LYR.mitre, L, 0, L - t, t, 'mitreLine');
    polyL(V, LYR.rebate, [[xs(ry), ry], [xe(ry), ry], [xe(ry + rw), ry + rw], [xs(ry + rw), ry + rw]], true, 'rebateBand');
    // the dowel bores seen through the member: square to the mitre from the bore centre, the bore depth into this piece
    endsWithDowels.forEach(({ e, list }) => {
      const o = list[0];
      if (!o) return;
      const n = e === 'start' ? [1 / SQ2, -1 / SQ2] : [-1 / SQ2, -1 / SQ2];
      const u = e === 'start' ? [1 / SQ2, 1 / SQ2] : [-1 / SQ2, 1 / SQ2];
      const r = o.width / 2, d = o.depth;
      const at = (s, w) => [o.x + n[0] * s + u[0] * w, o.y + n[1] * s + u[1] * w];
      polyL(V, dowelLayer(o, true), [at(0, -r), at(d, -r), at(d, r), at(0, r)], true, 'dowelBoreHidden');
      const p0 = at(-CENTRE_MARK, 0), p1 = at(d + CENTRE_MARK, 0);
      lineL(V, LYR.centre, p0[0], p0[1], p1[0], p1[1], 'dowelAxis');
    });
    // 45 at each mitre, in the cut-off corner by the long point (clear of the rebate and dowel lines)
    [[mStart, [0.12 * t, 0.44 * t]], [mEnd, [L - 0.12 * t, 0.44 * t]]].forEach(([on, q]) => {
      if (!on) return;
      const p = P(V, q[0], q[1]);
      text(V.E, LYR.text, p[0], p[1], NOTE_H, '45', { halign: 1, valign: 2 });
    });
    if (isHead) {
      dim(V.E, LY, P(V, 0, 0), P(V, L, 0), 'x', lane(0, 1, 0));
      dim(V.E, LY, P(V, xe(ry), ry), P(V, xe(ry + rw), ry + rw), 'y', lane(L, 1, 0));
      dim(V.E, LY, P(V, L, 0), P(V, xe(t), t), 'y', lane(L, 1, 1));
    } else {
      const wallX = wallLeft ? 0 : t, wallDir = wallLeft ? -1 : 1;
      dim(V.E, LY, P(V, L, 0), P(V, 0, 0), 'y', lane(wallX, wallDir, 0));
      dim(V.E, LY, P(V, L, ry), P(V, L, ry + rw), 'x', lane(0, -1, 0));
      dim(V.E, LY, P(V, L, 0), P(V, L, t), 'x', lane(0, -1, 1));
    }
    addTitle(V, LY, `${name}  ELEVATION`, [
      `${ROLE_LABELS[role]}, seen from the outside face; long point ${fmt(L)}, ${isHead ? 'both ends mitred 45' : 'top mitred 45, foot square'}`,
      `${fmt(t)} x ${fmt(D)} finished (raw ${m.rawSection || ''}); rebate ${fmt(rw)} x ${fmt(rd)} from solid, the wall face ${isHead ? 'on top' : `on the ${wallLeft ? 'left' : 'right'}`}`,
      dowelNote ? `${dowelNote}; bores hidden` : '',
    ], 'below', isHead ? 'left' : (wallLeft ? 'right' : 'left'));
  }

  // ── (b) the opening face (the rebate cheek and the opening face, seen from the opening): x along, z from the outside face ──
  const VO = newView(`${role}Opening`, role, isHead ? (x, z) => [x, -z] : (wallLeft ? (x, z) => [z, L - x] : (x, z) => [D - z, L - x]));
  {
    const V = VO;
    rectL(V, LYR.outline, 0, 0, L, D, 0, 'memberFaceOutline');
    if (mStart) { lineL(V, LYR.mitre, xs(ry), 0, xs(ry), rd); lineL(V, LYR.mitre, xs(t), rd, xs(t), D); }
    if (mEnd) { lineL(V, LYR.mitre, xe(ry), 0, xe(ry), rd); lineL(V, LYR.mitre, xe(t), rd, xe(t), D); }
    lineL(V, LYR.rebate, xs(ry), rd, xe(ry), rd, 'rebateDepthLine');
    const rec = M.filter((o) => o.kind === 'hingeRecess');
    rec.forEach((o) => rectL(V, LY.add(`FD_HINGE_RECESS_${depthTag(o.depth)}`, C.HINGE_RECESS), o.x, o.z, o.x + o.length, o.z + o.width, o.radius, 'hingeRecessJamb'));
    if (rec.length) {
      const recess = fd.hinges?.recess || {};
      const hingeLen = Number(fd.hinges?.length) || 0;
      const plateRaw = Number(recess.width) - (Number(recess.length) - hingeLen);
      const plateW = plateRaw > HINGE_KNUCKLE_DIA / 2 + 2 ? plateRaw : Number(recess.width);
      (fd.hinges?.positions || []).forEach((hp) => hingeL(V, LY, hp.jambTop, hp.jambTop + hingeLen, plateW, 'hingeJamb'));
    }
    const pl = M.find((o) => o.kind === 'keepPlate'), pk = M.find((o) => o.kind === 'keepPocket');
    if (pl) rectL(V, LY.add(`FD_KEEP_PLATE_${depthTag(pl.depth)}`, C.KEEP_PLATE), pl.x, pl.z, pl.x + pl.length, pl.z + pl.width, pl.radius, 'keepPlate');
    if (pk) rectL(V, LY.add(`FD_KEEP_POCKET_${depthTag(pk.depth)}`, C.KEEP_POCKET), pk.x, pk.z, pk.x + pk.length, pk.z + pk.width, pk.radius, 'keepPocket');
    if (isHead) {
      dim(V.E, LY, P(V, L, 0), P(V, L, rd), 'y', lane(L, 1, 0));
      dim(V.E, LY, P(V, L, 0), P(V, L, D), 'y', lane(L, 1, 1));
      dim(V.E, LY, P(V, xs(t), D), P(V, xe(t), D), 'x', lane(-D, -1, 0));
    } else {
      const farX = P(V, 0, D)[0], farDir = wallLeft ? 1 : -1;
      let k = 0;
      rec.forEach((o) => dim(V.E, LY, P(V, 0, D), P(V, o.x, o.z + o.width), 'y', lane(farX, farDir, k++)));
      if (rec[0]) dim(V.E, LY, P(V, rec[0].x, rec[0].z + rec[0].width), P(V, rec[0].x + rec[0].length, rec[0].z + rec[0].width), 'y', lane(farX, farDir, k++));
      if (pl) {
        const kc = pl.x + pl.length / 2, zc = pl.z + pl.width / 2;
        lineL(V, LYR.centre, kc, pl.z - CENTRE_MARK, kc, D);
        dim(V.E, LY, P(V, L, D), P(V, kc, D), 'y', lane(farX, farDir, k++));
        dim(V.E, LY, P(V, 0, D), P(V, pl.x, zc), 'y', lane(farX, farDir, k++));
        dim(V.E, LY, P(V, pl.x, zc), P(V, pl.x + pl.length, zc), 'y', lane(farX, farDir, k++));
      }
      if (pk) { const zc = pk.z + pk.width / 2; dim(V.E, LY, P(V, pk.x, zc), P(V, pk.x + pk.length, zc), 'y', lane(farX, farDir, k++)); }
      k = 0;
      const last = rec[rec.length - 1];
      if (last) { const aE = last.x + last.length; dim(V.E, LY, P(V, aE, last.z), P(V, aE, last.z + last.width), 'x', lane(0, -1, k++)); }
      [pl, pk].filter(Boolean).forEach((o) => {
        const aE = o.x + o.length - o.radius;
        if (o.z > 0.05) dim(V.E, LY, P(V, aE, 0), P(V, aE, o.z), 'x', lane(0, -1, k++));
        dim(V.E, LY, P(V, aE, o.z), P(V, aE, o.z + o.width), 'x', lane(0, -1, k++));
      });
      dim(V.E, LY, P(V, L, 0), P(V, L, rd), 'x', lane(0, -1, k++));
      dim(V.E, LY, P(V, L, 0), P(V, L, D), 'x', lane(0, -1, k++));
    }
    const r0 = rec[0];
    addTitle(V, LY, `${name}  ${isHead ? 'SOFFIT (OPENING FACE)' : 'OPENING FACE'}`, [
      `the rebate cheek (z 0 to ${fmt(rd)}) and the opening face, seen from the opening; z from the outside face (shows ${fmt(fd.frame?.faces?.outside)})`,
      r0 ? `${rec.length} hinge recesses ${fmt(r0.length)} x ${fmt(r0.width)} x ${fmt(r0.depth)} deep R${fmt(r0.radius)} (tops ${(fd.hinges?.positions || []).map((hp) => fmt(hp.jambTop)).join(' / ')} from the top long point), hinges drawn` : '',
      pl ? `keep plate ${fmt(pl.length)} x ${fmt(pl.width)} x ${fmt(pl.depth)} deep full radius, centre ${fmt(fd.keep?.centreFromFoot)} above the jamb foot` : '',
      pk ? `keep pocket ${fmt(pk.length)} x ${fmt(pk.width)} x ${fmt(pk.depth)} deep (latch and bolt)` : '',
    ], 'below', isHead ? 'left' : (wallLeft ? 'left' : 'right'));
  }

  // ── (c) the mitre faces, unfolded: s along the mitre from the long point (s = y x sqrt 2), z along the depth ──
  const VMs = endsWithDowels.map(({ e, list }) => {
    const mirror = isHead ? e === 'end' : !wallLeft;
    const V = newView(`${role}Mitre${e === 'start' ? 'Start' : 'End'}`, role, (s, z) => [mirror ? -s : s, -z]);
    const sw = t * SQ2, sr0 = ry * SQ2, sr1 = (ry + rw) * SQ2;
    const pts = sr1 < sw - 0.01
      ? [[0, 0], [sr0, 0], [sr0, rd], [sr1, rd], [sr1, 0], [sw, 0], [sw, D], [0, D]]
      : [[0, 0], [sr0, 0], [sr0, rd], [sw, rd], [sw, D], [0, D]];
    polyL(V, LYR.mitre, pts, true, 'mitreFace');
    list.forEach((o) => { circleL(V, dowelLayer(o, false), o.y * SQ2, o.z, o.width / 2, 'dowelCircle'); centreMark(V, LY, o.y * SQ2, o.z, o.width / 2 + 3); });
    const lpDir = mirror ? 1 : -1;
    let k = 0;
    list.forEach((o) => dim(V.E, LY, P(V, 0, 0), P(V, o.y * SQ2, o.z), 'y', lane(0, lpDir, k++)));
    dim(V.E, LY, P(V, 0, 0), P(V, 0, D), 'y', lane(0, lpDir, k++));
    const lastD = list[list.length - 1];
    k = 0;
    if (lastD) dim(V.E, LY, P(V, 0, D), P(V, lastD.y * SQ2, lastD.z), 'x', lane(-D, -1, k++));
    dim(V.E, LY, P(V, 0, D), P(V, sw, D), 'x', lane(-D, -1, k++));
    const which = isHead ? (e === 'start' ? 'LEFT MITRE' : 'RIGHT MITRE') : 'TOP MITRE';
    addTitle(V, LY, `${name}  ${which}`, [
      `unfolded: ${fmt(sw)} (${fmt(t)} x sqrt 2) by ${fmt(D)}, long point at s 0, outside face at the top`,
      lastD ? `${list.length} dowel bores dia ${fmt(lastD.width)} x ${fmt(lastD.depth)} deep on the thickness centre` : '',
    ], isHead ? 'below' : 'above', mirror ? 'right' : 'left');
    return V;
  });

  // ── the block: true heights (a jamb foot on Y 0, the head wall face on the frame overall height) ──
  if (isHead) {
    shift(VE.E, 0, Number(fd.frame.overall?.height) || L);
    const be = bboxOf(VE.E);
    const bo = bboxOf(VO.E); shift(VO.E, 0, be.y0 - VIEW_GAP - bo.y1);
    const bo2 = bboxOf(VO.E);
    const placed = [];
    VMs.forEach((V) => {
      const end = V.id.endsWith('End');
      shift(V.E, end ? L : 0, 0);
      const b = bboxOf(V.E);
      shift(V.E, 0, bo2.y0 - VIEW_GAP - b.y1);
      placed.push(V);
    });
    if (placed.length === 2) {
      const b0 = bboxOf(placed[0].E), b1 = bboxOf(placed[1].E);
      if (b1.x0 < b0.x1 + VIEW_GAP) shift(placed[1].E, b0.x1 + VIEW_GAP - b1.x0, 0);
    }
    return [VE, VO, ...VMs];
  }
  const be = bboxOf(VE.E), bo = bboxOf(VO.E);
  if (wallLeft) shift(VO.E, be.x1 + VIEW_GAP - bo.x0, 0);
  else shift(VO.E, be.x0 - VIEW_GAP - bo.x1, 0);
  const top = Math.max(bboxOf(VE.E).y1, bboxOf(VO.E).y1);
  VMs.forEach((V) => {
    shift(V.E, wallLeft ? 0 : t, 0);
    const b = bboxOf(V.E);
    shift(V.E, 0, top + VIEW_GAP - b.y0);
  });
  return [VE, VO, ...VMs];
}

// ═════════════════════════════════════════════════════════════════════════════
// THE SHEET
// ═════════════════════════════════════════════════════════════════════════════
/** The title block lines of a door: name, rating, sizes, handing, lock, closer, vision panel, intumescent. */
export function fireDoorDxfTitleLines(derived, element) {
  const fd = derived?.firedoor || {};
  const leaf = fd.leaf || {}, fr = fd.frame || {}, op = fd.opening || {};
  const lock = fd.lock || {};
  const rating = fd.fire ? `${fd.rating || 'FD30'} fire door set` : 'non-fire door set';
  const vp = fd.vp?.panes?.length ? `${fd.vp.label}; ${fd.vp.positionLabel}; glass ${fd.vp.glass?.label || ''} ${fmt(fd.vp.glass?.thickness)}` : 'none';
  const intu = fd.intumescent ? `${fd.intumescent.label}, groove ${fmt(fd.intumescent.groove?.width)} x ${fmt(fd.intumescent.groove?.depth)}, colour ${fd.intumescent.colour?.label || ''}` : 'none (non-fire)';
  const dw = fr.dowels || {};
  const hinges = fd.hinges || {};
  const lines = [
    `${fd.name || ''}  ${rating}${element ? `  (${element})` : ''}`,
    `Leaf ${fmt(leaf.width)} x ${fmt(leaf.height)} x ${fmt(leaf.thickness)}`,
    `Frame overall ${fmt(fr.overall?.width)} x ${fmt(fr.overall?.height)}, depth ${fmt(fr.depth)}, members ${fmt(fr.thickness)} x ${fmt(fr.depth)} (raw ${fmt(fr.rawThickness)} x ${fmt(fr.rawWidth)})`,
    `Structural opening ${fmt(op.width)} x ${fmt(op.height)}`,
    `Rebate ${fmt(fr.rebate?.width)} x ${fmt(fr.rebate?.depth)} from solid, faces ${fmt(fr.faces?.outside)} outside / ${fmt(fr.faces?.inside)} inside`,
    `${fd.handing?.label || ''} (seen from the pull side); ${hinges.count || 0} hinges ${fmt(hinges.length)}, tops ${(hinges.positions || []).map((p) => fmt(p.top)).join(' / ')} from the leaf top`,
    `Lock: ${LOCK_LABELS[lock.type] || lock.type || ''}, spindle ${fmt(lock.spindle?.fromBottom)} above the leaf bottom, backset ${fmt(lock.backset)}, forend centre ${fmt(lock.forend?.centreFromTop)} from the leaf top`,
    `Keep centre ${fmt(fd.keep?.centreFromFoot)} above the lock jamb foot`,
    `Closer: ${fd.closer ? `${fd.closer.label} (symbol, not machined)` : 'none'}`,
    `Vision panel: ${vp}`,
    `Intumescent: ${intu}`,
    dw.count ? `Corner dowels: ${dw.perJoint} x dia ${fmt(dw.dia)} x ${fmt(dw.length)} per corner, bored ${fmt(dw.boreDepth)} square to the mitre` : '',
    'mm, 1:1. Layers by operation and depth; set a dashed linetype on the *_HIDDEN layers',
    'DXF R12, opens in AutoCAD and bSolid (a true .dwg needs a converter)',
    'Production Core, Skylon',
  ];
  return lines.filter(Boolean).map(ascii);
}

/**
 * The DXF entities of one fire door: every element (opts.elements, default all four:
 * 'leaf' | 'head' | 'jambHinge' | 'jambLock') laid out in a row with its views, titles and
 * dimensions, a header over the row and the title block under it. Returns { entities,
 * layers: [{ name, color }], views: [{ id, element, bbox }] } or { error } when the door
 * has no derived fire door data.
 */
export function fireDoorDxfEntities(derived, opts = {}) {
  const fd = derived?.firedoor;
  if (!derived || derived.category !== 'firedoor' || !fd?.machining || !fd.leaf || !fd.frame) {
    return { error: 'not a derived fire door', entities: [], layers: [], views: [] };
  }
  const elements = (Array.isArray(opts.elements) && opts.elements.length ? opts.elements : FIREDOOR_DXF_ELEMENTS).filter((e) => FIREDOOR_DXF_ELEMENTS.includes(e));
  const map = new Map();
  const LY = { add: (name, color) => { if (!map.has(name)) map.set(name, color); return name; } };
  LY.add('FD_OUTLINE', C.OUTLINE); LY.add('FD_DIM', C.DIM); LY.add('FD_TEXT', C.TEXT);
  const leafName = derived.components?.sash?.[0]?.elementName || 'FD-LEAF';

  // the row: each element's views, the block moved to the cursor
  const views = [];
  let cursor = 0;
  elements.forEach((el) => {
    const block = el === 'leaf' ? leafBlock(fd, LY, leafName) : memberBlock(fd, LY, el);
    if (!block.length) return;
    const all = block.flatMap((V) => V.E);
    const bb = bboxOf(all);
    block.forEach((V) => shift(V.E, cursor - bb.x0, 0));
    cursor += (bb.x1 - bb.x0) + BLOCK_GAP;
    block.forEach((V) => views.push(V));
  });
  const entities = [];
  views.forEach((V) => V.E.forEach((e) => { e.view = V.id; entities.push(e); }));
  const rowBox = bboxOf(entities);
  const textLayer = LY.add('FD_TEXT', C.TEXT);
  // the header over the row
  const one = elements.length === 1 ? elements[0] : null;
  const elName = one === 'leaf' ? leafName : one ? ((fd.frame.members || []).find((x) => x.role === one)?.id || one) : '';
  const head = `${fd.name || ''}  ${fd.fire ? (fd.rating || 'FD30') : 'non-fire'}  ${one ? `${elName} (${one === 'leaf' ? 'leaf' : ROLE_LABELS[one]})` : 'all elements: leaf, head, hinge jamb, lock jamb'}  (mm, 1:1)`;
  text(entities, textLayer, rowBox.x0, rowBox.y1 + 120, HEADER_H, head, { tag: 'header' });
  // the title block under the row
  const lines = fireDoorDxfTitleLines(derived, one ? elName : '');
  const pad = 20, gapL = 10;
  const tbW = Math.max(...lines.map((s, i) => textW(s, i === 0 ? BLOCK_TEXT_H * 1.5 : BLOCK_TEXT_H))) + 2 * pad;
  const tbH = lines.reduce((a, s, i) => a + (i === 0 ? BLOCK_TEXT_H * 1.5 : BLOCK_TEXT_H) + gapL, 0) - gapL + 2 * pad;
  const tx = rowBox.x0, ty = rowBox.y0 - 200;   // the block's top edge
  poly(entities, textLayer, [[tx, ty], [tx + tbW, ty], [tx + tbW, ty - tbH], [tx, ty - tbH]], true, 'titleBlockFrame');
  let y = ty - pad;
  lines.forEach((s, i) => {
    const h = i === 0 ? BLOCK_TEXT_H * 1.5 : BLOCK_TEXT_H;
    y -= h;
    text(entities, textLayer, tx + pad, y, h, s, { tag: 'titleBlock' });
    y -= gapL;
  });
  const layers = [...map].map(([name, color]) => ({ name, color }));
  return { entities, layers, views: views.map((V) => ({ id: V.id, element: V.element, bbox: bboxOf(V.E) })) };
}
