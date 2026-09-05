#!/usr/bin/env python3
"""dxf_probe.py — read a DXF with ezdxf and print a JSON summary.

Used by verify/arch/t16.mjs for the DXF round-trip: layers, entity counts per
layer, every POLYLINE with its arc / straight length (from the bulges) and
bounding box, every TEXT. `pip install ezdxf --break-system-packages`.
"""
import json
import math
import sys

import ezdxf

doc = ezdxf.readfile(sys.argv[1])
msp = doc.modelspace()
layers = [layer.dxf.name for layer in doc.layers]
counts = {}
polys = []
texts = []
for e in msp:
    t = e.dxftype()
    layer = e.dxf.layer
    counts.setdefault(layer, {}).setdefault(t, 0)
    counts[layer][t] += 1
    if t == 'POLYLINE':
        pts = [(v.dxf.location.x, v.dxf.location.y, v.dxf.bulge) for v in e.vertices]
        closed = bool(e.is_closed)
        n = len(pts)
        arcs = 0.0
        straight = 0.0
        last = n if closed else n - 1
        for i in range(last):
            x0, y0, b = pts[i]
            x1, y1, _ = pts[(i + 1) % n]
            chord = math.hypot(x1 - x0, y1 - y0)
            if b:
                th = 4 * math.atan(abs(b))
                r = chord / (2 * math.sin(th / 2))
                arcs += r * th
            else:
                straight += chord
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        polys.append({'layer': layer, 'closed': closed, 'n': n, 'arcs': arcs, 'straight': straight,
                      'bbox': [min(xs), min(ys), max(xs), max(ys)],
                      'bulges': [p[2] for p in pts],
                      'pts': [[p[0], p[1]] for p in pts]})
    elif t == 'TEXT':
        texts.append({'layer': layer, 'text': e.dxf.text, 'x': e.dxf.insert.x, 'y': e.dxf.insert.y})
print(json.dumps({'version': doc.dxfversion, 'layers': layers, 'counts': counts, 'polys': polys, 'texts': texts}))
