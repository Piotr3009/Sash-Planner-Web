import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import { kgPerM, VARIANT_ORDER } from '../engine/profile.js';
import NumInput from '../components/NumInput.jsx';
import { CONSTANTS, deriveWindowData } from '../engine/calculations.js';
import { buildArchPlan, ArchError } from '../engine/arch.js';
import { normaliseToWindowSpec } from '../engine/specification.js';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import JambDetail2D from '../components/drawings/JambDetail2D.jsx';
import CasementElevation2D from '../components/drawings/CasementElevation2D.jsx';
import CasementFrameDetail2D from '../components/drawings/CasementFrameDetail2D.jsx';
import CasementLeafDetail2D from '../components/drawings/CasementLeafDetail2D.jsx';
import CasementSection2D from '../components/drawings/CasementSection2D.jsx';
import { groupCasementLeaves } from '../components/drawings/casementDrawUtils.js';

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
  const setHornExtension = useWindowProfileStore((s) => s.setHornExtension);
  const setGlassMakeup = useWindowProfileStore((s) => s.setGlassMakeup);
  const setCillTwoPiece = useWindowProfileStore((s) => s.setCillTwoPiece);
  const resetToDefaults = useWindowProfileStore((s) => s.resetToDefaults);

  const [variantKey, setVariantKey] = useState('standard');
  const [selected, setSelected] = useState('bottomRail');
  // frame variant -> glass type it drives (engine convention)
  const VARIANT_TO_GLASS = { standard: 'double', slim: 'double_slim', triple: 'triple', heritage: 'single' };
  const GLASS_TYPE_LABEL = { double: 'double glazing', double_slim: 'double slim glazing', triple: 'triple glazing', single: 'single glazing', passive: 'passive (vacuum)' };
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
  const totalSashH = H - ded.sashHeight + (Number(profile.elements?.meetingRail?.face) || 43);
  const sashDiff = (Number(profile.elements?.bottomRail?.face) || 90) - (Number(profile.elements?.topRail?.face) || 57);
  const topSashH = Math.round((totalSashH - sashDiff) / 2);
  const hornExt = Number(profile.hornExtension) || 70;

  const lengthInfo = (el) => {
    switch (el.lenBase) {
      case 'W': return { rule: `frame W − ${ded[el.dedKey] ?? 0}`, val: W - (ded[el.dedKey] ?? 0) };
      case 'H': return { rule: `frame H − ${ded[el.dedKey] ?? 0}`, val: H - (ded[el.dedKey] ?? 0) };
      case 'W+': return { rule: 'frame W + extension', val: W };
      case 'sashW': return { rule: `frame W − ${ded.sashWidth}`, val: sashW };
      case 'sashH': return { rule: `sash height (+ ${hornExt} horn = ${topSashH + hornExt})`, val: topSashH };
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
            <NumInput value={sampleW} onCommit={(v) => setSampleW(num(v, 1000))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <NumInput value={sampleH} onCommit={(v) => setSampleH(num(v, 1500))}
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
            <NumInput value={variant.boxDepth}
              onCommit={(v) => setVariantField(variantKey, 'boxDepth', v)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Sash finished depth (mm)</div>
            <NumInput value={variant.sashDepth}
              onCommit={(v) => setVariantField(variantKey, 'sashDepth', v)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Head/Jamb board width (mm)</div>
            <NumInput value={boardW}
              onCommit={(v) => setVariantField(variantKey, 'boardWidth', v)}
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
                  <NumInput value={selData.face} onCommit={(v) => setElementField(sel.key, 'face', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                {/* Raw stock select hidden — raw size belongs to the assigned material
                    (TODO: pre-cut raw from Assign Materials); engine keeps using stored profile raw. */}
                {sel.key === 'stiles' && (
                  <div>
                    <div className="text-ink-400 mb-1">Horn extension (mm)</div>
                    <NumInput value={profile.hornExtension ?? 70}
                      onCommit={(v) => setHornExtension(v)}
                      className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                  </div>
                )}
              </>
            )}
            {sel.kind === 'board' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <NumInput value={selData.thickness} onCommit={(v) => setElementField(sel.key, 'thickness', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm) · box depth − inset</div>
                  <input value={boardW} readOnly className="w-24 px-2 py-1.5 bg-surface-700 border border-surface-500 text-ink-400 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <NumInput value={ded[sel.dedKey]} onCommit={(v) => setDeduction(sel.dedKey, v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              </>
            )}
            {sel.kind === 'liner' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <NumInput value={selData.w} onCommit={(v) => setElementField(sel.key, 'w', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <NumInput value={selData.h} onCommit={(v) => setElementField(sel.key, 'h', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <NumInput value={selData.deduction} onCommit={(v) => setElementField(sel.key, 'deduction', v)}
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
                  <NumInput value={sel.key === 'cill' ? selData.h : selData.w}
                    onCommit={(v) => setElementField(sel.key, sel.key === 'cill' ? 'h' : 'w', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Height (mm)</div>
                  <NumInput value={sel.key === 'cill' ? selData.w : selData.h}
                    onCommit={(v) => setElementField(sel.key, sel.key === 'cill' ? 'w' : 'h', v)}
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
        <div onClick={() => setSelected('glassMakeup')}
          className={`p-2 rounded-lg border cursor-pointer transition-all ${selected === 'glassMakeup' ? 'border-blue-400 bg-blue-500/15' : 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10'}`}>
          <div className={`text-[12px] font-medium ${selected === 'glassMakeup' ? 'text-blue-300' : 'text-blue-400'}`}>Glass</div>
          <div className="text-[11px] text-blue-500/80">makeup per variant</div>
          <div className="text-[11px] font-mono text-ink-300">{(profile.glassMakeup || {})[VARIANT_TO_GLASS[variantKey] || 'double'] || '—'}</div>
        </div>
      </div>

      <div className="flex gap-3 items-stretch mb-6 flex-wrap">
        {selected === 'glassMakeup' && (() => {
          const gType = VARIANT_TO_GLASS[variantKey] || 'double';
          const val = (profile.glassMakeup || {})[gType] ?? '';
          const nums = String(val).split(/[^0-9.]+/).map(Number).filter((n) => n > 0);
          const sum = nums.length >= 2 ? nums.reduce((a, b) => a + b, 0) : null;
          return (
            <div className="card p-4 mb-3 border border-blue-500/40 bg-blue-500/5">
              <div className="flex justify-between items-baseline mb-1">
                <div className="text-sm font-semibold text-blue-300">Glass — {profile.variants?.[variantKey]?.label || variantKey}</div>
                <LockToggle locked={elementLock} onToggle={() => setElementLock((x) => !x)} />
              </div>
              <div className="text-[11px] text-ink-400 mb-3">Free text · printed on glass orders · no effect on sizes or weights · spacer is chosen per window</div>
              <fieldset disabled={elementLock} className={`border-0 p-0 m-0 ${elementLock ? 'opacity-60' : ''}`}>
                <div className="text-[11px] text-ink-400 mb-1">Makeup (mm)</div>
                <input type="text" value={val}
                  onChange={(e) => setGlassMakeup(gType, e.target.value)}
                  className="px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm font-mono w-[200px]" />
                <div className="text-[11px] text-ink-300 mt-2">{GLASS_TYPE_LABEL[gType]}{sum ? <span className="text-blue-300"> · {sum} mm</span> : null}</div>
              </fieldset>
            </div>
          );
        })()}

        {!isBoxSelected && selected !== 'glassMakeup' && (
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
                  <NumInput value={selData.face} onCommit={(v) => setElementField(sel.key, 'face', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                {/* Raw stock select hidden — raw size belongs to the assigned material
                    (TODO: pre-cut raw from Assign Materials); engine keeps using stored profile raw. */}
                {sel.key === 'stiles' && (
                  <div>
                    <div className="text-ink-400 mb-1">Horn extension (mm)</div>
                    <NumInput value={profile.hornExtension ?? 70}
                      onCommit={(v) => setHornExtension(v)}
                      className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                  </div>
                )}
              </>
            )}
            {sel.kind === 'board' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <NumInput value={selData.thickness} onCommit={(v) => setElementField(sel.key, 'thickness', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm) · box depth − inset</div>
                  <input value={boardW} readOnly className="w-24 px-2 py-1.5 bg-surface-700 border border-surface-500 text-ink-400 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <NumInput value={ded[sel.dedKey]} onCommit={(v) => setDeduction(sel.dedKey, v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              </>
            )}
            {sel.kind === 'liner' && (
              <>
                <div>
                  <div className="text-ink-400 mb-1">Thickness (mm)</div>
                  <NumInput value={selData.w} onCommit={(v) => setElementField(sel.key, 'w', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <NumInput value={selData.h} onCommit={(v) => setElementField(sel.key, 'h', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Length deduction (mm)</div>
                  <NumInput value={selData.deduction} onCommit={(v) => setElementField(sel.key, 'deduction', v)}
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
                  <NumInput value={sel.key === 'cill' ? selData.h : selData.w}
                    onCommit={(v) => setElementField(sel.key, sel.key === 'cill' ? 'h' : 'w', v)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Height (mm)</div>
                  <NumInput value={sel.key === 'cill' ? selData.w : selData.h}
                    onCommit={(v) => setElementField(sel.key, sel.key === 'cill' ? 'w' : 'h', v)}
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
            <NumInput value={ded.sashWidth} onCommit={(v) => setDeduction('sashWidth', v)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div>
            <div className="text-ink-400 mb-1">Opening deduction · total sash H = frame H − this + MR</div>
            <NumInput value={ded.sashHeight} onCommit={(v) => setDeduction('sashHeight', v)}
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
      {/* TEMP DEBUG — glass source comparison; remove after verifying vs real OTD glass orders */}
      {sample?.derived && (() => {
        const f = {
          stile: Number(profile.elements?.stiles?.face) || 57,
          top: Number(profile.elements?.topRail?.face) || 57,
          meet: Number(profile.elements?.meetingRail?.face) || 43,
          bottom: Number(profile.elements?.bottomRail?.face) || 90,
        };
        const d = sample.derived;
        const gU = d.topSashHeight - f.top - f.meet;
        const gL = d.bottomSashHeight - f.meet - f.bottom;
        const gw = d.sashWidth - 2 * f.stile;
        // sealed unit = clear light + 2×rebate(12.5) per axis — same numbers as Glass Schedule
        const uW = gw + 25;
        const uH = gU + 25;
        return (
          <div className="text-[11px] text-amber-400 mt-1">
            TEMP · clear light: US {gw} × {gU} · LS {gw} × {gL} {gU === gL ? '(equal ✓)' : '(NOT EQUAL ✗)'} · sealed unit: {uW} × {uH}
          </div>
        );
      })()}
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
// ─── Casement v1.1 settings — same skeleton as the sash page: editable cards
// on the left, LIVE technical drawings on the right (built from the engine, so
// every field below reshapes them instantly). Raw stock is NOT set here — it
// comes exclusively from Part Registry.
// Every member carries its own cut deduction, exactly like the sash page:
// `L = <base> − [field]`. Defaults are 0 (T&G runs the full dimension), so
// nothing changes until a workshop types its own number.
const CAS_FRAME_ROWS = [
  { key: 'frameHead', drawKey: 'head',      name: 'Frame head', depth: 'frame',
    base: 'frame W', lenKey: 'headDeduct', sample: (W, H, p) => W - p.lengths.headDeduct },
  { key: 'frameJamb', drawKey: 'frameJamb', name: 'Frame jamb', qty: '×2', depth: 'frame',
    base: 'frame H', lenKey: 'jambDeduct', sample: (W, H, p) => H - p.lengths.jambDeduct },
  { key: 'frameCill', drawKey: 'cill',      name: 'Frame cill', depth: 'frame',
    base: 'frame W + ext', lenKey: 'cillDeduct', sample: (W, H, p) => W - p.lengths.cillDeduct },
  { key: 'mullion',   drawKey: 'mullion',   name: 'Mullion', depth: 'frame',
    base: 'frame H', lenKey: 'mullion', sample: (W, H, p) => H - p.lengths.mullion },
  { key: 'transom',   drawKey: 'transom',   name: 'Transom', depth: 'frame',
    base: 'field leaf W', lenKey: 'transomSeat', sign: '+', sample: () => null },
];
const CAS_LEAF_ROWS = [
  { key: 'leafStile', drawKey: 'leafStile', name: 'Stiles', qty: '×2', depth: 'leaf',
    base: 'leaf H', lenKey: 'stileDeduct', sampleLeaf: 'H' },
  { key: 'leafTop', drawKey: 'leafTopRail', name: 'Top rail', depth: 'leaf',
    base: 'leaf W', lenKey: 'topRailDeduct', sampleLeaf: 'W' },
  { key: 'leafBottom', drawKey: 'leafBottomRail', name: 'Bottom rail', depth: 'leaf',
    base: 'leaf W', lenKey: 'bottomRailDeduct', sampleLeaf: 'W' },
];
// Drawing element key → settings row key (click a drawing, select the card).
const CAS_DRAW_TO_ROW = {
  head: 'frameHead', frameJamb: 'frameJamb', cill: 'frameCill',
  mullion: 'mullion', transom: 'transom',
  leafStile: 'leafStile', leafTopRail: 'leafTop', leafBottomRail: 'leafBottom',
};

// One rule row: value input + live composition hint (✓ when the geometry adds
// up, ✗ when a land/gap changed in Advanced and this rule no longer matches —
// nothing shifts silently; the workshop decides which number wins).
function RuleField({ label, value, onCommit, hint, hintVal, sample }) {
  const ok = hintVal === value;
  return (
    <div>
      <div className="text-ink-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <NumInput value={value} onCommit={onCommit}
          className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        {hint && (
          <span className={`text-[10px] ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>
            = {hint} = {hintVal} {ok ? '✓' : '✗'}
          </span>
        )}
        {sample != null && <span className="text-[10px] text-ink-500">sample {sample}</span>}
      </div>
    </div>
  );
}

// Comma-list input for the stock widths (v4 C.7): keeps its own text while
// typing, commits on blur / Enter, re-syncs from the profile when not focused.
function ListInput({ value, onCommit, ...rest }) {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  const [draft, setDraft] = useState(text);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(text); }, [text]);
  return (
    <input type="text" value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { focused.current = false; onCommit(draft); setDraft(text); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      {...rest} />
  );
}

// One numeric field of the CNC & arches card (v4 C.7): label + NumInput on a profile path.
function PathField({ label, value, onCommit, hint }) {
  return (
    <div>
      <div className="text-ink-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <NumInput value={value} onCommit={onCommit}
          className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
        {hint && <span className="text-[10px] text-ink-500">{hint}</span>}
      </div>
    </div>
  );
}

function CasementSettings({ sampleW, sampleH, setSampleW, setSampleH }) {
  const casement = useWindowProfileStore((s) => s.casement);
  const setEl = useWindowProfileStore((s) => s.setCasementElementField);
  const setDed = useWindowProfileStore((s) => s.setCasementDeduction);
  const setTop = useWindowProfileStore((s) => s.setCasementTopField);
  const setGeo = useWindowProfileStore((s) => s.setCasementGeometry);
  const setLen = useWindowProfileStore((s) => s.setCasementLength);
  const setLeafFace = useWindowProfileStore((s) => s.setCasementLeafFace);
  const setPath = useWindowProfileStore((s) => s.setCasementPath);
  const setStockWidths = useWindowProfileStore((s) => s.setCasementStockWidths);
  const resetToDefaults = useWindowProfileStore((s) => s.resetToDefaults);
  const [selected, setSelected] = useState('leaf');
  const [cncLock, setCncLock] = useState(true);
  const [depthLock, setDepthLock] = useState(true);
  const [elementLock, setElementLock] = useState(true);
  const [frameLock, setFrameLock] = useState(true);
  const [leafLock, setLeafLock] = useState(true);
  const [rulesLock, setRulesLock] = useState(true);
  const [advLock, setAdvLock] = useState(true);

  const p = casement;
  const g = p.geometry, d = p.deductions, L = p.lengths;
  const W = Number(sampleW) || 1000;
  const H = Number(sampleH) || 1500;
  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);

  // Sample window: 021 "1 Light + Fanlight" (Piotr 04.08) — single leaf WITH a
  // fan, so frame, transom, leaf and cill are all visible on the drawings.
  const sample = useMemo(() => {
    try {
      const item = {
        name: 'SAMPLE', width: W, height: H,
        // 022 "2 Lights + Fanlights" (Piotr 04.08): the only sample that shows
        // mullion, transom, fans AND main leaves at once, so every settings
        // card has something to highlight on the drawings.
        windowCategory: 'casement', casementLayout: '022',
        glassType: 'double', frameType: 'standard',
      };
      const ws = normaliseToWindowSpec(item);
      return { ws, derived: deriveWindowData(ws) };
    } catch (err) {
      console.error('WindowSettings casement sample derive failed:', err);
      return null;
    }
  }, [W, H, p]);

  // v4 C.7: the CNC & arches card validates itself on a sample arch — a
  // semi-circle at the sample width (height = rise + the straight minimum +
  // 100, always inside the limits) planned with the live profile. The
  // planner's readable ArchError / no-plan reasons are the validation message.
  const archValidation = useMemo(() => {
    if (!p.arch || !p.cnc) return { ok: false, text: 'Profile has no arch / cnc block — reload the page to migrate it' };
    try {
      const plan = buildArchPlan({ shape: 'semi-circle', width: W, height: W / 2 + Number(p.arch.limits?.minStraightBelowRise || 0) + 100, hinge: 'left' }, p);
      const line = (label, pl) => {
        if (pl.noStock) return `${label}: ${pl.reasons.join('; ')}`;
        return `${label} ${pl.arcs.map((a) => `${a.default.n} × ${a.default.stock}${a.rule === 'economy' ? ' (economy)' : ''}`).join(' + ')}`;
      };
      return { ok: !plan.noStock, text: `Sample semi-circle W${W}: ${line('frame head', plan.plans.frameHead)} · ${line('leaf top', plan.plans.leafTop)}` };
    } catch (err) {
      return { ok: false, text: err instanceof ArchError ? err.message : String(err?.message || err) };
    }
  }, [W, p]);

  // Leaf Detail must show the MAIN leaf, not the fan (groups[0] is the fan in
  // fanlight layouts) — the main light is what the settings describe.
  const leafGroups = sample?.derived ? groupCasementLeaves(sample.derived) : [];
  const leafGroup = leafGroups.find((g) => g.role === 'Main')
    || leafGroups.find((g) => g.role === 'Leaf')
    || leafGroups.find((g) => !String(g.role).startsWith('Fan'))
    || leafGroups[0] || null;

  // Live samples for a single-leaf window of the sample size.
  const leafW = W - 2 * d.leafAtJamb;
  const leafH = H - d.leafFullHeight;
  // Glass follows the leaf member face — same formula as the engine.
  const glassDed = Math.round(2 * (p.elements.leafStile.face - g.glassInset) * 10) / 10;
  const glassW = leafW - glassDed;
  const glassH = leafH - glassDed;

  // Composition hints (geometry → expected rule value):
  const hJ = g.land + g.gap;
  const hMA = g.mullionLand / 2 + g.gap;
  const hFull = g.land + g.gap + g.gapCill + g.cillVisible;
  const hFan = g.land + g.gap + g.gapFanTransom + g.transomLandAbove;
  const hLow = g.transomLandBelow + g.gap + g.gapCill + g.cillVisible;

  const allRows = [...CAS_FRAME_ROWS, ...CAS_LEAF_ROWS];
  const sel = allRows.find((r) => r.key === selected) || allRows[0];
  const isLeafRow = sel.depth === 'leaf';
  const selFace = isLeafRow ? p.elements.leafStile.face : p.elements[sel.key].face;
  const commitFace = (v) => (isLeafRow ? setLeafFace(v) : setEl(sel.key, 'face', v));
  const depthOf = (r) => (r.depth === 'leaf' ? p.leafDepth : p.frameDepth);
  // Drawings report their own element keys — translate to the selected card.
  const pickFromDrawing = (k) => setSelected(CAS_DRAW_TO_ROW[k] || k);
  const drawSel = sel.drawKey;

  const Card = ({ r, locked }) => {
    const active = selected === r.key;
    const face = r.depth === 'leaf' ? p.elements.leafStile.face : p.elements[r.key].face;
    const ded = p.lengths[r.lenKey] || 0;
    const sign = r.sign || '−';
    const smp = r.sampleLeaf
      ? (r.sampleLeaf === 'H' ? leafH - ded : leafW - ded)
      : (r.sample(W, H, p) ?? 'per field');
    return (
      <div onClick={() => setSelected(r.key)}
        className={`p-2 rounded-lg border cursor-pointer transition-all ${active ? 'border-accent-500 bg-accent-500/10' : 'border-surface-500 bg-surface-700/30 hover:bg-surface-700/60'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[12px] font-medium truncate ${active ? 'text-accent-400' : 'text-ink-100'}`}>{r.name} {r.qty || ''}</span>
          <span className="text-[10px] text-ink-400">{face} × {depthOf(r)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-ink-300">
          <span>L = {r.base} {sign}</span>
          <span onClick={(e) => e.stopPropagation()}>
            <NumInput value={ded} onCommit={(v) => setLen(r.lenKey, v)} disabled={locked}
              className={`w-14 px-1 py-0.5 bg-surface-800 border border-surface-500 text-ink-50 rounded text-[11px] text-center ${locked ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </span>
          <span className="text-ink-500">→ {smp}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Window Settings — Casement</h1>
          <div className="text-xs text-ink-400">v1.1 construction profile · feeds cut lists, drawings, BOM and weights · per-tenant</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            Sample window:
            <NumInput value={sampleW} onCommit={(v) => setSampleW(num(v, 1000))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <NumInput value={sampleH} onCommit={(v) => setSampleH(num(v, 1500))}
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

      <div className="flex gap-5 items-start">
        {/* ══ LEFT 2/3 — settings ══ */}
        <div className="w-2/3 min-w-0">

          <div className={`card p-4 mb-4 ${depthLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Depths &amp; glazing</div>
              <LockToggle locked={depthLock} onToggle={() => setDepthLock((x) => !x)} />
            </div>
            <fieldset disabled={depthLock} className={`flex flex-wrap gap-x-6 gap-y-2 items-end text-xs border-0 p-0 m-0 min-w-0 ${depthLock ? 'opacity-60' : ''}`}>
              <div>
                <div className="text-ink-400 mb-1">Frame depth (mm)</div>
                <NumInput value={p.frameDepth} onCommit={(v) => setTop('frameDepth', v)}
                  className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              </div>
              <div>
                <div className="text-ink-400 mb-1">Leaf depth (mm)</div>
                <NumInput value={p.leafDepth} onCommit={(v) => setTop('leafDepth', v)}
                  className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              </div>
              <div>
                <div className="text-ink-400 mb-1">Leaf depth — triple (mm)</div>
                <NumInput value={p.leafDepthTriple} onCommit={(v) => setTop('leafDepthTriple', v)}
                  className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              </div>
              <div>
                <div className="text-ink-400 mb-1">Glass into rebate / side</div>
                <NumInput value={g.glassInset} onCommit={(v) => setGeo('glassInset', v)}
                  className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
              </div>
              <div className="text-ink-300 pb-1.5 text-[11px]">
                glass = leaf − <span className="text-accent-400 font-medium">{glassDed}</span>
                <span className="text-ink-500"> = 2 × ({p.elements.leafStile.face} − {g.glassInset}) · sample </span>
                <span className="text-accent-400 font-medium">{glassW} × {glassH}</span>
                <span className="text-ink-500"> · triple deepens the LEAF rebate only — frame stays {p.frameDepth}</span>
              </div>
            </fieldset>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-50">Frame</div>
            <LockToggle locked={frameLock} onToggle={() => setFrameLock((x) => !x)} />
          </div>
          <div className={`grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-1.5 mb-4 ${frameLock ? '' : 'ring-1 ring-amber-500/40 rounded-lg p-1'}`}>
            {CAS_FRAME_ROWS.map((r) => <Card key={r.key} r={r} locked={frameLock} />)}
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-50">Leaf</div>
            <LockToggle locked={leafLock} onToggle={() => setLeafLock((x) => !x)} />
          </div>
          <div className={`grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-1.5 mb-4 ${leafLock ? '' : 'ring-1 ring-amber-500/40 rounded-lg p-1'}`}>
            {CAS_LEAF_ROWS.map((r) => <Card key={r.key} r={r} locked={leafLock} />)}
          </div>

          <div className={`card p-4 mb-4 ${elementLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="mb-3 flex items-center justify-between">
              <div><span className="text-[11px] text-ink-400">Selected: </span><span className="text-sm font-semibold text-ink-50">{sel.name} {sel.qty || ''}</span></div>
              <LockToggle locked={elementLock} onToggle={() => setElementLock((x) => !x)} />
            </div>
            <fieldset disabled={elementLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${elementLock ? 'opacity-60' : ''}`}>
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-ink-400 mb-1">Face (mm)</div>
                  <NumInput value={selFace} onCommit={commitFace}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div className="text-[10px] text-ink-500 pb-2">
                  {isLeafRow
                    ? 'One section for all four leaf members — editing it writes stiles and both rails (windows have equal members all round).'
                    : `Depth follows Frame depth (${p.frameDepth}).`}
                </div>
              </div>
            </fieldset>
          </div>

          <div className={`card p-4 mb-4 ${rulesLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Length &amp; deduction rules
                <span className="text-ink-500 font-normal"> · the hint shows what each minus is built from</span>
              </div>
              <LockToggle locked={rulesLock} onToggle={() => setRulesLock((x) => !x)} />
            </div>
            <fieldset disabled={rulesLock} className={`grid grid-cols-2 gap-x-6 gap-y-3 text-xs border-0 p-0 m-0 min-w-0 ${rulesLock ? 'opacity-60' : ''}`}>
              <RuleField label="Leaf W at jamb: −" value={d.leafAtJamb} onCommit={(v) => setDed('leafAtJamb', v)}
                hint={`land ${g.land} + gap ${g.gap}`} hintVal={hJ} />
              <RuleField label="Leaf W at mullion axis: −" value={d.leafAtMullionAxis} onCommit={(v) => setDed('leafAtMullionAxis', v)}
                hint={`${g.mullionLand}/2 + ${g.gap}`} hintVal={hMA} />
              <RuleField label="Leaf H (no transom): H −" value={d.leafFullHeight} onCommit={(v) => setDed('leafFullHeight', v)}
                hint={`${g.land}+${g.gap} + ${g.gapCill}+${g.cillVisible}`} hintVal={hFull} sample={H - d.leafFullHeight} />
              <RuleField label="Fan H: T −" value={d.fanFromAxis} onCommit={(v) => setDed('fanFromAxis', v)}
                hint={`${g.land}+${g.gap} + ${g.gapFanTransom}+${g.transomLandAbove}`} hintVal={hFan} />
              <RuleField label="Lower H: H − T −" value={d.lowerFromAxis} onCommit={(v) => setDed('lowerFromAxis', v)}
                hint={`${g.transomLandBelow}+${g.gap} + ${g.gapCill}+${g.cillVisible}`} hintVal={hLow} />
              <div className="col-span-2 text-[10px] text-ink-500">
                Member cut deductions (head, jamb, cill, stiles, rails, mullion, transom) are edited on the cards above.
              </div>
            </fieldset>
          </div>

          <div className={`card p-4 ${advLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Advanced construction
                <span className="text-ink-500 font-normal"> · lands &amp; fitting gaps</span>
              </div>
              <LockToggle locked={advLock} onToggle={() => setAdvLock((x) => !x)} />
            </div>
            <fieldset disabled={advLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 min-w-0 ${advLock ? 'opacity-60' : ''}`}>
              {[
                ['land', 'Frame land'], ['rebate', 'Rebate'], ['gap', 'Leaf gap'],
                ['mullionLand', 'Mullion land'], ['transomLandAbove', 'Transom land ↑'], ['transomLandBelow', 'Transom land ↓'],
                ['gapFanTransom', 'Gap fan↔transom'], ['gapBelowTransom', 'Gap below transom'],
                ['gapCill', 'Gap at cill'], ['cillVisible', 'Cill visible'],
              ].map(([k, label]) => (
                <div key={k}>
                  <div className="text-ink-400 mb-1">{label}</div>
                  <NumInput value={g[k]} onCommit={(v) => setGeo(k, v)}
                    className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
              ))}
              <div className="text-[10px] text-ink-500 pb-1.5 border border-surface-500 rounded-lg px-3 py-2">
                OTD — unconfirmed, left as-is:<br />
                middle tier 2×{d.middleTierFromAxes / 2} · partial mullion +{L.partialMullionSeat}
              </div>
            </fieldset>
          </div>

          {/* ══ v4 C.7 — CNC & arches: the segment planner, the Uniclamp footprint, the tracery numbers ══ */}
          {p.arch && p.cnc && p.tracery && (
            <div className={`card p-4 mt-4 ${cncLock ? '' : 'ring-1 ring-amber-500/40'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-ink-200">CNC &amp; arches
                  <span className="text-ink-500 font-normal"> · blank planner limits, stock, finger joint, Uniclamp, tracery</span>
                </div>
                <LockToggle locked={cncLock} onToggle={() => setCncLock((x) => !x)} />
              </div>
              <fieldset disabled={cncLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${cncLock ? 'opacity-60' : ''}`}>
                <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Finger joint &amp; blank</div>
                <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                  <PathField label="Finger length" value={p.arch.finger.length} onCommit={(v) => setPath(['arch', 'finger', 'length'], v)} hint="mm per jointed end" />
                  <PathField label="Finger groove" value={p.arch.finger.depth} onCommit={(v) => setPath(['arch', 'finger', 'depth'], v)} hint="joint depth" />
                  <PathField label="Finger pitch" value={p.arch.finger.pitch} onCommit={(v) => setPath(['arch', 'finger', 'pitch'], v)} />
                  <PathField label="Contour allowance" value={p.arch.contourAllowance} onCommit={(v) => setPath(['arch', 'contourAllowance'], v)} hint="mm per side" />
                  <PathField label="Glazing rebate" value={g.glazingRebate} onCommit={(v) => setGeo('glazingRebate', v)} hint="mm (tracery board depth)" />
                </div>
                <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Stock &amp; limits</div>
                <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                  <div>
                    <div className="text-ink-400 mb-1">Stock widths (mm, comma list — the widest is the board cap)</div>
                    <ListInput value={p.arch.stockWidths} onCommit={(t) => setStockWidths(t)}
                      className="w-72 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                  </div>
                  <PathField label="Min clamp length" value={p.cnc.minClampLength} onCommit={(v) => setPath(['cnc', 'minClampLength'], v)} hint="overall piece, mm" />
                  <PathField label="Min piece length" value={p.arch.minPieceLength} onCommit={(v) => setPath(['arch', 'minPieceLength'], v)} hint="shorter edge, mm" />
                  <PathField label="Waste threshold" value={p.arch.wasteThreshold} onCommit={(v) => setPath(['arch', 'wasteThreshold'], v)} hint="0–1 · 1 = always fewest pieces" />
                </div>
                <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Uniclamp (CLAMPS layer, suggestion)</div>
                <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                  <PathField label="Clamp base" value={p.cnc.clamp.base} onCommit={(v) => setPath(['cnc', 'clamp', 'base'], v)} hint="mm square" />
                  <PathField label="Jaws min thickness" value={p.cnc.clamp.minThickness} onCommit={(v) => setPath(['cnc', 'clamp', 'minThickness'], v)} />
                  <PathField label="Jaws max thickness" value={p.cnc.clamp.maxThickness} onCommit={(v) => setPath(['cnc', 'clamp', 'maxThickness'], v)} />
                  <PathField label="Clamp clearance" value={p.cnc.clampClearance} onCommit={(v) => setPath(['cnc', 'clampClearance'], v)} hint="from the end cuts" />
                </div>
                <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Tracery board (bead R8 profile)</div>
                <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                  <PathField label="Pane offset" value={p.tracery.paneOffset} onCommit={(v) => setPath(['tracery', 'paneOffset'], v)} />
                  <PathField label="Profile width" value={p.tracery.profileWidth} onCommit={(v) => setPath(['tracery', 'profileWidth'], v)} />
                  <PathField label="Ridge land" value={p.tracery.ridgeLand} onCommit={(v) => setPath(['tracery', 'ridgeLand'], v)} />
                  <PathField label="Edge land" value={p.tracery.edgeLand} onCommit={(v) => setPath(['tracery', 'edgeLand'], v)} />
                  <PathField label="Mitre leg" value={p.tracery.mitreLeg} onCommit={(v) => setPath(['tracery', 'mitreLeg'], v)} />
                </div>
                <div className={`text-[11px] rounded-lg px-3 py-2 border ${archValidation.ok ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : 'border-amber-500/50 text-amber-400 bg-amber-500/5'}`}>
                  {archValidation.ok ? '✓ ' : '✗ '}{archValidation.text}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        {/* ══ RIGHT 1/3 — live drawings ══ */}
        <div className="w-1/3 min-w-0 shrink-0 sticky top-4">
          {sample?.derived ? (
            <>
              <div className="text-sm font-semibold text-ink-50 mb-2">
                Drawings <span className="text-ink-500 font-normal text-xs">— {W} × {H} · 2 Lights + Fanlights</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="card p-2"><CasementElevation2D windowSpec={sample.ws} derived={sample.derived} /></div>
                <div className="card p-2">
                  <CasementFrameDetail2D windowSpec={sample.ws} derived={sample.derived}
                    selectedElement={drawSel} onElementClick={pickFromDrawing} />
                </div>
                {leafGroup && (
                  <div className="card p-2">
                    <CasementLeafDetail2D windowSpec={sample.ws} derived={sample.derived} group={leafGroup}
                      selectedElement={drawSel} onElementClick={pickFromDrawing} />
                  </div>
                )}
                <div className="card p-2">
                  <CasementSection2D windowSpec={sample.ws} derived={sample.derived}
                    selectedElement={drawSel} onElementClick={pickFromDrawing} />
                </div>
              </div>
              <div className="text-[10px] text-ink-500 mt-2">
                Live from the engine — every field on the left reshapes these. Click a part to select it.
              </div>
            </>
          ) : (
            <div className="card p-6 text-center text-xs text-ink-400">Sample drawings unavailable.</div>
          )}
        </div>
      </div>
    </div>
  );
}
