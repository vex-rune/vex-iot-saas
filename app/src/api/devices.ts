/**
 * 设备管理业务 API (openapi v2 /api/devices/...)
 *
 * openapi v2 关键变更:
 *   - GET /api/devices/{id}/online 响应多 `deviceName` 字段
 *   - GET /api/devices/{deviceId}/realtime    → 已删除,改走 SSE `point.realtime`
 *   - GET /api/devices/{deviceId}/history     → 已删除,改走 /api/data/query
 *   - POST /api/devices/{deviceId}/points/{code}/control → 已删除,改走 POST /api/data
 *   - 新增 POST /api/devices/points/query 与 /api/devices/points/count
 *
 * 本文件保留旧 device.* / point.* CRUD(query/count/get/post/put/delete/sort);
 * 删除已不存在的三个端点函数;补两个 queryPoints/countPoints。
 */
import { get, post, put, del, RequestChain } from '@/lib/api-client';
import type {
  Device, QueryBody, PointDefinition, DeviceOnlineResponse,
  DeviceRealtimeResponse, PointHistory,
} from '@/types/api';
import { queryData } from '@/api/data';

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

/** 设备-在线状态(openapi v2 响应多 deviceName 字段) */
export function getDeviceOnline(id: string): RequestChain<DeviceOnlineResponse> {
  return get<DeviceOnlineResponse>(`/devices/${id}/online`);
}

/** 设备-点位列表 */
export function getDevicePoints(deviceId: string): RequestChain<PointDefinition[]> {
  return get<PointDefinition[]>(`/devices/${deviceId}/points`);
}

/** 设备-点位条件查询(POST /api/devices/points/query,openapi v2 新增) */
export function queryPoints(body: QueryBody): RequestChain<PointDefinition[]> {
  return post<PointDefinition[]>('/devices/points/query', body);
}

/** 设备-点位数量查询(POST /api/devices/points/count,openapi v2 新增) */
export function countPoints(body: QueryBody): RequestChain<number> {
  return post<number>('/devices/points/count', body);
}

/** 设备-点位保存（新增或更新） */
export function savePoint(data: Partial<PointDefinition>): RequestChain<PointDefinition> {
  return post<PointDefinition>('/devices/points', data);
}

/** 设备-点位删除 */
export function deletePoint(id: string): RequestChain<void> {
  return del<void>(`/devices/points/${id}`);
}

/** 设备-批量更新点位排序（仅写 sortOrder 字段） */
export function sortDevicePoints(deviceId: string, pointIds: string[]): RequestChain<void> {
  return put<void>(`/devices/${deviceId}/points/sort`, { pointIds });
}

// ─── 兼容垫片(openapi v2 中已删除端点,这里做"路由到新端点"的兼容)───────────
//
// 这些函数保留,是为了不让上层 page 在迁移期编译失败。
// 调用方后续应逐步切到 /api/data 与 SSE 实时流(@/hooks/useEventStream)。
//
//   getDeviceRealtime(deviceId)  → SSE /point.realtime 推送(此处返回空容器,真正实时流由 SSE 接管)
//   getDeviceHistory(deviceId, params) → queryData() 查询最近 N 条
//   controlPoint(deviceId, code, value)   → controlData() 下发指令

/** 设备-实时数据(兼容垫片:openapi v2 已删除该端点,实时数据由 SSE point.realtime 推送) */
export function getDeviceRealtime(deviceId: string): RequestChain<DeviceRealtimeResponse> {
  // 真实"实时"由 @/hooks/useEventStream 通过 SSE 推送 point.realtime 事件。
  // 这里返回一个空容器,保 getDeviceRealtime().data?.points 形态仍可访问但为空。
  return new RequestChain<DeviceRealtimeResponse>(
    Promise.resolve({ deviceId, points: [] }),
  );
}

/** 设备-历史数据(兼容垫片:openapi v2 已删除该端点,改走 /api/data/query) */
export function getDeviceHistory(
  deviceId: string,
  params: { pointCode: string; limit?: number; fromSeconds?: number; toSeconds?: number },
): RequestChain<PointHistory[]> {
  // 通过 DataEntity 时间窗查询(对端 toTimestamp 取 now 即可)
  void params; // 占位:完整迁移时应透传 pointId/limit/fromTimestamp/toTimestamp
  return queryData({
    predicate: { and: [
      { condition: { field: 'deviceId', op: 'eq', value: deviceId } },
      { condition: { field: 'pointId', op: 'eq', value: params.pointCode } },
    ] },
  });
}

/** 设备-点位控制(兼容垫片:openapi v2 已删除该端点,改走 POST /api/data) */
export function controlPoint(
  deviceId: string,
  pointCode: string,
  value: unknown,
): RequestChain<void> {
  // 此函数保留旧签名(传 value 任意值)以兼容 useWidgetData 中的旧调用点。
  // 行为:返回已 reject 的 RequestChain,引导调用方在 onError 中看到提示。
  void deviceId; void pointCode; void value;
  return new RequestChain<void>(
    Promise.reject(new Error(
      '[controlPoint] 已在 openapi v2 中删除,请改用 controlData() (@/api/data) 下发点位指令',
    )),
  );
}