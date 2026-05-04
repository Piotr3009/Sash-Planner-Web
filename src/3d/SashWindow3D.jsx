import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, PerspectiveCamera, Environment } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { CONSTANTS, deriveWindowData } from '../engine/calculations.js';

/**
 * Slim parametric sash-window 3D viewer.
 *
 * The full Prime-Sash-Windows parametric component (`ParametricSashWindow.jsx`,
 * ~124k chars) supports every configurator option (RAL colours, ironmongery,
 * profile beads, horns shape variants, casement/door variants, etc). For
 * production planning we don't need that fidelity — we need accurate frame /
 * sash / glazing-bar geometry that reflects the dimensions used in calculations.
 * This component does that with primitive boxes scaled from CONSTANTS so it
 * matches what the 2D drawing and cut list show.
 */

const mm = (x) => x / 1000;

function woodMaterial(color) {
  return <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />;
}

function glassMaterial() {
  return (
    <meshPhysicalMaterial
      color="#cfe9ff"
      roughness={0.05}
      metalness={0}
      transmission={0.85}
      thickness={0.02}
      transparent
      opacity={0.55}
      side={THREE.DoubleSide}
    />
  );
}

function Box({ size, position, color = '#f6f4ee', children }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      {children || woodMaterial(color)}
    </mesh>
  );
}

function GlazingBars({ rows, cols, glassW, glassH, depth, y, color }) {
  const barW = mm(CONSTANTS.GLAZING_BAR_WIDTH);
  const verts = [];
  const horiz = [];
  for (let i = 1; i < cols; i += 1) {
    const x = -glassW / 2 + (glassW * i) / cols;
    verts.push(<Box key={`v${i}`} size={[barW, glassH, depth]} position={[x, y, 0]} color={color} />);
  }
  for (let j = 1; j < rows; j += 1) {
    const yy = y - glassH / 2 + (glassH * j) / rows;
    horiz.push(<Box key={`h${j}`} size={[glassW, barW, depth]} position={[0, yy, 0]} color={color} />);
  }
  return (
    <>
      {verts}
      {horiz}
    </>
  );
}

function SashAssembly({ width, height, yCenter, woodColor, rows, cols, isBottom = false }) {
  const stileW = mm(CONSTANTS.STILE_WIDTH);
  const topRailH = mm(CONSTANTS.TOP_RAIL_WIDTH);
  const meetRailH = mm(CONSTANTS.MEETING_RAIL_WIDTH);
  const botRailH = mm(CONSTANTS.BOTTOM_RAIL_WIDTH);
  const sashDepth = mm(57);

  // Top sash uses (top rail + meeting rail). Bottom sash uses (meeting + bottom rail).
  const upperRailH = isBottom ? meetRailH : topRailH;
  const lowerRailH = isBottom ? botRailH : meetRailH;

  const sashW = width;
  const sashH = height;
  const halfW = sashW / 2;
  const halfH = sashH / 2;

  const glassW = sashW - 2 * stileW;
  const glassH = sashH - upperRailH - lowerRailH;
  const glassY = yCenter + (lowerRailH - upperRailH) / 2;

  return (
    <group>
      {/* Stiles */}
      <Box size={[stileW, sashH, sashDepth]} position={[-halfW + stileW / 2, yCenter, 0]} color={woodColor} />
      <Box size={[stileW, sashH, sashDepth]} position={[halfW - stileW / 2, yCenter, 0]} color={woodColor} />
      {/* Top rail of this sash */}
      <Box
        size={[sashW - 2 * stileW, upperRailH, sashDepth]}
        position={[0, yCenter + halfH - upperRailH / 2, 0]}
        color={woodColor}
      />
      {/* Bottom rail of this sash */}
      <Box
        size={[sashW - 2 * stileW, lowerRailH, sashDepth]}
        position={[0, yCenter - halfH + lowerRailH / 2, 0]}
        color={woodColor}
      />
      {/* Glass plane */}
      <mesh position={[0, glassY, 0]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[glassW, glassH, sashDepth * 0.4]} />
        {glassMaterial()}
      </mesh>
      {/* Glazing bars */}
      <GlazingBars rows={rows} cols={cols} glassW={glassW} glassH={glassH} depth={sashDepth * 0.5} y={glassY} color={woodColor} />
    </group>
  );
}

function FrameAssembly({ width, height, woodColor }) {
  const jambW = mm(CONSTANTS.JAMBS_WIDTH);
  const headW = mm(CONSTANTS.HEAD_WIDTH);
  const sillW = mm(CONSTANTS.SILL_WIDTH);
  const frameDepth = mm(141);

  const halfW = width / 2;
  const halfH = height / 2;

  return (
    <group>
      {/* Head */}
      <Box size={[width, headW, frameDepth]} position={[0, halfH - headW / 2, 0]} color={woodColor} />
      {/* Sill */}
      <Box size={[width, sillW, frameDepth]} position={[0, -halfH + sillW / 2, 0]} color={woodColor} />
      {/* Jambs */}
      <Box size={[jambW, height, frameDepth]} position={[-halfW + jambW / 2, 0, 0]} color={woodColor} />
      <Box size={[jambW, height, frameDepth]} position={[halfW - jambW / 2, 0, 0]} color={woodColor} />
    </group>
  );
}

function WindowMesh({ windowSpec }) {
  const data = useMemo(() => {
    try {
      return deriveWindowData(windowSpec);
    } catch (e) {
      console.warn('3D derive failed, using fallback:', e);
      return null;
    }
  }, [windowSpec]);

  const frameW = mm(Number(windowSpec.frame.width));
  const frameH = mm(Number(windowSpec.frame.height));
  const sashW = mm(data?.sashWidth ?? Number(windowSpec.frame.width) - CONSTANTS.SASH_WIDTH_DEDUCTION);
  const topSashH = mm(data?.topSashHeight ?? (Number(windowSpec.frame.height) - CONSTANTS.SASH_HEIGHT_DEDUCTION) / 2);
  const botSashH = mm(data?.bottomSashHeight ?? (Number(windowSpec.frame.height) - CONSTANTS.SASH_HEIGHT_DEDUCTION) / 2);

  const woodColor = colorFromSpec(windowSpec);
  const grid = data?.config || { rows: 2, cols: 2 };

  // Vertical layout: top sash sits above meeting line, bottom sash below
  const innerH = frameH - mm(CONSTANTS.HEAD_WIDTH) - mm(CONSTANTS.SILL_WIDTH);
  const innerCenterY = (mm(CONSTANTS.SILL_WIDTH) - mm(CONSTANTS.HEAD_WIDTH)) / 2;
  const meetY = innerCenterY + (topSashH - botSashH) / 2 - topSashH / 2 + topSashH;
  const topY = meetY + topSashH / 2;
  const botY = meetY - botSashH / 2;

  return (
    <group position={[0, 0, 0]}>
      <FrameAssembly width={frameW} height={frameH} woodColor={woodColor} />
      <SashAssembly width={sashW} height={topSashH} yCenter={topY} woodColor={woodColor} rows={grid.rows} cols={grid.cols} />
      <SashAssembly width={sashW} height={botSashH} yCenter={botY} woodColor={woodColor} rows={grid.rows} cols={grid.cols} isBottom />
    </group>
  );
}

const NAMED_COLORS = {
  white: '#f4f1ea',
  cream: '#ece2cf',
  sage: '#9bab8a',
  green: '#586753',
  black: '#1d1d1b',
  heritage: '#dcd0b6',
  grey: '#7a7d77'
};

function colorFromSpec(spec) {
  const name = (spec?.color?.outside || spec?.color?.single || 'white').toString().toLowerCase();
  for (const key of Object.keys(NAMED_COLORS)) {
    if (name.includes(key)) return NAMED_COLORS[key];
  }
  // hex passthrough
  if (/^#[0-9a-f]{6}$/i.test(name)) return name;
  return NAMED_COLORS.white;
}

export default function SashWindow3D({ windowSpec, side = 'exterior' }) {
  if (!windowSpec) return null;

  // Camera position differs slightly between exterior/interior view
  const camZ = side === 'interior' ? -2.4 : 2.4;
  const groupRotationY = side === 'interior' ? Math.PI : 0;

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
      <PerspectiveCamera makeDefault position={[0.6, 0.4, camZ]} fov={42} />
      <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4} target={[0, 0, 0]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-2, 2, -1]} intensity={0.4} color="#dde6f5" />
      <Environment preset="city" />
      <group rotation={[0, groupRotationY, 0]}>
        <WindowMesh windowSpec={windowSpec} />
      </group>
      <ContactShadows position={[0, -1.05, 0]} opacity={0.45} scale={4} blur={2.2} far={2.5} />
    </Canvas>
  );
}
