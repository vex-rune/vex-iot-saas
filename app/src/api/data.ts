/**
 * 设备点位历史快照 (openapi v2 /api/data/...)
 *
 * - 取代老 devices.getDeviceHistory (历史数据)
 * - 取代老 devices.controlPoint 控制写入(改用 POST /api/data)
 * - 取代老 devices.getDeviceRealtime 实时点(改用 SSE point.realtime)
 *
 * 设计:
 *   - 入参/出参 全部按 openapi.json §"七、data 模块" 字段对齐
 *   - DataRecord 字段(id/deviceId/pointId/dataType/intValue/doubleValue/stringValue/timestamp/value)
 *     完全对齐 DataEntity;dataType 5 值(BOOL/INT/FLOAT/DOUBLE/STRING)
 *   - PointHistory 是 DataRecord 的 alias,旧的 getDeviceHistory 返回类型可平滑对接
 */
import { get, post, type RequestChain } from '@/lib/api-client';
import type { DataRecord, DataType, QueryBody } from '@/types/api';

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
 * 控制点下发 (替代旧的 controlPoint '/devices/{id}/points/{code}/control').
 *
 * 新契约:
 *   POST /api/data
 *   body: {
 *     deviceId, pointId (即 pointCode),
 *     dataType,
 *     intValue | doubleValue | stringValue    (按点位 dataType 二选一)
 *   }
 */
export interface ControlDataReq {
  deviceId: string;
  pointCode: string;
  value: string | number | boolean;
  /** 可选,服务端按此分类;若不传服务端会自动按点位 dataType 路由 */
  dataType?: DataType;
}

export function controlData(req: ControlDataReq): RequestChain<DataRecord> {
  const { value, dataType } = req;
  // 按点位 dataType 把 value 投到正确的字段上,服务端只读对应字段
  // openapi v2 DataEntity.dataType = BOOL / INT / FLOAT / DOUBLE / STRING
  let intValue: number | null = null;
  let doubleValue: number | null = null;
  let stringValue: string | null = null;
  if (typeof value === 'boolean') {
    intValue = value ? 1 : 0;
  } else if (typeof value === 'number') {
    if (dataType === 'BOOL' || dataType === 'INT') {
      intValue = value;
    } else {
      // FLOAT / DOUBLE / STRING(数值情况)
      doubleValue = value;
    }
  } else {
    stringValue = String(value);
  }
  return post<DataRecord>('/data', {
    deviceId: req.deviceId,
    pointCode: req.pointCode,
    intValue,
    doubleValue,
    stringValue,
    dataType: dataType ?? 'BOOL',
  });
}
