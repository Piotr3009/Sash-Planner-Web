/**
 * t20 — ARCHED-WINDOWS-v3 Block 0 harness (spec docs/handover/ARCHED-WINDOWS-v3.md).
 *
 * Bundles the engine + export modules into .audit/ with esbuild and asserts on
 * the real data path (normaliseToWindowSpec → deriveWindowData → exports →
 * ezdxf round-trip). Reference numbers are the spec's (0.1 verified numbers,
 * the workshop drawing's own geometry read through ezdxf, closed forms).
 *
 * Sections: 1 FIT view · 2 glazier DXF bands / edge / axes (SVG ↔ DXF ±0.01)
 * · 3 bar-end dimensioning · 4 tracery vs arka_CNC-piotr.dxf · 5 tracery on
 * engine windows + DXF / LSP round-trip + samples · 6 cut list / BOM / paint
 * · 7 hinge identity + profile decisions (0.4b, 0.6) · 8 structural evidence.
 *
 * Run: node verify/arch/t20.mjs   (needs `pip install ezdxf`; writes
 * docs/handover/samples/sample_tracery_*.dxf / .lsp)
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
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(SAMPLES, { recursive: true });
const DWG = resolve(ROOT, 'docs', 'handover', 'workshop', 'arka_CNC-piotr.dxf');

// ── bundle ──────────────────────────────────────────────────────────────────
const ENTRY = resolve(AUDIT, 't20-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as calculations from '../src/engine/calculations.js';",
  "export * as lists from '../src/engine/lists.js';",
  "export * as bom from '../src/engine/bom.js';",
  "export * as glassBars from '../src/engine/glassBars.js';",
  "export * as dxfWriter from '../src/engine/cnc/dxfWriter.js';",
  "export * as archDxf from '../src/engine/cnc/archDxf.js';",
  "export * as tracery from '../src/engine/cnc/traceryExport.js';",
  "export * as glassDxf from '../src/utils/glassDxfExport.js';",
  "export * as cncExport from '../src/utils/cncExport.js';",
  "export * as cdu from '../src/components/drawings/casementDrawUtils.js';",
  "export { default as GlassDrawing } from '../src/components/drawings/CasementGlassDrawing2D.jsx';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 't20-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf',
  `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href);
const { arch, profile, specification, calculations, lists, bom, glassBars, dxfWriter, archDxf, tracery, glassDxf, cncExport } = M;
const P = profile.DEFAULT_CASEMENT_PROFILE;

// ── tiny assert framework ───────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n== ${t} ==`);
function probe(path) {
  const out = execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}
/** arc (centre, radius, span) of a bulge segment P → Q */
function bulgeArc(P, Q, b) {
  const theta = 4 * Math.atan(Math.abs(b));
  const chord = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  const r = chord / (2 * Math.sin(theta / 2));
  const d = r * Math.cos(theta / 2) * Math.sign(b);
  const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
  const nx = -(Q[1] - P[1]) / chord, ny = (Q[0] - P[0]) / chord;
  return { cx: mx + nx * d, cy: my + ny * d, r, theta };
}
function polyArcs(pts, closed) {
  const out = [];
  const n = pts.length, last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) { const b = pts[i][2]; if (b) out.push(bulgeArc(pts[i], pts[(i + 1) % n], b)); }
  return out;
}
const pcItem = (id, width, height, fields) => specification.normaliseToWindowSpec(
  { id, name: id, width, height, windowCategory: 'casement', casementType: 'arched', ...fields });
const derive = (spec) => calculations.deriveWindowData(spec, {});
// browser download stubs (the export wrappers call downloadDxf) — as t18
let lastName = null, lastBlob = null;
globalThis.document = { body: { appendChild() {} }, createElement: () => ({ set href(v) {}, set download(v) { lastName = v; }, click() {}, remove() {} }) };
URL.createObjectURL = (b) => { lastBlob = b; return 'blob:harness'; };
URL.revokeObjectURL = () => {};
/** SVG path `A` commands → arcs { cx, cy, r } in the sheet frame (t19's parser). */
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
          const cxp = s * coef * dy, cyp = -s * coef * dx;
          arcs.push({ cx: cxp + (x1 + x2) / 2, cy: cyp + (y1 + y2) / 2, r: rx });
          cur = [x2, y2]; i += 7; break;
        }
        default: i++;
      }
    }
  }
  return arcs;
}

// ═══════════════════════════════════════════════════════════════════════════
section('1 — FIT view (0.1): W 1200 semi-circle → frame 600 / 543, rebate wall 564, leaf 560 / 493, glass 505.5, gap 4, lap 17');
{
  const plan = arch.buildArchPlan({ shape: 'semi-circle', width: 1200, height: 1700, rise: 600, hinge: 'left' }, P);
  check('geometry: rebateWall + fit exposed by buildArchGeometry', Array.isArray(plan.rebateWall) && plan.fit && plan.fit.gap === P.geometry.gap && plan.fit.lap === P.elements.frameHead.face - P.deductions.leafAtJamb && plan.fit.land === P.geometry.land);
  check('radii: frame 600 / 543, wall 564, leaf 560 / 493, glass 505.5', near(plan.frameHead.outer[0].r, 600, 1e-9) && near(plan.frameHead.inner[0].r, 543, 1e-9) && near(plan.rebateWall[0].r, 564, 1e-9) && near(plan.leafTop.outer[0].r, 560, 1e-9) && near(plan.leafTop.inner[0].r, 493, 1e-9) && near(plan.glass.arcs[0].r, 505.5, 1e-9));
  check('gap between the rebate wall and the leaf outer = geometry.gap (4); lap = 17', near(plan.rebateWall[0].r - plan.leafTop.outer[0].r, P.geometry.gap, 1e-9) && plan.fit.lap === 17);
  const E = archDxf.buildArchEntities(plan, 'F1', 0, 0);
  const path = resolve(AUDIT, 't20_fit_1200.dxf');
  writeFileSync(path, dxfWriter.writeDxf(E, archDxf.ARCH_LAYERS));
  const p = probe(path);
  check('DXF: layer FIT first in ARCH_LAYERS, present in the file', archDxf.ARCH_LAYERS[0].name === 'FIT' && p.layers.includes('FIT'));
  const fit = p.polys.filter((x) => x.layer === 'FIT');
  const closed = fit.filter((x) => x.closed);
  const radii = closed.flatMap((x) => polyArcs(x.pts.map((pt, i) => [pt[0], pt[1], x.bulges[i]]), true).map((a) => +a.r.toFixed(3))).sort((a, b) => a - b);
  check('FIT closed rings: frame ring (600 / 543), leaf ring (560 / 493), glass (505.5) — 5 radii', closed.length === 3 && JSON.stringify(radii) === JSON.stringify([493, 505.5, 543, 560, 600]), JSON.stringify(radii));
  const dashes = fit.filter((x) => !x.closed);
  const dashR = dashes.map((x) => polyArcs(x.pts.map((pt, i) => [pt[0], pt[1], x.bulges[i]]), false)[0]?.r);
  check(`FIT rebate wall: ${dashes.length} dashes on R 564 (20 / 10 mm — dxfWriter has no linetypes; ±0.5 — a 20 mm chord with a 6-decimal bulge)`, dashes.length > 10 && dashR.every((r) => near(r, 564, 0.5)));
  const wallCentre = polyArcs(dashes[0].pts.map((pt, i) => [pt[0], pt[1], dashes[0].bulges[i]]), false)[0];
  const frameCentre = polyArcs(closed[0].pts.map((pt, i) => [pt[0], pt[1], closed[0].bulges[i]]), true)[0];
  check('FIT rings and wall are concentric (same centre ±0.5, dash precision)', near(wallCentre.cx, frameCentre.cx, 0.5) && near(wallCentre.cy, frameCentre.cy, 0.5));
  const texts = p.texts.map((t) => t.text);
  check('FIT text: "GAP 4 LAP 17 (REBATE)" + FIT header, NOT A TOOLPATH', texts.includes('GAP 4 LAP 17 (REBATE)') && texts.some((t) => t.includes('FIT (ASSEMBLY, NOT A TOOLPATH)')));
  check('FIT row is the top row (max y of FIT polys = max y of the drawing)', Math.max(...fit.map((x) => x.bbox[3])) >= Math.max(...p.polys.map((x) => x.bbox[3])) - 1e-6);
  check('CONTOUR / PIECES / ASSEMBLY / FINGER rows still present (per piece for the CNC)', ['CONTOUR', 'PIECES', 'ASSEMBLY', 'FINGER'].every((l) => p.counts[l]));
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — glazier DXF (0.2): layers, bands ±9, edge −11 (per glass type), axes; SVG ↔ DXF ±0.01');
{
  const G = glassBars.readGlassProfile(P, 'double');
  check('profile glass block: barWidth 18, edgeCover double 11 / triple 11 / default 11 (DEFAULT open)', G.barWidth === 18 && G.edgeCover === 11 && P.glass.edgeCover.triple === 11 && P.glass.edgeCover.default === 11);
  check('migrateCasementProfile fills glass + tracery blocks for a stored copy without them', (() => { const m = profile.migrateCasementProfile({ ...P, glass: undefined, tracery: undefined }); return m.glass.barWidth === 18 && m.tracery.paneOffset === 2; })());
  const cases = [
    ['SC', pcItem('SC', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' })],
    ['TC', pcItem('TC', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 })],
    ['GO', pcItem('GO', 1000, 2000, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting', casementHBars: 1, casementVBars: 2 })],
  ];
  for (const [name, spec] of cases) {
    const d = derive(spec);
    const unit = glassDxf.shapedGlassUnits(spec, d)[0];
    const ents = glassDxf.buildGlassUnitEntities(unit, name, 0, 0).entities;
    const path = resolve(AUDIT, `t20_glass_${name}.dxf`);
    writeFileSync(path, dxfWriter.writeDxf(ents, glassDxf.GLASS_LAYERS));
    const p = probe(path);
    check(`${name}: layers GLASS_CONTOUR · GLASS_EDGE · GLASS_BARS · GLASS_BAR_AXES · GLASS_TEXT`, ['GLASS_CONTOUR', 'GLASS_EDGE', 'GLASS_BARS', 'GLASS_BAR_AXES', 'GLASS_TEXT'].every((l) => p.layers.includes(l)));
    const A = d.arch;
    const axes = p.polys.filter((x) => x.layer === 'GLASS_BAR_AXES'), bands = p.polys.filter((x) => x.layer === 'GLASS_BARS');
    check(`${name}: one axis and two band curves per bar (${A.bars.length} bars)`, axes.length === A.bars.length && bands.length === 2 * A.bars.length, `${axes.length} / ${bands.length}`);
    // band arcs = axis arcs ± 9 on the same centre
    const axisArcs = axes.flatMap((x) => polyArcs(x.pts.map((pt, i) => [pt[0], pt[1], x.bulges[i]]), false));
    const bandArcs = bands.flatMap((x) => polyArcs(x.pts.map((pt, i) => [pt[0], pt[1], x.bulges[i]]), false));
    const has = (list, a, dr) => list.some((b) => near(b.cx, a.cx, 0.01) && near(b.cy, a.cy, 0.01) && near(b.r, a.r + dr, 0.01));
    if (axisArcs.length) check(`${name}: ${axisArcs.length} arc axes have band arcs at r ± 9 on the same centres`, axisArcs.every((a) => has(bandArcs, a, 9) && has(bandArcs, a, -9)));
    // straight bands: parallel at ±9
    const straightAxes = axes.filter((x) => !x.bulges.some((b) => b)), straightBands = bands.filter((x) => !x.bulges.some((b) => b));
    if (straightAxes.length) {
      const ok = straightAxes.every((ax) => {
        const [x0, y0] = ax.pts[0], [x1, y1] = ax.pts[1];
        const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * 9, ny = (x1 - x0) / L * 9;
        return [1, -1].every((s) => straightBands.some((bd) => near(bd.pts[0][0], x0 + s * nx, 0.01) && near(bd.pts[0][1], y0 + s * ny, 0.01)));
      });
      check(`${name}: ${straightAxes.length} straight axes have parallel band edges at ±9`, ok);
    }
    // edge line: contour arcs − 11, same centres; straight sides at 11 / Wg − 11 / bottom 11
    const contour = p.polys.find((x) => x.layer === 'GLASS_CONTOUR'), edge = p.polys.find((x) => x.layer === 'GLASS_EDGE');
    const cArcs = polyArcs(contour.pts.map((pt, i) => [pt[0], pt[1], contour.bulges[i]]), true), eArcs = polyArcs(edge.pts.map((pt, i) => [pt[0], pt[1], edge.bulges[i]]), true);
    check(`${name}: GLASS_EDGE arcs = contour arcs − 11 on the same centres (${cArcs.length} arcs)`, cArcs.length === eArcs.length && cArcs.every((a) => has(eArcs, a, -11)));
    check(`${name}: GLASS_EDGE box = contour box inset 11 (bottom / sides), closed`, edge.closed && near(edge.bbox[0], contour.bbox[0] + 11, 1e-6) && near(edge.bbox[1], contour.bbox[1] + 11, 1e-6) && near(edge.bbox[2], contour.bbox[2] - 11, 1e-6));
    // SVG ↔ DXF: the glass sheet draws the same band / edge arcs (centre + radius ±0.01, unit frame)
    const groups = M.cdu.groupCasementGlass(d, spec);
    const svg = renderToStaticMarkup(React.createElement(M.GlassDrawing, { windowSpec: spec, derived: d, group: groups[0] }));
    const o = /data-arch-origin="([^"]+)"/.exec(svg)[1].split(',').map(Number);
    const H = A.glassOutline.height;
    // sheet (y down) → unit frame (y up, unit bottom-left)
    const svgCircles = svgArcs(svg).map((a) => ({ cx: a.cx - o[0], cy: H - (a.cy - o[1]), r: a.r }));
    const hasC = (a) => svgCircles.some((c) => near(c.cx, a.cx, 0.01) && near(c.cy, a.cy, 0.01) && near(c.r, a.r, 0.01));
    check(`${name}: every DXF band arc (${bandArcs.length}) and edge arc (${eArcs.length}) has an SVG A arc with the same centre + radius ±0.01`, [...bandArcs, ...eArcs].every(hasC), [...bandArcs, ...eArcs].filter((a) => !hasC(a)).map((a) => `${a.cx.toFixed(2)},${a.cy.toFixed(2)} r${a.r.toFixed(2)}`).join(' | '));
  }
  // edge cover per glass type: a triple unit reads edgeCover.triple
  const T = pcItem('TT', 1000, 1500, { archShape: 'three-centre', archStart: 1000, glassType: 'triple' });
  check('unitGlassProfile: a triple unit reads glass.edgeCover.triple', glassDxf.unitGlassProfile(glassDxf.shapedGlassUnits(T, derive(T))[0]).edgeCover === P.glass.edgeCover.triple);
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — bar-end dimensioning (0.3): closed forms, table above 4 bars, same rows in sheet / PDF header / DXF');
{
  const spec = pcItem('B1', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' });
  const d = derive(spec);
  const O = d.arch.glassOutline, R = O.arcs[0].r;
  const rows = glassBars.barEndRows(d.arch.bars, O);
  const k1 = rows.find((r) => r.id === 'K1'), k2 = rows.find((r) => r.id === 'K2');
  check('hub-spoke 1000: spoke K1 at 60° ends on the arc — s from apex = R·30° = 212.32 (R 405.5), side R; K2 mirror side L, same number', near(k1.end.s, R * Math.PI / 6, 0.01) && k1.end.side === 'right' && near(k2.end.s, k1.end.s, 1e-9) && k2.end.side === 'left' && near(k1.angle, 60, 1e-6));
  check('ring row: R 121.7 · centre (405.5, 898.5)', rows.find((r) => r.id === 'R1').label === 'R1 R 121.7 · c 405.5 / 898.5');
  check('springing / v rows: positions from the bottom corners (y 898.5 / x 283.9), no apex number below the springing', rows.find((r) => r.id === 'S1').cells.s === 'y 898.5' && rows.find((r) => r.id === 'V1').cells.s === 'x 283.9' && rows.find((r) => r.id === 'V1').end === null);
  check('7 bars → table mode; 3 bars → labels beside the bars', glassBars.useBarTable(d.arch.bars) && !glassBars.useBarTable(derive(pcItem('B2', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementHBars: 1, casementVBars: 2 })).arch.bars));
  const v = derive(pcItem('B3', 1000, 1500, { archShape: 'three-centre', archStart: 1000, casementVBars: 2 }));
  const vr = glassBars.barEndRows(v.arch.bars, v.arch.glassOutline);
  const xg = v.arch.glassOutline.width / 2, x1 = v.arch.bars[0].from[0];
  const expS = R * Math.asin(Math.abs(x1 - xg) / R);
  check('semi-circle 2V: vertical bar end s from apex = R·asin(|x − xg| / R) = ' + expS.toFixed(2), near(vr[0].end.s, expS, 0.01) && near(vr[1].end.s, expS, 0.01) && vr[0].end.side === 'left' && vr[1].end.side === 'right');
  // gothic: the apex is the junction of the two arcs (half the chain length)
  const g = derive(pcItem('B4', 1000, 2000, { archShape: 'gothic-equilateral', casementVBars: 1 }));
  const gr = glassBars.barEndRows(g.arch.bars, g.arch.glassOutline);
  check('gothic 1V: the centre bar ends at the apex — s from apex 0, side "apex"', near(gr[0].end.s, 0, 0.01) && gr[0].end.side === 'apex');
  // DXF text carries the rows (ASCII), the PDF header prints them (t18 §6 covers the PDF)
  const unit = glassDxf.shapedGlassUnits(spec, d)[0];
  const lines = glassDxf.unitTextLines(unit, 'B1');
  check('DXF GLASS_TEXT: BAR ENDS table header + one row per bar, degree sign as DEG', lines.some((l) => l.startsWith('BAR ENDS (TABLE, 7 BARS)')) && lines.filter((l) => /^(V|H|S|R|K|T)\d+  /.test(l)).length === 7 && lines.some((l) => l.includes('212.3 FROM APEX R') && l.includes('60DEG')) && !lines.some((l) => /[^\x00-\x7f]/.test(l)));
  check('the x · y pairs of night 4 are gone from the rows', !rows.some((r) => / \d+(\.\d)? · \d+(\.\d)?$/.test(r.label)));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — tracery (0.4) vs the workshop drawing arka_CNC-piotr.dxf (ezdxf): panes, offsets, corner guides, section');
{
  const T = tracery.readTraceryProfile(P);
  check('profile tracery: paneOffset 2 · profileWidth 8 · ridgeLand 2 · edgeLand 8 · mitreLeg 15 · sides 1 → bar 22, margin 18, limit +10', T.barWidth === 22 && T.edgeMargin === 18 && T.limitOffset === 10 && T.sides === 1 && T.mitreLeg === 15);
  const dwg = JSON.parse(execFileSync('python3', ['-c', `
import ezdxf, json
doc = ezdxf.readfile(${JSON.stringify(DWG)})
out = {'lw': [], 'line': [], 'arc': [], 'point': []}
for e in doc.modelspace():
    t = e.dxftype()
    if t == 'LWPOLYLINE': out['lw'].append({'h': e.dxf.handle, 'layer': e.dxf.layer, 'closed': bool(e.closed), 'pts': [list(p) for p in e.get_points('xyb')]})
    elif t == 'LINE': out['line'].append({'layer': e.dxf.layer, 'a': list(e.dxf.start)[:2], 'b': list(e.dxf.end)[:2]})
    elif t == 'ARC': out['arc'].append({'layer': e.dxf.layer, 'c': list(e.dxf.center)[:2], 'r': e.dxf.radius, 'a0': e.dxf.start_angle, 'a1': e.dxf.end_angle})
    elif t == 'POINT': out['point'].append(list(e.dxf.location)[:2])
print(json.dumps(out))
`], { encoding: 'utf8' }));
  const c = dwg.point[0];
  check('DWG read: CENTRE point, 6 OUTLINE, 6 PANE, 5 FRONT_HINGES_3MM, 20 MITRE polylines, section LINE + ARC on layer 0', !!c && dwg.lw.filter((x) => x.layer === 'OUTLINE').length === 6 && dwg.lw.filter((x) => x.layer === 'PANE').length === 6 && dwg.lw.filter((x) => x.layer === 'FRONT_HINGES_3MM').length === 5 && dwg.lw.filter((x) => x.layer === 'MITRE').length === 20 && dwg.line.length === 1 && dwg.arc.length === 1);
  const R = 600;
  const board = { curves: [tracery.lineCurve([c[0] - R, c[1]], [c[0] + R, c[1]], 'board'), tracery.arcCurve(c, R, 0, Math.PI, 'board')], axisX: c[0], centres: [c] };
  // the DWG pattern = quad-hub-spoke through the engine's own generator on a springing-line outline (ys = 0)
  const outline = arch.buildGlassOutline([{ cx: 0, cy: 0, r: R, a0: 0, a1: Math.PI, clip0: 'archStart', clip1: 'archStart' }], R, 0);
  const barSet = arch.buildArchBars({ outline, shape: 'semi-circle', pattern: 'quad-hub-spoke', h: 0, v: 0, frameHalfWidth: R + 57 }, P.arch.patterns);
  const roles = barSet.byRole;
  check('quad-hub-spoke bars: 2 rings, 5 spokes (0 / 45 / 90 / 135 / 180) × 2 segments (springing role for the two on the line) + hub vertical, no ring-end verticals on a zero-height springing', roles.ring === 2 && roles.springing === 4 && roles.spoke === 7 && !roles.v, JSON.stringify(roles));
  const bars = tracery.barCurves(barSet.bars).map((cv) => (cv.kind === 'line'
    ? tracery.lineCurve([cv.p[0] - R + c[0], cv.p[1] + c[1]], [cv.q[0] - R + c[0], cv.q[1] + c[1]], 'bar')
    : tracery.arcCurve([cv.c[0] - R + c[0], cv.c[1] + c[1]], cv.r, cv.a0, cv.a1, 'bar')));
  const geom = tracery.buildTraceryGeometry(board, bars, T, { mode: 'auto' });
  check('mode auto → quadrant (no pane straddles the axis: hub vertical + 90° spoke), 5 panes, 19 corner guides, no warnings', geom.mode === 'quadrant' && geom.panes.length === 5 && geom.guides.length === 19 && geom.warnings.length === 0, `${geom.mode} ${geom.panes.length} ${geom.guides.length} ${geom.warnings.join('; ')}`);
  const rad = (pts) => polyArcs(pts, true).map((a) => +a.r.toFixed(2)).sort((a, b) => a - b);
  const paneRadii = geom.panes.map((p) => rad(p.daylight.pts));
  const flat = paneRadii.flat().sort((a, b) => a - b);
  check('pane radii 189 / 211 / 389 / 411 / 582 (±0.5): hub R 189, ring band 211–389, outer band 411–582', [189, 211, 389, 411, 582].every((r) => flat.some((x) => near(x, r, 0.5))) && paneRadii.filter((rr) => rr.length === 1 && near(rr[0], 189, 0.5)).length === 1, JSON.stringify(paneRadii));
  check('22 mm between panes across a ring (211 − 189, 411 − 389)', near(211 - 189, T.barWidth, 1e-9) && near(411 - 389, T.barWidth, 1e-9));
  // every DWG OUTLINE pane (5 of them) has a generated daylight with the same vertices (±0.5)
  const dwgPanes = dwg.lw.filter((x) => x.layer === 'OUTLINE' && x.pts.length <= 4 && x.h !== '4D6');
  const sameLoop = (a, b, tol) => a.length === b.length && a.every((p) => b.some((q) => near(p[0], q[0], tol) && near(p[1], q[1], tol)));
  check('the 5 DWG OUTLINE panes match the generated daylights vertex for vertex (±0.5)', dwgPanes.length === 5 && dwgPanes.every((dp) => geom.panes.some((gp) => sameLoop(dp.pts, gp.daylight.pts, 0.5))));
  const dwgPane2 = dwg.lw.filter((x) => x.layer === 'PANE' && x.h !== '4D7'), dwgLimit = dwg.lw.filter((x) => x.layer === 'FRONT_HINGES_3MM');
  check('+2 (PANE) contours match ±0.5 (the DWG hub +2 is drawn ~0.35 off, package §6)', dwgPane2.every((dp) => geom.panes.some((gp) => sameLoop(dp.pts.slice(0, dp.closed ? undefined : -1), gp.rail.pts, 0.5))));
  check('+10 (FRONT_HINGES_3MM) contours match ±0.5', dwgLimit.every((dp) => geom.panes.some((gp) => sameLoop(dp.pts.slice(0, dp.closed ? undefined : -1), gp.limit.pts, 0.5))));
  // offsets are true offsets: rail arcs = daylight arcs ± 2, limit = ± 10 (same centre)
  const offOk = geom.panes.every((p) => {
    const dA = polyArcs(p.daylight.pts, true), rA = polyArcs(p.rail.pts, true), lA = polyArcs(p.limit.pts, true);
    return dA.every((a) => rA.some((b) => near(b.cx, a.cx, 1e-6) && near(b.cy, a.cy, 1e-6) && (near(b.r, a.r + 2, 1e-6) || near(b.r, a.r - 2, 1e-6))) && lA.some((b) => near(b.cx, a.cx, 1e-6) && (near(b.r, a.r + 10, 1e-6) || near(b.r, a.r - 10, 1e-6))));
  });
  check('+2 / +10 keep the arc centres (r ± 2, r ± 10 exactly)', offOk);
  // corner guides: for every DWG MITRE polyline a generated guide with the same apex (±0.5), legs along the same edges
  const mitres = dwg.lw.filter((x) => x.layer === 'MITRE');
  const apexOf = (pts) => (pts.length === 3 ? pts[1] : pts[1]);     // 3-vertex: middle; the two 2-vertex halves: their shared end
  const dirOk = (dwgLeg, apex, gen) => {
    // the DWG leg end lies within 1 mm of one of the generated legs' end points (same edge, ~15 mm)
    return gen.pts.filter((_, i) => i !== 1).some((q) => near(q[0], dwgLeg[0], 1.0) && near(q[1], dwgLeg[1], 1.0));
  };
  let matched = 0;
  for (const m of mitres) {
    const apex = m.pts.length === 3 ? m.pts[1] : (m.h === '581' ? m.pts[0] : m.pts[1]);
    const g = geom.guides.find((x) => near(x.apex[0], apex[0], 0.5) && near(x.apex[1], apex[1], 0.5));
    if (!g) continue;
    const legs = m.pts.filter((p) => !(near(p[0], apex[0], 1e-6) && near(p[1], apex[1], 1e-6)));
    if (legs.every((l) => dirOk(l, apex, g))) matched++;
  }
  check(`every DWG MITRE (20 polylines, 19 corners) has a generated guide: same apex ±0.5, legs along the same edges (±1 mm at 15 mm)`, matched === mitres.length, `${matched} / ${mitres.length}`);
  const g51A = geom.guides.find((x) => near(x.apex[0], -3510.4607, 0.01) && near(x.apex[1], 1888.0181, 0.01));
  check('spec example corner (−3510.46, 1888.02) → legs (−3499.85, 1877.41) and (−3520.84, 1877.19) ±0.02 — DWG orientation, not the package', !!g51A && [[-3499.8541, 1877.4115], [-3520.8413, 1877.1854]].every((e) => [g51A.pts[0], g51A.pts[2]].some((q) => near(q[0], e[0], 0.02) && near(q[1], e[1], 0.02))));
  check('legs are 15 mm along the curve (arc legs carry a bulge = tan(15 / (4 r)))', geom.guides.every((gd) => {
    const [a, apex, b] = gd.pts;
    const legLen = (p, q, bulge) => { const chord = Math.hypot(q[0] - p[0], q[1] - p[1]); if (!bulge) return chord; const th = 4 * Math.atan(Math.abs(bulge)); return chord / (2 * Math.sin(th / 2)) * th; };
    return near(legLen(a, apex, a[2]), 15, 0.01) && near(legLen(apex, b, apex[2]), 15, 0.01);
  }));
  // section verbatim: package polyline == DWG LINE + ARC translated to the low end
  const sec = tracery.SECTION_POLY;
  const L = dwg.line[0], A = dwg.arc[0];
  const low = [A.c[0] + A.r * Math.cos(A.a1 * Math.PI / 180), A.c[1] + A.r * Math.sin(A.a1 * Math.PI / 180)];   // 180° end = the low end
  const top = [A.c[0] + A.r * Math.cos(A.a0 * Math.PI / 180), A.c[1] + A.r * Math.sin(A.a0 * Math.PI / 180)];   // 90° end = the top of the arc
  const lineTop = L.a[1] > L.b[1] ? L.a : L.b;
  check('ARKA_SECTION = (0,0) → bulge −0.414213562373095 → (8,8) → (8,14) verbatim', JSON.stringify(sec) === JSON.stringify([[0, 0, -0.414213562373095], [8, 8, 0], [8, 14, 0]]));
  check('… identical to the DWG LINE 4E9 + ARC 4EA translated to the arc\'s low end: (8,8) = arc top, (8,14) = line top, R 8, 90°, line 6', near(top[0] - low[0], 8, 1e-6) && near(top[1] - low[1], 8, 1e-6) && near(lineTop[0] - low[0], 8, 1e-6) && near(lineTop[1] - low[1], 14, 1e-6) && near(A.r, 8, 1e-9) && near(Math.abs(A.a1 - A.a0), 90, 1e-9));
  check('… and to the package section DXF (Przekroj_R8_pion6_JEDNA_POLILINIA.dxf)', (() => {
    const pk = resolve(ROOT, 'docs', 'handover', 'workshop', 'arka-lsp-package', 'Przekroj_R8_pion6_JEDNA_POLILINIA.dxf');
    if (!existsSync(pk)) return false;
    const j = JSON.parse(execFileSync('python3', ['-c', `import ezdxf, json\ndoc = ezdxf.readfile(${JSON.stringify(pk)})\nprint(json.dumps([[list(p) for p in e.get_points('xyb')] for e in doc.modelspace() if e.dxftype() == 'LWPOLYLINE']))`], { encoding: 'utf8' }));
    const pl = j.find((pts) => pts.length === 3);
    const x0 = pl[0][0], y0 = pl[0][1];
    return pl && sec.every((v, i) => near(pl[i][0] - x0, v[0], 1e-6) && near(pl[i][1] - y0, v[1], 1e-6) && near(pl[i][2], v[2], 1e-9));
  })());
  // board: quadrant outline reaches 7 past the axis (18 − 11, as the DWG's OUTLINE 4D6), −2 reference
  const bx = geom.board.pts.map((p) => p[0] - c[0]);
  check('quadrant board outline: x from −600 to +7 (edge margin 18 from the hub pane at −11, as the DWG 4D6)', near(Math.min(...bx), -600, 1e-6) && near(Math.max(...bx), 7, 1e-6));
  check('ARKA_PANE_ZEWN_REF = board −2 (R 598, x −598 … +5)', near(polyArcs(geom.boardRef.pts, true)[0].r, 598, 1e-6) && near(Math.max(...geom.boardRef.pts.map((p) => p[0] - c[0])), 5, 1e-6));
  // DXF + LSP from the same entity list; round-trip
  const info = { winNum: 'DWG', pattern: 'quad-hub-spoke', spokes: 5, rings: 2, barWidth: T.barWidth, edgeMargin: T.edgeMargin, paneOffset: T.paneOffset, limitOffset: T.limitOffset, mitreLeg: T.mitreLeg, mode: geom.mode };
  const E = tracery.buildTraceryEntities(geom, info);
  const dxfPath = resolve(SAMPLES, 'sample_tracery_dwg_R600_quad-hub-spoke.dxf');
  writeFileSync(dxfPath, dxfWriter.writeDxf(E, tracery.TRACERY_LAYERS));
  const lsp = tracery.writeTraceryLsp(E, tracery.TRACERY_LAYERS, info);
  writeFileSync(resolve(SAMPLES, 'sample_tracery_dwg_R600_quad-hub-spoke.lsp'), lsp);
  const p = probe(dxfPath);
  check('DXF round-trip (ezdxf): R12, ARKA_* layers (8), POLYLINE counts: OUTLINE 6, PANE 5, FRONT_HINGES_3MM 5, MITRE 19, SECTION 1, ZEWN_REF 1, CENTRE point 1',
    p.version === 'AC1009' && tracery.TRACERY_LAYERS.every((l) => p.layers.includes(l.name)) && p.counts.ARKA_OUTLINE?.POLYLINE === 6 && p.counts.ARKA_PANE?.POLYLINE === 5 && p.counts.ARKA_FRONT_HINGES_3MM?.POLYLINE === 5 && p.counts.ARKA_MITRE?.POLYLINE === 19 && p.counts.ARKA_SECTION?.POLYLINE === 1 && p.counts.ARKA_PANE_ZEWN_REF?.POLYLINE === 1 && p.counts.ARKA_CENTRE?.POINT === 1, JSON.stringify(p.counts));
  check('DXF texts: NOT A TOOLPATH, pattern line, START at the section', p.texts.some((t) => t.text === 'NOT A TOOLPATH') && p.texts.some((t) => t.text.includes('PATTERN QUAD-HUB-SPOKE SPOKES 5 RINGS 2 PANES 5')) && p.texts.some((t) => t.text === 'START'));
  const back = tracery.parseTraceryLsp(lsp);
  const norm = (list) => list.map((e) => (e.type === 'poly' ? ['poly', e.layer, e.closed, e.pts.map(([x, y, b]) => [+x.toFixed(6), +y.toFixed(6), +(b || 0).toFixed(6)])] : e.type === 'point' ? ['point', e.layer, +e.x.toFixed(6), +e.y.toFixed(6)] : ['text', e.layer, +e.x.toFixed(6), +e.y.toFixed(6), e.str]));
  check(`LSP parsed back = the same entity list as the DXF (${E.length} entities)`, JSON.stringify(norm(back)) === JSON.stringify(norm(E)));
  check('LSP: (defun c:ARKA …), insertion point prompt, -LAYER for every ARKA_* layer, entmake LWPOLYLINE with 90 / 70 / 10 / 42', lsp.includes('(defun c:ARKA') && lsp.includes('getpoint') && tracery.TRACERY_LAYERS.every((l) => lsp.includes(`(ar:layer "${l.name}"`)) && lsp.includes('"_.-LAYER"') && lsp.includes('(cons 90') && lsp.includes('(cons 70') && lsp.includes('(cons 10') && lsp.includes('(cons 42'));
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — tracery on engine windows: modes, panes, exports, samples');
{
  const cases = [
    ['hub', pcItem('TH', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' }), 'full', 6],
    // an engine window keeps the rectangular part below the springing; hub patterns ignore the user's
    // verticals (PSW rule, BLOCKERS 9.6), so the lower pane straddles the axis → full, never a quadrant
    ['quad', pcItem('TQ', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'quad-hub-spoke', casementVBars: 1 }), 'full', 13],
    ['gothic', pcItem('TG', 1000, 2000, { archShape: 'gothic-equilateral', archBarPattern: 'intersecting', casementHBars: 1, casementVBars: 2 }), 'full', null],
    ['custom', pcItem('TU', 1200, 1800, { archShape: 'three-centre', archStart: 1200, archBarPattern: 'custom', archSpokes: 7, archRings: [0.25, 0.55] }), 'full', null],
  ];
  for (const [name, spec, mode, panes] of cases) {
    const d = derive(spec);
    check(`${name}: derived.arch.tracery present (mode ${d.arch.tracery?.mode}, ${d.arch.tracery?.panes} panes)`, !!d.arch.tracery && d.arch.tracery.mode === mode && (panes == null || d.arch.tracery.panes === panes), JSON.stringify(d.arch.tracery));
    const b = tracery.buildTraceryForDerived(d, P, name);
    check(`${name}: no collapsed pane, timber area > 0, every pane's +10 limit is a closed contour`, b.geom.warnings.length === 0 && b.geom.areas.timber > 0 && b.geom.panes.every((p) => p.limit.pts.length >= 3), b.geom.warnings.join('; '));
    // every pane: positive area, bbox inside the board bbox; Σ pane areas < board area (timber left)
    const bbIn = (a, B) => a.minX >= B.minX - 1e-6 && a.maxX <= B.maxX + 1e-6 && a.minY >= B.minY - 1e-6 && a.maxY <= B.maxY + 1e-6;
    check(`${name}: every pane has a positive area and sits inside the board box; panes cover ${(b.geom.areas.panes / b.geom.areas.board * 100).toFixed(0)} % of the board`, b.geom.panes.every((p) => p.area > 0 && bbIn(tracery.boardBBox(p.daylight.pts), b.geom.bbox)) && b.geom.areas.panes < b.geom.areas.board);
    const r = cncExport.exportTraceryDxfForWindow(spec, d, name);
    const dxfText = await lastBlob.text();
    check(`${name}: exportTraceryDxfForWindow → ${name}_tracery.dxf, ok`, r.ok && lastName === `${name}_tracery.dxf`);
    const path = resolve(SAMPLES, `sample_tracery_${name}.dxf`);
    writeFileSync(path, dxfText);
    const p = probe(path);
    check(`${name}: DXF round-trip: ${p.counts.ARKA_OUTLINE?.POLYLINE} OUTLINE polys = panes + board, MITRE ${p.counts.ARKA_MITRE?.POLYLINE}`, p.counts.ARKA_OUTLINE?.POLYLINE === b.geom.panes.length + 1 && p.counts.ARKA_MITRE?.POLYLINE === b.geom.guides.length);
    // Piotr 06.09: the LISP file is no longer exported (DXF only). The writer stays as a harness
    // cross-check: the same entity list serialised as LISP parses back 1:1.
    const lspText = tracery.writeTraceryLsp(b.entities, tracery.TRACERY_LAYERS, b.info);
    check(`${name}: LISP writer round-trip (harness only, no export button): same entity count as the DXF`, tracery.parseTraceryLsp(lspText).length === b.entities.length);
    check(`${name}: exportTraceryLspForWindow is gone (DXF only)`, typeof cncExport.exportTraceryLspForWindow === 'undefined');
  }
  // no pattern → skip with the reason; rectangular → skip
  const plain = pcItem('TP', 1000, 1500, { archShape: 'three-centre', archStart: 1300, casementVBars: 2 });
  check('no pattern → skip "no bar pattern in the arch"', /no bar pattern/.test(cncExport.traceryParamsForWindow(plain, derive(plain), 'TP').skip));
  const rect = specification.normaliseToWindowSpec({ id: 'R', name: 'R', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L' } });
  check('rectangular casement → skip "not an arched casement", derived has no tracery', cncExport.traceryParamsForWindow(rect, derive(rect), 'R').skip === 'not an arched casement' && !('arch' in derive(rect)));
  // merged
  const m = cncExport.exportTraceryMerged([{ windowSpec: cases[0][1], derived: derive(cases[0][1]), name: 'TH' }, { windowSpec: plain, derived: derive(plain), name: 'TP' }], 'Pack 1', 'dxf');
  check('merged DXF: 1 exported, 1 skipped with reason, Pack_1_tracery.dxf', m.ok && m.exported === 1 && m.skipped.length === 1 && lastName === 'Pack_1_tracery.dxf');
  const ml = cncExport.exportTraceryMerged([{ windowSpec: cases[0][1], derived: derive(cases[0][1]), name: 'TH' }], 'Pack 1', 'lsp');
  check('merged export refuses a LISP kind (DXF only since 06.09)', !!ml.error && /DXF only/.test(ml.error));
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — cut list / BOM / paint: C-TRACERY, elevation keeps 22, glass keeps 18');
{
  const spec = pcItem('CT', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'hub-spoke' });
  const d = derive(spec);
  const rec = d.components.sash.find((c) => c.elementName === 'C-TRACERY');
  const T = tracery.readTraceryProfile(P);
  const bb = d.arch.tracery.bbox;
  check('C-TRACERY record: qty = sides (1), code C-TRY-P1, section boardThickness x blank W, length = blank H (bbox + contourAllowance)', !!rec && rec.quantity === 1 && rec.code === 'C-TRY-P1' && rec.section === `${T.boardThickness}x${Math.round((bb.maxX - bb.minX + 2 * P.arch.contourAllowance) * 10) / 10}` && near(rec.length, bb.maxY - bb.minY + 2 * P.arch.contourAllowance, 0.1), JSON.stringify(rec));
  const groups = lists.buildGroupedCutList(lists.buildCutListForWindow(d, spec).map((r) => ({ ...r, windowName: 'CT' })));
  check('grouped cut list: C-TRY group after C-BR', groups.map((g) => g.symbol).join(' ').endsWith('C-BR C-TRY'), groups.map((g) => g.symbol).join(' '));
  check('BOM slot: C-TRACERY → c_tracery', bom.ELEMENT_TO_PART_ID['C-TRACERY'] === 'c_tracery');
  const noPat = derive(pcItem('CN', 1000, 1500, { archShape: 'three-centre', archStart: 1000 }));
  check('no pattern → no C-TRACERY record, tracery null', !noPat.components.sash.some((c) => c.elementName === 'C-TRACERY') && noPat.arch.tracery === null);
  check('paint area grows by the tracery face (board − panes) / 1e6', near(d.paint.areaSqm, noPat.paint.areaSqm + Math.round(d.arch.tracery.areas.timber / 1e6 * 100) / 100, 0.011), `${d.paint.areaSqm} vs ${noPat.paint.areaSqm} + ${d.arch.tracery.areas.timber / 1e6}`);
  // rectangular casements: byte-identical to the origin/main fixture (t18 §3 does the same; repeated here because the sash record loop changed)
  const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-base.json'), 'utf8'));
  check(`rectangular casements (${Object.keys(FX).length}) derived / cut / glass byte-identical to the fixture`, Object.entries(FX).every(([name, c]) => {
    const rs = specification.normaliseToWindowSpec({ id: 'fx_' + name, width: c.input.width, height: c.input.height, name }, { fullConfig: { windowCategory: 'casement', ...c.input.fc } });
    const rd = derive(rs);
    return JSON.stringify(rd) === JSON.stringify(c.derived) && JSON.stringify(lists.buildCutListForWindow(rd, rs)) === JSON.stringify(c.cut) && JSON.stringify(lists.buildGlassListForWindow(rd, rs)) === JSON.stringify(c.glass);
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
section('7 — 0.4b hinge identity, 0.6 profile decisions, pattern vocabulary');
{
  const psw = (fc) => specification.normaliseToWindowSpec({ width: 1200, height: 2000, name: 'H' }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
  check('PSW casArchHinge "right" → PC hinge right; "left" → left; absent → right (PSW default value) — identity, no inversion', psw({ casementType: 'arched', casArchHinge: 'right' }).arch.hinge === 'right' && psw({ casementType: 'arched', casArchHinge: 'left' }).arch.hinge === 'left' && psw({ casementType: 'arched' }).arch.hinge === 'right');
  check('PC archHinge taken as-is', psw({ casementType: 'arched', archHinge: 'left' }).arch.hinge === 'left');
  check('derived layout follows the value: right → 040R', derive(pcItem('HL', 1000, 1500, { archShape: 'three-centre', archStart: 1300, archHinge: 'right' })).casement.layout === '040R');
  const src = readFileSync(resolve(ROOT, 'src', 'engine', 'specification.js'), 'utf8');
  check('specification.js: no inversion left (`psw === \'right\' ? \'left\'` gone)', !src.includes("psw === 'right' ? 'left' : 'right'"));
  check('0.6: minStraightBelowRise 900, pieceRule narrowest, minHaunchRadius 150, leafAtJamb 40, new minPieceLength 150 (warn)', P.arch.limits.minStraightBelowRise === 900 && P.arch.pieceRule === 'narrowest' && P.arch.minHaunchRadius === 150 && P.deductions.leafAtJamb === 40 && P.arch.minPieceLength === 150);
  const short = arch.buildArchPlan({ shape: 'three-centre', width: 1000, height: 1500, rise: 200, hinge: 'left' }, P);
  check('minPieceLength: the 1000 × 1500 start-1300 head (haunch pieces ~65 mm) is planned, not blocked, and carries shortPieces warnings', short.plans.frameHead.totalPieces > 0 && Array.isArray(short.plans.frameHead.shortPieces) && short.plans.frameHead.shortPieces.length > 0 && short.plans.frameHead.shortPieces[0].includes('150'), JSON.stringify(short.plans.frameHead.shortPieces));
  check('a plan without short pieces warns nothing (semi-circle 1200)', arch.buildArchPlan({ shape: 'semi-circle', width: 1200, height: 1700, rise: 600, hinge: 'left' }, P).plans.frameHead.shortPieces.length === 0);
  check('HUB_PRESETS: quad-hub-spoke = 5 spokes, rings [1/3, 2/3], hubVertical; PSW presets 4 / 6 / 8 spokes, 1 / 2 / 3 rings, no hub vertical', arch.HUB_PRESETS['quad-hub-spoke'].spokes === 5 && near(arch.HUB_PRESETS['quad-hub-spoke'].ringRatios[0], 1 / 3, 1e-12) && arch.HUB_PRESETS['quad-hub-spoke'].hubVertical === true && arch.HUB_PRESETS['hub-spoke'].spokes === 4 && arch.HUB_PRESETS['triple-hub-spoke'].rings === 3 && !arch.HUB_PRESETS['hub-spoke'].hubVertical);
  const cu = derive(pcItem('CU', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'custom', archSpokes: 5, archRings: [0.5] }));
  check('custom 5 spokes / 1 ring: 1 ring, 3 spokes + 2 springing segments, 2 ring-end verticals', cu.arch.bars.filter((b) => b.role === 'ring').length === 1 && cu.arch.bars.filter((b) => b.role === 'spoke').length === 3 && cu.arch.bars.filter((b) => b.role === 'springing').length === 2 && cu.arch.bars.filter((b) => b.role === 'v').length === 2);
  let err = null; try { derive(pcItem('CX', 1000, 1500, { archShape: 'three-centre', archStart: 1000, archBarPattern: 'custom', archSpokes: 2, archRings: [0.5] })); } catch (e) { err = e; }
  check('custom with 2 spokes → readable ArchError (3–9)', err instanceof arch.ArchError && /3–9/.test(err.message));
}

// ═══════════════════════════════════════════════════════════════════════════
section('8 — structural evidence (grep, not proof): buttons, store whitelist, 3D props');
{
  const wdp = readFileSync(resolve(ROOT, 'src', 'pages', 'WindowDetailPage.jsx'), 'utf8');
  const pp = readFileSync(resolve(ROOT, 'src', 'pages', 'ProductionPackPage.jsx'), 'utf8');
  const store = readFileSync(resolve(ROOT, 'src', 'stores', 'projectStore.js'), 'utf8');
  const conf = readFileSync(resolve(ROOT, 'src', 'pages', 'ConfiguratorPage.jsx'), 'utf8');
  check('WindowDetailPage: Tracery DXF button next to Arch DXF, disabled with the reason; no LSP button (06.09)', wdp.includes('Tracery DXF') && !wdp.includes('Tracery LSP') && wdp.includes('traceryParamsForWindow') && wdp.includes('disabled={!!tr.skip}'));
  check('ProductionPackPage: Tracery DXF (all) / LSP (all)', pp.includes('exportTraceryMerged') && pp.includes('Tracery {kind.toUpperCase()} (all)'));
  check('projectStore whitelist: archSpokes / archRings (both create and update paths)', (store.match(/archSpokes: windowConfig\.archSpokes/g) || []).length === 2 && (store.match(/archRings: Array\.isArray\(windowConfig\.archRings\)/g) || []).length === 2);
  check('ConfiguratorPage: custom hub UI (spokes chips 3–9, rings text), saved only while custom', conf.includes("casArchPattern === 'custom'") && conf.includes('Custom hub — spokes') && conf.includes('archSpokes: isCustomHub ? casArchSpokes : null'));
  const app = readFileSync(resolve(ROOT, 'src', '3d', 'App.jsx'), 'utf8');
  check('3D chain: App.jsx / ArchedCasementWindow / windowSpecToConfig carry archSpokes + archRings; geometry helper never throws on bar data', app.includes('archSpokes={config.archSpokes') && readFileSync(resolve(ROOT, 'src', 'utils', 'windowSpecToConfig.js'), 'utf8').includes('archSpokes:') && readFileSync(resolve(ROOT, 'src', '3d', 'components', 'casement', 'archedCasementGeometry.js'), 'utf8').includes('try { barSet = buildArchBars'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
