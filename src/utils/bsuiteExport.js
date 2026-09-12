/**
 * bsuiteExport.js — Production Core → bSuite worklist (.ewlist) for the Rover A 1532.
 *
 * Frames only (12.09.2026): head, cill, jambs, mullions, transoms of a casement window go
 * out as ONE worklist per Production Pack. Each row = one of Matt's parametric programs +
 * quantity + the finished board size (LPX / LPY / LPZ); the mullion / transom rows also carry
 * the macro variables (OPn_HX joint positions, LH_RH_CNTRL, SCRW_ON_OFF) as document
 * variables. bSolid does the machining — this file never describes a toolpath.
 *
 * Format (docs: Petros warsztat/biesse → "PATENT: format LISTY ZADAŃ bSolid", from the Biesse UK
 * sample JOINERY_NETWORK_EVENT.ewlist):
 *   NAME.ewlist = ZIP with  worklist.wld  (XML, UTF-8, CRLF, no <?xml?> header)
 *                           Programs/     (empty folder)
 *                           version       ("5")
 *   <Worklist Description="" Version="4"><Items>
 *     <CadProgramWorklistItem Id=GUID Name="PROG.bSolid" Quantity=N Label=… ProgramUri="file:///…">
 *       <ExecutionTimeData …/><Origins/>
 *       <ProgramDocumentNode Id="document" Name="document">
 *         <Variables> document variables (String) </Variables>
 *         <Children><ProgramPanelNode Id="1001" Name="P1001"><Variables> LPX/LPY/LPZ (Double) …
 *   ExecutionParameters (machine origin / offsets) are NOT written: UsingDefaultOrigins="true".
 *   Whether bSolid accepts that is the first machine test (BLOCKERS).
 *
 * Rules:
 *  - numbers come from `derived` (cut list lengths, mullionRuns / transomRuns), never recomputed;
 *  - board section from the profile (frameHead.face × frameDepth = 68 × 93);
 *  - an arched head has no program → the row is SKIPPED with a warning, the rest still goes;
 *  - identical rows (same program, same variables) collapse into one row with Quantity = n;
 *  - the ZIP writer below is dependency-free (STORED entries + CRC32) so the browser bundle
 *    does not grow; readers (bSolid uses .NET ZipArchive) accept stored entries.
 */
import { getCasementProfile } from '../engine/profile.js';

const CRLF = '\r\n';
const r1 = (v) => Math.round(Number(v) * 10) / 10;
const fmt = (v) => String(r1(v)).replace(/\.0$/, '');

/* ─────────────────────────────── rows ─────────────────────────────── */

/** LH/RH value for a joint on a given side of the member (profile.bsuite.sideValue). */
function sideVal(B, side) { return side === 'left' ? B.sideValue.left : B.sideValue.right; }

/**
 * Joint positions along a member as the macro wants them: measured along the BOARD from the
 * configured end (`opOriginEnd`), rounded to 0.1. The board (cut-list length) is longer than
 * the visible run between `memberStart` and `memberEnd` — the mullion seats into head and
 * cill (extH − 77 vs land … H − cillVisible) — and that extra length is split between the two
 * ends by `seatSplitStart` (DEFAULT (open) 0.5 = equal; the machine test decides).
 */
function opPositions(B, memberStart, memberEnd, boardLength, jointAxes) {
  const run = memberEnd - memberStart;
  const extra = Math.max(0, boardLength - run);
  const split = Number.isFinite(B.seatSplitStart) ? B.seatSplitStart : 0.5;
  const startOff = extra * split, endOff = extra - startOff;
  return jointAxes
    .filter((a) => a > memberStart && a < memberEnd)
    .map((a) => (B.opOriginEnd === 'end' ? (memberEnd - a) + endOff : (a - memberStart) + startOff))
    .sort((a, b) => a - b)
    .map(r1);
}

/**
 * Build the frame rows of one casement window.
 * Returns { rows, skipped: [{ element, reason }] }.
 */
export function buildBsuiteFrameRows(windowSpec, derived, name, profile = getCasementProfile()) {
  const B = profile.bsuite;
  const P = B.programs;
  const face = profile.elements.frameHead.face;
  const depth = profile.frameDepth;
  const rows = [];
  const skipped = [];
  const winName = String(name || windowSpec?.name || '').trim() || 'W';
  if ((windowSpec?.category || 'sash') !== 'casement') {
    return { rows, skipped: [{ element: 'window', reason: 'not a casement — no frame programs for this window type' }] };
  }
  const box = derived?.components?.box || [];
  const byName = (re) => box.find((p) => re.test(p.elementName || ''));
  const arched = !!derived?.arch;

  const frameRow = (key, part, label) => {
    if (!part) { skipped.push({ element: label, reason: 'not in the cut list' }); return; }
    const prog = P[key];
    rows.push({
      program: prog.file, panelId: prog.panelId, panelName: prog.panelName,
      quantity: part.quantity || 1,
      label: `${winName} - ${label}`,
      vars: { LPX: r1(part.length), LPY: face, LPZ: depth },
      docVars: {},
      element: label, window: winName,
    });
  };

  // Head: an arched head is a laminated blank routed from the Arch DXF, not FC_HEAD
  const head = byName(/^C-FRAME HEAD$/) || byName(/^C-ARCH HEAD$/);
  if (arched && byName(/^C-ARCH HEAD$/)) skipped.push({ element: `${winName} - HEAD`, reason: 'arched head — no bSolid program (use the Arch DXF)' });
  else frameRow('head', head, 'HEAD');
  frameRow('cill', byName(/^C-FRAME CILL$/), 'CILL');
  frameRow('jambL', byName(/JAMB \(L\)/), 'JAMB L');
  frameRow('jambR', byName(/JAMB \(R\)/), 'JAMB R');

  // Mullions (full height in the PC construction) and transoms (segmented between mullions)
  const mullions = derived?.casement?.mullionRuns || [];
  const transoms = derived?.casement?.transomRuns || [];
  const macroVars = (positions, side) => {
    if (!B.macroVarsInList) return {};
    const dv = {};
    positions.slice(0, 3).forEach((pos, i) => { dv[`OP${i + 1}_HX`] = pos; });
    if (positions.length) { dv.LH_RH_CNTRL = sideVal(B, side); dv.SCRW_ON_OFF = B.screws; }
    return dv;
  };
  mullions.forEach((m, i) => {
    // transoms meeting this mullion: their axis heights are the joints along the mullion
    const joints = transoms.filter((t) => Math.abs(t.x2 - m.x1) < 0.6 || Math.abs(t.x1 - m.x2) < 0.6);
    const axes = [...new Set(joints.map((t) => r1(t.axisT)))];
    const side = joints.some((t) => Math.abs(t.x2 - m.x1) < 0.6) ? 'left' : 'right';   // a transom ending at x1 sits on the mullion's left
    const positions = opPositions(B, m.yTop, m.yBottom, m.length, axes);
    if (axes.length > 3) skipped.push({ element: `${winName} - MULLION ${i + 1}`, reason: `${axes.length} joints — the macro takes 3 (OP1..3_HX); extra joints dropped` });
    rows.push({
      program: P.mullion.file, panelId: P.mullion.panelId, panelName: P.mullion.panelName,
      quantity: 1, label: `${winName} - MULLION ${mullions.length > 1 ? i + 1 : ''}`.trim(),
      vars: { LPX: r1(m.length), LPY: face, LPZ: depth },
      docVars: macroVars(positions, side),
      element: `MULLION ${i + 1}`, window: winName,
      note: positions.length ? `joints at ${positions.join(' / ')} from the ${B.opOriginEnd}` : 'no transom joint — macro defaults apply',
    });
  });
  transoms.forEach((t, i) => {
    // mullions crossing INSIDE this transom run (none in the segmented construction — noted, not invented)
    const inside = mullions.filter((m) => m.axisX > t.x1 + 0.6 && m.axisX < t.x2 - 0.6).map((m) => r1(m.axisX));
    const positions = opPositions(B, t.x1, t.x2, t.length, inside);
    rows.push({
      program: P.transom.file, panelId: P.transom.panelId, panelName: P.transom.panelName,
      quantity: 1, label: `${winName} - TRANSOM ${transoms.length > 1 ? i + 1 : ''}`.trim(),
      vars: { LPX: r1(t.length), LPY: face, LPZ: depth },
      docVars: macroVars(positions, 'right'),
      element: `TRANSOM ${i + 1}`, window: winName,
      note: positions.length ? `joints at ${positions.join(' / ')}` : 'ends on the mullions — no interior joint, macro defaults apply',
    });
  });
  return { rows, skipped };
}

/** Identical rows (program + every variable) collapse into one row; labels are joined. */
export function groupBsuiteRows(rows) {
  const key = (r) => JSON.stringify([r.program, r.vars, r.docVars]);
  const out = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!out.has(k)) out.set(k, { ...r, labels: [r.label] });
    else { const g = out.get(k); g.quantity += r.quantity; g.labels.push(r.label); }
  }
  return [...out.values()].map((g) => ({ ...g, label: g.labels.length > 1 ? `${g.labels[0]} +${g.labels.length - 1}` : g.labels[0] }));
}

/* ─────────────────────────────── XML ─────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function guid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`;
}

/** MM/DD/YYYY HH:MM:SS as the sample writes LastAccess. */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** file:///C:/folder/PROG.bSolid — forward slashes, & escaped by the XML writer. */
export function programUri(folder, file) {
  const f = String(folder || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const abs = /^[A-Za-z]:\//.test(f) ? f : `C:/${f.replace(/^\/+/, '')}`;
  return `file:///${abs}/${file}`;
}

/**
 * The worklist XML — same element / attribute layout as the Biesse sample, line by line.
 * opts: { programsFolder, now?: Date, ids?: string[] (deterministic GUIDs for the harness) }
 */
export function writeWorklistXml(rows, opts = {}) {
  const folder = opts.programsFolder;
  const now = stamp(opts.now || new Date());
  const L = [];
  L.push('<Worklist Description="" Version="4">');
  L.push('  <Items>');
  rows.forEach((r, i) => {
    const id = opts.ids?.[i] || guid();
    L.push(`    <CadProgramWorklistItem Id="${id}" Name="${esc(r.program)}" Counter="0" Label="${esc(r.label || '')}" Quantity="${r.quantity}" Description="${esc(r.note || '')}" UsingDefaultOrigins="true" LastAccess="${now}" ProgramUri="${esc(programUri(folder, r.program))}">`);
    L.push('      <ExecutionTimeData ExecutionTime="00:00:00" DateTime="01/01/0001 00:00:00" Quantity="0" />');
    L.push('      <Origins />');
    L.push('      <ProgramDocumentNode Id="document" Name="document">');
    const dv = Object.entries(r.docVars || {});
    if (dv.length) {
      L.push('        <Variables>');
      for (const [k, v] of dv) L.push(`          <ParametricVariable TypeCode="String" VariableName="${k}" Expression="${fmt(v)}" ExpressionValue="${fmt(v)}" MeasureUnit="mm" />`);
      L.push('        </Variables>');
    } else L.push('        <Variables />');
    L.push('        <Children>');
    L.push(`          <ProgramPanelNode Id="${r.panelId}" Name="${esc(r.panelName)}">`);
    L.push('            <Variables>');
    for (const k of ['LPX', 'LPY', 'LPZ']) {
      if (r.vars[k] == null) continue;
      L.push(`              <ParametricVariable TypeCode="Double" VariableName="${k}" Expression="${fmt(r.vars[k])}" ExpressionValue="${fmt(r.vars[k])}" MeasureUnit="mm" />`);
    }
    L.push('            </Variables>');
    L.push('            <Children />');
    L.push('          </ProgramPanelNode>');
    L.push('        </Children>');
    L.push('      </ProgramDocumentNode>');
    L.push('    </CadProgramWorklistItem>');
  });
  L.push('  </Items>');
  L.push('  <Variables />');
  L.push('</Worklist>');
  return L.join(CRLF);
}

/* ─────────────────────────────── ZIP (stored) ─────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
function dosTime(d) { return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF; }
function dosDate(d) { return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF; }

/**
 * Minimal ZIP writer: entries [{ name, data: Uint8Array|string }] (a name ending in '/' is a
 * folder), STORED, one local header + central directory. Deterministic for a fixed `now`.
 */
export function writeZip(entries, now = new Date()) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  const T = dosTime(now), D = dosDate(now);
  for (const e of entries) {
    const nameB = enc.encode(e.name);
    const data = typeof e.data === 'string' ? enc.encode(e.data) : (e.data || new Uint8Array(0));
    const crc = data.length ? crc32(data) : 0;
    const local = new Uint8Array([
      ...u32(0x04034B50), ...u16(20), ...u16(0), ...u16(0), ...u16(T), ...u16(D),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0),
      ...nameB, ...data,
    ]);
    const central = new Uint8Array([
      ...u32(0x02014B50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(T), ...u16(D),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(e.name.endsWith('/') ? 0x10 : 0), ...u32(offset), ...nameB,
    ]);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054B50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);
  const total = offset + cdSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of [...locals, ...centrals, end]) { out.set(b, p); p += b.length; }
  return out;
}

/** The three entries of an .ewlist, in the sample's order. */
export function buildEwlist(rows, opts = {}) {
  const xml = writeWorklistXml(rows, opts);
  const now = opts.now || new Date();
  return writeZip([
    { name: 'worklist.wld', data: xml },
    { name: 'Programs/', data: new Uint8Array(0) },
    { name: 'version', data: '5' },
  ], now);
}

/* ─────────────────────────────── export (browser) ─────────────────────────────── */

function downloadBytes(filename, bytes) {
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (s) => String(s || 'pack').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'pack';

/**
 * Many windows (a pack or a batch) → one {label}_frames.ewlist.
 * windows: [{ windowSpec, derived, name }]. Returns { ok, rows, skipped, filename } or { error }.
 */
export function exportBsuiteFramesMerged(windows, fileLabel, profile = getCasementProfile()) {
  const all = [];
  const skipped = [];
  for (const w of windows) {
    const { rows, skipped: sk } = buildBsuiteFrameRows(w.windowSpec, w.derived, w.name, profile);
    all.push(...rows); skipped.push(...sk);
  }
  if (!all.length) return { error: 'no frame members to export (casement windows only)', skipped };
  const rows = groupBsuiteRows(all);
  const filename = `${safeName(fileLabel)}_frames.ewlist`;
  downloadBytes(filename, buildEwlist(rows, { programsFolder: profile.bsuite.programsFolder }));
  return { ok: true, rows: rows.length, pieces: rows.reduce((s, r) => s + r.quantity, 0), skipped, filename };
}
