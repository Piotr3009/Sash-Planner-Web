/**
 * ArchivePage.jsx — placeholder.
 *
 * Will list completed (archived) projects, kept out of the active dashboard.
 * Behaviour, tables and SQL TBC with Piotr — this page only reserves the menu
 * entry and route (Piotr 02.08.2026).
 */
export default function ArchivePage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-ink-50 mb-2">Archive</h1>
      <p className="text-[13px] text-ink-400 mb-6">
        Completed projects will live here, out of the way of active production.
      </p>
      <div className="card p-8 text-center">
        <div className="text-ink-300 text-[14px] mb-1">Coming soon</div>
        <div className="text-ink-500 text-[12px]">
          Archiving is being designed. Completed projects stay on the dashboard for now.
        </div>
      </div>
    </div>
  );
}
