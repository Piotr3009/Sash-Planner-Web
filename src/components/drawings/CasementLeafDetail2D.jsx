/**
 * CasementLeafDetail2D.jsx
 *
 * Single-leaf drawing — direct analogue of SashDetail2D: mm coordinates,
 * dark theme, DimChainH/DimChainV with bar cuts, glazing-bar crosses and
 * V-notches, Expand/Collapse. One drawing serves every pane of the same
 * leaf group (identical size + role); pane list goes in the title.
 * Vertogen: all four members are the same section (67), so the top/bottom
 * edges equal the stile face. The dashed inner line is the 24mm glass unit
 * edge — the glass enters 12.5 into the rebate past the visible daylight.
 *
 * Arched casement (arched-casement-v2 night 4, spec §4 D): the leaf top rail
 * is the C-ARCH TOP RAIL ring from derived.arch.geometry (the SAME ArcChain
 * the arch CNC DXF routes), the unit edge is derived.arch.glassOutline, the
 * bars are derived.arch.bars as 22 mm bands clipped to the daylight (crosses
 * and V-notches only for the straight h / v bars). Dims add the straight
 * stile, the leaf rise and the leaf top radii. Rectangular leaves take the
 * branch below unchanged (byte-identical, verify/arch/t19.mjs).
 */
import { useMemo, useState } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { computeBarPositions, DimChainH, DimChainV, DimH, DimV, TitleBlock, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { casementBarCounts, casementRoleName, paneTitle } from './casementDrawUtils.js';
import { archToSheet, glassToSheet, archedOutlineD, ringBandD, barBandD, arcLabelPoint, isHaunchArc, radiiText } from './archDrawUtils.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const BAR_WIDTH = 22;

const C = {
  outer: COLORS.sash, rebate: COLORS.glass, glassFill: COLORS.glass,
  meeting: COLORS.meeting, notch: COLORS.notch,
  bgFill: 'rgba(148,163,184,0.03)',
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
  for (const [cS, cE] of sorted) {
    if (cS > pos) segs.push({ a: pos, b: cS });
    pos = Math.max(pos, cE);
  }
  if (pos < to) segs.push({ a: pos, b: to });
  return segs;
}

export default function CasementLeafDetail2D({ windowSpec, derived, group, onExpand, projectNumber, selectedElement, onElementClick }) {
  const clickable = typeof onElementClick === 'function';
  const hl = (key) => clickable && selectedElement === key;
  const [expanded, setExpanded] = useState(false);
  const isExternalExpand = !!onExpand;
  const handleExpand = (e) => {
    e.stopPropagation();
    if (isExternalExpand) { onExpand(); } else { setExpanded(!expanded); }
  };

  const geom = useMemo(() => {
    const cas = derived?.casement;
    if (!windowSpec || !cas?.leaves || !group) return null;
    const idx = group.rep;
    const mm = cas.leaves[idx];
    if (!mm) return null;
    const p = getCasementProfile();
    const stile = p.elements.leafStile.face;
    const glassIn = p.deductions.glass / 2 - stile; // −12.5: unit edge inside the wood
    const pn = cas.layoutDef.panels[idx];
    const leafW = mm.leafW, leafH = mm.leafH;
    const glassX = stile, glassY = stile;
    const glassW = leafW - 2 * stile, glassH = leafH - 2 * stile;
    const unitX = stile + glassIn, unitY = stile + glassIn; // 54.5 inset
    const unitW = leafW - 2 * (stile + glassIn);
    const unitH = leafH - 2 * (stile + glassIn);
    const role = pn._role || 'main';
    const counts = casementBarCounts(windowSpec.casement?.bars, role);
    let { vBars, hBars } = computeBarPositions({
      glassX, glassY, glassW, glassH,
      vCount: counts.v, hCount: counts.h, barW: BAR_WIDTH,
    });
    // ── Arched leaf: rings + glass outline + bars from derived.arch ──
    let arch = null;
    const A = derived.arch;
    const rect = cas.leafRects?.[idx];
    const fw = Number(windowSpec.frame?.width ?? 0);
    if (A?.geometry && A.glassOutline && rect && fw && idx === 0) {
      const AG = A.geometry;
      const railRec = (derived.components?.sash || []).find((r) => r.name === 'C-ARCH TOP RAIL');
      const isH = (b) => b.kind === 'straight' && Math.abs(b.from[1] - b.to[1]) < 1e-6 && (b.role === 'h' || b.role === 'springing');
      const isV = (b) => b.kind === 'straight' && b.role === 'v' && Math.abs(b.from[0] - b.to[0]) < 1e-6;
      const bars = A.bars || [];
      // straight bars in LEAF coordinates (glass frame x + unitX; y down from the leaf top)
      const vList = [...new Set(bars.filter(isV).map((b) => b.from[0]))].sort((a, b) => a - b)
        .map((x) => ({ cx: unitX + x, left: unitX + x - BAR_WIDTH / 2, right: unitX + x + BAR_WIDTH / 2 }));
      const hList = [...new Set(bars.filter(isH).map((b) => b.from[1]))].sort((a, b) => b - a)
        .map((y) => { const cy = unitY + A.glassOutline.height - y; return { cy, top: cy - BAR_WIDTH / 2, bot: cy + BAR_WIDTH / 2 }; });
      vBars = []; hBars = [];                       // the rectangular bar drawing is replaced by the engine bands
      arch = {
        AG, rect, fw, rise: AG.rise,
        springingY: AG.rise - rect.y,                 // springing line in leaf coords
        leafOuter: AG.leafTop.outer,
        leafInner: AG.leafTop.inner,
        outline: A.glassOutline,
        bars,
        vList, hList,
        railLength: railRec ? railRec.length : AG.leafTop.lengths.centre,
        straightStile: AG.leafStraightStile,
      };
    }
    return {
      leafW, leafH, stile, glassX, glassY, glassW, glassH,
      unitX, unitY, unitW, unitH, vBars, hBars, arch,
      hinge: pn.hinge, role, bounds: cas.paneBounds?.[idx],
      glassUnitW: leafW - p.deductions.glass,
      glassUnitH: leafH - p.deductions.glass,
    };
  }, [windowSpec, derived, group]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const layoutSc = Math.max(geom.leafW, geom.leafH) / 500;
  const sw = (n) => n * layoutSc;
  const MGN_TOP_DIM = 80 * layoutSc;
  const MGN_LEFT_DIM = 80 * layoutSc;
  const MGN_RIGHT_DIM = 110 * layoutSc;
  const MGN_BOT_DIM = 80 * layoutSc;
  const MGN_TITLE = (geom.arch ? 65 : 40) * layoutSc;   // arched: third title line

  const ox = MGN_LEFT_DIM, oy = MGN_TOP_DIM;
  const totalW = ox + geom.leafW + MGN_RIGHT_DIM;
  const totalH = oy + geom.leafH + MGN_BOT_DIM + MGN_TITLE;
  const ts = totalW / VIEWBOX_REF;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  // Arched leaf: the straight bars come from the engine list (glass frame → leaf coords)
  const arch = geom.arch;
  const vBarsDim = arch ? arch.vList : geom.vBars;
  const hBarsDim = arch ? arch.hList : geom.hBars;

  const hCuts = geom.hBars.map((hb) => [hb.top, hb.bot]);
  const verticalEdgeSegments = computeSegments(geom.glassY, geom.glassY + geom.glassH, hCuts);
  const vCuts = geom.vBars.map((vb) => [vb.left, vb.right]);
  const horizontalEdgeSegments = computeSegments(geom.glassX, geom.glassX + geom.glassW, vCuts);

  // ── Arched paths (sheet coords) ──
  let AP = null;
  if (arch) {
    const txL = archToSheet(arch.fw, arch.rise, ox - arch.rect.x, oy - arch.rect.y);
    const txG = glassToSheet(X(geom.unitX), Y(geom.unitY), arch.outline.height);
    const clipId = `clip-cas-leaf-${String(windowSpec?.id || windowSpec?.name || 'w').replace(/[^a-zA-Z0-9]/g, '_')}`;
    AP = {
      outerD: archedOutlineD(arch.leafOuter, txL, Y(geom.leafH)),
      daylightD: archedOutlineD(arch.leafInner, txL, Y(geom.glassY + geom.glassH)),
      unitD: archedOutlineD(arch.outline.arcs, txG, Y(geom.unitY + arch.outline.height)),
      topRailZoneD: ringBandD(arch.leafOuter, arch.leafInner, txL),
      barsD: arch.bars.map((b) => barBandD(b, txG, BAR_WIDTH / 2)),
      clipId,
      // haunch / gothic arcs: label outside near the corner; crown / semi-circle: inside the daylight
      radii: arch.leafOuter.map((a, k) => ({ r: a.r, at: isHaunchArc(a) ? arcLabelPoint(a, txL, sw(10)) : arcLabelPoint(arch.leafInner[k], txL, -sw(16)) })),
      springY: Y(arch.springingY),
      topY: arch.springingY,
    };
  }
  const annFs = tfs(SIZES.dimSmall, totalW);
  const topY = AP ? AP.topY : 0;

  const roleName = casementRoleName(geom.role, geom.bounds);
  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const hingeTxt = geom.hinge === 'fixed' ? 'fixed (dummy sash)' : `hinge ${geom.hinge}`;
  const titleText = `${paneTitle(group)} — Front${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = `${fmt(geom.leafW)} × ${fmt(geom.leafH)} · glass ${fmt(geom.glassUnitW)} × ${fmt(geom.glassUnitH)} · 24mm · ${hingeTxt}`;
  const archLine = arch ? `${arch.AG.label} · stile ${fmt(arch.straightStile)} · rise ${fmt(geom.leafH - arch.straightStile)} · top rail ${radiiText(arch.leafOuter)} · C-ATR ${fmt(arch.railLength)}` : '';
  const titleY = oy + geom.leafH + MGN_BOT_DIM + MGN_TITLE * 0.4;

  // Top dim chain: stile · (bars) · stile
  const topCuts = [0, geom.stile];
  vBarsDim.forEach((vb) => { topCuts.push(vb.left); topCuts.push(vb.right); });
  topCuts.push(geom.leafW - geom.stile);
  topCuts.push(geom.leafW);
  const topDimY = oy - 24 * ts;
  const topExtLineEnd = oy - 4 * ts;

  // Left dim chain
  const leftCuts = [0, geom.stile];
  hBarsDim.forEach((hb) => { leftCuts.push(hb.top); leftCuts.push(hb.bot); });
  leftCuts.push(geom.leafH - geom.stile);
  leftCuts.push(geom.leafH);
  const leftDimX = ox - 24 * ts;
  const leftExtLineEnd = ox - 4 * ts;

  const topLabels = Array(topCuts.length - 1).fill(undefined);
  topLabels[0] = fmt(geom.stile);
  topLabels[topLabels.length - 1] = fmt(geom.stile);
  if (topLabels.length === 3) topLabels[1] = fmt(geom.leafW - 2 * geom.stile);
  const leftLabels = Array(leftCuts.length - 1).fill(undefined);
  leftLabels[0] = fmt(geom.stile);
  leftLabels[leftLabels.length - 1] = fmt(geom.stile);
  if (leftLabels.length === 3) leftLabels[1] = fmt(geom.leafH - 2 * geom.stile);

  return (
    <div className="w-full relative">
      <div className="absolute top-2 right-2 z-10 text-[10px] text-ink-400 bg-surface-700/80 px-2 py-1 rounded cursor-pointer hover:text-accent-400"
        onClick={handleExpand}>
        {isExternalExpand ? '⊕ Expand' : (expanded ? '⊖ Collapse' : '⊕ Expand')}
      </div>

      <div onClick={isExternalExpand ? handleExpand : () => setExpanded(!expanded)} className="cursor-pointer"
        style={{ maxHeight: (expanded && !isExternalExpand) ? 'none' : '65vh', overflow: 'auto' }}>
        <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto" style={{ background: COLORS.bg }}
          data-arch-origin={AP ? `${ox},${oy}` : undefined}>

          {AP ? (
            <>
              {/* Outer leaf — straight stiles + C-ARCH TOP RAIL outer chain */}
              <path d={AP.outerD} fill={C.bgFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
              {/* 24mm unit edge = the glazier's outline (derived.arch.glassOutline) */}
              <path d={AP.unitD} fill="none" stroke={C.rebate} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.5}
                strokeDasharray={`${sw(4)},${sw(3)}`} />
              {/* Glass daylight = leaf top rail inner chain */}
              <path d={AP.daylightD} fill={C.glassFill} fillOpacity={0.06}
                stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
              <clipPath id={AP.clipId}><path d={AP.daylightD} /></clipPath>
            </>
          ) : (
            <>
          {/* Outer leaf */}
          <rect x={X(0)} y={Y(0)} width={geom.leafW} height={geom.leafH}
            fill={C.bgFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />

          {/* 24mm unit edge (inside the rebate) */}
          <rect x={X(geom.unitX)} y={Y(geom.unitY)} width={geom.unitW} height={geom.unitH}
            fill="none" stroke={C.rebate} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.5}
            strokeDasharray={`${sw(4)},${sw(3)}`} />

          {/* Glass daylight */}
          <rect x={X(geom.glassX)} y={Y(geom.glassY)} width={geom.glassW} height={geom.glassH}
            fill={C.glassFill} fillOpacity={0.06}
            stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
            </>
          )}

          {/* Opening symbol */}
          {geom.hinge === 'left' && (
            <path d={`M ${X(geom.leafW)} ${Y(topY)} L ${X(0)} ${Y(geom.leafH / 2)} L ${X(geom.leafW)} ${Y(geom.leafH)}`}
              fill="none" stroke={C.meeting} strokeWidth={STROKES.meeting} {...NS}
              strokeDasharray={`${sw(6)},${sw(4)}`} />
          )}
          {geom.hinge === 'right' && (
            <path d={`M ${X(0)} ${Y(topY)} L ${X(geom.leafW)} ${Y(geom.leafH / 2)} L ${X(0)} ${Y(geom.leafH)}`}
              fill="none" stroke={C.meeting} strokeWidth={STROKES.meeting} {...NS}
              strokeDasharray={`${sw(6)},${sw(4)}`} />
          )}

          {/* Arched: engine bars as 22 mm bands clipped to the daylight; crosses + notches for the straight bars */}
          {AP && (
            <g>
              <g clipPath={`url(#${AP.clipId})`}>
                {AP.barsD.map((d, k) => (
                  <path key={`ab-${k}`} d={d} fill="none" stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                ))}
              </g>
              {arch.vList.flatMap((vb, vi) =>
                arch.hList.map((hb, hi) => (
                  <g key={`across-${vi}-${hi}`}>
                    <line x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
                      stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                    <line x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                      stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                  </g>
                ))
              )}
              {arch.vList.map((vb, i) => (
                <g key={`avn-${i}`}>
                  <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.left)} y2={Y(geom.glassY + geom.glassH)}
                    stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
                  <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.right)} y2={Y(geom.glassY + geom.glassH)}
                    stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
                </g>
              ))}
              {arch.hList.map((hb, j) => (
                <g key={`ahn-${j}`}>
                  <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.top)}
                    stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
                  <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.bot)}
                    stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
                  <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.top)}
                    stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
                  <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.bot)}
                    stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
                </g>
              ))}
              {/* springing line, stile / rise dims, top rail radii */}
              <line x1={X(0) - sw(10)} y1={AP.springY} x2={X(geom.leafW) + sw(10)} y2={AP.springY}
                stroke={C.meeting} strokeWidth={STROKES.center} {...NS}
                strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
              <DimV x={ox + geom.leafW + 40 * ts} y1={AP.springY} y2={Y(geom.leafH)} extFrom={X(geom.leafW)}
                label={`stile ${fmt(arch.straightStile)}`} small vbw={totalW} />
              <DimV x={ox + geom.leafW + 40 * ts} y1={Y(0)} y2={AP.springY} extFrom={X(geom.leafW)}
                label={`rise ${fmt(geom.leafH - arch.straightStile)}`} small vbw={totalW} />
              {AP.radii.map((rl, k) => (
                <text key={`r-${k}`} x={rl.at[0]} y={rl.at[1]} fill={COLORS.dim} fontSize={annFs}
                  fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.dim}>{`R ${fmt(rl.r)}`}</text>
              ))}
            </g>
          )}
          {geom.hinge === 'top' && (
            <path d={`M ${X(0)} ${Y(geom.leafH)} L ${X(geom.leafW / 2)} ${Y(0)} L ${X(geom.leafW)} ${Y(geom.leafH)}`}
              fill="none" stroke={C.meeting} strokeWidth={STROKES.meeting} {...NS}
              strokeDasharray={`${sw(6)},${sw(4)}`} />
          )}

          {/* Vertical bars (edges segmented at crossings) */}
          {geom.vBars.map((vb, i) => (
            <g key={`vb-${i}`}>
              {verticalEdgeSegments.map((seg, j) => (
                <g key={`vb-${i}-s-${j}`}>
                  <line x1={X(vb.left)} y1={Y(seg.a)} x2={X(vb.left)} y2={Y(seg.b)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                  <line x1={X(vb.right)} y1={Y(seg.a)} x2={X(vb.right)} y2={Y(seg.b)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                </g>
              ))}
            </g>
          ))}

          {/* Horizontal bars */}
          {geom.hBars.map((hb, j) => (
            <g key={`hb-${j}`}>
              {horizontalEdgeSegments.map((seg, i) => (
                <g key={`hb-${j}-s-${i}`}>
                  <line x1={X(seg.a)} y1={Y(hb.top)} x2={X(seg.b)} y2={Y(hb.top)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                  <line x1={X(seg.a)} y1={Y(hb.bot)} x2={X(seg.b)} y2={Y(hb.bot)}
                    stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                </g>
              ))}
            </g>
          ))}

          {/* Crosses at bar intersections */}
          {geom.vBars.flatMap((vb, vi) =>
            geom.hBars.map((hb, hi) => (
              <g key={`cross-${vi}-${hi}`}>
                <line x1={X(vb.left)} y1={Y(hb.top)} x2={X(vb.right)} y2={Y(hb.bot)}
                  stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
                <line x1={X(vb.right)} y1={Y(hb.top)} x2={X(vb.left)} y2={Y(hb.bot)}
                  stroke={C.outer} strokeWidth={STROKES.bar} {...NS} />
              </g>
            ))
          )}

          {/* V-notches — vertical bars */}
          {geom.vBars.map((vb, i) => (
            <g key={`vn-${i}`}>
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.left)} y2={Y(geom.glassY)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY - 4)} x2={X(vb.right)} y2={Y(geom.glassY)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.left)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(vb.cx)} y1={Y(geom.glassY + geom.glassH + 4)} x2={X(vb.right)} y2={Y(geom.glassY + geom.glassH)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
            </g>
          ))}

          {/* V-notches — horizontal bars */}
          {geom.hBars.map((hb, j) => (
            <g key={`hn-${j}`}>
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.top)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(geom.glassX - 4)} y1={Y(hb.cy)} x2={X(geom.glassX)} y2={Y(hb.bot)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.top)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
              <line x1={X(geom.glassX + geom.glassW + 4)} y1={Y(hb.cy)} x2={X(geom.glassX + geom.glassW)} y2={Y(hb.bot)}
                stroke={C.notch} strokeWidth={STROKES.notch} {...NS} strokeOpacity={0.8} />
            </g>
          ))}

          {/* Selection overlays — invisible click zones + highlight (sash pattern) */}
          {clickable && (() => {
            const zones = [
              { key: 'leafStile', x: X(0), y: Y(topY), w: geom.stile, h: geom.leafH - topY },
              { key: 'leafStile', x: X(geom.leafW - geom.stile), y: Y(topY), w: geom.stile, h: geom.leafH - topY },
              AP ? { key: 'leafTopRail', d: AP.topRailZoneD }
                 : { key: 'leafTopRail', x: X(geom.stile), y: Y(0), w: geom.leafW - 2 * geom.stile, h: geom.stile },
              { key: 'leafBottomRail', x: X(geom.stile), y: Y(geom.leafH - geom.stile), w: geom.leafW - 2 * geom.stile, h: geom.stile },
            ];
            return (
              <g>
                {zones.map((z, i) => z.d ? (
                  <path key={i} d={z.d}
                    fill={hl(z.key) ? COLORS.highlightFill : 'transparent'}
                    stroke={hl(z.key) ? COLORS.highlight : 'none'} strokeWidth={STROKES.outer} {...NS}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onElementClick(z.key); }} />
                ) : (
                  <rect key={i} x={z.x} y={z.y} width={z.w} height={z.h}
                    fill={hl(z.key) ? COLORS.highlightFill : 'transparent'}
                    stroke={hl(z.key) ? COLORS.highlight : 'none'} strokeWidth={STROKES.outer} {...NS}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onElementClick(z.key); }} />
                ))}
              </g>
            );
          })()}

          {/* ── DIM CHAINS ── */}
          <DimChainH y={topDimY} cuts={topCuts.map(X)} extFrom={topExtLineEnd}
            vbw={totalW} labels={topLabels} fmt={(n) => fmt(n)} />
          <DimChainV x={leftDimX} cuts={leftCuts.map(Y)} extFrom={leftExtLineEnd}
            vbw={totalW} labels={leftLabels} fmt={(n) => fmt(n)} />

          {/* ── OVERALL ── */}
          <DimV x={ox + geom.leafW + (AP ? 80 : 40) * ts} y1={Y(0)} y2={Y(geom.leafH)}
            extFrom={X(geom.leafW)} label={fmt(geom.leafH)} vbw={totalW} />
          <DimH y={oy + geom.leafH + 34 * ts} x1={X(0)} x2={X(geom.leafW)}
            extFrom={Y(geom.leafH)} label={fmt(geom.leafW)} vbw={totalW} />

          {/* ── TITLE ── */}
          <TitleBlock x={totalW / 2} y={titleY}
            title={titleText} subtitle={subtitleText} vbw={totalW} />
          {arch && (
            <text x={totalW / 2} y={titleY + 40 * ts} fill={COLORS.subtitle} fontSize={SIZES.subtitle * ts}
              fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{archLine}</text>
          )}
        </svg>
      </div>
    </div>
  );
}
