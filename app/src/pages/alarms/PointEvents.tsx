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
import { useMemo, useState } from 'react';
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
} from '@/services/alarms';
import { useApiMutation } from '@/hooks/common/useApiMutation';
import { useIsMobile } from '@/hooks/common/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/ui/EntityCard';
import { useQueryList } from '@/hooks/common/useQueryList';
import SearchFilterBar from '@/components/ui/common/SearchFilterBar';
import type { DateRangeValue, FilterGroupSpec } from '@/components/ui/common/SearchFilterBar';
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
  // 输入即时态:仅写到本地
  const [searchText, setSearchText] = useState('');
  // 提交态(按下"搜索"或"重置"后生效,触发查询)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<AlarmAckStatus | 'ALL'>('ALL');
  const [filterLevel, setFilterLevel] = useState<AlarmLevel | 'ALL'>('ALL');
  /** 触发时间范围（按告警发生时间过滤） */
  const [dateRange, setDateRange] = useState<DateRangeValue>({ start: null, end: null });
  const [sortField, setSortField] = useState<PointAlarmSortField>('triggeredAt');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  const defaultPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    if (appliedSearch.trim()) {
      items.push({
        condition: {
          field: 'message',
          op: 'like' as const,
          value: `%${appliedSearch.trim()}%`,
        },
      });
    }
    if (filterStatus !== 'ALL') {
      items.push({ condition: { field: 'acknowledged', op: 'eq' as const, value: filterStatus } });
    }
    if (filterLevel !== 'ALL') {
      items.push({ condition: { field: 'level', op: 'eq' as const, value: filterLevel } });
    }
    // 触发时间范围（按 triggeredAt触发，闭区间）
    if (dateRange.start) {
      items.push({
        condition: { field: 'triggeredAt', op: 'gte' as const, value: dateRange.start.toString() },
      });
    }
    if (dateRange.end) {
      // end 闭区间：转为次日 00:00 前（含时分的时：加1天后重置 00:00）
      const next = dateRange.end
        .add({ days: 1 })
        .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      items.push({
        condition: { field: 'triggeredAt', op: 'lt' as const, value: next.toString() },
      });
    }
    return items.length > 0 ? { and: items } : undefined;
  }, [appliedSearch, filterStatus, filterLevel, dateRange]);

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
  // 搜索/筛选/排序/日期由 useQueryList 内部自动同步,无需额外 effect

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
        <h1 className="text-xl font-semibold text-foreground">告警事件</h1>
        <p className="mt-1 text-sm text-foreground-500">共 {total} 条</p>
      </header>

      {/* 筛选 / 排序 / 搜索 / 日历 */}
      <SearchFilterBar
        searchPlaceholder="搜索告警信息"
        searchValue={searchText}
        onSearchChange={setSearchText}
        onSearch={() => setAppliedSearch(searchText)}
        dateRange={{
          label: '触发时间',
          value: dateRange,
          onChange: setDateRange,
        }}
        sort={{
          fields: [
            { key: 'triggeredAt', label: '发生时间' },
            { key: 'recoveredAt', label: '恢复时间' },
            { key: 'level', label: '告警级别' },
          ],
          value: sortField,
          onChange: (k: string) => setSortField(k as PointAlarmSortField),
          dir: sortDir,
          onDirChange: setSortDir,
        }}
        filters={[
          {
            label: '状态',
            value: filterStatus,
            options: [
              { key: 'ALL', label: '全部' },
              ...STATUS_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
            ],
            onChange: (v: string) => setFilterStatus(v as typeof filterStatus),
          },
          {
            label: '级别',
            value: filterLevel,
            options: levelOptions.map((l) => ({
              key: l,
              label: l === 'ALL' ? '全部级别' : (LEVEL_LABELS[l] ?? l),
            })),
            onChange: (v: string) => setFilterLevel(v as typeof filterLevel),
          },
        ] satisfies FilterGroupSpec[]}
        onReset={() => {
          setSearchText('');
          setAppliedSearch('');
          setFilterStatus('ALL');
          setFilterLevel('ALL');
          setDateRange({ start: null, end: null });
          setSortField('triggeredAt');
          setSortDir('DESC');
        }}
      />

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
                    value={<code className="text-xs">{event.triggerCount ?? '-'}</code>}
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
        <Table aria-label="告警事件" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
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
                    {(event.triggerCount ?? 1) > 1 && (
                      <Chip size="sm" variant="flat" color="warning" className="ml-1">
                        ×{event.triggerCount}
                      </Chip>
                    )}
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
