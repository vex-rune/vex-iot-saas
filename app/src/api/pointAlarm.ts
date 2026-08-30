import { get, post, del, type RequestChain } from '@/lib/api-client';
import type { PointAlarmRule, PointAlarmEvent, QueryBody } from '@/types/api';

// ==================== 告警规则 ====================

/** 按点位查询告警规则 */
export function listPointAlarmRules(pointDefinitionId: string): RequestChain<PointAlarmRule[]> {
  return get<PointAlarmRule[]>(`/point-alarm/rules/point/${pointDefinitionId}`);
}

/** 获取单条告警规则 */
export function getPointAlarmRule(id: string): RequestChain<PointAlarmRule> {
  return get<PointAlarmRule>(`/point-alarm/rules/${id}`);
}

/** 保存告警规则（新增/编辑） */
export function savePointAlarmRule(data: Partial<PointAlarmRule>): RequestChain<PointAlarmRule> {
  return post<PointAlarmRule>('/point-alarm/rules', data);
}

/** 删除告警规则 */
export function deletePointAlarmRule(id: string): RequestChain<void> {
  return del<void>(`/point-alarm/rules/${id}`);
}

// ==================== 告警事件 ====================

/** 告警事件-条件分页查询(对齐设备管理 query 规范) */
export function queryPointAlarmEvents(body: QueryBody): RequestChain<PointAlarmEvent[]> {
  return post<PointAlarmEvent[]>('/point-alarm/events/query', body);
}

/** 告警事件-条件计数 */
export function countPointAlarmEvents(body: QueryBody): RequestChain<number> {
  return post<number>('/point-alarm/events/count', body);
}

/** 查询活跃告警事件（分页，兼容旧端点） */
export function listActivePointAlarmEvents(
  page: number,
  size: number,
): RequestChain<{ events: PointAlarmEvent[]; total: number }> {
  return get<{ events: PointAlarmEvent[]; total: number }>(
    `/point-alarm/events/active?page=${page}&size=${size}`,
  );
}

/** 按点位查询告警事件 */
export function listPointAlarmEventsByPoint(
  pointDefinitionId: string,
): RequestChain<PointAlarmEvent[]> {
  return get<PointAlarmEvent[]>(`/point-alarm/events/point/${pointDefinitionId}`);
}

/** 确认告警事件 */
export function acknowledgePointAlarmEvent(id: string): RequestChain<PointAlarmEvent> {
  return post<PointAlarmEvent>(`/point-alarm/events/${id}/acknowledge`);
}
