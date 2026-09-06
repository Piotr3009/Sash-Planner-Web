/**
 * t24 — ARCHED-WINDOWS-v3 Stage 4 harness: Block 6 (project ARCHIVE) + Block 4
 * (cross-cutting): store round-trip archive → hidden → restore → visible, the
 * SQL migration file, cloud writes; curved-member blanks in the pre-cut, the
 * BOM blank raw kind, the PP curved-members section, the pricing surcharge,
 * merged exports for sash batches, the regenerated parity report.
 *
 * Run: node verify/arch/t24_stage4.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, AUDIT, bundleTree } from './lib/sheets.mjs';
import { independentPlan } from './lib/indPlanner.mjs';

mkdirSync(AUDIT, { recursive: true });
let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n== ${t} ==`);
const src = (p) => readFileSync(resolve(ROOT, 'src', p), 'utf8');

// store bundle: Supabase unconfigured → cloudSync is a no-op (the in-memory store is the truth)
const storeEntry = resolve(AUDIT, 't24-store-entry.mjs');
writeFileSync(storeEntry, `export * from '${pathToFileURL(resolve(ROOT, 'src/stores/projectStore.js')).href.replace('file://', '')}';\nexport * as cloud from '${resolve(ROOT, 'src/services/cloudSync.js')}';`);
const storeOut = resolve(AUDIT, 't24-store.mjs');
execFileSync('npx', ['-y', 'esbuild@0.25.0', storeEntry, '--bundle', '--format=esm', '--platform=node',
  '--define:import.meta.env.VITE_SUPABASE_URL=undefined', '--define:import.meta.env.VITE_SUPABASE_ANON_KEY=undefined',
  `--outfile=${storeOut}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const ST = await import(pathToFileURL(storeOut).href + `?t=${Date.now()}`);
const store = ST.useProjectStore;

const M = await bundleTree(resolve(ROOT, 'src'), 't24', [
  ['bom', 'engine/bom.js'],
  ['pricing', 'engine/pricing.js'],
]);
const { specification, calculations, lists, bom, pricing, profile } = M;
const cas = (id, width, height, fc, item = {}) => specification.normaliseToWindowSpec({ id, name: id, width, height, ...item }, { fullConfig: { windowCategory: 'casement', casementLayout: '040L', ...fc } });
const derive = (spec) => calculations.deriveWindowData(spec, {});

// ═══════════════════════════════════════════════════════════════════════════
section('1 — Block 6: store round-trip archive → hidden from active → restore → visible');
{
  const S = store.getState();
  const p1 = S.createProject('Alpha', '1 High St', 'PRJ-1', null, 'Client A');
  const p2 = S.createProject('Beta', '2 Low St', 'PRJ-2', null, 'Client B');
  const b1 = S.createBatch(p1.id, 'casement');
  check('two live projects, no archive', store.getState().projects.length === 2 && store.getState().archivedProjects.length === 0 && !!b1);
  const before = new Date().toISOString();
  const archived = S.archiveProject(p1.id);
  const st1 = store.getState();
  check('archiveProject: Alpha leaves projects, lands in archivedProjects with archived true + archived_at (ISO, now), batches kept', st1.projects.length === 1 && st1.projects[0].id === p2.id && st1.archivedProjects.length === 1 && st1.archivedProjects[0].id === p1.id && archived.archived === true && typeof archived.archived_at === 'string' && archived.archived_at >= before && archived.batches.length === 1);
  check('getProjectById finds the archived project (read-only page); the live one too', st1.getProjectById(p1.id)?.archived === true && st1.getProjectById(p2.id)?.archived !== true && st1.getProjectById('nope') === null);
  check('archiving twice / an unknown id is a no-op (null)', S.archiveProject(p1.id) === null && S.archiveProject('nope') === null && store.getState().archivedProjects.length === 1);
  const restored = S.restoreProject(p1.id);
  const st2 = store.getState();
  const sortedByCreated = (list) => list.every((p, i) => i === 0 || String(list[i - 1].created_at) <= String(p.created_at));
  check('restoreProject: back in projects (created_at order kept), archived false, archived_at null, archive empty', st2.projects.length === 2 && st2.projects.some((p) => p.id === p1.id) && sortedByCreated(st2.projects) && restored.archived === false && restored.archived_at === null && st2.archivedProjects.length === 0);
  check('currentProject follows the archive state when it is the same project', (() => { S.setCurrentProject(store.getState().projects.find((p) => p.id === p1.id)); S.archiveProject(p1.id); const a = store.getState().currentProject?.archived === true; S.restoreProject(p1.id); return a && store.getState().currentProject?.archived === false; })());
  check('deleteProject still removes a live project; clearAll resets the archive lists', (() => { S.deleteProject(p2.id); const one = store.getState().projects.length === 1; S.archiveProject(p1.id); S.clearAll(); const st = store.getState(); return one && st.projects.length === 0 && st.archivedProjects.length === 0 && st.archivedLoaded === false; })());
  await S.loadArchivedProjects();
  check('loadArchivedProjects offline: archivedLoaded true, list untouched (cloud disabled)', store.getState().archivedLoaded === true && store.getState().archivedProjects.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section('2 — Block 6: SQL migration file, cloud writes, pages');
{
  const sqlPath = resolve(ROOT, 'docs', 'handover', 'sql', '2026-09-07_projects_archive.sql');
  const sql = existsSync(sqlPath) ? readFileSync(sqlPath, 'utf8') : '';
  check('docs/handover/sql/2026-09-07_projects_archive.sql: archived boolean + archived_at timestamptz (if not exists), index, no RLS change, no app code', sql.includes('add column if not exists archived boolean not null default false') && sql.includes('add column if not exists archived_at timestamptz null') && sql.includes('create index if not exists projects_tenant_archived_idx') && !/policy/i.test(sql));
  const cs = src('services/cloudSync.js');
  check('cloudSync: saveProject writes archived + archived_at; loadAll still excludes archived; loadArchivedProjects pulls archived = true with batches + windows', cs.includes("archived: !!p.archived, archived_at: p.archived ? (p.archived_at || new Date().toISOString()) : null,") && cs.includes(".eq('archived', false).order('created_at'") && cs.includes("export async function loadArchivedProjects()") && cs.includes(".eq('archived', true).order('archived_at'"));
  const ap = src('pages/ArchivePage.jsx');
  check('ArchivePage: table Project · Client · Batches · Windows · Archived on · Restore, search box, restoreProject', ['Project', 'Client', 'Batches', 'Windows', 'Archived on', 'Restore'].every((h) => ap.includes(`>${h}</th>`)) && ap.includes('placeholder="Search archive…"') && ap.includes('onClick={() => restoreProject(r.id)}') && ap.includes('loadArchivedProjects();'));
  const dp = src('pages/DashboardPage.jsx');
  check('Dashboard: Archive button on the project card — straight away when every batch pack is complete, confirm otherwise', dp.includes('const handleArchiveProject = (e, project) => {') && dp.includes("if (open === 0) { archiveProject(project.id); return; }") && dp.includes("confirmLabel: 'Archive'") && dp.includes('title="Archive project (leaves the dashboard, stays readable in the Archive)"'));
  const pd = src('pages/ProjectDetailPage.jsx');
  check('ProjectDetailPage: opens archived projects, read-only banner with Restore, no Add Batch / delete batch while archived', pd.includes("st.archivedProjects.find((p) => p.id === projectId)") && pd.includes('const isArchived = !!currentProject?.archived') && pd.includes('Restore to dashboard') && pd.includes("{!isArchived && <button onClick={() => setShowAddBatch(true)}") && pd.includes('{!isArchived && <button onClick={() => handleDeleteBatch(batch.id)}'));
}

// ═══════════════════════════════════════════════════════════════════════════
section('3 — Block 4: curved members → blank pieces in the pre-cut, BOM blank raw kind, PP section');
{
  const spec = cas('AC', 1200, 2000, { casementType: 'arched', archShape: 'semi-circle', archStart: 1400 });
  const d = derive(spec);
  const rows = lists.buildCurvedMembersForWindow(d, spec);
  check('arched casement 1200: two curved members (C-ARCH HEAD, C-ARCH TOP RAIL) with radii, pieces, arcs (n × stock × rough), finger 15/16/3.8', rows.length === 2 && rows[0].elementName === 'C-ARCH HEAD' && rows[0].radii[0] === 600 && rows[0].pieces === d.arch.plans.frameHead.totalPieces && rows[0].arcs[0].stock === d.arch.plans.frameHead.arcs[0].default.stock && rows[0].finger.length === 15 && rows[1].elementName === 'C-ARCH TOP RAIL' && rows[1].depth === 57 && rows[0].depth === 93);
  const resolveRaw = bom.makeRawResolver({ assignments: {}, assignmentsData: {}, materials: [] });
  check('makeRawResolver blank kind → stock × depth (whatever the assignment)', resolveRaw('C-ARCH HEAD', { kind: 'blank', stock: 95, depth: 93 }) === '95x93' && resolveRaw('C-ARCH HEAD') === null);
  const pre = lists.buildPrecutForWindow(d, spec, {}, resolveRaw);
  const items = pre.sashEngineering.flatMap((g) => g.items);
  const headBlanks = items.filter((it) => it.elementName === 'C-ARCH HEAD');
  const plan = d.arch.plans.frameHead;
  // 06.09 (Piotr): one pre-cut row PER PIECE (S1…Sn) — end pieces are shorter than middle pieces
  check('pre-cut: C-ARCH HEAD is pre-cut as blank pieces — one row per piece (qty = record qty, length = that piece\'s rough, section = stock × 93, finishedLength = its outer stock edge), not as the arc length',
    headBlanks.length === plan.pieces.length && headBlanks.every((it, i) => it.blank === true && it.quantity === 1 && it.length === Math.round(plan.pieces[i].roughLength) && it.section === `${plan.pieces[i].stock}x93` && it.finishedLength === Math.round(plan.pieces[i].outerEdge) && /^S\d+$/.test(it.piece))
    && !items.some((it) => it.elementName === 'C-ARCH HEAD' && !it.blank), `${headBlanks.length} rows vs ${plan.pieces.length} pieces`);
  check('pre-cut: the jambs / cill / stiles are untouched (straight pieces + 20 machining)', items.some((it) => it.elementName === 'C-FRAME JAMB (L)' && it.length === Math.round(d.components.box.find((c) => c.elementName === 'C-FRAME JAMB (L)').length + 20)) && items.filter((it) => !it.blank).every((it) => it.section && it.length > 0));
  const qty = bom.buildWindowPartQtys(d, spec, {}, resolveRaw);
  const headMm = plan.pieces.reduce((s, pc) => s + Math.round(pc.roughLength), 0);   // 06.09: Σ per piece (end pieces shorter)
  check('BOM part quantities: c_frame_head mm = Σ pieces × rough length of the blank (board metres, not the arc)', qty.c_frame_head && near(qty.c_frame_head.mm, headMm, 0.5), JSON.stringify(qty.c_frame_head));
  // v4 Block C: the 1000 semi-circle sash box head is blocked by the 400 limit (t21 / t25) — the pre-cut blanks are checked on a 1200 sash
  const sashSpec = specification.normaliseToWindowSpec({ id: 'AS', name: 'AS', width: 1200, height: 2600 }, { fullConfig: { windowCategory: 'sash', sashType: 'arched-group', archShape: 'semi-circle' } });
  const ds = derive(sashSpec);
  const sashRows = lists.buildCurvedMembersForWindow(ds, sashSpec);
  const sashPre = lists.buildPrecutForWindow(ds, sashSpec, {}, resolveRaw).sashEngineering.flatMap((g) => g.items);
  check('arched sash: S-ARCH HEAD (80 × box depth) + S-ARCH TOP RAIL rows, blanks in the pre-cut', sashRows.length === 2 && sashRows[0].elementName === 'S-ARCH HEAD' && sashRows[0].depth > 0 && sashPre.some((it) => it.elementName === 'S-ARCH HEAD' && it.blank) && sashPre.some((it) => it.elementName === 'S-ARCH TOP RAIL' && it.blank));
  const circle = cas('CI', 800, 800, { casementKind: 'fixed', archShape: 'circle' });
  const dc = derive(circle);
  const cRows = lists.buildCurvedMembersForWindow(dc, circle);
  const cPre = lists.buildPrecutForWindow(dc, circle, {}, resolveRaw).sashEngineering.flatMap((g) => g.items);
  // v4 Block F (frame 68): the expected piece counts / boards come from the independent planner (verify/arch/lib/indPlanner.mjs) on rings built
  // from the profile formulas — frame ring R / R − face, leaf ring (R − leafAtJamb) / (R − leafAtJamb − leafTop.face); a closed ring = two half circles
  const CP = profile.DEFAULT_CASEMENT_PROFILE;
  const R8 = 800 / 2, tF = CP.elements.frameHead.face, oL = CP.deductions.leafAtJamb, tL = CP.elements.leafTop.face;   // 400 / 68 / 51 / 67
  const halves = (r) => [{ cx: 0, cy: 0, r, a0: 0, a1: Math.PI, clip0: null, clip1: null }, { cx: 0, cy: 0, r, a0: Math.PI, a1: 2 * Math.PI, clip0: null, clip1: null }];
  const circleRing = (ro, ri) => ({ outer: halves(ro), inner: halves(ri) });
  const IND = { stock: CP.arch.stockWidths, allowance: CP.arch.contourAllowance, finger: CP.arch.finger.length, minClamp: CP.cnc.minClampLength, minPiece: CP.arch.minPieceLength, threshold: CP.arch.wasteThreshold };
  const iF = independentPlan(circleRing(R8, R8 - tF), IND)[0], iL = independentPlan(circleRing(R8 - oL, R8 - oL - tL), IND)[0];   // frame 400 / 332 → 4 × 200 (W_req > 180); leaf 349 / 282 → blocked (4 × 180: shorter 371.3)
  check(`circle 800 (v4): frame ring = ONE 360° group, ${iF.def?.n} pieces × ${iF.def?.stock} (independent planner) → ${iF.def?.n} pre-cut rows; the LEAF ring is blocked by the ${CP.arch.minPieceLength} limit (${iL.blocked?.n} × ${iL.blocked?.stock}: shorter edge ${iL.blocked?.pieces[0].shorter.toFixed(1)}) → noStock row, no blank rows (never split finer)`, !!iF.def && iL.reason === 'below minimum length' && cRows.length === 2 && cRows[0].elementName === 'C-FRAME RING' && cRows[0].arcs.length === 1 && cRows[0].arcs[0].spanDeg === 360 && cRows[0].arcs[0].n === iF.def.n && cRows[0].arcs[0].stock === iF.def.stock
    && cPre.filter((it) => it.elementName === 'C-FRAME RING').length === dc.arch.plans.frameHead.pieces.length && dc.arch.plans.frameHead.pieces.length === iF.def.n && cRows[1].noStock === true && cRows[1].shortPieces.length === 1 && cPre.filter((it) => it.elementName === 'C-LEAF RING' && it.blank).length === 0);
  const plain = cas('P', 600, 1200, {});
  check('rectangular casement: no curved rows, pre-cut unchanged (no blank items)', lists.buildCurvedMembersForWindow(derive(plain), plain).length === 0 && !lists.buildPrecutForWindow(derive(plain), plain, {}, resolveRaw).sashEngineering.flatMap((g) => g.items).some((it) => it.blank));
  const pp = src('pages/ProductionPackPage.jsx');
  check('ProductionPackPage: Curved members section in the cut list tab (per type), Arch DXF / Tracery merged exports also for sash batches', pp.includes('function CurvedMembersSection({ windowsData })') && pp.includes('<CurvedMembersSection windowsData={windowsData} />') && (pp.match(/\['casement', 'sash'\]\.includes\(pp\?\.type \|\| batch\?\.type \|\| 'sash'\)/g) || []).length === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section('4 — Block 4: pricing surcharge per curved member (default 0), parity report, port doc');
{
  const P = pricing.resolvePricing(null);
  check('DEFAULT_PRICING.archedCasement.curvedMemberSurcharge = 0', P.archedCasement.curvedMemberSurcharge === 0);
  const cfg = { casementType: 'arched', casArchShape: 'semi-circle', casementHBars: 0, casementVBars: 0, quantity: 1 };
  const base = pricing.calculateArchedCasement(P, cfg, 2, 1200, 2000);
  const P2 = pricing.resolvePricing({ archedCasement: { ...P.archedCasement, curvedMemberSurcharge: 40 } });
  const plus = pricing.calculateArchedCasement(P2, cfg, 2, 1200, 2000);
  check('surcharge 0 → neutral price, breakdown shows curvedMembers 2 / curvedPrice 0.00; surcharge 40 → +80 on the subtotal', base.breakdown.curvedMembers === 2 && base.breakdown.curvedPrice === '0.00' && near(Number(plus.breakdown.subtotal) - Number(base.breakdown.subtotal), 80, 1e-6));
  const rep = readFileSync(resolve(ROOT, 'docs', 'handover', 'PSW-PARITY-REPORT.md'), 'utf8');
  check('PSW-PARITY-REPORT.md regenerated: 0 HARD, hinge value 1:1 row, PSW_ARCH_RISE_RATIO row', /0 HARD differences/.test(rep) && rep.includes('PC keeps the hinge VALUE 1:1 (v3 0.4b)') && rep.includes('PC PSW_ARCH_RISE_RATIO'));
  const port = readFileSync(resolve(ROOT, 'docs', 'handover', 'PSW-3D-ARCH-PORT.md'), 'utf8');
  check('PSW-3D-ARCH-PORT.md: sash section (6) + fixed / circle / door section (7)', port.includes('## 6. Arched SASH') && port.includes('## 7. FIXED windows'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL PASS');
