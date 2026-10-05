/**
 * t36 — casement friction hinges (Piotr 04.10.2026): ten rows named by their
 * range only — no brand, no LH / RH — counted in pairs, PCS 1.
 *
 * The set in src/engine/casementHardware.js: five side hung rows picked by sash
 * WIDTH (up to 360 / 360–460 / 460–600 / HD 460–800 / XL to 1200 × 1800) and
 * five top hung rows picked by sash HEIGHT (up to 300 / 300–450 / 450–900 /
 * HD 660–1500 / XL to 1200 × 1800). Sections:
 *   1  catalogue: 10 slots in ladder order, names and limits typed again here,
 *      no brand / model / hand in any name or hint, 10 Assign Materials rows
 *      with PCS 1
 *   2  selector against an INDEPENDENT rule (if-chains written here from the
 *      table typed again): hand-written edge cases with literal answers, a
 *      sweep in 0.5 mm steps over width, height and weight, the flag rule
 *   3  real engine path (normaliseToWindowSpec → deriveWindowData): 040L, 052L
 *      with its top hung fan, the 120 pair, 180L with a fixed light, narrow
 *      tall leaves, an oversize leaf, a top hung leaf in the 451–560 gap, a
 *      triple glazed pair, a fixed window
 *   4  BOM (buildWindowPartQtys): one row per slot in pairs, no _lh / _rh row,
 *      a Child Restrictor for EVERY side hung opener (none for top hung, none
 *      when the window says no), wedge packers per side hung opener
 *   5  merged purchase list with materials assigned, Yield 2 for a product
 *      sold per piece; assignments left on the old ids are ignored
 *   6  hardware list labels and the "! verify limits" flag for side and top;
 *      no id of the old set left anywhere in src
 *
 * Run: node verify/parity/t36_hinges.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

// Engine + the assignment store in one bundle. The store imports the Supabase
// client, which reads import.meta.env — defined empty here, so the client is
// simply "not configured" and nothing touches the network.
const entry = resolve(AUDIT, 't36-entry.mjs');
const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
writeFileSync(entry, [
  ...['specification', 'calculations', 'lists', 'bom', 'casementHardware', 'partRegistry'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
  `export * as store from '${rel('stores/materialAssignmentStore.js')}';`,
].join('\n'));
const out = resolve(AUDIT, 't36-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
  '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
  `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
const { specification, calculations, lists, bom, casementHardware: H, partRegistry, store } = M;

let fails = 0;
const ok = (cond, msg, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  — ${detail}` : ''}`); if (!cond) fails += 1; };
const section = (t) => console.log(`\n== ${t} ==`);
const INF = Infinity;

// The approved table, typed again on purpose (not imported from the engine).
//   [id, name, hung, min edge, max edge, max of the other dimension, max kg]
// "edge" = the dimension the row is picked by: sash WIDTH for side hung, sash
// HEIGHT for top hung. The other dimension: height (side) / width (top).
const TABLE = [
  ['c_hinge_side_360', 'Side Hinges — sash up to 360mm · ≤18kg', 'side', 260, 360, 1200, 18],
  ['c_hinge_side_460', 'Side Hinges — sash 360–460mm · ≤18kg', 'side', 360, 460, 1200, 18],
  ['c_hinge_side_600', 'Side Hinges — sash 460–600mm · ≤21kg', 'side', 460, 600, 1200, 21],
  ['c_hinge_side_800', 'Side Hinges HD — sash 460–800mm · ≤35kg', 'side', 460, 800, 1800, 35],
  ['c_hinge_side_xl', 'Side Hinges XL — oversize up to 1200 × 1800mm', 'side', 460, 1200, 1800, INF],
  ['c_hinge_top_300', 'Top Hung Hinges — sash up to 300mm · ≤10kg', 'top', 260, 300, 1200, 10],
  ['c_hinge_top_450', 'Top Hung Hinges — sash 300–450mm · ≤16kg', 'top', 300, 450, 1200, 16],
  ['c_hinge_top_900', 'Top Hung Hinges — sash 450–900mm · ≤24kg', 'top', 561, 900, 1200, 24],
  ['c_hinge_top_1500', 'Top Hung Hinges HD — sash 660–1500mm · ≤50kg', 'top', 660, 1500, 1200, 50],
  ['c_hinge_top_xl', 'Top Hung Hinges XL — oversize up to 1200 × 1800mm', 'top', 660, 1800, 1200, INF],
];
const IDS = TABLE.map((r) => r[0]);

// The INDEPENDENT rule: plain if-chains, numbers typed a third time.
// Returns [slot id, flagged].
const expectSide = (w, h, kg) => {
  if (w >= 260 && w <= 360 && h <= 1200 && kg <= 18) return ['c_hinge_side_360', false];
  if (w >= 360 && w <= 460 && h <= 1200 && kg <= 18) return ['c_hinge_side_460', false];
  if (w >= 460 && w <= 600 && h <= 1200 && kg <= 21) return ['c_hinge_side_600', false];
  if (w >= 460 && w <= 800 && h <= 1800 && kg <= 35) return ['c_hinge_side_800', false];
  if (w >= 460 && w <= 1200 && h <= 1800) return ['c_hinge_side_xl', false];
  // nothing carries it → flagged on the largest row whose stay still fits the width
  if (w >= 460) return ['c_hinge_side_xl', true];
  if (w >= 360) return ['c_hinge_side_460', true];
  return ['c_hinge_side_360', true];
};
const expectTop = (w, h, kg) => {
  if (h >= 260 && h <= 300 && w <= 1200 && kg <= 10) return ['c_hinge_top_300', false];
  if (h >= 300 && h <= 450 && w <= 1200 && kg <= 16) return ['c_hinge_top_450', false];
  if (h >= 561 && h <= 900 && w <= 1200 && kg <= 24) return ['c_hinge_top_900', false];
  if (h >= 660 && h <= 1500 && w <= 1200 && kg <= 50) return ['c_hinge_top_1500', false];
  if (h >= 660 && h <= 1800 && w <= 1200) return ['c_hinge_top_xl', false];
  // nothing carries it → flagged on the largest row whose stay still fits the height
  if (h >= 660) return ['c_hinge_top_xl', true];
  if (h >= 561) return ['c_hinge_top_900', true];
  if (h >= 300) return ['c_hinge_top_450', true];
  return ['c_hinge_top_300', true];
};

const pickSide = (w, h, kg, hinge = 'left') => H.selectCasementHinges([{ hinge }], [{ leafW: w, leafH: h }], [{ weightKg: kg }])[0];
const pickTop = (w, h, kg) => H.selectCasementHinges([{ hinge: 'top' }], [{ leafW: w, leafH: h }], [{ weightKg: kg }])[0];

// ═══════════════════════════════════════════════════════════════════════════
section('1 — catalogue: slots, names, limits, assignment rows');
{
  const slots = H.CASEMENT_HINGE_SLOTS;
  ok(slots.length === 10 && slots.map((s) => s.id).join() === IDS.join(), '10 engine slots in ladder order: five side hung, then five top hung', slots.map((s) => s.id).join(','));
  ok(slots.every((s, i) => s.name === TABLE[i][1] && s.hung === TABLE[i][2]), 'slot names = the approved rows, word for word', slots.map((s) => s.name).filter((n, i) => n !== TABLE[i][1]).join(' | '));
  const limitsOk = slots.map((s, i) => {
    const [, , hung, lo, hi, other, kg] = TABLE[i]; const L = s.limits;
    const got = hung === 'side' ? [L.minW, L.maxW, L.maxH, L.maxKg] : [L.minH, L.maxH, L.maxW, L.maxKg];
    return got.join() === [lo, hi, other, kg].join() ? null : `${s.id}: ${got.join('/')}`;
  }).filter(Boolean);
  ok(limitsOk.length === 0, 'limits = the table: min / max of the picking edge, max of the other dimension, max weight (XL: none)', limitsOk.join(' ; '));
  ok(slots.filter((s) => s.hung === 'side').every((s) => s.limits.minH === undefined) && slots.filter((s) => s.hung === 'top').every((s) => s.limits.minW === undefined),
    'side hung rows have no minimum height, top hung rows no minimum width (only the edge the stay sits on has one)');

  // "range only": no brand, no model, no hand — in names AND in the "?" hints
  const BRAND = /bj\s*waller|sinidex|nico\b|mighton|cotswold|kenrick|excalibur|atlas|HIN0\d|restricted egress|easy clean|\begress\b|\d{3}\s?mm stay|"|″/i;
  ok(slots.every((s) => !BRAND.test(s.name)) && slots.every((s) => !/bj\s*waller|sinidex|nico\b|mighton|cotswold|atlas|HIN0\d|easy clean|egress|stay\b/i.test(s.hint)),
    'no brand, model, product type or stay length in any hinge name or hint', slots.filter((s) => BRAND.test(s.name)).map((s) => s.name).join(' | '));
  ok(slots.every((s) => !/\b(LH|RH)\b/.test(s.name) && !/\b(LH|RH)\b/.test(s.hint)), 'no LH / RH in any hinge name or hint');
  ok(slots.every((s) => !/restrict/i.test(s.hint) && !/restrict/i.test(s.name)), 'no hint claims a built-in restriction (none of these stays has one)');
  // the flag sentence: "moves to the next stronger row" only where a stronger row can ever take the sash
  const promise = /moves to the next stronger row/, dead = /no stronger row takes a sash this (narrow|short)/;
  ok(promise.test(slots[1].hint) && promise.test(slots[2].hint) && promise.test(slots[3].hint) && promise.test(slots[5].hint) && promise.test(slots[7].hint) && promise.test(slots[8].hint)
    && dead.test(slots[0].hint) && !promise.test(slots[0].hint) && dead.test(slots[6].hint) && !promise.test(slots[6].hint),
  'hints: "up to 360" and "300–450" say a sash over the limit is flagged (HD starts at 460, the next top stay at 561); the other rows promise the stronger row');
  const hintOk = slots.map((s, i) => {
    const [, , hung, lo, hi, other, kg] = TABLE[i];
    const want = kg === INF
      ? [`from ${lo}mm ${hung === 'side' ? 'wide' : 'high'}`, 'sash width up to 1200mm', 'sash height up to 1800mm', 'no weight limit', 'above 1200 × 1800mm', '"! verify limits"']
      : [hung === 'side' ? `sash width ${lo}–${hi}mm` : `sash height ${lo}–${hi}mm`, hung === 'side' ? `sash height up to ${other}mm` : `sash width up to ${other}mm`, `sash weight up to ${kg}kg`, '"! verify limits"'];
    const miss = want.filter((t) => !s.hint.includes(t));
    const lead = s.hint.startsWith(hung === 'side' ? 'Side hung' : 'Top hung') && s.hint.includes('One pair per opener');
    return miss.length || !lead ? `${s.id}: ${miss.join(' / ') || 'lead'}` : null;
  }).filter(Boolean);
  ok(hintOk.length === 0, 'every "?" hint states the limits the selector reads (edge range, other dimension, weight), the flag, and "One pair per opener"', hintOk.join(' ; '));

  const parts = H.CASEMENT_HINGE_PARTS;
  ok(parts.length === 10 && parts.every((p, i) => p.id === IDS[i] && p.slotId === IDS[i] && p.name === TABLE[i][1] && p.hint === slots[i].hint && p.hand === null),
    '10 assignment rows = the 10 slots, one row each (no LH / RH split)', parts.map((p) => p.id).join(','));
  ok(H.hingePartId === undefined, 'hingePartId (slot + hand → row id) is gone with the handed rows');

  const rows = store.CASEMENT_PARTS.ironmongeryHinges;
  ok(rows.length === 10 && rows.every((r, i) => r.id === IDS[i] && r.name === TABLE[i][1] && r.hint === slots[i].hint && r.pcs === 1 && r.unit === 'pcs' && r.materialType === 'ironmongery'),
    'Assign Materials: 10 hinge rows, the same ids / names / hints, PCS 1 (the material is a pair), ironmongery', rows.map((r) => `${r.id}:${r.pcs}`).join(','));
  const allIds = store.ALL_PARTS.map((p) => p.id);
  ok(IDS.every((id) => allIds.includes(id)) && new Set(allIds).size === allIds.length, 'ALL_PARTS carries every hinge row and no part id is duplicated (anything missing there is dropped from every BOM)');
  ok(allIds.filter((id) => id.startsWith('c_hinge')).length === 10, 'ALL_PARTS has exactly 10 hinge rows — no row of the old set, no _lh / _rh row', allIds.filter((id) => id.startsWith('c_hinge')).join(','));
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — selector against the independent rule');
{
  // hand-written cases with literal answers: [w, h, kg, slot, flagged, why]
  const SIDE = [
    [260, 1000, 10, 'c_hinge_side_360', false, 'smallest sash the first row takes'],
    [259.5, 1000, 10, 'c_hinge_side_360', true, 'too narrow for any stay'],
    [360, 1200, 18, 'c_hinge_side_360', false, 'upper corner of "up to 360"'],
    [360.5, 1200, 18, 'c_hinge_side_460', false, 'just over 360 wide'],
    [460, 1200, 18, 'c_hinge_side_460', false, 'upper corner of 360–460'],
    [460.5, 1200, 18, 'c_hinge_side_600', false, 'just over 460 wide'],
    [600, 1200, 21, 'c_hinge_side_600', false, 'upper corner of 460–600'],
    [600, 1200, 21.1, 'c_hinge_side_800', false, 'too heavy for 460–600 → HD'],
    [600, 1200.5, 20, 'c_hinge_side_800', false, 'too tall for 460–600 → HD'],
    [460, 1300, 12, 'c_hinge_side_800', false, '460 wide, too tall for 360–460 and 460–600 → HD'],
    [600.5, 1000, 15, 'c_hinge_side_800', false, 'just over 600 wide'],
    [800, 1800, 35, 'c_hinge_side_800', false, 'upper corner of HD'],
    [800, 1800, 35.1, 'c_hinge_side_xl', false, 'too heavy for HD → XL'],
    [800.5, 1000, 20, 'c_hinge_side_xl', false, 'just over 800 wide'],
    [1200, 1800, 80, 'c_hinge_side_xl', false, 'XL corner — no weight limit'],
    [1200.5, 1000, 20, 'c_hinge_side_xl', true, 'over 1200 wide'],
    [700, 1800.5, 20, 'c_hinge_side_xl', true, 'over 1800 high (HD is capped at 1800 too)'],
    [343, 1402, 15.1, 'c_hinge_side_360', true, 'narrow and tall — no longer stay fits 343'],
    [400, 1000, 18.1, 'c_hinge_side_460', true, 'too heavy, and the HD stay does not fit 400'],
    [400, 1300, 12, 'c_hinge_side_460', true, 'too tall, and the HD stay does not fit 400'],
    [459.5, 1300, 12, 'c_hinge_side_460', true, 'half a millimetre under the HD minimum'],
    [0, 0, 0, 'c_hinge_side_360', true, 'no size at all'],
  ];
  const TOP = [
    [800, 260, 5, 'c_hinge_top_300', false, 'smallest sash the first row takes'],
    [800, 259.5, 5, 'c_hinge_top_300', true, 'too short for any stay'],
    [800, 300, 10, 'c_hinge_top_300', false, 'upper corner of "up to 300"'],
    [800, 300, 10.1, 'c_hinge_top_450', false, 'too heavy for "up to 300" → 300–450 takes a 300 sash (its name starts there)'],
    [800, 300, 16.1, 'c_hinge_top_450', true, 'too heavy for both rows that fit 300'],
    [800, 300.5, 5, 'c_hinge_top_450', false, 'just over 300 high — no gap between the first two rows'],
    [800, 310, 5, 'c_hinge_top_450', false, 'inside 300–450'],
    [800, 450, 16, 'c_hinge_top_450', false, 'upper corner of 300–450'],
    [800, 450.5, 10, 'c_hinge_top_450', true, 'gap 451–560'],
    [800, 560.5, 10, 'c_hinge_top_450', true, 'gap 451–560'],
    [800, 561, 10, 'c_hinge_top_900', false, 'first height of 450–900'],
    [800, 900, 24, 'c_hinge_top_900', false, 'upper corner of 450–900'],
    [800, 600, 24.1, 'c_hinge_top_900', true, 'too heavy, HD does not fit under 660'],
    [800, 660, 24.1, 'c_hinge_top_1500', false, 'too heavy for 450–900 → HD from 660'],
    [800, 900.5, 20, 'c_hinge_top_1500', false, 'just over 900 high'],
    [800, 1500, 50, 'c_hinge_top_1500', false, 'upper corner of HD'],
    [800, 1500, 50.1, 'c_hinge_top_xl', false, 'too heavy for HD → XL'],
    [800, 1500.5, 30, 'c_hinge_top_xl', false, 'just over 1500 high'],
    [1200, 1800, 90, 'c_hinge_top_xl', false, 'XL corner — no weight limit'],
    [1200.5, 700, 20, 'c_hinge_top_xl', true, 'over 1200 wide'],
    [1200.5, 400, 10, 'c_hinge_top_450', true, 'over 1200 wide, 400 high'],
    [800, 1800.5, 30, 'c_hinge_top_xl', true, 'over 1800 high'],
    [0, 0, 0, 'c_hinge_top_300', true, 'no size at all'],
  ];
  const run = (cases, pick) => cases.filter(([w, h, kg, id, flag]) => { const p = pick(w, h, kg); return p.slotId !== id || (p.overLimit === true) !== flag; })
    .map(([w, h, kg, id, flag, why]) => `${w}×${h} ${kg}kg want ${id}${flag ? '!' : ''} (${why})`);
  const badS = run(SIDE, pickSide), badT = run(TOP, pickTop);
  ok(badS.length === 0, `side hung, ${SIDE.length} hand-written cases (row corners, heavier → HD → XL, taller → HD, the narrow-and-tall flag, over 1200 × 1800)`, badS.join(' ; '));
  ok(badT.length === 0, `top hung, ${TOP.length} hand-written cases (row corners, no gap at 300, the 451–560 gap, heavier → HD → XL, over 1200 × 1800)`, badT.join(' ; '));
  // the independent rule agrees with the literal answers too (so the sweep below checks against something that is itself checked)
  ok(SIDE.every(([w, h, kg, id, flag]) => expectSide(w, h, kg).join() === [id, flag].join()) && TOP.every(([w, h, kg, id, flag]) => expectTop(w, h, kg).join() === [id, flag].join()),
    'the independent if-chains give the same answers on those cases');

  const KG = [0, 5, 10, 10.1, 16, 16.1, 18, 18.1, 21, 21.1, 24, 24.1, 35, 35.1, 50, 50.1, 80];
  let n = 0; const miss = [];
  for (let w = 200; w <= 1300; w += 0.5) for (const h of [100, 600, 1200, 1200.5, 1500, 1800, 1800.5, 2000]) for (const kg of KG) {
    const p = pickSide(w, h, kg), [id, flag] = expectSide(w, h, kg); n += 1;
    if (p.slotId !== id || (p.overLimit === true) !== flag) miss.push(`side ${w}×${h} ${kg}kg: ${p.slotId}${p.overLimit ? '!' : ''} ≠ ${id}${flag ? '!' : ''}`);
  }
  const nSide = n;
  for (let h = 200; h <= 1900; h += 0.5) for (const w of [300, 900, 1200, 1200.5, 1500]) for (const kg of KG) {
    const p = pickTop(w, h, kg), [id, flag] = expectTop(w, h, kg); n += 1;
    if (p.slotId !== id || (p.overLimit === true) !== flag) miss.push(`top ${w}×${h} ${kg}kg: ${p.slotId}${p.overLimit ? '!' : ''} ≠ ${id}${flag ? '!' : ''}`);
  }
  ok(miss.length === 0, `sweep in 0.5 mm steps × ${KG.length} weights: side hung width 200 … 1300 at 8 heights (${nSide} picks), top hung height 200 … 1900 at 5 widths (${n - nSide} picks) = the independent rule`, miss.slice(0, 5).join(' ; '));

  // properties that hold whatever the numbers are, checked on a coarser grid against the typed table
  const row = Object.fromEntries(TABLE.map((r) => [r[0], r]));
  const carries = (id, w, h, kg) => { const [, , hung, lo, hi, other, mk] = row[id]; const edge = hung === 'side' ? w : h, oth = hung === 'side' ? h : w; return edge >= lo && edge <= hi && oth <= other && kg <= mk; };
  let unflaggedBad = 0, flaggedBad = 0, notFirst = 0, m = 0;
  for (const hung of ['side', 'top']) {
    const ladder = TABLE.filter((r) => r[2] === hung).map((r) => r[0]);
    for (let a = 200; a <= 1900; a += 7) for (let b = 100; b <= 2000; b += 53) for (const kg of KG) {
      const [w, h] = hung === 'side' ? [a, b] : [b, a];
      const p = hung === 'side' ? pickSide(w, h, kg) : pickTop(w, h, kg); m += 1;
      const first = ladder.find((id) => carries(id, w, h, kg));
      if (!p.overLimit && !carries(p.slotId, w, h, kg)) unflaggedBad += 1;
      if (p.overLimit && first) flaggedBad += 1;
      if (!p.overLimit && p.slotId !== first) notFirst += 1;
    }
  }
  ok(unflaggedBad === 0 && flaggedBad === 0 && notFirst === 0, `${m} picks on a second grid: an unflagged pick is within every limit of its row and is the FIRST row that carries the sash; a pick is flagged only when no row carries it`, `${unflaggedBad}/${flaggedBad}/${notFirst}`);

  const l = pickSide(550, 1100, 19, 'left'), r = pickSide(550, 1100, 19, 'right');
  ok(JSON.stringify(l) === JSON.stringify(r) && !('handing' in l) && l.hung === 'side' && pickTop(800, 400, 9).hung === 'top' && !('handing' in pickTop(800, 400, 9)),
    'no handing: hinged left and hinged right give the identical pick, no "handing" key (side or top)', JSON.stringify([l, r]));
  ok(JSON.stringify(l) === JSON.stringify({ panel: 1, hung: 'side', slotId: 'c_hinge_side_600', leafW: 550, leafH: 1100, weightKg: 19 }), 'pick shape: panel, hung, slotId, leafW, leafH, weightKg — no overLimit key unless flagged', JSON.stringify(l));
  ok(JSON.stringify(pickSide(343, 1402, 15.1)) === JSON.stringify({ panel: 1, hung: 'side', slotId: 'c_hinge_side_360', leafW: 343, leafH: 1402, weightKg: 15.1, overLimit: true }), 'a flagged pick carries overLimit: true');
  const two = H.selectCasementHinges([{ hinge: 'fixed' }, { hinge: 'right' }], [{ leafW: 500, leafH: 900 }, { leafW: 500, leafH: 900 }], [null, { weightKg: 12 }]);
  ok(two[0] === null && two[1].panel === 2 && two[1].slotId === 'c_hinge_side_600', 'a fixed light gets no hinge (null pick); the panel number follows the layout');
  const noKg = H.selectCasementHinges([{ hinge: 'left' }], [{ leafW: 500, leafH: 900 }], undefined)[0];
  ok(noKg.slotId === 'c_hinge_side_600' && noKg.weightKg === 0 && !noKg.overLimit, 'no weight available → picked by size alone (weight 0), as before');
  const noSize = H.selectCasementHinges([{ hinge: 'left' }, { hinge: 'top' }], [], []);
  ok(noSize[0].overLimit === true && noSize[0].slotId === 'c_hinge_side_360' && noSize[1].overLimit === true && noSize[1].slotId === 'c_hinge_top_300', 'no size at all (missing leaf) is flagged, never passed off as a fitting sash');

  const sum = H.summariseHinges([pickSide(550, 1100, 19, 'left'), pickSide(550, 1100, 19, 'right'), pickSide(343, 1402, 15), pickTop(800, 400, 9), null]);
  ok(JSON.stringify(sum) === JSON.stringify({ c_hinge_side_600: { pairs: 2, overLimit: false }, c_hinge_side_360: { pairs: 1, overLimit: true }, c_hinge_top_450: { pairs: 1, overLimit: false } }),
    'summary per slot: pairs + the flag — no LH / RH counts', JSON.stringify(sum));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — real engine path');
const cas = (id, w, h, fc = {}) => {
  const spec = specification.normaliseToWindowSpec({ id, name: id, width: w, height: h }, { fullConfig: { windowCategory: 'casement', ...fc } });
  return { spec, d: calculations.deriveWindowData(spec, {}) };
};
const WIN = {
  single: cas('A', 1000, 1500, { casementLayout: '040L' }),
  fan: cas('B', 1200, 1500, { casementLayout: '052L' }),
  pair: cas('C', 1200, 1200, { casementLayout: '120' }),
  pairTriple: cas('T', 1200, 1200, { casementLayout: '120', glassType: 'triple' }),
  fixedLight: cas('D', 1500, 1200, { casementLayout: '180L' }),
  small: cas('E', 600, 440, { casementLayout: '040L' }),
  narrowTall: cas('F', 445, 1500, { casementLayout: '040L' }),
  narrowFan: cas('G', 700, 1500, { casementLayout: '052L' }),
  tallHd: cas('I', 600, 1300, { casementLayout: '040L' }),
  oversize: cas('K', 1000, 1900, { casementLayout: '040L' }),
  topGap: cas('M', 1000, 600, { casementLayout: '010T' }),
  fixedWindow: cas('H', 1000, 1500, { casementLayout: '040L', casementKind: 'fixed' }),
};
{
  // every pick: sized by ITS OWN leaf and weight, the slot is the independent rule's
  for (const [name, w] of Object.entries(WIN)) {
    const hw = w.d.casement.hardware, leaves = w.d.casement.leaves, kgs = w.d.casement.leafWeights;
    const wrong = hw.hingePicks.map((p, i) => {
      if (!p) return w.d.casement.layoutDef.panels[i].hinge === 'fixed' ? null : `${i}:missing`;
      const [id, flag] = (p.hung === 'top' ? expectTop : expectSide)(leaves[i].leafW, leaves[i].leafH, kgs[i].weightKg);
      const sized = p.leafW === leaves[i].leafW && p.leafH === leaves[i].leafH && p.weightKg === kgs[i].weightKg && p.panel === i + 1;
      const hung = w.d.casement.layoutDef.panels[i].hinge === 'top' ? 'top' : 'side';
      return (sized && p.hung === hung && p.slotId === id && (p.overLimit === true) === flag) ? null : `${i}:${p.slotId}`;
    }).filter(Boolean);
    ok(wrong.length === 0 && hw.hingePicks.length === leaves.length, `${name}: every opener picked from its own leaf size and weight (${hw.hingePicks.map((p, i) => (p ? `${p.slotId.replace('c_hinge_', '')}${p.overLimit ? '!' : ''} ${leaves[i].leafW}×${leaves[i].leafH} ${p.weightKg}kg` : 'fixed')).join(', ')})`, wrong.join(' '));
  }
  const pick = (w) => w.d.casement.hardware.hingePicks.map((p) => (p ? `${p.slotId}|${p.hung}|${p.leafW}×${p.leafH}${p.overLimit ? '|!' : ''}` : 'null'));
  ok(pick(WIN.single).join() === 'c_hinge_side_xl|side|898×1402', '040L 1000 × 1500: leaf 898 × 1402 → XL (wider than 800)', pick(WIN.single).join());
  ok(pick(WIN.fan).join() === 'c_hinge_top_450|top|532×446.2,c_hinge_side_600|side|532×924.8,c_hinge_side_800|side|532×1402',
    '052L 1200 × 1500: fan 446.2 high (top hung) → 300–450; light 532 × 924.8 → 460–600; leaf 532 × 1402 → HD (taller than 1200)', pick(WIN.fan).join());
  ok(pick(WIN.pair).join() === 'c_hinge_side_600|side|532×1102,c_hinge_side_600|side|532×1102', '120 1200 × 1200: two leaves 532 × 1102 → 460–600, twice — the same row for both hands', pick(WIN.pair).join());
  const tk = WIN.pairTriple.d.casement.leafWeights.map((x) => x.weightKg);
  ok(pick(WIN.pairTriple).join() === 'c_hinge_side_800|side|532×1102,c_hinge_side_800|side|532×1102' && tk.every((k) => k > 21 && k <= 35), `120 1200 × 1200 triple glazed: the same leaves at ${tk[0]} kg (over 21) → HD`, pick(WIN.pairTriple).join());
  ok(pick(WIN.fixedLight).join() === 'c_hinge_side_600|side|579.6×1102,null', '180L 1500 × 1200: one opener (460–600), the fixed light none', pick(WIN.fixedLight).join());
  ok(pick(WIN.small).join() === 'c_hinge_side_600|side|498×342', '040L 600 × 440: leaf 498 × 342 → 460–600 (picked by WIDTH, the height does not matter)', pick(WIN.small).join());
  ok(pick(WIN.narrowTall).join() === 'c_hinge_side_360|side|343×1402|!', '040L 445 × 1500: leaf 343 × 1402 → "up to 360", flagged (over 1200 high, no longer stay fits)', pick(WIN.narrowTall).join());
  ok(pick(WIN.narrowFan).join() === 'c_hinge_top_450|top|282×446.2,c_hinge_side_360|side|282×924.8,c_hinge_side_360|side|282×1402|!',
    '052L 700 × 1500: fan → 300–450; light 282 × 924.8 → up to 360; leaf 282 × 1402 → up to 360, flagged', pick(WIN.narrowFan).join());
  ok(pick(WIN.tallHd).join() === 'c_hinge_side_800|side|498×1202', '040L 600 × 1300: leaf 498 × 1202 → HD (2 mm over the 1200 height of 460–600)', pick(WIN.tallHd).join());
  ok(pick(WIN.oversize).join() === 'c_hinge_side_xl|side|898×1802|!', '040L 1000 × 1900: leaf 898 × 1802 → XL, flagged (over 1800 high)', pick(WIN.oversize).join());
  ok(pick(WIN.topGap).join() === 'c_hinge_top_450|top|898×502|!', '010T 1000 × 600: top hung leaf 898 × 502 → 300–450, flagged (the 451–560 gap)', pick(WIN.topGap).join());
  ok(pick(WIN.fixedWindow).join() === 'null' && Object.keys(WIN.fixedWindow.d.casement.hardware.hingeSummary).length === 0, 'a fixed window: no hinge at all');
  ok(Object.values(WIN).every((w) => w.d.casement.hardware.sideOpeners === w.d.casement.hardware.hingePicks.filter((p) => p && p.hung === 'side').length), 'hardware.sideOpeners still counts the side hung picks');
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — BOM: one row per slot, restrictor on every side hung opener');
const hingeBom = (w, spec = w.spec) => Object.fromEntries(Object.entries(bom.buildWindowPartQtys(w.d, spec, {}, () => null))
  .filter(([k]) => /^c_hinge|^c_child_restrictor$|^c_wedge_packer$/.test(k)).map(([k, v]) => [k, `${v.qty} ${v.unit}`]));
{
  const allIds = new Set(store.ALL_PARTS.map((p) => p.id));
  const EXPECT = {
    single: { c_hinge_side_xl: '1 pairs', c_child_restrictor: '1 pcs', c_wedge_packer: '1 pcs' },
    fan: { c_hinge_top_450: '1 pairs', c_hinge_side_600: '1 pairs', c_hinge_side_800: '1 pairs', c_child_restrictor: '2 pcs', c_wedge_packer: '2 pcs' },
    pair: { c_hinge_side_600: '2 pairs', c_child_restrictor: '2 pcs', c_wedge_packer: '2 pcs' },
    pairTriple: { c_hinge_side_800: '2 pairs', c_child_restrictor: '2 pcs', c_wedge_packer: '2 pcs' },
    fixedLight: { c_hinge_side_600: '1 pairs', c_child_restrictor: '1 pcs', c_wedge_packer: '1 pcs' },
    small: { c_hinge_side_600: '1 pairs', c_child_restrictor: '1 pcs', c_wedge_packer: '1 pcs' },
    narrowTall: { c_hinge_side_360: '1 pairs', c_child_restrictor: '1 pcs', c_wedge_packer: '1 pcs' },
    narrowFan: { c_hinge_top_450: '1 pairs', c_hinge_side_360: '2 pairs', c_child_restrictor: '2 pcs', c_wedge_packer: '2 pcs' },
    tallHd: { c_hinge_side_800: '1 pairs', c_child_restrictor: '1 pcs', c_wedge_packer: '1 pcs' },
    oversize: { c_hinge_side_xl: '1 pairs', c_child_restrictor: '1 pcs', c_wedge_packer: '1 pcs' },
    topGap: { c_hinge_top_450: '1 pairs' },
    fixedWindow: {},
  };
  for (const [name, w] of Object.entries(WIN)) {
    const q = hingeBom(w);
    const same = JSON.stringify(Object.entries(q).sort()) === JSON.stringify(Object.entries(EXPECT[name]).sort());
    const picks = w.d.casement.hardware.hingePicks.filter(Boolean);
    const pairs = Object.entries(q).filter(([k]) => k.startsWith('c_hinge')).reduce((a, [, v]) => a + parseFloat(v), 0);
    ok(same && pairs === picks.length && Object.keys(q).every((k) => allIds.has(k)) && !Object.keys(q).some((k) => /_(lh|rh)$/.test(k)),
      `${name}: ${JSON.stringify(q)} — ${pairs} pair(s) for ${picks.length} opener(s), every id an Assign Materials row`, JSON.stringify(q));
  }
  // The restrictor follows the SIDE hung openers, whatever row they sit on (before: only the XL / small rows asked for one)
  ok(hingeBom(WIN.fan).c_child_restrictor === '2 pcs' && hingeBom(WIN.pair).c_child_restrictor === '2 pcs',
    'Child Restrictor: one per side hung opener on EVERY side row (052L: 2, 120: 2) — the top hung fan gets none');
  ok(hingeBom(WIN.topGap).c_child_restrictor === undefined && hingeBom(WIN.topGap).c_wedge_packer === undefined, 'a top hung window: no Child Restrictor, no wedge packers');
  const off = hingeBom(WIN.fan, { ...WIN.fan.spec, childRestrictor: false });
  ok(off.c_child_restrictor === undefined && off.c_wedge_packer === '2 pcs' && off.c_hinge_side_600 === '1 pairs',
    'windowSpec.childRestrictor === false → no Child Restrictor; hinges and wedge packers unchanged', JSON.stringify(off));
  ok(hingeBom(WIN.fan, { ...WIN.fan.spec, childRestrictor: true }).c_child_restrictor === '2 pcs', 'windowSpec.childRestrictor === true → the same as not set (legacy windows = on)');
  // Not asserted, reported: whether the configurator's flag reaches the spec at all.
  const carried = specification.normaliseToWindowSpec({ id: 'x', name: 'x', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', childRestrictor: false } }).childRestrictor;
  console.log(`NOTE  normaliseToWindowSpec gives windowSpec.childRestrictor = ${carried} for a window saved with the box unticked${carried === false ? '' : ' — the configurator flag does not reach the BOM (older than this change, reported 05.10.2026, not asserted here)'}`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — merged purchase list with materials assigned');
{
  const materials = [
    { id: 'm-413', name: 'Friction hinge 413mm (pair)', cost_per_unit: 9.68 },
    { id: 'm-260', name: 'Friction hinge 260mm (pair)', cost_per_unit: 4.45 },
    { id: 'm-each', name: 'Heavy duty hinge, sold EACH', cost_per_unit: 7.03 },
    { id: 'm-old', name: 'left over from the old set', cost_per_unit: 1 },
  ];
  const data = { schema: 2, overrides: {}, base: {
    c_hinge_side_600: { material_id: 'm-413', yield: 1 },
    c_hinge_top_450: { material_id: 'm-260', yield: 1 },
    c_hinge_side_800: { material_id: 'm-each', yield: 2 },      // a product sold per piece: Yield 2 = one pair
    c_hinge_600: { material_id: 'm-old', yield: 1 },            // orphans: ids of the 02.08.2026 set, unhanded and handed
    c_hinge_600_lh: { material_id: 'm-old', yield: 1 },
    c_hinge_hd_rh: { material_id: 'm-old', yield: 1 },
    c_hinge_xl: { material_id: 'm-old', yield: 1 },
    c_hinge_top_12: { material_id: 'm-old', yield: 1 },
  } };
  const flat = partRegistry.expandAssignments(data);
  ok(!Object.keys(flat).some((k) => /^c_hinge_side_.*_(lh|rh)$/.test(k)) && flat.c_hinge_side_600?.material_id === 'm-413' && flat.c_hinge_600_rh === undefined && flat.c_hinge_xl_lh === undefined,
    'expandAssignments: a hinge row is one key — no _lh / _rh copies are generated any more', Object.keys(flat).filter((k) => k.startsWith('c_hinge')).join(','));
  const windows = [WIN.fan, WIN.pair].map((w) => ({ windowSpec: w.spec, derived: w.d, batch: null }));
  const rows = bom.mergeWindowMaterials(windows, { assignments: flat, assignmentsData: data, materials, ALL_PARTS: store.ALL_PARTS, ironmongeryItems: [], settings: {} });
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  ok(by['mat:m-413']?.qty === 3 && by['mat:m-260']?.qty === 1, '052L + 120: three openers on 460–600 → its material × 3 (pairs); the fan → its material × 1', JSON.stringify([by['mat:m-413']?.qty, by['mat:m-260']?.qty]));
  ok(by['mat:m-each']?.qty === 2, 'one opener on HD with Yield 2 → 2 of a material sold per piece', String(by['mat:m-each']?.qty));
  ok(!by['mat:m-old'] && !rows.some((r) => /c_hinge_(small|600|700|hd|xl|top_8|top_12|top_16|top_20)\b/.test(r.key)),
    'assignments left on the old ids (c_hinge_600, c_hinge_600_lh, c_hinge_hd_rh, c_hinge_xl, c_hinge_top_12) are ignored — nothing of the old set reaches the list');
  const cost = rows.filter((r) => /^mat:m-(413|260|each)$/.test(r.key)).reduce((a, r) => a + r.qty * r.costPerUnit, 0);
  ok(Math.abs(cost - (3 * 9.68 + 4.45 + 2 * 7.03)) < 1e-9, `assigned hinge cost = 3 × 9.68 + 4.45 + 2 × 7.03 = ${(3 * 9.68 + 4.45 + 2 * 7.03).toFixed(2)}`, String(cost));
  const none = bom.mergeWindowMaterials([{ windowSpec: WIN.single.spec, derived: WIN.single.d, batch: null }], { assignments: {}, assignmentsData: { schema: 2, base: {}, overrides: {} }, materials, ALL_PARTS: store.ALL_PARTS, ironmongeryItems: [], settings: {} });
  const un = none.find((r) => r.key === 'part:c_hinge_side_xl');
  ok(un?.qty === 1 && un._assigned === false && un.name === 'Side Hinges XL — oversize up to 1200 × 1800mm', 'a row nobody assigned shows as an unassigned part under its range name — visible, not dropped', JSON.stringify(un));
  // Known, older than this change and deliberately NOT asserted: mergeWindowMaterials also lists every
  // engine-picked hardware line a second time as an unassigned `hw:` row (see t35 §5).
  const dup = rows.filter((r) => r.key.startsWith('hw:') && /Hinges/.test(r.name));
  console.log(`NOTE  ${dup.length} extra "hw:" hinge line(s) in the merged list duplicate the rows above (${dup.map((r) => `${r.qty} × ${r.name}`).join('; ')}) — older behaviour of mergeWindowMaterials, not asserted here`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — hardware list labels; the old set is gone from src');
{
  const hl = (w, spec = w.spec) => lists.buildHardwareList(spec, w.d).filter((r) => /Hinges|restrictor|Wedge|handle/i.test(r.item)).map((r) => `${r.item} | ${r.detail} | ${r.quantity}`);
  ok(hl(WIN.fan).join(' ; ') === 'Top Hung Hinges — sash 300–450mm · ≤16kg | pairs | 1 ; Side Hinges — sash 460–600mm · ≤21kg | pairs | 1 ; Side Hinges HD — sash 460–800mm · ≤35kg | pairs | 1 ; Child restrictor | releasable · for unrestricted hinges | 2 ; Wedge packers | 1 set per hinge pair (verify) | 2 ; Casement handle | per opener | 3',
    'hardware list 052L: one line per row in pairs (no LH / RH), 2 restrictors + 2 wedge packer sets for the 2 side hung openers, 3 handles', hl(WIN.fan).join(' ; '));
  ok(hl(WIN.pair)[0] === 'Side Hinges — sash 460–600mm · ≤21kg | pairs | 2', 'hardware list 120: one line, 2 pairs — the two hands together', hl(WIN.pair)[0]);
  ok(hl(WIN.narrowTall)[0] === 'Side Hinges — sash up to 360mm · ≤18kg | pairs · ! verify limits | 1', 'hardware list, flagged side hung opener: "pairs · ! verify limits"', hl(WIN.narrowTall)[0]);
  ok(hl(WIN.topGap).join(' ; ') === 'Top Hung Hinges — sash 300–450mm · ≤16kg | pairs · ! verify limits | 1 ; Casement handle | per opener | 1',
    'hardware list, flagged TOP hung opener: the flag shows too (it did not before); no restrictor, no wedge packers', hl(WIN.topGap).join(' ; '));
  ok(!hl(WIN.fan, { ...WIN.fan.spec, childRestrictor: false }).some((t) => /restrictor/i.test(t)), 'hardware list with childRestrictor false: no restrictor line');

  const files = [];
  const walk = (dir) => readdirSync(dir).forEach((f) => { const p = resolve(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|jsx)$/.test(f)) files.push(p); });
  walk(resolve(ROOT, 'src'));
  const old = /c_hinge_(small|600|700|hd|xl|top_8|top_12|top_16|top_20)(_lh|_rh)?(?![a-z0-9_])|hingePartId|(?<!LOCK_)HAND_NOTE\b/;
  const hits = files.filter((f) => old.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  ok(hits.length === 0, `no id of the 02.08.2026 hinge set (c_hinge_small … c_hinge_top_20, handed or not), no hingePartId, no HAND_NOTE in ${files.length} src files`, hits.join(', '));
  const stale = /slots? [^.]{0,40}have the restriction built in|Hinge slots 350|restricted egress|Restricted Egress|Nico Safety Catch/;
  const staleHits = files.filter((f) => stale.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  ok(staleHits.length === 0, 'no UI copy left that says a hinge slot has the restriction built in (the configurator tooltip was the last one)', staleHits.join(', '));
}

console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
