import type { ReactNode } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/react';

interface EntityCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** 右上角状态/标签区 */
  badge?: ReactNode;
  children?: ReactNode;
  /** 底部操作区(按钮组) */
  actions?: ReactNode;
}

/** 移动端列表项的统一样式: 圆角白底卡片 + 标题/标签 + 字段区 + 操作区 */
export function EntityCard({ title, subtitle, badge, children, actions }: EntityCardProps) {
  return (
    <Card shadow="sm" className="bg-content1">
      {(title || badge) && (
        <CardHeader className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <div className="truncate text-sm font-semibold text-foreground">{title}</div>}
            {subtitle && <div className="truncate text-xs text-foreground-500">{subtitle}</div>}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </CardHeader>
      )}
      <CardBody className="gap-2 pt-0 text-sm">
        <div className="flex flex-col gap-1.5">{children}</div>
        {actions && <div className="mt-2 flex flex-wrap gap-2 border-t border-divider pt-2">{actions}</div>}
      </CardBody>
    </Card>
  );
}

interface FieldRowProps {
  label: ReactNode;
  value: ReactNode;
}

/** 卡片内的"标签 : 值"行 */
export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-16 shrink-0 text-foreground-400">{label}</span>
      <span className="min-w-0 flex-1 break-all text-foreground">{value}</span>
    </div>
  );
}
