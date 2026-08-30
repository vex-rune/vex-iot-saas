import { get, post, del, type RequestChain } from '@/lib/api-client';
import type { DeviceScheduleDetail, DeviceScheduleRequest } from '@/types/api';

/** 按设备查询定时控制规则列表（含动作） */
export function listDeviceSchedules(deviceId: string): RequestChain<DeviceScheduleDetail[]> {
  return get<DeviceScheduleDetail[]>(`/devices/${deviceId}/schedules`);
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
