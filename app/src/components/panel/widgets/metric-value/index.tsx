/** 数值卡片（大号数值 + 单位） */
export function MetricValueView({
  label,
  value,
  unit,
  showUnit = true,
  noDataText = '等待数据',
}: {
  label: string;
  value: string | undefined;
  unit?: string;
  showUnit?: boolean;
  /** 无数据/状态未知时的文案 */
  noDataText?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-3">
      <span className="max-w-full truncate text-sm text-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="truncate font-mono text-3xl font-semibold text-primary-600">
          {value != null && value !== '' ? Number(value).toFixed(2) : noDataText}
        </span>
        {showUnit && unit && <span className="text-sm text-foreground-500">{unit}</span>}
      </div>
    </div>
  );
}