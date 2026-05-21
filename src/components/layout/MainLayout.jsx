import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';

export default function MainLayout() {
  return (
    <div className="h-screen flex">
      <AppSidebar />
      <main className="flex-1 overflow-auto bg-surface-800">
        <Outlet />
      </main>
    </div>
  );
}
