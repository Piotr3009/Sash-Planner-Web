import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import BatchDefaultsPage from './pages/BatchDefaultsPage.jsx';
import { useAuthStore } from './stores/authStore.js';

// ── Lazy-load pages that import 3D dependencies (THREE.js, R3F, ParametricSashWindow).
// Without this, static imports pull ~2MB of 3D code into the main bundle,
// causing WebGL Context Lost on first Canvas mount from cold start.
const ConfiguratorPage = lazy(() => import('./pages/ConfiguratorPage.jsx'));
const WindowDetailPage = lazy(() => import('./pages/WindowDetailPage.jsx'));
const ProductionPackPage = lazy(() => import('./pages/ProductionPackPage.jsx'));

const PageLoading = () => (
  <div className="min-h-screen grid place-items-center">
    <p className="text-ink-400 text-sm">Loading…</p>
  </div>
);

function ProtectedRoute({ children }) {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  if (loading) return <div className="min-h-screen grid place-items-center"><p>Loading…</p></div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  useEffect(() => { init(); }, [init]);

  // Preload 3D chunks in background after login.
  // Warms the module cache so first visit to any 3D page loads instantly.
  useEffect(() => {
    if (!session) return;
    const preload = () => {
      import('./pages/WindowDetailPage.jsx').catch(() => {});
      import('./pages/ConfiguratorPage.jsx').catch(() => {});
      import('./pages/ProductionPackPage.jsx').catch(() => {});
    };
    const idleHandle = ('requestIdleCallback' in window)
      ? window.requestIdleCallback(preload, { timeout: 3000 })
      : setTimeout(preload, 1500);
    return () => {
      if ('cancelIdleCallback' in window && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
    };
  }, [session]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Main layout with sidebar */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="projects/:projectId/batches/:batchId/windows/:windowId" element={
          <Suspense fallback={<PageLoading />}><WindowDetailPage /></Suspense>
        } />
      </Route>

      {/* Full-screen pages (outside AppLayout — no sidebar) */}
      <Route path="/projects/:projectId/batches/:batchId/defaults" element={<ProtectedRoute><BatchDefaultsPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId/batches/:batchId/configurator" element={
        <ProtectedRoute><Suspense fallback={<PageLoading />}><ConfiguratorPage /></Suspense></ProtectedRoute>
      } />
      <Route path="/projects/:projectId/batches/:batchId/production-pack" element={
        <ProtectedRoute><Suspense fallback={<PageLoading />}><ProductionPackPage /></Suspense></ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
