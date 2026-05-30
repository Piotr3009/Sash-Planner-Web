import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore.js';
import { useMaterialStore } from '../stores/materialStore.js';
import { useMaterialAssignmentStore, ALL_PARTS } from '../stores/materialAssignmentStore.js';
import { useIronmongeryStore } from '../stores/ironmongeryStore.js';
import { parseSpecification, normaliseToWindowSpec } from '../engine/specification.js';
import { deriveWindowData } from '../engine/calculations.js';
import { mergeWindowMaterials, formatQty } from '../engine/bom.js';
import ImageLightbox from '../components/ImageLightbox.jsx';


const TYPE_LABELS = { sash: 'Sash Windows', casement: 'Casement Windows', 'fix-frame': 'Fix Frame', doors: 'Doors', special: 'Special / Other' };
const STATUS_STYLES = {
  'preparation': { cls: 'badge-prep', icon: '📋' },
  'in-production': { cls: 'badge-active', icon: '🔧' },
  'complete': { cls: 'badge-done', icon: '✅' },
};

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const [zoomMatSrc, setZoomMatSrc] = useState(null);
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const createBatch = useProjectStore((s) => s.createBatch);
  const deleteBatch = useProjectStore((s) => s.deleteBatch);
  const removeWindowFromBatch = useProjectStore((s) => s.removeWindowFromBatch);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  const materials = useMaterialStore((s) => s.materials);
  const assignments = useMaterialAssignmentStore((s) => s.assignments);

  useEffect(() => {
    const allProjects = useProjectStore.getState().projects;
    const found = allProjects.find((p) => p.id === projectId);
    if (found) setCurrentProject(found);
  }, [projectId, projects.length]);

  const batches = currentProject?.batches || [];

  // ─── Project Materials — single source of truth (bom.js) ───
  // Simple addition: every window's materials (deriveWindowData) summed.
  // Mixed window types OK. Same numbers as Single Window BOM.
  const ironmongeryItems = useIronmongeryStore((s) => s.items);
  const settings = useProjectStore((s) => s.settings);

  const projectMaterials = useMemo(() => {
    const windows = [];
    batches.forEach((b) => {
      (b.windows || []).forEach((win) => {
        const spec = parseSpecification(win.specification);
        const windowSpec = normaliseToWindowSpec(win, spec);
        let derived = null;
        try { derived = deriveWindowData(windowSpec, settings); }
        catch (e) { console.warn(`Calc failed for ${win.name}:`, e); }
        if (derived) windows.push({ derived, windowSpec, batch: b });
      });
    });
    if (windows.length === 0) return [];
    return mergeWindowMaterials(windows, { assignments, materials, ALL_PARTS, ironmongeryItems, settings });
  }, [batches, assignments, materials, ironmongeryItems, settings]);

  if (!currentProject) return <div className="p-8 text-sm text-ink-400">Project not found.</div>;

  const handleAddBatch = (type) => {
    const batch = createBatch(projectId, type);
    setShowAddBatch(false);
    navigate(`/projects/${projectId}/batches/${batch.id}/defaults`);
  };

  const handleDeleteBatch = (batchId) => {
    if (window.confirm('Delete this batch and all its windows?')) deleteBatch(projectId, batchId);
  };

  // ─── Export to PDF (print-friendly window) ───
  const handleExportPDF = () => {
    const totalWindows = batches.reduce((s, b) => s + (b.windows?.length || 0), 0);
    const rows = projectMaterials.map((r) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${(r.material?.item_number || r.product?.item_number) || '—'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${r.name}${r._assigned ? '' : ' (unassigned)'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">${formatQty(r.qty, r.unit)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">${r.costPerUnit > 0 ? '£' + (r.qty * r.costPerUnit).toFixed(2) : '—'}</td>
        </tr>
      `).join('');

    const totalCost = projectMaterials.reduce((sum, r) =>
      sum + (r.costPerUnit > 0 ? r.qty * r.costPerUnit : 0), 0);

    const html = `<!DOCTYPE html><html><head><title>Materials — ${currentProject.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#222;}
      h1{font-size:18px;margin:0 0 4px;}h2{font-size:13px;color:#666;margin:0 0 20px;font-weight:normal;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ccc;font-size:11px;text-transform:uppercase;color:#555;}
      .footer{margin-top:20px;font-size:11px;color:#888;}
      .total{margin-top:10px;text-align:right;font-size:14px;font-weight:bold;}</style></head>
      <body>
      <h1>Project Materials — ${currentProject.name}</h1>
      <h2>${currentProject.project_number} · ${batches.length} batches · ${totalWindows} windows</h2>
      <table><thead><tr>
        <th>Item #</th><th>Material</th>
        <th style="text-align:right;">Qty</th><th style="text-align:right;">Est. Cost</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="total">Estimated Total: £${totalCost.toFixed(2)}</div>
      <div class="footer">Generated ${new Date().toLocaleDateString('en-GB')} · Purchase list · Yield applied</div>
      <script>window.onload=()=>window.print()</script></body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  // ─── Export CSV for Joinery Core ───
  const handleExportJC = () => {
    const rows = [];
    projectMaterials.forEach((r) => {
      const jcId = r.material?.jc_uuid || r.product?.jc_uuid;
      if (!jcId) return; // skip non-JC materials
      rows.push({
        jc_uuid: jcId,
        item_number: r.material?.item_number || r.product?.item_number || '',
        name: r.name,
        quantity_needed: Number(r.qty.toFixed(3)),
        unit: r.unit || 'm',
      });
    });

    if (rows.length === 0) {
      alert('No JC-linked materials to export. Import materials from Joinery Core first.');
      return;
    }

    const headers = ['jc_uuid', 'item_number', 'name', 'quantity_needed', 'unit'];
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projNum = (currentProject.project_number || 'project').replace(/\//g, '-');
    a.download = `sp-materials-${projNum}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link to="/dashboard" className="text-xs text-ink-400 hover:text-accent-400 transition-colors">← All Projects</Link>

      <div className="flex items-end justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">{currentProject.name}</h1>
          {currentProject.address && <p className="text-sm text-ink-400 mt-1">{currentProject.address}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowMaterials(true)} className="btn btn-secondary text-sm">
            📋 Project Materials
          </button>
          <button onClick={() => setShowAddBatch(true)} className="btn btn-primary">+ Add Batch</button>
        </div>
      </div>

      {/* Add Batch picker */}
      {showAddBatch && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-semibold text-ink-50 mb-3">Select window type for new batch:</div>
          <div className="flex gap-3">
            {[
              { type: 'sash', icon: '🪟', label: 'Sash Windows' },
              { type: 'casement', icon: '🔲', label: 'Casement' },
              { type: 'doors', icon: '🚪', label: 'Doors' },
              { type: 'special', icon: '✦', label: 'Special / Other' },
            ].map(({ type, icon, label }) => (
              <button key={type} onClick={() => handleAddBatch(type)}
                className="px-5 py-3 bg-surface-600 border border-surface-500 rounded-lg text-sm text-ink-100 hover:border-accent-500 hover:bg-surface-500 transition-all">
                {icon} {label}
              </button>
            ))}
            <button onClick={() => setShowAddBatch(false)} className="px-4 py-3 text-sm text-ink-400 hover:text-ink-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {batches.length === 0 && !showAddBatch && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🏗️</div>
          <div className="text-ink-200 mb-2">No production batches yet.</div>
          <button onClick={() => setShowAddBatch(true)} className="btn btn-primary mt-4">+ Add Your First Batch</button>
        </div>
      )}

      {/* Batches */}
      <div className="space-y-4">
        {batches.map((batch) => {
          const st = STATUS_STYLES[batch.status] || STATUS_STYLES.preparation;
          const winCount = batch.windows?.length || 0;
          return (
            <div key={batch.id} className="card p-5 relative group">
              {/* Delete */}
              <button onClick={() => handleDeleteBatch(batch.id)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-surface-600 text-ink-400 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-ink-50">{batch.label}</h2>
                    <span className={st.cls}>{st.icon} {batch.status}</span>
                  </div>
                  <div className="text-xs text-ink-400 mt-1">
                    {TYPE_LABELS[batch.type] || batch.type} — {winCount} window{winCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Batch defaults summary */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400 mb-4 px-4 py-2.5 bg-surface-600 rounded-lg border border-surface-500">
                <span>Ironmongery: <strong className="text-ink-100">{batch.defaults?.ironmongery}</strong></span>
                <span>Colour: <strong className="text-ink-100">{batch.defaults?.colourMode === 'dual' ? 'Dual' : 'Single'}</strong></span>
                <span>Glass: <strong className="text-ink-100">{batch.defaults?.glassType}</strong></span>
                <span>Frame: <strong className="text-ink-100">{batch.defaults?.frameType}</strong></span>
                {batch.type === 'sash' && <span>Horns: <strong className="text-ink-100">{batch.defaults?.hornType}</strong></span>}
                <span>PAS24: <strong className="text-ink-100">{batch.defaults?.pas24 ? 'Yes' : 'No'}</strong></span>
                <Link to={`/projects/${projectId}/batches/${batch.id}/defaults`}
                  className="text-accent-400 hover:text-accent-300 ml-auto transition-colors">Edit defaults</Link>
              </div>

              {/* Windows */}
              {winCount > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {batch.windows.map((win) => (
                    <div key={win.id} className="p-3 bg-surface-600 border border-surface-500 rounded-lg hover:border-accent-500/40 hover:shadow-glow transition-all relative group">
                      <Link to={`/projects/${projectId}/batches/${batch.id}/windows/${win.id}`} className="block">
                        <div className="font-semibold text-sm text-ink-50">{win.name}</div>
                        <div className="text-xs text-ink-400 mt-0.5">{win.width} × {win.height} mm</div>
                        <div className="text-[10px] text-ink-400 mt-1">
                          {win.upperBars && win.upperBars !== 'none' ? `Bars: ${win.upperBars}` : 'No bars'}
                          {win.glassFinish === 'frosted' ? ' · Frosted' : ''}
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm(`Delete window "${win.name}"? This cannot be undone.`)) {
                            removeWindowFromBatch(projectId, batch.id, win.id);
                          }
                        }}
                        className="absolute top-2 right-2 text-[10px] text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-ink-400 italic">No windows in this batch.</div>
              )}

              {/* Add window */}
              <div className="mt-3">
                <Link to={`/projects/${projectId}/batches/${batch.id}/configurator`}
                  className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 transition-colors">
                  + Add window to batch
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Materials Modal */}
      {showMaterials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowMaterials(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-surface-800 border border-surface-500 rounded-xl w-full max-w-3xl mx-4 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 border-b border-surface-500 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-ink-50">Project Materials — {currentProject.name}</h2>
                <p className="text-[10px] text-ink-400 mt-0.5">
                  {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {batches.reduce((s, b) => s + (b.windows?.length || 0), 0)} windows
                </p>
              </div>
              <button onClick={() => setShowMaterials(false)} className="w-7 h-7 rounded-full bg-surface-600 text-ink-400 hover:text-ink-200 flex items-center justify-center text-sm">×</button>
            </div>

            {/* Content */}
            <div className="overflow-auto flex-1 p-5">
              {projectMaterials.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">📋</div>
                  <div className="text-sm text-ink-300 mb-1">No materials yet.</div>
                  <p className="text-[10px] text-ink-400">Add windows to batches, then assign materials in Materials → Assignments.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-500 bg-surface-800">
                        <th className="px-4 py-2.5 text-left text-ink-400 font-medium">Material</th>
                        <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Qty</th>
                        <th className="px-4 py-2.5 text-right text-ink-400 font-medium">Est. cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectMaterials.map((row) => (
                        <tr key={row.key} className="border-b border-surface-500/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {(row.material?.image_url || row.product?.image_url) ? (
                                <img src={row.material?.image_url || row.product?.image_url} alt=""
                                  onClick={() => setZoomMatSrc(row.material?.image_url || row.product?.image_url)}
                                  className="w-7 h-7 rounded object-cover border border-surface-500 cursor-zoom-in hover:opacity-80 transition-opacity" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-surface-600 border border-surface-500 grid place-items-center text-ink-500 text-[10px]">{row._assigned ? '—' : '?'}</div>
                              )}
                              <div>
                                <div className={`font-medium ${row._assigned ? 'text-ink-100' : 'text-ink-300 italic'}`}>{row.name}</div>
                                <div className="text-[10px] text-ink-400 flex items-center gap-2">
                                  {(row.material?.item_number || row.product?.item_number) && <span>{row.material?.item_number || row.product?.item_number}</span>}
                                  {row.source === 'ironmongery' && <span className="text-[8px] px-1 py-0.5 rounded bg-surface-600 text-ink-400 border border-surface-500">ironmongery</span>}
                                  {(row.material?.jc_uuid || row.product?.jc_uuid) && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-500 border border-amber-500/25">JC</span>}
                                  {!row._assigned && <span>unassigned</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-ink-100 font-mono font-medium whitespace-nowrap">{formatQty(row.qty, row.unit)}</td>
                          <td className="px-4 py-2.5 text-right text-ink-300 font-mono whitespace-nowrap">{row.costPerUnit > 0 ? `£${(row.qty * row.costPerUnit).toFixed(2)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-surface-500 flex justify-between items-center shrink-0">
              <div className="text-[10px] text-ink-400">
                {projectMaterials.length} material{projectMaterials.length !== 1 ? 's' : ''} · Purchase list · Yield applied
              </div>
              <div className="flex gap-2">
                {projectMaterials.length > 0 && (
                  <>
                    <button onClick={handleExportPDF} className="btn btn-secondary text-xs">
                      📄 Export PDF
                    </button>
                    <button onClick={handleExportJC} className="btn btn-secondary text-xs">
                      <svg className="inline w-3.5 h-3.5 -mt-0.5 mr-1" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4A030" strokeWidth="1.5" fill="#D4A030" fillOpacity="0.15"/></svg> Export to JC
                    </button>
                  </>
                )}
                <button onClick={() => setShowMaterials(false)} className="btn btn-secondary text-xs">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {zoomMatSrc && <ImageLightbox src={zoomMatSrc} onClose={() => setZoomMatSrc(null)} />}
    </div>
  );
}