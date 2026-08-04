import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import ParametricSashWindow from '../../3d/components/ParametricSashWindow.jsx';
import CasementWindow from '../../3d/components/casement/CasementWindow.jsx';
import DoorWindow from '../../3d/components/door/DoorWindow.jsx';
import { windowSpecToConfig, windowSpecToCasementProps } from '../../utils/windowSpecToConfig.js';

function Scene({ config, side }) {
  // Exterior = front (+Z camera), Interior = back (-Z camera) achieved by rotating group
  const groupRotation = side === 'interior' ? [0, Math.PI, 0] : [0, 0, 0];

  // Auto-fit camera distance based on window dimensions
  const h = (config.height || 1800) / 1000;
  const cameraZ = Math.max(h * 1.4, 1.8);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-2, 3, -3]} intensity={0.4} />

      <group rotation={groupRotation}>
        {config.windowCategory === 'casement' ? (
          <CasementWindow {...config.casementProps} />
        ) : config.windowCategory === 'door' ? (
          // Layout code mirrors the 3D App: french = 040F, otherwise hinge side.
          <DoorWindow
            width={config.width}
            height={config.height}
            layout={config.doorType === 'french' ? '040F' : (config.doorHinge === 'right' ? '040R' : '040L')}
            opening={0}
            primaryLeaf={config.doorHinge || 'left'}
            openDirection={config.doorOpenDirection || 'outward'}
            doorStyle={config.doorStyle}
            centerMullion={config.centerMullion}
            paneling={config.paneling}
            sidePanels={config.sidePanels}
            sideLeftWidth={config.sideLeftWidth}
            sideRightWidth={config.sideRightWidth}
            sideHBars={config.sideHBars}
            sideVBars={config.sideVBars}
            sideStyle={config.sideStyle}
            transomType={config.transomType}
            transomHeight={config.transomHeight}
            transomBars={config.transomBars}
            thresholdType={config.thresholdType}
            thresholdExtension={config.thresholdExtension}
            hBars={config.doorHBars || 0}
            vBars={config.doorVBars || 0}
            woodColor={config.woodColor}
            woodColorExt={config.woodColorExt}
            woodColorInt={config.woodColorInt}
            sameColor={config.sameColor}
            glassType={config.glassType}
            spacerColor={config.spacerColor}
            glassFinish={config.glassFinish}
            sillExtension={config.sillExtension || 0}
            sillWider={config.sillWider || false}
            sealColour={config.sealColour || 'black'}
            showGuides={false}
          />
        ) : (
          <ParametricSashWindow {...config} />
        )}
      </group>

      <ContactShadows
        position={[0, -h / 2 - 0.05, 0]}
        opacity={0.35}
        scale={3}
        blur={2.5}
        far={2}
      />
      <Environment preset="city" />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={0.5}
        maxDistance={cameraZ * 3}
        target={[0, 0.1, 0]}
      />
    </>
  );
}

export default function WindowPreview3D({ windowSpec, side }) {
  if (!windowSpec) {
    return (
      <div className="grid place-items-center h-full text-ink-400">
        No window data.
      </div>
    );
  }

  // Convert Planner windowSpec → ParametricSashWindow props
  const config = useMemo(() => windowSpecToConfig(windowSpec), [windowSpec]);

  // Camera position based on window size
  const h = (config.height || 1800) / 1000;
  const cameraZ = Math.max(h * 1.4, 1.8);

  return (
    <Suspense
      fallback={
        <div className="grid place-items-center h-full text-ink-400 text-sm">
          Loading 3D…
        </div>
      }
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.2, cameraZ], fov: 45 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene config={config} side={side} />
      </Canvas>
    </Suspense>
  );
}
