import { useState } from 'react';
import { exportWindowToPDF } from '../../utils/pdfExport.js';
import { exportWindowToExcel } from '../../utils/excelExport.js';
import { exportWindowToDXF } from '../../utils/dxfExport.js';

export default function ExportControls({ item, windowSpec, settings, derived }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  if (!windowSpec || !derived) {
    return <div className="card p-6 text-ink-400 text-sm">Calculations not available — cannot export.</div>;
  }

  const wrap = async (id, fn) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div>
        <div className="text-sm font-semibold">Export production documents</div>
        <p className="text-xs text-ink-400">Generates files for {item.window_number || 'window'} — fully client-side, no upload.</p>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ExportCard
          title="PDF"
          description="Technical drawing + cut list + summary"
          busy={busy === 'pdf'}
          onClick={() => wrap('pdf', () => exportWindowToPDF({ item, windowSpec, settings, derived }))}
        />
        <ExportCard
          title="Excel"
          description="Cut list, pre-cut, glass, hardware worksheets"
          busy={busy === 'xlsx'}
          onClick={() => wrap('xlsx', () => exportWindowToExcel({ item, windowSpec, settings, derived }))}
        />
        <ExportCard
          title="DXF"
          description="2D outline frame + sash for CNC"
          busy={busy === 'dxf'}
          onClick={() => wrap('dxf', () => exportWindowToDXF({ item, windowSpec }))}
        />
      </div>
    </div>
  );
}

function ExportCard({ title, description, busy, onClick }) {
  return (
    <button
      onClick={onClick}
      className="border border-ink-200 rounded-lg p-4 text-left hover:border-accent-500 hover:bg-accent-500/5 transition-colors disabled:opacity-50"
      disabled={busy}
    >
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-xs text-ink-400">{description}</div>
      {busy && <div className="text-xs text-accent-600 mt-2">Generating…</div>}
    </button>
  );
}
