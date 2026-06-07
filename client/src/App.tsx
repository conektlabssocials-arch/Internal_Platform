import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout';
import AdminRoute from './routes/AdminRoute';
import ProtectedRoute from './routes/ProtectedRoute';
import Campaigns from './pages/Campaigns';
import CRM from './pages/CRM';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Operations from './pages/Operations';
import Plans from './pages/Plans';
import PlatformSettings from './pages/PlatformSettings';
import PublicSharedPlan from './pages/PublicSharedPlan';
import Users from './pages/Users';

const App = () => {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="share/plan/:token" element={<PublicSharedPlan />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="crm" element={<CRM />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="plans" element={<Plans />} />
        <Route path="operations" element={<Operations />} />
        <Route path="settings" element={<Navigate to="/settings/platform" replace />} />
        <Route path="settings/platform" element={<PlatformSettings />} />
        <Route
          path="settings/users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
