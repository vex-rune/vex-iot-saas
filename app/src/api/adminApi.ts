/**
 * 后台管理 API — 仅 SUPER_ADMIN 可调用
 *
 * 服务端通过 @PreAuthorize("hasRole('SUPER_ADMIN')") 把关;
 * 前端用 isSuperAdmin(roles) 进一步做菜单/按钮显隐.
 */
import {del, get, post, put} from '@/lib/api-client';
import type {Account, AccountDetail, QueryBody, Tenant, TenantDetail,} from '@/types/api';

// ─── 账号 ────────────────────────────────────────────────────────────
export interface AccountCreateReq {
    tenantId: string;
    username: string;
    displayName?: string;
    password: string;
    roles?: string[];
}

/** 账号-条件分页查询 (POST /api/admin/accounts/query) */
export function queryAccounts(body: QueryBody) {
    return post<Account[]>('/admin/accounts/query', body);
}

/** 账号-数量 (POST /api/admin/accounts/count) */
export function countAccounts(body: QueryBody) {
    return post<number>('/admin/accounts/count', body);
}

/** 账号-详情 (GET /api/admin/accounts/{id}) — 返回账号 + 关联租户列表 */
export function getAccount(id: string) {
    return get<AccountDetail>(`/admin/accounts/${id}`);
}

/** 账号-创建 (POST /api/admin/accounts) */
export function createAccount(req: AccountCreateReq) {
    return post<Account>('/admin/accounts', req);
}

/** 账号-启停 (PUT /api/admin/accounts/{id}/enabled) */
export function setAccountEnabled(id: string, enabled: boolean) {
    return put<void>(`/admin/accounts/${id}/enabled`, {enabled});
}

/** 账号-删除 (DELETE /api/admin/accounts/{id}) */
export function deleteAccount(id: string) {
    return del<void>(`/admin/accounts/${id}`);
}

// ─── 租户 ────────────────────────────────────────────────────────────
export interface TenantUpsertReq {
    code: string;
    name?: string;
    description?: string;
    enabled?: boolean;
}

/** 租户-条件分页查询 (POST /api/admin/tenants/query) */
export function queryTenants(body: QueryBody) {
    return post<Tenant[]>('/admin/tenants/query', body);
}

/** 租户-数量 (POST /api/admin/tenants/count) */
export function countTenants(body: QueryBody) {
    return post<number>('/admin/tenants/count', body);
}

/** 租户-详情 (GET /api/admin/tenants/{id}) */
export function getTenant(id: string) {
    return get<Tenant>(`/admin/tenants/${id}`);
}

/** 租户-按代码查 (GET /api/admin/tenants/by-code/{code}) */
export function getTenantByCode(code: string) {
    return get<Tenant>(`/admin/tenants/by-code/${encodeURIComponent(code)}`);
}

/** 租户-详情带关联账号 (GET /api/admin/tenants/{id}/detail) */
export function getTenantDetail(id: string) {
    return get<TenantDetail>(`/admin/tenants/${id}/detail`);
}

/** 租户-批量绑定账号 (POST /api/admin/tenants/{id}/accounts/link) */
export function linkTenantAccounts(tenantId: string, userIds: string[]) {
    return post<void>(`/admin/tenants/${tenantId}/accounts/link`, {userIds});
}

/** 租户-批量解除绑定账号 (POST /api/admin/tenants/{id}/accounts/unlink) */
export function unlinkTenantAccounts(tenantId: string, userIds: string[]) {
    return post<void>(`/admin/tenants/${tenantId}/accounts/unlink`, {userIds});
}

/** 租户-创建 (POST /api/admin/tenants) */
export function createTenant(req: TenantUpsertReq) {
    return post<Tenant>('/admin/tenants', req);
}

/** 租户-更新 (PUT /api/admin/tenants/{id}) */
export function updateTenant(id: string, req: TenantUpsertReq) {
    return put<Tenant>(`/admin/tenants/${id}`, req);
}

/** 租户-删除 (DELETE /api/admin/tenants/{id}) */
export function deleteTenant(id: string) {
    return del<void>(`/admin/tenants/${id}`);
}