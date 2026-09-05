package com.vex.iot.domain.notify.enums;

import com.vex.iot.common.config.IEnum;

/// 通知模版对接平台
public enum NotifyTemplatePlatform implements IEnum {
    /// 阿里云
    ALIYUN("阿里云"),
    /// 腾讯云
    TENCENT("腾讯云"),
    /// 华为云
    HUAWEI("华为云"),
    /// 其他
    OTHER("其他");

    /// 中文展示名
    private final String displayName;

    NotifyTemplatePlatform(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String displayName() {
        return displayName;
    }
}
