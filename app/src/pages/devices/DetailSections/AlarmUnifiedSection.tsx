/** 设备详情 - 告警页签 - 仅告警记录(不含告警规则配置)。 */
import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
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
} from '@heroui/react';
import {ackAlarmEvent, countAlarmEvents, queryAlarmEvents} from '@/services/alarmService';
import {getDevice} from '@/services/deviceService';
import {chainToPromise, useQueryList} from '@/hooks/common/useQueryList';
import {EntityCard, FieldRow} from '@/components/ui/EntityCard';
import {useIsMobile} from '@/hooks/common/useMediaQuery';
import {formatDateTime} from '@/lib/format';
import {ALARM_LEVEL_COLORS, ALARM_LEVEL_LABELS} from '@/lib/levelMeta';
import type {AlarmAckStatus, AlarmEvent, Device, Predicate, PredicateItem, QueryBody,} from '@/types/api';

const LEVEL_COLORS = ALARM_LEVEL_COLORS;
const LEVEL_LABELS = ALARM_LEVEL_LABELS;
const STATUS_LABELS: Record<AlarmAckStatus, string> = { UNACK: '未确认', ACK: '已确认' };
const STATUS_COLORS: Record<AlarmAckStatus, 'warning' | 'success'> = { UNACK: 'warning', ACK: 'success' };

interface AlarmUnifiedSectionProps {
  deviceId: string;
}

export default function AlarmUnifiedSection({ deviceId }: AlarmUnifiedSectionProps) {
  const isMobile = useIsMobile();

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
      totalPages,
      page,
      size,
      setSize,
      setPage,
    isLoading: eventsLoading,
    refetch,
  } = useQueryList<AlarmEvent>({
    queryKey: `alarmEvents.device.${deviceId}`,
    queryFn: (body) => queryAlarmEvents(body),
    countFn: (body) => countAlarmEvents(body),
      defaultSize: 15,
    defaultPredicate: eventPredicate,
    defaultOrder: eventOrder,
  });

    if (eventsLoading) {
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
      <div className="flex flex-col gap-4">
          <div className="mb-1 flex items-center gap-3 text-sm text-foreground-500">
              <span>告警记录</span>
              <Chip size="sm" variant="flat">共 {eventTotal} 条</Chip>
          </div>

          {events.length === 0 ? (
              <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
                  暂无告警记录
              </div>
          ) : isMobile ? (
              <div className="grid grid-cols-1 gap-3">
                  {events.map((event) => (
                      <EntityCard
                          key={event.id}
                          title={
                              <span>
                  {LEVEL_LABELS[event.level] ?? event.level}
                                  {(event.triggerCount ?? 1) > 1 && (
                                      <Chip size="sm" variant="flat" color="warning" className="ml-1">
                                          ×{event.triggerCount}
                                      </Chip>
                                  )}
                </span>
                          }
                          subtitle={formatDateTime(event.triggeredAt ?? event.occurTime ?? '')}
                          badge={
                              <Chip size="sm" variant="flat"
                                    color={STATUS_COLORS[event.acknowledged ?? 'UNACK'] ?? 'default'}>
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
                          <div className="text-sm text-foreground">{event.message || '-'}</div>
                          <FieldRow label="设备"
                                    value={device?.deviceName || (event.deviceId ?? '').slice(0, 8) || '-'}/>
                          {event.pointCode &&
                              <FieldRow label="点位" value={<code className="text-xs">{event.pointCode}</code>}/>}
                          {event.triggerValue &&
                              <FieldRow label="触发值" value={<code className="text-xs">{event.triggerValue}</code>}/>}
                          {event.recoveredAt && <FieldRow label="恢复时间" value={formatDateTime(event.recoveredAt)}/>}
                      </EntityCard>
                  ))}
              </div>
          ) : (
              <Table aria-label="告警记录" isStriped classNames={{wrapper: 'bg-content1 rounded-2xl'}}>
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
                              ×{event.triggerCount}
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
                                  <Chip size="sm" variant="flat"
                                        color={STATUS_COLORS[event.acknowledged ?? 'UNACK'] ?? 'default'}>
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

          {/* 分页 */}
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-500">共 {eventTotal} 条</span>
                  <Select size="sm" variant="bordered" className="w-24"
                          selectedKeys={[String(size)]}
                          onSelectionChange={(keys) => setSize(Number(Array.from(keys)[0]))}>
                      {['15', '30', '60', '100'].map((s) => (
                          <SelectItem key={s}>{s}</SelectItem>
                      ))}
                  </Select>
              </div>
              <Pagination total={totalPages} page={page + 1}
                          onChange={(p) => setPage(p - 1)} showControls isCompact/>
          </div>
    </div>
  );
}
