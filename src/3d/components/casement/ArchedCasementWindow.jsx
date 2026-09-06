/**
 * ArchedCasementWindow.jsx — arched casement: outer frame with the rebate,
 * gasket, one leaf that pivots left / right, glass, glazing bars.
 *
 * arched-casement-v2 night 4 (F): every contour comes from src/engine/arch.js
 * through archedCasementGeometry.js — rule C (the arch starts vertical at the
 * jambs), concentric rings, the typed rise (`archRise`) — so the preview is
 * the production geometry, not a fixed-ratio sketch. The leaf is drawn here
 * (frame ring + contour beads + glass + bars) instead of delegating to
 * FixFrameWindow, whose shapes were the PSW ratios.
 *
 * Props keep the PSW names (`archShape`, `hingeDirection`, `hBars`, `vBars`,
 * `opening`, `fixSemiBarPattern`, `fixGothicBars`) so the file is a drop-in
 * for PSW 3d-src, plus: `archRise` (mm — absent: the PSW ratio of the shape
 * name), `archProfile` (gothic equilateral | drop | shallow), `barPattern`
 * (PC pattern; falls back to the two PSW pattern props), `archMinHaunchRadius`
 * (profile arch.minHaunchRadius, P3 — 0 = pure geometry rule) and
 * `archPatterns` (profile arch.patterns — absent: the PSW literals).
 * Bars: straight ones as the profiled trapezoid / ovolo extrusions along the
 * segment, curved ones as layered strips along the exact arc (PSW
 * FixFrameWindow `intersectingData` / `buildRingLayers` approach, reused).
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, BOTTOM_FACE, BOTTOM_INNER_FACE, GASKET_W, GASKET_T, mm } from './CasementFrame';
import { SASH_RAIL, SASH_DEPTH, MAX_ANGLE } from './CasementPanel';
import { GLASS_UNIT_DEPTH } from './CasementGlazing';
import WindowCasementHandle from './WindowCasementHandle';
import { safeArchedCasementGeometry, contourAt, sampleArc, PSW_BAR_PATTERN_SETTINGS } from './archedCasementGeometry.js';

const LEAF_GAP = 4; // mm gap between leaf and frame (all round)

// 3D dimensions handed to the geometry helper — the same constants the
// straight casement is built from (CasementFrame / CasementPanel).
const DIMS = Object.freeze({
  frameFace: FRAME_FACE, extFace: EXT_FACE, bottomFace: BOTTOM_FACE, bottomInner: BOTTOM_INNER_FACE,
  leafGap: LEAF_GAP, leafFace: SASH_RAIL, gasketW: GASKET_W,
  innerMargin: 10,   // bead 9 + spacer 1 inside the daylight — the deepest ring the leaf draws
});

// ─── Bar dimensions (CasementGlazing / FixFrameWindow) ───
const BAR_W = mm(22);
const BAR_TOP = mm(2);
const BAR_H = mm(16.5);
const SPACER_BAR_W = mm(18);
const SPACER_DEPTH = mm(16);
const GU = mm(GLASS_UNIT_DEPTH);
const glassHalf = GU / 2;
const BAR_OVERSHOOT = mm(18);       // straight bars run under the bead (FixBars)
const SPOKE_START_INSET = 0.6;      // PSW spokes: start ring + 0.6·BAR_W, end outline − 0.4·BAR_W
const SPOKE_END_INSET = 0.4;
const SPOKE_OVERSHOOT = mm(10);

// ─── Bead dimensions (CasementPanel) ───
const EBW = mm(9);    // ext chamfer width
const EBD = mm(15);   // ext chamfer depth
const IBD = mm(14);   // int ovolo depth
const BEAD_STEPS = 32;     // layered strips per bead (PSW ContourBeads: 64)
const CURVE_STEPS = 64;    // layered strips per curved bar (PSW intersecting / hub rings: 64)
const CHAMFER_TOP = mm(1);

// ─── Shape helpers (mm points → metres) ───
function toShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(mm(pts[0][0]), mm(pts[0][1]));
  for (let i = 1; i < pts.length; i++) s.lineTo(mm(pts[i][0]), mm(pts[i][1]));
  s.closePath();
  return s;
}
function shapeWithHole(outerPts, innerPts) {
  const shape = toShape(outerPts);
  const hole = new THREE.Path();
  hole.moveTo(mm(innerPts[0][0]), mm(innerPts[0][1]));
  for (let i = 1; i < innerPts.length; i++) hole.lineTo(mm(innerPts[i][0]), mm(innerPts[i][1]));
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}
function extrude(shape, depth, z, curveSegments) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, ...(curveSegments ? { curveSegments } : {}) });
  g.translate(0, 0, z);
  g.computeVertexNormals();
  return g;
}

// Frame with the rebate step (two layers, as CasementFrame): EXT layer outer →
// rebated hole (36 face), INT layer outer → full hole (57 face).
function makeFrameGeo(outer, inner, innerRebated) {
  const halfD = mm(FRAME_DEPTH) / 2;
  return {
    ext: extrude(shapeWithHole(outer, innerRebated), mm(EXT_DEPTH), halfD - mm(EXT_DEPTH)),
    int: extrude(shapeWithHole(outer, inner), mm(INT_DEPTH), -halfD),
  };
}

// Strip around a centreline (metres) of half width hw — PSW ptsToStrip
function ptsToStrip(pts, hw) {
  if (pts.length < 3) return null;
  const leftEdge = [], rightEdge = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * hw, ny = dx / len * hw;
    leftEdge.push([pts[i][0] + nx, pts[i][1] + ny]);
    rightEdge.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(leftEdge[0][0], leftEdge[0][1]);
  for (let i = 1; i < leftEdge.length; i++) shape.lineTo(leftEdge[i][0], leftEdge[i][1]);
  for (let i = rightEdge.length - 1; i >= 0; i--) shape.lineTo(rightEdge[i][0], rightEdge[i][1]);
  shape.closePath();
  return shape;
}

// Bar profiles (CasementGlazing / FixFrameWindow): trapezoid EXT, ovolo INT, along +Y
function useBarProfiles() {
  return useMemo(() => {
    const trap = new THREE.Shape();
    trap.moveTo(-BAR_W / 2, 0); trap.lineTo(-BAR_TOP / 2, BAR_H); trap.lineTo(BAR_TOP / 2, BAR_H); trap.lineTo(BAR_W / 2, 0);
    trap.closePath();
    const drop = mm(2), sqH = mm(2);
    const ovolo = new THREE.Shape();
    ovolo.moveTo(-BAR_W / 2, 0);
    ovolo.quadraticCurveTo(-BAR_W / 2, BAR_H - drop - sqH, -BAR_TOP / 2, BAR_H - sqH);
    ovolo.lineTo(-BAR_TOP / 2, BAR_H); ovolo.lineTo(BAR_TOP / 2, BAR_H); ovolo.lineTo(BAR_TOP / 2, BAR_H - sqH);
    ovolo.quadraticCurveTo(BAR_W / 2, BAR_H - drop - sqH, BAR_W / 2, 0);
    ovolo.closePath();
    return { trap, ovolo };
  }, []);
}

/* ─── Straight bar along a segment (mm end points, 3D frame) ─── */
function StraightBar({ bar, profiles, matExt, matInt, spacerMat, glassHalfWidth }) {
  const geo = useMemo(() => {
    const [x0, y0] = bar.from, [x1, y1] = bar.to;
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy);
    if (!(L > 0)) return null;
    const ux = dx / L, uy = dy / L;
    // a spoke (or a springing segment between rings) is inset from the ring it
    // starts on and the outline it ends on; every other bar runs under the bead
    const segment = bar.role === 'spoke' || (bar.role === 'springing' && Math.abs(x1 - x0) < 2 * glassHalfWidth - 1);
    const startIn = segment ? SPOKE_START_INSET * BAR_W : 0;
    const endIn = segment ? SPOKE_END_INSET * BAR_W : 0;
    const len = Math.max(mm(L) - startIn - endIn, mm(20));
    const total = len + (segment ? SPOKE_OVERSHOOT : BAR_OVERSHOOT);
    const cx = mm(x0) + ux * (startIn + len / 2);
    const cy = mm(y0) + uy * (startIn + len / 2);
    const build = (profile, curveSegments) => {
      const g = new THREE.ExtrudeGeometry(profile, { depth: total, bevelEnabled: false, ...(curveSegments ? { curveSegments } : {}) });
      g.rotateX(-Math.PI / 2); g.translate(0, -total / 2, 0); g.computeVertexNormals();
      return g;
    };
    return { ext: build(profiles.trap), int: build(profiles.ovolo, 32), len, cx, cy, angle: Math.atan2(uy, ux) - Math.PI / 2 };
  }, [bar, profiles, glassHalfWidth]);
  if (!geo) return null;
  return (
    <group position={[geo.cx, geo.cy, 0]} rotation={[0, 0, geo.angle]}>
      <mesh geometry={geo.ext} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <primitive object={matExt} attach="material" />
      </mesh>
      <mesh geometry={geo.int} position={[0, 0, -glassHalf]} castShadow receiveShadow>
        <primitive object={matInt} attach="material" />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[SPACER_BAR_W, geo.len, SPACER_DEPTH]} />
        <primitive object={spacerMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ─── Curved bar (ring / tracery): layered strips along the exact arc ─── */
function ArcBar({ bar, matExt, matInt, spacerMat }) {
  const geo = useMemo(() => {
    const centreline = sampleArc(bar.arc, 48).map(([x, y]) => [mm(x), mm(y)]);
    const layerD = BAR_H / CURVE_STEPS;
    const extLayers = [], intLayers = [];
    for (let i = 0; i < CURVE_STEPS; i++) {
      const t = i / (CURVE_STEPS - 1);
      const hw = (BAR_W / 2) * (1 - t) + (BAR_TOP / 2) * t;
      const s = ptsToStrip(centreline, hw);
      if (s) extLayers.push(extrude(s, layerD, glassHalf + i * layerD));
    }
    for (let i = 0; i < CURVE_STEPS; i++) {
      const t = (i + 1) / CURVE_STEPS;
      const hw = Math.max((BAR_W / 2) * Math.cos(t * Math.PI / 2), BAR_TOP / 2);
      const s = ptsToStrip(centreline, hw);
      if (s) intLayers.push(extrude(s, layerD, -(glassHalf + (i + 1) * layerD)));
    }
    const ss = ptsToStrip(centreline, SPACER_BAR_W / 2);
    const spacer = ss ? extrude(ss, SPACER_DEPTH, -SPACER_DEPTH / 2) : null;
    return { extLayers, intLayers, spacer };
  }, [bar]);
  return (
    <group>
      {geo.extLayers.map((g, i) => (
        <mesh key={'e' + i} geometry={g} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      ))}
      {geo.intLayers.map((g, i) => (
        <mesh key={'i' + i} geometry={g} castShadow receiveShadow><primitive object={matInt} attach="material" /></mesh>
      ))}
      {geo.spacer && <mesh geometry={geo.spacer} castShadow receiveShadow><primitive object={spacerMat} attach="material" /></mesh>}
    </group>
  );
}

/* ─── Glass material (identical to FixFrameWindow / CasementGlazing) ─── */
function useGlassMat(finish) {
  return useMemo(() => {
    const noise = (fill, count, rMax, alpha) => {
      const size = 256, c = document.createElement('canvas'); c.width = size; c.height = size;
      const ctx = c.getContext('2d'); ctx.fillStyle = fill; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < count; i++) { const x = Math.random() * size, y = Math.random() * size; ctx.beginPath(); ctx.arc(x, y, Math.random() * rMax, 0, Math.PI * 2); ctx.fillStyle = alpha(Math.random()); ctx.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
    };
    if (finish === 'frosted') {
      const tex = noise('#d0e4f0', 40000, 2, (r) => `rgba(255,255,255,${r * 0.35})`);
      return new THREE.MeshPhysicalMaterial({ color: '#c8dce8', roughness: 1, metalness: 0, transmission: 0.15, transparent: true, opacity: 0.96, thickness: GU, ior: 1.52, side: THREE.DoubleSide, map: tex, roughnessMap: tex });
    }
    if (finish === 'obscure') {
      const tex = noise('#c8dce8', 8000, 5, (r) => `rgba(200,220,240,${r * 0.5})`);
      return new THREE.MeshPhysicalMaterial({ color: '#b8ccd8', roughness: 0.7, metalness: 0.02, transmission: 0.4, transparent: true, opacity: 0.85, thickness: GU, ior: 1.5, side: THREE.DoubleSide, map: tex });
    }
    return new THREE.MeshPhysicalMaterial({ color: '#d4e8f0', metalness: 0.05, roughness: 0.05, transmission: 0.92, transparent: true, opacity: 0.35, ior: 1.5, thickness: GU, side: THREE.DoubleSide });
  }, [finish]);
}

// PSW pattern props → PC pattern name ('patternA' has no PC counterpart → none)
function resolvePattern(barPattern, fixSemiBarPattern, fixGothicBars) {
  if (barPattern) return barPattern;
  if (fixSemiBarPattern && fixSemiBarPattern !== 'none') return fixSemiBarPattern;
  if (fixGothicBars === 'intersecting') return 'intersecting';
  return 'none';
}

// ── Main component ──
export default function ArchedCasementWindow({
  width = 1000,
  height = 1500,
  archShape = 'semi-circle',
  archRise = null,
  archProfile = null,
  barPattern = null,
  archMinHaunchRadius = 0,
  archPatterns = null,
  archSpokes = null,      // v3 0.4: custom hub spoke count (PC)
  archRings = null,       // v3 0.4: custom hub ring fractions (PC)
  hingeDirection = 'left',
  opening = 0.3,
  fixedLeaf = false,      // v3 Block 3 (PC): fixed window — no handle, the leaf never opens
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  hBars = 0,
  vBars = 0,
  showGuides = true,
  brightness = 1.0,
  ironmongery = 'brass',
  sealColour = 'black',
  sillExtension = 0,
  sillWider = false,
  fixSemiBarPattern = 'none',
  fixGothicBars = 'none',
}) {
  void brightness;
  const colorE = sameColor ? woodColor : woodColorExt;
  const colorI = sameColor ? woodColor : woodColorInt;

  const extMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorE, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorE]);
  const intMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorI, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorI]);
  const gasketMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: sealColour === 'white' ? '#E8E8E8' : '#1a1a1a', roughness: 0.9, metalness: 0,
  }), [sealColour]);
  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerColor === 'white' ? '#f8f8f8' : spacerColor === 'black' ? '#1a1a1a' : '#a0a4a8',
    metalness: 0.6, roughness: 0.4,
  }), [spacerColor]);
  const glassMat = useGlassMat(glassFinish);
  const profiles = useBarProfiles();

  const handleColors = useMemo(() => {
    const defs = {
      brass:         { metalColor: '#d4af37', lockColor: '#c9b07a' },
      chrome:        { metalColor: '#e8eaec', lockColor: '#c8cacc' },
      stainless:     { metalColor: '#c8c8c8', lockColor: '#a8a8a8' },
      antique_brass: { metalColor: '#9c7722', lockColor: '#7a5810' },
      black:         { metalColor: '#1a1a1a', lockColor: '#111111' },
      white:         { metalColor: '#f0f0f0', lockColor: '#d8d8d8' },
    };
    return defs[ironmongery] || defs.brass;
  }, [ironmongery]);

  const pattern = resolvePattern(barPattern, fixSemiBarPattern, fixGothicBars);

  // ── Geometry: arch.js chains in mm around the window centre ──
  const G = useMemo(() => safeArchedCasementGeometry({
    width, height, archShape, archRise, archProfile, barPattern: pattern, hBars, vBars, spokes: archSpokes, rings: archRings,
    minHaunchRadius: archMinHaunchRadius, patterns: archPatterns || PSW_BAR_PATTERN_SETTINGS, dims: DIMS,
  }), [width, height, archShape, archRise, archProfile, pattern, hBars, vBars, archSpokes, archRings, archMinHaunchRadius, archPatterns]);

  const D = mm(FRAME_DEPTH);
  const halfD = D / 2;

  // ── Frame + gasket ──
  const frameData = useMemo(() => {
    if (!G) return null;
    const frameGeo = makeFrameGeo(G.outer, G.inner, G.innerRebated);
    const gt = mm(GASKET_T);
    const gZ = mm(FRAME_DEPTH) / 2 - mm(EXT_DEPTH) - gt / 2;
    const gasketGeo = extrude(shapeWithHole(G.innerRebated, G.gasketInner), gt, gZ);
    return { frameGeo, gasketGeo };
  }, [G]);

  // ── Leaf: frame ring (ext / int halves), contour beads, glass + spacer ──
  const leafData = useMemo(() => {
    if (!G) return null;
    const leafHalf = mm(SASH_DEPTH) / 2;
    const ring = shapeWithHole(G.leaf.outer, G.leaf.inner);
    const ext = extrude(ring, leafHalf, 0);
    const int = extrude(ring, leafHalf, -leafHalf);
    const base = G.leaf.innerBase;
    const strip = (w) => shapeWithHole(contourAt(base, 0, G.tx), contourAt(base, w / mm(1), G.tx));
    const chamfer = [], ovolo = [];
    const layerE = EBD / BEAD_STEPS, layerI = IBD / BEAD_STEPS;
    for (let i = 0; i < BEAD_STEPS; i++) {
      const t = i / (BEAD_STEPS - 1);
      chamfer.push(extrude(strip(CHAMFER_TOP * (1 - t) + EBW * t), layerE, leafHalf - (i + 1) * layerE));
      const ti = (i + 1) / BEAD_STEPS;
      ovolo.push(extrude(strip(EBW * Math.sin(ti * Math.PI / 2)), layerI, -leafHalf + i * layerI));
    }
    const glass = new THREE.ShapeGeometry(toShape(G.leaf.inner), 1);
    const spacer = extrude(shapeWithHole(G.leaf.inner, contourAt(base, 1, G.tx)), GU, -GU / 2);
    return { ext, int, chamfer, ovolo, glass, spacer };
  }, [G]);

  // ── Leaf placement / opening ──
  const leafWm = G ? mm(G.leaf.width) : 0;
  const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(SASH_DEPTH) / 2;
  const clampedOpening = fixedLeaf ? 0 : Math.max(0, Math.min(1, opening));
  const angleRad = THREE.MathUtils.degToRad(clampedOpening * MAX_ANGLE);

  // ── Handle (CasementPanel logic): opposite stile, interior face ──
  const handleDeg = clampedOpening * MAX_ANGLE;
  const handleScale = 0.001;
  const REBATE_HIDDEN = 21;
  const stileCenter = mm(REBATE_HIDDEN + (SASH_RAIL - REBATE_HIDDEN) / 2);
  const intZ = -mm(SASH_DEPTH) / 2 - 0.001;
  const handleY = G ? (G.leaf.height >= 800 ? mm(G.leaf.bottom + 500) : mm(G.leaf.bottom + G.leaf.height / 2)) : 0;
  const handlePos = hingeDirection === 'left'
    ? [leafWm / 2 - stileCenter, handleY, intZ]
    : [-leafWm / 2 + stileCenter, handleY, intZ];
  const handleRot = [0, -Math.PI / 2, 0];

  const leafContent = G && leafData ? (
    <group position={[0, 0, leafZ]}>
      <mesh geometry={leafData.ext} castShadow receiveShadow><primitive object={extMat} attach="material" /></mesh>
      <mesh geometry={leafData.int} castShadow receiveShadow><primitive object={intMat} attach="material" /></mesh>
      {leafData.chamfer.map((g, i) => (
        <mesh key={'ch' + i} geometry={g} castShadow receiveShadow><primitive object={extMat} attach="material" /></mesh>
      ))}
      {leafData.ovolo.map((g, i) => (
        <mesh key={'ov' + i} geometry={g} castShadow receiveShadow><primitive object={intMat} attach="material" /></mesh>
      ))}
      <mesh geometry={leafData.glass} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
      <mesh geometry={leafData.spacer} castShadow receiveShadow><primitive object={spacerMat} attach="material" /></mesh>
      {G.bars.map((b) => (b.kind === 'arc'
        ? <ArcBar key={b.id} bar={b} matExt={extMat} matInt={intMat} spacerMat={spacerMat} />
        : <StraightBar key={b.id} bar={b} profiles={profiles} matExt={extMat} matInt={intMat} spacerMat={spacerMat} glassHalfWidth={G.leaf.xg} />))}
      {!fixedLeaf && (
        <group position={handlePos} rotation={handleRot} scale={[handleScale, handleScale, handleScale]}>
          <WindowCasementHandle
            rotationDeg={hingeDirection === 'left' ? -handleDeg : handleDeg}
            metalColor={handleColors.metalColor}
            lockColor={handleColors.lockColor}
          />
        </group>
      )}
    </group>
  ) : null;

  let leafNode = null;
  if (leafContent) {
    if (clampedOpening === 0) {
      leafNode = leafContent;
    } else if (hingeDirection === 'left') {
      leafNode = (
        <group position={[-leafWm / 2, 0, 0]}>
          <group rotation={[0, -angleRad, 0]}>
            <group position={[leafWm / 2, 0, 0]}>{leafContent}</group>
          </group>
        </group>
      );
    } else {
      leafNode = (
        <group position={[leafWm / 2, 0, 0]}>
          <group rotation={[0, angleRad, 0]}>
            <group position={[-leafWm / 2, 0, 0]}>{leafContent}</group>
          </group>
        </group>
      );
    }
  }

  // ── Sill + guides ──
  const W = mm(width);
  const outerEffH = G ? G.height : height;
  const H = mm(outerEffH);
  const springY = G ? mm(G.springY) : H / 2;
  const sillProj = mm(sillExtension);
  const sillExtra = sillWider ? mm(50) : 0;
  const sillW = W + sillExtra * 2;
  const sillH_size = mm(25);

  return (
    <group>
      {frameData && (
        <group>
          <mesh geometry={frameData.frameGeo.ext} castShadow receiveShadow>
            <primitive object={extMat} attach="material" />
          </mesh>
          <mesh geometry={frameData.frameGeo.int} castShadow receiveShadow>
            <primitive object={intMat} attach="material" />
          </mesh>
          <mesh geometry={frameData.gasketGeo} castShadow receiveShadow>
            <primitive object={gasketMat} attach="material" />
          </mesh>
        </group>
      )}

      {sillExtension > 0 && (
        <mesh position={[0, -H / 2 + sillH_size / 2, halfD + sillProj / 2]} castShadow receiveShadow>
          <boxGeometry args={[sillW, sillH_size, sillProj]} />
          <primitive object={extMat} attach="material" />
        </mesh>
      )}

      {leafNode}

      {showGuides && (
        <group>
          <DimensionGuide from={[-W / 2, H / 2 + mm(80), 0]} to={[W / 2, H / 2 + mm(80), 0]} label={`${width} mm`} offset={[0, 0.05, 0]} />
          <DimensionGuide from={[W / 2 + mm(130), -H / 2, 0]} to={[W / 2 + mm(130), H / 2, 0]} label={`${Math.round(outerEffH)} mm`} offset={[0.07, 0, 0]} />
          {/* v3 0.5: guide texts name what they measure — rise above the springing, arch start from the cill */}
          {G && <DimensionGuide from={[-W / 2 - mm(130), springY, 0]} to={[-W / 2 - mm(130), H / 2, 0]} label={`rise ${Math.round(G.rise)} mm`} offset={[-0.07, 0, 0]} />}
          {G && <DimensionGuide from={[-W / 2 - mm(130), -H / 2, 0]} to={[-W / 2 - mm(130), springY, 0]} label={`start ${Math.round(G.start)} mm`} offset={[-0.07, 0, 0]} />}
        </group>
      )}
    </group>
  );
}

// ── Dimension guide (same as CasementWindow / FixFrameWindow) ──
function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [
    (from[0] + to[0]) / 2 + offset[0],
    (from[1] + to[1]) / 2 + offset[1],
    (from[2] + to[2]) / 2 + offset[2],
  ];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group>
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle"
        outlineColor="#f5f2ec" outlineWidth={0.008}>
        {label}
      </Text>
    </group>
  );
}
