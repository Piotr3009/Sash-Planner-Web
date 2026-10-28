import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { uploadBsuiteProgram, removeBsuiteProgram } from '../services/bsuitePrograms.js';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import { kgPerM, VARIANT_ORDER, casementGlassDeductions, DEFAULT_DOOR_PROFILE, DEFAULT_PARTITION_PROFILE, DEFAULT_FIREDOOR_PROFILE, FIREDOOR_CLOSER_KINDS, FIREDOOR_CLOSER_LABELS } from '../engine/profile.js';
import NumInput from '../components/NumInput.jsx';
import { CONSTANTS, deriveWindowData } from '../engine/calculations.js';
import { buildArchPlan, ArchError } from '../engine/arch.js';
import { normaliseToWindowSpec } from '../engine/specification.js';
// Fire doors (v1.1): the opening <-> leaf size rule of the engine (the Frame card prints it)
import { fireDoorSizeRule, fireDoorLeafForOpening } from '../engine/fireDoor.js';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import JambDetail2D from '../components/drawings/JambDetail2D.jsx';
import CasementElevation2D from '../components/drawings/CasementElevation2D.jsx';
import CasementFrameDetail2D from '../components/drawings/CasementFrameDetail2D.jsx';
import CasementLeafDetail2D from '../components/drawings/CasementLeafDetail2D.jsx';
import CasementSection2D from '../components/drawings/CasementSection2D.jsx';
import { groupCasementLeaves } from '../components/drawings/casementDrawUtils.js';
import DoorElevation2D from '../components/drawings/DoorElevation2D.jsx';
import PartitionElevation2D from '../components/drawings/PartitionElevation2D.jsx';

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
  const loadFromCloud = useWindowProfileStore((s) => s.loadFromCloud);
  // Entering Window Settings reloads the profiles from the cloud (another
  // computer may have saved since this tab loaded); unsaved local changes stay
  // on top (owner box item 20, 09.10.2026). The tab coming back reloads too
  // (windowProfileStore, visibilitychange).
  useEffect(() => { loadFromCloud(); }, [loadFromCloud]);

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
  if (typeId === 'door') {
    return <DoorSettings />;
  }
  if (typeId === 'partition') {
    return <PartitionSettings />;
  }
  // Fire doors (27.10.2026): the fire door profile card
  if (typeId === 'firedoor') {
    return <FireDoorSettings />;
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
                {(() => {
                  // Laminate / Acoustic SPEC makeup — same for every frame variant (01.10.2026)
                  const av = (profile.glassMakeup || {}).acoustic ?? '';
                  const an = String(av).split(/[^0-9.]+/).map(Number).filter((n) => n > 0);
                  const asum = an.length >= 2 ? Math.round(an.reduce((a, b) => a + b, 0) * 10) / 10 : null;
                  return (
                    <div className="mt-3">
                      <div className="text-[11px] text-ink-400 mb-1">Laminate / Acoustic spec — makeup (mm)</div>
                      <input type="text" value={av}
                        onChange={(e) => setGlassMakeup('acoustic', e.target.value)}
                        className="px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm font-mono w-[200px]" />
                      <div className="text-[11px] text-ink-300 mt-2">any glass type with this spec{asum ? <span className="text-blue-300"> · {asum} mm · clips {asum} mm</span> : null}</div>
                    </div>
                  );
                })()}
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
        // sealed unit = clear light + 2×rebate (CONSTANTS.GLASS_REBATE, 11.5) per axis — same numbers as Glass Schedule
        const uW = gw + 2 * CONSTANTS.GLASS_REBATE;
        const uH = gU + 2 * CONSTANTS.GLASS_REBATE;
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
  const setBsuiteTargets = useWindowProfileStore((s) => s.setCasementBsuiteTargets);
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
  // Glass follows the leaf member faces: the engine's ONE source (profile.js
  // casementGlassDeductions), width from the stiles, height from the two rails.
  const glassDed = casementGlassDeductions(p);
  const glassW = leafW - glassDed.width;
  const glassH = leafH - glassDed.height;

  // Composition hints (geometry → expected rule value):
  const hJ = g.land + g.gap;
  const hMA = g.mullionLand / 2 + g.gap;
  const hFull = g.land + g.gap + g.gapCill + g.cillVisible;
  const hFan = g.land + g.gap + g.gapFanTransom + g.transomLandAbove;
  const hLow = g.transomLandBelow + g.gap + g.gapCill + g.cillVisible;

  const allRows = [...CAS_FRAME_ROWS, ...CAS_LEAF_ROWS];
  const sel = allRows.find((r) => r.key === selected) || allRows[0];
  const isLeafRow = sel.depth === 'leaf';
  // Stiles and top rail share one width (setLeafFace writes both); the bottom
  // rail has its own (Piotr 07.10.2026), written alone.
  const isBottomRail = sel.key === 'leafBottom';
  const selFace = isBottomRail ? p.elements.leafBottom.face
    : isLeafRow ? p.elements.leafStile.face : p.elements[sel.key].face;
  const commitFace = (v) => (isBottomRail ? setEl('leafBottom', 'face', v)
    : isLeafRow ? setLeafFace(v) : setEl(sel.key, 'face', v));
  const depthOf = (r) => (r.depth === 'leaf' ? p.leafDepth : p.frameDepth);
  // Drawings report their own element keys — translate to the selected card.
  const pickFromDrawing = (k) => setSelected(CAS_DRAW_TO_ROW[k] || k);
  const drawSel = sel.drawKey;

  const Card = ({ r, locked }) => {
    const active = selected === r.key;
    const face = p.elements[r.key].face;   // every card its own section (leaf cards too)
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
                glass W = leaf − <span className="text-accent-400 font-medium">{glassDed.width}</span>
                <span className="text-ink-500"> · </span>glass H = leaf − <span className="text-accent-400 font-medium">{glassDed.height}</span>
                <span className="text-ink-500"> · sample </span>
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
                  {isBottomRail
                    ? 'Bottom rail width. Stiles and top rail are edited on their own cards.'
                    : isLeafRow
                      ? 'Stiles and top rail share one width. The bottom rail has its own card.'
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

          {/* ══ 14.09 — bSuite worklist export: one TARGET per computer (machine / office / Jack), each with its own program paths and table placement ══ */}
          {p.bsuite && (() => {
            const T = p.bsuite.targets || [];
            const active = T.find((t) => t.id === p.bsuite.activeTarget) || T[0];
            const save = (targets, activeId = p.bsuite.activeTarget) => setBsuiteTargets(targets, activeId);
            const patchActive = (patch) => save(T.map((t) => (t.id === active.id ? { ...t, ...patch } : t)));
            const patchProgram = (key, patch) => patchActive({ programs: { ...active.programs, [key]: { ...active.programs[key], ...patch } } });
            const LABEL = { head: 'HEAD', cill: 'CILL', jambL: 'JAMB L', jambR: 'JAMB R', mullion: 'MULLION', transom: 'TRANSOM' };
            const chip = (on) => `px-2.5 py-1 text-[11px] rounded-lg border transition-all ${on ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`;
            const addTarget = () => {
              const n = T.length + 1; const id = `target-${Date.now().toString(36)}`;
              save([...T, { ...active, id, name: `Computer ${n}`, programs: Object.fromEntries(Object.entries(active.programs).map(([k, v]) => [k, { ...v }])), executionParameters: { ...active.executionParameters } }], id);
            };
            const removeTarget = () => { if (T.length > 1 && window.confirm(`Remove target "${active.name}"?`)) save(T.filter((t) => t.id !== active.id), T.find((t) => t.id !== active.id).id); };
            // Explorer's "Copy as path" wraps the path in quotes — strip them, and any whitespace
            const cleanPath = (v) => String(v || '').replace(/"/g, '').trim().replace(/^'+|'+$/g, '').trim().replace(/\\/g, '/');
            const fillFromFolder = (folder) => {
              const f = cleanPath(folder).replace(/\/+$/, '');
              if (!f) return;
              patchActive({ programs: Object.fromEntries(Object.entries(active.programs).map(([k, v]) => [k, { ...v, path: `${f}/${String(v.path).split(/[\\/]/).pop()}` }])) });
            };
            return (
              <div className="card p-4 mt-4">
                <div className="text-xs font-semibold text-ink-200 mb-2">bSuite export
                  <span className="text-ink-500 font-normal"> · Rover worklist (.ewlist) for frame members — one target per computer, each with its own program paths</span>
                </div>
                <div className="text-xs">
                  <div className="text-ink-400 mb-1">Target computer (the list is built for the active one)</div>
                  <div className="flex flex-wrap gap-1.5 items-center mb-3">
                    {T.map((t) => (
                      <button key={t.id} onClick={() => save(T, t.id)} className={chip(t.id === active.id)}>{t.name}</button>
                    ))}
                    <button onClick={addTarget} className="px-2.5 py-1 text-[11px] rounded-lg border border-dashed border-surface-500 text-ink-300 hover:text-ink-50 hover:border-surface-400">+ add</button>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                    <div>
                      <div className="text-ink-400 mb-1">Name</div>
                      <input type="text" defaultValue={active.name} key={`${active.id}-name`}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== active.name) patchActive({ name: v }); }}
                        className="w-52 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                    </div>
                    <div>
                      <div className="text-ink-400 mb-1">Fill all six from a folder (keeps the file names)</div>
                      <input type="text" placeholder="C:/Users/Xp600/Desktop/…" key={`${active.id}-fill`}
                        onKeyDown={(e) => { if (e.key === 'Enter') { fillFromFolder(e.target.value); e.target.value = ''; } }}
                        onBlur={(e) => { if (e.target.value.trim()) { fillFromFolder(e.target.value); e.target.value = ''; } }}
                        className="w-80 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                    </div>
                    {T.length > 1 && (
                      <button onClick={removeTarget} className="px-2.5 py-1.5 text-[11px] rounded-lg border border-surface-500 text-ink-300 hover:text-red-400 hover:border-red-500/60">remove target</button>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Programs — path on this computer (goes into the list as ProgramUri) and the .bSolid FILE (embedded in the list — bSolid reads programs from inside the .ewlist)</div>
                  <div className="space-y-1.5 max-w-4xl">
                    {Object.keys(LABEL).map((k) => {
                      const st = active.programs[k].stored;
                      const fileName = String(active.programs[k].path).split(/[\\/]/).pop();
                      const mismatch = st && st.fileName !== fileName;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-ink-400 w-16 shrink-0">{LABEL[k]}</span>
                          <input type="text" defaultValue={active.programs[k].path} key={`${active.id}-${k}-${active.programs[k].path}`}
                            onBlur={(e) => { const v = cleanPath(e.target.value); if (v && v !== active.programs[k].path) patchProgram(k, { path: v }); }}
                            className="flex-1 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs font-mono" />
                          <label className={`shrink-0 px-2.5 py-1 text-[11px] rounded-lg border cursor-pointer ${st ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : 'border-amber-500/50 text-amber-400 bg-amber-500/5'}`}
                            title={st ? `${st.fileName} · ${(st.bytes / 1048576).toFixed(1)} MB · ${new Date(st.uploadedAt).toLocaleString('en-GB')}` : 'No file uploaded — the list would show this row red'}>
                            {st ? `✓ ${(st.bytes / 1048576).toFixed(1)} MB` : '↑ Upload .bSolid'}
                            <input type="file" accept=".bSolid,.bsolid" className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0]; e.target.value = '';
                                if (!f) return;
                                try {
                                  const stored = await uploadBsuiteProgram(active.id, k, f);
                                  patchProgram(k, { stored, path: active.programs[k].path.replace(/[^\\/]+$/, f.name) });
                                } catch (err) { alert(`Upload failed: ${err?.message || err}`); }
                              }} />
                          </label>
                          {st && (
                            <button onClick={async () => { if (!window.confirm(`Remove the uploaded ${st.fileName}?`)) return; try { await removeBsuiteProgram(st.storagePath); } catch { /* keep going */ } patchProgram(k, { stored: null }); }}
                              className="shrink-0 text-[11px] text-ink-500 hover:text-red-400" title="Remove the uploaded file">✕</button>
                          )}
                          {mismatch && <span className="text-[10px] text-amber-400" title="The uploaded file's name differs from the path's file name — the list uses the path's name">name ≠</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-1">Green = file uploaded and embedded on export. Amber = missing — that row would be red in bSolid. Upload the same six files Matt sent; when he sends a new version, upload it here.</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mt-4 mb-3">
                    <div>
                      <div className="text-ink-400 mb-1">Table placement (ExecutionParameters) — bSolid needs the block</div>
                      <div className="flex gap-1.5">
                        {[[true, 'Write placement'], [false, 'Default origins']].map(([v, l]) => (
                          <button key={String(v)} onClick={() => patchActive({ writeExecutionParameters: v })} className={chip(active.writeExecutionParameters === v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                    {active.writeExecutionParameters && (
                      <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">
                        {[['origin', 'ExOrigin'], ['refCorner', 'Corner'], ['offsetX', 'Offset X'], ['offsetY', 'Offset Y'], ['offsetZ', 'Offset Z'], ['rotZ', 'Rot Z']].map(([k, l]) => (
                          <div key={k}>
                            <div className="text-ink-400 mb-1 text-[10px]">{l}</div>
                            <input type="text" inputMode="decimal" defaultValue={active.executionParameters[k]} key={`${active.id}-ex-${k}-${active.executionParameters[k]}`}
                              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== active.executionParameters[k]) patchActive({ executionParameters: { ...active.executionParameters, [k]: v } }); }}
                              className="w-20 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs text-right" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {(active.programs.mullion.mode === 'master' || active.programs.transom.mode === 'master') && (
                    <div className="mb-3">
                      <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">V2 master programs (mullion / transom) — document variables</div>
                      <div className="flex flex-wrap gap-x-5 gap-y-3 items-end">
                        <div>
                          <div className="text-ink-400 mb-1">OPN_1_H (joint height) measured from</div>
                          <div className="flex gap-1.5">
                            {[['bottom', 'Frame bottom'], ['top', 'Frame top']].map(([v, l]) => (
                              <button key={v} onClick={() => setPath(['bsuite', 'master', 'opn1From'], v)} className={chip(p.bsuite.master?.opn1From === v)}>{l}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">
                          {[['left', 'Left-hung'], ['right', 'Right-hung'], ['top', 'Top-hung'], ['fixed', 'Fixed']].map(([k, l]) => (
                            <div key={k}>
                              <div className="text-ink-400 mb-1 text-[10px]">OPN hand · {l}</div>
                              <input type="text" inputMode="numeric" defaultValue={p.bsuite.master?.handCodes?.[k]} key={`hc-${k}-${p.bsuite.master?.handCodes?.[k]}`}
                                onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setPath(['bsuite', 'master', 'handCodes', k], v); }}
                                className="w-14 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs text-right" />
                            </div>
                          ))}
                          <div>
                            <div className="text-ink-400 mb-1 text-[10px]">HEAD_WDTH</div>
                            <input type="text" inputMode="numeric" defaultValue={p.bsuite.master?.headWidth} key={`hw-${p.bsuite.master?.headWidth}`}
                              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setPath(['bsuite', 'master', 'headWidth'], v); }}
                              className="w-16 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs text-right" />
                          </div>
                          <div>
                            <div className="text-ink-400 mb-1 text-[10px]">TRKL_VNT</div>
                            <div className="flex gap-1.5">
                              {[[true, 'From room type'], [false, 'Leave program']].map(([v, l]) => (
                                <button key={String(v)} onClick={() => setPath(['bsuite', 'master', 'writeTrickleVent'], v)} className={chip(p.bsuite.master?.writeTrickleVent === v)}>{l}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                    <div>
                      <div className="text-ink-400 mb-1">Screws in mullion / transom macro <span className="text-ink-500">(V1 macro programs only)</span></div>
                      <div className="flex gap-1.5">
                        {[[1, 'Screws'], [0, 'Dowels only']].map(([v, l]) => (
                          <button key={v} onClick={() => setPath(['bsuite', 'screws'], v)} className={chip(p.bsuite.screws === v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-400 mb-1">Joint position OPn_HX measured from</div>
                      <div className="flex gap-1.5">
                        {[['start', 'Start of member'], ['end', 'End of member']].map(([v, l]) => (
                          <button key={v} onClick={() => setPath(['bsuite', 'opOriginEnd'], v)} className={chip(p.bsuite.opOriginEnd === v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-400 mb-1">Macro variables in the list</div>
                      <div className="flex gap-1.5">
                        {[[true, 'Write OPn_HX / LH_RH'], [false, 'Program defaults']].map(([v, l]) => (
                          <button key={String(v)} onClick={() => setPath(['bsuite', 'macroVarsInList'], v)} className={chip(p.bsuite.macroVarsInList === v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-ink-500">
                    Frame rows carry the finished length (LPX) and the 68 × 93 board; V2 mullion / transom masters take the window (WINDOW_WIDTH / HEIGHT), the joint height OPN_1_H, the hands and the trickle-vent flag and compute their own board. bSolid resolves every program by the exact path in the list, so each computer that opens lists needs its own target — and a worklist only RUNS on the machine PC (the office bSolid shows it red). Arched heads are skipped (Arch DXF).
                  </div>
                </div>
              </div>
            );
          })()}
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

// ─── Doors (08.10.2026, doors to production; v3 09.10.2026) ─────────────────
// The door profile card, in the casement card's layout: depths, frame and leaf
// faces with their cut rules, the side panel light and fixed fan members, the
// panel boards and edge, the french lip, the leaf size rules with their
// composition hints, lands and gaps, the hinge rule and the hardware variant
// defaults. Every field writes the door profile through setDoorPath; the
// sample door on the right is the live engine. Since v3 the frame is ONE
// casement frame (W x H overall): mullions and the transom follow the
// casement rules.
const DOOR_FRAME_ROWS = [
  { key: 'frameHead', name: 'Frame head', lenKey: 'headDeduct', base: 'frame W' },
  { key: 'frameJamb', name: 'Frame jamb', qty: '×2', lenKey: 'jambDeduct', base: 'frame H' },
  { key: 'frameCill', name: 'Frame cill', lenKey: 'cillDeduct', base: 'frame W + ext' },
  { key: 'mullion', name: 'Mullion', lenKey: 'mullion', base: 'frame H', note: 'door / side panel, full height (no timber cill: H − (77 − cill visible))' },
  { key: 'transomRail', name: 'Transom', lenKey: 'transomSeat', base: 'field leaf W', op: '+', note: 'one segment per field, between jambs and mullions' },
];
const DOOR_LEAF_ROWS = [
  { key: 'leafStile', name: 'Stiles', qty: '×2', lenKey: 'stileDeduct', base: 'leaf H' },
  { key: 'leafTop', name: 'Top rail', lenKey: 'topRailDeduct', base: 'leaf W' },
  { key: 'leafBottom', name: 'Bottom rail', lenKey: 'bottomRailDeduct', base: 'leaf W' },
  { key: 'leafMid', name: 'Mid rail', lenKey: 'midRailDeduct', base: 'leaf W', note: 'half-glazed / three-quarter' },
  { key: 'leafMeeting', name: 'Meeting stile', lenKey: 'meetingStileDeduct', base: 'leaf H', note: 'french, 94 + lip' },
];

function DoorSettings() {
  const door = useWindowProfileStore((s) => s.door) || DEFAULT_DOOR_PROFILE;
  const setPath = useWindowProfileStore((s) => s.setDoorPath);
  const resetDoor = useWindowProfileStore((s) => s.resetDoorToDefaults);
  const [sampleW, setSampleW] = useState(1600);
  const [sampleH, setSampleH] = useState(2100);
  const [sampleType, setSampleType] = useState('french');
  const [depthLock, setDepthLock] = useState(true);
  const [frameLock, setFrameLock] = useState(true);
  const [leafLock, setLeafLock] = useState(true);
  const [rulesLock, setRulesLock] = useState(true);
  const [advLock, setAdvLock] = useState(true);
  const [hwLock, setHwLock] = useState(true);

  const p = door;
  const g = p.geometry || {}, d = p.deductions || {}, L = p.lengths || {};
  const H = p.hardware || {}, HG = p.hinges || {}, PN = p.panel || {};
  const MT = p.meeting || {};
  const W = Number(sampleW) || 1600;
  const Hh = Number(sampleH) || 2100;
  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);
  const inputCls = 'w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm';
  const selectCls = 'px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm';

  // Live sample door: the engine with this profile (french by default, so the
  // meeting stiles and both leaves show).
  const sample = useMemo(() => {
    try {
      const ws = normaliseToWindowSpec({ name: 'SAMPLE', width: W, height: Hh, windowCategory: 'door', doorType: sampleType, glassType: 'double' });
      return { ws, derived: deriveWindowData(ws) };
    } catch (err) {
      console.error('WindowSettings door sample derive failed:', err);
      return null;
    }
  }, [W, Hh, sampleType, p]);
  const dr = sample?.derived?.door;
  const leaf0 = dr?.leaves?.[0];
  const glass0 = sample?.derived?.customGlassUnits?.[0];

  // Composition hints (geometry -> expected rule value)
  const hJ = g.land + g.gap;
  const hMull = g.mullionLand / 2 + g.gap;
  const hFan = g.land + g.gap + g.gapFanTransom + g.transomLandAbove;
  const hBelow = g.transomLandBelow + g.gapBelowTransom;
  const SPN = p.sidePanel || {}, FF = p.fixedFan || {}, PE = PN.edge || {};

  const FaceCard = ({ r, locked }) => {
    const face = p.elements?.[r.key]?.face;
    const dedV = L[r.lenKey] ?? 0;
    return (
      <div className="p-2 rounded-lg border border-surface-500 bg-surface-700/30">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12px] font-medium truncate text-ink-100">{r.name} {r.qty || ''}</span>
          <span className="text-[10px] text-ink-400">{face} × {r.key.startsWith('leaf') ? p.leafDepth : p.frameDepth}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-ink-300">
          <span>Face</span>
          <NumInput value={face} onCommit={(v) => setPath(['elements', r.key, 'face'], v)} disabled={locked}
            className={`w-14 px-1 py-0.5 bg-surface-800 border border-surface-500 text-ink-50 rounded text-[11px] text-center ${locked ? 'opacity-50 cursor-not-allowed' : ''}`} />
          <span className="font-mono">L = {r.base} {r.op || '−'}</span>
          <NumInput value={dedV} onCommit={(v) => setPath(['lengths', r.lenKey], v)} disabled={locked}
            className={`w-12 px-1 py-0.5 bg-surface-800 border border-surface-500 text-ink-50 rounded text-[11px] text-center ${locked ? 'opacity-50 cursor-not-allowed' : ''}`} />
        </div>
        {r.note && <div className="text-[10px] text-ink-500 mt-0.5">{r.note}</div>}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Window Settings · Doors</h1>
          <div className="text-xs text-ink-400">Door profile (schema {p.schema}) · single and french · feeds cut lists, drawings, BOM, hardware and weights · per-tenant</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            Sample door:
            <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} className={selectCls + ' text-xs'}>
              <option value="single-external">Single</option>
              <option value="french">French</option>
            </select>
            <NumInput value={sampleW} onCommit={(v) => setSampleW(num(v, 1600))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <NumInput value={sampleH} onCommit={(v) => setSampleH(num(v, 2100))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            mm
          </div>
          <button
            onClick={() => { if (window.confirm('Reset the door profile to defaults?')) resetDoor(); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-surface-500 text-ink-200 bg-surface-700 hover:bg-surface-600 transition-colors">
            Reset doors to defaults
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ══ LEFT 2/3: settings ══ */}
        <div className="w-2/3 min-w-0">

          <div className={`card p-4 mb-4 ${depthLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Depths &amp; glazing</div>
              <LockToggle locked={depthLock} onToggle={() => setDepthLock((x) => !x)} />
            </div>
            <fieldset disabled={depthLock} className={`flex flex-wrap gap-x-6 gap-y-2 items-end text-xs border-0 p-0 m-0 min-w-0 ${depthLock ? 'opacity-60' : ''}`}>
              <PathField label="Frame depth (mm)" value={p.frameDepth} onCommit={(v) => setPath(['frameDepth'], v)} />
              <PathField label="Leaf depth (mm)" value={p.leafDepth} onCommit={(v) => setPath(['leafDepth'], v)} />
              <PathField label="Leaf depth, triple (mm)" value={p.leafDepthTriple} onCommit={(v) => setPath(['leafDepthTriple'], v)} />
              <PathField label="Glass into rebate / side" value={g.glassInset} onCommit={(v) => setPath(['geometry', 'glassInset'], v)} />
              <PathField label="French lip (each leaf)" value={p.frenchLip} onCommit={(v) => setPath(['frenchLip'], v)} hint="meeting stile laps the centre line" />
              <PathField label="Meeting gap" value={MT.gap} onCommit={(v) => setPath(['meeting', 'gap'], v)} hint={`rebate = lap ${2 * (Number(p.frenchLip) || 0)} + gap`} />
              <PathField label="Active lip" value={MT.lipActive} onCommit={(v) => setPath(['meeting', 'lipActive'], v)} hint={`cut ${Math.round(((Number(p.leafDepth) || 0) - (Number(MT.lipActive) || 0)) * 10) / 10} from the other face`} />
              <PathField label="Passive lip" value={MT.lipPassive} onCommit={(v) => setPath(['meeting', 'lipPassive'], v)} hint={`cut ${Math.round(((Number(p.leafDepth) || 0) - (Number(MT.lipPassive) || 0)) * 10) / 10}, seal space ${Math.round(((Number(p.leafDepth) || 0) - (Number(MT.lipActive) || 0) - (Number(MT.lipPassive) || 0)) * 10) / 10}`} />
              <PathField label="Seal groove" value={MT.sealGroove} onCommit={(v) => setPath(['meeting', 'sealGroove'], v)} hint="in the passive shoulder" />
              <div className="text-ink-300 pb-1.5 text-[11px]">
                {leaf0 && glass0 ? (
                  <>sample leaf <span className="text-accent-400 font-medium">{leaf0.w} × {leaf0.h}</span>
                    <span className="text-ink-500"> · glass </span>
                    <span className="text-accent-400 font-medium">{glass0.width} × {glass0.height}</span>
                    {dr?.isFrench && <span className="text-ink-500"> · half {dr.half} + lip {dr.lip}</span>}</>
                ) : 'n/a'}
              </div>
            </fieldset>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-50">Frame</div>
            <LockToggle locked={frameLock} onToggle={() => setFrameLock((x) => !x)} />
          </div>
          <div className={`grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-1.5 mb-2 ${frameLock ? '' : 'ring-1 ring-amber-500/40 rounded-lg p-1'}`}>
            {DOOR_FRAME_ROWS.map((r) => <FaceCard key={r.key} r={r} locked={frameLock} />)}
          </div>
          <fieldset disabled={frameLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 mb-4 min-w-0 ${frameLock ? 'opacity-60' : ''}`}>
            <PathField label="Inward cill, inside face" value={p.cillInward?.faceInternal} onCommit={(v) => setPath(['cillInward', 'faceInternal'], v)} hint="unrebated" />
            <PathField label="Inward cill, outside face" value={p.cillInward?.faceExternal} onCommit={(v) => setPath(['cillInward', 'faceExternal'], v)} hint="fall" />
          </fieldset>
          <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Side panel: a casement fixed light behind the mullion (no hardware)</div>
          <fieldset disabled={frameLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 mb-3 min-w-0 ${frameLock ? 'opacity-60' : ''}`}>
            <PathField label="Stiles" value={SPN.stile} onCommit={(v) => setPath(['sidePanel', 'stile'], v)} hint="as casement leaf" />
            <PathField label="Top rail" value={SPN.top} onCommit={(v) => setPath(['sidePanel', 'top'], v)} />
            <PathField label="Bottom rail" value={SPN.bottom} onCommit={(v) => setPath(['sidePanel', 'bottom'], v)} hint="as the door bottom rail" />
            <PathField label="Depth" value={SPN.depth} onCommit={(v) => setPath(['sidePanel', 'depth'], v)} />
          </fieldset>
          <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Fixed fanlight: a non-opening casement leaf (no hardware; the opening fan is the casement leaf)</div>
          <fieldset disabled={frameLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 mb-4 min-w-0 ${frameLock ? 'opacity-60' : ''}`}>
            <PathField label="Stiles" value={FF.stile} onCommit={(v) => setPath(['fixedFan', 'stile'], v)} />
            <PathField label="Top rail" value={FF.top} onCommit={(v) => setPath(['fixedFan', 'top'], v)} />
            <PathField label="Bottom rail" value={FF.bottom} onCommit={(v) => setPath(['fixedFan', 'bottom'], v)} hint="owner check" />
          </fieldset>

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-50">Leaf</div>
            <LockToggle locked={leafLock} onToggle={() => setLeafLock((x) => !x)} />
          </div>
          <div className={`grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-1.5 mb-2 ${leafLock ? '' : 'ring-1 ring-amber-500/40 rounded-lg p-1'}`}>
            {DOOR_LEAF_ROWS.map((r) => <FaceCard key={r.key} r={r} locked={leafLock} />)}
          </div>
          <fieldset disabled={leafLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 mb-4 min-w-0 ${leafLock ? 'opacity-60' : ''}`}>
            <PathField label="Panel board" value={PN.boardThickness} onCommit={(v) => setPath(['panel', 'boardThickness'], v)} hint="Tricoya MDF" />
            <PathField label="Panel boards" value={PN.boards} onCommit={(v) => setPath(['panel', 'boards'], v)} hint="pcs" />
            <PathField label="Panel core" value={PN.coreThickness} onCommit={(v) => setPath(['panel', 'coreThickness'], v)} hint="MDF, to confirm" />
            <PathField label="Panel density" value={PN.densityKgM3} onCommit={(v) => setPath(['panel', 'densityKgM3'], v)} hint="kg/m³, weight only" />
            <PathField label="Panel in rebate" value={PN.inset} onCommit={(v) => setPath(['panel', 'inset'], v)} hint="per side: panel = daylight + 2 ×" />
            <PathField label="Edge tongue" value={PE.tongue} onCommit={(v) => setPath(['panel', 'edge', 'tongue'], v)} hint="thick" />
            <PathField label="Edge slope" value={PE.slope} onCommit={(v) => setPath(['panel', 'edge', 'slope'], v)} hint="wide" />
            <PathField label="Edge flat" value={PE.flat} onCommit={(v) => setPath(['panel', 'edge', 'flat'], v)} hint="next to the bead" />
          </fieldset>

          <div className={`card p-4 mb-4 ${rulesLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Leaf size rules
                <span className="text-ink-500 font-normal"> · the hint shows what each minus is built from</span>
              </div>
              <LockToggle locked={rulesLock} onToggle={() => setRulesLock((x) => !x)} />
            </div>
            <fieldset disabled={rulesLock} className={`grid grid-cols-2 gap-x-6 gap-y-3 text-xs border-0 p-0 m-0 min-w-0 ${rulesLock ? 'opacity-60' : ''}`}>
              <RuleField label="Leaf W at jamb: −" value={d.leafAtJamb} onCommit={(v) => setPath(['deductions', 'leafAtJamb'], v)}
                hint={`land ${g.land} + gap ${g.gap}`} hintVal={hJ} />
              <RuleField label="Leaf W at mullion axis: −" value={d.leafAtMullionAxis} onCommit={(v) => setPath(['deductions', 'leafAtMullionAxis'], v)}
                hint={`${g.mullionLand} / 2 + gap ${g.gap}`} hintVal={hMull} />
              <RuleField label="Leaf bottom above the floor: −" value={d.leafAtFloor} onCommit={(v) => setPath(['deductions', 'leafAtFloor'], v)}
                sample={Hh - d.leafAtJamb - d.leafAtFloor} />
              <RuleField label="Fan leaf H: T −" value={d.fanFromAxis} onCommit={(v) => setPath(['deductions', 'fanFromAxis'], v)}
                hint={`${g.land}+${g.gap} + ${g.gapFanTransom}+${g.transomLandAbove}`} hintVal={hFan} />
              <RuleField label="Leaf below the transom axis: −" value={d.leafBelowAxis} onCommit={(v) => setPath(['deductions', 'leafBelowAxis'], v)}
                hint={`${g.transomLandBelow} + gap ${g.gapBelowTransom}`} hintVal={hBelow} />
              <div className="text-[10px] text-ink-500">
                Every leaf stands {d.leafAtFloor} above the floor, any threshold, any direction: leaf H = H − {d.leafAtJamb} − {d.leafAtFloor} = H − {d.leafAtJamb + d.leafAtFloor} (sample {Hh - d.leafAtJamb - d.leafAtFloor});
                under a transom at T: H − T − {d.leafBelowAxis} − {d.leafAtFloor}. Fan leaf (opening = the casement leaf, fixed = the fixed fan members): W = field − {d.leafAtJamb} at a jamb / − {d.leafAtMullionAxis} at a mullion, H = T − {d.fanFromAxis}.
                T and the side panel widths are measured from the frame edge to the member axis. Inward doors always take the timber inward cill.
              </div>
            </fieldset>
          </div>

          <div className={`card p-4 mb-4 ${advLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Advanced construction
                <span className="text-ink-500 font-normal"> · lands &amp; fitting gaps</span>
              </div>
              <LockToggle locked={advLock} onToggle={() => setAdvLock((x) => !x)} />
            </div>
            <fieldset disabled={advLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 min-w-0 ${advLock ? 'opacity-60' : ''}`}>
              {[
                ['land', 'Frame land'], ['rebate', 'Rebate'], ['gap', 'Leaf gap'],
                ['mullionLand', 'Mullion land'], ['transomLandAbove', 'Transom land above'], ['transomLandBelow', 'Transom land below'],
                ['gapFanTransom', 'Gap fan / transom'], ['gapBelowTransom', 'Gap below transom'],
                ['gapCill', 'Gap at cill'], ['cillVisible', 'Cill visible'], ['glazingRebate', 'Glazing rebate'],
              ].map(([k, label]) => (
                <div key={k}>
                  <div className="text-ink-400 mb-1">{label}</div>
                  <NumInput value={g[k]} onCommit={(v) => setPath(['geometry', k], v)} className={inputCls} />
                </div>
              ))}
            </fieldset>
          </div>

          <div className={`card p-4 ${hwLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Hinges &amp; hardware
                <span className="text-ink-500 font-normal"> · counts and the variants the buyer selects (Winkhaus, BJ Waller)</span>
              </div>
              <LockToggle locked={hwLock} onToggle={() => setHwLock((x) => !x)} />
            </div>
            <fieldset disabled={hwLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${hwLock ? 'opacity-60' : ''}`}>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Hinges per leaf</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Hinges" value={HG.perLeaf} onCommit={(v) => setPath(['hinges', 'perLeaf'], v)} hint="per leaf" />
                <PathField label="Hinges, tall leaf" value={HG.perLeafTall} onCommit={(v) => setPath(['hinges', 'perLeafTall'], v)} />
                <PathField label="Tall above" value={HG.tallAbove} onCommit={(v) => setPath(['hinges', 'tallAbove'], v)} hint="leaf H, mm" />
                <PathField label="Top hinge" value={HG.fromTop} onCommit={(v) => setPath(['hinges', 'fromTop'], v)} hint="below leaf top" />
                <PathField label="Middle hinge" value={HG.aboveCentre} onCommit={(v) => setPath(['hinges', 'aboveCentre'], v)} hint="above centre" />
                <PathField label="Bottom hinge" value={HG.fromBottom} onCommit={(v) => setPath(['hinges', 'fromBottom'], v)} hint="above leaf bottom" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">ThunderBolt (single door kit)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Door thickness" value={H.doorThickness} onCommit={(v) => setPath(['hardware', 'doorThickness'], v)} hint={`leaf ${p.leafDepth}`} />
                <div>
                  <div className="text-ink-400 mb-1">Backset</div>
                  <select value={H.backset} onChange={(e) => setPath(['hardware', 'backset'], e.target.value)} className={selectCls}>
                    {[45, 55].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Faceplate</div>
                  <select value={H.faceplate} onChange={(e) => setPath(['hardware', 'faceplate'], e.target.value)} className={selectCls}>
                    {['radius', 'square'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Keeps</div>
                  <select value={H.keeps} onChange={(e) => setPath(['hardware', 'keeps'], e.target.value)} className={selectCls}>
                    {['full length', 'individual'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <PathField label="Handle height" value={H.handleHeight} onCommit={(v) => setPath(['hardware', 'handleHeight'], v)} hint="above floor; read only without a spindle height" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Lock machining (spindle datum, every door)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Spindle above leaf bottom" value={H.spindleFromLeafBottom} onCommit={(v) => setPath(['hardware', 'spindleFromLeafBottom'], v)} hint="one height, single and french" />
                <PathField label="Edge margin" value={H.lockEdgeMargin} onCommit={(v) => setPath(['hardware', 'lockEdgeMargin'], v)} hint="lip face to the faceplate recess" />
                <PathField label="Faceplate recess width" value={H.faceplateWidth} onCommit={(v) => setPath(['hardware', 'faceplateWidth'], v)} hint={`axis ${Math.round(((Number(H.lockEdgeMargin) || 0) + (Number(H.faceplateWidth) || 0) / 2) * 10) / 10} from the lip face`} />
                <PathField label="Recess depth, master" value={H.faceplateRecessMaster} onCommit={(v) => setPath(['hardware', 'faceplateRecessMaster'], v)} />
                <PathField label="Recess depth, slave" value={H.faceplateRecessSlave} onCommit={(v) => setPath(['hardware', 'faceplateRecessSlave'], v)} />
                <div>
                  <div className="text-ink-400 mb-1">ThunderBolt aux housing</div>
                  <select value={H.auxHousing === false ? 'no' : 'yes'} onChange={(e) => setPath(['hardware', 'auxHousing'], e.target.value === 'yes')} className={selectCls}>
                    <option value="no">not on this lock (the DXF lock)</option>
                    <option value="yes">machined (the data sheet variant)</option>
                  </select>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">FGTE (double door kit, french with two handles)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <div>
                  <div className="text-ink-400 mb-1">Shootbolts</div>
                  <select value={H.fgteShootbolts} onChange={(e) => setPath(['hardware', 'fgteShootbolts'], e.target.value)} className={selectCls}>
                    <option value="slave">slave only</option>
                    <option value="both">master and slave</option>
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Slave backset</div>
                  <select value={H.fgteSlaveBackset} onChange={(e) => setPath(['hardware', 'fgteSlaveBackset'], e.target.value)} className={selectCls}>
                    {[35, 45].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Lock centre line</div>
                  <select value={H.fgteCentreLine} onChange={(e) => setPath(['hardware', 'fgteCentreLine'], e.target.value)} className={selectCls}>
                    {[12, 22].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Cill keep (timber cill)</div>
                  <select value={H.cillKeep} onChange={(e) => setPath(['hardware', 'cillKeep'], e.target.value)} className={selectCls}>
                    {['yes', 'no'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-[10px] text-ink-500">
                Defaults to confirm with the supplier (BLOCKERS). Handing is printed as the configurator states it: Hinge left / right (seen from inside), opens outward / inward.
              </div>
            </fieldset>
          </div>
        </div>

        {/* ══ RIGHT 1/3: live drawing ══ */}
        <div className="w-1/3 min-w-0 shrink-0 sticky top-4">
          {sample?.derived ? (
            <>
              <div className="text-sm font-semibold text-ink-50 mb-2">
                Drawing <span className="text-ink-500 font-normal text-xs">· {W} × {Hh} · {sampleType === 'french' ? 'French' : 'Single'}</span>
              </div>
              <div className="card p-2"><DoorElevation2D windowSpec={sample.ws} derived={sample.derived} /></div>
              <div className="text-[10px] text-ink-500 mt-2">
                Live from the engine: every field on the left reshapes it.
              </div>
            </>
          ) : (
            <div className="card p-6 text-center text-xs text-ink-400">Sample drawing unavailable.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Partition walls (25.10.2026) ────────────────────────────────────────────
// The partition profile card, in the door card's layout: the member depth and
// faces, the glazing rebate and unit, the panel, the door leaf fitting, the
// hinge rule, the hardware heights, the dowel joints and the configurator
// defaults. Every field writes the partition profile through setPartitionPath;
// the sample wall on the right is the live engine. The numbers marked
// ASSUMPTION in the profile are listed in docs/BLOCKERS.md 34.x.
const PARTITION_MEMBER_ROWS = [
  { key: 'post', name: 'Post', note: 'between the screens and at the door; the end posts against the end boards' },
  { key: 'topRail', name: 'Top rail', note: 'one piece between the end boards, over the posts' },
  { key: 'midRail', name: 'Mid rail', note: 'per screen, between the glass and the panel' },
  { key: 'bottomRail', name: 'Bottom rail', note: 'per screen, on the floor' },
  { key: 'doorStile', name: 'Door stile', note: 'x2 per leaf' },
  { key: 'doorTop', name: 'Door top rail' },
  { key: 'doorMid', name: 'Door mid rail', note: 'at the screens\' mid rail' },
  { key: 'doorBottom', name: 'Door bottom rail' },
];

function PartitionSettings() {
  const partition = useWindowProfileStore((s) => s.partition) || DEFAULT_PARTITION_PROFILE;
  const setPath = useWindowProfileStore((s) => s.setPartitionPath);
  const resetPartition = useWindowProfileStore((s) => s.resetPartitionToDefaults);
  const [sampleW, setSampleW] = useState(2525);
  const [sampleH, setSampleH] = useState(2165);
  const [sampleLayout, setSampleLayout] = useState('SDS');
  const [membersLock, setMembersLock] = useState(true);
  const [glazingLock, setGlazingLock] = useState(true);
  const [doorLock, setDoorLock] = useState(true);
  const [jointsLock, setJointsLock] = useState(true);

  const p = partition;
  const E = p.elements || {}, G = p.glazing || {}, PN = p.panel || {}, D = p.door || {};
  const HG = p.hinges || {}, HW = p.hardware || {}, J = p.joints || {}, DW = J.dowel || {}, DF = p.defaults || {};
  const W = Number(sampleW) || 2525;
  const Hh = Number(sampleH) || 2165;
  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);
  const inputCls = 'w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm';
  const cleanLayout = (v) => String(v || '').toUpperCase().replace(/[^SD]/g, '');

  // Live sample wall: the engine with this profile (the owner's bay by default).
  const sample = useMemo(() => {
    try {
      const ws = normaliseToWindowSpec({ name: 'SAMPLE', width: W, height: Hh, windowCategory: 'partition', partitionLayout: cleanLayout(sampleLayout) || 'S', glassType: 'double' });
      return { ws, derived: deriveWindowData(ws), error: null };
    } catch (err) {
      console.error('WindowSettings partition sample derive failed:', err);
      return { ws: null, derived: null, error: err?.message || String(err) };
    }
  }, [W, Hh, sampleLayout, p]);
  const pw = sample?.derived?.partition;
  const screen0 = pw?.screens?.[0];
  const door0 = pw?.doors?.[0];

  const FaceCard = ({ r, locked }) => {
    const face = E?.[r.key]?.face;
    return (
      <div className="p-2 rounded-lg border border-surface-500 bg-surface-700/30">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12px] font-medium truncate text-ink-100">{r.name}</span>
          <span className="text-[10px] text-ink-400">{face} × {p.depth}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-ink-300">
          <span>Face</span>
          <NumInput value={face} onCommit={(v) => setPath(['elements', r.key, 'face'], v)} disabled={locked}
            className={`w-14 px-1 py-0.5 bg-surface-800 border border-surface-500 text-ink-50 rounded text-[11px] text-center ${locked ? 'opacity-50 cursor-not-allowed' : ''}`} />
        </div>
        {r.note && <div className="text-[10px] text-ink-500 mt-0.5">{r.note}</div>}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Window Settings · Partition walls</h1>
          <div className="text-xs text-ink-400">Partition profile (schema {p.schema}) · solid oak, oiled · screens and a door between end boards · feeds cut lists, drawings, BOM, hardware and weights · per-tenant</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            Sample wall:
            <input type="text" value={sampleLayout} maxLength={12} spellCheck={false}
              onChange={(e) => setSampleLayout(cleanLayout(e.target.value))}
              onBlur={() => setSampleLayout(cleanLayout(sampleLayout) || 'S')}
              title="S = glazed screen, D = door"
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center font-mono tracking-widest" />
            <NumInput value={sampleW} onCommit={(v) => setSampleW(num(v, 2525))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <NumInput value={sampleH} onCommit={(v) => setSampleH(num(v, 2165))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            mm
          </div>
          <button
            onClick={() => { if (window.confirm('Reset the partition profile to defaults?')) resetPartition(); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-surface-500 text-ink-200 bg-surface-700 hover:bg-surface-600 transition-colors">
            Reset partition to defaults
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* LEFT 2/3: settings */}
        <div className="w-2/3 min-w-0">

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-50">Members <span className="text-ink-500 font-normal text-xs">· every member {p.depth} deep</span></div>
            <LockToggle locked={membersLock} onToggle={() => setMembersLock((x) => !x)} />
          </div>
          <fieldset disabled={membersLock} className={`flex flex-wrap gap-x-5 gap-y-3 items-end text-xs border-0 p-0 m-0 mb-2 min-w-0 ${membersLock ? 'opacity-60' : ''}`}>
            <PathField label="Member depth (mm)" value={p.depth} onCommit={(v) => setPath(['depth'], v)} hint="through the wall, the door leaf too" />
            <PathField label="End / head board" value={E.board?.face} onCommit={(v) => setPath(['elements', 'board', 'face'], v)} hint="thick" />
            <PathField label="Board overhang" value={E.board?.overhang} onCommit={(v) => setPath(['elements', 'board', 'overhang'], v)} hint="each face: board width = depth + 2 x" />
            <PathField label="Glazing bar face" value={E.bar?.face} onCommit={(v) => setPath(['elements', 'bar', 'face'], v)} hint="applied, both faces" />
            <PathField label="Glazing bar thickness" value={E.bar?.thickness} onCommit={(v) => setPath(['elements', 'bar', 'thickness'], v)} hint="ASSUMPTION" />
            <PathField label="Bead width" value={E.bead?.width} onCommit={(v) => setPath(['elements', 'bead', 'width'], v)} hint="fills the rebate" />
            <PathField label="Bead thickness" value={E.bead?.thickness} onCommit={(v) => setPath(['elements', 'bead', 'thickness'], v)} hint="ASSUMPTION" />
          </fieldset>
          <div className={`grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-1.5 mb-4 ${membersLock ? '' : 'ring-1 ring-amber-500/40 rounded-lg p-1'}`}>
            {PARTITION_MEMBER_ROWS.map((r) => <FaceCard key={r.key} r={r} locked={membersLock} />)}
          </div>

          <div className={`card p-4 mb-4 ${glazingLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Glazing &amp; panel
                <span className="text-ink-500 font-normal"> · one unit per screen, the panel in the same rebate</span>
              </div>
              <LockToggle locked={glazingLock} onToggle={() => setGlazingLock((x) => !x)} />
            </div>
            <fieldset disabled={glazingLock} className={`flex flex-wrap gap-x-6 gap-y-2 items-end text-xs border-0 p-0 m-0 min-w-0 ${glazingLock ? 'opacity-60' : ''}`}>
              <PathField label="Rebate depth" value={G.rebateDepth} onCommit={(v) => setPath(['glazing', 'rebateDepth'], v)} hint="into the member width" />
              <PathField label="Glass into rebate" value={G.glassIn} onCommit={(v) => setPath(['glazing', 'glassIn'], v)} hint="per side: unit = daylight + 2 x" />
              <PathField label="Unit thickness" value={G.unit} onCommit={(v) => setPath(['glazing', 'unit'], v)} />
              <div>
                <div className="text-ink-400 mb-1">Unit makeup</div>
                <input type="text" value={G.makeup || ''} onChange={(e) => setPath(['glazing', 'makeup'], e.target.value)} className={inputCls + ' w-24'} />
              </div>
              <PathField label="Dummy spacer" value={G.dummySpacer} onCommit={(v) => setPath(['glazing', 'dummySpacer'], v)} hint="behind the applied bars" />
              <PathField label="Panel thickness" value={PN.thickness} onCommit={(v) => setPath(['panel', 'thickness'], v)} hint="ASSUMPTION: takes the glass rebate and bead" />
              <div className="text-ink-300 pb-1.5 text-[11px]">
                {screen0 ? (
                  <>sample screen <span className="text-accent-400 font-medium">{screen0.w} wide</span>
                    <span className="text-ink-500"> · unit </span>
                    <span className="text-accent-400 font-medium">{screen0.unit?.w} × {screen0.unit?.h}</span>
                    {screen0.panel && <span className="text-ink-500"> · panel {screen0.panel.size?.w} × {screen0.panel.size?.h}</span>}</>
                ) : 'n/a'}
              </div>
            </fieldset>
          </div>

          <div className={`card p-4 mb-4 ${doorLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Door leaf, hinges &amp; hardware
                <span className="text-ink-500 font-normal"> · fitting gaps, the hinge rule, the handle</span>
              </div>
              <LockToggle locked={doorLock} onToggle={() => setDoorLock((x) => !x)} />
            </div>
            <fieldset disabled={doorLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${doorLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Leaf gap" value={D.gap} onCommit={(v) => setPath(['door', 'gap'], v)} hint="each side and at the head" />
                <PathField label="Floor clearance" value={D.floorClearance} onCommit={(v) => setPath(['door', 'floorClearance'], v)} hint="leaf bottom above the floor" />
                <PathField label="Front lip" value={D.lipFront} onCommit={(v) => setPath(['door', 'lipFront'], v)} hint={`lock edge rebate = ${Math.round(((Number(p.depth) || 0) - (Number(D.lipFront) || 0)) * 10) / 10}`} />
                <PathField label="Stop width" value={D.stopWidth} onCommit={(v) => setPath(['door', 'stopWidth'], v)} hint="the stop lip on the lock post" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Hinges (the door rule)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Top hinge" value={HG.fromTop} onCommit={(v) => setPath(['hinges', 'fromTop'], v)} hint="below leaf top" />
                <PathField label="Middle hinge" value={HG.aboveCentre} onCommit={(v) => setPath(['hinges', 'aboveCentre'], v)} hint="above centre" />
                <PathField label="Bottom hinge" value={HG.fromBottom} onCommit={(v) => setPath(['hinges', 'fromBottom'], v)} hint="above leaf bottom" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Hardware</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="Handle height" value={HW.handleHeight} onCommit={(v) => setPath(['hardware', 'handleHeight'], v)} hint="above the floor" />
                <PathField label="Latch backset" value={HW.latchBackset} onCommit={(v) => setPath(['hardware', 'latchBackset'], v)} hint="ASSUMPTION" />
              </div>
              <div className="text-ink-300 text-[11px]">
                {door0 ? (
                  <>sample leaf <span className="text-accent-400 font-medium">{door0.leaf?.w} × {door0.leaf?.h}</span>
                    <span className="text-ink-500"> · {door0.hinges?.count} hinges · handle {door0.latch?.fromFloor} from the floor</span></>
                ) : 'no door in the sample layout'}
              </div>
            </fieldset>
          </div>

          <div className={`card p-4 ${jointsLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Dowel joints &amp; configurator defaults</div>
              <LockToggle locked={jointsLock} onToggle={() => setJointsLock((x) => !x)} />
            </div>
            <fieldset disabled={jointsLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${jointsLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Dowel diameter" value={DW.dia} onCommit={(v) => setPath(['joints', 'dowel', 'dia'], v)} />
                <PathField label="Dowel length" value={DW.length} onCommit={(v) => setPath(['joints', 'dowel', 'length'], v)} />
                <PathField label="Dowels per joint" value={DW.perJoint} onCommit={(v) => setPath(['joints', 'dowel', 'perJoint'], v)} hint={pw?.dowels ? `sample wall: ${pw.dowels.count} dowels` : ''} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Defaults of a new wall in the configurator</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <div>
                  <div className="text-ink-400 mb-1">Layout</div>
                  <input type="text" value={DF.layout || ''} maxLength={12} spellCheck={false}
                    onChange={(e) => setPath(['defaults', 'layout'], cleanLayout(e.target.value) || 'S')}
                    className={inputCls + ' font-mono tracking-widest text-center'} />
                </div>
                <PathField label="Lights per screen" value={DF.lights} onCommit={(v) => setPath(['defaults', 'lights'], v)} />
                <PathField label="Panel height" value={DF.panelHeight} onCommit={(v) => setPath(['defaults', 'panelHeight'], v)} hint="0 = no panel" />
                <PathField label="Door opening width" value={DF.doorWidth} onCommit={(v) => setPath(['defaults', 'doorWidth'], v)} />
              </div>
              <div className="text-[10px] text-ink-500">
                Defaults: the owner's numbers of 25.10.2026 (the Windmill Street bay). The numbers marked ASSUMPTION are the programmer's proposals, listed in docs/BLOCKERS.md 34.x, to confirm.
              </div>
            </fieldset>
          </div>
        </div>

        {/* RIGHT 1/3: live drawing */}
        <div className="w-1/3 min-w-0 shrink-0 sticky top-4">
          {sample?.derived ? (
            <>
              <div className="text-sm font-semibold text-ink-50 mb-2">
                Drawing <span className="text-ink-500 font-normal text-xs">· {W} × {Hh} · {cleanLayout(sampleLayout) || 'S'}</span>
              </div>
              <div className="card p-2"><PartitionElevation2D windowSpec={sample.ws} derived={sample.derived} /></div>
              <div className="text-[10px] text-ink-500 mt-2">
                Live from the engine: every field on the left reshapes it.
              </div>
            </>
          ) : (
            <div className="card p-6 text-center text-xs text-ink-400">Sample drawing unavailable{sample?.error ? `: ${sample.error}` : '.'}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fire doors (27.10.2026): Window Settings · Fire Doors ───
// One card per block of DEFAULT_FIREDOOR_PROFILE (leaf, frame, hinges, lock,
// keep, vision panel, intumescent, bSuite, configurator defaults). Every field
// writes through setFireDoorPath (numbers finite, strings for the string
// leaves, booleans for the boolean leaves), the two suggestion lists through
// setFireDoorList, the bSuite targets whole through setFireDoorBsuiteTargets.
// The right column derives the reference door (FD30, leaf 826 x 2040, depth
// 100 by default) through normaliseToWindowSpec + deriveWindowData and prints
// the numbers of brief 3.10 live: nothing here is a literal.
const FD_PROGRAM_LABEL = { leaf: 'LEAF', head: 'HEAD', jambHinge: 'JAMB HINGE', jambLock: 'JAMB LOCK' };
const FD_SET_RATINGS = [['FD30', 'FD30'], ['FD60', 'FD60']];
const FD_SET_HANDS = [['left', 'Hinge left'], ['right', 'Hinge right']];
const FD_SET_LOCKS = [['latch', 'Latch'], ['euro', 'Sashlock euro'], ['bathroom', 'Bathroom']];
// v1.1: the closer is a kind (none / surface / built in), one default for fire doors and one for non-fire doors; no swing
const FD_SET_CLOSERS = FIREDOOR_CLOSER_KINDS.map((k) => [k, FIREDOOR_CLOSER_LABELS[k] || k]);

function FireDoorSettings() {
  const firedoor = useWindowProfileStore((s) => s.firedoor) || DEFAULT_FIREDOOR_PROFILE;
  const setPath = useWindowProfileStore((s) => s.setFireDoorPath);
  const setList = useWindowProfileStore((s) => s.setFireDoorList);
  const setBsuiteTargets = useWindowProfileStore((s) => s.setFireDoorBsuiteTargets);
  const resetFireDoor = useWindowProfileStore((s) => s.resetFireDoorToDefaults);
  const p = firedoor;
  const L = p.leaf || DEFAULT_FIREDOOR_PROFILE.leaf, FR = p.frame || DEFAULT_FIREDOOR_PROFILE.frame;
  const HG = p.hinges || DEFAULT_FIREDOOR_PROFILE.hinges, LK = p.lock || DEFAULT_FIREDOOR_PROFILE.lock;
  const KP = p.keep || DEFAULT_FIREDOOR_PROFILE.keep, VP = p.vp || DEFAULT_FIREDOOR_PROFILE.vp;
  const IN = p.intumescent || DEFAULT_FIREDOOR_PROFILE.intumescent, BS = p.bsuite || DEFAULT_FIREDOOR_PROFILE.bsuite;
  const DF = p.defaults || DEFAULT_FIREDOOR_PROFILE.defaults;
  const FO = LK.forend || {}, CS = LK.case || {}, KPK = KP.pocket || {}, LIM = L.limits || {}, TBR = L.thicknessByRating || {};
  const DW = FR.dowels || DEFAULT_FIREDOOR_PROFILE.frame.dowels, SBR = IN.stripsByRating || DEFAULT_FIREDOOR_PROFILE.intumescent.stripsByRating;
  // the sample door: the reference door of brief 3.10 (the profile defaults), its leaf size typed as the override and its rating editable here
  const [sampleW, setSampleW] = useState(() => Number(DEFAULT_FIREDOOR_PROFILE.leaf.defaultWidth));
  const [sampleH, setSampleH] = useState(() => Number(DEFAULT_FIREDOOR_PROFILE.leaf.defaultHeight));
  const [sampleDepth, setSampleDepth] = useState(() => Number(DEFAULT_FIREDOOR_PROFILE.frame.defaultDepth));
  const [sampleRating, setSampleRating] = useState(() => DEFAULT_FIREDOOR_PROFILE.defaults.rating);
  const [sampleFire, setSampleFire] = useState(() => DEFAULT_FIREDOOR_PROFILE.defaults.fire !== false);
  const [leafLock, setLeafLock] = useState(true);
  const [frameLock, setFrameLock] = useState(true);
  const [hingesLock, setHingesLock] = useState(true);
  const [lockLock, setLockLock] = useState(true);
  const [keepLock, setKeepLock] = useState(true);
  const [vpLock, setVpLock] = useState(true);
  const [intuLock, setIntuLock] = useState(true);
  const [bsuiteLock, setBsuiteLock] = useState(true);
  const [defaultsLock, setDefaultsLock] = useState(true);
  const W = Number(sampleW) || Number(DEFAULT_FIREDOOR_PROFILE.leaf.defaultWidth);
  const Hh = Number(sampleH) || Number(DEFAULT_FIREDOOR_PROFILE.leaf.defaultHeight);
  const Dd = Number(sampleDepth) || Number(DEFAULT_FIREDOOR_PROFILE.frame.defaultDepth);
  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);
  const inputCls = 'w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm';
  const selectCls = 'px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm';
  const chip = (on) => `px-2.5 py-1 text-[11px] rounded-lg border transition-all ${on ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`;
  const BoolChips = ({ value, onPick }) => (
    <div className="flex gap-1.5">
      {[[true, 'Yes'], [false, 'No']].map(([v, l]) => <button key={String(v)} type="button" onClick={() => onPick(v)} className={chip(value === v)}>{l}</button>)}
    </div>
  );
  const StringChips = ({ value, options, onPick }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => <button key={v} type="button" onClick={() => onPick(v)} className={chip(value === v)}>{l}</button>)}
    </div>
  );

  // Live sample door: the engine with this profile. The sheets are another
  // agent's; this column prints the numbers only.
  const sample = useMemo(() => {
    try {
      // v1.1: the sample leaf is typed as the override (the engine reports the
      // opening it needs); the closer, the intumescent and the handing follow
      // the profile defaults (no swing, no intumescent style)
      const ws = normaliseToWindowSpec({
        name: 'SAMPLE', width: W, height: Hh, windowCategory: 'firedoor',
        firedoorFire: sampleFire, firedoorRating: sampleRating, firedoorLeafWidth: W, firedoorLeafHeight: Hh, firedoorFrameDepth: Dd,
        firedoorHingeSide: DF.hingeSide, firedoorLockType: DF.lockType,
        firedoorVpStyle: DF.vpStyle, firedoorLeadEdge: DF.leadEdge, glassType: 'double',
      });
      const derived = deriveWindowData(ws);
      if (!derived?.firedoor) throw new Error('The engine returned no fire door data');
      return { ws, derived, error: null };
    } catch (err) {
      console.error('WindowSettings fire door sample derive failed:', err);
      return { ws: null, derived: null, error: err?.message || String(err) };
    }
  }, [W, Hh, Dd, sampleRating, sampleFire, p]);
  const fd = sample?.derived?.firedoor || null;
  const fdFrame = fd?.frame || null;
  const fdHinges = fd?.hinges?.positions || [];
  const fmt = (v) => (v == null || v === '' ? 'n/a' : String(v));
  // profile-side arithmetic shown as hints (the engine does the same sums)
  const rebateW = (Number(FR.overlap) || 0) + (Number(FR.gapSide) || 0);
  const faceOutside = (Number(FR.thickness) || 0) - rebateW;
  // the v1.1 size rule from the engine helper on THIS profile (the Frame card prints it with a worked example)
  const sizeRule = useMemo(() => {
    try {
      const r = fireDoorSizeRule(p);
      const ex = fireDoorLeafForOpening(p, 1000, 2100);
      return { ...r, exampleFrameW: 1000 - 2 * r.wallGapSide, exampleFrameH: 2100 - r.wallGapHead, exampleLeafW: ex.width, exampleLeafH: ex.height };
    } catch { return null; }
  }, [p]);

  return (
    <div className="p-6" data-firedoor-settings>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-50">Window Settings · Fire Doors</h1>
          <div className="text-xs text-ink-400">Fire door profile (schema {p.schema}) · internal door sets FDR / DR, leaf + frame · feeds the configurator, cut lists, drawings, BOM, hardware, the bSuite rows and the machining export · per-tenant</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            Sample door:
            <div className="flex gap-1">
              {[[true, 'Fire'], [false, 'Non-fire']].map(([v, l]) => <button key={String(v)} type="button" onClick={() => setSampleFire(v)} className={chip(sampleFire === v)}>{l}</button>)}
            </div>
            {sampleFire && <div className="flex gap-1">
              {FD_SET_RATINGS.map(([v, l]) => <button key={v} type="button" onClick={() => setSampleRating(v)} className={chip(sampleRating === v)}>{l}</button>)}
            </div>}
            leaf
            <NumInput value={sampleW} onCommit={(v) => setSampleW(num(v, DEFAULT_FIREDOOR_PROFILE.leaf.defaultWidth))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            ×
            <NumInput value={sampleH} onCommit={(v) => setSampleH(num(v, DEFAULT_FIREDOOR_PROFILE.leaf.defaultHeight))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            wall
            <NumInput value={sampleDepth} onCommit={(v) => setSampleDepth(num(v, DEFAULT_FIREDOOR_PROFILE.frame.defaultDepth))}
              className="w-16 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-100 rounded-lg text-xs text-center" />
            mm
          </div>
          <button
            onClick={() => { if (window.confirm('Reset the fire door profile to defaults?')) resetFireDoor(); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-surface-500 text-ink-200 bg-surface-700 hover:bg-surface-600 transition-colors">
            Reset fire doors to defaults
          </button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* LEFT 2/3: the blocks */}
        <div className="w-2/3 min-w-0">

          {/* ══ Leaf ══ */}
          <div className={`card p-4 mb-4 ${leafLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Leaf
                <span className="text-ink-500 font-normal"> · the blank (bSolid LPX x LPY x LPZ), the suggestion chips of the form, the thickness by rating, the sanity limits</span>
              </div>
              <LockToggle locked={leafLock} onToggle={() => setLeafLock((x) => !x)} />
            </div>
            <fieldset disabled={leafLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${leafLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <div>
                  <div className="text-ink-400 mb-1">Width suggestions (chips, comma list)</div>
                  <ListInput value={L.widthSuggestions} onCommit={(t) => setList(['leaf', 'widthSuggestions'], t)} className={inputCls + ' w-72'} />
                </div>
                <PathField label="Height suggestion" value={L.heightSuggestion} onCommit={(v) => setPath(['leaf', 'heightSuggestion'], v)} />
                <PathField label="Default width" value={L.defaultWidth} onCommit={(v) => setPath(['leaf', 'defaultWidth'], v)} hint="a new door starts here" />
                <PathField label="Default height" value={L.defaultHeight} onCommit={(v) => setPath(['leaf', 'defaultHeight'], v)} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Leaf thickness by rating (the macro has conditions on 44 and 54)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="FD30" value={TBR.FD30} onCommit={(v) => setPath(['leaf', 'thicknessByRating', 'FD30'], v)} />
                <PathField label="FD60" value={TBR.FD60} onCommit={(v) => setPath(['leaf', 'thicknessByRating', 'FD60'], v)} />
                <PathField label="Non-fire" value={TBR.none} onCommit={(v) => setPath(['leaf', 'thicknessByRating', 'none'], v)} />
                <PathField label="Blank allowance" value={L.blankAllowance} onCommit={(v) => setPath(['leaf', 'blankAllowance'], v)} hint="ASSUMPTION: each way on the bought blank" />
                <PathField label="LEAD_EDGE macro value" value={L.leadEdgeMacroValue} onCommit={(v) => setPath(['leaf', 'leadEdgeMacroValue'], v)} hint="the macro expression value" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Sanity limits (outside = that one door fails with a message; nothing is clamped)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="Min width" value={LIM.minWidth} onCommit={(v) => setPath(['leaf', 'limits', 'minWidth'], v)} />
                <PathField label="Max width" value={LIM.maxWidth} onCommit={(v) => setPath(['leaf', 'limits', 'maxWidth'], v)} />
                <PathField label="Min height" value={LIM.minHeight} onCommit={(v) => setPath(['leaf', 'limits', 'minHeight'], v)} />
                <PathField label="Max height" value={LIM.maxHeight} onCommit={(v) => setPath(['leaf', 'limits', 'maxHeight'], v)} />
                <PathField label="Min depth" value={LIM.minDepth} onCommit={(v) => setPath(['leaf', 'limits', 'minDepth'], v)} />
                <PathField label="Max depth" value={LIM.maxDepth} onCommit={(v) => setPath(['leaf', 'limits', 'maxDepth'], v)} />
              </div>
              <div className="text-ink-300 text-[11px]">
                {fd ? (<>sample leaf <span className="text-accent-400 font-medium">{fd.leaf?.width} × {fd.leaf?.height} × {fd.leaf?.thickness}</span>
                  <span className="text-ink-500"> · blank {fd.leaf?.blank?.width} × {fd.leaf?.blank?.height} × {fd.leaf?.blank?.thickness}</span></>) : 'n/a'}
              </div>
            </fieldset>
          </div>

          {/* ══ Frame ══ */}
          <div className={`card p-4 mb-4 ${frameLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Frame
                <span className="text-ink-500 font-normal"> · 63 raw machined to 50, the rebate from solid, the gaps, the wall gaps of the structural opening, the overall = leaf + 2 x (gap + 35) wide, floor gap + leaf + gap + 35 high, the corner dowels</span>
              </div>
              <LockToggle locked={frameLock} onToggle={() => setFrameLock((x) => !x)} />
            </div>
            <fieldset disabled={frameLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${frameLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Raw thickness" value={FR.rawThickness} onCommit={(v) => setPath(['frame', 'rawThickness'], v)} hint="the board bought" />
                <PathField label="Finished thickness" value={FR.thickness} onCommit={(v) => setPath(['frame', 'thickness'], v)} hint="machined" />
                <PathField label="Raw width allowance" value={FR.rawWidthAllowance} onCommit={(v) => setPath(['frame', 'rawWidthAllowance'], v)} hint="ASSUMPTION: raw width = depth + this" />
                <PathField label="Overlap" value={FR.overlap} onCommit={(v) => setPath(['frame', 'overlap'], v)} hint="the leaf over the stop" />
                <PathField label="Gap side" value={FR.gapSide} onCommit={(v) => setPath(['frame', 'gapSide'], v)} hint={`rebate width = overlap + gap = ${rebateW}`} />
                <PathField label="Gap head" value={FR.gapHead} onCommit={(v) => setPath(['frame', 'gapHead'], v)} />
                <PathField label="Floor gap" value={FR.floorGap} onCommit={(v) => setPath(['frame', 'floorGap'], v)} hint="ASSUMPTION (the LSP)" />
                <PathField label="Rebate clearance" value={FR.rebateClearance} onCommit={(v) => setPath(['frame', 'rebateClearance'], v)} hint="rebate depth = leaf thickness + this" />
                <div>
                  <div className="text-ink-400 mb-1">Head joint</div>
                  <select value={FR.headJoint || 'mitre'} onChange={(e) => setPath(['frame', 'headJoint'], e.target.value)} className={selectCls}>
                    <option value="mitre">mitre (45, ASSUMPTION)</option>
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Depth suggestions (wall thickness chips)</div>
                  <ListInput value={FR.depthSuggestions} onCommit={(t) => setList(['frame', 'depthSuggestions'], t)} className={inputCls + ' w-56'} />
                </div>
                <PathField label="Default depth" value={FR.defaultDepth} onCommit={(v) => setPath(['frame', 'defaultDepth'], v)} hint="a new door starts here" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Structural opening (v1.1: the opening is the input; the frame sits this far inside it)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-1">
                <PathField label="Wall gap side" value={FR.wallGapSide} onCommit={(v) => setPath(['frame', 'wallGapSide'], v)} hint="each side: frame width = opening - 2 x this" />
                <PathField label="Wall gap head" value={FR.wallGapHead} onCommit={(v) => setPath(['frame', 'wallGapHead'], v)} hint="frame height = opening - this (the foot stands on the floor)" />
              </div>
              <div className="text-[11px] text-ink-500 mb-3">
                {sizeRule
                  ? <>Rule: opening - {sizeRule.wallGapSide} a side / - {sizeRule.wallGapHead} at the head = frame; leaf = frame - {sizeRule.addWidth} / - {sizeRule.addHeight}. With this profile an opening 1000 x 2100 gives a frame {sizeRule.exampleFrameW} x {sizeRule.exampleFrameH} and a leaf {sizeRule.exampleLeafW} x {sizeRule.exampleLeafH}. A typed leaf overrides the derived one.</>
                  : 'Rule: opening - wall gap a side / - wall gap at the head = frame; leaf = frame - 2 x (gap + outside face) / - (floor gap + gap + outside face).'}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Corner dowels (each mitred corner, bored square to the mitre face, half the length into each piece)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Diameter" value={DW.dia} onCommit={(v) => setPath(['frame', 'dowels', 'dia'], v)} hint="DOWEL_D" />
                <PathField label="Length" value={DW.length} onCommit={(v) => setPath(['frame', 'dowels', 'length'], v)} hint="DOWEL_L; bore depth = half" />
                <PathField label="Per joint" value={DW.perJoint} onCommit={(v) => setPath(['frame', 'dowels', 'perJoint'], v)} hint="DOWEL_N per corner; 0 = none" />
                <PathField label="Margin" value={DW.margin} onCommit={(v) => setPath(['frame', 'dowels', 'margin'], v)} hint="ASSUMPTION: in from each face along the depth" />
              </div>
              <div className="text-ink-300 text-[11px]">
                {fdFrame ? (<>sample frame overall <span className="text-accent-400 font-medium">{fdFrame.overall?.width} × {fdFrame.overall?.height}</span>
                  <span className="text-ink-500"> · opening {fd?.opening?.width} × {fd?.opening?.height} · rebate {fdFrame.rebate?.width} × {fdFrame.rebate?.depth} · faces {fdFrame.faces?.outside} / {fdFrame.faces?.inside} · finished {fdFrame.thickness} × {fdFrame.depth} · raw {fdFrame.rawThickness} × {fdFrame.rawWidth}</span>
                  <span className="text-ink-500"> · visible outside face {faceOutside} from the profile</span>
                  {fdFrame.dowels?.count > 0 && <span className="text-ink-500"> · dowels {fdFrame.dowels.perJoint} × {fdFrame.dowels.dia} × {fdFrame.dowels.length} per corner at {(fdFrame.dowels.positionsAlongDepth || []).join(' / ')} along the depth</span>}</>) : 'n/a'}
              </div>
            </fieldset>
          </div>

          {/* ══ Hinges ══ */}
          <div className={`card p-4 mb-4 ${hingesLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Hinges
                <span className="text-ink-500 font-normal"> · top 150 from the leaf top, bottom ending 200 above the leaf bottom, the middle hinge centre 200 above the leaf centre (v1.1, owner); with more than three the inner ones spread equally</span>
              </div>
              <LockToggle locked={hingesLock} onToggle={() => setHingesLock((x) => !x)} />
            </div>
            <fieldset disabled={hingesLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${hingesLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="Count" value={HG.count} onCommit={(v) => setPath(['hinges', 'count'], v)} hint="3 (a 4th is a BLOCKERS question)" />
                <PathField label="Hinge length" value={HG.length} onCommit={(v) => setPath(['hinges', 'length'], v)} />
                <PathField label="Top offset" value={HG.topOffset} onCommit={(v) => setPath(['hinges', 'topOffset'], v)} hint="leaf top to the top hinge" />
                <PathField label="Bottom offset" value={HG.bottomOffset} onCommit={(v) => setPath(['hinges', 'bottomOffset'], v)} hint="bottom hinge end to the leaf bottom" />
                <PathField label="Middle above centre" value={HG.midAboveCentre} onCommit={(v) => setPath(['hinges', 'midAboveCentre'], v)} hint="the middle hinge CENTRE this far above the leaf centre (3 hinges); 0 = on the centre" />
                <PathField label="Recess length" value={HG.recessLength} onCommit={(v) => setPath(['hinges', 'recessLength'], v)} hint="ASSUMPTION: plate + 1" />
                <PathField label="Recess width" value={HG.recessWidth} onCommit={(v) => setPath(['hinges', 'recessWidth'], v)} hint="ASSUMPTION" />
                <PathField label="Recess depth" value={HG.recessDepth} onCommit={(v) => setPath(['hinges', 'recessDepth'], v)} hint="ASSUMPTION (Weeke had 3.2 / 4 / 4.2)" />
                <PathField label="Corner radius" value={HG.cornerRadius} onCommit={(v) => setPath(['hinges', 'cornerRadius'], v)} hint="ASSUMPTION: R6 (12 cutter)" />
              </div>
              <div className="text-ink-300 text-[11px]" data-fd-sample-hinges>
                {fd ? (<>sample hinges from the leaf top <span className="text-accent-400 font-medium">{fdHinges.map((h) => h.top).join(' / ')}</span>
                  {fd.hinges?.midCentreAboveLeafCentre != null && <span className="text-ink-500"> · middle hinge centre {fd.hinges.midCentreAboveLeafCentre} above the leaf centre</span>}
                  <span className="text-ink-500"> · on the jamb from the top long point {fdHinges.map((h) => h.jambTop).join(' / ')} · recess {fd.hinges?.recess?.length} × {fd.hinges?.recess?.width} × {fd.hinges?.recess?.depth} R{fd.hinges?.recess?.radius}</span></>) : 'n/a'}
              </div>
            </fieldset>
          </div>

          {/* ══ Lock ══ */}
          <div className={`card p-4 mb-4 ${lockLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Lock
                <span className="text-ink-500 font-normal"> · DIN lock case: forend, case pocket, spindle (LOCK_H from the leaf bottom), euro / bathroom centres below the spindle</span>
              </div>
              <LockToggle locked={lockLock} onToggle={() => setLockLock((x) => !x)} />
            </div>
            <fieldset disabled={lockLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${lockLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Spindle height" value={LK.spindleHeight} onCommit={(v) => setPath(['lock', 'spindleHeight'], v)} hint="LOCK_H, from the leaf bottom" />
                <PathField label="Backset" value={LK.backset} onCommit={(v) => setPath(['lock', 'backset'], v)} />
                <PathField label="Euro centres" value={LK.euroCentres} onCommit={(v) => setPath(['lock', 'euroCentres'], v)} hint="cylinder below the spindle" />
                <PathField label="Bathroom centres" value={LK.bathroomCentres} onCommit={(v) => setPath(['lock', 'bathroomCentres'], v)} />
                <PathField label="Case top above spindle" value={LK.caseTopAboveSpindle} onCommit={(v) => setPath(['lock', 'caseTopAboveSpindle'], v)} hint="ASSUMPTION: macro lock_h + 46.5" />
                <PathField label="Forend centre below spindle" value={LK.forendCentreBelowSpindle} onCommit={(v) => setPath(['lock', 'forendCentreBelowSpindle'], v)} hint="ASSUMPTION: macro lock_h - 15" />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Forend (milled + oversize, full radius ends)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Length" value={FO.length} onCommit={(v) => setPath(['lock', 'forend', 'length'], v)} />
                <PathField label="Width" value={FO.width} onCommit={(v) => setPath(['lock', 'forend', 'width'], v)} />
                <PathField label="Mill oversize" value={FO.millOversize} onCommit={(v) => setPath(['lock', 'forend', 'millOversize'], v)} />
                <PathField label="Depth" value={FO.depth} onCommit={(v) => setPath(['lock', 'forend', 'depth'], v)} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Case (the pocket on the lock edge, ASSUMPTION 87 x 153)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Case depth" value={CS.depth} onCommit={(v) => setPath(['lock', 'case', 'depth'], v)} />
                <PathField label="Case height" value={CS.height} onCommit={(v) => setPath(['lock', 'case', 'height'], v)} />
                <PathField label="Pocket width" value={CS.pocketWidth} onCommit={(v) => setPath(['lock', 'case', 'pocketWidth'], v)} />
                <PathField label="Pocket depth" value={CS.pocketDepth} onCommit={(v) => setPath(['lock', 'case', 'pocketDepth'], v)} />
                <PathField label="Pocket height" value={CS.pocketHeight} onCommit={(v) => setPath(['lock', 'case', 'pocketHeight'], v)} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Bores (ASSUMPTION: for the sheets and the export)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="Spindle bore" value={LK.spindleBore} onCommit={(v) => setPath(['lock', 'spindleBore'], v)} />
                <PathField label="Euro bore" value={LK.euroBore} onCommit={(v) => setPath(['lock', 'euroBore'], v)} />
                <PathField label="Bathroom bore" value={LK.bathroomBore} onCommit={(v) => setPath(['lock', 'bathroomBore'], v)} />
              </div>
              <div className="text-ink-300 text-[11px]">
                {fd ? (<>sample spindle <span className="text-accent-400 font-medium">{fd.lock?.spindle?.fromBottom}</span> above the leaf bottom
                  <span className="text-ink-500"> · forend centre {fd.lock?.forend?.centreFromBottom} up, milled {fd.lock?.forend?.millLength} × {fd.lock?.forend?.millWidth} · case pocket top {fd.lock?.case?.topFromBottom} up</span></>) : 'n/a'}
              </div>
            </fieldset>
          </div>

          {/* ══ Keep ══ */}
          <div className={`card p-4 mb-4 ${keepLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Keep
                <span className="text-ink-500 font-normal"> · on the lock jamb opposite the forend: the plate (milled + oversize) and one pocket for the latch and the bolt</span>
              </div>
              <LockToggle locked={keepLock} onToggle={() => setKeepLock((x) => !x)} />
            </div>
            <fieldset disabled={keepLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${keepLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="Plate length" value={KP.length} onCommit={(v) => setPath(['keep', 'length'], v)} />
                <PathField label="Plate width" value={KP.width} onCommit={(v) => setPath(['keep', 'width'], v)} />
                <PathField label="Mill oversize" value={KP.millOversize} onCommit={(v) => setPath(['keep', 'millOversize'], v)} />
                <PathField label="Plate depth" value={KP.plateDepth} onCommit={(v) => setPath(['keep', 'plateDepth'], v)} hint="ASSUMPTION" />
                <PathField label="Pocket length" value={KPK.length} onCommit={(v) => setPath(['keep', 'pocket', 'length'], v)} hint="ASSUMPTION" />
                <PathField label="Pocket width" value={KPK.width} onCommit={(v) => setPath(['keep', 'pocket', 'width'], v)} />
                <PathField label="Pocket depth" value={KPK.depth} onCommit={(v) => setPath(['keep', 'pocket', 'depth'], v)} />
              </div>
              <div className="text-ink-300 text-[11px]" data-fd-sample-keep>
                {fd ? (<>sample keep centre <span className="text-accent-400 font-medium">{fd.keep?.centreFromFoot}</span> above the jamb foot
                  <span className="text-ink-500"> · {fd.keep?.centreFromTop} from the top long point · plate milled {fd.keep?.plate?.millLength} × {fd.keep?.plate?.millWidth} · KEEP {fd.keep?.macroKeep}</span></>) : 'n/a'}
              </div>
            </fieldset>
          </div>

          {/* ══ Vision panel ══ */}
          <div className={`card p-4 mb-4 ${vpLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Vision panel
                <span className="text-ink-500 font-normal"> · the placement the sheets and the 3D use (ASSUMPTION: the macro placement is not decoded, the export sends the style id); the style table is the macro's, read only</span>
              </div>
              <LockToggle locked={vpLock} onToggle={() => setVpLock((x) => !x)} />
            </div>
            <fieldset disabled={vpLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${vpLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Top rail" value={VP.topRail} onCommit={(v) => setPath(['vp', 'topRail'], v)} hint="leaf top to the first pane (D_TOP_RAIL)" />
                <PathField label="Mid rail" value={VP.midRail} onCommit={(v) => setPath(['vp', 'midRail'], v)} hint="the A/B pair gap (D_MID_RAIL)" />
                <PathField label="Side margin" value={VP.sideMargin} onCommit={(v) => setPath(['vp', 'sideMargin'], v)} hint="D_SIDE_MARGIN" />
                <PathField label="Stack gap" value={VP.stackGap} onCommit={(v) => setPath(['vp', 'stackGap'], v)} hint="the nNo styles" />
                <PathField label="Corner radius" value={VP.cornerRadius} onCommit={(v) => setPath(['vp', 'cornerRadius'], v)} />
                <PathField label="Bead faces" value={VP.beadFaces} onCommit={(v) => setPath(['vp', 'beadFaces'], v)} hint="bead metres = perimeter x this" />
                <PathField label="Glass thickness" value={VP.glassThickness} onCommit={(v) => setPath(['vp', 'glassThickness'], v)} hint="fire glass and toughened" />
              </div>
            </fieldset>
            <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">VP_STYLE table (ids 1:1 with the macro)</div>
            <table className="w-full text-[11px]">
              <thead><tr className="text-ink-500 text-left"><th className="pr-2 font-medium">id</th><th className="pr-2 font-medium">label</th><th className="pr-2 font-medium">pane</th><th className="pr-2 font-medium">count</th><th className="font-medium">arrange</th></tr></thead>
              <tbody>
                {(VP.styles || []).map((s) => (
                  <tr key={s.id} className="text-ink-300 border-t border-surface-500/40">
                    <td className="pr-2 py-0.5 font-mono">{s.id}</td><td className="pr-2 py-0.5">{s.label}</td>
                    <td className="pr-2 py-0.5">{s.panes ? s.panes.map((q) => `${q.w} × ${q.h}`).join(' + ') : (s.count ? `${s.w} × ${s.h}` : '')}</td>
                    <td className="pr-2 py-0.5">{s.count || ''}</td><td className="py-0.5">{s.arrange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ══ Intumescent ══ */}
          <div className={`card p-4 mb-4 ${intuLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Intumescent
                <span className="text-ink-500 font-normal"> · v1.1: one strip size all around (top and both edges), FD30 one strip, FD60 two, a non-fire door none; the groove the macro cuts; metres = strips x (2 x H + W)</span>
              </div>
              <LockToggle locked={intuLock} onToggle={() => setIntuLock((x) => !x)} />
            </div>
            <fieldset disabled={intuLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${intuLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <PathField label="Strip width" value={IN.width} onCommit={(v) => setPath(['intumescent', 'width'], v)} hint="INTU_W" />
                <PathField label="Strip thickness" value={IN.thickness} onCommit={(v) => setPath(['intumescent', 'thickness'], v)} hint="INTU_T" />
                <PathField label="Groove width" value={IN.grooveWidth} onCommit={(v) => setPath(['intumescent', 'grooveWidth'], v)} hint="two passes of the 10 disk" />
                <PathField label="Groove depth" value={IN.grooveDepth} onCommit={(v) => setPath(['intumescent', 'grooveDepth'], v)} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Strips by rating (INTU = the count; a non-fire door is always 0)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="FD30" value={SBR.FD30} onCommit={(v) => setPath(['intumescent', 'stripsByRating', 'FD30'], v)} />
                <PathField label="FD60" value={SBR.FD60} onCommit={(v) => setPath(['intumescent', 'stripsByRating', 'FD60'], v)} />
                <PathField label="Two-strip offset" value={IN.twoStripOffset} onCommit={(v) => setPath(['intumescent', 'twoStripOffset'], v)} hint="ASSUMPTION: the two grooves at LPZ / 2 +- this" />
              </div>
              <div className="text-ink-300 text-[11px] mb-1" data-fd-sample-intu>
                {fd ? (fd.intumescent
                  ? (<>sample <span className="text-accent-400 font-medium">{fd.intumescent.label}</span> · groove {fd.intumescent.groove?.width} × {fd.intumescent.groove?.depth} = <span className="text-accent-400 font-medium">{fd.intumescent.metres} m</span> · INTU_STYLE {fd.intumescent.macroStyle}</>)
                  : 'sample door: non-fire, no intumescent') : 'n/a'}
              </div>
            </fieldset>
          </div>

          {/* ══ bSuite ══ */}
          {BS && (() => {
            const T = BS.targets || [];
            const active = T.find((t) => t.id === BS.activeTarget) || T[0];
            if (!active) return null;
            const save = (targets, activeId = BS.activeTarget) => setBsuiteTargets(targets, activeId);
            const patchActive = (patch) => save(T.map((t) => (t.id === active.id ? { ...t, ...patch } : t)));
            const patchProgram = (key, patch) => patchActive({ programs: { ...active.programs, [key]: { ...active.programs[key], ...patch } } });
            const addTarget = () => {
              const n = T.length + 1; const id = `target-${Date.now().toString(36)}`;
              save([...T, { ...active, id, name: `Computer ${n}`, programs: Object.fromEntries(Object.entries(active.programs).map(([k, v]) => [k, { ...v }])), executionParameters: { ...active.executionParameters } }], id);
            };
            const removeTarget = () => { if (T.length > 1 && window.confirm(`Remove target "${active.name}"?`)) save(T.filter((t) => t.id !== active.id), T.find((t) => t.id !== active.id).id); };
            // Explorer's "Copy as path" wraps the path in quotes: strip them, and any whitespace
            const cleanPath = (v) => String(v || '').replace(/"/g, '').trim().replace(/^'+|'+$/g, '').trim().replace(/\\/g, '/');
            const fillFromFolder = (folder) => {
              const f = cleanPath(folder).replace(/\/+$/, '');
              if (!f) return;
              patchActive({ programs: Object.fromEntries(Object.entries(active.programs).map(([k, v]) => [k, { ...v, path: v.path ? `${f}/${String(v.path).split(/[\\/]/).pop()}` : v.path }])) });
            };
            const EP = active.executionParameters || {};
            return (
              <div className={`card p-4 mb-4 ${bsuiteLock ? '' : 'ring-1 ring-amber-500/40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-ink-200">bSuite export
                    <span className="text-ink-500 font-normal"> · four rows per door (leaf, head, hinge jamb, lock jamb), the Label = the door name, document variables named as the macro parameters; one target per computer</span>
                  </div>
                  <LockToggle locked={bsuiteLock} onToggle={() => setBsuiteLock((x) => !x)} />
                </div>
                <fieldset disabled={bsuiteLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${bsuiteLock ? 'opacity-60' : ''}`}>
                  <div className="text-ink-400 mb-1">Target computer (the list is built for the active one)</div>
                  <div className="flex flex-wrap gap-1.5 items-center mb-3">
                    {T.map((t) => (
                      <button key={t.id} type="button" onClick={() => save(T, t.id)} className={chip(t.id === active.id)}>{t.name}</button>
                    ))}
                    <button type="button" onClick={addTarget} className="px-2.5 py-1 text-[11px] rounded-lg border border-dashed border-surface-500 text-ink-300 hover:text-ink-50 hover:border-surface-400">+ add</button>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                    <div>
                      <div className="text-ink-400 mb-1">Name</div>
                      <input type="text" defaultValue={active.name} key={`${active.id}-name`}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== active.name) patchActive({ name: v }); }}
                        className="w-52 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                    </div>
                    <div>
                      <div className="text-ink-400 mb-1">Fill the set paths from a folder (keeps the file names)</div>
                      <input type="text" placeholder="C:/Users/Xp600/Desktop/Biesse Piotr" key={`${active.id}-fill`}
                        onKeyDown={(e) => { if (e.key === 'Enter') { fillFromFolder(e.target.value); e.target.value = ''; } }}
                        onBlur={(e) => { if (e.target.value.trim()) { fillFromFolder(e.target.value); e.target.value = ''; } }}
                        className="w-80 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                    </div>
                    {T.length > 1 && (
                      <button type="button" onClick={removeTarget} className="px-2.5 py-1.5 text-[11px] rounded-lg border border-surface-500 text-ink-300 hover:text-red-400 hover:border-red-500/60">remove target</button>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Programs: path on this computer (ProgramUri) and the .bSolid file embedded in the list. An empty path = that block is skipped with a message (the 5-axis frame masters do not exist yet).</div>
                  <div className="space-y-1.5 max-w-4xl">
                    {Object.keys(FD_PROGRAM_LABEL).map((k) => {
                      const prog = active.programs?.[k] || { path: '' };
                      const st = prog.stored;
                      const fileName = String(prog.path || '').split(/[\\/]/).pop();
                      const mismatch = st && fileName && st.fileName !== fileName;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-ink-400 w-24 shrink-0">{FD_PROGRAM_LABEL[k]}</span>
                          <input type="text" defaultValue={prog.path} key={`${active.id}-${k}-${prog.path}`}
                            placeholder="no program yet: rows skipped"
                            onBlur={(e) => { const v = cleanPath(e.target.value); if (v !== prog.path) patchProgram(k, { path: v }); }}
                            className="flex-1 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs font-mono" />
                          <label className={`shrink-0 px-2.5 py-1 text-[11px] rounded-lg border cursor-pointer ${st ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : 'border-amber-500/50 text-amber-400 bg-amber-500/5'}`}
                            title={st ? `${st.fileName} · ${(st.bytes / 1048576).toFixed(1)} MB · ${new Date(st.uploadedAt).toLocaleString('en-GB')}` : 'No file uploaded: the list would show this row red'}>
                            {st ? `✓ ${(st.bytes / 1048576).toFixed(1)} MB` : '↑ Upload .bSolid'}
                            <input type="file" accept=".bSolid,.bsolid" className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0]; e.target.value = '';
                                if (!f) return;
                                try {
                                  const stored = await uploadBsuiteProgram(active.id, k, f);
                                  patchProgram(k, { stored, path: prog.path ? prog.path.replace(/[^\\/]+$/, f.name) : f.name });
                                } catch (err) { alert(`Upload failed: ${err?.message || err}`); }
                              }} />
                          </label>
                          {st && (
                            <button type="button" onClick={async () => { if (!window.confirm(`Remove the uploaded ${st.fileName}?`)) return; try { await removeBsuiteProgram(st.storagePath); } catch { /* keep going */ } patchProgram(k, { stored: null }); }}
                              className="shrink-0 text-[11px] text-ink-500 hover:text-red-400" title="Remove the uploaded file">✕</button>
                          )}
                          {mismatch && <span className="text-[10px] text-amber-400" title="The uploaded file's name differs from the path's file name: the list uses the path's name">name differs</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-1">Green = file uploaded and embedded on export. Amber = missing: that row would be red in bSolid. The leaf master is FD_LEAF_MASTER_PIOTR.bSolid (macro Master_Door_PIOTR); the frame masters come with the 5-axis programs.</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mt-4 mb-3">
                    <div>
                      <div className="text-ink-400 mb-1">STOP rows between the blocks</div>
                      <BoolChips value={BS.stopRows !== false} onPick={(v) => setPath(['bsuite', 'stopRows'], v)} />
                    </div>
                    <div>
                      <div className="text-ink-400 mb-1">Table placement (ExecutionParameters)</div>
                      <div className="flex gap-1.5">
                        {[[true, 'Write placement'], [false, 'Default origins']].map(([v, l]) => (
                          <button key={String(v)} type="button" onClick={() => patchActive({ writeExecutionParameters: v })} className={chip(active.writeExecutionParameters === v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                    {active.writeExecutionParameters && (
                      <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">
                        {[['origin', 'ExOrigin'], ['refCorner', 'Corner'], ['offsetX', 'Offset X'], ['offsetY', 'Offset Y'], ['offsetZ', 'Offset Z'], ['rotZ', 'Rot Z']].map(([k, l]) => (
                          <div key={k}>
                            <div className="text-ink-400 mb-1 text-[10px]">{l}</div>
                            <input type="text" inputMode="decimal" defaultValue={EP[k]} key={`${active.id}-ex-${k}-${EP[k]}`}
                              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== EP[k]) patchActive({ executionParameters: { ...EP, [k]: v } }); }}
                              className="w-20 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs text-right" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">HAND map (ASSUMPTION: macro HAND 0 = "Hinge left" of the form; the owner checks in bSolid)</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                    <PathField label="Hinge left" value={BS.hand?.left} onCommit={(v) => setPath(['bsuite', 'hand', 'left'], v)} />
                    <PathField label="Hinge right" value={BS.hand?.right} onCommit={(v) => setPath(['bsuite', 'hand', 'right'], v)} />
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Macro defaults (the parameters a single door never changes, table 4.7)</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 items-end mb-2">
                    {Object.keys(BS.macroDefaults || {}).map((k) => (
                      <div key={k}>
                        <div className="text-ink-400 mb-1 text-[10px] font-mono">{k}</div>
                        <NumInput value={BS.macroDefaults[k]} onCommit={(v) => setPath(['bsuite', 'macroDefaults', k], v)}
                          className="w-16 px-2 py-1 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-xs text-right" />
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Intumescent variables (v1.1, read only)</div>
                  <div className="text-[11px] text-ink-500 mb-2">
                    INTU = the strip count (0 none / 1 FD30 / 2 FD60), INTU_W and INTU_T = the strip size of the Intumescent card, INTU_STYLE = the Master_Door style the count maps to: {Object.entries(IN.macroStyleByStrips || {}).map(([n, s]) => `${n} strip${Number(n) === 1 ? '' : 's'} -> style ${s}`).join(', ') || 'n/a'}.
                  </div>
                  <div className="text-[11px] text-ink-500 mb-2">
                    CLOSER = 0 none / 1 surface / 2 built in (v1.1). The frame rows carry the corner dowels: DOWEL_N (per mitred end), DOWEL_D, DOWEL_L, DOWEL_DEPTH (half the length) and DOWEL_1..n (the positions along the depth from the outside face).
                  </div>
                  <div className="text-[11px] text-ink-500">
                    Today the leaf master has only LPX / LPY / LPZ as document variables; the rest (HAND, HINGE, LOCK, LOCK_H, EURO, KEEP, INTU, INTU_W, INTU_T, INTU_STYLE, VP_STYLE, C_VP_*, HINGE_1..3, HINGE_D, CLOSER) must be added as document variables in bSolid and bound inside Master_Door_PIOTR before a row from PC steers the hinges and the lock (BLOCKERS 35).
                  </div>
                </fieldset>
              </div>
            );
          })()}

          {/* ══ Configurator defaults ══ */}
          <div className={`card p-4 ${defaultsLock ? '' : 'ring-1 ring-amber-500/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-ink-200">Defaults of a new door in the configurator</div>
              <LockToggle locked={defaultsLock} onToggle={() => setDefaultsLock((x) => !x)} />
            </div>
            <fieldset disabled={defaultsLock} className={`text-xs border-0 p-0 m-0 min-w-0 ${defaultsLock ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <div>
                  <div className="text-ink-400 mb-1">Fire</div>
                  <BoolChips value={DF.fire !== false} onPick={(v) => setPath(['defaults', 'fire'], v)} />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Rating</div>
                  <StringChips value={DF.rating} options={FD_SET_RATINGS} onPick={(v) => setPath(['defaults', 'rating'], v)} />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Hinge side</div>
                  <StringChips value={DF.hingeSide} options={FD_SET_HANDS} onPick={(v) => setPath(['defaults', 'hingeSide'], v)} />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Lock</div>
                  <StringChips value={DF.lockType} options={FD_SET_LOCKS} onPick={(v) => setPath(['defaults', 'lockType'], v)} />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Leading edge</div>
                  <BoolChips value={DF.leadEdge !== false} onPick={(v) => setPath(['defaults', 'leadEdge'], v)} />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Closer (v1.1: a kind; the door's closer follows fire until picked on the door)</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <div>
                  <div className="text-ink-400 mb-1">Fire door closer</div>
                  <select value={FIREDOOR_CLOSER_KINDS.includes(DF.closerFire) ? DF.closerFire : 'none'} onChange={(e) => setPath(['defaults', 'closerFire'], e.target.value)} className={selectCls}>
                    {FD_SET_CLOSERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Non-fire door closer</div>
                  <select value={FIREDOOR_CLOSER_KINDS.includes(DF.closerNonFire) ? DF.closerNonFire : 'none'} onChange={(e) => setPath(['defaults', 'closerNonFire'], e.target.value)} className={selectCls}>
                    {FD_SET_CLOSERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="text-[10px] text-ink-500">The built in closer is not machined until the owner's component files arrive (BLOCKERS 35).</div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
                <div>
                  <div className="text-ink-400 mb-1">Vision panel style</div>
                  <select value={DF.vpStyle ?? 0} onChange={(e) => setPath(['defaults', 'vpStyle'], e.target.value)} className={selectCls}>
                    {(VP.styles || []).map((s) => <option key={s.id} value={s.id}>{s.id} · {s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Custom vision panel (style 14) defaults</div>
              <div className="flex flex-wrap gap-x-5 gap-y-3 items-end mb-2">
                <PathField label="Length" value={DF.vpCustom?.length} onCommit={(v) => setPath(['defaults', 'vpCustom', 'length'], v)} />
                <PathField label="Width" value={DF.vpCustom?.width} onCommit={(v) => setPath(['defaults', 'vpCustom', 'width'], v)} />
                <PathField label="Count" value={DF.vpCustom?.count} onCommit={(v) => setPath(['defaults', 'vpCustom', 'count'], v)} />
                <PathField label="Rail" value={DF.vpCustom?.rail} onCommit={(v) => setPath(['defaults', 'vpCustom', 'rail'], v)} />
                <PathField label="Position" value={DF.vpCustom?.pos} onCommit={(v) => setPath(['defaults', 'vpCustom', 'pos'], v)} hint="0 vertical / 90 horizontal" />
              </div>
              <div className="text-[10px] text-ink-500">
                Defaults: the owner's numbers of 27.10.2026 (CLAUDE.md fire doors v1). The values marked ASSUMPTION are the programmer's proposals, listed in docs/BLOCKERS.md 35, to confirm.
              </div>
            </fieldset>
          </div>
        </div>

        {/* RIGHT 1/3: the live sample numbers */}
        <div className="w-1/3 min-w-0 shrink-0 sticky top-4" data-fd-sample>
          <div className="text-sm font-semibold text-ink-50 mb-2">
            Sample door <span className="text-ink-500 font-normal text-xs">· {sampleFire ? sampleRating : 'non-fire'} · leaf {W} × {Hh} · wall {Dd}</span>
          </div>
          {fd ? (
            <div className="card p-3 text-xs">
              {[
                ['Name', fmt(fd.name)],
                ['Rating', fd.fire ? fmt(fd.rating) : 'non-fire'],
                ['Hand', fmt(fd.handing?.label)],
                ['Structural opening', `${fmt(fd.opening?.width)} × ${fmt(fd.opening?.height)}${fd.opening?.source === 'leaf' ? ' (from the leaf)' : ''}`],
                ['Leaf', `${fmt(fd.leaf?.width)} × ${fmt(fd.leaf?.height)} × ${fmt(fd.leaf?.thickness)}`],
                ['Frame overall', `${fmt(fdFrame?.overall?.width)} × ${fmt(fdFrame?.overall?.height)}`],
                ['Rebate', `${fmt(fdFrame?.rebate?.width)} × ${fmt(fdFrame?.rebate?.depth)} · faces ${fmt(fdFrame?.faces?.outside)} / ${fmt(fdFrame?.faces?.inside)}`],
                ['Members', `${fmt(fdFrame?.thickness)} × ${fmt(fdFrame?.depth)} finished · ${fmt(fdFrame?.rawThickness)} × ${fmt(fdFrame?.rawWidth)} raw`],
                ...(fdFrame?.members || []).map((m) => [m.id, `${fmt(m.length)} long point · ${m.rawSection || ''}${m.mitreTop ? ' · mitre top' : ''}${m.mitreBottom ? ' · mitre bottom' : ''}`]),
                ['Hinges (leaf top)', fdHinges.map((h) => h.top).join(' / ') || 'n/a'],
                ...(fd.hinges?.midCentreAboveLeafCentre != null ? [['Middle hinge', `centre ${fmt(fd.hinges.midCentreAboveLeafCentre)} above the leaf centre`]] : []),
                ['Hinges (jamb top)', fdHinges.map((h) => h.jambTop).join(' / ') || 'n/a'],
                ...(fdFrame?.dowels?.count > 0 ? [['Corner dowels', `${fmt(fdFrame.dowels.perJoint)} × ${fmt(fdFrame.dowels.dia)} × ${fmt(fdFrame.dowels.length)} per corner`]] : []),
                ['Hinge macro', `HINGE ${fmt(fd.hinges?.macroHinge)} · ${fmt(fd.hinges?.product)}`],
                ['Lock', `${fmt(fd.lock?.type)} · LOCK ${fmt(fd.lock?.macroLock)} · EURO ${fd.lock?.euro ? 1 : 0}`],
                ['Spindle', `${fmt(fd.lock?.spindle?.fromBottom)} above the leaf bottom · backset ${fmt(fd.lock?.backset)}`],
                ['Forend', `centre ${fmt(fd.lock?.forend?.centreFromBottom)} up · ${fmt(fd.lock?.forend?.millLength)} × ${fmt(fd.lock?.forend?.millWidth)}`],
                ['Keep centre', `${fmt(fd.keep?.centreFromFoot)} above the jamb foot · KEEP ${fmt(fd.keep?.macroKeep)}`],
                ['Closer', fd.closer ? fmt(fd.closer.label) : 'none'],
                ['Vision panel', `${fmt(fd.vp?.label)}${fd.vp?.panes?.length ? ` · ${fd.vp.panes.length} pane(s) · ${fmt(fd.vp?.glassSqm)} m²` : ''}`],
                ['Intumescent', fd.intumescent ? `${fmt(fd.intumescent.label)} · ${fmt(fd.intumescent.metres)} m` : 'none (non-fire)'],
                ['Paint area', `${fmt(fd.paintAreaSqm)} m²`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3 py-0.5 border-b border-surface-500/30 last:border-0">
                  <span className="text-ink-400 shrink-0">{l}</span><span className="text-ink-100 font-medium text-right">{v}</span>
                </div>
              ))}
              <div className="text-[10px] text-ink-500 mt-2">
                Live from the engine: every field on the left reshapes these numbers. The sheets live on the window page and in the pack.
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-xs text-ink-400">Sample door unavailable{sample?.error ? `: ${sample.error}` : '.'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
