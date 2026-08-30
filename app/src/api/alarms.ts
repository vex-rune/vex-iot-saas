import { get, post, del, type RequestChain } from '@/lib/api-client';
import type { AlarmRule, AlarmEvent, QueryBody } from '@/types/api';

/** 告警规则-条件查询 */
export function queryAlarmRules(body: QueryBody): RequestChain<AlarmRule[]> {
  return post<AlarmRule[]>('/alarm/rules/query', body);
}

/** 告警规则-数量查询 */
export function countAlarmRules(body: QueryBody): RequestChain<number> {
  return post<number>('/alarm/rules/count', body);
}

/** 告警规则-保存 */
export function saveAlarmRule(data: Partial<AlarmRule>): RequestChain<AlarmRule> {
  return post<AlarmRule>('/alarm/rules', data);
}

/** 告警规则-删除 */
export function deleteAlarmRule(id: string): RequestChain<void> {
  return del<void>(`/alarm/rules/${id}`);
}

/** 告警规则-按设备查询 */
export function getAlarmRulesByDevice(deviceId: string): RequestChain<AlarmRule[]> {
  return get<AlarmRule[]>(`/alarm/rules/by-device/${deviceId}`);
}

/** 告警事件-条件查询 */
export function queryAlarmEvents(body: QueryBody): RequestChain<AlarmEvent[]> {
  return post<AlarmEvent[]>('/alarm/events/query', body);
}

/** 告警事件-数量查询 */
export function countAlarmEvents(body: QueryBody): RequestChain<number> {
  return post<number>('/alarm/events/count', body);
}

/** 告警事件-确认 */
export function ackAlarmEvent(id: string): RequestChain<AlarmEvent> {
  return post<AlarmEvent>(`/alarm/events/${id}/ack`);
}