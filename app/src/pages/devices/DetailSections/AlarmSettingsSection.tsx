import { EditableSectionLayout } from '@/components/ui/common/EditableSectionLayout';
import { AlarmSettingsCard } from './cards/AlarmSettingsCard';
import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
  addToast,
} from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getAlarmRulesByDevice, saveAlarmRule, deleteAlarmRule } from '@/services/alarms';
import { ALARM_LEVEL_COLORS, ALARM_LEVEL_LABELS, ALARM_LEVEL_OPTIONS } from '@/lib/levelMeta';
import { getDevicePoints } from '@/services/device';
import { queryNotifyUsers } from '@/services/notifyUsers';
import { useApiMutation } from '@/hooks/common/useApiMutation';
import { chainToPromise } from '@/hooks/common/useQueryList';
import { BatchProgressModal, type BatchTask } from '@/components/ui/common/BatchProgressModal';
import type { AlarmLevel, AlarmRule, AlarmConditionType, NotifyUser, PointDefinition } from '@/types/api';

const CONDITION_OPTIONS: AlarmConditionType[] = ['GT', 'GE', 'LT', 'LE', 'EQ', 'NE', 'BETWEEN'];
const CONDITION_DEFAULT_LABELS: Record<AlarmConditionType, string> = {
  GT: '大于', GE: '大于等于', LT: '小于', LE: '小于等于',
  EQ: '等于', NE: '不等于', BETWEEN: '区间',
};
const LEVEL_OPTIONS = ALARM_LEVEL_OPTIONS;
const LEVEL_LABELS = ALARM_LEVEL_LABELS;
const LEVEL_COLORS = ALARM_LEVEL_COLORS;

/** 表内编辑草稿行（无 id，新增/复制产生） */
export type DraftRow = {
  _key: string;
  ruleName: string;
  pointCode: string;
  conditionType: AlarmConditionType;
  conditionName: string;
  threshold: string;
  thresholdHigh: string;
  level: AlarmLevel;
  enabled: boolean;
  notifyUserIds: string[];
};

const EMPTY_DRAFT = (): DraftRow => ({
  _key: crypto.randomUUID(),
  ruleName: '',
  pointCode: '',
  conditionType: 'GT',
  conditionName: '',
  threshold: '',
  thresholdHigh: '',
  level: 'WARNING',
  enabled: true,
  notifyUserIds: [],
});

/** 4 字段唯一性：(pointCode, conditionType, threshold, level) */
function isDuplicateRule(
  rule: { pointCode: string; conditionType: AlarmConditionType; threshold: string; level: AlarmLevel },
  rules: AlarmRule[],
  drafts: DraftRow[],
  excludeId?: string,
): boolean {
  const pc = rule.pointCode.trim();
  const thr = rule.threshold.trim();
  if (!pc || !thr) return false;
  for (const r of rules) {
    if (excludeId && r.id === excludeId) continue;
    if (r.pointCode === pc && r.conditionType === rule.conditionType
      && String(r.threshold) === thr && r.level === rule.level) return true;
  }
  for (const d of drafts) {
    if (d.pointCode === pc && d.conditionType === rule.conditionType
      && d.threshold.trim() === thr && d.level === rule.level) return true;
  }
  return false;
}

/** 序号化命名：ruleName 末尾带" N"则 N+1，否则扫描最大 +1 */
function generateUniqueRuleName(
  baseName: string,
  rules: AlarmRule[],
  drafts: DraftRow[],
): string {
  const trimmed = (baseName || '规则').trim();
  const m = trimmed.match(/^(.*?)\s+(\d+)$/);
  const prefix = m ? m[1] : trimmed;
  const startN = m ? Number(m[2]) + 1 : 1;
  const base = (prefix || '规则').trim();
  const used = new Set<number>();
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)$`);
  for (const r of rules) {
    const rm = r.ruleName?.match(re);
    if (rm) used.add(Number(rm[1]));
  }
  for (const d of drafts) {
    const dm = d.ruleName.match(re);
    if (dm) used.add(Number(dm[1]));
  }
  const maxN = used.size === 0 ? 0 : Math.max(...used);
  let n = Math.max(startN, maxN + 1);
  while (used.has(n)) n += 1;
  return `${base} ${n}`;
}

export interface AlarmSettingsSectionProps {
  deviceId: string;
  sectionRef: (el: HTMLElement | null) => void;
}
export default function AlarmSettingsSection({ deviceId, sectionRef }: AlarmSettingsSectionProps) {
  const queryClient = useQueryClient();

  const { data: alarmRules = [] } = useQuery<AlarmRule[]>({
    queryKey: ['alarmRules.byDevice', deviceId],
    queryFn: () => chainToPromise(getAlarmRulesByDevice(deviceId)),
    enabled: !!deviceId,
  });
  const { data: points = [] } = useQuery<PointDefinition[]>({
    queryKey: ['points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });
  const { data: notifyUsers = [] } = useQuery<NotifyUser[]>({
    queryKey: ['notifyUsers.all'],
    queryFn: () => chainToPromise(queryNotifyUsers({})),
  });

  // 现存规则的"草稿"：键 = ruleId, 值 = 修改后的字段
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<DraftRow>>>(new Map());
  // 新增草稿行（与点位设置对齐）
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  // 待删除的现存规则 id
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  // 进度弹窗
  const [progressOpen, setProgressOpen] = useState(false);
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  // 确认 Modal
  const [confirm, setConfirm] = useState<{ kind: 'discard' } | null>(null);

  // 派生：可见规则（排除已删）
  const visibleRules = useMemo(
    () => alarmRules.filter((r) => !deletedIds.has(r.id)),
    [alarmRules, deletedIds],
  );

  // 派生：是否脏
  const isDirty = pendingChanges.size > 0 || drafts.length > 0 || deletedIds.size > 0;

  // 取某条规则的当前行数据：原值与草稿合并
  const getEffective = useCallback(
    (r: AlarmRule): DraftRow => {
      const changes = pendingChanges.get(r.id);
      return {
        _key: r.id,
        ruleName: changes?.ruleName ?? r.ruleName ?? '',
        pointCode: changes?.pointCode ?? r.pointCode ?? '',
        conditionType: changes?.conditionType ?? r.conditionType,
        conditionName: changes?.conditionName ?? r.conditionName ?? '',
        threshold: changes?.threshold ?? (r.threshold != null ? String(r.threshold) : ''),
        thresholdHigh: changes?.thresholdHigh ?? (r.thresholdHigh != null ? String(r.thresholdHigh) : ''),
        level: changes?.level ?? r.level,
        enabled: changes?.enabled ?? r.enabled ?? true,
        notifyUserIds: changes?.notifyUserIds ?? r.notifyUserIds ?? [],
      };
    },
    [pendingChanges],
  );

  const isRuleDirty = (r: AlarmRule) => pendingChanges.has(r.id);

  const updateRuleField = useCallback(
    (ruleId: string, changes: Partial<DraftRow>) => {
      setPendingChanges((prev) => {
        const next = new Map(prev);
        const old = next.get(ruleId) ?? {};
        next.set(ruleId, { ...old, ...changes });
        return next;
      });
    },
    [],
  );
  const discardRule = useCallback((ruleId: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.delete(ruleId);
      return next;
    });
    setDeletedIds((prev) => {
      if (!prev.has(ruleId)) return prev;
      const next = new Set(prev);
      next.delete(ruleId);
      return next;
    });
  }, []);
  const markDeleted = useCallback((ruleId: string) => {
    setPendingChanges((prev) => {
      if (prev.has(ruleId)) {
        const next = new Map(prev);
        next.delete(ruleId);
        return next;
      }
      return prev;
    });
    setDeletedIds((prev) => new Set(prev).add(ruleId));
  }, []);

  // 草稿行操作
  const addDraft = (preset?: Partial<DraftRow>) => {
    setDrafts((prev) => {
      const seed = { ...EMPTY_DRAFT(), ...preset };
      const ruleName = generateUniqueRuleName(seed.ruleName, alarmRules, [
        ...prev,
        ...visibleRules.map((r) => getEffective(r)),
      ]);
      return [...prev, { ...seed, _key: crypto.randomUUID(), ruleName }];
    });
  };
  const updateDraft = useCallback((key: string, changes: Partial<DraftRow>) => {
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, ...changes } : d)));
  }, []);
  const removeDraft = useCallback((key: string) => {
    setDrafts((prev) => prev.filter((d) => d._key !== key));
  }, []);

  const copyRule = (source: DraftRow) => {
    setDrafts((prev) => {
      const effectivePrev = prev.length === 0
        ? visibleRules.map((r) => getEffective(r))
        : prev;
      const ruleName = generateUniqueRuleName(source.ruleName, alarmRules, effectivePrev);
      return [...prev, { ...source, _key: crypto.randomUUID(), ruleName }];
    });
  };

  // 全部放弃
  const discardAll = () => {
    setPendingChanges(new Map());
    setDrafts([]);
    setDeletedIds(new Set());
  };

  // 全部保存
  const buildTasks = (): BatchTask[] => {
    const tasks: BatchTask[] = [];
    // 先删除
    for (const id of deletedIds) {
      const r = alarmRules.find((x) => x.id === id);
      tasks.push({
        key: `del:${id}`,
        label: r ? `删除 ${r.ruleName || r.pointCode || id}` : `删除 ${id}`,
        run: async () => { await deleteAlarmMutation.mutateAsync(id); },
      });
    }
    // 更新现有
    for (const [id] of pendingChanges.entries()) {
      const r = alarmRules.find((x) => x.id === id);
      if (!r) continue;
      const eff = getEffective(r);
      tasks.push({
        key: `upd:${id}`,
        label: `更新 ${eff.ruleName || eff.pointCode || id}`,
        run: async () => {
          const payload: Partial<AlarmRule> = {
            id: r.id,
            deviceId,
            pointCode: eff.pointCode.trim(),
            conditionType: eff.conditionType,
            threshold: eff.threshold.trim(),
            thresholdHigh:
              eff.conditionType === 'BETWEEN' ? eff.thresholdHigh.trim() : undefined,
            level: eff.level,
            enabled: eff.enabled,
            notifyUserIds: eff.notifyUserIds,
            ruleName: eff.ruleName.trim() || undefined,
          };
          await saveAlarmMutation.mutateAsync(payload);
        },
      });
    }
    // 新增草稿
    for (const d of drafts) {
      tasks.push({
        key: `new:${d._key}`,
        label: `新增 ${d.ruleName || d.pointCode || '未命名规则'}`,
        run: async () => {
          const payload: Partial<AlarmRule> = {
            deviceId,
            pointCode: d.pointCode.trim(),
            conditionType: d.conditionType,
            conditionName: d.conditionName.trim() || undefined,
            threshold: d.threshold.trim(),
            thresholdHigh: d.conditionType === 'BETWEEN' ? d.thresholdHigh.trim() : undefined,
            level: d.level,
            enabled: d.enabled,
            notifyUserIds: d.notifyUserIds,
            ruleName: d.ruleName.trim() || undefined,
          };
          await saveAlarmMutation.mutateAsync(payload);
        },
      });
    }
    return tasks;
  };

  const saveAlarmMutation = useApiMutation({ mutationFn: (data: Partial<AlarmRule>) => saveAlarmRule(data) });
  const deleteAlarmMutation = useApiMutation({ mutationFn: (ruleId: string) => deleteAlarmRule(ruleId) });

  const openSaveAll = () => {
    // 预校验：必填 + 唯一性
    const fail: string[] = [];
    // 更新：必填
    for (const [id, _] of pendingChanges.entries()) {
      const eff = getEffective(alarmRules.find((r) => r.id === id)!);
      if (!eff.pointCode.trim()) fail.push(`${eff.ruleName || id}：未选择点位`);
      if (!eff.threshold.trim()) fail.push(`${eff.ruleName || id}：阈值为空`);
      if (eff.conditionType === 'BETWEEN' && !eff.thresholdHigh.trim())
        fail.push(`${eff.ruleName || id}：阈值上限为空`);
    }
    // 新增：必填 + 唯一性
    for (const d of drafts) {
      if (!d.pointCode.trim()) fail.push(`${d.ruleName || '未命名规则'}：未选择点位`);
      if (!d.threshold.trim()) fail.push(`${d.ruleName || '未命名规则'}：阈值为空`);
      if (d.conditionType === 'BETWEEN' && !d.thresholdHigh.trim())
        fail.push(`${d.ruleName || '未命名规则'}：阈值上限为空`);
      if (isDuplicateRule(d, visibleRules, drafts)) {
        fail.push(`${d.ruleName || d.pointCode}：与已有规则重复（点位+条件+阈值+级别 4 字段必须唯一）`);
      }
    }
    // 更新行也要做唯一性
    for (const [id, _] of pendingChanges.entries()) {
      const eff = getEffective(alarmRules.find((r) => r.id === id)!);
      if (isDuplicateRule(eff, visibleRules, drafts, id)) {
        fail.push(`${eff.ruleName || id}：与已有规则重复`);
      }
    }
    if (fail.length > 0) {
      addToast({
        title: '请补全必填/解决冲突',
        description: fail.slice(0, 3).join('；') + (fail.length > 3 ? `…等 ${fail.length} 项` : ''),
        color: 'warning',
      });
      return;
    }
    setBatchTasks(buildTasks());
    setProgressOpen(true);
  };

  const onBatchComplete = (results: { ok: boolean }[]) => {
    if (results.every((r) => r.ok)) {
      setPendingChanges(new Map());
      setDrafts([]);
      setDeletedIds(new Set());
      addToast({ title: '全部保存成功', color: 'success' });
    } else {
      const ok = results.filter((r) => r.ok).length;
      addToast({ title: `部分失败：成功 ${ok} / 共 ${results.length}`, color: 'warning' });
    }
    queryClient.invalidateQueries({ queryKey: ['alarmRules.byDevice', deviceId] });
  };

  // 整体表行 = 现存（合并草稿 + 排除删除）+ 新增草稿
  const allRows: DraftRow[] = useMemo(() => {
    const existing = visibleRules.map(getEffective);
    return [...existing, ...drafts];
  }, [visibleRules, drafts, getEffective]);

  return (
    <EditableSectionLayout
      ref={sectionRef}
      title="告警设置"
      icon={<BellIcon className="h-4 w-4 text-foreground-500" />}
      countLabel={`${visibleRules.length} 条规则`}
      hasUnsaved={isDirty}
      unsavedCount={pendingChanges.size + drafts.length + deletedIds.size}
      onSaveAll={openSaveAll}
      onDiscardAll={() => setConfirm({ kind: 'discard' })}
      isSaving={false} // 需要补充状态判断
      extraToolbar={
        <Popover placement="bottom-end">
          <PopoverTrigger>
            <Button size="sm" color="primary" startContent={<PlusIcon className="h-4 w-4" />}>
              添加规则
            </Button>
          </PopoverTrigger>
          <PopoverContent >
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="flat" className="justify-start"
                onPress={() => { addDraft({ conditionType: 'GT', level: 'WARNING' }); }}>
                超过阈值告警
              </Button>
              <Button size="sm" variant="flat" className="justify-start"
                onPress={() => { addDraft({ conditionType: 'LT', level: 'CRITICAL' }); }}>
                低于阈值告警
              </Button>
              <Button size="sm" variant="flat" className="justify-start"
                onPress={() => { addDraft({ conditionType: 'EQ', level: 'FATAL' }); }}>
                等值触发
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      }
      renderMobile={() => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {allRows.map((row) => {
            const isNew = !alarmRules.some((r) => r.id === row._key) && !deletedIds.has(row._key);
            const isDel = !isNew && deletedIds.has(row._key);
            const isExistingDirty = isNew ? false : isRuleDirty(alarmRules.find((r) => r.id === row._key)!);
            return (
              <AlarmSettingsCard
                key={row._key}
                row={isNew ? row : getEffective(alarmRules.find((r) => r.id === row._key)!)}
                isDirty={isNew || isExistingDirty}
                isSaving={false}
                isDeleted={isDel}
                points={points}
                notifyUsers={notifyUsers}
                onChange={(patch) => isNew
                  ? updateDraft(row._key, patch)
                  : updateRuleField(row._key, patch)}
                onSave={isNew ? undefined : async () => {
                  const r = alarmRules.find((x) => x.id === row._key)!;
                  const eff = getEffective(r);
                  await saveAlarmMutation.mutateAsync({
                    id: r.id, deviceId, pointCode: eff.pointCode.trim(),
                    conditionType: eff.conditionType,
                    conditionName: eff.conditionName.trim() || undefined,
                    threshold: eff.threshold.trim(),
                    thresholdHigh: eff.conditionType === 'BETWEEN' ? eff.thresholdHigh.trim() : undefined,
                    level: eff.level, enabled: eff.enabled,
                    notifyUserIds: eff.notifyUserIds,
                    ruleName: eff.ruleName.trim() || undefined,
                  });
                  discardRule(r.id);
                  queryClient.invalidateQueries({ queryKey: ['alarmRules.byDevice', deviceId] });
                }}
                onDiscard={() => isNew ? removeDraft(row._key) : discardRule(row._key)}
                onCopy={() => {
                  const source = isNew ? row : getEffective(alarmRules.find((r) => r.id === row._key)!);
                  copyRule(source);
                }}
                onDelete={() => isNew ? removeDraft(row._key) : markDeleted(row._key)}
              />
            );
          })}
          {/* 移动端新增告警规则按钮 */}
          <div className="col-span-full">
            <Popover placement="bottom-end">
              <PopoverContent>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="flat" className="justify-start"
                    onPress={() => { addDraft({ conditionType: 'GT', level: 'WARNING' }); }}>
                    超过阈值告警
                  </Button>
                  <Button size="sm" variant="flat" className="justify-start"
                    onPress={() => { addDraft({ conditionType: 'LT', level: 'CRITICAL' }); }}>
                    低于阈值告警
                  </Button>
                  <Button size="sm" variant="flat" className="justify-start"
                    onPress={() => { addDraft({ conditionType: 'EQ', level: 'FATAL' }); }}>
                    等值触发
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    >
      {allRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-divider p-8 text-center text-sm text-foreground-400">
          暂无告警规则，点击「添加规则」开始配置
        </div>
      ) : (
        <Table aria-label="告警规则" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
  <TableHeader>
    <TableColumn>规则名称</TableColumn>
    <TableColumn>点位</TableColumn>
    <TableColumn>条件</TableColumn>
    <TableColumn>阈值</TableColumn>
    <TableColumn>级别</TableColumn>
    <TableColumn>通知人</TableColumn>
    <TableColumn>启用</TableColumn>
    <TableColumn>状态</TableColumn>
    <TableColumn>操作</TableColumn>
  </TableHeader>
  <TableBody emptyContent="暂无告警规则，点击「添加规则」开始配置">
    {allRows.map((row) => {
      const isNew = !alarmRules.some((r) => r.id === row._key) && !deletedIds.has(row._key);
      const isExistingDirty = isNew ? false : isRuleDirty(alarmRules.find((r) => r.id === row._key)!);
      const isDel = !isNew && deletedIds.has(row._key);
      const pointOptions = points.map((p) => ({ key: p.pointCode, label: `${p.pointName} (${p.pointCode})` }));
      const userOptions = notifyUsers.map((u) => ({ key: u.id, label: `${u.name}（${u.phone}）` }));
      const updateField = isNew
        ? (changes: Partial<DraftRow>) => updateDraft(row._key, changes)
        : (changes: Partial<DraftRow>) => updateRuleField(row._key, changes);
      return (
        <TableRow key={row._key} className={isDel ? 'opacity-50' : ''}>
          <TableCell>
            <Input size="sm" variant="bordered" placeholder="规则名称"
              value={row.ruleName} isDisabled={isDel}
              onValueChange={(v) => updateField({ ruleName: v })}
              classNames={{ inputWrapper: 'h-8 min-h-0' }} />
          </TableCell>
          <TableCell>
            <Select size="sm" variant="bordered" aria-label="点位" placeholder="选择点位"
              isDisabled={isDel}
              selectedKeys={row.pointCode ? [row.pointCode] : []}
              onSelectionChange={(keys) => updateField({ pointCode: Array.from(keys)[0] as string })}
              className="min-w-32">
              {pointOptions.map((opt) => (
                <SelectItem key={opt.key} textValue={opt.label}>{opt.label}</SelectItem>
              ))}
            </Select>
          </TableCell>
          <TableCell>
            <Select size="sm" variant="bordered" aria-label="条件"
              isDisabled={isDel}
              selectedKeys={[row.conditionType]}
              onSelectionChange={(keys) => updateField({ conditionType: Array.from(keys)[0] as AlarmConditionType })}
              className="min-w-32">
              {CONDITION_OPTIONS.map((c) => (
                <SelectItem key={c} textValue={`${CONDITION_DEFAULT_LABELS[c]}`}>
                  {CONDITION_DEFAULT_LABELS[c]})
                </SelectItem>
              ))}
            </Select>
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap items-center gap-1">
              <Input size="sm" variant="bordered" type="number" placeholder="阈值" className="w-20"
                isDisabled={isDel}
                value={row.threshold}
                onValueChange={(v) => updateField({ threshold: v })} />
              {row.conditionType === 'BETWEEN' && (
                <>
                  <span className="text-foreground-400">~</span>
                  <Input size="sm" variant="bordered" type="number" placeholder="上限" className="w-20"
                    isDisabled={isDel}
                    value={row.thresholdHigh}
                    onValueChange={(v) => updateField({ thresholdHigh: v })} />
                </>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Select size="sm" variant="bordered" aria-label="级别"
              isDisabled={isDel}
              selectedKeys={[row.level]}
              onSelectionChange={(keys) => updateField({ level: Array.from(keys)[0] as AlarmLevel })}
              className="min-w-20">
              {LEVEL_OPTIONS.map((l) => (
                <SelectItem key={l} textValue={LEVEL_LABELS[l] ?? l}>{LEVEL_LABELS[l] ?? l}</SelectItem>
              ))}
            </Select>
          </TableCell>
          <TableCell>
            <Select size="sm" variant="bordered" aria-label="通知人"
              selectionMode="multiple" placeholder="选择接收人"
              isDisabled={isDel}
              selectedKeys={row.notifyUserIds}
              onSelectionChange={(keys) => updateField({ notifyUserIds: Array.from(keys) as string[] })}
              className="min-w-32">
              {userOptions.map((opt) => (
                <SelectItem key={opt.key} textValue={opt.label}>{opt.label}</SelectItem>
              ))}
            </Select>
          </TableCell>
          <TableCell>
            <Switch size="sm" isSelected={row.enabled} isDisabled={isDel}
              onValueChange={(v) => updateField({ enabled: v })} />
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              <Chip size="sm" variant="flat" color={LEVEL_COLORS[row.level] ?? 'default'}>
                {LEVEL_LABELS[row.level] ?? row.level}
              </Chip>
              {isNew && <Chip size="sm" variant="flat" color="primary">新增</Chip>}
              {isExistingDirty && <Chip size="sm" variant="flat" color="warning">未保存</Chip>}
              {isDel && <Chip size="sm" variant="flat" color="danger">待删除</Chip>}
              {!row.enabled && !isDel && <Chip size="sm" variant="flat">已禁用</Chip>}
            </div>
          </TableCell><TableCell>
            <div className="flex gap-1">
              {isNew ? (
                <>
                  <Tooltip content="保存">
                    <Button size="sm" variant="flat" color="success" isIconOnly
                      isDisabled={!row.pointCode.trim() || !row.threshold.trim()
                        || (row.conditionType === 'BETWEEN' && !row.thresholdHigh.trim())}
                      onPress={async () => {
                        try {
                          await saveAlarmMutation.mutateAsync({
                            deviceId, pointCode: row.pointCode.trim(),
                            conditionType: row.conditionType,
                            conditionName: row.conditionName.trim() || undefined,
                            threshold: row.threshold.trim(),
                            thresholdHigh: row.conditionType === 'BETWEEN' ? row.thresholdHigh.trim() : undefined,
                            level: row.level, enabled: row.enabled,
                            notifyUserIds: row.notifyUserIds,
                            ruleName: row.ruleName.trim() || undefined,
                          });
                          addToast({ title: '规则已保存', color: 'success' });
                          removeDraft(row._key);
                          queryClient.invalidateQueries({ queryKey: ['alarmRules.byDevice', deviceId] });
                        } catch (e) { addToast({ title: `保存失败：${e instanceof Error ? e.message : String(e)}`, color: 'danger' }); }
                      }}>
                      <CheckCircleIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="复制">
                    <Button size="sm" variant="light" color="primary" isIconOnly onPress={() => copyRule(row)}>
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="移除">
                    <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => removeDraft(row._key)}>
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </>
              ) : isExistingDirty ? (
                <>
                  <Tooltip content="保存修改">
                    <Button size="sm" variant="flat" color="success" isIconOnly
                      isLoading={saveAlarmMutation.isPending}
                      onPress={async () => {
                        const r = alarmRules.find((x) => x.id === row._key)!;
                        const eff = getEffective(r);
                        try {
                          await saveAlarmMutation.mutateAsync({
                            id: r.id, deviceId, pointCode: eff.pointCode.trim(),
                            conditionType: eff.conditionType,
                            conditionName: eff.conditionName.trim() || undefined,
                            threshold: eff.threshold.trim(),
                            thresholdHigh: eff.conditionType === 'BETWEEN' ? eff.thresholdHigh.trim() : undefined,
                            level: eff.level, enabled: eff.enabled,
                            notifyUserIds: eff.notifyUserIds,
                            ruleName: eff.ruleName.trim() || undefined,
                          });
                          addToast({ title: '规则已更新', color: 'success' });
                          discardRule(r.id);
                          queryClient.invalidateQueries({ queryKey: ['alarmRules.byDevice', deviceId] });
                        } catch (e) { addToast({ title: `更新失败：${e instanceof Error ? e.message : String(e)}`, color: 'danger' }); }
                      }}>
                      <CheckCircleIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="撤销">
                    <Button size="sm" variant="light" isIconOnly onPress={() => discardRule(row._key)}>
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip content="复制">
                    <Button size="sm" variant="light" color="primary" isIconOnly onPress={() => copyRule(row)}>
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="删除">
                    <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => markDeleted(row._key)}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      );
    })}
  </TableBody>
</Table>
      )}

      {/* 全部放弃二次确认 */}
      <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} placement="center" size="sm">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>确认全部放弃？</ModalHeader>
              <ModalBody>
                <p className="text-sm">
                  将清空 {pendingChanges.size} 条修改、{drafts.length} 条新增、{deletedIds.size} 条待删除。无法恢复。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setConfirm(null)}>取消</Button>
                <Button color="danger" onPress={() => { discardAll(); setConfirm(null); }}>
                  确认放弃
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <BatchProgressModal
        open={progressOpen}
        title="正在批量保存告警规则"
        tasks={batchTasks}
        onClose={() => setProgressOpen(false)}
        onComplete={onBatchComplete}
      />
    </EditableSectionLayout>
  );
}
