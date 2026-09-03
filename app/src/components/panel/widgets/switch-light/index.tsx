import type { BadgeColor } from '../../types';

/** 开关指示灯（显示态：实体名优先 + 状态次之 + 辅助信息再之） */
export function SwitchLightView({
  label,
  value,
  noDataText = '等待数据',
  color,
}: {
  label: string;
  value: boolean | undefined;
  /** 无数据/状态未知时的文案 */
  noDataText?: string;
  /** 显式指定指示灯语义色；未传时按 value 自动推导 */
  color?: BadgeColor;
}) {
  // 语义色：显式 color > 按状态推导（开=success / 关=danger / 无数据=default）
  const resolvedColor = color ?? (value === undefined ? 'default' : value ? 'success' : 'danger');
  const lightClass =
    resolvedColor === 'success'
      ? 'bg-success shadow-[0_0_16px_#17c96488]'
      : resolvedColor === 'danger'
        ? 'bg-danger shadow-[0_0_16px_#f3126088]'
        : resolvedColor === 'warning'
          ? 'bg-warning shadow-[0_0_16px_#f5a52488]'
          : resolvedColor === 'primary'
            ? 'bg-primary shadow-[0_0_16px_#006FEE88]'
            : 'bg-default-300';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
      <span className="max-w-full truncate text-sm text-foreground">{label}</span>
      <span className={`h-9 w-9 rounded-full transition-all ${lightClass}`} />
      <span className="text-xs text-foreground-500">
        {value === undefined ? noDataText : value ? '开' : '关'}
      </span>
    </div>
  );
}