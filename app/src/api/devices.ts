import { get, post, put, del, type RequestChain } from '@/lib/api-client';
import type {
  Device, QueryBody, DeviceRealtimeResponse, PointHistory,
  PointDefinition, PointControlReq, DeviceOnlineResponse,
} from '@/types/api';

/** 设备-条件查询 */
export function queryDevices(body: QueryBody): RequestChain<Device[]> {
  return post<Device[]>('/devices/query', body);
}

/** 设备-数量查询 */
export function countDevices(body: QueryBody): RequestChain<number> {
  return post<number>('/devices/count', body);
}

/**
 * 把传入的 body 与 state 条件做 AND 合并,生成新 body。
 * 后端 BaseEntity.state: 0=正常, -1=软删除。
 */
function withStateFilter(stateVal: 0 | -1, body: QueryBody): QueryBody {
  const stateCond = { condition: { field: 'state', op: 'eq' as const, value: stateVal } };
  const existing = body.predicate;
  if (existing && Array.isArray(existing.and)) {
    return { ...body, predicate: { and: [...existing.and, stateCond] } };
  }
  return { ...body, predicate: { and: [stateCond] } };
}

/** 设备-条件查询(未删除: state=0) */
export function queryActiveDevices(body: QueryBody): RequestChain<Device[]> {
  return post<Device[]>('/devices/query', withStateFilter(0, body));
}

/** 设备-数量查询(未删除: state=0) */
export function countActiveDevices(body: QueryBody): RequestChain<number> {
  return post<number>('/devices/count', withStateFilter(0, body));
}

/** 设备-条件查询(已删除: state=-1) */
export function queryDeletedDevices(body: QueryBody): RequestChain<Device[]> {
  return post<Device[]>('/devices/query', withStateFilter(-1, body));
}

/** 设备-数量查询(已删除: state=-1) */
export function countDeletedDevices(body: QueryBody): RequestChain<number> {
  return post<number>('/devices/count', withStateFilter(-1, body));
}

/** 设备-详情 */
export function getDevice(id: string): RequestChain<Device> {
  return get<Device>(`/devices/${id}`);
}

/** 设备-创建 */
export function createDevice(data: Partial<Device>): RequestChain<Device> {
  return post<Device>('/devices', data);
}

/** 设备-更新 */
export function updateDevice(id: string, data: Partial<Device>): RequestChain<Device> {
  return put<Device>(`/devices/${id}`, data);
}

/** 设备-删除 */
export function deleteDevice(id: string): RequestChain<void> {
  return del<void>(`/devices/${id}`);
}

/** 设备-启用/停用 */
export function toggleDeviceEnabled(id: string, enabled: boolean): RequestChain<Device> {
  return put<Device>(`/devices/${id}/enabled`, { enabled });
}

/** 设备-在线状态 */
export function getDeviceOnline(id: string): RequestChain<DeviceOnlineResponse> {
  return get<DeviceOnlineResponse>(`/devices/${id}/online`);
}

/**
 * 设备-检查编号是否可用
 * excludeId：编辑自己时排除自身
 * 返回占用此编号的设备列表（0 = 可用，>0 = 已被占用）
 */
export async function checkDeviceCodeAvailable(
  deviceCode: string,
  excludeId?: string,
): Promise<Device[]> {
  const list = await new Promise<Device[]>((resolve, reject) => {
    post<Device[]>('/devices/query', {
      predicate: { deviceCode: { eq: deviceCode } },
      page: { page: 0, size: 5 },
    })
      .onSuccess((d) => resolve(d))
      .onBizError((e) => reject(e))
      .onHttpError((e) => reject(e))
      .execute();
  });
  return excludeId ? list.filter((d) => d.id !== excludeId) : list;
}

/** 设备-实时数据 */
export function getDeviceRealtime(deviceId: string): RequestChain<DeviceRealtimeResponse> {
  return get<DeviceRealtimeResponse>(`/devices/${deviceId}/realtime`);
}

/** 设备-历史数据 */
export function getDeviceHistory(
  deviceId: string,
  params: { pointCode: string; limit?: number; fromSeconds?: number; toSeconds?: number },
): RequestChain<PointHistory[]> {
  return get<PointHistory[]>(`/devices/${deviceId}/history`, params);
}

/** 设备-点位列表 */
export function getDevicePoints(deviceId: string): RequestChain<PointDefinition[]> {
  return get<PointDefinition[]>(`/devices/${deviceId}/points`);
}

/** 设备-点位控制 */
export function controlPoint(deviceId: string, pointCode: string, key: unknown): RequestChain<void> {
  return post<void>(`/devices/${deviceId}/points/${pointCode}/control`, { key } as PointControlReq);
}

/** 点位-保存（新增或更新） */
export function savePoint(data: Partial<PointDefinition>): RequestChain<PointDefinition> {
  return post<PointDefinition>('/points', data);
}

/** 点位-删除 */
export function deletePoint(id: string): RequestChain<void> {
  return del<void>(`/points/${id}`);
}

/** 设备-批量更新点位排序（仅写 sortOrder 字段） */
export function sortDevicePoints(deviceId: string, pointIds: string[]): RequestChain<void> {
  return put<void>(`/devices/${deviceId}/points/sort`, { pointIds });
}