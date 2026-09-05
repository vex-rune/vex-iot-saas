package com.vex.iot.domain.notify.enums;

import com.vex.iot.common.config.IEnum;

/// 通知记录发送状态
public enum NotifyRecordStatus implements IEnum {
    /// 发送成功
    SUCCESS("发送成功"),
    /// 发送失败
    FAILED("发送失败"),
    /// 发送中
    PENDING("发送中");

    /// 中文展示名
    private final String displayName;

    NotifyRecordStatus(String displayName) {
        this.displayName = displayName;
    }



    @Override
    public String displayName() {
        return displayName;
    }
}
