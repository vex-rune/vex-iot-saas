import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Input,
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
import { CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  queryPointAlarmEvents,
  countPointAlarmEvents,
  acknowledgePointAlarmEvent,
} from '@/api/pointAlarm';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { useQueryList } from '@/hooks/useQueryList';
import { formatDateTime } from '@/lib/format';
import type { PointAlarmEvent, PointAlarmEventStatus, Predicate, PredicateItem } from '@/types/api';

const LEVEL_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  INFO: 'default',
  WARN: 'warning',
  ERROR: 'danger',
};

const LEVEL_LABELS: Record<string, string> = {
  INFO: '提示',
  WARN: '警告',
  ERROR: '严重',
};

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

  const {
    data: events,
    total,
    page,
    size,
    setPage,
    setSize,
    setPredicate,
    setOrder,
    isLoading,
    refetch,
  } = useQueryList<PointAlarmEvent>({
    queryKey: 'pointAlarmEvents',
    queryFn: (body) => queryPointAlarmEvents(body),
    countFn: (body) => countPointAlarmEvents(body),
    defaultSize: 15,
  });

  useEffect(() => {
    setPredicate(defaultPredicate);
    setPage(0);
  }, [defaultPredicate, setPredicate, setPage]);

  // 默认按发生时间倒序
  useEffect(() => {
    setOrder([{ field: 'occurTime', order: 'DESC' }]);
  }, [setOrder]);

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
  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-foreground">警告信息</h1>
        <p className="mt-1 text-sm text-foreground-500">共 {total} 条</p>
      </header>

      {/* 筛选栏(由 size="sm" 统一锁定 32px) */}
      <div className="flex flex-wrap items-center gap-2">
        <Input size="sm" placeholder="搜索告警信息" aria-label="搜索告警信息"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
          value={searchText} onValueChange={setSearchText}
          variant="bordered" className="w-48" />
        <Select size="sm" placeholder="告警级别" aria-label="告警级别"
          variant="bordered" className="w-28"
          selectedKeys={[filterLevel]}
          onSelectionChange={(keys) => setFilterLevel(Array.from(keys)[0] as string)}>
          {[
            { key: 'ALL', label: '全部' },
            { key: 'INFO', label: '提示' },
            { key: 'WARN', label: '警告' },
            { key: 'ERROR', label: '严重' },
          ].map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
        <Select size="sm" placeholder="状态" aria-label="状态"
          variant="bordered" className="w-28"
          selectedKeys={[filterStatus]}
          onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}>
          {STATUS_OPTIONS.map((o) => (<SelectItem key={o.key}>{o.label}</SelectItem>))}
        </Select>
        <Button size="sm" variant="flat" onPress={() => {
          setSearchText('');
          setFilterStatus('ALL');
          setFilterLevel('ALL');
        }}>重置</Button>
      </div>

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
