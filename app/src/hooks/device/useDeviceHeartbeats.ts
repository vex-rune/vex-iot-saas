/**
 * 多设备心跳 hook。
 *
 * 职责:
 * - 接收设备 id 列表,从 deviceData service 缓存推导心跳状态
 * - 返回 `Map<deviceId, DeviceHeartbeatInfo>`,便于上层在 UI 中按设备 id 直接读
 *
 * 变更说明:
 * - 不再直接调用 GET /api/devices/{id}/online,改为读取 `@/services/deviceData` 的设备缓存（SSE `device.online` 事件 + HTTP 兜底刷新）。
 * - 保留 5s 轮询重建 heartbeatMap 的行为，保证心跳状态及时刷新。
 */
/**
 * 多设备心跳 hook。
 *
 * 职责:
 * - 接收设备 id 列表,从 deviceData service 缓存推导心跳状态
 * - 返回 `Map<deviceId, DeviceHeartbeatInfo>`,便于上层在 UI 中按设备 id 直接读
 *
 * 变更说明:
 * - 不再直接调用 GET /api/devices/{id}/online,改为读取 `@/services/deviceData` 的设备缓存（SSE `device.online` 事件 + HTTP 兜底刷新）。
 * - 心跳状态直接由 `devices` 驱动，无需额外轮询重建，避免“Maximum update depth exceeded”。
 */
import { useMemo } from 'react';
import {
  type DeviceHeartbeatInfo,
  deriveHeartbeatStatus,
} from '@/components/ui/DeviceCard';
import { useDeviceStatuses } from '@/services/deviceData';

export function useDeviceHeartbeats(
  deviceIds: string[],
): {
  heartbeatMap: Map<string, DeviceHeartbeatInfo>;
  isLoading: boolean;
} {
  const { devices, isLoading } = useDeviceStatuses(deviceIds);

  const heartbeatMap = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, DeviceHeartbeatInfo>();
    for (const id of deviceIds) {
      const d = devices.get(id);
      map.set(id, {
        lastHeartbeatAt: d?.lastHeartbeatAt,
        status: deriveHeartbeatStatus(d?.lastHeartbeatAt, now),
      });
    }
    return map;
  }, [deviceIds, devices]);

  return { heartbeatMap, isLoading };
}