/**
 * 权限工具:UI 层按角色显隐按钮,后端二次校验
 *
 * 角色命名对齐后端 `RoleConstants`:
 *  - SUPER_ADMIN: 超级管理员(动态码登录),拥有所有权限
 *  - ADMIN      : 普通管理员
 *  - OPERATOR   : 操作员
 *  - VIEWER     : 观察者
 */
export const ROLE_SUPER_ADMIN = 'SUPER_ADMIN';
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_OPERATOR = 'OPERATOR';
export const ROLE_VIEWER = 'VIEWER';

export function hasRole(roles: string[] | undefined, target: string | string[]): boolean {
  if (!roles || roles.length === 0) return false;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some((t) => roles.includes(t));
}

export function isAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, [ROLE_SUPER_ADMIN, ROLE_ADMIN]);
}

export function isSuperAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, ROLE_SUPER_ADMIN);
}
