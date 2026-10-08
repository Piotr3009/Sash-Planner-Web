/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorGlassDrawing2D.jsx: the factory drawing of ONE door sealed unit size
 * (08.10.2026, doors to production), the rectangular CasementGlassDrawing2D
 * layout: the unit outline, the edge seal (perimeter spacer line), the spacer
 * bars on the wood bar centre lines, the bar spacing chains along the bottom
 * and on the left, the overall width at the TOP and the height on the RIGHT,
 * the spec line (count, thickness, makeup, spec, finish, spacer) and the
 * pane locations on wrapped note lines.
 *
 * `group` is one element of groupDoorGlass(derived, windowSpec)
 * (doorDrawUtils.js): { key, w, h, finish, rep, units, panes }. The unit drawn
 * IS the engine's unit (derived.customGlassUnits[rep], the glass schedule) with
 * its bar axes (unit.bars.x / .y, mm from the unit's left / top edge). The edge
 * cover and the spacer bar width are the glazier numbers of the casement
 * profile `glass` block (readGlassProfile), shared with the glass PDF and the
 * glazier DXF.
 */
import { useMemo } from 'react';
import { getCasementProfile, DEFAULT_CASEMENT_PROFILE } from '../../engine/profile.js';
import { readGlassProfile } from '../../engine/glassBars.js';
import { DimChainH, DimChainV, DimH, DimV } from './drawingUtils.jsx';
import { COLORS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { NS, num, fmtGlass, safely, NoSheet, glassSpecText, SheetTitle } from './doorSheetParts.jsx';

// Characters of one note line: the note text scales with the sheet (the
// VIEWBOX_REF convention), so a line of this length fits a unit of any size.
const NOTE_CHARS = 80;

function buildGlass(windowSpec, derived, group) {
  if (!windowSpec || !group || derived?.category !== 'door') return null;
  const unit = derived.customGlassUnits?.[group.rep];
  const w = num(unit?.width, num(group.w));
  const h = num(unit?.height, num(group.h));
  if (!(w > 0 && h > 0)) return null;
  const type = windowSpec.glazing?.type || 'double';
  const G = safely(() => readGlassProfile(getCasementProfile(), type))
    || safely(() => readGlassProfile(DEFAULT_CASEMENT_PROFILE, type));
  if (!G) return null;
  const bars = unit?.bars || {};
  const xs = (Array.isArray(bars.x) ? bars.x : []).map(Number).filter(Number.isFinite);
  const ys = (Array.isArray(bars.y) ? bars.y : []).map(Number).filter(Number.isFinite);
  return {
    w, h, edge: G.edgeCover, spacer: G.barWidth,
    vBars: xs.map((cx) => ({ cx, left: cx - G.barWidth / 2, right: cx + G.barWidth / 2 })),
    hBars: ys.map((cy) => ({ cy, top: cy - G.barWidth / 2, bot: cy + G.barWidth / 2 })),
  };
}

export default function DoorGlassDrawing2D({ windowSpec, derived, group }) {
  const geom = useMemo(() => safely(() => buildGlass(windowSpec, derived, group)), [windowSpec, derived, group]);
  if (!geom) return <NoSheet />;

  const { w, h, edge } = geom;
  const layoutSc = Math.max(w, h) / 500;
  const ML = 80 * layoutSc, MR = 100 * layoutSc, MT = 80 * layoutSc, MB = 100 * layoutSc;
  const svgW = ML + w + MR;
  const ts = svgW / VIEWBOX_REF;
  const ox = ML, oy = MT;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const gz = windowSpec?.glazing || {};
  const isFrosted = group.finish === 'frosted';
  const patternId = `frost-door-${String(windowSpec?.id || windowSpec?.name || 'd').replace(/[^a-zA-Z0-9]/g, '_')}-${String(group.key).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const panes = group.panes || [];
  const spec = [
    `×${panes.length || 1}`,
    glassSpecText(windowSpec),
    gz.spec || '',
    group.finish || 'clear',
    `spacer ${gz.spacerColour || 'silver'}`,
  ].filter(Boolean).join(' · ');
  // The pane locations of a door are long ('fanlight over door (opening, top
  // hung leaf)'): they go on note lines of their own, wrapped, so the subtitle
  // never runs off the sheet of a narrow unit.
  const paneLines = [];
  panes.forEach((p, i) => {
    const item = `${p}${i < panes.length - 1 ? ',' : ''}`;
    const last = paneLines.length - 1;
    if (last >= 0 && paneLines[last].length + 1 + item.length <= NOTE_CHARS) paneLines[last] += ` ${item}`;
    else paneLines.push(last < 0 ? `Panes: ${item}` : item);
  });
  const notes = [
    ...paneLines,
    `Edge seal ${fmtGlass(edge)} · spacer bars ${fmtGlass(geom.spacer)} on the wood bar centre lines${geom.vBars.length || geom.hBars.length ? ` (${geom.vBars.length} vertical, ${geom.hBars.length} horizontal)` : ''}`,
  ];

  const topCuts = [0, ...geom.vBars.flatMap((b) => [b.left, b.right]), w];
  const leftCuts = [0, ...geom.hBars.flatMap((b) => [b.top, b.bot]), h];
  const titleY = oy + h + MB * 0.75;
  const svgH = titleY + (44 + 18 * notes.length) * ts;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>
        <defs>
          <pattern id={patternId} width={sw(14)} height={sw(14)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={sw(14)} stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.45} />
          </pattern>
        </defs>

        {/* Sealed unit and its edge seal */}
        <rect x={X(0)} y={Y(0)} width={w} height={h} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />
        <rect x={X(edge)} y={Y(edge)} width={w - 2 * edge} height={h - 2 * edge} fill="none"
          stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} strokeOpacity={0.6} strokeDasharray={`${sw(5)},${sw(4)}`} />
        {isFrosted && (
          <rect x={X(edge)} y={Y(edge)} width={w - 2 * edge} height={h - 2 * edge} fill={`url(#${patternId})`} stroke="none" />
        )}

        {/* Spacer bars on the wood bar centre lines */}
        {geom.vBars.map((b, i) => (
          <g key={`v${i}`}>
            <line x1={X(b.left)} y1={Y(0)} x2={X(b.left)} y2={Y(h)} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            <line x1={X(b.right)} y1={Y(0)} x2={X(b.right)} y2={Y(h)} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
          </g>
        ))}
        {geom.hBars.map((b, i) => (
          <g key={`h${i}`}>
            <line x1={X(0)} y1={Y(b.top)} x2={X(w)} y2={Y(b.top)} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            <line x1={X(0)} y1={Y(b.bot)} x2={X(w)} y2={Y(b.bot)} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
          </g>
        ))}

        {/* Bar spacings along the bottom and on the left; overall width at the top, height on the right */}
        {geom.vBars.length > 0 && (
          <DimChainH y={oy + h + 24 * ts} cuts={topCuts.map(X)} extFrom={oy + h + 4 * ts} vbw={svgW} fmt={fmtGlass}
            labels={topCuts.slice(0, -1).map((c, i) => fmtGlass(topCuts[i + 1] - c))} />
        )}
        {geom.hBars.length > 0 && (
          <DimChainV x={ox - 24 * ts} cuts={leftCuts.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} fmt={fmtGlass}
            labels={leftCuts.slice(0, -1).map((c, i) => fmtGlass(leftCuts[i + 1] - c))} />
        )}
        <DimH y={oy - 30 * ts} x1={X(0)} x2={X(w)} extFrom={Y(0)} label={fmtGlass(w)} vbw={svgW} />
        <DimV x={ox + w + 34 * ts} y1={Y(0)} y2={Y(h)} extFrom={X(w)} label={fmtGlass(h)} vbw={svgW} />

        <SheetTitle x={svgW / 2} y={titleY} title={`${fmtGlass(w)} × ${fmtGlass(h)} mm`} subtitle={spec} notes={notes} ts={ts} vbw={svgW} />
      </svg>
    </div>
  );
}
