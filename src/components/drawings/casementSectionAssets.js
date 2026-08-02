// AUTO-GENERATED from the OTD cill DXF (dxf2path pipeline) - do not hand-edit
// the CILL_PATH string. Millimetre space, origin at the profile top-left,
// y grows downward. Exterior is on the LEFT.
//
// v2 (Piotr 02.08.2026, mockup approved): the extension board has a 10×10
// TONGUE that hooks into a matching GROOVE cut in the cill face (assembly DXF
// evidence, y 34–44 local). Board geometry measured from the assembly DXF:
// constant 34mm thickness at the cill face for all three projections
// (35 / 60 / 85 → raw board widths 45 / 70 / 95 incl. tongue), top plane
// continues the cill weathering slope, ~r3 nose radius, shared bottom with
// the cill (y 68), R4 drip NOTCH cut up into the underside 10mm from the nose
// (water break — Piotr 02.08.2026: wcięcie, nie wypustka).
export const CILL_BASE = Object.freeze({
  width: 93,
  height: 68,
  faceY: 28.54,          // weathering-slope arrival on the exterior face
  // True slope of the straight weathering run in CILL_PATH:
  // (47,21) → (1.756,26.555); the 28.54 face point sits after the r2 radius.
  slope: (26.555 - 21.0) / (47.0 - 1.756),
  boardTopY: 34,         // board top meets the face 5.5mm below the slope end
  boardBottomY: 68,      // board bottom is flush with the cill bottom
  tongue: 10,            // tongue/groove: 10mm deep × 10mm tall (y 34–44)
  noseRadiusInset: 2.6,  // straight top ends this far before the nose…
  noseRadiusDrop: 2.7,   // …then the ~r3 radius drops onto the nose face
  dripR: 4,              // arc drip radius
  dripInset: 10,         // drip arc starts this far from the nose
});

// Exact closed cill profile traced 1:1 from the OTD cill DXF - VERBATIM.
export const CILL_PATH =
  'M 47.0 21.0 L 1.756 26.555 L 1.403 26.632 L 1.069 26.77 L 0.765 26.967 L 0.502 27.215 L 0.288 27.507 L 0.13 27.832 L 0.033 28.18 L 0.0 28.54 L 0.0 68.0 L 21.0 68.0 L 21.0 65.0 L 34.0 65.0 L 34.0 68.0 L 47.0 68.0 L 47.0 65.0 L 60.0 65.0 L 60.0 68.0 L 93.0 68.0 L 93.0 12.0 L 91.0 12.0 L 90.969 11.215 L 90.877 10.436 L 90.724 9.666 L 90.511 8.91 L 90.239 8.173 L 89.91 7.46 L 89.526 6.775 L 89.09 6.122 L 88.604 5.506 L 88.071 4.929 L 87.494 4.396 L 86.878 3.91 L 86.225 3.474 L 85.54 3.09 L 84.827 2.761 L 84.09 2.489 L 83.334 2.276 L 82.564 2.123 L 81.785 2.031 L 81.0 2.0 L 81.0 0.0 L 64.0 0.0 L 64.0 26.0 L 60.0 26.0 L 60.0 18.0 L 47.0 18.0 Z';

// Cill with the extension groove cut into the face (rendered only when the
// window has an extension board). Built by a runtime string replace on the
// verbatim path — never hand-transcribed. Falls back to the plain profile if
// the anchor ever changes (then the groove simply is not drawn).
const GROOVE_CUT = 'L 0.0 34.0 L 10.0 34.0 L 10.0 44.0 L 0.0 44.0 L 0.0 68.0';
export const CILL_PATH_GROOVED = CILL_PATH.includes('L 0.0 68.0')
  ? CILL_PATH.replace('L 0.0 68.0', GROOVE_CUT)
  : CILL_PATH;

/**
 * Extension board outline for a given projection (35 / 60 / 85mm), tongue
 * included. Local cill coordinates: face x=0, cill top y=0, y grows down.
 */
export function buildExtensionPath(proj) {
  const B = CILL_BASE;
  const r2 = (v) => Math.round(v * 100) / 100;
  const yTop = B.boardTopY;
  const yGrvBot = B.boardTopY + B.tongue;
  const yBot = B.boardBottomY;
  const xRad = -(proj - B.noseRadiusInset);
  const yRad = yTop + B.slope * (proj - B.noseRadiusInset);
  const yNose = r2(yRad + B.noseRadiusDrop);
  const nX = -proj;
  const dripA = nX + B.dripInset;
  const dripB = dripA + 2 * B.dripR;
  return [
    `M ${B.tongue} ${yTop}`,
    `L 0 ${yTop}`,
    `L ${r2(xRad)} ${r2(yRad)}`,
    `Q ${nX} ${r2(yRad + 0.7)} ${nX} ${yNose}`,
    `L ${nX} ${yBot}`,
    `L ${r2(dripA)} ${yBot}`,
    `A ${B.dripR} ${B.dripR} 0 0 1 ${r2(dripB)} ${yBot}`,
    `L 0 ${yBot}`,
    `L 0 ${yGrvBot}`,
    `L ${B.tongue} ${yGrvBot}`,
    'Z',
  ].join(' ');
}
