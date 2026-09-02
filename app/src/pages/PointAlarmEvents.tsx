/**
 * 点位级告警事件列表 (openapi v2 alarm.events query + source=POINT 过滤).
 *
 * 后端已把旧的 /api/point-alarm 模块合并入 /api/alarm,前端通过 source 区分.
 *
 * 数据模型从老的 PointAlarmEvent 平迁到 AlarmEvent:
 *   - alarmMessage → message
 *   - alarmLevel   → level
 *   - alarmRuleId  → ruleId
 *   - eventStatus  → 新 alarm.events 用 acknowledged='ACK'/'UNACK'
 *   - occurTime / recoverTime → triggeredAt / recoveredAt (并存,旧名 alias)
 */
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
  ackAlarmEvent,
} from '@/api/alarms';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { useQueryList } from '@/hooks/useQueryList';
import { formatDateTime } from '@/lib/format';
import { ALARM_LEVEL_COLORS, ALARM_LEVEL_LABELS } from '@/lib/levelMeta';
import type {
  AlarmEvent,
  AlarmLevel,
  AlarmAckStatus,
  Predicate,
  PredicateItem,
  QueryBody,
} from '@/types/api';

type PointAlarmSortField = 'triggeredAt' | 'recoveredAt' | 'level';

const LEVEL_COLORS = ALARM_LEVEL_COLORS;
const LEVEL_LABELS = ALARM_LEVEL_LABELS;

const STATUS_OPTIONS: { key: AlarmAckStatus; label: string }[] = [
  { key: 'UNACK', label: '未确认' },
  { key: 'ACK', label: '已确认' },
];

const STATUS_LABELS: Record<AlarmAckStatus, string> = {
  UNACK: '未确认',
  ACK: '已确认',
};

const STATUS_COLORS: Record<AlarmAckStatus, 'warning' | 'success'> = {
  UNACK: 'warning',
  ACK: 'success',
};

export default function PointAlarmEvents() {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);
  const [filterStatus, setFilterStatus] = useState<AlarmAckStatus | 'ALL'>('ALL');
  const [filterLevel, setFilterLevel] = useState<AlarmLevel | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<PointAlarmSortField>('triggeredAt');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  const defaultPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    if (debouncedSearch.trim()) {
      items.push({
        condition: {
          field: 'message',
          op: 'like' as const,
          value: `%${debouncedSearch.trim()}%`,
        },
      });
    }
    if (filterStatus !== 'ALL') {
      items.push({ condition: { field: 'acknowledged', op: 'eq' as const, value: filterStatus } });
    }
    if (filterLevel !== 'ALL') {
      items.push({ condition: { field: 'level', op: 'eq' as const, value: filterLevel } });
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
  } = useQueryList<AlarmEvent>({
    queryKey: 'pointAlarmEvents',
    queryFn: (body) => queryPointAlarmEvents(body),
    countFn: (body) => countPointAlarmEvents(body),
    defaultSize: 15,
    defaultPredicate,
    defaultOrder,
  });

  useEffect(() => {
    setOrder(defaultOrder);
    setPage(0);
  }, [defaultOrder, setOrder, setPage]);

  const ackMutation = useApiMutation({
    mutationFn: ackAlarmEvent,
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

  const levelOptions: (AlarmLevel | 'ALL')[] = ['ALL', 'INFO', 'WARNING', 'CRITICAL', 'FATAL'];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-foreground">点位级告警事件</h1>
        <p className="mt-1 text-sm text-foreground-500">共 {total} 条</p>
      </header>

      {/* 筛选 / 排序 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="搜索告警信息"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="rounded-medium border border-divider bg-content1 px-3 py-1.5 text-sm outline-none transition focus:border-primary"
        />
        <Select size="sm" variant="bordered" aria-label="状态" className="w-28"
          selectedKeys={[filterStatus]}
          onSelectionChange={(k) => setFilterStatus(Array.from(k)[0] as typeof filterStatus)}>
          <>
            <SelectItem key="ALL">全部</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.key}>{o.label}</SelectItem>
            ))}
          </>
        </Select>
        <Select size="sm" variant="bordered" aria-label="告警级别" className="w-28"
          selectedKeys={[filterLevel]}
          onSelectionChange={(k) => setFilterLevel(Array.from(k)[0] as typeof filterLevel)}>
          <>
            {levelOptions.map((l) => (
              <SelectItem key={l}>
                {l === 'ALL' ? '全部级别' : (LEVEL_LABELS[l] ?? l)}
              </SelectItem>
            ))}
          </>
        </Select>
        <Select size="sm" variant="bordered" aria-label="排序字段" className="w-32"
          selectedKeys={[sortField]}
          onSelectionChange={(k) => setSortField(Array.from(k)[0] as PointAlarmSortField)}>
          <SelectItem key="triggeredAt">发生时间</SelectItem>
          <SelectItem key="recoveredAt">恢复时间</SelectItem>
          <SelectItem key="level">告警级别</SelectItem>
        </Select>
        <Select size="sm" variant="bordered" aria-label="排序方向" className="w-20"
          selectedKeys={[sortDir]}
          onSelectionChange={(k) => setSortDir(Array.from(k)[0] as 'ASC' | 'DESC')}>
          <SelectItem key="DESC">降序</SelectItem>
          <SelectItem key="ASC">升序</SelectItem>
        </Select>
      </div>

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
            {events.map((event) => {
              const ackTime = event.acknowledgedAt ?? event.ackTime;
              return (
                <EntityCard
                  key={event.id}
                  title={event.message || event.level}
                  subtitle={formatDateTime(event.triggeredAt ?? event.occurTime ?? '')}
                  badge={
                    <Chip size="sm" variant="flat" color={LEVEL_COLORS[event.level] ?? 'default'}>
                      {LEVEL_LABELS[event.level] ?? event.level}
                    </Chip>
                  }
                >
                  <FieldRow label="消息" value={event.message} />
                  <FieldRow
                    label="触发值"
                    value={<code className="text-xs">{event.triggerValue ?? '-'}</code>}
                  />
                  <FieldRow
                    label="状态"
                    value={
                      <Chip size="sm" variant="flat" color={STATUS_COLORS[event.acknowledged ?? 'UNACK'] ?? 'default'}>
                        {STATUS_LABELS[event.acknowledged ?? 'UNACK'] ?? '-'}
                      </Chip>
                    }
                  />
                  <FieldRow label="恢复" value={event.recoveredAt ? formatDateTime(event.recoveredAt) : '-'} />
                  <FieldRow label="确认时间" value={ackTime ? formatDateTime(ackTime) : '-'} />
                </EntityCard>
              );
            })}
          </div>
        )
      ) : (
        <Table aria-label="点位级告警事件列表" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
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
            {(event: AlarmEvent) => (
              <TableRow key={event.id}>
                <TableCell>
                  <span className="text-xs text-foreground-600">
                    {formatDateTime(event.triggeredAt ?? event.occurTime ?? '')}
                  </span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={LEVEL_COLORS[event.level] ?? 'default'}>
                    {LEVEL_LABELS[event.level] ?? event.level}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="max-w-[280px] truncate text-sm text-foreground">
                    {event.message}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <code className="text-xs text-foreground-600">{event.triggerValue ?? '-'}</code>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={STATUS_COLORS[event.acknowledged ?? 'UNACK'] ?? 'default'}>
                    {STATUS_LABELS[event.acknowledged ?? 'UNACK'] ?? '-'}
                  </Chip>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-xs text-foreground-600">
                    {event.recoveredAt ? formatDateTime(event.recoveredAt) : '-'}
                  </span>
                </TableCell>
                <TableCell>
                  {event.acknowledged !== 'ACK' && (
                    <Button size="sm" variant="flat" color="success"
                      startContent={<CheckCircleIcon className="h-4 w-4" />}
                      isLoading={ackMutation.isPending}
                      onPress={() => handleAck(event.id)}>
                      确认
                    </Button>
                  )}
                  {event.acknowledged === 'ACK' && (
                    <span className="text-xs text-foreground-500">
                      {event.acknowledgedBy ?? event.ackUserId ?? ''}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-500">共 {total} 条</span>
          <Select size="sm" variant="bordered" className="w-24"
            selectedKeys={[String(size)]}
            onSelectionChange={(k) => setSize(Number(Array.from(k)[0]))}>
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
