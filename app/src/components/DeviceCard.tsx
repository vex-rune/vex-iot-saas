/**
 * Dashboard / 设备选择列表用的紧凑型设备卡。
 *
 * 设计要点:
 * - 紧凑态:仅显示「设备名 + 三级标签 + 心跳圆点」,用于窄列侧边栏
 * - 选中态:背景色 + 左侧高亮条,与列表其余项视觉区分
 * - 心跳映射:`useDeviceHeartbeats` 给的相对时间(刚刚 / X秒前 / 离线)直接渲染
 */
import type { Device } from '@/types/api';

export type DeviceHeartbeatStatus = 'fresh' | 'stale' | 'offline';

export interface DeviceHeartbeatInfo {
  /** 最近一次心跳时间(ISO 字符串) */
  lastHeartbeatAt?: string;
  /** 推导出的状态:fresh=≤10s,stale=10~60s,offline=>60s 或无心跳 */
  status?: DeviceHeartbeatStatus;
}

interface Props {
  device: Device;
  /** 是否当前选中 */
  selected?: boolean;
  /** 紧凑态(列宽 < 280px) */
  compact?: boolean;
  /** 该设备的心跳信息 Map:deviceId → info */
  heartbeats?: Map<string, DeviceHeartbeatInfo>;
  onPress?: () => void;
}

const HEARTBEAT_DOT_COLOR: Record<DeviceHeartbeatStatus, string> = {
  fresh: 'bg-success',
  stale: 'bg-warning',
  offline: 'bg-default-300',
};

/** 给定 ISO 时间和 now,推导状态阈值。空值 → offline。 */
export function deriveHeartbeatStatus(
  lastHeartbeatAt: string | undefined,
  now: number = Date.now(),
): DeviceHeartbeatStatus {
  if (!lastHeartbeatAt) return 'offline';
  const t = Date.parse(lastHeartbeatAt);
  if (Number.isNaN(t)) return 'offline';
  const diffSec = (now - t) / 1000;
  if (diffSec <= 10) return 'fresh';
  if (diffSec <= 60) return 'stale';
  return 'offline';
}

export default function DeviceCard({
  device,
  selected,
  compact = false,
  heartbeats,
  onPress,
}: Props) {
  const info = heartbeats?.get(device.id);
  const status: DeviceHeartbeatStatus =
    info?.status ?? deriveHeartbeatStatus(device.lastHeartbeatAt);

  const tags = [device.level1Tag, device.level2Tag, device.level3Tag]
    .filter((t): t is string => !!t && t.trim().length > 0);

  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={selected}
      className={[
        'flex w-full items-start gap-2 rounded-lg p-2 text-left transition-colors',
        selected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-content2',
      ].join(' ')}
    >
      {/* 心跳圆点 */}
      <span
        className={['mt-1.5 h-2 w-2 shrink-0 rounded-full', HEARTBEAT_DOT_COLOR[status]].join(' ')}
        title={
          status === 'fresh' ? '心跳新鲜' : status === 'stale' ? '心跳延迟' : '离线或无心跳'
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-sm font-medium text-foreground">{device.deviceName}</span>
          {!compact && (
            <span
              className={[
                'shrink-0 rounded px-1 text-[10px]',
                device.online === 'ONLINE' ? 'text-success' : 'text-foreground-400',
              ].join(' ')}
            >
              {device.online === 'ONLINE' ? '在线' : '离线'}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded bg-content2 px-1 text-[10px] text-foreground-500"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}