package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 点位历史快照数据类型
public enum DataType implements IEnum {
    /// 布尔，存0/1
    BOOL("布尔"),
    /// 长整型
    INT("整数"),
    /// 单精度浮点
    FLOAT("单精度浮点"),
    /// 双精度浮点
    DOUBLE("双精度浮点"),
    /// 字符串状态
    STRING("字符串");

    /// 中文展示名
    private final String displayName;

    DataType(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
