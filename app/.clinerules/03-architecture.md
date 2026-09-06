# 03 · 分层架构

> 前端代码必须严格分三层: **api → service → hooks/component**。
> 每一层的职责边界写死,跨层调用方向单向,禁止反向依赖。

## 三层职责

| 层 | 路径 | 职责 | 禁止 |
|---|---|---|---|
| **api** | `src/api/*.ts` | 只做 HTTP 调用,每个函数 `return get/post/put/del(...)` 一个 `RequestChain<T>` | 禁止写 `new RequestChain(...)`;禁止业务聚合(翻页、合并);禁止依赖 service / hooks |
| **service** | `src/services/*.ts` | 跨 api 的业务聚合(翻页、合并、缓存、SSE 入口);纯 TypeScript,不依赖 React | 禁止 import React / hooks;禁止直接被 component 用(只能通过 hooks 间接消费) |
| **hooks / component** | `src/hooks/*.ts` `src/components/**` `src/pages/**` | 订阅 service 缓存、UI 渲染、用户交互 | 禁止直接调 api 之外的跨层业务;禁止绕过 service 直接持有业务缓存 |

## 依赖方向(单向)

```
hooks / component  ──►  service  ──►  api  ──►  lib/api-client
                              ▲
                              │
                          (SSE 事件)
```

- **api → lib**: 调用 `@/lib/api-client` 的 `get/post/put/del` 出 `RequestChain`
- **service → api**: service 调多个 api 函数做业务(翻页、合并),缓存 SSE 推送
- **service → types**: 引用 `@/types/api` 中的领域类型
- **hooks → service**: 只订阅 service 暴露的 `cache` / `listeners` / `emitXxx`,以及调 service 业务函数
- **component → hooks**: 页面调 hooks,**不直接** import service 或 api

## API 层契约

```ts
// ✅ 正确:api 层只产 RequestChain
export function queryDevices(body: QueryBody): RequestChain<Device[]> {
  return post<Device[]>('/devices/query', body);
}

// ❌ 错误:业务逻辑(包装 predicate)在 api 层
export function queryActiveDevices(body: QueryBody): RequestChain<Device[]> {
  return post<Device[]>('/devices/query', { ...body, predicate: { and: [...] } });
}
```

⚠️ **唯一例外**:`api/alarms.ts` 的 `withSource` / `api/device.ts` 的 `withStateFilter` 等是"参数预加工"(predicate 注入),**不是业务**,保留在 api 层。判断标准:只是包装单条 HTTP 请求的 body / url,没做值转换/翻页/合并/side-effect。

❌ **以下场景属于"复杂逻辑",必须搬到 service 层**:
- 值的语义转换 (boolean/number/string → 后端字段 intValue/doubleValue/stringValue)
- callback 注入 (RequestCallbacks 绑定 + 默认 toast + execute 触发)
- token / store 写入 (useAuthStore.getState().clear())
- 页面副作用 (window.location.replace)
- 多 api 调用的业务聚合 (翻页 + 拼接)
- 缓存 + SSE 推送 (SSE 事件入口)

```ts
// ❌ 错误:在 api/ 里写值转换业务
export function controlData(req: { value: boolean | number | string }) {
  let intValue: number | null = null;
  if (typeof req.value === 'boolean') intValue = req.value ? 1 : 0;
  // ... 13 行 if/else 业务
  return post('/data', { intValue });
}

// ❌ 错误:在 api/ 里写 callback 注入
export function login(req, cbs?: RequestCallbacks<TokenPair>): void {
  const chain = post('/auth/login', req);
  chain.onSuccess(cbs?.onSuccess);
  void chain.execute();
}

// ❌ 错误:在 api/ 里写 token 清理 + 跳转
export function logoutLocal(): void {
  useAuthStore.getState().clear();
  window.location.replace('/login');
}
```

## Service 层契约

```ts
// ✅ 正确:service 层做跨 api 业务(翻页聚合)
export function getDeviceHistory(...): RequestChain<PointHistory[]> {
  return new RequestChain<PointHistory[]>((async () => {
    // 翻页 + 拼接
  })());
}

// ✅ 正确:暴露缓存给 hooks 订阅
export const realtimeCache = new Map<...>();
export let realtimeListeners: Array<() => void> = [];

// ❌ 错误:service 写 React hook
export function useRealtimePoint() {            // ← 应该放 hooks/
  const [v, setV] = useState();
  ...
}

// ❌ 错误:service 直接 return 单条 api,没业务(直接放 api/)
export function getDevice(id: string) {
  return get<Device>(`/devices/${id}`);  // ← 这就是 api,放 src/api/
}
```

**强制规则**:任何 UI(components/、pages/、hooks/ 里的 .tsx/.ts 涉及页面交互)调后端时,**必须走 service 层**,**禁止** `import from '@/api/...'`。

- 即便是最简单的 `getDevice(id)` 也要走 `from '@/services/deviceService'`(barrel re-export),保持单一入口,便于将来加埋点/缓存/重试。
- 服务层文件即便暂时只是 re-export, **也**必须存在 (`services/<domain>Service.ts`),用作语义隔离层。
- 允许例外:`services/` 内部互相调用、`services/` 调 `lib/api-client`、`api/` 内部互相 import(同模块)。**`api/``** 永远不对 UI 暴露。

## Hooks / Component 层契约

```ts
// ✅ 正确:hook 只订阅 service 缓存 + 调 service 业务函数
export function useRealtimePoint(deviceId, pointCode) {
  const entry = useSyncExternalStore(subscribe, () => realtimeCache.get(key));
  return { point: entry?.data };
}

export function useHistorySeries(...) {
  return useQuery({
    queryFn: () => chainToPromise(getDeviceHistory(...)),
  });
}

// ❌ 错误:hook 直接调 api(绕过 service 业务聚合)
export function useHistorySeries(...) {
  return useQuery({
    queryFn: () => chainToPromise(queryData({ ... })),  // ← 翻页丢了
  });
}
```

## 跨层判断口诀

- 看到 `useState` / `useEffect` / `useQuery` / `useSyncExternalStore` → **hooks 层**
- 看到 `new RequestChain(...)` → **service 层**(api 只用 `get/post/put/del`)
- 看到 `chainToPromise(apiFn(...))` → **hooks 层**(hook 包装 api 给 react-query)
- 看到 `new Map<string, ...>` + 跨多个 api 调用的业务 → **service 层**

## 反模式 checklist

| 现象 | 错误位置 | 正确位置 |
|---|---|---|
| 在 `api/*.ts` 写了 `new RequestChain(...)` | api | service |
| 在 `api/*.ts` 写了 `for` 循环翻页 | api | service |
| 在 `api/*.ts` 写了 `if/else` 值转换业务(如 boolean → intValue) | api | service |
| 在 `api/*.ts` 写了 `RequestCallbacks` 注入 + `execute()` | api | service |
| 在 `api/*.ts` 写了 `useAuthStore.getState()` / `window.location.*` | api | service |
| 在 `services/*.ts` 写了 `useState` | service | hooks |
| UI(components/pages)直接 `import from '@/api/...'` 调带业务的接口 | UI | service |
| 在 `pages/*.tsx` 直接 import `@/api/*` 调非 GET 详情接口 | page | hooks(react-query) |
| `useQuery` 里 `chainToPromise(queryData(...))` 跨多次调用合并 | hook | service 业务函数 |
