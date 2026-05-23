/**
 * BoxDetail2D.jsx
 *
 * Parametric front elevation of box frame based on real DXF profiles.
 * Constants extracted from OTD production drawings (box_front.dxf).
 * Click to expand 2x. Dimensions 4x bigger for readability.
 */
import { useMemo, useState } from 'react';
import { FONT } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS } from './drawingTheme.js';

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

// ─── Dimension helpers (unified via theme) ───
function DimH({ y, x1, x2, label, small, sc }) {
  const fs = small ? sc * SIZES.dimSmall : sc * SIZES.dimLarge;
  const tick = sc * 14;
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={COL.dim} strokeWidth={sc * 2} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke={COL.dim} strokeWidth={sc * 2} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke={COL.dim} strokeWidth={sc * 2} />
      <text x={mid} y={y - sc * 10} fill={COL.dim} fontSize={fs} fontFamily={FONT.family}
        textAnchor="middle" fontWeight={WEIGHTS.dim}>{label}</text>
    </g>
  );
}

function DimV({ x, y1, y2, label, small, sc }) {
  const fs = small ? sc * SIZES.dimSmall : sc * SIZES.dimLarge;
  const tick = sc * 14;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={COL.dim} strokeWidth={sc * 2} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={COL.dim} strokeWidth={sc * 2} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke={COL.dim} strokeWidth={sc * 2} />
      <text x={x + sc * 18} y={mid + sc * 8} fill={COL.dim} fontSize={fs} fontFamily={FONT.family}
        fontWeight={WEIGHTS.dim} transform={`rotate(-90, ${x + sc * 18}, ${mid + sc * 8})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

function Ext({ x1, y1, x2, y2, sc }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COL.dim} strokeWidth={sc * 1} strokeDasharray={`${sc * 6},${sc * 4}`} />;
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
  const sc = Math.max(fw, fh) / 500;
  const DM = 60 * sc;
  const M = 80 * sc;
  const totalW = fw + M * 2 + DM * 3;
  const totalH = fh + M * 2 + DM * 3;

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

  const labelFs = sc * SIZES.label;
  const titleFs = sc * SIZES.title;
  const subtitleFs = sc * SIZES.subtitle;
  const cavityFs = sc * SIZES.annotation;
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
          className="w-full h-auto" style={{ maxHeight: (expanded && !isExternalExpand) ? 'none' : '65vh' }}>

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
          <text x={X(BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label} fontSize={labelFs} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
            transform={`rotate(-90, ${X(BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
            EXT. JAMB LINER (L)
          </text>
          <text x={X(fw - BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label} fontSize={labelFs} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
            transform={`rotate(90, ${X(fw - BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
            EXT. JAMB LINER (R)
          </text>
          <text x={X(fw / 2)} y={Y(fh - BOX.headH / 2) + sc * 8} fill={COL.label} fontSize={labelFs} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
            EXT. HEAD LINER
          </text>
          <text x={X(fw / 2)} y={Y(BOX.sillNose / 2) + sc * 8} fill={COL.label} fontSize={labelFs} fontWeight={WEIGHTS.label}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
            SILL
          </text>
          <text x={X(fw / 2)} y={Y(fh / 2)} fill={COL.cavity} fontSize={cavityFs}
            fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.2}>
            CAVITY
          </text>

          {/* ── Red dimensions ── */}

          {/* Overall width — bottom */}
          <Ext x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(0) + DM * 1.5} sc={sc} />
          <Ext x1={X(fw)} y1={Y(0)} x2={X(fw)} y2={Y(0) + DM * 1.5} sc={sc} />
          <DimH y={Y(0) + DM * 1.3} x1={X(0)} x2={X(fw)} label={`${fw} mm`} sc={sc} />

          {/* Overall height — right */}
          <Ext x1={X(fw)} y1={Y(0)} x2={X(fw) + DM * 1.5} y2={Y(0)} sc={sc} />
          <Ext x1={X(fw)} y1={Y(fh)} x2={X(fw) + DM * 1.5} y2={Y(fh)} sc={sc} />
          <DimV x={X(fw) + DM * 1.3} y1={Y(fh)} y2={Y(0)} label={`${fh} mm`} sc={sc} />

          {/* Inner width — top */}
          <Ext x1={X(BOX.jambW_top)} y1={Y(fh)} x2={X(BOX.jambW_top)} y2={Y(fh) - DM * 1.5} sc={sc} />
          <Ext x1={X(fw - BOX.jambW_top)} y1={Y(fh)} x2={X(fw - BOX.jambW_top)} y2={Y(fh) - DM * 1.5} sc={sc} />
          <DimH y={Y(fh) - DM * 1.2} x1={X(BOX.jambW_top)} x2={X(fw - BOX.jambW_top)}
            label={`${d.innerW} (inner)`} small sc={sc} />

          {/* Jamb width — bottom */}
          <Ext x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(0) + DM * 2.5} sc={sc} />
          <Ext x1={X(BOX.jambW_bottom)} y1={Y(0)} x2={X(BOX.jambW_bottom)} y2={Y(0) + DM * 2.5} sc={sc} />
          <DimH y={Y(0) + DM * 2.3} x1={X(0)} x2={X(BOX.jambW_bottom)} label={`${BOX.jambW_bottom}`} small sc={sc} />

          {/* Head height — left */}
          <Ext x1={X(0)} y1={Y(fh - BOX.headH)} x2={X(0) - DM * 1.2} y2={Y(fh - BOX.headH)} sc={sc} />
          <Ext x1={X(0)} y1={Y(fh)} x2={X(0) - DM * 1.2} y2={Y(fh)} sc={sc} />
          <DimV x={X(0) - DM} y1={Y(fh)} y2={Y(fh - BOX.headH)} label={`${BOX.headH}`} small sc={sc} />

          {/* Sill details — far right */}
          <Ext x1={X(fw)} y1={Y(0)} x2={X(fw) + DM * 2.8} y2={Y(0)} sc={sc} />
          <Ext x1={X(fw)} y1={Y(BOX.sillNose)} x2={X(fw) + DM * 2.8} y2={Y(BOX.sillNose)} sc={sc} />
          <Ext x1={X(fw)} y1={Y(BOX.sillTop)} x2={X(fw) + DM * 2.8} y2={Y(BOX.sillTop)} sc={sc} />
          <DimV x={X(fw) + DM * 2.5} y1={Y(0)} y2={Y(BOX.sillNose)} label={`${BOX.sillNose}`} small sc={sc} />
          <DimV x={X(fw) + DM * 2.5} y1={Y(BOX.sillNose)} y2={Y(BOX.sillTop)}
            label={`${BOX.sillTop - BOX.sillNose}`} small sc={sc} />

          {/* Title */}
          <text x={totalW / 2} y={totalH - sc * 12} fill={COL.title} fontSize={titleFs}
            fontFamily={FONT.family} textAnchor="middle" fontWeight={WEIGHTS.title}>
            Box — Front{projNum ? ` — ${projNum}` : ''} — {winName}
          </text>
          <text x={totalW / 2} y={totalH + sc * 18} fill={COL.title} fontSize={subtitleFs}
            fontFamily={FONT.family} textAnchor="middle">
            {fw} × {fh} mm
          </text>
        </svg>
      </div>
    </div>
  );
}
