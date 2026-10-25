/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * PartitionSheet.jsx (25.10.2026): one entry of partitionSheetPlan
 * (partitionDrawUtils.js) mounted as its sheet, the DoorSheet pattern: the
 * Drawings panel, its PDF capture rig and the production pack all mount the
 * partition sheets through this one mapping.
 */
import PartitionLeaf2D from './PartitionLeaf2D.jsx';
import PartitionMember2D from './PartitionMember2D.jsx';
import PartitionSection2D from './PartitionSection2D.jsx';

const SHEETS = {
  leaf: PartitionLeaf2D,
  member: PartitionMember2D,
  section: PartitionSection2D,
};

export default function PartitionSheet({ sheet, windowSpec, derived, projectNumber, windowTag }) {
  const Comp = SHEETS[sheet?.sheet];
  if (!Comp) return null;
  return <Comp windowSpec={windowSpec} derived={derived} projectNumber={projectNumber} windowTag={windowTag} {...(sheet.props || {})} />;
}
