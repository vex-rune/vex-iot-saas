import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/react';
import { getDevice, getDeviceHistory, getDeviceRealtime, controlPoint } from '@/api/devices';
import { chainToPromise } from '@/hooks/useQueryList';
import { RANGE_SECONDS } from './types';
import type { RealtimePointValue } from '@/types/api';

/** 序列点：统一各来源的数据形状 */
export interface SeriesPoint {
  time: number;
  value: number;
}

/** 当前点位实时值（共享 ['device.realtime'] 缓存，3s 轮询全局只有一份） */
export function useRealtimePoint(deviceId: string, pointCode: string) {
  const query = useQuery({
    queryKey: ['device.realtime', deviceId],
    queryFn: () => chainToPromise(getDeviceRealtime(deviceId)),
    refetchInterval: 3000,
    enabled: !!deviceId && !!pointCode,
  });
  const point: RealtimePointValue | undefined = query.data?.points.find(
    (p) => p.pointCode === pointCode,
  );
  return { point, isLoading: query.isLoading, isError: query.isError };
}

/** 解析开关量原始值为布尔（兼容英文/数字/中文上报值） */
export function parseBoolValue(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'on', 'open', 'yes', '开', '打开', '运行', '启动', '合'].includes(v)) return true;
  if (['false', '0', 'off', 'close', 'no', '关', '关闭', '停止', '停机', '分'].includes(v)) return false;
  return undefined;
}

function toMs(ts: { epochSecond?: number; seconds?: number } | undefined): number {
  return (ts?.epochSecond ?? ts?.seconds ?? 0) * 1000;
}

/**
 * history 来源：查历史表取序列。
 * range 传入时换算 fromSeconds 交给后端做时间窗过滤，取数与展示语义对齐。
 */
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
  const series: SeriesPoint[] = useMemo(
    () =>
      (query.data ?? [])
        .map((d) => ({ time: toMs(d.timestamp), value: Number(d.value) }))
        .filter((p) => !Number.isNaN(p.value) && p.time > 0)
        .reverse(),
    [query.data],
  );
  return { series, isLoading: query.isLoading, isError: query.isError };
}

/**
 * realtime 来源：会话内累积序列（会话=组件挂载期，切走面板即重置）。
 * 每次实时快照刷新时追加 buffer（内存态，不落历史表）。
 */
export function useRealtimeSeries(deviceId: string, pointCode: string, maxPoints = 300) {
  const { point } = useRealtimePoint(deviceId, pointCode);
  const [buffer, setBuffer] = useState<SeriesPoint[]>([]);
  const lastTsRef = useRef(0);

  // 换绑点位/设备时清空 buffer，防止旧点位数据混入新曲线
  useEffect(() => {
    setBuffer([]);
    lastTsRef.current = 0;
  }, [deviceId, pointCode]);

  const rawValue = point?.rawValue;
  const value = Number(rawValue);
  useEffect(() => {
    if (rawValue === undefined || rawValue === '' || Number.isNaN(value)) return;
    const now = Date.now();
    if (now - lastTsRef.current < 500) return; // 防抖：500ms 内的重复推送不重复记点
    lastTsRef.current = now;
    setBuffer((prev) => [...prev, { time: now, value }].slice(-maxPoints));
  }, [rawValue, value, maxPoints]);

  return { series: buffer, isLoading: false };
}

/** 设备状态（共享 ['device'] 缓存，轮询保持上下线指示与点位数据同步） */
export function useDevicePanelStatus(deviceId: string) {
  const query = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => chainToPromise(getDevice(deviceId)),
    refetchInterval: 3000,
    enabled: !!deviceId,
  });
  return { data: query.data, isLoading: query.isLoading, isError: query.isError };
}

/** 控制开关下发（失败由 api-client 默认 toast 兜底） */
export function useControlPoint(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pointCode, next }: { pointCode: string; next: boolean }) =>
      chainToPromise(controlPoint(deviceId, pointCode, String(next))),
    onSuccess: () => {
      addToast({ title: '控制指令已下发', color: 'success' });
      queryClient.invalidateQueries({ queryKey: ['device.realtime', deviceId] });
    },
  });
}
