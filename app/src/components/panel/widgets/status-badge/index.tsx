import { Chip } from '@heroui/react';
import type { BadgeColor, BadgeColorRule } from '../../types';

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
  noDataText = '等待数据',
  noDataColor,
}: {
  label: string;
  value: string | undefined;
  /** 直接指定颜色（设备属性语义色），优先于规则匹配 */
  color?: BadgeColor;
  colorRules?: BadgeColorRule[];
  /** 无数据/状态未知时的文案 */
  noDataText?: string;
  noDataColor?: BadgeColor;
}) {
  const resolved = color ?? resolveBadgeColor(value, colorRules, noDataColor);
  const noData = value === undefined || value === '';
  const display = noData ? noDataText : value;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
      <span className="max-w-full truncate text-sm text-foreground">{label}</span>
      <Chip size="lg" variant="flat" color={resolved}>
        {display}
      </Chip>
    </div>
  );
}