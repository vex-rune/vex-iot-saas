import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDevice, getDevicePoints, getDeviceHistory } from '@/api/devices';
import { chainToPromise } from '@/hooks/useQueryList';
import { RANGE_SECONDS } from '@/components/panel/types';
import type { RealtimePointValue, Device } from '@/types/api';

// ─── 类型 ──────────────────────────────────────────────────────────

export interface SeriesPoint {
  time: number;
  value: number;
}

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

// ─── 缓存层 ────────────────────────────────────────────────────────

const realtimeCache = new Map<string, CacheEntry<RealtimePointValue>>();
const deviceCache = new Map<string, CacheEntry<Device>>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

let realtimeListeners: Array<() => void> = [];
let deviceListeners: Array<() => void> = [];

function emitRealtime() {
  for (const l of realtimeListeners) l();
}
function emitDevice() {
  for (const l of deviceListeners) l();
}

const STALE_MS = 30_000;

// ─── SSE 事件入口 ──────────────────────────────────────────────────

function scheduleHttpFallback(key: string, fetcher: () => Promise<void>) {
  const old = pendingTimers.get(key);
  if (old) clearTimeout(old);
  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    fetcher();
  }, STALE_MS);
  pendingTimers.set(key, timer);
}

/** SSE `point.realtime` 事件 → 更新缓存 */
export function onRealtimePoint(data: RealtimePointValue) {
  if (!data.deviceId || !data.pointCode) return;
  const key = `${data.deviceId}:${data.pointCode}`;
  realtimeCache.set(key, { data, updatedAt: Date.now() });
  emitRealtime();
  scheduleHttpFallback(key, async () => {
    // 30s 没推：查询点位定义（实时值只能靠 SSE，这里只续时间戳避免重复触发）
    try {
      await chainToPromise(getDevicePoints(data.deviceId!));
      const entry = realtimeCache.get(key);
      if (entry) entry.updatedAt = Date.now();
      emitRealtime();
    } catch { /* ignore */ }
  });
}

/** SSE `device.online` 事件 → 更新设备缓存 */
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

// ─── Hooks ─────────────────────────────────────────────────────────

/** 订阅实时点位值 */
export function useRealtimePoint(deviceId: string, pointCode: string) {
  const key = `${deviceId}:${pointCode}`;
  const subscribe = useCallback(
    (cb: () => void) => {
      realtimeListeners = [...realtimeListeners, cb];
      return () => { realtimeListeners = realtimeListeners.filter((l) => l !== cb); };
    },
    [],
  );
  const getSnapshot = useCallback(() => realtimeCache.get(key), [key]);
  const entry = useSyncExternalStore(subscribe, getSnapshot);
  return {
    point: entry?.data,
    isLoading: !entry && !!deviceId && !!pointCode,
    isError: false,
  };
}

/** 订阅单个设备状态（service 缓存优先，首次无缓存 HTTP 查一次） */
export function useDeviceStatus(deviceId: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      deviceListeners = [...deviceListeners, cb];
      return () => { deviceListeners = deviceListeners.filter((l) => l !== cb); };
    },
    [],
  );
  const getSnapshot = useCallback(() => deviceCache.get(deviceId), [deviceId]);
  const entry = useSyncExternalStore(subscribe, getSnapshot);

  // 首次无缓存时 HTTP 查一次
  useEffect(() => {
    if (!deviceId || entry) return;
    (async () => {
      try {
        const d = await chainToPromise(getDevice(deviceId));
        deviceCache.set(deviceId, { data: d, updatedAt: Date.now() });
        emitDevice();
      } catch { /* ignore */ }
    })();
  }, [deviceId, entry]);

  return {
    data: entry?.data,
    isLoading: !entry && !!deviceId,
    isError: false,
  };
}

/**
 * 订阅多个设备状态（service 缓存优先，首次无缓存 HTTP 查一次）。
 *
 * - 内部对每个 deviceId 调用 useDeviceStatus（hooks 数组长度必须稳定，上层请保持 ids 引用稳定或数量固定）。
 * - 返回 devices: Map<deviceId, Device | undefined>，isLoading 任意设备首次加载即为 true。
 */
export function useDeviceStatuses(deviceIds: string[]) {
  // 为避免 hooks 数量随 ids 长度变化，这里用固定上限 + 排序后的稳定映射（最多 16 个设备）。
  // 超出部分忽略；若业务需要更多设备，可改用更复杂的动态订阅方案。
  const MAX = 16;
  const sorted = [...deviceIds].sort();
  const padded: string[] = Array.from({ length: MAX }, (_, i) => sorted[i] ?? '');

  const s0  = useDeviceStatus(padded[0]);
  const s1  = useDeviceStatus(padded[1]);
  const s2  = useDeviceStatus(padded[2]);
  const s3  = useDeviceStatus(padded[3]);
  const s4  = useDeviceStatus(padded[4]);
  const s5  = useDeviceStatus(padded[5]);
  const s6  = useDeviceStatus(padded[6]);
  const s7  = useDeviceStatus(padded[7]);
  const s8  = useDeviceStatus(padded[8]);
  const s9  = useDeviceStatus(padded[9]);
  const s10 = useDeviceStatus(padded[10]);
  const s11 = useDeviceStatus(padded[11]);
  const s12 = useDeviceStatus(padded[12]);
  const s13 = useDeviceStatus(padded[13]);
  const s14 = useDeviceStatus(padded[14]);
  const s15 = useDeviceStatus(padded[15]);

  const statuses = useMemo(() => [s0,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,s11,s12,s13,s14,s15], [s0,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,s11,s12,s13,s14,s15]);

  const devices = useMemo(() => {
    const map = new Map<string, Device | undefined>();
    for (let i = 0; i < MAX; i++) {
      const id = padded[i];
      if (!id) continue;
      map.set(id, statuses[i].data);
    }
    return map;
  }, [padded, statuses]);

  const isLoading = useMemo(() => statuses.some((s) => s.isLoading), [statuses]);

  return { devices, isLoading };
}

/** 查询历史数据（直接 HTTP，react-query 缓存） */
export function useHistorySeries(
  deviceId: string,
  pointCode: string,
  limit: number,
  range?: '1h' | '6h' | '24h',
) {
  const query = useQuery({
    queryKey: ['device.history', deviceId, pointCode, String(limit), range ?? 'all'],
    queryFn: () =>
      chainToPromise(
        getDeviceHistory(deviceId, {
          pointCode,
          limit,
          ...(range
            ? { fromSeconds: Math.floor(Date.now() / 1000) - RANGE_SECONDS[range] }
            : {}),
        }),
      ),
    enabled: !!deviceId && !!pointCode,
  });
  const series: SeriesPoint[] = (query.data ?? [])
    .map((d) => ({
      time: toMs(d.timestamp),
      value: Number(d.value ?? d.doubleValue ?? d.stringValue ?? d.intValue),
    }))
    .filter((p) => !Number.isNaN(p.value) && p.time > 0)
    .reverse();
  return { series, isLoading: query.isLoading, isError: query.isError };
}

// ─── 工具 ──────────────────────────────────────────────────────────

function toMs(ts: string | { epochSecond?: number; seconds?: number } | undefined): number {
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (ts && typeof ts === 'object') {
    return (ts.epochSecond ?? ts.seconds ?? 0) * 1000;
  }
  return 0;
}