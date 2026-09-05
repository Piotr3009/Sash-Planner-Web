/**
 * archedCasementGeometry.js — the arched casement's 3D outline, built on
 * src/engine/arch.js (arched-casement-v2 night 4, spec §4 F).
 *
 * Pure module (no React, no THREE) shared by ArchedCasementWindow.jsx and
 * the harness (verify/arch/t19.mjs): every contour is a closed polygon of
 * [x, y] points in mm, y up, origin at the window centre — the PSW viewer's
 * frame — and every arc is sampled from an arch.js arc { cx, cy, r, a0, a1 },
 * so the 3D preview follows rule C (arches start vertical at the jambs),
 * the concentric rings and the typed rise exactly like the engine, the 2D
 * sheets and the DXF exports (one contour).
 *
 * Shape names: PSW (`gothic-arch`, `semi-circle`, `segmental-arch`,
 * `elliptical-arch`) and PC (`semi-circle`, `three-centre`,
 * `gothic-equilateral`, `gothic-drop`) are both accepted (arch.js
 * PSW_ARCH_SHAPE). Without `archRise` the PSW ratio of the given name
 * applies, so the PSW copy behaves as today; with it a Round arch resolves to
 * semi-circle / three-centre from the rise (arch.js resolveRoundShape).
 *
 * Dimensions (faces, rebate, gap, glass) are the 3D's own constants passed in
 * by the component (CasementFrame / CasementPanel), not literals here. The
 * two arch RULES that have no 3D constant — the three-centre haunch minimum
 * (profile arch.minHaunchRadius, P3) and the bar-pattern settings (profile
 * arch.patterns) — are props with the PSW literals as the fallback.
 */
import {
  archArcs, offsetArcs, arcPoint, arcsExtent, resolveRoundShape, isGothicShape,
  PSW_ARCH_SHAPE, PSW_ARCH_RISE_RATIO, ARCH_RISE_RATIO, GOTHIC_PROFILE_RATIO,
  buildGlassOutline, buildArchBars, patternsForShape, ArchError,
} from '../../../engine/arch.js';

// PSW 3d-src/src/components/fix-frame/FixFrameWindow.jsx literals (semiBarPattern
// rings 0.3 / 0.6 / 0.8, intersectingData: one mullion per 450 mm, 2..4, arcs
// under 30 mm skipped) — the fallback when no profile settings are passed.
export const PSW_BAR_PATTERN_SETTINGS = Object.freeze({
  hubRingRatios: [0.3, 0.6, 0.8],
  intersecting: { pitch: 450, minMullions: 2, maxMullions: 4, minRadius: 30 },
});

export const ARC_SEGMENTS = 48;       // samples per arc (PSW SEGS)
export const MIN_STRAIGHT_3D = 50;    // PSW: the frame is at least rise + 50 high

/** Resolve the PC shape + rise (mm) from PSW / PC props. Throws ArchError for an impossible rise. */
export function resolveArchProps({ archShape, width, archRise, archProfile }) {
  const W = Number(width);
  const given = Number(archRise) > 0 ? Number(archRise) : null;
  const pc = PSW_ARCH_SHAPE[archShape] || archShape;
  if (archShape === 'gothic-arch' || isGothicShape(pc)) {
    const profile = archProfile || (pc === 'gothic-drop' ? 'drop' : 'equilateral');
    const ratio = GOTHIC_PROFILE_RATIO[profile] || GOTHIC_PROFILE_RATIO.equilateral;
    const shape = profile === 'equilateral' ? 'gothic-equilateral' : 'gothic-drop';
    return { shape, rise: given ?? ratio * W, profile };
  }
  const ratio = PSW_ARCH_RISE_RATIO[archShape] ?? ARCH_RISE_RATIO[pc] ?? 0.5;
  const rise = given ?? ratio * W;
  return { shape: resolveRoundShape(W, rise), rise, profile: null };
}

/** Sample an arc a0 → a1 into [x, y] points (arch frame), end points included. */
export function sampleArc(a, segs = ARC_SEGMENTS) {
  const pts = [];
  for (let i = 0; i <= segs; i++) pts.push(arcPoint(a, a.a0 + (a.a1 - a.a0) * i / segs));
  return pts;
}

/**
 * Closed contour under a chain (arch frame, y up): bottom-left → bottom-right
 * → up the right side to the chain start → arcs (right → apex → left) →
 * down the left side. The sides sit at the chain's own end x (rule C).
 */
export function contourUnder(arcs, yBottom, tx) {
  const s = arcPoint(arcs[0], arcs[0].a0);
  const e = arcPoint(arcs[arcs.length - 1], arcs[arcs.length - 1].a1);
  const pts = [[e[0], yBottom], [s[0], yBottom], [s[0], s[1]]];
  arcs.forEach((a, i) => {
    const samples = sampleArc(a);
    for (let k = 1; k < samples.length; k++) pts.push(samples[k]);   // the first sample repeats the previous end point
  });
  pts.push([e[0], e[1]]);
  return tx ? pts.map(([x, y]) => tx(x, y)) : pts;
}

/**
 * Contour of a member ring / opening offset inward by `delta` from a base
 * chain: same centres, smaller radii (arch.js offsetArcs), sides and bottom
 * moved in by the same amount — exact, unlike a vertex-normal inset.
 */
export function contourAt(base, delta, tx) {
  return contourUnder(offsetArcs(base.arcs, delta), base.yBottom + delta, tx);
}

/**
 * Everything the 3D needs, in mm around the window centre (y up).
 * dims: { frameFace, extFace, bottomFace, bottomInner, leafGap, leafFace, gasketW, innerMargin }
 *   — the 3D constants (CasementFrame / CasementPanel), never literals here;
 *   innerMargin = the deepest inset drawn inside the leaf daylight (bead + spacer).
 */
export function archedCasementGeometry({
  width, height, archShape, archRise, archProfile, barPattern = 'none', hBars = 0, vBars = 0,
  minHaunchRadius = 0, patterns = PSW_BAR_PATTERN_SETTINGS, dims,
}) {
  const W = Number(width);
  const D = dims;
  const { shape, rise, profile } = resolveArchProps({ archShape, width: W, archRise, archProfile });
  // PSW forces the frame to at least rise + 50; the leaf below the springing
  // (cill side + gap + leaf face + bead) needs more than that to exist at all
  const minStraight = Math.max(MIN_STRAIGHT_3D, D.bottomInner + D.leafGap + D.leafFace + (D.innerMargin || 0));
  const effectiveH = Math.max(Number(height), rise + minStraight);
  const start = effectiveH - rise;
  const H = effectiveH;
  const springY = -H / 2 + start;                       // 3D y of the arch-start line
  const tx = (x, y) => [x, y + springY];                // arch frame → 3D mm
  // A three-centre haunch must be deeper than the deepest ring the 3D draws
  // (leaf inner + bead), else the ring cannot be offset — a drawing floor, not
  // a workshop number; production's minimum (profile arch.minHaunchRadius, 150)
  // is passed in by PC and is the larger of the two.
  const ringFloor = D.extFace + D.leafGap + D.leafFace + (D.innerMargin || 0);
  const base = archArcs(shape, W, rise, { minHaunchRadius: Math.max(Number(minHaunchRadius) || 0, ringFloor) });

  // Frame: outer contour, INT layer hole (full face), EXT layer hole (rebated face), gasket inner edge
  const outerBase = { arcs: base, yBottom: -H / 2 - springY };            // yBottom in the arch frame
  const outer = contourUnder(base, outerBase.yBottom, tx);
  const inner = contourUnder(offsetArcs(base, D.frameFace), -H / 2 + D.bottomFace - springY, tx);
  const innerRebated = contourUnder(offsetArcs(base, D.extFace), -H / 2 + D.bottomInner - springY, tx);
  const gasketInner = contourUnder(offsetArcs(base, D.extFace + D.gasketW), -H / 2 + D.bottomInner + D.gasketW - springY, tx);

  // Leaf: sits in the rebate with the fitting gap; glass = daylight (CasementPanel convention)
  const leafOuterOff = D.extFace + D.leafGap;
  const leafInnerOff = leafOuterOff + D.leafFace;
  const leafBottom = -H / 2 + D.bottomInner + D.leafGap;                  // 3D y of the leaf bottom
  const leafOuterArcs = offsetArcs(base, leafOuterOff);
  const leafInnerArcs = offsetArcs(base, leafInnerOff);
  const leafInnerBase = { arcs: leafInnerArcs, yBottom: leafBottom + D.leafFace - springY };
  const leafOuter = contourUnder(leafOuterArcs, leafBottom - springY, tx);
  const leafInner = contourUnder(leafInnerArcs, leafInnerBase.yBottom, tx);
  const leafW = W - 2 * leafOuterOff;
  const leafH = (arcsExtent(leafOuterArcs, [0, 1]).max + springY) - leafBottom;

  // Glass outline + bars in the engine's glass frame (origin = glass bottom-left, y up)
  const xg = W / 2 - leafInnerOff;
  const glassBottom = leafBottom + D.leafFace;                            // 3D y
  const outline = buildGlassOutline(leafInnerArcs, xg, springY - glassBottom);
  const allowed = patternsForShape(shape);
  const pattern = allowed.includes(barPattern) ? barPattern : 'none';
  const barSet = buildArchBars({ outline, shape, pattern, h: hBars, v: vBars, frameHalfWidth: W / 2 }, patterns);
  const g2w = (p) => [p[0] - xg, glassBottom + p[1]];                    // glass frame → 3D mm
  const bars = barSet.bars.map((b) => (b.kind === 'arc'
    ? { ...b, from: g2w(b.from), to: g2w(b.to), arc: { ...b.arc, cx: b.arc.cx - xg, cy: b.arc.cy + glassBottom } }
    : { ...b, from: g2w(b.from), to: g2w(b.to) }));
  void ringFloor;

  const ext = (pts) => pts.reduce((m, [x, y]) => ({ minX: Math.min(m.minX, x), maxX: Math.max(m.maxX, x), minY: Math.min(m.minY, y), maxY: Math.max(m.maxY, y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

  return {
    shape, profile, rise, start, width: W, height: H, springY, ringFloor,
    radii: base.map((a) => a.r),
    outer, inner, innerRebated, gasketInner,
    leaf: { outer: leafOuter, inner: leafInner, innerBase: leafInnerBase, width: leafW, height: leafH, bottom: leafBottom, xg, glassBottom },
    bars, pattern, barCounts: barSet.counts,
    tx,
    extents: ext(outer),
  };
}

/** Same call, but never throws: an impossible rise falls back to the PSW ratio, then to null. */
export function safeArchedCasementGeometry(input) {
  try { return archedCasementGeometry(input); }
  catch (e) {
    if (!(e instanceof ArchError)) throw e;
    if (input.archRise) {
      try { return { ...archedCasementGeometry({ ...input, archRise: null }), fallback: e.message }; }
      catch (e2) { if (!(e2 instanceof ArchError)) throw e2; return null; }
    }
    return null;
  }
}
