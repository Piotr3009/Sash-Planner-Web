/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * FireDoorElevation2D.jsx (27.10.2026, fire doors v1): the two elevations of
 * the owner's drawing kit (KIT_DOOR_SINGLE.lsp B and C) as one sheet each.
 *
 * view 'outside' (drawDoorOutside, the PULL side): the frame outer lines, the
 * 35 face, the jambs standing the floor gap below the leaf, the 45 mitre
 * lines at the head corners, the leaf outline with its hinge edge line (and
 * the frame's inner line beside it) INTERRUPTED at the three hinges, the
 * hinge rectangles with three bearing lines, the handle rose on the spindle
 * with the lever towards the hinge side, the euro cylinder or bathroom turn
 * symbol at the cylinder height (nothing for a latch), the vision panel panes
 * (the diamond rotated), the handing label under the door and the door name,
 * and the dimensions as the LSP places them: the frame height on the far
 * left, the leaf height nearer, the leaf width above the frame and the frame
 * width above that (OUTSIDE_HEIGHT_DIMS_SIDE in fireDoorDrawUtils). The
 * structural opening (v1.1, derived.firedoor.opening) is the dashed rectangle
 * around the frame (wallGapSide outside each jamb, wallGapHead above the
 * head, its sill on the floor line) with its overall width above the frame
 * width and its overall height outside the frame height, both one step
 * further out than the frame dimensions.
 * view 'inside' (drawDoorInside, the PUSH side): the 50 face lapping the leaf
 * edge, the leaf dashed behind it, no hinges, the handle and the lock symbol
 * mirrored; the frame width at the top and the frame height on the right
 * (the LSP draws no dimensions on this view, the house rule places them).
 *
 * Every number comes from derived.firedoor through fireDoorElevationGeometry;
 * the literals here are drawing layout in text units (ts) and the LSP's
 * ironmongery symbol sizes (IRON).
 */
import { useMemo } from 'react';
import { DimH, DimV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { fireDoorElevationGeometry, IRON, OUTSIDE_HEIGHT_DIMS_SIDE, diamondPoints, leverPoints, hingeWord, openingWord, closerWord, hingeRuleWord, pullFaceNote, ratingWord, wrapLines } from './fireDoorDrawUtils.js';

/** The pieces of [from, to] left after cutting out every [a, b] of `cuts`. */
function segments(from, to, cuts) {
  const sorted = [...cuts].sort((p, q) => p[0] - q[0]);
  const out = [];
  let pos = from;
  for (const [a, b] of sorted) {
    if (a > pos) out.push([pos, a]);
    pos = Math.max(pos, b);
  }
  if (pos < to) out.push([pos, to]);
  return out;
}

export default function FireDoorElevation2D({ windowSpec, derived, projectNumber, windowTag, view = 'outside' }) {
  const g = useMemo(() => safely(() => fireDoorElevationGeometry(derived, view)), [derived, view]);
  if (!g) return <NoSheet text="No fire door data." />;
  const { fd, frame, leaf, inside, hinges, spindle, cylinder, panes, label, dirToHinge, hingeEdgeX, lockEdgeX, hingesOnLeft, floorGap, gapSide, gapHead, faceOut, faceIn } = g;
  const FW = frame.w, FH = frame.h, face = frame.face;
  const W = leaf.w, H = leaf.h;
  const fr = fd.frame || {};
  // the structural opening (v1.1) is drawn and dimensioned on the outside view only
  const op = !inside ? g.opening : null;

  // margins in text units: the outside view carries two height dims on the
  // LSP side (three with the opening, one step further out), the inside view
  // the frame height on the right (house rule); the top carries the leaf and
  // frame widths (and the opening width above them on the outside view)
  const leftDims = !inside && OUTSIDE_HEIGHT_DIMS_SIDE === 'left';
  const DIM_STEP = 38;                       // one more dimension column / row, text units
  const opExtra = op ? DIM_STEP : 0;
  const mL = leftDims ? 92 + opExtra : 24;
  const mR = inside ? 64 : (leftDims ? 24 : 92 + opExtra);
  const mT = 92 + opExtra, mB = 80;
  // the margins frame the widest thing drawn: the opening when there is one, else the frame
  const drawW = op ? op.w : FW;
  const svgW = drawW / (1 - (mL + mR) / VIEWBOX_REF);
  const ts = svgW / VIEWBOX_REF;
  const ox = mL * ts + (op ? op.gapSide : 0), oy = mT * ts;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const labelFs = SIZES.label * ts;
  const nameFs = SIZES.subtitle * ts;
  const codeFs = SIZES.code * ts;
  const dash = `${8 * ts},${4 * ts}`;

  const frameLine = (k, x1, y1, x2, y2) => (
    <line key={k} x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
  );
  const leafLine = (k, x1, y1, x2, y2) => (
    <line key={k} x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} strokeDasharray={inside ? dash : undefined} />
  );
  const iron = { fill: 'none', stroke: COLORS.sillDetail, strokeWidth: STROKES.sash, ...NS };
  const hingeCuts = inside ? [] : hinges.map((h) => [h.top, h.bottom]);
  // the frame's inner line on the hinge side and the leaf's hinge edge are
  // interrupted at the hinges (the outside view); every other line is whole
  const hingeJambInnerX = hingesOnLeft ? face : FW - face;
  const otherJambInnerX = hingesOnLeft ? FW - face : face;
  const pts = (list) => list.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');

  const winName = windowSpec?.name || fd.name || 'Fire door';
  const projNum = projectNumber || '';
  const vp = fd.vp || {};
  const lock = fd.lock || {};
  const hp = (fd.hinges?.positions || []).map((p) => fmt(p.top)).join(' / ');
  const intu = fd.intumescent;
  const notes = wrapLines([
    pullFaceNote(fd),
    inside
      ? `Push side: the ${fmt(faceIn)} face laps the leaf edge by ${fmt(faceIn - faceOut - gapSide)} at the sides and the head (the leaf shown dashed behind it); no hinges on this face; the handle and the cylinder mirrored from the outside view`
      : `Pull side: frame ${fmt(fr.thickness)} x ${fmt(fr.depth)} rebated from solid ${fmt(fr.rebate?.width)} x ${fmt(fr.rebate?.depth)}, ${fmt(faceOut)} face on this side and ${fmt(faceIn)} on the push side; gaps ${fmt(gapSide)} at the sides and ${fmt(gapHead)} at the head, the jambs stand ${fmt(floorGap)} below the leaf; head corners mitred 45`,
    op ? `Structural opening ${fmt(op.w)} x ${fmt(op.h)} (dashed): the frame ${fmt(op.gapSide)} in from each side and ${fmt(op.gapHead)} below the opening top, its foot on the floor line` : '',
    `Hinges: ${fmt(fd.hinges?.count)} x ${fmt(fd.hinges?.length)} ${fd.hinges?.product || ''} at ${hp} from the leaf top to the hinge top (the rule: ${hingeRuleWord(fd)})`,
    `Lock: ${lock.type || ''}, spindle ${fmt(lock.spindle?.fromBottom)} above the leaf bottom, backset ${fmt(lock.backset)}; ${cylinder ? `${cylinder.kind} cylinder ${fmt(cylinder.fromBottom)} above the leaf bottom` : 'no cylinder hole'}; the lever points to the hinge side`,
    panes.length
      ? `Vision panel ${vp.label || vp.style}: ${panes.map((p) => `${fmt(p.paneW)} x ${fmt(p.paneH)}${p.diamond ? ' diamond' : ''}`).join(', ')}, layout per bSolid macro (drawn centred across the leaf, the first pane ${fmt(panes[0].y - leaf.y)} from the leaf top)${(vp.warnings || []).length ? `; ${vp.warnings.join('; ')}` : ''}`
      : 'No vision panel',
    `${closerWord(fd)}; ${intu ? `intumescent ${intu.label || ''}, groove ${fmt(intu.groove?.width)} x ${fmt(intu.groove?.depth)} (${Number(intu.metres).toFixed(3)} m)` : 'no intumescent strip'}; door blank ${fmt(leaf.t)} thick (${ratingWord(fd)})`,
  ], svgW - 2 * 30 * ts, codeFs);
  const titleY = Y(FH) + mB * ts;
  // the subtitle wrapped at its own font size to the sheet width (30 text
  // units of margin each side, as the notes), breaking only at its ' · '
  // separators (the Plan sheet's pattern): with the opening (v1.1) it is
  // longer than a narrow door's sheet; the notes follow the last subtitle line
  const subFs = SIZES.subtitle * ts;
  const subLines = wrapLines([
    [ratingWord(fd), `${fmt(W)} × ${fmt(H)} × ${fmt(leaf.t)} in ${fmt(FW)} × ${fmt(FH)}`, openingWord(fd), hingeWord(fd)].filter(Boolean).join(' · '),
  ], svgW - 2 * 30 * ts, subFs, ' · ');
  const notesY = titleY + 20 * Math.max(0, subLines.length - 1) * ts;
  const svgH = notesY + (44 + 18 * notes.length) * ts;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        {/* ── the structural opening (outside view): a dashed rectangle around the frame, its sill on the floor line ── */}
        {op && (
          <rect x={X(op.x0)} y={Y(op.y0)} width={op.w} height={op.h} fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={dash} />
        )}

        {/* ── the frame: outer lines, the visible face, the feet, the mitres ── */}
        {frameLine('ol', 0, 0, 0, FH)}
        {frameLine('or', FW, 0, FW, FH)}
        {frameLine('ot', 0, 0, FW, 0)}
        {frameLine('ih', face, face, FW - face, face)}
        {frameLine('ij', otherJambInnerX, face, otherJambInnerX, FH)}
        {segments(face, FH, hingeCuts).map(([a, b], k) => frameLine(`ihj${k}`, hingeJambInnerX, a, hingeJambInnerX, b))}
        {frameLine('fl', 0, FH, face, FH)}
        {frameLine('fr', FW - face, FH, FW, FH)}
        {frameLine('ml', 0, 0, face, face)}
        {frameLine('mr', FW, 0, FW - face, face)}

        {/* ── the leaf: top, bottom, lock edge whole; the hinge edge interrupted at the hinges ── */}
        <rect x={X(leaf.x)} y={Y(leaf.y)} width={W} height={H} fill="rgba(148,163,184,0.03)" stroke="none" />
        {leafLine('lt', leaf.x, leaf.y, leaf.x + W, leaf.y)}
        {leafLine('lb', leaf.x, leaf.y + H, leaf.x + W, leaf.y + H)}
        {leafLine('ll', lockEdgeX, leaf.y, lockEdgeX, leaf.y + H)}
        {segments(leaf.y, leaf.y + H, hingeCuts).map(([a, b], k) => leafLine(`lh${k}`, hingeEdgeX, a, hingeEdgeX, b))}

        {/* ── the vision panel panes ── */}
        {panes.map((p) => (
          <g key={`vp${p.i}`}>
            {p.diamond
              ? <polygon points={pts(diamondPoints(p))} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity} stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />
              : <rect x={X(p.x)} y={Y(p.y)} width={p.w} height={p.h} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity} stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />}
            {!inside && <Label x={X(p.x + p.w / 2)} y={Y(p.y + p.h / 2) + 5 * ts} text={`VP ${fmt(p.paneW)} × ${fmt(p.paneH)}`} vbw={svgW} />}
          </g>
        ))}

        {/* ── the hinges (outside view): the rectangle over the leaf edge with three bearing lines ── */}
        {!inside && hinges.map((h) => (
          <g key={`h${h.i}`}>
            <rect x={X(h.x0)} y={Y(h.top)} width={h.x1 - h.x0} height={h.bottom - h.top} fill={COLORS.sillDetail} fillOpacity={0.35} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={X(h.x0)} y1={Y(h.top + (h.bottom - h.top) * f)} x2={X(h.x1)} y2={Y(h.top + (h.bottom - h.top) * f)} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            ))}
          </g>
        ))}

        {/* ── the handle: the rose on the spindle, the lever towards the hinge ── */}
        {spindle && (
          <g>
            <circle cx={X(spindle.x)} cy={Y(spindle.y)} r={IRON.rose.r} {...iron} />
            <polygon points={pts(leverPoints(spindle.x, spindle.y, dirToHinge))} {...iron} strokeLinejoin="round" />
          </g>
        )}
        {/* ── the cylinder: euro (keyhole) or bathroom (turn) at the cylinder height ── */}
        {cylinder && cylinder.kind === 'euro' && (
          <g>
            <circle cx={X(cylinder.x)} cy={Y(cylinder.y)} r={IRON.rose.r} {...iron} />
            <circle cx={X(cylinder.x)} cy={Y(cylinder.y - IRON.euro.up)} r={IRON.euro.innerR} {...iron} />
            <path d={`M ${X(cylinder.x - IRON.euro.slotW / 2)} ${Y(cylinder.y - IRON.euro.up)} L ${X(cylinder.x + IRON.euro.slotW / 2)} ${Y(cylinder.y - IRON.euro.up)} L ${X(cylinder.x + IRON.euro.slotW / 2)} ${Y(cylinder.y - IRON.euro.up + IRON.euro.slotH - IRON.euro.fillet)} A ${IRON.euro.fillet} ${IRON.euro.fillet} 0 0 1 ${X(cylinder.x)} ${Y(cylinder.y - IRON.euro.up + IRON.euro.slotH)} A ${IRON.euro.fillet} ${IRON.euro.fillet} 0 0 1 ${X(cylinder.x - IRON.euro.slotW / 2)} ${Y(cylinder.y - IRON.euro.up + IRON.euro.slotH - IRON.euro.fillet)} Z`} {...iron} />
          </g>
        )}
        {cylinder && cylinder.kind === 'bathroom' && (
          <g>
            <circle cx={X(cylinder.x)} cy={Y(cylinder.y)} r={IRON.rose.r} {...iron} />
            <circle cx={X(cylinder.x)} cy={Y(cylinder.y)} r={IRON.bathroom.innerR} {...iron} />
            <line x1={X(cylinder.x - IRON.bathroom.line / 2)} y1={Y(cylinder.y)} x2={X(cylinder.x + IRON.bathroom.line / 2)} y2={Y(cylinder.y)} {...iron} />
          </g>
        )}

        {/* ── the handing label and the door name under the door (the LSP's text block) ── */}
        <text x={X(leaf.x + W / 2)} y={Y(FH) + 28 * ts} fill={COLORS.label} fontSize={labelFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{label}</text>
        <text x={X(leaf.x + W / 2)} y={Y(FH) + 50 * ts} fill={COLORS.title} fontSize={nameFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.title}>{winName}</text>

        {/* ── dimensions ── */}
        {inside ? (
          <>
            <DimH y={Y(0) - 30 * ts} x1={X(0)} x2={X(FW)} extFrom={Y(0)} label={fmt(FW)} vbw={svgW} />
            <DimV x={X(FW) + 36 * ts} y1={Y(0)} y2={Y(FH)} extFrom={X(FW)} label={fmt(FH)} vbw={svgW} />
          </>
        ) : (
          <>
            <DimH y={Y(0) - 28 * ts} x1={X(leaf.x)} x2={X(leaf.x + W)} extFrom={Y(leaf.y)} label={fmt(W)} small vbw={svgW} />
            <DimH y={Y(0) - 60 * ts} x1={X(0)} x2={X(FW)} extFrom={Y(0)} label={fmt(FW)} vbw={svgW} />
            {/* the structural opening: its width one row above the frame width, its height one column outside the frame height */}
            {op && <DimH y={Y(0) - (60 + DIM_STEP) * ts} x1={X(op.x0)} x2={X(op.x1)} extFrom={Y(op.y0)} label={fmt(op.w)} vbw={svgW} />}
            {leftDims ? (
              <>
                <DimV x={X(0) - 70 * ts} y1={Y(0)} y2={Y(FH)} extFrom={X(0)} label={fmt(FH)} vbw={svgW} />
                <DimV x={X(0) - 32 * ts} y1={Y(leaf.y)} y2={Y(leaf.y + H)} extFrom={X(leaf.x)} label={fmt(H)} small vbw={svgW} />
                {op && <DimV x={X(0) - (70 + DIM_STEP) * ts} y1={Y(op.y0)} y2={Y(op.y1)} extFrom={X(op.x0)} label={fmt(op.h)} vbw={svgW} />}
              </>
            ) : (
              <>
                <DimV x={X(FW) + 70 * ts} y1={Y(0)} y2={Y(FH)} extFrom={X(FW)} label={fmt(FH)} vbw={svgW} />
                <DimV x={X(FW) + 32 * ts} y1={Y(leaf.y)} y2={Y(leaf.y + H)} extFrom={X(leaf.x + W)} label={fmt(H)} small vbw={svgW} />
                {op && <DimV x={X(FW) + (70 + DIM_STEP) * ts} y1={Y(op.y0)} y2={Y(op.y1)} extFrom={X(op.x1)} label={fmt(op.h)} vbw={svgW} />}
              </>
            )}
          </>
        )}

        <SheetTitle x={svgW / 2} y={titleY} title={`${g.viewWord} Elevation${projNum ? ` · ${projNum}` : ''} · ${winName}`} subtitle={subLines[0]} ts={ts} vbw={svgW} />
        {subLines.slice(1).map((t, i) => (
          <text key={`s${i}`} x={svgW / 2} y={titleY + (40 + 20 * i) * ts} fill={COLORS.subtitle} fontSize={subFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={notesY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
