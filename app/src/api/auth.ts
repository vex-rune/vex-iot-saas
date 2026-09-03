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
import type {
  CurrentUserResponse,
  TokenPairResp,
  LoginType,
  KeyInfoResponse,
  LoginReq,
} from '@/types/api';

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
 * 登录前握手: 获取 salt + 服务端时间窗信息.
 * 用法(USER 模式):
 *   fetchKeyInfo('alice').onSuccess(info => {
 *     const signed = signPassword(password, info);
 *     login({ username: 'alice', loginType: 'USER', challenge: signed.challenge, signature: signed.signature });
 *   });
 */
export function fetchKeyInfo(
  username: string,
  cbs?: RequestCallbacks<KeyInfoResponse>,
): void {
  const chain = get<KeyInfoResponse>('/auth/key-info', { username });
  dispatch(chain, cbs);
}

/**
 * 账号密码登录 (USER)
 *
 * 注意:challenge / signature 传入前必须已做 salt 签名,不做服务端会拒绝.
 * 详见 fetchKeyInfo.
 */
export function login(
  req: LoginReq,
  cbs?: RequestCallbacks<TokenPair>,
): void {
  const chain = post<TokenPair>('/auth/login', req);
  dispatch(chain, cbs);
}

/**
 * 管理员 TOTP 动态码登录 (ADMIN)
 *
 * openapi v2 契约:
 *   - challenge:ADMIN 模式 = 任意占位(后端忽略)
 *   - signature:ADMIN 模式 = 6 位 TOTP 动态码(经 salt+window SHA-256 签名后)
 *
 * 推荐签名流程(前端组装):
 *   1. fetchKeyInfo → 拿到 salt / windowStart / windowSeconds
 *   2. signature = SHA-256(salt + ':' + windowStart + ':' + windowSeconds + ':' + dynamicCode)
 *   3. challenge = 占位(后端不读)
 */
export function loginAdmin(
  req: LoginReq,
  cbs?: RequestCallbacks<TokenPair>,
): void {
  const chain = post<TokenPair>('/auth/login', {
    ...req,
    loginType: 'ADMIN' as LoginType,
    // 后端 ADMIN 模式忽略 challenge;给一个非空占位避免空串触发某些网关 400
    challenge: req.challenge || req.username || 'placeholder',
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
 * 切换租户(REFRESH loginType):
 *   - 入参:{ refreshToken, targetTenantId, loginType: 'REFRESH' }
 *   - 调 POST /api/auth/login(loginType=REFRESH)
 *   - 后端 UserRefreshTokenAuthenticationProvider 校验后返回新的 TokenPair
 *   - 调用方需自行 setTokens + 刷新页面
 */
export function switchTenant(
  refreshToken: string,
  targetTenantId: string,
  cbs?: RequestCallbacks<TokenPair>,
): void {
  const chain = post<TokenPair>('/auth/login', {
    loginType: 'REFRESH' as LoginType,
    refreshToken,
    targetTenantId,
    challenge: 'placeholder',
    signature: 'placeholder',
  });
  dispatch(chain, cbs);
}

/** 可切换租户信息(GET /api/auth/tenants 响应) */
export interface AvailableTenant {
  id: string;
  code: string;
  name: string;
  current: boolean;
}

/**
 * 拉取当前账号可切换的租户列表(右上角"切换租户"弹框使用)。
 */
export function fetchAvailableTenants(
  cbs?: RequestCallbacks<AvailableTenant[]>,
): void {
  const chain = get<AvailableTenant[]>('/auth/tenants');
  dispatch(chain, cbs);
}

/**
 * 服务端登出 (openapi v2 新增).
 * 后端清 token 状态,前端拿到响应后再清本地.
 */
export function logout(
  cbs?: RequestCallbacks<unknown>,
): void {
  const chain = post<unknown>('/auth/logout', {});
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