/**
 * FrontElevation2D.jsx
 *
 * Front elevation viewed from EXTERIOR.
 * SVG z-order matches physical depth:
 *   1. Box frame (in wall — furthest back)
 *   2. Lower sash (interior track — behind)
 *   3. Upper sash (exterior track — in front, covers lower at meeting rail)
 *
 * Uses BAR_PATTERNS from SashDetail2D (segment breaks, crosses).
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { DimH, DimV, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };

const BAR_PATTERNS = {
  'none': { h: 0, v: 0 }, '2x2': { h: 0, v: 1 }, '3x3': { h: 0, v: 2 },
  '4x4': { h: 1, v: 1 }, '6x6': { h: 1, v: 2 }, '9x9': { h: 2, v: 2 },
};
const BAR_WIDTH = 22;

const C = {
  frame: COLORS.frame, frameFill: COLORS.frameFill,
  sash: COLORS.sash, glass: COLORS.glass,
  meeting: COLORS.meeting, bar: COLORS.bar,
  horn: COLORS.horn, title: COLORS.title,
  subtitle: COLORS.subtitle, label: COLORS.label,
};

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function computeSegments(from, to, cutPairs) {
  if (!cutPairs.length) return [{ a: from, b: to }];
  const sorted = [...cutPairs].sort((a, b) => a[0] - b[0]);
  const segs = [];
  let pos = from;
  for (const [s, e] of sorted) {
    if (s > pos) segs.push({ a: pos, b: s });
    pos = Math.max(pos, e);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

/** Renders bars (parallel lines + segment breaks + crosses) for one sash */
function SashBars({ bars, glassX, glassY, glassW, glassH, X, Y }) {
  const hCuts = bars.hBars.map(hb => [hb.top, hb.bot]);
  const vCuts = bars.vBars.map(vb => [vb.left, vb.right]);
  const vertSegs = computeSegments(glassY, glassY + glassH, hCuts);
  const horizSegs = computeSegments(glassX, glassX + glassW, vCuts);

  return (
    <g>
      {bars.vBars.map((vb, i) => (
        <g key={`v${i}`}>
          {vertSegs.map((seg, j) => (
            <g key={j}>
              <line x1={X(vb.left)} y1={Y(seg.a)} x2={X(vb.left)} y2={Y(seg.b)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              <line x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
            </g>
          ))}
        </g>
      ))}
      {bars.hBars.map((hb, j) => (
        <g key={`h${j}`}>
          {horizSegs.map((seg, i) => (
            <g key={i}>
              <line x1={X(seg.a)} y1={Y(hb.top)} x2={X(seg.b)} y2={Y(hb.top)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              <line x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
            </g>
          ))}
        </g>
      ))}
      {bars.vBars.flatMap((vb, vi) =>
        bars.hBars.map((hb, hi) => (
          <g key={`x${vi}-${hi}`}>
            <line x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
              stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
            <line x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
              stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
          </g>
        ))
      )}
    </g>
  );
}

export default function FrontElevation2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    const jw = CONSTANTS.JAMBS_WIDTH;             // 28
    const headH = CONSTANTS.HEAD_WIDTH;           // 28
    const sillH = CONSTANTS.SILL_WIDTH;           // 46
    const stile = CONSTANTS.STILE_WIDTH;          // 57
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;     // 57
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;  // 90
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;// 43

    // Sash position within frame
    const sashX = (fw - sashW) / 2;
    const sashTopY = headH;  // upper sash top edge

    // Upper sash: from sashTopY to sashTopY + topH
    const uTop = sashTopY;
    const uBot = sashTopY + topH;
    const uGlassX = sashX + stile;
    const uGlassY = uTop + topRail;
    const uGlassW = sashW - 2 * stile;
    const uGlassH = topH - topRail - meetRail;

    // Lower sash: from uBot to uBot + botH
    const lTop = uBot;
    const lBot = uBot + botH;
    const lGlassX = sashX + stile;
    const lGlassY = lTop + meetRail;
    const lGlassW = sashW - 2 * stile;
    const lGlassH = botH - meetRail - botRail;

    // Bars
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BAR_PATTERNS[gridMode] || BAR_PATTERNS['none'];
    const v = pattern.v, h = pattern.h;

    const upperBars = computeBarPositions({
      glassX: uGlassX, glassY: uGlassY, glassW: uGlassW, glassH: uGlassH,
      vCount: v, hCount: h, barW: BAR_WIDTH,
    });
    const lowerBars = computeBarPositions({
      glassX: lGlassX, glassY: lGlassY, glassW: lGlassW, glassH: lGlassH,
      vCount: v, hCount: h, barW: BAR_WIDTH,
    });

    // Horns (upper sash only, extend DOWN past meeting rail)
    const hasHorns = !!windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;

    // Gap between sash edge and jamb inner edge (bead area)
    const beadGap = sashX - jw;

    return {
      fw, fh, sashW, topH, botH,
      jw, headH, sillH, stile, topRail, botRail, meetRail,
      sashX, uTop, uBot, lTop, lBot,
      uGlassX, uGlassY, uGlassW, uGlassH,
      lGlassX, lGlassY, lGlassW, lGlassH,
      v, h, upperBars, lowerBars,
      hasHorns, hornExt, beadGap, gridMode,
    };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const layoutSc = Math.max(d.fw, d.fh) / 500;
  const M = 60 * layoutSc;
  const DM = 50 * layoutSc;
  const ox = M + DM;
  const oy = M;
  const hornSpace = d.hasHorns ? d.hornExt + 10 * layoutSc : 0;
  const totalW = d.fw + M * 2 + DM * 2;
  const totalH = d.fh + M * 2 + DM + hornSpace;
  const ts = totalW / VIEWBOX_REF;

  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  return (
    <div className="w-full" style={{ maxHeight: '70vh', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ═══ LAYER 1: BOX FRAME (furthest back) ═══ */}
        {/* Outer frame */}
        <rect x={X(0)} y={Y(0)} width={d.fw} height={d.fh}
          fill="none" stroke={C.frame} strokeWidth={STROKES.frame} {...NS} />
        {/* Head */}
        <rect x={X(0)} y={Y(0)} width={d.fw} height={d.headH}
          fill={C.frame} fillOpacity={0.08} stroke={C.frame} strokeWidth={STROKES.frameLight} {...NS} />
        {/* Sill */}
        <rect x={X(0)} y={Y(d.fh - d.sillH)} width={d.fw} height={d.sillH}
          fill={C.frame} fillOpacity={0.08} stroke={C.frame} strokeWidth={STROKES.frameLight} {...NS} />
        {/* Left jamb */}
        <rect x={X(0)} y={Y(0)} width={d.jw} height={d.fh}
          fill={C.frame} fillOpacity={0.05} stroke={C.frame} strokeWidth={STROKES.frameLight} {...NS} />
        {/* Right jamb */}
        <rect x={X(d.fw - d.jw)} y={Y(0)} width={d.jw} height={d.fh}
          fill={C.frame} fillOpacity={0.05} stroke={C.frame} strokeWidth={STROKES.frameLight} {...NS} />
        {/* Inner frame edge (jamb inner edges — parting bead line) */}
        <rect x={X(d.jw)} y={Y(d.headH)} width={d.fw - 2 * d.jw} height={d.fh - d.headH - d.sillH}
          fill="none" stroke={C.frame} strokeWidth={STROKES.frameLight} {...NS}
          strokeDasharray="4,3" strokeOpacity={0.3} />

        {/* ═══ LAYER 2: LOWER SASH (interior track — behind) ═══ */}
        <g opacity={0.85}>
          {/* Sash outline */}
          <rect x={X(d.sashX)} y={Y(d.lTop)} width={d.sashW} height={d.botH}
            fill="none" stroke={C.sash} strokeWidth={STROKES.sash} {...NS} />
          {/* Meeting rail at TOP of lower sash */}
          <rect x={X(d.sashX)} y={Y(d.lTop)} width={d.sashW} height={d.meetRail}
            fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Bottom rail */}
          <rect x={X(d.sashX)} y={Y(d.lBot - d.botRail)} width={d.sashW} height={d.botRail}
            fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Left stile */}
          <rect x={X(d.sashX)} y={Y(d.lTop)} width={d.stile} height={d.botH}
            fill={C.sash} fillOpacity={0.04} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Right stile */}
          <rect x={X(d.sashX + d.sashW - d.stile)} y={Y(d.lTop)} width={d.stile} height={d.botH}
            fill={C.sash} fillOpacity={0.04} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Glass */}
          <rect x={X(d.lGlassX)} y={Y(d.lGlassY)} width={d.lGlassW} height={d.lGlassH}
            fill={C.glass} fillOpacity={0.06} stroke="none" />
          {/* Bars */}
          <SashBars bars={d.lowerBars}
            glassX={d.lGlassX} glassY={d.lGlassY} glassW={d.lGlassW} glassH={d.lGlassH}
            X={X} Y={Y} />
        </g>

        {/* ═══ LAYER 3: UPPER SASH (exterior track — in front, covers lower MR) ═══ */}
        <g>
          {/* Sash outline */}
          <rect x={X(d.sashX)} y={Y(d.uTop)} width={d.sashW} height={d.topH}
            fill={COLORS.bg} fillOpacity={0.95} stroke={C.sash} strokeWidth={STROKES.sash} {...NS} />
          {/* Top rail */}
          <rect x={X(d.sashX)} y={Y(d.uTop)} width={d.sashW} height={d.topRail}
            fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Meeting rail at BOTTOM of upper sash */}
          <rect x={X(d.sashX)} y={Y(d.uBot - d.meetRail)} width={d.sashW} height={d.meetRail}
            fill={C.sash} fillOpacity={0.08} stroke={C.meeting} strokeWidth={STROKES.meeting} {...NS} />
          {/* Left stile */}
          <rect x={X(d.sashX)} y={Y(d.uTop)} width={d.stile} height={d.topH}
            fill={C.sash} fillOpacity={0.04} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Right stile */}
          <rect x={X(d.sashX + d.sashW - d.stile)} y={Y(d.uTop)} width={d.stile} height={d.topH}
            fill={C.sash} fillOpacity={0.04} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
          {/* Glass */}
          <rect x={X(d.uGlassX)} y={Y(d.uGlassY)} width={d.uGlassW} height={d.uGlassH}
            fill={C.glass} fillOpacity={0.06} stroke="none" />
          {/* Bars */}
          <SashBars bars={d.upperBars}
            glassX={d.uGlassX} glassY={d.uGlassY} glassW={d.uGlassW} glassH={d.uGlassH}
            X={X} Y={Y} />
        </g>

        {/* ═══ HORNS (upper sash, extend DOWN past meeting rail) ═══ */}
        {d.hasHorns && (
          <g>
            <line x1={X(d.sashX + 2)} y1={Y(d.uBot)} x2={X(d.sashX + 2)} y2={Y(d.uBot + d.hornExt)}
              stroke={C.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" strokeOpacity={0.7} />
            <line x1={X(d.sashX + d.sashW - 2)} y1={Y(d.uBot)} x2={X(d.sashX + d.sashW - 2)} y2={Y(d.uBot + d.hornExt)}
              stroke={C.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" strokeOpacity={0.7} />
            <text x={X(d.sashX + d.sashW + 4 * ts)} y={Y(d.uBot + d.hornExt / 2)}
              fill={C.horn} fontSize={tfs(SIZES.notch, totalW)} fontFamily={FONT_FAMILY}
              fillOpacity={0.7}>
              Horn {d.hornExt}mm
            </text>
          </g>
        )}

        {/* ═══ LABELS ═══ */}
        <text x={X(d.fw / 2)} y={Y(d.headH / 2 + 3)}
          fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY}
          fontWeight={WEIGHTS.label} textAnchor="middle" fillOpacity={0.6}>
          HEAD
        </text>
        <text x={X(d.fw / 2)} y={Y(d.fh - d.sillH / 2 + 3)}
          fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY}
          fontWeight={WEIGHTS.label} textAnchor="middle" fillOpacity={0.6}>
          SILL
        </text>

        {/* ═══ DIMENSIONS ═══ */}
        {/* Frame overall — bottom */}
        <DimH y={Y(d.fh) + DM * 0.6} x1={X(0)} x2={X(d.fw)}
          extFrom={Y(d.fh)} label={`${d.fw}`} vbw={totalW} />
        {/* Frame overall — right */}
        <DimV x={X(d.fw) + DM * 0.6} y1={Y(0)} y2={Y(d.fh)}
          extFrom={X(d.fw)} label={`${d.fh}`} vbw={totalW} />
        {/* Sash width — top */}
        <DimH y={Y(0) - DM * 0.4} x1={X(d.sashX)} x2={X(d.sashX + d.sashW)}
          extFrom={Y(0)} label={`${d.sashW}`} vbw={totalW} />
        {/* Top sash height — left */}
        <DimV x={X(0) - DM * 0.4} y1={Y(d.uTop)} y2={Y(d.uBot)}
          extFrom={X(0)} label={`${fmt(d.topH)}`} vbw={totalW} />
        {/* Bottom sash height — left */}
        <DimV x={X(0) - DM * 0.4} y1={Y(d.lTop)} y2={Y(d.lBot)}
          extFrom={X(0)} label={`${fmt(d.botH)}`} vbw={totalW} />

        {/* ═══ TITLE ═══ */}
        <text x={totalW / 2} y={totalH - 12 * ts}
          fill={C.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT_FAMILY}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          FRONT ELEVATION — {d.fw} × {d.fh}
        </text>
        <text x={totalW / 2} y={totalH - 3 * ts}
          fill={C.subtitle} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT_FAMILY}
          textAnchor="middle" fillOpacity={0.6}>
          {d.gridMode} · sash {d.sashW}
        </text>
      </svg>
    </div>
  );
}
