package com.vex.iot.domain.report.exception;

/// 报表定义不存在异常
public class ReportDefinitionNotFoundException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "report_definition_not_found";

    public ReportDefinitionNotFoundException() {
        super(CODE, "报表定义不存在");
    }

    public ReportDefinitionNotFoundException(String id) {
        super(CODE, "报表定义不存在: " + id);
    }
}
