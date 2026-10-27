/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * FireDoorPlan2D.jsx (27.10.2026, fire doors v1): the plan of the owner's
 * drawing kit (KIT_DOOR_SINGLE.lsp D) as one sheet: the door closed and open
 * (IRON.openAngle) side by side, seen from above with the PULL face (the 35
 * frame face) at the bottom of the page. The L shaped rebated jambs (the
 * engine's thickness x depth with the rebate width x depth notch on the
 * opening side), the leaf (its thickness) flush with the pull face in the
 * rebate, the hinge symbol (the knuckle in the gap in front of the pull face,
 * the flaps let into the leaf edge and the rebate cheek), the handle on both
 * faces (rose, neck, lever towards the hinge), the open leaf swung about the
 * knuckle with its opening arc, the labels "Closed" and "Open 30", the leaf
 * width under the closed view and the frame depth on its left. A
 * multi-detail sheet: the dimension rule of the elevations does not govern it.
 * Every number comes from derived.firedoor through fireDoorPlanGeometry.
 */
import { useMemo } from 'react';
import { DimH, DimV, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { fireDoorPlanGeometry, hingeWord, swingWord, pullFaceNote, ratingWord, wrapLines } from './fireDoorDrawUtils.js';

export default function FireDoorPlan2D({ windowSpec, derived, projectNumber, windowTag }) {
  const g = useMemo(() => safely(() => fireDoorPlanGeometry(derived)), [derived]);
  if (!g) return <NoSheet text="No fire door data." />;
  const { fd, FW, depth, thk, faceOut, rebW, rebD, gap, W, T, hingeLeft, knuckle, open } = g;

  const mL = 60, mR = 24, mT = 30, mB = 44;
  const viewGap = 54;                       // between the closed and the open view, text units
  const drawW = 2 * FW;
  const svgW = drawW / (1 - (mL + mR + viewGap) / VIEWBOX_REF);
  const ts = svgW / VIEWBOX_REF;
  const ox = mL * ts, oy = mT * ts;
  const zTop = g.zMax;
  const ox2 = ox + FW + viewGap * ts;      // the open view's origin
  const P = (x, z, o = ox) => [o + x, oy + (zTop - z)];
  const poly = (pts, o) => pts.map(([x, z]) => P(x, z, o).join(',')).join(' ');
  const labelFs = SIZES.label * ts;
  const codeFs = SIZES.code * ts;
  const dash = `${8 * ts},${4 * ts}`;
  const jambStyle = { fill: COLORS.sectionFill, fillOpacity: 0.16, stroke: COLORS.frame, strokeWidth: STROKES.section, ...NS };
  const leafStyle = { fill: COLORS.sectionFill, fillOpacity: 0.08, stroke: COLORS.sash, strokeWidth: STROKES.sash, ...NS };
  const iron = { fill: COLORS.sillDetail, fillOpacity: 0.5, stroke: COLORS.sillDetail, strokeWidth: STROKES.sash, ...NS };
  const handleStyle = { fill: 'none', stroke: COLORS.sillDetail, strokeWidth: STROKES.sash, strokeLinejoin: 'round', ...NS };

  // the closed view's lowest point (the pull face handle) and the open view's (the swung leaf)
  const closedBottomY = P(0, g.closedZMin)[1];
  const openBottomY = P(0, g.zMin)[1];
  const widthDimY = closedBottomY + 24 * ts;
  const closedLabelY = widthDimY + 26 * ts;
  const openLabelY = Math.max(openBottomY, widthDimY) + 26 * ts;
  const titleY = Math.max(closedLabelY, openLabelY) + mB * ts;

  const winName = windowSpec?.name || fd.name || 'Fire door';
  const projNum = projectNumber || '';
  const rec = fd.hinges?.recess || {};
  const notes = wrapLines([
    `${pullFaceNote(fd)}; seen from above with the pull face at the bottom of the page, the hinge on the ${hingeLeft ? 'left' : 'right'}`,
    `Jambs ${fmt(thk)} x ${fmt(depth)} with the rebate ${fmt(rebW)} x ${fmt(rebD)} from solid (${fmt(rebW - gap)} overlap + ${fmt(gap)} gap across the thickness, leaf ${fmt(T)} + ${fmt(rebD - T)} along the depth); the leaf closes flush with the pull face (the bottom of the page): ${fmt(faceOut)} face on the pull side, ${fmt(thk)} on the push side`,
    `Hinge knuckle in the ${fmt(gap)} gap in front of the pull face; flaps ${fmt(rec.depth)} deep let into the leaf edge and the rebate cheek, ${fmt(rec.width)} across the thickness; handle ${fmt(g.backset)} from the lock edge on both faces, lever to the hinge; the open view swings the leaf ${fmt(g.openAngle)} degrees about the knuckle`,
  ], svgW - 2 * 30 * ts, codeFs);
  const svgH = titleY + (44 + 18 * notes.length) * ts;

  const arc = open.arc;
  const [ax, ay] = P(arc.from[0], arc.from[1], ox2);
  const [bx, by] = P(arc.to[0], arc.to[1], ox2);
  const arcPath = `M ${ax} ${ay} A ${arc.r} ${arc.r} 0 0 ${arc.clockwise ? 1 : 0} ${bx} ${by}`;

  const view = (o, key, leafPts, flapPts, hPull, hPush) => (
    <g key={key}>
      {g.jambs.map((j, k) => <polygon key={`j${k}`} points={poly(j, o)} {...jambStyle} />)}
      <polygon points={poly(leafPts, o)} {...leafStyle} />
      <circle cx={P(knuckle.x, knuckle.z, o)[0]} cy={P(knuckle.x, knuckle.z, o)[1]} r={knuckle.r} {...iron} />
      <polygon points={poly(g.fixedFlap, o)} {...iron} />
      <polygon points={poly(flapPts, o)} {...iron} />
      <polygon points={poly(hPull, o)} {...handleStyle} />
      <polygon points={poly(hPush, o)} {...handleStyle} />
    </g>
  );

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        {/* ── closed ── */}
        {view(ox, 'closed', g.leaf, g.movingFlap, g.handlePull, g.handlePush)}
        <text x={ox + FW / 2} y={closedLabelY} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>Closed</text>
        <DimH y={widthDimY} x1={P(g.leafX0, 0)[0]} x2={P(g.leafX1, 0)[0]} extFrom={P(0, 0)[1]} label={fmt(W)} vbw={svgW} />
        <DimV x={ox - 30 * ts} y1={P(0, depth)[1]} y2={P(0, 0)[1]} extFrom={ox} label={fmt(depth)} vbw={svgW} />

        {/* ── open ── */}
        {view(ox2, 'open', open.leaf, open.movingFlap, open.handlePull, open.handlePush)}
        <path d={arcPath} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash} />
        <text x={ox2 + FW / 2} y={openLabelY} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{`Open ${fmt(g.openAngle)}`}</text>

        <SheetTitle x={svgW / 2} y={titleY} title={`Plan${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={`${ratingWord(fd)} · leaf ${fmt(W)} × ${fmt(T)} · frame ${fmt(thk)} × ${fmt(depth)} · ${hingeWord(fd)} · ${swingWord(fd)}`}
          notes={notes} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
