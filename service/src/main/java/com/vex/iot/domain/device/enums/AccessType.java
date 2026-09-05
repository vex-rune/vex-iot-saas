package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 访问类型
public enum AccessType implements IEnum {
    /// 只读
    RO("只读"),
    /// 读写
    RW("读写");

    /// 中文展示名
    private final String displayName;

    AccessType(String displayName) {
        this.displayName = displayName;
    }


    @Override
    public String displayName() {
        return displayName;
    }
}
