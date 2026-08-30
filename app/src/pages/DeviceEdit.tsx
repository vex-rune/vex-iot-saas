import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Chip,
  Input,
  Tab,
  Tabs,
  addToast,
} from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { getDevice, updateDevice, checkDeviceCodeAvailable } from '@/api/devices';
import { useApiMutation } from '@/hooks/useApiMutation';
import { chainToPromise } from '@/hooks/useQueryList';
import PanelPanelTab from '@/components/panel/PanelPanelTab';
import type { Device } from '@/types/api';
import PointSettingsSection from './device/sections/PointSettingsSection';
import AlarmSettingsSection from './device/sections/AlarmSettingsSection';
import PointScheduleSection from './device/sections/PointScheduleSection';

export default function DeviceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');
  // 面板编辑状态提升：编辑中阻止切换 Tab 导致未保存修改静默丢失
  const [panelEditing, setPanelEditing] = useState(false);

  const handleTabChange = (k: string | number) => {
    if (panelEditing && k !== 'panel') {
      addToast({ title: '请先保存或取消面板编辑', color: 'warning' });
      return;
    }
    setActiveTab(k as string);
  };

  // 设备信息
  const { data: device, isLoading: deviceLoading } = useQuery<Device>({
    queryKey: ['device', id],
    queryFn: () => chainToPromise(getDevice(id!)),
    enabled: !!id,
  });

  const [deviceForm, setDeviceForm] = useState({ deviceName: '', deviceCode: '', gatewayId: '' });
  const [originalDevice, setOriginalDevice] = useState<Device | null>(null);

  // 设备编号实时去重：编辑自己时排除自身
  const [codeConflict, setCodeConflict] = useState<{ checking: boolean; conflict: boolean }>(
    { checking: false, conflict: false },
  );
  useEffect(() => {
    const code = deviceForm.deviceCode.trim();
    if (!code) {
      setCodeConflict({ checking: false, conflict: false });
      return;
    }
    // 与原编号一致时直接放行
    if (originalDevice && code === (originalDevice.deviceCode ?? '').trim()) {
      setCodeConflict({ checking: false, conflict: false });
      return;
    }
    let cancelled = false;
    setCodeConflict({ checking: true, conflict: false });
    const t = setTimeout(() => {
      checkDeviceCodeAvailable(code, id)
        .then((list) => {
          if (!cancelled) setCodeConflict({ checking: false, conflict: list.length > 0 });
        })
        .catch(() => {
          if (!cancelled) setCodeConflict({ checking: false, conflict: false });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [deviceForm.deviceCode, id, originalDevice]);

  useEffect(() => {
    if (device) {
      setDeviceForm({
        deviceName: device.deviceName,
        deviceCode: device.deviceCode,
        gatewayId: device.gatewayId ?? '',
      });
      setOriginalDevice(device);
    }
  }, [device]);

  const isDeviceDirty = originalDevice != null && (
    deviceForm.deviceName.trim() !== (originalDevice.deviceName ?? '').trim() ||
    deviceForm.deviceCode.trim() !== (originalDevice.deviceCode ?? '').trim() ||
    deviceForm.gatewayId.trim() !== (originalDevice.gatewayId ?? '').trim()
  );

  // 设备信息有未保存改动时阻止意外离开页面
  useEffect(() => {
    if (!isDeviceDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDeviceDirty]);

  const deviceMutation = useApiMutation({ mutationFn: (data: Partial<Device>) => updateDevice(id!, data) });
  const saveDeviceInfo = async () => {
    if (!deviceForm.deviceName.trim() || !deviceForm.deviceCode.trim()) {
      addToast({ title: '设备名称和编号不能为空', color: 'warning' });
      return;
    }
    if (codeConflict.conflict) {
      addToast({
        title: `设备编号「${deviceForm.deviceCode.trim()}」已被其他设备占用`,
        color: 'warning',
      });
      return;
    }
    try {
      const updated = await deviceMutation.mutateAsync({
        deviceName: deviceForm.deviceName.trim(),
        deviceCode: deviceForm.deviceCode.trim(),
        gatewayId: deviceForm.gatewayId.trim() || undefined,
      });
      setOriginalDevice(updated);
      queryClient.setQueryData(['device', id], updated);
      addToast({ title: '设备信息已保存', color: 'success' });
    } catch (e) {
      // 兜底：后端返回冲突（如用户连续快速改值，前端还没查完）
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('已被其他设备占用') || msg.includes('conflict')) {
        setCodeConflict({ checking: false, conflict: true });
        addToast({ title: '设备编号已被其他设备占用', color: 'warning' });
      } else {
        addToast({ title: '设备信息保存失败', color: 'danger' });
      }
    }
  };

  if (deviceLoading) {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-content3" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-content3" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-content3" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
          设备不存在或加载失败
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      {/* 顶栏 */}
      <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button isIconOnly variant="light" onPress={() => navigate(-1)}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-xl font-semibold text-foreground">{device.deviceName}</h1>
            <span className="truncate text-xs text-foreground-400">{device.deviceCode}</span>
          </div>
          <Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'default'}>
            {device.online === 'ONLINE' ? '在线' : '离线'}
          </Chip>
        </div>
      </header>

      <Tabs
        aria-label="设备编辑"
        variant="underlined"
        selectedKey={activeTab}
        onSelectionChange={handleTabChange}
        classNames={{ tabList: 'gap-4 px-0', cursor: 'bg-primary' }}
      >
        <Tab key="basic" title="设备信息">
          <section className="rounded-2xl bg-content1 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cog6ToothIcon className="h-4 w-4 text-foreground-500" />
                <h2 className="text-base font-medium text-foreground">设备信息</h2>
              </div>
              <Button size="sm" color="primary" isLoading={deviceMutation.isPending}
                isDisabled={!isDeviceDirty || codeConflict.conflict || codeConflict.checking}
                onPress={saveDeviceInfo}>保存设备</Button>
            </div>
            <div className="mx-auto flex max-w-lg flex-col gap-4">
              <Input label="设备名称" placeholder="请输入设备名称" value={deviceForm.deviceName}
                onValueChange={(v) => setDeviceForm((f) => ({ ...f, deviceName: v }))}
                variant="bordered" isRequired />
              <Input
                label="设备编号"
                placeholder="请输入设备编号（全局唯一）"
                value={deviceForm.deviceCode}
                onValueChange={(v) => setDeviceForm((f) => ({ ...f, deviceCode: v }))}
                variant="bordered" isRequired
                isInvalid={codeConflict.conflict}
                color={codeConflict.conflict ? 'danger' : 'default'}
                description={codeConflict.checking
                  ? '检查中...'
                  : codeConflict.conflict
                    ? `设备编号「${deviceForm.deviceCode.trim()}」已被其他设备占用`
                    : '设备在系统内的唯一标识，保存后需确保不与其他设备重复'}
                endContent={codeConflict.checking ? (
                  <span className="text-xs text-foreground-400">…</span>
                ) : codeConflict.conflict ? (
                  <span className="text-xs text-danger">✕</span>
                ) : deviceForm.deviceCode.trim() ? (
                  <span className="text-xs text-success">✓</span>
                ) : null}
              />
              <Input label="网关 ID" placeholder="MQTT 网关硬件标识" value={deviceForm.gatewayId}
                onValueChange={(v) => setDeviceForm((f) => ({ ...f, gatewayId: v }))}
                variant="bordered" description="设备通过此 ID 与 MQTT 网关绑定" />
            </div>
          </section>
        </Tab>

        <Tab key="points" title="点位设置">
          <PointSettingsSection deviceId={id!} sectionRef={() => {}} />
        </Tab>

        <Tab key="alarms" title="告警设置">
          <AlarmSettingsSection deviceId={id!} sectionRef={() => {}} />
        </Tab>

        <Tab key="schedules" title="定时控制">
          <PointScheduleSection deviceId={id!} sectionRef={() => {}} />
        </Tab>

        <Tab key="panel" title="面板信息">
          <PanelPanelTab
            key={id}
            deviceId={id!}
            editing={panelEditing}
            onEditingChange={setPanelEditing}
          />
        </Tab>
      </Tabs>

      <div className="h-4" />
    </div>
  );
}
