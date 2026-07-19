import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAuthStore } from '../../stores/authStore.js';

export default function AppSidebar() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const productionPacks = useProjectStore((s) => s.productionPacks);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [winSettingsOpen, setWinSettingsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className="w-[220px] shrink-0 bg-surface-900 border-r border-surface-500 flex flex-col h-full">

      {/* ─── Logo ─── */}
      <div className="px-3 py-3 border-b border-surface-500">
        <img src="/logo-full.png" alt="Production Core" className="h-12 w-auto" />
      </div>

      {/* ─── Main nav ─── */}
      <nav className="flex-1 overflow-auto py-2 px-2">

        {/* Estimates */}
        <NavLink to="/estimates"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
              isActive
                ? 'bg-accent-500/12 text-accent-400 font-medium'
                : 'text-ink-200 hover:bg-surface-700 hover:text-ink-50'
            }`
          }>
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
          </svg>
          Estimates
        </NavLink>

        {/* Dashboard */}
        <NavLink to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
              isActive
                ? 'bg-accent-500/12 text-accent-400 font-medium'
                : 'text-ink-200 hover:bg-surface-700 hover:text-ink-50'
            }`
          }>
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Dashboard
        </NavLink>

        {/* Materials (expandable) — Production Materials + Ironmongery */}
        <button
          onClick={() => setMaterialsOpen(!materialsOpen)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors text-ink-200 hover:bg-surface-700 hover:text-ink-50 w-full text-left"
        >
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="flex-1">Materials</span>
          <svg className={`w-3.5 h-3.5 text-ink-400 transition-transform ${materialsOpen ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {materialsOpen && (
          <div className="pl-4 mb-1">
            <NavLink
              to="/materials"
              end
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-md text-[12px] mb-0.5 transition-colors ${
                  isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'
                }`
              }
            >
              Production Materials
            </NavLink>
            <NavLink
              to="/ironmongery"
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-md text-[12px] mb-0.5 transition-colors ${
                  isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'
                }`
              }
            >
              Ironmongery
            </NavLink>
          </div>
        )}

        {/* Clients */}
        <NavLink to="/clients"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
              isActive
                ? 'bg-accent-500/12 text-accent-400 font-medium'
                : 'text-ink-200 hover:bg-surface-700 hover:text-ink-50'
            }`
          }>
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Clients
        </NavLink>

        {/* ─── Separator + Setup section ─── */}
        <div className="h-px bg-surface-500/50 my-2 mx-2" />
        <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Setup</div>

        {/* Assign Materials — top-level with own icon */}
        <button
          onClick={() => setAssignmentsOpen(!assignmentsOpen)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors text-ink-200 hover:bg-surface-700 hover:text-ink-50 w-full text-left"
        >
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          <span className="flex-1">Assign Materials</span>
          <svg className={`w-3.5 h-3.5 text-ink-400 transition-transform ${assignmentsOpen ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>


        {assignmentsOpen && (
          <div className="pl-4 mb-1">
            <div className="pl-3 ml-2 border-l border-surface-500/50">
              <NavLink to="/materials/assignments/sash"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Sash windows
              </NavLink>
              <NavLink to="/materials/assignments/casement"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Casement
              </NavLink>
              <NavLink to="/materials/assignments/fix-frame"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Fix frame
              </NavLink>
              <NavLink to="/materials/assignments/doors"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Doors
              </NavLink>
              <NavLink to="/materials/assignments/other"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Other
              </NavLink>
              <div className="px-3 py-1 text-[11px] text-ink-400/50 cursor-default">
                + Add new
              </div>
            </div>
          </div>
        )}

        {/* Window Settings — workshop construction profile */}
        <button
          onClick={() => setWinSettingsOpen(!winSettingsOpen)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors text-ink-200 hover:bg-surface-700 hover:text-ink-50 w-full text-left"
        >
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="1" />
            <path d="M4 12h16M12 3v18" />
          </svg>
          <span className="flex-1">Window Settings</span>
          <svg className={`w-3.5 h-3.5 text-ink-400 transition-transform ${winSettingsOpen ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {winSettingsOpen && (
          <div className="pl-4 mb-1">
            <div className="pl-3 ml-2 border-l border-surface-500/50">
              <NavLink to="/window-settings/sash"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Sash windows
              </NavLink>
              <NavLink to="/window-settings/casement"
                className={({ isActive }) => `block px-3 py-1 rounded-md text-[11px] mb-0.5 transition-colors ${isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700/60 hover:text-ink-100'}`}>
                Casement
              </NavLink>
              <div className="px-3 py-1 text-[11px] text-ink-400/50 cursor-default">Fix frame — soon</div>
              <div className="px-3 py-1 text-[11px] text-ink-400/50 cursor-default">Doors — soon</div>
            </div>
          </div>
        )}

      </nav>

      {/* ─── Bottom section ─── */}
      <div className="border-t border-surface-500 px-2 py-2">

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors w-full text-left ${
              isActive ? 'bg-accent-500/12 text-accent-400 font-medium' : 'text-ink-300 hover:bg-surface-700 hover:text-ink-50'
            }`
          }
        >
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </NavLink>

        {/* My Account */}
        <button
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors text-ink-300 hover:bg-surface-700 hover:text-ink-50 w-full text-left"
          onClick={() => { /* placeholder */ }}
        >
          <div className="w-[18px] h-[18px] rounded-full bg-accent-500/20 text-accent-400 grid place-items-center text-[9px] font-semibold shrink-0">
            {initials}
          </div>
          <span className="flex-1 truncate">My account</span>
          <span className="text-[10px] text-ink-400 truncate max-w-[80px]">{session?.user?.email?.split('@')[0] || ''}</span>
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors text-ink-400 hover:bg-surface-700 hover:text-ink-200 w-full text-left"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
