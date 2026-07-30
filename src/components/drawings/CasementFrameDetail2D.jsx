/**
 * CasementFrameDetail2D.jsx
 *
 * Frame-only drawing (no leaves) — BoxDetail2D analogue for casement:
 * outer frame, rebate/land opening, cill face, mullions and transoms with
 * their axes, member dimension chains (gaps not dimensioned) and element
 * letter codes with cut lengths + finished sections. Same drawing system
 * as sash: mm coordinates, dark theme, drawingUtils dims.
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { DimChainH, DimChainV, DimH, DimV, TitleBlock, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function CasementFrameDetail2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const cas = derived?.casement;
    if (!windowSpec || !cas) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;
    const p = getCasementProfile();
    return {
      fw, fh, g: p.geometry, p,
      mullions: cas.mullionRuns || [],
      transoms: cas.transomRuns || [],
      secF: `${p.elements.frameHead.face}×${p.frameDepth}`,
      secC: `${p.elements.frameCill.face}×${p.frameDepth}`,
      secM: `${p.elements.mullion.face}×${p.frameDepth}`,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, g } = geom;
  const layoutSc = Math.max(fw, fh) / 500;
  const sw = (n) => n * layoutSc;
  const DM = 70 * layoutSc;
  const M = 80 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalH = M + fh + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const ts = totalW / VIEWBOX_REF;
  const annFs = tfs(SIZES.code, totalW);

  const landRect = {
    x: X(g.land), y: Y(g.land),
    w: fw - 2 * g.land, h: fh - g.land - g.cillVisible,
  };

  // Horizontal member chain (gaps at leaves don't exist here — frame only):
  // 0 · 36 · [per full mullion: x1 · x2] · fw−36 · fw
  const hCuts = [0, g.land];
  geom.mullions.filter((mu) => mu.full).forEach((mu) => { hCuts.push(mu.x1, mu.x2); });
  hCuts.push(fw - g.land, fw);

  // Vertical member chain: 0 · 36 · [per transom: bandTop · bandBottom] · fh−41 · fh
  const vCuts = [0, g.land];
  [...geom.transoms].sort((a, b) => a.axisT - b.axisT).forEach((tr) => {
    vCuts.push(tr.bandTop, tr.bandBottom);
  });
  vCuts.push(fh - g.cillVisible, fh);

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `Frame Detail${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `C-H ${fmt(fw)} · C-CILL ${fmt(fw)} · C-J ×2 ${fmt(fh)}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── FRAME band + cill face ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(fh)} H ${X(0)} Z
              M ${landRect.x} ${landRect.y} H ${landRect.x + landRect.w}
              V ${landRect.y + landRect.h} H ${landRect.x} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={fh}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={landRect.x} y={landRect.y} width={landRect.w} height={landRect.h}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
        <line x1={X(0)} y1={Y(fh - g.cillVisible)} x2={X(fw)} y2={Y(fh - g.cillVisible)}
          stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />

        {/* ── MULLIONS + axes + codes ── */}
        {geom.mullions.map((mu, i) => (
          <g key={`mu-${i}`}>
            <rect x={X(mu.x1)} y={Y(mu.full ? g.land : mu.yTop)}
              width={mu.x2 - mu.x1}
              height={(mu.full ? fh - g.cillVisible : mu.yBottom) - (mu.full ? g.land : mu.yTop)}
              fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            <line x1={X(mu.axisX)} y1={Y(0) - sw(12)} x2={X(mu.axisX)} y2={Y(fh) + sw(12)}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
              strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
            <text x={X(mu.axisX)} y={Y(fh * 0.32) + i * annFs * 1.3} fill={COLORS.label}
              fontSize={annFs} fontFamily={FONT_FAMILY} textAnchor="middle"
              fontWeight={WEIGHTS.label} transform={`rotate(-90, ${X(mu.axisX) - annFs * 0.9}, ${Y(fh * 0.32)})`}>
              {`${mu.code} ${fmt(mu.length)}${mu.full ? '' : ' · partial'}`}
            </text>
          </g>
        ))}

        {/* ── TRANSOMS + axes + codes ── */}
        {geom.transoms.map((tr, i) => (
          <g key={`tr-${i}`}>
            <rect x={X(tr.x1)} y={Y(tr.bandTop)} width={tr.x2 - tr.x1}
              height={tr.bandBottom - tr.bandTop}
              fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
            <line x1={X(0) - sw(12)} y1={Y(tr.axisT)} x2={X(fw) + sw(12)} y2={Y(tr.axisT)}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
              strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
            <text x={X((tr.x1 + tr.x2) / 2)} y={Y(tr.bandTop) - annFs * 0.6}
              fill={COLORS.label} fontSize={annFs} fontFamily={FONT_FAMILY}
              textAnchor="middle" fontWeight={WEIGHTS.label}>
              {`${tr.code} ${fmt(tr.length)}`}
            </text>
          </g>
        ))}

        {/* ── Frame member codes ── */}
        <text x={X(fw / 2)} y={Y(g.land / 2) + annFs * 0.35} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{`C-H ${fmt(fw)}`}</text>
        <text x={X(fw / 2)} y={Y(fh - g.cillVisible / 2) + annFs * 0.35} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{`C-CILL ${fmt(fw)}`}</text>
        <text x={X(g.land / 2)} y={Y(fh / 2)} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${X(g.land / 2)}, ${Y(fh / 2)})`}>
          {`C-J/L ${fmt(fh)}`}
        </text>
        <text x={X(fw - g.land / 2)} y={Y(fh / 2)} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${X(fw - g.land / 2)}, ${Y(fh / 2)})`}>
          {`C-J/R ${fmt(fh)}`}
        </text>

        {/* ── AXIS DIMS ── */}
        {geom.transoms.map((tr, i) => (
          <DimV key={`ta-${i}`} x={ox - DM * (0.45 + i * 0.35)}
            y1={Y(0)} y2={Y(tr.axisT)} extFrom={X(0)}
            label={`T ${fmt(tr.axisT)}`} small vbw={totalW} />
        ))}
        {geom.mullions.filter((mu) => mu.full).map((mu, i) => (
          <DimH key={`ma-${i}`} y={oy + fh + DM * (0.35 + i * 0.3)}
            x1={X(0)} x2={X(mu.axisX)} extFrom={Y(fh)}
            label={`axis ${fmt(mu.axisX)}`} small vbw={totalW} />
        ))}

        {/* ── MEMBER CHAINS ── */}
        <DimChainH y={oy - 24 * ts} cuts={hCuts.map(X)} extFrom={oy - 4 * ts}
          vbw={totalW} fmt={(n) => fmt(n)} />
        <DimChainV x={ox + fw + 26 * ts} cuts={vCuts.map(Y)} extFrom={ox + fw + 4 * ts}
          vbw={totalW} fmt={(n) => fmt(n)} />

        {/* ── OVERALL ── */}
        <DimH y={oy + fh + DM * 0.85} x1={X(0)} x2={X(fw)} extFrom={Y(fh)}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 1.15} y1={Y(0)} y2={Y(fh)} extFrom={X(fw)}
          label={fmt(fh)} vbw={totalW} />

        {/* ── TITLE ── */}
        <TitleBlock x={totalW / 2} y={oy + fh + DM + TITLE_AREA * 0.5}
          title={titleText} subtitle={subtitleText} vbw={totalW} />
      </svg>
    </div>
  );
}
