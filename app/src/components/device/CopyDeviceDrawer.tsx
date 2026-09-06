/**
 * 设备复制 Drawer — 确认命名 → 执行复制 → 进度反馈 → 完成跳转
 */
import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button, Drawer, DrawerBody, DrawerContent, DrawerHeader, Input, Progress,} from '@heroui/react';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {createDevice, getDevicePoints, getPanelConfig, savePanelConfig, savePoint} from '@/services/deviceService';
import {listDeviceSchedules, saveSchedule} from '@/services/scheduleService';
import type {Device} from '@/types/api';

type Phase = 'confirm' | 'copying' | 'done' | 'error';

interface StepStatus {
    label: string;
    state: 'pending' | 'active' | 'done' | 'error';
    detail?: string;
}

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    sourceDevice: Device | null;
}

export default function CopyDeviceDrawer({isOpen, onOpenChange, sourceDevice}: Props) {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>('confirm');
    const [newName, setNewName] = useState('');
    const [progress, setProgress] = useState(0);
    const [steps, setSteps] = useState<StepStatus[]>([]);
    const [copiedDeviceId, setCopiedDeviceId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen && sourceDevice) {
            setPhase('confirm');
            setNewName(`${sourceDevice.deviceName}(副本)`);
            setProgress(0);
            setSteps([]);
            setCopiedDeviceId(null);
            setErrorMsg('');
        }
    }, [isOpen, sourceDevice]);

    const updateStep = useCallback((i: number, patch: Partial<StepStatus>) => {
        setSteps((prev) => prev.map((s, idx) => (idx === i ? {...s, ...patch} : s)));
    }, []);

    const handleCopy = useCallback(async () => {
        if (!sourceDevice || !newName.trim()) return;
        setPhase('copying');
        setProgress(0);
        setErrorMsg('');
        setSteps([
            {label: '创建设备信息', state: 'pending'},
            {label: '复制点位设置', state: 'pending'},
            {label: '复制定时控制', state: 'pending'},
            {label: '复制面板信息', state: 'pending'},
        ]);
        try {
            // 1. 创建新设备
            updateStep(0, {state: 'active', detail: '正在创建...'});
            const newDevice = await chainToPromise(createDevice({
                deviceName: newName.trim(), gatewayId: sourceDevice.gatewayId,
                gatewayType: sourceDevice.gatewayType,
                level1Tag: sourceDevice.level1Tag, level2Tag: sourceDevice.level2Tag, level3Tag: sourceDevice.level3Tag,
            }));
            setCopiedDeviceId(newDevice.id);
            setProgress(25);
            updateStep(0, {state: 'done', detail: '完成'});

            // 2. 复制点位
            updateStep(1, {state: 'active', detail: '读取中...'});
            const points = await chainToPromise(getDevicePoints(sourceDevice.id));
            for (let i = 0; i < points.length; i++) {
                updateStep(1, {detail: `${i + 1}/${points.length}`});
                const p = points[i];
                await chainToPromise(savePoint({
                    deviceId: newDevice.id,
                    pointCode: p.pointCode,
                    pointName: p.pointName,
                    description: p.description,
                    unit: p.unit,
                    dataType: p.dataType,
                    access: p.access,
                    sortOrder: p.sortOrder,
                    groupKey: p.groupKey,
                    groupLabel: p.groupLabel,
                    valueMappings: p.valueMappings,
                    precision: p.precision
                }));
            }
            setProgress(50);
            updateStep(1, {state: 'done', detail: `${points.length} 个点位`});

            // 3. 复制定时
            updateStep(2, {state: 'active', detail: '读取中...'});
            const schedules = await chainToPromise(listDeviceSchedules(sourceDevice.id));
            for (const item of schedules) {
                const s = item.schedule;
                await chainToPromise(saveSchedule({
                    schedule: {
                        deviceId: newDevice.id,
                        name: s.name,
                        cron: s.cron,
                        enabled: s.enabled,
                        description: s.description,
                        actions: s.actions?.map((a) => ({
                            pointCode: a.pointCode,
                            valueText: a.valueText,
                            sortOrder: a.sortOrder
                        }))
                    }
                }));
            }
            setProgress(75);
            updateStep(2, {state: 'done', detail: `${schedules.length} 条规则`});

            // 4. 复制面板
            updateStep(3, {state: 'active', detail: '读取中...'});
            const panelCfg = await chainToPromise(getPanelConfig(sourceDevice.id));
            if (panelCfg?.panelConfig) await chainToPromise(savePanelConfig(newDevice.id, panelCfg.panelConfig));
            setProgress(100);
            updateStep(3, {state: 'done', detail: panelCfg?.panelConfig ? '完成' : '无面板'});

            setPhase('done');
        } catch (err) {
            setPhase('error');
            setErrorMsg(err instanceof Error ? err.message : '复制失败');
        }
    }, [sourceDevice, newName, updateStep]);

    const handleViewNew = () => {
        if (copiedDeviceId) {
            onOpenChange(false);
            navigate(`/devices/${copiedDeviceId}`, {replace: true});
        }
    };

    return (
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement="bottom" size="lg" hideCloseButton>
            <DrawerContent>
                <div className="flex justify-center py-2"><span className="h-1 w-10 rounded-full bg-default-300"/></div>

                {phase === 'confirm' && (
                    <>
                        <DrawerHeader className="flex flex-col gap-1 pb-2">
                            <span className="text-sm font-medium">复制设备</span>
                            {sourceDevice && <span
                                className="text-xs text-foreground-400">将从「{sourceDevice.deviceName}」复制以下内容</span>}
                        </DrawerHeader>
                        <DrawerBody className="p-4 pt-0">
                            <div className="mb-4 rounded-xl bg-content2 p-3">
                                {['设备信息 — 名称 / 网关 / 三级标签', '点位设置 — 从源设备逐条复制', '定时控制 — cron 规则 + 动作', '面板信息 — widget 布局配置'].map((t) => (
                                    <div key={t} className="flex items-center gap-2 py-1.5">
                                        <span className="text-success">✅</span>
                                        <span className="text-sm text-foreground">{t}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mb-4">
                                <label className="mb-1 block text-xs text-foreground-500">新设备名称</label>
                                <Input size="sm" value={newName} onValueChange={setNewName} placeholder="输入新设备名称"
                                       aria-label="新设备名称"/>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button color="primary" isDisabled={!newName.trim()}
                                        onPress={handleCopy}>确认复制</Button>
                                <Button variant="light" onPress={() => onOpenChange(false)}>取消</Button>
                            </div>
                        </DrawerBody>
                    </>
                )}

                {phase === 'copying' && (
                    <>
                        <DrawerHeader className="pb-2"><span
                            className="text-sm font-medium">正在复制...</span></DrawerHeader>
                        <DrawerBody className="p-4 pt-0">
                            <Progress value={progress} color="primary" className="mb-4" size="sm"/>
                            <div className="flex flex-col gap-2">
                                {steps.map((step, i) => (
                                    <div key={i} className="flex items-center gap-2 rounded-lg bg-content2 px-3 py-2">
                                        <span
                                            className="text-sm">{step.state === 'done' ? '✅' : step.state === 'active' ? '⏳' : step.state === 'error' ? '❌' : '⬜'}</span>
                                        <span className="flex-1 text-sm text-foreground">{i + 1}/4 {step.label}</span>
                                        {step.detail &&
                                            <span className="text-xs text-foreground-400">{step.detail}</span>}
                                    </div>
                                ))}
                            </div>
                        </DrawerBody>
                    </>
                )}

                {phase === 'done' && (
                    <>
                        <DrawerHeader className="pb-2"><span
                            className="text-sm font-medium text-success">✅ 复制完成！</span></DrawerHeader>
                        <DrawerBody className="p-4 pt-0">
                            <p className="mb-4 text-sm text-foreground-500">新设备「{newName}」已创建成功</p>
                            <div className="flex flex-col gap-2">
                                <Button color="primary" onPress={handleViewNew}>查看新设备 →</Button>
                                <Button variant="light" onPress={() => onOpenChange(false)}>继续复制其他设备</Button>
                            </div>
                        </DrawerBody>
                    </>
                )}

                {phase === 'error' && (
                    <>
                        <DrawerHeader className="pb-2"><span
                            className="text-sm font-medium text-danger">❌ 复制失败</span></DrawerHeader>
                        <DrawerBody className="p-4 pt-0">
                            <p className="mb-2 text-sm text-foreground-500">{errorMsg}</p>
                            <div className="flex flex-col gap-2">
                                <Button color="primary" onPress={handleCopy}>重试</Button>
                                <Button variant="light" onPress={() => onOpenChange(false)}>取消</Button>
                            </div>
                        </DrawerBody>
                    </>
                )}
            </DrawerContent>
        </Drawer>
    );
}
