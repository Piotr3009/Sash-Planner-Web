/**
 * DoorLeafDetail2D.jsx
 *
 * The door LEAVES on their own, the sheet the joiner cuts from: EVERY door
 * leaf of the door on one sheet, side by side as seen from outside (a french
 * door: the passive and the active leaf, each with its own meeting stile),
 * plus the meeting detail in plan for a french door. Same drawing system as
 * CasementLeafDetail2D: the leaf outline, the daylight, the dashed sealed unit
 * edge (the glass schedule unit, printed to 0.1 mm), glazing bars with their
 * crossings and V-notches, the opening symbol with its apex at the hinge, the
 * overall width at the TOP, the height on the RIGHT, the member chains along
 * the bottom and on the left (Piotr 06.09).
 *
 * Every number comes from derived.door (deriveDoorWindow, doors to production
 * 08.10.2026): stile faces per side (94, the meeting stile 100 with its lip),
 * the mid rail and the panel of the half-glazed and three-quarter styles, the
 * hinge centres (dimensioned to the top of the barrel, the line the joiner
 * marks), the handle height, the bolts of the passive leaf (lockType single);
 * member codes, sections and cut lengths from the cut list records of that
 * leaf; the leaf depth from the record section (61 on a triple door). Rails
 * run the full leaf width and stiles the full leaf height (the cut list), so
 * the members are read from the gap between the outline and the glass, as on
 * the casement leaf sheet.
 */
import { useMemo } from 'react';
import { DimChainH, DimChainV, DimH, DimV, TitleBlock, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import {
  NS, num, fmt, fmtGlass, safely, NoSheet, doorProfileParts, leafMemberRecords, recordText,
  sectionParts, leafGlassUnit, glassSpecText, roleName, OpeningSymbol, BarDetail, barCuts,
  HingeBarrels, HandleSymbol, doorPlan, planDetailWindows, planDetailSize, PlanDetail, idOf,
} from './doorSheetParts.jsx';

const C = { outer: COLORS.sash, rebate: COLORS.glass, bgFill: 'rgba(148,163,184,0.03)' };

function buildLeaves(windowSpec, derived) {
  const dr = derived?.door;
  if (!windowSpec || !dr) return null;
  const all = dr.leaves || [];
  const m = dr.members || {};
  if (!all.length || !(num(m.top, 0) > 0 && num(m.bottom, 0) > 0)) return null;
  const pp = doorProfileParts();
  const french = !!dr.isFrench && all.length === 2;
  const kit = dr.hardware?.kit || (french && dr.lockType === 'double' ? 'fgte' : 'thunderbolt');
  const items = all
    .map((l, i) => ({ l, i }))
    .sort((a, b) => a.l.x - b.l.x)
    .map(({ l, i }) => {
      if (!(num(l.w, 0) > 0 && num(l.h, 0) > 0)) throw new Error('leaf without size');
      return {
        l, i,
        recs: leafMemberRecords(derived, l),
        unit: leafGlassUnit(derived, i),
        panel: (dr.panels || []).find((p) => p.leaf === l.role) || null,
        handle: l.role === 'single' || l.role === 'active' || (french && kit === 'fgte'),
        bolts: french && kit !== 'fgte' && l.role === 'passive',
      };
    });
  const depth = sectionParts(items[0].recs.left?.section || items[0].recs.right?.section).depth ?? num(dr.leafDepth);
  const plan = french ? doorPlan(windowSpec, derived) : null;
  const meetWin = plan ? planDetailWindows(plan).find((w) => w.kind === 'meeting') || null : null;
  return { dr, pp, french, kit, items, depth, plan, meetWin };
}

export default function DoorLeafDetail2D({ windowSpec, derived, projectNumber , windowTag }) {
  const geom = useMemo(() => safely(() => buildLeaves(windowSpec, derived)), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const { dr, pp, french, kit, items, depth } = geom;
  const m = dr.members || {};
  const leafH = items[0].l.h;
  const sumW = items.reduce((a, it) => a + it.l.w, 0);

  // ── Layout: leaves side by side, annotations beside each ──
  const layoutSc = Math.max(sumW * 1.3, leafH) / 500;
  const ML = 110 * layoutSc;
  const GAP = 150 * layoutSc;
  const MR = 130 * layoutSc;
  const MT = 70 * layoutSc;
  const svgW = ML + sumW + GAP * (items.length - 1) + MR;
  const ts = svgW / VIEWBOX_REF;
  const oy = MT;
  const codeFs = SIZES.code * ts;
  const dash = `${6 * ts},${4 * ts}`;
  const unitDash = `${4 * ts},${3 * ts}`;
  let cursor = ML;
  const placed = items.map((it) => {
    const ox = cursor;
    cursor += it.l.w + GAP;
    return { ...it, ox, X: (x) => ox + (x - it.l.x), Y: (y) => oy + (y - it.l.y) };
  });

  // Meeting detail (plan) under the leaves of a french door
  const meet = geom.meetWin;
  const sd = meet ? (0.6 * (svgW - ML - MR)) / (meet.x1 - meet.x0) : 0;
  const meetSize = meet ? planDetailSize(meet, sd, ts) : { w: 0, h: 0 };

  // ── Title, subtitle, notes ──
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const hingeCount = (items[0].l.hinges || []).length;
  const u0 = items.find((it) => it.unit)?.unit || null;
  const rule = pp.hingeRule;
  const titleText = `Leaf Detail${french ? ', active and passive' : ''}${projNum ? ` · ${projNum}` : ''} · ${winName}`;
  const subtitleText = [
    `${items.length > 1 ? `${items.length} leaves ` : ''}${fmt(items[0].l.w)} × ${fmt(leafH)}`,
    u0 ? `glass ${fmtGlass(u0.w)} × ${fmtGlass(u0.h)}` : '',
    depth != null ? `leaf depth ${fmt(depth)}` : '',
  ].filter(Boolean).join(' · ');
  const leafBottomY = items[0].l.y + leafH;
  const handleY = num(items.find((it) => it.handle)?.l.handleY);
  const panel = items.find((it) => it.panel)?.panel || null;
  const notes = [
    [`Glass ${glassSpecText(windowSpec)}`, hingeCount ? `${hingeCount} hinges per leaf` : '', `barrel ${fmt(pp.barrel)}, set out to its top`]
      .filter(Boolean).join(' · '),
    `Hinge rule: ${num(rule.perLeaf, 0)} per leaf, ${num(rule.perLeafTall, 0)} on a leaf over ${fmt(rule.tallAbove)}`,
    handleY != null
      ? `Handle ${fmt(leafBottomY - handleY)} above the leaf bottom (${fmt(num(dr.zones?.totalHeight, leafBottomY) - handleY)} above the floor), backset ${fmt(pp.backset)}`
      : '',
    panel
      ? `Panel ${fmt(panel.thickness)}: ${fmt(num(panel.boards?.tricoya, pp.panel.boards))} × ${fmt(pp.panel.boardThickness)} Tricoya MDF + ${fmt(pp.panel.coreThickness)} MDF core, ${panel.paneling}, in the ${fmt(m.inset)} rebate`
      : '',
    french
      ? `Meeting stile ${fmt(m.meeting)} (${fmt(m.stile)} + lip ${fmt(dr.lip)}), half lapped; active leaf laps on the ${dr.zones?.meetingLap?.face || 'exterior'}`
      : '',
    french
      ? (kit === 'fgte'
        ? 'Lock: FGTE double door kit, master active leaf, slave passive leaf, shootbolts in the kit'
        : 'Lock: ThunderBolt kit on the active leaf; bolts top and bottom on the passive leaf')
      : 'Lock: ThunderBolt multipoint single door kit on the lock stile',
    'Rails run the full leaf width, stiles the full leaf height (cut list lengths)',
  ].filter(Boolean);

  const capY0 = oy + leafH + 50 * ts;          // leaf captions under the bottom chain
  const meetTop = capY0 + 46 * ts;
  const blockBottom = meet ? meetTop + meetSize.h : capY0 + 30 * ts;
  const titleY = blockBottom + 24 * ts;
  const svgH = titleY + (44 + 18 * notes.length) * ts;

  const renderLeaf = (it, idx) => {
    const { l, recs, unit, X, Y, ox } = it;
    const day = l.daylight;
    const pnl = l.panel;
    const hingeRight = l.hinge === 'right';
    const lockRight = !hingeRight;
    const lockEdgeX = lockRight ? l.x + l.w : l.x;
    const inDir = lockRight ? -1 : 1;
    const backset = l.role === 'passive' && kit === 'fgte' ? num(dr.hardware?.fgte?.slaveBackset, pp.backset) : pp.backset;
    const sideX = (right, k) => (right ? X(l.x + l.w) + (40 + 36 * k) * ts : ox - (56 + 36 * k) * ts);
    // chains: stile · bars · stile along the bottom; rails · bars · mid rail · panel on the left
    const bc = barCuts(l.bars);
    const hCuts = [l.x, l.x + l.stileL, ...bc.v.flat(), l.x + l.w - l.stileR, l.x + l.w];
    const hLabels = Array(hCuts.length - 1).fill(undefined);
    hLabels[0] = fmt(l.stileL);
    hLabels[hLabels.length - 1] = fmt(l.stileR);
    if (hLabels.length === 3) hLabels[1] = fmt(l.w - l.stileL - l.stileR);
    const vCuts = [l.y, l.y + m.top, ...bc.h.flat()];
    if (l.midRail) vCuts.push(l.midRail.y, l.midRail.y + l.midRail.face);
    vCuts.push(l.y + l.h - m.bottom, l.y + l.h);
    const vLabels = vCuts.slice(0, -1).map((c, i) => fmt(vCuts[i + 1] - c));
    const meetX = l.meetingSide === 'L' ? l.x : l.meetingSide === 'R' ? l.x + l.w : null;
    const meetFace = l.meetingSide === 'R' ? l.stileR : l.stileL;
    const boltX = meetX != null ? meetX + (l.meetingSide === 'R' ? -1 : 1) * meetFace / 2 : null;
    const stileNote = (side) => {
      if (l.meetingSide === side) return 'meeting';
      return (side === 'L') === (l.hinge === 'left') ? 'hinge' : 'lock';
    };
    const stileLabel = (rec, cx, side) => (
      <text x={cx + codeFs * 0.35} y={Y(l.y + l.h * 0.27)} fill={COLORS.label} fontSize={codeFs}
        fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
        transform={`rotate(-90, ${cx + codeFs * 0.35}, ${Y(l.y + l.h * 0.27)})`}>
        {rec ? recordText(rec, stileNote(side)) : ''}
      </text>
    );
    const railLabel = (rec, yc) => (
      <text x={X(l.x + l.w / 2)} y={Y(yc) + codeFs * 0.35} fill={COLORS.label} fontSize={codeFs}
        fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
        {rec ? recordText(rec) : ''}
      </text>
    );
    const hwText = l.role === 'single'
      ? 'handle · multipoint lock (ThunderBolt)'
      : kit === 'fgte'
        ? (l.role === 'active' ? 'handle · FGTE master' : 'handle · FGTE slave, shootbolts in the kit')
        : (l.role === 'active' ? 'handle · ThunderBolt kit' : 'bolts top and bottom');
    return (
      <g key={`leaf${idx}`}>
        {/* Outer leaf, sealed unit edge (dashed), daylight */}
        <rect x={X(l.x)} y={Y(l.y)} width={l.w} height={l.h} fill={C.bgFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
        {l.glass && l.glass.w > 0 && (
          <rect x={X(l.glass.x)} y={Y(l.glass.y)} width={l.glass.w} height={l.glass.h} fill="none"
            stroke={C.rebate} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.5} strokeDasharray={unitDash} />
        )}
        {day && day.w > 0 && day.h > 0 && (
          <rect x={X(day.x)} y={Y(day.y)} width={day.w} height={day.h} fill={COLORS.glass} fillOpacity={0.06}
            stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
        )}
        {/* Panel below the mid rail, in the same rebate as the glass */}
        {pnl && pnl.w > 0 && (
          <>
            <rect x={X(pnl.x)} y={Y(pnl.y)} width={pnl.w} height={pnl.h} fill="none"
              stroke={COLORS.sillDetail} strokeWidth={STROKES.rebate} {...NS} strokeOpacity={0.6} strokeDasharray={unitDash} />
            {pnl.daylight && (
              <rect x={X(pnl.daylight.x)} y={Y(pnl.daylight.y)} width={pnl.daylight.w} height={pnl.daylight.h}
                fill={COLORS.frameFill} stroke={C.outer} strokeWidth={STROKES.outer} {...NS} />
            )}
          </>
        )}
        <OpeningSymbol r={l} hinge={l.hinge} X={X} Y={Y} dash={dash} />
        <BarDetail day={day} bars={l.bars} X={X} Y={Y} notch={3 * ts} />

        {/* Hardware: hinges (red), handle and lock on the lock stile, bolts on the passive leaf */}
        <HingeBarrels edgeX={l.hingeEdgeX} ys={l.hinges} barrel={pp.barrel} w={2.4 * ts} X={X} Y={Y} />
        {it.handle && num(l.handleY) != null && (
          <HandleSymbol cx={X(lockEdgeX + inDir * backset)} cy={Y(l.handleY)} r={5 * ts} lever={16 * ts}
            towards={lockRight ? 'left' : 'right'} />
        )}
        {it.bolts && boltX != null && (
          <g>
            {[[Y(l.y), 1], [Y(l.y + l.h), -1]].map(([yy, dir], k) => (
              <g key={`bo${k}`}>
                <rect x={X(boltX) - 1.5 * ts} y={dir > 0 ? yy : yy - 28 * ts} width={3 * ts} height={28 * ts}
                  fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
                <text x={X(l.meetingSide === 'R' ? l.x + l.w - l.stileR : l.x + l.stileL) + (l.meetingSide === 'R' ? -4 : 4) * ts}
                  y={dir > 0 ? yy + 40 * ts : yy - 34 * ts}
                  fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY}
                  textAnchor={l.meetingSide === 'R' ? 'end' : 'start'} fontWeight={WEIGHTS.label}>BOLT</text>
              </g>
            ))}
          </g>
        )}

        {/* Member codes, sections and cut lengths on the members */}
        {stileLabel(recs.left, X(l.x + l.stileL / 2), 'L')}
        {stileLabel(recs.right, X(l.x + l.w - l.stileR / 2), 'R')}
        {railLabel(recs.top, l.y + m.top / 2)}
        {railLabel(recs.bottom, l.y + l.h - m.bottom / 2)}
        {l.midRail && railLabel(recs.mid, l.midRail.y + l.midRail.face / 2)}

        {/* Glass (the schedule unit) and panel sizes */}
        {unit && day && (
          <text x={X(day.x + day.w / 2)} y={Y(day.y + day.h * 0.3)} fill={COLORS.label} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
            {`glass ${fmtGlass(unit.w)} × ${fmtGlass(unit.h)}`}
          </text>
        )}
        {pnl?.daylight && (
          <text x={X(pnl.daylight.x + pnl.daylight.w / 2)} y={Y(pnl.daylight.y + pnl.daylight.h / 2) + codeFs * 0.35}
            fill={COLORS.label} fontSize={codeFs} fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
            {`panel ${fmtGlass(pnl.w)} × ${fmtGlass(pnl.h)}`}
          </text>
        )}

        {/* ── DIMENSIONS ── */}
        <DimH y={oy - 30 * ts} x1={X(l.x)} x2={X(l.x + l.w)} extFrom={Y(l.y)} label={fmt(l.w)} vbw={svgW} />
        <DimChainH y={oy + l.h + 24 * ts} cuts={hCuts.map(X)} extFrom={oy + l.h + 4 * ts} vbw={svgW} labels={hLabels} fmt={fmt} />
        <DimChainV x={ox - 24 * ts} cuts={vCuts.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} labels={vLabels} fmt={fmt} />
        {(l.hinges || []).map((hy, k) => (
          <DimV key={`hd${k}`} x={sideX(hingeRight, 0)} y1={Y(l.y)} y2={Y(hy - pp.barrel / 2)}
            extFrom={X(l.hingeEdgeX)} label={`H${k + 1} ${fmt(hy - pp.barrel / 2 - l.y)}`} small vbw={svgW} />
        ))}
        {it.handle && num(l.handleY) != null && (
          <DimV x={sideX(lockRight, 0)} y1={Y(l.handleY)} y2={Y(l.y + l.h)} extFrom={X(lockEdgeX)}
            label={`handle ${fmt(l.y + l.h - l.handleY)}`} small vbw={svgW} />
        )}

        {/* Caption */}
        <text x={X(l.x + l.w / 2)} y={capY0} fill={COLORS.subtitle} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
          {`${roleName(l.role).toUpperCase()}${l.role === 'single' ? '' : ' LEAF'} · hinge ${l.hinge}`}
        </text>
        <text x={X(l.x + l.w / 2)} y={capY0 + 18 * ts} fill={COLORS.subtitle} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>
          {hwText}
        </text>
      </g>
    );
  };

  const last = placed[placed.length - 1];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>
        {placed.map(renderLeaf)}

        {/* Overall height on the right of the last leaf */}
        <DimV x={last.X(last.l.x + last.l.w) + 80 * ts} y1={oy} y2={oy + leafH} extFrom={last.X(last.l.x + last.l.w)}
          label={fmt(leafH)} vbw={svgW} />

        {meet && geom.plan && (
          <PlanDetail plan={geom.plan} dr={dr} win={meet} left={(svgW - meetSize.w) / 2} top={meetTop}
            s={sd} ts={ts} vbw={svgW} clipId={idOf(windowSpec, 'clip-door-leaf-meet')} />
        )}

        <TitleBlock x={svgW / 2} y={titleY} title={titleText} subtitle={subtitleText} vbw={svgW} />
        {notes.map((t, i) => (
          <text key={`n${i}`} x={svgW / 2} y={titleY + (42 + 18 * i) * ts} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.subtitle}>{t}</text>
        ))}
        {windowTag ? <WindowTag tag={windowTag} vbw={svgW} /> : null}
      </svg>
    </div>
  );
}
