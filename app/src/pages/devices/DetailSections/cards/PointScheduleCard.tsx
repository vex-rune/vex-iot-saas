import { Button, Chip, Input, Select, SelectItem, Switch } from '@heroui/react';
import { CheckCircleIcon, XMarkIcon, TrashIcon, DocumentDuplicateIcon, PlusIcon } from '@heroicons/react/24/outline';
import { EntityCard, FieldRow } from '@/components/ui/EntityCard';
import CronEditor from '@/components/ui/CronEditor';
import type { PointDefinition } from '@/types/api';
import type { ActionDraft } from '../PointScheduleSection';

export interface ScheduleDraftForCard {
  id?: string;
  name: string;
  cron: string;
  enabled: boolean;
  description: string;
  actions: ActionDraft[];
}

interface PointScheduleCardProps {
  row: ScheduleDraftForCard;
  isNew: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isDeleted: boolean;
  points: PointDefinition[];
  onChange: (patch: Partial<ScheduleDraftForCard>) => void;
  onAddAction?: () => void;
  onRemoveAction?: (actionKey: string) => void;
  onUpdateAction?: (actionKey: string, patch: Partial<ActionDraft>) => void;
  onSave?: () => void;
  onDiscard?: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export function PointScheduleCard({
  row, isNew, isDirty, isSaving, isDeleted, points,
  onChange, onAddAction, onRemoveAction, onUpdateAction,
  onSave, onDiscard, onCopy, onDelete,
}: PointScheduleCardProps) {
  return (
    <EntityCard
      title={
        <Input size="md" variant="flat" placeholder="规则名称"
          value={row.name} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ name: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      }
      badge={
        <div className="flex flex-col items-end gap-1">
          <Switch size="md" isSelected={row.enabled}
            isDisabled={isDeleted}
            onValueChange={(v) => onChange({ enabled: v })} />
          {isNew && <Chip size="md" variant="flat" color="success">新增</Chip>}
          {isDeleted && <Chip size="md" variant="flat" color="danger">待删除</Chip>}
        </div>
      }
      actions={
        isDeleted ? (
          <span className="text-xs text-foreground-400">待删除</span>
        ) : isDirty ? (
          <>
            <Button size="md" variant="flat" color="success"
              startContent={<CheckCircleIcon className="h-4 w-4" />}
              isLoading={isSaving} onPress={onSave}>保存</Button>
            <Button size="md" variant="flat"
              startContent={<XMarkIcon className="h-4 w-4" />}
              onPress={onDiscard}>撤销</Button>
          </>
        ) : (
          <>
            <Button size="md" variant="flat" color="primary"
              startContent={<DocumentDuplicateIcon className="h-4 w-4" />}
              onPress={onCopy}>复制</Button>
            <Button size="md" variant="flat" color="danger"
              startContent={<TrashIcon className="h-4 w-4" />}
              onPress={onDelete}>删除</Button>
          </>
        )
      }
    >
      <FieldRow label="规则" value={
        <CronEditor value={row.cron} isDisabled={isDeleted}
          onChange={(v: string) => onChange({ cron: v })} />
      } />
      {/* 动作列表 */}
      <FieldRow label="动作" value={
      <div className="rounded-lg border border-divider p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground-500">
            动作（{row.actions.length}）
          </span>
          {
            <Button size="md" variant="flat" isIconOnly onPress={onAddAction}>
              <PlusIcon className="h-3 w-3" />
            </Button>
          }
        </div>
        {row.actions.length === 0 ? (
          <div className="rounded border border-dashed border-divider py-3 text-center text-xs text-foreground-400">
            尚未添加动作
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {row.actions.map((a, ai) => (
              <div key={a._key} className="flex items-center gap-1">
                <Chip size="md" variant="flat">{ai + 1}</Chip>
                {onUpdateAction ? (
                  <>
                    <Select size="md" variant="bordered" aria-label="点位" placeholder="选择点位"
                      selectedKeys={a.pointId ? [a.pointId] : []}
                      onSelectionChange={(keys) => {
                        const pid = Array.from(keys)[0] as string;
                        const p = points.find((x) => x.id === pid);
                        onUpdateAction(a._key, {
                          pointId: pid,
                          pointCode: p?.pointCode ?? '',
                          pointName: p?.pointName ?? '',
                          dataType: p?.dataType ?? 'STRING',
                        });
                      }}
                      className="min-w-0 flex-1">
                      {points.map((p) => (
                        <SelectItem key={p.id} textValue={`${p.pointName} (${p.pointCode})`}>
                          {p.pointName} ({p.pointCode})
                        </SelectItem>
                      ))}
                    </Select>
                    <Input size="md" variant="bordered"
                      placeholder={a.dataType === 'BOOL' ? 'true / false' : '值'}
                      value={a.valueText} className="w-24"
                      onValueChange={(v) => onUpdateAction(a._key, { valueText: v })} />
                    {onRemoveAction && (
                      <Button isIconOnly size="md" variant="light" color="danger"
                        onPress={() => onRemoveAction(a._key)}>
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-foreground-500">
                    {a.pointName || '未选择'}{a.valueText ? ` = ${a.valueText}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      } />
    </EntityCard>
  );
}