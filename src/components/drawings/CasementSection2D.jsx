/**
 * CasementSection2D.jsx — CILL + EXTENSION section (approved concept).
 *
 * Shows ONLY the bottom frame: the exact cill profile traced 1:1 from the
 * OTD DXF plus the customer-selected extension window sill (35 / 60 / 85mm,
 * from windowSpec.cill.extension). No head, rails or glass — full technical
 * drawings live in the cut list. Large dimensions on purpose.
 *
 * Extension board (v2, mockup approved 02.08.2026): constant 34mm thickness
 * at the cill face, top continues the weathering slope, radiused nose, R4 arc
 * drip, and a 10×10 TONGUE hooking into a groove cut in the cill face —
 * geometry measured from the OTD assembly DXF. The groove is drawn only when
 * an extension is present (it is an optional machining on the cill).
 */
import { useMemo } from 'react';
import { DimH, DimV, TitleBlock } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, STROKES } from './drawingTheme.js';
import { CILL_BASE, CILL_PATH, CILL_PATH_GROOVED, buildExtensionPath } from './casementSectionAssets.js';

const NS = { vectorEffect: 'non-scaling-stroke' };


export default function CasementSection2D({ windowSpec, derived, projectNumber }) {
  const geom = useMemo(() => {
    if (!windowSpec || !derived?.casement) return null;
    const ext = Number(windowSpec.cill?.extension) || 0;
    return { ext, extPath: ext > 0 ? buildExtensionPath(ext) : null };
  }, [windowSpec, derived]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const B = CILL_BASE;
  const { ext, extPath } = geom;
  const M = 34;
  const DIM_TOP = 30;
  const DIM_RIGHT = 34;
  const DIM_BOT = ext > 0 ? 34 : 12;
  const TITLE_AREA = 26;
  const boardBottom = B.boardBottomY; // board bottom is flush with the cill
  const drawH = Math.max(B.height, boardBottom);
  const totalW = M + ext + B.width + DIM_RIGHT + M;
  const svgH = DIM_TOP + drawH + DIM_BOT + TITLE_AREA + 16;
  const ox = M + ext;
  const oy = DIM_TOP + 8;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  return (
    <div className="card p-3 max-w-[80%] mx-auto">
      <div className="mb-1 px-1">
        <div className="text-[11px] font-semibold text-ink-100">Cill Section</div>
        <div className="text-[9px] text-ink-400">
          {`${B.width} × ${B.height}`}{ext > 0 ? ` · extension ${ext}mm · board 34×${ext + B.tongue} raw` : ' · no extension'}
        </div>
      </div>
      <svg viewBox={`0 0 ${totalW} ${svgH}`} className="w-full h-auto select-none">
        <rect x="0" y="0" width={totalW} height={svgH} fill={COLORS.bg} rx="6" />
        <defs>
          <pattern id="cillHatch" width="6" height="6" patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke={COLORS.frameLight} strokeWidth="0.5" />
          </pattern>
        </defs>

        <g transform={`translate(${ox} ${oy})`}>
          <path d={ext > 0 ? CILL_PATH_GROOVED : CILL_PATH} fill="url(#cillHatch)" stroke={COLORS.frame}
            strokeWidth={STROKES.sash} strokeLinejoin="round" {...NS} />
          {extPath && (
            <path d={extPath} fill="url(#cillHatch)" stroke={COLORS.frame}
              strokeWidth={STROKES.sash} strokeLinejoin="round" {...NS} />
          )}
        </g>

        <DimH x1={X(0)} x2={X(B.width)} y={Y(0) - 14} label={`${B.width}`} vbw={totalW} />
        <DimV x={X(B.width) + 18} y1={Y(0)} y2={Y(B.height)} label={`${B.height}`} vbw={totalW} />
        {ext > 0 && (
          <DimH x1={X(-ext)} x2={X(0)} y={Y(boardBottom) + 16} label={`${ext}`} vbw={totalW} />
        )}
        {ext > 0 && (
          <DimV x={X(-ext) - 14} y1={Y(B.boardTopY)} y2={Y(B.boardBottomY)} label="34" vbw={totalW} />
        )}

        <TitleBlock x={totalW / 2} y={svgH - 14} title="CILL SECTION"
          subtitle={`ext ${ext || 0}mm${projectNumber ? ` · ${projectNumber}` : ''}`}
          vbw={totalW} scale={0.5} />
      </svg>
    </div>
  );
}
