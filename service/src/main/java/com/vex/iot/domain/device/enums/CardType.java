package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 仪表盘卡片类型
public enum CardType implements IEnum {
    /// 关键指标卡片
    KEY_POINT("关键指标"),
    /// 告警列表卡片
    ALARM_LIST("告警列表"),
    /// 统计卡片
    STAT("统计");

    /// 中文展示名
    private final String displayName;

    CardType(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
