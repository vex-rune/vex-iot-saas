import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SeriesPoint } from '../../useWidgetData';

/** 趋势曲线（时间窗过滤已由取数层完成，视图只做格式化） */
export function LineChartView({
  label,
  series,
}: {
  /** 实体名/点位名；为空时使用占位文案，避免图表缺上下文 */
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
      <span className="mb-1 shrink-0 truncate px-1 text-xs text-foreground-500">
        {label || '未配置点位名'}
      </span>
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