import {Navigate, useLocation} from 'react-router-dom';
import {useAuthStore} from '@/stores/authStore';
import {hasRole} from '@/lib/perm';
import type {ReactNode} from 'react';

// ─── 登录守卫 ──────────────────────────────────────────────────────

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({children}: RequireAuthProps) {
  const location = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

// ─── 角色守卫 ──────────────────────────────────────────────────────

interface RequireRoleProps {
    /** 允许的角色列表 — 用户 roles 中包含任一即可通过 */
    roles: string[];
    children: ReactNode;
}

/**
 * 路由级角色守卫。
 *
 * 用法:
 *   <RequireRole roles={[ROLE_SUPER_ADMIN]}>
 *     <AdminPage />
 *   </RequireRole>
 *
 * 无权限时重定向到 /dashboard。
 */
export function RequireRole({roles, children}: RequireRoleProps) {
    const location = useLocation();
    const userRoles = useAuthStore((s) => s.user?.roles);

    if (!hasRole(userRoles, roles)) {
        return <Navigate to="/dashboard" replace state={{from: location}}/>;
    }

    return <>{children}</>;
}
