# Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
#
# This file is proprietary and confidential. Unauthorised copying,
# modification, distribution or use of this file, in whole or in part,
# by any means including automated tools and AI systems, is strictly
# prohibited without prior written permission from Skylon Development Ltd.
#
# winkhaus_dxf_outlines.py (24.10.2026): reads the Winkhaus product DXF files
# Piotr exported (AutoCAD 2018 DXF of the SolidWorks drawings) and writes
# src/engine/hardware/winkhausOutlines.js, the plate outlines the Lock
# Machining sheet draws. The DXF files themselves are Winkhaus drawings and
# stay out of the repo; the generated module carries only the simplified
# outlines (0.05 mm) in LEAF coordinates:
#   x  along the plate from its BOTTOM end (the end with the cylinder below
#      the spindle on the ThunderBolt; the lower shootbolt end on the slave)
#   y  across the plate, 0 to its width
# Run: python3 verify/tools/winkhaus_dxf_outlines.py <ThunderBolt 1770 radius.dxf> <FGTE slave LH 22.dxf>
#      (needs ezdxf: pip install ezdxf)
import sys, json, math
import ezdxf
from ezdxf import bbox, disassemble

OUT = 'src/engine/hardware/winkhausOutlines.js'
MIN_FEATURE = 1.0      # loops and circles smaller than this (rivets, witness marks) are dropped
ROUND = 0.05


def view_entities(msp, vx0, vx1, vy0, vy1):
    out = []
    for e in msp:
        if e.dxftype() not in ('LINE', 'ARC', 'CIRCLE', 'LWPOLYLINE', 'SPLINE', 'ELLIPSE'):
            continue
        b = bbox.extents([e], fast=True)
        if not b.has_data:
            continue
        if b.extmin.x >= vx0 - 0.6 and b.extmax.x <= vx1 + 0.6 and b.extmin.y >= vy0 - 0.6 and b.extmax.y <= vy1 + 0.6:
            out.append(e)
    return out


def key(p):
    return (round(p[0], 2), round(p[1], 2))


def chain(polys):
    """Join polylines whose ends meet (0.01) into longer runs / closed loops."""
    changed = True
    while changed:
        changed = False
        ends = {}
        for i, pl in enumerate(polys):
            ends.setdefault(key(pl[0]), []).append(i)
            ends.setdefault(key(pl[-1]), []).append(i)
        used = set()
        merged = []
        for i, pl in enumerate(polys):
            if i in used:
                continue
            cur = list(pl)
            used.add(i)
            grew = True
            while grew:
                grew = False
                for side in ('tail', 'head'):
                    k = key(cur[-1]) if side == 'tail' else key(cur[0])
                    cands = [j for j in ends.get(k, []) if j not in used]
                    if not cands:
                        continue
                    j = cands[0]
                    used.add(j)
                    seg = polys[j]
                    if side == 'tail':
                        cur = cur + (seg[1:] if key(seg[0]) == k else seg[::-1][1:])
                    else:
                        cur = (seg[::-1][:-1] if key(seg[-1]) == k else seg[:-1]) + cur if False else ((seg[::-1] if key(seg[0]) == k else seg)[:-1] + cur)
                    grew = True
                    changed = True
                    break
            merged.append(cur)
        polys = merged
    return polys


def extract(msp, vx0, vx1, vy0, vy1, tx, ty):
    """Polylines and circles of one drawing view, transformed by tx(x), ty(y)."""
    polys, circles = [], []
    for e in view_entities(msp, vx0, vx1, vy0, vy1):
        if e.dxftype() == 'CIRCLE':
            if e.dxf.radius >= MIN_FEATURE:
                circles.append((tx(e.dxf.center.x - vx0), ty(e.dxf.center.y - vy0), e.dxf.radius))
            continue
        try:
            vs = list(disassemble.make_primitive(e, max_flattening_distance=0.02).vertices())
        except Exception:
            continue
        pts = [(v.x - vx0, v.y - vy0) for v in vs]
        if len(pts) >= 2:
            polys.append(pts)
    polys = chain(polys)
    out = []
    for pl in polys:
        xs = [p[0] for p in pl]
        ys = [p[1] for p in pl]
        if max(xs) - min(xs) < MIN_FEATURE and max(ys) - min(ys) < MIN_FEATURE:
            continue
        pts = [(round(tx(x) / ROUND) * ROUND, round(ty(y) / ROUND) * ROUND) for x, y in pl]
        # drop repeated points
        clean = [pts[0]]
        for p in pts[1:]:
            if abs(p[0] - clean[-1][0]) > 1e-9 or abs(p[1] - clean[-1][1]) > 1e-9:
                clean.append(p)
        if len(clean) >= 2:
            out.append(clean)
    circles = [(round(cx / ROUND) * ROUND, round(cy / ROUND) * ROUND, round(r, 2)) for cx, cy, r in circles]
    return out, circles


def fmt_polys(polys):
    rows = []
    for pl in polys:
        rows.append('    [' + ', '.join(f'[{x:g}, {y:g}]' for x, y in pl) + '],')
    return '\n'.join(rows)


def fmt_circles(circles):
    return '\n'.join(f'    [{cx:g}, {cy:g}, {r:g}],' for cx, cy, r in sorted(circles))


def main(tb_path, slave_path):
    tb = ezdxf.readfile(tb_path).modelspace()
    # ThunderBolt T-FGAO2070 L29/45 92/8 D2: the plate face view is 1770 x 20 at
    # x 2198.75..3968.75, y 2189.67..2209.67 in the drawing; the drawing's right
    # end is the leaf BOTTOM (the cylinder below the spindle), so x = 1770 - x'.
    tb_polys, tb_circles = extract(tb, 2198.75, 3968.75, 2189.67, 2209.67, lambda x: 1770.0 - x, lambda y: y)
    sl = ezdxf.readfile(slave_path).modelspace()
    # FGTE slave strip G3 Stulpe TFTE 2062-9 92 MDE ls: the plate face view is
    # 1702.68 x 25 (the plate 20 plus the keep lever) at x 2148.66..3851.34,
    # y 1798.65..1823.65. Its RIGHT end is the leaf bottom: the slave lock
    # drawing (T-FGTE2062-908, same strip, same x) has the follower 783.18 from
    # the left end and the cylinder keyhole 92 to its right with the slot
    # pointing right (down), and the deadbolt keep window sits 70.6 right of
    # the follower where the master deadbolt is (70 below its spindle), the
    # latch keep 25.5 left. So x = 1702.68 - x' and the spindle is 919.5 above
    # the bottom end.
    sl_polys, sl_circles = extract(sl, 2148.66, 3851.34, 1798.65, 1823.65, lambda x: 1702.68 - x, lambda y: y)
    js = f"""/*
 * Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorised copying,
 * modification, distribution or use of this file, in whole or in part,
 * by any means including automated tools and AI systems, is strictly
 * prohibited without prior written permission from Skylon Development Ltd.
 */

// GENERATED by verify/tools/winkhaus_dxf_outlines.py (24.10.2026) from the
// Winkhaus product DXF drawings Piotr holds for his locks. Do not edit by hand:
// re-run the generator. The geometry is Winkhaus' (their drawings say so); it
// is here for the workshop's own Lock Machining sheet.
//
// Every outline is in LEAF coordinates (mm): x along the plate from its BOTTOM
// end, y across the plate from one long edge. `polys` are open or closed
// polylines ([x, y] points, arcs flattened to 0.02), `circles` [cx, cy, r].
// Features under {MIN_FEATURE} mm (rivets, witness marks) are left out.

/**
 * STV-ThunderBolt 2070/45 (T-FGAO2070 L29/45 92/8 D2): the 1770 x 20 x 3
 * faceplate, radius ends, seen from the leaf edge. The spindle (G) stands 906
 * above the bottom end; from the bottom end the double bolt openings are at
 * 134 to 171 and 1624 to 1661, the main deadbolt opening at 821 to 851, the
 * latch at 917 to 946, ten countersunk screw holes along the centre line.
 * `housings` are the bodies behind the plate (the DXF side and end views): x0,
 * x1 along the plate, depth from the plate face, thickness across the plate
 * (centred on the plate: the main case 15.1, the deadbolt housings 11.5), with
 * the bolt / latch throws. `holes` are the bores through the leaf at the
 * backset: the 8 mm follower square and the PZ cylinder profile 92 below it.
 */
export const THUNDERBOLT_PLATE = Object.freeze({{
  name: 'ThunderBolt 2070/45 faceplate 1770, radius ends',
  length: 1770, width: 20, thickness: 3, spindleFromBottom: 906,
  housings: [
    {{ key: 'bolt-bottom', x0: 89, x1: 182, depth: 44, thickness: 11.5, throws: [{{ x0: 134, x1: 171, out: 20.8, note: 'double deadbolt' }}] }},
    {{ key: 'main', x0: 788, x1: 966, depth: 63, thickness: 15.1, throws: [{{ x0: 821, x1: 851, out: 20, note: 'deadbolt' }}, {{ x0: 917, x1: 946, out: 10, note: 'latch' }}] }},
    {{ key: 'bolt-top', x0: 1579, x1: 1672, depth: 44, thickness: 11.5, throws: [{{ x0: 1624, x1: 1661, out: 20.8, note: 'double deadbolt' }}] }},
  ],
  holes: {{ follower: 8, cylinder: {{ radius: 8.5, slotWidth: 10, height: 33 }} }},
  rail: {{ width: 11.5, thickness: 2.2, clipsTo: 7.7 }},
  polys: [
{fmt_polys(tb_polys)}
  ],
  circles: [
{fmt_circles(tb_circles)}
  ],
}});

/**
 * FGTE slave faceplate strip (G3 Stulpe TFTE 2062-9 92 MDE, the 22 mm centre
 * line variant, LH drawing): 1702.68 x 20, the adjustable latch keep lever
 * reaching 25. The spindle stands 919.5 above the bottom end (the follower of
 * the matching slave lock drawing); the deadbolt keep window (40 x 11) is 70.6
 * below it, the latch keep window (40 x 9.5) 25.5 above it, the hook keep
 * boxes (113 x 18) at 108 to 221 and 1453 to 1566 from the bottom end, the
 * shootbolt guide blocks at the ends. The RH strip is the mirror image across
 * the plate (y = 20 - y).
 */
export const FGTE_SLAVE_STRIP = Object.freeze({{
  name: 'FGTE slave strip TFTE 2062-9, 22 mm centre line',
  length: 1702.68, width: 20, spindleFromBottom: 919.5,
  // the parts along the strip (from its bottom end), for the sheet's labels
  features: [
    {{ key: 'guide-bottom', x0: 0, x1: 18, note: 'shootbolt guide block' }},
    {{ key: 'hook-keep-lower', x0: 108.1, x1: 221.1, note: 'hook keep box 113 x 18' }},
    {{ key: 'deadbolt-keep', x0: 829.1, x1: 869.1, note: 'deadbolt keep window 40 x 11' }},
    {{ key: 'latch-keep', x0: 906.8, x1: 1018.7, note: 'adjustable latch keep (window 40 x 9.5 at 925.2 to 965.2)' }},
    {{ key: 'hook-keep-upper', x0: 1453.3, x1: 1566.3, note: 'hook keep box 113 x 18' }},
    {{ key: 'guide-top', x0: 1684.7, x1: 1702.7, note: 'shootbolt guide block' }},
  ],
  polys: [
{fmt_polys(sl_polys)}
  ],
  circles: [
{fmt_circles(sl_circles)}
  ],
}});
"""
    with open(OUT, 'w') as f:
        f.write(js)
    print(OUT, len(js), 'chars;', 'thunderbolt polys', len(tb_polys), 'circles', len(tb_circles), '; slave polys', len(sl_polys), 'circles', len(sl_circles))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
