/**
 * t35 — casement espag locks (Piotr 04.10.2026): the BJ Waller size bands,
 * LH / RH / TOP assignment rows, the <350 slot.
 *
 * The ladder in src/engine/casementHardware.js is the BJ Waller Excalibur card
 * ("To Suit Sash Rebate Size — Height for Side Hung / Width for Top Hung"):
 * 350–490 / 420–550 / 540–750 / 740–1000 / 1000–1260 / 1260–1520, the same
 * sizes the Joinery Core materials carry. Sections:
 *   1  catalogue: 7 engine slots (sub-350 + six bands), 19 Assign Materials
 *      rows (six bands × LH / RH / TOP + one sub-350 row), ids, names, hints
 *   2  selector against an INDEPENDENT rule written here from the band table
 *      typed again: hand-written band edges, a 300 … 1600 mm sweep in 0.5 mm
 *      steps for side hung (height) and top hung (width), handing
 *   3  real engine path (normaliseToWindowSpec → deriveWindowData): 040L, 052L
 *      with its top hung fan, the 120 pair, 180L with a fixed light, a sash
 *      under 350, a narrow top hung fan, a sash over 1520, a fixed window
 *   4  BOM (buildWindowPartQtys): one row per SKU, quantities = openers, every
 *      id is an Assign Materials row, the sub-350 row adds LH + RH + TOP up
 *   5  merged purchase list with materials assigned per SKU; an assignment
 *      left over from the old ladder (c_lock_312 …) is ignored, not mis-applied
 *   6  hardware list labels; no id of the old ladder left anywhere in src
 *
 * Run: node verify/parity/t35_locks.mjs
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
const entry = resolve(AUDIT, 't35-entry.mjs');
const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
writeFileSync(entry, [
  ...['specification', 'calculations', 'lists', 'bom', 'casementHardware', 'partRegistry'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
  `export * as store from '${rel('stores/materialAssignmentStore.js')}';`,
].join('\n'));
const out = resolve(AUDIT, 't35-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
  '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
  `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
const { specification, calculations, lists, bom, casementHardware: H, partRegistry, store } = M;

let fails = 0;
const ok = (cond, msg, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  — ${detail}` : ''}`); if (!cond) fails += 1; };
const section = (t) => console.log(`\n== ${t} ==`);

// The card, typed again on purpose (not imported from the engine).
const BANDS = [[350, 490], [420, 550], [540, 750], [740, 1000], [1000, 1260], [1260, 1520]];
const SUB = 'c_lock_sub350';
const expectSlot = (dim) => {
  if (!(dim > 0)) return [SUB, true];                    // no size → flagged
  if (dim < 350) return [SUB, false];                     // under the smallest kit → its own slot, not a flag
  for (const [lo, hi] of BANDS) if (dim >= lo && dim <= hi) return [`c_lock_${lo}`, false];   // smallest kit that covers
  return ['c_lock_1260', true];                           // over the largest kit → flagged
};

// ═══════════════════════════════════════════════════════════════════════════
section('1 — catalogue: slots, assignment rows');
{
  const slots = H.CASEMENT_LOCK_SLOTS;
  ok(slots.length === 7 && slots[0].id === SUB && slots[0].kit === false, `7 engine slots, the first is ${SUB} (not a kit)`, slots.map((s) => s.id).join(','));
  const kits = slots.filter((s) => s.kit);
  ok(kits.length === 6 && kits.every((s, i) => s.id === `c_lock_${BANDS[i][0]}` && s.lo === BANDS[i][0] && s.hi === BANDS[i][1]),
    `six kit bands = the BJ Waller card: ${BANDS.map(([a, b]) => `${a}–${b}`).join(' / ')}`, kits.map((s) => `${s.id}:${s.lo}-${s.hi}`).join(','));
  ok(kits.every((s, i) => i === 0 || s.lo <= kits[i - 1].hi), 'the bands leave no gap between 350 and 1520 (each starts at or below the end of the one before)');
  ok(kits.every((s) => s.name === `Espag Lock Kit — sash ${s.lo}–${s.hi}mm`) && slots[0].name === 'Lock — sash <350mm', 'slot names carry the band');

  const parts = H.CASEMENT_LOCK_PARTS;
  const want = [SUB, ...BANDS.flatMap(([lo]) => ['lh', 'rh', 'top'].map((h) => `c_lock_${lo}_${h}`))];
  ok(parts.length === 19 && parts.map((p) => p.id).join() === want.join(), '19 assignment rows: the sub-350 row, then LH / RH / TOP for each of the six bands, in size order', parts.map((p) => p.id).join(','));
  ok(parts.filter((p) => p.hand).every((p) => p.name.endsWith(` · ${p.hand}`) && p.id.endsWith(`_${p.hand.toLowerCase()}`)), 'row names end with · LH / · RH / · TOP, matching the id suffix');
  ok(parts.filter((p) => p.hand === 'LH').every((p) => /hinged RIGHT viewed from OUTSIDE/.test(p.hint) && /anti-clockwise/.test(p.hint) && /sash HEIGHT/.test(p.hint))
    && parts.filter((p) => p.hand === 'RH').every((p) => /hinged LEFT viewed from OUTSIDE/.test(p.hint) && /"RH — clockwise/.test(p.hint) && /sash HEIGHT/.test(p.hint))
    && parts.filter((p) => p.hand === 'TOP').every((p) => /unhanded/.test(p.hint) && /sash WIDTH/.test(p.hint)),
  'hints: LH = hinged right from outside (card: anti-clockwise), RH = hinged left from outside (card: clockwise), TOP unhanded; side by height, top by width');
  ok(H.lockPartId('c_lock_540', 'LH') === 'c_lock_540_lh' && H.lockPartId('c_lock_540', 'RH') === 'c_lock_540_rh' && H.lockPartId('c_lock_540', 'TOP') === 'c_lock_540_top'
    && H.lockPartId('c_lock_540', null) === 'c_lock_540_top' && H.lockPartId(SUB, 'LH') === SUB && H.lockPartId(SUB, null) === SUB && H.lockPartId(null, 'LH') === null,
  'lockPartId: band + LH / RH / TOP (null = top hung, as in the picks); the sub-350 slot is one row for every hand');

  const rows = store.CASEMENT_PARTS.ironmongeryLocks;
  ok(rows.length === 19 && rows.every((r, i) => r.id === parts[i].id && r.name === parts[i].name && r.hint === parts[i].hint && r.pcs === 1 && r.unit === 'pcs' && r.materialType === 'ironmongery'),
    'Assign Materials: 19 lock rows, the same ids / names / hints, 1 pcs, ironmongery');
  const allIds = store.ALL_PARTS.map((p) => p.id);
  ok(want.every((id) => allIds.includes(id)) && new Set(allIds).size === allIds.length, 'ALL_PARTS carries every lock row and no part id is duplicated (anything missing there is dropped from every BOM)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — selector against the independent rule');
{
  const side = (h, hinge = 'right') => H.selectCasementLocks([{ hinge }], [{ leafW: 777, leafH: h }])[0];
  const top = (w) => H.selectCasementLocks([{ hinge: 'top' }], [{ leafW: w, leafH: 777 }])[0];
  // band edges, written out by hand
  const EDGES = [
    [349.5, SUB, false], [350, 'c_lock_350', false], [419.5, 'c_lock_350', false], [420, 'c_lock_350', false], [490, 'c_lock_350', false],
    [490.5, 'c_lock_420', false], [550, 'c_lock_420', false], [550.5, 'c_lock_540', false], [750, 'c_lock_540', false],
    [750.5, 'c_lock_740', false], [1000, 'c_lock_740', false], [1000.5, 'c_lock_1000', false], [1260, 'c_lock_1000', false],
    [1260.5, 'c_lock_1260', false], [1520, 'c_lock_1260', false], [1520.5, 'c_lock_1260', true], [0, SUB, true],
  ];
  const bad = EDGES.filter(([d, id, over]) => { const p = side(d); return p.slotId !== id || !!p.overLimit !== over || p.dim !== d; });
  ok(bad.length === 0, `band edges, side hung by HEIGHT (${EDGES.length} cases: 349.5 → sub-350, 350 → 350–490, 490.5 → 420–550, … 1520.5 → largest kit flagged, 0 → flagged)`, JSON.stringify(bad));
  const badTop = EDGES.filter(([d, id, over]) => { const p = top(d); return p.slotId !== id || !!p.overLimit !== over || p.dim !== d; });
  ok(badTop.length === 0, 'the same edges, top hung by WIDTH (the height is ignored)', JSON.stringify(badTop));

  let n = 0; const miss = [];
  for (let d = 300; d <= 1600; d += 0.5) {
    const [id, over] = expectSlot(d);
    for (const p of [side(d), top(d)]) { n += 1; if (p.slotId !== id || !!p.overLimit !== over) miss.push([d, p.slotId, id]); }
  }
  ok(miss.length === 0, `sweep 300 … 1600 mm in 0.5 mm steps, side and top (${n} picks) = the independent rule`, JSON.stringify(miss.slice(0, 5)));

  const l = side(800, 'left'), r = side(800, 'right'), t = top(800);
  ok(l.handing === 'RH' && l.hung === 'side' && r.handing === 'LH' && r.hung === 'side' && t.handing === null && t.hung === 'top',
    'handing: hinged LEFT (outside view) → RH, hinged RIGHT → LH, top hung → none');
  ok(H.selectCasementLocks([{ hinge: 'fixed' }, { hinge: 'left' }], [{ leafW: 500, leafH: 900 }, { leafW: 500, leafH: 900 }])[0] === null, 'a fixed light gets no lock (null pick)');
  ok(side(Infinity).overLimit === true && side(undefined).slotId === SUB && side(undefined).overLimit === true, 'no size at all (missing leaf) is flagged, never passed off as a small sash');

  const sum = H.summariseLocks([side(400, 'left'), side(400, 'right'), side(400, 'right'), top(400), null, side(2000)]);
  ok(JSON.stringify(sum.c_lock_350) === JSON.stringify({ LH: 2, RH: 1, unhanded: 1, count: 4, overLimit: false }) && sum.c_lock_1260.overLimit === true && sum.c_lock_1260.count === 1,
    'summary per band: LH / RH / unhanded / count, the flag carried through', JSON.stringify(sum));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — real engine path');
const cas = (id, w, h, fc = {}) => {
  const spec = specification.normaliseToWindowSpec({ id, name: id, width: w, height: h }, { fullConfig: { windowCategory: 'casement', ...fc } });
  return { spec, d: calculations.deriveWindowData(spec, {}) };
};
const lockQtys = (w) => Object.fromEntries(Object.entries(bom.buildWindowPartQtys(w.d, w.spec, {}, () => null)).filter(([k]) => k.startsWith('c_lock')).map(([k, v]) => [k, v.qty]));
const WIN = {
  single: cas('A', 1000, 1500, { casementLayout: '040L' }),
  fan: cas('B', 1200, 1500, { casementLayout: '052L' }),
  pair: cas('C', 1200, 1200, { casementLayout: '120' }),
  fixedLight: cas('D', 1500, 1200, { casementLayout: '180L' }),
  small: cas('E', 600, 440, { casementLayout: '040L' }),
  narrowFan: cas('G', 700, 1500, { casementLayout: '052L' }),
  tall: cas('F', 1000, 1700, { casementLayout: '040L' }),
  fixedWindow: cas('H', 1000, 1500, { casementLayout: '040L', casementKind: 'fixed' }),
};
{
  // every pick: the dimension is the LEAF height (side) or width (top) of that opener, the slot is the independent rule's
  for (const [name, w] of Object.entries(WIN)) {
    const hw = w.d.casement.hardware, leaves = w.d.casement.leaves;
    const wrong = hw.lockPicks.map((p, i) => {
      if (!p) return null;
      const dim = p.hung === 'top' ? leaves[i].leafW : leaves[i].leafH;
      const [id, over] = expectSlot(dim);
      return (p.dim === dim && p.slotId === id && !!p.overLimit === over) ? null : `${i}:${p.slotId}@${p.dim}`;
    }).filter(Boolean);
    ok(wrong.length === 0 && hw.lockPicks.length === leaves.length, `${name}: every opener sized by its own leaf — height when side hung, width when top hung (${hw.lockPicks.map((p) => (p ? `${p.slotId.replace('c_lock_', '')}${p.overLimit ? '!' : ''}` : 'fixed')).join(', ')})`, wrong.join(' '));
  }
  const pick = (w) => w.d.casement.hardware.lockPicks.map((p) => (p ? `${p.slotId}|${p.hung}|${p.handing}|${p.dim}${p.overLimit ? '|!' : ''}` : 'null'));
  ok(pick(WIN.single).join() === 'c_lock_1260|side|LH|1402', '040L 1000 × 1500: leaf 898 × 1402 → 1260–1520 kit, LH', pick(WIN.single).join());
  ok(pick(WIN.fan).join() === 'c_lock_420|top|null|532,c_lock_740|side|RH|924.8,c_lock_1260|side|LH|1402',
    '052L 1200 × 1500: fan 532 wide (top hung) → 420–550 TOP; light 924.8 high → 740–1000 RH; leaf 1402 high → 1260–1520 LH', pick(WIN.fan).join());
  ok(pick(WIN.pair).join() === 'c_lock_1000|side|RH|1102,c_lock_1000|side|LH|1102', '120 1200 × 1200: two leaves 1102 high → 1000–1260, one RH + one LH', pick(WIN.pair).join());
  ok(pick(WIN.fixedLight).join() === 'c_lock_1000|side|RH|1102,null', '180L 1500 × 1200: one opener (1000–1260 RH), the fixed light none', pick(WIN.fixedLight).join());
  ok(pick(WIN.small).join() === 'c_lock_sub350|side|LH|342', '040L 600 × 440: leaf 342 high → the sub-350 slot, NOT flagged (it is a real slot now)', pick(WIN.small).join());
  ok(pick(WIN.narrowFan)[0] === 'c_lock_sub350|top|null|282', '052L 700 × 1500: fan 282 wide (top hung) → the sub-350 slot by WIDTH', pick(WIN.narrowFan).join());
  ok(pick(WIN.tall).join() === 'c_lock_1260|side|LH|1602|!', '040L 1000 × 1700: leaf 1602 high → the largest kit, flagged', pick(WIN.tall).join());
  ok(pick(WIN.fixedWindow).join() === 'null' && Object.keys(WIN.fixedWindow.d.casement.hardware.lockSummary).length === 0, 'a fixed window: no lock at all');
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — BOM: one row per SKU');
{
  const allIds = new Set(store.ALL_PARTS.map((p) => p.id));
  const EXPECT = {
    single: { c_lock_1260_lh: 1 },
    fan: { c_lock_420_top: 1, c_lock_740_rh: 1, c_lock_1260_lh: 1 },
    pair: { c_lock_1000_lh: 1, c_lock_1000_rh: 1 },
    fixedLight: { c_lock_1000_rh: 1 },
    small: { c_lock_sub350: 1 },
    narrowFan: { c_lock_sub350: 1, c_lock_740_rh: 1, c_lock_1260_lh: 1 },
    tall: { c_lock_1260_lh: 1 },
    fixedWindow: {},
  };
  for (const [name, w] of Object.entries(WIN)) {
    const q = lockQtys(w);
    const same = JSON.stringify(Object.entries(q).sort()) === JSON.stringify(Object.entries(EXPECT[name]).sort());
    const openers = w.d.casement.hardware.lockPicks.filter(Boolean).length;
    const total = Object.values(q).reduce((a, b) => a + b, 0);
    ok(same && total === openers && Object.keys(q).every((k) => allIds.has(k)),
      `${name}: ${JSON.stringify(q)} — ${total} lock(s) for ${openers} opener(s), every id an Assign Materials row`, JSON.stringify(q));
  }
  // the sub-350 row adds LH + RH + TOP up; a band keeps them apart
  const d = JSON.parse(JSON.stringify(WIN.pair.d));
  d.casement.hardware.lockSummary = {
    c_lock_sub350: { LH: 1, RH: 2, unhanded: 3, count: 6, overLimit: false },
    c_lock_540: { LH: 4, RH: 5, unhanded: 6, count: 15, overLimit: false },
  };
  const q = Object.fromEntries(Object.entries(bom.buildWindowPartQtys(d, WIN.pair.spec, {}, () => null)).filter(([k]) => k.startsWith('c_lock')).map(([k, v]) => [k, `${v.qty} ${v.unit}`]));
  ok(JSON.stringify(q) === JSON.stringify({ c_lock_sub350: '6 pcs', c_lock_540_lh: '4 pcs', c_lock_540_rh: '5 pcs', c_lock_540_top: '6 pcs' }),
    'summary { sub350: 1 LH + 2 RH + 3 top, 540: 4 LH / 5 RH / 6 top } → sub-350 row 6 pcs; 540 rows 4 / 5 / 6 pcs', JSON.stringify(q));
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — merged purchase list with materials assigned per SKU');
{
  const materials = [
    { id: 'm-446', name: 'Excalibur RH Side 740-1000', cost_per_unit: 16.05 },
    { id: 'm-477', name: 'Excalibur TOP Hung 420-550', cost_per_unit: 13.71 },
    { id: 'm-483', name: 'Excalibur LH side 1000-1260', cost_per_unit: 17.17 },
    { id: 'm-old', name: 'left over from the old ladder', cost_per_unit: 1 },
  ];
  const data = { schema: 2, overrides: {}, base: {
    c_lock_740_rh: { material_id: 'm-446', yield: 1 },
    c_lock_420_top: { material_id: 'm-477', yield: 1 },
    c_lock_1000_lh: { material_id: 'm-483', yield: 1 },
    c_lock_312: { material_id: 'm-old', yield: 1 },     // orphans: ids of the 02.08.2026 ladder
    c_lock_958: { material_id: 'm-old', yield: 1 },
    c_lock_1218: { material_id: 'm-old', yield: 1 },
  } };
  const flat = partRegistry.expandAssignments(data);
  const windows = [WIN.fan, WIN.pair].map((w) => ({ windowSpec: w.spec, derived: w.d, batch: null }));
  const rows = bom.mergeWindowMaterials(windows, { assignments: flat, assignmentsData: data, materials, ALL_PARTS: store.ALL_PARTS, ironmongeryItems: [], settings: {} });
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  ok(by['mat:m-446']?.qty === 1 && by['mat:m-477']?.qty === 1 && by['mat:m-483']?.qty === 1,
    '052L + 120: RH 740–1000 → its material × 1, TOP 420–550 → its material × 1, LH 1000–1260 → its material × 1');
  ok(by['part:c_lock_1000_rh']?.qty === 1 && by['part:c_lock_1000_rh']._assigned === false && by['part:c_lock_1260_lh']?.qty === 1 && by['part:c_lock_1260_lh']._assigned === false,
    'the two rows nobody assigned (1000–1260 RH, 1260–1520 LH) show as unassigned parts, one each — visible, not dropped');
  ok(!by['mat:m-old'] && !rows.some((r) => /c_lock_(312|372|502|702|958|1218)/.test(r.key)),
    'assignments left on the old ids (c_lock_312 / 958 / 1218) are ignored — no hand-less material is applied to the new rows');
  const cost = rows.filter((r) => r.key.startsWith('mat:')).reduce((a, r) => a + r.qty * r.costPerUnit, 0);
  ok(Math.abs(cost - (16.05 + 13.71 + 17.17)) < 1e-9, `assigned lock cost = 16.05 + 13.71 + 17.17 = ${(16.05 + 13.71 + 17.17).toFixed(2)}`, String(cost));
  // Known, older than this change (checked on 8b0b96f) and deliberately NOT asserted: mergeWindowMaterials also lists
  // every engine-picked hardware line a second time as an unassigned `hw:` row.
  const dup = rows.filter((r) => r.key.startsWith('hw:') && /Lock/.test(r.name));
  console.log(`NOTE  ${dup.length} extra "hw:" lock line(s) in the merged list duplicate the rows above (${dup.map((r) => `${r.qty} × ${r.name}`).join('; ')}) — older behaviour of mergeWindowMaterials, not asserted here`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — hardware list labels; the old ladder is gone from src');
{
  const hl = (w) => lists.buildHardwareList(w.spec, w.d).filter((r) => /Lock/.test(r.item)).map((r) => `${r.item} | ${r.detail} | ${r.quantity}`);
  ok(hl(WIN.fan).join(' ; ') === 'Espag Lock Kit — sash 420–550mm | 1 top (unhanded) | 1 ; Espag Lock Kit — sash 740–1000mm | 1 RH | 1 ; Espag Lock Kit — sash 1260–1520mm | 1 LH | 1',
    'hardware list 052L: one line per band with the hands', hl(WIN.fan).join(' ; '));
  ok(hl(WIN.pair).join() === 'Espag Lock Kit — sash 1000–1260mm | 1 LH / 1 RH | 2', 'hardware list 120: 1000–1260, 1 LH / 1 RH, 2', hl(WIN.pair).join());
  ok(hl(WIN.small).join() === 'Lock — sash <350mm | 1 LH | 1', 'hardware list, sash under 350: "Lock — sash <350mm"', hl(WIN.small).join());
  ok(hl(WIN.tall).join() === 'Espag Lock Kit — sash 1260–1520mm | 1 LH / ! verify size | 1', 'hardware list, sash over 1520: the largest kit with "! verify size"', hl(WIN.tall).join());

  const files = [];
  const walk = (dir) => readdirSync(dir).forEach((f) => { const p = resolve(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|jsx)$/.test(f)) files.push(p); });
  walk(resolve(ROOT, 'src'));
  const old = /c_lock_(312|372|502|702|958|1218)\b/;
  // casementHardware.js names the old ladder once in a comment ("312–448 … 1218–1482"), never as an id
  const hits = files.filter((f) => old.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  ok(hits.length === 0, `no id of the 02.08.2026 ladder (c_lock_312 … c_lock_1218) in ${files.length} src files`, hits.join(', '));
}

console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
