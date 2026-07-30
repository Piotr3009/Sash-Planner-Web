import { useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore.js';
import { getCasementProfile } from '../../engine/profile.js';
import {
  CAD, CAD_SIZES, CAD_STROKES, CAD_DIMS, FONT_FAMILY, VIEWBOX_REF,
} from './drawingTheme.js';

/**
 * CasementDrawing2D — production elevation, EXTERIOR view (fixed convention).
 * All geometry comes from derived.casement (leafRects, mullionRuns,
 * transomRuns, paneBounds — single source: the calculation engine) plus the
 * casement profile layer model:
 *   36 land · 4 gap · LEAF · 6 · [8 | axis | 13] · 4 · LEAF · 6 · 41 cill
 * Every visual constant comes from drawingTheme (CAD block) — no locals.
 * Approved mockups: 120 reference, 021 transom, 022 full (30.07.2026).
 */

const fmt = (v) => (Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : v.toFixed(1));

function Tick({ x, y, vertical }) {
  const t = CAD_DIMS.tick;
  return vertical
    ? <line x1={x - t} y1={y} x2={x + t} y2={y} stroke={CAD.chain} strokeWidth={CAD_STROKES.chain} />
    : <line x1={x} y1={y - t} x2={x} y2={y + t} stroke={CAD.chain} strokeWidth={CAD_STROKES.chain} />;
}

function DimH({ x1, x2, y, label, labelY }) {
  return (<g>
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={CAD.dim} strokeWidth={CAD_STROKES.dim}
      markerStart="url(#cadArrow)" markerEnd="url(#cadArrow)" />
    <text x={(x1 + x2) / 2} y={labelY ?? y - 7} textAnchor="middle" fontSize={CAD_SIZES.dim}
      fill={CAD.text} fontFamily={FONT_FAMILY}>{label}</text>
  </g>);
}

function DimV({ x, y1, y2, label, labelPos }) {
  const lp = labelPos || { x, y: y1 - 6, anchor: 'middle' };
  return (<g>
    <line x1={x} y1={y1} x2={x} y2={y2} stroke={CAD.dim} strokeWidth={CAD_STROKES.dim}
      markerStart="url(#cadArrow)" markerEnd="url(#cadArrow)" />
    <text x={lp.x} y={lp.y} textAnchor={lp.anchor} fontSize={CAD_SIZES.dim}
      fill={CAD.text} fontFamily={FONT_FAMILY}>{label}</text>
  </g>);
}

export default function CasementDrawing2D({ windowSpec, derived, batch }) {
  const company = useProjectStore((s) => s.settings?.company) || {};
  const model = useMemo(() => buildModel(windowSpec, derived), [windowSpec, derived]);
  if (!model) {
    return <div className="text-ink-400 text-sm p-6">No casement drawing data.</div>;
  }
  const m = model;

  return (
    <svg viewBox={`0 0 ${VIEWBOX_REF} ${m.svgH}`} className="w-full h-auto"
      style={{ background: CAD.bg }} data-drawing="casement-elevation">
      <defs>
        <marker id="cadArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6"
          orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* Frame + land */}
      <rect x={m.X0} y={m.Y0} width={m.W} height={m.H} fill="none"
        stroke={CAD.line} strokeWidth={CAD_STROKES.frame} />
      <line x1={m.landL} y1={m.landT} x2={m.landR} y2={m.landT} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
      <line x1={m.landL} y1={m.landT} x2={m.landL} y2={m.cillTop} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
      <line x1={m.landR} y1={m.landT} x2={m.landR} y2={m.cillTop} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
      <line x1={m.X0} y1={m.cillTop} x2={m.X0 + m.W} y2={m.cillTop} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />

      {/* Mullions */}
      {m.mullions.map((mu, i) => (
        <g key={`mu${i}`}>
          <line x1={mu.x1} y1={mu.y1} x2={mu.x1} y2={mu.y2} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
          <line x1={mu.x2} y1={mu.y1} x2={mu.x2} y2={mu.y2} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
          <line x1={mu.ax} y1={m.Y0 - 8} x2={mu.ax} y2={m.YB + 6} stroke={CAD.axis}
            strokeWidth={CAD_STROKES.axis} strokeDasharray={CAD_DIMS.axisDash} />
        </g>
      ))}

      {/* Transoms — asymmetric land 8/13 around the axis */}
      {m.transoms.map((tr, i) => (
        <g key={`tr${i}`}>
          <line x1={tr.x1} y1={tr.yTop} x2={tr.x2} y2={tr.yTop} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
          <line x1={tr.x1} y1={tr.yBot} x2={tr.x2} y2={tr.yBot} stroke={CAD.line} strokeWidth={CAD_STROKES.member} />
          <line x1={m.X0 - 12} y1={tr.ay} x2={m.X0 + m.W + 12} y2={tr.ay} stroke={CAD.axis}
            strokeWidth={CAD_STROKES.axis} strokeDasharray={CAD_DIMS.axisDash} />
        </g>
      ))}

      {/* Leaves: outline, glass daylight, bars, opening symbol, label */}
      {m.leaves.map((lf, i) => (
        <g key={`lf${i}`}>
          <rect x={lf.x} y={lf.y} width={lf.w} height={lf.h} fill="none"
            stroke={CAD.leaf} strokeWidth={CAD_STROKES.leaf} />
          <rect x={lf.gx} y={lf.gy} width={lf.gw} height={lf.gh} fill="none"
            stroke={CAD.glassEdge} strokeWidth={CAD_STROKES.glassEdge} />
          {lf.barsV.map((bx, k) => (
            <line key={`v${k}`} x1={bx} y1={lf.gy} x2={bx} y2={lf.gy + lf.gh}
              stroke={CAD.bar} strokeWidth={CAD_STROKES.bar} />
          ))}
          {lf.barsH.map((by, k) => (
            <line key={`h${k}`} x1={lf.gx} y1={by} x2={lf.gx + lf.gw} y2={by}
              stroke={CAD.bar} strokeWidth={CAD_STROKES.bar} />
          ))}
          {lf.tri && (
            <path d={lf.tri} fill="none" stroke={CAD.open} strokeWidth={CAD_STROKES.open}
              strokeDasharray={CAD_DIMS.openDash} />
          )}
          <text x={lf.cx} y={lf.cy} textAnchor="middle" fontSize={CAD_SIZES.label}
            fontFamily={FONT_FAMILY} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="3"
            style={{ paintOrder: 'stroke' }}>{lf.label}</text>
          <text x={lf.cx} y={lf.cy} textAnchor="middle" fontSize={CAD_SIZES.label}
            fontFamily={FONT_FAMILY} fill={CAD.text}>{lf.label}</text>
        </g>
      ))}

      {/* Overall + horizontal member chain (top) */}
      <DimH x1={m.X0} x2={m.X0 + m.W} y={m.Y0 - 44} label={fmt(m.extW)} />
      <line x1={m.X0} y1={m.Y0 - 22} x2={m.X0 + m.W} y2={m.Y0 - 22}
        stroke={CAD.chain} strokeWidth={CAD_STROKES.chain} />
      {m.hChain.ticks.map((x, i) => <Tick key={`hct${i}`} x={x} y={m.Y0 - 22} />)}
      {m.hChain.labels.map((l, i) => (
        <text key={`hcl${i}`} x={l.x} y={l.row === 0 ? m.Y0 - 27 : m.Y0 - 11} textAnchor="middle"
          fontSize={CAD_SIZES.dim} fill={CAD.text} fontFamily={FONT_FAMILY}>{l.t}</text>
      ))}

      {/* Overall height + transom axis dims (left) */}
      <DimV x={m.X0 - 34} y1={m.Y0} y2={m.YB}
        labelPos={{ x: m.X0 - 41, y: (m.Y0 + m.YB) / 2, anchor: 'end' }} label={fmt(m.extH)} />
      {m.axisDimsV.map((a, i) => (
        <g key={`av${i}`}>
          <line x1={a.x} y1={m.Y0} x2={a.x} y2={a.y} stroke={CAD.dim} strokeWidth={CAD_STROKES.dim}
            markerStart="url(#cadArrow)" markerEnd="url(#cadArrow)" />
          <text x={a.x - 5} y={(m.Y0 + a.y) / 2 - 4} textAnchor="end" fontSize={CAD_SIZES.dim}
            fill={CAD.text} fontFamily={FONT_FAMILY}>axis</text>
          <text x={a.x - 5} y={(m.Y0 + a.y) / 2 + 9} textAnchor="end" fontSize={CAD_SIZES.dim}
            fill={CAD.text} fontFamily={FONT_FAMILY}>{fmt(a.mm)}</text>
        </g>
      ))}

      {/* Leaf heights per tier + vertical member chain (right) */}
      {m.leafHDims.map((d, i) => (
        <g key={`lh${i}`}>
          <line x1={m.X0 + m.W} y1={d.y1} x2={d.x + 4} y2={d.y1} stroke={CAD.ext} strokeWidth={CAD_STROKES.ext} />
          <line x1={m.X0 + m.W} y1={d.y2} x2={d.x + 4} y2={d.y2} stroke={CAD.ext} strokeWidth={CAD_STROKES.ext} />
          <DimV x={d.x} y1={d.y1} y2={d.y2} labelPos={d.labelPos} label={fmt(d.mm)} />
        </g>
      ))}
      <line x1={m.vChainX} y1={m.Y0} x2={m.vChainX} y2={m.YB}
        stroke={CAD.chain} strokeWidth={CAD_STROKES.chain} />
      {m.vChain.ticks.map((y, i) => <Tick key={`vct${i}`} x={m.vChainX} y={y} vertical />)}
      {m.vChain.labels.map((l, i) => (
        <text key={`vcl${i}`} x={m.vChainX + 10} y={l.y} fontSize={CAD_SIZES.dim}
          fill={CAD.text} fontFamily={FONT_FAMILY}>{l.t}</text>
      ))}

      {/* Leaf widths + mullion axis dims (bottom) */}
      {m.leafWDims.map((d, i) => (
        <g key={`lw${i}`}>
          <line x1={d.x1} y1={m.YB} x2={d.x1} y2={m.wDimY + 4} stroke={CAD.ext} strokeWidth={CAD_STROKES.ext} />
          <line x1={d.x2} y1={m.YB} x2={d.x2} y2={m.wDimY + 4} stroke={CAD.ext} strokeWidth={CAD_STROKES.ext} />
          <DimH x1={d.x1} x2={d.x2} y={m.wDimY} label={fmt(d.mm)} labelY={m.wDimY + 14} />
        </g>
      ))}
      {m.axisDimsH.map((a, i) => (
        <DimH key={`ah${i}`} x1={m.X0} x2={a.x} y={a.y} label={`axis ${fmt(a.mm)}`} labelY={a.y + 14} />
      ))}

      {/* Callouts */}
      {m.callouts.map((c, i) => (
        <g key={`co${i}`}>
          {c.fx != null && (<>
            <line x1={c.fx} y1={c.fy} x2={m.callX - 5} y2={c.y - 4} stroke={CAD.leader}
              strokeWidth={CAD_STROKES.leader} strokeDasharray={CAD_DIMS.leaderDash} />
            <circle cx={c.fx} cy={c.fy} r="1.8" fill={CAD.dim} />
          </>)}
          <text x={m.callX} y={c.y} fontSize={CAD_SIZES.callout} fontFamily={FONT_FAMILY}
            fill={c.warn ? CAD.warn : (c.muted ? CAD.textMuted : CAD.textDark)}>{c.t}</text>
        </g>
      ))}

      {/* Spec strip */}
      <line x1={20} y1={m.stripY - 14} x2={VIEWBOX_REF - 20} y2={m.stripY - 14}
        stroke={CAD.paperEdge} strokeWidth={CAD_STROKES.dim} />
      {m.strip.map((t, i) => (
        <text key={`st${i}`} x={20} y={m.stripY + i * 17} fontSize={CAD_SIZES.strip}
          fontFamily={FONT_FAMILY}
          fill={i === 0 ? CAD.textDark : (i === m.strip.length - 1 ? CAD.textFaint : CAD.textMuted)}>{t}</text>
      ))}
    </svg>
  );

  function buildModel(ws, dv) {
    const cas = dv?.casement;
    if (!ws || !dv || !cas || !cas.leafRects) return null;
    const p = getCasementProfile();
    const g = p.geometry;
    const stile = p.elements.leafStile.face;
    const extW = Number(ws.frame?.width) || 0;
    const extH = Number(ws.frame?.height) || 0;
    if (!extW || !extH) return null;

    // Fit: viewBox 700 wide, window area budget
    const ML = 100, TOP = 64;
    const budgetW = 314, budgetH = 400;
    const s = Math.min(budgetW / extW, budgetH / extH);
    const X0 = ML, Y0 = TOP;
    const W = extW * s, H = extH * s;
    const YB = Y0 + H;
    const sx = (v) => X0 + v * s;
    const sy = (v) => Y0 + v * s;

    const landT = sy(g.land);
    const landL = sx(g.land);
    const landR = sx(extW - g.land);
    const cillTop = sy(extH - g.cillVisible);

    // Members from engine runs
    const mullions = (cas.mullionRuns || []).map((mu) => ({
      x1: sx(mu.x1), x2: sx(mu.x2), ax: sx(mu.axisX),
      y1: mu.full ? landT : sy(mu.yTop), y2: mu.full ? cillTop : sy(mu.yBottom),
    }));
    const transoms = (cas.transomRuns || []).map((tr) => ({
      x1: sx(tr.x1), x2: sx(tr.x2), ay: sy(tr.axisT),
      yTop: sy(tr.bandTop), yBot: sy(tr.bandBottom),
    }));

    // Leaves — physical rects with the tiny visual gap guaranteed (≥1px)
    const minGap = 1;
    const bars = ws.casement?.bars || {};
    const leaves = cas.leafRects.map((r, i) => {
      const pn = cas.layoutDef.panels[i];
      const b = cas.paneBounds[i];
      let x = sx(r.x), y = sy(r.y);
      let x2 = sx(r.x + r.w), y2 = sy(r.y + r.h);
      const leftLine = b.leftIsJamb ? landL : sx(b.leftAxis + g.mullionLand / 2);
      const rightLine = b.rightIsJamb ? landR : sx(b.rightAxis - g.mullionLand / 2);
      const topLine = b.topIsHead ? landT : sy(b.topAxisT + g.transomLandBelow);
      const botLine = b.bottomIsCill ? cillTop : sy(b.bottomAxisT - g.transomLandAbove);
      if (x - leftLine < minGap) x = leftLine + minGap;
      if (rightLine - x2 < minGap) x2 = rightLine - minGap;
      if (y - topLine < minGap) y = topLine + minGap;
      if (botLine - y2 < minGap) y2 = botLine - minGap;
      const w = x2 - x, h = y2 - y;
      const inset = Math.max(stile * s, 4);
      const gx = x + inset, gy = y + inset, gw = w - 2 * inset, gh = h - 2 * inset;
      const role = pn._role || 'main';
      const nV = role === 'fan' ? (bars.fanV || 0) : role === 'fan2' ? (bars.fan2V || 0) : (bars.v || 0);
      const nH = role === 'fan' ? (bars.fanH || 0) : role === 'fan2' ? (bars.fan2H || 0) : (bars.h || 0);
      const barsV = Array.from({ length: nV }, (_, k) => gx + (gw * (k + 1)) / (nV + 1));
      const barsH = Array.from({ length: nH }, (_, k) => gy + (gh * (k + 1)) / (nH + 1));
      let tri = null;
      if (pn.hinge === 'left') tri = `M ${x + w} ${y} L ${x} ${y + h / 2} L ${x + w} ${y + h}`;
      if (pn.hinge === 'right') tri = `M ${x} ${y} L ${x + w} ${y + h / 2} L ${x} ${y + h}`;
      if (pn.hinge === 'top') tri = `M ${x} ${y + h} L ${x + w / 2} ${y} L ${x + w} ${y + h}`;
      const hingeTag = pn.hinge === 'fixed' ? 'fixed' : pn.hinge === 'top' ? 'top' : pn.hinge.toUpperCase()[0];
      return {
        x, y, w, h, gx, gy, gw, gh, barsV, barsH, tri,
        cx: x + w / 2, cy: y + h / 2 + 4,
        label: `P${i + 1} · ${hingeTag}`,
        i, role, bounds: b, mm: cas.leaves[i], rect: r,
      };
    });

    // Bottom tier (touches cill) sorted left→right — horizontal chain + width dims
    const bottomTier = leaves.filter((l) => l.bounds.bottomIsCill)
      .sort((a, b2) => a.rect.x - b2.rect.x);
    const hTicks = [X0, landL];
    const hLabels = [{ x: (X0 + landL) / 2, t: fmt(g.land), row: 0 }];
    bottomTier.forEach((l, idx) => {
      const lx = sx(l.rect.x), rx2 = sx(l.rect.x + l.rect.w);
      const glx = sx(l.rect.x + stile), grx = sx(l.rect.x + l.rect.w - stile);
      hTicks.push(lx, glx, grx, rx2);
      hLabels.push({ x: (lx + glx) / 2, t: fmt(stile), row: 1 });
      hLabels.push({ x: (glx + grx) / 2, t: fmt(l.mm.leafW - 2 * stile), row: 0 });
      hLabels.push({ x: (grx + rx2) / 2, t: fmt(stile), row: 1 });
      if (!l.bounds.rightIsJamb) {
        const m1 = sx(l.bounds.rightAxis - g.mullionLand / 2);
        const m2 = sx(l.bounds.rightAxis + g.mullionLand / 2);
        hTicks.push(m1, m2);
        hLabels.push({ x: (m1 + m2) / 2, t: fmt(g.mullionLand), row: 0 });
      }
    });
    hTicks.push(landR, X0 + W);
    hLabels.push({ x: (landR + X0 + W) / 2, t: fmt(g.land), row: 0 });

    // Left column (touches left jamb) sorted top→bottom — vertical chain
    const leftCol = leaves.filter((l) => l.bounds.leftIsJamb)
      .sort((a, b2) => a.rect.y - b2.rect.y);
    const vTicks = [Y0, landT];
    const vLabels = [{ y: (Y0 + landT) / 2 + 4, t: fmt(g.land) }];
    leftCol.forEach((l, idx) => {
      const ty = sy(l.rect.y), by = sy(l.rect.y + l.rect.h);
      const gty = sy(l.rect.y + stile), gby = sy(l.rect.y + l.rect.h - stile);
      vTicks.push(ty, gty, gby, by);
      vLabels.push({ y: (ty + gty) / 2 + 4, t: fmt(stile) });
      vLabels.push({ y: (gty + gby) / 2 + 4, t: fmt(l.mm.leafH - 2 * stile) });
      vLabels.push({ y: (gby + by) / 2 + 4, t: fmt(stile) });
      if (!l.bounds.bottomIsCill) {
        const b1 = sy(l.bounds.bottomAxisT - g.transomLandAbove);
        const b2y = sy(l.bounds.bottomAxisT + g.transomLandBelow);
        vTicks.push(b1, b2y);
        vLabels.push({ y: (b1 + b2y) / 2 + 4, t: fmt(g.transomLandAbove + g.transomLandBelow) });
      }
    });
    vTicks.push(cillTop, YB);
    vLabels.push({ y: (cillTop + YB) / 2 + 4, t: fmt(g.cillVisible) });

    // Leaf height dims per tier of the left column
    const lhX = X0 + W + 30;
    const leafHDims = leftCol.map((l, idx) => {
      const y1 = sy(l.rect.y), y2 = sy(l.rect.y + l.rect.h);
      const labelPos = idx === 0
        ? { x: lhX, y: y1 - 6, anchor: 'middle' }
        : { x: lhX, y: y2 + 14, anchor: 'middle' };
      return { x: lhX, y1, y2, mm: l.mm.leafH, labelPos };
    });
    const vChainX = X0 + W + 56;

    // Leaf width dims (bottom tier) + mullion axis rows
    const wDimY = YB + 20;
    const leafWDims = bottomTier.map((l) => ({
      x1: sx(l.rect.x), x2: sx(l.rect.x + l.rect.w), mm: l.mm.leafW,
    }));
    const fullMullAxes = (cas.mullionRuns || []).filter((mu) => mu.full).map((mu) => mu.axisX);
    const axisDimsH = fullMullAxes.map((ax, i) => ({
      x: sx(ax), y: wDimY + 28 + i * 22, mm: ax,
    }));

    // Transom axis dims (left, stacked)
    const axisDimsV = (cas.transomRuns || []).map((tr, i) => ({
      x: X0 - 16 - i * 14, y: sy(tr.axisT), mm: tr.axisT,
    }));

    // Callouts
    const secF = `${p.elements.frameHead.face}×${p.frameDepth}`;
    const secC = `${p.elements.frameCill.face}×${p.frameDepth}`;
    const secM = `${p.elements.mullion.face}×${p.frameDepth}`;
    const uniq = (arr) => [...new Set(arr)];
    const tierName = (l) => l.role === 'fan' ? 'fan' : l.role === 'fan2' ? 'fan2'
      : (l.bounds.topIsHead && l.bounds.bottomIsCill) ? 'leaf'
      : l.bounds.bottomIsCill ? 'main' : 'middle';
    const tierGroups = [];
    leaves.forEach((l) => {
      const key = `${tierName(l)}|${fmt(l.mm.leafW)}|${fmt(l.mm.leafH)}`;
      let grp = tierGroups.find((t) => t.key === key);
      if (!grp) { grp = { key, name: tierName(l), l, n: 0 }; tierGroups.push(grp); }
      grp.n += 1;
    });
    const callouts = [];
    const add = (t, fx, fy, opts = {}) => callouts.push({ t, fx, fy, ...opts });
    add(`C-H ${fmt(extW)} · ${secF}`, (X0 + W) / 2 + X0 / 2, Y0 + 5);
    (cas.mullionRuns || []).forEach((mu, i) => {
      if (i === 0) add(`${uniq(cas.mullionRuns.map((x) => x.code)).join(' = ')} · ${fmt(mu.length)} · ${secM}${mu.full ? '' : ' · partial'}`,
        sx(mu.axisX), (Y0 + YB) / 2 - 40, { warn: !mu.full });
    });
    (cas.transomRuns || []).forEach((tr, i) => {
      if (i === 0) add(`${uniq(cas.transomRuns.map((x) => x.code)).join(' = ')} · ${fmt(tr.length)} · ${secM}`,
        (sx(tr.x1) + sx(tr.x2)) / 2 - 30, sy(tr.axisT));
    });
    tierGroups.forEach((tg) => {
      add(`${tg.name} leaf ${tg.n > 1 ? `×${tg.n} ` : ''}${fmt(tg.l.mm.leafW)} × ${fmt(tg.l.mm.leafH)}`, tg.l.cx + tg.l.w / 4, tg.l.cy - tg.l.h / 4);
      add(`glass ${fmt(tg.l.mm.leafW - p.deductions.glass)} × ${fmt(tg.l.mm.leafH - p.deductions.glass)} · 24mm`, tg.l.cx + tg.l.w / 4, tg.l.cy + tg.l.h / 5, { muted: true });
    });
    add(`C-CILL ${fmt(extW)} · ${secC}`, (X0 + W) / 2 + X0 / 2 + 40, YB - 5);
    add('apex = hinge side', null, null, { muted: true });
    const unconfirmed = dv.components.sash.some((c) => /UNCONFIRMED/.test(c.notes || ''));
    if (unconfirmed) add('UNCONFIRMED rule on drawing — verify', null, null, { warn: true });
    const callX = vChainX + 46;
    callouts.forEach((c, i) => { c.y = Y0 + 34 + i * 24; });

    // Spec strip
    const axesTxt = [
      ...(cas.transomRuns || []).map((t) => `T ${fmt(t.axisT)}`),
      ...fullMullAxes.map((a) => `M ${fmt(a)}`),
    ].join(' · ');
    const leavesTxt = tierGroups.map((tg) =>
      `${tg.n} × ${fmt(tg.l.mm.leafW)}×${fmt(tg.l.mm.leafH)} (${tg.name})`).join(' · ');
    const compTxt = [
      `C-H ${fmt(extW)}`, `C-CILL ${fmt(extW)}`, `C-J ×2 ${fmt(extH)}`,
      ...(cas.mullionRuns || []).map((mu) => `${mu.code} ${fmt(mu.length)}`),
      ...(cas.transomRuns || []).map((tr) => `${tr.code} ${fmt(tr.length)}`),
    ].join(' · ');
    const strip = [
      `${ws.name || 'Window'} · Casement ${cas.layout} · ${fmt(extW)} × ${fmt(extH)}${axesTxt ? ` · ${axesTxt}` : ''} · exterior view`,
      `Leaves: ${leavesTxt} · Glass 24mm (4/16/4)`,
      compTxt,
      `${company.companyName || 'COMPANY NAME'} · Project ${batch?.projectNumber || '—'} · print scale`,
    ];

    const bottomContent = Math.max(
      wDimY + 28 + Math.max(0, axisDimsH.length - 0) * 22,
      Y0 + 34 + callouts.length * 24
    );
    const stripY = bottomContent + 26;
    const svgH = stripY + strip.length * 17 + 10;

    return {
      extW, extH, X0, Y0, W, H, YB,
      landT, landL, landR, cillTop,
      mullions, transoms, leaves,
      hChain: { ticks: hTicks, labels: hLabels },
      vChain: { ticks: vTicks, labels: vLabels },
      vChainX, leafHDims, leafWDims, wDimY,
      axisDimsH, axisDimsV,
      callouts, callX, strip, stripY, svgH,
    };
  }
}
