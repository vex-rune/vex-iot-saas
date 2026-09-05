/**
 * 控制台 KPI 卡片
 * - 加载时显示骨架/spinner
 * - 错误时显示 "-"
 * - 点击跳转到对应页面(可选)
 */
import { Card, CardBody, Chip, Spinner } from '@heroui/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

export type KpiColor = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export interface KpiCardProps {
  label: string;
  value: number | string | undefined;
  /** 颜色,默认 default */
  color?: KpiColor;
  /** 加载中(任意一个 query loading=true 即可) */
  loading?: boolean;
  /** 点击跳转(可选) */
  onPress?: () => void;
  /** 副标题(可选,例如"最近 24 小时") */
  hint?: string;
  /** 右上角徽章(可选) */
  badge?: ReactNode;
}

export default function KpiCard({
  label,
  value,
  color = 'default',
  loading = false,
  onPress,
  hint,
  badge,
}: KpiCardProps) {
  const isClickable = !!onPress;
  const display = loading ? (
    <Spinner size="sm" />
  ) : value === undefined || value === null ? (
    <span className="text-foreground-400">-</span>
  ) : (
    <span className="font-mono">{value}</span>
  );

  return (
    <Card
      isPressable={isClickable}
      isHoverable={isClickable}
      onPress={onPress}
      shadow="sm"
      classNames={{ base: 'bg-content1' }}
    >
      <CardBody className="gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-foreground-500">{label}</span>
          {badge ?? (color !== 'default' && (
            <Chip size="sm" variant="dot" color={color} />
          ))}
        </div>
        <div className="flex items-baseline gap-2 text-2xl font-semibold text-foreground">
          {display}
        </div>
        <div className="flex items-center justify-between text-[11px] text-foreground-400">
          <span>{hint}</span>
          {isClickable && (
            <span className="inline-flex items-center gap-0.5 text-primary-500">
              查看 <ChevronRightIcon className="h-3 w-3" />
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

