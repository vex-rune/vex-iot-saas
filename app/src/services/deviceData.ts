/**
 * 设备数据 service — 业务核心(缓存 / SSE 入口 / history 翻页聚合)
 *
 * 分层契约:
 *   - 不依赖 React(无 hooks)
 *   - UI 通过 @/hooks/device/useDeviceData 订阅本文件暴露的 cache / listeners
 *   - service → service 合法(内部需要调其它业务 service 时走 services/)
 *   - service → api 也合法(直接调 api 做聚合,如 history 翻页)
 */
import { chainToPromise, type RequestChain } from '@/hooks/common/useQueryList';
import { getDevice, getDevicePoints } from '@/api/devices';
import { queryData } from '@/api/data';
import type { Device, PointHistory, PredicateItem, RealtimePointValue } from '@/types/api';

// ─── 公开类型 ──────────────────────────────────────────────────────

/**
 * useRealtimePointsList 行结构。
 * 即使没有 SSE 推送,也会用点位定义 + 缓存最新时间生成"留空"行。
 */
export interface RealtimePointRow {
  pointCode: string;
  pointName: string;
  unit?: string;
  value: string;
  /** 时间戳(毫秒);0 表示从未收到过 SSE */
  updatedAt: number;
  /** 是否曾收到过任何值 */
  hasData: boolean;
}

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

// ─── 缓存层(供 hooks 订阅) ──────────────────────────────────────

export const realtimeCache = new Map<string, CacheEntry<RealtimePointValue>>();
export const deviceCache = new Map<string, CacheEntry<Device>>();

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export let realtimeListeners: Array<() => void> = [];
export let deviceListeners: Array<() => void> = [];

/** 实时缓存版本号:每次 SSE 推送 +1,供 useRealtimePointsList 通过 useSyncExternalStore 订阅 */
export let realtimeCacheVersion = 0;

export function emitRealtime() {
  realtimeCacheVersion += 1;
  for (const l of realtimeListeners) l();
}
export function emitDevice() {
  for (const l of deviceListeners) l();
}

// ─── 业务函数:跨 api 聚合(分页取历史) ───────────────────────────

const HISTORY_PAGE_SIZE = 200;

/**
 * 按时间倒序翻页取全量点位历史,改走 POST /api/data/query。
 * 单一调用方:useHistorySeries(@/hooks/useDeviceData)。
 * 放到 service 层是因为要做"翻页 + 拼接"的业务逻辑,不属于 api。
 */
export function getDeviceHistory(
  deviceId: string,
  params: { pointCode: string; limit?: number; fromSeconds?: number; toSeconds?: number },
): RequestChain<PointHistory[]> {
  const buildConditions = (lastTimestamp?: string): PredicateItem[] => {
    const conditions: PredicateItem[] = [
      { condition: { field: 'deviceId', op: 'eq', value: deviceId } },
      { condition: { field: 'pointCode', op: 'eq', value: params.pointCode } },
    ];
    if (params.fromSeconds) {
      conditions.push({ condition: { field: 'timestamp', op: 'gte', value: new Date(params.fromSeconds * 1000).toISOString() } });
    }
    if (params.toSeconds) {
      conditions.push({ condition: { field: 'timestamp', op: 'lte', value: new Date(params.toSeconds * 1000).toISOString() } });
    }
    if (lastTimestamp) {
      conditions.push({ condition: { field: 'timestamp', op: 'lt', value: lastTimestamp } });
    }
    return conditions;
  };

  const cap = params.limit;

  return new RequestChain<PointHistory[]>(
    (async () => {
      const all: PointHistory[] = [];
      let lastTimestamp: string | undefined;
      const MAX_PAGES = 250;
      for (let p = 0; p < MAX_PAGES; p += 1) {
        const batch = await chainToPromise(
          queryData({
            predicate: { and: buildConditions(lastTimestamp) },
            page: { page: 0, size: HISTORY_PAGE_SIZE },
            order: [{ field: 'timestamp', order: 'DESC' }],
          }),
        );
        if (batch.length === 0) break;
        all.push(...batch);
        if (cap && all.length >= cap) { all.length = cap; break; }
        if (batch.length < HISTORY_PAGE_SIZE) break;
        lastTimestamp = batch[batch.length - 1].timestamp;
      }
      return all;
    })(),
  );
}

// ─── SSE 事件入口 ──────────────────────────────────────────────────

const STALE_MS = 30_000;

function scheduleHttpFallback(key: string, fetcher: () => Promise<void>) {
  const old = pendingTimers.get(key);
  if (old) clearTimeout(old);
  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    fetcher();
  }, STALE_MS);
  pendingTimers.set(key, timer);
}

/** SSE `point.realtime` 事件 → 更新缓存 + 30s 过期走 api 兜底 */
export function onRealtimePoint(data: RealtimePointValue) {
  if (!data.deviceId || !data.pointCode) return;
  const key = `${data.deviceId}:${data.pointCode}`;
  realtimeCache.set(key, { data, updatedAt: Date.now() });
  emitRealtime();
  scheduleHttpFallback(key, async () => {
    // 30s 没推:查询点位定义(实时值只能靠 SSE,这里只续时间戳避免重复触发)
    try {
      await chainToPromise(getDevicePoints(data.deviceId!));
      const entry = realtimeCache.get(key);
      if (entry) entry.updatedAt = Date.now();
      emitRealtime();
    } catch { /* ignore */ }
  });
}

/** SSE `device.online` 事件 → 更新设备缓存 + 30s 过期走 api 兜底 */
export function onDeviceStatus(data: Partial<Device> & { id: string }) {
  const key = data.id;
  const existing = deviceCache.get(key);
  const merged = existing ? { ...existing.data, ...data } : (data as Device);
  deviceCache.set(key, { data: merged, updatedAt: Date.now() });
  emitDevice();
  scheduleHttpFallback(key, async () => {
    try {
      const fresh = await chainToPromise(getDevice(key));
      deviceCache.set(key, { data: fresh, updatedAt: Date.now() });
      emitDevice();
    } catch { /* ignore */ }
  });
}

// ─── Re-export hooks,保持 from '@/services/deviceData' 调用方零改动 ────

export {
  useRealtimePoint, useRealtimePointsList,
  useDeviceStatus, useDeviceStatuses,
  useHistorySeries, type SeriesPoint,
} from '@/hooks/device/useDeviceData';


