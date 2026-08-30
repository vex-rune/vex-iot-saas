import { get, post, del, type RequestChain } from '@/lib/api-client';
import type { DeviceSchedule, DeviceScheduleDetail, DeviceScheduleRequest } from '@/types/api';

/**
 * 按设备查询定时控制规则列表。
 *
 * 当前 list 接口返回的详情里没有 actions(后端 listByDevice 在本期前端未展示动作)，
 * 列表页只需要 schedule 本体即可，因此解包为 `DeviceSchedule[]`。
 * 保留 `DeviceScheduleDetail` 类型供详情接口 `getSchedule` 使用。
 */
export function listDeviceSchedules(deviceId: string): RequestChain<DeviceSchedule[]> {
  return get<DeviceSchedule[]>(`/devices/${deviceId}/schedules`);
}

/** 单条定时规则详情 */
export function getSchedule(id: string): RequestChain<DeviceScheduleDetail> {
  return get<DeviceScheduleDetail>(`/schedules/${id}`);
}

/** 创建或更新定时规则（含动作整体覆盖） */
export function saveSchedule(body: DeviceScheduleRequest): RequestChain<DeviceScheduleDetail> {
  return post<DeviceScheduleDetail>('/schedules', body);
}

/** 删除定时规则 */
export function deleteSchedule(id: string): RequestChain<void> {
  return del<void>(`/schedules/${id}`);
}

/** 启用/禁用规则 */
export function setScheduleEnabled(id: string, enabled: boolean): RequestChain<void> {
  return post<void>(`/schedules/${id}/enabled`, null, { params: { enabled } });
}
