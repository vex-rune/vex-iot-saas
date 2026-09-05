package com.vex.iot.domain.alarm.enums;

import com.vex.iot.common.config.IEnum;

/// 告警事件状态
public enum EventStatus implements IEnum {
    /// 告警活跃，还未恢复
    ACTIVE("活跃"),
    /// 告警自动恢复，未人工确认
    RECOVERED("已恢复"),
    /// 人工确认告警
    ACK("已确认");

    /// 中文展示名
    private final String displayName;

    EventStatus(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
