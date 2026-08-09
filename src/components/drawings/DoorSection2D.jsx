/**
 * DoorSection2D.jsx
 *
 * PLACEHOLDER — the tab exists so the layout is settled, the drawing is not
 * written yet (Piotr 05.08: "dodaj sections, na razie pusta").
 *
 * When it is built it must be a PLAN view (looking down), because that is the
 * only view that shows what the workshop needs here:
 *   · french doors — how the rebate between the two leaves is formed and which
 *     leaf opens first (active vs passive);
 *   · single doors — whether the door swings in or out, and which way round.
 * Frame and leaf sections are drawn from the same profile the engine uses, so
 * this sheet must read getDoorProfile() rather than carry its own numbers.
 */
export default function DoorSection2D({ windowSpec, derived }) {
  const d = windowSpec?.door || {};
  const dr = derived?.door;
  const swing = dr ? (dr.inward ? 'inward' : 'outward') : '—';
  const openSide = d.hingeSide || '—';

  return (
    <div className="card p-8 text-center">
      <div className="text-sm font-semibold text-ink-100 mb-1">Sections — plan view</div>
      <div className="text-xs text-ink-400 max-w-md mx-auto">
        Not drawn yet. This sheet will be a view from above, showing the frame
        and leaf rebate — for french doors which leaf opens first, and for
        single doors the swing direction.
      </div>
      <div className="text-[11px] text-ink-500 mt-3">
        Current door: {d.type || 'single-external'} · {swing} · open {openSide}
      </div>
    </div>
  );
}
