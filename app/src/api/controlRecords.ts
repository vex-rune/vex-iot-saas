/**
 * 控制执行记录 API (openapi v2 /api/control-records/...)
 *
 * 用法:
 *   queryControlRecords(body)
 *   countControlRecords(body)
 *
 * 入参与通用 QueryBody 保持一致,筛选字段以后端实际支持为准（常见字段包括 deviceId/scheduleId/pointCode/createdAt 等）。
 */
import { post, type RequestChain } from '@/lib/api-client';
import type { QueryBody } from '@/types/api';

/** 控制执行记录（与后端 ControlRecordEntity 对齐） */
export interface ControlRecord {
  id: string;
  deviceId?: string;
  deviceName?: string;
  pointCode?: string;
  pointName?: string;
  inputValue?: string;
  writtenValue?: string;
  username?: string;
  status?: string;
  errorMessage?: string;
  occurredAt?: string;
  writtenAt?: string;
  createdAt?: string;
}

export function queryControlRecords(body: QueryBody): RequestChain<ControlRecord[]> {
  return post<ControlRecord[]>('/control-records/query', body);
}

export function countControlRecords(body: QueryBody): RequestChain<number> {
  return post<number>('/control-records/count', body);
}
