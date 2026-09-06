import {Navigate, Route, Routes} from 'react-router-dom';
import {RequireAuth, RequireRole} from '@/components/ui/RequireAuth';
import {ROLE_SUPER_ADMIN} from '@/lib/perm';
import AppShell from '@/components/ui/AppShell';
import Login from '@/pages/auth/LoginPage';
import Dashboard from '@/pages/dashboard/DashboardPage';
import Devices from '@/pages/devices/ListPage';
import DeviceDetail from '@/pages/devices/DetailPage';
import DeviceCreate from '@/pages/devices/CreatePage';
import DeviceEdit from '@/pages/devices/EditPage';
import DeviceTemplates from '@/pages/templates/ListPage';
import DeviceTemplateCreate from '@/pages/templates/CreatePage';
import DeviceTemplateDetail from '@/pages/templates/DetailPage';
import PointAlarmEvents from '@/pages/alarms/PointEventsPage';
import NotifyUsers from '@/pages/notify/UsersPage';
import AdminAccounts from '@/pages/admin/AccountsPage';
import AdminTenants from '@/pages/admin/TenantsPage';

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login/>}/>
            <Route path="/login/admin" element={<Login/>}/>

            <Route
                element={
                    <RequireAuth>
                        <AppShell/>
                    </RequireAuth>
                }
            >
                <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/devices" element={<Devices/>}/>
                <Route path="/devices/new" element={<DeviceCreate/>}/>
                <Route path="/devices/:id/edit" element={<DeviceEdit/>}/>
                <Route path="/devices/:id" element={<DeviceDetail/>}/>
                <Route path="/templates"
                       element={<RequireRole roles={[ROLE_SUPER_ADMIN]}><DeviceTemplates/></RequireRole>}/>
                <Route path="/templates/new"
                       element={<RequireRole roles={[ROLE_SUPER_ADMIN]}><DeviceTemplateCreate/></RequireRole>}/>
                <Route path="/templates/:id"
                       element={<RequireRole roles={[ROLE_SUPER_ADMIN]}><DeviceTemplateDetail/></RequireRole>}/>
                <Route path="/alarms/events" element={<PointAlarmEvents/>}/>
                <Route path="/notify-users" element={<NotifyUsers/>}/>
                {/* 仅 SUPER_ADMIN 可访问的管理页面 */}
                <Route path="/admin/accounts"
                       element={<RequireRole roles={[ROLE_SUPER_ADMIN]}><AdminAccounts/></RequireRole>}/>
                <Route path="/admin/tenants"
                       element={<RequireRole roles={[ROLE_SUPER_ADMIN]}><AdminTenants/></RequireRole>}/>

            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
    );
}
