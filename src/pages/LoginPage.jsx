import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const signIn = useAuthStore((s) => s.signIn);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('[LoginPage] session changed:', session);
    if (session) {
      // Land on "/" so the post-login splash (LandingPage) plays; it routes on to the dashboard.
      console.log('[LoginPage] navigating to /');
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.ok) navigate('/');
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ink-100 to-ink-200 p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <img src="/logo-full.png" alt="Production Core" className="h-12 w-auto mx-auto mb-2" />
          <p className="text-xs text-ink-400">Windows & Doors Timber Production</p>
        </div>

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
      </div>
    </div>
  );
}