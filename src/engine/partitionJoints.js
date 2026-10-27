/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * partitionJoints.js (25.10.2026): the dowel schedule of a partition member
 * for the CNC. Every member is an L (or a [ where both edges carry the glass
 * rebate): the solid "body" of an end face is the member width minus its
 * rebates, over the depth behind the front upstand; the front upstand strip is
 * too thin for a dowel. Three 8 mm dowels per joint (Piotr 25.10.2026): a
 * triangle when the body is wide enough, a vertical row at the body centre
 * when it is not (a mid rail rebated on both edges keeps a narrow body).
 *
 * Coordinates of a hole on an END face: { across, depth }: `across` along the
 * member's face width from its reference edge (the edge named in the joint),
 * `depth` from the FRONT (corridor) face. Pure functions, every number from
 * the profile `joints` and `glazing` blocks passed in.
 */

const R = (v) => Math.round(v * 10) / 10;

/**
 * The dowel holes of one end face.
 *   bodyFrom, bodyTo  the solid band of the face width (the rebates left out), from the reference edge
 *   depth             the member depth; the body runs from `upstand` to `depth`
 *   J                 the profile joints block (dowel.perJoint, pattern50, rowDepth, rowMargin)
 */
export function dowelHoles({ bodyFrom, bodyTo, depth, upstand, J }) {
  const n = Math.max(1, Math.round(Number(J?.dowel?.perJoint) || 3));
  const dia = Number(J?.dowel?.dia) || 8;
  const bodyW = R(bodyTo - bodyFrom);
  const dMin = Number(upstand) + dia / 2 + 2;        // the hole clear of the front upstand
  const dMax = Number(depth) - dia / 2 - 2;
  const holes = [];
  const pattern = J?.pattern50;
  if (bodyW >= 2 * dia + 2 && Array.isArray(pattern) && pattern.length >= n && bodyW < Number(J?.rowMargin) * 2 + (n - 1) * dia * 2) {
    // the triangle of the 50 members: [across from the body edge, depth]
    for (let i = 0; i < n; i += 1) {
      const [a, d] = pattern[i];
      holes.push({ across: R(bodyFrom + Math.min(Math.max(a, dia / 2 + 1), bodyW - dia / 2 - 1)), depth: R(Math.min(Math.max(d, dMin), dMax)) });
    }
  } else if (bodyW >= Number(J?.rowMargin) * 2 + (n - 1) * dia * 2) {
    // a wide member (door rails): a row at rowDepth, the first and last rowMargin from the body edges
    const m = Number(J?.rowMargin) || 15;
    const d = R(Math.min(Math.max(Number(J?.rowDepth) || (upstand + depth) / 2, dMin), dMax));
    for (let i = 0; i < n; i += 1) holes.push({ across: R(bodyFrom + m + (n === 1 ? (bodyW - 2 * m) / 2 : (i * (bodyW - 2 * m)) / (n - 1))), depth: d });
  } else {
    // a narrow body: a vertical row at its centre, spread over the usable depth
    const a = R(bodyFrom + bodyW / 2);
    for (let i = 0; i < n; i += 1) holes.push({ across: a, depth: R(n === 1 ? (dMin + dMax) / 2 : dMin + (i * (dMax - dMin)) / (n - 1)) });
  }
  return { holes, dia, length: Number(J?.dowel?.length) || dia * 5, bodyW };
}

/**
 * The body band of a member's end face: the face width minus the rebate on
 * the edges that carry glass or a panel. `rebated` = { low, high } flags for
 * the two edges (low = the reference edge).
 */
export function bodyBand(face, rebateDepth, rebated) {
  const from = rebated?.low ? rebateDepth : 0;
  const to = face - (rebated?.high ? rebateDepth : 0);
  return { bodyFrom: R(from), bodyTo: R(to) };
}
