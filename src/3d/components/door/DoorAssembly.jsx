/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorAssembly.jsx
 * The door 3D drawn from the engine (doors to production, brief 5.1 and 5.2).
 *
 * DoorWindow renders this component when it receives the optional `doorGeo`
 * prop: utils/windowSpecToConfig.js doorGeometryFromSpec(windowSpec), which is
 * deriveWindowData(windowSpec).door plus the few profile numbers the engine
 * does not echo. Every size and position below comes from doorGeo; nothing
 * here imports the profile (PSW port rule). The constants at the top of this
 * file are rendering details carried over from the door 3D (bead chamfer and
 * ovolo, seal strip, hinge barrel radius, opening angles, panel moulding),
 * not workshop numbers.
 *
 * Coordinates: doorGeo is in assembly mm, origin at the assembly top-left
 * seen from OUTSIDE, y DOWN. This group's origin is the centre of the DOOR
 * zone (the origin DoorWindow always had):
 *     x3 = xA - (doorX + doorW / 2),   y3 = (transomH + doorH / 2) - yA   (to m)
 * and +z is the exterior face.
 *
 * What is drawn (owner box of 08.10.2026):
 *   frame    one land band (the part of the frame that is full depth) around
 *            every opening, built from the openings themselves: the head and
 *            the cill run the full assembly, ONE coupling post 136 between a
 *            side panel and the door (two rebates), the fanlight rail is the
 *            engine's transom band (zones.transom.band, owner drawing check);
 *            a rebate stop (21) with a seal strip inside every leaf opening,
 *            on the interior for outward leaves and on the exterior for an
 *            inward door; the outward cill is the casement cill (68, 41
 *            visible, 27 stop), the inward cill is unrebated (40 falling to
 *            35), an aluminium / low-profile threshold is a strip under the
 *            leaf (no timber cill).
 *   leaves   stiles 94, top 94, bottom 180, mid rail 94 and the panel per
 *            style, french meeting stiles 100 with the 6 lip each side: the
 *            ACTIVE leaf laps the passive one on the face it opens to
 *            (zones.meetingLap), so the two leaves overlap 12 at the centre
 *            line; glass at the daylight, the sealed unit as thick as the
 *            glazing; side panel leaves 57 all round (fixed); the opening
 *            fanlight is a casement top hung leaf (64 / 64 / 67), the fixed
 *            fanlight is glass in the frame.
 *   ironmongery  hinges at the engine's hinge centres (3, or 4 above 2100),
 *            handles on the active leaf (lockType single) or on both leaves
 *            (lockType double), the spindle at the engine's handle height and
 *            the profile backset from the lock edge.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import DoorGlazing from './DoorGlazing';
import DoorHandleChrome, { SPINDLE_Y } from './DoorHandleChrome';
import WindowCasementHandle from '../casement/WindowCasementHandle';

const mm = (v) => v / 1000;
const R2 = (v) => Math.round(v * 100) / 100;

// ─── Rendering details (the existing door 3D's, not workshop numbers) ───
const EBW = 9;          // EXT glazing chamfer: 9 on the face
const EBD = 15;         //                       x 15 deep
const IBR = 11;         // INT glazing ovolo radius
const OVOLO_N = 16;     // ovolo arc segments
const GASKET_W = 19;    // seal strip on the rebate stop (DoorFrame.jsx)
const GASKET_T = 5;     //   and its thickness: the leaf sits on it
const HINGE_R = 5;      // hinge barrel radius
const MAX_ANGLE = 70;   // leaf opening at slider 1, degrees (DoorPanel.jsx)
const FAN_ANGLE = 30;   // top hung fanlight tilt at slider 1, degrees (DoorWindow.jsx)
const MOULD = { bevelOut: 50, bevelIn: 30, recess: 8 };   // raised and fielded panel (DoorPanel.jsx look)
const BEAD = { w: 20, h: 15 };                            // panel beading moulding (DoorPanel.jsx)
const FINISH = {
  brass: '#d4af37', chrome: '#e8eaec', stainless: '#c8c8c8',
  antique_brass: '#9c7722', black: '#1a1a1a', white: '#f0f0f0',
};

// ─── Profile helpers (mm in, metres out) ───
function arcPts(cx, cy, r, a0, a1) {
  const pts = [];
  for (let i = 1; i <= OVOLO_N; i++) {
    const a = a0 + (i / OVOLO_N) * (a1 - a0);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
function toShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(mm(pts[0][0]), mm(pts[0][1]));
  for (let i = 1; i < pts.length; i++) s.lineTo(mm(pts[i][0]), mm(pts[i][1]));
  s.closePath();
  return s;
}
// A stile half (X = mm from the leaf's LEFT edge, Y = mm from the EXT face).
// a = the stile's outer edge (0, or the meeting rebate cut), f = its glazing
// edge. Written for a left stile; a right stile is mirrored about the leaf.
function stileProfile(half, a, f, D) {
  const hd = D / 2;
  return half === 'ext'
    ? [[a, 0], [f - EBW, 0], [f, EBD], [f, hd], [a, hd]]
    : [[a, hd], [f, hd], [f, D - IBR], ...arcPts(f - IBR, D - IBR, IBR, 0, Math.PI / 2), [a, D]];
}
// A rail half (X = mm from the EXT face, Y = mm from the rail's lower edge,
// F = the rail face). 'bottom' glazes on its upper edge, 'top' on its lower
// edge, 'mid' on both.
function railProfile(kind, half, F, D) {
  const hd = D / 2;
  if (kind === 'bottom') {
    return half === 'ext'
      ? [[0, 0], [0, F - EBW], [EBD, F], [hd, F], [hd, 0]]
      : [[hd, 0], [hd, F], [D - IBR, F], ...arcPts(D - IBR, F - IBR, IBR, Math.PI / 2, 0), [D, 0]];
  }
  if (kind === 'top') {
    return half === 'ext'
      ? [[0, F], [0, EBW], [EBD, 0], [hd, 0], [hd, F]]
      : [[hd, F], [hd, 0], [D - IBR, 0], ...arcPts(D - IBR, IBR, IBR, -Math.PI / 2, 0), [D, F]];
  }
  return half === 'ext'
    ? [[0, EBW], [EBD, 0], [hd, 0], [hd, F], [EBD, F], [0, F - EBW]]
    : [[hd, 0], [D - IBR, 0], ...arcPts(D - IBR, IBR, IBR, -Math.PI / 2, 0), [D, F - IBR],
      ...arcPts(D - IBR, F - IBR, IBR, 0, Math.PI / 2), [hd, F]];
}

/**
 * The members, glass and panel of one leaf, in the leaf's own frame (origin at
 * the leaf centre, y up, +z the exterior face). Every number arrives in `L`
 * (mm, measured from the leaf's top-left corner, y down):
 *   W, H, D           leaf width, height, depth
 *   sL, sR            { face, cutExt, cutInt }: the stile faces and, on a
 *                     french meeting stile, the rebate cut of the half that
 *                     the other leaf laps (0 elsewhere)
 *   top, bottom       rail faces; mid { y, face } (top edge from the leaf top)
 *   glass             daylight rect; unit (thickness); barXs / barYs (mm from
 *                     the glass centre, x right, y up)
 *   panel             daylight rect; panelThick; paneling
 */
function LeafBody({ L, mat, matInt, spacerColor, glassFinish }) {
  const key = JSON.stringify(L);
  const parts = useMemo(() => {
    const { W, H, D, sL, sR } = L;
    const out = [];
    // stiles: full leaf height
    for (const [side, s] of [['L', sL], ['R', sR]]) {
      for (const half of ['ext', 'int']) {
        const cut = half === 'ext' ? s.cutExt : s.cutInt;
        let pts = stileProfile(half, cut, s.face, D);
        if (side === 'R') pts = pts.map(([x, y]) => [W - x, y]);
        out.push({ name: `stile-${side}-${half}`, half, shape: toShape(pts), depth: H, rot: [-Math.PI / 2, 0, 0], pos: [-W / 2, -H / 2, D / 2] });
      }
    }
    // rails: full leaf width (less the meeting rebate cut of that half)
    const rails = [['top', 0, L.top], ['bottom', H - L.bottom, L.bottom]];
    if (L.mid) rails.push(['mid', L.mid.y, L.mid.face]);
    for (const [kind, yTop, F] of rails) {
      for (const half of ['ext', 'int']) {
        const x0 = half === 'ext' ? sL.cutExt : sL.cutInt;
        const x1 = W - (half === 'ext' ? sR.cutExt : sR.cutInt);
        out.push({ name: `rail-${kind}-${half}`, half, shape: toShape(railProfile(kind, half, F, D)), depth: x1 - x0, rot: [0, Math.PI / 2, 0], pos: [-W / 2 + x0, H / 2 - (yTop + F), D / 2] });
      }
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const panelMat = useMemo(() => { const m = mat.clone(); m.side = THREE.DoubleSide; return m; }, [mat]);
  const panelMatInt = useMemo(() => { const m = (matInt || mat).clone(); m.side = THREE.DoubleSide; return m; }, [mat, matInt]);

  const { W, H } = L;
  const at = (r) => [mm(r.x + r.w / 2 - W / 2), mm(H / 2 - (r.y + r.h / 2)), 0];
  return (
    <group>
      {parts.map((p) => (
        <mesh key={p.name} castShadow receiveShadow rotation={p.rot} position={p.pos.map(mm)} material={p.half === 'ext' ? mat : (matInt || mat)}>
          <extrudeGeometry args={[p.shape, { depth: mm(p.depth), bevelEnabled: false }]} />
        </mesh>
      ))}
      {L.glass && L.glass.w > 0 && L.glass.h > 0 && (
        <DoorGlazing width={L.glass.w} height={L.glass.h} unitDepthMm={L.unit}
          barXs={L.barXs || []} barYs={L.barYs || []}
          barMaterial={mat} barMaterialInt={matInt || mat}
          spacerColor={spacerColor} glassFinish={glassFinish} position={at(L.glass)} />
      )}
      {L.panel && L.panel.w > 0 && L.panel.h > 0 && (
        <PanelInfill rect={L.panel} thick={L.panelThick} paneling={L.paneling} pos={at(L.panel)}
          mat={panelMat} matInt={panelMatInt} />
      )}
    </group>
  );
}

// The half-glazed / three-quarter panel (two Tricoya boards and an MDF core,
// doorGeo.panels thickness) at its daylight, in the glass rebate. 'panel'
// adds a raised field on both faces, 'beading' a moulding round the daylight.
function PanelInfill({ rect, thick, paneling, pos, mat, matInt }) {
  const w = rect.w, h = rect.h;
  const T = Number(thick) > 0 ? thick : 0;
  const raised = paneling === 'panel' && w > 2 * (MOULD.bevelOut + MOULD.bevelIn) && h > 2 * (MOULD.bevelOut + MOULD.bevelIn) && T > 2 * MOULD.recess;
  const quads = useMemo(() => {
    if (!raised) return null;
    const make = (sign) => {
      const zo = sign * (T / 2 - MOULD.recess), zi = sign * (T / 2);
      const o = { l: -w / 2 + MOULD.bevelOut, r: w / 2 - MOULD.bevelOut, b: -h / 2 + MOULD.bevelOut, t: h / 2 - MOULD.bevelOut };
      const i = { l: o.l + MOULD.bevelIn, r: o.r - MOULD.bevelIn, b: o.b + MOULD.bevelIn, t: o.t - MOULD.bevelIn };
      const q = (A, B, C, Dp) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...A, ...B, ...C, ...Dp].map(mm)), 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.computeVertexNormals();
        return g;
      };
      return [
        q([o.l, o.t, zo], [o.r, o.t, zo], [i.r, i.t, zi], [i.l, i.t, zi]),
        q([o.r, o.b, zo], [o.l, o.b, zo], [i.l, i.b, zi], [i.r, i.b, zi]),
        q([o.l, o.b, zo], [o.l, o.t, zo], [i.l, i.t, zi], [i.l, i.b, zi]),
        q([o.r, o.t, zo], [o.r, o.b, zo], [i.r, i.b, zi], [i.r, i.t, zi]),
      ];
    };
    return { ext: make(1), int: make(-1) };
  }, [raised, w, h, T]);
  if (!(T > 0)) return null;
  const inner = { w: w - 2 * (MOULD.bevelOut + MOULD.bevelIn), h: h - 2 * (MOULD.bevelOut + MOULD.bevelIn) };
  return (
    <group position={pos}>
      {/* the board (thinner at the moulding when raised and fielded), split EXT / INT for the colours */}
      <mesh castShadow receiveShadow position={[0, 0, mm((raised ? T / 2 - MOULD.recess : T / 2) / 2)]} material={mat}>
        <boxGeometry args={[mm(w), mm(h), mm(raised ? T / 2 - MOULD.recess : T / 2)]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0, -mm((raised ? T / 2 - MOULD.recess : T / 2) / 2)]} material={matInt}>
        <boxGeometry args={[mm(w), mm(h), mm(raised ? T / 2 - MOULD.recess : T / 2)]} />
      </mesh>
      {raised && quads && (
        <group>
          <mesh castShadow receiveShadow position={[0, 0, mm(T / 4)]} material={mat}>
            <boxGeometry args={[mm(inner.w), mm(inner.h), mm(T / 2)]} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0, -mm(T / 4)]} material={matInt}>
            <boxGeometry args={[mm(inner.w), mm(inner.h), mm(T / 2)]} />
          </mesh>
          {quads.ext.map((g, i) => <mesh key={`qe${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
          {quads.int.map((g, i) => <mesh key={`qi${i}`} geometry={g} material={matInt} castShadow receiveShadow />)}
        </group>
      )}
      {paneling === 'beading' && [1, -1].map((sign) => (
        <group key={`bead${sign}`}>
          {[
            [0, h / 2 - BEAD.w / 2, w, BEAD.w],
            [0, -h / 2 + BEAD.w / 2, w, BEAD.w],
            [-w / 2 + BEAD.w / 2, 0, BEAD.w, h - 2 * BEAD.w],
            [w / 2 - BEAD.w / 2, 0, BEAD.w, h - 2 * BEAD.w],
          ].map(([x, y, bw, bh], i) => (
            <mesh key={i} castShadow receiveShadow position={[mm(x), mm(y), sign * mm(T / 2 + BEAD.h / 2)]} material={sign > 0 ? mat : matInt}>
              <boxGeometry args={[mm(bw), mm(bh), mm(BEAD.h)]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// Rotate a leaf about its hinge edge (side hung) or its top edge (top hung).
function Swing({ hinge, angle, W, H, children }) {
  if (!angle) return <group>{children}</group>;
  if (hinge === 'left') {
    return (
      <group position={[-W / 2, 0, 0]}><group rotation={[0, -angle, 0]}><group position={[W / 2, 0, 0]}>{children}</group></group></group>
    );
  }
  if (hinge === 'right') {
    return (
      <group position={[W / 2, 0, 0]}><group rotation={[0, angle, 0]}><group position={[-W / 2, 0, 0]}>{children}</group></group></group>
    );
  }
  if (hinge === 'top') {
    return (
      <group position={[0, H / 2, 0]}><group rotation={[-angle, 0, 0]}><group position={[0, -H / 2, 0]}>{children}</group></group></group>
    );
  }
  return <group>{children}</group>;
}

// The frame's land band: every grid cell (cut at the openings' edges) that no
// opening covers, merged into the fewest boxes (rows first, then equal runs
// down the rows). Rects in assembly mm.
export function frameLandRects(totalWidth, totalHeight, openings) {
  const uniq = (a) => [...new Set(a.map(R2))].sort((p, q) => p - q);
  const xs = uniq([0, totalWidth, ...openings.flatMap((o) => [o.x0, o.x1])]).filter((v) => v >= 0 && v <= totalWidth);
  const ys = uniq([0, totalHeight, ...openings.flatMap((o) => [o.y0, o.y1])]).filter((v) => v >= 0 && v <= totalHeight);
  const covered = (cx, cy) => openings.some((o) => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1);
  const done = [];
  let open = [];
  for (let j = 0; j < ys.length - 1; j++) {
    const y0 = ys[j], y1 = ys[j + 1];
    const runs = [];
    let start = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const free = !covered((xs[i] + xs[i + 1]) / 2, (y0 + y1) / 2);
      if (free && start == null) start = xs[i];
      if (!free && start != null) { runs.push([start, xs[i]]); start = null; }
    }
    if (start != null) runs.push([start, xs[xs.length - 1]]);
    const next = [];
    for (const [x0, x1] of runs) {
      const prev = open.find((b) => b.x0 === x0 && b.x1 === x1);
      if (prev) { prev.y1 = y1; next.push(prev); } else next.push({ x0, x1, y0, y1 });
    }
    open.filter((b) => !next.includes(b)).forEach((b) => done.push(b));
    open = next;
  }
  done.push(...open);
  return done;
}

// The openings of the assembly (assembly mm): every leaf opening is the leaf
// grown by the fitting gap (the land's inner edge), with the rebate stop ring
// inside it; a fixed fanlight pane is glazed into the frame, so its opening is
// its daylight and it has no stop.
export function doorOpenings(geo) {
  const m = geo.members || {};
  const gap = Number(m.gap) || 0;
  const reb = Number(m.rebate) || 0;
  const inset = Number(m.inset) || 0;
  const H = geo.totalHeight;
  const cill = geo.cill || {};
  const outwardCill = geo.hasTimberCill && !geo.inward;
  const leafBottom = outwardCill ? R2(H - cill.visible) : H;      // land top of the outward cill, else the floor
  const bottomStop = outwardCill ? { y0: R2(H - cill.face), y1: leafBottom } : null;
  const ring = (o, withBottom) => {
    const strips = [{ edge: 'top', x0: o.x0, x1: o.x1, y0: o.y0, y1: R2(o.y0 + reb) }];
    let yb = o.y1;
    if (withBottom === 'rail') { strips.push({ edge: 'bottom', x0: o.x0, x1: o.x1, y0: R2(o.y1 - reb), y1: o.y1 }); yb = R2(o.y1 - reb); }
    if (withBottom && withBottom.y0 != null) { strips.push({ edge: 'bottom', x0: o.x0, x1: o.x1, y0: withBottom.y0, y1: withBottom.y1 }); yb = withBottom.y0; }
    strips.push({ edge: 'left', x0: o.x0, x1: R2(o.x0 + reb), y0: R2(o.y0 + reb), y1: yb });
    strips.push({ edge: 'right', x0: R2(o.x1 - reb), x1: o.x1, y0: R2(o.y0 + reb), y1: yb });
    return strips;
  };
  const out = [];
  if (geo.leaves?.length) {
    const x0 = Math.min(...geo.leaves.map((l) => l.x)) - gap;
    const x1 = Math.max(...geo.leaves.map((l) => l.x + l.w)) + gap;
    const o = { kind: 'door', x0: R2(x0), x1: R2(x1), y0: R2(geo.leaves[0].y - gap), y1: leafBottom, side: geo.inward ? 'int' : 'ext', depth: geo.leafDepth };
    o.stops = ring(o, bottomStop);
    out.push(o);
  }
  (geo.panelLeaves || []).forEach((pl) => {
    const o = { kind: 'panel', x0: R2(pl.x - gap), x1: R2(pl.x + pl.w + gap), y0: R2(pl.y - gap), y1: leafBottom, side: 'ext', depth: geo.sidePanelDepth || geo.leafDepth };
    o.stops = ring(o, bottomStop);
    out.push(o);
  });
  (geo.fanLeaves || []).forEach((fl) => {
    const o = { kind: 'fan', x0: R2(fl.x - gap), x1: R2(fl.x + fl.w + gap), y0: R2(fl.y - gap), y1: R2(fl.y + fl.h + gap), side: 'ext', depth: fl.members?.depth || geo.leafDepth };
    o.stops = ring(o, 'rail');
    out.push(o);
  });
  (geo.fanPanes || []).forEach((fp) => {
    out.push({ kind: 'pane', x0: R2(fp.x + inset), x1: R2(fp.x + fp.w - inset), y0: R2(fp.y + inset), y1: R2(fp.y + fp.h - inset), side: null, stops: [] });
  });
  return out;
}

// A leaf of doorGeo in the LeafBody shape (leaf-local mm from its top-left).
function leafSpec(l, { depth, top, bottom, unit, paneling, panelThick, meeting }) {
  const lx = (x) => R2(x - l.x), ly = (y) => R2(y - l.y);
  const sL = { face: l.stileL, cutExt: 0, cutInt: 0 };
  const sR = { face: l.stileR, cutExt: 0, cutInt: 0 };
  if (meeting && l.meetingSide) {
    // the meeting stile: the half on the lap face runs to the leaf edge on the
    // lapping (active) leaf and is cut back by the overlap on the other leaf;
    // the other half the opposite way round
    const s = l.meetingSide === 'L' ? sL : sR;
    const laps = l.role === meeting.leaf;
    const lapHalf = meeting.face === 'interior' ? 'cutInt' : 'cutExt';
    const otherHalf = lapHalf === 'cutExt' ? 'cutInt' : 'cutExt';
    s[laps ? otherHalf : lapHalf] = meeting.overlap;
  }
  const g = l.daylight;
  const gcx = g ? g.x + g.w / 2 : 0, gcy = g ? g.y + g.h / 2 : 0;
  return {
    W: l.w, H: l.h, D: depth, sL, sR, top, bottom,
    mid: l.midRail ? { y: ly(l.midRail.y), face: l.midRail.face } : null,
    glass: g ? { x: lx(g.x), y: ly(g.y), w: g.w, h: g.h } : null,
    unit,
    barXs: (l.bars?.v || []).map((cx) => R2(cx - gcx)),
    barYs: (l.bars?.h || []).map((cy) => R2(gcy - cy)),
    panel: l.panel?.daylight ? { x: lx(l.panel.daylight.x), y: ly(l.panel.daylight.y), w: l.panel.daylight.w, h: l.panel.daylight.h } : null,
    panelThick, paneling,
  };
}

const positive = (r) => r && Number(r.w) > 0 && Number(r.h) > 0;

export default function DoorAssembly({
  geo,
  extMaterial,
  intMaterial,
  opening = 0,
  spacerColor = 'silver',
  glassFinish = 'clear',
  sealColour = 'black',
  ironmongery = 'brass',
}) {
  const g = geo;
  const m = g.members || {};
  const fd = g.frameDepth;
  const transomH = g.transomH || 0;
  const cx = g.doorX + g.doorW / 2;
  const cy = transomH + g.doorH / 2;
  const X = (x) => mm(x - cx);
  const Y = (y) => mm(cy - y);
  const metal = FINISH[ironmongery] || FINISH.brass;

  const gasketMat = useMemo(() => new THREE.MeshStandardMaterial({ color: sealColour === 'white' ? '#E8E8E8' : '#1a1a1a', roughness: 0.9 }), [sealColour]);
  const hingeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: metal, metalness: 0.7, roughness: 0.3 }), [metal]);
  const aluMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a8aaac', roughness: 0.3, metalness: 0.7 }), []);

  const openings = useMemo(() => doorOpenings(g), [g]);
  const land = useMemo(() => frameLandRects(g.totalWidth, g.totalHeight, openings), [g, openings]);

  // Depth: the leaf sits on the seal on the rebate stop, flush with the face
  // it opens to; the stop takes the rest of the frame depth.
  const stopDepth = (depth) => fd - (depth + GASKET_T);
  const doorStop = stopDepth(g.leafDepth);
  const zSplit = g.inward ? fd / 2 - doorStop : -fd / 2 + doorStop;   // the colour split of the land: the door's stop face
  const leafZ = (side, depth) => (side === 'int' ? -(fd / 2 - depth / 2) : fd / 2 - depth / 2);

  // a box from an assembly rect + a z range (mm); a render helper, not a
  // component, so a re-render (the opening slider) does not remount the frame
  const boxMesh = ({ r, z0, z1, mat, name, k }) => (
    <mesh key={k} name={name} castShadow receiveShadow material={mat}
      position={[X((r.x0 + r.x1) / 2), Y((r.y0 + r.y1) / 2), mm((z0 + z1) / 2)]}>
      <boxGeometry args={[mm(r.x1 - r.x0), mm(r.y1 - r.y0), mm(z1 - z0)]} />
    </mesh>
  );

  // ─── Leaves ───
  const lockType = g.lockType || 'single';
  const meeting = g.isFrench && g.meetingLap ? { ...g.meetingLap, overlap: g.overlap } : null;
  const clamped = Math.max(0, Math.min(1, opening));
  const dir = g.inward ? -1 : 1;
  // French: the active leaf opens first; the passive one follows past half travel (DoorWindow.jsx rule).
  const leafOpening = (role) => {
    if (!g.isFrench) return clamped;
    const PHASE1 = 0.5, T45 = 45 / 70;
    if (role === 'active') return clamped <= PHASE1 ? (clamped / PHASE1) * T45 : T45 + ((clamped - PHASE1) / (1 - PHASE1)) * (1 - T45);
    return clamped <= PHASE1 ? 0 : (clamped - PHASE1) / (1 - PHASE1);
  };
  const panelThick = g.panels?.[0]?.thickness;
  const unit = g.glassThickness;

  return (
    <group name="door-assembly">
      {/* ═══ Frame: the land band (full depth), EXT and INT halves for the colours ═══ */}
      {land.map((r, i) => (
        <group key={`land-${i}`}>
          {boxMesh({ name: 'frame-land-ext', r, z0: zSplit, z1: fd / 2, mat: extMaterial })}
          {boxMesh({ name: 'frame-land-int', r, z0: -fd / 2, z1: zSplit, mat: intMaterial })}
        </group>
      ))}

      {/* ═══ Rebate stops and seals inside every leaf opening ═══ */}
      {openings.filter((o) => o.stops.length).map((o, oi) => {
        const sd = stopDepth(o.depth);
        const ext = o.side === 'int';           // inward door: the stop is on the exterior
        const z0 = ext ? fd / 2 - sd : -fd / 2;
        const z1 = ext ? fd / 2 : -fd / 2 + sd;
        const gz0 = ext ? z0 - GASKET_T : z1;
        const gz1 = ext ? z0 : z1 + GASKET_T;
        return (
          <group key={`stops-${oi}`} name={`stops-${o.kind}`}>
            {o.stops.map((s, si) => boxMesh({ k: `s${si}`, name: `frame-stop-${s.edge}`, r: s, z0, z1, mat: ext ? extMaterial : intMaterial }))}
            {o.stops.filter((s) => s.edge !== 'bottom' || o.kind === 'fan').map((s, si) => {
              const r = s.edge === 'top' ? { ...s, y1: R2(s.y0 + GASKET_W) }
                : s.edge === 'bottom' ? { ...s, y0: R2(s.y1 - GASKET_W) }
                : s.edge === 'left' ? { ...s, x1: R2(s.x0 + GASKET_W) } : { ...s, x0: R2(s.x1 - GASKET_W) };
              return boxMesh({ k: `g${si}`, name: 'frame-seal', r, z0: gz0, z1: gz1, mat: gasketMat });
            })}
          </group>
        );
      })}

      {/* ═══ Cill / threshold ═══ */}
      {g.hasTimberCill && !g.inward && g.thresholdExtension > 0 && boxMesh({
        name: 'cill-extension', r: { x0: 0, x1: g.totalWidth, y0: R2(g.totalHeight - g.cill.visible), y1: g.totalHeight },
        z0: fd / 2, z1: fd / 2 + g.thresholdExtension, mat: extMaterial,
      })}
      {g.hasTimberCill && g.inward && (
        <InwardCill geo={g} X={X} Y={Y} extMaterial={extMaterial} intMaterial={intMaterial} />
      )}
      {/* the threshold PRODUCT strip only for the two threshold products the engine counts */}
      {!g.hasTimberCill && (g.threshold === 'aluminium' || g.threshold === 'low-profile') && openings.filter((o) => o.kind === 'door').map((o, i) => {
        const gapC = Number(g.cill?.gap) || 0;
        const low = g.threshold === 'low-profile';
        const r = { x0: o.x0, x1: o.x1, y0: R2(g.totalHeight - (low ? gapC / 2 : gapC)), y1: g.totalHeight };
        const zc = leafZ(o.side, g.leafDepth);
        return low
          ? boxMesh({ k: `thr${i}`, name: 'threshold-low-profile', r, z0: zc - g.leafDepth / 2, z1: zc + g.leafDepth / 2, mat: aluMat })
          : boxMesh({ k: `thr${i}`, name: 'threshold-aluminium', r, z0: -fd / 2, z1: fd / 2, mat: aluMat });
      })}

      {/* ═══ Door leaves ═══ */}
      {(g.leaves || []).filter(positive).map((l, i) => {
        const L = leafSpec(l, { depth: g.leafDepth, top: m.top, bottom: m.bottom, unit, paneling: g.paneling, panelThick, meeting });
        const W3 = mm(l.w), H3 = mm(l.h);
        const lockEdge = l.hinge === 'left' ? 'right' : 'left';
        const hasHandle = l.role === 'single' || l.role === 'active' || lockType === 'double';
        // the spindle (DoorHandleChrome origin) sits the backset in from the
        // leaf's lock edge, as the sheets place it (DoorElevation2D)
        const backset = (l.role === 'passive' ? g.handle?.slaveBackset : g.handle?.backset) || 0;
        const hx = lockEdge === 'right' ? W3 / 2 - mm(backset) : -W3 / 2 + mm(backset);
        const hy = mm(l.y + l.h / 2 - l.handleY) - SPINDLE_Y;
        const angle = THREE.MathUtils.degToRad(leafOpening(l.role) * MAX_ANGLE) * dir;
        return (
          <group key={`leaf-${i}`} name={`door-leaf-${l.role}`} position={[X(l.x + l.w / 2), Y(l.y + l.h / 2), mm(leafZ(g.inward ? 'int' : 'ext', g.leafDepth))]}>
            <Swing hinge={l.hinge} angle={angle} W={W3} H={H3}>
              <LeafBody L={L} mat={extMaterial} matInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish} />
              {hasHandle && (
                <group name="door-handle">
                  <DoorHandleChrome position={[hx, hy, mm(g.leafDepth) / 2]} side={lockEdge === 'right' ? 'left' : 'right'} color={metal} />
                  <DoorHandleChrome position={[hx, hy, -mm(g.leafDepth) / 2]} rotation={[0, Math.PI, 0]} side={lockEdge} color={metal} />
                </group>
              )}
            </Swing>
          </group>
        );
      })}

      {/* ═══ Hinges: the engine's centres on each leaf's hinge edge, on the face it opens to ═══ */}
      {(g.leaves || []).filter(positive).flatMap((l, i) => (l.hinges || []).map((hy, k) => (
        <mesh key={`hinge-${i}-${k}`} name="door-hinge" castShadow material={hingeMat}
          position={[X(l.hingeEdgeX), Y(hy), mm(g.inward ? -fd / 2 : fd / 2)]}>
          <cylinderGeometry args={[mm(HINGE_R), mm(HINGE_R), mm(g.hingeBarrel), 16]} />
        </mesh>
      )))}

      {/* ═══ Side panel leaves: fixed, members 57 all round ═══ */}
      {(g.panelLeaves || []).filter(positive).map((pl, i) => {
        const depth = g.sidePanelDepth || g.leafDepth;
        const L = leafSpec({ ...pl, stileL: pl.member, stileR: pl.member }, { depth, top: pl.member, bottom: pl.member, unit, paneling: 'flat', panelThick, meeting: null });
        return (
          <group key={`panel-${i}`} name={`side-panel-leaf-${pl.side}`} position={[X(pl.x + pl.w / 2), Y(pl.y + pl.h / 2), mm(leafZ('ext', depth))]}>
            <LeafBody L={L} mat={extMaterial} matInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish} />
          </group>
        );
      })}

      {/* ═══ Opening fanlight: a casement top hung leaf ═══ */}
      {(g.fanLeaves || []).filter(positive).map((fl, i) => {
        const mb = fl.members || {};
        const depth = mb.depth || g.leafDepth;
        const L = leafSpec({ ...fl, stileL: mb.stile, stileR: mb.stile }, { depth, top: mb.top, bottom: mb.bottom, unit, paneling: 'flat', panelThick, meeting: null });
        const W3 = mm(fl.w), H3 = mm(fl.h);
        const angle = THREE.MathUtils.degToRad(clamped * FAN_ANGLE);
        const reb = Number(m.rebate) || 0;
        const handleY = -H3 / 2 + mm(reb + (mb.bottom - reb) / 2);   // the bottom rail's visible centre (CasementPanel.jsx rule)
        return (
          <group key={`fan-${i}`} name={`fan-leaf-${fl.over}`} position={[X(fl.x + fl.w / 2), Y(fl.y + fl.h / 2), mm(leafZ('ext', depth))]}>
            <Swing hinge="top" angle={angle} W={W3} H={H3}>
              <LeafBody L={L} mat={extMaterial} matInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish} />
              <group position={[0, handleY, -mm(depth) / 2 - mm(1)]} rotation={[Math.PI / 2, 0, Math.PI / 2]} scale={[0.001, 0.001, 0.001]}>
                <WindowCasementHandle rotationDeg={clamped * FAN_ANGLE} metalColor={metal} />
              </group>
            </Swing>
          </group>
        );
      })}

      {/* ═══ Fixed fanlight: the sealed unit glazed into the frame ═══ */}
      {(g.fanPanes || []).filter(positive).map((fp, i) => {
        const inset = Number(m.inset) || 0;
        const day = { x: fp.x + inset, y: fp.y + inset, w: fp.w - 2 * inset, h: fp.h - 2 * inset };
        const gcx = day.x + day.w / 2, gcy = day.y + day.h / 2;
        return (
          <DoorGlazing key={`pane-${i}`} width={day.w} height={day.h} unitDepthMm={unit}
            barXs={(fp.bars?.v || []).map((v) => R2(v - gcx))} barYs={(fp.bars?.h || []).map((v) => R2(gcy - v))}
            barMaterial={extMaterial} barMaterialInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish}
            position={[X(gcx), Y(gcy), mm(leafZ('ext', g.leafDepth))]} />
        );
      })}
    </group>
  );
}

// The inward cill (unrebated): the internal face falls to the external face
// across the run (profile cillInward), full assembly width; the threshold
// extension continues it on the exterior.
function InwardCill({ geo, X, Y, extMaterial, intMaterial }) {
  const c = geo.cill || {};
  const fd = geo.frameDepth;
  const hi = Number(c.inwardInternal) || 0;
  const lo = Number(c.inwardExternal) || 0;
  const run = Math.min(Number(c.inwardRun) || fd, fd);
  const ext = Number(geo.thresholdExtension) || 0;
  const shapes = useMemo(() => {
    // profile in (z from the interior face, height): X = depth, Y = height
    const zMid = fd / 2;   // the colour split at mid depth
    const yAt = (z) => (z <= run ? hi + (lo - hi) * (z / run) : lo);
    const int = [[0, 0], [0, hi], ...(run < zMid ? [[run, lo]] : []), [zMid, yAt(zMid)], [zMid, 0]];
    const extPts = [[zMid, 0], [zMid, yAt(zMid)], ...(run > zMid ? [[run, lo]] : []), [fd + ext, lo], [fd + ext, 0]];
    return { int: toShape(int), ext: toShape(extPts) };
  }, [fd, hi, lo, run, ext]);
  const len = mm(geo.totalWidth);
  // shape X (depth from the interior face) runs to +z: rotation -PI/2 about Y maps
  // shape X to world +z and the extrusion to world -x, so start at the right end
  const pos = [X(geo.totalWidth), Y(geo.totalHeight), -mm(fd) / 2];
  return (
    <group name="cill-inward">
      <mesh castShadow receiveShadow rotation={[0, -Math.PI / 2, 0]} position={pos} material={intMaterial}>
        <extrudeGeometry args={[shapes.int, { depth: len, bevelEnabled: false }]} />
      </mesh>
      <mesh castShadow receiveShadow rotation={[0, -Math.PI / 2, 0]} position={pos} material={extMaterial}>
        <extrudeGeometry args={[shapes.ext, { depth: len, bevelEnabled: false }]} />
      </mesh>
    </group>
  );
}
