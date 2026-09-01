import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Pagination,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from '@heroui/react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import {
  queryPointAlarmEvents,
  countPointAlarmEvents,
  acknowledgePointAlarmEvent,
} from '@/api/pointAlarm';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { useQueryList } from '@/hooks/useQueryList';
import { SearchFilterBar, type FilterGroupSpec } from '@/components/list/SearchFilterBar';
import { formatDateTime } from '@/lib/format';
import { POINT_LEVEL_COLORS, POINT_LEVEL_LABELS } from '@/lib/levelMeta';
import type { PointAlarmEvent, PointAlarmEventStatus, Predicate, PredicateItem, QueryBody } from '@/types/api';

type AlarmSortField = 'occurTime' | 'recoverTime' | 'level';

const LEVEL_COLORS = POINT_LEVEL_COLORS;
const LEVEL_LABELS = POINT_LEVEL_LABELS;

const STATUS_OPTIONS = [
  { key: 'ALL', label: '全部' },
  { key: 'ACTIVE', label: '活跃' },
  { key: 'RECOVERED', label: '已恢复' },
  { key: 'ACK', label: '已确认' },
];

const STATUS_LABELS: Record<PointAlarmEventStatus, string> = {
  ACTIVE: '活跃',
  RECOVERED: '已恢复',
  ACK: '已确认',
};

const STATUS_COLORS: Record<PointAlarmEventStatus, 'danger' | 'warning' | 'success'> = {
  ACTIVE: 'danger',
  RECOVERED: 'warning',
  ACK: 'success',
};

export default function PointAlarmEvents() {
  // 搜索 / 筛选
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  /** 排序:发生时间(默认)/恢复时间/告警级别 */
  const [sortField, setSortField] = useState<AlarmSortField>('occurTime');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  const defaultPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    if (debouncedSearch.trim()) {
      items.push({ condition: { field: 'alarmMessage', op: 'like' as const, value: `%${debouncedSearch.trim()}%` } });
    }
    if (filterStatus !== 'ALL') {
      items.push({ condition: { field: 'eventStatus', op: 'eq' as const, value: filterStatus } });
    }
    if (filterLevel !== 'ALL') {
      items.push({ condition: { field: 'alarmLevel', op: 'eq' as const, value: filterLevel } });
    }
    return items.length > 0 ? { and: items } : undefined;
  }, [debouncedSearch, filterStatus, filterLevel]);

  const defaultOrder = useMemo<QueryBody['order']>(
    () => [{ field: sortField, order: sortDir }],
    [sortField, sortDir],
  );

  const {
    data: events,
    total,
    totalPages,
    page,
    size,
    setPage,
    setSize,
    setOrder,
    isLoading,
    refetch,
  } = useQueryList<PointAlarmEvent>({
    queryKey: 'pointAlarmEvents',
    queryFn: (body) => queryPointAlarmEvents(body),
    countFn: (body) => countPointAlarmEvents(body),
    defaultSize: 15,
    // 筛选/搜索条件直接作 defaultPredicate 注入,变化时 react-query 自动 refetch
    defaultPredicate,
    defaultOrder,
  });

  // 排序变化时同步给 useQueryList 内部 order state,触发 queryKey 重查 + 跳回首页
  useEffect(() => {
    setOrder(defaultOrder);
    setPage(0);
  }, [defaultOrder, setOrder, setPage]);

  const ackMutation = useApiMutation({
    mutationFn: acknowledgePointAlarmEvent,
  });
  const handleAck = (id: string) => {
    ackMutation.mutate(id, {
      onSuccess: () => {
        addToast({ title: '告警已确认', color: 'success' });
        refetch();
      },
    });
  };

  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-foreground">警告信息</h1>
        <p className="mt-1 text-sm text-foreground-500">共 {total} 条</p>
      </header>

      {/* 通用搜索/排序/筛选/重置 工具栏 */}
      <SearchFilterBar
        searchPlaceholder="搜索告警信息"
        searchValue={searchText}
        onSearchChange={setSearchText}
        sort={{
          fields: [
            { key: 'occurTime', label: '发生时间' },
            { key: 'recoverTime', label: '恢复时间' },
            { key: 'level', label: '告警级别' },
          ],
          value: sortField,
          onChange: (k) => setSortField(k as AlarmSortField),
          dir: sortDir,
          onDirChange: setSortDir,
        }}
        filters={[
          {
            label: '告警级别',
            value: filterLevel,
            options: [
              { key: 'ALL', label: '全部' },
              { key: 'INFO', label: '提示' },
              { key: 'WARN', label: '警告' },
              { key: 'ERROR', label: '严重' },
            ],
            onChange: setFilterLevel,
          },
          {
            label: '状态',
            value: filterStatus,
            options: STATUS_OPTIONS,
            onChange: setFilterStatus,
          },
        ] satisfies FilterGroupSpec[]}
        onReset={() => {
          setSearchText('');
          setFilterStatus('ALL'); setFilterLevel('ALL');
          setSortField('occurTime'); setSortDir('DESC');
        }}
      />

      {/* 列表(桌面端表格 / 移动端卡片) */}
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
        events.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无告警信息
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((event) => (
              <EntityCard
                key={event.id}
                title={event.alarmMessage || event.alarmLevel}
                subtitle={formatDateTime(event.occurTime)}
                badge={
                  <div className="flex flex-col items-end gap-1">
                    <Chip size="sm" variant="flat" color={LEVEL_COLORS[event.alarmLevel] ?? 'default'}>
                      {LEVEL_LABELS[event.alarmLevel] ?? event.alarmLevel}
                    </Chip>
                    <Chip size="sm" variant="flat" color={STATUS_COLORS[event.eventStatus]}>
                      {STATUS_LABELS[event.eventStatus]}
                    </Chip>
                  </div>
                }
                actions={
                  event.eventStatus !== 'ACK' ? (
                    <Button size="sm" variant="flat" color="success"
                      startContent={<CheckCircleIcon className="h-4 w-4" />}
                      isLoading={ackMutation.isPending}
                      onPress={() => handleAck(event.id)}>确认</Button>
                  ) : (
                    <span className="text-xs text-foreground-500">{event.ackUserId ?? ''}</span>
                  )
                }
              >
                <FieldRow label="触发值" value={<code className="text-xs">{event.triggerValue ?? '-'}</code>} />
                <FieldRow label="恢复时间" value={event.recoverTime ? formatDateTime(event.recoverTime) : '-'} />
              </EntityCard>
            ))}
          </div>
        )
      ) : (
        <Table aria-label="警告信息列表" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>发生时间</TableColumn>
            <TableColumn>级别</TableColumn>
            <TableColumn>告警信息</TableColumn>
            <TableColumn className="hidden sm:table-cell">触发值</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn className="hidden md:table-cell">恢复时间</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="暂无告警信息" items={events}>
            {(event: PointAlarmEvent) => (
              <TableRow key={event.id}>
                <TableCell>
                  <span className="text-xs text-foreground-600">{formatDateTime(event.occurTime)}</span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={LEVEL_COLORS[event.alarmLevel] ?? 'default'}>
                    {LEVEL_LABELS[event.alarmLevel] ?? event.alarmLevel}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="max-w-[280px] truncate text-sm text-foreground">
                    {event.alarmMessage}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <code className="text-xs text-foreground-600">{event.triggerValue ?? '-'}</code>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={STATUS_COLORS[event.eventStatus]}>
                    {STATUS_LABELS[event.eventStatus]}
                  </Chip>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-xs text-foreground-600">
                    {event.recoverTime ? formatDateTime(event.recoverTime) : '-'}
                  </span>
                </TableCell>
                <TableCell>
                  {event.eventStatus !== 'ACK' && (
                    <Button size="sm" variant="flat" color="success"
                      startContent={<CheckCircleIcon className="h-4 w-4" />}
                      isLoading={ackMutation.isPending}
                      onPress={() => handleAck(event.id)}>确认</Button>
                  )}
                  {event.eventStatus === 'ACK' && (
                    <span className="text-xs text-foreground-500">{event.ackUserId ?? ''}</span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* 分页(始终显示,左侧"共 N 条"+页大小选择器,右侧 Pagination) */}
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
