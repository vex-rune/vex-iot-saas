package com.vex.iot.domain.report.model;

import com.vex.iot.common.config.IEnum;

/// 报表字段间运算符枚举
public enum ReportOperator implements IEnum {
    ADD,
    SUB,
    MUL,
    DIV;

    @Override
    public String displayName() {
        return name();
    }
}
