import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Textarea,
  Tooltip,
  addToast,
} from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  listDeviceSchedules,
  saveSchedule,
  deleteSchedule,
} from '@/api/schedules';
import { getDevicePoints } from '@/api/devices';
import { useApiMutation } from '@/hooks/useApiMutation';
import { chainToPromise } from '@/hooks/useQueryList';
import { BatchProgressModal, type BatchTask } from '@/components/common/BatchProgressModal';
import type {
  DataType,
  DeviceSchedule,
  DeviceScheduleAction,
  DeviceScheduleDetail,
  PointDefinition,
} from '@/types/api';

// ── Cron 预设 ───────────────────────────────────────────
const CRON_PRESETS: { key: string; label: string; cron: string; description: string }[] = [
  { key: 'minutely',  label: '每分钟',     cron: '0 * * * * ?',     description: '触发频率最高' },
  { key: 'hourly',    label: '每小时整点',  cron: '0 0 * * * ?',     description: '每小时 0 分' },
  { key: 'daily8',    label: '每天 8 点',   cron: '0 0 8 * * ?',     description: '日常开机' },
  { key: 'daily18',   label: '每天 18 点',  cron: '0 0 18 * * ?',    description: '日常关机' },
  { key: 'weekly1',   label: '每周一 9 点', cron: '0 0 9 ? * MON',   description: '工作日巡检' },
  { key: 'monthly1',  label: '每月 1 号 0 点', cron: '0 0 0 1 * ?',  description: '月度任务' },
];

function cronToText(cron: string): string {
  const p = CRON_PRESETS.find((c) => c.cron === cron);
  if (p) return p.label;
  return cron;
}

// ── Action 草稿（与点位设置对齐的 _key 本地唯一标识） ──
type ActionDraft = {
  _key: string;
  pointId: string;
  pointCode: string;
  pointName: string;
  dataType: DataType;
  valueText: string;
};
const newAction = (): ActionDraft => ({
  _key: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  pointId: '', pointCode: '', pointName: '', dataType: 'STRING', valueText: '',
});

// ── Schedule 草稿 ──
type ScheduleDraft = {
  id?: string;
  name: string;
  cron: string;
  enabled: boolean;
  description: string;
  actions: ActionDraft[];
};
const EMPTY_DRAFT = (): ScheduleDraft => ({
  name: '', cron: '0 0 8 * * ?', enabled: true, description: '', actions: [],
});

/** 序号化命名：name 末尾带" N"则 N+1，否则扫描最大 +1 */
function generateUniqueScheduleName(
  baseName: string,
  rules: DeviceSchedule[],
  drafts: ScheduleDraft[],
): string {
  const trimmed = (baseName || '规则').trim();
  const m = trimmed.match(/^(.*?)\s+(\d+)$/);
  const prefix = m ? m[1] : trimmed;
  const startN = m ? Number(m[2]) + 1 : 1;
  const base = (prefix || '规则').trim();
  const used = new Set<number>();
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)$`);
  for (const r of rules) {
    const rm = r.name?.match(re);
    if (rm) used.add(Number(rm[1]));
  }
  for (const d of drafts) {
    const dm = d.name.match(re);
    if (dm) used.add(Number(dm[1]));
  }
  const maxN = used.size === 0 ? 0 : Math.max(...used);
  let n = Math.max(startN, maxN + 1);
  while (used.has(n)) n += 1;
  return `${base} ${n}`;
}

export interface PointScheduleSectionProps {
  deviceId: string;
  sectionRef: (el: HTMLElement | null) => void;
}
export default function PointScheduleSection({ deviceId, sectionRef }: PointScheduleSectionProps) {
  const queryClient = useQueryClient();

  const { data: scheduleItems = [] } = useQuery<DeviceScheduleDetail[]>({
    queryKey: ['schedules.list.byDevice', deviceId],
    queryFn: () => chainToPromise(listDeviceSchedules(deviceId)),
    enabled: !!deviceId,
  });
  /** 兼容老代码:把新接口形态压平成 DeviceSchedule[] 视图,保留 schedule+actions 内部映射. */
  const schedules: DeviceSchedule[] = useMemo(
    () => scheduleItems.map((it) => it.schedule),
    [scheduleItems],
  );
  const { data: points = [] } = useQuery<PointDefinition[]>({
    queryKey: ['points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });

  // 草稿：现存的修改（按 id 索引）+ 新增 + 待删除
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<ScheduleDraft>>>(new Map());
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  // 进度弹窗
  const [progressOpen, setProgressOpen] = useState(false);
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  // 确认 Modal
  const [confirm, setConfirm] = useState<{ kind: 'discard' | 'delete'; id?: string } | null>(null);

  const visibleSchedules = useMemo(
    () => schedules.filter((s) => s.id && !deletedIds.has(s.id)),
    [schedules, deletedIds],
  );
  const isDirty = pendingChanges.size > 0 || drafts.length > 0 || deletedIds.size > 0;

  /** 合并草稿得到单条规则的最终视图 */
  const getEffective = useCallback((s: DeviceSchedule): ScheduleDraft => {
    const c = pendingChanges.get(s.id!) ?? {};
    return {
      id: s.id,
      name: c.name ?? s.name ?? '',
      cron: c.cron ?? s.cron ?? '',
      enabled: c.enabled ?? s.enabled ?? true,
      description: c.description ?? (s.description ?? ''),
      actions: c.actions ?? [], // 编辑模式从 ServerActions 恢复（见 reloadEffectiveActions）
    };
  }, [pendingChanges]);

  const isSchedDirty = (s: DeviceSchedule) => s.id ? pendingChanges.has(s.id) : false;

  const updateField = useCallback((id: string, changes: Partial<ScheduleDraft>) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const old = next.get(id) ?? {};
      next.set(id, { ...old, ...changes });
      return next;
    });
  }, []);

  const discardSched = useCallback((id: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setDeletedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const markDeleted = useCallback((id: string) => {
    setPendingChanges((prev) => {
      if (prev.has(id)) {
        const next = new Map(prev);
        next.delete(id);
        return next;
      }
      return prev;
    });
    setDeletedIds((prev) => new Set(prev).add(id));
  }, []);

  // 草稿行操作
  const addDraft = (presetCron?: string) => {
    setDrafts((prev) => {
      const seed = { ...EMPTY_DRAFT() };
      if (presetCron) seed.cron = presetCron;
      const name = generateUniqueScheduleName(seed.name, schedules, prev);
      return [...prev, { ...seed, name }];
    });
  };

  const updateDraft = useCallback((idx: number, changes: Partial<ScheduleDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...changes } : d)));
  }, []);
  const removeDraftAt = useCallback((idx: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // 复制：将现存 schedule 转为草稿（保留所有 actions）
  const copySchedule = (source: ScheduleDraft) => {
    setDrafts((prev) => {
      const name = generateUniqueScheduleName(source.name, schedules, prev);
      return [...prev, {
        ...source,
        id: undefined,
        name,
        actions: source.actions.map((a) => ({ ...a, _key: newAction()._key })),
      }];
    });
  };

  // 全部放弃
  const discardAll = () => {
    setPendingChanges(new Map());
    setDrafts([]);
    setDeletedIds(new Set());
  };

  // 提交相关 mutation
  const saveMutation = useApiMutation({
    mutationFn: (body: {
      schedule: Partial<DeviceSchedule>;
      actions: Array<Omit<DeviceScheduleAction, 'pointName'>>;
    }) => saveSchedule(body as unknown as Parameters<typeof saveSchedule>[0]),
  });
  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => deleteSchedule(id),
  });

  /** 构造全部保存任务 */
  const buildTasks = (): BatchTask[] => {
    const tasks: BatchTask[] = [];
    // 删除
    for (const id of deletedIds) {
      const s = schedules.find((x) => x.id === id);
      tasks.push({
        key: `del:${id}`,
        label: `删除 ${s?.name || id}`,
        run: async () => { await deleteMutation.mutateAsync(id); },
      });
    }
    // 更新
    for (const [id, _] of pendingChanges.entries()) {
      const s = schedules.find((x) => x.id === id);
      if (!s) continue;
      const eff = getEffective(s);
      // 拉取原始 actions（因为 pendingChanges.actions 仅在显式编辑时才存在）
      // 这里采取简化策略：更新时复用原 actions，不在表内支持 actions 编辑（actions 仍通过弹窗/Drawer 编辑）
      // 实际项目使用场景：表内只改名称/cron/enabled/description，actions 通过"编辑动作"按钮
      tasks.push({
        key: `upd:${id}`,
        label: `更新 ${eff.name || id}`,
        run: async () => {
          await saveMutation.mutateAsync({
            schedule: {
              id: s.id, deviceId,
              name: eff.name.trim(),
              cron: eff.cron.trim(),
              enabled: eff.enabled,
              description: eff.description.trim() || undefined,
            },
            actions: [], // 留空：不修改 actions
          });
        },
      });
    }
    // 新增
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      tasks.push({
        key: `new:${i}`,
        label: `新增 ${d.name || '未命名规则'}`,
        run: async () => {
          if (d.actions.length === 0) {
            throw new Error('请至少添加一个动作');
          }
          if (d.actions.some((a) => !a.pointId || !a.valueText)) {
            throw new Error('请补全所有动作的点位和值');
          }
          await saveMutation.mutateAsync({
            schedule: {
              deviceId,
              name: d.name.trim(),
              cron: d.cron.trim(),
              enabled: d.enabled,
              description: d.description.trim() || undefined,
            },
            actions: d.actions.map((a, idx) => ({
              pointId: a.pointId,
              pointCode: a.pointCode,
              valueText: a.valueText,
              sortOrder: idx,
            })),
          });
        },
      });
    }
    return tasks;
  };

  const openSaveAll = () => {
    const fail: string[] = [];
    // 更新必填
    for (const [id, _] of pendingChanges.entries()) {
      const s = schedules.find((x) => x.id === id);
      if (!s) continue;
      const eff = getEffective(s);
      if (!eff.name.trim()) fail.push(`更新项 ${id}：名称为空`);
      if (!eff.cron.trim()) fail.push(`更新项 ${id}：Cron 为空`);
    }
    // 新增必填
    for (const d of drafts) {
      if (!d.name.trim()) fail.push(`${d.name || '未命名规则'}：名称为空`);
      if (!d.cron.trim()) fail.push(`${d.name || '未命名规则'}：Cron 为空`);
      if (d.actions.length === 0) fail.push(`${d.name || '未命名规则'}：至少添加一个动作`);
    }
    if (fail.length > 0) {
      addToast({
        title: '请补全必填项',
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
    queryClient.invalidateQueries({ queryKey: ['schedules.list.byDevice', deviceId] });
  };

  // 提醒用户离开未保存
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 草稿行的 action 编辑
  const addActionToDraft = (draftIdx: number) => {
    setDrafts((prev) => prev.map((d, i) => i === draftIdx
      ? { ...d, actions: [...d.actions, newAction()] }
      : d));
  };
  const updateActionInDraft = (draftIdx: number, actionKey: string, patch: Partial<ActionDraft>) => {
    setDrafts((prev) => prev.map((d, i) => i === draftIdx
      ? { ...d, actions: d.actions.map((a) => a._key === actionKey ? { ...a, ...patch } : a) }
      : d));
  };
  const removeActionInDraft = (draftIdx: number, actionKey: string) => {
    setDrafts((prev) => prev.map((d, i) => i === draftIdx
      ? { ...d, actions: d.actions.filter((a) => a._key !== actionKey) }
      : d));
  };

  // 整体行 = 现存（合并草稿 + 排除删除）+ 新增草稿
  const allRows: { kind: 'existing' | 'new'; data: ScheduleDraft; id: string; idx?: number }[] = useMemo(() => {
    const ex = visibleSchedules.map((s) => {
      const eff = getEffective(s);
      return { kind: 'existing' as const, data: eff, id: s.id! };
    });
    const ns = drafts.map((d, i) => ({ kind: 'new' as const, data: d, id: `new-${i}`, idx: i }));
    return [...ex, ...ns];
  }, [visibleSchedules, drafts, getEffective]);

  return (
    <section ref={sectionRef} className="scroll-mt-20 rounded-2xl bg-content1 p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ClockIcon className="h-4 w-4 text-foreground-500" />
        <h2 className="text-base font-medium text-foreground">定时控制</h2>
        <Chip size="sm" variant="flat">{visibleSchedules.length} 条</Chip>
        {isDirty && (
          <Chip size="sm" variant="flat" color="warning">
            {pendingChanges.size + drafts.length + deletedIds.size} 项未保存
          </Chip>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Popover placement="bottom-end">
            <PopoverTrigger>
              <Button size="sm" color="primary" startContent={<PlusIcon className="h-4 w-4" />}>
                添加规则
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="flex flex-col gap-1">
                {CRON_PRESETS.map((p) => (
                  <Button key={p.key} size="sm" variant="flat" className="justify-start"
                    onPress={() => addDraft(p.cron)}>
                    <div className="flex flex-col items-start">
                      <span>{p.label}</span>
                      <span className="text-xs text-foreground-400">{p.description}</span>
                    </div>
                  </Button>
                ))}
                <div className="my-1 border-t border-divider" />
                <Button size="sm" variant="flat" className="justify-start" onPress={() => addDraft()}>
                  自定义
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {isDirty && (
            <>
              <Button size="sm" variant="flat" color="danger"
                onPress={() => setConfirm({ kind: 'discard' })}>
                全部放弃
              </Button>
              <Button size="sm" color="primary" onPress={openSaveAll}>
                全部保存
              </Button>
            </>
          )}
        </div>
      </div>

      {allRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-divider p-8 text-center text-sm text-foreground-400">
          暂无定时规则，点击「添加规则」开始配置
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {allRows.map((row) => {
            const isNew = row.kind === 'new';
            const isDel = !isNew && deletedIds.has(row.id);
            const isExistingDirty = !isNew && isSchedDirty(schedules.find((s) => s.id === row.id)!);
            return (
              <div key={row.id}
                className={`rounded-lg border ${isDel ? 'border-divider opacity-50' : isExistingDirty ? 'border-warning' : 'border-divider'} bg-content2 p-3`}>
                {/* 主行：名称 + cron + 启用 + 操作 */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    size="sm" variant="bordered" placeholder="规则名称"
                    value={row.data.name}
                    isDisabled={isDel}
                    onValueChange={(v) => isNew
                      ? updateDraft(row.idx!, { name: v })
                      : updateField(row.id, { name: v })}
                    className="min-w-40 flex-1" />
                  <Select
                    size="sm" variant="bordered" placeholder="选择执行周期"
                    selectedKeys={row.data.cron ? [row.data.cron] : []}
                    isDisabled={isDel}
                    onSelectionChange={(keys) => {
                      const v = Array.from(keys)[0] as string ?? '';
                      isNew ? updateDraft(row.idx!, { cron: v }) : updateField(row.id, { cron: v });
                    }}
                    className="w-48"
                  >
                    {CRON_PRESETS.map((p) => (
                      <SelectItem key={p.cron} description={p.description}>{p.label}</SelectItem>
                    ))}
                  </Select>
                  <Switch size="sm" isSelected={row.data.enabled} isDisabled={isDel}
                    onValueChange={(v) => isNew
                      ? updateDraft(row.idx!, { enabled: v })
                      : updateField(row.id, { enabled: v })} />
                  <div className="ml-auto flex gap-1">
                    {isNew ? (
                      <>
                        <Tooltip content="保存">
                          <Button isIconOnly size="sm" variant="flat" color="success"
                            isDisabled={!row.data.name.trim() || !row.data.cron.trim() || row.data.actions.length === 0}
                            onPress={async () => {
                              const d = row.data;
                              try {
                                await saveMutation.mutateAsync({
                                  schedule: {
                                    deviceId,
                                    name: d.name.trim(),
                                    cron: d.cron.trim(),
                                    enabled: d.enabled,
                                    description: d.description.trim() || undefined,
                                  },
                                  actions: d.actions.map((a, i) => ({
                                    pointId: a.pointId,
                                    pointCode: a.pointCode,
                                    valueText: a.valueText,
                                    sortOrder: i,
                                  })),
                                });
                                addToast({ title: '规则已保存', color: 'success' });
                                removeDraftAt(row.idx!);
                                queryClient.invalidateQueries({ queryKey: ['schedules.list.byDevice', deviceId] });
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : String(e);
                                addToast({ title: `保存失败：${msg}`, color: 'danger' });
                              }
                            }}>
                            <CheckCircleIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="复制此规则">
                          <Button isIconOnly size="sm" variant="light" color="primary"
                            onPress={() => copySchedule(row.data)}>
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="移除">
                          <Button isIconOnly size="sm" variant="light" color="danger"
                            onPress={() => removeDraftAt(row.idx!)}>
                            <XMarkIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </>
                    ) : isExistingDirty ? (
                      <>
                        <Tooltip content="保存修改">
                          <Button isIconOnly size="sm" variant="flat" color="success"
                            onPress={async () => {
                              const s = schedules.find((x) => x.id === row.id)!;
                              const eff = getEffective(s);
                              try {
                                await saveMutation.mutateAsync({
                                  schedule: {
                                    id: s.id, deviceId,
                                    name: eff.name.trim(),
                                    cron: eff.cron.trim(),
                                    enabled: eff.enabled,
                                    description: eff.description.trim() || undefined,
                                  },
                                  actions: [],
                                });
                                addToast({ title: '规则已更新', color: 'success' });
                                discardSched(s.id!);
                                queryClient.invalidateQueries({ queryKey: ['schedules.list.byDevice', deviceId] });
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : String(e);
                                addToast({ title: `更新失败：${msg}`, color: 'danger' });
                              }
                            }}>
                            <CheckCircleIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="撤销修改">
                          <Button isIconOnly size="sm" variant="light"
                            onPress={() => discardSched(row.id)}>
                            <XMarkIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip content="复制此规则">
                          <Button isIconOnly size="sm" variant="light" color="primary"
                            onPress={() => copySchedule(row.data)}>
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="删除">
                          <Button isIconOnly size="sm" variant="light" color="danger"
                            onPress={() => markDeleted(row.id)}>
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>

                {/* 备注（折叠显示） */}
                {(row.data.description || isNew) && (
                  <Textarea
                    size="sm" variant="bordered" placeholder="备注（可选）" minRows={1}
                    value={row.data.description}
                    isDisabled={isDel}
                    onValueChange={(v) => isNew
                      ? updateDraft(row.idx!, { description: v })
                      : updateField(row.id, { description: v })}
                    className="mt-2" />
                )}

                {/* Actions 子表 - 只在草稿行展开（新增时编辑）*/}
                {isNew && (
                  <div className="mt-2 rounded-lg border border-divider p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground-500">
                        动作（{row.data.actions.length}）
                      </span>
                      <Button size="sm" variant="flat" startContent={<PlusIcon className="h-3 w-3" />}
                        onPress={() => addActionToDraft(row.idx!)}>
                        添加动作
                      </Button>
                    </div>
                    {row.data.actions.length === 0 ? (
                      <div className="rounded border border-dashed border-divider py-3 text-center text-xs text-foreground-400">
                        尚未添加动作
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {row.data.actions.map((a, ai) => (
                          <div key={a._key} className="flex items-end gap-1.5">
                            <Chip size="sm" variant="flat">{ai + 1}</Chip>
                            <Select size="sm" variant="bordered" aria-label="点位" placeholder="选择点位"
                              selectedKeys={a.pointId ? [a.pointId] : []}
                              onSelectionChange={(keys) => {
                                const pid = Array.from(keys)[0] as string;
                                const p = points.find((x) => x.id === pid);
                                updateActionInDraft(row.idx!, a._key, {
                                  pointId: pid,
                                  pointCode: p?.pointCode ?? '',
                                  pointName: p?.pointName ?? '',
                                  dataType: p?.dataType ?? 'STRING',
                                });
                              }}
                              items={points.map((p) => ({ key: p.id, label: `${p.pointName} (${p.pointCode})` }))}
                              className="min-w-0 flex-1">
                              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                            </Select>
                            <Input size="sm" variant="bordered" placeholder={a.dataType === 'BOOL' ? 'true / false' : '值'}
                              value={a.valueText} className="w-28"
                              onValueChange={(v) => updateActionInDraft(row.idx!, a._key, { valueText: v })} />
                            <Tooltip content="删除该动作">
                              <Button isIconOnly size="sm" variant="light" color="danger"
                                onPress={() => removeActionInDraft(row.idx!, a._key)}>
                                <TrashIcon className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 现存 schedule 显示动作只读 */}
                {!isNew && !isDel && (() => {
                  // 从原始 schedules 列表找 actions（这里 list 接口只返回 DeviceSchedule，没有 actions）
                  // 由于 listDeviceSchedules 当前只返回 schedule 不含 actions，暂时不可见；
                  // 提示用户去编辑页查看。
                  return null;
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* 全部放弃确认 */}
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
        title="正在批量保存定时规则"
        tasks={batchTasks}
        onClose={() => setProgressOpen(false)}
        onComplete={onBatchComplete}
      />
    </section>
  );
}
