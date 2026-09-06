/**
 * t22 — ARCHED-WINDOWS-v3 Block 1 F–J harness: the arched SASH beyond the engine —
 * CNC DXF (sash variant + FIT), glazier DXF / tracery for the upper unit, the five
 * sash sheets (arcs = the engine's chains), the 3D helper on arch.js.
 *
 * Sections: 1 rectangular sash sheets byte-identical to the HEAD fixture ·
 * 2 sash arch DXF (S-ARCH HEAD / S-ARCH TOP RAIL rows, FIT with the running gap,
 * ezdxf round-trip, samples) · 3 glazier DXF + tracery for the upper unit ·
 * 4 sheets: every SVG arc sits on an engine ring centre / radius (±0.01) ·
 * 5 3D helper (archedSashGeometry.js): engine chains, fallback, PC ↔ PSW names ·
 * 6 structural evidence.
 *
 * Run: node verify/arch/t22.mjs   (needs ezdxf; writes docs/handover/samples/sample_sash_arch_*.dxf)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bundleSashTree, renderSashSheets, ROOT, AUDIT } from './lib/sashSheets.mjs';

mkdirSync(AUDIT, { recursive: true });
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');
mkdirSync(SAMPLES, { recursive: true });

const M = await bundleSashTree(resolve(ROOT, 'src'), 't22', [
  ['archDxf', 'engine/cnc/archDxf.js'],
  ['dxfWriter', 'engine/cnc/dxfWriter.js'],
  ['cncExport', 'utils/cncExport.js'],
  ['glassDxf', 'utils/glassDxfExport.js'],
  ['tracery', 'engine/cnc/traceryExport.js'],
  ['geo3d', '3d/components/archedSashGeometry.js'],
  ['wsc', 'utils/windowSpecToConfig.js'],
]);
const { specification, calculations, arch, profile, archDxf, dxfWriter, cncExport, glassDxf, tracery, geo3d, wsc } = M;
const SP = profile.DEFAULT_SASH_PROFILE;

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
const psw = (id, width, height, fc) => specification.normaliseToWindowSpec({ id, name: id, width, height }, { fullConfig: { windowCategory: 'sash', sashType: 'arched-group', ...fc } });
const derive = (spec) => calculations.deriveWindowData(spec, {});
// download stubs
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
const archOrigin = (svg) => { const m = /data-arch-origin="([^"]+)"/.exec(svg); return m ? m[1].split(',').map(Number) : null; };

// ═══════════════════════════════════════════════════════════════════════════
section('1 — rectangular sash sheets: byte-identical to the HEAD fixture (elevation, box, upper, lower, glass ×2, section)');
{
  const FXS = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-sheets.json'), 'utf8'));
  const FXB = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-sash-base.json'), 'utf8'));
  for (const [name, sheets] of Object.entries(FXS)) {
    const c = FXB[name];
    const spec = specification.normaliseToWindowSpec({ id: 'fx_' + name, name, width: c.input.width, height: c.input.height }, { fullConfig: c.input.fc });
    const live = renderSashSheets(M, spec, derive(spec));
    const diff = Object.keys(sheets).filter((k) => live[k] !== sheets[k]);
    check(`rectangular ${name}: ${Object.keys(sheets).length} sheets identical`, diff.length === 0, diff.join(', '));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — sash arch DXF: S-ARCH HEAD / S-ARCH TOP RAIL rows, FIT running gap, ezdxf round-trip, samples');
const CASES = [
  ['semi-circle', psw('SS', 1000, 2200, { archShape: 'semi-circle', archBarPattern: 'hub-spoke', archHBars: 1, lowerHBars: 2 })],
  ['three-centre', psw('ST', 1200, 2400, { archShape: 'elliptical-arch', archHBars: 1, archVBars: 2, lowerHBars: 1 })],
  ['gothic', psw('SG', 1000, 3000, { archShape: 'gothic-arch', archProfile: 'equilateral', archBarPattern: 'intersecting' })],
];
// v4 Block C: the CNC blank plan of the 1000 semi-circle / gothic sash heads is BLOCKED by the 400 shorter-edge limit
// (box head 80 face: 395.5 / gothic side pieces) — the sheets / glazier / 3D cases above keep W 1000; the CNC DXF
// samples use W 1200 (BLOCKERS). The 1000 skips are asserted first.
const CNC_CASES = [
  ['semi-circle', psw('SS', 1200, 2600, { archShape: 'semi-circle', archBarPattern: 'hub-spoke', archHBars: 1, lowerHBars: 2 })],
  ['three-centre', CASES[1][1]],
  ['gothic', psw('SG', 1200, 3400, { archShape: 'gothic-arch', archProfile: 'equilateral', archBarPattern: 'intersecting' })],
];
check('v4: the 1000 semi-circle sash skips the CNC export honestly — box head 3 × 180 shorter edge 395.5 < 400 (below minimum length)', /^no valid blank plan \(below minimum length\): box head chain: 3 pieces fit a 180 board but fall below the minimum length \(piece \d of 3: shorter edge 395(\.\d)? < 400/.test(cncExport.archParamsForWindow(CASES[0][1], 'SS').skip || ''), cncExport.archParamsForWindow(CASES[0][1], 'SS').skip);
check('v4: the 1000 gothic sash skips the CNC export honestly (box head sides below minimum length)', /^no valid blank plan \(below minimum length\): box head side 1/.test(cncExport.archParamsForWindow(CASES[2][1], 'SG').skip || ''), cncExport.archParamsForWindow(CASES[2][1], 'SG').skip);
for (const [name, spec] of CNC_CASES) {
  const r = cncExport.archParamsForWindow(spec, spec.name);
  check(`${name}: archParamsForWindow accepts the arched sash (plan kind sash, no hinge, running gap 9)`, !r.skip && r.params.plan.kind === 'sash' && r.params.plan.hinge === null && near(r.params.plan.fit.gap, SP.deductions.sashWidth / 2 - SP.sashArch.headFace, 1e-9), r.skip);
  if (r.skip) continue;
  const ents = archDxf.buildArchEntities(r.params.plan, spec.name, 0, 0);
  const path = resolve(SAMPLES, `sample_sash_arch_${spec.frame.width}_${name}.dxf`);
  writeFileSync(path, dxfWriter.writeDxf(ents, archDxf.ARCH_LAYERS));
  const p = probe(path);
  const texts = p.texts.map((t) => t.text);
  check(`${name}: DXF rows named S-ARCH HEAD / S-ARCH TOP RAIL, SASH (no hinge), FIT running gap text`, texts.some((t) => t.endsWith('S-ARCH HEAD')) && texts.some((t) => t.endsWith('S-ARCH TOP RAIL')) && texts.some((t) => / SASH$/.test(t)) && texts.some((t) => t.startsWith('RUNNING GAP 9')) && !texts.some((t) => /HINGE/.test(t)));
  const fit = p.polys.filter((x) => x.layer === 'FIT');
  const G = r.params.plan;
  const radii = fit.filter((x) => x.closed).flatMap((x) => polyArcs(x.pts.map((pt, i) => [pt[0], pt[1], x.bulges[i]]), true).map((a) => +a.r.toFixed(3)));
  const want = [...G.head.outer, ...G.head.inner, ...G.topRail.outer, ...G.topRail.inner, ...G.glass.arcs].map((a) => +a.r.toFixed(3));
  check(`${name}: FIT rings = head 0/80, top rail 89/146, glass 133.5 radii (${[...new Set(want)].join(' / ')}), no rebate dashes`, want.every((w) => radii.some((x) => near(x, w, 0.01))) && fit.filter((x) => !x.closed).length === 0);
  check(`${name}: CONTOUR / PIECES / ASSEMBLY / FINGER rows present, R12`, p.version === 'AC1009' && ['CONTOUR', 'PIECES', 'ASSEMBLY', 'FINGER'].every((l) => p.counts[l]));
  const dl = cncExport.exportArchDxfForWindow(spec, spec.name);
  check(`${name}: exportArchDxfForWindow → ${spec.name}_arch.dxf`, dl.ok && lastName === `${spec.name}_arch.dxf`);
}
{
  const t = specification.normaliseToWindowSpec({ id: 'T', name: 'T', width: 1800, height: 2000, frameShape: 'arched', archShape: 'semi-circle' }, { fullConfig: { windowCategory: 'sash', sashType: 'triple' } });
  check('triple sash → skip "triple sash is not arched"', cncExport.archParamsForWindow(t, 'T').skip === 'triple sash is not arched');
  const plain = specification.normaliseToWindowSpec({ id: 'P', name: 'P', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } });
  check('plain sash → skip "not an arched sash"', cncExport.archParamsForWindow(plain, 'P').skip === 'not an arched sash');
  const merged = cncExport.exportArchDxfMerged([{ windowSpec: CNC_CASES[0][1], name: 'SS' }, { windowSpec: plain, name: 'P' }], 'Pack S');
  check('merged arch DXF: 1 sash exported, plain skipped', merged.ok && merged.exported === 1 && merged.skipped.length === 1 && lastName === 'Pack_S_arch.dxf');
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — glazier DXF + tracery for the arched upper unit');
{
  const spec = CASES[0][1], d = derive(spec);
  const units = glassDxf.shapedGlassUnits(spec, d);
  check('shapedGlassUnits: one shaped unit (the upper), rows: upper arched + lower rect', units.length === 1 && units[0].row.location === 'upper' && units[0].shape.kind === 'arched');
  const r = glassDxf.exportGlassDxfForWindow(spec, d, 'SS');
  // night 7 stage 1: the arched sash carries BOTH units now — the arched upper
  // and the rectangular lower the glazier used to get only on the PDF
  check('exportGlassDxfForWindow accepts the sash → SS_glass.dxf, 2 units (arched upper + rectangular lower; was 1)',
    r.ok && r.units === 2 && lastName === 'SS_glass.dxf', JSON.stringify(r));
  const text = await lastBlob.text();
  const path = resolve(SAMPLES, 'sample_glass_sash_1000x2200_semi-circle_hub-spoke.dxf');
  writeFileSync(path, text);
  const p = probe(path);
  const contour = p.polys.find((x) => x.layer === 'GLASS_CONTOUR');
  check('glazier DXF: contour = the upper unit (W − 267 wide, arcs R 366.5), layers incl. GLASS_EDGE / GLASS_BAR_AXES', !!contour && near(contour.bbox[2] - contour.bbox[0], 1000 - 267, 1e-6) && polyArcs(contour.pts.map((pt, i) => [pt[0], pt[1], contour.bulges[i]]), true).every((a) => near(a.r, 500 - 133.5, 0.01)) && ['GLASS_EDGE', 'GLASS_BAR_AXES'].every((l) => p.layers.includes(l)));
  const tr = cncExport.traceryParamsForWindow(spec, d, 'SS');
  // Piotr 06.09: the board reaches the rebate bottom (18) — 5.5 OUTSIDE the unit (unit sits 12.5 in)
  check('traceryParamsForWindow accepts the sash (hub-spoke): full mode, panes > 0, board = the unit −5.5 (rebate 18, glass 12.5)', !tr.skip && tr.params.build.geom.panes.length > 0 && near(tr.params.build.geom.bbox.minX, -5.5, 1e-6), tr.skip);
  const rt = cncExport.exportTraceryDxfForWindow(spec, d, 'SS');
  writeFileSync(resolve(SAMPLES, 'sample_tracery_sash_hub.dxf'), await lastBlob.text());
  check('exportTraceryDxfForWindow → SS_tracery.dxf', rt.ok && lastName === 'SS_tracery.dxf');
  const noPat = derive(CASES[1][1]);
  check('three-centre sash without a pattern → tracery skip "no bar pattern"', /no bar pattern/.test(cncExport.traceryParamsForWindow(CASES[1][1], noPat, 'ST').skip));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — sheets: every SVG arc of the arched sheets sits on an engine ring (centre + radius ±0.01)');
for (const [name, spec] of CASES) {
  const d = derive(spec);
  const A = d.arch, G = A.geometry, W = spec.frame.width;
  const S = renderSashSheets(M, spec, d);
  // arch frame circles (axis x = 0, springing y = 0): rings + glass + bar arcs (glass frame → arch frame)
  const gx = A.glassOutline.origin.x - W / 2, gy = A.glassOutline.origin.y - G.start;
  const circles = [
    ...[...G.head.outer, ...G.head.inner, ...G.topRail.outer, ...G.topRail.inner, ...G.glass.arcs, ...G.arcs].map((a) => ({ cx: a.cx, cy: a.cy, r: a.r })),
    ...A.bars.filter((b) => b.kind === 'arc').flatMap((b) => [-11, 0, 11, -9, 9].map((dr) => ({ cx: b.arc.cx + gx, cy: b.arc.cy + gy, r: b.arc.r + dr }))),
    ...arch.offsetArcs(G.glass.arcs, profile.DEFAULT_CASEMENT_PROFILE.glass.edgeCover.double).map((a) => ({ cx: a.cx, cy: a.cy, r: a.r })),
  ];
  const onRing = (c) => circles.some((k) => near(c.cx, k.cx, 0.01) && near(c.cy, k.cy, 0.01) && near(c.r, k.r, 0.01));
  // elevation: sheet → arch frame: x − (ox + W/2), y → rise − (y − oy)
  {
    const o = archOrigin(S.elevation);
    const rel = svgArcs(S.elevation).filter((a) => a.r > 100).map((a) => ({ cx: a.cx - (o[0] + W / 2), cy: G.rise - (a.cy - o[1]), r: a.r }));   // r ~ 28: the rectangular sill profile bulges
    check(`${name}: elevation — ${rel.length} SVG arcs, every one on an engine ring / glass / bar circle`, rel.length >= 4 && rel.every(onRing), rel.filter((a) => !onRing(a)).map((a) => `${a.cx.toFixed(1)},${a.cy.toFixed(1)} r${a.r.toFixed(1)}`).join(' | '));
    check(`${name}: elevation — start / rise dims, R labels, third title line, no head rectangle`, S.elevation.includes(`start ${Math.round(G.start * 2) / 2}`) && S.elevation.includes('rise ') && S.elevation.includes('>R ') && S.elevation.includes(G.label) && S.elevation.includes('arched sash'));
  }
  {
    const o = archOrigin(S.box);
    const rel = svgArcs(S.box).filter((a) => a.r > 200).map((a) => ({ cx: a.cx - (o[0] + W / 2), cy: G.rise - (a.cy - o[1]), r: a.r }));   // the sill bulge arcs (r ~ 50) are the rectangular sill profile
    check(`${name}: box sheet — ${rel.length} head ring arcs on the engine head ring (outer + 80 inner)`, rel.length >= 2 && rel.every(onRing) && rel.some((a) => G.head.inner.some((k) => near(a.r, k.r, 0.01))));
    check(`${name}: box sheet — S-ARCH HEAD 80 label, start / rise dims`, S.box.includes('S-ARCH HEAD 80') && S.box.includes('start ') && S.box.includes('rise '));
  }
  {
    const o = archOrigin(S.upper);
    const sashW = d.sashWidth, apex = G.topRail.apex.outer;
    // sash sheet → arch frame: x − (ox + sashW/2), y → apex − (y − oy)
    const rel = svgArcs(S.upper).map((a) => ({ cx: a.cx - (o[0] + sashW / 2), cy: apex - (a.cy - o[1]), r: a.r }));
    check(`${name}: upper sash sheet — ${rel.length} arcs on the top rail ring / glass / bars`, rel.length >= 3 && rel.every(onRing), rel.filter((a) => !onRing(a)).map((a) => `${a.cx.toFixed(1)},${a.cy.toFixed(1)} r${a.r.toFixed(1)}`).join(' | '));
    check(`${name}: upper sash sheet — ARCH TOP RAIL label, S-ATR length in the subtitle`, S.upper.includes('ARCH TOP RAIL') && S.upper.includes(`S-ATR ${Math.round(G.topRail.lengths.centre * 2) / 2}`));
  }
  {
    // glass sheet: the shared arched sheet (CasementGlassDrawing2D) in the unit frame
    const o = archOrigin(S.glassUpper);
    const O = A.glassOutline;
    const rel = svgArcs(S.glassUpper).map((a) => ({ cx: a.cx - o[0] + gx, cy: (O.height - (a.cy - o[1])) + gy, r: a.r }));
    check(`${name}: upper glass sheet — ${rel.length} arcs on the glass / edge / bar circles, title "· arched", table or labels`, rel.length >= 2 && rel.every(onRing) && S.glassUpper.includes('· arched'), rel.filter((a) => !onRing(a)).map((a) => `${a.cx.toFixed(1)},${a.cy.toFixed(1)} r${a.r.toFixed(1)}`).join(' | '));
    check(`${name}: lower glass sheet stays rectangular (no A arcs), vertical section names ARCH HEAD / ARCH TOP RAIL`, svgArcs(S.glassLower).length === 0 && S.vsection.includes('ARCH HEAD') && S.vsection.includes('ARCH TOP RAIL'));
  }
  // text inside the viewBox
  // (the box sheet's subtitle sits below the viewBox on every window — pre-existing layout, not checked)
  for (const [sheetName, svg] of [['elevation', S.elevation], ['upper', S.upper], ['glassUpper', S.glassUpper]]) {
    const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
    const anchors = [...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    check(`${name}: ${sheetName} — ${anchors.length} text anchors inside the viewBox`, anchors.every(([x, y]) => x >= vb[0] && x <= vb[0] + vb[2] && y >= vb[1] && y <= vb[1] + vb[3]));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — 3D helper (archedSashGeometry.js): engine chains, constant band, fallback, names; windowSpecToConfig');
{
  const mmToM = (v) => v / 1000;
  const pts = geo3d.engineArcPoints('semi-circle', 1000, 500, 0.2, 0.08, 150, 48, mmToM);
  check('semi-circle 1000, head inset 80: 49 points on r = 0.42 m around (0, springY 0.2)', pts.length === 49 && pts.every((p) => near(Math.hypot(p[0], p[1] - 0.2), 0.42, 1e-9)));
  check('rule C: the chain starts and ends ON the springing at ±0.42 (vertical start)', near(pts[0][1], 0.2, 1e-9) && near(pts[0][0], 0.42, 1e-9) && near(pts[48][0], -0.42, 1e-9));
  const tc = geo3d.engineArcs('three-centre', 1200, 360, 0.083, 150);
  check('three-centre 1200 rise 360, inset 83: three arcs, haunch r = 108 − 83 … constant band (every radius − 83)', tc && tc.length === 3 && tc.every((a, i) => near(arch.archArcs('three-centre', 1200, 360, { minHaunchRadius: 150 })[i].r - a.r, 83, 1e-9)));
  check('apex rise of the inset contour = outline rise − inset (semi-circle)', near(geo3d.engineApexRise('semi-circle', 1000, 500, 0.083, 150, mmToM), 0.417, 1e-9));
  check('a contour the engine cannot offset (three-centre 1000 rise 200: haunch floor 150, inset 0.16) → null (component falls back to the PSW sampler)', geo3d.engineArcs('three-centre', 1000, 200, 0.16, 150) === null && geo3d.engineArcs('three-centre', 1000, 200, 0.147, 150) !== null);
  check('names: PC → PSW twins, PSW ids resolve back to PC, unknown → semi-circle', geo3d.PC_TO_PSW_SHAPE['three-centre'] === 'elliptical-arch' && geo3d.PC_TO_PSW_SHAPE['gothic-drop'] === 'gothic-arch' && geo3d.resolvePcShape('gothic-arch') === 'gothic-equilateral' && geo3d.resolvePcShape('elliptical-arch') === 'three-centre' && geo3d.resolvePcShape('oval') === 'semi-circle' && geo3d.resolvePcShape('gothic-drop') === 'gothic-drop');
  const cfg = wsc.windowSpecToConfig(CASES[0][1]);
  check('windowSpecToConfig: arched sash → sashType arched, archShape semi-circle, archRise 500, barPattern hub-spoke, archHBars 1, lowerHBars 2, minHaunchRadius 150', cfg.sashType === 'arched' && cfg.archShape === 'semi-circle' && cfg.archRise === 500 && cfg.barPattern === 'hub-spoke' && cfg.archHBars === 1 && cfg.lowerHBars === 2 && cfg.archMinHaunchRadius === 150, JSON.stringify([cfg.sashType, cfg.archShape, cfg.archRise, cfg.barPattern]));
  const plain = specification.normaliseToWindowSpec({ id: 'P', name: 'P', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } });
  check('windowSpecToConfig: plain sash keeps its sashType (double)', wsc.windowSpecToConfig(plain).sashType === 'double');
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — structural evidence (grep)');
{
  const app = readFileSync(resolve(ROOT, 'src', '3d', 'App.jsx'), 'utf8');
  const asw = readFileSync(resolve(ROOT, 'src', '3d', 'components', 'ArchedSashWindow.jsx'), 'utf8');
  const par = readFileSync(resolve(ROOT, 'src', '3d', 'components', 'ParametricSashWindow.jsx'), 'utf8');
  const fix = readFileSync(resolve(ROOT, 'src', '3d', 'components', 'fix-frame', 'FixFrameWindow.jsx'), 'utf8');
  check('App.jsx renders ArchedSashWindow for sashType arched with archRise / archMinHaunchRadius / bars', app.includes("config.sashType === 'arched' ? (") && app.includes('<ArchedSashWindow {...config}') && app.includes('archRise={config.archRise') && app.includes('lowerHBars={config.lowerHBars'));
  check('ArchedSashWindow: engine contour builders (arcPtsPC / shapeContourPC / apexRisePC), PSW samplers kept as fallback', asw.includes('arcPtsPC') && asw.includes('shapeContourPC') && asw.includes('apexRisePC') && asw.includes('function archArcPoints(') && asw.includes("from './archedSashGeometry.js'"));
  check('PSW named export blocks present in ParametricSashWindow / FixFrameWindow (port, not copy)', par.includes('\nexport {\n  mm,\n  Sash,') && fix.includes('NAMED EXPORTS'));
  const wdp = readFileSync(resolve(ROOT, 'src', 'pages', 'WindowDetailPage.jsx'), 'utf8');
  // Arch DXF + Tracery stay gated on the arch; the Glass DXF button is wider
  // since night 7 stage 1 (every casement / sash window with glass)
  check('WindowDetailPage: Arch DXF / Tracery for an arched sash, Glass DXF for every casement / sash',
    (wdp.match(/\|\| !!windowSpec\?\.arch\?\.shape\)/g) || []).length >= 2 && wdp.includes("['casement', 'sash'].includes(windowSpec?.category || 'sash')"),
    String((wdp.match(/\|\| !!windowSpec\?\.arch\?\.shape\)/g) || []).length));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
