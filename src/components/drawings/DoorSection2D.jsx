/**
 * DoorSection2D.jsx
 *
 * The PLAN view of the door (a horizontal section, looking down, the outside
 * at the bottom), the view that shows what the workshop needs here (Piotr
 * 05.08): which way the door swings and, on a french door, how the two leaves
 * meet and which leaf opens first (active vs passive).
 *
 * Top: the whole assembly to scale: the frame jambs (face x frame depth) with
 * the leaf rebate, the coupling posts of the side panels (ONE member, two
 * rebates), the door leaves (leaf depth) with their stiles and the glass unit,
 * the french meeting stiles half lapped where the leaves overlap (the active
 * leaf on zones.meetingLap.face), the fixed side panel leaves, and the swing
 * of every door leaf: a quarter arc to the outside (outward) or the inside
 * (inward), the open leaf drawn at 90 degrees, ACTIVE / PASSIVE labelled.
 * Below: enlarged details of the jamb, the meeting stiles and the coupling
 * post with their dimensions (land, gap, rebate, stile, the meeting stile with
 * its lip, the depths).
 *
 * Every number comes from derived.door (members, zones, leaves, frameDepth,
 * leafDepth) and the glazing thickness of the window; the plan geometry is
 * doorPlan() of doorSheetParts (one source with the leaf sheet's meeting
 * detail). The profile carries no rebate depth: the rebate is drawn as deep as
 * the leaf (the leaf flush with the face it opens to) and the glass centred in
 * the leaf depth (a diagram of the build, not a profile drawing).
 */
import { useMemo } from 'react';
import { DimH, DimV, TitleBlock, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import {
  NS, fmt, safely, NoSheet, doorPlan, PlanBody, planDetailWindows, planDetailSize, PlanDetail,
  glassSpecText, idOf,
} from './doorSheetParts.jsx';

export default function DoorSection2D({ windowSpec, derived, projectNumber , windowTag }) {
  const geom = useMemo(() => safely(() => {
    const plan = doorPlan(windowSpec, derived);
    if (!plan) return null;
    return { plan, details: planDetailWindows(plan) };
  }), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const dr = derived.door;
  const m = dr.members || {};
  const { plan, details } = geom;
  const { W, fd } = plan;
  const leaves = [...plan.leaves].sort((a, b) => a.x0 - b.x0);
  const maxLeafW = Math.max(0, ...leaves.map((l) => l.leaf.w));

  // ── Layout: sheet units of the 700 reference (ts = 1); the plan scaled to fit ──
  const svgW = VIEWBOX_REF;
  const ts = svgW / VIEWBOX_REF;
  const ML = 90, MR = 70;
  const sp = (svgW - ML - MR) / W;               // plan scale, sheet units per mm
  const arcH = maxLeafW * sp;
  const top = 64;                                // the overall width sits above
  const inward = plan.inward;
  const bandTop = top + (inward ? arcH + 18 : 0);
  const T = { ox: ML, oy: bandTop, s: sp, x0: 0 };
  const PX = (x) => T.ox + x * sp;
  const PZ = (z) => T.oy + (fd - z) * sp;
  const bandBottom = PZ(0);
  const planBottom = bandBottom + (inward ? 0 : arcH) + 30;

  // details: up to two per row, one scale for all; each keeps EXTRA sheet
  // units beside it for its depth dimensions (left of a right jamb, else right)
  const GAPD = 40, EXTRA = 64;
  const avail = svgW - 40;
  const rows = [];
  details.forEach((d, i) => { if (i % 2 === 0) rows.push([d]); else rows[rows.length - 1].push(d); });
  const rowScale = (r) => (avail - GAPD * (r.length - 1) - EXTRA * r.length) / r.reduce((a, d) => a + (d.x1 - d.x0), 0);
  const sd = details.length ? Math.min(2, ...rows.map(rowScale)) : 0;
  let y = planBottom + 10;
  const placedRows = rows.map((r) => {
    const sizes = r.map((d) => planDetailSize(d, sd, ts));
    const rowW = sizes.reduce((a, sz) => a + sz.w, 0) + (GAPD + EXTRA) * r.length - GAPD;
    let x = (svgW - rowW) / 2;
    const items = r.map((d, k) => {
      const dimsLeft = d.kind === 'jamb' && d.side === 'right';
      const it = { d, left: x + (dimsLeft ? EXTRA : 0), top: y };
      x += sizes[k].w + EXTRA + GAPD;
      return it;
    });
    y += Math.max(...sizes.map((sz) => sz.h)) + 16;
    return items;
  });
  const detailsBottom = y;

  // ── Title and notes ──
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const french = !!plan.meeting;
  const titleText = `Plan Section${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `${french ? 'French door' : 'Single door'} · ${inward ? 'inward' : 'outward'} · open ${windowSpec?.door?.hingeSide || 'left'} · view from above, outside at the bottom`;
  const notes = [
    `Frame ${fmt(m.frameJamb)}×${fmt(fd)}, land ${fmt(m.land)}, rebate ${fmt(m.rebate)} on the ${inward ? 'interior' : 'exterior'}; leaf ${fmt(plan.ld)}, gap ${fmt(m.gap)}; glass ${glassSpecText(windowSpec)}`,
    french
      ? `Meeting stiles ${fmt(m.meeting)}, lip ${fmt(dr.lip)} past the centre line, half lapped; active leaf on the ${plan.meeting.lapFace}`
      : '',
    plan.panels.length ? `Side panels: fixed leaves ${fmt(m.side)}×${fmt(plan.spDepth)}, coupling post ${fmt(m.post)}×${fmt(fd)} with two rebates` : '',
    'Rebate drawn as deep as the leaf (flush with the face it opens to), glass centred in the leaf',
  ].filter(Boolean);
  const titleY = detailsBottom + 20;
  const svgH = titleY + 44 + 18 * notes.length;
  const codeFs = SIZES.code * ts;

  // ── Swing of each door leaf: open at 90 degrees to the face it opens to ──
  const swings = leaves.map((pl) => {
    const l = pl.leaf;
    const hx = l.hingeEdgeX;
    const zFace = inward ? fd : 0;
    const dirZ = inward ? 1 : -1;                // the side the leaf swings to
    const dirX = l.hinge === 'left' ? 1 : -1;    // from the hinge towards the closing edge
    const r = l.w * sp;
    const cx = PX(hx), cy = PZ(zFace);
    const closeX = PX(hx + dirX * l.w);
    const openY = PZ(zFace + dirZ * l.w);
    const sweep = (l.hinge === 'left') === !inward ? 1 : 0;
    const leafT = plan.ld * sp;
    const openRect = {
      x: dirX > 0 ? cx : cx - leafT, y: Math.min(cy, openY), w: leafT, h: Math.abs(openY - cy),
    };
    return { l, cx, cy, r, closeX, openY, sweep, openRect, labelY: (cy + openY) / 2 };
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── The plan to scale ── */}
        <PlanBody plan={plan} T={T} />

        {/* Swing arcs and the open leaves */}
        {swings.map((s, i) => (
          <g key={`sw${i}`}>
            <path d={`M ${s.closeX} ${s.cy} A ${s.r} ${s.r} 0 0 ${s.sweep} ${s.cx} ${s.openY}`}
              fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS} strokeDasharray="6,4" />
            <rect x={s.openRect.x} y={s.openRect.y} width={s.openRect.w} height={s.openRect.h}
              fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} />
            <Label x={s.cx + (s.l.hinge === 'left' ? 1 : -1) * (s.r * 0.45)} y={s.labelY + (inward ? -4 : 8)}
              text={s.l.role === 'single' ? `LEAF · hinge ${s.l.hinge}` : `${s.l.role.toUpperCase()} · hinge ${s.l.hinge}`} vbw={svgW} />
          </g>
        ))}

        {/* French centre line */}
        {french && (
          <line x1={PX(plan.meeting.x)} y1={bandTop - 10} x2={PX(plan.meeting.x)} y2={bandBottom + 10}
            stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray="8,3,2,3" />
        )}

        {/* Inside / outside */}
        <text x={ML - 8} y={bandTop + codeFs * 0.4} fill={COLORS.subtitle} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.label}>INSIDE</text>
        <text x={ML - 8} y={bandBottom + codeFs * 0.4} fill={COLORS.subtitle} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="end" fontWeight={WEIGHTS.label}>OUTSIDE</text>

        {/* Overall width at the top, the depth on the right */}
        <DimH y={top - 30} x1={PX(0)} x2={PX(W)} extFrom={bandTop} label={fmt(W)} vbw={svgW} />
        <DimV x={PX(W) + 30} y1={bandTop} y2={bandBottom} extFrom={PX(W)} label={fmt(fd)} vbw={svgW} />

        {/* ── Details ── */}
        {placedRows.flat().map((it, i) => (
          <PlanDetail key={`d${i}`} plan={plan} dr={dr} win={it.d} left={it.left} top={it.top}
            s={sd} ts={ts} vbw={svgW} clipId={idOf(windowSpec, `clip-door-sec-${i}`)} />
        ))}

        {/* ── Title + notes ── */}
        <TitleBlock x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + 42 + 18 * i} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
