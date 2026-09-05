package com.vex.iot.domain.alarm.enums;

import com.vex.iot.common.config.IEnum;

/// 报警级别
public enum AlarmLevel implements IEnum {
    /// 提示
    INFO("提示"),
    /// 警告
    WARNING("警告"),
    /// 紧急
    CRITICAL("紧急"),
    /// 严重
    FATAL("严重");

    /// 中文展示名
    private final String displayName;

    AlarmLevel(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String displayName() {
        return displayName;
    }
}
