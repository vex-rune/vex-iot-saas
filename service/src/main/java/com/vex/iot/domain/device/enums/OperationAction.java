package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 操作类型
public enum OperationAction implements IEnum {
    /// 登录
    LOGIN("登录"),
    /// 控制下发
    CONTROL("控制下发"),
    /// 其他
    OTHER("其他");

    /// 中文展示名
    private final String displayName;

    OperationAction(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
