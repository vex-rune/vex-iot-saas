import { z } from 'zod';
import type { DataType } from '@/types/api';

// ─── 数据来源标记 ─────────────────────────────────────────────────────
// 图表/插件据此选择专用取数方法：realtime=实时数据域，history=历史表

export const DATA_SOURCES = ['realtime', 'history'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  realtime: '实时数据',
  history: '历史数据',
};

// ─── 展示插件 ─────────────────────────────────────────────────────────

export const PLUGIN_KINDS = [
  'switch-light',
  'control-switch',
  'status-badge',
  'metric-value',
  'line-chart',
  'gauge',
] as const;
export type PluginKind = (typeof PLUGIN_KINDS)[number];

export const PLUGIN_META: Record<PluginKind, { label: string; description: string }> = {
  'switch-light': { label: '开关指示灯', description: '开关量亮/灭指示' },
  'control-switch': { label: '控制开关', description: '下发开/关控制指令（RW 点位）' },
  'status-badge': { label: '状态徽章', description: '显示状态值' },
  'metric-value': { label: '数值卡片', description: '大号数值 + 单位' },
  'line-chart': { label: '趋势曲线', description: '折线趋势图' },
  gauge: { label: '仪表盘', description: '环形仪表' },
};

/** 点位数据类型 ↔ 插件兼容矩阵 */
const POINT_PLUGIN_COMPAT: Record<DataType, PluginKind[]> = {
  BOOL: ['switch-light', 'control-switch', 'status-badge'],
  /** openapi v2:DataType 已无 LONG,整型统一收口到 INT */
  INT: ['status-badge', 'metric-value', 'line-chart', 'gauge'],
  DOUBLE: ['status-badge', 'metric-value', 'line-chart', 'gauge'],
  STRING: ['status-badge', 'metric-value'],
  FLOAT: ['status-badge', 'metric-value', 'line-chart', 'gauge'],
};

export function pluginsForDataType(dataType: DataType): PluginKind[] {
  return POINT_PLUGIN_COMPAT[dataType] ?? [];
}

/** 插件支持的数据来源（配置时按此过滤） */
const PLUGIN_SOURCE_COMPAT: Record<PluginKind, DataSource[]> = {
  'switch-light': ['realtime'],
  'control-switch': ['realtime'],
  'status-badge': ['realtime'],
  'metric-value': ['history', 'realtime'],
  'line-chart': ['history', 'realtime'],
  gauge: ['realtime', 'history'],
};

export function sourcesForPlugin(plugin: PluginKind): DataSource[] {
  return PLUGIN_SOURCE_COMPAT[plugin] ?? [];
}

/** 设备属性绑定可用的插件 */
export const DEVICE_PLUGINS: PluginKind[] = ['switch-light', 'status-badge'];

// ─── Panel 配置结构（序列化为 JSON 字符串存后端单字段） ────────────────

const layoutSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
});

const bindingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point'), pointCode: z.string() }),
  z.object({
    kind: z.literal('device'),
    field: z.enum(['online', 'enabled', 'lastHeartbeatAt']),
  }),
]);

/** 徽章语义色（对应 HeroUI Chip color） */
export const BADGE_COLORS = ['primary', 'success', 'warning', 'danger', 'default'] as const;
export type BadgeColor = (typeof BADGE_COLORS)[number];

export const BADGE_COLOR_LABELS: Record<BadgeColor, string> = {
  primary: '主要蓝',
  success: '正常绿',
  warning: '警告黄',
  danger: '危险红',
  default: '默认灰',
};

/** 状态徽章：值 → 颜色规则（与点位值精确匹配） */
export interface BadgeColorRule {
  value: string;
  color: BadgeColor;
}

/** 插件参数 schema：字段级 catch 降级（单字段脏值不影响整个 widget） */
export const widgetPropsSchema = z.object({
  showUnit: z.boolean().optional(),
  range: z.enum(['1h', '6h', '24h']).optional(),
  limit: z.number().optional().catch(undefined),
  min: z.number().optional().catch(undefined),
  max: z.number().optional().catch(undefined),
  // 状态徽章：自定义颜色规则
  colorRules: z
    .array(
      z.object({
        value: z.string().catch(''),
        color: z.enum(BADGE_COLORS).catch('primary'),
      }),
    )
    .optional()
    .catch(undefined),
  // 状态徽章：无数据时的展示
  noDataText: z.string().optional().catch(undefined),
  noDataColor: z.enum(BADGE_COLORS).optional().catch(undefined),
  // 控制开关：下发成功→设备上报的等待超时（秒），实际约等于设备上报周期
  awaitTimeout: z.number().int().min(1).max(120).optional().catch(undefined),
});

const widgetInstanceSchema = z.object({
  id: z.string(),
  title: z.string().catch(''),
  layout: layoutSchema,
  binding: bindingSchema,
  plugin: z.enum(PLUGIN_KINDS),
  source: z.enum(DATA_SOURCES).catch('realtime'),
  props: widgetPropsSchema.catch({}).default({}),
});

export const panelConfigSchema = z.object({
  version: z.literal(1),
  widgets: z.array(widgetInstanceSchema).catch([]),
});

export type WidgetLayout = z.infer<typeof layoutSchema>;
export type WidgetBinding = z.infer<typeof bindingSchema>;
export type WidgetInstance = z.infer<typeof widgetInstanceSchema>;
export type PanelConfig = z.infer<typeof panelConfigSchema>;

/** 解析后端 JSON 字符串：整体失败时逐个抢救合法 widget，而非清空面板 */
export function parsePanelConfig(raw: unknown): PanelConfig {
  if (!raw || typeof raw !== 'object') return { version: 1, widgets: [] };
  const obj = raw as { widgets?: unknown };
  try {
    return panelConfigSchema.parse(obj);
  } catch {
    // 整体不合法 → 元素级抢救
    const widgets = (obj as { widgets?: unknown[] }).widgets ?? [];
    return {
      version: 1,
      widgets: (widgets as unknown[])
        .map((w) => widgetInstanceSchema.safeParse(w))
        .filter((r) => r.success)
        .map((r) => r.data),
    };
  }
}

/** 曲线时间范围 ↔ 秒数（取数时间窗换算用） */
export const RANGE_SECONDS: Record<'1h' | '6h' | '24h', number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
};

/** 生成 widget id：优先 crypto.randomUUID，规避 Date.now+seq 的同毫秒碰撞 */
function genWidgetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `w_${crypto.randomUUID()}`;
  }
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 创建一个默认实例（追加到画布底部） */
export function createWidgetInstance(plugin: PluginKind, existingCount: number): WidgetInstance {
  const defaultSize: Record<PluginKind, { w: number; h: number }> = {
    'switch-light': { w: 3, h: 3 },
    'control-switch': { w: 3, h: 3 },
    'status-badge': { w: 3, h: 3 },
    'metric-value': { w: 3, h: 3 },
    'line-chart': { w: 6, h: 6 },
    gauge: { w: 3, h: 4 },
  };
  const defaultSource = sourcesForPlugin(plugin)[0];
  const { w, h } = defaultSize[plugin];
  return {
    id: genWidgetId(),
    title: '',
    layout: { x: (existingCount * 3) % 12, y: 999, w, h },
    binding: { kind: 'point', pointCode: '' },
    plugin,
    source: defaultSource,
    props: {},
  };
}
