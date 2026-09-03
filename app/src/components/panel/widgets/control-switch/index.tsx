import { Switch } from '@heroui/react';

/** 控制开关（RW 点位下发） */
export function ControlSwitchView({
  label,
  value,
  disabled,
  pending,
  awaiting = null,
  hint,
  noDataText = '等待数据',
  onToggle,
}: {
  label: string;
  value: boolean | undefined;
  disabled: boolean;
  pending: boolean;
  /** 已下发、等待设备上报的期望值（非 null 时锁定开关） */
  awaiting?: boolean | null;
  hint?: string;
  /** 无数据/状态未知时的文案 */
  noDataText?: string;
  onToggle: (next: boolean) => void;
}) {
  const statusText = pending
    ? '下发中…'
    : awaiting !== null
      ? '已下发，等待上报…'
      : value === undefined
        ? noDataText
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