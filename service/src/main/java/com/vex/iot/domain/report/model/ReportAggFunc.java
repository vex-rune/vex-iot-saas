package com.vex.iot.domain.report.model;

import com.vex.iot.common.config.IEnum;

/// 报表聚合函数枚举
public enum ReportAggFunc implements IEnum {
    NONE,
    SUM,
    AVG,
    MIN,
    MAX,
    COUNT,
    COUNT_DISTINCT;

    @Override
    public String displayName() {
        return name();
    }
}
