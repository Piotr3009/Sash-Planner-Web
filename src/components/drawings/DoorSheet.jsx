/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * DoorSheet.jsx: one entry of doorSheetPlan (doorDrawUtils.js) mounted as its
 * door sheet (08.10.2026, doors to production). The Drawings panel, its PDF
 * capture rig and the production pack all mount door sheets through this one
 * mapping, so a tab and its PDF page can never show different sheets.
 */
import DoorFrameDetail2D from './DoorFrameDetail2D.jsx';
import DoorLeafDetail2D from './DoorLeafDetail2D.jsx';
import DoorSidePanelDetail2D from './DoorSidePanelDetail2D.jsx';
import DoorFanlightDetail2D from './DoorFanlightDetail2D.jsx';
import DoorSection2D from './DoorSection2D.jsx';

const SHEETS = {
  frame: DoorFrameDetail2D,
  leaf: DoorLeafDetail2D,
  side: DoorSidePanelDetail2D,
  fan: DoorFanlightDetail2D,
  section: DoorSection2D,
};

export default function DoorSheet({ sheet, windowSpec, derived, projectNumber, windowTag }) {
  const Comp = SHEETS[sheet?.sheet];
  if (!Comp) return null;
  return <Comp windowSpec={windowSpec} derived={derived} projectNumber={projectNumber} windowTag={windowTag} {...(sheet.props || {})} />;
}
