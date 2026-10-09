/**
 * t37 — the single window IS the purchase list (Piotr 07.09.2026: "single
 * window first, a pack is made of single windows"; 05.10.2026: the purchase
 * list of a client is built from his single windows and doors, never from a
 * batch — so whatever a window shows must be what its list buys).
 *
 * Until 05.10.2026 the window's BOM tab counted its cards with a loop of its
 * own next to mergeWindowMaterials: every engine-picked casement hinge / lock /
 * restrictor / wedge line came back a second time as an "unassigned" hardware
 * card, the custom consumables were missing from the window, and the
 * "Unassigned" card added metres, litres and pieces into one number.
 *
 * Now src/engine/bom.js has ONE list: buildWindowMaterialLines (one window) →
 * windowBomCards (that window's tab) and mergeWindowMaterials (the sum of the
 * lines of many windows). Sections:
 *   1  the purchase list against the rules typed again here — custom
 *      consumables, Assign Materials rows with yield, client-chosen hardware,
 *      engine-picked hardware never as a line of its own
 *   2  the sum rule: the lists of the single windows add up to the list of all
 *      windows — sash, casement and doors mixed
 *   3  the window's cards: every card total IS the purchase-list row, every
 *      list row is on a card, the unassigned card has no total, custom
 *      consumables are shown
 *   4  hardware: no card for an engine-picked line; its quantity is in the
 *      Assign Materials rows; sash windows and the slot rules are as before
 *   5  the window BOM PDF: engine lines keep their detail and carry no
 *      "— unassigned"; a client product that is not chosen still does
 *   6  the pages count nothing themselves
 *
 * Run: node verify/parity/t37_single_window_bom.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });

// Engine + the assignment store + the BOM PDF in one bundle. The store imports
// the Supabase client, which reads import.meta.env — defined empty here, so the
// client is simply "not configured" and nothing touches the network.
const entry = resolve(AUDIT, 't37-entry.mjs');
const rel = (p) => './' + relative(AUDIT, resolve(ROOT, 'src', p)).replace(/\\/g, '/');
writeFileSync(entry, [
  ...['specification', 'calculations', 'lists', 'bom', 'casementHardware', 'partRegistry'].map((m) => `export * as ${m} from '${rel(`engine/${m}.js`)}';`),
  `export * as store from '${rel('stores/materialAssignmentStore.js')}';`,
  `export * as bomPdf from '${rel('utils/bomPdfExport.js')}';`,
].join('\n'));
const out = resolve(AUDIT, 't37-bundle.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
  '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}',
  '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
  `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const M = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
const { specification, calculations, lists, bom, casementHardware: H, partRegistry, store, bomPdf } = M;
const ALL_PARTS = store.ALL_PARTS;

let fails = 0;
const ok = (cond, msg, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  — ${detail}` : ''}`); if (!cond) fails += 1; };
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b) => Math.abs(a - b) <= 1e-9;

// ── windows: real engine path (normaliseToWindowSpec → deriveWindowData) ─────
const BATCH = { id: 'b1', defaults: { ironmongerySlots: { casementHandles: 'irn-handle', trickleVents: 'irn-vent', locks: 'irn-sashlock' } } };
const mk = (id, w, h, fc, batch = null) => {
  const windowSpec = specification.normaliseToWindowSpec({ id, name: id, width: w, height: h }, { fullConfig: fc });
  return { id, windowSpec, derived: calculations.deriveWindowData(windowSpec, {}), batch };
};
const sash = (id, w, h, fc = {}, batch) => mk(id, w, h, { windowCategory: 'sash', frameType: 'standard', ...fc }, batch);
// Child restrictor box ticked on every casement here, so the restrictor rows are exercised (05.10.2026: counted only when ticked).
const cas = (id, w, h, fc = {}, batch) => mk(id, w, h, { windowCategory: 'casement', childRestrictor: true, ...fc }, batch);
const WINS = [
  sash('S-std', 1000, 1600, {}, BATCH),
  sash('S-bars', 1300, 1800, { upperBars: '2x2', lowerBars: '2x2' }),
  sash('S-slim', 900, 1500, { frameType: 'slim' }),
  sash('S-acoustic', 1000, 1500, { glassSpec: 'acoustic' }),
  sash('S-fixed', 1000, 1500, { openingType: 'fixed' }, BATCH),
  cas('C-single', 1000, 1500, { casementLayout: '040L' }, BATCH),
  cas('C-fan', 1200, 1500, { casementLayout: '052L' }, BATCH),
  cas('C-pair', 1200, 1200, { casementLayout: '120' }),
  cas('C-light', 1500, 1200, { casementLayout: '180L' }),
  cas('C-top', 1000, 600, { casementLayout: '010T' }, BATCH),
  cas('C-fixed', 1000, 1500, { casementLayout: '040L', casementKind: 'fixed' }, BATCH),
  cas('C-acoustic', 1000, 1500, { casementLayout: '040L', glassSpec: 'acoustic' }),
  cas('C-own-handle', 1200, 1500, { casementLayout: '052L', ironmongerySlots: { casementHandles: 'irn-handle2' } }, BATCH),
  mk('D-single', 1000, 2100, { windowCategory: 'door', doorType: 'single-external' }),
  mk('D-french', 1200, 2100, { windowCategory: 'door', doorType: 'french' }),
];
const CASEMENTS = WINS.filter((w) => w.derived.category === 'casement');
const SASHES = WINS.filter((w) => w.derived.category === 'sash');

// ── catalogue + three assignment sets ────────────────────────────────────────
const IRN = [
  { id: 'irn-handle', name: 'Chrome handle', unit: 'pcs', cost_per_unit: 4, item_number: 'IRN-004' },
  { id: 'irn-handle2', name: 'Brass handle', unit: 'pcs', cost_per_unit: 6 },
  { id: 'irn-vent', name: 'Trickle vent 389', unit: 'pcs', cost_per_unit: 11.3 },
  { id: 'irn-sashlock', name: 'Sash lock brass', unit: 'pcs', cost_per_unit: 9 },
  { id: 'irn-hinge', name: 'Friction hinge 413', unit: 'pcs', cost_per_unit: 7.95 },
];
const SETS = {};
SETS.none = { materials: [], data: { schema: 2, base: {}, overrides: {}, customParts: [{ id: 'cp1', name: 'Clips ADDD', unit: 'pcs', qtyPerWindow: 2 }] } };
{
  // every row assigned to a material of its own; yields 1 / 2 / 0.5 / 1.15;
  // a hinge row on an Ironmongery item; a custom consumable on a material it
  // shares with a regular row, a second one left unassigned
  const materials = [], base = {};
  ALL_PARTS.forEach((p, i) => {
    materials.push({ id: `m:${p.id}`, name: `MAT ${String(i).padStart(3, '0')}`, size: i % 3 ? '150 x 38mm' : '63x95', cost_per_unit: 1 + (i % 7) * 0.37, item_number: `MAT-${100 + i}` });
    base[p.id] = { material_id: `m:${p.id}`, yield: [1, 1, 2, 0.5, 1.15][i % 5] };
  });
  base.c_hinge_side_600 = { material_id: 'irn-hinge', yield: 2 };
  base.cp1 = { material_id: 'm:c_glazing_packer', yield: 1 };
  SETS.all = { materials, data: { schema: 2, base, overrides: {}, customParts: [{ id: 'cp1', name: 'Clips ADDD', unit: 'pcs', qtyPerWindow: 2 }, { id: 'cp2', name: 'Fixing foam', unit: 'tubes', qtyPerWindow: 0.5 }] } };
}
{
  // every third row assigned, two materials shared by many rows, a frame
  // variant override, an assignment to a material that no longer exists
  const materials = [{ id: 'shared', name: 'Shared timber 63x95', size: '63 x 95mm', cost_per_unit: 12.5 }, { id: 'other', name: 'Other stock', cost_per_unit: 7 }], base = {};
  ALL_PARTS.forEach((p, i) => { if (i % 3 === 0) base[p.id] = { material_id: i % 2 ? 'shared' : 'other', yield: i % 4 ? 1 : 1.3 }; });
  base.c_frame_head = { material_id: 'deleted-material', yield: 1 };
  SETS.mixed = { materials, data: { schema: 2, base, overrides: { head: { slim: { material_id: 'other', yield: 3 } } }, customParts: [{ id: 'cp3', name: 'Label', unit: 'pcs', qtyPerWindow: 1 }] } };
}
const ctxOf = (set) => ({ assignments: partRegistry.expandAssignments(set.data), assignmentsData: set.data, materials: set.materials, ALL_PARTS, ironmongeryItems: IRN, settings: {} });
const CTX = Object.fromEntries(Object.entries(SETS).map(([k, set]) => [k, ctxOf(set)]));
const linesOf = (w, ctx) => bom.buildWindowMaterialLines(w, ctx);
const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));

// Engine-picked casement hardware, by NAME (typed here — not the flag the
// engine sets on its own lines): the rows of Assign Materials › Ironmongery.
// 08.10.2026 (doors to production): the door hardware lines are engine picks too: every count is a
// door Assign Materials row (d_hinges, d_lock_*_kit, d_cylinder, d_handle_set, d_bolts, d_threshold_*).
const isEngineItem = (item) => /^(Side Hinges|Top Hung Hinges|Espag Lock Kit|Lock — sash)/.test(item) || item === 'Child restrictor' || item === 'Wedge packers'
  || /^(Door hinges|Multipoint lock, (single|double) door kit|Door cylinder|Door handle set|Door bolts|Door threshold)$/.test(item);
// …and everything else a casement window may list: the products the client chooses.
const CLIENT_CASEMENT_ITEMS = ['Casement handle', 'Trickle vents'];

// ═══════════════════════════════════════════════════════════════════════════
section('1 — the purchase list against the rules typed again here');
// The list written a second time, without buildWindowMaterialLines /
// mergeMaterialLines: per window — custom consumables (qty per window × yield),
// every Assign Materials row the window has a quantity for (× yield; metres
// for lengths), the client-chosen hardware by slot. Same key → add up.
const referenceList = (windows, ctx) => {
  const acc = new Map();
  const add = (key, qty, f) => { if (!acc.has(key)) acc.set(key, { key, qty: 0, ...f }); acc.get(key).qty += qty; };
  const find = (id) => ctx.materials.find((m) => m.id === id) || null;
  for (const { derived, windowSpec, batch } of windows) {
    const ft = windowSpec.frame?.type || 'standard';
    const asg = (id) => bom.effectiveAssignment(id, ft, ctx.assignmentsData, ctx.assignments);
    for (const cp of ctx.assignmentsData.customParts || []) {
      const a = asg(cp.id);
      const total = cp.qtyPerWindow * (a?.yield || 1);
      const mat = a?.material_id ? find(a.material_id) : null;
      if (mat) add(`mat:${mat.id}`, total, { name: mat.name, _assigned: true });
      else add(`part:${cp.id}`, total, { name: cp.name, _assigned: false });
    }
    const pq = bom.buildWindowPartQtys(derived, windowSpec, ctx.settings);
    for (const part of ALL_PARTS) {
      const e = pq[part.id];
      if (!e) continue;
      const a = asg(part.id);
      const total = (e.mm != null ? e.mm / 1000 : e.qty) * (a?.yield || 1);
      const mat = a?.material_id ? (find(a.material_id) || IRN.find((m) => m.id === a.material_id) || null) : null;
      if (mat) add(`mat:${mat.id}`, total, { name: mat.name, _assigned: true });
      else add(`part:${part.id}`, total, { name: part.name, _assigned: false });
    }
    const slots = { ...(batch?.defaults?.ironmongerySlots || {}), ...(windowSpec.hardware?.slots || {}) };
    const slotOf = { 'Sash lock': 'locks', 'Finger lift': 'fingerLifts', 'Sash pull handle': 'pullHandles', 'Pulley wheels': 'pulleys', 'Window stopper': 'stoppers', 'Trickle vent': 'trickleVents', 'Casement handle': 'casementHandles', 'Trickle vents': 'trickleVents' };
    // 08.10.2026: doors are walked like every window (until then: `if door continue`, no door hardware)
    for (const h of lists.buildHardwareList(windowSpec, derived)) {
      if (isEngineItem(h.item)) continue;
      const product = IRN.find((m) => m.id === slots[slotOf[h.item]]) || null;
      if (product) add(`irn:${product.id}`, h.quantity, { name: product.name, _assigned: true });
      else add(`hw:${h.item}`, h.quantity, { name: h.item, _assigned: false });
    }
  }
  return [...acc.values()];
};
for (const [name, ctx] of Object.entries(CTX)) {
  const bad = [];
  for (const w of [...WINS.map((x) => [x]), WINS]) {
    const got = byKey(bom.mergeWindowMaterials(w, ctx)), ref = byKey(referenceList(w, ctx));
    const label = w.length === 1 ? w[0].id : 'ALL';
    const keys = new Set([...Object.keys(got), ...Object.keys(ref)]);
    for (const k of keys) {
      if (!got[k] || !ref[k]) { bad.push(`${label} ${k} only in ${got[k] ? 'engine' : 'reference'}`); continue; }
      if (!near(got[k].qty, ref[k].qty) || got[k].name !== ref[k].name || got[k]._assigned !== ref[k]._assigned) bad.push(`${label} ${k} ${got[k].qty} vs ${ref[k].qty}`);
    }
  }
  ok(bad.length === 0, `[${name}] every window alone and all ${WINS.length} together: rows, names and quantities as the rules typed here`, bad.slice(0, 4).join(' | '));
}
{
  // mergeWindowMaterials is nothing but the sum of the windows' lines
  const bad = [];
  for (const [name, ctx] of Object.entries(CTX)) {
    for (const w of WINS) if (JSON.stringify(bom.mergeWindowMaterials([w], ctx)) !== JSON.stringify(bom.mergeMaterialLines(linesOf(w, ctx)))) bad.push(`${name}/${w.id}`);
    if (JSON.stringify(bom.mergeWindowMaterials(WINS, ctx)) !== JSON.stringify(bom.mergeMaterialLines(WINS.flatMap((w) => linesOf(w, ctx))))) bad.push(`${name}/ALL`);
  }
  ok(bad.length === 0, 'mergeWindowMaterials(windows) = mergeMaterialLines(the lines of every window), row for row', bad.join(' '));
  // 08.10.2026 (doors to production, brief 3.5 "the purchase list note"): a row may list the variants of its
  // lines with their quantities (`notes`, door lock kits only); a sum over windows, not one window's detail
  const rowKeys = ['key', 'qty', 'name', 'unit', 'costPerUnit', 'source', 'material', 'product', '_assigned', 'notes'];
  const noted = bom.mergeWindowMaterials(WINS, CTX.none).filter((r) => r.notes);
  ok(noted.length > 0 && noted.every((r) => /^part:d_(lock_single_kit|lock_double_kit|cylinder)$/.test(r.key) && near(r.notes.reduce((a, n) => a + n.qty, 0), r.qty)),
    `variant notes only on the door lock rows, their quantities add up to the row (${noted.map((r) => r.key).join(', ')})`);
  const extra = [...new Set(bom.mergeWindowMaterials(WINS, CTX.all).flatMap((r) => Object.keys(r)))].filter((k) => !rowKeys.includes(k));
  ok(extra.length === 0, 'a purchase-list row carries the row fields only — no single-window detail leaks into it', extra.join(','));
  ok(bom.mergeWindowMaterials([], CTX.all).length === 0 && bom.mergeWindowMaterials([{ derived: null, windowSpec: null }, { derived: WINS[0].derived, windowSpec: null }], CTX.all).length === 0 && bom.buildWindowMaterialLines(null, CTX.all).length === 0,
    'no windows, or a window that failed to calculate → an empty list, no crash');
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — the sum rule: single windows add up to the list');
for (const [name, ctx] of Object.entries(CTX)) {
  const sum = {};
  WINS.forEach((w) => bom.mergeWindowMaterials([w], ctx).forEach((r) => { sum[r.key] = (sum[r.key] || 0) + r.qty; }));
  const all = byKey(bom.mergeWindowMaterials(WINS, ctx));
  const keys = new Set([...Object.keys(sum), ...Object.keys(all)]);
  const bad = [...keys].filter((k) => !all[k] || sum[k] == null || !near(sum[k], all[k].qty));
  ok(bad.length === 0 && keys.size > 20, `[${name}] ${SASHES.length} sash + ${CASEMENTS.length} casement + 2 doors: the ${keys.size} rows of the whole list = the single-window lists added up`, bad.slice(0, 5).join(', '));
}
{
  // the order of the windows does not matter, and a second copy of a window doubles its rows
  const a = byKey(bom.mergeWindowMaterials(WINS, CTX.all)), b = byKey(bom.mergeWindowMaterials([...WINS].reverse(), CTX.all));
  ok(Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => b[k] && near(a[k].qty, b[k].qty)), 'the list does not depend on the order of the windows');
  const one = byKey(bom.mergeWindowMaterials([WINS[5]], CTX.mixed)), two = byKey(bom.mergeWindowMaterials([WINS[5], WINS[5]], CTX.mixed));
  ok(Object.keys(one).every((k) => near(two[k].qty, 2 * one[k].qty)) && Object.keys(one).length === Object.keys(two).length, 'two identical windows buy exactly twice one window');
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — the window cards are the purchase-list rows');
for (const [name, ctx] of Object.entries(CTX)) {
  const bad = [];
  let cardCount = 0, partRows = 0;
  for (const w of WINS) {
    const lines = linesOf(w, ctx);
    const cards = bom.windowBomCards(lines);
    const list = byKey(bom.mergeWindowMaterials([w], ctx));
    if (JSON.stringify(cards.rows) !== JSON.stringify(bom.mergeWindowMaterials([w], ctx))) bad.push(`${w.id}: cards.rows is not the window's list`);
    // every material card: its total and unit ARE the list row; its part rows add up to it
    for (const c of cards.materials) {
      cardCount += 1;
      const row = list[c.key];
      if (!row || row.qty !== c.total || row.unit !== c.unit || row.material !== c.material) { bad.push(`${w.id}: card ${c.key} ≠ its row`); continue; }
      if (!near(c.parts.reduce((a, p) => a + p.total, 0), c.total)) bad.push(`${w.id}: card ${c.key} part rows do not add up`);
      partRows += c.parts.length;
    }
    // the unassigned card: one row per `part:` list row, same quantity and unit, and NO total of its own
    const un = cards.unassigned ? cards.unassigned.parts : [];
    if (cards.unassigned && ('total' in cards.unassigned || 'unit' in cards.unassigned)) bad.push(`${w.id}: the unassigned card has a total`);
    for (const p of un) {
      const row = list[`part:${p.id}`];
      if (!row || row.qty !== p.total || row.unit !== p.unit || row._assigned !== false) bad.push(`${w.id}: unassigned ${p.id} ≠ its row`);
    }
    partRows += un.length;
    // nothing in the list is missing from the window, nothing on the window is missing from the list
    const shown = new Set([...cards.materials.map((c) => c.key), ...un.map((p) => `part:${p.id}`), ...cards.hardware.map((h) => h.key)]);
    for (const k of Object.keys(list)) if (!shown.has(k)) bad.push(`${w.id}: list row ${k} is not on the window`);
    for (const k of shown) if (!list[k]) bad.push(`${w.id}: ${k} is on the window, not in its list`);
    if (lines.filter((l) => l.part).length !== cards.materials.reduce((a, c) => a + c.parts.length, 0) + un.length) bad.push(`${w.id}: a part line was dropped or doubled`);
  }
  ok(bad.length === 0 && partRows > 100, `[${name}] ${WINS.length} windows: every card total is its purchase-list row, every row is on a card (${cardCount} material cards, ${partRows} part rows)`, bad.slice(0, 4).join(' | '));
}
{
  // custom consumables are on the window (they were only in the list before)
  const cN = bom.windowBomCards(linesOf(WINS[0], CTX.none));
  const cp = cN.unassigned.parts.find((p) => p.id === 'cp1');
  ok(cp && cp.custom === true && cp.total === 2 && cp.unit === 'pcs' && cp.name === 'Clips ADDD', 'a custom consumable with no material: a row of the unassigned card, 2 pcs', JSON.stringify(cp));
  ok(WINS.every((w) => bom.windowBomCards(linesOf(w, CTX.none)).unassigned.parts.some((p) => p.id === 'cp1')), 'every window and door shows it — sash, casement, doors');
  const cA = bom.windowBomCards(linesOf(CASEMENTS[0], CTX.all));
  const packer = cA.materials.find((c) => c.key === 'mat:m:c_glazing_packer');
  const own = packer.parts.find((p) => p.id === 'c_glazing_packer'), custom = packer.parts.find((p) => p.id === 'cp1');
  ok(own && custom && custom.custom === true && packer.parts.indexOf(custom) > packer.parts.indexOf(own) && near(packer.total, own.total + 2),
    'a custom consumable on a material it shares with a regular row: same card, after the regular row, and the card total holds both', JSON.stringify(packer.parts.map((p) => [p.id, p.total])));
  ok(cA.unassigned?.parts.length === 1 && cA.unassigned.parts[0].id === 'cp2' && cA.unassigned.parts[0].total === 0.5 && cA.unassigned.parts[0].unit === 'tubes', 'everything assigned but one custom consumable → the unassigned card holds that one row only');
  // Assign Materials order on the screen; custom consumables last
  const order = bom.windowBomCards(linesOf(CASEMENTS[1], CTX.none)).unassigned.parts.map((p) => p.id);
  const idx = order.filter((id) => id !== 'cp1').map((id) => ALL_PARTS.findIndex((p) => p.id === id));
  ok(idx.every((v, i) => i === 0 || v > idx[i - 1]) && order[order.length - 1] === 'cp1', 'rows keep the Assign Materials order; custom consumables come last');
  // the old card added metres + m² + litres + pieces into one "total"
  const units = [...new Set(bom.windowBomCards(linesOf(SASHES[0], CTX.none)).unassigned.parts.map((p) => p.unit))];
  ok(units.length >= 5, `the unassigned rows of one sash window are in ${units.length} different units (${units.join(', ')}) — which is why the card has no total`);
  // yield and a row assigned to a deleted material
  const hinge = bom.windowBomCards(linesOf(WINS.find((w) => w.id === 'C-fan'), CTX.all)).materials.find((c) => c.key === 'mat:irn-hinge');
  ok(hinge && hinge.material.id === 'irn-hinge' && hinge.parts.length === 1 && hinge.parts[0].yieldCoeff === 2 && hinge.total === 2 * linesOf(WINS.find((w) => w.id === 'C-fan'), CTX.none).find((l) => l.part?.id === 'c_hinge_side_600').qty,
    'a hinge row on an Ironmongery item with Yield 2: its own card, twice the pairs', JSON.stringify(hinge?.parts));
  const gone = bom.windowBomCards(linesOf(CASEMENTS[0], CTX.mixed));
  ok(gone.unassigned.parts.some((p) => p.id === 'c_frame_head') && !gone.materials.some((c) => c.key === 'mat:deleted-material'), 'a row assigned to a material that no longer exists is shown as unassigned, on the window as in the list');
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — hardware: no card for an engine-picked line');
{
  const bad = [];
  let engineLines = 0, cards = 0;
  for (const w of CASEMENTS) {
    const hwList = lists.buildHardwareList(w.windowSpec, w.derived);
    const c = bom.windowBomCards(linesOf(w, CTX.none));
    cards += c.hardware.length;
    engineLines += hwList.filter((h) => isEngineItem(h.item)).length;
    for (const g of c.hardware) if (isEngineItem(g.line.item) || g.line.enginePart) bad.push(`${w.id}: card for ${g.line.item}`);
    const names = c.hardware.map((g) => g.line.item);
    if (JSON.stringify(names) !== JSON.stringify(hwList.filter((h) => !isEngineItem(h.item)).map((h) => h.item))) bad.push(`${w.id}: cards ${names.join(',')}`);
    for (const h of hwList) {
      if (isEngineItem(h.item) !== (h.enginePart === true)) bad.push(`${w.id}: ${h.item} flag ${h.enginePart}`);
      if (!isEngineItem(h.item) && !CLIENT_CASEMENT_ITEMS.includes(h.item)) bad.push(`${w.id}: unknown hardware line "${h.item}" — a row of Assign Materials or a client product?`);
    }
  }
  ok(bad.length === 0 && engineLines >= 20, `${CASEMENTS.length} casement windows: ${engineLines} engine-picked lines (hinges, locks, restrictors, wedge packers) — none gets a hardware card; the ${cards} cards are handles and vents only`, bad.slice(0, 4).join(' | '));
}
{
  // …and nothing is lost: the engine's picks are in the Assign Materials rows of the same window
  const bad = [];
  for (const w of CASEMENTS) {
    const hw = w.derived.casement.hardware;
    const part = Object.fromEntries(linesOf(w, CTX.none).filter((l) => l.part).map((l) => [l.part.id, l]));
    let side = 0, wedgeMm = 0;
    for (const [slotId, e] of Object.entries(hw.hingeSummary)) {
      if (part[slotId]?.qty !== e.pairs || part[slotId]?.unit !== 'pairs') bad.push(`${w.id}: ${slotId}`);
      if (!slotId.startsWith('c_hinge_top')) { side += e.pairs; wedgeMm += e.pairs * H.hingeWedgeMm(slotId); }
    }
    const restrictors = (part.c_child_restrictor_lh?.qty || 0) + (part.c_child_restrictor_rh?.qty || 0);
    if (restrictors !== side || (part.c_child_restrictor_stud?.qty || 0) !== side) bad.push(`${w.id}: restrictors ${restrictors}, studs ${part.c_child_restrictor_stud?.qty} vs ${side} side hung`);
    if (!near(part.c_wedge_packer?.qty || 0, wedgeMm / 1000)) bad.push(`${w.id}: wedge ${part.c_wedge_packer?.qty} vs ${wedgeMm / 1000}`);
    const locks = Object.values(part).filter((l) => l.part.id.startsWith('c_lock')).reduce((a, l) => a + l.qty, 0);
    const picked = Object.values(hw.lockSummary || {}).reduce((a, e) => a + e.count, 0);
    if (locks !== picked) bad.push(`${w.id}: locks ${locks} vs ${picked}`);
    const openers = Object.values(hw.hingeSummary).reduce((a, e) => a + e.pairs, 0);
    if (picked !== openers) bad.push(`${w.id}: ${picked} locks for ${openers} openers`);
  }
  ok(bad.length === 0, 'every hinge pair, lock kit, restrictor and wedge the engine picked is a part row of the same window (pairs / pcs / metres)', bad.slice(0, 4).join(' | '));
  const fixed = WINS.find((w) => w.id === 'C-fixed');
  ok(Object.keys(fixed.derived.casement.hardware.hingeSummary).length === 0 && !linesOf(fixed, CTX.none).some((l) => /^c_(hinge|lock|child|wedge)/.test(l.part?.id || '')), 'a fixed casement: no hinge, lock, restrictor or wedge row at all');
}
{
  // client-chosen products: batch default, the window's own choice, nothing chosen, the old vent key
  const card = (w, ctx = CTX.none) => bom.windowBomCards(linesOf(w, ctx)).hardware;
  const single = card(WINS.find((w) => w.id === 'C-single'));
  const handle = single.find((g) => g.line.item === 'Casement handle'), vents = single.find((g) => g.line.item === 'Trickle vents');
  ok(handle?.product?.id === 'irn-handle' && handle.key === 'irn:irn-handle' && vents?.product?.id === 'irn-vent', 'batch default slots: the handle and vent cards carry the chosen products');
  const own = card(WINS.find((w) => w.id === 'C-own-handle')).find((g) => g.line.item === 'Casement handle');
  ok(own?.product?.id === 'irn-handle2', "the window's own choice wins over the batch default");
  const none = card(WINS.find((w) => w.id === 'C-pair'));
  ok(none.length === 2 && none.every((g) => g.product === null && g.key === `hw:${g.line.item}`), 'nothing chosen: the handle and vent cards stay, without a product (the only "unassigned" hardware a casement shows)', JSON.stringify(none.map((g) => g.key)));
  const legacy = cas('L', 1000, 1500, { casementLayout: '040L', ironmongerySlots: { casementVents: 'irn-vent' } });
  ok(card(legacy).find((g) => g.line.item === 'Trickle vents')?.product?.id === 'irn-vent', 'a window saved with the old casementVents key still gets its vent product');
  const fixedCards = card(WINS.find((w) => w.id === 'C-fixed'));
  ok(fixedCards.length === 1 && fixedCards[0].line.item === 'Trickle vents', 'a fixed casement: the vent card only — no handle');
  // sash windows: every hardware line is a client product, exactly as before
  const badSash = SASHES.filter((w) => JSON.stringify(card(w).map((g) => [g.line.item, g.line.quantity])) !== JSON.stringify(lists.buildHardwareList(w.windowSpec, w.derived).map((h) => [h.item, h.quantity])));
  ok(badSash.length === 0 && card(SASHES[0]).length >= 5, `sash windows: one card per hardware line, as before (${card(SASHES[0]).length} on a standard sash)`, badSash.map((w) => w.id).join(','));
  ok(card(SASHES[0]).find((g) => g.line.item === 'Sash lock')?.product?.id === 'irn-sashlock', 'sash: the lock card carries the batch default product');
  // 08.10.2026 (doors to production): door ironmongery IS counted now, on the door Assign Materials rows,
  // so a door shows no hardware CARD (every door line is an engine pick, as casement hinges and locks are)
  // and its rows carry the counts of the owner box (3.5). Until 07.10.2026 the pin was "no hardware at all".
  // doors v3 (09.10.2026, owner box item 10): trickle vents are counted on doors by the window rule, a
  // client line on the trickleVents slot, so a door shows exactly ONE card, the vents; every other door
  // line is still an engine pick on a d_* row
  ok(WINS.filter((w) => w.derived.category === 'door').every((w) => { const c = card(w); return c.length === 1 && c[0].line.item === 'Trickle vents' && c[0].line.quantity === lists.buildVentGrilles(w.windowSpec); }),
    'doors: one hardware card, the trickle vents (doors v3); every other door line is an engine pick on a d_* row');
  const doorRows = (id) => bom.buildWindowPartQtys(WINS.find((w) => w.id === id).derived, WINS.find((w) => w.id === id).windowSpec, {});
  const ds = doorRows('D-single'), df = doorRows('D-french');
  ok(ds.d_hinges?.qty === 3 && ds.d_lock_single_kit?.qty === 1 && ds.d_cylinder?.qty === 1 && ds.d_handle_set?.qty === 1
    && df.d_hinges?.qty === 6 && df.d_lock_single_kit?.qty === 1 && df.d_bolts?.qty === 2 && df.d_cylinder?.qty === 1 && df.d_handle_set?.qty === 1,
    'doors: the hardware counts sit on the door rows (single 3 hinges + kit + cylinder + handle; french one handle 6 + kit + 2 bolts + cylinder + handle)');
  ok(WINS.filter((w) => w.derived.category === 'door').every((w) => lists.buildHardwareList(w.windowSpec, w.derived).filter((h) => h.item !== 'Trickle vents').every((h) => isEngineItem(h.item) && h.enginePart === true)),
    'doors: every door hardware line but the vents is an engine pick (typed here and flagged by the engine)');
}

// ═══════════════════════════════════════════════════════════════════════════
section('5 — the window BOM PDF: engine lines without "— unassigned"');
{
  const w = WINS.find((x) => x.id === 'C-fan');
  const rows = bom.windowHardwareDetailRows(w.windowSpec, null, IRN, w.derived);
  const engine = rows.filter((r) => isEngineItem(r.item)), client = rows.filter((r) => !isEngineItem(r.item));
  ok(rows.length === lists.buildHardwareList(w.windowSpec, w.derived).length && engine.length >= 6, `the table keeps every hardware line — ${engine.length} engine-picked + ${client.length} client-chosen`);
  ok(engine.every((r) => !('assigned' in r)), 'an engine-picked line says nothing about "assigned" (its Assign Materials row does, in the materials table)');
  ok(client.length === 2 && client.every((r) => r.assigned === false), 'a client product that is not chosen is still marked unassigned');
  const chosen = bom.windowHardwareDetailRows(w.windowSpec, BATCH, IRN, w.derived).filter((r) => !isEngineItem(r.item));
  ok(chosen.some((r) => r.item === 'Chrome handle' && r.assigned === true), 'a chosen product prints under its own name, assigned');
  ok(engine.some((r) => /LH|RH|top \(unhanded\)/.test(r.detail)) && engine.some((r) => r.detail.startsWith('pairs')) && engine.some((r) => /m in total/.test(r.detail)), 'the detail survives: lock hands, hinge pairs, wedge metres', JSON.stringify(engine.map((r) => r.detail)));
  const flagged = cas('X', 1000, 600, { casementLayout: '010T' });
  ok(bom.windowHardwareDetailRows(flagged.windowSpec, null, IRN, flagged.derived).some((r) => r.detail.includes('! verify limits') && !('assigned' in r)), 'a top hung leaf outside every row keeps its "! verify limits" in the table');

  // the real PDF of that window with nothing chosen for the handle and the
  // vent and everything else assigned but one consumable: the only lines that
  // may say "unassigned" are those — in the materials table and, for the two
  // products, again in the hardware table
  try {
    const list = bom.windowBomCards(linesOf({ ...w, batch: null }, CTX.all)).rows;
    const buf = bomPdf.exportBomPDF({
      title: 'T37', projects: ['037'], date: '05/10/2026', companyName: 'HARNESS', subtitle: 'BILL OF MATERIALS — WINDOW', scopeLabel: 'Window',
      rows: list.map((r) => ({ name: r.name, itemNumber: r.material?.item_number || r.product?.item_number || '', qty: bom.formatQty(r.qty, r.unit), unitCost: '—', estCost: '—', ironmongery: r.source === 'ironmongery', assigned: r._assigned })),
      total: '£0.00', hardware: rows, returnDoc: true,
    });
    const bytes = Buffer.from(buf);
    writeFileSync(resolve(AUDIT, 't37_window_bom.pdf'), bytes);
    // Text strings of the PDF. jsPDF writes a string holding a character
    // outside WinAnsi (the "≤" of the hinge names) as two bytes per character.
    const strings = [...bytes.toString('latin1').matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)].map((m) => {
      const raw = m[1].replace(/\\(.)/gs, '$1');
      if (!raw.includes('\0')) return raw;
      let t = '';
      for (let i = 0; i + 1 < raw.length; i += 2) t += String.fromCharCode((raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1));
      return t;
    });
    const marked = strings.filter((x) => x.includes('unassigned'));
    ok(bytes.length > 3000 && strings.some((x) => x.startsWith('HARDWARE')) && strings.some((x) => x.startsWith('Side Hinges')) && strings.some((x) => x.startsWith('Top Hung Hinges')) && strings.some((x) => x.startsWith('Espag Lock Kit')) && strings.includes('Child restrictor') && strings.includes('Wedge packers'),
      'PDF built in node: the hardware table lists the hinge, lock, restrictor and wedge lines', strings.filter((x) => /Hinges|Lock|restrictor|Wedge/.test(x)).join(' | '));
    ok(marked.length === 5 && marked.filter((x) => x.startsWith('Casement handle')).length === 2 && marked.filter((x) => x.startsWith('Trickle vents')).length === 2 && marked.filter((x) => x.startsWith('Fixing foam')).length === 1,
      '"unassigned" is printed 5 times — handle and vent in both tables, the one unassigned consumable — never after a hinge / lock / restrictor / wedge line', marked.join(' | '));
  } catch (e) { ok(false, 'window BOM PDF built in node', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
section('6 — the pages count nothing themselves');
{
  const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');
  const win = src('pages/WindowDetailPage.jsx');
  const own = ['buildWindowPartQtys', 'resolvePartTotal', 'effectiveAssignment', 'buildWindowHardware', 'buildHardwareList', 'mergeWindowMaterials'].filter((f) => new RegExp(`\\b${f}\\s*\\(`).test(win));
  ok(own.length === 0, 'the window BOM tab calls none of the counting functions itself', own.join(', '));
  ok(/\bwindowBomCards\(\s*buildWindowMaterialLines\(/.test(win) && /hardware:\s*windowHardwareDetailRows\(/.test(win), 'it draws its cards from windowBomCards(buildWindowMaterialLines(…)) and its PDF table from windowHardwareDetailRows');
  ok(!/assigned:\s*!!product/.test(win), 'the page no longer marks hardware lines "unassigned" on its own');
  for (const p of ['pages/ProjectDetailPage.jsx', 'pages/ProductionPackPage.jsx']) {
    const s = src(p);
    ok(/\bmergeWindowMaterials\(/.test(s) && !/\b(buildWindowPartQtys|resolvePartTotal|buildWindowMaterialLines)\s*\(/.test(s), `${p.split('/')[1]}: the purchase list is mergeWindowMaterials, nothing counted beside it`);
  }
  const b = src('engine/bom.js');
  ok((b.match(/=\s*buildWindowPartQtys\(/g) || []).length === 1 && (b.match(/\bALL_PARTS\.forEach\(/g) || []).length === 1 && (b.match(/\bbuildWindowHardware\([^)]*\)\s*\.(forEach|map)\(/g) || []).length === 2,
    'bom.js walks the Assign Materials rows in ONE place (and the hardware lines once for the list, once for the PDF detail table)');
}

console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAIL`}`);
process.exit(fails === 0 ? 0 : 1);
