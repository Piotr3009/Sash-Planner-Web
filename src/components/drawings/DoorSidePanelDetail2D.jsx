/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorSidePanelDetail2D.jsx: the side panel of a door (left or right), the
 * sheet the joiner cuts it from (08.10.2026, doors to production; doors v3
 * 09.10.2026, owner box item 5). The side panel is a casement FIXED light
 * behind the mullion: a non-opening leaf with stiles and top rail 64 and the
 * door bottom rail 180 (so its line meets the door bottom rail), depth 57
 * (derived.door.panelLeaves[i].members); no hardware. Drawn the casement leaf
 * way: outline, the dashed sealed unit edge (the glass schedule unit, the
 * casement glass rule), daylight, the glazing bars of the side panel spec with
 * their crossings and V-notches, member codes and cut lengths from the cut
 * list records (D-SP-*, notes 'panel <side> · fixed light').
 */
import { useMemo } from 'react';
import {
  num, fmt, fmtGlass, safely, NoSheet, doorRecords, recordText,
  sidePanelGlassUnit, glassSpecText, LeafSheet,
} from './doorSheetParts.jsx';

function buildSidePanel(windowSpec, derived, side) {
  const dr = derived?.door;
  if (!windowSpec || !dr) return null;
  const list = dr.panelLeaves || [];
  const i = list.findIndex((p) => p.side === side);
  if (i < 0) return { none: true };
  const pn = list[i];
  const mb = pn.members || {};
  if (!(num(pn.w, 0) > 0 && num(pn.h, 0) > 0 && num(mb.stile, 0) > 0 && num(mb.top, 0) > 0 && num(mb.bottom, 0) > 0)) return null;
  // the records of THIS light: their notes start with where it sits ('panel left · fixed light')
  const where = `panel ${side}`;
  const recs = doorRecords(derived).filter((r) => String(r.code || '').startsWith('D-SP-')
    && (String(r.notes || '') === where || String(r.notes || '').startsWith(`${where} ·`)));
  const by = (c) => recs.find((r) => r.code === c) || null;
  return {
    pn, mb, unit: sidePanelGlassUnit(derived, i),
    stile: by('D-SP-ST'), top: by('D-SP-TR'), bottom: by('D-SP-BR'),
    // the mullion on the door side of the light: at the zone's inner edge (the zone runs from the outer frame edge to the axis)
    mullion: (dr.mullions || []).find((mu) => pn.zone && Math.abs(mu.axisX - (side === 'left' ? pn.zone.x + pn.zone.w : pn.zone.x)) < 0.01) || null,
  };
}

export default function DoorSidePanelDetail2D({ windowSpec, derived, projectNumber, side = 'left', windowTag }) {
  const geom = useMemo(() => safely(() => buildSidePanel(windowSpec, derived, side)), [windowSpec, derived, side]);
  if (geom?.none) return <NoSheet text="No side panel." />;
  if (!geom) return <NoSheet />;

  const { pn, mb, unit, stile, top, bottom } = geom;
  const sideName = side === 'right' ? 'Right' : 'Left';
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const stileText = stile ? recordText({ ...stile, code: `${stile.code} ×${stile.quantity || 2}` }) : '';
  const labels = [
    { place: 'left', text: stileText },
    { place: 'right', text: stileText },
    { place: 'top', text: recordText(top) },
    { place: 'bottom', text: recordText(bottom) },
  ];
  const subtitle = [
    `${fmt(pn.w)} × ${fmt(pn.h)}`,
    unit ? `glass ${fmtGlass(unit.w)} × ${fmtGlass(unit.h)}` : '',
    glassSpecText(windowSpec),
    'fixed light',
  ].filter(Boolean).join(' · ');
  const bars = pn.bars?.counts || {};
  const mu = geom.mullion;
  const glass = pn.glass || {};
  const notes = [
    `Casement fixed light: stiles ${fmt(mb.stile)}, top rail ${fmt(mb.top)}, bottom rail ${fmt(mb.bottom)} as the door, depth ${fmt(mb.depth)}`,
    num(glass.w, 0) > 0
      ? `Glass in the ${fmt(derived.door.members?.inset)} rebate: light less ${fmt(pn.w - glass.w)} wide, less ${fmt(pn.h - glass.h)} high (casement rule)`
      : '',
    (num(bars.v, 0) || num(bars.h, 0)) ? `Glazing bars: ${num(bars.v, 0)} vertical, ${num(bars.h, 0)} horizontal (side panel spec)` : '',
    `Fixed light behind the ${mu ? `mullion ${mu.code.replace(/^D-/, '')}` : 'mullion'}: never opens, no hardware`,
  ].filter(Boolean);

  return (
    <LeafSheet
      windowTag={windowTag}
      leaf={pn}
      faces={{ left: mb.stile, right: mb.stile, top: mb.top, bottom: mb.bottom }}
      hinge="fixed"
      labels={labels}
      title={`Side Panel ${sideName}${projNum ? ` · ${projNum}` : ''} · ${winName}`}
      subtitle={subtitle}
      notes={notes}
    />
  );
}
