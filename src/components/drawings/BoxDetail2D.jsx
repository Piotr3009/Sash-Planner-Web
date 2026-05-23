/**
 * BoxDetail2D.jsx
 *
 * Parametric front elevation of box frame based on real DXF profiles.
 * Constants extracted from OTD production drawings (box_front.dxf).
 * Click to expand 2x. Dimensions 4x bigger for readability.
 */
import { useMemo, useState } from 'react';
import { FONT, DimH, DimV, DimChainH, DimChainV } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, SC_DIVISOR } from './drawingTheme.js';

// ─── Constants from DXF (profile geometry — fixed) ───
const BOX = {
  jambW_bottom: 86,
  jambW_top: 102,
  headH: 102,
  sillNose: 33,
  sillWeatherbar: 46.5,
  sillDrip: 58,
  sillTop: 68,
  sillCurveTop: 94,
  bulge: 0.292123,
};

// Alias — wired to theme
const COL = {
  frame:     COLORS.frame,
  frameFill: COLORS.frameFill,
  sillDetail: COLORS.sillDetail,
  dim:       COLORS.dim,
  label:     COLORS.label,
  cavity:    COLORS.label,
  title:     COLORS.title,
};

// ─── Bulge → SVG arc ───
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

// ─── Main Component ───
export default function BoxDetail2D({ windowSpec, derived, onExpand, projectNumber }) {
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
    return { fw, fh, innerW };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh } = d;
  // Scale factor for text/dims relative to frame size
  const layoutSc = Math.max(fw, fh) / 500;
  const DM = 60 * layoutSc;
  const M = 80 * layoutSc;
  const totalW = fw + M * 2 + DM * 3;
  const totalH = fh + M * 2 + DM * 3;
  const sc = totalW / SC_DIVISOR;

  // Coordinate helpers (Y flipped)
  const ox = M + DM * 2;
  const oy = M + DM;
  const X = (x) => ox + x;
  const Y = (y) => oy + (fh - y);

  // ─── Paths ───
  const rJamb = [
    `M ${X(fw - BOX.jambW_bottom)} ${Y(0)}`,
    `L ${X(fw - BOX.jambW_bottom)} ${Y(BOX.sillTop)}`,
    bulgeArc(X(fw - BOX.jambW_bottom), Y(BOX.sillTop), X(fw - BOX.jambW_top), Y(BOX.sillCurveTop), BOX.bulge),
    `L ${X(fw - BOX.jambW_top)} ${Y(fh)}`,
    `L ${X(fw)} ${Y(fh)}`,
    `L ${X(fw)} ${Y(0)}`,
    'Z',
  ].join(' ');

  const lJamb = [
    `M ${X(BOX.jambW_bottom)} ${Y(0)}`,
    `L ${X(BOX.jambW_bottom)} ${Y(BOX.sillTop)}`,
    bulgeArc(X(BOX.jambW_bottom), Y(BOX.sillTop), X(BOX.jambW_top), Y(BOX.sillCurveTop), -BOX.bulge),
    `L ${X(BOX.jambW_top)} ${Y(fh)}`,
    `L ${X(0)} ${Y(fh)}`,
    `L ${X(0)} ${Y(0)}`,
    'Z',
  ].join(' ');

  const head = `M ${X(BOX.jambW_top)} ${Y(fh)} L ${X(fw - BOX.jambW_top)} ${Y(fh)} L ${X(fw - BOX.jambW_top)} ${Y(fh - BOX.headH)} L ${X(BOX.jambW_top)} ${Y(fh - BOX.headH)} Z`;

  const sill = `M ${X(BOX.jambW_bottom)} ${Y(0)} L ${X(fw - BOX.jambW_bottom)} ${Y(0)} L ${X(fw - BOX.jambW_bottom)} ${Y(BOX.sillNose)} L ${X(BOX.jambW_bottom)} ${Y(BOX.sillNose)} Z`;

  const labelFs = `${SIZES.label}px`;
  const titleFs = `${SIZES.title}px`;
  const subtitleFs = `${SIZES.subtitle}px`;
  const cavityFs = `${SIZES.annotation}px`;
  const winName = windowSpec?.name || 'Window';
  const projNum = projectNumber || '';

  return (
    <div className="w-full relative">
      {/* Expand hint */}
      <div className="absolute top-2 right-2 z-10 text-[10px] text-ink-400 bg-surface-700/80 px-2 py-1 rounded cursor-pointer hover:text-accent-400 transition-colors"
        onClick={handleExpand}>
        {isExternalExpand ? '⊕ Expand' : (expanded ? '⊖ Collapse' : '⊕ Expand')}
      </div>

      <div onClick={isExternalExpand ? handleExpand : () => setExpanded(!expanded)} className="cursor-pointer">
        <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto" style={{ maxHeight: (expanded && !isExternalExpand) ? 'none' : '65vh', background: COLORS.bg }}>

          {/* Frame geometry */}
          <path d={rJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={sc * 3} />
          <path d={lJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={sc * 3} />
          <path d={head} fill={COL.frameFill} stroke={COL.frame} strokeWidth={sc * 3} />
          <path d={sill} fill={COL.frameFill} stroke={COL.frame} strokeWidth={sc * 3} />

          {/* Sill detail lines */}
          <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillWeatherbar)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillWeatherbar)} stroke={COL.sillDetail} strokeWidth={sc * 1.5} />
          <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillDrip)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillDrip)} stroke={COL.sillDetail} strokeWidth={sc * 1.5} />
          <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillTop)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillTop)} stroke={COL.sillDetail} strokeWidth={sc * 1.5} />

          {/* Labels */}
          <text x={X(BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label} style={{fontSize: labelFs}} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
            transform={`rotate(-90, ${X(BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
            EXT. JAMB LINER (L)
          </text>
          <text x={X(fw - BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label} style={{fontSize: labelFs}} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
            transform={`rotate(90, ${X(fw - BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
            EXT. JAMB LINER (R)
          </text>
          <text x={X(fw / 2)} y={Y(fh - BOX.headH / 2) + sc * 8} fill={COL.label} style={{fontSize: labelFs}} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
            EXT. HEAD LINER
          </text>
          <text x={X(fw / 2)} y={Y(BOX.sillNose / 2) + sc * 8} fill={COL.label} style={{fontSize: labelFs}} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
            SILL
          </text>
          <text x={X(fw / 2)} y={Y(fh / 2)} fill={COL.cavity} style={{fontSize: cavityFs}}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.2}>
            CAVITY
          </text>

          {/* ── Red dimensions (CAD-style with ext lines + chain) ── */}

          {/* Overall width chain — bottom: jambW_bottom | cavity | jambW_bottom */}
          <DimChainH y={Y(0) + DM * 1.3} extFrom={Y(0)} sc={sc}
            cuts={[X(0), X(BOX.jambW_bottom), X(fw - BOX.jambW_bottom), X(fw)]} />

          {/* Inner width — top */}
          <DimH y={Y(fh) - DM * 1.2} x1={X(BOX.jambW_top)} x2={X(fw - BOX.jambW_top)}
            extFrom={Y(fh)} label={`${d.innerW} (inner)`} small sc={sc} />

          {/* Overall height chain — right: sill | cavity | head */}
          <DimChainV x={X(fw) + DM * 1.3} extFrom={X(fw)} sc={sc}
            cuts={[Y(0), Y(BOX.sillTop), Y(fh - BOX.headH), Y(fh)]} />

          {/* Head height — left */}
          <DimV x={X(0) - DM} y1={Y(fh)} y2={Y(fh - BOX.headH)}
            extFrom={X(0)} label={`${BOX.headH}`} small sc={sc} />

          {/* Sill details — far right */}
          <DimV x={X(fw) + DM * 2.5} y1={Y(0)} y2={Y(BOX.sillNose)}
            extFrom={X(fw)} label={`${BOX.sillNose}`} small sc={sc} />
          <DimV x={X(fw) + DM * 2.5} y1={Y(BOX.sillNose)} y2={Y(BOX.sillTop)}
            extFrom={X(fw)} label={`${BOX.sillTop - BOX.sillNose}`} small sc={sc} />

          {/* Title */}
          <text x={totalW / 2} y={totalH - sc * 12} fill={COL.title} style={{fontSize: titleFs}}
            fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.title}>
            Box — Front{projNum ? ` — ${projNum}` : ''} — {winName}
          </text>
          <text x={totalW / 2} y={totalH + sc * 18} fill={COL.title} style={{fontSize: subtitleFs}}
            fontFamily={FONT.family} textAnchor="middle">
            {fw} × {fh} mm
          </text>
        </svg>
      </div>
    </div>
  );
}
