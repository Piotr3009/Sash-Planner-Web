import { useState, useEffect, useLayoutEffect, useRef, useMemo, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectStore, BATCH_STATUSES } from '../stores/projectStore.js';
import { useClientStore } from '../stores/clientStore.js';
import ClientPicker from '../components/clients/ClientPicker.jsx';

// ─── Type colors ───
const TYPE_COLORS = {
  sash:     { bg: 'rgba(127,119,221,0.12)', border: 'rgba(127,119,221,0.3)', text: '#AFA9EC', line: '#7F77DD', dot: '#7F77DD' },
  casement: { bg: 'rgba(212,83,126,0.12)',  border: 'rgba(212,83,126,0.3)',  text: '#ED93B1', line: '#D4537E', dot: '#D4537E' },
  doors:    { bg: 'rgba(239,159,39,0.12)',  border: 'rgba(239,159,39,0.3)',  text: '#FAC775', line: '#EF9F27', dot: '#EF9F27' },
  special:  { bg: 'rgba(29,158,117,0.12)',  border: 'rgba(29,158,117,0.3)',  text: '#5DCAA5', line: '#1D9E75', dot: '#1D9E75' },
};
const typeColor = (type) => TYPE_COLORS[type] || TYPE_COLORS.sash;
const typeLabel = (type) => ({ sash: 'Sash', casement: 'Casement', doors: 'Doors', special: 'Special / Other' }[type] || type);

const STATUS_CONFIG = {
  preparation:     { label: 'Prep',    color: '#F59E0B' },
  'in-production': { label: 'Prod',    color: '#3B82F6' },
  complete:        { label: 'Done',    color: '#10B981' },
};

// ─── Board geometry ───
// Width split of the four card columns, gaps excluded.
// 05.10 (Piotr): the production packs must dominate the board, not the
// batches. Batches are a quarter narrower than in the first version of this
// layout (27 → 20.25) and the packs take that width (34 → 40.75).
const SHARE_PROJECT = 17;
const SHARE_BATCHES = 20.25;
const SHARE_PACKS = 40.75;
const SHARE_COMPLETE = 22;
const LANE_W = 72;               // free lane between the blocks: connection lines only
const BAND_PAD = 12;             // band padding around its cards
const BAND_GAP = 24;             // room between a project card and its batches
const BATCH_H = 36;              // 05.10 (Piotr): a tenth lower than the first version (40)
const BATCH_GAP = 8;
const PROJECT_CARD_MIN_H = 84;
const SUMMARY_CARD_MIN_H = 76;
const PACK_GAP = 12;
const BOARD_MIN_W = 1080;        // below this the board scrolls sideways instead of crushing the cards

// Grid tracks of the board. Band paddings, the project/batches gap and the
// lanes are tracks of their own, so the shares above apply to the cards
// themselves. `k` scales the fixed tracks (used by the row under the board,
// which is not zoomed but has to line up with the zoomed columns).
const boardColumns = (k = 1) => [
  `${BAND_PAD * k}px`, `minmax(0, ${SHARE_PROJECT}fr)`, `${BAND_GAP * k}px`, `minmax(0, ${SHARE_BATCHES}fr)`, `${BAND_PAD * k}px`,
  `${LANE_W * k}px`,
  `minmax(0, ${SHARE_PACKS}fr)`,
  `${LANE_W * k}px`,
  `${BAND_PAD * k}px`, `minmax(0, ${SHARE_COMPLETE}fr)`, `${BAND_PAD * k}px`,
].join(' ');
// Where things sit on those tracks (grid lines).
const COL = { band: '1 / 6', project: 2, batches: 4, packs: 7, complete: '9 / 12', completeCard: 10 };

// Neighbouring bands differ by a calm tint and a thin separator. Only the
// project block and its completion summary are banded: the packs in between
// stay on the plain background, so a shared pack never reads as belonging to
// the project it happens to sit next to.
const bandClass = (index, isLast) =>
  `border-t border-surface-500/80 ${isLast ? 'border-b' : ''} ${index % 2 === 0 ? 'bg-surface-700/75' : ''}`;

const HEADING_CLASS = 'text-[13px] uppercase tracking-wide text-ink-50 font-semibold underline underline-offset-4 decoration-surface-500 whitespace-nowrap';

// Connection lines keep their curve; they are drawn a little stronger so
// every link stays readable on the banded background.
const LINE_WIDTH = 2;
const LINE_OPACITY = { projectToBatch: 0.5, batchToPack: 0.8, packToComplete: 0.8 };
// Pointing at a project or a pack strengthens its own links. The other links
// stay on the board, only calmer.
const LINE_WIDTH_HOT = 3;
const LINE_CALM = 0.5;           // share of its normal opacity an unrelated link keeps
// A batch outside the category picked in the legend stays in place, faded.
const DIMMED_OPACITY = 0.35;

const statusOptionLabel = (s) =>
  STATUS_CONFIG[s]?.label === 'Prep' ? 'Preparation' : STATUS_CONFIG[s]?.label === 'Prod' ? 'In production' : STATUS_CONFIG[s]?.label || s;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ─── Zoom ───
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_KEY = 'pc-dashboard-zoom';
const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));

function readStoredZoom() {
  try {
    const z = parseFloat(window.localStorage.getItem(ZOOM_KEY));
    return Number.isFinite(z) ? clampZoom(z) : 1;
  } catch {
    return 1;
  }
}

// ─── Measuring the rendered board ───
// Positions are read from the elements as they are laid out and expressed in
// the board's own units, so they stay right at any zoom.
const boardScale = (board, rect) => (board.offsetWidth ? rect.width / board.offsetWidth : 1) || 1;

function boxInBoard(el, boardRect, scale) {
  const r = el.getBoundingClientRect();
  const left = (r.left - boardRect.left) / scale;
  const top = (r.top - boardRect.top) / scale;
  const height = r.height / scale;
  return { left, right: left + r.width / scale, top, height, midY: top + height / 2 };
}

function elementsBy(root, attr) {
  const map = new Map();
  root.querySelectorAll(`[${attr}]`).forEach((el) => map.set(el.getAttribute(attr), el));
  return map;
}

// Short facts in one row, separated by a middle dot. When the row is too
// narrow it wraps instead of cutting the text, and no line starts with the
// separator: the dot sits in the left padding of each item, and that padding
// is clipped at the start of every line.
const DOT_ROOM = 11;
function DotList({ items, className = '' }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="flex flex-wrap" style={{ marginLeft: -DOT_ROOM }}>
        {items.map((item) => (
          <span key={item} className="relative whitespace-nowrap" style={{ paddingLeft: DOT_ROOM }}>
            <span aria-hidden="true" className="absolute" style={{ left: 4 }}>·</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Confirmation modal ───
function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', tone = 'danger' }) {
  const confirmCls = tone === 'danger'
    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
    : 'bg-accent-500/20 text-accent-400 border border-accent-500/30 hover:bg-accent-500/30';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-ink-50 mb-2">{title}</div>
        <div className="text-[13px] text-ink-300 mb-4">{message}</div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-secondary text-[13px] px-4">Cancel</button>
          <button onClick={onConfirm} className={`text-[13px] px-4 py-1.5 rounded-lg transition-colors ${confirmCls}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Project modal ───
function EditProjectModal({ project, onSave, onCancel }) {
  const [name, setName] = useState(project.name || '');
  const [number, setNumber] = useState(project.project_number || '');
  const [clientId, setClientId] = useState(project.client_id || null);
  const [address, setAddress] = useState(project.address || '');
  const getClient = useClientStore((s) => s.getClient);

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      project_number: number.trim(),
      client_id: clientId,
      client: clientId ? (getClient(clientId)?.full_name || '') : '',
      address: address.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-surface-800 border border-surface-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-ink-50 mb-3">Edit Project</div>
        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-ink-400 uppercase tracking-wider block mb-0.5">Project name (max 5 chars) *</label>
            <input className="input text-[13px] w-full" value={name} maxLength={5} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-[11px] text-ink-400 uppercase tracking-wider block mb-0.5">Project number (max 5 chars)</label>
            <input className="input text-[13px] w-full" value={number} maxLength={5} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-ink-400 uppercase tracking-wider block mb-0.5">Client</label>
            <ClientPicker value={clientId} onChange={setClientId} />
          </div>
          <div>
            <label className="text-[11px] text-ink-400 uppercase tracking-wider block mb-0.5">Address</label>
            <input className="input text-[13px] w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onCancel} className="btn btn-secondary text-[13px] px-4">Cancel</button>
          <button onClick={submit} className="btn btn-primary text-[13px] px-4">Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom batch-assign dropdown ───
function BatchAssignDropdown({ batchId, projectId, productionPacks, currentPPId, onAssign }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const currentPP = productionPacks.find((pp) => pp.id === currentPPId);

  return (
    <div ref={ref} className="relative min-w-0 max-w-[190px]">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={currentPP ? `Production pack: ${currentPP.name}` : 'Assign to a production pack'}
        className={`flex items-center gap-1.5 h-7 max-w-full px-2.5 rounded-md border bg-white/5 hover:bg-white/10 text-[12px] transition-colors ${currentPP ? 'border-ink-600 text-ink-100' : 'border-dashed border-ink-400 text-ink-200'}`}
      >
        <span className="truncate">{currentPP ? currentPP.name : 'Assign to pack'}</span>
        <svg className="w-3 h-3 shrink-0 text-ink-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute z-40 top-full mt-1 right-0 min-w-[200px] bg-surface-700 border border-surface-500 rounded-lg shadow-xl py-1 max-h-[260px] overflow-y-auto">
          <button
            className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface-600 transition-colors ${!currentPPId ? 'text-accent-400 font-medium' : 'text-ink-200'}`}
            onClick={(e) => { e.stopPropagation(); onAssign(batchId, projectId, null); setOpen(false); }}
          >
            Unassign
          </button>
          {productionPacks.map((pp) => {
            const tc = typeColor(pp.type);
            return (
              <button
                key={pp.id}
                title={pp.name}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface-600 transition-colors flex items-center gap-2 ${pp.id === currentPPId ? 'text-accent-400 font-medium' : 'text-ink-100'}`}
                onClick={(e) => { e.stopPropagation(); onAssign(batchId, projectId, pp.id); setOpen(false); }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tc.dot }} />
                <span className="truncate">{pp.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SVG connection lines (Project→Batch, Batch→PP, PP→Delivery) ───
function ConnectionLines({ containerRef, projects, productionPacks, onlyType, hot }) {
  const [lines, setLines] = useState([]);
  const signature = useRef('');

  // Runs after every render of the board, so the geometry always comes from
  // the elements as they are laid out right now (screen width, card heights,
  // content, assignments, zoom) and never from assumed sizes.
  useLayoutEffect(() => {
    const board = containerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const scale = boardScale(board, boardRect);
    const box = (el) => boxInBoard(el, boardRect, scale);
    const projectEls = elementsBy(board, 'data-project-id');
    const batchEls = elementsBy(board, 'data-batch-id');
    const packEls = elementsBy(board, 'data-pp-id');
    const completeEls = elementsBy(board, 'data-delivery-id');
    const half = (v) => Math.round(v * 2) / 2;

    // Every link remembers its project and its pack, so it can be lit from either end.
    const packOfBatch = new Map();
    productionPacks.forEach((pp) => (pp.assignments || []).forEach(({ batchId }) => packOfBatch.set(batchId, pp.id)));
    // With a category picked in the legend only that category keeps its links.
    const inCategory = (type) => !onlyType || type === onlyType;

    const next = [];
    const link = (key, from, to, type, opacity, projectId, ppId) => next.push({
      key,
      x1: half(from.right), y1: half(from.midY),
      x2: half(to.left), y2: half(to.midY),
      color: typeColor(type).line,
      opacity,
      projectId,
      ppId,
    });

    // ── Project → Batch lines ──
    projects.forEach((project) => {
      const projEl = projectEls.get(project.id);
      if (!projEl) return;
      const projBox = box(projEl);
      (project.batches || []).forEach((batch) => {
        const batchEl = batchEls.get(batch.id);
        const type = batch.type || 'sash';
        if (!batchEl || !inCategory(type)) return;
        link(`p-${project.id}-${batch.id}`, projBox, box(batchEl), type, LINE_OPACITY.projectToBatch, project.id, packOfBatch.get(batch.id) || null);
      });
    });

    productionPacks.forEach((pp) => {
      const ppEl = packEls.get(pp.id);
      if (!ppEl) return;
      const ppBox = box(ppEl);
      const typesByProject = new Map();

      // ── Batch → PP lines ── (a batch without a pack gets no line)
      (pp.assignments || []).forEach(({ projectId, batchId }) => {
        const batchEl = batchEls.get(batchId);
        if (!batchEl) return;
        const batch = projects
          .find((p) => p.id === projectId)
          ?.batches?.find((b) => b.id === batchId);
        const type = batch?.type || 'sash';
        if (!inCategory(type)) return;
        link(`b-${batchId}-${pp.id}`, box(batchEl), ppBox, type, LINE_OPACITY.batchToPack, projectId, pp.id);
        if (!typesByProject.has(projectId)) typesByProject.set(projectId, new Set());
        typesByProject.get(projectId).add(type);
      });

      // ── PP → Delivery lines ── one per pack and project, however many of
      // the project's batches sit in the pack
      typesByProject.forEach((types, projectId) => {
        const completeEl = completeEls.get(projectId);
        if (!completeEl) return;
        const type = types.size === 1 ? [...types][0] : (pp.type || 'sash');
        link(`d-${pp.id}-${projectId}`, ppBox, box(completeEl), type, LINE_OPACITY.packToComplete, projectId, pp.id);
      });
    });

    const nextSignature = JSON.stringify(next);
    if (nextSignature !== signature.current) {
      signature.current = nextSignature;
      setLines(next);
    }
  });

  if (lines.length === 0) return null;
  const maxY = Math.max(...lines.map((l) => Math.max(l.y1, l.y2)), 0) + 40;

  // Links of the project or pack under the pointer. Nothing changes when the
  // pointed card has no link at all.
  const isHot = (l) => !!hot && (hot.kind === 'project' ? l.projectId === hot.id : l.ppId === hot.id);
  const lit = lines.some(isHot);
  const drawn = lit ? [...lines].sort((a, b) => Number(isHot(a)) - Number(isHot(b))) : lines;   // lit links on top

  return (
    <svg aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: maxY, pointerEvents: 'none', overflow: 'visible' }}>
      {drawn.map((l) => {
        const dx = (l.x2 - l.x1) * 0.4;
        const strong = lit && isHot(l);
        return (
          <path
            key={l.key}
            d={`M${l.x1} ${l.y1} C${l.x1 + dx} ${l.y1}, ${l.x2 - dx} ${l.y2}, ${l.x2} ${l.y2}`}
            fill="none"
            stroke={l.color}
            strokeWidth={strong ? LINE_WIDTH_HOT : LINE_WIDTH}
            strokeLinecap="round"
            opacity={!lit ? l.opacity : strong ? 1 : l.opacity * LINE_CALM}
          />
        );
      })}
    </svg>
  );
}

// ─── New Production Pack form ───
function NewPPForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('sash');
  const [deadline, setDeadline] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), type, deadline);
    setName(''); setType('sash'); setDeadline('');
  };

  return (
    <div className="card p-3 space-y-2">
      <input className="input text-[13px]" placeholder="Name, e.g. #2 Sash windows" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <select className="input text-[13px] flex-1" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="sash">Sash</option>
          <option value="casement">Casement</option>
          <option value="doors">Doors</option>
          <option value="special">Special / Other</option>
        </select>
        <input type="date" className="input text-[13px] flex-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary text-[13px] flex-1" onClick={submit}>Create</button>
        <button className="btn btn-secondary text-[13px]" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── New Project form (with short name enforcement) ───
function NewProjectForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [clientId, setClientId] = useState(null);
  const [address, setAddress] = useState('');
  const getClient = useClientStore((s) => s.getClient);

  const submit = () => {
    if (!name.trim()) return;
    const clientName = clientId ? (getClient(clientId)?.full_name || '') : '';
    onCreate(name.trim(), address.trim(), number.trim(), clientId, clientName);
    setName(''); setNumber(''); setClientId(null); setAddress('');
  };

  return (
    <div className="card p-3 space-y-2">
      <div>
        <input className="input text-[13px] w-full" placeholder="Project name * (max 5)" maxLength={5} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="text-[10px] text-ink-400 mt-0.5 text-right">{name.length}/5</div>
      </div>
      <div>
        <input className="input text-[13px] w-full" placeholder="Project number (max 5)" maxLength={5} value={number} onChange={(e) => setNumber(e.target.value)} />
        <div className="text-[10px] text-ink-400 mt-0.5 text-right">{number.length}/5</div>
      </div>
      <ClientPicker value={clientId} onChange={setClientId} />
      <input className="input text-[13px]" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-primary text-[13px] flex-1" onClick={submit}>Create</button>
        <button className="btn btn-secondary text-[13px]" onClick={onCancel}>Cancel</button>
      </div>
      <button
        className="w-full py-2 rounded-lg border border-surface-500 text-accent-400 text-[11px] hover:bg-surface-700 transition-all"
        onClick={() => { /* Future: Joinery Core import */ }}
      >
        Upload from <svg className="inline w-3.5 h-3.5 -mt-0.5 mx-0.5" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#D4A030" strokeWidth="1.5" fill="#D4A030" fillOpacity="0.15"/></svg> Joinery Core
      </button>
    </div>
  );
}

// ─── Main ───
export default function DashboardPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const productionPacks = useProjectStore((s) => s.productionPacks);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const createProductionPack = useProjectStore((s) => s.createProductionPack);
  const assignBatch = useProjectStore((s) => s.assignBatchToProductionPack);
  const unassignBatch = useProjectStore((s) => s.unassignBatchFromProductionPack);
  const getPackForBatch = useProjectStore((s) => s.getProductionPackForBatch);
  const updateProductionPack = useProjectStore((s) => s.updateProductionPack);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const archiveProject = useProjectStore((s) => s.archiveProject);   // v3 Block 6
  const deleteProductionPack = useProjectStore((s) => s.deleteProductionPack);
  const containerRef = useRef(null);
  const packsRef = useRef(null);

  const [showNewPP, setShowNewPP] = useState(false);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const visibleProjects = needle
    ? projects.filter((p) => [p.name, p.project_number, p.client, p.client_name]
        .filter(Boolean).join(' ').toLowerCase().includes(needle))
    : projects;
  const [showNewProject, setShowNewProject] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [editProject, setEditProject] = useState(null); // project being edited

  // ─── Zoom (kept between visits) ───
  const [zoom, setZoom] = useState(readStoredZoom);
  const changeZoom = (value) => {
    const next = clampZoom(value);
    setZoom(next);
    try { window.localStorage.setItem(ZOOM_KEY, String(next)); } catch { /* no storage: the zoom still works for this visit */ }
  };

  // ─── Category picked in the legend ───
  // One category at a time, a second click clears it. Only the packs of that
  // category stay; batches of the other categories stay in place, faded, and
  // lose their links. Projects and their completion are not touched. Not kept
  // between visits: the board always opens complete.
  const [onlyType, setOnlyType] = useState(null);

  // ─── Project or pack under the pointer (its links are drawn stronger) ───
  const [hot, setHot] = useState(null);
  const pointAt = (kind, id) => ({
    onMouseEnter: () => setHot({ kind, id }),
    onMouseLeave: () => setHot(null),
  });

  const deliveryData = useMemo(() => {
    return visibleProjects.map((project) => {
      const batches = project.batches || [];
      const summary = {};
      let totalWindows = 0;
      let completedBatches = 0;

      batches.forEach((batch) => {
        const winCount = batch.windows?.length || 0;
        totalWindows += winCount;
        const assignedPP = productionPacks.find((pp) =>
          pp.assignments.some((a) => a.projectId === project.id && a.batchId === batch.id)
        );
        if (assignedPP?.status === 'complete') completedBatches++;
        const t = batch.type || 'sash';
        summary[t] = (summary[t] || 0) + winCount;
      });

      return {
        projectId: project.id,
        projectName: project.name,
        projectNumber: project.project_number,
        summary, totalWindows, totalBatches: batches.length,
        completedBatches,
        allComplete: batches.length > 0 && completedBatches === batches.length,
      };
    });
  }, [visibleProjects, productionPacks]);

  // What each pack card shows: its categories (the pack's own first, then any
  // other category found among its batches) and one chip per project and category.
  const packCards = useMemo(() => productionPacks.map((pp) => {
    const assignments = pp.assignments || [];
    const categories = [pp.type || 'sash'];
    const chips = [];
    let totalWindows = 0;

    assignments.forEach(({ projectId, batchId }) => {
      const project = projects.find((p) => p.id === projectId);
      const batch = project?.batches?.find((b) => b.id === batchId);
      const count = batch?.windows?.length || 0;
      totalWindows += count;
      if (!project) return;
      const type = batch?.type || pp.type || 'sash';
      if (!categories.includes(type)) categories.push(type);
      const chip = chips.find((c) => c.projectId === projectId && c.type === type);
      if (chip) chip.count += count;
      else chips.push({ projectId, type, name: project.project_number || project.name, count });
    });

    return { pp, categories, chips, totalWindows, batchCount: assignments.length };
  }), [productionPacks, projects]);

  // ─── Pack placement ───
  // A pack sits beside the batches it serves: packs are ordered by the mean
  // height of their batches and moved down only as far as needed to clear the
  // pack above. Packs whose batches sit at about the same height (within one
  // batch row) keep their creation order, so a small shift does not swap them.
  // Heights and positions are read from the rendered elements.
  const [packPlan, setPackPlan] = useState({ order: [], gaps: {} });
  const packPlanSignature = useRef('');
  const [boardHeight, setBoardHeight] = useState(0);
  const [, setLayoutTick] = useState(0);

  useLayoutEffect(() => {
    const board = containerRef.current;
    const column = packsRef.current;
    if (!board || !column) return;
    const boardRect = board.getBoundingClientRect();
    const scale = boardScale(board, boardRect);
    const columnTop = (column.getBoundingClientRect().top - boardRect.top) / scale;
    const batchEls = elementsBy(board, 'data-batch-id');
    const packEls = elementsBy(column, 'data-pp-id');

    let previousTarget = 0;
    const wanted = [];
    productionPacks.forEach((pp, index) => {
      const packEl = packEls.get(pp.id);
      if (!packEl) return;   // not on the board (another category is picked in the legend)
      const mids = (pp.assignments || [])
        .map(({ batchId }) => batchEls.get(batchId))
        .filter(Boolean)
        .map((el) => boxInBoard(el, boardRect, scale).midY - columnTop);
      // a pack with no batch on the board stays right under the pack listed before it
      const target = mids.length ? mids.reduce((sum, y) => sum + y, 0) / mids.length : previousTarget;
      previousTarget = target;
      wanted.push({ id: pp.id, index, target, height: packEl.offsetHeight });
    });
    const heightStep = (pack) => Math.round(pack.target / (BATCH_H + BATCH_GAP));
    wanted.sort((a, b) => heightStep(a) - heightStep(b) || a.index - b.index);

    const gaps = {};
    let bottom = 0;
    wanted.forEach((pack, i) => {
      const top = Math.max(Math.round(pack.target - pack.height / 2), i === 0 ? 0 : bottom + PACK_GAP);
      gaps[pack.id] = top - bottom;
      bottom = top + pack.height;
    });

    const plan = { order: wanted.map((pack) => pack.id), gaps };
    const planSignature = JSON.stringify(plan);
    if (planSignature !== packPlanSignature.current) {
      packPlanSignature.current = planSignature;
      setPackPlan(plan);
    }
    const height = board.offsetHeight;
    setBoardHeight((current) => (current === height ? current : height));
  });

  // Re-measure when the board changes size for a reason React does not see
  // (window resize, a late web font). Placement and lines follow on the re-render.
  useEffect(() => {
    const board = containerRef.current;
    if (!board) return undefined;
    let alive = true;
    let frame = 0;
    const refresh = () => {
      if (!alive) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayoutTick((tick) => tick + 1));
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(board);
    if (packsRef.current) observer.observe(packsRef.current);
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  const shownPackCards = useMemo(
    () => (onlyType ? packCards.filter((card) => card.categories.includes(onlyType)) : packCards),
    [packCards, onlyType],
  );

  const orderedPackCards = useMemo(() => {
    const position = new Map(packPlan.order.map((id, i) => [id, i]));
    return shownPackCards
      .map((card, i) => ({ card, rank: position.has(card.pp.id) ? position.get(card.pp.id) : packPlan.order.length + i }))
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.card);
  }, [shownPackCards, packPlan]);

  const handleAssign = (batchId, projectId, ppId) => {
    const currentPP = getPackForBatch(projectId, batchId);
    if (currentPP) unassignBatch(currentPP.id, projectId, batchId);
    if (ppId) assignBatch(ppId, projectId, batchId);
  };

  const handleCreatePP = (name, type, deadline) => {
    createProductionPack(name, type, deadline);
    setShowNewPP(false);
  };

  const handleCreateProject = (name, address, number, clientId, clientName) => {
    createProject(name, address, number, clientId, clientName);
    setShowNewProject(false);
  };

  const handleEditProjectSave = (patch) => {
    if (editProject) {
      updateProject(editProject.id, patch);
      setEditProject(null);
    }
  };

  const handleDeleteProject = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    const batchCount = project.batches?.length || 0;
    setConfirmAction({
      title: `Delete "${project.name}"?`,
      message: `This will permanently delete the project${batchCount > 0 ? `, all ${batchCount} batches, and their windows` : ''}. Batch assignments in production packs will be removed.`,
      onConfirm: () => { deleteProject(project.id); setConfirmAction(null); },
    });
  };

  // v3 Block 6: Archive — straight away once every batch's pack is complete, with a confirm otherwise
  const packStatusFor = (project, batch) => productionPacks.find((pp) =>
    pp.assignments.some((a) => a.projectId === project.id && a.batchId === batch.id))?.status;
  const handleArchiveProject = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    const batches = project.batches || [];
    const open = batches.filter((batch) => packStatusFor(project, batch) !== 'complete').length;
    if (open === 0) { archiveProject(project.id); return; }
    setConfirmAction({
      title: `Archive "${project.name}"?`,
      message: `${open} of ${batches.length} batches ${open === 1 ? 'is' : 'are'} not complete. The project leaves the dashboard (packs, cut lists and exports stay readable in the Archive); you can restore it any time.`,
      confirmLabel: 'Archive',
      tone: 'accent',
      onConfirm: () => { archiveProject(project.id); setConfirmAction(null); },
    });
  };

  const handleDeletePP = (e, pp) => {
    e.preventDefault();
    e.stopPropagation();
    const batchCount = pp.assignments?.length || 0;
    setConfirmAction({
      title: `Delete "${pp.name}"?`,
      message: `This will permanently delete the production pack.${batchCount > 0 ? ` ${batchCount} batch assignments will be unlinked (batches themselves remain in their projects).` : ''}`,
      onConfirm: () => { deleteProductionPack(pp.id); setConfirmAction(null); },
    });
  };

  const handlePPStatusChange = (e, ppId) => {
    e.preventDefault();
    e.stopPropagation();
    updateProductionPack(ppId, { status: e.target.value });
  };

  const bandCount = visibleProjects.length;
  const zoomButtonClass = 'h-8 flex items-center justify-center text-ink-200 hover:text-ink-50 hover:bg-surface-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-200';

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 mb-5">
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Production planner</h1>
            <p className="text-[12px] text-ink-400 mt-0.5">Assign batches to production packs · track project completion</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 ml-auto">
            {/* Category key: click a category to see only its production packs */}
            <div className="flex items-center gap-1 text-[12px]" role="group" aria-label="Show one category">
              {Object.keys(TYPE_COLORS).map((type) => {
                const tc = typeColor(type);
                const active = onlyType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOnlyType(active ? null : type)}
                    aria-pressed={active}
                    title={active ? 'Show all production packs' : `Show only ${typeLabel(type)} production packs`}
                    className={`flex items-center gap-1.5 h-7 px-2 rounded-md border whitespace-nowrap transition-colors ${active ? '' : 'border-transparent text-ink-200 hover:text-ink-50 hover:bg-surface-600'} ${onlyType && !active ? 'opacity-50' : ''}`}
                    style={active ? { background: tc.bg, borderColor: tc.border, color: tc.text } : undefined}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: tc.dot }} />
                    {typeLabel(type)}
                  </button>
                );
              })}
            </div>
            {/* Zoom */}
            <div className="flex items-center rounded-lg border border-surface-500 overflow-hidden" role="group" aria-label="Board zoom">
              <button
                type="button"
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                disabled={zoom <= ZOOM_MIN}
                className={`w-8 ${zoomButtonClass}`}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1)}
                className={`min-w-[52px] px-2 border-x border-surface-500 text-[12px] font-medium tabular-nums ${zoomButtonClass}`}
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                disabled={zoom >= ZOOM_MAX}
                className={`w-8 ${zoomButtonClass}`}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5v14" /></svg>
              </button>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="input text-[13px] w-[220px]"
            />
            <div className="text-[12px] text-ink-400 whitespace-nowrap">
              {visibleProjects.length}/{projects.length} projects · {onlyType ? `${shownPackCards.length}/` : ''}{productionPacks.length} packs
            </div>
          </div>
        </div>

        {/* Board: scaled as one piece, so bands, cards and lines zoom together.
            The outer box reserves the height the scaled board really takes. */}
        <div style={boardHeight ? { height: boardHeight * zoom } : undefined}>
          <div
            ref={containerRef}
            className="relative"
            style={{
              width: `${100 / zoom}%`,
              minWidth: BOARD_MIN_W,
              transform: zoom === 1 ? undefined : `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <ConnectionLines
              containerRef={containerRef}
              projects={projects}
              productionPacks={productionPacks}
              onlyType={onlyType}
              hot={hot}
            />

            {/* Column headers: these name the four stages of the board, so they
                must read as headings, not as hint text under the page subtitle. */}
            <div className="grid mb-3" style={{ gridTemplateColumns: boardColumns() }}>
              <div style={{ gridColumn: COL.project }} className={HEADING_CLASS}>Projects</div>
              <div style={{ gridColumn: COL.batches }} className={HEADING_CLASS}>Batches</div>
              <div style={{ gridColumn: COL.packs }} className={HEADING_CLASS}>Production packs</div>
              <div style={{ gridColumn: COL.completeCard }} className={HEADING_CLASS}>Project complete</div>
            </div>

            {/* One row per project: its band on the left (project + batches) and
                its completion summary on the right share the row, so they always
                have the same height. The packs column spans all rows on its own;
                the last, flexible row takes whatever the packs need below the bands. */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: boardColumns(),
                gridTemplateRows: `${bandCount ? `repeat(${bandCount}, auto) ` : ''}minmax(0, 1fr)`,
              }}
            >
              {visibleProjects.map((project, index) => {
                const batches = project.batches || [];
                const d = deliveryData[index];
                const row = index + 1;
                const band = bandClass(index, index === bandCount - 1);
                const headline = project.project_number || project.name;
                const progress = d.totalBatches > 0
                  ? Math.round((d.completedBatches / d.totalBatches) * 100)
                  : 0;
                const typeSummary = Object.entries(d.summary)
                  .map(([type, count]) => `${count} ${typeLabel(type).toLowerCase()}`)
                  .join(', ');

                return (
                  <Fragment key={project.id}>
                    {/* ─── Band: project card + its batches ─── */}
                    <div
                      className={`flex items-center min-w-0 ${band}`}
                      style={{ gridColumn: COL.band, gridRow: row, gap: BAND_GAP, padding: BAND_PAD }}
                      {...pointAt('project', project.id)}
                    >
                      <div
                        data-project-id={project.id}
                        className="relative group"
                        style={{ flex: `${SHARE_PROJECT} 1 0%`, minWidth: 0 }}
                      >
                        <Link
                          to={`/projects/${project.id}`}
                          className="card px-3 py-2.5 flex flex-col justify-center gap-[3px] overflow-hidden hover:border-accent-500/40 transition-all"
                          style={{ minHeight: PROJECT_CARD_MIN_H }}
                        >
                          {/* on hover the headline makes room for the three buttons, so they never sit on its text */}
                          <div className="text-[15px] font-bold leading-tight text-ink-50 truncate group-hover:pr-[68px]" title={headline}>{headline}</div>
                          {project.project_number && (
                            <div className="text-[14px] leading-tight text-ink-100 truncate" title={project.name}>{project.name}</div>
                          )}
                          {project.client && (
                            <div className="text-[12px] leading-snug text-ink-200 truncate" title={project.client}>{project.client}</div>
                          )}
                          {project.address && (
                            <div className="text-[12px] leading-snug text-ink-200 truncate" title={project.address}>{project.address}</div>
                          )}
                          <DotList
                            className="text-[12px] leading-snug text-ink-200"
                            items={[plural(batches.length, 'batch', 'batches'), plural(d.totalWindows, 'window', 'windows')]}
                          />
                        </Link>
                        {/* Archive button (v3 Block 6) */}
                        <button
                          onClick={(e) => handleArchiveProject(e, project)}
                          className="absolute top-2 right-14 w-5 h-5 rounded flex items-center justify-center text-ink-400 hover:text-accent-400 hover:bg-accent-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Archive project (leaves the dashboard, stays readable in the Archive)"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="5" rx="1" />
                            <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
                            <path d="M10 12h4" />
                          </svg>
                        </button>
                        {/* Edit button */}
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditProject(project); }}
                          className="absolute top-2 right-8 w-5 h-5 rounded flex items-center justify-center text-ink-400 hover:text-accent-400 hover:bg-accent-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Edit project"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDeleteProject(e, project)}
                          className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[11px] text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete project"
                        >
                          🗑️
                        </button>
                      </div>

                      <div
                        className="flex flex-col"
                        style={{ flex: `${SHARE_BATCHES} 1 0%`, minWidth: 0, gap: BATCH_GAP }}
                      >
                        {batches.map((batch) => {
                          const tc = typeColor(batch.type);
                          const assignedPP = getPackForBatch(project.id, batch.id);
                          const winCount = batch.windows?.length || 0;
                          const batchLabel = `${typeLabel(batch.type)} ×${winCount}`;
                          const dimmed = !!onlyType && (batch.type || 'sash') !== onlyType;

                          return (
                            <div
                              key={batch.id}
                              data-batch-id={batch.id}
                              className="flex items-center gap-2 rounded-lg pl-3 pr-2 transition-opacity"
                              style={{ height: BATCH_H, background: tc.bg, border: `1px solid ${tc.border}`, opacity: dimmed ? DIMMED_OPACITY : 1 }}
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tc.dot }} />
                              <span className="text-[14px] font-semibold truncate min-w-0" style={{ color: tc.text }} title={batchLabel}>
                                {batchLabel}
                              </span>
                              {/* The assign control takes the room the label leaves and shortens
                                  its own text first (the full pack name stays in its tooltip and on
                                  the pack card); the label gives way only below a clickable minimum. */}
                              <span className="flex justify-end" style={{ flex: '1 1 0%', minWidth: 40 }}>
                                <BatchAssignDropdown
                                  batchId={batch.id}
                                  projectId={project.id}
                                  productionPacks={productionPacks}
                                  currentPPId={assignedPP?.id || ''}
                                  onAssign={handleAssign}
                                />
                              </span>
                            </div>
                          );
                        })}
                        {batches.length === 0 && (
                          <div className="text-[12px] text-ink-400 italic">No batches</div>
                        )}
                      </div>
                    </div>

                    {/* ─── Band: project complete (same row, same height) ─── */}
                    <div
                      className={`flex items-center min-w-0 ${band}`}
                      style={{ gridColumn: COL.complete, gridRow: row, padding: BAND_PAD }}
                      {...pointAt('project', project.id)}
                    >
                      <div
                        data-delivery-id={d.projectId}
                        className="card w-full min-w-0 px-3.5 py-2.5 flex flex-col justify-center gap-1.5"
                        style={{ minHeight: SUMMARY_CARD_MIN_H }}
                        title={typeSummary || undefined}
                      >
                        <div className="flex items-baseline gap-2">
                          {d.projectNumber && (
                            <span className="text-[14px] font-bold text-ink-50 shrink-0">{d.projectNumber}</span>
                          )}
                          <span className="text-[14px] text-ink-100 truncate">{d.projectName}</span>
                          <span className="ml-auto text-[14px] font-bold text-ink-50 tabular-nums">{progress}%</span>
                        </div>
                        <div className="text-[12px] text-ink-200">{d.completedBatches}/{d.totalBatches} batches</div>
                        <div className="h-1.5 rounded-full bg-surface-500 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progress}%`,
                              background: d.allComplete ? '#10B981' : '#00B4A0',
                            }}
                          />
                        </div>
                        {d.allComplete && (
                          <div className="text-[11px] text-green-400 uppercase tracking-wider font-medium">
                            Ready for delivery
                          </div>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}

              {/* ─── Production packs: independent cards, not part of any band ─── */}
              <div
                ref={packsRef}
                className="flex flex-col min-w-0"
                style={{ gridColumn: COL.packs, gridRow: `1 / span ${bandCount + 1}`, alignSelf: 'start' }}
              >
                {orderedPackCards.map(({ pp, categories, chips, totalWindows, batchCount }, i) => {
                  const statusColor = STATUS_CONFIG[pp.status]?.color || '#F59E0B';

                  return (
                    <div
                      key={pp.id}
                      className="relative group"
                      style={{ marginTop: packPlan.gaps[pp.id] ?? (i === 0 ? 0 : PACK_GAP) }}
                      {...pointAt('pack', pp.id)}
                    >
                      <div
                        data-pp-id={pp.id}
                        className="card-elevated overflow-hidden hover:border-accent-500/40 transition-all cursor-pointer"
                        onClick={() => navigate(`/production-packs/${pp.id}`)}
                      >
                        {/* Thin top accent in the category colour (one segment per category) */}
                        <div className="flex" style={{ height: 3 }}>
                          {categories.map((type) => (
                            <span key={type} className="flex-1" style={{ background: typeColor(type).line }} />
                          ))}
                        </div>

                        <div className="px-3.5 py-2.5 flex flex-col gap-[7px]">
                          <div className="flex items-center gap-2 pr-6">
                            {categories.map((type) => (
                              <span
                                key={type}
                                className="text-[12px] leading-tight font-semibold px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: typeColor(type).bg, color: typeColor(type).text }}
                              >
                                {typeLabel(type)}
                              </span>
                            ))}
                            <span className="text-[15px] font-bold text-ink-50 truncate" title={pp.name}>{pp.name}</span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className="relative inline-flex items-center">
                              <select
                                className="h-6 pl-2.5 text-[12px] font-semibold rounded-full cursor-pointer outline-none"
                                style={{
                                  background: `${statusColor}22`,
                                  color: statusColor,
                                  border: `1px solid ${statusColor}66`,
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  paddingRight: '22px',
                                }}
                                value={pp.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); handlePPStatusChange(e, pp.id); }}
                              >
                                {BATCH_STATUSES.map((s) => (
                                  <option key={s} value={s}>{statusOptionLabel(s)}</option>
                                ))}
                              </select>
                              <span className="absolute right-2" style={{ color: statusColor, fontSize: '9px', pointerEvents: 'none' }}>▾</span>
                            </span>
                            {pp.deadline && (
                              <span className="text-[12px] text-ink-200 whitespace-nowrap">
                                DL {new Date(pp.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-200">
                            <span className="whitespace-nowrap">
                              {totalWindows} window{totalWindows !== 1 ? 's' : ''} · {batchCount} batch{batchCount !== 1 ? 'es' : ''}
                            </span>
                            {chips.map((chip) => (
                              <span
                                key={`${chip.projectId}-${chip.type}`}
                                className="leading-tight font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                style={{ background: typeColor(chip.type).bg, color: typeColor(chip.type).text }}
                              >
                                {chip.name} ×{chip.count}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeletePP(e, pp)}
                        className="absolute top-2.5 right-2 w-5 h-5 rounded flex items-center justify-center text-[11px] text-ink-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete production pack"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* New project / new pack: under their columns, outside the scaled
            board so the forms keep their normal size at any zoom. */}
        <div
          className="grid mt-3"
          style={{ gridTemplateColumns: boardColumns(zoom), minWidth: BOARD_MIN_W * zoom }}
        >
          {/* may reach past its narrow column into the empty space beside it */}
          <div style={{ gridColumn: COL.project, minWidth: showNewProject ? 260 : 132 }}>
            {showNewProject ? (
              <NewProjectForm onCreate={handleCreateProject} onCancel={() => setShowNewProject(false)} />
            ) : (
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-surface-500 text-ink-400 text-[13px] hover:border-accent-500 hover:text-accent-400 transition-all"
              >
                + New project
              </button>
            )}
          </div>
          <div className="min-w-0" style={{ gridColumn: COL.packs }}>
            {showNewPP ? (
              <NewPPForm onCreate={handleCreatePP} onCancel={() => setShowNewPP(false)} />
            ) : (
              <button
                onClick={() => setShowNewPP(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-surface-500 text-ink-400 text-[13px] hover:border-accent-500 hover:text-accent-400 transition-all"
              >
                + New production pack
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
          confirmLabel={confirmAction.confirmLabel}
          tone={confirmAction.tone}
        />
      )}

      {/* Edit project modal */}
      {editProject && (
        <EditProjectModal
          project={editProject}
          onSave={handleEditProjectSave}
          onCancel={() => setEditProject(null)}
        />
      )}
    </>
  );
}
