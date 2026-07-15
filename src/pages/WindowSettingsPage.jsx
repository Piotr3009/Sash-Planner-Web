import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import { kgPerM, VARIANT_ORDER } from '../engine/profile.js';
import { CONSTANTS, deriveWindowData } from '../engine/calculations.js';
import { normaliseToWindowSpec } from '../engine/specification.js';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import JambDetail2D from '../components/drawings/JambDetail2D.jsx';

// ─── Element metadata: engine names, groups, editable fields, length rules ───
const RAW_OPTIONS = ['63x63', '63x95'];

// ─── Section lock: everything locked on page open; unlock to edit (session-only, never persisted) ───
const LockClosedIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const LockOpenIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
);
function LockToggle({ locked, onToggle }) {
  return (
    <button type="button" onClick={onToggle} title={locked ? 'Unlock to edit' : 'Lock section'}
      className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-lg border transition-colors shrink-0 ${locked ? 'border-surface-500 text-ink-400 bg-surface-700 hover:bg-surface-600' : 'border-amber-500/60 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'}`}>
      {locked ? <LockClosedIcon /> : <LockOpenIcon />}
      {locked ? 'Locked' : 'Editing'}
    </button>
  );
}

const BOX_ELEMENTS = [
  { key: 'head',         name: 'Head',                  kind: 'board',  lenBase: 'W', dedKey: 'headWidth' },
  { key: 'jambs',        name: 'Jamb left / right',     kind: 'board',  lenBase: 'H', dedKey: 'jambHeight', qty: '×2' },
  { key: 'extHeadLiner', name: 'External head liner',   kind: 'liner',  lenBase: 'W', badge: 'ext' },
  { key: 'intHeadLiner', name: 'Internal head liner',   kind: 'liner',  lenBase: 'W', badge: 'int' },
  { key: 'extJambLiner', name: 'External jamb liner',   kind: 'liner',  lenBase: 'H', badge: 'ext', qty: '×2' },
  { key: 'intJambLiner', name: 'Internal jamb liner',   kind: 'liner',  lenBase: 'H', badge: 'int', qty: '×2' },
  { key: 'cill',         name: 'Cill',                  kind: 'cill',   lenBase: 'W+' },
  { key: 'cillNose',     name: 'Cill nose',             kind: 'cill',   lenBase: 'W+' },
];

const SASH_ELEMENTS = [
  { key: 'stiles',      name: 'Stiles top / bottom', kind: 'sash', lenBase: 'sashH', qty: '×4' },
  { key: 'topRail',     name: 'Top rail',            kind: 'sash', lenBase: 'sashW' },
  { key: 'meetingRail', name: 'Top / bottom meet rail', kind: 'sash', lenBase: 'sashW', qty: '×2' },
  { key: 'bottomRail',  name: 'Bottom rail',         kind: 'sash', lenBase: 'sashW' },
];

export default function WindowSettingsPage() {
  const { typeId } = useParams();
  const profile = useWindowProfileStore((s) => s.sash);
  const setVariantField = useWindowProfileStore((s) => s.setVariantField);
  const setElementField = useWindowProfileStore((s) => s.setElementField);
  const setDeduction = useWindowProfileStore((s) => s.setDeduction);
  const setCillTwoPiece = useWindowProfileStore((s) => s.setCillTwoPiece);
  const resetToDefaults = useWindowProfileStore((s) => s.resetToDefaults);

  const [variantKey, setVariantKey] = useState('standard');
  const [selected, setSelected] = useState('bottomRail');
  const [sampleW, setSampleW] = useState(1000);
  const [sampleH, setSampleH] = useState(1500);

  // Section locks — default locked on every page open
  const [variantLock, setVariantLock] = useState(true);
  const [elementLock, setElementLock] = useState(true);
  const [sillLock, setSillLock] = useState(true);
  const [fittingLock, setFittingLock] = useState(true);

  const variant = profile.variants[variantKey] || profile.variants.standard;
  const variantKeys = [
    ...VARIANT_ORDER.filter((k) => profile.variants[k]),
    ...Object.keys(profile.variants).filter((k) => !VARIANT_ORDER.includes(k)),
  ];
  const els = profile.elements;
  const ded = profile.deductions;
  const boardW = variant.boardWidth ?? (variant.boxDepth - (profile.boardInset ?? 23));

  // Live sample window for the technical drawings (recomputes with the profile)
  const sample = useMemo(() => {
    try {
      const item = {
        name: 'SAMPLE', width: Number(sampleW) || 1000, height: Number(sampleH) || 1500,
        frameType: variantKey, frameDepth: variant.boxDepth,
        sashType: 'double', glassType: variantKey === 'triple' ? 'triple' : 'double',
        upperBars: 'none', lowerBars: 'none', sameBars: true,
        showHorns: true, hornType: 'A', openingType: 'both',
      };
      const ws = normaliseToWindowSpec(item);
      return { ws, derived: deriveWindowData(ws) };
    } catch (err) {
      console.error('WindowSettings sample derive failed:', err);
      return null;
    }
  }, [sampleW, sampleH, variantKey, variant.boxDepth, profile]);

  // Live sample lengths
  const W = Number(sampleW) || 1000;
  const H = Number(sampleH) || 1500;
  const sashW = W - ded.sashWidth;
  const totalSashH = H - ded.sashHeight;
  const topSashH = Math.round((totalSashH - CONSTANTS.SASH_HEIGHT_DIFFERENCE) / 2);

  const lengthInfo = (el) => {
    switch (el.lenBase) {
      case 'W': return { rule: `frame W − ${ded[el.dedKey] ?? 0}`, val: W - (ded[el.dedKey] ?? 0) };
      case 'H': return { rule: `frame H − ${ded[el.dedKey] ?? 0}`, val: H - (ded[el.dedKey] ?? 0) };
      case 'W+': return { rule: 'frame W + extension', val: W };
      case 'sashW': return { rule: `frame W − ${ded.sashWidth}`, val: sashW };
      case 'sashH': return { rule: 'sash height (+ horn)', val: topSashH };
      default: return { rule: '—', val: 0 };
    }
  };
  const linerLength = (el) => {
    const d = els[el.key]?.deduction ?? 0;
    return el.lenBase === 'W'
      ? { rule: `frame W − ${d}`, val: W - d }
      : { rule: `frame H − ${d}`, val: H - d };
  };

  const sectionOf = (el) => {
    const e = els[el.key];
    if (el.kind === 'sash') return `${variant.sashDepth} × ${e.face}`;
    if (el.kind === 'board') return `${e.thickness} × ${boardW}`;
    return `${e.w} × ${e.h}`;
  };

  if (typeId === 'casement') {
    return <CasementSettings sampleW={sampleW} sampleH={sampleH} setSampleW={setSampleW} setSampleH={setSampleH} />;
  }
  if (typeId && typeId !== 'sash') {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-ink-50 mb-2">Window Settings</h1>
        <div className="text-sm text-ink-400">Profile for "{typeId}" is coming soon.</div>
      </div>
    );
  }

  const allElements = [...BOX_ELEMENTS, ...SASH_ELEMENTS];
  const sel = allElements.find((e) => e.key === selected) || SASH_ELEMENTS[3];
  const selData = els[sel.key];
  const selLen = sel.kind === 'liner' ? linerLength(sel) : lengthInfo(sel);
  const selKg = sel.kind === 'sash' ? kgPerM(selData.face, variant.sashDepth) : null;
  const isBoxSelected = BOX_ELEMENTS.some((e) => e.key === selected);

  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Window Settings — Sash</h1>
          <div className="text-xs text-ink-400">Finished sections and length rules · feeds cut lists, pre-cut, BOM and weights</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            Sample window:
            <input type="number" value={sampleW} onChange={(e) => setSampleW(num(e.target.value, 1000))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <input type="number" value={sampleH} onChange={(e) => setSampleH(num(e.target.value, 1500))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            mm
          </div>
          <button
            onClick={() => { if (window.confirm('Reset all sash profile values to defaults?')) resetToDefaults(); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-surface-500 text-ink-200 bg-surface-700 hover:bg-surface-600 transition-colors">
            Reset to defaults
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">
      {/* Variant tabs + variant fields */}
      <div className={`card p-4 mb-4 ${variantLock ? '' : 'ring-1 ring-amber-500/40'}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-1.5">
          {variantKeys.map((k) => { const v = profile.variants[k]; return (
            <button key={k} onClick={() => setVariantKey(k)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${variantKey === k ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>
              {v.label} · {v.boxDepth}
            </button>
          ); })}
          </div>
          <LockToggle locked={variantLock} onToggle={() => setVariantLock((x) => !x)} />
        </div>
        <fieldset disabled={variantLock} className={`flex flex-wrap gap-x-6 gap-y-2 items-end text-xs border-0 p-0 m-0 min-w-0 ${variantLock ? 'opacity-60' : ''}`}>
          <div>
            <div className="text-ink-400 mb-1">Variant name</div>
            <input type="text" value={variant.label}
              onChange={(e) => setVariantField(variantKey, 'label', e.target.value)}
              className="w-36 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Box depth (mm)</div>
            <input type="number" value={variant.boxDepth}
              onChange={(e) => setVariantField(variantKey, 'boxDepth', e.target.value)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Sash finished depth (mm)</div>
            <input type="number" value={variant.sashDepth}
              onChange={(e) => setVariantField(variantKey, 'sashDepth', e.target.value)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Head/Jamb board width (mm)</div>
            <input type="number" value={boardW}
              onChange={(e) => setVariantField(variantKey, 'boardWidth', e.target.value)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div className="text-ink-300 pb-1.5">
            <span className="text-ink-500">depth − board = {variant.boxDepth - boardW} mm</span>
          </div>
        </fieldset>
      </div>

      {/* ── BOX FRAME — parts, edit panel (when a box element is selected), window sill ── */}
      {/* Box frame parts */}
      <div className="text-sm font-semibold text-ink-50 mb-2">Box frame</div>
      <div className="flex gap-4 items-start mb-5 flex-wrap">
        <div className="flex-1 min-w-[280px] grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-1.5">
          {BOX_ELEMENTS.filter((el) => el.key !== 'cillNose' || profile.cillTwoPiece).map((el) => {
            const L = el.kind === 'liner' ? linerLength(el) : lengthInfo(el);
            const active = selected === el.key;
            return (
              <div key={el.key} onClick={() => setSelected(el.key)}
                className={`p-2 rounded-lg border cursor-pointer transition-all ${active ? 'border-accent-500 bg-accent-500/10' : 'border-surface-500 bg-surface-700/30 hover:bg-surface-700/60'}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[12px] font-medium truncate ${active ? 'text-accent-400' : 'text-ink-100'}`}>{el.name} {el.qty || ''}</span>
                  {el.badge && <span className={`text-[9px] px-1.5 rounded ${el.badge === 'ext' ? 'bg-accent-500/15 text-accent-400' : 'bg-surface-600 text-ink-300'}`}>{el.badge}</span>}
                </div>
                <div className="text-[11px] text-ink-400">{sectionOf(el)}</div>
                <div className="text-[11px] font-mono text-ink-300">L = {L.rule} <span className="text-ink-500">→ {L.val}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 items-stretch mb-6 flex-wrap">
        {isBoxSelected && (
          <>
<div className={`card p-4 flex-[1.5] min-w-[320px] ${elementLock ? '' : 'ring-1 ring-amber-500/40'}`}>
          <div className="flex justify-between items-baseline mb-3">
            <div><span className="text-[11px] text-ink-400">Selected: </span><span className="text-sm font-semibold text-ink-50">{sel.name}</span></div>
            <div className="flex items-center gap-2">
              {selKg !== null && <span className="text-[11px] text-ink-400">{selKg.toFixed(2)} kg/m auto</span>}
              <LockToggle locked={elementLock} onToggle={() => setElementLock((x) => !x)} />
            </div>
          </div>
          <fieldset disabled={elementLock} className={`flex flex-wrap gap-3 text-xs border-0 p-0 m-0 min-w-0 ${elementLock ? 'opacity-60' : ''}`}>
            {sel.kind === 'sash' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Depth (mm) · from variant</div>
                  <input value={variant.sashDepth} readOnly className="w-24 px-2 py-1.5 bg-surface-700 border border-surface-500 text-ink-400 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Face (mm)</div>
                  <input type="number" value={selData.face} onChange={(e) => setElementField(sel.key, 'face', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Raw stock</div>
                  <select value={selData.raw} onChange={(e) => setElementField(sel.key, 'raw', e.target.value)}
                    className="px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm">
                    {RAW_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}
            {sel.kind === 'board' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <input type="number" value={selData.thickness} onChange={(e) => setElementField(sel.key, 'thickness', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm) · box depth − inset</div>
                  <input value={boardW} readOnly className="w-24 px-2 py-1.5 bg-surface-700 border border-surface-500 text-ink-400 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <input type="number" value={ded[sel.dedKey]} onChange={(e) => setDeduction(sel.dedKey, e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              </>
            )}
            {sel.kind === 'liner' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <input type="number" value={selData.w} onChange={(e) => setElementField(sel.key, 'w', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <input type="number" value={selData.h} onChange={(e) => setElementField(sel.key, 'h', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <input type="number" value={selData.deduction} onChange={(e) => setElementField(sel.key, 'deduction', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              </>
            )}
            {sel.kind === 'cill' && (
              <>
                {/* Cill legacy fields: profile 'w' is the vertical HEIGHT, 'h' is the WIDTH
                    (see profile.js). Labels below bind flipped for 'cill'; cillNose unchanged. */}
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <input type="number" value={sel.key === 'cill' ? selData.h : selData.w}
                    onChange={(e) => setElementField(sel.key, sel.key === 'cill' ? 'h' : 'w', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Height (mm)</div>
                  <input type="number" value={sel.key === 'cill' ? selData.w : selData.h}
                    onChange={(e) => setElementField(sel.key, sel.key === 'cill' ? 'w' : 'h', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div className="text-ink-400 pt-5">Length = frame W + per-window extension</div>
              </>
            )}
          </fieldset>
          <div className="text-[11px] text-ink-500 mt-3 pt-2 border-t border-surface-500">
            = {selLen.val} mm for sample {W} × {H} · feeds cut list, pre-cut, BOM{sel.kind === 'sash' ? ', weights' : ''}
          </div>
        </div>
          </>
        )}
<div className={`card p-4 flex-1 min-w-[260px] flex flex-col justify-center gap-2 text-xs ${sillLock ? '' : 'ring-1 ring-amber-500/40'}`}>
          <div className="flex items-center justify-between">
            <div className="text-ink-400 font-medium">Window sill</div>
            <LockToggle locked={sillLock} onToggle={() => setSillLock((x) => !x)} />
          </div>
          <fieldset disabled={sillLock} className={`flex flex-col gap-2 border-0 p-0 m-0 min-w-0 ${sillLock ? 'opacity-60' : ''}`}>
          <label className={`flex items-center gap-2 text-ink-200 ${sillLock ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="radio" name="cillMode" checked={!profile.cillTwoPiece} onChange={() => setCillTwoPiece(false)} className="accent-accent-500" />
            One piece
          </label>
          <label className={`flex items-center gap-2 text-ink-200 ${sillLock ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="radio" name="cillMode" checked={profile.cillTwoPiece} onChange={() => setCillTwoPiece(true)} className="accent-accent-500" />
            Two piece (cill + nose)
          </label>
          </fieldset>
          <div className="text-[10px] text-ink-500">Affects cut list, pre-cut, BOM parts and drawings.</div>
        </div>
      </div>

      {/* ── SASH — parts, edit panel (when a sash element is selected), fitting deductions ── */}
      {/* Sash parts */}
      <div className="text-sm font-semibold text-ink-50 mb-2">Sash</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-1.5 mb-3">
        {SASH_ELEMENTS.map((el) => {
          const L = lengthInfo(el);
          const active = selected === el.key;
          return (
            <div key={el.key} onClick={() => setSelected(el.key)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${active ? 'border-accent-500 bg-accent-500/10' : 'border-surface-500 bg-surface-700/30 hover:bg-surface-700/60'}`}>
              <div className={`text-[12px] font-medium ${active ? 'text-accent-400' : 'text-ink-100'}`}>{el.name} {el.qty || ''}</div>
              <div className="text-[11px] text-ink-400">{sectionOf(el)}</div>
              <div className="text-[11px] font-mono text-ink-300">L = {L.rule} <span className="text-ink-500">→ {L.val}</span></div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 items-stretch mb-6 flex-wrap">
        {!isBoxSelected && (
          <>
<div className={`card p-4 flex-[1.5] min-w-[320px] ${elementLock ? '' : 'ring-1 ring-amber-500/40'}`}>
          <div className="flex justify-between items-baseline mb-3">
            <div><span className="text-[11px] text-ink-400">Selected: </span><span className="text-sm font-semibold text-ink-50">{sel.name}</span></div>
            <div className="flex items-center gap-2">
              {selKg !== null && <span className="text-[11px] text-ink-400">{selKg.toFixed(2)} kg/m auto</span>}
              <LockToggle locked={elementLock} onToggle={() => setElementLock((x) => !x)} />
            </div>
          </div>
          <fieldset disabled={elementLock} className={`flex flex-wrap gap-3 text-xs border-0 p-0 m-0 min-w-0 ${elementLock ? 'opacity-60' : ''}`}>
            {sel.kind === 'sash' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Depth (mm) · from variant</div>
                  <input value={variant.sashDepth} readOnly className="w-24 px-2 py-1.5 bg-surface-700 border border-surface-500 text-ink-400 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Face (mm)</div>
                  <input type="number" value={selData.face} onChange={(e) => setElementField(sel.key, 'face', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Raw stock</div>
                  <select value={selData.raw} onChange={(e) => setElementField(sel.key, 'raw', e.target.value)}
                    className="px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm">
                    {RAW_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}
            {sel.kind === 'board' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <input type="number" value={selData.thickness} onChange={(e) => setElementField(sel.key, 'thickness', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm) · box depth − inset</div>
                  <input value={boardW} readOnly className="w-24 px-2 py-1.5 bg-surface-700 border border-surface-500 text-ink-400 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <input type="number" value={ded[sel.dedKey]} onChange={(e) => setDeduction(sel.dedKey, e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              </>
            )}
            {sel.kind === 'liner' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <input type="number" value={selData.w} onChange={(e) => setElementField(sel.key, 'w', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <input type="number" value={selData.h} onChange={(e) => setElementField(sel.key, 'h', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <input type="number" value={selData.deduction} onChange={(e) => setElementField(sel.key, 'deduction', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              </>
            )}
            {sel.kind === 'cill' && (
              <>
                {/* Cill legacy fields: profile 'w' is the vertical HEIGHT, 'h' is the WIDTH
                    (see profile.js). Labels below bind flipped for 'cill'; cillNose unchanged. */}
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <input type="number" value={sel.key === 'cill' ? selData.h : selData.w}
                    onChange={(e) => setElementField(sel.key, sel.key === 'cill' ? 'h' : 'w', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Height (mm)</div>
                  <input type="number" value={sel.key === 'cill' ? selData.w : selData.h}
                    onChange={(e) => setElementField(sel.key, sel.key === 'cill' ? 'w' : 'h', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div className="text-ink-400 pt-5">Length = frame W + per-window extension</div>
              </>
            )}
          </fieldset>
          <div className="text-[11px] text-ink-500 mt-3 pt-2 border-t border-surface-500">
            = {selLen.val} mm for sample {W} × {H} · feeds cut list, pre-cut, BOM{sel.kind === 'sash' ? ', weights' : ''}
          </div>
        </div>
          </>
        )}
<div className={`card p-4 flex-1 min-w-[280px] border-amber-500/30 ${fittingLock ? '' : 'ring-1 ring-amber-500/60'}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-amber-400">Sash fitting — total deductions</div>
          <LockToggle locked={fittingLock} onToggle={() => setFittingLock((x) => !x)} />
        </div>
        <div className="text-[11px] text-ink-400 mb-3">These are coupled to jamb, liner and bead geometry. Changing them reshapes every window — verify with a test window before production.</div>
        <fieldset disabled={fittingLock} className={`flex flex-wrap gap-4 text-xs border-0 p-0 m-0 min-w-0 ${fittingLock ? 'opacity-60' : ''}`}>
          <div>
            <div className="text-ink-400 mb-1">Sash width = frame W −</div>
            <input type="number" value={ded.sashWidth} onChange={(e) => setDeduction('sashWidth', e.target.value)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Total sash height = frame H −</div>
            <input type="number" value={ded.sashHeight} onChange={(e) => setDeduction('sashHeight', e.target.value)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div className="text-ink-500 pt-5">Sample: sash {sashW} × {totalSashH} mm</div>
        </fieldset>
      </div>
      </div>

      {/* Summary table */}
      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-700 text-ink-400">
              <th className="px-4 py-2 text-left font-medium">Element</th>
              <th className="px-4 py-2 text-left font-medium">Finished ({variant.label})</th>
              <th className="px-4 py-2 text-left font-medium">Length rule</th>
              <th className="px-4 py-2 text-right font-medium">Sample</th>
              <th className="px-4 py-2 text-right font-medium">kg/m</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-surface-500 bg-surface-700/60">
              <td colSpan={5} className="px-4 py-1 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Box frame</td>
            </tr>
            {BOX_ELEMENTS.filter((el) => el.key !== 'cillNose' || profile.cillTwoPiece).map((el) => {
              const L = el.kind === 'liner' ? linerLength(el) : lengthInfo(el);
              const kg = el.kind === 'sash' ? kgPerM(els[el.key].face, variant.sashDepth).toFixed(2) : '—';
              const active = selected === el.key;
              return (
                <tr key={el.key} onClick={() => setSelected(el.key)}
                  className={`cursor-pointer border-t border-surface-500 ${active ? 'bg-accent-500/10 text-accent-400' : 'text-ink-200 hover:bg-surface-700/40'}`}>
                  <td className="px-4 py-1.5 font-medium">{el.name} {el.qty || ''}</td>
                  <td className="px-4 py-1.5">{sectionOf(el)}</td>
                  <td className="px-4 py-1.5 font-mono text-[11px]">{L.rule}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{L.val}</td>
                  <td className="px-4 py-1.5 text-right">{kg}</td>
                </tr>
              );
            })}
            <tr className="border-t border-surface-500 bg-surface-700/60">
              <td colSpan={5} className="px-4 py-1 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Sash</td>
            </tr>
            {SASH_ELEMENTS.map((el) => {
              const L = lengthInfo(el);
              const kg = kgPerM(els[el.key].face, variant.sashDepth).toFixed(2);
              const active = selected === el.key;
              return (
                <tr key={el.key} onClick={() => setSelected(el.key)}
                  className={`cursor-pointer border-t border-surface-500 ${active ? 'bg-accent-500/10 text-accent-400' : 'text-ink-200 hover:bg-surface-700/40'}`}>
                  <td className="px-4 py-1.5 font-medium">{el.name} {el.qty || ''}</td>
                  <td className="px-4 py-1.5">{sectionOf(el)}</td>
                  <td className="px-4 py-1.5 font-mono text-[11px]">{L.rule}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{L.val}</td>
                  <td className="px-4 py-1.5 text-right">{kg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-ink-500 mt-2">Defaults = OTD profile · glazing bars stay built-in · values apply to new calculations immediately</div>
        </div>

        <div className="flex-1 min-w-0 shrink-0 sticky top-4">
      {/* Technical drawings — click an element to edit it */}
      {sample && (
        <>
          <div className="text-sm font-semibold text-ink-50 mb-2">Drawings <span className="text-ink-500 font-normal text-xs">— {W} × {H} · {variant.label}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-2">
              <BoxDetail2D windowSpec={sample.ws} derived={sample.derived} view="external"
                selectedElement={selected} onElementClick={setSelected} />
            </div>
            <div className="card p-2">
              <BoxDetail2D windowSpec={sample.ws} derived={sample.derived} view="internal"
                selectedElement={selected} onElementClick={setSelected} />
            </div>
            <div className="card p-2">
              <SashDetail2D windowSpec={sample.ws} derived={sample.derived} type="upper"
                selectedElement={selected} onElementClick={setSelected} />
            </div>
            <div className="card p-2">
              <SashDetail2D windowSpec={sample.ws} derived={sample.derived} type="lower"
                selectedElement={selected} onElementClick={setSelected} />
            </div>
            <div className="card p-2 col-span-2 flex justify-center">
              <div className="w-[56%]">
                <JambDetail2D boardWidth={boardW} thickness={els.jambs.thickness}
                  selectedElement={selected} onElementClick={setSelected} />
              </div>
            </div>
          </div>
        </>
      )}

        </div>
      </div>
    </div>
  );
}

// ─── Casement profile (simple: outer frame + sash all round) ───
const CASEMENT_ELEMENT_DEFS = [
  { key: 'frameHead',  name: 'Frame head',       group: 'Frame', lenRule: (W, H) => ({ rule: 'frame W', val: W }) },
  { key: 'frameJamb',  name: 'Frame jambs ×2',   group: 'Frame', lenRule: (W, H, p) => ({ rule: `frame H − 2×${p.elements.frameHead.face}`, val: H - 2 * p.elements.frameHead.face }) },
  { key: 'frameCill',  name: 'Frame cill',       group: 'Frame', lenRule: (W) => ({ rule: 'frame W', val: W }) },
  { key: 'sashStile',  name: 'Sash stiles ×2',   group: 'Sash',  lenRule: (W, H, p) => ({ rule: `frame H − ${p.deductions.sashHeight}`, val: H - p.deductions.sashHeight }) },
  { key: 'sashTop',    name: 'Sash top rail',    group: 'Sash',  lenRule: (W, H, p) => ({ rule: `frame W − ${p.deductions.sashWidth}`, val: W - p.deductions.sashWidth }) },
  { key: 'sashBottom', name: 'Sash bottom rail', group: 'Sash',  lenRule: (W, H, p) => ({ rule: `frame W − ${p.deductions.sashWidth}`, val: W - p.deductions.sashWidth }) },
];

function CasementSettings({ sampleW, sampleH, setSampleW, setSampleH }) {
  const casement = useWindowProfileStore((s) => s.casement);
  const setEl = useWindowProfileStore((s) => s.setCasementElementField);
  const setDed = useWindowProfileStore((s) => s.setCasementDeduction);
  const setDepth = useWindowProfileStore((s) => s.setCasementDepth);
  const resetToDefaults = useWindowProfileStore((s) => s.resetToDefaults);
  const [selected, setSelected] = useState('sashBottom');

  // Section locks — default locked on every page open
  const [fieldsLock, setFieldsLock] = useState(true);
  const [elementLock, setElementLock] = useState(true);

  const W = Number(sampleW) || 1000;
  const H = Number(sampleH) || 1200;
  const sashW = W - casement.deductions.sashWidth;
  const sashH = H - casement.deductions.sashHeight;
  const glassW = sashW - casement.deductions.glassWidth;
  const glassH = sashH - casement.deductions.glassHeight;
  const sel = CASEMENT_ELEMENT_DEFS.find((e) => e.key === selected) || CASEMENT_ELEMENT_DEFS[0];
  const selData = casement.elements[sel.key];
  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Window Settings — Casement</h1>
          <div className="text-xs text-ink-400">Simple construction: outer frame + sash all round · mullions and transoms coming later</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            Sample window:
            <input type="number" value={sampleW} onChange={(e) => setSampleW(num(e.target.value, 1000))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <input type="number" value={sampleH} onChange={(e) => setSampleH(num(e.target.value, 1200))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            mm
          </div>
          <button
            onClick={() => { if (window.confirm('Reset sash AND casement profiles to defaults?')) resetToDefaults(); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-surface-500 text-ink-200 bg-surface-700 hover:bg-surface-600 transition-colors">
            Reset to defaults
          </button>
        </div>
      </div>

      <div className={`card p-4 mb-4 ${fieldsLock ? '' : 'ring-1 ring-amber-500/40'}`}>
        <div className="flex justify-end mb-2"><LockToggle locked={fieldsLock} onToggle={() => setFieldsLock((x) => !x)} /></div>
        <fieldset disabled={fieldsLock} className={`flex flex-wrap gap-x-6 gap-y-2 items-end text-xs border-0 p-0 m-0 min-w-0 ${fieldsLock ? 'opacity-60' : ''}`}>
        <div>
          <div className="text-ink-400 mb-1">Finished depth (mm) · all members</div>
          <input type="number" value={casement.depth} onChange={(e) => setDepth(e.target.value)}
            className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        </div>
        <div>
          <div className="text-ink-400 mb-1">Sash W = frame W −</div>
          <input type="number" value={casement.deductions.sashWidth} onChange={(e) => setDed('sashWidth', e.target.value)}
            className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        </div>
        <div>
          <div className="text-ink-400 mb-1">Sash H = frame H −</div>
          <input type="number" value={casement.deductions.sashHeight} onChange={(e) => setDed('sashHeight', e.target.value)}
            className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        </div>
        <div>
          <div className="text-ink-400 mb-1">Glass W = sash W −</div>
          <input type="number" value={casement.deductions.glassWidth} onChange={(e) => setDed('glassWidth', e.target.value)}
            className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        </div>
        <div>
          <div className="text-ink-400 mb-1">Glass H = sash H −</div>
          <input type="number" value={casement.deductions.glassHeight} onChange={(e) => setDed('glassHeight', e.target.value)}
            className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        </div>
        <div className="text-ink-300 pb-1.5">
          Sample: sash <span className="text-accent-400 font-medium">{sashW} × {sashH}</span> · glass <span className="text-accent-400 font-medium">{glassW} × {glassH}</span>
        </div>
        </fieldset>
      </div>

      <div className="flex gap-3 items-start flex-wrap">
        <div className="card overflow-hidden flex-1 min-w-[420px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-700 text-ink-400">
                <th className="px-4 py-2 text-left font-medium">Element</th>
                <th className="px-4 py-2 text-left font-medium">Finished</th>
                <th className="px-4 py-2 text-left font-medium">Length rule</th>
                <th className="px-4 py-2 text-right font-medium">Sample</th>
              </tr>
            </thead>
            <tbody>
              {CASEMENT_ELEMENT_DEFS.map((el) => {
                const L = el.lenRule(W, H, casement);
                const active = selected === el.key;
                const e = casement.elements[el.key];
                return (
                  <tr key={el.key} onClick={() => setSelected(el.key)}
                    className={`cursor-pointer border-t border-surface-500 ${active ? 'bg-accent-500/10 text-accent-400' : 'text-ink-200 hover:bg-surface-700/40'}`}>
                    <td className="px-4 py-1.5 font-medium">{el.name} <span className="text-ink-500 font-normal">({el.group})</span></td>
                    <td className="px-4 py-1.5">{casement.depth} × {e.face}</td>
                    <td className="px-4 py-1.5 font-mono text-[11px]">{L.rule}</td>
                    <td className="px-4 py-1.5 text-right font-mono">{L.val}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={`card p-4 w-[300px] shrink-0 ${elementLock ? '' : 'ring-1 ring-amber-500/40'}`}>
          <div className="mb-3 flex items-center justify-between">
            <div><span className="text-[11px] text-ink-400">Selected: </span><span className="text-sm font-semibold text-ink-50">{sel.name}</span></div>
            <LockToggle locked={elementLock} onToggle={() => setElementLock((x) => !x)} />
          </div>
          <fieldset disabled={elementLock} className={`flex flex-wrap gap-3 text-xs border-0 p-0 m-0 min-w-0 ${elementLock ? 'opacity-60' : ''}`}>
            <div>
              <div className="text-ink-400 mb-1">Face (mm)</div>
              <input type="number" value={selData.face} onChange={(e) => setEl(sel.key, 'face', e.target.value)}
                className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
            </div>
            <div>
              <div className="text-ink-400 mb-1">Raw stock</div>
              <select value={selData.raw} onChange={(e) => setEl(sel.key, 'raw', e.target.value)}
                className="px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm">
                {RAW_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </fieldset>
          <div className="text-[11px] text-ink-500 mt-3 pt-2 border-t border-surface-500">
            Feeds cut list, pre-cut and BOM for casement batches. Defaults are provisional — verify before production.
          </div>
        </div>
      </div>
    </div>
  );
}

