/**
 * HorizontalSection2D.jsx
 */
import { useMemo } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { STROKE, COLORS, FONT, SIZES, STROKES, VIEWBOX_REF, DimH, DimV, TitleBlock, Label, DIM_OFFSET, MARGIN, tfs } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };

const SECT = { staffBead: 20, partingBead: 10, sashStile: 57, jambWidth: 28, gap: 4 };

export default function HorizontalSection2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const depth = windowSpec.frame.depth || 164;
    const sashW = derived.sashWidth;
    const stile = CONSTANTS.STILE_WIDTH;
    const blocks = [];
    let x = 0;
    blocks.push({ x, w: SECT.staffBead, h: depth, label: 'Staff Bead', fill: 0.08 });
    x += SECT.staffBead + SECT.gap;
    blocks.push({ x, w: stile, h: depth * 0.7, label: 'Outer Sash Stile', fill: 0.12, isSash: true });
    x += stile + SECT.gap;
    blocks.push({ x, w: SECT.partingBead, h: depth, label: 'Parting Bead', fill: 0.06 });
    x += SECT.partingBead + SECT.gap;
    blocks.push({ x, w: stile, h: depth * 0.7, label: 'Inner Sash Stile', fill: 0.12, isSash: true });
    x += stile + SECT.gap;
    blocks.push({ x, w: SECT.staffBead, h: depth, label: 'Staff Bead', fill: 0.08 });
    x += SECT.staffBead;
    return { depth, sashW, stile, blocks, totalW: x };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const viewW = d.totalW + MARGIN * 2 + DIM_OFFSET * 3;
  const viewH = d.depth + MARGIN * 2 + DIM_OFFSET * 3;

  return (
    <div className="w-full" style={{ maxHeight: '55vh', overflow: 'auto' }}>
      <svg
        viewBox={`${-MARGIN - DIM_OFFSET * 2} ${-MARGIN - DIM_OFFSET} ${viewW} ${viewH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        style={{ background: COLORS.bg }}
      >
        <text x={-DIM_OFFSET - 10} y={d.depth / 2 + 4}
          fill={STROKE.dimText} fontSize={tfs(SIZES.annotation, viewW)} fontFamily={FONT.family}
          textAnchor="end" fillOpacity={0.5}>
          ← EXTERIOR
        </text>
        <text x={d.totalW + DIM_OFFSET + 10} y={d.depth / 2 + 4}
          fill={STROKE.dimText} fontSize={tfs(SIZES.annotation, viewW)} fontFamily={FONT.family}
          textAnchor="start" fillOpacity={0.5}>
          INTERIOR →
        </text>

        {d.blocks.map((b, i) => {
          const yOff = b.isSash ? (d.depth - b.h) / 2 : 0;
          return (
            <g key={i}>
              <rect x={b.x} y={yOff} width={b.w} height={b.h}
                fill={STROKE.sectionFill} fillOpacity={b.fill}
                stroke={b.isSash ? STROKE.sash : STROKE.frame} strokeWidth={STROKES.section} {...NS} />
              <text x={b.x + b.w / 2} y={d.depth + 20}
                fill={STROKE.label} fontSize={tfs(SIZES.notch, viewW)} fontFamily={FONT.family}
                textAnchor="middle" fillOpacity={0.7}
                transform={`rotate(-45, ${b.x + b.w / 2}, ${d.depth + 20})`}>
                {b.label}
              </text>
              {b.w > 15 && (
                <DimH y={-DIM_OFFSET} x1={b.x} x2={b.x + b.w} extFrom={0} label={`${b.w}`} small vbw={viewW} />
              )}
            </g>
          );
        })}

        <DimH y={d.depth + DIM_OFFSET + 30} x1={0} x2={d.totalW} extFrom={d.depth} label={`Total: ${d.totalW} mm`} vbw={viewW} />
        <DimV x={d.totalW + DIM_OFFSET} y1={0} y2={d.depth} extFrom={d.totalW} label={`${d.depth} mm`} vbw={viewW} />
        <TitleBlock x={d.totalW / 2} y={d.depth + DIM_OFFSET * 2 + 50}
          title="HORIZONTAL SECTION"
          subtitle="Cross-section at meeting rail level (simplified)" vbw={viewW} />
      </svg>
    </div>
  );
}
