/**
 * CasementSection2D.jsx
 *
 * Parametric VERTICAL section through the casement window, built from the
 * OTD assembly DXF (traced 1:1 into casementSectionAssets.js). Same drawing
 * system as the rest: mm coordinates, dark theme, drawingUtils dimensions.
 *
 * Parametric contract (see the assets file header):
 * - TOP group (head + top rail + beads/seals/fixings) is drawn fixed;
 * - BOTTOM group (bottom rail + cill) translates down by dH = frameH − base;
 * - glass panes, spanning verticals and t-anchored mid items stretch with
 *   the glass run;
 * - horizontal glazing bars are placed at the engine positions when the
 *   main light has hBars (vertical section shows horizontal bars only);
 * - the cill extension group renders only when spec has an extension.
 */
import { useMemo } from 'react';
import { DimH, DimV, TitleBlock, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import {
  SECTION_BASE, SEC_TOP, SEC_BOTTOM, SEC_EXTENSION, SEC_SPANS, SEC_MID,
  SEC_FIX_TOP, SEC_FIX_BOTTOM, SEC_FIX_MID, SEC_EDGE_TOP, SEC_EDGE_BOTTOM,
  SEC_EDGE_MID, SEC_BAR,
} from './casementSectionAssets.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const GLASS_FILL = '#7DD3FC';

export default function CasementSection2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    const cas = derived?.casement;
    if (!windowSpec || !cas) return null;
    const fh = Number(windowSpec.frame?.height ?? 0);
    if (!fh) return null;
    const B = SECTION_BASE;
    const dH = Math.max(fh - B.height, -(B.glassBottom - B.glassTop - 60));
    const glassRun = (B.glassBottom - B.glassTop) + dH;
    const hBars = Number(windowSpec.casement?.bars?.h) || 0;
    const barYs = [];
    for (let i = 1; i <= hBars; i += 1) {
      barYs.push(B.glassTop + (glassRun * i) / (hBars + 1));
    }
    const ext = Number(windowSpec.cill?.extension) || 0;
    return { fh, B, dH, glassRun, barYs, ext, totalH: B.height + dH };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { B, dH, glassRun, barYs, ext, totalH, fh } = geom;
  const layoutSc = Math.max(B.width, totalH) / 500;
  const DM = 62 * layoutSc;
  const M = 70 * layoutSc;
  const TITLE_AREA = 50 * layoutSc;
  const extPad = ext > 0 ? 58 : 0;
  const totalW = M + extPad + B.width + DM * 2 + M;
  const svgH = M + totalH + DM + TITLE_AREA;
  const ox = M + extPad;
  const oy = M;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;
  const ts = totalW / VIEWBOX_REF;
  const annFs = tfs(SIZES.code, totalW);

  const stroke = { stroke: COLORS.frame, strokeWidth: STROKES.sash, fill: 'none', ...NS };
  const edgeStroke = { stroke: COLORS.frameLight, strokeWidth: STROKES.frameLight, fill: 'none', ...NS };

  const yMid = (t) => Y(B.glassTop + t * glassRun);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1 px-1">
        <div>
          <div className="text-[11px] font-semibold text-ink-100">Vertical Section</div>
          <div className="text-[9px] text-ink-400">
            {`H ${Math.round(fh)} · glass run ${Math.round(glassRun)}mm`}
            {barYs.length > 0 ? ` · ${barYs.length} bar${barYs.length > 1 ? 's' : ''}` : ''}
            {ext > 0 ? ` · cill ext ${ext}mm` : ''}
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${totalW} ${svgH}`} className="w-full h-auto select-none">
        <rect x="0" y="0" width={totalW} height={svgH} fill={COLORS.bg} rx={8 * layoutSc} />

        {/* Glass panes — parametric run */}
        {B.glassPanes.map((gx) => (
          <rect key={gx} x={X(gx)} y={Y(B.glassTop)} width={B.paneW} height={glassRun}
            fill={GLASS_FILL} opacity="0.30" />
        ))}

        {/* Spanning verticals stretch with the run */}
        {SEC_SPANS.map((s, i) => (
          <line key={i} x1={X(s.x)} y1={Y(s.y0)} x2={X(s.x)} y2={Y(s.y1 + dH)} {...stroke} />
        ))}

        {/* Glass-unit edge detail */}
        <g {...edgeStroke}>
          {SEC_EDGE_TOP.map((d, i) => <path key={`et${i}`} d={d} />)}
        </g>
        <g {...edgeStroke} transform={`translate(0 ${dH})`}>
          {SEC_EDGE_BOTTOM.map((d, i) => <path key={`eb${i}`} d={d} />)}
        </g>
        {SEC_EDGE_MID.map((m, i) => (
          <g key={`em${i}`} {...edgeStroke} transform={`translate(${X(m.x)} ${yMid(m.t)})`}>
            <path d={m.d} />
          </g>
        ))}

        {/* Rigid groups */}
        <g {...stroke} transform={`translate(${ox} ${oy})`}>
          {SEC_TOP.map((d, i) => <path key={`t${i}`} d={d} />)}
        </g>
        <g {...stroke} transform={`translate(${ox} ${oy + dH})`}>
          {SEC_BOTTOM.map((d, i) => <path key={`b${i}`} d={d} />)}
        </g>

        {/* Mid items (setting blocks / clips) anchored along the run */}
        {SEC_MID.map((m, i) => (
          <g key={`m${i}`} {...stroke} transform={`translate(${X(m.x)} ${yMid(m.t)})`}>
            <path d={m.d} />
          </g>
        ))}

        {/* Fixings */}
        <g transform={`translate(${ox} ${oy})`}>
          {SEC_FIX_TOP.map((d, i) => <path key={`ft${i}`} d={d} fill={COLORS.frame} />)}
        </g>
        <g transform={`translate(${ox} ${oy + dH})`}>
          {SEC_FIX_BOTTOM.map((d, i) => <path key={`fb${i}`} d={d} fill={COLORS.frame} />)}
        </g>
        {SEC_FIX_MID.map((m, i) => (
          <g key={`fm${i}`} transform={`translate(${X(m.x)} ${yMid(m.t)})`}>
            <path d={m.d} fill={COLORS.frame} />
          </g>
        ))}

        {/* Horizontal glazing bars at engine positions */}
        {barYs.map((by, i) => (
          <g key={`bar${i}`} {...stroke} transform={`translate(${X((B.glassPanes[0] + B.glassPanes[1] + B.paneW) / 2)} ${Y(by)})`}>
            {SEC_BAR.map((d, j) => <path key={j} d={d} />)}
          </g>
        ))}

        {/* Cill extension — only when configured */}
        {ext > 0 && (
          <g {...stroke} transform={`translate(${ox} ${oy + dH})`}>
            {SEC_EXTENSION.map((d, i) => <path key={`x${i}`} d={d} />)}
          </g>
        )}

        {/* Dimensions */}
        <DimH x1={X(B.faceL)} x2={X(B.faceR)} y={Y(0) - 26 * layoutSc} label="93" vbw={totalW} />
        <DimV x={X(B.width) + 20 * layoutSc} y1={Y(0)} y2={Y(B.headH)} label={`${B.headH}`} vbw={totalW} />
        <DimV x={X(B.width) + 20 * layoutSc} y1={Y(totalH - B.cillH)} y2={Y(totalH)} label={`${B.cillH}`} vbw={totalW} />
        <DimH x1={X(B.glassPanes[0])} x2={X(B.glassPanes[1] + B.paneW)} y={Y(B.glassTop) - 14 * layoutSc} label="24" small vbw={totalW} />
        <DimV x={X(B.width) + DM} y1={Y(0)} y2={Y(totalH)} label={`${Math.round(fh)}`} vbw={totalW} />
        {ext > 0 && (
          <text x={X(6)} y={Y(totalH) - 6 * layoutSc} fontSize={annFs} fill={COLORS.dim}
            fontFamily={FONT_FAMILY} {...NS}>{`ext ${ext}mm`}</text>
        )}

        <TitleBlock x={totalW - 8 * layoutSc} y={svgH - 10 * layoutSc}
          title="VERTICAL SECTION"
          subtitle={`H ${Math.round(fh)} · exterior left${projectNumber ? ` · ${projectNumber}` : ''}`} vbw={totalW} />
      </svg>
    </div>
  );
}
