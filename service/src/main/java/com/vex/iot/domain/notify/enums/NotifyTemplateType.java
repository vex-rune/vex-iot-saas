package com.vex.iot.domain.notify.enums;

import com.vex.iot.common.config.IEnum;

/// 通知模版类型
public enum NotifyTemplateType implements IEnum {
    /// 短信
    SMS("短信"),
    /// 微信
    WECHAT("微信"),
    /// 邮件
    EMAIL("邮件");

    /// 中文展示名
    private final String displayName;

    NotifyTemplateType(String displayName) {
        this.displayName = displayName;
    }


    @Override
    public String displayName() {
        return displayName;
    }
}
