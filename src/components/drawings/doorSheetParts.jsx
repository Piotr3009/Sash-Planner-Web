/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * doorSheetParts.jsx: the pieces every door 2D sheet shares (08.10.2026,
 * doors to production): number formatting, the cut list records of one leaf,
 * the glass schedule unit of one leaf, the threshold wording, the opening
 * symbol, glazing bars (elevation bands and detail lines), hinge barrels and
 * the PLAN geometry (horizontal section) of the frame, posts, leaves and side
 * panels that the plan sheet and the leaf sheet's meeting detail draw.
 *
 * Every number comes from derived.door (deriveDoorWindow) or the door profile
 * (getDoorProfile, with the DEFAULT_DOOR_PROFILE fallback for a stored copy
 * that lacks a key). Nothing here is a dimension of its own: the only
 * literals are drawing-symbol sizes in screen units.
 */
import { BAR_WIDTH } from '../../engine/casementBarGrid.js';
import { getDoorProfile, DEFAULT_DOOR_PROFILE, getWindowProfile } from '../../engine/profile.js';
import { glassMakeupFor } from '../../engine/specification.js';
import { displayCode } from '../../engine/partSymbols.js';
import { DimH, DimV, DimChainH, DimChainV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';

export const NS = { vectorEffect: 'non-scaling-stroke' };
export { BAR_WIDTH };

/** A finite number or the fallback. */
export function num(v, fallback = null) {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : fallback;
}

/** Dimension text on the 0.5 grid (the house rule of every sheet). */
export function fmt(n) {
  const r = Math.round(Number(n) * 2) / 2;
  if (!Number.isFinite(r)) return '';
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

/** Glass size text to 0.1 mm (the glass schedule). */
export function fmtGlass(n) {
  const r = Math.round(Number(n) * 10) / 10;
  return Number.isFinite(r) ? String(r) : '';
}

/** Catalogue text printed on a sheet: long dashes become hyphens. */
export function clean(s) {
  return String(s ?? '').replace(/[\u2013\u2014]/g, '-');
}

/** Run a geometry builder; a data problem gives null (the sheet shows a note), never a throw. */
export function safely(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function NoSheet({ text = 'No data.' }) {
  return <div className="text-ink-400 text-sm p-8 text-center">{text}</div>;
}

/** The door profile values the sheets draw, each with the default as fallback. */
export function doorProfileParts() {
  const p = getDoorProfile() || DEFAULT_DOOR_PROFILE;
  const D = DEFAULT_DOOR_PROFILE;
  return {
    cillVisible: num(p.geometry?.cillVisible, D.geometry.cillVisible),
    gapCill: num(p.geometry?.gapCill, D.geometry.gapCill),
    cillInward: {
      faceInternal: num(p.cillInward?.faceInternal, D.cillInward.faceInternal),
      faceExternal: num(p.cillInward?.faceExternal, D.cillInward.faceExternal),
    },
    barrel: num(p.hinges?.barrel, D.hinges.barrel),
    hingeRule: { ...D.hinges, ...(p.hinges || {}) },
    backset: num(p.hardware?.backset, D.hardware.backset),
    panel: {
      boardThickness: num(p.panel?.boardThickness, D.panel.boardThickness),
      boards: num(p.panel?.boards, D.panel.boards),
      coreThickness: num(p.panel?.coreThickness, D.panel.coreThickness),
    },
    sidePanelDepth: num(p.sidePanel?.depth, D.sidePanel.depth),
  };
}

/** Every cut list record of the door (frame first, then the leaves). */
export function doorRecords(derived) {
  const c = derived?.components || {};
  return [...(Array.isArray(c.box) ? c.box : []), ...(Array.isArray(c.sash) ? c.sash : [])];
}

/** '94x57' → { face: 94, depth: 57 }. */
export function sectionParts(section) {
  const [a, b] = String(section || '').split(/[x×]/i);
  return { face: num(a), depth: num(b) };
}

/** '94x57' → '94×57' (empty when the record has no section). */
export function sectionText(section) {
  const s = sectionParts(section);
  return s.face != null && s.depth != null ? `${fmt(s.face)}×${fmt(s.depth)}` : '';
}

/** One member label: code (without the D- prefix), cut length and section of a cut list record. */
export function recordText(rec, extra = '') {
  if (!rec) return '';
  const parts = [`${displayCode(rec.code || rec.elementName)} ${fmt(rec.length)}`];
  const sec = sectionText(rec.section);
  if (sec) parts.push(sec);
  if (extra) parts.push(extra);
  return parts.join(' · ');
}

const LEAF_CODES = ['D-ST/L', 'D-ST/R', 'D-MS', 'D-TR', 'D-BR', 'D-MR'];

/**
 * The cut list records of ONE door leaf. A french door carries the leaf role
 * in the record notes ('hinge (active)', 'meeting (passive) · lip 6',
 * 'active', ...); a single door has one leaf, so every leaf record is its own.
 * Returns { left, right, top, bottom, mid } as seen from outside.
 */
export function leafMemberRecords(derived, leaf) {
  let recs = doorRecords(derived).filter((r) => LEAF_CODES.includes(r.code));
  if (leaf && leaf.role && leaf.role !== 'single') {
    const re = new RegExp(`\\b${leaf.role}\\b`);
    recs = recs.filter((r) => re.test(String(r.notes || '')));
  }
  const by = (code) => recs.find((r) => r.code === code) || null;
  let left = by('D-ST/L');
  let right = by('D-ST/R');
  if (leaf?.meetingSide === 'L') left = by('D-MS');
  if (leaf?.meetingSide === 'R') right = by('D-MS');
  return { left, right, top: by('D-TR'), bottom: by('D-BR'), mid: by('D-MR') };
}

const hasGlass = (o) => num(o?.glass?.w, 0) > 0 && num(o?.glass?.h, 0) > 0;

/**
 * The glass schedule unit (derived.customGlassUnits) of one drawn item. The
 * engine pushes the units per role in the order of its lists and skips an item
 * without glass, so the item is found by its place among the glazed items of
 * the same role. Falls back to the item's own unit rect.
 */
function scheduleUnit(derived, role, ordinal, rect) {
  const units = (derived?.customGlassUnits || []).filter((u) => (u?.role || 'main') === role);
  const u = units[ordinal];
  if (u && num(u.width, 0) > 0 && num(u.height, 0) > 0) return { w: Number(u.width), h: Number(u.height), unit: u };
  return rect && num(rect.w, 0) > 0 && num(rect.h, 0) > 0 ? { w: Number(rect.w), h: Number(rect.h), unit: null } : null;
}

export function leafGlassUnit(derived, i) {
  const ls = derived?.door?.leaves || [];
  if (!hasGlass(ls[i])) return null;
  return scheduleUnit(derived, 'main', ls.slice(0, i).filter(hasGlass).length, ls[i].glass);
}

export function sidePanelGlassUnit(derived, i) {
  const ps = derived?.door?.panelLeaves || [];
  if (!hasGlass(ps[i])) return null;
  return scheduleUnit(derived, 'side', ps.slice(0, i).filter(hasGlass).length, ps[i].glass);
}

export function fanLeafGlassUnit(derived, i) {
  const fl = derived?.door?.fanLeaves || [];
  if (!hasGlass(fl[i])) return null;
  const fixedPanes = (derived?.door?.zones?.transom?.fanPanes || []).length;
  return scheduleUnit(derived, 'fanlight', fixedPanes + fl.slice(0, i).filter(hasGlass).length, fl[i].glass);
}

/** The glass unit thickness and makeup printed on the sheets. */
export function glassSpecText(windowSpec) {
  const gz = windowSpec?.glazing || {};
  const t = num(gz.thickness);
  const makeup = safely(() => glassMakeupFor(gz, getWindowProfile())) || gz.makeup || '';
  return [t != null ? `${fmt(t)}mm` : '', makeup].filter(Boolean).join(' ');
}

/** The threshold of the door in words (timber cill, inward cill, aluminium, low profile). */
export function thresholdText(dr, pp) {
  if (dr?.hasTimberCill) {
    const m = dr.members || {};
    const ext = num(dr.thresholdExtension, 0);
    const base = dr.inward
      ? `inward timber cill ${fmt(m.frameCill)}×${fmt(dr.frameDepth)}, ${fmt(pp.cillInward.faceInternal)} → ${fmt(pp.cillInward.faceExternal)} fall, unrebated`
      : `timber cill ${fmt(m.frameCill)}×${fmt(dr.frameDepth)}, ${fmt(pp.cillVisible)} visible`;
    return ext ? `${base} · threshold extension ${fmt(ext)}` : base;
  }
  if (dr?.threshold === 'aluminium') return 'aluminium threshold (no timber cill)';
  if (dr?.threshold === 'low-profile') return 'low profile threshold (no timber cill)';
  return 'no threshold (no timber cill)';
}

/** The name of a leaf role on a sheet. */
export function roleName(role) {
  if (role === 'active') return 'Active';
  if (role === 'passive') return 'Passive';
  return 'Leaf';
}

/**
 * Opening symbol, the casement convention (CasementElevation2D): two lines
 * from the closing edge corners to the middle of the HINGE edge; a top hung
 * leaf has its apex at the middle of the top edge.
 */
export function OpeningSymbol({ r, hinge, X, Y, dash }) {
  let d = null;
  if (hinge === 'left') d = `M ${X(r.x + r.w)} ${Y(r.y)} L ${X(r.x)} ${Y(r.y + r.h / 2)} L ${X(r.x + r.w)} ${Y(r.y + r.h)}`;
  if (hinge === 'right') d = `M ${X(r.x)} ${Y(r.y)} L ${X(r.x + r.w)} ${Y(r.y + r.h / 2)} L ${X(r.x)} ${Y(r.y + r.h)}`;
  if (hinge === 'top') d = `M ${X(r.x)} ${Y(r.y + r.h)} L ${X(r.x + r.w / 2)} ${Y(r.y)} L ${X(r.x + r.w)} ${Y(r.y + r.h)}`;
  if (!d) return null;
  return <path d={d} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS} strokeDasharray={dash} />;
}

/** Glazing bars as bands across one daylight (the elevation drawing, as CasementElevation2D). */
export function BarBands({ day, bars, X, Y }) {
  const vb = bars?.frame?.vBars || [];
  const hb = bars?.frame?.hBars || [];
  if (!day || (!vb.length && !hb.length)) return null;
  return (
    <g>
      {vb.map((b, k) => (
        <rect key={`v${k}`} x={X(b.left)} y={Y(day.y)} width={X(b.right) - X(b.left)} height={Y(day.y + day.h) - Y(day.y)}
          fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
      ))}
      {hb.map((b, k) => (
        <rect key={`h${k}`} x={X(day.x)} y={Y(b.top)} width={X(day.x + day.w) - X(day.x)} height={Y(b.bot) - Y(b.top)}
          fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
      ))}
    </g>
  );
}

function computeSegments(from, to, cutPairs) {
  if (cutPairs.length === 0) return [{ a: from, b: to }];
  const sorted = [...cutPairs].sort((p, q) => p[0] - q[0]);
  const segs = [];
  let pos = from;
  for (const [cS, cE] of sorted) {
    if (cS > pos) segs.push({ a: pos, b: cS });
    pos = Math.max(pos, cE);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

/**
 * Glazing bars on a detail sheet, the casement leaf detail drawing: bar edges
 * segmented at the crossings, a cross at each crossing and the V-notches at
 * the daylight edges. `notch` is the V-notch depth in drawing units.
 */
export function BarDetail({ day, bars, X, Y, notch }) {
  const vBars = bars?.frame?.vBars || [];
  const hBars = bars?.frame?.hBars || [];
  if (!day || (!vBars.length && !hBars.length)) return null;
  const vSegs = computeSegments(day.y, day.y + day.h, hBars.map((b) => [b.top, b.bot]));
  const hSegs = computeSegments(day.x, day.x + day.w, vBars.map((b) => [b.left, b.right]));
  const line = (key, x1, y1, x2, y2, stroke = COLORS.sash, width = STROKES.bar, op) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={width} {...NS} strokeOpacity={op} />
  );
  const top = Y(day.y), bot = Y(day.y + day.h), lft = X(day.x), rgt = X(day.x + day.w);
  return (
    <g>
      {vBars.map((b, i) => vSegs.map((s, j) => (
        <g key={`v${i}-${j}`}>
          {line('l', X(b.left), Y(s.a), X(b.left), Y(s.b))}
          {line('r', X(b.right), Y(s.a), X(b.right), Y(s.b))}
        </g>
      )))}
      {hBars.map((b, j) => hSegs.map((s, i) => (
        <g key={`h${j}-${i}`}>
          {line('t', X(s.a), Y(b.top), X(s.b), Y(b.top))}
          {line('b', X(s.a), Y(b.bot), X(s.b), Y(b.bot))}
        </g>
      )))}
      {vBars.flatMap((v, vi) => hBars.map((h, hi) => (
        <g key={`x${vi}-${hi}`}>
          {line('a', X(v.left), Y(h.top), X(v.right), Y(h.bot))}
          {line('b', X(v.right), Y(h.top), X(v.left), Y(h.bot))}
        </g>
      )))}
      {vBars.map((b, i) => (
        <g key={`vn${i}`}>
          {line('a', X(b.cx), top - notch, X(b.left), top, COLORS.notch, STROKES.notch, 0.8)}
          {line('b', X(b.cx), top - notch, X(b.right), top, COLORS.notch, STROKES.notch, 0.8)}
          {line('c', X(b.cx), bot + notch, X(b.left), bot, COLORS.notch, STROKES.notch, 0.8)}
          {line('d', X(b.cx), bot + notch, X(b.right), bot, COLORS.notch, STROKES.notch, 0.8)}
        </g>
      ))}
      {hBars.map((b, j) => (
        <g key={`hn${j}`}>
          {line('a', lft - notch, Y(b.cy), lft, Y(b.top), COLORS.notch, STROKES.notch, 0.8)}
          {line('b', lft - notch, Y(b.cy), lft, Y(b.bot), COLORS.notch, STROKES.notch, 0.8)}
          {line('c', rgt + notch, Y(b.cy), rgt, Y(b.top), COLORS.notch, STROKES.notch, 0.8)}
          {line('d', rgt + notch, Y(b.cy), rgt, Y(b.bot), COLORS.notch, STROKES.notch, 0.8)}
        </g>
      ))}
    </g>
  );
}

/** Bar cuts of one daylight for a dimension chain: [[left, right], ...] / [[top, bot], ...]. */
export function barCuts(bars) {
  return {
    v: (bars?.frame?.vBars || []).map((b) => [b.left, b.right]),
    h: (bars?.frame?.hBars || []).map((b) => [b.top, b.bot]),
  };
}

/** Hinge barrels on a hinge edge: `ys` = hinge centres, `barrel` the barrel height (door profile), `w` the symbol width (sheet units). */
export function HingeBarrels({ edgeX, ys, barrel, w, X, Y }) {
  return (
    <g>
      {(ys || []).map((hy, k) => (
        <rect key={k} x={X(edgeX) - w / 2} y={Y(hy - barrel / 2)} width={w} height={Y(hy + barrel / 2) - Y(hy - barrel / 2)}
          rx={w / 2} fill={COLORS.label} stroke={COLORS.label} strokeWidth={STROKES.sashLight} {...NS} />
      ))}
    </g>
  );
}

/**
 * Lever handle symbol: the rose on the spindle and the lever pointing to the
 * hinge side. Sizes in sheet units (a symbol, not a dimension).
 */
export function HandleSymbol({ cx, cy, r, lever, towards }) {
  const dir = towards === 'left' ? -1 : 1;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
      <line x1={cx} y1={cy} x2={cx + dir * lever} y2={cy} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN (horizontal section, looking down). Plan coordinates: x = assembly x
// (the exterior view's left to right), z = depth from the EXTERIOR face (0) to
// the interior face (frameDepth). Sheets map z so the outside is at the bottom.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Polygon of a member section [x0, x1] x [z0, z1] with corner rebates. Corners:
 * c0 exterior-left, c1 exterior-right, c2 interior-right, c3 interior-left;
 * each notch { corner, w (along x), d (along z) }.
 */
function notchedRect(x0, x1, z0, z1, notches = []) {
  const n = (c) => notches.find((q) => q && q.corner === c && q.w > 0 && q.d > 0);
  const pts = [];
  let q = n('c0');
  if (q) pts.push([x0, z0 + q.d], [x0 + q.w, z0 + q.d], [x0 + q.w, z0]); else pts.push([x0, z0]);
  q = n('c1');
  if (q) pts.push([x1 - q.w, z0], [x1 - q.w, z0 + q.d], [x1, z0 + q.d]); else pts.push([x1, z0]);
  q = n('c2');
  if (q) pts.push([x1, z1 - q.d], [x1 - q.w, z1 - q.d], [x1 - q.w, z1]); else pts.push([x1, z1]);
  q = n('c3');
  if (q) pts.push([x0 + q.w, z1], [x0 + q.w, z1 - q.d], [x0, z1 - q.d]); else pts.push([x0, z1]);
  return pts;
}

const cornerOf = (side, face) => (side === 'L'
  ? (face === 'exterior' ? 'c0' : 'c3')
  : (face === 'exterior' ? 'c1' : 'c2'));

/**
 * The plan of the whole door assembly from derived.door:
 *   frame jambs and coupling posts (face x frameDepth) with the leaf rebate
 *   (members.rebate wide) on the face each frame's leaf closes to: the door
 *   frame on the interior when the door opens inward, every other frame on the
 *   exterior; the rebate is drawn as deep as the leaf (leaf flush with that
 *   face: the profile carries no rebate depth);
 *   door leaves (leafDepth) with their stiles, the french meeting stiles half
 *   lapped over the strip where the two leaves overlap (the active leaf on
 *   zones.meetingLap.face), the glass unit centred in the leaf depth;
 *   fixed side panel leaves (member x side panel depth).
 */
export function doorPlan(windowSpec, derived) {
  const dr = derived?.door;
  const z = dr?.zones;
  const m = dr?.members;
  if (!dr || !z || !m) return null;
  const W = num(z.totalWidth);
  const fd = num(dr.frameDepth);
  const ld = num(dr.leafDepth);
  const fJ = num(m.frameJamb);
  const reb = num(m.rebate);
  if (!(W > 0 && fd > 0 && ld > 0 && fJ > 0 && reb > 0)) return null;
  const pp = doorProfileParts();
  const spRec = doorRecords(derived).find((r) => r.code === 'D-SP-ST');
  const spDepth = sectionParts(spRec?.section).depth ?? pp.sidePanelDepth;
  const inward = !!dr.inward;
  const glassT = num(windowSpec?.glazing?.thickness);
  const frames = (z.frames || []).length ? z.frames : [{ x: 0, w: W, kind: 'door' }];
  const faceOf = (f) => (f?.kind === 'door' && inward ? 'interior' : 'exterior');
  const depthOf = (f) => (f?.kind === 'door' ? ld : spDepth);
  const near = (a, b) => Math.abs(a - b) < 0.01;

  const members = [];
  const f0 = frames[0];
  const fN = frames[frames.length - 1];
  members.push({ kind: 'jamb', side: 'left', x0: 0, x1: fJ, face: faceOf(f0),
    pts: notchedRect(0, fJ, 0, fd, [{ corner: cornerOf('R', faceOf(f0)), w: reb, d: depthOf(f0) }]) });
  members.push({ kind: 'jamb', side: 'right', x0: W - fJ, x1: W, face: faceOf(fN),
    pts: notchedRect(W - fJ, W, 0, fd, [{ corner: cornerOf('L', faceOf(fN)), w: reb, d: depthOf(fN) }]) });
  (z.posts || []).forEach((p) => {
    const fl = frames.find((f) => near(f.x + f.w, p.axis));
    const fr = frames.find((f) => near(f.x, p.axis));
    members.push({ kind: 'post', axis: p.axis, x0: p.x, x1: p.x + p.w,
      pts: notchedRect(p.x, p.x + p.w, 0, fd, [
        { corner: cornerOf('L', faceOf(fl)), w: reb, d: depthOf(fl) },
        { corner: cornerOf('R', faceOf(fr)), w: reb, d: depthOf(fr) },
      ]) });
  });

  const glassZ = (z0, depth) => (glassT > 0 ? [z0 + depth / 2 - glassT / 2, z0 + depth / 2 + glassT / 2] : null);

  // Door leaves
  const dz0 = inward ? fd - ld : 0;
  const lap = z.meetingLap || null;
  const all = dr.leaves || [];
  const sorted = [...all].sort((a, b) => a.x - b.x);
  const french = !!dr.isFrench && sorted.length === 2;
  const strip = french ? [sorted[1].x, sorted[0].x + sorted[0].w] : null;
  const leaves = all.map((l) => {
    const x0 = l.x, x1 = l.x + l.w;
    const stile = (sx0, sx1, side) => {
      let notches = [];
      if (side && strip && strip[1] > strip[0]) {
        const lapFace = lap?.face || 'exterior';
        const laps = l.role === (lap?.leaf || 'active');
        // the lapping leaf owns the strip on the lap face, the other leaf the other half
        const notchFace = laps ? (lapFace === 'exterior' ? 'interior' : 'exterior') : lapFace;
        notches = [{ corner: cornerOf(side, notchFace), w: strip[1] - strip[0], d: ld / 2 }];
      }
      return notchedRect(sx0, sx1, dz0, dz0 + ld, notches);
    };
    return {
      leaf: l, x0, x1, z0: dz0, z1: dz0 + ld,
      stiles: [
        stile(x0, x0 + l.stileL, l.meetingSide === 'L' ? 'L' : null),
        stile(x1 - l.stileR, x1, l.meetingSide === 'R' ? 'R' : null),
      ],
      glass: num(l.glass?.w, 0) > 0 ? { x0: l.glass.x, x1: l.glass.x + l.glass.w, z: glassZ(dz0, ld) } : null,
    };
  });

  // Fixed side panel leaves (exterior rebate)
  const panels = (dr.panelLeaves || []).map((pn) => ({
    pn, x0: pn.x, x1: pn.x + pn.w, z0: 0, z1: spDepth,
    stiles: [notchedRect(pn.x, pn.x + pn.member, 0, spDepth), notchedRect(pn.x + pn.w - pn.member, pn.x + pn.w, 0, spDepth)],
    glass: num(pn.glass?.w, 0) > 0 ? { x0: pn.glass.x, x1: pn.glass.x + pn.glass.w, z: glassZ(0, spDepth) } : null,
  }));

  return {
    W, fd, ld, fJ, reb, spDepth, inward, glassT, frames, members, leaves, panels,
    meeting: french ? {
      x: num(z.meetingX, (strip[0] + strip[1]) / 2), strip,
      lapFace: lap?.face || 'exterior',
      left: sorted[0], right: sorted[1],
    } : null,
  };
}

/**
 * Draw (part of) the plan. T = { ox, oy, s, x0 }: sheet x = ox + (x - x0) * s,
 * sheet y = oy + (fd - z) * s (the outside at the bottom). With `clip` the
 * drawing is cut to the window { x0, x1, z0, z1 } (a detail).
 */
export function PlanBody({ plan, T, clip, clipId }) {
  const P = (x, z) => [T.ox + (x - T.x0) * T.s, T.oy + (plan.fd - z) * T.s];
  const poly = (pts) => `M ${pts.map(([x, z]) => P(x, z).join(' ')).join(' L ')} Z`;
  const rect = (x0, x1, z0, z1) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  const body = (
    <g clipPath={clip ? `url(#${clipId})` : undefined}>
      {plan.members.map((mb, i) => (
        <path key={`m${i}`} d={poly(mb.pts)} fill={COLORS.sectionFill} fillOpacity={0.16}
          stroke={COLORS.frame} strokeWidth={STROKES.section} {...NS} />
      ))}
      {[...plan.panels, ...plan.leaves].map((lf, i) => (
        <g key={`l${i}`}>
          {lf.glass?.z && (
            <path d={rect(lf.glass.x0, lf.glass.x1, lf.glass.z[0], lf.glass.z[1])} fill={COLORS.glass}
              fillOpacity={COLORS.glassOpacity} stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
          )}
          {lf.stiles.map((pts, k) => (
            <path key={k} d={poly(pts)} fill={COLORS.sectionFill} fillOpacity={0.08}
              stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
          ))}
        </g>
      ))}
    </g>
  );
  if (!clip) return body;
  const [cx0, cy0] = P(clip.x0, clip.z1);
  const [cx1, cy1] = P(clip.x1, clip.z0);
  return (
    <g>
      <defs>
        <clipPath id={clipId}><rect x={cx0} y={cy0} width={cx1 - cx0} height={cy1 - cy0} /></clipPath>
      </defs>
      {body}
      <rect x={cx0} y={cy0} width={cx1 - cx0} height={cy1 - cy0} fill="none"
        stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray="6,4" />
    </g>
  );
}

/** A DOM-safe id fragment for clip paths. */
export function idOf(windowSpec, tag) {
  return `${tag}-${String(windowSpec?.id || windowSpec?.name || 'door').replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * The plan details of a door (enlarged parts of the plan), in plan
 * coordinates: { kind, title, x0, x1, z0, z1, ... }.
 *   jamb     an outer jamb of the door frame (the hinge side of a single door
 *            when it is an outer jamb) with the leaf stile in its rebate;
 *   meeting  the french meeting stiles with the lap;
 *   post     the first coupling post with its two rebates.
 * The window margins are drawing layout (a fraction of the depth / stile).
 */
export function planDetailWindows(plan) {
  if (!plan) return [];
  const pad = plan.fd * 0.2;
  const z0 = -pad, z1 = plan.fd + pad;
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const out = [];
  const leaves = [...plan.leaves].sort((a, b) => a.x0 - b.x0);
  const door = plan.frames.find((f) => f.kind === 'door');
  if (door && leaves.length) {
    const leftOuter = near(door.x, 0);
    const rightOuter = near(door.x + door.w, plan.W);
    const L0 = leaves[0], LN = leaves[leaves.length - 1];
    let side = null;
    if (leaves.length === 1) {
      // the hinge side jamb when it is an outer jamb, else the other outer jamb
      const pref = L0.leaf.hinge === 'left' ? ['left', 'right'] : ['right', 'left'];
      side = pref.find((sd) => (sd === 'left' ? leftOuter : rightOuter)) || null;
    } else {
      side = leftOuter ? 'left' : (rightOuter ? 'right' : null);
    }
    if (side === 'left') {
      out.push({ kind: 'jamb', side, title: `JAMB${L0.leaf.hinge === 'left' ? ' (hinge side)' : ''}`, leaf: L0,
        x0: -pad, x1: L0.x0 + L0.leaf.stileL * 1.5, z0, z1 });
    } else if (side === 'right') {
      out.push({ kind: 'jamb', side, title: `JAMB${LN.leaf.hinge === 'right' ? ' (hinge side)' : ''}`, leaf: LN,
        x0: LN.x1 - LN.leaf.stileR * 1.5, x1: plan.W + pad, z0, z1 });
    }
  }
  if (plan.meeting) {
    const { left, right } = plan.meeting;
    out.push({ kind: 'meeting', title: 'MEETING STILES', left, right,
      x0: left.x + left.w - left.stileR - left.stileR * 0.5, x1: right.x + right.stileL + right.stileL * 0.5, z0, z1 });
  }
  const post = plan.members.find((mb) => mb.kind === 'post');
  if (post) {
    const items = [...plan.leaves.map((l) => ({ x0: l.x0, x1: l.x1, sL: l.leaf.stileL, sR: l.leaf.stileR })),
      ...plan.panels.map((p) => ({ x0: p.x0, x1: p.x1, sL: p.pn.member, sR: p.pn.member }))];
    const nbL = items.filter((it) => it.x1 <= post.axis + 0.01).sort((a, b) => b.x1 - a.x1)[0];
    const nbR = items.filter((it) => it.x0 >= post.axis - 0.01).sort((a, b) => a.x0 - b.x0)[0];
    out.push({ kind: 'post', title: 'COUPLING POST', post,
      // the leaf edges either side: the gap and land chain (a door with side
      // panels both sides has no outer door jamb to show them on)
      leafL: nbL ? nbL.x1 : null, leafR: nbR ? nbR.x0 : null,
      x0: (nbL ? nbL.x1 - nbL.sR * 1.5 : post.x0 - pad), x1: (nbR ? nbR.x0 + nbR.sL * 1.5 : post.x1 + pad), z0, z1 });
  }
  return out;
}

/** Sheet size of one plan detail at scale s (sheet units per mm), ts = text scale. */
export function planDetailSize(win, s, ts) {
  const rows = win.kind === 'meeting' || win.kind === 'post' ? 3 : 2;
  return { w: (win.x1 - win.x0) * s, h: 22 * ts + (win.z1 - win.z0) * s + (14 + 26 * rows) * ts };
}

/**
 * One plan detail at (left, top), scale s: caption, the clipped plan, the
 * dimensions (chains along the exterior side below, depths beside it) and the
 * role labels. Every label is a number of derived.door / the plan.
 */
export function PlanDetail({ plan, dr, win, left, top, s, ts, vbw, clipId }) {
  const m = dr.members || {};
  const capH = 22 * ts;
  const T = { ox: left, oy: top + capH + (win.z1 - plan.fd) * s, s, x0: win.x0 };
  const PX = (x) => T.ox + (x - T.x0) * s;
  const PZ = (z) => T.oy + (plan.fd - z) * s;
  const winBottom = PZ(win.z0);
  const winTop = PZ(win.z1);
  const winRight = PX(win.x1);
  const row = (k) => winBottom + (24 + 26 * k) * ts;
  const ext = winBottom + 4 * ts;
  const codeFs = SIZES.code * ts;
  const dims = [];
  const depthDim = (x, za, zb, label, key) => dims.push(
    <DimV key={key} x={x} y1={PZ(zb)} y2={PZ(za)} extFrom={x < PX(win.x0) ? PX(win.x0) : winRight} label={label} small vbw={vbw} />);
  if (win.kind === 'jamb') {
    const lf = win.leaf;
    if (win.side === 'left') {
      dims.push(<DimChainH key="j1" y={row(0)} cuts={[0, m.land, lf.x0, lf.x0 + lf.leaf.stileL].map(PX)} extFrom={ext} vbw={vbw}
        minSegment={0} labels={[fmt(m.land), fmt(lf.x0 - m.land), fmt(lf.leaf.stileL)]} />);
      dims.push(<DimChainH key="j2" y={row(1)} cuts={[0, m.land, plan.fJ].map(PX)} extFrom={ext} vbw={vbw}
        minSegment={0} labels={[fmt(m.land), fmt(plan.reb)]} />);
    } else {
      const W = plan.W;
      dims.push(<DimChainH key="j1" y={row(0)} cuts={[lf.x1 - lf.leaf.stileR, lf.x1, W - m.land, W].map(PX)} extFrom={ext} vbw={vbw}
        minSegment={0} labels={[fmt(lf.leaf.stileR), fmt(W - m.land - lf.x1), fmt(m.land)]} />);
      dims.push(<DimChainH key="j2" y={row(1)} cuts={[W - plan.fJ, W - m.land, W].map(PX)} extFrom={ext} vbw={vbw}
        minSegment={0} labels={[fmt(plan.reb), fmt(m.land)]} />);
    }
    // depth dims beside the window, on the opening side (their labels sit right of the line)
    const [xl, xf] = win.side === 'left'
      ? [winRight + 14 * ts, winRight + 36 * ts]
      : [PX(win.x0) - 24 * ts, PX(win.x0) - 50 * ts];
    depthDim(xl, lf.z0, lf.z1, `leaf ${fmt(plan.ld)}`, 'dl');
    depthDim(xf, 0, plan.fd, fmt(plan.fd), 'df');
  } else if (win.kind === 'meeting') {
    const { left: L, right: R, strip, x: mx } = plan.meeting;
    const cuts = [L.x + L.w - L.stileR, strip[0], strip[1], R.x + R.stileL];
    dims.push(<DimChainH key="m1" y={row(0)} cuts={cuts.map(PX)} extFrom={ext} vbw={vbw}
      minSegment={0} labels={[fmt(strip[0] - cuts[0]), fmt(strip[1] - strip[0]), fmt(cuts[3] - strip[1])]} />);
    dims.push(<DimH key="m2" y={row(1)} x1={PX(L.x + L.w - L.stileR)} x2={PX(L.x + L.w)} extFrom={ext}
      label={`${fmt(L.stileR)}`} small vbw={vbw} />);
    dims.push(<DimH key="m3" y={row(2)} x1={PX(R.x)} x2={PX(R.x + R.stileL)} extFrom={ext}
      label={`${fmt(R.stileL)}`} small vbw={vbw} />);
    const lz0 = plan.leaves[0].z0, lz1 = plan.leaves[0].z1;
    depthDim(winRight + 14 * ts, lz0, lz1, `leaf ${fmt(plan.ld)}`, 'm5');
  } else if (win.kind === 'post') {
    const p = win.post;
    // leaf edge · gap · land | axis | land · gap · leaf edge
    const lCuts = [win.leafL, p.x0 + plan.reb, p.axis, p.x1 - plan.reb, win.leafR];
    if (lCuts.every((c) => num(c) != null)) {
      dims.push(<DimChainH key="p0" y={row(0)} cuts={lCuts.map(PX)} extFrom={ext} vbw={vbw}
        minSegment={0} labels={lCuts.slice(0, -1).map((c, i) => fmt(lCuts[i + 1] - c))} />);
    }
    dims.push(<DimChainH key="p1" y={row(1)} cuts={[p.x0, p.x0 + plan.reb, p.x1 - plan.reb, p.x1].map(PX)} extFrom={ext} vbw={vbw}
      minSegment={0} labels={[fmt(plan.reb), fmt(p.x1 - p.x0 - 2 * plan.reb), fmt(plan.reb)]} />);
    dims.push(<DimH key="p2" y={row(2)} x1={PX(p.x0)} x2={PX(p.x1)} extFrom={ext} label={fmt(p.x1 - p.x0)} small vbw={vbw} />);
    depthDim(winRight + 14 * ts, 0, plan.fd, fmt(plan.fd), 'p3');
  }
  return (
    <g>
      <text x={PX(win.x0)} y={top + codeFs} fill={COLORS.subtitle} fontSize={codeFs}
        fontFamily={FONT_FAMILY} textAnchor="start" fontWeight={WEIGHTS.label}>
        {win.title}
      </text>
      <PlanBody plan={plan} T={T} clip={win} clipId={clipId} />
      {win.kind === 'meeting' && (
        <>
          <line x1={PX(plan.meeting.x)} y1={winTop} x2={PX(plan.meeting.x)} y2={winBottom}
            stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={`${8 * ts},${3 * ts},${2 * ts},${3 * ts}`} />
          {/* in the empty half of the window: inside on an outward door, outside on an inward one */}
          <Label x={PX(plan.meeting.x)} y={plan.inward ? winBottom - 8 * ts : winTop + 32 * ts}
            text={`lip ${fmt(plan.meeting.x - plan.meeting.strip[0])} + ${fmt(plan.meeting.strip[1] - plan.meeting.x)}`} vbw={vbw} />
          {[plan.meeting.left, plan.meeting.right].map((l, i) => (
            <Label key={`r${i}`} x={PX(i === 0 ? l.x + l.w - l.stileR / 2 : l.x + l.stileL / 2)} y={winTop + 14 * ts}
              text={String(l.role || '').toUpperCase()} vbw={vbw} />
          ))}
        </>
      )}
      {dims}
    </g>
  );
}

/**
 * One rectangular leaf on its own sheet, the casement leaf sheet layout
 * (CasementLeafDetail2D): outline, dashed sealed unit edge, daylight, bars
 * with crossings and V-notches, the opening symbol (or none for a fixed leaf),
 * member labels from the cut list records, the stile / bar chain along the
 * bottom, the rail / bar chain on the left, the overall width at the TOP and
 * the height on the RIGHT. Used by the side panel and the fanlight sheets.
 *   leaf   { x, y, w, h, daylight, glass, bars } (frame coordinates)
 *   faces  { left, right, top, bottom } member faces
 *   labels [{ place: 'left'|'right'|'top'|'bottom', text }]
 */
export function LeafSheet({ leaf, faces, hinge, labels, title, subtitle, notes = [], windowTag }) {
  const W = leaf.w, H = leaf.h;
  const layoutSc = Math.max(W, H) / 500;
  const ML = 80 * layoutSc, MR = 110 * layoutSc, MT = 80 * layoutSc, MB = 80 * layoutSc;
  const svgW = ML + W + MR;
  const ts = svgW / VIEWBOX_REF;
  const ox = ML, oy = MT;
  const X = (x) => ox + (x - leaf.x);
  const Y = (y) => oy + (y - leaf.y);
  const codeFs = SIZES.code * ts;
  const day = leaf.daylight;
  const bc = barCuts(leaf.bars);
  const hCuts = [leaf.x, leaf.x + faces.left, ...bc.v.flat(), leaf.x + W - faces.right, leaf.x + W];
  const hLabels = Array(hCuts.length - 1).fill(undefined);
  hLabels[0] = fmt(faces.left);
  hLabels[hLabels.length - 1] = fmt(faces.right);
  if (hLabels.length === 3) hLabels[1] = fmt(W - faces.left - faces.right);
  const vCuts = [leaf.y, leaf.y + faces.top, ...bc.h.flat(), leaf.y + H - faces.bottom, leaf.y + H];
  const vLabels = Array(vCuts.length - 1).fill(undefined);
  vLabels[0] = fmt(faces.top);
  vLabels[vLabels.length - 1] = fmt(faces.bottom);
  if (vLabels.length === 3) vLabels[1] = fmt(H - faces.top - faces.bottom);
  // a member label longer than its member (a short fan leaf) moves to the notes
  const fits = (l) => l.text.length * 0.6 * codeFs < 0.9 * ((l.place === 'left' || l.place === 'right') ? H : W);
  const shown = (labels || []).filter((l) => l.text && fits(l));
  const moved = [...new Set((labels || []).filter((l) => l.text && !fits(l)).map((l) => l.text))];
  const allNotes = moved.length ? [...notes, `Members: ${moved.join(', ')}`] : notes;
  const titleY = oy + H + MB;
  const svgH = titleY + (44 + 18 * allNotes.length) * ts;
  const at = {
    left: { x: X(leaf.x + faces.left / 2), rot: true },
    right: { x: X(leaf.x + W - faces.right / 2), rot: true },
    top: { y: Y(leaf.y + faces.top / 2) },
    bottom: { y: Y(leaf.y + H - faces.bottom / 2) },
  };
  const yMid = Y(leaf.y + H / 2);
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>
        <rect x={X(leaf.x)} y={Y(leaf.y)} width={W} height={H} fill="rgba(148,163,184,0.03)"
          stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        {leaf.glass && leaf.glass.w > 0 && (
          <rect x={X(leaf.glass.x)} y={Y(leaf.glass.y)} width={leaf.glass.w} height={leaf.glass.h} fill="none"
            stroke={COLORS.glass} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.5} strokeDasharray={`${4 * ts},${3 * ts}`} />
        )}
        {day && day.w > 0 && day.h > 0 && (
          <rect x={X(day.x)} y={Y(day.y)} width={day.w} height={day.h} fill={COLORS.glass} fillOpacity={0.06}
            stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        )}
        <OpeningSymbol r={leaf} hinge={hinge} X={X} Y={Y} dash={`${6 * ts},${4 * ts}`} />
        <BarDetail day={day} bars={leaf.bars} X={X} Y={Y} notch={3 * ts} />
        {shown.map((l, i) => {
          const p = at[l.place];
          if (!p) return null;
          return p.rot ? (
            <text key={`ml${i}`} x={p.x + codeFs * 0.35} y={yMid} fill={COLORS.label} fontSize={codeFs}
              fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
              transform={`rotate(-90, ${p.x + codeFs * 0.35}, ${yMid})`}>{l.text}</text>
          ) : (
            <text key={`ml${i}`} x={X(leaf.x + W / 2)} y={p.y + codeFs * 0.35} fill={COLORS.label} fontSize={codeFs}
              fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{l.text}</text>
          );
        })}
        <DimChainH y={oy + H + 24 * ts} cuts={hCuts.map(X)} extFrom={oy + H + 4 * ts} vbw={svgW} labels={hLabels} fmt={fmt} />
        <DimChainV x={ox - 24 * ts} cuts={vCuts.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} labels={vLabels} fmt={fmt} />
        <DimV x={ox + W + 40 * ts} y1={Y(leaf.y)} y2={Y(leaf.y + H)} extFrom={X(leaf.x + W)} label={fmt(H)} vbw={svgW} />
        <DimH y={oy - 30 * ts} x1={X(leaf.x)} x2={X(leaf.x + W)} extFrom={Y(leaf.y)} label={fmt(W)} vbw={svgW} />
        <SheetTitle x={svgW / 2} y={titleY} title={title} subtitle={subtitle} notes={allNotes} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}

/** Title, subtitle and note lines (the drawingUtils TitleBlock plus notes in the code size). */
export function SheetTitle({ x, y, title, subtitle, notes = [], ts, vbw }) {
  const fs = SIZES.title * (vbw / VIEWBOX_REF);
  const subFs = SIZES.subtitle * (vbw / VIEWBOX_REF);
  return (
    <g>
      <text x={x} y={y} fill={COLORS.title} fontSize={fs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.title}>{title}</text>
      {subtitle && (
        <text x={x} y={y + 20 * ts} fill={COLORS.subtitle} fontSize={subFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{subtitle}</text>
      )}
      {notes.map((t, i) => (
        <text key={i} x={x} y={y + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={SIZES.code * ts}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
      ))}
    </g>
  );
}
