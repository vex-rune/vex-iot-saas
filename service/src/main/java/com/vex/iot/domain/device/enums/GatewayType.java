package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 网关类型
public enum GatewayType implements IEnum {
    /// 有人G771透传模式
    USR_G771("有人G771透传"),
    /// 有人G771边缘计算模式
    USR_G771_EDGE("有人G771边缘计算"),
    /// Modbus TCP 网关
    MODBUS_TCP("Modbus TCP"),
    /// MQTT 直连设备
    MQTT_DIRECT("MQTT直连"),
    /// 其他类型
    OTHER("其他");

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
