import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import { buildHardwareList, buildGlassListForWindow, buildPrecutForWindow } from '../engine/lists.js';
import WindowPreview3D from '../components/viewer/WindowPreview3D.jsx';
import DrawingsPanel from '../components/drawings/DrawingsPanel.jsx';
import GlassDrawing2D from '../components/drawings/GlassDrawing2D.jsx';
import CutListPanel from '../components/dashboard/CutListPanel.jsx';
import PreCutPanel from '../components/dashboard/PreCutPanel.jsx';
import ExportControls from '../components/export/ExportControls.jsx';


const TABS = [
  { id: '3d', label: '3D Preview', icon: '🧊' },
  { id: '2d', label: '2D Drawings', icon: '📐' },
  { id: 'precut', label: 'Pre-Cut', icon: '📏' },
  { id: 'cutlist', label: 'Cut List', icon: '🪚' },
  { id: 'glass', label: 'Glass', icon: '🪟' },
  { id: 'bom', label: 'BOM', icon: '📋' },
];

export default function WindowDetailPage() {
  const { projectId, batchId, windowId } = useParams();
  const projects = useProjectStore((s) => s.projects);
  const currentWindows = useProjectStore((s) => s.currentWindows);
  const currentBatch = useProjectStore((s) => s.currentBatch);
  const settings = useProjectStore((s) => s.settings);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentBatch = useProjectStore((s) => s.setCurrentBatch);

  useEffect(() => {
    const allProjects = useProjectStore.getState().projects;
    const project = allProjects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      const batch = project.batches?.find(b => b.id === batchId);
      if (batch) setCurrentBatch(batch);
    }
  }, [projectId, batchId, projects.length]);

  const item = useMemo(() => {
    let found = currentWindows.find((w) => w.id === windowId);
    if (!found) {
      const project = projects.find(p => p.id === projectId);
      const batch = project?.batches?.find(b => b.id === batchId);
      found = batch?.windows?.find(w => w.id === windowId);
    }
    return found || null;
  }, [currentWindows, projects, projectId, batchId, windowId]);

  const spec = useMemo(() => (item ? parseSpecification(item.specification) : null), [item]);
  const windowSpec = useMemo(() => (item ? normaliseToWindowSpec(item, spec) : null), [item, spec]);
  const derived = useMemo(() => {
    if (!windowSpec) return null;
    try { return deriveWindowData(windowSpec, settings); }
    catch (e) { console.warn('Calculation failed:', e); return null; }
  }, [windowSpec, settings]);

  const [tab, setTab] = useState('3d');

  const backUrl = `/projects/${projectId}`;
  const editUrl = `/projects/${projectId}/batches/${batchId}/configurator?edit=${windowId}`;

  if (!item) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link to={backUrl} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to project</Link>
        <div className="card p-8 mt-4 text-center text-ink-400">Window not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to={backUrl} className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← Back to project</Link>
      <div className="flex items-end justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">{item.name || `Window`}</h1>
          <p className="text-sm text-ink-400">
            {item.window_type || 'sash'} · {item.width}×{item.height} mm
            {currentBatch && <span> · {currentBatch.label}</span>}
          </p>
        </div>
        <Link to={editUrl} className="btn btn-primary text-sm">✏️ Edit Configuration</Link>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-surface-500 flex gap-1 mb-4">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === t.id
                ? 'border-accent-500 text-accent-400'
                : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}>
            <span className="text-base">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="xl:col-span-2">
          {tab === '3d' && (
            <div className="card p-2">
              <div className="flex items-center justify-between p-2">
                <div className="text-sm font-medium text-ink-50">3D Preview</div>
                <Link to={editUrl} className="px-3 py-1 text-xs rounded bg-surface-600 text-ink-200 hover:bg-surface-500 hover:text-ink-50 transition-colors">
                  ✏️ Edit
                </Link>
              </div>
              <div className="aspect-[4/3] bg-gradient-to-br from-surface-600 to-surface-700 rounded-lg overflow-hidden">
                <WindowPreview3D windowSpec={windowSpec} side="exterior" />
              </div>
            </div>
          )}

          {tab === '2d' && (
            <DrawingsPanel windowSpec={windowSpec} settings={settings} derived={derived} />
          )}

          {tab === 'cutlist' && (
            <CutListPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} />
          )}

          {tab === 'precut' && (
            <PreCutPanel windowSpec={windowSpec} settings={settings} derived={derived} />
          )}

          {tab === 'glass' && (
            <GlassPanel windowSpec={windowSpec} derived={derived} />
          )}

          {tab === 'bom' && (
            <BOMPanel item={item} windowSpec={windowSpec} settings={settings} derived={derived} />
          )}
        </div>

        {/* RIGHT: Spec panel */}
        <aside className="card p-5 space-y-4 self-start">
          <SpecSection title="Frame">
            <SpecRow label="Width" value={`${windowSpec?.frame.width} mm`} />
            <SpecRow label="Height" value={`${windowSpec?.frame.height} mm`} />
            <SpecRow label="Depth" value={`${windowSpec?.frame.depth || 164} mm`} />
          </SpecSection>
          <SpecSection title="Sashes & Bars">
            <SpecRow label="Grid" value={windowSpec?.sash.grid.mode} />
            <SpecRow label="Upper" value={item.upperBars || 'none'} />
            {!item.sameBars && <SpecRow label="Lower" value={item.lowerBars || 'none'} />}
            <SpecRow label="Horns" value={windowSpec?.sash.hornType || 'none'} />
          </SpecSection>
          <SpecSection title="Glass">
            <SpecRow label="Type" value={windowSpec?.glazing.type} />
            <SpecRow label="Spec" value={windowSpec?.glazing.spec} />
            <SpecRow label="Finish" value={windowSpec?.glazing.finish} />
            <SpecRow label="Spacer" value={windowSpec?.glazing.spacerColour} />
          </SpecSection>
          <SpecSection title="Colour">
            <SpecRow label="Mode" value={windowSpec?.color.type} />
            <ColourRow label="Colour" hex={windowSpec?.color.single} />
            {windowSpec?.color.type === 'dual' && <>
              <ColourRow label="Exterior" hex={windowSpec?.color.outside} />
              <ColourRow label="Interior" hex={windowSpec?.color.inside} />
            </>}
          </SpecSection>
          <SpecSection title="Hardware">
            <SpecRow label="Finish" value={windowSpec?.hardware.finish} />
            <SpecRow label="Security" value={windowSpec?.hardware.catches} />
          </SpecSection>
          {derived && (
            <SpecSection title="Calculated">
              <SpecRow label="Sash W" value={`${derived.sashWidth} mm`} />
              <SpecRow label="Top H" value={`${derived.topSashHeight} mm`} />
              <SpecRow label="Bot H" value={`${derived.bottomSashHeight} mm`} />
            </SpecSection>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Glass Panel — same source as Production Pack ───
function GlassPanel({ windowSpec, derived }) {
  const glassList = useMemo(
    () => (derived && windowSpec ? buildGlassListForWindow(derived, windowSpec) : []),
    [derived, windowSpec]
  );

  if (!glassList.length) {
    return <div className="card p-8 text-center text-ink-400">No glass data.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Glass schedule table */}
      <div className="card p-5">
        <div className="text-sm font-semibold text-ink-50 mb-4">Glass Schedule</div>
        <div className="bg-surface-600 rounded-lg border border-surface-500 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500">
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Pane</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Qty</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Type</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Makeup</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Finish</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Spacer</th>
              </tr>
            </thead>
            <tbody>
              {glassList.map((g, i) => (
                <tr key={i} className="border-b border-surface-500/50">
                  <td className="px-4 py-2 text-ink-100">{g.label}</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{g.width} mm</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{g.height} mm</td>
                  <td className="px-4 py-2 text-right text-ink-200">{g.quantity}</td>
                  <td className="px-4 py-2 text-ink-300">{g.type} / {g.spec}</td>
                  <td className="px-4 py-2 text-ink-300">{g.makeup || '—'}</td>
                  <td className="px-4 py-2 text-ink-300">{g.finish}</td>
                  <td className="px-4 py-2 text-ink-300">{g.spacer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Glass drawings — upper + lower */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs font-semibold text-ink-200 mb-2">Upper Glass</div>
          <GlassDrawing2D windowSpec={windowSpec} derived={derived} type="upper" />
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-ink-200 mb-2">Lower Glass</div>
          <GlassDrawing2D windowSpec={windowSpec} derived={derived} type="lower" />
        </div>
      </div>
    </div>
  );
}

// ─── BOM Panel — Purchase list matching Project Materials layout ───
const ELEMENT_TO_PART_ID = {
  'HEAD': 'head', 'CILL': 'cill', 'CILL NOSE': 'cill_nose', 'CILL EXTENSION': 'cill_extension',
  'JAMB LEFT': 'jambs', 'JAMB RIGHT': 'jambs',
  'INTERNAL HEAD LINER': 'int_head_liner', 'EXTERNAL HEAD LINER': 'ext_head_liner',
  'INTERNAL JAMB LINER (L)': 'int_jamb_liner', 'INTERNAL JAMB LINER (R)': 'int_jamb_liner',
  'EXTERNAL JAMB LINER (L)': 'ext_jamb_liner', 'EXTERNAL JAMB LINER (R)': 'ext_jamb_liner',
  'TOP RAIL': 'top_rail', 'BOTTOM RAIL': 'bottom_rail',
  'STILES TOP SASH (L)': 'stiles_top_sash', 'STILES TOP SASH (R)': 'stiles_top_sash',
  'STILES BOTTOM SASH (L)': 'stiles_bottom_sash', 'STILES BOTTOM SASH (R)': 'stiles_bottom_sash',
  'TOP MEET RAIL': 'top_meet_rail', 'BOTTOM MEET RAIL': 'bottom_meet_rail',
  'GLAZING BEADING': 'glazing_beading', 'TRIANGLE BEADING (EXT)': 'triangle_beading_ext',
  'PARTING BEADING': 'parting_beading', 'STAFF BEADING': 'staff_beading',
  'MEETING BEADING A': 'meeting_beading_a', 'MEETING BEADING B': 'meeting_beading_b',
};

function BOMPanel({ item, windowSpec, settings, derived }) {
  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);
  const w = derived?.weights;
  const p = derived?.paint;

  const glassList = useMemo(
    () => (derived && windowSpec ? buildGlassListForWindow(derived, windowSpec) : []),
    [derived, windowSpec]
  );

  // Build length map from pre-cut (timber) + derived (beading)
  const partLengths = useMemo(() => {
    if (!derived || !windowSpec) return {};
    const map = {}; // partId → totalMm

    // Timber from pre-cut (has machining allowance)
    const precut = buildPrecutForWindow(derived, windowSpec, settings);
    if (precut) {
      const addItems = (items) => items.forEach((it) => {
        const pid = ELEMENT_TO_PART_ID[it.elementName];
        if (!pid) return;
        map[pid] = (map[pid] || 0) + it.length * (it.quantity || 1);
      });
      (precut.sashEngineering || []).forEach((g) => addItems(g.items));
      (precut.boxSapele || []).forEach((g) => addItems(g.items));
    }

    // Beading from derived (already in mm totals)
    (derived.components?.beading || []).forEach((b) => {
      const pid = ELEMENT_TO_PART_ID[b.elementName];
      if (!pid) return;
      map[pid] = (map[pid] || 0) + b.length * (b.quantity || 1);
    });

    return map;
  }, [derived, windowSpec, settings]);

  // Group by material (same structure as Project Materials)
  const bomGroups = useMemo(() => {
    const matMap = {};
    const unassigned = { material: null, parts: [], totalMeters: 0 };

    ALL_PARTS.forEach((part) => {
      const totalMm = partLengths[part.id];
      if (!totalMm) return;

      const assignment = assignments[part.id];
      const yieldCoeff = assignment?.yield || 1.0;
      const totalMeters = (totalMm / 1000) * yieldCoeff;
      const pcsTotal = part.pcs;
      const partData = { ...part, pcsTotal, totalMeters, yield: yieldCoeff };

      if (assignment?.material_id) {
        const matId = assignment.material_id;
        const mat = materials.find((m) => m.id === matId);
        if (mat) {
          if (!matMap[matId]) matMap[matId] = { material: mat, parts: [], totalMeters: 0 };
          matMap[matId].parts.push(partData);
          matMap[matId].totalMeters += totalMeters;
          return;
        }
      }
      unassigned.parts.push(partData);
      unassigned.totalMeters += totalMeters;
    });

    const groups = Object.values(matMap);
    if (unassigned.parts.length > 0) groups.push(unassigned);
    return groups;
  }, [partLengths, assignments, materials]);

  return (
    <div className="space-y-4">
      {/* Material groups — identical to Project Materials */}
      {bomGroups.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">📋</div>
          <div className="text-sm text-ink-300">No material data available.</div>
        </div>
      ) : (
        bomGroups.map((group, gi) => (
          <div key={gi} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {group.material?.image_url ? (
                  <img src={group.material.image_url} alt="" className="w-10 h-10 rounded object-cover border border-surface-500" />
                ) : (
                  <div className="w-10 h-10 rounded bg-surface-600 border border-surface-500 grid place-items-center text-ink-500 text-xs">
                    {group.material ? '—' : '?'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-ink-50">
                    {group.material ? group.material.name : 'Unassigned'}
                  </div>
                  <div className="text-[10px] text-ink-400 flex items-center gap-2">
                    {group.material ? (
                      <>
                        <span>{group.material.item_number}</span>
                        <span>{group.material.size || '—'}</span>
                        {group.material.cost_per_unit > 0 && <span>£{Number(group.material.cost_per_unit).toFixed(2)}/{group.material.unit}</span>}
                        {group.material.jc_uuid && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>}
                      </>
                    ) : (
                      <span>Go to Materials → Assignments to assign</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-ink-100">{group.totalMeters.toFixed(2)} m</div>
                <div className="text-[10px] text-ink-400">pre-cut lengths</div>
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-500/50">
                  <th className="py-1.5 text-left text-ink-400 font-medium">Part</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Section</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Pcs</th>
                  <th className="py-1.5 text-center text-ink-400 font-medium">Yield</th>
                  <th className="py-1.5 text-right text-ink-400 font-medium">Meters</th>
                </tr>
              </thead>
              <tbody>
                {group.parts.map((gp, pi) => (
                  <tr key={pi} className="border-b border-surface-500/30">
                    <td className="py-1.5 text-ink-200">{gp.name}</td>
                    <td className="py-1.5 text-center text-ink-300 font-mono">{gp.section}</td>
                    <td className="py-1.5 text-center text-ink-300">{gp.pcsTotal}</td>
                    <td className="py-1.5 text-center text-ink-300">{gp.yield}</td>
                    <td className="py-1.5 text-right text-ink-100 font-mono font-medium">{gp.totalMeters.toFixed(2)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Glass */}
      {glassList.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-500 bg-surface-800">
            <div className="text-sm font-semibold text-ink-50">Glass</div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-500 bg-surface-700/30">
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Pane</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Width</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Height</th>
                <th className="px-4 py-2 text-right text-ink-400 font-medium">Qty</th>
                <th className="px-4 py-2 text-left text-ink-400 font-medium">Spec</th>
              </tr>
            </thead>
            <tbody>
              {glassList.map((g, i) => (
                <tr key={i} className="border-b border-surface-500/30">
                  <td className="px-4 py-2 text-ink-100">{g.label}</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{g.width} mm</td>
                  <td className="px-4 py-2 text-right text-ink-200 font-mono">{g.height} mm</td>
                  <td className="px-4 py-2 text-right text-ink-200">{g.quantity}</td>
                  <td className="px-4 py-2 text-ink-300">{g.type} / {g.spec} / {g.finish}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Consumables */}
      {(() => {
        const c = derived?.consumables;
        if (!c) return null;
        return (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-500 bg-surface-800">
              <div className="text-sm font-semibold text-ink-50">Consumables</div>
            </div>
            <div className="p-4 space-y-1 text-xs text-ink-400">
              <div className="flex justify-between"><span>Cord</span><span className="text-ink-200">{c.cord.meters} m</span></div>
              <div className="flex justify-between"><span>Glazing Clips ({c.clips.size})</span><span className="text-ink-200">{c.clips.qty} pcs</span></div>
              <div className="flex justify-between"><span>Glazing Packer 1mm</span><span className="text-ink-200">{c.spacer1mm.qty} pcs</span></div>
              <div className="flex justify-between"><span>Glazing Packer 2mm</span><span className="text-ink-200">{c.spacer2mm.qty} pcs</span></div>
              <div className="flex justify-between"><span>Bead Tape</span><span className="text-ink-200">{c.beadTape.meters} m</span></div>
              <div className="flex justify-between"><span>Silicone</span><span className="text-ink-200">{c.silicone.tubes} tubes</span></div>
              <div className="flex justify-between"><span>Sliding Sash Seal 6070</span><span className="text-ink-200">{c.seal6070.meters} m</span></div>
              <div className="flex justify-between"><span>Bottom Seal 6009</span><span className="text-ink-200">{c.seal6009.meters} m</span></div>
            </div>
          </div>
        );
      })()}

      {/* Hardware */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-500 bg-surface-800">
          <div className="text-sm font-semibold text-ink-50">Hardware</div>
        </div>
        <div className="p-4 space-y-1 text-xs text-ink-400">
          {windowSpec && buildHardwareList(windowSpec).map((h, i) => (
            <div key={i} className="flex justify-between"><span>{h.item} ({h.detail})</span><span className="text-ink-200">{h.quantity} pcs</span></div>
          ))}
          {windowSpec && buildHardwareList(windowSpec).length === 0 && (
            <div className="text-ink-500 italic">Fixed window — no hardware</div>
          )}
        </div>
      </div>

      {/* Paint & Weights */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {p && (
          <div className="card p-4">
            <div className="text-xs font-semibold text-ink-200 mb-2">Paint — {p.areaSqm} m²</div>
            <div className="space-y-1 text-xs text-ink-400">
              <div className="flex justify-between"><span>Primer</span><span className="text-ink-200">{p.primer} L</span></div>
              <div className="flex justify-between"><span>Topcoat</span><span className="text-ink-200">{p.topcoat} L</span></div>
            </div>
          </div>
        )}
        {w && (
          <div className="card p-4">
            <div className="text-xs font-semibold text-ink-200 mb-2">Weights</div>
            <div className="space-y-1 text-xs text-ink-400">
              <div className="flex justify-between"><span>Timber</span><span className="text-ink-200">{w.timber} kg</span></div>
              <div className="flex justify-between"><span>Glass ({w.glassType})</span><span className="text-ink-200">{w.glass} kg</span></div>
              <div className="flex justify-between border-t border-surface-500/50 pt-1 mt-1">
                <span className="text-ink-100 font-medium">Total (+5%)</span>
                <span className="text-ink-100 font-semibold">{w.total} kg</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Spec Panel Components ───
function SpecSection({ title, children }) {
  return <div><div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">{title}</div><div className="space-y-1">{children}</div></div>;
}
function SpecRow({ label, value }) {
  if (value == null || value === '') return null;
  return <div className="flex justify-between gap-2"><span className="text-ink-400 text-xs">{label}</span><span className="text-ink-100 text-xs font-medium">{String(value)}</span></div>;
}
function ColourRow({ label, hex }) {
  if (!hex) return null;
  return <div className="flex justify-between items-center gap-2"><span className="text-ink-400 text-xs">{label}</span><div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded border border-surface-400" style={{ backgroundColor: hex }} /><span className="text-ink-200 text-xs font-mono">{hex}</span></div></div>;
}
