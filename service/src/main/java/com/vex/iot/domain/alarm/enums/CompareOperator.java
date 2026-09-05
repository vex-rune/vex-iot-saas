package com.vex.iot.domain.alarm.enums;

import com.vex.iot.common.config.IEnum;

/// 点位告警比较运算符
public enum CompareOperator implements IEnum {
    /// 大于
    GT("大于"),
    /// 大于等于
    GTE("大于等于"),
    /// 小于
    LT("小于"),
    /// 小于等于
    LTE("小于等于"),
    /// 值在集合内
    IN("包含"),
    /// 值不在集合内
    NOT_IN("不包含");

    /// 中文展示名
    private final String displayName;

    CompareOperator(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String displayName() {
        return displayName;
    }
}
