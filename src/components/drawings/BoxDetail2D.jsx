/**
 * BoxDetail2D.jsx
 *
 * Parametric front elevation of box frame based on real DXF profiles.
 * Constants extracted from OTD production drawings (box_front.dxf).
 * Variable: frame width/height from windowSpec.
 * Shows: External Jamb Liners (L/R), External Head Liner, Sill with details.
 */
import { useMemo } from 'react';
import { FONT } from './drawingUtils.jsx';

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

// ─── Colors ───
const COL = {
  frame: '#CBD5E1',
  frameFill: 'rgba(148,163,184,0.06)',
  sillDetail: '#94A3B8',
  dim: '#EF4444',
  label: '#64748b',
  cavity: '#475569',
  title: '#E2E8F0',
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

// ─── Red dimension helpers ───
function DimH({ y, x1, x2, label, small }) {
  const fs = small ? FONT.size * 0.6 : FONT.size * 0.75;
  const tick = small ? 4 : 5;
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={COL.dim} strokeWidth={0.6} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke={COL.dim} strokeWidth={0.6} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke={COL.dim} strokeWidth={0.6} />
      <text x={mid} y={y - 5} fill={COL.dim} fontSize={fs} fontFamily={FONT.family}
        textAnchor="middle" fontWeight="600">{label}</text>
    </g>
  );
}

function DimV({ x, y1, y2, label, small }) {
  const fs = small ? FONT.size * 0.6 : FONT.size * 0.75;
  const tick = small ? 4 : 5;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={COL.dim} strokeWidth={0.6} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke={COL.dim} strokeWidth={0.6} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke={COL.dim} strokeWidth={0.6} />
      <text x={x + 8} y={mid + 4} fill={COL.dim} fontSize={fs} fontFamily={FONT.family}
        fontWeight="600" transform={`rotate(-90, ${x + 8}, ${mid + 4})`}
        textAnchor="middle">{label}</text>
    </g>
  );
}

function Ext({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COL.dim} strokeWidth={0.3} strokeDasharray="3,2" />;
}

// ─── Main Component ───
export default function BoxDetail2D({ windowSpec, derived }) {
  const d = useMemo(() => {
    if (!windowSpec || !derived) return null;
    const fw = windowSpec.frame.width;
    const fh = windowSpec.frame.height;
    const innerW = fw - 2 * BOX.jambW_top;
    return { fw, fh, innerW };
  }, [windowSpec, derived]);

  if (!d) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { fw, fh } = d;
  const DM = 40;
  const M = 60;
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

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ maxHeight: '70vh' }}>

        {/* Frame geometry */}
        <path d={rJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={1.5} />
        <path d={lJamb} fill={COL.frameFill} stroke={COL.frame} strokeWidth={1.5} />
        <path d={head} fill={COL.frameFill} stroke={COL.frame} strokeWidth={1.5} />
        <path d={sill} fill={COL.frameFill} stroke={COL.frame} strokeWidth={1.5} />

        {/* Sill detail lines */}
        <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillWeatherbar)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillWeatherbar)} stroke={COL.sillDetail} strokeWidth={0.6} />
        <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillDrip)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillDrip)} stroke={COL.sillDetail} strokeWidth={0.6} />
        <line x1={X(BOX.jambW_bottom)} y1={Y(BOX.sillTop)} x2={X(fw - BOX.jambW_bottom)} y2={Y(BOX.sillTop)} stroke={COL.sillDetail} strokeWidth={0.6} />

        {/* Labels */}
        <text x={X(BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label} fontSize={FONT.size * 0.5}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
          transform={`rotate(-90, ${X(BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
          EXT. JAMB LINER (L)
        </text>
        <text x={X(fw - BOX.jambW_bottom / 2)} y={Y(fh / 2)} fill={COL.label} fontSize={FONT.size * 0.5}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
          transform={`rotate(90, ${X(fw - BOX.jambW_bottom / 2)}, ${Y(fh / 2)})`}>
          EXT. JAMB LINER (R)
        </text>
        <text x={X(fw / 2)} y={Y(fh - BOX.headH / 2) + 4} fill={COL.label} fontSize={FONT.size * 0.55}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
          EXT. HEAD LINER
        </text>
        <text x={X(fw / 2)} y={Y(BOX.sillNose / 2) + 4} fill={COL.label} fontSize={FONT.size * 0.55}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}>
          SILL
        </text>
        <text x={X(fw / 2)} y={Y(fh / 2)} fill={COL.cavity} fontSize={FONT.size * 0.8}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.25}>
          CAVITY
        </text>

        {/* ── Red dimensions ── */}

        {/* Overall width — bottom */}
        <Ext x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(0) + DM * 1.5} />
        <Ext x1={X(fw)} y1={Y(0)} x2={X(fw)} y2={Y(0) + DM * 1.5} />
        <DimH y={Y(0) + DM * 1.3} x1={X(0)} x2={X(fw)} label={`${fw} mm`} />

        {/* Overall height — right */}
        <Ext x1={X(fw)} y1={Y(0)} x2={X(fw) + DM * 1.5} y2={Y(0)} />
        <Ext x1={X(fw)} y1={Y(fh)} x2={X(fw) + DM * 1.5} y2={Y(fh)} />
        <DimV x={X(fw) + DM * 1.3} y1={Y(fh)} y2={Y(0)} label={`${fh} mm`} />

        {/* Inner width — top */}
        <Ext x1={X(BOX.jambW_top)} y1={Y(fh)} x2={X(BOX.jambW_top)} y2={Y(fh) - DM * 1.5} />
        <Ext x1={X(fw - BOX.jambW_top)} y1={Y(fh)} x2={X(fw - BOX.jambW_top)} y2={Y(fh) - DM * 1.5} />
        <DimH y={Y(fh) - DM * 1.2} x1={X(BOX.jambW_top)} x2={X(fw - BOX.jambW_top)}
          label={`${d.innerW} (inner)`} small />

        {/* Jamb width — bottom */}
        <Ext x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(0) + DM * 2.5} />
        <Ext x1={X(BOX.jambW_bottom)} y1={Y(0)} x2={X(BOX.jambW_bottom)} y2={Y(0) + DM * 2.5} />
        <DimH y={Y(0) + DM * 2.3} x1={X(0)} x2={X(BOX.jambW_bottom)} label={`${BOX.jambW_bottom}`} small />

        {/* Head height — left */}
        <Ext x1={X(0)} y1={Y(fh - BOX.headH)} x2={X(0) - DM * 1.2} y2={Y(fh - BOX.headH)} />
        <Ext x1={X(0)} y1={Y(fh)} x2={X(0) - DM * 1.2} y2={Y(fh)} />
        <DimV x={X(0) - DM} y1={Y(fh)} y2={Y(fh - BOX.headH)} label={`${BOX.headH}`} small />

        {/* Sill details — far right */}
        <Ext x1={X(fw)} y1={Y(0)} x2={X(fw) + DM * 2.8} y2={Y(0)} />
        <Ext x1={X(fw)} y1={Y(BOX.sillNose)} x2={X(fw) + DM * 2.8} y2={Y(BOX.sillNose)} />
        <Ext x1={X(fw)} y1={Y(BOX.sillTop)} x2={X(fw) + DM * 2.8} y2={Y(BOX.sillTop)} />
        <DimV x={X(fw) + DM * 2.5} y1={Y(0)} y2={Y(BOX.sillNose)} label={`${BOX.sillNose}`} small />
        <DimV x={X(fw) + DM * 2.5} y1={Y(BOX.sillNose)} y2={Y(BOX.sillTop)}
          label={`${BOX.sillTop - BOX.sillNose}`} small />

        {/* Title */}
        <text x={totalW / 2} y={totalH - 8} fill={COL.title} fontSize={FONT.size * 0.85}
          fontFamily={FONT.family} textAnchor="middle" fontWeight="600">
          BOX DETAIL — {fw} × {fh} mm
        </text>
        <text x={totalW / 2} y={totalH + 6} fill={COL.label} fontSize={FONT.size * 0.6}
          fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.5}>
          Ext. Liners + Sill · Profile from DXF
        </text>
      </svg>
    </div>
  );
}
