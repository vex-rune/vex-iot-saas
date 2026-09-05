package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 仪表盘业务类型
public enum BizType implements IEnum {
    /// 首页全局仪表盘
    GLOBAL("全局仪表盘"),
    /// 设备列表页仪表盘
    DEVICE("设备列表仪表盘"),
    /// 设备详情页内置仪表盘
    DEVICE_DETAIL("设备详情仪表盘");

    /// 中文展示名
    private final String displayName;

    BizType(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
