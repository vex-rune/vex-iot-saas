/**
 * 报表模块 HTTP 层（纯声明，无业务逻辑）
 */
import {get, post, put, del, type RequestChain} from '@/lib/api-client';
import type {QueryBody, ApiResponse} from '@/types/api';

/** 报表定义 */
export interface ReportDefinition {
    id?: string;
    name?: string;
    description?: string;
    schemaJson?: string;
    enabled?: boolean;
    tenantId?: string;
    createdAt?: string;
    updatedAt?: string;
}

/** 报表列信息 */
export interface ReportColumnInfo {
    alias: string;
    type: string;
}

/** 报表执行结果 */
export interface ReportResultDTO {
    columns?: ReportColumnInfo[];
    rows?: Record<string, unknown>[];
    rowCount?: number;
    truncated?: boolean;
    executedAt?: string;
    elapsedMs?: number;
}

/** 执行请求体 */
export interface ReportExecuteReq {
    definitionId?: string;
    schema?: unknown;
    filters?: unknown;
    limit?: number;
}

/** 查询报表定义列表 */
export function queryReportDefinitions(body: QueryBody = {}): RequestChain<ReportDefinition[]> {
    return post<ReportDefinition[]>('/report/definitions/query', body);
}

/** 报表定义数量 */
export function countReportDefinitions(body: QueryBody = {}): RequestChain<number> {
    return post<number>('/report/definitions/count', body);
}

/** 获取单个报表定义 */
export function getReportDefinition(id: string): RequestChain<ReportDefinition> {
    return get<ReportDefinition>(`/report/definitions/${id}`);
}

/** 保存报表定义 */
export function saveReportDefinition(def: ReportDefinition): RequestChain<ReportDefinition> {
    return post<ReportDefinition>('/report/definitions', def);
}

/** 更新报表定义 */
export function updateReportDefinition(id: string, def: ReportDefinition): RequestChain<ReportDefinition> {
    return put<ReportDefinition>(`/report/definitions/${id}`, def);
}

/** 删除报表定义 */
export function deleteReportDefinition(id: string): RequestChain<void> {
    return del<void>(`/report/definitions/${id}`);
}

/** 执行报表查询 */
export function executeReport(req: ReportExecuteReq): RequestChain<ReportResultDTO> {
    return post<ReportResultDTO>('/report/execute', req);
}

/** 预览报表（100 行） */
export function previewReport(req: ReportExecuteReq): RequestChain<ReportResultDTO> {
    return post<ReportResultDTO>('/report/preview', req);
}
