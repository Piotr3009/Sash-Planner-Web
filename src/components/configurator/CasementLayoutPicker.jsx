import { useMemo, useState, useEffect } from 'react';
import {
  casementLayoutDef,
  resolveCasementLayout,
  countCasementOpeners,
  LAYOUT_DEFAULTS,
  HIDDEN_DUPLICATES,
  DISPLAY_NAMES,
  CASEMENT_LAYOUT_CODES,
  CASEMENT_GEO_DEFAULTS,
  clampFanRatio,
} from '../../engine/casementLayouts.js';

/**
 * CasementLayoutPicker
 * Sidebar panel (lights filter + selected preview + open button) and the
 * two-step full-screen picker: step 1 = structural layout cards, step 2 =
 * click panes to set openers (side panes cycle fixed -> left -> right,
 * fanlight / top-hung panes toggle fixed / opens).
 *
 * Behaviour ported 1:1 from PSW js/casement-type-modal.js:
 * - structural duplicates hidden (codes stay valid engine-side)
 * - entering step 2 starts every pane at FIXED
 * - legacy boolean hinges normalised on entry (022 -> H022 map)
 * - proportions from LAYOUT_DEFAULTS unless re-editing the current code
 *
 * Props:
 *   layout          current layout code
 *   casementHinges  current opener overlay array or null
 *   dims            { w, h, fanMm, fan2Mm, middleMm } current inputs
 *   onApply(code, hingesArray)
 */

const GEO = CASEMENT_GEO_DEFAULTS;
const H022 = ['top', 'top', 'left', 'right'];

// Lights = vertical panes at the bottom tier: 1 + mullions reaching the frame
// bottom (full-height numbers, or partial mullions with touchesBottom).
function lightsForCode(code) {
  const d = LAYOUT_DEFAULTS[code] || { w: 1200, h: 1200 };
  const innerW = d.w - 2 * GEO.frameFace;
  const innerH = d.h - GEO.frameFace - GEO.bottomFace;
  const def = casementLayoutDef(code, innerW, innerH, d.h, 0.3, 0.3, 0);
  const bottomMullions = (def.mullions || []).filter(
    (m) => typeof m === 'number' || m.touchesBottom
  ).length;
  return bottomMullions + 1;
}

// Thumbnail SVG from real geometry — same simplification as the PSW modal:
// partial mullions draw full height in the mini preview (3D shows reality).
function LayoutThumb({ code, width, className = '' }) {
  const d = LAYOUT_DEFAULTS[code] || { w: 1200, h: 1200 };
  const innerW = d.w - 2 * GEO.frameFace;
  const innerH = d.h - GEO.frameFace - GEO.bottomFace;
  const def = casementLayoutDef(code, innerW, innerH, d.h, 0.3, 0.3, 0);
  const scale = width / d.w;
  const H = Math.round(d.h * scale);
  const fT = Math.max(2, GEO.frameFace * scale);
  const lines = [];
  (def.mullions || []).forEach((mu, i) => {
    const mx = (typeof mu === 'number' ? mu : mu.x) * scale;
    // Partial mullions (e.g. 031: only between the fans) draw their true
    // vertical extent; full-height numbers span the whole inner box.
    const y1 = typeof mu === 'number' ? fT : H - (mu.endY ?? d.h) * scale;
    const y2 = typeof mu === 'number' ? H - fT : H - mu.startY * scale;
    lines.push(<line key={`m${i}`} x1={mx} y1={Math.max(fT, y1)} x2={mx} y2={Math.min(H - fT, y2)} stroke="currentColor" strokeWidth="1.6" />);
  });
  (def.transoms || []).forEach((tr, i) => {
    const ty = typeof tr === 'number' ? tr : tr.y;
    const y = H - ty * scale;
    if (typeof tr === 'number' || tr.width === undefined) {
      lines.push(<line key={`t${i}`} x1={fT} y1={y} x2={width - fT} y2={y} stroke="currentColor" strokeWidth="1.6" />);
    } else {
      const cx = width / 2 + (tr.offsetX || 0) * scale;
      const hw = (tr.width * scale) / 2;
      lines.push(<line key={`t${i}`} x1={cx - hw} y1={y} x2={cx + hw} y2={y} stroke="currentColor" strokeWidth="1.6" />);
    }
  });
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className={className}>
      <rect x="1" y="1" width={width - 2} height={H - 2} fill="none" stroke="currentColor" strokeWidth="2" />
      {lines}
    </svg>
  );
}

// PSW modal semantics on entering step 2: everything starts FIXED unless a
// valid saved value exists for the SAME code.
function initialHinges(def, code, savedHinges, sameCode) {
  return def.panels.map((p, i) => {
    const v = sameCode && Array.isArray(savedHinges) ? savedHinges[i] : undefined;
    if (v === true) return code === '022' ? H022[i] : p.hinge;
    if (v === false) return 'fixed';
    if (v === 'fixed' || v === 'left' || v === 'right' || v === 'top') return v;
    return 'fixed';
  });
}

const visibleCodes = CASEMENT_LAYOUT_CODES.filter((c) => !HIDDEN_DUPLICATES[c]);

export default function CasementLayoutPicker({ layout, casementHinges, dims, onApply }) {
  const [open, setOpen] = useState(false);
  const [filterLights, setFilterLights] = useState(null);
  const [step2Code, setStep2Code] = useState(null);
  const [hinges, setHinges] = useState([]);

  const lightsByCode = useMemo(() => {
    const map = {};
    CASEMENT_LAYOUT_CODES.forEach((c) => { map[c] = lightsForCode(c); });
    return map;
  }, []);

  const buckets = useMemo(() => {
    const present = {};
    visibleCodes.forEach((c) => { present[lightsByCode[c] >= 4 ? 4 : lightsByCode[c]] = true; });
    return [1, 2, 3, 4].filter((b) => present[b]);
  }, [lightsByCode]);

  // Default the filter to the current selection's bucket
  useEffect(() => {
    if (filterLights === null && layout) {
      const l = lightsByCode[layout] || 1;
      setFilterLights(l >= 4 ? 4 : l);
    }
  }, [layout, filterLights, lightsByCode]);

  const cards = useMemo(() => visibleCodes.filter((c) => {
    if (filterLights === null) return true;
    if (filterLights === 4) return lightsByCode[c] >= 4;
    return lightsByCode[c] === filterLights;
  }), [filterLights, lightsByCode]);

  // Step 2 geometry: this layout's DEFAULT size unless re-editing the
  // currently selected layout (PSW currentGeometry rule).
  const step2 = useMemo(() => {
    if (!step2Code) return null;
    const sameCode = step2Code === layout;
    const dflt = LAYOUT_DEFAULTS[step2Code] || { w: 1200, h: 1500 };
    const w = sameCode ? (Number(dims?.w) || dflt.w) : dflt.w;
    const h = sameCode ? (Number(dims?.h) || dflt.h) : dflt.h;
    const innerW = w - 2 * GEO.frameFace;
    const innerH = h - GEO.frameFace - GEO.bottomFace;
    const FR = clampFanRatio(sameCode ? dims?.fanMm : 0, innerH);
    const FR2 = clampFanRatio(sameCode ? dims?.fan2Mm : 0, innerH);
    const mid = sameCode ? (Number(dims?.middleMm) || 0) : 0;
    const def = resolveCasementLayout({
      code: step2Code, innerW, innerH, height: h,
      fanlightRatio: FR, fan2Ratio: FR2, middleSectionMm: mid,
    });
    return { def, innerW, innerH, sameCode };
  }, [step2Code, layout, dims]);

  const openStep2 = (code) => {
    const sameCode = code === layout;
    const dflt = LAYOUT_DEFAULTS[code] || { w: 1200, h: 1500 };
    const w = sameCode ? (Number(dims?.w) || dflt.w) : dflt.w;
    const h = sameCode ? (Number(dims?.h) || dflt.h) : dflt.h;
    const innerW = w - 2 * GEO.frameFace;
    const innerH = h - GEO.frameFace - GEO.bottomFace;
    const FR = clampFanRatio(sameCode ? dims?.fanMm : 0, innerH);
    const FR2 = clampFanRatio(sameCode ? dims?.fan2Mm : 0, innerH);
    const def = resolveCasementLayout({
      code, innerW, innerH, height: h, fanlightRatio: FR, fan2Ratio: FR2,
      middleSectionMm: sameCode ? (Number(dims?.middleMm) || 0) : 0,
    });
    setHinges(initialHinges(def, code, casementHinges, sameCode));
    setStep2Code(code);
  };

  const cyclePane = (i) => {
    const role = step2.def.panels[i]._role === 'fan' ? 'fan' : 'side';
    setHinges((prev) => {
      const next = [...prev];
      const st = next[i];
      if (role === 'fan') next[i] = st === 'fixed' ? 'top' : 'fixed';
      else next[i] = st === 'fixed' ? 'left' : st === 'left' ? 'right' : 'fixed';
      return next;
    });
  };

  const apply = () => {
    onApply(step2Code, [...hinges]);
    setStep2Code(null);
    setOpen(false);
  };

  const selName = DISPLAY_NAMES[layout] || layout;
  const openerCount = useMemo(() => {
    const dflt = LAYOUT_DEFAULTS[layout] || { w: 1200, h: 1200 };
    const innerW = dflt.w - 2 * GEO.frameFace;
    const innerH = dflt.h - GEO.frameFace - GEO.bottomFace;
    const def = resolveCasementLayout({
      code: layout, innerW, innerH, height: dflt.h,
      fanlightRatio: 0.3, fan2Ratio: 0.3, casementHinges,
    });
    return countCasementOpeners(def);
  }, [layout, casementHinges]);

  return (
    <div>
      <div className="text-xs text-ink-400 font-medium mb-1">Number of lights <span className="text-ink-500">(vertical panes)</span></div>
      <div className="flex gap-1.5 mb-2">
        {buckets.map((b) => (
          <button key={b} onClick={() => { setFilterLights(b); setStep2Code(null); setOpen(true); }}
            className={`flex-1 px-2 py-1.5 text-[11px] rounded-lg border transition-all ${filterLights === b ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>
            {b === 4 ? '4+' : b}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 border border-surface-500 rounded-lg p-2 mb-2 bg-surface-800 text-ink-200">
        <LayoutThumb code={layout} width={30} />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-50">{layout}{selName !== layout && <span className="text-ink-400 font-normal"> · {selName}</span>}</div>
          <div className="text-[10px] text-ink-400">{lightsByCode[layout] >= 4 ? '4+' : lightsByCode[layout]} light{lightsByCode[layout] > 1 ? 's' : ''} · {openerCount} opening</div>
        </div>
      </div>
      <button onClick={() => { setStep2Code(null); setOpen(true); }}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-accent-500/15 border border-accent-500 text-accent-400 hover:bg-accent-500/25 transition-all">
        Choose window type
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5" onClick={() => setOpen(false)}>
          <div className="bg-surface-800 border border-surface-500 rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-500 bg-surface-900">
              <div>
                <div className="text-sm font-semibold text-ink-50">Choose window type</div>
                <div className="text-[11px] text-ink-400">
                  {step2Code
                    ? `Type ${step2Code} — choose which panes open`
                    : `${cards.length} type${cards.length !== 1 ? 's' : ''}${filterLights !== null ? ` — ${filterLights === 4 ? '4+' : filterLights} light${filterLights !== 1 ? 's' : ''}` : ''}`}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-surface-600 text-ink-200 hover:bg-status-danger hover:text-white transition-all">×</button>
            </div>

            {!step2Code && (
              <div className="p-4 overflow-y-auto grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {cards.map((c) => {
                  const name = DISPLAY_NAMES[c] || c;
                  return (
                    <div key={c} onClick={() => openStep2(c)}
                      className={`rounded-lg border p-3 text-center cursor-pointer transition-all text-ink-200 ${c === layout ? 'border-accent-500 bg-accent-500/10' : 'border-surface-500 bg-surface-700/30 hover:border-accent-500/50 hover:bg-surface-700/60'}`}>
                      <LayoutThumb code={c} width={84} className="mx-auto" />
                      <div className="text-sm font-semibold text-ink-50 mt-2">{name}</div>
                      {name !== c && <div className="text-[10px] text-ink-500">{c}</div>}
                      <div className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-surface-600 text-[10px] text-ink-300">Click → choose opening</div>
                    </div>
                  );
                })}
              </div>
            )}

            {step2Code && step2 && (
              <div className="p-4 overflow-y-auto flex flex-col items-center gap-3">
                <div className="text-[11px] text-ink-300 bg-surface-700/50 border border-surface-500 rounded-lg px-3 py-2 text-center">
                  Click a pane to set its opening. Side panes cycle <span className="text-accent-400 font-medium">Fixed → Left → Right</span>. Fanlights toggle <span className="text-accent-400 font-medium">Fixed / Opens</span>.
                </div>
                {(() => {
                  const g = step2;
                  const scale = Math.min(300 / g.innerW, 380 / g.innerH);
                  const m = 20, fT = 10;
                  const W = Math.round(g.innerW * scale) + 2 * m;
                  const H = Math.round(g.innerH * scale) + 2 * m;
                  const gcx = W / 2, gcy = H / 2;
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} width={W} className="max-w-full h-auto text-ink-300">
                      <rect x={m - fT} y={m - fT} width={W - 2 * m + 2 * fT} height={H - 2 * m + 2 * fT} fill="none" stroke="currentColor" strokeWidth="3" />
                      {(g.def.mullions || []).map((mu, i) => {
                        const mx = m + ((typeof mu === 'number' ? mu : mu.x) - GEO.frameFace) * scale;
                        return <line key={`m${i}`} x1={mx} y1={m} x2={mx} y2={H - m} stroke="currentColor" strokeWidth="3" />;
                      })}
                      {(g.def.transoms || []).map((tr, i) => {
                        const ty = typeof tr === 'number' ? tr : tr.y;
                        const y = H - m - (ty - GEO.bottomFace) * scale;
                        if (typeof tr === 'number' || tr.width === undefined) {
                          return <line key={`t${i}`} x1={m} y1={y} x2={W - m} y2={y} stroke="currentColor" strokeWidth="3" />;
                        }
                        const cx0 = m + (g.innerW / 2 + (tr.offsetX || 0)) * scale;
                        return <line key={`t${i}`} x1={cx0 - (tr.width * scale) / 2} y1={y} x2={cx0 + (tr.width * scale) / 2} y2={y} stroke="currentColor" strokeWidth="3" />;
                      })}
                      {g.def.panels.map((p, i) => {
                        const px = gcx + (p.x - p.w / 2) * scale;
                        const py = gcy - (p.y + p.h / 2) * scale;
                        const pw = p.w * scale, ph = p.h * scale;
                        const st = hinges[i];
                        const isOpen = st !== 'fixed';
                        let tri = '';
                        if (st === 'top') tri = `M ${px} ${py} L ${px + pw / 2} ${py + ph} L ${px + pw} ${py}`;
                        if (st === 'left') tri = `M ${px + pw} ${py} L ${px} ${py + ph / 2} L ${px + pw} ${py + ph}`;
                        if (st === 'right') tri = `M ${px} ${py} L ${px + pw} ${py + ph / 2} L ${px} ${py + ph}`;
                        const lbl = st === 'fixed' ? 'FIXED' : st === 'top' ? 'OPENS' : st.toUpperCase();
                        const fs = Math.max(10, Math.min(13, pw / 6));
                        return (
                          <g key={`p${i}`} onClick={() => cyclePane(i)} className="cursor-pointer">
                            <rect x={px} y={py} width={pw} height={ph}
                              fill={isOpen ? 'rgba(56,138,221,0.18)' : 'rgba(255,255,255,0.03)'}
                              stroke="currentColor" strokeWidth="1.5" className="transition-all hover:opacity-80" />
                            {isOpen && <path d={tri} fill="none" stroke="#7cb5ec" strokeWidth="1.4" strokeDasharray="6 4" />}
                            <text x={px + pw / 2} y={py + ph / 2 + fs * 0.35} textAnchor="middle" fontSize={fs}
                              fill={isOpen ? '#7cb5ec' : '#8a93a6'} fontWeight={isOpen ? 600 : 400}>{lbl}</text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
                <div className="flex gap-2.5">
                  <button onClick={() => setStep2Code(null)}
                    className="px-5 py-2 text-xs rounded-lg border border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500 transition-all">← Back</button>
                  <button onClick={apply}
                    className="px-5 py-2 text-xs font-medium rounded-lg bg-accent-500 text-white hover:bg-accent-400 transition-all">Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
