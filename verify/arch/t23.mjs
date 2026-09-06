/**
 * t23 — ARCHED-WINDOWS-v3 Block 3 harness: FIXED windows inside the casement
 * batch — kind 'fixed' (frame + non-opening leaf, no hardware) on the
 * rectangle / Round / Gothic, and the CIRCLE (frame ring + leaf ring on the
 * profile faces, sunburst bars, tracery, CNC / glazier DXF, sheets).
 *
 * Sections: 1 circle geometry + bars (arch.js) · 2 engine: circle 800 sunburst ·
 * 3 rectangle fixed = 040L minus hardware · 4 arched fixed = arched casement
 * minus hardware · 5 import (PSW fix-only, PC casementKind, errors) · 6 CNC DXF
 * (rings, FIT, FIXED LEAF text, samples) · 7 glazier DXF + tracery (samples) ·
 * 8 sheets (circle arcs concentric on the engine radii, fixed rectangle without
 * the opening symbol) · 9 3D config · 10 structural evidence.
 *
 * Run: node verify/arch/t23.mjs   (needs ezdxf; writes docs/handover/samples/sample_*circle*)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, AUDIT, bundleTree, renderSheets, deriveItem } from './lib/sheets.mjs';

mkdirSync(AUDIT, { recursive: true });
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(SAMPLES, { recursive: true });

const M = await bundleTree(resolve(ROOT, 'src'), 't23', [
  ['archDxf', 'engine/cnc/archDxf.js'],
  ['dxfWriter', 'engine/cnc/dxfWriter.js'],
  ['cncExport', 'utils/cncExport.js'],
  ['glassDxf', 'utils/glassDxfExport.js'],
  ['tracery', 'engine/cnc/traceryExport.js'],
  ['glassBars', 'engine/glassBars.js'],
  ['wsc', 'utils/windowSpecToConfig.js'],
]);
const { specification, calculations, arch, profile, archDxf, dxfWriter, cncExport, glassDxf, tracery, glassBars, wsc } = M;
const CP = profile.DEFAULT_CASEMENT_PROFILE;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
function expectThrows(name, fn, re) {
  try { fn(); check(name, false, 'did not throw'); }
  catch (e) { check(name, re.test(e?.message || String(e)), e?.message); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n== ${t} ==`);
function probe(path) {
  const out = execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}
const cas = (id, width, height, fc, item = {}) => specification.normaliseToWindowSpec({ id, name: id, width, height, ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
const derive = (spec) => calculations.deriveWindowData(spec, {});
let lastName = null, lastBlob = null;
globalThis.document = { body: { appendChild() {} }, createElement: () => ({ set href(v) {}, set download(v) { lastName = v; }, click() {}, remove() {} }) };
URL.createObjectURL = (b) => { lastBlob = b; return 'blob:harness'; };
URL.revokeObjectURL = () => {};
/** bulge polyline → arcs { cx, cy, r } */
function polyArcs(pts, closed = true) {
  const out = [];
  const n = pts.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const [x1, y1, b] = pts[k];
    if (!b) continue;
    const [x2, y2] = pts[(k + 1) % n];
    const theta = 4 * Math.atan(Math.abs(b));
    const chord = Math.hypot(x2 - x1, y2 - y1);
    const r = chord / (2 * Math.sin(theta / 2));
    const d = r * Math.cos(theta / 2) * Math.sign(b);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -(y2 - y1) / chord, ny = (x2 - x1) / chord;
    out.push({ cx: mx + nx * d, cy: my + ny * d, r });
  }
  return out;
}
/** SVG path `A` commands → arcs { cx, cy, r } (sheet frame) — t19's parser */
function svgArcs(svg) {
  const arcs = [];
  const re = /<path [^>]*?d="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg))) {
    const toks = m[1].replace(/,/g, ' ').trim().split(/\s+/);
    let i = 0, cur = [0, 0], start = [0, 0], cmd = '';
    const numAt = (k) => Number(toks[k]);
    while (i < toks.length) {
      const t = toks[i];
      if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; }
      switch (cmd) {
        case 'M': cur = [numAt(i), numAt(i + 1)]; start = cur; i += 2; cmd = 'L'; break;
        case 'L': cur = [numAt(i), numAt(i + 1)]; i += 2; break;
        case 'H': cur = [numAt(i), cur[1]]; i += 1; break;
        case 'V': cur = [cur[0], numAt(i)]; i += 1; break;
        case 'Z': cur = start; break;
        case 'A': {
          const rx = numAt(i), large = numAt(i + 3), sweep = numAt(i + 4), x2 = numAt(i + 5), y2 = numAt(i + 6);
          const [x1, y1] = cur;
          const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
          const den = dx * dx + dy * dy;
          let r = rx;
          if (den > r * r) r = Math.sqrt(den);
          const coef = Math.sqrt(Math.max(0, (r * r - den) / den));
          const s = large !== sweep ? 1 : -1;
          arcs.push({ cx: s * coef * dy + (x1 + x2) / 2, cy: -s * coef * dx + (y1 + y2) / 2, r: rx });
          cur = [x2, y2]; i += 7; break;
        }
        default: i++;
      }
    }
  }
  return arcs;
}
const dataAttr = (svg, name) => { const m = new RegExp(`${name}="([^"]+)"`).exec(svg); return m ? m[1].split(',').map(Number) : null; };
/** derived JSON without the fields a fixed leaf legitimately changes (hardware / opening / notes) */
function stripOpening(d) {
  const c = JSON.parse(JSON.stringify(d));
  delete c.casement.kind; delete c.casement.openers; delete c.casement.hardware; delete c.casement.leafWeights;
  c.casement.layoutDef.panels.forEach((p) => { delete p.hinge; });
  for (const rec of c.components.sash) rec.notes = '';
  for (const g of c.customGlassUnits) delete g.location;
  return JSON.stringify(c);
}

// ═══════════════════════════════════════════════════════════════════════════
section('1 — circle geometry + bars (arch.js): rings on the profile faces, planner on full circles, errors');
{
  const G = arch.buildCircleGeometry({ width: 800, height: 800 }, CP);
  check('circle 800: R 400 outer, frame ring 400 → 343 (face 57), leaf ring 360 → 293 (40 / 67), glass 305.5 (94.5)',
    G.shape === 'circle' && near(G.radii[0], 400, 1e-9) && near(G.frameHead.inner[0].r, 343, 1e-9) && near(G.leafTop.outer[0].r, 360, 1e-9) && near(G.leafTop.inner[0].r, 293, 1e-9) && near(G.glass.radius, 305.5, 1e-9));
  check('circle: two half-arcs 0 → π → 2π centred on the origin, rebate wall R 364 (land 36), fit gap 4 lap 17, start = rise = R',
    G.arcs.length === 2 && G.arcs.every((a) => a.cx === 0 && a.cy === 0) && near(G.arcs[0].a1, Math.PI, 1e-12) && near(G.arcs[1].a1, 2 * Math.PI, 1e-12) && near(G.rebateWall[0].r, 364, 1e-9) && G.fit.gap === 4 && G.fit.lap === 17 && G.start === 400 && G.rise === 400);
  check('ring lengths: frame centre 2π·371.5, leaf centre 2π·326.5; ringPoly closes (6 vertices)',
    near(G.frameHead.lengths.centre, 2 * Math.PI * 371.5, 1e-6) && near(G.leafTop.lengths.centre, 2 * Math.PI * 326.5, 1e-6) && arch.ringPoly(G.frameHead).length === 6);
  const plan = arch.buildCirclePlan({ width: 800, height: 800 }, CP);
  // v4 Block C: a circle ring is ONE closed planning group (360°, radial joints only); the 800 frame ring = 4 × 180,
  // the 800 LEAF ring is BLOCKED by the 400 shorter-edge limit (4 × 180 → 390.1) and reported, never split finer (t25, BLOCKERS)
  check('buildCirclePlan (v4): kind circle, no hinge, frame ring = one 360° group → 4 pieces × 180; leaf ring blocked "below minimum length" (shorter edge 390 < 400)',
    plan.kind === 'circle' && plan.hinge === null && plan.noStock && plan.plans.frameHead.arcs.length === 1 && near(plan.plans.frameHead.arcs[0].spanDeg, 360, 1e-6) && plan.plans.frameHead.arcs[0].default?.n === 4 && plan.plans.frameHead.arcs[0].default?.stock === 180
    && plan.plans.leafTop.noStock && plan.plans.leafTop.noStockReason === 'below minimum length' && /shorter edge 390(\.\d)? < 400/.test(plan.plans.leafTop.reasons[0]), plan.plans.leafTop.reasons.join(' | '));
  expectThrows('height ≠ width → readable ArchError', () => arch.buildCircleGeometry({ width: 800, height: 900 }, CP), /height must equal the diameter/);
  expectThrows('diameter below the profile minimum → ArchError', () => arch.buildCircleGeometry({ width: 300, height: 300 }, CP), /outside/);
  const O = arch.buildCircleGlassOutline(G.glass.arcs);
  check('glass outline: kind circle, 611 × 611, centre (305.5, 305.5), area π·305.5², perimeter 2π·305.5',
    O.kind === 'circle' && near(O.width, 611, 1e-9) && near(O.centre[0], 305.5, 1e-9) && near(O.area, Math.PI * 305.5 ** 2, 1e-6) && near(O.perimeter, 2 * Math.PI * 305.5, 1e-6));
  check('glassOutlinePoly: two vertices on the diameter, bulge 1 (two half circles)', JSON.stringify(arch.glassOutlinePoly(O)) === JSON.stringify([[611, 305.5, 1], [0, 305.5, 1]]));
  const B = arch.buildCircleBars({ outline: O, pattern: 'sunburst', h: 1, v: 2 }, CP.arch.patterns);
  const ring = B.bars.filter((b) => b.role === 'ring'), spokes = B.bars.filter((b) => b.role === 'spoke');
  check('sunburst: ring R 305.5 − 200 = 105.5 (two halves), 6 spokes ring → glass edge, L 200 each, at i·60°',
    ring.length === 2 && ring.every((b) => near(b.arc.r, 105.5, 1e-9)) && spokes.length === 6 && spokes.every((b) => near(b.length, 200, 0.5)) && near(Math.atan2(spokes[1].to[1] - 305.5, spokes[1].to[0] - 305.5) * 180 / Math.PI, 60, 1e-6));
  const chords = B.bars.filter((b) => b.role === 'h' || b.role === 'v');
  check('straight bars are chords: h at the diameter (L 611), v at ±D/6 (L 2·√(r² − (r/3)²))',
    chords.length === 3 && near(chords[0].length, 611, 0.5) && chords.filter((b) => b.role === 'v').every((b) => near(b.length, 2 * Math.sqrt(305.5 ** 2 - (305.5 / 3) ** 2), 0.5)));
  check('PSW circleOffset per window: 150 → ring R 155.5', near(arch.buildCircleBars({ outline: O, pattern: 'sunburst', circleOffset: 150 }, CP.arch.patterns).bars[0].arc.r, 155.5, 1e-9));
  expectThrows('a hub pattern on a circle → ArchError (allowed: none, sunburst)', () => arch.buildCircleBars({ outline: O, pattern: 'hub-spoke' }, CP.arch.patterns), /not available on a circle/);
  const AO = arch.buildGlassOutline(arch.buildArchGeometry({ shape: 'semi-circle', width: 1000, height: 1800 }, CP).glass.arcs, 500 - 94.5, 300);
  expectThrows('sunburst on an arch → ArchError', () => arch.buildArchBars({ outline: AO, shape: 'semi-circle', pattern: 'sunburst' }, CP.arch.patterns), /not available on a Semi-circle/i);
  check('patternsForShape(circle) = none | sunburst; ARCH_BAR_PATTERNS carries sunburst', JSON.stringify(arch.patternsForShape('circle')) === '["none","sunburst"]' && arch.ARCH_BAR_PATTERNS.includes('sunburst'));
  check('glassBars on a circle: edge poly 2 vertices bulge 1 at R 294.5; bar-end rows: spoke ends "from apex", chords y / x, rings R',
    (() => {
      const ep = glassBars.glassEdgePoly(O, 11);
      const rows = glassBars.barEndRows(B.bars, O);
      const sp = rows.find((r) => r.role === 'spoke' && near(r.angle, 60, 1e-6));
      return ep.pts.length === 2 && ep.pts.every((p) => p[2] === 1) && near(ep.arcs[0].r, 294.5, 1e-9)
        && rows.find((r) => r.role === 'h').cells.s === 'y 305.5' && rows.find((r) => r.role === 'ring').cells.s === 'R 105.5'
        && !!sp && sp.end && near(sp.end.s, 305.5 * Math.PI / 6, 0.05) && sp.end.side === 'right';
    })());
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — engine: circle 800 sunburst (fixed) — rings in the cut list, no hardware, true-area glass');
const CIRCLE = cas('CIR', 800, 800, { casementKind: 'fixed', archShape: 'circle', archBarPattern: 'sunburst' });
const DC = derive(CIRCLE);
{
  const box = DC.components.box, sash = DC.components.sash;
  check('windowSpec: category casement, kind fixed, arch.shape circle, rise = start = 400, hinge null', CIRCLE.category === 'casement' && CIRCLE.casement.kind === 'fixed' && CIRCLE.arch.shape === 'circle' && CIRCLE.arch.rise === 400 && CIRCLE.arch.hinge === null);
  check('box = ONE record C-FRAME RING 57x93, L = 2π·371.5 (centre line), planner notes + "fixed leaf"',
    box.length === 1 && box[0].elementName === 'C-FRAME RING' && box[0].code === 'C-FRR' && box[0].section === '57x93' && near(box[0].length, 2334.2, 0.05) && /4 pieces · stock 180/.test(box[0].notes) && /fixed leaf/.test(box[0].notes));
  check('sash = C-LEAF RING 67x57 L 2π·326.5 (+ C-TRACERY for the sunburst) — no stiles, no rails, no jambs, no cill',
    sash.map((r) => r.elementName).join(',') === 'C-LEAF RING,C-TRACERY' && sash[0].code === 'C-LFR-P1' && near(sash[0].length, 2051.5, 0.05) && /^18x/.test(sash[1].section));
  check('no hardware: openers 0, hinge / lock picks null, summaries empty, leafWeights null, derived.casement.kind fixed',
    DC.casement.openers === 0 && DC.casement.hardware.hingePicks[0] === null && DC.casement.hardware.lockPicks[0] === null && Object.keys(DC.casement.hardware.hingeSummary).length === 0 && DC.casement.leafWeights[0] === null && DC.casement.kind === 'fixed');
  const g = DC.customGlassUnits[0];
  check('glass: one unit 611 × 611, kind circle, area π·305.5², poly 2 × bulge 1, bars 8 (ring ×2 + 6 spokes)',
    DC.customGlassUnits.length === 1 && g.width === 611 && g.shape.kind === 'circle' && near(g.shape.area, Math.PI * 305.5 ** 2, 1e-3) && g.shape.poly.length === 2 && g.shape.bars.length === 8 && g.shape.pattern === 'sunburst');
  check('derived.arch: shape circle, frame ring plan 4 pieces (leaf ring blocked by the 400 limit — noted, see t25), tracery full mode 7 panes (hub + 6), glassOutline origin (94.5, 94.5) + centreFrame (400, 400)',
    DC.arch.shape === 'circle' && DC.arch.plans.frameHead.totalPieces === 4 && DC.arch.plans.leafTop.noStock && DC.arch.tracery?.mode === 'full' && DC.arch.tracery.panes === 7 && near(DC.arch.glassOutline.origin.x, 94.5, 1e-6) && DC.arch.glassOutline.centreFrame.x === 400);
  check('seals: frame seal = 2π·400 × 1.1 (no jambs, no cill run); paint from π·R² + tracery timber; glass sqm = true area',
    near(DC.consumables.sealFrame.meters, 2 * Math.PI * 0.4 * 1.1, 0.01) && DC.paint.areaSqm >= 0.5 && near(DC.consumables.glass.sqm, Math.PI * 0.3055 ** 2, 0.01));
  check('beading: glazing bead = 2π·305.5 × 1.15, astragal = bar run × 1.15 (both faces)',
    near(DC.components.beading[0].length, Math.round(2 * Math.PI * 305.5 * 1.15), 1) && DC.components.beading.length === 3);
  const noPat = derive(cas('CN', 800, 800, { casementKind: 'fixed', archShape: 'circle' }));
  check('circle without a pattern: no tracery record, bars empty, cut list = the two rings only', noPat.components.sash.length === 1 && noPat.arch.bars.length === 0 && noPat.arch.tracery === null);
  expectThrows('a circle that is not fixed → ArchError', () => derive(cas('CO', 800, 800, { casementKind: 'opening', archShape: 'circle' })), /fixed window/);
  const lists = M.lists.buildCutList ? null : null; void lists;
  check('cut list order carries C-FRAME RING (C-FRR) and C-LEAF RING (C-LFR) rows', M.lists.CUT_LIST_ORDER.some((r) => r.match === 'C-FRAME RING' && r.symbol === 'C-FRR') && M.lists.CUT_LIST_ORDER.some((r) => r.match === 'C-LEAF RING' && r.symbol === 'C-LFR'));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — rectangle fixed = casement 040L minus hardware (derived JSON identical apart from hardware / opening / notes)');
{
  const open = derive(cas('R', 600, 1200, {}));
  const fixed = derive(cas('R', 600, 1200, { casementKind: 'fixed' }));
  check('rectangular 040L: no kind key (absent = opening), 1 opener, hinge pick present, stile notes hinge / lock', open.casement.kind === undefined && open.casement.openers === 1 && !!open.casement.hardware.hingePicks[0] && open.components.sash.some((r) => /hinge/.test(r.notes)) && open.components.sash.some((r) => /lock/.test(r.notes)));
  check('fixed: layout 040L forced, panel hinge fixed, 0 openers, no picks, notes "fixed leaf"', fixed.casement.layout === '040L' && fixed.casement.layoutDef.panels[0].hinge === 'fixed' && fixed.casement.openers === 0 && fixed.casement.hardware.hingePicks[0] === null && fixed.components.sash.every((r) => /fixed leaf/.test(r.notes)));
  check('everything else identical: cut lengths, glass, weights, consumables, paint (stripped JSON byte-equal)', stripOpening(open) === stripOpening(fixed));
  const fixed2 = derive(cas('R2', 1200, 1200, { casementLayout: '120', casementKind: 'fixed' }));
  check('a fixed window ignores the stored layout (120 → 040L, one leaf)', fixed2.casement.layout === '040L' && fixed2.casement.panes === 1);
  check('glass location says fixed', /fixed/.test(fixed.customGlassUnits[0].location));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — arched fixed = arched casement minus hardware');
{
  const fc = { casementType: 'arched', archShape: 'semi-circle', archStart: 1300, archBarPattern: 'hub-spoke', casementHBars: 1 };
  const open = derive(cas('A', 1000, 1800, { ...fc, archHinge: 'left' }));
  const fixed = derive(cas('A', 1000, 1800, { ...fc, casementKind: 'fixed' }));
  check('arched fixed: kind fixed, layout 040L, no hardware, arch geometry + bars + tracery present', fixed.casement.kind === 'fixed' && fixed.casement.layout === '040L' && fixed.casement.openers === 0 && fixed.arch?.shape === 'semi-circle' && fixed.arch.bars.length > 0 && !!fixed.arch.tracery);
  check('stripped JSON identical to the hinged arched casement (rings, plans, glass outline, seals)', stripOpening(open) === stripOpening(fixed));
  const gothic = derive(cas('G', 1000, 2000, { casementType: 'arched', archShape: 'gothic-equilateral', casementKind: 'fixed' }));
  check('gothic fixed derives (C-ARCH HEAD + C-ARCH TOP RAIL, 0 openers)', gothic.components.box[0].elementName === 'C-ARCH HEAD' && gothic.casement.openers === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — import: PSW fix-only product, PC casementKind, errors');
{
  const c = specification.normaliseToWindowSpec({ id: 'P1', name: 'P1', width: 900, height: 900 }, { fullConfig: { windowType: 'fix-only', fixShape: 'circle', fixCircleBarPattern: 'sunburst', fixCircleOffset: 150, casementHBars: 1 } });
  check('PSW fix-only circle → category casement, kind fixed, shape circle, sunburst, circleOffset 150, h 1', c.category === 'casement' && c.casement.kind === 'fixed' && c.arch.shape === 'circle' && c.arch.bars.pattern === 'sunburst' && c.arch.bars.circleOffset === 150 && c.arch.bars.h === 1);
  check('… and derives: sunburst ring at R − 150', near(derive(c).arch.bars.find((b) => b.role === 'ring').arc.r, (900 / 2 - 94.5) - 150, 1e-9));
  const a = specification.normaliseToWindowSpec({ id: 'P2', name: 'P2', width: 1000, height: 1800 }, { fullConfig: { windowType: 'fix-only', fixShape: 'gothic-arch', fixGothicBars: 'intersecting' } });
  check('PSW fix-only gothic-arch + intersecting → gothic-equilateral fixed, rise 0.866 W, pattern intersecting', a.category === 'casement' && a.casement.kind === 'fixed' && a.arch.shape === 'gothic-equilateral' && near(a.arch.rise, 866.03, 0.01) && a.arch.bars.pattern === 'intersecting');
  const s = specification.normaliseToWindowSpec({ id: 'P3', name: 'P3', width: 1000, height: 1500 }, { fullConfig: { windowType: 'fix-only', fixShape: 'semi-circle', fixSemiBarPattern: 'hub-spoke', fixArchRise: 500 } });
  check('PSW fix-only semi-circle + fixArchRise 500 + fixSemiBarPattern → semi-circle fixed, rise 500, hub-spoke', s.arch.shape === 'semi-circle' && s.arch.rise === 500 && s.arch.bars.pattern === 'hub-spoke' && s.casement.kind === 'fixed');
  const r = specification.normaliseToWindowSpec({ id: 'P4', name: 'P4', width: 800, height: 1200 }, { fullConfig: { windowType: 'fix-only', fixShape: 'rectangle' } });
  check('PSW fix-only rectangle → casement fixed, no arch', r.category === 'casement' && r.casement.kind === 'fixed' && r.arch === null);
  const pc = cas('P5', 600, 1200, { casementKind: 'fixed' });
  check('PC casementKind fixed on a plain casement → kind fixed, arch null; default kind opening', pc.casement.kind === 'fixed' && pc.arch === null && cas('P6', 600, 1200, {}).casement.kind === 'opening');
  expectThrows('circle with height ≠ width → ArchError at import', () => cas('P7', 800, 900, { casementKind: 'fixed', archShape: 'circle' }), /height must equal the diameter/);
  expectThrows('unknown pattern on a circle → ArchError at import', () => cas('P8', 800, 800, { casementKind: 'fixed', archShape: 'circle', archBarPattern: 'hub-spoke' }), /not available on a circle/);
  check('item-level casementKind wins over fullConfig', cas('P9', 600, 1200, { casementKind: 'fixed' }, { casementKind: 'opening' }).casement.kind === 'opening');
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — CNC DXF: circle rings (CONTOUR / PIECES / FIT), FIXED LEAF text, samples');
{
  // v4 Block C: the 800 circle's LEAF ring is blocked by the 400 limit → the export skips it honestly; the CNC sample is a 1000 circle
  const r800 = cncExport.archParamsForWindow(CIRCLE, 'CIR');
  check('archParamsForWindow on the 800 circle: skip "below minimum length" naming the leaf ring (4 pieces on 180, shorter edge 390 < 400)', /^no valid blank plan \(below minimum length\): leaf top chain: 4 pieces fit a 180 board but fall below the minimum length \(piece \d of 4: shorter edge 390(\.\d)? < 400/.test(r800.skip || ''), r800.skip);
  const CIRCLE1000 = cas('CIR', 1000, 1000, { casementKind: 'fixed', archShape: 'circle', archBarPattern: 'sunburst' });
  const r = cncExport.archParamsForWindow(CIRCLE1000, 'CIR');
  check('archParamsForWindow accepts the 1000 circle: plan kind circle, rings FRAME RING / LEAF RING, one 360° group per ring', !r.skip && r.params.plan.kind === 'circle' && r.params.plan.frameHead.label === 'FRAME RING' && r.params.plan.leafTop.label === 'LEAF RING' && r.params.plan.plans.frameHead.arcs.length === 1 && r.params.plan.plans.leafTop.arcs.length === 1, r.skip);
  const ents = archDxf.buildArchEntities(r.params.plan, 'CIR', 0, 0);
  const path = resolve(SAMPLES, 'sample_circle_1000_sunburst.dxf');
  writeFileSync(path, dxfWriter.writeDxf(ents, archDxf.ARCH_LAYERS));
  const p = probe(path);
  const texts = p.texts.map((t) => t.text);
  check('DXF texts: CIR - FRAME RING / LEAF RING rows, CIRCLE W1000 RISE500 H1000 FIXED LEAF, RING summary lines, no HINGE', texts.some((t) => t === 'CIR - FRAME RING') && texts.some((t) => t === 'CIR - LEAF RING') && texts.some((t) => t.startsWith('CIRCLE W1000 RISE500 H1000 FIXED LEAF')) && texts.filter((t) => /^RING R\d+ L[\d.]+ 360DEG: FEWEST/.test(t)).length === 2 && !texts.some((t) => /HINGE/.test(t)));
  const fit = p.polys.filter((x) => x.layer === 'FIT');
  const radii = fit.filter((x) => x.closed).flatMap((x) => polyArcs(x.pts.map((pt, i) => [pt[0], pt[1], x.bulges[i]]), true).map((a) => +a.r.toFixed(3)));
  check('FIT row: closed rings 500 / 443, 460 / 393 and the glass circle 405.5; rebate wall R 464 dashed', [500, 443, 460, 393, 405.5].every((w) => radii.some((x) => near(x, w, 0.01))) && fit.some((x) => !x.closed) && polyArcs(fit.find((x) => !x.closed).pts.map((pt, i) => [pt[0], pt[1], fit.find((x) => !x.closed).bulges[i]]), false).every((a) => near(a.r, 464, 0.05)));
  const nPieces = r.params.plan.plans.frameHead.totalPieces + r.params.plan.plans.leafTop.totalPieces;
  check(`CONTOUR / PIECES / ASSEMBLY / FINGER / CLAMPS present, R12; ${nPieces} piece trapezoids (frame ${r.params.plan.plans.frameHead.totalPieces} + leaf ${r.params.plan.plans.leafTop.totalPieces}), every piece jointed at both ends (closed ring)`, p.version === 'AC1009' && ['CONTOUR', 'PIECES', 'ASSEMBLY', 'FINGER', 'CLAMPS'].every((l) => p.counts[l]) && p.polys.filter((x) => x.layer === 'PIECES').length === nPieces && [...r.params.plan.plans.frameHead.pieces, ...r.params.plan.plans.leafTop.pieces].every((pc) => pc.jointedEnds === 2));
  const dl = cncExport.exportArchDxfForWindow(CIRCLE1000, 'CIR');
  check('exportArchDxfForWindow → CIR_arch.dxf', dl.ok && lastName === 'CIR_arch.dxf');
  const fixedArch = cas('AF', 1000, 1800, { casementType: 'arched', archShape: 'semi-circle', archStart: 1300, casementKind: 'fixed' });
  const ra = cncExport.archParamsForWindow(fixedArch, 'AF');
  const ta = archDxf.buildArchEntities(ra.params.plan, 'AF', 0, 0).filter((e) => e.type === 'text').map((e) => e.str);
  check('arched FIXED casement: plan.fixed, text FIXED LEAF instead of HINGE L / R', ra.params.plan.fixed === true && ta.some((t) => /FIXED LEAF$/.test(t)) && !ta.some((t) => /HINGE/.test(t)));
  const hinged = cncExport.archParamsForWindow(cas('AH', 1000, 1800, { casementType: 'arched', archShape: 'semi-circle', archStart: 1300, archHinge: 'right' }), 'AH');
  check('hinged arched casement unchanged: HINGE R text', archDxf.buildArchEntities(hinged.params.plan, 'AH', 0, 0).filter((e) => e.type === 'text').some((e) => /HINGE R$/.test(e.str)));
  const merged = cncExport.exportArchDxfMerged([{ windowSpec: CIRCLE1000, name: 'CIR' }, { windowSpec: fixedArch, name: 'AF' }, { windowSpec: cas('RR', 600, 1200, { casementKind: 'fixed' }), name: 'RR' }], 'Pack F');
  check('merged arch DXF: circle + arched fixed exported, rectangular fixed skipped ("not an arched casement")', merged.ok && merged.exported === 2 && merged.skipped.length === 1 && merged.skipped[0].reason === 'not an arched casement');
}

// ═══════════════════════════════════════════════════════════════════════════
section('7 — glazier DXF + tracery DXF / LSP for the circle (samples)');
{
  const units = glassDxf.shapedGlassUnits(CIRCLE, DC);
  check('shapedGlassUnits: one circle unit', units.length === 1 && units[0].shape.kind === 'circle');
  const r = glassDxf.exportGlassDxfForWindow(CIRCLE, DC, 'CIR');
  check('exportGlassDxfForWindow → CIR_glass.dxf, 1 unit', r.ok && r.units === 1 && lastName === 'CIR_glass.dxf');
  const path = resolve(SAMPLES, 'sample_glass_circle_800_sunburst.dxf');
  writeFileSync(path, await lastBlob.text());
  const p = probe(path);
  const contour = p.polys.find((x) => x.layer === 'GLASS_CONTOUR');
  const edge = p.polys.find((x) => x.layer === 'GLASS_EDGE');
  check('GLASS_CONTOUR: closed, 2 vertices, both arcs R 305.5; GLASS_EDGE arcs R 294.5 (cover 11)', !!contour && contour.closed && contour.n === 2 && polyArcs(contour.pts.map((pt, i) => [pt[0], pt[1], contour.bulges[i]]), true).every((a) => near(a.r, 305.5, 0.01)) && polyArcs(edge.pts.map((pt, i) => [pt[0], pt[1], edge.bulges[i]]), true).every((a) => near(a.r, 294.5, 0.01)));
  const texts = p.texts.map((t) => t.text);
  check('texts: GLASS CIRCLE, DIAMETER 611 R 305.5, BARS 8 PATTERN SUNBURST, spoke ends from apex', texts.some((t) => /GLASS CIRCLE$/.test(t)) && texts.some((t) => t.startsWith('DIAMETER 611 R 305.5')) && texts.some((t) => /BARS 8 PATTERN SUNBURST/.test(t)) && texts.some((t) => /FROM APEX/.test(t)));
  check('GLASS_BARS bands: 2 per straight bar + 2 per arc (ring R 105.5 ± 9)', (p.counts.GLASS_BARS?.POLYLINE || 0) === 16 && p.polys.filter((x) => x.layer === 'GLASS_BARS' && x.arcs > 0).length === 4);
  const tr = cncExport.traceryParamsForWindow(CIRCLE, DC, 'CIR');
  // Piotr 06.09: board = the unit circle + 5.5 all round (rebate 18 − glass 12.5): bbox −5.5 … 616.5
  check('traceryParamsForWindow: circle → full mode, 7 panes, board = the unit circle + 5.5 (bbox −5.5 … 616.5)', !tr.skip && tr.params.build.geom.mode === 'full' && tr.params.build.geom.panes.length === 7 && near(tr.params.build.geom.bbox.minX, -5.5, 1e-6) && near(tr.params.build.geom.bbox.maxX, 611 + 5.5, 1e-6), tr.skip);
  const hubPane = tr.params.build.geom.panes.find((pn) => pn.daylight.edges.length === 2);
  check('the hub pane is a full circle: rail at R 105.5 − 11 + 2, limit at R 105.5 − 11 + 10 (bar half 11)', !!hubPane && near(hubPane.rail.edges[0].arc.r, 105.5 - 11 + 2, 1e-6) && near(hubPane.limit.edges[0].arc.r, 105.5 - 11 + 10, 1e-6));
  const rt = cncExport.exportTraceryDxfForWindow(CIRCLE, DC, 'CIR');
  writeFileSync(resolve(SAMPLES, 'sample_tracery_circle_800_sunburst.dxf'), await lastBlob.text());
  check('exportTraceryDxfForWindow → CIR_tracery.dxf, 7 panes', rt.ok && rt.panes === 7 && lastName === 'CIR_tracery.dxf');
  // 06.09 (Piotr): no LISP export any more — the writer is only a harness cross-check of the entity list
  const lsp = tracery.writeTraceryLsp(rt.build?.entities || cncExport.traceryParamsForWindow(CIRCLE, DC, 'CIR').params.build.entities, tracery.TRACERY_LAYERS, { winNum: 'CIR', pattern: 'sunburst' });
  const parsed = tracery.parseTraceryLsp(lsp);
  check('LISP writer round-trip (harness only): entity count = DXF entity count', parsed.length === cncExport.traceryParamsForWindow(CIRCLE, DC, 'CIR').params.build.entities.length);
  check('exportTraceryLspForWindow is gone (DXF only)', typeof cncExport.exportTraceryLspForWindow === 'undefined');
  const pt = probe(resolve(SAMPLES, 'sample_tracery_circle_800_sunburst.dxf'));
  check('tracery DXF: ARKA_* layers, 7 × PANE + 7 × FRONT_HINGES_3MM, MITRE guides at the spoke corners (12 per outer pane = 24 corners … ≥ 12)', ['ARKA_OUTLINE', 'ARKA_PANE', 'ARKA_FRONT_HINGES_3MM', 'ARKA_MITRE', 'ARKA_SECTION'].every((l) => pt.layers.includes(l)) && (pt.counts.ARKA_PANE?.POLYLINE || 0) === 7 && (pt.counts.ARKA_MITRE?.POLYLINE || 0) >= 12);
}

// ═══════════════════════════════════════════════════════════════════════════
section('8 — sheets: circle sheets concentric on the engine radii; fixed rectangle without the opening symbol');
{
  const S = renderSheets(M, CIRCLE, DC);
  const all = [['elevation', S.elevation], ['frame', S.frame], ['leaf', S.leaf[0].svg]];
  const engineR = [400, 343, 364, 360, 293, 305.5, 105.5 - 11, 105.5 + 11];
  for (const [k, svg] of all) {
    const c = dataAttr(svg, 'data-circle-centre');
    const arcs = svgArcs(svg);
    check(`${k}: circle sheet (Ø 800), no NaN, ${arcs.length} arcs all concentric on the sheet centre, radii ∈ engine set`, /Ø 800/.test(svg) && !/NaN/.test(svg) && !!c && arcs.length >= 6 && arcs.every((a) => near(a.cx, c[0], 0.01) && near(a.cy, c[1], 0.01) && engineR.some((r) => near(a.r, r, 0.01))), arcs.filter((a) => !engineR.some((r) => near(a.r, r, 0.01))).map((a) => a.r.toFixed(2)).join(' '));
  }
  check('elevation / leaf carry the glass + bars, frame sheet does not; texts name the rings', /R 305.5/.test(S.elevation) && /R 305.5/.test(S.leaf[0].svg) && !/R 305.5/.test(S.frame) && /C-FRAME RING 57 face/.test(S.frame) && /C-LEAF RING 67 face/.test(S.leaf[0].svg));
  const gsvg = S.glass[0].svg;
  const go = dataAttr(gsvg, 'data-arch-origin');
  const garcs = svgArcs(gsvg);
  const gR = [305.5, 294.5, 105.5 - 9, 105.5 + 9];
  check('glass sheet: circle unit, arcs concentric on (ox + 305.5, oy + 305.5), radii 305.5 / 294.5 / ring band 96.5 – 114.5, no springing dims',
    /Circle · Ø 611/.test(gsvg) && garcs.length >= 6 && garcs.every((a) => near(a.cx, go[0] + 305.5, 0.01) && near(a.cy, go[1] + 305.5, 0.01) && gR.some((r) => near(a.r, r, 0.01))) && !/springing/.test(gsvg), garcs.map((a) => a.r.toFixed(1)).join(' '));
  const open = deriveItem(M, { id: 'f', name: 'RF', width: 600, height: 1200 }, { windowCategory: 'casement', casementLayout: '040L' });
  const fixed = deriveItem(M, { id: 'f', name: 'RF', width: 600, height: 1200 }, { windowCategory: 'casement', casementLayout: '040L', casementKind: 'fixed' });
  const So = renderSheets(M, open.spec, open.derived), Sf = renderSheets(M, fixed.spec, fixed.derived);
  const symbol = (svg) => (svg.match(/stroke-dasharray="14\.[34]\d*,9\.6"/g) || []).length;   // opening symbol dashes (sw(6), sw(4) at sc 2.4 → 14.4 with float noise)
  check('rectangular fixed elevation: no opening symbol (the hinged one has it); frame sheet identical; glass sheet identical apart from the pane role text (P1 fixed)', symbol(So.elevation) === 1 && symbol(Sf.elevation) === 0 && So.frame === Sf.frame && So.glass[0].svg.replace('P1 right', 'P1 fixed') === Sf.glass[0].svg);
}

// ═══════════════════════════════════════════════════════════════════════════
section('9 — 3D config (windowSpecToConfig): fixed leaf, circle → fix-frame viewer');
{
  const f = wsc.windowSpecToConfig(cas('F', 600, 1200, { casementKind: 'fixed' }));
  check('rectangular fixed → casementProps.casementHinges [fixed], layout 040L, fixedLeaf true', JSON.stringify(f.casementProps.casementHinges) === '["fixed"]' && f.casementProps.layout === '040L' && f.fixedLeaf === true);
  const a = wsc.windowSpecToConfig(cas('A', 1000, 1800, { casementType: 'arched', archShape: 'semi-circle', archStart: 1300, casementKind: 'fixed' }));
  check('arched fixed → casementType arched + fixedLeaf true (ArchedCasementWindow: no handle, opening 0)', a.casementType === 'arched' && a.fixedLeaf === true && a.casArchShape === 'semi-circle');
  const c = wsc.windowSpecToConfig(CIRCLE);
  check('circle → windowCategory fix-only, fixShape circle, sunburst, offset 200 (profile), 800 × 800', c.windowCategory === 'fix-only' && c.fixShape === 'circle' && c.fixCircleBarPattern === 'sunburst' && c.fixCircleBarOffset === 200 && c.extWidth === 800 && c.extHeight === 800);
  check('opening casement unchanged: fixedLeaf false, hinges from the spec', wsc.windowSpecToConfig(cas('O', 600, 1200, {})).fixedLeaf === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section('10 — structural evidence (grep)');
{
  const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');
  const cfg = src('pages/ConfiguratorPage.jsx');
  check('ConfiguratorPage: Kind chips Opening | Fixed, Shape chips incl. Circle, circle height locked to the width, casementKind saved, buildCirclePlan error blocks the save',
    cfg.includes("const CAS_KINDS = [{ value: 'opening', label: 'Opening' }, { value: 'fixed', label: 'Fixed' }]") && cfg.includes("{ value: 'circle', label: 'Circle' }") && cfg.includes('if (isCircle && Number(inH) !== Number(inW)) setInH(') && (cfg.match(/casementKind: isFixedCas \? 'fixed' : 'opening'/g) || []).length === 1 && cfg.includes('buildCirclePlan({ width: extW, height: extW }') && cfg.includes('disabled={shapeBlocked}'));
  check('ConfiguratorPage: fixed hides the layout picker and the hinge side; circle sends the fix-frame viewer config; pattern chips for the circle',
    cfg.includes('{!isArched && !isFixedCas && (') && cfg.includes('{!isFixedCas && <><Lbl>Hinge side</Lbl>') && cfg.includes("windowCategory: 'fix-only', extWidth: extW, extHeight: extW,") && cfg.includes('<Lbl>Pattern in the circle</Lbl>'));
  const store = src('stores/projectStore.js');
  check('projectStore whitelist: casementKind + fixCircleOffset on both save paths', (store.match(/casementKind: windowConfig\.casementKind \|\| 'opening'/g) || []).length === 2 && (store.match(/fixCircleOffset: windowConfig\.fixCircleOffset \?\? null/g) || []).length === 2);
  check('3D: App passes fixedLeaf to ArchedCasementWindow (opening 0); the component drops the handle', src('3d/App.jsx').includes('fixedLeaf={!!config.fixedLeaf}') && src('3d/components/casement/ArchedCasementWindow.jsx').includes('{!fixedLeaf && (') && src('3d/components/casement/ArchedCasementWindow.jsx').includes('const clampedOpening = fixedLeaf ? 0 :'));
  check('profile: fix.construction fixedLeaf (DEFAULT open), arch.patterns.sunburst { offset 200, spokes 6 }, migrate fills both', CP.fix.construction === 'fixedLeaf' && CP.arch.patterns.sunburst.offset === 200 && CP.arch.patterns.sunburst.spokes === 6 && profile.migrateCasementProfile({ ...CP, fix: undefined, arch: { ...CP.arch, patterns: { hubRingRatios: [0.3, 0.6, 0.8] } } }).arch.patterns.sunburst.spokes === 6);
  check('bom: C-FRAME RING / C-LEAF RING take the head / top-rail stock', src('engine/bom.js').includes("'C-FRAME RING': 'c_frame_head'") && src('engine/bom.js').includes("'C-LEAF RING': 'c_sash_top_rail'"));
  check('sheets: the three casement sheets delegate a circle to CircleFixedDrawing2D after their hooks; the glass sheet closes the circle contour', ['CasementElevation2D', 'CasementFrameDetail2D', 'CasementLeafDetail2D'].every((f) => src(`components/drawings/${f}.jsx`).includes("if (derived?.arch?.shape === 'circle') return <CircleFixedDrawing2D")) && src('components/drawings/CasementGlassDrawing2D.jsx').includes('closedChainD(O.arcs, txG)'));
  check('engine: the profile switch fix.construction is read and only fixedLeaf is accepted (readable error)', src('engine/calculations.js').includes("if (isFixed && fixConstruction !== 'fixedLeaf') throw new ArchError("));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
