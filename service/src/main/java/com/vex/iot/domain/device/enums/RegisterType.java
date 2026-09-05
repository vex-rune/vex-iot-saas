package com.vex.iot.domain.device.enums;

import com.vex.iot.common.config.IEnum;

/// Modbus 寄存器类型
public enum RegisterType implements IEnum {
    /// 线圈（读写位）
    M("线圈"),
    /// 离散输入（只读位）
    Q("离散输入"),
    /// 输入寄存器（只读）
    I("输入寄存器"),
    /// 保持寄存器-双字
    VD("保持寄存器-双字"),
    /// 保持寄存器-字
    VW("保持寄存器-字"),
    /// 保持寄存器-浮点
    VF("保持寄存器-浮点");

    /// 中文展示名
    private final String displayName;

    RegisterType(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String displayName() {
        return displayName;
    }
}
