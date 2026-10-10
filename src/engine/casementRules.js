/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CASEMENT FRAME RULES, shared (doors v3, Piotr 09.10.2026).
//
// The formulas the casement engine (deriveCasementWindow) applies inside its
// frame: the leaf size in a field between two bounds (a frame edge or a member
// axis), the leaf corner, the full-height mullion and the transom segment. The
// door engine (deriveDoorWindow) calls the SAME functions with the door
// profile numbers: one copy of each formula, never a second one inside the
// door code. Every function is pure and keeps the casement arithmetic as it
// was written inline (same operations, same order), so a casement window
// derives byte-identical.
//
// A field bound `b` is the casement paneBounds record:
//   { leftAxis, rightAxis, leftIsJamb, rightIsJamb, topIsHead, bottomIsCill,
//     topAxisT, bottomAxisT }
// x from the frame's left outer edge, the T values from the frame TOP.
// ─────────────────────────────────────────────────────────────────────────────

/** One decimal, CNC-ready (the engines' R). */
const R1 = (v) => Math.round(v * 10) / 10;

/**
 * Leaf width in a field: the span between its two bounds less the edge
 * deduction on each side, leafAtJamb at a frame jamb, leafAtMullionAxis at a
 * member axis (default 51 / 17).
 */
export function leafWidthInField(span, leftIsJamb, rightIsJamb, ded) {
    return span
        - (leftIsJamb ? ded.leafAtJamb : ded.leafAtMullionAxis)
        - (rightIsJamb ? ded.leafAtJamb : ded.leafAtMullionAxis);
}

/**
 * Leaf height in its tier (T = frame top to the transom axis):
 *   head to cill    frameHeight - leafFullHeight
 *   fan tier        bottomAxisT - fanFromAxis
 *   lower tier      frameHeight - topAxisT - lowerFromAxis
 *   middle tier     (bottomAxisT - topAxisT) - middleTierFromAxes (UNCONFIRMED)
 * `ded` carries those four numbers (the casement profile deductions, or the
 * door numbers composed into the same names).
 */
export function leafHeightInTier(b, frameHeight, ded) {
    let leafH;
    let heightNote = '';
    if (b.topIsHead && b.bottomIsCill) {
        leafH = frameHeight - ded.leafFullHeight;
    } else if (b.topIsHead) {
        leafH = b.bottomAxisT - ded.fanFromAxis;                 // fan tier
    } else if (b.bottomIsCill) {
        leafH = frameHeight - b.topAxisT - ded.lowerFromAxis;    // lower tier
    } else {
        leafH = (b.bottomAxisT - b.topAxisT) - ded.middleTierFromAxes; // 3-tier middle
        heightNote = 'UNCONFIRMED middle-tier deduction';
    }
    return { leafH, heightNote };
}

/**
 * The leaf's top-left corner (frame top-left origin, exterior view): land +
 * gap at a jamb / the head, half the mullion land + gap at a mullion axis,
 * the transom land below the axis + the gap under a transom. Unrounded.
 */
export function leafOrigin(b, geo) {
    const x = b.leftIsJamb
        ? geo.land + geo.gap
        : b.leftAxis + geo.mullionLand / 2 + geo.gap;
    const y = b.topIsHead
        ? geo.land + geo.gap
        : b.topAxisT + geo.transomLandBelow + geo.gapBelowTransom;
    return { x, y };
}

/**
 * The x of a field's visible frame edge on one side ('L' | 'R'): the frame
 * land at a jamb, half the mullion land at a mullion axis.
 */
export function fieldLandX(b, side, frameWidth, geo) {
    return side === 'L'
        ? (b.leftIsJamb ? geo.land : b.leftAxis + geo.mullionLand / 2)
        : (b.rightIsJamb ? frameWidth - geo.land : b.rightAxis - geo.mullionLand / 2);
}

/**
 * Full-height mullion (runs through the transoms): frameHeight -
 * lengths.mullion (77 = the head seat part 36 + the cill part, the visible
 * cill 41). Without a timber cill (a door on an aluminium or low-profile
 * threshold) the mullion runs to the floor line: the cill part is 0, so the
 * length is frameHeight - (lengths.mullion - cillVisible). Unrounded.
 */
export function mullionLength(frameHeight, lengths, geo, timberCill = true) {
    return timberCill
        ? frameHeight - lengths.mullion
        : frameHeight - (lengths.mullion - geo.cillVisible);
}

/**
 * Drawing-ready run of a full-height mullion at axisX: the visible land band
 * (axis +- half the mullion land) from the head land down to the cill top (or
 * to the floor line without a timber cill), with its cut length.
 */
export function fullMullionRun(axisX, frameHeight, geo, lengths, code, timberCill = true) {
    return {
        axisX: R1(axisX), full: true,
        x1: R1(axisX - geo.mullionLand / 2), x2: R1(axisX + geo.mullionLand / 2),
        yTop: geo.land, yBottom: timberCill ? R1(frameHeight - geo.cillVisible) : R1(frameHeight),
        code, length: R1(mullionLength(frameHeight, lengths, geo, timberCill)),
    };
}

/** A transom segment cut length: the leaf width of its field + the seat (8.5). */
export function transomSegmentLength(fieldLeafW, lengths) {
    return fieldLeafW + lengths.transomSeat;
}

/**
 * Drawing-ready run of one transom segment at axis T: the land band is
 * asymmetric around the axis (transomLandAbove 8 above, transomLandBelow 13
 * below), x1 / x2 the visible ends.
 */
export function transomRun(axisT, x1, x2, geo, code, fieldLeafW, lengths) {
    return {
        axisT, x1: R1(x1), x2: R1(x2),
        bandTop: R1(axisT - geo.transomLandAbove),
        bandBottom: R1(axisT + geo.transomLandBelow),
        code, length: R1(transomSegmentLength(fieldLeafW, lengths)),
    };
}
