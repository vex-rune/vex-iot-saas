import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
  Input,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
  addToast,
} from '@heroui/react';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import {
  queryActiveDevices, countActiveDevices,
  queryDeletedDevices, countDeletedDevices,
  deleteDevice, toggleDeviceEnabled,
} from '@/api/devices';
import { useQueryList } from '@/hooks/useQueryList';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { formatDateTime } from '@/lib/format';
import type { Device, Predicate, PredicateItem } from '@/types/api';

const STATUS_OPTIONS = [
  { key: 'ALL', label: '全部' },
  { key: 'ONLINE', label: '在线' },
  { key: 'OFFLINE', label: '离线' },
];

const ENABLED_OPTIONS = [
  { key: 'ALL', label: '全部' },
  { key: 'true', label: '已启用' },
  { key: 'false', label: '已禁用' },
];

type DeviceView = 'active' | 'deleted';

export default function Devices() {
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState<DeviceView>('active');
  const [searchName, setSearchName] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterEnabled, setFilterEnabled] = useState('ALL');

  // 输入即时态 + 防抖提交的搜索态（避免每打一个字就触发请求）
  const [debouncedName, setDebouncedName] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(searchName), 300);
    return () => clearTimeout(t);
  }, [searchName]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCode(searchCode), 300);
    return () => clearTimeout(t);
  }, [searchCode]);

  const defaultPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    if (debouncedName.trim())
      items.push({ condition: { field: 'deviceName', op: 'like' as const, value: `%${debouncedName.trim()}%` } });
    if (debouncedCode.trim())
      items.push({ condition: { field: 'deviceCode', op: 'like' as const, value: `%${debouncedCode.trim()}%` } });
    if (filterStatus !== 'ALL')
      items.push({ condition: { field: 'online', op: 'eq' as const, value: filterStatus } });
    if (filterEnabled !== 'ALL')
      items.push({ condition: { field: 'enabled', op: 'eq' as const, value: filterEnabled === 'true' } });
    return items.length > 0 ? { and: items } : undefined;
  }, [debouncedName, debouncedCode, filterStatus, filterEnabled]);

  const queryFn = useMemo(
    () => (view === 'active' ? queryActiveDevices : queryDeletedDevices),
    [view],
  );
  const countFn = useMemo(
    () => (view === 'active' ? countActiveDevices : countDeletedDevices),
    [view],
  );

  const {
    data: devices, total, page, size, setPage, setSize, setPredicate, isLoading, refetch,
  } = useQueryList<Device>({
    queryKey: `devices.${view}`,
    queryFn,
    countFn,
    defaultSize: 15,
  });

  // 把 searchName/searchCode/筛选条件 同步进 query hook 的 predicate
  useEffect(() => {
    setPredicate(defaultPredicate);
    setPage(0);
  }, [defaultPredicate, setPredicate, setPage]);

  // 切换 设备管理 / 回收站：清筛选 + 跳回第 1 页 + 立即重拉
  const switchView = useCallback((next: DeviceView) => {
    if (next === view) return;
    setView(next);
    setSearchName(''); setSearchCode(''); setFilterStatus('ALL'); setFilterEnabled('ALL');
    setDebouncedName(''); setDebouncedCode('');
    setPage(0);
    setTimeout(() => refetch(), 0);
  }, [view, setPage, refetch]);

  // 每次进入/回到设备管理页（含新建/编辑保存后 navigate 回来）都强制重拉，
  // 解决"操作后页面不刷新"的问题
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const deleteMutation = useApiMutation<{ id: string }, void>({
    mutationFn: ({ id }) => deleteDevice(id),
  });
  const toggleMutation = useApiMutation<{ id: string; nextEnabled: boolean }, Device>({
    mutationFn: ({ id, nextEnabled }) => toggleDeviceEnabled(id, nextEnabled),
  });

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          addToast({ title: '删除成功', color: 'success' });
          refetch();
        },
      },
    );
  }, [deleteMutation, refetch]);

  const handleToggleEnabled = useCallback((id: string, nextEnabled: boolean) => {
    toggleMutation.mutate(
      { id, nextEnabled },
      {
        onSuccess: () => {
          addToast({ title: nextEnabled ? '已启用' : '已停用', color: 'success' });
          refetch();
        },
      },
    );
  }, [toggleMutation, refetch]);

  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {view === 'active' ? '设备管理' : '回收站'}
          </h1>
          {view === 'active' ? (
            <Button size="sm" variant="flat"
              startContent={<TrashIcon className="h-4 w-4" />}
              onPress={() => switchView('deleted')}>
              回收站
            </Button>
          ) : (
            <Button size="sm" variant="flat" onPress={() => switchView('active')}>
              返回设备列表
            </Button>
          )}
        </div>
        {view === 'active' && (
          <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />}
            onPress={() => navigate('/devices/new')}>
            新增设备
          </Button>
        )}
      </header>

      {/* 筛选栏(由 size="sm" 统一锁定 32px,不做外部高度覆盖) */}
      <div className="flex flex-wrap items-center gap-2">
        <Input size="sm" placeholder="搜索名称" aria-label="搜索名称"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
          value={searchName} onValueChange={setSearchName}
          variant="bordered" className="w-40" />
        <Input size="sm" placeholder="搜索编码" aria-label="搜索编码"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
          value={searchCode} onValueChange={setSearchCode}
          variant="bordered" className="w-40" />
        <Select size="sm" placeholder="在线状态" aria-label="在线状态"
          variant="bordered" className="w-28"
          selectedKeys={[filterStatus]}
          onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}>
          {STATUS_OPTIONS.map((o) => (<SelectItem key={o.key}>{o.label}</SelectItem>))}
        </Select>
        <Select size="sm" placeholder="启用状态" aria-label="启用状态"
          variant="bordered" className="w-28"
          selectedKeys={[filterEnabled]}
          onSelectionChange={(keys) => setFilterEnabled(Array.from(keys)[0] as string)}>
          {ENABLED_OPTIONS.map((o) => (<SelectItem key={o.key}>{o.label}</SelectItem>))}
        </Select>
        <Button size="sm" variant="flat" onPress={() => {
          setSearchName(''); setSearchCode(''); setFilterStatus('ALL'); setFilterEnabled('ALL');
          setDebouncedName(''); setDebouncedCode('');
        }}>重置</Button>
      </div>

      {/* 列表(桌面端表格 / 移动端卡片) */}
      {isLoading ? (
        <div className="rounded-2xl bg-content1 p-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full rounded-lg" />
            {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-10 w-full rounded-lg" />))}
          </div>
        </div>
      ) : isMobile ? (
        devices.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无设备数据
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {devices.map((device) => (
              <EntityCard
                key={device.id}
                title={device.deviceName}
                subtitle={device.deviceCode}
                badge={
                  <div className="flex flex-col items-end gap-1">
                    <Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'danger'}>
                      {device.online === 'ONLINE' ? '在线' : '离线'}
                    </Chip>
                    <Chip size="sm" variant="flat" color={device.enabled ? 'primary' : 'default'}>
                      {device.enabled ? '启用' : '禁用'}
                    </Chip>
                  </div>
                }
                actions={
                  view === 'active' ? (
                    <>
                      <Button size="sm" variant="flat" startContent={<EyeIcon className="h-4 w-4" />}
                        onPress={() => navigate(`/devices/${device.id}`)}>详情</Button>
                      <Button size="sm" variant="flat" color="primary"
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => navigate(`/devices/${device.id}/edit`)}>编辑</Button>
                      <Button
                        size="sm" variant="flat"
                        color={device.enabled ? 'warning' : 'success'}
                        onPress={() => handleToggleEnabled(device.id, !device.enabled)}>
                        {device.enabled ? '停用' : '启用'}
                      </Button>
                      <Popover placement="top">
                        <PopoverTrigger>
                          <Button size="sm" variant="flat" color="danger"
                            startContent={<TrashIcon className="h-4 w-4" />}>删除</Button>
                        </PopoverTrigger>
                        <PopoverContent>
                          <div className="flex flex-col items-center gap-2 p-2">
                            <p className="text-sm text-foreground">确认删除该设备?</p>
                            <Button size="sm" color="danger" onPress={() => handleDelete(device.id)}>
                              确认删除
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </>
                  ) : (
                    <Button size="sm" variant="flat" startContent={<EyeIcon className="h-4 w-4" />}
                      onPress={() => navigate(`/devices/${device.id}`)}>详情</Button>
                  )
                }
              >
                <FieldRow label="网关ID" value={device.gatewayId ?? '-'} />
                <FieldRow label="最近心跳" value={formatDateTime(device.lastHeartbeatAt)} />
              </EntityCard>
            ))}
          </div>
        )
      ) : (
        <Table aria-label="设备列表" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>设备名称</TableColumn>
            <TableColumn>编号</TableColumn>
            <TableColumn>网关ID</TableColumn>
            <TableColumn>在线</TableColumn>
            <TableColumn>启用</TableColumn>
            <TableColumn>最近心跳</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="暂无设备数据" items={devices}>
            {(device: Device) => (
              <TableRow key={device.id}>
                <TableCell><span className="font-medium text-foreground">{device.deviceName}</span></TableCell>
                <TableCell><code className="text-xs text-foreground-600">{device.deviceCode}</code></TableCell>
                <TableCell>
                  <span className="text-foreground-500">{device.gatewayId ?? '-'}</span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'danger'}>
                    {device.online === 'ONLINE' ? '在线' : '离线'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={device.enabled ? 'primary' : 'default'}>
                    {device.enabled ? '启用' : '禁用'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-foreground-500">{formatDateTime(device.lastHeartbeatAt)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Tooltip content="详情">
                      <Button isIconOnly size="sm" variant="light" onPress={() => navigate(`/devices/${device.id}`)}>
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    {view === 'active' && (
                      <>
                        <Tooltip content="编辑">
                          <Button isIconOnly size="sm" variant="light" onPress={() => navigate(`/devices/${device.id}/edit`)}>
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={device.enabled ? '停用设备' : '启用设备'}>
                          <Button
                            isIconOnly size="sm" variant="light"
                            color={device.enabled ? 'warning' : 'success'}
                            onPress={() => handleToggleEnabled(device.id, !device.enabled)}>
                            {device.enabled ? '⏸' : '▶'}
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
                              <p className="text-sm text-foreground">确认删除该设备?</p>
                              <Button size="sm" color="danger" isLoading={false}
                                onPress={() => handleDelete(device.id)}>
                                确认删除
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-500">共 {total} 条</span>
          <Select size="sm" variant="bordered" className="w-24"
            selectedKeys={[String(size)]}
            onSelectionChange={(keys) => setSize(Number(Array.from(keys)[0]))}>
            {['15', '30', '60', '100'].map((s) => (
              <SelectItem key={s}>{s}</SelectItem>
            ))}
          </Select>
        </div>
        <Pagination total={Math.max(1, Math.ceil(total / size))} page={page + 1}
          onChange={(p) => setPage(p - 1)} showControls isCompact />
      </div>
    </div>
  );
}
