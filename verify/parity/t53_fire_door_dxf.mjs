/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * t53: fire doors v1.2 (owner 28.10.2026: "I need DWG, all the elements in DWG, including
 * nicely drawn hinges"): the DXF of every element of a fire door set
 * (src/engine/cnc/fireDoorDxf.js, src/utils/fireDoorDxfExport.js; DXF R12 through the
 * unchanged dxfWriter.js, since a true .dwg needs a converter).
 * Doors: the reference FD30 826 x 2040 (hinge left, latch, surface closer, no VP), an FD60
 * euro door hinge right with a round VP (dia 300, 100 from the lock edge) and a built in
 * closer, a double side-by-side VP door (bathroom lock) and a non-fire DR door.
 *   1  the file: R12 header, EOF, the layer table (every used layer listed, one colour each,
 *      the reference layer set), every text plain ASCII with no NaN / undefined, no dashes;
 *   2  the counts: 3 hinge recesses on the leaf edge and 3 on the hinge jamb, 3 drawn
 *      hinges each, 1 forend slot and the keep plate with full radius bulges, 12 dowel
 *      circles in 4 mitre faces, the grooves (FD30 one strip, FD60 two per edge), the
 *      holes, the round VP as a CIRCLE, the rect panes with R6 bulges;
 *   3  the geometry against the reference numbers: hinge recess tops on the leaf edge and
 *      the jamb, the leaf hinge level with its jamb recess across the sheet, the spindle,
 *      backset, forend centre, keep centre, the VP placement, the dowel centres, the
 *      dimension texts of each view, the views never overlapping;
 *   4  the drawing follows the ops (a moved op moves the drawing), errors, the element files;
 *   5  the exports: the zip (1 + 4 files per door), downloadFireDoorDxf, exportWindowToDXF
 *      (a fire door goes to the new export, a sash keeps its old outline), the buttons;
 *   6  ezdxf (when python3 has it): every file reads, audit() zero errors, finite extents.
 *
 * Run: node verify/parity/t53_fire_door_dxf.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let fails = 0, passes = 0;
const ok = (cond, msg, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? `  -- ${detail}` : ''}`);
  if (cond) passes += 1; else fails += 1;
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b, tol = 0.06) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= tol;
const J = (o) => JSON.stringify(o);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT = resolve(ROOT, '.audit');
const OUT = resolve(AUDIT, 't53');
mkdirSync(OUT, { recursive: true });
const build = (name, lines) => {
  const entry = resolve(AUDIT, `${name}-entry.mjs`);
  writeFileSync(entry, lines.join('\n'));
  const out = resolve(AUDIT, `${name}-bundle.mjs`);
  execFileSync('npx', ['-y', 'esbuild@0.25.0', entry, '--bundle', '--format=esm', '--platform=node',
    '--loader:.jsx=jsx', '--loader:.js=jsx', '--jsx=automatic', '--define:import.meta.env={}', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:jspdf', '--external:three',
    `--outfile=${out}`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return pathToFileURL(out).href;
};
const url = build('t53-live', [
  `export * as specification from '${resolve(ROOT, 'src/engine/specification.js')}';`,
  `export * as calculations from '${resolve(ROOT, 'src/engine/calculations.js')}';`,
  `export * as fdxf from '${resolve(ROOT, 'src/engine/cnc/fireDoorDxf.js')}';`,
  `export * as fexp from '${resolve(ROOT, 'src/utils/fireDoorDxfExport.js')}';`,
  `export * as dxfExport from '${resolve(ROOT, 'src/utils/dxfExport.js')}';`,
  `export { writeDxf } from '${resolve(ROOT, 'src/engine/cnc/dxfWriter.js')}';`,
  "export { unzipSync, strFromU8 } from 'fflate';",
]);
const warn = console.warn;
console.warn = (...a) => { if (/zustand persist|Calc failed|localStorage/i.test(String(a[0]))) return; warn(...a); };
const M = await import(`${url}?t=${Date.now()}`);

const mk = (fc, name) => {
  const spec = M.specification.normaliseToWindowSpec({ id: `d-${name}`, name, width: 0, height: 0 }, { fullConfig: { windowCategory: 'firedoor', ...fc } });
  return { name, windowSpec: spec, derived: M.calculations.deriveWindowData(spec, {}) };
};
const REF = mk({ firedoorLeafWidth: 826, firedoorLeafHeight: 2040, firedoorHingeSide: 'left', firedoorLockType: 'latch', firedoorCloser: 'surface' }, 'FDR-01');
const F60 = mk({ firedoorRating: 'FD60', firedoorLeafWidth: 826, firedoorLeafHeight: 2040, firedoorHingeSide: 'right', firedoorLockType: 'euro', firedoorCloser: 'builtin',
  firedoorVp: { type: 'round', width: 300, across: 'lock', acrossOffset: 100 } }, 'FDR-02');
const DBL = mk({ firedoorLeafWidth: 926, firedoorLeafHeight: 2040, firedoorLockType: 'bathroom', firedoorCloser: 'none', firedoorVp: { type: 'double', arrange: 'side' } }, 'FDR-03');
const DR = mk({ firedoorFire: false, firedoorLeafWidth: 826, firedoorLeafHeight: 2040 }, 'DR-01');
const sashSpec = M.specification.normaliseToWindowSpec({ id: 'abcdef12', name: 'W1', width: 1000, height: 1500 }, { fullConfig: { windowCategory: 'sash' } });
const SASH = { name: 'W1', windowSpec: sashSpec, derived: M.calculations.deriveWindowData(sashSpec, {}) };

/** A DXF R12 text read back: the layer table and the entities (polylines with their vertices and bulges). */
function parseDxf(text) {
  const lines = text.split('\r\n');
  const recs = [];
  let cur = null;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim()), val = lines[i + 1];
    if (code === 0) { cur = { type: val, g: [] }; recs.push(cur); } else if (cur) cur.g.push([code, val]);
  }
  const get = (r, c) => { const p = r.g.find((x) => x[0] === c); return p ? p[1] : undefined; };
  const num = (r, c) => Number(get(r, c));
  const layers = [], ents = [];
  let sectionName = null, poly = null;
  for (const r of recs) {
    if (r.type === 'SECTION') { sectionName = get(r, 2); continue; }
    if (r.type === 'ENDSEC') { sectionName = null; continue; }
    if (sectionName === 'TABLES' && r.type === 'LAYER') layers.push({ name: get(r, 2), color: num(r, 62), ltype: get(r, 6) });
    if (sectionName !== 'ENTITIES') continue;
    if (r.type === 'POLYLINE') { poly = { type: 'POLYLINE', layer: get(r, 8), closed: (num(r, 70) & 1) === 1, v: [] }; ents.push(poly); }
    else if (r.type === 'VERTEX' && poly) poly.v.push({ x: num(r, 10), y: num(r, 20), b: get(r, 42) === undefined ? 0 : num(r, 42) });
    else if (r.type === 'SEQEND') poly = null;
    else if (r.type === 'CIRCLE') ents.push({ type: 'CIRCLE', layer: get(r, 8), x: num(r, 10), y: num(r, 20), r: num(r, 40) });
    else if (r.type === 'TEXT') ents.push({ type: 'TEXT', layer: get(r, 8), x: num(r, 10), y: num(r, 20), h: num(r, 40), str: get(r, 1) ?? '', rot: num(r, 50) || 0 });
    else ents.push({ type: r.type, layer: get(r, 8) });
  }
  return { layers, ents };
}
const onLayer = (P, type, layer) => P.ents.filter((e) => e.type === type && e.layer === layer);
const bulges = (e) => e.v.map((q) => q.b).filter((b) => b);
const QB = Math.tan(Math.PI / 8);

// the entity lists of each door (tags and views ride on the entities for these checks)
const build1 = (d, opts) => M.fdxf.fireDoorDxfEntities(d.derived, opts);
const tagged = (r, view, tag) => r.entities.filter((e) => (!view || e.view === view) && (!tag || e.tag === tag));
function box(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of list) {
    if (e.type === 'poly') {
      // the vertices and, for a bulged segment, the arc midpoint (a slot end reaches past its vertices)
      const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
      e.pts.forEach(([x, y, b], i) => {
        add(x, y);
        if (b && (i < e.pts.length - 1 || e.closed)) {
          const [qx, qy] = e.pts[(i + 1) % e.pts.length];
          const dx = qx - x, dy = qy - y, c = Math.hypot(dx, dy), s = (b * c) / 2;
          if (c > 0) add((x + qx) / 2 + (dy / c) * s, (y + qy) / 2 - (dx / c) * s);
        }
      });
    }
    else if (e.type === 'circle') { x0 = Math.min(x0, e.cx - e.r); x1 = Math.max(x1, e.cx + e.r); y0 = Math.min(y0, e.cy - e.r); y1 = Math.max(y1, e.cy + e.r); }
    else if (e.type === 'text') { x0 = Math.min(x0, e.x); x1 = Math.max(x1, e.x); y0 = Math.min(y0, e.y); y1 = Math.max(y1, e.y); }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
const dimTexts = (r, view) => tagged(r, view, 'dimText').map((e) => e.str);
const hasDims = (r, view, list) => { const t = dimTexts(r, view); return list.filter((s) => !t.includes(s)); };

const doors = { REF, F60, DBL, DR };
const R = {}, TXT = {}, PD = {};
for (const [k, d] of Object.entries(doors)) {
  R[k] = build1(d);
  TXT[k] = M.fexp.fireDoorDxfText(d.derived);
  PD[k] = parseDxf(TXT[k]);
  writeFileSync(resolve(OUT, `${d.name}_firedoor.dxf`), TXT[k]);
}

// ═════════════════════════════════════════════════════════════════════════════
section('1 - the file: R12 header, EOF, layers, texts');
{
  const fd = REF.derived.firedoor;
  // v1.3 (the Weeke rule, 28.10.2026): tops 145 / 700 / 1722 from the leaf top; the POSITION = the hinge lower edge above the leaf bottom
  ok(REF.derived.category === 'firedoor' && fd.leaf.width === 826 && fd.leaf.height === 2040 && fd.leaf.thickness === 44 && fd.frame.overall.width === 902 && fd.frame.overall.height === 2083
    && J(fd.hinges.positions.map((p) => p.top)) === J([145, 700, 1722]) && J(fd.hinges.positions.map((p) => p.jambTop)) === J([183, 738, 1760]) && fd.closer?.type === 'surface' && fd.lock.type === 'latch' && fd.handing.hingeSide === 'left',
    'the reference door derives: FD30 leaf 826 x 2040 x 44, frame 902 x 2083, hinge tops 145 / 700 / 1722 (jamb 183 / 738 / 1760), latch, surface closer, Hinge left');
  ok(fd.hinges.positionRef === 'bottom' && J(fd.hinges.positions.map((p) => p.fromBottom)) === J([1793, 1238, 216]) && J(fd.hinges.positions.map((p) => p.jambFromFoot)) === J([1798, 1243, 221]) && fd.hinges.recess.depth === 3.2
    && fd.lock.spindle.fromBottom === 995 && fd.lock.spindle.fromFloor === 1000 && fd.keep.centreFromFoot === 985,
    'v1.3: the positions counted from the bottom (positionRef bottom): hinge lower edges 1793 / 1238 / 216 above the leaf bottom, 1798 / 1243 / 221 above the jamb foot; recess 3.2 deep; spindle 1000 above the floor = 995 above the leaf bottom; keep 985 above the foot');
  for (const [k, d] of Object.entries(doors)) {
    const t = TXT[k];
    ok(t.startsWith('0\r\nSECTION\r\n2\r\nHEADER\r\n9\r\n$ACADVER\r\n1\r\nAC1009\r\n0\r\nENDSEC\r\n') && t.endsWith('0\r\nENDSEC\r\n0\r\nEOF\r\n'), `${d.name}: DXF R12 (AC1009) header, CRLF, ends with EOF`);
    const P = PD[k];
    const names = P.layers.map((l) => l.name);
    const used = [...new Set(P.ents.map((e) => e.layer))];
    const colours = P.layers.filter((l) => l.name !== '0').map((l) => l.color);
    ok(used.every((n) => names.includes(n)) && new Set(colours).size === colours.length && colours.every((c) => Number.isInteger(c) && c >= 1 && c <= 255) && P.layers.every((l) => /^[A-Za-z0-9_$-]+$/.test(l.name)),
      `${d.name}: every used layer is in the table, ${colours.length} layers with ${new Set(colours).size} distinct ACI colours, names valid for R12 (no dot)`, `used ${used.filter((n) => !names.includes(n)).join(' ')}; colours ${colours.join(' ')}`);
    const texts = P.ents.filter((e) => e.type === 'TEXT');
    const bad = texts.filter((e) => /NaN|undefined|Infinity|\bnull\b|(^|\s)\?(\s|$)/.test(e.str) || /[^\x20-\x7e]/.test(e.str) || !(e.h > 0));
    ok(texts.length > 80 && bad.length === 0, `${d.name}: ${texts.length} texts, every one plain ASCII with no NaN / undefined / Infinity / null / ?`, bad.slice(0, 5).map((e) => e.str).join(' | '));
    ok(!/[\u2013\u2014]/.test(t) && !/NaN|undefined|Infinity/.test(t), `${d.name}: no en / em dash and no NaN / undefined / Infinity anywhere in the file`);
    ok(M.fexp.fireDoorDxfText(d.derived) === t, `${d.name}: the text is deterministic (a second build is byte identical)`);
  }
  // v1.3: the hinge recess is 3.2 deep, so its layer reads FD_HINGE_RECESS_D3P2 (the dot written as P, from the op depth)
  const want = ['FD_OUTLINE', 'FD_DIM', 'FD_TEXT', 'FD_CENTRE', 'FD_HOLE_THROUGH', 'FD_LOCK_FOREND_D4', 'FD_LOCK_FOREND_D4_HIDDEN', 'FD_LOCK_CASE_D87', 'FD_LOCK_CASE_D87_HIDDEN',
    'FD_HINGE_RECESS_D3P2', 'FD_HINGE_DRAWING', 'FD_INTU_GROOVE_D4', 'FD_CLOSER_SYMBOL', 'FD_MITRE', 'FD_REBATE_15x47', 'FD_DOWEL_8_D20', 'FD_DOWEL_8_D20_HIDDEN', 'FD_KEEP_PLATE_D3', 'FD_KEEP_POCKET_D15'];
  const names = PD.REF.layers.map((l) => l.name).filter((n) => n !== '0');
  ok(J([...names].sort()) === J([...want].sort()), `FDR-01: the layer table is exactly the ${want.length} reference layers (${want.join(', ')})`, names.join(' '));
  ok(names.includes('FD_HINGE_RECESS_D3P2') && !names.includes('FD_HINGE_RECESS_D3') && REF.derived.firedoor.machining.leaf.filter((o) => o.kind === 'hingeRecess').every((o) => o.depth === 3.2),
    'the hinge recess layer follows the op depth 3.2: FD_HINGE_RECESS_D3P2, no D3 layer');
  const n60 = PD.F60.layers.map((l) => l.name);
  ok(['FD_REBATE_15x57', 'FD_VP_CUTOUT_THROUGH', 'FD_CLOSER_SYMBOL', 'FD_CLOSER_SYMBOL_HIDDEN', 'FD_INTU_GROOVE_D4'].every((n) => n60.includes(n)) && !n60.includes('FD_REBATE_15x47'),
    'FDR-02 (FD60): the rebate layer FD_REBATE_15x57 (leaf 54 + 3), the VP cut-out, the built in closer pocket and its hidden track');
  const nDr = PD.DR.layers.map((l) => l.name);
  ok(!nDr.some((n) => /INTU|CLOSER|VP_CUTOUT/.test(n)) && nDr.includes('FD_HINGE_RECESS_D3P2'), 'DR-01 (non-fire, no closer, no VP): no intumescent, closer or VP layer');
  const lt = PD.REF.layers.every((l) => l.ltype === 'CONTINUOUS');
  ok(lt && names.filter((n) => /_HIDDEN$/.test(n)).length === 3, 'hidden geometry on its own *_HIDDEN layers (forend, case, dowel bores on FDR-01; the writer sets CONTINUOUS, the user sets a dashed linetype)');
  const tb = tagged(R.REF, null, 'titleBlock').map((e) => e.str);
  const tbWant = ['FDR-01  FD30 fire door set', 'Leaf 826 x 2040 x 44', 'Frame overall 902 x 2083, depth 100, members 50 x 100 (raw 63 x 105)', 'Structural opening 912 x 2088',
    'Rebate 15 x 47 from solid, faces 35 outside / 50 inside', 'Hinge left (seen from the pull side); 3 hinges 102 at 1793 / 1238 / 216 (hinge jamb 1798 / 1243 / 221 from the foot)',
    'Hinge positions from the leaf bottom to the hinge lower edge (H1 = the top hinge)',
    'Lock: Latch, spindle 1000 above the floor (995 above the leaf bottom), backset 60, forend centre 1060 from the leaf top', 'Keep centre 985 above the lock jamb foot', 'Closer: Surface closer (symbol, not machined)',
    'Vision panel: none', 'Intumescent: 1 x 15 x 4 all around, groove 15.5 x 4, colour White', 'Corner dowels: 3 x dia 8 x 40 per corner, bored 20 square to the mitre',
    'DXF R12, opens in AutoCAD and bSolid (a true .dwg needs a converter)', 'Production Core, Skylon'];
  ok(tbWant.every((s) => tb.includes(s)), 'FDR-01 title block: name, rating, leaf, frame overall, opening, rebate, hinge side and positions, lock, keep, closer, vision panel, intumescent with colour, dowels, DXF note, "Production Core, Skylon"', tbWant.filter((s) => !tb.includes(s)).join(' | '));
  const tb60 = tagged(R.F60, null, 'titleBlock').map((e) => e.str);
  const fd60 = F60.derived.firedoor;
  ok(tb60.includes(`Vision panel: ${fd60.vp.label}; ${fd60.vp.positionLabel}; glass ${fd60.vp.glass.label} ${fd60.vp.glass.thickness}`) && tb60.includes('Vision panel: Round (porthole): dia 300; 100 from the lock edge, top 150 below the leaf top; glass FD insulated 6')
    && tb60.includes('Closer: Built in closer (symbol, not machined)') && tb60.some((s) => /^Intumescent: 2 x 15 x 4 all around/.test(s)) && tb60.some((s) => s.startsWith('Hinge right')),
    'FDR-02 title block: the VP label + position + glass (Round (porthole): dia 300; 100 from the lock edge, top 150 below the leaf top; glass FD insulated 6), built in closer, two strips, Hinge right');
  ok(tagged(R.DR, null, 'titleBlock').some((s) => s.str === 'Intumescent: none (non-fire)') && tagged(R.DR, null, 'titleBlock').some((s) => s.str === 'DR-01  non-fire door set'), 'DR-01 title block: non-fire door set, no intumescent');
  ok(tagged(R.REF, null, 'header').map((e) => e.str).join('') === 'FDR-01  FD30  all elements: leaf, head, hinge jamb, lock jamb  (mm, 1:1)', 'the header over the row names the door and the four elements');
}

// ═════════════════════════════════════════════════════════════════════════════
section('2 - the counts');
{
  const P = PD.REF;
  const rec = onLayer(P, 'POLYLINE', 'FD_HINGE_RECESS_D3P2');
  ok(rec.length === 6 && rec.every((e) => e.closed && e.v.length === 8 && bulges(e).length === 4 && bulges(e).every((b) => near(b, QB, 1e-6))), '6 hinge recesses (3 on the leaf hinge edge, 3 on the hinge jamb), each a closed rounded rectangle with 4 R6 bulges (tan 22.5)', `${rec.length}`);
  ok(tagged(R.REF, 'leafHingeEdge', 'hingeRecessLeaf').length === 3 && tagged(R.REF, 'jambHingeOpening', 'hingeRecessJamb').length === 3, 'the recesses: 3 in the leaf hinge edge view, 3 in the hinge jamb opening face view');
  const plates = (v, t) => tagged(R.REF, v, t).length;
  ok(plates('leafHingeEdge', 'hingeLeafPlate') === 3 && plates('leafHingeEdge', 'hingeLeafKnuckle') === 3 && plates('leafHingeEdge', 'hingeLeafScrew') === 9 && plates('leafHingeEdge', 'hingeLeafScrewHead') === 9
    && plates('jambHingeOpening', 'hingeJambPlate') === 3 && plates('jambHingeOpening', 'hingeJambKnuckle') === 3 && plates('jambHingeOpening', 'hingeJambScrew') === 9 && plates('jambHingeOpening', 'hingeJambScrewHead') === 9,
    '3 drawn hinges on the leaf edge and 3 on the hinge jamb: each a plate, a knuckle and 3 countersunk screws (FD_HINGE_DRAWING)');
  ok(onLayer(P, 'CIRCLE', 'FD_HINGE_DRAWING').length === 37 && plates('leafPull', 'knuckleFace') === 3 && plates('leafTopEdge', 'knuckleTop') === 1,
    'FD_HINGE_DRAWING: 36 screw circles + the knuckle barrel seen from the top; the 3 knuckles marked on the pull face hinge edge');
  const plate102 = tagged(R.REF, 'leafHingeEdge', 'hingeLeafPlate').map((e) => box([e]));
  ok(plate102.every((b) => near(b.h, 102) && near(b.w, 29 - 6.5)), 'a drawn hinge plate is the hinge length 102 long and runs from the knuckle to the recess width less the mill oversize (29)', J(plate102.map((b) => [b.w, b.h])));
  const fo = onLayer(P, 'POLYLINE', 'FD_LOCK_FOREND_D4');
  ok(fo.length === 1 && fo[0].closed && fo[0].v.length === 4 && J(bulges(fo[0])) === J([1, 1]), '1 forend slot: a closed polyline of 4 vertices with two bulges of 1 (full radius ends)', J(fo.map((e) => e.v)));
  const cs = onLayer(P, 'POLYLINE', 'FD_LOCK_CASE_D87');
  ok(cs.length === 1 && J(bulges(cs[0])) === J([1, 1]) && onLayer(P, 'POLYLINE', 'FD_LOCK_CASE_D87_HIDDEN').length === 1 && onLayer(P, 'POLYLINE', 'FD_LOCK_FOREND_D4_HIDDEN').length === 1,
    'the case pocket: its mouth on the lock edge (full radius, R 8.5) and the pocket and forend seen through the pull face on the HIDDEN layers');
  const kp = onLayer(P, 'POLYLINE', 'FD_KEEP_PLATE_D3'), kk = onLayer(P, 'POLYLINE', 'FD_KEEP_POCKET_D15');
  ok(kp.length === 1 && J(bulges(kp[0])) === J([1, 1]) && kk.length === 1 && J(bulges(kk[0])) === J([1, 1]), 'the keep plate and the keep pocket on the lock jamb: one slot each with full radius ends (two bulges of 1)');
  const dw = onLayer(P, 'CIRCLE', 'FD_DOWEL_8_D20');
  ok(dw.length === 12 && dw.every((c) => near(c.r, 4, 1e-6)), '12 dowel circles dia 8 in the mitre faces (2 corners x 3 dowels x 2 pieces)', `${dw.length}`);
  const mv = R.REF.views.filter((v) => /Mitre/.test(v.id));
  ok(mv.length === 4 && J(mv.map((v) => v.id)) === J(['headMitreStart', 'headMitreEnd', 'jambHingeMitreStart', 'jambLockMitreStart']) && mv.every((v) => tagged(R.REF, v.id, 'dowelCircle').length === 3),
    '4 mitre faces (head left and right, each jamb top), 3 dowel circles in each');
  ok(onLayer(P, 'POLYLINE', 'FD_DOWEL_8_D20_HIDDEN').length === 4 && tagged(R.REF, null, 'dowelAxis').length === 4, 'the elevations: one hidden bore (all 3 dowels project onto it) and its axis square to the mitre at each of the 4 mitred ends');
  ok(onLayer(P, 'POLYLINE', 'FD_INTU_GROOVE_D4').length === 3 && onLayer(PD.F60, 'POLYLINE', 'FD_INTU_GROOVE_D4').length === 6 && onLayer(PD.DR, 'POLYLINE', 'FD_INTU_GROOVE_D4').length === 0,
    'grooves: FD30 one per edge (top, hinge, lock = 3), FD60 two per edge (6), the non-fire door none');
  const holes = (k) => onLayer(PD[k], 'CIRCLE', 'FD_HOLE_THROUGH').map((c) => c.r).sort((a, b) => a - b);
  ok(J(holes('REF')) === J([5]) && J(holes('F60')) === J([5, 9]) && J(holes('DBL')) === J([5, 5]), 'holes through: latch the spindle dia 10, euro + the cylinder dia 18, bathroom + the thumbturn dia 10');
  const vpC = onLayer(PD.F60, 'CIRCLE', 'FD_VP_CUTOUT_THROUGH');
  ok(vpC.length === 1 && near(vpC[0].r, 150, 1e-6) && onLayer(PD.F60, 'POLYLINE', 'FD_VP_CUTOUT_THROUGH').length === 0, 'FDR-02: the round VP is one CIRCLE r 150 on FD_VP_CUTOUT_THROUGH');
  const vpR = onLayer(PD.DBL, 'POLYLINE', 'FD_VP_CUTOUT_THROUGH');
  ok(vpR.length === 2 && vpR.every((e) => e.closed && bulges(e).length === 4 && bulges(e).every((b) => near(b, QB, 1e-6))), 'FDR-03: the two panes as closed rounded rectangles (R6 corner bulges)');
  ok(onLayer(P, 'POLYLINE', 'FD_MITRE').filter((e) => e.closed && e.v.length === 6).length === 4 && tagged(R.REF, null, 'mitreLine').length === 4,
    'FD_MITRE: the 4 unfolded mitre faces (the rebate notch cut out) and the 4 mitre lines in the elevations');
  ok(tagged(R.REF, 'leafPull', 'closerBody').length === 1 && tagged(R.REF, 'leafPull', 'closerArm').length === 1 && tagged(R.REF, 'leafPull', 'closerShoe').length === 1 && tagged(R.REF, 'leafTopEdge', 'closerBodyTop').length === 1
    && tagged(R.F60, 'leafPull', 'closerBodyHidden').length === 1 && tagged(R.F60, 'leafTopEdge', 'closerPocketTop').length === 1 && tagged(R.F60, 'leafTopEdge', 'closerTrackHidden').length === 1,
    'the closer symbols: surface (body, arm, shoe on the pull face; the body on the top view), built in (the hidden body, the pocket on the top edge, the hidden head track)');
}

// ═════════════════════════════════════════════════════════════════════════════
section('3 - the geometry against the reference numbers');
{
  const r = R.REF;
  const edgeTop = box(tagged(r, 'leafHingeEdge', 'leafEdgeOutline')).y1;
  const recTops = tagged(r, 'leafHingeEdge', 'hingeRecessLeaf').map((e) => box([e])).sort((a, b) => b.y1 - a.y1);
  ok(J(recTops.map((b) => Math.round((edgeTop - b.y1) * 10) / 10)) === J([144.5, 699.5, 1721.5]) && recTops.every((b) => near(b.h, 103) && near(b.w, 30)),
    'leaf hinge edge: the recesses 103 x 30 at 144.5 / 699.5 / 1721.5 from the leaf top (the ops: hinge top - 0.5; v1.3 the Weeke rule), lower edges 1792.5 / 1237.5 / 215.5 above the leaf bottom', J(recTops));
  const jTop = box(tagged(r, 'jambHingeOpening', 'memberFaceOutline')).y1;
  const jRec = tagged(r, 'jambHingeOpening', 'hingeRecessJamb').map((e) => box([e])).sort((a, b) => b.y1 - a.y1);
  ok(J(jRec.map((b) => Math.round((jTop - b.y1) * 10) / 10)) === J([182.5, 737.5, 1759.5]) && jRec.every((b) => near(b.h, 103) && near(b.w, 30)),
    'hinge jamb: the recesses 103 x 30 at 182.5 / 737.5 / 1759.5 from the top long point (35 + 3 + hinge top - 0.5)', J(jRec));
  const kn = tagged(r, 'leafPull', 'knuckleFace').map((e) => box([e]).y1).sort((a, b) => b - a);
  const jp = tagged(r, 'jambHingeOpening', 'hingeJambPlate').map((e) => box([e]).y1).sort((a, b) => b - a);
  ok(kn.length === 3 && kn.every((y, i) => near(y, jp[i], 0.01)) && near(kn[0], 5 + 2040 - 145, 0.01), `true heights: each leaf hinge stands level with its jamb hinge across the sheet (top hinge at Y ${kn[0]} = floor gap 5 + 2040 - 145)`, `${kn} vs ${jp}`);
  const leaf = box(tagged(r, 'leafPull', 'leafOutline'));
  const sp = tagged(r, 'leafPull', 'spindleHole')[0];
  ok(near(leaf.w, 826, 0.01) && near(leaf.h, 2040, 0.01) && near(leaf.y0, 5, 0.01) && sp && near(sp.cy - leaf.y0, 995) && near(sp.cy, 1000) && near(leaf.x1 - sp.cx, 60) && near(sp.r, 5),
    'pull face: the leaf 826 x 2040 standing 5 above the jamb foot; the spindle 995 above the leaf bottom = 1000 above the floor (v1.3), 60 in from the lock edge (on the right for Hinge left)');
  const lockTop = box(tagged(r, 'leafLockEdge', 'leafEdgeOutline')).y1;
  const slot = box(tagged(r, 'leafLockEdge', 'forendSlot'));
  ok(near(slot.h, 236) && near(slot.w, 25) && near(lockTop - slot.cy, 1060), 'lock edge: the forend slot 236 x 25, its centre 1060 from the leaf top (2040 - (995 - 15))');
  const keepO = box(tagged(r, 'jambLockOpening', 'memberFaceOutline'));
  const kp = box(tagged(r, 'jambLockOpening', 'keepPlate')), kk = box(tagged(r, 'jambLockOpening', 'keepPocket'));
  ok(near(kp.h, 176) && near(kp.w, 40) && near(kp.cy - keepO.y0, 985) && near(kk.h, 120) && near(kk.w, 18) && near(kk.cy, kp.cy) && near(keepO.h, 2083) && near(keepO.w, 100),
    'lock jamb: the keep plate 176 x 40 and pocket 120 x 18 centred 985 above the jamb foot (5 + 995 - 15), the face 2083 x 100');
  const he = box(tagged(r, 'headElevation', 'memberOutline'));
  ok(near(he.w, 902) && near(he.h, 50) && near(he.y1, 2083), 'head elevation 902 x 50, its wall face level with the jamb top long point (2083)');
  const mf = R.REF.views.filter((v) => /Mitre/.test(v.id)).map((v) => {
    const f = box(tagged(r, v.id, 'mitreFace'));
    const c = tagged(r, v.id, 'dowelCircle').sort((a, b) => b.cy - a.cy);
    return { w: f.w, h: f.h, s: c.map((q) => Math.round((q.cx - f.x0) * 100) / 100), z: c.map((q) => Math.round((f.y1 - q.cy) * 10) / 10) };
  });
  ok(mf.every((m) => near(m.w, 50 * Math.SQRT2, 0.01) && near(m.h, 100, 0.01) && J(m.z) === J([20, 50, 80]) && m.s.every((s) => near(s, 25 * Math.SQRT2, 0.01))),
    'each mitre face unfolded 70.7 (50 x sqrt 2) by 100; the dowel centres at 20 / 50 / 80 along the depth, 35.36 (25 x sqrt 2) along the mitre', J(mf));
  // FD60 hinge right: the mirror, the round VP placement
  const r6 = R.F60;
  const l6 = box(tagged(r6, 'leafPull', 'leafOutline'));
  const kn6 = tagged(r6, 'leafPull', 'knuckleFace').map((e) => box([e]));
  const vp6 = tagged(r6, 'leafPull', 'vpRound')[0];
  const cy6 = tagged(r6, 'leafPull', 'cylinderHole')[0];
  ok(kn6.every((b) => near(b.cx, l6.x1, 0.01)) && vp6 && near(vp6.r, 150) && near(l6.y1 - vp6.cy, 300) && near(vp6.cx - l6.x0, 250) && cy6 && near(cy6.cy - l6.y0, 923) && near(cy6.cx - l6.x0, 60) && near(cy6.r, 9),
    'FDR-02 (Hinge right, mirrored): the knuckles on the right edge, the round VP r 150 centred 300 below the top and 250 in from the lock edge (on the left), the euro cylinder dia 18 at 923 (995 - 72), 60 from the lock edge');
  const rp = tagged(R.DBL, 'leafPull', 'vpRect').map((e) => box([e])).sort((a, b) => a.x0 - b.x0);
  const ld = box(tagged(R.DBL, 'leafPull', 'leafOutline'));
  ok(rp.length === 2 && rp.every((b) => near(b.w, 150) && near(b.h, 800) && near(ld.y1 - b.y1, 150)) && near(rp[1].x0 - rp[0].x1, 100) && near(rp[0].x0 - ld.x0, ld.x1 - rp[1].x1),
    'FDR-03: two panes 150 x 800 side by side, 100 apart, centred, top 150 below the leaf top');
  // the dimension texts of each view (the numbers a machinist needs)
  const want = {
    leafPull: ['216', '1238', '1793', '2040', '826', '995 (1000 from the floor)', '60'],
    leafHingeEdge: ['215.5', '1237.5', '1792.5', '103', '30', '44', '14.3', '15.5'],
    leafLockEdge: ['1060', '236', '997', '153', '25', '17', '44'],
    leafTopEdge: ['14.3', '15.5', '44'],
    headElevation: ['902', '15', '50'],
    headOpening: ['47', '100', '802'],
    headMitreStart: ['20', '50', '80', '100', '35.4', '70.7'],
    jambHingeElevation: ['2083', '15', '50'],
    jambHingeOpening: ['220.5', '1242.5', '1797.5', '103', '30', '47', '100'],
    jambHingeMitreStart: ['20', '50', '80', '100', '35.4', '70.7'],
    jambLockOpening: ['985', '1010', '176', '120', '2', '40', '13', '18', '47', '100'],
  };
  const missing = Object.entries(want).flatMap(([v, l]) => hasDims(r, v, l).map((s) => `${v}:${s}`));
  ok(missing.length === 0, `dimension texts (v1.3 from the bottom): hinge lower edges 216 / 1238 / 1793 above the leaf bottom, recess lower edges (leaf 215.5 / 1237.5 / 1792.5, jamb 220.5 / 1242.5 / 1797.5 above the foot), spindle 995 (1000 from the floor), backset 60, forend centre 1060, keep 985 from the foot, dowels 20 / 50 / 80 and 35.4, rebate 15 / 47, overall 826 / 2040 / 902 / 2083`, missing.join(' '));
  const vpd = hasDims(R.F60, 'leafPull', ['150', 'dia 300', '923', '995 (1000 from the floor)']).concat(hasDims(R.DBL, 'leafPull', ['150', '800', '100', '263', '917']));
  ok(vpd.length === 0, 'VP dimensions: FDR-02 top 150 and "dia 300", the cylinder 923; FDR-03 the panes 800 high, 263 / 150 / 100 / 150 / 263 across, the thumbturn 917', vpd.join(' '));
  // no two views overlap, nor the title block
  for (const [k, rr] of Object.entries(R)) {
    const boxes = rr.views.map((v) => ({ id: v.id, ...v.bbox }));
    boxes.push({ id: 'titleBlock', ...box(tagged(rr, null, 'titleBlockFrame')) });
    const hits = [];
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) hits.push(`${a.id}/${b.id}`);
    }
    ok(boxes.length === 15 && hits.length === 0, `${doors[k].name}: 14 views and the title block, no two overlapping (dimensions and titles included)`, hits.join(' '));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
section('4 - the drawing follows the ops; errors; the element files');
{
  const moved = structuredClone(REF.derived);
  const h0 = moved.firedoor.machining.leaf.find((o) => o.kind === 'hingeRecess');
  h0.x += 10;
  const kp0 = moved.firedoor.machining.jambLock.find((o) => o.kind === 'keepPlate');
  kp0.x -= 20;
  const rm = M.fdxf.fireDoorDxfEntities(moved);
  const topOf = (rr, v, o, t) => box(tagged(rr, v, o)).y1 - Math.max(...tagged(rr, v, t).map((e) => box([e]).y1));
  ok(near(topOf(rm, 'leafHingeEdge', 'leafEdgeOutline', 'hingeRecessLeaf'), 154.5) && near(box(tagged(rm, 'jambLockOpening', 'keepPlate')).cy - box(tagged(R.REF, 'jambLockOpening', 'keepPlate')).cy, 20),
    'the drawing reads the machining ops: a hinge recess op moved 10 down moves its recess 10, a keep plate op moved 20 up moves the plate 20');
  const bad = M.fdxf.fireDoorDxfEntities(SASH.derived);
  ok(bad.error && bad.entities.length === 0 && M.fexp.downloadFireDoorDxf({ name: 'W1', derived: SASH.derived }).error, 'a sash window: fireDoorDxfEntities returns { error }, downloadFireDoorDxf returns { error } (no download)');
  let threw = false;
  try { M.fexp.fireDoorElementDxfText(REF.derived, 'cill'); } catch { threw = true; }
  ok(threw, "fireDoorElementDxfText(derived, 'cill') throws: the elements are leaf, head, jambHinge, jambLock");
  const el = {};
  for (const e of M.fexp.FIREDOOR_DXF_ELEMENTS) {
    el[e] = { r: M.fdxf.fireDoorDxfEntities(REF.derived, { elements: [e] }), t: M.fexp.fireDoorElementDxfText(REF.derived, e) };
    el[e].p = parseDxf(el[e].t);
    writeFileSync(resolve(OUT, `FDR-01_${M.fexp.fireDoorElementName(REF.derived, e)}.dxf`), el[e].t);
  }
  ok(J(M.fexp.FIREDOOR_DXF_ELEMENTS) === J(['leaf', 'head', 'jambHinge', 'jambLock']) && Object.values(el).every((x, i) => x.r.views.every((v) => v.element === M.fexp.FIREDOOR_DXF_ELEMENTS[i]) && x.t.endsWith('0\r\nEOF\r\n')),
    'each element file holds only the views of its element and is a whole DXF');
  const c = (e, type, layer) => onLayer(el[e].p, type, layer).length;
  ok(c('leaf', 'POLYLINE', 'FD_HINGE_RECESS_D3P2') === 3 && c('leaf', 'CIRCLE', 'FD_DOWEL_8_D20') === 0 && c('leaf', 'POLYLINE', 'FD_LOCK_FOREND_D4') === 1 && c('leaf', 'CIRCLE', 'FD_HINGE_DRAWING') === 19,
    'leaf file: 3 hinge recesses, 3 drawn hinges (18 screw circles + the barrel), the forend, no dowel');
  ok(c('head', 'CIRCLE', 'FD_DOWEL_8_D20') === 6 && c('head', 'POLYLINE', 'FD_HINGE_RECESS_D3P2') === 0 && el.head.r.views.length === 4, 'head file: elevation, soffit, two mitre faces with 6 dowel circles, no hinge recess');
  ok(c('jambHinge', 'POLYLINE', 'FD_HINGE_RECESS_D3P2') === 3 && c('jambHinge', 'CIRCLE', 'FD_DOWEL_8_D20') === 3 && c('jambHinge', 'CIRCLE', 'FD_HINGE_DRAWING') === 18 && el.jambHinge.r.views.length === 3,
    'hinge jamb file: 3 recesses with 3 drawn hinges, the top mitre with 3 dowels');
  ok(c('jambLock', 'POLYLINE', 'FD_KEEP_PLATE_D3') === 1 && c('jambLock', 'POLYLINE', 'FD_KEEP_POCKET_D15') === 1 && c('jambLock', 'CIRCLE', 'FD_DOWEL_8_D20') === 3 && c('jambLock', 'POLYLINE', 'FD_HINGE_RECESS_D3P2') === 0,
    'lock jamb file: the keep plate and pocket, 3 dowels, no hinge recess');
  ok(tagged(el.head.r, null, 'titleBlock')[0]?.str === 'FDR-01  FD30 fire door set  (FD-HEAD)' && tagged(el.leaf.r, null, 'header')[0]?.str.includes('FD-LEAF (leaf)'), 'an element file names its element in the header and the title block');
}

// ═════════════════════════════════════════════════════════════════════════════
section('5 - the exports: the zip, the downloads, exportWindowToDXF, the buttons');
{
  const windows = [REF, F60, SASH, DBL].map((d) => ({ windowSpec: d.windowSpec, derived: d.derived, name: d.name }));
  const files = M.fexp.fireDoorDxfZipFiles(windows);
  const un = M.unzipSync(M.fexp.fireDoorDxfZipBytes(windows));
  const names = Object.keys(un).sort();
  const wantNames = ['FDR-01', 'FDR-02', 'FDR-03'].flatMap((n) => [`${n}_firedoor.dxf`, `${n}/${n}_FD-LEAF.dxf`, `${n}/${n}_FD-HEAD.dxf`, `${n}/${n}_FD-JAMB-H.dxf`, `${n}/${n}_FD-JAMB-L.dxf`]).sort();
  ok(J(names) === J(wantNames), `the zip: 1 + 4 files per fire door (3 doors = 15), the sash window left out: ${names.slice(0, 5).join(', ')} ...`, J(names));
  ok(names.every((n) => M.strFromU8(un[n]) === files[n]) && M.strFromU8(un['FDR-02_firedoor.dxf']) === TXT.F60 && M.strFromU8(un['FDR-01/FDR-01_FD-JAMB-L.dxf']) === M.fexp.fireDoorElementDxfText(REF.derived, 'jambLock'),
    'every zip entry is byte identical to fireDoorDxfText / fireDoorElementDxfText of its door');
  const twin = M.fexp.fireDoorDxfZipFiles([REF, REF].map((d) => ({ derived: d.derived, name: d.name })));
  ok(Object.keys(twin).length === 10 && 'FDR-01_2_firedoor.dxf' in twin, 'two doors of the same name keep apart (FDR-01, FDR-01_2)');
  ok(M.fexp.downloadFireDoorDxfZip([SASH], 'pack').error && M.fexp.downloadFireDoorDxfZip([], 'pack').error, 'downloadFireDoorDxfZip of a list without a fire door: { error }, no download');
  // the browser downloads with a stubbed document
  const got = [];
  const origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL, origDoc = globalThis.document;
  let lastBlob = null;
  URL.createObjectURL = (b) => { lastBlob = b; return 'blob:t53'; };
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    createElement: () => { const a = { href: '', download: '', click() { got.push({ name: a.download, blob: lastBlob }); }, remove() {} }; return a; },
    body: { appendChild() {}, removeChild() {} },
  };
  try {
    const d1 = M.fexp.downloadFireDoorDxf({ name: 'FDR-01', derived: REF.derived });
    const z = M.fexp.downloadFireDoorDxfZip(windows, 'Pack 7');
    await M.dxfExport.exportWindowToDXF({ item: { id: 'it-1234567', name: 'FDR-02' }, windowSpec: F60.windowSpec, derived: F60.derived });
    await M.dxfExport.exportWindowToDXF({ item: { id: 'abcdef1234', window_number: 'W1' }, windowSpec: SASH.windowSpec, derived: SASH.derived });
    const txt = await Promise.all(got.map(async (g) => (g.name.endsWith('.zip') ? new Uint8Array(await g.blob.arrayBuffer()) : g.blob.text())));
    ok(d1.ok && d1.filename === 'FDR-01_firedoor.dxf' && got[0]?.name === 'FDR-01_firedoor.dxf' && txt[0] === TXT.REF, 'downloadFireDoorDxf: FDR-01_firedoor.dxf, the all-elements text');
    ok(z.ok && z.doors === 3 && z.files === 15 && z.filename === 'Pack_7_firedoor_dxf.zip' && got[1]?.name === 'Pack_7_firedoor_dxf.zip' && Object.keys(M.unzipSync(txt[1])).length === 15,
      'downloadFireDoorDxfZip: Pack_7_firedoor_dxf.zip with 15 files for 3 doors');
    ok(got[2]?.name === 'FDR-02_firedoor.dxf' && txt[2] === TXT.F60, 'exportWindowToDXF of a fire door hands it to the fire door export (FDR-02_firedoor.dxf, every element)');
    ok(got[3]?.name === 'W1-abcdef.dxf' && txt[3].startsWith('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n') && /\nSASH-TOP\n/.test(txt[3]) && /\nSASH-BOTTOM\n/.test(txt[3]) && /\nFRAME\n/.test(txt[3]) && txt[3].endsWith('0\nENDSEC\n0\nEOF\n'),
      'exportWindowToDXF of a sash window: the old outline file unchanged (W1-abcdef.dxf, FRAME / OPENING / SASH-BOTTOM / SASH-TOP)');
  } finally {
    URL.createObjectURL = origCreate; URL.revokeObjectURL = origRevoke; globalThis.document = origDoc;
  }
  // the buttons (the build proves the names resolve; the pages render in t51)
  const wdp = readFileSync(resolve(ROOT, 'src/pages/WindowDetailPage.jsx'), 'utf8');
  const ppp = readFileSync(resolve(ROOT, 'src/pages/ProductionPackPage.jsx'), 'utf8');
  ok(M.fexp.FIREDOOR_DXF_TOOLTIP === 'DXF, opens in AutoCAD and bSolid (a true .dwg needs a converter)', 'the tooltip: "DXF, opens in AutoCAD and bSolid (a true .dwg needs a converter)"');
  ok(/import \{ downloadFireDoorDxf, FIREDOOR_DXF_TOOLTIP \} from '\.\.\/utils\/fireDoorDxfExport\.js';/.test(wdp) && /downloadFireDoorDxf\(\{ name: label, derived \}\)/.test(wdp) && />\s*📐 Fire door DXF\s*</.test(wdp) && (wdp.match(/title=\{FIREDOOR_DXF_TOOLTIP\}/g) || []).length === 1,
    'window page: "Fire door DXF" next to the fire door buttons (inside the firedoor-only block), the tooltip constant');
  ok(/import \{ downloadFireDoorDxfZip, FIREDOOR_DXF_TOOLTIP \} from '\.\.\/utils\/fireDoorDxfExport\.js';/.test(ppp) && /downloadFireDoorDxfZip\(doors, label\)/.test(ppp) && />\s*📐 Fire door DXF \(zip\)\s*</.test(ppp) && (ppp.match(/title=\{FIREDOOR_DXF_TOOLTIP\}/g) || []).length === 1,
    'pack page: "Fire door DXF (zip)" next to the pack fire door buttons (inside showFireDoorExports), the tooltip constant');
  const wIdx = wdp.indexOf("windowSpec?.category === 'firedoor' && (() => {"), wBtn = wdp.indexOf('📐 Fire door DXF'), wEnd = wdp.indexOf('</>);', wIdx);
  const pIdx = ppp.indexOf('{showFireDoorExports && (() => {'), pBtn = ppp.indexOf('📐 Fire door DXF (zip)'), pEnd = ppp.indexOf('</>);', pIdx);
  ok(wIdx > 0 && wBtn > wIdx && wBtn < wEnd && pIdx > 0 && pBtn > pIdx && pBtn < pEnd, 'both buttons sit inside the blocks shown only for a fire door / a pack with fire doors');
}

// ═════════════════════════════════════════════════════════════════════════════
section('6 - ezdxf: every file reads, audit() finds no error, the extents are finite');
{
  const probe = spawnSync('python3', ['-I', '-c', 'import ezdxf'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.log('SKIP  ezdxf is not installed for python3 (pip install ezdxf): the CAD read-back is not run');
  } else {
    // write the zip's files too, so every file a user can get is read back
    const windows = [REF, F60, DBL, DR].map((d) => ({ derived: d.derived, name: d.name }));
    const files = M.fexp.fireDoorDxfZipFiles(windows);
    const paths = Object.entries(files).map(([n, t]) => { const p = resolve(OUT, n.replace(/\//g, '__')); writeFileSync(p, t); return p; });
    const script = [
      'import sys, json, math, ezdxf',
      'from ezdxf import bbox',
      'for p in sys.argv[1:]:',
      '    try:',
      '        doc = ezdxf.readfile(p)',
      '        a = doc.audit()',
      '        msp = doc.modelspace()',
      '        e = bbox.extents(msp)',
      '        ext = [e.extmin.x, e.extmin.y, e.extmax.x, e.extmax.y] if e.has_data else None',
      '        print(json.dumps({"p": p, "errors": len(a.errors), "fixes": len(a.fixes), "n": len(msp), "ext": ext, "layers": len(doc.layers)}))',
      '    except Exception as ex:',
      '        print(json.dumps({"p": p, "exc": str(ex)}))',
    ].join('\n');
    const res = spawnSync('python3', ['-I', '-c', script, ...paths], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const rows = String(res.stdout || '').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const bad = rows.filter((x) => x.exc || x.errors !== 0 || !x.ext || !x.ext.every(Number.isFinite) || !(x.n > 50));
    ok(rows.length === paths.length && paths.length === 20 && bad.length === 0, `ezdxf reads all ${rows.length} files (4 doors x 5), audit() 0 errors, finite extents, every file drawn`, J(bad.slice(0, 3)));
    ok(rows.every((x) => x.fixes === 0), 'ezdxf audit() needed no fix in any file');
    const all = rows.find((x) => /FDR-01_firedoor\.dxf$/.test(x.p));
    ok(all && all.ext[2] - all.ext[0] > 826 + 902 + 2 * 100 && all.ext[3] - all.ext[1] > 2083, `FDR-01 all elements: extents ${all ? all.ext.map((v) => Math.round(v)).join(' ') : ''} (the row of four elements, the title block under it)`);
  }
}

console.log(`\nt53: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
