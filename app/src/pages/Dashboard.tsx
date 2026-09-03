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
import { queryAlarmEvents } from '@/api/alarms';
import { queryActiveDevices, countActiveDevices, getDevicePoints, getPanelConfig } from '@/api/devices';
import { useEventStream } from '@/hooks/useEventStream';
import { onRealtimePoint } from '@/services/deviceData';
import { useQueryList, chainToPromise } from '@/hooks/useQueryList';
import { formatDateTime } from '@/lib/format';
import type { AlarmEvent, RealtimePointValue, Device, PointDefinition } from '@/types/api';
import { useState, useCallback, useMemo } from 'react';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { ALARM_LEVEL_COLORS } from '@/lib/levelMeta';
import DeviceCard from '@/components/DeviceCard';
import { useDeviceHeartbeats } from '@/hooks/useDeviceHeartbeats';
import SearchFilterBar from '@/components/list/SearchFilterBar';
import PanelRenderer from '@/components/panel/PanelRenderer';
import { parsePanelConfig } from '@/components/panel/types';
import { ChartBarIcon } from '@heroicons/react/24/outline';

const LEVEL_COLORS = ALARM_LEVEL_COLORS;

export default function Dashboard() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  /** Dashboard 设备列表的本地搜索关键字(名称 + 三级标签,前端过滤) */
  const [keyword, setKeyword] = useState('');

  const kpis = useDashboardKpis();

  const devicesQuery = useQueryList<Device>({
    queryKey: 'devices.dashboard',
    queryFn: queryActiveDevices,
    countFn: countActiveDevices,
    defaultSize: 100,
  });
  const allDevices = devicesQuery.data ?? [];
  /** 客户端过滤:命中设备名称 / 三级标签任一即保留 */
  const devices = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return allDevices;
    return allDevices.filter((d) => {
      if (d.deviceName?.toLowerCase().includes(k)) return true;
      if (d.level1Tag?.toLowerCase().includes(k)) return true;
      if (d.level2Tag?.toLowerCase().includes(k)) return true;
      if (d.level3Tag?.toLowerCase().includes(k)) return true;
      return false;
    });
  }, [allDevices, keyword]);
  const selectedDevice = allDevices.find(d => d.id === selectedDeviceId);

  // 设备心跳(专用接口,N+1):用于 Dashboard 紧凑列表的"🟢🟡⚪ 圆点 + 相对时间"
  // 取原始 allDevices(未过滤)的所有 ID,保证搜索期间已选设备的心跳不被清空
  const { heartbeatMap } = useDeviceHeartbeats(allDevices.map(d => d.id));

  const panelQuery = useQuery({
    queryKey: ['device.panel-config', selectedDeviceId],
    queryFn: () => chainToPromise(getPanelConfig(selectedDeviceId!)),
    enabled: !!selectedDeviceId,
  });
  const config = panelQuery.data ? parsePanelConfig(panelQuery.data.panelConfig) : null;

  const pointsQuery = useQuery({
    queryKey: ['device.points', selectedDeviceId],
    queryFn: () => chainToPromise(getDevicePoints(selectedDeviceId!)),
    enabled: !!selectedDeviceId,
  });
  const points: PointDefinition[] = pointsQuery.data ?? [];

  const recentAlarmsQ = useQuery({
    queryKey: ['dashboard.recentAlarms'],
    queryFn: () => chainToPromise(queryAlarmEvents({ page: { page: 0, size: 10 }, order: [{ field: 'triggeredAt', order: 'DESC' }] })),
  });

  const [realtimePoints, setRealtimePoints] = useState<RealtimePointValue[]>([]);
  const handlePointUpdate = useCallback((payload: unknown) => {
    const data = payload as RealtimePointValue;
    if (!data?.pointCode) return;
    // 写入全局 service 缓存（面板 widget 读取）
    onRealtimePoint(data);
    // 更新本地 state（Dashboard 实时点位卡片）
    setRealtimePoints((prev) => {
      const next = [data, ...prev.filter((p) => p.pointCode !== data.pointCode)];
      return next.slice(0, 20);
    });
  }, []);
  useEventStream({ 'point.realtime': handlePointUpdate });

  const recentData = recentAlarmsQ.data ?? [];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">控制台</h1>
          <p className="text-xs text-foreground-500">实时监控关键指标</p>
        </div>
        <Chip variant="flat" color="success">SSE 已连接</Chip>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="设备总数" value={kpis.deviceTotal} isLoading={kpis.isLoading} />
        <KpiCard label="在线设备" value={kpis.onlineTotal} isLoading={kpis.isLoading} color="success" />
        <KpiCard label="今日告警" value={kpis.alarmTotal} isLoading={kpis.isLoading} color="warning" />
        <KpiCard label="未确认告警" value={kpis.unackTotal} isLoading={kpis.isLoading} color="danger" />
      </div>

      {/* Dashboard 设备列表的快速搜索(名称 + 三级标签,前端过滤) */}
      <SearchFilterBar
        searchPlaceholder="搜索名称 / 标签"
        searchValue={keyword}
        onSearchChange={setKeyword}
      />

      <DesktopDevicePanel
        devices={devices} selectedDeviceId={selectedDeviceId} selectedDevice={selectedDevice}
        config={config} points={points} onSelectDevice={setSelectedDeviceId}
        heartbeats={heartbeatMap}
      />

      <RecentAlarmsCard recentAlarmsQ={recentAlarmsQ} recentData={recentData} />
      <RealtimePointsCard realtimePoints={realtimePoints} />
    </div>
  );
}

function DesktopDevicePanel({ devices, selectedDeviceId, selectedDevice, config, points, onSelectDevice, heartbeats }: any) {
  return (
    // min-h-[800px] 保证最小高度,flex 默认 align-items: stretch 让左右等高,
    // 内容多时各自自然撑开,内容少时统一保底 800px
    <div className="flex flex-row gap-4 min-h-[800px]">
      <div className="w-[160px] shrink-0 sm:w-[200px] lg:w-[260px]">
        <div className="sticky top-2 max-h-[calc(100vh-160px)] overflow-y-auto rounded-xl bg-content1 p-2">
          <div className="mb-2 px-2 text-sm font-medium text-foreground">设备列表</div>
          <div className="space-y-1">
            {devices.map((d: Device) => (
              <DeviceCard key={d.id} device={d} compact selected={d.id === selectedDeviceId}
                heartbeats={heartbeats}
                onPress={() => onSelectDevice(d.id)} />
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 rounded-xl bg-content1 p-3">
        {selectedDeviceId && config ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">监控面板 - {selectedDevice?.deviceName}</span>
            </div>
            <PanelRenderer config={config} deviceId={selectedDeviceId} points={points} />
          </div>
        ) : (
          <Card>
            <CardBody className="flex flex-col items-center justify-center py-12 gap-3">
              <ChartBarIcon className="h-10 w-10 text-foreground-300" />
              <p className="text-foreground-500">请选择设备查看监控面板</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function RecentAlarmsCard({ recentAlarmsQ, recentData }: any) {
  return (
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
                  <TableCell><code className="text-xs text-foreground">{(event.deviceId ?? '').slice(0, 8) || '-'}</code></TableCell>
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
  );
}

function RealtimePointsCard({ realtimePoints }: { realtimePoints: RealtimePointValue[] }) {
  return (
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
                  <TableCell><span className="font-mono twinkle text-primary-600">{point.value ?? point.rawValue}</span></TableCell>
                  <TableCell className="hidden sm:table-cell text-foreground-500">-</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
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