// ─── Batch specification summary ───
// Aggregates per-window values into a batch-level summary strip.
// Windows are the single source of truth — this replaces the old static
// batch.defaults strip (batches can mix ironmongery, colours, glass, etc.).
//
// Output: [{ label: 'Ironmongery', text: 'brass ×8, chrome ×2' }, ...]
// Single unique value renders without the ×n counter.
import { getFireDoorProfile } from '../engine/profile.js';
import { fireDoorCloserKind } from '../engine/specification.js';

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

// Fire doors (27.10.2026): the rating, the lock and the closer from the item
// fields the configurator stores (firedoorFire, firedoorRating,
// firedoorLockType, firedoorCloser); a field left unset reads as the fire door
// profile default. v1.1: the closer is a kind ('none' | 'surface' |
// 'builtin', a v1 boolean true = built in), unset = the profile's closerFire /
// closerNonFire, counted by kind. No swing. A fire door batch has no Frame /
// PAS24 rows: the frame is the engine's 50 x depth set and PAS24 is an
// external door test.
const FIREDOOR_LOCK_WORDS = { latch: 'latch', euro: 'sashlock euro', bathroom: 'bathroom' };
const FIREDOOR_CLOSER_WORDS = { none: 'none', surface: 'surface closer', builtin: 'built in closer' };

function summarizeFireDoors(windows, rows) {
  const D = getFireDoorProfile()?.defaults || {};
  const isFire = (w) => (typeof w.firedoorFire === 'boolean' ? w.firedoorFire : D.fire !== false);
  const rating = (w) => (isFire(w) ? ((w.firedoorRating || D.rating) === 'FD60' ? 'FD60' : 'FD30') : 'non fire');
  const lock = (w) => FIREDOOR_LOCK_WORDS[w.firedoorLockType] || FIREDOOR_LOCK_WORDS[D.lockType] || FIREDOOR_LOCK_WORDS.latch;
  const closer = (w) => fireDoorCloserKind(w.firedoorCloser, isFire(w) ? D.closerFire : D.closerNonFire);
  rows.push({ label: 'Rating', text: tallyField(windows, rating) });
  rows.push({ label: 'Lock', text: tallyField(windows, lock) });
  rows.push({ label: 'Closer', text: tallyField(windows, closer, (v) => FIREDOOR_CLOSER_WORDS[v] || 'closer') });
  return rows;
}

export function summarizeWindows(windows = [], batchType = 'sash') {
  const rows = [
    { label: 'Ironmongery', text: tallyField(windows, (w) => w.ironmongery) },
    { label: 'Colour', text: tallyField(windows, (w) => w.colourMode, (v) => (v === 'dual' ? 'Dual' : 'Single')) },
    { label: 'Glass', text: tallyField(windows, (w) => w.glassType) },
  ];
  if (batchType === 'firedoor') return summarizeFireDoors(windows, rows);
  rows.push({ label: 'Frame', text: tallyField(windows, (w) => w.frameType) });
  if (batchType === 'sash') {
    rows.push({ label: 'Horns', text: tallyField(windows, (w) => w.hornType) });
  }
  rows.push({
    label: 'PAS24',
    text: tallyField(windows, (w) => w.pas24 === true, (v) => (v === 'true' ? 'Yes' : 'No')),
  });
  return rows;
}
