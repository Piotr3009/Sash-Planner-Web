/**
 * CasementElevation2D.jsx
 *
 * Composite exterior view of a casement window — same drawing system as the
 * sash FrontElevation2D: mm coordinates, dark theme, non-scaling strokes,
 * DimH/DimV + TitleBlock from drawingUtils. Geometry comes exclusively from
 * derived.casement (engine single source) + the casement profile:
 * layers 36 · 4 · LEAF · 6 · [8|axis|13] · 4 · LEAF · 6 · 41.
 *
 * Arched casement (arched-casement-v2 night 4, spec §4 D): when derived.arch
 * exists the head, the leaf top and the daylight are drawn from the SAME
 * ArcChains the engine and the DXF exports use (derived.arch.geometry rings,
 * derived.arch.glassOutline, derived.arch.bars) as SVG `A` arcs — never a
 * Bezier, never re-derived here. Bars are 22 mm bands on the engine axes,
 * clipped to the daylight. Rectangular windows take the branch below
 * unchanged (byte-identical output, verify/arch/t19.mjs snapshot).
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { offsetArcs } from '../../engine/arch.js';
import { computeBarPositions, DimH, DimV, TitleBlock, Label, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, DIMS, VIEWBOX_REF } from './drawingTheme.js';
import { casementBarCounts } from './casementDrawUtils.js';
import { archToSheet, glassToSheet, archedOutlineD, barBandD, arcLabelPoint, radiiText } from './archDrawUtils.js';
import CircleFixedDrawing2D from './CircleFixedDrawing2D.jsx';

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
      return { r, hinge: pn.hinge, glassX, glassY, glassW, glassH, barPos, i, topY: r.y };
    });

    // ── Arched casement: chains from derived.arch (engine single source) ──
    let arch = null;
    const A = derived.arch;
    if (A?.geometry && A.glassOutline && leaves.length === 1) {
      const AG = A.geometry;
      const lf = leaves[0];
      lf.topY = AG.rise;                     // opening symbol starts on the springing line
      arch = {
        AG,
        rise: AG.rise,
        start: AG.start,
        outer: AG.arcs,                      // frame outer contour
        land: offsetArcs(AG.arcs, g.land),   // exterior land line (36 in from the outer)
        leafOuter: AG.leafTop.outer,         // leaf top rail outer (leafAtJamb)
        daylight: AG.leafTop.inner,          // leaf top rail inner (daylight)
        outline: A.glassOutline,             // glass unit (glass frame) + origin in frame coords
        bars: A.bars || [],
      };
    }

    return {
      fw, fh, g, stile, leaves, arch,
      mullions: cas.mullionRuns || [],
      transoms: cas.transomRuns || [],
      cill: cas.cill || { wider: false, extension: 0, length: fw },
    };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;
  // v3 Block 3: a circle fixed window has no straight member — its own sheet (after the hooks above)
  if (derived?.arch?.shape === 'circle') return <CircleFixedDrawing2D windowSpec={windowSpec} derived={derived} projectNumber={projectNumber} view="elevation" />;

  const { fw, fh, g } = geom;

  // ─── Layout (mm = SVG units, same convention as sash drawings) ───
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 60 * layoutSc;
  const M = 70 * layoutSc;
  const TITLE_AREA = (geom.arch ? 75 : 50) * layoutSc;   // arched: third title line (shape · start · rise · radii)
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

  // ── Arched paths (sheet coords): frame outer / land, leaf outer / daylight, bars ──
  const arch = geom.arch;
  let AP = null;
  if (arch) {
    const lf = geom.leaves[0];
    const txF = archToSheet(fw, arch.rise, ox, oy);
    const txG = glassToSheet(X(arch.outline.origin.x), Y(fh - arch.outline.origin.y - arch.outline.height), arch.outline.height);
    const clipId = `clip-cas-elev-${String(windowSpec?.id || windowSpec?.name || 'w').replace(/[^a-zA-Z0-9]/g, '_')}`;
    AP = {
      txF,
      outerD: archedOutlineD(arch.outer, txF, Y(fh)),
      landD: archedOutlineD(arch.land, txF, Y(fh - g.cillVisible)),
      leafD: archedOutlineD(arch.leafOuter, txF, Y(lf.r.y + lf.r.h)),
      daylightD: archedOutlineD(arch.daylight, txF, Y(lf.r.y + lf.r.h - geom.stile)),
      barsD: arch.bars.map((b) => barBandD(b, txG, BAR_WIDTH / 2)),
      clipId,
      radii: arch.outer.map((a) => ({ r: a.r, at: arcLabelPoint(a, txF, sw(14)) })),
      springY: Y(arch.rise),
    };
  }
  const annFs = tfs(SIZES.dimSmall, totalW);

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `Front Elevation${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = arch
    ? `Casement · arched · ${fw} × ${fh} mm · exterior view`
    : `Casement ${derived.casement.layout} · ${fw} × ${fh} mm · exterior view`;
  const archLine = arch ? `${arch.AG.label} · start ${fmt(arch.start)} · rise ${fmt(arch.rise)} · ${radiiText(arch.outer)}` : '';
  const titleY = oy + fh + DM + TITLE_AREA * 0.5;
  const ts = totalW / VIEWBOX_REF;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}
        data-arch-origin={AP ? `${ox},${oy}` : undefined}>

        {/* ── FRAME band (outer − rebate opening) + cill face ── */}
        {AP ? (
          <>
            <path d={`${AP.outerD} ${AP.landD}`} fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
            <path d={AP.outerD} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
            <path d={AP.landD} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
          </>
        ) : (
          <>
        <path
          d={`M ${X(0)} ${Y(0)} H ${X(fw)} V ${Y(fh)} H ${X(0)} Z
              M ${landRect.x} ${landRect.y} H ${landRect.x + landRect.w}
              V ${landRect.y + landRect.h} H ${landRect.x} Z`}
          fillRule="evenodd" fill={COLORS.frameFill} stroke="none" />
        <rect x={X(0)} y={Y(0)} width={fw} height={fh}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frame} {...NS} />
        <rect x={landRect.x} y={landRect.y} width={landRect.w} height={landRect.h}
          fill="none" stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
          </>
        )}
        {/* Cill face — overhangs ±50 beyond the frame when 'wider' */}
        <line x1={X(0)} y1={Y(fh - g.cillVisible)} x2={X(fw)} y2={Y(fh - g.cillVisible)}
          stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        {geom.cill.wider && (
          <path d={`M ${X(-50)} ${Y(fh - g.cillVisible)} H ${X(fw + 50)} V ${Y(fh)} H ${X(-50)} Z`}
            fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
        )}

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
            {AP ? (
              <>
                <path d={AP.leafD} fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
                <path d={AP.daylightD} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
                  stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS} />
                <clipPath id={AP.clipId}><path d={AP.daylightD} /></clipPath>
                <g clipPath={`url(#${AP.clipId})`}>
                  {AP.barsD.map((d, k) => (
                    <path key={`ab-${k}`} d={d} fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
                  ))}
                </g>
              </>
            ) : (
              <>
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
              </>
            )}
            {lf.hinge === 'left' && (
              <path d={`M ${X(lf.r.x + lf.r.w)} ${Y(lf.topY)} L ${X(lf.r.x)} ${Y(lf.r.y + lf.r.h / 2)} L ${X(lf.r.x + lf.r.w)} ${Y(lf.r.y + lf.r.h)}`}
                fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS}
                strokeDasharray={`${sw(6)},${sw(4)}`} />
            )}
            {lf.hinge === 'right' && (
              <path d={`M ${X(lf.r.x)} ${Y(lf.topY)} L ${X(lf.r.x + lf.r.w)} ${Y(lf.r.y + lf.r.h / 2)} L ${X(lf.r.x)} ${Y(lf.r.y + lf.r.h)}`}
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

        {/* ── ARCH: springing line, start / rise dims, radii + centres ── */}
        {AP && (
          <g>
            <line x1={X(0) - sw(10)} y1={AP.springY} x2={X(fw) + sw(10)} y2={AP.springY}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
              strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
            <DimV x={ox - DM * 0.45} y1={AP.springY} y2={Y(fh)} extFrom={X(0)}
              label={`start ${fmt(arch.start)}`} small vbw={totalW} />
            <DimV x={ox - DM * 0.45} y1={Y(0)} y2={AP.springY} extFrom={X(0)}
              label={`rise ${fmt(arch.rise)}`} small vbw={totalW} />
            {AP.radii.map((rl, k) => (
              <text key={`r-${k}`} x={rl.at[0]} y={rl.at[1]} fill={COLORS.dim} fontSize={annFs}
                fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.dim}>{`R ${fmt(rl.r)}`}</text>
            ))}
          </g>
        )}

        {/* ── OVERALL DIMS ── */}
        <DimH y={oy + fh + DM * 0.8} x1={X(0)} x2={X(fw)} extFrom={Y(fh)}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 0.8} y1={Y(0)} y2={Y(fh)} extFrom={X(fw)}
          label={fmt(fh)} vbw={totalW} />

        {/* ── TITLE ── */}
        <TitleBlock x={totalW / 2} y={titleY}
          title={titleText} subtitle={subtitleText} vbw={totalW} />
        {arch && (
          <text x={totalW / 2} y={titleY + 40 * ts} fill={COLORS.subtitle} fontSize={SIZES.subtitle * ts}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{archLine}</text>
        )}
      </svg>
    </div>
  );
}
