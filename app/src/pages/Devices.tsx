import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
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
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  queryActiveDevices, countActiveDevices,
  queryDeletedDevices, countDeletedDevices,
  deleteDevice, toggleDeviceEnabled,
} from '@/api/devices';
import { useQueryList } from '@/hooks/useQueryList';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import SearchFilterBar from '@/components/list/SearchFilterBar';
import type { FilterGroupSpec } from '@/components/list/SearchFilterBar';
import { formatDateTime } from '@/lib/format';
import type { Device, Predicate, PredicateItem, QueryBody } from '@/types/api';

type DeviceView = 'active' | 'deleted';
type DeviceSortField = 'default' | 'name' | 'tag';

export default function Devices() {
  const navigate = useNavigate();

  const [view, setView] = useState<DeviceView>('active');
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterEnabled, setFilterEnabled] = useState('ALL');
  /** 排序字段:default=数据库自然序,name=设备名称,code=设备编码,tag=三级标签(客户端) */
  const [sortField, setSortField] = useState<DeviceSortField>('name');
  /** 排序方向 */
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  // 输入即时态 + 防抖提交的搜索态（避免每打一个字就触发请求）
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const defaultPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    // 统一关键字:命中 设备名称 / 三级标签 任一即返回(OR)
    if (debouncedKeyword.trim()) {
      const likeValue = `%${debouncedKeyword.trim()}%`;
      items.push({
        predicate: {
          or: [
            { condition: { field: 'deviceName', op: 'like' as const, value: likeValue } },
            { condition: { field: 'level1Tag', op: 'like' as const, value: likeValue } },
            { condition: { field: 'level2Tag', op: 'like' as const, value: likeValue } },
            { condition: { field: 'level3Tag', op: 'like' as const, value: likeValue } },
          ],
        },
      });
    }
    if (filterStatus !== 'ALL')
      items.push({ condition: { field: 'online', op: 'eq' as const, value: filterStatus } });
    if (filterEnabled !== 'ALL')
      items.push({ condition: { field: 'enabled', op: 'eq' as const, value: filterEnabled === 'true' } });
    return items.length > 0 ? { and: items } : undefined;
  }, [debouncedKeyword, filterStatus, filterEnabled]);

  // 排序:数据库能处理的字段(name)直接走 order;tag 是合并字段,客户端排序
  const defaultOrder = useMemo<QueryBody['order']>(() => {
    if (sortField === 'name') return [{ field: 'deviceName', order: sortDir }];
    return undefined; // default / tag:不传 order(default=数据库自然序,tag=客户端排序)
  }, [sortField, sortDir]);

  const queryFn = useMemo(
    () => (view === 'active' ? queryActiveDevices : queryDeletedDevices),
    [view],
  );
  const countFn = useMemo(
    () => (view === 'active' ? countActiveDevices : countDeletedDevices),
    [view],
  );

  const {
    data: devicesRaw, total, totalPages, page, size, setPage, setSize, isLoading, refetch,
    setOrder,
  } = useQueryList<Device>({
    queryKey: `devices.${view}`,
    queryFn,
    countFn,
    defaultSize: 15,
    // 筛选/搜索条件直接作 defaultPredicate 注入;变化时通过 queryKey 自带 predicate
    // 触发 react-query 重新拉取,无需 effect 推 setPredicate
    defaultPredicate,
    defaultOrder,
  });

  // 排序字段/方向变化时,同步推给 useQueryList 的内部 order state,
  // 这样 listQuery 的 queryKey 会包含新 order,自动触发重查
  useEffect(() => {
    setOrder(defaultOrder);
    // 切换排序后回到第 1 页,避免在新排序下还停在旧页码
    setPage(0);
  }, [defaultOrder, setOrder, setPage]);

  // 客户端兜底排序:三级标签拼接后字典序比较;空标签排到末尾
  // 注意:这是基于当前页的 in-memory 排序(分页 > 1 时仅本页有序)
  const devices = useMemo<Device[]>(() => {
    if (sortField !== 'tag') return devicesRaw;
    const sign = sortDir === 'ASC' ? 1 : -1;
    const tagKey = (d: Device) =>
      [d.level1Tag ?? '', d.level2Tag ?? '', d.level3Tag ?? ''].join('\u0000');
    return [...devicesRaw].sort((a, b) => {
      const ka = tagKey(a); const kb = tagKey(b);
      // 空标签(全空)排到末尾:任何与空字符串比较时把空视为"无穷大"
      const aEmpty = ka.replace(/\u0000/g, '') === '';
      const bEmpty = kb.replace(/\u0000/g, '') === '';
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      return ka.localeCompare(kb, 'zh-CN') * sign;
    });
  }, [devicesRaw, sortField, sortDir]);

  // 切换 设备管理 / 回收站:清筛选 + 跳回第 1 页。queryKey 自带 view,
    // react-query 自动因 key 变化而 refetch,无需手动 refetch
  const switchView = useCallback((next: DeviceView) => {
    if (next === view) return;
    setView(next);
    setKeyword('');
    setFilterStatus('ALL'); setFilterEnabled('ALL');
    setDebouncedKeyword('');
    setSortField('name'); setSortDir('ASC');
    setPage(0);
  }, [view, setPage]);

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

      {/* 通用搜索/排序/筛选/重置 工具栏 */}
      <SearchFilterBar
        searchPlaceholder="搜索名称 / 标签"
        searchValue={keyword}
        onSearchChange={setKeyword}
        sort={{
          fields: [
            { key: 'default', label: '默认' },
            { key: 'name', label: '名称' },
            { key: 'tag', label: '标签' },
          ],
          value: sortField,
          onChange: (k: string) => setSortField(k as DeviceSortField),
          dir: sortDir,
          onDirChange: setSortDir,
          clientSortHint: '按标签排序仅作用于当前页;切换到首页可看到全部命中的有序结果。',
          clientSortKeys: ['tag'],
        }}
        filters={[
          {
            label: '在线状态',
            value: filterStatus,
            options: [
              { key: 'ALL', label: '全部' },
              { key: 'ONLINE', label: '在线' },
              { key: 'OFFLINE', label: '离线' },
            ],
            onChange: setFilterStatus,
          },
          {
            label: '启用状态',
            value: filterEnabled,
            options: [
              { key: 'ALL', label: '全部' },
              { key: 'true', label: '已启用' },
              { key: 'false', label: '已禁用' },
            ],
            onChange: setFilterEnabled,
          },
        ] satisfies FilterGroupSpec[]}
        onReset={() => {
          setKeyword('');
          setFilterStatus('ALL'); setFilterEnabled('ALL');
          setDebouncedKeyword('');
          setSortField('name'); setSortDir('ASC');
        }}
      />

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
          // 多列瀑布流:CSS columns 实现,卡片高度独立、紧贴排列、无白空洞
          // 用 inline style + globals.css 的 .masonry 媒体查询响应式
          <div className="masonry">
            {devices.map((device) => (
              <EntityCard
                key={device.id}
                title={device.deviceName}
                // subtitle={device.level1Tag || device.level2Tag || device.level3Tag || undefined}
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
                {[device.level1Tag, device.level2Tag, device.level3Tag].filter((t): t is string => !!t && t.trim().length > 0).length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {[device.level1Tag, device.level2Tag, device.level3Tag]
                      .filter((t): t is string => !!t && t.trim().length > 0)
                      .map((t) => (
                        <Chip key={t} size="sm" variant="flat" color="default">{t}</Chip>
                      ))}
                  </div>
                )}
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
            <TableColumn className="hidden md:table-cell">标签</TableColumn>
            <TableColumn className="hidden sm:table-cell">网关ID</TableColumn>
            <TableColumn>在线</TableColumn>
            <TableColumn>启用</TableColumn>
            <TableColumn>最近心跳</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="暂无设备数据" items={devices}>
            {(device: Device) => {
              const tags = [device.level1Tag, device.level2Tag, device.level3Tag]
                .filter((t): t is string => !!t && t.trim().length > 0);
              return (
              <TableRow key={device.id}>
                <TableCell><span className="font-medium text-foreground">{device.deviceName}</span></TableCell>
                <TableCell className="hidden md:table-cell">
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <Chip key={t} size="sm" variant="flat" color="default">{t}</Chip>
                      ))}
                    </div>
                  ) : <span className="text-foreground-400">-</span>}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
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
              );
            }}
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
        <Pagination total={totalPages} page={page + 1}
          onChange={(p) => setPage(p - 1)} showControls isCompact />
      </div>
    </div>
  );
}
