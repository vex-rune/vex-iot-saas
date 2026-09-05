package com.vex.iot.domain.alarm.enums;

import com.vex.iot.common.config.IEnum;

/// 报警确认状态
public enum AlarmAckStatus implements IEnum {
    /// 未确认
    UNACK("未确认"),
    /// 已确认
    ACK("已确认");

    /// 中文展示名
    private final String displayName;

    AlarmAckStatus(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
