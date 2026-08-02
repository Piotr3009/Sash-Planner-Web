/**
 * jambDxf.js — CNC drawing generator for sash-window jambs.
 *
 * Geometry is a 1:1 port of the workshop's AutoCAD lisp
 * KIT_SASH_JAMB.lsp v6.1 (Skylon Timber & Glazing) — the file that used to be
 * run by hand in AutoCAD. Every constant below is copied VERBATIM from that
 * lisp; do not "improve" a number without a matching change on the machine
 * side. Verified against the reference export LSp_jambs.dxf
 * (fw=1200, wh=1500, Standard, 2 vents) to 0.001mm in the cnc harness.
 *
 * Output model: a flat entity list ({poly|circle|text}) in mm, y up,
 * origin = bottom-left of the TOP JAMB piece — exactly the lisp's insertion
 * point. dxfWriter.js serialises it; VCarve imports the DXF directly, so the
 * AutoCAD step disappears from the chain.
 *
 * Pieces drawn (left to right, 200mm apart, as the lisp laid them out):
 *   TOP JAMB (with trickle-vent notches) · LEFT JAMB · RIGHT JAMB · TOP HEAD
 * The cill is NOT a CNC part (the lisp never drew it).
 */

// ── Fixed constants (mm) — lisp lines 165..185 ──────────────────────────────
export const JAMB_CNC = Object.freeze({
  grooveW: 5.5,
  grooveInset: 105,
  arcH: 12,
  arcBulge: -0.15,
  stileW: 9,
  stileExt: 7,
  mortiseOff: 58.5,
  mortiseH: 27.5,
  pocketW: 23,
  pocketLen: 386,          // visual stadium length incl. both semicircles
  leftArcShift: 20,
  notchW: 5.5,
  bridgeH: 30,             // bridge left in the 2-vent notches
  jambGap: 200,            // spacing between the four pieces
  headW: 102,
  headInset: 102,
  cutoutW: 60,
  pulleyW: 27,
  pulleyInner: 4,
  pulleyInnerW: 19,
  minWidthFor2Vents: 990,  // lisp: (if (>= fw 990) ...) — below it, always max 1
                           // (was 1050 in the older lisp revision; workshop
                           // lowered it — ~15mm clearance to the mortises at 990)
  textH: 22.5,
  headTextH: 15,
});

// Per-frame-type constants — lisp cond S/L/T. PC frame types map onto them;
// heritage (111mm) has NO lisp variant, so the generator refuses it rather
// than inventing pocket positions.
export const JAMB_TYPES = Object.freeze({
  standard: { jambW: 141, stileX: 65, pocketFromL: 24.25, pulleyL1: 21.75, pulleyL2: 91.25 },
  slim:     { jambW: 121, stileX: 55, pocketFromL: 19.25, pulleyL1: 16.75, pulleyL2: 76.25 },
  triple:   { jambW: 149, stileX: 69, pocketFromL: 24.25, pulleyL1: 23.75, pulleyL2: 97.25 },
});

export const CNC_LAYERS = Object.freeze([
  { name: 'SJ-FRAME',            color: 7 },
  { name: 'SJ-GROOVE',           color: 1 },
  { name: 'SJ-STILE',            color: 5 },
  { name: 'SJ-MORTISE',          color: 3 },
  { name: 'SJ-POCKET',           color: 6 },
  { name: 'SJ-PULLEY-FRAME',     color: 94 },
  { name: 'SJ-PULLEY-DRILL',     color: 1 },
  { name: 'SJ-HEAD-VENT',        color: 4 },
  { name: 'SJ-HEAD-VENT-POCKET', color: 3 },  // lisp used truecolor 88,186,72
  { name: 'SJ-PARTING-SLIP',     color: 140 }, // kerf for the weights divider (light cyan)
  { name: 'SJ-TEXT',             color: 94 },
]);

// ── Entity helpers (mirror sw:/sj: helpers exactly) ─────────────────────────
const rect = (layer, x1, y1, x2, y2) => ({
  type: 'poly', layer, closed: true,
  pts: [[x1, y1, 0], [x2, y1, 0], [x2, y2, 0], [x1, y2, 0]],
});
// Rounded-end slot (stadium) — sj:drawSlot bulge pattern [1,0,1,0]
const slot = (layer, x1, y1, x2, y2) => ({
  type: 'poly', layer, closed: true,
  pts: [[x1, y1, 1], [x2, y1, 0], [x2, y2, 1], [x1, y2, 0]],
});
const circle = (layer, cx, cy, r) => ({ type: 'circle', layer, cx, cy, r });
// sw:drawText → middle-center (72=1, 73=2); head text is bottom-center rotated
const text = (layer, x, y, h, str, rot = 0, valign = 2) => ({
  type: 'text', layer, x, y, h, str, rot, halign: 1, valign,
});

/**
 * All-vent Y positions on the top jamb — lisp lines 277..301.
 * Returns { nv1Bot, nv1Top, nv2Bot, nv2Top, s1Bot, s1Top, s2Bot, s2Top }.
 */
function ventPositions(oy, fw, ventCount, C) {
  const R = C.pocketW / 2;
  if (ventCount === 1) {
    const nv1Bot = oy + fw / 2 - C.pocketLen / 2;
    const nv1Top = oy + fw / 2 + C.pocketLen / 2;
    return { nv1Bot, nv1Top, nv2Bot: 0, nv2Top: 0,
      s1Bot: nv1Bot + R, s1Top: nv1Top - R, s2Bot: 0, s2Top: 0 };
  }
  const mortBot = oy + C.mortiseOff + C.mortiseH;
  const mortTop = oy + fw - C.mortiseOff - C.mortiseH;
  const gap = (mortTop - mortBot - 2 * C.pocketLen) / 3;
  const nv1Bot = mortBot + gap;
  const nv1Top = nv1Bot + C.pocketLen;
  const nv2Bot = nv1Top + gap;
  const nv2Top = nv2Bot + C.pocketLen;
  return { nv1Bot, nv1Top, nv2Bot, nv2Top,
    s1Bot: nv1Bot + R, s1Top: nv1Top - R, s2Bot: nv2Bot + R, s2Top: nv2Top - R };
}

/** Top-jamb outline with vent notches — sj:drawFrameWithNotches verbatim. */
function frameWithNotches(ox, oy, fw, jW, ventCount, V, C) {
  const rx = ox + jW;
  const gBot = oy + C.grooveInset;
  const gTop = oy + fw - C.grooveInset;
  const lgBot = oy + (C.grooveInset - C.leftArcShift);
  const lgTop = oy + fw - (C.grooveInset - C.leftArcShift);
  const gW = C.grooveW, nW = C.notchW, aH = C.arcH, aB = C.arcBulge, bH = C.bridgeH;

  const pts = [
    [ox + gW, oy, 0],
    [rx - gW, oy, 0],
    [rx - gW, gBot, aB],
    [rx, gBot + aH, 0],
  ];
  const notch = (bot, top) => {
    const mid = bot + (top - bot) / 2;
    pts.push(
      [rx, bot, 0],
      [rx - nW, bot, 0],
      [rx - nW, mid - bH / 2, 0],
      [rx, mid - bH / 2, 0],
      [rx, mid + bH / 2, 0],
      [rx - nW, mid + bH / 2, 0],
      [rx - nW, top, 0],
      [rx, top, 0],
    );
  };
  if (ventCount === 1) {
    pts.push([rx, V.nv1Bot, 0], [rx - nW, V.nv1Bot, 0], [rx - nW, V.nv1Top, 0], [rx, V.nv1Top, 0]);
  } else if (ventCount === 2) {
    notch(V.nv1Bot, V.nv1Top);
    notch(V.nv2Bot, V.nv2Top);
  }
  pts.push(
    [rx, gTop - aH, aB],
    [rx - gW, gTop, 0],
    [rx - gW, oy + fw, 0],
    [ox + gW, oy + fw, 0],
    [ox + gW, lgTop, aB],
    [ox, lgTop - aH, 0],
    [ox, lgBot + aH, aB],
    [ox + gW, lgBot, 0],
  );
  return { type: 'poly', layer: 'SJ-FRAME', closed: true, pts };
}

/**
 * Trickle-vent count for a sash window's CNC drawing.
 * 0 is legitimate (windowSpec ventilation says "no vent") — the lisp never
 * knew it, but the drawing must follow the spec, not the tool's old limits.
 * The 2-vent gate stays: below minWidthFor2Vents the jamb physically takes
 * one slot, so a spec of 2 is CLAMPED to 1 — callers should surface
 * `clamped` loudly instead of downgrading silently.
 * Returns { count: 0|1|2, clamped: boolean }.
 */
export function jambVentCount(fw, grilles) {
  const g = Number(grilles) || 0;
  if (g <= 0) return { count: 0, clamped: false };
  if (g >= 2) {
    if (fw >= JAMB_CNC.minWidthFor2Vents) return { count: 2, clamped: false };
    return { count: 1, clamped: true };
  }
  return { count: 1, clamped: false };
}

/**
 * Entity list for ONE window's four jamb pieces.
 * @param {object} p { fw, wh, frameType:'standard'|'slim'|'triple', ventCount:1|2, winNum:string }
 * @param {number} ox insertion x (bottom-left of TOP JAMB)
 * @param {number} oy insertion y
 */
export function buildJambEntities(p, ox = 0, oy = 0) {
  const C = JAMB_CNC;
  const T = JAMB_TYPES[p.frameType];
  if (!T) throw new Error(`No CNC jamb variant for frame type "${p.frameType}" (heritage is not machined from this program)`);
  const fw = Number(p.fw), wh = Number(p.wh);
  if (!(fw > 250) || !(wh > 250)) throw new Error('Window width/height must be > 250mm');
  const ventCount = p.ventCount === 2 ? 2 : (p.ventCount === 0 ? 0 : 1);
  const winNum = p.winNum ? String(p.winNum) : '';

  const jW = T.jambW;
  const rjLen = wh - 108;                       // lisp line 233
  const rxEdge = ox + jW;
  const grooveBot = oy + C.grooveInset;
  const grooveTop = oy + fw - C.grooveInset;
  const pocketL = ox + T.pocketFromL;
  const pocketR = pocketL + C.pocketW;
  const ox2 = ox + jW + C.jambGap;
  const ox3 = ox2 + jW + C.jambGap;
  const ox4 = ox3 + jW + C.jambGap;
  const headBot = oy + C.headInset;
  const headTop = oy + fw - C.headInset;
  const V = ventPositions(oy, fw, ventCount, C);
  const pulleyR1 = jW - T.pulleyL1 - C.pulleyW;
  const pulleyR2 = jW - T.pulleyL2 - C.pulleyW;
  const grooveR = jW - C.grooveW;
  const stileRX = jW - T.stileX - C.stileW;

  const E = [];

  // ── TOP JAMB ──
  E.push(frameWithNotches(ox, oy, fw, jW, ventCount, V, C));
  E.push(rect('SJ-GROOVE', ox - 5.5, grooveBot - 20, ox + C.grooveW, grooveTop + 20));
  E.push(rect('SJ-STILE', ox + T.stileX, oy - C.stileExt, ox + T.stileX + C.stileW, oy + fw + C.stileExt));
  E.push(rect('SJ-MORTISE', ox, oy + C.mortiseOff, rxEdge, oy + C.mortiseOff + C.mortiseH));
  E.push(rect('SJ-MORTISE', ox, oy + fw - C.mortiseOff - C.mortiseH, rxEdge, oy + fw - C.mortiseOff));
  if (ventCount >= 1) E.push(slot('SJ-POCKET', pocketL, V.s1Bot, pocketR, V.s1Top));
  if (ventCount === 2) E.push(slot('SJ-POCKET', pocketL, V.s2Bot, pocketR, V.s2Top));
  // Parting-slip kerf (divider between the sash weights) — Piotr 02.08.2026:
  // a single saw line on the stile centreline at BOTH ends of the top jamb,
  // from the stile start (7mm past the edge) to 5.5mm past the mortise's NEAR
  // edge (58.5 + 5.5 = 64mm in). Not in the reference lisp — PC addition.
  {
    const psX = ox + T.stileX + C.stileW / 2;
    const psDepth = C.mortiseOff + 5.5;
    E.push({ type: 'poly', layer: 'SJ-PARTING-SLIP', closed: false,
      pts: [[psX, oy - C.stileExt, 0], [psX, oy + psDepth, 0]] });
    E.push({ type: 'poly', layer: 'SJ-PARTING-SLIP', closed: false,
      pts: [[psX, oy + fw + C.stileExt, 0], [psX, oy + fw - psDepth, 0]] });
  }
  // Labels sit INSIDE the piece: rotated 90°, head-text height (Piotr 02.08 —
  // the lisp's horizontal 22.5 label overhung the 141mm jamb width).
  if (winNum) E.push(text('SJ-TEXT', ox + jW / 2, oy + fw / 4, C.headTextH, `${winNum} - TOP`, 90, 1));

  // ── LEFT / RIGHT JAMB — shared body, mirrored machining ──
  const sideJamb = (o, stX, pl1, pl2, label) => {
    E.push(rect('SJ-FRAME', o, oy, o + jW, oy + rjLen));
    E.push(rect('SJ-STILE', o + stX, oy - C.stileExt, o + stX + C.stileW, oy + rjLen + C.stileExt));
    for (const pl of [pl1, pl2]) {
      E.push(slot('SJ-PULLEY-FRAME', o + pl, oy + rjLen - 166.5, o + pl + C.pulleyW, oy + rjLen - 73.5));
      E.push(rect('SJ-POCKET', o + pl + C.pulleyInner, oy + rjLen - 163.5,
        o + pl + C.pulleyInner + C.pulleyInnerW, oy + rjLen - 76.5));
      const cx = o + pl + C.pulleyW / 2;
      E.push(circle('SJ-PULLEY-DRILL', cx, oy + rjLen - 70, 1.5));
      E.push(circle('SJ-PULLEY-DRILL', cx, oy + rjLen - 170, 1.5));
    }
    if (winNum) E.push(text('SJ-TEXT', o + jW / 2, oy + rjLen / 4, C.headTextH, `${winNum} - ${label}`, 90, 1));
  };
  sideJamb(ox2, T.stileX, T.pulleyL1, T.pulleyL2, 'L');
  E.push(rect('SJ-GROOVE', ox2 - 5.5, oy - 5.5, ox2 + C.grooveW, oy + rjLen + 5.5));
  sideJamb(ox3, stileRX, pulleyR1, pulleyR2, 'R');
  E.push(rect('SJ-GROOVE', ox3 + grooveR, oy - 5.5, ox3 + jW + 5.5, oy + rjLen + 5.5));

  // ── TOP HEAD — exists ONLY to machine the vent cutouts; with 0 vents the
  // head is a plain saw-cut board, so the CNC file has no fourth piece at all
  // (Piotr 02.08.2026). ──
  if (ventCount > 0) {
  E.push(rect('SJ-FRAME', ox4, headBot, ox4 + C.headW, headTop));
  const hx1 = ox4 + C.headW - C.cutoutW;
  const hx2 = ox4 + C.headW + 10;
  const halves = (bot, top) => {                 // two overlapping halves, 11mm lap
    const mid = bot + (top - bot) / 2;
    E.push(rect('SJ-HEAD-VENT', hx1, bot, hx2, mid + 5.5));
    E.push(rect('SJ-HEAD-VENT', hx1, mid - 5.5, hx2, top));
  };
  const overlay = (bot, top) =>                  // pocket overlay, 8mm inset
    E.push(rect('SJ-HEAD-VENT-POCKET', hx1 + 8, bot + 8, ox4 + C.headW + 2, top - 8));
  if (ventCount === 1) {
    halves(V.nv1Bot, V.nv1Top);
    overlay(V.nv1Bot, V.nv1Top);
  } else {
    for (const [bot, top] of [[V.nv1Bot, V.nv1Top], [V.nv2Bot, V.nv2Top]]) {
      const mid = bot + (top - bot) / 2;
      halves(bot, mid - C.bridgeH / 2);          // section below the bridge
      halves(mid + C.bridgeH / 2, top);          // section above the bridge
      overlay(bot, mid - C.bridgeH / 2);
      overlay(mid + C.bridgeH / 2, top);
    }
  }
  if (winNum) {
    E.push(text('SJ-TEXT', ox4 + C.headW / 2, headBot + (headTop - headBot) / 4,
      C.headTextH, `${winNum} - HEAD`, 90, 1));  // rotated, bottom-center (lisp 73=1)
  }
  }
  return E;
}

/** Bounding box of an entity list (text ignored — machining extents only). */
export function entitiesBBox(entities) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    if (e.type === 'poly') {
      for (const [x, y] of e.pts) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    } else if (e.type === 'circle') {
      minX = Math.min(minX, e.cx - e.r); maxX = Math.max(maxX, e.cx + e.r);
      minY = Math.min(minY, e.cy - e.r); maxY = Math.max(maxY, e.cy + e.r);
    }
  }
  return { minX, minY, maxX, maxY };
}

export const MERGE_GAP = 300; // vertical gap between windows in a PP export

/**
 * Merge many windows into one entity list, stacked in rows top-down.
 * windows: [{ fw, wh, frameType, ventCount, winNum }]
 */
export function buildMergedJambEntities(windows) {
  const all = [];
  let cursorY = 0;
  for (const w of windows) {
    const ents = buildJambEntities(w, 0, 0);
    const bb = entitiesBBox(ents);
    const oy = cursorY - bb.maxY;                // this window's top sits at the cursor
    for (const e of ents) {
      if (e.type === 'poly') all.push({ ...e, pts: e.pts.map(([x, y, b]) => [x, y + oy, b]) });
      else if (e.type === 'circle') all.push({ ...e, cy: e.cy + oy });
      else all.push({ ...e, y: e.y + oy });
    }
    cursorY = oy + bb.minY - MERGE_GAP;          // next window below, 300mm clear
  }
  return all;
}
