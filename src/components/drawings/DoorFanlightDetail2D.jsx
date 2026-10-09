/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorFanlightDetail2D.jsx: one OPENING fan leaf over a door or a side panel
 * (08.10.2026, doors to production, owner box item 11): a casement top hung
 * leaf built with the casement profile values (stiles and top rail 64, bottom
 * rail 67, derived.door.fanLeaves[i].members). Drawn the casement leaf way:
 * outline, the dashed sealed unit edge (the glass schedule unit), daylight,
 * bars, the top hung symbol (apex at the middle of the top edge), member codes
 * and cut lengths from the cut list records (D-FS / D-FTR / D-FBR of this fan),
 * and the casement hinge and lock picks of the fan (derived.door.hardware.fan).
 * A fixed fanlight is glazed into the frame and has no leaf sheet.
 */
import { useMemo } from 'react';
import { CASEMENT_HINGE_SLOTS, CASEMENT_LOCK_SLOTS } from '../../engine/casementHardware.js';
import {
  num, fmt, fmtGlass, clean, safely, NoSheet, doorRecords, recordText,
  fanLeafGlassUnit, glassSpecText, LeafSheet,
} from './doorSheetParts.jsx';

function buildFan(windowSpec, derived, index) {
  const dr = derived?.door;
  if (!windowSpec || !dr) return null;
  const fl = (dr.fanLeaves || [])[index];
  if (!fl) return { none: true };
  const mb = fl.members || {};
  if (!(num(fl.w, 0) > 0 && num(fl.h, 0) > 0 && num(mb.stile, 0) > 0 && num(mb.top, 0) > 0 && num(mb.bottom, 0) > 0)) return null;
  // the records of THIS fan: their notes start with where it sits ('fan over door · top hung')
  const where = `fan over ${fl.over}${fl.side ? ` ${fl.side}` : ''} ·`;
  const recs = doorRecords(derived).filter((r) => String(r.code || '').startsWith('D-F') && String(r.notes || '').startsWith(where));
  const by = (c) => recs.find((r) => r.code === c) || null;
  const fan = dr.hardware?.fan || null;
  const hingePick = fan?.hingePicks?.[index] || null;
  const lockPick = fan?.lockPicks?.[index] || null;
  const slotName = (list, id) => clean(list.find((sl) => sl.id === id)?.name || id || '');
  return {
    fl, unit: fanLeafGlassUnit(derived, index),
    stileL: by('D-FS/L'), stileR: by('D-FS/R'), top: by('D-FTR'), bottom: by('D-FBR'),
    hinge: hingePick ? `${slotName(CASEMENT_HINGE_SLOTS, hingePick.slotId)}${hingePick.overLimit ? ' (! verify limits)' : ''}` : '',
    lock: lockPick ? `${slotName(CASEMENT_LOCK_SLOTS, lockPick.slotId)}${lockPick.overLimit ? ' (! verify size)' : ''}` : '',
  };
}

export default function DoorFanlightDetail2D({ windowSpec, derived, projectNumber, index = 0, windowTag }) {
  const geom = useMemo(() => safely(() => buildFan(windowSpec, derived, index)), [windowSpec, derived, index]);
  if (geom?.none) return <NoSheet text="No opening fanlight." />;
  if (!geom) return <NoSheet />;

  const { fl, unit } = geom;
  const mb = fl.members;
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const over = `over the ${fl.over === 'door' ? 'door' : `${fl.side || ''} side panel`.replace(/\s+/g, ' ').trim()}`;
  const labels = [
    { place: 'left', text: recordText(geom.stileL) },
    { place: 'right', text: recordText(geom.stileR) },
    { place: 'top', text: recordText(geom.top, 'hinge') },
    { place: 'bottom', text: recordText(geom.bottom, 'lock') },
  ];
  const subtitle = [
    `${fmt(fl.w)} × ${fmt(fl.h)}`,
    unit ? `glass ${fmtGlass(unit.w)} × ${fmtGlass(unit.h)}` : '',
    glassSpecText(windowSpec),
    'top hung',
  ].filter(Boolean).join(' · ');
  const notes = [
    `Casement leaf: stiles ${fmt(mb.stile)}, top rail ${fmt(mb.top)}, bottom rail ${fmt(mb.bottom)}, depth ${fmt(mb.depth)}; ${over}`,
    geom.hinge ? `Hinges: ${geom.hinge}${num(fl.weightKg) != null ? ` · leaf ${fmtGlass(fl.weightKg)} kg` : ''}` : '',
    geom.lock ? `Lock: ${geom.lock}` : '',
  ].filter(Boolean);

  return (
    <LeafSheet
      windowTag={windowTag}
      leaf={fl}
      faces={{ left: mb.stile, right: mb.stile, top: mb.top, bottom: mb.bottom }}
      hinge="top"
      labels={labels}
      title={`Fanlight Leaf${(derived.door.fanLeaves || []).length > 1 ? ` ${index + 1}` : ''}${projNum ? ` · ${projNum}` : ''} · ${winName}`}
      subtitle={subtitle}
      notes={notes}
    />
  );
}
