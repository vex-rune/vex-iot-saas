/**
 * 设备点位管理 — /api/devices/points/...
 */
import {del, get, post, put, type RequestChain} from '@/lib/api-client';
import type {PointDefinition, QueryBody} from '@/types/api';

/** 点位-列表(按设备) */
export function getDevicePoints(deviceId: string): RequestChain<PointDefinition[]> {
    return get<PointDefinition[]>(`/devices/${deviceId}/points`);
}

/** 点位-条件查询 */
export function queryPoints(body: QueryBody): RequestChain<PointDefinition[]> {
    return post<PointDefinition[]>('/devices/points/query', body);
}

/** 点位-数量查询 */
export function countPoints(body: QueryBody): RequestChain<number> {
    return post<number>('/devices/points/count', body);
}

/** 点位-保存(新增或更新) */
export function savePoint(data: Partial<PointDefinition>): RequestChain<PointDefinition> {
    return post<PointDefinition>('/devices/points', data);
}

/** 点位-删除 */
export function deletePoint(id: string): RequestChain<void> {
    return del<void>(`/devices/points/${id}`);
}

/** 点位-批量排序(仅写 sortOrder 字段) */
export function sortDevicePoints(deviceId: string, pointIds: string[]): RequestChain<void> {
    return put<void>(`/devices/${deviceId}/points/sort`, {pointIds});
}
