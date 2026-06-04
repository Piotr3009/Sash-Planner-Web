import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import ParametricSashWindow from '../3d/components/ParametricSashWindow.jsx';
import { PART_SYMBOLS } from '../engine/partSymbols.js';
import { useAuthStore } from '../stores/authStore.js';

// ─────────────────────────────────────────────────────────────────────────────
// "Production Core" post-login splash.
// The real configurator window (white, 6×6 Georgian bars) slowly explodes into
// its main parts, symbol chips fade onto the parts, then the brand + CTA appear.
// Click anywhere → Dashboard. Plays once per login (guarded by the session token).
// ─────────────────────────────────────────────────────────────────────────────

// ── Approved tempo (seconds from canvas mount; ~3× slow, signed off) ──────────
const T_EXPL_START = 0.9;   // explode begins
const T_EXPL_DUR   = 3.2;   // explode duration
const STAGGER      = 0.18;  // per-chip fade-in delay
const T_LABELS     = 4.6;   // symbol chips start fading in
const T_BRAND      = 9.6;   // brand + CTA fade in
const LABEL_FADE   = 0.6;   // per-chip fade duration
const SETTLE_START = T_EXPL_START + T_EXPL_DUR;   // camera starts easing front-on
const SETTLE_DUR   = T_BRAND - SETTLE_START;      // …and lands as the brand appears

// ── Camera path (orbit during explode, then ease to a front-on hold) ──────────
const ORBIT_CENTER    = [0, 0.18, 0]; // matches the configurator's orbit target
const CAM_AZ0         = 0.72;         // start azimuth (rad) ≈ configurator 3/4 view
const CAM_R0          = 2.13;         // start horizontal radius
const CAM_Y0          = 0.70;         // start camera height
const CAM_ORBIT_SWEEP = 0.55;         // azimuth drift during the explode (slow orbit)
const CAM_AZ1         = 0.0;          // end azimuth → front-on (+Z faces the viewer)
const CAM_R1          = 3.0;          // end radius (frames the exploded window)
const CAM_Y1          = 0.34;         // end camera height
const START_CAM = [
  ORBIT_CENTER[0] + CAM_R0 * Math.sin(CAM_AZ0),
  CAM_Y0,
  ORBIT_CENTER[2] + CAM_R0 * Math.cos(CAM_AZ0),
];
// Stable identity so re-renders never re-apply (and reset) the camera mid-animation.
const CAMERA_PROP = { fov: 45, position: START_CAM, near: 0.1, far: 100 };

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp01   = (x) => Math.min(1, Math.max(0, x));
const lerp      = (a, b, t) => a + (b - a) * t;
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const M = (val) => val / 1000; // mm → three units (matches ParametricSashWindow's mm())

// ── Symbol chips. anchor = local position inside the window's rotated group;
// dir = displacement per unit explode. Both the SIGN and the MAGNITUDE here must
// match ParametricSashWindow's EXPLODE_* consts (220/240/240/170/150 mm) so each
// chip rides its part — if you retune those, mirror them here. 1200×1800 sample.
const LABELS = [
  { key: 'jbl',  text: PART_SYMBOLS.jamb_left.symbol,  anchor: [-0.586,  0.18,  0.000], dir: [-M(220), 0, 0] },
  { key: 'jbr',  text: PART_SYMBOLS.jamb_right.symbol, anchor: [ 0.586,  0.18,  0.000], dir: [ M(220), 0, 0] },
  { key: 'head', text: PART_SYMBOLS.head.symbol,       anchor: [ 0.000,  0.921, 0.000], dir: [0,  M(240), 0] },
  { key: 'cill', text: PART_SYMBOLS.cill.symbol,       anchor: [ 0.000, -0.840, 0.000], dir: [0, -M(240), 0] },
  { key: 'up',   text: 'UPPER SASH',                   anchor: [ 0.000,  0.600, 0.034], dir: [0,  M(170), -M(150)] },
  { key: 'low',  text: 'LOWER SASH',                   anchor: [ 0.000, -0.520,-0.034], dir: [0, -M(170), -M(150)] },
];

// Mirrors the configurator's lighting rig (src/3d/App.jsx) so the window reads the
// same. Shadows are dropped (no floor/receiver on the transparent splash canvas).
function SplashLights() {
  return (
    <>
      <ambientLight intensity={0.56} />
      <hemisphereLight args={['#fdf6e8', '#c8c0b0', 0.72]} />
      <directionalLight position={[4, 6, 5]} intensity={1.12} />
      <directionalLight position={[-3, 2,  3]} intensity={0.6} />
      <directionalLight position={[-3, 2, -3]} intensity={0.6} />
      <directionalLight position={[ 3, 2,  3]} intensity={0.56} />
      <directionalLight position={[ 3, 2, -3]} intensity={0.56} />
      <directionalLight position={[-2, -2,  2]} intensity={0.25} color="#e8d8c0" />
      <directionalLight position={[ 2, -2, -2]} intensity={0.25} color="#e8d8c0" />
      <pointLight position={[ 0.5, 0.5,  1.2]} intensity={0.98} distance={6} decay={2} color="#fff8f0" />
      <pointLight position={[-0.5, 0,    1.2]} intensity={0.98} distance={6} decay={2} color="#fff4e8" />
      <pointLight position={[ 0.5, 0,   -1.5]} intensity={0.98} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[-0.5, 0,   -1.5]} intensity={0.98} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[ 1.5, 0.5, -1.5]} intensity={0.70} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[-1.5, 0.5, -1.5]} intensity={0.70} distance={6} decay={2} color="#f0f4ff" />
      <pointLight position={[ 1.5, 0.5,  1.2]} intensity={0.70} distance={6} decay={2} color="#fff8f0" />
      <pointLight position={[-1.5, 0.5,  1.2]} intensity={0.70} distance={6} decay={2} color="#fff8f0" />
    </>
  );
}

function SplashScene({ animate, onBrand }) {
  const camera = useThree((s) => s.camera);
  const elapsed = useRef(animate ? 0 : 999);        // skip → start past the timeline
  const explodeRef = useRef(animate ? 0 : 1);
  const brandFired = useRef(!animate);
  const [explode, setExplode] = useState(animate ? 0 : 1);
  const groupRefs = useRef([]);
  const chipRefs = useRef([]);

  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.05); // clamp big deltas (tab refocus)
    const e = elapsed.current;

    // 1) Explode 0→1 (drives the window via a prop; cheap geometry is memoised).
    const exV = easeInOut(clamp01((e - T_EXPL_START) / T_EXPL_DUR));
    if (Math.abs(exV - explodeRef.current) > 0.0015 || (exV === 1 && explodeRef.current !== 1)) {
      explodeRef.current = exV;
      setExplode(exV);
    }

    // 2) Camera: orbit through the explode, then ease to a front-on hold.
    const pSettle = clamp01((e - SETTLE_START) / SETTLE_DUR);
    let az, r, cy;
    if (pSettle <= 0) {
      az = CAM_AZ0 + CAM_ORBIT_SWEEP * easeInOut(clamp01((e - T_EXPL_START) / T_EXPL_DUR));
      r = CAM_R0;
      cy = CAM_Y0;
    } else {
      const p = easeInOut(pSettle);
      az = lerp(CAM_AZ0 + CAM_ORBIT_SWEEP, CAM_AZ1, p);
      r = lerp(CAM_R0, CAM_R1, p);
      cy = lerp(CAM_Y0, CAM_Y1, p);
    }
    camera.position.set(
      ORBIT_CENTER[0] + r * Math.sin(az),
      cy,
      ORBIT_CENTER[2] + r * Math.cos(az),
    );
    camera.lookAt(ORBIT_CENTER[0], ORBIT_CENTER[1], ORBIT_CENTER[2]);

    // 3) Chips: track their part (anchor + dir·explode) and fade in, staggered.
    for (let i = 0; i < LABELS.length; i += 1) {
      const g = groupRefs.current[i];
      if (g) {
        const { anchor, dir } = LABELS[i];
        g.position.set(anchor[0] + dir[0] * exV, anchor[1] + dir[1] * exV, anchor[2] + dir[2] * exV);
      }
      const chip = chipRefs.current[i];
      if (chip) chip.style.opacity = String(clamp01((e - (T_LABELS + i * STAGGER)) / LABEL_FADE));
    }

    // 4) Brand + CTA, last.
    if (!brandFired.current && e >= T_BRAND) {
      brandFired.current = true;
      onBrand();
    }
  });

  return (
    <>
      <SplashLights />

      <group position={ORBIT_CENTER}>
        <ParametricSashWindow
          woodColor="#ffffff"
          upperBars="6x6"
          lowerBars="6x6"
          showHorns
          sashType="double"
          showGuides={false}
          explode={explode}
        />
      </group>

      {/* Symbol chips share the window's transform so projection tracks the parts. */}
      <group position={ORBIT_CENTER}>
        <group rotation={[0, Math.PI, 0]}>
          {LABELS.map((lbl, i) => (
            <group key={lbl.key} ref={(el) => { groupRefs.current[i] = el; }}>
              <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                <div
                  ref={(el) => { chipRefs.current[i] = el; }}
                  className="lp-chip"
                  style={{ opacity: animate ? 0 : 1 }}
                >
                  {lbl.text}
                </div>
              </Html>
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

// Module-level guard: which login (session token) we last played for.
// A new login issues a new token → the splash replays. Returning to "/" within
// the same session does not. Resets on full page load (module re-evaluates).
let playedForToken = null;

export default function LandingPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const token = session?.access_token ?? '__no-session__';

  const [animate] = useState(() => token !== playedForToken);
  const [brandIn, setBrandIn] = useState(!animate);

  useEffect(() => { playedForToken = token; }, [token]);

  const enter = () => navigate('/dashboard');

  return (
    <div
      className="lp-root"
      onClick={enter}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') enter(); }}
    >
      <Canvas
        className="lp-canvas"
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={CAMERA_PROP}
      >
        <SplashScene animate={animate} onBrand={() => setBrandIn(true)} />
      </Canvas>

      <div className={`lp-brand ${brandIn ? 'is-in' : ''}`}>
        <h1 className="lp-title">PRODUCTION CORE</h1>
        <p className="lp-tagline">
          From one window to every numbered part — and straight to the cutting list.
        </p>
        <p className="lp-cta">Click anywhere to enter →</p>
      </div>

      <style>{`
        .lp-root {
          position: fixed;
          inset: 0;
          z-index: 50;
          overflow: hidden;
          cursor: pointer;
          background-color: #0a1622;
          background-image:
            radial-gradient(ellipse at 50% 38%, rgba(45,212,191,0.10), transparent 60%),
            linear-gradient(rgba(45,212,191,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45,212,191,0.07) 1px, transparent 1px);
          background-size: 100% 100%, 42px 42px, 42px 42px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        /* Vignette to settle the edges of the blueprint grid. */
        .lp-root::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse at 50% 42%, transparent 52%, rgba(4,10,18,0.85) 100%);
        }
        .lp-canvas { position: absolute; inset: 0; }

        .lp-chip {
          padding: 3px 9px;
          border: 1px solid #2dd4bf;
          border-radius: 4px;
          background: rgba(13,30,40,0.78);
          color: #2dd4bf;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          white-space: nowrap;
          box-shadow: 0 0 14px rgba(45,212,191,0.28);
          transform: translateY(-10px);
          transition: opacity 120ms linear;
        }

        .lp-brand {
          position: absolute;
          left: 0; right: 0; bottom: 11%;
          z-index: 40; /* above the drei <Html> chips (zIndexRange max 30) */
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 0 24px;
          pointer-events: none;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 900ms ease, transform 900ms ease;
        }
        .lp-brand.is-in { opacity: 1; transform: translateY(0); }
        .lp-title {
          margin: 0;
          font-family: 'Saira Condensed', 'Arial Narrow', sans-serif;
          font-weight: 700;
          font-size: clamp(40px, 7vw, 86px);
          letter-spacing: 0.14em;
          line-height: 0.98;
          color: #f1f5f9;
          text-shadow: 0 0 26px rgba(45,212,191,0.35);
        }
        .lp-tagline {
          margin: 14px 0 0;
          max-width: 640px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: clamp(12px, 1.5vw, 15px);
          line-height: 1.5;
          color: #94a3b8;
        }
        .lp-cta {
          margin: 22px 0 0;
          font-family: 'Saira Condensed', 'Arial Narrow', sans-serif;
          font-weight: 600;
          font-size: clamp(14px, 1.8vw, 18px);
          letter-spacing: 0.18em;
          color: #2dd4bf;
          animation: lp-pulse 1.8s ease-in-out infinite;
        }
        @keyframes lp-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .lp-cta { animation: none; opacity: 1; }
          .lp-brand { transition: opacity 200ms ease; transform: none; }
        }
      `}</style>
    </div>
  );
}
