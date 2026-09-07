/**
 * t25 — ARCHED-WINDOWS-v4 Stage 1 harness: Block C, segment planner v2.
 *
 * EXPECTED values are computed HERE from the spec's formulas (C.1 – C.4) with
 * an independent sampler — never read back from arch.js:
 *   - the chain is partitioned by OUTER arc length into N equal pieces (a
 *     gothic first at the apex), the allowance band (outer + 10 / inner − 10)
 *     is sampled 800 points per arc and projected on the piece CHORD;
 *   - the raw piece = a straight trapezoid `stock` wide centred on the band,
 *     ends on the radial joint planes / the vertical apex axis / SQUARE at the
 *     band extent on the springing (v4 decision, BLOCKERS);
 *   - limits: overall (longer edge + finger 15 per jointed end) ≥ 450,
 *     shorter edge ≥ 400; stock = narrowest of [63 … 200] ≥ W_req;
 *   - fewest = the first N that passes; economy alternative = the first of
 *     N + 1 … N + 3 that passes on a narrower board; default = economy when
 *     the fewest plan's waste (rough × stock − band area) / (rough × stock)
 *     exceeds the profile threshold.
 * Spec C.5 quotes the piece counts and boards asserted below (3 × 150,
 * 2 × 180, 2 + 2 × 120, 3 × 180, 2 × 180; capped at 105 → no valid plan); its
 * edge lengths are allowance-band chords (v1 L / L_in), not raw-piece edges —
 * spec errata E3 in BLOCKERS. The table was computed on the 57 frame the spec
 * had (v4 Block F moved the casement frame to 68 / leafAtJamb 51): section 2
 * checks it on a 57-face variant of the live profile, section 2b re-derives
 * every number on the live frame through verify/arch/lib/indPlanner.mjs —
 * no expectation below is a literal read from the engine. Run: node verify/arch/t25.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { independentPlan as indPlan, sample } from './lib/indPlanner.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
const ENTRY = resolve(AUDIT, 't25-entry.mjs');
writeFileSync(ENTRY, [
  "export * as arch from '../src/engine/arch.js';",
  "export * as profile from '../src/engine/profile.js';",
  "export * as archDxf from '../src/engine/cnc/archDxf.js';",
  "export * as dxfWriter from '../src/engine/cnc/dxfWriter.js';",
  "export * as specification from '../src/engine/specification.js';",
  "export * as calculations from '../src/engine/calculations.js';",
  "export * as cncExport from '../src/utils/cncExport.js';",
  "export * as lists from '../src/engine/lists.js';",
].join('\n'));
const BUNDLE = resolve(AUDIT, 't25-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', ENTRY, '--bundle', '--format=esm', '--external:react', '--platform=node', `--outfile=${BUNDLE}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(BUNDLE).href + `?t=${Date.now()}`);
const { arch, profile, archDxf, dxfWriter, specification, calculations, cncExport, lists } = M;
const P = profile.DEFAULT_CASEMENT_PROFILE;
// v4 Block F (frame 68): every live expectation below is built from these — never from a number read off the engine
const tF = P.elements.frameHead.face, oL = P.deductions.leafAtJamb, tL = P.elements.leafTop.face;   // 68 / 51 / 67 (the allowance A = 10 is asserted on the profile in section 1)
// The spec's C.5 table (Piotr 06.09) was computed on the frame the spec had then — its own premises: "Face 57 head
// ring, allowance 10, finger 15" — with land 36, leafAtJamb 40, leafFullHeight 87, fanFromAxis 54. The table is
// checked on that variant of the LIVE profile (arch / cnc / leaf members / glassInset are the live ones); section 2b
// runs the same five arches on the live 68 frame against the independent planner.
const P57 = { ...P, elements: { ...P.elements, frameHead: { ...P.elements.frameHead, face: 57 }, frameJamb: { ...P.elements.frameJamb, face: 57 } }, geometry: { ...P.geometry, land: 36 }, deductions: { ...P.deductions, leafAtJamb: 40, leafFullHeight: 87, fanFromAxis: 54 } };
const SAMPLES = resolve(ROOT, 'docs', 'handover', 'samples');

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
function expectThrows(name, fn, re) {
  try { fn(); check(name, false, 'did not throw'); }
  catch (e) { check(name, e instanceof arch.ArchError && re.test(e.message), `threw "${e.message}"`); }
}
const section = (t) => console.log(`\n== ${t} ==`);
const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');
const f1 = (v) => Number(v).toFixed(1);
function probe(path) {
  return JSON.parse(execFileSync('python3', [resolve(ROOT, 'verify', 'arch', 'dxf_probe.py'), path], { cwd: ROOT, encoding: 'utf8' }));
}

// ═══ independent planner (spec C.1 – C.4): verify/arch/lib/indPlanner.mjs ═══
const A = 10, FINGER = 15;
const STOCK = [63, 75, 95, 105, 120, 150, 180, 200];
const MIN_CLAMP = 450, MIN_PIECE = 400;
const pt = (a, t) => [a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)];
const independentPlan = (ring, stockList = STOCK, threshold = P.arch.wasteThreshold, limits = { clamp: MIN_CLAMP, piece: MIN_PIECE }) =>
  indPlan(ring, { stock: stockList, threshold, allowance: A, finger: FINGER, minClamp: limits.clamp, minPiece: limits.piece });
void pt;

// ═══════════════════════════════════════════════════════════════════════════
section('1 — profile v4: arch block, cnc block, migration');
{
  check('arch.version 4, stockWidths [63, 75, 95, 105, 120, 150, 180, 200] (50 removed, 120 / 150 added; 200 = the cap, no separate constant)',
    P.arch.version === 4 && JSON.stringify(P.arch.stockWidths) === JSON.stringify(STOCK) && !('maxStockWidth' in P.arch));
  check('arch.minPieceLength 400 (hard), arch.wasteThreshold 0.45, contourAllowance 10, finger 15/16/3.8 kept; maxSegmentAngleDeg / pieceRule gone',
    P.arch.minPieceLength === 400 && P.arch.wasteThreshold === 0.45 && P.arch.contourAllowance === 10 && P.arch.finger.length === 15 && !('maxSegmentAngleDeg' in P.arch) && !('pieceRule' in P.arch));
  check('cnc block: minClampLength 450, clamp { base 130, minThickness 40, maxThickness 98, minPiece 140 }, clampClearance 20',
    P.cnc.minClampLength === 450 && P.cnc.clamp.base === 130 && P.cnc.clamp.minThickness === 40 && P.cnc.clamp.maxThickness === 98 && P.cnc.clamp.minPiece === 140 && P.cnc.clampClearance === 20);
  // the one literal frame check (v4 Block F option B): the live frame every section-2b / 3 / 4 / 6 expectation is derived from
  check('profile v4 Block F: frameHead / frameJamb face 68, land 47 (rebate 21), leafAtJamb 51, leafFullHeight 98, fanFromAxis 65, leafTop.face 67 (the rings: frame r → r − 68, leaf r − 51 → r − 118)',
    tF === 68 && P.elements.frameJamb.face === 68 && P.geometry.land === 47 && P.geometry.rebate === 21 && oL === 51 && P.deductions.leafFullHeight === 98 && P.deductions.fanFromAxis === 65 && tL === 67);
  const v11 = { ...P, arch: undefined, cnc: undefined };
  const m1 = profile.migrateCasementProfile({ ...v11, arch: { version: 3, finger: { length: 15, depth: 16, pitch: 3.8 }, stockWidths: [50, 63, 75, 95, 105, 180, 200], contourAllowance: 10, maxSegmentAngleDeg: 36, pieceRule: 'narrowest', minPieceLength: 150, minHaunchRadius: 150, limits: P.arch.limits, patterns: P.arch.patterns } });
  check('migration: a stored v3 arch block is replaced whole by the v4 default (stock list, 400, threshold; no 36° / pieceRule); cnc filled from the default',
    JSON.stringify(m1.arch) === JSON.stringify(P.arch) && JSON.stringify(m1.cnc) === JSON.stringify(P.cnc));
  const m2 = profile.migrateCasementProfile({ ...P, arch: { ...P.arch, stockWidths: [75, 95, 120], minPieceLength: 350, wasteThreshold: 1 }, cnc: { minClampLength: 500, clamp: { base: 140 } } });
  check('migration: a v4 block is merged key by key (workshop edits survive: stock [75, 95, 120], 350, threshold 1; cnc 500, clamp base 140 + default jaws)',
    JSON.stringify(m2.arch.stockWidths) === '[75,95,120]' && m2.arch.minPieceLength === 350 && m2.arch.wasteThreshold === 1 && m2.arch.finger.length === 15
    && m2.cnc.minClampLength === 500 && m2.cnc.clamp.base === 140 && m2.cnc.clamp.minThickness === 40 && m2.cnc.clampClearance === 20);
  expectThrows('planner: missing arch.minPieceLength throws (no defaults)', () => arch.planArchSegments(arch.buildArchGeometry({ shape: 'semi-circle', width: 1000, height: 1800 }, P).frameHead, { ...P.arch, minPieceLength: undefined }, P.cnc), /minPieceLength is missing/);
  expectThrows('planner: missing arch.wasteThreshold throws', () => arch.planArchSegments(arch.buildArchGeometry({ shape: 'semi-circle', width: 1000, height: 1800 }, P).frameHead, { ...P.arch, wasteThreshold: undefined }, P.cnc), /wasteThreshold is missing/);
  expectThrows('planner: missing cnc.minClampLength throws', () => arch.planArchSegments(arch.buildArchGeometry({ shape: 'semi-circle', width: 1000, height: 1800 }, P).frameHead, P.arch, {}), /cnc\.minClampLength is missing/);
  expectThrows('buildArchPlan without a cnc block throws readably', () => arch.buildArchPlan({ shape: 'semi-circle', width: 1000, height: 1800 }, { ...P, cnc: undefined }), /no "cnc" section/);
}

// ═══════════════════════════════════════════════════════════════════════════
const C5 = [
  { key: 'HALF 1000', input: { shape: 'semi-circle', width: 1000, height: 1800 }, spec: { n: 3, stock: 150, wReq: 134.7, no2: 203.8 } },
  { key: 'ROUND 1000 rise 250', input: { shape: 'three-centre', width: 1000, height: 1800, rise: 250 }, spec: { n: 2, stock: 180, wReq: 158.3 } },
  { key: 'GOTHIC 1000', input: { shape: 'gothic-equilateral', width: 1000, height: 2000 }, spec: { n: 2, stock: 120, wReq: 112.6, perSide: true } },
  { key: 'HALF 1500', input: { shape: 'semi-circle', width: 1500, height: 2400 }, spec: { n: 3, stock: 180, wReq: 168.1, no2: 277 } },
  { key: 'tc240 1200', input: { shape: 'three-centre', width: 1200, height: 2000, rise: 240 }, spec: { n: 2, stock: 180, wReq: 170.6 } },
];
/**
 * The five C.5 arches on one profile variant: ring radii from the profile, then the engine plan against the
 * independent planner on the same ring. `spec` = true asserts the C.5 table numbers as well (they hold on the
 * 57 frame only); false asserts the independent numbers alone. Returns { key: { g, plan, ind, icap } }.
 */
function runC5(PP, spec) {
  const face = PP.elements.frameHead.face, inset = PP.deductions.leafAtJamb, leafFace = PP.elements.leafTop.face;
  const out = {};
  for (const c of C5) {
  const g = arch.buildArchGeometry(c.input, PP);
  const ind = independentPlan(g.frameHead);
  const plan = arch.planArchSegments(g.frameHead, PP.arch, PP.cnc);
  const K = `${c.key} @${face}`;
  check(`${K}: rings from the profile — frame inner = outer − frameHead.face ${face}, leaf = outer − leafAtJamb ${inset} / − (leafAtJamb + leafTop.face) ${inset + leafFace}`,
    g.frameHead.outer.every((a, i) => near(g.frameHead.inner[i].r, a.r - face, 1e-9) && near(g.leafTop.outer[i].r, a.r - inset, 1e-9) && near(g.leafTop.inner[i].r, a.r - inset - leafFace, 1e-9)));
  const groups = plan.arcs;
  check(`${K}: ${c.spec.perSide ? 'two sides (apex joint)' : 'one chain'} planned`, groups.length === ind.length && groups.length === (c.spec.perSide ? 2 : 1));
  groups.forEach((gp, i) => {
    const I = ind[i];
    const tag = c.spec.perSide ? `${K} side ${i + 1}` : K;
    const eo = gp.fewest, io = I.fewest;
    if (spec) {
      check(`${tag}: FEWEST = spec ${c.spec.n} × board ${c.spec.stock} (independent: ${io?.n} × ${io?.stock})`,
        eo?.n === c.spec.n && eo?.stock === c.spec.stock && io?.n === c.spec.n && io?.stock === c.spec.stock, `${eo?.n} × ${eo?.stock}`);
      check(`${tag}: W_req of the fewest plan = independent projection ${f1(io.wReq)} ±0.5 (spec quotes ${c.spec.wReq} — band-chord model, errata E3)`, near(eo.wReq, io.wReq, 0.5) && Math.abs(c.spec.wReq - io.wReq) <= 5, `${f1(eo.wReq)} vs ${f1(io.wReq)}`);
    } else {
      check(`${tag}: FEWEST = independent ${io?.n} × board ${io?.stock} (57-frame table: ${c.spec.n} × ${c.spec.stock})`, !!io && eo?.n === io.n && eo?.stock === io.stock, `${eo?.n} × ${eo?.stock}`);
      check(`${tag}: W_req of the fewest plan = independent projection ${f1(io.wReq)} ±0.5 (57-frame table: ${c.spec.wReq})`, near(eo.wReq, io.wReq, 0.5), `${f1(eo.wReq)} vs ${f1(io.wReq)}`);
    }
    check(`${tag}: raw-piece edges (outer / inner) and overall length = independent trapezoid ±0.5`,
      eo.pieces.every((p, k) => near(p.outerEdge, io.pieces[k].outer, 0.5) && near(p.innerEdge, io.pieces[k].inner, 0.5) && near(p.roughLength, io.pieces[k].overall, 0.5)),
      eo.pieces.map((p, k) => `${f1(p.outerEdge)}/${f1(io.pieces[k].outer)} ${f1(p.innerEdge)}/${f1(io.pieces[k].inner)}`).join(' '));
    check(`${tag}: every piece ≥ 450 overall and ≥ 400 on the shorter edge (independent numbers: overall ${io.pieces.map((p) => f1(p.overall)).join('/')}, shorter ${io.pieces.map((p) => f1(p.shorter)).join('/')})`,
      io.pieces.every((p) => p.overall >= MIN_CLAMP && p.shorter >= MIN_PIECE) && eo.pieces.every((p) => p.limitsOk && p.roughLength >= MIN_CLAMP - 1e-9 && p.shorterEdge >= MIN_PIECE - 1e-9));
    check(`${tag}: every N below the fewest fails (board > 200 or a limit), the option table matches the independent one (N, W_req ±0.5, stock, feasible)`,
      gp.options.length === I.options.length && gp.options.every((o, j) => o.n === I.options[j].n && near(o.wReq, I.options[j].wReq, 0.5) && o.stock === I.options[j].stock && o.feasible === I.options[j].feasible)
      && gp.options.filter((o) => o.n < gp.fewest.n).every((o) => !o.feasible), gp.options.map((o) => `${o.n}:${f1(o.wReq)}→${o.stock}${o.feasible ? '✓' : '✗'}`).join(' '));
    if (c.spec.no2 && spec) check(`${tag}: 2 pieces need a ${c.spec.no2} board → no (spec)`, near(gp.options[1].wReq, c.spec.no2, 0.5) && gp.options[1].stock === null, f1(gp.options[1].wReq));
    if (c.spec.no2 && !spec) check(`${tag}: 2 pieces need a ${f1(I.options[1].wReq)} board (independent; 57 frame: ${c.spec.no2}) → no board ≥ it`, near(gp.options[1].wReq, I.options[1].wReq, 0.5) && I.options[1].stock === null && gp.options[1].stock === null, f1(gp.options[1].wReq));
    check(`${tag}: waste of the fewest plan = independent (rough × stock − band area) / (rough × stock) ±0.005 (${(io.waste * 100).toFixed(1)} %)`, near(eo.waste, io.waste, 0.005), `${eo.waste?.toFixed(4)} vs ${io.waste.toFixed(4)}`);
    check(`${tag}: economy alternative ${I.alt ? `${I.alt.n} × ${I.alt.stock}` : 'none'} and default ${I.def.n} × ${I.def.stock} (${I.rule}, threshold ${P.arch.wasteThreshold})`,
      (gp.alternative?.n ?? null) === (I.alt?.n ?? null) && (gp.alternative?.stock ?? null) === (I.alt?.stock ?? null) && gp.default.n === I.def.n && gp.default.stock === I.def.stock && gp.rule === I.rule,
      `${gp.alternative?.n} × ${gp.alternative?.stock}, default ${gp.default?.n} × ${gp.default?.stock} (${gp.rule})`);
  });
  // stock capped at 105: no valid plan, reason 'below minimum length', reported count = independent
  const capped = arch.planArchSegments(g.frameHead, { ...PP.arch, stockWidths: [63, 75, 95, 105] }, PP.cnc);
  const icap = independentPlan(g.frameHead, [63, 75, 95, 105]);
  check(`${K} capped at 105: no valid plan, reason 'below minimum length', blocked at ${icap[0].blocked?.n} pieces (independent) with the limit failure named`,
    capped.noStock && capped.noStockReason === 'below minimum length' && capped.arcs.every((gp, i) => gp.default === null && gp.reason === 'below minimum length' && gp.blocked?.n === icap[i].blocked?.n && gp.blocked.stock === icap[i].blocked.stock)
    && capped.reasons.every((r) => /fall below the minimum length \(piece \d+ of \d+: (overall|shorter edge) [\d.]+ < \d+ \((cnc\.minClampLength|arch\.minPieceLength)\)\)/.test(r)), capped.reasons.join(' | '));
  out[c.key] = { g, plan, ind, icap };
  }
  const capCounts = C5.map((c) => out[c.key].icap.map((x) => x.blocked?.n).join(' + ') + (c.spec.perSide ? ' per side' : '')).join(' / ');
  check(`C.5 with stock cap 105 @${face}: the five arches block at ${capCounts} pieces (independent; the spec quotes 5 / 10 / 6 / 6 for its four on the band-chord model — the counts differ where the spec split the gothic sides differently; the verdict "no valid plan" is the same)`,
    C5.every((c) => arch.planArchSegments(out[c.key].g.frameHead, { ...PP.arch, stockWidths: [63, 75, 95, 105] }, PP.cnc).noStock));
  return out;
}
section('2 — spec C.5 arches on the 57 frame the table was computed for: fewest plan = spec table, W_req / edges / limits vs the independent sampler');
runC5(P57, true);
section(`2b — the same five arches on the LIVE profile (frame ${tF}, leafAtJamb ${oL}): every N / board / W_req / edge / waste / default from the independent planner`);
const ENGINE = runC5(P, false);
// a small gothic whose LEAF the independent planner blocks on the live frame while the head plans (sections 3 and 6)
const G_BLOCKED = { shape: 'gothic-equilateral', width: 600, height: 1600 };

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
section('2c — spec C.5b: the 68-frame table in ARCHED-WINDOWS-v4.md matches the live computation (BLOCKERS §19.6)');
{
  const doc = readFileSync(resolve(ROOT, 'docs', 'handover', 'ARCHED-WINDOWS-v4.md'), 'utf8');
  check('the spec carries a C.5b section re-issued for the 68 frame', /### C\.5b Reference results re-issued for the 68 frame/.test(doc));
  const flat = doc.replace(/\s+/g, ' ');
  check(`C.5b states its premises: face ${tF}, land ${P.geometry.land}, leafAtJamb ${oL}, allowance ${A}, finger ${FINGER}`,
    flat.includes(`land ${P.geometry.land} / leafAtJamb ${oL}`) && flat.includes(`allowance ${A}`) && flat.includes(`finger ${FINGER}`) && flat.includes(`the 68 frame`),
    `land ${P.geometry.land} / leafAtJamb ${oL} · allowance ${A} · finger ${FINGER}`);
  for (const c of C5) {
    const { ind } = ENGINE[c.key];
    ind.forEach((I, i) => {
      const fw = I.fewest;
      const tag = `${c.key}${c.spec.perSide ? ` side ${i + 1}` : ''}`;
      if (c.spec.perSide && i > 0) return;                     // the doc quotes one side (they mirror)
      check(`C.5b ${tag}: the doc quotes board ${fw.stock} (${f1(fw.wReq)}) — the live independent projection`,
        doc.includes(`board ${fw.stock} (${f1(fw.wReq)}`), `looking for "board ${fw.stock} (${f1(fw.wReq)}"`);
      check(`C.5b ${tag}: the doc quotes the outer edges ${fw.pieces.map((x) => f1(x.outer)).join('/')}`,
        doc.includes(`outer ${fw.pieces.map((x) => f1(x.outer)).join('/')}`), `outer ${fw.pieces.map((x) => f1(x.outer)).join('/')}`);
      check(`C.5b ${tag}: the doc quotes the inner edges ${fw.pieces.map((x) => f1(x.inner)).join('/')}`,
        doc.includes(`inner ${fw.pieces.map((x) => f1(x.inner)).join('/')}`), `inner ${fw.pieces.map((x) => f1(x.inner)).join('/')}`);
      check(`C.5b ${tag}: the piece COUNT is unchanged from the 57 table (${c.spec.n} × ${c.spec.stock})`,
        fw.n === c.spec.n && fw.stock === c.spec.stock, `${fw.n} × ${fw.stock}`);
    });
  }
  check('C.5b names the HALF 1500 economy default 4 × 150 (the only plan whose DEFAULT differs from its fewest)',
    /economy default 4 × 150/.test(doc) && ENGINE['HALF 1500'].ind[0].def.n === 4 && ENGINE['HALF 1500'].ind[0].def.stock === 150,
    JSON.stringify(ENGINE['HALF 1500'].ind[0].def));
  check('the original C.5 table is kept as history (57-frame numbers still in the file)', /134\.7/.test(doc) && /Face 57 head/.test(doc));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — planner invariants on the engine output');
{
  const tc = ENGINE['ROUND 1000 rise 250'].plan;
  const pcs = tc.pieces;
  check('three-centre chain: 2 pieces each spanning haunch + half the crown (compound: arcs [0,1] and [1,2]), joint at the apex (radial to the crown = vertical)',
    pcs.length === 2 && pcs[0].compound && JSON.stringify(pcs[0].arcs) === '[0,1]' && JSON.stringify(pcs[1].arcs) === '[1,2]' && near(pcs[0].outer[1].a1, Math.PI / 2, 1e-9));
  check('pieces tile the chain by arc length: s ranges contiguous from 0 to the outer length, equal', (() => {
    const L = tc.arcs[0].length; return near(pcs[0].s[0], 0, 1e-9) && near(pcs[0].s[1], L / 2, 1e-6) && near(pcs[1].s[0], L / 2, 1e-6) && near(pcs[1].s[1], L, 1e-6) && near(pcs[0].arcLength, pcs[1].arcLength, 1e-6);
  })());
  check('end cuts: springing end SQUARE (Q, not jointed, contour wedge = axis to the horizontal), apex joint J with the angle between the radial plane and the board normal', (() => {
    const [a, b] = pcs[0].endCuts; const u = pcs[0].axes.u;
    const axisDeg = Math.abs(Math.atan2(u[1], u[0])) * 180 / Math.PI;
    return a.kind === 'square' && !a.jointed && a.fromSquareDeg === 0 && near(a.contourDeg, Math.min(axisDeg, 180 - axisDeg), 1e-9)
      && b.kind === 'joint' && b.jointed && near(b.fromSquareDeg, Math.acos(Math.abs(pcs[0].axes.b[1])) * 180 / Math.PI, 1e-9) && pcs[0].jointedEnds === 1;
  })());
  check('the raw trapezoid: square springing end at the band extent along the axis, the two pieces share the apex joint plane (x = 0) exactly', (() => {
    const t0 = arch.pieceStockTrapezoid(pcs[0], pcs[0].stock), t1 = arch.pieceStockTrapezoid(pcs[1], pcs[1].stock);
    const u = pcs[0].axes.u;
    const s = (q) => q[0] * u[0] + q[1] * u[1];
    return near(s(t0[0]), pcs[0].extents.s[0], 1e-6) && near(s(t0[3]), pcs[0].extents.s[0], 1e-6) && near(t0[1][0], 0, 1e-6) && near(t0[2][0], 0, 1e-6) && near(t1[0][0], 0, 1e-6) && near(t1[3][0], 0, 1e-6)
      && near(t0[1][1], t1[0][1], 1e-6) && near(t0[2][1], t1[3][1], 1e-6);
  })());
  // band inside the board for every default piece of every C.5 arch (sampled point-in-trapezoid)
  const inside = (q, T) => { let sgn = 0; for (let i = 0; i < 4; i++) { const a = T[i], b = T[(i + 1) % 4]; const cr = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); if (Math.abs(cr) < 1e-6) continue; if (!sgn) sgn = Math.sign(cr); else if (Math.sign(cr) !== sgn) return false; } return true; };
  for (const k of Object.keys(ENGINE)) {
    const plan = ENGINE[k].plan;
    check(`${k}: every default piece's band (sampled) lies inside its raw trapezoid, the finished piece inside its band, the polygons close`, plan.pieces.every((pc) => {
      const T = arch.pieceStockTrapezoid(pc, pc.stock);
      const pts = [...pc.band.outer.flatMap((a) => sample(a, a.a0, a.a1, 200)), ...pc.band.inner.flatMap((a) => sample(a, a.a0, a.a1, 200))];
      return pts.every((q) => inside(q, T)) && pc.outer.every((a, i) => a.r < pc.band.outer[i].r && pc.inner[i].r > pc.band.inner[i].r) && arch.piecePoly(pc).length === 2 * pc.outer.length + 2 && arch.pieceBandPoly(pc).length === 2 * pc.outer.length + 2;
    }));
  }
  const go = ENGINE['GOTHIC 1000'].plan;
  check('gothic: two groups (sides), 2 + 2 pieces numbered 1..4, apex ends "axis" on piece 2 (end) and piece 3 (start), springing ends square', go.pieces.length === 4 && go.pieces.map((p) => p.no).join() === '1,2,3,4'
    && go.pieces[1].endEnd === 'axis' && go.pieces[2].endStart === 'axis' && go.pieces[0].endStart === 'archStart' && go.pieces[3].endEnd === 'archStart' && go.pieces[1].endCuts[1].kind === 'apex' && go.pieces[0].endCuts[0].kind === 'square');
  check('gothic apex joint: pieceJoints reports the vertical joint on x = 0 from both sides, inner → outer apex', (() => {
    const j1 = arch.pieceJoints(go.pieces[1]), j2 = arch.pieceJoints(go.pieces[2]);
    const a = j1[j1.length - 1], b = j2[0];
    return near(a[0][0], 0, 1e-9) && near(a[1][0], 0, 1e-9) && near(b[0][0], 0, 1e-9) && a[1][1] > a[0][1] && near(a[0][1], b[0][1], 1e-9);
  })());
  const circle = arch.buildCirclePlan({ width: 1000, height: 1000 }, P);
  check('circle 1000: the frame ring is ONE closed group (kind ring, radial joints only), pieces tile 360°, no square end', circle.plans.frameHead.arcs.length === 1 && circle.plans.frameHead.arcs[0].kind === 'ring'
    && near(circle.plans.frameHead.arcs[0].spanDeg, 360, 1e-9) && circle.plans.frameHead.pieces.every((p) => p.endStart === 'radial' && p.endEnd === 'radial' && p.jointedEnds === 2));
  const ic = independentPlan(circle.frameHead);
  check(`circle 1000 frame ring: fewest ${ic[0].fewest.n} × ${ic[0].fewest.stock}, default ${ic[0].def.n} × ${ic[0].def.stock} (${ic[0].rule}) — engine equal`, circle.plans.frameHead.arcs[0].fewest.n === ic[0].fewest.n && circle.plans.frameHead.arcs[0].default.n === ic[0].def.n && circle.plans.frameHead.arcs[0].default.stock === ic[0].def.stock);
  const shorterOf = (reason) => Number((String(reason).match(/shorter edge ([\d.]+) < /) || [])[1]);
  // circle rings from the profile: frame R − tF, leaf (R − oL) / (R − oL − tL) — the 68 frame shrinks the 800 leaf ring to 349 / 282 (was 360 / 293)
  const c800 = arch.buildCirclePlan({ width: 800, height: 800 }, P);
  check(`circle 800 rings from the profile: frame ${400} / ${400 - tF}, leaf ${400 - oL} / ${400 - oL - tL}`,
    c800.frameHead.outer.every((a) => near(a.r, 400, 1e-9)) && c800.frameHead.inner.every((a) => near(a.r, 400 - tF, 1e-9)) && c800.leafTop.outer.every((a) => near(a.r, 400 - oL, 1e-9)) && c800.leafTop.inner.every((a) => near(a.r, 400 - oL - tL, 1e-9)));
  const ic8h = independentPlan(c800.frameHead)[0], ic8l = independentPlan(c800.leafTop)[0];
  check(`circle 800 (t23 sample): frame ring ${ic8h.def?.n} × ${ic8h.def?.stock} (independent, W_req ${f1(ic8h.fewest?.wReq)}; 57 frame: 4 × 180), LEAF ring has NO valid plan — ${ic8l.blocked?.n} pieces on ${ic8l.blocked?.stock} leave a ${f1(ic8l.blocked?.pieces[0].shorter)} shorter edge (< 400; 57 frame: 390.1): reported, never split finer (BLOCKERS 16.2)`,
    !!ic8h.def && c800.plans.frameHead.arcs[0].default?.n === ic8h.def.n && c800.plans.frameHead.arcs[0].default?.stock === ic8h.def.stock && !ic8l.def && ic8l.reason === 'below minimum length'
    && c800.plans.leafTop.noStock && c800.plans.leafTop.noStockReason === 'below minimum length' && c800.plans.leafTop.arcs[0].blocked?.n === ic8l.blocked.n && c800.plans.leafTop.arcs[0].blocked?.stock === ic8l.blocked.stock
    && near(shorterOf(c800.plans.leafTop.reasons[0]), ic8l.blocked.pieces[0].shorter, 0.5), c800.plans.leafTop.reasons.join(' | '));
  const shallow = arch.buildArchPlan({ shape: 'three-centre', width: 1000, height: 1500, rise: 200 }, P);
  const ish = independentPlan(shallow.leafTop)[0];
  const sp = shallow.plans.leafTop.pieces;
  // one whole chain on a horizontal chord: W_req = the leaf outer band's apex above the springing = rise − leafAtJamb + allowance (200 − 51 + 10 = 159; was 170)
  check(`one-board plan: the 1000 × rise 200 leaf top rail fits ONE ${ish.def?.stock} board (W_req ${f1(ish.fewest?.wReq)} = rise − leafAtJamb + allowance ${200 - oL + A}, L ${f1(ish.fewest?.pieces[0].overall)} — independent; 57 frame: 180 board, W_req 170, L 940) — N starts at 1, no joints, both ends square`,
    ish.def?.n === 1 && near(ish.fewest.wReq, 200 - oL + A, 0.5) && sp.length === 1 && sp[0].stock === ish.def.stock && sp[0].jointedEnds === 0 && near(sp[0].wReq, ish.fewest.wReq, 0.5) && near(sp[0].roughLength, ish.fewest.pieces[0].overall, 0.5), `${sp.length} × ${sp[0]?.stock}, W_req ${f1(sp[0]?.wReq)}, L ${f1(sp[0]?.roughLength)}`);
  const gl = arch.buildArchPlan({ shape: 'gothic-equilateral', width: 1000, height: 2000 }, P);
  const igl = independentPlan(gl.leafTop);
  // verdict FLIPPED by the 68 frame (leafAtJamb 51): the leaf ring 949 / 882 (was 960 / 893) fits ONE 200 board per side (W_req 197.1 ≤ 200);
  // on the 57 frame one piece needed more than 200 and two per side on 120 fell to a 386.2 shorter edge → no valid plan (BLOCKERS 16.2)
  check(`gothic 1000 LEAF top rail: PLANNED on the ${tF} frame — ${igl.map((x) => (x.def ? `${x.def.n} × ${x.def.stock}` : 'blocked')).join(' + ')} per side (independent, W_req ${f1(igl[0].fewest?.wReq)}); 57 frame: 2 per side on 120 → shorter edge 386.2 < 400 → no valid plan (verdict flipped, BLOCKERS 16.2)`,
    igl.every((x) => x.def) && !gl.noStock && !gl.plans.frameHead.noStock && !gl.plans.leafTop.noStock && gl.plans.leafTop.arcs.every((gp, i) => gp.default?.n === igl[i].def.n && gp.default?.stock === igl[i].def.stock && near(gp.fewest.wReq, igl[i].fewest.wReq, 0.5)),
    gl.plans.leafTop.reasons.join(' | ') || gl.plans.leafTop.arcs.map((a) => `${a.default?.n} × ${a.default?.stock}`).join(' + '));
  const gb = arch.buildArchPlan(G_BLOCKED, P);
  const igbH = independentPlan(gb.frameHead), igbL = independentPlan(gb.leafTop);
  check(`gothic ${G_BLOCKED.width} LEAF top rail: no valid plan (independent: ${igbL[0].blocked?.n} per side on ${igbL[0].blocked?.stock} → ${igbL[0].blocked?.fails[0]}) → plan.noStock with the reason; the frame head is planned (${igbH.map((x) => `${x.def?.n} × ${x.def?.stock}`).join(' + ')}) — a small gothic blocked by the 400 limit on the ${tF} frame`,
    igbH.every((x) => x.def) && igbL.every((x) => !x.def && x.reason === 'below minimum length') && gb.noStock && !gb.plans.frameHead.noStock && gb.plans.leafTop.noStock
    && gb.plans.leafTop.arcs.every((gp, i) => gp.blocked?.n === igbL[i].blocked.n && gp.blocked?.stock === igbL[i].blocked.stock) && near(shorterOf(gb.plans.leafTop.reasons[0]), igbL[0].blocked.pieces[0].shorter, 0.5), gb.plans.leafTop.reasons.join(' | '));
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — economy rule (C.4): threshold 1.0 → always the fewest, 0 → the alternative whenever one passes');
{
  const g = ENGINE['HALF 1500'].g;
  const I = ENGINE['HALF 1500'].ind[0];
  const i1 = independentPlan(g.frameHead, STOCK, 1)[0], i0 = independentPlan(g.frameHead, STOCK, 0)[0];   // independent verdicts at the two extreme thresholds
  const always = arch.planArchSegments(g.frameHead, { ...P.arch, wasteThreshold: 1 }, P.cnc).arcs[0];
  const eco = arch.planArchSegments(g.frameHead, { ...P.arch, wasteThreshold: 0 }, P.cnc).arcs[0];
  const def = ENGINE['HALF 1500'].plan.arcs[0];
  check(`HALF 1500: threshold 1.0 → default = fewest ${i1.def.n} × ${i1.def.stock}; threshold 0 → default = alternative ${i0.def.n} × ${i0.def.stock}; profile ${P.arch.wasteThreshold} → ${I.rule} (independent; waste of the fewest ${I.fewest.n} × ${I.fewest.stock} = ${(I.fewest.waste * 100).toFixed(0)} %)`,
    i1.rule === 'fewest' && i0.rule === 'economy' && always.default.n === i1.def.n && always.default.stock === i1.def.stock && always.rule === 'fewest' && eco.default.n === i0.def.n && eco.default.stock === i0.def.stock && eco.rule === 'economy' && def.rule === I.rule && def.alternative?.n === I.alt?.n && near(def.fewest.waste, I.fewest.waste, 0.005));
  check(`the alternative is the FIRST of N + 1 … N + 3 that passes on a NARROWER board (never the same board), searched no further than N + 3 (independent: ${I.alt?.n} × ${I.alt?.stock} after ${I.fewest.n} × ${I.fewest.stock})`, !!I.alt && always.alternative?.n === I.alt.n && always.alternative.stock === I.alt.stock && always.alternative.stock < always.fewest.stock && always.nMax === always.fewest.n + 3);
  const h1000 = ENGINE['HALF 1000'].plan.arcs[0], ih = ENGINE['HALF 1000'].ind[0];
  const nextOpts = ih.options.filter((o) => o.n > ih.fewest.n);
  const h1000zero = arch.planArchSegments(ENGINE['HALF 1000'].g.frameHead, { ...P.arch, wasteThreshold: 0 }, P.cnc).arcs[0];
  check(`HALF 1000: no economy alternative — after the fewest ${ih.fewest.n} × ${ih.fewest.stock}: ${nextOpts.map((o) => `${o.n} × ${o.stock}${o.stock < ih.fewest.stock ? '' : ' (not narrower)'} ${o.feasible ? 'passes' : 'fails (' + o.fails[0].replace(/^piece \d+: /, '') + ')'}`).join('; ')} (independent; 57 frame: 4 × 120 failed 450) → default fewest whatever the threshold`,
    ih.alt === null && h1000.alternative === null && h1000.default.n === ih.fewest.n && h1000.rule === 'fewest' && h1000zero.alternative === null && h1000zero.default.n === ih.fewest.n
    && nextOpts.every((o) => { const e = h1000.options.find((x) => x.n === o.n); return !!e && e.stock === o.stock && e.feasible === o.feasible; }));
  check('plan.rule / plan.wasteThreshold / plan.minClampLength / plan.minPieceLength exposed for the sheet', typeof ENGINE['HALF 1500'].plan.rule === 'string' && ENGINE['HALF 1500'].plan.wasteThreshold === 0.45 && ENGINE['HALF 1500'].plan.minClampLength === 450 && ENGINE['HALF 1500'].plan.minPieceLength === 400);
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — DXF: CLAMPS layer, limits / rule text, cut codes; samples sample_arch_1000_*.dxf (ezdxf)');
{
  mkdirSync(SAMPLES, { recursive: true });
  for (const c of C5) {
    const plan = arch.buildArchPlan({ ...c.input, hinge: 'left' }, P);
    if (plan.noStock) { console.log(`  note  ${c.key}: no valid plan for a member (${[...plan.plans.frameHead.reasons, ...plan.plans.leafTop.reasons].join('; ')}) — no CNC sample`); continue; }
    const ents = archDxf.buildArchEntities(plan, 'C5');
    const name = `sample_arch_c5_${c.input.width}_${c.input.shape}${c.input.rise ? '-rise' + c.input.rise : ''}.dxf`;   // c5_ prefix: t16 owns sample_arch_1200_*
    const path = resolve(SAMPLES, name);
    writeFileSync(path, dxfWriter.writeDxf(ents, archDxf.ARCH_LAYERS));
    const d = probe(path);
    const nPieces = plan.plans.frameHead.totalPieces + plan.plans.leafTop.totalPieces;
    const clamps = d.polys.filter((p) => p.layer === 'CLAMPS');
    check(`${name}: R12, CLAMPS layer with two 130 × 130 closed squares per piece (${2 * nPieces})`, d.version === 'AC1009' && d.layers.includes('CLAMPS') && clamps.length === 2 * nPieces
      && clamps.every((p) => p.closed && p.n === 4 && p.arcs === 0 && near(p.bbox[2] - p.bbox[0], 130, 1e-3) && near(p.bbox[3] - p.bbox[1], 130, 1e-3)), `${clamps.length}`);
    // every clamp square sits inside its PIECES trapezoid's bbox, centred across the board, ≥ 20 from the end-cut lines
    // (the joint planes lie 15 inside the rough ends). Entity order: rows bottom-up → leaf pieces first, then head pieces.
    const pieces = d.polys.filter((p) => p.layer === 'PIECES');
    const ordered = [...plan.plans.leafTop.pieces, ...plan.plans.frameHead.pieces];
    check(`${name}: PIECES entities in plan order (leaf row, then head row): stock × rough match`, pieces.length === ordered.length && pieces.every((p, i) => near(p.bbox[3] - p.bbox[1], ordered[i].stock, 1e-3) && near(p.bbox[2] - p.bbox[0], ordered[i].roughLength, 0.5)));
    check(`${name}: clamp squares centred across the board (y — a 130 square overhangs a board narrower than the Uniclamp base, BLOCKERS 16.6), inside the rough piece (x), ≥ 20 from the end cuts (+ 15 finger on jointed ends)`, clamps.every((sq) => {
      // host = the PIECES trapezoid the square sits in along x and is centred on across y (full y-containment is impossible on the 120 boards)
      const hi = pieces.findIndex((p) => sq.bbox[0] >= p.bbox[0] - 1e-6 && sq.bbox[2] <= p.bbox[2] + 1e-6 && near((sq.bbox[1] + sq.bbox[3]) / 2, (p.bbox[1] + p.bbox[3]) / 2, 1e-3));
      if (hi < 0) return false;
      const host = pieces[hi], pc = ordered[hi];
      const centred = near((sq.bbox[1] + sq.bbox[3]) / 2, (host.bbox[1] + host.bbox[3]) / 2, 1e-3);
      const leftJ = pc.endCuts[1].jointed ? 15 : 0, rightJ = pc.endCuts[0].jointed ? 15 : 0;   // END end on the left in the flat frame
      return centred && sq.bbox[0] >= host.bbox[0] + leftJ + 20 - 1e-3 && sq.bbox[2] <= host.bbox[2] - rightJ - 20 + 1e-3;
    }));
    const allPc = ordered;
    const texts = d.texts.map((t) => t.text);
    check(`${name}: text — LIMITS line, CLAMPS (SUGGESTION) line, FEWEST / ECONOMY ALT lines, cut-code legend with Q`, texts.some((t) => /^ALLOWANCE 10 PER SIDE  LIMITS: OVERALL >= 450 \(CLAMP\)  SHORTER EDGE >= 400  STOCK MAX 200$/.test(t))
      && texts.some((t) => /^CLAMPS \(SUGGESTION\): UNICLAMP 130 x 130, CLEARANCE 20 FROM THE END CUTS, JAWS 40-98, PIECE THICKNESS 93$/.test(t)) && texts.some((t) => /PIECE THICKNESS 57$/.test(t))
      && texts.some((t) => /^(CHAIN|SIDE 1) R[\d./]+ L[\d.]+ [\d.]+DEG: FEWEST \d+ x board \d+ L[\d.]+ ROUGH [\d.]+ WASTE \d+%$/.test(t))
      && texts.some((t) => /^  (ECONOMY ALT \d+ x board \d+ L[\d.]+ ROUGH [\d.]+ WASTE \d+% -> DEFAULT (FEWEST|ECONOMY) \(THRESHOLD 45%\)|NO ECONOMY ALT WITHIN \d+ PIECES -> DEFAULT FEWEST)$/.test(t))
      && texts.some((t) => t === 'CUT CODES: J = JOINT FROM SQUARE  Q = SQUARE (SPRINGING FACE ROUTED WITH THE CONTOUR)  A = APEX FROM SQUARE')
      && texts.filter((t) => /^OUT [\d.]+ IN [\d.]+ CUT (Q|[JA][\d.]+)\/(Q|[JA][\d.]+) (FINGER BOTH ENDS|FINGER ONE END|NO FINGER)$/.test(t)).length === nPieces, texts.filter((t) => /LIMITS|CLAMPS|CUT|FEWEST|ECONOMY/.test(t)).join(' | '));
    check(`${name}: no thickness warning (93 / 57 inside the jaws 40–98)`, !texts.some((t) => /OUTSIDE THE UNICLAMP JAWS/.test(t)));
    check(`${name}: PIECES = ${nPieces} straight trapezoids, ASSEMBLY = ${nPieces}`, pieces.length === nPieces && pieces.every((p) => p.n === 4 && p.arcs === 0) && d.polys.filter((p) => p.layer === 'ASSEMBLY').length === nPieces);
    const nPlanes = allPc.reduce((s, p) => s + p.jointedEnds, 0) / 2;   // every joint plane is shared by two piece ends
    const fingers = d.polys.filter((p) => p.layer === 'FINGER');
    check(`${name}: FINGER = joint planes only (${nPlanes} shared planes = Σ jointed ends / 2), each plane drawn once`, fingers.length === nPlanes, `${fingers.length} lines: ${fingers.map((p) => p.bbox.map((v) => f1(v)).join(',')).join(' | ')}`);
  }
  // clampFootprints unit: a short piece takes one clamp / none, with a warning
  const one = archDxf.clampFootprints([[290, 0, 0], [0, 0, 0], [0, 150, 0], [290, 150, 0]], 150, 0, P.cnc.clamp, P.cnc.clampClearance, 'X P1');
  const none = archDxf.clampFootprints([[160, 0, 0], [0, 0, 0], [0, 150, 0], [160, 150, 0]], 150, 0, P.cnc.clamp, P.cnc.clampClearance, 'X P1');
  const two = archDxf.clampFootprints([[450, 0, 0], [0, 0, 0], [0, 150, 0], [450, 150, 0]], 150, 0, P.cnc.clamp, P.cnc.clampClearance, 'X P1');
  check('clampFootprints: 450 between the cuts → two squares at 20 and 300; 290 (room 250 < 2 × 130) → one centred square + warning; 160 → none + warning',
    two.squares.length === 2 && near(two.squares[0][0][0], 20, 1e-9) && near(two.squares[1][0][0], 300, 1e-9) && !two.warning
    && one.squares.length === 1 && near(one.squares[0][0][0], 80, 1e-9) && /ONE CLAMP ONLY/.test(one.warning) && none.squares.length === 0 && /TOO SHORT/.test(none.warning));
  check('a slanted end cut keeps the clearance over the square\'s whole height (the worst corner rules)', (() => {
    const fp = archDxf.clampFootprints([[450, 0, 0], [40, 0, 0], [0, 150, 0], [450, 150, 0]], 150, 0, P.cnc.clamp, P.cnc.clampClearance, 'X');
    // left edge x(y) = 40 − 40·y/150; square y 10..140 → worst x at y = 10: 37.3 → x0 = 57.3
    return fp.squares.length === 2 && near(fp.squares[0][0][0], 40 - 40 * 10 / 150 + 20, 1e-6);
  })());
  // thickness warning: a sash box head (164 deep) is outside the jaws
  // the 1000 semi-circle sash is blocked by the 400 limit (box head 80 face: shorter edge 395.5 — BLOCKERS); 1200 plans
  const sashSpec = specification.normaliseToWindowSpec({ id: 'AS', name: 'AS', width: 1200, height: 2600 }, { fullConfig: { windowCategory: 'sash', sashType: 'arched-group', archShape: 'semi-circle' } });
  const rs = cncExport.archParamsForWindow(sashSpec, 'AS');
  const sashTexts = rs.skip ? [] : archDxf.buildArchEntities(rs.params.plan, 'AS').filter((e) => e.type === 'text').map((e) => e.str);
  check('arched sash box head (80 × box depth 164): plan.depths from the sash profile, WARNING: PIECE THICKNESS 164 OUTSIDE THE UNICLAMP JAWS 40-98; the top rail (57) has none', !rs.skip && rs.params.plan.depths.frameHead === 164 && rs.params.plan.depths.leafTop === 57
    && sashTexts.some((t) => t === 'WARNING: PIECE THICKNESS 164 OUTSIDE THE UNICLAMP JAWS 40-98') && sashTexts.filter((t) => /OUTSIDE THE UNICLAMP JAWS/.test(t)).length === 1, rs.skip || sashTexts.filter((t) => /WARNING/.test(t)).join(' | '));
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — downstream: cut list / pre-cut follow the plan, export skip reasons, settings card');
{
  const cas = (id, w, h, extra = {}) => specification.normaliseToWindowSpec({ id, name: id, width: w, height: h }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...extra } });
  const spec = cas('H1500', 1500, 2400, { casementType: 'arched', archShape: 'semi-circle' });
  const d = calculations.deriveWindowData(spec, {});
  const plan = d.arch.plans.frameHead;
  const ind = independentPlan(d.arch.geometry.frameHead)[0];
  check(`derived plan = the economy default (${ind.def.n} × ${ind.def.stock}); C-ARCH HEAD note carries it`, plan.totalPieces === ind.def.n && plan.pieces.every((p) => p.stock === ind.def.stock)
    && d.components.box.find((c) => c.elementName === 'C-ARCH HEAD').notes === `R 750 · ${ind.def.n} pieces · stock ${ind.def.stock}`, d.components.box.find((c) => c.elementName === 'C-ARCH HEAD').notes);
  const resolveRaw = () => null;
  const pre = lists.buildPrecutForWindow(d, spec, {}, resolveRaw).sashEngineering.flatMap((g) => g.items).filter((it) => it.elementName === 'C-ARCH HEAD');
  check('pre-cut: one row per piece, rough = the planner\'s overall length, section stock × 93, notes with the v4 cut codes (Q on the springing ends, J on the joints)',
    pre.length === plan.pieces.length && pre.every((it, i) => it.length === Math.round(plan.pieces[i].roughLength) && it.section === `${plan.pieces[i].stock}x93`)
    && /cut Q \/ J[\d.]+/.test(pre[0].note) && /cut J[\d.]+ \/ Q/.test(pre[pre.length - 1].note), pre.map((it) => it.note).join(' | '));
  const rows = lists.buildCurvedMembersForWindow(d, spec);
  check('PP curved rows: arcs = one entry per planning group with n / stock / rough / spanDeg (chain 180°)', rows[0].arcs.length === 1 && rows[0].arcs[0].n === ind.def.n && rows[0].arcs[0].stock === ind.def.stock && rows[0].arcs[0].spanDeg === 180 && rows[0].shortPieces.length === 0);
  const g1000 = cncExport.archParamsForWindow(cas('G1000', 1000, 2000, { casementType: 'arched', archShape: 'gothic-equilateral' }), 'G1000');
  const i1000 = independentPlan(arch.buildArchGeometry({ shape: 'gothic-equilateral', width: 1000, height: 2000 }, P).leafTop);
  check(`export: gothic 1000 — 57 frame: skipped (leaf 2 per side on 120 below 400); ${tF} frame: the leaf plans ${i1000.map((x) => `${x.def?.n} × ${x.def?.stock}`).join(' + ')} (independent) → EXPORTS, no skip (verdict flipped)`,
    i1000.every((x) => x.def) && !g1000.skip && g1000.params.plan.plans.leafTop.arcs.every((gp, i) => gp.default?.n === i1000[i].def.n && gp.default?.stock === i1000[i].def.stock), g1000.skip);
  const blockedSpec = cas(`G${G_BLOCKED.width}`, G_BLOCKED.width, G_BLOCKED.height, { casementType: 'arched', archShape: G_BLOCKED.shape });
  const rb = cncExport.archParamsForWindow(blockedSpec, `G${G_BLOCKED.width}`);
  const bl = independentPlan(arch.buildArchGeometry(G_BLOCKED, P).leafTop)[0].blocked;   // independent: pieces per side, board, shorter edge
  const rbRe = new RegExp(`^no valid blank plan \\(below minimum length\\): leaf top side 1: ${bl?.n} piece${bl?.n > 1 ? 's' : ''} fit a ${bl?.stock} board but fall below the minimum length \\(piece \\d+ of ${bl?.n}: shorter edge ([\\d.]+) < 400 \\(arch\\.minPieceLength\\)\\); leaf top side 2`);
  check(`export: gothic ${G_BLOCKED.width} (leaf top rail below the 400 limit on the ${tF} frame) → skip "no valid blank plan (below minimum length): leaf top side 1: ${bl?.n} piece${bl?.n > 1 ? 's' : ''} fit a ${bl?.stock} board but fall below … shorter edge ${bl ? f1(bl.pieces[0].shorter) : '?'} < 400 …; leaf top side 2 …" (independent numbers ±0.5)`,
    !!bl && rbRe.test(rb.skip || '') && near(Number((rb.skip || '').match(rbRe)?.[1]), bl.pieces[0].shorter, 0.5), rb.skip);
  const narrow = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [63, 75, 95] } }, () => cncExport.archParamsForWindow(spec, 'H1500'));
  check('export: boards ≤ 95 → the planner blocks on the length limits once a board fits (reason below minimum length, both members named)', /^no valid blank plan \(below minimum length\): frame head chain: \d+ pieces fit a 95 board but fall below/.test(narrow.skip || '') && /leaf top chain:/.test(narrow.skip || ''), narrow.skip);
  const tooNarrow = profile.withProfiles(null, { ...P, arch: { ...P.arch, stockWidths: [63, 75] } }, () => cncExport.archParamsForWindow(spec, 'H1500'));
  // "needs X+" = ceil of the W_req at the planner's last count (40 pieces) — from the independent planner on the same rings
  const i75 = { head: independentPlan(d.arch.geometry.frameHead, [63, 75])[0], leaf: independentPlan(d.arch.geometry.leafTop, [63, 75])[0] };
  const needs = (x) => { const last = x.options[x.options.length - 1]; return `needs ${Math.ceil(last.wReq)}+ for ${last.n} pieces, widest 75`; };
  check(`export: boards ≤ 75 can never hold a ${tF} face + 2 × ${A} allowance (${tF + 2 * A}) → reason "no stock board fits" with the widest board named — head "${needs(i75.head)}" (57 frame: needs 78+), leaf ${tL} + 2 × ${A} = ${tL + 2 * A} → "${needs(i75.leaf)}"`,
    i75.head.reason === 'no stock board fits' && i75.leaf.reason === 'no stock board fits'
    && (tooNarrow.skip || '') === `no valid blank plan (no stock board fits): frame head chain: no stock board fits (${needs(i75.head)}); leaf top chain: no stock board fits (${needs(i75.leaf)})`, tooNarrow.skip);
  const derivedBlocked = calculations.deriveWindowData(blockedSpec, {});
  check(`a blocked plan never breaks the engine: the gothic ${G_BLOCKED.width} derives, the cut list note says "no stock board fits", the curved row flags noStock with the reasons (one per side)`,
    !!derivedBlocked?.components && derivedBlocked.components.sash.find((c) => c.elementName === 'C-ARCH TOP RAIL').notes.includes('no stock board fits') && lists.buildCurvedMembersForWindow(derivedBlocked, blockedSpec).find((r) => r.elementName === 'C-ARCH TOP RAIL').noStock === true
    && lists.buildCurvedMembersForWindow(derivedBlocked, blockedSpec).find((r) => r.elementName === 'C-ARCH TOP RAIL').shortPieces.length === 2);
  // settings card (structural evidence, not behaviour)
  const page = src('pages/WindowSettingsPage.jsx');
  const store = src('stores/windowProfileStore.js');
  check('WindowSettingsPage: "CNC & arches" card with finger / allowance / stock widths / minClampLength / minPieceLength / wasteThreshold / glazingRebate / clamp / tracery fields and an ArchError validation line',
    page.includes('CNC &amp; arches') && ['minClampLength', 'minPieceLength', 'wasteThreshold', 'glazingRebate', 'clampClearance', 'paneOffset', 'profileWidth', 'ridgeLand', 'edgeLand', 'mitreLeg', 'stockWidths'].every((k) => page.includes(k)) && page.includes('setCasementPath') && page.includes('archValidation'));
  check('windowProfileStore: setCasementPath (arch / cnc / tracery / geometry whitelist) + setCasementStockWidths (comma list → sorted positive numbers)', store.includes('setCasementPath') && store.includes('setCasementStockWidths') && store.includes("['arch', 'cnc', 'tracery', 'geometry']"));
  check('no LISP output anywhere (rule): no LSP writer / button, tracery export is DXF only', !/buildTraceryLsp|writeLsp|_tracery\.lsp/.test(src('utils/cncExport.js')) && !/Tracery LSP/.test(src('pages/WindowDetailPage.jsx')) && !/Tracery LSP/.test(src('pages/ProductionPackPage.jsx')) && src('utils/cncExport.js').includes("if (kind !== 'dxf') return { error: 'Tracery export is DXF only', skipped };"));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
