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
 * 08.10.2026, doors v3 09.10.2026): stile faces per side (94, the meeting
 * stile 100 with its lip), the mid rail and the panel of the half-glazed and
 * three-quarter styles (the panel OUTER size: daylight + 2 x the panel inset,
 * its edge profile), the hinge centres (dimensioned to the top of the barrel,
 * the line the joiner marks), the handle height, the bolts of the passive
 * leaf (lockType single), the handing (derived.door.handing: Hinge left /
 * right seen from inside, opens outward / inward); member codes, sections and
 * cut lengths from the cut list records of that leaf; the leaf depth from the
 * record section (61 on a triple door). Rails run the full leaf width and
 * stiles the full leaf height (the cut list), so the members are read from the
 * gap between the outline and the glass, as on the casement leaf sheet.
 *
 * HINGE DIMENSIONS (owner box item 14): H1 to H4 in a smaller text, each in
 * its own column beside the hinge edge (the hinge side of the leaf), so no two
 * labels can meet on any leaf height; the handle dimension takes the first
 * column on the lock side. The margins and the gap between the leaves grow
 * with the columns and the captions (in sheet text units), so nothing runs off
 * the sheet or into the next leaf.
 */
import { useMemo } from 'react';
import { DimChainH, DimChainV, DimH, DimV, TitleBlock, WindowTag } from './drawingUtils.jsx';
import { COLORS, STROKES, SIZES, FONT_FAMILY, WEIGHTS, VIEWBOX_REF } from './drawingTheme.js';
import {
  NS, num, fmt, fmtGlass, safely, NoSheet, doorProfileParts, leafMemberRecords, recordText,
  sectionParts, leafGlassUnit, glassSpecText, roleName, OpeningSymbol, BarDetail, barCuts,
  HingeBarrels, HandleSymbol, doorPlan, planDetailWindows, planDetailSize, PlanDetail, idOf,
  handingText,
} from './doorSheetParts.jsx';

const C = { outer: COLORS.sash, rebate: COLORS.glass, bgFill: 'rgba(148,163,184,0.03)' };

// Drawing layout in sheet text units (x ts), not dimensions of the door:
const HINGE_TEXT = SIZES.code;   // the hinge dimension labels: smaller than the dims (box item 14)
const COL = 20;                  // pitch of the dimension columns beside a leaf edge
const LEFT0 = 66;                // first column left of a leaf (clear of the member chain and its leader labels)
const RIGHT0 = 40;               // first column right of a leaf
const CHAR = 0.55;               // text width per character, x the font size (the collision rule of the harness)

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

/** The caption lines under one leaf: role, handing, hardware. */
function captionLines(dr, l, kit) {
  const role = `${roleName(l.role).toUpperCase()}${l.role === 'single' ? '' : ' LEAF'}`;
  const hw = l.role === 'single'
    ? 'handle · multipoint lock (ThunderBolt)'
    : kit === 'fgte'
      ? (l.role === 'active' ? 'handle · FGTE master' : 'handle · FGTE slave, shootbolts in the kit')
      : (l.role === 'active' ? 'handle · ThunderBolt kit' : 'bolts top and bottom');
  return [role, handingText(dr, l), hw].filter(Boolean);
}

export default function DoorLeafDetail2D({ windowSpec, derived, projectNumber, windowTag }) {
  const geom = useMemo(() => safely(() => buildLeaves(windowSpec, derived)), [windowSpec, derived]);
  if (!geom) return <NoSheet />;

  const { dr, pp, french, kit, items, depth } = geom;
  const m = dr.members || {};
  const leafH = items[0].l.h;
  const sumW = items.reduce((a, it) => a + it.l.w, 0);
  const codeW = CHAR * SIZES.code;     // one character of a code-size text, in text units

  // ── Columns beside each leaf: the hinges on the hinge side, the handle on the lock side ──
  const sides = items.map((it) => {
    const hingeRight = it.l.hinge === 'right';
    const nHinge = (it.l.hinges || []).length;
    const nHandle = it.handle && num(it.l.handleY) != null ? 1 : 0;
    const left = hingeRight ? nHandle : nHinge;
    const right = hingeRight ? nHinge : nHandle;
    const caption = Math.max(...captionLines(dr, it.l, kit).map((t) => t.length)) * codeW;
    return { left, right, caption };
  });
  const lastIdx = items.length - 1;
  // sheet text units a leaf needs beside it (the member chain on the left
  // with its leader labels; the dimension columns; their label width)
  const leftExt = (k) => (sides[k].left ? LEFT0 + COL * (sides[k].left - 1) + 10 : 52);
  const rightCols = (k) => (sides[k].right ? RIGHT0 + COL * (sides[k].right - 1) + 20 : 0);
  const overallOff = sides[lastIdx].right ? RIGHT0 + COL * sides[lastIdx].right + 8 : 80;
  const rightExt = (k) => (k === lastIdx ? overallOff + 26 : rightCols(k));
  // Margins: each the larger of the layout default (layoutSc) and what the
  // columns and the captions need at the sheet's text scale (solved by
  // iteration: the text scale follows the sheet width).
  const layoutSc = Math.max(sumW * 1.3, leafH) / 500;
  const needs = [
    { old: 110 * layoutSc, req: [[leftExt(0) + 10, 0], [sides[0].caption / 2 + 12, items[0].l.w / 2]] },
    ...items.slice(0, -1).map((it, k) => ({
      old: 150 * layoutSc,
      req: [[rightExt(k) + leftExt(k + 1) + 12, 0], [(sides[k].caption + sides[k + 1].caption) / 2 + 16, (it.l.w + items[k + 1].l.w) / 2]],
    })),
    { old: 130 * layoutSc, req: [[rightExt(lastIdx) + 10, 0], [sides[lastIdx].caption / 2 + 12, items[lastIdx].l.w / 2]] },
  ];
  const marginsAt = (t) => needs.map((n) => Math.max(n.old, ...n.req.map(([a, b]) => a * t - b)));
  let svgW = sumW + marginsAt(0).reduce((a, v) => a + v, 0);
  for (let k = 0; k < 30; k += 1) {
    const next = sumW + marginsAt(svgW / VIEWBOX_REF).reduce((a, v) => a + v, 0);
    if (Math.abs(next - svgW) < 1e-6) break;
    svgW = next;
  }
  const ts = svgW / VIEWBOX_REF;
  const margins = marginsAt(ts);
  const ML = margins[0];
  const MT0 = Math.max(70 * layoutSc, 64 * ts);
  const codeFs = SIZES.code * ts;
  const dash = `${6 * ts},${4 * ts}`;
  const unitDash = `${4 * ts},${3 * ts}`;

  // Meeting detail (plan) under the leaves of a french door, scaled on the
  // leaves and the layout gap (not on the dimension columns)
  const meet = geom.meetWin;
  const sd = meet ? (0.6 * (sumW + 150 * layoutSc * lastIdx)) / (meet.x1 - meet.x0) : 0;
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
  const edge = panel?.edge || null;
  const notes = [
    [`Glass ${glassSpecText(windowSpec)}`, hingeCount ? `${hingeCount} hinges per leaf` : '', `barrel ${fmt(pp.barrel)}, set out to its top`]
      .filter(Boolean).join(' · '),
    `Hinge rule: ${num(rule.perLeaf, 0)} per leaf, ${num(rule.perLeafTall, 0)} on a leaf over ${fmt(rule.tallAbove)}`,
    `Handing: ${handingText(dr)} (seen from inside)`,
    handleY != null
      ? `Handle ${fmt(leafBottomY - handleY)} above the leaf bottom (${fmt(num(dr.zones?.totalHeight, leafBottomY) - handleY)} above the floor), backset ${fmt(pp.backset)}`
      : '',
    panel
      ? `Panel ${fmt(panel.thickness)}: ${fmt(num(panel.boards?.tricoya, pp.panel.boards))} × ${fmt(pp.panel.boardThickness)} Tricoya MDF + ${fmt(pp.panel.coreThickness)} MDF core, ${panel.paneling}; panel = daylight + 2 × ${fmt(panel.inset)}`
      : '',
    panel && edge
      ? `Panel edge: tongue ${fmt(edge.tongue)}, ${fmt(panel.inset)} deep in the ${fmt(pp.glazingRebate)} glazing rebate; slope ${fmt(edge.slope)} up to ${fmt(panel.thickness)}, flat ${fmt(edge.flat)} at the bead`
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

  // Under the leaves: the captions, the meeting detail, the title and the
  // notes. The dimension rule reads the bottom chain in the lower half of the
  // sheet, so when that block is the taller one the top margin grows.
  const nCap = Math.max(...items.map((it) => captionLines(dr, it.l, kit).length));
  const below = 50 * ts + (meet ? (18 * nCap + 10) * ts + meetSize.h : (18 * nCap - 6) * ts) + 24 * ts + (44 + 18 * notes.length) * ts;
  // (the chain labels sit 18 text units under the leaf: they must lie below
  // half the sheet height, with 20 units to spare)
  const MT = Math.max(MT0, below - leafH - 36 * ts + 20 * ts);
  const oy = MT;
  const capY0 = oy + leafH + 50 * ts;          // leaf captions under the bottom chain
  const meetTop = capY0 + (18 * nCap + 10) * ts;
  const blockBottom = meet ? meetTop + meetSize.h : capY0 + (18 * nCap - 6) * ts;
  const titleY = blockBottom + 24 * ts;
  const svgH = titleY + (44 + 18 * notes.length) * ts;
  let cursor = ML;
  const placed = items.map((it, k) => {
    const ox = cursor;
    cursor += it.l.w + (k < lastIdx ? margins[k + 1] : 0);
    return { ...it, k, ox, X: (x) => ox + (x - it.l.x), Y: (y) => oy + (y - it.l.y) };
  });

  // A size text in a daylight: across when it fits the width, else along the height.
  const sizeText = (key, text, day, yAcross) => {
    const w = text.length * CHAR * codeFs;
    const cx = day.x + day.w / 2;
    if (w <= 0.9 * day.w || w > 0.9 * day.h) {
      return { key, text, cx, y: yAcross, rot: false };
    }
    return { key, text, cx, y: day.y + day.h / 2, rot: true };
  };

  const renderLeaf = (it, idx) => {
    const { l, recs, unit, X, Y, ox, k } = it;
    const day = l.daylight;
    const pnl = l.panel;
    const hingeRight = l.hinge === 'right';
    const lockRight = !hingeRight;
    const lockEdgeX = lockRight ? l.x + l.w : l.x;
    const inDir = lockRight ? -1 : 1;
    const backset = l.role === 'passive' && kit === 'fgte' ? num(dr.hardware?.fgte?.slaveBackset, pp.backset) : pp.backset;
    // column c on one side of this leaf
    const colX = (right, c) => (right ? X(l.x + l.w) + (RIGHT0 + COL * c) * ts : ox - (LEFT0 + COL * c) * ts);
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
    // Stile labels along the stile, centred on the longest glass / panel zone
    // between the rails (clear of the rail labels); a label longer than that
    // zone drops its section, then its note.
    const zones = l.midRail
      ? [[l.y + m.top, l.midRail.y], [l.midRail.y + l.midRail.face, l.y + l.h - m.bottom]]
      : [[l.y + m.top, l.y + l.h - m.bottom]];
    const zone = zones.reduce((a, z) => (z[1] - z[0] > a[1] - a[0] ? z : a), zones[0]);
    // keep clear of the handle symbol: the part of the zone above it, else below it, else the zone
    const hY = it.handle ? num(l.handleY) : null;
    const clear = 14 * ts;
    const spans = (hY != null ? [[zone[0], Math.min(zone[1], hY - clear)], [Math.max(zone[0], hY + clear), zone[1]]] : [])
      .concat([zone]).filter(([a, b]) => b > a);
    const stilePlace = (rec, note) => {
      if (!rec) return { text: '', y: Y((zone[0] + zone[1]) / 2) };
      const variants = [recordText(rec, note), recordText({ ...rec, section: '' }, note), recordText({ ...rec, section: '' })];
      for (const t of variants) {
        const span = spans.find(([a, b]) => t.length * CHAR * codeFs <= 0.95 * (b - a));
        if (span) return { text: t, y: Y((span[0] + span[1]) / 2) };
      }
      return { text: variants[variants.length - 1], y: Y((zone[0] + zone[1]) / 2) };
    };
    const stileLabel = (rec, cx, side) => {
      const { text, y } = stilePlace(rec, stileNote(side));
      return (
        <text x={cx + codeFs * 0.35} y={y} fill={COLORS.label} fontSize={codeFs}
          fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
          transform={`rotate(-90, ${cx + codeFs * 0.35}, ${y})`}>
          {text}
        </text>
      );
    };
    const railLabel = (rec, yc) => (
      <text x={X(l.x + l.w / 2)} y={Y(yc) + codeFs * 0.35} fill={COLORS.label} fontSize={codeFs}
        fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>
        {rec ? recordText(rec) : ''}
      </text>
    );
    const sizes = [
      unit && day ? sizeText('g', `glass ${fmtGlass(unit.w)} × ${fmtGlass(unit.h)}`, day, day.y + day.h * 0.3) : null,
      pnl?.daylight ? sizeText('p', `panel ${fmtGlass(pnl.w)} × ${fmtGlass(pnl.h)}`, pnl.daylight, pnl.daylight.y + pnl.daylight.h / 2) : null,
    ].filter(Boolean);
    // BOLT labels just inside the rails, at the meeting stile
    const boltTextX = X(l.meetingSide === 'R' ? l.x + l.w - l.stileR : l.x + l.stileL) + (l.meetingSide === 'R' ? -4 : 4) * ts;
    const boltTextY = [Y(l.y + m.top) + codeFs * 1.3, Y(l.y + l.h - m.bottom) - codeFs * 0.5];
    const captions = captionLines(dr, l, kit);
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
        {/* Panel below the mid rail: its outer edge (dashed) sits panel.inset deep in the glazing rebate */}
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
            {[[Y(l.y), 1], [Y(l.y + l.h), -1]].map(([yy, dir], kk) => (
              <g key={`bo${kk}`}>
                <rect x={X(boltX) - 1.5 * ts} y={dir > 0 ? yy : yy - 28 * ts} width={3 * ts} height={28 * ts}
                  fill="none" stroke={COLORS.sillDetail} strokeWidth={STROKES.sash} {...NS} />
                <text x={boltTextX} y={boltTextY[kk]}
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

        {/* Glass (the schedule unit) and panel (outer) sizes */}
        {sizes.map((t) => (t.rot ? (
          <text key={t.key} x={X(t.cx) + codeFs * 0.35} y={Y(t.y)} fill={COLORS.label} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}
            transform={`rotate(-90, ${X(t.cx) + codeFs * 0.35}, ${Y(t.y)})`}>{t.text}</text>
        ) : (
          <text key={t.key} x={X(t.cx)} y={Y(t.y) + (t.key === 'p' ? codeFs * 0.35 : 0)} fill={COLORS.label} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={WEIGHTS.label}>{t.text}</text>
        )))}

        {/* ── DIMENSIONS ── */}
        <DimH y={oy - 30 * ts} x1={X(l.x)} x2={X(l.x + l.w)} extFrom={Y(l.y)} label={fmt(l.w)} vbw={svgW} />
        <DimChainH y={oy + l.h + 24 * ts} cuts={hCuts.map(X)} extFrom={oy + l.h + 4 * ts} vbw={svgW} labels={hLabels} fmt={fmt} />
        <DimChainV x={ox - 24 * ts} cuts={vCuts.map(Y)} extFrom={ox - 4 * ts} vbw={svgW} labels={vLabels} fmt={fmt} />
        {/* hinge dims: one column each on the hinge side, the smaller text (box item 14) */}
        {(l.hinges || []).map((hy, c) => (
          <DimV key={`hd${c}`} x={colX(hingeRight, c)} y1={Y(l.y)} y2={Y(hy - pp.barrel / 2)}
            extFrom={X(l.hingeEdgeX)} label={`H${c + 1} ${fmt(hy - pp.barrel / 2 - l.y)}`} textSize={HINGE_TEXT} vbw={svgW} />
        ))}
        {it.handle && num(l.handleY) != null && (
          <DimV x={colX(lockRight, 0)} y1={Y(l.handleY)} y2={Y(l.y + l.h)} extFrom={X(lockEdgeX)}
            label={`handle ${fmt(l.y + l.h - l.handleY)}`} small vbw={svgW} />
        )}
        {k === lastIdx && (
          <DimV x={X(l.x + l.w) + overallOff * ts} y1={oy} y2={oy + leafH} extFrom={X(l.x + l.w)}
            label={fmt(leafH)} vbw={svgW} />
        )}

        {/* Caption: role, handing (seen from inside), hardware */}
        {captions.map((t, c) => (
          <text key={`cap${c}`} x={X(l.x + l.w / 2)} y={capY0 + 18 * c * ts} fill={COLORS.subtitle} fontSize={codeFs}
            fontFamily={FONT_FAMILY} textAnchor="middle" fontWeight={c === 0 ? WEIGHTS.label : WEIGHTS.subtitle}>
            {t}
          </text>
        ))}
      </g>
    );
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto" style={{ background: COLORS.bg }}>
        {placed.map(renderLeaf)}

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
