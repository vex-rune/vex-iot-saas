import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';
import AppShell from '@/components/AppShell';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Devices from '@/pages/Devices';
import DeviceDetail from '@/pages/DeviceDetail';
import DeviceCreate from '@/pages/DeviceCreate';
import DeviceEdit from '@/pages/DeviceEdit';
import PointAlarmEvents from '@/pages/PointAlarmEvents';
import NotifyUsers from '@/pages/NotifyUsers';
import AdminAccounts from '@/pages/AdminAccounts';
import AdminTenants from '@/pages/AdminTenants';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/login/admin" element={<Login />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/new" element={<DeviceCreate />} />
        <Route path="/devices/:id/edit" element={<DeviceEdit />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/alarms/events" element={<PointAlarmEvents />} />
        <Route path="/notify-users" element={<NotifyUsers />} />
        <Route path="/admin/accounts" element={<AdminAccounts />} />
        <Route path="/admin/tenants" element={<AdminTenants />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
