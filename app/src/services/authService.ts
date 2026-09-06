/**
 * 鉴权 service — 业务聚合(callback 注入、token 清理、跳转)
 *
 * 分层契约:
 *   - @/api/authApi 是纯 HTTP 声明(返回 RequestChain)
 *   - 本 service 在 chain 上注入回调(成功/失败 toast),execute() 触发请求
 *   - 页面副作用(清 token / 跳登录)收口在这里,而不是散落在 UI
 *
 * 调用方: import { login, loginAdmin, logout, logoutLocal, ... } from '@/services/authService'
 */
import type {RequestCallbacks, RequestChain} from '@/lib/api-client';
import type {AvailableTenant, TokenPair} from '@/api/authApi';
import {
    fetchKeyInfo as apiFetchKeyInfo,
    getAvailableTenants as apiGetAvailableTenants,
    getCurrentUser as apiGetCurrentUser,
    postLogin as apiPostLogin,
    postLoginAdmin as apiPostLoginAdmin,
    postLogout as apiPostLogout,
    postSwitchTenant as apiPostSwitchTenant,
} from '@/api/authApi';
import {useAuthStore} from '@/stores/authStore';
import type {CurrentUserResponse, KeyInfoResponse, LoginReq} from '@/types/api';

/**
 * 把 RequestCallbacks 绑定到 RequestChain, 然后 execute().
 * 业务层不写 toast / 跳转 / setState 等页面逻辑。
 */
function dispatch<T>(chain: RequestChain<T>, cbs?: RequestCallbacks<T>): void {
    if (cbs?.onSuccess) chain.onSuccess(cbs.onSuccess);
    if (cbs?.onBizError) chain.onBizError(cbs.onBizError);
    if (cbs?.onHttpError) chain.onHttpError(cbs.onHttpError);
    // 防止 unhandled rejection, 这里 catch 住;失败时已由 onBizError / onHttpError 处理
    void chain.execute().catch(() => { /* handled by callbacks or default toast */
    });
}

/** 登录前握手 — 拿 salt + 时间窗 */
export function fetchKeyInfo(
    username: string,
    cbs?: RequestCallbacks<KeyInfoResponse>,
): void {
    dispatch(apiFetchKeyInfo(username), cbs);
}

/** 账号密码登录(USER)。challenge/signature 必须已按 salt 签名 */
export function login(req: LoginReq, cbs?: RequestCallbacks<TokenPair>): void {
    dispatch(apiPostLogin(req), cbs);
}

/** 管理员 TOTP 登录(ADMIN) */
export function loginAdmin(req: LoginReq, cbs?: RequestCallbacks<TokenPair>): void {
    dispatch(apiPostLoginAdmin(req), cbs);
}

/** 拉取当前用户信息 */
export function fetchCurrentUser(cbs?: RequestCallbacks<CurrentUserResponse>): void {
    dispatch(apiGetCurrentUser(), cbs);
}

/**
 * 切换租户(REFRESH loginType):
 *   - 调 POST /api/auth/login(loginType=REFRESH) 拿新 TokenPair
 *   - 调用方需自行 setTokens + 刷新页面
 */
export function switchTenant(
    refreshToken: string,
    targetTenantId: string,
    cbs?: RequestCallbacks<TokenPair>,
): void {
    dispatch(apiPostSwitchTenant(refreshToken, targetTenantId), cbs);
}

/** 拉取可切换租户列表(右上角"切换租户"弹框) */
export function fetchAvailableTenants(cbs?: RequestCallbacks<AvailableTenant[]>): void {
    dispatch(apiGetAvailableTenants(), cbs);
}

/** 服务端登出(openapi v2 新增) */
export function logout(cbs?: RequestCallbacks<unknown>): void {
    dispatch(apiPostLogout(), cbs);
}

/**
 * 退出登录(本地清理): 不依赖 /auth/logout 结果。
 * 页面副作用(token 清理 + 跳登录)收口在 service 层,UI 不直接碰。
 */
export function logoutLocal(): void {
    useAuthStore.getState().clear();
    window.location.replace('/login');
}

// Re-export types for consumers (LoginPage, TenantSwitcher)
export type {TokenPair, AvailableTenant} from '@/api/authApi';