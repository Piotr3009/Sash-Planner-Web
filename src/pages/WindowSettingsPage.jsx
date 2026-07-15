import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useWindowProfileStore } from '../stores/windowProfileStore.js';
import { kgPerM } from '../engine/profile.js';
import { CONSTANTS, deriveWindowData } from '../engine/calculations.js';
import { normaliseToWindowSpec } from '../engine/specification.js';
import BoxDetail2D from '../components/drawings/BoxDetail2D.jsx';
import SashDetail2D from '../components/drawings/SashDetail2D.jsx';
import JambDetail2D from '../components/drawings/JambDetail2D.jsx';

// ─── Element metadata: engine names, groups, editable fields, length rules ───
const RAW_OPTIONS = ['63x63', '63x95'];

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
  const setBoardInset = useWindowProfileStore((s) => s.setBoardInset);
  const setCillTwoPiece = useWindowProfileStore((s) => s.setCillTwoPiece);
  const resetToDefaults = useWindowProfileStore((s) => s.resetToDefaults);

  const [variantKey, setVariantKey] = useState('standard');
  const [selected, setSelected] = useState('bottomRail');
  const [sampleW, setSampleW] = useState(1000);
  const [sampleH, setSampleH] = useState(1500);

  const variant = profile.variants[variantKey] || profile.variants.standard;
  const els = profile.elements;
  const ded = profile.deductions;
  const boardW = variant.boxDepth - profile.boardInset;

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

  if (typeId && typeId !== 'sash') {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-ink-50 mb-2">Window Settings</h1>
        <div className="text-sm text-ink-400">Profile for "{typeId}" is coming soon. Sash windows are available now.</div>
      </div>
    );
  }

  const allElements = [...BOX_ELEMENTS, ...SASH_ELEMENTS];
  const sel = allElements.find((e) => e.key === selected) || SASH_ELEMENTS[3];
  const selData = els[sel.key];
  const selLen = sel.kind === 'liner' ? linerLength(sel) : lengthInfo(sel);
  const selKg = sel.kind === 'sash' ? kgPerM(selData.face, variant.sashDepth) : null;

  const num = (v, fb = 0) => (v === '' ? '' : Number(v) || fb);

  return (
    <div className="p-6 max-w-6xl">
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
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(profile.variants).map(([k, v]) => (
            <button key={k} onClick={() => setVariantKey(k)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${variantKey === k ? 'border-accent-500 bg-accent-500/15 text-accent-400 font-medium' : 'border-surface-500 text-ink-200 bg-surface-600 hover:bg-surface-500'}`}>
              {v.label} · {v.boxDepth}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-end text-xs">
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
            <div className="text-ink-400 mb-1">Head/Jamb board inset (mm)</div>
            <input type="number" value={profile.boardInset}
              onChange={(e) => setBoardInset(e.target.value)}
              className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
          </div>
          <div className="text-ink-300 pb-1.5">
            Board width: <span className="text-accent-400 font-medium">{boardW} mm</span>
            <span className="text-ink-500"> = {variant.boxDepth} − {profile.boardInset}</span>
          </div>
        </div>
      </div>

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

      {/* Sash parts */}
      <div className="text-sm font-semibold text-ink-50 mb-2">Sash</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-1.5 mb-5">
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

      {/* Edit panel + cill toggle */}
      <div className="flex gap-3 items-stretch mb-5 flex-wrap">
        <div className="card p-4 flex-[1.5] min-w-[320px]">
          <div className="flex justify-between items-baseline mb-3">
            <div><span className="text-[11px] text-ink-400">Selected: </span><span className="text-sm font-semibold text-ink-50">{sel.name}</span></div>
            {selKg !== null && <span className="text-[11px] text-ink-400">{selKg.toFixed(2)} kg/m auto</span>}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
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
                <div>
                  <div className="text-ink-400 mb-1">Width (mm)</div>
                  <input type="number" value={selData.w} onChange={(e) => setElementField(sel.key, 'w', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div>
                  <div className="text-ink-400 mb-1">Height (mm)</div>
                  <input type="number" value={selData.h} onChange={(e) => setElementField(sel.key, 'h', e.target.value)}
                    className="w-24 px-2 py-1.5 bg-surface-800 border border-surface-500 text-ink-50 rounded-lg text-sm" />
                </div>
                <div className="text-ink-400 pt-5">Length = frame W + per-window extension</div>
              </>
            )}
          </div>
          <div className="text-[11px] text-ink-500 mt-3 pt-2 border-t border-surface-500">
            = {selLen.val} mm for sample {W} × {H} · feeds cut list, pre-cut, BOM{sel.kind === 'sash' ? ', weights' : ''}
          </div>
        </div>

        <div className="card p-4 flex-1 min-w-[260px] flex flex-col justify-center gap-2 text-xs">
          <div className="text-ink-400 font-medium">Window sill</div>
          <label className="flex items-center gap-2 text-ink-200 cursor-pointer">
            <input type="radio" name="cillMode" checked={!profile.cillTwoPiece} onChange={() => setCillTwoPiece(false)} className="accent-accent-500" />
            One piece
          </label>
          <label className="flex items-center gap-2 text-ink-200 cursor-pointer">
            <input type="radio" name="cillMode" checked={profile.cillTwoPiece} onChange={() => setCillTwoPiece(true)} className="accent-accent-500" />
            Two piece (cill + nose)
          </label>
          <div className="text-[10px] text-ink-500">Affects cut list, pre-cut, BOM parts and drawings.</div>
        </div>
      </div>

      {/* Advanced deductions */}
      <div className="card p-4 mb-5 border-amber-500/30">
        <div className="text-xs font-semibold text-amber-400 mb-1">Advanced — geometry deductions</div>
        <div className="text-[11px] text-ink-400 mb-3">These are coupled to jamb, liner and bead geometry. Changing them reshapes every window — verify with a test window before production.</div>
        <div className="flex flex-wrap gap-4 text-xs">
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
            {allElements.filter((el) => el.key !== 'cillNose' || profile.cillTwoPiece).map((el) => {
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
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-ink-500 mt-2">Defaults = OTD profile · glazing bars stay built-in · values apply to new calculations immediately</div>
        </div>

        <div className="w-[380px] xl:w-[460px] shrink-0 sticky top-4">
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
            <div className="card p-2 col-span-2 flex justify-center">
              <div className="w-1/2">
                <JambDetail2D boardWidth={boardW} thickness={els.jambs.thickness}
                  selected={selected === 'jambs'} onClick={setSelected} />
              </div>
            </div>
            <div className="card p-2">
              <SashDetail2D windowSpec={sample.ws} derived={sample.derived} type="upper"
                selectedElement={selected} onElementClick={setSelected} />
            </div>
            <div className="card p-2">
              <SashDetail2D windowSpec={sample.ws} derived={sample.derived} type="lower"
                selectedElement={selected} onElementClick={setSelected} />
            </div>
          </div>
        </>
      )}

        </div>
      </div>
    </div>
  );
}
