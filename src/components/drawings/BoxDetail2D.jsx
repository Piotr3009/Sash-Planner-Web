/**
 * BoxDetail2D.jsx
 *
 * Simplified front view of the box frame only (no sashes).
 * Shows head, sill, jambs with inner cavity dimensions.
 * V1 placeholder — will be refined with profile details later.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, FONT, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN } from './drawingUtils.jsx';

export default function BoxDetail2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const jw = CONSTANTS.JAMBS_WIDTH;
    const hw = CONSTANTS.HEAD_WIDTH;
    const sw = CONSTANTS.SILL_WIDTH;
    const depth = windowSpec.frame.depth || 164;
    const innerW = fw - 2 * jw;
    const innerH = fh - hw - sw;
    return { fw, fh, jw, hw, sw, depth, innerW, innerH };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const totalW = d.fw + MARGIN * 2 + DIM_OFFSET * 3;
  const totalH = d.fh + MARGIN * 2 + DIM_OFFSET * 3;

  return (
    <div className="w-full">
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${totalW} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ maxHeight: '65vh' }}
      >
        {/* Outer frame */}
        <rect x={0} y={0} width={d.fw} height={d.fh}
          fill="none" stroke={STROKE.frame} strokeWidth={2} />

        {/* Head */}
        <rect x={0} y={0} width={d.fw} height={d.hw}
          fill={STROKE.sectionFill} fillOpacity={0.12} stroke={STROKE.frame} strokeWidth={1} />
        <Label x={d.fw / 2} y={d.hw / 2 + 4} text="HEAD" />

        {/* Sill */}
        <rect x={0} y={d.fh - d.sw} width={d.fw} height={d.sw}
          fill={STROKE.sectionFill} fillOpacity={0.12} stroke={STROKE.frame} strokeWidth={1} />
        <Label x={d.fw / 2} y={d.fh - d.sw / 2 + 4} text="SILL" />

        {/* Left jamb */}
        <rect x={0} y={0} width={d.jw} height={d.fh}
          fill={STROKE.sectionFill} fillOpacity={0.08} stroke={STROKE.frame} strokeWidth={0.5} />
        <Label x={d.jw / 2} y={d.fh / 2} text="JAMB" />

        {/* Right jamb */}
        <rect x={d.fw - d.jw} y={0} width={d.jw} height={d.fh}
          fill={STROKE.sectionFill} fillOpacity={0.08} stroke={STROKE.frame} strokeWidth={0.5} />
        <Label x={d.fw - d.jw / 2} y={d.fh / 2} text="JAMB" />

        {/* Inner cavity (dashed) */}
        <rect x={d.jw} y={d.hw} width={d.innerW} height={d.innerH}
          fill={STROKE.glass} fillOpacity={0.04} stroke={STROKE.dim} strokeWidth={0.5} strokeDasharray="6,4" />

        {/* ── Dimensions ── */}
        {/* Frame width */}
        <DimH y={d.fh + DIM_OFFSET} x1={0} x2={d.fw} label={`${d.fw} mm`} />
        {/* Frame height */}
        <DimV x={d.fw + DIM_OFFSET} y1={0} y2={d.fh} label={`${d.fh} mm`} />

        {/* Inner width */}
        <DimH y={-DIM_OFFSET} x1={d.jw} x2={d.fw - d.jw} label={`Inner: ${d.innerW} mm`} />
        {/* Inner height */}
        <DimV x={-DIM_OFFSET} y1={d.hw} y2={d.fh - d.sw} label={`${d.innerH}`} />

        {/* Head height */}
        <DimV x={d.fw + DIM_OFFSET + 30} y1={0} y2={d.hw} label={`${d.hw}`} small />
        {/* Sill height */}
        <DimV x={d.fw + DIM_OFFSET + 30} y1={d.fh - d.sw} y2={d.fh} label={`${d.sw}`} small />
        {/* Jamb width */}
        <DimH y={d.fh + DIM_OFFSET + 30} x1={0} x2={d.jw} label={`${d.jw}`} small />

        {/* Title */}
        <TitleBlock x={d.fw / 2} y={d.fh + DIM_OFFSET * 2 + 30}
          title={`BOX DETAIL — ${d.fw} × ${d.fh} mm`}
          subtitle={`Depth: ${d.depth}mm · Section: ${CONSTANTS.FRAME_SECTION}`} />
      </svg>
    </div>
  );
}
