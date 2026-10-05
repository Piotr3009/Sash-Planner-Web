import { useEffect, useId, useMemo, useRef, useState } from 'react';
import drawingSource from './window-drawing.svg?raw';
import xraySource from './window-xray.svg?raw';

const DURATION = 12;
const FINISHED_IMAGE = '/images/welcome/sash-window-finished.webp';
const TIMBER_IMAGE = '/images/welcome/sash-window-timber.webp';
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const p = clamp(value);
  return p * p * p * (p * (p * 6 - 15) + 10);
};
const between = (time, from, to) => ease((time - from) / (to - from));

// Both sources are checked-in SVG artwork, never user-provided markup.
function svgContents(source, prefix) {
  return source
    .replace(/^\s*<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
}

export default function WindowBuildAnimation() {
  const instanceId = useId();
  const prefix = `welcome-window-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const rootRef = useRef(null);
  const controllerRef = useRef(null);
  const [playback, setPlayback] = useState('playing');
  const artwork = useMemo(() => ({
    drawing: { __html: svgContents(drawingSource, `${prefix}-drawing`) },
    xray: { __html: svgContents(xraySource, `${prefix}-xray`) },
  }), [prefix]);
  const id = (name) => `${prefix}-${name}`;
  const fill = (name) => `url(#${id(name)})`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const query = (selector) => root.querySelector(selector);
    const drawing = query('[data-drawing]');
    const xray = query('[data-xray]');
    const wood = query('[data-wood]');
    const paint = query('[data-paint]');
    const woodGradient = query('[data-wood-gradient]');
    const wireGradient = query('[data-wire-gradient]');
    const paintGradient = query('[data-paint-gradient]');
    const scan = query('[data-scan]');
    const scanLine = query('[data-scan-line]');
    const scanGlow = query('[data-scan-glow]');
    const scene = query('.pc-welcome__scene');
    const lines = Array.from(drawing.querySelectorAll('path, line, rect')).map((element, index) => ({
      element,
      length: element.getTotalLength(),
      dash: element.getAttribute('stroke-dasharray'),
      index,
    }));
    const labels = Array.from(drawing.querySelectorAll('text'));
    let time = 0;
    let running = false;
    let frame = 0;
    let last = 0;

    function updateControls() {
      root.dataset.running = String(running);
      setPlayback(running ? 'playing' : time >= DURATION ? 'finished' : 'paused');
    }

    function render(nextTime) {
      time = Math.max(0, Math.min(DURATION, nextTime));
      root.dataset.time = time.toFixed(3);
      const turn = between(time, 2.6, 4.15);
      const material = between(time, 5.4, 7.7);
      const coating = between(time, 8.55, 11.1);

      drawing.style.opacity = String(1 - between(time, 2.95, 4.05));
      drawing.setAttribute('transform', `translate(${turn * 35} ${-turn * 25}) translate(1150 450) rotate(${-turn * 3.5}) scale(${1 - turn * 0.06} ${1 + turn * 0.05}) translate(-1150 -450)`);
      lines.forEach(({ element, length, dash, index }) => {
        const progress = between(time, 0.08 + (index % 9) * 0.075, 1.05 + (index % 9) * 0.075);
        element.style.opacity = String(Math.max(0.08, progress));
        element.style.strokeDasharray = progress < 1 ? String(length) : dash || '';
        element.style.strokeDashoffset = progress < 1 ? String(length * (1 - progress)) : '';
      });
      labels.forEach((element) => {
        element.style.opacity = String(between(time, 1.1, 1.9) * (1 - between(time, 2.65, 3.25)));
      });

      xray.style.opacity = String(between(time, 2.9, 4.1));
      const boundary = 760 + 980 * material;
      [woodGradient, wireGradient].forEach((gradient) => {
        gradient.setAttribute('x1', boundary - 60);
        gradient.setAttribute('x2', boundary + 60);
      });
      wood.style.opacity = String(between(time, 5.4, 5.8));
      paint.style.opacity = String(coating > 0 ? 1 : 0);
      const paintBoundary = -64 + 1069 * coating;
      paintGradient.setAttribute('y1', paintBoundary - 64);
      paintGradient.setAttribute('y2', paintBoundary + 64);

      const scanProgress = between(time, 4.12, 5.3);
      const scanY = scanProgress * 885;
      scan.style.opacity = String(time >= 4.12 && time < 5.3 ? Math.sin(scanProgress * Math.PI) * 0.36 : 0);
      scanLine.setAttribute('y1', scanY);
      scanLine.setAttribute('y2', scanY);
      scanGlow.setAttribute('y', scanY - 10);
    }

    function tick(now) {
      if (!running) return;
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      render(time + delta);
      if (time >= DURATION) {
        running = false;
        updateControls();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    }

    function start() {
      if (time >= DURATION) render(0);
      running = true;
      last = 0;
      window.cancelAnimationFrame(frame);
      updateControls();
      frame = window.requestAnimationFrame(tick);
    }

    function pause() {
      running = false;
      window.cancelAnimationFrame(frame);
      updateControls();
    }

    function resize() {
      scene.setAttribute('viewBox', root.clientWidth <= 660 ? '790 0 810 941' : '0 0 1672 941');
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function handleReducedMotion() {
      if (reducedMotion.matches) {
        running = false;
        window.cancelAnimationFrame(frame);
        render(DURATION);
        updateControls();
      }
    }
    function handleVisibility() {
      if (document.hidden && running) pause();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    render(0);
    controllerRef.current = { toggle: () => running ? pause() : start() };
    if (reducedMotion.matches) handleReducedMotion();
    else if (document.hidden) pause();
    else start();
    reducedMotion.addEventListener('change', handleReducedMotion);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      reducedMotion.removeEventListener('change', handleReducedMotion);
      document.removeEventListener('visibilitychange', handleVisibility);
      controllerRef.current = null;
    };
  }, []);

  const controlLabel = playback === 'playing' ? 'Pause animation' : playback === 'finished' ? 'Replay animation' : 'Play animation';

  return (
    <div ref={rootRef} className="pc-welcome__art pc-welcome__animation">
      <link rel="preload" as="image" href={FINISHED_IMAGE} />
      <link rel="preload" as="image" href={TIMBER_IMAGE} />
      <svg
        className="pc-welcome__scene"
        viewBox="0 0 1672 941"
        preserveAspectRatio="xMaxYMid meet"
        role="img"
        aria-label="A sash window takes shape from technical drawing through X-ray and natural timber to its painted finish."
      >
        <defs>
          <linearGradient id={id('material-gradient')} data-wood-gradient="" gradientUnits="userSpaceOnUse" x1="700" x2="820">
            <stop stopColor="white" /><stop offset=".5" stopColor="white" stopOpacity=".5" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('wire-gradient')} data-wire-gradient="" gradientUnits="userSpaceOnUse" x1="700" x2="820">
            <stop stopColor="white" stopOpacity="0" /><stop offset=".5" stopColor="white" stopOpacity=".5" /><stop offset="1" stopColor="white" />
          </linearGradient>
          <linearGradient id={id('paint-gradient')} data-paint-gradient="" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="-128" y2="0">
            <stop stopColor="white" /><stop offset=".5" stopColor="white" stopOpacity=".5" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={id('material-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="941" style={{ maskType: 'alpha' }}>
            <rect width="1672" height="941" fill={fill('material-gradient')} />
          </mask>
          <mask id={id('wire-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="941" style={{ maskType: 'alpha' }}>
            <rect width="1672" height="941" fill={fill('wire-gradient')} />
          </mask>
          <mask id={id('paint-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="941" style={{ maskType: 'alpha' }}>
            <rect width="1672" height="941" fill={fill('paint-gradient')} />
          </mask>
          <linearGradient id={id('scan-glow')}>
            <stop stopColor="#4ddcc6" stopOpacity="0" /><stop offset=".5" stopColor="#4ddcc6" stopOpacity=".7" /><stop offset="1" stopColor="#4ddcc6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1672" height="941" fill="#111419" />
        <g data-wood="" mask={fill('material-mask')} opacity="0"><image href={TIMBER_IMAGE} width="1672" height="941" /></g>
        <g data-paint="" mask={fill('paint-mask')} opacity="0"><image href={FINISHED_IMAGE} width="1672" height="941" /></g>
        <g data-xray="" mask={fill('wire-mask')} opacity="0" dangerouslySetInnerHTML={artwork.xray} />
        <g data-drawing="">
          <svg x="858" y="-3" width="638" height="930" viewBox="160 20 1550 2080" overflow="visible" dangerouslySetInnerHTML={artwork.drawing} />
        </g>
        <g data-scan="" opacity="0">
          <rect data-scan-glow="" x="855" y="0" width="580" height="20" fill={fill('scan-glow')} opacity=".18" />
          <line data-scan-line="" x1="861" x2="1434" y1="0" y2="0" stroke="#4ddcc6" strokeWidth="1.2" opacity=".65" />
        </g>
      </svg>
      <button
        type="button"
        className="pc-welcome__animation-toggle"
        onClick={() => controllerRef.current?.toggle()}
        aria-label={controlLabel}
        title={controlLabel}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          {playback === 'playing' ? <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="2" />
            : playback === 'finished' ? <path d="M3 7a5.2 5.2 0 1 1 .8 4.6M3 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="m5 3 8 5-8 5V3Z" fill="currentColor" />}
        </svg>
        <span>{playback === 'playing' ? 'Pause' : playback === 'finished' ? 'Replay' : 'Play'}</span>
      </button>
    </div>
  );
}
