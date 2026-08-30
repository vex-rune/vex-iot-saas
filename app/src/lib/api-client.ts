/**
 * 链式业务请求客户端 (底层, 仅暴露给业务层封装使用)
 *
 * 设计:
 *   - 后端统一响应: { code: string; message: string; data: T }
 *   - 走独立 axios 实例 + 单一 token 注入拦截器, 不挂 response interceptor
 *     (避免 401 刷新等副作用吞掉业务异常)
 *   - 三种回调都有默认值, 调用方只需要覆写关心的分支
 *
 * 三态语义 (与后端 envelope 一一对应):
 *   onSuccess(data)    ← HTTP 200 且 envelope.code === "ok", data 是 envelope.data
 *   onBizError(err)    ← HTTP 200 但 envelope.code !== "ok" (如 invalid_credential)
 *   onHttpError(err)   ← HTTP 非 2xx 或 网络断开
 *
 * 使用方式 (由业务层包装, 页面不直接用):
 *   const chain = post<TokenPair>('/auth/login', payload);
 *   chain
 *     .onSuccess(data => { ... })
 *     .onBizError(err  => { ... })
 *     .onHttpError(err => { ... })
 *     .execute();
 */
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { addToast } from '@heroui/react';
import { API_BASE } from '@/lib/env';
import { useAuthStore } from '@/stores/auth';

// ─── 业务响应 envelope ───────────────────────────────────────────────────────

export interface BizEnvelope<T = unknown> {
  code: string;
  message: string;
  data: T;
}

/** 业务异常: HTTP 200 但 envelope.code !== 'ok' */
export class BizError extends Error {
  public envelope: BizEnvelope;
  constructor(envelope: BizEnvelope) {
    super(envelope.message);
    this.name = 'BizError';
    this.envelope = envelope;
  }
}

// ─── 默认异常处理: toast + reject ────────────────────────────────────────────

function defaultBizErrorHandler(err: BizError): void {
  console.warn('[api-client] defaultBizErrorHandler', err.envelope);
  addToast({
    title: '业务异常',
    description: `${err.envelope.message}  [${err.envelope.code}]`,
    color: 'danger',
  });
}

const HTTP_TITLE_MAP: Record<number, string> = {
  400: '请求参数错误',
  401: '身份已失效',
  403: '没有访问权限',
  404: '资源不存在',
  405: '请求方式不被允许',
};

function defaultHttpErrorHandler(err: AxiosError): void {
  const status = err.response?.status ?? 0;
  const title =
    HTTP_TITLE_MAP[status]
    || (status >= 500 ? '服务器开了小差,请稍后再试' : `请求异常 (HTTP ${status})`);
  const description = status === 0 ? '无法连接到服务器,请检查网络' : (err.message || '请稍后重试');
  addToast({ title, description, color: 'danger' });
}

// ─── 链式回调类型 ─────────────────────────────────────────────────────────────

type SuccessCb<T> = (data: T) => void;
type BizErrCb    = (err: BizError) => void;
type HttpErrCb   = (err: AxiosError) => void;
type AlwaysCb    = () => void;

/**
 * 业务层传给底层 RequestChain 的"回调配置".
 * 全部可选: 不传任何回调时, 底层走默认 toast + reject.
 */
export interface RequestCallbacks<T> {
  onSuccess?:  (data: T)         => void;
  onBizError?: (err: BizError)   => void;
  onHttpError?:(err: AxiosError) => void;
}

/**
 * 链式 Builder:
 *   - 每种回调都有"默认值 + reject/resolve", 不注册时走默认
 *   - 调用方只需注册关心的分支, 大幅减少样板代码
 */
export class RequestChain<T> {
  private promise: Promise<T>;
  private successCb?: SuccessCb<T>;
  private bizErrCb?: BizErrCb;
  private httpErrCb?: HttpErrCb;
  private alwaysCb?: AlwaysCb;

  constructor(promise: Promise<T>) {
    this.promise = promise;
  }

  /** 业务成功回调: HTTP 200 且 envelope.code === 'ok'. 默认无副作用. */
  onSuccess(cb: SuccessCb<T>): this {
    this.successCb = cb;
    return this;
  }

  /** 业务异常: HTTP 200 但 envelope.code !== 'ok' (例如 invalid_credential). 默认 toast + reject. */
  onBizError(cb: BizErrCb): this {
    this.bizErrCb = cb;
    return this;
  }

  /** 协议/网络异常: HTTP 4xx/5xx 或断网. 默认 toast + reject. */
  onHttpError(cb: HttpErrCb): this {
    this.httpErrCb = cb;
    return this;
  }

  /** 无论成败均触发 (类似 finally). 默认空. */
  always(cb: AlwaysCb): this {
    this.alwaysCb = cb;
    return this;
  }

  /** 执行链上注册的回调, 未注册的走默认 (toast + reject/resolve). */
  async execute(): Promise<void> {
    try {
      const data = await this.promise;
      this.successCb?.(data);
    } catch (e) {
      if (e instanceof BizError) {
        const cb = this.bizErrCb ?? defaultBizErrorHandler;
        cb(e);
        throw e;
      }
      if (axios.isAxiosError(e)) {
        const cb = this.httpErrCb ?? defaultHttpErrorHandler;
        cb(e);
        throw e;
      }
      // 兜底: 未预期异常, 用 httpError 通道报告
      const fallback = new AxiosError(
        e instanceof Error ? e.message : String(e),
        'UNKNOWN',
      );
      const cb = this.httpErrCb ?? defaultHttpErrorHandler;
      cb(fallback);
      throw fallback;
    } finally {
      this.alwaysCb?.();
    }
  }
}

// ─── axios 实例 + token 注入 ─────────────────────────────────────────────────

const service = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json;charset=utf-8' },
});

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  // eslint-disable-next-line no-console
  console.log('[api-client]', config.method?.toUpperCase(), config.url, token ? 'token=✓' : 'token=✗');
  return config;
});

// ─── envelope 拆包 → RequestChain ────────────────────────────────────────────

/**
 * 兼容两种可能:
 *   - 运行时: axios 真实返回 AxiosResponse<{data, status, ...}>
 *   - TS 期望: 已被 '@/lib/http.ts' 的 declare module 'axios' 覆写为 Promise<T> (T = envelope)
 *
 * 抽取 envelope 时兼容这两种 shape:
 *   ① resp.data 是 envelope  →  resp.data.code / .message / .data
 *   ② resp 本身就是 envelope → resp.code / .message / .data
 *
 * 校验: envelope.code === 'ok' 才 resolve 业务数据;否则抛 BizError.
 */
function envelopeToData<T>(resp: unknown): T {
  if (resp === null || typeof resp !== 'object') {
    throw new BizError({ code: 'malformed_envelope', message: '响应不是有效对象', data: null });
  }

  // 情况 1: resp 是 AxiosResponse, envelope 在 resp.data
  const r = resp as { data?: unknown };
  const candidate = (r.data && typeof r.data === 'object' && 'code' in (r.data as object))
    ? (r.data as BizEnvelope<T>)
    : (resp as BizEnvelope<T>);

  if (!candidate || typeof candidate !== 'object' || !('code' in candidate)) {
    // 完全非 envelope 接口(纯数据), 直接把 envelope.data 当业务数据返回
    return ((candidate as unknown as { data: T }).data) ?? (candidate as unknown as T);
  }

  if (candidate.code !== 'ok') {
    console.warn('[api-client] biz error:', candidate.code, candidate.message);
    throw new BizError(candidate);
  }
  return candidate.data;
}

export function get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): RequestChain<T> {
  const p = service.get(url, { params, ...config }).then((resp) => envelopeToData<T>(resp));
  return new RequestChain<T>(p);
}

export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): RequestChain<T> {
  const p = service.post(url, data, config).then((resp) => envelopeToData<T>(resp));
  return new RequestChain<T>(p);
}

export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): RequestChain<T> {
  const p = service.put(url, data, config).then((resp) => envelopeToData<T>(resp));
  return new RequestChain<T>(p);
}

export function del<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): RequestChain<T> {
  const p = service.delete(url, { params, ...config }).then((resp) => envelopeToData<T>(resp));
  return new RequestChain<T>(p);
}