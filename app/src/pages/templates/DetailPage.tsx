import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {
    Button,
    Chip,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    Input,
    Select,
    SelectItem,
    Skeleton,
    Tab,
    Tabs
} from '@heroui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeftIcon, ArrowPathIcon, ArrowUpIcon, PlusIcon} from '@heroicons/react/24/outline';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {applyTemplate, createTemplateFromDevice, getTemplate, syncTemplateToDevices,} from '@/services/templateService';
import {queryActiveDevices} from '@/services/deviceService';
import {type Device, type DeviceTemplate, GATEWAY_TYPE_LABELS} from '@/types/api';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';

export default function TemplateDetailPage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('info');
    const [fromDeviceOpen, setFromDeviceOpen] = useState(false);
    const [fromDeviceId, setFromDeviceId] = useState('');
    const [fromTemplateName, setFromTemplateName] = useState('');
    const [applyOpen, setApplyOpen] = useState(false);
    const [applyDeviceName, setApplyDeviceName] = useState('');
    const [applyGatewayId, setApplyGatewayId] = useState('');

    const {data: template, isLoading} = useQuery<DeviceTemplate>({
        queryKey: ['template', id],
        queryFn: () => chainToPromise(getTemplate(id!)),
        enabled: !!id,
    });

    const {data: devices = []} = useQuery<Device[]>({
        queryKey: ['devices.active.forTemplate'],
        queryFn: () => chainToPromise(queryActiveDevices({page: {page: 1, size: 200}})),
        enabled: fromDeviceOpen,
    });

    const fromDeviceMutation = useApiMutation({
        mutationFn: (p: { deviceId: string; templateName?: string }) =>
            createTemplateFromDevice(p.deviceId, p.templateName),
    });
    const applyMutation = useApiMutation({
        mutationFn: (p: { templateId: string; deviceName: string; gatewayId?: string }) =>
            applyTemplate(p.templateId, p.deviceName, p.gatewayId),
    });
    const syncMutation = useApiMutation({
        mutationFn: (templateId: string) => syncTemplateToDevices(templateId),
    });

    const pointList = safeParse(template?.pointConfig);
    const scheduleList = safeParse(template?.scheduleConfig);
    const panelConfig = safeParse(template?.panelConfig);

    const handleFromDevice = async () => {
        if (!fromDeviceId) {
            toastWarning('请选择源设备');
            return;
        }
        try {
            await fromDeviceMutation.mutateAsync({deviceId: fromDeviceId, templateName: fromTemplateName || undefined});
            toastSuccess('从设备生成模版成功');
            queryClient.invalidateQueries({queryKey: ['template', id]});
            setFromDeviceOpen(false);
        } catch {
            toastError('生成失败');
        }
    };

    const handleApply = async () => {
        if (!applyDeviceName.trim()) {
            toastWarning('请填写新设备名称');
            return;
        }
        try {
            const device = await applyMutation.mutateAsync({
                templateId: id!, deviceName: applyDeviceName.trim(),
                gatewayId: applyGatewayId.trim() || undefined,
            });
            toastSuccess('设备已创建');
            setApplyOpen(false);
            navigate(`/devices/${device.id}/edit`, {replace: true});
        } catch {
            toastError('创建失败');
        }
    };

    const handleSync = async () => {
        try {
            const ids = await syncMutation.mutateAsync(id!);
            toastSuccess(`已同步到 ${ids.length} 台设备`);
        } catch {
            toastError('同步失败');
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-4">
            <div className="rounded-2xl bg-content1 p-5">
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-7 w-48 rounded-lg"/>
                        <Skeleton className="h-5 w-72 rounded-lg"/>
                    </div>
                ) : template ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <Button isIconOnly variant="light" size="sm" onPress={() => navigate('/templates')}>
                                <ArrowLeftIcon className="h-5 w-5"/>
                            </Button>
                            <h1 className="text-lg font-semibold text-foreground">{template.templateName}</h1>
                            {template.gatewayType && (
                                <Chip size="sm"
                                      variant="flat">{GATEWAY_TYPE_LABELS[template.gatewayType] ?? template.gatewayType}</Chip>
                            )}
                        </div>
                        {template.description && (
                            <p className="pl-12 text-sm text-foreground-500">{template.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 pl-12">
                            <Button size="sm" color="primary" startContent={<ArrowUpIcon className="h-4 w-4"/>}
                                    onPress={() => {
                                        setFromTemplateName(template.templateName || '');
                                        setFromDeviceOpen(true);
                                    }}>
                                从设备生成
                            </Button>
                            <Button size="sm" color="success" variant="flat"
                                    startContent={<PlusIcon className="h-4 w-4"/>}
                                    onPress={() => setApplyOpen(true)}>
                                使用模版新建
                            </Button>
                            <Button size="sm" color="warning" variant="flat" isLoading={syncMutation.isPending}
                                    startContent={<ArrowPathIcon className="h-4 w-4"/>} onPress={handleSync}>
                                同步到关联设备
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-foreground-400">模版不存在</div>
                )}
            </div>

            {template && (
                <div className="flex-1">
                    <Tabs size="sm" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}
                          classNames={{tabList: 'gap-4 px-0', cursor: 'bg-primary'}}>
                        <Tab key="info" title="模版信息"/>
                        <Tab key="points" title="点位配置"/>
                        <Tab key="schedule" title="定时控制"/>
                        <Tab key="panel" title="面板配置"/>
                    </Tabs>
                    <div className="mt-4 rounded-2xl bg-content1 p-5">
                        {activeTab === 'info' && (
                            <div className="flex flex-col gap-3 text-sm">
                                <Row label="模版名称" value={template.templateName}/>
                                <Row label="网关类型"
                                     value={template.gatewayType ? (GATEWAY_TYPE_LABELS[template.gatewayType] ?? '-') : '-'}/>
                                <Row label="描述" value={template.description || '-'}/>
                                <Row label="点位数量"
                                     value={Array.isArray(pointList) ? String(pointList.length) : '0'}/>
                                <Row label="定时规则数"
                                     value={Array.isArray(scheduleList) ? String(scheduleList.length) : '0'}/>
                                <Row label="面板配置" value={panelConfig ? '已配置' : '未配置'}/>
                            </div>
                        )}
                        {activeTab === 'points' && <ConfigJsonView title="点位配置" data={pointList}/>}
                        {activeTab === 'schedule' && <ConfigJsonView title="定时控制" data={scheduleList}/>}
                        {activeTab === 'panel' && <ConfigJsonView title="面板配置" data={panelConfig}/>}
                    </div>
                </div>
            )}

            {/* 从设备生成 */}
            <Drawer isOpen={fromDeviceOpen} onOpenChange={setFromDeviceOpen} size="sm">
                <DrawerContent>
                    <DrawerHeader>从设备生成模版</DrawerHeader>
                    <DrawerBody className="flex flex-col gap-4">
                        <Select label="选择源设备" placeholder="选择设备" selectedKeys={[fromDeviceId]}
                                onSelectionChange={(k) => setFromDeviceId(k as string)}>
                            {devices.map((d) => <SelectItem key={d.id}>{d.deviceName}</SelectItem>)}
                        </Select>
                        <Input label="模版名称" placeholder="留空则使用设备名称" value={fromTemplateName}
                               onValueChange={setFromTemplateName}/>
                        <Button color="primary" isLoading={fromDeviceMutation.isPending}
                                isDisabled={!fromDeviceId} onPress={handleFromDevice}>确认生成</Button>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>

            {/* 使用模版新建 */}
            <Drawer isOpen={applyOpen} onOpenChange={setApplyOpen} size="sm">
                <DrawerContent>
                    <DrawerHeader>使用模版新建设备</DrawerHeader>
                    <DrawerBody className="flex flex-col gap-4">
                        <Input label="新设备名称" placeholder="请输入设备名称" value={applyDeviceName}
                               onValueChange={setApplyDeviceName} isRequired/>
                        <Input label="网关 ID" placeholder="可选" value={applyGatewayId}
                               onValueChange={setApplyGatewayId}/>
                        <Button color="primary" isLoading={applyMutation.isPending}
                                isDisabled={!applyDeviceName.trim()} onPress={handleApply}>确认创建</Button>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </div>
    );
}

function Row({label, value}: { label: string; value?: string }) {
    return (
        <div className="flex items-center gap-4">
            <span className="w-24 text-foreground-500">{label}</span>
            <span className="text-foreground">{value || '-'}</span>
        </div>
    );
}

function ConfigJsonView({title, data}: { title: string; data: unknown }) {
    if (!data) return <div className="text-sm text-foreground-400">暂无{title}配置</div>;
    return (
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-content2 p-4 text-xs text-foreground-600">
      {JSON.stringify(data, null, 2)}
    </pre>
    );
}

function safeParse(json: string | undefined | null): unknown {
    if (!json || json.trim().length === 0) return null;
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}
