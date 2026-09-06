/**
 * 鉴权 API — /api/auth/...
 *
 * 纯 HTTP 声明:每个函数 return get/post(...) 一个 RequestChain。
 * 业务聚合(callback 注入、token 清理、跳转)放 @/services/auth。
 */
import {get, post, type RequestChain} from '@/lib/api-client';
import type {CurrentUserResponse, KeyInfoResponse, LoginReq, LoginType, TokenPairResp,} from '@/types/api';

export type TokenPair = TokenPairResp;

/** 可切换租户信息(GET /api/auth/tenants 响应) */
export interface AvailableTenant {
    id: string;
    code: string;
    name: string;
    current: boolean;
}

/** GET /api/auth/key-info — 登录前握手,取 salt + 时间窗 */
export function fetchKeyInfo(username: string): RequestChain<KeyInfoResponse> {
    return get<KeyInfoResponse>('/auth/key-info', {username});
}

/** POST /api/auth/login — 账号密码登录(USER) */
export function postLogin(req: LoginReq): RequestChain<TokenPair> {
    return post<TokenPair>('/auth/login', req);
}

/** POST /api/auth/login — 管理员 TOTP 登录(ADMIN)。signature 由调用方按 salt 签名后传入 */
export function postLoginAdmin(req: LoginReq): RequestChain<TokenPair> {
    return post<TokenPair>('/auth/login', {
        ...req,
        loginType: 'ADMIN' as LoginType,
        // 后端 ADMIN 模式忽略 challenge;给一个非空占位避免空串触发某些网关 400
        challenge: req.challenge || req.username || 'placeholder',
    });
}

/** GET /api/auth/me — 拉取当前用户信息 */
export function getCurrentUser(): RequestChain<CurrentUserResponse> {
    return get<CurrentUserResponse>('/auth/me');
}

/** POST /api/auth/login(loginType=REFRESH) — 切换租户,返回新 TokenPair */
export function postSwitchTenant(
    refreshToken: string,
    targetTenantId: string,
): RequestChain<TokenPair> {
    return post<TokenPair>('/auth/login', {
        loginType: 'REFRESH' as LoginType,
        refreshToken,
        targetTenantId,
        challenge: 'placeholder',
        signature: 'placeholder',
    });
}

/** GET /api/auth/tenants — 拉取可切换租户列表 */
export function getAvailableTenants(): RequestChain<AvailableTenant[]> {
    return get<AvailableTenant[]>('/auth/tenants');
}

/** POST /api/auth/logout — 服务端登出 */
export function postLogout(): RequestChain<unknown> {
    return post<unknown>('/auth/logout', {});
}