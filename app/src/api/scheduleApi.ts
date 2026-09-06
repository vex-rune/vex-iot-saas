/**
 * 设备定时控制业务 API (openapi v2 /api/schedules/...)
 *
 * openapi v2 关键契约:
 *   - GET /api/devices/{deviceId}/schedules → `DeviceScheduleDetail[]`,
 *     每项 = `{ schedule: DeviceSchedule(内嵌 actions) }`
 *   - GET /api/schedules/{id} → `DeviceScheduleDetail`(同上,单条)
 *   - POST /api/schedules → 请求体 = `{ schedule: DeviceSchedule(内嵌 actions) }`,
 *     响应也是 `DeviceScheduleDetail`
 *   - DELETE /api/schedules/{id} → void
 *   - POST /api/schedules/{id}/enabled?enabled=... → void (query 参数)
 *
 * 关键变更(相对于老前端):
 *   老前端假定 `{ schedule, actions }` 是平铺两层;
 *   openapi v2 + 后端 Java record 把 actions 嵌在 schedule 内部,
 *   因此本文件"解包"函数已删除 — 现在直接返回 `DeviceScheduleDetail`。
 *
 * 兼容处理:
 *   - `listDeviceSchedules / getSchedule` 返回 `DeviceScheduleDetail[]`,
 *     actions 通过 `item.schedule.actions` 访问
 *   - `DeviceScheduleListItem`(types/api.ts)提供 `{ schedule, actions: schedule.actions }`
 *     形态,便于调用方按老风格直接 `item.actions` 取值
 */
import {del, get, post, type RequestChain} from '@/lib/api-client';
import type {DeviceScheduleDetail,} from '@/types/api';

// ─── 按设备查询定时规则列表 ────────────────────────────────────────
//
// GET /api/devices/{deviceId}/schedules
// 响应:DeviceScheduleDetail[]
//   每项形状:{ schedule: DeviceSchedule(内嵌 actions) }
export function listDeviceSchedules(
    deviceId: string,
): RequestChain<DeviceScheduleDetail[]> {
    return get<DeviceScheduleDetail[]>(`/devices/${deviceId}/schedules`);
}

/** 原始 list — 与 listDeviceSchedules 同语义(为向下兼容保留别名)。 */
export function listRawDeviceSchedules(
    deviceId: string,
): RequestChain<DeviceScheduleDetail[]> {
    return get<DeviceScheduleDetail[]>(`/devices/${deviceId}/schedules`);
}

// ─── 单条定时规则详情 ──────────────────────────────────────────────
//
// GET /api/schedules/{id}
export function getSchedule(
    id: string,
): RequestChain<DeviceScheduleDetail> {
    return get<DeviceScheduleDetail>(`/schedules/${id}`);
}

/** 原始 get — 与 getSchedule 同语义。 */
export function getRawSchedule(
    id: string,
): RequestChain<DeviceScheduleDetail> {
    return get<DeviceScheduleDetail>(`/schedules/${id}`);
}

// ─── 创建或更新定时规则 ────────────────────────────────────────────
//
// POST /api/schedules
// 请求体:{ schedule: DeviceSchedule(内嵌 actions) }
// 响应:DeviceScheduleDetail
export function saveSchedule(
    body: DeviceScheduleDetail,
): RequestChain<DeviceScheduleDetail> {
    return post<DeviceScheduleDetail>('/schedules', body);
}

// ─── 删除定时规则 ──────────────────────────────────────────────────
//
// DELETE /api/schedules/{id}
export function deleteSchedule(id: string): RequestChain<void> {
    return del<void>(`/schedules/${id}`);
}

// ─── 启用 / 禁用规则 ──────────────────────────────────────────────
//
// POST /api/schedules/{id}/enabled?enabled=true|false
// openapi v2 形参为 query (?enabled=...),前端封装依旧通过 post+params 转发,
// lib/api-client.ts 内部 post 配置项 params 会转成 query string.
export function setScheduleEnabled(id: string, enabled: boolean): RequestChain<void> {
    return post<void>(`/schedules/${id}/enabled`, null, {params: {enabled}});
}
