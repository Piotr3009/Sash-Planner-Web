/**
 * BoxDetail2D.jsx
 */
import { useMemo, useState } from 'react';
import { FONT, DimH, DimV, DimChainH, DimChainV, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
// Arched sash (v3 Block 1 H): the box head is the engine's ring (derived.arch.geometry.head), jambs stop at the springing
import { archToSheet, ringBandD, arcLabelPoint, radiiText } from './archDrawUtils.js';

const NS = { vectorEffect: 'non-scaling-stroke' };

const BOX = {
  jambW_bottom: 86, jambW_top: 102, headH: 102,
  sillNose: 33, sillWeatherbar: 46.5, sillDrip: 58,
  sillTop: 68, sillCurveTop: 94, bulge: 0.292123,
};

const COL = {
  frame: COLORS.frame, frameFill: COLORS.frameFill, sillDetail: COLORS.sillDetail,
  dim: COLORS.dim, label: COLORS.label, cavity: COLORS.label, title: COLORS.title,
};

function bulgeArc(x1, y1, x2, y2, bulge) {
  if (Math.abs(bulge) < 1e-6) return `L ${x2} ${y2}`;
  const dx = x2 - x1, dy = y2 - y1;
  const chord = Math.sqrt(dx * dx + dy * dy);
  const sagitta = Math.abs(bulge) * chord / 2;
  const r = ((chord / 2) ** 2 + sagitta ** 2) / (2 * sagitta);
  const la = Math.abs(bulge) > 1 ? 1 : 0;
  const sw = bulge > 0 ? 0 : 1;
  return `A ${r} ${r} 0 ${la} ${sw} ${x2} ${y2}`;
}

export default function BoxDetail2D({ windowSpec, derived, onExpand, projectNumber, view = 'external', selectedElement, onElementClick }) {
  const isInternal = view === 'internal';
  const jambKey = isInternal ? 'intJambLiner' : 'extJambLiner';
  const headKey = isInternal ? 'intHeadLiner' : 'extHeadLiner';
  const linerPrefix = isInternal ? 'INT.' : 'EXT.';
  const clickable = typeof onElementClick === 'function';
  const hl = (key) => clickable && selectedElement === key;
  const [expanded, setExpanded] = useState(false);
  const isExternalExpand = !!onExpand;
  const handleExpand = (e) => {
    e.stopPropagation();
    if (isExternalExpand) { onExpand(); } else { setExpanded(!expanded); }
  };

  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const innerW = fw - 2 * BOX.jambW_top;
    const A = derived.arch && !derived.casement ? derived.arch : null;
    return { fw, fh, innerW, A };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh, A } = d;
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 60 * layoutSc;
  const M = 80 * layoutSc;
  const totalW = fw + M * 2 + DM * 3;
  const totalH = fh + M * 2 + DM * 3;

  const ox = M + DM * 2;
  const oy = M + DM;
  const X = (x) => ox + x;
  const Y = (y) => oy + (fh - y);

  // External: jamb narrows at the sill nose via an arc (real external profile).
  // Internal: staff-bead face — liners run straight full height, no arc; the
  // sill is a plain band between the liners with one straight top line.
  const jt = A ? A.geometry.start : fh;                 // arched: jambs stop at the springing
  const rJamb = isInternal
    ? `M ${X(fw - BOX.jambW_top)} ${Y(0)} L ${X(fw - BOX.jambW_top)} ${Y(jt)} L ${X(fw)} ${Y(jt)} L ${X(fw)} ${Y(0)} Z`
    : [
        `M ${X(fw - BOX.jambW_bottom)} ${Y(0)}`,
        `L ${X(fw - BOX.jambW_bottom)} ${Y(BOX.sillTop)}`,
        bulgeArc(X(fw - BOX.jambW_bottom), Y(BOX.sillTop), X(fw - BOX.jambW_top), Y(BOX.sillCurveTop), BOX.bulge),
        `L ${X(fw - BOX.jambW_top)} ${Y(jt)}`,
        `L ${X(fw)} ${Y(jt)}`, `L ${X(fw)} ${Y(0)}`, 'Z',
      ].join(' ');

  const lJamb = isInternal
    ? `M ${X(BOX.jambW_top)} ${Y(0)} L ${X(BOX.jambW_top)} ${Y(jt)} L ${X(0)} ${Y(jt)} L ${X(0)} ${Y(0)} Z`
    : [
        `M ${X(BOX.jambW_bottom)} ${Y(0)}`,
        `L ${X(BOX.jambW_bottom)} ${Y(BOX.sillTop)}`,
        bulgeArc(X(BOX.jambW_bottom), Y(BOX.sillTop), X(BOX.jambW_top), Y(BOX.sillCurveTop), -BOX.bulge),
        `L ${X(BOX.jambW_top)} ${Y(jt)}`,
        `L ${X(0)} ${Y(jt)}`, `L ${X(0)} ${Y(0)}`, 'Z',
      ].join(' ');

  // arched: the head is the engine's ring (outer contour → headFace inner), serialised from the ArcChains
  const txA = A ? archToSheet(fw, A.geometry.rise, ox, oy) : null;
  const head = A
    ? ringBandD(A.geometry.head.outer, A.geometry.head.inner, txA)
    : `M ${X(BOX.jambW_top)} ${Y(fh)} L ${X(fw - BOX.jambW_top)} ${Y(fh)} L ${X(fw - BOX.jambW_top)} ${Y(fh - BOX.headH)} L ${X(BOX.jambW_top)} ${Y(fh - BOX.headH)} Z`;
  const archRadii = A ? A.geometry.arcs.map((a) => ({ r: a.r, at: arcLabelPoint(a, txA, 14 * layoutSc) })) : [];
  const sill = isInternal
    ? `M ${X(BOX.jambW_top)} ${Y(0)} L ${X(fw - BOX.jambW_top)} ${Y(0)} L ${X(fw - BOX.jambW_top)} ${Y(BOX.sillTop)} L ${X(BOX.jambW_top)} ${Y(BOX.sillTop)} Z`
    : `M ${X(BOX.jambW_bottom)} ${Y(0)} L ${X(fw - BOX.jambW_bottom)} ${Y(0)} L ${X(fw - BOX.jambW_bottom)} ${Y(BOX.sillNose)} L ${X(BOX.jambW_bottom)} ${Y(BOX.sillNose)} Z`;

  // Dimension numbers — live from the profile the derived data was computed
  // with (snapshot-aware); geometry above stays schematic.
  const pd = derived?.boxDims || {};
  const intJambDim = Math.round(Number(pd.intJamb ?? 86));
  const intHeadDim = Math.round(Number(pd.intHead ?? 86));
  const extJambDim = Math.round(Number(pd.extJamb ?? BOX.jambW_top));
  const extHeadDim = Math.round(Number(pd.extHead ?? BOX.headH));
  const cillHDim = Math.round(Number(pd.cillH ?? 69));
  const jambDim = isInternal ? intJambDim : extJambDim;
  const headDim = isInternal ? intHeadDim : extHeadDim;
  const innerDim = fw - 2 * jambDim;

  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';

  return (
    <div className="w-full relative">
      <div className="absolute top-2 right-2 z-10 text-[10px] text-ink-400 bg-surface-700/80 px-2 py-1 rounded cursor-pointer hover:text-accent-400 transition-colors"
        onClick={handleExpand}>
        {isExternalExpand ? '⊕ Expand' : (expanded ? '⊖ Collapse' : '⊕ Expand')}
      </div>

      <div onClick={isExternalExpand ? handleExpand : () => setExpanded(!expanded)} className="cursor-pointer"
        style={{ maxHeight: (expanded && !isExternalExpand) ? 'none' : '65vh', overflow: 'auto' }}>
        <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto" style={{ background: COLORS.bg }}
          data-arch-origin={A ? `${ox},${oy}` : undefined}>

          {/* Frame geometry */}
          <path d={rJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />
          <path d={lJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />
          <path d={head} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />
          <path d={sill} fill={COL.frameFill} stroke={COL.frame} strokeWidth={STROKES.frame} {...NS} />

          {/* Sill details — external: full profile; internal: one straight top line between liners */}
          {isInternal ? (
            <line x1={X(BOX.jambW_top)} y1={Y(BOX.sillTop)} x2={X(fw - BOX.jambW_top)} y2={Y(BOX.sillTop)}
              stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
          ) : (
            <>
              <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillWeatherbar)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillWeatherbar)}
                stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillDrip)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillDrip)}
                stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
              <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillTop)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillTop)}
                stroke={COL.sillDetail} strokeWidth={STROKES.sash} {...NS} />
            </>
          )}

          {/* Labels */}
          <text x={X(BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label}
            fontSize={tfs(SIZES.label, totalW)} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
            transform={`rotate(-90, ${X(BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
            {linerPrefix} JAMB LINER (L)
          </text>
          <text x={X(fw - BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label}
            fontSize={tfs(SIZES.label, totalW)} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
            transform={`rotate(90, ${X(fw - BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
            {linerPrefix} JAMB LINER (R)
          </text>
          <text x={X(fw / 2)} y={A ? Y(fh - A.geometry.head.thickness / 2) + 8 * totalW / VIEWBOX_REF : Y(fh - BOX.headH / 2) + 8 * totalW / VIEWBOX_REF} fill={COL.label}
            fontSize={tfs(SIZES.label, totalW)} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
            {A ? `S-ARCH HEAD ${Math.round(A.geometry.head.thickness)}` : `${linerPrefix} HEAD LINER`}
          </text>
          {A && (
            <g>
              <line x1={X(-20 * layoutSc)} y1={Y(A.geometry.start)} x2={X(fw + 20 * layoutSc)} y2={Y(A.geometry.start)}
                stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray={`${8 * layoutSc},${3 * layoutSc},${2 * layoutSc},${3 * layoutSc}`} />
              <DimV x={X(0) - DM * 1.8} y1={Y(A.geometry.start)} y2={Y(0)} extFrom={X(0)} label={`start ${Math.round(A.geometry.start * 10) / 10}`} small vbw={totalW} />
              <DimV x={X(0) - DM * 1.8} y1={Y(fh)} y2={Y(A.geometry.start)} extFrom={X(0)} label={`rise ${Math.round(A.geometry.rise * 10) / 10}`} small vbw={totalW} />
              {archRadii.map((rl, k) => (
                <text key={`r-${k}`} x={rl.at[0]} y={rl.at[1]} fill={COL.dim} fontSize={tfs(SIZES.dimSmall, totalW)}
                  fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.dim}>{`R ${Math.round(rl.r * 10) / 10}`}</text>
              ))}
            </g>
          )}
          <text x={X(fw / 2)} y={Y((isInternal ? BOX.sillTop : BOX.sillNose) / 2) + 8 * totalW / VIEWBOX_REF} fill={COL.label}
            fontSize={tfs(SIZES.label, totalW)} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
            SILL
          </text>
          <text x={X(fw / 2)} y={Y(fh / 2)} fill={COL.cavity}
            fontSize={tfs(SIZES.annotation, totalW)}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.2}>
            CAVITY
          </text>

          {/* Dimensions */}
          <DimChainH y={Y(0) + DM * 1.3} extFrom={Y(0)} vbw={totalW}
            cuts={isInternal
              ? [X(0), X(BOX.jambW_top), X(fw - BOX.jambW_top), X(fw)]
              : [X(0), X(BOX.jambW_bottom), X(fw - BOX.jambW_bottom), X(fw)]}
            labels={isInternal ? [intJambDim, innerDim, intJambDim] : undefined} />
          <DimH y={Y(fh) - DM * 1.2} x1={X(BOX.jambW_top)} x2={X(fw - BOX.jambW_top)}
            extFrom={Y(fh)} label={`${innerDim} (inner)`} small vbw={totalW} />
          <DimChainV x={X(fw) + DM * 1.3} extFrom={X(fw)} vbw={totalW}
            cuts={A ? [Y(0), Y(BOX.sillTop), Y(A.geometry.start), Y(fh)] : [Y(0), Y(BOX.sillTop), Y(fh - BOX.headH), Y(fh)]}
            labels={A
              ? [BOX.sillTop, Math.round((A.geometry.start - BOX.sillTop) * 10) / 10, Math.round(A.geometry.rise * 10) / 10]
              : isInternal
              ? [cillHDim, fh - cillHDim - intHeadDim, intHeadDim]
              : [BOX.sillTop, fh - BOX.sillTop - extHeadDim, extHeadDim]} />
          <DimV x={X(0) - DM} y1={Y(fh)} y2={A ? Y(fh - A.geometry.head.thickness) : Y(fh - BOX.headH)}
            extFrom={X(0)} label={A ? `${Math.round(A.geometry.head.thickness)}` : `${headDim}`} small vbw={totalW} />
          {!isInternal && (
            <>
              <DimV x={X(fw) + DM * 2.5} y1={Y(0)} y2={Y(BOX.sillNose)}
                extFrom={X(fw)} label={`${BOX.sillNose}`} small vbw={totalW} />
              <DimV x={X(fw) + DM * 2.5} y1={Y(BOX.sillNose)} y2={Y(BOX.sillTop)}
                extFrom={X(fw)} label={`${BOX.sillTop - BOX.sillNose}`} small vbw={totalW} />
            </>
          )}


          {/* Selection overlays (Window Settings) — invisible click zones + highlight */}
          {clickable && (
            <g>
              <rect x={X(0)} y={Y(fh)} width={BOX.jambW_top} height={fh}
                fill={hl(jambKey) ? COLORS.highlightFill : 'transparent'}
                stroke={hl(jambKey) ? COLORS.highlight : 'none'} strokeWidth={STROKES.frame} {...NS}
                style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onElementClick(jambKey); }} />
              <rect x={X(fw - BOX.jambW_top)} y={Y(fh)} width={BOX.jambW_top} height={fh}
                fill={hl(jambKey) ? COLORS.highlightFill : 'transparent'}
                stroke={hl(jambKey) ? COLORS.highlight : 'none'} strokeWidth={STROKES.frame} {...NS}
                style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onElementClick(jambKey); }} />
              <rect x={X(BOX.jambW_top)} y={Y(fh)} width={fw - 2 * BOX.jambW_top} height={BOX.headH}
                fill={hl(headKey) ? COLORS.highlightFill : 'transparent'}
                stroke={hl(headKey) ? COLORS.highlight : 'none'} strokeWidth={STROKES.frame} {...NS}
                style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onElementClick(headKey); }} />
              <rect x={isInternal ? X(BOX.jambW_top) : X(0)} y={Y(BOX.sillTop)}
                width={isInternal ? fw - 2 * BOX.jambW_top : fw} height={BOX.sillTop}
                fill={hl('cill') ? COLORS.highlightFill : 'transparent'}
                stroke={hl('cill') ? COLORS.highlight : 'none'} strokeWidth={STROKES.frame} {...NS}
                style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onElementClick('cill'); }} />

              {/* Board mounting indicators — where the head / jamb boards sit */}
              {hl('jambs') && (
                <>
                  <line x1={X(BOX.jambW_top / 2)} y1={Y(BOX.sillTop + 10)} x2={X(BOX.jambW_top / 2)} y2={Y(fh - BOX.headH)}
                    stroke={COLORS.highlight} strokeWidth={STROKES.boardIndicator} {...NS} />
                  <line x1={X(fw - BOX.jambW_top / 2)} y1={Y(BOX.sillTop + 10)} x2={X(fw - BOX.jambW_top / 2)} y2={Y(fh - BOX.headH)}
                    stroke={COLORS.highlight} strokeWidth={STROKES.boardIndicator} {...NS} />
                </>
              )}
              {hl('head') && (
                <line x1={X(0)} y1={Y(fh - BOX.headH / 2)} x2={X(fw)} y2={Y(fh - BOX.headH / 2)}
                  stroke={COLORS.highlight} strokeWidth={STROKES.boardIndicator} {...NS} />
              )}
            </g>
          )}

          {/* Title */}
          <text x={totalW / 2} y={totalH - 10 * totalW / VIEWBOX_REF} fill={COL.title}
            fontSize={tfs(SIZES.title, totalW)}
            fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.title}>
            Box — {isInternal ? 'Internal' : 'External'}{projNum ? ` — ${projNum}` : ''} — {winName}
          </text>
          <text x={totalW / 2} y={totalH + 14 * totalW / VIEWBOX_REF} fill={COL.title}
            fontSize={tfs(SIZES.subtitle, totalW)}
            fontFamily={FONT.family} textAnchor="middle">
            {fw} × {fh} mm{A ? ` · ${A.geometry.label} · ${radiiText(A.geometry.arcs)}` : ''}
          </text>
        </svg>
      </div>
    </div>
  );
}
