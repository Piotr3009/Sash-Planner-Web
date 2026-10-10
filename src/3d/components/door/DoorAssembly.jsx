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
 * Coordinates: doorGeo is in frame mm, origin at the frame top-left seen
 * from OUTSIDE, y DOWN. W x H is the OVERALL frame (doors v3). This group's
 * origin is doorGeo.origin, the frame centre (W / 2, H / 2):
 *     x3 = x - origin.x,   y3 = origin.y - y   (to m)
 * and +z is the exterior face. The guides (DoorWindow DoorGeoGuides), the
 * pack capture rig and the harness read the same field.
 *
 * What is drawn (owner box of 09.10.2026, doors v3: casement rules inside
 * the door frame):
 *   frame    the land (the part of the frame that is full depth) is the
 *            complement of the engine's visible openings (zones.openings: 47
 *            at a jamb and the head, 13 each side of a mullion axis, 8 above
 *            and 13 below the transom axis, down to the cill top or the floor
 *            line). The jambs and the casement MULLIONS (68 x 93, land 26)
 *            run through; the TRANSOM band (21) is cut in the engine's
 *            segments between them; the head and the cill run the full
 *            width. Inside every opening a rebate stop (the member face beyond
 *            the land: 21 at a jamb, the head and a mullion, 21 under and 26
 *            over the transom axis, 27 at the outward cill) with a seal strip,
 *            on the interior for outward leaves and on the exterior for an
 *            inward door; the outward cill is the casement cill (68, 41
 *            visible), the inward cill is unrebated (40 falling to 35), an
 *            aluminium / low-profile threshold is a strip under the door leaf
 *            (no timber cill; an inward door never has one).
 *   leaves   every leaf bottom stands 51 above the floor line (the engine's
 *            leaf heights), so a leaf over the timber cill clears its land by
 *            51 - 41 = 10. Door leaves: stiles 94, top 94, bottom 180, mid
 *            rail 94 and the panel per style, french meeting stiles 100 with
 *            the 6 lip each side: the ACTIVE leaf laps the passive one on the
 *            face it opens to (zones.meetingLap), so the two leaves overlap 12
 *            at the centre line; glass at the daylight, the sealed unit as
 *            thick as the glazing; the panel (54) at its outer size (daylight
 *            + 2 x 17) with the engine's edge profile (a 24 tongue in the
 *            rebate, a 15 flat, a 40 slope to the field). Side panels:
 *            casement fixed lights 64 / 64 / 180 (no hardware, no swing).
 *            Fanlight: one leaf per field, the opening one a casement top hung
 *            leaf (64 / 64 / 67, handle), the fixed one a non-opening leaf
 *            (fixedFan 64 / 64 / 67, no handle, no swing).
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
// 'panel' paneling: the PSW recessed moulding inside the panel field (DoorPanel.jsx:
// bevel 30 down 8, a 20 flat step, bevel 30 up to 3 below the field face)
const RECESS = { bevel1: 30, step: 20, bevel2: 30, depth: 8, drop: 3 };
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
 *   panel             OUTER rect (daylight + 2 x inset) with its inset and
 *                     edge profile; panelThick; paneling
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
        <PanelInfill rect={L.panel} inset={L.panel.inset} edge={L.panel.edge} thick={L.panelThick} paneling={L.paneling} pos={at(L.panel)}
          mat={panelMat} matInt={panelMatInt} />
      )}
    </group>
  );
}

/**
 * The face profile of the panel, one face (mm, from the panel's OUTER edge
 * inward): [inset from the outer edge, height of the face above the panel's
 * mid plane] pairs. Doors v3 (owner box item 8, profile panel.edge): the
 * edge is machined down to the tongue (24 thick, on the leaf mid plane like
 * the glass unit) that sits `inset` 17 deep in the glazing rebate; from the
 * daylight edge a flat (15, the bead sits on it) at the tongue face, then the
 * slope (40) up to the full thickness (54): the field. 'panel' paneling adds
 * the PSW recessed moulding inside the field (RECESS). Returns null when the
 * profile is missing or the panel is too small for it (the board is then
 * flat at its full thickness).
 */
export function panelFaceProfile(w, h, thick, inset, edge, paneling) {
  const T = Number(thick), tongue = Number(edge?.tongue), flat = Number(edge?.flat), slope = Number(edge?.slope), ins = Number(inset);
  if (!(T > 0 && tongue > 0 && tongue < T && flat >= 0 && slope > 0 && ins >= 0)) return null;
  const e1 = ins + flat;        // the end of the flat: the slope starts at the tongue face
  const e2 = e1 + slope;        // the field edge: full thickness
  if (!(w > 2 * e2 && h > 2 * e2)) return null;
  const steps = [[0, tongue / 2], [e1, tongue / 2], [e2, T / 2]];
  const r = RECESS;
  const inner = e2 + r.bevel1 + r.step + r.bevel2;
  // the raised centre at least a flat step wide each way, or the field stays plain
  if (paneling === 'panel' && w - 2 * inner >= 2 * r.step && h - 2 * inner >= 2 * r.step && T / 2 - r.depth > tongue / 2) {
    steps.push([e2 + r.bevel1, T / 2 - r.depth], [e2 + r.bevel1 + r.step, T / 2 - r.depth], [inner, T / 2 - r.drop]);
  }
  return steps;
}

// The half-glazed / three-quarter panel (two Tricoya boards and an MDF core,
// `thick` 54) at its OUTER size (the daylight + 2 x inset 17: its edge runs 17
// into the leaf's glazing rebate, inside the stiles and rails), with the edge
// profile above: a tongue slab across the whole panel, the slopes and steps
// as one surface per face, the centre field as a box. 'beading' adds a
// moulding round the field on both faces.
function PanelInfill({ rect, inset, edge, thick, paneling, pos, mat, matInt }) {
  const w = rect.w, h = rect.h;
  const T = Number(thick) > 0 ? thick : 0;
  const steps = useMemo(() => panelFaceProfile(w, h, T, inset, edge, paneling), [w, h, T, inset, edge?.tongue, edge?.flat, edge?.slope, paneling]);
  const surfaces = useMemo(() => {
    if (!steps) return null;
    const make = (sign) => {
      const pts = [];
      const idx = [];
      const quad = (A, B, C, Dp) => {
        const n = pts.length / 3;
        pts.push(...A, ...B, ...C, ...Dp);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      };
      for (let k = 1; k < steps.length - 1; k++) {
        const [d0, z0] = steps[k], [d1, z1] = steps[k + 1];
        const zo = sign * z0, zi = sign * z1;
        const o = { l: -w / 2 + d0, r: w / 2 - d0, b: -h / 2 + d0, t: h / 2 - d0 };
        const i = { l: -w / 2 + d1, r: w / 2 - d1, b: -h / 2 + d1, t: h / 2 - d1 };
        quad([o.l, o.t, zo], [o.r, o.t, zo], [i.r, i.t, zi], [i.l, i.t, zi]);
        quad([o.r, o.b, zo], [o.l, o.b, zo], [i.l, i.b, zi], [i.r, i.b, zi]);
        quad([o.l, o.b, zo], [o.l, o.t, zo], [i.l, i.t, zi], [i.l, i.b, zi]);
        quad([o.r, o.t, zo], [o.r, o.b, zo], [i.r, i.b, zi], [i.r, i.t, zi]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.map(mm)), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    return { ext: make(1), int: make(-1) };
  }, [steps, w, h]);
  if (!(T > 0)) return null;
  // the slab: the tongue thickness across the panel (the full thickness when flat)
  const slabHalf = steps ? steps[0][1] : T / 2;
  // the centre field: from the slab face to the last step
  const last = steps ? steps[steps.length - 1] : null;
  const field = last ? { w: w - 2 * last[0], h: h - 2 * last[0], z: last[1] } : null;
  const fieldEdge = steps ? steps[2][0] : 0;
  return (
    <group position={pos} name="door-panel">
      {/* the slab, split EXT / INT for the colours */}
      <mesh castShadow receiveShadow position={[0, 0, mm(slabHalf / 2)]} material={mat}>
        <boxGeometry args={[mm(w), mm(h), mm(slabHalf)]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0, -mm(slabHalf / 2)]} material={matInt}>
        <boxGeometry args={[mm(w), mm(h), mm(slabHalf)]} />
      </mesh>
      {field && field.z > slabHalf && [1, -1].map((sign) => (
        <mesh key={`field${sign}`} castShadow receiveShadow position={[0, 0, sign * mm((slabHalf + field.z) / 2)]} material={sign > 0 ? mat : matInt}>
          <boxGeometry args={[mm(field.w), mm(field.h), mm(field.z - slabHalf)]} />
        </mesh>
      ))}
      {surfaces && (
        <group>
          <mesh geometry={surfaces.ext} material={mat} castShadow receiveShadow />
          <mesh geometry={surfaces.int} material={matInt} castShadow receiveShadow />
        </group>
      )}
      {paneling === 'beading' && [1, -1].map((sign) => {
        // round the field (the daylight edge on a flat board), on its face
        const bw = w - 2 * fieldEdge, bh = h - 2 * fieldEdge;
        if (!(bw > 2 * BEAD.w && bh > 2 * BEAD.w)) return null;
        return (
          <group key={`bead${sign}`}>
            {[
              [0, bh / 2 - BEAD.w / 2, bw, BEAD.w],
              [0, -bh / 2 + BEAD.w / 2, bw, BEAD.w],
              [-bw / 2 + BEAD.w / 2, 0, BEAD.w, bh - 2 * BEAD.w],
              [bw / 2 - BEAD.w / 2, 0, BEAD.w, bh - 2 * BEAD.w],
            ].map(([x, y, rw, rh], i) => (
              <mesh key={i} castShadow receiveShadow position={[mm(x), mm(y), sign * mm(T / 2 + BEAD.h / 2)]} material={sign > 0 ? mat : matInt}>
                <boxGeometry args={[mm(rw), mm(rh), mm(BEAD.h)]} />
              </mesh>
            ))}
          </group>
        );
      })}
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
// down the rows). Rects in frame mm. `members` (optional, doors v3): the land
// of the members that run through (the jambs, the mullions) and of the
// transom segments, drawn as they are (each keeps its `member` name); the
// rest of the complement (the head, the cill) is merged around them.
export function frameLandRects(totalWidth, totalHeight, openings, members = []) {
  const uniq = (a) => [...new Set(a.map(R2))].sort((p, q) => p - q);
  const all = [...openings, ...members];
  const xs = uniq([0, totalWidth, ...all.flatMap((o) => [o.x0, o.x1])]).filter((v) => v >= 0 && v <= totalWidth);
  const ys = uniq([0, totalHeight, ...all.flatMap((o) => [o.y0, o.y1])]).filter((v) => v >= 0 && v <= totalHeight);
  const covered = (cx, cy) => all.some((o) => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1);
  const done = members.map((r) => ({ x0: R2(r.x0), x1: R2(r.x1), y0: R2(r.y0), y1: R2(r.y1), member: r.member || null }));
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

// The frame openings (frame mm, y down), one per field and tier, from the
// engine (doorGeo.openings = zones.openings: the casement lands, 47 at a jamb
// and the head, 13 at a mullion axis, 8 above and 13 below the transom axis,
// down to the cill top or the floor line). Each one is the HOLE through the
// full frame depth (the land's inner edge) with the rebate stop ring inside
// it: on each edge the member face beyond the land (jamb and head 68 - 47 =
// 21, mullion (68 - 26) / 2 = 21, transom 34 - 13 = 21 under it and 34 - 8 =
// 26 over it, the outward cill 68 - 41 = 27; none on the floor line nor on
// the unrebated inward cill). The engine draws an inward door field at the
// full member faces (its rebate faces the room): its hole is that opening
// grown by the stop on the jamb, mullion, head and transom edges, and the
// stop sits on the exterior. With the inward cill (its own mesh, InwardCill)
// the lower holes run to the floor line. A door without a timber cill gets
// the threshold product strip under its leaves (the leafAtFloor zone, 51:
// the full zone for aluminium, half of it for low-profile); the jamb stops
// stand on it.
export function doorOpenings(geo) {
  const m = geo.members || {};
  const W = geo.totalWidth, H = geo.totalHeight;
  const tr = geo.transom || null;
  const railHalf = tr ? (Number(tr.railH) || 0) / 2 : 0;
  const outwardCill = geo.hasTimberCill && !geo.inward;
  const inwardCill = geo.hasTimberCill && geo.inward;
  const pos = (v) => (Number.isFinite(v) && v > 0 ? R2(v) : 0);
  const stop = {
    jamb: pos(m.frameJamb - m.land),
    head: pos(m.frameHead - m.land),
    mullion: pos((m.mullion - m.mullionLand) / 2),
    underTransom: pos(railHalf - m.transomLandBelow),
    overTransom: pos(railHalf - m.transomLandAbove),
    cill: outwardCill ? pos(m.frameCill - geo.cill?.visible) : 0,
  };
  const effective = geo.thresholdInfo?.effectiveType || geo.threshold;
  const product = !geo.hasTimberCill && (effective === 'aluminium' || effective === 'low-profile') ? effective : null;
  const leafBottom = geo.leaves?.length ? Math.max(...geo.leaves.map((l) => l.y + l.h)) : H;
  const zone = R2(H - leafBottom);                 // the leafAtFloor zone under the door leaves (51)
  const frames = geo.frames || [];
  const fieldOf = (o) => frames.find((f) => f.kind === (o.kind === 'fan' ? o.over : o.kind) && (f.side || null) === (o.side || null)) || null;
  const depthOf = (o) => {
    if (o.kind === 'door') return geo.leafDepth;
    if (o.kind === 'panel') return (geo.panelLeaves || []).find((pl) => pl.side === o.side)?.members?.depth || geo.leafDepth;
    return (geo.fanLeaves || []).find((fl) => fl.over === o.over && (fl.side || null) === (o.side || null))?.members?.depth || geo.leafDepth;
  };
  const ring = (o, e, sideBottom) => {
    const strips = [];
    const yt = e.top > 0 ? R2(o.y0 + e.top) : o.y0;
    const yb = e.bottom > 0 ? R2(o.y1 - e.bottom) : sideBottom;
    if (e.top > 0) strips.push({ edge: 'top', x0: o.x0, x1: o.x1, y0: o.y0, y1: yt });
    if (e.bottom > 0) strips.push({ edge: 'bottom', x0: o.x0, x1: o.x1, y0: yb, y1: o.y1 });
    if (e.left > 0) strips.push({ edge: 'left', x0: o.x0, x1: R2(o.x0 + e.left), y0: yt, y1: yb });
    if (e.right > 0) strips.push({ edge: 'right', x0: R2(o.x1 - e.right), x1: o.x1, y0: yt, y1: yb });
    return strips;
  };
  return (geo.openings || []).map((op) => {
    const f = fieldOf(op);
    const fan = op.kind === 'fan';
    const e = {
      left: f && R2(f.x) > 0 ? stop.mullion : stop.jamb,
      right: f && R2(f.x + f.w) < R2(W) ? stop.mullion : stop.jamb,
      top: fan || !tr ? stop.head : stop.underTransom,
      bottom: fan ? stop.overTransom : stop.cill,
    };
    const inwardDoor = geo.inward && op.kind === 'door';
    const o = {
      kind: op.kind, over: op.over || null, side: op.side || null,
      x0: R2(op.x - (inwardDoor ? e.left : 0)),
      x1: R2(op.x + op.w + (inwardDoor ? e.right : 0)),
      y0: R2(op.y - (inwardDoor ? e.top : 0)),
      y1: !fan && inwardCill ? H : R2(op.y + op.h),
      face: inwardDoor ? 'int' : 'ext',
      depth: depthOf(op),
      edges: e,
    };
    o.threshold = op.kind === 'door' && product && zone > 0
      ? { type: product, x0: o.x0, x1: o.x1, y0: R2(H - (product === 'low-profile' ? zone / 2 : zone)), y1: H }
      : null;
    o.stops = ring(o, e, o.threshold ? o.threshold.y0 : o.y1);
    return o;
  });
}

// The land that runs through, from the holes and the engine: the jambs (from
// the frame edge to the first / last hole, over the holes' height), the
// mullions (doorGeo.mullions x1..x2, yTop..yBottom) and the transom segments
// (doorGeo.transom.segments x1..x2, bandTop..bandBottom).
export function doorFrameMembers(geo, holes) {
  const W = geo.totalWidth;
  const out = [];
  if (holes.length) {
    const y0 = Math.min(...holes.map((o) => o.y0)), y1 = Math.max(...holes.map((o) => o.y1));
    const xl = Math.min(...holes.map((o) => o.x0)), xr = Math.max(...holes.map((o) => o.x1));
    if (xl > 0) out.push({ member: 'jamb', x0: 0, x1: xl, y0, y1 });
    if (xr < W) out.push({ member: 'jamb', x0: xr, x1: W, y0, y1 });
  }
  (geo.mullions || []).forEach((mu) => out.push({ member: 'mullion', x0: mu.x1, x1: mu.x2, y0: mu.yTop, y1: mu.yBottom }));
  (geo.transom?.segments || []).forEach((s) => out.push({ member: 'transom', x0: s.x1, x1: s.x2, y0: s.bandTop, y1: s.bandBottom }));
  return out.filter((r) => r.x1 - r.x0 > 0 && r.y1 - r.y0 > 0);
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
    // the panel at its outer size (the engine's leaf.panel: daylight + 2 x inset)
    panel: l.panel && Number(l.panel.w) > 0 && Number(l.panel.h) > 0 ? {
      x: lx(l.panel.x), y: ly(l.panel.y), w: l.panel.w, h: l.panel.h,
      inset: l.panel.inset, edge: l.panel.edge || null,
    } : null,
    panelThick: l.panel?.thickness ?? panelThick, paneling,
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
  // the group origin: the frame centre (doorGeo.origin)
  const origin = g.origin || { x: g.totalWidth / 2, y: g.totalHeight / 2 };
  const X = (x) => mm(x - origin.x);
  const Y = (y) => mm(origin.y - y);
  const metal = FINISH[ironmongery] || FINISH.brass;

  const gasketMat = useMemo(() => new THREE.MeshStandardMaterial({ color: sealColour === 'white' ? '#E8E8E8' : '#1a1a1a', roughness: 0.9 }), [sealColour]);
  const hingeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: metal, metalness: 0.7, roughness: 0.3 }), [metal]);
  const aluMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a8aaac', roughness: 0.3, metalness: 0.7 }), []);

  const openings = useMemo(() => doorOpenings(g), [g]);
  const land = useMemo(() => frameLandRects(g.totalWidth, g.totalHeight, openings, doorFrameMembers(g, openings)), [g, openings]);

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
      {/* ═══ Frame: the land (full depth), EXT and INT halves for the colours;
             the jambs, mullions and transom segments carry their member name ═══ */}
      {land.map((r, i) => (
        <group key={`land-${i}`}>
          {boxMesh({ name: `frame-land-ext${r.member ? `-${r.member}` : ''}`, r, z0: zSplit, z1: fd / 2, mat: extMaterial })}
          {boxMesh({ name: `frame-land-int${r.member ? `-${r.member}` : ''}`, r, z0: -fd / 2, z1: zSplit, mat: intMaterial })}
        </group>
      ))}

      {/* ═══ Rebate stops and seals inside every frame opening ═══ */}
      {openings.filter((o) => o.stops.length).map((o, oi) => {
        const sd = stopDepth(o.depth);
        const ext = o.face === 'int';           // inward door: the stop is on the exterior
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
      {/* the threshold PRODUCT strip only for the two products the engine buys
          (thresholdInfo.effectiveType: an inward door is always on its timber cill) */}
      {openings.filter((o) => o.threshold).map((o, i) => {
        const r = o.threshold;
        const zc = leafZ(o.face, g.leafDepth);
        return r.type === 'low-profile'
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

      {/* ═══ Side panels: casement fixed lights behind the mullion, the engine's
             members (stiles 64, top rail 64, bottom rail 180, depth 57); no swing ═══ */}
      {(g.panelLeaves || []).filter(positive).map((pl, i) => {
        const mb = pl.members || {};
        const depth = mb.depth || g.leafDepth;
        const L = leafSpec({ ...pl, stileL: mb.stile, stileR: mb.stile }, { depth, top: mb.top, bottom: mb.bottom, unit, paneling: 'flat', panelThick, meeting: null });
        return (
          <group key={`panel-${i}`} name={`side-panel-leaf-${pl.side}`} position={[X(pl.x + pl.w / 2), Y(pl.y + pl.h / 2), mm(leafZ('ext', depth))]}>
            <LeafBody L={L} mat={extMaterial} matInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish} />
          </group>
        );
      })}

      {/* ═══ Fanlight: one leaf per field. Opening: a casement top hung leaf with
             its handle; fixed: a non-opening leaf (fixedFan), no handle, no swing ═══ */}
      {(g.fanLeaves || []).filter(positive).map((fl, i) => {
        const mb = fl.members || {};
        const depth = mb.depth || g.leafDepth;
        const L = leafSpec({ ...fl, stileL: mb.stile, stileR: mb.stile }, { depth, top: mb.top, bottom: mb.bottom, unit, paneling: 'flat', panelThick, meeting: null });
        const where = `${fl.over}${fl.side ? `-${fl.side}` : ''}`;
        const at = [X(fl.x + fl.w / 2), Y(fl.y + fl.h / 2), mm(leafZ('ext', depth))];
        if (fl.fixed) {
          return (
            <group key={`fan-${i}`} name={`fixed-fan-leaf-${where}`} position={at}>
              <LeafBody L={L} mat={extMaterial} matInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish} />
            </group>
          );
        }
        const W3 = mm(fl.w), H3 = mm(fl.h);
        const angle = THREE.MathUtils.degToRad(clamped * FAN_ANGLE);
        const reb = Number(m.rebate) || 0;
        const handleY = -H3 / 2 + mm(reb + (mb.bottom - reb) / 2);   // the bottom rail's visible centre (CasementPanel.jsx rule)
        return (
          <group key={`fan-${i}`} name={`fan-leaf-${where}`} position={at}>
            <Swing hinge="top" angle={angle} W={W3} H={H3}>
              <LeafBody L={L} mat={extMaterial} matInt={intMaterial} spacerColor={spacerColor} glassFinish={glassFinish} />
              <group name="fan-handle" position={[0, handleY, -mm(depth) / 2 - mm(1)]} rotation={[Math.PI / 2, 0, Math.PI / 2]} scale={[0.001, 0.001, 0.001]}>
                <WindowCasementHandle rotationDeg={clamped * FAN_ANGLE} metalColor={metal} />
              </group>
            </Swing>
          </group>
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
