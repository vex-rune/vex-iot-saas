/** 设备详情 - 告警页签 - 合并视图(告警规则 + 告警记录)。 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { getAlarmRulesByDevice, queryAlarmEvents, countAlarmEvents, ackAlarmEvent } from '@/services/alarms';
import { getDevice } from '@/services/device';
import { chainToPromise, useQueryList } from '@/hooks/common/useQueryList';
import { EntityCard, FieldRow } from '@/components/ui/EntityCard';
import { useIsMobile } from '@/hooks/common/useMediaQuery';
import { formatDateTime } from '@/lib/format';
import { ALARM_LEVEL_COLORS, ALARM_LEVEL_LABELS } from '@/lib/levelMeta';
import type {
  AlarmEvent,
  AlarmAckStatus,
  AlarmRule,
  Device,
  Predicate,
  PredicateItem,
  QueryBody,
} from '@/types/api';

const LEVEL_COLORS = ALARM_LEVEL_COLORS;
const LEVEL_LABELS = ALARM_LEVEL_LABELS;
const STATUS_LABELS: Record<AlarmAckStatus, string> = { UNACK: '未确认', ACK: '已确认' };
const STATUS_COLORS: Record<AlarmAckStatus, 'warning' | 'success'> = { UNACK: 'warning', ACK: 'success' };

interface AlarmUnifiedSectionProps {
  deviceId: string;
}

export default function AlarmUnifiedSection({ deviceId }: AlarmUnifiedSectionProps) {
  const isMobile = useIsMobile();

  const { data: rules, isLoading: rulesLoading } = useQuery<AlarmRule[]>({
    queryKey: ['alarmRules.byDevice', deviceId],
    queryFn: () => chainToPromise(getAlarmRulesByDevice(deviceId)),
    enabled: !!deviceId,
  });

  const { data: device } = useQuery<Device>({
    queryKey: ['device', deviceId],
    queryFn: () => chainToPromise(getDevice(deviceId)),
    enabled: !!deviceId,
  });

  const eventPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [
      { condition: { field: 'deviceId', op: 'eq', value: deviceId } },
    ];
    return { and: items };
  }, [deviceId]);

  const eventOrder = useMemo<QueryBody['order']>(
    () => [{ field: 'triggeredAt', order: 'DESC' }],
    [],
  );

  const {
    data: events,
    total: eventTotal,
    isLoading: eventsLoading,
    refetch,
  } = useQueryList<AlarmEvent>({
    queryKey: `alarmEvents.device.${deviceId}`,
    queryFn: (body) => queryAlarmEvents(body),
    countFn: (body) => countAlarmEvents(body),
    defaultSize: 10,
    defaultPredicate: eventPredicate,
    defaultOrder: eventOrder,
  });

  const stats = useMemo(() => {
    const total = rules?.length ?? 0;
    const enabled = rules?.filter((r) => r.enabled !== false).length ?? 0;
    return { total, enabled, disabled: total - enabled };
  }, [rules]);

  const loading = rulesLoading || eventsLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-content1 p-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full rounded-lg" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center gap-3 text-sm text-foreground-500">
          <span>告警规则</span>
          <Chip size="sm" variant="flat">共 {stats.total} 条</Chip>
          <Chip size="sm" variant="flat" color="success">启用 {stats.enabled}</Chip>
          {stats.disabled > 0 && (
            <Chip size="sm" variant="flat" color="warning">停用 {stats.disabled}</Chip>
          )}
        </div>

        {!rules || rules.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无告警规则，请在编辑模式下配置
          </div>
        ) : isMobile ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rules.map((r) => (
              <EntityCard
                key={r.id}
                title={r.ruleName || r.pointCode || '设备级规则'}
                subtitle={r.pointCode ? `点位: ${r.pointCode}` : '设备级规则'}
                badge={
                  <div className="flex items-center gap-1">
                    <Chip size="sm" variant="flat" color={LEVEL_COLORS[r.level] ?? 'default'}>
                      {LEVEL_LABELS[r.level] ?? r.level}
                    </Chip>
                    <Chip size="sm" variant="flat" color={r.enabled === false ? 'default' : 'success'}>
                      {r.enabled === false ? '停用' : '启用'}
                    </Chip>
                  </div>
                }
              >
                <FieldRow label="条件" value={
                  <span className="text-sm text-foreground-600">
                    {r.conditionType} {r.threshold}
                    {r.conditionType === 'BETWEEN' && r.thresholdHigh ? ` ~ ${r.thresholdHigh}` : ''}
                  </span>
                } />
                {r.conditionName && <FieldRow label="条件名称" value={r.conditionName} />}
              </EntityCard>
            ))}
          </div>
        ) : (
          <Table aria-label="告警规则" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
            <TableHeader>
              <TableColumn>规则名称</TableColumn>
              <TableColumn>点位</TableColumn>
              <TableColumn>条件</TableColumn>
              <TableColumn>阈值</TableColumn>
              <TableColumn>级别</TableColumn>
              <TableColumn>状态</TableColumn>
            </TableHeader>
            <TableBody items={rules} emptyContent="暂无告警规则">
              {(r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{r.ruleName || r.pointCode || '设备级规则'}</span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-foreground-600">{r.pointCode || '-'}</code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground-600">{r.conditionType}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-foreground-600">
                      {r.threshold}
                      {r.conditionType === 'BETWEEN' && r.thresholdHigh ? ` ~ ${r.thresholdHigh}` : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={LEVEL_COLORS[r.level] ?? 'default'}>
                      {LEVEL_LABELS[r.level] ?? r.level}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={r.enabled === false ? 'default' : 'success'}>
                      {r.enabled === false ? '停用' : '启用'}
                    </Chip>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3 text-sm text-foreground-500">
          <span>最近告警记录</span>
          <Chip size="sm" variant="flat">共 {eventTotal} 条</Chip>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无告警记录
          </div>
        ) : isMobile ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {events.map((event) => (
              <EntityCard
                key={event.id}
                title={
                  <span>
                    {LEVEL_LABELS[event.level] ?? event.level}
                    {(event.triggerCount ?? 1) > 1 && (
                      <Chip size="sm" variant="flat" color="warning" className="ml-1">
                        x{event.triggerCount}
                      </Chip>
                    )}
                  </span>
                }
                subtitle={formatDateTime(event.triggeredAt ?? event.occurTime ?? '')}
                badge={
                  <Chip size="sm" variant="flat" color={STATUS_COLORS[event.acknowledged ?? 'UNACK'] ?? 'default'}>
                    {STATUS_LABELS[event.acknowledged ?? 'UNACK'] ?? '-'}
                  </Chip>
                }
                actions={
                  event.acknowledged !== 'ACK' ? (
                    <Button size="sm" variant="flat" color="success"
                      onPress={async () => {
                        await chainToPromise(ackAlarmEvent(event.id));
                        refetch();
                      }}>
                      确认
                    </Button>
                  ) : undefined
                }
              >
                <FieldRow label="设备" value={
                  <span className="text-xs">{device?.deviceName || (event.deviceId ?? '').slice(0, 8) || '-'}</span>
                } />
                <div className="text-sm text-foreground">{event.message || '-'}</div>
                {event.pointCode && (
                  <FieldRow label="点位" value={<code className="text-xs">{event.pointCode}</code>} />
                )}
                {event.triggerValue && (
                  <FieldRow label="触发值" value={<code className="text-xs">{event.triggerValue}</code>} />
                )}
                <FieldRow label="恢复时间" value={
                  <span className="text-xs">{event.recoveredAt ? formatDateTime(event.recoveredAt) : '-'}</span>
                } />
              </EntityCard>
            ))}
          </div>
        ) : (
          <Table aria-label="告警记录" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
            <TableHeader>
              <TableColumn>发生时间</TableColumn>
              <TableColumn>级别</TableColumn>
              <TableColumn>设备名称</TableColumn>
              <TableColumn>告警信息</TableColumn>
              <TableColumn className="hidden sm:table-cell">点位</TableColumn>
              <TableColumn className="hidden sm:table-cell">触发值</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn className="hidden md:table-cell">恢复时间</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody items={events} emptyContent="暂无告警记录">
              {(event) => (
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
                    <span className="text-sm text-foreground">
                      {device?.deviceName || (event.deviceId ?? '').slice(0, 8) || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="max-w-[260px] truncate text-sm text-foreground">
                      {event.message || '-'}
                      {(event.triggerCount ?? 1) > 1 && (
                        <Chip size="sm" variant="flat" color="warning" className="ml-1">
                          x{event.triggerCount}
                        </Chip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <code className="text-xs text-foreground-600">{event.pointCode || '-'}</code>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <code className="text-xs text-foreground-600">{event.triggerValue || '-'}</code>
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
                        onPress={async () => {
                          await chainToPromise(ackAlarmEvent(event.id));
                          refetch();
                        }}>
                        确认
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

