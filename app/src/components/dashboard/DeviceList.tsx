/**
 * Dashboard 设备列表
 * - 搜索:推后端 OR(名称 / 三级标签)
 * - 状态过滤:全部 / 在线 / 离线
 * - 排序:在线优先,其次有告警优先,然后按名称
 * - 选中态高亮
 */
import {useMemo, useState} from 'react';
import {Button, Input, Select, SelectItem, Skeleton} from '@heroui/react';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import DeviceCard from '@/components/ui/DeviceCard';
import type {Device} from '@/types/api';

export type DeviceFilterStatus = 'all' | 'online' | 'offline';

export interface DeviceListProps {
  devices: Device[];
  selectedId?: string | null;
  loading?: boolean;
  /** 设备未确认告警计数(可选,用于排序) */
  alarmCountByDevice?: Record<string, number>;
  /** 设备心跳 Map */
  heartbeats?: Map<string, { lastHeartbeatAt?: string; status?: 'fresh' | 'stale' | 'offline' }>;
  /** 紧凑态(列宽 < 280px) */
  compact?: boolean;
  /** 搜索态 */
  search: {
    input: string;
    setInput: (v: string) => void;
    applied: string;
    reset: () => void;
  };
  onSelect: (deviceId: string) => void;
}

export default function DeviceList({
  devices,
  selectedId,
  loading = false,
  alarmCountByDevice = {},
  heartbeats,
  compact = false,
  search,
  onSelect,
}: DeviceListProps) {
  const [filterStatus, setFilterStatus] = useState<DeviceFilterStatus>('all');

  // 客户端按 status 过滤 + 按状态/告警数/名称排序
  const sorted = useMemo(() => {
    const arr = devices.filter((d) => {
      if (filterStatus === 'online') return d.online === 'ONLINE';
      if (filterStatus === 'offline') return d.online !== 'ONLINE';
      return true;
    });
    return arr.sort((a, b) => {
      // 在线优先
      const ao = a.online === 'ONLINE' ? 0 : 1;
      const bo = b.online === 'ONLINE' ? 0 : 1;
      if (ao !== bo) return ao - bo;
      // 有未确认告警优先
      const ac = alarmCountByDevice[a.id] ?? 0;
      const bc = alarmCountByDevice[b.id] ?? 0;
      if (ac !== bc) return bc - ac;
      // 名称字典序
      return (a.deviceName ?? '').localeCompare(b.deviceName ?? '', 'zh-Hans-CN');
    });
  }, [devices, filterStatus, alarmCountByDevice]);

  return (
    <div className="flex h-full flex-col gap-2">
        {/* 搜索框 + 清空 */}
      <div className="flex items-center gap-1">
        <Input
          size="sm"
          aria-label="搜索设备"
          placeholder="搜索名称 / 标签"
          value={search.input}
          onValueChange={search.setInput}
          variant="bordered"
          className="flex-1"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
        />
        {search.applied && (
          <Button size="sm" variant="flat" onPress={search.reset}>
            清空
          </Button>
        )}
      </div>

      {/* 状态过滤 */}
      <Select
        size="sm"
        variant="bordered"
        aria-label="设备状态"
        selectedKeys={[filterStatus]}
        onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as DeviceFilterStatus)}
        className="w-full"
      >
        <SelectItem key="all">全部</SelectItem>
        <SelectItem key="online">仅在线</SelectItem>
        <SelectItem key="offline">仅离线</SelectItem>
      </Select>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-foreground-400">
            <span>{search.applied ? `没有匹配「${search.applied}」的设备` : '暂无设备'}</span>
            {search.applied && (
              <Button size="sm" variant="flat" onPress={search.reset}>
                清空搜索
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sorted.map((d) => (
              <div key={d.id} className="relative">
                <DeviceCard
                  device={d}
                  selected={d.id === selectedId}
                  compact={compact}
                  heartbeats={heartbeats}
                  onPress={() => onSelect(d.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

