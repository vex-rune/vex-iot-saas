package com.vex.iot.domain.dashboard.exception;

import com.vex.iot.common.exception.BizException;

public class DashboardNotFoundException extends BizException {
    public static final String CODE = "dashboard_not_found";

    public DashboardNotFoundException(String id) {
        super(CODE, "仪表盘不存在: " + id);
    }
}
