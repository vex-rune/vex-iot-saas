package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 设备在线状态
public enum DeviceOnline implements IEnum {
    /// 离线
    OFFLINE("离线"),
    /// 在线
    ONLINE("在线");

    /// 中文展示名
    private final String displayName;

    DeviceOnline(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
