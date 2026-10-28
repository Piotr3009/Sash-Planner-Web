/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * FireDoor.jsx
 * The internal door set 3D (fire doors v1, 27.10.2026): frame, leaf, vision
 * panel glass, hinges, lever handle on a rose, drawn from the engine
 * (derived.firedoor) through utils/windowSpecToConfig.js
 * fireDoorGeometryFromSpec. Look only: no dimensions, no profile import,
 * every size and position below comes from `geo`. The constants at the top
 * of this file are rendering details (knuckle radius, rose size, bead
 * width, ironmongery colours), not workshop numbers.
 *
 * Props: { geo, woodColor (hex), openAngle (degrees 0..90, default 30),
 *          ironmongery (finish key), glassFinish }
 *
 * Coordinates: geo is in frame mm, origin at the frame top-left seen from
 * the PULL side (the face the hinge knuckles show on, the 35 face, the side
 * the leaf opens toward), y DOWN. This group is centred on geo.origin, the
 * frame centre (W / 2, H / 2):
 *     x3 = x - origin.x,   y3 = origin.y - y   (to m)
 * and, inside the pull-side frame, +z is the pull side. v1.1 (27.10.2026
 * evening): an internal door has no swing, so the group is always turned by
 * PI about Y (the former 'in' orientation, now the only one): the pull face
 * with the knuckles looks to -z and the viewer's +z camera sees the push
 * face (the 50 frame face, the leaf in the opening, the handle); the leaf
 * opens away from the viewer. Hinge left / right is the engine's: seen from
 * the pull side. Only handing.hingeSide is read from geo.handing.
 *
 * What is drawn:
 *   frame   three members as L sections: the wall part (the 35 face, full
 *           depth) and the stop part (the 15 of the rebate width behind the
 *           47 rebate depth). v1.2 (owner 28.10.2026, "the top edge in the
 *           rebate has a gap"): the head's wall part runs between the jambs'
 *           wall parts (faceOut .. W - faceOut) and the jambs' stop parts
 *           start under it (y faceOut ..), so the rebate runs clean round both
 *           top corners with no notch; no two boxes overlap (the mitre is
 *           implied, look only)
 *   leaf    one extruded rectangle w x h x t with a hole per vision panel
 *           pane by its shape (v1.2: a rect with its corner radius, a circle,
 *           the diamond as a turned square), set in the rebate 3 behind the
 *           pull face plane, 3 off the cheeks, floorGap above the frame feet;
 *           a glass pane (a disc in a round hole) and glazing beads (a ring
 *           round a round pane) in every hole; the glass clear, or white and
 *           rough when the engine's vision panel glass is Frosted
 *   strips  (v1.2) the intumescent strips in the leaf's top edge and both
 *           long edges, one per engine centre across the thickness, the
 *           strip's width wide, flush with the edge (a hair proud, no
 *           z-fighting), in the engine's strip colour; they open with the leaf
 *   closer  (v1.2, the engine's symbol, never machined) surface: the body on
 *           the leaf's pull or push face (it opens with the leaf), the shoe on
 *           the frame head face, and the arm as two links from the body's
 *           spindle to the shoe solved for the current open angle (each link
 *           ARM_LINK of the engine's arm length, the elbow out on the face
 *           side; on the pull face a vertical spindle post rises from the body
 *           top so the arm swings level at the shoe's height, above the leaf
 *           top, clear of the open leaf at any angle; on the push face (the
 *           leaf opens away from it) the arm leaves the body front; look only,
 *           not a closer's real arm geometry); built in: a dark
 *           slot on the leaf top edge (it opens with the leaf) and a dark
 *           track in the head soffit, seen when the leaf is open
 *   hinges  three knuckles at the engine's hinge positions, the leaf swings
 *           about the knuckle axis by openAngle toward the pull side
 *   handle  a lever on a rose at the spindle on both faces, pointing toward
 *           the hinge; a euro cylinder escutcheon or a bathroom thumbturn
 *           below it when the lock has one
 *   lock    the forend plate on the lock edge as a slot with full radius
 *           ends (v1.2, the engine's radius)
 *   keep    the keep plate on the lock jamb's rebate cheek at the engine's
 *           keep centre, a slot with full radius ends (v1.2)
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Rendering details (not workshop numbers)
const KNUCKLE_R = 6.5;      // hinge knuckle radius
const ROSE_R = 26;          // lever rose radius
const ROSE_T = 8;           // rose thickness proud of the face
const NECK_R = 9;           // lever neck radius
const NECK_L = 28;          // neck length from the rose face
const LEVER = { l: 125, w: 14, h: 12 };   // lever bar length, width across the face, height
const ESCUTCHEON_R = 15;    // euro cylinder escutcheon radius
const ESCUTCHEON_T = 3;
const CYLINDER_R = 8.5;     // euro cylinder stub radius
const CYLINDER_PROUD = 3;
const THUMBTURN = { r: 14, t: 3, barL: 22, barW: 6, barH: 5 };
const BEAD = { w: 15, proud: 4 };   // glazing bead ring around a pane
const PLATE_T = 1.5;        // forend and keep plates proud of their face
const STRIP_PROUD = 0.4;    // the intumescent strip a hair proud of the leaf edge (no z-fighting)
const SLOT_T = 1;           // the built in closer's slot plate and head track plate
const SLOT_PROUD = 0.8;     // ... proud of their face (over the strip)
const SHOE_D = 18;          // the surface closer shoe proud of the head face
const ARM_T = 8;            // the closer arm bar thickness
const ARM_LINK = 0.6;       // each of the two arm links, a share of the engine's arm length
const PIVOT_R = 9;          // the closer's spindle post from the body top to the arm
const CLOSER_BODY = '#a7abb0';   // a silver closer body
const CLOSER_DARK = '#26282b';   // the built in closer's slot and track
const FINISH = {
  brass: '#d4af37', chrome: '#e8eaec', stainless: '#c8c8c8',
  antique_brass: '#9c7722', black: '#1a1a1a', white: '#f0f0f0',
};
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

// Rotate the leaf about the knuckle axis (px, pz in the leaf group, metres).
function Swing({ px, pz, angle, children }) {
  if (!angle) return <group>{children}</group>;
  return (
    <group position={[px, 0, pz]}>
      <group rotation={[0, angle, 0]}>
        <group position={[-px, 0, -pz]}>{children}</group>
      </group>
    </group>
  );
}

// A lever handle on a rose at the group origin: the rose on the face plane,
// the neck and the lever proud of it along `out` (+1 / -1 in z), the lever
// pointing along `dir` (+1 / -1 in x).
function LeverOnRose({ out, dir, mat }) {
  const z = (v) => out * mm(v);
  return (
    <group name="fd-handle">
      <mesh castShadow receiveShadow material={mat} position={[0, 0, z(ROSE_T / 2)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[mm(ROSE_R), mm(ROSE_R), mm(ROSE_T), 32]} />
      </mesh>
      <mesh castShadow receiveShadow material={mat} position={[0, 0, z(ROSE_T + NECK_L / 2)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[mm(NECK_R), mm(NECK_R), mm(NECK_L), 24]} />
      </mesh>
      <mesh castShadow receiveShadow material={mat} position={[dir * mm(LEVER.l / 2 - NECK_R), 0, z(ROSE_T + NECK_L - LEVER.w / 2)]}>
        <boxGeometry args={[mm(LEVER.l), mm(LEVER.h), mm(LEVER.w)]} />
      </mesh>
    </group>
  );
}

// A bar (box) from point a to point b (metres, the parent's frame), w x t across.
function Bar({ a, b, w, t, mat, name }) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0)) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(X_AXIS, new THREE.Vector3(dx / len, dy / len, dz / len));
  return (
    <mesh name={name} castShadow material={mat} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q}>
      <boxGeometry args={[len, w, t]} />
    </mesh>
  );
}

// The elbow of the closer's two link arm (frame metres): |E - A| = l1 (the
// main arm from the spindle A), |E - B| = l2 (the forearm to the shoe B), E at
// the shoe's height so the forearm runs level with the shoe, above the leaf
// top, clear of an open leaf; of the two solutions the one further out along
// `out` (the closer face's outward normal after the swing). Out of reach: the
// elbow on the way from A to B (the forearm stretched).
function armElbow(A, B, l1, l2, out) {
  const dy = B.y - A.y;
  const rA = l1 > Math.abs(dy) ? Math.sqrt(l1 * l1 - dy * dy) : 0;
  const dx = B.x - A.x, dz = B.z - A.z;
  const D = Math.hypot(dx, dz);
  if (!(D > 0)) return new THREE.Vector3(A.x + out.x * rA, B.y, A.z + out.z * rA);
  if (D >= rA + l2 || D <= Math.abs(rA - l2)) return new THREE.Vector3(A.x + (dx * rA) / D, B.y, A.z + (dz * rA) / D);
  const a = (rA * rA - l2 * l2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, rA * rA - a * a));
  const px = A.x + (dx * a) / D, pz = A.z + (dz * a) / D;
  const e1 = new THREE.Vector3(px - (dz * h) / D, B.y, pz + (dx * h) / D);
  const e2 = new THREE.Vector3(px + (dz * h) / D, B.y, pz - (dx * h) / D);
  return e1.clone().sub(A).dot(out) >= e2.clone().sub(A).dot(out) ? e1 : e2;
}

// The elbow of two equal links of length l between A and B in 3D: on the side
// of `out` (perpendicular to AB); out of reach: the midpoint (the arm straight).
function armElbow3d(A, B, l, out) {
  const AB = B.clone().sub(A);
  const dist = AB.length();
  const mid = A.clone().add(B).multiplyScalar(0.5);
  if (!(dist > 0) || dist >= 2 * l) return mid;
  const u = AB.clone().normalize();
  const n = out.clone().sub(u.clone().multiplyScalar(out.dot(u)));
  if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
  return mid.add(n.normalize().multiplyScalar(Math.sqrt(l * l - (dist / 2) ** 2)));
}

// A rounded rectangle (r > 0) or a plain one on a path, centred at (cx, cy).
function rectPath(path, cx, cy, w, h, r) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  if (!(rr > 0)) {
    path.moveTo(x0, y0); path.lineTo(x1, y0); path.lineTo(x1, y1); path.lineTo(x0, y1);
    path.closePath();
    return path;
  }
  path.moveTo(x0 + rr, y0);
  path.lineTo(x1 - rr, y0);
  path.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - rr);
  path.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x0 + rr, y1);
  path.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + rr);
  path.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  path.closePath();
  return path;
}

// A slot plate (full radius ends: a rounded rectangle with r = half its width)
// lying in the y-z plane, `len` along y and `wid` along z, `t` thick from x = 0
// toward `out` (+1 / -1 in x). Metres.
function slotGeometry(len, wid, r, t, out) {
  const shape = rectPath(new THREE.Shape(), 0, 0, wid, len, r);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 16 });
  g.rotateY(out >= 0 ? Math.PI / 2 : -Math.PI / 2);   // the extrusion (+z) turns to +x / -x, the shape's x to z
  g.computeVertexNormals();
  return g;
}

// The leaf body: one extruded rectangle with a hole per pane by its shape
// (metres, leaf centred on the origin, x right, y up, z through the thickness).
function leafGeometry(W3, H3, T3, panes) {
  const shape = new THREE.Shape();
  shape.moveTo(-W3 / 2, -H3 / 2);
  shape.lineTo(W3 / 2, -H3 / 2);
  shape.lineTo(W3 / 2, H3 / 2);
  shape.lineTo(-W3 / 2, H3 / 2);
  shape.closePath();
  for (const p of panes) {
    const hole = new THREE.Path();
    if (p.shape === 'round') {
      hole.absarc(p.cx, p.cy, p.r, 0, Math.PI * 2, true);
    } else if (p.shape === 'diamond') {
      // the w x w square turned 45 degrees about its centre: the tips on the axes
      const d = p.w * Math.SQRT1_2;
      hole.moveTo(p.cx, p.cy - d);
      hole.lineTo(p.cx + d, p.cy);
      hole.lineTo(p.cx, p.cy + d);
      hole.lineTo(p.cx - d, p.cy);
      hole.closePath();
    } else {
      rectPath(hole, p.cx, p.cy, p.w, p.h, p.r);
    }
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: T3, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -T3 / 2);
  g.computeVertexNormals();
  return g;
}

// A flat ring (the glazing bead round a round pane), r0 inside, r1 outside, t thick from z = 0 to +t.
function ringGeometry(r0, r1, t) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, r0, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 48 });
  g.computeVertexNormals();
  return g;
}

export default function FireDoor({
  geo = null,
  woodColor = '#F6F6F6',
  openAngle = 30,
  ironmongery = 'brass',
  glassFinish = 'clear',
  // accepted for the shared prop contract; a vision panel is one pane, so
  // the sealed unit type does not change the look
  glassType = 'single',   // eslint-disable-line no-unused-vars
}) {
  const g = geo;
  const valid = !!(g && g.leaf && g.frame && g.frame.overall && Number(g.totalWidth) > 0 && Number(g.totalHeight) > 0);
  const metal = FINISH[ironmongery] || FINISH.brass;

  const woodMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: woodColor || '#F6F6F6', roughness: 0.72, metalness: 0.02,
    clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [woodColor]);
  const metalMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: metal, metalness: 1, roughness: 0.18, clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 1.2,
  }), [metal]);
  const hingeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: metal, metalness: 0.7, roughness: 0.3 }), [metal]);
  const closerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: CLOSER_BODY, metalness: 0.6, roughness: 0.35 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: CLOSER_DARK, metalness: 0.2, roughness: 0.7 }), []);
  // v1.2: the strip colour of the engine (intumescent.colour.hex)
  const intuHex = g?.intumescent?.colour?.hex || null;
  const intuMat = useMemo(() => (intuHex ? new THREE.MeshStandardMaterial({ color: intuHex, roughness: 0.9, metalness: 0 }) : null), [intuHex]);
  // the glass: clear, or (v1.2) white, translucent and rough when the engine's
  // vision panel glass is Frosted; a geo without a glass type keeps the
  // window's glazing finish
  const glassT = Number(g?.vp?.glassThickness) > 0 ? Number(g.vp.glassThickness) : 6;
  const vpGlassType = g?.vp?.glass?.type || null;
  const frosted = vpGlassType ? vpGlassType === 'frosted' : glassFinish !== 'clear';
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial(frosted ? {
    color: '#f4f6f7', roughness: 0.85, metalness: 0,
    transmission: 0.25, transparent: true, opacity: 0.9,
    ior: 1.52, thickness: mm(glassT), side: THREE.DoubleSide,
  } : {
    color: '#d4e8f0', metalness: 0.05, roughness: 0.05,
    transmission: 0.92, transparent: true, opacity: 0.35,
    ior: 1.5, thickness: mm(glassT), side: THREE.DoubleSide,
  }), [frosted, glassT]);

  // ─── the numbers (frame mm, pull-side frame) ───
  const W = valid ? Number(g.totalWidth) : 0;
  const H = valid ? Number(g.totalHeight) : 0;
  const origin = g?.origin || { x: W / 2, y: H / 2 };
  const X = (x) => mm(x - origin.x);
  const Y = (y) => mm(origin.y - y);
  const fr = g?.frame || {};
  const d = Number(fr.depth) || 0;
  const thk = Number(fr.thickness) || 0;
  const faceOut = Number(fr.faces?.outside) || 0;
  const rebD = Number(fr.rebate?.d) || 0;   // geo.frame.rebate = { w, d } (fireDoorGeometryFromSpec)
  const gapSide = Number(fr.gaps?.side) || 0;
  const leaf = g?.leaf || {};
  const lw = Number(leaf.w) || 0, lh = Number(leaf.h) || 0, lt = Number(leaf.t) || 0;
  const leafX = Number(leaf.x) || 0, leafY = Number(leaf.y) || 0;
  const hinge = g?.handing?.hingeSide === 'right' ? 'right' : 'left';
  // the leaf closes against the stop (rebate depth behind the pull face),
  // its pull face is the rebate clearance behind the pull face plane
  const leafPullZ = d / 2 - (rebD - lt);
  const leafCz = leafPullZ - lt / 2;
  const W3 = mm(lw), H3 = mm(lh), T3 = mm(lt);

  // the panes in the leaf's own frame (metres, centred, y up): the engine
  // gives x from the leaf TOP and y from the HINGE edge to the corner of the
  // pane's bounding box (`box`; the diamond's is the turned square's); a
  // pane the engine turned to fit (angle 90) already carries its axis-aligned
  // w x h. v1.2: shape 'rect' (r = the corner radius) / 'round' (r = half
  // the diameter) / 'diamond' (the w x w square turned 45)
  const panes = useMemo(() => (valid ? (g.vp?.panes || []) : []).map((p, i) => {
    const w = Number(p.w) || 0, h = Number(p.h) || 0;
    const bw = Number(p.box?.w) || w, bh = Number(p.box?.h) || h;
    const top = Number(p.x) || 0, fromHinge = Number(p.y) || 0;
    const left = hinge === 'left' ? fromHinge : lw - fromHinge - bw;
    const shape = p.shape === 'round' || p.shape === 'diamond' ? p.shape : (p.shape === 'rect' ? 'rect' : (Number(p.angle) === 45 ? 'diamond' : 'rect'));
    return {
      i, shape, w: mm(w), h: mm(h), rotated: shape === 'diamond',
      r: shape === 'round' ? mm(Number(p.radius) > 0 ? Number(p.radius) : w / 2) : mm(Number(p.radius) || 0),
      cx: -W3 / 2 + mm(left + bw / 2),
      cy: H3 / 2 - mm(top + bh / 2),
    };
  }), [valid, g, hinge, lw, W3, H3]);

  const leafGeo = useMemo(() => (valid && lw > 0 && lh > 0 && lt > 0 ? leafGeometry(W3, H3, T3, panes) : null), [valid, lw, lh, lt, W3, H3, T3, panes]);
  // the round beads (one ring per face per round pane)
  const ringGeos = useMemo(() => panes.map((p) => (p.shape === 'round' ? ringGeometry(p.r, p.r + mm(BEAD.w), mm(BEAD.proud)) : null)), [panes]);

  // v1.2: the forend and keep plates as slots with full radius ends (the engine's radius)
  const fo = g?.lock?.forend || null;
  const lockEdgeRight = hinge === 'left';
  const forendGeo = useMemo(() => {
    const len = Number(fo?.length) || 0, wid = Number(fo?.width) || 0;
    if (!(len > 0 && wid > 0)) return null;
    const r = Number(fo?.radius) > 0 ? Number(fo.radius) : wid / 2;
    return slotGeometry(mm(len), mm(wid), mm(r), mm(PLATE_T), lockEdgeRight ? 1 : -1);
  }, [fo, lockEdgeRight]);
  const keep = g?.keep || null;
  const keepGeo = useMemo(() => {
    const len = Number(keep?.plate?.length) || 0, wid = Number(keep?.plate?.width) || 0;
    if (!(len > 0 && wid > 0)) return null;
    const r = Number(keep?.plate?.radius) > 0 ? Number(keep.plate.radius) : wid / 2;
    // the plate stands on the lock jamb's cheek toward the opening: -x for a lock jamb on the right
    return slotGeometry(mm(len), mm(wid), mm(r), mm(PLATE_T), lockEdgeRight ? -1 : 1);
  }, [keep, lockEdgeRight]);

  if (!valid || !leafGeo) return null;

  // a box from a frame rect (mm, pull-side frame) + a z range (mm)
  const boxMesh = ({ k, name, x0, x1, y0, y1, z0, z1, mat }) => (
    <mesh key={k} name={name} castShadow receiveShadow material={mat}
      position={[X((x0 + x1) / 2), Y((y0 + y1) / 2), mm((z0 + z1) / 2)]}>
      <boxGeometry args={[mm(x1 - x0), mm(y1 - y0), mm(z1 - z0)]} />
    </mesh>
  );

  // ─── frame: the L sections ───
  // v1.2: the head's wall part runs faceOut .. W - faceOut (over the top of
  // the jambs' stop parts) and the stop parts start at y = faceOut, so the
  // rebate turns the top corners with no notch and no box overlaps another
  const hingeJambLeft = hinge === 'left';
  const jambName = (side) => (side === 'left') === hingeJambLeft ? 'jamb-hinge' : 'jamb-lock';
  const frameMeshes = [
    // left jamb: wall part (the 35 face, full depth) and stop part (behind the rebate, under the head)
    boxMesh({ k: 'jl-face', name: `frame-${jambName('left')}-face`, x0: 0, x1: faceOut, y0: 0, y1: H, z0: -d / 2, z1: d / 2, mat: woodMat }),
    boxMesh({ k: 'jl-stop', name: `frame-${jambName('left')}-stop`, x0: faceOut, x1: thk, y0: faceOut, y1: H, z0: -d / 2, z1: d / 2 - rebD, mat: woodMat }),
    // right jamb
    boxMesh({ k: 'jr-face', name: `frame-${jambName('right')}-face`, x0: W - faceOut, x1: W, y0: 0, y1: H, z0: -d / 2, z1: d / 2, mat: woodMat }),
    boxMesh({ k: 'jr-stop', name: `frame-${jambName('right')}-stop`, x0: W - thk, x1: W - faceOut, y0: faceOut, y1: H, z0: -d / 2, z1: d / 2 - rebD, mat: woodMat }),
    // head: the wall part between the jambs' wall parts, the stop part between the jambs' stop parts
    boxMesh({ k: 'hd-face', name: 'frame-head-face', x0: faceOut, x1: W - faceOut, y0: 0, y1: faceOut, z0: -d / 2, z1: d / 2, mat: woodMat }),
    boxMesh({ k: 'hd-stop', name: 'frame-head-stop', x0: thk, x1: W - thk, y0: faceOut, y1: thk, z0: -d / 2, z1: d / 2 - rebD, mat: woodMat }),
  ];

  // ─── leaf: position, swing ───
  const leafCx = X(leafX + lw / 2), leafCy = Y(leafY + lh / 2);
  const hingeEdgeX = hingeJambLeft ? leafX : leafX + lw;
  const knuckleX = hingeJambLeft ? hingeEdgeX - gapSide / 2 : hingeEdgeX + gapSide / 2;
  // the knuckle axis in the leaf group (metres)
  const px = hingeJambLeft ? -W3 / 2 - mm(gapSide / 2) : W3 / 2 + mm(gapSide / 2);
  const pz = T3 / 2;
  const deg = Math.max(0, Math.min(90, Number(openAngle) || 0));
  // open toward the pull side (+z of the pull-side frame): the free edge of a
  // left hung leaf (+x) moves to +z under a negative rotation about Y
  const angle = THREE.MathUtils.degToRad(deg) * (hingeJambLeft ? -1 : 1);
  // a point of the leaf group (metres) after the swing, in the frame group
  const leafToFrame = (p) => {
    const v = new THREE.Vector3(p[0] - px, p[1], p[2] - pz).applyAxisAngle(Y_AXIS, angle);
    return [v.x + px + leafCx, v.y + leafCy, v.z + pz + mm(leafCz)];
  };
  // the leaf board system (x from the leaf top, y from the hinge edge) in the leaf group
  const lx = (y) => (hingeJambLeft ? -W3 / 2 + mm(y) : W3 / 2 - mm(y));
  const ly = (x) => H3 / 2 - mm(x);

  // ─── handle at the spindle ───
  const sp = g.lock?.spindle || {};
  const backset = Number(sp.fromLockEdge) || 0;
  const hx = lockEdgeRight ? W3 / 2 - mm(backset) : -W3 / 2 + mm(backset);
  const hy = -H3 / 2 + mm(Number(sp.fromBottom) || 0);
  const leverDir = lockEdgeRight ? -1 : 1;   // the lever points toward the hinge
  const cyl = g.lock?.cylinder || null;
  const cy = cyl ? -H3 / 2 + mm(Number(cyl.fromBottom) || 0) : 0;

  // ─── keep plate on the lock jamb cheek ───
  const keepCheekX = hingeJambLeft ? W - faceOut : faceOut;
  const keepCy = keep ? H - (Number(keep.centreFromFoot) || 0) : 0;

  const hinges = (g.hinges?.positions || []).map((p) => ({
    top: Number(p.top) || 0,
    centre: Number.isFinite(Number(p.centre)) ? Number(p.centre) : (Number(p.top) || 0) + (Number(g.hinges?.length) || 0) / 2,
  }));
  const hingeLen = Number(g.hinges?.length) || 0;

  // ─── v1.2: the intumescent strips (leaf group, metres): top edge and both long edges ───
  const intu = g.intumescent || null;
  const stripW = mm(Number(intu?.width) || 0), stripT = mm(Number(intu?.thickness) || 0), proud = mm(STRIP_PROUD);
  const strips = intu && intuMat && stripW > 0 && stripT > 0 ? (intu.centresZ || []).flatMap((cz, k) => {
    const zc = T3 / 2 - mm(Number(cz) || 0);
    const edgeH = H3 - stripT;   // the edge strips stop under the top strip
    return [
      { key: `t${k}`, pos: [0, H3 / 2 - stripT / 2 + proud / 2, zc], size: [W3, stripT + proud, stripW] },
      { key: `l${k}`, pos: [-(W3 / 2 - stripT / 2 + proud / 2), -stripT / 2, zc], size: [stripT + proud, edgeH, stripW] },
      { key: `r${k}`, pos: [W3 / 2 - stripT / 2 + proud / 2, -stripT / 2, zc], size: [stripT + proud, edgeH, stripW] },
    ];
  }) : [];

  // ─── v1.2: the closer symbol ───
  const csym = g.closer?.symbol || null;
  let closerLeaf = null, closerFrame = null;
  if (csym?.kind === 'surface' && csym.body) {
    const b = csym.body, a = csym.arm || {}, s = csym.shoe || {};
    const fs = csym.face === 'push' ? -1 : 1;           // +z = the pull face
    const faceZ = fs * T3 / 2;
    const bDepth = mm(Number(b.depth) || 0);
    const bodyLeaf = {
      pos: [lx((Number(b.y) || 0) + (Number(b.length) || 0) / 2), ly((Number(b.x) || 0) + (Number(b.height) || 0) / 2), faceZ + fs * bDepth / 2],
      size: [mm(Number(b.length) || 0), mm(Number(b.height) || 0), bDepth],
    };
    // pull face (the leaf opens toward it): the overhead closer's vertical spindle
    // at the engine's spindle point (arm.from, seen in elevation), mid depth of
    // the body, rising from the body top to the arm plane at the shoe's height
    // above the leaf top (shoe.x < 0), so the arm swings level over the leaf top
    // and never meets the open leaf. Push face (the leaf opens away from it, its
    // face sits behind the stop): the spindle on the body front at the spindle
    // height, the arm reaching out and up to the shoe in front of the frame
    const level = fs > 0;
    const armY = ly(Number(s.x) || 0);
    const bodyTopY = ly(Number(b.x) || 0);
    const spindleLeaf = level
      ? [lx(Number(a.from?.y) || 0), armY, faceZ + fs * bDepth / 2]
      : [lx(Number(a.from?.y) || 0), ly(Number(a.from?.x) || 0), faceZ + fs * (bDepth + mm(ARM_T) / 2)];
    const post = level
      ? (armY > bodyTopY ? { pos: [spindleLeaf[0], (armY + bodyTopY) / 2, spindleLeaf[2]], h: armY - bodyTopY, upright: true } : null)
      : { pos: [spindleLeaf[0], spindleLeaf[1], faceZ + fs * (bDepth + mm(ARM_T) / 2)], h: mm(ARM_T), upright: false };
    // the shoe on the head face of that side (frame mm): x from the hinge edge, y above the leaf top (x < 0)
    const shoeFx = hingeJambLeft ? leafX + (Number(s.y) || 0) : leafX + lw - (Number(s.y) || 0);
    const shoeFy = leafY + (Number(s.x) || 0);
    const shoeZ0 = fs * d / 2;
    const shoe = { pos: [X(shoeFx), Y(shoeFy), mm(shoeZ0 + fs * SHOE_D / 2)], size: [mm(Number(s.length) || 0), mm(Number(s.height) || 0), mm(SHOE_D)] };
    // the arm: two links from the spindle top (after the swing) to the shoe's
    // front, the elbow out on the closer face's side (armElbow), all level
    const A = new THREE.Vector3(...leafToFrame(spindleLeaf));
    const B = new THREE.Vector3(X(shoeFx), Y(shoeFy), mm(shoeZ0 + fs * SHOE_D));
    const link = mm(Number(a.length) || 0) * ARM_LINK;
    const armOut = new THREE.Vector3(0, 0, fs).applyAxisAngle(Y_AXIS, angle);   // the closer face's normal after the swing
    let armPts = link > 0 ? [A, level ? armElbow(A, B, link, link, armOut) : armElbow3d(A, B, link, armOut), B] : [A, B];
    if (!level) {
      // push face: where the arm passes the head and the stop (above the stop's
      // underside) it must stay in front of the frame face; out of reach, or
      // behind it, the arm runs level under the stop to the point in front of
      // the shoe and rises there to the shoe
      const stopUnder = Y(thk), halfW = mm(Number(a.width) || 0) / 2, faceZf = mm(d / 2);
      const clear = armPts.slice(0, -1).every((p, k) => {
        const q = armPts[k + 1];
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const y = p.y + (q.y - p.y) * t, z = p.z + (q.z - p.z) * t;
          if (y + halfW > stopUnder && fs * z < faceZf) return false;
        }
        return true;
      });
      if (A.distanceTo(B) >= 2 * link || !clear) armPts = [A, new THREE.Vector3(B.x, A.y, B.z), B];
    }
    closerLeaf = { kind: 'surface', body: bodyLeaf, post, fs };
    closerFrame = { kind: 'surface', shoe, arm: armPts.map((v) => [v.x, v.y, v.z]), armW: mm(Number(a.width) || 0) };
  } else if (csym?.kind === 'builtin' && csym.body) {
    const b = csym.body, t = csym.track || {};
    const bw = Number(b.width) || 0, bz = Number(b.z) || 0;
    closerLeaf = {
      kind: 'builtin',
      slot: { pos: [lx((Number(b.y) || 0) + (Number(b.length) || 0) / 2), H3 / 2 + mm(SLOT_PROUD) - mm(SLOT_T) / 2, T3 / 2 - mm(bz + bw / 2)], size: [mm(Number(b.length) || 0), mm(SLOT_T), mm(bw)] },
    };
    // the track in the head soffit over the leaf (frame mm, y down): the soffit is the head's wall part underside at y = faceOut
    const tLen = Number(t.length) || 0;
    const tx0 = hingeJambLeft ? leafX + (Number(t.y) || 0) : leafX + lw - (Number(t.y) || 0) - tLen;
    const tzc = leafPullZ - bz - bw / 2;
    closerFrame = {
      kind: 'builtin',
      track: { pos: [X(tx0 + tLen / 2), Y(faceOut + SLOT_PROUD - SLOT_T / 2), mm(tzc)], size: [mm(tLen), mm(SLOT_T), mm(Number(t.width) || 0)] },
    };
  }

  return (
    <group name="fire-door" rotation={[0, Math.PI, 0]}>
      {/* ═══ Frame ═══ */}
      <group name="fd-frame">{frameMeshes}</group>

      {/* ═══ Leaf, swinging about the knuckle axis ═══ */}
      <group name="fd-leaf" position={[leafCx, leafCy, mm(leafCz)]}>
        <Swing px={px} pz={pz} angle={angle}>
          <mesh name="leaf-body" geometry={leafGeo} material={woodMat} castShadow receiveShadow />

          {/* vision panel glass and beads, each pane by its shape */}
          {panes.map((p, k) => (
            <group key={`vp-${p.i}`} name={`vp-${p.i}`} position={[p.cx, p.cy, 0]} rotation={[0, 0, p.rotated ? Math.PI / 4 : 0]}>
              {p.shape === 'round' ? (
                <mesh name="vp-glass" castShadow={false} receiveShadow material={glassMat} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[p.r, p.r, mm(glassT), 64]} />
                </mesh>
              ) : (
                <mesh name="vp-glass" castShadow={false} receiveShadow material={glassMat}>
                  <boxGeometry args={[p.w, p.h, mm(glassT)]} />
                </mesh>
              )}
              {[1, -1].map((f) => (p.shape === 'round' ? (
                <group key={f} name="vp-beads" position={[0, 0, f > 0 ? T3 / 2 : -T3 / 2 - mm(BEAD.proud)]}>
                  <mesh material={woodMat} geometry={ringGeos[k]} />
                </group>
              ) : (
                <group key={f} name="vp-beads" position={[0, 0, f * (T3 / 2 + mm(BEAD.proud) / 2)]}>
                  <mesh material={woodMat} position={[0, p.h / 2 + mm(BEAD.w) / 2, 0]}><boxGeometry args={[p.w + 2 * mm(BEAD.w), mm(BEAD.w), mm(BEAD.proud)]} /></mesh>
                  <mesh material={woodMat} position={[0, -p.h / 2 - mm(BEAD.w) / 2, 0]}><boxGeometry args={[p.w + 2 * mm(BEAD.w), mm(BEAD.w), mm(BEAD.proud)]} /></mesh>
                  <mesh material={woodMat} position={[-p.w / 2 - mm(BEAD.w) / 2, 0, 0]}><boxGeometry args={[mm(BEAD.w), p.h, mm(BEAD.proud)]} /></mesh>
                  <mesh material={woodMat} position={[p.w / 2 + mm(BEAD.w) / 2, 0, 0]}><boxGeometry args={[mm(BEAD.w), p.h, mm(BEAD.proud)]} /></mesh>
                </group>
              )))}
            </group>
          ))}

          {/* v1.2: the intumescent strips in the top edge and both long edges, the engine's colour */}
          {strips.length > 0 && (
            <group name="fd-intumescent">
              {strips.map((s) => (
                <mesh key={s.key} name="intu-strip" material={intuMat} position={s.pos} receiveShadow>
                  <boxGeometry args={s.size} />
                </mesh>
              ))}
            </group>
          )}

          {/* v1.2: the closer parts that open with the leaf (the surface body, the built in slot) */}
          {closerLeaf?.kind === 'surface' && (
            <group name="fd-closer-leaf">
              <mesh name="closer-body" material={closerMat} position={closerLeaf.body.pos} castShadow>
                <boxGeometry args={closerLeaf.body.size} />
              </mesh>
              {closerLeaf.post && (
                <mesh name="closer-pivot" material={closerMat} position={closerLeaf.post.pos} rotation={closerLeaf.post.upright ? [0, 0, 0] : [Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[mm(PIVOT_R), mm(PIVOT_R), closerLeaf.post.h, 20]} />
                </mesh>
              )}
            </group>
          )}
          {closerLeaf?.kind === 'builtin' && (
            <mesh name="closer-slot" material={darkMat} position={closerLeaf.slot.pos}>
              <boxGeometry args={closerLeaf.slot.size} />
            </mesh>
          )}

          {/* lever on a rose at the spindle, both faces */}
          <group position={[hx, hy, T3 / 2]}><LeverOnRose out={1} dir={leverDir} mat={metalMat} /></group>
          <group position={[hx, hy, -T3 / 2]}><LeverOnRose out={-1} dir={leverDir} mat={metalMat} /></group>

          {/* euro cylinder escutcheons / bathroom thumbturns below the spindle */}
          {cyl && [1, -1].map((f) => (
            <group key={`cyl-${f}`} name={`fd-${cyl.kind || 'cylinder'}`} position={[hx, cy, f * T3 / 2]}>
              {cyl.kind === 'bathroom' ? (
                <>
                  <mesh material={metalMat} position={[0, 0, f * mm(THUMBTURN.t) / 2]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[mm(THUMBTURN.r), mm(THUMBTURN.r), mm(THUMBTURN.t), 24]} />
                  </mesh>
                  <mesh material={metalMat} position={[0, 0, f * mm(THUMBTURN.t + THUMBTURN.barH / 2)]}>
                    <boxGeometry args={[mm(THUMBTURN.barW), mm(THUMBTURN.barL), mm(THUMBTURN.barH)]} />
                  </mesh>
                </>
              ) : (
                <>
                  <mesh material={metalMat} position={[0, 0, f * mm(ESCUTCHEON_T) / 2]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[mm(ESCUTCHEON_R), mm(ESCUTCHEON_R), mm(ESCUTCHEON_T), 24]} />
                  </mesh>
                  <mesh material={metalMat} position={[0, 0, f * mm(ESCUTCHEON_T + CYLINDER_PROUD / 2)]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[mm(CYLINDER_R), mm(CYLINDER_R), mm(CYLINDER_PROUD), 24]} />
                  </mesh>
                </>
              )}
            </group>
          ))}

          {/* the forend plate on the lock edge: a slot with full radius ends (v1.2) */}
          {forendGeo && (
            <mesh name="lock-forend" material={metalMat} geometry={forendGeo}
              position={[lockEdgeRight ? W3 / 2 : -W3 / 2, H3 / 2 - mm(Number(fo.centreFromTop) || 0), 0]} />
          )}
        </Swing>
      </group>

      {/* ═══ Hinge knuckles on the frame side of the gap, on the pull face plane ═══ */}
      {hinges.map((hp, i) => (
        <mesh key={`hinge-${i}`} name="fd-hinge" castShadow material={hingeMat}
          position={[X(knuckleX), Y(leafY + hp.centre), mm(leafPullZ)]}>
          <cylinderGeometry args={[mm(KNUCKLE_R), mm(KNUCKLE_R), mm(hingeLen), 16]} />
        </mesh>
      ))}

      {/* ═══ Keep plate on the lock jamb's rebate cheek: a slot with full radius ends (v1.2) ═══ */}
      {keepGeo && (
        <mesh name="keep-plate" material={metalMat} geometry={keepGeo}
          position={[X(keepCheekX), Y(keepCy), mm(leafCz)]} />
      )}

      {/* ═══ v1.2: the closer parts on the frame: the surface closer's shoe and arm, the built in closer's head track ═══ */}
      {closerFrame?.kind === 'surface' && (
        <group name="fd-closer">
          <mesh name="closer-shoe" material={closerMat} position={closerFrame.shoe.pos} castShadow>
            <boxGeometry args={closerFrame.shoe.size} />
          </mesh>
          {closerFrame.arm.slice(0, -1).map((a, k) => (
            <Bar key={k} name="closer-arm" a={a} b={closerFrame.arm[k + 1]} w={closerFrame.armW} t={mm(ARM_T)} mat={closerMat} />
          ))}
        </group>
      )}
      {closerFrame?.kind === 'builtin' && (
        <group name="fd-closer">
          <mesh name="closer-track" material={darkMat} position={closerFrame.track.pos}>
            <boxGeometry args={closerFrame.track.size} />
          </mesh>
        </group>
      )}
    </group>
  );
}
