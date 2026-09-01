/**
 * 后端统一响应体
 */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
}

// ─── Predicate 查询体系 ───────────────────────────────────────────────

export type PredicateOp =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'exp' | 'in' | 'isNull' | 'isNotNull';

export interface LeafCondition {
  field: string;
  op: PredicateOp;
  value?: unknown;
}

export interface Predicate {
  and?: PredicateItem[];
  or?: PredicateItem[];
}

export interface PredicateItem {
  condition?: LeafCondition;
  predicate?: Predicate;
}

export interface QueryOrder {
  field: string;
  order: 'ASC' | 'DESC';
}

export interface QueryPage {
  page: number;
  size: number;
}

export interface QueryBody {
  predicate?: Predicate;
  order?: QueryOrder[];
  page?: QueryPage;
}

/** 快捷构建 eq 条件 */
export function eqCondition(field: string, value: unknown): PredicateItem {
  return { condition: { field, op: 'eq', value } };
}
/** 快捷构建 like 条件 */
export function likeCondition(field: string, value: string): PredicateItem {
  return { condition: { field, op: 'like', value: `%${value}%` } };
}
/** 快捷构建 in 条件 */
export function inCondition(field: string, values: unknown[]): PredicateItem {
  return { condition: { field, op: 'in', value: values } };
}

// ─── Auth 模块 ────────────────────────────────────────────────────────

export type LoginType = 'ADMIN' | 'USER';

export interface LoginReq {
  username: string;
  loginType: LoginType;
  challenge: string;
  signature: string;
}

export interface TokenPairResp {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export interface CurrentUserResponse {
  userId: string;
  username: string;
  nickname?: string;
  tenantId?: string;
  roles: string[];
}

// ─── Device 模块 ──────────────────────────────────────────────────────

export type DeviceOnline = 'OFFLINE' | 'ONLINE';

export interface Device {
  id: string;
  deviceName: string;
  gatewayId?: string;
  enabled: boolean;
  online: DeviceOnline;
  /** 三级标签,均为可选(旧数据无值) */
  level1Tag?: string;
  level2Tag?: string;
  level3Tag?: string;
  lastHeartbeatAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceOnlineResponse {
  deviceId: string;
  online: boolean;
  enabled: boolean;
  lastHeartbeatAt?: string;
}

// ─── Point 模块 ───────────────────────────────────────────────────────

export type DataType = 'BOOL' | 'LONG' | 'STRING' | 'DOUBLE';
export type AccessType = 'RO' | 'RW';

export interface PointDefinition {
  id: string;
  deviceId: string;
  pointCode: string;
  pointName: string;
  description?: string;
  unit?: string;
  dataType: DataType;
  access: AccessType;
  sortOrder?: number;
  groupKey?: string;
  groupLabel?: string;
  /// 值→展示文本字典，JSON 字符串，如 `{"0":"关","1":"开"}`；undefined 表示未配置
  valueMappings?: string | null;
}

// ─── Schedule 模块（设备定时控制）──────────────────────────────────

export interface DeviceSchedule {
  id?: string;
  deviceId: string;
  name: string;
  cron: string;
  enabled: boolean;
  description?: string;
  lastFireAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceScheduleAction {
  id?: string;
  scheduleId?: string;
  pointId: string;
  pointCode: string;
  pointName?: string;
  valueText: string;
  sortOrder?: number;
}

export interface DeviceScheduleDetail {
  schedule: DeviceSchedule;
  actions: DeviceScheduleAction[];
}

export interface DeviceScheduleRequest {
  schedule: DeviceSchedule;
  actions: DeviceScheduleAction[];
}

// ─── Realtime Point ───────────────────────────────────────────────────

export interface RealtimePointValue {
  pointCode: string;
  pointName: string;
  rawValue: string;
  displayValue: string;
  unit: string;
  access: AccessType;
}

export interface DeviceRealtimeResponse {
  deviceId: string;
  timestamp: { epochSecond: number; nano: number };
  points: RealtimePointValue[];
}

// ─── History Point ────────────────────────────────────────────────────

export interface PointHistory {
  timestamp: { epochSecond: number; nano: number; seconds?: number; nanos?: number };
  pointCode?: string;
  value?: string;
}

// ─── Alarm 模块 ───────────────────────────────────────────────────────

export type ConditionType = 'GT' | 'GE' | 'LT' | 'LE' | 'EQ' | 'NE' | 'BETWEEN';
export type AlarmLevel = 'INFO' | 'WARNING' | 'CRITICAL' | 'FATAL';
export type AlarmAckStatus = 'UNACK' | 'ACK';

export interface AlarmRule {
  id: string;
  deviceId: string;
  /** 规则名称（前端展示用，后端暂不持久化） */
  ruleName?: string;
  pointCode?: string;
  conditionType: ConditionType;
  /// 条件中文名称（用户可自定义；为空时回退到枚举默认名）
  conditionName?: string;
  threshold?: number;
  thresholdHigh?: number;
  level: AlarmLevel;
  enabled: boolean;
  notifyUserIds?: string[];
  forwardFormula?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlarmEvent {
  id: string;
  deviceId: string;
  pointCode?: string;
  ruleId: string;
  level: AlarmLevel;
  message: string;
  acknowledged: AlarmAckStatus;
  triggeredAt: string;
  recoveredAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt?: string;
}

// ─── Point Alarm 模块（新版点位告警）─────────────────────────────────

export type PointRuleType = 'THRESHOLD_HIGH' | 'THRESHOLD_LOW' | 'STATE';
export type PointCompareOp = 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'NOT_IN';
export type PointStatus = 'NORMAL' | 'WARN_HIGH' | 'WARN_LOW' | 'ALARM_HIGH' | 'ALARM_LOW' | 'STATE_ALARM' | 'NO_DATA';
export type PointAlarmEventStatus = 'ACTIVE' | 'RECOVERED' | 'ACK';

export interface PointAlarmRule {
  id: string;
  pointDefinitionId: string;
  ruleType: PointRuleType;
  thresholdValue: string;
  compareOperator: PointCompareOp;
  alarmLevel: string;
  alarmMessage: string;
  enabled: boolean;
  maskEnable: boolean;
  maskExpireTime?: string;
}

export interface PointAlarmEvent {
  id: string;
  pointDefinitionId: string;
  alarmRuleId: string;
  alarmLevel: string;
  alarmMessage: string;
  triggerValue: string;
  eventStatus: PointAlarmEventStatus;
  occurTime: string;
  recoverTime?: string;
  ackTime?: string;
  ackUserId?: string;
}

// ─── Notify User 模块 ────────────────────────────────────────────────

export interface NotifyUser {
  id: string;
  name: string;
  phone: string;
  smsEnabled: boolean;
  /** 总通知开关,后端暂未持久化,前端表单用 */
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Notify Record 模块(通知发送历史) ────────────────────────────────
// 渠道枚举:模版类型(type)与记录/发送渠道(channel)是同一语义,统一一个源
export type NotifyChannel = 'SMS' | 'WECHAT' | 'EMAIL';
export type NotifyRecordStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface NotifyRecord {
  id: string;
  /** 通知发送时间 */
  time: string;
  /** 触发事件描述,如 "设备 a11 温度过高告警" */
  event: string;
  /** 通知人 ID 列表 */
  notifyUserIds: string[];
  /** 通知渠道 */
  channel: NotifyChannel;
  /** 发送状态 */
  status: NotifyRecordStatus;
  /** 实际发送内容(脱敏/截断后) */
  content?: string;
  /** 失败时的错误信息 */
  error?: string;
}

// ─── Notify Template 模块(通知模版) ────────────────────────────────
// 模版类型复用通知渠道枚举,避免重复定义导致的扩展不一致
export type NotifyTemplateType = NotifyChannel;
export type NotifyTemplatePlatform = 'ALIYUN' | 'TENCENT' | 'HUAWEI' | 'OTHER';

export interface NotifyTemplate {
  id: string;
  /** 模版名称,前端展示用 */
  name: string;
  /** 通知类型 */
  type: NotifyTemplateType;
  /** 对接平台 */
  platform: NotifyTemplatePlatform;
  /** 三方平台上的模版 ID */
  templateId: string;
  /** 内容示例,支持 ${var} 占位符 */
  contentExample: string;
  /** 启用开关 */
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Control ──────────────────────────────────────────────────────────

export interface PointControlReq {
  key: unknown;
}

// ─── Dashboard 模块 ───────────────────────────────────────────────────

export type BizType = 'GLOBAL' | 'DEVICE' | 'DEVICE_DETAIL';
export type CardType = 'KEY_POINT' | 'ALARM_LIST' | 'STAT';

export interface DashboardDefinition {
  id: string;
  name: string;
  bizType: BizType;
  deviceId?: string;
  description?: string;
  sortOrder?: number;
  isDefault?: boolean;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardCard {
  id: string;
  dashboardId: string;
  cardTitle: string;
  cardType: CardType;
  pointRefList?: string[];
  filterAlarmOnly?: boolean;
  maxShowCount?: number;
  sortField?: string;
  sortOrder?: number;
  layoutConfig?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
