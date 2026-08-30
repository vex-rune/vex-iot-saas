import { useState } from 'react';
import {
  Button,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Skeleton,
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { queryAlarmRules, countAlarmRules, saveAlarmRule, deleteAlarmRule } from '@/api/alarms';
import { queryDevices, countDevices } from '@/api/devices';
import { useQueryList } from '@/hooks/useQueryList';
import type { AlarmRule, Device } from '@/types/api';

const LEVEL_OPTIONS = ['INFO', 'WARNING', 'CRITICAL', 'FATAL'];
const CONDITION_OPTIONS = ['GT', 'LT', 'EQ', 'BETWEEN'];
const LEVEL_LABELS: Record<string, string> = { INFO: '提示', WARNING: '警告', CRITICAL: '紧急', FATAL: '严重' };
const LEVEL_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'primary'> = {
  INFO: 'success', WARNING: 'warning', CRITICAL: 'danger', FATAL: 'danger',
};

export default function AlarmRules() {
  const queryClient = useQueryClient();

  const {
    data: rules,
    total,
    page,
    size,
    setPage,
    isLoading,
  } = useQueryList<AlarmRule>({
    queryKey: 'alarmRules',
    queryFn: queryAlarmRules,
    countFn: countAlarmRules,
  });

  // 设备列表(用于 Drawer 选择)
  const { data: deviceList } = useQueryList<Device>({
    queryKey: 'devices.pick',
    queryFn: queryDevices,
    countFn: countDevices,
    defaultSize: 200,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlarmRule | null>(null);
  const [form, setForm] = useState({
    deviceId: '',
    pointCode: '',
    conditionType: 'GT',
    threshold: '',
    thresholdHigh: '',
    level: 'WARNING',
    enabled: true,
    notifyUserIds: '',
  });

  const openCreate = () => {
    setEditingRule(null);
    setForm({ deviceId: '', pointCode: '', conditionType: 'GT', threshold: '', thresholdHigh: '', level: 'WARNING', enabled: true, notifyUserIds: '' });
    setDrawerOpen(true);
  };

  const openEdit = (rule: AlarmRule) => {
    setEditingRule(rule);
    setForm({
      deviceId: rule.deviceId,
      pointCode: rule.pointCode ?? '',
      conditionType: rule.conditionType,
      threshold: String(rule.threshold ?? ''),
      thresholdHigh: String(rule.thresholdHigh ?? ''),
      level: rule.level,
      enabled: rule.enabled,
      notifyUserIds: (rule.notifyUserIds ?? []).join(','),
    });
    setDrawerOpen(true);
  };

  const saveMutation = useApiMutation({
    mutationFn: (data: Partial<AlarmRule>) => saveAlarmRule(data),
  });
  const saveUI = useMutation({
    mutationFn: async (input: Parameters<typeof saveMutation.mutate>[0]) => {
      await saveMutation.mutateAsync(input);
      return input;
    },
    onSuccess: () => {
      addToast({ title: editingRule ? '更新成功' : '创建成功', color: 'success' });
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['alarmRules'] });
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: deleteAlarmRule,
  });
  const deleteUI = useMutation({
    mutationFn: async (id: string) => { await deleteMutation.mutateAsync(id); return id; },
    onSuccess: () => {
      addToast({ title: '删除成功', color: 'success' });
      queryClient.invalidateQueries({ queryKey: ['alarmRules'] });
    },
  });

  const handleSave = () => {
    if (!form.deviceId) {
      addToast({ title: '请选择设备', color: 'warning' });
      return;
    }
    if (!form.threshold) {
      addToast({ title: '请输入阈值', color: 'warning' });
      return;
    }
    saveUI.mutate({
      ...(editingRule ? { id: editingRule.id } : {}),
      deviceId: form.deviceId,
      pointCode: form.pointCode || undefined,
      conditionType: form.conditionType as AlarmRule['conditionType'],
      threshold: Number(form.threshold),
      thresholdHigh: form.conditionType === 'BETWEEN' ? Number(form.thresholdHigh) : undefined,
      level: form.level as AlarmRule['level'],
      enabled: form.enabled,
      notifyUserIds: form.notifyUserIds
        ? form.notifyUserIds.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    });
  };

  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">告警规则</h1>
        <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={openCreate}>
          新增规则
        </Button>
      </header>

      {isLoading ? (
        <div className="rounded-2xl bg-content1 p-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full rounded-lg" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : isMobile ? (
        rules.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无告警规则
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rules.map((rule) => (
              <EntityCard
                key={rule.id}
                title={`${rule.conditionType} ${rule.threshold}${rule.conditionType === 'BETWEEN' ? ` ~ ${rule.thresholdHigh}` : ''}`}
                subtitle={rule.pointCode ? `点位: ${rule.pointCode}` : '设备级规则'}
                badge={
                  <div className="flex flex-col items-end gap-1">
                    <Chip size="sm" variant="flat" color={LEVEL_COLORS[rule.level]}>
                      {LEVEL_LABELS[rule.level]}
                    </Chip>
                    <Chip size="sm" variant="flat" color={rule.enabled ? 'success' : 'default'}>
                      {rule.enabled ? '启用' : '禁用'}
                    </Chip>
                  </div>
                }
                actions={
                  <>
                    <Button size="sm" variant="flat" color="primary"
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => openEdit(rule)}>编辑</Button>
                    <Popover placement="top">
                      <PopoverTrigger>
                        <Button size="sm" variant="flat" color="danger"
                          startContent={<TrashIcon className="h-4 w-4" />}>删除</Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <div className="flex flex-col items-center gap-2 p-2">
                          <p className="text-sm text-foreground">确认删除该规则?</p>
                          <Button size="sm" color="danger" isLoading={deleteUI.isPending}
                            onPress={() => deleteUI.mutate(rule.id)}>
                            确认删除
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                }
              >
                <FieldRow label="设备" value={<code className="text-xs">{rule.deviceId.slice(0, 8)}</code>} />
                <FieldRow label="通知人" value={`${(rule.notifyUserIds ?? []).length} 人`} />
              </EntityCard>
            ))}
          </div>
        )
      ) : (
        <Table aria-label="告警规则列表" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>设备</TableColumn>
            <TableColumn className="hidden sm:table-cell">点位</TableColumn>
            <TableColumn>条件</TableColumn>
            <TableColumn>级别</TableColumn>
            <TableColumn>启用</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="暂无告警规则" items={rules}>
            {(rule: AlarmRule) => (
              <TableRow key={rule.id}>
                <TableCell><code className="text-xs text-foreground">{rule.deviceId.slice(0, 8)}</code></TableCell>
                <TableCell className="hidden sm:table-cell"><code className="text-xs text-foreground">{rule.pointCode ?? '-'}</code></TableCell>
                <TableCell className="text-sm text-foreground">
                  {rule.conditionType} {rule.threshold}
                  {rule.conditionType === 'BETWEEN' && ` ~ ${rule.thresholdHigh}`}
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={LEVEL_COLORS[rule.level]}>
                    {LEVEL_LABELS[rule.level]}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={rule.enabled ? 'success' : 'default'}>
                    {rule.enabled ? '启用' : '禁用'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Tooltip content="编辑">
                      <Button isIconOnly size="sm" variant="light" onPress={() => openEdit(rule)}>
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Popover placement="top">
                      <PopoverTrigger>
                        <Button isIconOnly size="sm" variant="light" color="danger">
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <div className="flex flex-col items-center gap-2 p-2">
                          <p className="text-sm text-foreground">确认删除该规则?</p>
                          <Button size="sm" color="danger" isLoading={deleteUI.isPending}
                            onPress={() => deleteUI.mutate(rule.id)}>
                            确认删除
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground-500">共 {total} 条</span>
        <Pagination
          total={Math.max(1, Math.ceil(total / size))}
          page={page + 1}
          onChange={(p) => setPage(p - 1)}
          showControls
          isCompact
        />
      </div>

      {/* 新增/编辑 Drawer */}
      <Drawer isOpen={drawerOpen} onOpenChange={setDrawerOpen} placement="right" size="lg">
        <DrawerContent>
          <DrawerHeader>{editingRule ? '编辑规则' : '新增规则'}</DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Select
              label="设备"
              placeholder="选择设备"
              variant="bordered"
              isRequired
              selectedKeys={form.deviceId ? [form.deviceId] : []}
              onSelectionChange={(keys) => setForm((f) => ({ ...f, deviceId: Array.from(keys)[0] as string }))}
            >
              {(deviceList ?? []).map((d) => (
                <SelectItem key={d.id}>{d.deviceName} ({d.deviceCode})</SelectItem>
              ))}
            </Select>
            <Input
              label="点位编码"
              placeholder="可选"
              value={form.pointCode}
              onValueChange={(v) => setForm((f) => ({ ...f, pointCode: v }))}
              variant="bordered"
            />
            <Select
              label="条件类型"
              variant="bordered"
              selectedKeys={[form.conditionType]}
              onSelectionChange={(keys) => setForm((f) => ({ ...f, conditionType: Array.from(keys)[0] as string }))}
            >
              {CONDITION_OPTIONS.map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </Select>
            <Input
              label="阈值"
              type="number"
              value={form.threshold}
              onValueChange={(v) => setForm((f) => ({ ...f, threshold: v }))}
              variant="bordered"
              isRequired
            />
            {form.conditionType === 'BETWEEN' && (
              <Input
                label="阈值上限"
                type="number"
                value={form.thresholdHigh}
                onValueChange={(v) => setForm((f) => ({ ...f, thresholdHigh: v }))}
                variant="bordered"
              />
            )}
            <Select
              label="级别"
              variant="bordered"
              selectedKeys={[form.level]}
              onSelectionChange={(keys) => setForm((f) => ({ ...f, level: Array.from(keys)[0] as string }))}
            >
              {LEVEL_OPTIONS.map((l) => (
                <SelectItem key={l}>{LEVEL_LABELS[l]}</SelectItem>
              ))}
            </Select>
            <Switch isSelected={form.enabled} onValueChange={(v) => setForm((f) => ({ ...f, enabled: v }))}>
              启用
            </Switch>
            <Input
              label="通知用户 ID"
              placeholder="多个用逗号分隔"
              value={form.notifyUserIds}
              onValueChange={(v) => setForm((f) => ({ ...f, notifyUserIds: v }))}
              variant="bordered"
            />
          </DrawerBody>
          <DrawerFooter>
            <Button variant="flat" onPress={() => setDrawerOpen(false)}>取消</Button>
            <Button color="primary" isLoading={saveUI.isPending} onPress={handleSave}>保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
