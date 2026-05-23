/**
 * HorizontalSection2D.jsx
 *
 * Simplified horizontal cross-section at meeting rail level.
 * Shows: exterior → staff bead → sash stile → parting bead → sash stile → staff bead → interior.
 * V1 placeholder — rectangles with labels. Real profile contours later.
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, SC_DIVISOR, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN } from './drawingUtils.jsx';

// Approximate section widths at meeting rail level (simplified)
const SECT = {
  staffBead: 20,
  partingBead: 10,
  sashStile: 57,
  jambWidth: 28,
  gap: 4,
};

export default function HorizontalSection2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const depth = windowSpec.frame.depth || 164;
    const sashW = derived.sashWidth;
    const stile = CONSTANTS.STILE_WIDTH;

    // Build horizontal stack from exterior (left) to interior (right)
    const blocks = [];
    let x = 0;

    // Exterior face label
    const extX = x;

    // Staff bead (exterior side)
    blocks.push({ x, w: SECT.staffBead, h: depth, label: 'Staff Bead', fill: 0.08 });
    x += SECT.staffBead + SECT.gap;

    // Outer sash stile (e.g. lower sash — closer to exterior)
    blocks.push({ x, w: stile, h: depth * 0.7, label: 'Outer Sash Stile', fill: 0.12, isSash: true });
    x += stile + SECT.gap;

    // Parting bead
    blocks.push({ x, w: SECT.partingBead, h: depth, label: 'Parting Bead', fill: 0.06 });
    x += SECT.partingBead + SECT.gap;

    // Inner sash stile (e.g. upper sash — closer to interior)
    blocks.push({ x, w: stile, h: depth * 0.7, label: 'Inner Sash Stile', fill: 0.12, isSash: true });
    x += stile + SECT.gap;

    // Staff bead (interior side)
    blocks.push({ x, w: SECT.staffBead, h: depth, label: 'Staff Bead', fill: 0.08 });
    x += SECT.staffBead;

    const totalW = x;

    return { depth, sashW, stile, blocks, totalW };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const viewW = d.totalW + MARGIN * 2 + DIM_OFFSET * 3;
  const viewH = d.depth + MARGIN * 2 + DIM_OFFSET * 3;
  const sc = viewW / SC_DIVISOR;

  return (
    <div className="w-full">
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${viewW} ${viewH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ maxHeight: '55vh' , background: COLORS.bg }}
      >
        {/* Exterior / Interior labels */}
        <text x={-DIM_OFFSET - 10} y={d.depth / 2 + 4}
          fill={STROKE.dimText} style={{fontSize: `${SIZES.annotation}px`}} fontFamily={FONT.family}
          textAnchor="end" fillOpacity={0.5}>
          ← EXTERIOR
        </text>
        <text x={d.totalW + DIM_OFFSET + 10} y={d.depth / 2 + 4}
          fill={STROKE.dimText} style={{fontSize: `${SIZES.annotation}px`}} fontFamily={FONT.family}
          textAnchor="start" fillOpacity={0.5}>
          INTERIOR →
        </text>

        {/* Profile blocks */}
        {d.blocks.map((b, i) => {
          const yOff = b.isSash ? (d.depth - b.h) / 2 : 0;
          return (
            <g key={i}>
              <rect x={b.x} y={yOff} width={b.w} height={b.h}
                fill={STROKE.sectionFill} fillOpacity={b.fill}
                stroke={b.isSash ? STROKE.sash : STROKE.frame} strokeWidth={1} />
              {/* Label below */}
              <text x={b.x + b.w / 2} y={d.depth + 20}
                fill={STROKE.label} style={{fontSize: `${SIZES.notch}px`}} fontFamily={FONT.family}
                textAnchor="middle" fillOpacity={0.7}
                transform={`rotate(-45, ${b.x + b.w / 2}, ${d.depth + 20})`}>
                {b.label}
              </text>
              {/* Width dim on top */}
              {b.w > 15 && (
                <DimH y={-DIM_OFFSET} x1={b.x} x2={b.x + b.w} extFrom={0} label={`${b.w}`} small sc={sc} />
              )}
            </g>
          );
        })}

        {/* Overall width */}
        <DimH y={d.depth + DIM_OFFSET + 30} x1={0} x2={d.totalW} extFrom={d.depth} label={`Total: ${d.totalW} mm`} sc={sc} />

        {/* Depth */}
        <DimV x={d.totalW + DIM_OFFSET} y1={0} y2={d.depth} extFrom={d.totalW} label={`${d.depth} mm`} sc={sc} />

        {/* Title */}
        <TitleBlock x={d.totalW / 2} y={d.depth + DIM_OFFSET * 2 + 50}
          title="HORIZONTAL SECTION"
          subtitle="Cross-section at meeting rail level (simplified)" sc={sc} />
      </svg>
    </div>
  );
}
