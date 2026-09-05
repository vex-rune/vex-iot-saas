import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/components/ui/RequireAuth';
import AppShell from '@/components/ui/AppShell';
import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/dashboard/Dashboard';
import Devices from '@/pages/devices/List';
import DeviceDetail from '@/pages/devices/Detail';
import DeviceCreate from '@/pages/devices/Create';
import DeviceEdit from '@/pages/devices/Edit';
import PointAlarmEvents from '@/pages/alarms/PointEvents';
import NotifyUsers from '@/pages/notify/Users';
import AdminAccounts from '@/pages/admin/Accounts';
import AdminTenants from '@/pages/admin/Tenants';

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
