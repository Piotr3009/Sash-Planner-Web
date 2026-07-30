/**
 * CasementGlassDrawing2D.jsx
 *
 * Production drawing of a casement sealed glass unit — same drawing system
 * and factory content as the sash GlassDrawing2D: glass outline, 11mm edge
 * seal, 18mm spacer bars on the wood-bar centre lines, chain + overall
 * dimensions. One drawing per UNIQUE glass size; the pane list (P1, P2…)
 * goes in the title. Unit = leaf − 109 (glass enters 12.5 into the rebate),
 * so the unit origin sits at stile − 12.5 in leaf coordinates.
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { DimChainH, DimChainV, DimH, DimV, TitleBlock } from './drawingUtils.jsx';
import { COLORS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { casementBarCounts } from './casementDrawUtils.js';

const NS = { vectorEffect: 'non-scaling-stroke' };
const WOOD_BAR = 22;
const SPACER = 18;
const EDGE_SEAL = 11;

function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

export default function CasementGlassDrawing2D({ windowSpec, derived, group }) {
  const geom = useMemo(() => {
    const cas = derived?.casement;
    if (!windowSpec || !cas?.leaves || !group) return null;
    const idx = group.rep;
    const mm = cas.leaves[idx];
    if (!mm) return null;
    const p = getCasementProfile();
    const stile = p.elements.leafStile.face;
    const REBATE = stile - (p.deductions.glass / 2 - stile) - stile + 12.5; // = 12.5, kept explicit
    const glassW = mm.leafW - p.deductions.glass;
    const glassH = mm.leafH - p.deductions.glass;
    // Unit origin in leaf coords
    const originX = stile - 12.5;
    const originY = stile - 12.5;
    // Wood bars on the daylight → spacer bars on the same centre lines
    const pn = cas.layoutDef.panels[idx];
    const counts = casementBarCounts(windowSpec.casement?.bars, pn._role || 'main');
    const daylightW = mm.leafW - 2 * stile;
    const daylightH = mm.leafH - 2 * stile;
    const vBars = [];
    if (counts.v > 0) {
      const paneW = (daylightW - counts.v * WOOD_BAR) / (counts.v + 1);
      for (let i = 0; i < counts.v; i++) {
        const woodCenter = stile + (i + 1) * paneW + i * WOOD_BAR + WOOD_BAR / 2;
        const cx = woodCenter - originX;
        vBars.push({ cx, left: cx - SPACER / 2, right: cx + SPACER / 2 });
      }
    }
    const hBars = [];
    if (counts.h > 0) {
      const paneH = (daylightH - counts.h * WOOD_BAR) / (counts.h + 1);
      for (let j = 0; j < counts.h; j++) {
        const woodCenter = stile + (j + 1) * paneH + j * WOOD_BAR + WOOD_BAR / 2;
        const cy = woodCenter - originY;
        hBars.push({ cy, top: cy - SPACER / 2, bot: cy + SPACER / 2 });
      }
    }
    void REBATE;
    return { glassW, glassH, vBars, hBars };
  }, [windowSpec, derived, group]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { glassW, glassH } = geom;
  const layoutSc = Math.max(glassW, glassH) / 500;
  const MGN_TOP = 80 * layoutSc;
  const MGN_LEFT = 80 * layoutSc;
  const MGN_RIGHT = 100 * layoutSc;
  const MGN_BOT = 70 * layoutSc;
  const MGN_TITLE = 44 * layoutSc;

  const ox = MGN_LEFT, oy = MGN_TOP;
  const totalW = ox + glassW + MGN_RIGHT;
  const totalH = oy + glassH + MGN_BOT + MGN_TITLE;
  const ts = totalW / VIEWBOX_REF;
  const sw = (n) => n * layoutSc;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  const g = windowSpec?.glazing || {};
  const spec = [
    `×${group.panes.length} (${group.panes.join(', ')})`,
    g.makeup || '4x16x4',
    g.spec || 'toughened',
    `spacer ${g.spacerColour || 'silver'}`,
  ].join(' · ');

  // Chains include spacer cuts
  const topCuts = [0];
  geom.vBars.forEach((vb) => { topCuts.push(vb.left, vb.right); });
  topCuts.push(glassW);
  const leftCuts = [0];
  geom.hBars.forEach((hb) => { leftCuts.push(hb.top, hb.bot); });
  leftCuts.push(glassH);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* Glass unit */}
        <rect x={X(0)} y={Y(0)} width={glassW} height={glassH}
          fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />

        {/* 11mm edge seal */}
        <rect x={X(EDGE_SEAL)} y={Y(EDGE_SEAL)}
          width={glassW - 2 * EDGE_SEAL} height={glassH - 2 * EDGE_SEAL}
          fill="none" stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS}
          strokeOpacity={0.6} strokeDasharray={`${sw(5)},${sw(4)}`} />

        {/* Spacer bars (18mm on wood-bar centres) */}
        {geom.vBars.map((vb, i) => (
          <g key={`v-${i}`}>
            <line x1={X(vb.left)} y1={Y(0)} x2={X(vb.left)} y2={Y(glassH)}
              stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            <line x1={X(vb.right)} y1={Y(0)} x2={X(vb.right)} y2={Y(glassH)}
              stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
          </g>
        ))}
        {geom.hBars.map((hb, j) => (
          <g key={`h-${j}`}>
            <line x1={X(0)} y1={Y(hb.top)} x2={X(glassW)} y2={Y(hb.top)}
              stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            <line x1={X(0)} y1={Y(hb.bot)} x2={X(glassW)} y2={Y(hb.bot)}
              stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
          </g>
        ))}

        {/* Chains (only when spacers present) */}
        {geom.vBars.length > 0 && (
          <DimChainH y={oy - 24 * ts} cuts={topCuts.map(X)} extFrom={oy - 4 * ts}
            vbw={totalW} fmt={(n) => fmt(n)} />
        )}
        {geom.hBars.length > 0 && (
          <DimChainV x={ox - 24 * ts} cuts={leftCuts.map(Y)} extFrom={ox - 4 * ts}
            vbw={totalW} fmt={(n) => fmt(n)} />
        )}

        {/* Overall */}
        <DimH y={oy + glassH + 30 * ts} x1={X(0)} x2={X(glassW)} extFrom={Y(glassH)}
          label={fmt(glassW)} vbw={totalW} />
        <DimV x={ox + glassW + 34 * ts} y1={Y(0)} y2={Y(glassH)} extFrom={X(glassW)}
          label={fmt(glassH)} vbw={totalW} />

        {/* Title */}
        <TitleBlock x={totalW / 2} y={oy + glassH + MGN_BOT + MGN_TITLE * 0.35}
          title={`${fmt(glassW)} × ${fmt(glassH)} mm`} subtitle={spec} vbw={totalW} />
      </svg>
    </div>
  );
}
