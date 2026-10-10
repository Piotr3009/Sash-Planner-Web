/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

/**
 * textCollision.mjs: overlapping texts on a RENDERED sheet (doors v3, owner
 * box item 14, CLAUDE.md 3.15). Generic: it reads any SVG string the way the
 * harnesses render the sheets (react-dom/server renderToStaticMarkup) and
 * needs no knowledge of the sheet.
 *
 * Each <text> is approximated by a box:
 *   width   font-size x charWidth (0.55) x character count
 *   height  font-size, from 0.8 x font-size above the baseline to 0.2 below
 *   x       by text-anchor: start [x, x + w], middle [x - w / 2, x + w / 2],
 *           end [x - w, x]
 * A transform on the text (rotate(a, cx, cy) / rotate(a cx cy), translate)
 * maps the four corners; the box is the axis-aligned bounds of the mapped
 * corners (exact for the 90 degree rotations the sheets use: DimV, DimChainV
 * and the member labels write rotate(-90, x, y)).
 *
 * Two texts collide when their boxes overlap by more than `tol` x the smaller
 * font size in BOTH directions (default tol 0.02: touching boxes are no
 * collision). Empty texts are ignored.
 *
 *   textBoxes(svg, opts)          -> [{ i, str, x, y, size, anchor, transform, box: { x0, y0, x1, y1 } }]
 *   textCollisions(svg, opts)     -> [{ a, b, overlap: { w, h } }]  (a, b = textBoxes entries)
 *   collisionFailures(sheets, opts)
 *       sheets: { name: svg } or [[name, svg], ...]
 *       -> [{ sheet, a: str, b: str, overlap }]  one entry per colliding pair, every sheet
 *   describeFailures(failures, max) -> one line per failure (for a harness detail string)
 *
 * opts: { charWidth = 0.55, tol = 0.02, ascent = 0.8 }
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** The text content as printed: tags stripped, entities decoded. */
function decode(s) {
  return String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}

function attr(at, name) {
  const r = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(at);
  return r ? r[1] : null;
}

function numAttr(at, name, fallback = 0) {
  const v = attr(at, name);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse an SVG transform list into a point mapper (rotate and translate; others ignored). */
function transformOf(t) {
  if (!t) return (p) => p;
  const ops = [];
  const re = /(rotate|translate)\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(t))) {
    const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    ops.push({ op: m[1], a });
  }
  // SVG applies the list right to left to the point
  return ([px, py]) => {
    let x = px, y = py;
    for (let k = ops.length - 1; k >= 0; k -= 1) {
      const { op, a } = ops[k];
      if (op === 'translate') {
        x += a[0] || 0;
        y += a[1] || 0;
      } else {
        const ang = ((a[0] || 0) * Math.PI) / 180;
        const cx = a[1] || 0, cy = a[2] || 0;
        const c = Math.cos(ang), s = Math.sin(ang);
        const dx = x - cx, dy = y - cy;
        x = cx + dx * c - dy * s;
        y = cy + dx * s + dy * c;
      }
    }
    return [x, y];
  };
}

/** Every non-empty <text> of the sheet with its approximate box. */
export function textBoxes(svg, opts = {}) {
  const charWidth = opts.charWidth ?? 0.55;
  const ascent = opts.ascent ?? 0.8;
  const out = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m;
  let i = 0;
  while ((m = re.exec(String(svg)))) {
    const at = m[1];
    const str = decode(m[2]);
    if (!str.trim()) continue;
    const size = numAttr(at, 'font-size', 0);
    if (!(size > 0)) continue;
    const x = numAttr(at, 'x', 0);
    const y = numAttr(at, 'y', 0);
    const anchor = attr(at, 'text-anchor') || 'start';
    const w = size * charWidth * [...str].length;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    const y0 = y - ascent * size;
    const y1 = y + (1 - ascent) * size;
    const transform = attr(at, 'transform');
    const map = transformOf(transform);
    const pts = [[x0, y0], [x0 + w, y0], [x0 + w, y1], [x0, y1]].map(map);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    out.push({
      i, str, x, y, size, anchor, transform,
      box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    });
    i += 1;
  }
  return out;
}

/** The overlapping text pairs of one sheet. */
export function textCollisions(svg, opts = {}) {
  const tol = opts.tol ?? 0.02;
  const T = textBoxes(svg, opts);
  const pairs = [];
  for (let a = 0; a < T.length; a += 1) {
    for (let b = a + 1; b < T.length; b += 1) {
      const A = T[a].box, B = T[b].box;
      const w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
      const h = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      const lim = tol * Math.min(T[a].size, T[b].size);
      if (w > lim && h > lim) pairs.push({ a: T[a], b: T[b], overlap: { w, h } });
    }
  }
  return pairs;
}

/** Run textCollisions over a set of named sheets; one entry per colliding pair. */
export function collisionFailures(sheets, opts = {}) {
  const list = Array.isArray(sheets) ? sheets : Object.entries(sheets || {});
  const out = [];
  for (const [sheet, svg] of list) {
    for (const p of textCollisions(svg, opts)) {
      out.push({ sheet, a: p.a.str, b: p.b.str, overlap: p.overlap });
    }
  }
  return out;
}

/** One readable line per failure (at most `max`), for a harness detail string. */
export function describeFailures(failures, max = 12) {
  const lines = failures.slice(0, max).map((f) => `${f.sheet}: "${f.a}" x "${f.b}" (${f.overlap.w.toFixed(1)} x ${f.overlap.h.toFixed(1)})`);
  if (failures.length > max) lines.push(`... ${failures.length - max} more`);
  return lines.join(' | ');
}
