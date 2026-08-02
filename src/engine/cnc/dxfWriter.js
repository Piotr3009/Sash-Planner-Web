/**
 * dxfWriter.js — minimal, dependency-free DXF serialiser for the CNC module.
 *
 * Writes DXF R12 (AC1009) ASCII — deliberately the OLDEST mainstream dialect:
 * no handles, no subclass markers, no BLOCKS/OBJECTS sections, which is
 * exactly why every CAM package (VCarve included — their docs recommend R12)
 * swallows it. An earlier AC1015 attempt died in VCarve's strict parser on
 * the BLOCKS section (Piotr 02.08.2026), hence this downgrade.
 *
 * R12 has no LWPOLYLINE, so polylines are written as classic
 * POLYLINE + VERTEX(+bulge) + SEQEND — arcs survive intact.
 * Units: R12 has no $INSUNITS; coordinates are plain mm and VCarve's import
 * dialog confirms the unit once.
 *
 * Entity model (from jambDxf.js):
 *   { type:'poly', layer, closed, pts:[[x,y,bulge],...] }
 *   { type:'circle', layer, cx, cy, r }
 *   { type:'text', layer, x, y, h, str, rot, halign, valign }
 */

const fmt = (n) => {
  // Plain decimal, no exponent, trimmed — CAD readers dislike 1e-7 notation.
  const s = Number(n).toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

export function writeDxf(entities, layers) {
  const out = [];
  const put = (code, val) => { out.push(String(code), String(val)); };

  // ── HEADER ──
  put(0, 'SECTION'); put(2, 'HEADER');
  put(9, '$ACADVER'); put(1, 'AC1009');
  put(0, 'ENDSEC');

  // ── TABLES (layers only, R12 style) ──
  put(0, 'SECTION'); put(2, 'TABLES');
  put(0, 'TABLE'); put(2, 'LAYER'); put(70, layers.length + 1);
  const layerRow = (name, color) => {
    put(0, 'LAYER'); put(2, name); put(70, 0); put(62, color); put(6, 'CONTINUOUS');
  };
  layerRow('0', 7);
  for (const l of layers) layerRow(l.name, l.color);
  put(0, 'ENDTAB');
  put(0, 'ENDSEC');

  // ── ENTITIES ──
  put(0, 'SECTION'); put(2, 'ENTITIES');
  for (const e of entities) {
    if (e.type === 'poly') {
      put(0, 'POLYLINE'); put(8, e.layer);
      put(66, 1);                                 // vertices follow
      put(70, e.closed ? 1 : 0);
      put(10, 0); put(20, 0); put(30, 0);
      for (const [x, y, b] of e.pts) {
        put(0, 'VERTEX'); put(8, e.layer);
        put(10, fmt(x)); put(20, fmt(y)); put(30, 0);
        if (b) put(42, fmt(b));
      }
      put(0, 'SEQEND'); put(8, e.layer);
    } else if (e.type === 'circle') {
      put(0, 'CIRCLE'); put(8, e.layer);
      put(10, fmt(e.cx)); put(20, fmt(e.cy)); put(30, 0);
      put(40, fmt(e.r));
    } else if (e.type === 'text') {
      put(0, 'TEXT'); put(8, e.layer);
      put(10, fmt(e.x)); put(20, fmt(e.y)); put(30, 0);
      put(40, fmt(e.h)); put(1, e.str);
      if (e.rot) put(50, fmt(e.rot));
      put(72, e.halign ?? 0);
      put(11, fmt(e.x)); put(21, fmt(e.y)); put(31, 0);
      put(73, e.valign ?? 0);
    }
  }
  put(0, 'ENDSEC');
  put(0, 'EOF');
  return out.join('\r\n') + '\r\n';               // CRLF: what AutoCAD itself emits
}
