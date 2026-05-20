import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import BatchDefaultsPage from './pages/BatchDefaultsPage.jsx';
import ConfiguratorPage from './pages/ConfiguratorPage.jsx';
import WindowDetailPage from './pages/WindowDetailPage.jsx';
import ProductionPackPage from './pages/ProductionPackPage.jsx';
import { useAuthStore } from './stores/authStore.js';

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

  // Preload heavy 3D modules in background after login.
  // Without this, first visit to Configurator triggers a 2MB JS chunk parse
  // + initial render simultaneously, causing GPU memory peak → WebGL Context Lost
  // on slower machines / fresh browser sessions.
  // This warms the module cache so when the user clicks "Add Window",
  // the 3D viewer mounts instantly without a heavy parse step.
  useEffect(() => {
    if (!session) return;
    // Use requestIdleCallback to avoid blocking the main thread
    const idleHandle = ('requestIdleCallback' in window)
      ? window.requestIdleCallback(() => {
          import('./3d/App.jsx').catch(() => {});
          import('./components/viewer/WindowPreview3D.jsx').catch(() => {});
        }, { timeout: 3000 })
      : setTimeout(() => {
          import('./3d/App.jsx').catch(() => {});
          import('./components/viewer/WindowPreview3D.jsx').catch(() => {});
        }, 1500);
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
        <Route path="projects/:projectId/batches/:batchId/windows/:windowId" element={<WindowDetailPage />} />
      </Route>

      {/* Full-screen pages (outside AppLayout — no sidebar) */}
      <Route path="/projects/:projectId/batches/:batchId/defaults" element={<ProtectedRoute><BatchDefaultsPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId/batches/:batchId/configurator" element={<ProtectedRoute><ConfiguratorPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId/batches/:batchId/production-pack" element={<ProtectedRoute><ProductionPackPage /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
