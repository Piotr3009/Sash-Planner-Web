/**
 * elementsPayload.js
 *
 * SINGLE SOURCE for the Elements-PDF payload of one window, shared by the
 * single-window DrawingsPanel and the Production Pack ElementsTab (decision
 * 03.08). Before this module both places duplicated the same logic and the
 * casement layout existed only in DrawingsPanel — "works on the window page,
 * missing in the pack".
 *
 * Split of responsibilities:
 *   elementsPlan()        pure, per-category — WHICH drawings exist and what
 *                         role each plays (hero sheet / grid / cill page).
 *                         Adding a window type (doors…) = add a branch here
 *                         and map its components in the JSX callers. No other
 *                         file changes.
 *   buildElementsPayload() mechanics — rasterize the plan via refs into the
 *                         { hero, drawings, cill } shape that
 *                         exportElementsPDF consumes.
 *
 * The JSX side stays free to lay out its own cards/tabs; it only has to mount
 * one element per plan key and hand back refs. Details differ per type by
 * design (Piotr 03.08) — only the contract and the mechanics are shared.
 */
import { groupCasementLeaves, paneTitle } from '../components/drawings/casementDrawUtils.js';
import { svgNodeToPng } from './svgRaster.js';

/**
 * Describe the Elements set for one window.
 * @returns {{
 *   category: string,
 *   supported: boolean,        // false → engine has no data (fix/door): mark
 *                              // "not yet calculated", never render zeros
 *   leafGroups: Array,         // casement leaf groups (for component props)
 *   rig: string[],             // every ref key that must be mounted somewhere
 *   hero: {key,label}|null,    // full-page sheet (casement frame detail)
 *   drawings: Array<{key,label}>, // grid sheets
 *   cill: {key,ext}|null,      // per-pack de-duplicated closing page
 * }}
 */
export function elementsPlan(windowSpec, derived) {
  const category = windowSpec?.category || 'sash';

  if (category === 'casement') {
    const leafGroups = groupCasementLeaves(derived);
    const drawings = leafGroups.map((gp, k) => ({ key: `leaf${k}`, label: paneTitle(gp) }));
    return {
      category,
      supported: true,
      leafGroups,
      rig: ['frame', ...drawings.map((d) => d.key), 'vsection'],
      hero: { key: 'frame', label: 'Frame Detail' },
      drawings,
      cill: { key: 'vsection', ext: Number(windowSpec?.cill?.extension) || 0 },
    };
  }

  if (category === 'sash') {
    const drawings = [
      { key: 'box', label: 'Box Detail' },
      { key: 'upper', label: 'Upper Sash' },
      { key: 'lower', label: 'Lower Sash' },
    ];
    return { category, supported: true, leafGroups: [], rig: drawings.map((d) => d.key), hero: null, drawings, cill: null };
  }

  // fix / door: deriveWindowData returns emptyDerived (calculations.js:937).
  return { category, supported: false, leafGroups: [], rig: [], hero: null, drawings: [], cill: null };
}

/**
 * Rasterize a plan into the exportElementsPDF window payload.
 * @param {object} plan      result of elementsPlan()
 * @param {function} getSvg  (key) => mounted <svg> DOM node or null
 */
export async function buildElementsPayload(plan, getSvg) {
  const shot = async (key) => {
    const svg = getSvg(key);
    return svg ? await svgNodeToPng(svg, { scale: 3, printMode: true }) : null;
  };

  const drawings = [];
  for (const d of plan.drawings) {
    const png = await shot(d.key);
    drawings.push({ image: png?.url || null, w: png?.w, h: png?.h, label: d.label });
  }

  let hero = null;
  if (plan.hero) {
    const png = await shot(plan.hero.key);
    if (png?.url) hero = { image: png.url, w: png.w, h: png.h, label: plan.hero.label };
  }

  let cill = null;
  if (plan.cill) {
    const png = await shot(plan.cill.key);
    if (png?.url) cill = { image: png.url, w: png.w, h: png.h, ext: plan.cill.ext };
  }

  return { hero, drawings, cill };
}
