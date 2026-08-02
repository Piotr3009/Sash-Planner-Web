/**
 * MaterialWeightsPage.jsx — placeholder.
 *
 * Will hold per-material weight data (timber densities, glass unit weights,
 * hardware piece weights) so the engine can total a whole window's weight.
 * Scope and table design TBC with Piotr — this page only reserves the menu
 * entry and route (Piotr 02.08.2026).
 */
export default function MaterialWeightsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-ink-50 mb-2">Material Weights</h1>
      <p className="text-[13px] text-ink-400 mb-6">
        Weight data per material — timber, glass, ironmongery — feeding the total
        window weight calculation.
      </p>
      <div className="card p-8 text-center">
        <div className="text-ink-300 text-[14px] mb-1">Coming soon</div>
        <div className="text-ink-500 text-[12px]">
          The weight tables are being designed. Nothing to set up here yet.
        </div>
      </div>
    </div>
  );
}
