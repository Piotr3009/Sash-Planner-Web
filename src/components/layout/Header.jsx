import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { hasSupabaseConfig } from '../../services/supabase.js';

export default function Header() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-14 border-b border-ink-200 bg-white px-6 flex items-center justify-between">
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-accent-500 text-white grid place-items-center font-bold">S</div>
        <div>
          <div className="font-semibold text-ink-900 leading-none">Sash Planner</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400">Production planning</div>
        </div>
      </Link>

      <nav className="flex items-center gap-3 text-sm">
        <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
        {!hasSupabaseConfig && (
          <span className="px-2 py-1 text-[11px] rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            Mock data mode
          </span>
        )}
        <span className="text-ink-600 text-xs hidden md:inline">{session?.user?.email}</span>
        <button onClick={handleSignOut} className="btn btn-secondary">Sign out</button>
      </nav>
    </header>
  );
}
