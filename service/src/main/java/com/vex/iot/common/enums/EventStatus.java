package com.vex.iot.common.enums;

/// 告警事件状态
public enum EventStatus {
    /// 告警活跃，还未恢复
    ACTIVE,
    /// 告警自动恢复，未人工确认
    RECOVERED,
    /// 人工确认告警
    ACK
}
