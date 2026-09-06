/**
 * 移动端设备选择器 — 紧凑选择栏 + 底部抽屉
 *
 * 设计要点:
 * - 紧凑选择栏: 仅 48px 高,显示心跳圆点 + 设备名 + 箭头 + 总数
 * - 点击展开 HeroUI Drawer,内嵌完整 DeviceList(搜索/筛选/列表)
 * - 选中设备后自动关闭 Drawer
 */
import {useState} from 'react';
import {Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerHeader,} from '@heroui/react';
import {ChevronDownIcon} from '@heroicons/react/24/outline';
import DeviceList, {type DeviceListProps} from '@/components/dashboard/DeviceList';
import {deriveHeartbeatStatus} from '@/components/ui/DeviceCard';
import type {Device} from '@/types/api';

type SelectorProps = Pick<
    DeviceListProps,
    'devices' | 'selectedId' | 'loading' | 'alarmCountByDevice' | 'heartbeats' | 'search' | 'onSelect'
> & {
    /** 当前选中的设备对象(用于显示名称) */
    selectedDevice?: Device | null;
};

const HEARTBEAT_DOT: Record<string, string> = {
    fresh: 'bg-success',
    stale: 'bg-warning',
    offline: 'bg-default-300',
};

export default function MobileDeviceSelector({
                                                 devices,
                                                 selectedId,
                                                 loading,
                                                 alarmCountByDevice,
                                                 heartbeats,
                                                 search,
                                                 onSelect,
                                                 selectedDevice,
                                             }: SelectorProps) {
    const [open, setOpen] = useState(false);

    /** 选中设备:触发 onSelect + 关闭抽屉 */
    const handleSelect = (deviceId: string) => {
        onSelect(deviceId);
        setOpen(false);
    };

    /** 选中设备的心跳状态 */
    const hbInfo = selectedId ? heartbeats?.get(selectedId) : undefined;
    const hbStatus = hbInfo?.status ?? (selectedDevice?.lastHeartbeatAt
        ? deriveHeartbeatStatus(selectedDevice.lastHeartbeatAt)
        : 'offline');

    return (
        <>
            {/* ── 紧凑选择栏 ── */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center gap-2 rounded-xl bg-content1 p-3 text-left transition-colors active:bg-content2"
            >
                {/* 心跳圆点 */}
                <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${HEARTBEAT_DOT[hbStatus]}`}
                />
                {/* 设备名称 */}
                <span className={`min-w-0 flex-1 truncate text-sm font-medium ${
                    selectedDevice ? 'text-foreground' : 'text-foreground-400'
                }`}>
          {selectedDevice?.deviceName ?? '请选择设备'}
        </span>
                {/* 在线状态 */}
                {selectedDevice && (
                    <span className={`shrink-0 rounded px-1 text-[10px] ${
                        selectedDevice.online === 'ONLINE' ? 'text-success' : 'text-foreground-400'
                    }`}>
            {selectedDevice.online === 'ONLINE' ? '在线' : '离线'}
          </span>
                )}
                {/* 箭头 */}
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-foreground-400"/>
                {/* 总数 */}
                <Chip size="sm" variant="flat">{devices.length}</Chip>
            </button>

            {/* ── 底部抽屉 ── */}
            <Drawer
                isOpen={open}
                onOpenChange={setOpen}
                placement="bottom"
                size="lg"
                hideCloseButton
            >
                <DrawerContent>
                    {/* 把手 */}
                    <div className="flex justify-center py-2">
                        <span className="h-1 w-10 rounded-full bg-default-300"/>
                    </div>
                    <DrawerHeader className="flex items-center justify-between pb-2">
                        <span className="text-sm font-medium">选择设备</span>
                        <Button size="sm" variant="light" onPress={() => setOpen(false)}>
                            关闭
                        </Button>
                    </DrawerHeader>
                    <DrawerBody className="max-h-[60vh] overflow-y-auto p-3 pt-0">
                        <DeviceList
                            devices={devices}
                            selectedId={selectedId}
                            loading={loading}
                            alarmCountByDevice={alarmCountByDevice}
                            heartbeats={heartbeats}
                            search={search}
                            onSelect={handleSelect}
                        />
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </>
    );
}
