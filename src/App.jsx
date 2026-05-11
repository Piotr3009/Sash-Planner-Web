import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EstimateDetailPage from './pages/EstimateDetailPage.jsx';
import WindowDetailPage from './pages/WindowDetailPage.jsx';
import ConfiguratorPage from './pages/ConfiguratorPage.jsx';
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

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="estimates/:estimateId" element={<EstimateDetailPage />} />
        <Route path="estimates/:estimateId/windows/:itemId" element={<WindowDetailPage />} />
      </Route>
      {/* Configurator — full screen, outside AppLayout (no sidebar) */}
      <Route
        path="/estimates/:estimateId/configurator"
        element={
          <ProtectedRoute>
            <ConfiguratorPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}