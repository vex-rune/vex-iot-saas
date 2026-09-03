import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

/** 环形仪表 */
export function GaugeView({
  label,
  value,
  min = 0,
  max = 100,
  unit,
  noDataText = '等待数据',
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  unit?: string;
  /** 无数据/状态未知时的文案 */
  noDataText?: string;
}) {
  const pct =
    value === undefined || max <= min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-2">
      <span className="max-w-full truncate text-xs text-foreground-500">{label}</span>
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
            {value === undefined ? noDataText : value}
          </span>
          {unit && <span className="text-xs text-foreground-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
}