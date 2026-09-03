import { EditableSectionLayout } from '@/components/common/EditableSectionLayout';
import { PointScheduleCard } from './cards/PointScheduleCard';
import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClockIcon,
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
  DeviceScheduleDetail,
  PointDefinition,
} from '@/types/api';

// ── Action 草稿（与点位设置对齐的 _key 本地唯一标识） ──
export type ActionDraft = {
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
    // 从 scheduleItems 恢复原始 actions（带 _key）
    const original = scheduleItems.find((it) => it.schedule.id === s.id);
    const originalActions: ActionDraft[] = (original?.schedule.actions ?? []).map((a, i) => ({
      _key: `orig_${s.id}_${i}`,
      pointId: a.pointId ?? '',
      pointCode: a.pointCode ?? '',
      pointName: '',
      dataType: 'STRING' as const,
      valueText: a.valueText ?? '',
    }));
    return {
      id: s.id,
      name: c.name ?? s.name ?? '',
      cron: c.cron ?? s.cron ?? '',
      enabled: c.enabled ?? s.enabled ?? true,
      description: c.description ?? (s.description ?? ''),
      actions: c.actions ?? originalActions,
    };
  }, [pendingChanges, scheduleItems]);

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
    mutationFn: (body: DeviceScheduleDetail) => saveSchedule(body),
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
              actions: eff.actions.map((a, idx) => ({
                pointId: a.pointId,
                pointCode: a.pointCode,
                valueText: a.valueText,
                sortOrder: idx,
              })),
            },
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
              actions: d.actions.map((a, idx) => ({
                pointId: a.pointId,
                pointCode: a.pointCode,
                valueText: a.valueText,
                sortOrder: idx,
              })),
            },
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

  // 现有行的 action 编辑（通过 pendingChanges 追踪）
  const addActionToExisting = (scheduleId: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const old = next.get(scheduleId) ?? {};
      const existing = (old.actions ?? getEffective(schedules.find((s) => s.id === scheduleId)!).actions);
      next.set(scheduleId, { ...old, actions: [...existing, newAction()] });
      return next;
    });
  };
  const updateActionInExisting = (scheduleId: string, actionKey: string, patch: Partial<ActionDraft>) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const old = next.get(scheduleId) ?? {};
      const existing = (old.actions ?? getEffective(schedules.find((s) => s.id === scheduleId)!).actions);
      next.set(scheduleId, { ...old, actions: existing.map((a) => a._key === actionKey ? { ...a, ...patch } : a) });
      return next;
    });
  };
  const removeActionFromExisting = (scheduleId: string, actionKey: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const old = next.get(scheduleId) ?? {};
      const existing = (old.actions ?? getEffective(schedules.find((s) => s.id === scheduleId)!).actions);
      next.set(scheduleId, { ...old, actions: existing.filter((a) => a._key !== actionKey) });
      return next;
    });
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
    <EditableSectionLayout
      ref={sectionRef}
      title="定时控制"
      icon={<ClockIcon className="h-4 w-4 text-foreground-500" />}
      countLabel={`${visibleSchedules.length} 条`}
      hasUnsaved={isDirty}
      unsavedCount={pendingChanges.size + drafts.length + deletedIds.size}
      onSaveAll={openSaveAll}
      onDiscardAll={() => setConfirm({ kind: 'discard' })}
      isSaving={progressOpen}
      onAddRow={() => addDraft()}
      addRowLabel="添加规则"
    >
      {allRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-divider p-8 text-center text-sm text-foreground-400">
          暂无定时规则，点击「添加规则」开始配置
        </div>
      ) : (
        <div className="grid grid-cols-1 ">
          {allRows.map((row) => {
            const isNew = row.kind === 'new';
            const isDel = !isNew && deletedIds.has(row.id);
            const isExistingDirty = !isNew && isSchedDirty(schedules.find((s) => s.id === row.id)!);
            return (
              <PointScheduleCard
                key={row.id}
                row={row.data}
                isNew={isNew}
                isDirty={isNew || isExistingDirty}
                isSaving={false}
                isDeleted={isDel}
                points={points}
                onChange={(patch) => isNew
                  ? updateDraft(row.idx!, patch as Partial<ScheduleDraft>)
                  : updateField(row.id, patch as Partial<ScheduleDraft>)}
                onAddAction={isNew ? () => addActionToDraft(row.idx!) : () => addActionToExisting(row.id)}
                onRemoveAction={isNew ? (key) => removeActionInDraft(row.idx!, key) : (key) => removeActionFromExisting(row.id, key)}
                onUpdateAction={isNew ? (key, patch) => updateActionInDraft(row.idx!, key, patch) : (key, patch) => updateActionInExisting(row.id, key, patch)}
                onSave={ async () => {
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
                        actions: eff.actions.map((a, idx) => ({
                          pointId: a.pointId,
                          pointCode: a.pointCode,
                          valueText: a.valueText,
                          sortOrder: idx,
                        })),
                      },
                    });
                    addToast({ title: '规则已更新', color: 'success' });
                    discardSched(s.id!);
                    queryClient.invalidateQueries({ queryKey: ['schedules.list.byDevice', deviceId] });
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    addToast({ title: `更新失败：${msg}`, color: 'danger' });
                  }
                }}
                onDiscard={() => isNew ? removeDraftAt(row.idx!) : discardSched(row.id)}
                onCopy={() => copySchedule(row.data)}
                onDelete={() => isNew ? removeDraftAt(row.idx!) : markDeleted(row.id)}
              />
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
    </EditableSectionLayout>
  );
}
