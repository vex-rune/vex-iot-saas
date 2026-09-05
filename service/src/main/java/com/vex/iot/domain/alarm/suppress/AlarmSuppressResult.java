package com.vex.iot.domain.alarm.suppress;

import com.vex.iot.domain.alarm.model.AlarmLogEntity;

/// 告警抑制策略处理结果
///
/// @param suppressed   是否被完全抑制（不创建任何记录）
/// @param shouldNotify 是否需要发送通知（仅首次告警时为 true）
/// @param event        告警事件（新建或已存在的事件，suppressed=true 时为 null）
public record AlarmSuppressResult(
        boolean suppressed,
        boolean shouldNotify,
        AlarmLogEntity event
) {
    /// 完全抑制：不创建记录，不通知
    public static AlarmSuppressResult suppressedResult() {
        return new AlarmSuppressResult(true, false, null);
    }

    /// 聚合：递增次数，不通知
    public static AlarmSuppressResult aggregated(AlarmLogEntity event) {
        return new AlarmSuppressResult(false, false, event);
    }

    /// 首次告警：创建事件并通知
    public static AlarmSuppressResult triggered(AlarmLogEntity event) {
        return new AlarmSuppressResult(false, true, event);
    }
}