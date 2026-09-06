/** 控制台 (Dashboard) — 完美版 */
import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
    Button,
    Card,
    CardBody,
    Chip,
    Popover,
    PopoverContent,
    PopoverTrigger,
    RangeCalendar,
    TimeInput
} from '@heroui/react';
import {chainToPromise, useQueryList} from '@/hooks/common/useQueryList';
import {useDeviceHeartbeats} from '@/hooks/device/useDeviceHeartbeats';
import {deviceSearchPredicate, useDeviceSearch} from '@/hooks/device/useDeviceSearch';
import {useEventStream} from '@/hooks/common/useEventStream';
import {onRealtimePoint} from '@/services/deviceDataService';
import {countActiveDevices, getDevicePoints, getPanelConfig, queryActiveDevices} from '@/services/deviceService';
import {countAlarmEvents, queryAlarmEvents} from '@/services/alarmService';
import {parsePanelConfig} from '@/components/panel/types';
import PanelRenderer from '@/components/panel/PanelRenderer';
import KpiCard from '@/components/dashboard/KpiCard';
import DeviceList from '@/components/dashboard/DeviceList';
import MobileDeviceSelector from '@/components/dashboard/MobileDeviceSelector';
import RecentAlarms from '@/components/dashboard/RecentAlarms';
import {CalendarDateTime, Time, toCalendarDateTime} from '@internationalized/date';
import {ArrowPathIcon, CalendarDaysIcon, ChevronRightIcon, ClockIcon} from '@heroicons/react/24/outline';
import {useDashboardKpis} from '@/hooks/device/useDashboardKpis';
import {useIsMobile} from '@/hooks/common/useMediaQuery';
import type {AlarmEvent, Device, PointDefinition, Predicate} from '@/types/api';

interface DateRangeValue {
    start: CalendarDateTime | null;
    end: CalendarDateTime | null;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const deviceSearch = useDeviceSearch();
    const devicesPredicate = useMemo(() => deviceSearchPredicate(deviceSearch.applied), [deviceSearch.applied]);
    const devicesQuery = useQueryList<Device>({
        queryKey: 'devices.dashboard',
        queryFn: queryActiveDevices,
        countFn: countActiveDevices,
        defaultSize: 20,
        defaultPredicate: devicesPredicate,
    });
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRangeValue>({start: null, end: null});

    useEffect(() => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        const make = (d: Date, hour: number, minute: number): CalendarDateTime =>
            new CalendarDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), hour, minute, 0, 0);
        setDateRange({start: make(start, 0, 0), end: make(now, now.getHours(), now.getMinutes())});
    }, []);

    const kpis = useDashboardKpis();
    const selectedDevice = useMemo(() => devicesQuery.data.find((d) => d.id === selectedDeviceId), [devicesQuery.data, selectedDeviceId]);
    const {data: points} = useQuery<PointDefinition[]>({
        queryKey: ['device.points', selectedDeviceId],
        queryFn: () => chainToPromise(getDevicePoints(selectedDeviceId!)),
        enabled: !!selectedDeviceId,
    });
    const panelQuery = useQuery({
        queryKey: ['device.panel-config', selectedDeviceId],
        queryFn: () => chainToPromise(getPanelConfig(selectedDeviceId!)),
        enabled: !!selectedDeviceId,
    });
    const panelConfig = useMemo(() => (panelQuery.data ? parsePanelConfig(panelQuery.data.panelConfig) : {
        version: 1 as const,
        widgets: []
    }), [panelQuery.data]);
    useEventStream({
        'point.realtime': (payload: unknown) => {
            const data = payload as { deviceId?: string; pointCode?: string };
            if (!data.deviceId || !data.pointCode) return;
            onRealtimePoint(payload as never);
        }
    });
    // 最近告警联动: 默认全部, 选中某设备后只显示该设备
    const alarmsPredicate = useMemo<Predicate | undefined>(() => {
        if (!selectedDeviceId) return undefined;
        return {and: [{condition: {field: 'deviceId', op: 'eq', value: selectedDeviceId}}]};
    }, [selectedDeviceId]);

    const recentAlarmsQuery = useQueryList<AlarmEvent>({
        queryKey: 'dashboard.recentAlarms',
        queryFn: (body) => queryAlarmEvents(body),
        countFn: (body) => countAlarmEvents(body),
        defaultSize: 30,
        defaultPredicate: alarmsPredicate,
        defaultOrder: [{field: 'triggeredAt', order: 'DESC'}],
    });

    const recentAlarms = recentAlarmsQuery.data;
    const deviceNameById = useMemo(() => {
        const m: Record<string, string> = {};
        devicesQuery.data.forEach((d) => {
            m[d.id] = d.deviceName;
        });
        return m;
    }, [devicesQuery.data]);
    const alarmCountByDevice = useMemo(() => {
        const m: Record<string, number> = {};
        recentAlarms.forEach((e) => {
            if (e.acknowledged !== 'ACK' && e.deviceId) {
                m[e.deviceId] = (m[e.deviceId] ?? 0) + 1;
            }
        });
        return m;
    }, [recentAlarms]);
    const {heartbeatMap} = useDeviceHeartbeats(devicesQuery.data.map((d) => d.id));
    const fromSeconds = dateRange.start ? Math.floor(new Date(dateRange.start.toString()).getTime() / 1000) : undefined;
    const toSeconds = dateRange.end ? Math.floor(new Date(dateRange.end.toString()).getTime() / 1000) : undefined;

    return (
        <div className="flex min-h-full flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">控制台</h1>
                    <p className="mt-0.5 text-xs text-foreground-500">实时监控关键指标</p>
                </div>
                {/* <Chip size="sm" variant="flat" color="success">SSE 实时</Chip> */}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="设备总数" value={kpis.deviceTotal} loading={kpis.isLoading}
                         onPress={() => navigate('/devices')} hint="全部设备"/>
                <KpiCard label="在线设备" value={kpis.onlineTotal} loading={kpis.isLoading}
                         onPress={() => navigate('/devices?online=ONLINE')} hint="状态=ONLINE"/>
                <KpiCard label="今日告警" value={kpis.alarmTotal} loading={kpis.isLoading}
                         onPress={() => navigate('/alarms/events')} hint="全部告警"/>
                <KpiCard label="未确认告警" value={kpis.unackTotal} loading={kpis.isLoading} color="warning"
                         onPress={() => navigate('/alarms/events?ack=UNACK')} hint="待处理"/>
            </div>

            {isMobile ? (
                /* ── 移动端: 紧凑选择栏 + 面板 + 告警 ── */
                <div className="flex flex-col gap-3">
                    <MobileDeviceSelector
                        devices={devicesQuery.data}
                        selectedId={selectedDeviceId}
                        selectedDevice={selectedDevice}
                        loading={devicesQuery.isLoading}
                        alarmCountByDevice={alarmCountByDevice}
                        heartbeats={heartbeatMap}
                        search={deviceSearch}
                        onSelect={setSelectedDeviceId}
                    />

                    {/* 时间范围 — 桌面端 */}
                    <div className="rounded-xl bg-content1 p-3 hidden lg:block">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs text-foreground-500">时间范围(仅影响历史趋势曲线)</span>
                            <Button size="sm" variant="flat" startContent={<ArrowPathIcon className="h-3.5 w-3.5"/>}
                                    onPress={() => {
                                        const now = new Date();
                                        const start = new Date(now);
                                        start.setDate(start.getDate() - 1);
                                        const mk = (d: Date, h: number, m: number) => new CalendarDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m, 0, 0);
                                        setDateRange({
                                            start: mk(start, 0, 0),
                                            end: mk(now, now.getHours(), now.getMinutes())
                                        });
                                    }}>重置</Button>
                        </div>
                        <DashboardRangePicker value={dateRange} onChange={setDateRange}/>
                    </div>

                    {/* 监控面板 */}
                    <Card shadow="sm" classNames={{base: 'bg-content1'}}>
                        <CardBody className="p-4">
                            {!selectedDeviceId ? (
                                <div
                                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-divider p-8 text-center text-sm text-foreground-400">
                                    <span>请点击上方选择一台设备查看监控面板</span>
                                </div>
                            ) : (
                                <PanelRenderer config={panelConfig} deviceId={selectedDeviceId} points={points ?? []}
                                               fromSeconds={fromSeconds} toSeconds={toSeconds}/>
                            )}
                        </CardBody>
                    </Card>
                    <Card shadow="sm" classNames={{base: 'bg-content1'}}>
                        <CardBody className="p-4">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-foreground">告警</span>
                            </div>
                            <RecentAlarms events={recentAlarms} loading={recentAlarmsQuery.isLoading}
                                          deviceNameById={deviceNameById} onViewAll={() => navigate('/alarms/events')}/>
                        </CardBody>
                    </Card>
                </div>
            ) : (
                /* ── PC 端: 左侧设备列表 + 右侧面板 ── */
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr] items-start">
                    <div
                        className="rounded-xl bg-content1 p-3 lg:sticky lg:top-2 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">设备列表</span>
                            <Chip size="sm" variant="flat">{devicesQuery.total}</Chip>
                            <ChevronRightIcon className="ml-auto h-4 w-4 text-foreground-300"/>
                        </div>
                        <DeviceList devices={devicesQuery.data} selectedId={selectedDeviceId}
                                    loading={devicesQuery.isLoading} alarmCountByDevice={alarmCountByDevice}
                                    heartbeats={heartbeatMap} search={deviceSearch} onSelect={setSelectedDeviceId}/>
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                        <Card shadow="sm" classNames={{base: 'bg-content1'}}>
                            <CardBody className="p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">监控面板{selectedDevice &&
                                        <span
                                            className="ml-2 text-foreground-500">· {selectedDevice.deviceName}</span>}</span>
                                </div>
                                <div className="mb-3 rounded-lg bg-content2 p-2">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span
                                            className="text-xs text-foreground-500">时间范围(仅影响历史趋势曲线)</span>
                                        <Button size="sm" variant="flat" onPress={() => {
                                            const now = new Date();
                                            const start = new Date(now);
                                            start.setDate(start.getDate() - 1);
                                            const make = (d: Date, hour: number, minute: number): CalendarDateTime => new CalendarDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), hour, minute, 0, 0);
                                            setDateRange({
                                                start: make(start, 0, 0),
                                                end: make(now, now.getHours(), now.getMinutes())
                                            });
                                        }}>重置</Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DashboardRangePicker value={dateRange} onChange={setDateRange}/>
                                    </div>
                                </div>
                                {!selectedDeviceId ? (
                                    <div
                                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-divider p-12 text-center text-sm text-foreground-400">
                                        <span>请从左侧选择一台设备查看监控面板</span>
                                    </div>
                                ) : (
                                    <PanelRenderer config={panelConfig} deviceId={selectedDeviceId}
                                                   points={points ?? []} fromSeconds={fromSeconds}
                                                   toSeconds={toSeconds}/>
                                )}
                            </CardBody>
                        </Card>
                        <Card shadow="sm" classNames={{base: 'bg-content1'}}>
                            <CardBody className="p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-foreground">告警</span>
                                </div>
                                <RecentAlarms events={recentAlarms} loading={recentAlarmsQuery.isLoading}
                                              deviceNameById={deviceNameById}
                                              onViewAll={() => navigate('/alarms/events')}/>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}


/** 紧凑型日期时间范围选择器 — 按钮触发 Popover + RangeCalendar + TimeInput */
function DashboardRangePicker({
                                  value,
                                  onChange,
                              }: {
    value: { start: CalendarDateTime | null; end: CalendarDateTime | null };
    onChange: (v: { start: CalendarDateTime | null; end: CalendarDateTime | null }) => void;
}) {
    const [open, setOpen] = useState(false);

    const fmtShort = (d: CalendarDateTime | null) => {
        if (!d) return '--';
        return `${d.month}/${d.day} ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calValue = {start: (value.start ?? undefined) as any, end: (value.end ?? undefined) as any};

    return (
        <Popover placement="bottom" isOpen={open} onOpenChange={setOpen}>
            <PopoverTrigger>
                <Button size="sm" variant="flat" startContent={<CalendarDaysIcon className="h-4 w-4"/>}>
          <span className="text-xs">
            {fmtShort(value.start)} ~ {fmtShort(value.end)}
          </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-3">
                <div className="flex flex-col gap-3">
                    <RangeCalendar
                        aria-label="选择日期范围"
                        value={calValue}
                        onChange={(range) => {
                            const newStart = range.start
                                ? toCalendarDateTime(range.start).set({
                                    hour: value.start?.hour ?? 0,
                                    minute: value.start?.minute ?? 0,
                                    second: 0,
                                    millisecond: 0
                                })
                                : null;
                            const newEnd = range.end
                                ? toCalendarDateTime(range.end).set({
                                    hour: value.end?.hour ?? 23,
                                    minute: value.end?.minute ?? 59,
                                    second: 0,
                                    millisecond: 0
                                })
                                : null;
                            onChange({start: newStart, end: newEnd});
                        }}
                    />
                    <div className="flex items-center gap-2 rounded-lg border border-divider p-2">
                        <ClockIcon className="h-3.5 w-3.5 shrink-0 text-foreground-500"/>
                        <span className="text-xs text-foreground-500">时分</span>
                        <div className="ml-auto flex items-center gap-2">
                            <TimeInput
                                size="sm" variant="bordered" aria-label="开始时分"
                                value={value.start ? new Time(value.start.hour, value.start.minute) : new Time(0, 0)}
                                onChange={(t) => t && onChange({
                                    ...value,
                                    start: value.start?.set({hour: t.hour, minute: t.minute}) ?? null
                                })}
                                hourCycle={24} granularity="minute" className="w-24"
                            />
                            <span className="text-xs text-foreground-400">~</span>
                            <TimeInput
                                size="sm" variant="bordered" aria-label="结束时分"
                                value={value.end ? new Time(value.end.hour, value.end.minute) : new Time(23, 59)}
                                onChange={(t) => t && onChange({
                                    ...value,
                                    end: value.end?.set({hour: t.hour, minute: t.minute}) ?? null
                                })}
                                hourCycle={24} granularity="minute" className="w-24"
                            />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

