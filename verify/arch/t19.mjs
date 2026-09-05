/**
 * t19 — arched-casement-v2 night-4 harness (spec docs/handover/ARCHED-CASEMENT-v2.md §4).
 *
 * Renders the four casement sheets with react-dom/server on the REAL data path
 * (PC item → normaliseToWindowSpec → deriveWindowData → sheet components) and
 * asserts:
 *   1  rectangular casements: the SVG of every sheet is byte-identical to the
 *      pre-night-4 fixture (verify/arch/fixtures/rect-casement-sheets.json,
 *      rendered from 5ba3661 by t19_baseline.mjs);
 *   2  arched sheets (semi-circle 1000×1500, three-centre 1000×1500 start 1300,
 *      gothic 1000×1800; 0 bars and 2v/1h + a pattern): no NaN, every `A`
 *      count = the number of arcs drawn, radius / start / rise labels present,
 *      every <text> anchor inside the viewBox;
 *   3  ONE CONTOUR (Piotr 06.09): every SVG `A` is converted back to its circle
 *      (W3C endpoint → centre parameterisation, an independent formula) and
 *      compared with the bulge polylines of the arch CNC DXF (archDxf
 *      CONTOUR rings) and the glazier DXF (GLASS_CONTOUR / GLASS_BARS) of the
 *      same window: same centres, same radii, ±0.01 mm;
 *   4  3D: archedCasementGeometry (the helper ArchedCasementWindow renders
 *      from) on every shape + the PSW names — vertex counts > 0, outline
 *      extents = W × H ± 1 mm, concentric rings, bars = engine roles;
 *   5  wiring evidence: windowSpecToConfig keys, update3D / App.jsx text.
 *
 * Run: node verify/arch/t19.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, bundleTree, renderSheets, deriveItem } from './lib/sheets.mjs';

const M = await bundleTree(resolve(ROOT, 'src'), 't19', [
  ['archDxf', 'engine/cnc/archDxf.js'],
  ['glassDxf', 'utils/glassDxfExport.js'],
  ['cncExport', 'utils/cncExport.js'],
  ['geo3d', '3d/components/casement/archedCasementGeometry.js'],
  ['wsc', 'utils/windowSpecToConfig.js'],
  ['glassBars', 'engine/glassBars.js'],
]);
const P = M.profile.DEFAULT_CASEMENT_PROFILE;

// ── tiny assert framework ───────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n== ${t} ==`);
const fmtHalf = (n) => { const r = Math.round(n * 2) / 2; return Number.isInteger(r) ? r.toString() : r.toFixed(1); };
const fmtTenth = (n) => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? r.toString() : r.toFixed(1); };

// ── SVG parsing (independent of archDrawUtils) ──────────────────────────────
const countA = (svg) => (svg.match(/ A /g) || []).length;
const viewBox = (svg) => { const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); return m ? [Number(m[1]), Number(m[2])] : null; };
const archOrigin = (svg) => { const m = svg.match(/data-arch-origin="([\d.]+),([\d.]+)"/); return m ? [Number(m[1]), Number(m[2])] : null; };
function textAnchors(svg) {
  const out = [];
  const re = /<text [^>]*?x="([-\d.]+)"[^>]*?y="([-\d.]+)"[^>]*>([^<]*)<\/text>/g;
  let m;
  while ((m = re.exec(svg))) out.push({ x: Number(m[1]), y: Number(m[2]), text: m[3] });
  return out;
}
/** Every `A` command of every path → { cx, cy, r } in sheet coords (W3C F.6.5, rx = ry, no rotation). */
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
          if (den > r * r) r = Math.sqrt(den);          // scale-up rule
          const coef = Math.sqrt(Math.max(0, (r * r - den) / den));
          const s = large !== sweep ? 1 : -1;
          const cxp = s * coef * dy, cyp = -s * coef * dx;
          arcs.push({ cx: cxp + (x1 + x2) / 2, cy: cyp + (y1 + y2) / 2, r: rx, from: [x1, y1], to: [x2, y2] });
          cur = [x2, y2]; i += 7; break;
        }
        default: i++;
      }
    }
  }
  return arcs;
}
/** Bulge polyline → arcs { cx, cy, r } (y up, DXF frame). */
function polyArcs(pts, closed = true) {
  const out = [];
  const n = pts.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const [x1, y1, b] = pts[k];
    const [x2, y2] = pts[(k + 1) % n];
    if (!b) continue;
    const chord = Math.hypot(x2 - x1, y2 - y1);
    const theta = 4 * Math.atan(Math.abs(b));
    const r = chord / (2 * Math.sin(theta / 2));
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const d = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2));
    const nx = -(y2 - y1) / chord, ny = (x2 - x1) / chord;   // left normal
    const sgn = (b > 0 ? 1 : -1) * (theta > Math.PI ? -1 : 1);
    out.push({ cx: mx + sgn * d * nx, cy: my + sgn * d * ny, r, bulge: b });
  }
  return out;
}
const glassEntities = (r) => (Array.isArray(r) ? r : r.entities);   // buildGlassUnitEntities → { entities, width, height }
const sameCircle = (a, b, tol = 0.01) => near(a.cx, b.cx, tol) && near(a.cy, b.cy, tol) && near(a.r, b.r, tol);
const hasCircle = (list, c, tol = 0.01) => list.some((a) => sameCircle(a, c, tol));
const distinctCentres = (list, tol = 0.01) => list.reduce((acc, a) => (acc.some((c) => near(c[0], a.cx, tol) && near(c[1], a.cy, tol)) ? acc : [...acc, [a.cx, a.cy]]), []);

// ── windows ─────────────────────────────────────────────────────────────────
const item = (id, width, height, fields) => ({ id, name: id, width, height, windowCategory: 'casement', casementType: 'arched', ...fields });
const CASES = [
  { id: 'semi', W: 1000, H: 1500, f: { archShape: 'semi-circle', archStart: 1000, archRiseSource: 'custom', archHinge: 'left' }, arcs: 1, pattern: 'hub-spoke', radiiOuter: [500] },
  { id: 'tc', W: 1000, H: 1500, f: { archShape: 'three-centre', archStart: 1300, archRiseSource: 'custom', archHinge: 'right' }, arcs: 3, pattern: 'none', radiiOuter: [150, 1400, 150] },
  { id: 'gothic', W: 1000, H: 1800, f: { archShape: 'gothic-equilateral', archProfile: 'equilateral', archHinge: 'left' }, arcs: 2, pattern: 'intersecting', radiiOuter: [1000, 1000] },
];

// ═══════════════════════════════════════════════════════════════════════════
section('1 — rectangular casements: every sheet byte-identical to the pre-night-4 fixture');
{
  const FX = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-base.json'), 'utf8'));
  const BASE = JSON.parse(readFileSync(resolve(ROOT, 'verify', 'arch', 'fixtures', 'rect-casement-sheets.json'), 'utf8'));
  check(`fixture rendered from ${BASE.ref} (${BASE.commit.slice(0, 7)}) before the sheets were touched`, BASE.commit.startsWith('5ba3661'));
  let sheets = 0;
  for (const [name, c] of Object.entries(FX)) {
    const { spec, derived } = deriveItem(M, { id: 'fx_' + name, width: c.input.width, height: c.input.height, name }, { windowCategory: 'casement', ...c.input.fc });
    const now = renderSheets(M, spec, derived);
    const base = BASE.sheets[name];
    const same = { elevation: now.elevation === base.elevation, frame: now.frame === base.frame,
      leaf: JSON.stringify(now.leaf) === JSON.stringify(base.leaf), glass: JSON.stringify(now.glass) === JSON.stringify(base.glass) };
    sheets += 2 + now.leaf.length + now.glass.length;
    check(`${name} (${c.input.fc.casementLayout}): elevation / frame / ${now.leaf.length} leaf / ${now.glass.length} glass sheets identical, no arch attributes`,
      Object.values(same).every(Boolean) && !/data-arch-origin| A /.test(now.elevation + now.frame), JSON.stringify(same));
  }
  check('22 sheets compared', sheets === 22, String(sheets));
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — arched sheets: NaN-free, A count = arcs drawn, labels, text inside the viewBox');
const RENDERED = {};
for (const c of CASES) {
  for (const variant of ['plain', 'bars']) {
    const fields = variant === 'plain' ? c.f : { ...c.f, casementHBars: 1, casementVBars: 2, archBarPattern: c.pattern };
    const { spec, derived } = deriveItem(M, item(`${c.id}-${variant}`, c.W, c.H, fields));
    const S = renderSheets(M, spec, derived);
    RENDERED[`${c.id}-${variant}`] = { spec, derived, S };
    const A = derived.arch;
    const n = A.geometry.arcs.length;
    const arcBars = A.bars.filter((b) => b.kind === 'arc').length;
    const tag = `${c.id} ${variant}`;
    check(`${tag}: derived.arch has ${c.arcs} arcs, pattern ${variant === 'plain' ? 'none' : c.pattern}, ${A.bars.length} bars`,
      n === c.arcs && A.pattern === (variant === 'plain' ? 'none' : c.pattern) && (variant === 'plain' ? A.bars.length === 0 : A.bars.length > 0), `${n} ${A.pattern} ${A.bars.length}`);
    const all = [S.elevation, S.frame, ...S.leaf.map((l) => l.svg), ...S.glass.map((g) => g.svg)];
    check(`${tag}: one leaf sheet, one glass sheet, no NaN / undefined / Infinity in any sheet`,
      S.leaf.length === 1 && S.glass.length === 1 && all.every((s) => !/NaN|undefined|Infinity/.test(s)));
    // A count = arcs drawn: elevation 7 chains (band 2 + strokes 2 + leaf + daylight + clip), frame 4 (band 2 + strokes 2),
    // leaf 4 (outer, unit, daylight, clip), glass 2 (unit, seal); + 2 per arc bar wherever bars are drawn
    const exp = { elevation: 7 * n + 2 * arcBars, frame: 4 * n, leaf: 4 * n + 2 * arcBars, glass: 2 * n + 2 * arcBars };
    const got = { elevation: countA(S.elevation), frame: countA(S.frame), leaf: countA(S.leaf[0].svg), glass: countA(S.glass[0].svg) };
    check(`${tag}: A count per sheet = arcs drawn ${JSON.stringify(exp)}`, JSON.stringify(got) === JSON.stringify(exp), JSON.stringify(got));
    check(`${tag}: no Bezier / quadratic commands on the arched sheets`, all.every((s) => !/ [CQSTcqst] /.test(s.replace(/<text[^>]*>[^<]*<\/text>/g, ''))));
    // labels
    const outerLabels = c.radiiOuter.map((r) => `R ${fmtHalf(r)}`);
    check(`${tag}: elevation + frame carry every head radius (${outerLabels.join(', ')}), start ${A.geometry.start}, rise ${A.geometry.rise}`,
      outerLabels.every((l) => S.elevation.includes(`>${l}<`) && S.frame.includes(`>${l}<`)) && [S.elevation, S.frame].every((s) => s.includes(`start ${fmtHalf(A.geometry.start)}`) && s.includes(`rise ${fmtHalf(A.geometry.rise)}`)));
    const leafLabels = A.geometry.leafTop.outer.map((a) => `R ${fmtHalf(a.r)}`);
    check(`${tag}: leaf sheet carries the leaf top radii (${leafLabels.join(', ')}), stile ${fmtHalf(A.geometry.leafStraightStile)}, C-ATR`,
      leafLabels.every((l) => S.leaf[0].svg.includes(`>${l}<`)) && S.leaf[0].svg.includes(`stile ${fmtHalf(A.geometry.leafStraightStile)}`) && S.leaf[0].svg.includes('C-ATR'));
    const glassLabels = A.glassOutline.arcs.map((a) => `R ${fmtTenth(a.r)}`);
    check(`${tag}: glass sheet carries the glass radii (${glassLabels.join(', ')}), springing ${fmtTenth(A.glassOutline.springing)}, title "· arched"`,
      glassLabels.every((l) => S.glass[0].svg.includes(`>${l}<`)) && S.glass[0].svg.includes(`springing ${fmtTenth(A.glassOutline.springing)}`) && S.glass[0].svg.includes('mm · arched'));
    check(`${tag}: frame sheet prints C-AH / C-J with the cut-list lengths`, (() => {
      const head = derived.components.box.find((r) => r.elementName === 'C-ARCH HEAD'), jamb = derived.components.box.find((r) => r.elementName === 'C-FRAME JAMB (L)');
      return S.frame.includes(`C-AH ${fmtHalf(head.length)}`) && S.frame.includes(`C-J/L ${fmtHalf(jamb.length)}`) && S.frame.includes(`C-J/R ${fmtHalf(jamb.length)}`);
    })());
    if (variant === 'bars') {
      // E / v3 0.3: the glass sheet prints the glassBars.js bar-end rows — labels beside the bars (≤ 4 bars)
      // or ids beside the bars + every row's cells in the table under the drawing (> 4 bars)
      const rows = M.glassBars.barEndRows(A.bars, A.glassOutline);
      const table = M.glassBars.useBarTable(A.bars);
      const want = table ? rows.flatMap((r) => [r.id, r.cells.s, r.cells.L, r.cells.angle]) : rows.map((r) => r.label);
      check(`${tag}: glass sheet prints ${want.length} bar-end numbers ${table ? 'in the table' : 'beside the bars'} (${want.slice(0, 3).join(' | ')}…)`,
        want.length > 0 && want.every((w) => S.glass[0].svg.includes(`>${w}<`)), want.filter((w) => !S.glass[0].svg.includes(`>${w}<`)).join(' | '));
      check(`${tag}: every arc end on the arch is dimensioned as arc length from the apex (no x · y pairs)`,
        A.bars.filter((b) => b.role === 'tracery' || (b.kind === 'straight' && Math.max(b.from[1], b.to[1]) > A.glassOutline.springing + 0.01))
          .every((b) => { const r = rows.find((x) => x.id === b.id); return r && r.end && r.end.s >= 0; }) && !/>\d+(\.\d)? · \d+(\.\d)?</.test(S.glass[0].svg));
      check(`${tag}: elevation / leaf clip the bars to the daylight (clipPath present, one band path per bar)`,
        /<clipPath id="clip-cas-elev-/.test(S.elevation) && /<clipPath id="clip-cas-leaf-/.test(S.leaf[0].svg) &&
        (S.elevation.match(/<path d="[^"]*" fill="none" stroke="#94A3B8"/g) || []).length === A.bars.length);
    }
    // text inside the viewBox
    for (const [sheetName, svg] of [['elevation', S.elevation], ['frame', S.frame], ['leaf', S.leaf[0].svg], ['glass', S.glass[0].svg]]) {
      const vb = viewBox(svg), texts = textAnchors(svg);
      const out = texts.filter((t) => t.x < 0 || t.x > vb[0] || t.y < 0 || t.y > vb[1]);
      check(`${tag}: ${sheetName} — ${texts.length} text anchors inside the ${vb[0].toFixed(0)} × ${vb[1].toFixed(0)} viewBox`, texts.length > 5 && out.length === 0, out.map((t) => `${t.text}@${t.x.toFixed(0)},${t.y.toFixed(0)}`).join(' | '));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — ONE CONTOUR: SVG A arcs (endpoint → centre) vs DXF bulge polylines of the same window, ±0.01 mm');
for (const key of Object.keys(RENDERED)) {
  const { spec, derived, S } = RENDERED[key];
  const A = derived.arch;
  const W = spec.frame.width, H = spec.frame.height;
  const tolerance = 0.01;
  // — arch CNC DXF (the real export path: cncExport.archParamsForWindow → plan → buildArchEntities)
  const ap = M.cncExport.archParamsForWindow(spec, key);
  check(`${key}: cncExport.archParamsForWindow gives a plan (no skip)`, !!ap.params?.plan && !ap.skip, ap.skip || '');
  if (!ap.params?.plan) continue;
  const ents = M.archDxf.buildArchEntities(ap.params.plan, ap.params.winNum, 0, 0);
  const contours = ents.filter((e) => e.type === 'poly' && e.layer === 'CONTOUR');
  // Rows are laid out bottom-up (leaf top pieces, leaf top contour, head pieces, head contour), each row
  // shifted on its own; a ring poly starts at its OUTER arc start = (W/2 − offset, 0) in the arch frame
  // (rule C), so that vertex pins the row to the arch frame (axis x = 0, springing y = 0, y up).
  const ringOffsets = [P.deductions.leafAtJamb, 0];          // [leaf top ring, frame head ring]
  check(`${key}: arch DXF has 2 CONTOUR rings (leaf top, frame head)`, contours.length === 2, String(contours.length));
  const dxfArch = [];                                          // every DXF ring arc in the arch frame, tagged by ring
  contours.forEach((c, i) => {
    const [x0, y0] = c.pts[0];
    const originX = x0 - (W / 2 - ringOffsets[i]), originY = y0;
    for (const a of polyArcs(c.pts, true)) dxfArch.push({ cx: a.cx - originX, cy: a.cy - originY, r: a.r, ring: i === 0 ? 'leaf' : 'head' });
  });
  const headOuter = dxfArch.filter((d) => d.ring === 'head' && A.geometry.arcs.some((a) => near(a.r, d.r, 1e-6)));
  check(`${key}: DXF head ring outer arcs = derived.arch.geometry.arcs (centres on the arch frame, radii ${A.geometry.radii.join('/')})`,
    headOuter.length === A.geometry.arcs.length && A.geometry.arcs.every((a) => hasCircle(headOuter, { cx: a.cx, cy: a.cy, r: a.r }, 1e-6)));
  // SVG arcs → arch frame: x = X − ox − W/2, y = −(Y − oy − rise)
  const toArch = (svg) => { const o = archOrigin(svg); return svgArcs(svg).map((a) => ({ cx: a.cx - o[0] - W / 2, cy: -(a.cy - o[1] - A.geometry.rise), r: a.r })); };
  for (const [sheetName, svg] of [['elevation', S.elevation], ['frame', S.frame]]) {
    const rel = toArch(svg);
    // rings the sheet shows: head outer (0), leaf outer (leafAtJamb), leaf inner (leafAtJamb + face) — elevation; head outer only — frame
    const shown = sheetName === 'elevation' ? [A.geometry.arcs, A.geometry.leafTop.outer, A.geometry.leafTop.inner] : [A.geometry.arcs];
    const centresDxf = distinctCentres(dxfArch), centresSvg = distinctCentres(rel);
    check(`${key}: ${sheetName} — arc centres = the DXF ring centres (${centresDxf.length} distinct, same set ±0.01)`,
      centresDxf.length === centresSvg.length && centresDxf.every((c) => centresSvg.some((d) => near(c[0], d[0]) && near(c[1], d[1]))),
      `dxf ${JSON.stringify(centresDxf.map((c) => c.map((v) => +v.toFixed(2))))} svg ${JSON.stringify(centresSvg.map((c) => c.map((v) => +v.toFixed(2))))}`);
    // every DXF arc of the rings the sheet draws has an SVG twin (centre + radius)
    const wanted = dxfArch.filter((d) => shown.some((chain) => chain.some((a) => near(a.r, d.r, 1e-6))));
    check(`${key}: ${sheetName} — ${wanted.length} DXF ring arcs (head outer${sheetName === 'elevation' ? ', leaf outer, leaf inner' : ''}) each have an SVG arc with the same centre and radius`,
      wanted.length >= A.geometry.arcs.length && wanted.every((d) => hasCircle(rel, d, tolerance)), wanted.filter((d) => !hasCircle(rel, d, tolerance)).map((d) => `${d.cx.toFixed(2)},${d.cy.toFixed(2)} r${d.r.toFixed(2)}`).join(' | '));
    // the exterior land line = head outer − geometry.land, concentric (same centres)
    const landArcs = headOuter.map((d) => ({ cx: d.cx, cy: d.cy, r: d.r - P.geometry.land })).filter((a) => a.r > 0);
    check(`${key}: ${sheetName} — the land line arcs are the head outer arcs offset by geometry.land ${P.geometry.land} (concentric)`,
      landArcs.length > 0 && landArcs.every((d) => hasCircle(rel, d, tolerance)));
    // every SVG arc is on a DXF centre (nothing drawn from a second geometry)
    check(`${key}: ${sheetName} — every one of the ${rel.length} SVG arcs sits on a DXF ring centre`,
      rel.every((a) => centresDxf.some((c) => near(a.cx, c[0]) && near(a.cy, c[1]))));
    if (sheetName === 'elevation' && A.bars.some((b) => b.kind === 'arc')) {
      // bar bands: r ± 11 around the glazier-DXF bar axes; glass frame → arch frame through glassOutline.origin
      const gu = M.glassDxf.shapedGlassUnits(spec, derived)[0];
      const gents = glassEntities(M.glassDxf.buildGlassUnitEntities(gu, key, 0, 0));
      const barArcs = gents.filter((e) => e.type === 'poly' && e.layer === 'GLASS_BAR_AXES' && e.pts.some((p) => p[2])).flatMap((p) => polyArcs(p.pts, false));
      const ox = A.glassOutline.origin.x - W / 2, oy = A.glassOutline.origin.y - A.geometry.start;
      const twins = barArcs.every((b) => [11, -11].every((d) => hasCircle(rel, { cx: b.cx + ox, cy: b.cy + oy, r: b.r + d }, tolerance)));
      check(`${key}: elevation — ${barArcs.length} glazier-DXF bar-axis arcs (rings / tracery) drawn as 22 mm bands on the same centres (r ± 11)`, barArcs.length > 0 && twins);
    }
  }
  // — glazier DXF vs the glass sheet
  const gu = M.glassDxf.shapedGlassUnits(spec, derived)[0];
  const gents = glassEntities(M.glassDxf.buildGlassUnitEntities(gu, key, 0, 0));
  const contour = gents.find((e) => e.type === 'poly' && e.layer === 'GLASS_CONTOUR');
  const gRel = polyArcs(contour.pts, true).map((a) => ({ cx: a.cx - contour.pts[0][0], cy: a.cy - contour.pts[0][1], r: a.r }));
  const gsvg = S.glass[0].svg;
  const o = archOrigin(gsvg);
  const gsRel = svgArcs(gsvg).map((a) => ({ cx: a.cx - o[0], cy: -(a.cy - (o[1] + A.glassOutline.height)), r: a.r }));   // unit bottom-left
  check(`${key}: glass sheet — ${gRel.length} GLASS_CONTOUR arcs each have an SVG arc with the same centre and radius (unit frame)`,
    gRel.length === A.glassOutline.arcs.length && gRel.every((d) => hasCircle(gsRel, d, tolerance)), gRel.map((d) => `${d.cx.toFixed(2)},${d.cy.toFixed(2)} r${d.r.toFixed(2)}`).join(' | '));
  check(`${key}: glass sheet — the seal arcs are the contour arcs − 11 on the same centres`,
    gRel.every((d) => hasCircle(gsRel, { ...d, r: d.r - 11 }, tolerance)));
  const gBars = gents.filter((e) => e.type === 'poly' && e.layer === 'GLASS_BAR_AXES' && e.pts.some((p) => p[2])).flatMap((p) => polyArcs(p.pts, false));
  if (gBars.length) {
    check(`${key}: glass sheet — ${gBars.length} GLASS_BARS arcs drawn as 18 mm spacer bands (r ± 9) on the same centres`,
      gBars.every((b) => [9, -9].every((d) => hasCircle(gsRel, { ...b, r: b.r + d }, tolerance))));
  }
  check(`${key}: glass sheet — every SVG arc sits on a DXF centre (contour or bar)`,
    gsRel.every((a) => [...gRel, ...gBars].some((d) => near(a.cx, d.cx) && near(a.cy, d.cy))));
  // straight bar bands: the band edges are ±11 (elevation) / ±9 (glass) around the DXF bar axis end points
  const straight = gents.filter((e) => e.type === 'poly' && e.layer === 'GLASS_BAR_AXES' && !e.pts.some((p) => p[2]));
  if (straight.length) {
    const ok = straight.every((p) => {
      const [x0, y0] = p.pts[0], [x1, y1] = p.pts[1];
      const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L * 9, ny = (x1 - x0) / L * 9;
      const corner = [x0 + nx - contour.pts[0][0], y0 + ny - contour.pts[0][1]];
      const sheetPt = [o[0] + corner[0], o[1] + A.glassOutline.height - corner[1]];
      return new RegExp(`M ${sheetPt[0].toFixed(3).replace(/\\.?0+$/, '')} ${sheetPt[1].toFixed(3).replace(/\\.?0+$/, '')} `).test(gsvg) || gsvg.includes(`M ${+sheetPt[0].toFixed(3)} ${+sheetPt[1].toFixed(3)} `);
    });
    check(`${key}: glass sheet — ${straight.length} straight GLASS_BARS axes have a spacer band whose first corner is the axis start ± 9`, ok);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — 3D: archedCasementGeometry (ArchedCasementWindow) on every shape and the PSW names');
{
  const dims = { frameFace: 57, extFace: 36, bottomFace: 68, bottomInner: 47, leafGap: 4, leafFace: 64, gasketW: 19 };
  const opts = { minHaunchRadius: P.arch.minHaunchRadius, patterns: P.arch.patterns, dims };
  const ext = (pts) => pts.reduce((m, [x, y]) => ({ minX: Math.min(m.minX, x), maxX: Math.max(m.maxX, x), minY: Math.min(m.minY, y), maxY: Math.max(m.maxY, y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const shapes = [
    { archShape: 'semi-circle', width: 1000, height: 1500, archRise: 500, exp: 'semi-circle', radii: [500] },
    { archShape: 'three-centre', width: 1000, height: 1500, archRise: 200, exp: 'three-centre', radii: [150, 1400, 150] },
    { archShape: 'gothic-equilateral', width: 1000, height: 1800, archRise: 866.0254, exp: 'gothic-equilateral', radii: [1000, 1000] },
    { archShape: 'gothic-drop', width: 1000, height: 1800, archProfile: 'shallow', exp: 'gothic-drop', radii: [610, 610] },
    { archShape: 'semi-circle', width: 1000, height: 1500, exp: 'semi-circle', radii: [500], psw: true },
    { archShape: 'segmental-arch', width: 1200, height: 1500, exp: 'three-centre', radii: [150, 1320, 150], psw: true },
    { archShape: 'elliptical-arch', width: 1200, height: 1500, exp: 'three-centre', radii: [253.5, 761.5, 253.5], psw: true },
    { archShape: 'gothic-arch', width: 1000, height: 1500, exp: 'gothic-equilateral', radii: [1000, 1000], psw: true },
  ];
  for (const s of shapes) {
    const G = M.geo3d.archedCasementGeometry({ ...s, ...opts });
    const tag = `${s.archShape} ${s.width}×${s.height}${s.archRise ? ' rise ' + s.archRise : s.psw ? ' (PSW name, ratio rise)' : ''}`;
    check(`${tag}: shape ${s.exp}, radii ${s.radii.join('/')}`, G.shape === s.exp && G.radii.length === s.radii.length && G.radii.every((r, i) => near(r, s.radii[i], 0.05)), `${G.shape} ${G.radii.map((r) => r.toFixed(1)).join('/')}`);
    const e = ext(G.outer);
    check(`${tag}: outline extents = W × H ± 1 mm, centred`, near(e.maxX - e.minX, s.width, 1) && near(e.maxY - e.minY, G.height, 1) && near(e.minX, -s.width / 2, 1) && near(e.minY, -G.height / 2, 1), JSON.stringify(e));
    check(`${tag}: vertex counts > 0 on every contour (outer / inner / rebated / gasket / leaf outer / leaf inner)`,
      [G.outer, G.inner, G.innerRebated, G.gasketInner, G.leaf.outer, G.leaf.inner].every((c) => c.length > 3));
    const ei = ext(G.inner), er = ext(G.innerRebated), elo = ext(G.leaf.outer), eli = ext(G.leaf.inner);
    const pointed = G.shape.startsWith('gothic');   // a pointed apex drops by more than the offset
    check(`${tag}: rings nest — inner 57 in, rebated 36 in, leaf outer 40 in, leaf inner 104 in (x extents${pointed ? '' : ' + apex'})`,
      near(ei.maxX, s.width / 2 - 57, 0.01) && near(er.maxX, s.width / 2 - 36, 0.01) && near(elo.maxX, s.width / 2 - 40, 0.01) && near(eli.maxX, s.width / 2 - 104, 0.01) &&
      (pointed || (near(ei.maxY, e.maxY - 57, 0.01) && near(elo.maxY, e.maxY - 40, 0.01) && near(eli.maxY, e.maxY - 104, 0.01))) &&
      (!pointed || (ei.maxY < e.maxY - 57 && elo.maxY < e.maxY - 40 && eli.maxY < e.maxY - 104)));
    check(`${tag}: leaf width = W − 80, leaf bottom = frame bottom + 47 + 4`, near(G.leaf.width, s.width - 80, 1e-9) && near(G.leaf.bottom, -G.height / 2 + 51, 1e-9));
    check(`${tag}: rule C — the outer contour is vertical at the springing (the two points around the chain start share x = W/2)`,
      (() => { const i = G.outer.findIndex((p) => near(p[1], G.springY, 1e-6) && near(p[0], s.width / 2, 1e-6)); return i > 0 && near(G.outer[i - 1][0], s.width / 2, 1e-6); })());
  }
  // bars: engine roles reproduced on the 3D daylight outline (3D leaf face 64 vs profile 67 → same count / roles / pattern)
  const hub = M.geo3d.archedCasementGeometry({ archShape: 'semi-circle', width: 1000, height: 1500, archRise: 500, barPattern: 'hub-spoke', hBars: 1, ...opts });
  const engine = RENDERED['semi-bars'].derived.arch;
  check('3D bars: semi-circle hub-spoke 1H → same bar count and roles as the engine list', hub.bars.length === engine.bars.length && hub.bars.every((b, i) => b.role === engine.bars[i].role && b.kind === engine.bars[i].kind), `${hub.bars.length} vs ${engine.bars.length}`);
  check('3D bars: ring arc centred on the window axis at the springing (3D frame), r = 0.3 × glass half width (396)', (() => { const r = hub.bars.find((b) => b.role === 'ring'); return r && near(r.arc.cx, 0, 1e-6) && near(r.arc.cy, hub.springY, 1e-6) && near(r.arc.r, 0.3 * 396, 1e-6); })());
  const got = M.geo3d.archedCasementGeometry({ archShape: 'gothic-equilateral', width: 1000, height: 1800, archRise: 866.0254, barPattern: 'intersecting', hBars: 1, vBars: 2, ...opts });
  const gEngine = RENDERED['gothic-bars'].derived.arch;
  check('3D bars: gothic intersecting 1H 2V → same count / roles as the engine, tracery arcs centred on the outer frame corners (±500)', got.bars.length === gEngine.bars.length && got.bars.filter((b) => b.role === 'tracery').every((b) => near(Math.abs(b.arc.cx), 500, 1e-6) && near(b.arc.cy, got.springY, 1e-6)));
  const tc = M.geo3d.archedCasementGeometry({ archShape: 'three-centre', width: 1000, height: 1500, archRise: 200, hBars: 1, vBars: 2, ...opts });
  check('3D bars: three-centre 1H 2V → 3 straight bars, the v bars end on the daylight chain (top y above the springing)', tc.bars.length === 3 && tc.bars.filter((b) => b.role === 'v').every((b) => b.to[1] > tc.springY));
  check('3D: a hub pattern on a three-centre is refused by the engine vocabulary → drawn with no pattern', M.geo3d.archedCasementGeometry({ archShape: 'three-centre', width: 1000, height: 1500, archRise: 200, barPattern: 'hub-spoke', ...opts }).pattern === 'none');
  const fb = M.geo3d.safeArchedCasementGeometry({ archShape: 'three-centre', width: 1000, height: 1500, archRise: 700, ...opts });
  check('3D: an impossible rise (700 on W 1000, above half) falls back to the ratio rise with the reason kept', !!fb && fb.shape === 'three-centre' && near(fb.rise, 325, 1e-9) && /use Gothic/.test(fb.fallback));
  check('3D: minHaunchRadius 0 (PSW copy without the profile rule) — the pure rule would give r 96 on 1200/240, below the deepest ring (104 + 10): the drawing floor 114 applies, rings exist',
    (() => { const g = M.geo3d.archedCasementGeometry({ archShape: 'segmental-arch', width: 1200, height: 1500, dims: { ...dims, innerMargin: 10 } }); return near(g.radii[0], 114, 1e-9) && g.ringFloor === 114 && g.leaf.inner.length > 3; })());
  check('3D: minHaunchRadius 150 from the profile wins over the floor (1200/240 → r 150, as production)', near(M.geo3d.archedCasementGeometry({ archShape: 'segmental-arch', width: 1200, height: 1500, ...opts }).radii[0], 150, 1e-9));
  check('3D: contourAt offsets a contour concentrically (leaf inner − 9: extents shrink by 9 on every side)', (() => {
    const c0 = ext(M.geo3d.contourAt(tc.leaf.innerBase, 0, tc.tx)), c9 = ext(M.geo3d.contourAt(tc.leaf.innerBase, 9, tc.tx));
    return near(c0.minX - c9.minX, -9, 1e-6) && near(c0.maxX - c9.maxX, 9, 1e-6) && near(c0.minY - c9.minY, -9, 1e-6) && near(c0.maxY - c9.maxY, 9, 1e-6);
  })());
  check('3D: the frame is at least rise + max(50, leaf straight part 47 + 4 + 64 + 10) high — gothic-arch W 1000 in a 700 high frame → 991, glass outline still valid',
    (() => { const g = M.geo3d.archedCasementGeometry({ archShape: 'gothic-arch', width: 1000, height: 700, dims: { ...dims, innerMargin: 10 } }); return near(g.height, 866.0254 + 125, 0.01) && g.leaf.inner.length > 3; })());
  check('3D: a frame taller than the floor keeps its height (three-centre 1000×1500 → 1500)', M.geo3d.archedCasementGeometry({ archShape: 'three-centre', width: 1000, height: 1500, archRise: 200, ...opts }).height === 1500);
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — wiring: windowSpecToConfig, update3D (ConfiguratorPage), App.jsx (structural evidence)');
{
  const { spec } = RENDERED['tc-bars'];
  const cfg = M.wsc.windowSpecToConfig(spec);
  check('windowSpecToConfig: arched casement → casArchShape = PC name, archRise, archProfile, barPattern, archMinHaunchRadius 150, archPatterns from the profile',
    cfg.casementType === 'arched' && cfg.casArchShape === 'three-centre' && near(cfg.archRise, 200, 1e-9) && cfg.archProfile === null && cfg.barPattern === 'none' && cfg.archMinHaunchRadius === 150 && cfg.archPatterns?.hubRingRatios?.length === 3 && cfg.casArchHinge === 'right', JSON.stringify(cfg));
  const gcfg = M.wsc.windowSpecToConfig(RENDERED['gothic-bars'].spec);
  check('windowSpecToConfig: gothic intersecting → archProfile equilateral, barPattern intersecting, PC shape name', gcfg.casArchShape === 'gothic-equilateral' && gcfg.archProfile === 'equilateral' && gcfg.barPattern === 'intersecting');
  const rect = M.wsc.windowSpecToConfig(M.specification.normaliseToWindowSpec({ id: 'r', width: 1000, height: 1500, name: 'r' }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L' } }));
  check('windowSpecToConfig: rectangular casement unchanged (casementType standard, no arch keys)', rect.casementType === 'standard' && !('archRise' in rect));
  const conf = readFileSync(resolve(ROOT, 'src', 'pages', 'ConfiguratorPage.jsx'), 'utf8');
  check('ConfiguratorPage update3D: casArchShape = the PC shape, barPattern + profile arch rules passed, PC_TO_3D_ARCH gone',
    conf.includes('casArchShape: isArched ? pcArchShape :') && conf.includes('barPattern: isArched ? casArchPattern') && conf.includes('archMinHaunchRadius: getCasementProfile().arch.minHaunchRadius') && !conf.includes('PC_TO_3D_ARCH'));
  const app = readFileSync(resolve(ROOT, 'src', '3d', 'App.jsx'), 'utf8');
  check('3D App: update3D stores archRise / archProfile / barPattern / archMinHaunchRadius / archPatterns and hands them to ArchedCasementWindow',
    ['archRise', 'archProfile', 'barPattern', 'archMinHaunchRadius', 'archPatterns'].every((k) => app.includes(`if (cfg.${k} !== undefined) set`) && app.includes(`${k}={config.${k}`)));
  const comp = readFileSync(resolve(ROOT, 'src', '3d', 'components', 'casement', 'ArchedCasementWindow.jsx'), 'utf8');
  check('ArchedCasementWindow: built on archedCasementGeometry / arch.js, no FixFrameWindow, PSW prop names kept',
    comp.includes("from './archedCasementGeometry.js'") && !/import .*FixFrameWindow/.test(comp) && ['archShape', 'hingeDirection', 'hBars', 'vBars', 'fixSemiBarPattern', 'fixGothicBars', 'archRise', 'archProfile', 'barPattern'].every((k) => comp.includes(`${k} =`) || comp.includes(`${k},`)));
  check('PSW port instructions exist (docs/handover/PSW-3D-ARCH-PORT.md) and list the three files', (() => { const d = readFileSync(resolve(ROOT, 'docs', 'handover', 'PSW-3D-ARCH-PORT.md'), 'utf8'); return d.includes('ArchedCasementWindow.jsx') && d.includes('archedCasementGeometry.js') && d.includes('arch.js') && d.includes('archRise'); })());
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('ALL PASS');
