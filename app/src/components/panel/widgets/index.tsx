import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { Chip, Switch } from '@heroui/react';
import type { BadgeColor, BadgeColorRule } from '../types';
import type { SeriesPoint } from '../useWidgetData';

// 纯展示视图：数据由 PanelRenderer 注入，组件自身不发起请求

/** 开关指示灯 */
export function SwitchLightView({ label, value }: { label: string; value: boolean | undefined }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
      <span
        className={`h-9 w-9 rounded-full transition-all ${
          value ? 'bg-success shadow-[0_0_16px_#17c96488]' : 'bg-default-300'
        }`}
      />
      <span className="max-w-full truncate text-sm text-foreground">{label}</span>
      <span className="text-xs text-foreground-500">
        {value === undefined ? '未知' : value ? '开' : '关'}
      </span>
    </div>
  );
}

/** 控制开关（RW 点位下发） */
export function ControlSwitchView({
  label,
  value,
  disabled,
  pending,
  awaiting = null,
  hint,
  onToggle,
}: {
  label: string;
  value: boolean | undefined;
  disabled: boolean;
  pending: boolean;
  /** 已下发、等待设备上报的期望值（非 null 时锁定开关） */
  awaiting?: boolean | null;
  hint?: string;
  onToggle: (next: boolean) => void;
}) {
  const statusText = pending
    ? '下发中…'
    : awaiting !== null
      ? '已下发，等待上报…'
      : value === undefined
        ? '状态未知'
        : value
          ? '已开启'
          : '已关闭';
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-3">
      <Switch
        size="lg"
        isSelected={awaiting !== null ? awaiting : value === true}
        isDisabled={disabled || pending || awaiting !== null || value === undefined}
        onValueChange={onToggle}
        aria-label={label}
      />
      <span className="max-w-full truncate text-sm text-foreground">{label}</span>
      <span className="text-xs text-foreground-500">{statusText}</span>
      {hint && disabled && !pending && awaiting === null && (
        <span className="text-tiny text-warning">{hint}</span>
      )}
    </div>
  );
}

/** 解析徽章颜色：显式 color 优先（设备属性内置语义）→ 规则命中 → 未命中/默认蓝 → 无数据灰 */
function resolveBadgeColor(
  value: string | undefined,
  rules?: BadgeColorRule[],
  noDataColor?: BadgeColor,
): BadgeColor {
  if (value === undefined || value === '') return noDataColor ?? 'default';
  const hit = rules?.find((r) => r.value.trim() !== '' && r.value.trim() === value.trim());
  return hit?.color ?? 'primary';
}

/**
 * 状态徽章（语义色规则）：
 * - 设备属性绑定：传 color 走内置语义（在线=绿/离线=红等）
 * - 点位绑定：传 colorRules，按"值=配置值"精确匹配变色
 * - 无数据：显示 noDataText（默认 -）+ noDataColor（默认灰）
 */
export function StatusBadgeView({
  label,
  value,
  color,
  colorRules,
  noDataText,
  noDataColor,
}: {
  label: string;
  value: string | undefined;
  /** 直接指定颜色（设备属性语义色），优先于规则匹配 */
  color?: BadgeColor;
  colorRules?: BadgeColorRule[];
  noDataText?: string;
  noDataColor?: BadgeColor;
}) {
  const resolved = color ?? resolveBadgeColor(value, colorRules, noDataColor);
  const noData = value === undefined || value === '';
  const display = noData ? (noDataText ?? '-') : value;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
      <span className="max-w-full truncate text-center text-xs text-foreground-500">{label}</span>
      <Chip size="sm" variant="flat" color={resolved} classNames={{ content: 'font-mono' }}>
        {display}
      </Chip>
    </div>
  );
}

/** 数值大字卡 */
export function MetricValueView({
  label,
  value,
  unit,
  showUnit = true,
}: {
  label: string;
  value: string | undefined;
  unit?: string;
  showUnit?: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 p-4">
      <span className="max-w-full truncate text-xs text-foreground-500">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="truncate font-mono text-3xl font-semibold text-primary-600">
          {value ?? '-'}
        </span>
        {showUnit && unit && <span className="text-sm text-foreground-500">{unit}</span>}
      </div>
    </div>
  );
}

/** 趋势曲线（时间窗过滤已由取数层完成，视图只做格式化） */
export function LineChartView({
  label,
  series,
}: {
  label?: string;
  series: SeriesPoint[];
}) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        ...p,
        timeLabel: new Date(p.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      })),
    [series],
  );

  return (
    <div className="flex h-full w-full flex-col p-2">
      {label && (
        <span className="mb-1 shrink-0 truncate px-1 text-xs text-foreground-500">{label}</span>
      )}
      <div className="min-h-0 flex-1">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-foreground-500">
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -16 }}>
              <XAxis dataKey="timeLabel" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} width={48} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(l) => String(l)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--heroui-primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** 环形仪表 */
export function GaugeView({
  label,
  value,
  min = 0,
  max = 100,
  unit,
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const pct =
    value === undefined || max <= min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-2">
      <div className="relative h-full w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={[{ name: 'value', value: pct * 100 }]}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill="hsl(var(--heroui-primary))" background />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold text-foreground">
            {value === undefined ? '-' : value}
          </span>
          {unit && <span className="text-xs text-foreground-500">{unit}</span>}
        </div>
      </div>
      <span className="max-w-full truncate text-xs text-foreground-500">{label}</span>
    </div>
  );
}
