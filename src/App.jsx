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
  useEffect(() => { init(); }, [init]);

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
