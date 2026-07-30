/**
 * casementDrawUtils.js — shared helpers for the casement 2D drawings
 * (same drawing system as sash: drawingTheme + drawingUtils).
 */

export function casementRoleName(leaf, bounds) {
  if (leaf === 'fan') return 'Fan';
  if (leaf === 'fan2') return 'Fan 2';
  if (bounds?.topIsHead && bounds?.bottomIsCill) return 'Leaf';
  if (bounds?.bottomIsCill) return 'Main';
  if (bounds?.topIsHead) return 'Fan';
  return 'Middle';
}

/** Unique leaf types (role + size) → one detail drawing per group. */
export function groupCasementLeaves(derived) {
  const cas = derived?.casement;
  if (!cas?.leaves) return [];
  const groups = [];
  cas.leaves.forEach((mm, i) => {
    const pn = cas.layoutDef.panels[i];
    const b = cas.paneBounds?.[i];
    const role = casementRoleName(pn._role, b);
    const key = `${role}|${mm.leafW}|${mm.leafH}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, role, rep: i, panes: [], leafW: mm.leafW, leafH: mm.leafH };
      groups.push(g);
    }
    g.panes.push({ index: i, hinge: pn.hinge });
  });
  return groups;
}

/** Bar counts for a pane role from windowSpec.casement.bars. */
export function casementBarCounts(bars, role) {
  const b = bars || {};
  if (role === 'fan') return { v: b.fanV || 0, h: b.fanH || 0 };
  if (role === 'fan2') return { v: b.fan2V || 0, h: b.fan2H || 0 };
  return { v: b.v || 0, h: b.h || 0 };
}

export function paneTitle(group) {
  const list = group.panes.map((p) => `P${p.index + 1}`).join(', ');
  return group.panes.length > 1 ? `${group.role} ×${group.panes.length} (${list})` : `${group.role} — ${list}`;
}
