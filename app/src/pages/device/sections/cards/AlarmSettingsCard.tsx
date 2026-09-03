import { Button, Chip, Input, Select, SelectItem, Switch } from '@heroui/react';
import { CheckCircleIcon, XMarkIcon, TrashIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { ALARM_LEVEL_COLORS, ALARM_LEVEL_LABELS } from '@/lib/levelMeta';
import type { AlarmConditionType, AlarmLevel, NotifyUser, PointDefinition } from '@/types/api';
import type { DraftRow } from '../AlarmSettingsSection';

const CONDITION_OPTIONS: AlarmConditionType[] = ['GT', 'GE', 'LT', 'LE', 'EQ', 'NE', 'BETWEEN'];
const CONDITION_LABELS: Record<AlarmConditionType, string> = {
  GT: '大于', GE: '大于等于', LT: '小于', LE: '小于等于',
  EQ: '等于', NE: '不等于', BETWEEN: '区间',
};
const LEVEL_OPTIONS: AlarmLevel[] = ['INFO', 'WARNING', 'CRITICAL', 'FATAL'];

interface AlarmSettingsCardProps {
  row: DraftRow;
  isDirty: boolean;
  isSaving: boolean;
  isDeleted: boolean;
  points: PointDefinition[];
  notifyUsers: NotifyUser[];
  onChange: (patch: Partial<DraftRow>) => void;
  onSave?: () => void;
  onDiscard?: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export function AlarmSettingsCard({
  row, isDirty, isSaving, isDeleted, points, notifyUsers,
  onChange, onSave, onDiscard, onCopy, onDelete,
}: AlarmSettingsCardProps) {
  return (
    <EntityCard
      title={
        <Input size="md" variant="flat" placeholder="规则名称" style={{ wordBreak: 'break-word', fontSize: '1.5rem' }}
          value={row.ruleName} isDisabled={isDeleted}
          onValueChange={(v: string) => onChange({ ruleName: v })}
          classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
      }
      badge={
        <div className="flex flex-col items-end gap-1">
          <Switch size="md" isSelected={row.enabled} isDisabled={isDeleted}
            onValueChange={(v) => onChange({ enabled: v })} />
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
      <div className="grid grid-cols-2 gap-2">


        <FieldRow label="选择点位" value={
          <Select size="md" variant="flat" aria-label="点位" placeholder="选择点位"
            isDisabled={isDeleted}
            selectedKeys={row.pointCode ? [row.pointCode] : []}
            onSelectionChange={(keys) => onChange({ pointCode: Array.from(keys)[0] as string })}
            className="min-w-0">
            {points.map((p) => (
              <SelectItem key={p.pointCode} textValue={`${p.pointName} (${p.pointCode})`}>
                {p.pointName} ({p.pointCode})
              </SelectItem>
            ))}
          </Select>
        } />

        <FieldRow label="级别" value={

          <Select size="md" variant="flat" aria-label="级别"
            isDisabled={isDeleted}
            selectedKeys={[row.level]}
            onSelectionChange={(keys) => onChange({ level: Array.from(keys)[0] as AlarmLevel })}
            className="w-24">
            {LEVEL_OPTIONS.map((l) => (
              <SelectItem key={l} textValue={ALARM_LEVEL_LABELS[l] ?? l}>
                <Chip size="md" variant="flat" color={ALARM_LEVEL_COLORS[l]}>{ALARM_LEVEL_LABELS[l] ?? l}</Chip>
              </SelectItem>
            ))}
          </Select>
        } />
        <FieldRow label="条件" value={
          <Select size="md" variant="flat" aria-label="条件"
            isDisabled={isDeleted}
            selectedKeys={[row.conditionType]}
            onSelectionChange={(keys) => onChange({ conditionType: Array.from(keys)[0] as AlarmConditionType })}>
            {CONDITION_OPTIONS.map((c) => (
              <SelectItem key={c} textValue={CONDITION_LABELS[c]}>{CONDITION_LABELS[c]}</SelectItem>
            ))}
          </Select>
        } />
        <FieldRow label="阈值" value={
          <div className="flex items-center gap-1">
            <Input size="md" variant="flat" type="number" placeholder="阈值"
              value={row.threshold} isDisabled={isDeleted}
              onValueChange={(v: string) => onChange({ threshold: v })}
              classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
            {row.conditionType === 'BETWEEN' && (
              <>
                <span className="text-foreground-400">~</span>
                <Input size="md" variant="flat" type="number" placeholder="上限"
                  value={row.thresholdHigh} isDisabled={isDeleted}
                  onValueChange={(v: string) => onChange({ thresholdHigh: v })}
                  classNames={{ inputWrapper: 'bg-transparent h-7 min-h-0' }} />
              </>
            )}
          </div>
        } />
      </div>
      <FieldRow label="通知人" value={
        <Select size="md" variant="flat" aria-label="通知人" selectionMode="multiple"
          placeholder="选择接收人" isDisabled={isDeleted}
          selectedKeys={row.notifyUserIds}
          onSelectionChange={(keys) => onChange({ notifyUserIds: Array.from(keys) as string[] })}>
          {notifyUsers.map((u) => (
            <SelectItem key={u.id} textValue={`${u.name}（${u.phone}）`}>
              {u.name}（{u.phone}）
            </SelectItem>
          ))}
        </Select>
      } />
    </EntityCard>
  );
}