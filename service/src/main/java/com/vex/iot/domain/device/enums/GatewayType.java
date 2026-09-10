package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 网关类型
public enum GatewayType implements IEnum {
    /// 有人G771边缘计算模式
    USR_G771_EDGE("有人G771边缘计算");

    /// 中文展示名
    private final String displayName;

    GatewayType(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String displayName() {
        return displayName;
    }
}
