import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { addToast } from '@heroui/react';
import { controlData } from '@/services/controlData';
import { chainToPromise } from '@/hooks/common/useQueryList';
import {
  useRealtimePoint as useRealtimePointFromService,
  useDeviceStatus,
  useHistorySeries,
  type SeriesPoint,
} from '@/services/deviceData';

// ─── 重新导出 service hooks ────────────────────────────────────────

export { useDeviceStatus as useDevicePanelStatus, useHistorySeries, type SeriesPoint };

/** 当前点位实时值（从 service 读取） */
export function useRealtimePoint(deviceId: string, pointCode: string) {
  return useRealtimePointFromService(deviceId, pointCode);
}

/** 解析开关量原始值为布尔（兼容英文/数字/中文上报值） */
export function parseBoolValue(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'on', 'open', 'yes', '开', '打开', '运行', '启动', '合'].includes(v)) return true;
  if (['false', '0', 'off', 'close', 'no', '关', '关闭', '停止', '停机', '分'].includes(v)) return false;
  return undefined;
}

/** realtime 来源：会话内累积序列（会话=组件挂载期，切走面板即重置） */
export function useRealtimeSeries(deviceId: string, pointCode: string, maxPoints = 300) {
  const { point } = useRealtimePoint(deviceId, pointCode);
  const [buffer, setBuffer] = useState<SeriesPoint[]>([]);
  const lastTsRef = useRef(0);

  useEffect(() => {
    setBuffer([]);
    lastTsRef.current = 0;
  }, [deviceId, pointCode]);

  const rawValue = point?.rawValue;
  const value = Number(rawValue);
  useEffect(() => {
    if (rawValue === undefined || rawValue === '' || Number.isNaN(value)) return;
    const now = Date.now();
    if (now - lastTsRef.current < 500) return;
    lastTsRef.current = now;
    setBuffer((prev) => [...prev, { time: now, value }].slice(-maxPoints));
  }, [rawValue, value, maxPoints]);

  return { series: buffer, isLoading: false };
}

/** 控制开关下发 */
export function useControlPoint(deviceId: string) {
  return useMutation({
    mutationFn: ({ pointCode, next }: { pointCode: string; next: boolean }) =>
      chainToPromise(controlData({ deviceId, pointCode, value: String(next) })),
    onSuccess: () => {
      addToast({ title: '控制指令已下发', color: 'success' });
    },
  });
}
