// ─── Batch specification summary ───
// Aggregates per-window values into a batch-level summary strip.
// Windows are the single source of truth — this replaces the old static
// batch.defaults strip (batches can mix ironmongery, colours, glass, etc.).
//
// Output: [{ label: 'Ironmongery', text: 'brass ×8, chrome ×2' }, ...]
// Single unique value renders without the ×n counter.

function tallyField(windows, getter, format = (v) => v) {
  const tally = new Map();
  windows.forEach((w) => {
    const raw = getter(w);
    const key = raw === undefined || raw === null || raw === '' ? '—' : String(raw);
    tally.set(key, (tally.get(key) || 0) + 1);
  });
  const entries = [...tally.entries()];
  if (entries.length === 0) return '—';
  if (entries.length === 1) return format(entries[0][0]);
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => `${format(value)} ×${count}`)
    .join(', ');
}

export function summarizeWindows(windows = [], batchType = 'sash') {
  const rows = [
    { label: 'Ironmongery', text: tallyField(windows, (w) => w.ironmongery) },
    { label: 'Colour', text: tallyField(windows, (w) => w.colourMode, (v) => (v === 'dual' ? 'Dual' : 'Single')) },
    { label: 'Glass', text: tallyField(windows, (w) => w.glassType) },
    { label: 'Frame', text: tallyField(windows, (w) => w.frameType) },
  ];
  if (batchType === 'sash') {
    rows.push({ label: 'Horns', text: tallyField(windows, (w) => w.hornType) });
  }
  rows.push({
    label: 'PAS24',
    text: tallyField(windows, (w) => w.pas24 === true, (v) => (v === 'true' ? 'Yes' : 'No')),
  });
  return rows;
}
