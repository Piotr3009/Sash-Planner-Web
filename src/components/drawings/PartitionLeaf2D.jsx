/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * PartitionLeaf2D.jsx (25.10.2026): the door leaf of a partition wall on its
 * own sheet, the door leaf sheet layout: the leaf from the FRONT (the swing
 * face of an outward door), the daylight with its applied bars, the dashed
 * unit edge, the mid rail and the panel, the hinge recesses on the hinge edge
 * with their positions from the leaf top, the lever handle on its spindle with
 * the handle height and the backset, the lock edge rebate line, the member
 * labels from the cut list records, the stile chain along the bottom, the rail
 * and bar chain on the left, the width at the TOP and the height on the RIGHT.
 */
import { useMemo } from 'react';
import { displayCode } from '../../engine/partSymbols.js';
import { DimH, DimV, DimChainH, DimChainV, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, fmt, safely, NoSheet, OpeningSymbol, BarDetail, HandleSymbol, SheetTitle, sectionText } from './doorSheetParts.jsx';
import { wrapNotes } from './partitionDrawUtils.js';

function build(windowSpec, derived, doorN) {
  const pw = derived?.partition;
  if (!windowSpec || !pw) return null;
  const d = pw.doors.find((x) => x.n === doorN) || pw.doors[0];
  if (!d) return null;
  const recs = (derived.components?.sash || []).filter((r) => String(r.notes || '').startsWith(`D${d.n}`));
  const rec = (code) => recs.find((r) => r.code === code) || null;
  return { pw, d, recs: { hinge: rec('W-DS/H'), lock: rec('W-DS/L'), top: rec('W-DTR'), mid: rec('W-DMR'), bottom: rec('W-DBR') } };
}

export default function PartitionLeaf2D({ windowSpec, derived, projectNumber, windowTag, door }) {
  const geom = useMemo(() => safely(() => build(windowSpec, derived, door)), [windowSpec, derived, door]);
  if (!geom) return <NoSheet text="No door in this wall." />;
  const { pw, d, recs } = geom;
  const lf = d.leaf;
  const W = lf.w, H = lf.h;
  const m = d.members;
  const layoutSc = Math.max(W, H) / 500;
  const ML = 90 * layoutSc, MR = 130 * layoutSc, MT = 80 * layoutSc, MB = 80 * layoutSc;
  const svgW = ML + W + MR;
  const ts = svgW / VIEWBOX_REF;
  const ox = ML, oy = MT;
  const X = (x) => ox + (x - lf.x);
  const Y = (y) => oy + (y - lf.y);
  const codeFs = SIZES.code * ts;
  const hingeLeft = d.hingeSide === 'left';
  const day = d.daylight;
  const unit = { x: day.x - pw.section.glassIn, y: day.y - pw.section.glassIn, w: d.unit.w, h: d.unit.h };
  // the applied bars in the BarDetail shape (frame coordinates)
  const bars = { frame: { vBars: [], hBars: d.bars.map((b) => ({ top: b.y, bot: b.y + b.h, cy: b.y + b.h / 2 })) } };
  const hingeEdgeX = hingeLeft ? lf.x : lf.x + lf.w;
  const lockEdgeX = hingeLeft ? lf.x + lf.w : lf.x;
  const inDir = hingeLeft ? -1 : 1;
  const spindleX = lockEdgeX + inDir * d.latch.spindleFromEdge;
  const handleY = d.latch.wallY;
  const hingeYs = d.hinges.positions.map((p) => lf.y + p);

  // chains: stiles along the bottom; the rails, lights and bars on the left
  const hCuts = [lf.x, lf.x + m.stile, lf.x + W - m.stile, lf.x + W];
  const vCuts = [lf.y, lf.y + m.top, ...d.bars.flatMap((b) => [b.y, b.y + b.h])];
  if (d.midRail) vCuts.push(d.midRail.y, d.midRail.y + d.midRail.h);
  vCuts.push(d.bottomRail.y, lf.y + H);
  const vc = [...new Set(vCuts.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  // the hinge chain on the right: the leaf top to each hinge centre and to the bottom
  const hingeCuts = [lf.y, ...hingeYs, lf.y + H];

  const labels = [
    { place: hingeLeft ? 'left' : 'right', text: recs.hinge ? `${displayCode(recs.hinge.code)} ${fmt(recs.hinge.length)} · ${sectionText(recs.hinge.section)} · hinge` : '' },
    { place: hingeLeft ? 'right' : 'left', text: recs.lock ? `${displayCode(recs.lock.code)} ${fmt(recs.lock.length)} · ${sectionText(recs.lock.section)} · lock` : '' },
    { place: 'top', text: recs.top ? `${displayCode(recs.top.code)} ${fmt(recs.top.length)} · ${sectionText(recs.top.section)}` : '' },
    { place: 'bottom', text: recs.bottom ? `${displayCode(recs.bottom.code)} ${fmt(recs.bottom.length)} · ${sectionText(recs.bottom.section)}` : '' },
    ...(d.midRail && recs.mid ? [{ place: 'mid', text: `${displayCode(recs.mid.code)} ${fmt(recs.mid.length)} · ${sectionText(recs.mid.section)}` }] : []),
  ].filter((l) => l.text);
  const at = {
    left: { x: X(lf.x + m.stile / 2), rot: true },
    right: { x: X(lf.x + W - m.stile / 2), rot: true },
    top: { y: Y(lf.y + m.top / 2) },
    bottom: { y: Y(lf.y + H - m.bottom / 2) },
    mid: d.midRail ? { y: Y(d.midRail.y + d.midRail.h / 2) } : null,
  };
  const yMid = Y(lf.y + H / 2);

  const notes = wrapNotes([
    `Leaf ${fmt(W)} x ${fmt(H)} x ${fmt(lf.depth)} in a ${fmt(d.w)} x ${fmt(d.openingH)} opening: ${fmt(d.x + d.w - lf.x - lf.w)} / ${fmt(lf.x - d.x)} at the sides, ${fmt(lf.y - (pw.topRail.y + pw.topRail.h))} at the head, ${fmt(pw.totalHeight - lf.y - lf.h)} above the floor`,
    `Unit ${fmt(d.unit.w)} x ${fmt(d.unit.h)} (${pw.section.makeup}, safety glass) ${fmt(pw.section.glassIn)} into the pocket; applied ${fmt(pw.members.bar)} bars both faces on the screen lines${d.panel ? `; panel ${fmt(d.panel.size.w)} x ${fmt(d.panel.size.h)} x ${fmt(d.panel.size.t)}` : ''}`,
    `Hinges: ${d.hinges.count} x ${d.hinges.name}, centres ${d.hinges.positions.map(fmt).join(' / ')} from the leaf top, knuckles on the ${d.swingFace} face (opens ${d.swing})`,
    `Latch: ${d.latch.kind}, ${fmt(d.latch.caseLength)} case, backset ${fmt(d.latch.backset)} from the rebated edge (spindle ${fmt(d.latch.spindleFromEdge)} from the lip edge), handle ${fmt(d.latch.fromFloor)} above the floor; lock edge rebate ${fmt(d.lockEdge.rebate.w)} x ${fmt(d.lockEdge.rebate.d)} behind the ${fmt(d.lockEdge.lip)} lip, ${d.headEdge ? 'the same at the head' : 'plain head'}`,
  ], svgW - 2 * 30 * ts, codeFs);
  const titleY = oy + H + MB;
  const svgH = titleY + (44 + 18 * notes.length) * ts;
  const winName = windowSpec?.name || 'Partition';
  const projNum = projectNumber || '';
  const lockLineX = lockEdgeX + inDir * d.lockEdge.rebate.w;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        <rect x={X(lf.x)} y={Y(lf.y)} width={W} height={H} fill="rgba(148,163,184,0.03)" stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        {/* the unit edge (dashed, behind the pocket) and the daylight */}
        <rect x={X(unit.x)} y={Y(unit.y)} width={unit.w} height={unit.h} fill="none" stroke={COLORS.glass} strokeWidth={STROKES.rebate} {...NS}
          strokeOpacity={0.5} strokeDasharray={`${4 * ts},${3 * ts}`} />
        <rect x={X(day.x)} y={Y(day.y)} width={day.w} height={day.h} fill={COLORS.glass} fillOpacity={0.06} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        <BarDetail day={day} bars={bars} X={X} Y={Y} notch={3 * ts} />
        {/* the mid rail edges and the panel */}
        {d.midRail && (
          <line x1={X(d.midRail.x)} y1={Y(d.midRail.y + d.midRail.h)} x2={X(d.midRail.x + d.midRail.w)} y2={Y(d.midRail.y + d.midRail.h)}
            stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        )}
        {d.panel && (
          <>
            <rect x={X(d.panel.x - pw.section.glassIn)} y={Y(d.panel.y - pw.section.glassIn)} width={d.panel.size.w} height={d.panel.size.h} fill="none"
              stroke={COLORS.sash} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.5} strokeDasharray={`${4 * ts},${3 * ts}`} />
            <rect x={X(d.panel.x)} y={Y(d.panel.y)} width={d.panel.w} height={d.panel.h} fill={COLORS.frameFill} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
            <Label x={X(d.panel.x + d.panel.w / 2)} y={Y(d.panel.y + d.panel.h / 2) + 5 * ts} text={`PANEL ${fmt(d.panel.size.w)} × ${fmt(d.panel.size.h)}`} vbw={svgW} />
          </>
        )}
        <OpeningSymbol r={lf} hinge={d.hingeSide} X={X} Y={Y} dash={`${6 * ts},${4 * ts}`} />
        {/* the lock edge rebate: the step line behind the lip, full height */}
        <line x1={X(lockLineX)} y1={Y(lf.y)} x2={X(lockLineX)} y2={Y(lf.y + H)} stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
          strokeDasharray={`${8 * ts},${3 * ts},${2 * ts},${3 * ts}`} />
        {/* the hinge recesses on the hinge edge */}
        {hingeYs.map((hy, k) => (
          <rect key={`h${k}`} x={X(hingeEdgeX) - (hingeLeft ? 0 : d.hinges.flap)} y={Y(hy - d.hinges.length / 2)} width={d.hinges.flap} height={d.hinges.length}
            fill={COLORS.label} fillOpacity={0.35} stroke={COLORS.label} strokeWidth={STROKES.sashLight} {...NS} />
        ))}
        {/* the latch: the forend on the lock edge, the spindle with the lever */}
        <rect x={X(lockEdgeX) - (hingeLeft ? d.latch.forend.thickness : 0)} y={Y(handleY - d.latch.forend.length / 2)} width={d.latch.forend.thickness}
          height={d.latch.forend.length} fill={COLORS.sillDetail} stroke={COLORS.sillDetail} strokeWidth={STROKES.sashLight} {...NS} />
        <HandleSymbol cx={X(spindleX)} cy={Y(handleY)} r={5 * ts} lever={16 * ts} towards={hingeLeft ? 'left' : 'right'} />

        {/* member labels */}
        {labels.map((l, i) => {
          const p = at[l.place];
          if (!p) return null;
          return p.rot ? (
            <text key={`ml${i}`} x={p.x + codeFs * 0.35} y={yMid} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle"
              fontWeight={WEIGHTS.label} transform={`rotate(-90, ${p.x + codeFs * 0.35}, ${yMid})`}>{l.text}</text>
          ) : (
            <text key={`ml${i}`} x={X(lf.x + W / 2)} y={p.y + codeFs * 0.35} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle"
              fontWeight={WEIGHTS.label}>{l.text}</text>
          );
        })}

        {/* dimensions */}
        <DimChainH y={oy + H + 24 * ts} cuts={hCuts.map(X)} extFrom={oy + H + 4 * ts} vbw={svgW} fmt={fmt} />
        <DimH y={oy + H + 50 * ts} x1={X(Math.min(spindleX, lockEdgeX))} x2={X(Math.max(spindleX, lockEdgeX))} extFrom={oy + H + 4 * ts}
          label={`spindle ${fmt(d.latch.spindleFromEdge)}`} small vbw={svgW} />
        <DimChainV x={ox - 24 * ts} cuts={vc.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} fmt={fmt} />
        <DimChainV x={ox + W + 30 * ts} cuts={hingeCuts.map(Y)} extFrom={ox + W + 4 * ts} vbw={svgW} fmt={fmt} />
        <DimV x={ox + W + 62 * ts} y1={Y(handleY)} y2={Y(lf.y + H)} extFrom={ox + W + 4 * ts} label={`handle ${fmt(d.latch.fromFloor)} above the floor (${fmt(lf.y + H - handleY)} on the leaf)`} small vbw={svgW} />
        <DimV x={ox + W + 96 * ts} y1={Y(lf.y)} y2={Y(lf.y + H)} extFrom={X(lf.x + W)} label={fmt(H)} vbw={svgW} />
        <DimH y={oy - 30 * ts} x1={X(lf.x)} x2={X(lf.x + W)} extFrom={Y(lf.y)} label={fmt(W)} vbw={svgW} />

        <SheetTitle x={svgW / 2} y={titleY} title={`Door Leaf${pw.doors.length > 1 ? ` D${d.n}` : ''}${projNum ? ` · ${projNum}` : ''} · ${winName}`}
          subtitle={`${fmt(W)} × ${fmt(H)} × ${fmt(lf.depth)} · ${d.hingeSide} hand, opens ${d.swing} · front (${d.swingFace === 'front' ? 'swing' : 'stop'}) face`} notes={notes} ts={ts} vbw={svgW} />
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
