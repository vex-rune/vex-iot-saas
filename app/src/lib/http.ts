/**
 * 底层 axios instance: 负责 token 注入、401 自动刷新.
 * 业务接口请使用 '@/lib/api-client' 的 requestBiz/postBiz/getBiz/...
 * 它们走独立实例不会与本 instance 的 401 刷新互相干扰.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE } from '@/lib/env';
import { useAuthStore } from '@/stores/auth';
import type { ApiResponse, TokenPairResp } from '@/types/api';

// ─── axios 类型增强: 响应拦截器统一解包 ApiResponse.data
//     http.post/get/... 直接返回业务类型 T ────────────────────────────────
declare module 'axios' {
  interface AxiosInstance {
    get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
    delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
    put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
    patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  }
}

const instance: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── 请求拦截: 附加 token ──
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ── 响应拦截: 解包 ApiResponse.data, 401 自动刷新 ──
instance.interceptors.response.use(
  (resp) => resp.data as never,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${refreshed}`;
        return instance(original);
      }
      if (
        !window.location.pathname.startsWith('/login')
      ) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

// ── Token 刷新（单飞防并发） ──
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setTokens, clear } = useAuthStore.getState();
    if (!refreshToken) {
      clear();
      return null;
    }
    try {
      const body = await axios
        .post(`${API_BASE}/auth/refresh`, { refreshToken })
        .then((r: unknown) => (r as { data: unknown }).data as ApiResponse<TokenPairResp>);
      const data = body.data;
      if (data?.accessToken && data?.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      }
      clear();
      return null;
    } catch {
      clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export { instance as http };
export default instance;