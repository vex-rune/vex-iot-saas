package com.vex.iot.domain.report.model;

import com.vex.iot.common.config.IEnum;

/// 报表数据源枚举
public enum ReportDataSource implements IEnum {
    DEVICE,
    POINT_HISTORY,
    POINT_REALTIME;

    @Override
    public String displayName() {
        return name();
    }
}
