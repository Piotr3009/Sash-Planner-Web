/**
 * CasementFrameDetail2D.jsx
 *
 * Frame-only drawing (no leaves) — BoxDetail2D analogue for casement:
 * outer frame, rebate/land opening, cill face, mullions and transoms with
 * their axes, member dimension chains (gaps not dimensioned) and element
 * letter codes with cut lengths + finished sections. Same drawing system
 * as sash: mm coordinates, dark theme, drawingUtils dims.
 *
 * Arched casement (arched-casement-v2 night 4, spec §4 D): the head is the
 * C-ARCH HEAD band drawn from derived.arch.geometry (the SAME ArcChain the
 * arch CNC DXF routes), the jambs stop at the springing line, dims add
 * start (from the cill), rise and every head radius. Rectangular windows
 * take the branch below unchanged (byte-identical, verify/arch/t19.mjs).
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { offsetArcs } from '../../engine/arch.js';
import { DimChainH, DimChainV, DimH, DimV, TitleBlock, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { archToSheet, archedOutlineD, ringBandD, arcLabelPoint, radiiText } from './archDrawUtils.js';

const NS = { vectorEffect: 'non-scaling-stroke' };

function fmt(n) {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function CasementFrameDetail2D({ windowSpec, derived, projectNumber, selectedElement, onElementClick }) {
  const clickable = typeof onElementClick === 'function';
  const hl = (key) => clickable && selectedElement === key;
  const geom = useMemo(() => {
    const cas = derived?.casement;
    if (!windowSpec || !cas) return null;
    const fw = Number(windowSpec.frame?.width ?? 0);
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fw || !fh) return null;
    const p = getCasementProfile();
    // ── Arched casement: head chains + cut lengths from derived.arch / the cut list ──
    let arch = null;
    const A = derived.arch;
    if (A?.geometry) {
      const AG = A.geometry;
      const headRec = (derived.components?.box || []).find((r) => r.elementName === 'C-ARCH HEAD');
      const jambRec = (derived.components?.box || []).find((r) => r.elementName === 'C-FRAME JAMB (L)');
      arch = {
        AG, rise: AG.rise, start: AG.start,
        outer: AG.arcs,
        land: offsetArcs(AG.arcs, p.geometry.land),
        headLength: headRec ? headRec.length : AG.frameHead.lengths.centre,
        headNotes: headRec?.notes || '',
        jambLength: jambRec ? jambRec.length : AG.start,
      };
    }
    return {
      fw, fh, g: p.geometry, p, arch,
      cill: cas.cill || { wider: false, extension: 0, length: fw },
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
  const TITLE_AREA = (geom.arch ? 75 : 50) * layoutSc;   // arched: third title line
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
  // Arched: 0 · rise (arch zone) · fh−41 · fh — the head band is curved, its
  // face is dimensioned by the radii and the C-AH length instead.
  const arch = geom.arch;
  const vCuts = arch ? [0, arch.rise] : [0, g.land];
  if (!arch) [...geom.transoms].sort((a, b) => a.axisT - b.axisT).forEach((tr) => {
    vCuts.push(tr.bandTop, tr.bandBottom);
  });
  vCuts.push(fh - g.cillVisible, fh);

  // ── Arched paths (sheet coords) ──
  let AP = null;
  if (arch) {
    const txF = archToSheet(fw, arch.rise, ox, oy);
    AP = {
      outerD: archedOutlineD(arch.outer, txF, Y(fh)),
      landD: archedOutlineD(arch.land, txF, Y(fh - g.cillVisible)),
      headZoneD: ringBandD(arch.outer, arch.land, txF),
      radii: arch.outer.map((a) => ({ r: a.r, at: arcLabelPoint(a, txF, sw(14)) })),
      springY: Y(arch.rise),
      // C-AH label on the head band centre line at the apex
      headLabelY: Y(g.land / 2) + annFs * 0.35,
      jambLabelY: Y((arch.rise + fh - g.cillVisible) / 2),
    };
  }

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';
  const titleText = `Frame Detail${projNum ? ` — ${projNum}` : ''} — ${winName}`;
  const subtitleText = arch
    ? `C-AH ${fmt(arch.headLength)} · C-CILL ${fmt(geom.cill.length)}${geom.cill.wider ? ' (wider)' : ''}${geom.cill.extension > 0 ? ` · proj ${geom.cill.extension}mm` : ''} · C-J ×2 ${fmt(arch.jambLength)}`
    : `C-H ${fmt(fw)} · C-CILL ${fmt(geom.cill.length)}${geom.cill.wider ? ' (wider)' : ''}${geom.cill.extension > 0 ? ` · proj ${geom.cill.extension}mm` : ''} · C-J ×2 ${fmt(fh)}`;
  const archLine = arch ? `${arch.AG.label} · start ${fmt(arch.start)} · rise ${fmt(arch.rise)} · ${radiiText(arch.outer)}${arch.headNotes ? ` · ${arch.headNotes}` : ''}` : '';
  const titleY = oy + fh + DM + TITLE_AREA * 0.5;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}
        data-arch-origin={AP ? `${ox},${oy}` : undefined}>

        {/* ── FRAME band + cill face ── */}
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
        <line x1={X(0)} y1={Y(fh - g.cillVisible)} x2={X(fw)} y2={Y(fh - g.cillVisible)}
          stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
        {geom.cill.wider && (
          <path d={`M ${X(-50)} ${Y(fh - g.cillVisible)} H ${X(fw + 50)} V ${Y(fh)} H ${X(-50)} Z`}
            fill={COLORS.frameFill} stroke={COLORS.frame} strokeWidth={STROKES.frameLight} {...NS} />
        )}

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
        <text x={X(fw / 2)} y={AP ? AP.headLabelY : Y(g.land / 2) + annFs * 0.35} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{AP ? `C-AH ${fmt(arch.headLength)}` : `C-H ${fmt(fw)}`}</text>
        <text x={X(fw / 2)} y={Y(fh - g.cillVisible / 2) + annFs * 0.35} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{`C-CILL ${fmt(geom.cill.length)}${geom.cill.extension > 0 ? ` · proj ${geom.cill.extension}mm` : ''}`}</text>
        <text x={X(g.land / 2)} y={AP ? AP.jambLabelY : Y(fh / 2)} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${X(g.land / 2)}, ${AP ? AP.jambLabelY : Y(fh / 2)})`}>
          {`C-J/L ${fmt(AP ? arch.jambLength : fh)}`}
        </text>
        <text x={X(fw - g.land / 2)} y={AP ? AP.jambLabelY : Y(fh / 2)} fill={COLORS.label} fontSize={annFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${X(fw - g.land / 2)}, ${AP ? AP.jambLabelY : Y(fh / 2)})`}>
          {`C-J/R ${fmt(AP ? arch.jambLength : fh)}`}
        </text>

        {/* ── ARCH: springing line, start / rise dims, radii ── */}
        {AP && (
          <g>
            <line x1={X(0) - sw(12)} y1={AP.springY} x2={X(fw) + sw(12)} y2={AP.springY}
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

        {/* ── MEMBER CHAINS (arched: no top chain — the head is curved) ── */}
        {!AP && (
        <DimChainH y={oy - 24 * ts} cuts={hCuts.map(X)} extFrom={oy - 4 * ts}
          vbw={totalW} fmt={(n) => fmt(n)} />
        )}
        <DimChainV x={ox + fw + 26 * ts} cuts={vCuts.map(Y)} extFrom={ox + fw + 4 * ts}
          vbw={totalW} fmt={(n) => fmt(n)} />

        {/* ── OVERALL ── */}
        <DimH y={oy + fh + DM * 0.85} x1={X(0)} x2={X(fw)} extFrom={Y(fh)}
          label={fmt(fw)} vbw={totalW} />
        <DimV x={ox + fw + DM * 1.15} y1={Y(0)} y2={Y(fh)} extFrom={X(fw)}
          label={fmt(fh)} vbw={totalW} />

        {/* Selection overlays — invisible click zones + highlight (sash pattern) */}
        {clickable && (() => {
          const jambTop = AP ? arch.rise : g.land;
          const zones = [
            AP ? { key: 'head', d: AP.headZoneD } : { key: 'head', x: X(0), y: Y(0), w: fw, h: g.land },
            { key: 'frameJamb', x: X(0), y: Y(jambTop), w: g.land, h: fh - jambTop - g.cillVisible },
            { key: 'frameJamb', x: X(fw - g.land), y: Y(jambTop), w: g.land, h: fh - jambTop - g.cillVisible },
            { key: 'cill', x: X(0), y: Y(fh - g.cillVisible), w: fw, h: g.cillVisible },
            ...geom.mullions.map((mu) => ({
              key: 'mullion', x: X(mu.x1), y: Y(mu.full ? g.land : mu.yTop),
              w: mu.x2 - mu.x1,
              h: (mu.full ? fh - g.cillVisible : mu.yBottom) - (mu.full ? g.land : mu.yTop),
            })),
            ...geom.transoms.map((tr) => ({
              key: 'transom', x: X(tr.x1), y: Y(tr.bandTop),
              w: tr.x2 - tr.x1, h: tr.bandBottom - tr.bandTop,
            })),
          ];
          return (
            <g>
              {zones.map((z, i) => z.d ? (
                <path key={i} d={z.d}
                  fill={hl(z.key) ? COLORS.highlightFill : 'transparent'}
                  stroke={hl(z.key) ? COLORS.highlight : 'none'} strokeWidth={STROKES.sash} {...NS}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onElementClick(z.key); }} />
              ) : (
                <rect key={i} x={z.x} y={z.y} width={z.w} height={z.h}
                  fill={hl(z.key) ? COLORS.highlightFill : 'transparent'}
                  stroke={hl(z.key) ? COLORS.highlight : 'none'} strokeWidth={STROKES.sash} {...NS}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onElementClick(z.key); }} />
              ))}
            </g>
          );
        })()}

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
