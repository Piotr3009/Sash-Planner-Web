/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorSidePanelDetail2D.jsx: the FIXED side panel leaf of a door (left or
 * right), the sheet the joiner cuts it from (08.10.2026, doors to production).
 * The leaf sits in its own frame of the assembly, coupled to the door by the
 * coupling post; its members are all one section (derived.door.panelLeaves
 * member, 57) and it never opens. Drawn the casement leaf way: outline, the
 * dashed sealed unit edge (the glass schedule unit), daylight, the glazing
 * bars of the side panel spec with their crossings and V-notches, member codes
 * and cut lengths from the cut list records (D-SP-*, notes 'panel <side>').
 */
import { useMemo } from 'react';
import {
  num, fmt, fmtGlass, safely, NoSheet, doorRecords, recordText, sectionParts,
  sidePanelGlassUnit, glassSpecText, LeafSheet,
} from './doorSheetParts.jsx';

function buildSidePanel(windowSpec, derived, side) {
  const dr = derived?.door;
  if (!windowSpec || !dr) return null;
  const list = dr.panelLeaves || [];
  const i = list.findIndex((p) => p.side === side);
  if (i < 0) return { none: true };
  const pn = list[i];
  if (!(num(pn.w, 0) > 0 && num(pn.h, 0) > 0 && num(pn.member, 0) > 0)) return null;
  const recs = doorRecords(derived).filter((r) => String(r.code || '').startsWith('D-SP-') && String(r.notes || '') === `panel ${side}`);
  const by = (c) => recs.find((r) => r.code === c) || null;
  return {
    pn, unit: sidePanelGlassUnit(derived, i),
    stile: by('D-SP-ST'), top: by('D-SP-TR'), bottom: by('D-SP-BR'),
  };
}

export default function DoorSidePanelDetail2D({ windowSpec, derived, projectNumber, side = 'left', windowTag }) {
  const geom = useMemo(() => safely(() => buildSidePanel(windowSpec, derived, side)), [windowSpec, derived, side]);
  if (geom?.none) return <NoSheet text="No side panel." />;
  if (!geom) return <NoSheet />;

  const { pn, unit, stile, top, bottom } = geom;
  const depth = sectionParts(stile?.section).depth;
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
    'fixed leaf',
  ].filter(Boolean).join(' · ');
  const bars = pn.bars?.counts || {};
  const notes = [
    `Members ${fmt(pn.member)}${depth != null ? `×${fmt(depth)}` : ''} all round, the glass in the ${fmt(derived.door.members?.inset)} rebate`,
    (num(bars.v, 0) || num(bars.h, 0)) ? `Glazing bars: ${num(bars.v, 0)} vertical, ${num(bars.h, 0)} horizontal (side panel spec)` : '',
    'Coupled to the door frame by the coupling post; never opens',
  ].filter(Boolean);

  return (
    <LeafSheet
      windowTag={windowTag}
      leaf={pn}
      faces={{ left: pn.member, right: pn.member, top: pn.member, bottom: pn.member }}
      hinge="fixed"
      labels={labels}
      title={`Side Panel ${sideName}${projNum ? ` · ${projNum}` : ''} · ${winName}`}
      subtitle={subtitle}
      notes={notes}
    />
  );
}
