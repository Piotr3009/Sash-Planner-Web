/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * winkhausKeeps.js (24.10.2026): the FACE geometry of the ThunderBolt keeps the
 * Lock Machining sheet draws, read off the BJ Waller / Winkhaus data sheets
 * (the screw position pages of 24.10.2026). The routing numbers (plate and
 * pocket from / to, widths, depths) live in engine/doorLockMachining.js KEEPS;
 * this module adds what the drawing shows on the plate face.
 *
 * Coordinates: x along the plate from the keep's REFERENCE point (the deadbolt
 * axis of a single pocket keep, the handle height of the centre keep), + up
 * the leaf; y across the plate from one long edge, 0 to the plate width.
 *   plate     the plate outline: x0, x1, width, endRadius (12 = full round ends)
 *   windows   the bolt openings through the plate: x0, x1, y0, y1, corner
 *   screws    countersunk fixing screws: [x, y] (hole r 2.2, countersink r 4)
 *   adjusters the keep's adjusting grub screws: [x, y] (r 1.5)
 */

/** F2402 adjustable single pocket keep (176 x 24 x 2.5): the F2402 page. */
export const F2402 = Object.freeze({
  code: 'F2402',
  plate: { x0: -88, x1: 88, width: 24, endRadius: 12 },
  pocket: { x0: -60, x1: 60, width: 18, endRadius: 6 },
  windows: [{ key: 'bolt', x0: -27, x1: 27, y0: 4.5, y1: 19.5, corner: 2 }],
  // the data sheet: 76 and 66 from the centre, 17.5 and 6.5 from the long edge,
  // the pattern point symmetric about the centre
  screws: [[76, 17.5], [66, 6.5], [-66, 17.5], [-76, 6.5]],
  adjusters: [[46, 12], [-46, 12]],
  screw: { hole: 2.2, countersink: 4 },
  adjuster: { radius: 1.5 },
});

/** F24-912W centre keep, radius end, 56 (235 x 24 x 2.5): the Griffhoehe page. */
export const F24_912W = Object.freeze({
  code: 'F24-912W',
  plate: { x0: -126.5, x1: 108.5, width: 24, endRadius: 12 },
  pocket: { x0: -106.5, x1: 75.5, width: 18, endRadius: 6 },
  // the latch window above the handle (the latch 25.5 above the spindle), the
  // deadbolt window below it (the deadbolt 70 below)
  windows: [
    { key: 'latch', x0: 3.5, x1: 48.5, y0: 4, y1: 20, corner: 2 },
    { key: 'deadbolt', x0: -95, x1: -42, y0: 4, y1: 20, corner: 2 },
  ],
  // 96.5 above the handle, 31.5 and 114.5 below it, on the centre line
  screws: [[96.5, 12], [-31.5, 12], [-114.5, 12]],
  adjusters: [[66.5, 12], [-17, 12], [-100.5, 12]],
  screw: { hole: 2.2, countersink: 4 },
  adjuster: { radius: 1.5 },
});

/** The keep faces by their product code (the machining keeps carry the code). */
export const KEEP_FACES = Object.freeze({ F2402, 'F24-912W': F24_912W });

export function keepFace(code) {
  return KEEP_FACES[code] || null;
}
