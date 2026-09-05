package com.vex.iot.domain.alarm.enums;

import com.vex.iot.common.config.IEnum;

/// 报警条件类型
public enum AlarmConditionType implements IEnum {
    /// 大于
    GT("大于", ">"),
    /// 大于等于
    GE("大于等于", ">="),
    /// 小于
    LT("小于", "<"),
    /// 小于等于
    LE("小于等于", "<="),
    /// 等于
    EQ("等于", "="),
    /// 不等于
    NE("不等于", "!="),
    /// 区间内（>= threshold 且 <= thresholdHigh）
    BETWEEN("区间", "[]");

    private final String displayName;
    private final String symbol;

    AlarmConditionType(String displayName, String symbol) {
        this.displayName = displayName;
        this.symbol = symbol;
    }

    public static AlarmConditionType fromCode(String code) {
        if (code == null) return null;
        for (AlarmConditionType v : values()) {
            if (v.name().equalsIgnoreCase(code)) return v;
        }
        return null;
    }

    @Override
    public String displayName() {
        return displayName;
    }



    public String getSymbol() {
        return symbol;
    }
}
