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
 * and, inside the pull-side frame, +z is the pull side. The viewer's
 * exterior (+z camera) is the corridor side of the room: a door that swings
 * OUT (into the corridor) opens toward the viewer and shows its pull face;
 * a door that swings IN (into the room, the default) is turned by PI about
 * Y so its pull face looks into the room (-z) and the viewer sees the push
 * face (the 50 frame face, the leaf in the opening, the handle). Hinge left
 * / right is the engine's: seen from the pull side.
 *
 * What is drawn:
 *   frame   three members as L sections: the wall part (the 35 face, full
 *           depth) and the stop part (the 15 of the rebate width behind the
 *           47 rebate depth); the jambs full height, the head between them
 *           (the mitre is implied, look only)
 *   leaf    one extruded rectangle w x h x t with a hole per vision panel
 *           pane (the diamond as a rotated square), set in the rebate 3
 *           behind the pull face plane, 3 off the cheeks, floorGap above
 *           the frame feet; a glass pane and glazing beads in every hole; a
 *           forend plate on the lock edge
 *   hinges  three knuckles at the engine's hinge positions, the leaf swings
 *           about the knuckle axis by openAngle toward the pull side
 *   handle  a lever on a rose at the spindle on both faces, pointing toward
 *           the hinge; a euro cylinder escutcheon or a bathroom thumbturn
 *           below it when the lock has one
 *   keep    a keep plate on the lock jamb's rebate cheek at the engine's
 *           keep centre
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
const FINISH = {
  brass: '#d4af37', chrome: '#e8eaec', stainless: '#c8c8c8',
  antique_brass: '#9c7722', black: '#1a1a1a', white: '#f0f0f0',
};

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

// The leaf body: one extruded rectangle with a hole per pane (metres, leaf
// centred on the origin, x right, y up, z through the thickness).
function leafGeometry(W3, H3, T3, panes) {
  const shape = new THREE.Shape();
  shape.moveTo(-W3 / 2, -H3 / 2);
  shape.lineTo(W3 / 2, -H3 / 2);
  shape.lineTo(W3 / 2, H3 / 2);
  shape.lineTo(-W3 / 2, H3 / 2);
  shape.closePath();
  for (const p of panes) {
    const hole = new THREE.Path();
    if (p.rotated) {
      // the pane rotated 45 degrees about its centre
      const c = Math.SQRT1_2;
      const corners = [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]]
        .map(([x, y]) => [p.cx + x * c - y * c, p.cy + x * c + y * c]);
      hole.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < corners.length; i++) hole.lineTo(corners[i][0], corners[i][1]);
    } else {
      hole.moveTo(p.cx - p.w / 2, p.cy - p.h / 2);
      hole.lineTo(p.cx + p.w / 2, p.cy - p.h / 2);
      hole.lineTo(p.cx + p.w / 2, p.cy + p.h / 2);
      hole.lineTo(p.cx - p.w / 2, p.cy + p.h / 2);
    }
    hole.closePath();
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: T3, bevelEnabled: false });
  g.translate(0, 0, -T3 / 2);
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
  // the clear glass of the door glazing (DoorGlazing.jsx), a frosted tint when asked
  const glassT = Number(g?.vp?.glassThickness) > 0 ? Number(g.vp.glassThickness) : 6;
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial(glassFinish === 'clear' ? {
    color: '#d4e8f0', metalness: 0.05, roughness: 0.05,
    transmission: 0.92, transparent: true, opacity: 0.35,
    ior: 1.5, thickness: mm(glassT), side: THREE.DoubleSide,
  } : {
    color: '#c8dce8', roughness: 0.9, metalness: 0,
    transmission: 0.2, transparent: true, opacity: 0.9,
    ior: 1.52, thickness: mm(glassT), side: THREE.DoubleSide,
  }), [glassFinish, glassT]);

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
  const swingIn = (g?.handing?.swing || 'in') !== 'out';
  // the leaf closes against the stop (rebate depth behind the pull face),
  // its pull face is the rebate clearance behind the pull face plane
  const leafPullZ = d / 2 - (rebD - lt);
  const leafCz = leafPullZ - lt / 2;
  const W3 = mm(lw), H3 = mm(lh), T3 = mm(lt);

  // the panes in the leaf's own frame (metres, centred, y up): the engine
  // gives x from the leaf TOP and y from the HINGE edge; only the diamond
  // (angle 45) is drawn turned, a pane the engine turned to fit (angle 90)
  // already carries its axis-aligned w x h
  const panes = useMemo(() => (valid ? (g.vp?.panes || []) : []).map((p, i) => {
    const w = Number(p.w) || 0, h = Number(p.h) || 0;
    const top = Number(p.x) || 0, fromHinge = Number(p.y) || 0;
    const left = hinge === 'left' ? fromHinge : lw - fromHinge - w;
    return {
      i, w: mm(w), h: mm(h), rotated: Number(p.angle) === 45,
      cx: -W3 / 2 + mm(left + w / 2),
      cy: H3 / 2 - mm(top + h / 2),
    };
  }), [valid, g, hinge, lw, W3, H3]);

  const leafGeo = useMemo(() => (valid && lw > 0 && lh > 0 && lt > 0 ? leafGeometry(W3, H3, T3, panes) : null), [valid, lw, lh, lt, W3, H3, T3, panes]);

  if (!valid || !leafGeo) return null;

  // a box from a frame rect (mm, pull-side frame) + a z range (mm)
  const boxMesh = ({ k, name, x0, x1, y0, y1, z0, z1, mat }) => (
    <mesh key={k} name={name} castShadow receiveShadow material={mat}
      position={[X((x0 + x1) / 2), Y((y0 + y1) / 2), mm((z0 + z1) / 2)]}>
      <boxGeometry args={[mm(x1 - x0), mm(y1 - y0), mm(z1 - z0)]} />
    </mesh>
  );

  // ─── frame: the L sections ───
  const hingeJambLeft = hinge === 'left';
  const jambName = (side) => (side === 'left') === hingeJambLeft ? 'jamb-hinge' : 'jamb-lock';
  const frameMeshes = [
    // left jamb: wall part (the 35 face, full depth) and stop part (behind the rebate)
    boxMesh({ k: 'jl-face', name: `frame-${jambName('left')}-face`, x0: 0, x1: faceOut, y0: 0, y1: H, z0: -d / 2, z1: d / 2, mat: woodMat }),
    boxMesh({ k: 'jl-stop', name: `frame-${jambName('left')}-stop`, x0: faceOut, x1: thk, y0: 0, y1: H, z0: -d / 2, z1: d / 2 - rebD, mat: woodMat }),
    // right jamb
    boxMesh({ k: 'jr-face', name: `frame-${jambName('right')}-face`, x0: W - faceOut, x1: W, y0: 0, y1: H, z0: -d / 2, z1: d / 2, mat: woodMat }),
    boxMesh({ k: 'jr-stop', name: `frame-${jambName('right')}-stop`, x0: W - thk, x1: W - faceOut, y0: 0, y1: H, z0: -d / 2, z1: d / 2 - rebD, mat: woodMat }),
    // head between the jambs
    boxMesh({ k: 'hd-face', name: 'frame-head-face', x0: thk, x1: W - thk, y0: 0, y1: faceOut, z0: -d / 2, z1: d / 2, mat: woodMat }),
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

  // ─── handle at the spindle ───
  const lockEdgeRight = hingeJambLeft;
  const sp = g.lock?.spindle || {};
  const backset = Number(sp.fromLockEdge) || 0;
  const hx = lockEdgeRight ? W3 / 2 - mm(backset) : -W3 / 2 + mm(backset);
  const hy = -H3 / 2 + mm(Number(sp.fromBottom) || 0);
  const leverDir = lockEdgeRight ? -1 : 1;   // the lever points toward the hinge
  const cyl = g.lock?.cylinder || null;
  const cy = cyl ? -H3 / 2 + mm(Number(cyl.fromBottom) || 0) : 0;
  const fo = g.lock?.forend || null;

  // ─── keep plate on the lock jamb cheek ───
  const keep = g.keep || null;
  const keepCheekX = hingeJambLeft ? W - faceOut : faceOut;
  const keepCy = keep ? H - (Number(keep.centreFromFoot) || 0) : 0;

  const hinges = (g.hinges?.positions || []).map((p) => ({
    top: Number(p.top) || 0,
    centre: Number.isFinite(Number(p.centre)) ? Number(p.centre) : (Number(p.top) || 0) + (Number(g.hinges?.length) || 0) / 2,
  }));
  const hingeLen = Number(g.hinges?.length) || 0;

  return (
    <group name="fire-door" rotation={[0, swingIn ? Math.PI : 0, 0]}>
      {/* ═══ Frame ═══ */}
      <group name="fd-frame">{frameMeshes}</group>

      {/* ═══ Leaf, swinging about the knuckle axis ═══ */}
      <group name="fd-leaf" position={[leafCx, leafCy, mm(leafCz)]}>
        <Swing px={px} pz={pz} angle={angle}>
          <mesh name="leaf-body" geometry={leafGeo} material={woodMat} castShadow receiveShadow />

          {/* vision panel glass and beads */}
          {panes.map((p) => (
            <group key={`vp-${p.i}`} name={`vp-${p.i}`} position={[p.cx, p.cy, 0]} rotation={[0, 0, p.rotated ? Math.PI / 4 : 0]}>
              <mesh name="vp-glass" castShadow={false} receiveShadow material={glassMat}>
                <boxGeometry args={[p.w, p.h, mm(glassT)]} />
              </mesh>
              {[1, -1].map((f) => (
                <group key={f} name="vp-beads" position={[0, 0, f * (T3 / 2 + mm(BEAD.proud) / 2)]}>
                  <mesh material={woodMat} position={[0, p.h / 2 + mm(BEAD.w) / 2, 0]}><boxGeometry args={[p.w + 2 * mm(BEAD.w), mm(BEAD.w), mm(BEAD.proud)]} /></mesh>
                  <mesh material={woodMat} position={[0, -p.h / 2 - mm(BEAD.w) / 2, 0]}><boxGeometry args={[p.w + 2 * mm(BEAD.w), mm(BEAD.w), mm(BEAD.proud)]} /></mesh>
                  <mesh material={woodMat} position={[-p.w / 2 - mm(BEAD.w) / 2, 0, 0]}><boxGeometry args={[mm(BEAD.w), p.h, mm(BEAD.proud)]} /></mesh>
                  <mesh material={woodMat} position={[p.w / 2 + mm(BEAD.w) / 2, 0, 0]}><boxGeometry args={[mm(BEAD.w), p.h, mm(BEAD.proud)]} /></mesh>
                </group>
              ))}
            </group>
          ))}

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

          {/* forend plate on the lock edge */}
          {fo && Number(fo.length) > 0 && (
            <mesh name="lock-forend" material={metalMat}
              position={[lockEdgeRight ? W3 / 2 + mm(PLATE_T) / 2 : -W3 / 2 - mm(PLATE_T) / 2, H3 / 2 - mm(Number(fo.centreFromTop) || 0), 0]}>
              <boxGeometry args={[mm(PLATE_T), mm(Number(fo.length)), mm(Number(fo.width) || lt / 2)]} />
            </mesh>
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

      {/* ═══ Keep plate on the lock jamb's rebate cheek ═══ */}
      {keep && Number(keep.plate?.length) > 0 && (
        <mesh name="keep-plate" material={metalMat}
          position={[X(hingeJambLeft ? keepCheekX - PLATE_T / 2 : keepCheekX + PLATE_T / 2), Y(keepCy), mm(leafCz)]}>
          <boxGeometry args={[mm(PLATE_T), mm(Number(keep.plate.length)), mm(Number(keep.plate.width) || lt)]} />
        </mesh>
      )}
    </group>
  );
}
