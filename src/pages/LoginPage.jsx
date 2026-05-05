import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { hasSupabaseConfig } from '../services/supabase.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithMockData = useAuthStore((s) => s.signInWithMockData);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('[LoginPage] session changed:', session);
    if (session) {
      console.log('[LoginPage] navigating to /dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.ok) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ink-100 to-ink-200 p-6">
      <div className="card w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent-500 text-white grid place-items-center font-bold">S</div>
          <div>
            <h1 className="text-xl font-semibold">Sash Planner</h1>
            <p className="text-xs text-ink-400">Production planning for sash window manufacturers</p>
          </div>
        </div>

        {!hasSupabaseConfig && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Supabase not configured. You can sign in with mock data to explore the app, or copy <code>.env.example</code> to <code>.env</code> and add real keys.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-ink-200">
          <button
            type="button"
            onClick={() => {
              console.log('[LoginPage] mock button clicked');
              signInWithMockData();
              console.log('[LoginPage] session after mock:', useAuthStore.getState().session);
            }}
            className="btn btn-secondary w-full"
          >
            Continue with mock data
          </button>
        </div>
      </div>
    </div>
  );
}