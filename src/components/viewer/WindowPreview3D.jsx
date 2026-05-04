import { Suspense, lazy } from 'react';

const SashWindow3D = lazy(() => import('../../3d/SashWindow3D.jsx'));

export default function WindowPreview3D({ windowSpec, side }) {
  if (!windowSpec) return <div className="grid place-items-center h-full text-ink-400">No window data.</div>;

  return (
    <Suspense fallback={<div className="grid place-items-center h-full text-ink-400 text-sm">Loading 3D…</div>}>
      <SashWindow3D windowSpec={windowSpec} side={side} />
    </Suspense>
  );
}
