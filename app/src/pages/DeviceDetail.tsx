import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Tab,
  Tabs,
} from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useQueryList, chainToPromise } from '@/hooks/useQueryList';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  CpuChipIcon,
  WifiIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import {
  getDevice,
  getDeviceRealtime,
  getDevicePoints,
  queryActiveDevices,
  countActiveDevices,
} from '@/api/devices';
import { formatDateTime } from '@/lib/format';
import type { Device, PointDefinition } from '@/types/api';
import { DeviceCard } from '@/components/DeviceCard';
import PanelRenderer from '@/components/panel/PanelRenderer';
import { parsePanelConfig } from '@/components/panel/types';

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const deviceQuery = useQuery({
    queryKey: ['device', id],
    queryFn: () => chainToPromise(getDevice(id!)),
    enabled: !!id,
  });

  const device = deviceQuery.data as Device | undefined;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button isIconOnly variant="light" onPress={() => navigate('/devices')}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        {deviceQuery.isLoading ? (
          <Skeleton className="h-8 w-64 rounded-lg" />
        ) : device ? (
          <>
            <span className="font-semibold text-foreground">{device.deviceName}</span>
            <Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'danger'}>
              {device.online === 'ONLINE' ? '在线' : '离线'}
            </Chip>
            <Chip size="sm" variant="flat" color={device.enabled ? 'primary' : 'default'}>
              {device.enabled ? '启用' : '禁用'}
            </Chip>
            {[device.level1Tag, device.level2Tag, device.level3Tag]
              .filter((t): t is string => !!t && t.trim().length > 0)
              .map((t) => (
                <Chip key={t} size="sm" variant="flat" color="default">{t}</Chip>
              ))}
          </>
        ) : (
          <span className="text-foreground-500">设备不存在</span>
        )}
      </div>
      <Divider />
      {device && (
        <div className="flex flex-col gap-3">
          <Tabs size="sm" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}
            classNames={{ tabList: 'gap-4 px-0', cursor: 'bg-primary' }}>
            <Tab key="overview" title={<span className="flex items-center gap-1.5"><ChartBarIcon className="h-4 w-4" />概览</span>} />
            <Tab key="basic" title={<span className="flex items-center gap-1.5"><CpuChipIcon className="h-4 w-4" />基础信息</span>} />
            <Tab key="connection" title={<span className="flex items-center gap-1.5"><WifiIcon className="h-4 w-4" />连接信息</span>} />
            <Tab key="realtime" title={<span className="flex items-center gap-1.5"><ClockIcon className="h-4 w-4" />实时数据</span>} />
          </Tabs>
          {activeTab === 'overview' && <OverviewSection device={device} />}
          {activeTab === 'basic' && <BasicInfoSection device={device} />}
          {activeTab === 'connection' && <ConnectionInfoSection device={device} />}
          {activeTab === 'realtime' && <RealtimeDataSection deviceId={device.id} />}
        </div>
      )}
    </div>
  );
}

function OverviewSection({ device }: { device: Device }) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(device.id);

  // 获取设备列表
  const devicesQuery = useQueryList<Device>({
    queryKey: 'devices.overview',
    queryFn: queryActiveDevices,
    countFn: countActiveDevices,
    defaultSize: 100,
  });
  const devices = devicesQuery.data ?? [];

  // 选中的设备
  const selectedDevice = devices.find(d => d.id === selectedDeviceId) ?? device;

  const draftKey = `panel.draft.${selectedDeviceId}`;
  const config = parsePanelConfig(localStorage.getItem(draftKey));

  const pointsQuery = useQuery({
    queryKey: ['device.points', selectedDeviceId],
    queryFn: () => chainToPromise(getDevicePoints(selectedDeviceId)),
    enabled: !!selectedDeviceId,
  });
  const points: PointDefinition[] = pointsQuery.data ?? [];

  const realtimeQuery = useQuery({
    queryKey: ['device.realtime', selectedDeviceId],
    queryFn: () => chainToPromise(getDeviceRealtime(selectedDeviceId)),
    refetchInterval: 3000,
    enabled: !!selectedDeviceId,
  });

  const realtimePoints = realtimeQuery.data?.points ?? [];

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        <div className="sticky top-2 z-10">
          <Button variant="flat" className="w-full justify-between bg-content1"
            onPress={() => setDrawerOpen(true)} endContent={<ChevronDownIcon className="h-4 w-4" />}>
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="flat" color={selectedDevice.online === 'ONLINE' ? 'success' : 'danger'}>
                {selectedDevice.online === 'ONLINE' ? '在线' : '离线'}
              </Chip>
              <span className="truncate">{selectedDevice.deviceName}</span>
            </div>
          </Button>
        </div>
        <MonitorPanelInline deviceId={selectedDeviceId} config={config} points={points} />
        <RealtimePointsInline realtimePoints={realtimePoints} />
        <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} placement="bottom" size="lg">
          <DrawerContent>
            <DrawerHeader>选择设备</DrawerHeader>
            <DrawerBody>
              <div className="space-y-2">
                {devices.map((d) => (
                  <DeviceCard key={d.id} device={d} compact selected={d.id === selectedDeviceId}
                    onPress={() => { setSelectedDeviceId(d.id); setDrawerOpen(false); }} />
                ))}
              </div>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="w-72 shrink-0">
        <div className="sticky top-2 max-h-[calc(100vh-120px)] overflow-y-auto rounded-xl bg-content1 p-2">
          <div className="mb-2 px-2 text-sm font-medium text-foreground">设备列表</div>
          <div className="space-y-1">
            {devices.map((d) => (
              <DeviceCard key={d.id} device={d} compact selected={d.id === selectedDeviceId}
                onPress={() => setSelectedDeviceId(d.id)} />
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <MonitorPanelInline deviceId={selectedDeviceId} config={config} points={points} />
      </div>
    </div>
  );
}

function MonitorPanelInline({ deviceId, config, points }: { deviceId: string; config: any; points: PointDefinition[] }) {
  const navigate = useNavigate();

  if (config.widgets.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center justify-center py-8 gap-3">
          <ChartBarIcon className="h-10 w-10 text-foreground-300" />
          <div className="text-center">
            <p className="text-foreground-500">暂未配置监控面板</p>
            <p className="text-sm text-foreground-400 mt-1">请在设备编辑页面配置监控组件</p>
          </div>
          <Button size="sm" color="primary" variant="flat" onPress={() => navigate(`/devices/${deviceId}/edit?tab=panel`)}>
            前往配置
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">监控面板</span>
        <Button size="sm" variant="light" color="primary" onPress={() => navigate(`/devices/${deviceId}/edit?tab=panel`)}>
          编辑面板
        </Button>
      </div>
      <PanelRenderer config={config} deviceId={deviceId} points={points} />
    </div>
  );
}

function RealtimePointsInline({ realtimePoints, compact = false }: { realtimePoints: any[]; compact?: boolean }) {
  if (realtimePoints.length === 0) {
    return <div className="rounded-xl bg-content1 p-4 text-center text-sm text-foreground-400">暂无实时数据</div>;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">实时点位</div>
        {realtimePoints.slice(0, 10).map((point) => (
          <div key={point.pointCode} className="flex items-center justify-between text-xs">
            <span className="truncate text-foreground-400">{point.pointName}</span>
            <span className="font-medium text-foreground">{point.displayValue ?? point.rawValue ?? '-'}</span>
          </div>
        ))}
        {realtimePoints.length > 10 && <div className="text-xs text-foreground-400">还有 {realtimePoints.length - 10} 个点位...</div>}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader><span className="text-sm font-medium text-foreground">实时点位推送</span></CardHeader>
      <CardBody className="p-0">
        <div className="divide-y divide-divider">
          {realtimePoints.map((point) => (
            <div key={point.pointCode} className="flex items-center justify-between px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{point.pointName}</div>
                <div className="truncate text-xs text-foreground-400">{point.pointCode}</div>
              </div>
              <div className="ml-4 text-right">
                <div className="text-sm font-medium text-foreground">{point.displayValue ?? point.rawValue ?? '-'}</div>
                {point.unit && <div className="text-xs text-foreground-400">{point.unit}</div>}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function BasicInfoSection({ device }: { device: Device }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><div className="flex items-center gap-2"><CpuChipIcon className="h-5 w-5 text-primary" /><span className="font-medium text-foreground">设备信息</span></div></CardHeader>
        <CardBody className="gap-3">
          <InfoRow label="设备名称" value={device.deviceName} />
          <InfoRow label="网关 ID" value={device.gatewayId ?? '-'} />
          <InfoRow label="启用状态" value={<Chip size="sm" variant="flat" color={device.enabled ? 'success' : 'default'}>{device.enabled ? '启用' : '禁用'}</Chip>} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader><div className="flex items-center gap-2"><ClockIcon className="h-5 w-5 text-primary" /><span className="font-medium text-foreground">时间信息</span></div></CardHeader>
        <CardBody className="gap-3">
          <InfoRow label="创建时间" value={formatDateTime(device.createdAt)} />
          <InfoRow label="更新时间" value={formatDateTime(device.updatedAt)} />
          <InfoRow label="最后心跳" value={formatDateTime(device.lastHeartbeatAt)} />
        </CardBody>
      </Card>
    </div>
  );
}

function ConnectionInfoSection({ device }: { device: Device }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><div className="flex items-center gap-2"><WifiIcon className="h-5 w-5 text-primary" /><span className="font-medium text-foreground">连接状态</span></div></CardHeader>
        <CardBody className="gap-3">
          <InfoRow label="在线状态" value={<Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'danger'}>{device.online === 'ONLINE' ? '在线' : '离线'}</Chip>} />
          <InfoRow label="最后心跳" value={formatDateTime(device.lastHeartbeatAt)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader><div className="flex items-center gap-2"><CpuChipIcon className="h-5 w-5 text-primary" /><span className="font-medium text-foreground">网关信息</span></div></CardHeader>
        <CardBody className="gap-3">
          <InfoRow label="网关 ID" value={device.gatewayId ?? '-'} />
        </CardBody>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 shrink-0 text-foreground-400">{label}</span>
      <span className="min-w-0 flex-1 text-foreground">{value}</span>
    </div>
  );
}

function RealtimeDataSection({ deviceId }: { deviceId: string }) {
  const [search, setSearch] = useState('');
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const isMobile = useIsMobile();

  const realtimeQuery = useQuery({
    queryKey: ['device.realtime', deviceId],
    queryFn: () => chainToPromise(getDeviceRealtime(deviceId)),
    refetchInterval: 3000,
  });

  const pointsQuery = useQuery({
    queryKey: ['device.points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });

  const realtimePoints = realtimeQuery.data?.points ?? [];
  const pointDefinitions = pointsQuery.data ?? [];

  const mergedPoints = realtimePoints.map((rt) => {
    const def = pointDefinitions.find((p) => p.pointCode === rt.pointCode);
    return { ...rt, ...def };
  });

  const filteredPoints = mergedPoints.filter((point) => {
    const matchesSearch = !search || point.pointName?.includes(search) || point.pointCode?.includes(search);
    const matchesDataType = dataTypeFilter === 'all' || point.dataType === dataTypeFilter;
    const matchesAccess = accessFilter === 'all' || point.access === accessFilter;
    return matchesSearch && matchesDataType && matchesAccess;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input size="sm" placeholder="搜索点位名称或编码..." value={search} onValueChange={setSearch}
          variant="bordered" startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />} className="w-64" />
        <Select size="sm" placeholder="数据类型" variant="bordered" className="w-32"
          selectedKeys={[dataTypeFilter]} onSelectionChange={(keys) => setDataTypeFilter(Array.from(keys)[0] as string)}>
          <SelectItem key="all">全部类型</SelectItem>
          <SelectItem key="BOOL">布尔</SelectItem>
          <SelectItem key="LONG">整数</SelectItem>
          <SelectItem key="DOUBLE">浮点</SelectItem>
          <SelectItem key="STRING">字符串</SelectItem>
        </Select>
        <Select size="sm" placeholder="访问类型" variant="bordered" className="w-32"
          selectedKeys={[accessFilter]} onSelectionChange={(keys) => setAccessFilter(Array.from(keys)[0] as string)}>
          <SelectItem key="all">全部</SelectItem>
          <SelectItem key="RO">只读</SelectItem>
          <SelectItem key="RW">读写</SelectItem>
        </Select>
        <Button size="sm" variant="light" isIconOnly onPress={() => realtimeQuery.refetch()} isLoading={realtimeQuery.isFetching}>
          <ArrowPathIcon className="h-4 w-4" />
        </Button>
        <span className="text-xs text-foreground-400">{filteredPoints.length} / {mergedPoints.length} 个点位</span>
      </div>
      <RealtimeTable filteredPoints={filteredPoints} isMobile={isMobile}
        hasFilter={search || dataTypeFilter !== 'all' || accessFilter !== 'all'} />
    </div>
  );
}

function RealtimeTable({ filteredPoints, isMobile, hasFilter }: any) {
  const emptyText = hasFilter ? '没有匹配的点位' : '暂无点位数据';

  if (filteredPoints.length === 0) {
    return <div className="rounded-xl bg-content1 p-8 text-center text-sm text-foreground-400">{emptyText}</div>;
  }

  if (isMobile) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filteredPoints.map((point: any) => (
          <Card key={point.pointCode}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{point.pointName}</div>
                  <div className="truncate text-xs text-foreground-400">{point.pointCode}</div>
                </div>
                <Chip size="sm" variant="flat" color={point.access === 'RW' ? 'primary' : 'default'}>
                  {point.access === 'RW' ? '读写' : '只读'}
                </Chip>
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{point.displayValue ?? point.rawValue ?? '-'}</div>
              {point.unit && <div className="text-xs text-foreground-400">{point.unit}</div>}
              <div className="mt-2 text-xs text-foreground-400">
                {point.timestamp ? formatDateTime(point.timestamp.epochSecond * 1000) : '-'}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-divider">
                <th className="p-3 text-left text-xs font-medium text-foreground-400">点位名称</th>
                <th className="p-3 text-left text-xs font-medium text-foreground-400">编码</th>
                <th className="p-3 text-left text-xs font-medium text-foreground-400">当前值</th>
                <th className="p-3 text-left text-xs font-medium text-foreground-400">单位</th>
                <th className="p-3 text-left text-xs font-medium text-foreground-400">类型</th>
                <th className="p-3 text-left text-xs font-medium text-foreground-400">访问</th>
                <th className="p-3 text-left text-xs font-medium text-foreground-400">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoints.map((point: any) => (
                <tr key={point.pointCode} className="border-b border-divider last:border-b-0 hover:bg-content2/50">
                  <td className="p-3 text-sm text-foreground">{point.pointName}</td>
                  <td className="p-3"><code className="text-xs text-foreground-500">{point.pointCode}</code></td>
                  <td className="p-3 text-sm font-medium text-foreground">{point.displayValue ?? point.rawValue ?? '-'}</td>
                  <td className="p-3 text-sm text-foreground-500">{point.unit ?? '-'}</td>
                  <td className="p-3"><Chip size="sm" variant="flat">{point.dataType ?? '-'}</Chip></td>
                  <td className="p-3"><Chip size="sm" variant="flat" color={point.access === 'RW' ? 'primary' : 'default'}>{point.access === 'RW' ? '读写' : '只读'}</Chip></td>
                  <td className="p-3 text-xs text-foreground-400">{point.timestamp ? formatDateTime(point.timestamp.epochSecond * 1000) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}