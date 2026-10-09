/**
 * DoorSection2D.jsx
 *
 * The PLAN view of the door (a horizontal section, looking down, the outside
 * at the bottom), the view that shows what the workshop needs here (Piotr
 * 05.08): which way the door swings and, on a french door, how the two leaves
 * meet and which leaf opens first (active vs passive).
 *
 * Top: the whole assembly to scale: the frame jambs (face x frame depth) with
 * the leaf rebate, the casement mullions between the door and its side lights
 * (doors v3: 68 x 93, one rebate each side of the land), the door leaves (leaf
 * depth) with their stiles and the glass unit, the french meeting stiles half
 * lapped where the leaves overlap (the active leaf on zones.meetingLap.face),
 * the side lights (casement fixed lights, their stiles), and the swing of
 * every door leaf: a quarter arc to the outside (outward) or the inside
 * (inward), the open leaf drawn at 90 degrees, ACTIVE / PASSIVE labelled.
 * Below: enlarged details of the jamb, the meeting stiles and the mullion with
 * their dimensions (land, gap, rebate, stile, the meeting stile with its lip,
 * the mullion rebates and land, the depths), and on a half-glazed or three
 * quarter door the PANEL EDGE: the tongue in the glazing rebate, the flat at
 * the bead and the slope up to the full panel (derived panel edge, an owner
 * check assumption).
 *
 * Every number comes from derived.door (members, zones, leaves, mullions,
 * panels, handing, thresholdInfo, frameDepth, leafDepth), the door profile
 * (the glazing rebate) and the glazing thickness of the window; the plan
 * geometry is doorPlan() of doorSheetParts (one source with the leaf sheet's
 * meeting detail). The profile carries no rebate depth: the rebate is drawn as
 * deep as the leaf (the leaf flush with the face it opens to) and the glass
 * centred in the leaf depth (a diagram of the build, not a profile drawing).
 */
import { useMemo } from 'react';
import { DimH, DimV, DimChainH, TitleBlock, Label, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import { displayCode } from '../../engine/partSymbols.js';
import {
  NS, num, fmt, safely, NoSheet, doorPlan, PlanBody, planDetailWindows, planDetailSize, PlanDetail,
  glassSpecText, idOf, handingText, doorProfileParts,
} from './doorSheetParts.jsx';

/**
 * The panel edge profile in plan at the leaf stile (doors v3, owner box item
 * 8): x from the daylight edge (0) into the panel, z through the leaf depth;
 * the panel centred on the leaf depth like the glass. Points of the panel
 * section: the tongue from -inset to the flat, the slope up to the full
 * thickness, a run of the full panel (drawing extent).
 */
function panelEdgeGeom(dr, pp) {
  const pn = (dr.panels || [])[0];
  const e = pn?.edge;
  const ld = num(dr.leafDepth);
  const inset = num(pn?.inset);
  const t = num(e?.tongue), slope = num(e?.slope), flat = num(e?.flat), full = num(pn?.thickness);
  const stile = num(dr.members?.stile);
  const reb = num(pp.glazingRebate);
  if (![ld, inset, t, slope, flat, full, stile, reb].every((v) => v != null && v > 0)) return null;
  const zc = ld / 2;
  const xEnd = flat + slope + slope / 2;             // drawing extent of the full panel
  const panel = [
    [-inset, zc - t / 2], [flat, zc - t / 2], [flat + slope, zc - full / 2], [xEnd, zc - full / 2],
    [xEnd, zc + full / 2], [flat + slope, zc + full / 2], [flat, zc + t / 2], [-inset, zc + t / 2],
  ];
  // the stile in section with the glazing rebate the tongue sits in (a slot, schematic)
  const stilePts = [
    [-stile, 0], [0, 0], [0, zc - t / 2], [-reb, zc - t / 2], [-reb, zc + t / 2], [0, zc + t / 2], [0, ld], [-stile, ld],
  ];
  return { ld, inset, t, slope, flat, full, stile, reb, zc, xEnd, panel, stilePts, x0: -stile, x1: xEnd, pad: ld * 0.2 };
}

export default function DoorSection2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => {
    const plan = doorPlan(windowSpec, derived);
    if (!plan) return null;
    return { plan, details: planDetailWindows(plan), edge: panelEdgeGeom(derived.door, doorProfileParts()) };
  }), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const dr = derived.door;
  const m = dr.members || {};
  const { plan, details, edge } = geom;
  const { W, fd } = plan;
  const leaves = [...plan.leaves].sort((a, b) => a.x0 - b.x0);
  const maxLeafW = Math.max(0, ...leaves.map((l) => l.leaf.w));

  // ── Layout: sheet units of the 700 reference (ts = 1); the plan scaled to fit ──
  const svgW = VIEWBOX_REF;
  const ts = svgW / VIEWBOX_REF;
  const ML = 90, MR = 70;
  const sp = (svgW - ML - MR) / W;               // plan scale, sheet units per mm
  const arcH = maxLeafW * sp;
  const inward = plan.inward;
  // details: up to two per row, one scale for all; each keeps EXTRA sheet
  // units beside it for its depth dimensions (left of a right jamb, else right)
  const GAPD = 40, EXTRA = 64;
  const avail = svgW - 40;
  const rows = [];
  details.forEach((d, i) => { if (i % 2 === 0) rows.push([d]); else rows[rows.length - 1].push(d); });
  const rowScale = (r) => (avail - GAPD * (r.length - 1) - EXTRA * r.length) / r.reduce((a, d) => a + (d.x1 - d.x0), 0);
  const sd = details.length ? Math.min(2, ...rows.map(rowScale)) : 0;
  const se = edge ? Math.min(1.8, (avail - 2 * EXTRA) / (edge.x1 - edge.x0)) : 0;
  // The whole layout from the top of the plan band; the dimension rule reads
  // the detail chains in the lower half of the sheet, so when the details and
  // the notes are the taller part the sheet starts lower (top pad).
  const layout = (top) => {
    const bandTop = top + (inward ? arcH + 18 : 0);
    const bandBottom = bandTop + fd * sp;
    const planBottom = bandBottom + (inward ? 0 : arcH) + 30;
    let y = planBottom + 10;
    let firstDimY = null;
    const placedRows = rows.map((r) => {
      const sizes = r.map((d) => planDetailSize(d, sd, ts));
      const rowW = sizes.reduce((a, sz) => a + sz.w, 0) + (GAPD + EXTRA) * r.length - GAPD;
      let x = (svgW - rowW) / 2;
      const items = r.map((d, k) => {
        const dimsLeft = d.kind === 'jamb' && d.side === 'right';
        const it = { d, left: x + (dimsLeft ? EXTRA : 0), top: y };
        // its first chain row: under the clipped window (planDetailSize / PlanDetail)
        const dimY = y + 22 * ts + (d.z1 - d.z0) * sd + 18 * ts;
        firstDimY = firstDimY == null ? dimY : Math.min(firstDimY, dimY);
        x += sizes[k].w + EXTRA + GAPD;
        return it;
      });
      y += Math.max(...sizes.map((sz) => sz.h)) + 16;
      return items;
    });
    // panel edge detail (its own row, its own scale: a small part)
    let edgeBox = null;
    if (edge) {
      const w = (edge.x1 - edge.x0) * se;
      const capH = 22 * ts;
      const h = capH + (edge.ld + 2 * edge.pad) * se + (14 + 26 * 2) * ts;
      edgeBox = { se, w, h, left: (svgW - w) / 2 - EXTRA / 2, top: y, capH };
      const dimY = y + capH + (edge.ld + 2 * edge.pad) * se + 18 * ts;
      firstDimY = firstDimY == null ? dimY : Math.min(firstDimY, dimY);
      y += h + 16;
    }
    return { top, bandTop, bandBottom, planBottom, placedRows, edgeBox, detailsBottom: y, firstDimY };
  };
  // ── Title and notes ──
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const french = !!plan.meeting;
  const handing = handingText(dr);
  const mullCodes = plan.members.filter((mb) => mb.kind === 'mullion').map((mb) => displayCode(mb.code)).filter(Boolean);
  const titleText = `Plan Section${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = `${french ? 'French door' : 'Single door'} · ${handing} · plan, outside below`;
  const ti = dr.thresholdInfo || null;
  const sp0 = plan.panels[0] || null;
  const notes = [
    `Frame ${fmt(m.frameJamb)}×${fmt(fd)}, land ${fmt(m.land)}, rebate ${fmt(m.rebate)} on the ${inward ? 'interior' : 'exterior'}; leaf ${fmt(plan.ld)}, gap ${fmt(m.gap)}; glass ${glassSpecText(windowSpec)}`,
    french
      ? `Meeting stiles ${fmt(m.meeting)}, lip ${fmt(dr.lip)} past the centre line, half lapped; active leaf on the ${plan.meeting.lapFace}`
      : '',
    mullCodes.length
      ? `Mullion ${mullCodes.join(', ')} ${fmt(plan.fM)}×${fmt(fd)}: rebate ${fmt(plan.mReb)} each side of the land ${fmt(plan.mLand)}, the leaf ${fmt(plan.mLand / 2)} + gap ${fmt(m.gap)} from the axis`
      : '',
    sp0
      ? `Side light${plan.panels.length > 1 ? 's' : ''}: casement fixed light${plan.panels.length > 1 ? 's' : ''}, stiles ${fmt(sp0.stile)}×${fmt(sp0.z1 - sp0.z0)} in the exterior rebate, never open${plan.panels.length > 1 ? '' : 's'}`
      : '',
    edge
      ? `Panel edge: tongue ${fmt(edge.t)}, ${fmt(edge.inset)} deep in the ${fmt(edge.reb)} glazing rebate; flat ${fmt(edge.flat)} at the bead, slope ${fmt(edge.slope)} up to ${fmt(edge.full)}`
      : '',
    ti?.ignored && ti.note ? `Threshold: ${ti.note} (the stored ${ti.type} threshold is not used)` : '',
    'Rebate drawn as deep as the leaf (flush with the face it opens to), glass centred in the leaf',
  ].filter(Boolean);
  const tail = 20 + 44 + 18 * notes.length;          // the title block under the details
  const L0 = layout(64);                               // the overall width sits above the plan
  const pad = L0.firstDimY != null ? Math.max(0, (L0.detailsBottom + tail) - 2 * L0.firstDimY + 20) : 0;
  const { top, bandTop, bandBottom, placedRows, edgeBox, detailsBottom } = pad > 0 ? layout(64 + pad) : L0;
  const T = { ox: ML, oy: bandTop, s: sp, x0: 0 };
  const PX = (x) => T.ox + x * sp;
  const PZ = (z) => T.oy + (fd - z) * sp;
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

  // ── Panel edge detail drawing ──
  const renderEdge = () => {
    if (!edge || !edgeBox) return null;
    const { se, left, capH } = edgeBox;
    const top0 = edgeBox.top;
    const EX = (x) => left + (x - edge.x0) * se;
    const EZ = (z) => top0 + capH + (edge.ld + edge.pad - z) * se;
    const poly = (pts) => `M ${pts.map(([x, z]) => `${EX(x)} ${EZ(z)}`).join(' L ')} Z`;
    const winBottom = EZ(-edge.pad);
    const row = (k) => winBottom + (24 + 26 * k) * ts;
    const ext = winBottom + 4 * ts;
    const zLo = edge.zc - edge.full / 2;
    return (
      <g>
        <text x={EX(edge.x0)} y={top0 + codeFs} fill={COLORS.subtitle} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="start" fontWeight={WEIGHTS.label}>PANEL EDGE (plan at the panel)</text>
        <path d={poly(edge.stilePts)} fill={COLORS.sectionFill} fillOpacity={0.08} stroke={COLORS.sash} strokeWidth={STROKES.sash} {...NS} />
        <path d={poly(edge.panel)} fill={COLORS.sectionFill} fillOpacity={0.16} stroke={COLORS.frame} strokeWidth={STROKES.section} {...NS} />
        {/* the daylight edge */}
        <line x1={EX(0)} y1={EZ(edge.ld + edge.pad)} x2={EX(0)} y2={EZ(-edge.pad)}
          stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray="6,4" />
        <DimChainH y={row(0)} cuts={[-edge.inset, 0, edge.flat, edge.flat + edge.slope].map(EX)} extFrom={ext} vbw={svgW}
          minSegment={0} labels={[fmt(edge.inset), fmt(edge.flat), fmt(edge.slope)]} />
        <DimH y={row(1)} x1={EX(-edge.reb)} x2={EX(0)} extFrom={ext} label={`rebate ${fmt(edge.reb)}`} small vbw={svgW} />
        <DimV x={EX(edge.x1) + 14 * ts} y1={EZ(edge.zc + edge.t / 2)} y2={EZ(edge.zc - edge.t / 2)} extFrom={EX(edge.flat)}
          label={`tongue ${fmt(edge.t)}`} small vbw={svgW} />
        <DimV x={EX(edge.x1) + 40 * ts} y1={EZ(zLo + edge.full)} y2={EZ(zLo)} extFrom={EX(edge.x1)}
          label={fmt(edge.full)} small vbw={svgW} />
      </g>
    );
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>

        {/* ── The plan to scale ── */}
        <PlanBody plan={plan} T={T} />

        {/* Mullion axes */}
        {plan.members.filter((mb) => mb.kind === 'mullion').map((mb, i) => (
          <line key={`ma${i}`} x1={PX(mb.axis)} y1={bandTop - 10} x2={PX(mb.axis)} y2={bandBottom + 10}
            stroke={COLORS.meeting} strokeWidth={STROKES.center} {...NS} strokeDasharray="8,3,2,3" />
        ))}

        {/* Swing arcs and the open leaves */}
        {swings.map((s, i) => (
          <g key={`sw${i}`}>
            <path d={`M ${s.closeX} ${s.cy} A ${s.r} ${s.r} 0 0 ${s.sweep} ${s.cx} ${s.openY}`}
              fill="none" stroke={COLORS.meeting} strokeWidth={STROKES.meeting} {...NS} strokeDasharray="6,4" />
            <rect x={s.openRect.x} y={s.openRect.y} width={s.openRect.w} height={s.openRect.h}
              fill="none" stroke={COLORS.sash} strokeWidth={STROKES.sashLight} {...NS} />
            <Label x={s.cx + (s.l.hinge === 'left' ? 1 : -1) * (s.r * 0.45)} y={s.labelY + (inward ? -4 : 8)}
              text={s.l.role === 'single' ? 'LEAF' : s.l.role.toUpperCase()} vbw={svgW} />
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
        {renderEdge()}

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
