/**
 * 设备 CRUD 与条件查询 — /api/devices/...
 */
import {del, get, post, put, type RequestChain} from '@/lib/api-client';
import type {Device, QueryBody} from '@/types/api';

// ─── 查询辅助 ───────────────────────────────────────────────────────

/**
 * 将已有 predicate 包装为 PredicateItem 后与 state 条件做 AND 合并。
 * 后端 BaseEntity.state: 0=正常, -1=软删除。
 */
function withStateFilter(stateVal: 0 | -1, body: QueryBody): QueryBody {
    const stateCond = {condition: {field: 'state', op: 'eq' as const, value: stateVal}};
    const existing = body.predicate;
    if (existing) {
        return {...body, predicate: {and: [{predicate: existing}, stateCond]}};
    }
    return {...body, predicate: {and: [stateCond]}};
}

// ─── 条件查询(按 state 分组) ────────────────────────────────────────

/** 设备-条件查询(不过滤 state) */
export function queryDevices(body: QueryBody): RequestChain<Device[]> {
    return post<Device[]>('/devices/query', body);
}

/** 设备-数量查询(不过滤 state) */
export function countDevices(body: QueryBody): RequestChain<number> {
    return post<number>('/devices/count', body);
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

// ─── 单设备 CRUD ────────────────────────────────────────────────────

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
    return put<Device>(`/devices/${id}/enabled`, {enabled});
}

/** 设备-在线状态 */
export function getDeviceOnline(id: string): RequestChain<{ deviceId: string; online: string; deviceName: string }> {
    return get(`/devices/${id}/online`);
}
