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
 * v1.2 (28.10.2026): the vision panel panes drawn by their shape (a rect with
 * its corner radius, a circle, the diamond), on the outside view labelled
 * ('VP dia 300' for a round pane; turned up the pane when the label is wider
 * than a narrow pane) and dimensioned from the panel group: the across chain
 * from the edge the position mode measures from (centred: both edges)
 * through every pane and gap, under the group (over it for a panel measured
 * from the bottom), and the down dimension in the right margin (the group top
 * from the leaf top; the group bottom or centre above the leaf bottom for
 * those modes). The closer symbol (derived.firedoor.closer.symbol, never
 * machined): the surface closer (body, arm, shoe on the head face) solid on
 * the view of its face, the built in closer's body in the leaf top and track
 * in the head dashed on both views, each with its short note.
 *
 * v1.3 (owner 28.10.2026, the Weeke rule): the hinge note prints the hinge
 * positions as the hinge LOWER edge above the LEAF BOTTOM (positions[i].
 * fromBottom, H1 = the top hinge) and the lock note the spindle above the
 * floor with its height above the leaf bottom in brackets (spindleWord).
 *
 * Every number comes from derived.firedoor through fireDoorElevationGeometry;
 * the literals here are drawing layout in text units (ts) and the LSP's
 * ironmongery symbol sizes (IRON).
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, safely, NoSheet, SheetTitle } from './doorSheetParts.jsx';
import { fdNum as fmt, fireDoorElevationGeometry, IRON, OUTSIDE_HEIGHT_DIMS_SIDE, diamondPoints, leverPoints, hingeWord, openingWord, closerWord, closerSymbolWord, hingeRuleWord, hingePositionsWord, spindleWord, intuWord, paneLabel, pullFaceNote, ratingWord, vpAcrossChain, vpGlassWord, wrapLines } from './fireDoorDrawUtils.js';

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
  const { fd, frame, leaf, inside, hinges, spindle, cylinder, panes, label, dirToHinge, hingeEdgeX, lockEdgeX, hingesOnLeft, floorGap, gapSide, gapHead, faceOut, faceIn, vpGroup, closer } = g;
  const FW = frame.w, FH = frame.h, face = frame.face;
  const W = leaf.w, H = leaf.h;
  const fr = fd.frame || {};
  // the structural opening (v1.1) is drawn and dimensioned on the outside view only
  const op = !inside ? g.opening : null;
  // v1.2: the vision panel position is dimensioned on the outside view only (the
  // inside view keeps the house dimension rule: the overall sizes only)
  const vpDims = !inside && vpGroup ? vpGroup : null;

  // margins in text units: the outside view carries two height dims on the
  // LSP side (three with the opening, one step further out), the inside view
  // the frame height on the right (house rule); the top carries the leaf and
  // frame widths (and the opening width above them on the outside view); the
  // outside view's right margin carries the vision panel's down dimension
  const leftDims = !inside && OUTSIDE_HEIGHT_DIMS_SIDE === 'left';
  const DIM_STEP = 38;                       // one more dimension column / row, text units
  const opExtra = op ? DIM_STEP : 0;
  const mL = leftDims ? 92 + opExtra : 24;
  const mR = inside ? 64 : (leftDims ? (vpDims ? 64 : 24) : 92 + opExtra + (vpDims ? DIM_STEP : 0));
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
  const intu = fd.intumescent;
  // v1.2: the closer note says which face carries the symbol (the surface closer is drawn on its face's view)
  const closerNote = closer?.kind === 'surface'
    ? `${closerWord(fd)} on the ${closer.face} face (drawn on the ${closer.face === 'push' ? 'inside' : 'outside'} elevation)`
    : closer?.kind === 'builtin' ? `${closerWord(fd)}: concealed in the leaf top and the head (dashed on both elevations)` : closerWord(fd);
  const glassWord = vpGlassWord(fd);
  const notes = wrapLines([
    pullFaceNote(fd),
    inside
      ? `Push side: the ${fmt(faceIn)} face laps the leaf edge by ${fmt(faceIn - faceOut - gapSide)} at the sides and the head (the leaf shown dashed behind it); no hinges on this face; the handle and the cylinder mirrored from the outside view`
      : `Pull side: frame ${fmt(fr.thickness)} x ${fmt(fr.depth)} rebated from solid ${fmt(fr.rebate?.width)} x ${fmt(fr.rebate?.depth)}, ${fmt(faceOut)} face on this side and ${fmt(faceIn)} on the push side; gaps ${fmt(gapSide)} at the sides and ${fmt(gapHead)} at the head, the jambs stand ${fmt(floorGap)} below the leaf; head corners mitred 45`,
    op ? `Structural opening ${fmt(op.w)} x ${fmt(op.h)} (dashed): the frame ${fmt(op.gapSide)} in from each side and ${fmt(op.gapHead)} below the opening top, its foot on the floor line` : '',
    // v1.3: the hinge positions are the hinge lower edge above the leaf bottom; the spindle from the floor with the leaf bottom value in brackets
    `Hinges: ${fmt(fd.hinges?.count)} x ${fmt(fd.hinges?.length)} ${fd.hinges?.product || ''} at ${hingePositionsWord(fd)} (the rule: ${hingeRuleWord(fd)})`,
    `Lock: ${lock.type || ''}, ${spindleWord(fd)}, backset ${fmt(lock.backset)}; ${cylinder ? `${cylinder.kind} cylinder ${fmt(cylinder.fromBottom)} above the leaf bottom` : 'no cylinder hole'}; the lever points to the hinge side`,
    panes.length
      ? `Vision panel ${vp.label || vp.style}${vp.positionLabel ? `; ${vp.positionLabel}` : ''}${glassWord ? `; glass ${glassWord}` : ''}${(vp.warnings || []).length ? `; ${vp.warnings.join('; ')}` : ''}`
      : 'No vision panel',
    `${closerNote}; ${intu ? `intumescent ${intuWord(fd)}, groove ${fmt(intu.groove?.width)} x ${fmt(intu.groove?.depth)} (${Number(intu.metres).toFixed(3)} m)` : 'no intumescent strip'}; door blank ${fmt(leaf.t)} thick (${ratingWord(fd)})`,
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

  // ── v1.2: the pane labels (turned up a pane narrower than its label) ──
  const paneFs = SIZES.label * ts;
  const paneTexts = panes.map((p) => {
    const text = paneLabel(p, fmt);
    const turned = text.length * 0.55 * paneFs > 0.92 * p.w && p.h > p.w;
    return { p, text, turned, x: X(p.x + p.w / 2), y: Y(p.y + p.h / 2) + 5 * ts };
  });
  // ── v1.2: the vision panel position (outside view): the across chain under the
  // group (over it for a panel measured from the bottom), its extension lines from
  // the panes' sides (the tangent points of a round pane, the tips of a diamond);
  // the down dimension in the right margin ──
  let across = null, down = null;
  if (vpDims) {
    const below = vpDims.down !== 'bottom';
    const curved = panes.some((p) => p.shape !== 'rect');
    const centres = panes.map((p) => p.y + p.h / 2);
    const extY = curved ? (below ? Math.max(...centres) : Math.min(...centres)) : (below ? vpDims.y1 : vpDims.y0);
    const ch = vpAcrossChain(panes.map((p) => ({ a: p.x, b: p.x + p.w, shape: p.shape, paneW: p.paneW })), hingeEdgeX, lockEdgeX, vpDims.across, fmt);
    across = { y: Y(below ? vpDims.y1 : vpDims.y0) + (below ? 30 : -30) * ts, extFrom: Y(extY), cuts: ch.cuts.map(X), labels: ch.labels };
    const right = panes.reduce((a, p) => (p.x + p.w > a.x + a.w ? p : a), panes[0]);
    const extX = vpDims.down === 'centre' || right.shape === 'rect' ? vpDims.x1 : right.x + right.w / 2;
    const midY = (vpDims.y0 + vpDims.y1) / 2;
    const dimX = leftDims ? X(FW) + 36 * ts : X(FW) + (70 + DIM_STEP + opExtra) * ts;
    down = vpDims.down === 'top'
      ? { x: dimX, y1: Y(leaf.y), y2: Y(vpDims.y0), label: fmt(vpDims.fromTop), extFrom: X(extX) }
      : vpDims.down === 'bottom'
        ? { x: dimX, y1: Y(vpDims.y1), y2: Y(leaf.y + H), label: fmt(vpDims.fromBottom), extFrom: X(extX) }
        : { x: dimX, y1: Y(midY), y2: Y(leaf.y + H), label: fmt(leaf.y + H - midY), extFrom: X(extX) };
  }
  // ── v1.2: the closer symbol: the surface closer solid on its face's view, the built in one dashed on both ──
  const showCloser = !!closer && (closer.kind === 'builtin' || closer.visible);
  const closerText = showCloser ? closerSymbolWord(fd) : '';
  const closerTextY = showCloser ? Y(closer.body.y1) + 1.4 * codeFs : 0;
  const armBar = (a) => {
    const dx = a.x2 - a.x1, dy = a.y2 - a.y1, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (a.width / 2), ny = (dx / len) * (a.width / 2);
    return [[a.x1 + nx, a.y1 + ny], [a.x2 + nx, a.y2 + ny], [a.x2 - nx, a.y2 - ny], [a.x1 - nx, a.y1 - ny]];
  };

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

        {/* ── the vision panel panes, each by its shape (v1.2): rect with its corner radius, circle, diamond ── */}
        {panes.map((p) => {
          const glass = { fill: COLORS.glass, fillOpacity: COLORS.glassOpacity, stroke: COLORS.glass, strokeWidth: STROKES.glass, ...NS };
          return (
            <g key={`vp${p.i}`}>
              {p.shape === 'diamond' ? <polygon points={pts(diamondPoints(p))} {...glass} />
                : p.shape === 'round' ? <circle cx={X(p.x + p.w / 2)} cy={Y(p.y + p.h / 2)} r={p.r || p.w / 2} {...glass} />
                  : <rect x={X(p.x)} y={Y(p.y)} width={p.w} height={p.h} rx={p.r || 0} {...glass} />}
            </g>
          );
        })}
        {!inside && paneTexts.map((t) => (
          <text key={`vpl${t.p.i}`} x={t.x} y={t.y} fill={COLORS.label} fontSize={paneFs} fontFamily={FONT_FAMILY} textAnchor="middle" fillOpacity={0.8} fontWeight={WEIGHTS.label}
            transform={t.turned ? `rotate(-90, ${t.x}, ${t.y - 5 * ts})` : undefined}>{t.text}</text>
        ))}

        {/* ── the closer symbol (v1.2, never machined) ── */}
        {showCloser && closer.kind === 'surface' && (
          <g>
            <rect x={X(closer.body.x0)} y={Y(closer.body.y0)} width={closer.body.x1 - closer.body.x0} height={closer.body.y1 - closer.body.y0} fill={COLORS.sillDetail} fillOpacity={0.3} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
            <rect x={X(closer.shoe.x0)} y={Y(closer.shoe.y0)} width={closer.shoe.x1 - closer.shoe.x0} height={closer.shoe.y1 - closer.shoe.y0} fill={COLORS.sillDetail} fillOpacity={0.3} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
            <polygon points={pts(armBar(closer.arm))} fill={COLORS.sillDetail} fillOpacity={0.5} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} strokeLinejoin="round" />
            <circle cx={X(closer.arm.x1)} cy={Y(closer.arm.y1)} r={closer.arm.width / 2} {...iron} />
          </g>
        )}
        {showCloser && closer.kind === 'builtin' && (
          <g>
            <rect x={X(closer.body.x0)} y={Y(closer.body.y0)} width={closer.body.x1 - closer.body.x0} height={closer.body.y1 - closer.body.y0} fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} strokeDasharray={dash} />
            <rect x={X(closer.track.x0)} y={Y(closer.track.y0)} width={closer.track.x1 - closer.track.x0} height={closer.track.y1 - closer.track.y0} fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} strokeDasharray={dash} />
          </g>
        )}
        {showCloser && closerText && (
          <text x={X(closer.hingeX)} y={closerTextY} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor={hingesOnLeft ? 'start' : 'end'} fillOpacity={0.8} fontWeight={WEIGHTS.label}>{closerText}</text>
        )}

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
            {/* v1.2: the vision panel position: the across chain at the group, the down dimension in the right margin */}
            {across && <DimChainH y={across.y} cuts={across.cuts} extFrom={across.extFrom} labels={across.labels} vbw={svgW} fmt={fmt} />}
            {down && <DimV x={down.x} y1={down.y1} y2={down.y2} extFrom={down.extFrom} label={down.label} small vbw={svgW} />}
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
