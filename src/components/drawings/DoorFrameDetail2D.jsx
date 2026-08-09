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

    const totalH = Number(dr.totalHeight) || fh;
    return {
      fw, fh, totalH, dy: totalH - fh, g, els, inward, mullion, leftW, rightW, mode,
      zones: dr.zones || {}, leaves: dr.leaves || [],
      frameFace: els.frameHead.face,
      cillFace: inward ? p.cillInward.faceInternal : els.frameCill.face,
      hasTimberCill: !!dr.hasTimberCill,
      threshold: dr.threshold || 'standard',
      frameDepth: p.frameDepth,
      head: byCode('D-H'), jambL: byCode('D-J/L'), cill: byCode('D-CILL'),
      mullionP: byCode('D-M'), transomP: byCode('D-T'),
      leafY: (totalH - fh) + g.land + g.gap,
      leafH: dr.leafH,
      overlap: inward ? els.frameHead.face - g.land - g.gap : 0,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, g, dy } = geom;
  const frameH = geom.totalH;                 // full frame incl. fan zone
  const layoutSc = Math.max(fw, frameH) / 500;
  const DM = 80 * layoutSc;
  const M = 90 * layoutSc;
  const TITLE_AREA = 55 * layoutSc;
  const totalW = M + fw + DM * 2 + M;
  const totalH = M + frameH + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;

  const bottomLand = geom.hasTimberCill ? g.cillVisible : 0;
  const openTop = g.land;
  const openBottom = frameH - bottomLand;

  // Door opening x-range straight from the ENGINE zones — this sheet does
  // no width math of its own (v1 recomputed it and could drift).
  const doorX = geom.zones.doorX ?? (g.land + g.gap);
  const doorRight = doorX + (geom.zones.doorW ?? (fw - 2 * (g.land + g.gap)));

  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const codes = [
    geom.head && `${geom.head.code} ${fmt(geom.head.length)}`,
    geom.jambL && `${geom.jambL.code.replace('/L', '')} ×2 ${fmt(geom.jambL.length)}`,
    geom.cill ? `${geom.cill.code} ${fmt(geom.cill.length)}` : `${geom.threshold} threshold — no timber cill`,
    geom.mullionP && `${geom.mullionP.code} ×${geom.mullionP.quantity || 1} ${fmt(geom.mullionP.length)}`,
    geom.transomP && `${geom.transomP.code} ${fmt(geom.transomP.length)}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="max-h-[72vh] w-auto max-w-full" style={{ background: COLORS.bg }}>

        {/* ── FRAME body ── */}
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(frameH)} H ${X(0)} Z
              M ${X(g.land)} ${Y(openTop)} H ${X(fw - g.land)}
              V ${Y(openBottom)} H ${X(g.land)} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={frameH}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={X(g.land)} y={Y(openTop)} width={fw - 2 * g.land} height={openBottom - openTop}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />

        {/* Rebate line — inward frames lap over the leaf */}
        {geom.inward && (
          <rect x={X(geom.frameFace)} y={Y(dy + geom.frameFace)}
            width={fw - 2 * geom.frameFace} height={fh - geom.frameFace - bottomLand}
            fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
            strokeDasharray={`${sw(5)},${sw(3)}`} />
        )}

        {/* ── SIDE-PANEL MULLIONS — full 68 face centred on the engine axis
             (v1 placed them 17 off; axis = panel edge + 17), door zone only ── */}
        {(geom.zones.mullions || []).map((mu, i) => (
          <rect key={i} x={X(mu.axis - geom.mullion / 2)} y={Y(dy + g.land)}
            width={geom.mullion} height={fh - g.land - bottomLand}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
        ))}

        {/* ── TRANSOM RAIL — bottom flush with the door-opening top (3D) ── */}
        {geom.zones.transom && <>
          <rect x={X(g.land)} y={Y(dy - (geom.zones.transom.railH - geom.frameFace))}
            width={fw - 2 * g.land}
            height={(geom.zones.transom.railH - geom.frameFace) + g.land + g.gap}
            fill={COLORS.frameFill} stroke={COLORS.frame}
            strokeWidth={STROKES.frameLight} {...NS} />
          <Label x={X(fw / 2)} y={Y(dy + (g.land + g.gap) / 2) + sw(3)}
            text={`${geom.transomP ? `${geom.transomP.code} ${fmt(geom.transomP.length)}` : 'D-T'} · rail ${geom.zones.transom.railH} · fan cavity ${fmt(geom.zones.transom.cavity)}`}
            vbw={totalW} />
        </>}

        {/* ── CILL / THRESHOLD ── */}
        {geom.hasTimberCill ? (
          <>
            <rect x={X(0)} y={Y(frameH - g.cillVisible)} width={fw} height={g.cillVisible}
              fill={COLORS.frameFill} stroke={COLORS.sillDetail}
              strokeWidth={STROKES.sash} {...NS} />
            <Label x={X(fw / 2)} y={Y(frameH - g.cillVisible / 2) + sw(3)}
              text={geom.inward ? `CILL ${geom.cillFace} unrebated · 40→35 fall` : `CILL ${geom.cillFace}`}
              vbw={totalW} />
          </>
        ) : (
          <Label x={X(fw / 2)} y={Y(frameH) - sw(6)}
            text={`${geom.threshold.toUpperCase()} THRESHOLD — no timber member`} vbw={totalW} />
        )}

        {/* ── LEAF ghosts straight from the engine (french = two) ── */}
        {geom.leaves.map((leaf, i) => (
          <rect key={i} x={X(leaf.x)} y={Y(geom.leafY)} width={leaf.w} height={leaf.h}
            fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS}
            strokeDasharray={`${sw(8)},${sw(5)}`} />
        ))}
        <Label x={X((doorX + doorRight) / 2)} y={Y(geom.leafY + geom.leafH / 2)}
          text={geom.leaves.length === 2 ? 'LEAVES ×2 (ref)' : 'LEAF (ref)'} vbw={totalW} />

        {/* ── MEMBER SECTIONS — head left, cill right, jamb on top, so no two
             dimensions share a line (Piotr 05.08) ── */}
        <DimV x={ox - DM * 0.4} y1={Y(0)} y2={Y(g.land)} extFrom={X(0)}
          label={`head ${fmt(geom.frameFace)}`} small vbw={totalW} />
        <DimH y={oy - DM * 0.35} x1={X(0)} x2={X(g.land)} extFrom={Y(0)}
          label={`jamb ${fmt(geom.frameFace)}`} small vbw={totalW} />
        {/* Cill height — was missing entirely (Piotr 05.08) */}
        {geom.hasTimberCill && (
          <DimV x={ox + fw + DM * 0.35} y1={Y(fh - g.cillVisible)} y2={Y(fh)}
            extFrom={X(fw)} label={`cill ${fmt(g.cillVisible)}`} small vbw={totalW} />
        )}
        {geom.inward && (
          <Label x={X(0)} y={oy - DM * 1.15}
            text={`inward · lap ${fmt(geom.overlap)} over leaf (${fmt(geom.overlap)}+${g.gap}+${g.land})`}
            anchor="start" vbw={totalW} />
        )}

        {/* Layer chain: frame land · gap · leaf edge */}
        <DimChainH y={oy - DM * 0.75}
          cuts={[X(0), X(g.land), X(doorX)]} extFrom={Y(0)} vbw={totalW} fmt={fmt} />

        {/* Side-panel widths — engine zones */}
        {geom.zones.leftPanel && (
          <DimH y={oy + frameH + DM * 0.35} x1={X(geom.zones.leftPanel.x)}
            x2={X(geom.zones.leftPanel.x + geom.zones.leftPanel.w)}
            extFrom={Y(frameH)} label={`side ${fmt(geom.zones.leftPanel.w)}`} small vbw={totalW} />
        )}
        {geom.zones.rightPanel && (
          <DimH y={oy + frameH + DM * 0.35} x1={X(geom.zones.rightPanel.x)}
            x2={X(geom.zones.rightPanel.x + geom.zones.rightPanel.w)}
            extFrom={Y(frameH)} label={`side ${fmt(geom.zones.rightPanel.w)}`} small vbw={totalW} />
        )}

        {/* ── OVERALL ── */}
        <DimH y={oy + frameH + DM * 0.75} x1={X(0)} x2={X(fw)} extFrom={Y(frameH)}
          label={fmt(fw)} vbw={totalW} />
        {geom.zones.transom && (
          <DimV x={ox + fw + DM * 0.4} y1={Y(0)} y2={Y(dy)} extFrom={X(fw)}
            label={`fan ${fmt(geom.zones.transom.h)}`} small vbw={totalW} />
        )}
        <DimV x={ox + fw + DM * 0.85} y1={Y(0)} y2={Y(frameH)} extFrom={X(fw)}
          label={fmt(frameH)} vbw={totalW} />

        <TitleBlock x={totalW / 2} y={oy + frameH + DM + TITLE_AREA * 0.5}
          title={`Frame Detail${projNum ? ` — ${projNum}` : ''} — ${winName}`}
          subtitle={`${codes} · section ${geom.frameFace}×${geom.frameDepth} · ${geom.inward ? 'inward' : 'outward'} · exterior view`}
          vbw={totalW} />
      </svg>
    </div>
  );
}
