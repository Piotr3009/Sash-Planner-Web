/**
 * t32 — bSuite worklist (.ewlist) export for casement frames (12.09.2026).
 *
 * What it guards:
 *  1. rows per layout — program, quantity, LPX/LPY/LPZ from the cut list and the profile (68 × 93),
 *     mullion / transom rows from derived.casement.mullionRuns / transomRuns, joint positions
 *     (OPn_HX) measured from the configured end, LH_RH_CNTRL / SCRW_ON_OFF from the profile;
 *  2. an arched head is skipped with a reason, the rest of that window still goes;
 *  3. identical rows across windows collapse into Quantity = n;
 *  4. the XML has the SAME element and attribute layout as the Biesse UK sample
 *     (docs/handover/workshop/JOINERY_NETWORK_EVENT.ewlist) — only ExecutionParameters and the
 *     StopWorklistItem are absent on purpose (UsingDefaultOrigins="true");
 *  5. the ZIP round-trips: three entries in the sample's order, CRC32 verified, version "5",
 *     worklist.wld in CRLF without an <?xml?> header;
 *  6. the ProgramUri is an absolute file:/// path with forward slashes and escaped '&'.
 * Independent expectations are computed here from the profile and the runs — never read back
 * from the export.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
mkdirSync(AUDIT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { if (ok) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}${d ? `  — ${d}` : ''}`); } };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const bundle = (rel, out) => { execFileSync('npx', ['esbuild@0.25.0', '--bundle', resolve(ROOT, rel), '--format=esm', `--outfile=${resolve(AUDIT, out)}`], { stdio: 'pipe' }); return resolve(AUDIT, out); };
const S = await import(bundle('src/engine/specification.js', 't32_spec.mjs'));
const C = await import(bundle('src/engine/calculations.js', 't32_calc.mjs'));
const P = await import(bundle('src/engine/profile.js', 't32_prof.mjs'));
const X = await import(bundle('src/utils/bsuiteExport.js', 't32_bs.mjs'));

const prof = P.getCasementProfile();
const B = prof.bsuite;
const TGT = P.bsuiteActiveTarget(B);
const FN = (k) => TGT.programs[k].path.split('/').pop();
const mk = (name, code, w = 1800, h = 1500, extra = {}) => {
  const it = { name, width: w, height: h, windowCategory: 'casement', casementLayout: code, glassType: 'double', frameType: 'standard', ...extra };
  const windowSpec = S.normaliseToWindowSpec({ ...it, fullConfig: it });
  return { name, windowSpec, derived: C.deriveWindowData(windowSpec) };
};
const progOf = (r) => r.program;

console.log('== 1 — rows per layout ==');
{
  const w = mk('W', '040L');
  const { rows, skipped } = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', prof);
  const box = Object.fromEntries(w.derived.components.box.map((p) => [p.elementName, p.length]));
  check('040L: 4 rows — head, cill, jamb L, jamb R — in that order', rows.map(progOf).join(',') === [FN('head'), FN('cill'), FN('jambL'), FN('jambR')].join(','), rows.map(progOf).join(','));
  check('040L: LPX = the cut-list lengths (head 1800, jambs 1500)', near(rows[0].vars.LPX, box['C-FRAME HEAD']) && near(rows[2].vars.LPX, box['C-FRAME JAMB (L)']) && rows[0].vars.LPX === 1800 && rows[2].vars.LPX === 1500);
  check('040L: every row is a 68 × 93 board (profile face × depth)', rows.every((r) => r.vars.LPY === prof.elements.frameHead.face && r.vars.LPZ === prof.frameDepth && r.vars.LPY === 68 && r.vars.LPZ === 93));
  check('040L: panel node 1001 / P1001, HORN 0 as the only document variable, nothing skipped', rows.every((r) => r.panelId === 1001 && r.panelName === 'P1001' && Object.keys(r.docVars).join() === 'HORN' && r.docVars.HORN === 0) && skipped.length === 0);
}
{
  const w = mk('W', '120');
  const { rows } = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', prof);
  const m = rows[4];
  check('120: 5 rows, the mullion row is a V2 MASTER (no panel node), window 1800 × 1500 in the document variables', rows.length === 5 && m.program === FN('mullion') && m.noPanel === true && m.docVars.WINDOW_WIDTH === 1800 && m.docVars.WINDOW_HEIGHT === 1500);
  check('120: no transom → OPN_1_H = master.noJointValue, hands from the left / right lights (left-hung 1, right-hung 4)', m.docVars.OPN_1_H === B.master.noJointValue && m.docVars.OPN_1_HAND === B.master.handCodes.left && m.docVars.OPN_2_HAND === B.master.handCodes.right);
  check('120: FRM_SZE 68 / HEAD_WDTH 80 / HORN 0 / TRKL_VNT 1 (habitable, sole window → grilles)', m.docVars.FRM_SZE === 68 && m.docVars.HEAD_WDTH === 80 && m.docVars.HORN === 0 && m.docVars.TRKL_VNT === 1);
  check('frame rows carry HORN 0 for the V2 head / cill (LPX − HORN) and keep the panel node', rows.slice(0, 4).every((r) => r.docVars.HORN === 0 && !r.noPanel && r.vars.LPX > 0));
}
{
  const w = mk('W', '052L');
  const { rows } = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', prof);
  const t = w.derived.casement.transomRuns[0];
  const mull = rows.find((r) => r.program === FN('mullion')), tr = rows.find((r) => r.program === FN('transom'));
  // independent: the transom axis is frame-absolute from the outer bottom (mullionRuns yTop = land, yBottom = H − cillVisible)
  const expOpn = B.master.opn1From === 'top' ? 1500 - t.axisT : t.axisT;
  check(`052L: mullion OPN_1_H = transom axis from the ${B.master.opn1From} = ${expOpn.toFixed(1)}`, mull && near(mull.docVars.OPN_1_H, Math.round(expOpn * 10) / 10, 0.05), JSON.stringify(mull?.docVars));
  check('052L: transom OPN_1_H is the same height; OPN_2_HAND = top-hung fanlight code, OPN_1_HAND = the light below', tr && near(tr.docVars.OPN_1_H, mull.docVars.OPN_1_H, 1e-6) && tr.docVars.OPN_2_HAND === B.master.handCodes.top);
  check('052L: master rows have no LPX in the panel (the program computes its board) but still carry the engine length for the operator note', mull.noPanel && tr.noPanel && mull.vars.LPX === 1423 && near(tr.vars.LPX, Math.round(t.length * 10) / 10));
}
{
  const w = mk('W', '142');
  const { rows, skipped } = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', prof);
  const mulls = rows.filter((r) => r.program === FN('mullion')), trs = rows.filter((r) => r.program === FN('transom'));
  check('142: 3 mullions + 2 transom runs = 9 rows, every master row with the same window and the fanlight height', rows.length === 9 && mulls.length === 3 && trs.length === 2 && [...mulls, ...trs].every((r) => r.docVars.WINDOW_WIDTH === 1800 && r.docVars.OPN_1_H === mulls[0].docVars.OPN_1_H) && skipped.length === 0);
}
{
  // opn1From flips the joint height; master fields are profile-driven
  const w = mk('W', '052L');
  const alt = { ...prof, bsuite: { ...B, master: { ...B.master, opn1From: B.master.opn1From === 'top' ? 'bottom' : 'top', headWidth: 90 } } };
  const a = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', prof).rows.find((r) => r.program === FN('mullion'));
  const b = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', alt).rows.find((r) => r.program === FN('mullion'));
  check('master.opn1From: bottom + top heights add up to the frame height 1500; HEAD_WDTH follows the profile', near(a.docVars.OPN_1_H + b.docVars.OPN_1_H, 1500, 0.15) && b.docVars.HEAD_WDTH === 90);
  const v1 = { ...prof, bsuite: { ...B, targets: [{ ...TGT, programs: { ...TGT.programs, mullion: { ...TGT.programs.mullion, mode: 'macro' }, transom: { ...TGT.programs.transom, mode: 'macro' } } }] } };
  const c = X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', v1, v1.bsuite.targets[0]).rows.find((r) => r.program === FN('mullion'));
  check('mode macro (V1 programs) still writes LPX + OP1_HX / LH_RH_CNTRL / SCRW_ON_OFF with a panel node', !c.noPanel && 'OP1_HX' in c.docVars && c.docVars.SCRW_ON_OFF === B.screws && !('WINDOW_WIDTH' in c.docVars));
}

console.log('== 2 — arched head skipped, sash refused ==');
{
  const g = mk('G', '040L', 1000, 1900, { casementType: 'arched', archShape: 'gothic-equilateral', archHinge: 'left' });
  const { rows, skipped } = X.buildBsuiteFrameRows(g.windowSpec, g.derived, 'G', prof);
  check('gothic: head skipped with a reason, cill + jambs still exported (3 rows)', rows.length === 3 && !rows.some((r) => r.program === FN('head')) && skipped.length === 1 && /arched head/.test(skipped[0].reason));
  check('gothic: jambs are the straight part only (start line, not the full height)', rows.filter((r) => /JAMB/.test(r.program)).every((r) => r.vars.LPX < 1900));
  const it = { name: 'S', width: 1000, height: 1800, windowCategory: 'sash', sashType: 'double', glassType: 'double', frameType: 'standard', hornType: 'A' };
  const ss = S.normaliseToWindowSpec({ ...it, fullConfig: it });
  const r2 = X.buildBsuiteFrameRows(ss, C.deriveWindowData(ss), 'S', prof);
  check('sash: no rows, one skip explaining there are no frame programs', r2.rows.length === 0 && r2.skipped.length === 1);
}

console.log('== 3 — grouping ==');
{
  const a = mk('A', '040L'), b = mk('B', '040L'), c = mk('C', '040L', 1200, 1500);
  const all = [...X.buildBsuiteFrameRows(a.windowSpec, a.derived, 'A', prof).rows, ...X.buildBsuiteFrameRows(b.windowSpec, b.derived, 'B', prof).rows, ...X.buildBsuiteFrameRows(c.windowSpec, c.derived, 'C', prof).rows];
  const g = X.groupBsuiteRows(all);
  check('two identical 1800 windows + one 1200: heads 1800 collapse to Quantity 2, the 1200 head stays its own row', g.filter((r) => r.program === FN('head')).map((r) => `${r.vars.LPX}x${r.quantity}`).sort().join(',') === '1200x1,1800x2');
  check('grouped rows carry the joined labels', g.find((r) => r.program === FN('head') && r.quantity === 2).label === 'A - HEAD +1');
  check('jambs 1500 of all three collapse to Quantity 3', g.find((r) => r.program === FN('jambL')).quantity === 3);
}

console.log('== 4 — XML shape vs the Biesse sample ==');
const refZip = readFileSync(resolve(ROOT, 'docs', 'handover', 'workshop', 'JOINERY_NETWORK_EVENT.ewlist'));
function unzip(buf) {
  // minimal reader: walk local headers (both stored and deflated), return { name: Buffer }
  const out = {}; let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034B50) {
    const method = buf.readUInt16LE(p + 8), crc = buf.readUInt32LE(p + 14), csize = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    const data = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    out[name] = { method, crc, data: method === 8 ? inflateRawSync(data) : Buffer.from(data) };
    p += 30 + nlen + xlen + csize;
  }
  return out;
}
const refEntries = unzip(refZip);
const refXml = refEntries['worklist.wld'].data.toString('utf8');
const shape = (xml) => {
  const tags = {};
  for (const m of xml.matchAll(/<([A-Za-z]+)((?:\s+[A-Za-z]+="[^"]*")*)\s*\/?>/g)) {
    const attrs = [...m[2].matchAll(/([A-Za-z]+)="/g)].map((a) => a[1]).sort().join(',');
    (tags[m[1]] ||= new Set()).add(attrs);
  }
  return tags;
};
{
  const w1 = mk('W1', '052L'), w2 = mk('W2', '040L');
  const rows = X.groupBsuiteRows([...X.buildBsuiteFrameRows(w1.windowSpec, w1.derived, 'W1', prof).rows, ...X.buildBsuiteFrameRows(w2.windowSpec, w2.derived, 'W2', prof).rows]);
  const ids = rows.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const xml = X.writeWorklistXml(rows, { now: new Date(2026, 8, 12, 12, 0, 0), ids });
  const mine = shape(xml), ref = shape(refXml);
  const allowedMissing = new Set(['ExecutionParameters', 'ExecutionParameter', 'StopWorklistItem']);   // off by default (profile.bsuite.writeExecutionParameters)
  const missing = Object.keys(ref).filter((t) => !(t in mine) && !allowedMissing.has(t));
  const extra = Object.keys(mine).filter((t) => !(t in ref));
  const attrDiff = Object.keys(mine).filter((t) => t in ref && ![...mine[t]].every((a) => ref[t].has(a)));
  check('every element we write exists in the sample with the same attribute set (ExecutionParameters / Stop omitted on purpose)', missing.length === 0 && extra.length === 0 && attrDiff.length === 0, `missing ${missing} extra ${extra} attrs ${attrDiff}`);
  check('root <Worklist Description="" Version="4"> and trailing <Variables />, no <?xml?> header, CRLF', xml.startsWith('<Worklist Description="" Version="4">\r\n') && xml.endsWith('  <Variables />\r\n</Worklist>') && !xml.includes('<?xml'));
  check('one CadProgramWorklistItem per row with Quantity, UsingDefaultOrigins="true" and a GUID Id', (xml.match(/<CadProgramWorklistItem /g) || []).length === rows.length && rows.every((r, i) => xml.includes(`Id="${ids[i]}" Name="${r.program}" Counter="0" Label="${r.label}" Quantity="${r.quantity}"`)) && xml.includes('UsingDefaultOrigins="true"'));
  check('ProgramUri = the target\'s full path as file:///C:/… with forward slashes', xml.includes(`ProgramUri="file:///${TGT.programs.head.path}"`) && /file:\/\/\/C:\/Users\/Xp600\/Desktop\/TEMPLATES_02\.09\.26\/UPDATED_09\.09\.26\/HEAD_MASTER_V2\.bSolid/.test(xml));
  check('panel node <ProgramPanelNode Id="1001" Name="P1001"> with LPX/LPY/LPZ as Double, mm', /<ProgramPanelNode Id="1001" Name="P1001">\r\n            <Variables>\r\n              <ParametricVariable TypeCode="Double" VariableName="LPX" Expression="1800" ExpressionValue="1800" MeasureUnit="mm" \/>/.test(xml));
  check('V2 master rows: document variables WINDOW_WIDTH / WINDOW_HEIGHT / OPN_1_H / hands / TRKL_VNT and NO ProgramPanelNode', /VariableName="OPN_1_H" Expression="511\.2"/.test(xml) && (xml.match(/VariableName="WINDOW_WIDTH" Expression="1800"/g) || []).length === 2 && (xml.match(/<ProgramPanelNode /g) || []).length === rows.filter((r) => !r.noPanel).length && rows.filter((r) => r.noPanel).length === 2);
  check('frame rows: HORN as a document variable next to the panel node', (xml.match(/VariableName="HORN" Expression="0"/g) || []).length === rows.length);
  check('LastAccess in the sample\'s MM/DD/YYYY HH:MM:SS form', xml.includes('LastAccess="09/12/2026 12:00:00"'));
  check('a quoted Windows path (Explorer "Copy as path") is cleaned: quotes off, backslashes → /, spaces kept', X.programUri('"C:\\Users\\Konrad Puc\\OneDrive\\Desktop\\Biesse Master Stick\\FC_68mm\\HEAD_MASTER_V2.bSolid"') === 'file:///C:/Users/Konrad Puc/OneDrive/Desktop/Biesse Master Stick/FC_68mm/HEAD_MASTER_V2.bSolid' && X.fileNameOf('"C:\\x\\HEAD_MASTER_V2.bSolid"') === 'HEAD_MASTER_V2.bSolid' && X.programUri('C:/Users/K/Biesse Master Stick"/FC_68mm/HEAD.bSolid') === 'file:///C:/Users/K/Biesse Master Stick/FC_68mm/HEAD.bSolid');
  check("a path with '&' is escaped as &amp; (the sample has P&R)", X.writeWorklistXml([{ ...rows[0], path: 'C:/MASTER/P&R/X.bSolid', program: 'X.bSolid' }], { ids: [ids[0]] }).includes('ProgramUri="file:///C:/MASTER/P&amp;R/X.bSolid"'));
  writeFileSync(resolve(ROOT, 'docs', 'handover', 'samples', 'sample_frames_052L_040L.ewlist'), X.buildEwlist(rows, { now: new Date(2026, 8, 12, 12, 0, 0), ids }));
}

console.log('== 5 — ZIP round-trip ==');
{
  const w = mk('W', '133');
  const rows = X.groupBsuiteRows(X.buildBsuiteFrameRows(w.windowSpec, w.derived, 'W', prof).rows);
  const now = new Date(2026, 8, 12, 12, 0, 0);
  const bytes = X.buildEwlist(rows, { now, ids: rows.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) });
  const z = unzip(Buffer.from(bytes));
  check('three entries in the sample\'s order: worklist.wld, Programs/, version', Object.keys(z).join(',') === 'worklist.wld,Programs/,version' && Object.keys(refEntries).join(',') === Object.keys(z).join(','));
  check('version = "5"', z['version'].data.toString() === '5');
  // 12.09 (bSolid refused the first, STORED build): entries are DEFLATE like the sample, folder stored, attrs 0
  const refM = Object.fromEntries(Object.entries(refEntries).map(([k, v]) => [k, v.method]));
  const mineM = Object.fromEntries(Object.entries(z).map(([k, v]) => [k, v.method]));
  check('compression methods match the Biesse sample entry by entry (worklist 8, Programs/ 0, version 8)', JSON.stringify(mineM) === JSON.stringify(refM) && mineM['worklist.wld'] === 8, JSON.stringify(mineM));
  {
    const b = Buffer.from(bytes); const eocd = b.readUInt32LE(b.length - 22) === 0x06054B50 ? b.length - 22 : -1;
    const cdOff = b.readUInt32LE(eocd + 16); let q = cdOff; const attrs = [];
    while (q < eocd && b.readUInt32LE(q) === 0x02014B50) { const nl = b.readUInt16LE(q + 28), xl = b.readUInt16LE(q + 30), cl = b.readUInt16LE(q + 32); attrs.push(b.readUInt32LE(q + 38)); q += 46 + nl + xl + cl; }
    check('central directory: external attributes 0 on every entry (sample), general flags 0', attrs.length === 3 && attrs.every((a) => a === 0));
  }
  {
    const withEx = X.buildEwlist(rows, { now, ids: rows.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`), executionParameters: TGT.executionParameters });
    const xml2 = unzip(Buffer.from(withEx))['worklist.wld'].data.toString('utf8');
    check('ExecutionParameters block per panel with the ten variables (ExOrigin … ExMirrorY), values from the target', (xml2.match(/<ExecutionParameters>/g) || []).length === rows.filter((r) => !r.noPanel).length && /VariableName="ExOrigin" Expression="0"/.test(xml2) && /VariableName="ExOffsetY" Expression="0"/.test(xml2) && /VariableName="ExMirrorY" Expression="false" ExpressionValue="False"/.test(xml2));
    check('without the option no ExecutionParameters is written (UsingDefaultOrigins only)', !z['worklist.wld'].data.toString('utf8').includes('ExecutionParameters'));
  }
  check('worklist.wld CRC32 matches its content', z['worklist.wld'].crc === X.crc32(z['worklist.wld'].data));
  check('the extracted XML equals writeWorklistXml for the same rows', z['worklist.wld'].data.toString('utf8') === X.writeWorklistXml(rows, { now, ids: rows.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) }));
  check('central directory present (EOCD signature at the end)', Buffer.from(bytes).readUInt32LE(bytes.length - 22) === 0x06054B50);
  check('deterministic: same rows + same clock → identical bytes', Buffer.compare(Buffer.from(bytes), Buffer.from(X.buildEwlist(rows, { now, ids: rows.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`) }))) === 0);
}

console.log('== 6 — profile ==');
check('profile.bsuite: active target machine with six V2 program paths, 68 × 93 comes from the profile not the export', Object.keys(TGT.programs).sort().join(',') === 'cill,head,jambL,jambR,mullion,transom' && TGT.id === 'machine' && TGT.programs.head.path.endsWith('/UPDATED_09.09.26/HEAD_MASTER_V2.bSolid') && TGT.programs.mullion.mode === 'master' && TGT.programs.transom.mode === 'master');
check('profile.bsuite.master defaults: opn1From bottom, hand codes left 1 / right 4 / top 2, headWidth 80, trickle on', B.master.opn1From === 'bottom' && B.master.handCodes.left === 1 && B.master.handCodes.right === 4 && B.master.handCodes.top === 2 && B.master.headWidth === 80 && B.master.writeTrickleVent === true);
check('profile.bsuite defaults: screws 1, opOriginEnd start, seatSplitStart 0.5, macroVarsInList true, sideValue left 0 / right 1, target placement ON with Matt\'s zeros', B.screws === 1 && B.opOriginEnd === 'start' && B.seatSplitStart === 0.5 && B.macroVarsInList === true && B.sideValue.left === 0 && B.sideValue.right === 1 && TGT.writeExecutionParameters === true && TGT.executionParameters.origin === 0 && TGT.executionParameters.offsetY === 0);   // 14.09: placement per target, Matt's zeros
{
  const m = P.migrateCasementProfile({ ...prof, bsuite: { programsFolder: 'D:/X', programs: { head: { file: 'H68.bSolid' } }, writeExecutionParameters: false } });
  check('migration: a 12.09 copy (folder + file names) becomes ONE target with full paths, the rest filled from the defaults', m.bsuite.targets.length === 1 && m.bsuite.targets[0].programs.head.path === 'D:/X/H68.bSolid' && m.bsuite.targets[0].programs.head.panelId === 1001 && m.bsuite.targets[0].programs.cill.path.endsWith('CILL_MASTER_V2.bSolid') && m.bsuite.targets[0].writeExecutionParameters === false && m.bsuite.activeTarget === m.bsuite.targets[0].id && m.bsuite.screws === 1 && !('programsFolder' in m.bsuite));
  const m2 = P.migrateCasementProfile({ ...prof, bsuite: { ...B, targets: [...B.targets, { id: 'office', name: 'Office', programs: { head: { path: 'C:/bSolid/HEAD.bSolid' } } }], activeTarget: 'office' } });
  check('migration: stored targets kept, a partial target filled per element, activeTarget honoured', m2.bsuite.targets.length === 2 && m2.bsuite.activeTarget === 'office' && m2.bsuite.targets[1].programs.head.path === 'C:/bSolid/HEAD.bSolid' && m2.bsuite.targets[1].programs.transom.mode === 'master' && m2.bsuite.targets[1].executionParameters.origin === 0);
  const wO = mk('W', '040L');
  const rowsO = X.buildBsuiteFrameRows(wO.windowSpec, wO.derived, 'W', m2, m2.bsuite.targets[1]).rows;
  check('rows built for a chosen target use ITS paths (Name = file name, ProgramUri = its path)', rowsO[0].program === 'HEAD.bSolid' && rowsO[0].path === 'C:/bSolid/HEAD.bSolid' && rowsO[1].path.endsWith('CILL_MASTER_V2.bSolid'));
}

console.log('== 7 — buttons: single window first, then the pack (Piotr) ==');
{
  const wdp = readFileSync(resolve(ROOT, 'src', 'pages', 'WindowDetailPage.jsx'), 'utf8');
  const ppp = readFileSync(resolve(ROOT, 'src', 'pages', 'ProductionPackPage.jsx'), 'utf8');
  check('WindowDetailPage: bSuite frames button for a casement window, via exportBsuiteFramesMerged([one window])', /bSuite frames/.test(wdp) && /exportBsuiteFramesMerged\(\[\{ windowSpec, derived/.test(wdp));
  check('ProductionPackPage: bSuite frames button for a casement pack, all windows of the pack', /bSuite frames/.test(ppp) && /exportBsuiteFramesMerged\(/.test(ppp));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log('ALL PASS');
process.exit(fail ? 1 : 0);
