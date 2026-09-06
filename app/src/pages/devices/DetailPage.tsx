import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Chip, Skeleton, Tab, Tabs} from '@heroui/react';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeftIcon, DocumentDuplicateIcon} from '@heroicons/react/24/outline';
import {getDevice} from '@/services/deviceService';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {formatRelativeTime} from '@/lib/format';
import {useDeviceHeartbeats} from '@/hooks/device/useDeviceHeartbeats';
import {deriveHeartbeatStatus} from '@/components/ui/DeviceCard';
import PanelPanelTab from '@/components/panel/PanelPanelTab';
import CopyDeviceDrawer from '@/components/device/CopyDeviceDrawer';
import PointUnifiedSection from './DetailSections/PointUnifiedSection';
import AlarmUnifiedSection from './DetailSections/AlarmUnifiedSection';
import ScheduleUnifiedSection from './DetailSections/ScheduleUnifiedSection';
import type {Device} from '@/types/api';
import {GATEWAY_TYPE_LABELS} from '@/types/api';

const HB_DOT: Record<string, string> = {fresh: 'bg-success', stale: 'bg-warning', offline: 'bg-danger'};
const HB_LABEL: Record<string, string> = {fresh: '在线', stale: '心跳延迟', offline: '离线'};

export default function DeviceDetail() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('panel');
    const [showCopy, setShowCopy] = useState(false);

    const {data: device, isLoading} = useQuery<Device>({
        queryKey: ['device', id],
        queryFn: () => chainToPromise(getDevice(id!)),
        enabled: !!id,
    });

    const {heartbeatMap} = useDeviceHeartbeats(id ? [id] : []);
    const hbInfo = id ? heartbeatMap.get(id) : undefined;
    const hbStatus = hbInfo?.status ?? deriveHeartbeatStatus(device?.lastHeartbeatAt);

    const tags = [device?.level1Tag, device?.level2Tag, device?.level3Tag]
        .filter((t): t is string => !!t && t.trim().length > 0);

    return (
        <div className="flex min-h-full flex-col gap-4">
            {/* 顶部信息栏 */}
            <div className="rounded-2xl bg-content1 p-5">
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-7 w-48 rounded-lg"/>
                        <Skeleton className="h-5 w-72 rounded-lg"/>
                    </div>
                ) : device ? (
                    <div className="flex flex-col gap-4">
                        {/* 第一行：返回 + 名称 + 状态 */}
                        <div className="flex items-center gap-3">
                            <Button isIconOnly variant="light" size="sm" onPress={() => navigate('/devices')}>
                                <ArrowLeftIcon className="h-5 w-5"/>
                            </Button>
                            <h1 className="text-lg font-semibold text-foreground">{device.deviceName}</h1>
                            <Chip size="sm" variant="flat" color={device.enabled ? 'success' : 'default'}>
                                {device.enabled ? '启用' : '停用'}
                            </Chip>
                            <div className="flex items-center gap-1.5">
                                <span className={['h-2 w-2 rounded-full', HB_DOT[hbStatus]].join(' ')}/>
                                <span className="text-xs text-foreground-500">{HB_LABEL[hbStatus]}</span>
                            </div>
                            <Button size="sm" variant="light" color="primary"
                                    startContent={<DocumentDuplicateIcon className="h-4 w-4"/>}
                                    onPress={() => setShowCopy(true)}>
                                复制
                            </Button>
                        </div>
                        {/* 第二行：详情 */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-12 text-sm">
                            {device.gatewayId && (
                                <span className="text-foreground-500">
                  网关 <code className="rounded bg-content2 px-1.5 py-0.5 text-xs text-foreground-600">{device.gatewayId}</code>
                                    {device.gatewayType && (
                                        <span
                                            className="ml-1 text-xs text-foreground-400">({GATEWAY_TYPE_LABELS[device.gatewayType] ?? device.gatewayType})</span>
                                    )}
                </span>
                            )}
                            {tags.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-foreground-500">标签</span>
                                    <div className="flex gap-1">
                                        {tags.map((t) => <Chip key={t} size="sm" variant="flat">{t}</Chip>)}
                                    </div>
                                </div>
                            )}
                            <span className="text-foreground-500">
                心跳 <span className="text-foreground-600">{formatRelativeTime(device.lastHeartbeatAt)}</span>
              </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-foreground-400">设备不存在</div>
                )}
            </div>

            {/* Tab 区 */}
            {device && (
                <div className="flex-1">
                    <Tabs size="sm" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}
                          classNames={{tabList: 'gap-4 px-0', cursor: 'bg-primary'}}>
                        <Tab key="panel" title="面板"/>
                        <Tab key="points" title="点位">
                            {activeTab === 'points' && <PointUnifiedSection deviceId={id!}/>}
                        </Tab>
                        <Tab key="alarm" title="告警">
                            {activeTab === 'alarm' && <AlarmUnifiedSection deviceId={id!}/>}
                        </Tab>
                        <Tab key="schedule" title="执行">
                            {activeTab === 'schedule' && <ScheduleUnifiedSection deviceId={id!}/>}
                        </Tab>
                    </Tabs>
                    <div className="mt-4">
                        {activeTab === 'panel' && <PanelPanelTab deviceId={id!} editing={false} onEditingChange={() => {
                        }}/>}
                    </div>
                </div>
            )}
            <CopyDeviceDrawer isOpen={showCopy} onOpenChange={setShowCopy} sourceDevice={device ?? null}/>
        </div>
    );
}
