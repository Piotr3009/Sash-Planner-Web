/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * FireDoorSheet.jsx (27.10.2026, fire doors v1): one entry of
 * fireDoorSheetPlan (fireDoorDrawUtils.js) mounted as its sheet, the
 * PartitionSheet pattern: the Drawings panel, its PDF capture rig and the
 * production pack all mount the fire door sheets through this one mapping.
 * The entry's `sheet` names the component ('outside', 'inside', 'plan',
 * 'leaf', 'frame'); an entry that carries only its key ('fdoutside', ...)
 * maps the same way.
 */
import FireDoorElevation2D from './FireDoorElevation2D.jsx';
import FireDoorPlan2D from './FireDoorPlan2D.jsx';
import FireDoorLeaf2D from './FireDoorLeaf2D.jsx';
import FireDoorFrame2D from './FireDoorFrame2D.jsx';

const SHEETS = {
  outside: FireDoorElevation2D,
  inside: FireDoorElevation2D,
  plan: FireDoorPlan2D,
  leaf: FireDoorLeaf2D,
  frame: FireDoorFrame2D,
};

export default function FireDoorSheet({ sheet, windowSpec, derived, projectNumber, windowTag }) {
  const kind = sheet?.sheet || String(sheet?.key || '').replace(/^fd/, '');
  const Comp = SHEETS[kind];
  if (!Comp) return null;
  const extra = kind === 'outside' || kind === 'inside' ? { view: kind } : {};
  return <Comp windowSpec={windowSpec} derived={derived} projectNumber={projectNumber} windowTag={windowTag} {...extra} {...(sheet.props || {})} />;
}
