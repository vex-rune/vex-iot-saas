/**
 * 前端 API 类型桥接层 — 完全对齐 docs/openapi.json v2
 *
 * 历史背景:此文件原本从 `@/models` re-export Apifox 生成器产物。
 * 但 src/models/ 目录不存在,导致 ~200+ 类型错误。
 * 因此所有 OpenAPI 实体 / 枚举在此文件**手写内联**,保持字段语义与 openapi.json 一一对应。
 *
 * 调用方:
 *   import type { Device, AlarmRule, AlarmEvent, NotifyUser } from '@/types/api';
 *
 * 设计:
 *   - 实体字段全部 `?:` 可选(与 openapi schema 字段都 optional 一致),
 *     关键必填字段在 RequestBody 处通过 interface Required<> 收紧。
 *   - 字符串枚举 union 直接对齐 openapi 的 enum 数组。
 *   - 自有"组合"类型 (Predicate / QueryBody / DeviceScheduleListItem) 留在本文件手写。
 */

/* ────────────────────────────────────────────────────────────────────────
 * 通用:envelope / 基础实体 / 排序分页
 * ──────────────────────────────────────────────────────────────────────── */

/** 后端统一响应 envelope */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
}

/** BaseEntity:所有业务实体继承的字段 */
export interface BaseEntity {
  createdAt?: string;
  createId?: string;
  updatedAt?: string;
  updateId?: string;
  /** 0=正常, -1=软删除 */
  state?: number;
  /** 归属租户,默认 "0" */
  tenantId?: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * Predicate 查询体系(业务层大量引用,与 openapi QueriesCriteria 字段名不同)
 * ──────────────────────────────────────────────────────────────────────── */

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

export function eqCondition(field: string, value: unknown): PredicateItem {
  return { condition: { field, op: 'eq', value } };
}
export function likeCondition(field: string, value: string): PredicateItem {
  return { condition: { field, op: 'like', value: `%${value}%` } };
}
export function inCondition(field: string, values: unknown[]): PredicateItem {
  return { condition: { field, op: 'in', value: values } };
}

/* ────────────────────────────────────────────────────────────────────────
 * Auth
 * ──────────────────────────────────────────────────────────────────────── */

/** 字符串别名 — 与后端 LoginType 枚举同值 */
export type LoginType = 'ADMIN' | 'USER' | 'REFRESH';

/** 登录 / 换发 token 统一请求。
 *
 * 字段填写约定(按 loginType):
 * - ADMIN   : username 必填,challenge=占位,signature=动态码
 * - USER    : username 必填,challenge=密码明文,signature=占位
 * - REFRESH : refreshToken 必填,username/challenge/signature 可空;
 *             targetTenantId 非空时切换租户,空时维持原租户(纯续命)
 */
export interface LoginReq {
  username?: string;
  loginType: LoginType;
  challenge: string;
  signature: string;
  /** REFRESH 类型必填 */
  refreshToken?: string;
  /** REFRESH 类型可选:切换到目标租户 */
  targetTenantId?: string;
}

/** 令牌对(POST /api/auth/login 响应 data) */
export interface TokenPairResp {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn?: number;
  refreshExpiresIn?: number;
}

/** GET /api/auth/key-info 响应 */
export interface KeyInfoResponse {
  salt: string;
  createdAt?: string;
  /** 服务端时间窗起点(秒) */
  windowStart: number;
  /** 时间窗长度(秒) */
  windowSeconds: number;
}

/** GET /api/auth/me 当前用户 */
export interface CurrentUserResponse {
  userId: string;
  username: string;
  nickname?: string;
  tenantId?: string;
  roles: string[];
}

/* ────────────────────────────────────────────────────────────────────────
 * Identity: 账号 + 租户 (SUPER_ADMIN 后台管理)
 * ──────────────────────────────────────────────────────────────────────── */

/** 账号实体 — GET /api/admin/accounts/{id} 与 /api/admin/accounts */
export interface Account extends BaseEntity {
  id: string;
  username: string;
  displayName?: string;
  roles?: string[];
  enabled?: boolean;
  lastLoginAt?: string;
}

/** 租户实体 — GET /api/admin/tenants/{id} */
export interface Tenant extends BaseEntity {
  id: string;
  /** 短代码，唯一 */
  code: string;
  name?: string;
  description?: string;
  enabled?: boolean;
}

/** 租户详情响应 — GET /api/admin/tenants/{id}/detail */
export interface TenantDetail {
  tenant: Tenant;
  accounts: Account[];
}

/** 账号详情响应 — GET /api/admin/accounts/{id} */
export interface AccountDetail {
  account: Account;
  /** 该账号在多租户表中关联到的所有租户 */
  linkedTenants: Tenant[];
}

/* ────────────────────────────────────────────────────────────────────────
 * Device
 * ──────────────────────────────────────────────────────────────────────── */

export type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE';
export type AccessType = 'RO' | 'RW';
export type RegisterType = 'STATIC' | 'DYNAMIC';

/**
 * openapi v2 DataEntity.dataType 枚举从 4 值扩到 5 值:
 * BOOL(0/1 布尔) / INT(整型) / FLOAT / DOUBLE / STRING
 *
 * 注意:点位定义(PointDefinition.dataType)仍为 4 值 BOOL/LONG/STRING/DOUBLE。
 * 这里 5 值的是 data 快照端,前端历史曲线和实时面板都要兼容这两个枚举。
 */
export type DataType = 'BOOL' | 'INT' | 'FLOAT' | 'DOUBLE' | 'STRING';

/** 设备实体 — POST /api/devices 与 GET /api/devices/{id} */
export interface Device extends BaseEntity {
  id: string;
  deviceName: string;
  gatewayId?: string;
  enabled?: boolean;
  online?: DeviceOnlineStatus;
  level1Tag?: string;
  level2Tag?: string;
  level3Tag?: string;
  lastHeartbeatAt?: string;
}

/** GET /api/devices/{id}/online 在线状态 */
export interface DeviceOnlineResponse {
  deviceId: string;
  /** openapi v2 新增:设备名称,便于 UI 直接渲染 */
  deviceName?: string;
  online?: boolean;
  enabled?: boolean;
  lastHeartbeatAt?: string;
}

/** 点位定义 — GET /api/devices/{id}/points 与 /api/devices/points */
export interface PointDefinition extends BaseEntity {
  id: string;
  deviceId: string;
  pointCode: string;
  pointName?: string;
  description?: string;
  unit?: string;
  dataType: DataType;
  access: AccessType;
  sortOrder?: number;
  groupKey?: string;
  groupLabel?: string;
  /** 值→展示文本字典,序列化为 JSON:{"0":"关","1":"开"} */
  valueMappings?: string;
}

/** 兼容旧 devices.ts 使用的控制请求形态(openapi 端点已删除) */
export interface PointControlReq {
  key?: unknown;
}

/* ────────────────────────────────────────────────────────────────────────
 * Data(点位历史快照 / 实时数据)
 * ──────────────────────────────────────────────────────────────────────── */

/** 点位历史快照 — DataEntity */
export interface DataRecord extends BaseEntity {
  id: string;
  deviceId: string;
  deviceName?: string;
  /** 点位编码（业务标识，设备内唯一） */
  pointCode?: string;
  /** 点位编码（历史兼容字段，与 pointCode 同值） */
  pointId: string;
  /** 点位名称 */
  pointName?: string;
  /** 单位 */
  unit?: string;
  dataType: DataType;
  intValue?: number;
  doubleValue?: number;
  stringValue?: string;
  /** 上报时间戳(ISO) */
  timestamp: string;
  /** 服务端入库时间 */
  ingestedAt?: string;
  /** 归一化字符串值(按 dataType 转换) */
  value?: string;
}

/**
 * 兼容别名:旧前端 useWidgetData.ts 期望的历史点形态,
 * 实际就是 DataRecord(timestamp + value)。
 */
export type PointHistory = DataRecord;

/**
 * 兼容别名:旧前端 useWidgetData.ts 的实时面板形态。
 * 新契约下"实时"通过 SSE `point.realtime` 推送单点;这里的容器保留
 * 给 `GET /api/devices/{id}/realtime` 兼容路径(若后端回滚该端点)。
 */
export interface DeviceRealtimeResponse {
  deviceId: string;
  points: RealtimePointValue[];
}

/** 实时点位值(SSE 推送格式,以及 device realtime 容器内的元素) */
export interface RealtimePointValue {
  pointCode: string;
  pointName?: string;
  deviceId?: string;
  dataType?: DataType;
  /** 归一化字符串值 */
  value?: string;
  /** 兼容旧 useWidgetData.ts 使用的 rawValue 别名 */
  rawValue?: string;
  /** 秒级时间戳(旧代码用 epochSecond/seconds 兼容) */
  timestamp?: number;
}

/* ────────────────────────────────────────────────────────────────────────
 * Alarm
 * ──────────────────────────────────────────────────────────────────────── */

export type AlarmSource = 'DEVICE' | 'POINT';
export type AlarmRuleType = 'THRESHOLD' | 'STATE';
export type AlarmConditionType = 'GT' | 'GE' | 'LT' | 'LE' | 'EQ' | 'NE' | 'BETWEEN';
export type AlarmLevel = 'INFO' | 'WARNING' | 'CRITICAL' | 'FATAL';
export type AlarmAckStatus = 'ACK' | 'UNACK';

/** AlarmRuleEntity — POST /api/alarm/rules */
export interface AlarmRule extends BaseEntity {
  id: string;
  source: AlarmSource;
  deviceId?: string;
  pointCode?: string;
  pointDefinitionId?: string;
  ruleType: AlarmRuleType;
  conditionType: AlarmConditionType;
  /** 规则显示名(UI 列表/草稿以 ruleName 为主,后端可缺省回退到 pointCode) */
  ruleName?: string;
  conditionName?: string;
  /** 主阈值;后端按 dataType 转换 */
  threshold?: string;
  /** BETWEEN 用上下界 */
  thresholdHigh?: string;
  level: AlarmLevel;
  message?: string;
  enabled?: boolean;
  maskEnable?: boolean;
  maskExpireTime?: string;
  notifyUserIds?: string[];
}

/** AlarmLogEntity — POST /api/alarm/events/query */
export interface AlarmEvent extends BaseEntity {
  id: string;
  source: AlarmSource;
  deviceId?: string;
  pointCode?: string;
  pointDefinitionId?: string;
  ruleId?: string;
  level: AlarmLevel;
  message?: string;
  triggerValue?: string;
  eventStatus?: string;
  /** openapi v2 主命名 */
  acknowledged?: AlarmAckStatus;
  triggeredAt?: string;
  /** 旧字段别名,保留兼容 */
  occurTime?: string;
  recoveredAt?: string;
  acknowledgedAt?: string;
  ackTime?: string;
  acknowledgedBy?: string;
  ackUserId?: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * Schedule(设备定时控制)
 * ──────────────────────────────────────────────────────────────────────── */

/** DeviceScheduleEntity 中的 actions 元素 */
export interface DeviceScheduleAction {
  /** 目标点位 ID(便于直接定位) */
  pointId?: string;
  /** 目标点位编码(MQTT 通道标识) */
  pointCode?: string;
  /** 写入值(字符串,触发时按点位 dataType 转换) */
  valueText?: string;
  /** 排序(多条动作时按此顺序执行) */
  sortOrder?: number;
}

/** DeviceScheduleEntity — GET/POST /api/schedules/{id}, /api/devices/{id}/schedules */
export interface DeviceSchedule extends BaseEntity {
  id?: string;
  deviceId: string;
  name?: string;
  cron?: string;
  enabled?: boolean;
  description?: string;
  lastFireAt?: string;
  /** 嵌入式动作列表(后端按 dataType 转换 valueText) */
  actions?: DeviceScheduleAction[];
}

/**
 * DeviceScheduleDetail — openapi 原生响应/请求形态:
 *   { schedule: DeviceSchedule }
 * actions 嵌在 schedule 内部,不再单列顶层。
 */
export interface DeviceScheduleDetail {
  schedule: DeviceSchedule;
}

/**
 * 解包后的列表项(便于上层页面直接拿 schedule 字段)。
 * 兼容旧前端 PointScheduleSection.tsx 的 `{ schedule, actions }` 形态 — 这里 actions
 * 直接 alias 到 schedule.actions,保证 page 引用 `item.actions` 不会运行时炸。
 */
export interface DeviceScheduleListItem {
  schedule: DeviceSchedule;
  actions: DeviceScheduleAction[];
}

/* ────────────────────────────────────────────────────────────────────────
 * Dashboard
 * ──────────────────────────────────────────────────────────────────────── */

export type DashboardBizType = 'GLOBAL' | 'DEVICE' | 'DEVICE_DETAIL';
export type DashboardCardType = 'KEY_POINT' | 'ALARM_LIST' | 'STAT';

/** DashboardDefinitionEntity */
export interface DashboardDefinition extends BaseEntity {
  id: string;
  name: string;
  bizType: DashboardBizType;
  /** GLOBAL 时为 null/undefined;DEVICE/DEVICE_DETAIL 必须非空 */
  deviceId?: string;
  description?: string;
  sortOrder?: number;
  isDefault?: boolean;
  enabled?: boolean;
}

/** DashboardCardEntity */
export interface DashboardCard extends BaseEntity {
  id: string;
  dashboardId: string;
  cardTitle: string;
  cardType: DashboardCardType;
  /** 引用点位 ID 集合(PointDefinitionEntity.id) */
  pointRefList?: string[];
  filterAlarmOnly?: boolean;
  maxShowCount?: number;
  sortField?: string;
  sortOrder?: number;
  /** JSON 字符串,布局参数 */
  layoutConfig?: string;
  enabled?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────
 * Notify(通知人 / 模板 / 记录)
 * ──────────────────────────────────────────────────────────────────────── */

export type NotifyChannel = 'SMS' | 'WECHAT' | 'EMAIL';
export type NotifyTemplatePlatform = 'ALIYUN' | 'TENCENT' | 'HUAWEI' | 'OTHER';
export type NotifyRecordStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/** NotifyUserEntity */
export interface NotifyUser extends BaseEntity {
  id: string;
  name?: string;
  phone?: string;
  wechatOpenId?: string;
  department?: string;
  smsEnabled?: boolean;
  wechatEnabled?: boolean;
  enabled?: boolean;
}

/** NotifyTemplateEntity */
export interface NotifyTemplate extends BaseEntity {
  id: string;
  name?: string;
  type: NotifyChannel;
  platform: NotifyTemplatePlatform;
  templateId?: string;
  contentExample?: string;
  enabled?: boolean;
}

/** NotifyRecordEntity */
export interface NotifyRecord extends BaseEntity {
  id: string;
  channel?: NotifyChannel;
  status?: NotifyRecordStatus;
  templateId?: string;
  content?: string;
  userId?: string;
  alarmId?: string;
  sentAt?: string;
  errorMsg?: string;
  /**
   * UI 视图字段(后端聚合后下发,不是 NotifyRecordEntity 本身的列):
   * - event:        触发本条记录的事件描述,等价 content 截取或关联 AlarmEvent.message
   * - time:         等价 sentAt,列表里统一以「time」命名避免与 sentAt 混淆
   * - notifyUserIds:本次发送触达的用户 id 列表(后端按 userId 聚合)
   * 标注为可选,后端未下发时不渲染对应列即可。
   */
  event?: string;
  time?: string;
  notifyUserIds?: string[];
}

/* ────────────────────────────────────────────────────────────────────────
 * 向后兼容别名(老前端页面引用的旧名字;对齐 docs/openapi.json 后保留导出,
 * 避免页面侧产生连锁 TS 错误)
 * ──────────────────────────────────────────────────────────────────────── */

/** @deprecated 用 KeyInfoResponse */
export type AuthKeyInfo = KeyInfoResponse;
/** @deprecated 用 AlarmConditionType */
export type ConditionType = AlarmConditionType;
/** @deprecated 用 NotifyChannel(通知模板类型) */
export type NotifyTemplateType = NotifyChannel;