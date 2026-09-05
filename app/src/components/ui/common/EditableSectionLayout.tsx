import { Button, Chip, Tooltip } from '@heroui/react';
import { CheckCircleIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { forwardRef, type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/common/useMediaQuery';
import { useBeforeUnload } from '@/hooks/common/useBeforeUnload';

/** 组件 Props */
export interface EditableSectionLayoutProps {
  /** 标题（如 "点位设置"） */
  title: string;
  /** 标题前缀图标 */
  icon: ReactNode;
  /** 标题后的数量 Badge 文本 */
  countLabel: string;
  
  /** 有未保存内容（触发 beforeunload） */
  hasUnsaved: boolean;
  /** 未保存内容数量（显示 Badge） */
  unsavedCount?: number;
  
  /** 保存全部按钮回调 */
  onSaveAll: () => void;
  /** 放弃全部按钮回调（如果有未保存内容） */
  onDiscardAll?: () => void;
  /** 添加行按钮回调 */
  onAddRow?: () => void;
  /** 添加行按钮文本 */
  addRowLabel?: string;
  
  /** 是否正在保存（总按钮 Loading） */
  isSaving: boolean;
  
  /** 左侧额外工具栏内容（如筛选/排序/预设按钮） */
  extraToolbar?: ReactNode;
  
  /** 桌面端子内容（表格等） */
  children: ReactNode;
  /** 移动端卡片视图（可选，不传则桌面/移动端共用 children） */
  renderMobile?: () => ReactNode;
}

export const EditableSectionLayout = forwardRef<HTMLElement, EditableSectionLayoutProps>(({
  title,
  icon,
  countLabel,
  hasUnsaved,
  unsavedCount,
  onSaveAll,
  onDiscardAll,
  onAddRow,
  addRowLabel = '添加',
  isSaving,
  extraToolbar,
  children,
  renderMobile,
  ...rest
}, ref) => {
  const isMobile = useIsMobile();

  // 1. 浏览器关闭/刷新拦截
  useBeforeUnload(hasUnsaved);

  return (
    <section ref={ref} className="relative flex flex-col gap-4" {...rest}>
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {icon}
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <Chip size="sm" variant="flat">{countLabel}</Chip>
        
        {hasUnsaved && unsavedCount !== undefined && (
          <Chip size="sm" variant="flat" color="warning">
            {unsavedCount} 项未保存
          </Chip>
        )}
        
        {hasUnsaved && (
          <Tooltip content="放弃全部未保存内容">
            <Button size="sm" variant="flat" color="danger" startContent={<XMarkIcon className="h-4 w-4" />} onPress={onDiscardAll}>
              放弃全部
            </Button>
          </Tooltip>
        )}
        
        <div className="flex-1" />
        
        {extraToolbar}
        
        {onAddRow && (
          <Button size="sm" variant="flat" color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={onAddRow}>
            {addRowLabel}
          </Button>
        )}
        
        {hasUnsaved && (
          <Button size="sm" color="primary" isLoading={isSaving} startContent={<CheckCircleIcon className="h-4 w-4" />} onPress={onSaveAll}>
            保存全部
          </Button>
        )}
      </div>

      {/* 子内容容器：移动端渲染卡片，桌面端渲染表格 */}
      {isMobile && renderMobile ? renderMobile() : children}
    </section>
  );
});
