import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { countDevices } from '@/api/devices';
import { queryAlarmEvents, countAlarmEvents } from '@/api/alarms';
import { useEventStream } from '@/hooks/useEventStream';
import { formatDateTime } from '@/lib/format';
import type { AlarmEvent, RealtimePointValue } from '@/types/api';
import { useState, useCallback } from 'react';
import { chainToPromise } from '@/hooks/useQueryList';

const LEVEL_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'primary'> = {
  INFO: 'success', WARNING: 'warning', CRITICAL: 'danger', FATAL: 'danger',
};

export default function Dashboard() {
  // KPI
  const deviceCountQ = useQuery({
    queryKey: ['dashboard.deviceCount'],
    queryFn: () => chainToPromise(countDevices({})),
  });
  const onlineCountQ = useQuery({
    queryKey: ['dashboard.onlineCount'],
    queryFn: () => chainToPromise(countDevices({ predicate: { and: [{ condition: { field: 'online', op: 'eq', value: 'ONLINE' } }] } })),
  });
  const alarmCountQ = useQuery({
    queryKey: ['dashboard.alarmCount'],
    queryFn: () => chainToPromise(countAlarmEvents({})),
  });
  const unackCountQ = useQuery({
    queryKey: ['dashboard.unackCount'],
    queryFn: () => chainToPromise(countAlarmEvents({ predicate: { and: [{ condition: { field: 'acknowledged', op: 'eq', value: 'UNACK' } }] } })),
  });

  // 最近告警 Top 10 (QueryOrder 已改为 field, 之前的 fieldName 已清理)
  const recentAlarmsQ = useQuery({
    queryKey: ['dashboard.recentAlarms'],
    queryFn: () => chainToPromise(queryAlarmEvents({ page: { page: 0, size: 10 }, order: [{ field: 'triggeredAt', order: 'DESC' }] })),
  });

  // 实时点位(本地缓存,最多 20 条)
  const [realtimePoints, setRealtimePoints] = useState<RealtimePointValue[]>([]);
  const handlePointUpdate = useCallback((e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as RealtimePointValue;
      setRealtimePoints((prev) => {
        const next = [data, ...prev.filter((p) => p.pointCode !== data.pointCode)];
        return next.slice(0, 20);
      });
    } catch { /* ignore */ }
  }, []);
  useEventStream({ 'point.realtime': handlePointUpdate });

  const recentData = recentAlarmsQ.data ?? [];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">概览</h1>
          <p className="text-xs text-foreground-500">实时监控关键指标</p>
        </div>
        <Chip variant="flat" color="success">SSE 已连接</Chip>
      </header>

      {/* KPI 卡片 — 背景 bg-content1, HeroUI 语义色 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="设备总数" value={deviceCountQ.data} isLoading={deviceCountQ.isLoading} />
        <KpiCard label="在线设备" value={onlineCountQ.data} isLoading={onlineCountQ.isLoading} color="success" />
        <KpiCard label="今日告警" value={alarmCountQ.data} isLoading={alarmCountQ.isLoading} color="warning" />
        <KpiCard label="未确认告警" value={unackCountQ.data} isLoading={unackCountQ.isLoading} color="danger" />
      </div>

      {/* 最近告警 */}
      <Card>
        <CardHeader className="flex justify-between">
          <span className="font-medium text-foreground">最近告警</span>
          <span className="text-xs text-foreground-500">Top 10</span>
        </CardHeader>
        <CardBody>
          {recentAlarmsQ.isLoading ? (
            <Spinner size="sm" />
          ) : recentData.length === 0 ? (
            <p className="py-4 text-center text-sm text-foreground-500">暂无告警</p>
          ) : (
            <Table aria-label="最近告警" removeWrapper>
              <TableHeader>
                <TableColumn>时间</TableColumn>
                <TableColumn>设备</TableColumn>
                <TableColumn className="hidden sm:table-cell">级别</TableColumn>
                <TableColumn>消息</TableColumn>
                <TableColumn>状态</TableColumn>
              </TableHeader>
              <TableBody items={recentData}>
                {(event: AlarmEvent) => (
                  <TableRow key={event.id}>
                    <TableCell><span className="text-xs text-foreground-600">{formatDateTime(event.triggeredAt)}</span></TableCell>
                    <TableCell><code className="text-xs text-foreground">{event.deviceId.slice(0, 8)}</code></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Chip size="sm" variant="flat" color={LEVEL_COLORS[event.level]}>{event.level}</Chip>
                    </TableCell>
                    <TableCell><span className="max-w-[180px] truncate text-sm text-foreground">{event.message}</span></TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={event.acknowledged === 'ACK' ? 'success' : 'warning'}>
                        {event.acknowledged === 'ACK' ? '已确认' : '未确认'}
                      </Chip>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* 实时点位 */}
      <Card>
        <CardHeader>
          <span className="font-medium text-foreground">实时点位推送</span>
        </CardHeader>
        <CardBody>
          {realtimePoints.length === 0 ? (
            <p className="py-4 text-center text-sm text-foreground-500">等待 SSE 推送...</p>
          ) : (
            <Table aria-label="实时点位" removeWrapper>
              <TableHeader>
                <TableColumn>点位名</TableColumn>
                <TableColumn>编码</TableColumn>
                <TableColumn>当前值</TableColumn>
                <TableColumn className="hidden sm:table-cell">单位</TableColumn>
              </TableHeader>
              <TableBody items={realtimePoints}>
                {(point: RealtimePointValue) => (
                  <TableRow key={point.pointCode}>
                    <TableCell className="text-foreground">{point.pointName}</TableCell>
                    <TableCell><code className="text-xs text-foreground">{point.pointCode}</code></TableCell>
                    <TableCell><span className="font-mono twinkle text-primary-600">{point.displayValue || point.rawValue}</span></TableCell>
                    <TableCell className="hidden sm:table-cell text-foreground-500">{point.unit ?? '-'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, isLoading, color }: {
  label: string;
  value?: number;
  isLoading?: boolean;
  color?: 'success' | 'warning' | 'danger';
}) {
  const colorClass =
    color === 'success' ? 'text-success-600' :
    color === 'warning' ? 'text-warning-600' :
    color === 'danger'  ? 'text-danger-600'  : 'text-foreground';

  return (
    <Card shadow="sm">
      <CardBody className="gap-1 p-4">
        <span className="text-xs text-foreground-500">{label}</span>
        <span className={`text-2xl font-semibold ${colorClass}`}>
          {isLoading ? <Spinner size="sm" /> : (value ?? 0).toLocaleString()}
        </span>
      </CardBody>
    </Card>
  );
}
