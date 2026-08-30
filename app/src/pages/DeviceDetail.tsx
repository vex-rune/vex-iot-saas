import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Tab,
  addToast,
} from '@heroui/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EntityCard, FieldRow } from '@/components/EntityCard';
import { chainToPromise } from '@/hooks/useQueryList';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
  getDevice,
  getDeviceRealtime,
  controlPoint,
  getDeviceHistory,
} from '@/api/devices';
import { formatDateTime } from '@/lib/format';
import type { RealtimePointValue, Device, PointHistory } from '@/types/api';

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [infoSubTab, setInfoSubTab] = useState('overview');

  const deviceQuery = useQuery({
    queryKey: ['device', id],
    queryFn: () => chainToPromise(getDevice(id!)),
    enabled: !!id,
  });

  const device = deviceQuery.data as Device | undefined;

  return (
    <div className="flex min-h-full flex-col gap-4">
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button isIconOnly variant="light" onPress={() => navigate('/devices')}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        {deviceQuery.isLoading ? (
          <Skeleton className="h-8 w-64 rounded-lg" />
        ) : device ? (
          <>
            <span className="text-sm text-foreground-500">{device.deviceCode}</span>
            <span className="font-semibold text-foreground">{device.deviceName}</span>
            <Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'danger'}>
              {device.online === 'ONLINE' ? '在线' : '离线'}
            </Chip>
            <Chip size="sm" variant="flat" color={device.enabled ? 'primary' : 'default'}>
              {device.enabled ? '启用' : '禁用'}
            </Chip>
          </>
        ) : (
          <span className="text-foreground-500">设备不存在</span>
        )}
      </div>

      <Divider />

      {device && (
        <div className="flex flex-col gap-3">
          <Tabs
            size="sm"
            selectedKey={infoSubTab}
            onSelectionChange={(k) => setInfoSubTab(k as string)}
          >
            <Tab key="overview" title="概览" />
            <Tab key="realtime" title="实时点位" />
            <Tab key="history" title="历史点位" />
          </Tabs>
          {infoSubTab === 'overview' && <OverviewTab device={device} />}
          {infoSubTab === 'realtime' && <RealtimeTab deviceId={device.id} />}
          {infoSubTab === 'history' && <HistoryTab deviceId={device.id} />}
        </div>
      )}
    </div>
  );
}

/** 概览 Tab */
function OverviewTab({ device }: { device: Device }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><span className="font-medium text-foreground">基础信息</span></CardHeader>
        <CardBody className="gap-3">
          <InfoRow label="名称" value={device.deviceName} />
          <InfoRow label="编号" value={device.deviceCode} />
          <InfoRow label="网关 ID" value={device.gatewayId ?? '-'} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader><span className="font-medium text-foreground">连接信息</span></CardHeader>
        <CardBody className="gap-3">
          <InfoRow label="在线状态" value={device.online === 'ONLINE' ? '在线' : '离线'} />
          <InfoRow label="启用状态" value={device.enabled ? '启用' : '禁用'} />
          <InfoRow label="最后心跳" value={formatDateTime(device.lastHeartbeatAt)} />
        </CardBody>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-foreground-500">{label}</span>
      <span className="break-all text-foreground">{value}</span>
    </div>
  );
}

/** 实时点位 Tab */
function RealtimeTab({ deviceId }: { deviceId: string }) {
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const realtimeQuery = useQuery({
    queryKey: ['device.realtime', deviceId],
    queryFn: () => chainToPromise(getDeviceRealtime(deviceId)),
    refetchInterval: 3000,
  });

  const points = (realtimeQuery.data?.points ?? []).filter(
    (p: RealtimePointValue) =>
      !search || p.pointName.includes(search) || p.pointCode.includes(search),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          placeholder="搜索点位名/编码"
          value={search}
          onValueChange={setSearch}
          variant="bordered"
          className="w-56"
        />
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          onPress={() => realtimeQuery.refetch()}
          isLoading={realtimeQuery.isFetching}
        >
          <ArrowPathIcon className="h-4 w-4" />
        </Button>
      </div>

      {realtimeQuery.isLoading && !realtimeQuery.data ? (
        <div className="rounded-2xl bg-content1 p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : isMobile ? (
        points.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            暂无点位数据
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {points.map((point: RealtimePointValue) => (
              <EntityCard
                key={point.pointCode}
                title={point.pointName}
                subtitle={point.pointCode}
                badge={
                  <span className="font-mono text-base font-semibold text-primary-600">
                    {point.displayValue || point.rawValue}
                  </span>
                }
                actions={
                  point.access === 'RW' ? (
                    <ControlButton deviceId={deviceId} point={point} />
                  ) : (
                    <span className="text-xs text-foreground-400">只读</span>
                  )
                }
              >
                <FieldRow label="单位" value={point.unit ?? '-'} />
                <FieldRow label="访问" value={point.access} />
              </EntityCard>
            ))}
          </div>
        )
      ) : (
        <Table aria-label="实时点位" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>点位名</TableColumn>
            <TableColumn>编码</TableColumn>
            <TableColumn>当前值</TableColumn>
            <TableColumn className="hidden sm:table-cell">单位</TableColumn>
            <TableColumn>控制</TableColumn>
          </TableHeader>
          <TableBody emptyContent="暂无点位数据" items={points}>
            {(point: RealtimePointValue) => (
              <TableRow key={point.pointCode}>
                <TableCell className="text-foreground">{point.pointName}</TableCell>
                <TableCell><code className="text-xs text-foreground">{point.pointCode}</code></TableCell>
                <TableCell>
                  <span className="font-mono font-medium text-primary-600">
                    {point.displayValue || point.rawValue}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-foreground-500">
                  {point.unit ?? '-'}
                </TableCell>
                <TableCell>
                  {point.access === 'RW' ? (
                    <ControlButton deviceId={deviceId} point={point} />
                  ) : (
                    <span className="text-xs text-foreground-400">只读</span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** 控制按钮 */
function ControlButton({ deviceId, point }: { deviceId: string; point: RealtimePointValue }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState(point.rawValue);

  const mutation = useApiMutation({
    mutationFn: () => controlPoint(deviceId, point.pointCode, value),
  });
  const mutationUI = useMutation({
    mutationFn: async () => { await mutation.mutateAsync(); },
    onSuccess: () => {
      addToast({ title: '控制指令已下发', color: 'success' });
      setModalOpen(false);
    },
  });

  return (
    <>
      <Button
        size="sm"
        variant="flat"
        color="primary"
        onPress={() => {
          setValue(point.rawValue);
          setModalOpen(true);
        }}
      >
        控制
      </Button>
      <Modal isOpen={modalOpen} size="sm" onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">控制 - {point.pointName}</ModalHeader>
          <ModalBody>
            <Input
              label="值"
              value={value}
              onValueChange={setValue}
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setModalOpen(false)}>取消</Button>
            <Button color="primary" isLoading={mutationUI.isPending} onPress={() => mutationUI.mutate()}>
              下发
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

/** 历史点位 Tab */
function HistoryTab({ deviceId }: { deviceId: string }) {
  const [pointCode, setPointCode] = useState('');
  const [limit, setLimit] = useState('100');
  const isMobile = useIsMobile();

  const historyQuery = useQuery({
    queryKey: ['device.history', deviceId, pointCode, limit],
    queryFn: () => chainToPromise(getDeviceHistory(deviceId, { pointCode, limit: Number(limit) })),
    enabled: !!pointCode,
  });

  const data = historyQuery.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          size="sm"
          label="点位编码"
          placeholder="请输入点位编码"
          value={pointCode}
          onValueChange={setPointCode}
          variant="bordered"
          isRequired
          className="w-40"
        />
        <Select
          size="sm"
          label="条数"
          variant="bordered"
          className="w-24"
          selectedKeys={[limit]}
          onSelectionChange={(keys) => setLimit(Array.from(keys)[0] as string)}
        >
          {['50', '100', '200', '500'].map((v) => (
            <SelectItem key={v}>{v}</SelectItem>
          ))}
        </Select>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          isDisabled={!pointCode}
          onPress={() => historyQuery.refetch()}
        >
          查询
        </Button>
      </div>

      {historyQuery.isLoading && !historyQuery.data ? (
        <div className="rounded-2xl bg-content1 p-4">
          <div className="flex items-center justify-center py-6"><Spinner size="sm" /></div>
        </div>
      ) : isMobile ? (
        data.length === 0 ? (
          <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
            {pointCode ? '暂无数据' : '请先选择点位编码并查询'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((item: PointHistory) => {
              const epochMs =
                (item.timestamp?.epochSecond ?? item.timestamp?.seconds ?? 0) > 0
                  ? (item.timestamp?.epochSecond ?? item.timestamp?.seconds ?? 0) * 1000
                  : undefined;
              return (
                <EntityCard
                  key={`${item.timestamp?.epochSecond ?? item.timestamp?.seconds}-${item.timestamp?.nano ?? item.timestamp?.nanos}`}
                  title={<span className="font-mono">{item.value ?? '-'}</span>}
                  subtitle={formatDateTime(epochMs)}
                />
              );
            })}
          </div>
        )
      ) : (
        <Table aria-label="历史点位" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>时间</TableColumn>
            <TableColumn>值</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={pointCode ? '暂无数据' : '请先选择点位编码并查询'}
            items={data as PointHistory[]}
          >
            {(item: PointHistory) => {
              const epochMs =
                (item.timestamp?.epochSecond ?? item.timestamp?.seconds ?? 0) > 0
                  ? (item.timestamp?.epochSecond ?? item.timestamp?.seconds ?? 0) * 1000
                  : undefined;
              return (
                <TableRow key={`${item.timestamp?.epochSecond ?? item.timestamp?.seconds}-${item.timestamp?.nano ?? item.timestamp?.nanos}`}>
                  <TableCell className="text-foreground-600">{formatDateTime(epochMs)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-foreground">{item.value ?? '-'}</span>
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
