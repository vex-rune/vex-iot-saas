/**
 * 鉴权业务 API (位于 api/ 目录下, 与 devices / alarms / notifyUsers 业务 API 同级)
 *
 * 暴露给页面的回调式 API:
 *
 *   auth.login(req, {
 *     onSuccess:  data => { ... },
 *     onBizError: err  => { ... },   // 不传则走 api-client 默认 toast
 *     onHttpError:err  => { ... },   // 不传则走 api-client 默认 toast
 *   });
 *
 * server 层 (这里) 仅做 "URL + 入参 + 回调注入", 不写具体业务逻辑.
 */
import { post, get, type BizEnvelope, type RequestChain, type RequestCallbacks } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';
import type { CurrentUserResponse, TokenPairResp, LoginType } from '@/types/api';

/** 登录请求入参 */
export interface LoginReq {
  username: string;
  loginType: 'USER' | 'ADMIN';
  /** USER 模式 = 密码明文; ADMIN 模式 = 任意占位 */
  challenge: string;
  /** USER 模式 = 任意占位; ADMIN 模式 = 6 位 TOTP 动态码 */
  signature: string;
}

export type TokenPair = BizEnvelope<TokenPairResp>['data'];

/**
 * 把 RequestCallbacks 绑定到 RequestChain, 然后 execute().
 * 业务层不写 toast / 跳转 / setState 等页面逻辑.
 */
function dispatch<T>(chain: RequestChain<T>, cbs?: RequestCallbacks<T>): void {
  if (cbs?.onSuccess)  chain.onSuccess(cbs.onSuccess);
  if (cbs?.onBizError) chain.onBizError(cbs.onBizError);
  if (cbs?.onHttpError)chain.onHttpError(cbs.onHttpError);
  // execute 异步执行; 失败时 onBizError / onHttpError 已处理 (默认 toast),
  // 防止 unhandled rejection, 这里 catch 住.
  void chain.execute().catch(() => { /* handled by callbacks or default toast */ });
}

/**
 * 账号密码登录 (USER)
 */
export function login(
  req: LoginReq,
  cbs?: RequestCallbacks<TokenPair>,
): void {
  const chain = post<TokenPair>('/auth/login', {
    username: req.username,
    loginType: 'USER' as LoginType,
    challenge: req.challenge,
    signature: req.challenge,
  });
  dispatch(chain, cbs);
}

/**
 * 管理员 TOTP 动态码登录 (ADMIN)
 */
export function loginAdmin(
  req: LoginReq,
  cbs?: RequestCallbacks<TokenPair>,
): void {
  const chain = post<TokenPair>('/auth/login', {
    username: req.username,
    loginType: 'ADMIN' as LoginType,
    challenge: req.signature,
    signature: req.signature,
  });
  dispatch(chain, cbs);
}

/**
 * 拉取当前用户信息.
 * 注意: 失败由 onBizError / onHttpError 决定是否 toast, 调用方按场景覆写.
 */
export function fetchCurrentUser(
  cbs?: RequestCallbacks<CurrentUserResponse>,
): void {
  const chain = get<CurrentUserResponse>('/auth/me');
  dispatch(chain, cbs);
}

/**
 * 退出登录: 直接清 token, 不依赖 /auth/logout 结果.
 * 如果后端真的有此接口, 由业务侧单独用 post('/auth/logout') 调用.
 */
export function logoutLocal(): void {
  useAuthStore.getState().clear();
  window.location.replace('/login');
}