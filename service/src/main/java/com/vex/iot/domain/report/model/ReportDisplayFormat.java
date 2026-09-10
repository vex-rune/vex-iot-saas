package com.vex.iot.domain.report.model;

import com.vex.iot.common.config.IEnum;

/// 报表列显示格式枚举
public enum ReportDisplayFormat implements IEnum {
    raw,
    decimal2,
    decimal4,
    percent2,
    int,
    string;

    @Override
    public String displayName() {
        return name();
    }
    }
