import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import ParametricSashWindow from '../../3d/components/ParametricSashWindow.jsx';
import { windowSpecToConfig } from '../../utils/windowSpecToConfig.js';

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
        <ParametricSashWindow {...config} />
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
