/**
 * JambDetail2D.jsx — jamb board face view for Window Settings.
 * Visual only: two pulley pockets near the top and the central parting-bead
 * groove; width/thickness come live from the workshop profile.
 */
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES } from './drawingTheme.js';
import { FONT, tfs } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };

export default function JambDetail2D({ boardWidth = 141, thickness = 28, selected = false, onClick }) {
  const bw = Math.max(60, Number(boardWidth) || 141);
  const bh = 300;                 // shortened board with a break line
  const M = 46;                   // margin for dims/labels
  const totalW = bw + M * 2 + 40;
  const totalH = bh + M * 2 + 20;
  const ox = M + 20;
  const oy = M;

  const grooveW = 9;              // parting bead groove (visual)
  const gx = ox + bw / 2 - grooveW / 2;

  // Pulley pockets: one each side of the groove, near the top
  const pkW = Math.min(24, bw * 0.16);
  const pkH = 78;
  const pkY = oy + 30;
  const pkGap = grooveW / 2 + 10;
  const pkLx = ox + bw / 2 - pkGap - pkW;
  const pkRx = ox + bw / 2 + pkGap;

  // Break line (zig-zag) near the bottom to show the board continues
  const brY = oy + bh - 44;
  const zig = Array.from({ length: 9 }, (_, i) => {
    const x = ox - 6 + ((bw + 12) / 8) * i;
    const y = brY + (i % 2 === 0 ? -6 : 6);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const clickable = typeof onClick === 'function';

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto" style={{ background: COLORS.bg }}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick('jambs'); } : undefined}
      role="img" aria-label="Jamb board detail">

      {/* Board outline */}
      <rect x={ox} y={oy} width={bw} height={bh}
        fill={selected ? COLORS.highlightFill : COLORS.frameFill}
        stroke={selected ? COLORS.highlight : COLORS.frame}
        strokeWidth={STROKES.frame} {...NS}
        style={clickable ? { cursor: 'pointer' } : undefined} />

      {/* Parting-bead groove */}
      <rect x={gx} y={oy} width={grooveW} height={bh} fill={COLORS.bg} fillOpacity={0.55}
        stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />

      {/* Pulley pockets (visual) */}
      {[pkLx, pkRx].map((px, i) => (
        <g key={i} pointerEvents="none">
          <rect x={px} y={pkY} width={pkW} height={pkH} rx={pkW / 2}
            fill={COLORS.bg} fillOpacity={0.5}
            stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
          <circle cx={px + pkW / 2} cy={pkY + pkW / 2 + 4} r={pkW * 0.28}
            fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} strokeOpacity={0.7} />
          <circle cx={px + pkW / 2} cy={pkY + pkH - pkW / 2 - 4} r={pkW * 0.28}
            fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} strokeOpacity={0.7} />
        </g>
      ))}
      <text x={ox + bw / 2} y={pkY - 12} fill={COLORS.label} fillOpacity={0.7}
        fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family} textAnchor="middle" pointerEvents="none">
        pulley pockets
      </text>

      {/* Break line */}
      <path d={zig} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />

      {/* JAMB label */}
      <text x={ox + bw / 2 + grooveW} y={oy + bh * 0.62} fill={COLORS.label}
        fontSize={tfs(SIZES.label, totalW)} fontWeight={WEIGHTS.label}
        fontFamily={FONT.family} textAnchor="middle" fillOpacity={0.7}
        transform={`rotate(-90, ${ox + bw / 2 + grooveW}, ${oy + bh * 0.62})`} pointerEvents="none">
        JAMB
      </text>

      {/* Width dimension */}
      <g pointerEvents="none">
        <line x1={ox} y1={oy + bh + 22} x2={ox + bw} y2={oy + bh + 22}
          stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <line x1={ox} y1={oy + bh + 16} x2={ox} y2={oy + bh + 28} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <line x1={ox + bw} y1={oy + bh + 16} x2={ox + bw} y2={oy + bh + 28} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <text x={ox + bw / 2} y={oy + bh + 18} fill={COLORS.dim}
          fontSize={tfs(SIZES.dimSmall, totalW)} fontFamily={FONT.family} textAnchor="middle">
          {bw}
        </text>
      </g>

      {/* Title */}
      <text x={totalW / 2} y={totalH - 6} fill={COLORS.title}
        fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family} textAnchor="middle" pointerEvents="none">
        Jamb board — {thickness} × {bw} mm
      </text>
    </svg>
  );
}
