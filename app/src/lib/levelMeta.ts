
/**
 * 告警级别的展示元数据:显示标签 + HeroUI Chip 颜色。
 *
 * 两套独立枚举(老 AlarmEvent/AlarmRule 与点位告警 PointAlarmEvent):
 *   - AlarmLevel       : INFO / WARNING / CRITICAL / FATAL
 *   - PointAlarmLevel  : INFO / WARN / ERROR
 *
 * 不同模块后台定义不同,合并会出现 union 收窄失效问题,
 * 所以这里维护两套并列的 Record,允许 chip 颜色取值自然回落 default。
 */
import type { AlarmLevel } from '@/types/api';

type ChipColor = 'success' | 'warning' | 'danger' | 'primary' | 'default';

// ─── 老告警(AlarmEvent / AlarmRule) ──────────────────────────────────
export const ALARM_LEVEL_LABELS: Record<string, string> = {
  INFO: '提示',
  WARNING: '警告',
  CRITICAL: '紧急',
  FATAL: '严重',
};

export const ALARM_LEVEL_COLORS: Record<string, ChipColor> = {
  INFO: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
  FATAL: 'danger',
};

// ─── 点位告警(PointAlarmEvent.alarmLevel 是 string,实际枚举为 INFO/WARN/ERROR) ──
//   用 Record<string, ...> 是因为后端模型定义为 string;
//   未命中值回落 default,避免渲染时颜色为 undefined 触发 TS 报错。
export const POINT_LEVEL_LABELS: Record<string, string> = {
  INFO: '提示',
  WARN: '警告',
  ERROR: '严重',
};

export const POINT_LEVEL_COLORS: Record<string, ChipColor> = {
  INFO: 'default',
  WARN: 'warning',
  ERROR: 'danger',
};

/** AlarmLevel 全部枚举值(用于 Select 选项,保证 key 是 AlarmLevel 子集) */
export const ALARM_LEVEL_OPTIONS: AlarmLevel[] = ['INFO', 'WARNING', 'CRITICAL', 'FATAL'];

