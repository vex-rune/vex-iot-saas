import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Select,
  SelectItem,
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
  ChartBarIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  Bars3Icon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { ValueMappingsCell } from '@/components/ValueMappingsCell';
import { PresetAddButtons } from '@/components/PresetAddButtons';
import {
  getDevicePoints,
  savePoint,
  deletePoint,
  sortDevicePoints,
} from '@/api/devices';
import { useApiMutation } from '@/hooks/useApiMutation';
import { chainToPromise } from '@/hooks/useQueryList';
import type { AccessType, DataType, PointDefinition } from '@/types/api';
import {
  ACCESS_LABELS,
  ACCESS_TYPES,
  ALL_PRESETS,
  DATA_TYPES,
  POINT_PRESET_GROUPS,
  generateUniquePointCode,
  generateUniquePointName,
  isPointCodeConflict,
  parseValueMappings,
  pickRowFields,
  serializeValueMappings,
} from './pointUtils';
import type { PointRow } from './pointUtils';

const toRow = (p: PointDefinition): PointRow => ({
  _key: p.id,
  pointName: p.pointName ?? '',
  pointCode: p.pointCode,
  description: p.description ?? '',
  unit: p.unit ?? '',
  dataType: p.dataType,
  access: p.access,
  groupLabel: p.groupLabel ?? '',
  valueMappings: parseValueMappings(p.valueMappings),
});

// 主组件
export interface PointSettingsSectionProps {
  deviceId: string;
  sectionRef: (el: HTMLElement | null) => void;
}

export default function PointSettingsSection({ deviceId, sectionRef }: PointSettingsSectionProps) {
  const queryClient = useQueryClient();

  const { data: existingPoints = [] } = useQuery<PointDefinition[]>({
    queryKey: ['points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });

  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<PointRow>>>(new Map());
  const [newRows, setNewRows] = useState<PointRow[]>([]);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // 有未保存内容时阻止意外离开页面
  const hasUnsavedPoints = pendingChanges.size > 0 || newRows.length > 0;
  useEffect(() => {
    if (!hasUnsavedPoints) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedPoints]);

  const pointSaveMutation = useApiMutation({ mutationFn: (data: Partial<PointDefinition>) => savePoint(data) });
  const pointDeleteMutation = useApiMutation({ mutationFn: (pointId: string) => deletePoint(pointId) });

  // 现有点位变更
  const handleExistingPointChange = useCallback((pointId: string, changes: Partial<PointDefinition>) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.set(pointId, { ...(next.get(pointId) ?? {}), ...pickRowFields(changes) });
      return next;
    });
  }, []);

  const handleExistingPointSave = useCallback(async (pointId: string) => {
    const changes = pendingChanges.get(pointId);
    if (!changes) return;
    setSavingKeys((prev) => new Set(prev).add(pointId));
    try {
      const saved = await pointSaveMutation.mutateAsync({ id: pointId, deviceId, ...changes } as Partial<PointDefinition>);
      setPendingChanges((prev) => { const next = new Map(prev); next.delete(pointId); return next; });
      queryClient.setQueryData<PointDefinition[]>(
        ['points', deviceId],
        (prev) => (prev ?? []).map((p) => (p.id === pointId ? { ...p, ...saved } : p)),
      );
      addToast({ title: '点位已保存', color: 'success' });
    } catch {
      addToast({ title: '点位保存失败', color: 'danger' });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(pointId);
        return next;
      });
    }
  }, [pendingChanges, pointSaveMutation, deviceId, queryClient]);

  const handleExistingPointDiscard = useCallback((pointId: string) => {
    setPendingChanges((prev) => { const next = new Map(prev); next.delete(pointId); return next; });
  }, []);

  // 批量保存：现有修改 + 新增点位 逐条提交，弹出进度弹窗
  interface BatchItem {
    /** 任务唯一标识：现有点位用 id，新增用 _key */
    key: string;
    /** 展示名（失败时定位用） */
    label: string;
    /** 请求 payload（已合并到最终值） */
    payload: Partial<PointDefinition>;
  }
  const [batchProgress, setBatchProgress] = useState<{
    open: boolean;
    total: number;
    done: number;
    currentLabel: string;
    failed: { key: string; label: string; error: string }[];
  }>({ open: false, total: 0, done: 0, currentLabel: '', failed: [] });

  // 关闭进度弹窗
  const closeBatchProgress = useCallback(() => {
    setBatchProgress((p) => ({ ...p, open: false }));
  }, []);

  const handleBulkDiscard = useCallback(() => {
    if (!hasUnsavedPoints) return;
    if (pendingChanges.size > 0 && newRows.length > 0) {
      if (!confirm(`确认放弃 ${pendingChanges.size} 条修改和 ${newRows.length} 条新增？`)) return;
    } else if (pendingChanges.size > 0) {
      if (!confirm(`确认放弃 ${pendingChanges.size} 条修改？`)) return;
    } else if (newRows.length > 0) {
      if (!confirm(`确认放弃 ${newRows.length} 条新增？`)) return;
    }
    setPendingChanges(new Map());
    setNewRows([]);
  }, [hasUnsavedPoints, pendingChanges.size, newRows.length]);

  const handleBulkSave = useCallback(async () => {
    if (!hasUnsavedPoints) return;

    // 收集待保存项（先校验新增必填）
    const items: BatchItem[] = [];
    for (const [pointId, changes] of pendingChanges.entries()) {
      const orig = existingPoints.find((p) => p.id === pointId);
      if (!orig) continue;
      items.push({
        key: pointId,
        label: orig.pointName ?? '',
        payload: { id: pointId, deviceId, ...changes } as Partial<PointDefinition>,
      });
    }
    newRows.forEach((row, i) => {
      if (!row.pointName.trim() || !row.pointCode.trim()) {
        // 必填失败：跳过（在进度里追加失败项）
        return;
      }
      items.push({
        key: row._key,
        label: row.pointName.trim() || `新增点位 ${i + 1}`,
        payload: {
          deviceId,
          pointName: row.pointName.trim(),
          pointCode: row.pointCode.trim(),
          description: row.description.trim() || undefined,
          unit: row.unit.trim() || undefined,
          dataType: row.dataType,
          access: row.access,
          groupLabel: row.groupLabel.trim() || undefined,
          valueMappings: serializeValueMappings(row.valueMappings),
        },
      });
    });

    // 校验名称/编码为空的新增行
    const failed: { key: string; label: string; error: string }[] = newRows
      .filter((r) => !r.pointName.trim() || !r.pointCode.trim())
      .map((r) => ({
        key: r._key,
        label: r.pointName.trim() || r.pointCode.trim() || '未命名',
        error: !r.pointName.trim() ? '点位名称为空' : '点位编码为空',
      }));

    // 校验编码唯一性
    for (const r of newRows) {
      if (!r.pointName.trim() || !r.pointCode.trim()) continue;
      if (isPointCodeConflict(r, existingPoints, newRows)) {
        failed.push({
          key: r._key,
          label: r.pointName.trim() || r.pointCode.trim(),
          error: `点位编码「${r.pointCode.trim()}」已存在（同设备内 pointCode 必须唯一）`,
        });
      }
    }

    if (items.length === 0 && failed.length === 0) return;
    if (items.length === 0) {
      // 全部新增行都缺必填字段，逐条提示
      setBatchProgress({
        open: true,
        total: failed.length,
        done: failed.length,
        currentLabel: '',
        failed,
      });
      return;
    }

    setBatchProgress({
      open: true,
      total: items.length,
      done: 0,
      currentLabel: items[0]?.label ?? '',
      failed,
    });

    const savedSuccess: PointDefinition[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setBatchProgress((p) => ({ ...p, currentLabel: it.label }));
      try {
        const saved = await pointSaveMutation.mutateAsync(it.payload);
        savedSuccess.push(saved);
        setBatchProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : '保存失败';
        setBatchProgress((p) => ({
          ...p,
          done: p.done + 1,
          failed: [...p.failed, { key: it.key, label: it.label, error: msg }],
        }));
      }
    }

    // 把成功的合并回本地缓存
    if (savedSuccess.length > 0) {
      queryClient.setQueryData<PointDefinition[]>(['points', deviceId], (prev) => {
        const list = [...(prev ?? [])];
        for (const s of savedSuccess) {
          const idx = list.findIndex((p) => p.id === s.id);
          if (idx >= 0) list[idx] = { ...list[idx], ...s };
          else list.push(s);
        }
        return list;
      });
    }
    // 清掉现有改动（全部走批量保存，要么成功要么失败，无须再保留）
    setPendingChanges(new Map());
    // 新增：按"已成功保存的名字"从 newRows 里剔除
    const savedNewNames = new Set(
      savedSuccess
        .filter((s) => !existingPoints.find((p) => p.id === s.id))
        .map((s) => s.pointName?.trim() ?? ''),
    );
    setNewRows((prev) =>
      prev.filter((r) => !savedNewNames.has(r.pointName.trim()) && !failed.some((f) => f.key === r._key)),
    );
  }, [hasUnsavedPoints, pendingChanges, newRows, existingPoints, deviceId, pointSaveMutation, queryClient]);

  const handleExistingPointDelete = useCallback(async (pointId: string) => {
    const target = existingPoints.find((p) => p.id === pointId);
    if (!confirm(`确认删除点位「${target?.pointName ?? pointId}」？`)) return;
    try {
      await pointDeleteMutation.mutateAsync(pointId);
      setPendingChanges((prev) => { const next = new Map(prev); next.delete(pointId); return next; });
      queryClient.setQueryData<PointDefinition[]>(
        ['points', deviceId],
        (prev) => (prev ?? []).filter((p) => p.id !== pointId),
      );
      addToast({ title: '点位已删除', color: 'success' });
    } catch {
      addToast({ title: '删除失败', color: 'danger' });
    }
  }, [pointDeleteMutation, existingPoints, queryClient, deviceId]);

  // 新增点位
  const pendingRef = useRef<HTMLDivElement | null>(null);
  const scrollToPending = () => {
    // 等待新行渲染完成后再滚动（block: nearest 避免连续添加时反复跳动）
    setTimeout(() => pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };
  /**
   * "空行"默认值：复用 generateUniquePointCode/Name，
   * 首次点 → 点位 1 / point_1；之后每次 +1
   */
  const makeBlankRow = (
    existingPoints: PointDefinition[],
    newRows: PointRow[],
  ): PointRow => {
    return {
      _key: crypto.randomUUID(),
      pointName: generateUniquePointName('', existingPoints, newRows),
      pointCode: generateUniquePointCode('', existingPoints, newRows),
      description: '',
      unit: '',
      dataType: 'INT',
      access: 'RO',
      groupLabel: '',
      valueMappings: [],
    };
  };

  const addNewRow = () => {
    setNewRows((prev) => [...prev, makeBlankRow(existingPoints, prev)]);
    scrollToPending();
  };
  const addPresetRow = (presetKey: string) => {
    const preset = ALL_PRESETS.find((p) => p.key === presetKey);
    if (!preset) {
      addNewRow();
      return;
    }
    // 编码 + 名称都按"序号化"规则自动 +1（与"空行"按钮行为一致）
    setNewRows((prev) => {
      const pointCode = generateUniquePointCode(preset.defaults.pointCode, existingPoints, prev);
      const pointName = generateUniquePointName(preset.defaults.pointName, existingPoints, prev);
      return [...prev, {
        _key: crypto.randomUUID(),
        ...preset.defaults,
        pointCode,
        pointName,
      }];
    });
    scrollToPending();
  };

  /**
   * 复制点位：
   * - 复制全部字段（id 留空，server 会按 deviceId+pointCode 生成）
   * - 编码和名称用"序号化"规则：若本身带序号则 +1，撞了再 +1 找空位
   * - 既支持"空行/快捷添加"统一规则，也支持"已带序号"的复制场景
   */
  const copyPoint = (source: PointRow) => {
    setNewRows((prev) => {
      const pointCode = generateUniquePointCode(source.pointCode, existingPoints, prev);
      const pointName = generateUniquePointName(source.pointName, existingPoints, prev);
      return [...prev, {
        ...source,
        _key: crypto.randomUUID(),
        pointCode,
        pointName,
      }];
    });
    scrollToPending();
  };
  const removeNewRow = (key: string) => setNewRows((prev) => prev.filter((r) => r._key !== key));
  const handleNewPointChange = useCallback((key: string, changes: Partial<PointDefinition>) => {
    setNewRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...pickRowFields(changes) } as PointRow : r)));
  }, []);
  const saveOneNewPoint = async (key: string) => {
    const target = newRows.find((r) => r._key === key);
    if (!target) return;
    if (!target.pointName.trim()) {
      addToast({ title: '请填写点位名称', color: 'warning' });
      return;
    }
    if (!target.pointCode.trim()) {
      addToast({ title: '请填写点位编码（MQTT 标识）', color: 'warning' });
      return;
    }
    if (isPointCodeConflict(target, existingPoints, newRows)) {
      addToast({
        title: `点位编码「${target.pointCode.trim()}」已存在`,
        description: '同设备内 pointCode 必须唯一',
        color: 'warning',
      });
      return;
    }
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      const saved = await pointSaveMutation.mutateAsync({
        deviceId,
        pointName: target.pointName.trim(),
        pointCode: target.pointCode.trim(),
        description: target.description.trim() || undefined,
        unit: target.unit.trim() || undefined,
        dataType: target.dataType,
        access: target.access,
        groupLabel: target.groupLabel.trim() || undefined,
        valueMappings: serializeValueMappings(target.valueMappings),
      });
      queryClient.setQueryData<PointDefinition[]>(
        ['points', deviceId],
        (prev) => [...(prev ?? []), saved],
      );
      setNewRows((prev) => prev.filter((r) => r._key !== key));
      addToast({ title: `已保存点位：${saved.pointName}`, color: 'success' });
    } catch {
      addToast({ title: '点位保存失败', color: 'danger' });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // 派生数据
  const getPointFinal = (p: PointDefinition): PointRow => {
    const override = pendingChanges.get(p.id);
    if (!override) return toRow(p);
    return { ...toRow(p), ...override } as PointRow;
  };
  const visibleExisting = existingPoints;

  const [pointFilter, setPointFilter] = useState<{
    name: string;
    dataType: 'all' | DataType;
    access: 'all' | AccessType;
    group: string;
  }>({ name: '', dataType: 'all', access: 'all', group: 'all' });
  const [pointSortBy, setPointSortBy] = useState<'order' | 'name' | 'dataType' | 'pointCode' | 'unit' | 'groupKey' | 'groupLabel'>('order');
  // 拖拽自定序：用户拖动后形成的纯手动顺序（覆盖快捷排序）
  // key = pointId, value = 用户给定的目标顺序下标
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  // 拖拽中临时高亮 + 源/目标
  const [dragState, setDragState] = useState<{ fromId: string | null; overId: string | null }>({ fromId: null, overId: null });

  // 与持久化顺序对比：有差异即脏，显示保存按钮
  const isOrderDirty = useMemo(() => {
    if (!manualOrder) return false;
    const current = visibleExisting.map((p) => p.id);
    // 要求 manualOrder 是 visibleExisting 的一个排列
    if (manualOrder.length !== current.length) return false;
    const set = new Set(current);
    if (!manualOrder.every((id) => set.has(id))) return false;
    return manualOrder.some((id, i) => id !== current[i]);
  }, [manualOrder, visibleExisting]);

  const handleSaveSort = useCallback(async () => {
    if (!manualOrder) return;
    try {
      await chainToPromise(sortDevicePoints(deviceId, manualOrder));
      // 同步本地缓存的 sortOrder（按 manualOrder 下标赋 0..n-1）
      queryClient.setQueryData<PointDefinition[]>(['points', deviceId], (prev) => {
        if (!prev) return prev;
        return prev.map((p) => {
          const idx = manualOrder.indexOf(p.id);
          return idx >= 0 ? { ...p, sortOrder: idx } : p;
        });
      });
      addToast({ title: '排序已保存', color: 'success' });
      setManualOrder(null);
    } catch {
      addToast({ title: '排序保存失败', color: 'danger' });
    }
  }, [manualOrder, deviceId, queryClient]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    visibleExisting.forEach((p) => {
      const g = getPointFinal(p).groupLabel;
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [visibleExisting, pendingChanges]);

  const orderedPoints = useMemo(() => {
    let arr: PointDefinition[];
    if (manualOrder) {
      // 用户手动拖拽/快捷排序产生的顺序：覆盖所有快捷排序
      const map = new Map(visibleExisting.map((p) => [p.id, p] as const));
      arr = manualOrder.map((id) => map.get(id)).filter((p): p is PointDefinition => !!p);
    } else {
      arr = [...visibleExisting];
    }

    // 快捷排序：所有键都以 pointName 作为二级排序
    const byName = (a: PointDefinition, b: PointDefinition) =>
      (a.pointName ?? '').localeCompare(b.pointName ?? '', 'zh-Hans-CN');
    const finalRow = (p: PointDefinition) => getPointFinal(p);
    const cmp = (key: (a: PointDefinition, b: PointDefinition) => number) => (a: PointDefinition, b: PointDefinition) => {
      const r = key(a, b);
      return r !== 0 ? r : byName(a, b);
    };
    switch (pointSortBy) {
      case 'name':
        arr.sort(byName);
        break;
      case 'dataType':
        arr.sort(cmp((a, b) => finalRow(a).dataType.localeCompare(finalRow(b).dataType)));
        break;
      case 'pointCode':
        arr.sort(cmp((a, b) => (finalRow(a).pointCode ?? '').localeCompare(finalRow(b).pointCode ?? '', 'zh-Hans-CN')));
        break;
      case 'unit':
        arr.sort(cmp((a, b) => (finalRow(a).unit ?? '').localeCompare(finalRow(b).unit ?? '', 'zh-Hans-CN')));
        break;
      case 'groupKey':
        arr.sort(cmp((a, b) => (finalRow(a).groupKey ?? '').localeCompare(finalRow(b).groupKey ?? '', 'zh-Hans-CN')));
        break;
      case 'groupLabel':
        arr.sort(cmp((a, b) => (finalRow(a).groupLabel ?? '').localeCompare(finalRow(b).groupLabel ?? '', 'zh-Hans-CN')));
        break;
      case 'order':
      default:
        // 默认顺序：按 sortOrder → 无值则按 pointCode
        arr.sort((a, b) => {
          const sa = a.sortOrder ?? Number.POSITIVE_INFINITY;
          const sb = b.sortOrder ?? Number.POSITIVE_INFINITY;
          if (sa !== sb) return sa - sb;
          return (a.pointCode ?? '').localeCompare(b.pointCode ?? '', 'zh-Hans-CN');
        });
        break;
    }
    return arr;
  }, [visibleExisting, pendingChanges, pointSortBy, manualOrder]);

  const filteredPoints = useMemo(() => {
    const name = pointFilter.name.trim().toLowerCase();
    return orderedPoints.filter((p) => {
      const row = getPointFinal(p);
      if (name && !(p.pointName ?? '').toLowerCase().includes(name) && !(p.pointCode ?? '').toLowerCase().includes(name)) return false;
      if (pointFilter.dataType !== 'all' && row.dataType !== pointFilter.dataType) return false;
      if (pointFilter.access !== 'all' && row.access !== pointFilter.access) return false;
      if (pointFilter.group !== 'all' && row.groupLabel !== pointFilter.group) return false;
      return true;
    });
  }, [orderedPoints, pointFilter, pendingChanges]);

  return (
    <section ref={sectionRef} className="scroll-mt-20 rounded-2xl bg-content1 p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ChartBarIcon className="h-4 w-4 text-foreground-500" />
        <h2 className="text-base font-medium text-foreground">点位设置</h2>
        <Chip size="sm" variant="flat">{visibleExisting.length + newRows.length} 个</Chip>
        {hasUnsavedPoints && (
          <Chip size="sm" variant="flat" color="warning">
            {pendingChanges.size + newRows.length} 项未保存
          </Chip>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {hasUnsavedPoints && (
            <>
              <Button
                size="sm"
                variant="flat"
                color="default"
                isDisabled={batchProgress.open}
                onPress={handleBulkDiscard}
              >
                全部放弃
              </Button>
              <Button
                size="sm"
                color="primary"
                isDisabled={batchProgress.open}
                onPress={handleBulkSave}
              >
                全部保存（{pendingChanges.size + newRows.length}）
              </Button>
            </>
          )}
          <PresetAddButtons
            groups={POINT_PRESET_GROUPS}
            onAddPreset={addPresetRow}
            onAddBlank={addNewRow}
          />
        </div>
      </div>

      {/* 筛选/排序条 */}
      {visibleExisting.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input size="sm" placeholder="搜索名称/编码" variant="bordered"
            className="w-40" value={pointFilter.name}
            onValueChange={(v) => setPointFilter((f) => ({ ...f, name: v }))} />
          <Select size="sm" variant="bordered" aria-label="数据类型筛选" className="w-28"
            selectedKeys={[pointFilter.dataType]}
            onSelectionChange={(keys) => setPointFilter((f) => ({
              ...f, dataType: Array.from(keys)[0] as 'all' | DataType,
            }))}
            items={[{ key: 'all', label: '全部类型' }, ...DATA_TYPES.map((t) => ({ key: t, label: t }))]}>
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
          <Select size="sm" variant="bordered" aria-label="访问类型筛选" className="w-24"
            selectedKeys={[pointFilter.access]}
            onSelectionChange={(keys) => setPointFilter((f) => ({
              ...f, access: Array.from(keys)[0] as 'all' | AccessType,
            }))}
            items={[{ key: 'all', label: '全部' }, ...ACCESS_TYPES.map((t) => ({ key: t, label: ACCESS_LABELS[t] }))]}>
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
          <Select size="sm" variant="bordered" aria-label="分组筛选" className="w-32"
            selectedKeys={[pointFilter.group]}
            onSelectionChange={(keys) => setPointFilter((f) => ({
              ...f, group: Array.from(keys)[0] as string,
            }))}
            items={[{ key: 'all', label: '全部分组' }, ...availableGroups.map((g) => ({ key: g, label: g }))]}>
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
          <Select size="sm" variant="bordered" aria-label="排序方式" className="w-32"
            selectedKeys={[pointSortBy]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0] as typeof pointSortBy;
              setPointSortBy(next);
              // 切换快捷排序时，把当前结果作为手动序，便于保存
              if (next === 'order') {
                setManualOrder(null);
              } else {
                // 根据现有 arr 重新计算（用当前 manualOrder 作为输入）
                const baseOrder = manualOrder ?? visibleExisting
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? Number.POSITIVE_INFINITY) - (b.sortOrder ?? Number.POSITIVE_INFINITY))
                  .map((p) => p.id);
                const map = new Map(visibleExisting.map((p) => [p.id, p] as const));
                const arr = baseOrder.map((id) => map.get(id)).filter((p): p is PointDefinition => !!p);
                const byName = (a: PointDefinition, b: PointDefinition) =>
                  (a.pointName ?? '').localeCompare(b.pointName ?? '', 'zh-Hans-CN');
                const finalRow = (p: PointDefinition) => getPointFinal(p);
                const cmp = (k: (a: PointDefinition, b: PointDefinition) => number) =>
                  (a: PointDefinition, b: PointDefinition) => {
                    const r = k(a, b);
                    return r !== 0 ? r : byName(a, b);
                  };
                switch (next) {
                  case 'name': arr.sort(byName); break;
                  case 'dataType': arr.sort(cmp((a, b) => finalRow(a).dataType.localeCompare(finalRow(b).dataType))); break;
                  case 'pointCode': arr.sort(cmp((a, b) => (finalRow(a).pointCode ?? '').localeCompare(finalRow(b).pointCode ?? '', 'zh-Hans-CN'))); break;
                  case 'unit': arr.sort(cmp((a, b) => (finalRow(a).unit ?? '').localeCompare(finalRow(b).unit ?? '', 'zh-Hans-CN'))); break;
                  case 'groupKey': arr.sort(cmp((a, b) => (finalRow(a).groupKey ?? '').localeCompare(finalRow(b).groupKey ?? '', 'zh-Hans-CN'))); break;
                  case 'groupLabel': arr.sort(cmp((a, b) => (finalRow(a).groupLabel ?? '').localeCompare(finalRow(b).groupLabel ?? '', 'zh-Hans-CN'))); break;
                }
                const newOrder = arr.map((p) => p.id);
                // 如果与默认一致，置空（无变化）；否则登记为 manualOrder 触发脏
                const defaultOrder = visibleExisting
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? Number.POSITIVE_INFINITY) - (b.sortOrder ?? Number.POSITIVE_INFINITY))
                  .map((p) => p.id);
                const sameAsDefault = newOrder.every((id, i) => id === defaultOrder[i]);
                setManualOrder(sameAsDefault ? null : newOrder);
              }
            }}
            items={[
              { key: 'order', label: '默认排序' },
              { key: 'name', label: '按名称' },
              { key: 'dataType', label: '按类型' },
              { key: 'pointCode', label: '按点位编码' },
              { key: 'unit', label: '按单位' },
              { key: 'groupKey', label: '按分组键' },
              { key: 'groupLabel', label: '按分组名' },
            ]}>
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
          {isOrderDirty && (
            <Button size="sm" color="primary" variant="flat" onPress={handleSaveSort}>
              保存排序
            </Button>
          )}
          <Chip size="sm" variant="flat">显示 {filteredPoints.length}/{visibleExisting.length}</Chip>
        </div>
      )}

      {/* 现有点位 */}
      {visibleExisting.length > 0 && (
        <div className="mb-4 overflow-auto rounded-lg border border-divider">
          <Table aria-label="现有点位" removeWrapper>
            <TableHeader>
              <TableColumn className="w-10">{''}</TableColumn>
              <TableColumn>名称</TableColumn>
              <TableColumn>点位编码</TableColumn>
              <TableColumn className="hidden sm:table-cell">描述</TableColumn>
              <TableColumn>数据类型</TableColumn>
              <TableColumn>访问类型</TableColumn>
              <TableColumn className="hidden sm:table-cell">单位</TableColumn>
              <TableColumn className="hidden sm:table-cell">分组名</TableColumn>
              <TableColumn>值字典</TableColumn>
              <TableColumn>{''}</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredPoints.map((p) => {
                const row = getPointFinal(p);
                const isDirty = pendingChanges.has(p.id);
                const isOver = dragState.overId === p.id;
                const isDragging = dragState.fromId === p.id;
                return (
                  <TableRow key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('text/plain', p.id);
                                      setDragState({ fromId: p.id, overId: null });
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      if (dragState.overId !== p.id) setDragState((s) => ({ ...s, overId: p.id }));
                                    }}
                                    onDragLeave={() => {
                                      if (dragState.overId === p.id) setDragState((s) => ({ ...s, overId: null }));
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const fromId = e.dataTransfer.getData('text/plain');
                                      const toId = p.id;
                                      setDragState({ fromId: null, overId: null });
                                      if (!fromId || fromId === toId) return;
                                      // 当前可见序列：filteredPoints
                                      const ids = filteredPoints.map((x) => x.id);
                                      const fromIdx = ids.indexOf(fromId);
                                      const toIdx = ids.indexOf(toId);
                                      if (fromIdx < 0 || toIdx < 0) return;
                                      // 目标位置：插到 toId 之前
                                      const next = [...ids];
                                      next.splice(fromIdx, 1);
                                      next.splice(toIdx, 0, fromId);
                                      // 把缺失的 id（被过滤掉的）补回原位，保持完整 manualOrder
                                      if (manualOrder) {
                                        const present = new Set(next);
                                        const fill = manualOrder.filter((id) => !present.has(id));
                                        setManualOrder([...next, ...fill]);
                                      } else {
                                        const present = new Set(next);
                                        const defaultRest = visibleExisting
                                          .map((x) => x.id)
                                          .filter((id) => !present.has(id));
                                        setManualOrder([...next, ...defaultRest]);
                                      }
                                    }}
                                    onDragEnd={() => setDragState({ fromId: null, overId: null })}
                                    className={[
                                      isDragging ? 'opacity-40' : '',
                                      isOver ? 'ring-2 ring-primary' : '',
                                    ].filter(Boolean).join(' ')}>
                    <TableCell>
                      <Tooltip content="按住拖拽排序">
                        <span
                          role="button"
                          aria-label="拖拽手柄"
                          className="inline-flex h-6 w-6 cursor-grab select-none items-center justify-center rounded text-foreground-400 hover:bg-default-100 active:cursor-grabbing"
                          // 阻止 handle 内选中/拖拽文字
                          onMouseDown={(e) => e.stopPropagation()}>
                          <Bars3Icon className="h-4 w-4" />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Input size="sm" variant="flat" placeholder="如：温度" value={row.pointName}
                        onValueChange={(v) => handleExistingPointChange(p.id, { pointName: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell>
                      <Input size="sm" variant="flat" placeholder="如：temp_01" value={row.pointCode}
                        onValueChange={(v) => handleExistingPointChange(p.id, { pointCode: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input size="sm" variant="flat" placeholder="可选" value={row.description}
                        onValueChange={(v) => handleExistingPointChange(p.id, { description: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell>
                      <Select variant="flat" selectedKeys={[row.dataType]} className="w-28"
                        onSelectionChange={(keys) => handleExistingPointChange(p.id, { dataType: Array.from(keys)[0] as DataType })}>
                        {DATA_TYPES.map((t) => (<SelectItem key={t}>{t}</SelectItem>))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {ACCESS_TYPES.map((t) => (
                          <Button key={t} size="sm" variant={row.access === t ? 'flat' : 'light'}
                            color={row.access === t ? 'primary' : 'default'}
                            onPress={() => handleExistingPointChange(p.id, { access: t })}>
                            {ACCESS_LABELS[t]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input size="sm" variant="flat" placeholder="℃" value={row.unit} className="w-20"
                        onValueChange={(v) => handleExistingPointChange(p.id, { unit: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input size="sm" variant="flat" placeholder="如：温度组" value={row.groupLabel}
                        onValueChange={(v) => handleExistingPointChange(p.id, { groupLabel: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell>
                      <ValueMappingsCell
                        value={row.valueMappings}
                        onChange={(next) => {
                          const valid = next.filter((m) => m.key.trim() !== '');
                          const json = valid.length > 0
                            ? JSON.stringify(Object.fromEntries(valid.map((m) => [m.key, m.label])))
                            : undefined;
                          handleExistingPointChange(p.id, { valueMappings: json });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isDirty ? (
                          <>
                            <Tooltip content="保存">
                              <Button isIconOnly size="sm" variant="flat" color="success"
                                isLoading={savingKeys.has(p.id)}
                                onPress={() => handleExistingPointSave(p.id)}>
                                <CheckCircleIcon className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="撤销">
                              <Button isIconOnly size="sm" variant="light"
                                onPress={() => handleExistingPointDiscard(p.id)}>
                                <XMarkIcon className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip content="复制此点位">
                              <Button isIconOnly size="sm" variant="light" color="primary"
                                onPress={() => copyPoint(row)}>
                                <DocumentDuplicateIcon className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="删除">
                              <Button isIconOnly size="sm" variant="light" color="danger"
                                isLoading={pointDeleteMutation.isPending}
                                onPress={() => handleExistingPointDelete(p.id)}>
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
        </div>
      )}

      {/* 快捷添加面板已挪到标题栏右侧 */}

      {/* 待保存点位（仅当有草稿行时显示） */}
      {newRows.length > 0 && (
        <>
          <div ref={pendingRef} className="mb-2 text-sm text-foreground-500">
            待保存点位（{newRows.length}）
          </div>
          <div className="overflow-auto rounded-lg border border-divider">
            <Table aria-label="新增点位" removeWrapper>
              <TableHeader>
                <TableColumn>名称</TableColumn>
                <TableColumn>点位编码</TableColumn>
                <TableColumn className="hidden sm:table-cell">描述</TableColumn>
                <TableColumn>数据类型</TableColumn>
                <TableColumn>访问类型</TableColumn>
                <TableColumn className="hidden sm:table-cell">单位</TableColumn>
                <TableColumn className="hidden sm:table-cell">分组名</TableColumn>
                <TableColumn>值字典</TableColumn>
                <TableColumn>{''}</TableColumn>
              </TableHeader>
              <TableBody>
                {newRows.map((row) => (
                  <TableRow key={row._key}>
                    <TableCell>
                      <Input size="sm" variant="flat" placeholder="如：温度" value={row.pointName}
                        onValueChange={(v) => handleNewPointChange(row._key, { pointName: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell>
                      <Input size="sm" variant="flat" placeholder="如：temp_01" value={row.pointCode}
                        onValueChange={(v) => handleNewPointChange(row._key, { pointCode: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input size="sm" variant="flat" placeholder="可选" value={row.description}
                        onValueChange={(v) => handleNewPointChange(row._key, { description: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell>
                      <Select variant="flat" selectedKeys={[row.dataType]} className="w-28"
                        onSelectionChange={(keys) => handleNewPointChange(row._key, { dataType: Array.from(keys)[0] as DataType })}>
                        {DATA_TYPES.map((t) => (<SelectItem key={t}>{t}</SelectItem>))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {ACCESS_TYPES.map((t) => (
                          <Button key={t} size="sm" variant={row.access === t ? 'flat' : 'light'}
                            color={row.access === t ? 'primary' : 'default'}
                            onPress={() => handleNewPointChange(row._key, { access: t })}>
                            {ACCESS_LABELS[t]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input size="sm" variant="flat" placeholder="℃" value={row.unit} className="w-20"
                        onValueChange={(v) => handleNewPointChange(row._key, { unit: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input size="sm" variant="flat" placeholder="如：温度组" value={row.groupLabel}
                        onValueChange={(v) => handleNewPointChange(row._key, { groupLabel: v })}
                        classNames={{ inputWrapper: 'bg-transparent' }} />
                    </TableCell>
                    <TableCell>
                      <ValueMappingsCell
                        value={row.valueMappings}
                        onChange={(next) => {
                          const valid = next.filter((m) => m.key.trim() !== '');
                          const json = valid.length > 0
                            ? JSON.stringify(Object.fromEntries(valid.map((m) => [m.key, m.label])))
                            : undefined;
                          handleNewPointChange(row._key, { valueMappings: json });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip content="保存此点位">
                          <Button isIconOnly size="sm" variant="flat" color="success"
                            isLoading={savingKeys.has(row._key)}
                            isDisabled={!row.pointName.trim() || !row.pointCode.trim()}
                            onPress={() => saveOneNewPoint(row._key)}>
                            <CheckCircleIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="复制此行">
                          <Button isIconOnly size="sm" variant="light" color="primary"
                            onPress={() => copyPoint(row)}>
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="移除该行">
                          <Button isIconOnly size="sm" variant="light" color="danger"
                            onPress={() => removeNewRow(row._key)}>
                            <XMarkIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* 批量保存进度弹窗 */}
      <Modal
        isOpen={batchProgress.open}
        onClose={closeBatchProgress}
        size="sm"
        placement="center"
        isDismissable={batchProgress.done >= batchProgress.total}
        hideCloseButton={batchProgress.done < batchProgress.total}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {batchProgress.done < batchProgress.total
              ? '正在批量保存…'
              : batchProgress.failed.length === batchProgress.total
                ? '无法保存：请补全必填字段'
                : '保存完成'}
          </ModalHeader>
          <ModalBody className="flex flex-col gap-3">
            <Progress
              aria-label="保存进度"
              value={batchProgress.done}
              maxValue={batchProgress.total}
              color={batchProgress.failed.length > 0 ? 'warning' : 'primary'}
              showValueLabel
              valueLabel={`${batchProgress.done} / ${batchProgress.total}`}
              className="w-full"
            />
            {batchProgress.done < batchProgress.total ? (
              <p className="text-sm text-foreground-500">
                正在保存：<b className="text-foreground">{batchProgress.currentLabel}</b>
              </p>
            ) : batchProgress.failed.length === batchProgress.total ? (
              <p className="text-sm text-foreground">
                以下 <b className="text-danger">{batchProgress.failed.length}</b> 行缺少必填字段，请补全后重新保存。
              </p>
            ) : (
              <p className="text-sm text-foreground">
                成功 <b className="text-success">{batchProgress.done - batchProgress.failed.length}</b> 项，
                失败 <b className="text-danger">{batchProgress.failed.length}</b> 项。
              </p>
            )}
            {batchProgress.failed.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-danger-200 bg-danger-50 p-2 text-xs">
                {batchProgress.failed.map((f) => (
                  <div key={f.key} className="flex justify-between gap-2 py-0.5">
                    <span className="truncate text-foreground">{f.label}</span>
                    <span className="shrink-0 text-danger">{f.error}</span>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {batchProgress.done < batchProgress.total ? (
              <Button isDisabled color="primary">保存中…</Button>
            ) : (
              <Button color="primary" onPress={closeBatchProgress}>知道了</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}
