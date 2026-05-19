/**
 * SashDetail2D.jsx
 *
 * Detail view of a single sash (upper or lower).
 * Style: CAD-like thin lines, timber fill ≠ container bg, green labels, red dims.
 * Click to expand.
 */
import { useMemo, useState } from 'react';
import { CONSTANTS } from '../../engine/calculations.js';
import { FONT } from './drawingUtils.jsx';

// ─── CAD Drawing Colors ───
const C = {
  line: '#94A3B8',         // structural lines (solid, thin)
  timber: 'rgba(139,90,43,0.08)',  // timber fill
  glass: 'rgba(14,165,233,0.06)',  // glass fill
  barFill: 'rgba(139,90,43,0.12)', // bar timber fill
  label: '#00B4A0',        // green labels
  dim: '#EF4444',          // red dimensions
  horn: '#F59E0B',         // horn accent
  title: '#E2E8F0',
  subtitle: '#64748b',
};

const LW = 0.5; // CAD line weight

// ─── Red dimension helpers ───
function DimH({ y, x1, x2, label, small }) {
  const fs = small ? 8 : 10;
  const tick = 4;
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.dim} strokeWidth={LW} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke={C.dim} strokeWidth={LW} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke={C.dim} strokeWidth={LW} />
      <text x={mid} y={y - 5} fill={C.dim} fontSize={fs} fontFamily={FONT.family}
        textAnchor="middle" fontWeight="600">{label}</text>
    </g>
  );
}

function DimV({ x, y1, y2, label, small }) {
  const fs = small ? 8 : 10;
  const tick = 4;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={C.dim} strokeWidth={LW} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={C.dim} strokeWidth={LW} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke={C.dim} strokeWidth={LW} />
      <text x={x + 7} y={mid + 3} fill={C.dim} fontSize={fs} fontFamily={FONT.family}
        fontWeight="600" transform={`rotate(-90, ${x + 7}, ${mid + 3})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

function Ext({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.dim} strokeWidth={0.3} strokeDasharray="3,2" />;
}

// ─── Main Component ───
export default function SashDetail2D({ windowSpec, derived, type = 'upper' }) {
  const [expanded, setExpanded] = useState(false);

  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;

    const sashW = derived.sashWidth;
    const stile = CONSTANTS.STILE_WIDTH;
    const topRail = CONSTANTS.TOP_RAIL_WIDTH;
    const botRail = CONSTANTS.BOTTOM_RAIL_WIDTH;
    const meetRail = CONSTANTS.MEETING_RAIL_WIDTH;
    const barW = CONSTANTS.GLAZING_BAR_WIDTH;

    const isUpper = type === 'upper';
    const sashH = isUpper ? derived.topSashHeight : derived.bottomSashHeight;
    const topR = isUpper ? topRail : meetRail;
    const botR = isUpper ? meetRail : botRail;

    const glassX = stile;
    const glassY = topR;
    const glassW = sashW - 2 * stile;
    const glassH = sashH - topR - botR;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    let vBars = 0, hBars = 0;
    if (gridMode !== 'none' && gridMode !== 'custom') {
      const parts = gridMode.split('x');
      const cols = parseInt(parts[0]) || 2;
      const rows = parseInt(parts[1]) || 2;
      vBars = cols - 1;
      hBars = isUpper ? Math.floor(rows / 2) : Math.ceil(rows / 2);
    }

    const hasHorns = windowSpec.sash?.horns;
    const hornExt = hasHorns ? (windowSpec.sash?.hornExtension || 75) : 0;
    const section = CONSTANTS.SASH_SECTION;
    const railSection = isUpper ? CONSTANTS.SASH_SECTION : CONSTANTS.BOTTOM_RAIL_SECTION;

    return { sashW, sashH, stile, topR, botR, barW, glassX, glassY, glassW, glassH, vBars, hBars, hasHorns, hornExt, section, railSection, isUpper };
  }, [windowSpec, derived, type]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const DM = 35;
  const M = 50;
  const totalW = d.sashW + M * 2 + DM * 3;
  const totalH = d.sashH + M * 2 + DM * 3 + (d.hornExt > 0 ? d.hornExt + 20 : 0);
  const label = d.isUpper ? 'UPPER' : 'LOWER';

  const ox = M + DM * 2;
  const oy = M + DM + (d.isUpper ? 0 : (d.hornExt > 0 ? d.hornExt + 20 : 0));
  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  return (
    <div className="w-full relative">
      <div className="absolute top-2 right-2 z-10 text-[10px] text-ink-400 bg-surface-700/80 px-2 py-1 rounded cursor-pointer hover:text-accent-400"
        onClick={() => setExpanded(!expanded)}>
        {expanded ? '⊖ Collapse' : '⊕ Expand'}
      </div>

      <div onClick={() => setExpanded(!expanded)} className="cursor-pointer">
        <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto" style={{ maxHeight: expanded ? 'none' : '65vh' }}>

          {/* Sash outline — solid thin */}
          <rect x={X(0)} y={Y(0)} width={d.sashW} height={d.sashH}
            fill="none" stroke={C.line} strokeWidth={LW} />

          {/* Left stile — timber fill */}
          <rect x={X(0)} y={Y(0)} width={d.stile} height={d.sashH}
            fill={C.timber} stroke={C.line} strokeWidth={LW} />

          {/* Right stile — timber fill */}
          <rect x={X(d.sashW - d.stile)} y={Y(0)} width={d.stile} height={d.sashH}
            fill={C.timber} stroke={C.line} strokeWidth={LW} />

          {/* Top rail — timber fill */}
          <rect x={X(0)} y={Y(0)} width={d.sashW} height={d.topR}
            fill={C.timber} stroke={C.line} strokeWidth={LW} />

          {/* Bottom rail — timber fill */}
          <rect x={X(0)} y={Y(d.sashH - d.botR)} width={d.sashW} height={d.botR}
            fill={C.timber} stroke={C.line} strokeWidth={LW} />

          {/* Glass area */}
          <rect x={X(d.glassX)} y={Y(d.glassY)} width={d.glassW} height={d.glassH}
            fill={C.glass} stroke="none" />

          {/* Vertical bars — solid, timber fill */}
          {d.vBars > 0 && Array.from({ length: d.vBars }).map((_, i) => {
            const spacing = d.glassW / (d.vBars + 1);
            const bx = d.glassX + spacing * (i + 1) - d.barW / 2;
            return <rect key={`v${i}`} x={X(bx)} y={Y(d.glassY)} width={d.barW} height={d.glassH}
              fill={C.barFill} stroke={C.line} strokeWidth={LW} />;
          })}

          {/* Horizontal bars — solid, timber fill */}
          {d.hBars > 0 && Array.from({ length: d.hBars }).map((_, i) => {
            const spacing = d.glassH / (d.hBars + 1);
            const by = d.glassY + spacing * (i + 1) - d.barW / 2;
            return <rect key={`h${i}`} x={X(d.glassX)} y={Y(by)} width={d.glassW} height={d.barW}
              fill={C.barFill} stroke={C.line} strokeWidth={LW} />;
          })}

          {/* Horns (upper sash — extend below, dashed because hidden/projected) */}
          {d.isUpper && d.hasHorns && <>
            <line x1={X(2)} y1={Y(d.sashH)} x2={X(2)} y2={Y(d.sashH + d.hornExt)}
              stroke={C.horn} strokeWidth={1} strokeDasharray="4,3" />
            <line x1={X(d.sashW - 2)} y1={Y(d.sashH)} x2={X(d.sashW - 2)} y2={Y(d.sashH + d.hornExt)}
              stroke={C.horn} strokeWidth={1} strokeDasharray="4,3" />
            <text x={X(d.sashW + 10)} y={Y(d.sashH + d.hornExt / 2) + 3} fill={C.horn}
              fontSize={7} fontFamily={FONT.family} fillOpacity={0.7}>Horn {d.hornExt}mm</text>
          </>}

          {/* Horns (lower sash — extend above) */}
          {!d.isUpper && d.hasHorns && <>
            <line x1={X(2)} y1={Y(0)} x2={X(2)} y2={Y(-d.hornExt)}
              stroke={C.horn} strokeWidth={1} strokeDasharray="4,3" />
            <line x1={X(d.sashW - 2)} y1={Y(0)} x2={X(d.sashW - 2)} y2={Y(-d.hornExt)}
              stroke={C.horn} strokeWidth={1} strokeDasharray="4,3" />
            <text x={X(d.sashW + 10)} y={Y(-d.hornExt / 2) + 3} fill={C.horn}
              fontSize={7} fontFamily={FONT.family} fillOpacity={0.7}>Horn {d.hornExt}mm</text>
          </>}

          {/* ── Green labels ── */}
          <text x={X(d.stile / 2)} y={Y(d.sashH / 2)} fill={C.label} fontSize={7}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.6}
            transform={`rotate(-90, ${X(d.stile / 2)}, ${Y(d.sashH / 2)})`}>STILE</text>
          <text x={X(d.sashW - d.stile / 2)} y={Y(d.sashH / 2)} fill={C.label} fontSize={7}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.6}
            transform={`rotate(90, ${X(d.sashW - d.stile / 2)}, ${Y(d.sashH / 2)})`}>STILE</text>
          <text x={X(d.sashW / 2)} y={Y(d.topR / 2 + 3)} fill={C.label} fontSize={7}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.6}>
            {d.isUpper ? 'TOP RAIL' : 'MEETING RAIL'}
          </text>
          <text x={X(d.sashW / 2)} y={Y(d.sashH - d.botR / 2 + 3)} fill={C.label} fontSize={7}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.6}>
            {d.isUpper ? 'MEETING RAIL' : 'BOTTOM RAIL'}
          </text>

          {/* ── Red dimensions ── */}
          {/* Overall width */}
          <Ext x1={X(0)} y1={Y(d.sashH) + DM * 0.3} x2={X(0)} y2={Y(d.sashH) + DM * 1.2} />
          <Ext x1={X(d.sashW)} y1={Y(d.sashH) + DM * 0.3} x2={X(d.sashW)} y2={Y(d.sashH) + DM * 1.2} />
          <DimH y={Y(d.sashH) + DM * 1} x1={X(0)} x2={X(d.sashW)} label={`${d.sashW} mm`} />

          {/* Overall height */}
          <Ext x1={X(d.sashW) + DM * 0.3} y1={Y(0)} x2={X(d.sashW) + DM * 1.2} y2={Y(0)} />
          <Ext x1={X(d.sashW) + DM * 0.3} y1={Y(d.sashH)} x2={X(d.sashW) + DM * 1.2} y2={Y(d.sashH)} />
          <DimV x={X(d.sashW) + DM * 1} y1={Y(0)} y2={Y(d.sashH)} label={`${d.sashH} mm`} />

          {/* Stile width */}
          <Ext x1={X(0)} y1={Y(0) - DM * 0.3} x2={X(0)} y2={Y(0) - DM * 1} />
          <Ext x1={X(d.stile)} y1={Y(0) - DM * 0.3} x2={X(d.stile)} y2={Y(0) - DM * 1} />
          <DimH y={Y(0) - DM * 0.8} x1={X(0)} x2={X(d.stile)} label={`${d.stile}`} small />

          {/* Top rail */}
          <Ext x1={X(0) - DM * 0.3} y1={Y(0)} x2={X(0) - DM * 1} y2={Y(0)} />
          <Ext x1={X(0) - DM * 0.3} y1={Y(d.topR)} x2={X(0) - DM * 1} y2={Y(d.topR)} />
          <DimV x={X(0) - DM * 0.8} y1={Y(0)} y2={Y(d.topR)} label={`${d.topR}`} small />

          {/* Bottom rail */}
          <Ext x1={X(0) - DM * 0.3} y1={Y(d.sashH - d.botR)} x2={X(0) - DM * 1} y2={Y(d.sashH - d.botR)} />
          <Ext x1={X(0) - DM * 0.3} y1={Y(d.sashH)} x2={X(0) - DM * 1} y2={Y(d.sashH)} />
          <DimV x={X(0) - DM * 0.8} y1={Y(d.sashH - d.botR)} y2={Y(d.sashH)} label={`${d.botR}`} small />

          {/* Glass width */}
          <Ext x1={X(d.glassX)} y1={Y(d.sashH) + DM * 1.5} x2={X(d.glassX)} y2={Y(d.sashH) + DM * 2.2} />
          <Ext x1={X(d.glassX + d.glassW)} y1={Y(d.sashH) + DM * 1.5} x2={X(d.glassX + d.glassW)} y2={Y(d.sashH) + DM * 2.2} />
          <DimH y={Y(d.sashH) + DM * 2} x1={X(d.glassX)} x2={X(d.glassX + d.glassW)}
            label={`Glass: ${Math.round(d.glassW)}`} small />

          {/* Title */}
          <text x={totalW / 2} y={totalH - 12} fill={C.title} fontSize={10}
            fontFamily={FONT.family} textAnchor="middle" fontWeight="600">
            {label} SASH DETAIL — {d.sashW} × {d.sashH} mm
          </text>
          <text x={totalW / 2} y={totalH} fill={C.subtitle} fontSize={7}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.5}>
            Stile: {d.section} · {d.isUpper ? 'Top' : 'Bottom'} rail: {d.railSection}
          </text>
        </svg>
      </div>
    </div>
  );
}
