package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// 操作结果
public enum OperationResult implements IEnum {
    /// 已下发,等待设备回执
    PENDING("待确认"),
    /// 成功
    SUCCESS("成功"),
    /// 失败
    FAIL("失败");

    /// 中文展示名
    private final String displayName;

    OperationResult(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
