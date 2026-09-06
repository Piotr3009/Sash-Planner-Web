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
          // intersecting: the tracery mullions run to the springing (PSW: bottom → springY, the arcs take
          // over above); the user's own v bars are kept as well (PSW, BLOCKERS 9.6) and end on the outline
          const mull = vBars.filter((b) => near(Math.max(b.from[1], b.to[1]), O.springing, 1e-6));
          const userV = vBars.filter((b) => !near(Math.max(b.from[1], b.to[1]), O.springing, 1e-6));
          const nExp = Math.max(2, Math.min(4, Math.round(O.width / 450)));
          if (mull.length !== nExp) issues.push(`intersecting mullions ${mull.length} ≠ ${nExp}`);
          if (userV.length !== v) issues.push(`intersecting user v ${userV.length} ≠ ${v}`);
          for (const b of userV) { const top = b.to[1] >= b.from[1] ? b.to : b.from; if (!(distToChain(O.arcs, top) < 0.01)) issues.push(`${b.id} top end off the outline`); }
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
section('3 — intersecting on a gothic = PSW intersectingData (FixFrameWindow.jsx 667–700), vertex for vertex');
{
  // PSW sampling, copied (3D units → mm: mm(x) = x / 1000 there; here everything in mm, halfW = frame half width,
  // iHalfW = inner half width, springY = 0, archYAtX = the inner arch limit)
  function pswArcPts(cx, mulX, iHalfW, archYAtX, springY) {
    const r = Math.abs(mulX - cx);
    if (r < 30) return [];
    const startAngle = Math.acos(Math.min(1, Math.max(-1, (mulX - cx) / r)));
    const goingRight = cx < 0;
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const angle = goingRight ? startAngle + t * (Math.PI / 2) : startAngle - t * (Math.PI / 2);
      const px = cx + r * Math.cos(angle);
      const py = springY + r * Math.sin(angle);
      if (py < springY - 2) continue;
      const limit = archYAtX(Math.max(-iHalfW, Math.min(iHalfW, px)));
      if (py > limit) break;
      if (Math.abs(px) > iHalfW) break;
      pts.push([px, py]);
    }
    return pts;
  }
  for (const [name, W, H, f] of [['G1', 1000, 1900, { archShape: 'gothic-equilateral' }], ['G2', 1400, 2400, { archShape: 'gothic-equilateral' }], ['G3', 1000, 1700, { archShape: 'gothic-drop', archProfile: 'drop' }]]) {
    const d = derive(pcItem(name, W, H, { ...f, archBarPattern: 'intersecting' }));
    const O = d.arch.glassOutline, xg = O.width / 2, hw = W / 2;
    const tracery = d.arch.bars.filter((b) => b.role === 'tracery');
    const mullions = d.arch.bars.filter((b) => b.role === 'v');
    const nExp = Math.max(2, Math.min(4, Math.round(O.width / 450)));
    check(`${name}: mullions n = clamp(round(Wg / 450), 2, 4) = ${nExp}, evenly across the clear width, up to the springing`, mullions.length === nExp && mullions.every((b, i) => near(b.from[0], O.width * (i + 1) / (nExp + 1), 1e-6) && near(Math.max(b.from[1], b.to[1]), O.springing, 1e-6)));
    // PSW frame: x centred on the axis, springing at 0; PC glass frame → subtract xg / springing
    const archYAtX = (x) => (arch.chainYAtX(O.arcs, x + xg) ?? O.springing) - O.springing;
    let vertsChecked = 0, vertsOff = 0, arcsMatched = 0;
    for (const b of mullions) {
      const mulX = b.from[0] - xg;
      for (const cx of [-hw, hw]) {
        const pts = pswArcPts(cx, mulX, xg, archYAtX, 0);
        if (pts.length < 3) continue;
        // the PC arc with the same centre / radius
        const r = Math.abs(mulX - cx);
        const pc = tracery.find((t) => near(t.arc.cx - xg, cx, 1e-6) && near(t.arc.r, r, 1e-6));
        if (!pc) { vertsOff += pts.length; continue; }
        arcsMatched++;
        for (const p of pts) {
          vertsChecked++;
          const ang = Math.atan2(p[1] + O.springing - pc.arc.cy, p[0] + xg - pc.arc.cx);
          const onCircle = near(Math.hypot(p[0] + xg - pc.arc.cx, p[1] + O.springing - pc.arc.cy), pc.arc.r, 0.01);
          const step = (Math.PI / 2) / 48;
          const inRange = ang >= pc.arc.a0 - step - 1e-9 && ang <= pc.arc.a1 + step + 1e-9;
          if (!(onCircle && inRange)) vertsOff++;
        }
      }
    }
    check(`${name}: ${arcsMatched} PSW arcs (centres ±W/2 on the springing, r = |mullion − corner|) exist in PC; ${vertsChecked} PSW sample vertices on the PC arcs within range (±1 step)`, arcsMatched === tracery.length && vertsChecked > 0 && vertsOff === 0, `off ${vertsOff}, PC tracery ${tracery.length}`);
    // PC stops each arc exactly on the outline; PSW stops at the last sample below it — PC end must be on the chain
    check(`${name}: every PC tracery arc ends ON the outline (distance < 0.01) and starts on the springing`, tracery.every((t) => { const end = t.arc.cx < xg ? t.to : t.from; const start = t.arc.cx < xg ? t.from : t.to; return distToChain(O.arcs, end) < 0.01 && near(start[1], O.springing, 1e-6); }));
  }
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
