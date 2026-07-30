/**
 * CasementElevation2D.jsx
 *
 * Composite exterior view of a casement window — same drawing system as the
 * sash FrontElevation2D: mm coordinates, dark theme, non-scaling strokes,
 * DimH/DimV + TitleBlock from drawingUtils. Geometry comes exclusively from
 * derived.casement (engine single source) + the casement profile:
 * layers 36 · 4 · LEAF · 6 · [8|axis|13] · 4 · LEAF · 6 · 41.
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { computeBarPositions, DimH, DimV, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES, DIMS, VIEWBOX_REF } from './drawingTheme.js';
import { casementBarCounts } from './casementDrawUtils.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function CasementElevation2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const cas = derived?.casement;
    if (!windowSpec || !cas?.leafRects) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;
    const p = getCasementProfile();
    const g = p.geometry;
    const stile = p.elements.leafStile.face;
    const bars = windowSpec.casement?.bars || {};

    const leaves = cas.leafRects.map((r, i) => {
      const pn = cas.layoutDef.panels[i];
      const glassX = r.x + stile, glassY = r.y + stile;
      const glassW = r.w - 2 * stile, glassH = r.h - 2 * stile;
      const counts = casementBarCounts(bars, pn._role || 'main');
      const barPos = computeBarPositions({
        glassX, glassY, glassW, glassH,
        vCount: counts.v, hCount: counts.h, barW: BAR_WIDTH,
      });
      return { r, hinge: pn.hinge, glassX, glassY, glassW, glassH, barPos, i };
    });

    return {
      fw, fh, g, stile, leaves,
      mullions: cas.mullionRuns || [],
      transoms: cas.transomRuns || [],
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, g } = geom;

  // ─── Layout (mm = SVG units, same convention as sash drawings) ───
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

  const landRect = {
    x: X(g.land), y: Y(g.land),
    w: fw - 2 * g.land, h: fh - g.land - g.cillVisible,
  };

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `Casement ${derived.casement.layout} · ${fw} × ${fh} mm · exterior view`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── FRAME band (outer − rebate opening) + cill face ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(fh)} H ${X(0)} Z
              M ${landRect.x} ${landRect.y} H ${landRect.x + landRect.w}
              V ${landRect.y + landRect.h} H ${landRect.x} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={fh}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={landRect.x} y={landRect.y} width={landRect.w} height={landRect.h}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
        {/* Cill face top edge */}
        <line x1={X(0)} y1={Y(fh - g.cillVisible)} x2={X(fw)} y2={Y(fh - g.cillVisible)}
          stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />

        {/* ── MULLIONS (through) + axes ── */}
        {geom.mullions.map((mu, i) => (
          <g key={`mu-${i}`}>
            <rect x={X(mu.x1)} y={Y(mu.full ? g.land : mu.yTop)}
              width={mu.x2 - mu.x1}
              height={(mu.full ? fh - g.cillVisible : mu.yBottom) - (mu.full ? g.land : mu.yTop)}
              fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            <line x1={X(mu.axisX)} y1={Y(0) - sw(10)} x2={X(mu.axisX)} y2={Y(fh) + sw(10)}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
              strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
          </g>
        ))}

        {/* ── TRANSOMS (asymmetric land 8/13 around the axis) + axes ── */}
        {geom.transoms.map((tr, i) => (
          <g key={`tr-${i}`}>
            <rect x={X(tr.x1)} y={Y(tr.bandTop)} width={tr.x2 - tr.x1}
              height={tr.bandBottom - tr.bandTop}
              fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            <line x1={X(0) - sw(10)} y1={Y(tr.axisT)} x2={X(fw) + sw(10)} y2={Y(tr.axisT)}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
              strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
          </g>
        ))}

        {/* ── LEAVES: outline, glass, bars, opening symbol, pane label ── */}
        {geom.leaves.map((lf) => (
          <g key={`lf-${lf.i}`}>
            <rect x={X(lf.r.x)} y={Y(lf.r.y)} width={lf.r.w} height={lf.r.h}
              fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            <rect x={X(lf.glassX)} y={Y(lf.glassY)} width={lf.glassW} height={lf.glassH}
              fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
              stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
            {lf.barPos.vBars.map((vb, k) => (
              <rect key={`vb-${k}`} x={X(vb.left)} y={Y(lf.glassY)}
                width={BAR_WIDTH} height={lf.glassH}
                fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            ))}
            {lf.barPos.hBars.map((hb, k) => (
              <rect key={`hb-${k}`} x={X(lf.glassX)} y={Y(hb.top)}
                width={lf.glassW} height={BAR_WIDTH}
                fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            ))}
            {lf.hinge === 'left' && (
              <path d={`M ${X(lf.r.x + lf.r.w)} ${Y(lf.r.y)} L ${X(lf.r.x)} ${Y(lf.r.y + lf.r.h / 2)} L ${X(lf.r.x + lf.r.w)} ${Y(lf.r.y + lf.r.h)}`}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
                strokeDasharray={`${sw(6)},${sw(4)}`} />
            )}
            {lf.hinge === 'right' && (
              <path d={`M ${X(lf.r.x)} ${Y(lf.r.y)} L ${X(lf.r.x + lf.r.w)} ${Y(lf.r.y + lf.r.h / 2)} L ${X(lf.r.x)} ${Y(lf.r.y + lf.r.h)}`}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
                strokeDasharray={`${sw(6)},${sw(4)}`} />
            )}
            {lf.hinge === 'top' && (
              <path d={`M ${X(lf.r.x)} ${Y(lf.r.y + lf.r.h)} L ${X(lf.r.x + lf.r.w / 2)} ${Y(lf.r.y)} L ${X(lf.r.x + lf.r.w)} ${Y(lf.r.y + lf.r.h)}`}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
                strokeDasharray={`${sw(6)},${sw(4)}`} />
            )}
            <Label x={X(lf.r.x + lf.r.w / 2)} y={Y(lf.r.y + lf.r.h / 2) + sw(5)}
              text={`P${lf.i + 1}`} vbw={totalW} />
          </g>
        ))}

        {/* ── AXIS DIMS: transoms (left), mullions (top) ── */}
        {geom.transoms.map((tr, i) => (
          <DimV key={`ta-${i}`} x={ox - DM * (0.45 + i * 0.35)}
            y1={Y(0)} y2={Y(tr.axisT)} extFrom={X(0)}
            label={`T ${fmt(tr.axisT)}`} small vbw={totalW} />
        ))}
        {geom.mullions.filter((mu) => mu.full).map((mu, i) => (
          <DimH key={`ma-${i}`} y={oy - DM * (0.45 + i * 0.35)}
            x1={X(0)} x2={X(mu.axisX)} extFrom={Y(0)}
            label={`axis ${fmt(mu.axisX)}`} small vbw={totalW} />
        ))}

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
