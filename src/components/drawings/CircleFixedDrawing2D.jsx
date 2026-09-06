/**
 * CircleFixedDrawing2D.jsx — the three casement sheets of a CIRCLE fixed
 * window (ARCHED-WINDOWS-v3 Block 3, Piotr 07.09): elevation,
 * frame detail, leaf detail. A circle has no straight member — the frame and
 * the leaf are full rings — so the rectangular sheets delegate here instead
 * of drawing jambs and a cill that do not exist.
 *
 * ONE contour rule: every arc is the engine's ring (derived.arch.geometry:
 * frameHead / leafTop / rebateWall / glass) drawn as an SVG `A` command via
 * archDrawUtils — the same ArcChains the CNC DXF and the glazier get. The
 * arch frame's origin is the circle centre (arch.js circleArcs), so
 * archToSheet(D, R, ox, oy) puts the centre at the frame's centre.
 *
 * `view`: 'elevation' (exterior view, glass + bars) · 'frame' (frame ring +
 * rebate wall, blank plan) · 'leaf' (leaf ring + glass + bars, blank plan).
 * All sizes / colours from drawingTheme; `sc` scales positions only.
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { DimH, DimV, TitleBlock, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { archToSheet, glassToSheet, closedChainD, ringBandD, barBandD, arcLabelPoint } from './archDrawUtils.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

const VIEW_TITLE = { elevation: 'Front Elevation', frame: 'Frame Detail', leaf: 'Leaf Detail' };

export default function CircleFixedDrawing2D({ windowSpec, derived, projectNumber, view = 'elevation' }) {
  const geom = useMemo(() => {
    const A = derived?.arch;
    if (!windowSpec || !A?.geometry || A.geometry.shape !== 'circle' || !A.glassOutline) return null;
    const AG = A.geometry;
    const D = AG.width;
    const p = getCasementProfile();
    const box = derived.components?.box || [];
    const sash = derived.components?.sash || [];
    const frameRec = box.find((r) => r.elementName === 'C-FRAME RING');
    const leafRec = sash.find((r) => r.elementName === 'C-LEAF RING');
    return {
      D, R: D / 2, AG, p,
      outline: A.glassOutline,
      bars: A.bars || [],
      frameRec, leafRec,
      plans: A.plans,
      tracery: A.tracery,
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { D, R, AG, p, outline: O } = geom;
  const layoutSc = D / 500;
  const DM = 60 * layoutSc;
  const M = 70 * layoutSc;
  const TITLE_AREA = 95 * layoutSc;                            // three title lines
  const totalW = M + D + DM * 2 + M;
  const totalH = M + D + DM + TITLE_AREA;
  const ox = M, oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const sw = (n) => n * layoutSc;
  const txF = archToSheet(D, R, ox, oy);                       // circle centre → (ox + R, oy + R)
  const txG = glassToSheet(X(O.origin.x), Y(D - O.origin.y - O.height), O.height);
  const cx = X(R), cy = Y(R);
  const clipId = `clip-circle-${view}-${String(windowSpec?.id || windowSpec?.name || 'w').replace(/[^a-zA-Z0-9]/g, '_')}`;
  const annFs = tfs(SIZES.dimSmall, totalW);
  const ts = totalW / VIEWBOX_REF;

  const frameBandD = ringBandD(AG.frameHead.outer, AG.frameHead.inner, txF);
  const leafBandD = ringBandD(AG.leafTop.outer, AG.leafTop.inner, txF);
  const wallD = closedChainD(AG.rebateWall, txF);
  const glassD = closedChainD(O.arcs, txG);
  const barsD = geom.bars.map((b) => barBandD(b, txG, BAR_WIDTH / 2));
  const rFrame = AG.frameHead.outer[0].r, rFrameIn = AG.frameHead.inner[0].r;
  const rLeaf = AG.leafTop.outer[0].r, rLeafIn = AG.leafTop.inner[0].r;
  const rGlass = AG.glass.radius;
  const planText = (plan) => (plan ? (plan.noStock ? 'no stock board fits' : `${plan.totalPieces} pieces · stock ${plan.arcs.map((a) => a.default?.stock).join('/')}`) : '');

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `${VIEW_TITLE[view] || 'Drawing'}${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `Casement · fixed · circle Ø ${fmt(D)} mm · ${view === 'elevation' ? 'exterior view' : view === 'frame' ? 'frame ring' : 'leaf ring'}`;
  const line3 = view === 'frame'
    ? `C-FRAME RING ${fmt(p.elements.frameHead.face)} face · R ${fmt(rFrame)} / ${fmt(rFrameIn)} · centre L ${geom.frameRec ? fmt(geom.frameRec.length) : '—'} · ${planText(geom.plans?.frameHead)}`
    : view === 'leaf'
      ? `C-LEAF RING ${fmt(p.elements.leafTop.face)} face · R ${fmt(rLeaf)} / ${fmt(rLeafIn)} · centre L ${geom.leafRec ? fmt(geom.leafRec.length) : '—'} · glass R ${fmt(rGlass)} · ${planText(geom.plans?.leafTop)}`
      : `Frame R ${fmt(rFrame)} / ${fmt(rFrameIn)} · leaf R ${fmt(rLeaf)} / ${fmt(rLeafIn)} · glass R ${fmt(rGlass)}${geom.bars.length ? ` · ${geom.bars.length} bars` : ''}`;
  const titleY = oy + D + DM + TITLE_AREA * 0.5;
  // radius labels: each ring labelled at its own angle on the upper half so they never stack
  const atAngle = (arc, tx, deg, offset) => arcLabelPoint({ ...arc, a0: (deg - 1) * Math.PI / 180, a1: (deg + 1) * Math.PI / 180 }, tx, offset);
  const labels = [
    { r: rFrame, at: atAngle(AG.frameHead.outer[0], txF, 90, sw(14)) },
    ...(view !== 'leaf' ? [{ r: rFrameIn, at: atAngle(AG.frameHead.inner[0], txF, 55, -sw(12)) }] : []),
    ...(view !== 'frame' ? [{ r: rLeaf, at: atAngle(AG.leafTop.outer[0], txF, 125, -sw(30)) }, { r: rGlass, at: atAngle(O.arcs[0], txG, 35, -sw(14)) }] : []),
  ];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}
        data-arch-origin={`${ox},${oy}`} data-circle-centre={`${cx},${cy}`}>

        {/* frame ring */}
        <path d={frameBandD} fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        {view !== 'leaf' && (
          <path d={wallD} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS}
            strokeDasharray={`${sw(8)},${sw(4)}`} />
        )}
        {/* leaf ring + glass + bars */}
        {view !== 'frame' && (
          <>
            <path d={leafBandD} fill={view === 'leaf' ? COLORS.frameFill : 'none'} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
            <path d={glassD} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
              stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
            <clipPath id={clipId}><path d={glassD} /></clipPath>
            <g clipPath={`url(#${clipId})`}>
              {barsD.map((d, k) => (
                <path key={`b-${k}`} d={d} fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
              ))}
            </g>
          </>
        )}
        {/* centre lines */}
        <line x1={X(0) - sw(10)} y1={cy} x2={X(D) + sw(10)} y2={cy}
          stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
          strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
        <line x1={cx} y1={Y(0) - sw(10)} x2={cx} y2={Y(D) + sw(10)}
          stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
          strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
        {labels.map((rl, k) => (
          <text key={`r-${k}`} x={rl.at[0]} y={rl.at[1]} fill={COLORS.dim} fontSize={annFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.dim}>{`R ${fmt(rl.r)}`}</text>
        ))}
        {/* overall dims: diameter both ways */}
        <DimH y={oy + D + DM * 0.8} x1={X(0)} x2={X(D)} extFrom={Y(D)} label={`Ø ${fmt(D)}`} vbw={totalW} />
        <DimV x={ox + D + DM * 0.8} y1={Y(0)} y2={Y(D)} extFrom={X(D)} label={fmt(D)} vbw={totalW} />
        <TitleBlock x={totalW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={totalW} />
        <text x={totalW / 2} y={titleY + 40 * ts} fill={COLORS.subtitle} fontSize={SIZES.subtitle * ts}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{line3}</text>
      </svg>
    </div>
  );
}
