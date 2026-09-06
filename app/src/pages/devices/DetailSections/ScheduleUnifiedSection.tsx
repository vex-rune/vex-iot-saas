/** 设备详情 - 定时任务页签 - 合并视图(控制设置预览 + 执行记录预览)。 */
import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
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
import {listDeviceSchedules} from '@/services/scheduleService';
import type {ControlRecord} from '@/services/controlRecordService';
import {countControlRecords, queryControlRecords} from '@/services/controlRecordService';
import {chainToPromise, useQueryList} from '@/hooks/common/useQueryList';
import {EntityCard, FieldRow} from '@/components/ui/EntityCard';
import {useIsMobile} from '@/hooks/common/useMediaQuery';
import {formatDateTime} from '@/lib/format';
import {cronToPlain} from '@/lib/cron';
import type {DeviceScheduleDetail, Predicate, PredicateItem, QueryBody,} from '@/types/api';

interface ScheduleUnifiedSectionProps {
  deviceId: string;
}

/** 状态 → Chip 颜色 */
function statusColor(status?: string) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAIL') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'default';
}

export default function ScheduleUnifiedSection({ deviceId }: ScheduleUnifiedSectionProps) {
  const isMobile = useIsMobile();

  const { data: items = [], isLoading } = useQuery<DeviceScheduleDetail[]>({
    queryKey: ['schedules.list.byDevice', deviceId],
    queryFn: () => chainToPromise(listDeviceSchedules(deviceId)),
    enabled: !!deviceId,
  });

  const rows = useMemo(() => items.map((it) => it.schedule), [items]);

  const recordPredicate = useMemo<Predicate | undefined>(() => {
    const items: PredicateItem[] = [
      { condition: { field: 'deviceId', op: 'eq', value: deviceId } },
    ];
    return { and: items };
  }, [deviceId]);

  const recordOrder = useMemo<QueryBody['order']>(
    () => [{ field: 'occurredAt', order: 'DESC' }],
    [],
  );

  const {
    data: records,
    total: recordTotal,
    page,
    size,
    setPage,
    setSize,
    totalPages,
  } = useQueryList<ControlRecord>({
    queryKey: `controlRecords.device.${deviceId}`,
    queryFn: (body) => queryControlRecords(body),
    countFn: (body) => countControlRecords(body),
    defaultSize: 15,
    defaultPredicate: recordPredicate,
    defaultOrder: recordOrder,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-content1 p-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center gap-3 text-sm text-foreground-500">
          <span>定时规则</span>
          <Chip size="sm" variant="flat">共 {rows.length} 条</Chip>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无定时规则
          </div>
        ) : isMobile ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((s) => (
              <EntityCard
                key={s.id}
                title={s.name || '未命名规则'}
                subtitle={cronToPlain(s.cron)}
                badge={
                  <Chip size="sm" variant="flat" color={s.enabled === false ? 'default' : 'success'}>
                    {s.enabled === false ? '停用' : '启用'}
                  </Chip>
                }
              >
                <FieldRow label="最近执行" value={
                  <span className="text-xs">{s.lastFireAt ? formatDateTime(s.lastFireAt) : '-'}</span>
                } />
                {s.description && (
                  <FieldRow label="说明" value={s.description} />
                )}
              </EntityCard>
            ))}
          </div>
        ) : (
          <Table aria-label="定时任务" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
            <TableHeader>
              <TableColumn>规则名称</TableColumn>
              <TableColumn>执行频率</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn>最近执行</TableColumn>
              <TableColumn className="hidden md:table-cell">说明</TableColumn>
            </TableHeader>
            <TableBody items={rows} emptyContent="暂无定时规则">
              {(s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{s.name || '未命名规则'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-foreground">{cronToPlain(s.cron)}</span>
                      <code className="text-[11px] text-foreground-400">{s.cron || '-'}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={s.enabled === false ? 'default' : 'success'}>
                      {s.enabled === false ? '停用' : '启用'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-foreground-600">
                      {s.lastFireAt ? formatDateTime(s.lastFireAt) : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="max-w-[280px] truncate text-sm text-foreground-500">
                      {s.description || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-foreground-500">
          <div className="flex items-center gap-2">
            <span>执行记录</span>
            <Chip size="sm" variant="flat">共 {recordTotal} 条</Chip>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无执行记录
          </div>
        ) : isMobile ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {records.map((r) => (
              <EntityCard
                key={r.id}
                title={r.pointName || r.pointCode || '控制任务'}
                subtitle={formatDateTime(r.occurredAt ?? r.createdAt ?? '')}
                badge={
                  <Chip size="sm" variant="flat" color={statusColor(r.status)}>
                    {r.status || '-'}
                  </Chip>
                }
              >
                {r.deviceName && <FieldRow label="设备" value={r.deviceName} />}
                {r.pointCode && <FieldRow label="点位" value={<code className="text-xs">{r.pointCode}</code>} />}
                {r.inputValue && <FieldRow label="下发值" value={<code className="text-xs">{r.inputValue}</code>} />}
                {r.writtenValue && <FieldRow label="回执值" value={<code className="text-xs">{r.writtenValue}</code>} />}
                {r.writtenAt && <FieldRow label="回执时间" value={formatDateTime(r.writtenAt)} />}
                {r.errorMessage && <FieldRow label="错误" value={r.errorMessage} />}
              </EntityCard>
            ))}
          </div>
        ) : (
          <div className="overflow-auto rounded-xl bg-content1">
            <Table aria-label="执行记录" isStriped removeWrapper>
              <TableHeader>
                <TableColumn>时间</TableColumn>
                <TableColumn>设备</TableColumn>
                <TableColumn>点位</TableColumn>
                <TableColumn>下发值</TableColumn>
                <TableColumn>回执值</TableColumn>
                <TableColumn>状态</TableColumn>
                <TableColumn className="hidden md:table-cell">错误</TableColumn>
              </TableHeader>
              <TableBody items={records} emptyContent="暂无执行记录">
                {(r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="text-xs text-foreground-600">{formatDateTime(r.occurredAt ?? r.createdAt ?? '')}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-foreground-600">{r.deviceName || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-foreground-600">{r.pointName || r.pointCode || '-'}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-foreground-600">{r.inputValue || '-'}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-foreground-600">{r.writtenValue || '-'}</code>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={statusColor(r.status)}>
                        {r.status || '-'}
                      </Chip>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="max-w-[260px] truncate text-sm text-foreground-500">{r.errorMessage || '-'}</span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-500">共 {recordTotal} 条</span>
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
        )}
      </section>
    </div>
  );
}

