/**
 * 设备点位历史快照 (openapi v2 /api/data/...)
 *
 * 纯 HTTP 声明:每个函数 return get/post(...) 一个 RequestChain。
 * 控制点下发的值路由业务(value → intValue/doubleValue/stringValue)放 @/services/controlData。
 */
import {get, post, type RequestChain} from '@/lib/api-client';
import type {DataRecord, DataType, QueryBody} from '@/types/api';

/** 查询点位历史快照 body (点类型 + 时间区间 + 点位集合) */
export interface DataQueryBody extends QueryBody {
    deviceId?: string;
    /** 点位编码（推荐使用） */
    pointCode?: string;
    /** 点位编码（历史兼容字段，与 pointCode 同值） */
    pointId?: string;
    dataType?: DataType;
    fromTimestamp?: string;      // ISO
    toTimestamp?: string;
}

/**
 * POST /api/data/query
 * 返回点位历史快照数组 (DataRecord[]).
 */
export function queryData(body: DataQueryBody = {}): RequestChain<DataRecord[]> {
    return post<DataRecord[]>('/data/query', body);
}

/**
 * POST /api/data/count
 * 返回数量.
 */
export function countData(body: DataQueryBody = {}): RequestChain<number> {
    return post<number>('/data/count', body);
}

/**
 * GET /api/data/{id}
 * 获取单条点位快照.
 */
export function getDataRecord(id: string): RequestChain<DataRecord> {
    return get<DataRecord>(`/data/${id}`);
}

/**
 * POST /api/data — 控制点下发(纯 HTTP 透传)
 *
 * 注意:调用方必须已经把 value 投到正确字段(intValue/doubleValue/stringValue)。
 * 值路由业务在 @/services/controlData 里。
 */
export interface PostControlDataReq {
    deviceId: string;
    pointCode: string;
    intValue?: number | null;
    doubleValue?: number | null;
    stringValue?: string | null;
    dataType: DataType;
}

export function postControlData(req: PostControlDataReq): RequestChain<DataRecord> {
    return post<DataRecord>('/data', req);
}
