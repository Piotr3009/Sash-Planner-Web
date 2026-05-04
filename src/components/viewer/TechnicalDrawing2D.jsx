import { useEffect, useRef } from 'react';
import { drawTechnicalElevation } from '../../engine/canvas-renderer.js';

export default function TechnicalDrawing2D({ windowSpec, settings }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !windowSpec) return;
    drawTechnicalElevation(canvas, windowSpec, settings);
    const onResize = () => drawTechnicalElevation(canvas, windowSpec, settings);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [windowSpec, settings]);

  if (!windowSpec) return <div className="text-ink-400 text-sm">No window data.</div>;

  return (
    <div className="w-full bg-white rounded-lg border border-ink-200 overflow-hidden">
      <canvas ref={canvasRef} className="w-full" style={{ display: 'block', height: '520px' }} />
    </div>
  );
}
