import React from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, ContactShadows, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RAL_LOOKUP as RAL_COLORS, RAL_GROUPS, FB_GROUPS, SWATCHES } from '../config.js';
import ParametricSashWindow from './components/ParametricSashWindow';
import CasementWindow from './components/casement/CasementWindow';
import ArchedCasementWindow from './components/casement/ArchedCasementWindow';
import FixFrameWindow from './components/fix-frame/FixFrameWindow';
import DoorWindow from './components/door/DoorWindow';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Auto-fit camera distance to window dimensions (view frustum math)
function fitDistance(widthMm, heightMm, fovDeg = 45, aspect = 1.78, margin = 1.75) {
  if (!widthMm || !heightMm) return 2.2; // fallback (approx. current default)
  const W = widthMm / 1000;
  const H = heightMm / 1000;
  const fov = (fovDeg * Math.PI) / 180;
  const distH = (H / 2) / Math.tan(fov / 2);
  const distW = (W / 2) / (Math.tan(fov / 2) * aspect);
  return Math.max(distH, distW) * margin;
}

// Auto-zoom camera when window dimensions change (keeps angle, only adjusts distance)
function AutoZoom({ width, height }) {
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls);

  useEffect(() => {
    if (!width || !height) return;
    const aspect = camera.aspect || 1.78;
    const dist = fitDistance(width, height, camera.fov, aspect);

    const target = new THREE.Vector3(0, 0.18, 0);
    const direction = new THREE.Vector3().subVectors(camera.position, target);

    if (direction.lengthSq() < 0.001) {
      direction.set(1.4, 0.52, 1.6);
    }
    direction.normalize();

    camera.position.copy(target).addScaledVector(direction, dist);
    camera.updateProjectionMatrix();

    if (controls && controls.update) controls.update();
  }, [width, height, camera, controls]);

  return null;
}

function Slider({ label, value, min, max, step, suffix = ' mm', onChange }) {
  return (
    <label className="control">
      <div className="control__row">
        <span>{label}</span>
        <strong>{Math.round(value)}{suffix}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <button type="button" className={checked ? 'switch switch--on' : 'switch'} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}


function RalInput({ onColor }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  const apply = () => {
    const key = val.trim().replace(/^ral\s*/i, '');
    const hex = RAL_COLORS[key];
    if (hex) {
      onColor(hex);
      setErr('');
    } else {
      setErr('Unknown RAL');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="e.g. 7016"
        value={val}
        onChange={(e) => { setVal(e.target.value); setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.2)' }}
      />
      <button onClick={apply} style={{ padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
      {err && <span style={{ color: 'red', fontSize: '11px' }}>{err}</span>}
    </div>
  );
}

function ColorPicker({ label, value, onChange, inputId }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: value, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px' }}>
        {SWATCHES.map(({ name, hex }) => (
          <div key={hex} onClick={() => onChange(hex)} title={name}
            style={{ backgroundColor: hex, borderRadius: '6px', aspectRatio: '1', cursor: 'pointer',
              border: value === hex ? '3px solid #1A3060' : '2px solid rgba(0,0,0,0.12)', boxSizing: 'border-box' }}
          />
        ))}
        <div onClick={() => document.getElementById(inputId).click()} title="Custom"
          style={{ borderRadius: '6px', aspectRatio: '1', cursor: 'pointer',
            border: '2px dashed rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px', color: 'rgba(0,0,0,0.4)', boxSizing: 'border-box' }}>+</div>
        <input id={inputId} type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      </div>
      <label className="select-wrap">
        <span>RAL</span>
        <select value="" onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">— RAL —</option>
          {RAL_GROUPS.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
        </select>
      </label>
      <label className="select-wrap">
        <span>Farrow &amp; Ball</span>
        <select value="" onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">— F&amp;B —</option>
          {FB_GROUPS.map(g => <optgroup key={g.g} label={g.g}>{g.o.map(([hex, lab]) => <option key={hex} value={hex}>{lab}</option>)}</optgroup>)}
        </select>
      </label>
      <label className="control">
        <div className="control__row"><span>RAL number</span></div>
        <RalInput onColor={onChange} />
      </label>
    </div>
  );
}

function WallBackground() {
  const texture = useMemo(() => {
    const size = 512; // was 1024 — reduced for GPU memory (4× less)
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Gradient od ciemnego góra/boki do jasnego centrum
    const grad = ctx.createRadialGradient(size*0.55, size*0.4, 0, size*0.55, size*0.4, size * 0.85);
    grad.addColorStop(0,   '#d4d4d4');
    grad.addColorStop(0.55,'#b4b4b4');
    grad.addColorStop(1.0, '#787878');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Tynk — drobny pył, inny niż microcement (count scaled with area)
    for (let i = 0; i < 25000; i++) { // was 100000 — proportional to 4× smaller area
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 0.6;
      const v = Math.floor(150 + Math.random() * 80);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.06})`;
      ctx.fill();
    }
    // Poziome smugi tynku (count scaled)
    for (let i = 0; i < 15; i++) { // was 60
      const y = Math.random() * size;
      ctx.strokeStyle = `rgba(160,160,160,${Math.random() * 0.04})`;
      ctx.lineWidth = Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (Math.random()-0.5)*20);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <mesh position={[0, 0.5, -2.5]} rotation={[0, 0, 0]}>
      <planeGeometry args={[12, 10]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function MicrocementFloor() {
  const { colorMap, roughnessMap } = useMemo(() => {
    const size = 512; // was 1024 — reduced for GPU memory (4× less)

    // Color map — jasny szary z subtelnym grain
    const cCanvas = document.createElement('canvas');
    cCanvas.width = size; cCanvas.height = size;
    const cCtx = cCanvas.getContext('2d');
    cCtx.fillStyle = '#cccccc';
    cCtx.fillRect(0, 0, size, size);

    // Microcement grain — count scaled with area
    for (let i = 0; i < 30000; i++) { // was 120000 — proportional to 4× smaller area
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.8;
      const v = Math.floor(180 + Math.random() * 50);
      const a = Math.random() * 0.22;
      cCtx.beginPath();
      cCtx.arc(x, y, r, 0, Math.PI * 2);
      cCtx.fillStyle = `rgba(${v},${v},${v},${a})`;
      cCtx.fill();
    }
    // Subtelne smugi (count scaled)
    for (let i = 0; i < 38; i++) { // was 150
      const x1 = Math.random() * size;
      const y1 = Math.random() * size;
      const x2 = x1 + (Math.random() - 0.5) * 200;
      const y2 = y1 + (Math.random() - 0.5) * 200;
      const a = Math.random() * 0.08;
      cCtx.strokeStyle = `rgba(140,140,140,${a})`;
      cCtx.lineWidth = Math.random() * 2;
      cCtx.beginPath();
      cCtx.moveTo(x1, y1);
      cCtx.lineTo(x2, y2);
      cCtx.stroke();
    }
    const colorMap = new THREE.CanvasTexture(cCanvas);
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(4, 4);

    // Roughness map
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 512; rCanvas.height = 512;
    const rCtx = rCanvas.getContext('2d');
    rCtx.fillStyle = '#666666';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const v = Math.floor(80 + Math.random() * 60);
      rCtx.beginPath();
      rCtx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
      rCtx.fillStyle = `rgb(${v},${v},${v})`;
      rCtx.fill();
    }
    const roughnessMap = new THREE.CanvasTexture(rCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(4, 4);

    return { colorMap, roughnessMap };
  }, []);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        map={colorMap}
        roughnessMap={roughnessMap}
        roughness={1.0}
        metalness={0.0}
        color="#c8c8c8"
      />
    </mesh>
  );
}



function ScreenshotHelper({ config }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    window.captureWindowScreenshots = async () => {
      return new Promise((resolve) => {
        const target = new THREE.Vector3(0, 0.18, 0);
        // Timber doors: exterior view + closer; windows: interior view
        const isDoor = config?.windowCategory === 'door';
        const distMult = isDoor ? 0.62 : 0.75;
        const distance = fitDistance(config?.width, config?.height, 45, 1) * distMult;

        // Save current camera state
        const savedPos = camera.position.clone();
        const savedTarget = target.clone();

        const resize = (dataUrl, maxW, maxH) => {
          return new Promise((res) => {
            const img = new Image();
            img.onload = () => {
              const scale = Math.min(maxW / img.width, maxH / img.height, 1);
              const c = document.createElement('canvas');
              c.width = Math.round(img.width * scale);
              c.height = Math.round(img.height * scale);
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
              res(c.toDataURL('image/jpeg', 0.75));
            };
            img.src = dataUrl;
          });
        };

        const capture = (pos) => {
          // Set grey background for clean screenshot
          const oldBg = scene.background;
          scene.background = new THREE.Color(0xe8e8e8);
          
          // Hide wall, floor, shadows, and dimension guides
          const hidden = [];
          scene.traverse((obj) => {
            if (!obj.visible) return;
            // Hide large background planes (wall, floor)
            if (obj.isMesh && obj.geometry) {
              const params = obj.geometry.parameters;
              if (params && (params.width > 5 || params.height > 5)) {
                obj.visible = false;
                hidden.push(obj);
                return;
              }
            }
            // Hide Text (dimension labels) and Line (dimension lines)
            if (obj.type === 'Line2' || obj.type === 'Line' || 
                (obj.isMesh && obj.geometry?.type === 'TextGeometry') ||
                (obj.material?.uniforms?.map)) {
              obj.visible = false;
              hidden.push(obj);
            }
          });
          
          camera.position.copy(pos);
          camera.lookAt(target);
          camera.updateProjectionMatrix();
          gl.render(scene, camera);
          const dataUrl = gl.domElement.toDataURL('image/jpeg', 0.85);
          
          // Restore
          scene.background = oldBg;
          hidden.forEach(obj => obj.visible = true);
          return dataUrl;
        };

        // Doors: exterior view (+Z); Windows: interior view (-Z); slight 8° angle for depth
        const angleRad = 8 * Math.PI / 180;
        const zSign = isDoor ? 1 : -1;
        const xSign = isDoor ? 1 : -1;
        const backPos = new THREE.Vector3(xSign * Math.sin(angleRad) * distance, 0.22, zSign * Math.cos(angleRad) * distance);
        const backRaw = capture(backPos);

        // Restore camera
        camera.position.copy(savedPos);
        camera.lookAt(savedTarget);
        camera.updateProjectionMatrix();
        gl.render(scene, camera);

        // Resize to max 600px for storage efficiency
        resize(backRaw, 600, 600).then((interior) => {
          resolve({ interior });
        });
      });
    };

    return () => { delete window.captureWindowScreenshots; };
  }, [gl, scene, camera, config?.width, config?.height, config?.windowCategory]);

  return null;
}

function Scene({ config, isMobile }) {
  const [hovered, setHovered] = useState(false);
  const b = config.brightness ?? 1.0;

  const pedestalScale = useMemo(() => {
    const maxDimension = Math.max(config.width, config.height) / 1000;
    return clamp(maxDimension * 0.9, 1.2, 3.2);
  }, [config.width, config.height]);

  return (
    <>

      <PerspectiveCamera makeDefault position={[1.4, 0.7, 1.6]} fov={45} />

      <AutoZoom width={config.width} height={config.height} />

      {/* Ambient */}
      <ambientLight intensity={0.56 * b} />

      {/* Hemisphere */}
      <hemisphereLight args={['#fdf6e8', '#c8c0b0', 0.72 * b]} />

      {/* Główne słońce */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.12 * b}
        castShadow={!isMobile}
        shadow-mapSize-width={isMobile ? 512 : 1024}
        shadow-mapSize-height={isMobile ? 512 : 1024}
        shadow-bias={-0.0001}
      />

      {/* Fill boki — symetrycznie przód i tył */}
      <directionalLight position={[-3, 2,  3]} intensity={0.6 * b} />
      <directionalLight position={[-3, 2, -3]} intensity={0.6 * b} />
      <directionalLight position={[ 3, 2,  3]} intensity={0.56 * b} />
      <directionalLight position={[ 3, 2, -3]} intensity={0.56 * b} />

      {/* Fill z dołu pod 45° — obydwie strony */}
      <directionalLight position={[-2, -2,  2]} intensity={0.25 * b} color="#e8d8c0" />
      <directionalLight position={[ 2, -2, -2]} intensity={0.25 * b} color="#e8d8c0" />

      {/* Point lights — przód */}
      <pointLight position={[ 0.5, 0.5,  1.2]} intensity={0.98 * b} distance={6} decay={2} color="#fff8f0" />
      <pointLight position={[-0.5, 0,    1.2]} intensity={0.98 * b} distance={6} decay={2} color="#fff4e8" />

      {/* Point lights — tył */}
      <pointLight position={[ 0.5, 0,   -1.5]} intensity={0.98 * b} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[-0.5, 0,   -1.5]} intensity={0.98 * b} distance={6} decay={2} color="#f0f4ff" />

      {/* Point lights — boki tył po skosie */}
      <pointLight position={[ 1.5, 0.5, -1.5]} intensity={0.70 * b} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[-1.5, 0.5, -1.5]} intensity={0.70 * b} distance={6} decay={2} color="#f0f4ff" />

      {/* Point lights — boki przód po skosie */}
      <pointLight position={[ 1.5, 0.5,  1.2]} intensity={0.70 * b} distance={6} decay={2} color="#fff8f0" />
      <pointLight position={[-1.5, 0.5,  1.2]} intensity={0.70 * b} distance={6} decay={2} color="#fff8f0" />

      {/* Dedykowane światła na finger lift — z tyłu okna */}
      <pointLight position={[ 0.4, -0.3, -2.0]} intensity={0.96 * b} distance={3} decay={2} color="#f0f4ff" />
      <pointLight position={[-0.4, -0.3, -2.0]} intensity={0.96 * b} distance={3} decay={2} color="#f0f4ff" />

      <group position={[0, 0.18, 0]}>
          <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
            {config.windowCategory === 'casement' && config.casementType === 'arched' ? (
              <ArchedCasementWindow
                width={config.extWidth}
                height={config.extHeight}
                archShape={config.casArchShape || 'semi-circle'}
                hingeDirection={config.casArchHinge || 'left'}
                opening={config.casementOpening || 0}
                woodColor={config.woodColor}
                woodColorExt={config.woodColorExt}
                woodColorInt={config.woodColorInt}
                sameColor={config.sameColor}
                spacerColor={config.spacerColor}
                glassFinish={config.glassFinish || 'clear'}
                hBars={config.casementHBars || 0}
                vBars={config.casementVBars || 0}
                showGuides={config.showGuides}
                brightness={config.brightness}
                ironmongery={config.ironmongery}
                sealColour={config.sealColour || 'black'}
                sillExtension={config.sillExtension || 0}
                sillWider={config.sillWider || false}
                fixSemiBarPattern={config.fixSemiBarPattern || 'none'}
                fixGothicBars={config.fixGothicBars || 'none'}
              />
            ) : config.windowCategory === 'casement' ? (
              <CasementWindow
                width={config.extWidth}
                height={config.extHeight}
                layout={config.casementLayout}
                opening={config.casementOpening || 0}
                fanlightRatio={config.fanlightRatio || 0.3}
                woodColor={config.woodColor}
                woodColorExt={config.woodColorExt}
                woodColorInt={config.woodColorInt}
                sameColor={config.sameColor}
                glassType={config.doubleGlazing ? 'double' : 'triple'}
                spacerColor={config.spacerColor}
                glassFinish={config.glassFinish || 'clear'}
                trickleVent={config.trickleVent || 'none'}
                trickleColour={config.trickleColour || 'white'}
                sillExtension={config.sillExtension || 0}
                sillWider={config.sillWider || false}
                sealColour={config.sealColour || 'black'}
                showGuides={config.showGuides}
                brightness={config.brightness}
                hBars={config.casementHBars || 0}
                vBars={config.casementVBars || 0}
                ironmongery={config.ironmongery}
              />
            ) : config.windowCategory === 'fix-only' ? (
              <FixFrameWindow
                width={config.extWidth}
                height={config.extHeight}
                woodColor={config.woodColor}
                woodColorExt={config.woodColorExt}
                woodColorInt={config.woodColorInt}
                sameColor={config.sameColor}
                spacerColor={config.spacerColor}
                glassFinish={config.glassFinish || 'clear'}
                hBars={config.casementHBars || 0}
                vBars={config.casementVBars || 0}
                showGuides={config.showGuides}
                fixShape={config.fixShape || 'rectangle'}
                fixType={config.fixType || 'standard'}
                fixArchRise={config.fixArchRise || 0}
                fixGothicBars={config.fixGothicBars || 'none'}
                fixCircleBarPattern={config.fixCircleBarPattern || 'none'}
                fixCircleBarOffset={config.fixCircleBarOffset || 200}
                fixSemiBarPattern={config.fixSemiBarPattern || 'none'}
              />
            ) : config.windowCategory === 'door' ? (
              <DoorWindow
                width={config.extWidth}
                height={config.extHeight}
                layout={config.doorType === 'sliding' ? ('0' + config.panelCount + '0S') : config.doorType === 'bifold' ? ('0' + config.panelCount + '0B') : config.doorType === 'french' ? '040F' : (config.doorHinge === 'right' ? '040R' : '040L')}
                opening={config.doorOpening || 0}
                primaryLeaf={config.doorHinge || 'left'}
                openDirection={config.doorOpenDirection || 'outward'}
                panelCount={config.panelCount || 2}
                slideDirection={config.slideDirection || 'left-to-right'}
                slidingFrameDepth={config.frameDepth || 93}
                slidingPanelDepth={config.panelDepth || 57}
                foldDirection={config.foldDirection || 'left'}
                trafficDoor={config.trafficDoor || 'no'}
                bifoldOpenDirection={config.bifoldOpenDirection || 'outward'}
                doorStyle={config.doorStyle}
                centerMullion={config.centerMullion}
                paneling={config.paneling}
                sidePanels={config.sidePanels}
                sideLeftWidth={config.sideLeftWidth}
                sideRightWidth={config.sideRightWidth}
                sideHBars={config.sideHBars}
                sideVBars={config.sideVBars}
                sideStyle={config.sideStyle}
                thresholdType={config.thresholdType}
                thresholdExtension={config.thresholdExtension}
                woodColor={config.woodColor}
                woodColorExt={config.woodColorExt}
                woodColorInt={config.woodColorInt}
                sameColor={config.sameColor}
                glassType={config.doubleGlazing ? 'double' : 'triple'}
                spacerColor={config.spacerColor}
                glassFinish={config.glassFinish || 'clear'}
                showGuides={config.showGuides}
                brightness={config.brightness}
                hBars={config.doorHBars || 0}
                vBars={config.doorVBars || 0}
                ironmongery={config.ironmongery}
                sillExtension={config.sillExtension || 0}
                sillWider={config.sillWider || false}
                sealColour={config.sealColour || 'black'}
                trickleVent={config.trickleVent || 'none'}
                trickleColour={config.trickleColour || 'white'}
              />
            ) : (
              <ParametricSashWindow {...config} />
            )}
          </group>
      </group>

      <WallBackground />
      <MicrocementFloor />

      {!isMobile && <ContactShadows position={[0, -1.215, 0]} opacity={0.55} blur={2.5} far={3.5} scale={6} />}

      <OrbitControls
        makeDefault
        target={[0, 0.18, 0]}
        enablePan={true}
        screenSpacePanning={true}
        minDistance={0.5}
        maxDistance={10}
        zoomSpeed={1.2}
        panSpeed={1.0}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        autoRotate={config.autoRotate}
        autoRotateSpeed={0.45}
      />

      <ScreenshotHelper config={config} />


    </>
  );
}

export default function App() {
  const isMobile = useMemo(() => {
    return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || 
           (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
  }, []);

  const [extWidth, setExtWidth] = useState(1000);
  const [extHeight, setExtHeight] = useState(1500);
  const width = extWidth - 104;
  const height = extHeight - 87;
  const [opening, setOpening] = useState(0);
  const [upperOpening, setUpperOpening] = useState(0);
  const [openingType, setOpeningType] = useState('both');
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showHorns, setShowHorns] = useState(true);
  const [brightness, setBrightness] = useState(1.0);
  const [hornType, setHornType] = useState('A');
  const [ironmongery, setIronmongery] = useState('brass');
  const [upperGlass, setUpperGlass] = useState('clear');
  const [lowerGlass, setLowerGlass] = useState('clear');
  const doubleGlazing = true;
  const [spacerColor, setSpacerColor] = useState('silver');
  const [boxType, setBoxType] = useState('standard');
  const [boxDepthOverride, setBoxDepthOverride] = useState(null);
  const [woodColor, setWoodColor] = useState('#F6F6F6');
  const [woodColorExt, setWoodColorExt] = useState('#F6F6F6');
  const [woodColorInt, setWoodColorInt] = useState('#F6F6F6');
  const [sameColor, setSameColor] = useState(true);

  const setColor = (hex) => {
    setWoodColor(hex);
    if (sameColor) { setWoodColorExt(hex); setWoodColorInt(hex); }
  };
  const setColorExt = (hex) => { setWoodColorExt(hex); };
  const setColorInt = (hex) => { setWoodColorInt(hex); };
  const [upperBars, setUpperBars] = useState('none');
  const [lowerBars, setLowerBars] = useState('none');
  const [sameBars, setSameBars] = useState(true);
  const [upperCustomBars, setUpperCustomBars] = useState([]);
  const [lowerCustomBars, setLowerCustomBars] = useState([]);
  const [sashType, setSashType] = useState('double');
  const [splitRatio, setSplitRatio] = useState('1/4-1/2-1/4');
  const [headType, setHeadType] = useState('flat');
  const [fixUpperBars, setFixUpperBars] = useState('none');
  const [fixLowerBars, setFixLowerBars] = useState('none');
  const [fixUpperCustomBars, setFixUpperCustomBars] = useState([]);
  const [fixLowerCustomBars, setFixLowerCustomBars] = useState([]);

  // ─── Casement state ───
  const [windowCategory, setWindowCategory] = useState('sash'); // 'sash' | 'casement' | 'doors' | ...
  const [casementLayout, setCasementLayout] = useState('040L');
  const [casementOpening, setCasementOpening] = useState(0);
  const [casementType, setCasementType] = useState('standard'); // standard / arched
  const [casArchShape, setCasArchShape] = useState('semi-circle');
  const [casArchHinge, setCasArchHinge] = useState('right');
  const [fanlightRatio, setFanlightRatio] = useState(0.3);
  const [casementHBars, setCasementHBars] = useState(0);
  const [casementVBars, setCasementVBars] = useState(0);
  const [glassFinish, setGlassFinish] = useState('clear');
  const [trickleVent, setTrickleVent] = useState('none');
  const [trickleColour, setTrickleColour] = useState('white');
  const [sillExtension, setSillExtension] = useState(0);
  const [sillWider, setSillWider] = useState(false);
  const [sealColour, setSealColour] = useState('black');
  const [fixShape, setFixShape] = useState('rectangle');
  const [fixType, setFixType] = useState('standard');
  const [fixArchRise, setFixArchRise] = useState(0);
  const [fixGothicBars, setFixGothicBars] = useState('none');
  const [fixCircleBarPattern, setFixCircleBarPattern] = useState('none');
  const [fixCircleBarOffset, setFixCircleBarOffset] = useState(200);
  const [fixSemiBarPattern, setFixSemiBarPattern] = useState('none');

  // ─── Door state ───
  const [doorType, setDoorType] = useState('single-external');
  const [doorShape, setDoorShape] = useState('standard');
  const [doorStyle, setDoorStyle] = useState('full-glass');
  const [doorHinge, setDoorHinge] = useState('left');
  const [doorHBars, setDoorHBars] = useState(0);
  const [doorVBars, setDoorVBars] = useState(0);
  const [centerMullion, setCenterMullion] = useState(false);
  const [paneling, setPaneling] = useState('flat');
  const [sidePanels, setSidePanels] = useState('none');
  const [sideLeftWidth, setSideLeftWidth] = useState(500);
  const [sideRightWidth, setSideRightWidth] = useState(500);
  const [sideHBars, setSideHBars] = useState(0);
  const [sideVBars, setSideVBars] = useState(0);
  const [sideStyle, setSideStyle] = useState('full-glass');
  const [thresholdType, setThresholdType] = useState('standard');
  const [thresholdExtension, setThresholdExtension] = useState(0);
  const [doorOpening, setDoorOpening] = useState(0);
  const [doorOpenDirection, setDoorOpenDirection] = useState('outward');
  // Sliding door state
  const [panelCount, setPanelCount] = useState(2);
  const [slideDirection, setSlideDirection] = useState('left-behind-right');
  const [extraWidth, setExtraWidth] = useState(false);
  const [foldDirection, setFoldDirection] = useState('left');
  const [trafficDoor, setTrafficDoor] = useState('no');
  const [bifoldOpenDirection, setBifoldOpenDirection] = useState('outward');
  const [glassWidth, setGlassWidth] = useState(0);
  const [panelDepth, setPanelDepth] = useState(57);
  const [frameDepth, setFrameDepth] = useState(93);

  // ─── State bucket system — isolates state per window type ───
  const categoryRef = useRef('sash');
  const buckets = useRef({});

  const BUCKET_DEFAULTS = {
    sash: { extWidth: 1000, extHeight: 1500, woodColor: '#F6F6F6', woodColorExt: '#F6F6F6', woodColorInt: '#F6F6F6', sameColor: true, spacerColor: 'silver', opening: 0, upperOpening: 0, openingType: 'both', boxType: 'standard', showHorns: true, hornType: 'A', ironmongery: 'brass', upperGlass: 'clear', lowerGlass: 'clear', upperBars: 'none', lowerBars: 'none', sameBars: true, upperCustomBars: [], lowerCustomBars: [], sashType: 'double', splitRatio: '1/4-1/2-1/4', headType: 'flat', fixUpperBars: 'none', fixLowerBars: 'none', fixUpperCustomBars: [], fixLowerCustomBars: [], casementLayout: '040L', casementOpening: 0, fanlightRatio: 0.3, casementHBars: 0, casementVBars: 0 },
    casement: { extWidth: 800, extHeight: 1500, glassFinish: 'clear', trickleVent: 'none', trickleColour: 'white', sillExtension: 0, sillWider: false, sealColour: 'black', woodColor: '#F6F6F6', woodColorExt: '#F6F6F6', woodColorInt: '#F6F6F6', sameColor: true, spacerColor: 'silver', opening: 0, upperOpening: 0, openingType: 'both', boxType: 'standard', showHorns: false, hornType: 'A', ironmongery: 'brass', upperGlass: 'clear', lowerGlass: 'clear', upperBars: 'none', lowerBars: 'none', sameBars: true, upperCustomBars: [], lowerCustomBars: [], sashType: 'double', splitRatio: '1/4-1/2-1/4', headType: 'flat', fixUpperBars: 'none', fixLowerBars: 'none', fixUpperCustomBars: [], fixLowerCustomBars: [], casementLayout: '040L', casementOpening: 0, fanlightRatio: 0.3, casementHBars: 0, casementVBars: 0 },
    'fix-only': { extWidth: 1000, extHeight: 1500, glassFinish: 'clear', woodColor: '#F6F6F6', woodColorExt: '#F6F6F6', woodColorInt: '#F6F6F6', sameColor: true, spacerColor: 'silver', opening: 0, upperOpening: 0, openingType: 'fixed', boxType: 'standard', showHorns: false, hornType: 'A', ironmongery: 'brass', upperGlass: 'clear', lowerGlass: 'clear', upperBars: 'none', lowerBars: 'none', sameBars: true, upperCustomBars: [], lowerCustomBars: [], sashType: 'double', splitRatio: '1/4-1/2-1/4', headType: 'flat', fixUpperBars: 'none', fixLowerBars: 'none', fixUpperCustomBars: [], fixLowerCustomBars: [], casementLayout: '010', casementOpening: 0, fanlightRatio: 0.3, casementHBars: 0, casementVBars: 0 },
    door: { extWidth: 900, extHeight: 2100, glassFinish: 'clear', woodColor: '#F6F6F6', woodColorExt: '#F6F6F6', woodColorInt: '#F6F6F6', sameColor: true, spacerColor: 'silver', doorType: 'single-external', doorShape: 'standard', doorStyle: 'full-glass', doorHinge: 'left', doorHBars: 0, doorVBars: 0, centerMullion: false, paneling: 'flat', sidePanels: 'none', sideLeftWidth: 500, sideRightWidth: 500, sideHBars: 0, sideVBars: 0, sideStyle: 'full-glass', thresholdType: 'standard', thresholdExtension: 0, doorOpening: 0, doorOpenDirection: 'outward', panelCount: 2, slideDirection: 'left-to-right', extraWidth: false, glassWidth: 0, panelDepth: 57, frameDepth: 93, foldDirection: 'left', trafficDoor: 'no', bifoldOpenDirection: 'outward' },
  };

  // Capture current state snapshot
  function captureState() {
    return { extWidth, extHeight, woodColor, woodColorExt, woodColorInt, sameColor, spacerColor, opening, upperOpening, openingType, boxType, showHorns, hornType, ironmongery, upperGlass, lowerGlass, upperBars, lowerBars, sameBars, upperCustomBars, lowerCustomBars, sashType, splitRatio, headType, fixUpperBars, fixLowerBars, fixUpperCustomBars, fixLowerCustomBars, casementLayout, casementOpening, fanlightRatio, casementHBars, casementVBars, glassFinish, trickleVent, trickleColour, sillExtension, sillWider, sealColour, fixShape, fixType, fixArchRise, fixGothicBars, fixCircleBarPattern, fixCircleBarOffset, fixSemiBarPattern, casementType, casArchShape, casArchHinge, doorType, doorShape, doorStyle, doorHinge, doorHBars, doorVBars, centerMullion, paneling, sidePanels, sideLeftWidth, sideRightWidth, sideHBars, sideVBars, sideStyle, thresholdType, thresholdExtension, doorOpening, doorOpenDirection, panelCount, slideDirection, extraWidth, glassWidth, panelDepth, frameDepth, foldDirection, trafficDoor, bifoldOpenDirection };
  }

  // Restore state from bucket
  function restoreState(s) {
    if (!s) return;
    if (s.extWidth !== undefined) setExtWidth(s.extWidth);
    if (s.extHeight !== undefined) setExtHeight(s.extHeight);
    if (s.woodColor !== undefined) { setWoodColor(s.woodColor); setWoodColorExt(s.woodColor); setWoodColorInt(s.woodColor); }
    if (s.woodColorExt !== undefined) setWoodColorExt(s.woodColorExt);
    if (s.woodColorInt !== undefined) setWoodColorInt(s.woodColorInt);
    if (s.sameColor !== undefined) setSameColor(s.sameColor);
    if (s.spacerColor !== undefined) setSpacerColor(s.spacerColor);
    if (s.opening !== undefined) setOpening(s.opening);
    if (s.upperOpening !== undefined) setUpperOpening(s.upperOpening);
    if (s.openingType !== undefined) setOpeningType(s.openingType);
    if (s.boxType !== undefined) setBoxType(s.boxType);
    if (s.showHorns !== undefined) setShowHorns(s.showHorns);
    if (s.hornType !== undefined) setHornType(s.hornType);
    if (s.ironmongery !== undefined) setIronmongery(s.ironmongery);
    if (s.upperGlass !== undefined) setUpperGlass(s.upperGlass);
    if (s.lowerGlass !== undefined) setLowerGlass(s.lowerGlass);
    if (s.upperBars !== undefined) setUpperBars(s.upperBars);
    if (s.lowerBars !== undefined) setLowerBars(s.lowerBars);
    if (s.sameBars !== undefined) setSameBars(s.sameBars);
    if (s.upperCustomBars !== undefined) setUpperCustomBars(s.upperCustomBars);
    if (s.lowerCustomBars !== undefined) setLowerCustomBars(s.lowerCustomBars);
    if (s.sashType !== undefined) setSashType(s.sashType);
    if (s.splitRatio !== undefined) setSplitRatio(s.splitRatio);
    if (s.headType !== undefined) setHeadType(s.headType);
    if (s.fixUpperBars !== undefined) setFixUpperBars(s.fixUpperBars);
    if (s.fixLowerBars !== undefined) setFixLowerBars(s.fixLowerBars);
    if (s.fixUpperCustomBars !== undefined) setFixUpperCustomBars(s.fixUpperCustomBars);
    if (s.fixLowerCustomBars !== undefined) setFixLowerCustomBars(s.fixLowerCustomBars);
    if (s.casementLayout !== undefined) setCasementLayout(s.casementLayout);
    if (s.casementOpening !== undefined) setCasementOpening(s.casementOpening);
    if (s.fanlightRatio !== undefined) setFanlightRatio(s.fanlightRatio);
    if (s.casementHBars !== undefined) setCasementHBars(s.casementHBars);
    if (s.casementVBars !== undefined) setCasementVBars(s.casementVBars);
    if (s.glassFinish !== undefined) setGlassFinish(s.glassFinish);
    if (s.trickleVent !== undefined) setTrickleVent(s.trickleVent);
    if (s.trickleColour !== undefined) setTrickleColour(s.trickleColour);
    if (s.sillExtension !== undefined) setSillExtension(s.sillExtension);
    if (s.sillWider !== undefined) setSillWider(s.sillWider);
    if (s.sealColour !== undefined) setSealColour(s.sealColour);
    if (s.fixShape !== undefined) setFixShape(s.fixShape);
    if (s.fixType !== undefined) setFixType(s.fixType);
    if (s.fixArchRise !== undefined) setFixArchRise(s.fixArchRise);
    if (s.fixGothicBars !== undefined) setFixGothicBars(s.fixGothicBars);
    if (s.fixCircleBarPattern !== undefined) setFixCircleBarPattern(s.fixCircleBarPattern);
    if (s.fixCircleBarOffset !== undefined) setFixCircleBarOffset(s.fixCircleBarOffset);
    if (s.fixSemiBarPattern !== undefined) setFixSemiBarPattern(s.fixSemiBarPattern);
    if (s.doorType !== undefined) setDoorType(s.doorType);
    if (s.doorShape !== undefined) setDoorShape(s.doorShape);
    if (s.doorStyle !== undefined) setDoorStyle(s.doorStyle);
    if (s.doorHinge !== undefined) setDoorHinge(s.doorHinge);
    if (s.doorHBars !== undefined) setDoorHBars(s.doorHBars);
    if (s.doorVBars !== undefined) setDoorVBars(s.doorVBars);
    if (s.centerMullion !== undefined) setCenterMullion(s.centerMullion);
    if (s.paneling !== undefined) setPaneling(s.paneling);
    if (s.sidePanels !== undefined) setSidePanels(s.sidePanels);
    if (s.sideLeftWidth !== undefined) setSideLeftWidth(s.sideLeftWidth);
    if (s.sideRightWidth !== undefined) setSideRightWidth(s.sideRightWidth);
    if (s.sideHBars !== undefined) setSideHBars(s.sideHBars);
    if (s.sideVBars !== undefined) setSideVBars(s.sideVBars);
    if (s.sideStyle !== undefined) setSideStyle(s.sideStyle);
    if (s.thresholdType !== undefined) setThresholdType(s.thresholdType);
    if (s.thresholdExtension !== undefined) setThresholdExtension(s.thresholdExtension);
    if (s.doorOpening !== undefined) setDoorOpening(s.doorOpening);
    if (s.doorOpenDirection !== undefined) setDoorOpenDirection(s.doorOpenDirection);
    if (s.panelCount !== undefined) setPanelCount(s.panelCount);
    if (s.slideDirection !== undefined) setSlideDirection(s.slideDirection);
    if (s.extraWidth !== undefined) setExtraWidth(s.extraWidth);
    if (s.glassWidth !== undefined) setGlassWidth(s.glassWidth);
    if (s.panelDepth !== undefined) setPanelDepth(s.panelDepth);
    if (s.frameDepth !== undefined) setFrameDepth(s.frameDepth);
    if (s.foldDirection !== undefined) setFoldDirection(s.foldDirection);
    if (s.trafficDoor !== undefined) setTrafficDoor(s.trafficDoor);
    if (s.bifoldOpenDirection !== undefined) setBifoldOpenDirection(s.bifoldOpenDirection);
  }

  const maxSashOpening = Math.max(0, height / 2 - 120);

  // Expose update3D function for Online Estimate to call
  React.useEffect(() => {
    window.update3D = (cfg) => {
      // ─── Category switch: save old state, restore new ───
      if (cfg.windowCategory !== undefined && cfg.windowCategory !== categoryRef.current) {
        // Save current state to old category bucket
        buckets.current[categoryRef.current] = captureState();
        // Switch category
        const newCat = cfg.windowCategory;
        categoryRef.current = newCat;
        setWindowCategory(newCat);
        // Restore from saved bucket or defaults
        const restored = buckets.current[newCat] || BUCKET_DEFAULTS[newCat] || BUCKET_DEFAULTS.sash;
        restoreState(restored);
        // Apply any extra values from this update3D call (e.g. casementLayout)
        delete cfg.windowCategory; // already handled
      }

      if (cfg.extWidth  !== undefined) setExtWidth(cfg.extWidth);
      if (cfg.extHeight !== undefined) setExtHeight(cfg.extHeight);
      if (cfg.upperBars !== undefined) setUpperBars(cfg.upperBars);
      if (cfg.lowerBars !== undefined) setLowerBars(cfg.lowerBars);
      if (cfg.sameBars  !== undefined) setSameBars(cfg.sameBars);
      if (cfg.upperCustomBars !== undefined) setUpperCustomBars(cfg.upperCustomBars);
      if (cfg.lowerCustomBars !== undefined) setLowerCustomBars(cfg.lowerCustomBars);
      if (cfg.opening !== undefined) setOpening(cfg.opening);
      if (cfg.upperOpening !== undefined) setUpperOpening(cfg.upperOpening);
      if (cfg.openingType !== undefined) {
        setOpeningType(cfg.openingType);
        if (cfg.openingType === 'fixed') { setOpening(0); setUpperOpening(0); }
        if (cfg.openingType === 'bottom') { setUpperOpening(0); }
      }
      if (cfg.woodColor !== undefined) {
        setWoodColor(cfg.woodColor);
        setWoodColorExt(cfg.woodColor);
        setWoodColorInt(cfg.woodColor);
      }
      if (cfg.woodColorExt !== undefined) setWoodColorExt(cfg.woodColorExt);
      if (cfg.woodColorInt !== undefined) setWoodColorInt(cfg.woodColorInt);
      if (cfg.sameColor    !== undefined) setSameColor(cfg.sameColor);
      if (cfg.upperGlass   !== undefined) setUpperGlass(cfg.upperGlass);
      if (cfg.lowerGlass   !== undefined) setLowerGlass(cfg.lowerGlass);
      if (cfg.spacerColor  !== undefined) setSpacerColor(cfg.spacerColor);
      if (cfg.boxType      !== undefined) setBoxType(cfg.boxType);
      if (cfg.boxDepth     !== undefined) setBoxDepthOverride(cfg.boxDepth);
      if (cfg.ironmongery  !== undefined) setIronmongery(cfg.ironmongery);
      if (cfg.showHorns    !== undefined) setShowHorns(cfg.showHorns);
      if (cfg.hornType     !== undefined) setHornType(cfg.hornType);
      if (cfg.sashType     !== undefined) setSashType(cfg.sashType);
      if (cfg.splitRatio   !== undefined) setSplitRatio(cfg.splitRatio);
      if (cfg.headType     !== undefined) setHeadType(cfg.headType);
      if (cfg.fixUpperBars !== undefined) setFixUpperBars(cfg.fixUpperBars);
      if (cfg.fixLowerBars !== undefined) setFixLowerBars(cfg.fixLowerBars);
      if (cfg.fixUpperCustomBars !== undefined) setFixUpperCustomBars(cfg.fixUpperCustomBars);
      if (cfg.fixLowerCustomBars !== undefined) setFixLowerCustomBars(cfg.fixLowerCustomBars);
      // Casement (windowCategory handled above in bucket system)
      if (cfg.casementLayout !== undefined) setCasementLayout(cfg.casementLayout);
      if (cfg.casementOpening !== undefined) setCasementOpening(cfg.casementOpening);
      if (cfg.fanlightRatio !== undefined) setFanlightRatio(cfg.fanlightRatio);
      if (cfg.casementHBars !== undefined) setCasementHBars(cfg.casementHBars);
      if (cfg.casementVBars !== undefined) setCasementVBars(cfg.casementVBars);
      if (cfg.glassFinish !== undefined) setGlassFinish(cfg.glassFinish);
      if (cfg.trickleVent !== undefined) setTrickleVent(cfg.trickleVent);
      if (cfg.trickleColour !== undefined) setTrickleColour(cfg.trickleColour);
      if (cfg.sillExtension !== undefined) setSillExtension(cfg.sillExtension);
      if (cfg.sillWider !== undefined) setSillWider(cfg.sillWider);
      if (cfg.sealColour !== undefined) setSealColour(cfg.sealColour);
      if (cfg.fixShape !== undefined) setFixShape(cfg.fixShape);
      if (cfg.fixType !== undefined) setFixType(cfg.fixType);
      if (cfg.fixArchRise !== undefined) setFixArchRise(cfg.fixArchRise);
      if (cfg.fixGothicBars !== undefined) setFixGothicBars(cfg.fixGothicBars);
      if (cfg.fixCircleBarPattern !== undefined) setFixCircleBarPattern(cfg.fixCircleBarPattern);
      if (cfg.fixCircleBarOffset !== undefined) setFixCircleBarOffset(cfg.fixCircleBarOffset);
      if (cfg.fixSemiBarPattern !== undefined) setFixSemiBarPattern(cfg.fixSemiBarPattern);
      if (cfg.casementType !== undefined) setCasementType(cfg.casementType);
      if (cfg.casArchShape !== undefined) setCasArchShape(cfg.casArchShape);
      if (cfg.casArchHinge !== undefined) setCasArchHinge(cfg.casArchHinge);
      // Door
      if (cfg.doorType !== undefined) setDoorType(cfg.doorType);
      if (cfg.doorShape !== undefined) setDoorShape(cfg.doorShape);
      if (cfg.doorStyle !== undefined) setDoorStyle(cfg.doorStyle);
      if (cfg.doorHinge !== undefined) setDoorHinge(cfg.doorHinge);
      if (cfg.hingeSide !== undefined) setDoorHinge(cfg.hingeSide);
      if (cfg.doorHBars !== undefined) setDoorHBars(cfg.doorHBars);
      if (cfg.doorVBars !== undefined) setDoorVBars(cfg.doorVBars);
      if (cfg.hBars !== undefined && categoryRef.current === 'door') setDoorHBars(cfg.hBars);
      if (cfg.vBars !== undefined && categoryRef.current === 'door') setDoorVBars(cfg.vBars);
      if (cfg.centerMullion !== undefined) setCenterMullion(cfg.centerMullion);
      if (cfg.paneling !== undefined) setPaneling(cfg.paneling);
      if (cfg.doorPaneling !== undefined) setPaneling(cfg.doorPaneling);
      if (cfg.sidePanels !== undefined) setSidePanels(cfg.sidePanels);
      if (cfg.sideLeftWidth !== undefined) setSideLeftWidth(cfg.sideLeftWidth);
      if (cfg.sideRightWidth !== undefined) setSideRightWidth(cfg.sideRightWidth);
      if (cfg.sideHBars !== undefined) setSideHBars(cfg.sideHBars);
      if (cfg.sideVBars !== undefined) setSideVBars(cfg.sideVBars);
      if (cfg.sideStyle !== undefined) setSideStyle(cfg.sideStyle);
      if (cfg.thresholdType !== undefined) setThresholdType(cfg.thresholdType);
      if (cfg.thresholdExtension !== undefined) setThresholdExtension(cfg.thresholdExtension);
      if (cfg.doorOpening !== undefined) setDoorOpening(cfg.doorOpening);
      if (cfg.doorOpenDirection !== undefined) setDoorOpenDirection(cfg.doorOpenDirection);
      if (cfg.panelCount !== undefined) setPanelCount(cfg.panelCount);
      if (cfg.slideDirection !== undefined) setSlideDirection(cfg.slideDirection);
      if (cfg.extraWidth !== undefined) setExtraWidth(cfg.extraWidth);
      if (cfg.glassWidth !== undefined) setGlassWidth(cfg.glassWidth);
      if (cfg.panelDepth !== undefined) setPanelDepth(cfg.panelDepth);
      if (cfg.frameDepth !== undefined) setFrameDepth(cfg.frameDepth);
      if (cfg.foldDirection !== undefined) setFoldDirection(cfg.foldDirection);
      if (cfg.trafficDoor !== undefined) setTrafficDoor(cfg.trafficDoor);
      if (cfg.bifoldOpenDirection !== undefined) setBifoldOpenDirection(cfg.bifoldOpenDirection);
    };
    // B4: Signal that 3D viewer is ready — ConfiguratorPage listens for this
    window.dispatchEvent(new Event('3d-ready'));
    return () => { delete window.update3D; };
  }, []);

  const config = useMemo(
    () => ({
      width,
      height,
      extWidth,
      extHeight,
      opening,
      upperOpening,
      autoRotate,
      showGuides,
      showHorns,
      hornType,
      ironmongery,
      upperGlass,
      lowerGlass,
      doubleGlazing,
      spacerColor,
      brightness,
      boxDepth: boxDepthOverride ?? (boxType === 'standard' ? 164 : 146),
      sashDepth: 57,
      boxType,
      upperBars,
      lowerBars,
      upperCustomBars,
      lowerCustomBars,
      woodColor,
      woodColorExt: sameColor ? woodColor : woodColorExt,
      woodColorInt: sameColor ? woodColor : woodColorInt,
      sameColor,
      sashType,
      splitRatio,
      headType,
      fixUpperBars,
      fixLowerBars,
      fixUpperCustomBars,
      fixLowerCustomBars,
      windowCategory,
      casementLayout,
      casementOpening,
      fanlightRatio,
      casementHBars,
      casementVBars,
      glassFinish,
      trickleVent,
      trickleColour,
      sillExtension,
      sillWider,
      sealColour,
      fixShape,
      fixType,
      fixArchRise,
      fixGothicBars,
      fixCircleBarPattern,
      fixCircleBarOffset,
      fixSemiBarPattern,
      casementType,
      casArchShape,
      casArchHinge,
      doorType,
      doorShape,
      doorStyle,
      doorHinge,
      doorHBars,
      doorVBars,
      centerMullion,
      paneling,
      sidePanels,
      sideLeftWidth,
      sideRightWidth,
      sideHBars,
      sideVBars,
      sideStyle,
      thresholdType,
      thresholdExtension,
      doorOpening,
      doorOpenDirection,
      panelCount,
      slideDirection,
      extraWidth,
      glassWidth,
      panelDepth,
      frameDepth,
      foldDirection,
      trafficDoor,
      bifoldOpenDirection,
    }),
    [width, height, extWidth, extHeight, opening, upperOpening, autoRotate, showGuides, showHorns, hornType, ironmongery, upperGlass, lowerGlass, doubleGlazing, spacerColor, brightness, boxType, boxDepthOverride, upperBars, lowerBars, upperCustomBars, lowerCustomBars, woodColor, woodColorExt, woodColorInt, sameColor, sashType, splitRatio, headType, fixUpperBars, fixLowerBars, fixUpperCustomBars, fixLowerCustomBars, windowCategory, casementLayout, casementOpening, fanlightRatio, casementHBars, casementVBars, glassFinish, trickleVent, trickleColour, sillExtension, sillWider, sealColour, fixShape, fixType, fixArchRise, fixGothicBars, fixCircleBarPattern, fixCircleBarOffset, fixSemiBarPattern, casementType, casArchShape, casArchHinge, doorType, doorShape, doorStyle, doorHinge, doorHBars, doorVBars, centerMullion, paneling, sidePanels, sideLeftWidth, sideRightWidth, sideHBars, sideVBars, sideStyle, thresholdType, thresholdExtension, doorOpening, doorOpenDirection, panelCount, slideDirection, extraWidth, glassWidth, panelDepth, frameDepth, foldDirection, trafficDoor, bifoldOpenDirection],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%', height: '100%' }}>
      {/* Scoped styles for 3D overlay controls (replaces removed PSW styles.css) */}
      <style>{`
        .control { display: grid; gap: 8px; margin-bottom: 14px; }
        .control__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .control__row span, .toggle span { color: #A0A8B8; }
        .control strong { font-weight: 600; color: #F0F2F5; }
        .toggle { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; }
        .switch { width: 54px; height: 32px; padding: 3px; border: none; border-radius: 999px; background: rgba(255,255,255,0.14); cursor: pointer; transition: background 180ms ease; }
        .switch span { display: block; width: 26px; height: 26px; border-radius: 50%; background: white; box-shadow: 0 6px 14px rgba(0,0,0,0.14); transform: translateX(0); transition: transform 180ms ease; }
        .switch--on { background: rgba(0,180,160,0.48); }
        .switch--on span { transform: translateX(22px); }
        input[type='range'] { width: 100%; accent-color: #00B4A0; }
      `}</style>
      <main style={{ position: 'relative', background: 'radial-gradient(ellipse at 55% 40%, #d8d8d8 0%, #b0b0b0 50%, #787878 100%)' }}>
        {/* Floating controls - top left */}
        <div style={{
          position: 'absolute', top: '12px', left: '12px', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: '8px',
          background: 'transparent',
          padding: '8px',
          maxWidth: '200px', width: '100%',
          pointerEvents: 'auto'
        }}>
          {windowCategory === 'sash' ? (
            <>
              <div style={{ opacity: openingType === 'fixed' ? 0.3 : 1, pointerEvents: openingType === 'fixed' ? 'none' : 'auto' }}>
                <Slider
                  label="Lower sash"
                  value={opening}
                  min={0}
                  max={maxSashOpening}
                  step={1}
                  onChange={setOpening}
                />
              </div>
              <div style={{ opacity: (openingType === 'fixed' || openingType === 'bottom') ? 0.3 : 1, pointerEvents: (openingType === 'fixed' || openingType === 'bottom') ? 'none' : 'auto' }}>
                <Slider
                  label="Upper sash"
                  value={upperOpening}
                  min={0}
                  max={maxSashOpening}
                  step={1}
                  onChange={setUpperOpening}
                />
              </div>
            </>
          ) : windowCategory === 'fix-only' ? null : windowCategory === 'door' ? (
            <Slider
              label="Opening"
              value={Math.round(doorOpening * 100)}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(v) => setDoorOpening(v / 100)}
            />
          ) : (
            <Slider
              label="Opening"
              value={Math.round(casementOpening * 100)}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(v) => setCasementOpening(v / 100)}
            />
          )}
          <Slider label="Brightness" value={Math.round((brightness - 1) * 100)} min={-30} max={30} step={1} suffix="%" onChange={(v) => setBrightness(1 + v / 100)} />
        </div>

        {/* Floating toggles - bottom left */}
        <div style={{
          position: 'absolute', bottom: '12px', left: '12px', zIndex: 10,
          display: 'flex', gap: '8px',
          pointerEvents: 'auto'
        }}>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            style={{
              background: autoRotate ? 'rgba(10,22,40,0.5)' : 'transparent',
              color: autoRotate ? '#fff' : 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '8px', padding: '6px 10px',
              fontSize: '11px', cursor: 'pointer',
              boxShadow: 'none'
            }}
          >{autoRotate ? '⏸ Rotate' : '▶ Rotate'}</button>
          <button
            onClick={() => setShowGuides(!showGuides)}
            style={{
              background: showGuides ? 'rgba(10,22,40,0.5)' : 'transparent',
              color: showGuides ? '#fff' : 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '8px', padding: '6px 10px',
              fontSize: '11px', cursor: 'pointer',
              boxShadow: 'none'
            }}
          >{showGuides ? '📏 Guides' : '📏 Guides'}</button>
        </div>

        {/* Rotate hint - bottom right */}
        <div style={{
          position: 'absolute', bottom: '12px', right: '12px', zIndex: 10,
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px', pointerEvents: 'none',
          color: 'rgba(255,255,255,0.5)'
        }} title="Drag to rotate">↻</div>

        <Canvas shadows={!isMobile} dpr={isMobile ? [1, 1] : [1, 2]} gl={{ alpha: true, antialias: !isMobile, powerPreference: isMobile ? 'low-power' : 'high-performance', preserveDrawingBuffer: true }} style={{ touchAction: 'none' }}>
          <Scene config={config} isMobile={isMobile} />
        </Canvas>

      </main>
    </div>
  );
}