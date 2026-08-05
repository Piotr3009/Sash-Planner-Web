/**
 * DoorLeafDetail2D.jsx
 *
 * The door LEAF on its own — the sheet the joiner cuts from. Carries the
 * member faces (94 all round, 180 bottom rail), the cut lengths and the D-*
 * codes; the elevation deliberately no longer shows these (Piotr 05.08).
 *
 * Rails are drawn BETWEEN the stiles: the stiles are the through members, so
 * a rail never runs edge to edge across the leaf.
 */
import { useMemo } from 'react';
import { getDoorProfile } from '../../engine/profile.js';
import { computeBarPositions, DimH, DimV, DimChainV, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function DoorLeafDetail2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const dr = derived?.door;
    if (!windowSpec || !dr) return null;
    const leafW = Number(dr.leafW || 0);
    const leafH = Number(dr.leafH || 0);
    if (!leafW || !leafH) return null;

    const p = getDoorProfile();
    const g = p.geometry;
    const els = p.elements;
    const d = windowSpec.door || {};

    const stile = els.leafStile.face;
    const topRail = els.leafTop.face;
    const bottomRail = els.leafBottom.face;
    const midFace = els.leafMid.face;

    const style = d.style || 'full-glass';
    let midRailY = null;
    if (style === 'three-quarter') midRailY = leafH * 0.75 - midFace / 2;
    if (style === 'half-glazed') midRailY = leafH * 0.5 - midFace / 2;

    const glassX = stile;
    const glassY = topRail;
    const glassW = Math.max(0, leafW - 2 * stile);
    const glassH = Math.max(0, (midRailY != null ? midRailY : leafH - bottomRail) - topRail);

    const bars = d.bars || {};
    const barPos = computeBarPositions({
      glassX, glassY, glassW, glassH,
      vCount: Number(bars.v) || 0, hCount: Number(bars.h) || 0, barW: BAR_WIDTH,
    });

    const parts = [].concat(...Object.values(derived.components || {}).filter(Array.isArray));
    const byCode = (c) => parts.find((x) => x.code === c);

    return {
      leafW, leafH, stile, topRail, bottomRail, midFace, midRailY, style,
      glassX, glassY, glassW, glassH, barPos,
      glassInset: g.glassInset,
      leafDepth: p.leafDepth,
      hinge: d.hingeSide || 'left',
      stileP: byCode('D-ST/L'), topP: byCode('D-TR'), botP: byCode('D-BR'),
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { leafW, leafH } = geom;
  const layoutSc = Math.max(leafW, leafH) / 500;
  const DM = 80 * layoutSc;
  const M = 90 * layoutSc;
  const TITLE_AREA = 55 * layoutSc;
  const totalW = M + leafW + DM * 2 + M;
  const totalH = M + leafH + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const railX = geom.stile;
  const railW = Math.max(0, leafW - 2 * geom.stile);
  const bottomRailY = leafH - geom.bottomRail;

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const codes = [
    geom.stileP && `${geom.stileP.code.replace('/L', '')} ×2 ${fmt(geom.stileP.length)}`,
    geom.topP && `${geom.topP.code} ${fmt(geom.topP.length)}`,
    geom.botP && `${geom.botP.code} ${fmt(geom.botP.length)}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="max-h-[72vh] w-auto max-w-full" style={{ background: COLORS.bg }}>

        {/* ── LEAF outline ── */}
        <rect x={X(0)} y={Y(0)} width={leafW} height={leafH}
          fill="none" stroke={COLORS.sash} strokeWidth={STROKES.frame} {...NS} />

        {/* Stiles run the full height */}
        <rect x={X(0)} y={Y(0)} width={geom.stile} height={leafH}
          fill={COLORS.frameFill} stroke={COLORS.sash}
          strokeWidth={STROKES.sash} {...NS} />
        <rect x={X(leafW - geom.stile)} y={Y(0)} width={geom.stile} height={leafH}
          fill={COLORS.frameFill} stroke={COLORS.sash}
          strokeWidth={STROKES.sash} {...NS} />

        {/* Rails BETWEEN the stiles */}
        <rect x={X(railX)} y={Y(0)} width={railW} height={geom.topRail}
          fill={COLORS.frameFill} stroke={COLORS.sash}
          strokeWidth={STROKES.sash} {...NS} />
        <rect x={X(railX)} y={Y(bottomRailY)} width={railW} height={geom.bottomRail}
          fill={COLORS.frameFill} stroke={COLORS.sash}
          strokeWidth={STROKES.sash} {...NS} />
        {geom.midRailY != null && (
          <rect x={X(railX)} y={Y(geom.midRailY)} width={railW} height={geom.midFace}
            fill={COLORS.frameFill} stroke={COLORS.sash}
            strokeWidth={STROKES.sash} {...NS} />
        )}

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

        <Label x={X(geom.stile / 2)} y={Y(leafH / 2)}
          text={geom.hinge === 'left' ? 'HINGE' : 'LOCK'} vbw={totalW} />
        <Label x={X(leafW - geom.stile / 2)} y={Y(leafH / 2)}
          text={geom.hinge === 'left' ? 'LOCK' : 'HINGE'} vbw={totalW} />

        {/* ── MEMBER FACES ── */}
        <DimH y={oy - DM * 0.35} x1={X(0)} x2={X(geom.stile)} extFrom={Y(0)}
          label={fmt(geom.stile)} small vbw={totalW} />
        <DimH y={oy - DM * 0.35} x1={X(leafW - geom.stile)} x2={X(leafW)} extFrom={Y(0)}
          label={fmt(geom.stile)} small vbw={totalW} />

        {/* Vertical chain: top rail · glass · (mid rail) · bottom rail */}
        <DimChainV x={ox - DM * 0.45}
          cuts={geom.midRailY != null
            ? [Y(0), Y(geom.topRail), Y(geom.midRailY), Y(geom.midRailY + geom.midFace), Y(bottomRailY), Y(leafH)]
            : [Y(0), Y(geom.topRail), Y(bottomRailY), Y(leafH)]}
          extFrom={X(0)} vbw={totalW} fmt={fmt} />

        {/* ── OVERALL ── */}
        <DimH y={oy + leafH + DM * 0.55} x1={X(0)} x2={X(leafW)} extFrom={Y(leafH)}
          label={fmt(leafW)} vbw={totalW} />
        <DimV x={ox + leafW + DM * 0.5} y1={Y(0)} y2={Y(leafH)} extFrom={X(leafW)}
          label={fmt(leafH)} vbw={totalW} />

        <TitleBlock x={totalW / 2} y={oy + leafH + DM + TITLE_AREA * 0.5}
          title={`Leaf Detail${projNum ? ` — ${projNum}` : ''} — ${winName}`}
          subtitle={`${codes} · section ${geom.stile}×${geom.leafDepth} · bottom rail ${geom.bottomRail} · glass into rebate ${geom.glassInset}/side · exterior view`}
          vbw={totalW} />
      </svg>
    </div>
  );
}
