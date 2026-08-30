package com.vex.iot.common.enums;

/// 点位实时状态
public enum PointStatus {
    /// 正常
    NORMAL,
    /// 高预警
    WARN_HIGH,
    /// 低预警
    WARN_LOW,
    /// 高告警
    ALARM_HIGH,
    /// 低告警
    ALARM_LOW,
    /// 状态告警
    STATE_ALARM,
    /// 无数据（通信超时）
    NO_DATA
}
