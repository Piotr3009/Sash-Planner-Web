// AUTO-GENERATED from the OTD cill DXF (dxf2path pipeline) - do not hand-edit.
// Millimetre space, origin at the profile top-left, y grows downward.
// Exterior is on the LEFT: the weathering slope falls from (47, 21) to the
// outer face at (0, 28.54); the extension board docks flat against that face
// and continues the same slope (see CasementSection2D.buildExtensionPath).
export const CILL_BASE = Object.freeze({
  width: 93,
  height: 68,
  faceY: 28.54,        // slope arrival on the exterior face
  slope: (28.54 - 21.0) / 47.0,
  boardDrop: 26,       // extension nose height below its top edge
  dripW: 5,
  dripH: 4,
  dripInset: 6,        // drip groove starts this far from the nose
});
export const CILL_PATH =
  'M 47.0 21.0 L 1.756 26.555 L 1.403 26.632 L 1.069 26.77 L 0.765 26.967 L 0.502 27.215 L 0.288 27.507 L 0.13 27.832 L 0.033 28.18 L 0.0 28.54 L 0.0 68.0 L 21.0 68.0 L 21.0 65.0 L 34.0 65.0 L 34.0 68.0 L 47.0 68.0 L 47.0 65.0 L 60.0 65.0 L 60.0 68.0 L 93.0 68.0 L 93.0 12.0 L 91.0 12.0 L 90.969 11.215 L 90.877 10.436 L 90.724 9.666 L 90.511 8.91 L 90.239 8.173 L 89.91 7.46 L 89.526 6.775 L 89.09 6.122 L 88.604 5.506 L 88.071 4.929 L 87.494 4.396 L 86.878 3.91 L 86.225 3.474 L 85.54 3.09 L 84.827 2.761 L 84.09 2.489 L 83.334 2.276 L 82.564 2.123 L 81.785 2.031 L 81.0 2.0 L 81.0 0.0 L 64.0 0.0 L 64.0 26.0 L 60.0 26.0 L 60.0 18.0 L 47.0 18.0 Z';
