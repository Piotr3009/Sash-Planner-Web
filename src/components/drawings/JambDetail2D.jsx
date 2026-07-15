/**
 * JambDetail2D.jsx — jamb + head board details for Window Settings.
 * Visual only, drawn at a shared scale with correct proportions:
 * jamb = narrow vertical board with two pulley pockets and the parting-bead
 * groove; head = horizontal board with the groove. Both shortened with a
 * break line. Width/thickness come live from the workshop profile.
 */
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES } from './drawingTheme.js';
import { FONT, tfs } from './drawingUtils.jsx';

const NS = { vectorEffect: 'non-scaling-stroke' };

export default function JambDetail2D({ boardWidth = 141, thickness = 28, selectedElement, onElementClick }) {
  const bw = Math.max(60, Number(boardWidth) || 141);
  const S = 0.55;                    // shared mm→unit scale (visibly smaller than the box cards)
  const jw = bw * S;                 // jamb board width on screen
  const jh = 300;                    // shortened jamb length (break line)
  const hh = bw * S;                 // head board height on screen (same board width)
  const hwLen = 250;                 // shortened head length
  const gap = 34;

  const M = 40;
  const totalW = jw + gap + hwLen + M * 2 + 30;
  const totalH = Math.max(jh, hh) + M * 2 + 34;
  const jx = M + 14;
  const jy = M;
  const hx = jx + jw + gap;
  const hy = M + 24;

  const grooveW = Math.max(5, 9 * S * 2);
  const clickable = typeof onElementClick === 'function';
  const selJamb = clickable && selectedElement === 'jambs';
  const selHead = clickable && selectedElement === 'head';
  const click = (key) => clickable ? (e) => { e.stopPropagation(); onElementClick(key); } : undefined;

  // Jamb pulley pockets
  const pkW = Math.min(14, jw * 0.24);
  const pkH = 52;
  const pkY = jy + 18;
  const pkLx = jx + jw / 2 - grooveW / 2 - 6 - pkW;
  const pkRx = jx + jw / 2 + grooveW / 2 + 6;

  const zigJ = Array.from({ length: 7 }, (_, i) => {
    const x = jx - 5 + ((jw + 10) / 6) * i;
    const y = jy + jh - 26 + (i % 2 === 0 ? -4 : 4);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const zigH = Array.from({ length: 7 }, (_, i) => {
    const y = hy - 5 + ((hh + 10) / 6) * i;
    const x = hx + hwLen - 26 + (i % 2 === 0 ? -4 : 4);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto" style={{ background: COLORS.bg }}
      role="img" aria-label="Jamb and head board details">

      {/* ── Jamb board ── */}
      <rect x={jx} y={jy} width={jw} height={jh}
        fill={selJamb ? COLORS.highlightFill : COLORS.frameFill}
        stroke={selJamb ? COLORS.highlight : COLORS.frame}
        strokeWidth={STROKES.frame} {...NS}
        style={clickable ? { cursor: 'pointer' } : undefined} onClick={click('jambs')} />
      <rect x={jx + jw / 2 - grooveW / 2} y={jy} width={grooveW} height={jh}
        fill={COLORS.bg} fillOpacity={0.55} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />
      {[pkLx, pkRx].map((px, i) => (
        <rect key={i} x={px} y={pkY} width={pkW} height={pkH} rx={pkW / 2}
          fill={COLORS.bg} fillOpacity={0.5} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />
      ))}
      <path d={zigJ} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />
      <text x={jx + jw / 2} y={jy - 6} fill={COLORS.label} fillOpacity={0.75}
        fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family} textAnchor="middle" pointerEvents="none">
        JAMB
      </text>
      <g pointerEvents="none">
        <line x1={jx} y1={jy + jh + 14} x2={jx + jw} y2={jy + jh + 14} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <line x1={jx} y1={jy + jh + 9} x2={jx} y2={jy + jh + 19} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <line x1={jx + jw} y1={jy + jh + 9} x2={jx + jw} y2={jy + jh + 19} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <text x={jx + jw / 2} y={jy + jh + 30} fill={COLORS.dim}
          fontSize={tfs(SIZES.dimSmall, totalW)} fontFamily={FONT.family} textAnchor="middle">{bw}</text>
      </g>

      {/* ── Head board ── */}
      <rect x={hx} y={hy} width={hwLen} height={hh}
        fill={selHead ? COLORS.highlightFill : COLORS.frameFill}
        stroke={selHead ? COLORS.highlight : COLORS.frame}
        strokeWidth={STROKES.frame} {...NS}
        style={clickable ? { cursor: 'pointer' } : undefined} onClick={click('head')} />
      <rect x={hx} y={hy + hh / 2 - grooveW / 2} width={hwLen} height={grooveW}
        fill={COLORS.bg} fillOpacity={0.55} stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />
      <path d={zigH} fill="none" stroke={COLORS.frame} strokeWidth={STROKES.sash} {...NS} pointerEvents="none" />
      <text x={hx + hwLen / 2} y={hy - 6} fill={COLORS.label} fillOpacity={0.75}
        fontSize={tfs(SIZES.annotation, totalW)} fontFamily={FONT.family} textAnchor="middle" pointerEvents="none">
        HEAD
      </text>
      <g pointerEvents="none">
        <line x1={hx + hwLen + 12} y1={hy} x2={hx + hwLen + 12} y2={hy + hh} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <line x1={hx + hwLen + 7} y1={hy} x2={hx + hwLen + 17} y2={hy} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <line x1={hx + hwLen + 7} y1={hy + hh} x2={hx + hwLen + 17} y2={hy + hh} stroke={COLORS.dim} strokeWidth={STROKES.dim} {...NS} />
        <text x={hx + hwLen + 22} y={hy + hh / 2 + 4} fill={COLORS.dim}
          fontSize={tfs(SIZES.dimSmall, totalW)} fontFamily={FONT.family} textAnchor="start">{bw}</text>
      </g>

      {/* Title */}
      <text x={totalW / 2} y={totalH - 4} fill={COLORS.title}
        fontSize={tfs(SIZES.subtitle, totalW)} fontFamily={FONT.family} textAnchor="middle" pointerEvents="none">
        Jamb / Head boards — {thickness} × {bw} mm
      </text>
    </svg>
  );
}
