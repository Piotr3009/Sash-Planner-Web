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

/**
 * Effective glass finish for ONE casement pane. Frosted scope: 'bottom' =
 * main lights only (fans stay clear), 'both' = every pane. SINGLE SOURCE of
 * the rule — engine glass rows (lists.js), the on-screen glass drawing and
 * the 3D viewer must all call this, never re-implement it.
 */
export function casementPaneFinish(role, glazing) {
  const gz = glazing || {};
  if (gz.finish !== 'frosted') return gz.finish || 'clear';
  const isFan = role === 'fan' || role === 'fan2';
  if (isFan && (gz.frostedLocation || 'bottom') === 'bottom') return 'clear';
  return 'frosted';
}

export function paneTitle(group) {
  const list = group.panes.map((p) => `P${p.index + 1}`).join(', ');
  return group.panes.length > 1 ? `${group.role} ×${group.panes.length} (${list})` : `${group.role} — ${list}`;
}

/** Unique glass sizes → one factory drawing per size; pane labels listed.
 *  Finish is part of the identity: a frosted 611×307 and a clear 611×307 are
 *  DIFFERENT factory units and get separate drawings — mirroring the order
 *  table, which lists them as separate rows. */
export function groupCasementGlass(derived, windowSpec) {
  const cas = derived?.casement;
  if (!cas?.leaves) return [];
  const groups = [];
  cas.leaves.forEach((mm, i) => {
    const pn = cas.layoutDef.panels[i];
    const u = derived.customGlassUnits?.[i];
    const w = u?.width, h = u?.height;
    if (!w || !h) return;
    const finish = casementPaneFinish(u.role || pn._role || 'main', windowSpec?.glazing);
    const key = `${w}x${h}|${finish}`;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, w, h, finish, rep: i, panes: [] }; groups.push(g); }
    g.panes.push(`P${i + 1} ${pn.hinge === 'fixed' ? 'fixed' : pn.hinge}`);
  });
  return groups;
}
