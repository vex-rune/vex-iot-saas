/**
 * 权限工具:UI 层按角色显隐按钮/菜单,后端 @PreAuthorize 二次校验。
 *
 * 角色命名对齐后端 `RoleConstants`:
 *  - SUPER_ADMIN: 超级管理员(动态码登录),跨租户管理,拥有所有权限
 *  - ADMIN      : 租户管理员,租户内全权限(不含系统管理)
 *  - OPERATOR   : 操作员,日常运维(可控制设备,不可删除)
 *  - GUEST      : 访客,仅查看,无任何写权限
 *
 * 角色层级: SUPER_ADMIN > ADMIN > OPERATOR > GUEST
 */

// ─── 角色常量(对齐后端 RoleConstants) ───────────────────────────────

export const ROLE_SUPER_ADMIN = 'SUPER_ADMIN';
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_OPERATOR = 'OPERATOR';
export const ROLE_GUEST = 'GUEST';

/** 向后兼容 — 老代码可能引用 ROLE_VIEWER */
export const ROLE_VIEWER = ROLE_GUEST;

// ─── 核心判断 ──────────────────────────────────────────────────────

/** 判断 roles 是否包含 target 中的任一角色 */
export function hasRole(roles: string[] | undefined, target: string | string[]): boolean {
  if (!roles || roles.length === 0) return false;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some((t) => roles.includes(t));
}

// ─── 快捷判断 ──────────────────────────────────────────────────────

/** 超级管理员(拥有全部权限) */
export function isSuperAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, ROLE_SUPER_ADMIN);
}

/** 管理员(SUPER_ADMIN + ADMIN) — 可管理租户内一切,含删除操作 */
export function isAdmin(roles: string[] | undefined): boolean {
    return hasRole(roles, [ROLE_SUPER_ADMIN, ROLE_ADMIN]);
}

/** 操作员(SUPER_ADMIN + ADMIN + OPERATOR) — 可创建/编辑/控制,不可删除 */
export function isOperator(roles: string[] | undefined): boolean {
    return hasRole(roles, [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_OPERATOR]);
}

/** 任意已登录用户(所有角色) */
export function isAnyUser(_roles: string[] | undefined): boolean {
    return !!_roles && _roles.length > 0;
}
