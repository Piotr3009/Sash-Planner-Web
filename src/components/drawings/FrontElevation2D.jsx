/**
 * FrontElevation2D.jsx
 *
 * Front elevation = Box frame + Upper Sash + Lower Sash composed together.
 * Uses same bar logic as SashDetail2D (BAR_PATTERNS, segment breaks, crosses).
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
  horn: COLORS.horn, dim: COLORS.dim,
  title: COLORS.title, subtitle: COLORS.subtitle,
  label: COLORS.label, notch: COLORS.notch,
};

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function computeSegments(from, to, cutPairs) {
  if (cutPairs.length === 0) return [{ a: from, b: to }];
  const sorted = [...cutPairs].sort((p, q) => p[0] - q[0]);
  const segs = [];
  let pos = from;
  for (const [s, e] of sorted) {
    if (s > pos) segs.push({ a: pos, b: s });
    pos = Math.max(pos, e);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

export default function FrontElevation2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    const jw = CONSTANTS.JAMBS_WIDTH;       // 28
    const headH = CONSTANTS.HEAD_WIDTH;     // 28
    const sillH = CONSTANTS.SILL_WIDTH;     // 46
    const stile = CONSTANTS.STILE_WIDTH;    // 57
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;   // 57
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH; // 90
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH; // 43

    // Sash position within frame
    const sashX = (fw - sashW) / 2;
    const sashY = headH;

    // Upper sash glass area
    const uGlassX = sashX + stile;
    const uGlassY = sashY + topRail;
    const uGlassW = sashW - 2 * stile;
    const uGlassH = topH - topRail - meetRail;

    // Lower sash glass area
    const lSashY = sashY + topH;
    const lGlassX = sashX + stile;
    const lGlassY = lSashY + meetRail;
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

    // Horns
    const hasHorns = !!windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;

    return {
      fw, fh, sashW, topH, botH,
      jw, headH, sillH, stile, topRail, botRail, meetRail,
      sashX, sashY, lSashY,
      uGlassX, uGlassY, uGlassW, uGlassH,
      lGlassX, lGlassY, lGlassW, lGlassH,
      v, h, upperBars, lowerBars,
      hasHorns, hornExt, gridMode,
    };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const layoutSc = Math.max(d.fw, d.fh) / 500;
  const M = 70 * layoutSc;
  const DM = 50 * layoutSc;
  const ox = M + DM;
  const oy = M;
  const hornSpace = d.hasHorns ? d.hornExt + 10 * layoutSc : 0;
  const totalW = d.fw + M * 2 + DM * 2;
  const totalH = d.fh + M * 2 + DM + hornSpace;

  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  // Segment helpers for bars
  const uHcuts = d.upperBars.hBars.map(hb => [hb.top, hb.bot]);
  const uVcuts = d.upperBars.vBars.map(vb => [vb.left, vb.right]);
  const lHcuts = d.lowerBars.hBars.map(hb => [hb.top, hb.bot]);
  const lVcuts = d.lowerBars.vBars.map(vb => [vb.left, vb.right]);

  const uVertSegs = computeSegments(d.uGlassY, d.uGlassY + d.uGlassH, uHcuts);
  const uHorizSegs = computeSegments(d.uGlassX, d.uGlassX + d.uGlassW, uVcuts);
  const lVertSegs = computeSegments(d.lGlassY, d.lGlassY + d.lGlassH, lHcuts);
  const lHorizSegs = computeSegments(d.lGlassX, d.lGlassX + d.lGlassW, lVcuts);

  return (
    <div className="w-full" style={{ maxHeight: '70vh', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ═══ FRAME ═══ */}
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

        {/* ═══ UPPER SASH ═══ */}
        <rect x={X(d.sashX)} y={Y(d.sashY)} width={d.sashW} height={d.topH}
          fill="none" stroke={C.sash} strokeWidth={STROKES.sash} {...NS} />
        {/* Top rail */}
        <rect x={X(d.sashX)} y={Y(d.sashY)} width={d.sashW} height={d.topRail}
          fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Left stile */}
        <rect x={X(d.sashX)} y={Y(d.sashY)} width={d.stile} height={d.topH}
          fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Right stile */}
        <rect x={X(d.sashX + d.sashW - d.stile)} y={Y(d.sashY)} width={d.stile} height={d.topH}
          fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Upper glass fill */}
        <rect x={X(d.uGlassX)} y={Y(d.uGlassY)} width={d.uGlassW} height={d.uGlassH}
          fill={C.glass} fillOpacity={0.06} stroke="none" />

        {/* ═══ MEETING RAIL ═══ */}
        <rect x={X(d.sashX)} y={Y(d.sashY + d.topH - d.meetRail)} width={d.sashW} height={d.meetRail * 2}
          fill={C.sash} fillOpacity={0.1} stroke={C.meeting} strokeWidth={STROKES.meeting} {...NS} />

        {/* ═══ LOWER SASH ═══ */}
        <rect x={X(d.sashX)} y={Y(d.lSashY)} width={d.sashW} height={d.botH}
          fill="none" stroke={C.sash} strokeWidth={STROKES.sash} {...NS} />
        {/* Bottom rail */}
        <rect x={X(d.sashX)} y={Y(d.lSashY + d.botH - d.botRail)} width={d.sashW} height={d.botRail}
          fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Left stile */}
        <rect x={X(d.sashX)} y={Y(d.lSashY)} width={d.stile} height={d.botH}
          fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Right stile */}
        <rect x={X(d.sashX + d.sashW - d.stile)} y={Y(d.lSashY)} width={d.stile} height={d.botH}
          fill={C.sash} fillOpacity={0.06} stroke={C.sash} strokeWidth={STROKES.sashLight} {...NS} />
        {/* Lower glass fill */}
        <rect x={X(d.lGlassX)} y={Y(d.lGlassY)} width={d.lGlassW} height={d.lGlassH}
          fill={C.glass} fillOpacity={0.06} stroke="none" />

        {/* ═══ UPPER BARS ═══ */}
        {d.upperBars.vBars.map((vb, i) => (
          <g key={`uv-${i}`}>
            {uVertSegs.map((seg, j) => (
              <g key={j}>
                <line x1={X(vb.left)} y1={Y(seg.a)} x2={X(vb.left)} y2={Y(seg.b)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
                <line x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              </g>
            ))}
          </g>
        ))}
        {d.upperBars.hBars.map((hb, j) => (
          <g key={`uh-${j}`}>
            {uHorizSegs.map((seg, i) => (
              <g key={i}>
                <line x1={X(seg.a)} y1={Y(hb.top)} x2={X(seg.b)} y2={Y(hb.top)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
                <line x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              </g>
            ))}
          </g>
        ))}
        {/* Upper crosses */}
        {d.upperBars.vBars.flatMap((vb, vi) =>
          d.upperBars.hBars.map((hb, hi) => (
            <g key={`uc-${vi}-${hi}`}>
              <line x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              <line x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
            </g>
          ))
        )}

        {/* ═══ LOWER BARS ═══ */}
        {d.lowerBars.vBars.map((vb, i) => (
          <g key={`lv-${i}`}>
            {lVertSegs.map((seg, j) => (
              <g key={j}>
                <line x1={X(vb.left)} y1={Y(seg.a)} x2={X(vb.left)} y2={Y(seg.b)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
                <line x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              </g>
            ))}
          </g>
        ))}
        {d.lowerBars.hBars.map((hb, j) => (
          <g key={`lh-${j}`}>
            {lHorizSegs.map((seg, i) => (
              <g key={i}>
                <line x1={X(seg.a)} y1={Y(hb.top)} x2={X(seg.b)} y2={Y(hb.top)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
                <line x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                  stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              </g>
            ))}
          </g>
        ))}
        {/* Lower crosses */}
        {d.lowerBars.vBars.flatMap((vb, vi) =>
          d.lowerBars.hBars.map((hb, hi) => (
            <g key={`lc-${vi}-${hi}`}>
              <line x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
              <line x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                stroke={C.sash} strokeWidth={STROKES.bar} {...NS} />
            </g>
          ))
        )}

        {/* ═══ HORNS ═══ */}
        {d.hasHorns && (
          <g>
            <line x1={X(d.sashX + 2)} y1={Y(d.sashY + d.topH)} x2={X(d.sashX + 2)} y2={Y(d.sashY + d.topH + d.hornExt)}
              stroke={C.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" strokeOpacity={0.7} />
            <line x1={X(d.sashX + d.sashW - 2)} y1={Y(d.sashY + d.topH)} x2={X(d.sashX + d.sashW - 2)} y2={Y(d.sashY + d.topH + d.hornExt)}
              stroke={C.horn} strokeWidth={STROKES.horn} {...NS} strokeDasharray="4,3" strokeOpacity={0.7} />
          </g>
        )}

        {/* ═══ DIMENSIONS ═══ */}
        {/* Frame overall — bottom */}
        <DimH y={Y(d.fh) + DM * 0.7} x1={X(0)} x2={X(d.fw)}
          extFrom={Y(d.fh)} label={`${d.fw}`} vbw={totalW} />
        {/* Frame overall — right */}
        <DimV x={X(d.fw) + DM * 0.7} y1={Y(0)} y2={Y(d.fh)}
          extFrom={X(d.fw)} label={`${d.fh}`} vbw={totalW} />
        {/* Sash width — top */}
        <DimH y={Y(0) - DM * 0.5} x1={X(d.sashX)} x2={X(d.sashX + d.sashW)}
          extFrom={Y(0)} label={`${d.sashW}`} vbw={totalW} />
        {/* Top sash height — left */}
        <DimV x={X(0) - DM * 0.5} y1={Y(d.sashY)} y2={Y(d.sashY + d.topH)}
          extFrom={X(0)} label={`${fmt(d.topH)}`} vbw={totalW} />
        {/* Bottom sash height — left */}
        <DimV x={X(0) - DM * 0.5} y1={Y(d.lSashY)} y2={Y(d.lSashY + d.botH)}
          extFrom={X(0)} label={`${fmt(d.botH)}`} vbw={totalW} />

        {/* ═══ LABELS ═══ */}
        <text x={X(d.fw / 2)} y={Y(d.headH / 2 + 3)}
          fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY}
          fontWeight={WEIGHTS.label} textAnchor="middle" fillOpacity={0.7}>
          HEAD
        </text>
        <text x={X(d.fw / 2)} y={Y(d.fh - d.sillH / 2 + 3)}
          fill={C.label} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY}
          fontWeight={WEIGHTS.label} textAnchor="middle" fillOpacity={0.7}>
          SILL
        </text>
        <text x={X(d.fw / 2)} y={Y(d.sashY + d.topH)}
          fill={C.meeting} fontSize={tfs(SIZES.label, totalW)} fontFamily={FONT_FAMILY}
          fontWeight={WEIGHTS.label} textAnchor="middle" fillOpacity={0.6}>
          MEETING RAIL
        </text>

        {/* ═══ TITLE ═══ */}
        <text x={totalW / 2} y={totalH - 10 * (totalW / VIEWBOX_REF)}
          fill={C.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT_FAMILY}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          FRONT ELEVATION — {d.fw} × {d.fh}
        </text>
        <text x={totalW / 2} y={totalH - 2 * (totalW / VIEWBOX_REF)}
          fill={C.subtitle} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT_FAMILY}
          textAnchor="middle" fillOpacity={0.6}>
          {d.gridMode} · sash {d.sashW}
        </text>
      </svg>
    </div>
  );
}
