/**
 * 多设备心跳轮询 hook。
 *
 * 职责:
 * - 接收设备 id 列表,周期性轮询后端心跳端点
 * - 推导出每个设备的心跳状态(fresh / stale / offline)与最近一次时间
 * - 返回 `Map<deviceId, DeviceHeartbeatInfo>`,便于上层在 UI 中按设备 id 直接读
 *
 * 备注:
 * - 当前 openapi v2 没有"批量心跳"接口,因此采用 GET /devices/{id}/online
 *   单点循环实现。设备数 < 100 时性能可接受;> 100 时建议后端提供专门聚合端点
 * - 轮询周期 5s,平衡"新鲜度"与"请求量"
 * - 单个设备请求失败不影响其他设备,失败项以 offline 兜底
 */
import { useEffect, useState } from 'react';
import { getDeviceOnline } from '@/api/devices';
import {
  type DeviceHeartbeatInfo,
  deriveHeartbeatStatus,
} from '@/components/DeviceCard';

const POLL_INTERVAL_MS = 5000;

export function useDeviceHeartbeats(
  deviceIds: string[],
  intervalMs: number = POLL_INTERVAL_MS,
): {
  heartbeatMap: Map<string, DeviceHeartbeatInfo>;
  isLoading: boolean;
} {
  const [heartbeatMap, setHeartbeatMap] = useState<Map<string, DeviceHeartbeatInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(deviceIds.length > 0);

  useEffect(() => {
    let cancelled = false;

    if (deviceIds.length === 0) {
      setHeartbeatMap(new Map());
      setIsLoading(false);
      return;
    }

    const fetchAll = async () => {
      const now = Date.now();
      const results = await Promise.allSettled(
        deviceIds.map(async (id) => {
          // 走 api-client 的 RequestChain:失败会 reject,被 allSettled 捕获
          return await new Promise<{ id: string; lastHeartbeatAt: string | undefined }>(
            (resolve, reject) => {
              getDeviceOnline(id)
                .onSuccess((data) =>
                  resolve({ id, lastHeartbeatAt: data.lastHeartbeatAt }),
                )
                .onBizError((err) => reject(err))
                .onHttpError((err) => reject(err))
                .execute();
            },
          );
        }),
      );

      if (cancelled) return;

      const next = new Map<string, DeviceHeartbeatInfo>();
      results.forEach((r, idx) => {
        const id = deviceIds[idx];
        if (r.status === 'fulfilled') {
          const lastHeartbeatAt = r.value.lastHeartbeatAt;
          next.set(id, {
            lastHeartbeatAt,
            status: deriveHeartbeatStatus(lastHeartbeatAt, now),
          });
        } else {
          // 单点失败:offline 兜底,不影响其他设备
          next.set(id, { status: 'offline' });
        }
      });

      setHeartbeatMap(next);
      setIsLoading(false);
    };

    fetchAll();
    const timer = window.setInterval(fetchAll, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deviceIds.join(','), intervalMs]);

  return { heartbeatMap, isLoading };
}