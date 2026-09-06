/**
 * archedSashGeometry.js — pure helpers of the arched SASH 3D (ARCHED-WINDOWS-v3
 * Block 1 I): PC shape names, and the engine's ArcChains (arch.js: real rise,
 * rule C, concentric offsets) sampled into the point arrays ArchedSashWindow's
 * PSW mesh builders take. No React / three here so the harness (t22) can load it.
 *
 * Units: the engine works in mm (arch frame: axis x = 0, springing y = 0); the
 * 3D in metres — `mmToM` converts (FixFrameWindow's `mm`). `inset` is a true
 * inward offset in metres (head face, sash inset, sash face …).
 */
import { archArcs, offsetArcs, arcPoint, arcsExtent, PSW_ARCH_SHAPE } from '../../engine/arch.js';

/** PC shape → the PSW shape name the PSW-side helpers (bars, metrics) understand. */
export const PC_TO_PSW_SHAPE = Object.freeze({
  'semi-circle': 'semi-circle',
  'three-centre': 'elliptical-arch',
  'gothic-equilateral': 'gothic-arch',
  'gothic-drop': 'gothic-arch',
});
export const isPcShape = (s) => PC_TO_PSW_SHAPE[s] !== undefined;
/** Any incoming name (PC or PSW) → the PC shape; unknown → semi-circle (PSW's own fallback). */
export const resolvePcShape = (raw) => (isPcShape(raw) ? raw : (PSW_ARCH_SHAPE[raw] || 'semi-circle'));

const defaultMm = (v) => v / 1000;

/** Engine chain (mm, arch frame) → 3D points [x, y] in metres on springY. */
export function chainTo3D(arcs, springY, segs, mmToM = defaultMm) {
  const pts = [];
  for (const a of arcs) {
    for (let i = 0; i <= segs; i++) {
      const t = a.a0 + (a.a1 - a.a0) * i / segs;
      const p = arcPoint(a, t);
      pts.push([mmToM(p[0]), springY + mmToM(p[1])]);
    }
  }
  return pts;
}

/** Engine arcs of the frame contour inset by `insetM` metres (null when the engine cannot offset that far). */
export function engineArcs(pcShape, extWidthMm, riseMm, insetM, minHaunchRadius) {
  try {
    const base = archArcs(pcShape, extWidthMm, riseMm, { minHaunchRadius });
    return insetM > 0 ? offsetArcs(base, insetM * 1000) : base;
  } catch (e) {
    return null;
  }
}

/**
 * Arch contour points (metres) inset by `insetM` from the frame outline, on the engine's geometry.
 * Returns null when the engine cannot offset that far — the caller falls back to the PSW sampler.
 */
export function engineArcPoints(pcShape, extWidthMm, riseMm, springY, insetM, minHaunchRadius, segs = 48, mmToM = defaultMm) {
  const arcs = engineArcs(pcShape, extWidthMm, riseMm, insetM, minHaunchRadius);
  return arcs ? chainTo3D(arcs, springY, segs, mmToM) : null;
}

/** Height (metres) of the inset contour above the springing, or null. */
export function engineApexRise(pcShape, extWidthMm, riseMm, insetM, minHaunchRadius, mmToM = defaultMm) {
  const arcs = engineArcs(pcShape, extWidthMm, riseMm, insetM, minHaunchRadius);
  return arcs ? mmToM(arcsExtent(arcs, [0, 1]).max) : null;
}
