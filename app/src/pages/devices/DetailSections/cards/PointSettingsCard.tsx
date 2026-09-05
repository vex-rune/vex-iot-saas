import { Button, Input, Select, SelectItem } from '@heroui/react';
import { CheckCircleIcon, XMarkIcon, TrashIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { EntityCard, FieldRow } from '@/components/ui/EntityCard';
import { ACCESS_LABELS, ACCESS_TYPES, DATA_TYPES } from '../pointUtils';
import type { PointRow } from '../pointUtils';
import type { DataType } from '@/types/api';

interface PointSettingsCardProps {
  row: PointRow;
  isDirty: boolean;
  isSaving: boolean;
  isDeleted?: boolean;
  onChange: (patch: Partial<PointRow>) => void;
  onSave: () => void;
  onDiscard: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export function PointSettingsCard({
  row,
  isDirty,
  isSaving,
  isDeleted,
  onChange,
  onSave,
  onDiscard,
  onCopy,
  onDelete,
}: PointSettingsCardProps) {
  return (
    <EntityCard
      title={
        <Input size="md" variant="flat" placeholder="点位名称" style={{ wordBreak: 'break-word', fontSize: '1.5rem' }}
          value={row.pointName} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ pointName: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      }
      actions={
        isDeleted ? (
          <span className="text-xs text-foreground-400">待删除</span>
        ) : isDirty ? (
          <>
            <Button size="md" variant="flat" color="success"
              startContent={<CheckCircleIcon className="h-4 w-4" />}
              isLoading={isSaving} onPress={onSave}>
              保存
            </Button>
            <Button size="md" variant="flat"
              startContent={<XMarkIcon className="h-4 w-4" />}
              onPress={onDiscard}>
              撤销
            </Button>
          </>
        ) : (
          <>
            <Button size="md" variant="flat" color="primary"
              startContent={<DocumentDuplicateIcon className="h-4 w-4" />}
              onPress={onCopy}>
              复制
            </Button>
            <Button size="md" variant="flat" color="danger"
              startContent={<TrashIcon className="h-4 w-4" />}
              onPress={onDelete}>
              删除
            </Button>
          </>
        )
      }
    >
      <FieldRow label="编码" value={
        <Input size="md" variant="flat" placeholder="编码"
          value={row.pointCode} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ pointCode: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      } />
      <FieldRow label="数据类型" value={
        <div className="flex items-center gap-2">
          <Select size="md" variant="flat" aria-label="数据类型"
            isDisabled={isDeleted}
            selectedKeys={[row.dataType]}
            onSelectionChange={(keys) => {
              const newType = Array.from(keys)[0] as DataType;
              onChange({ 
                dataType: newType,
                // 切换到非 DOUBLE 时清除精度
                ...(newType !== 'DOUBLE' ? { precision: undefined } : {})
              });
            }}
          >
            {DATA_TYPES.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
          </Select>
          {row.dataType === 'DOUBLE' && (
            <Input
              size="md"
              variant="flat"
              type="number"
              min={0}
              max={10}
              aria-label="小数位数"
              placeholder="2"
              isDisabled={isDeleted}
              value={row.precision != null ? String(row.precision) : '2'}
              onValueChange={(v: string) => {
                const num = v === '' ? 2 : Number(v);
                onChange({ precision: isNaN(num) ? 2 : num });
              }}
              classNames={{ 
                inputWrapper: 'bg-transparent h-7 min-h-0 w-20',
                input: 'text-center'
              }}
              endContent={
                <span className="text-xs text-foreground-400">位</span>
              }
            />
          )}
        </div>
      } />
      <FieldRow label="读写" value={<div className="flex gap-0.5">
        {ACCESS_TYPES.map((t) => (
          <Button key={t} size="md" isDisabled={isDeleted}
            variant={row.access === t ? 'flat' : 'light'}
            color={row.access === t ? 'primary' : 'default'}
            onPress={() => onChange({ access: t })}>
            {ACCESS_LABELS[t]}
          </Button>
        ))}
      </div>
      } />
      <FieldRow label="单位" value={
        <Input size="sm" variant="flat" placeholder="℃"
          value={row.unit} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ unit: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      } />
      <FieldRow label="分组" value={
        <Input size="md" variant="flat" placeholder="如：温度组"
          value={row.groupLabel} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ groupLabel: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      } />
      <FieldRow label="描述" value={
        <Input size="md" variant="flat" placeholder="可选"
          value={row.description} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ description: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      } />
    </EntityCard>
  );
}
