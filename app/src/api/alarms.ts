import { get, post, del, type RequestChain } from '@/lib/api-client';
import type {
  AlarmRule,
  AlarmEvent,
  AlarmSource,
  QueryBody,
} from '@/types/api';

/**
 * 设备级告警规则-条件查询
 * 若想仅看点位级,传 predicate: { and: [{ condition: { field: 'source', op: 'eq', value: 'POINT' }}] }
 */
export function queryAlarmRules(body: QueryBody): RequestChain<AlarmRule[]> {
  return post<AlarmRule[]>('/alarm/rules/query', body);
}

/** 告警规则-数量查询 */
export function countAlarmRules(body: QueryBody): RequestChain<number> {
  return post<number>('/alarm/rules/count', body);
}

/**
 * 告警规则-保存
 * openapi v2 body 多了 source / pointDefinitionId / level / message 等字段.
 * 这里不强类型,Partial<AlarmRule> 已对齐新契约.
 */
export function saveAlarmRule(data: Partial<AlarmRule>): RequestChain<AlarmRule> {
  // 老前端不写 source,默认 DEVICE 走老流程;若已带 source,以入参为准.
  return post<AlarmRule>('/alarm/rules', { source: 'DEVICE', ...(data ?? {}) });
}

/** 告警规则-按 ID 删除 */
export function deleteAlarmRule(id: string): RequestChain<void> {
  return del<void>(`/alarm/rules/${id}`);
}

/** 告警规则-按设备查询 */
export function getAlarmRulesByDevice(deviceId: string): RequestChain<AlarmRule[]> {
  return get<AlarmRule[]>(`/alarm/rules/by-device/${deviceId}`);
}

/** 告警规则-按点位查询 (替代旧的 /api/point-alarm/rules/point/{id}) */
export function getAlarmRulesByPoint(pointDefinitionId: string): RequestChain<AlarmRule[]> {
  return get<AlarmRule[]>(`/alarm/rules/by-point/${pointDefinitionId}`);
}

/** 告警事件-条件查询.点位级 / 设备级通过 source 过滤. */
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

// ─── 组合工具:按 source 过滤的快捷方法 ──────────────────────────────

/** 把 source 条件注入到已有 predicate. */
function withSource(body: QueryBody, source: AlarmSource): QueryBody {
  const srcCond = {
    condition: { field: 'source', op: 'eq' as const, value: source },
  };
  const existing = body.predicate;
  if (existing && Array.isArray(existing.and)) {
    return { ...body, predicate: { and: [...existing.and, srcCond] } };
  }
  return { ...body, predicate: { and: [srcCond] } };
}

/** 设备级告警事件列表. */
export function queryDeviceAlarmEvents(body: QueryBody): RequestChain<AlarmEvent[]> {
  return post<AlarmEvent[]>('/alarm/events/query', withSource(body, 'DEVICE'));
}
export function countDeviceAlarmEvents(body: QueryBody): RequestChain<number> {
  return post<number>('/alarm/events/count', withSource(body, 'DEVICE'));
}

/** 点位级告警事件列表 (替代旧的 /api/point-alarm/events/query). */
export function queryPointAlarmEvents(body: QueryBody): RequestChain<AlarmEvent[]> {
  return post<AlarmEvent[]>('/alarm/events/query', withSource(body, 'POINT'));
}
export function countPointAlarmEvents(body: QueryBody): RequestChain<number> {
  return post<number>('/alarm/events/count', withSource(body, 'POINT'));
}

/** 设备级告警规则保存 (默认 source=DEVICE). */
export function saveDeviceAlarmRule(data: Partial<AlarmRule>): RequestChain<AlarmRule> {
  return post<AlarmRule>('/alarm/rules', { source: 'DEVICE', ...(data ?? {}) });
}

/** 点位级告警规则保存 (source=POINT, 必须带 pointDefinitionId). */
export function savePointAlarmRule(data: Partial<AlarmRule>): RequestChain<AlarmRule> {
  if (!data.pointDefinitionId) {
    throw new Error('[savePointAlarmRule] pointDefinitionId 不能为空');
  }
  return post<AlarmRule>('/alarm/rules', { source: 'POINT', ...data });
}
