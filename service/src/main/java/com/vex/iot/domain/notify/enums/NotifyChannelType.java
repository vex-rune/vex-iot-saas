package com.vex.iot.domain.notify.enums;

import com.vex.iot.common.config.IEnum;

/// 通知渠道类型(与 domain.notify.channel.NotifyChannel 接口区分)
public enum NotifyChannelType implements IEnum {
    /// 短信
    SMS("短信"),
    /// 微信
    WECHAT("微信"),
    /// 邮件
    EMAIL("邮件");

    /// 中文展示名
    private final String displayName;

    NotifyChannelType(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String displayName() {
        return displayName;
    }
}
