/**
 * DoorFrameDetail2D.jsx
 *
 * The door FRAME as one timber assembly — head, jambs, cill/threshold and the
 * side-panel mullions, because a side panel sits in the SAME frame and is cut
 * from the same stock (Piotr 05.08). Exterior view, mm coordinates.
 *
 * Carries the member dimensions the elevation deliberately no longer shows:
 * section faces, cut lengths and the D-* codes the cut list uses. The leaf is
 * drawn only as a dashed ghost so the joiner can see where it lands.
 */
import { useMemo } from 'react';
import { getDoorProfile } from '../../engine/profile.js';
import { DimH, DimV, DimChainH, TitleBlock, Label } from './drawingUtils.jsx';
import { COLORS, STROKES } from './drawingTheme.js';

const NS = { vectorEffect: 'non-scaling-stroke' };

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function DoorFrameDetail2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const dr = derived?.door;
    if (!windowSpec || !dr) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;

    const p = getDoorProfile();
    const g = p.geometry;
    const els = p.elements;
    const d = windowSpec.door || {};
    const sp = d.sidePanels || {};
    const mode = sp.mode || 'none';

    const leftW = (mode === 'left' || mode === 'both') ? (Number(sp.leftWidth) || 0) : 0;
    const rightW = (mode === 'right' || mode === 'both') ? (Number(sp.rightWidth) || 0) : 0;
    const mullion = els.mullion.face;
    const inward = !!dr.inward;

    // Cut lengths straight from the engine parts, so the sheet can never
    // disagree with the cut list.
    const parts = [].concat(...Object.values(derived.components || {}).filter(Array.isArray));
    const byCode = (c) => parts.find((x) => x.code === c);

    return {
      fw, fh, g, els, inward, mullion, leftW, rightW, mode,
      frameFace: els.frameHead.face,
      cillFace: inward ? p.cillInward.faceInternal : els.frameCill.face,
      hasTimberCill: !!dr.hasTimberCill,
      threshold: dr.threshold || 'standard',
      frameDepth: p.frameDepth,
      head: byCode('D-H'), jambL: byCode('D-J/L'), cill: byCode('D-CILL'),
      leafY: g.land + g.gap,
      leafH: dr.leafH,
      overlap: inward ? els.frameHead.face - g.land - g.gap : 0,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, g } = geom;
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 80 * layoutSc;
  const M = 90 * layoutSc;
  const TITLE_AREA = 55 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalH = M + fh + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const bottomLand = geom.hasTimberCill ? g.cillVisible : 0;
  const openTop = g.land;
  const openBottom = fh - bottomLand;

  // Door opening x-range (between side panels, if any)
  const doorX = g.land + g.gap + (geom.leftW ? geom.leftW + geom.mullion : 0);
  const doorRight = fw - g.land - g.gap - (geom.rightW ? geom.rightW + geom.mullion : 0);

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const codes = [
    geom.head && `${geom.head.code} ${fmt(geom.head.length)}`,
    geom.jambL && `${geom.jambL.code.replace('/L', '')} ×2 ${fmt(geom.jambL.length)}`,
    geom.cill ? `${geom.cill.code} ${fmt(geom.cill.length)}` : `${geom.threshold} threshold — no timber cill`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="max-h-[72vh] w-auto max-w-full" style={{ background: COLORS.bg }}>

        {/* ── FRAME body ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(fh)} H ${X(0)} Z
              M ${X(g.land)} ${Y(openTop)} H ${X(fw - g.land)}
              V ${Y(openBottom)} H ${X(g.land)} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={fh}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={X(g.land)} y={Y(openTop)} width={fw - 2 * g.land} height={openBottom - openTop}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* Rebate line — inward frames lap over the leaf */}
        {geom.inward && (
          <rect x={X(geom.frameFace)} y={Y(geom.frameFace)}
            width={fw - 2 * geom.frameFace} height={fh - geom.frameFace - bottomLand}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
            strokeDasharray={`${sw(5)},${sw(3)}`} />
        )}

        {/* ── SIDE-PANEL MULLIONS (same frame, same stock) ── */}
        {geom.leftW > 0 && (
          <rect x={X(g.land + g.gap + geom.leftW)} y={Y(openTop)}
            width={geom.mullion} height={openBottom - openTop}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
        )}
        {geom.rightW > 0 && (
          <rect x={X(fw - g.land - g.gap - geom.rightW - geom.mullion)} y={Y(openTop)}
            width={geom.mullion} height={openBottom - openTop}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
        )}

        {/* ── CILL / THRESHOLD ── */}
        {geom.hasTimberCill ? (
          <>
            <rect x={X(0)} y={Y(fh - g.cillVisible)} width={fw} height={g.cillVisible}
              fill={COLORS.frameFill} stroke={COLORS.sillDetail}
              strokeWidth={STROKES.sash} {...NS} />
            <Label x={X(fw / 2)} y={Y(fh - g.cillVisible / 2) + sw(3)}
              text={geom.inward ? `CILL ${geom.cillFace} unrebated · 40→35 fall` : `CILL ${geom.cillFace}`}
              vbw={totalW} />
          </>
        ) : (
          <Label x={X(fw / 2)} y={Y(fh) - sw(6)}
            text={`${geom.threshold.toUpperCase()} THRESHOLD — no timber member`} vbw={totalW} />
        )}

        {/* ── LEAF ghost — where the door lands ── */}
        <rect x={X(doorX)} y={Y(geom.leafY)} width={Math.max(0, doorRight - doorX)} height={geom.leafH}
          fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS}
          strokeDasharray={`${sw(8)},${sw(5)}`} />
        <Label x={X((doorX + doorRight) / 2)} y={Y(geom.leafY + geom.leafH / 2)}
          text="LEAF (ref)" vbw={totalW} />

        {/* ── MEMBER SECTIONS ── */}
        <DimV x={ox - DM * 0.4} y1={Y(0)} y2={Y(g.land)} extFrom={X(0)}
          label={`head ${fmt(geom.frameFace)}`} small vbw={totalW} />
        <DimH y={oy - DM * 0.35} x1={X(0)} x2={X(g.land)} extFrom={Y(0)}
          label={`jamb ${fmt(geom.frameFace)}`} small vbw={totalW} />
        {geom.inward && (
          <Label x={X(g.land) + sw(6)} y={oy - DM * 0.62}
            text={`lap ${fmt(geom.overlap)} over leaf (${fmt(geom.overlap)}+${g.gap}+${g.land})`}
            anchor="start" vbw={totalW} />
        )}

        {/* Layer chain: frame land · gap · leaf edge */}
        <DimChainH y={oy - DM * 0.85}
          cuts={[X(0), X(g.land), X(doorX)]} extFrom={Y(0)} vbw={totalW} fmt={fmt} />

        {/* Side-panel widths */}
        {geom.leftW > 0 && (
          <DimH y={oy + fh + DM * 0.35} x1={X(g.land + g.gap)} x2={X(g.land + g.gap + geom.leftW)}
            extFrom={Y(fh)} label={`side ${fmt(geom.leftW)}`} small vbw={totalW} />
        )}
        {geom.rightW > 0 && (
          <DimH y={oy + fh + DM * 0.35}
            x1={X(fw - g.land - g.gap - geom.rightW)} x2={X(fw - g.land - g.gap)}
            extFrom={Y(fh)} label={`side ${fmt(geom.rightW)}`} small vbw={totalW} />
        )}

        {/* ── OVERALL ── */}
        <DimH y={oy + fh + DM * 0.75} x1={X(0)} x2={X(fw)} extFrom={Y(fh)}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 0.5} y1={Y(0)} y2={Y(fh)} extFrom={X(fw)}
          label={fmt(fh)} vbw={totalW} />

        <TitleBlock x={totalW / 2} y={oy + fh + DM + TITLE_AREA * 0.5}
          title={`Frame Detail${projNum ? ` — ${projNum}` : ''} — ${winName}`}
          subtitle={`${codes} · section ${geom.frameFace}×${geom.frameDepth} · ${geom.inward ? 'inward' : 'outward'} · exterior view`}
          vbw={totalW} />
      </svg>
    </div>
  );
}
