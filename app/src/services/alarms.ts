/**
 * 告警 service — UI 调用入口(barrel re-export,语义隔离层)
 *
 * 严格分层:
 *   - @/api/alarms 只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口
 */
export {
  queryAlarmRules, countAlarmRules,
  saveAlarmRule, deleteAlarmRule,
  getAlarmRulesByDevice, getAlarmRulesByPoint,
  queryAlarmEvents, countAlarmEvents,
  ackAlarmEvent,
  queryDeviceAlarmEvents, countDeviceAlarmEvents,
  queryPointAlarmEvents, countPointAlarmEvents,
  saveDeviceAlarmRule, savePointAlarmRule,
} from '@/api/alarms';