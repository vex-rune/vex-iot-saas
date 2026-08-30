package com.vex.iot.domain.device.exception;

/// 点位只读异常
public class PointReadOnlyException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "point_read_only";

    public PointReadOnlyException() {
        super(CODE);
    }
}
