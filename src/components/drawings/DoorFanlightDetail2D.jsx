/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorFanlightDetail2D.jsx: one fan leaf over a door or a side panel
 * (08.10.2026, doors to production; doors v3 09.10.2026, owner box items 2
 * and 7), derived.door.fanLeaves[index]:
 *   opening  a casement top hung leaf built with the casement profile values
 *            (stiles and top rail 64, bottom rail 67): the top hung symbol
 *            (apex at the middle of the top edge), member codes and cut
 *            lengths from the cut list records (D-FS / D-FTR / D-FBR of this
 *            fan) and the casement hinge and lock picks of the fan
 *            (derived.door.hardware.fan, indexed among the OPENING fans);
 *   fixed    a non-opening casement leaf of the same size (fixedFan 64 / 64 /
 *            67, records D-FFS / D-FFTR / D-FFBR): no opening symbol, no
 *            hardware.
 * Both drawn the casement leaf way: outline, the dashed sealed unit edge (the
 * glass schedule unit, the casement glass rule), daylight and bars.
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
  const all = dr.fanLeaves || [];
  const fl = all[index];
  if (!fl) return { none: true };
  const mb = fl.members || {};
  if (!(num(fl.w, 0) > 0 && num(fl.h, 0) > 0 && num(mb.stile, 0) > 0 && num(mb.top, 0) > 0 && num(mb.bottom, 0) > 0)) return null;
  const fixed = !!fl.fixed;
  // the records of THIS fan: their notes start with where it sits ('fan over door · top hung' / '... · fixed')
  const where = `fan over ${fl.over}${fl.side ? ` ${fl.side}` : ''} · ${fixed ? 'fixed' : 'top hung'}`;
  const prefix = fixed ? 'D-FF' : 'D-F';
  const recs = doorRecords(derived).filter((r) => String(r.code || '').startsWith(prefix) && String(r.notes || '').startsWith(where));
  const by = (c) => recs.find((r) => r.code === c) || null;
  // the casement picks run over the OPENING fans only, in fanLeaves order
  const openIndex = all.slice(0, index).filter((f) => !f.fixed).length;
  const fan = fixed ? null : (dr.hardware?.fan || null);
  const hingePick = fan?.hingePicks?.[openIndex] || null;
  const lockPick = fan?.lockPicks?.[openIndex] || null;
  const slotName = (list, id) => clean(list.find((sl) => sl.id === id)?.name || id || '');
  return {
    fl, fixed, unit: fanLeafGlassUnit(derived, index),
    stileL: by(`${prefix}S/L`), stileR: by(`${prefix}S/R`), top: by(`${prefix}TR`), bottom: by(`${prefix}BR`),
    hinge: hingePick ? `${slotName(CASEMENT_HINGE_SLOTS, hingePick.slotId)}${hingePick.overLimit ? ' (! verify limits)' : ''}` : '',
    lock: lockPick ? `${slotName(CASEMENT_LOCK_SLOTS, lockPick.slotId)}${lockPick.overLimit ? ' (! verify size)' : ''}` : '',
  };
}

export default function DoorFanlightDetail2D({ windowSpec, derived, projectNumber, index = 0, windowTag }) {
  const geom = useMemo(() => safely(() => buildFan(windowSpec, derived, index)), [windowSpec, derived, index]);
  if (geom?.none) return <NoSheet text="No fanlight." />;
  if (!geom) return <NoSheet />;

  const { fl, unit, fixed } = geom;
  const mb = fl.members;
  const winName = windowSpec?.name || 'Door';
  const projNum = projectNumber || '';
  const over = `over the ${fl.over === 'door' ? 'door' : `${fl.side || ''} side panel`.replace(/\s+/g, ' ').trim()}`;
  const labels = [
    { place: 'left', text: recordText(geom.stileL) },
    { place: 'right', text: recordText(geom.stileR) },
    { place: 'top', text: recordText(geom.top, fixed ? '' : 'hinge') },
    { place: 'bottom', text: recordText(geom.bottom, fixed ? '' : 'lock') },
  ];
  const subtitle = [
    `${fmt(fl.w)} × ${fmt(fl.h)}`,
    unit ? `glass ${fmtGlass(unit.w)} × ${fmtGlass(unit.h)}` : '',
    glassSpecText(windowSpec),
    fixed ? 'fixed' : 'top hung',
  ].filter(Boolean).join(' · ');
  const glass = fl.glass || {};
  const notes = [
    `${fixed ? 'Fixed casement leaf (non-opening)' : 'Casement leaf, top hung'} ${over}`,
    `Stiles ${fmt(mb.stile)}, top rail ${fmt(mb.top)}, bottom rail ${fmt(mb.bottom)}, depth ${fmt(mb.depth)}`,
    num(glass.w, 0) > 0
      ? `Glass: leaf less ${fmt(fl.w - glass.w)} wide, less ${fmt(fl.h - glass.h)} high (casement rule)`
      : '',
    fixed ? 'Fixed fanlight: never opens, no hardware' : '',
    !fixed && geom.hinge ? `Hinges: ${geom.hinge}${num(fl.weightKg) != null ? ` · leaf ${fmtGlass(fl.weightKg)} kg` : ''}` : '',
    !fixed && geom.lock ? `Lock: ${geom.lock}` : '',
  ].filter(Boolean);
  const many = (derived.door.fanLeaves || []).length > 1;

  return (
    <LeafSheet
      windowTag={windowTag}
      leaf={fl}
      faces={{ left: mb.stile, right: mb.stile, top: mb.top, bottom: mb.bottom }}
      hinge={fixed ? 'fixed' : 'top'}
      labels={labels}
      title={`${fixed ? 'Fixed Fanlight' : 'Fanlight Leaf'}${many ? ` ${index + 1}` : ''}${projNum ? ` · ${projNum}` : ''} · ${winName}`}
      subtitle={subtitle}
      notes={notes}
    />
  );
}
