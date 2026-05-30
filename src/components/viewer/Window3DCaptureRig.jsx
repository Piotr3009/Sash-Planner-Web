/**
 * Window3DCaptureRig.jsx
 *
 * Off-screen, fixed-angle 3D capture rig. Renders each window's 3D model into a
 * single hidden WebGL canvas, one at a time, at a FIXED straight-front camera,
 * and captures a PNG (toDataURL). Reusable by:
 *   - 3D Views PDF export (Production Pack)
 *   - Production Book (future)
 *
 * Why a dedicated rig (not the on-screen viewer):
 *   - on-screen viewer uses whatever angle the user left + async Environment(HDR);
 *   - a document needs ONE consistent angle, and must work without the 3D tab open.
 *
 * Why plain lights (no Environment/HDR): the frame/sash materials use near-zero
 * metalness + high roughness, so they render correctly under plain directional +
 * ambient light — deterministic, synchronous, no network/async dependency
 * (works on every machine, which is the whole point of an off-screen export).
 *
 * Capture: single canvas reused for every window (one WebGL context for the whole
 * run, swapping the model via props) to avoid hitting the browser's WebGL context
 * limit on large packs. preserveDrawingBuffer:true lets toDataURL read the frame.
 */
import { useState, useRef, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import ParametricSashWindow from '../../3d/components/ParametricSashWindow.jsx';
import { windowSpecToConfig } from '../../utils/windowSpecToConfig.js';

const FOV = 45;          // vertical field of view (deg)
const MARGIN = 1.35;     // padding around the window in frame
const SETTLE_MS = 350;   // let React commit the model + R3F settle before capture

// Distance so that max(width,height) fits a square canvas at FOV (deg).
function fitDistance(config) {
  const w = (config.width || 1200) / 1000;
  const h = (config.height || 1800) / 1000;
  const half = (Math.max(w, h) * MARGIN) / 2;
  return half / Math.tan(((FOV / 2) * Math.PI) / 180);
}

function CaptureScene({ config, side, onCaptured }) {
  const { gl, scene, camera } = useThree();
  const groupRotation = side === 'interior' ? [0, Math.PI, 0] : [0, 0, 0];

  // Fixed straight-front camera, sized to the current window.
  useLayoutEffect(() => {
    const dist = fitDistance(config);
    camera.position.set(0, 0, dist);
    camera.fov = FOV;
    camera.near = 0.01;
    camera.far = dist * 4 + 10;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [config, camera]);

  // After settle: force a render of the current scene, then read the buffer.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      let url = null;
      try {
        gl.render(scene, camera);
        url = gl.domElement.toDataURL('image/png');
      } catch (e) {
        url = null;
      }
      onCaptured(url);
    }, SETTLE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [config, gl, scene, camera, onCaptured]);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 4, 6]} intensity={1.1} />
      <directionalLight position={[-3, 2, 4]} intensity={0.45} />
      <directionalLight position={[0, -3, 4]} intensity={0.25} />
      <group rotation={groupRotation}>
        <ParametricSashWindow {...config} />
      </group>
    </>
  );
}

/**
 * props:
 *   windows:  [{ id, windowSpec }]
 *   side:     'exterior' | 'interior'   (default 'exterior')
 *   size:     capture pixels (square)   (default 760)
 *   onComplete(results): results = [{ id, url }]  (url may be null on failure)
 */
export default function Window3DCaptureRig({ windows, side = 'exterior', size = 760, onComplete }) {
  const list = useMemo(() => windows || [], [windows]);
  const [idx, setIdx] = useState(0);
  const resultsRef = useRef([]);
  const doneRef = useRef(false);

  const config = useMemo(
    () => (list[idx] ? windowSpecToConfig(list[idx].windowSpec) : null),
    [list, idx]
  );

  const handleCaptured = useCallback((url) => {
    resultsRef.current.push({ id: list[idx]?.id, url });
    if (idx + 1 < list.length) {
      setIdx(idx + 1);
    } else if (!doneRef.current) {
      doneRef.current = true;
      onComplete(resultsRef.current);
    }
  }, [idx, list, onComplete]);

  // Defensive: empty list resolves immediately (parent normally guards this).
  useEffect(() => {
    if (list.length === 0 && !doneRef.current) {
      doneRef.current = true;
      onComplete([]);
    }
  }, [list, onComplete]);

  if (!config) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', left: -99999, top: 0,
        width: size, height: size, opacity: 0,
        pointerEvents: 'none', overflow: 'hidden',
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        dpr={1}
        camera={{ position: [0, 0, 3], fov: FOV }}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <CaptureScene config={config} side={side} onCaptured={handleCaptured} />
      </Canvas>
    </div>
  );
}
