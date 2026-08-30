package com.vex.iot.domain.device.exception;

/// 点位不存在异常
public class PointDefinitionNotFoundException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "point_not_found";

    public PointDefinitionNotFoundException(String pointCode) {
        super(CODE, "点位不存在: " + pointCode);
    }
}
