/**
 * CasementGlassDrawing2D.jsx
 *
 * Production drawing of a casement sealed glass unit — same drawing system
 * and factory content as the sash GlassDrawing2D: glass outline, 11mm edge
 * seal, 18mm spacer bars on the wood-bar centre lines, chain + overall
 * dimensions. One drawing per UNIQUE glass size; the pane list (P1, P2…)
 * goes in the title. Unit = leaf − 109 (glass enters 12.5 into the rebate),
 * so the unit origin sits at stile − 12.5 in leaf coordinates.
 *
 * Arched casement (arched-casement-v2 night 4, spec §4 D + E): the unit IS
 * derived.arch.glassOutline — the SAME ArcChain the glazier DXF cuts — with
 * the 11 mm edge seal as a concentric offset, the spacer bars as 18 mm bands
 * on the engine bar axes (derived.arch.bars), dims for the springing, the
 * rise and every glass radius, and a number at every bar end that lies on a
 * curve (E: the glazier cannot measure those from a chain). Rectangular units
 * take the branch below unchanged (byte-identical, verify/arch/t19.mjs).
 */
import { useMemo } from 'react';
import { getCasementProfile } from '../../engine/profile.js';
import { offsetArcs } from '../../engine/arch.js';
import { DimChainH, DimChainV, DimH, DimV, TitleBlock, tfs } from './drawingUtils.jsx';
import { COLORS, FONT_FAMILY, SIZES, WEIGHTS, STROKES, VIEWBOX_REF } from './drawingTheme.js';
import { casementBarCounts } from './casementDrawUtils.js';
import { glassToSheet, archedOutlineD, barBandD, arcLabelPoint, barArcLabelPoint, isHaunchArc, radiiText, onCurve } from './archDrawUtils.js';

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
    // ── Arched unit: outline, seal, bars from derived.arch (glass frame, y up) ──
    const A = derived.arch;
    if (A?.geometry && A.glassOutline && idx === 0) {
      const O = A.glassOutline;
      const xg = O.width / 2, ys = O.springing;
      // 11 mm seal = the glass chain offset concentrically (arch frame), then moved into the glass frame
      const seal = offsetArcs(A.geometry.glass.arcs, EDGE_SEAL).map((a) => ({ ...a, cx: a.cx + xg, cy: a.cy + ys }));
      const bars = A.bars || [];
      const isH = (b) => b.kind === 'straight' && Math.abs(b.from[1] - b.to[1]) < 1e-6 && (b.role === 'h' || b.role === 'springing');
      const isV = (b) => b.kind === 'straight' && b.role === 'v' && Math.abs(b.from[0] - b.to[0]) < 1e-6;
      const vList = [...new Set(bars.filter(isV).map((b) => b.from[0]))].sort((a, b) => a - b)
        .map((cx) => ({ cx, left: cx - SPACER / 2, right: cx + SPACER / 2 }));
      const hList = [...new Set(bars.filter(isH).map((b) => b.from[1]))].sort((a, b) => b - a)
        .map((y) => { const cy = O.height - y; return { cy, top: cy - SPACER / 2, bot: cy + SPACER / 2 }; });
      return { glassW: O.width, glassH: O.height, vBars: [], hBars: [], arch: { outline: O, seal, bars, vList, hList, label: A.geometry.label } };
    }
    return { glassW, glassH, vBars, hBars };
  }, [windowSpec, derived, group]);

  if (!geom) return <div className="text-ink-400 text-sm p-8 text-center">No data.</div>;

  const { glassW, glassH } = geom;
  const layoutSc = Math.max(glassW, glassH) / 500;
  const MGN_TOP = 80 * layoutSc;
  const MGN_LEFT = 80 * layoutSc;
  const MGN_RIGHT = 100 * layoutSc;
  const MGN_BOT = 70 * layoutSc;
  const MGN_TITLE = (geom.arch ? 70 : 44) * layoutSc;   // arched: third title line

  const ox = MGN_LEFT, oy = MGN_TOP;
  const totalW = ox + glassW + MGN_RIGHT;
  const totalH = oy + glassH + MGN_BOT + MGN_TITLE;
  const ts = totalW / VIEWBOX_REF;
  const sw = (n) => n * layoutSc;
  const X = (x) => ox + x;
  const Y = (y) => oy + y;

  const g = windowSpec?.glazing || {};
  const isFrosted = group.finish === 'frosted';
  const patternId = `frost-cas-${String(group.key).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const spec = [
    `×${group.panes.length} (${group.panes.join(', ')})`,
    g.makeup || '4x16x4',
    g.spec || 'toughened',
    ...(isFrosted ? ['frosted'] : []),
    `spacer ${g.spacerColour || 'silver'}`,
  ].join(' · ');

  // Chains include spacer cuts (arched: the engine's straight bars)
  const arch = geom.arch;
  const vBarsDim = arch ? arch.vList : geom.vBars;
  const hBarsDim = arch ? arch.hList : geom.hBars;
  const topCuts = [0];
  vBarsDim.forEach((vb) => { topCuts.push(vb.left, vb.right); });
  topCuts.push(glassW);
  const leftCuts = [0];
  hBarsDim.forEach((hb) => { leftCuts.push(hb.top, hb.bot); });
  leftCuts.push(glassH);

  // ── Arched paths (sheet coords, glass frame → y down) ──
  let AP = null;
  if (arch) {
    const O = arch.outline;
    const txG = glassToSheet(X(0), Y(0), glassH);
    const dir = (b) => { const d = [b.to[0] - b.from[0], b.to[1] - b.from[1]]; const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
    const endLabels = [];
    for (const b of arch.bars) {
      if (b.kind === 'straight') {
        if (!onCurve(b.to, O)) continue;
        const u = dir(b);
        const vertical = Math.abs(u[0]) < 1e-6;
        // vertical bar: the x is on the top chain — print the height of the top end beside the bar;
        // any other bar (spoke): both numbers, set back along the bar
        const back = vertical ? sw(56) : sw(34);
        const at = txG(b.to[0] - u[0] * back + (vertical ? sw(6) : 0), b.to[1] - u[1] * back);
        endLabels.push({ at, anchor: vertical ? 'start' : 'middle', text: vertical ? `${b.id} ${fmt(b.to[1])}` : `${b.id} ${fmt(b.to[0])} · ${fmt(b.to[1])}` });
      } else {
        const inward = b.role === 'ring' ? -sw(12) : sw(12);
        endLabels.push({ at: barArcLabelPoint(b.arc, txG, O.width / 2, inward), anchor: 'middle', text: `${b.id} R ${fmt(b.arc.r)}` });
        // a tracery arc meets the outline at ONE end — the other end sits on the springing line
        for (const e of [b.from, b.to]) {
          if (!onCurve(e, O)) continue;
          // outside the outline, away from the axis (the glass interior is busy with the tracery)
          endLabels.push({ at: txG(e[0] + (e[0] < O.width / 2 ? -sw(18) : sw(18)), e[1] + sw(12)), anchor: 'middle', text: `${fmt(e[0])} · ${fmt(e[1])}` });
        }
      }
    }
    AP = {
      unitD: archedOutlineD(O.arcs, txG, Y(glassH)),
      sealD: archedOutlineD(arch.seal, txG, Y(glassH - EDGE_SEAL)),
      barsD: arch.bars.map((b) => barBandD(b, txG, SPACER / 2)),
      radii: O.arcs.map((a) => ({ r: a.r, at: isHaunchArc(a) ? arcLabelPoint(a, txG, sw(10)) : arcLabelPoint(a, txG, -sw(16)) })),
      springY: Y(glassH - O.springing),
      endLabels,
    };
  }
  const annFs = tfs(SIZES.dimSmall, totalW);
  const endFs = tfs(SIZES.notch, totalW);
  const archLine = arch ? `${arch.label} · springing ${fmt(arch.outline.springing)} · rise ${fmt(arch.outline.rise)} · ${radiiText(arch.outline.arcs)} · ${arch.bars.length} bars` : '';
  const titleY = oy + glassH + MGN_BOT + MGN_TITLE * 0.35;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}
        data-arch-origin={AP ? `${ox},${oy}` : undefined}>

        {/* Frosted hatch pattern — same fine diagonals as the sash drawing */}
        <defs>
          <pattern id={patternId} width={14 * layoutSc} height={14 * layoutSc}
            patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={14 * layoutSc}
              stroke={COLORS.glass} strokeWidth={0.5} {...NS} strokeOpacity={0.45} />
          </pattern>
        </defs>

        {AP ? (
          <>
            {/* Glass unit = the glazier's outline; 11mm seal concentric to it */}
            <path d={AP.unitD} fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
              stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />
            <path d={AP.sealD} fill="none" stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS}
              strokeOpacity={0.6} strokeDasharray={`${sw(5)},${sw(4)}`} />
            {isFrosted && <path d={AP.sealD} fill={`url(#${patternId})`} stroke="none" />}
            {/* Spacer bars (18mm) on the engine bar axes — straight bands and exact arcs */}
            {AP.barsD.map((d, k) => (
              <path key={`ab-${k}`} d={d} fill="none" stroke={COLORS.bar} strokeWidth={STROKES.bar} {...NS} />
            ))}
          </>
        ) : (
          <>
        {/* Glass unit */}
        <rect x={X(0)} y={Y(0)} width={glassW} height={glassH}
          fill={COLORS.glass} fillOpacity={COLORS.glassOpacity}
          stroke={COLORS.glass} strokeWidth={STROKES.glass} {...NS} />

        {/* 11mm edge seal */}
        <rect x={X(EDGE_SEAL)} y={Y(EDGE_SEAL)}
          width={glassW - 2 * EDGE_SEAL} height={glassH - 2 * EDGE_SEAL}
          fill="none" stroke={COLORS.glass} strokeWidth={STROKES.glassLight} {...NS}
          strokeOpacity={0.6} strokeDasharray={`${sw(5)},${sw(4)}`} />

        {/* Frosted hatch overlay — inside edge seal, drawn under bars */}
        {isFrosted && (
          <rect x={X(EDGE_SEAL)} y={Y(EDGE_SEAL)}
            width={glassW - 2 * EDGE_SEAL} height={glassH - 2 * EDGE_SEAL}
            fill={`url(#${patternId})`} stroke="none" />
        )}
          </>
        )}

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
        {vBarsDim.length > 0 && (
          <DimChainH y={oy - 24 * ts} cuts={topCuts.map(X)} extFrom={oy - 4 * ts}
            vbw={totalW} fmt={(n) => fmt(n)} />
        )}
        {hBarsDim.length > 0 && (
          <DimChainV x={ox - 24 * ts} cuts={leftCuts.map(Y)} extFrom={ox - 4 * ts}
            vbw={totalW} fmt={(n) => fmt(n)} />
        )}

        {/* Arched: springing line, springing / rise dims, glass radii, bar ends on the curve (E) */}
        {AP && (
          <g>
            <line x1={X(0) - sw(10)} y1={AP.springY} x2={X(glassW) + sw(10)} y2={AP.springY}
              stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS}
              strokeDasharray={`${sw(8)},${sw(3)},${sw(2)},${sw(3)}`} />
            <DimV x={ox + glassW + 34 * ts} y1={AP.springY} y2={Y(glassH)} extFrom={X(glassW)}
              label={`springing ${fmt(arch.outline.springing)}`} small vbw={totalW} />
            <DimV x={ox + glassW + 34 * ts} y1={Y(0)} y2={AP.springY} extFrom={X(glassW)}
              label={`rise ${fmt(arch.outline.rise)}`} small vbw={totalW} />
            {AP.radii.map((rl, k) => (
              <text key={`r-${k}`} x={rl.at[0]} y={rl.at[1]} fill={COLORS.dim} fontSize={annFs}
                fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.dim}>{`R ${fmt(rl.r)}`}</text>
            ))}
            {AP.endLabels.map((el, k) => (
              <text key={`e-${k}`} x={el.at[0]} y={el.at[1]} fill={COLORS.dim} fontSize={endFs}
                fontFamily={FONT_FAMILY} textAnchor={el.anchor} fontWeight={WEIGHTS.dim}>{el.text}</text>
            ))}
          </g>
        )}

        {/* Overall */}
        <DimH y={oy + glassH + 30 * ts} x1={X(0)} x2={X(glassW)} extFrom={Y(glassH)}
          label={fmt(glassW)} vbw={totalW} />
        <DimV x={ox + glassW + (AP ? 74 : 34) * ts} y1={Y(0)} y2={Y(glassH)} extFrom={X(glassW)}
          label={fmt(glassH)} vbw={totalW} />

        {/* Title */}
        <TitleBlock x={totalW / 2} y={titleY}
          title={`${fmt(glassW)} × ${fmt(glassH)} mm${AP ? ' · arched' : ''}`} subtitle={spec} vbw={totalW} />
        {arch && (
          <text x={totalW / 2} y={titleY + 40 * ts} fill={COLORS.subtitle} fontSize={SIZES.subtitle * ts}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{archLine}</text>
        )}
      </svg>
    </div>
  );
}
