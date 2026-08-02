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


// Catalogue of extension board projections (raw board = proj + tongue).
const EXT_VARIANTS = [35, 60, 85];

export default function CasementSection2D({ windowSpec, derived, projectNumber, selectedElement, onElementClick, fullWidth = false, showAllExtensions = false }) {
  const clickable = typeof onElementClick === 'function';
  const hl = (key) => clickable && selectedElement === key;
  const geom = useMemo(() => {
    if (!windowSpec || !derived?.casement) return null;
    const ext = Number(windowSpec.cill?.extension) || 0;
    // Reference mode (Assign Materials): draw all three boards nested, one per
    // catalogue row, and let the selected row highlight its own outline.
    const projections = showAllExtensions ? EXT_VARIANTS : (ext > 0 ? [ext] : []);
    const boards = projections.map((proj) => ({
      proj,
      key: showAllExtensions ? `sillExt${proj}` : 'sillExtension',
      path: buildExtensionPath(proj),
    }));
    return { ext, boards, maxExt: projections.length ? Math.max(...projections) : 0 };
  }, [windowSpec, derived, showAllExtensions]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const B = CILL_BASE;
  const { ext, boards, maxExt } = geom;
  const selBoard = boards.find((b) => hl(b.key)) || null;
  const M = 34;
  const DIM_TOP = 30;
  const DIM_RIGHT = 34;
  const DIM_STEP = 16;
  const DIM_BOT = boards.length ? 18 + boards.length * DIM_STEP : 12;
  const TITLE_AREA = 26;
  const boardBottom = B.boardBottomY; // board bottom is flush with the cill
  const drawH = Math.max(B.height, boardBottom);
  const totalW = M + maxExt + B.width + DIM_RIGHT + M;
  const svgH = DIM_TOP + drawH + DIM_BOT + TITLE_AREA + 16;
  const ox = M + maxExt;
  const oy = DIM_TOP + 8;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  return (
    <div className={`card p-3 ${fullWidth ? '' : 'max-w-[80%] mx-auto'}`}>
      <div className="mb-1 px-1">
        <div className="text-[11px] font-semibold text-ink-100">Cill Section</div>
        <div className="text-[9px] text-ink-400">
          {`${B.width} × ${B.height}`}
          {showAllExtensions
            ? (selBoard
              ? ` · extension ${selBoard.proj}mm · board 34×${selBoard.proj + B.tongue} raw`
              : ` · extensions ${EXT_VARIANTS.join(' / ')}mm · select a row to highlight`)
            : (ext > 0 ? ` · extension ${ext}mm · board 34×${ext + B.tongue} raw` : ' · no extension')}
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
          <path d={boards.length ? CILL_PATH_GROOVED : CILL_PATH}
            fill={hl('cill') ? COLORS.highlightFill : 'url(#cillHatch)'}
            stroke={hl('cill') ? COLORS.highlight : COLORS.frame}
            strokeWidth={STROKES.sash} strokeLinejoin="round" {...NS}
            style={clickable ? { cursor: 'pointer' } : undefined}
            onClick={clickable ? (e) => { e.stopPropagation(); onElementClick('cill'); } : undefined} />
          {/* Widest board first so the smaller outlines stay on top and clickable. */}
          {[...boards].sort((a, b) => b.proj - a.proj).map((b) => {
            const on = hl(b.key);
            return (
              <path key={b.key} d={b.path}
                fill={on ? COLORS.highlightFill : (showAllExtensions ? 'transparent' : 'url(#cillHatch)')}
                stroke={on ? COLORS.highlight : (showAllExtensions ? COLORS.section : COLORS.frame)}
                strokeWidth={on ? STROKES.frame : (showAllExtensions ? STROKES.bar : STROKES.sash)}
                strokeLinejoin="round" {...NS}
                style={clickable ? { cursor: 'pointer' } : undefined}
                onClick={clickable ? (e) => { e.stopPropagation(); onElementClick(b.key); } : undefined} />
            );
          })}
        </g>

        <DimH x1={X(0)} x2={X(B.width)} y={Y(0) - 14} label={`${B.width}`} vbw={totalW} />
        <DimV x={X(B.width) + 18} y1={Y(0)} y2={Y(B.height)} label={`${B.height}`} vbw={totalW} />
        {boards.map((b, i) => (
          <DimH key={b.key} x1={X(-b.proj)} x2={X(0)} y={Y(boardBottom) + 16 + i * DIM_STEP}
            label={`${b.proj}`} vbw={totalW} />
        ))}
        {boards.length > 0 && (
          <DimV x={X(-maxExt) - 14} y1={Y(B.boardTopY)} y2={Y(B.boardBottomY)} label="34" vbw={totalW} />
        )}

        <TitleBlock x={totalW / 2} y={svgH - 14} title="CILL SECTION"
          subtitle={`ext ${showAllExtensions && !selBoard ? EXT_VARIANTS.join(' / ') : (selBoard?.proj ?? ext ?? 0)}mm${projectNumber ? ` · ${projectNumber}` : ''}`}
          vbw={totalW} scale={0.5} />
      </svg>
    </div>
  );
}
