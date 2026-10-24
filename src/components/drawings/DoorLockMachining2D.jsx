/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorLockMachining2D.jsx (Piotr 24.10.2026)
 *
 * The LOCK MACHINING sheet of a door: the edge the lock sits in, laid down
 * (the leaf bottom on the LEFT, the spindle axis the datum), one band per
 * machined edge:
 *   single door   the lock stile edge (ThunderBolt) and the lock side jamb
 *                 rebate wall (the keeps);
 *   french door   the ACTIVE meeting stile lip edge (ThunderBolt or FGTE
 *                 master) and the PASSIVE meeting stile shoulder (the three
 *                 ThunderBolt keeps, or the FGTE slave).
 * Along each band everything is to scale (mm): the faceplate recess, the
 * pockets (hatched), the spindle and cylinder, the keeps (plate and pocket).
 * ACROSS a band the face is drawn schematically (one band height for every
 * edge) with the lock axis at its measured place from the lip face; the real
 * widths and depths are in the table under the bands, every row with the
 * position from the leaf bottom AND from the spindle (the macro datum).
 *
 * Every number comes from derived.door (deriveDoorWindow: leaves[i].machining,
 * jambMachining, meeting, spindleFromLeafBottom), built by
 * engine/doorLockMachining.js from the Winkhaus data sheets; nothing is
 * computed here beyond sheet layout.
 */
import { useMemo } from 'react';
import { DimH, DimV, TitleBlock, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { NS, num, fmtGlass, safely, NoSheet, roleName, handingText } from './doorSheetParts.jsx';

// machining numbers print to 0.1 mm (12.2, 1144.5): the macro reads them as they are
const fmt = fmtGlass;

const BAND_H = 130;          // schematic band height (sheet units)
const BAND_PITCH = 520;      // band to band (caption and label rows above each band)
const ROW = 58;              // table row pitch
const CHAR = 0.55;

const C = { fill: 'rgba(148,163,184,0.05)', plate: 'rgba(148,163,184,0.35)', pocket: 'rgba(14,165,233,0.22)', keep: 'rgba(234,179,8,0.25)', hole: '#f87171' };

function buildBands(derived) {
  const dr = derived?.door;
  if (!dr) return null;
  const leaves = [...(dr.leaves || [])].filter((l) => l.machining);
  if (!leaves.length) return null;
  // the active (or single) leaf first, then the passive leaf or the jamb
  const order = { single: 0, active: 0, passive: 1 };
  leaves.sort((a, b) => (order[a.role] ?? 2) - (order[b.role] ?? 2));
  const bands = leaves.map((l) => ({
    key: l.role, m: l.machining,
    caption: [`${roleName(l.role).toUpperCase()}${l.role === 'single' ? ' LEAF' : ' LEAF'}: ${l.machining.edge}`, l.machining.kit],
  }));
  if (dr.jambMachining) {
    bands.push({ key: 'jamb', m: dr.jambMachining, caption: [`JAMB ${dr.jambMachining.side === 'left' ? 'L' : 'R'}: ${dr.jambMachining.edge}`, dr.jambMachining.kit] });
  }
  return { dr, bands, leafH: leaves[0].h };
}

/** The table rows of one band: [item, from bottom, to, length, width, depth, from spindle]. */
function rowsOf(m) {
  const rows = [];
  const span = (a, b) => `${fmt(a)} to ${fmt(b)}`;
  if (m.faceplate) {
    const f = m.faceplate;
    rows.push([`faceplate recess${f.fullLength ? ' (full height)' : ''}`, fmt(f.fromBottom), fmt(f.toBottom), fmt(f.toBottom - f.fromBottom), fmt(f.width), fmt(f.depth), span(f.from, f.to)]);
  }
  if (m.rodChannel) rows.push([`rod channel (${m.rodChannel.over || 'full height'})`, '', '', '', fmt(m.rodChannel.width), fmt(m.rodChannel.depth), '']);
  (m.pockets || []).forEach((p) => rows.push([`pocket ${p.key}${p.optional ? ' (optional)' : ''}`, fmt(p.fromBottom), fmt(p.toBottom), fmt(p.length), fmt(p.width), fmt(p.depth), span(p.from, p.to)]));
  (m.holes || []).forEach((h) => rows.push([`${h.key} bore, backset ${fmt(h.x)}`, fmt(h.atBottom), '', '', '', '', fmt(h.at)]));
  (m.keeps || []).forEach((k) => {
    rows.push([`${k.code} plate`, fmt(k.plate.fromBottom), fmt(k.plate.toBottom), fmt(k.plate.toBottom - k.plate.fromBottom), fmt(k.plate.width), fmt(k.plate.depth), span(k.plate.from, k.plate.to)]);
    rows.push([`${k.code} pocket`, fmt(k.pocket.fromBottom), fmt(k.pocket.toBottom), fmt(k.pocket.toBottom - k.pocket.fromBottom), fmt(k.pocket.width), fmt(k.pocket.depth), span(k.pocket.from, k.pocket.to)]);
  });
  (m.endPlates || []).forEach((e) => rows.push([`end plate ${e.key}`, fmt(e.fromBottom), fmt(e.toBottom), fmt(e.toBottom - e.fromBottom), fmt(e.width), fmt(e.depth), span(e.from, e.to)]));
  return rows;
}

export default function DoorLockMachining2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => buildBands(derived)), [derived]);
  if (!geom) return <NoSheet text="No lock machining for this door." />;
  const { dr, bands, leafH } = geom;

  const ML = 120, MR = 220, MT = 200;
  const svgW = ML + leafH + MR;
  const ts = svgW / VIEWBOX_REF;
  const codeFs = SIZES.code * ts;
  const labelFs = SIZES.label * ts;
  const X = (fromBottom) => ML + fromBottom;                       // along the band: mm from the leaf bottom
  const bandTop = (i) => MT + i * BAND_PITCH + 330;                 // caption and label rows sit above the band
  const rowY = (top, r) => top - 10 * ts - r * 1.5 * codeFs;         // text rows above a band: 0 to 2 labels; 3, 4 caption
  const spindle = num(dr.spindleFromLeafBottom);

  // Table under the bands
  // column starts relative to ML, in characters of the code text (the
  // collision rule's 0.55 x font size per character), so the columns scale
  // with the sheet: item 33, from 8, to 8, length 8, width 7, depth 7, spindle
  const colW = CHAR * codeFs;
  const COLS = [0, 33, 41, 49, 57, 64, 71].map((c) => c * colW);
  const HEAD = ['item', 'from', 'to', 'length', 'width', 'depth', 'from spindle'];
  const tableTop = bandTop(bands.length - 1) + BAND_H + 160;
  const tableRows = bands.flatMap((b) => [{ head: b.caption[0] }, ...rowsOf(b.m).map((r) => ({ cells: r }))]);
  const tableH = (tableRows.length + 1) * ROW;
  const titleY = tableTop + tableH + 60;

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const titleText = `Lock Machining${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `${dr.isFrench ? 'French door' : 'Single door'} · ${handingText(dr)} · spindle ${spindle != null ? fmt(spindle) : '?'} above the leaf bottom`;
  const meeting = dr.meeting;
  const d0 = bands[0].m.datum;
  // notes: short lines (the sheet is as wide as the leaf is tall; a line over
  // ~78 code characters would leave the sheet)
  const wrap = (t, max = 78) => {
    const words = String(t).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const notes = [
    ...(meeting && num(meeting.gap, 0) > 0 ? [
      `Meeting rebate ${fmt(meeting.rebateWidth)} wide (lap ${fmt(meeting.overlap)} + gap ${fmt(meeting.gap)}), full leaf height`,
      `Active lip ${fmt(meeting.lipActive)} on the ${meeting.lapFace}, cut ${fmt(meeting.cutActive)} deep from the other face; passive lip ${fmt(meeting.lipPassive)}, cut ${fmt(meeting.cutPassive)}`,
      `${fmt(meeting.sealSpace)} between the lips; seal groove ${fmt(meeting.sealGroove)} in the passive shoulder at the lip`,
    ] : []),
    bands[0].m.edge === 'lock stile'
      ? `Lock axis ${fmt(d0.axisFromFace)} from the leaf face (centred); backset ${fmt(d0.backset)}; cylinder 92 below the spindle`
      : `Lock axis ${fmt(d0.axisFromFace)} from the ${d0.axisFace} lip face (margin ${fmt(d0.edgeMargin)} + plate ${fmt(d0.plateWidth)} / 2); backset ${fmt(d0.backset)}; cylinder 92 below`,
    'Along the edge to scale, the face across schematic; widths and depths in the table (Winkhaus data sheets 24.10.2026)',
    ...bands.flatMap((b) => (b.m.notes || []).map((t) => `${b.caption[0].split(':')[0]}: ${t}`)),
  ].filter(Boolean).flatMap((t) => wrap(t));
  const svgH = titleY + (44 + 18 * notes.length) * ts;

  const hatchId = `hatch-${String(windowSpec?.id || windowSpec?.name || 'door').replace(/[^a-zA-Z0-9]/g, '_')}`;

  const renderBand = (b, i) => {
    const m = b.m;
    const top = bandTop(i);
    const faceW = num(m.faceWidth, 0) > 0 ? m.faceWidth : num(dr.leafDepth, 57);
    // across the band: the lock axis at axisFromFace / faceW, a width w as w / faceW
    const yOf = (fromFace) => top + (fromFace / faceW) * BAND_H;
    const hOf = (w) => (w / faceW) * BAND_H;
    const axisY = yOf(m.datum.axisFromFace);
    const bandRect = (x0, x1, w, fill, stroke, key, dash) => (
      <rect key={key} x={X(x0)} y={axisY - hOf(w) / 2} width={Math.max(0, x1 - x0)} height={hOf(w)} fill={fill}
        stroke={stroke} strokeWidth={STROKES.sash} {...NS} strokeDasharray={dash} />
    );
    // labels above the band, two staggered rows so neighbours never meet
    // labels above the band: key and the span from the leaf bottom (widths and
    // depths are in the table); three staggered rows, each kept inside the band
    const labelled = [
      ...(m.pockets || []).map((p) => ({ x: (p.fromBottom + p.toBottom) / 2, text: `${p.key} ${fmt(p.fromBottom)} to ${fmt(p.toBottom)}` })),
      ...(m.keeps || []).map((k) => ({ x: k.centreBottom, text: `${k.code} at ${fmt(k.centreBottom)}` })),
      ...(m.endPlates || []).map((e) => ({ x: (e.fromBottom + e.toBottom) / 2, text: `end plate ${fmt(e.fromBottom)} to ${fmt(e.toBottom)}` })),
    ].sort((a, c) => a.x - c.x);
    const clampX = (x, text) => {
      const half = text.length * CHAR * codeFs / 2;
      return Math.min(Math.max(x, half), leafH - half);
    };
    return (
      <g key={`band-${b.key}`}>
        {/* caption above the band, at its left end (rows 3 and 2) */}
        {b.caption.map((t, k) => (
          <text key={`cap${k}`} x={X(0)} y={rowY(top, 4 - k)} fill={COLORS.label} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="start" fontWeight={k === 0 ? WEIGHTS.label : WEIGHTS.subtitle}>{t}</text>
        ))}
        {/* the edge face */}
        <rect x={X(0)} y={top} width={leafH} height={BAND_H} fill={C.fill} stroke={COLORS.sash} strokeWidth={STROKES.outer} {...NS} />
        {/* faceplate recess / keep rail */}
        {m.faceplate && bandRect(m.faceplate.fromBottom, m.faceplate.toBottom, m.faceplate.width, C.plate, COLORS.frame, 'fp')}
        {/* keeps: plate then pocket */}
        {(m.keeps || []).map((k) => (
          <g key={k.key}>
            {bandRect(k.plate.fromBottom, k.plate.toBottom, k.plate.width, C.keep, COLORS.frame, `${k.key}-p`)}
            {bandRect(k.pocket.fromBottom, k.pocket.toBottom, k.pocket.width, `url(#${hatchId})`, COLORS.sash, `${k.key}-k`)}
          </g>
        ))}
        {/* pockets, hatched */}
        {(m.pockets || []).map((p) => bandRect(p.fromBottom, p.toBottom, p.width, `url(#${hatchId})`, p.optional ? COLORS.sillDetail : COLORS.sash, p.key, p.optional ? `${6 * ts},${4 * ts}` : undefined))}
        {(m.endPlates || []).map((e) => bandRect(e.fromBottom, e.toBottom, e.width, C.plate, COLORS.frame, e.key))}
        {/* spindle and cylinder on the lock axis */}
        {(m.holes || []).map((h) => (
          <circle key={h.key} cx={X(h.atBottom)} cy={axisY} r={(h.key === 'spindle' ? 4 : 3) * ts} fill="none" stroke={C.hole} strokeWidth={STROKES.sash} {...NS} />
        ))}
        {spindle != null && (
          <line x1={X(spindle)} y1={top - 10 * ts} x2={X(spindle)} y2={top + BAND_H + 10 * ts}
            stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={`${8 * ts},${3 * ts},${2 * ts},${3 * ts}`} />
        )}
        {/* pocket / keep labels, two rows */}
        {labelled.map((l, k) => {
          const y = rowY(top, k % 3);
          const tx = X(clampX(l.x, l.text));
          return (
            <g key={`lb${k}`}>
              <line x1={X(l.x)} y1={top} x2={tx} y2={y + 4 * ts} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />
              <text x={tx} y={y} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{l.text}</text>
            </g>
          );
        })}
        {/* the face width across this band, rotated, right of the band */}
        <DimV x={X(leafH) + 44 * ts} y1={top} y2={top + BAND_H} extFrom={X(leafH)} label={m.faceWidth != null ? `${fmt(faceW)} face` : `${fmt(faceW)}`} vbw={svgW} />
      </g>
    );
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" style={{ background: COLORS.bg }}>
        <defs>
          <pattern id={hatchId} width={8 * ts} height={8 * ts} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8 * ts} height={8 * ts} fill={C.pocket} />
            <line x1="0" y1="0" x2="0" y2={8 * ts} stroke={COLORS.glass} strokeWidth={1.2 * ts} />
          </pattern>
        </defs>
        {/* the leaf height along the first band (the overall width of this sheet, at the top) */}
        <DimH y={MT - 80} x1={X(0)} x2={X(leafH)} extFrom={bandTop(0)} label={fmt(leafH)} vbw={svgW} />
        {bands.map(renderBand)}
        {/* the spindle datum, written as a label (the dimension sits in the table) */}
        {spindle != null && (
          <text x={X(spindle)} y={bandTop(bands.length - 1) + BAND_H + 22 * ts} fill={COLORS.label} fontSize={labelFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{`spindle ${fmt(spindle)} above the leaf bottom`}</text>
        )}
        {/* the table */}
        <g>
          {HEAD.map((h, c) => (
            <text key={`h${c}`} x={ML + COLS[c]} y={tableTop} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{h}</text>
          ))}
          <line x1={ML} y1={tableTop + 8 * ts} x2={ML + COLS[6] + 14 * colW} y2={tableTop + 8 * ts} stroke={COLORS.frame} strokeWidth={STROKES.ext} {...NS} />
          {tableRows.map((r, k) => {
            const y = tableTop + (k + 1) * ROW;
            if (r.head) {
              return <text key={`r${k}`} x={ML} y={y} fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.label}>{r.head}</text>;
            }
            return r.cells.map((cell, c) => (cell ? (
              <text key={`r${k}c${c}`} x={ML + COLS[c]} y={y} fill={COLORS.subtitle} fontSize={codeFs} fontFamily={FONT_FAMILY} fontWeight={WEIGHTS.subtitle}>{cell}</text>
            ) : null));
          })}
        </g>
        <TitleBlock x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
