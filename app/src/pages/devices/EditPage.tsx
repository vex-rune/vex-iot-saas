import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Chip, Input, Select, SelectItem, Switch, Tab, Tabs,} from '@heroui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeftIcon, Cog6ToothIcon} from '@heroicons/react/24/outline';
import {getDevice, updateDevice} from '@/services/deviceService';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {useBeforeUnload} from '@/hooks/common/useBeforeUnload';
import PanelPanelTab from '@/components/panel/PanelPanelTab';
import type {Device} from '@/types/api';
import {GATEWAY_TYPE_OPTIONS} from '@/types/api';
import PointSettingsSection from './DetailSections/PointSettingsSection';
import PointScheduleSection from './DetailSections/PointScheduleSection';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';

export default function DeviceEdit() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('basic');
    // 面板编辑状态提升：编辑中阻止切换 Tab 导致未保存修改静默丢失
    const [panelEditing, setPanelEditing] = useState(false);

    const handleTabChange = (k: string | number) => {
        if (panelEditing && k !== 'panel') {
            toastWarning('请先保存或取消面板编辑');
            return;
        }
        setActiveTab(k as string);
    };

    // 设备信息
    const {data: device, isLoading: deviceLoading} = useQuery<Device>({
        queryKey: ['device', id],
        queryFn: () => chainToPromise(getDevice(id!)),
        enabled: !!id,
    });

    const [deviceForm, setDeviceForm] = useState({
        deviceName: '',
        gatewayId: '',
        gatewayType: '' as string,
        level1Tag: '',
        level2Tag: '',
        level3Tag: '',
        templateId: '',
        templateSyncEnabled: true,
    });
    const [originalDevice, setOriginalDevice] = useState<Device | null>(null);

    useEffect(() => {
        if (device) {
            setDeviceForm({
                deviceName: device.deviceName,
                gatewayId: device.gatewayId ?? '',
                gatewayType: device.gatewayType ?? '',
                level1Tag: device.level1Tag ?? '',
                level2Tag: device.level2Tag ?? '',
                level3Tag: device.level3Tag ?? '',
                templateId: device.templateId ?? '',
                templateSyncEnabled: device.templateSyncEnabled ?? true,
            });
            setOriginalDevice(device);
        }
    }, [device]);

    const isDeviceDirty = originalDevice != null && (
        deviceForm.deviceName.trim() !== (originalDevice.deviceName ?? '').trim() ||
        deviceForm.gatewayId.trim() !== (originalDevice.gatewayId ?? '').trim() ||
        deviceForm.gatewayType !== (originalDevice.gatewayType ?? '') ||
        deviceForm.level1Tag.trim() !== (originalDevice.level1Tag ?? '').trim() ||
        deviceForm.level2Tag.trim() !== (originalDevice.level2Tag ?? '').trim() ||
        deviceForm.level3Tag.trim() !== (originalDevice.level3Tag ?? '').trim() ||
        deviceForm.templateId.trim() !== (originalDevice.templateId ?? '').trim() ||
        deviceForm.templateSyncEnabled !== (originalDevice.templateSyncEnabled ?? true)
    );

    // 设备信息有未保存改动时阻止意外离开页面
    useBeforeUnload(isDeviceDirty);

    const deviceMutation = useApiMutation({mutationFn: (data: Partial<Device>) => updateDevice(id!, data)});
    const saveDeviceInfo = async () => {
        if (!deviceForm.deviceName.trim()) {
            toastWarning('设备名称不能为空');
            return;
        }
        try {
            const trimOrUndef = (v: string) => v.trim() || undefined;
            const updated = await deviceMutation.mutateAsync({
                deviceName: deviceForm.deviceName.trim(),
                gatewayId: trimOrUndef(deviceForm.gatewayId),
                gatewayType: (deviceForm.gatewayType || undefined) as import('@/types/api').GatewayType | undefined,
                level1Tag: trimOrUndef(deviceForm.level1Tag),
                level2Tag: trimOrUndef(deviceForm.level2Tag),
                level3Tag: trimOrUndef(deviceForm.level3Tag),
                templateId: trimOrUndef(deviceForm.templateId),
                templateSyncEnabled: deviceForm.templateSyncEnabled,
            });
            setOriginalDevice(updated);
            queryClient.setQueryData(['device', id], updated);
            toastSuccess('设备信息已保存');
        } catch {
            toastError('设备信息保存失败');
        }
    };

    if (deviceLoading) {
        return (
            <div className="flex min-h-full flex-col gap-4">
                <div className="h-10 w-48 animate-pulse rounded-lg bg-content3"/>
                <div className="h-12 w-full animate-pulse rounded-2xl bg-content3"/>
                <div className="h-48 w-full animate-pulse rounded-2xl bg-content3"/>
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
                        <ArrowLeftIcon className="h-5 w-5"/>
                    </Button>
                    <div className="flex min-w-0 flex-col">
                        <h1 className="truncate text-xl font-semibold text-foreground">{device.deviceName}</h1>
                    </div>
                    <Chip size="sm" variant="flat" color={device.online === 'ONLINE' ? 'success' : 'default'}>
                        {device.online === 'ONLINE' ? '在线' : '离线'}
                    </Chip>
                    {[device.level1Tag, device.level2Tag, device.level3Tag]
                        .filter((t): t is string => !!t && t.trim().length > 0)
                        .map((t) => (
                            <Chip key={t} size="sm" variant="flat" color="default">{t}</Chip>
                        ))}
                </div>
            </header>

            <Tabs
                aria-label="设备编辑"
                variant="underlined"
                selectedKey={activeTab}
                onSelectionChange={handleTabChange}
                classNames={{tabList: 'gap-4 px-0', cursor: 'bg-primary'}}
            >
                <Tab key="basic" title="设备信息">
                    <section className="rounded-2xl bg-content1 p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Cog6ToothIcon className="h-4 w-4 text-foreground-500"/>
                                <h2 className="text-base font-medium text-foreground">设备信息</h2>
                            </div>
                            <Button size="sm" color="primary" isLoading={deviceMutation.isPending}
                                    isDisabled={!isDeviceDirty}
                                    onPress={saveDeviceInfo}>保存设备</Button>
                        </div>
                        <div className="mx-auto flex max-w-lg flex-col gap-4">
                            <Input label="设备名称" placeholder="请输入设备名称" value={deviceForm.deviceName}
                                   onValueChange={(v) => setDeviceForm((f) => ({...f, deviceName: v}))}
                                   variant="bordered" isRequired/>
                            <Input label="网关 ID" placeholder="MQTT 网关硬件标识" value={deviceForm.gatewayId}
                                   onValueChange={(v) => setDeviceForm((f) => ({...f, gatewayId: v}))}
                                   variant="bordered" description="设备通过此 ID 与 MQTT 网关绑定"/>
                            <Select label="网关类型" placeholder="选择网关类型"
                                    selectedKeys={[deviceForm.gatewayType]}
                                    onSelectionChange={(k) => setDeviceForm((f) => ({...f, gatewayType: k as string}))}
                                    variant="bordered">
                                {GATEWAY_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </Select>
                            <Input label="关联模版 ID" placeholder="可选，用于模版同步追踪" value={deviceForm.templateId}
                                   onValueChange={(v) => setDeviceForm((f) => ({...f, templateId: v}))}
                                   variant="bordered"/>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-foreground">允许模版同步</span>
                                <Switch size="sm" isSelected={deviceForm.templateSyncEnabled}
                                        onValueChange={(v) => setDeviceForm((f) => ({...f, templateSyncEnabled: v}))}/>
                            </div>
                            <Input label="一级标签" placeholder="可选,例如:车间 / 楼层" value={deviceForm.level1Tag}
                                   onValueChange={(v) => setDeviceForm((f) => ({...f, level1Tag: v}))}
                                   variant="bordered"/>
                            <Input label="二级标签" placeholder="可选,例如:生产线 / 区域" value={deviceForm.level2Tag}
                                   onValueChange={(v) => setDeviceForm((f) => ({...f, level2Tag: v}))}
                                   variant="bordered"/>
                            <Input label="三级标签" placeholder="可选,例如:设备类型 / 编号" value={deviceForm.level3Tag}
                                   onValueChange={(v) => setDeviceForm((f) => ({...f, level3Tag: v}))}
                                   variant="bordered"/>
                        </div>
                    </section>
                </Tab>

                <Tab key="points" title="点位设置">
                    <PointSettingsSection deviceId={id!} sectionRef={() => {
                    }}/>
                </Tab>

                <Tab key="schedules" title="定时控制">
                    <PointScheduleSection deviceId={id!} sectionRef={() => {
                    }}/>
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

            <div className="h-4"/>
        </div>
    );
}
