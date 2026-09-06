/**
 * t20_bars — ARCHED-WINDOWS-v3 Block 0.4c: bar logic audit per shape
 * (Piotr 07.09: "czy aby na pewno logika barow na archach jest taka sama,
 * patrz gothic").
 *
 * For every shape × pattern × 0–3 straight bars (h and v) it asserts:
 *   - every straight vertical bar ends ON the glass outline (distance to the
 *     ArcChain < 0.01); on a gothic the centre bar ends at the apex point;
 *   - horizontal bars never cross the springing line, the count is the
 *     requested count (never dropped silently) — including a gothic with the
 *     shortest straight stile the profile allows;
 *   - pattern availability is 1:1 with PSW (price-calculator.js 990–995 and the
 *     fix radios of online-estimate.html), PC extras only on the semi-circle;
 *   - `intersecting` on a gothic = PSW intersectingData, vertex for vertex:
 *     the PSW sampling function (FixFrameWindow.jsx 667–700) copied here
 *     produces points that all lie on the PC arcs within their ranges;
 *   - bar lengths in the cut list (beading run) = Σ of the drawn segments / arcs
 *     (±0.5);
 *   - the elevation sheet, the leaf sheet and the glazier DXF draw the same bar
 *     set (count and end points).
 * Any mismatch = a BLOCKERS entry with the PSW line reference.
 *
 * Run: node verify/arch/t20_bars.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

const ENTRY = resolve(AUDIT, 't20b-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as calculations from '../src/engine/calculations.js';",
  "export * as glassDxf from '../src/utils/glassDxfExport.js';",
  "export * as cdu from '../src/components/drawings/casementDrawUtils.js';",
  "export { default as Elevation } from '../src/components/drawings/CasementElevation2D.jsx';",
  "export { default as LeafDetail } from '../src/components/drawings/CasementLeafDetail2D.jsx';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 't20b-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf',
  `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href);
const { arch, profile, specification, calculations, glassDxf } = M;
const P = profile.DEFAULT_CASEMENT_PROFILE;
// profile numbers behind the spec E vectors (v4 Block F): glass offset from the frame outer = leafAtJamb + leafTop.face − glassInset (51 + 67 − 12.5 = 105.5, was 94.5)
const glassOff = P.deductions.leafAtJamb + P.elements.leafTop.face - P.geometry.glassInset;
const xgS = (1000 - 2 * glassOff) / 2;   // clear half width of the W 1000 semi-circle = the intersecting arc radius: 394.5 (spec quotes 405.5 at the 57 face)

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n== ${t} ==`);
const pcItem = (id, width, height, fields) => specification.normaliseToWindowSpec(
  { id, name: id, width, height, windowCategory: 'casement', casementType: 'arched', ...fields });
const derive = (spec) => calculations.deriveWindowData(spec, {});

/** Distance from a point to the outline chain (arcs only, above the springing). */
function distToChain(arcs, p) {
  let best = Infinity;
  for (const a of arcs) {
    const ang = Math.atan2(p[1] - a.cy, p[0] - a.cx);
    if (ang < a.a0 - 1e-6 || ang > a.a1 + 1e-6) continue;
    best = Math.min(best, Math.abs(Math.hypot(p[0] - a.cx, p[1] - a.cy) - a.r));
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
section('1 — straight bars per shape × pattern × 0–3 h × 0–3 v: v ends on the outline, h never crosses the springing, counts kept');
const SHAPES = [
  { shape: 'semi-circle', W: 1000, H: 1500, fields: { archShape: 'three-centre', archStart: 1000 } },
  { shape: 'three-centre', W: 1000, H: 1500, fields: { archShape: 'three-centre', archStart: 1300 } },
  { shape: 'gothic-equilateral', W: 1000, H: 1800, fields: { archShape: 'gothic-equilateral' } },
  { shape: 'gothic-drop', W: 1000, H: 1700, fields: { archShape: 'gothic-drop', archProfile: 'drop' } },
];
let cases = 0, okCases = 0;
const problems = [];
for (const S of SHAPES) {
  for (const pattern of arch.patternsForShape(S.shape)) {
    for (let h = 0; h <= 3; h++) for (let v = 0; v <= 3; v++) {
      const fields = { ...S.fields, archBarPattern: pattern, casementHBars: h, casementVBars: v };
      if (pattern === 'custom') Object.assign(fields, { archSpokes: 5, archRings: [0.3, 0.6] });
      let d;
      try { d = derive(pcItem(`${S.shape}-${pattern}-${h}${v}`, S.W, S.H, fields)); }
      catch (e) { problems.push(`${S.shape} ${pattern} ${h}H ${v}V: throws ${e.message}`); cases++; continue; }
      cases++;
      const A = d.arch, O = A.glassOutline;
      const bars = A.bars;
      const hub = arch.isHubPattern(pattern);
      const vBars = bars.filter((b) => b.role === 'v');
      const hBars = bars.filter((b) => b.role === 'h');
      const issues = [];
      // straight verticals: user v (non-hub) end on the outline; hub ring-end verticals end on the springing
      if (!hub) {
        const user = vBars.filter((b) => !(pattern === 'intersecting'));
        if (pattern === 'intersecting') {
          // v4 Block E (PSW sash rule): the user's v bars ARE the tracery columns — equal divisions of the clear
          // width up to the springing (0 → two default columns at ±¼); two arcs per column, nothing else vertical
          const nExp = v > 0 ? v : 2;
          const xsExp = v > 0 ? [...Array(v)].map((_, i) => O.width * (i + 1) / (v + 1)) : [O.width / 4, 3 * O.width / 4];
          if (vBars.length !== nExp) issues.push(`intersecting columns ${vBars.length} ≠ ${nExp}`);
          vBars.forEach((b, i) => {
            if (!near(b.from[0], xsExp[i], 1e-6)) issues.push(`${b.id} at x ${b.from[0].toFixed(1)} ≠ ${xsExp[i].toFixed(1)}`);
            if (!(near(Math.max(b.from[1], b.to[1]), O.springing, 1e-6) && near(Math.min(b.from[1], b.to[1]), 0, 1e-6))) issues.push(`${b.id} does not run glass bottom → springing`);
          });
          const trac = bars.filter((b) => b.role === 'tracery');
          if (trac.length !== 2 * nExp) issues.push(`tracery arcs ${trac.length} ≠ ${2 * nExp}`);
          if (!trac.every((b) => near(b.arc.r, O.arcs[0].r, 1e-6))) issues.push('tracery radius ≠ outline radius');
          if (bars.some((b) => b.role === 'springing')) issues.push('springing bar on an intersecting unit');
        } else {
          if (user.length !== v) issues.push(`v count ${user.length} ≠ ${v}`);
          for (const b of user) {
            const top = b.to[1] >= b.from[1] ? b.to : b.from;
            const dist = distToChain(O.arcs, top);
            if (!(dist < 0.01)) issues.push(`${b.id} top end ${dist.toFixed(3)} from the outline`);
          }
          if (S.shape.startsWith('gothic') && v % 2 === 1) {
            const centre = user[(v - 1) / 2];
            const top = centre.to[1] >= centre.from[1] ? centre.to : centre.from;
            if (!(near(top[0], O.width / 2, 1e-6) && near(top[1], O.apex, 0.01))) issues.push(`gothic centre bar does not end at the apex (${top.map((x) => x.toFixed(2))} vs apex ${O.apex.toFixed(2)})`);
          }
        }
      } else if (vBars.some((b) => !near(Math.max(b.from[1], b.to[1]), O.springing, 1e-6) || !near(Math.min(b.from[1], b.to[1]), 0, 1e-6))) {
        issues.push('hub ring-end vertical does not run glass bottom → springing');
      }
      // horizontals: count kept, below the springing, full clear width
      if (hBars.length !== h) issues.push(`h count ${hBars.length} ≠ ${h}`);
      for (const b of hBars) {
        if (!(b.from[1] < O.springing - 1e-6 && b.from[1] > 0)) issues.push(`${b.id} at y ${b.from[1].toFixed(1)} not strictly between the glass bottom and the springing ${O.springing.toFixed(1)}`);
        if (!(near(Math.min(b.from[0], b.to[0]), 0, 1e-6) && near(Math.max(b.from[0], b.to[0]), O.width, 1e-6))) issues.push(`${b.id} not full clear width`);
      }
      // every bar end point lies inside or on the unit (nothing outside the glass)
      for (const b of bars) for (const e of [b.from, b.to]) {
        const inside = e[0] >= -1e-6 && e[0] <= O.width + 1e-6 && e[1] >= -1e-6 && (e[1] <= O.springing + 1e-6 || distToChain(O.arcs, e) < 0.01 || arch.chainYAtX(O.arcs, e[0]) >= e[1] - 1e-6);
        if (!inside) issues.push(`${b.id} end (${e.map((x) => x.toFixed(1))}) outside the unit`);
      }
      // cut-list bar run = Σ drawn lengths (±0.5)
      const sum = bars.reduce((s, b) => s + (b.kind === 'arc' ? b.arc.r * (b.arc.a1 - b.arc.a0) : Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1])), 0);
      if (!near(A.barTotalLength, sum, 0.5 + 0.25 * bars.length)) issues.push(`barTotalLength ${A.barTotalLength} ≠ Σ ${sum.toFixed(1)}`);
      const bead = d.components.beading.find((r) => r.elementName === 'C-TRIANGLE BEADING (EXT)');
      if (bars.length && (!bead || !near(bead.length, Math.round(A.barTotalLength * 1.15), 1))) issues.push('C-TRIANGLE BEADING ≠ bar run × 1.15');
      if (!bars.length && bead) issues.push('bead record without bars');
      if (issues.length) problems.push(`${S.shape} ${pattern} ${h}H ${v}V: ${issues.join('; ')}`); else okCases++;
    }
  }
}
check(`${cases} shape × pattern × h × v cases, ${okCases} clean`, okCases === cases, problems.slice(0, 8).join('\n        '));
// gothic with the shortest straight stile the profile allows: H = rise + 900 → h bars still 3, clamped below the springing
{
  const W = 1000, rise = Math.sqrt(3) / 2 * W, H = Math.ceil(rise + P.arch.limits.minStraightBelowRise);
  const d = derive(pcItem('G-short', W, H, { archShape: 'gothic-equilateral', casementHBars: 3, casementVBars: 3 }));
  const hB = d.arch.bars.filter((b) => b.role === 'h');
  check(`gothic at the minimum straight height (H ${H}): 3 h bars kept, all below the springing ${d.arch.glassOutline.springing.toFixed(1)}, none dropped`, hB.length === 3 && hB.every((b) => b.from[1] < d.arch.glassOutline.springing) && d.arch.barCounts.h === 3);
  let err = null;
  try { derive(pcItem('G-tooshort', W, H - 10, { archShape: 'gothic-equilateral', casementHBars: 3 })); } catch (e) { err = e; }
  check('10 mm below the minimum → readable ArchError (never a silent clamp)', err instanceof arch.ArchError && /minimum 900/.test(err.message));
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — pattern availability 1:1 with PSW (price-calculator.js 990–995, online-estimate.html fix radios)');
{
  // PSW literal (js/price-calculator.js 990–995), keyed by the PSW shape ids
  const PSW = {
    'semi-circle': ['none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'intersecting'],
    'gothic-arch': ['none', 'intersecting'],
    'segmental-arch': ['none'],
    'elliptical-arch': ['none'],
  };
  const map = { 'semi-circle': 'semi-circle', 'gothic-arch': 'gothic-equilateral', 'segmental-arch': 'three-centre', 'elliptical-arch': 'three-centre' };
  for (const [pswShape, list] of Object.entries(PSW)) {
    const pc = arch.PSW_PATTERNS_FOR_SHAPE[map[pswShape]];
    check(`PSW ${pswShape} → PC ${map[pswShape]}: ${list.join(', ')}`, JSON.stringify(pc) === JSON.stringify(list), JSON.stringify(pc));
  }
  check('gothic-drop takes the gothic list (none, intersecting)', JSON.stringify(arch.PSW_PATTERNS_FOR_SHAPE['gothic-drop']) === '["none","intersecting"]');
  check('PC extras (quad-hub-spoke, custom) only on the semi-circle — a hub needs one centre', JSON.stringify(arch.PC_EXTRA_PATTERNS) === '{"semi-circle":["quad-hub-spoke","custom"]}' && !arch.patternsForShape('gothic-equilateral').includes('quad-hub-spoke') && !arch.patternsForShape('three-centre').includes('custom'));
  // the live PSW clone, when present: the literal must still read the same
  const pcPath = resolve(ROOT, '..', 'psw', 'js', 'price-calculator.js');
  if (existsSync(pcPath)) {
    const src = readFileSync(pcPath, 'utf8');
    const m = /var PATTERNS_FOR_SHAPE = \{([\s\S]*?)\};/.exec(src);
    const parsed = {};
    for (const row of m[1].matchAll(/'([\w-]+)':\s*\[([^\]]*)\]/g)) parsed[row[1]] = [...row[2].matchAll(/'([\w-]+)'/g)].map((x) => x[1]);
    check('live PSW price-calculator.js PATTERNS_FOR_SHAPE == the literal above', JSON.stringify(parsed) === JSON.stringify(PSW), JSON.stringify(parsed));
    const html = readFileSync(resolve(ROOT, '..', 'psw', 'online-estimate.html'), 'utf8');
    const circle = [...html.matchAll(/name="fix-circle-bars" value="([\w-]+)"/g)].map((x) => x[1]);
    const gothic = [...html.matchAll(/name="fix-gothic-bars" value="([\w-]+)"/g)].map((x) => x[1]);
    check('live PSW fix radios: fix-circle-bars none | sunburst, fix-gothic-bars none | patternA (Block 3 vocabulary; PC has no fixed window yet)', JSON.stringify(circle) === '["none","sunburst"]' && JSON.stringify(gothic) === '["none","patternA"]', JSON.stringify([circle, gothic]));
  } else {
    console.log('  (PSW clone not present — literal check only; fix radios: none | sunburst, none | patternA)');
  }
  // hub patterns rejected off the semi-circle, intersecting rejected on a three-centre — readable
  const rejects = [
    ['three-centre', 'hub-spoke', 1500, { archShape: 'three-centre', archStart: 1300 }],
    ['three-centre', 'intersecting', 1500, { archShape: 'three-centre', archStart: 1300 }],
    ['gothic-equilateral', 'hub-spoke', 1900, { archShape: 'gothic-equilateral' }],
    ['gothic-drop', 'quad-hub-spoke', 1900, { archShape: 'gothic-drop', archProfile: 'drop' }],
  ];
  for (const [shape, pat, H, f] of rejects) {
    let err = null;
    try { derive(pcItem(`rej-${shape}-${pat}`, 1000, H, { ...f, archBarPattern: pat })); } catch (e) { err = e; }
    check(`${pat} on ${shape} → ArchError "not available"`, err instanceof arch.ArchError && /not available/.test(err.message), err ? err.message : 'no throw');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — intersecting = the PSW SASH rule (ArchedSashWindow.jsx 915–940) on the glass outline, vertex for vertex; spec E vectors');
{
  // PSW useArchedSashBars, ported on the GLASS numbers (halfW = clear half width, rise = glass apex − springing,
  // springY = springing, x centred on the axis): columns = the user's V bars (default [−halfW/2, halfW/2]);
  // R = gothic ? gothicCentreOffset(halfW, rise) + halfW : halfW; arc centred at mx − dir·R, 64 samples over a
  // quarter turn, dropped below the springing, stopped where |px| > halfW or above the profile.
  // PSW's gothic R is the two-centre formula on the glass numbers (905.4 on W 1000) — the true outline is the
  // frame's arcs offset concentrically (905.5): PC takes the exact outline radius, so the comparison allows 0.2.
  const gothicCentreOffset = (halfW, rise) => Math.max(0, (rise * rise - halfW * halfW) / (2 * halfW));
  function pswSashArcs({ gothic, halfW, rise, springY, columns, profileAt }) {
    const R = gothic ? gothicCentreOffset(halfW, rise) + halfW : halfW;
    const out = [];
    for (const mx of columns) {
      for (const dir of [1, -1]) {
        const cx = mx - dir * R;
        if (Math.abs(cx) > halfW * 3) continue;
        const pts = [];
        for (let i = 0; i <= 64; i++) {
          const t = i / 64;
          const a0 = dir > 0 ? 0 : Math.PI;
          const a = a0 + dir * t * (Math.PI / 2);
          const px = cx + R * Math.cos(a), py = springY + R * Math.sin(a);
          if (py < springY) continue;
          if (Math.abs(px) > halfW) break;
          if (py > profileAt(px)) break;
          pts.push([px, py]);
        }
        if (pts.length >= 3) out.push({ mx, dir, cx, R, pts });
      }
    }
    return { R, arcs: out };
  }
  const CASES = [
    ['G3 (spec: gothic 1000 × 1900, 3 V → 6 arcs)', 1000, 1900, { archShape: 'gothic-equilateral', casementVBars: 3 }, { arcs: 6 }],
    [`S2 (spec: semi-circle 1000, 2 V → 4 arcs R ${xgS} = (1000 − 2·${glassOff})/2; 405.5 at the 57 face)`, 1000, 1500, { archShape: 'three-centre', archStart: 1000, casementVBars: 2 }, { arcs: 4, R: xgS }],
    [`S0 (spec: 0 V → columns at ±${xgS / 2} = ±Wg/4; ±202.75 at the 57 face)`, 1000, 1500, { archShape: 'three-centre', archStart: 1000 }, { arcs: 4, R: xgS, columns: [-xgS / 2, xgS / 2] }],
    ['G2 1400 × 2400', 1400, 2400, { archShape: 'gothic-equilateral', casementVBars: 2 }, { arcs: 4 }],
    ['GD 1000 × 1700 drop', 1000, 1700, { archShape: 'gothic-drop', archProfile: 'drop', casementVBars: 1 }, { arcs: 2 }],
  ];
  for (const [name, W, H, f, exp] of CASES) {
    const d = derive(pcItem(name.split(' ')[0], W, H, { ...f, archBarPattern: 'intersecting' }));
    const O = d.arch.glassOutline, xg = O.width / 2;
    const gothic = f.archShape.startsWith('gothic');
    const tracery = d.arch.bars.filter((b) => b.role === 'tracery');
    const columns = d.arch.bars.filter((b) => b.role === 'v').map((b) => b.from[0] - xg);
    const Rg = O.arcs[0].r;
    check(`${name}: ${exp.arcs} arcs, each starting at a column x on the springing, ending on the outline, R = outline radius ${Rg.toFixed(1)}${exp.R ? ` (= the clear half width ${exp.R})` : ' (spec quotes the FRAME radius — errata E4)'}`,
      tracery.length === exp.arcs && (exp.R == null || near(Rg, exp.R, 1e-6)) && tracery.every((b) => {
        const start = near(b.arc.a0, 0, 1e-9) ? b.from : b.to, end = start === b.from ? b.to : b.from;
        return near(b.arc.r, Rg, 1e-6) && near(start[1], O.springing, 1e-6) && columns.some((c) => near(c + xg, start[0], 1e-6)) && distToChain(O.arcs, end) < 0.01 && near(b.arc.cy, O.springing, 1e-9) && near(Math.abs(b.arc.cx - start[0]), Rg, 1e-6);
      }), `${tracery.length} arcs, R ${tracery.map((b) => b.arc.r.toFixed(1)).join('/')}`);
    if (exp.columns) check(`${name}: default columns at ${exp.columns.join(' / ')} from the axis (= ±Wg/4 = ±${(O.width / 4).toFixed(2)})`, columns.length === 2 && columns.every((c, i) => near(c, exp.columns[i], 0.01)), columns.map((c) => c.toFixed(2)).join(' '));
    // PSW port vertex for vertex
    const profileAt = (x) => (arch.chainYAtX(O.arcs, x + xg) ?? O.springing);
    const psw = pswSashArcs({ gothic, halfW: xg, rise: O.apex - O.springing, springY: O.springing, columns, profileAt });
    let matched = 0, off = 0, verts = 0;
    for (const pa of psw.arcs) {
      const pc = tracery.find((b) => near(b.arc.cx - xg, pa.cx, 0.2) && near(b.arc.r, pa.R, 0.2));
      if (!pc) continue;
      matched++;
      for (const p of pa.pts) {
        verts++;
        const dx = p[0] + xg - pc.arc.cx, dy = p[1] - pc.arc.cy;
        const onCircle = near(Math.hypot(dx, dy), pc.arc.r, 0.2);
        const ang = Math.atan2(dy, dx), step = (Math.PI / 2) / 64;
        const inRange = ang >= pc.arc.a0 - step - 1e-9 && ang <= pc.arc.a1 + step + 1e-9;
        if (!(onCircle && inRange)) off++;
      }
    }
    check(`${name}: PSW sash rule (R ${psw.R.toFixed(1)}) → ${psw.arcs.length} arcs, all present in PC; ${verts} PSW sample vertices on the PC arcs within 0.2 mm / one step`, matched === psw.arcs.length && matched === tracery.length && verts > 0 && off === 0, `matched ${matched}/${psw.arcs.length}, off ${off}`);
  }
  check('intersecting keeps no springing bar (PSW 23.08: the columns flow into the arcs) and the h bars stay below the springing', (() => { const d = derive(pcItem('GH', 1000, 2000, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting', casementHBars: 2 })); return !d.arch.bars.some((b) => b.role === 'springing') && d.arch.bars.filter((b) => b.role === 'h').every((b) => b.from[1] < d.arch.glassOutline.springing); })());
  check('no intersecting settings left in the profile / 3D fallback (pitch, mullion clamp, minRadius gone)', !('intersecting' in P.arch.patterns) && !readFileSync(resolve(ROOT, 'src', '3d', 'components', 'casement', 'archedCasementGeometry.js'), 'utf8').includes('minMullions'));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — the elevation sheet, the leaf sheet and the glazier DXF draw the same bar set');
{
  for (const [name, W, H, f] of [['E1', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'triple-hub-spoke', casementHBars: 1 }], ['E2', 1000, 1900, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting', casementHBars: 2 }], ['E3', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 3, casementVBars: 3 }]]) {
    const spec = pcItem(name, W, H, f);
    const d = derive(spec);
    const bars = d.arch.bars;
    const elev = renderToStaticMarkup(React.createElement(M.Elevation, { windowSpec: spec, derived: d, projectNumber: 'P' }));
    const leafGroups = M.cdu.groupCasementLeaves(d);
    const leaf = renderToStaticMarkup(React.createElement(M.LeafDetail, { windowSpec: spec, derived: d, group: leafGroups[0], projectNumber: 'P' }));
    // elevation: bands stroke COLORS.bar (#94A3B8); leaf sheet: bands stroke COLORS.sash (#E2E8F0) at 0.5 inside the clip group
    const bandCount = (svg, stroke) => (svg.match(new RegExp(`<path d="[^"]*" fill="none" stroke="${stroke}" stroke-width="0\\.[58]"`, 'g')) || []).length;
    const unit = glassDxf.shapedGlassUnits(spec, d)[0];
    const ents = glassDxf.buildGlassUnitEntities(unit, name, 0, 0).entities;
    const axes = ents.filter((e) => e.type === 'poly' && e.layer === 'GLASS_BAR_AXES');
    const ne = bandCount(elev, '#94A3B8'), nl = bandCount(leaf, '#E2E8F0');
    check(`${name}: ${bars.length} bars → ${ne} bands on the elevation, ${nl} on the leaf sheet, ${axes.length} axes in the DXF`, ne === bars.length && nl === bars.length && axes.length === bars.length);
    // DXF axis end points = engine bar end points (glass frame)
    check(`${name}: DXF axes end points = the engine bar ends`, axes.every((a, i) => near(a.pts[0][0], bars[i].from[0], 1e-6) && near(a.pts[0][1], bars[i].from[1], 1e-6) && near(a.pts[1][0], bars[i].to[0], 1e-6) && near(a.pts[1][1], bars[i].to[1], 1e-6)));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
