/**
 * GlassDrawing2D.jsx
 *
 * Single glass unit drawing — one per sash (upper or lower).
 * Shows ONLY glass + spacer bars + dimensions. No wood.
 *
 * Bar positions: derived FROM WOOD (sash bar positions), then cross-checked
 * mathematically from glass dimensions. If mismatch → alarm.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, WEIGHTS, STROKES, VIEWBOX_REF, DimH, DimV, tfs, computeBarPositions } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };
const MARGIN = 60;
const DIM_OFF = 35;

const WOOD_BAR = 22;    // drewniany bar na wierzchu
const SPACER_BAR = 18;  // spacer bar w środku glass
const REBATE = 12.5;    // glass overlap into wood

export default function GlassDrawing2D({ windowSpec, derived, type = 'upper' }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const isUpper = type === 'upper';
    const sashW = derived.sashWidth;
    const topH = derived.topSashHeight;
    const botH = derived.bottomSashHeight;

    // Sash inner dimensions (between timber)
    const innerW = sashW - 114;           // 2 × stile(57)
    const innerH = isUpper
      ? topH - 100                        // topRail(57) + meetRail(43)
      : botH - 133;                       // botRail(90) + meetRail(43)

    // Glass = inner + rebate overlap each side
    const glassW = innerW + 2 * REBATE;   // = sashW - 89
    const glassH = innerH + 2 * REBATE;   // = sashH - 75 or - 108

    // Bar counts
    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vCount = 0, hCount = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vCount = cols - 1;
      hCount = isUpper ? Math.floor(rows / 2) : Math.ceil(rows / 2);
    }

    // ── SOURCE: wood bar positions (drewno = source of truth) ──
    const woodBars = computeBarPositions({
      glassX: 0, glassY: 0, glassW: innerW, glassH: innerH,
      vCount, hCount, barW: WOOD_BAR,
    });

    // Convert wood centers → glass spacer positions (shift by rebate)
    const spacerV = woodBars.vBars.map(b => ({
      center: b.cx + REBATE,
      left: b.cx + REBATE - SPACER_BAR / 2,
      right: b.cx + REBATE + SPACER_BAR / 2,
    }));
    const spacerH = woodBars.hBars.map(b => ({
      center: b.cy + REBATE,
      top: b.cy + REBATE - SPACER_BAR / 2,
      bot: b.cy + REBATE + SPACER_BAR / 2,
    }));

    // ── CROSS-CHECK: math from glass dimensions ──
    const mathBars = computeBarPositions({
      glassX: 0, glassY: 0, glassW, glassH,
      vCount, hCount, barW: SPACER_BAR,
    });

    const tolerance = 0.1;
    let crossCheckOk = true;
    spacerV.forEach((s, i) => {
      if (Math.abs(s.center - mathBars.vBars[i].cx) > tolerance) crossCheckOk = false;
    });
    spacerH.forEach((s, i) => {
      if (Math.abs(s.center - mathBars.hBars[i].cy) > tolerance) crossCheckOk = false;
    });

    // Segment sizes (visible glass between spacers)
    const segW = vCount > 0 ? Math.round((glassW - vCount * SPACER_BAR) / (vCount + 1) * 10) / 10 : glassW;
    const segH = hCount > 0 ? Math.round((glassH - hCount * SPACER_BAR) / (hCount + 1) * 10) / 10 : glassH;

    const glassType = windowSpec?.glass?.type || windowSpec?.glazing?.type || 'double';
    const glassFinish = windowSpec?.glass?.finish || windowSpec?.glazing?.finish || 'clear';
    const spacerColour = windowSpec?.glazing?.spacerColour || 'black';

    return { glassW, glassH, spacerV, spacerH, vCount, hCount,
      segW, segH, crossCheckOk, glassType, glassFinish, spacerColour, gridMode, isUpper };
  }, [windowSpec, derived, type]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const ox = MARGIN + DIM_OFF;
  const oy = MARGIN;
  const TITLE_SPACE = 50;
  const totalW = d.glassW + MARGIN * 2 + DIM_OFF * 2;
  const totalH = d.glassH + MARGIN * 2 + DIM_OFF * 2 + TITLE_SPACE;

  return (
    <div className="w-full" style={{ maxHeight: '65vh', overflow: 'auto' }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* Glass unit */}
        <rect x={ox} y={oy} width={d.glassW} height={d.glassH}
          fill={STROKE.glass} fillOpacity={0.15} stroke={STROKE.glass} strokeWidth={STROKES.glass} {...NS} />

        {/* Vertical spacer bars */}
        {d.spacerV.map((bar, i) => (
          <rect key={`v${i}`} x={ox + bar.left} y={oy} width={SPACER_BAR} height={d.glassH}
            fill={COLORS.bar} fillOpacity={0.25} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Horizontal spacer bars */}
        {d.spacerH.map((bar, i) => (
          <rect key={`h${i}`} x={ox} y={oy + bar.top} width={d.glassW} height={SPACER_BAR}
            fill={COLORS.bar} fillOpacity={0.25} stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* Glass overall dimensions */}
        <DimH y={oy + d.glassH + DIM_OFF} x1={ox} x2={ox + d.glassW}
          extFrom={oy + d.glassH} label={`${Math.round(d.glassW)} mm`} vbw={totalW} />
        <DimV x={ox + d.glassW + DIM_OFF} y1={oy} y2={oy + d.glassH}
          extFrom={ox + d.glassW} label={`${Math.round(d.glassH)} mm`} vbw={totalW} />

        {/* Segment dimension — top (if vertical bars) */}
        {d.spacerV.length > 0 && (
          <DimH y={oy - DIM_OFF} x1={ox} x2={ox + d.segW}
            extFrom={oy} label={`${d.segW}`} small vbw={totalW} />
        )}

        {/* Segment dimension — left (if horizontal bars) */}
        {d.spacerH.length > 0 && (
          <DimV x={ox - DIM_OFF} y1={oy} y2={oy + d.segH}
            extFrom={ox} label={`${d.segH}`} small vbw={totalW} />
        )}

        {/* Title */}
        <text x={totalW / 2} y={totalH - 30 * totalW / VIEWBOX_REF}
          fill={COLORS.title} fontSize={tfs(SIZES.title, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fontWeight={WEIGHTS.title}>
          {d.isUpper ? 'UPPER' : 'LOWER'} GLASS
        </text>

        {/* Spec */}
        <text x={totalW / 2} y={totalH - 12 * totalW / VIEWBOX_REF}
          fill={STROKE.glass} fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family}
          textAnchor="middle" fillOpacity={0.7}>
          {d.glassType} / {d.glassFinish} · spacer: {d.spacerColour}
        </text>

        {/* Cross-check alarm */}
        {!d.crossCheckOk && (
          <text x={totalW / 2} y={oy - DIM_OFF - 15}
            fill="#EF4444" fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family}
            textAnchor="middle" fontWeight="600">
            ⚠ CROSS-CHECK FAIL: wood vs math bar positions mismatch
          </text>
        )}
      </svg>
    </div>
  );
}