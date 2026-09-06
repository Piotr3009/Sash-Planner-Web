/**
 * dimRule.mjs — the dimension placement rule (Piotr 06.09, night 7 stage 2),
 * checked on the RENDERED sheet so the harness sees what the workshop sees.
 *
 * The rule, as the casement glass sheet (CasementGlassDrawing2D) implements it:
 *   · spacing chains and axis dims run along the BOTTOM of the drawing
 *   · the overall WIDTH sits at the TOP
 *   · heights (overall height, arch start / rise, transom axes) sit on the RIGHT
 *
 * Dimension texts are recognised by their fill (the theme's dim colour) and
 * split by rotation: a rotated label belongs to a vertical dim (DimV /
 * DimChainV), an upright one to a horizontal dim (DimH / DimChainH).
 */
export const DIM_FILL = '#00B4A0';

/** Every dimension text of a sheet: { str, x, y, size, rot }. */
export function dimTexts(svg) {
  const out = [];
  const re = /<text\b([^>]*)>([^<]*)<\/text>/g;
  let m;
  while ((m = re.exec(svg))) {
    const at = m[1];
    if (!at.includes(`fill="${DIM_FILL}"`)) continue;
    const num = (k) => { const r = new RegExp(`${k}="([-\\d.]+)"`).exec(at); return r ? Number(r[1]) : null; };
    const rot = /transform="rotate\((-?[\d.]+)/.exec(at);
    out.push({ str: m[2], x: num('x'), y: num('y'), size: num('font-size'), rot: !!rot });
  }
  return out;
}

export function viewBoxOf(svg) {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

/**
 * Check one sheet against the rule — no per-sheet label lists, the classification
 * comes from the sheet itself:
 *   · the overall dims print at the theme's LARGE dim size, chains at the small one;
 *   · a rotated label belongs to a vertical dim, an upright one to a horizontal dim,
 *     EXCEPT a vertical chain's short segments, which are labelled with an upright
 *     leader text in the side margin — those sit beside that chain's rotated labels
 *     and are recognised (and excluded) by that proximity.
 * Returns { ok, why, widthY, heightX, bottom, sideLabels }.
 */
export function checkDimRule(svg) {
  const vb = viewBoxOf(svg);
  if (!vb) return { ok: false, why: 'no viewBox' };
  // radius callouts ("R 500") are annotations ON the arc, not dimension lines —
  // they carry the dim colour but the placement rule does not govern them
  const T = dimTexts(svg).filter((t) => !/^R\s/.test(t.str));
  if (!T.length) return { ok: false, why: 'no dimension texts' };
  const big = Math.max(...T.map((t) => t.size));
  const isBig = (t) => t.size >= big - 0.01;
  const upright = T.filter((t) => !t.rot);
  const rotated = T.filter((t) => t.rot);
  const width = upright.filter(isBig);
  const height = rotated.filter(isBig);
  if (!width.length) return { ok: false, why: 'no upright large dim text (the overall width)' };
  if (!height.length) return { ok: false, why: 'no rotated large dim text (the overall height)' };
  const widthY = Math.min(...width.map((t) => t.y));
  const heightX = Math.max(...height.map((t) => t.x));
  // upright small labels sitting beside a vertical chain are that chain's leader labels
  const nearRotated = (t) => rotated.some((r) => Math.abs(r.x - t.x) < 3 * t.size);
  const sideLabels = upright.filter((t) => !isBig(t) && nearRotated(t));
  const horizontals = upright.filter((t) => !isBig(t) && !nearRotated(t));
  const why = [];
  if (!(widthY < vb.h / 2)) why.push(`overall width at y ${widthY.toFixed(0)} is not in the top half (${(vb.h / 2).toFixed(0)})`);
  if (!(heightX > vb.w / 2)) why.push(`overall height at x ${heightX.toFixed(0)} is not right of ${(vb.w / 2).toFixed(0)}`);
  const high = horizontals.filter((t) => t.y < vb.h / 2);
  if (high.length) why.push(`horizontal dims still at the top: ${high.map((t) => `"${t.str}"@${t.y.toFixed(0)}`).join(', ')}`);
  if (horizontals.length && !(Math.min(...horizontals.map((t) => t.y)) > widthY)) why.push('a horizontal dim is not below the overall width');
  return { ok: why.length === 0, why: why.join(' · '), widthY, heightX, bottom: horizontals.length, sideLabels: sideLabels.length };
}
