import { useQuery } from '@tanstack/react-query';
import {countActiveDevices} from '@/api/devices';
import { countAlarmEvents } from '@/api/alarms';
import { chainToPromise } from '@/hooks/useQueryList';

export interface DashboardKpis {
  /** 设备总数 */
  deviceTotal: number;
  /** 在线设备数 */
  onlineTotal: number;
  /** 告警事件总数(本期对齐为"今日告警"语义,与命名差异待 PRD 收敛) */
  alarmTotal: number;
  /** 未确认告警数 */
  unackTotal: number;
  /** 任一卡片仍在加载 */
  isLoading: boolean;
  /** 任一卡片失败 */
  isError: boolean;
}

/**
 * 概览页 4 张 KPI 卡片的统一数据源:
 * - 并行触发 4 次 count 请求,合并 loading/error 状态
 * - queryKey 用稳定前缀 ['dashboard.kpis'],便于后续在 mutation 成功后整体 invalidate
 * - 后端将"今日告警"暂用 countAlarmEvents({}) 占位(后端如要按今日窗口过滤,只需替换 predicate)
 */
export function useDashboardKpis(): DashboardKpis {
  const deviceTotalQ = useQuery({
    queryKey: ['dashboard.kpis', 'deviceTotal'],
    queryFn: () => chainToPromise(countActiveDevices({})),
  });
  const onlineTotalQ = useQuery({
    queryKey: ['dashboard.kpis', 'onlineTotal'],
    queryFn: () =>
      chainToPromise(
          countActiveDevices({
          predicate: { and: [{ condition: { field: 'online', op: 'eq', value: 'ONLINE' } }] },
        }),
      ),
  });
  const alarmTotalQ = useQuery({
    queryKey: ['dashboard.kpis', 'alarmTotal'],
    queryFn: () => chainToPromise(countAlarmEvents({})),
  });
  const unackTotalQ = useQuery({
    queryKey: ['dashboard.kpis', 'unackTotal'],
    queryFn: () =>
      chainToPromise(
        countAlarmEvents({
          predicate: { and: [{ condition: { field: 'acknowledged', op: 'eq', value: 'UNACK' } }] },
        }),
      ),
  });

  return {
    deviceTotal: deviceTotalQ.data ?? 0,
    onlineTotal: onlineTotalQ.data ?? 0,
    alarmTotal: alarmTotalQ.data ?? 0,
    unackTotal: unackTotalQ.data ?? 0,
    isLoading:
      deviceTotalQ.isLoading ||
      onlineTotalQ.isLoading ||
      alarmTotalQ.isLoading ||
      unackTotalQ.isLoading,
    isError:
      deviceTotalQ.isError ||
      onlineTotalQ.isError ||
      alarmTotalQ.isError ||
      unackTotalQ.isError,
  };
}
