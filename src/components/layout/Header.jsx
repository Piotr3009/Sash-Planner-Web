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
    <header className="h-14 border-b border-surface-500 bg-surface-900 px-6 flex items-center justify-between">
      <Link to="/dashboard" className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-500 text-white grid place-items-center font-bold text-sm">S</div>
        <div>
          <div className="font-semibold text-ink-50 leading-none text-sm">Production Core</div>
          <div className="text-[10px] uppercase tracking-widest text-accent-500 font-medium">Production</div>
        </div>
      </Link>

      <nav className="flex items-center gap-3 text-sm">
        <Link to="/dashboard" className="btn btn-ghost text-xs">Dashboard</Link>
        {!hasSupabaseConfig && (
          <span className="px-2 py-1 text-[10px] rounded-full bg-status-prep/15 text-status-prep border border-status-prep/30">
            Mock data
          </span>
        )}
        <span className="text-ink-400 text-xs hidden md:inline">{session?.user?.email}</span>
        <button onClick={handleSignOut} className="btn btn-secondary text-xs py-1.5">Sign out</button>
      </nav>
    </header>
  );
}
