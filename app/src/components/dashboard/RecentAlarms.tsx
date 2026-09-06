/**
 * Dashboard 最近告警(按级别分组,每组最多 3 条)
 */
import {useMemo} from 'react';
import {Button, Chip, Skeleton} from '@heroui/react';
import {CheckCircleIcon, ChevronRightIcon} from '@heroicons/react/24/outline';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {toastSuccess} from '@/lib/toast';
import {ackAlarmEvent} from '@/services/alarmService';
import {formatRelativeTime} from '@/lib/format';
import {ALARM_LEVEL_COLORS, ALARM_LEVEL_LABELS} from '@/lib/levelMeta';
import type {AlarmEvent, AlarmLevel} from '@/types/api';

const LEVEL_ORDER: AlarmLevel[] = ['FATAL', 'CRITICAL', 'WARNING', 'INFO'];
const PER_LEVEL_LIMIT = 3;

export interface RecentAlarmsProps {
  events: AlarmEvent[];
  loading?: boolean;
  /** 设备名 Map(用 deviceId 解析显示名) */
  deviceNameById?: Record<string, string>;
  /** "查看全部"按钮跳转(可选) */
  onViewAll?: () => void;
}

export default function RecentAlarms({
  events,
  loading = false,
  deviceNameById = {},
  onViewAll,
}: RecentAlarmsProps) {
  const ackMutation = useApiMutation({ mutationFn: ackAlarmEvent });

  // 按级别分组
  const grouped = useMemo(() => {
    const buckets: Record<AlarmLevel, AlarmEvent[]> = {
      FATAL: [], CRITICAL: [], WARNING: [], INFO: [],
    };
    events.forEach((e) => {
      if (buckets[e.level]) buckets[e.level].push(e);
    });
    return LEVEL_ORDER
      .map((level) => ({ level, items: buckets[level].slice(0, PER_LEVEL_LIMIT) }))
      .filter((g) => g.items.length > 0);
  }, [events]);

  const total = events.length;
  const acked = events.filter((e) => e.acknowledged === 'ACK').length;
  const unacked = total - acked;

  const handleAck = (id: string) => {
    ackMutation.mutate(id, {
        onSuccess: () => toastSuccess('告警已确认'),
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed border-divider p-6 text-center text-sm text-foreground-400">
        暂无告警事件
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 概览 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-foreground-500">共 {total} 条</span>
        {unacked > 0 && (
          <Chip size="sm" color="warning" variant="flat">未确认 {unacked}</Chip>
        )}
        {acked > 0 && (
          <Chip size="sm" color="success" variant="flat">已确认 {acked}</Chip>
        )}
        {onViewAll && (
          <Button
            size="sm"
            variant="flat"
            color="primary"
            endContent={<ChevronRightIcon className="h-4 w-4" />}
            onPress={onViewAll}
            className="ml-auto"
          >
            查看全部
          </Button>
        )}
      </div>

      {/* 分组 */}
      <div className="flex flex-col gap-2">
        {grouped.map(({ level, items }) => (
          <section key={level}>
            <div className="mb-1 flex items-center gap-2 text-xs text-foreground-500">
              <Chip size="sm" variant="flat" color={ALARM_LEVEL_COLORS[level]}>
                {ALARM_LEVEL_LABELS[level] ?? level}
              </Chip>
              <span>{items.length} 条</span>
            </div>
            <div className="flex flex-col gap-1">
              {items.map((e) => {
                const devName =
                  e.deviceId ? (deviceNameById[e.deviceId] ?? e.deviceId.slice(0, 8)) : '-';
                const acked = e.acknowledged === 'ACK';
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-divider bg-content1 p-2"
                  >
                    <Chip
                      size="sm"
                      variant="flat"
                      color={ALARM_LEVEL_COLORS[level]}
                      className="shrink-0"
                    >
                      {ALARM_LEVEL_LABELS[level] ?? level}
                    </Chip>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-foreground-500">
                        <span className="truncate">{devName}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(new Date(e.triggeredAt ?? e.occurTime ?? ''))}</span>
                      </div>
                      <div className="truncate text-sm text-foreground">{e.message || '-'}</div>
                    </div>
                    {!acked ? (
                      <Button
                        size="sm"
                        variant="flat"
                        color="success"
                        isIconOnly
                        isLoading={ackMutation.isPending}
                        onPress={() => handleAck(e.id)}
                        aria-label="确认告警"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Chip size="sm" variant="flat" color="success">已确认</Chip>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

