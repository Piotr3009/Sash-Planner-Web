/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * PartitionElevation2D.jsx (25.10.2026): the FRONT elevation of a meeting
 * room partition wall, seen from the corridor (the plan drawing's front), in
 * the door drawing system: mm coordinates, dark theme, non-scaling strokes,
 * the Dim helpers, the overall width at the TOP, the heights on the RIGHT, the
 * field chain along the bottom and the member chain on the left. Every
 * position comes from derived.partition (engine/partition.js): the head and
 * end boards, the top rail, the posts, the screens (rails, lights, applied
 * bars, panel), the door leaf (stiles, rails, lights, panel, hinges, handle)
 * and its opening symbol. The sheet computes no sizes itself.
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, DimChainV, TitleBlock, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, num, fmt, safely, NoSheet, OpeningSymbol, HingeBarrels, HandleSymbol } from './doorSheetParts.jsx';

function build(windowSpec, derived) {
  const pw = derived?.partition;
  if (!windowSpec || !pw) return null;
  const W = num(pw.totalWidth), H = num(pw.totalHeight);
  if (!(W > 0 && H > 0)) return null;
  return { pw, W, H };
}

export default function PartitionElevation2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => build(windowSpec, derived)), [windowSpec, derived]);
  if (!geom) return <NoSheet />;
  const { pw, W, H } = geom;
  const m = pw.members;

  const layoutSc = Math.max(W, H) / 500;
  const ML = 110 * layoutSc, MR = 120 * layoutSc, MT = 70 * layoutSc;
  const svgW = ML + W + MR;
  const ts = svgW / VIEWBOX_REF;
  const ox = ML, oy = MT;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const dash = `${6 * ts},${4 * ts}`;
  const noteFs = SIZES.code * ts;

  const winName = windowSpec?.name || 'Partition';
  const projNum = projectNumber || '';
  const door = pw.doors[0] || null;
  const screen = pw.screens[0] || null;
  // the notes wrap to the sheet width (the code text scales with the sheet)
  const NOTE_CHARS = Math.floor((svgW - 2 * 30 * ts) / (0.55 * noteFs));
  const wrap = (t) => {
    const words = String(t).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > NOTE_CHARS && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const notes = [
    `Layout ${pw.layout}: ${pw.screens.length} screen${pw.screens.length === 1 ? '' : 's'}${screen ? ` ${fmt(screen.w)} wide` : ''}, ${pw.doors.length} door${pw.doors.length === 1 ? '' : 's'}${door ? ` ${fmt(door.w)} opening` : ''}; posts ${fmt(m.post)}, top rail ${fmt(m.topRail)} one piece, head and end boards ${fmt(m.board)} x ${fmt(pw.boardWidth)}; no threshold`,
    screen ? `Screens: ${pw.lightsPerScreen} light${pw.lightsPerScreen === 1 ? '' : 's'} ${fmt(pw.lightH)} high over ${pw.panelHeight > 0 ? `a ${fmt(pw.panelHeight)} panel and a ${fmt(m.midRail)} mid rail` : 'the bottom rail'}; one unit ${fmt(screen.unit.w)} x ${fmt(screen.unit.h)} (${pw.section.makeup}) with applied ${fmt(m.bar)} bars both faces` : '',
    door ? `Door: leaf ${fmt(door.leaf.w)} x ${fmt(door.leaf.h)} x ${fmt(door.leaf.depth)}, stiles ${fmt(m.stile)}, top ${fmt(m.doorTop)}, bottom ${fmt(m.doorBottom)}${door.midRail ? `, mid ${fmt(m.doorMid)} on the screen line` : ''}; ${door.hingeSide} hand, opens ${door.swing} (to the ${door.swingFace}), ${door.hinges.count} hinges at ${door.hinges.positions.map(fmt).join(' / ')} from the leaf top; handle ${fmt(door.latch.fromFloor)} above the floor` : '',
    `Solid oak, oiled; beads and the door stop on the ${pw.section.beadSide} face; ${pw.dowels.count} dowels ${pw.dowels.dia} x ${pw.dowels.length} (${pw.dowels.perJoint} per joint), no screws`,
  ].filter(Boolean).flatMap(wrap);

  const bottomAnn = 78 * ts;
  const TITLE = (54 + 18 * notes.length) * ts;
  const svgH = MT + H + bottomAnn + TITLE;
  const titleY = oy + H + bottomAnn + 16 * ts;
  const titleText = `Front Elevation${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `Partition wall ${pw.layout} · ${fmt(W)} × ${fmt(H)} · front (corridor) view`;

  // the field chain along the bottom: posts and fields between the end boards; the boards on a row of their own
  const xCuts = [];
  pw.posts.forEach((p, i) => { xCuts.push(p.x, p.x + p.w); if (pw.fields[i]) xCuts.push(pw.fields[i].x + pw.fields[i].w); });
  const xc = [...new Set(xCuts.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  // the member chain on the left (through a screen): head, top rail, lights and bars, mid rail, panel, bottom rail
  const yCuts = [0, m.board, pw.topRail.y + pw.topRail.h];
  if (screen) {
    screen.bars.forEach((b) => yCuts.push(b.y, b.y + b.h));
    if (screen.midRail) yCuts.push(screen.midRail.y, screen.midRail.y + screen.midRail.h);
    yCuts.push(screen.bottomRail.y);
  }
  yCuts.push(H);
  const yc = [...new Set(yCuts.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);

  const memberRect = (key, r, fill = COLORS.frameFill, stroke = COLORS.frame, sw = STROKES.frameLight) => (
    <rect key={key} x={X(r.x)} y={Y(r.y)} width={r.w} height={r.h} fill={fill} stroke={stroke} strokeWidth={sw} {...NS} />
  );
  const glassRect = (key, r) => (
    <rect key={key} x={X(r.x)} y={Y(r.y)} width={r.w} height={r.h} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
      stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
  );
  const barRect = (key, r) => (
    <rect key={key} x={X(r.x)} y={Y(r.y)} width={r.w} height={r.h} fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
  );

  const rightX = (k) => ox + W + (22 + 26 * k) * ts;
  const handleY = door ? door.latch.wallY : null;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        {/* ── the boards, the top rail, the posts ── */}
        {memberRect('head', pw.head)}
        {pw.ends.map((e, i) => memberRect(`end${i}`, e))}
        {memberRect('tr', pw.topRail)}
        {pw.posts.map((p) => memberRect(`p${p.i}`, { x: p.x, y: p.y, w: p.w, h: p.h }))}

        {/* ── the screens: rails, lights, bars, panel ── */}
        {pw.screens.map((s) => (
          <g key={`s${s.n}`}>
            {s.lights.map((l, k) => glassRect(`l${k}`, l))}
            {s.bars.map((b, k) => barRect(`b${k}`, b))}
            {s.midRail && memberRect('mr', s.midRail)}
            {s.panel && (
              <>
                {memberRect('pn', s.panel, COLORS.frameFill, COLORS.sash, STROKES.glassLight)}
                <Label x={X(s.panel.x + s.panel.w / 2)} y={Y(s.panel.y + s.panel.h / 2) + 5 * ts} text="PANEL" vbw={svgW} />
              </>
            )}
            {memberRect('br', s.bottomRail)}
          </g>
        ))}

        {/* ── the door: leaf outline, members as the gaps, lights, bars, panel, symbol, hinges, handle ── */}
        {pw.doors.map((d) => {
          const lf = d.leaf;
          const hingeEdgeX = d.hingeSide === 'left' ? lf.x : lf.x + lf.w;
          const lockEdgeX = d.hingeSide === 'left' ? lf.x + lf.w : lf.x;
          const inDir = d.hingeSide === 'left' ? -1 : 1;
          return (
            <g key={`d${d.n}`}>
              <rect x={X(lf.x)} y={Y(lf.y)} width={lf.w} height={lf.h} fill="rgba(148,163,184,0.03)" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
              {d.lights.map((l, k) => glassRect(`dl${k}`, l))}
              {d.bars.map((b, k) => barRect(`db${k}`, b))}
              {d.midRail && (
                <line x1={X(d.midRail.x)} y1={Y(d.midRail.y + d.midRail.h / 2)} x2={X(d.midRail.x + d.midRail.w)} y2={Y(d.midRail.y + d.midRail.h / 2)}
                  stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={`${8 * ts},${3 * ts},${2 * ts},${3 * ts}`} />
              )}
              {d.panel && (
                <>
                  <rect x={X(d.panel.x)} y={Y(d.panel.y)} width={d.panel.w} height={d.panel.h} fill={COLORS.frameFill} stroke={COLORS.sash} strokeWidth={STROKES.glassLight} {...NS} />
                  <Label x={X(d.panel.x + d.panel.w / 2)} y={Y(d.panel.y + d.panel.h / 2) + 5 * ts} text="PANEL" vbw={svgW} />
                </>
              )}
              <OpeningSymbol r={lf} hinge={d.hingeSide} X={X} Y={Y} dash={dash} />
              {d.swingFace === 'front' && <HingeBarrels edgeX={hingeEdgeX} ys={d.hinges.wallY} barrel={d.hinges.length} w={2.4 * ts} X={X} Y={Y} />}
              <HandleSymbol cx={X(lockEdgeX + inDir * d.latch.spindleFromEdge)} cy={Y(d.latch.wallY)} r={5 * ts} lever={16 * ts}
                towards={d.hingeSide === 'left' ? 'left' : 'right'} />
            </g>
          );
        })}

        {/* ── the floor line ── */}
        <line x1={X(-40)} y1={Y(H)} x2={X(W + 40)} y2={Y(H)} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />

        {/* ── dimensions: the width at the top, the heights on the right, the chains ── */}
        <DimH y={oy - 30 * ts} x1={X(0)} x2={X(W)} extFrom={Y(0)} label={fmt(W)} vbw={svgW} />
        <DimChainH y={oy + H + 24 * ts} cuts={xc.map(X)} extFrom={Y(H) + 4 * ts} vbw={svgW} fmt={fmt} minSegment={0} />
        <DimH y={oy + H + 50 * ts} x1={X(0)} x2={X(m.board)} extFrom={Y(H) + 4 * ts} label={`board ${fmt(m.board)}`} small vbw={svgW} />
        <DimH y={oy + H + 50 * ts} x1={X(W - m.board)} x2={X(W)} extFrom={Y(H) + 4 * ts} label={`board ${fmt(m.board)}`} small vbw={svgW} />
        <DimChainV x={ox - 24 * ts} cuts={yc.map(Y)} extFrom={X(0) - 4 * ts} vbw={svgW} fmt={fmt} />
        {door && (
          <DimV x={ox - 84 * ts} y1={Y(door.leaf.y)} y2={Y(door.leaf.y + door.leaf.h)} extFrom={X(0) - 64 * ts} label={`leaf ${fmt(door.leaf.h)}`} small vbw={svgW} />
        )}
        {handleY != null && (
          <DimV x={rightX(0)} y1={Y(handleY)} y2={Y(H)} extFrom={X(W)} label={`handle ${fmt(H - handleY)}`} small vbw={svgW} />
        )}
        <DimV x={rightX(handleY != null ? 1 : 0)} y1={Y(0)} y2={Y(H)} extFrom={X(W)} label={fmt(H)} vbw={svgW} />

        {/* ── title + notes ── */}
        <TitleBlock x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={noteFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
