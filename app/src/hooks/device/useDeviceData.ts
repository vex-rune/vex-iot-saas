/**
 * 设备实时数据/历史数据/状态订阅 hook — 消费 @/services/deviceData 缓存
 *
 * 分层:
 *   - api/         只做 HTTP 调用,返回 RequestChain
 *   - services/    业务核心(缓存、SSE 入口、跨 api 聚合),无 React 依赖
 *   - hooks/       订阅 service 缓存的 react-query / useSyncExternalStore hook(本文件)
 *
 * 这些 hook 不直接调 api,而是订阅 service 的缓存层;
 * service 在缓存缺失/过期时通过 api 兜底。
 */
import {useCallback, useEffect, useMemo, useSyncExternalStore} from 'react';
import {useQuery} from '@tanstack/react-query';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {
  deviceCache,
  deviceListeners,
  emitDevice,
  getDeviceHistory,
  realtimeCache,
  realtimeCacheVersion,
  realtimeListeners,
  type RealtimePointRow,
} from '@/services/deviceDataService';
import {getDevice} from '@/services/deviceService';
import {RANGE_SECONDS} from '@/components/panel/types';
import type {Device, PointHistory} from '@/types/api';

// ─── 类型 ──────────────────────────────────────────────────────────

export interface SeriesPoint {
  time: number;
  value: number;
}

// ─── Realtime(订阅 service 的 realtimeCache) ──────────────────────

/** 订阅实时点位值 */
export function useRealtimePoint(deviceId: string, pointCode: string) {
  const key = `${deviceId}:${pointCode}`;
  const subscribe = useCallback(
    (cb: () => void) => {
      realtimeListeners.push(cb);
      return () => { realtimeListeners.splice(realtimeListeners.indexOf(cb), 1); };
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

/**
 * 订阅设备下所有点位的实时值。
 * 即使没有 SSE 推送,也会用点位定义 + 缓存最新时间生成"留空"行。
 */
export function useRealtimePointsList(
  deviceId: string,
  points: Array<{ pointCode: string; pointName?: string; unit?: string }> | undefined,
): RealtimePointRow[] {
  const subscribe = useCallback((cb: () => void) => {
    realtimeListeners.push(cb);
    return () => { realtimeListeners.splice(realtimeListeners.indexOf(cb), 1); };
  }, []);
  const getSnapshot = useCallback(() => realtimeCacheVersion, []);
  useSyncExternalStore(subscribe, getSnapshot);

  return useMemo(() => {
    if (!points) return [];
    return points.map((p) => {
      const entry = realtimeCache.get(`${deviceId}:${p.pointCode}`);
      const data = entry?.data;
      const raw = data?.value ?? data?.rawValue ?? '';
      return {
        pointCode: p.pointCode,
        pointName: p.pointName ?? p.pointCode,
        unit: p.unit,
        value: raw === '' || raw == null ? '' : String(raw),
        updatedAt: entry?.updatedAt ?? 0,
        hasData: !!data,
      };
    });
  }, [deviceId, points, realtimeCacheVersion]);
}

// ─── Device status(订阅 service 的 deviceCache) ──────────────────

/** 订阅单个设备状态(service 缓存优先,首次无缓存 HTTP 查一次) */
export function useDeviceStatus(deviceId: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      deviceListeners.push(cb);
      return () => { deviceListeners.splice(deviceListeners.indexOf(cb), 1); };
    },
    [],
  );
  const getSnapshot = useCallback(() => deviceCache.get(deviceId), [deviceId]);
  const entry = useSyncExternalStore(subscribe, getSnapshot);

  // 首次无缓存时通过 api 兜底,触发 service 写缓存
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
 * 订阅多个设备状态(service 缓存优先,首次无缓存 HTTP 查一次)。
 * 内部对每个 deviceId 调用 useDeviceStatus(hooks 数量必须稳定)。
 * 返回 devices: Map<deviceId, Device | undefined>。
 */
export function useDeviceStatuses(deviceIds: string[]) {
  const MAX = 16;
  const sorted = [...deviceIds].sort();
  const padded: string[] = Array.from({ length: MAX }, (_, i) => sorted[i] ?? '');

  const s0 = useDeviceStatus(padded[0]);
  const s1 = useDeviceStatus(padded[1]);
  const s2 = useDeviceStatus(padded[2]);
  const s3 = useDeviceStatus(padded[3]);
  const s4 = useDeviceStatus(padded[4]);
  const s5 = useDeviceStatus(padded[5]);
  const s6 = useDeviceStatus(padded[6]);
  const s7 = useDeviceStatus(padded[7]);
  const s8 = useDeviceStatus(padded[8]);
  const s9 = useDeviceStatus(padded[9]);
  const s10 = useDeviceStatus(padded[10]);
  const s11 = useDeviceStatus(padded[11]);
  const s12 = useDeviceStatus(padded[12]);
  const s13 = useDeviceStatus(padded[13]);
  const s14 = useDeviceStatus(padded[14]);
  const s15 = useDeviceStatus(padded[15]);

  const statuses = useMemo(
    () => [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15],
    [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15],
  );

  const devices = useMemo(() => {
    const map = new Map<string, Device | undefined>();
    for (let i = 0; i < MAX; i += 1) {
      const id = padded[i];
      if (!id) continue;
      map.set(id, statuses[i].data);
    }
    return map;
  }, [padded, statuses]);

  const isLoading = useMemo(() => statuses.some((s) => s.isLoading), [statuses]);
  return { devices, isLoading };
}

// ─── History(react-query + service 业务函数) ──────────────────────

/** 查询历史数据(直接 HTTP, react-query 缓存) */
export function useHistorySeries(
  deviceId: string,
  pointCode: string,
  limit: number,
  range?: '1h' | '6h' | '24h',
  /** 外部日历区间覆盖(Unix 秒) */
  overrideFromSeconds?: number,
  overrideToSeconds?: number,
) {
  const fromSeconds =
    overrideFromSeconds ??
    (range ? Math.floor(Date.now() / 1000) - RANGE_SECONDS[range] : undefined);

  const query = useQuery<PointHistory[]>({
    queryKey: ['device.history', deviceId, pointCode, String(limit), range ?? 'all', String(fromSeconds ?? ''), String(overrideToSeconds ?? '')],
    queryFn: () =>
      chainToPromise(
        getDeviceHistory(deviceId, {
          pointCode,
          limit,
          ...(fromSeconds != null ? { fromSeconds } : {}),
          ...(overrideToSeconds != null ? { toSeconds: overrideToSeconds } : {}),
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


