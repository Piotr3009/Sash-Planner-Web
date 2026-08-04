/**
 * DoorElevation2D.jsx
 *
 * Exterior view of a door — same drawing system as CasementElevation2D:
 * mm coordinates, dark theme, non-scaling strokes, DimH/DimV + TitleBlock
 * from drawingUtils. Geometry comes exclusively from derived.door (engine
 * single source) + the door profile.
 *
 * What makes a door different from a casement leaf, and is therefore drawn
 * differently here (Piotr 04.08):
 *   · members are 94mm all round but the BOTTOM RAIL is 180mm — the height
 *     is what keeps the door rigid, so the drawing must show it clearly;
 *   · threshold has three variants and 'aluminium' / 'low-profile' have NO
 *     bottom timber member at all — the engine omits it, so the elevation
 *     must not draw a cill face that does not exist;
 *   · an inward-opening door gets an unrebated 40mm cill that falls to 35mm.
 *
 * Scope v1: single leaf, full glass. French (centre mullion), side panels and
 * transom are later layers — deliberately not guessed.
 */
import { useMemo } from 'react';
import { getDoorProfile } from '../../engine/profile.js';
import { computeBarPositions, DimH, DimV, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function DoorElevation2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const dr = derived?.door;
    if (!windowSpec || !dr) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;

    const p = getDoorProfile();
    const g = p.geometry;
    const els = p.elements;
    const stile = els.leafStile.face;
    const topRail = els.leafTop.face;
    const bottomRail = els.leafBottom.face;

    // Leaf sits inside the frame land; its height depends on whether there is
    // a timber cill to close onto (engine decides — mirror it, never re-derive).
    const leafX = g.land + g.gap;
    const leafY = g.land + g.gap;
    const leafW = dr.leafW;
    const leafH = dr.leafH;

    const glassX = leafX + stile;
    const glassY = leafY + topRail;
    const glassW = leafW - 2 * stile;
    const glassH = leafH - topRail - bottomRail;

    const bars = windowSpec.door?.bars || {};
    const barPos = computeBarPositions({
      glassX, glassY, glassW, glassH,
      vCount: Number(bars.v) || 0, hCount: Number(bars.h) || 0, barW: BAR_WIDTH,
    });

    return {
      fw, fh, g, els, stile, topRail, bottomRail,
      leafX, leafY, leafW, leafH,
      glassX, glassY, glassW, glassH, barPos,
      hinge: windowSpec.door?.hingeSide || 'left',
      inward: !!dr.inward,
      hasTimberCill: !!dr.hasTimberCill,
      threshold: dr.threshold || 'standard',
      cillExt: Number(windowSpec.cill?.extension) || 0,
      cillWider: !!windowSpec.cill?.wider,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, g } = geom;

  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 60 * layoutSc;
  const M = 70 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalH = M + fh + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  // Frame opening: with a timber cill the land closes at the bottom; without
  // one the opening runs to the very bottom of the frame.
  const bottomLand = geom.hasTimberCill ? g.cillVisible : 0;
  const landRect = {
    x: X(g.land), y: Y(g.land),
    w: fw - 2 * g.land, h: fh - g.land - bottomLand,
  };

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const thresholdLabel = geom.hasTimberCill
    ? `${geom.inward ? 'inward cill 40→35' : 'timber cill'}`
    : `${geom.threshold} threshold — no timber cill`;
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `Door ${windowSpec.door?.type || 'single-external'} · ${fw} × ${fh} mm · ${thresholdLabel} · exterior view`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── FRAME band ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(fh)} H ${X(0)} Z
              M ${landRect.x} ${landRect.y} H ${landRect.x + landRect.w}
              V ${landRect.y + landRect.h} H ${landRect.x} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={fh}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={landRect.x} y={landRect.y} width={landRect.w} height={landRect.h}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* ── CILL face — only when a timber cill actually exists ── */}
        {geom.hasTimberCill && (
          <>
            <line x1={X(0)} y1={Y(fh - g.cillVisible)} x2={X(fw)} y2={Y(fh - g.cillVisible)}
              stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
            {(geom.cillWider || geom.cillExt > 0) && (
              <path d={`M ${X(geom.cillWider ? -50 : 0)} ${Y(fh - g.cillVisible)}
                        H ${X(fw + (geom.cillWider ? 50 : 0))} V ${Y(fh)}
                        H ${X(geom.cillWider ? -50 : 0)} Z`}
                fill={COLORS.frameFill} stroke={COLORS.frame}
                strokeWidth={STROKES.frameLight} {...NS} />
            )}
          </>
        )}

        {/* ── LEAF: stiles + top rail + the tall 180mm bottom rail ── */}
        <rect x={X(geom.leafX)} y={Y(geom.leafY)} width={geom.leafW} height={geom.leafH}
          fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
        {/* Bottom rail band drawn explicitly — it is the door's defining member */}
        <rect x={X(geom.leafX)} y={Y(geom.leafY + geom.leafH - geom.bottomRail)}
          width={geom.leafW} height={geom.bottomRail}
          fill={COLORS.frameFill} stroke={COLORS.sash}
          strokeWidth={STROKES.frameLight} {...NS} />

        {/* ── GLASS + bars ── */}
        <rect x={X(geom.glassX)} y={Y(geom.glassY)} width={geom.glassW} height={geom.glassH}
          fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
        {geom.barPos.vBars.map((vb, k) => (
          <rect key={`vb-${k}`} x={X(vb.left)} y={Y(geom.glassY)}
            width={BAR_WIDTH} height={geom.glassH}
            fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}
        {geom.barPos.hBars.map((hb, k) => (
          <rect key={`hb-${k}`} x={X(geom.glassX)} y={Y(hb.top)}
            width={geom.glassW} height={BAR_WIDTH}
            fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
        ))}

        {/* ── OPENING SYMBOL — apex on the hinge side (exterior view) ── */}
        {geom.hinge === 'left' ? (
          <path d={`M ${X(geom.leafX + geom.leafW)} ${Y(geom.leafY)}
                    L ${X(geom.leafX)} ${Y(geom.leafY + geom.leafH / 2)}
                    L ${X(geom.leafX + geom.leafW)} ${Y(geom.leafY + geom.leafH)}`}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
            strokeDasharray={`${sw(6)},${sw(4)}`} />
        ) : (
          <path d={`M ${X(geom.leafX)} ${Y(geom.leafY)}
                    L ${X(geom.leafX + geom.leafW)} ${Y(geom.leafY + geom.leafH / 2)}
                    L ${X(geom.leafX)} ${Y(geom.leafY + geom.leafH)}`}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
            strokeDasharray={`${sw(6)},${sw(4)}`} />
        )}

        <Label x={X(geom.leafX + geom.leafW / 2)}
          y={Y(geom.leafY + geom.leafH / 2) + sw(5)} text="P1" vbw={totalW} />

        {/* ── MEMBER DIMS: bottom rail is the one worth calling out ── */}
        <DimV x={ox + fw + DM * 0.35}
          y1={Y(geom.leafY + geom.leafH - geom.bottomRail)}
          y2={Y(geom.leafY + geom.leafH)} extFrom={X(geom.leafX + geom.leafW)}
          label={fmt(geom.bottomRail)} small vbw={totalW} />
        <DimH y={oy - DM * 0.45} x1={X(geom.leafX)} x2={X(geom.leafX + geom.stile)}
          extFrom={Y(geom.leafY)} label={fmt(geom.stile)} small vbw={totalW} />

        {/* ── GLASS DIMS ── */}
        <DimH y={oy + fh + DM * 0.35} x1={X(geom.glassX)} x2={X(geom.glassX + geom.glassW)}
          extFrom={Y(geom.glassY + geom.glassH)} label={fmt(geom.glassW)} small vbw={totalW} />
        <DimV x={ox - DM * 0.45} y1={Y(geom.glassY)} y2={Y(geom.glassY + geom.glassH)}
          extFrom={X(geom.glassX)} label={fmt(geom.glassH)} small vbw={totalW} />

        {/* ── OVERALL DIMS ── */}
        <DimH y={oy + fh + DM * 0.8} x1={X(0)} x2={X(fw)} extFrom={Y(fh)}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 0.8} y1={Y(0)} y2={Y(fh)} extFrom={X(fw)}
          label={fmt(fh)} vbw={totalW} />

        {/* ── TITLE ── */}
        <TitleBlock x={totalW / 2} y={oy + fh + DM + TITLE_AREA * 0.5}
          title={titleText} subtitle={subtitleText} vbw={totalW} />
      </svg>
    </div>
  );
}
