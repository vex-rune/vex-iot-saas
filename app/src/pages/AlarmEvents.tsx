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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { queryAlarmEvents, countAlarmEvents, ackAlarmEvent } from '@/api/alarms';
import { useQueryList } from '@/hooks/useQueryList';
import { formatDateTime } from '@/lib/format';
import type { AlarmEvent, Predicate, PredicateItem } from '@/types/api';

const LEVEL_OPTIONS = [
  { key: 'ALL', label: '全部级别' },
  { key: 'INFO', label: '提示' },
  { key: 'WARNING', label: '警告' },
  { key: 'CRITICAL', label: '紧急' },
  { key: 'FATAL', label: '严重' },
];

const ACK_OPTIONS = [
  { key: 'ALL', label: '全部状态' },
  { key: 'UNACK', label: '未确认' },
  { key: 'ACK', label: '已确认' },
];

const LEVEL_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'primary'> = {
  INFO: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
  FATAL: 'danger',
};

const LEVEL_LABELS: Record<string, string> = {
  INFO: '提示',
  WARNING: '警告',
  CRITICAL: '紧急',
  FATAL: '严重',
};

export default function AlarmEvents() {
  const queryClient = useQueryClient();
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterAck, setFilterAck] = useState('ALL');

  const defaultPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [];
    if (filterLevel !== 'ALL') items.push({ condition: { field: 'level', op: 'eq' as const, value: filterLevel } });
    if (filterAck !== 'ALL')   items.push({ condition: { field: 'acknowledged', op: 'eq' as const, value: filterAck } });
    return items.length > 0 ? { and: items } : undefined;
  }, [filterLevel, filterAck]);

  const {
    data: events,
    total,
    page,
    size,
    setPage,
    isLoading,
  } = useQueryList<AlarmEvent>({
    queryKey: 'alarmEvents',
    queryFn: queryAlarmEvents,
    countFn: countAlarmEvents,
    defaultPredicate,
  });

  const ackMutation = useApiMutation({
    mutationFn: ackAlarmEvent,
  });
  const ackUI = useMutation({
    mutationFn: async (id: string) => { await ackMutation.mutateAsync(id); return id; },
    onSuccess: () => {
      addToast({ title: '已确认', color: 'success' });
      queryClient.invalidateQueries({ queryKey: ['alarmEvents'] });
    },
  });

  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-foreground">告警事件</h1>
      </header>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-end gap-2">
        <Select
          size="sm"
          label="级别"
          variant="bordered"
          className="w-28"
          selectedKeys={[filterLevel]}
          onSelectionChange={(keys) => setFilterLevel(Array.from(keys)[0] as string)}
        >
          {LEVEL_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
        <Select
          size="sm"
          label="确认状态"
          variant="bordered"
          className="w-28"
          selectedKeys={[filterAck]}
          onSelectionChange={(keys) => setFilterAck(Array.from(keys)[0] as string)}
        >
          {ACK_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
        <Button size="sm" color="primary" variant="flat" onPress={() => setPage(0)}>
          搜索
        </Button>
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
            暂无告警事件
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((event) => (
              <EntityCard
                key={event.id}
                title={LEVEL_LABELS[event.level] ?? event.level}
                subtitle={formatDateTime(event.triggeredAt)}
                badge={
                  <Chip size="sm" variant="flat" color={event.acknowledged === 'ACK' ? 'success' : 'warning'}>
                    {event.acknowledged === 'ACK' ? '已确认' : '未确认'}
                  </Chip>
                }
                actions={
                  event.acknowledged === 'UNACK' ? (
                    <Button size="sm" variant="flat" color="success"
                      startContent={<CheckCircleIcon className="h-4 w-4" />}
                      isLoading={ackUI.isPending}
                      onPress={() => ackUI.mutate(event.id)}>确认</Button>
                  ) : undefined
                }
              >
                <div className="text-sm text-foreground">{event.message}</div>
                <FieldRow label="设备ID" value={<code className="text-xs">{event.deviceId.slice(0, 8)}</code>} />
                {event.pointCode && (
                  <FieldRow label="点位" value={<code className="text-xs">{event.pointCode}</code>} />
                )}
              </EntityCard>
            ))}
          </div>
        )
      ) : (
        <Table aria-label="告警事件列表" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>触发时间</TableColumn>
            <TableColumn>设备ID</TableColumn>
            <TableColumn className="hidden sm:table-cell">点位</TableColumn>
            <TableColumn>级别</TableColumn>
            <TableColumn>消息</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="暂无告警事件" items={events}>
            {(event: AlarmEvent) => (
              <TableRow key={event.id}>
                <TableCell>
                  <span className="text-xs text-foreground-600">{formatDateTime(event.triggeredAt)}</span>
                </TableCell>
                <TableCell><code className="text-xs text-foreground">{event.deviceId.slice(0, 8)}</code></TableCell>
                <TableCell className="hidden sm:table-cell"><code className="text-xs text-foreground">{event.pointCode ?? '-'}</code></TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={LEVEL_COLORS[event.level]}>
                    {LEVEL_LABELS[event.level] ?? event.level}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="max-w-[200px] truncate text-sm text-foreground">{event.message}</span>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={event.acknowledged === 'ACK' ? 'success' : 'warning'}
                  >
                    {event.acknowledged === 'ACK' ? '已确认' : '未确认'}
                  </Chip>
                </TableCell>
                <TableCell>
                  {event.acknowledged === 'UNACK' && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      startContent={<CheckCircleIcon className="h-4 w-4" />}
                      isLoading={ackUI.isPending}
                      onPress={() => ackUI.mutate(event.id)}
                    >
                      确认
                    </Button>
                  )}
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
    </div>
  );
}
